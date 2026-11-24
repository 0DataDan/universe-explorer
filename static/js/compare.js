// NOVA True-Scale Cosmic Comparison Stage — Tiers 1–4 (static/js/compare.js)
import * as THREE from 'three';

const AU_KM  = 149597870.7;
const LY_KM  = 9.4607304725808e12;
const MLY_KM = LY_KM * 1e6;

// Authoritative physical spans (diameter in km) & shape mode
// shape: 'sphere' = normalize by core sphere radius (preserves ring overhang)
// shape: 'bounds' = normalize by full 3D bounding-box span (galaxies, nebulae, clusters, voids)
const COSMIC_CATALOG = {
  // Tier 1 — Solar System
  sun:                  { name: 'The Sun (Sol)',    km: 1392700,      tier: 1, shape: 'sphere' },
  jupiter:              { name: 'Jupiter',          km: 139820,       tier: 1, shape: 'sphere' },
  saturn:               { name: 'Saturn',           km: 116460,       tier: 1, shape: 'sphere' },
  uranus:               { name: 'Uranus',           km: 50724,        tier: 1, shape: 'sphere' },
  neptune:              { name: 'Neptune',          km: 49244,        tier: 1, shape: 'sphere' },
  earth:                { name: 'Earth',            km: 12742,        tier: 1, shape: 'sphere' },
  venus:                { name: 'Venus',            km: 12104,        tier: 1, shape: 'sphere' },
  mars:                 { name: 'Mars',             km: 6779,         tier: 1, shape: 'sphere' },
  mercury:              { name: 'Mercury',          km: 4879,         tier: 1, shape: 'sphere' },
  moon:                 { name: 'The Moon',         km: 3474,         tier: 1, shape: 'sphere' },
  pluto:                { name: 'Pluto',            km: 2377,         tier: 1, shape: 'sphere' },
  ceres:                { name: '1 Ceres',          km: 939,          tier: 1, shape: 'sphere' },

  // Tier 2 — Individual Stars
  'trappist-1':         { name: 'TRAPPIST-1',       km: 165800,       tier: 2, shape: 'sphere' },
  'barnards-star':      { name: "Barnard's Star",   km: 273000,       tier: 2, shape: 'sphere' },
  sirius:               { name: 'Sirius A',         km: 2380000,      tier: 2, shape: 'sphere' },
  polaris:              { name: 'Polaris',          km: 52000000,     tier: 2, shape: 'sphere' },
  betelgeuse:           { name: 'Betelgeuse',       km: 1064000000,   tier: 2, shape: 'sphere' },
  'stephenson-2-18':    { name: 'Stephenson 2-18',  km: 2990000000,   tier: 2, shape: 'sphere' },
};

const TIER_LABELS = {
  1: 'SOLAR SYSTEM',
  2: 'STARS',
};

const PRESETS = [
  ['earth', 'moon', 'EARTH / MOON'],
  ['earth', 'jupiter', 'EARTH / JUPITER'],
  ['sun', 'betelgeuse', 'SOL / BETELGEUSE'],
  ['betelgeuse', 'stephenson-2-18', 'BETELGEUSE / STEPHENSON'],
];

const CYCLE_PAIRS = [
  ['earth', 'moon'],
  ['earth', 'mars'],
  ['earth', 'jupiter'],
  ['jupiter', 'saturn'],
  ['sun', 'earth'],
  ['sun', 'sirius'],
  ['sun', 'betelgeuse'],
  ['betelgeuse', 'stephenson-2-18'],
];

