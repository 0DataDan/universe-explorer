// NOVA Morphing Zoom Orb Controller

(function initMorphingZoomOrb() {
    const slider = document.getElementById('scale-slider');
    const channel = document.getElementById('zoom-orb-channel');
    const canvas = document.getElementById('zoom-trail-canvas');
    const orb = document.getElementById('zoom-morph-orb');
    const anchorLeft = document.getElementById('zoom-anchor-left');
    const anchorRight = document.getElementById('zoom-anchor-right');
    const rippleLeft = document.getElementById('zoom-ripple-left');
    const rippleRight = document.getElementById('zoom-ripple-right');

    const cursorDot = document.getElementById('nova-cursor-dot');
    const cursorHalo = document.getElementById('nova-cursor-halo');

    if (!slider || !channel || !canvas || !orb) return;
    const ctx = canvas.getContext('2d');

    let cw = 144, ch = 32;
    const canvasPadX = 18;
    function resizeTrailCanvas() {
      const rect = channel.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const dpr = window.devicePixelRatio || 1;
        cw = rect.width;
        ch = rect.height;
        canvas.width = (cw + canvasPadX * 2) * dpr;
        canvas.height = ch * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, canvasPadX * dpr, 0);
      }
    }
    resizeTrailCanvas();
    window.addEventListener('resize', resizeTrailCanvas);

    // Track pointer position & drag state for Cursor-to-Orb Magnetic Morphing
    let pointerX = -999, pointerY = -999;
    let isPointerInChannel = false;
    let isDraggingOrb = false;

    window.addEventListener('pointermove', (e) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
    });
    channel.addEventListener('pointerenter', () => { isPointerInChannel = true; });
    channel.addEventListener('pointerleave', () => { isPointerInChannel = false; });
    slider.addEventListener('pointerdown', () => {
      isDraggingOrb = true;
      document.body.classList.add('nova-orb-locked');
    });
    window.addEventListener('pointerup', () => {
      if (isDraggingOrb) {
        isDraggingOrb = false;
        document.body.classList.remove('nova-orb-locked');
      }
    });

    function getNormalizedSlider() {
      const v = parseFloat(slider.value) || 3.70;
      return Math.max(0, Math.min(1, (v - 1.0) / 3.0));
    }

    let displayNorm = getNormalizedSlider();
    let lastX = null;
    let dockedState = null;
    const trailNodes = [];

    function triggerEclipseRipple(side) {
      const el = side === 'left' ? rippleLeft : rippleRight;
      if (!el) return;
      el.classList.remove('eclipse-ripple-active');
      void el.offsetWidth;
      el.classList.add('eclipse-ripple-active');
    }

    function updateMorphingOrbFrame() {
      if (cw <= 0) resizeTrailCanvas();
      const targetNorm = getNormalizedSlider();

      // Responsive interpolation for both mouse drag and two-finger trackpad swipe
      displayNorm += (targetNorm - displayNorm) * 0.28;
      if (Math.abs(targetNorm - displayNorm) < 0.0002) {
        displayNorm = targetNorm;
      }

      const minX = 5;
      const maxX = Math.max(20, cw - 7);
      const x = minX + displayNorm * (maxX - minX);
      const y = ch / 2;

      // Two-stage diameter curve: stays compact (4.5px -> 7.4px) across 0%..90% of the slider so it is unmistakably smaller than the 12px right circle, then smoothly expands to 12.0px at 100% full zoom
      const baseGrowth = displayNorm * 3.1; // +3.1px linear growth
      const finalDockGrowth = Math.pow(displayNorm, 6.0) * 4.4; // +4.4px only near the very end (92%..100%)
      const diameter = 4.5 + baseGrowth + finalDockGrowth;
      const radius = diameter / 2;

      orb.style.boxSizing = 'border-box';
      orb.style.left = `${x}px`;
      orb.style.width = `${diameter.toFixed(2)}px`;
      orb.style.height = `${diameter.toFixed(2)}px`;

      const fillAlpha = 0.92 - Math.pow(displayNorm, 2.0) * 0.32;
      const glowSpread = 3.0 + Math.pow(displayNorm, 3.0) * 5.0;
      orb.style.background = `rgba(103, 232, 249, ${fillAlpha.toFixed(2)})`;
      orb.style.border = '1px solid rgba(224, 242, 254, 0.9)';
      orb.style.boxShadow = `0 0 ${glowSpread.toFixed(1)}px rgba(34, 211, 238, ${(0.5 + displayNorm * 0.3).toFixed(2)})`;

      // Check if cursor is directly over the active orb, left anchor, or right anchor, or actively dragging
      const rect = channel.getBoundingClientRect();
      const orbScreenX = rect.left + x;
      const orbScreenY = rect.top + y;
      const leftAnchorScreenX = rect.left + minX;
      const rightAnchorScreenX = rect.left + maxX;

      const distToOrb = Math.hypot(pointerX - orbScreenX, pointerY - orbScreenY);
      const distToLeft = Math.hypot(pointerX - leftAnchorScreenX, pointerY - orbScreenY);
      const distToRight = Math.hypot(pointerX - rightAnchorScreenX, pointerY - orbScreenY);

      if (cursorDot && cursorHalo) {
        if (isDraggingOrb || (isPointerInChannel && distToOrb <= 14)) {
          // Lock & morph cursor circle to match the moving zoom orb's exact size and position
          cursorDot.style.left = `${orbScreenX}px`;
          cursorDot.style.top = `${orbScreenY}px`;
          cursorDot.style.width = `${diameter}px`;
          cursorDot.style.height = `${diameter}px`;
          cursorDot.style.backgroundColor = 'rgba(165, 243, 252, 0.98)';
          cursorDot.style.boxShadow = `0 0 ${glowSpread + 4}px 2px rgba(34, 211, 238, 0.95)`;
          cursorHalo.style.width = `${diameter + 6}px`;
          cursorHalo.style.height = `${diameter + 6}px`;
          cursorHalo.style.opacity = '0.35';
        } else if (isPointerInChannel && distToLeft <= 10) {
          // Match left small anchor circle (6px) when hovering directly over it
          cursorDot.style.left = `${leftAnchorScreenX}px`;
          cursorDot.style.top = `${orbScreenY}px`;
          cursorDot.style.width = '6px';
          cursorDot.style.height = '6px';
          cursorHalo.style.width = '14px';
          cursorHalo.style.height = '14px';
          cursorHalo.style.opacity = '0.4';
        } else if (isPointerInChannel && distToRight <= 12) {
          // Match right larger anchor circle (10px) when hovering directly over it
          cursorDot.style.left = `${rightAnchorScreenX}px`;
          cursorDot.style.top = `${orbScreenY}px`;
          cursorDot.style.width = '10px';
          cursorDot.style.height = '10px';
          cursorHalo.style.width = '18px';
          cursorHalo.style.height = '18px';
          cursorHalo.style.opacity = '0.4';
        } else {
          // Restore default Celestial Point cursor dimensions
          cursorDot.style.width = '';
          cursorDot.style.height = '';
          cursorDot.style.backgroundColor = '';
          cursorDot.style.boxShadow = '';
          cursorHalo.style.width = '';
          cursorHalo.style.height = '';
          cursorHalo.style.opacity = '';
        }
      }

      // Anchor opacity & Eclipse Resonance Docking detection
      if (anchorLeft) {
        anchorLeft.style.opacity = displayNorm < 0.06 ? '0.15' : '0.45';
      }
      if (anchorRight) {
        anchorRight.style.opacity = displayNorm > 0.94 ? '0.95' : '0.48';
        anchorRight.style.borderColor = displayNorm > 0.94 ? 'rgba(165, 243, 252, 0.95)' : 'rgba(103, 232, 249, 0.5)';
      }

      if (displayNorm <= 0.018 && dockedState !== 'left') {
        dockedState = 'left';
        triggerEclipseRipple('left');
      } else if (displayNorm >= 0.982 && dockedState !== 'right') {
        dockedState = 'right';
        triggerEclipseRipple('right');
      } else if (displayNorm > 0.04 && displayNorm < 0.96) {
        dockedState = null;
      }

      // Spawn dense, long-lasting comet wake segments for BOTH mouse drag and two-finger trackpad scroll
      if (lastX !== null) {
        const dx = x - lastX;
        const absDx = Math.abs(dx);
        if (absDx > 0.025) {
          // Sub-stepping every 1.1px guarantees a smooth, unbroken ribbon trail
          const steps = Math.min(14, Math.max(1, Math.ceil(absDx / 1.1)));
          for (let s = 1; s <= steps; s++) {
            const interpX = lastX + (dx * s) / steps;
            trailNodes.push({
              x: interpX,
              y: y,
              r: radius * 0.95,
              alpha: Math.min(0.62, 0.28 + absDx * 0.065)
            });
          }
        }
      }
      lastX = x;

      // Render & slowly decay the trail (3.5x longer persistence so it stays visible much longer)
      ctx.clearRect(-canvasPadX, 0, cw + canvasPadX * 2, ch);
      for (let i = trailNodes.length - 1; i >= 0; i--) {
        const pt = trailNodes[i];
        pt.alpha -= 0.0045; // Slow decay for long, lingering comet tail
        pt.r *= 0.994;      // Gradual taper toward the tail tip
        if (pt.alpha <= 0.004) {
          trailNodes.splice(i, 1);
          continue;
        }
        const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pt.r * 2.1);
        grad.addColorStop(0, `rgba(165, 243, 252, ${pt.alpha})`);
        grad.addColorStop(0.45, `rgba(34, 211, 238, ${pt.alpha * 0.65})`);
        grad.addColorStop(1, 'rgba(34, 211, 238, 0)');
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r * 2.1, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      requestAnimationFrame(updateMorphingOrbFrame);
    }

    requestAnimationFrame(updateMorphingOrbFrame);
  })();



    // =========================================================================
    // N - O - V - A  GEOMETRIC RIM TOGGLES & 4-QUADRANT FULLSCREEN HANDLERS
    // =========================================================================
    (function initNovaHudToggles() {
      const CLEAN_BTN_CLASS = "relative w-[25px] h-[25px] rounded-full flex items-center justify-center transition-transform duration-300 transform hover:scale-110 shrink-0 cursor-pointer p-0 bg-transparent border-0 shadow-none outline-none";

      function setNovaButtonVisual(btnId, activeGroupId, inactiveGroupId, isActive) {
        const btn = document.getElementById(btnId);
        if (btn) {
          btn.dataset.novaActive = isActive ? "true" : "false";
          btn.className = CLEAN_BTN_CLASS;
          btn.style.width = "22px";
          btn.style.height = "22px";
          btn.style.minWidth = "22px";
          btn.style.minHeight = "22px";
          btn.style.background = "transparent";
          btn.style.border = "none";
          btn.style.boxShadow = "none";
        }
        const activeG = document.getElementById(activeGroupId);
        const inactiveG = document.getElementById(inactiveGroupId);
        if (activeG) activeG.style.display = isActive ? "inline" : "none";
        if (inactiveG) inactiveG.style.display = isActive ? "none" : "inline";
      }

      // 1. [N] Cosmic Web Filaments Toggle
      let novaNActive = true;
      window.syncNovaNVisual = function(forceState) {
        if (typeof forceState === "boolean") {
          novaNActive = forceState;
        } else if (typeof isCosmicWebVisible !== "undefined") {
          novaNActive = !!isCosmicWebVisible;
        }
        setNovaButtonVisual("btn-cosmic-web", "nova-n-active-group", "nova-n-inactive-group", novaNActive);
      };

      window.handleNovaNClick = function(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (typeof window.toggleCosmicWeb === "function") {
          window.toggleCosmicWeb();
        }
        // Directly sync with actual scene state if available, otherwise flip
        if (typeof isCosmicWebVisible !== "undefined") {
          novaNActive = !!isCosmicWebVisible;
        } else {
          novaNActive = !novaNActive;
        }
        window.syncNovaNVisual(novaNActive);
      };

      // Also hook into window.toggleCosmicWeb in case Guided Tour or Tier 4 triggers it programmatically
      const baseToggleWeb = window.toggleCosmicWeb;
      window.toggleCosmicWeb = function() {
        if (typeof baseToggleWeb === "function") baseToggleWeb();
        if (typeof isCosmicWebVisible !== "undefined") {
          novaNActive = !!isCosmicWebVisible;
        } else {
          novaNActive = !novaNActive;
        }
        window.syncNovaNVisual(novaNActive);
      };

      // 2. [O] Orbits Toggle
      let novaOActive = true;
      window.syncNovaOVisual = function(forceState) {
        if (typeof forceState === "boolean") {
          novaOActive = forceState;
        } else if (typeof isOrbitPaused !== "undefined") {
          novaOActive = !isOrbitPaused;
        }
        setNovaButtonVisual("btn-orbits", "nova-o-active-group", "nova-o-inactive-group", novaOActive);
      };

      window.handleNovaOClick = function(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (typeof window.toggleOrbitPause === "function") {
          window.toggleOrbitPause();
        }
        if (typeof isOrbitPaused !== "undefined") {
          novaOActive = !isOrbitPaused;
        } else {
          novaOActive = !novaOActive;
        }
        window.syncNovaOVisual(novaOActive);
      };

      // 3. [V] Labels Toggle
      let novaVActive = true;
      window.syncNovaVVisual = function(forceState) {
        if (typeof forceState === "boolean") {
          novaVActive = forceState;
        } else if (typeof areLabelsVisible !== "undefined") {
          novaVActive = !!areLabelsVisible;
        }
        setNovaButtonVisual("btn-toggle-labels", "nova-v-active-group", "nova-v-inactive-group", novaVActive);
      };

      window.handleNovaVClick = function(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (typeof window.toggleLabels === "function") {
          window.toggleLabels(e);
        }
        const layer = document.getElementById("celestial-labels-layer");
        if (layer && layer.style.display) {
          novaVActive = (layer.style.display !== "none");
        } else if (typeof areLabelsVisible !== "undefined") {
          novaVActive = !!areLabelsVisible;
        } else {
          novaVActive = !novaVActive;
        }
        window.syncNovaVVisual(novaVActive);
      };

      // 4. [A] Tiers Toggle (Active = All Tiers [0], Inactive = Solar System Only [1])
      let novaAActive = true;
      window.syncNovaAVisual = function(forceState) {
        if (typeof forceState === "boolean") {
          novaAActive = forceState;
        }
        setNovaButtonVisual("btn-t0", "nova-a-active-group", "nova-a-inactive-group", novaAActive);
      };

      window.handleNovaAClick = function(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        novaAActive = !novaAActive;
        const targetTier = novaAActive ? 0 : 1;
        if (typeof window.filterByTier === "function") {
          window.filterByTier(targetTier);
        } else if (typeof window.selectTierFromMenu === "function") {
          window.selectTierFromMenu(targetTier, e);
        }
        window.syncNovaAVisual(novaAActive);
      };
      window.toggleAllOrSolarTiers = window.handleNovaAClick;

      // 5. Fullscreen 4-Quadrant Crosshair Animation (SSmini.png <-> SSfull.png)
      function syncFullscreenQuadrantUI() {
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        const ringGroup = document.getElementById("fs-quadrant-ring-group");
        const crossGroup = document.getElementById("fs-dark-cross");
        const outerGuide = document.getElementById("fs-outer-guide");
        const glowWrapper = document.getElementById("fs-glow-wrapper");
        if (ringGroup) ringGroup.style.transform = isFs ? "scale(1.0)" : "scale(0.86)";
        if (outerGuide) outerGuide.style.opacity = isFs ? "0" : "1";
        if (glowWrapper) {
          glowWrapper.style.filter = isFs
            ? "drop-shadow(0 0 5px rgba(34, 211, 238, 0.85))"
            : "drop-shadow(0 0 3px rgba(34, 211, 238, 0.55))";
        }
      }

      document.addEventListener("fullscreenchange", syncFullscreenQuadrantUI);
      document.addEventListener("webkitfullscreenchange", syncFullscreenQuadrantUI);

      const origToggleFs = window.toggleFullscreenZen;
      window.toggleFullscreenZen = function() {
        if (typeof origToggleFs === "function") origToggleFs();
        setTimeout(syncFullscreenQuadrantUI, 60);
        setTimeout(syncFullscreenQuadrantUI, 350);
      };

      function syncAllInitial() {
        window.syncNovaNVisual();
        window.syncNovaOVisual();
        window.syncNovaVVisual();
        window.syncNovaAVisual();
        syncFullscreenQuadrantUI();
      }

      syncAllInitial();
      setTimeout(syncAllInitial, 150);
      setTimeout(syncAllInitial, 600);



      

      

      // === UPDATE 5: Subtle Idle HUD Dimming + Flight-Deck Keyboard Shortcuts ===
      (function initIdleDimmingAndHotkeys() {
        const IDLE_TIMEOUT_MS = 6000;
        let idleTimer = null;
        let isPointerOverHud = false;

        // Add clean accessible aria-labels to icon-only controls without browser title tooltips
        const ariaMap = {
          "btn-cosmic-tour": "Toggle Guided Cosmic Tour (Shortcut: T)",
          "nova-attitude-sphere": "Reset Attitude to Solar System View (Shortcut: R)",
          "btn-cosmic-web": "Toggle Network Filaments [N] (Shortcut: N)",
          "btn-orbits": "Toggle Orbital Motion [O] (Shortcut: O)",
          "btn-toggle-labels": "Toggle Viewport Labels [V] (Shortcut: V)",
          "btn-t0": "Toggle Aperture Scale Depth [A] (Shortcut: A)",
          "btn-toggle-sidebar": "Toggle Planet Overview Panels (Shortcut: I)",
          "btn-fullscreen-zen": "Toggle Fullscreen Mode (Shortcut: F)",
          "map-key-summon-btn": "Map Key Drawer (Hover or Shortcut: M)",
          "map-key-attached-tab": "Map Key Accent Line"
        };
        Object.keys(ariaMap).forEach((id) => {
          const el = document.getElementById(id);
          if (el) {
            el.setAttribute("aria-label", ariaMap[id]);
            el.removeAttribute("title");
          }
        });

        // Hover listeners for Map Key hairline trigger and drawer
        const summonBtn = document.getElementById("map-key-summon-btn");
        const drawer = document.getElementById("map-key-drawer");
        if (summonBtn) {
          summonBtn.addEventListener("mouseenter", () => window.openMapKey());
          summonBtn.addEventListener("mouseleave", () => window.scheduleCloseMapKey(400));
        }
        if (drawer) {
          drawer.addEventListener("mouseenter", () => window.openMapKey());
          drawer.addEventListener("mouseleave", () => window.scheduleCloseMapKey(400));
        }

        function wakeHud() {
          document.documentElement.classList.remove("nova-hud-idle");
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            if (document.documentElement.classList.contains("is-booting")) return;
            if (isPointerOverHud) return;
            // Keep HUD fully awake if Map Key drawer is actively open
            const mk = document.getElementById("map-key-drawer");
            const isMkOpen = mk && !mk.classList.contains("translate-x-[300px]");
            if (isMkOpen) return;
            document.documentElement.classList.add("nova-hud-idle");
          }, IDLE_TIMEOUT_MS);
        }

        // Track whether cursor is resting on any HUD element so it never dims under the user's hand
        document.addEventListener("pointermove", (e) => {
          if (e.target && e.target.closest) {
            isPointerOverHud = Boolean(
              e.target.closest("#bottom-hud, #map-key-drawer, #map-key-summon-btn, #header-nova-pill")
            );
          }

          // Proximity glow: intensify optical glow on proximity (within 120px from right screen edge)
          const distFromRight = window.innerWidth - e.clientX;
          const mkSummon = document.getElementById("map-key-summon-btn");
          if (mkSummon) {
            if (distFromRight <= 120) {
              mkSummon.classList.add("laser-proximity");
            } else {
              mkSummon.classList.remove("laser-proximity");
            }
          }

          // Slide out Map Key drawer when hovering near right screen edge (within 8px)
          if (e.clientX >= window.innerWidth - 8 && e.clientY > 80 && e.clientY < window.innerHeight - 80) {
            window.openMapKey();
          }

          if (window.isScreensaverActive) {
            window.exitScreensaverMode();
          }
          if (typeof window.resetScreensaverTimer === "function") {
            window.resetScreensaverTimer();
          }

          wakeHud();
        }, { passive: true });

        ["pointerdown", "pointermove", "wheel", "touchstart"].forEach((evt) => {
          window.addEventListener(evt, () => {
            if (window.isScreensaverActive) {
              window.exitScreensaverMode();
            }
            if (typeof window.resetScreensaverTimer === "function") {
              window.resetScreensaverTimer();
            }
            wakeHud();
          }, { passive: true });
        });

        wakeHud();

        // Flight-Deck Keyboard Shortcuts
        window.addEventListener("keydown", (e) => {
          const _cmp = document.getElementById("nova-compare-overlay"); if (_cmp && !_cmp.classList.contains("hidden") && _cmp.style.display !== "none") return;
          if (e.defaultPrevented) return;
          if (e.metaKey || e.ctrlKey || e.altKey) return;
          if (document.documentElement.classList.contains("is-booting")) return;

          const key = (e.key || "").toLowerCase();

          // Specification 5: Subtle manual keyboard shortcut ('S' or 'P') to toggle Screensaver Mode
          if (key === "s") {
            const activeEl = document.activeElement;
            const isTyping = activeEl && (
              activeEl.tagName === "INPUT" ||
              activeEl.tagName === "TEXTAREA" ||
              activeEl.tagName === "SELECT" ||
              activeEl.isContentEditable
            ) && activeEl.type !== "range";
            if (!isTyping) {
              e.preventDefault();
              if (typeof window.toggleScreensaverMode === "function") {
                window.toggleScreensaverMode(e);
              }
              return;
            }
          }

          // Specification 4: Any keydown immediately deactivates Screensaver Mode
          if (window.isScreensaverActive) {
            window.exitScreensaverMode();
            wakeHud();
            return;
          }

          if (typeof window.resetScreensaverTimer === "function") {
            window.resetScreensaverTimer();
          }
          wakeHud();

          const activeEl = document.activeElement;
          if (activeEl && (
            activeEl.tagName === "INPUT" ||
            activeEl.tagName === "TEXTAREA" ||
            activeEl.tagName === "SELECT" ||
            activeEl.isContentEditable
          )) {
            // Allow arrow keys on range slider, ignore letter hotkeys if typing in text field
            if (activeEl.type !== "range") return;
          }

          switch (key) {
            case "n":
              e.preventDefault();
              if (typeof window.handleNovaNClick === "function") window.handleNovaNClick(e);
              break;
            case "o":
              e.preventDefault();
              if (typeof window.handleNovaOClick === "function") window.handleNovaOClick(e);
              break;
            case "v":
              e.preventDefault();
              if (typeof window.handleNovaVClick === "function") window.handleNovaVClick(e);
              break;
            case "a":
              e.preventDefault();
              if (typeof window.handleNovaAClick === "function") window.handleNovaAClick(e);
              break;
            case "r":
              e.preventDefault();
              if (typeof window.triggerMapKeyReset === "function") {
                window.triggerMapKeyReset(e);
              } else {
                const sphere = document.getElementById("nova-attitude-sphere");
                if (sphere) sphere.click();
              }
              break;
            case "m":
            case "k":
              e.preventDefault();
              if (typeof window.toggleMapKey === "function") window.toggleMapKey(e);
              break;
            case "i":
              e.preventDefault();
              if (typeof window.togglePlanetOverview === "function") window.togglePlanetOverview(e);
              break;
            case "f":
              e.preventDefault();
              if (typeof window.toggleFullscreenZen === "function") window.toggleFullscreenZen();
              break;
            case "t":
              e.preventDefault();
              if (typeof window.toggleCosmicTour === "function") window.toggleCosmicTour(e);
              break;
          }
        });
      })();

    })();
