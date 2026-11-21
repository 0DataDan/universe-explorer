// NOVA Photorealistic 3D Spherical FBM Noise & PBR Canvas Texture Engine
import * as THREE from 'three';

// === PHOTOREALISTIC 3D SPHERICAL FBM NOISE & PBR TEXTURE/BUMP ENGINE ===
    export const nasaTexCache = {};
    export const nasaBumpCache = {};

    // Fast deterministic 3D spatial hash & gradient/value noise for seamless spherical mapping
    const _perm = new Uint8Array(512);
    (function initPerm() {
      let s = 1337;
      const p = new Uint8Array(256);
      for (let i = 0; i < 256; i++) p[i] = i;
      for (let i = 255; i > 0; i--) {
        s = (s * 16807) % 2147483647;
        const j = s % (i + 1);
        const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
      }
      for (let i = 0; i < 512; i++) _perm[i] = p[i & 255];
    })();

    function _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function _lerp(a, b, t) { return a + t * (b - a); }

    export function noise3D(x, y, z) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
      x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
      const u = _fade(x), v = _fade(y), w = _fade(z);
      const A = _perm[X] + Y, AA = _perm[A] + Z, AB = _perm[A + 1] + Z;
      const B = _perm[X + 1] + Y, BA = _perm[B] + Z, BB = _perm[B + 1] + Z;
      const h = (n) => (_perm[n & 511] / 127.5) - 1.0;
      return _lerp(
        _lerp(_lerp(h(AA), h(BA), u), _lerp(h(AB), h(BB), u), v),
        _lerp(_lerp(h(AA + 1), h(BA + 1), u), _lerp(h(AB + 1), h(BB + 1), u), v),
        w
      );
    }

    export function fbm3D(x, y, z, octaves = 5, lacunarity = 2.05, gain = 0.5) {
      let sum = 0, amp = 0.5, freq = 1.0, norm = 0;
      for (let i = 0; i < octaves; i++) {
        sum += amp * noise3D(x * freq, y * freq, z * freq);
        norm += amp;
        freq *= lacunarity;
        amp *= gain;
      }
      return (sum / norm) * 0.5 + 0.5; // normalized [0, 1]
    }

    export function ridgedFbm3D(x, y, z, octaves = 4) {
      let sum = 0, amp = 0.5, freq = 1.0, norm = 0;
      for (let i = 0; i < octaves; i++) {
        let n = 1.0 - Math.abs(noise3D(x * freq, y * freq, z * freq));
        n *= n;
        sum += n * amp;
        norm += amp;
        freq *= 2.1;
        amp *= 0.5;
      }
      return sum / norm;
    }

    export function colorRamp(t, stops) {
      const c = Math.max(0, Math.min(1, t));
      for (let i = 0; i < stops.length - 1; i++) {
        const [t0, r0, g0, b0] = stops[i];
        const [t1, r1, g1, b1] = stops[i + 1];
        if (c >= t0 && c <= t1) {
          const f = (c - t0) / Math.max(0.0001, t1 - t0);
          return [
            r0 + (r1 - r0) * f,
            g0 + (g1 - g0) * f,
            b0 + (b1 - b0) * f
          ];
        }
      }
      const last = stops[stops.length - 1];
      return [last[1], last[2], last[3]];
    }

    export function buildNASACanvasTexture(kind) {
      if (nasaTexCache[kind]) return nasaTexCache[kind];

      const w = 512, h = 256;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = w; bumpCanvas.height = h;
      const bumpCtx = bumpCanvas.getContext('2d');
      const bumpImg = bumpCtx.createImageData(w, h);
      const bData = bumpImg.data;

      let seedOffset = 0;
      for (let i = 0; i < kind.length; i++) seedOffset = (seedOffset * 31 + kind.charCodeAt(i)) % 997;
      const sxOff = (seedOffset % 17) * 3.7;
      const syOff = ((seedOffset >> 2) % 19) * 4.3;
      const szOff = ((seedOffset >> 4) % 23) * 2.9;

      // Pre-generate 3D crater centers for rocky/cratered bodies
      const craters = [];
      if (['moon', 'mercury', 'ceres', 'mars', 'sedna', 'oumuamua', 'comet'].includes(kind)) {
        let s = seedOffset + 101;
        const rand = () => { s = (s * 16807) % 2147483647; return (s & 0x7fffffff) / 2147483647; };
        const count = (kind === 'moon' || kind === 'mercury') ? 95 : 48;
        for (let i = 0; i < count; i++) {
          const z = rand() * 2 - 1;
          const a = rand() * Math.PI * 2;
          const rProj = Math.sqrt(Math.max(0, 1 - z * z));
          craters.push({
            cx: rProj * Math.cos(a),
            cy: z,
            cz: rProj * Math.sin(a),
            rad: 0.04 + Math.pow(rand(), 2.6) * 0.24,
            depth: 0.35 + rand() * 0.55
          });
        }
      }

      for (let py = 0; py < h; py++) {
        const v = py / (h - 1);
        const phi = v * Math.PI;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        const lat = Math.abs(v - 0.5) * 2.0; // 0 at equator, 1 at poles

        for (let px = 0; px < w; px++) {
          const u = px / w;
          const theta = u * Math.PI * 2.0;
          const nx = sinPhi * Math.cos(theta);
          const ny = cosPhi;
          const nz = sinPhi * Math.sin(theta);

          const X = nx + sxOff, Y = ny + syOff, Z = nz + szOff;
          let r = 128, g = 128, b = 128, bump = 0.5;

          if (kind === 'sun' || kind.startsWith('star-') || kind === 'stephenson') {
            // Domain-warped solar magnetohydrodynamic plasma granulation
            const qx = fbm3D(X * 3.8, Y * 3.8, Z * 3.8, 4);
            const qy = fbm3D(X * 3.8 + 5.2, Y * 3.8 + 1.3, Z * 3.8 + 2.8, 4);
            const gran = fbm3D(X * 6.5 + qx * 2.2, Y * 6.5 + qy * 2.2, Z * 6.5 + qx * 1.8, 5);
            const filaments = ridgedFbm3D(X * 4.5 + qy * 1.5, Y * 4.5 - qx * 1.5, Z * 4.5, 4);
            const spotMask = fbm3D(X * 2.1, Y * 2.1, Z * 2.1, 3);
            let t = gran * 0.65 + filaments * 0.35;
            if (spotMask < 0.27) {
              const sm = Math.pow((0.27 - spotMask) / 0.27, 1.5);
              t = Math.max(0.02, t - sm * 0.65);
            }

            let ramp;
            if (kind === 'star-m' || kind === 'stephenson') {
              ramp = [[0.0, 45, 5, 5], [0.35, 155, 22, 12], [0.65, 235, 75, 25], [0.88, 254, 175, 110], [1.0, 255, 240, 215]];
            } else if (kind === 'star-a') {
              ramp = [[0.0, 20, 55, 150], [0.4, 65, 135, 245], [0.72, 175, 215, 255], [1.0, 255, 255, 255]];
            } else if (kind === 'star-wd') {
              ramp = [[0.0, 55, 110, 220], [0.45, 165, 210, 255], [0.78, 235, 248, 255], [1.0, 255, 255, 255]];
            } else if (kind === 'star-k') {
              ramp = [[0.0, 75, 20, 5], [0.38, 195, 72, 14], [0.7, 248, 150, 45], [0.92, 255, 225, 155], [1.0, 255, 250, 225]];
            } else if (kind === 'star-f') {
              ramp = [[0.0, 140, 95, 20], [0.4, 230, 185, 65], [0.72, 254, 240, 175], [1.0, 255, 255, 255]];
            } else {
              // G-type / Sun
              ramp = [[0.0, 85, 22, 4], [0.32, 195, 72, 8], [0.58, 245, 145, 18], [0.82, 254, 218, 95], [1.0, 255, 252, 230]];
            }
            [r, g, b] = colorRamp(t, ramp);
            bump = t;
          }
          else if (kind === 'earth') {
            const warp = fbm3D(X * 2.2, Y * 2.2, Z * 2.2, 3) * 0.55;
            const elev = fbm3D(X * 1.85 + warp, Y * 1.85 - warp, Z * 1.85 + warp, 6);
            const detail = fbm3D(X * 9.0, Y * 9.0, Z * 9.0, 4);
            const moisture = fbm3D(X * 2.6 + 9.1, Y * 2.6 + 3.4, Z * 2.6, 4);
            const seaLevel = 0.515;

            if (lat + (detail - 0.5) * 0.14 > 0.84) {
              // Polar ice caps
              [r, g, b] = [242, 248, 255];
              bump = 0.62;
            } else if (elev < seaLevel) {
              // Deep ocean to turquoise continental shelf
              const depth = elev / seaLevel;
              const oRamp = [
                [0.0, 4, 18, 48],
                [0.65, 8, 45, 98],
                [0.90, 14, 88, 152],
                [1.0, 28, 138, 178]
              ];
              [r, g, b] = colorRamp(Math.pow(depth, 1.3), oRamp);
              bump = 0.15;
            } else {
              // Landmasses: beaches, forests, savannas, deserts, alpine peaks
              const landH = (elev - seaLevel) / (1.0 - seaLevel);
              const arid = Math.max(0, 1.0 - Math.abs(lat - 0.26) * 3.5) * (1.0 - moisture);
              if (landH > 0.62) {
                const mRamp = [[0.62, 92, 82, 68], [0.82, 135, 128, 120], [1.0, 245, 248, 252]];
                [r, g, b] = colorRamp(landH, mRamp);
              } else if (arid > 0.42) {
                const dRamp = [[0.0, 168, 135, 78], [0.5, 204, 158, 92], [1.0, 218, 178, 118]];
                [r, g, b] = colorRamp(detail, dRamp);
              } else {
                const vRamp = [[0.0, 22, 72, 34], [0.45, 38, 108, 46], [0.8, 74, 128, 56], [1.0, 112, 118, 68]];
                [r, g, b] = colorRamp(landH * 0.7 + detail * 0.3, vRamp);
              }
              bump = 0.35 + landH * 0.65;
            }

            // Swirling atmospheric clouds
            const cWarp = fbm3D(X * 3.2 + 4.1, Y * 3.2, Z * 3.2, 4);
            const clouds = fbm3D(X * 4.5 + cWarp * 1.6, Y * 4.5 + cWarp, Z * 4.5 - cWarp * 1.4, 5);
            if (clouds > 0.54) {
              const cAlpha = Math.min(0.88, Math.pow((clouds - 0.54) / 0.42, 1.15));
              r = _lerp(r, 250, cAlpha);
              g = _lerp(g, 252, cAlpha);
              b = _lerp(b, 255, cAlpha);
              bump = Math.max(bump, 0.55 + cAlpha * 0.25);
            }
          }
          else if (kind === 'moon' || kind === 'mercury' || kind === 'ceres' || kind === 'comet' || kind === 'oumuamua' || kind === 'sedna') {
            const baseFbm = fbm3D(X * 2.4, Y * 2.4, Z * 2.4, 5);
            const fine = fbm3D(X * 14.0, Y * 14.0, Z * 14.0, 4);
            const mariaNoise = fbm3D(X * 1.35, Y * 1.35, Z * 1.35, 4);

            let cShift = 0;
            for (let i = 0; i < craters.length; i++) {
              const c = craters[i];
              const dx = nx - c.cx, dy = ny - c.cy, dz = nz - c.cz;
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
              if (dist < c.rad * 1.45) {
                const x = dist / c.rad;
                if (x < 0.82) {
                  // Bowl floor
                  cShift -= (1.0 - (x / 0.82) * (x / 0.82)) * c.depth * 0.38;
                } else if (x < 1.15) {
                  // Raised impact rim
                  const rim = Math.sin(((x - 0.82) / 0.33) * Math.PI);
                  cShift += rim * c.depth * 0.32;
                } else {
                  // Ejecta blanket decay
                  const ej = 1.0 - (x - 1.15) / 0.30;
                  cShift += ej * c.depth * 0.08;
                }
              }
            }

            let hVal = baseFbm * 0.65 + fine * 0.35 + cShift;
            if (kind === 'moon' && mariaNoise < 0.46) {
              // Dark basaltic lunar maria plains
              const mFactor = Math.min(1, (0.46 - mariaNoise) * 4.5);
              hVal = _lerp(hVal, 0.26 + fine * 0.12 + cShift * 0.5, mFactor);
            }
            hVal = Math.max(0, Math.min(1, hVal));
            bump = hVal;

            let ramp;
            if (kind === 'moon') {
              ramp = [[0.0, 48, 52, 58], [0.32, 86, 90, 98], [0.58, 148, 152, 160], [0.82, 196, 200, 208], [1.0, 238, 240, 245]];
            } else if (kind === 'mercury') {
              ramp = [[0.0, 58, 53, 48], [0.38, 108, 100, 92], [0.68, 158, 148, 138], [0.9, 198, 188, 176], [1.0, 228, 220, 210]];
            } else if (kind === 'sedna') {
              ramp = [[0.0, 52, 10, 12], [0.4, 125, 26, 22], [0.75, 185, 52, 38], [1.0, 232, 125, 95]];
            } else if (kind === 'oumuamua') {
              ramp = [[0.0, 42, 14, 12], [0.5, 112, 36, 28], [0.85, 168, 68, 52], [1.0, 208, 112, 88]];
            } else if (kind === 'comet') {
              ramp = [[0.0, 22, 30, 42], [0.45, 58, 72, 92], [0.78, 125, 155, 185], [1.0, 215, 242, 255]];
            } else {
              // Ceres
              ramp = [[0.0, 52, 56, 62], [0.45, 112, 116, 124], [0.82, 168, 172, 180], [1.0, 248, 252, 255]];
            }
            [r, g, b] = colorRamp(hVal, ramp);
          }
          else if (kind === 'mars') {
            const warp = fbm3D(X * 2.5, Y * 2.5, Z * 2.5, 4) * 0.45;
            const terrain = fbm3D(X * 2.2 + warp, Y * 2.2 - warp, Z * 2.2, 6);
            const ridges = ridgedFbm3D(X * 5.0, Y * 5.0, Z * 5.0, 4);
            let hVal = terrain * 0.72 + ridges * 0.28;

            // Valles Marineris equatorial canyon scar
            if (Math.abs(ny + 0.08 * Math.sin(theta * 2.0)) < 0.055 && Math.cos(theta - 1.2) > 0.55) {
              hVal *= 0.35;
            }

            if (lat + (terrain - 0.5) * 0.12 > 0.89) {
              [r, g, b] = [248, 240, 232];
              bump = 0.78;
            } else {
              const mRamp = [
                [0.0, 62, 22, 12],
                [0.32, 118, 42, 18],
                [0.55, 178, 72, 28],
                [0.78, 218, 108, 48],
                [1.0, 242, 162, 104]
              ];
              [r, g, b] = colorRamp(hVal, mRamp);
              bump = hVal;
            }
          }
          else if (kind === 'venus') {
            const swirl = fbm3D(X * 2.6, Y * 4.2, Z * 2.6, 5);
            const chevron = Math.sin(ny * 10.0 + swirl * 5.5 + Math.cos(theta) * 1.4) * 0.5 + 0.5;
            const t = swirl * 0.62 + chevron * 0.38;
            const vRamp = [
              [0.0, 115, 52, 12],
              [0.35, 178, 98, 24],
              [0.68, 228, 168, 64],
              [0.9, 250, 222, 138],
              [1.0, 255, 245, 200]
            ];
            [r, g, b] = colorRamp(t, vRamp);
            bump = 0.4 + t * 0.2;
          }
          else if (kind === 'jupiter' || kind === 'saturn' || kind === 'uranus' || kind === 'neptune') {
            // Zonal atmospheric fluid bands + Kelvin-Helmholtz turbulence eddies
            const eddy = fbm3D(X * 4.2, Y * 8.5, Z * 4.2, 5);
            const fineTurb = fbm3D(X * 10.0 + eddy * 2.0, Y * 16.0, Z * 10.0 - eddy * 2.0, 4);
            const bandFreq = kind === 'jupiter' ? 18.0 : kind === 'saturn' ? 14.0 : 8.0;
            const warpedLat = ny + (eddy - 0.5) * (kind === 'jupiter' ? 0.16 : 0.08) + (fineTurb - 0.5) * 0.04;
            const bandWave = Math.sin(warpedLat * bandFreq) * 0.5 + 0.5;
            let t = bandWave * 0.65 + fineTurb * 0.35;

            if (kind === 'jupiter') {
              const jRamp = [
                [0.0, 92, 48, 28],
                [0.22, 158, 82, 42],
                [0.45, 212, 148, 96],
                [0.68, 238, 206, 168],
                [0.88, 248, 235, 215],
                [1.0, 182, 108, 62]
              ];
              [r, g, b] = colorRamp(t, jRamp);

              // Great Red Spot anticyclonic vortex in southern hemisphere
              const dLat = (ny - 0.36) / 0.11;
              let dLon = Math.atan2(nz, nx) - 0.8;
              if (dLon > Math.PI) dLon -= Math.PI * 2;
              if (dLon < -Math.PI) dLon += Math.PI * 2;
              dLon /= 0.22;
              const spotDist = Math.sqrt(dLat * dLat + dLon * dLon);
              if (spotDist < 1.25) {
                const swirlAng = Math.atan2(dLat, dLon) + (1.25 - spotDist) * 4.5;
                const sNoise = fbm3D(Math.cos(swirlAng) * 3, Math.sin(swirlAng) * 3, spotDist * 4, 3);
                const sFactor = Math.pow(Math.max(0, 1.0 - spotDist / 1.25), 1.4);
                const spotCol = colorRamp(sNoise, [[0.0, 135, 24, 18], [0.5, 205, 58, 32], [1.0, 245, 145, 105]]);
                r = _lerp(r, spotCol[0], sFactor);
                g = _lerp(g, spotCol[1], sFactor);
                b = _lerp(b, spotCol[2], sFactor);
              }
            } else if (kind === 'saturn') {
              const sRamp = [
                [0.0, 128, 98, 58],
                [0.3, 186, 152, 98],
                [0.6, 226, 198, 142],
                [0.85, 246, 228, 186],
                [1.0, 208, 178, 122]
              ];
              [r, g, b] = colorRamp(t, sRamp);
            } else if (kind === 'uranus') {
              const uRamp = [
                [0.0, 42, 148, 188],
                [0.45, 92, 198, 228],
                [0.8, 156, 230, 248],
                [1.0, 212, 246, 255]
              ];
              [r, g, b] = colorRamp(t * 0.55 + (1.0 - lat) * 0.45, uRamp);
            } else {
              // Neptune
              const nRamp = [
                [0.0, 16, 42, 128],
                [0.4, 32, 82, 196],
                [0.75, 68, 138, 238],
                [0.95, 168, 218, 255],
                [1.0, 235, 248, 255]
              ];
              [r, g, b] = colorRamp(t, nRamp);
            }
            bump = 0.45 + t * 0.18;
          }
          else {
            // Nebulae & Deep-Space Galaxies: volumetric filamentary emission clouds
            const w1 = fbm3D(X * 2.5, Y * 2.5, Z * 2.5, 4);
            const fil = ridgedFbm3D(X * 3.8 + w1 * 1.8, Y * 3.8 - w1 * 1.5, Z * 3.8, 5);
            const glow = fbm3D(X * 5.5, Y * 5.5, Z * 5.5, 4);
            const t = fil * 0.65 + glow * 0.35;
            let ramp;
            if (kind === 'nebula-orion') {
              ramp = [[0.0, 12, 4, 24], [0.38, 98, 18, 88], [0.68, 218, 58, 132], [0.9, 125, 205, 252], [1.0, 255, 245, 255]];
            } else if (kind === 'nebula-eagle') {
              // SHO Hubble Palette: Oxygen blue top, Sulfur red/gold base, dark pillar silhouettes
              const dustPillar = Math.exp(-Math.pow((nx * 1.5 + (w1 - 0.5) * 0.3) * 5.0, 2.0)) * Math.max(0, ny + 0.3);
              const sho = Math.max(0, 1.0 - dustPillar * 0.95) * t;
              ramp = [[0.0, 8, 12, 24], [0.35, 2, 132, 199], [0.65, 202, 138, 4], [0.85, 239, 68, 68], [1.0, 255, 248, 220]];
              [r, g, b] = colorRamp(sho, ramp);
              bump = sho;
            } else if (kind === 'nebula-crab') {
              // Synchrotron blue core + orange/green filamentary cage
              const coreBlue = Math.max(0, 1.0 - t * 1.2);
              ramp = [[0.0, 56, 189, 248], [0.4, 249, 115, 22], [0.75, 74, 222, 128], [1.0, 254, 240, 138]];
              [r, g, b] = colorRamp(t, ramp);
              bump = t;
            } else if (kind === 'galaxy-el-gordo') {
              // Chandra X-ray teardrop blue shock wake + red/yellow background galaxies
              const xrayWake = Math.max(0, 1.0 - Math.abs(nx - ny) * 1.5) * t;
              ramp = [[0.0, 10, 25, 60], [0.35, 29, 78, 216], [0.7, 96, 165, 250], [1.0, 255, 255, 255]];
              [r, g, b] = colorRamp(xrayWake, ramp);
              bump = xrayWake;
            } else if (kind === 'galaxy-cen-a') {
              const dust = Math.exp(-Math.pow((ny + (w1 - 0.5) * 0.18) * 9.0, 2.0));
              const core = Math.max(0, 1.0 - dust * 0.88) * t;
              ramp = [[0.0, 14, 10, 12], [0.35, 138, 72, 22], [0.7, 238, 178, 72], [1.0, 255, 248, 215]];
              [r, g, b] = colorRamp(core, ramp);
              bump = core;
            } else {
              ramp = [[0.0, 8, 14, 34], [0.4, 38, 78, 168], [0.72, 218, 158, 62], [1.0, 255, 245, 220]];
            }
            if (kind !== 'galaxy-cen-a') {
              [r, g, b] = colorRamp(t, ramp);
              bump = t;
            }
          }

          const idx = (py * w + px) * 4;
          data[idx] = Math.max(0, Math.min(255, r | 0));
          data[idx + 1] = Math.max(0, Math.min(255, g | 0));
          data[idx + 2] = Math.max(0, Math.min(255, b | 0));
          data[idx + 3] = 255;

          const bVal = Math.max(0, Math.min(255, (bump * 255) | 0));
          bData[idx] = bVal;
          bData[idx + 1] = bVal;
          bData[idx + 2] = bVal;
          bData[idx + 3] = 255;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      bumpCtx.putImageData(bumpImg, 0, 0);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;

      const bTex = new THREE.CanvasTexture(bumpCanvas);
      bTex.wrapS = THREE.RepeatWrapping;
      bTex.wrapT = THREE.ClampToEdgeWrapping;
      bTex.needsUpdate = true;

      nasaTexCache[kind] = tex;
      nasaBumpCache[kind] = bTex;
      return tex;
    }

    export function classifyMeshTextureKind(name, typeStr) {
      const n = (name || '').toLowerCase();
      const t = (typeStr || '').toLowerCase();
      if (n.includes('moon') || n.includes('luna')) return 'moon';
      if (n.includes('mercury')) return 'mercury';
      if (n.includes('venus')) return 'venus';
      if (n.includes('earth') || n.includes('terra')) return 'earth';
      if (n.includes('mars')) return 'mars';
      if (n.includes('ceres')) return 'ceres';
      if (n.includes('jupiter')) return 'jupiter';
      if (n.includes('saturn')) return 'saturn';
      if (n.includes('uranus')) return 'uranus';
      if (n.includes('neptune')) return 'neptune';
      if (n.includes('sedna')) return 'sedna';
      if (n.includes('oumuamua')) return 'oumuamua';
      if (n.includes('halley') || t.includes('comet')) return 'comet';
      if (n.includes('orion nebula')) return 'nebula-orion';
      if (n.includes('eagle nebula')) return 'nebula-eagle';
      if (n.includes('crab nebula')) return 'nebula-crab';
      if (n.includes('centaurus a')) return 'galaxy-cen-a';
      if (n.includes('stephenson')) return 'stephenson';
      if (n.includes('polaris')) return 'star-f';
      if (n.includes('proxima') || n.includes('barnard') || n.includes('trappist') || n.includes('betelgeuse') || t.includes('red dwarf')) return 'star-m';
      if (n.includes('sirius b') || t.includes('white dwarf')) return 'star-wd';
      if (n.includes('sirius') || n.includes('earendel')) return 'star-a';
      if (n.includes('centauri b') || n.includes('toliman')) return 'star-k';
      if (n.includes('sun') || n.includes('sol') || n.includes('centauri a') || n.includes('rigil')) return 'sun';
      if (n.includes('el gordo')) return 'galaxy-el-gordo';
      if (n.includes('centaurus a') || n.includes('caldwell 77')) return 'galaxy-cen-a';
      if (n.includes('magellanic') || n.includes('attractor') || n.includes('shapley') || n.includes('smacs') || n.includes('gn-z11')) return 'galaxy-cluster';
      return null;
    }
