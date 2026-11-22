import * as THREE from 'three';

// ============================================================================
// NOVA 3D SCENE DEPTH ENGINE + CORONA-AWARE PRE-RENDER OCCLUSION
// ============================================================================
window._novaDepthEngineInitialized = false;
window._novaAsteroidBelts = [];
window._novaOrbitShaderLines = [];
window._hiddenForThisFrame = [];
window._activeScreenOccluders = [];

function hideObjectAndAssociatedVisuals(obj) {
  if (!obj || !obj.visible) return;
  window._hiddenForThisFrame.push(obj);
  obj.visible = false;
}

function removeOldBeltMeshes(sc) {
  const toRemove = [];
  sc.traverse(function(o) {
    if (o.name === "nova-instanced-belt" || o.name === "nova-belt-dust-glow") {
      toRemove.push(o);
    }
  });
  for (let i = 0; i < toRemove.length; i++) {
    if (toRemove[i].parent) toRemove[i].parent.remove(toRemove[i]);
  }
}

function getPlanetAtmosphericColor(id) {
  const k = String(id || "").toLowerCase();
  if (k.indexOf("earth") !== -1) return new THREE.Color(0x38bdf8);
  if (k.indexOf("venus") !== -1) return new THREE.Color(0xfbbf24);
  if (k.indexOf("mars") !== -1) return new THREE.Color(0xf97316);
  if (k.indexOf("jupiter") !== -1) return new THREE.Color(0xfde68a);
  if (k.indexOf("saturn") !== -1) return new THREE.Color(0xfef08a);
  if (k.indexOf("uranus") !== -1) return new THREE.Color(0x67e8f9);
  if (k.indexOf("neptune") !== -1) return new THREE.Color(0x3b82f6);
  return new THREE.Color(0xcbd5e1);
}

