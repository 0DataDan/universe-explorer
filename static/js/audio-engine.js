// NOVA Procedural Web Audio Engine — Instrument-Grade Observatory Soundscape
(function initNovaAudioEngine() {
  if (window.novaAudio) return;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const ENGINE_BOOT_MS = performance.now();
  const BOOT_SILENCE_MS = 3500;
  const IDLE_FADE_MS = 25000;

  let ctx = null;
  let masterGain = null;
  let ambientGain = null;
  let sfxGain = null;
  let droneFilter = null;
  let oscA = null;
  let oscB = null;
  let noiseGain = null;
  let whiteNoiseBuffer = null;
  let pulsarTimer = null;
  let bhNodes = null;

  let isMuted = false;
  let isUnlocked = false;
  let isDucked = false;
  let isCurrentlyQuiet = false;
  let currentTier = 1;
  let activeObjectName = "";
  let lastInteractionTime = performance.now();
  let flightStartTime = 0;
  let flightDurationMs = 2200;
  let lastResetSoundAt = 0;

  const AMBIENT_NORMAL = 0.42;
  const AMBIENT_DUCKED = 0.08;

  const TIER_PROFILES = {
    1: { fA: 55.0,  fB: 110.0, cutoff: 185, noise: 0.011 }, // Solar System (AU)
    2: { fA: 65.41, fB: 98.0,  cutoff: 270, noise: 0.015 }, // Interstellar (ly)
    3: { fA: 49.0,  fB: 73.42, cutoff: 220, noise: 0.020 }, // Galactic (kly/Mly)
    4: { fA: 36.71, fB: 55.0,  cutoff: 155, noise: 0.025 }  // Cosmic Web (Mpc/Gly)
  };

  function buildBrownNoiseBuffer(audioCtx) {
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

  function buildWhiteNoiseBuffer(audioCtx) {
    const len = audioCtx.sampleRate * 2;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
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

    whiteNoiseBuffer = buildWhiteNoiseBuffer(ctx);

    masterGain = ctx.createGain();
    masterGain.gain.value = isMuted ? 0.0 : 0.85;
    masterGain.connect(ctx.destination);

    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.0;
    ambientGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.78;
    sfxGain.connect(masterGain);

    // Background drone disabled for clean vacuum telemetry; ambientGain reserved for Black Hole swell

    const now = ctx.currentTime;
    ambientGain.gain.setValueAtTime(0.0001, now);
    ambientGain.gain.exponentialRampToValueAtTime(isDucked ? AMBIENT_DUCKED : AMBIENT_NORMAL, now + 1.8);

    isUnlocked = true;
    return true;
  }

  function isBootSilenced() {
    return (performance.now() - ENGINE_BOOT_MS) < BOOT_SILENCE_MS;
  }

  function getArrivalFactor() {
    if (!flightStartTime) return 1.0;
    const elapsed = performance.now() - flightStartTime;
    if (elapsed >= flightDurationMs) return 1.0;
    const progress = Math.max(0, Math.min(1, elapsed / flightDurationMs));
    if (progress < 0.35) return 0.0;
    const ramp = (progress - 0.35) / 0.65;
    return ramp * ramp;
  }

  function isScaleModeActive() {
    const txt = document.body ? document.body.innerText : "";
    return txt.includes("TRUE-SCALE COMPARISON");
  }

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

  // 1. Relay-Switch HUD Toggle: 10ms band-passed noise transient (no musical pitch)
  function playTick(centerFreq = 2200) {
    if (isMuted || isBootSilenced() || !ensureContext() || !whiteNoiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = whiteNoiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(centerFreq, now);
    bp.Q.value = 3.2;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.011);

    src.connect(bp);
    bp.connect(g);
    g.connect(sfxGain);
    src.start(now, Math.random() * 1.2, 0.016);
  }

  // 2. Ephemeris Time-Warp Detent: crisp mechanical watch-escapement double-click
  function playTimeDetent(pitchScale = 1.0) {
    if (isMuted || isBootSilenced() || !ensureContext() || !whiteNoiseBuffer) return;
    const now = ctx.currentTime;
    [0, 0.022].forEach((offset, idx) => {
      const t0 = now + offset;
      const src = ctx.createBufferSource();
      src.buffer = whiteNoiseBuffer;

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime((idx === 0 ? 3100 : 4200) * pitchScale, t0);
      bp.Q.value = 5.5;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(idx === 0 ? 0.14 : 0.09, t0 + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.008);

      src.connect(bp);
      bp.connect(g);
      g.connect(sfxGain);
      src.start(t0, Math.random() * 1.2, 0.012);
    });
  }

  // 2B. Calibrated Scale/Range Slider Tick (pitch rises smoothly with slider value)
  let lastSliderTickAt = 0;
  function playSliderTick(normVal = 0.5) {
    if (isMuted || isBootSilenced() || !ensureContext() || !whiteNoiseBuffer) return;
    const tNow = performance.now();
    if (tNow - lastSliderTickAt < 40) return;
    lastSliderTickAt = tNow;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = whiteNoiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1600 + Math.max(0, Math.min(1, normVal)) * 1600, now);
    bp.Q.value = 6.0;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.095, now + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.009);

    src.connect(bp);
    bp.connect(g);
    g.connect(sfxGain);
    src.start(now, Math.random() * 1.2, 0.014);
  }

  // 2C. Whisper-Quiet Map Rotation / Gimbal Micro-Detent (horological bearing feel)
  let lastGimbalTickAt = 0;
  function playGimbalTick() {
    if (isMuted || isBootSilenced() || !ensureContext() || !whiteNoiseBuffer) return;
    const tNow = performance.now();
    if (tNow - lastGimbalTickAt < 55) return;
    lastGimbalTickAt = tNow;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = whiteNoiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1350 + Math.random() * 180, now);
    bp.Q.value = 4.5;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.032, now + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);

    src.connect(bp);
    bp.connect(g);
    g.connect(sfxGain);
    src.start(now, Math.random() * 1.2, 0.012);
  }

  // 2D. Whisper-Quiet Directional Zoom Tick (wheel, trackpad pinch, touch pinch)
  let lastZoomTickAt = 0;
  function playZoomTick(zoomingIn = true) {
    if (isMuted || isBootSilenced() || !ensureContext() || !whiteNoiseBuffer) return;
    const tNow = performance.now();
    if (tNow - lastZoomTickAt < 65) return;
    lastZoomTickAt = tNow;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = whiteNoiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    const baseFreq = zoomingIn ? 1900 : 1200;
    bp.frequency.setValueAtTime(baseFreq + (Math.random() - 0.5) * 140, now);
    bp.Q.value = 5.2;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.030, now + 0.0012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.0085);

    src.connect(bp);
    bp.connect(g);
    g.connect(sfxGain);
    src.start(now, Math.random() * 1.2, 0.013);
  }

  // 3. Object Select: Precision optical shutter / relay lock (unpitched, tactile)
  function playPortalEnter() {
    if (isMuted || !ensureContext()) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const out = typeof sfxGain !== "undefined" && sfxGain ? sfxGain : ctx.destination;

    // 1. Subtle tactile click (18ms)
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = "sine";
    clickOsc.frequency.setValueAtTime(1100, now);
    clickOsc.frequency.exponentialRampToValueAtTime(350, now + 0.018);
    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.linearRampToValueAtTime(0.08, now + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
    clickOsc.connect(clickGain);
    clickGain.connect(out);
    clickOsc.start(now);
    clickOsc.stop(now + 0.024);

    // 2. Low, soft resonant pulse (700ms tail)
    const pulseOsc = ctx.createOscillator();
    const pulseFilter = ctx.createBiquadFilter();
    const pulseGain = ctx.createGain();
    pulseOsc.type = "sine";
    pulseOsc.frequency.setValueAtTime(92, now);
    pulseOsc.frequency.exponentialRampToValueAtTime(46, now + 0.85);
    pulseFilter.type = "lowpass";
    pulseFilter.frequency.setValueAtTime(220, now);
    pulseGain.gain.setValueAtTime(0.0001, now);
    pulseGain.gain.linearRampToValueAtTime(0.36, now + 0.025);
    pulseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.88);
    pulseOsc.connect(pulseFilter);
    pulseFilter.connect(pulseGain);
    pulseGain.connect(out);
    pulseOsc.start(now);
    pulseOsc.stop(now + 0.92);
  }

  function playSelect() {
    if (isMuted || isBootSilenced() || !ensureContext() || !whiteNoiseBuffer) return;
    const now = ctx.currentTime;

    // Crisp mechanical shutter transient
    const src = ctx.createBufferSource();
    src.buffer = whiteNoiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(2850, now);
    bp.Q.value = 2.6;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.linearRampToValueAtTime(0.22, now + 0.0015);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(sfxGain);
    src.start(now, Math.random() * 1.2, 0.022);

    // Damped low-end mechanical thud for lock-in weight
    const thud = ctx.createOscillator();
    const tg = ctx.createGain();
    thud.type = "sine";
    thud.frequency.setValueAtTime(115, now);
    thud.frequency.exponentialRampToValueAtTime(58, now + 0.028);
    tg.gain.setValueAtTime(0.0001, now);
    tg.gain.linearRampToValueAtTime(0.14, now + 0.002);
    tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
    thud.connect(tg);
    tg.connect(sfxGain);
    thud.start(now);
    thud.stop(now + 0.038);
  }

  // 4. Doppler Fly-To Whoosh: velocity-shaped bandpass air sweep synced to camera transit
  function playDopplerWhoosh(durationMs = 1800) {
    if (isMuted || isBootSilenced() || !ensureContext() || !whiteNoiseBuffer) return;
    const now = ctx.currentTime;
    const dur = Math.max(0.75, Math.min(2.4, durationMs / 1000));
    const src = ctx.createBufferSource();
    src.buffer = whiteNoiseBuffer;
    src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 2.4;
    bp.frequency.setValueAtTime(160, now);
    bp.frequency.exponentialRampToValueAtTime(540, now + dur * 0.36);
    bp.frequency.exponentialRampToValueAtTime(135, now + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.055, now + dur * 0.30);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(bp);
    bp.connect(g);
    g.connect(sfxGain);
    src.start(now);
    src.stop(now + dur + 0.05);
  }

  // 5. Reset: Gimbal release double-detent + damped home-settle thump (unpitched)
  function playReset() {
    if (isMuted || isBootSilenced() || !ensureContext() || !whiteNoiseBuffer) return;
    const tNow = performance.now();
    if (tNow - lastResetSoundAt < 150) return;
    lastResetSoundAt = tNow;

    const now = ctx.currentTime;

    // Two-stage mechanical unlatch -> settle click
    [
      { offset: 0.0,   freq: 1950, q: 3.4, gain: 0.16, dur: 0.011 },
      { offset: 0.038, freq: 1120, q: 2.8, gain: 0.20, dur: 0.016 }
    ].forEach((step) => {
      const t0 = now + step.offset;
      const src = ctx.createBufferSource();
      src.buffer = whiteNoiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(step.freq, t0);
      bp.Q.value = step.q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(step.gain, t0 + 0.0015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + step.dur);
      src.connect(bp);
      bp.connect(g);
      g.connect(sfxGain);
      src.start(t0, Math.random() * 1.2, step.dur + 0.008);
    });

    // Subtle damped body thump on the second detent
    const t1 = now + 0.038;
    const thump = ctx.createOscillator();
    const tg = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(92, t1);
    thump.frequency.exponentialRampToValueAtTime(52, t1 + 0.032);
    tg.gain.setValueAtTime(0.0001, t1);
    tg.gain.linearRampToValueAtTime(0.11, t1 + 0.002);
    tg.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.036);
    thump.connect(tg);
    tg.connect(sfxGain);
    thump.start(t1);
    thump.stop(t1 + 0.042);
  }

  // 5B. Subtle CLI Terminal Key Clicks
  function playCliKey(key) {
    if (isMuted || isBootSilenced() || !ensureContext() || !whiteNoiseBuffer) return;
    const now = ctx.currentTime;
    if (key === "Enter") {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1480, now);
      osc.frequency.exponentialRampToValueAtTime(1960, now + 0.022);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.042, now + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
      osc.connect(g);
      g.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.032);
      return;
    }
    if (key.length !== 1 && key !== "Backspace" && key !== "Tab") return;
    const src = ctx.createBufferSource();
    src.buffer = whiteNoiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    const base = key === "Backspace" ? 1650 : 2850;
    bp.frequency.setValueAtTime(base + (Math.random() - 0.5) * 320, now);
    bp.Q.value = 5.5;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.042, now + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.0065);

    src.connect(bp);
    bp.connect(g);
    g.connect(sfxGain);
    src.start(now, Math.random() * 1.2, 0.01);
  }

  // 6. Tour Start Handshake: clean 3-pulse ascending observatory sequence
  function playTourStart() {
    if (isMuted || isBootSilenced() || !ensureContext()) return;
    const now = ctx.currentTime;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1200;
    bp.Q.value = 1.1;
    bp.connect(sfxGain);

    [880, 1174.66, 1567.98].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const t0 = now + idx * 0.055;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(idx === 2 ? 0.06 : 0.048, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
      osc.connect(g);
      g.connect(bp);
      osc.start(t0);
      osc.stop(t0 + 0.10);
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

  // Layer 3A: Slow Crab Pulsar radio-telescope beacon (~1.1s cadence) with proximity ramp
  function updatePulsarSonification() {
    const isPulsar = /crab/i.test(activeObjectName);
    if (isPulsar && !pulsarTimer) {
      pulsarTimer = setInterval(() => {
        if (isMuted || !isUnlocked || !ctx || ctx.state !== "running") return;
        const arrival = getArrivalFactor();
        if (arrival < 0.02) return;
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

  // Layer 3B: Deep gravitational harmonic swell for Black Holes with proximity ramp
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
      subOsc.frequency.value = 38.89;
      subOsc.connect(bhFilter);
      subOsc.start(now);

      const overtoneOsc = ctx.createOscillator();
      overtoneOsc.type = "sine";
      overtoneOsc.frequency.value = 58.27;
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

  function hookEngineFunctions() {
    if (typeof window.smoothFlyToTarget === "function" && !window.smoothFlyToTarget.__novaAudioHooked) {
      const origFly = window.smoothFlyToTarget;
      window.smoothFlyToTarget = function (...args) {
        flightStartTime = performance.now();
        flightDurationMs = (typeof args[0] === "number" && args[0] > 0) ? args[0] : 2200;
        const isBooting = document.documentElement && document.documentElement.classList.contains("is-booting");
        if (!window.isScreensaverActive && !isBooting) {
          playSelect();
          playDopplerWhoosh(flightDurationMs);
        }
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
    hookEngineFunctions();
    if (
      window.smoothFlyToTarget && window.smoothFlyToTarget.__novaAudioHooked &&
      window.resetCameraToHome && window.resetCameraToHome.__novaAudioHooked
    ) {
      clearInterval(hookPoller);
    }
  }, 400);

  // O(1) user activity tracker (zero DOM reflows on pointermove)
  function markUserActivity() {
    lastInteractionTime = performance.now();
    if (isCurrentlyQuiet && ctx && masterGain && !isMuted) {
      isCurrentlyQuiet = false;
      masterGain.gain.setTargetAtTime(0.85, ctx.currentTime, 0.35);
    }
  }

  let dragAccumPx = 0;
  let lastDragX = null;
  let lastDragY = null;

  window.addEventListener("pointermove", (e) => {
    markUserActivity();
    if (e.buttons === 1 && e.target && e.target.tagName === "CANVAS") {
      if (lastDragX !== null) {
        dragAccumPx += Math.hypot(e.clientX - lastDragX, e.clientY - lastDragY);
        if (dragAccumPx >= 42) {
          dragAccumPx = 0;
          playGimbalTick();
        }
      }
      lastDragX = e.clientX;
      lastDragY = e.clientY;
    } else {
      lastDragX = null;
      lastDragY = null;
      dragAccumPx = 0;
    }
  }, { capture: true, passive: true });

  let wheelAccum = 0;
  window.addEventListener("wheel", (e) => {
    markUserActivity();
    if (!e.target || e.target.tagName !== "CANVAS") return;
    const step = e.ctrlKey ? e.deltaY * 4.0 : e.deltaY;
    if ((wheelAccum > 0 && step < 0) || (wheelAccum < 0 && step > 0)) {
      wheelAccum = 0;
    }
    wheelAccum += step;
    if (Math.abs(wheelAccum) >= 90) {
      const zoomingIn = wheelAccum < 0;
      wheelAccum = 0;
      playZoomTick(zoomingIn);
    }
  }, { capture: true, passive: true });

  let lastPinchDist = null;
  let pinchAccum = 0;
  window.addEventListener("touchstart", (e) => {
    markUserActivity();
    if (e.touches && e.touches.length === 2) {
      lastPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchAccum = 0;
    } else {
      lastPinchDist = null;
    }
  }, { capture: true, passive: true });

  window.addEventListener("touchmove", (e) => {
    markUserActivity();
    if (e.touches && e.touches.length === 2 && e.target && e.target.tagName === "CANVAS") {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastPinchDist !== null) {
        const delta = dist - lastPinchDist;
        pinchAccum += delta;
        if (Math.abs(pinchAccum) >= 28) {
          const zoomingIn = pinchAccum > 0;
          pinchAccum = 0;
          playZoomTick(zoomingIn);
        }
      }
      lastPinchDist = dist;
    }
  }, { capture: true, passive: true });

  window.addEventListener("input", (e) => {
    const el = e.target;
    if (el && el.tagName === "INPUT" && el.type === "range") {
      ensureContext();
      markUserActivity();
      const min = parseFloat(el.min || "0");
      const max = parseFloat(el.max || "100");
      const val = parseFloat(el.value || "0");
      const norm = (max > min) ? (val - min) / (max - min) : 0.5;
      playSliderTick(norm);
    }
  }, { capture: true, passive: true });

  window.addEventListener("pointerdown", (e) => {
    ensureContext();
    markUserActivity();
    const hit = e.target && e.target.closest
      ? e.target.closest("button, [role='button'], [id^='btn-'], [data-tip], .gimbal-sub, [id*='gimbal']")
      : null;
    const isBooting = document.documentElement && document.documentElement.classList.contains("is-booting");
    if (!isBooting && hit && hit.id !== "btn-nova-audio") {
      const meta = ((hit.id || "") + " " + (hit.getAttribute("data-tip") || "") + " " + (hit.textContent || "")).toLowerCase();
      if (meta.includes("reset") || meta.includes("home [r]")) {
        playReset();
      } else if (meta.includes("tour") && !meta.includes("voice") && !meta.includes("stop") && !meta.includes("exit") && !meta.includes("next") && !meta.includes("prev")) {
        playTourStart();
      } else if (/\b(now|1d\/s|1m\/s|1y\/s|j2000)\b/.test(meta) || meta.includes("speed") || meta.includes("time")) {
        const scale = meta.includes("1y/s") ? 1.25 : meta.includes("1m/s") ? 1.12 : meta.includes("1d/s") ? 1.0 : 0.9;
        playTimeDetent(scale);
      } else {
        playTick(hit.id === "btn-cosmic-web" ? 2600 : 2100);
      }
    }
  }, { capture: true, passive: true });

  window.addEventListener("keydown", (e) => {
    ensureContext();
    markUserActivity();
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea") {
      playCliKey(e.key);
      return;
    }
    if (e.key === "r" || e.key === "R") {
      playReset();
    } else if (["1", "2", "3", "4"].includes(e.key)) {
      playTimeDetent(0.9 + Number(e.key) * 0.1);
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
    if (!isMuted) playTick(2500);
    updateAudioButtonUI();
  }

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
    playTimeDetent,
    playSliderTick,
    playGimbalTick,
    playZoomTick,
    playSelect,
    playPortalEnter,
    playDopplerWhoosh,
    playReset,
    playTourStart,
    setMuted: (m) => { if (Boolean(m) !== isMuted) toggleMute(); }
  };
})();
