// NOVA Guided Cosmic Tour Engine & Autonomous Observatory Standby System
import * as THREE from 'three';
import { TIER_INTROS } from './data/archive.js';

export function initCosmicTour(ctx) {
  const { animate, applyZenUI, camera, celestialObjects, controls, fetchCatalog, isGuidedTourCurrentlyActive, updateSidebarToggleStyle } = ctx;

    // === STREAMLINED SIDEBAR-INTEGRATED GUIDED COSMIC TOUR ENGINE ===
    let isTourPaused = false;
    let tourPlaylist = [];
    let tourIndex = 0;
    let tourTimer = null;
    let tourProgressInterval = null;
    let tourStepStartTime = 0;
    let tourStepDuration = 16000;

    const TIER_LABELS = {
      1: "",
      2: "",
      3: "",
      4: ""
    };

    // Explicit Solar System heliocentric order so Earth -> Moon -> Mars -> Ceres -> Jupiter is always natural
    const TIER_1_ORDER = [
      "sun", "mercury", "venus", "earth", "moon", "mars",
      "ceres", "jupiter", "saturn", "uranus", "neptune",
      "halley-comet", "oumuamua", "sedna"
    ];

    function buildCosmicTourPlaylist() {
      const list = [];
      for (let t = 1; t <= 4; t++) {
        const intro = TIER_INTROS[t];
        const tierMeshes = celestialObjects.filter(m => m && m.userData && Number(m.userData.tier) === t);

        tierMeshes.sort((a, b) => {
          if (t === 1) {
            const idxA = TIER_1_ORDER.indexOf(a.userData.id);
            const idxB = TIER_1_ORDER.indexOf(b.userData.id);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          }
          const posA = new THREE.Vector3();
          const posB = new THREE.Vector3();
          a.getWorldPosition(posA);
          b.getWorldPosition(posB);
          return posA.length() - posB.length();
        });

        list.push({
          kind: "tier-intro",
          tier: t,
          badge: "",
          data: intro,
          camPos: intro.camPos,
          targetPos: intro.targetPos,
          dwellMs: Math.max(intro.dwellMs || 0, 22000) // Ensures intros get at least 22 seconds
        });

        tierMeshes.forEach((mesh, idx) => {
          const d = mesh.userData;
          list.push({
            kind: "object",
            tier: t,
            mesh: mesh,
            data: d,
            badge: TIER_LABELS[t],
            dwellMs: 19000
          });
        });
      }
      return list;
    }

    function updateTourButtonStyle(active) {
      const btn = document.getElementById("btn-cosmic-tour");
      const ring = document.getElementById("tour-ring-outer");
      const svg = document.getElementById("tour-compass-svg");
      if (!btn || !ring || !svg) return;

      if (active) {
        btn.className = "relative w-8 h-8 rounded-full bg-cyan-900/70 border border-cyan-300 flex items-center justify-center cursor-pointer transition duration-300 hover:scale-110 shadow-[0_0_14px_rgba(34,211,238,0.75)] shrink-0";
        ring.className = "absolute inset-0 rounded-full border border-dashed border-cyan-300 animate-mycelial";
        svg.setAttribute("class", "w-4 h-4 text-white animate-pulse");
      } else {
        btn.className = "relative w-8 h-8 rounded-full bg-cyan-950/50 border border-cyan-500/40 flex items-center justify-center cursor-pointer transition duration-300 hover:scale-110 shadow-[0_0_10px_rgba(6,182,212,0.3)] shrink-0";
        ring.className = "absolute inset-0 rounded-full border border-dashed border-cyan-400/40 transition-all duration-300";
        svg.setAttribute("class", "w-4 h-4 text-cyan-400 transition-transform duration-500");
      }
    }

    function updatePauseButtonIcon(paused) {
      const btn = document.getElementById("btn-tour-pause");
      const icon = document.getElementById("icon-tour-pause");
      if (!btn || !icon) return;
      if (paused) {
        btn.className = "relative w-6 h-6 rounded-full bg-amber-950/60 border border-amber-400/60 hover:border-amber-300 flex items-center justify-center text-amber-300 transition transform hover:scale-110 shadow-[0_0_8px_rgba(251,191,36,0.35)] cursor-pointer";
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M8 5v14l11-7z" />';
      } else {
        btn.className = "relative w-6 h-6 rounded-full bg-cyan-950/50 border border-cyan-500/50 hover:border-cyan-300 flex items-center justify-center text-cyan-300 transition transform hover:scale-110 shadow-[0_0_8px_rgba(6,182,212,0.3)] cursor-pointer";
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M10 9v6m4-6v6" />';
      }
    }

    function clearTourTimers() {
      if (tourTimer) {
        clearTimeout(tourTimer);
        tourTimer = null;
      }
      if (tourProgressInterval) {
        clearInterval(tourProgressInterval);
        tourProgressInterval = null;
      }
    }

    function scheduleNextTourStep(dwellMs) {
      clearTourTimers();
      tourStepDuration = dwellMs;
      tourStepStartTime = performance.now();
      const bar = document.getElementById("tour-progress-bar");
      if (bar) bar.style.width = "0%";

      tourProgressInterval = setInterval(() => {
        if (!ctx.isTourActive || isTourPaused) return;
        const elapsed = performance.now() - tourStepStartTime;
        const pct = Math.min(100, (elapsed / tourStepDuration) * 100);
        if (bar) bar.style.width = `${pct}%`;
      }, 80);

      tourTimer = setTimeout(() => {
        if (!ctx.isTourActive || isTourPaused) return;
        if (typeof window.nextTourStep === "function") {
          window.nextTourStep();
        } else {
          tourIndex++;
          if (tourIndex >= tourPlaylist.length) {
            window.stopCosmicTour();
            resetToSolCore();
          } else if (typeof window.executeTourStep === "function") {
            window.executeTourStep();
          }
        }
      }, dwellMs);
    }

    let isTourVoiceMuted = false;
    let currentTourAudio = null;
    const preloadedAudioUrls = new Map();

    function cleanNarrationText(rawText) {
      if (!rawText) return "";
      return rawText
        .replace(/\^\d+/g, "")
        .replace(/\*/g, "")
        .replace(/’/g, "'")
        .trim();
    }

    function formatSpokenTitle(rawTitle) {
      if (!rawTitle) return "";
      // Convert "Name (Alternate)" -> "Name, also known as Alternate"
      return rawTitle.replace(/\s*\(([^)]+)\)/g, ", also known as $1");
    }

    function getStepNarrationText(step) {
      if (!step || !step.data) return "";
      const rawPrefix = step.kind === "tier-intro" ? step.data.title : step.data.name;
      const spokenPrefix = step.kind === "tier-intro" ? rawPrefix : formatSpokenTitle(rawPrefix);
      // Clean, dynamic narration without repetitive distance boilerplate
      return cleanNarrationText(`${spokenPrefix}. ${step.data.summary || ""}`);
    }

    function preloadTourStepAudio(stepIndex) {
      if (!tourPlaylist || tourPlaylist.length === 0) return;
      const idx = (stepIndex + tourPlaylist.length) % tourPlaylist.length;
      const step = tourPlaylist[idx];
      const filename = step.kind === "tier-intro" ? `tier-${step.tier}` : (step.data.id || "").toLowerCase();
      if (!filename || preloadedAudioUrls.has(filename)) return;

      const url = `./audio/tour/${filename}.mp3`;
      preloadedAudioUrls.set(filename, url);
      fetch(url).catch(() => {});
    }

    // --- PACING CONFIGURATION ---
    const TOUR_ARRIVAL_DELAY_MS = 1800; // Wait 1.8s for camera fly-in before Sonia speaks
    const TOUR_POST_DWELL_MS    = 6000; // Wait 6.0s after Sonia finishes so user can inspect
    const TOUR_INTERACT_HOLD_MS = 10000; // Reset timer to 10s whenever user clicks inside the HUD card
    let tourArrivalDelayTimer = null;

    function stopTourAudio() {
      if (tourArrivalDelayTimer) {
        clearTimeout(tourArrivalDelayTimer);
        tourArrivalDelayTimer = null;
      }
      if (window._tourAutoAdvance) {
        clearTimeout(window._tourAutoAdvance);
        window._tourAutoAdvance = null;
      }
      if (currentTourAudio) {
        currentTourAudio.onended = null;
        currentTourAudio.onerror = null;
        currentTourAudio.pause();
        currentTourAudio.currentTime = 0;
        currentTourAudio = null;
      }
    }

    function speakTourNarration(stepData, fallbackDwellMs = 19000) {
      stopTourAudio();
      clearTourTimers();

      // Preload next 3 stops in the background so audio is ready immediately
      if (ctx.isTourActive && tourPlaylist.length > 0) {
        preloadTourStepAudio(tourIndex + 1);
        preloadTourStepAudio(tourIndex + 2);
        preloadTourStepAudio(tourIndex + 3);
      }

      if (isTourVoiceMuted || !stepData) {
        if (ctx.isTourActive && !isTourPaused) {
          scheduleNextTourStep(fallbackDwellMs);
        }
        return;
      }

      const filename = stepData.kind === "tier-intro" ? `tier-${stepData.tier}` : (stepData.data.id || "").toLowerCase();
      const url = `./audio/tour/${filename}.mp3`;

      const audio = new Audio(url);
      audio.preload = "auto";
      currentTourAudio = audio;

      // Advance smoothly 6.0s AFTER narration finishes (giving breathing room to inspect)
      audio.onended = () => {
        if (currentTourAudio === audio && ctx.isTourActive && !isTourPaused) {
          scheduleNextTourStep(TOUR_POST_DWELL_MS);
        }
      };

      // Fallback timer if the MP3 is missing or fails to load
      audio.onerror = () => {
        if (currentTourAudio === audio && ctx.isTourActive && !isTourPaused) {
          scheduleNextTourStep(fallbackDwellMs);
        }
      };

      // Guard: if user clicked Pause while audio was still fetching, pause immediately on play
      audio.onplay = () => {
        if (isTourPaused && currentTourAudio === audio) {
          audio.pause();
        }
      };

      // Arrival-synced narration: wait for camera settle (data-travel="arrived") on object stops, 600ms on tier intros
      const startPlay = () => {
        if (!ctx.isTourActive || isTourPaused || currentTourAudio !== audio) return;
        audio.play().catch(() => {
          if (currentTourAudio === audio && ctx.isTourActive && !isTourPaused) {
            scheduleNextTourStep(fallbackDwellMs);
          }
        });
      };

      if (stepData.kind === "tier-intro") {
        tourArrivalDelayTimer = setTimeout(startPlay, 600);
      } else {
        const waitStartedAt = performance.now();
        const pollArrival = () => {
          if (!ctx.isTourActive || isTourPaused || currentTourAudio !== audio) return;
          const phase = document.documentElement.getAttribute("data-travel");
          const elapsed = performance.now() - waitStartedAt;
          if ((phase === "arrived" && elapsed >= 450) || elapsed >= 4500) {
            tourArrivalDelayTimer = setTimeout(startPlay, 350);
          } else {
            tourArrivalDelayTimer = setTimeout(pollArrival, 120);
          }
        };
        tourArrivalDelayTimer = setTimeout(pollArrival, 450);
      }
    }

    // Extend dwell timer whenever the user interacts with the HUD surface/feature inspector
    document.addEventListener("pointerdown", (e) => {
      if (!ctx.isTourActive || isTourPaused) return;
      if (e.target.closest("#spatial-tour-controls")) return; // Ignore Next/Prev/Pause buttons
      const inHudPanel = e.target.closest("#spatial-callout, #info-panel, .spatial-callout, [id*='callout'], [id*='feature'], [class*='inspect'], button");
      if (inHudPanel && currentTourAudio && currentTourAudio.ended) {
        scheduleNextTourStep(TOUR_INTERACT_HOLD_MS);
      }
    });
    
    // Pre-warm the first 3 tour stops shortly after startup so first run has zero delay
    setTimeout(() => {
      try {
        const warmupList = buildCosmicTourPlaylist();
        [0, 1, 2].forEach(i => {
          if (warmupList[i]) {
            const prefix = warmupList[i].kind === "tier-intro" ? warmupList[i].data.title : warmupList[i].data.name;
            const txt = cleanNarrationText(`${prefix}. ${warmupList[i].data.summary}`);
            if (txt && !preloadedAudioUrls.has(txt)) {
              // const u = `/api/tts?text=${encodeURIComponent(txt)}`;
              // preloadedAudioUrls.set(txt, u);
              // fetch(u).catch(() => {});
            }
          }
        });
      } catch (e) {}
    }, 1500);

    window.toggleTourVoice = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      isTourVoiceMuted = !isTourVoiceMuted;
      const btn = document.getElementById("btn-tour-voice");
      const icon = document.getElementById("icon-tour-voice");
      if (isTourVoiceMuted) {
        stopTourAudio();
        if (btn) btn.className = "relative w-6 h-6 rounded-full bg-slate-900/60 border border-slate-600 hover:border-slate-400 flex items-center justify-center text-slate-400 hover:text-slate-200 transition transform hover:scale-110 cursor-pointer";
        if (icon) icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />';
      } else {
        if (btn) btn.className = "relative w-6 h-6 rounded-full bg-cyan-950/50 border border-cyan-500/50 hover:border-cyan-300 flex items-center justify-center text-cyan-300 transition transform hover:scale-110 shadow-[0_0_8px_rgba(6,182,212,0.3)] cursor-pointer";
        if (icon) icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />';
      }
    };

    function executeTourStep() {
      if (!ctx.isTourActive || tourPlaylist.length === 0) return;
      clearTourTimers();

      const step = tourPlaylist[tourIndex];
      const spatialTourControls = document.getElementById("spatial-tour-controls");
      if (spatialTourControls) spatialTourControls.classList.remove("hidden");

      const badgeEl = document.getElementById("tour-step-badge");
      const counterEl = document.getElementById("tour-step-counter");
      if (badgeEl) badgeEl.textContent = step.badge;
      if (counterEl) counterEl.textContent = `${tourIndex + 1}/${tourPlaylist.length}`;

      if (ctx.manualTierLock !== 0) {
        filterTier(0);
      }

      if (step.tier === 4 && !ctx.isCosmicWebVisible) {
        window.toggleCosmicWeb();
      }

      window._spatialCalloutDismissedForMesh = null;

      if (step.kind === "tier-intro") {
        document.body.classList.add("nova-tier-sweep");
        if (typeof window.dismissSpatialCallout === "function") window.dismissSpatialCallout();
        speakTourNarration(step, step.dwellMs);
        if (typeof window.runCinematicTierSweep === "function") {
          window.runCinematicTierSweep(step.tier || 1, step.dwellMs || 14000);
        }
        // Timer synced with audio completion in speakTourNarration
      } else {
        if (window.novaState) window.novaState.setTravelPhase("traveling");
        document.body.classList.remove("nova-tier-sweep");
      }
    }

    // ==========================================
    // --- MASTER COSMIC TOUR CONTROLLER (FULL FEATURE SET) ---
    // ==========================================
    let isFirstTourRun = true;

    window.toggleCosmicTour = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (typeof ctx.isTourActive !== 'undefined' && ctx.isTourActive) {
        window.stopCosmicTour(e);
      } else {
        window.startCosmicTour();
      }
    };

    window.startCosmicTour = async function() {
      if (typeof celestialObjects !== 'undefined' && celestialObjects.length === 0) {
        await fetchCatalog();
      }
      if (typeof buildCosmicTourPlaylist === 'function') {
        window.tourPlaylist = tourPlaylist = buildCosmicTourPlaylist();
        if (!tourPlaylist || tourPlaylist.length === 0) return;
      }

      ctx.isTourActive = true;
      isTourPaused = false;
      window._preTourLabelsVisible = (typeof ctx.areLabelsVisible !== "undefined") ? Boolean(ctx.areLabelsVisible) : true;
      if (typeof ctx.areLabelsVisible !== "undefined" && ctx.areLabelsVisible) {
        if (typeof window.toggleLabels === "function") window.toggleLabels();
        if (typeof window.syncNovaVVisual === "function") window.syncNovaVVisual(false);
      }
      ctx.isSidebarUserHidden = false;
      ctx.isPlanetOverviewEnabled = true;
      window._spatialCalloutDismissedForMesh = null;
      if (window.novaState) window.novaState.setTravelPhase("traveling");
      const _staleSatLayer = document.getElementById("spatial-satellite-layer");
      const _staleSatSvg = document.getElementById("spatial-satellite-svg");
      if (_staleSatLayer) _staleSatLayer.classList.add("hidden");
      if (_staleSatSvg) _staleSatSvg.innerHTML = "";
      if (typeof updateSidebarToggleStyle === 'function') updateSidebarToggleStyle();
      tourIndex = 0;

      if (typeof applyZenUI === 'function') applyZenUI(true, true);
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }

      const spatialTourControls = document.getElementById("spatial-tour-controls");
      if (spatialTourControls) spatialTourControls.classList.remove("hidden");
      const sidebarTourCtrl = document.getElementById("sidebar-tour-controls");
      if (sidebarTourCtrl) sidebarTourCtrl.classList.remove("hidden");

      if (typeof updatePauseButtonIcon === 'function') updatePauseButtonIcon(false);
      if (typeof updateTourButtonStyle === 'function') updateTourButtonStyle(true);

      if (isFirstTourRun) {
        isFirstTourRun = false;
        if (typeof stopTourAudio === 'function') stopTourAudio();
        if (typeof clearTourTimers === 'function') clearTourTimers();

        const badgeEl = document.getElementById("tour-step-badge");
        const counterEl = document.getElementById("tour-step-counter");
        if (badgeEl) badgeEl.textContent = "NOVA";
        if (counterEl) counterEl.textContent = "INTRO";

        if (typeof TWEEN !== 'undefined' && typeof camera !== 'undefined' && typeof controls !== 'undefined') {
          TWEEN.removeAll();
          ctx.isFlyingToTarget = true;
          controls.enabled = false; 

          const sweepStart = new THREE.Vector3(0, 1000, 1500);
          const sweepEnd = new THREE.Vector3(400, 600, 800); 
          
          camera.position.copy(sweepStart);
          const targetStart = new THREE.Vector3(0, 0, 0);
          controls.target.copy(targetStart);

          const tweenObj = { t: 0 };
          new TWEEN.Tween(tweenObj)
            .to({ t: 1 }, 21000)
            .easing(TWEEN.Easing.Sinusoidal.InOut)
            .onUpdate(() => {
              camera.position.lerpVectors(sweepStart, sweepEnd, tweenObj.t);
              camera.lookAt(targetStart);
            })
            .onComplete(() => {
              ctx.isFlyingToTarget = false;
              controls.enabled = true;
              if (typeof controls !== 'undefined' && controls) controls.autoRotate = true;
              if (typeof controls !== 'undefined' && controls) controls.autoRotateSpeed = 0.2;
            })
            .start();
        }

        const introAudio = new Audio('/audio/tour/intro.mp3');
        introAudio.preload = "auto";
        currentTourAudio = introAudio;

        introAudio.onended = () => {
          if (ctx.isTourActive && !isTourPaused && typeof window.executeTourStep === 'function') window.executeTourStep();
        };

        introAudio.onerror = (err) => {
          console.error("Failed to load intro audio.", err);
          if (ctx.isTourActive && !isTourPaused && typeof window.executeTourStep === 'function') window.executeTourStep();
        };

        introAudio.play().catch((err) => {
          if (ctx.isTourActive && !isTourPaused && typeof window.executeTourStep === 'function') window.executeTourStep();
        });
      } else {
        if (typeof window.executeTourStep === 'function') window.executeTourStep();
      }
    };

    window.stopCosmicTour = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (typeof stopTourAudio === 'function') stopTourAudio();
      ctx.isTourActive = false;
      isTourPaused = false;
      ctx.isSidebarUserHidden = false;
      if (typeof clearTourTimers === 'function') clearTourTimers();
      if (typeof TWEEN !== 'undefined') TWEEN.removeAll();
      ctx.isFlyingToTarget = false;
      if (typeof controls !== 'undefined' && controls) {
        controls.enabled = true;
        if (typeof controls !== 'undefined' && controls) controls.autoRotate = false;
      }
      if (typeof updateTourButtonStyle === 'function') updateTourButtonStyle(false);

      const spatialTourControls = document.getElementById("spatial-tour-controls");
      if (spatialTourControls) spatialTourControls.classList.add("hidden");
      const sidebarTourCtrl = document.getElementById("sidebar-tour-controls");
      if (sidebarTourCtrl) sidebarTourCtrl.classList.add("hidden");

      if (typeof window._preTourLabelsVisible === "boolean" && typeof ctx.areLabelsVisible !== "undefined") {
        if (ctx.areLabelsVisible !== window._preTourLabelsVisible) {
          if (typeof window.toggleLabels === "function") window.toggleLabels();
          if (typeof window.syncNovaVVisual === "function") window.syncNovaVVisual(ctx.areLabelsVisible);
        }
        window._preTourLabelsVisible = null;
      }
      if (typeof window.dismissSpatialCallout === 'function') window.dismissSpatialCallout();
      if (typeof applyZenUI === 'function') applyZenUI(false);
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      if (typeof updateSidebarToggleStyle === 'function') updateSidebarToggleStyle();
    };

    window.nextTourStep = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (!ctx.isTourActive) return;
      if (typeof stopTourAudio === 'function') stopTourAudio();
      if (typeof clearTourTimers === 'function') clearTourTimers();
      if (typeof tourPlaylist !== 'undefined' && tourPlaylist.length > 0) {
        tourIndex = (tourIndex + 1) % tourPlaylist.length;
      }
      if (typeof window.executeTourStep === 'function') window.executeTourStep();
    };

    window.prevTourStep = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (!ctx.isTourActive) return;
      if (typeof stopTourAudio === 'function') stopTourAudio();
      if (typeof clearTourTimers === 'function') clearTourTimers();
      if (typeof tourPlaylist !== 'undefined' && tourPlaylist.length > 0) {
        tourIndex = (tourIndex - 1 + tourPlaylist.length) % tourPlaylist.length;
      }
      if (typeof window.executeTourStep === 'function') window.executeTourStep();
    };

    window.togglePauseCosmicTour = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (!ctx.isTourActive) return;
      isTourPaused = !isTourPaused;
      if (typeof updatePauseButtonIcon === 'function') updatePauseButtonIcon(isTourPaused);
      
      if (isTourPaused) {
        if (typeof clearTourTimers === 'function') clearTourTimers();
        if (currentTourAudio && !currentTourAudio.paused) currentTourAudio.pause();
      } else {
        if (currentTourAudio && currentTourAudio.paused && currentTourAudio.currentTime < (currentTourAudio.duration || Infinity)) {
          currentTourAudio.play().catch(() => {
            if (typeof scheduleNextTourStep === 'function') scheduleNextTourStep(5000);
          });
        } else {
          if (typeof scheduleNextTourStep === 'function') scheduleNextTourStep(2500);
        }
      }
    };

    // --- SYNCHRONIZED EXECUTE TOUR STEP ---
    window.executeTourStep = function() {
      if (!ctx.isTourActive || isTourPaused) return;
      if (!tourPlaylist || tourPlaylist.length === 0) return;
      if (tourIndex >= tourPlaylist.length) {
        window.stopCosmicTour();
        return;
      }

      const step = tourPlaylist[tourIndex];
      if (typeof updateTourProgressUI === 'function') updateTourProgressUI();
      if (typeof clearTourTimers === 'function') clearTourTimers();

      // --- CRITICAL FIX 1: RESTORE UI PROGRESS TEXT ---
      // This string format ("1/35") is required to pass the isGuidedTourCurrentlyActive() 
      // regex check. Without it, the physical features panel and pointers shut down!
      const spatialTourControls = document.getElementById("spatial-tour-controls");
      if (spatialTourControls) spatialTourControls.classList.remove("hidden");
      
      const badgeEl = document.getElementById("tour-step-badge");
      const counterEl = document.getElementById("tour-step-counter");
      if (badgeEl) badgeEl.textContent = step.badge || "TOUR";
      if (counterEl) counterEl.textContent = (tourIndex + 1) + "/" + tourPlaylist.length;

      const setupAutoAdvance = () => {
        // Handled cleanly by speakTourNarration() -> scheduleNextTourStep(TOUR_POST_DWELL_MS)
      };

      if (step.kind === "tier-intro") {
        ctx.activeTargetMesh = null;
        activeTarget = step.data;
        if (typeof window.populateSpatialCallout === "function") window.populateSpatialCallout(step.data, true);
        if (typeof speakTourNarration === "function") speakTourNarration(step, step.dwellMs);
        setupAutoAdvance();
        
        if (typeof TWEEN !== 'undefined' && typeof camera !== 'undefined' && typeof controls !== 'undefined') {
          TWEEN.removeAll();
          ctx.isFlyingToTarget = true;
          controls.enabled = false; 

          let startCam = camera.position.clone();
          if (tourIndex === 0 && !isFirstTourRun) {
             startCam = new THREE.Vector3(startCam.x, Math.max(startCam.y, 250), Math.max(startCam.z, 500));
          }
          
          const startTarget = controls.target.clone();
          const endTarget = step.targetPos ? new THREE.Vector3(step.targetPos.x, step.targetPos.y, step.targetPos.z) : new THREE.Vector3(0, 0, 0);
          const endCam = step.camPos ? new THREE.Vector3(step.camPos.x, step.camPos.y, step.camPos.z) : new THREE.Vector3(0, 1000, 1500);
          const cinematicDuration = step.dwellMs || 25000;

          const tweenObj = { t: 0 };
          new TWEEN.Tween(tweenObj)
            .to({ t: 1 }, cinematicDuration)
            .easing(TWEEN.Easing.Sinusoidal.Out)
            .onUpdate(() => {
              camera.position.lerpVectors(startCam, endCam, tweenObj.t);
              camera.lookAt(startTarget.clone().lerp(endTarget, tweenObj.t));
            })
            .onComplete(() => {
              ctx.isFlyingToTarget = false;
              controls.target.copy(endTarget); 
              controls.enabled = true; 
              if (typeof controls !== 'undefined' && controls) controls.autoRotate = true;
              if (typeof controls !== 'undefined' && controls) controls.autoRotateSpeed = 0.4;
            })
            .start();
        }

      } else if (step.kind === "object") {
        if (window.novaState) window.novaState.setTravelPhase("traveling");
        activeTarget = step.data;
        const targetMesh = step.mesh || (typeof celestialObjects !== 'undefined' ? celestialObjects.find(o => o.data?.name?.toLowerCase() === step.data?.name?.toLowerCase())?.mesh : null);
        ctx.activeTargetMesh = targetMesh;
        
        if (typeof window.populateSpatialCallout === "function") window.populateSpatialCallout(step.data, false);
        if (typeof speakTourNarration === "function") speakTourNarration(step, step.dwellMs);
        setupAutoAdvance();
        
        // --- CRITICAL FIX 2: USE NATIVE ZOOM FUNCTION ---
        // smoothFlyToTarget natively handles getWorldPosition() and calculates dynamic offsets perfectly!
        if (typeof window.smoothFlyToTarget === "function") {
          window.smoothFlyToTarget(2800);
        }
      }
    };

    // --- BULLETPROOF BUTTON BINDINGS ---
    const bindAllTourButtons = () => {
      const tourButton = document.getElementById("btn-cosmic-tour");
      if (tourButton && !tourButton.dataset.bound) {
        tourButton.dataset.bound = "true";
        tourButton.addEventListener("click", (e) => {
          e.preventDefault();
          window.toggleCosmicTour(e);
        });
      }

      const nxtBtn = document.getElementById("btn-tour-next");
      if (nxtBtn && !nxtBtn.dataset.bound) {
        nxtBtn.dataset.bound = "true";
        nxtBtn.addEventListener("click", (e) => {
          e.preventDefault();
          window.nextTourStep(e);
        });
      }

      const prvBtn = document.getElementById("btn-tour-prev");
      if (prvBtn && !prvBtn.dataset.bound) {
        prvBtn.dataset.bound = "true";
        prvBtn.addEventListener("click", (e) => {
          e.preventDefault();
          window.prevTourStep(e);
        });
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindAllTourButtons);
    } else {
      bindAllTourButtons();
    }
    setTimeout(bindAllTourButtons, 500);
    setTimeout(bindAllTourButtons, 1500);

    // === AUTONOMOUS OBSERVATORY STANDBY / SCREENSAVER SYSTEM ===
    let screensaverIdleTimer = null;
    let screensaverLingerTimer = null;
    let screensaverLastTargetIndex = -1;
    const SCREENSAVER_IDLE_TIMEOUT_MS = 60000; // 60s idle trigger

    function getScreensaverPool() {
      if (!celestialObjects || celestialObjects.length === 0) return [];
      return celestialObjects.filter(obj => {
        if (!obj || !obj.userData || !obj.userData.id) return false;
        const id = String(obj.userData.id).toLowerCase();
        return id !== "moon-orbit" && id !== "barycenter" && !id.includes("barycenter");
      });
    }

    function advanceScreensaverStep() {
      if (!ctx.isScreensaverActive) return;
      if (screensaverLingerTimer) {
        clearTimeout(screensaverLingerTimer);
        screensaverLingerTimer = null;
      }

      const pool = getScreensaverPool();
      if (pool.length === 0) return;

      let nextIdx = Math.floor(Math.random() * pool.length);
      if (pool.length > 1 && nextIdx === screensaverLastTargetIndex) {
        nextIdx = (nextIdx + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
      }
      screensaverLastTargetIndex = nextIdx;
      const targetMesh = pool[nextIdx];
      const targetData = targetMesh.userData;

      // Ensure all tiers visible so deep-space nodes render properly
      const tierNum = Number(targetData.tier) || 1;
      if (ctx.manualTierLock !== 0 && typeof filterTier === "function") {
        filterTier(0);
      }
      if (tierNum === 4 && !ctx.isCosmicWebVisible && typeof window.toggleCosmicWeb === "function") {
        window.toggleCosmicWeb();
      }

      ctx.activeTargetMesh = targetMesh;
      activeTarget = targetData;
      if (typeof window.populateSpatialCallout === "function") {
        window.populateSpatialCallout(targetData, false);
      }

      // Stop auto-rotation during cinematic flight
      if (typeof controls !== 'undefined' && controls) controls.autoRotate = false;

      // Slower, cinematic easing flight (5,200ms)
      const flightDuration = 5200;
      window.smoothFlyToTarget(flightDuration);

      // Linger and orbit slowly around the target for 12 seconds
      screensaverLingerTimer = setTimeout(() => {
        if (!ctx.isScreensaverActive) return;
        if (typeof controls !== 'undefined' && controls) controls.autoRotate = true;
        if (typeof controls !== 'undefined' && controls) controls.autoRotateSpeed = 0.42;

        // Schedule next random destination
        screensaverLingerTimer = setTimeout(() => {
          if (!ctx.isScreensaverActive) return;
          advanceScreensaverStep();
        }, 12000);
      }, flightDuration);
    }

    window.enterScreensaverMode = function() {
      if (ctx.isScreensaverActive) return;
      if (ctx.isTourActive) return;
      if (document.documentElement.classList.contains("is-booting")) return;

      ctx.isScreensaverActive = true;
      document.documentElement.classList.add("screensaver-active");

      // Dismiss active spatial telemetry callout and close drawers
      if (typeof window.dismissSpatialCallout === "function") window.dismissSpatialCallout();
      if (typeof window.closeMapKey === "function") window.closeMapKey();
      const labelsLayer = document.getElementById("celestial-labels-layer");
      if (labelsLayer) labelsLayer.style.display = "none";

      advanceScreensaverStep();
    };

    window.exitScreensaverMode = function() {
      if (!ctx.isScreensaverActive) return;
      ctx.isScreensaverActive = false;

      if (screensaverLingerTimer) {
        clearTimeout(screensaverLingerTimer);
        screensaverLingerTimer = null;
      }

      if (typeof controls !== 'undefined' && controls) controls.autoRotate = false;
      if (activeTarget && typeof window.populateSpatialCallout === "function") {
        window.populateSpatialCallout(activeTarget, false);
      }
      document.documentElement.classList.remove("screensaver-active");
      const labelsLayer = document.getElementById("celestial-labels-layer");
      if (labelsLayer && ctx.areLabelsVisible) labelsLayer.style.display = "block";

      if (typeof window.resetScreensaverTimer === "function") {
        window.resetScreensaverTimer();
      }
    };

    window.toggleScreensaverMode = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (ctx.isScreensaverActive) {
        window.exitScreensaverMode();
      } else {
        window.enterScreensaverMode();
      }
    };

    Object.defineProperty(window, "isScreensaverActive", {
      get() { return ctx.isScreensaverActive; },
      set(val) {
        if (val) window.enterScreensaverMode();
        else window.exitScreensaverMode();
      },
      configurable: true
    });

    window.resetScreensaverTimer = function() {
      if (screensaverIdleTimer) {
        clearTimeout(screensaverIdleTimer);
        screensaverIdleTimer = null;
      }
      if (!ctx.isScreensaverActive) {
        screensaverIdleTimer = setTimeout(() => {
          if (ctx.isTourActive) return;
          if (document.documentElement.classList.contains("is-booting")) return;
          const mk = document.getElementById("map-key-drawer");
          if (mk && !mk.classList.contains("translate-x-[300px]")) return;
          const inqModal = document.getElementById("deep-space-inquiry-modal");
          if (inqModal && !inqModal.classList.contains("hidden")) return;
          if (typeof ctx.isTierMenuOpen !== "undefined" && ctx.isTierMenuOpen) return;

          window.enterScreensaverMode();
        }, SCREENSAVER_IDLE_TIMEOUT_MS);
      }
    };

    // Initialize idle timer
    window.resetScreensaverTimer();
}