export function buildSunlitAsteroidBelt(sc, count, innerRad, outerRad, thicknessY, coreColorHex, highlightColorHex, opacityScale) {
  const positions = new Float32Array(count * 3);
  const aOrbitParams = new Float32Array(count * 4);
  const aVisualParams = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const u = (Math.random() + Math.random() + Math.random()) / 3.0;
    const r = innerRad + u * (outerRad - innerRad);
    const theta = Math.random() * Math.PI * 2.0;
    const speed = (0.24 / Math.pow(Math.max(1.0, r * 0.1), 1.35)) * (0.85 + Math.random() * 0.3);
    const yOff = (Math.random() - 0.5) * 2.0 * thicknessY * (0.35 + 0.65 * Math.random());

    positions[i * 3 + 0] = Math.cos(theta) * r;
    positions[i * 3 + 1] = yOff;
    positions[i * 3 + 2] = Math.sin(theta) * r;

    aOrbitParams[i * 4 + 0] = r;
    aOrbitParams[i * 4 + 1] = theta;
    aOrbitParams[i * 4 + 2] = speed;
    aOrbitParams[i * 4 + 3] = yOff;

    const sizeRoll = Math.pow(Math.random(), 4.0);
    aVisualParams[i * 3 + 0] = 1.15 + sizeRoll * 3.6;
    aVisualParams[i * 3 + 1] = 0.55 + Math.random() * 0.65;
    aVisualParams[i * 3 + 2] = Math.random() * 6.283;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("aOrbitParams", new THREE.BufferAttribute(aOrbitParams, 4));
  geom.setAttribute("aVisualParams", new THREE.BufferAttribute(aVisualParams, 3));

  const vShader = [
    "attribute vec4 aOrbitParams;",
    "attribute vec3 aVisualParams;",
    "uniform float uTime;",
    "varying vec3 vWorldPos;",
    "varying float vAlbedo;",
    "void main() {",
    "  float r = aOrbitParams.x;",
    "  float ang = aOrbitParams.y + uTime * aOrbitParams.z;",
    "  float yOff = aOrbitParams.w;",
    "  vec3 localPos = vec3(",
    "    cos(ang) * r,",
    "    yOff + sin(ang * 2.0 + aVisualParams.z) * (yOff * 0.2),",
    "    sin(ang) * r",
    "  );",
    "  vec4 wp = modelMatrix * vec4(localPos, 1.0);",
    "  vWorldPos = wp.xyz;",
    "  vAlbedo = aVisualParams.y;",
    "  vec4 mvPos = viewMatrix * wp;",
    "  gl_Position = projectionMatrix * mvPos;",
    "  float dist = max(1.0, -mvPos.z);",
    "  gl_PointSize = clamp(aVisualParams.x * (42.0 / dist), 1.0, 5.5);",
    "}"
  ].join("\n");

  const fShader = [
    "uniform vec3 uCoreColor;",
    "uniform vec3 uHighlightColor;",
    "uniform float uOpacity;",
    "varying vec3 vWorldPos;",
    "varying float vAlbedo;",
    "void main() {",
    "  vec2 uv = gl_PointCoord * 2.0 - 1.0;",
    "  float r2 = dot(uv, uv);",
    "  if (r2 > 1.0) discard;",
    "  vec3 localNorm = normalize(vec3(uv.x, -uv.y, sqrt(max(0.0, 1.0 - r2))));",
    "  vec3 sunDir = normalize(-vWorldPos);",
    "  vec3 viewDir = normalize(cameraPosition - vWorldPos);",
    "  float phaseCos = dot(sunDir, viewDir) * 0.5 + 0.5;",
    "  float rockLight = clamp(0.35 + 0.65 * localNorm.z + 0.35 * localNorm.x, 0.2, 1.35);",
    "  float camDist = length(cameraPosition - vWorldPos);",
    "  float sunCamDist = length(cameraPosition);",
    "  float depthAtten = clamp(1.22 - (camDist / max(8.0, sunCamDist * 1.45)) * 0.52, 0.32, 1.18);",
    "  float macroFade = 1.0 - smoothstep(130.0, 250.0, camDist);",
    "  float closeupBoost = mix(2.1, 1.0, smoothstep(6.0, 22.0, camDist));",
    "  vec3 col = mix(uCoreColor, uHighlightColor, clamp(rockLight * 0.65 + phaseCos * 0.25, 0.0, 1.0));",
    "  col *= vAlbedo * depthAtten * (0.75 + 0.45 * rockLight);",
    "  float edgeSoft = smoothstep(1.0, 0.35, r2);",
    "  float alpha = clamp(uOpacity * closeupBoost * edgeSoft * macroFade * depthAtten, 0.0, 0.92);",
    "  if (alpha <= 0.01) discard;",
    "  gl_FragColor = vec4(col, alpha);",
    "}"
  ].join("\n");

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    uniforms: {
      uTime: { value: 0.0 },
      uCoreColor: { value: new THREE.Color(coreColorHex) },
      uHighlightColor: { value: new THREE.Color(highlightColorHex) },
      uOpacity: { value: opacityScale }
    },
    vertexShader: vShader,
    fragmentShader: fShader
  });

  const pointsObj = new THREE.Points(geom, mat);
  pointsObj.frustumCulled = false;
  pointsObj.name = "nova-instanced-belt";
  sc.add(pointsObj);
  window._novaAsteroidBelts.push(pointsObj);

  const midRad = (innerRad + outerRad) * 0.5;
  const tubeRad = (outerRad - innerRad) * 0.48;
  const dustGeom = new THREE.TorusGeometry(midRad, tubeRad, 14, 96);
  dustGeom.rotateX(Math.PI * 0.5);
  dustGeom.scale(1.0, Math.min(0.28, (thicknessY * 0.5) / Math.max(0.1, tubeRad)), 1.0);
  dustGeom.computeVertexNormals();
  const dustMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uDustColor: { value: new THREE.Color(highlightColorHex) },
      uBaseAlpha: { value: opacityScale * 0.045 }
    },
    vertexShader: [
      "varying vec3 vWPos;",
      "varying vec3 vWNorm;",
      "void main() {",
      "  vec4 wp = modelMatrix * vec4(position, 1.0);",
      "  vWPos = wp.xyz;",
      "  vWNorm = normalize(mat3(modelMatrix) * normal);",
      "  gl_Position = projectionMatrix * viewMatrix * wp;",
      "}"
    ].join("\n"),
    fragmentShader: [
      "uniform vec3 uDustColor;",
      "uniform float uBaseAlpha;",
      "varying vec3 vWPos;",
      "varying vec3 vWNorm;",
      "void main() {",
      "  vec3 viewDir = normalize(cameraPosition - vWPos);",
      "  float softEdge = pow(abs(dot(vWNorm, viewDir)), 1.75);",
      "  float camDist = length(cameraPosition - vWPos);",
      "  float fade = (1.0 - smoothstep(125.0, 240.0, camDist)) * smoothstep(5.0, 16.0, camDist);",
      "  gl_FragColor = vec4(uDustColor, uBaseAlpha * softEdge * fade);",
      "}"
    ].join("\n")
  });
  const dustMesh = new THREE.Mesh(dustGeom, dustMat);
  dustMesh.name = "nova-belt-dust-glow";
  sc.add(dustMesh);
  window._novaAsteroidBelts.push(dustMesh);
}

