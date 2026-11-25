(function () {
  "use strict";

  const isMobileTouch = window.matchMedia(
    "(pointer: coarse) and (max-width: 960px), (hover: none) and (max-width: 960px)"
  ).matches;
  if (isMobileTouch) return;

  const HAND_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],[0,17]
  ];

  const CONFIRM_FRAMES = 2;
  const SNAP_RADIUS_PX = 92;
  const RESET_HOLD_MS = 650;
  const RESET_COOLDOWN_MS = 2000;
  const DWELL_MS = 750;
  const LOCK_COOLDOWN_MS = 1600;
  const RING_CIRCUMFERENCE = 2 * Math.PI * 18; // r=18

  let active = false;
  let loading = false;
  let spatialBtnRef = null;
  let resetHoldStart = 0;
  let resetCooldownUntil = 0;
  let handLandmarker = null;
  let stream = null;
  let videoEl = null;
  let pipEl = null;
  let canvasEl = null;
  let ctx2d = null;
  let statusEl = null;
  let reticleEl = null;
  let reticleRingEl = null;
  let reticleLabelEl = null;
  let rafId = null;
  let lastVideoTime = -1;

  // Debounced gesture state
  let lockedGesture = "idle";
  let pendingGesture = "idle";
  let pendingFrames = 0;

  // Orbit & Zoom state
  let prevPinch = null;
  let smoothX = 0.5;
  let smoothY = 0.5;
  let prevTwoFingerDist = null;
  let smoothTwoFingerDist = 0;
  let coastTheta = 0;
  let coastPhi = 0;
  let coastZoom = 0;
  let pendingTheta = 0;
  let pendingPhi = 0;
  let lastRafTime = 0;
  let lastZoomSfxAt = 0;
  let zoomClickAccum = 0;
  let lastOrbitSfxAt = 0;

  // Phase 2 Point-to-Lock state
  let cursorX = window.innerWidth * 0.5;
  let cursorY = window.innerHeight * 0.5;
  let dwellMesh = null;
  let dwellStart = 0;
  let lockCooldownUntil = 0;
  let lastLockedId = null;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function getCameraAndControls() {
    const cam = window._novaCamRef || window.camera;
    const ctrl = window._novaCtrlRef || window.controls;
    return (cam && ctrl) ? { cam, ctrl } : null;
  }

  function dist2D(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function isFingerExtended(lm, tipIdx, pipIdx) {
    return dist2D(lm[0], lm[tipIdx]) > dist2D(lm[0], lm[pipIdx]) * 1.12;
  }

  function getPinchRatio(lm) {
    const palmSize = Math.max(dist2D(lm[0], lm[9]), 0.05);
    return dist2D(lm[4], lm[8]) / palmSize;
  }

  function isClosedFist(lm) {
    const midCurled = dist2D(lm[0], lm[12]) < dist2D(lm[0], lm[10]) * 1.08;
    const ringCurled = dist2D(lm[0], lm[16]) < dist2D(lm[0], lm[14]) * 1.08;
    const pinkyCurled = dist2D(lm[0], lm[20]) < dist2D(lm[0], lm[18]) * 1.08;
    const indexTucked = dist2D(lm[0], lm[8]) < dist2D(lm[0], lm[5]) * 1.18;
    return midCurled && ringCurled && pinkyCurled && indexTucked;
  }

  function isPinching(lm) {
    const ratio = getPinchRatio(lm);
    if (lockedGesture === "orbit") {
      return ratio < 0.56;
    }
    if (isClosedFist(lm)) return false;
    return ratio < 0.35;
  }

  function isOpenPalm(lm) {
    return (
      !isPinching(lm) &&
      isFingerExtended(lm, 8, 6) &&
      isFingerExtended(lm, 12, 10) &&
      isFingerExtended(lm, 16, 14) &&
      isFingerExtended(lm, 20, 18)
    );
  }

  function isIndexPointing(lm) {
    return isFingerExtended(lm, 8, 6);
  }

  function isSoloPointing(lm) {
    if (isPinching(lm) || isOpenPalm(lm)) return false;
    const indexReach = dist2D(lm[0], lm[8]);
    const indexPip = dist2D(lm[0], lm[6]);
    const middleReach = dist2D(lm[0], lm[12]);
    const ringReach = dist2D(lm[0], lm[16]);
    return (
      indexReach > indexPip * 1.04 &&
      indexReach > middleReach * 1.08 &&
      indexReach > ringReach * 1.12
    );
  }

  function isPeaceSign(lm) {
    if (isPinching(lm) || isOpenPalm(lm)) return false;
    const indexExt = isFingerExtended(lm, 8, 6);
    const middleExt = isFingerExtended(lm, 12, 10);
    const ringCurled = dist2D(lm[0], lm[16]) < dist2D(lm[0], lm[14]) * 1.12;
    const pinkyCurled = dist2D(lm[0], lm[20]) < dist2D(lm[0], lm[18]) * 1.12;
    return indexExt && middleExt && ringCurled && pinkyCurled;
  }

  function isSpatialBlocked() {
    if (document.documentElement.classList.contains("screensaver-active")) return true;
    const tourBtn = document.getElementById("btn-cosmic-tour");
    const tourBadge = document.getElementById("tour-step-badge");
    if (tourBtn && tourBtn.getAttribute("data-nova-active") === "true") return true;
    if (tourBadge && tourBadge.offsetParent !== null) return true;
    return false;
  }

  function hasTwoDistinctHands(landmarks, handedness) {
    if (!landmarks || landmarks.length < 2) return false;
    if (dist2D(landmarks[0][0], landmarks[1][0]) < 0.05) return false;
    if (handedness && handedness.length >= 2) {
      const h0 = handedness[0]?.[0]?.categoryName;
      const h1 = handedness[1]?.[0]?.categoryName;
      if (h0 && h1 && h0 === h1) return false;
    }
    return true;
  }

  function updateDebouncedGesture(rawGesture) {
    if (rawGesture === lockedGesture) {
      pendingGesture = rawGesture;
      pendingFrames = 0;
      return lockedGesture;
    }
    if (rawGesture === "brake") {
      lockedGesture = "brake";
      pendingGesture = "brake";
      pendingFrames = 0;
      prevPinch = null;
      prevTwoFingerDist = null;
      resetDwell();
      return lockedGesture;
    }
    if (rawGesture === pendingGesture) {
      pendingFrames++;
      if (pendingFrames >= CONFIRM_FRAMES) {
        lockedGesture = rawGesture;
        pendingFrames = 0;
        prevPinch = null;
        prevTwoFingerDist = null;
        if (lockedGesture !== "point") hideReticle();
      }
    } else {
      pendingGesture = rawGesture;
      pendingFrames = 1;
    }
    return lockedGesture;
  }

  function isObjectVisibleInTree(obj) {
    let cur = obj;
    while (cur) {
      if (cur.visible === false) return false;
      cur = cur.parent;
    }
    return true;
  }

  function findNearestTarget(sx, sy) {
    if (typeof window.novaGetCatalog !== "function") return null;
    const refs = getCameraAndControls();
    if (!refs) return null;
    const { cam } = refs;
    const catalog = window.novaGetCatalog();
    if (!catalog || !catalog.length) return null;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const proj = cam.position.clone();
    let best = null;
    let bestDist = SNAP_RADIUS_PX;

    for (let i = 0; i < catalog.length; i++) {
      const entry = catalog[i];
      const mesh = (entry && entry.isObject3D) ? entry : (entry && entry.mesh ? entry.mesh : null);
      if (!mesh || !mesh.userData || !isObjectVisibleInTree(mesh)) continue;

      if (typeof mesh.getWorldPosition === "function") {
        mesh.getWorldPosition(proj);
      } else if (mesh.position) {
        proj.copy(mesh.position);
      } else {
        continue;
      }

      proj.project(cam);
      if (proj.z < -1 || proj.z > 1) continue;

      const px = (proj.x * 0.5 + 0.5) * w;
      const py = (-proj.y * 0.5 + 0.5) * h;
      const d = Math.hypot(px - sx, py - sy);
      if (d < bestDist) {
        bestDist = d;
        best = {
          mesh,
          x: px,
          y: py,
          label: (mesh.userData.name || mesh.userData.title || mesh.userData.id || "TARGET").toUpperCase()
        };
      }
    }
    return best;
  }

  function resetDwell() {
    dwellMesh = null;
    dwellStart = 0;
    if (reticleRingEl) {
      reticleRingEl.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
    }
  }

  function hideReticle() {
    resetDwell();
    if (reticleEl) {
      reticleEl.classList.remove("is-visible", "is-snapped", "is-locked");
    }
  }

  function updateReticle(lm) {
    if (!reticleEl) return;
    const now = performance.now();

    const rawX = clamp(((1 - lm[8].x) - 0.12) / 0.76, 0, 1) * window.innerWidth;
    const rawY = clamp((lm[8].y - 0.12) / 0.76, 0, 1) * window.innerHeight;
    cursorX += (rawX - cursorX) * 0.34;
    cursorY += (rawY - cursorY) * 0.34;

    const hit = findNearestTarget(cursorX, cursorY);
    let drawX = cursorX;
    let drawY = cursorY;

    reticleEl.classList.add("is-visible");

    if (hit) {
      drawX = cursorX + (hit.x - cursorX) * 0.65;
      drawY = cursorY + (hit.y - cursorY) * 0.65;
      reticleEl.classList.add("is-snapped");
      if (reticleLabelEl) reticleLabelEl.textContent = hit.label;

      const targetId = hit.mesh.userData.id || hit.label;
      const inCooldown = now < lockCooldownUntil && targetId === lastLockedId;

      if (!inCooldown) {
        if (dwellMesh !== hit.mesh) {
          dwellMesh = hit.mesh;
          dwellStart = now;
          if (typeof window.novaPlaySpatialSfx === "function") window.novaPlaySpatialSfx("snap");
        }
        const progress = clamp((now - dwellStart) / DWELL_MS, 0, 1);
        if (reticleRingEl) {
          reticleRingEl.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
        }

        if (progress >= 1) {
          if (typeof window.novaSlewToMesh === "function") {
            window.novaSlewToMesh(hit.mesh);
            if (typeof window.dismissSpatialCallout === "function") {
              window.dismissSpatialCallout();
            }
          }
          lastLockedId = targetId;
          lockCooldownUntil = now + LOCK_COOLDOWN_MS;
          dwellMesh = null;
          dwellStart = 0;
          reticleEl.classList.add("is-locked");
          if (typeof window.novaPlaySpatialSfx === "function") window.novaPlaySpatialSfx("lock");
          if (reticleLabelEl) reticleLabelEl.textContent = `LOCKED // ${hit.label}`;
          setTimeout(() => {
            if (reticleEl) reticleEl.classList.remove("is-locked");
          }, 550);
        }
      }
    } else {
      reticleEl.classList.remove("is-snapped");
      if (reticleLabelEl) reticleLabelEl.textContent = "";
      resetDwell();
    }

    reticleEl.style.transform = `translate3d(${drawX.toFixed(1)}px, ${drawY.toFixed(1)}px, 0)`;
  }

  function performSpatialReset() {
    let triggered = false;
    try {
      if (typeof window.triggerNovaReset === "function") {
        window.triggerNovaReset();
        triggered = true;
      }
    } catch (_) {}

    // Fallback: if triggerNovaReset did not start a camera flight, slew straight to the Sun
    setTimeout(() => {
      if (!isCameraTraveling()) {
        const sphere = document.getElementById("nova-attitude-sphere");
        if (!triggered && sphere) {
          sphere.click();
        }
        if (typeof window.novaGetCatalog === "function" && typeof window.novaSlewToMesh === "function") {
          const cat = window.novaGetCatalog();
          const sunEntry = cat.find((o) => {
            const m = (o && o.isObject3D) ? o : (o && o.mesh ? o.mesh : null);
            const id = (m && m.userData && (m.userData.id || m.userData.name) || "").toLowerCase();
            return id === "sun" || id === "sol";
          });
          const sunMesh = sunEntry ? (sunEntry.isObject3D ? sunEntry : sunEntry.mesh) : null;
          if (sunMesh) window.novaSlewToMesh(sunMesh);
        }
      }
    }, 60);
  }

  function isCameraTraveling() {
    return Boolean(
      window.novaState &&
      typeof window.novaState.getTravelPhase === "function" &&
      window.novaState.getTravelPhase() === "traveling"
    );
  }

  function getProportionalMinDistance(ctrl) {
    let floor = Math.max(ctrl.minDistance || 0.6, 0.6);
    if (typeof window.novaGetCatalog !== "function") return floor;

    const catalog = window.novaGetCatalog();
    if (!catalog || !catalog.length) return floor;

    const worldPos = ctrl.target.clone();
    let bestMesh = null;
    let bestDist = Infinity;

    for (let i = 0; i < catalog.length; i++) {
      const entry = catalog[i];
      const mesh = (entry && entry.isObject3D) ? entry : (entry && entry.mesh ? entry.mesh : null);
      if (!mesh) continue;
      if (typeof mesh.getWorldPosition === "function") mesh.getWorldPosition(worldPos);
      else if (mesh.position) worldPos.copy(mesh.position);
      else continue;

      const d = worldPos.distanceTo(ctrl.target);
      if (d < bestDist) {
        bestDist = d;
        bestMesh = mesh;
      }
    }

    if (bestMesh && bestDist < 12) {
      let objRadius = 0;
      if (bestMesh.geometry) {
        if (!bestMesh.geometry.boundingSphere && typeof bestMesh.geometry.computeBoundingSphere === "function") {
          bestMesh.geometry.computeBoundingSphere();
        }
        const geomR =
          (bestMesh.geometry.boundingSphere && bestMesh.geometry.boundingSphere.radius) ||
          (bestMesh.geometry.parameters && bestMesh.geometry.parameters.radius) ||
          0;
        const maxScale = bestMesh.scale
          ? Math.max(bestMesh.scale.x || 1, bestMesh.scale.y || 1, bestMesh.scale.z || 1)
          : 1;
        objRadius = geomR * maxScale;
      }
      if (!objRadius && bestMesh.userData && typeof bestMesh.userData.radius === "number") {
        objRadius = bestMesh.userData.radius;
      }
      if (objRadius > 0) {
        // Proportional close-up: ~2.35x object radius keeps surface & atmosphere cleanly framed
        floor = Math.max(floor, objRadius * 2.35);
      }
    }

    return floor;
  }

  function applyDeltaToCamera(dTheta, dPhi, dZoom) {
    if (isCameraTraveling()) {
      coastTheta = coastPhi = coastZoom = 0; pendingTheta = pendingPhi = 0;
    resetHoldStart = 0;
      return;
    }
    if (Math.abs(dTheta) < 1e-6 && Math.abs(dPhi) < 1e-6 && Math.abs(dZoom) < 1e-6) {
      return;
    }
    const refs = getCameraAndControls();
    if (!refs) return;
    const { cam, ctrl } = refs;

    const dx = cam.position.x - ctrl.target.x;
    const dy = cam.position.y - ctrl.target.y;
    const dz = cam.position.z - ctrl.target.z;
    let radius = Math.hypot(dx, dy, dz) || 1;

    let theta = Math.atan2(dx, dz) - dTheta;
    let phi = Math.acos(clamp(dy / radius, -1, 1)) - dPhi;
    phi = clamp(phi, 0.08, Math.PI - 0.08);

    const prevRadius = radius;
    const minD = getProportionalMinDistance(ctrl);
    const maxD = Math.min(ctrl.maxDistance || 85000, 85000);
    radius = clamp(radius * Math.exp(dZoom), minD, maxD);

    if (dZoom !== 0) {
      const actualLogDelta = Math.log(radius / prevRadius);
      if (Math.abs(actualLogDelta) > 1e-4) {
        zoomClickAccum += actualLogDelta;
        const nowSfx = performance.now();
        if (Math.abs(zoomClickAccum) >= 0.095 && nowSfx - lastZoomSfxAt > 65) {
          const dir = zoomClickAccum < 0 ? "zoom-in" : "zoom-out";
          zoomClickAccum = 0;
          lastZoomSfxAt = nowSfx;
          if (typeof window.novaPlaySpatialSfx === "function") {
            window.novaPlaySpatialSfx(dir);
          }
        }
      } else {
        zoomClickAccum = 0;
      }
    }

    const sinPhi = Math.sin(phi);
    cam.position.set(
      ctrl.target.x + radius * sinPhi * Math.sin(theta),
      ctrl.target.y + radius * Math.cos(phi),
      ctrl.target.z + radius * sinPhi * Math.cos(theta)
    );
    cam.lookAt(ctrl.target);
    ctrl.update();
  }

  function createOverlays() {
    if (!pipEl) {
      pipEl = document.createElement("div");
      pipEl.id = "nova-hand-pip";
      pipEl.innerHTML = `
        <div class="hand-pip-header">
          <span class="hand-pip-dot"></span>
          <span id="nova-hand-status">SPATIAL // INIT</span>
        </div>
        <canvas id="nova-hand-canvas" width="168" height="104"></canvas>
        <div class="hand-pip-legend">
          <div><span>PINCH</span><span>ORBIT</span></div>
          <div><span>2-FING</span><span>ZOOM</span></div>
          <div><span>POINT</span><span>LOCK</span></div>
          <div><span>PALM</span><span>BRAKE</span></div>
          <div><span>PEACE</span><span>RESET</span></div>
        </div>
      `;
      document.body.appendChild(pipEl);
      canvasEl = document.getElementById("nova-hand-canvas");
      ctx2d = canvasEl.getContext("2d");
      statusEl = document.getElementById("nova-hand-status");

      videoEl = document.createElement("video");
      videoEl.setAttribute("playsinline", "");
      videoEl.muted = true;
      videoEl.style.display = "none";
      document.body.appendChild(videoEl);
    }

    if (!reticleEl) {
      reticleEl = document.createElement("div");
      reticleEl.id = "nova-hand-reticle";
      reticleEl.innerHTML = `
        <svg viewBox="0 0 44 44" width="44" height="44">
          <circle class="reticle-track" cx="22" cy="22" r="18"></circle>
          <circle class="reticle-progress" cx="22" cy="22" r="18"
            stroke-dasharray="${RING_CIRCUMFERENCE.toFixed(2)}"
            stroke-dashoffset="${RING_CIRCUMFERENCE.toFixed(2)}"></circle>
          <circle class="reticle-dot" cx="22" cy="22" r="2.2"></circle>
        </svg>
        <div class="reticle-label"></div>
      `;
      document.body.appendChild(reticleEl);
      reticleRingEl = reticleEl.querySelector(".reticle-progress");
      reticleLabelEl = reticleEl.querySelector(".reticle-label");
    }
  }

  function setStatus(label, accent) {
    if (!statusEl) return;
    statusEl.textContent = `SPATIAL // ${label}`;
    if (pipEl) pipEl.dataset.state = accent || "idle";
  }

  function drawWireframe(hands, accentColor, mode) {
    if (!ctx2d || !canvasEl) return;
    const w = canvasEl.width;
    const h = canvasEl.height;
    ctx2d.clearRect(0, 0, w, h);

    if (!hands || !hands.length) return;

    hands.forEach((lm) => {
      ctx2d.strokeStyle = accentColor;
      ctx2d.lineWidth = 1.25;
      ctx2d.beginPath();
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx2d.moveTo((1 - lm[a].x) * w, lm[a].y * h);
        ctx2d.lineTo((1 - lm[b].x) * w, lm[b].y * h);
      }
      ctx2d.stroke();

      ctx2d.fillStyle = "#f8fafc";
      for (let i = 0; i < lm.length; i++) {
        const x = (1 - lm[i].x) * w;
        const y = lm[i].y * h;
        const r =
          ((mode === "zoom" || mode === "point") && i === 8) ||
          (mode === "pinch" && (i === 4 || i === 8))
            ? 2.8
            : 1.2;
        ctx2d.beginPath();
        ctx2d.arc(x, y, r, 0, Math.PI * 2);
        ctx2d.fill();
      }
    });

    if (mode === "pinch" && hands.length >= 1) {
      const lm = hands[0];
      const px = (1 - (lm[4].x + lm[8].x) * 0.5) * w;
      const py = ((lm[4].y + lm[8].y) * 0.5) * h;
      ctx2d.strokeStyle = "rgba(251, 191, 36, 0.95)";
      ctx2d.lineWidth = 1.5;
      ctx2d.beginPath();
      ctx2d.arc(px, py, 6, 0, Math.PI * 2);
      ctx2d.stroke();
    }

    if (mode === "zoom" && hands.length >= 2) {
      const a = hands[0][8];
      const b = hands[1][8];
      ctx2d.strokeStyle = "rgba(251, 191, 36, 0.95)";
      ctx2d.lineWidth = 1.5;
      ctx2d.setLineDash([3, 3]);
      ctx2d.beginPath();
      ctx2d.moveTo((1 - a.x) * w, a.y * h);
      ctx2d.lineTo((1 - b.x) * w, b.y * h);
      ctx2d.stroke();
      ctx2d.setLineDash([]);
    }
  }

  function processResult(result) {
    const hands = result.landmarks || [];
    const handedness = result.handedness || [];

    if (isCameraTraveling()) {
      prevPinch = null;
      prevTwoFingerDist = null;
      coastTheta = coastPhi = coastZoom = 0; pendingTheta = pendingPhi = 0;
      hideReticle();
      setStatus("SLEWING", "idle");
      drawWireframe(hands.length ? [hands[0]] : null, "rgba(148,163,184,0.45)", "idle");
      return;
    }

    if (hands.length === 0) {
      lockedGesture = "idle";
      pendingGesture = "idle";
      pendingFrames = 0;
      prevPinch = null;
      prevTwoFingerDist = null;
      hideReticle();
      setStatus("READY", "idle");
      drawWireframe(null, "rgba(148,163,184,0.45)", "idle");
      return;
    }

    let rawGesture = "idle";
    const twoHandsValid = hasTwoDistinctHands(hands, handedness);

    if (twoHandsValid && isIndexPointing(hands[0]) && isIndexPointing(hands[1])) {
      rawGesture = "scale";
    } else if (!twoHandsValid) {
      const lm = hands[0];
      if (isPinching(lm)) rawGesture = "orbit";
      else if (isOpenPalm(lm)) rawGesture = "brake";
      else if (isPeaceSign(lm)) rawGesture = "reset";
      else if (isSoloPointing(lm)) rawGesture = "point";
    }

    const gesture = updateDebouncedGesture(rawGesture);

    // 1. Two-Finger Full-Range Cosmic Zoom
    if (gesture === "scale" && twoHandsValid) {
      hideReticle();
      prevPinch = null;
      coastTheta = coastPhi = 0; pendingTheta = pendingPhi = 0;

      const tipDist = dist2D(hands[0][8], hands[1][8]);
      if (prevTwoFingerDist === null) {
        smoothTwoFingerDist = tipDist;
        prevTwoFingerDist = tipDist;
      } else {
        smoothTwoFingerDist += (tipDist - smoothTwoFingerDist) * 0.38;
        const delta = smoothTwoFingerDist - prevTwoFingerDist;
        prevTwoFingerDist = smoothTwoFingerDist;

        let stepZoom = 0;
        if (Math.abs(delta) > 0.001) {
          stepZoom = clamp(delta * 14.5, -0.55, 0.55);
        }
        if (smoothTwoFingerDist < 0.055) {
          stepZoom = Math.min(stepZoom, -0.10);
        } else if (smoothTwoFingerDist > 0.72) {
          stepZoom = Math.max(stepZoom, 0.10);
        }
        if (stepZoom !== 0) {
          applyDeltaToCamera(0, 0, stepZoom);
          coastZoom = stepZoom * 0.42;

        }
      }

      setStatus("ZOOM [2-FINGER]", "active");
      drawWireframe(hands.slice(0, 2), "rgba(251,191,36,0.92)", "zoom");
      return;
    }

    // 2. Open Palm -> Instant Brake
    if (gesture === "brake") {
      hideReticle();
      prevPinch = null;
      prevTwoFingerDist = null;
      coastTheta = coastPhi = coastZoom = 0; pendingTheta = pendingPhi = 0;
      setStatus("BRAKE", "brake");
      drawWireframe([hands[0]], "rgba(248,250,252,0.85)", "idle");
      return;
    }

    // 3. Thumb + Index Pinch & Drag -> Continuous 60fps Smoothed Orbit
    if (gesture === "orbit") {
      hideReticle();
      prevTwoFingerDist = null;
      coastZoom = 0;

      const lm = hands[0];
      // Blend 70% stable palm center + 30% pinch midpoint to filter fingertip tremor
      const pinchX = 1 - (lm[4].x + lm[8].x) * 0.5;
      const pinchY = (lm[4].y + lm[8].y) * 0.5;
      const palmX = 1 - lm[9].x;
      const palmY = lm[9].y;
      const mx = palmX * 0.70 + pinchX * 0.30;
      const my = palmY * 0.70 + pinchY * 0.30;

      if (prevPinch === null) {
        smoothX = mx;
        smoothY = my;
        prevPinch = { x: mx, y: my };
      } else {
        smoothX += (mx - smoothX) * 0.28;
        smoothY += (my - smoothY) * 0.28;
        const dx = smoothX - prevPinch.x;
        const dy = smoothY - prevPinch.y;
        prevPinch = { x: smoothX, y: smoothY };

        if (Math.abs(dx) > 0.0012) {
          pendingTheta = clamp(pendingTheta + clamp(dx * 4.2, -0.14, 0.14), -0.35, 0.35);
        }
        if (Math.abs(dy) > 0.0012) {
          pendingPhi = clamp(pendingPhi + clamp(dy * 3.0, -0.10, 0.10), -0.25, 0.25);
        }
        const nowSfx = performance.now();
        if (Math.hypot(dx, dy) > 0.006 && nowSfx - lastOrbitSfxAt > 220) {
          lastOrbitSfxAt = nowSfx;
          if (typeof window.novaPlaySpatialSfx === "function") {
            window.novaPlaySpatialSfx("orbit");
          }
        }
      }

      setStatus("ORBIT [PINCH]", "active");
      drawWireframe([hands[0]], "rgba(251,191,36,0.95)", "pinch");
      return;
    }

    // 3b. Peace Sign Hold -> Reset Map to Home View
    if (gesture === "reset") {
      hideReticle();
      prevPinch = null;
      prevTwoFingerDist = null;
      coastTheta = coastPhi = coastZoom = 0; pendingTheta = pendingPhi = 0;

      const now = performance.now();
      if (now >= resetCooldownUntil) {
        if (!resetHoldStart) resetHoldStart = now;
        const pct = Math.min(100, Math.round(((now - resetHoldStart) / RESET_HOLD_MS) * 100));
        setStatus(`RESET ${pct}%`, "active");
        if (now - resetHoldStart >= RESET_HOLD_MS) {
          performSpatialReset();
          if (typeof window.novaPlaySpatialSfx === "function") window.novaPlaySpatialSfx("reset");
          resetHoldStart = 0;
          resetCooldownUntil = now + RESET_COOLDOWN_MS;
          setStatus("RESET HOME", "brake");
        }
      } else {
        setStatus("RESET HOME", "brake");
      }
      drawWireframe([hands[0]], "rgba(251,191,36,0.95)", "idle");
      return;
    }
    resetHoldStart = 0;

    // 4. Phase 2: Solo Index Point -> Reticle & Dwell-to-Lock
    if (gesture === "point") {
      prevPinch = null;
      prevTwoFingerDist = null;
      coastTheta = coastPhi = coastZoom = 0; pendingTheta = pendingPhi = 0;
      updateReticle(hands[0]);
      setStatus("TARGET [POINT]", "active");
      drawWireframe([hands[0]], "rgba(248,250,252,0.9)", "point");
      return;
    }

    // 5. Neutral Tracking
    hideReticle();
    prevPinch = null;
    prevTwoFingerDist = null;
    setStatus("TRACKING", "idle");
    drawWireframe(twoHandsValid ? hands.slice(0, 2) : [hands[0]], "rgba(148,163,184,0.65)", "idle");
  }

  function loop() {
    if (!active) return;
    if (document.documentElement.classList.contains("screensaver-active")) {
      document.documentElement.classList.remove("screensaver-active");
    }
    if (isSpatialBlocked()) {
      stopHandControl(spatialBtnRef);
      return;
    }
    let processedVideo = false;

    if (handLandmarker && videoEl && videoEl.readyState >= 2) {
      const now = performance.now();
      if (videoEl.currentTime !== lastVideoTime) {
        lastVideoTime = videoEl.currentTime;
        const result = handLandmarker.detectForVideo(videoEl, now);
        processResult(result);
        processedVideo = true;
      }
    }

    const nowRaf = performance.now();
    const dt = lastRafTime ? Math.min((nowRaf - lastRafTime) / 1000, 0.05) : (1 / 60);
    lastRafTime = nowRaf;

    // Smooth exponential ease on every display frame (decouples 30fps webcam from 60/120fps render)
    const ease = 1 - Math.exp(-9 * dt);
    const frameTheta = pendingTheta * ease;
    const framePhi = pendingPhi * ease;
    pendingTheta -= frameTheta;
    pendingPhi -= framePhi;
    if (Math.abs(pendingTheta) < 1e-5) pendingTheta = 0;
    if (Math.abs(pendingPhi) < 1e-5) pendingPhi = 0;

    let frameZoom = 0;
    if (!processedVideo || lockedGesture === "idle") {
      frameZoom = coastZoom;
      coastZoom *= Math.pow(0.82, dt * 60);
      if (Math.abs(coastZoom) < 1e-5) coastZoom = 0;
    }

    applyDeltaToCamera(frameTheta, framePhi, frameZoom);
    rafId = requestAnimationFrame(loop);
  }

  async function initLandmarker() {
    if (handLandmarker) return handLandmarker;
    setStatus("LOADING MODEL", "idle");
    const vision = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs"
    );
    const fileset = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.72,
      minHandPresenceConfidence: 0.72,
      minTrackingConfidence: 0.72
    });
    return handLandmarker;
  }

  async function startHandControl(btn) {
    if (loading || active || isSpatialBlocked()) return;
    loading = true;
    createOverlays();
    pipEl.classList.add("is-visible");
    setStatus("CAMERA...", "idle");

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false
      });
      videoEl.srcObject = stream;
      await videoEl.play();
      await initLandmarker();

      active = true;
      document.documentElement.classList.add("nova-spatial-active");
      document.documentElement.classList.remove("screensaver-active");
      if (typeof window.dismissSpatialCallout === "function") {
        window.dismissSpatialCallout();
      }
      btn.setAttribute("data-nova-active", "true");
      if (typeof window.novaPlaySpatialSfx === "function") window.novaPlaySpatialSfx("toggle-on");
      setStatus("READY", "idle");
      rafId = requestAnimationFrame(loop);
    } catch (err) {
      console.error("[NOVA Hand Control]", err);
      setStatus("CAM DENIED", "brake");
      setTimeout(() => stopHandControl(btn), 1600);
    } finally {
      loading = false;
    }
  }

  function stopHandControl(btn) {
    active = false;
    document.documentElement.classList.remove("nova-spatial-active");
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    lockedGesture = "idle";
    pendingGesture = "idle";
    pendingFrames = 0;
    prevPinch = null;
    prevTwoFingerDist = null;
    coastTheta = coastPhi = coastZoom = 0; pendingTheta = pendingPhi = 0;
    hideReticle();

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (videoEl) videoEl.srcObject = null;
    if (pipEl) pipEl.classList.remove("is-visible");
    if (ctx2d && canvasEl) ctx2d.clearRect(0, 0, canvasEl.width, canvasEl.height);
    if (btn) btn.setAttribute("data-nova-active", "false");
    if (typeof window.novaPlaySpatialSfx === "function") window.novaPlaySpatialSfx("toggle-off");
  }

  function mountSpatialButton() {
    let btn = document.getElementById("btn-hand-control");
    if (btn) return btn;

    // Find the SCALE button in the top-left header (injected by palette.js)
    const buttons = Array.from(document.querySelectorAll("button"));
    const scaleBtn = buttons.find((b) => (b.textContent || "").trim().toUpperCase() === "SCALE");
    if (!scaleBtn || !scaleBtn.parentElement) return null;

    btn = document.createElement("button");
    btn.id = "btn-hand-control";
    btn.type = "button";
    btn.className = "nova-spatial-mode-btn";
    btn.setAttribute("aria-label", "Toggle Spatial Hand Navigation (Shortcut: Shift)");
    btn.setAttribute("title", "Touchless Hand Navigation [Shift]");
    btn.setAttribute("data-tip", "Spatial Hand Navigation [Shift]");
    btn.setAttribute("data-nova-active", "false");

    if (!localStorage.getItem("nova_spatial_seen")) {
      const dot = document.createElement("span");
      dot.className = "spatial-new-dot";
      btn.appendChild(dot);
    }

    scaleBtn.insertAdjacentElement("afterend", btn);
    return btn;
  }

  function wireButton() {
    const btn = mountSpatialButton();
    if (!btn) {
      setTimeout(wireButton, 180);
      return;
    }
    if (btn.dataset.spatialWired === "true") return;
    btn.dataset.spatialWired = "true";
    spatialBtnRef = btn;

    const syncBlockedState = () => {
      // Allow SPATIAL to override Standby when already active; otherwise lock out during Tour or Standby
      const tourBtn = document.getElementById("btn-cosmic-tour");
      const tourBadge = document.getElementById("tour-step-badge");
      const tourActive =
        (tourBtn && tourBtn.getAttribute("data-nova-active") === "true") ||
        Boolean(tourBadge && tourBadge.offsetParent !== null);
      const standbyActive = !active && document.documentElement.classList.contains("screensaver-active");
      const blocked = tourActive || standbyActive;

      if (tourActive && active) stopHandControl(btn);
      btn.style.opacity = blocked ? "0.35" : "";
      btn.style.pointerEvents = blocked ? "none" : "";
    };

    const obs = new MutationObserver(syncBlockedState);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const tourBtn = document.getElementById("btn-cosmic-tour");
    if (tourBtn) {
      obs.observe(tourBtn, { attributes: true, attributeFilter: ["data-nova-active"] });
      tourBtn.addEventListener("click", () => setTimeout(syncBlockedState, 80));
    }

    btn.addEventListener("click", () => {
      localStorage.setItem("nova_spatial_seen", "1");
      const dot = btn.querySelector(".spatial-new-dot");
      if (dot) dot.remove();
      if (active) stopHandControl(btn);
      else startHandControl(btn);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && active) {
        stopHandControl(btn);
      }
    });

    // Clean solo Shift tap toggles SPATIAL; block S (Standby) while SPATIAL is active
    let shiftTapCandidate = false;

    window.addEventListener("keydown", (e) => {
      const cmp = document.getElementById("nova-compare-overlay");
      if (cmp && !cmp.classList.contains("hidden") && cmp.style.display !== "none") return;
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (e.key === "Shift" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        shiftTapCandidate = true;
        return;
      }

      // Any other key pressed while holding Shift cancels the solo-tap
      shiftTapCandidate = false;

      const k = (e.key || "").toLowerCase();
      if (k === "s" && active && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);

    window.addEventListener("keyup", (e) => {
      if (e.key === "Shift" && shiftTapCandidate) {
        shiftTapCandidate = false;
        const cmp = document.getElementById("nova-compare-overlay");
        if (cmp && !cmp.classList.contains("hidden") && cmp.style.display !== "none") return;
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        btn.click();
      }
    }, true);

    // Keep Standby idle timer from firing while SPATIAL is active
    setInterval(() => {
      if (active) {
        document.documentElement.classList.remove("screensaver-active");
        window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 1, clientY: 1 }));
      }
    }, 15000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireButton);
  } else {
    wireButton();
  }
})();
