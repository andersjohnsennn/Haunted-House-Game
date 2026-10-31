/* ==========================================================================
   Set: the Knight's hall. A torch-lit castle tavern x -8..8, z 0..-16.
   A long table at z -8.4; the undead knight sits behind it at z -9.7;
   four vessels on the near edge; a portcullis in the right wall (the exit).
   ========================================================================== */

HH.World.define('knight_hall', function () {
  const P = HH.Props, Tx = HH.Tex, at = P.at, HALF = Math.PI / 2, TAU = Math.PI * 2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040302);
  scene.fog = new THREE.FogExp2(0x0a0705, 0.04);
  const rig = new P.LightRig();
  const updaters = [];
  const H = 7;

  function rustTex() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#4a3a30'; g.fillRect(0, 0, 256, 256);
    g.globalCompositeOperation = 'overlay'; g.drawImage(Tx.noiseCanvas(71, 16), 0, 0);
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, r = 4 + Math.random() * 22, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${140 + Math.random() * 60},${60 + Math.random() * 30},20,0.55)`); gr.addColorStop(1, 'rgba(120,50,10,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function bannerTex() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 320;
    const g = c.getContext('2d');
    g.fillStyle = '#5a0c0c'; g.fillRect(0, 0, 128, 300);
    g.beginPath(); g.moveTo(0, 300); g.lineTo(64, 270); g.lineTo(128, 300); g.lineTo(128, 320); g.lineTo(0, 320); g.closePath(); g.fillStyle = '#000'; g.globalCompositeOperation = 'destination-out'; g.fill();
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = '#b08a3e'; g.lineWidth = 5; g.strokeRect(10, 10, 108, 250);
    g.fillStyle = '#d8cfb8'; g.beginPath(); g.ellipse(64, 120, 30, 34, 0, 0, TAU); g.fill();
    g.fillStyle = '#5a0c0c'; g.beginPath(); g.arc(52, 116, 8, 0, TAU); g.arc(76, 116, 8, 0, TAU); g.fill(); g.fillRect(56, 140, 16, 10);
    g.strokeStyle = '#d8cfb8'; g.lineWidth = 7; g.beginPath(); g.moveTo(30, 175); g.lineTo(98, 225); g.moveTo(98, 175); g.lineTo(30, 225); g.stroke();
    g.globalCompositeOperation = 'multiply'; g.drawImage(Tx.noiseCanvas(73, 8), 0, 0, 128, 320);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }

  /* ---------- shell ---------- */
  const stoneWall = (w, h) => P.mat({ map: Tx.tiled(Tx.stone('#3e3730', 81, 64), w / 4, h / 4), roughness: 0.95 });
  const wall = (w, h, x, y, z, ry) => scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(w, h), stoneWall(w, h)), x, y, z, 0, ry));
  const floorTex = Tx.tiled(Tx.wood(82, '#2e1d10', 8), 4, 4); floorTex.rotation = HALF;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), P.mat({ map: floorTex, roughness: 0.7 }));
  floor.rotation.x = -HALF; floor.position.set(0, 0, -8); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), P.mat({ color: 0x0a0705 }));
  ceil.rotation.x = HALF; ceil.position.set(0, H, -8); scene.add(ceil);
  const beam = P.mat({ map: Tx.tiled(Tx.wood(83, '#1e1208', 2), 4, 0.5), roughness: 0.8 });
  for (const z of [-2, -6, -10, -14]) scene.add(at(P.box(16, 0.45, 0.4, beam), 0, H - 0.25, z));
  wall(16, H, -8, H / 2, -8, HALF);
  wall(2.8, H, 8, H / 2, -1.4, -HALF);
  wall(10.8, H, 8, H / 2, -10.6, -HALF);
  wall(2.4, H - 3.4, 8, 3.4 + (H - 3.4) / 2, -4, -HALF);
  wall(16, H, 0, H / 2, -16, 0);
  wall(16, H, 0, H / 2, 0, Math.PI);

  /* ---------- table, benches, throne ---------- */
  const tableWood = P.mat({ map: Tx.tiled(Tx.wood(84, '#3a2312', 6), 2, 1), roughness: 0.65 });
  scene.add(at(P.box(4.6, 0.12, 1.7, tableWood), 0, 0.92, -8.4));
  for (const [x, z] of [[-2.1, -7.7], [2.1, -7.7], [-2.1, -9.1], [2.1, -9.1]]) scene.add(at(P.box(0.14, 0.86, 0.14, tableWood), x, 0.43, z));
  scene.add(at(P.box(4.4, 0.1, 0.4, tableWood), 0, 0.48, -6.9));
  for (const x of [-1.9, 1.9]) scene.add(at(P.box(0.1, 0.48, 0.36, tableWood), x, 0.24, -6.9));
  const throne = new THREE.Group(); throne.position.set(0, 0, -10.0); scene.add(throne);
  throne.add(at(P.box(1.3, 0.12, 1.0, tableWood), 0, 0.62, 0));
  throne.add(at(P.box(1.3, 2.6, 0.14, tableWood), 0, 1.3, -0.5));
  for (const x of [-0.6, 0.6]) { throne.add(at(P.box(0.12, 0.62, 0.12, tableWood), x, 0.31, 0.4)); throne.add(at(P.cyl(0.08, 0.08, 0.3, tableWood, 8), x, 2.75, -0.5)); }
  const plate = P.mat({ color: 0x8a8a90, metalness: 0.7, roughness: 0.4 });
  [[-1.6, -8.8], [1.4, -8.9]].forEach(([x, z]) => scene.add(at(P.cyl(0.22, 0.2, 0.03, plate, 20), x, 0.99, z)));
  scene.add(at(P.candelabra(rig, 3), -1.9, 0.98, -8.9));
  scene.add(at(P.candelabra(rig, 3), 1.9, 0.98, -8.9));

  /* ---------- the knight ---------- */
  const rust = P.mat({ map: rustTex(), color: 0xb0a090, metalness: 0.55, roughness: 0.7 });
  const darkCloth = P.mat({ color: 0x140808, roughness: 1, side: THREE.DoubleSide });
  const kn = new THREE.Group(); kn.position.set(0, 0, -9.75); kn.scale.setScalar(1.28); scene.add(kn);
  const torso = new THREE.Group(); kn.add(torso);
  torso.add(at(P.cyl(0.36, 0.3, 0.32, rust, 12), 0, 0.56, 0));
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.31, 0.62, 14), rust); chest.scale.z = 0.72; chest.position.y = 0.98; torso.add(chest);
  torso.add(at(P.box(0.05, 0.5, 0.06, rust), 0, 1.0, 0.27));
  torso.add(at(P.cyl(0.14, 0.17, 0.12, rust, 10), 0, 1.34, 0));
  for (const s of [-1, 1]) {
    const pa = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10, 0, TAU, 0, Math.PI / 2), rust); pa.scale.set(1.2, 0.8, 1); pa.position.set(s * 0.44, 1.24, 0); torso.add(pa);
    torso.add(at(P.box(0.16, 0.13, 0.55, rust), s * 0.17, 0.5, 0.28));
    torso.add(at(P.box(0.14, 0.5, 0.15, rust), s * 0.17, 0.25, 0.55));
  }
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.3, 6, 6), darkCloth); cape.position.set(0, 0.75, -0.3); torso.add(cape);
  const head = new THREE.Group(); head.position.set(0, 1.42, 0.02); torso.add(head);
  head.add(at(P.cyl(0.19, 0.21, 0.4, rust, 14), 0, 0.2, 0));
  head.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.12, 14), rust), 0, 0.46, 0));
  head.add(at(P.box(0.02, 0.36, 0.05, rust), 0, 0.22, 0.2));
  const slitM = new THREE.MeshBasicMaterial({ color: 0xff5a1a, toneMapped: false });
  head.add(at(P.box(0.3, 0.025, 0.05, slitM), 0, 0.26, 0.19));
  const eyes = [-0.07, 0.07].map(x => { const e = P.glowSprite(0xff5018, 0.22, 0.5); e.position.set(x, 0.26, 0.24); head.add(e); return e; });
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.28, 8), P.mat({ color: 0xb8ac90 }));
    horn.position.set(s * 0.2, 0.42, 0); horn.rotation.z = -s * 0.9; head.add(horn);
  }
  // Arms: shoulder -> elbow -> hand, so poses can be blended.
  const arms = [-1, 1].map(s => {
    const sh = new THREE.Group(); sh.position.set(s * 0.44, 1.22, 0); torso.add(sh);
    const up = P.cyl(0.085, 0.075, 0.34, rust, 10); up.geometry.translate(0, -0.17, 0); sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.34; sh.add(el);
    const fo = P.cyl(0.075, 0.065, 0.32, rust, 10); fo.geometry.translate(0, -0.16, 0); el.add(fo);
    const hand = new THREE.Group(); hand.position.y = -0.34; el.add(hand);
    hand.add(at(P.box(0.13, 0.12, 0.14, rust), 0, -0.02, 0));
    return { s, sh, el, hand };
  });
  const POSE = {
    rest: { sx: -0.35, sz: 0, ex: -1.2 },
    hold: { sx: -0.9, sz: 0, ex: -1.4 },
    drink: { sx: -2.25, sz: -0.45, ex: -1.65 },
    slam: { sx: -0.25, sz: 0, ex: -1.05 },
    raise: { sx: -2.9, sz: 0.2, ex: -0.3 }
  };
  const knight = {
    arm: [{ ...POSE.rest }, { ...POSE.rest }],
    head: { x: 0.25, y: 0 }, eyes: 0.4, laugh: 0, bow: 0, lean: 0,
    to(side, pose, dur = 0.6, ease = 'inOut') {
      const a = knight.arm[side], from = { ...a }, p = POSE[pose];
      return HH.Tween.add({ dur, ease, update: k => { a.sx = from.sx + (p.sx - from.sx) * k; a.sz = from.sz + (p.sz - from.sz) * k; a.ex = from.ex + (p.ex - from.ex) * k; } });
    },
    tween(prop, to, dur = 0.6) {
      const from = knight[prop];
      return HH.Tween.add({ dur, update: k => { knight[prop] = from + (to - from) * k; } });
    },
    wake() { knight.tween('eyes', 1, 1.2); HH.Tween.add({ dur: 1.4, update: k => { knight.head.x = 0.25 * (1 - k); } }); }
  };

  /* ---------- four vessels ---------- */
  const wood = P.mat({ map: Tx.tiled(Tx.wood(85, '#5a3a1e', 3), 0.5, 0.5), roughness: 0.6 });
  const silver = P.mat({ color: 0xb8b4a8, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide });
  const bone = P.mat({ color: 0xcfc4a6, roughness: 0.55, side: THREE.DoubleSide });
  const horn = P.mat({ color: 0x8a6a40, roughness: 0.5, side: THREE.DoubleSide });
  const iron = P.iron();
  const drinkM = () => new THREE.MeshBasicMaterial({ color: 0x3a1a08 });
  function vessel(kind) {
    const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
    let top = 0.3, radius = 0.1;
    if (kind === 'tankard') {
      inner.add(at(P.cyl(0.1, 0.11, 0.28, wood, 16), 0, 0.14, 0));
      for (const y of [0.05, 0.23]) inner.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.01, 6, 20), iron), 0, y, 0, HALF));
      inner.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 12, Math.PI), iron), 0.11, 0.15, 0, 0, 0, -HALF));
      top = 0.27;
    } else if (kind === 'goblet') {
      const prof = [[0, 0], [0.09, 0], [0.09, 0.015], [0.02, 0.04], [0.016, 0.15], [0.05, 0.19], [0.09, 0.26], [0.1, 0.34]].map(([r, y]) => new THREE.Vector2(r, y));
      inner.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 20), silver));
      top = 0.32; radius = 0.095;
    } else if (kind === 'horn') {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.08, 0.05, 0), new THREE.Vector3(0.02, 0.1, 0), new THREE.Vector3(0.06, 0.22, 0), new THREE.Vector3(0.05, 0.36, 0)]);
      const geo = new THREE.TubeGeometry(curve, 16, 0.05, 12, false), p = geo.attributes.position;
      for (let r = 0; r <= 16; r++) {
        const c = curve.getPointAt(r / 16), s = 0.15 + 0.85 * (r / 16);
        for (let k = 0; k <= 12; k++) { const i = r * 13 + k; p.setXYZ(i, c.x + (p.getX(i) - c.x) * s, c.y + (p.getY(i) - c.y) * s, c.z + (p.getZ(i) - c.z) * s); }
      }
      geo.computeVertexNormals();
      inner.add(new THREE.Mesh(geo, horn));
      inner.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 16), silver), 0.05, 0.36, 0, HALF));
      inner.add(at(P.cyl(0.006, 0.006, 0.12, iron, 4), -0.02, 0.06, 0, 0, 0, 0.6));
      top = 0.35; radius = 0.045;
    } else {
      const sk = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14, 0, TAU, 0.55, Math.PI - 0.55), bone);
      sk.scale.set(1, 1.05, 1.2); sk.position.y = 0.13; sk.rotation.x = Math.PI; inner.add(sk);
      for (const s of [-1, 1]) inner.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshBasicMaterial({ color: 0 })), s * 0.045, 0.12, 0.13));
      inner.add(at(P.box(0.08, 0.04, 0.05, bone), 0, 0.04, 0.12));
      top = 0.23; radius = 0.1;
    }
    const liquid = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.92, 18), drinkM());
    liquid.rotation.x = -HALF; liquid.position.set(kind === 'horn' ? 0.05 : 0, top - 0.02, 0); inner.add(liquid);
    return { g, inner, liquid, top };
  }
  const CUPS = [['tankard', 'The tankard'], ['goblet', 'The goblet'], ['horn', 'The drinking horn'], ['skull', 'The skull cup']];
  const slots = [-1.5, -0.5, 0.5, 1.5].map(x => new THREE.Vector3(x, 0.98, -7.85));
  const cups = CUPS.map(([kind, name], i) => {
    const v = vessel(kind); v.name = name; v.g.position.copy(slots[i]); v.g.scale.setScalar(1.4); scene.add(v.g);
    const glow = P.glowSprite(0xffb060, 0.7, 0); glow.position.set(0, 0.25, 0); v.g.add(glow); v.glow = glow;
    return v;
  });
  let held = -1, drinking = null;

  /* ---------- torches, hearth, banners, barrels ---------- */
  const torch = (x, y, z, ry) => {
    const g = new THREE.Group(); at(g, x, y, z, 0, ry); scene.add(g);
    g.add(at(P.cyl(0.04, 0.03, 0.55, P.mat({ color: 0x2a1a0e }), 6), 0, 0, 0.18, 0.6));
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tx.flame(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    f.scale.set(0.3, 0.55, 1); f.position.set(0, 0.42, 0.3); g.add(f);
    const gl = P.glowSprite(0xff8a30, 1.8, 0.35); gl.position.copy(f.position); g.add(gl);
    rig.flame(f, gl);
  };
  torch(-3.6, 2.6, -15.9, 0); torch(3.6, 2.6, -15.9, 0); torch(-7.9, 2.6, -11, HALF); torch(7.9, 2.6, -11, -HALF);
  for (const [x, z] of [[-3.6, -14.8], [3.6, -14.8]]) { const l = new THREE.PointLight(0xff8a30, 1.1, 11, 1.6); l.position.set(x, 3, z); scene.add(l); rig.light(l, { amt: 0.3, speed: 1.3 }); }
  const tableLight = new THREE.PointLight(0xffa050, 1.2, 7, 1.7); tableLight.position.set(0, 2.4, -7.6); scene.add(tableLight); rig.light(tableLight, { amt: 0.18 });
  const hearthLight = new THREE.PointLight(0xff5a18, 1.2, 9, 1.6); hearthLight.position.set(-7.0, 0.9, -5.5); scene.add(hearthLight); rig.light(hearthLight, { amt: 0.35, speed: 1.5 });
  const hstone = P.mat({ map: Tx.tiled(Tx.stone('#3a3631', 86, 48), 1, 1), roughness: 0.95 });
  scene.add(at(P.box(0.7, 2.4, 3.2, hstone), -7.7, 1.2, -5.5));
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.3), new THREE.MeshBasicMaterial({ color: 0x0a0300 })); at(hole, -7.34, 0.65, -5.5, 0, HALF); scene.add(hole);
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tx.flame(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, color: 0xffb070 }));
    f.position.set(-7.25, 0.35, -6.2 + i * 0.35); f.scale.set(0.3, 0.55, 1); scene.add(f); rig.flame(f, null);
  }
  const bannerM = new THREE.MeshStandardMaterial({ map: bannerTex(), transparent: true, side: THREE.DoubleSide, roughness: 1 });
  for (const x of [-2.2, 2.2]) scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.75), bannerM), x, 4.2, -15.9));
  const barrelM = P.mat({ map: Tx.tiled(Tx.wood(87, '#3a2414', 8), 1, 1), roughness: 0.7 });
  [[6.6, -14.6], [7.2, -13.4], [6.9, -14.0, 1.1]].forEach(([x, z, y = 0]) => {
    const b = P.cyl(0.42, 0.42, 1.0, barrelM, 16); b.position.set(x, 0.5 + y, z); scene.add(b);
    for (const yy of [0.2, 0.8]) scene.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.02, 6, 24), iron), x, yy + y, z, HALF));
  });

  /* ---------- portcullis exit in the right wall ---------- */
  const portcullis = new THREE.Group(); portcullis.position.set(7.95, 0, -4); scene.add(portcullis);
  for (let i = 0; i < 9; i++) portcullis.add(at(P.box(0.06, 3.4, 0.06, iron), 0, 1.7, -1.1 + i * 0.275));
  for (let j = 0; j < 6; j++) portcullis.add(at(P.box(0.06, 0.06, 2.3, iron), 0, 0.3 + j * 0.6, 0));
  for (let i = 0; i < 9; i++) portcullis.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), iron), 0, -0.05, -1.1 + i * 0.275, Math.PI));
  scene.add(at(P.doorFrame(2.4, 3.4, hstone, 0.5), 7.95, 0, -4, 0, -HALF));
  const beyond = new THREE.Mesh(new THREE.BoxGeometry(3, 3.4, 2.42), new THREE.MeshBasicMaterial({ color: 0x080402, side: THREE.BackSide }));
  beyond.position.set(9.5, 1.7, -4); scene.add(beyond);
  const exit = { k: 0, silent: true, set(k) { this.k = k; portcullis.position.y = k * 3.5; } };

  scene.add(new THREE.HemisphereLight(0x3a2a20, 0x080505, 0.3));
  const fog = P.fogLayer({ count: 14, w: 15, d: 15, x: 0, z: -8, y: 0.1, size: 4, color: 0x9a8a7a, opacity: 0.08, speed: 0.05, spread: 0.4 });
  scene.add(fog.group); updaters.push(fog);
  const dust = P.dust({ count: 220, w: 14, h: 5, d: 14, x: 0, y: 3, z: -8, color: 0xffc890 });
  scene.add(dust.points); updaters.push(dust);
  const web = (x, y, z, ry, flip) => { const w = P.cobweb(1.6); at(w, x, y, z, 0, ry); if (flip) w.scale.x = -1; scene.add(w); };
  web(-8, H, -15.96, 0); web(8, H, -15.96, 0, true);

  /* ---------- duel mechanics ---------- */
  const handWorld = new THREE.Vector3();
  function resetCups() {
    cups.forEach((c, i) => {
      scene.attach(c.g);
      c.g.position.copy(slots[i]); c.g.rotation.set(0, 0, 0); c.g.scale.setScalar(1.4);
      c.inner.rotation.set(0, 0, 0); c.liquid.visible = true; c.liquid.scale.setScalar(1);
      c.glow.material.opacity = 0; c.g.visible = true;
    });
    held = -1;
  }

  const set = {
    scene, lights: rig, ambience: 'tavern', flashScale: 0, ceiling: H,
    home: { pos: new THREE.Vector3(0, 1.7, -1.8), look: new THREE.Vector3(0, 1.9, -9.6) },
    view: { pos: new THREE.Vector3(0, 1.62, -5.2), look: new THREE.Vector3(0, 1.45, -9.4) },
    anchors: {
      cup0: new THREE.Vector3(-1.5, 1.45, -7.85), cup1: new THREE.Vector3(-0.5, 1.45, -7.85),
      cup2: new THREE.Vector3(0.5, 1.45, -7.85), cup3: new THREE.Vector3(1.5, 1.45, -7.85),
      knight: new THREE.Vector3(0, 2.4, -9.7), exit: new THREE.Vector3(7.9, 1.7, -4)
    },
    doorAt: { exit },
    knight,
    cups: cups.map(c => ({ name: c.name })),

    // The chosen cup slides across the table into the knight's right hand.
    async sendCup(i) {
      const c = cups[i];
      cups.forEach((o, j) => { if (j !== i) HH.Tween.add({ dur: 0.9, update: k => { o.g.position.z = slots[j].z + k * 0.5; o.g.scale.setScalar(1.4 * (1 - k * 0.4)); } }); });
      c.glow.material.opacity = 0.6;
      HH.Audio.sfx.whoosh(0.3);
      arms[1].hand.getWorldPosition(handWorld);
      const p0 = c.g.position.clone(), p1 = new THREE.Vector3(handWorld.x, 0.98, handWorld.z + 0.04);
      await HH.Tween.add({ dur: 1.1, update: k => { c.g.position.lerpVectors(p0, p1, k); }, ease: 'inOut' });
      HH.Audio.sfx.clank(0.4);
      // Into the gauntlet. attach() keeps it upright; then settle into the grip.
      arms[1].hand.attach(c.g);
      const q0 = c.g.position.clone(), r0 = c.g.rotation.x, grip = new THREE.Vector3(0, -0.05, 0.02), upright = -(POSE.rest.sx + POSE.rest.ex);
      await HH.Tween.add({ dur: 0.4, update: k => { c.g.position.lerpVectors(q0, grip, k); c.g.rotation.set(r0 + (upright - r0) * k, 0, 0); } });
      c.glow.material.opacity = 0;
      held = i;
    },

    // Start drinking. Returns { done, finishNow(), stop() }.
    drink(seconds) {
      const st = { t: 0, dur: seconds, live: true, finished: false, nextGulp: 0.35 };
      let resolve;
      st.done = new Promise(r => { resolve = r; });
      st.resolve = resolve;
      st.finishNow = () => { st.dur = Math.min(st.dur, st.t + 0.8); };
      st.stop = () => { st.live = false; };
      drinking = st;
      knight.to(1, 'drink', Math.min(0.7, seconds * 0.25));
      HH.Tween.add({ dur: Math.min(0.8, seconds * 0.3), update: k => { knight.head.x = -0.35 * k; } });
      return st;
    },

    // The knight finishes first: slams the cup down and raises his fist.
    async knightFinished() {
      HH.Tween.add({ dur: 0.3, update: k => { knight.head.x = -0.35 * (1 - k); } });
      await knight.to(1, 'slam', 0.22, 'in');
      HH.Audio.sfx.clank(0.9); HH.World.shake(0.4);
      await knight.to(0, 'raise', 0.5);
    },

    async knightLaughs() {
      HH.Audio.sfx.laugh(0.8, 0.8);
      await HH.Tween.add({ dur: 2.0, update: k => { knight.laugh = Math.sin(k * Math.PI); } });
      knight.laugh = 0;
      knight.to(0, 'rest', 0.8);
    },

    // The team wins: he slams the cup in fury, then bows and the portcullis rises.
    async knightDefeated() {
      if (drinking) drinking.stop();
      HH.Tween.add({ dur: 0.25, update: k => { knight.head.x = -0.35 * (1 - k); } });
      await knight.to(1, 'slam', 0.22, 'in');
      HH.Audio.sfx.clank(1); HH.World.shake(0.5);
      HH.Audio.sfx.voice(0.6, 0.7);
      await HH.Cine.wait(0.5);
      await knight.tween('bow', 1, 1.2);
      HH.Audio.sfx.chains(0.6);
      HH.Cine.move({ look: [7.9, 1.8, -4.2], dur: 1.6 });
      await HH.Tween.add({ dur: 3.2, update: k => exit.set(k), ease: 'inOut' });
    },

    reset() {
      rig.darkness = 0; rig.chaos = 0;
      resetCups();
      drinking = null;
      knight.arm[0] = { ...POSE.rest }; knight.arm[1] = { ...POSE.rest };
      knight.head.x = 0.25; knight.eyes = 0.4; knight.laugh = 0; knight.bow = 0;
      exit.set(0);
    },
    solved() { set.reset(); knight.bow = 1; exit.set(1); },
    onEnter() { rig.darkness = 0; rig.chaos = 0; },

    update(t, dt) {
      updaters.forEach(u => u.update(t));
      // Drinking: the cup tips further and empties; gulps; done when time runs out.
      if (drinking && drinking.live && !drinking.finished) {
        const d = drinking;
        d.t += dt;
        const k = Math.min(1, d.t / d.dur);
        if (held >= 0) {
          cups[held].inner.rotation.x = -0.2 - k * 0.9;
          cups[held].liquid.scale.setScalar(Math.max(0.05, 1 - k));
        }
        if (d.t > d.nextGulp && k < 1) { HH.Audio.sfx.gulp(0.5); d.nextGulp = d.t + 0.42 + Math.random() * 0.12; }
        if (k >= 1) { d.finished = true; set.knightFinished().then(d.resolve); }
      }
      arms.forEach((a, i) => {
        const p = knight.arm[i];
        a.sh.rotation.set(p.sx, 0, a.s * p.sz + (i === 0 ? 0 : 0));
        a.el.rotation.x = p.ex;
      });
      const breathe = Math.sin(t * 1.2) * 0.02;
      torso.rotation.x = 0.04 + breathe + knight.bow * 0.35 - knight.laugh * 0.15;
      torso.position.y = knight.laugh * Math.abs(Math.sin(t * 22)) * 0.04;
      head.rotation.x = knight.head.x + knight.bow * 0.45 - knight.laugh * 0.4;
      head.rotation.y = Math.sin(t * 0.4) * 0.08;
      eyes.forEach(e => { e.material.opacity = knight.eyes * (0.75 + Math.sin(t * 7) * 0.15); });
      slitM.color.setRGB(1 * knight.eyes + 0.1, 0.35 * knight.eyes, 0.1 * knight.eyes);
      cape.rotation.x = Math.sin(t * 0.8) * 0.05;
      cups.forEach(c => { if (c.glow.material.opacity > 0 && held < 0) c.glow.material.opacity = 0.35 + Math.sin(t * 4) * 0.1; });
    }
  };
  return set;
});