export function upgradeOrbitLinesAndTerminators(sc, celObjs) {
  const planetByRadius = [];
  const tempP = new THREE.Vector3();

  for (let i = 0; i < celObjs.length; i++) {
    const m = celObjs[i];
    if (!m || !m.userData) continue;
    const id = String(m.userData.id || m.userData.name || m.name || "").toLowerCase();
    m.getWorldPosition(tempP);
    const r = Math.hypot(tempP.x, tempP.z);
    if (r > 1.2 && r < 140.0 && id !== "sun" && id !== "moon") {
      planetByRadius.push({ mesh: m, id: id, radius: r });
    }

    if (id !== "sun" && m.isMesh && m.material && m.userData._nasaTextured && !m.userData._terminatorEnhancedV2) {
      m.userData._terminatorEnhancedV2 = true;
      const atmoCol = getPlanetAtmosphericColor(id);
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach(function(mat) {
        if (!mat || mat.isShaderMaterial) return;
        if (mat.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = 0.04;
        }
        mat.onBeforeCompile = function(shader) {
          shader.uniforms.uSunPosition = { value: new THREE.Vector3(0, 0, 0) };
          shader.uniforms.uAtmoRimColor = { value: atmoCol };
          shader.vertexShader = "varying vec3 vNovaWorldPos;\nvarying vec3 vNovaWorldNormal;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <worldpos_vertex>",
            "#include <worldpos_vertex>\n  vNovaWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vNovaWorldNormal = normalize(mat3(modelMatrix) * objectNormal);"
          );
          shader.fragmentShader = "uniform vec3 uSunPosition;\nuniform vec3 uAtmoRimColor;\nvarying vec3 vNovaWorldPos;\nvarying vec3 vNovaWorldNormal;\n" + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <dithering_fragment>",
            [
              "#include <dithering_fragment>",
              "vec3 nSunDir = normalize(uSunPosition - vNovaWorldPos);",
              "vec3 nViewDir = normalize(cameraPosition - vNovaWorldPos);",
              "vec3 nNorm = normalize(vNovaWorldNormal);",
              "float nSunDot = dot(nNorm, nSunDir);",
              "float dayFactor = smoothstep(-0.16, 0.26, nSunDot);",
              "gl_FragColor.rgb *= (0.10 + 0.98 * dayFactor);",
              "float fresnel = pow(1.0 - max(0.0, dot(nNorm, nViewDir)), 2.9);",
              "float sunlitCrescent = smoothstep(-0.10, 0.42, nSunDot);",
              "gl_FragColor.rgb += uAtmoRimColor * fresnel * sunlitCrescent * 0.72;"
            ].join("\n")
          );
        };
        mat.needsUpdate = true;
      });
    }
  }

  sc.traverse(function(obj) {
    if ((obj.isLine || obj.isLineLoop) && obj.geometry && !obj.userData._orbitDepthUpgradedV2) {
      if (obj.geometry.boundingSphere === null) obj.geometry.computeBoundingSphere();
      const bRad = (obj.geometry.boundingSphere && obj.geometry.boundingSphere.radius) ? obj.geometry.boundingSphere.radius : 0;
      if (bRad < 2.0 || bRad > 135.0) return;

      obj.userData._orbitDepthUpgradedV2 = true;

      let matchedPlanet = null;
      let bestDiff = 999999;
      for (let p = 0; p < planetByRadius.length; p++) {
        const diff = Math.abs(planetByRadius[p].radius - bRad);
        if (diff < bestDiff && diff < 3.5) {
          bestDiff = diff;
          matchedPlanet = planetByRadius[p];
        }
      }

      const baseLineCol = matchedPlanet ? getPlanetAtmosphericColor(matchedPlanet.id) : new THREE.Color(0x94a3b8);
      const orbitMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        uniforms: {
          uLineColor: { value: baseLineCol },
          uPlanetPos: { value: new THREE.Vector3(bRad, 0, 0) },
          uHasPlanet: { value: matchedPlanet ? 1.0 : 0.0 }
        },
        vertexShader: [
          "#include <common>",
          "#include <logdepthbuf_pars_vertex>",
          "varying vec3 vWorldPos;",
          "void main() {",
          "  vec4 wp = modelMatrix * vec4(position, 1.0);",
          "  vWorldPos = wp.xyz;",
          "  gl_Position = projectionMatrix * viewMatrix * wp;",
          "  #include <logdepthbuf_vertex>",
          "}"
        ].join("\n"),
        fragmentShader: [
          "#include <common>",
          "#include <logdepthbuf_pars_fragment>",
          "uniform vec3 uLineColor;",
          "uniform vec3 uPlanetPos;",
          "uniform float uHasPlanet;",
          "varying vec3 vWorldPos;",
          "void main() {",
          "  #include <logdepthbuf_fragment>",
          "  float distToCam = length(cameraPosition - vWorldPos);",
          "  float sunToCam = length(cameraPosition);",
          "  float depthRatio = clamp((sunToCam * 1.38 - distToCam) / max(8.0, sunToCam * 0.95), 0.0, 1.0);",
          "  float baseAlpha = mix(0.08, 0.44, depthRatio);",
          "  float trailBoost = 0.0;",
          "  if (uHasPlanet > 0.5) {",
          "    float angFragment = atan(vWorldPos.z, vWorldPos.x);",
          "    float angPlanet = atan(uPlanetPos.z, uPlanetPos.x);",
          "    float dAng = mod(angPlanet - angFragment + 6.2831853, 6.2831853);",
          "    if (dAng < 0.72) {",
          "      trailBoost = pow(1.0 - (dAng / 0.72), 1.75) * 0.62;",
          "    }",
          "  }",
          "  float macroFade = 1.0 - smoothstep(145.0, 270.0, distToCam);",
          "  float sunCloseFade = smoothstep(4.5, 13.5, sunToCam);",
          "  float lensCloseFade = smoothstep(0.6, 2.8, distToCam);",
          "  vec3 finalCol = mix(vec3(0.75, 0.82, 0.92), uLineColor, 0.45 + trailBoost * 0.55);",
          "  float finalAlpha = (baseAlpha + trailBoost) * macroFade * sunCloseFade * lensCloseFade;",
          "  if (finalAlpha <= 0.01) discard;",
          "  gl_FragColor = vec4(finalCol, finalAlpha);",
          "}"
        ].join("\n")
      });

      obj.material = orbitMat;
      window._novaOrbitShaderLines.push({
        line: obj,
        planetMesh: matchedPlanet ? matchedPlanet.mesh : null
      });
    }
  });
}

