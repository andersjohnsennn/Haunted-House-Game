/* ==========================================================================
   Set: the mansion exterior at night. Facade at z = -20, front door at x = 0,
   porch floor at y = 1. Used for the title screen, the walk in, and the escape.
   ========================================================================== */

HH.World.define('exterior', function () {
  const P = HH.Props, Tx = HH.Tex, TAU = Math.PI * 2;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0e17, 0.016);
  const rig = new P.LightRig();
  const updaters = [];
  const at = P.at;

  /* ---------- sky ---------- */
  const skyU = { flash: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float flash; varying vec3 vP;
      void main(){
        float h = clamp(vP.y, -0.1, 1.0);
        vec3 top = vec3(0.012,0.016,0.035), hor = vec3(0.09,0.10,0.15);
        vec3 c = mix(hor, top, pow(max(h,0.0), 0.55));
        float m = max(dot(vP, normalize(vec3(-0.33,0.38,-0.86))), 0.0);
        c += vec3(0.16,0.17,0.2) * pow(m, 18.0) + vec3(0.05,0.06,0.09) * pow(m, 4.0);
        c += vec3(0.55,0.6,0.8) * flash * (0.4 + 0.6*h);
        gl_FragColor = vec4(c, 1.0);
      }`
  }));
  sky.renderOrder = -10;
  scene.add(sky);

  const starPos = [];
  for (let i = 0; i < 1600; i++) {
    const a = Math.random() * TAU, y = 0.15 + Math.random() * 0.85, r = Math.sqrt(1 - y * y);
    starPos.push(Math.cos(a) * r * 400, y * 400, Math.sin(a) * r * 400);
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xc8d2ff, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.7, depthWrite: false }));
  stars.material.fog = false;
  scene.add(stars);

  const spriteNoFog = (map, color, s, opacity = 1, additive = false) => {
    const m = new THREE.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    m.fog = false;
    const sp = new THREE.Sprite(m); sp.scale.set(s, s, 1); return sp;
  };
  const moonPos = new THREE.Vector3(-110, 128, -290);
  const halo = spriteNoFog(Tx.glow(), 0x8fa4d8, 190, 0.32, true); halo.position.copy(moonPos); scene.add(halo);
  const moon = spriteNoFog(Tx.moon(), 0xffffff, 42); moon.position.copy(moonPos).multiplyScalar(0.99); scene.add(moon);

  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const c = spriteNoFog(Tx.cloud(81 + (i % 3)), 0x2c3240, 1, 0.85);
    c.scale.set(150 + Math.random() * 90, 55 + Math.random() * 30, 1);
    c.position.set(-300 + i * 75, 95 + Math.random() * 70, -260 - Math.random() * 60);
    scene.add(c); clouds.push(c);
  }

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0x34446a, 0x0a0806, 0.5));
  const moonLight = new THREE.DirectionalLight(0x9db4ff, 0.6);
  moonLight.position.set(35, 60, 50); moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  Object.assign(moonLight.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 200 });
  moonLight.shadow.bias = -0.0008;
  scene.add(moonLight);
  const rim = new THREE.DirectionalLight(0x6a7cb0, 0.45); rim.position.set(-60, 50, -120); scene.add(rim);
  const bolt = new THREE.DirectionalLight(0xdfe8ff, 0); bolt.position.set(-20, 80, 40); scene.add(bolt);

  /* ---------- ground, path, fence ---------- */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), P.mat({ map: Tx.tiled(Tx.ground(), 70, 70), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 56), P.mat({ map: Tx.tiled(Tx.stone('#4a4740', 8, 96), 1, 18), roughness: 0.95 }));
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0.015, 13); path.receiveShadow = true; scene.add(path);

  scene.add(P.fence(-45, -2.1, 10), P.fence(2.1, 45, 10));
  const pillarM = P.mat({ map: Tx.stone('#45423d', 12, 64), roughness: 0.95 });
  for (const s of [-1, 1]) {
    const p = at(P.box(0.7, 2.6, 0.7, pillarM), s * 2.4, 1.3, 10); p.castShadow = true; scene.add(p);
    scene.add(at(P.box(0.9, 0.18, 0.9, pillarM), s * 2.4, 2.69, 10));
    const gate = P.fence(0, 1.9, 0, 1.9); gate.position.set(s * 2.05, 0, 10); gate.rotation.y = s > 0 ? Math.PI * 0.62 : Math.PI * 0.38; scene.add(gate);
  }

  /* ---------- mansion ---------- */
  const house = new THREE.Group(); scene.add(house);
  const sidingTex = Tx.siding();
  const wallM = (w, h) => P.mat({ map: Tx.tiled(sidingTex, w / 5, h / 5), roughness: 0.92 });
  const trimM = P.mat({ color: 0x15130f, roughness: 0.8 });
  const shingleM = (w, h) => P.mat({ map: Tx.tiled(Tx.shingles(), w / 2.2, h / 2.2), roughness: 0.9, side: THREE.DoubleSide });
  const stoneM = P.mat({ map: Tx.tiled(Tx.stone('#3d3a35', 13, 64), 8, 1), roughness: 0.95 });
  const add = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; house.add(m); return m; };

  add(at(P.box(24, 13, 11, wallM(24, 13)), 0, 6.5, -28.5));
  add(at(P.box(10.9, 13, 3, wallM(11, 13)), -6.55, 6.5, -21.5));
  add(at(P.box(10.9, 13, 3, wallM(11, 13)), 6.55, 6.5, -21.5));
  add(at(P.box(2.2, 8.8, 3, wallM(2.2, 9)), 0, 8.6, -21.5));
  add(at(P.box(24.4, 1, 14.4, stoneM), 0, 0.5, -27));
  add(at(P.box(24.6, 0.25, 0.4, trimM), 0, 6.6, -19.9));
  add(at(P.box(25, 0.4, 15, trimM), 0, 13.1, -27));

  const tri = (w, h, d) => {
    const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g;
  };
  const roof = new THREE.Mesh(tri(16, 6.5, 25.4), [wallM(16, 6), shingleM(26, 9)]);
  roof.rotation.y = Math.PI / 2; roof.position.set(0, 13.2, -27); add(roof);
  const gable = new THREE.Mesh(tri(9, 5.4, 7), [wallM(9, 5), shingleM(8, 6)]);
  gable.position.set(0, 13.2, -22.4); add(gable);
  for (const x of [-8, 6.5]) add(at(P.box(1.4, 9, 1.4, P.mat({ map: Tx.stone('#4a2e24', 14, 48), roughness: 0.95 })), x, 17, -29));

  // Octagonal tower, turned so a flat face looks at the camera.
  const oct = Math.PI / 8;
  const tower = add(new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 17, 8), wallM(19, 17)));
  tower.position.set(12.6, 8.5, -21.5); tower.rotation.y = oct;
  add(at(new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.25, 0.4, 8), trimM), 12.6, 17.1, -21.5, 0, oct));
  const spire = add(new THREE.Mesh(new THREE.ConeGeometry(3.7, 8, 8), shingleM(14, 10)));
  spire.position.set(12.6, 21.3, -21.5); spire.rotation.y = oct;
  add(at(new THREE.Mesh(new THREE.ConeGeometry(0.08, 2.4, 6), P.iron()), 12.6, 26.4, -21.5));

  // Porch, steps, columns and railings.
  add(at(P.box(11.4, 1, 3.6, P.mat({ map: Tx.tiled(Tx.wood(17, '#2a2018', 10), 3, 1), roughness: 0.9 })), 0, 0.5, -18.2));
  for (let i = 0; i < 3; i++) add(at(P.box(4.2, 0.34 * (i + 1), 0.7, stoneM), 0, 0.17 * (i + 1), -14.75 - i * 0.62));
  const colM = P.mat({ color: 0x2b2a26, roughness: 0.85 });
  for (const x of [-5.4, -2.1, 2.1, 5.4]) add(at(P.cyl(0.16, 0.2, 3.9, colM, 10), x, 2.95, -16.7));
  add(at(P.box(12, 0.3, 4.2, trimM), 0, 5.0, -18.1));
  const porchRoof = add(at(P.box(12.4, 0.12, 4.6, shingleM(12, 5)), 0, 5.45, -18.1, 0.22));
  porchRoof.receiveShadow = false;
  for (const s of [-1, 1]) {
    add(at(P.box(0.08, 0.08, 3.4, trimM), s * 5.6, 1.95, -18.3));
    for (let k = 0; k < 9; k++) add(at(P.box(0.05, 0.9, 0.05, trimM), s * 5.6, 1.45, -19.8 + k * 0.38), false);
  }

  // Front door, its frame, and the black hall glimpsed behind it.
  house.add(at(P.doorFrame(2.1, 3.2, trimM, 0.4), 0, 1, -19.85));
  const voidBox = P.doorway(2.05, 3.2, 2.8, 'dark'); voidBox.position.set(0, 1 + 1.6, -20.05 - 1.4); house.add(voidBox);
  const door = P.door({ w: 2.08, h: 3.2, tone: '#24140c', hinge: 'left', max: 1.5 });
  door.pivot.position.set(-1.04, 1, -20.06); house.add(door.pivot);
  const fan = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ map: Tx.windowPane('warm'), color: 0x8a5a30, toneMapped: false }));
  fan.position.set(0, 4.36, -19.97); house.add(fan);

  // Windows: some warm and flickering, some dead.
  const windows = [];
  const addWindow = (x, y, kind, z = -19.96, w = 1.25, h = 2.3, ry = 0) => {
    const win = P.windowFrame({ w, h, kind });
    win.group.position.set(x, y, z); win.group.rotation.y = ry; house.add(win.group);
    if (kind !== 'tower') {
      for (const s of [-1, 1]) {
        const sh = at(P.box(0.6, h + 0.1, 0.06, trimM), x + s * (w / 2 + 0.42), y, z + 0.06, 0, 0, Math.random() < 0.2 ? s * 0.25 : 0);
        house.add(sh);
      }
    }
    windows.push({ pane: win.pane, kind, base: 0.75 + Math.random() * 0.4, seed: Math.random() * 50, on: 1 });
    return win;
  };
  [[-9, 3.1, 'warm'], [-3.6, 3.1, 'dark'], [3.6, 3.1, 'warm'], [-9, 9.4, 'dark'], [-4.6, 9.4, 'warm'], [4.6, 9.4, 'warm'], [0, 9.4, 'dark']]
    .forEach(([x, y, k]) => addWindow(x, y, k));
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * Math.PI / 4, r = 2.8;
    addWindow(12.6 + Math.sin(a) * r, 13.4, i === 1 ? 'warm' : 'dark', -21.5 + Math.cos(a) * r, 0.9, 1.9, a);
  }
  const attic = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24), new THREE.MeshBasicMaterial({ map: Tx.windowPane('warm'), color: 0x775533, toneMapped: false }));
  attic.position.set(0, 15.2, -18.88); house.add(attic);
  windows.push({ pane: attic, kind: 'warm', base: 0.55, seed: 7, on: 1 });

  // The figure in the upstairs window, seen only in lightning.
  const figure = P.shadowFigure(1.9); figure.position.set(4.6, 9.2, -19.9); house.add(figure);
  let figureArmed = false;

  // Porch lanterns and jack-o'-lanterns.
  const lantern = new THREE.PointLight(0xff9a40, 1.6, 13, 1.8); lantern.position.set(0, 4.2, -18.3); scene.add(lantern);
  rig.light(lantern, { amt: 0.25 });
  for (const x of [-1.9, 1.9]) {
    const lg = new THREE.Group(); lg.position.set(x, 4.2, -19.6); house.add(lg);
    lg.add(at(P.box(0.22, 0.34, 0.22, P.mat({ color: 0x0c0c0c, metalness: 0.5 })), 0, 0, 0));
    lg.add(at(P.candle(rig, { h: 0.1, r: 0.03, flame: 1.4 }), 0, -0.12, 0));
    lg.add(P.glowSprite(0xff9040, 1.6, 0.35));
  }

  function pumpkinTex(emissive) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    if (emissive) { g.fillStyle = '#000'; g.fillRect(0, 0, 512, 256); }
    else {
      g.fillStyle = '#b8500e'; g.fillRect(0, 0, 512, 256);
      for (let x = 0; x < 512; x += 32) { g.fillStyle = 'rgba(70,20,0,0.35)'; g.fillRect(x, 0, 6, 256); }
    }
    g.fillStyle = emissive ? '#ffd27a' : '#2a0c00';
    const tri = (pts) => { g.beginPath(); g.moveTo(...pts[0]); pts.slice(1).forEach(p => g.lineTo(...p)); g.closePath(); g.fill(); };
    tri([[96, 108], [120, 80], [124, 112]]); tri([[160, 108], [136, 80], [132, 112]]);
    tri([[122, 126], [128, 116], [134, 126]]);
    g.beginPath(); g.moveTo(84, 140);
    [[96, 150], [104, 142], [114, 156], [128, 146], [142, 156], [152, 142], [160, 150], [172, 140], [160, 168], [96, 168]].forEach(p => g.lineTo(...p));
    g.closePath(); g.fill();
    const t = new THREE.CanvasTexture(c); if (!emissive) t.encoding = THREE.sRGBEncoding; return t;
  }
  const pumpkinMat = P.mat({ map: pumpkinTex(false), emissiveMap: pumpkinTex(true), emissive: 0xffa040, emissiveIntensity: 1.4, roughness: 0.6 });
  const pumpkins = [];
  const pumpkinGeo = new THREE.SphereGeometry(0.42, 24, 16);
  {
    const p = pumpkinGeo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const vx = p.getX(k), vz = p.getZ(k), rib = 1 + Math.cos(Math.atan2(vz, vx) * 10) * 0.04;
      p.setXYZ(k, vx * rib, p.getY(k) * 0.78, vz * rib);
    }
    pumpkinGeo.computeVertexNormals();
  }
  // [x, surface y, z, size] — three sit on the porch steps.
  [[-1.7, 1.0, -16.0, 0.6], [1.8, 0.67, -15.4, 0.9], [-1.6, 0.34, -14.75, 1.1], [3.6, 1.0, -16.8, 0.45], [-2.2, 0, 6, 0.5], [2.1, 0, 3, 0.75]]
    .forEach(([x, y, z, sc], i) => {
      const k = sc + 0.2, hh = 0.42 * 0.78 * k;
      const pm = new THREE.Mesh(pumpkinGeo, pumpkinMat); pm.position.set(x, y + hh, z); pm.scale.setScalar(k);
      pm.rotation.y = (i % 2 ? 0.25 : -0.25); pm.castShadow = true; scene.add(pm);
      scene.add(at(P.cyl(0.03 * k, 0.05 * k, 0.16 * k, P.mat({ color: 0x3a3a1a }), 6), x, y + hh * 2 + 0.05 * k, z));
      const gl = P.glowSprite(0xff8a20, 1.6 * sc, 0.25); gl.position.set(x, y + hh, z + 0.42 * k + 0.05); scene.add(gl);
      pumpkins.push(gl);
    });
  const pumpkinLight = new THREE.PointLight(0xff7a20, 0.9, 7, 2); pumpkinLight.position.set(0, 1.2, -13.5); scene.add(pumpkinLight);
  rig.light(pumpkinLight, { amt: 0.3, speed: 1.3 });

  /* ---------- grounds: trees, graves, bats, fog ---------- */
  [[-15, -2, 1.35, 3], [17, 2, 1.45, 5], [-24, -14, 1.2, 8], [27, -9, 1.3, 11], [-7, 21, 1.0, 13], [10, 25, 0.9, 17]]
    .forEach(([x, z, s, seed]) => { const t = P.deadTree(seed, s); t.position.set(x, 0, z); scene.add(t); });
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI + Math.PI, r = 55 + Math.random() * 35;
    const t = P.deadTree(40 + i, 1.2 + Math.random() * 0.8); t.position.set(Math.cos(a) * r, 0, -20 + Math.sin(a) * r * 0.6 - 10); scene.add(t);
  }
  for (let i = 0; i < 11; i++) {
    const g = P.gravestone(i + 2); g.position.set(-13 + (i % 4) * 2.2 + Math.random() * 0.6, 0, -6 + Math.floor(i / 4) * 2.6 + Math.random()); scene.add(g);
  }
  for (let i = 0; i < 4; i++) {
    const g = P.gravestone(i + 30); g.position.set(8 + i * 1.9, 0, -3 + Math.random() * 3); scene.add(g);
  }

  const batTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.beginPath(); g.ellipse(64, 34, 7, 12, 0, 0, TAU); g.fill();
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(64, 28); g.quadraticCurveTo(64 + s * 30, 6, 64 + s * 62, 18);
      g.quadraticCurveTo(64 + s * 50, 26, 64 + s * 44, 40); g.quadraticCurveTo(64 + s * 34, 30, 64 + s * 24, 44);
      g.quadraticCurveTo(64 + s * 16, 34, 64, 42); g.fill();
    }
    return new THREE.CanvasTexture(c);
  })();
  const bats = [];
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: batTex, color: 0x000000, transparent: true, depthWrite: false }));
    b.material.fog = false; scene.add(b);
    bats.push({ b, r: 5 + Math.random() * 7, h: 18 + Math.random() * 8, sp: 0.4 + Math.random() * 0.5, ph: Math.random() * TAU, s: 0.7 + Math.random() * 0.5 });
  }

  const fog = P.fogLayer({ count: 46, w: 90, d: 70, x: 0, z: -5, y: 0.2, size: 13, color: 0x8796b0, opacity: 0.2, speed: 0.06, spread: 1.2 });
  scene.add(fog.group); updaters.push(fog);
  const fogHigh = P.fogLayer({ count: 14, w: 60, d: 30, x: 0, z: -30, y: 6, size: 26, color: 0x5a6680, opacity: 0.12, speed: 0.04, spread: 6 });
  scene.add(fogHigh.group); updaters.push(fogHigh);

  /* ---------- fireworks for the escape ---------- */
  const bursts = [];
  function firework(pos, color) {
    const n = 200, p = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++) {
      p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
      const a = Math.random() * TAU, b = Math.acos(Math.random() * 2 - 1), s = 8 + Math.random() * 5;
      v.push(Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ color, size: 1.4, map: Tx.glow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    m.fog = false;
    const pts = new THREE.Points(geo, m); scene.add(pts);
    bursts.push({ pts, v, age: 0 });
    HH.Audio.sfx.firework();
  }

  /* ---------- per-frame ---------- */
  const set = {
    scene, lights: rig, ambience: 'exterior', autoLightning: [7, 16], flashScale: 0.4,
    home: { pos: new THREE.Vector3(0, 1.9, 25), look: new THREE.Vector3(0, 9, -20) },
    anchors: { door: new THREE.Vector3(0, 2.6, -20) },
    door, windows, figure, idle: false, firework,

    setFlash(f) {
      skyU.flash.value = f;
      bolt.intensity = f * 2.6;
      stars.material.opacity = 0.7 * (1 - f);
      if (f > 0.5 && !figureArmed && Math.random() < 0.35) figureArmed = true;
      figure.material.opacity = figureArmed && f > 0.05 ? 0.95 : 0;
      if (f === 0) figureArmed = false;
    },

    // Kill every warm window one by one (used after the escape).
    windowsOut() {
      windows.forEach((w, i) => setTimeout(() => { w.on = 0; }, 400 + i * 260));
    },

    onEnter() { windows.forEach(w => { w.on = 1; }); door.set(0); },

    update(t, dt) {
      updaters.forEach(u => u.update(t));
      clouds.forEach((c, i) => { c.position.x += dt * (1.2 + i * 0.15); if (c.position.x > 380) c.position.x = -380; });
      windows.forEach(w => {
        if (w.kind === 'dark') return;
        const fl = w.kind === 'warm' ? 0.85 + Math.sin(t * 9 + w.seed) * 0.06 + Math.sin(t * 23 + w.seed) * 0.05 : 1;
        w.pane.material.color.setScalar(w.base * fl * w.on + 0.02);
      });
      pumpkins.forEach((g, i) => { g.material.opacity = 0.22 + Math.sin(t * 8 + i) * 0.04 + Math.random() * 0.04; });
      bats.forEach(o => {
        const a = t * o.sp + o.ph;
        o.b.position.set(12.6 + Math.cos(a) * o.r, o.h + Math.sin(a * 2.3) * 1.2, -21.5 + Math.sin(a) * o.r);
        const flap = Math.abs(Math.sin(t * 14 + o.ph));
        o.b.scale.set(1.2 * o.s, (0.25 + flap * 0.45) * o.s, 1);
      });
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i]; b.age += dt;
        const p = b.pts.geometry.attributes.position.array;
        for (let k = 0; k < b.v.length; k += 3) {
          b.v[k + 1] -= 4 * dt;
          p[k] += b.v[k] * dt; p[k + 1] += b.v[k + 1] * dt; p[k + 2] += b.v[k + 2] * dt;
          b.v[k] *= 0.985; b.v[k + 1] *= 0.985; b.v[k + 2] *= 0.985;
        }
        b.pts.geometry.attributes.position.needsUpdate = true;
        b.pts.material.opacity = Math.max(0, 1 - b.age / 2.6);
        if (b.age > 2.7) { scene.remove(b.pts); b.pts.geometry.dispose(); bursts.splice(i, 1); }
      }
      if (set.idle) {
        const r = HH.World.rig;
        r.pos.set(Math.sin(t * 0.05) * 3.5, 1.9 + Math.sin(t * 0.11) * 0.25, 25 + Math.sin(t * 0.07) * 2);
        r.look.set(Math.sin(t * 0.04) * 1.5, 9 + Math.sin(t * 0.09) * 0.6, -20);
      }
    }
  };
  return set;
});
