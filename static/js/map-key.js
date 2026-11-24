// NOVA Map Key Drawer & Sync Controls

// === SYNC MAP KEY TAB HEIGHT WITH MAP KEY DRAWER ===
    (function initMapKeyTabHeightSync() {
      function syncTabHeight() {
        const mkDrawer = document.getElementById('map-key-drawer');
        const mkSummon = document.getElementById('map-key-summon-btn');
        if (mkDrawer && mkSummon) {
          const mkRect = mkDrawer.getBoundingClientRect();
          if (mkRect.height > 40) {
            mkSummon.style.height = mkRect.height + 'px';
          }
        }
      }
      window.addEventListener('DOMContentLoaded', () => {
        const mkDrawer = document.getElementById('map-key-drawer');
        if (mkDrawer && typeof ResizeObserver !== 'undefined') {
          const ro = new ResizeObserver(() => syncTabHeight());
          ro.observe(mkDrawer);
        }
        setTimeout(syncTabHeight, 150);
        setTimeout(syncTabHeight, 600);
      });
      window.addEventListener('resize', syncTabHeight);
    })();

    /* ==========================================================================
       NOVA Cinematic Boot Sequence & Interactive Wormhole Transition Controller
       ========================================================================== */
    window.handleHeaderLogoClick = function(event) {
      window.replayBootSequence();
    };

    window.replayBootSequence = function() {
      try {
        localStorage.removeItem("hasBootedSession");
      } catch (e) {}
      const url = new URL(window.location.href);
      url.searchParams.set("boot", "1");
      window.location.href = url.toString();
    };

    (function initNovaCinematicBoot() {
      const _rawHash = (window.location.hash || "").replace(/^#/, "").trim();
      const hasBooted = new RegExp("(?:^|&)(?:target|tier)=", "i").test(_rawHash);

      const overlay = document.getElementById("nova-boot-overlay");
      if (hasBooted) {
        if (overlay) {
          overlay.style.display = "none";
          overlay.style.pointerEvents = "none";
          overlay.classList.add("boot-completed");
        }
        const splashContainer = document.getElementById("nova-boot-center-container");
        if (splashContainer) {
          splashContainer.style.display = "none";
          splashContainer.style.pointerEvents = "none";
          splashContainer.classList.add("boot-completed");
        }
        const warpCanvas = document.getElementById("nova-warp-canvas");
        if (warpCanvas) {
          warpCanvas.style.display = "none";
          warpCanvas.style.pointerEvents = "none";
        }
        document.documentElement.classList.remove("is-booting");
        const headerLogo = document.getElementById("header-nova-logo");
        if (headerLogo) headerLogo.style.opacity = "";
        if (typeof controls !== "undefined" && controls) {
          controls.enabled = true;
          controls.enableRotate = true;
          controls.enableZoom = true;
          controls.enablePan = true;
          controls.update();
        }
        return;
      }

      // Cold Start Mode: Render static NOVA wordmark immediately with zero flashing or delay
      document.documentElement.classList.add("is-booting");

      const baseWordmark = document.getElementById("nova-base-wordmark");
      if (baseWordmark) {
        baseWordmark.style.opacity = "1";
        baseWordmark.style.visibility = "visible";
        baseWordmark.style.display = "block";
      }

      const portalO = document.getElementById("nova-portal-o");
      if (portalO) {
        portalO.classList.add("portal-ready");
        portalO.addEventListener("click", onPortalTriggerClick, { once: true });
      }

      // =========================================================================
      // INTERACTIVE MONOCHROME BOOT FIELD & VECTOR WORDMARK PHYSICS (ZERO COLOR)
      // =========================================================================
      let stopIdleBootField = (function initInteractiveBootField() {
        const canvas = document.getElementById("nova-warp-canvas");
        const svgEl = document.getElementById("nova-boot-svg");
        const overlayEl = document.getElementById("nova-boot-overlay");
        if (!canvas || !svgEl || !overlayEl) return null;

        const ctx = canvas.getContext("2d");
        let w = (canvas.width = window.innerWidth);
        let h = (canvas.height = window.innerHeight);
        canvas.style.opacity = "1";

        // Sample original SVG wordmark paths for smooth, controlled elastic flexing
        const pathIds = ["nova-base-n", "nova-svg-o-top", "nova-svg-o-bot", "nova-base-v", "nova-base-a"];
        const idlePaths = [];
        pathIds.forEach((id) => {
          const el = document.getElementById(id);
          if (!el || typeof el.getTotalLength !== "function") return;
          const totalLen = el.getTotalLength();
          const numPts = Math.max(56, Math.ceil(totalLen / 2.0));
          const pts = [];
          for (let i = 0; i <= numPts; i++) {
            const pt = el.getPointAtLength((i / numPts) * totalLen);
            pts.push({ ox: pt.x, oy: pt.y, vx: 0, vy: 0, dx: 0, dy: 0 });
          }
          idlePaths.push({ el, pts });
        });

        const dotEl = document.getElementById("nova-base-a-dot");
        const idleDot = { ox: 657.5, oy: 71.5, r: 11.5, vx: 0, vy: 0, dx: 0, dy: 0, dr: 0, vr: 0 };

        // Monochrome background particles (kept identical to current feel)
        const particleCount = 115;
        const bgParticles = [];
        function seedParticles() {
          bgParticles.length = 0;
          for (let i = 0; i < particleCount; i++) {
            const hx = Math.random() * w;
            const hy = Math.random() * h;
            bgParticles.push({
              hx, hy,
              x: hx, y: hy,
              vx: 0, vy: 0,
              size: 0.9 + Math.random() * 1.5,
              baseAlpha: 0.16 + Math.random() * 0.32,
              phase: Math.random() * Math.PI * 2
            });
          }
        }
        seedParticles();

        const onResize = () => {
          w = canvas.width = window.innerWidth;
          h = canvas.height = window.innerHeight;
          seedParticles();
        };
        window.addEventListener("resize", onResize);

        const pointer = { x: -9999, y: -9999, vx: 0, vy: 0, active: false };
        const ripples = [];

        const onMove = (e) => {
          if (pointer.active) {
            pointer.vx = e.clientX - pointer.x;
            pointer.vy = e.clientY - pointer.y;
          }
          pointer.x = e.clientX;
          pointer.y = e.clientY;
          pointer.active = true;
        };

        const onDown = (e) => {
          if (e.target && e.target.closest && e.target.closest("#nova-portal-o")) return;
          // Single, whisper-thin hairline ripple that pushes particles and gently flexes letters
          ripples.push({
            x: e.clientX,
            y: e.clientY,
            r: 4,
            maxR: Math.hypot(w, h) * 0.75,
            speed: 8.2,
            alpha: 0.16,
            strength: 1.05,
            bandWidth: 72
          });
        };

        window.addEventListener("pointermove", onMove, { passive: true });
        overlayEl.addEventListener("pointerdown", onDown);

        let isRunning = true;
        let isPortalLaunching = false;
        let rafId = null;

        window.triggerPortalIdleShockwave = function(cx, cy) {
          isPortalLaunching = true;
          pointer.active = false;
          ripples.push({
            x: cx,
            y: cy,
            r: 4,
            maxR: Math.hypot(w, h) * 0.78,
            speed: 8.6,
            alpha: 0.20,
            strength: 1.35,
            bandWidth: 80
          });
        };

        function tick(now) {
          if (!isRunning) return;
          const t = now * 0.001;
          ctx.clearRect(0, 0, w, h);

          pointer.vx *= 0.85;
          pointer.vy *= 0.85;

          // 1. Find the 4 closest background particles within magnetic range (220px) — UNCHANGED
          const pullRadius = 220;
          const candidates = [];
          if (pointer.active) {
            for (let i = 0; i < bgParticles.length; i++) {
              const p = bgParticles[i];
              const d = Math.hypot(pointer.x - p.hx, pointer.y - p.hy);
              if (d < pullRadius) {
                candidates.push({ idx: i, d });
              }
            }
            candidates.sort((a, b) => a.d - b.d);
          }
          const pulledSet = new Set(candidates.slice(0, 4).map((c) => c.idx));

          // 2. Update & draw ultra-subtle hairline ripple ring (no heavy radial fill glow)
          for (let r = ripples.length - 1; r >= 0; r--) {
            const rip = ripples[r];
            rip.r += rip.speed;
            const progress = rip.r / rip.maxR;
            rip.alpha *= 0.972;
            rip.strength *= 0.980;

            if (rip.alpha <= 0.004 || progress >= 1.0) {
              ripples.splice(r, 1);
              continue;
            }

            ctx.strokeStyle = `rgba(255, 255, 255, ${rip.alpha.toFixed(3)})`;
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
            ctx.stroke();
          }

          // 3. Update & draw monochrome background particles — UNCHANGED
          for (let i = 0; i < bgParticles.length; i++) {
            const p = bgParticles[i];
            const targetHx = p.hx + Math.cos(t * 0.45 + p.phase) * 3.5;
            const targetHy = p.hy + Math.sin(t * 0.45 + p.phase) * 3.5;

            if (pulledSet.has(i)) {
              const dx = pointer.x - p.x;
              const dy = pointer.y - p.y;
              const dist = Math.hypot(dx, dy);
              const pullFactor = Math.max(0, 1 - dist / pullRadius);
              p.vx += dx * 0.022 * pullFactor;
              p.vy += dy * 0.022 * pullFactor;
              p.vx += (targetHx - p.x) * 0.025;
              p.vy += (targetHy - p.y) * 0.025;

              const lineAlpha = pullFactor * 0.22;
              if (lineAlpha > 0.01) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${lineAlpha.toFixed(3)})`;
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(pointer.x, pointer.y);
                ctx.stroke();
              }
            } else {
              p.vx += (targetHx - p.x) * 0.038;
              p.vy += (targetHy - p.y) * 0.038;
            }

            let waveHighlight = 0;
            for (let r = 0; r < ripples.length; r++) {
              const rip = ripples[r];
              const rx = p.x - rip.x;
              const ry = p.y - rip.y;
              const rDist = Math.hypot(rx, ry) || 1;
              const bandDist = rDist - rip.r;
              if (Math.abs(bandDist) < rip.bandWidth) {
                const phase = (bandDist / rip.bandWidth) * Math.PI;
                const env = Math.cos(phase * 0.5);
                const waveForce = -Math.sin(phase) * env * rip.strength * 3.4;
                p.vx += (rx / rDist) * waveForce;
                p.vy += (ry / rDist) * waveForce;
                waveHighlight = Math.max(waveHighlight, env * rip.strength * 0.32);
              }
            }

            p.vx *= 0.87;
            p.vy *= 0.87;
            p.x += p.vx;
            p.y += p.vy;

            const activeBoost = (pulledSet.has(i) ? 0.42 : 0) + waveHighlight;
            const alpha = Math.min(0.98, p.baseAlpha + activeBoost);
            const radius = p.size * (1 + (pulledSet.has(i) ? 0.35 : 0) + waveHighlight * 0.6);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fill();
          }

         // 4. Balanced Elastic SVG Wordmark Flexing (Smooth, legible, zero twisting knots)
          const svgRect = svgEl.getBoundingClientRect();
          if (!isPortalLaunching && svgRect.width > 0 && svgRect.height > 0) {
            const scaleX = 734 / svgRect.width;
            const scaleY = 144 / svgRect.height;
            const svgMouseX = (pointer.x - svgRect.left) * scaleX;
            const svgMouseY = (pointer.y - svgRect.top) * scaleY;
            const svgRadius = 120; // Balanced proximity radius

            function stepSvgPoint(pt, isDot) {
              // Firmer spring return (0.11) and controlled damping (0.82)
              let fx = -pt.dx * 0.11;
              let fy = -pt.dy * 0.11;

              if (pointer.active) {
                const mx = pt.ox + pt.dx - svgMouseX;
                const my = pt.oy + pt.dy - svgMouseY;
                const mDist = Math.hypot(mx, my);
                if (mDist < svgRadius && mDist > 0.01) {
                  const norm = 1 - mDist / svgRadius;
                  const falloff = norm * norm;
                  fx += (mx / mDist) * falloff * 2.4 + pointer.vx * 0.045 * falloff;
                  fy += (my / mDist) * falloff * 2.4 + pointer.vy * 0.045 * falloff;
                }
              }

              // Smooth, medium wave undulation when a click ripple passes through the letters
              for (let r = 0; r < ripples.length; r++) {
                const rip = ripples[r];
                const ripSvgX = (rip.x - svgRect.left) * scaleX;
                const ripSvgY = (rip.y - svgRect.top) * scaleY;
                const ripSvgR = rip.r * scaleX;
                const bandW = rip.bandWidth * scaleX;
                const rx = pt.ox - ripSvgX;
                const ry = pt.oy - ripSvgY;
                const rDist = Math.hypot(rx, ry) || 1;
                const diff = rDist - ripSvgR;
                if (Math.abs(diff) < bandW) {
                  const phase = (diff / bandW) * Math.PI;
                  const env = Math.cos(phase * 0.5);
                  const radialWave = -Math.sin(phase) * env * rip.strength * 2.8;
                  const vertWave = Math.cos(phase) * env * rip.strength * 2.2;
                  fx += (rx / rDist) * radialWave;
                  fy += (ry / rDist) * radialWave * 0.45 + vertWave;
                  if (isDot) {
                    pt.vr += radialWave * 0.04;
                  }
                }
              }

              pt.vx = (pt.vx + fx) * 0.82;
              pt.vy = (pt.vy + fy) * 0.82;
              pt.dx = Math.max(-14, Math.min(14, pt.dx + pt.vx));
              pt.dy = Math.max(-12, Math.min(12, pt.dy + pt.vy));
            }

            idlePaths.forEach((item) => {
              const pts = item.pts;
              let dStr = "";
              for (let i = 0; i < pts.length; i++) {
                stepSvgPoint(pts[i], false);
                const px = pts[i].ox + pts[i].dx;
                const py = pts[i].oy + pts[i].dy;
                dStr += (i === 0 ? "M " : " L ") + px.toFixed(2) + " " + py.toFixed(2);
              }
              item.el.setAttribute("d", dStr);
            });

            if (dotEl) {
              stepSvgPoint(idleDot, true);
              idleDot.vr = (idleDot.vr - idleDot.dr * 0.12) * 0.82;
              idleDot.dr = Math.max(-2.5, Math.min(3.5, idleDot.dr + idleDot.vr));
              dotEl.setAttribute("cx", (idleDot.ox + idleDot.dx).toFixed(2));
              dotEl.setAttribute("cy", (idleDot.oy + idleDot.dy).toFixed(2));
              dotEl.setAttribute("r", (idleDot.r + idleDot.dr).toFixed(2));
            }
          }

          rafId = requestAnimationFrame(tick);
        }

        rafId = requestAnimationFrame(tick);

        return function cleanupIdleBootField() {
          isRunning = false;
          if (rafId) cancelAnimationFrame(rafId);
          window.removeEventListener("resize", onResize);
          window.removeEventListener("pointermove", onMove);
          overlayEl.removeEventListener("pointerdown", onDown);
          if (ctx) ctx.clearRect(0, 0, w, h);
        };
      })();

      // Pure monochrome starfield warp canvas (Zero color tints, pure white stars)
      function runStarfieldWarp(cx, cy, duration = 6200) {
        const canvas = document.getElementById("nova-warp-canvas");
        if (!canvas) return null;
        const ctx = canvas.getContext("2d");
        const w = (canvas.width = window.innerWidth);
        const h = (canvas.height = window.innerHeight);

        canvas.style.opacity = "1";
        canvas.style.transition = "none";

        const numStars = 220;
        const stars = [];
        for (let i = 0; i < numStars; i++) {
          stars.push({
            x: (Math.random() - 0.5) * w * 2.5,
            y: (Math.random() - 0.5) * h * 2.5,
            z: Math.random() * 1000 + 1,
            size: Math.random() * 0.9 + 0.4
          });
        }

        let startTime = performance.now();
        let animId = null;

        function frame(now) {
          const elapsed = now - startTime;
          const progress = Math.min(1.0, elapsed / duration);
          const decel = Math.pow(1.0 - progress, 2.8);
          const speed = 1.5 + decel * 58;

          ctx.clearRect(0, 0, w, h);

          for (let i = 0; i < numStars; i++) {
            const s = stars[i];
            const prevZ = s.z;
            s.z -= speed;

            if (s.z <= 1) {
              s.z = 1000;
              s.x = (Math.random() - 0.5) * w * 2.5;
              s.y = (Math.random() - 0.5) * h * 2.5;
              continue;
            }

            const k = 460 / s.z;
            const px = cx + s.x * k;
            const py = cy + s.y * k;
            const prevK = 460 / prevZ;
            const prevPx = cx + s.x * prevK;
            const prevPy = cy + s.y * prevK;

            if (px >= 0 && px <= w && py >= 0 && py <= h) {
              const starFade = progress > 0.45 ? Math.max(0, 1.0 - (progress - 0.45) / 0.45) : 1.0;
              const alpha = Math.min(0.4, (1000 - s.z) / 1000 * 0.48) * starFade;
              ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
              ctx.lineWidth = Math.min(1.2, s.size * (0.6 + speed / 80));
              ctx.beginPath();
              ctx.moveTo(prevPx, prevPy);
              ctx.lineTo(px, py);
              ctx.stroke();
            }
          }

          if (progress < 1.0) {
            animId = requestAnimationFrame(frame);
          } else {
            ctx.clearRect(0, 0, w, h);
          }
        }

        animId = requestAnimationFrame(frame);
        return function stopWarp() {
          if (animId) cancelAnimationFrame(animId);
          if (ctx) ctx.clearRect(0, 0, w, h);
        };
      }

      // Wave First, Followed 0.6s Later by Seamless Overlapping Tunnel Zoom
      function runStaggeredRippleAndZoom(onTunnelCleared, onStartWarp) {
        const svgEl = document.getElementById("nova-boot-svg");
        const portalO = document.getElementById("nova-portal-o");

        const pathIds = [
          "nova-base-n",
          "nova-svg-o-top",
          "nova-svg-o-bot",
          "nova-base-v",
          "nova-base-a"
        ];
        const sampledPaths = [];

        pathIds.forEach(id => {
          const el = document.getElementById(id);
          if (!el || typeof el.getTotalLength !== "function") return;
          const totalLen = el.getTotalLength();
          const numPts = Math.max(64, Math.ceil(totalLen / 1.5));
          const pts = [];
          for (let i = 0; i <= numPts; i++) {
            const pt = el.getPointAtLength((i / numPts) * totalLen);
            pts.push({ x: pt.x, y: pt.y });
          }
          sampledPaths.push({ el, pts });
        });

        const dotEl = document.getElementById("nova-base-a-dot");
        const dotOrig = { cx: 657.5, cy: 71.5, r: 11.5 };

        const originX = 278.0;
        const originY = 72.5;

        const waveDuration = 2200;  // Deliberate gravitational wave lifecycle
        const zoomDelayMs = 600;    // Zoom begins 0.6s in, while letters are mid-wobble
        const zoomDuration = 2400;  // Long, silky-smooth continuous glide
        let warpStarted = false;
        let tunnelCleared = false;
        const startTime = performance.now();

        const warpCanvasEl = document.getElementById("nova-warp-canvas");
        const warpCtx = warpCanvasEl ? warpCanvasEl.getContext("2d") : null;
        const portalEl = document.getElementById("nova-portal-o");
        const portalRect = portalEl ? portalEl.getBoundingClientRect() : null;
        const waveScreenCx = portalRect && portalRect.width > 0
          ? portalRect.left + portalRect.width * 0.5
          : window.innerWidth * 0.44;
        const waveScreenCy = portalRect && portalRect.height > 0
          ? portalRect.top + portalRect.height * 0.5
          : window.innerHeight * 0.5;

        function displaceVertex(px, py, tWave) {
          const dx = px - originX;
          const dy = py - originY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const nx = dist > 0.0001 ? dx / dist : 0;
          const ny = dist > 0.0001 ? dy / dist : 0;

          const waveSpeed = 425.0;
          const waveFront = tWave * 1.5 * waveSpeed;
          const distFromFront = dist - waveFront;

          const packetWidth = 125.0;
          const env = Math.exp(-(distFromFront * distFromFront) / (2.0 * packetWidth * packetWidth));
          const timeEnvelope = Math.sin(Math.min(1.0, tWave) * Math.PI);
          const activeEnv = env * timeEnvelope;

          // Balanced gravitational crest & trough across N-O-V-A letters
          const radialWave = Math.sin((distFromFront / packetWidth) * Math.PI * 2.2);
          const radialOffset = radialWave * 32.0 * activeEnv;
          const verticalOffset = Math.cos((dist * 0.024) - (tWave * 7.4)) * 26.0 * activeEnv;

          return {
            x: px + nx * radialOffset,
            y: py + ny * (radialOffset * 0.55) + verticalOffset,
            scale: 1.0 + radialWave * 0.36 * activeEnv
          };
        }

        function stepFrame(now) {
          const elapsed = now - startTime;
          const tWave = Math.min(1.0, elapsed / waveDuration);

          // 1. Update wave wobble deformation
          if (elapsed <= waveDuration + 100) {
            sampledPaths.forEach(item => {
              const pts = item.pts;
              let dStr = "";
              for (let i = 0; i < pts.length; i++) {
                const p = displaceVertex(pts[i].x, pts[i].y, tWave);
                dStr += (i === 0 ? "M " : " L ") + p.x.toFixed(2) + " " + p.y.toFixed(2);
              }
              item.el.setAttribute("d", dStr);
            });

            if (dotEl) {
              const dp = displaceVertex(dotOrig.cx, dotOrig.cy, tWave);
              dotEl.setAttribute("cx", dp.x.toFixed(2));
              dotEl.setAttribute("cy", dp.y.toFixed(2));
              dotEl.setAttribute("r", Math.max(4.0, dotOrig.r * dp.scale).toFixed(2));
            }
          }

          // 2. Start exponential tunnel zoom 0.6 seconds in (mid-wobble), running concurrently with the wave
          if (elapsed >= zoomDelayMs) {
            document.documentElement.classList.add("is-wormhole-zooming");
            const zoomElapsed = elapsed - zoomDelayMs;
            const pZoom = Math.min(1.0, zoomElapsed / zoomDuration);
            // Ultra-smooth cubic acceleration curve into the aperture
            const expCurve = Math.pow(pZoom, 2.6);
            const scale = 1.0 + expCurve * 135.0;
            const opacity = pZoom < 0.78 ? 1.0 : Math.max(0.0, 1.0 - (pZoom - 0.78) / 0.22);

            if (svgEl) {
              svgEl.style.transform = `scale(${scale.toFixed(3)})`;
              svgEl.style.opacity = opacity.toFixed(3);
            }

            const viewCenterX = window.innerWidth / 2;
            const viewCenterY = window.innerHeight / 2;
            // Start starfield warp right as zoom accelerates, seamlessly handing off from the idle particle canvas
            if (!warpStarted && pZoom >= 0.08) {
              warpStarted = true;
              if (typeof stopIdleBootField === "function") {
                stopIdleBootField();
                stopIdleBootField = null;
              }
              onStartWarp(viewCenterX, viewCenterY, 6200);
            }

            if (!tunnelCleared && pZoom >= 0.90) {
              tunnelCleared = true;
              onTunnelCleared();
            }
          }

          if (elapsed < zoomDelayMs + zoomDuration) {
            requestAnimationFrame(stepFrame);
          }
        }

        if (typeof window.triggerPortalIdleShockwave === "function") {
          window.triggerPortalIdleShockwave(waveScreenCx, waveScreenCy);
        }
        requestAnimationFrame(stepFrame);
      }

      let isWormholeRunning = false;
      function onPortalTriggerClick(e) {
        if (isWormholeRunning) return;
        isWormholeRunning = true;
        if (e && e.stopPropagation) e.stopPropagation();

        // Ensure 3D scene & any remaining chunked builders are ready
        if (typeof window._ensureNova3DInit === "function") window._ensureNova3DInit();
        if (typeof window._flushNova3DBuilders === "function") window._flushNova3DBuilders();
        if (typeof window._flushNovaCatalogNodes === "function") window._flushNovaCatalogNodes();

        // Hide cursor & strip any blue selection state immediately during travel
        document.body.classList.add("nova-traveling");
        document.body.classList.remove("nova-portal-o-active", "nova-cursor-hover");
        document.documentElement.classList.add("is-wormhole-zooming");

        // Stop the idle constellation field cleanly
        if (typeof stopIdleBootField === "function") {
          stopIdleBootField();
          stopIdleBootField = null;
        }

        const overlay = document.getElementById("nova-boot-overlay");
        const portalO = document.getElementById("nova-portal-o");
        const svgEl = document.getElementById("nova-boot-svg");
        const splashContainer = document.getElementById("nova-boot-center-container");
        const warpCanvas = document.getElementById("nova-warp-canvas");

        // Prepare live 3D Solar System destination state
        if (typeof filterTier === "function") filterTier(0);
        const slider = document.getElementById("scale-slider");
        if (slider) slider.value = "3.70";
        if (typeof controls !== "undefined" && controls) {
          controls.target.set(0, 0, 0);
          controls.enabled = false;
        }
        if (typeof lastTrackedTargetPos !== "undefined") {
          lastTrackedTargetPos.set(0, 0, 0);
        }
        if (typeof sunMeshRef !== "undefined" && sunMeshRef) {
          activeTargetMesh = sunMeshRef;
          activeTarget = sunMeshRef.userData;
        }


        // Start along an ecliptic-aligned deep-space approach
        if (typeof camera !== "undefined") {
          camera.position.set(-220, 72, -55);
          camera.fov = 70;
          camera.lookAt(0, 0, 0);
          camera.updateProjectionMatrix();
        }

        // -------------------------------------------------------------------
        // OPTION 3: Ecliptic Wave Horizon
        // -------------------------------------------------------------------
        let stopHorizonWave = null;
        if (warpCanvas && svgEl) {
          const ctx = warpCanvas.getContext("2d");
          const w = (warpCanvas.width = window.innerWidth);
          const h = (warpCanvas.height = window.innerHeight);
          warpCanvas.style.opacity = "1";
          warpCanvas.style.transition = "none";

          const svgRect = svgEl.getBoundingClientRect();
          const scaleX = svgRect.width / 734;
          const scaleY = svgRect.height / 144;
          const portalRect = portalO ? portalO.getBoundingClientRect() : null;
          const cx = portalRect && portalRect.width > 0
            ? portalRect.left + portalRect.width * 0.5
            : svgRect.left + 278 * scaleX;
          const cy = portalRect && portalRect.height > 0
            ? portalRect.top + portalRect.height * 0.5
            : svgRect.top + 72.5 * scaleY;

          // 1. Build 3D-tilted monochrome ecliptic particle plane (GravityWave.mov angle)
          const planeParticles = [];
          const maxR = Math.hypot(w, h) * 0.78;
          const rings = 20;
          for (let rIdx = 1; rIdx <= rings; rIdx++) {
            const normR = rIdx / rings;
            const baseRadius = 34 + Math.pow(normR, 1.15) * maxR;
            const ptsInRing = Math.floor(18 + normR * 52);
            for (let j = 0; j < ptsInRing; j++) {
              const theta = (j / ptsInRing) * Math.PI * 2 + (Math.random() - 0.5) * 0.14;
              const radius = baseRadius + (Math.random() - 0.5) * 18;
              planeParticles.push({
                r: radius,
                theta,
                size: 1.2 + (1 - normR) * 1.3,
                baseAlpha: 0.14 + (1 - normR) * 0.44
              });
            }
          }

          // 2. Sample NOVA SVG strokes so the passing wave scatters them into deep-space stars
          const letterParticles = [];
          const pathIds = ["nova-base-n", "nova-svg-o-top", "nova-svg-o-bot", "nova-base-v", "nova-base-a"];
          pathIds.forEach((id) => {
            const el = document.getElementById(id);
            if (!el || typeof el.getTotalLength !== "function") return;
            const len = el.getTotalLength();
            const count = Math.max(52, Math.floor(len / 2.4));
            for (let k = 0; k <= count; k++) {
              const pt = el.getPointAtLength((k / count) * len);
              const sx = svgRect.left + pt.x * scaleX;
              const sy = svgRect.top + pt.y * scaleY;
              const dx = sx - cx;
              const dy = sy - cy;
              const dist = Math.hypot(dx, dy);
              const ang = Math.atan2(dy, dx);
              letterParticles.push({
                x: sx,
                y: sy,
                ox: sx,
                oy: sy,
                dist,
                ang,
                vx: Math.cos(ang) * (1.2 + Math.random() * 2.4) + (Math.random() - 0.5) * 1.1,
                vy: Math.sin(ang) * (0.7 + Math.random() * 1.5) - (0.5 + Math.random() * 1.4),
                size: 1.15 + Math.random() * 0.85,
                alpha: 0.96,
                released: false,
                releaseTime: 0
              });
            }
          });

          // Sample the dot inside 'A'
          const dotCx = svgRect.left + 657.5 * scaleX;
          const dotCy = svgRect.top + 71.5 * scaleY;
          const dotRad = 11.5 * scaleX;
          for (let k = 0; k < 28; k++) {
            const a = (k / 28) * Math.PI * 2;
            const rr = Math.sqrt(Math.random()) * dotRad;
            const sx = dotCx + Math.cos(a) * rr;
            const sy = dotCy + Math.sin(a) * rr;
            const dx = sx - cx;
            const dy = sy - cy;
            const dist = Math.hypot(dx, dy);
            const ang = Math.atan2(dy, dx);
            letterParticles.push({
              x: sx,
              y: sy,
              ox: sx,
              oy: sy,
              dist,
              ang,
              vx: Math.cos(ang) * (1.5 + Math.random() * 2.2),
              vy: Math.sin(ang) * (0.8 + Math.random() * 1.3) - 0.9,
              size: 1.2 + Math.random() * 0.7,
              alpha: 0.96,
              released: false,
              releaseTime: 0
            });
          }

          // Smoothly crossfade SVG wordmark into canvas particles (zero dotted-line snap)
          svgEl.style.transition = "opacity 0.24s ease-out";
          svgEl.style.opacity = "0";
          setTimeout(() => { svgEl.style.visibility = "hidden"; }, 260);
          if (splashContainer) splashContainer.style.pointerEvents = "none";

          const duration = 4200;
          const startTime = performance.now();
          let rafId = null;

          function renderHorizon(now) {
            const elapsed = now - startTime;
            const p = Math.min(1.0, elapsed / duration);
            const easeOut = 1 - Math.pow(1 - p, 3);

            ctx.clearRect(0, 0, w, h);

            // Single dramatic spiral wave crest expanding from O across the tilted ecliptic plane
            const waveFront = p * maxR * 1.38;
            const bandWidth = 105;
            const planeIn = Math.min(1.0, p / 0.16);
            const planeOut = p > 0.56 ? Math.max(0, 1.0 - (p - 0.56) / 0.44) : 1.0;

            // Slight tilt toward the 3D Solar System's ecliptic plane
            const tiltY = 0.34 + 0.08 * easeOut;
            const planeRot = -0.14 + 0.14 * easeOut;
            const cosR = Math.cos(planeRot);
            const sinR = Math.sin(planeRot);

            for (let k = 0; k < planeParticles.length; k++) {
              const pt = planeParticles[k];
              const spiralOffset = Math.sin(pt.theta * 2.0 - p * 4.5) * 32;
              const distFromFront = pt.r - (waveFront + spiralOffset);
              const crest = Math.exp(-(distFromFront * distFromFront) / (bandWidth * bandWidth));

              // Local 3D-tilted plane coords with vertical wave lift
              const lx = Math.cos(pt.theta + p * 0.28) * pt.r;
              const ly = Math.sin(pt.theta + p * 0.28) * pt.r * tiltY - crest * 34;

              // Subtle horizon roll alignment
              const px = cx + lx * cosR - ly * sinR;
              const py = cy + lx * sinR + ly * cosR;

              const alpha = (pt.baseAlpha * 0.55 + crest * 0.72) * planeIn * planeOut;
              if (alpha <= 0.012 || px < -10 || px > w + 10 || py < -10 || py > h + 10) continue;

              const sz = pt.size + crest * 1.6;
              ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.95, alpha).toFixed(2)})`;
              ctx.fillRect(px - sz * 0.5, py - sz * 0.5, sz, sz);
            }

            // Capture letter particles into the same 3D-tilted spiral orbital wave (zero NOVA ghost trail)
            for (let k = 0; k < letterParticles.length; k++) {
              const lp = letterParticles[k];
              if (!lp.released && waveFront >= lp.dist * 0.78) {
                lp.released = true;
                lp.releaseTime = elapsed;
                lp.curR = lp.dist;
                lp.curAng = lp.ang;
                lp.spinSpeed = 0.018 + Math.random() * 0.022;
                lp.radialDrift = 0.9 + Math.random() * 1.8;
              }

              let drawX = lp.x;
              let drawY = lp.y;
              if (lp.released) {
                const dt = Math.min(1.0, (elapsed - lp.releaseTime) / 1900);
                const easeIn = dt * dt;

                // Swirl into the tilted ecliptic plane & expand with the wave crest
                lp.curAng += lp.spinSpeed * (1.0 + dt * 1.8);
                lp.curR += lp.radialDrift * (1.0 + easeIn * 2.6);

                const spiralLift = Math.sin(lp.curAng * 2.0 - p * 5.0) * 24 * dt;
                const lx = Math.cos(lp.curAng) * lp.curR;
                const ly = Math.sin(lp.curAng) * lp.curR * tiltY - spiralLift;
                const targetX = cx + lx * cosR - ly * sinR;
                const targetY = cy + lx * sinR + ly * cosR;

                // Smoothly blend from the original letter position into the swirling wave
                const blend = Math.min(1.0, dt * 3.2);
                drawX = lp.ox + (targetX - lp.ox) * blend;
                drawY = lp.oy + (targetY - lp.oy) * blend;
                lp.alpha = Math.max(0, 0.96 * (1.0 - Math.pow(dt, 1.6)));
              }

              if (lp.alpha <= 0.01) continue;
              const lsz = lp.size * (lp.released ? 1.45 : 1.35);
              ctx.fillStyle = `rgba(255, 255, 255, ${lp.alpha.toFixed(2)})`;
              ctx.fillRect(drawX - lsz * 0.5, drawY - lsz * 0.5, lsz, lsz);
            }

            if (p < 1.0) {
              rafId = requestAnimationFrame(renderHorizon);
            } else {
              ctx.clearRect(0, 0, w, h);
            }
          }

          rafId = requestAnimationFrame(renderHorizon);
          stopHorizonWave = () => {
            if (rafId) cancelAnimationFrame(rafId);
            ctx.clearRect(0, 0, w, h);
          };
        }

        // Let the spiral gravity wave crest cleanly before opening onto the 3D ecliptic
        setTimeout(() => {
          if (overlay) {
            overlay.style.transition = "background-color 1.6s cubic-bezier(0.25, 1, 0.5, 1)";
            overlay.style.backgroundColor = "rgba(0, 0, 0, 0)";
          }
        }, 1450);

        // Curved 3D orbital dolly sweep into the Sun
        isFlyingToTarget = true;
        setTimeout(() => {
          if (typeof camera !== "undefined" && typeof TWEEN !== "undefined") {
            TWEEN.removeAll();
            const travelDuration = 3800;
            const state = { t: 0 };

            // Polar orbital sweep: 110-deg arc around the ecliptic, dipping low for parallax
            const startAngle = -1.82; // radians (~-104 deg off +Z)
            const endAngle = 0.0;     // finishes directly on +Z (x=0, z=13)
            const startRadius = 227.0;
            const endRadius = 13.0;

            new TWEEN.Tween(state)
              .to({ t: 1 }, travelDuration)
              .easing(TWEEN.Easing.Cubic.InOut)
              .onUpdate(() => {
                const t = state.t;
                // Exponential radius decay keeps apparent speed exciting all the way in
                const radius = startRadius * Math.pow(endRadius / startRadius, t);
                const angle = startAngle + (endAngle - startAngle) * t;

                // Dip low across the ecliptic mid-flight, then rise slightly into the Sun
                const baseY = 72 * Math.pow(1 - t, 2.2) + 9.0 * (1 - Math.pow(1 - t, 2.2));
                const eclipticDip = -Math.sin(t * Math.PI) * 10.5;
                const y = Math.max(3.8, baseY + eclipticDip);

                const x = Math.sin(angle) * radius;
                const z = Math.cos(angle) * radius;

                camera.position.set(x, y, z);
                camera.fov = 70 - 20 * t;
                camera.lookAt(0, 0, 0);
                camera.updateProjectionMatrix();

                if (typeof controls !== "undefined" && controls) {
                  controls.target.set(0, 0, 0);
                }
                if (typeof updateScaleSliderFromCamera === "function") {
                  updateScaleSliderFromCamera();
                }
              })
              .onComplete(() => {
                camera.position.set(0, 9.0, 13.0);
                camera.fov = 50;
                camera.updateProjectionMatrix();
                document.documentElement.classList.remove("is-booting", "is-wormhole-zooming");
                document.body.classList.remove("nova-traveling");

                if (typeof controls !== "undefined" && controls) {
                  controls.target.set(0, 0, 0);
                  controls.enabled = true;
                  controls.enableRotate = true;
                  controls.enableZoom = true;
                  controls.enablePan = true;
                  controls.update();
                }
                if (typeof updateScaleSliderFromCamera === "function") {
                  updateScaleSliderFromCamera();
                }
                if (stopHorizonWave) stopHorizonWave();
                isFlyingToTarget = false;
                isWormholeRunning = false;
                try {
                  localStorage.setItem("hasBootedSession", "true");
                } catch (err) {}

                if (overlay) {
                  overlay.style.display = "none";
                  overlay.style.pointerEvents = "none";
                  overlay.classList.add("boot-completed");
                }
                if (splashContainer) {
                  splashContainer.style.display = "none";
                  splashContainer.style.pointerEvents = "none";
                  splashContainer.classList.add("boot-completed");
                }
                if (warpCanvas) {
                  warpCanvas.style.display = "none";
                  warpCanvas.style.pointerEvents = "none";
                }
              })
              .start();

            // Reveal entire HUD cleanly together during the final deceleration beat
            setTimeout(() => {
              document.documentElement.classList.remove("is-booting", "is-wormhole-zooming");
            }, travelDuration - 700);
          } else {
            document.documentElement.classList.remove("is-booting", "is-wormhole-zooming");
            document.body.classList.remove("nova-traveling");
            if (stopHorizonWave) stopHorizonWave();
            if (overlay) {
              overlay.style.display = "none";
              overlay.classList.add("boot-completed");
            }
            isFlyingToTarget = false;
            isWormholeRunning = false;
          }
        }, 1350);
      }
    })();

(function() {
    console.log('NOVA CUSTOM CURSOR LOADED v3');
    const dot = document.getElementById('nova-cursor-dot');
    const halo = document.getElementById('nova-cursor-halo');
    const canvas = document.getElementById('nova-trail-canvas');
    const ctx = canvas.getContext('2d');

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    // Initialize cursor dead-center inside #nova-portal-o on the boot screen
    function getPortalOCenterAndRadius() {
      const portalEl = document.getElementById('nova-portal-o') || document.getElementById('nova-portal-glow');
      const bootOverlay = document.getElementById('nova-boot-overlay');
      const isBootVisible = bootOverlay && !bootOverlay.classList.contains('boot-completed') && bootOverlay.style.display !== 'none';
      if (portalEl && isBootVisible) {
        const rect = portalEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            r: Math.max(rect.width, rect.height) / 2,
            active: true
          };
        }
      }
      return { x: width / 2, y: height / 2, r: 0, active: false };
    }

    let mouse = { x: -100, y: -100 };
    let haloPos = { x: -100, y: -100 };
    let hasUserMovedPointer = false;

    if (dot) { dot.style.opacity = '0'; }
    if (halo) { halo.style.opacity = '0'; }

    // Check on every pointer move whether the cursor is anywhere inside or on the letter O circle
    window.addEventListener('mousemove', (e) => {
      if (!hasUserMovedPointer) {
        hasUserMovedPointer = true;
        mouse.x = haloPos.x = e.clientX;
        mouse.y = haloPos.y = e.clientY;
        if (dot) { dot.style.opacity = '1'; }
        if (halo) { halo.style.opacity = '1'; }
      }
      const p = getPortalOCenterAndRadius();
      if (p.active) {
        const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
        const portalEl = document.getElementById('nova-portal-o');
        // Full outer radius of the O ring + stroke padding
        if (dist <= p.r + 6) {
          document.body.classList.add('nova-portal-o-active');
      document.body.classList.remove('nova-cursor-hover');
          if (portalEl) {
            portalEl.querySelectorAll('.nova-portal-arc').forEach(arc => {
              arc.style.stroke = '#ffffff';
              arc.style.filter = 'drop-shadow(0 0 12px rgba(255, 255, 255, 0.85)) drop-shadow(0 0 22px rgba(255, 255, 255, 0.35))';
            });
          }
        } else {
          document.body.classList.remove('nova-portal-o-active');
          if (portalEl) {
            portalEl.querySelectorAll('.nova-portal-arc').forEach(arc => {
              arc.style.stroke = '';
              arc.style.filter = '';
            });
          }
        }
      } else {
        document.body.classList.remove('nova-portal-o-active');
      }
    });
    const particles = [];
    let isPointerMoving = false;
    let pointerStopTimer = null;

    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      dot.style.left = `${mouse.x}px`;
      dot.style.top = `${mouse.y}px`;
      if (document.documentElement.classList.contains('is-booting')) {
        haloPos.x = mouse.x;
        haloPos.y = mouse.y;
        if (halo) {
          halo.style.left = `${haloPos.x}px`;
          halo.style.top = `${haloPos.y}px`;
        }
      }

      isPointerMoving = true;
      if (pointerStopTimer) clearTimeout(pointerStopTimer);
      pointerStopTimer = setTimeout(() => {
        isPointerMoving = false;
      }, 65);

      if (Math.random() > 0.25) {
        particles.push({
          x: mouse.x + (Math.random() - 0.5) * 4,
          y: mouse.y + (Math.random() - 0.5) * 4,
          size: Math.random() * 1.6 + 0.4,
          alpha: 0.55,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25
        });
      }
    });

    const interactiveSelectors = '#nova-portal-o, #nova-portal-glow, .celestial-label, a, button, [role="button"], input, select, .interactive';
    document.addEventListener('mouseover', (e) => {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('title')) {
        e.target.removeAttribute('title');
      }
      if (e.target.closest && e.target.closest(interactiveSelectors)) {
        document.body.classList.add('nova-cursor-hover');
      }
      if (e.target && e.target.classList && (e.target.classList.contains('label') || e.target.classList.contains('planet-label') || e.target.tagName === 'SPAN')) {
        document.body.classList.add('nova-cursor-hover');
      }
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest && e.target.closest(interactiveSelectors)) {
        document.body.classList.remove('nova-cursor-hover');
      }
      if (e.target && e.target.classList && (e.target.classList.contains('label') || e.target.classList.contains('planet-label') || e.target.tagName === 'SPAN')) {
        document.body.classList.remove('nova-cursor-hover');
      }
    });

    document.querySelectorAll('[title]').forEach(el => el.removeAttribute('title'));

    function animateCursor() {
      ctx.clearRect(0, 0, width, height);

      // Check if an interactive element or 3D celestial object is currently highlighted
      const isHighlighted =
        document.body.classList.contains('nova-cursor-hover') ||
        document.body.classList.contains('nova-portal-o-active') ||
        document.body.classList.contains('nova-orb-locked');

      // Lock 1:1 on boot screen; crisp, responsive trail in map explorer
      const isBooting = document.documentElement.classList.contains('is-booting');
      const haloLerp = isBooting ? 1.0 : (isHighlighted ? 0.32 : (!isPointerMoving ? 0.24 : 0.18));
      haloPos.x += (mouse.x - haloPos.x) * haloLerp;
      haloPos.y += (mouse.y - haloPos.y) * haloLerp;

      if (Math.hypot(mouse.x - haloPos.x, mouse.y - haloPos.y) < 0.75) {
        haloPos.x = mouse.x;
        haloPos.y = mouse.y;
      }

      halo.style.left = `${haloPos.x}px`;
      halo.style.top = `${haloPos.y}px`;

      const dx = mouse.x - haloPos.x;
      const dy = mouse.y - haloPos.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 2.5) {
        ctx.beginPath();
        ctx.moveTo(mouse.x, mouse.y);
        ctx.lineTo(haloPos.x, haloPos.y);
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(dist / 70, 0.42)})`;
        ctx.lineWidth = 0.85;
        ctx.stroke();
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.018;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 240, 255, ${p.alpha})`;
        ctx.fill();
      }

      requestAnimationFrame(animateCursor);
    }

    animateCursor();
  })();
