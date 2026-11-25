// NOVA Cmd+K Jump Palette, Observatory HUD Polish & Gimbal Telemetry

(function initObservatoryHudPolish() {
  // 1. Move attitude gimbal out of transformed #bottom-hud so fixed bottom-left anchors to viewport
  const gimbal = document.getElementById("hud-center-gimbal");
  if (gimbal && gimbal.parentElement !== document.body) {
    document.body.appendChild(gimbal);
  }

  // 2. Sync INFO active state reliably by hooking togglePlanetOverview
  const infoBtn = document.getElementById("btn-toggle-sidebar");
  let infoActiveState = true;
  function renderInfoBtn() {
    if (infoBtn) infoBtn.setAttribute("data-nova-active", infoActiveState ? "true" : "false");
  }
  renderInfoBtn();
  if (typeof window.togglePlanetOverview === "function") {
    const origToggleOverview = window.togglePlanetOverview;
    window.togglePlanetOverview = function(...args) {
      const res = origToggleOverview.apply(this, args);
      infoActiveState = !infoActiveState;
      renderInfoBtn();
      return res;
    };
  }

  // 3. Sync FULL active state with browser Fullscreen API (+ Mobile Zen fallback when unsupported on iOS)
  const fullBtn = document.getElementById("btn-fullscreen-zen");
  const canNativeFullscreen = Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  function syncFullBtn() {
    if (!fullBtn) return;
    const isFull = canNativeFullscreen
      ? Boolean(document.fullscreenElement || document.webkitFullscreenElement)
      : document.documentElement.classList.contains("nova-mobile-zen");
    fullBtn.setAttribute("data-nova-active", isFull ? "true" : "false");
  }
  if (fullBtn) {
    syncFullBtn();
    if (canNativeFullscreen) {
      document.addEventListener("fullscreenchange", syncFullBtn);
      document.addEventListener("webkitfullscreenchange", syncFullBtn);
      fullBtn.addEventListener("click", () => setTimeout(syncFullBtn, 120));
    } else {
      fullBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        document.documentElement.classList.toggle("nova-mobile-zen");
        syncFullBtn();
      }, true);
    }
  }

  // 4. Initialize INFO button state to match actual isPlanetOverviewEnabled
  if (infoBtn && typeof isPlanetOverviewEnabled !== "undefined") {
    infoBtn.setAttribute("data-nova-active", isPlanetOverviewEnabled ? "true" : "false");
  }

  // 5. Exact Scale Slider Orb Alignment & Endpoint Pulse
  const scaleSlider = document.getElementById("scale-slider");
  const morphOrb = document.getElementById("zoom-morph-orb");
  const rippleLeft = document.getElementById("zoom-ripple-left");
  const rippleRight = document.getElementById("zoom-ripple-right");
  let lastEndpoint = null;

  function triggerRipple(el) {
    if (!el) return;
    el.classList.remove("nova-pulse");
    void el.offsetWidth;
    el.classList.add("nova-pulse");
  }

  function syncZoomOrbAndPulse(isUserEvent) {
    if (!scaleSlider || !morphOrb) return;
    const min = parseFloat(scaleSlider.min) || 1.0;
    const max = parseFloat(scaleSlider.max) || 4.0;
    const val = parseFloat(scaleSlider.value);
    const t = Math.max(0, Math.min(1, (val - min) / (max - min)));

    // Lock orb center strictly between left: 5px and right: 5px
    morphOrb.style.left = `calc(5px + ${t} * (100% - 10px))`;

    if (t <= 0.012) {
      if (lastEndpoint !== "left" || isUserEvent) {
        triggerRipple(rippleLeft);
        lastEndpoint = "left";
      }
    } else if (t >= 0.988) {
      if (lastEndpoint !== "right" || isUserEvent) {
        triggerRipple(rippleRight);
        lastEndpoint = "right";
      }
    } else {
      lastEndpoint = null;
    }
  }

  if (scaleSlider) {
    scaleSlider.addEventListener("input", () => syncZoomOrbAndPulse(false));
    scaleSlider.addEventListener("change", () => syncZoomOrbAndPulse(true));
    scaleSlider.addEventListener("pointerup", () => syncZoomOrbAndPulse(true));
  }

  // 6. Uniform Full-Globe Final Zoom (matches FinalZoomLevel.jpg ~82% viewport height)
  //    & continuous orb alignment sync
  function getMaxWorldScale(obj) {
    if (!obj || !obj.matrixWorld || !obj.matrixWorld.elements) return 1;
    const e = obj.matrixWorld.elements;
    const sx = Math.hypot(e[0], e[1], e[2]);
    const sy = Math.hypot(e[4], e[5], e[6]);
    const sz = Math.hypot(e[8], e[9], e[10]);
    return Math.max(sx, sy, sz) || 1;
  }

  function getTrueBodyWorldRadius(obj) {
    if (!obj) return 0;
    const maxScale = getMaxWorldScale(obj);
    let r = (Number(obj.userData && obj.userData.size) || 0) * maxScale;

    if (obj.geometry) {
      if (!obj.geometry.boundingSphere) obj.geometry.computeBoundingSphere();
      if (obj.geometry.boundingSphere) {
        r = Math.max(r, obj.geometry.boundingSphere.radius * maxScale);
      }
    }
    if (obj.children && obj.children.length) {
      for (let i = 0; i < obj.children.length; i++) {
        const ch = obj.children[i];
        if (!ch || !ch.isMesh || !ch.geometry || ch.isLine || ch.isPoints) continue;
        const cname = String(ch.name || "").toLowerCase();
        if (cname.includes("glow") || cname.includes("halo") || cname.includes("corona")) continue;
        if (!ch.geometry.boundingSphere) ch.geometry.computeBoundingSphere();
        if (ch.geometry.boundingSphere) {
          r = Math.max(r, ch.geometry.boundingSphere.radius * getMaxWorldScale(ch));
        }
      }
    }
    return r;
  }

  function observatoryZoomLoop() {
    syncZoomOrbAndPulse(false);

    if (document.documentElement.classList.contains("is-booting")) {
      requestAnimationFrame(observatoryZoomLoop);
      return;
    }

    const cam = window._novaCamRef || window.camera;
    const ctrl = window._novaCtrlRef || window.controls;
    const surfaceActive = window._surfaceZoomState && window._surfaceZoomState.active;
    const targetMesh = window._spatialTargetMesh || (typeof activeTargetMesh !== "undefined" ? activeTargetMesh : null);

    if (cam && ctrl && targetMesh && !surfaceActive) {
      const worldRadius = getTrueBodyWorldRadius(targetMesh);
      if (worldRadius > 0.01) {
        const halfFovRad = ((cam.fov || 45) * 0.5) * (Math.PI / 180);
        const heroMinDist = Math.max(worldRadius * 1.45, worldRadius / (Math.tan(halfFovRad) * 0.80));
        ctrl.minDistance = Math.max(0.25, heroMinDist);

        const dx = cam.position.x - ctrl.target.x;
        const dy = cam.position.y - ctrl.target.y;
        const dz = cam.position.z - ctrl.target.z;
        const curDist = Math.hypot(dx, dy, dz);
        if (curDist > 0.0001 && curDist < ctrl.minDistance) {
          const s = ctrl.minDistance / curDist;
          cam.position.set(ctrl.target.x + dx * s, ctrl.target.y + dy * s, ctrl.target.z + dz * s);
        }
      }
    }
    requestAnimationFrame(observatoryZoomLoop);
  }
  requestAnimationFrame(observatoryZoomLoop);

  // 7. Inject circular indicator nodes into all Bottom & Top HUD buttons
  document.querySelectorAll(
    "#hud-toggle-group button, #hud-right-controls button, #btn-cosmic-tour, #nova-ephemeris-hud button"
  ).forEach((btn) => {
    if (!btn.querySelector(".nova-node")) {
      const node = document.createElement("span");
      node.className = "nova-node";
      node.setAttribute("aria-hidden", "true");
      btn.appendChild(node);
    }
  });

  // 8. Color-coded cursor halo on HUD button hover (Amber=toggles/time, White=INFO/FULL/TOUR)
  document.querySelectorAll("#bottom-hud button").forEach((b) => b.removeAttribute("title"));

  document.addEventListener("pointermove", (e) => {
    const el = e.target && e.target.closest ? e.target.closest("#bottom-hud button, #bottom-hud .nova-node, #nova-ephemeris-hud button") : null;
    const isAmber = Boolean(el && el.closest("#hud-toggle-group, #nova-ephemeris-hud"));
    const isWhite = Boolean(el && el.closest("#hud-right-controls, #btn-cosmic-tour"));
    document.body.classList.toggle("nova-cursor-hud-text", Boolean(el));
    document.body.classList.toggle("nova-cursor-amber", isAmber);
    document.body.classList.toggle("nova-cursor-white", isWhite);
  }, { passive: true });

  // Reliable Tour state tracking (clicks, T shortcut, or active tour controls)
  let novaTourActive = false;
  const tourBtnEl = document.getElementById("btn-cosmic-tour");

  function applyTourVisualState(isOn) {
    novaTourActive = Boolean(isOn);
    document.body.classList.toggle("nova-tour-minimal", novaTourActive);
    if (tourBtnEl) tourBtnEl.setAttribute("data-nova-active", novaTourActive ? "true" : "false");
  }

  if (tourBtnEl) {
    tourBtnEl.addEventListener("click", () => {
      setTimeout(() => {
        const pauseBtn = document.getElementById("btn-tour-pause");
        const pauseVisible = Boolean(pauseBtn && pauseBtn.offsetParent !== null);
        applyTourVisualState(pauseVisible || !novaTourActive);
      }, 120);
    });
  }

  setInterval(() => {
    const pauseBtn = document.getElementById("btn-tour-pause");
    const voiceBtn = document.getElementById("btn-tour-voice");
    const controlsVisible = Boolean(
      (pauseBtn && pauseBtn.offsetParent !== null) ||
      (voiceBtn && voiceBtn.offsetParent !== null) ||
      window.isCosmicTourActive ||
      window.cosmicTourActive
    );
    if (controlsVisible !== novaTourActive) {
      applyTourVisualState(controlsVisible);
    }
  }, 250);

  // Override Map Key toggle so it stays in place and toggles cleanly via K/M or right-edge nodes
  const mkDrawer = document.getElementById("map-key-drawer");
  let mkOpen = false;

  // Create right-edge stacked toggle nodes
  let mkNodes = document.getElementById("nova-mapkey-nodes");
  if (!mkNodes) {
    mkNodes = document.createElement("div");
    mkNodes.id = "nova-mapkey-nodes";
    mkNodes.setAttribute("aria-label", "Toggle Observatory Keys (K)");
    mkNodes.innerHTML = '<span class="mk-node"></span><span class="mk-node"></span>';
    document.body.appendChild(mkNodes);
  }

  window.toggleMapKey = function(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    mkOpen = !mkOpen;
    if (mkDrawer) {
      mkDrawer.classList.toggle("nova-mapkey-open", mkOpen);
    }
    if (mkNodes) {
      mkNodes.setAttribute("data-open", mkOpen ? "true" : "false");
    }
  };

  mkNodes.addEventListener("click", (e) => window.toggleMapKey(e));

  // Hide any legacy thin cyan bottom summon line if present in DOM
  document.querySelectorAll("button, div").forEach((el) => {
    if (el.id && el.id.toLowerCase().includes("summon") && el.id !== "nova-mapkey-nodes") {
      el.style.setProperty("display", "none", "important");
      el.style.setProperty("pointer-events", "none", "important");
    }
  });

  // 9. App-wide keyboard shortcuts (F=Fullscreen, T=Tour, R=Reset View, 1-4=Time Speed)
  window.addEventListener("keydown", (e) => {
    const _cmp = document.getElementById("nova-compare-overlay"); if (_cmp && !_cmp.classList.contains("hidden") && _cmp.style.display !== "none") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    const k = (e.key || "").toLowerCase();

    if (k === "f") {
      const btn = document.getElementById("btn-fullscreen-zen");
      if (btn) btn.click();
    } else if (k === "t") {
      const btn = document.getElementById("btn-cosmic-tour");
      if (btn) btn.click();
    } else if (k === "r") {
      if (typeof window.triggerNovaReset === "function") window.triggerNovaReset();
    } else if (["1", "2", "3", "4"].includes(k)) {
      const rateBtns = document.querySelectorAll("#nova-ephemeris-hud button[data-rate]");
      const idx = parseInt(k, 10) - 1;
      if (rateBtns[idx]) rateBtns[idx].click();
    }
  });

  // 10. Reliable Reset helper + Option B Gimbal Telemetry Readout
  window.triggerNovaReset = function(e) {
    if (typeof window.triggerMapKeyReset === "function") {
      window.triggerMapKeyReset(e);
      return;
    }
    const wrapper = document.getElementById("attitude-sphere-wrapper");
    const canvas = document.getElementById("nova-attitude-sphere");
    if (typeof window.resetCameraToHome === "function") {
      window.resetCameraToHome();
      return;
    }
    if (canvas) {
      canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    } else if (wrapper) {
      wrapper.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }
  };

  const gimbalHost = document.getElementById("hud-center-gimbal");
  if (gimbalHost && !document.getElementById("nova-gimbal-telemetry")) {
    const readout = document.createElement("div");
    readout.id = "nova-gimbal-telemetry";
    readout.innerHTML = '<span>ATTITUDE</span><span class="gimbal-sub">HOME [R]</span>';
    readout.addEventListener("click", (e) => {
      e.stopPropagation();
      window.triggerNovaReset();
    });
    gimbalHost.appendChild(readout);
  }

  // Dedicated, un-overwritable Map Key toggle (immune to deferred module overwrites)
  window.novaToggleMapKey = function(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const drawer = document.getElementById("map-key-drawer");
    const nodes = document.getElementById("nova-mapkey-nodes");
    if (!drawer) return;
    const nextOpen = !drawer.classList.contains("nova-mapkey-open");
    drawer.classList.toggle("nova-mapkey-open", nextOpen);
    if (nodes) nodes.setAttribute("data-open", nextOpen ? "true" : "false");
  };

  // Re-bind right-edge nodes directly to novaToggleMapKey
  const mkNodesFix = document.getElementById("nova-mapkey-nodes");
  if (mkNodesFix) {
    const freshNodes = mkNodesFix.cloneNode(true);
    mkNodesFix.parentNode.replaceChild(freshNodes, mkNodesFix);
    freshNodes.addEventListener("click", (e) => window.novaToggleMapKey(e));
  }

  // High-priority capture-phase shortcuts for K/M (Map Key), R (Reset), & S (Standby)
  window.addEventListener("keydown", (e) => {
    const _cmp = document.getElementById("nova-compare-overlay"); if (_cmp && !_cmp.classList.contains("hidden") && _cmp.style.display !== "none") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.documentElement.classList.contains("is-booting")) return;
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    const k = (e.key || "").toLowerCase();

    if (k === "k" || k === "m") {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.novaToggleMapKey(e);
    } else if (k === "r") {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (typeof window.triggerMapKeyReset === "function") {
        window.triggerMapKeyReset(e);
      } else if (typeof window.resetCameraToHome === "function") {
        window.resetCameraToHome();
      } else {
        const sphere = document.getElementById("nova-attitude-sphere");
        if (sphere) {
          sphere.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 0, clientY: 0 }));
          sphere.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 0, clientY: 0 }));
          sphere.click();
        }
      }
    } else if (k === "s") {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (typeof window.toggleScreensaverMode === "function") {
        window.toggleScreensaverMode(e);
      } else if (typeof window.enterScreensaverMode === "function") {
        window.enterScreensaverMode();
      }
    }
  }, true);

  // Permanently remove the legacy bottom-edge cyan wake/reveal line (including taller wrappers)
  function purgeLegacyBottomCyanLine() {
    const keepIds = new Set([
      "bottom-hud", "hud-center-gimbal", "nova-mapkey-nodes",
      "nova-cursor-dot", "nova-cursor-halo", "map-key-drawer"
    ]);
    document.querySelectorAll("div, button, span, footer, aside").forEach((el) => {
      if (!el || keepIds.has(el.id)) return;
      if (el.closest("#bottom-hud, #hud-center-gimbal, #nova-mapkey-nodes, #map-key-drawer, #nova-ephemeris-hud")) return;

      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const nearBottom = rect.bottom >= window.innerHeight - 48 && rect.top >= window.innerHeight - 72;
      if (!nearBottom || rect.width < 60) return;

      if (el.closest && el.closest("#nova-compare-overlay")) return;
      const cls = String(el.className || "");
      const html = el.outerHTML || "";
      const isCyanLine =
        cls.includes("cyan") ||
        html.includes("via-cyan") ||
        html.includes("22d3ee") ||
        html.includes("34, 211, 238") ||
        (cs.backgroundImage && (cs.backgroundImage.includes("34, 211, 238") || cs.backgroundImage.includes("103, 232, 249"))) ||
        (cs.backgroundColor && (cs.backgroundColor.includes("34, 211, 238") || cs.backgroundColor.includes("103, 232, 249"))) ||
        (cs.boxShadow && (cs.boxShadow.includes("34, 211, 238") || cs.boxShadow.includes("103, 232, 249")));

      if (isCyanLine && rect.height <= 48) {
        const fixedParent = el.closest('[class*="fixed"]');
        const target = (fixedParent && !keepIds.has(fixedParent.id) && fixedParent.getBoundingClientRect().height <= 64) ? fixedParent : el;
        target.remove();
      }
    });
  }
  purgeLegacyBottomCyanLine();
  setInterval(purgeLegacyBottomCyanLine, 500);

  // === NOVA SLEW CONSOLE (TARGETING & RESET TERMINAL) ===
  (function initNovaSlewConsole() {
    if (document.getElementById("nova-cmd-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "nova-cmd-overlay";
    overlay.innerHTML = `
      <div id="nova-cmd-bar">
        <span id="nova-cmd-prompt">SLEW &gt;</span>
        <input id="nova-cmd-input" type="text" autocomplete="off" spellcheck="false"
               placeholder="goto sedna -z 2  |  saturn 3r  |  reset" />
        <span id="nova-cmd-hint">ESC</span>
      </div>
      <div id="nova-cmd-results"></div>
      <div id="nova-cmd-status"></div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById("nova-cmd-input");
    const resultsEl = document.getElementById("nova-cmd-results");
    const statusEl = document.getElementById("nova-cmd-status");

    let isOpen = false;
    let currentMatches = [];
    let selectedIdx = 0;

    function openConsole() {
      if (document.documentElement.classList.contains("is-booting")) return;
      isOpen = true;
      overlay.classList.add("open");
      input.value = "";
      statusEl.classList.remove("is-error"); statusEl.textContent = "FLAGS: -z <zoom> · <n>r (radii) · --close · --wide · reset";
      renderMatches("");
      setTimeout(() => input.focus(), 10);
    }

    function closeConsole() {
      isOpen = false;
      overlay.classList.remove("open");
      input.blur();
      resultsEl.classList.remove("has-items");
    }

    function parseCommand(raw) {
      const text = raw.trim();
      if (!text) return { action: "empty" };
      const tokens = text.split(/\s+/);
      const first = tokens[0].toLowerCase();

      if (first === "reset" || first === "home") {
        return { action: "reset" };
      }

      if (first === "scale") {
        const args = tokens.slice(1).filter((t) => !["vs", "vs.", "/", "to", "and", "with"].includes(t.toLowerCase()));
        return { action: "compare", a: args[0] || null, b: args[1] || null };
      }

      // Optional leading verb
      let idx = 0;
      if (["goto", "slew", "approach", "target", "fly", "focus"].includes(first)) {
        idx = 1;
      }

      const override = {};
      const nameParts = [];

      for (let i = idx; i < tokens.length; i++) {
        const tok = tokens[i];
        const low = tok.toLowerCase();
        if (low === "--close" || low === "-c") {
          override.zoom = 2.2;
        } else if (low === "--wide" || low === "-w") {
          override.zoom = 0.45;
        } else if ((low === "-z" || low === "zoom" || low === "--zoom") && tokens[i + 1]) {
          const val = parseFloat(tokens[++i]);
          if (!isNaN(val) && val > 0) override.zoom = val;
        } else if (/^\d+(\.\d+)?r$/i.test(low)) {
          const val = parseFloat(low.slice(0, -1));
          if (!isNaN(val) && val > 0) override.radii = val;
        } else {
          nameParts.push(tok);
        }
      }

      return {
        action: "slew",
        query: nameParts.join(" ").trim(),
        override: Object.keys(override).length ? override : null
      };
    }

    function findCatalogMatches(query) {
      const catalog = (typeof window.novaGetCatalog === "function") ? window.novaGetCatalog() : [];
      const q = (query || "").toLowerCase().trim();

      if (!q) {
        const featuredIds = ["earth", "saturn", "sirius", "alpha-centauri", "sagittarius-a-star", "ton-618"];
        const featured = [];
        for (const fid of featuredIds) {
          const hit = catalog.find(m => m && m.userData && String(m.userData.id || "").toLowerCase() === fid);
          if (hit) {
            featured.push({
              mesh: hit,
              name: String(hit.userData.name || hit.userData.id || ""),
              type: String(hit.userData.type || "OBJECT"),
              tier: hit.userData.tier || 1,
              score: 100
            });
          }
        }
        return featured;
      }

      const tierMatch = q.match(/^(?:tier\s*|t)([1-4])$/);
      const wantTier = tierMatch ? parseInt(tierMatch[1], 10) : null;

      const scored = [];
      for (const mesh of catalog) {
        if (!mesh || !mesh.userData) continue;
        const name = String(mesh.userData.name || mesh.userData.id || "");
        const id = String(mesh.userData.id || "");
        const type = String(mesh.userData.type || "");
        const tier = mesh.userData.tier || 1;
        const nLow = name.toLowerCase();
        const iLow = id.toLowerCase();

        let score = 0;
        if (wantTier !== null) {
          if (tier === wantTier) score = 60;
        } else if (nLow === q || iLow === q) score = 100;
        else if (nLow.startsWith(q) || iLow.startsWith(q)) score = 75;
        else if (nLow.includes(q) || iLow.includes(q)) score = 45;
        else if (type.toLowerCase().includes(q)) score = 20;

        if (score > 0) scored.push({ mesh, name, type, tier, score });
      }

      scored.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
      return scored.slice(0, 7);
    }

    function renderMatches(raw) {
      const parsed = parseCommand(raw);
      if (parsed.action === "reset") {
        currentMatches = [];
        selectedIdx = 0;
        resultsEl.innerHTML = "";
        resultsEl.classList.remove("has-items");
        return;
      }

      if (parsed.action === "compare") {
        const trailingSpace = /\s$/.test(raw);
        const activeQuery = trailingSpace
          ? (parsed.b ? "" : "")
          : (parsed.b || parsed.a || "");
        const rawHints = findCatalogMatches(activeQuery);
        const hints = (window.novaScaleIds
          ? rawHints.filter((m) => m.mesh && m.mesh.userData && window.novaScaleIds.has(String(m.mesh.userData.id || "").toLowerCase()))
          : rawHints
        ).slice(0, 6);
        currentMatches = hints;
        selectedIdx = Math.min(selectedIdx, Math.max(0, hints.length - 1));

        const pairLabel = (parsed.a && parsed.b)
          ? `${parsed.a.toUpperCase()} vs ${parsed.b.toUpperCase()} · ENTER TO LAUNCH`
          : (parsed.a && trailingSpace
              ? `${parsed.a.toUpperCase()} vs ... (SELECT 2ND OBJECT)`
              : (parsed.a ? `${parsed.a.toUpperCase()} · ENTER TO SELECT 1ST` : "SELECT 1ST OBJECT (OR ENTER FOR DEFAULT)"));

        const headerRow = `
          <div class="nova-cmd-item" data-compare="1">
            <span>SCALE</span>
            <span class="nova-cmd-meta">${pairLabel}</span>
          </div>
        `;
        const hintRows = hints.map((m, i) => `
          <div class="nova-cmd-item ${i === selectedIdx ? "selected" : ""}" data-scale-hint="${i}">
            <span>${m.name}</span>
            <span class="nova-cmd-meta">T${m.tier || 1} · ${m.type || "OBJECT"}</span>
          </div>
        `).join("");

        resultsEl.innerHTML = headerRow + hintRows;
        resultsEl.classList.add("has-items");

        const execRow = resultsEl.querySelector("[data-compare]");
        if (execRow) {
          execRow.addEventListener("mousedown", (e) => {
            e.preventDefault();
            executeCommand();
          });
        }

        resultsEl.querySelectorAll("[data-scale-hint]").forEach((el) => {
          el.addEventListener("mousedown", (e) => {
            e.preventDefault();
            const idx = parseInt(el.getAttribute("data-scale-hint"), 10) || 0;
            const pick = currentMatches[idx];
            if (!pick) return;
            const idToken = (pick.mesh && pick.mesh.userData && pick.mesh.userData.id) ? pick.mesh.userData.id : pick.name.toLowerCase();
            if (!parsed.a || (!trailingSpace && !parsed.b)) {
              input.value = `scale ${idToken} `;
              selectedIdx = 0;
              renderMatches(input.value);
              input.focus();
            } else {
              closeConsole();
              if (typeof window.openScaleCompare === "function") {
                window.openScaleCompare(parsed.a, idToken);
              }
            }
          });
        });
        return;
      }

      const queryStr = parsed.action === "slew" ? parsed.query : "";
      currentMatches = findCatalogMatches(queryStr);
      selectedIdx = Math.min(selectedIdx, Math.max(0, currentMatches.length - 1));

      if (!currentMatches.length) {
        resultsEl.innerHTML = "";
        resultsEl.classList.remove("has-items");
        return;
      }

      resultsEl.innerHTML = currentMatches.map((m, i) => `
        <div class="nova-cmd-item ${i === selectedIdx ? "selected" : ""}" data-idx="${i}">
          <span>${m.name}</span>
          <span class="nova-cmd-meta">T${m.tier || 1} · ${m.type || "OBJECT"}</span>
        </div>
      `).join("");
      resultsEl.classList.add("has-items");

      resultsEl.querySelectorAll(".nova-cmd-item").forEach((el) => {
        el.addEventListener("mousedown", (e) => {
          e.preventDefault();
          selectedIdx = parseInt(el.getAttribute("data-idx"), 10) || 0;
          executeCommand();
        });
      });
    }

    function executeCommand() {
      const parsed = parseCommand(input.value);
      if (parsed.action === "compare") {
        const trailingSpace = /\s$/.test(input.value);
        const pick = currentMatches[selectedIdx];
        const pickId = pick
          ? ((pick.mesh && pick.mesh.userData && pick.mesh.userData.id) ? pick.mesh.userData.id : pick.name.toLowerCase())
          : null;

        // Just "scale" with no space -> quick launch with smart default
        if (!parsed.a && !trailingSpace) {
          closeConsole();
          if (typeof window.openScaleCompare === "function") window.openScaleCompare();
          return;
        }

        // Step 1: selecting the first object (e.g. "scale " or "scale sag") -> lock it in and wait for 2nd
        if (!parsed.a || (!trailingSpace && !parsed.b)) {
          const firstId = pickId || parsed.a;
          if (firstId) {
            input.value = `scale ${firstId} `;
            selectedIdx = 0;
            renderMatches(input.value);
            input.focus();
          }
          return;
        }

        // Step 2: first object is locked ("scale sag " or "scale sag ton") -> launch with 2nd object
        const secondId = pickId || parsed.b;
        if (secondId) {
          closeConsole();
          if (typeof window.openScaleCompare === "function") {
            window.openScaleCompare(parsed.a, secondId);
          }
        }
        return;
      }
      if (parsed.action === "reset") {
        if (window.controls) window.controls.enabled = true;
        window.isFlyingToTarget = false;
        closeConsole();
        if (typeof window.triggerMapKeyReset === "function") {
          window.triggerMapKeyReset();
        } else if (typeof window.resetCameraToHome === "function") {
          window.resetCameraToHome();
        } else {
          const sphere = document.getElementById("nova-attitude-sphere");
          if (sphere) sphere.click();
        }
        setTimeout(() => { if (window.controls) window.controls.enabled = true; }, 1600);
        return;
      }
      if (parsed.action === "slew" || (parsed.action === "empty" && currentMatches.length)) {
        const match = currentMatches[selectedIdx] || (parsed.query ? findCatalogMatches(parsed.query)[0] : null);
        if (match && typeof window.novaSlewToMesh === "function") {
          if (typeof isTourActive !== "undefined" && isTourActive && typeof window.stopCosmicTour === "function") {
            window.stopCosmicTour();
          }
          window.novaSlewToMesh(match.mesh, parsed.override || null);
          closeConsole();
        } else {
          statusEl.classList.add("is-error"); statusEl.textContent = `TARGET NOT FOUND: "${parsed.query || input.value.trim()}"`;
        }
      }
    }

    input.addEventListener("focus", () => {
      selectedIdx = 0;
      renderMatches(input.value);
    });

    input.addEventListener("input", () => {
      selectedIdx = 0;
      if (statusEl) statusEl.classList.remove("is-error");
      renderMatches(input.value);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeConsole();
        return;
      }
      if (e.key === "ArrowDown" && currentMatches.length) {
        e.preventDefault();
        selectedIdx = (selectedIdx + 1) % currentMatches.length;
        renderMatches(input.value);
        return;
      }
      if (e.key === "ArrowUp" && currentMatches.length) {
        e.preventDefault();
        selectedIdx = (selectedIdx - 1 + currentMatches.length) % currentMatches.length;
        renderMatches(input.value);
        return;
      }
      if (e.key === "Tab" && currentMatches.length) {
        e.preventDefault();
        const pick = currentMatches[selectedIdx];
        const parsed = parseCommand(input.value);
        if (parsed.action === "compare") {
          const trailingSpace = /\s$/.test(input.value);
          const idToken = (pick.mesh && pick.mesh.userData && pick.mesh.userData.id) ? pick.mesh.userData.id : pick.name.toLowerCase();
          if (!parsed.a || (!trailingSpace && !parsed.b)) {
            input.value = `scale ${idToken} `;
          } else {
            input.value = `scale ${parsed.a} ${idToken}`;
          }
          selectedIdx = 0;
          renderMatches(input.value);
          return;
        }
        const tokens = input.value.trim().split(/\s+/);
        const hasVerb = ["goto", "slew", "approach", "target", "fly", "focus"].includes((tokens[0] || "").toLowerCase());
        input.value = (hasVerb ? tokens[0] + " " : "") + pick.name + " ";
        renderMatches(input.value);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        executeCommand();
      }
    });

    // Global summon shortcut: '/' or Cmd+K / Ctrl+K
    window.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
      const isCmdK = (e.metaKey || e.ctrlKey) && (e.key || "").toLowerCase() === "k";
      const isSlash = !e.metaKey && !e.ctrlKey && !e.altKey && e.key === "/" && tag !== "input" && tag !== "textarea";

      if (isCmdK || isSlash) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (isOpen) closeConsole();
        else openConsole();
      } else if (isOpen && e.key === "Escape") {
        e.preventDefault();
        closeConsole();
      }
    }, true);

    document.addEventListener("pointerdown", (e) => {
      if (isOpen && !overlay.contains(e.target)) closeConsole();
      if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === "canvas") {
        if (!window.isFlyingToTarget && !window.isCosmicTourActive && window.controls && !window.controls.enabled) {
          window.controls.enabled = true;
        }
      }
    }, true);
  })();

  // === LIVE GIMBAL TELEMETRY (AZ / EL / RNG + NASA/JPL TRV) ===
  (function initGimbalTelemetry() {
    function mountTelemetry() {
      if (document.getElementById("nova-nav-telemetry")) return true;
      const gimbal = document.getElementById("hud-center-gimbal");
      if (!gimbal) return false;

      const readout = document.createElement("div");
      readout.id = "nova-nav-telemetry";
      readout.innerHTML = `
        <div class="t-row">
          <span>AZ <span class="t-val" id="t-az">000.0°</span></span>
          <span>EL <span class="t-val" id="t-el">+00.0°</span></span>
        </div>
        <div class="t-row">
          <span>RNG <span class="t-val" id="t-rng">0.00 AU</span></span>
          <span>TRV <span class="t-val" id="t-trv">—</span></span>
        </div>
      `;
      gimbal.appendChild(readout);
      return true;
    }

    function formatRange(dist, tier) {
      if (tier >= 4 || dist > 6000) return (dist / 1200).toFixed(1) + " Mpc";
      if (tier === 3 || dist > 900) return (dist / 120).toFixed(1) + " kly";
      if (tier === 2 || dist > 260) return (dist / 18).toFixed(1) + " ly";
      return (dist / 12).toFixed(2) + " AU";
    }

    function formatTravel(val, unit) {
      if (!val || val <= 0) return "—";
      if (unit === "km") return Math.round(val).toLocaleString() + " km";
      if (unit === "AU") return val.toFixed(2) + " AU";
      // Light-years auto-scaling (ly / kly / Mly / Bly)
      if (val >= 1e9) return (val / 1e9).toFixed(2) + " Bly";
      if (val >= 1e6) return (val / 1e6).toFixed(2) + " Mly";
      if (val >= 1e3) return (val / 1e3).toFixed(1) + " kly";
      return val.toFixed(2) + " ly";
    }

    let lastUpdate = 0;
    function tickTelemetry(now) {
      requestAnimationFrame(tickTelemetry);
      if (now - lastUpdate < 60) return;
      lastUpdate = now;
      if (!mountTelemetry()) return;

      if (typeof window.novaGetTelemetry === "function") {
        const t = window.novaGetTelemetry();
        if (t) {
          const azEl = document.getElementById("t-az");
          const elEl = document.getElementById("t-el");
          const rngEl = document.getElementById("t-rng");
          if (azEl) azEl.textContent = t.az.toFixed(1).padStart(5, "0") + "°";
          if (elEl) elEl.textContent = (t.el >= 0 ? "+" : "") + t.el.toFixed(1) + "°";
          if (rngEl) rngEl.textContent = formatRange(t.dist, t.tier);
        }
      }

      const trvEl = document.getElementById("t-trv");
      const trv = window._novaTravelState;
      if (trvEl && trv) {
        trvEl.textContent = formatTravel(trv.current, trv.unit);
        trvEl.classList.toggle("in-transit", !!trv.active);
      }
    }
    requestAnimationFrame(tickTelemetry);
  })();
})();
