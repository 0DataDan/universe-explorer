// NOVA True-Scale Solar System Comparison Stage (static/js/compare.js)
import * as THREE from 'three';

// Authoritative mean diameters in kilometers (NASA Planetary Fact Sheet)
const SOLAR_DIAMETERS_KM = {
  sun:     1392700,
  jupiter:  139820,
  saturn:   116460,
  uranus:    50724,
  neptune:   49244,
  earth:     12742,
  venus:     12104,
  mars:       6779,
  mercury:    4879,
  moon:       3474,
  pluto:      2377,
  ceres:       939,
};

const DISPLAY_ORDER = [
  'sun', 'jupiter', 'saturn', 'uranus', 'neptune',
  'earth', 'venus', 'mars', 'mercury', 'moon', 'pluto', 'ceres'
];

const PRESETS = [
  ['earth', 'jupiter'],
  ['earth', 'sun'],
  ['moon', 'earth'],
  ['saturn', 'neptune'],
];

function formatKm(km) {
  return km.toLocaleString('en-US') + ' km';
}

function formatRatio(a, b) {
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  const r = big / small;
  if (r >= 100) return r.toFixed(0) + '×';
  if (r >= 10) return r.toFixed(1) + '×';
  return r.toFixed(2) + '×';
}

function buildCleanPlanetClone(sourceMesh) {
  let baseRadius = 1;
  if (sourceMesh.geometry) {
    sourceMesh.geometry.computeBoundingSphere();
    if (sourceMesh.geometry.boundingSphere && sourceMesh.geometry.boundingSphere.radius > 0) {
      baseRadius = sourceMesh.geometry.boundingSphere.radius;
    }
  }

  const wrapper = new THREE.Group();
  const clone = sourceMesh.clone(true);
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);

  clone.traverse((child) => {
    if (child.isSprite) {
      child.visible = false;
    }
  });

  const norm = 1 / baseRadius;
  clone.scale.setScalar(norm);
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
        if (id && SOLAR_DIAMETERS_KM[id]) {
          byId.set(id, {
            id,
            name: m.userData.name || id.toUpperCase(),
            diameterKm: SOLAR_DIAMETERS_KM[id],
            mesh: m,
          });
        }
      });
    }
    return DISPLAY_ORDER.filter((id) => byId.has(id)).map((id) => byId.get(id));
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
    btn.title = 'True-Scale Solar System Comparison';
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
      // Keep NOVA + SCALE grouped cleanly on the left
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
          <span class="text-[10px] tracking-[0.18em] uppercase text-slate-400">SOLAR SYSTEM</span>
        </div>
        <div class="flex items-center gap-5 pointer-events-auto">
          <div id="compare-presets" class="hidden sm:flex items-center gap-4"></div>
          <span class="hidden sm:inline text-white/15 text-[10px]">|</span>
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
              <span id="compare-label-a" class="text-xs tracking-[0.18em] uppercase text-white group-hover:text-cyan-200 transition-colors"></span>
              <svg width="9" height="6" viewBox="0 0 9 6" fill="none" class="text-slate-400 group-hover:text-cyan-300 transition-colors shrink-0">
                <path d="M1 1L4.5 4.5L8 1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <select id="compare-select-a" aria-label="First body" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"></select>
            </div>
            <span id="compare-km-a" class="text-[11px] text-slate-400"></span>
          </div>

          <div class="flex items-center gap-2.5 px-3 border-x border-white/15">
            <span id="compare-ratio" class="text-xs font-semibold text-cyan-300 tracking-wider"></span>
            <button id="compare-swap-btn" type="button" title="Swap" class="bg-transparent border-0 text-slate-400 hover:text-cyan-300 text-xs transition-colors cursor-pointer">&#8646;</button>
          </div>

          <div class="flex items-center gap-2.5">
            <div class="relative inline-flex items-center gap-1 group">
              <span id="compare-label-b" class="text-xs tracking-[0.18em] uppercase text-white group-hover:text-cyan-200 transition-colors"></span>
              <svg width="9" height="6" viewBox="0 0 9 6" fill="none" class="text-slate-400 group-hover:text-cyan-300 transition-colors shrink-0">
                <path d="M1 1L4.5 4.5L8 1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <select id="compare-select-b" aria-label="Second body" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"></select>
            </div>
            <span id="compare-km-b" class="text-[11px] text-slate-400"></span>
          </div>
        </div>
        <div class="text-[9px] tracking-[0.22em] uppercase text-slate-500">
          DRAG TO ORBIT &bull; SCROLL TO ZOOM
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
      targetDist = Math.max(1.2, Math.min(36, targetDist * (1 + e.deltaY * 0.0012)));
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
    camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.01, 200);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.85);
    keyLight.position.set(8, 5, 10);
    const rimLight = new THREE.DirectionalLight(0x66ccff, 0.45);
    rimLight.position.set(-8, -3, -6);
    scene.add(ambient, keyLight, rimLight);

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
    const opts = bodies.map((b) => `<option value="${b.id}" class="bg-slate-950 text-white">${b.name}</option>`).join('');
    selA.innerHTML = opts;
    selB.innerHTML = opts;

    const presetsEl = overlayEl.querySelector('#compare-presets');
    const ids = new Set(bodies.map((b) => b.id));
    presetsEl.innerHTML = '';
    PRESETS.forEach(([a, b]) => {
      if (!ids.has(a) || !ids.has(b)) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bg-transparent border-0 text-[9px] tracking-[0.18em] uppercase text-slate-400/80 hover:text-cyan-200 transition-colors cursor-pointer';
      btn.textContent = `${a} / ${b}`;
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

    overlayEl.querySelector('#compare-select-a').value = bodyA.id;
    overlayEl.querySelector('#compare-select-b').value = bodyB.id;
    const labelA = overlayEl.querySelector('#compare-label-a');
    const labelB = overlayEl.querySelector('#compare-label-b');
    if (labelA) labelA.textContent = bodyA.name;
    if (labelB) labelB.textContent = bodyB.name;
    overlayEl.querySelector('#compare-km-a').textContent = formatKm(bodyA.diameterKm);
    overlayEl.querySelector('#compare-km-b').textContent = formatKm(bodyB.diameterKm);
    overlayEl.querySelector('#compare-ratio').textContent = formatRatio(bodyA.diameterKm, bodyB.diameterKm);

    while (pairGroup.children.length > 0) {
      pairGroup.remove(pairGroup.children[0]);
    }
    reticleMesh = null;

    const maxD = Math.max(bodyA.diameterKm, bodyB.diameterKm);
    const maxVisualR = 2.4;
    const rA = maxVisualR * (bodyA.diameterKm / maxD);
    const rB = maxVisualR * (bodyB.diameterKm / maxD);

    meshA = buildCleanPlanetClone(bodyA.mesh);
    meshB = buildCleanPlanetClone(bodyB.mesh);
    meshA.scale.setScalar(rA);
    meshB.scale.setScalar(rB);

    // Measure full horizontal extent including rings/halos so objects never intersect
    const extentA = getFullHorizontalExtent(meshA, rA);
    const extentB = getFullHorizontalExtent(meshB, rB);
    const gap = Math.max(0.7, (extentA + extentB) * 0.16);

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
    targetPitch = 0.10;
    targetPanX = 0;
    targetDist = Math.max(7.0, totalWidth * 1.38);
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

    if (meshA) meshA.rotation.y += 0.0028;
    if (meshB) meshB.rotation.y += 0.0022;
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
      currentIdA = resolvedA;
      currentIdB = resolvedA === 'earth' ? 'jupiter' : 'earth';
    } else if (activeId && SOLAR_DIAMETERS_KM[activeId]) {
      currentIdA = activeId;
      currentIdB = activeId === 'earth' ? 'jupiter' : 'earth';
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
  return { openCompare, closeCompare };
}