export function initAndStepNovaDepthEngine(sc, cam, celObjs, isSunFocusedOrZoomed) {
  if (!sc || !cam || !celObjs || celObjs.length < 8) return;
  if (!window._texturesInitialized) return;

  if (!window._novaDepthEngineInitialized) {
    let rMars = 0, rJupiter = 0, rNeptune = 0;
    const pVec = new THREE.Vector3();
    for (let i = 0; i < celObjs.length; i++) {
      const m = celObjs[i];
      if (!m || !m.userData) continue;
      const id = String(m.userData.id || m.userData.name || m.name || "").toLowerCase();
      m.getWorldPosition(pVec);
      const r = Math.hypot(pVec.x, pVec.z);
      if (id === "mars") rMars = r;
      else if (id === "jupiter") rJupiter = r;
      else if (id === "neptune") rNeptune = r;
    }

    if (rMars > 1.0 && rJupiter > rMars) {
      window._novaDepthEngineInitialized = true;
      removeOldBeltMeshes(sc);

      const beltInner = rMars + (rJupiter - rMars) * 0.22;
      const beltOuter = rMars + (rJupiter - rMars) * 0.78;
      const beltThick = (beltOuter - beltInner) * 0.14;
      buildSunlitAsteroidBelt(sc, 4500, beltInner, beltOuter, beltThick, 0x8c6d46, 0xfcd34d, 0.32);

      if (rNeptune > rJupiter) {
        const kInner = rNeptune * 1.05;
        const kOuter = rNeptune * 1.28;
        const kThick = (kOuter - kInner) * 0.16;
        buildSunlitAsteroidBelt(sc, 2800, kInner, kOuter, kThick, 0x475569, 0x7dd3fc, 0.50);
      }

      upgradeOrbitLinesAndTerminators(sc, celObjs);
    }
  }

  const simTimeSec = Date.now() * 0.001;
  for (let i = 0; i < window._novaAsteroidBelts.length; i++) {
    const beltObj = window._novaAsteroidBelts[i];
    if (!beltObj) continue;
    if (isSunFocusedOrZoomed) {
      window._hiddenForThisFrame.push(beltObj);
      beltObj.visible = false;
    } else if (beltObj.material && beltObj.material.uniforms && beltObj.material.uniforms.uTime) {
      beltObj.material.uniforms.uTime.value = simTimeSec;
    }
  }

  const pWorld = new THREE.Vector3();
  for (let i = 0; i < window._novaOrbitShaderLines.length; i++) {
    const item = window._novaOrbitShaderLines[i];
    if (item.line && item.planetMesh && item.line.material && item.line.material.uniforms) {
      item.planetMesh.getWorldPosition(pWorld);
      item.line.material.uniforms.uPlanetPos.value.copy(pWorld);
    }
  }
}