function formatSpan(km) {
  if (km >= 0.5 * MLY_KM) {
    const mly = km / MLY_KM;
    return (mly >= 100 ? mly.toFixed(0) : mly.toFixed(1)) + ' Mly';
  }
  if (km >= 0.1 * LY_KM) {
    const ly = km / LY_KM;
    if (ly >= 1000) return Math.round(ly).toLocaleString('en-US') + ' ly';
    return (ly >= 10 ? ly.toFixed(0) : ly.toFixed(1)) + ' ly';
  }
  if (km >= 0.5 * AU_KM) {
    const au = km / AU_KM;
    if (au >= 100) return Math.round(au).toLocaleString('en-US') + ' AU';
    return au.toFixed(1) + ' AU';
  }
  if (km >= 1e7) {
    return (km / 1e6).toFixed(1) + 'M km';
  }
  return Math.round(km).toLocaleString('en-US') + ' km';
}

function formatRatio(a, b) {
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  const r = big / small;
  if (r >= 1e5) {
    const exp = Math.floor(Math.log10(r));
    const mant = (r / Math.pow(10, exp)).toFixed(1);
    return `${mant}×10^${exp}×`;
  }
  if (r >= 100) return Math.round(r).toLocaleString('en-US') + '×';
  if (r >= 10) return r.toFixed(1) + '×';
  return r.toFixed(2) + '×';
}

function buildCleanBodyClone(sourceMesh, shapeMode) {
  const wrapper = new THREE.Group();
  const clone = sourceMesh.clone(true);
  clone.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material = Array.isArray(child.material)
        ? child.material.map((m) => m.clone())
        : child.material.clone();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        if (child.name === 'earth-clouds-nightlights' && m.uniforms && m.uniforms.uLightDir) {
          m.uniforms.uLightDir = { value: new THREE.Vector3(8, 5, 10).normalize() };
        }
        m.needsUpdate = true;
      });
    }
  });
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);

  if (shapeMode === 'sphere') {
    let baseRadius = 1;
    if (sourceMesh.geometry) {
      sourceMesh.geometry.computeBoundingSphere();
      if (sourceMesh.geometry.boundingSphere && sourceMesh.geometry.boundingSphere.radius > 0) {
        baseRadius = sourceMesh.geometry.boundingSphere.radius;
      }
    }
    clone.visible = true;
    clone.traverse((child) => {
      if (child.isSprite) child.visible = false;
      else if (child.isMesh || child.isPoints) child.visible = true;
    });
    clone.scale.setScalar(1 / baseRadius);
    wrapper.add(clone);
    return wrapper;
  }

  // Non-spherical / multi-part objects (galaxies, nebulae, clusters, voids):
  // Force visibility (in case cloned from an inactive tier) and measure only Mesh/Points
  clone.visible = true;
  clone.traverse((child) => {
    if (child.isSprite) {
      child.visible = false;
    } else if (child.isMesh || child.isPoints) {
      child.visible = true;
    }
  });

  clone.updateMatrixWorld(true);
  const box = new THREE.Box3();
  clone.traverse((child) => {
    if ((child.isMesh || child.isPoints) && child.geometry) {
      child.geometry.computeBoundingBox();
      if (child.geometry.boundingBox) {
        const b = child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld);
        box.union(b);
      }
    }
  });

  if (!box.isEmpty()) {
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxHalfSpan = Math.max(size.x, size.y, size.z) * 0.5;
    if (maxHalfSpan > 0) {
      const norm = 1 / maxHalfSpan;
      clone.position.set(-center.x * norm, -center.y * norm, -center.z * norm);
      clone.scale.setScalar(norm);
    }
  }
  wrapper.add(clone);
  return wrapper;
}

function getFullHorizontalExtent(obj, fallbackRadius) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return fallbackRadius;
  const halfX = (box.max.x - box.min.x) * 0.5;
  const halfZ = (box.max.z - box.min.z) * 0.5;
  return Math.max(fallbackRadius, halfX, halfZ);
}

