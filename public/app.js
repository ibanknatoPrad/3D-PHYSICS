/* ══════════════════════════════════════════════════════════════════════════
   ELECTROMAGNETISM SUITE — app.js
   Interactive 3D Physics Simulation Suite with Three.js & WebGL
   ══════════════════════════════════════════════════════════════════════════ */

'use strict';

// 0. AMBIENT LIQUID-GLASS 2D SHADER BACKGROUND
(function initLiquidGlassBackground() {
  const canvas = document.getElementById('bg-canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return;

  const vertSrc = 'attribute vec2 a_pos; void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }';

  const fragSrc = `
    precision mediump float;
    uniform float u_time;
    uniform vec2 u_res;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float v = 0.0, amp = 0.5;
      for (int i = 0; i < 5; i++) {
        v += amp * noise(p);
        p *= 2.15;
        amp *= 0.48;
      }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_res;
      uv.x *= u_res.x / u_res.y;

      float t = u_time * 0.045;
      float q1 = fbm(uv * 1.8 + vec2(t * 0.3, t * 0.2));
      float q2 = fbm(uv * 2.6 - vec2(t * 0.25, t * 0.35) + q1 * 0.7);
      float q3 = fbm(uv * 1.5 + vec2(sin(t * 0.8) * 0.35, cos(t * 0.6) * 0.25) + q2 * 0.5);

      vec3 deepVoid  = vec3(0.012, 0.035, 0.082);
      vec3 oceanic   = vec3(0.039, 0.105, 0.210);
      vec3 liquidClr = vec3(0.080, 0.180, 0.330);
      vec3 crestGlow = vec3(0.140, 0.320, 0.520);

      vec3 color = mix(deepVoid, oceanic, q1);
      color = mix(color, liquidClr, q2 * 0.6);
      color = mix(color, crestGlow, q3 * 0.25);

      float caustics = smoothstep(0.42, 0.88, fbm(uv * 4.2 + t * 0.4 + q3)) * 0.08;
      color += vec3(caustics * 0.7, caustics * 0.95, caustics * 1.15);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function createShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(program);
  gl.useProgram(program);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(program, 'u_time');
  const uRes  = gl.getUniformLocation(program, 'u_res');

  const startTime = performance.now();

  function onResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', onResize);
  onResize();

  function renderLoop() {
    gl.uniform1f(uTime, (performance.now() - startTime) / 1000);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(renderLoop);
  }
  renderLoop();
})();

// 1. THREE.JS CORE ENGINE & CONTROLS
const mainCanvas = document.getElementById('main-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas: mainCanvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3.2, 9.5);

// OrbitControls with enableDamping = true
const controls = new THREE.OrbitControls(camera, mainCanvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.rotateSpeed = 0.85;
controls.panSpeed = 0.8;
controls.screenSpacePanning = true;
controls.maxDistance = 35;
controls.minDistance = 2.5;

const scene = new THREE.Scene();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 2. GLOBAL STATE & BLUEPRINT MODE SYSTEM
let isBlueprintMode = false;
const blueprintButton = document.getElementById('btn-blueprint');

blueprintButton.addEventListener('click', () => {
  isBlueprintMode = !isBlueprintMode;
  blueprintButton.classList.toggle('active', isBlueprintMode);
  applyBlueprintMode(isBlueprintMode);
});

const materialCache = new Map();

function applyBlueprintMode(enable) {
  scene.traverse((obj) => {
    if (obj.isMesh) {
      if (enable) {
        if (!materialCache.has(obj.uuid)) {
          materialCache.set(obj.uuid, obj.material);
        }
        obj.material = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          wireframe: true,
          transparent: true,
          opacity: 0.75
        });
      } else {
        if (materialCache.has(obj.uuid)) {
          obj.material = materialCache.get(obj.uuid);
        }
      }
    }
  });
}

// 3. GLOBAL RAYCASTING SYSTEM WITH LIVE HOVER GLOW
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-1000, -1000);
const raycastTag = document.getElementById('raycast-tag');
let interactiveObjects = [];
let hoveredObject = null;
let originalObjectScale = new THREE.Vector3(1, 1, 1);

window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  if (hoveredObject) {
    raycastTag.style.left = e.clientX + 'px';
    raycastTag.style.top = e.clientY + 'px';
  }
});

function updateRaycasting() {
  if (interactiveObjects.length === 0) {
    if (hoveredObject) clearHover();
    return;
  }

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(interactiveObjects, true);

  if (intersects.length > 0) {
    let target = intersects[0].object;
    while (target && !target.userData.interactive && target.parent) {
      target = target.parent;
    }

    if (target && target.userData.interactive) {
      if (hoveredObject !== target) {
        if (hoveredObject) clearHover();
        hoveredObject = target;
        originalObjectScale.copy(target.scale);
        target.scale.multiplyScalar(1.07);

        raycastTag.textContent = target.userData.label || 'INTERACTIVE ELEMENT';
        raycastTag.classList.add('active');
        document.body.style.cursor = 'pointer';
      }
      return;
    }
  }

  if (hoveredObject) {
    clearHover();
  }
}

function clearHover() {
  if (hoveredObject) {
    hoveredObject.scale.copy(originalObjectScale);
    hoveredObject = null;
  }
  raycastTag.classList.remove('active');
  document.body.style.cursor = 'default';
}

function registerInteractive(obj, label) {
  obj.userData.interactive = true;
  obj.userData.label = label;
  interactiveObjects.push(obj);
}

// 4. SCENE DISPOSAL & LIFECYCLE MANAGEMENT
let activeModule = null;
let currentModuleName = 'biot-savart';

function setupEnvironmentLighting() {
  const ambient = new THREE.AmbientLight(0x0a192f, 2.5);
  scene.add(ambient);

  const mainDir = new THREE.DirectionalLight(0x7dc1fa, 1.4);
  mainDir.position.set(6, 12, 8);
  scene.add(mainDir);

  const rimLight = new THREE.DirectionalLight(0x00f0ff, 0.8);
  rimLight.position.set(-6, -4, -6);
  scene.add(rimLight);
}

function switchScene(name) {
  if (activeModule && activeModule.dispose) {
    activeModule.dispose();
  }

  clearHover();
  interactiveObjects = [];
  materialCache.clear();

  while (scene.children.length > 0) {
    const obj = scene.children[0];
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  }

  setupEnvironmentLighting();
  currentModuleName = name;

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scene === name);
  });

  document.querySelectorAll('.control-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.id !== ('panel-' + name));
  });

  if (moduleConstructors[name]) {
    activeModule = moduleConstructors[name]();
    if (isBlueprintMode) {
      applyBlueprintMode(true);
    }
  }
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchScene(btn.dataset.scene));
});

const moduleConstructors = {};

// ═════════════════════════════════════════════════════════════════════════
// MODULE 1: BIOT–SAVART LAW (Continuous Flowing Particle System)
// ═════════════════════════════════════════════════════════════════════════
moduleConstructors['biot-savart'] = function() {
  camera.position.set(0, 3.0, 8.5);
  controls.target.set(0, 0, 0);

  const rootGroup = new THREE.Group();
  scene.add(rootGroup);

  const wireLength = 8.0;
  const wireRadius = 0.08;
  const wireGeo = new THREE.CylinderGeometry(wireRadius, wireRadius, wireLength, 32);
  const wireMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.85,
    roughness: 0.25,
    emissive: 0xb45309,
    emissiveIntensity: 0.25
  });
  const wireMesh = new THREE.Mesh(wireGeo, wireMat);
  rootGroup.add(wireMesh);
  registerInteractive(wireMesh, "Current-Carrying Copper Wire [I]");

  const currentArrows = new THREE.Group();
  for (let i = -3; i <= 3; i += 1.5) {
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, i, 0),
      0.65,
      0xffffff,
      0.18,
      0.10
    );
    currentArrows.add(arrow);
  }
  rootGroup.add(currentArrows);

  let particleCount = 1200;
  let currentIntensity = 6.0;
  let concentricShells = 3;

  let particleGeo = null;
  let particleMat = null;
  let particleSystem = null;
  let particleData = [];

  function buildParticleSystem() {
    if (particleSystem) {
      rootGroup.remove(particleSystem);
      particleGeo.dispose();
      particleMat.dispose();
    }

    particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    particleData = [];

    const baseRadii = [1.0, 1.8, 2.6, 3.4, 4.2];

    for (let i = 0; i < particleCount; i++) {
      const shellIndex = i % concentricShells;
      const radius = baseRadii[shellIndex] + (Math.random() - 0.5) * 0.18;
      const angle = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * (wireLength * 0.85);

      positions[i * 3 + 0] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      const hue = 0.52 - shellIndex * 0.04;
      const col = new THREE.Color().setHSL(hue, 1.0, 0.65);
      colors[i * 3 + 0] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      particleData.push({
        radius,
        angle,
        y,
        baseSpeed: (1.8 / Math.max(radius, 0.4))
      });
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(0,240,255,0.85)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);

    particleMat = new THREE.PointsMaterial({
      size: 0.16,
      map: tex,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    particleSystem = new THREE.Points(particleGeo, particleMat);
    rootGroup.add(particleSystem);
  }

  buildParticleSystem();

  const guideGroup = new THREE.Group();
  for (let r = 1; r <= 4; r++) {
    const ring = new THREE.Line(
      new THREE.RingGeometry(r * 0.9, r * 0.9 + 0.015, 64),
      new THREE.LineBasicMaterial({ color: 0x1d558a, transparent: true, opacity: 0.25 })
    );
    ring.rotation.x = Math.PI / 2;
    guideGroup.add(ring);
  }
  rootGroup.add(guideGroup);

  const curSlider = document.getElementById('bs-current');
  const curVal = document.getElementById('bs-current-val');
  const denSlider = document.getElementById('bs-density');
  const denVal = document.getElementById('bs-density-val');
  const radSlider = document.getElementById('bs-radius');
  const radVal = document.getElementById('bs-radius-val');
  const b1Calc = document.getElementById('bs-b1-calc');

  function updateBiotSavartParams() {
    currentIntensity = parseFloat(curSlider.value);
    curVal.textContent = currentIntensity.toFixed(1) + ' A';

    particleCount = parseInt(denSlider.value);
    denVal.textContent = particleCount.toString();

    concentricShells = parseInt(radSlider.value);
    radVal.textContent = concentricShells + ' Shells';

    const bFieldAt1m = (0.2 * currentIntensity).toFixed(2);
    b1Calc.textContent = bFieldAt1m + ' μT';

    wireMat.emissiveIntensity = 0.2 + (currentIntensity / 20) * 0.8;
  }

  curSlider.oninput = () => { updateBiotSavartParams(); };
  denSlider.oninput = () => { updateBiotSavartParams(); buildParticleSystem(); };
  radSlider.oninput = () => { updateBiotSavartParams(); buildParticleSystem(); };

  updateBiotSavartParams();

  return {
    update(dt) {
      if (!particleSystem) return;
      const pos = particleGeo.attributes.position.array;
      const speedFactor = currentIntensity * 0.45;

      for (let i = 0; i < particleCount; i++) {
        const p = particleData[i];
        p.angle += p.baseSpeed * speedFactor * dt;

        pos[i * 3 + 0] = Math.cos(p.angle) * p.radius;
        pos[i * 3 + 2] = Math.sin(p.angle) * p.radius;
      }
      particleGeo.attributes.position.needsUpdate = true;

      particleMat.opacity = Math.min(0.5 + (currentIntensity / 20) * 0.5, 1.0);
      particleMat.size = 0.12 + (currentIntensity / 20) * 0.08;
    },
    dispose() {
      curSlider.oninput = null;
      denSlider.oninput = null;
      radSlider.oninput = null;
    }
  };
};

// ═════════════════════════════════════════════════════════════════════════
// MODULE 2: FLEMING'S RULES (Auto-Aligning Vector Hand & Draggable Poles)
// ═════════════════════════════════════════════════════════════════════════
moduleConstructors['flemings'] = function() {
  camera.position.set(0, 3.5, 9.0);
  controls.target.set(0, 0, 0);

  const rootGroup = new THREE.Group();
  scene.add(rootGroup);

  let isLeftHand = true;
  let poleAngle = 0;
  let loopVelocity = 1.2;

  const polesGroup = new THREE.Group();
  rootGroup.add(polesGroup);

  const poleGeo = new THREE.BoxGeometry(1.2, 1.8, 1.0);

  const northMat = new THREE.MeshStandardMaterial({
    color: 0xef4444, metalness: 0.6, roughness: 0.3, emissive: 0x991b1b, emissiveIntensity: 0.25
  });
  const northPole = new THREE.Mesh(poleGeo, northMat);
  northPole.position.set(0, 2.5, 0);
  polesGroup.add(northPole);
  registerInteractive(northPole, "Magnetic North Pole [N]");

  const southMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6, metalness: 0.6, roughness: 0.3, emissive: 0x1e3a8a, emissiveIntensity: 0.25
  });
  const southPole = new THREE.Mesh(poleGeo, southMat);
  southPole.position.set(0, -2.5, 0);
  polesGroup.add(southPole);
  registerInteractive(southPole, "Magnetic South Pole [S]");

  function createTextSprite(text, color) {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.font = 'bold 72px Inter, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(1.2, 1.2, 1);
    return sp;
  }
  const nLabel = createTextSprite('N', '#ffffff');
  nLabel.position.set(0, 2.5, 0.6);
  polesGroup.add(nLabel);

  const sLabel = createTextSprite('S', '#ffffff');
  sLabel.position.set(0, -2.5, 0.6);
  polesGroup.add(sLabel);

  const fieldLinesGroup = new THREE.Group();
  for (let x = -0.8; x <= 0.8; x += 0.4) {
    for (let z = -0.4; z <= 0.4; z += 0.4) {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 1.5, z),
        new THREE.Vector3(x, -1.5, z)
      ]);
      const line = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({
        color: 0x00f0ff, dashSize: 0.15, gapSize: 0.1, transparent: true, opacity: 0.5
      }));
      line.computeLineDistances();
      fieldLinesGroup.add(line);
    }
  }
  polesGroup.add(fieldLinesGroup);

  const loopGroup = new THREE.Group();
  rootGroup.add(loopGroup);

  const w = 1.0, h = 1.4;
  const loopPoints = [
    new THREE.Vector3(-w, -h, 0),
    new THREE.Vector3(-w, h, 0),
    new THREE.Vector3(w, h, 0),
    new THREE.Vector3(w, -h, 0),
    new THREE.Vector3(-w, -h, 0)
  ];
  const loopMesh = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(loopPoints),
    new THREE.LineBasicMaterial({ color: 0xf59e0b })
  );
  loopGroup.add(loopMesh);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 4.0, 16),
    new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.2 })
  );
  shaft.rotation.z = Math.PI / 2;
  loopGroup.add(shaft);
  registerInteractive(shaft, "Armature Axle [Axis of Rotation]");

  const handGroup = new THREE.Group();
  rootGroup.add(handGroup);
  registerInteractive(handGroup, "Fleming's 3-Finger Orthogonal Vector System");

  const palm = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.7, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.5 })
  );
  handGroup.add(palm);

  function createVectorFinger(color, name) {
    const finger = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.8, 16),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 })
    );
    shaft.position.y = 0.9;
    finger.add(shaft);

    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.35, 16),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 })
    );
    cone.position.y = 1.8 + 0.175;
    finger.add(cone);

    const lbl = createTextSprite(name, '#ffffff');
    lbl.position.y = 2.4;
    lbl.scale.set(0.9, 0.9, 1);
    finger.add(lbl);

    return finger;
  }

  const thumb = createVectorFinger(0xf59e0b, "F (Force)");
  thumb.rotation.z = -Math.PI / 2;
  handGroup.add(thumb);

  const indexFinger = createVectorFinger(0x00f0ff, "B (Field)");
  indexFinger.rotation.x = Math.PI;
  handGroup.add(indexFinger);

  const middleFinger = createVectorFinger(0x10b981, "I (Current)");
  middleFinger.rotation.x = -Math.PI / 2;
  handGroup.add(middleFinger);

  handGroup.position.set(0, 0, 1.8);

  let isDraggingPoles = false;
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const dragRaycaster = new THREE.Raycaster();
  const intersectPoint = new THREE.Vector3();

  mainCanvas.addEventListener('pointerdown', (e) => {
    dragRaycaster.setFromCamera(mouse, camera);
    const hits = dragRaycaster.intersectObjects([northPole, southPole], true);
    if (hits.length > 0) {
      isDraggingPoles = true;
      controls.enabled = false;
    }
  });

  window.addEventListener('pointerup', () => {
    if (isDraggingPoles) {
      isDraggingPoles = false;
      controls.enabled = true;
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDraggingPoles) return;
    dragRaycaster.setFromCamera(mouse, camera);
    if (dragRaycaster.ray.intersectPlane(dragPlane, intersectPoint)) {
      poleAngle = Math.atan2(intersectPoint.x, intersectPoint.y);
      const angleSlider = document.getElementById('fl-angle');
      const angleDeg = THREE.MathUtils.radToDeg(poleAngle);
      angleSlider.value = angleDeg;
      document.getElementById('fl-angle-val').textContent = Math.round(angleDeg) + '°';
    }
  });

  const btnLeft = document.getElementById('fl-left');
  const btnRight = document.getElementById('fl-right');
  const angleSlider = document.getElementById('fl-angle');
  const angleVal = document.getElementById('fl-angle-val');
  const speedSlider = document.getElementById('fl-speed');
  const speedVal = document.getElementById('fl-speed-val');

  btnLeft.onclick = () => {
    isLeftHand = true;
    btnLeft.classList.add('active');
    btnRight.classList.remove('active');
  };

  btnRight.onclick = () => {
    isLeftHand = false;
    btnRight.classList.add('active');
    btnLeft.classList.remove('active');
  };

  angleSlider.oninput = () => {
    poleAngle = THREE.MathUtils.degToRad(parseFloat(angleSlider.value));
    angleVal.textContent = Math.round(parseFloat(angleSlider.value)) + '°';
  };

  speedSlider.oninput = () => {
    loopVelocity = parseFloat(speedSlider.value);
    speedVal.textContent = loopVelocity.toFixed(1) + ' rad/s';
  };

  const targetPoleQuat = new THREE.Quaternion();
  const targetHandQuat = new THREE.Quaternion();
  const euler = new THREE.Euler();

  return {
    update(dt) {
      euler.set(0, 0, -poleAngle);
      targetPoleQuat.setFromEuler(euler);
      polesGroup.quaternion.slerp(targetPoleQuat, 0.12);

      const handFlipZ = isLeftHand ? 1 : -1;
      handGroup.scale.set(1, 1, handFlipZ);

      euler.set(0, 0, -poleAngle);
      targetHandQuat.setFromEuler(euler);
      handGroup.quaternion.slerp(targetHandQuat, 0.10);

      if (loopVelocity > 0) {
        loopGroup.rotation.x += loopVelocity * dt * (isLeftHand ? 1 : -1);
      }
    },
    dispose() {
      btnLeft.onclick = null;
      btnRight.onclick = null;
      angleSlider.oninput = null;
      speedSlider.oninput = null;
      controls.enabled = true;
    }
  };
};

﻿// ═════════════════════════════════════════════════════════════════════════
// MODULE 3: LORENTZ FORCE (Continuous Particle Stream Emitter & Helix)
// ═════════════════════════════════════════════════════════════════════════
moduleConstructors['lorentz'] = function() {
  camera.position.set(0, 4.0, 10.0);
  controls.target.set(0, 0, 0);

  const rootGroup = new THREE.Group();
  scene.add(rootGroup);

  const chamberSize = 7.0;
  const chamberGeo = new THREE.BoxGeometry(chamberSize, chamberSize, chamberSize);
  const chamberEdges = new THREE.EdgesGeometry(chamberGeo);
  const chamberMesh = new THREE.LineSegments(
    chamberEdges,
    new THREE.LineBasicMaterial({ color: 0x1d558a, transparent: true, opacity: 0.4 })
  );
  rootGroup.add(chamberMesh);
  registerInteractive(chamberMesh, "Vacuum Magnetron Chamber");

  const gridFloor = new THREE.GridHelper(chamberSize, 14, 0x00f0ff, 0x0f2b48);
  gridFloor.position.y = -chamberSize / 2;
  rootGroup.add(gridFloor);

  // 3D Magnetic Field Visualization Arrows (Grid of orientable 3D arrows)
  const bFieldArrowsGroup = new THREE.Group();
  rootGroup.add(bFieldArrowsGroup);

  const bArrowList = [];
  const arrowSpacing = 2.2;
  for (let x = -arrowSpacing; x <= arrowSpacing; x += arrowSpacing) {
    for (let y = -arrowSpacing; y <= arrowSpacing; y += arrowSpacing) {
      for (let z = -arrowSpacing; z <= arrowSpacing; z += arrowSpacing) {
        const arr = new THREE.ArrowHelper(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(x, y, z),
          0.9,
          0x00f0ff,
          0.2,
          0.12
        );
        arr.line.material.transparent = true;
        arr.line.material.opacity = 0.35;
        bFieldArrowsGroup.add(arr);
        bArrowList.push(arr);
      }
    }
  }

  // Simulation parameters
  let isProton = true;            // +1 vs -1
  let bFieldMagnitude = 1.8;      // Tesla
  let bPitchDeg = 0;              // Pitch (theta): -90 to +90 deg
  let bYawDeg = 0;                // Yaw (phi): -90 to +90 deg
  let injectionVelocity = 2.5;    // Velocity scale factor

  // Continuous Emitter Particle Pool
  const maxParticles = 900;
  const particlePool = [];

  const streamGeo = new THREE.BufferGeometry();
  const streamPositions = new Float32Array(maxParticles * 3);
  const streamColors = new Float32Array(maxParticles * 3);

  // Initialize off-screen
  for (let i = 0; i < maxParticles * 3; i++) {
    streamPositions[i] = 9999;
    streamColors[i] = 1.0;
  }

  streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPositions, 3));
  streamGeo.setAttribute('color', new THREE.BufferAttribute(streamColors, 3));

  // High-contrast smooth round glow texture
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.3, 'rgba(255, 200, 50, 0.95)');
  g.addColorStop(0.7, 'rgba(0, 240, 255, 0.45)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const particleTex = new THREE.CanvasTexture(cv);

  const streamMat = new THREE.PointsMaterial({
    size: 0.28,
    map: particleTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const streamPointsMesh = new THREE.Points(streamGeo, streamMat);
  rootGroup.add(streamPointsMesh);

  // Accelerator Nozzle Gun
  const gunMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.20, 0.7, 16),
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.2
    })
  );
  gunMesh.rotation.z = Math.PI / 2;
  gunMesh.position.set(-3.2, 0, 0);
  rootGroup.add(gunMesh);
  registerInteractive(gunMesh, "High-Energy Particle Accelerator Nozzle");

  // Particle Stream Physics Class
  class StreamParticle {
    constructor() {
      this.active = false;
      this.pos = new THREE.Vector3();
      this.vel = new THREE.Vector3();
      this.age = 0;
      this.maxLife = 5.0; // Seconds of lifespan
    }

    spawn(velocity) {
      this.active = true;
      this.age = 0;
      this.pos.set(-3.2, 0, 0);
      // Injected along +X axis with minimal thermal jitter
      this.vel.set(
        velocity * 2.8,
        (Math.random() - 0.5) * 0.04,
        (Math.random() - 0.5) * 0.04
      );
    }
  }

  for (let i = 0; i < maxParticles; i++) {
    particlePool.push(new StreamParticle());
  }

  let spawnTimer = 0;
  const spawnRate = 0.005; // 200 particles/second continuous stream

  // UI Control Elements
  const btnProton = document.getElementById('lz-proton');
  const btnElectron = document.getElementById('lz-electron');
  const bFieldSlider = document.getElementById('lz-bfield');
  const bFieldVal = document.getElementById('lz-bfield-val');
  const pitchSlider = document.getElementById('lz-pitch');
  const pitchVal = document.getElementById('lz-pitch-val');
  const yawSlider = document.getElementById('lz-yaw');
  const yawVal = document.getElementById('lz-yaw-val');
  const velSlider = document.getElementById('lz-velocity');
  const velVal = document.getElementById('lz-velocity-val');
  const radReadout = document.getElementById('lz-radius-readout');
  const freqReadout = document.getElementById('lz-freq-readout');

  function updateLorentzHUD() {
    const q = isProton ? 1.0 : -1.0;
    const m = isProton ? 1.0 : 0.45; // Relativistic mass scale for clear educational visualization
    const r = (m * injectionVelocity) / (Math.abs(q) * Math.max(bFieldMagnitude, 0.1));
    radReadout.textContent = r.toFixed(2) + ' m';

    const freq = ((Math.abs(q) * bFieldMagnitude) / (2 * Math.PI * m) * 15.2).toFixed(1);
    freqReadout.textContent = freq + ' MHz';
  }

  btnProton.onclick = () => {
    isProton = true;
    btnProton.classList.add('active');
    btnElectron.classList.remove('active');
    updateLorentzHUD();
  };

  btnElectron.onclick = () => {
    isProton = false;
    btnElectron.classList.add('active');
    btnProton.classList.remove('active');
    updateLorentzHUD();
  };

  bFieldSlider.oninput = () => {
    bFieldMagnitude = parseFloat(bFieldSlider.value);
    bFieldVal.textContent = bFieldMagnitude.toFixed(1) + ' T';
    updateLorentzHUD();
  };

  pitchSlider.oninput = () => {
    bPitchDeg = parseFloat(pitchSlider.value);
    pitchVal.textContent = Math.round(bPitchDeg) + '°';
    updateLorentzHUD();
  };

  yawSlider.oninput = () => {
    bYawDeg = parseFloat(yawSlider.value);
    yawVal.textContent = Math.round(bYawDeg) + '°';
    updateLorentzHUD();
  };

  velSlider.oninput = () => {
    injectionVelocity = parseFloat(velSlider.value);
    velVal.textContent = injectionVelocity.toFixed(1) + '×';
    updateLorentzHUD();
  };

  updateLorentzHUD();

  // Vector scratchpads for high performance
  const currentBVector = new THREE.Vector3();
  const bScaled = new THREE.Vector3();
  const lorentzForce = new THREE.Vector3();
  const vCrossB = new THREE.Vector3();

  return {
    update(dt) {
      // 1. Calculate 3D rotated B-field vector using Pitch and Yaw spherical projection
      const pitchRad = THREE.MathUtils.degToRad(bPitchDeg);
      const yawRad = THREE.MathUtils.degToRad(bYawDeg);

      // Default: pointing +Y (upwards).
      // Pitch tilts into Z axis; Yaw tilts into X axis.
      const cosP = Math.cos(pitchRad);
      const sinP = Math.sin(pitchRad);
      const sinY = Math.sin(yawRad);
      const cosY = Math.cos(yawRad);

      currentBVector.set(sinY * cosP, cosY * cosP, sinP).normalize();
      bScaled.copy(currentBVector).multiplyScalar(bFieldMagnitude);

      // Orient visual 3D arrows in chamber to match B vector
      for (let i = 0; i < bArrowList.length; i++) {
        bArrowList[i].setDirection(currentBVector);
        bArrowList[i].setLength(0.6 + bFieldMagnitude * 0.25, 0.2, 0.12);
      }

      // 2. Continuous Particle Spawning
      spawnTimer += dt;
      while (spawnTimer >= spawnRate) {
        spawnTimer -= spawnRate;
        let p = particlePool.find(item => !item.active);
        if (!p) p = particlePool[0]; // Recycle oldest active particle
        p.spawn(injectionVelocity);
      }

      // 3. Sub-step Numerical Integration (Runge-Kutta style sub-stepping for smooth precision)
      const q = isProton ? 1.0 : -1.0;
      const subSteps = 3;
      const subDt = Math.min(dt, 0.05) / subSteps;

      const positions = streamGeo.attributes.position.array;
      const colors = streamGeo.attributes.color.array;

      for (let step = 0; step < subSteps; step++) {
        for (let i = 0; i < maxParticles; i++) {
          const p = particlePool[i];
          if (!p.active) continue;

          // Lorentz Force: F = q * (v × B)
          vCrossB.crossVectors(p.vel, bScaled);
          lorentzForce.copy(vCrossB).multiplyScalar(q * 3.5);

          // Update velocity and position: a = F / m
          p.vel.addScaledVector(lorentzForce, subDt);
          p.pos.addScaledVector(p.vel, subDt);
        }
      }

      // 4. Update geometry buffers and check chamber boundaries
      for (let i = 0; i < maxParticles; i++) {
        const p = particlePool[i];
        if (!p.active) {
          positions[i * 3 + 0] = 9999;
          positions[i * 3 + 1] = 9999;
          positions[i * 3 + 2] = 9999;
          continue;
        }

        p.age += dt;
        if (p.age > p.maxLife || p.pos.length() > chamberSize * 0.92) {
          p.active = false;
          positions[i * 3 + 0] = 9999;
          positions[i * 3 + 1] = 9999;
          positions[i * 3 + 2] = 9999;
          continue;
        }

        positions[i * 3 + 0] = p.pos.x;
        positions[i * 3 + 1] = p.pos.y;
        positions[i * 3 + 2] = p.pos.z;

        // Color modulation based on charge:
        // Proton = warm amber/coral glow
        // Electron = high-intensity cyan/emerald glow
        const lifeRatio = Math.max(0, 1.0 - (p.age / p.maxLife));
        if (isProton) {
          colors[i * 3 + 0] = 1.0 * lifeRatio;
          colors[i * 3 + 1] = 0.65 * lifeRatio;
          colors[i * 3 + 2] = 0.15 * lifeRatio;
        } else {
          colors[i * 3 + 0] = 0.0 * lifeRatio;
          colors[i * 3 + 1] = 0.95 * lifeRatio;
          colors[i * 3 + 2] = 1.0 * lifeRatio;
        }
      }

      streamGeo.attributes.position.needsUpdate = true;
      streamGeo.attributes.color.needsUpdate = true;
    },
    dispose() {
      btnProton.onclick = null;
      btnElectron.onclick = null;
      bFieldSlider.oninput = null;
      pitchSlider.oninput = null;
      yawSlider.oninput = null;
      velSlider.oninput = null;
      streamGeo.dispose();
      streamMat.dispose();
    }
  };
};


// ═════════════════════════════════════════════════════════════════════════
// MODULE 4: FARADAY'S LAW (Interactive Magnet & 3D Holographic Graph)
// ═════════════════════════════════════════════════════════════════════════
moduleConstructors['faraday'] = function() {
  camera.position.set(0, 3.2, 9.2);
  controls.target.set(0, 0, 0);

  const rootGroup = new THREE.Group();
  scene.add(rootGroup);

  let coilTurns = 10;
  let magnetStrength = 2.0;
  let isAutoOscillate = false;
  let autoTime = 0;

  let coilMesh = null;
  const coilGroup = new THREE.Group();
  rootGroup.add(coilGroup);

  function generateCopperCoil(turns) {
    if (coilMesh) {
      coilGroup.remove(coilMesh);
      coilMesh.geometry.dispose();
      coilMesh.material.dispose();
    }

    const coilRadius = 1.35;
    const coilSpan = 3.6;
    const points = [];
    const segments = turns * 48;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = t * Math.PI * 2 * turns;
      const x = (t - 0.5) * coilSpan;
      const y = Math.cos(angle) * coilRadius;
      const z = Math.sin(angle) * coilRadius;
      points.push(new THREE.Vector3(x, y, z));
    }

    const path = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(path, segments, 0.055, 10, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0x78350f,
      emissiveIntensity: 0.15
    });
    coilMesh = new THREE.Mesh(tubeGeo, tubeMat);
    coilGroup.add(coilMesh);
    registerInteractive(coilMesh, "Copper Induction Solenoid");
  }

  generateCopperCoil(coilTurns);

  const magnetGroup = new THREE.Group();
  rootGroup.add(magnetGroup);

  const magnetLength = 2.6;
  const magnetRadius = 0.38;

  const northGeo = new THREE.CylinderGeometry(magnetRadius, magnetRadius, magnetLength / 2, 24);
  const northMat = new THREE.MeshStandardMaterial({
    color: 0xef4444, metalness: 0.5, roughness: 0.3, emissive: 0x991b1b, emissiveIntensity: 0.3
  });
  const northHalf = new THREE.Mesh(northGeo, northMat);
  northHalf.position.x = magnetLength / 4;
  northHalf.rotation.z = Math.PI / 2;
  magnetGroup.add(northHalf);

  const southGeo = new THREE.CylinderGeometry(magnetRadius, magnetRadius, magnetLength / 2, 24);
  const southMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6, metalness: 0.5, roughness: 0.3, emissive: 0x1e3a8a, emissiveIntensity: 0.3
  });
  const southHalf = new THREE.Mesh(southGeo, southMat);
  southHalf.position.x = -magnetLength / 4;
  southHalf.rotation.z = Math.PI / 2;
  magnetGroup.add(southHalf);

  registerInteractive(magnetGroup, "Permanent Bar Magnet [Drag through Coil]");

  const bulbGroup = new THREE.Group();
  bulbGroup.position.set(0, 2.5, 0);
  rootGroup.add(bulbGroup);

  const bulbGeo = new THREE.SphereGeometry(0.35, 24, 24);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0x00f0ff, emissiveIntensity: 0.0, transparent: true, opacity: 0.8
  });
  const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
  bulbGroup.add(bulbMesh);

  const bulbLight = new THREE.PointLight(0x00f0ff, 0, 5);
  bulbGroup.add(bulbLight);

  const wirePoints = [
    new THREE.Vector3(-1.8, 0, 0),
    new THREE.Vector3(-1.8, 2.2, 0),
    new THREE.Vector3(-0.35, 2.5, 0)
  ];
  const wireLine1 = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(wirePoints),
    new THREE.LineBasicMaterial({ color: 0x475569 })
  );
  const wirePoints2 = [
    new THREE.Vector3(1.8, 0, 0),
    new THREE.Vector3(1.8, 2.2, 0),
    new THREE.Vector3(0.35, 2.5, 0)
  ];
  const wireLine2 = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(wirePoints2),
    new THREE.LineBasicMaterial({ color: 0x475569 })
  );
  rootGroup.add(wireLine1, wireLine2);

  const graphGroup = new THREE.Group();
  graphGroup.position.set(0, -2.6, 0);
  rootGroup.add(graphGroup);

  const graphFrame = new THREE.Mesh(
    new THREE.PlaneGeometry(6.0, 1.8),
    new THREE.MeshBasicMaterial({ color: 0x0a192f, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  graphGroup.add(graphFrame);

  const graphGrid = new THREE.GridHelper(6.0, 12, 0x00f0ff, 0x1d558a);
  graphGrid.rotation.x = Math.PI / 2;
  graphGroup.add(graphGrid);

  const graphHistoryCount = 140;
  const graphPositions = new Float32Array(graphHistoryCount * 3);
  const graphHistory = new Array(graphHistoryCount).fill(0);

  for (let i = 0; i < graphHistoryCount; i++) {
    const x = -3.0 + (i / (graphHistoryCount - 1)) * 6.0;
    graphPositions[i * 3 + 0] = x;
    graphPositions[i * 3 + 1] = 0;
    graphPositions[i * 3 + 2] = 0.05;
  }

  const graphGeo = new THREE.BufferGeometry();
  graphGeo.setAttribute('position', new THREE.BufferAttribute(graphPositions, 3));
  const graphMat = new THREE.LineBasicMaterial({
    color: 0x00f0ff, linewidth: 2.5, transparent: true, opacity: 0.95
  });
  const graphLine = new THREE.Line(graphGeo, graphMat);
  graphGroup.add(graphLine);

  let isDraggingMagnet = false;
  let magnetX = 4.2;
  let previousMagnetX = 4.2;
  const magnetDragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const magnetRay = new THREE.Raycaster();
  const planeIntersection = new THREE.Vector3();

  mainCanvas.addEventListener('pointerdown', (e) => {
    magnetRay.setFromCamera(mouse, camera);
    const hits = magnetRay.intersectObjects([northHalf, southHalf], true);
    if (hits.length > 0) {
      isDraggingMagnet = true;
      isAutoOscillate = false;
      document.getElementById('fd-auto-btn').classList.remove('active');
      controls.enabled = false;
    }
  });

  window.addEventListener('pointerup', () => {
    if (isDraggingMagnet) {
      isDraggingMagnet = false;
      controls.enabled = true;
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDraggingMagnet) return;
    magnetRay.setFromCamera(mouse, camera);
    if (magnetRay.ray.intersectPlane(magnetDragPlane, planeIntersection)) {
      magnetX = Math.max(-5.0, Math.min(5.0, planeIntersection.x));
    }
  });

  const turnsSlider = document.getElementById('fd-turns');
  const turnsVal = document.getElementById('fd-turns-val');
  const dipoleSlider = document.getElementById('fd-dipole');
  const dipoleVal = document.getElementById('fd-dipole-val');
  const autoBtn = document.getElementById('fd-auto-btn');
  const emfVoltsText = document.getElementById('emf-volts');
  const emfBarFill = document.getElementById('emf-level');

  turnsSlider.oninput = () => {
    coilTurns = parseInt(turnsSlider.value);
    turnsVal.textContent = coilTurns + ' Turns';
    generateCopperCoil(coilTurns);
  };

  dipoleSlider.oninput = () => {
    magnetStrength = parseFloat(dipoleSlider.value);
    dipoleVal.textContent = magnetStrength.toFixed(1) + ' T·m³';
  };

  autoBtn.onclick = () => {
    isAutoOscillate = !isAutoOscillate;
    autoBtn.classList.toggle('active', isAutoOscillate);
    autoBtn.querySelector('.btn-text').textContent = isAutoOscillate
      ? 'HALT OSCILLATION'
      : 'AUTO-OSCILLATE MAGNET';
  };

  return {
    update(dt) {
      if (isAutoOscillate) {
        autoTime += dt * 3.5;
        magnetX = Math.sin(autoTime) * 3.8;
      }
      magnetGroup.position.x = magnetX;

      const deltaX = magnetX - previousMagnetX;
      previousMagnetX = magnetX;
      const velocity = deltaX / Math.max(dt, 0.001);

      const distFromCenter = Math.abs(magnetX);
      const fluxGradient = Math.exp(-Math.pow(distFromCenter - 1.2, 2) / 0.8) * Math.sign(magnetX);
      const instantaneousEMF = -coilTurns * (velocity * 0.12) * fluxGradient * magnetStrength;

      const absEMF = Math.abs(instantaneousEMF);
      const clampedEMF = Math.min(absEMF, 12.0);

      emfVoltsText.textContent = instantaneousEMF.toFixed(2) + ' V';
      const fillPercentage = Math.min((clampedEMF / 10.0) * 100, 100);
      emfBarFill.style.width = fillPercentage + '%';

      const bulbGlow = Math.min(clampedEMF / 4.0, 1.0);
      bulbMat.emissiveIntensity = bulbGlow * 1.5;
      bulbLight.intensity = bulbGlow * 2.5;

      if (coilMesh) {
        coilMesh.material.emissiveIntensity = 0.15 + bulbGlow * 0.5;
      }

      graphHistory.shift();
      graphHistory.push(instantaneousEMF * 0.35);

      const positions = graphGeo.attributes.position.array;
      for (let i = 0; i < graphHistoryCount; i++) {
        positions[i * 3 + 1] = Math.max(-0.85, Math.min(0.85, graphHistory[i]));
      }
      graphGeo.attributes.position.needsUpdate = true;
    },
    dispose() {
      turnsSlider.oninput = null;
      dipoleSlider.oninput = null;
      autoBtn.onclick = null;
      controls.enabled = true;
    }
  };
};

// 6. MAIN ANIMATION & RENDER LOOP
let previousTimestamp = performance.now();
let frameCount = 0;
let lastFPSUpdate = performance.now();
const fpsElement = document.getElementById('fps-stat');
const drawElement = document.getElementById('draw-stat');

function mainLoop(currentTimestamp) {
  requestAnimationFrame(mainLoop);

  const deltaSeconds = Math.min((currentTimestamp - previousTimestamp) / 1000, 0.05);
  previousTimestamp = currentTimestamp;

  frameCount++;
  if (currentTimestamp - lastFPSUpdate >= 500) {
    const fps = Math.round((frameCount * 1000) / (currentTimestamp - lastFPSUpdate));
    fpsElement.textContent = fps + ' FPS';
    frameCount = 0;
    lastFPSUpdate = currentTimestamp;

    const vertices = renderer.info.render.triangles * 3;
    drawElement.textContent = vertices > 1000 ? ((vertices / 1000).toFixed(1) + 'k VTX') : (vertices + ' VTX');
  }

  controls.update();
  updateRaycasting();

  if (activeModule && activeModule.update) {
    activeModule.update(deltaSeconds);
  }

  renderer.render(scene, camera);
}

// 7. BOOTSTRAP APPLICATION
switchScene('biot-savart');
requestAnimationFrame(mainLoop);