window._novaBeforeRender = function(sc, cam, celObjs, labelEntries, currentActiveTarget) {
  try {
    window._novaSceneRef = sc;
    window._novaCamRef = cam;
    window._hiddenForThisFrame = [];
    window._activeScreenOccluders = [];

    if (!sc || !cam || !celObjs || !celObjs.length) return;

    sc.updateMatrixWorld();

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const halfH = vh * 0.5;
    const fovTan = Math.tan(THREE.MathUtils.degToRad(cam.fov) * 0.5);
    const camPos = cam.position;

    const bodyRecords = [];
    const tempPos = new THREE.Vector3();
    const tempScale = new THREE.Vector3();

    for (let i = 0; i < celObjs.length; i++) {
      const mesh = celObjs[i];
      if (!mesh || !mesh.visible || !mesh.userData) continue;

      const id = String(mesh.userData.id || mesh.userData.name || mesh.name || "").toLowerCase();
      mesh.getWorldPosition(tempPos);
      mesh.getWorldScale(tempScale);
      const distToCam = camPos.distanceTo(tempPos);

      const proj = tempPos.clone().project(cam);
      if (proj.z <= 0 || proj.z >= 1.0) continue;

      const sx = (proj.x * 0.5 + 0.5) * vw;
      const sy = (-proj.y * 0.5 + 0.5) * vh;

      const baseSize = Number(mesh.userData.size) || 0.5;
      const scaleFactor = Math.max(tempScale.x, tempScale.y, tempScale.z);
      const worldRadius = baseSize * scaleFactor;

      const pxPerUnit = halfH / Math.max(0.1, fovTan * distToCam);
      const screenRadPx = worldRadius * pxPerUnit * (id === "sun" ? 1.02 : 1.04);

      bodyRecords.push({
        mesh: mesh,
        id: id,
        isSun: (id === "sun"),
        isFocused: (mesh === currentActiveTarget || mesh === window._spatialTargetMesh),
        worldPos: tempPos.clone(),
        worldRadius: worldRadius,
        distToCam: distToCam,
        sx: sx,
        sy: sy,
        screenRadPx: screenRadPx
      });
    }

    if (bodyRecords.length === 0) return;

    bodyRecords.sort(function(a, b) { return a.distToCam - b.distToCam; });

    for (let i = 0; i < bodyRecords.length; i++) {
      if (bodyRecords[i].screenRadPx > 8) {
        window._activeScreenOccluders.push(bodyRecords[i]);
      }
    }

    const sunRec = bodyRecords.find(function(b) { return b.isSun; });
 const isSunFocusedOrZoomed = Boolean(
   sunRec && (sunRec.screenRadPx > 130 || sunRec.distToCam < 18.0)
 );

 initAndStepNovaDepthEngine(sc, cam, celObjs, isSunFocusedOrZoomed);

 sc.traverse(function(obj) {
   if (!obj.visible || obj.isScene || obj.isCamera || obj.isLight || obj.isPoints) return;

   // Never hide Cosmic Web filaments during pre-render occlusion
   if (typeof cosmicWebGroup !== "undefined" && cosmicWebGroup) {
     let pCheck = obj;
     while (pCheck) {
       if (pCheck === cosmicWebGroup) return;
       pCheck = pCheck.parent;
     }
   }

   // Smooth GPU shader fade handles Sun/surface proximity without abrupt line popping

      if (obj.isMesh && !celObjs.includes(obj)) {
        if (obj.name === "nova-belt-dust-glow") return;
        let p = obj.parent;
        while (p && p !== sc) {
          if (celObjs.includes(p)) {
            if (!p.visible) hideObjectAndAssociatedVisuals(obj);
            return;
          }
          p = p.parent;
        }
      }
    });
  } catch (err) {
    console.warn("Pre-render occlusion error:", err);
  }
};

