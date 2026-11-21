// NOVA Physics Guard & HUD Control Helpers

(function initBulletproofPhysics() {
    const hud = document.getElementById("bottom-hud") || document.querySelector("nav") || document.getElementById("hud-bar");
    let isHoveringBottom = false;

    // 1. Create the cyan line dock zone dynamically
    let dockZone = document.getElementById("nova-tour-dock");
    if (!dockZone) {
        dockZone = document.createElement("div");
        dockZone.id = "nova-tour-dock";
        dockZone.innerHTML = '<div class="cyan-line"></div>';
        document.body.appendChild(dockZone);
    }

    // 2. Track if the cursor is in the bottom 120px of the screen
    window.addEventListener("mousemove", (e) => {
        isHoveringBottom = e.clientY > window.innerHeight - 120;
    }, { passive: true });

    // 3. Tour Detection & Docking Logic
    setInterval(() => {
        if (!hud) return;
        
        // Detect Guided Tour by finding any pagination format like "18/47" or "2 / 39"
        const pageText = document.body.innerText;
        const isTourActive = /\b\d+\s*\/\s*[34][0-9]\b/.test(pageText) || pageText.includes("Gravity-dominated");
        
        // Dock the HUD ONLY if the tour is active and the cursor is away from the bottom edge
        if (isTourActive && !isHoveringBottom) {
            hud.classList.add("nova-hud-docked");
            dockZone.classList.add("active");
        } else {
            hud.classList.remove("nova-hud-docked");
            dockZone.classList.remove("active");
        }
    }, 400);
  })();

