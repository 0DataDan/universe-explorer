// NOVA 3D Volumetric Nebula, Dust Lane & Galaxy Cluster Engine
import * as THREE from 'three';
import { fbm3D, ridgedFbm3D, noise3D, colorRamp } from './textures.js';

// === 3D VOLUMETRIC NEBULA, DUST LANE & GALAXY CLUSTER ENGINE ===
    export function createProceduralCloudTexture(drawFn, size = 256) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      drawFn(ctx, size);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    }

    // Per-pixel 2D fBm + ridged multifractal noise with radial edge feathering (ZERO square borders!)
    export function createFbmNebulaTexture(configFn, size = 384) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const imgData = ctx.createImageData(size, size);
      const data = imgData.data;

      for (let py = 0; py < size; py++) {
        const ny = (py / (size - 1)) * 2.0 - 1.0; // -1 to +1
        for (let px = 0; px < size; px++) {
          const nx = (px / (size - 1)) * 2.0 - 1.0; // -1 to +1
          const r2 = nx * nx + ny * ny;
          if (r2 >= 1.0) continue; // Strictly zero alpha outside unit circle -> impossible to have square edges

          const r = Math.sqrt(r2);
          // Smooth quintic radial falloff so edges melt imperceptibly into the starry background
          const radialMask = Math.pow(Math.max(0, 1.0 - r), 2.2);

          const rgba = configFn(nx, ny, r, radialMask);
          const idx = (py * size + px) * 4;
          data[idx]     = Math.max(0, Math.min(255, rgba[0] | 0));
          data[idx + 1] = Math.max(0, Math.min(255, rgba[1] | 0));
          data[idx + 2] = Math.max(0, Math.min(255, rgba[2] | 0));
          data[idx + 3] = Math.max(0, Math.min(255, (rgba[3] * radialMask) | 0));
        }
      }
      ctx.putImageData(imgData, 0, 0);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    }

    export function buildVolumetricCelestialStructures(celestialObjects) {
      // Pinpoint star & distant galaxy sprite with tight core and ultra-soft exponential halo
      const pinpointStarTex = createProceduralCloudTexture((ctx, s) => {
        const cx = s / 2, cy = s / 2;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.48);
        grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(0.08, 'rgba(255, 252, 240, 0.85)');
        grad.addColorStop(0.22, 'rgba(255, 240, 200, 0.25)');
        grad.addColorStop(0.55, 'rgba(200, 220, 255, 0.04)');
        grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.48, 0, Math.PI * 2);
        ctx.fill();
      }, 128);

      // JWST / Hubble 6- and 4-point diffraction spike star sprite for bright embedded OB stars
      const diffractionStarTex = createProceduralCloudTexture((ctx, s) => {
        const cx = s / 2, cy = s / 2;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.45);
        grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(0.12, 'rgba(224, 242, 254, 0.75)');
        grad.addColorStop(0.35, 'rgba(56, 189, 248, 0.15)');
        grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // Crisp diffraction spikes
        ctx.save();
        ctx.translate(cx, cy);
        for (let a of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
          ctx.save();
          ctx.rotate(a);
          const len = (a === 0 || a === Math.PI / 2) ? s * 0.48 : s * 0.26;
          const spk = ctx.createLinearGradient(-len, 0, len, 0);
          spk.addColorStop(0.0, 'rgba(255,255,255,0)');
          spk.addColorStop(0.45, 'rgba(224,242,254,0.45)');
          spk.addColorStop(0.5, 'rgba(255,255,255,0.95)');
          spk.addColorStop(0.55, 'rgba(224,242,254,0.45)');
          spk.addColorStop(1.0, 'rgba(255,255,255,0)');
          ctx.fillStyle = spk;
          ctx.fillRect(-len, -1.1, len * 2, 2.2);
          ctx.restore();
        }
        ctx.restore();
      }, 128);

      // Soft fBm organic gas puff texture (zero geometric circles, pure turbulent cloud)
      const fbmGasPuffTex = createFbmNebulaTexture((nx, ny, r) => {
        const w = fbm3D(nx * 2.2, ny * 2.2, 0.5, 4);
        const density = fbm3D(nx * 3.4 + w * 0.8, ny * 3.4 - w * 0.8, 1.2, 5);
        const alpha = Math.max(0, (density - 0.22) * 1.35) * 190;
        return [255, 255, 255, alpha];
      }, 256);

      // Helper: creates a 3-tier multi-brightness star/galaxy field (faint dust stars, medium stars, bright beacons)
      function addMultiMagnitudeStarField(parentGroup, radiusSpan, totalCount, paletteHex, flattenY = 1.0) {
        const tiers = [
          { ratio: 0.68, sizeMult: 0.055, opacity: 0.42, tex: pinpointStarTex },     // Barely visible background stars/galaxies
          { ratio: 0.25, sizeMult: 0.105, opacity: 0.78, tex: pinpointStarTex },     // Medium cluster stars/galaxies
          { ratio: 0.07, sizeMult: 0.220, opacity: 0.96, tex: diffractionStarTex }   // Bright foreground/embedded OB stars with spikes
        ];
        const colors = paletteHex.map(h => new THREE.Color(h));

        tiers.forEach((tier, tIdx) => {
          const count = Math.max(8, Math.floor(totalCount * tier.ratio));
          const geo = new THREE.BufferGeometry();
          const pos = new Float32Array(count * 3);
          const col = new Float32Array(count * 3);

          for (let i = 0; i < count; i++) {
            // Gaussian-like radial concentration with wide outer halo blending into background
            const u = Math.random() * Math.PI * 2;
            const v = Math.acos(2 * Math.random() - 1);
            const dist = radiusSpan * Math.pow(Math.random(), 0.65);
            pos[i * 3]     = dist * Math.sin(v) * Math.cos(u);
            pos[i * 3 + 1] = dist * Math.sin(v) * Math.sin(u) * flattenY;
            pos[i * 3 + 2] = dist * Math.cos(v);

            const baseCol = colors[(i + tIdx) % colors.length];
            const dimFactor = (tIdx === 0) ? (0.45 + Math.random() * 0.45) : (0.8 + Math.random() * 0.2);
            col[i * 3]     = baseCol.r * dimFactor;
            col[i * 3 + 1] = baseCol.g * dimFactor;
            col[i * 3 + 2] = baseCol.b * dimFactor;
          }
          geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
          geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

          const pts = new THREE.Points(geo, new THREE.PointsMaterial({
            size: radiusSpan * tier.sizeMult,
            map: tier.tex,
            vertexColors: true,
            transparent: true,
            opacity: tier.opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          }));
          pts.raycast = () => {};
          parentGroup.add(pts);
        });
      }

      const volumetricIds = [
        'andromeda', 'triangulum', 'sombrero-galaxy', 'messier-87', 'bootes-void',
        'el-gordo', 'centaurus-a', 'crab-nebula', 'eagle-nebula',
        'orion-nebula', 'lmc', 'smc', 'great-attractor',
        'shapley-supercluster', 'smacs-0723', 'gn-z11'
      ];

      
    // Time-sliced volumetric builder so each 512x512 fBm nebula yields to the browser cursor loop
    const volQueue = celestialObjects.filter((mesh) => {
      if (!mesh || !mesh.userData || !mesh.userData.id) return false;
      return volumetricIds.includes(mesh.userData.id) && !mesh.userData._volumetricBuilt;
    });
    let vIdx = 0;
    function buildOneVolumetric(mesh) {
      if (!mesh || !mesh.userData || !mesh.userData.id) return;
      const id = mesh.userData.id;
      if (!volumetricIds.includes(id)) return;
      if (mesh.userData._volumetricBuilt) return;
      mesh.userData._volumetricBuilt = true;

        const R = mesh.userData.size || 2.5;

        // Make the base sphere completely invisible (serves only as raycast/camera anchor)
        mesh.material = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.0,
          depthWrite: false
        });

        // Preserve animated 3D jet/beam sub-groups (Crab Pulsar beams & Centaurus A jets)
        const preservedChildren = [];
        if (id === 'crab-nebula' && typeof crabPulsarBeams !== 'undefined' && crabPulsarBeams) {
          preservedChildren.push(crabPulsarBeams);
        }
        if (id === 'centaurus-a' && typeof cenAJetGroup !== 'undefined' && cenAJetGroup) {
          preservedChildren.push(cenAJetGroup);
        }

        while (mesh.children.length > 0) {
          mesh.remove(mesh.children[0]);
        }
        preservedChildren.forEach(ch => mesh.add(ch));

        const volGroup = new THREE.Group();
        volGroup.raycast = () => {};
        mesh.add(volGroup);

        // =========================================================================
        // 0A. ANDROMEDA GALAXY (M31): NASA Spitzer/GALEX/Hubble Multi-Wavelength Spiral
        //     Matches Screenshot_2026-11-07_at_11.16.35_AM.png
        // =========================================================================
        if (id === 'andromeda') {
          const m31Tex = createFbmNebulaTexture((nx, ny, r) => {
            // Tilt ~26 deg from bottom-left to top-right (matching reference screenshot)
            const ang = 0.46;
            const rx = nx * Math.cos(ang) - ny * Math.sin(ang);
            const ry = nx * Math.sin(ang) + ny * Math.cos(ang);

            // Foreshortened inclined spiral disk plane (aspect ratio ~2.65 : 1)
            const dx = rx * 1.05;
            const dy = ry * 2.65;
            const rDisk = Math.sqrt(dx * dx + dy * dy);
            const theta = Math.atan2(dy, dx);

            // 1. Blazing white-pink-gold stellar bulge
            const bulgeR = Math.sqrt(rx * rx * 1.2 + ry * ry * 3.8);
            const coreWhite = Math.exp(-bulgeR * bulgeR * 28.0);
            const bulgeWarm = Math.exp(-bulgeR * bulgeR * 7.5);

            // 2. Tightly wound 2-arm logarithmic spiral + M31's signature 10-kpc star-forming ring
            const turb = fbm3D(dx * 3.5, dy * 3.5, 1.4, 4);
            const ridge = ridgedFbm3D(dx * 6.0 + turb * 1.2, dy * 6.0 - turb * 1.2, 2.3, 5);
            const spiralPhase1 = Math.sin(theta * 2.0 - rDisk * 19.5 + (turb - 0.5) * 2.2) * 0.5 + 0.5;
            const spiralPhase2 = Math.sin(theta * 2.0 - rDisk * 38.0 + ridge * 2.4) * 0.5 + 0.5;
            const ring10kpc = Math.exp(-Math.pow((rDisk - 0.56) / 0.16, 2.0));
            const outerCrimsonRing = Math.exp(-Math.pow((rDisk - 0.74) / 0.22, 2.0));

            const diskEnv = Math.exp(-rDisk * rDisk * 1.65) * Math.max(0, 1.0 - rDisk * 0.88);
            const lavenderArms = Math.pow(spiralPhase1 * 0.65 + spiralPhase2 * 0.35, 1.35) * diskEnv * (0.55 + 0.65 * ridge);

            // Dark concentric dust absorption lanes between the lavender spiral arms
            const dustLane = Math.pow(1.0 - spiralPhase1, 2.2) * Math.exp(-Math.pow((rDisk - 0.42) / 0.28, 2.0)) * (0.45 + 0.55 * ridge);
            const dustAbsorb = Math.min(0.78, dustLane * 0.85);

            // 3. Companion dwarf elliptical galaxy M110 (NGC 205) in lower-right (nx ~ +0.16, ny ~ +0.46)
            const m110x = (nx - 0.16) * 0.85 + (ny - 0.46) * 0.52;
            const m110y = -(nx - 0.16) * 0.52 + (ny - 0.46) * 0.85;
            const m110R = Math.sqrt(m110x * m110x * 1.1 + m110y * m110y * 3.2);
            const m110Glow = Math.exp(-m110R * m110R * 95.0);

            // 4. Embedded cyan/blue/gold star-forming OB knots along the spiral arms
            const knotField = Math.pow(Math.max(0, ridgedFbm3D(dx * 16.0, dy * 16.0, 4.1, 4) - 0.66), 2.2) * diskEnv * 7.5;

            // Combine colors matching the NASA Spitzer/GALEX/Optical composite screenshot:
            // Core: white -> warm rose-peach; Inner/mid arms: lavender-violet & pearl-blue;
            // Outer ring & halo: deep crimson-red & magenta-rose
            const crimsonHalo = (outerCrimsonRing * (0.55 + 0.65 * ridge) + diskEnv * 0.42) * (1.0 - coreWhite * 0.8);

            let Rcol = (coreWhite * 255 + bulgeWarm * 255 + lavenderArms * 218 + crimsonHalo * 215 + knotField * 185) * (1.0 - dustAbsorb * 0.65) + m110Glow * 215;
            let Gcol = (coreWhite * 250 + bulgeWarm * 195 + lavenderArms * 182 + crimsonHalo * 38  + knotField * 235) * (1.0 - dustAbsorb * 0.82) + m110Glow * 195;
            let Bcol = (coreWhite * 245 + bulgeWarm * 205 + lavenderArms * 255 + crimsonHalo * 88  + knotField * 255) * (1.0 - dustAbsorb * 0.75) + m110Glow * 248;

            const Acol = Math.min(255, (coreWhite * 255 + bulgeWarm * 235 + lavenderArms * 225 + crimsonHalo * 195 + m110Glow * 210 + dustLane * 140));
            return [Rcol, Gcol, Bcol, Acol];
          }, 512);

          // Diffuse crimson-magenta outer galactic halo
          const m31OuterHalo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: fbmGasPuffTex,
            color: 0xbe185d,
            transparent: true,
            opacity: 0.34,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          }));
          m31OuterHalo.scale.set(R * 12.5, R * 8.2, 1);
          m31OuterHalo.raycast = () => {};
          volGroup.add(m31OuterHalo);

          const m31Sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: m31Tex,
            transparent: true,
            opacity: 0.98,
            depthWrite: false
          }));
          m31Sprite.scale.set(R * 10.2, R * 10.2, 1);
          m31Sprite.raycast = () => {};
          volGroup.add(m31Sprite);

          addMultiMagnitudeStarField(volGroup, R * 5.2, 420, [0xffffff, 0xe9d5ff, 0x7dd3fc, 0xfef08a, 0xf472b6, 0xfda4af], 0.58);
        }

        // =========================================================================
        // 0B. TRIANGULUM GALAXY (M33): Flocculent Lavender Spiral + Hot-Pink H II Knots
        //     Matches Screenshot_2026-11-07_at_11.17.18_AM.png
        // =========================================================================
        else if (id === 'triangulum') {
          const m33Tex = createFbmNebulaTexture((nx, ny, r) => {
            // Slight inclination matching the NOIRLab/Hubble portrait orientation
            const ang = -0.52;
            const rx = (nx * Math.cos(ang) - ny * Math.sin(ang)) * 1.28;
            const ry = (nx * Math.sin(ang) + ny * Math.cos(ang)) * 0.96;
            const rDisk = Math.sqrt(rx * rx + ry * ry);
            const theta = Math.atan2(ry, rx);

            // 1. Warm pinkish-gold & cream central core threaded with fine dust filaments
            const w1 = fbm3D(rx * 3.6, ry * 3.6, 0.8, 4);
            const w2 = fbm3D(rx * 7.2 + w1 * 1.3, ry * 7.2 - w1 * 1.3, 2.1, 5);
            const ridge = ridgedFbm3D(rx * 9.5 + w1 * 1.5, ry * 9.5 + w2 * 1.5, 1.7, 5);

            const coreGlow = Math.exp(-rDisk * rDisk * 9.5) * (0.75 + 0.35 * w1);
            const innerDisk = Math.exp(-rDisk * rDisk * 2.4) * (0.55 + 0.55 * w2);

            // 2. Loosely wound flocculent multi-arm spiral in violet-purple and lavender-blue
            const arm1 = Math.sin(theta * 2.0 + rDisk * 8.5 + (w1 - 0.5) * 2.6) * 0.5 + 0.5;
            const arm2 = Math.sin(theta * 3.0 + rDisk * 11.0 - (w2 - 0.5) * 2.4) * 0.5 + 0.5;
            const armMask = Math.pow(arm1 * 0.62 + arm2 * 0.38, 1.3) * Math.exp(-rDisk * rDisk * 1.55);

            // Dark dusty inter-arm filaments near the center
            const dustFilaments = Math.pow(Math.max(0, 1.0 - ridge), 2.4) * Math.exp(-rDisk * rDisk * 4.2) * 0.55;

            // 3. Vibrant Hot-Pink / Magenta H-alpha Star-Forming Nebular Knots (NGC 604 & companions)
            const h2Noise = ridgedFbm3D(rx * 15.5 + w2, ry * 15.5 - w1, 3.7, 4);
            let h2Knots = Math.pow(Math.max(0, h2Noise - 0.58), 2.1) * (armMask + innerDisk * 0.5) * 8.5;

            // Prominent NGC 604 giant H II region at upper-left (nx ~ -0.48, ny ~ -0.22) + major knots
            const majorKnots = [
              { kx: -0.48, ky: -0.22, kr: 0.065, str: 1.35 }, // NGC 604
              { kx: -0.14, ky: -0.26, kr: 0.042, str: 0.95 },
              { kx:  0.08, ky: -0.09, kr: 0.045, str: 0.95 },
              { kx: -0.08, ky:  0.18, kr: 0.048, str: 1.05 },
              { kx:  0.04, ky:  0.29, kr: 0.044, str: 0.95 },
              { kx:  0.34, ky:  0.38, kr: 0.040, str: 0.85 },
              { kx:  0.22, ky: -0.24, kr: 0.038, str: 0.80 }
            ];
            for (let k of majorKnots) {
              const d2 = (nx - k.kx) * (nx - k.kx) + (ny - k.ky) * (ny - k.ky);
              h2Knots += Math.exp(-d2 / (k.kr * k.kr)) * k.str * (0.7 + 0.5 * ridge);
            }

            // Young blue OB stellar associations in the outer spiral arms
            const blueOB = Math.pow(Math.max(0, ridgedFbm3D(rx * 13.0, ry * 13.0, 5.2, 4) - 0.56), 2.0) * armMask * (0.4 + rDisk * 1.1) * 5.2;

            const absorb = 1.0 - dustFilaments;
            const Rcol = (coreGlow * 255 + innerDisk * 215 + armMask * 175 + blueOB * 110) * absorb + h2Knots * 255;
            const Gcol = (coreGlow * 215 + innerDisk * 145 + armMask * 115 + blueOB * 195) * absorb + h2Knots * 48;
            const Bcol = (coreGlow * 205 + innerDisk * 210 + armMask * 235 + blueOB * 255) * absorb + h2Knots * 145;
            const Acol = Math.min(255, (coreGlow * 245 + innerDisk * 215 + armMask * 205 + h2Knots * 220 + blueOB * 180));

            return [Rcol, Gcol, Bcol, Acol];
          }, 512);

          const m33Halo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: fbmGasPuffTex,
            color: 0x9333ea,
            transparent: true,
            opacity: 0.30,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          }));
          m33Halo.scale.set(R * 11.0, R * 11.5, 1);
          m33Halo.raycast = () => {};
          volGroup.add(m33Halo);

          const m33Sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: m33Tex,
            transparent: true,
            opacity: 0.98,
            depthWrite: false
          }));
          m33Sprite.scale.set(R * 9.2, R * 9.2, 1);
          m33Sprite.raycast = () => {};
          volGroup.add(m33Sprite);

          addMultiMagnitudeStarField(volGroup, R * 4.8, 390, [0xf43f5e, 0xe879f9, 0x38bdf8, 0xffffff, 0xfef08a, 0xc084fc], 0.88);
        }

        // =========================================================================
        // 0C. BOÖTES VOID (THE GREAT NOTHING): Barnard-68 Style Pitch-Black Cosmic Void
        //     Matches SS6.png and SS7.webp
        // =========================================================================
        else if (id === 'bootes-void') {
          // Helper that evaluates the organic multi-lobe void silhouette (SS6 / SS7 shape)
          // Returns > 1.0 inside the dark void cavity, < 1.0 outside in the dense starfield
          function evalVoidSilhouette(nx, ny) {
            const lobes = [
              { cx: -0.02, cy: -0.04, rx: 0.33, ry: 0.35, w: 1.00 }, // Central dark body
              { cx: -0.07, cy: -0.27, rx: 0.23, ry: 0.24, w: 0.82 }, // Upper apex lobe
              { cx:  0.23, cy:  0.07, rx: 0.25, ry: 0.22, w: 0.85 }, // Right rounded lobe
              { cx: -0.23, cy:  0.27, rx: 0.21, ry: 0.19, w: 0.84 }, // Distinct lower-left protruding lobe (SS6 & SS7)
              { cx: -0.03, cy:  0.21, rx: 0.24, ry: 0.20, w: 0.75 }  // Lower bridge
            ];
            let field = 0.0;
            for (let l of lobes) {
              const dx = (nx - l.cx) / l.rx;
              const dy = (ny - l.cy) / l.ry;
              const d2 = dx * dx + dy * dy;
              field += l.w * Math.exp(-d2 * 1.65);
            }
            // Add ragged, wispy dark molecular/void boundary tendrils via multi-octave fBm
            const turb1 = fbm3D(nx * 4.5 + 1.3, ny * 4.5 + 2.1, 0.7, 4) - 0.5;
            const turb2 = ridgedFbm3D(nx * 9.0, ny * 9.0, 1.9, 4) - 0.5;
            return field + turb1 * 0.28 + turb2 * 0.14;
          }

          const voidCanvas = document.createElement('canvas');
          voidCanvas.width = 512;
          voidCanvas.height = 512;
          const vCtx = voidCanvas.getContext('2d');
          const vImg = vCtx.createImageData(512, 512);
          const vData = vImg.data;

          for (let py = 0; py < 512; py++) {
            const ny = (py / 511) * 2.0 - 1.0;
            for (let px = 0; px < 512; px++) {
              const nx = (px / 511) * 2.0 - 1.0;
              const r2 = nx * nx + ny * ny;
              if (r2 >= 1.0) continue;
              const r = Math.sqrt(r2);
              const radialMask = Math.pow(Math.max(0, 1.0 - r), 1.6);

              const vf = evalVoidSilhouette(nx, ny);
              const idx = (py * 512 + px) * 4;

              if (vf >= 0.88) {
                // Inside the pitch-black void core & smoky dark charcoal boundary rim (SS6, SS7)
                const coreDepth = Math.min(1.0, (vf - 0.88) / 0.24);
                const rimWisp = (1.0 - coreDepth) * (0.5 + 0.5 * fbm3D(nx * 12.0, ny * 12.0, 3.1, 4));
                // Dark charcoal/umbral edge transitioning into pure #000000 void interior
                vData[idx]     = (rimWisp * 22) | 0;
                vData[idx + 1] = (rimWisp * 18) | 0;
                vData[idx + 2] = (rimWisp * 15) | 0;
                vData[idx + 3] = Math.min(255, (Math.pow(coreDepth, 0.45) * 255) | 0);
              } else {
                // Subtle slate-blue background starlight glow surrounding the dark silhouette (SS6)
                const rimProximity = Math.exp(-Math.pow((0.88 - vf) / 0.32, 2.0));
                const dustGlow = rimProximity * radialMask * (0.45 + 0.55 * fbm3D(nx * 5.0, ny * 5.0, 0.4, 4));
                vData[idx]     = (dustGlow * 125) | 0;
                vData[idx + 1] = (dustGlow * 150) | 0;
                vData[idx + 2] = (dustGlow * 195) | 0;
                vData[idx + 3] = Math.min(255, (dustGlow * 145) | 0);
              }
            }
          }
          vCtx.putImageData(vImg, 0, 0);
          const voidTex = new THREE.CanvasTexture(voidCanvas);
          voidTex.colorSpace = THREE.SRGBColorSpace;
          voidTex.needsUpdate = true;

          // 1. Opaque pitch-black void silhouette sprite (NormalBlending so it occludes background lines/stars)
          const voidSprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: voidTex,
            transparent: true,
            opacity: 1.0,
            blending: THREE.NormalBlending,
            depthWrite: false
          }));
          const voidSpan = R * 8.2;
          voidSprite.scale.set(voidSpan, voidSpan, 1);
          voidSprite.renderOrder = 5;
          voidSprite.raycast = () => {};
          volGroup.add(voidSprite);

          // 2. Dense, glittering multi-colored surrounding starfield (SS6, SS7) with ZERO stars inside the void core
          const starLayers = [
            { count: 1100, size: R * 0.16, opacity: 0.88, tex: pinpointStarTex },
            { count: 320,  size: R * 0.30, opacity: 0.96, tex: pinpointStarTex },
            { count: 48,   size: R * 0.62, opacity: 1.00, tex: diffractionStarTex }
          ];

          starLayers.forEach((layer, lIdx) => {
            const ptsArr = [];
            const colArr = [];
            let attempts = 0;
            while (ptsArr.length < layer.count * 3 && attempts < layer.count * 12) {
              attempts++;
              // Sample within circular field around the void
              const rad = Math.pow(Math.random(), 0.58) * 0.96;
              const ang = Math.random() * Math.PI * 2;
              const nx = rad * Math.cos(ang);
              const ny = rad * Math.sin(ang);
              const vf = evalVoidSilhouette(nx, -ny); // -ny matches canvas Y orientation

              // Strictly exclude stars from the pitch-black void interior
              if (vf > 0.96) continue;

              const px = nx * (voidSpan * 0.48);
              const py = ny * (voidSpan * 0.48);
              const pz = (Math.random() - 0.5) * R * 1.4;
              ptsArr.push(px, py, pz);

              // Stars right along the void boundary (0.78 < vf <= 0.96) are dust-reddened orange/crimson (SS6, SS7)
              let cr, cg, cb;
              if (vf > 0.78) {
                cr = 1.0;
                cg = 0.38 + Math.random() * 0.28;
                cb = 0.12 + Math.random() * 0.15;
              } else {
                const pick = Math.random();
                if (pick < 0.32) {
                  // Crisp blue-white stars
                  cr = 0.78; cg = 0.88; cb = 1.0;
                } else if (pick < 0.68) {
                  // Pure white-cream stars
                  cr = 1.0; cg = 0.98; cb = 0.92;
                } else if (pick < 0.88) {
                  // Warm golden-amber stars
                  cr = 1.0; cg = 0.82; cb = 0.45;
                } else {
                  // Deep orange-red K/M stars
                  cr = 1.0; cg = 0.45; cb = 0.22;
                }
              }
              const bFactor = (lIdx === 0) ? (0.55 + Math.random() * 0.45) : 1.0;
              colArr.push(cr * bFactor, cg * bFactor, cb * bFactor);
            }

            // Add the signature bright beacon stars on the right and bottom edges (SS6 & SS7)
            if (lIdx === 2) {
              const beacons = [
                { x:  0.41, y:  0.08, c: [1.0, 0.95, 0.90] }, // Prominent bright right-edge star (SS7)
                { x:  0.38, y: -0.34, c: [0.92, 0.96, 1.0] }, // Lower-right bright star (SS6)
                { x: -0.05, y: -0.38, c: [0.95, 0.92, 1.0] }, // Bottom-center bright star (SS7)
                { x: -0.26, y: -0.02, c: [1.0, 0.42, 0.22] }, // Reddened left-rim double star (SS7)
                { x: -0.21, y:  0.36, c: [1.0, 0.82, 0.55] }  // Upper-left golden star (SS6)
              ];
              beacons.forEach(b => {
                ptsArr.push(b.x * voidSpan, b.y * voidSpan, R * 0.2);
                colArr.push(b.c[0], b.c[1], b.c[2]);
              });
            }

            const sGeo = new THREE.BufferGeometry();
            sGeo.setAttribute('position', new THREE.Float32BufferAttribute(ptsArr, 3));
            sGeo.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
            const sPts = new THREE.Points(sGeo, new THREE.PointsMaterial({
              size: layer.size,
              map: layer.tex,
              vertexColors: true,
              transparent: true,
              opacity: layer.opacity,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            }));
            sPts.renderOrder = 6;
            sPts.raycast = () => {};
            volGroup.add(sPts);
          });
        }

        // =========================================================================
        // 0D. SOMBRERO GALAXY (M104): NASA Hubble/Spitzer Luminous Bulge + Razor-Sharp Dust Ring
        // =========================================================================
        else if (id === 'sombrero-galaxy') {
          const m104Tex = createFbmNebulaTexture((nx, ny, r) => {
            const ang = 0.11; // Slight 6-degree tilt
            const rx = nx * Math.cos(ang) - ny * Math.sin(ang);
            const ry = nx * Math.sin(ang) + ny * Math.cos(ang);

            // 1. Expansive golden-ivory spherical/elliptical stellar halo & blazing nucleus
            const bulgeR = Math.sqrt(rx * rx * 0.92 + ry * ry * 1.35);
            const nucleus = Math.exp(-bulgeR * bulgeR * 26.0);
            const haloBulge = Math.exp(-bulgeR * bulgeR * 3.8);

            // 2. Nearly edge-on equatorial disk & sharp dark dust absorption ring
            const diskR = Math.sqrt(rx * rx + (ry * 6.2) * (ry * 6.2));
            const ringZone = Math.exp(-Math.pow((diskR - 0.62) / 0.16, 2.0)) * Math.exp(-ry * ry * 95.0);
            const innerBrightDisk = Math.exp(-Math.pow((diskR - 0.38) / 0.22, 2.0)) * Math.exp(-ry * ry * 140.0);
            const turb = ridgedFbm3D(rx * 12.0, ry * 36.0, 1.5, 4);

            // Foreground portion of the dust lane (ry > 0.015) strongly absorbs the golden bulge
            const frontLane = Math.exp(-Math.pow((ry - 0.045) / 0.042, 2.0)) * Math.exp(-rx * rx * 1.65) * (0.68 + 0.32 * turb);
            const absorb = Math.min(0.94, frontLane * 0.95);

            // Spitzer infrared ruby-amber glow along the outer dust ring
            const irRim = ringZone * (0.55 + 0.55 * turb);

            const litBulge = (nucleus * 1.2 + haloBulge * 0.92 + innerBrightDisk * 0.85) * (1.0 - absorb);
            const Rcol = litBulge * 255 + irRim * 235 + absorb * 28;
            const Gcol = litBulge * 232 + irRim * 115 + absorb * 16;
            const Bcol = litBulge * 185 + irRim * 65  + absorb * 12;
            const Acol = Math.min(255, (haloBulge * 235 + ringZone * 240 + frontLane * 245 + innerBrightDisk * 210));
            return [Rcol, Gcol, Bcol, Acol];
          }, 512);

          const m104Sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: m104Tex,
            transparent: true,
            opacity: 0.98,
            depthWrite: false
          }));
          m104Sprite.scale.set(R * 9.5, R * 9.5, 1);
          m104Sprite.raycast = () => {};
          volGroup.add(m104Sprite);

          addMultiMagnitudeStarField(volGroup, R * 4.5, 310, [0xfffbeb, 0xfef08a, 0xfde68a, 0xf97316], 0.75);
        }

        // =========================================================================
        // 0E. MESSIER 87 (VIRGO A): Supergiant cD Elliptical + 5,000-ly Relativistic Synchrotron Jet
        // =========================================================================
        else if (id === 'messier-87') {
          const m87Tex = createFbmNebulaTexture((nx, ny, r) => {
            // 1. Colossal golden-amber cD elliptical galaxy halo + blazing AGN core
            const ellipR = Math.sqrt(nx * nx * 0.92 + ny * ny * 1.08);
            const agnCore = Math.exp(-ellipR * ellipR * 42.0);
            const goldenHalo = Math.exp(-ellipR * ellipR * 3.4);

            // 2. Relativistic synchrotron plasma jet shooting toward upper-left (angle ~ -2.45 rad)
            const jAng = -0.68; // Upper-left diagonal
            const jx = nx * Math.cos(jAng) - ny * Math.sin(jAng);
            const jy = nx * Math.sin(jAng) + ny * Math.cos(jAng);

            let jetIntensity = 0.0;
            if (jx < 0.02 && jx > -0.78) {
              const distAlong = -jx;
              const jetWidth = 0.018 + distAlong * 0.055;
              const turb = ridgedFbm3D(jx * 18.0, jy * 18.0, 2.2, 4);
              const crossProfile = Math.exp(-Math.pow(jy / jetWidth, 2.0));
              // Shock knots (HST-1, A, B, C) along the jet spine
              const knots = 0.55 + 0.65 * Math.pow(Math.sin(distAlong * 28.0 + turb * 2.0) * 0.5 + 0.5, 1.6);
              jetIntensity = crossProfile * Math.exp(-distAlong * 1.6) * knots * (0.75 + 0.45 * turb);
            }

            const Rcol = agnCore * 255 + goldenHalo * 255 + jetIntensity * 165;
            const Gcol = agnCore * 250 + goldenHalo * 212 + jetIntensity * 228;
            const Bcol = agnCore * 235 + goldenHalo * 135 + jetIntensity * 255;
            const Acol = Math.min(255, (agnCore * 255 + goldenHalo * 230 + jetIntensity * 245));
            return [Rcol, Gcol, Bcol, Acol];
          }, 512);

          const m87Sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: m87Tex,
            transparent: true,
            opacity: 0.98,
            depthWrite: false
          }));
          m87Sprite.scale.set(R * 9.6, R * 9.6, 1);
          m87Sprite.raycast = () => {};
          volGroup.add(m87Sprite);

          // M87's famous swarm of ~12,000 globular clusters
          addMultiMagnitudeStarField(volGroup, R * 5.0, 420, [0xfef08a, 0xfde68a, 0xfffbeb, 0x38bdf8, 0xfbbf24], 0.92);
        }

        // =========================================================================
        // 1. CENTAURUS A / CALDWELL 77: Smooth Elliptical Halo + Organic Warped Dust Lane (ZERO square border)
        // =========================================================================
        else if (id === 'centaurus-a') {
          const cenATex = createFbmNebulaTexture((nx, ny, r) => {
            // Rotate coordinates to match Caldwell 77 diagonal dust lane
            const ang = 0.58;
            const rx = nx * Math.cos(ang) - ny * Math.sin(ang);
            const ry = nx * Math.sin(ang) + ny * Math.cos(ang);

            // 1. Smooth elliptical golden-ivory stellar bulge (r-squared exponential falloff)
            const ellipR = Math.sqrt(rx * rx * 0.85 + ry * ry * 1.15);
            const bulge = Math.exp(-ellipR * ellipR * 4.2);

            // 2. Turbulent S-warped dark dust lane cutting across ry ~ 0
            const warp = (fbm3D(rx * 3.2, ry * 3.2, 2.1, 4) - 0.5) * 0.16 + Math.sin(rx * 3.5) * 0.04;
            const distToLane = Math.abs(ry + warp);
            const fbmDust = ridgedFbm3D(rx * 6.5 + warp * 3.0, ry * 9.5, 0.7, 5);
            const laneEnvelope = Math.exp(-Math.pow(distToLane / 0.17, 2.0)) * Math.exp(-rx * rx * 2.2);
            const dustAbsorption = Math.min(0.96, laneEnvelope * (0.55 + fbmDust * 0.65));

            // 3. Crimson/orange star-forming glow & pink H-alpha knots along the dust lane edges
            const edgeGlow = Math.exp(-Math.pow((distToLane - 0.06) / 0.09, 2.0)) * Math.exp(-rx * rx * 2.6) * fbmDust;
            const pinkKnots = Math.pow(Math.max(0, ridgedFbm3D(rx * 14.0, ry * 14.0, 3.3, 4) - 0.62), 2.0) * laneEnvelope * 6.5;

            // Combine emission and absorption with strictly circular radial falloff
            const litCore = bulge * (1.0 - dustAbsorption * 0.92);
            const red   = litCore * 255 + edgeGlow * 245 + pinkKnots * 255;
            const green = litCore * 232 + edgeGlow * 95  + pinkKnots * 65;
            const blue  = litCore * 185 + edgeGlow * 45  + pinkKnots * 135;

            // Alpha is high in both the bright bulge AND the dark dust lane so the dark dust occludes the core
            const alpha = Math.min(255, (bulge * 235 + laneEnvelope * 210 + edgeGlow * 140));
            return [red, green, blue, alpha];
          }, 512);

          // Expansive outer diffuse galactic halo blending into background stars
          const outerHalo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: fbmGasPuffTex,
            color: 0xfde68a,
            transparent: true,
            opacity: 0.32,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          }));
          outerHalo.scale.set(R * 10.5, R * 9.0, 1);
          outerHalo.raycast = () => {};
          volGroup.add(outerHalo);

          const cenASprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: cenATex,
            transparent: true,
            opacity: 0.98,
            depthWrite: false
          }));
          cenASprite.scale.set(R * 7.2, R * 7.2, 1);
          cenASprite.raycast = () => {};
          volGroup.add(cenASprite);

          // Fine pinpoint star & globular cluster field (no giant orange marbles!)
          addMultiMagnitudeStarField(volGroup, R * 4.2, 260, [0xfffbeb, 0xfde68a, 0xf43f5e, 0x93c5fd], 0.85);
        }

        // =========================================================================
        // 2. MESSIER 16 / THE EAGLE NEBULA: Expansive Turbulent Gas Cavern + 3D Fractal Pillars + Starfield
        // =========================================================================
        else if (id === 'eagle-nebula') {
          const eagleTex = createFbmNebulaTexture((nx, ny, r) => {
            // Turbulent domain warping for organic billowy gas clouds
            const w1 = fbm3D(nx * 2.8, ny * 2.8, 1.1, 4);
            const w2 = fbm3D(nx * 5.2 + w1 * 1.4, ny * 5.2 - w1 * 1.4, 2.4, 5);
            const ridge = ridgedFbm3D(nx * 6.5 + w1 * 1.2, ny * 6.5 + w2 * 1.2, 0.8, 5);

            // Background SHO cavern gas: glowing cyan-blue oxygen cavity at upper-center, golden-amber & rust veil outward
            const cavDist = Math.sqrt(Math.pow(nx + 0.05, 2) + Math.pow(ny + 0.12, 2));
            const oxygenBlue = Math.exp(-cavDist * cavDist * 2.8) * (0.55 + w2 * 0.65);
            const sulfurGold = Math.exp(-r * r * 1.4) * (0.45 + ridge * 0.75);

            let Rcol = sulfurGold * 195 + oxygenBlue * 35;
            let Gcol = sulfurGold * 125 + oxygenBlue * 175;
            let Bcol = sulfurGold * 45  + oxygenBlue * 245;
            let Acol = (oxygenBlue * 165 + sulfurGold * 145) * (0.55 + w1 * 0.6);

            // Sculpt 3 organic, craggy fBm Pillars of Creation rising from bottom-right toward upper-left
            // Note: in canvas, ny = -1 is top, ny = +1 is bottom
            const pillars = [
              { bx: -0.08, by: 0.68, tx: -0.26, ty: -0.34, w: 0.135 }, // Tall Left Pillar I
              { bx:  0.12, by: 0.72, tx:  0.04, ty: -0.16, w: 0.110 }, // Middle Pillar II
              { bx:  0.28, by: 0.75, tx:  0.26, ty:  0.06, w: 0.085 }  // Right Pillar III
            ];

            let maxPillarCore = 0.0;
            let maxPillarRim  = 0.0;

            for (let p of pillars) {
              const dx = p.tx - p.bx, dy = p.ty - p.by;
              const len2 = dx * dx + dy * dy;
              // Project pixel onto pillar spine segment [0..1]
              let t = ((nx - p.bx) * dx + (ny - p.by) * dy) / len2;
              t = Math.max(0.0, Math.min(1.0, t));

              // Perturb spine with multi-octave fBm turbulence so edges are ragged and gaseous
              const turbX = (w2 - 0.5) * 0.14 + (ridge - 0.5) * 0.08;
              const turbY = (w1 - 0.5) * 0.10;
              const px = p.bx + t * dx + turbX;
              const py = p.by + t * dy + turbY;

              const dist = Math.sqrt((nx - px) * (nx - px) + (ny - py) * (ny - py));
              const widthAtT = p.w * (1.15 - t * 0.38) * (0.75 + ridge * 0.55);

              if (dist < widthAtT * 1.8) {
                const normD = dist / widthAtT;
                // Bright photoevaporating golden-cyan UV rim at the top cap (t near 1) and edges (normD ~ 0.7..1.3)
                const rimFactor = Math.exp(-Math.pow((normD - 0.82) / 0.38, 2.0)) * (0.45 + t * 0.75) * (0.6 + ridge * 0.6);
                // Dark rusty-ochre opaque molecular hydrogen dust core inside (normD < 0.85)
                const coreFactor = Math.exp(-Math.pow(normD / 0.72, 2.2)) * (0.65 + w2 * 0.5);

                if (coreFactor > maxPillarCore) maxPillarCore = coreFactor;
                if (rimFactor > maxPillarRim) maxPillarRim = rimFactor;
              }
            }

            // Apply dark dusty amber-brown pillar absorption + golden-cyan UV ionization rim
            if (maxPillarCore > 0.01 || maxPillarRim > 0.01) {
              const absorb = Math.min(0.92, maxPillarCore);
              // Dark rust/bronze interior shaded by 3D ridge noise
              const dustR = 52 + ridge * 135;
              const dustG = 24 + ridge * 78;
              const dustB = 14 + ridge * 32;

              Rcol = Rcol * (1.0 - absorb) + dustR * absorb + maxPillarRim * 255;
              Gcol = Gcol * (1.0 - absorb) + dustG * absorb + maxPillarRim * 230;
              Bcol = Bcol * (1.0 - absorb) + dustB * absorb + maxPillarRim * 165;
              Acol = Math.max(Acol, absorb * 240 + maxPillarRim * 210);
            }

            return [Rcol, Gcol, Bcol, Math.min(255, Acol)];
          }, 512);

          // 1. Massive outer diffuse gaseous emission clouds so M16 spans a huge volume and blends into the stars
          const ambientLayers = [
            { pos: [0, 0, -R * 0.8], scale: R * 14.0, color: 0x0369a1, opacity: 0.35 },
            { pos: [-R * 1.2, R * 0.9, R * 0.4], scale: R * 11.5, color: 0x0ea5e9, opacity: 0.30 },
            { pos: [R * 1.1, -R * 1.2, -R * 0.3], scale: R * 12.0, color: 0xb45309, opacity: 0.32 },
            { pos: [0, -R * 1.5, R * 0.6], scale: R * 10.0, color: 0xca8a04, opacity: 0.25 }
          ];
          ambientLayers.forEach(cfg => {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({
              map: fbmGasPuffTex,
              color: cfg.color,
              transparent: true,
              opacity: cfg.opacity,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            }));
            sp.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
            sp.scale.set(cfg.scale, cfg.scale, 1);
            sp.raycast = () => {};
            volGroup.add(sp);
          });

          // 2. Core high-resolution fractal Pillars & SHO Cavern sprite (scaled up to R * 9.5)
          const eagleSprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: eagleTex,
            transparent: true,
            opacity: 0.95,
            depthWrite: false
          }));
          eagleSprite.scale.set(R * 9.5, R * 9.5, 1);
          eagleSprite.raycast = () => {};
          volGroup.add(eagleSprite);

          // 3. Rich 3-tier starfield (hundreds of barely visible background stars + medium stars + bright spiked NGC 6611 OB stars)
          addMultiMagnitudeStarField(volGroup, R * 5.8, 380, [0xffffff, 0xe0f2fe, 0xfef08a, 0xfdba74, 0x93c5fd], 1.0);
        }

        // =========================================================================
        // 3. THE CRAB NEBULA (M1): Expansive Synchrotron Core + Fractal Filament Cage
        // =========================================================================
        else if (id === 'crab-nebula') {
          const crabTex = createFbmNebulaTexture((nx, ny, r) => {
            // Prolate oval orientation
            const ang = -0.35;
            const rx = (nx * Math.cos(ang) - ny * Math.sin(ang)) * 0.88;
            const ry = (nx * Math.sin(ang) + ny * Math.cos(ang)) * 1.18;
            const ellipR = Math.sqrt(rx * rx + ry * ry);
            if (ellipR >= 1.0) return [0, 0, 0, 0];

            const w = fbm3D(rx * 3.5, ry * 3.5, 0.9, 4);
            const fil1 = ridgedFbm3D(rx * 7.5 + w * 1.6, ry * 7.5 - w * 1.6, 1.5, 5);
            const fil2 = ridgedFbm3D(rx * 13.0 - w * 1.2, ry * 13.0 + w * 1.2, 3.1, 4);
            const web = Math.pow(Math.max(0, fil1 * 0.65 + fil2 * 0.35 - 0.28), 1.6) * 2.4;

            // Inner glowing cyan-blue pulsar wind bubble
            const syncCore = Math.exp(-ellipR * ellipR * 4.8) * (0.75 + w * 0.45);
            // Outer shell of orange-red and sulfur-green filaments
            const shellMask = Math.exp(-Math.pow((ellipR - 0.48) / 0.34, 2.0));

            const Rcol = syncCore * 145 + web * shellMask * 255;
            const Gcol = syncCore * 225 + web * shellMask * (115 + fil2 * 110);
            const Bcol = syncCore * 255 + web * shellMask * 45;
            const Acol = Math.min(255, (syncCore * 210 + web * shellMask * 235));
            return [Rcol, Gcol, Bcol, Acol];
          }, 512);

          // Wide outer diffuse supernova remnant halo
          const outerGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: fbmGasPuffTex,
            color: 0xea580c,
            transparent: true,
            opacity: 0.28,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          }));
          outerGlow.scale.set(R * 10.5, R * 8.5, 1);
          outerGlow.raycast = () => {};
          volGroup.add(outerGlow);

          const mainCrab = new THREE.Sprite(new THREE.SpriteMaterial({
            map: crabTex,
            transparent: true,
            opacity: 0.96,
            depthWrite: false
          }));
          mainCrab.scale.set(R * 7.8, R * 7.8, 1);
          mainCrab.raycast = () => {};
          volGroup.add(mainCrab);

          addMultiMagnitudeStarField(volGroup, R * 4.5, 220, [0x38bdf8, 0xf97316, 0x4ade80, 0xfef08a, 0xffffff], 0.85);
        }

        // =========================================================================
        // 3B. ORION NEBULA (M42): NASA Hubble/JWST Cavern + Trapezium Core + Orion Bar
        // =========================================================================
        else if (id === 'orion-nebula') {
          const m42Tex = createFbmNebulaTexture((nx, ny, r) => {
            const w1 = fbm3D(nx * 3.0, ny * 3.0, 1.4, 4);
            const w2 = fbm3D(nx * 6.0 + w1 * 1.5, ny * 6.0 - w1 * 1.5, 2.7, 5);
            const ridge = ridgedFbm3D(nx * 7.5 + w1, ny * 7.5 + w2, 0.9, 5);

            // Glowing turquoise-white Trapezium OB core offset slightly upper-center
            const trapDist = Math.hypot(nx - 0.04, ny + 0.08);
            const trapCore = Math.exp(-trapDist * trapDist * 9.5) * (0.75 + 0.45 * w1);

            // Sweeping parabolic H II wings in magenta-rose, violet, and crimson
            const wingArc = Math.exp(-Math.pow((r - 0.42) / 0.32, 2.0)) * (0.55 + 0.65 * ridge);
            // Golden-rust Orion Bar ionization front cutting diagonally across lower-left
            const barDist = Math.abs((nx * 0.72 + ny * 0.69) - 0.24 + (w1 - 0.5) * 0.12);
            const orionBar = Math.exp(-Math.pow(barDist / 0.085, 2.0)) * Math.exp(-r * r * 2.2) * (0.6 + 0.6 * ridge);

            const Rcol = trapCore * 225 + wingArc * 245 + orionBar * 255;
            const Gcol = trapCore * 252 + wingArc * (55 + w2 * 65) + orionBar * 165;
            const Bcol = trapCore * 255 + wingArc * (165 + w1 * 85) + orionBar * 75;
            const Acol = Math.min(255, (trapCore * 245 + wingArc * 215 + orionBar * 220) * (0.65 + 0.5 * w2));
            return [Rcol, Gcol, Bcol, Acol];
          }, 512);

          const m42Sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: m42Tex,
            transparent: true,
            opacity: 0.96,
            depthWrite: false
          }));
          m42Sprite.scale.set(R * 9.6, R * 9.6, 1);
          m42Sprite.raycast = () => {};
          volGroup.add(m42Sprite);

          addMultiMagnitudeStarField(volGroup, R * 5.0, 320, [0xffffff, 0xe0f2fe, 0xf472b6, 0xfef08a, 0xc084fc], 0.95);
        }

        // =========================================================================
        // 3C. SMACS 0723 (JWST FIRST DEEP FIELD): Central cD Galaxies + Einstein Lensing Arcs
        // =========================================================================
        else if (id === 'smacs-0723') {
          const smacsTex = createFbmNebulaTexture((nx, ny, r) => {
            const theta = Math.atan2(ny, nx);
            // Diffuse golden-white intracluster light & central cD elliptical galaxy core
            const icl = Math.exp(-r * r * 5.2);
            const cdCore = Math.exp(-r * r * 32.0);

            // Tangential gravitational lensing Einstein arcs (JWST orange/amber/crimson stretched galaxies)
            let arcs = 0.0;
            const arcDefs = [
              { r0: 0.34, w: 0.018, a0: -0.65, span: 0.55 },
              { r0: 0.44, w: 0.016, a0:  0.42, span: 0.62 },
              { r0: 0.52, w: 0.018, a0:  2.15, span: 0.48 },
              { r0: 0.39, w: 0.015, a0: -2.25, span: 0.52 },
              { r0: 0.61, w: 0.017, a0:  1.15, span: 0.44 }
            ];
            for (let a of arcDefs) {
              const dr = (r - a.r0) / a.w;
              let da = Math.atan2(Math.sin(theta - a.a0), Math.cos(theta - a.a0));
              if (Math.abs(dr) < 2.5 && Math.abs(da) < a.span) {
                arcs += Math.exp(-dr * dr) * Math.exp(-Math.pow(da / (a.span * 0.6), 2.0));
              }
            }

            const Rcol = cdCore * 255 + icl * 245 + arcs * 255;
            const Gcol = cdCore * 248 + icl * 215 + arcs * 135;
            const Bcol = cdCore * 225 + icl * 165 + arcs * 55;
            const Acol = Math.min(255, cdCore * 255 + icl * 195 + arcs * 245);
            return [Rcol, Gcol, Bcol, Acol];
          }, 512);

          const smacsSprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: smacsTex,
            transparent: true,
            opacity: 0.98,
            depthWrite: false
          }));
          smacsSprite.scale.set(R * 9.2, R * 9.2, 1);
          smacsSprite.raycast = () => {};
          volGroup.add(smacsSprite);

          addMultiMagnitudeStarField(volGroup, R * 5.2, 380, [0xffffff, 0xfef08a, 0xf97316, 0xef4444, 0xbae6fd], 0.92);
        }

        // =========================================================================
        // 4. EL GORDO, MAGELLANIC CLOUDS & DEEP-SPACE SUPERCLUSTERS / GALAXIES
        // =========================================================================
        else {
          // Tailor color palettes & gas clouds for each cosmic landmark
          const clusterConfigs = {
            'el-gordo': {
              gasColors: [0x2563eb, 0x60a5fa, 0x1d4ed8],
              starColors: [0xffffff, 0xfef08a, 0xfbbf24, 0xf97316, 0xef4444, 0x93c5fd],
              gasScale: 11.5,
              starSpan: 5.5,
              starCount: 360,
              cometaryWake: true
            },
            'lmc': {
              gasColors: [0x38bdf8, 0x818cf8, 0xf43f5e],
              starColors: [0xffffff, 0xbae6fd, 0xfef08a, 0xf43f5e, 0xe879f9],
              gasScale: 10.5,
              starSpan: 4.8,
              starCount: 380
            },
            'smc': {
              gasColors: [0x60a5fa, 0x818cf8, 0xf472b6],
              starColors: [0xffffff, 0xbae6fd, 0xfde68a, 0xf43f5e],
              gasScale: 9.5,
              starSpan: 4.2,
              starCount: 290
            },
            'great-attractor': {
              gasColors: [0xe11d48, 0xf97316, 0x9333ea],
              starColors: [0xfef08a, 0xfbbf24, 0xf97316, 0xef4444, 0xffffff],
              gasScale: 13.5,
              starSpan: 6.2,
              starCount: 420
            },
            'shapley-supercluster': {
              gasColors: [0x0284c7, 0x6366f1, 0xf59e0b],
              starColors: [0xffffff, 0xfef08a, 0xfbbf24, 0x93c5fd, 0xf97316],
              gasScale: 14.0,
              starSpan: 6.5,
              starCount: 450
            },
            'gn-z11': {
              gasColors: [0xdc2626, 0x991b1b, 0xf97316],
              starColors: [0xef4444, 0xf97316, 0xfca5a5, 0xfef08a],
              gasScale: 8.5,
              starSpan: 3.8,
              starCount: 180
            }
          };

          const cfg = clusterConfigs[id] || clusterConfigs['el-gordo'];

          // Multi-layered volumetric gas/intracluster plasma clouds that fade seamlessly into the background
          for (let g = 0; g < 6; g++) {
            const wakeOffset = cfg.cometaryWake ? (g - 1.5) * R * 0.55 : (Math.sin(g * 2.1) * R * 0.65);
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({
              map: fbmGasPuffTex,
              color: cfg.gasColors[g % cfg.gasColors.length],
              transparent: true,
              opacity: cfg.cometaryWake ? (0.68 - g * 0.08) : 0.36,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            }));
            sp.position.set(
              wakeOffset,
              cfg.cometaryWake ? wakeOffset * 0.82 : (Math.cos(g * 1.7) * R * 0.55),
              Math.sin(g * 3.1) * R * 0.4
            );
            const layerScale = R * (cfg.gasScale * (0.55 + (g / 6) * 0.65));
            sp.scale.set(layerScale, layerScale * 0.88, 1);
            sp.raycast = () => {};
            volGroup.add(sp);
          }

          // Deep 3-tier field of faint background galaxies/stars, medium members, and bright central cD galaxies/stars
          addMultiMagnitudeStarField(volGroup, R * cfg.starSpan, cfg.starCount, cfg.starColors, 0.88);
        }
      }
      function processNextVolumetricBatch() {
        const startT = performance.now();
        while (vIdx < volQueue.length && (performance.now() - startT) < 8) {
          buildOneVolumetric(volQueue[vIdx++]);
        }
        if (vIdx < volQueue.length) {
          setTimeout(processNextVolumetricBatch, 0);
        }
      }
      processNextVolumetricBatch();
    }
