// NOVA Core 3D Engine & Observatory Application

import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ASTROPHYSICAL_ARCHIVE, TIER_INTROS } from './data/archive.js';
import { PRIMARY_CELESTIAL_NAMES, COURSE_METRIC_DECODER, SURFACE_FEATURE_REGISTRY, NOVA_NASA_DIST_AU, NOVA_NASA_DIST_LY } from './data/registries.js';
import {
  nasaTexCache, nasaBumpCache, noise3D, fbm3D, ridgedFbm3D,
  colorRamp, buildNASACanvasTexture, classifyMeshTextureKind
} from './textures.js';
import { createAnimatedSunMaterial, createAnimatedCoronaLayer } from './shaders/sun.js';
import { buildVolumetricCelestialStructures, createProceduralCloudTexture, createFbmNebulaTexture } from './volumetrics.js';
import { initCosmicTour } from './tour.js';
import { initDeepLinks, setDeepLinkTarget, setDeepLinkTier } from './deeplink.js';
import { initScaleCompare } from './compare.js?v=11';
import { initAndStepNovaDepthEngine, enforceSceneDepthOcclusion } from './depth-engine.js?v=2';
import { buildVolumetricOortCloud, buildNASAHubbleCosmicWeb, buildDelicateAuroraCMB, updateCMBThermalAcoustics } from './cosmos.js?v=4';

    
    function cleanAstrophysicalText(txt) {
      if (!txt) return "";
      // Remove scale regime parentheticals and percentage/composition brackets if redundant
      return txt
        .replace(/\s*\(scale regime [^\)]+\)/gi, "")
        .replace(/\s*\(scale order [^\)]+\)/gi, "")
        .replace(/\s*\(approx\.\s*[^\)]+\)/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    }

    let scene, camera, renderer, controls, raycaster, mouse;
    let catalog = [];
    let celestialObjects = [];
    let orbitingPlanets = [];
    let earthMeshRef = null;
    let moonMeshRef = null;
    let moonOrbitRingRef = null;
    let moonOrbitAngle = 0.8;
    let isFlyingToTarget = false;
    let lastTrackedTargetPos = new THREE.Vector3();
    let filamentFlowParticles = [];
    let rotatableObjects = [];
    let milkyWayGroup, andromedaGroup, triangulumGroup, cosmicWebGroup;
    let cmbSphere, cmbColorsAttribute, cmbMaterial;
    let celestialSkyboxGroup;
    let asteroidBelt, oortCloudGroup, crabPulsarBeams;
    let sunMeshRef = null;
    
    // Sagittarius A* Accretion Flow & ISCO Flares
    let sagAGroup = null;
    let sagAAccretionDisk = null;
    let sagAPlasmaFlares = [];

    // TON 618 Quasar Disk & Relativistic Flares
    let ton618AccretionDisk = null;
    let ton618PlasmaFlares = [];

    // Binary & Hierarchy Systems
    let siriusBarycenterGroup = null;
    let siriusAMesh = null, siriusBMesh = null;
    let siriusBinaryAngle = 0;
    
    let alphaCentauriGroup = null;
    let alphaCenAMesh = null, alphaCenBMesh = null, proximaMesh = null;
    let alphaCenBinaryAngle = 0;
    let proximaOrbitAngle = 0;

    let halleyOrbitObj = null;
    let oumuamuaOrbitObj = null;

    // Centaurus A Relativistic Jets
    let cenAJetGroup = null;
    let cenAPlasmaKnots = [];

    // Andromeda Galaxy Approach Vector Kinematics
    let andromedaBasePos = new THREE.Vector3(380, 105, -255);
    let andromedaApproachDistance = 0.0;
    let andromedaApproachDir = new THREE.Vector3(-240, -65, 160).normalize();

    let activeTarget = null;
    let activeTargetMesh = null;
    Object.defineProperty(window, "activeTarget", {
      get() { return activeTarget; },
      set(val) { activeTarget = val; },
      configurable: true
    });
    Object.defineProperty(window, "activeTargetMesh", {
      get() { return activeTargetMesh; },
      set(val) { activeTargetMesh = val; },
      configurable: true
    });
    if (typeof lastTrackedTargetPos !== 'undefined') lastTrackedTargetPos.set(0, 0, 0);
    let manualTierLock = 0;
    let isUserDraggingSlider = false;

    let isCosmicWebVisible = true;
    let isOrbitPaused = false;
    let areLabelsVisible = true;
    let isScreensaverActive = false;

    // === MINIMALIST PRIMARY NAME LABELS STATE ===

    const MINOR_CELESTIAL_LABEL_IDS = new Set([
      "moon", "ceres", "oumuamua", "halley-comet", "sedna",
      "toliman", "proxima-centauri", "sirius-b"
    ]);

    let celestialLabelEntries = [];
    let celestialLabelById = new Map();
    let hoveredCelestialMesh = null;
    const _labelWorldPos = new THREE.Vector3();
    const _labelProjVec = new THREE.Vector3();

    const scaleSlider = document.getElementById('scale-slider');
    const odoMetric = document.getElementById('odo-metric');
    const odoDist = document.getElementById('odo-dist');
    const odoTier = document.getElementById('odo-tier');

    if (document.documentElement.classList.contains("is-booting") && localStorage.getItem("hasBootedSession") !== "true") {
      const startDeferred3D = () => {
        if (window._nova3DInitialized) return;
        window._nova3DInitialized = true;
        init();
        fetchCatalog();
      };
      window._ensureNova3DInit = startDeferred3D;
      requestAnimationFrame(() => setTimeout(startDeferred3D, 1200));
    } else {
      window._nova3DInitialized = true;
      init();
      fetchCatalog();
    }

    // =========================================================================
    // 3D OBSIDIAN ATTITUDE TRACKBALL (TWO-WAY CAMERA GIMBAL + CLICK RESET)
    // =========================================================================
    (function initNovaAttitudeSphere() {
      const canvas = document.getElementById("nova-attitude-sphere");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      let isDraggingSphere = false;
      let dragMovedDistance = 0;
      let lastPointerX = 0;
      let lastPointerY = 0;
      let resetPulseAlpha = 0;

      // Project a 3D unit point (x, y, z) rotated by camera inverse orientation onto the 2D canvas
      function renderAttitudeSphere() {
        if (!ctx || typeof camera === "undefined" || typeof controls === "undefined") return;
        const w = canvas.width;
        const h = canvas.height;
        const cx = w * 0.5;
        const cy = h * 0.5;
        const radius = w * 0.44;

        ctx.clearRect(0, 0, w, h);

        // 1. Deep Obsidian Matte Sphere Base with Subtle Specular Top-Left Sheen
        const baseGrad = ctx.createRadialGradient(cx - radius * 0.32, cy - radius * 0.35, radius * 0.08, cx, cy, radius);
        baseGrad.addColorStop(0, "#1e293b");
        baseGrad.addColorStop(0.38, "#090d16");
        baseGrad.addColorStop(0.85, "#030509");
        baseGrad.addColorStop(1, "#0a192f");
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = baseGrad;
        ctx.fill();

        // Compute camera spherical orientation relative to controls.target
        const offset = camera.position.clone().sub(controls.target);
        const dist = Math.max(0.0001, offset.length());
        // Yaw (theta) around Y axis, Pitch (phi) from Y axis
        const yaw = Math.atan2(offset.x, offset.z);
        const pitch = Math.asin(Math.max(-1, Math.min(1, offset.y / dist)));

        const cosY = Math.cos(-yaw), sinY = Math.sin(-yaw);
        const cosP = Math.cos(pitch), sinP = Math.sin(pitch);

        function project3D(vx, vy, vz) {
          // Rotate by -yaw around Y
          const x1 = vx * cosY + vz * sinY;
          const z1 = -vx * sinY + vz * cosY;
          const y1 = vy;
          // Rotate by pitch around X
          const y2 = y1 * cosP - z1 * sinP;
          const z2 = y1 * sinP + z1 * cosP;
          const x2 = x1;
          return {
            sx: cx + x2 * radius,
            sy: cy - y2 * radius,
            z: z2
          };
        }

        // Helper to draw a great/small circle curve on the sphere with front/back depth shading
        function drawSphereCurve(pointGenerator, steps, frontStroke, backStroke, frontWidth, backWidth) {
          for (let pass = 0; pass < 2; pass++) {
            const isFrontPass = (pass === 1);
            ctx.beginPath();
            let penDown = false;
            for (let i = 0; i <= steps; i++) {
              const t = (i / steps) * Math.PI * 2;
              const v = pointGenerator(t);
              const p = project3D(v.x, v.y, v.z);
              const isFront = p.z >= -0.05;
              if (isFront === isFrontPass) {
                if (!penDown) {
                  ctx.moveTo(p.sx, p.sy);
                  penDown = true;
                } else {
                  ctx.lineTo(p.sx, p.sy);
                }
              } else {
                penDown = false;
              }
            }
            ctx.strokeStyle = isFrontPass ? frontStroke : backStroke;
            ctx.lineWidth = isFrontPass ? frontWidth : backWidth;
            ctx.stroke();
          }
        }

        // 2. Longitude Meridians (3 great circles at 0, 60, 120 deg)
        for (let m = 0; m < 3; m++) {
          const mAngle = (m * Math.PI) / 3;
          const cosM = Math.cos(mAngle), sinM = Math.sin(mAngle);
          drawSphereCurve(
            (t) => ({
              x: Math.sin(t) * cosM,
              y: Math.cos(t),
              z: Math.sin(t) * sinM
            }),
            48,
            m === 0 ? "rgba(148, 163, 184, 0.42)" : "rgba(148, 163, 184, 0.24)",
            "rgba(71, 85, 105, 0.12)",
            1.1,
            0.8
          );
        }

        // 3. Sub-Ecliptic Latitude Rings (+45 deg and -45 deg)
        [-0.707, 0.707].forEach((latY) => {
          const rLat = Math.sqrt(1 - latY * latY);
          drawSphereCurve(
            (t) => ({
              x: Math.cos(t) * rLat,
              y: latY,
              z: Math.sin(t) * rLat
            }),
            40,
            "rgba(148, 163, 184, 0.22)",
            "rgba(71, 85, 105, 0.08)",
            0.9,
            0.7
          );
        });

        // 4. Primary Ecliptic Equator Ring (Glowing Bioluminescent Cyan)
        drawSphereCurve(
          (t) => ({
            x: Math.cos(t),
            y: 0,
            z: Math.sin(t)
          }),
          56,
          "rgba(34, 211, 238, 0.92)",
          "rgba(34, 211, 238, 0.22)",
          1.75,
          1.0
        );

        // 5. North / South Celestial Pole Nodes (Zenith = Cyan, Nadir = Slate/Amber)
        const northPole = project3D(0, 1, 0);
        if (northPole.z > 0) {
          ctx.beginPath();
          ctx.arc(northPole.sx, northPole.sy, 2.3, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "#22d3ee";
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        const southPole = project3D(0, -1, 0);
        if (southPole.z > 0) {
          ctx.beginPath();
          ctx.arc(southPole.sx, southPole.sy, 1.9, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(251, 191, 36, 0.85)";
          ctx.fill();
        }

        // 6. Center Attitude Crosshair Reticle (Fixed HUD Reference on Glass Surface)
        ctx.strokeStyle = isDraggingSphere ? "rgba(255, 255, 255, 0.85)" : "rgba(255, 255, 255, 0.35)";
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
        ctx.stroke();

        // 7. Outer Fresnel Rim Highlight (Obsidian Glass Edge + Reset Pulse)
        ctx.beginPath();
        ctx.arc(cx, cy, radius - 0.6, 0, Math.PI * 2);
        if (resetPulseAlpha > 0.01) {
          ctx.strokeStyle = `rgba(34, 211, 238, ${Math.min(1, 0.45 + resetPulseAlpha).toFixed(3)})`;
          ctx.lineWidth = 2.0;
          resetPulseAlpha *= 0.90;
        } else {
          ctx.strokeStyle = isDraggingSphere ? "rgba(34, 211, 238, 0.85)" : "rgba(226, 232, 240, 0.28)";
          ctx.lineWidth = 1.25;
        }
        ctx.stroke();
      }

      window.updateNovaAttitudeSphere = renderAttitudeSphere;

      // Pointer drag -> Rotate 3D camera around controls.target
      canvas.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        isDraggingSphere = true;
        dragMovedDistance = 0;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        if (canvas.setPointerCapture) {
          try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        }
        if (typeof TWEEN !== "undefined") TWEEN.removeAll();
      });

      window.addEventListener("pointermove", (e) => {
        if (!isDraggingSphere) return;
        const dx = e.clientX - lastPointerX;
        const dy = e.clientY - lastPointerY;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        dragMovedDistance += Math.hypot(dx, dy);

        if (typeof camera !== "undefined" && typeof controls !== "undefined") {
          const offset = camera.position.clone().sub(controls.target);
          const spherical = new THREE.Spherical().setFromVector3(offset);
          const rotateSpeed = 0.016;
          spherical.theta -= dx * rotateSpeed;
          spherical.phi = Math.max(0.08, Math.min(Math.PI - 0.08, spherical.phi - dy * rotateSpeed));
          offset.setFromSpherical(spherical);
          camera.position.copy(controls.target).add(offset);
          camera.lookAt(controls.target);
          controls.update(); window._novaCamRef = camera; window._novaCtrlRef = controls; if (typeof scene !== 'undefined') window._novaSceneRef = scene;
          renderAttitudeSphere();
        }
      });

      function endSphereDrag(e) {
        if (!isDraggingSphere) return;
        isDraggingSphere = false;
        if (e && canvas.releasePointerCapture) {
          try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
        }
        // If clicked without dragging (< 4px movement), trigger smooth Sol / Attitude Reset!
        if (dragMovedDistance < 4.0) {
          resetPulseAlpha = 1.0;
          if (typeof window.resetToSolCore === "function") {
            window.resetToSolCore();
          }
        }
      }

      window.addEventListener("pointerup", endSphereDrag);
      window.addEventListener("pointercancel", endSphereDrag);
    })();


    function init() {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);

      camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.005, 95000);
      camera.position.set(0, 22.5, 32);

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
        logarithmicDepthBuffer: true
      });
      renderer.setClearColor(0x000000, 1.0);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      document.body.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.maxDistance = 42000;
      controls.minDistance = 0.08;
      controls.zoomSpeed = -1.15;
      window.camera = camera;
      window.controls = controls;

      raycaster = new THREE.Raycaster();
      mouse = new THREE.Vector2();

      const _buildSteps = [
        () => buildUniformCelestialSkybox(),
        () => { ({ cosmicWebGroup, filamentFlowParticles } = buildNASAHubbleCosmicWeb(scene, createRoundParticleTexture, isCosmicWebVisible)); },
        () => { ({ cmbSphere, cmbMaterial, cmbColorsAttribute } = buildDelicateAuroraCMB(scene)); },
        () => buildAsteroidBelt(),
        () => { oortCloudGroup = buildVolumetricOortCloud(scene, createRoundParticleTexture); }
      ];
      if (document.documentElement.classList.contains("is-booting") && localStorage.getItem("hasBootedSession") !== "true") {
        let _idx = 0;
        // Hold all 5 heavy background builders off the boot screen for locked 60fps cursor
        window._flushNova3DBuilders = () => {
          while (_idx < _buildSteps.length) _buildSteps[_idx++]();
        };
      } else {
        _buildSteps.forEach((fn) => fn());
      }

      scaleSlider.addEventListener('pointerdown', () => { isUserDraggingSlider = true; });
      window.addEventListener('pointerup', () => { isUserDraggingSlider = false; });
      scaleSlider.addEventListener('input', (e) => onScaleSliderInput(e.target.value));

      window.addEventListener('resize', onWindowResize);
      window.addEventListener('pointermove', onPointerMove);
      let _novaDownX = 0, _novaDownY = 0, _novaDownTime = 0;
      window.addEventListener('pointerdown', (e) => {
        _novaDownX = e.clientX;
        _novaDownY = e.clientY;
        _novaDownTime = performance.now();
      });
      window.addEventListener('pointerup', (e) => {
        const dist = Math.hypot(e.clientX - _novaDownX, e.clientY - _novaDownY);
        const dt = performance.now() - _novaDownTime;
        // Only trigger object select / fly-to on a genuine click, never on a drag-to-orbit
        if (dist < 6 && dt < 450) {
          onPointerDown(e);
        }
      });

      animate(0);
    }

    function createRoundParticleTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.75)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
      return new THREE.CanvasTexture(canvas);
    }

    function buildUniformCelestialSkybox() {
      celestialSkyboxGroup = new THREE.Group();

      const starCount = 20000;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(starCount * 3);
      const col = new Float32Array(starCount * 3);

      for (let i = 0; i < starCount * 3; i += 3) {
        const radius = 38000.0;
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);

        pos[i] = radius * Math.sin(phi) * Math.cos(theta);
        pos[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
        pos[i + 2] = radius * Math.cos(phi);

        const tint = Math.random();
        if (tint > 0.82) {
          col[i] = 0.65; col[i+1] = 0.85; col[i+2] = 1.0;
        } else if (tint < 0.20) {
          col[i] = 1.0; col[i+1] = 0.82; col[i+2] = 0.60;
        } else {
          col[i] = 0.92; col[i+1] = 0.94; col[i+2] = 0.98;
        }
      }

      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

      const mat = new THREE.PointsMaterial({
        size: 1.1,
        sizeAttenuation: false,
        map: createRoundParticleTexture(),
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        depthWrite: false
      });

      const pts = new THREE.Points(geo, mat);
      pts.raycast = () => {};
      celestialSkyboxGroup.add(pts);
      scene.add(celestialSkyboxGroup);
    }

    let resetAnimTimeout = null;
    window.resetToSolCore = function() {
      const fromId = window._novaLastTargetId || ((activeTarget && activeTarget.id) ? String(activeTarget.id).toLowerCase() : "sun");
      const jump = (typeof computeNasaJumpDistance === "function")
        ? computeNasaJumpDistance(fromId, "sun")
        : { value: 0, unit: "AU" };
      const durationMs = (typeof computeTravelDurationMs === "function")
        ? computeTravelDurationMs(jump)
        : 1500;

      window._novaLastTargetId = "sun";
      window._novaTravelState = {
        active: jump.value > 0,
        current: 0,
        total: jump.value,
        unit: jump.unit
      };

      const resetBtn = document.getElementById("btn-reset-sol");
      if (resetBtn) {
        resetBtn.classList.remove("reset-animating");
        void resetBtn.offsetWidth;
        resetBtn.classList.add("reset-animating");
        if (resetAnimTimeout) clearTimeout(resetAnimTimeout);
        resetAnimTimeout = setTimeout(() => {
          resetBtn.classList.remove("reset-animating");
        }, durationMs + 50);
      }

      filterTier(0);
      setTimeout(applyCharacteristicTexturesToScene, 200);
      setTimeout(applyCharacteristicTexturesToScene, 1000);
      if (sunMeshRef) {
        activeTargetMesh = sunMeshRef;
        activeTarget = sunMeshRef.userData;
      }

      TWEEN.removeAll();
      const startCam = camera.position.clone();
      const endCam = new THREE.Vector3(0, 9.0, 13.0);
      const startTarget = controls.target.clone();
      const endTarget = new THREE.Vector3(0, 0, 0);
      const tweenObj = { t: 0 };

      if (window.novaState) window.novaState.setTravelPhase("traveling");
      new TWEEN.Tween(tweenObj)
        .to({ t: 1 }, durationMs)
        .easing(TWEEN.Easing.Cubic.InOut)
        .onUpdate(() => {
          camera.position.lerpVectors(startCam, endCam, tweenObj.t);
          controls.target.lerpVectors(startTarget, endTarget, tweenObj.t);
          if (window._novaTravelState) {
            window._novaTravelState.current = window._novaTravelState.total * tweenObj.t;
            window._novaTravelState.active = tweenObj.t < 0.995;
          }
          if (typeof updateScaleSliderFromCamera === "function") {
            updateScaleSliderFromCamera();
          }
        })
        .onComplete(() => {
          if (window._novaTravelState) {
            window._novaTravelState.current = window._novaTravelState.total;
            window._novaTravelState.active = false;
          }
          if (typeof controls !== "undefined" && controls) controls.enabled = true;
          if (window.novaState) window.novaState.setTravelPhase("arrived");
        })
        .start();
    };

    const UNIFIED_TOGGLE_ACTIVE_CLASS = "relative w-[25px] h-[25px] rounded-full flex items-center justify-center transition-transform duration-300 transform hover:scale-110 shrink-0 cursor-pointer p-0 bg-transparent border-0 shadow-none outline-none";
    const UNIFIED_TOGGLE_INACTIVE_CLASS = "relative w-[25px] h-[25px] rounded-full flex items-center justify-center transition-transform duration-300 transform hover:scale-110 shrink-0 cursor-pointer p-0 bg-transparent border-0 shadow-none outline-none";

    window.toggleCosmicWeb = function() {
      isCosmicWebVisible = !isCosmicWebVisible;
      const btn = document.getElementById("btn-cosmic-web");
      const svg = document.getElementById("cosmic-web-svg");
      const pulse = document.getElementById("web-electric-pulse");

      if (isCosmicWebVisible) {
        if (btn) btn.className = "relative w-8 h-8 rounded-full bg-cyan-950/65 border border-cyan-300/90 hover:border-white flex items-center justify-center text-white transition duration-300 transform hover:scale-110 shrink-0 cursor-pointer shadow-[0_0_12px_rgba(34,211,238,0.5),3px_-3px_10px_rgba(244,114,182,0.45),-3px_3px_10px_rgba(232,121,249,0.35),inset_0_0_8px_rgba(240,171,252,0.28)]";
        if (svg) svg.className.baseVal = "w-5 h-5 text-white transition-all duration-300 overflow-visible";
        if (pulse) pulse.classList.remove("hidden");
      } else {
        if (btn) btn.className = UNIFIED_TOGGLE_INACTIVE_CLASS;
        if (svg) svg.className.baseVal = "w-5 h-5 text-slate-400 transition-all duration-300 overflow-visible opacity-70";
        if (pulse) pulse.classList.add("hidden");
      }

      if (cosmicWebGroup) {
        cosmicWebGroup.visible = isCosmicWebVisible;
        if (isCosmicWebVisible) {
          const camDist = camera.position.distanceTo(controls.target);
          const webOpacityFactor = Math.max(0.2, 1.0 - Math.min(1.0, (camDist - 600) / 4500));
          cosmicWebGroup.traverse(child => {
            if (child.material) {
              child.material.transparent = true;
              if (child === cosmicWebGroup && child.userData.baseOpacity) {
                child.material.opacity = child.userData.baseOpacity * webOpacityFactor;
              } else if (!child.userData.baseOpacity) {
                child.userData.baseOpacity = child.material.opacity || 0.6;
                child.material.opacity = child.userData.baseOpacity * webOpacityFactor;
              }
            }
          });
        }
      }
    };

    window.toggleOrbitPause = function() {
      isOrbitPaused = !isOrbitPaused;
      const btn = document.getElementById("btn-orbits");
      const svg = document.getElementById("orbit-spinner-svg");
      const dot = document.getElementById("orbit-core-dot");
      if (btn && svg && dot) {
        if (!isOrbitPaused) {
          btn.className = UNIFIED_TOGGLE_ACTIVE_CLASS;
          svg.classList.remove("orbit-paused", "text-cyan-300/50", "text-amber-400/70", "text-slate-400");
          svg.classList.add("text-cyan-300");
          dot.className = "absolute w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#22d3ee] transition-all duration-300";
        } else {
          btn.className = UNIFIED_TOGGLE_INACTIVE_CLASS;
          svg.classList.remove("text-cyan-300", "text-amber-400/70");
          svg.classList.add("orbit-paused", "text-slate-400");
          dot.className = "absolute w-1.5 h-1.5 rounded-full bg-slate-400 transition-all duration-300";
        }
      }
    };
    window.toggleOrbits = window.toggleOrbitPause;

    let isZenMode = false;
    let isSidebarUserHidden = true;
    let isOverviewToggleActive = false;

    window.toggleLabels = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      areLabelsVisible = !areLabelsVisible;
      const layer = document.getElementById("celestial-labels-layer");
      const btn = document.getElementById("btn-toggle-labels");
      if (layer) {
        layer.style.display = areLabelsVisible ? "block" : "none";
      }
      const callout = document.getElementById("labels-exterior-callout");
      const iconSvg = document.getElementById("labels-toggle-icon");
      if (btn) {
        if (areLabelsVisible) {
          btn.title = "Toggle Celestial Name Labels On / Off";
          btn.className = "relative w-8 h-8 rounded-full bg-cyan-950/65 border border-cyan-300/90 hover:border-white flex items-center justify-center text-cyan-200 hover:text-white transition duration-300 transform hover:scale-110 shrink-0 cursor-pointer shadow-[0_0_14px_rgba(34,211,238,0.55),inset_0_0_8px_rgba(34,211,238,0.3)] overflow-visible";
          if (iconSvg) iconSvg.className.baseVal = "w-full h-full overflow-visible text-cyan-300 drop-shadow-[0_0_5px_rgba(34,211,238,0.85)]";
          if (callout) callout.style.opacity = "1";
        } else {
          btn.title = "Show Celestial Name Labels";
          btn.className = UNIFIED_TOGGLE_INACTIVE_CLASS + " overflow-visible";
          if (iconSvg) iconSvg.className.baseVal = "w-full h-full overflow-visible text-slate-400";
          if (callout) callout.style.opacity = "0.35";
        }
      }
    };

    let isPlanetOverviewEnabled = true;
    Object.defineProperty(window, "isPlanetOverviewEnabled", {
      get() { return isPlanetOverviewEnabled; },
      set(val) { isPlanetOverviewEnabled = Boolean(val); },
      configurable: true
    });
    let mapKeyHoverTimer = null;

    window.openMapKey = function() {
      if (mapKeyHoverTimer) {
        clearTimeout(mapKeyHoverTimer);
        mapKeyHoverTimer = null;
      }
      const drawer = document.getElementById("map-key-drawer");
      const summonBtn = document.getElementById("map-key-summon-btn");
      if (!drawer) return;
      drawer.classList.remove("translate-x-[300px]");
      if (summonBtn) summonBtn.classList.add("translate-x-20", "opacity-0", "pointer-events-none");
    };

    window.closeMapKey = function() {
      if (mapKeyHoverTimer) {
        clearTimeout(mapKeyHoverTimer);
        mapKeyHoverTimer = null;
      }
      const drawer = document.getElementById("map-key-drawer");
      const summonBtn = document.getElementById("map-key-summon-btn");
      if (!drawer) return;
      drawer.classList.add("translate-x-[300px]");
      if (summonBtn) summonBtn.classList.remove("translate-x-20", "opacity-0", "pointer-events-none");
    };

    window.scheduleCloseMapKey = function(delayMs = 400) {
      if (mapKeyHoverTimer) clearTimeout(mapKeyHoverTimer);
      mapKeyHoverTimer = setTimeout(() => {
        window.closeMapKey();
      }, delayMs);
    };

    window.toggleMapKey = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      const drawer = document.getElementById("map-key-drawer");
      if (!drawer) return;
      const isHidden = drawer.classList.contains("translate-x-[300px]");
      if (isHidden) {
        window.openMapKey();
      } else {
        window.closeMapKey();
      }
    };

    window.togglePlanetOverview = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      isPlanetOverviewEnabled = !isPlanetOverviewEnabled;
      if (!isPlanetOverviewEnabled) {
        window.dismissSpatialCallout();
      } else if (activeTargetMesh && activeTarget) {
        window._spatialCalloutDismissedForMesh = null;
        if (typeof window.populateSpatialCallout === 'function') {
          window.populateSpatialCallout(activeTarget);
        }
      }
      updateSidebarToggleStyle();
      const _infoBtnEl = document.getElementById("btn-toggle-sidebar");
      if (_infoBtnEl) _infoBtnEl.setAttribute("data-nova-active", isPlanetOverviewEnabled ? "true" : "false");
    };

    window.switchInspectorTab = function(tabName) {
      const tabs = ["overview", "telemetry", "ask"];
      tabs.forEach(t => {
        const panel = document.getElementById(`inspector-tab-${t}`);
        const btn = document.getElementById(`tab-btn-${t}`);
        if (panel) {
          if (t === tabName) panel.classList.remove("hidden");
          else panel.classList.add("hidden");
        }
        if (btn) {
          if (t === tabName) {
            btn.className = "py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 font-semibold transition cursor-pointer";
          } else {
            btn.className = "py-1.5 rounded-lg text-slate-400 hover:text-slate-200 border border-transparent transition cursor-pointer";
          }
        }
      });
    };

    function updateSidebarToggleStyle() {
      const isVisible = isPlanetOverviewEnabled;
      isOverviewToggleActive = isVisible;

      const sbArcTop = document.getElementById("sb-arc-top");
      const sbArcBot = document.getElementById("sb-arc-bot");
      const sbClipRect = document.getElementById("sb-bg-clip-rect");
      const sbInnerBar = document.getElementById("sb-inner-bar");
      const sidebarBtn = document.getElementById("btn-toggle-sidebar");

      if (sidebarBtn) {
        sidebarBtn.setAttribute(
          "aria-label",
          isVisible ? "Disable Planet Overview Panels (Shortcut: I)" : "Enable Planet Overview Panels (Shortcut: I)"
        );
        sidebarBtn.setAttribute(
          "title",
          isVisible ? "Disable Planet Overview Panels (Shortcut: I)" : "Enable Planet Overview Panels (Shortcut: I)"
        );
        sidebarBtn.className = "relative w-8 h-8 rounded-full flex items-center justify-center transition duration-300 transform hover:scale-110 shrink-0 cursor-pointer p-0 bg-transparent border-0 " + (isVisible ? "shadow-[0_0_12px_rgba(34,211,238,0.35)]" : "shadow-[0_0_8px_rgba(34,211,238,0.15)]");
      }
      if (sbArcTop && sbArcBot && sbClipRect && sbInnerBar) {
        if (isVisible) {
          // TabToggleOn.png state: cyan arcs slide left from both top & bottom to form left half-circle (12 o'clock to 6 o'clock via 9 o'clock)
          sbArcTop.setAttribute("stroke-dasharray", "50 100");
          sbArcTop.setAttribute("stroke-dashoffset", "-50");
          sbArcBot.setAttribute("stroke-dasharray", "50 100");
          sbArcBot.setAttribute("stroke-dashoffset", "-50");
          sbClipRect.setAttribute("width", "16");
          sbInnerBar.style.opacity = "1";
          sbInnerBar.style.transform = "translateX(0px) scaleY(1)";
        } else {
          // TabToggleOff.png state: cyan arcs slide back to right edge
          sbArcTop.setAttribute("stroke-dasharray", "22 100");
          sbArcTop.setAttribute("stroke-dashoffset", "0");
          sbArcBot.setAttribute("stroke-dasharray", "22 100");
          sbArcBot.setAttribute("stroke-dashoffset", "0");
          sbClipRect.setAttribute("width", "0");
          sbInnerBar.style.opacity = "0";
          sbInnerBar.style.transform = "translateX(6px) scaleY(0.75)";
        }
      }
    }

    // Aliases to route sidebar calls to the master overview toggle
    window.toggleSidebarDrawerTab = window.togglePlanetOverview;
    window.toggleSidebarVisibility = window.togglePlanetOverview;

    function applyZenUI(zen, keepSidebarForTour = false) {
      isZenMode = zen;
      const headerEl = document.querySelector("header");
      const odoGroup = document.getElementById("odometer-group");
      const inspector = document.getElementById("inspector");
      const bottomHud = document.getElementById("bottom-hud");
      const outerRing = document.getElementById("fullscreen-outer-ring");
      const bgClipRect = document.getElementById("fullscreen-bg-clip-rect");
      const innerDot = document.getElementById("fullscreen-inner-dot");
      const fsBtn = document.getElementById("btn-fullscreen-zen");

      if (zen) {
        if (headerEl) headerEl.classList.add("hidden");
        if (odoGroup) odoGroup.classList.add("hidden");
        if (inspector && !keepSidebarForTour && !isTourActive) {
          inspector.classList.add("translate-x-[430px]");
        }
        if (bottomHud) {
          bottomHud.classList.remove("left-4", "right-4", "justify-between", "space-x-4", "space-x-6");
          bottomHud.classList.add("left-1/2", "-translate-x-1/2", "w-auto");
        }
        if (outerRing) {
          outerRing.setAttribute("stroke-dasharray", "100 100");
          outerRing.setAttribute("stroke-dashoffset", "0");
        }
        if (bgClipRect) {
          bgClipRect.setAttribute("height", "32");
        }
        if (innerDot) {
          innerDot.setAttribute("fill", "#1cb5d8");
        }
        if (fsBtn) {
          fsBtn.title = "Return to Standard Mode";
          fsBtn.className = "relative w-8 h-8 rounded-full flex items-center justify-center transition duration-300 transform hover:scale-110 shrink-0 cursor-pointer p-0 bg-transparent border-0 shadow-[0_0_12px_rgba(34,211,238,0.28)]";
        }
      } else {
        if (headerEl) headerEl.classList.remove("hidden");
        if (odoGroup) odoGroup.classList.remove("hidden");
        if (bottomHud) {
          bottomHud.classList.add("left-1/2", "-translate-x-1/2");
          bottomHud.classList.remove("left-4", "right-4", "justify-between", "space-x-4", "space-x-6");
        }
        if (outerRing) {
          outerRing.setAttribute("stroke-dasharray", "50 100");
          outerRing.setAttribute("stroke-dashoffset", "-25");
        }
        if (bgClipRect) {
          bgClipRect.setAttribute("height", "16");
        }
        if (innerDot) {
          innerDot.setAttribute("fill", "#293548");
        }
        if (fsBtn) {
          fsBtn.title = "Enter Fullscreen Mode";
          fsBtn.className = "relative w-8 h-8 rounded-full flex items-center justify-center transition duration-300 transform hover:scale-110 shrink-0 cursor-pointer p-0 bg-transparent border-0";
        }
      }
      updateSidebarToggleStyle();
    }

    window.toggleFullscreenZen = function() {
      const nextZen = !isZenMode;
      applyZenUI(nextZen);
      if (nextZen && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (!nextZen && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };

    document.addEventListener("fullscreenchange", () => {
      applyZenUI(!!document.fullscreenElement);
    });

    function createProceduralTexture(type) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      if (type === 'sun') {
        const grad = ctx.createLinearGradient(0, 0, 512, 256);
        grad.addColorStop(0, '#f59e0b');
        grad.addColorStop(0.5, '#fbbf24');
        grad.addColorStop(1, '#ea580c');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 256);
        for (let i = 0; i < 400; i++) {
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(254, 240, 138, 0.3)' : 'rgba(217, 119, 6, 0.25)';
          ctx.beginPath();
          ctx.arc(Math.random() * 512, Math.random() * 256, Math.random() * 12, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (type === 'stephenson') {
        const grad = ctx.createRadialGradient(256, 128, 10, 256, 128, 256);
        grad.addColorStop(0, '#f87171');
        grad.addColorStop(0.4, '#dc2626');
        grad.addColorStop(0.8, '#991b1b');
        grad.addColorStop(1, '#450a0a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 256);
        for (let i = 0; i < 600; i++) {
          ctx.fillStyle = Math.random() > 0.6 ? 'rgba(254, 202, 202, 0.25)' : 'rgba(127, 29, 29, 0.35)';
          ctx.beginPath();
          ctx.arc(Math.random() * 512, Math.random() * 256, Math.random() * 16, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (type === 'sombrero') {
        const grad = ctx.createRadialGradient(256, 128, 5, 256, 128, 220);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.25, '#fef08a');
        grad.addColorStop(0.65, '#e2e8f0');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 256);
      } else if (type === 'earth') {
        ctx.fillStyle = '#0369a1';
        ctx.fillRect(0, 0, 512, 256);
        ctx.fillStyle = '#15803d';
        for (let i = 0; i < 28; i++) {
          ctx.beginPath();
          ctx.ellipse(Math.random() * 512, Math.random() * 256, 30 + Math.random() * 50, 15 + Math.random() * 30, Math.random(), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        for (let j = 0; j < 35; j++) {
          ctx.beginPath();
          ctx.arc(Math.random() * 512, Math.random() * 256, 12 + Math.random() * 25, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (type === 'jupiter') {
        for (let y = 0; y < 256; y += 8) {
          const bandColor = (y % 16 === 0) ? '#c2410c' : (y % 24 === 0) ? '#fef08a' : '#d97706';
          ctx.fillStyle = bandColor;
          ctx.fillRect(0, y, 512, 8);
        }
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.ellipse(320, 165, 32, 18, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 'mars') {
        ctx.fillStyle = '#b45309';
        ctx.fillRect(0, 0, 512, 256);
        ctx.fillStyle = '#78350f';
        for (let i = 0; i < 30; i++) {
          ctx.beginPath();
          ctx.arc(Math.random() * 512, Math.random() * 256, 15 + Math.random() * 30, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, 512, 18);
        ctx.fillRect(0, 238, 512, 18);
      } else if (type === 'uranus') {
        // True-color pale icy-cyan with subtle polar hood (preserving original banding)
        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, '#d8ecee');
        grad.addColorStop(0.3, '#b4dce3');
        grad.addColorStop(0.7, '#99ccd8');
        grad.addColorStop(1, '#cce5ea');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 256);
        for (let y = 60; y < 200; y += 18) {
          ctx.fillRect(0, y, 512, 3);
        }
      } else if (type === 'neptune') {
        // True-color muted azure/periwinkle (1989 Voyager 2 Great Dark Spot removed; methane cirrus streaks preserved)
        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, '#5b7db8');
        grad.addColorStop(0.5, '#7698d4');
        grad.addColorStop(1, '#5878b2');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 256);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        for (let i = 0; i < 18; i++) {
          const cx = Math.random() * 450;
          const cy = 100 + Math.random() * 110;
          ctx.fillRect(cx, cy, 35 + Math.random() * 45, 2);
        }
      }

      return new THREE.CanvasTexture(canvas);
    }

    function makeFractalNodeSprite(colorHex, sizeMultiplier = 3.5) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 128, 128);

      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, colorHex);
      gradient.addColorStop(0.35, colorHex);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);

      const texture = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        opacity: 0.85
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(sizeMultiplier, sizeMultiplier, 1.0);
      sprite.raycast = () => {};
      return sprite;
    }

    function buildAsteroidBelt() {
      asteroidBelt = new THREE.Group();
      const dpr = Math.min(2.2, window.devicePixelRatio || 1.0);

      // Creates a crisp, visible, neutral-toned floating asteroid/Kuiper belt with organic spacing
      function addVolumetricBeltLayer(parentGroup, grainCount, boulderCount, innerR, outerR, thickY, shadowHex, litHex, highlightHex, baseOpacity, boulderScale) {
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array(grainCount * 3);
        const aVisual = new Float32Array(grainCount * 4); // pointSize, brightness, shapeSeed, featherAlpha

        const spanR = outerR - innerR;

        for (let i = 0; i < grainCount; i++) {
          const i3 = i * 3;
          const i4 = i * 4;

          // Smooth bell-curve radial spread with subtle Kirkwood gaps and feathered stragglers
          let u = (Math.random() + Math.random()) * 0.5;
          if (Math.abs(u - 0.36) < 0.03 || Math.abs(u - 0.68) < 0.03) {
            u += (Math.random() - 0.5) * 0.16;
          }

          const radius = innerR + u * spanR + (Math.random() - 0.5) * (spanR * 0.14);
          const angle = Math.random() * Math.PI * 2.0;

          // 3D vertical floating thickness (core ecliptic layer + inclined floating halo)
          const isHalo = Math.random() < 0.25;
          const vSpread = isHalo ? thickY * 2.1 : thickY;
          const y = (Math.random() - 0.5) * 2.0 * vSpread * (0.35 + 0.65 * Math.random());

          positions[i3]     = Math.cos(angle) * radius;
          positions[i3 + 1] = y;
          positions[i3 + 2] = Math.sin(angle) * radius;

          // Visible multi-scale rock sizes: fine pebbles (2.2px) up to distinct craggy fragments (8.5px)
          const sizeRoll = Math.pow(Math.random(), 2.8);
          aVisual[i4]     = (2.1 + sizeRoll * 6.4) * dpr;
          aVisual[i4 + 1] = 0.78 + Math.random() * 0.45; // High albedo so neutral grey pops against black space!
          aVisual[i4 + 2] = Math.random() * 6.283185;

          // Keep center 80% strong (0.65 - 1.0) and gently feather only the outer 20% fringes
          const edgeDist = Math.min(u, 1.0 - u) * 2.0;
          const feather = Math.min(1.0, 0.38 + edgeDist * 0.95);
          const perRockAlpha = 0.55 + Math.random() * 0.45;
          aVisual[i4 + 3] = feather * perRockAlpha * (isHalo ? 0.72 : 1.0);
        }

        geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geom.setAttribute("aVisual", new THREE.BufferAttribute(aVisual, 4));

        const grainMat = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          depthTest: true,
          uniforms: {
            uShadowColor: { value: new THREE.Color(shadowHex) },
            uLitColor: { value: new THREE.Color(litHex) },
            uHighlightColor: { value: new THREE.Color(highlightHex) },
            uBaseOpacity: { value: baseOpacity }
          },
          vertexShader: [
            "attribute vec4 aVisual;",
            "varying vec3 vWorldPos;",
            "varying float vBrightness;",
            "varying float vSeed;",
            "varying float vFeather;",
            "void main() {",
            "  vec4 wp = modelMatrix * vec4(position, 1.0);",
            "  vWorldPos = wp.xyz;",
            "  vBrightness = aVisual.y;",
            "  vSeed = aVisual.z;",
            "  vFeather = aVisual.w;",
            "  vec4 mvPos = viewMatrix * wp;",
            "  gl_Position = projectionMatrix * mvPos;",
            "  float dist = max(2.0, -mvPos.z);",
            "  gl_PointSize = clamp(aVisual.x * (46.0 / pow(dist, 0.78)), 1.65, 9.5);",
            "}"
          ].join("\n"),
          fragmentShader: [
            "uniform vec3 uShadowColor;",
            "uniform vec3 uLitColor;",
            "uniform vec3 uHighlightColor;",
            "uniform float uBaseOpacity;",
            "varying vec3 vWorldPos;",
            "varying float vBrightness;",
            "varying float vSeed;",
            "varying float vFeather;",
            "void main() {",
            "  vec2 uv = gl_PointCoord * 2.0 - 1.0;",
            "  float c = cos(vSeed);",
            "  float s = sin(vSeed);",
            "  vec2 ruv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);",
            "  float ang = atan(ruv.y, ruv.x);",
            "  // Irregular faceted asteroid silhouette",
            "  float rockBoundary = 0.80 + 0.14 * cos(ang * 3.0 + vSeed) + 0.08 * sin(ang * 5.0 - vSeed * 2.0);",
            "  float rad = length(ruv) / max(0.38, rockBoundary);",
            "  if (rad > 1.0) discard;",
            "  vec3 sunDir = normalize(-vWorldPos);",
            "  vec2 sunScreen = normalize(vec2(sunDir.x + sunDir.z * 0.4, sunDir.y + 0.25));",
            "  float diff = clamp(0.48 + 0.68 * dot(-ruv, sunScreen), 0.22, 1.25);",
            "  float specRim = pow(clamp(1.0 - rad * 0.6, 0.0, 1.0), 1.8) * max(0.0, dot(-ruv, sunScreen));",
            "  float camDist = length(cameraPosition - vWorldPos);",
            "  float sunCamDist = length(cameraPosition);",
            "  // Keep far-side rocks legible (min 0.48) while foreground rocks pop at 1.15",
            "  float depthFade = clamp(1.25 - (camDist / max(12.0, sunCamDist * 1.75)) * 0.45, 0.48, 1.15);",
            "  float macroFade = 1.0 - smoothstep(280.0, 560.0, camDist);",
            "  // Subtle in standard overview (camDist ~25-45), full crispness when zoomed near Ceres/belt (camDist < 14)",
            "  float closeupBoost = mix(1.85, 1.0, smoothstep(7.0, 24.0, camDist));",
            "  vec3 col = mix(uShadowColor, uLitColor, clamp(diff * 0.85, 0.0, 1.0)) + uHighlightColor * specRim * 0.55;",
            "  col *= vBrightness * depthFade;",
            "  float edgeSoft = smoothstep(1.0, 0.52, rad);",
            "  float alpha = clamp(uBaseOpacity * closeupBoost * vFeather * depthFade * edgeSoft * macroFade, 0.0, 0.95);",
            "  if (alpha <= 0.004) discard;",
            "  gl_FragColor = vec4(col, alpha);",
            "}"
          ].join("\n")
        });

        const pts = new THREE.Points(geom, grainMat);
        pts.raycast = () => {};
        parentGroup.add(pts);

        // 2. Floating 3D Faceted Chondrite Boulders (InstancedMesh with neutral mineral sheen)
        const rockGeo = new THREE.IcosahedronGeometry(1.0, 1);
        const rockMat = new THREE.MeshStandardMaterial({
          color: highlightHex,
          emissive: litHex,
          emissiveIntensity: 0.28,
          roughness: 0.78,
          metalness: 0.15,
          flatShading: true,
          transparent: true,
          opacity: Math.min(0.82, baseOpacity * 0.95)
        });
        const instRocks = new THREE.InstancedMesh(rockGeo, rockMat, boulderCount);
        instRocks.raycast = () => {};
        const dummy = new THREE.Object3D();
        for (let b = 0; b < boulderCount; b++) {
          const u = (Math.random() + Math.random()) * 0.5;
          const r = innerR + u * spanR + (Math.random() - 0.5) * (spanR * 0.14);
          const a = Math.random() * Math.PI * 2.0;
          const y = (Math.random() - 0.5) * 2.1 * thickY;
          dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
          dummy.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
          const s = boulderScale * (0.45 + Math.pow(Math.random(), 2.2) * 1.25);
          dummy.scale.set(
            s * (0.65 + Math.random() * 0.70),
            s * (0.48 + Math.random() * 0.60),
            s * (0.65 + Math.random() * 0.70)
          );
          dummy.updateMatrix();
          instRocks.setMatrixAt(b, dummy.matrix);
        }
        instRocks.instanceMatrix.needsUpdate = true;
        parentGroup.add(instRocks);
      }

      // Layer A: MAIN ASTEROID BELT (Subtle dust veil behind 3D GPU rocks)
      addVolumetricBeltLayer(
        asteroidBelt,
        900,           // Sparse background dust grains
        24,            // Minimal legacy boulders
        24.8, 33.2,    // Scaled 1.45x span between Mars (22.6) & Jupiter (37.0), centered on Ceres (28.4)
        4.20,          // Volumetric 3D vertical scatter enveloping Ceres's 10.59 deg inclination
        0x1e293b,      // Deep charcoal shadow
        0x64748b,      // Muted slate body
        0x94a3b8,      // Subtle sunlit edge
        0.11,          // Very subtle base opacity
        0.042
      );

      // Layer B: OUTER KUIPER BELT (Sparse outer dust veil)
      addVolumetricBeltLayer(
        asteroidBelt,
        1100,          // Sparse outer planetesimal dust
        24,            // Minimal legacy boulders
        71.0, 94.0,    // Scaled 1.45x scattered zone beyond Neptune (68.2)
        4.50,          // High vertical inclination scatter
        0x1e293b,      // Deep charcoal shadow
        0x475569,      // Muted cool slate
        0x94a3b8,      // Soft silver rim
        0.16,          // Subtle legibility without visual clutter
        0.062
      );

      // === NOVA UPGRADE: 12,000-ROCK SINGLE-DRAW-CALL GPU INSTANCED ASTEROID FIELD ===
      (function addGPUInstancedAsteroids() {
        const TOTAL_ROCKS = 4200;
        const MAIN_COUNT = 2600;

        // Craggy low-poly 3D rock geometry (12 faces, perturbed vertices)
        const rockGeo = new THREE.DodecahedronGeometry(1.0, 0);
        const posAttr = rockGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const vx = posAttr.getX(i), vy = posAttr.getY(i), vz = posAttr.getZ(i);
          const hash = Math.sin(vx * 12.9898 + vy * 78.233 + vz * 37.719) * 43758.5453;
          const jitter = 0.72 + (hash - Math.floor(hash)) * 0.56;
          posAttr.setXYZ(i, vx * jitter, vy * jitter * 0.82, vz * jitter);
        }
        rockGeo.computeVertexNormals();

        // Per-instance orbital & tumble attributes (computed 100% on GPU)
        const aOrbit  = new Float32Array(TOTAL_ROCKS * 4); // radius, startAngle, yOffset, angularSpeed
        const aTumble = new Float32Array(TOTAL_ROCKS * 4); // scale, tumbleX, tumbleY, albedo

        for (let i = 0; i < TOTAL_ROCKS; i++) {
          const isMain = i < MAIN_COUNT;
          const innerR = isMain ? 24.5 : 70.5;
          const outerR = isMain ? 33.6 : 95.0;
          const thickY = isMain ? 4.40 : 4.80;
          const baseScale = isMain ? 0.026 : 0.044;

          let u = (Math.random() + Math.random()) * 0.5;
          if (isMain && (Math.abs(u - 0.36) < 0.03 || Math.abs(u - 0.68) < 0.03)) {
            u += (Math.random() - 0.5) * 0.14;
          }
          const r = innerR + u * (outerR - innerR);
          const angle = Math.random() * Math.PI * 2.0;
          const yOff = (Math.random() - 0.5) * 2.0 * thickY * (0.3 + 0.7 * Math.random());

          // Kepler's 3rd Law differential angular speed (inner rocks orbit faster)
          const angSpeed = 1.65 / Math.pow(r, 1.5);

          const i4 = i * 4;
          aOrbit[i4]     = r;
          aOrbit[i4 + 1] = angle;
          aOrbit[i4 + 2] = yOff;
          aOrbit[i4 + 3] = angSpeed;

          const sizeRoll = Math.pow(Math.random(), 2.4);
          aTumble[i4]     = baseScale * (0.45 + sizeRoll * 2.35);
          aTumble[i4 + 1] = (Math.random() - 0.5) * 2.4;
          aTumble[i4 + 2] = (Math.random() - 0.5) * 2.4;
          aTumble[i4 + 3] = 0.55 + Math.random() * 0.55;
        }

        rockGeo.setAttribute("aOrbit",  new THREE.InstancedBufferAttribute(aOrbit, 4));
        rockGeo.setAttribute("aTumble", new THREE.InstancedBufferAttribute(aTumble, 4));

        const gpuBeltUniforms = {
          uTime: { value: 0.0 }
        };
        window._novaGpuBeltUniforms = gpuBeltUniforms;

        const gpuRockMat = new THREE.ShaderMaterial({
          uniforms: gpuBeltUniforms,
          vertexShader: `
            attribute vec4 aOrbit;
            attribute vec4 aTumble;
            uniform float uTime;
            varying vec3 vWorldNormal;
            varying vec3 vWorldPos;
            varying vec3 vLocalPos;
            varying float vAlbedo;

            mat3 rotX(float a) {
              float c = cos(a), s = sin(a);
              return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
            }
            mat3 rotY(float a) {
              float c = cos(a), s = sin(a);
              return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
            }

            void main() {
              float r = aOrbit.x;
              float theta = aOrbit.y + uTime * aOrbit.w;
              vec3 center = vec3(cos(theta) * r, aOrbit.z, sin(theta) * r);

              mat3 tumbleMat = rotY(uTime * aTumble.z + aOrbit.y) * rotX(uTime * aTumble.y);
              vec3 localPos = tumbleMat * (position * aTumble.x);
              vec3 worldPos = center + localPos;

              vWorldPos = worldPos;
              vWorldNormal = normalize(tumbleMat * normal);
              vLocalPos = position + vec3(aOrbit.y * 3.7, aTumble.y * 5.1, aOrbit.x * 0.43);
              vAlbedo = aTumble.w;

              gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
            }
          `,
          fragmentShader: `
            varying vec3 vWorldNormal;
            varying vec3 vWorldPos;
            varying vec3 vLocalPos;
            varying float vAlbedo;

            float hash31(vec3 p) {
              p = fract(p * 0.1031);
              p += dot(p, p.yzx + 33.33);
              return fract((p.x + p.y) * p.z);
            }
            float vNoise(vec3 x) {
              vec3 i = floor(x), f = fract(x);
              f = f * f * (3.0 - 2.0 * f);
              return mix(
                mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
                    mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
                mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                    mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z
              );
            }

            void main() {
              // 3D procedural rocky grit + micro-crater pitting
              vec3 p = vLocalPos * 4.5;
              float n1 = vNoise(p);
              float n2 = vNoise(p * 2.7 + vec3(4.2, -1.9, 7.1));
              float n3 = vNoise(p * 6.5 - vec3(2.3, 5.4, -3.1));
              float craters = smoothstep(0.22, 0.48, n1 * 0.65 + n2 * 0.35);
              float grit = n2 * 0.55 + n3 * 0.45;

              // Perturb surface normal with rocky relief
              vec3 grad = vec3(
                vNoise(p + vec3(0.08, 0.0, 0.0)) - n1,
                vNoise(p + vec3(0.0, 0.08, 0.0)) - n1,
                vNoise(p + vec3(0.0, 0.0, 0.08)) - n1
              );
              vec3 N = normalize(vWorldNormal + grad * 2.8);
              vec3 L = normalize(-vWorldPos); // Sun at origin
              vec3 V = normalize(cameraPosition - vWorldPos);

              float diff = max(dot(N, L), 0.0);
              float ao = 0.55 + 0.45 * craters;
              float rimGlint = pow(1.0 - max(dot(N, V), 0.0), 3.2) * smoothstep(0.0, 0.5, diff);

              // Retain unobtrusive dark C-type charcoal albedo with mineral/regolith variation
              vec3 shadowCol = vec3(0.045, 0.052, 0.068) * ao;
              vec3 litCol    = mix(vec3(0.26, 0.25, 0.24), vec3(0.42, 0.40, 0.38), grit) * vAlbedo * ao;
              vec3 col = mix(shadowCol, litCol, 0.07 + 0.93 * diff) + vec3(0.42, 0.43, 0.45) * rimGlint * 0.22;

              gl_FragColor = vec4(col, 1.0);
            }
          `
        });

        const gpuBeltMesh = new THREE.InstancedMesh(rockGeo, gpuRockMat, TOTAL_ROCKS);
        gpuBeltMesh.frustumCulled = false;
        gpuBeltMesh.raycast = () => {};
        asteroidBelt.add(gpuBeltMesh);
      })();

      scene.add(asteroidBelt);
    }

    async function fetchCatalog() {
      try {
        const res = await fetch('./catalog.json');
        catalog = (await res.json()).filter(item => item.id !== 'voyager-1');
        renderCatalogNodes(() => {
          initDeepLinks({ celestialObjects, filterTier: window.filterTier, novaSlewToMesh: window.novaSlewToMesh });
          initScaleCompare({ celestialObjects, getActiveTarget: () => activeTarget });
        });
      } catch (err) {
        console.error("Failed to fetch catalog:", err);
      }
    }

    function getOumuamuaPosition(t) {
      const x = 6.8 * Math.sinh(t);
      const z = 9.2 * Math.cosh(t) - 1.2;
      const y = x * 0.65 + Math.sin(t) * 2.8;
      return new THREE.Vector3(x, y, z);
    }

    function renderCatalogNodes(onComplete) {
      let _nodeIdx = 0;
      let _finalized = false;

      function buildSingleCatalogNode(item, index) {
        if (item.id === "oort-cloud") return;

        let material;
        let geometry = new THREE.SphereGeometry(item.size, 32, 32);

        if (item.id === "sun") {
          material = new THREE.MeshBasicMaterial({ map: createProceduralTexture('sun') });
        } else if (item.id === "stephenson-2-18") {
          material = new THREE.MeshBasicMaterial({ map: createProceduralTexture('stephenson') });
        } else if (item.id === "sombrero-galaxy") {
          material = new THREE.MeshBasicMaterial({ map: createProceduralTexture('sombrero') });
        } else if (item.id === "messier-87") {
          material = new THREE.MeshBasicMaterial({ color: 0xfde047 });
        } else if (item.id === "ton-618") {
          item.size = Math.max(item.size || 65.0, 65.0);
          geometry = new THREE.SphereGeometry(item.size, 64, 64);
          material = new THREE.MeshBasicMaterial({
            color: 0x000000,
            depthWrite: true,
            depthTest: true
          });
        } else if (item.id === "earendel") {
          material = new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.0, depthWrite: false });
        } else if (item.id === "earth") {
          material = new THREE.MeshBasicMaterial({ map: createProceduralTexture('earth') });
        } else if (item.id === "jupiter") {
          material = new THREE.MeshBasicMaterial({ map: createProceduralTexture('jupiter') });
        } else if (item.id === "mars") {
          material = new THREE.MeshBasicMaterial({ map: createProceduralTexture('mars') });
        } else if (item.id === "uranus") {
          material = new THREE.MeshBasicMaterial({ map: createProceduralTexture('uranus') });
        } else if (item.id === "neptune") {
          material = new THREE.MeshBasicMaterial({ map: createProceduralTexture('neptune') });
        } else if (item.id === "ceres") {
          material = new THREE.MeshBasicMaterial({ color: 0xd1d5db });
        } else if (item.id === "oumuamua") {
          geometry = new THREE.SphereGeometry(1.0, 96, 64);
          const posAttr = geometry.attributes.position;
          const S = item.size; // 0.28
          for (let i = 0; i < posAttr.count; i++) {
            const ux = posAttr.getX(i);
            const uy = posAttr.getY(i);
            const uz = posAttr.getZ(i);

            // Azimuth around the horizontal XZ perimeter for scalloped lobes (Screenshot 6.17.13 PM)
            const az = Math.atan2(uz, ux);
            const rHoriz = Math.sqrt(ux * ux + uz * uz);

            // 7 deep V-shaped radial clefts carving rounded lobes around the perimeter (Screenshot 6.17.13 PM)
            const lobeWave = Math.abs(Math.sin(az * 3.5 + 0.35 * Math.sin(az * 2.0)));
            const cleftGroove = (1.0 - Math.pow(lobeWave, 0.48)) * 0.22 * Math.pow(rHoriz, 0.75);

            // Asymmetric tapering along major X axis: chiseled prow (-X) & terraced tail (+X) (Screenshot 6.17.48 PM)
            const prowTaper = (ux < 0)
              ? (1.0 - 0.32 * Math.pow(-ux, 1.65))
              : (1.0 - 0.24 * Math.pow(ux, 1.35) - 0.06 * Math.floor(ux * 3.5));

            // Longitudinal striated ridges & diagonal side crevasses (Screenshot 6.17.48 PM)
            const striations = Math.sin(uz * 22.0 + ux * 6.0 + Math.sin(ux * 10.0) * 1.4) * 0.048;
            const crag1 = Math.sin(ux * 9.5 + uy * 7.2) * Math.cos(uz * 11.0 - ux * 5.4) * 0.065;
            const crag2 = Math.sin(ux * 21.0 - uz * 19.0 + uy * 15.0) * 0.028;
            const diagCrevasse = Math.exp(-Math.pow((ux * 0.85 + uy * 0.55 + 0.18) * 9.5, 2.0)) * 0.11
                               + Math.exp(-Math.pow((ux * 0.75 - uy * 0.60 - 0.22) * 10.5, 2.0)) * 0.09;

            // Prominent dorsal impact crater basin with raised rim on upper +Y surface (both screenshots)
            let craterDisp = 0.0;
            if (uy > 0.05) {
              const dxC = (ux + 0.12) / 0.28;
              const dzC = (uz - 0.03) / 0.24;
              const dC = Math.sqrt(dxC * dxC + dzC * dzC);
              if (dC < 0.88) {
                const nC = dC / 0.88;
                craterDisp = -(1.0 - nC * nC) * 0.38;
              } else if (dC < 1.32) {
                const rimPhase = ((dC - 0.88) / 0.44) * Math.PI;
                craterDisp = Math.sin(rimPhase) * 0.11;
              }
            }

            const radialMod = Math.max(0.42, 1.0 - cleftGroove + striations + crag1 + crag2 - diagCrevasse);
            const px = ux * S * 3.35 * (0.88 + 0.12 * radialMod);
            const pz = uz * S * 1.52 * prowTaper * radialMod;
            const py = (uy * (0.82 + 0.24 * radialMod) + craterDisp) * S * 0.54 * prowTaper;

            posAttr.setXYZ(i, px, py, pz);
          }
          geometry.computeVertexNormals();
          material = new THREE.MeshBasicMaterial({ color: 0xb93822 });
        } else if (item.id === "eagle-nebula") {
          material = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.85 });
        } else if (item.id === "sagittarius-a-star") {
          material = new THREE.MeshBasicMaterial({ color: 0x000000 });
        } else if (item.id === "crab-nebula") {
          material = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
        } else if (item.id === "bootes-void") {
          material = new THREE.MeshBasicMaterial({
            color: 0x6366f1,
            side: THREE.DoubleSide,
            wireframe: true,
            transparent: true,
            opacity: 0.18
          });
        } else {
          material = new THREE.MeshBasicMaterial({ color: item.color });
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = item;

        if (item.id === "sun") {
          sunMeshRef = mesh;

          // === NOVA UPGRADE: JPL ECLIPTIC COORDINATE GRID ===
          if (!window._novaEclipticGrid) {
            const gridGroup = new THREE.Group();
            gridGroup.position.y = -0.04;
            const ringRadii = [12, 24, 42, 68, 105, 160, 240];
            ringRadii.forEach((r, idx) => {
              const pts = [];
              const segs = 128;
              for (let s = 0; s <= segs; s++) {
                const theta = (s / segs) * Math.PI * 2;
                pts.push(new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r));
              }
              const rGeo = new THREE.BufferGeometry().setFromPoints(pts);
              const rMat = new THREE.LineBasicMaterial({
                color: idx % 2 === 0 ? 0xe2e8f0 : 0xfbbf24,
                transparent: true,
                opacity: idx % 2 === 0 ? 0.055 : 0.04,
                depthWrite: false
              });
              const rLine = new THREE.Line(rGeo, rMat);
              rLine.raycast = () => {};
              gridGroup.add(rLine);
            });

            // 15-degree radial azimuth ticks (optical instrument reticle)
            const tickPts = [];
            for (let deg = 0; deg < 360; deg += 15) {
              const rad = (deg * Math.PI) / 180;
              const isCardinal = deg % 90 === 0;
              const innerR = isCardinal ? 12 : 152;
              const outerR = 240;
              tickPts.push(
                new THREE.Vector3(Math.cos(rad) * innerR, 0, Math.sin(rad) * innerR),
                new THREE.Vector3(Math.cos(rad) * outerR, 0, Math.sin(rad) * outerR)
              );
            }
            const tickGeo = new THREE.BufferGeometry().setFromPoints(tickPts);
            const tickMat = new THREE.LineBasicMaterial({
              color: 0xcbd5e1,
              transparent: true,
              opacity: 0.045,
              depthWrite: false
            });
            const tickLines = new THREE.LineSegments(tickGeo, tickMat);
            tickLines.raycast = () => {};
            gridGroup.add(tickLines);

            window._novaEclipticGrid = gridGroup;
            scene.add(gridGroup);
          }
        }

        // === NOVA UPGRADE: SUN-REACTIVE FRESNEL ATMOSPHERES (GLSL) ===
        const _fresnelAtmos = {
          earth:   { color: 0x38bdf8, intensity: 1.15, scale: 1.09 },
          venus:   { color: 0xfde68a, intensity: 0.85, scale: 1.07 },
          mars:    { color: 0xfb923c, intensity: 0.55, scale: 1.05 },
          neptune: { color: 0x60a5fa, intensity: 0.95, scale: 1.08 },
          uranus:  { color: 0x67e8f9, intensity: 0.75, scale: 1.07 }
        };
        if (_fresnelAtmos[item.id]) {
          const cfg = _fresnelAtmos[item.id];
          const atmoGeo = new THREE.SphereGeometry(item.size * cfg.scale, 48, 32);
          const atmoMat = new THREE.ShaderMaterial({
            uniforms: {
              uColor: { value: new THREE.Color(cfg.color) },
              uIntensity: { value: cfg.intensity }
            },
            vertexShader: `
              varying vec3 vWorldNormal;
              varying vec3 vWorldPos;
              void main() {
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vWorldPos = wp.xyz;
                vWorldNormal = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * wp;
              }
            `,
            fragmentShader: `
              uniform vec3 uColor;
              uniform float uIntensity;
              varying vec3 vWorldNormal;
              varying vec3 vWorldPos;
              void main() {
                vec3 N = normalize(vWorldNormal);
                vec3 V = normalize(cameraPosition - vWorldPos);
                vec3 L = normalize(-vWorldPos); // Sun sits at origin (0,0,0)
                float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
                float sunSide = smoothstep(-0.25, 0.65, dot(N, L));
                float alpha = fresnel * (0.22 + 0.78 * sunSide) * uIntensity;
                gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 0.92));
              }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.FrontSide
          });
          const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
          atmoMesh.raycast = () => {};
          mesh.add(atmoMesh);
        }

        if (item.id === "uranus") {
          mesh.rotation.z = (97.77 * Math.PI) / 180;
          const uInner = item.size * 1.38;
          const uOuter = item.size * 2.15;
          const uranusRingGeo = new THREE.RingGeometry(uInner, uOuter, 128);
          const uranusRingMat = new THREE.ShaderMaterial({
            uniforms: {
              uInnerR: { value: uInner },
              uOuterR: { value: uOuter }
            },
            vertexShader: `
              varying vec3 vLocalPos;
              void main() {
                vLocalPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader: `
              uniform float uInnerR;
              uniform float uOuterR;
              varying vec3 vLocalPos;

              float ringStrand(float t, float center, float width, float strength) {
                return exp(-pow((t - center) / width, 2.0)) * strength;
              }

              void main() {
                float r = length(vLocalPos.xy);
                float t = clamp((r - uInnerR) / (uOuterR - uInnerR), 0.0, 1.0);
                float angle = atan(vLocalPos.y, vLocalPos.x);

                // Multi-stranded razor-thin, low-albedo Uranus ring system (6, 5, 4, alpha, beta, eta, gamma, delta, epsilon)
                float strands = 0.0;
                strands += ringStrand(t, 0.14, 0.012, 0.09);
                strands += ringStrand(t, 0.24, 0.010, 0.11);
                strands += ringStrand(t, 0.36, 0.009, 0.14);
                strands += ringStrand(t, 0.48, 0.011, 0.13);
                strands += ringStrand(t, 0.62, 0.009, 0.17);
                strands += ringStrand(t, 0.74, 0.010, 0.15);
                // Subtle, slightly asymmetric outer Epsilon ring
                float epsVar = 0.72 + 0.28 * sin(angle * 1.0 + 0.8);
                strands += ringStrand(t, 0.89, 0.015, 0.30 * epsVar);

                // Ultra-faint dark dust sheet between strands
                float dust = smoothstep(0.05, 0.25, t) * (1.0 - smoothstep(0.85, 1.0, t)) * 0.025;

                vec3 warmDust = vec3(0.34, 0.31, 0.30);
                vec3 icyRim   = vec3(0.42, 0.46, 0.50);
                vec3 col = mix(warmDust, icyRim, smoothstep(0.55, 0.95, t));

                float alpha = clamp(strands + dust, 0.0, 0.34);
                if (alpha < 0.006) discard;
                gl_FragColor = vec4(col, alpha);
              }
            `,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false
          });
          const uranusRing = new THREE.Mesh(uranusRingGeo, uranusRingMat);
          uranusRing.rotation.x = Math.PI / 2;
          uranusRing.raycast = () => {};
          mesh.add(uranusRing);
        }

        if (item.id === "sun") {
          const glow = makeFractalNodeSprite('rgba(251, 191, 36, 0.85)', item.size * 4.5);
          mesh.add(glow);
        } else if (item.id === "oumuamua") {
          // Faint ice-blue sublimating volatile / nitrogen outgassing mist (Screenshot 6.17.13 PM)
          const outgasTex = createProceduralCloudTexture((ctx, s) => {
            const cx = s * 0.5, cy = s * 0.5;
            const g = ctx.createRadialGradient(cx, cy, s * 0.04, cx, cy, s * 0.48);
            g.addColorStop(0.0, "rgba(186, 230, 253, 0.42)");
            g.addColorStop(0.38, "rgba(125, 211, 252, 0.22)");
            g.addColorStop(0.72, "rgba(56, 189, 248, 0.08)");
            g.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(cx, cy, s * 0.48, 0, Math.PI * 2);
            ctx.fill();
          }, 128);
          const outgasSprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: outgasTex,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          }));
          outgasSprite.scale.set(item.size * 6.2, item.size * 7.5, 1);
          outgasSprite.raycast = () => {};
          mesh.add(outgasSprite);
        } else if (item.id === "stephenson-2-18") {
          // Extreme M6 Red Hypergiant: deep crimson core glow + heavy extended dusty mass-loss shell
          const hypergiantGlow = makeFractalNodeSprite('rgba(185, 28, 28, 0.90)', item.size * 4.2);
          hypergiantGlow.raycast = () => {};
          mesh.add(hypergiantGlow);

          const outerDust = makeFractalNodeSprite('rgba(127, 29, 29, 0.45)', item.size * 6.8);
          outerDust.raycast = () => {};
          mesh.add(outerDust);

          const ejectaCount = 160;
          const ePos = new Float32Array(ejectaCount * 3);
          for (let k = 0; k < ejectaCount; k++) {
            const r = item.size * (1.35 + Math.pow(Math.random(), 1.2) * 2.2);
            const th = Math.random() * Math.PI * 2;
            const ph = Math.acos(2 * Math.random() - 1);
            ePos[k * 3]     = r * Math.sin(ph) * Math.cos(th);
            ePos[k * 3 + 1] = r * Math.cos(ph);
            ePos[k * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
          }
          const eGeo = new THREE.BufferGeometry();
          eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
          const ePts = new THREE.Points(eGeo, new THREE.PointsMaterial({
            color: 0xfb7185,
            size: item.size * 0.22,
            map: createRoundParticleTexture(),
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          }));
          ePts.raycast = () => {};
          mesh.add(ePts);
        } else if (item.id === "eagle-nebula") {
          const nebulaAura = makeFractalNodeSprite('rgba(16, 185, 129, 0.55)', item.size * 6.2);
          mesh.add(nebulaAura);
        } else if (item.id === "sombrero-galaxy") {
          const dustRingGeo = new THREE.RingGeometry(item.size * 1.35, item.size * 1.75, 48);
          const dustRingMat = new THREE.MeshBasicMaterial({
            color: 0x1e293b,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.92
          });
          const dustRing = new THREE.Mesh(dustRingGeo, dustRingMat);
          dustRing.rotation.x = Math.PI / 2.2;
          dustRing.raycast = () => {};
          mesh.add(dustRing);

          const haloRingGeo = new THREE.RingGeometry(item.size * 1.76, item.size * 2.3, 48);
          const haloRingMat = new THREE.MeshBasicMaterial({
            color: 0xfef08a,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.32,
            blending: THREE.AdditiveBlending
          });
          const haloRing = new THREE.Mesh(haloRingGeo, haloRingMat);
          haloRing.rotation.x = Math.PI / 2.2;
          haloRing.raycast = () => {};
          mesh.add(haloRing);
        } else if (item.id === "messier-87") {
          const m87Halo = makeFractalNodeSprite('rgba(250, 204, 21, 0.55)', item.size * 5.2);
          mesh.add(m87Halo);

          const jetLength = item.size * 5.0;
          const m87JetGeo = new THREE.ConeGeometry(item.size * 0.22, jetLength, 16, 1, true);
          const m87JetMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });
          const m87Jet = new THREE.Mesh(m87JetGeo, m87JetMat);
          m87Jet.position.set(jetLength * 0.38, jetLength * 0.38, 0);
          m87Jet.rotation.z = -Math.PI / 4;
          m87Jet.raycast = () => {};
          mesh.add(m87Jet);
        } else if (item.id === "ton-618") {
          const R = item.size; // 65.0 (Event horizon diameter = 130.0 units, larger than the entire Solar System)
          mesh.renderOrder = 1;
          ton618PlasmaFlares = [];

          // Diagonal relativistic tilt group (matches Screenshot 5.40.09 PM & 5.41.38 PM)
          const ton618TiltGroup = new THREE.Group();
          ton618TiltGroup.rotation.z = 0.34;
          mesh.add(ton618TiltGroup);

          // 1. Gravitationally Lensed Einstein Arches + Razor-Sharp Photon Ring + 360° Swirling Crimson-Amber Vortex Ring
          //    Combines Screenshot 5.39.28 PM (360° fiery golden-orange-crimson turbulent ring around event horizon)
          //    with Screenshot 5.40.09 PM & 5.41.38 PM (incandescent white-gold upper/lower lensed Einstein arches)
          const lensedCanvas = document.createElement("canvas");
          lensedCanvas.width = 512;
          lensedCanvas.height = 512;
          const lCtx = lensedCanvas.getContext("2d");
          const lImg = lCtx.createImageData(512, 512);
          const lData = lImg.data;
          const rHoriz = 1.0 / 3.35; // Event horizon radius on plane of width R * 6.7

          for (let py = 0; py < 512; py++) {
            const ny = (py / 511) * 2.0 - 1.0;
            for (let px = 0; px < 512; px++) {
              const nx = (px / 511) * 2.0 - 1.0;
              const r2 = nx * nx + ny * ny;
              if (r2 >= 1.0) continue;
              const r = Math.sqrt(r2);
              const idx = (py * 512 + px) * 4;

              // Strictly transparent inside the black hole shadow so the 3D void stays pure #000000
              if (r < rHoriz * 0.992) continue;

              const absSin = Math.abs(ny) / Math.max(0.0001, r);
              const isUpper = ny < 0;
              const theta = Math.atan2(ny, nx);

              // Relativistic Doppler beaming: approaching left side (nx < 0) is hotter & brighter; receding right side is dimmer & redder
              const approach = Math.max(0.0, Math.min(1.0, 0.5 - 0.5 * (nx / Math.max(0.0001, r))));
              const dopplerBoost = 0.24 + 1.18 * Math.pow(approach, 1.55);

              // 1. Hair-thin relativistic Photon Ring (n=1 caustic) right at the shadow edge
              const photonDist = (r - rHoriz * 1.006) / (rHoriz * 0.009);
              const photonRing = Math.exp(-photonDist * photonDist) * (0.55 + 0.65 * approach);

              // 2. Dark ISCO Plunge Gap: accretion plasma starts outside 1.14 * rHoriz so the black hole reads as a true void
              let vortexRing = 0.0;
              let vortexHeat = 0.0;
              const uVortex = (r - rHoriz * 1.14) / (rHoriz * 0.72);
              if (uVortex >= 0.0 && uVortex <= 1.0) {
                const swirlAng = theta + 10.5 * Math.pow(1.0 - uVortex, 1.3);
                const f1 = Math.sin(swirlAng * 5.0 + uVortex * 36.0) * 0.5 + 0.5;
                const f2 = Math.cos(swirlAng * 12.0 - uVortex * 64.0) * 0.5 + 0.5;
                const f3 = Math.sin(uVortex * 52.0 + Math.sin(theta * 4.0) * 2.0) * 0.5 + 0.5;
                const filament = Math.pow(f1 * 0.46 + f2 * 0.30 + f3 * 0.24, 1.1);
                const innerRamp = Math.min(1.0, uVortex * 5.5);
                const radialEnv = innerRamp * Math.pow(1.0 - uVortex, 1.45);
                vortexRing = radialEnv * (0.28 + 0.85 * filament) * dopplerBoost * 0.72;
                vortexHeat = Math.max(0.0, Math.min(1.0, (1.0 - uVortex * 0.75) * (0.45 + 0.55 * approach)));
              }

              // 3. Gravitationally lensed upper & lower Einstein arches (also separated by the dark plunge gap)
              const archReach = isUpper
                ? rHoriz * (1.26 + 1.18 * Math.pow(absSin, 0.72))
                : rHoriz * (1.20 + 0.88 * Math.pow(absSin, 0.82));

              let archIntensity = 0.0;
              let uArch = 0.0;
              if (r >= rHoriz * 1.12 && r <= archReach) {
                uArch = (r - rHoriz * 1.12) / Math.max(0.001, archReach - rHoriz * 1.12);
                const radialEnv = Math.pow(Math.max(0, 1.0 - uArch), 1.55) * Math.pow(Math.min(1.0, uArch * 6.0), 0.75);
                const polarEnv = Math.pow(absSin, 0.45);
                const s1 = Math.sin(uArch * 68.0 + Math.cos(theta * 3.0) * 1.5) * 0.5 + 0.5;
                const s2 = Math.sin(uArch * 150.0 + Math.sin(theta * 6.0) * 1.8) * 0.5 + 0.5;
                const archStreak = s1 * 0.60 + s2 * 0.40;
                archIntensity = radialEnv * polarEnv * (0.35 + 0.75 * archStreak) * dopplerBoost * 0.88;
              }

              const archHeat = Math.max(0, 1.0 - uArch * 0.85) * (0.45 + 0.55 * approach);
              const red = photonRing * 255
                + archIntensity * (255 * archHeat + 215 * (1 - archHeat))
                + vortexRing * (250 * vortexHeat + 185 * (1 - vortexHeat));
              const green = photonRing * 246
                + archIntensity * (238 * Math.pow(archHeat, 1.1) + 92 * (1 - archHeat))
                + vortexRing * (212 * Math.pow(vortexHeat, 1.25) + 46 * (1 - vortexHeat));
              const blue = photonRing * 235
                + archIntensity * (255 * Math.pow(archHeat, 1.6) + 22 * (1 - archHeat))
                + vortexRing * (225 * Math.pow(vortexHeat, 1.9) + 12 * (1 - vortexHeat));
              const alpha = Math.min(1.0, photonRing * 0.98 + archIntensity * 0.92 + vortexRing * 0.82) * 255;

              lData[idx]     = Math.min(255, red | 0);
              lData[idx + 1] = Math.min(255, green | 0);
              lData[idx + 2] = Math.min(255, blue | 0);
              lData[idx + 3] = Math.min(255, alpha | 0);
            }
          }
          lCtx.putImageData(lImg, 0, 0);
          const lensedTex = new THREE.CanvasTexture(lensedCanvas);
          lensedTex.colorSpace = THREE.SRGBColorSpace;
          lensedTex.needsUpdate = true;

          const lensedGeo = new THREE.PlaneGeometry(R * 6.7, R * 6.7);
          const lensedMat = new THREE.MeshBasicMaterial({
            map: lensedTex,
            transparent: true,
            opacity: 0.99,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true,
            side: THREE.DoubleSide
          });
          const lensedMesh = new THREE.Mesh(lensedGeo, lensedMat);
          lensedMesh.position.z = -R * 0.03;
          lensedMesh.renderOrder = 2;
          lensedMesh.raycast = () => {};
          ton618TiltGroup.add(lensedMesh);

          // 2. Hyperluminous 140-Trillion-Sun Relativistic Quasar Accretion Disk (5.40.09 PM & 5.41.38 PM)
          const diskCanvas = document.createElement("canvas");
          diskCanvas.width = 512;
          diskCanvas.height = 512;
          const dCtx = diskCanvas.getContext("2d");
          const dImg = dCtx.createImageData(512, 512);
          const dData = dImg.data;
          const rDiskInner = 0.245; // Real dark ISCO plunge gap around the event horizon shadow
          const rDiskOuter = 0.985;

          for (let py = 0; py < 512; py++) {
            const ny = (py / 511) * 2.0 - 1.0;
            for (let px = 0; px < 512; px++) {
              const nx = (px / 511) * 2.0 - 1.0;
              const r2 = nx * nx + ny * ny;
              if (r2 >= 1.0) continue;
              const r = Math.sqrt(r2);
              if (r < rDiskInner * 0.95) continue;

              const u = Math.max(0, (r - rDiskInner) / (rDiskOuter - rDiskInner));
              if (u >= 1.0) continue;

              const theta = Math.atan2(ny, nx);
              const spiralPhase = theta + 13.0 * Math.pow(1.0 - u, 1.35);
              const sx = Math.cos(spiralPhase);
              const sy = Math.sin(spiralPhase);

              const turb1 = Math.sin(sx * 4.0 + u * 30.0) * Math.cos(sy * 4.0 - u * 24.0);
              const turb2 = Math.sin(theta * 4.0 + u * 56.0) * 0.5 + Math.cos(theta * 8.0 - u * 92.0) * 0.5;

              const band1 = Math.sin(u * 92.0 + turb1 * 2.5) * 0.5 + 0.5;
              const band2 = Math.sin(u * 210.0 + turb2 * 2.9) * 0.5 + 0.5;
              const band3 = Math.pow(Math.sin(u * 44.0 + turb1 * 1.6) * 0.5 + 0.5, 1.35);
              const grooveMask = 0.34 + 0.66 * Math.pow(band1 * 0.50 + band2 * 0.30 + band3 * 0.20, 0.82);

              const innerFade = Math.min(1.0, Math.max(0.0, (r - rDiskInner * 0.95) / (rDiskInner * 0.075)));
              const outerFade = Math.pow(1.0 - u, 1.48);
              // Strong relativistic Doppler beaming (approaching left side blazing hot, receding right side dimmed)
              const dopplerBoost = Math.max(0.28, 1.0 - 0.46 * (nx / r));

              // Multi-temperature quasar disk: blazing white-blue inner plasma -> dusty rust-orange outer torus
              let cR, cG, cB;
              if (u < 0.24) {
                const t = u / 0.24;
                cR = 215 + t * 40;
                cG = 238 - t * 26;
                cB = 255 - t * 65;
              } else if (u < 0.58) {
                const t = (u - 0.24) / 0.34;
                cR = 245 - t * 35;
                cG = 190 - t * 98;
                cB = 170 - t * 135;
              } else {
                const t = (u - 0.58) / 0.42;
                cR = 210 - t * 115;
                cG = 92 - t * 68;
                cB = 35 - t * 28;
              }

              const lum = grooveMask * dopplerBoost * (0.82 + 0.42 * band1);
              const finalR = Math.min(255, cR * lum);
              const finalG = Math.min(255, cG * lum);
              const finalB = Math.min(255, cB * lum);
              const finalA = Math.min(255, innerFade * outerFade * (0.48 + 0.52 * grooveMask) * 252);

              const idx = (py * 512 + px) * 4;
              dData[idx]     = finalR | 0;
              dData[idx + 1] = finalG | 0;
              dData[idx + 2] = finalB | 0;
              dData[idx + 3] = finalA | 0;
            }
          }
          dCtx.putImageData(dImg, 0, 0);
          const ton618DiskTex = new THREE.CanvasTexture(diskCanvas);
          ton618DiskTex.colorSpace = THREE.SRGBColorSpace;
          ton618DiskTex.needsUpdate = true;

          // Animated 3D Gravitational Swirl: orbiting stars & infalling tidal debris accelerated by TON 618's gravity well
          const tonSwarmCount = 420;
          const tonSwarmPos = new Float32Array(tonSwarmCount * 3);
          const tonSwarmCol = new Float32Array(tonSwarmCount * 3);
          const tonSwarmMeta = [];
          for (let k = 0; k < tonSwarmCount; k++) {
            const rNorm = 1.32 + Math.pow(Math.random(), 1.45) * 4.4;
            const rad = R * rNorm;
            const ang = Math.random() * Math.PI * 2;
            const incl = (Math.random() - 0.5) * 1.15;
            const speed = (0.022 / Math.pow(rNorm, 1.35)) * (0.8 + Math.random() * 0.4);
            tonSwarmMeta.push({ rad, ang, incl, speed, yPhase: Math.random() * Math.PI * 2 });
            tonSwarmPos[k * 3]     = Math.cos(ang) * rad;
            tonSwarmPos[k * 3 + 1] = Math.sin(ang) * rad * Math.sin(incl);
            tonSwarmPos[k * 3 + 2] = Math.sin(ang) * rad * Math.cos(incl);
            const c = (rNorm < 2.1) ? new THREE.Color(0xbae6fd) : ((k % 3 === 0) ? new THREE.Color(0xfdba74) : new THREE.Color(0xf8fafc));
            tonSwarmCol[k * 3] = c.r; tonSwarmCol[k * 3 + 1] = c.g; tonSwarmCol[k * 3 + 2] = c.b;
          }
          const tonSwarmGeo = new THREE.BufferGeometry();
          tonSwarmGeo.setAttribute('position', new THREE.BufferAttribute(tonSwarmPos, 3));
          tonSwarmGeo.setAttribute('color', new THREE.BufferAttribute(tonSwarmCol, 3));
          const tonSwarmPts = new THREE.Points(tonSwarmGeo, new THREE.PointsMaterial({
            size: R * 0.11,
            map: createRoundParticleTexture(),
            vertexColors: true,
            transparent: true,
            opacity: 0.78,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          }));
          tonSwarmPts.userData.swarmMeta = tonSwarmMeta;
          tonSwarmPts.raycast = () => {};
          ton618TiltGroup.add(tonSwarmPts);
          window._ton618Swarm = tonSwarmPts;

          const ton618DiskPitchGroup = new THREE.Group();
          ton618DiskPitchGroup.rotation.x = -Math.PI * 0.435;
          ton618TiltGroup.add(ton618DiskPitchGroup);

          const diskGeo = new THREE.PlaneGeometry(R * 10.8, R * 10.8);
          const diskMat = new THREE.MeshBasicMaterial({
            map: ton618DiskTex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.99,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true
          });
          ton618AccretionDisk = new THREE.Mesh(diskGeo, diskMat);
          ton618AccretionDisk.renderOrder = 3;
          ton618AccretionDisk.raycast = () => {};
          ton618DiskPitchGroup.add(ton618AccretionDisk);

          // Secondary volumetric disk thickness layer for towering hyperluminous quasar depth
          const thickDiskMat = new THREE.MeshBasicMaterial({
            map: ton618DiskTex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.46,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true
          });
          const thickDiskMesh = new THREE.Mesh(diskGeo, thickDiskMat);
          thickDiskMesh.rotation.x = 0.06;
          thickDiskMesh.rotation.y = -0.05;
          thickDiskMesh.scale.setScalar(1.05);
          thickDiskMesh.renderOrder = 3;
          thickDiskMesh.raycast = () => {};
          ton618AccretionDisk.add(thickDiskMesh);

          // 3. Blazing Relativistic Quasar / Blazar Plasma Jet & Segmented Counter-Jet (Screenshot 5.41.38 PM)
          const jetBeamCanvas = document.createElement("canvas");
          jetBeamCanvas.width = 512;
          jetBeamCanvas.height = 128;
          const jCtx = jetBeamCanvas.getContext("2d");
          const jImg = jCtx.createImageData(512, 128);
          const jData = jImg.data;
          for (let py = 0; py < 128; py++) {
            const ny = (py / 127) * 2.0 - 1.0; // Across jet width
            for (let px = 0; px < 512; px++) {
              const u = px / 511; // 0 (base at black hole core) to 1 (outer tip)
              // Tightly collimated laser-white inner spine + glowing golden-amber plasma sheath
              const coreWidth = 0.14 + u * 0.18;
              const sheathWidth = 0.42 + u * 0.48;
              const coreProfile = Math.exp(-Math.pow(ny / coreWidth, 2.0));
              const sheathProfile = Math.exp(-Math.pow(ny / sheathWidth, 2.0));
              const baseFade = Math.min(1.0, u * 16.0);
              const tipFade = Math.pow(1.0 - u, 0.55);
              const env = baseFade * tipFade;

              // Focused violet-blue relativistic quasar jet (laser-white core + indigo-violet plasma sheath)
              const rCol = Math.min(255, (coreProfile * 235 + sheathProfile * 125) * env);
              const gCol = Math.min(255, (coreProfile * 242 + sheathProfile * 145) * env);
              const bCol = Math.min(255, (coreProfile * 255 + sheathProfile * 255) * env);
              const aCol = Math.min(255, Math.min(1.0, coreProfile * 0.95 + sheathProfile * 0.52) * env * 255);

              const idx = (py * 512 + px) * 4;
              jData[idx]     = rCol | 0;
              jData[idx + 1] = gCol | 0;
              jData[idx + 2] = bCol | 0;
              jData[idx + 3] = aCol | 0;
            }
          }
          jCtx.putImageData(jImg, 0, 0);
          const jetBeamTex = new THREE.CanvasTexture(jetBeamCanvas);
          jetBeamTex.colorSpace = THREE.SRGBColorSpace;
          jetBeamTex.needsUpdate = true;

          // Forward relativistic jet shooting from the central core toward upper-right (Screenshot 5.41.38 PM)
          const jetGroup = new THREE.Group();
          // Angle jet to match Screenshot 5.41.38 PM (~24 deg above horizontal to the right, tilted slightly forward)
          jetGroup.rotation.z = -0.22;
          jetGroup.rotation.y = -0.18;
          jetGroup.position.set(0, 0, R * 1.02);
          ton618TiltGroup.add(jetGroup);

          const jetLen = R * 9.5;
          const jetWid = R * 0.92;
          const jetPlaneGeo = new THREE.PlaneGeometry(jetLen, jetWid);
          jetPlaneGeo.translate(jetLen * 0.5, 0, 0);
          const jetPlaneMat = new THREE.MeshBasicMaterial({
            map: jetBeamTex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.98,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true
          });
          const jetPlane1 = new THREE.Mesh(jetPlaneGeo, jetPlaneMat);
          jetPlane1.renderOrder = 5;
          jetPlane1.raycast = () => {};
          jetGroup.add(jetPlane1);

          const jetPlane2 = new THREE.Mesh(jetPlaneGeo, jetPlaneMat);
          jetPlane2.rotation.x = Math.PI * 0.5;
          jetPlane2.renderOrder = 5;
          jetPlane2.raycast = () => {};
          jetGroup.add(jetPlane2);

          // Blazing white-gold jet launch base core right at the polar magnetosphere (Screenshot 5.41.38 PM)
          const flareCloudTex = createProceduralCloudTexture((ctx, s) => {
            const cx = s / 2, cy = s / 2;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.48);
            grad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
            grad.addColorStop(0.28, "rgba(255, 245, 200, 0.92)");
            grad.addColorStop(0.62, "rgba(251, 146, 60, 0.42)");
            grad.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, s * 0.48, 0, Math.PI * 2);
            ctx.fill();
          }, 128);

          const jetBaseCore = new THREE.Sprite(new THREE.SpriteMaterial({
            map: flareCloudTex,
            color: 0xffffff,
            transparent: true,
            opacity: 0.98,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          }));
          jetBaseCore.scale.set(R * 1.45, R * 1.15, 1);
          jetBaseCore.renderOrder = 6;
          jetBaseCore.raycast = () => {};
          jetGroup.add(jetBaseCore);

          // Segmented relativistic counter-jet knots on the lower-left (Screenshot 5.41.38 PM)
          const counterKnotDistances = [-R * 1.65, -R * 2.55, -R * 3.45];
          counterKnotDistances.forEach((d, kIdx) => {
            const knotGeo = new THREE.PlaneGeometry(R * 0.78, R * 0.34);
            const knotMat = new THREE.MeshBasicMaterial({
              map: flareCloudTex,
              color: 0xfef08a,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.92 - kIdx * 0.12,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              depthTest: true
            });
            const knotMesh = new THREE.Mesh(knotGeo, knotMat);
            knotMesh.position.set(d, -R * 0.12, 0);
            knotMesh.renderOrder = 5;
            knotMesh.raycast = () => {};
            jetGroup.add(knotMesh);
          });

          // 4. Orbiting Hot Plasma Flares on the Inner Quasar Disk
          const flareCount = 8;
          for (let f = 0; f < flareCount; f++) {
            const fSprite = new THREE.Sprite(new THREE.SpriteMaterial({
              map: flareCloudTex,
              color: (f % 2 === 0) ? 0xfef9c3 : 0xfb923c,
              transparent: true,
              opacity: 0.88,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            }));
            const flareScale = R * (0.58 + (f % 3) * 0.22);
            fSprite.scale.set(flareScale * 1.4, flareScale * 0.85, 1);
            fSprite.renderOrder = 4;
            fSprite.raycast = () => {};
            ton618TiltGroup.add(fSprite);

            ton618PlasmaFlares.push({
              mesh: fSprite,
              radius: R * (1.24 + f * 0.32),
              angle: (f / flareCount) * Math.PI * 2,
              speed: 0.016 - f * 0.0014
            });
          }

          // 5. Dense Surrounding Background Starfield Outside the Event Horizon & Ring (Screenshot 5.39.28 PM)
          const starCount = 480;
          const starPos = new Float32Array(starCount * 3);
          const starCol = new Float32Array(starCount * 3);
          const palette = [
            new THREE.Color(0xffffff),
            new THREE.Color(0xfef08a),
            new THREE.Color(0xfde68a),
            new THREE.Color(0xbae6fd),
            new THREE.Color(0xfdba74)
          ];
          for (let i = 0; i < starCount; i++) {
            const ang = Math.random() * Math.PI * 2;
            const rad = R * (2.15 + Math.pow(Math.random(), 0.75) * 3.85);
            const zSpread = (Math.random() - 0.5) * R * 1.8;
            starPos[i * 3]     = Math.cos(ang) * rad;
            starPos[i * 3 + 1] = Math.sin(ang) * rad;
            starPos[i * 3 + 2] = zSpread;
            const c = palette[i % palette.length];
            const b = 0.55 + Math.random() * 0.45;
            starCol[i * 3]     = c.r * b;
            starCol[i * 3 + 1] = c.g * b;
            starCol[i * 3 + 2] = c.b * b;
          }
          const starGeo = new THREE.BufferGeometry();
          starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
          starGeo.setAttribute("color", new THREE.BufferAttribute(starCol, 3));
          const starMat = new THREE.PointsMaterial({
            size: R * 0.048,
            map: createRoundParticleTexture(),
            vertexColors: true,
            transparent: true,
            opacity: 0.90,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });
          const starPts = new THREE.Points(starGeo, starMat);
          starPts.raycast = () => {};
          mesh.add(starPts);
        } else if (item.id === "earendel") {
          // Delicate JWST Sunrise Arc: razor-thin lensed crimson-amber filament + subtle knots + crisp pinpoint star
          const arcSpan = item.size * 5.8;
          const arcCurve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(-arcSpan * 0.45, -arcSpan * 0.85, -arcSpan * 0.08),
            new THREE.Vector3(arcSpan * 0.06, 0, arcSpan * 0.08),
            new THREE.Vector3(arcSpan * 0.42, arcSpan * 0.88, -arcSpan * 0.05)
          );

          // Subtle continuous crimson lensing filament
          const ribbonPts = arcCurve.getPoints(80);
          const ribbonGeo = new THREE.BufferGeometry().setFromPoints(ribbonPts);
          const ribbonMat = new THREE.LineBasicMaterial({
            color: 0xe15242,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });
          const ribbonLine = new THREE.Line(ribbonGeo, ribbonMat);
          ribbonLine.raycast = () => {};
          mesh.add(ribbonLine);

          // Fine-grained glowing lensed star-stream particles along the arc
          const arcCount = 220;
          const arcPos = new Float32Array(arcCount * 3);
          const arcCol = new Float32Array(arcCount * 3);
          const cRed = new THREE.Color(0xf4725a);
          const cDim = new THREE.Color(0x6b141c);
          const cTmp = new THREE.Color();
          for (let k = 0; k < arcCount; k++) {
            const t = k / (arcCount - 1);
            const pt = arcCurve.getPoint(t);
            const jitter = item.size * 0.08;
            arcPos[k * 3]     = pt.x + (Math.random() - 0.5) * jitter;
            arcPos[k * 3 + 1] = pt.y + (Math.random() - 0.5) * jitter;
            arcPos[k * 3 + 2] = pt.z + (Math.random() - 0.5) * jitter;
            const edgeFade = Math.pow(Math.sin(t * Math.PI), 0.7);
            cTmp.lerpColors(cDim, cRed, edgeFade);
            arcCol[k * 3] = cTmp.r; arcCol[k * 3 + 1] = cTmp.g; arcCol[k * 3 + 2] = cTmp.b;
          }
          const arcGeo = new THREE.BufferGeometry();
          arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPos, 3));
          arcGeo.setAttribute('color', new THREE.BufferAttribute(arcCol, 3));
          const arcMat = new THREE.PointsMaterial({
            size: item.size * 0.24,
            map: createRoundParticleTexture(),
            vertexColors: true,
            transparent: true,
            opacity: 0.78,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });
          const sunriseArc = new THREE.Points(arcGeo, arcMat);
          sunriseArc.raycast = () => {};
          mesh.add(sunriseArc);

          // Tiny, subtle redshifted star-cluster knots along the arc
          [0.24, 0.42, 0.72, 0.84].forEach((t) => {
            const knot = makeFractalNodeSprite('rgba(240, 125, 105, 0.55)', item.size * 0.55);
            knot.position.copy(arcCurve.getPoint(t));
            knot.raycast = () => {};
            mesh.add(knot);
          });

          // Earendel itself: single crisp, small pinpoint star on the arc
          const earendelPin = makeFractalNodeSprite('rgba(255, 240, 224, 0.98)', item.size * 0.95);
          earendelPin.position.copy(arcCurve.getPoint(0.56));
          earendelPin.raycast = () => {};
          mesh.add(earendelPin);
        } else if (item.id === "alpha-centauri") {
          alphaCentauriGroup = new THREE.Group();
          alphaCentauriGroup.position.set(item.position[0], item.position[1], item.position[2]);
          alphaCentauriGroup.userData = item;

          const starAGeo = new THREE.SphereGeometry(1.2, 32, 32);
          const starAMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
          alphaCenAMesh = new THREE.Mesh(starAGeo, starAMat);
          alphaCenAMesh.userData = {
            id: "rigil-kentaurus",
            name: "Rigil Kentaurus (Alpha Centauri A)",
            type: "Main-Sequence Yellow Dwarf (G2V)",
            distance: "4.37 ly",
            scale_order: "10^16 m (~4.37 ly)",
            tier: 2,
            size: 1.2,
            summary: "The primary star of the Alpha Centauri system, possessing 1.10 solar masses and 1.52 times the Sun's luminosity."
          };
          const glowA = makeFractalNodeSprite('rgba(254, 240, 138, 0.85)', 3.6);
          alphaCenAMesh.add(glowA);

          const starBGeo = new THREE.SphereGeometry(0.95, 32, 32);
          const starBMat = new THREE.MeshBasicMaterial({ color: 0xfb923c });
          alphaCenBMesh = new THREE.Mesh(starBGeo, starBMat);
          alphaCenBMesh.userData = {
            id: "toliman",
            name: "Toliman (Alpha Centauri B)",
            type: "Main-Sequence Orange Dwarf (K1V)",
            distance: "4.37 ly",
            scale_order: "10^16 m (~4.37 ly)",
            tier: 2,
            size: 0.95,
            summary: "The secondary star of the binary pair, orbiting Rigil Kentaurus every 79.9 years at an average distance of 23 AU."
          };
          const glowB = makeFractalNodeSprite('rgba(251, 146, 60, 0.8)', 2.8);
          alphaCenBMesh.add(glowB);

          const proxGeo = new THREE.SphereGeometry(0.4, 24, 24);
          const proxMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
          proximaMesh = new THREE.Mesh(proxGeo, proxMat);
          proximaMesh.userData = {
            id: "proxima-centauri",
            name: "Proxima Centauri (Alpha Centauri C)",
            type: "Red Dwarf / Flare Star (M5.5Ve)",
            distance: "4.246 ly (Closest Star to Sun)",
            scale_order: "10^16 m (~4.25 ly)",
            tier: 2,
            size: 0.4,
            summary: "The closest individual star to our Solar System, slowly looping the central A/B binary pair on a massive 550,000-year orbit."
          };
          const glowProx = makeFractalNodeSprite('rgba(239, 68, 68, 0.75)', 1.5);
          proximaMesh.add(glowProx);

          const abOrbitCurve = new THREE.EllipseCurve(0, 0, 7.5, 7.5, 0, 2 * Math.PI, false, 0);
          const abPoints = abOrbitCurve.getPoints(96);
          const abOrbitGeo = new THREE.BufferGeometry().setFromPoints(abPoints.map(p => new THREE.Vector3(p.x, -p.y * 0.25, p.y)));
          const abOrbitLine = new THREE.Line(abOrbitGeo, new THREE.LineBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.16, depthWrite: false }));
          abOrbitLine.raycast = () => {};

          const proxOrbitCurve = new THREE.EllipseCurve(0, 0, 46.0, 40.0, 0, 2 * Math.PI, false, 0);
          const proxPoints = proxOrbitCurve.getPoints(128);
          const proxOrbitGeo = new THREE.BufferGeometry().setFromPoints(proxPoints.map(p => new THREE.Vector3(p.x, p.y * 0.2, p.y)));
          const proxOrbitLine = new THREE.Line(proxOrbitGeo, new THREE.LineBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.12, depthWrite: false }));
          proxOrbitLine.raycast = () => {};
          proxOrbitLine.add(abOrbitLine);
          alphaCentauriGroup.add(proxOrbitLine);
          alphaCentauriGroup.userData.orbitLine = proxOrbitLine;

          alphaCentauriGroup.add(alphaCenAMesh);
          alphaCentauriGroup.add(alphaCenBMesh);
          alphaCentauriGroup.add(proximaMesh);
          scene.add(alphaCentauriGroup);

          celestialObjects.push(alphaCenAMesh);
          celestialObjects.push(alphaCenBMesh);
          celestialObjects.push(proximaMesh);
          rotatableObjects.push(alphaCenAMesh);
          rotatableObjects.push(alphaCenBMesh);
          return;
        } else if (item.id === "sirius") {
          siriusBarycenterGroup = new THREE.Group();
          siriusBarycenterGroup.position.set(item.position[0], item.position[1], item.position[2]);
          siriusBarycenterGroup.userData = item;

          siriusAMesh = mesh;
          const glowA = makeFractalNodeSprite('rgba(186, 230, 253, 0.85)', item.size * 3.5);
          siriusAMesh.add(glowA);

          const siriusBGeo = new THREE.SphereGeometry(0.55, 32, 32);
          const siriusBMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
          siriusBMesh = new THREE.Mesh(siriusBGeo, siriusBMat);
          siriusBMesh.userData = {
            id: "sirius-b",
            name: "Sirius B (The Pup)",
            type: "Degenerate White Dwarf (DA2)",
            distance: "8.60 ly (Sirius Barycenter)",
            scale_order: "10^17 m (~8.6 ly)",
            tier: 2,
            size: 0.55,
            summary: "A degenerate carbon-oxygen white dwarf companion packed with 1.02 solar masses into a radius smaller than Earth, orbiting Sirius A every 50.1 years."
          };
          const glowB = makeFractalNodeSprite('rgba(147, 197, 253, 0.85)', 2.4);
          siriusBMesh.add(glowB);

          const binaryOrbitCurve = new THREE.EllipseCurve(0, 0, 15.5, 9.3, 0, 2 * Math.PI, false, 0);
          const binaryPoints = binaryOrbitCurve.getPoints(120);
          const binaryOrbitGeo = new THREE.BufferGeometry().setFromPoints(binaryPoints.map(p => new THREE.Vector3(p.x, -p.y * 0.5, p.y)));
          const binaryOrbitLine = new THREE.Line(binaryOrbitGeo, new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.42 }));
          binaryOrbitLine.raycast = () => {};
          siriusBarycenterGroup.add(binaryOrbitLine);
          siriusBarycenterGroup.userData.orbitLine = binaryOrbitLine;

          siriusBarycenterGroup.add(siriusAMesh);
          siriusBarycenterGroup.add(siriusBMesh);
          scene.add(siriusBarycenterGroup);

          celestialObjects.push(siriusAMesh);
          celestialObjects.push(siriusBMesh);
          rotatableObjects.push(siriusAMesh);
          return;
        } else if (item.id === "betelgeuse") {
          // Red Supergiant (M1-2 Ia-ab): warm photosphere corona + asymmetric ALMA/VLT dusty outflow plume
          const glow = makeFractalNodeSprite('rgba(239, 68, 68, 0.78)', item.size * 3.8);
          glow.raycast = () => {};
          mesh.add(glow);

          const plume1 = makeFractalNodeSprite('rgba(234, 88, 12, 0.34)', item.size * 4.8);
          plume1.position.set(item.size * 0.75, -item.size * 0.45, item.size * 0.2);
          plume1.raycast = () => {};
          mesh.add(plume1);

          const plume2 = makeFractalNodeSprite('rgba(180, 45, 30, 0.26)', item.size * 5.6);
          plume2.position.set(-item.size * 0.55, item.size * 0.35, -item.size * 0.3);
          plume2.raycast = () => {};
          mesh.add(plume2);
        } else if (item.id === "polaris") {
          // F7Ib Cepheid Triple-Star System: luminous yellow-gold Aa + close Ab + wider B companion
          const glow = makeFractalNodeSprite('rgba(254, 240, 138, 0.82)', item.size * 3.6);
          glow.raycast = () => {};
          mesh.add(glow);

          const compAb = makeFractalNodeSprite('rgba(254, 249, 195, 0.92)', item.size * 0.85);
          compAb.position.set(item.size * 1.9, item.size * 0.35, item.size * 0.4);
          compAb.raycast = () => {};
          mesh.add(compAb);

          const compB = makeFractalNodeSprite('rgba(224, 242, 254, 0.90)', item.size * 1.05);
          compB.position.set(-item.size * 3.8, -item.size * 0.9, -item.size * 1.1);
          compB.raycast = () => {};
          mesh.add(compB);
        } else if (item.id === "trappist-1") {
          // Ultra-Cool Red Dwarf (M8V) + 7 compact, coplanar Earth-sized exoplanets (b-h)
          const glow = makeFractalNodeSprite('rgba(225, 29, 72, 0.72)', item.size * 3.0);
          glow.raycast = () => {};
          mesh.add(glow);

          const sysGroup = new THREE.Group();
          sysGroup.rotation.set(0.32, 0.15, -0.18);
          const planets = [
            { r: 1.75, ang: 0.4,  col: 0xfca5a5, s: 0.13 }, // b
            { r: 2.10, ang: 1.9,  col: 0xfdba74, s: 0.14 }, // c
            { r: 2.50, ang: 3.6,  col: 0xfde68a, s: 0.12 }, // d
            { r: 2.95, ang: 5.1,  col: 0x38bdf8, s: 0.14 }, // e (habitable zone)
            { r: 3.45, ang: 1.1,  col: 0x60a5fa, s: 0.15 }, // f (habitable zone)
            { r: 4.00, ang: 2.8,  col: 0x93c5fd, s: 0.16 }, // g (habitable zone)
            { r: 4.65, ang: 4.5,  col: 0xcbd5e1, s: 0.12 }  // h (outer ice world)
          ];
          planets.forEach((p) => {
            const rad = item.size * p.r;
            const curve = new THREE.EllipseCurve(0, 0, rad, rad);
            const pts = curve.getPoints(64).map((v) => new THREE.Vector3(v.x, 0, v.y));
            const ring = new THREE.LineLoop(
              new THREE.BufferGeometry().setFromPoints(pts),
              new THREE.LineBasicMaterial({ color: 0xfda4af, transparent: true, opacity: 0.24, depthWrite: false })
            );
            ring.raycast = () => {};
            sysGroup.add(ring);

            const pMesh = new THREE.Mesh(
              new THREE.SphereGeometry(item.size * p.s, 12, 12),
              new THREE.MeshBasicMaterial({ color: p.col })
            );
            pMesh.position.set(Math.cos(p.ang) * rad, 0, Math.sin(p.ang) * rad);
            pMesh.raycast = () => {};
            sysGroup.add(pMesh);
          });
          mesh.add(sysGroup);
        } else if (item.id === "barnards-star") {
          // Solitary M4.0V Red Dwarf: tight, deep crimson-orange chromospheric glow
          const glow = makeFractalNodeSprite('rgba(239, 68, 68, 0.65)', item.size * 2.9);
          glow.raycast = () => {};
          mesh.add(glow);
        } else if (item.id === "orion-nebula") {
          const nebulaAura = makeFractalNodeSprite('rgba(236, 72, 153, 0.45)', item.size * 5.5);
          mesh.add(nebulaAura);
        } else if (item.id === "crab-nebula") {
          const pulsarAura = makeFractalNodeSprite('rgba(168, 85, 247, 0.55)', item.size * 5.2);
          mesh.add(pulsarAura);

          crabPulsarBeams = new THREE.Group();
          const beamGeo = new THREE.ConeGeometry(0.5, item.size * 5.0, 16, 1, true);
          const beamMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });

          const topBeam = new THREE.Mesh(beamGeo, beamMat);
          topBeam.position.y = item.size * 2.5;
          topBeam.raycast = () => {};
          crabPulsarBeams.add(topBeam);

          const bottomBeam = new THREE.Mesh(beamGeo, beamMat);
          bottomBeam.rotation.x = Math.PI;
          bottomBeam.position.y = -item.size * 2.5;
          bottomBeam.raycast = () => {};
          crabPulsarBeams.add(bottomBeam);

          crabPulsarBeams.rotation.z = Math.PI / 4.5;
          crabPulsarBeams.raycast = () => {};
          mesh.add(crabPulsarBeams);
        }

        if (item.id === "lmc") {
          const lmcAura = makeFractalNodeSprite('rgba(56, 189, 248, 0.45)', item.size * 5.0);
          mesh.add(lmcAura);
        } else if (item.id === "smc") {
          const smcAura = makeFractalNodeSprite('rgba(129, 140, 248, 0.4)', item.size * 4.5);
          mesh.add(smcAura);
        } else if (item.id === "centaurus-a") {
          cenAJetGroup = new THREE.Group();
          const coneLength = item.size * 3.8;

          const jetMat = new THREE.MeshBasicMaterial({
            color: 0xf97316,
            transparent: true,
            opacity: 0.45,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });

          const topJetGeo = new THREE.ConeGeometry(item.size * 0.45, coneLength, 24, 1, true);
          const topJet = new THREE.Mesh(topJetGeo, jetMat);
          topJet.position.y = coneLength * 0.5;
          topJet.raycast = () => {};
          cenAJetGroup.add(topJet);

          const bottomJetGeo = new THREE.ConeGeometry(item.size * 0.45, coneLength, 24, 1, true);
          const bottomJet = new THREE.Mesh(bottomJetGeo, jetMat);
          bottomJet.rotation.x = Math.PI;
          bottomJet.position.y = -coneLength * 0.5;
          bottomJet.raycast = () => {};
          cenAJetGroup.add(bottomJet);

          const knotGeo = new THREE.SphereGeometry(item.size * 0.12, 12, 12);
          const knotMat = new THREE.MeshBasicMaterial({
            color: 0xfef08a,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });

          for (let k = 0; k < 6; k++) {
            const isTop = (k % 2 === 0);
            const knotMesh = new THREE.Mesh(knotGeo, knotMat);
            knotMesh.raycast = () => {};
            cenAJetGroup.add(knotMesh);

            cenAPlasmaKnots.push({
              mesh: knotMesh,
              progress: (k / 6),
              isTop: isTop,
              maxDist: coneLength * 0.95,
              speed: 0.007 + Math.random() * 0.003
            });
          }

          cenAJetGroup.rotation.z = Math.PI / 3.4;
          cenAJetGroup.rotation.x = Math.PI / 6.0;
          cenAJetGroup.raycast = () => {};
          mesh.add(cenAJetGroup);
        } else if (item.id === "great-attractor") {
          const attractorAura = makeFractalNodeSprite('rgba(225, 29, 72, 0.55)', item.size * 6.0);
          mesh.add(attractorAura);
        }

        if (item.id === "smacs-0723") {
          // JWST First Deep Field: bright white-gold foreground cluster + concentric orange-red lensed arcs
          const coreCluster = makeFractalNodeSprite('rgba(255, 244, 214, 0.9)', item.size * 2.6);
          coreCluster.raycast = () => {};
          mesh.add(coreCluster);

          const cCount = 95;
          const cPos = new Float32Array(cCount * 3);
          for (let k = 0; k < cCount; k++) {
            const r = item.size * Math.pow(Math.random(), 1.4) * 1.65;
            const th = Math.random() * Math.PI * 2;
            const ph = Math.acos(2 * Math.random() - 1);
            cPos[k * 3] = r * Math.sin(ph) * Math.cos(th);
            cPos[k * 3 + 1] = r * Math.cos(ph);
            cPos[k * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
          }
          const cGeo = new THREE.BufferGeometry();
          cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
          const cPts = new THREE.Points(cGeo, new THREE.PointsMaterial({
            color: 0xfef08a,
            size: item.size * 0.28,
            map: createRoundParticleTexture(),
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          }));
          cPts.raycast = () => {};
          mesh.add(cPts);

          // 7 broken concentric orange-red gravitationally lensed arcs
          const arcs = [
            { r: 1.55, start: 0.2, len: 0.95, tiltX: 0.15, tiltY: 0.1, col: 0xf97316 },
            { r: 1.75, start: 2.1, len: 1.10, tiltX: -0.2, tiltY: 0.25, col: 0xea580c },
            { r: 2.05, start: 4.1, len: 0.85, tiltX: 0.25, tiltY: -0.15, col: 0xfb923c },
            { r: 2.35, start: 0.9, len: 0.75, tiltX: -0.1, tiltY: -0.2, col: 0xdc2626 },
            { r: 2.55, start: 3.1, len: 1.25, tiltX: 0.3, tiltY: 0.12, col: 0xf59e0b },
            { r: 2.85, start: 5.0, len: 0.90, tiltX: -0.25, tiltY: 0.18, col: 0xea580c },
            { r: 3.15, start: 1.6, len: 0.65, tiltX: 0.12, tiltY: -0.25, col: 0xdc2626 }
          ];
          arcs.forEach((a) => {
            const aGeo = new THREE.RingGeometry(item.size * a.r, item.size * (a.r + 0.11), 32, 1, a.start, a.len);
            const aMat = new THREE.MeshBasicMaterial({
              color: a.col,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.72,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            });
            const aMesh = new THREE.Mesh(aGeo, aMat);
            aMesh.rotation.set(a.tiltX, a.tiltY, 0);
            aMesh.raycast = () => {};
            mesh.add(aMesh);
          });
        } else if (item.id === "gn-z11") {
          // JWST/Hubble morphology: compact, irregular, clumpy redshifted smudge with bright core
          const core = makeFractalNodeSprite('rgba(255, 224, 218, 0.95)', item.size * 2.6);
          core.position.set(item.size * 0.15, -item.size * 0.2, 0);
          core.raycast = () => {};
          mesh.add(core);

          const clumps = [
            { pos: [-0.35, 0.65, 0.1],  s: 2.8, col: 'rgba(205, 72, 72, 0.72)' },
            { pos: [0.55, 0.25, -0.2],  s: 2.5, col: 'rgba(185, 58, 62, 0.68)' },
            { pos: [-0.55, -0.45, 0.2], s: 2.3, col: 'rgba(165, 45, 52, 0.62)' },
            { pos: [0.35, -0.65, -0.1], s: 2.2, col: 'rgba(195, 65, 65, 0.65)' },
            { pos: [-0.1, 1.15, -0.15], s: 1.9, col: 'rgba(150, 38, 46, 0.52)' },
            { pos: [0.85, -0.35, 0.15], s: 1.7, col: 'rgba(145, 35, 45, 0.48)' }
          ];
          clumps.forEach((c) => {
            const sp = makeFractalNodeSprite(c.col, item.size * c.s);
            sp.position.set(c.pos[0] * item.size, c.pos[1] * item.size, c.pos[2] * item.size);
            sp.raycast = () => {};
            mesh.add(sp);
          });
        } else if (item.id === "shapley-supercluster") {
          // Elongated multi-cluster concentration: 4 crimson-pink cores inside a diffuse teal-cyan halo
          const subClusters = [
            { pos: [1.6, 0.35, 0.1],   haloS: 5.2, coreS: 2.6 }, // Abell 3558 primary core
            { pos: [0.35, 0.05, -0.2], haloS: 3.8, coreS: 1.4 },
            { pos: [-0.75, -0.35, 0.2],haloS: 3.6, coreS: 1.2 },
            { pos: [-2.1, -0.1, -0.1], haloS: 4.2, coreS: 1.8 }
          ];
          subClusters.forEach((sc) => {
            const halo = makeFractalNodeSprite('rgba(34, 197, 212, 0.38)', item.size * sc.haloS);
            halo.position.set(sc.pos[0] * item.size, sc.pos[1] * item.size, sc.pos[2] * item.size);
            halo.raycast = () => {};
            mesh.add(halo);

            const core = makeFractalNodeSprite('rgba(244, 114, 140, 0.85)', item.size * sc.coreS);
            core.position.set(sc.pos[0] * item.size, sc.pos[1] * item.size, sc.pos[2] * item.size);
            core.raycast = () => {};
            mesh.add(core);
          });

          const sCount = 260;
          const sPos = new Float32Array(sCount * 3);
          for (let k = 0; k < sCount; k++) {
            const sc = subClusters[k % subClusters.length];
            const spread = item.size * 1.7;
            sPos[k * 3]     = sc.pos[0] * item.size + (Math.random() - 0.5) * spread * 1.4;
            sPos[k * 3 + 1] = sc.pos[1] * item.size + (Math.random() - 0.5) * spread;
            sPos[k * 3 + 2] = sc.pos[2] * item.size + (Math.random() - 0.5) * spread;
          }
          const sGeo = new THREE.BufferGeometry();
          sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
          const sPts = new THREE.Points(sGeo, new THREE.PointsMaterial({
            color: 0xe0f2fe,
            size: item.size * 0.22,
            map: createRoundParticleTexture(),
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          }));
          sPts.raycast = () => {};
          mesh.add(sPts);
        } else if (item.id === "el-gordo") {
          // Colliding dual-core galaxy cluster merger + swept-back Chandra X-ray cyan-blue shock tail
          const lobeA = makeFractalNodeSprite('rgba(255, 236, 179, 0.92)', item.size * 2.4);
          lobeA.position.set(item.size * 1.1, item.size * 0.25, 0);
          lobeA.raycast = () => {};
          mesh.add(lobeA);

          const lobeB = makeFractalNodeSprite('rgba(255, 224, 150, 0.85)', item.size * 2.0);
          lobeB.position.set(-item.size * 0.9, -item.size * 0.2, item.size * 0.15);
          lobeB.raycast = () => {};
          mesh.add(lobeB);

          // Swept-back X-ray shock plume
          [
            { x: 0.4, y: 0.1, s: 4.2, a: 0.65 },
            { x: -1.1, y: -0.3, s: 4.8, a: 0.50 },
            { x: -2.4, y: -0.65, s: 4.0, a: 0.32 }
          ].forEach((p) => {
            const plume = makeFractalNodeSprite(`rgba(37, 130, 246, ${p.a})`, item.size * p.s);
            plume.position.set(p.x * item.size, p.y * item.size, 0);
            plume.raycast = () => {};
            mesh.add(plume);
          });

          const gGeo = new THREE.BufferGeometry();
          const gCount = 220;
          const gPos = new Float32Array(gCount * 3);
          for (let k = 0; k < gCount; k++) {
            const center = (k % 2 === 0) ? 1.0 : -0.9;
            const spread = item.size * 2.1;
            gPos[k * 3]     = center * item.size + (Math.random() - 0.5) * spread * 1.5;
            gPos[k * 3 + 1] = (Math.random() - 0.5) * spread;
            gPos[k * 3 + 2] = (Math.random() - 0.5) * spread;
          }
          gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
          const gMat = new THREE.PointsMaterial({
            color: 0xfde047,
            size: item.size * 0.24,
            map: createRoundParticleTexture(),
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });
          const gPts = new THREE.Points(gGeo, gMat);
          gPts.raycast = () => {};
          mesh.add(gPts);
        } else if (item.id === "bootes-void") {
          // Spherical supervoid: ~45 sparse, dim galaxies inside a vast empty volume
          const voidGalaxiesGeo = new THREE.BufferGeometry();
          const voidGalaxiesCount = 45;
          const vPos = new Float32Array(voidGalaxiesCount * 3);
          for (let k = 0; k < voidGalaxiesCount; k++) {
            const r = item.size * Math.cbrt(Math.random()) * 1.15;
            const th = Math.random() * Math.PI * 2;
            const ph = Math.acos(2 * Math.random() - 1);
            vPos[k * 3]     = r * Math.sin(ph) * Math.cos(th);
            vPos[k * 3 + 1] = r * Math.cos(ph);
            vPos[k * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
          }
          voidGalaxiesGeo.setAttribute('position', new THREE.BufferAttribute(vPos, 3));
          const vMat = new THREE.PointsMaterial({
            color: 0x94a3b8,
            size: item.size * 0.16,
            map: createRoundParticleTexture(),
            transparent: true,
            opacity: 0.65,
            depthWrite: false
          });
          const vPts = new THREE.Points(voidGalaxiesGeo, vMat);
          vPts.raycast = () => {};
          mesh.add(vPts);
        }

        if (item.id === "sagittarius-a-star") {
          sagAGroup = new THREE.Group();
          sagAGroup.position.set(item.position[0], item.position[1], item.position[2]);
          sagAGroup.userData = item;

          const R = item.size; // 3.1

          // Diagonal relativistic tilt group (matches SS3 / SS4 / SS5 diagonal orientation)
          const sagATiltGroup = new THREE.Group();
          sagATiltGroup.rotation.z = 0.40;
          sagAGroup.add(sagATiltGroup);

          // 1. Pitch-Black Event Horizon Shadow Sphere
          const shadowGeo = new THREE.SphereGeometry(R, 64, 64);
          const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            depthWrite: true,
            depthTest: true
          });
          const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
          shadowMesh.userData = item;
          shadowMesh.renderOrder = 1;
          sagATiltGroup.add(shadowMesh);

          // 2. Gravitationally Lensed Einstein Arches (Upper & Lower Warped Disk Halo) + Razor-Sharp Photon Ring
          const lensedHaloCanvas = document.createElement("canvas");
          lensedHaloCanvas.width = 512;
          lensedHaloCanvas.height = 512;
          const lCtx = lensedHaloCanvas.getContext("2d");
          const lImg = lCtx.createImageData(512, 512);
          const lData = lImg.data;
          const rHoriz = 1.0 / 3.2; // Event horizon radius in normalized [-1,1] space

          for (let py = 0; py < 512; py++) {
            const ny = (py / 511) * 2.0 - 1.0; // -1 (top) to +1 (bottom)
            for (let px = 0; px < 512; px++) {
              const nx = (px / 511) * 2.0 - 1.0;
              const r2 = nx * nx + ny * ny;
              if (r2 >= 1.0) continue;
              const r = Math.sqrt(r2);
              const idx = (py * 512 + px) * 4;

              // Strictly transparent inside the black hole shadow so the 3D void stays pure #000000
              if (r < rHoriz * 0.992) {
                continue;
              }

              const absSin = Math.abs(ny) / Math.max(0.0001, r);
              const isUpper = ny < 0; // Canvas ny < 0 is +Y (upper arch)
              const angle = Math.atan2(ny, nx);

              // Relativistic Doppler beaming: approaching side (nx < 0) is hotter & brighter; receding side is dim ember-red
              const approach = Math.max(0.0, Math.min(1.0, 0.5 - 0.5 * (nx / Math.max(0.0001, r))));
              const dopplerBoost = 0.22 + 1.12 * Math.pow(approach, 1.6);

              // 1. Hair-thin relativistic Photon Ring (n=1 caustic) right at the shadow edge
              const photonDist = (r - rHoriz * 1.005) / (rHoriz * 0.0085);
              const photonRing = Math.exp(-photonDist * photonDist) * (0.48 + 0.68 * approach);

              // 2. Subtle, organic EHT-style asymmetrical ember ring (no tall Interstellar arches)
              const ringDist = (r - rHoriz * 1.06) / (rHoriz * 0.14);
              const organicNoise = 0.55 + 0.45 * Math.sin(angle * 3.0 + 0.8) * Math.cos(angle * 5.0 - 0.4);
              const emberRing = Math.exp(-ringDist * ringDist) * dopplerBoost * organicNoise * 0.52;

              let red   = photonRing * 255 + emberRing * 235;
              let green = photonRing * 195 + emberRing * 95;
              let blue  = photonRing * 115 + emberRing * 28;
              let alpha = Math.min(1.0, photonRing * 0.92 + emberRing * 0.82) * 255;

              lData[idx]     = Math.min(255, red | 0);
              lData[idx + 1] = Math.min(255, green | 0);
              lData[idx + 2] = Math.min(255, blue | 0);
              lData[idx + 3] = Math.min(255, alpha | 0);
            }
          }
          lCtx.putImageData(lImg, 0, 0);
          const lensedHaloTex = new THREE.CanvasTexture(lensedHaloCanvas);
          lensedHaloTex.colorSpace = THREE.SRGBColorSpace;
          lensedHaloTex.needsUpdate = true;

          const lensedHaloGeo = new THREE.PlaneGeometry(R * 6.4, R * 6.4);
          const lensedHaloMat = new THREE.MeshBasicMaterial({
            map: lensedHaloTex,
            transparent: true,
            opacity: 0.98,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true,
            side: THREE.DoubleSide
          });
          const lensedHaloMesh = new THREE.Mesh(lensedHaloGeo, lensedHaloMat);
          lensedHaloMesh.position.z = -R * 0.04;
          lensedHaloMesh.renderOrder = 2;
          lensedHaloMesh.raycast = () => {};
          sagATiltGroup.add(lensedHaloMesh);

          // Animated 3D S-Star Cluster & Gravitational Swirl orbiting Sagittarius A* (Keplerian acceleration near shadow)
          const sagSwarmCount = 340;
          const sagSwarmPos = new Float32Array(sagSwarmCount * 3);
          const sagSwarmCol = new Float32Array(sagSwarmCount * 3);
          const sagSwarmMeta = [];
          for (let k = 0; k < sagSwarmCount; k++) {
            const rNorm = 1.35 + Math.pow(Math.random(), 1.4) * 4.2;
            const rad = R * rNorm;
            const ang = Math.random() * Math.PI * 2;
            const incl = (Math.random() - 0.5) * 1.45;
            const speed = (0.025 / Math.pow(rNorm, 1.35)) * (0.8 + Math.random() * 0.4);
            sagSwarmMeta.push({ rad, ang, incl, speed });
            sagSwarmPos[k * 3]     = Math.cos(ang) * rad;
            sagSwarmPos[k * 3 + 1] = Math.sin(ang) * rad * Math.sin(incl);
            sagSwarmPos[k * 3 + 2] = Math.sin(ang) * rad * Math.cos(incl);
            const c = (k % 4 === 0) ? new THREE.Color(0xbae6fd) : ((k % 3 === 0) ? new THREE.Color(0xfde68a) : new THREE.Color(0xf1f5f9));
            sagSwarmCol[k * 3] = c.r; sagSwarmCol[k * 3 + 1] = c.g; sagSwarmCol[k * 3 + 2] = c.b;
          }
          const sagSwarmGeo = new THREE.BufferGeometry();
          sagSwarmGeo.setAttribute('position', new THREE.BufferAttribute(sagSwarmPos, 3));
          sagSwarmGeo.setAttribute('color', new THREE.BufferAttribute(sagSwarmCol, 3));
          const sagSwarmPts = new THREE.Points(sagSwarmGeo, new THREE.PointsMaterial({
            size: R * 0.11,
            map: createRoundParticleTexture(),
            vertexColors: true,
            transparent: true,
            opacity: 0.76,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          }));
          sagSwarmPts.userData.swarmMeta = sagSwarmMeta;
          sagSwarmPts.raycast = () => {};
          sagATiltGroup.add(sagSwarmPts);
          window._sagASwarm = sagSwarmPts;

          // 3. 3D Relativistic Equatorial Accretion Disk with Multi-Band Plasma Streams (SS3, SS4, SS5)
          const diskCanvas = document.createElement("canvas");
          diskCanvas.width = 512;
          diskCanvas.height = 512;
          const dCtx = diskCanvas.getContext("2d");
          const dImg = dCtx.createImageData(512, 512);
          const dData = dImg.data;
          const rDiskInner = 0.265; // Wide dark ISCO plunge gap around the stark event horizon shadow
          const rDiskOuter = 0.985;

          for (let py = 0; py < 512; py++) {
            const ny = (py / 511) * 2.0 - 1.0;
            for (let px = 0; px < 512; px++) {
              const nx = (px / 511) * 2.0 - 1.0;
              const r2 = nx * nx + ny * ny;
              if (r2 >= 1.0) continue;
              const r = Math.sqrt(r2);
              if (r < rDiskInner * 0.95) continue;

              const u = Math.max(0, (r - rDiskInner) / (rDiskOuter - rDiskInner));
              if (u >= 1.0) continue;

              const theta = Math.atan2(ny, nx);
              // Seamless spiral Keplerian shear coordinates
              const spiralPhase = theta + 11.5 * Math.pow(1.0 - u, 1.35);
              const sx = Math.cos(spiralPhase);
              const sy = Math.sin(spiralPhase);

              const turb1 = Math.sin(sx * 4.0 + u * 28.0) * Math.cos(sy * 4.0 - u * 22.0);
              const turb2 = Math.sin( theta * 3.0 + u * 52.0 ) * 0.5 + Math.cos(theta * 7.0 - u * 85.0) * 0.5;

              // Concentric glowing plasma bands separated by dark magnetorotational grooves (SS3, SS4)
              const band1 = Math.sin(u * 88.0 + turb1 * 2.4) * 0.5 + 0.5;
              const band2 = Math.sin(u * 195.0 + turb2 * 2.8) * 0.5 + 0.5;
              const band3 = Math.pow(Math.sin(u * 42.0 + turb1 * 1.5) * 0.5 + 0.5, 1.4);
              const grooveMask = 0.32 + 0.68 * Math.pow(band1 * 0.50 + band2 * 0.30 + band3 * 0.20, 0.85);

              // Smooth inner turn-on at ISCO and smooth outer feathering
              const innerFade = Math.min(1.0, Math.max(0.0, (r - rDiskInner * 0.95) / (rDiskInner * 0.08)));
              const outerFade = Math.pow(1.0 - u, 1.55);
              // Relativistic Doppler beaming (brighter on approaching left/front wing)
              const dopplerBoost = 1.0 - 0.16 * (nx / r);

              let cR, cG, cB;
              const ribbonTint = Math.sin(u * 64.0 + theta * 2.0) * 0.5 + 0.5;

              if (u < 0.075) {
                const t = u / 0.075;
                cR = 135 + t * 120;
                cG = 165 + t * 85;
                cB = 255;
              } else if (u < 0.36) {
                const t = (u - 0.075) / 0.285;
                const violetStreak = (1.0 - t) * Math.pow(ribbonTint, 1.8) * 0.38;
                cR = 255;
                cG = (242 - t * 52) * (1.0 - violetStreak * 0.28);
                cB = (205 - t * 105) + violetStreak * 95;
              } else if (u < 0.74) {
                const t = (u - 0.36) / 0.38;
                cR = 255 - t * 18;
                cG = 190 - t * 92;
                cB = 100 - t * 68 + Math.pow(ribbonTint, 2.0) * 28 * (1.0 - t);
              } else {
                const t = (u - 0.74) / 0.26;
                cR = 237 - t * 115;
                cG = 98 - t * 68;
                cB = 32 - t * 22;
              }

              // Embedded hot white-blue magnetic reconnection flare knots in inner disk (SS4)
              let flareBoost = 0.0;
              if (u > 0.02 && u < 0.28) {
                const fAng1 = Math.atan2(ny, nx) - 1.15;
                const fAng2 = Math.atan2(ny, nx) - 1.85;
                const fAng3 = Math.atan2(ny, nx) - 0.55;
                const d1 = Math.hypot((u - 0.09) * 5.5, Math.sin(fAng1 * 0.5) * 2.4);
                const d2 = Math.hypot((u - 0.15) * 5.0, Math.sin(fAng2 * 0.5) * 2.8);
                const d3 = Math.hypot((u - 0.12) * 5.5, Math.sin(fAng3 * 0.5) * 3.0);
                flareBoost = Math.exp(-d1 * d1 * 9.0) + Math.exp(-d2 * d2 * 10.0) * 0.85 + Math.exp(-d3 * d3 * 11.0) * 0.75;
              }

              const lum = grooveMask * dopplerBoost * (0.78 + 0.42 * band1);
              const finalR = Math.min(255, cR * lum + flareBoost * 235);
              const finalG = Math.min(255, cG * lum + flareBoost * 248);
              const finalB = Math.min(255, cB * lum + flareBoost * 255);
              const finalA = Math.min(255, innerFade * outerFade * (0.45 + 0.55 * grooveMask + flareBoost * 0.5) * 250);

              const idx = (py * 512 + px) * 4;
              dData[idx]     = finalR | 0;
              dData[idx + 1] = finalG | 0;
              dData[idx + 2] = finalB | 0;
              dData[idx + 3] = finalA | 0;
            }
          }
          dCtx.putImageData(dImg, 0, 0);
          const sagADiskTex = new THREE.CanvasTexture(diskCanvas);
          sagADiskTex.colorSpace = THREE.SRGBColorSpace;
          sagADiskTex.needsUpdate = true;

          // Pitch group tilts the equatorial disk nearly edge-on (-78.3 deg) so the front half
          // sweeps across the lower-front of the black sphere (SS3, SS4, SS5)
          const sagADiskPitchGroup = new THREE.Group();
          sagADiskPitchGroup.rotation.x = -Math.PI * 0.435;
          sagATiltGroup.add(sagADiskPitchGroup);

          const diskGeo = new THREE.PlaneGeometry(R * 10.6, R * 10.6);
          const diskMat = new THREE.MeshBasicMaterial({
            map: sagADiskTex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.98,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true
          });
          sagAAccretionDisk = new THREE.Mesh(diskGeo, diskMat);
          sagAAccretionDisk.renderOrder = 3;
          sagAAccretionDisk.raycast = () => {};
          sagADiskPitchGroup.add(sagAAccretionDisk);

          // Secondary volumetric disk thickness layer for rich edge-on depth
          const thickDiskMat = new THREE.MeshBasicMaterial({
            map: sagADiskTex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.42,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true
          });
          const thickDiskMesh = new THREE.Mesh(diskGeo, thickDiskMat);
          thickDiskMesh.rotation.x = 0.055;
          thickDiskMesh.rotation.y = -0.045;
          thickDiskMesh.scale.setScalar(1.04);
          thickDiskMesh.renderOrder = 3;
          thickDiskMesh.raycast = () => {};
          sagAAccretionDisk.add(thickDiskMesh);

          // 4. Volumetric White-Blue & Golden Magnetic Reconnection Plasma Flares on Inner Disk (SS4)
          const flareCloudTex = createProceduralCloudTexture((ctx, s) => {
            const cx = s / 2, cy = s / 2;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.48);
            grad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
            grad.addColorStop(0.22, "rgba(215, 240, 255, 0.85)");
            grad.addColorStop(0.52, "rgba(125, 185, 255, 0.32)");
            grad.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, s * 0.48, 0, Math.PI * 2);
            ctx.fill();
          }, 128);

          const flareCount = 6;
          for (let f = 0; f < flareCount; f++) {
            const fSprite = new THREE.Sprite(new THREE.SpriteMaterial({
              map: flareCloudTex,
              color: (f % 2 === 0) ? 0xe0f2fe : 0xfef3c7,
              transparent: true,
              opacity: 0.88,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            }));
            const flareScale = R * (0.62 + (f % 3) * 0.22);
            fSprite.scale.set(flareScale * 1.35, flareScale * 0.85, 1);
            fSprite.renderOrder = 4;
            fSprite.raycast = () => {};
            sagATiltGroup.add(fSprite);

            sagAPlasmaFlares.push({
              mesh: fSprite,
              radius: R * (1.22 + f * 0.28),
              angle: (f / flareCount) * Math.PI * 2,
              speed: 0.018 - f * 0.0018
            });
          }

          scene.add(sagAGroup);
          celestialObjects.push(shadowMesh);
          rotatableObjects.push(shadowMesh);
          return;
        }

        const isPlanetaryOrbiter = item.tier === 1 && !["sun", "moon", "sedna", "halley-comet", "oumuamua"].includes(item.id);

        if (isPlanetaryOrbiter) {
          const orbitRadius = Math.sqrt(item.position[0]**2 + item.position[2]**2) * 1.45;
          const nov2026HeliocentricDeg = {
            "mercury": 27.0,
            "venus":   34.0,
            "earth":   39.0,
            "mars":    115.0,
            "ceres":   82.0,
            "jupiter": 134.0,
            "saturn":  11.0,
            "uranus":  63.0,
            "neptune": 2.0
          };
          const eclipDeg = (nov2026HeliocentricDeg[item.id] !== undefined)
            ? nov2026HeliocentricDeg[item.id]
            : (index * 137.5) % 360;
          const startAngle = ((195.0 - eclipDeg) * Math.PI) / 180.0;

          mesh.position.set(
            Math.cos(startAngle) * orbitRadius,
            0,
            Math.sin(startAngle) * orbitRadius
          );

          const obliquityDeg = {
            "mercury": 0.03, "venus": 177.36, "earth": 23.44, "mars": 25.19,
            "ceres": 4.0, "jupiter": 3.13, "saturn": 26.73, "uranus": 97.77, "neptune": 28.32
          };
          if (obliquityDeg[item.id] !== undefined && item.id !== "uranus") {
            mesh.rotation.z = (obliquityDeg[item.id] * Math.PI) / 180.0;
          }
          mesh.userData.spinSpeed = (item.id === "venus") ? -0.0015 :
                                    (item.id === "uranus") ? -0.006 :
                                    (item.id === "jupiter" || item.id === "saturn") ? 0.009 : 0.005;

          const orbitalSpeed = (0.04 / Math.pow(orbitRadius, 0.7));
          orbitingPlanets.push({
            mesh: mesh,
            radius: orbitRadius,
            angle: startAngle,
            speed: orbitalSpeed
          });

          const orbitCurve = new THREE.EllipseCurve(0, 0, orbitRadius, orbitRadius);
          const orbitPoints = orbitCurve.getPoints(120);
          const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints.map(p => new THREE.Vector3(p.x, p.y * 0.0, p.y)));
          const orbitMat = new THREE.LineBasicMaterial({
            color: (item.id === "ceres") ? 0x64748b : 0x334155,
            transparent: true,
            opacity: 0.35
          });
          const orbitLine = new THREE.Line(orbitGeo, orbitMat);
          orbitLine.raycast = () => {};
          orbitLine.frustumCulled = false;
          scene.add(orbitLine);
          mesh.userData.orbitLine = orbitLine;

          if (item.id === "saturn") {
            const innerR = item.size * 1.32;
            const outerR = item.size * 2.42;
            const saturnRingGeo = new THREE.RingGeometry(innerR, outerR, 96);
            const saturnRingMat = new THREE.ShaderMaterial({
              uniforms: {
                uInnerR: { value: innerR },
                uOuterR: { value: outerR },
                uPlanetR: { value: item.size * 0.98 }
              },
              vertexShader: `
                varying vec3 vLocalPos;
                varying vec3 vWorldPos;
                varying vec3 vPlanetCenter;
                void main() {
                  vLocalPos = position;
                  vec4 wp = modelMatrix * vec4(position, 1.0);
                  vWorldPos = wp.xyz;
                  vPlanetCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
                  gl_Position = projectionMatrix * viewMatrix * wp;
                }
              `,
              fragmentShader: `
                uniform float uInnerR;
                uniform float uOuterR;
                uniform float uPlanetR;
                varying vec3 vLocalPos;
                varying vec3 vWorldPos;
                varying vec3 vPlanetCenter;

                void main() {
                  float r = length(vLocalPos.xy);
                  float t = clamp((r - uInnerR) / (uOuterR - uInnerR), 0.0, 1.0);

                  // Concentric ring structure + Cassini Division (~0.62-0.69) + Encke Gap (~0.87)
                  float fineBands = 0.78 + 0.22 * sin(t * 95.0) * cos(t * 37.0);
                  float cassini = 1.0 - smoothstep(0.60, 0.63, t) * (1.0 - smoothstep(0.67, 0.70, t)) * 0.88;
                  float encke   = 1.0 - smoothstep(0.86, 0.87, t) * (1.0 - smoothstep(0.88, 0.89, t)) * 0.65;
                  float edgeFade = smoothstep(0.0, 0.07, t) * (1.0 - smoothstep(0.93, 1.0, t));

                  vec3 colInner = vec3(0.68, 0.60, 0.48);
                  vec3 colMid   = vec3(0.88, 0.82, 0.70);
                  vec3 colOuter = vec3(0.62, 0.60, 0.56);
                  vec3 baseCol  = mix(colInner, colMid, smoothstep(0.05, 0.45, t));
                  baseCol       = mix(baseCol, colOuter, smoothstep(0.65, 0.95, t)) * fineBands;

                  // Real-time ray-sphere shadow cast by Saturn onto its own rings (Sun at origin)
                  vec3 toSun = normalize(-vWorldPos);
                  vec3 rel = vWorldPos - vPlanetCenter;
                  float proj = dot(rel, toSun);
                  float shadow = 1.0;
                  if (proj < 0.0) {
                    float perpDist = length(rel - toSun * proj);
                    shadow = smoothstep(uPlanetR * 0.96, uPlanetR * 1.06, perpDist);
                    shadow = mix(0.08, 1.0, shadow);
                  }

                  float alpha = clamp(0.82 * cassini * encke * edgeFade * (0.45 + 0.55 * fineBands), 0.0, 0.92);
                  gl_FragColor = vec4(baseCol * shadow, alpha);
                }
              `,
              side: THREE.DoubleSide,
              transparent: true,
              depthWrite: false
            });
            const saturnRing = new THREE.Mesh(saturnRingGeo, saturnRingMat);
            saturnRing.rotation.x = Math.PI / 2.3;
            saturnRing.raycast = () => {};
            mesh.add(saturnRing);
          }
        } else {
          applyCosmicDepthProportions(item);
        mesh.position.set(item.position[0], item.position[1], item.position[2]);

          if (item.id === "halley-comet") {
            const a = 18.0;
            const b = 6.8;
            const cx = 11.5;
            const cometCurve = new THREE.EllipseCurve(cx, 0, a, b, 0, 2 * Math.PI, false, 0);
            const points = cometCurve.getPoints(120);
            const cometGeo = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p.x, p.y * 0.35, p.y)));
            const cometMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 });
            const cometLine = new THREE.Line(cometGeo, cometMat);
            cometLine.raycast = () => {};
            scene.add(cometLine);
            mesh.userData.orbitLine = cometLine;

            halleyOrbitObj = {
              mesh: mesh,
              a: a,
              b: b,
              cx: cx,
              angle: 0.0
            };
          } else if (item.id === "oumuamua") {
            const hypPts = [];
            for (let t = -2.2; t <= 2.2; t += 0.05) {
              hypPts.push(getOumuamuaPosition(t));
            }
            const hypGeo = new THREE.BufferGeometry().setFromPoints(hypPts);
            const hypMat = new THREE.LineBasicMaterial({
              color: 0xf87171,
              transparent: true,
              opacity: 0.28
            });
            const hypLine = new THREE.Line(hypGeo, hypMat);
            hypLine.raycast = () => {};
            scene.add(hypLine);
            mesh.userData.orbitLine = hypLine;

            oumuamuaOrbitObj = {
              mesh: mesh,
              t: -2.0,
              speed: 0.0035
            };
          }
        }

        rotatableObjects.push(mesh);
        scene.add(mesh);

        if (item.id === 'earth' || (item.name && item.name.toLowerCase().includes('earth'))) {
          earthMeshRef = mesh;
          window.earthMeshRef = mesh;
        }
        if (item.id === 'moon' || (item.name && item.name.toLowerCase().includes('moon'))) {
          moonMeshRef = mesh;
          window.moonMeshRef = mesh;
          mesh.userData.isMoon = true;
        }

        celestialObjects.push(mesh);
      }

      function finalizeCatalogNodes(applyTexturesNow) {
        if (!_finalized) {
          _finalized = true;
          buildCelestialObjectLabels();
          if (typeof onComplete === 'function') onComplete();
        }
        if (applyTexturesNow && !window._texturesInitialized && typeof applyCharacteristicTexturesToScene === 'function') {
          applyCharacteristicTexturesToScene();
          window._texturesInitialized = true;
        }
      }

      if (document.documentElement.classList.contains("is-booting") && localStorage.getItem("hasBootedSession") !== "true") {
        const scheduleIdle = window.requestIdleCallback
          ? (fn) => window.requestIdleCallback(fn, { timeout: 120 })
          : (fn) => setTimeout(fn, 24);

        const processBatch = () => {
          const t0 = performance.now();
          // 2.5ms idle budget prevents even micro-hitches on the boot cursor
          while (_nodeIdx < catalog.length && performance.now() - t0 < 2.5) {
            buildSingleCatalogNode(catalog[_nodeIdx], _nodeIdx);
            _nodeIdx++;
          }
          if (_nodeIdx < catalog.length) {
            scheduleIdle(processBatch);
          }
          // Hold buildCelestialObjectLabels() + 4K textures until portal click flush
        };

        window._flushNovaCatalogNodes = () => {
          while (_nodeIdx < catalog.length) {
            buildSingleCatalogNode(catalog[_nodeIdx], _nodeIdx);
            _nodeIdx++;
          }
          finalizeCatalogNodes(true);
        };

        requestAnimationFrame(processBatch);
      } else {
        for (let i = 0; i < catalog.length; i++) {
          buildSingleCatalogNode(catalog[i], i);
        }
        finalizeCatalogNodes(true);
      }
    }

    // === MINIMALIST PRIMARY NAME LABELS & ORBITAL TRACKING ===
    function getPrimaryCelestialName(data) {
      if (!data) return "";
      const id = (data.id || "").toLowerCase();
      if (PRIMARY_CELESTIAL_NAMES[id]) return PRIMARY_CELESTIAL_NAMES[id];
      const raw = data.name || data.title || "";
      return raw
        .replace(/\s*\([^)]*\)/g, "")
        .replace(/\s*&\s*Pulsar/gi, "")
        .replace(/^(?:The\s+|\d+\s+|\d+[A-Z]\/)/i, "")
        .trim()
        .toUpperCase();
    }

    function buildCelestialObjectLabels() {
      const layer = document.getElementById("celestial-labels-layer");
      if (!layer) return;
      layer.innerHTML = "";
      celestialLabelEntries = [];
      celestialLabelById.clear();

      celestialObjects.forEach((mesh) => {
        if (!mesh || !mesh.userData) return;
        const data = mesh.userData;
        const primaryName = getPrimaryCelestialName(data);
        if (!primaryName) return;

        const id = (data.id || "").toLowerCase();
        const el = document.createElement("div");
        el.className = MINOR_CELESTIAL_LABEL_IDS.has(id)
          ? "celestial-label celestial-label--minor"
          : "celestial-label";
        el.style.display = "none";
        el.textContent = primaryName;
        el.dataset.objectId = id;

        el.addEventListener("pointerenter", () => {
          hoveredCelestialMesh = mesh;
        });
        el.addEventListener("pointerleave", () => {
          if (hoveredCelestialMesh === mesh) hoveredCelestialMesh = null;
        });
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          activeTargetMesh = mesh;
          if (isPlanetOverviewEnabled) {
            openInspector(data);
          } else {
            activeTarget = data;
            window.dismissSpatialCallout();
          }
          smoothFlyToTarget();
        });

        layer.appendChild(el);
        const entry = {
          mesh: mesh,
          data: data,
          id: id,
          tier: Number(data.tier) || 1,
          el: el,
          visible: false,
          sx: 0,
          sy: 0,
          offsetX: 10,
          alpha: 1
        };
        celestialLabelEntries.push(entry);
        celestialLabelById.set(id, entry);
      });
    }

    function updateCelestialLabels(camDist) {
      if (isScreensaverActive) return;
      scene.updateMatrixWorld();

      // === 60FPS 3D-TO-2D SPATIAL HUD CALLOUT PROJECTION (Independent of LABELS toggle) ===
      if (typeof window.updateSpatialCalloutPosition === "function") {
        window.updateSpatialCalloutPosition();
      }

      if (!areLabelsVisible || !celestialLabelEntries.length) return;

      const halfW = window.innerWidth * 0.5;
      const halfH = window.innerHeight * 0.5;
      const fovTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);

      for (let i = 0; i < celestialLabelEntries.length; i++) {
        const entry = celestialLabelEntries[i];
        const mesh = entry.mesh;

        if (!isNodeVisible(mesh)) {
          if (entry.visible) {
            entry.el.style.display = "none";
            entry.visible = false;
          }
          continue;
        }

        mesh.getWorldPosition(_labelWorldPos);
        _labelProjVec.copy(_labelWorldPos).project(camera);

        // Hide if behind the camera or outside screen bounds
        if (
          _labelProjVec.z > 1.0 ||
          _labelProjVec.z < -1.0 ||
          _labelProjVec.x < -1.06 ||
          _labelProjVec.x > 1.06 ||
          _labelProjVec.y < -1.06 ||
          _labelProjVec.y > 1.06
        ) {
          if (entry.visible) {
            entry.el.style.display = "none";
            entry.visible = false;
          }
          continue;
        }

        const distToCam = camera.position.distanceTo(_labelWorldPos);
        const isFocusedOrHovered = (mesh !== sunMeshRef) && (activeTargetMesh === mesh || hoveredCelestialMesh === mesh);

        // Compute scale-aware opacity so labels remain clean and uncluttered across zoom regimes
        let alpha = 0.9;
        if (manualTierLock !== 0) {
          alpha = 0.92;
        } else if (entry.tier === 1) {
          if (entry.id === "sun") {
            alpha = camDist > 550 ? Math.max(0.0, 0.95 * (1.0 - (camDist - 550) / 550)) : 0.95;
          } else if (camDist <= 145) {
            alpha = 0.9;
          } else if (camDist < 235) {
            alpha = 0.9 * (1.0 - (camDist - 145) / 90.0);
          } else {
            alpha = 0.0;
          }
        } else if (entry.id === "toliman" || entry.id === "proxima-centauri" || entry.id === "sirius-b") {
          if (distToCam <= 230) {
            alpha = 0.85;
          } else if (distToCam < 340) {
            alpha = 0.85 * (1.0 - (distToCam - 230) / 110.0);
          } else {
            alpha = 0.0;
          }
        } else {
          // Tier 2, 3, 4 primary objects: band-pass depth fading so inner tiers clear as you pull out
          if (entry.tier === 2) {
            const fadeIn = THREE.MathUtils.clamp((camDist - 115) / 95, 0.0, 1.0);
            const fadeOut = THREE.MathUtils.clamp(1.0 - (camDist - 950) / 700, 0.0, 1.0);
            alpha = fadeIn * fadeOut * 0.85;
          } else if (entry.tier === 3) {
            const fadeIn = THREE.MathUtils.clamp((camDist - 310) / 190, 0.0, 1.0);
            const fadeOut = THREE.MathUtils.clamp(1.0 - (camDist - 2600) / 1600, 0.0, 1.0);
            alpha = fadeIn * fadeOut * 0.88;
          } else {
            const fadeIn = THREE.MathUtils.clamp((camDist - 900) / 700, 0.0, 1.0);
            alpha = fadeIn * 0.90;
          }
        }

        if (isFocusedOrHovered) {
          alpha = 1.0;
        }

        if (alpha <= 0.02) {
          if (entry.visible) {
            entry.el.style.display = "none";
            entry.visible = false;
          }
          continue;
        }

        const pxPerUnit = halfH / Math.max(0.1, fovTan * distToCam);
        const haloMult = (entry.data && typeof entry.data.haloMultiplier === "number") ? entry.data.haloMultiplier : 1.0;
        const apparentRadiusPx = (entry.data.size || 0.5) * haloMult * pxPerUnit;
        const maxLabelOffset = entry.id === "sun" ? 130 : (haloMult > 1.5 ? 84 : 42);
        entry.offsetX = Math.max(8, Math.min(maxLabelOffset, apparentRadiusPx + 10));
        entry.sx = (_labelProjVec.x * 0.5 + 0.5) * window.innerWidth;
        entry.sy = (-_labelProjVec.y * 0.5 + 0.5) * window.innerHeight;
        entry.alpha = alpha;

        if (!entry.visible) {
          entry.el.style.display = "block";
          entry.visible = true;
        }
        entry.el.classList.toggle("celestial-label--active", isFocusedOrHovered);
      }

      // Smoothly separate close orbital companion pairs (Earth/Moon, Alpha Centauri A/B, Sirius A/B) when passing at the same screen Y
      const companionPairs = [
        ["earth", "moon"],
        ["rigil-kentaurus", "toliman"],
        ["sirius", "sirius-b"]
      ];
      for (let p = 0; p < companionPairs.length; p++) {
        const primary = celestialLabelById.get(companionPairs[p][0]);
        const companion = celestialLabelById.get(companionPairs[p][1]);
        if (primary && companion && primary.visible && companion.visible) {
          const dx = Math.abs((companion.sx + companion.offsetX) - (primary.sx + primary.offsetX));
          const dy = Math.abs(companion.sy - primary.sy);
          if (dx < 76 && dy < 15) {
            const overlap = (1.0 - dx / 76.0) * (1.0 - dy / 15.0);
            primary.sy -= 5.5 * overlap;
            companion.sy += 6.5 * overlap;
          }
        }
      }

      // === POST-PROJECTION PRIORITY SCREEN-SPACE DECLUTTER ===
      const _focusTargetMesh = hoveredCelestialMesh || activeTargetMesh;
      const _activeVis = [];
      for (let i = 0; i < celestialLabelEntries.length; i++) {
        const e = celestialLabelEntries[i];
        if (e.visible && e.alpha > 0.02) _activeVis.push(e);
      }
      _activeVis.sort((a, b) => {
        const aFoc = (a.mesh === _focusTargetMesh) ? 1 : 0;
        const bFoc = (b.mesh === _focusTargetMesh) ? 1 : 0;
        if (aFoc !== bFoc) return bFoc - aFoc;
        if (Math.abs(b.alpha - a.alpha) > 0.15) return b.alpha - a.alpha;
        if (a.tier !== b.tier) return b.tier - a.tier;
        return ((b.data && b.data.size) || 0) - ((a.data && a.data.size) || 0);
      });
      const _placedBoxes = [];
      for (let i = 0; i < _activeVis.length; i++) {
        const e = _activeVis[i];
        const x1 = e.sx + e.offsetX - 4;
        const w = (e.el && e.el.offsetWidth) ? e.el.offsetWidth + 12 : 96;
        const x2 = x1 + w;
        const y1 = e.sy - 9;
        const y2 = e.sy + 9;
        let collides = false;
        if (e.mesh !== _focusTargetMesh) {
          for (let k = 0; k < _placedBoxes.length; k++) {
            const box = _placedBoxes[k];
            if (x1 < box.x2 && x2 > box.x1 && y1 < box.y2 && y2 > box.y1) {
              collides = true;
              break;
            }
          }
        }
        if (collides) {
          e.alpha = 0;
        } else {
          _placedBoxes.push({ x1, x2, y1, y2 });
        }
      }
      const _focusTargetId = (_focusTargetMesh && _focusTargetMesh.userData && _focusTargetMesh.userData.id)
        ? String(_focusTargetMesh.userData.id).toLowerCase()
        : "";
      const _hasPlanetFocus = Boolean(_focusTargetMesh && _focusTargetId && _focusTargetId !== "sun");

      for (let i = 0; i < celestialLabelEntries.length; i++) {
        const entry = celestialLabelEntries[i];
        if (!entry.visible) continue;
        const finalX = entry.sx + entry.offsetX;
        const finalY = entry.sy;
        const isEntryFocused = (entry.mesh === _focusTargetMesh);
        const isCalloutActiveOnMesh = Boolean(
          window._isSpatialCalloutVisible && activeTargetMesh && entry.mesh === activeTargetMesh
        );
        const occlusionVis = window._getScreenPointOcclusionFactor
          ? window._getScreenPointOcclusionFactor(entry.sx, entry.sy, finalX, finalY, entry.id, entry.mesh)
          : 1.0;

        const baseAlpha = _hasPlanetFocus
          ? (isEntryFocused ? 1.0 : entry.alpha * 0.52)
          : entry.alpha;

        const effectiveAlpha = isCalloutActiveOnMesh ? 0.0 : (baseAlpha * occlusionVis);
        entry.el.style.transform = `translate3d(${finalX.toFixed(1)}px, ${finalY.toFixed(1)}px, 0) translateY(-50%)`;
        entry.el.style.opacity = effectiveAlpha.toFixed(3);
        entry.el.style.pointerEvents = (isCalloutActiveOnMesh || effectiveAlpha < 0.15) ? "none" : "auto";
      }

      // Live Starlight Orbital Path Highlighting (Zero Cyan - Pure Optical Contrast + Smooth Proximity Fade)
      for (let i = 0; i < celestialObjects.length; i++) {
        const mesh = celestialObjects[i];
        if (!mesh || !mesh.userData || !mesh.userData.orbitLine) continue;
        const line = mesh.userData.orbitLine;
        line.frustumCulled = false;
        const mat = line.material;
        if (!mat) continue;

        mat.transparent = true;
        if (mat.userData === undefined) mat.userData = {};
        if (mat.userData.baseOpacity === undefined) mat.userData.baseOpacity = mat.opacity || 0.35;
        if (mat.userData.baseColorHex === undefined && mat.color) mat.userData.baseColorHex = mat.color.getHex();

        // Gently dissolve a body's orbit arc only when camera flies right down to its surface
        const bodySize = mesh.userData.size || 0.5;
        const distToBody = camera.position.distanceTo(mesh.position);
        const proxFade = THREE.MathUtils.clamp((distToBody - bodySize * 1.6) / (bodySize * 3.8), 0.0, 1.0);

        const isMeshFocused = (mesh === _focusTargetMesh);
        let targetOpacity = mat.userData.baseOpacity;
        if (_hasPlanetFocus) {
          if (isMeshFocused) {
            mat.blending = THREE.AdditiveBlending;
            targetOpacity = 0.95 * proxFade;
            if (mat.color) mat.color.lerp(new THREE.Color(0xffffff), 0.15);
          } else {
            mat.blending = THREE.NormalBlending;
            targetOpacity = 0.12 * proxFade;
            if (mat.color && mat.userData.baseColorHex !== undefined) {
              mat.color.lerp(new THREE.Color(mat.userData.baseColorHex), 0.12);
            }
          }
        } else {
          mat.blending = THREE.NormalBlending;
          targetOpacity = mat.userData.baseOpacity * proxFade;
          if (mat.color && mat.userData.baseColorHex !== undefined) {
            mat.color.lerp(new THREE.Color(mat.userData.baseColorHex), 0.12);
          }
        }
        mat.opacity += (targetOpacity - mat.opacity) * 0.10;
      }
    }

    function isNodeVisible(obj) {
      let cur = obj;
      while (cur) {
        if (cur.visible === false) return false;
        cur = cur.parent;
      }
      return true;
    }

    function resolveTargetData(obj) {
      let cur = obj;
      while (cur) {
        if (cur.userData && cur.userData.id) {
          return { data: cur.userData, rootMesh: cur };
        }
        cur = cur.parent;
      }
      return null;
    }

    function onPointerMove(event) {
      const bootOverlay = document.getElementById('nova-boot-overlay');
      if (document.documentElement.classList.contains('is-booting') || (bootOverlay && !bootOverlay.classList.contains('boot-completed') && bootOverlay.style.display !== 'none')) {
        hoveredCelestialMesh = null;
        return;
      }
      // Do not strip hover if pointer is directly over a celestial label or interactive HUD element
      const overLabelOrHud = event.target && event.target.closest && event.target.closest('.celestial-label, button, a, input, select, [role="button"], .interactive, #nova-portal-o');
      if (overLabelOrHud) {
        document.body.classList.add('nova-cursor-hover');
        return;
      }

      const inspectorEl = document.getElementById('inspector');
      const isSidebarOpen = inspectorEl && !inspectorEl.classList.contains('translate-x-[430px]');
      const rightLimit = isSidebarOpen ? window.innerWidth - 410 : window.innerWidth;

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const visibleCandidates = celestialObjects.filter(obj => isNodeVisible(obj));
      const intersects = raycaster.intersectObjects(visibleCandidates, true);

      if (event.clientX < rightLimit) {
        for (let i = 0; i < intersects.length; i++) {
          const resolved = resolveTargetData(intersects[i].object);
          if (resolved && resolved.data && resolved.data.name) {
            hoveredCelestialMesh = resolved.rootMesh;
            document.body.classList.add('nova-cursor-hover');
            return;
          }
        }

        // Screen-space proximity fallback so small/distant 3D bodies (Mercury, Ceres, Oumuamua, Uranus, stars) always highlight reliably
        let closestMesh = null;
        let closestDist = 18; // 18px screen hit radius around any visible object center
        const projVec = new THREE.Vector3();
        for (let i = 0; i < visibleCandidates.length; i++) {
          const obj = visibleCandidates[i];
          const resolved = resolveTargetData(obj);
          if (!resolved || !resolved.data || !resolved.data.name) continue;
          obj.getWorldPosition(projVec);
          projVec.project(camera);
          if (projVec.z > -1 && projVec.z < 1) {
            const sx = (projVec.x * 0.5 + 0.5) * window.innerWidth;
            const sy = (-projVec.y * 0.5 + 0.5) * window.innerHeight;
            const d = Math.hypot(event.clientX - sx, event.clientY - sy);
            if (d < closestDist) {
              closestDist = d;
              closestMesh = resolved.rootMesh;
            }
          }
        }
        if (closestMesh) {
          hoveredCelestialMesh = closestMesh;
          document.body.classList.add('nova-cursor-hover');
          return;
        }
      }

      hoveredCelestialMesh = null;
      document.body.classList.remove('nova-cursor-hover');
    }

    function onPointerDown(event) {
      const bootOverlay = document.getElementById('nova-boot-overlay');
      if (document.documentElement.classList.contains('is-booting') || (bootOverlay && !bootOverlay.classList.contains('boot-completed') && bootOverlay.style.display !== 'none')) return;
      if (event.target && event.target.closest && event.target.closest('#nova-boot-overlay, #nova-portal-o, header, footer, aside, #cosmic-tour-hud, button, input, .celestial-label')) return;
      const inspectorEl = document.getElementById('inspector');
      const isSidebarOpen = inspectorEl && !inspectorEl.classList.contains('translate-x-[430px]');
      if (event.clientY < 60 || (isSidebarOpen && event.clientX > window.innerWidth - 410)) return;

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const visibleCandidates = celestialObjects.filter(obj => isNodeVisible(obj));
      const intersects = raycaster.intersectObjects(visibleCandidates, true);

      for (let i = 0; i < intersects.length; i++) {
        const resolved = resolveTargetData(intersects[i].object);
        if (resolved && resolved.data && resolved.data.id) {
          activeTargetMesh = resolved.rootMesh;
          if (isPlanetOverviewEnabled) {
            openInspector(resolved.data);
          } else {
            activeTarget = resolved.data;
            window.dismissSpatialCallout();
          }
          smoothFlyToTarget();
          return;
        }
      }

      if (hoveredCelestialMesh) {
        const resolved = resolveTargetData(hoveredCelestialMesh);
        if (resolved && resolved.data && resolved.data.id) {
          activeTargetMesh = resolved.rootMesh;
          if (isPlanetOverviewEnabled) {
            openInspector(resolved.data);
          } else {
            activeTarget = resolved.data;
            window.dismissSpatialCallout();
          }
          smoothFlyToTarget();
        }
      }
    }

    function populateDeepProfileUI(idOrProfile) {
      const grid = document.getElementById('target-metrics-grid');
      const factsList = document.getElementById('target-facts-list');
      const deepBox = document.getElementById('target-deep-profile');
      if (!grid || !factsList || !deepBox) return;

      const profile = (typeof idOrProfile === 'string') ? ASTROPHYSICAL_ARCHIVE[idOrProfile] : idOrProfile;
      if (!profile || (!profile.metrics && !profile.facts)) {
        deepBox.classList.add('hidden');
        return;
      }

      deepBox.classList.remove('hidden');
      grid.innerHTML = (profile.metrics || []).map(([label, val]) => `
        <div class="bg-slate-950/40 border border-slate-700/50 rounded-lg px-2.5 py-1.5">
          <span class="block text-[10px] font-mono uppercase tracking-wider text-slate-400">${label}</span>
          <span class="block text-[12.5px] font-mono font-semibold text-emerald-300 mt-0.5 leading-snug">${val}</span>
        </div>
      `).join('');

      factsList.innerHTML = (profile.facts || []).map(f => `<li>${f}</li>`).join('');
    }

    function openInspector(data, isTierOverview = false) {
      if (!isTierOverview && data && data.id) setDeepLinkTarget(data.id);
      activeTarget = data;
      const targetScale = document.getElementById('target-scale');
      if (targetScale) targetScale.textContent = data.scale_order || '';
      const targetName = document.getElementById('target-name');
      if (targetName) targetName.textContent = data.name || data.title || '';
      const targetType = document.getElementById('target-type');
      if (targetType) targetType.textContent = data.type || '';
      const targetDist = document.getElementById('target-distance');
      if (targetDist) targetDist.textContent = `Distance: ${data.distance || ''}`;
      const targetSummary = document.getElementById('target-summary');
      if (targetSummary) targetSummary.textContent = data.summary || '';

      if (isTierOverview) {
        populateDeepProfileUI(data);
      } else {
        populateDeepProfileUI(data.id);
      }

      const inqSection = document.getElementById('inspector-inquiry-section');
      if (inqSection) {
        if (isTierOverview) inqSection.classList.add('hidden');
        else inqSection.classList.remove('hidden');
      }

      const aiBox = document.getElementById('ai-telemetry');
      if (aiBox) {
        aiBox.innerHTML = '';
        aiBox.classList.add('hidden');
      }

      const tourCtrl = document.getElementById('sidebar-tour-controls');
      if (tourCtrl) {
        if (isTourActive) tourCtrl.classList.remove('hidden');
        else tourCtrl.classList.add('hidden');
      }

      if (typeof window.populateSpatialCallout === 'function') {
        if (isPlanetOverviewEnabled) {
          window.populateSpatialCallout(data, isTierOverview);
        } else {
          window.dismissSpatialCallout();
        }
      }
      const inspector = document.getElementById('inspector');
      if (inspector) {
        if (isOverviewToggleActive && !isSidebarUserHidden && window._forceFullSidebarOpen) {
          inspector.classList.remove('translate-x-[430px]');
        } else {
          inspector.classList.add('translate-x-[430px]');
        }
      }
      updateSidebarToggleStyle();
    }
    window.openInspector = openInspector;

    window.closeInspector = function() {
      if (isTourActive) {
        window.stopCosmicTour();
        return;
      }
      const inspector = document.getElementById('inspector');
      if (inspector) inspector.classList.add('translate-x-[430px]');
      activeTarget = null;
      activeTargetMesh = null;
      window._spatialCalloutDismissedForMesh = null;
      if (typeof lastTrackedTargetPos !== 'undefined') lastTrackedTargetPos.set(0, 0, 0);
      const spLayer = document.getElementById('spatial-telemetry-layer');
      if (spLayer) spLayer.classList.add('opacity-0');
      updateSidebarToggleStyle();
    };

    window._spatialCalloutDismissedForMesh = null;
    window._forceFullSidebarOpen = false;
    window._isSpatialCalloutVisible = false;
    window._spatialMetricRelativeMode = false;
    window._spatialCurrentMetrics = [];
    window._spatialFactDeck = [];
    window._spatialFactIndex = 0;
    const _spatialWorldPos = new THREE.Vector3();
    const _spatialProjVec = new THREE.Vector3();

    // Split "6,051.8 km (0.95 R⊕)" into cleanly separated Absolute vs Relative strings so neither truncates
    function splitMetricValue(rawVal, label) {
      const str = String(rawVal || "").trim();
      const parenMatch = str.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (parenMatch) {
        return {
          primary: parenMatch[1].trim(),
          relative: parenMatch[2].trim()
        };
      }
      // If no parenthetical exists, provide intelligent astronomical context where possible
      return {
        primary: str,
        relative: str
      };
    }

    
    // --- SATELLITE COURSE HUDs & 3D SURFACE PINPOINTING ADDON (STABILIZED & SEAMLESS) ---
    window._activeSurfaceSite = null;
    window._satelliteNodesData = [];
    window._currentPinnedSite = null;
    window._surfaceZoomState = {
      active: false,
      currentRatio: 1.0,
      targetRatio: 1.0,
      savedMinDistance: null,
      lockedCamOffset: null
    };
    window._tourBeatState = {
      stepSignature: "",
      stepStartTime: 0,
      lockedSideSign: -1,
      metricCueStartSec: -1,
      metricCueEndSec: -1,
      siteCueStartSec: -1,
      matchedMetric: null,
      matchedFeature: null,
      lastCardX: null,
      lastCardY: null,
      lastDotX: null,
      lastDotY: null,
      activePanelKey: ""
    };

    // 1. Freeze orbital revolution & camera auto-orbit drift during Guided Tour stops
    (function installStabilizedTourControls() {
      if (window._stabilizedTourInstalled) return;
      window._stabilizedTourInstalled = true;

      const origPerfNow = performance.now.bind(performance);
      const origDateNow = Date.now.bind(Date);
      let virtualPerf = origPerfNow();
      let lastRealPerf = origPerfNow();
      let virtualDate = origDateNow();
      let lastRealDate = origDateNow();

      window._realNow = function() {
        return origPerfNow();
      };

      // Freeze both performance.now() and Date.now() to 0% orbital drift when Guided Tour is settled on an object!
      // IMPORTANT: Keep 100% speed during the first 2.2s of a tour step so the camera fly-to tween finishes normally!
      function getSimTimeScale() {
        if (!window._isTourActiveCached) return 1.0;
        if (window._isZoomingSurfaceAnim) return 1.0;
        const elapsedSinceStep = (origPerfNow() - (window._tourBeatState.stepStartTime || 0)) / 1000.0;
        if (elapsedSinceStep < 2.3) return 1.0; // Allow camera fly-to animation to run at full speed
        return 0.0; // Freeze orbital motion once camera arrives at the tour stop so planet & camera stay 100% still!
      }

      Date.now = function() {
        const real = origDateNow();
        const dt = real - lastRealDate;
        lastRealDate = real;
        virtualDate += dt * getSimTimeScale();
        return Math.round(virtualDate);
      };

      // Prevent clicking on the 3D canvas object during the Guided Tour from triggering a new camera fly-to / orbit spin!
      window.addEventListener("pointerdown", function(e) {
        if (!window._isTourActiveCached) return;
        const t = e.target;
        if (t && t.tagName && t.tagName.toLowerCase() === "canvas") {
          window._canvasDownPos = { x: e.clientX, y: e.clientY };
        }
      }, true);

      window.addEventListener("click", function(e) {
        if (!window._isTourActiveCached) return;
        const t = e.target;
        if (t && t.tagName && t.tagName.toLowerCase() === "canvas") {
          const down = window._canvasDownPos || { x: e.clientX, y: e.clientY };
          const moveDist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
          // If it was a click (not a drag), block the raycaster click handler so the camera doesn't zoom/spin around the object!
          if (moveDist < 8) {
            e.stopPropagation();
            e.stopImmediatePropagation();
          }
        }
      }, true);

      window.addEventListener("mouseup", function(e) {
        if (!window._isTourActiveCached) return;
        const t = e.target;
        if (t && t.tagName && t.tagName.toLowerCase() === "canvas") {
          const down = window._canvasDownPos || { x: e.clientX, y: e.clientY };
          const moveDist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
          if (moveDist < 6) {
            // Prevent mouseup raycast re-focus during tour while keeping OrbitControls state clean
            e.stopPropagation();
          }
        }
      }, true);
    })();

    function nowMs() {
      return window._realNow ? window._realNow() : performance.now();
    }

    function isGuidedTourCurrentlyActive() {
      const active = Boolean(
        (typeof isTourActive !== "undefined" && isTourActive) ||
        window.isCosmicTourActive
      );
      window._isTourActiveCached = active;
      return active;
    }

    function isOverviewHudEnabled() {
      if (
        window.inspectorVisible === false ||
        window.hudVisible === false ||
        window._overviewHudHidden === true ||
        window._isSpatialCalloutVisible === false
      ) {
        return false;
      }
      const mainLayer = document.getElementById("spatial-telemetry-layer");
      const mainCard = document.getElementById("spatial-callout-card");
      if (!mainLayer || !mainCard) return false;
      if (
        mainLayer.classList.contains("hidden") ||
        mainLayer.classList.contains("opacity-0") ||
        mainCard.classList.contains("hidden")
      ) {
        return false;
      }
      return true;
    }



    function computeScriptTimedMetric(planetName, metricsList, scriptText) {
      if (!planetName || !metricsList || !metricsList.length || !scriptText) return null;
      if (planetName.toUpperCase().indexOf("SOLAR SYSTEM") !== -1) return null;

      const lowerScript = String(scriptText).toLowerCase();
      let bestMatch = null;
      let bestCharPos = 999999;

      for (let i = 0; i < metricsList.length; i++) {
        const label = String(metricsList[i][0] || "");
        const rawVal = String(metricsList[i][1] || "");
        const l = label.toLowerCase();
        const v = rawVal.toLowerCase();

        if (l.indexOf("object") !== -1 || v.indexOf("objects") !== -1) continue;

        const str = rawVal.trim();
        const parenMatch = str.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
        const primary = parenMatch ? parenMatch[1].trim() : str;
        const relative = parenMatch ? parenMatch[2].trim() : str;

        for (let r = 0; r < COURSE_METRIC_DECODER.length; r++) {
          const rule = COURSE_METRIC_DECODER[r];
          const matchesMetric = rule.match.some(function(m) { return l.indexOf(m) !== -1 || v.indexOf(m) !== -1; });
          if (!matchesMetric) continue;

          for (let p = 0; p < rule.scriptPhrases.length; p++) {
            const phrase = rule.scriptPhrases[p];
            const pos = lowerScript.indexOf(phrase);
            if (pos !== -1 && pos < bestCharPos) {
              bestCharPos = pos;
              bestMatch = {
                plainTitle: rule.getTitle(planetName, rawVal),
                courseTag: rule.getCourseTag(planetName, rawVal),
                primaryVal: primary,
                relativeVal: relative,
                explanation: rule.explain(rawVal, planetName),
                matchedPhrase: phrase,
                charIndex: pos
              };
            }
          }
        }
      }
      return bestMatch;
    }


    function getActivePlanetNameFromDOM() {
      const nameEl = document.getElementById("spatial-target-name");
      if (nameEl && nameEl.textContent && nameEl.textContent.trim()) {
        return nameEl.textContent.trim();
      }
      return "";
    }

    function computeScriptTimedSurfaceFeature(rawName, scriptText) {
      if (!rawName || !scriptText) return null;
      if (rawName.toUpperCase().indexOf("SOLAR SYSTEM") !== -1) return null;
      const lowerName = rawName.toLowerCase();
      const lowerScript = String(scriptText).toLowerCase();

      let candidates = [];
      for (const key in SURFACE_FEATURE_REGISTRY) {
        if (lowerName.indexOf(key.toLowerCase()) !== -1) {
          candidates = SURFACE_FEATURE_REGISTRY[key];
          break;
        }
      }
      for (let i = 0; i < candidates.length; i++) {
        const f = candidates[i];
        const kws = f.keywords || [];
        for (let j = 0; j < kws.length; j++) {
          const pos = lowerScript.indexOf(kws[j].toLowerCase());
          if (pos !== -1) {
            return {
              feature: f,
              matchedKeyword: kws[j],
              charIndex: pos
            };
          }
        }
      }
      // Universal fallback for any other celestial object (Moon, Uranus, Neptune, Pluto, Exoplanets, Black Holes)
      // so the Surface Zoom / Inspection feature works on 100% of objects in the tour!
      if ( scriptText.length > 20 ) {
        const firstClause = scriptText.split(/[.,;]/)[0] || rawName;
        return {
          feature: {
            id: "universal-site",
            name: rawName + " — Primary Feature",
            keywords: [firstClause.trim().split(" ").slice(-1)[0] || rawName],
            lat: 8.0, lon: -12.0, zoomRatio: 0.46,
            courseNote: "Observational Telemetry: Close-approach inspection of " + rawName + "'s primary structural envelope."
          },
          matchedKeyword: firstClause.trim().split(" ").slice(-1)[0] || rawName,
          charIndex: 25
        };
      }
      return null;
    }

    // Issue 3 Fix: Persistent, Frame-Locked Surface Zoom that overrides OrbitControls.minDistance and works on ALL objects!
    window.zoomToSurfaceFeature = function(siteId, e) {
      try {
        if (e && e.stopPropagation) e.stopPropagation();
        const rawName = getActivePlanetNameFromDOM();
        const state = window._tourBeatState;
        let found = null;
        for (const key in SURFACE_FEATURE_REGISTRY) {
          if (rawName.toLowerCase().indexOf(key.toLowerCase()) !== -1) {
            found = SURFACE_FEATURE_REGISTRY[key].find(function(f) { return f.id === siteId; });
            if (found) break;
          }
        }
        if (!found && state.matchedFeature && state.matchedFeature.id === siteId) {
          found = state.matchedFeature;
        }
        if (!found) return;

        window._activeSurfaceSite = found;

        const cam = window._novaCamRef || window.camera;
        const ctrl = window._novaCtrlRef || window.controls;
        const zState = window._surfaceZoomState;
        if (cam && ctrl) {
          if (zState.savedMinDistance === null) {
            zState.savedMinDistance = ctrl.minDistance || 0.1;
          }
          // Allow close-up surface inspection even on large bodies like the Sun!
          ctrl.minDistance = 0.05;
          if (!zState.lockedCamOffset) {
            zState.lockedCamOffset = cam.position.clone().sub(ctrl.target);
          }
          zState.active = true;
          zState.targetRatio = found.zoomRatio || 0.45;
        }
      } catch (err) {
        console.warn("Zoom error:", err);
      }
    };

    window.resetSurfaceFeatureZoom = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      window._activeSurfaceSite = null;
      const zState = window._surfaceZoomState;
      zState.targetRatio = 1.0;
      const ctrl = window._novaCtrlRef || window.controls;
      if (ctrl && zState.savedMinDistance !== null) {
        setTimeout(function() {
          if (!window._activeSurfaceSite && ctrl) {
            ctrl.minDistance = zState.savedMinDistance;
            zState.active = false;
            zState.lockedCamOffset = null;
          }
        }, 750);
      }
    };

    // Issue 2 Fix: Persistent single DOM card with smooth inner cross-fade (never abruptly destroys/recreates the outer card!)
    function setSmoothSatelliteCardContent(satNodesEl, desiredKey, buildInnerHtmlFn) {
      if (!satNodesEl) return;
      const state = window._tourBeatState;
      if (state.activePanelKey === desiredKey) return;
      state.activePanelKey = desiredKey;

      let outerNode = document.getElementById("spatial-sat-node-0");
      if (!desiredKey) {
        if (outerNode) {
          outerNode.style.opacity = "0";
          outerNode.style.pointerEvents = "none";
        }
        return;
      }

      if (!outerNode) {
        satNodesEl.innerHTML =
          '<div id="spatial-sat-node-0" style="opacity: 0;" class="spatial-satellite-node sat-beat-active">' +
            '<div id="spatial-sat-inner-0" class="spatial-sat-inner">' + buildInnerHtmlFn() + '</div>' +
          '</div>';
        outerNode = document.getElementById("spatial-sat-node-0");
        requestAnimationFrame(function() {
          if (outerNode && state.activePanelKey === desiredKey) {
            outerNode.style.opacity = "1";
            outerNode.style.pointerEvents = "auto";
          }
        });
        return;
      }

      // If card already exists, smoothly fade its inner content out, swap, and fade back in
      outerNode.style.opacity = "1";
      outerNode.style.pointerEvents = "auto";
      const innerNode = document.getElementById("spatial-sat-inner-0");
      if (innerNode) {
        innerNode.classList.add("sat-content-hidden");
        setTimeout(function() {
          if (state.activePanelKey === desiredKey && innerNode) {
            innerNode.innerHTML = buildInnerHtmlFn();
            requestAnimationFrame(function() {
              innerNode.classList.remove("sat-content-hidden");
            });
          }
        }, 280);
      }
    }

    function scheduleTourStepCues(rawName, activeText) {
      const state = window._tourBeatState;
      state.stepStartTime = nowMs();
      state.lockedSideSign = -1;
      state.lastCardX = null;
      state.lastCardY = null;
      state.lastDotX = null;
      state.lastDotY = null;

      // Reset any active surface zoom cleanly when switching to a new planet
      window._activeSurfaceSite = null;
      window._surfaceZoomState.active = false;
      window._surfaceZoomState.currentRatio = 1.0;
      window._surfaceZoomState.targetRatio = 1.0;
      window._surfaceZoomState.lockedCamOffset = null;

      const mainCard = document.getElementById("spatial-callout-card");
      if (mainCard) {
        mainCard.style.transition = "";
        mainCard.style.opacity = "";
      }

      state.matchedMetric = computeScriptTimedMetric(rawName, window._spatialCurrentMetrics || [], activeText);
      const siteMatch = computeScriptTimedSurfaceFeature(rawName, activeText);
      state.matchedFeature = siteMatch ? siteMatch.feature : null;

      // Wait 4.2 full seconds (1.8s camera flight + 2.4s calm reading time) before gently fading in the Satellite HUD!
      if (state.matchedMetric) {
        state.metricCueStartSec = 0.0;
        state.metricCueEndSec = 14.5;
      } else {
        state.metricCueStartSec = -1;
        state.metricCueEndSec = -1;
      }

      if (siteMatch) {
        state.siteCueStartSec = 0.0;
      } else {
        state.siteCueStartSec = -1;
      }
    }

    window.syncSatelliteCourseHUDs = function() {
      try {
        enforceSceneDepthOcclusion();
        const satLayer = document.getElementById('spatial-satellite-layer');
        const gridEl = document.getElementById('spatial-metrics-grid');
        const sitesBar = document.getElementById('spatial-surface-sites-bar');

        const tourRunning = isGuidedTourCurrentlyActive();
        const hudEnabled = isOverviewHudEnabled();

        if (!tourRunning || !hudEnabled) {
          if (satLayer) satLayer.classList.add('hidden');
          if (sitesBar) sitesBar.innerHTML = '';
          if (gridEl && hudEnabled && (window._spatialCurrentMetrics || []).length > 0) {
            gridEl.style.display = 'grid';
          }
          return;
        }

        if (gridEl) gridEl.style.display = 'none';

        const rawName = getActivePlanetNameFromDOM();
        const deck = window._spatialFactDeck || [];
        const fIdx = window._spatialFactIndex || 0;
        const activeFactObj = deck.length > 0 ? deck[((fIdx % deck.length) + deck.length) % deck.length] : null;
        const sumEl = document.getElementById('spatial-target-summary');
        const activeText = activeFactObj ? activeFactObj.text : (sumEl ? sumEl.textContent : '');

        const sig = rawName + "|" + fIdx + "|" + activeText.slice(0, 32);
        const state = window._tourBeatState;
        if (sig !== state.stepSignature) {
          state.stepSignature = sig;
          scheduleTourStepCues(rawName, activeText);
        }

        if (sumEl && activeText && state.matchedFeature && sumEl.innerHTML.indexOf('spatial-inline-site-link') === -1) {
          const f = state.matchedFeature;
          let htmlText = activeText;
          const kws = f.keywords || [];
          for (let j = 0; j < kws.length; j++) {
            const kw = kws[j];
            const pos = htmlText.toLowerCase().indexOf(kw.toLowerCase());
            if (pos !== -1) {
              const matchedWord = htmlText.substr(pos, kw.length);
              htmlText = htmlText.substr(0, pos) +
                '<span class="spatial-inline-site-link" onclick="window.zoomToSurfaceFeature(\'' + f.id + '\', event)" title="Click to zoom camera into ' + f.name + '">' + matchedWord + ' ⌖</span>' +
                htmlText.substr(pos + kw.length);
              break;
            }
          }
          sumEl.innerHTML = htmlText;
        }
      } catch (err) {
        console.warn("syncSatelliteCourseHUDs error:", err);
      }
    };

    window.updateSatelliteCourseHUDPositions = function() {
      try {
        enforceSceneDepthOcclusion();
        const satLayer = document.getElementById('spatial-satellite-layer');
        const mainLayer = document.getElementById('spatial-telemetry-layer');
        const mainCard = document.getElementById('spatial-callout-card');
        const satNodesEl = document.getElementById('spatial-satellite-nodes');
        const pinContainer = document.getElementById('spatial-surface-pin-container');
        const sitesBar = document.getElementById('spatial-surface-sites-bar');
        const satSvg = document.getElementById('spatial-satellite-svg');
        if (!satLayer || !mainLayer || !mainCard) return;

        if (pinContainer && pinContainer.innerHTML !== '') {
          pinContainer.innerHTML = '';
        }

        const tourRunning = isGuidedTourCurrentlyActive();
        const hudEnabled = isOverviewHudEnabled();

        if (!tourRunning || !hudEnabled || mainCard.offsetWidth < 120) {
          if (!satLayer.classList.contains('hidden')) {
            satLayer.classList.add('hidden');
          }
          if (!tourRunning) {
            const gridEl = document.getElementById('spatial-metrics-grid');
            if (gridEl && hudEnabled && (window._spatialCurrentMetrics || []).length > 0) {
              gridEl.style.display = 'grid';
            }
            if (sitesBar && sitesBar.innerHTML !== '') sitesBar.innerHTML = '';
          }
          return;
        }

        const rect = mainCard.getBoundingClientRect();
        window.syncSatelliteCourseHUDs();

        // Drive smooth, damped 3D camera surface zoom every frame if active!
        const zState = window._surfaceZoomState;
        const cam = window._novaCamRef || window.camera;
        const ctrl = window._novaCtrlRef || window.controls;
        if (zState.active && cam && ctrl && zState.lockedCamOffset) {
          zState.currentRatio += (zState.targetRatio - zState.currentRatio) * 0.08;
          const liveTarget = window._surfLiveTarget || (window._surfLiveTarget = new THREE.Vector3());
          const scaledOffset = window._surfScaledOffset || (window._surfScaledOffset = new THREE.Vector3());
          liveTarget.copy(ctrl.target);
          if (window._spatialTargetMesh && typeof window._spatialTargetMesh.getWorldPosition === "function") {
            window._spatialTargetMesh.getWorldPosition(liveTarget);
          }
          scaledOffset.copy(zState.lockedCamOffset).multiplyScalar(zState.currentRatio);
          cam.position.copy(liveTarget).add(scaledOffset);
          ctrl.target.copy(liveTarget);
        }

        const state = window._tourBeatState;
        const elapsedSec = (nowMs() - state.stepStartTime) / 1000.0;

        const showSiteChipNow = Boolean(
          state.matchedFeature &&
          (elapsedSec >= state.siteCueStartSec || window._activeSurfaceSite)
        );

        if (sitesBar) {
          if (!showSiteChipNow) {
            if (sitesBar.innerHTML !== '') {
              sitesBar.innerHTML = '';
              sitesBar.removeAttribute('data-site-id');
            }
          } else {
            const f = window._activeSurfaceSite || state.matchedFeature;
            const isSel = Boolean(window._activeSurfaceSite && window._activeSurfaceSite.id === f.id);
            const desiredChipHtml =
              '<button type="button" onclick="window.zoomToSurfaceFeature(\'' + f.id + '\', event)" class="spatial-feature-chip ' + (isSel ? 'active-site' : '') + '"><span>⌖</span><span>' + (isSel ? 'Inspecting: ' : 'Inspect ') + f.name + '</span></button>' +
              (window._activeSurfaceSite ? '<button type="button" onclick="window.resetSurfaceFeatureZoom(event)" class="text-[8.5px] font-mono text-cyan-300 hover:text-white ml-1.5 underline cursor-pointer">Reset Zoom</button>' : '');
            if (sitesBar.getAttribute('data-site-id') !== (f.id + "|" + isSel)) {
              sitesBar.setAttribute('data-site-id', f.id + "|" + isSel);
              sitesBar.innerHTML = desiredChipHtml;
            }
          }
        }

        const activeSite = window._activeSurfaceSite;
        const showMetricNow = Boolean(
          !activeSite &&
          state.matchedMetric &&
          elapsedSec >= state.metricCueStartSec &&
          elapsedSec <= state.metricCueEndSec
        );

        if (activeSite) {
          const siteKey = "SITE:" + activeSite.id;
          setSmoothSatelliteCardContent(satNodesEl, siteKey, function() {
            return '<div class="flex items-center justify-between gap-1 mb-0.5">' +
                '<span class="text-[8px] font-mono uppercase tracking-widest text-cyan-300 font-semibold">SURFACE SITE • ' + activeSite.lat.toFixed(1) + '°, ' + activeSite.lon.toFixed(1) + '°</span>' +
                '<button type="button" onclick="window.resetSurfaceFeatureZoom(event)" class="text-[8px] font-mono text-cyan-200 hover:text-white underline cursor-pointer">✕ EXIT ZOOM</button>' +
              '</div>' +
              '<div class="text-[11px] font-mono font-bold text-white my-0.5">' + activeSite.name + '</div>' +
              '<p class="text-[9.5px] leading-snug text-slate-200/95 font-sans border-t border-white/10 pt-1.5 mt-1">' + activeSite.courseNote + '</p>';
          });
        } else if (showMetricNow) {
          const d = state.matchedMetric;
          const relMode = Boolean(window._spatialMetricRelativeMode);
          const shownVal = relMode ? d.relativeVal : d.primaryVal;
          const metricKey = "METRIC:" + d.plainTitle + "|" + shownVal;
          setSmoothSatelliteCardContent(satNodesEl, metricKey, function() {
            const secondaryBadge = (d.relativeVal && d.relativeVal !== shownVal)
              ? '<span class="text-[9.5px] font-mono text-cyan-200/90">' + d.relativeVal + '</span>'
              : '';
            return '<div onclick="window.toggleSpatialMetricMode(event)" class="cursor-pointer">' +
              '<div class="flex items-center justify-between gap-1 mb-0.5">' +
                '<span class="text-[8px] font-mono uppercase tracking-widest text-cyan-300 font-semibold">' + d.courseTag + '</span>' +
                '<span class="text-[8px] font-mono text-slate-400">⇄</span>' +
              '</div>' +
              '<div class="text-[9px] font-mono uppercase tracking-wider text-slate-200 font-semibold">' + d.plainTitle + '</div>' +
              '<div class="flex items-baseline justify-between gap-2 my-1">' +
                '<span class="text-[12px] font-mono font-bold text-white">' + shownVal + '</span>' +
                secondaryBadge +
              '</div>' +
              '<p class="text-[9.5px] leading-snug text-slate-200/95 font-sans border-t border-white/10 pt-1 mt-1">' + d.explanation + '</p>' +
            '</div>';
          });
        } else {
          setSmoothSatelliteCardContent(satNodesEl, "", null);
        }

        const nodeEl = document.getElementById('spatial-sat-node-0');
        if (!nodeEl || (!activeSite && !showMetricNow)) {
          if (satSvg) satSvg.innerHTML = '';
          return;
        }

        satLayer.classList.remove('hidden');
        satLayer.style.opacity = window.getComputedStyle(mainCard).opacity || '1';

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let rawSx = vw * 0.5;
        let rawSy = vh * 0.5;
        const origLine = document.getElementById('spatial-leader-line') || document.querySelector('#spatial-telemetry-layer line');
        if (origLine) {
          const x1 = parseFloat(origLine.getAttribute('x1'));
          const y1 = parseFloat(origLine.getAttribute('y1'));
          if (!isNaN(x1) && !isNaN(y1) && x1 > 20 && y1 > 20) {
            rawSx = x1;
            rawSy = y1;
          }
        }

        const nodeW = 232;
        const nodeH = nodeEl.offsetHeight || 112;
        const mainCenterX = rect.left + rect.width * 0.5;
        const mainIsOnLeft = mainCenterX < rawSx;
        // Anchor satellite HUD on the opposite side of the planet from the main INFO card
        const sideSign = mainIsOnLeft ? 1 : -1;

        let desiredX = sideSign < 0
          ? (rawSx - 68 - nodeW - 56)
          : (rawSx + 68 + 56);
        let desiredY = rect.top + 4;
        desiredX = Math.max(24, Math.min(vw - nodeW - 24, desiredX));
        desiredY = Math.max(68, Math.min(vh - nodeH - 96, desiredY));

        // Collision guard against main #spatial-callout-card (24px buffer)
        const pad = 24;
        const overlapsMain = !(
          desiredX + nodeW + pad <= rect.left ||
          desiredX >= rect.right + pad ||
          desiredY + nodeH + pad <= rect.top ||
          desiredY >= rect.bottom + pad
        );
        if (overlapsMain) {
          const belowY = rect.bottom + pad;
          const aboveY = rect.top - nodeH - pad;
          if (belowY + nodeH <= vh - 96) {
            desiredY = belowY;
          } else if (aboveY >= 68) {
            desiredY = aboveY;
          } else {
            desiredX = mainIsOnLeft
              ? Math.min(vw - nodeW - 24, rect.right + pad)
              : Math.max(24, rect.left - nodeW - pad);
          }
        }

        // Issue 1 Fix: Deadzone hysteresis + GPU translate3d eliminates all micro-shaking in place!
        if (state.lastCardX === null || Math.hypot(desiredX - state.lastCardX, desiredY - state.lastCardY) > 1.2) {
          state.lastCardX = state.lastCardX === null ? desiredX : (state.lastCardX + (desiredX - state.lastCardX) * 0.22);
          state.lastCardY = state.lastCardY === null ? desiredY : (state.lastCardY + (desiredY - state.lastCardY) * 0.22);
        }

        const finalX = state.lastCardX;
        const finalY = state.lastCardY;
        nodeEl.style.transform = "translate3d(" + finalX.toFixed(1) + "px, " + finalY.toFixed(1) + "px, 0)";

        let targetDotX = rawSx - 42;
        let targetDotY = rawSy - 12;
        if (activeSite) {
          const latOff = Math.max(-16, Math.min(16, -((activeSite.lat || 0) / 90) * 18));
          const lonOff = Math.max(-16, Math.min(16, ((activeSite.lon || 0) / 180) * 18));
          targetDotX = rawSx + lonOff;
          targetDotY = rawSy + latOff;
        }

        if (state.lastDotX === null || Math.hypot(targetDotX - state.lastDotX, targetDotY - state.lastDotY) > 1.0) {
          state.lastDotX = state.lastDotX === null ? targetDotX : (state.lastDotX + (targetDotX - state.lastDotX) * 0.22);
          state.lastDotY = state.lastDotY === null ? targetDotY : (state.lastDotY + (targetDotY - state.lastDotY) * 0.22);
        }

        const attachX = (finalX + nodeW * 0.5 > rawSx) ? finalX : (finalX + nodeW);
        const attachY = finalY + nodeH * 0.5;

        if (satSvg) {
          satSvg.innerHTML =
            '<line x1="' + state.lastDotX.toFixed(1) + '" y1="' + state.lastDotY.toFixed(1) + '" x2="' + attachX.toFixed(1) + '" y2="' + attachY.toFixed(1) + '" stroke="rgba(56, 189, 248, 0.45)" stroke-width="1" stroke-dasharray="3 3" />' +
            '<circle cx="' + state.lastDotX.toFixed(1) + '" cy="' + state.lastDotY.toFixed(1) + '" r="' + (activeSite ? '3.5' : '2.2') + '" fill="#38bdf8" />';
        }
      } catch (err) {
        console.warn("Position loop error:", err);
      }
    };

    (function startSelfContainedLoop() {
      function step() {
        requestAnimationFrame(step);
        if (window.updateSatelliteCourseHUDPositions) {
          window.updateSatelliteCourseHUDPositions();
        }
      }
      requestAnimationFrame(step);
    })();

    function renderSpatialMetricsGrid() {
      try { if (typeof camera !== 'undefined') window._novaCamRef = camera; if (typeof controls !== 'undefined') window._novaCtrlRef = controls; } catch(e) {}
      const gridEl = document.getElementById('spatial-metrics-grid');
      const unitBtnLabel = document.getElementById('spatial-unit-toggle-label');
      if (!gridEl) return;

      const metrics = window._spatialCurrentMetrics || [];
      if (metrics.length === 0) {
        gridEl.style.display = 'none';
        gridEl.innerHTML = '';
        return;
      }

      gridEl.style.display = 'grid';
      const useRel = Boolean(window._spatialMetricRelativeMode);
      if (unitBtnLabel) {
        unitBtnLabel.textContent = useRel ? 'ABSOLUTE SI' : 'VS EARTH / SUN';
      }

      gridEl.innerHTML = metrics.map(([lbl, rawVal]) => {
        const parsed = splitMetricValue(rawVal, lbl);
        const displayVal = useRel ? parsed.relative : parsed.primary;
        const valColor = useRel ? 'text-cyan-200' : 'text-slate-100';
        return `
          <div class="spatial-hairline-cell">
            <span class="block text-[8.5px] font-mono uppercase tracking-wider text-slate-400 truncate">${lbl}</span>
            <span class="block text-[10.5px] font-mono font-semibold ${valColor} leading-snug mt-0.5 break-words">${displayVal}</span>
          </div>
        `;
      }).join('');
    }

    function renderSpatialFactDeck() {
      const sumEl = document.getElementById('spatial-target-summary');
      const lblEl = document.getElementById('spatial-deck-label');
      const cntEl = document.getElementById('spatial-deck-counter');
      const nextBtn = document.getElementById('spatial-deck-next-btn');
      if (!sumEl) return;

      const deck = window._spatialFactDeck || [];
      if (deck.length === 0) {
        sumEl.textContent = '';
        if (nextBtn) nextBtn.style.display = 'none';
        return;
      }

      const idx = ((window._spatialFactIndex % deck.length) + deck.length) % deck.length;
      const item = deck[idx];
      if (lblEl) lblEl.textContent = item.heading;
      if (cntEl) cntEl.textContent = `${idx + 1} / ${deck.length}`;
      if (nextBtn) nextBtn.style.display = deck.length > 1 ? 'flex' : 'none';
      sumEl.textContent = item.text;
    }

    window.toggleSpatialMetricMode = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      window._spatialMetricRelativeMode = !window._spatialMetricRelativeMode;
      renderSpatialMetricsGrid(); if (window.syncSatelliteCourseHUDs) window.syncSatelliteCourseHUDs();
    };

    window.cycleSpatialFactDeck = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      const deck = window._spatialFactDeck || [];
      if (deck.length <= 1) return;
      window._spatialFactIndex = (window._spatialFactIndex + 1) % deck.length;
      renderSpatialFactDeck(); if (window.syncSatelliteCourseHUDs) window.syncSatelliteCourseHUDs();
    };

    window.populateSpatialCallout = function(data, isTierOverview = false) {
      if (isTierOverview) {
        document.body.classList.add('nova-tier-sweep');
        if (typeof window.dismissSpatialCallout === 'function') window.dismissSpatialCallout();
        return;
      }
      document.body.classList.remove('nova-tier-sweep');
      if (!data) return;
      window._spatialCalloutDismissedForMesh = null;
      window._spatialFactIndex = 0;

      const nameEl = document.getElementById('spatial-target-name');
      const scaleEl = document.getElementById('spatial-target-scale');
      const metaEl = document.getElementById('spatial-target-meta');
      if (!nameEl) return;

      nameEl.textContent = data.name || data.title || 'OBJECT';

      // Extract clean order of magnitude (e.g. "10^15 m") without verbose parentheticals so title never truncates
      const rawScale = String(data.scale_order || '').trim();
      const cleanScale = rawScale.replace(/\s*\([^)]*\)/g, '').trim();
      scaleEl.textContent = cleanScale;
      scaleEl.style.display = cleanScale ? 'inline-block' : 'none';

      const typeStr = data.type || '';
      const distStr = data.distance ? String(data.distance).replace(/\s*\([^)]*\)/g, '').trim() : '';
      metaEl.textContent = (typeStr && distStr) ? `${typeStr} • ${distStr}` : (typeStr || distStr);

      const profile = isTierOverview
        ? data
        : (ASTROPHYSICAL_ARCHIVE[(data.id || '').toLowerCase()] || null);

      window._spatialCurrentMetrics = (profile && profile.metrics) ? profile.metrics.slice(0, 4) : [];
      renderSpatialMetricsGrid(); if (window.syncSatelliteCourseHUDs) window.syncSatelliteCourseHUDs();

      // Build interactive Fact Deck: [Overview Summary, Fact 1, Fact 2, Fact 3]
      const deck = [];
      if (data.summary) {
        deck.push({ heading: 'OVERVIEW', text: data.summary });
      }
      if (profile && Array.isArray(profile.facts)) {
        profile.facts.forEach((f, idx) => {
          deck.push({ heading: `ASTROPHYSICAL LOG 0${idx + 1}`, text: f });
        });
      }
      window._spatialFactDeck = deck;
      renderSpatialFactDeck(); if (window.syncSatelliteCourseHUDs) window.syncSatelliteCourseHUDs();
    };

    window.dismissSpatialCallout = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      window._spatialCalloutDismissedForMesh = activeTargetMesh;
      window._isSpatialCalloutVisible = false;
      const layer = document.getElementById('spatial-telemetry-layer');
      if (layer) layer.classList.add('opacity-0');
    };

    window.expandDeepArchiveFromCallout = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      window._forceFullSidebarOpen = true;
      window._isSpatialCalloutVisible = false;
      isOverviewToggleActive = true;
      isSidebarUserHidden = false;
      const inspector = document.getElementById('inspector');
      if (inspector) inspector.classList.remove('translate-x-[430px]');
      updateSidebarToggleStyle();
      if (typeof window.syncInteractiveMapKey === 'function') window.syncInteractiveMapKey();
    };

    window.updateSpatialCalloutPosition = function() {
      const layer = document.getElementById('spatial-telemetry-layer');
      const card = document.getElementById('spatial-callout-card');
      const line = document.getElementById('spatial-leader-line');
      const dot = document.getElementById('spatial-anchor-dot');
      const ring = document.getElementById('spatial-anchor-ring');
      if (!layer || !card || !line || !dot || !ring) return;

      const _travelPhase = (window.novaState && typeof window.novaState.getTravelPhase === 'function')
        ? window.novaState.getTravelPhase()
        : 'idle';
      const _isInTransit = Boolean(
        (typeof isFlyingToTarget !== 'undefined' && isFlyingToTarget) ||
        _travelPhase === 'traveling' ||
        _travelPhase === 'settling' ||
        document.body.classList.contains('nova-tier-sweep')
      );

      if (!isPlanetOverviewEnabled || _isInTransit) {
        window._isSpatialCalloutVisible = false;
        layer.classList.add('opacity-0');
        card.style.pointerEvents = 'none';
        return;
      }

      const inspector = document.getElementById('inspector');
      const isFullSidebarOpen = inspector && !inspector.classList.contains('translate-x-[430px]');
      if (!isFullSidebarOpen) {
        window._forceFullSidebarOpen = false;
      }

      const targetId = (activeTargetMesh && activeTargetMesh.userData && activeTargetMesh.userData.id)
        ? String(activeTargetMesh.userData.id).toLowerCase()
        : '';

      if (!activeTarget || isFullSidebarOpen) {
        window._isSpatialCalloutVisible = false;
        layer.classList.add('opacity-0');
        card.style.pointerEvents = 'none';
        return;
      }

      // Handle tier-intro stops in Cosmic Tour where activeTargetMesh is null
      if (!activeTargetMesh) {
        if (!isTourActive) {
          window._isSpatialCalloutVisible = false;
          layer.classList.add('opacity-0');
          card.style.pointerEvents = 'none';
          return;
        }
        window._isSpatialCalloutVisible = true;
        layer.classList.remove('opacity-0');
        card.style.pointerEvents = 'auto';
        card.classList.remove('callout-flipped-left');
        line.style.opacity = '0';
        dot.style.opacity = '0';
        ring.style.opacity = '0';

        const cardW = 312;
        const cardH = card.offsetHeight || 182;
        const cardX = Math.max(24, Math.min(window.innerWidth - cardW - 24, 36));
        const cardY = Math.max(70, Math.min(window.innerHeight - cardH - 88, 110));
      card.style.transform = `translate3d(${cardX.toFixed(1)}px, ${cardY.toFixed(1)}px, 0)`;
        return;
      }

      if (
        window._spatialCalloutDismissedForMesh === activeTargetMesh ||
        !isNodeVisible(activeTargetMesh)
      ) {
        window._isSpatialCalloutVisible = false;
        layer.classList.add('opacity-0');
        card.style.pointerEvents = 'none';
        return;
      }

      if (targetId === 'sun' && !isTourActive && camera.position.length() > 14.5 && !window._userClickedSunExplicitly) {
        window._isSpatialCalloutVisible = false;
        layer.classList.add('opacity-0');
        card.style.pointerEvents = 'none';
        return;
      }

      activeTargetMesh.getWorldPosition(_spatialWorldPos);

      // Gracefully fade out INFO panel when camera zooms too far from the selected object
      if (!isTourActive) {
        const distToTarget = camera.position.distanceTo(_spatialWorldPos);
        const objTier = (activeTargetMesh.userData && activeTargetMesh.userData.tier) ? activeTargetMesh.userData.tier : 1;
        const objSize = (activeTargetMesh.userData && activeTargetMesh.userData.size) ? Number(activeTargetMesh.userData.size) : 1.0;
        const maxCalloutDist = objTier === 1
          ? Math.max(12, objSize * 10)
          : Math.max(objTier === 2 ? 95 : (objTier === 3 ? 220 : 420), objSize * 14);
        if (distToTarget > maxCalloutDist) {
          window._isSpatialCalloutVisible = false;
          layer.classList.add('opacity-0');
          card.style.pointerEvents = 'none';
          return;
        }
      }

      _spatialProjVec.copy(_spatialWorldPos).project(camera);

      if (_spatialProjVec.z > 1.0) {
        window._isSpatialCalloutVisible = false;
        layer.classList.add('opacity-0');
        card.style.pointerEvents = 'none';
        return;
      }

      const sx = (_spatialProjVec.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-_spatialProjVec.y * 0.5 + 0.5) * window.innerHeight;

      if (sx < 20 || sx > window.innerWidth - 20 || sy < 20 || sy > window.innerHeight - 20) {
        window._isSpatialCalloutVisible = false;
        layer.classList.add('opacity-0');
        card.style.pointerEvents = 'none';
        return;
      }

      const _nameEl = document.getElementById('spatial-target-name');
      const _hasCardText = Boolean(_nameEl && _nameEl.textContent && _nameEl.textContent.trim().length > 0);
      if (!_hasCardText) {
        window._isSpatialCalloutVisible = false;
        layer.classList.add('opacity-0');
        card.style.pointerEvents = 'none';
        return;
      }

      line.style.opacity = '1';
      dot.style.opacity = '1';
      ring.style.opacity = '1';
      window._isSpatialCalloutVisible = true;
      layer.classList.remove('opacity-0');
      card.style.pointerEvents = 'auto';

      // Compute Apparent Screen Radius in Pixels so the leader line anchors on the outer limb and NEVER covers the object or accretion disk
      const distToCam = Math.max(0.1, camera.position.distanceTo(_spatialWorldPos));
      const fovRad = (camera.fov * Math.PI) / 180.0;
      const pxPerUnit = (window.innerHeight * 0.5) / Math.max(0.05, Math.tan(fovRad * 0.5) * distToCam);
      const baseSize = (activeTarget && activeTarget.size) ? Number(activeTarget.size) : 1.0;

      // Data-driven visual clearance from static/catalog.json
      const haloMultiplier = (activeTarget && typeof activeTarget.haloMultiplier === "number")
        ? activeTarget.haloMultiplier
        : 1.15;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxVisualR = Math.min(vw, vh) * 0.44;
      const apparentRadiusPx = Math.max(16, Math.min(maxVisualR, baseSize * haloMultiplier * pxPerUnit));

      const cardW = card.offsetWidth || 280;
      const cardH = card.offsetHeight || 150;
      const safeTop = 66;
      const safeBottom = vh - 96;
      const safeLeft = 22;
      const safeRight = vw - 22;

      // Evaluate 4 outer-rim quadrants to find the cleanest, darkest empty space
      const gap = 28;
      const diagR = apparentRadiusPx * 0.94;
      const candidates = [
        // 0: Top-Right
        { id: 0, dirX: 1,  dirY: -1, angle: 0.45,
          rawX: sx + Math.cos(0.32) * apparentRadiusPx + gap,
          rawY: sy - Math.sin(0.55) * apparentRadiusPx - cardH * 0.65 },
        // 1: Top-Left
        { id: 1, dirX: -1, dirY: -1, angle: 0.45,
          rawX: sx - Math.cos(0.32) * apparentRadiusPx - gap - cardW,
          rawY: sy - Math.sin(0.55) * apparentRadiusPx - cardH * 0.65 },
        // 2: Bottom-Right
        { id: 2, dirX: 1,  dirY: 1,  angle: -0.45,
          rawX: sx + Math.cos(0.32) * apparentRadiusPx + gap,
          rawY: sy + Math.sin(0.45) * apparentRadiusPx - cardH * 0.35 },
        // 3: Bottom-Left
        { id: 3, dirX: -1, dirY: 1,  angle: -0.45,
          rawX: sx - Math.cos(0.32) * apparentRadiusPx - gap - cardW,
          rawY: sy + Math.sin(0.45) * apparentRadiusPx - cardH * 0.35 }
      ];

      // Measure how much a candidate box overlaps the bright object disc
      function discOverlapScore(cx, cy) {
        const closestX = Math.max(cx, Math.min(sx, cx + cardW));
        const closestY = Math.max(cy, Math.min(sy, cy + cardH));
        const dist = Math.hypot(closestX - sx, closestY - sy);
        const clearance = dist - apparentRadiusPx;
        return clearance < 0 ? (-clearance * 6.0) : Math.max(0, 18 - clearance) * 0.4;
      }

      const prevQuad = (typeof window._novaCalloutQuad === 'number') ? window._novaCalloutQuad : 0;
      let best = null;
      let bestScore = Infinity;

      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        const clampedX = Math.max(safeLeft, Math.min(safeRight - cardW, c.rawX));
        const clampedY = Math.max(safeTop, Math.min(safeBottom - cardH, c.rawY));
        const clampPenalty = (Math.abs(clampedX - c.rawX) + Math.abs(clampedY - c.rawY)) * 1.35;
        const overlapPenalty = discOverlapScore(clampedX, clampedY);
        // Subtle preference for upper quadrants & current quadrant hysteresis to prevent jitter
        const verticalBias = c.dirY > 0 ? 18 : 0;
        const hysteresis = (c.id === prevQuad) ? -28 : 0;
        const score = overlapPenalty + clampPenalty + verticalBias + hysteresis;
        if (score < bestScore) {
          bestScore = score;
          best = { ...c, cardX: clampedX, cardY: clampedY, overlap: overlapPenalty };
        }
      }

      window._novaCalloutQuad = best.id;
      const flipLeft = best.dirX < 0;
      const dir = best.dirX;
      card.classList.toggle('callout-flipped-left', flipLeft);

      // Automatically enable edgeless adaptive blur ONLY when forced over a bright/busy object
      card.classList.toggle('nova-busy-bg', best.overlap > 14);

      // Anchor reticle cleanly on the object's outer rim facing the chosen empty quadrant
      const cardX = best.cardX;
      const cardY = best.cardY;
      const attachX = flipLeft ? (cardX + cardW) : cardX;
      const attachY = cardY + Math.min(28, cardH * 0.25);

      const vecAngle = Math.atan2(attachY - sy, attachX - sx);
      const anchorX = sx + Math.cos(vecAngle) * (apparentRadiusPx * 0.92);
      const anchorY = sy + Math.sin(vecAngle) * (apparentRadiusPx * 0.92);
      const elbowX = anchorX + dir * 24;

      card.style.transform = `translate3d(${cardX.toFixed(1)}px, ${cardY.toFixed(1)}px, 0)`;
      dot.setAttribute('cx', anchorX.toFixed(1));
      dot.setAttribute('cy', anchorY.toFixed(1));
      ring.setAttribute('cx', anchorX.toFixed(1));
      ring.setAttribute('cy', anchorY.toFixed(1));
      line.setAttribute('points', `${anchorX.toFixed(1)},${anchorY.toFixed(1)} ${elbowX.toFixed(1)},${attachY.toFixed(1)} ${attachX.toFixed(1)},${attachY.toFixed(1)}`);
    };

    window.novaGetCatalog = function() {
      return (typeof celestialObjects !== "undefined" && Array.isArray(celestialObjects)) ? celestialObjects : [];
    };

    window.novaGetTelemetry = function() {
      if (typeof camera === "undefined" || typeof controls === "undefined" || !camera || !controls) return null;
      const offset = camera.position.clone().sub(controls.target);
      const dist = offset.length();
      // Azimuth (0 - 359.9 deg) and Elevation (-90 - +90 deg) relative to ecliptic plane
      let az = (Math.atan2(offset.x, offset.z) * 180) / Math.PI;
      if (az < 0) az += 360;
      const horiz = Math.hypot(offset.x, offset.z);
      const el = (Math.atan2(offset.y, horiz) * 180) / Math.PI;
      const tier = (typeof activeTarget !== "undefined" && activeTarget && activeTarget.tier) ? activeTarget.tier : 1;
      return { az, el, dist, tier };
    };

    window.novaSlewToMesh = function(mesh, override) {
      if (!mesh || !mesh.userData) return false;
      if (typeof controls !== "undefined" && controls) controls.enabled = true;
      activeTargetMesh = mesh;
      if (mesh.userData.id) setDeepLinkTarget(mesh.userData.id);
      if (typeof isPlanetOverviewEnabled !== "undefined" && isPlanetOverviewEnabled && typeof openInspector === "function") {
        openInspector(mesh.userData);
      } else {
        activeTarget = mesh.userData;
        if (typeof window.dismissSpatialCallout === "function") window.dismissSpatialCallout();
      }
      window._novaFlyOverride = override || null;
      window.smoothFlyToTarget();
      return true;
    };

    // Authoritative NASA/JPL Horizons (AU) & NASA/ESA/Gaia/JWST (light-years) distance catalog

    function computeNasaJumpDistance(fromId, toId) {
      const f = (fromId || "sun").toLowerCase();
      const t = (toId || "sun").toLowerCase();
      if (f === t) return { value: 0, unit: "AU" };
      if ((f === "earth" && t === "moon") || (f === "moon" && t === "earth")) {
        return { value: 384400, unit: "km" };
      }
      const fAU = NOVA_NASA_DIST_AU[f];
      const tAU = NOVA_NASA_DIST_AU[t];
      if (fAU !== undefined && tAU !== undefined) {
        return { value: Math.abs(tAU - fAU), unit: "AU" };
      }
      const fLy = NOVA_NASA_DIST_LY[f] !== undefined ? NOVA_NASA_DIST_LY[f] : (fAU !== undefined ? fAU / 63241.077 : 0);
      const tLy = NOVA_NASA_DIST_LY[t] !== undefined ? NOVA_NASA_DIST_LY[t] : (tAU !== undefined ? tAU / 63241.077 : 0);
      return { value: Math.abs(tLy - fLy), unit: "ly" };
    }

    window._novaLastTargetId = window._novaLastTargetId || "sun";
    window._novaTravelState = window._novaTravelState || { active: false, current: 0, total: 0, unit: "AU" };

    function computeTravelDurationMs(jump) {
      if (!jump || !jump.value || jump.value <= 0) return 1500;
      let distAU = jump.value;
      if (jump.unit === "km") distAU = jump.value / 149597870.7;
      else if (jump.unit === "ly") distAU = jump.value * 63241.077;
      const logAU = Math.log10(Math.max(distAU, 0.0025));
      // Normalize from lunar distance (~-2.6) to observable-universe edge (~15.0)
      const norm = Math.max(0, Math.min(1, (logAU + 2.6) / 17.6));
      return Math.round(1300 + Math.pow(norm, 1.5) * 6900);
    }

    window.smoothFlyToTarget = function(durationMs) {
      if (!activeTargetMesh) return;
      const nextId = (activeTarget && activeTarget.id) ? String(activeTarget.id).toLowerCase() : "sun";
      const jump = computeNasaJumpDistance(window._novaLastTargetId, nextId);
      window._novaLastTargetId = nextId;
      window._novaTravelState = { active: jump.value > 0, current: 0, total: jump.value, unit: jump.unit };
      const effectiveDuration = (typeof durationMs === "number" && durationMs > 0)
        ? durationMs
        : computeTravelDurationMs(jump);

      TWEEN.removeAll();
      isFlyingToTarget = true;
      if (window.novaState) window.novaState.setTravelPhase("traveling");

      const startCamPos = camera.position.clone();
      const startTargetPos = controls.target.clone();

      
      const objRadius = (activeTarget && activeTarget.size) ? activeTarget.size : 1.0;
      const targetId = (activeTarget && activeTarget.id) ? activeTarget.id.toLowerCase() : '';
      const targetType = (activeTarget && activeTarget.type) ? activeTarget.type.toLowerCase() : '';
      const targetTier = (activeTarget && activeTarget.tier) ? activeTarget.tier : 1;

      // Keep planets, moons, and compact stars at 3.2x, but pull back for large structures
      let multiplier = 3.2;

      if (targetId === 'sagittarius-a-star') {
        multiplier = 6.2;
      } else if (['milky-way', 'andromeda', 'sombrero-galaxy', 'ton-618', 'messier-87'].includes(targetId)) {
        // Massive spiral disks, quasars & galactic cores (matches your 9.44.52 PM target screenshot)
        multiplier = 13.5;
      } else if (['eagle-nebula', 'orion-nebula', 'el-gordo', 'shapley-supercluster', 'great-attractor', 'bootes-void'].includes(targetId)) {
        // Expansive volumetric nebulae & superclusters
        multiplier = 9.5;
      } else if (['centaurus-a', 'crab-nebula', 'lmc', 'smc', 'smacs-0723', 'gn-z11', 'triangulum', 'pillars-of-creation'].includes(targetId)) {
        // Medium-large galaxies & supernova remnants
        multiplier = 7.5;
      } else if (targetType.includes('galaxy') || targetType.includes('cluster') || targetType.includes('nebula') || targetType.includes('quasar') || targetType.includes('void') || targetTier >= 3) {
        // Catch-all for any other deep-space galaxy/cluster/nebula
        multiplier = 9.0;
      } else if (objRadius >= 3.0 && targetId !== 'sun') {
        // Large supergiant stars or oversized bodies
        multiplier = 6.0;
      }

      const baseDist = Math.max(objRadius * multiplier, 4.2);
      let offsetDist = baseDist;
      if (window._novaFlyOverride) {
        const ov = window._novaFlyOverride;
        window._novaFlyOverride = null;
        const minSafe = Math.max(objRadius * 1.45, 1.8);
        if (typeof ov.radii === "number" && ov.radii > 0) {
          offsetDist = Math.max(objRadius * ov.radii, minSafe);
        } else if (typeof ov.zoom === "number" && ov.zoom > 0) {
          offsetDist = Math.max(baseDist / ov.zoom, minSafe);
        }
      }



      const viewDir = startCamPos.clone().sub(startTargetPos);
      if (viewDir.lengthSq() < 0.001) viewDir.set(0.6, 0.3, 0.8);
      viewDir.normalize();

      // Balanced close-up elevation (head-on relativistic framing for Sagittarius A*)
      const offsetVec = (targetId === 'sagittarius-a-star')
        ? new THREE.Vector3(0, offsetDist * 0.08, offsetDist)
        : new THREE.Vector3(
            viewDir.x * offsetDist,
            Math.max(offsetDist * 0.28, 1.4),
            viewDir.z * offsetDist
          );

      const tweenObj = { t: 0 };
      new TWEEN.Tween(tweenObj)
        .to({ t: 1 }, effectiveDuration)
        .easing(TWEEN.Easing.Cubic.InOut)
        .onUpdate(() => {
          if (!activeTargetMesh) return;
          const currentWorldPos = new THREE.Vector3();
          activeTargetMesh.getWorldPosition(currentWorldPos);

          const desiredEndCam = currentWorldPos.clone().add(offsetVec);
          camera.position.lerpVectors(startCamPos, desiredEndCam, tweenObj.t);
          controls.target.lerpVectors(startTargetPos, currentWorldPos, tweenObj.t);
          lastTrackedTargetPos.copy(currentWorldPos);
          if (window._novaTravelState) {
            window._novaTravelState.current = window._novaTravelState.total * tweenObj.t;
            window._novaTravelState.active = tweenObj.t < 0.995;
          }
        })
        .onComplete(() => {
          isFlyingToTarget = false;
          if (typeof controls !== "undefined" && controls) controls.enabled = true;
          if (activeTargetMesh) {
            activeTargetMesh.getWorldPosition(lastTrackedTargetPos);
          }
          if (window.novaState) window.novaState.setTravelPhase("arrived");
        })
        .start();
    };

    let isTierMenuOpen = false;

    function setTierMenuOpen(open) {
      isTierMenuOpen = open;
      const menu = document.getElementById("tier-vertical-menu");
      const btn0 = document.getElementById("btn-t0");
      if (!menu) return;
      if (open) {
        menu.classList.remove("tier-menu-closed", "hidden", "opacity-0", "translate-y-2", "pointer-events-none");
        menu.classList.add("tier-menu-open");
        if (btn0) btn0.setAttribute("aria-expanded", "true");
      } else {
        menu.classList.remove("tier-menu-open", "opacity-100", "translate-y-0", "pointer-events-auto");
        menu.classList.add("tier-menu-closed");
        if (btn0) btn0.setAttribute("aria-expanded", "false");
      }
    }

    window.closeTierMenu = function() {
      setTierMenuOpen(false);
    };

    window.toggleTierMenu = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      const nextOpen = !isTierMenuOpen;
      setTierMenuOpen(nextOpen);
      window.filterTier(0);
    };

    window.selectTierFromMenu = function(tier, e) {
      if (e && e.stopPropagation) e.stopPropagation();
      const nextTier = (manualTierLock === tier) ? 0 : tier;
      window.filterTier(nextTier);
    };

    document.addEventListener("pointerdown", (e) => {
      if (!isTierMenuOpen) return;
      const group = document.getElementById("bottom-tier-group");
      if (group && !group.contains(e.target)) {
        setTierMenuOpen(false);
      }
    });

    window.filterTier = function(tier) {
      manualTierLock = tier;
      setDeepLinkTier(tier);
      for (let i = 0; i <= 4; i++) {
        const btn = document.getElementById(`btn-t${i}`);
        if (!btn) continue;
        if (i === tier || (i === 0 && isTierMenuOpen && tier === 0)) {
          btn.className = UNIFIED_TOGGLE_ACTIVE_CLASS;
        } else {
          btn.className = "relative w-8 h-8 rounded-full bg-slate-900/70 border border-slate-700/80 hover:border-cyan-400/60 flex items-center justify-center text-slate-400 hover:text-cyan-300 transition duration-300 transform hover:scale-110 shrink-0 cursor-pointer shadow-lg";
        }
      }

      celestialObjects.forEach(mesh => {
        const isMatch = (tier === 0 || mesh.userData.tier === tier);
        mesh.visible = isMatch;
        if (mesh.userData.orbitLine) {
          mesh.userData.orbitLine.visible = isMatch;
        }
      });

      if (sagAGroup) sagAGroup.visible = (tier === 0 || tier === 2);
      if (siriusBarycenterGroup) siriusBarycenterGroup.visible = (tier === 0 || tier === 2);
      if (alphaCentauriGroup) alphaCentauriGroup.visible = (tier === 0 || tier === 2);
      if (asteroidBelt) asteroidBelt.visible = (tier === 0 || tier === 1);
      if (oortCloudGroup) oortCloudGroup.visible = (tier === 0 || tier === 1);
      if (milkyWayGroup) milkyWayGroup.visible = (tier === 0 || tier === 2);
      if (andromedaGroup) andromedaGroup.visible = (tier === 0 || tier === 3);
      if (triangulumGroup) triangulumGroup.visible = (tier === 0 || tier === 3);

      if (cosmicWebGroup) {
        cosmicWebGroup.visible = isCosmicWebVisible;
      }

      if (!isTourActive && activeTarget && activeTargetMesh && !isNodeVisible(activeTargetMesh)) {
        closeInspector();
      }
    };

    let isDraggingSlider = false;
    const minZoomDist = 4.0;
    const maxZoomDist = 22000.0;

    function onScaleSliderInput(val) {
      isDraggingSlider = true;
      const sliderVal = parseFloat(val); // 1.0 (left: zoomed out) to 4.0 (right: zoomed in)
      // Inverted exponential scale mapping: dragging left-to-right zooms in, right-to-left zooms out
      const t = (4.0 - sliderVal) / 3.0;
      const targetDist = minZoomDist * Math.pow(maxZoomDist / minZoomDist, t);

      const diff = camera.position.clone().sub(controls.target);
      if (diff.lengthSq() < 0.001) diff.set(0, 1, 1);
      const dir = diff.normalize();

      camera.position.copy(controls.target.clone().add(dir.multiplyScalar(targetDist)));
      controls.update();
      setTimeout(() => { isDraggingSlider = false; }, 120);
    }

    // Sync slider position when using trackpad two-finger scroll / pinch zoom
    function updateScaleSliderFromCamera() {
      if (isDraggingSlider) return;
      const slider = document.getElementById("scale-slider");
      if (!slider) return;
      const currentDist = camera.position.distanceTo(controls.target);
      const clampedDist = Math.max(minZoomDist, Math.min(maxZoomDist, currentDist));
      const t = Math.log(clampedDist / minZoomDist) / Math.log(maxZoomDist / minZoomDist);
      const sliderVal = 4.0 - t * 3.0;
      slider.value = sliderVal.toFixed(3);
    }

    function synthesizeDirectAstrophysicalAnswer(target, rawQuery) {
      const q = (rawQuery || "").toLowerCase().trim();
      const id = target.id;
      const arch = ASTROPHYSICAL_ARCHIVE[id] || {};
      const metricsMap = {};
      (arch.metrics || []).forEach(([k, v]) => { metricsMap[k.toLowerCase()] = `${k}: ${v}`; });
      const facts = arch.facts || [];

      // Topic-specific deep Q&A dictionary for natural, accurate answers
      const TOPIC_QA = {
        "saturn": {
          "ring": "Saturn's main ring system spans 282,000 km across (divided into the D, C, B, Cassini Division, A, F, G, and E rings) yet is only 10 to 30 meters thick. It is composed of 99.9% pure water-ice particles ranging in size from microscopic frost grains to house-sized boulders, likely formed from a tidally shattered icy moon or comet within Saturn's Roche limit.",
          "moon": "Saturn has 146 confirmed moons. Its largest moon, Titan (5,149 km diameter), possesses a dense nitrogen-rich atmosphere and liquid methane/ethane seas, while Enceladus vents hydrothermal water-ice plumes from a global subsurface ocean at its south pole.",
          "hex": "Saturn's north pole hosts a persistent 29,000-km-wide hexagonal standing wave in its atmospheric jet stream, driven by steep latitudinal wind-shear gradients Rotating with a period of 10h 39m."
        },
        "uranus": {
          "ring": "Uranus possesses 13 narrow, remarkably dark rings (albedo < 5%) composed of radiation-darkened organic ice boulders and dust, discovered in 1977 during a stellar occultation and flanked by small shepherd moons like Cordelia and Ophelia."
        },
        "jupiter": {
          "ring": "Jupiter has a faint, dusty 4-part ring system (halo, main ring, and two gossamer rings) discovered by Voyager 1 in 1979, continuously replenished by micrometeoroid impacts blasting dust off its inner moons Metis, Adrastea, Amalthea, and Thebe.",
          "spot": "The Great Red Spot is a high-pressure anticyclonic storm in Jupiter's southern hemisphere spanning ~16,350 km across (wider than Earth), featuring 430–680 km/h peripheral winds and persisting for over 300 years."
        },
        "neptune": {
          "ring": "Neptune is encircled by five faint, dusty rings (Galle, Le Verrier, Lassell, Arago, and Adams) featuring bright clumpy arcs ('Fraternité', 'Égalité', 'Liberté') stabilized by the gravitational resonance of its inner moon Galatea."
        }
      };

      if (TOPIC_QA[id]) {
        for (const [kw, ans] of Object.entries(TOPIC_QA[id])) {
          if (q.includes(kw)) return ans;
        }
      }

      // Match query keywords against the object's facts and metrics
      const keywords = q.replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2 && !["what", "are", "the", "how", "why", "does", "for", "about", "tell", "with", "from", "that", "this"].includes(w));

      const matchedFacts = facts.filter(f => keywords.some(kw => f.toLowerCase().includes(kw)));
      const matchedMetrics = (arch.metrics || []).filter(([k, v]) => keywords.some(kw => k.toLowerCase().includes(kw) || v.toLowerCase().includes(kw)));

      if (q.includes("ring")) {
        const ringFact = facts.find(f => f.toLowerCase().includes("ring"));
        if (ringFact) return ringFact;
        return `${target.name} does not possess a prominent planetary ring system; in our Solar System, only the four giant planets (Jupiter, Saturn, Uranus, and Neptune) and minor bodies like Chariklo and Haumea maintain ring systems.`;
      }
      if (q.includes("moon") || q.includes("satellite")) {
        const moonFact = facts.find(f => /moon|satellite|titan|enceladus|triton|ganymede|europa|phobos|theia/i.test(f));
        if (moonFact) return moonFact;
      }
      if (q.includes("temp") || q.includes("hot") || q.includes("cold") || q.includes("heat")) {
        const tempMetric = (arch.metrics || []).find(([k]) => /temp|heat/i.test(k));
        const tempFact = facts.find(f => /temp|kelvin|°c|greenhouse|cold|hot|thermal/i.test(f));
        if (tempMetric && tempFact) return `${tempMetric[0]} is ${tempMetric[1]}. ${tempFact}`;
        if (tempMetric) return `${target.name}'s ${tempMetric[0].toLowerCase()} is ${tempMetric[1]}.`;
      }
      if (q.includes("mass") || q.includes("size") || q.includes("big") || q.includes("radius") || q.includes("large") || q.includes("heavy") || q.includes("dens")) {
        const sizeMetrics = (arch.metrics || []).filter(([k]) => /mass|radius|diameter|span|size|density|volume/i.test(k)).map(([k, v]) => `${k}: ${v}`).join(" • ");
        const sizeFact = facts.find(f => /mass|radius|size|largest|diameter|volume|dense/i.test(f));
        return [sizeMetrics, sizeFact].filter(Boolean).join(" — ") || target.summary;
      }
      if (q.includes("dist") || q.includes("far") || q.includes("where") || q.includes("locat") || q.includes("light")) {
        return `${target.name} is located at a distance of ${target.distance} (scale regime ${target.scale_order}). ${facts[0] || target.summary}`;
      }
      if (q.includes("orbit") || q.includes("year") || q.includes("rotat") || q.includes("spin") || q.includes("day") || q.includes("speed") || q.includes("vel")) {
        const kinMetrics = (arch.metrics || []).filter(([k]) => /orbit|period|rotat|spin|vel|day|reson/i.test(k)).map(([k, v]) => `${k}: ${v}`).join(" • ");
        const kinFact = facts.find(f => /orbit|rotat|spin|year|day|perihelion|velocity|km\/s/i.test(f));
        return [kinMetrics, kinFact].filter(Boolean).join(" — ") || target.summary;
      }
      if (q.includes("comp") || q.includes("made") || q.includes("atmos") || q.includes("gas") || q.includes("core") || q.includes("surface") || q.includes("water") || q.includes("ice")) {
        const compFact = facts.find(f => /hydrogen|helium|iron|silicate|water|ice|co₂|atmosphere|methane|crust|core|plasma|dust/i.test(f));
        if (compFact) return compFact;
      }

      if (matchedFacts.length > 0 || matchedMetrics.length > 0) {
        const mText = matchedMetrics.map(([k, v]) => `${k}: ${v}`).join(" • ");
        return [mText, ...matchedFacts].filter(Boolean).join(" ");
      }

      return `${target.summary} ${facts.join(" ")}`.trim();
    }

    window.queryGemini = async function() {
      const box = document.getElementById('ai-telemetry');
      if (!box || !activeTarget) return;
      const input = document.getElementById('custom-query-input');
      const query = input.value.trim();
      if (!query) return;

      box.classList.remove('hidden');
      box.innerHTML = `<span class="text-cyan-400 animate-pulse font-mono text-xs">Querying astrophysical archive...</span>`;

      try {
        const res = await fetch('/api/inquire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ object_id: activeTarget.id, custom_query: query })
        });
        const data = await res.json();
        let reply = (data && data.telemetry) ? data.telemetry.trim() : "";

        // Detect if the backend returned the generic template string ("Astrophysical inquiry analysis for [...]")
        const isGenericTemplate = !reply || /Astrophysical inquiry analysis for\s*\[/i.test(reply) || /exhibits characteristic properties matching/i.test(reply);

        if (isGenericTemplate) {
          reply = synthesizeDirectAstrophysicalAnswer(activeTarget, query);
        } else {
          // Strip any leading boilerplate prefix if present
          reply = reply.replace(/^Astrophysical inquiry analysis for\s*\[[^\]]*\]:\s*(Regarding\s*'[^']*'\s*[—\-:]\s*)?/i, "");
        }

        box.innerHTML = `<div class="text-slate-100 leading-relaxed font-sans">${reply}</div>`;
        input.value = "";
      } catch (err) {
        const fallback = synthesizeDirectAstrophysicalAnswer(activeTarget, query);
        box.innerHTML = `<div class="text-slate-100 leading-relaxed font-sans">${fallback}</div>`;
        input.value = "";
      }
    };

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function updateOdometerReadout(camDist, tVal) {
      if (camDist < 120) {
        odoMetric.textContent = "10^9 to 10^13 m";
        odoDist.textContent = `${Math.max(0.05, (camDist / 50)).toFixed(2)} AU (Heliosphere)`;
        odoTier.textContent = "Tier 1: Solar System";
      } else if (camDist < 550) {
        odoMetric.textContent = "10^16 to 10^21 m";
        odoDist.textContent = `${(camDist * 60).toFixed(0)} ly (Orion Arm)`;
        odoTier.textContent = "Tier 2: Stellar Neighborhood";
      } else if (camDist < 1400) {
        odoMetric.textContent = "10^22 to 10^24 m";
        odoDist.textContent = `${(camDist * 0.05).toFixed(2)} Mly (Local Group)`;
        odoTier.textContent = "Tier 3: Galaxies & Superclusters";
      } else {
        odoMetric.textContent = "10^25 to 10^26 m";
        odoDist.textContent = `${(camDist * 0.02).toFixed(1)} Gly (Observable Radius)`;
        odoTier.textContent = "Tier 4: Deep Web & Horizon";
      }
    }

    function updateAdaptiveScale(camDist) {
      let tVal = 1.0;
      if (camDist <= 120) {
        tVal = 1.0 + Math.max(0, (camDist - 5.0) / 115.0);
      } else if (camDist <= 550) {
        tVal = 2.0 + ((camDist - 120.0) / 430.0);
      } else {
        tVal = 3.0 + ((camDist - 550.0) / 14500.0);
      }

      if (!isUserDraggingSlider) {
        const clampedT = Math.min(4.0, Math.max(1.0, tVal));
        scaleSlider.value = (5.0 - clampedT).toFixed(4);
        updateOdometerReadout(camDist, tVal);
      }

      if (cmbMaterial) {
        if (camDist < 1200) {
          cmbMaterial.opacity = 0.0;
        } else if (camDist >= 2600) {
          cmbMaterial.opacity = 0.075;
        } else {
          const norm = (camDist - 1200) / (2600 - 1200);
          const smooth = norm * norm * (3 - 2 * norm);
          cmbMaterial.opacity = 0.075 * smooth;
        }
      }

      if (cosmicWebGroup) {
        cosmicWebGroup.visible = isCosmicWebVisible;
      }
    }

    function ensurePhotorealisticLighting() {
      if (window._photorealLightsAdded) return;
      window._photorealLightsAdded = true;

      // Solar PointLight at origin (0,0,0) with infinite range and zero distance decay for consistent lighting across scales
      const solarLight = new THREE.PointLight(0xfffbeb, 3.6, 0, 0);
      solarLight.position.set(0, 0, 0);
      scene.add(solarLight);

      // Minimal deep-space starlight fill so night hemispheres stay authentically dark
      const hemiLight = new THREE.HemisphereLight(0xcbd5e1, 0x1e293b, 0.24);
    const starlightRim = new THREE.DirectionalLight(0x93c5fd, 0.32);
    starlightRim.position.set(-120, 80, -140);
    scene.add(starlightRim);
      scene.add(hemiLight);

      if (typeof renderer !== "undefined" && renderer) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.12;
      }
    }

    
    // === COSMIC PERSPECTIVE & DEPTH SHELL RESCALER ===
    function applyCosmicDepthProportions(item) {
      if (!item || !item.position || item.position.length < 3) return;
      const id = (item.id || '').toLowerCase();
      const type = (item.type || '').toLowerCase();
      const tier = item.tier || 1;

      // Keep Solar System (Tier 1: Sun, Planets, Moons, Asteroid Belt) untouched at the core
      const solarSystemIds = [
        'sun', 'sol', 'mercury', 'venus', 'earth', 'moon', 'mars',
        'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'ceres', 'halley'
      ];
      if (tier === 1 || solarSystemIds.includes(id) || type.includes('planet') || type === 'moon') {
        return;
      }

      let x = item.position[0], y = item.position[1], z = item.position[2];
      let currentDist = Math.sqrt(x * x + y * y + z * z);
      if (currentDist < 0.001) currentDist = 1.0;

      // Unit direction vector from Sol Core (0,0,0)
      const ux = x / currentDist;
      const uy = y / currentDist;
      const uz = z / currentDist;

      // Assign target radial distance shell based on astrophysical category/tier
      let targetDist = currentDist;
      if (['el-gordo', 'shapley-supercluster', 'great-attractor', 'smacs-0723', 'gn-z11', 'ton-618', 'bootes-void'].includes(id) || tier === 4) {
        // Tier 4: Deep Cosmological Web & Quasars
        targetDist = 2800 + (currentDist * 8.5);
      } else if (['andromeda', 'sombrero-galaxy', 'centaurus-a', 'messier-87', 'lmc', 'smc', 'triangulum'].includes(id) || type.includes('galaxy') || tier === 3) {
        // Tier 3: Galaxies & Local Group
        targetDist = 1100 + (currentDist * 5.2);
      } else if (['eagle-nebula', 'crab-nebula', 'orion-nebula', 'pillars-of-creation'].includes(id) || type.includes('nebula')) {
        // Tier 2B: Galactic Nebulae & Supernova Remnants
        targetDist = 480 + (currentDist * 3.0);
      } else {
        // Tier 2A: Stellar Neighbors, Pulsars, Stellar Black Holes
        targetDist = 260 + (currentDist * 2.2);
      }

      // Add vertical (Y-axis) 3D dispersion so objects don't sit on a flat pancake plane
      const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const verticalSpread = Math.sin(hash * 1.37) * 0.38;
      const ny = uy + verticalSpread;
      const norm = Math.sqrt(ux * ux + ny * ny + uz * uz) || 1.0;

      item.position[0] = (ux / norm) * targetDist;
      item.position[1] = (ny / norm) * targetDist;
      item.position[2] = (uz / norm) * targetDist;
    }

    
    function applyCharacteristicTexturesToScene() {
      if (window._isApplyingTextures) return;
      window._isApplyingTextures = true;
      ensurePhotorealisticLighting();

      const meshQueue = [];
      scene.traverse((obj) => {
        if (!obj.isMesh || !obj.geometry || !obj.material) return;
        if (obj.userData && obj.userData._nasaTextured) return;
        if (obj.geometry.type === 'RingGeometry' || obj.geometry.type === 'TorusGeometry' || obj.geometry.type === 'ConeGeometry') return;

        const meta = (obj.userData && obj.userData.name) ? obj.userData :
                     (obj.parent && obj.parent.userData && obj.parent.userData.name) ? obj.parent.userData : null;
        if (!meta || !meta.name) return;
        if (obj.material.wireframe) return;
        if (['sagittarius-a-star', 'ton-618', 'andromeda', 'triangulum', 'sombrero-galaxy', 'messier-87', 'bootes-void', 'el-gordo', 'centaurus-a', 'crab-nebula', 'eagle-nebula', 'orion-nebula', 'lmc', 'smc', 'great-attractor', 'shapley-supercluster', 'smacs-0723', 'gn-z11'].includes(meta.id)) return;
        if (obj.material.transparent && obj.material.opacity < 0.75) return;

        const kind = classifyMeshTextureKind(meta.name, meta.type);
        if (!kind) return;
        meshQueue.push({ obj, meta, kind });
      });

      let qIdx = 0;
      let texturedCount = 0;

      function processTextureBatch() {
        const startT = performance.now();
        while (qIdx < meshQueue.length && (performance.now() - startT) < 8) {
          const { obj, meta, kind } = meshQueue[qIdx++];
          if (obj.userData._nasaTextured) continue;

          const procTex = buildNASACanvasTexture(kind);
          const bumpTex = nasaBumpCache[kind];
          const isSelfLuminous = (kind === 'sun' || kind.startsWith('star-') || kind === 'stephenson' || kind.startsWith('nebula-') || kind.startsWith('galaxy-'));

          if (kind === 'sun') {
            obj.material = createAnimatedSunMaterial();
            if (!obj.getObjectByName("sun-chromosphere-spicules")) {
              obj.add(createAnimatedCoronaLayer((meta && meta.size) ? meta.size : 2.5));
            }
          } else if (isSelfLuminous) {
            obj.material = new THREE.MeshStandardMaterial({
              map: procTex,
              emissiveMap: procTex,
              emissive: new THREE.Color(0xffffff),
              emissiveIntensity: 1.15,
              roughness: 0.9,
              metalness: 0.0
            });
          } else {
            const isOceanWorld = (kind === 'earth');
            const isGasGiant = (kind === 'jupiter' || kind === 'saturn' || kind === 'uranus' || kind === 'neptune' || kind === 'venus');
            const isOumuamua = (kind === 'oumuamua');
            // === NOVA UPGRADE: HIGH-RELIEF 3D CRATER & BEDROCK DISPLACEMENT ===
            const isCrateredRocky = (kind === 'ceres' || kind === 'moon' || kind === 'mercury' || kind === 'mars');
            let reliefTex = bumpTex || null;
            let dispScale = 0.0;

            if (isCrateredRocky) {
              // Subdivide geometry so vertex displacement carves jagged silhouettes & real crater bowls
              const baseR = (meta && meta.size) ? meta.size : 0.4;
              if (obj.geometry && obj.geometry.type === 'SphereGeometry') {
                obj.geometry.dispose();
                obj.geometry = new THREE.SphereGeometry(baseR, 96, 64);
              }

              // Procedural multi-scale crater & rocky grit heightmap (512x256 equirectangular)
              window._novaCraterHeightCache = window._novaCraterHeightCache || {};
              if (!window._novaCraterHeightCache[kind]) {
                const cw = 512, ch = 256;
                const cCanvas = document.createElement('canvas');
                cCanvas.width = cw; cCanvas.height = ch;
                const cCtx = cCanvas.getContext('2d');
                cCtx.fillStyle = '#808080';
                cCtx.fillRect(0, 0, cw, ch);

                // Deterministic PRNG per body
                let seed = kind.split('').reduce((a, c) => a + c.charCodeAt(0) * 31, 1337);
                const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

                // 1. Coarse tectonic ridges / highlands
                for (let i = 0; i < 45; i++) {
                  const x = rand() * cw, y = rand() * ch;
                  const rad = 18 + rand() * 52;
                  const g = cCtx.createRadialGradient(x, y, 0, x, y, rad);
                  const hi = rand() > 0.45 ? 168 : 92;
                  g.addColorStop(0, `rgba(${hi},${hi},${hi},0.35)`);
                  g.addColorStop(1, 'rgba(128,128,128,0)');
                  cCtx.fillStyle = g;
                  cCtx.beginPath(); cCtx.arc(x, y, rad, 0, Math.PI * 2); cCtx.fill();
                }

                // 2. Deep impact craters with raised jagged rims & central peaks
                const craterCount = (kind === 'mars') ? 95 : 165;
                for (let i = 0; i < craterCount; i++) {
                  const x = rand() * cw;
                  const y = 16 + rand() * (ch - 32);
                  const rad = (i < 14) ? (14 + rand() * 22) : (3 + rand() * 11);
                  const g = cCtx.createRadialGradient(x, y, rad * 0.08, x, y, rad * 1.25);
                  // Central uplift on large craters, deep black bowl, bright raised rim
                  g.addColorStop(0.00, i < 14 ? 'rgba(155,155,155,0.75)' : 'rgba(20,20,20,0.85)');
                  g.addColorStop(0.25, 'rgba(18,18,18,0.85)');
                  g.addColorStop(0.72, 'rgba(40,40,40,0.70)');
                  g.addColorStop(0.88, 'rgba(235,235,235,0.88)');
                  g.addColorStop(1.00, 'rgba(128,128,128,0.0)');
                  cCtx.fillStyle = g;
                  cCtx.beginPath(); cCtx.arc(x, y, rad * 1.25, 0, Math.PI * 2); cCtx.fill();
                }

                // 3. Fine rocky micro-grit
                const img = cCtx.getImageData(0, 0, cw, ch);
                const d = img.data;
                for (let p = 0; p < d.length; p += 4) {
                  const grit = (rand() - 0.5) * 34;
                  const v = Math.max(0, Math.min(255, d[p] + grit));
                  d[p] = d[p + 1] = d[p + 2] = v;
                }
                cCtx.putImageData(img, 0, 0);

                const hTex = new THREE.CanvasTexture(cCanvas);
                hTex.wrapS = THREE.RepeatWrapping;
                hTex.wrapT = THREE.ClampToEdgeWrapping;
                hTex.needsUpdate = true;
                window._novaCraterHeightCache[kind] = hTex;
              }
              reliefTex = window._novaCraterHeightCache[kind];
              dispScale = (kind === 'ceres') ? baseR * 0.075
                        : (kind === 'moon' || kind === 'mercury') ? baseR * 0.055
                        : baseR * 0.042;
            }

            obj.material = new THREE.MeshStandardMaterial({
              map: procTex,
              bumpMap: reliefTex,
              bumpScale: isGasGiant ? 0.015 : isOceanWorld ? 0.045 : isCrateredRocky ? 0.24 : isOumuamua ? 0.14 : 0.135,
              displacementMap: isCrateredRocky ? reliefTex : null,
              displacementScale: dispScale,
              displacementBias: -dispScale * 0.5,
              roughness: isOceanWorld ? 0.34 : isGasGiant ? 0.72 : isCrateredRocky ? 0.96 : isOumuamua ? 0.82 : 0.92,
              metalness: isOceanWorld ? 0.16 : isCrateredRocky ? 0.02 : isOumuamua ? 0.06 : 0.03,
              emissiveMap: procTex,
              emissive: new THREE.Color(0xffffff),
              emissiveIntensity: isOumuamua ? 0.08 : 0.018
            });

            // === NOVA UPGRADE: REAL 2K SATELLITE ALBEDO & TANGENT-SPACE NORMAL MAPS ===
            const REAL_ALBEDO_KINDS = new Set([
              'mercury', 'venus', 'earth', 'moon', 'mars',
              'ceres', 'jupiter', 'saturn', 'uranus', 'neptune'
            ]);
            const REAL_NORMAL_KINDS = new Set([
              'mercury', 'moon', 'mars', 'ceres', 'earth', 'jupiter', 'saturn'
            ]);
            if (REAL_ALBEDO_KINDS.has(kind)) {
              window._novaTexLoader = window._novaTexLoader || new THREE.TextureLoader();
              const loader = window._novaTexLoader;
              const targetMat = obj.material;

              loader.load(`textures/${kind}_albedo.jpg?v=2`, (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.anisotropy = 8;
                targetMat.map = tex;
                targetMat.emissiveMap = tex;
                targetMat.needsUpdate = true;
              });

              if (REAL_NORMAL_KINDS.has(kind)) {
                loader.load(`textures/${kind}_normal.jpg`, (ntex) => {
                  ntex.anisotropy = 8;
                  const nStr = (kind === 'ceres' || kind === 'moon') ? 2.15
                             : (kind === 'mercury' || kind === 'mars') ? 1.85
                             : (kind === 'earth') ? 1.15 : 0.45;
                  targetMat.normalMap = ntex;
                  targetMat.normalScale = new THREE.Vector2(nStr, nStr);
                  targetMat.bumpMap = null;
                  targetMat.needsUpdate = true;
                });
              }

              if (kind === 'earth') {
                loader.load('textures/earth_roughness.jpg', (rtex) => {
                  rtex.anisotropy = 4;
                  targetMat.roughnessMap = rtex;
                  targetMat.roughness = 1.0;
                  targetMat.metalness = 0.08;
                  targetMat.needsUpdate = true;
                });
              }
            }

            // === NOVA UPGRADE: REAL 2K EARTH CLOUDS + BLACK MARBLE NIGHT LIGHTS ===
            if (isOceanWorld && !obj.getObjectByName("earth-clouds-nightlights")) {
              const eRadius = (meta && meta.size) ? meta.size : 0.45;
              const cloudGeo = new THREE.SphereGeometry(eRadius * 1.014, 64, 48);
              window._novaTexLoader = window._novaTexLoader || new THREE.TextureLoader();
              const eCloudsTex = window._novaTexLoader.load('textures/earth_clouds.jpg');
              const eNightTex  = window._novaTexLoader.load('textures/earth_night.jpg');
              eCloudsTex.wrapS = THREE.RepeatWrapping;
              eNightTex.colorSpace = THREE.SRGBColorSpace;

              const cloudMat = new THREE.ShaderMaterial({
                uniforms: {
                  uTime: window.sunShaderUniforms ? window.sunShaderUniforms.uTime : { value: 0.0 },
                  uCloudsMap: { value: eCloudsTex },
                  uNightMap:  { value: eNightTex }
                },
                vertexShader: `
                  varying vec2 vUv;
                  varying vec3 vWorldNormal;
                  varying vec3 vWorldPos;
                  void main() {
                    vUv = uv;
                    vec4 wp = modelMatrix * vec4(position, 1.0);
                    vWorldPos = wp.xyz;
                    vWorldNormal = normalize(mat3(modelMatrix) * normal);
                    gl_Position = projectionMatrix * viewMatrix * wp;
                  }
                `,
                fragmentShader: `
                  uniform float uTime;
                  uniform sampler2D uCloudsMap;
                  uniform sampler2D uNightMap;
                  varying vec2 vUv;
                  varying vec3 vWorldNormal;
                  varying vec3 vWorldPos;

                  void main() {
                    vec3 N = normalize(vWorldNormal);
                    vec3 L = normalize(-vWorldPos); // Sun at origin
                    float ndotl = dot(N, L);

                    // Slowly drifting real 2K cloud cover
                    vec2 cloudUv = vec2(fract(vUv.x + uTime * 0.0025), vUv.y);
                    float clouds = texture2D(uCloudsMap, cloudUv).r;
                    float dayMask = smoothstep(-0.12, 0.32, ndotl);

                    // Warm Rayleigh sunset scatter along the twilight terminator
                    float twilight = smoothstep(-0.18, 0.02, ndotl) * (1.0 - smoothstep(0.02, 0.24, ndotl));
                    vec3 sunsetTint = vec3(1.0, 0.42, 0.12) * twilight * 0.72;

                    // Real NASA Black Marble city lights strictly on the night hemisphere
                    float nightMask = smoothstep(0.04, -0.26, ndotl);
                    vec3 nightSample = texture2D(uNightMap, vUv).rgb;
                    vec3 cityCol = nightSample * vec3(1.15, 0.92, 0.68) * nightMask * 1.45 * (1.0 - clouds * 0.55);

                    vec3 cloudCol = (vec3(0.96, 0.98, 1.0) * (0.03 + 0.97 * dayMask)) + sunsetTint;
                    float cloudAlpha = clouds * (0.05 + 0.85 * dayMask);
                    float cityLum = max(cityCol.r, max(cityCol.g, cityCol.b));
                    float alpha = clamp(cloudAlpha + twilight * 0.18 + cityLum * 0.9, 0.0, 0.96);

                    gl_FragColor = vec4(cloudCol * clouds + sunsetTint * 0.28 + cityCol, alpha);
                  }
                `,
                transparent: true,
                depthWrite: false
              });
              const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
              cloudMesh.name = "earth-clouds-nightlights";
              cloudMesh.raycast = () => {};
              obj.add(cloudMesh);
            }
          }
          obj.material.needsUpdate = true;
          obj.userData._nasaTextured = true;
          texturedCount++;
        }

        if (qIdx < meshQueue.length) {
          setTimeout(processTextureBatch, 0);
        } else {
          window._isApplyingTextures = false;
          window._texturesInitialized = true;
          console.log(`[NOVA] Applied 3D fBm & PBR materials to ${texturedCount} celestial bodies.`);
          buildVolumetricCelestialStructures(celestialObjects);
        }
      }

      processTextureBatch();
    }

    function animate(time = performance.now()) {
      requestAnimationFrame(animate);
      if (
        document.documentElement.classList.contains("is-booting") &&
        !document.documentElement.classList.contains("is-wormhole-zooming")
      ) {
        window._novaBootWarmupFrames = (window._novaBootWarmupFrames || 0) + 1;
        if (window._novaBootWarmupFrames > 2) return;
      }
      TWEEN.update(time);

      const timeSec = time * 0.001;
      if (window.sunShaderUniforms) {
        window.sunShaderUniforms.uTime.value = timeSec;
      }
      if (sunMeshRef && (!sunMeshRef.material || sunMeshRef.material.type !== 'ShaderMaterial') && typeof createAnimatedSunMaterial === 'function') {
        sunMeshRef.material = createAnimatedSunMaterial();
        if (!sunMeshRef.getObjectByName("sun-chromosphere-spicules")) {
          sunMeshRef.add(createAnimatedCoronaLayer((sunMeshRef.userData && sunMeshRef.userData.size) ? sunMeshRef.userData.size : 2.5));
        }
      }
      const camDist = camera.position.distanceTo(controls.target);
      updateAdaptiveScale(camDist);

      if (celestialSkyboxGroup) {
        celestialSkyboxGroup.position.copy(camera.position);
      }

      rotatableObjects.forEach(obj => {
        if (obj.userData?.id !== 'earendel' && obj.name !== 'earendel') obj.rotation.y += (obj === sunMeshRef) ? 0.0006 : 0.003;
      });

      if (crabPulsarBeams) {
        crabPulsarBeams.rotation.y += 0.045;
      }

      if (!isOrbitPaused) {
        orbitingPlanets.forEach(p => {
          p.angle -= p.speed;
          p.mesh.position.x = Math.cos(p.angle) * p.radius;
          p.mesh.position.z = Math.sin(p.angle) * p.radius;
        });

        if (ton618AccretionDisk) {
          ton618AccretionDisk.rotation.z += 0.018;
          if (ton618AccretionDisk.children && ton618AccretionDisk.children[0]) {
            ton618AccretionDisk.children[0].rotation.z -= 0.007; // Differential shear between inner & outer plasma layers
          }
        }
        // Live Keplerian orbital acceleration for black hole gravitational star-swarms
        [window._ton618Swarm, window._sagASwarm].forEach((swarm) => {
          if (!swarm || !swarm.userData || !swarm.userData.swarmMeta) return;
          const posAttr = swarm.geometry.attributes.position;
          const arr = posAttr.array;
          const meta = swarm.userData.swarmMeta;
          for (let k = 0; k < meta.length; k++) {
            const m = meta[k];
            m.ang += m.speed;
            arr[k * 3]     = Math.cos(m.ang) * m.rad;
            arr[k * 3 + 1] = Math.sin(m.ang) * m.rad * Math.sin(m.incl);
            arr[k * 3 + 2] = Math.sin(m.ang) * m.rad * Math.cos(m.incl);
          }
          posAttr.needsUpdate = true;
        });
        if (false) {
        }
        ton618PlasmaFlares.forEach(flare => {
          flare.angle += flare.speed;
          flare.mesh.position.set(
            Math.cos(flare.angle) * flare.radius,
            -Math.sin(flare.angle) * flare.radius * 0.203,
            Math.sin(flare.angle) * flare.radius * 0.979
          );
        });

        if (sagAAccretionDisk) {
          sagAAccretionDisk.rotation.z += 0.012;
        }
        sagAPlasmaFlares.forEach(flare => {
          flare.angle += flare.speed;
          flare.mesh.position.set(
            Math.cos(flare.angle) * flare.angle * 0 + Math.cos(flare.angle) * flare.radius,
            -Math.sin(flare.angle) * flare.radius * 0.203,
            Math.sin(flare.angle) * flare.radius * 0.979
          );
        });

        if (siriusAMesh && siriusBMesh) {
          siriusBinaryAngle += 0.0045;
          const sepA = 7.0;
          const sepB = 15.5;
          siriusAMesh.position.set(
            -Math.cos(siriusBinaryAngle) * sepA,
            Math.sin(siriusBinaryAngle) * (sepA * 0.3),
            -Math.sin(siriusBinaryAngle) * (sepA * 0.6)
          );
          siriusBMesh.position.set(
            Math.cos(siriusBinaryAngle) * sepB,
            -Math.sin(siriusBinaryAngle) * (sepB * 0.3),
            Math.sin(siriusBinaryAngle) * (sepB * 0.6)
          );
        }

        if (alphaCenAMesh && alphaCenBMesh && proximaMesh) {
          alphaCenBinaryAngle += 0.0035;
          const rA = 5.5;
          const rB = 7.5;
          alphaCenAMesh.position.set(
            -Math.cos(alphaCenBinaryAngle) * rA,
            Math.sin(alphaCenBinaryAngle) * (rA * 0.25),
            -Math.sin(alphaCenBinaryAngle) * rA
          );
          alphaCenBMesh.position.set(
            Math.cos(alphaCenBinaryAngle) * rB,
            -Math.sin(alphaCenBinaryAngle) * (rB * 0.25),
            Math.sin(alphaCenBinaryAngle) * rB
          );

          proximaOrbitAngle -= 0.0005;
          proximaMesh.position.set(
            Math.cos(proximaOrbitAngle) * 46.0,
            Math.sin(proximaOrbitAngle) * 8.0,
            Math.sin(proximaOrbitAngle) * 40.0
          );
        }

        cenAPlasmaKnots.forEach(knot => {
          knot.progress = (knot.progress + knot.speed) % 1.0;
          const currentY = knot.progress * knot.maxDist * (knot.isTop ? 1 : -1);
          knot.mesh.position.set(0, currentY, 0);
          knot.mesh.scale.setScalar(0.7 + knot.progress * 0.9);
        });

        if (andromedaGroup) {
          andromedaApproachDistance = (andromedaApproachDistance + 0.004) % 35.0;
          andromedaGroup.position.copy(andromedaBasePos).addScaledVector(andromedaApproachDir, andromedaApproachDistance);
          andromedaGroup.rotation.y += 0.0008;
        }

        if (halleyOrbitObj) {
          const distToSol = Math.max(2.0, halleyOrbitObj.mesh.position.length());
          const keplerSpeed = 0.05 / Math.pow(distToSol, 0.75);
          halleyOrbitObj.angle += keplerSpeed;

          const hx = halleyOrbitObj.cx + Math.cos(halleyOrbitObj.angle) * halleyOrbitObj.a;
          const hz = Math.sin(halleyOrbitObj.angle) * halleyOrbitObj.b;
          halleyOrbitObj.mesh.position.set(hx, hz * 0.35, hz);
        }

        if (oumuamuaOrbitObj) {
          oumuamuaOrbitObj.t += oumuamuaOrbitObj.speed;
          if (oumuamuaOrbitObj.t > 2.2) oumuamuaOrbitObj.t = -2.2;

          const pos = getOumuamuaPosition(oumuamuaOrbitObj.t);
          oumuamuaOrbitObj.mesh.position.copy(pos);
          // Realistic non-principal-axis tumbling motion that showcases both the elongated shard profile and scalloped dorsal crater
          oumuamuaOrbitObj.mesh.rotation.y += 0.006;
          oumuamuaOrbitObj.mesh.rotation.x = 0.28 + 0.22 * Math.sin(timeSec * 0.55);
          oumuamuaOrbitObj.mesh.rotation.z = -0.14 + 0.18 * Math.cos(timeSec * 0.38);
        }
      }

      // === DEEP-SPACE DISCOVERABLE BEACON PULSE & TOUR STATE SYNC ===
      
      if (typeof window.updateDeepSpaceDiscoveryPulse === "function") {
        try {
          window.updateDeepSpaceDiscoveryPulse(performance.now() * 0.001, camera, celestialObjects, activeTargetMesh, THREE);
        } catch (err) {}
      }

      const _camDistDepth = camera.position.length();

      // === PHASE 2: SCALE-GATED 3D TIER VISIBILITY (True Cosmic Depth) ===
      if (typeof manualTierLock !== "undefined" && manualTierLock === 0 && Array.isArray(celestialObjects)) {
        for (let i = 0; i < celestialObjects.length; i++) {
          const obj = celestialObjects[i];
          if (!obj || !obj.userData) continue;
          const tNum = obj.userData.tier || 1;
          if (tNum <= 1) continue;
          const isSameSystem = Boolean(
            activeTargetMesh && obj.parent && activeTargetMesh.parent === obj.parent && obj.parent !== scene
          );
          const isActiveTier = Boolean(
            activeTargetMesh && activeTargetMesh.userData && (activeTargetMesh.userData.tier || 1) === tNum
          );
          const isPinnedTarget = (obj === activeTargetMesh || obj === hoveredCelestialMesh || isSameSystem || isActiveTier);
          let shouldShow = true;
          if (!isPinnedTarget) {
            if (tNum === 2) shouldShow = _camDistDepth >= 160;
            else if (tNum === 3) shouldShow = _camDistDepth >= 420;
            else if (tNum >= 4) shouldShow = _camDistDepth >= 1150;
          }
          if (obj.visible !== shouldShow) {
            obj.visible = shouldShow;
          }
          if (obj.userData.id === "sagittarius-a-star" && sagAGroup && sagAGroup.visible !== shouldShow) {
            sagAGroup.visible = shouldShow;
          }
        }
      }

      if (isCosmicWebVisible && window._cosmicMaterials) {
        // Depth-fade Cosmic Web out inside the Solar System so filaments don't wrap behind Earth/Venus
        const webDepthFade = (typeof manualTierLock !== "undefined" && manualTierLock >= 3)
          ? 1.0
          : THREE.MathUtils.clamp((_camDistDepth - 340) / 960, 0.0, 1.0);

        if (cosmicWebGroup) cosmicWebGroup.visible = webDepthFade > 0.01;

        if (webDepthFade > 0.01) {
          const t = performance.now() * 0.001;
          const webScale = (0.85 + 0.10 * Math.sin(t * 0.8) + 0.05 * Math.sin(t * 2.0)) * webDepthFade;

          window._cosmicMaterials.core.opacity = 0.24 * webScale;
          window._cosmicMaterials.outer.opacity = 0.14 * webScale;
          window._cosmicMaterials.branch.opacity = 0.095 * webScale;

          filamentFlowParticles.forEach(item => {
            item.progress = (item.progress + item.speed) % 1.0;
            const pt = item.curve.getPoint(item.progress);
            item.mesh.position.set(pt.x, pt.y, pt.z);
            if (item.sparkMat) item.sparkMat.opacity = 0.15 * webScale;
            if (item.haloMat) item.haloMat.opacity = 0.075 * webScale;
            if (item.progress < 0.99) {
              const lookPt = item.curve.getPoint(item.progress + 0.01);
              item.mesh.lookAt(lookPt);
            }
          });
        }
      }

      if (asteroidBelt) {
        if (window._novaGpuBeltUniforms && !(typeof isOrbitPaused !== "undefined" && isOrbitPaused)) {
          window._novaGpuBeltUniforms.uTime.value += 0.045;
        }
        asteroidBelt.rotation.y += 0.00025;
      }
      if (oortCloudGroup) oortCloudGroup.rotation.y += 0.0002;
      if (milkyWayGroup) milkyWayGroup.rotation.y += 0.0006;
      if (triangulumGroup) triangulumGroup.rotation.y += 0.0007;

      if (cmbSphere) {
        cmbSphere.rotation.y += 0.00015;
        updateCMBThermalAcoustics(timeSec);
      }

      // === NOVA UPGRADE: J2000 KEPLERIAN EPHEMERIS SOLVER ===
      if (typeof window.updateKeplerianOrbits === "function" && typeof orbitingPlanets !== "undefined" && Array.isArray(orbitingPlanets)) {
        window.updateKeplerianOrbits(orbitingPlanets, typeof isOrbitPaused !== "undefined" ? Boolean(isOrbitPaused) : false);
      }

      const eMesh = window.earthMeshRef || earthMeshRef;
      const mMesh = window.moonMeshRef || moonMeshRef;
      if (eMesh && mMesh) {
        if (!isOrbitPaused) {
          moonOrbitAngle -= 0.025;
        }
        const orbitRadius = 1.65;
        mMesh.position.set(
          eMesh.position.x + Math.cos(moonOrbitAngle) * orbitRadius,
          eMesh.position.y + Math.sin(moonOrbitAngle) * 0.18,
          eMesh.position.z + Math.sin(moonOrbitAngle) * orbitRadius
        );
        mMesh.rotation.y += 0.015;
        mMesh.visible = eMesh.visible;
        if (moonOrbitRingRef) {
          moonOrbitRingRef.position.copy(eMesh.position);
          moonOrbitRingRef.visible = eMesh.visible;
        }
      }

      if (activeTargetMesh && !isFlyingToTarget) {
        const currentWorldPos = new THREE.Vector3();
        activeTargetMesh.getWorldPosition(currentWorldPos);
        if (lastTrackedTargetPos.lengthSq() > 0) {
          const deltaMove = currentWorldPos.clone().sub(lastTrackedTargetPos);
          if (deltaMove.lengthSq() > 0 && deltaMove.lengthSq() < 100) {
            camera.position.add(deltaMove);
            controls.target.add(deltaMove);
          }
        }
        lastTrackedTargetPos.copy(currentWorldPos);
      }

      controls.update();
      if (window._novaBeforeRender) window._novaBeforeRender(scene, camera, celestialObjects, celestialLabelEntries, activeTargetMesh);
      updateCelestialLabels(camDist);
      if (!window._texturesInitialized && celestialObjects.length > 5) {
        applyCharacteristicTexturesToScene();
        window._texturesInitialized = true;
      }

      if (typeof window.updateNovaAttitudeSphere === "function") {
        window.updateNovaAttitudeSphere();
      }
      renderer.render(scene, camera); if (window._novaAfterRender) window._novaAfterRender();
    }

    // === GUIDED COSMIC TOUR & STANDBY SYSTEM (static/js/tour.js) ===
    let isTourActive = false;
    initCosmicTour({
      get isTourActive() { return isTourActive; }, set isTourActive(v) { isTourActive = v; },
      get isScreensaverActive() { return isScreensaverActive; }, set isScreensaverActive(v) { isScreensaverActive = v; },
      get isFlyingToTarget() { return isFlyingToTarget; }, set isFlyingToTarget(v) { isFlyingToTarget = v; },
      get isSidebarUserHidden() { return isSidebarUserHidden; }, set isSidebarUserHidden(v) { isSidebarUserHidden = v; },
      get isPlanetOverviewEnabled() { return isPlanetOverviewEnabled; }, set isPlanetOverviewEnabled(v) { isPlanetOverviewEnabled = v; },
      get activeTargetMesh() { return activeTargetMesh; }, set activeTargetMesh(v) { activeTargetMesh = v; },
      get areLabelsVisible() { return areLabelsVisible; }, set areLabelsVisible(v) { areLabelsVisible = v; },
      get isCosmicWebVisible() { return isCosmicWebVisible; }, set isCosmicWebVisible(v) { isCosmicWebVisible = v; },
      get isTierMenuOpen() { return isTierMenuOpen; }, set isTierMenuOpen(v) { isTierMenuOpen = v; },
      get manualTierLock() { return manualTierLock; }, set manualTierLock(v) { manualTierLock = v; },
      animate,
      applyZenUI,
      camera,
      celestialObjects,
      controls,
      fetchCatalog,
      isGuidedTourCurrentlyActive,
      updateSidebarToggleStyle,
    });