export function initScaleCompare({ celestialObjects, getActiveTarget }) {
  let overlayEl = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let animId = null;
  let isOpen = false;

  let pairGroup = null;
  let meshA = null;
  let meshB = null;
  let reticleMesh = null;

  let currentIdA = 'earth';
  let currentIdB = 'jupiter';

  let yaw = 0.18;
  let pitch = 0.12;
  let targetYaw = 0.18;
  let targetPitch = 0.12;
  let dist = 9.5;
  let targetDist = 9.5;
  let targetPanX = 0;
  let panX = 0;
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  function getAvailableBodies() {
    const byId = new Map();
    if (Array.isArray(celestialObjects)) {
      celestialObjects.forEach((m) => {
        const id = (m && m.userData && m.userData.id) ? m.userData.id.toLowerCase() : '';
        if (id && COSMIC_CATALOG[id]) {
          const meta = COSMIC_CATALOG[id];
          byId.set(id, {
            id,
            name: meta.name || m.userData.name || id.toUpperCase(),
            diameterKm: meta.km,
            tier: meta.tier,
            shape: meta.shape,
            mesh: m,
          });
        }
      });
    }
    return Object.keys(COSMIC_CATALOG)
      .filter((id) => byId.has(id))
      .map((id) => byId.get(id));
  }

  function pickSmartPartner(body, bodies) {
    // Pick a compelling same-tier partner when opening from a focused object
    const sameTier = bodies.filter((b) => b.tier === body.tier && b.id !== body.id);
    if (sameTier.length) {
      if (body.id === 'earth') return 'jupiter';
      if (body.tier === 1) return 'earth';
      // Pick the largest or second-largest in the same tier for dramatic contrast
      const sorted = [...sameTier].sort((a, b) => b.diameterKm - a.diameterKm);
      return sorted[0].id;
    }
    return body.id === 'earth' ? 'jupiter' : 'earth';
  }

  function injectTopBarButton() {
    const header = document.getElementById('header-nav');
    if (!header || document.getElementById('header-compare-trigger')) return;

    const logoPill = document.getElementById('header-nova-pill');

    const wrap = document.createElement('div');
    wrap.id = 'header-compare-trigger';
    wrap.className = 'pointer-events-auto flex items-center gap-3 ml-3 select-none';

    const sep = document.createElement('span');
    sep.className = 'text-white/15 text-[10px] font-mono';
    sep.textContent = '|';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'True-Scale Cosmic Comparison';
    btn.className = [
      'cursor-pointer flex items-center gap-1.5 py-1',
      'bg-transparent border-0 text-slate-400/80 hover:text-cyan-200',
      'text-[10px] tracking-[0.24em] uppercase font-mono',
      'transition-colors duration-200'
    ].join(' ');
    btn.style.textShadow = '0 1px 6px rgba(0,0,0,0.85)';
    btn.innerHTML = `
      <svg width="13" height="9" viewBox="0 0 14 10" fill="none" class="opacity-75">
        <circle cx="3.2" cy="5.5" r="2.0" stroke="currentColor" stroke-width="1"/>
        <circle cx="9.6" cy="5" r="3.4" stroke="currentColor" stroke-width="1"/>
      </svg>
      <span>SCALE</span>
    `;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCompare();
    });

    wrap.append(sep, btn);

    if (logoPill && logoPill.parentElement === header) {
      const leftGroup = document.createElement('div');
      leftGroup.className = 'flex items-center pointer-events-none';
      header.insertBefore(leftGroup, logoPill);
      leftGroup.appendChild(logoPill);
      leftGroup.appendChild(wrap);
    } else {
      header.appendChild(wrap);
    }
  }

  function buildOverlayDOM() {
    if (overlayEl) return;
    const stale = document.getElementById('nova-compare-overlay');
    if (stale) stale.remove();

    overlayEl = document.createElement('div');
    overlayEl.id = 'nova-compare-overlay';
    overlayEl.className = [
      'fixed inset-0 z-50 hidden flex-col justify-between',
      'bg-[#020408]/95 backdrop-blur-xl text-slate-200 font-mono select-none',
      'opacity-0 transition-opacity duration-300'
    ].join(' ');

    overlayEl.innerHTML = `
      <canvas id="nova-compare-canvas" class="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"></canvas>

      <!-- Top Bar (Borderless Typography) -->
      <div class="relative z-10 flex items-center justify-between px-6 pt-5 pointer-events-none" style="text-shadow: 0 1px 8px rgba(0,0,0,0.9);">
        <div class="flex items-center gap-3">
          <span class="text-[10px] tracking-[0.26em] uppercase text-cyan-300/85">TRUE-SCALE COMPARISON</span>
          <span class="text-white/15 text-[10px]">/</span>
          <span id="compare-tier-subtitle" class="text-[10px] tracking-[0.18em] uppercase text-slate-400">ALL TIERS</span>
        </div>
        <div class="flex items-center gap-5 pointer-events-auto">
          <div id="compare-presets" class="hidden md:flex items-center gap-4"></div>
          <span class="hidden md:inline text-white/15 text-[10px]">|</span>
          <button id="compare-close-btn" type="button" class="bg-transparent border-0 text-[10px] tracking-[0.22em] uppercase text-slate-400 hover:text-white transition-colors cursor-pointer">
            ESC &times;
          </button>
        </div>
      </div>

      <!-- Bottom Telemetry & Pickers (Borderless Typography) -->
      <div class="relative z-10 flex flex-col items-center gap-2 pb-6 px-4 pointer-events-none" style="text-shadow: 0 1px 10px rgba(0,0,0,0.95);">
        <div class="pointer-events-auto flex flex-wrap items-center justify-center gap-4">
          <div class="flex items-center gap-2.5">
            <div class="relative inline-flex items-center gap-1 group">
              <span id="compare-name-a" style="color:#ffffff;display:inline-block;" class="whitespace-nowrap text-xs tracking-[0.18em] uppercase text-white group-hover:text-cyan-200 transition-colors"></span>
              <svg width="9" height="6" viewBox="0 0 9 6" fill="none" class="text-slate-400 group-hover:text-cyan-300 transition-colors shrink-0">
                <path d="M1 1L4.5 4.5L8 1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <select id="compare-select-a" aria-label="First body" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"></select>
            </div>
            <span id="compare-km-a" class="text-[11px] text-slate-400"></span>
          </div>

          <div class="flex items-center gap-2.5 px-3 border-x border-white/15">
            <span id="compare-ratio" style="color:#67e8f9;display:inline-block;" class="text-xs font-semibold text-cyan-300 tracking-wider"></span>
            <button id="compare-swap-btn" type="button" title="Swap" class="bg-transparent border-0 text-slate-400 hover:text-cyan-300 text-xs transition-colors cursor-pointer">&#8646;</button>
          </div>

          <div class="flex items-center gap-2.5">
            <div class="relative inline-flex items-center gap-1 group">
              <span id="compare-name-b" style="color:#ffffff;display:inline-block;" class="whitespace-nowrap text-xs tracking-[0.18em] uppercase text-white group-hover:text-cyan-200 transition-colors"></span>
              <svg width="9" height="6" viewBox="0 0 9 6" fill="none" class="text-slate-400 group-hover:text-cyan-300 transition-colors shrink-0">
                <path d="M1 1L4.5 4.5L8 1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <select id="compare-select-b" aria-label="Second body" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"></select>
            </div>
            <span id="compare-km-b" class="text-[11px] text-slate-400"></span>
          </div>
        </div>
        <div class="text-[9px] tracking-[0.22em] uppercase text-slate-500">
          DRAG TO ORBIT &bull; SCROLL TO ZOOM &bull; S SWAP &bull; &larr;/&rarr; PRESETS
        </div>
      </div>
    `;

    document.body.appendChild(overlayEl);

    overlayEl.querySelector('#compare-close-btn').addEventListener('click', closeCompare);
    overlayEl.querySelector('#compare-swap-btn').addEventListener('click', () => {
      const tmp = currentIdA;
      currentIdA = currentIdB;
      currentIdB = tmp;
      renderPair();
    });

    overlayEl.querySelector('#compare-select-a').addEventListener('change', (e) => {
      currentIdA = e.target.value;
      renderPair();
    });
    overlayEl.querySelector('#compare-select-b').addEventListener('change', (e) => {
      currentIdB = e.target.value;
      renderPair();
    });

    const canvas = overlayEl.querySelector('#nova-compare-canvas');
    canvas.addEventListener('dblclick', () => {
      targetYaw = 0.18;
      targetPitch = 0.12;
      targetDist = 9.5;
      targetPanX = 0;
    });

    window.addEventListener('keydown', (e) => {
      if (!overlayEl || overlayEl.classList.contains('hidden') || overlayEl.style.display === 'none') return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;

      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const tmp = currentIdA;
        currentIdA = currentIdB;
        currentIdB = tmp;
        renderPair();
      } else if (key === 'r') {
        e.preventDefault();
        e.stopImmediatePropagation();
        targetYaw = 0.18;
        targetPitch = 0.12;
        targetDist = 9.5;
        targetPanX = 0;
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const idx = CYCLE_PAIRS.findIndex(([a, b]) =>
          (a === currentIdA && b === currentIdB) || (a === currentIdB && b === currentIdA)
        );
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const nextIdx = idx === -1 ? 0 : (idx + dir + CYCLE_PAIRS.length) % CYCLE_PAIRS.length;
        currentIdA = CYCLE_PAIRS[nextIdx][0];
        currentIdB = CYCLE_PAIRS[nextIdx][1];
        renderPair();
      }
    }, true);

    canvas.addEventListener('pointerdown', (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('pointermove', (e) => {
      if (!isDragging || !isOpen) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      targetYaw -= dx * 0.006;
      targetPitch = Math.max(-1.1, Math.min(1.1, targetPitch + dy * 0.006));
    });
    window.addEventListener('pointerup', () => { isDragging = false; });
    canvas.addEventListener('wheel', (e) => {
      if (!isOpen) return;
      e.preventDefault();
      targetDist = Math.max(1.0, Math.min(40, targetDist * (1 + e.deltaY * 0.0012)));
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (isOpen && e.key === 'Escape') {
        e.stopPropagation();
        closeCompare();
      }
    });
  }

  function initThreeStage() {
    if (renderer) return;
    const canvas = overlayEl.querySelector('#nova-compare-canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.005, 250);

    const ambient = new THREE.AmbientLight(0xffffff, 0.72);
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.55);
    const keyLight = new THREE.DirectionalLight(0xfff8ee, 2.1);
    keyLight.position.set(8, 5, 10);
    const rimLight = new THREE.DirectionalLight(0x66ccff, 0.55);
    rimLight.position.set(-8, -3, -6);
    scene.add(ambient, hemi, keyLight, rimLight);

    const starCount = 450;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 45 + Math.random() * 45;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x94a3b8, size: 0.14, transparent: true, opacity: 0.45 });
    scene.add(new THREE.Points(starGeo, starMat));

    pairGroup = new THREE.Group();
    scene.add(pairGroup);

    window.addEventListener('resize', () => {
      if (!isOpen || !renderer || !camera) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function populatePickers(bodies) {
    const selA = overlayEl.querySelector('#compare-select-a');
    const selB = overlayEl.querySelector('#compare-select-b');

    let html = '';
    [1, 2].forEach((tier) => {
      const group = bodies.filter((b) => b.tier === tier);
      if (!group.length) return;
      html += `<optgroup label="${TIER_LABELS[tier]}" class="bg-slate-950 text-slate-400">`;
      group.forEach((b) => {
        html += `<option value="${b.id}" class="bg-slate-950 text-white">${b.name}</option>`;
      });
      html += '</optgroup>';
    });

    selA.innerHTML = html;
    selB.innerHTML = html;

    const presetsEl = overlayEl.querySelector('#compare-presets');
    const ids = new Set(bodies.map((b) => b.id));
    presetsEl.innerHTML = '';
    PRESETS.forEach(([a, b, label]) => {
      if (!ids.has(a) || !ids.has(b)) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bg-transparent border-0 text-[9px] tracking-[0.18em] uppercase text-slate-400/80 hover:text-cyan-200 transition-colors cursor-pointer';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        currentIdA = a;
        currentIdB = b;
        renderPair();
      });
      presetsEl.appendChild(btn);
    });
  }

  function renderPair() {
    const bodies = getAvailableBodies();
    const map = new Map(bodies.map((b) => [b.id, b]));
    const bodyA = map.get(currentIdA) || bodies[0];
    const bodyB = map.get(currentIdB) || bodies[1];
    if (!bodyA || !bodyB) return;

    currentIdA = bodyA.id;
    currentIdB = bodyB.id;

    const selA = overlayEl.querySelector('#compare-select-a');
    const selB = overlayEl.querySelector('#compare-select-b');
    const labelA = overlayEl.querySelector('#compare-name-a');
    const labelB = overlayEl.querySelector('#compare-name-b');
    const kmA = overlayEl.querySelector('#compare-km-a');
    const kmB = overlayEl.querySelector('#compare-km-b');
    const ratioEl = overlayEl.querySelector('#compare-ratio');

    if (selA) selA.value = bodyA.id;
    if (selB) selB.value = bodyB.id;
    if (labelA) labelA.textContent = bodyA.name;
    if (labelB) labelB.textContent = bodyB.name;
    if (kmA) kmA.textContent = formatSpan(bodyA.diameterKm);
    if (kmB) kmB.textContent = formatSpan(bodyB.diameterKm);
    if (ratioEl) ratioEl.textContent = formatRatio(bodyA.diameterKm, bodyB.diameterKm);

    const sub = overlayEl.querySelector('#compare-tier-subtitle');
    if (sub) {
      sub.textContent = bodyA.tier === bodyB.tier
        ? TIER_LABELS[bodyA.tier]
        : `${TIER_LABELS[bodyA.tier]} vs ${TIER_LABELS[bodyB.tier]}`;
    }

    while (pairGroup.children.length > 0) {
      pairGroup.remove(pairGroup.children[0]);
    }
    reticleMesh = null;

    const maxD = Math.max(bodyA.diameterKm, bodyB.diameterKm);
    const maxVisualR = 2.4;
    // Keep extreme ratios mathematically true while preventing WebGL zero-scale NaN
    const rA = Math.max(0.0005, maxVisualR * (bodyA.diameterKm / maxD));
    const rB = Math.max(0.0005, maxVisualR * (bodyB.diameterKm / maxD));

    meshA = buildCleanBodyClone(bodyA.mesh, bodyA.shape);
    meshB = buildCleanBodyClone(bodyB.mesh, bodyB.shape);
    meshA.scale.setScalar(rA);
    meshB.scale.setScalar(rB);

    const extentA = getFullHorizontalExtent(meshA, rA);
    const extentB = getFullHorizontalExtent(meshB, rB);
    const gap = Math.max(0.7, (extentA + extentB) * 0.18);

    const totalWidth = extentA * 2 + gap + extentB * 2;
    const xA = -totalWidth / 2 + extentA;
    const xB = totalWidth / 2 - extentB;
    meshA.position.set(xA, 0, 0);
    meshB.position.set(xB, 0, 0);

    pairGroup.add(meshA, meshB);

    const ratio = maxD / Math.min(bodyA.diameterKm, bodyB.diameterKm);
    if (ratio > 15) {
      const smallX = rA < rB ? xA : xB;
      const smallR = Math.min(rA, rB);
      const ringGeo = new THREE.RingGeometry(Math.max(smallR * 2.2, 0.14), Math.max(smallR * 2.45, 0.165), 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      });
      reticleMesh = new THREE.Mesh(ringGeo, ringMat);
      reticleMesh.position.set(smallX, 0, 0);
      pairGroup.add(reticleMesh);
    }

    targetYaw = 0.15;
    targetPitch = 0.12;
    targetPanX = 0;
    targetDist = Math.max(7.2, totalWidth * 1.42);
  }

  function animate() {
    if (!isOpen) return;
    animId = requestAnimationFrame(animate);

    yaw += (targetYaw - yaw) * 0.08;
    pitch += (targetPitch - pitch) * 0.08;
    dist += (targetDist - dist) * 0.08;
    panX += (targetPanX - panX) * 0.08;

    camera.position.set(
      panX + dist * Math.sin(yaw) * Math.cos(pitch),
      dist * Math.sin(pitch),
      dist * Math.cos(yaw) * Math.cos(pitch)
    );
    camera.lookAt(panX, 0, 0);

    if (meshA) meshA.rotation.y += 0.0022;
    if (meshB) meshB.rotation.y += 0.0018;
    if (reticleMesh) {
      reticleMesh.lookAt(camera.position);
      const pulse = 1 + Math.sin(performance.now() * 0.004) * 0.08;
      reticleMesh.scale.setScalar(pulse);
    }

    renderer.render(scene, camera);
  }

  function resolveBodyId(query, bodies) {
    if (!query) return null;
    const q = String(query).toLowerCase().trim();
    if (q === 'sol') return 'sun';
    if (q === 'sgr' || q === 'sgra' || q === 'sgr-a') return 'sagittarius-a-star';
    if (q === 'm87') return 'messier-87';
    if (q === 'm31') return 'andromeda';
    if (q === 'm33') return 'triangulum';
    const exact = bodies.find((b) => b.id === q || b.name.toLowerCase() === q);
    if (exact) return exact.id;
    const partial = bodies.find((b) => b.id.startsWith(q) || b.name.toLowerCase().includes(q));
    return partial ? partial.id : null;
  }

  function openCompare(optA, optB) {
    const bodies = getAvailableBodies();
    if (bodies.length < 2) return;

    buildOverlayDOM();
    initThreeStage();
    populatePickers(bodies);

    const resolvedA = resolveBodyId(optA, bodies);
    const resolvedB = resolveBodyId(optB, bodies);
    const active = typeof getActiveTarget === 'function' ? getActiveTarget() : null;
    const activeId = active && active.id ? active.id.toLowerCase() : '';

    if (resolvedA && resolvedB) {
      currentIdA = resolvedA;
      currentIdB = resolvedB;
    } else if (resolvedA) {
      const bodyA = bodies.find((b) => b.id === resolvedA);
      currentIdA = resolvedA;
      currentIdB = bodyA ? pickSmartPartner(bodyA, bodies) : 'earth';
    } else if (activeId && COSMIC_CATALOG[activeId]) {
      const bodyA = bodies.find((b) => b.id === activeId);
      currentIdA = activeId;
      currentIdB = bodyA ? pickSmartPartner(bodyA, bodies) : 'earth';
    } else {
      currentIdA = 'earth';
      currentIdB = 'jupiter';
    }

    isOpen = true;
    overlayEl.classList.remove('hidden');
    overlayEl.classList.add('flex');
    requestAnimationFrame(() => {
      overlayEl.classList.remove('opacity-0');
      overlayEl.classList.add('opacity-100');
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderPair();
    animate();
  }

  function closeCompare() {
    if (!isOpen || !overlayEl) return;
    isOpen = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    overlayEl.classList.remove('opacity-100');
    overlayEl.classList.add('opacity-0');
    setTimeout(() => {
      if (!isOpen && overlayEl) {
        overlayEl.classList.add('hidden');
        overlayEl.classList.remove('flex');
      }
    }, 300);
  }

  injectTopBarButton();
  window.openScaleCompare = openCompare;
  window.novaScaleIds = new Set(Object.keys(COSMIC_CATALOG));
  return { openCompare, closeCompare };
}