window._getScreenPointOcclusionFactor = function(planetSx, planetSy, labelX, labelY, entryId, entryMesh) {
  if (!entryMesh || !entryMesh.visible) return 0.0;
  const occluders = window._activeScreenOccluders || [];
  if (occluders.length === 0) return 1.0;

  const cam = window._novaCamRef;
  if (!cam) return 1.0;
  const pos = new THREE.Vector3();
  entryMesh.getWorldPosition(pos);
  const candDist = cam.position.distanceTo(pos);
  const lowerId = String(entryId || "").toLowerCase();

  let visibility = 1.0;

  for (let i = 0; i < occluders.length; i++) {
    const occ = occluders[i];
    if (occ.mesh === entryMesh || occ.id === lowerId) {
      if (occ.isSun && (occ.isFocused || occ.screenRadPx > 130)) return 0.0;
      continue;
    }

    if (candDist > occ.distToCam + occ.worldRadius * 0.25) {
      const dPlanet = Math.hypot(planetSx - occ.sx, planetSy - occ.sy);
      const innerLimb = occ.screenRadPx * 0.92;
      const outerLimb = occ.screenRadPx * 1.32 + 8.0;

      if (dPlanet <= innerLimb) {
        return 0.0;
      } else if (dPlanet < outerLimb) {
        const t = (dPlanet - innerLimb) / Math.max(1.0, outerLimb - innerLimb);
        const smoothFade = t * t * (3.0 - 2.0 * t);
        visibility = Math.min(visibility, smoothFade);
      }
    }
  }
  return visibility;
};

window._novaAfterRender = function() {
  const list = window._hiddenForThisFrame;
  if (!list || list.length === 0) return;
  for (let i = 0; i < list.length; i++) {
    if (list[i]) list[i].visible = true;
  }
  window._hiddenForThisFrame = [];
};

export function enforceSceneDepthOcclusion() {
  // Handled via _novaBeforeRender & _isScreenPointOccluded
}
