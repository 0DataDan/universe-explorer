// NOVA Tier Sweep, Accessibility & Standby Scale Hide

window.runCinematicTierSweep = function(tier, durationMs) {
  if (typeof TWEEN === "undefined" || typeof camera === "undefined" || typeof controls === "undefined") return;
  const sweeps = {
    1: { start: [-18, 13, 22],    end: [20, 7, 16],      look: [0, 0, 0] },
    2: { start: [-150, 78, 165],  end: [140, 42, 125],   look: [0, 0, 0] },
    3: { start: [-540, 265, 600], end: [490, 175, 430],  look: [0, 0, 0] },
    4: { start: [-1650, 860, 1850], end: [1450, 480, 1320], look: [0, 0, 0] }
  };
  const cfg = sweeps[tier] || sweeps[1];
  const sweepMs = Math.max(9000, Math.min(20000, durationMs || 14000));

  TWEEN.removeAll();
  if (typeof isFlyingToTarget !== "undefined") isFlyingToTarget = true;
  controls.enabled = false;

  const startPos = new THREE.Vector3(cfg.start[0], cfg.start[1], cfg.start[2]);
  const endPos = new THREE.Vector3(cfg.end[0], cfg.end[1], cfg.end[2]);
  const lookTarget = new THREE.Vector3(cfg.look[0], cfg.look[1], cfg.look[2]);
  const startTarget = controls.target.clone();

  camera.position.copy(startPos);
  const tweenState = { t: 0 };

  new TWEEN.Tween(tweenState)
    .to({ t: 1 }, sweepMs)
    .easing(TWEEN.Easing.Sinusoidal.InOut)
    .onUpdate(() => {
      camera.position.lerpVectors(startPos, endPos, tweenState.t);
      controls.target.lerpVectors(startTarget, lookTarget, Math.min(1, tweenState.t * 2.5));
      camera.lookAt(controls.target);
      if (typeof updateScaleSliderFromCamera === "function") updateScaleSliderFromCamera();
    })
    .onComplete(() => {
      if (typeof isFlyingToTarget !== "undefined") isFlyingToTarget = false;
      controls.enabled = true;
    })
    .start();
};

(function initPhase0Accessibility() {
  const chip = document.getElementById("nova-scale-chip");
  const pop = document.getElementById("nova-scale-popover");
  if (chip && pop) {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = pop.hasAttribute("hidden");
      pop.toggleAttribute("hidden", !open);
      chip.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("pointerdown", (e) => {
      if (!pop.hasAttribute("hidden") && !chip.contains(e.target) && !pop.contains(e.target)) {
        pop.setAttribute("hidden", "");
        chip.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Plain-language tooltips & aria-labels for mission-control HUD abbreviations
  const tooltips = {
    "btn-cosmic-tour": "Guided Tour — Start or pause the narrated 44-stop journey",
    "btn-cosmic-web": "Cosmic Web — Toggle large-scale galaxy filaments",
    "btn-orbits": "Orbits — Toggle planetary and stellar orbital paths",
    "btn-toggle-labels": "Labels — Show or hide object name labels",
    "btn-t0": "Scales (Tiers) — Filter view by cosmic scale (Solar System to Cosmic Web)",
    "btn-toggle-sidebar": "Info — Toggle object details panel",
    "btn-fullscreen-zen": "Fullscreen — Toggle immersive fullscreen view",
    "nova-attitude-sphere": "Camera Orientation — Drag to rotate view, click to reset"
  };
  Object.entries(tooltips).forEach(([id, label]) => {
    const el = document.getElementById(id);
    if (el) {
      el.setAttribute("title", label);
      el.setAttribute("aria-label", label);
    }
  });

  // Ensure any ATTITUDE text label meets contrast & has a tooltip
  document.querySelectorAll("span, div, p").forEach((el) => {
    if (el.children.length === 0 && el.textContent.trim() === "ATTITUDE") {
      el.style.color = "#9aa3b2";
      el.style.fontSize = "12px";
      el.setAttribute("title", "Camera Orientation Gimbal");
    }
  });
})();

(function initNovaStandbyScaleHide() {
  if (window.__novaStandbyScaleHideInstalled) return;
  window.__novaStandbyScaleHideInstalled = true;

  let hookStandbyActive = false;

  function applyStandbyHide(active) {
    document.body.classList.toggle("nova-standby-hidden", Boolean(active));
    if (active) {
      const pop = document.getElementById("nova-scale-popover");
      const chip = document.getElementById("nova-scale-chip");
      if (pop && !pop.hasAttribute("hidden")) {
        pop.setAttribute("hidden", "");
        if (chip) chip.setAttribute("aria-expanded", "false");
      }
    }
  }

  function isElementActuallyVisible(el) {
    let cur = el;
    while (cur && cur !== document.body) {
      const cs = getComputedStyle(cur);
      if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity || "1") < 0.05) {
        return false;
      }
      cur = cur.parentElement;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  if (typeof window.enterScreensaverMode === "function") {
    const origEnter = window.enterScreensaverMode;
    window.enterScreensaverMode = function(...args) {
      hookStandbyActive = true;
      applyStandbyHide(true);
      return origEnter.apply(this, args);
    };
  }

  if (typeof window.exitScreensaverMode === "function") {
    const origExit = window.exitScreensaverMode;
    window.exitScreensaverMode = function(...args) {
      hookStandbyActive = false;
      const res = origExit.apply(this, args);
      applyStandbyHide(false);
      return res;
    };
  }

  setInterval(() => {
    const bannerVisible = Array.from(document.querySelectorAll("div, span, p")).some((el) => {
      if (el.children.length > 0 || !el.textContent) return false;
      if (!el.textContent.toLowerCase().includes("observatory standby")) return false;
      return isElementActuallyVisible(el);
    });
    applyStandbyHide(hookStandbyActive || bannerVisible);
  }, 150);
})();
