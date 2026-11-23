// NOVA Procedural Web Audio Engine (Zero-Asset Observatory Soundscape)
(function initNovaAudioEngine() {
  if (window.novaAudio) return;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  let ctx = null;
  let masterGain = null;
  let ambientGain = null;
  let sfxGain = null;
  let droneFilter = null;
  let oscA = null;
  let oscB = null;
  let noiseGain = null;
  let pulsarTimer = null;

  let isMuted = false;
  let isUnlocked = false;
  let isDucked = false;
  let currentTier = 1;
  let activeObjectName = "";
  let lastInteractionTime = performance.now();
  let flightStartTime = 0;
  let flightDurationMs = 2200;
  const IDLE_FADE_MS = 25000; // Fade to near-0 after 25s of inactivity

  function getArrivalFactor() {
    if (!flightStartTime) return 1.0;
    const elapsed = performance.now() - flightStartTime;
    if (elapsed >= flightDurationMs) return 1.0;
    const progress = Math.max(0, Math.min(1, elapsed / flightDurationMs));
    if (progress < 0.35) return 0.0;
    const ramp = (progress - 0.35) / 0.65;
    return ramp * ramp; // Smooth quadratic swell as you arrive
  }

  let isCurrentlyQuiet = false;

  function updateMasterEnvelope() {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    if (isMuted) {
      masterGain.gain.setTargetAtTime(0.0, now, 0.08);
      return;
    }
    const isStandby = Boolean(
      window.isScreensaverActive ||
      (document.documentElement && document.documentElement.classList.contains("screensaver-active"))
    );
    const isIdle = (performance.now() - lastInteractionTime) > IDLE_FADE_MS;
    const shouldQuiet = isStandby || isScaleModeActive() || isIdle;
    isCurrentlyQuiet = shouldQuiet;
    masterGain.gain.setTargetAtTime(shouldQuiet ? 0.03 : 0.85, now, shouldQuiet ? 1.2 : 0.35);
  }

  // Restrained levels to prevent ear fatigue or laptop speaker rumble
  const AMBIENT_NORMAL = 0.42;
  const AMBIENT_DUCKED = 0.08;

  const TIER_PROFILES = {
    1: { fA: 55.0,  fB: 110.0, cutoff: 185, noise: 0.011 }, // Solar System (AU)
    2: { fA: 65.41, fB: 98.0,  cutoff: 270, noise: 0.015 }, // Interstellar (ly)
    3: { fA: 49.0,  fB: 73.42, cutoff: 220, noise: 0.020 }, // Galactic (kly/Mly)
    4: { fA: 36.71, fB: 55.0,  cutoff: 155, noise: 0.025 }  // Cosmic Web (Mpc/Gly)
  };

  function buildNoiseBuffer(audioCtx) {
    const len = audioCtx.sampleRate * 3;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0.0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 2.8;
    }
    return buf;
  }

  function ensureContext() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return true;
    }
    try {
      ctx = new AudioCtx();
    } catch (_) {
      return false;
    }

    masterGain = ctx.createGain();
    masterGain.gain.value = isMuted ? 0.0 : 0.85;
    masterGain.connect(ctx.destination);

    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.0;
    ambientGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.78;
    sfxGain.connect(masterGain);

    droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = TIER_PROFILES[1].cutoff;
    droneFilter.Q.value = 0.9;
    droneFilter.connect(ambientGain);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 22.0;
    lfo.connect(lfoGain);
    lfoGain.connect(droneFilter.frequency);
    lfo.start();

    oscA = ctx.createOscillator();
    oscA.type = "sine";
    oscA.frequency.value = TIER_PROFILES[1].fA;
    const gainA = ctx.createGain();
    gainA.gain.value = 0.065;
    oscA.connect(gainA);
    gainA.connect(droneFilter);
    oscA.start();

    oscB = ctx.createOscillator();
    oscB.type = "triangle";
    oscB.frequency.value = TIER_PROFILES[1].fB;
    oscB.detune.value = 4.5;
    const gainB = ctx.createGain();
    gainB.gain.value = 0.022;
    oscB.connect(gainB);
    gainB.connect(droneFilter);
    oscB.start();

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buildNoiseBuffer(ctx);
    noiseSrc.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 160;
    noiseFilter.Q.value = 0.7;
    noiseGain = ctx.createGain();
    noiseGain.gain.value = TIER_PROFILES[1].noise;
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ambientGain);
    noiseSrc.start();

    const now = ctx.currentTime;
    ambientGain.gain.setValueAtTime(0.0001, now);
    ambientGain.gain.exponentialRampToValueAtTime(isDucked ? AMBIENT_DUCKED : AMBIENT_NORMAL, now + 1.8);

    isUnlocked = true;
    return true;
  }

  // Layer 1: Crisp, damped mechanical HUD tick (clears the low-frequency drone)
  function playTick(pitch = 520) {
    if (isMuted || !ensureContext()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(120, pitch * 0.42), now + 0.024);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(now);
    osc.stop(now + 0.032);
  }

  // Layer 1: Crisp optical telescope lock-on ping
  function playSelect() {
    if (isMuted || !ensureContext()) return;
    const now = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 920;
    filter.Q.value = 0.85;
    filter.connect(sfxGain);

    [659.25, 987.77].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      const t0 = now + idx * 0.028;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(idx === 0 ? 0.095 : 0.065, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);
      osc.connect(g);
      g.connect(filter);
      osc.start(t0);
      osc.stop(t0 + 0.21);
    });
  }

  // Layer 1: Distinct Reset sound (clean descending harmonic return)
  let lastResetSoundAt = 0;
  function playReset() {
    if (isMuted || !ensureContext()) return;
    const tNow = performance.now();
    if (tNow - lastResetSoundAt < 150) return;
    lastResetSoundAt = tNow;
    const now = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 840;
    filter.Q.value = 0.85;
    filter.connect(sfxGain);

    [783.99, 523.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      const t0 = now + idx * 0.032;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(idx === 0 ? 0.085 : 0.065, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);
      osc.connect(g);
      g.connect(filter);
      osc.start(t0);
      osc.stop(t0 + 0.21);
    });
  }

  // Layer 1: Distinct Tour Start sound (ascending 3-note observatory sequence)
  function playTourStart() {
    if (isMuted || !ensureContext()) return;
    const now = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 880;
    filter.connect(sfxGain);

    [220.0, 329.63, 440.0].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      const t0 = now + idx * 0.085;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(idx === 2 ? 0.065 : 0.05, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
      osc.connect(g);
      g.connect(filter);
      osc.start(t0);
      osc.stop(t0 + 0.45);
    });
  }

  // Layer 2: Smooth tier crossfade
  function applyTierProfile(tier) {
    if (!ctx || !oscA || !oscB || !droneFilter || !noiseGain) return;
    const p = TIER_PROFILES[tier] || TIER_PROFILES[1];
    const now = ctx.currentTime;
    const isBlackHole = /sagittarius a|ton 618|m87/i.test(activeObjectName);
    const freqScale = isBlackHole ? 0.84 : 1.0;

    oscA.frequency.setTargetAtTime(p.fA * freqScale, now, 1.2);
    oscB.frequency.setTargetAtTime(p.fB * freqScale, now, 1.2);
    droneFilter.frequency.setTargetAtTime(isBlackHole ? p.cutoff * 0.72 : p.cutoff, now, 1.2);
    noiseGain.gain.setTargetAtTime(p.noise, now, 1.2);
  }

  // Layer 3A: Slow, meditative Crab Pulsar radio-telescope beacon (~1.1s cadence)
  let bhNodes = null;

  function updatePulsarSonification() {
    const isPulsar = /crab/i.test(activeObjectName);
    if (isPulsar && !pulsarTimer) {
      pulsarTimer = setInterval(() => {
        if (isMuted || !isUnlocked || !ctx || ctx.state !== "running") return;
        const now = ctx.currentTime;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 460;
        filter.connect(sfxGain);

        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(215, now);
        osc.frequency.exponentialRampToValueAtTime(165, now + 0.14);
        g.gain.setValueAtTime(0.0001, now);
        const arrival = getArrivalFactor();
        if (arrival < 0.02) return;
        g.gain.linearRampToValueAtTime((isDucked ? 0.012 : 0.042) * arrival, now + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

        osc.connect(g);
        g.connect(filter);
        osc.start(now);
        osc.stop(now + 0.26);
      }, 1100);
    } else if (!isPulsar && pulsarTimer) {
      clearInterval(pulsarTimer);
      pulsarTimer = null;
    }
  }

  // Layer 3B: Deep gravitational harmonic swell for Black Holes (Sagittarius A*, TON 618, M87)
  function updateBlackHoleSonification() {
    const isBlackHole = /sagittarius a|ton 618|m87/i.test(activeObjectName);
    if (!ctx || !ambientGain) return;
    const now = ctx.currentTime;

    if (isBlackHole && !bhNodes) {
      const bhGain = ctx.createGain();
      bhGain.gain.setValueAtTime(0.0001, now);
      bhGain.connect(ambientGain);

      const bhFilter = ctx.createBiquadFilter();
      bhFilter.type = "lowpass";
      bhFilter.frequency.value = 140;
      bhFilter.Q.value = 2.2;
      bhFilter.connect(bhGain);

      const subOsc = ctx.createOscillator();
      subOsc.type = "sine";
      subOsc.frequency.value = 38.89; // Deep Eb1 rumble
      subOsc.connect(bhFilter);
      subOsc.start(now);

      const overtoneOsc = ctx.createOscillator();
      overtoneOsc.type = "sine";
      overtoneOsc.frequency.value = 58.27; // Haunting Bb1 fifth
      const ovGain = ctx.createGain();
      ovGain.gain.value = 0.28;
      overtoneOsc.connect(ovGain);
      ovGain.connect(bhFilter);
      overtoneOsc.start(now);

      bhNodes = { bhGain, subOsc, overtoneOsc };
    } else if (isBlackHole && bhNodes) {
      const targetBh = Math.max(0.0001, 0.14 * getArrivalFactor());
      bhNodes.bhGain.gain.setTargetAtTime(targetBh, now, 0.35);
    } else if (!isBlackHole && bhNodes) {
      const { bhGain, subOsc, overtoneOsc } = bhNodes;
      bhNodes = null;
      bhGain.gain.cancelScheduledValues(now);
      bhGain.gain.setValueAtTime(Math.max(0.0001, bhGain.gain.value), now);
      bhGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      setTimeout(() => {
        try { subOsc.stop(); overtoneOsc.stop(); } catch (_) {}
      }, 1500);
    }
  }

  function isScaleModeActive() {
    const txt = document.body ? document.body.innerText : "";
    return txt.includes("TRUE-SCALE COMPARISON");
  }

  function resolveActiveTargetName() {
    if (isScaleModeActive()) return "";
    if (window.activeTarget && window.activeTarget.name) return String(window.activeTarget.name);
    const nameEl = document.getElementById("spatial-target-name");
    if (nameEl && nameEl.textContent && nameEl.textContent.trim()) return nameEl.textContent.trim();
    const activeLabel = document.querySelector(".celestial-label--active");
    if (activeLabel && activeLabel.textContent) return activeLabel.textContent.trim();
    return "";
  }

  function pollTelemetry() {
    let detectedTier = currentTier;
    const bodyText = document.body ? document.body.innerText : "";
    const rngMatch = bodyText.match(/RNG\s+[\d.,]+\s*(km|AU|ly|kly|Mly|Mpc|Gly)/);
    if (rngMatch) {
      const unit = rngMatch[1];
      if (unit === "km" || unit === "AU") detectedTier = 1;
      else if (unit === "ly") detectedTier = 2;
      else if (unit === "kly" || unit === "Mly") detectedTier = 3;
      else detectedTier = 4;
    }

    const newName = resolveActiveTargetName();
    if (detectedTier !== currentTier || newName !== activeObjectName) {
      currentTier = detectedTier;
      activeObjectName = newName;
      applyTierProfile(currentTier);
      updatePulsarSonification();
    }
    updateBlackHoleSonification();
    updateMasterEnvelope();
  }
  setInterval(pollTelemetry, 250);

  // Auto-duck ambient bed whenever Guided Tour narration plays
  function setDucked(duck) {
    isDucked = Boolean(duck);
    if (!ctx || !ambientGain) return;
    ambientGain.gain.setTargetAtTime(isDucked ? AMBIENT_DUCKED : AMBIENT_NORMAL, ctx.currentTime, 0.35);
  }

  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    if (this instanceof HTMLAudioElement) {
      setDucked(true);
      const restore = () => setDucked(false);
      this.addEventListener("pause", restore, { once: true });
      this.addEventListener("ended", restore, { once: true });
    }
    return origPlay.apply(this, args);
  };

  function hookFlyToTarget() {
    if (typeof window.smoothFlyToTarget === "function" && !window.smoothFlyToTarget.__novaAudioHooked) {
      const origFly = window.smoothFlyToTarget;
      window.smoothFlyToTarget = function (...args) {
        flightStartTime = performance.now();
        flightDurationMs = (typeof args[0] === "number" && args[0] > 0) ? args[0] : 2200;
        if (!window.isScreensaverActive) playSelect();
        setTimeout(pollTelemetry, 120);
        return origFly.apply(this, args);
      };
      window.smoothFlyToTarget.__novaAudioHooked = true;
    }
    if (typeof window.resetCameraToHome === "function" && !window.resetCameraToHome.__novaAudioHooked) {
      const origReset = window.resetCameraToHome;
      window.resetCameraToHome = function (...args) {
        playReset();
        return origReset.apply(this, args);
      };
      window.resetCameraToHome.__novaAudioHooked = true;
    }
  }
  const hookPoller = setInterval(() => {
    hookFlyToTarget();
    if (
      window.smoothFlyToTarget && window.smoothFlyToTarget.__novaAudioHooked &&
      window.resetCameraToHome && window.resetCameraToHome.__novaAudioHooked
    ) {
      clearInterval(hookPoller);
    }
  }, 400);

  function markUserActivity() {
    lastInteractionTime = performance.now();
    if (isCurrentlyQuiet && ctx && masterGain && !isMuted) {
      isCurrentlyQuiet = false;
      masterGain.gain.setTargetAtTime(0.85, ctx.currentTime, 0.35);
    }
  }

  ["pointermove", "wheel", "touchstart"].forEach(evt => {
    window.addEventListener(evt, markUserActivity, { capture: true, passive: true });
  });

  // Silent unlock on first gesture + distinct Reset / Tour / HUD ticks
  window.addEventListener("pointerdown", (e) => {
    ensureContext();
    markUserActivity();
    const hit = e.target && e.target.closest
      ? e.target.closest("button, [role='button'], [id^='btn-'], [data-tip], .gimbal-sub, [id*='gimbal']")
      : null;
    if (hit && hit.id !== "btn-nova-audio") {
      const meta = ((hit.id || "") + " " + (hit.getAttribute("data-tip") || "") + " " + (hit.textContent || "")).toLowerCase();

      if (meta.includes("reset") || meta.includes("home [r]")) {
        playReset();
      } else if (meta.includes("tour") && !meta.includes("voice") && !meta.includes("stop") && !meta.includes("exit") && !meta.includes("next") && !meta.includes("prev")) {
        playTourStart();
      } else {
        playTick(hit.id === "btn-cosmic-web" ? 580 : 490);
      }
    }
  }, { capture: true, passive: true });

  window.addEventListener("keydown", (e) => {
    ensureContext();
    markUserActivity();
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    if (tag !== "input" && tag !== "textarea" && (e.key === "r" || e.key === "R")) {
      playReset();
    }
  }, { capture: true, passive: true });

  const ICON_ON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  const ICON_OFF = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;

  function updateAudioButtonUI() {
    const btn = document.getElementById("btn-nova-audio");
    if (!btn) return;
    btn.innerHTML = isMuted ? ICON_OFF : ICON_ON;
    btn.style.color = isMuted ? "#64748b" : "#cbd5e1";
    btn.style.opacity = isMuted ? "0.6" : "0.9";
    btn.setAttribute("aria-label", isMuted ? "Unmute Audio" : "Mute Audio");
  }

  function toggleMute(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    isMuted = !isMuted;
    if (!isMuted) ensureContext();
    if (ctx && masterGain) {
      masterGain.gain.setTargetAtTime(isMuted ? 0.0 : 0.85, ctx.currentTime, 0.08);
    }
    if (!isMuted) playTick(560);
    updateAudioButtonUI();
  }

  // Place minimalist volume icon cleanly in the bottom-right corner
  function injectAudioToggle() {
    const existing = document.getElementById("btn-nova-audio");
    if (existing) existing.remove();

    const btn = document.createElement("button");
    btn.id = "btn-nova-audio";
    btn.title = "Toggle Observatory Audio";
    btn.style.cssText = [
      "position:fixed", "bottom:10px", "right:13px", "z-index:45",
      "width:28px", "height:28px", "display:flex", "align-items:center", "justify-content:center",
      "background:transparent", "border:none", "padding:0", "cursor:pointer",
      "transition:opacity 0.2s ease, transform 0.2s ease"
    ].join(";");
    btn.addEventListener("mouseenter", () => { btn.style.transform = "scale(1.1)"; });
    btn.addEventListener("mouseleave", () => { btn.style.transform = "scale(1.0)"; });
    btn.addEventListener("click", toggleMute);
    document.body.appendChild(btn);
    updateAudioButtonUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectAudioToggle);
  } else {
    injectAudioToggle();
  }

  window.novaAudio = {
    toggle: toggleMute,
    playTick,
    playSelect,
    playReset,
    playTourStart,
    setMuted: (m) => { if (Boolean(m) !== isMuted) toggleMute(); }
  };
})();
