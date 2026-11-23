import * as THREE from 'three';

let cmbSphere = null;
let cmbMaterial = null;
let cmbColorsAttribute = null;

export function buildVolumetricOortCloud(scene, createRoundParticleTexture) {
  let oortCloudGroup;
  oortCloudGroup = new THREE.Group();
  const particleCount = 2800;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i += 3) {
    const radius = 78.0 + Math.random() * 14.0;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i + 2] = radius * Math.cos(phi);
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xa5f3fc,
    size: 0.25,
    map: createRoundParticleTexture(),
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const pts = new THREE.Points(geo, mat);
  pts.raycast = () => {};
  oortCloudGroup.add(pts);
  scene.add(oortCloudGroup);
  return oortCloudGroup;
}

export function buildMilkyWaySpiral(scene, createRoundParticleTexture) {
  let milkyWayGroup;
  milkyWayGroup = new THREE.Group();
  milkyWayGroup.position.set(0, -3, -290);

  const particleCount = 24000;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const arms = 2;

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    const isBulge = Math.random() < 0.24;

    if (isBulge) {
      const r = 7.0 + Math.pow(Math.random(), 1.4) * 11.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.4;

      positions[i3] = r * Math.cos(theta) * Math.cos(phi);
      positions[i3 + 1] = r * Math.sin(phi) * 0.45;
      positions[i3 + 2] = r * Math.sin(theta) * Math.cos(phi);

      colors[i3] = 1.0;
      colors[i3 + 1] = 0.88;
      colors[i3 + 2] = 0.62;
    } else {
      const r = 16.0 + Math.pow(Math.random(), 1.7) * 55;
      const armIndex = i % arms;
      const armSpread = (Math.random() - 0.5) * (0.32 + (r / 95));
      const angle = (armIndex * Math.PI) + (r * 0.11) + armSpread;

      positions[i3] = Math.cos(angle) * r;
      positions[i3 + 1] = (Math.random() - 0.5) * (6.5 * Math.exp(-r / 32));
      positions[i3 + 2] = Math.sin(angle) * r;

      colors[i3] = 0.35 + (Math.random() * 0.35);
      colors[i3 + 1] = 0.65;
      colors[i3 + 2] = 1.0;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 1.15,
    map: createRoundParticleTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const pts = new THREE.Points(geometry, material);
  pts.raycast = () => {};
  milkyWayGroup.add(pts);
  scene.add(milkyWayGroup);
  return milkyWayGroup;
}

export function buildAndromedaSpiral(scene, createRoundParticleTexture, andromedaBasePos) {
  let andromedaGroup;
  andromedaGroup = new THREE.Group();
  andromedaGroup.position.copy(andromedaBasePos);
  andromedaGroup.rotation.x = Math.PI / 3.2;
  andromedaGroup.rotation.z = Math.PI / 5;

  const particleCount = 14000;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    const isCore = Math.random() < 0.2;
    if (isCore) {
      const u = Math.random();
      const r = 2.0 + Math.sqrt(-2.0 * Math.log(u || 0.0001)) * 3.5;
      const theta = Math.random() * Math.PI * 2;
      positions[i3] = r * Math.cos(theta);
      positions[i3 + 1] = (Math.random() - 0.5) * 2.0;
      positions[i3 + 2] = r * Math.sin(theta);

      colors[i3] = 0.95; colors[i3 + 1] = 0.85; colors[i3 + 2] = 0.7;
    } else {
      const r = 4.0 + Math.pow(Math.random(), 1.6) * 45;
      const armIndex = i % 2;
      const angle = (armIndex * Math.PI) + (r * 0.13) + (Math.random() - 0.5) * 0.4;

      positions[i3] = Math.cos(angle) * r;
      positions[i3 + 1] = (Math.random() - 0.5) * (5.0 * Math.exp(-r / 25));
      positions[i3 + 2] = Math.sin(angle) * r;

      colors[i3] = 0.75; colors[i3 + 1] = 0.5; colors[i3 + 2] = 1.0;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 1.1,
    map: createRoundParticleTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const pts = new THREE.Points(geometry, material);
  pts.raycast = () => {};
  andromedaGroup.add(pts);
  scene.add(andromedaGroup);
  return andromedaGroup;
}

export function buildTriangulumSpiral(scene, createRoundParticleTexture) {
  let triangulumGroup;
  triangulumGroup = new THREE.Group();
  triangulumGroup.position.set(450, 48, -330);
  triangulumGroup.rotation.x = Math.PI / 4;
  triangulumGroup.rotation.y = Math.PI / 6;

  const particleCount = 8000;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    const r = 2.0 + Math.pow(Math.random(), 1.5) * 25;
    const armIndex = i % 2;
    const angle = (armIndex * Math.PI) + (r * 0.16) + (Math.random() - 0.5) * 0.35;

    positions[i3] = Math.cos(angle) * r;
    positions[i3 + 1] = (Math.random() - 0.5) * (3.0 * Math.exp(-r / 18));
    positions[i3 + 2] = Math.sin(angle) * r;

    colors[i3] = 0.2;
    colors[i3 + 1] = 0.75;
    colors[i3 + 2] = 0.85;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 1.0,
    map: createRoundParticleTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const pts = new THREE.Points(geometry, material);
  pts.raycast = () => {};
  triangulumGroup.add(pts);
  scene.add(triangulumGroup);
  return triangulumGroup;
}

// Subtle, Translucent Electric Fractal Cosmic Web
export function buildNASAHubbleCosmicWeb(scene, createRoundParticleTexture, isCosmicWebVisible = true) {
  let cosmicWebGroup;
  cosmicWebGroup = new THREE.Group();
  const filamentFlowParticles = [];
  window._filamentPulses = [];

  // Deterministic PRNG for structured fractal repeatability
  let seed = 421337;
  function fRand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  // Helper matching applyCosmicDepthProportions() so Cosmic Web filaments reach exact positions of furthest objects
  function computeRescaledTargetPos(id, rawPos, tier) {
    const x = rawPos[0], y = rawPos[1], z = rawPos[2];
    const currentDist = Math.sqrt(x * x + y * y + z * z) || 1.0;
    const ux = x / currentDist, uy = y / currentDist, uz = z / currentDist;
    const targetDist = (tier === 4 || id === 'great-attractor')
      ? (2800 + currentDist * 8.5)
      : (1100 + currentDist * 5.2);
    const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const verticalSpread = Math.sin(hash * 1.37) * 0.38;
    const ny = uy + verticalSpread;
    const norm = Math.sqrt(ux * ux + ny * ny + uz * uz) || 1.0;
    return new THREE.Vector3((ux / norm) * targetDist, (ny / norm) * targetDist, (uz / norm) * targetDist);
  }

  // 1. Multi-Shell Supercluster Attractor Nodes spanning from Local Group (380) to Deep Cosmic Horizon (~7,850)
  const nodes = [];
  // Inner shell: Local Group & nearby supercluster web (r = 380 .. 2,150)
  const innerCount = 82;
  for (let i = 0; i < innerCount; i++) {
    const u = fRand(), v = fRand();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = 380 + fRand() * 1770;
    nodes.push(new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.65,
      r * Math.cos(phi)
    ));
  }

  // Mid-deep shell: Laniakea, Shapley, and Coma-scale filaments (r = 2,100 .. 5,300)
  const midCount = 58;
  for (let i = 0; i < midCount; i++) {
    const u = fRand(), v = fRand();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = 2100 + fRand() * 3200;
    nodes.push(new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.72,
      r * Math.cos(phi)
    ));
  }

  // Outer horizon shell: High-redshift protocluster web reaching the furthest objects (r = 5,100 .. 7,850)
  const outerCount = 44;
  for (let i = 0; i < outerCount; i++) {
    const u = fRand(), v = fRand();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = 5100 + fRand() * 2750;
    nodes.push(new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.78,
      r * Math.cos(phi)
    ));
  }

  // Anchor nodes at the exact rescaled coordinates of Tier 3 & Tier 4 celestial objects (including furthest map objects)
  const deepCatalogAnchors = [
    { id: 'andromeda', pos: [380, 105, -255], tier: 3 },
    { id: 'triangulum', pos: [450, 48, -330], tier: 3 },
    { id: 'sombrero-galaxy', pos: [-335, 135, -380], tier: 3 },
    { id: 'centaurus-a', pos: [-510, 220, 175], tier: 3 },
    { id: 'messier-87', pos: [-285, 410, -510], tier: 3 },
    { id: 'great-attractor', pos: [-660, -175, -445], tier: 3 },
    { id: 'shapley-supercluster', pos: [-605, -540, 650], tier: 4 },
    { id: 'el-gordo', pos: [825, -350, -605], tier: 4 },
    { id: 'smacs-0723', pos: [460, 730, 985], tier: 4 },
    { id: 'ton-618', pos: [-985, -445, 890], tier: 4 },
    { id: 'earendel', pos: [670, -540, 1240], tier: 4 },
    { id: 'gn-z11', pos: [0, 0, 1500], tier: 4 }
  ];

  const anchorVectors = deepCatalogAnchors.map(item => computeRescaledTargetPos(item.id, item.pos, item.tier));
  anchorVectors.forEach(vec => nodes.push(vec));

  // Create organic stepping-stone bridge nodes from the inner web out to each furthest Tier 4 anchor so filaments visibly reach them
  anchorVectors.forEach(targetVec => {
    const distFromCore = targetVec.length();
    if (distFromCore > 2400) {
      const dir = targetVec.clone().normalize();
      const steps = 4;
      let prevPt = dir.clone().multiplyScalar(1450);
      nodes.push(prevPt);
      for (let s = 1; s < steps; s++) {
        const frac = s / steps;
        const radialDist = 1450 + frac * (distFromCore - 1450);
        const stepPt = dir.clone().multiplyScalar(radialDist);
        // Organic lateral offset so the filament bridge winds naturally through 3D space
        stepPt.x += (fRand() - 0.5) * 420;
        stepPt.y += (fRand() - 0.5) * 320;
        stepPt.z += (fRand() - 0.5) * 420;
        nodes.push(stepPt);
        prevPt = stepPt;
      }
    }
  });

  // 2. Recursive Midpoint-Displacement Fractal Bolt Generator
  function generateFractalBolt(pStart, pEnd, depth, jitterScale) {
    let pts = [pStart.clone(), pEnd.clone()];
    let currentJitter = jitterScale;
    for (let d = 0; d < depth; d++) {
      const nextPts = [pts[0]];
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k];
        const b = pts[k + 1];
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.x += (fRand() - 0.5) * currentJitter;
        mid.y += (fRand() - 0.5) * currentJitter;
        mid.z += (fRand() - 0.5) * currentJitter;
        nextPts.push(mid, b);
      }
      pts = nextPts;
      currentJitter *= 0.52;
    }
    return pts;
  }

  // 3. Subtle, Translucent Electric Fractal Palette (Never overpowers foreground objects)
  const coreFilamentMat = new THREE.LineBasicMaterial({
    color: 0xf472b6,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const outerFilamentMat = new THREE.LineBasicMaterial({
    color: 0xd946ef,
    transparent: true,
    opacity: 0.11,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const branchFilamentMat = new THREE.LineBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0.07,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  window._cosmicMaterials = { 
    core: coreFilamentMat, 
    outer: outerFilamentMat, 
    branch: branchFilamentMat 
  };

  const pulseHaloGeo = new THREE.SphereGeometry(2.1, 8, 8);
  const pulseHaloMat = new THREE.MeshBasicMaterial({
    color: 0xe879f9,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  function addFractalConduit(pA, pB, dist) {
    const boltPts = generateFractalBolt(pA, pB, 4, dist * 0.20);
    const boltGeom = new THREE.BufferGeometry().setFromPoints(boltPts);

    const coreLine = new THREE.Line(boltGeom, coreFilamentMat);
    coreLine.raycast = () => {};
    cosmicWebGroup.add(coreLine);

    const sheathPts = generateFractalBolt(pA, pB, 4, dist * 0.24);
    const sheathGeom = new THREE.BufferGeometry().setFromPoints(sheathPts);
    const sheathLine = new THREE.Line(sheathGeom, outerFilamentMat);
    sheathLine.raycast = () => {};
    cosmicWebGroup.add(sheathLine);

    const branchReach = Math.max(85, dist * 0.14);
    const branchCount = 1 + Math.floor(fRand() * 2);
    for (let b = 0; b < branchCount; b++) {
      const pickIdx = 3 + Math.floor(fRand() * (boltPts.length - 6));
      const branchOrigin = boltPts[pickIdx];
      const branchDir = new THREE.Vector3(
        (fRand() - 0.5) * branchReach,
        (fRand() - 0.5) * (branchReach * 0.75),
        (fRand() - 0.5) * branchReach
      );
      const branchTarget = branchOrigin.clone().add(branchDir);
      const subPts = generateFractalBolt(branchOrigin, branchTarget, 3, branchReach * 0.28);
      const subGeom = new THREE.BufferGeometry().setFromPoints(subPts);
      const subLine = new THREE.Line(subGeom, branchFilamentMat);
      subLine.raycast = () => {};
      cosmicWebGroup.add(subLine);
    }

    if (fRand() > 0.48) {
      const boltCurve = new THREE.CatmullRomCurve3(boltPts);
      const pulseGroup = new THREE.Group();
      const sparkPts = [
        new THREE.Vector3(0, 0, -4.5),
        new THREE.Vector3(1.0, 0.8, -2.0),
        new THREE.Vector3(-0.8, -0.7, 0.0),
        new THREE.Vector3(0.6, 0.5, 2.0),
        new THREE.Vector3(0, 0, 4.5)
      ];
      const sparkGeo = new THREE.BufferGeometry().setFromPoints(sparkPts);
      const sparkMat = new THREE.LineBasicMaterial({
        color: 0xff33bb,
        transparent: true,
        opacity: 0.325,
        blending: THREE.AdditiveBlending
      });
      const sparkLine = new THREE.Line(sparkGeo, sparkMat);
      sparkLine.raycast = () => {};
      pulseGroup.add(sparkLine);

      const pHalo = new THREE.Mesh(pulseHaloGeo, pulseHaloMat);
      pHalo.raycast = () => {};
      pulseGroup.add(pHalo);
      cosmicWebGroup.add(pulseGroup);

      const pulseItem = {
        mesh: pulseGroup,
        curve: boltCurve,
        progress: fRand(),
        speed: 0.0014 + fRand() * 0.0022,
        sparkMat: sparkMat,
        haloMat: pulseHaloMat
      };
      filamentFlowParticles.push(pulseItem);
      window._filamentPulses.push(pulseItem);
    }
  }

  // 4. Connect Supercluster Nodes with Adaptive Radial Thresholds across Inner, Mid, and Deep Horizon Shells
  const connectedPairs = new Set();
  for (let i = 0; i < nodes.length; i++) {
    const rA = nodes[i].length();
    for (let j = i + 1; j < nodes.length; j++) {
      const rB = nodes[j].length();
      const maxR = Math.max(rA, rB);
      const dist = nodes[i].distanceTo(nodes[j]);

      // Scale connection span with radial depth so both inner and deep-horizon shells form a continuous web
      const minSpan = maxR < 2200 ? 240 : (maxR < 5200 ? 480 : 650);
      const maxSpan = maxR < 2200 ? 640 : (maxR < 5200 ? 1580 : 2250);

      if (dist > minSpan && dist < maxSpan) {
        connectedPairs.add(`${i}-${j}`);
        addFractalConduit(nodes[i], nodes[j], dist);
      }
    }
  }

  // Ensure every deep catalog anchor (GN-z11, Earendel, TON 618, SMACS 0723, El Gordo, Shapley, etc.)
  // has at least 3 direct cosmic web filament conduits connecting it into the broader network
  anchorVectors.forEach(anchorPt => {
    const anchorIdx = nodes.indexOf(anchorPt);
    const candidates = [];
    for (let k = 0; k < nodes.length; k++) {
      if (k === anchorIdx) continue;
      const d = anchorPt.distanceTo(nodes[k]);
      if (d > 180) candidates.push({ idx: k, dist: d });
    }
    candidates.sort((a, b) => a.dist - b.dist);
    for (let c = 0; c < Math.min(3, candidates.length); c++) {
      const otherIdx = candidates[c].idx;
      const key = anchorIdx < otherIdx ? `${anchorIdx}-${otherIdx}` : `${otherIdx}-${anchorIdx}`;
      if (!connectedPairs.has(key)) {
        connectedPairs.add(key);
        addFractalConduit(anchorPt, nodes[otherIdx], candidates[c].dist);
      }
    }
  });

  function makeSubtleNodeSprite(rgbaColor, scaleSize) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0.0, rgbaColor);
    grad.addColorStop(0.4, rgbaColor);
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scaleSize, scaleSize, 1.0);
    return sprite;
  }

  // 5. Subtle Supercluster Intersection Nodes (scaled gently for deep-horizon visibility)
  nodes.forEach(pt => {
    const rScale = pt.length() > 2500 ? 2.2 : 1.0;
    const outerAura = makeSubtleNodeSprite('rgba(232, 121, 249, 0.18)', 9.0 * rScale);
    outerAura.position.copy(pt);
    outerAura.raycast = () => {};
    cosmicWebGroup.add(outerAura);

    const hotCore = makeSubtleNodeSprite('rgba(253, 242, 248, 0.32)', 3.8 * rScale);
    hotCore.position.copy(pt);
    hotCore.raycast = () => {};
    cosmicWebGroup.add(hotCore);
  });

  cosmicWebGroup.visible = typeof isCosmicWebVisible !== 'undefined' ? isCosmicWebVisible : true;
  scene.add(cosmicWebGroup);
  return { cosmicWebGroup, filamentFlowParticles };
}

export function buildDelicateAuroraCMB(scene) {
  // Base radius 12,500; auto-scales on first active frame to 1.18x the furthest deep-space object
  const BASE_RADIUS = 12500;
  const PARTICLE_COUNT = 5800;

  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const phases = new Float32Array(PARTICLE_COUNT);

  // Fibonacci sphere base + 22% volumetric radial band (0.90x - 1.12x) for 3D depth without starfield washout
  const goldenAngle = Math.PI * (3.0 - Math.sqrt(5.0));
  const cInner = new THREE.Color(0xff6b3d); // luminous cosmological orange-crimson
  const cMid   = new THREE.Color(0xe6392e); // vivid redshift crimson
  const cOuter = new THREE.Color(0x7a1b28); // deep ruby outer edge
  const tmpCol = new THREE.Color();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const yNorm = 1.0 - (i / (PARTICLE_COUNT - 1)) * 2.0;
    const rRing = Math.sqrt(Math.max(0.0, 1.0 - yNorm * yNorm));
    const theta = goldenAngle * i + (Math.random() - 0.5) * 0.30;

    const u = (Math.random() + Math.random()) * 0.5; // bell-curved 0..1
    const r = BASE_RADIUS * (0.90 + u * 0.22);

    const i3 = i * 3;
    positions[i3]     = Math.cos(theta) * rRing * r;
    positions[i3 + 1] = yNorm * r;
    positions[i3 + 2] = Math.sin(theta) * rRing * r;

    if (u < 0.45) {
      tmpCol.lerpColors(cInner, cMid, u / 0.45);
    } else {
      tmpCol.lerpColors(cMid, cOuter, (u - 0.45) / 0.55);
    }
    colors[i3]     = tmpCol.r;
    colors[i3 + 1] = tmpCol.g;
    colors[i3 + 2] = tmpCol.b;

    sizes[i] = 26.0 + Math.pow(Math.random(), 2.0) * 74.0;
    phases[i] = Math.random() * Math.PI * 2.0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  cmbColorsAttribute = geometry.attributes.color;

  cmbMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uOpacity: { value: 0.0 }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      varying vec3 vColor;
      varying float vLimb;
      varying float vPulse;
      uniform float uTime;

      void main() {
        vColor = color;

        float drift = uTime * 0.16 + aPhase;
        vec3 pos = position;
        pos.x += sin(drift) * 55.0;
        pos.y += cos(drift * 0.85) * 55.0;
        pos.z += sin(drift * 0.7 + 1.3) * 55.0;

        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vec3 normalDir = normalize(worldPos.xyz);
        vec3 viewDir = normalize(cameraPosition - worldPos.xyz);

        // Tightened limb falloff: clean transparent center, glowing curved boundary
        float ndotv = abs(dot(normalDir, viewDir));
        vLimb = mix(0.08, 1.0, pow(1.0 - ndotv, 2.8));
        vPulse = 0.82 + 0.18 * sin(uTime * 0.85 + aPhase * 2.0);

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp(aSize * (16500.0 / max(100.0, -mvPosition.z)), 2.0, 15.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vLimb;
      varying float vPulse;
      uniform float uOpacity;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;

        float core = exp(-d * d * 24.0);
        float halo = pow(1.0 - d * 2.0, 1.45) * 0.65;
        float alpha = clamp((core + halo) * vLimb * vPulse * uOpacity, 0.0, 1.0);
        gl_FragColor = vec4(vColor * 1.35, alpha);
      }
    `,
    transparent: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  // Expose .opacity so app.js zoom-tier fading works without modifying app.js
  cmbMaterial.opacity = 0.0;

  cmbSphere = new THREE.Points(geometry, cmbMaterial);
  cmbSphere.userData.baseRadius = BASE_RADIUS;
  cmbSphere.userData.autoFitted = false;
  cmbSphere.frustumCulled = false;
  cmbSphere.raycast = () => {};
  cmbSphere.visible = true;

  // Razor-thin Fresnel Rim Mesh — defines the spherical horizon silhouette cleanly
  const rimGeo = new THREE.SphereGeometry(BASE_RADIUS, 96, 64);
  const rimMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uOpacity: { value: 0.0 }
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      uniform float uTime;
      uniform float uOpacity;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float ndotv = abs(dot(N, V));

        // 100% clear interior, razor-sharp ember glow strictly along the grazing horizon rim
        float fresnel = pow(1.0 - ndotv, 4.2);

        // Subtle high-frequency CMB anisotropy shimmer along the rim
        vec3 dir = normalize(vWorldPos);
        float ripple = 0.85 + 0.15 * sin(dir.x * 18.0 + uTime * 0.25) * cos(dir.y * 18.0 - uTime * 0.2) * sin(dir.z * 18.0);

        vec3 rimColor = mix(vec3(0.55, 0.10, 0.16), vec3(1.0, 0.40, 0.22), fresnel);
        float alpha = clamp(fresnel * ripple * 0.22 * uOpacity, 0.0, 1.0);
        gl_FragColor = vec4(rimColor, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const fresnelRimMesh = new THREE.Mesh(rimGeo, rimMat);
  fresnelRimMesh.raycast = () => {};
  fresnelRimMesh.frustumCulled = false;
  cmbSphere.add(fresnelRimMesh);
  cmbSphere.userData.rimMaterial = rimMat;

  scene.add(cmbSphere);
  return { cmbSphere, cmbMaterial, cmbColorsAttribute };
}

export function updateCMBThermalAcoustics(timeSec) {
  if (!cmbSphere || !cmbMaterial) return;

  // Auto-fit once to ensure every deep-space outlier sits cleanly inside the horizon shell
  if (!cmbSphere.userData.autoFitted && cmbSphere.parent && cmbSphere.parent.children.length > 20) {
    let maxDist = 0;
    for (const child of cmbSphere.parent.children) {
      if (child === cmbSphere || !child.position) continue;
      if (child.userData && child.userData.id) {
        const d = child.position.length();
        if (d > maxDist && d < 60000) maxDist = d;
      }
    }
    if (maxDist > 100) {
      const targetRadius = Math.max(cmbSphere.userData.baseRadius, maxDist * 1.18);
      cmbSphere.scale.setScalar(targetRadius / cmbSphere.userData.baseRadius);
      cmbSphere.userData.autoFitted = true;
    }
  }

  // Normalize app.js opacity (0.0 -> 0.075) to full 0.0 -> 1.0 shader visibility
  const normOpacity = Math.min(1.0, (cmbMaterial.opacity || 0.0) / 0.075);
  cmbSphere.visible = normOpacity > 0.005;
  if (!cmbSphere.visible) return;

  if (cmbMaterial.uniforms) {
    cmbMaterial.uniforms.uTime.value = timeSec;
    cmbMaterial.uniforms.uOpacity.value = normOpacity;
  }
  const rimMat = cmbSphere.userData.rimMaterial;
  if (rimMat && rimMat.uniforms) {
    rimMat.uniforms.uTime.value = timeSec;
    rimMat.uniforms.uOpacity.value = normOpacity;
  }
}
