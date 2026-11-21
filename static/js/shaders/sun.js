// NOVA Real-Time Animated Solar Photosphere & Corona Shaders
import * as THREE from 'three';

// === REAL-TIME ANIMATED SOLAR PHOTOSPHERE, GRANULATION & LIMB SPICULE SHADER ===
    window.sunShaderUniforms = {
      uTime: { value: 0.0 }
    };

    export function createAnimatedSunMaterial() {
      return new THREE.ShaderMaterial({
        uniforms: window.sunShaderUniforms,
        depthWrite: true,
        depthTest: true,
        vertexShader: `
          #include <common>
          #include <logdepthbuf_pars_vertex>
          varying vec3 vNormal;
          varying vec3 vPosition;
          varying vec3 vWorldNormal;
          varying vec3 vViewDir;
          uniform float uTime;

          float hash31(vec3 p) {
            p = fract(p * 0.1031);
            p += dot(p, p.yzx + 33.33);
            return fract((p.x + p.y) * p.z);
          }
          float vNoise(vec3 x) {
            vec3 i = floor(x);
            vec3 f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
                  mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
              mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                  mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z
            );
          }

          void main() {
            vNormal = normalize(normal);
            vPosition = normalize(position);

            // Subtle limb-visible photospheric plasma boiling undulation
            float boil = vNoise(vPosition * 18.0 + vec3(uTime * 0.85, -uTime * 0.65, uTime * 0.75)) * 0.65
                       + vNoise(vPosition * 36.0 - vec3(uTime * 1.35, uTime * 1.1, -uTime * 0.95)) * 0.35;
            vec3 displaced = position + normal * ((boil - 0.5) * 0.032);

            vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            vViewDir = normalize(cameraPosition - worldPos.xyz);

            gl_Position = projectionMatrix * viewMatrix * worldPos;
            #include <logdepthbuf_vertex>
          }
        `,
        fragmentShader: `
          #include <common>
          #include <logdepthbuf_pars_fragment>
          varying vec3 vNormal;
          varying vec3 vPosition;
          varying vec3 vWorldNormal;
          varying vec3 vViewDir;
          uniform float uTime;

          float hash(vec3 p) {
            p = fract(p * vec3(443.897, 441.423, 437.195));
            p += dot(p, p.yzx + 19.19);
            return fract((p.x + p.y) * p.z);
          }

          float noise3D(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                  mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
              mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                  mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z
            );
          }

          // Multi-octave fBm plasma turbulence
          float fbm(vec3 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 5; i++) {
              v += a * noise3D(p);
              p = p * 2.08 + vec3(13.7, -9.2, 17.4);
              a *= 0.5;
            }
            return v;
          }

          // Sharp cellular ridge noise for bubbling Bénard solar convection cells
          float granulationCells(vec3 p) {
            float n1 = 1.0 - abs(noise3D(p) * 2.0 - 1.0);
            float n2 = 1.0 - abs(noise3D(p * 2.12 + vec3(7.3, -4.1, 11.8)) * 2.0 - 1.0);
            float n3 = 1.0 - abs(noise3D(p * 4.25 - vec3(3.7, 9.4, -6.2)) * 2.0 - 1.0);
            return pow(n1 * 0.52 + n2 * 0.33 + n3 * 0.15, 1.45);
          }

          void main() {
            #include <logdepthbuf_fragment>
            float t = uTime * 0.72;
            vec3 p = normalize(vPosition);

            vec3 warp = vec3(
              fbm(p * 5.0 + vec3(t * 0.55, -t * 0.42, t * 0.25)),
              fbm(p * 5.0 + vec3(-t * 0.48, t * 0.52, 8.3 - t * 0.3)),
              fbm(p * 5.0 + vec3(4.1 + t * 0.35, -t * 0.5, t * 0.45))
            );

            float fineCells = granulationCells(p * 28.0 + warp * 2.8 + vec3(t * 1.15, -t * 0.95, t * 1.05));
            float medCells  = granulationCells(p * 13.0 + warp * 2.0 - vec3(t * 0.75, t * 0.65, -t * 0.8));
            float macroFlow = fbm(p * 4.2 + warp * 1.1 + vec3(0.0, t * 0.3, 0.0));

            float latBelt = exp(-pow((abs(p.y) - 0.26) * 4.5, 2.0));
            float activeField = fbm(p * 6.0 + warp * 0.55 + vec3(t * 0.16, 0.0, -t * 0.14));
            float spotMetric = activeField * (0.68 + 0.42 * latBelt);
            float umbra    = smoothstep(0.75, 0.84, spotMetric);
            float penumbra = smoothstep(0.65, 0.76, spotMetric);

            float filamentNoise = granulationCells(p * 34.0 - warp * 3.2 + vec3(t * 1.4));
            float faculae = smoothstep(0.47, 0.60, spotMetric) * (1.0 - penumbra) * pow(filamentNoise, 0.85);

            float heat = fineCells * 0.52 + medCells * 0.33 + macroFlow * 0.15;
            heat = pow(clamp(heat, 0.0, 1.0), 1.02);
            heat += faculae * 0.48;
            heat -= penumbra * 0.24;
            heat -= umbra * 0.34;
            heat = clamp(heat, 0.0, 1.35);

            float mu = clamp(dot(normalize(vWorldNormal), normalize(vViewDir)), 0.0, 1.0);
            float limbDarkening = pow(mu, 0.55);
            float rimFactor = pow(1.0 - mu, 2.35);

            float spiculeWave = granulationCells(p * 38.0 + vec3(uTime * 1.9, -uTime * 1.6, uTime * 1.7));
            float rimSpicules = rimFactor * (0.6 + 0.95 * spiculeWave);

            vec3 colUmbra    = vec3(0.22, 0.055, 0.01);
            vec3 colDarkLane = vec3(0.72, 0.28, 0.03);
            vec3 colPhoto    = vec3(0.98, 0.68, 0.14);
            vec3 colGranule  = vec3(1.00, 0.90, 0.48);
            vec3 colFaculae  = vec3(1.00, 0.99, 0.90);
            vec3 colChromo   = vec3(0.96, 0.45, 0.06);

            vec3 baseColor;
            if (heat < 0.25) {
              baseColor = mix(colUmbra, colDarkLane, heat / 0.25);
            } else if (heat < 0.56) {
              baseColor = mix(colDarkLane, colPhoto, (heat - 0.25) / 0.31);
            } else if (heat < 0.84) {
              baseColor = mix(colPhoto, colGranule, (heat - 0.56) / 0.28);
            } else {
              baseColor = mix(colGranule, colFaculae, clamp((heat - 0.84) / 0.38, 0.0, 1.0));
            }

            vec3 limbTinted = mix(colChromo * 0.82, baseColor, 0.28 + 0.72 * limbDarkening);
            vec3 finalColor = limbTinted
                            + colChromo * rimSpicules * 0.65
                            + colFaculae * (faculae * (1.0 - mu * 0.6) * 0.52);

            gl_FragColor = vec4(finalColor, 1.0);
          }
        `
      });
    }
    
    export function createAnimatedCoronaLayer(sunRadius) {
      const coronaGeo = new THREE.SphereGeometry(sunRadius * 1.045, 72, 72);
      const coronaMat = new THREE.ShaderMaterial({
        uniforms: window.sunShaderUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        vertexShader: `
          varying vec3 vPos;
          varying vec3 vWorldNormal;
          varying vec3 vViewDir;
          uniform float uTime;

          float hash31(vec3 p) {
            p = fract(p * 0.1031);
            p += dot(p, p.yzx + 33.33);
            return fract((p.x + p.y) * p.z);
          }
          float vNoise(vec3 x) {
            vec3 i = floor(x);
            vec3 f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
                  mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
              mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                  mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z
            );
          }

          void main() {
            vPos = normalize(position);
            // Turbulent solar flare eruptions & prominence loops along the limb
            float tongue1 = vNoise(vPos * 14.0 + vec3(uTime * 1.1, -uTime * 0.85, uTime * 0.95));
            float tongue2 = vNoise(vPos * 28.0 - vec3(uTime * 1.8, uTime * 1.4, -uTime * 1.5));
            float flareLift = pow(tongue1 * 0.65 + tongue2 * 0.35, 1.6);
            vec3 displaced = position + normal * (flareLift * 0.045);
            vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            vViewDir = normalize(cameraPosition - worldPos.xyz);
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `,
        fragmentShader: `
          varying vec3 vPos;
          varying vec3 vWorldNormal;
          varying vec3 vViewDir;
          uniform float uTime;

          float hash(vec3 p) {
            p = fract(p * vec3(443.897, 441.423, 437.195));
            p += dot(p, p.yzx + 19.19);
            return fract((p.x + p.y) * p.z);
          }
          float noise3D(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                  mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
              mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                  mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z
            );
          }

          void main() {
            float ndotv = abs(dot(normalize(vWorldNormal), normalize(vViewDir)));
            // Feather completely to 0 at the outer silhouette so no bubble ring ever appears
            float outerFade = smoothstep(0.12, 0.48, ndotv);
            float innerFade = pow(clamp(1.0 - ndotv, 0.0, 1.0), 2.2);
            float rim = outerFade * innerFade;
            float spicule1 = 1.0 - abs(noise3D(vPos * 18.0 + vec3(uTime * 1.25, -uTime * 0.95, uTime * 0.85)) * 2.0 - 1.0);
            float spicule2 = 1.0 - abs(noise3D(vPos * 38.0 - vec3(uTime * 2.2, uTime * 1.65, -uTime * 1.4)) * 2.0 - 1.0);
            float flareArc = smoothstep(0.50, 0.92, noise3D(vPos * 8.0 + vec3(0.0, uTime * 0.45, -uTime * 0.35)));
            float prominence = pow(spicule1 * 0.55 + spicule2 * 0.45, 1.7) * flareArc;
            float alpha = rim * prominence * 1.35;
            vec3 midFlare = vec3(1.00, 0.62, 0.12);
            vec3 hotCore  = vec3(1.00, 0.94, 0.62);
            vec3 col = mix(midFlare, hotCore, smoothstep(0.35, 0.95, prominence));
            gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.65));
          }
        `
      });
      const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
      coronaMesh.name = "sun-chromosphere-spicules";
      coronaMesh.raycast = () => {};
      return coronaMesh;
    }