(function () {
  const DEG2RAD = Math.PI / 180;
  const J2000_JD = 2451545.0;

  window.NOVA_KEPLER_ELEMENTS = {
    mercury: { e: 0.20563, i: 7.005, O: 48.331, w: 77.456,  L0: 252.251, period: 87.969 },
    venus:   { e: 0.00677, i: 3.395, O: 76.680, w: 131.533, L0: 181.980, period: 224.701 },
    earth:   { e: 0.01671, i: 0.000, O: 0.000,  w: 102.947, L0: 100.464, period: 365.256 },
    mars:    { e: 0.09340, i: 1.850, O: 49.558, w: 336.041, L0: 355.453, period: 686.980 },
    ceres:   { e: 0.07582, i: 10.59, O: 80.305, w: 153.900, L0: 291.400, period: 1681.63 },
    jupiter: { e: 0.04849, i: 1.303, O: 100.46, w: 14.754,  L0: 34.404,  period: 4332.59 },
    saturn:  { e: 0.05555, i: 2.489, O: 113.67, w: 92.432,  L0: 49.944,  period: 10759.2 },
    uranus:  { e: 0.04638, i: 0.773, O: 74.006, w: 170.964, L0: 313.232, period: 30685.4 },
    neptune: { e: 0.00946, i: 1.770, O: 131.78, w: 44.971,  L0: 304.880, period: 60189.0 }
  };

  function dateToJD(date) {
    return (date.getTime() / 86400000) + 2440587.5;
  }
  function jdToDate(jd) {
    return new Date((jd - 2440587.5) * 86400000);
  }
  function solveKepler(M, e) {
    let E = M;
    for (let k = 0; k < 4; k++) {
      E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    }
    return E;
  }
  function keplerTo3D(el, visualA, E) {
    const xOrb = visualA * (Math.cos(E) - el.e);
    const zOrb = visualA * Math.sqrt(1 - el.e * el.e) * Math.sin(E);

    const O = el.O * DEG2RAD;
    const w = (el.w - el.O) * DEG2RAD;
    const inc = el.i * DEG2RAD;

    const cosO = Math.cos(O), sinO = Math.sin(O);
    const cosw = Math.cos(w), sinw = Math.sin(w);
    const cosi = Math.cos(inc), sini = Math.sin(inc);

    const x = (cosO * cosw - sinO * sinw * cosi) * xOrb + (-cosO * sinw - sinO * cosw * cosi) * zOrb;
    const z = (sinO * cosw + cosO * sinw * cosi) * xOrb + (-sinO * sinw + cosO * cosw * cosi) * zOrb;
    const y = (sinw * sini) * xOrb + (cosw * sini) * zOrb;
    return { x, y, z };
  }

  window._novaSimJD = dateToJD(new Date());
  window._novaDaysPerSec = 1.0;
  let _lastPerf = performance.now();

  const readoutEl = document.getElementById("nova-eph-readout");
  const sliderEl = document.getElementById("nova-ephemeris-slider");
  const hudEl = document.getElementById("nova-ephemeris-hud");

  function syncHud() {
    const d = jdToDate(window._novaSimJD);
    if (isNaN(d.getTime())) return;
    const iso = d.toISOString();
    if (readoutEl) {
      readoutEl.textContent = iso.slice(0, 10).replace(/-/g, ".") + "  " + iso.slice(11, 16) + " UTC";
    }
    if (sliderEl && document.activeElement !== sliderEl) {
      const yr = d.getUTCFullYear() + (d.getUTCMonth() / 12) + (d.getUTCDate() / 365.25);
      sliderEl.value = Math.min(2050, Math.max(1980, yr)).toFixed(2);
    }
  }

  if (sliderEl) {
    sliderEl.addEventListener("input", (e) => {
      const yr = parseFloat(e.target.value);
      const yInt = Math.floor(yr);
      const frac = yr - yInt;
      const dt = new Date(Date.UTC(yInt, 0, 1) + frac * 365.25 * 86400000);
      window._novaSimJD = dateToJD(dt);
      syncHud();
    });
  }

  if (hudEl) {
    hudEl.querySelectorAll("button[data-rate]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window._novaDaysPerSec = parseFloat(btn.dataset.rate);
        hudEl.querySelectorAll("button[data-rate]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
    hudEl.querySelectorAll("button[data-epoch]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ep = btn.dataset.epoch;
        if (ep === "now") window._novaSimJD = dateToJD(new Date());
        else if (ep === "2000") window._novaSimJD = J2000_JD;
        else if (ep === "1986") window._novaSimJD = dateToJD(new Date(Date.UTC(1986, 1, 9, 12, 0)));
        syncHud();
      });
    });
  }

  window.updateKeplerianOrbits = function (planets, paused) {
    const now = performance.now();
    const dtSec = Math.min((now - _lastPerf) * 0.001, 0.1);
    _lastPerf = now;

    if (!paused) {
      window._novaSimJD += window._novaDaysPerSec * dtSec;
    }

    const d = window._novaSimJD - J2000_JD;
    for (let i = 0; i < planets.length; i++) {
      const p = planets[i];
      if (!p || !p.mesh || !p.mesh.userData || !Number.isFinite(p.radius)) continue;
      const id = p.mesh.userData.id;
      const el = window.NOVA_KEPLER_ELEMENTS[id];
      if (!el) continue;

      // Lazily upgrade the planet's orbit line to a true 3D tilted ellipse once
      if (p.mesh.userData.orbitLine && !p.mesh.userData._keplerLineUpgraded && typeof THREE !== "undefined") {
        const pts = [];
        for (let s = 0; s <= 160; s++) {
          const E0 = (s / 160) * Math.PI * 2;
          const pt = keplerTo3D(el, p.radius, E0);
          pts.push(new THREE.Vector3(pt.x, pt.y, pt.z));
        }
        p.mesh.userData.orbitLine.geometry.dispose();
        p.mesh.userData.orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
        p.mesh.userData.orbitLine.frustumCulled = false;
        p.mesh.userData._keplerLineUpgraded = true;
      }

      const n = 360.0 / el.period;
      let M = ((el.L0 + n * d - el.w) % 360) * DEG2RAD;
      if (M > Math.PI) M -= Math.PI * 2;
      if (M < -Math.PI) M += Math.PI * 2;

      const E = solveKepler(M, el.e);
      const pos = keplerTo3D(el, p.radius, E);
      if (Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z)) {
        p.mesh.position.set(pos.x, pos.y, pos.z);
      }
    }
    syncHud();
  };

  syncHud();
})();
