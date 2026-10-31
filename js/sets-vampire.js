/* ==========================================================================
   Set: the Vampire's Table. A red velvet gambling parlour x -7..7, z 0..-13.
   A card table at z -6.8 (top y 0.86); the vampire sits behind it at z -7.9;
   four card slots on the near edge; a secret panel in the right wall at
   z -10.5 (the exit).
   ========================================================================== */

HH.World.define('vampire_parlor', function () {
  const P = HH.Props, Tx = HH.Tex, at = P.at, HALF = Math.PI / 2, TAU = Math.PI * 2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030102);
  scene.fog = new THREE.FogExp2(0x0a0306, 0.045);
  const rig = new P.LightRig();
  const updaters = [];
  const H = 6, TOP = 0.86;

  /* ---------- textures: velvet, playing cards ---------- */
  function velvet() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#3a060c'; g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 2) { const v = Math.sin(x * 0.11) * 0.5 + Math.sin(x * 0.037 + 1) * 0.5; g.fillStyle = `rgba(${v > 0 ? '255,80,90' : '0,0,0'},${Math.abs(v) * 0.16})`; g.fillRect(x, 0, 2, 256); }
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; g.drawImage(Tx.noiseCanvas(101, 16), 0, 0);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function suitPath(g, k, x, y, s) {
    g.beginPath();
    if (k === 'H') { g.moveTo(x, y + s * 0.45); g.bezierCurveTo(x - s * 0.9, y - s * 0.15, x - s * 0.45, y - s * 0.75, x, y - s * 0.3); g.bezierCurveTo(x + s * 0.45, y - s * 0.75, x + s * 0.9, y - s * 0.15, x, y + s * 0.45); }
    else if (k === 'D') { g.moveTo(x, y - s * 0.6); g.lineTo(x + s * 0.42, y); g.lineTo(x, y + s * 0.6); g.lineTo(x - s * 0.42, y); g.closePath(); }
    else if (k === 'S') { g.moveTo(x, y - s * 0.6); g.bezierCurveTo(x + s * 0.9, y - s * 0.05, x + s * 0.45, y + s * 0.6, x, y + s * 0.15); g.bezierCurveTo(x - s * 0.45, y + s * 0.6, x - s * 0.9, y - s * 0.05, x, y - s * 0.6); g.moveTo(x, y + s * 0.05); g.lineTo(x + s * 0.2, y + s * 0.6); g.lineTo(x - s * 0.2, y + s * 0.6); g.closePath(); }
    else { for (const [dx, dy] of [[0, -0.3], [-0.3, 0.08], [0.3, 0.08]]) { g.moveTo(x + dx * s + s * 0.26, y + dy * s); g.arc(x + dx * s, y + dy * s, s * 0.26, 0, TAU); } g.moveTo(x, y); g.lineTo(x + s * 0.18, y + s * 0.6); g.lineTo(x - s * 0.18, y + s * 0.6); g.closePath(); }
    g.fill();
  }
  const PIPS = {
    2: [[.5, .2], [.5, .8]], 3: [[.5, .2], [.5, .5], [.5, .8]], 4: [[.3, .2], [.7, .2], [.3, .8], [.7, .8]],
    5: [[.3, .2], [.7, .2], [.5, .5], [.3, .8], [.7, .8]], 6: [[.3, .2], [.7, .2], [.3, .5], [.7, .5], [.3, .8], [.7, .8]],
    7: [[.3, .2], [.7, .2], [.5, .35], [.3, .5], [.7, .5], [.3, .8], [.7, .8]],
    8: [[.3, .2], [.7, .2], [.5, .35], [.3, .5], [.7, .5], [.5, .65], [.3, .8], [.7, .8]],
    9: [[.3, .2], [.7, .2], [.3, .4], [.7, .4], [.5, .5], [.3, .6], [.7, .6], [.3, .8], [.7, .8]],
    10: [[.3, .2], [.7, .2], [.5, .3], [.3, .4], [.7, .4], [.3, .6], [.7, .6], [.5, .7], [.3, .8], [.7, .8]]
  };
  const faceCache = {};
  function cardFace(card) {
    const key = card.label + card.suit.k;
    if (faceCache[key]) return faceCache[key];
    const W = 256, Hh = 358, c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d');
    g.fillStyle = '#f2ecdc'; g.beginPath(); g.roundRect ? g.roundRect(4, 4, W - 8, Hh - 8, 18) : g.rect(4, 4, W - 8, Hh - 8); g.fill();
    g.strokeStyle = '#b8a888'; g.lineWidth = 3; g.stroke();
    const ink = card.suit.red ? '#b8141a' : '#151515';
    g.fillStyle = ink; g.font = 'bold 52px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const corner = () => { g.fillText(card.label, 36, 42); suitPath(g, card.suit.k, 36, 88, 30); };
    corner();
    g.save(); g.translate(W, Hh); g.rotate(Math.PI); corner(); g.restore();
    const n = card.rank;
    if (n >= 2 && n <= 10) PIPS[n].forEach(([px, py]) => suitPath(g, card.suit.k, 70 + px * 116, 40 + py * 278, 40));
    else if (n === 1) suitPath(g, card.suit.k, W / 2, Hh / 2, 110);
    else {
      g.strokeStyle = ink; g.lineWidth = 4; g.strokeRect(62, 64, W - 124, Hh - 128);
      g.fillStyle = card.suit.red ? 'rgba(184,20,26,0.1)' : 'rgba(20,20,20,0.08)'; g.fillRect(62, 64, W - 124, Hh - 128);
      g.fillStyle = ink; g.font = 'bold 120px Georgia, serif'; g.fillText(card.label, W / 2, Hh / 2 + 6);
      g.fillStyle = '#c09030'; g.beginPath(); g.moveTo(98, 108); g.lineTo(110, 86); g.lineTo(128, 104); g.lineTo(146, 86); g.lineTo(158, 108); g.closePath(); g.fill();
      suitPath(g, card.suit.k, W / 2, Hh - 100, 34);
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    return (faceCache[key] = t);
  }
  const backTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 358; const g = c.getContext('2d');
    g.fillStyle = '#f2ecdc'; g.fillRect(0, 0, 256, 358);
    g.fillStyle = '#5a0a12'; g.fillRect(14, 14, 228, 330);
    g.strokeStyle = 'rgba(230,180,120,0.35)'; g.lineWidth = 2;
    for (let i = -360; i < 360; i += 18) { g.beginPath(); g.moveTo(14 + i, 14); g.lineTo(14 + i + 330, 344); g.moveTo(242 - i, 14); g.lineTo(242 - i - 330, 344); g.stroke(); }
    g.strokeStyle = '#c09030'; g.lineWidth = 4; g.strokeRect(24, 24, 208, 310);
    g.fillStyle = '#1a0306'; g.beginPath(); g.ellipse(128, 179, 52, 34, 0, 0, TAU); g.fill();
    g.fillStyle = '#c09030'; g.beginPath(); g.moveTo(128, 160);
    [[100, 150], [80, 170], [100, 175], [110, 195], [128, 182], [146, 195], [156, 175], [176, 170], [156, 150]].forEach(p => g.lineTo(...p)); g.closePath(); g.fill();
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  })();

  const CW = 0.42, CH = 0.6;
  function cardMesh() {
    const g = new THREE.Group();
    const front = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), new THREE.MeshStandardMaterial({ roughness: 0.5, color: 0xffffff }));
    front.rotation.x = -HALF; front.position.y = 0.002; g.add(front);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.5 }));
    back.rotation.x = HALF; back.position.y = -0.002; g.add(back);
    g.front = front;
    return g;
  }

  /* ---------- shell ---------- */
  const velvetTex = velvet();
  const wallM = (w, h) => { const t = velvetTex.clone(); t.repeat.set(w / 2.5, h / 2.5); t.needsUpdate = true; return P.mat({ map: t, roughness: 0.95 }); };
  const wall = (w, h, x, y, z, ry) => scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallM(w, h)), x, y, z, 0, ry));
  const floorTex = Tx.tiled(Tx.wood(102, '#2a160c', 10), 3, 3); floorTex.rotation = HALF;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 13), P.mat({ map: floorTex, roughness: 0.45, metalness: 0.05 }));
  floor.rotation.x = -HALF; floor.position.set(0, 0, -6.5); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 13), P.mat({ color: 0x0c0606 }));
  ceil.rotation.x = HALF; ceil.position.set(0, H, -6.5); scene.add(ceil);
  wall(13, H, -7, H / 2, -6.5, HALF);
  wall(9.7, H, 7, H / 2, -4.85, -HALF);
  wall(1.7, H, 7, H / 2, -12.15, -HALF);
  wall(1.6, H - 3, 7, 3 + (H - 3) / 2, -10.5, -HALF);
  wall(14, H, 0, H / 2, -13, 0);
  wall(14, H, 0, H / 2, 0, Math.PI);
  const dark = P.mat({ map: Tx.tiled(Tx.wood(103, '#1a0c06', 4), 3, 1), roughness: 0.6 });
  [[13, -6.97, -6.5, HALF], [14, 0, -12.97, 0]].forEach(([len, x, z, ry]) => scene.add(at(P.box(len, 1.0, 0.06, dark), x, 0.5, z, 0, ry)));
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), P.mat({ map: Tx.rug(), roughness: 1 }));
  rug.rotation.x = -HALF; rug.position.set(0, 0.012, -6.8); scene.add(rug);

  // Gothic windows on the left wall, lit by the moon (and lightning).
  const arch = new THREE.Shape(); arch.moveTo(-0.6, 0); arch.lineTo(0.6, 0); arch.lineTo(0.6, 1.8); arch.quadraticCurveTo(0.6, 2.6, 0, 3.0); arch.quadraticCurveTo(-0.6, 2.6, -0.6, 1.8); arch.lineTo(-0.6, 0);
  const panes = [];
  for (const z of [-3.5, -9.5]) {
    const geo = new THREE.ShapeGeometry(arch);
    geo.computeBoundingBox();
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + 0.6) / 1.2, uv.getY(i) / 3);
    const pane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: Tx.windowPane('cold'), toneMapped: false }));
    at(pane, -6.97, 1.4, z, 0, HALF); scene.add(pane); panes.push(pane);
    scene.add(at(P.box(0.1, 3.1, 0.06, dark), -6.93, 2.9, z, 0, HALF));
    scene.add(at(P.box(0.08, 0.06, 1.25, dark), -6.93, 3.1, z));
  }
  const moon = new THREE.DirectionalLight(0x8aa0e0, 0.25); moon.position.set(-8, 6, -6); moon.target.position.set(1, 0, -6); scene.add(moon, moon.target);

  /* ---------- table, chairs, candles ---------- */
  const tableWood = P.mat({ map: Tx.tiled(Tx.wood(104, '#3a1e0e', 6), 1.5, 1), roughness: 0.4, metalness: 0.05 });
  scene.add(at(P.box(2.9, 0.08, 1.6, tableWood), 0, TOP - 0.04, -6.8));
  scene.add(at(P.box(2.6, 0.01, 1.3, P.mat({ color: 0x0e3a24, roughness: 1 })), 0, TOP + 0.005, -6.8));
  for (const [x, z] of [[-1.3, -6.15], [1.3, -6.15], [-1.3, -7.45], [1.3, -7.45]]) scene.add(at(P.cyl(0.06, 0.04, TOP - 0.08, tableWood, 10), x, (TOP - 0.08) / 2, z));
  const chair = new THREE.Group(); chair.position.set(0, 0, -8.35); scene.add(chair);
  const velvetM = P.mat({ map: velvetTex, roughness: 0.9 });
  chair.add(at(P.box(1.0, 0.12, 0.9, velvetM), 0, 0.55, 0.15));
  chair.add(at(P.box(1.1, 2.6, 0.16, velvetM), 0, 1.3, -0.3));
  chair.add(at(P.box(1.24, 0.12, 0.24, P.brass()), 0, 2.62, -0.3));
  for (const x of [-0.52, 0.52]) chair.add(at(P.box(0.08, 0.55, 0.08, tableWood), x, 0.27, 0.5));
  const candleL = P.candelabra(rig, 3), candleR = P.candelabra(rig, 3);
  scene.add(at(candleL, -1.15, TOP, -7.35), at(candleR, 1.15, TOP, -7.35));
  const tl = new THREE.PointLight(0xffa458, 1.1, 7, 1.7); tl.position.set(-1.1, 1.9, -6.8); scene.add(tl); rig.light(tl, { amt: 0.2 });
  const tr = new THREE.PointLight(0xffa458, 1.1, 7, 1.7); tr.position.set(1.1, 1.9, -6.8); scene.add(tr); rig.light(tr, { amt: 0.2 });
  const ch = P.chandelier(rig, 1.4); ch.group.position.set(0, H, -6.2); scene.add(ch.group);
  scene.add(new THREE.HemisphereLight(0x3a1a22, 0x060303, 0.3));
  const p1 = P.painting({ seed: 33, w: 1.2, h: 1.6 }); at(p1.group, -3.4, 3.2, -12.96, 0, 0); scene.add(p1.group);
  const p2 = P.painting({ seed: 35, w: 1.2, h: 1.6 }); at(p2.group, 3.4, 3.2, -12.96, 0, 0); scene.add(p2.group);

  /* ---------- the vampire ---------- */
  const pale = P.mat({ color: 0xd8d2cc, roughness: 0.55, emissive: 0x101820, emissiveIntensity: 0.4 });
  const black = P.mat({ color: 0x0c0a0c, roughness: 0.7 });
  const redSilk = P.mat({ color: 0x7a0a14, roughness: 0.5, side: THREE.BackSide });
  const vamp = new THREE.Group(); vamp.position.set(0, 0, -7.95); scene.add(vamp);
  const vBody = new THREE.Group(); vamp.add(vBody);
  vBody.add(at(P.cyl(0.24, 0.3, 0.8, black, 14), 0, 1.15, 0));
  vBody.add(at(P.box(0.16, 0.5, 0.05, P.mat({ color: 0x5a0a10, roughness: 0.6 })), 0, 1.2, 0.24));
  vBody.add(at(P.box(0.12, 0.1, 0.06, P.mat({ color: 0xe8e0d0 })), 0, 1.47, 0.24));
  // Cape and high collar: open at the front (theta 0 is +z, towards the table).
  const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 1.5, 20, 1, true, 0.6, Math.PI * 2 - 1.2), black);
  cape.position.y = 0.95; vBody.add(cape);
  const collarOut = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.22, 0.55, 18, 1, true, 0.9, Math.PI * 2 - 1.8), black);
  collarOut.position.y = 1.8; collarOut.position.z = -0.04; vBody.add(collarOut);
  const collarIn = new THREE.Mesh(collarOut.geometry, redSilk); collarIn.position.copy(collarOut.position); collarIn.rotation.copy(collarOut.rotation); collarIn.scale.setScalar(0.97); vBody.add(collarIn);
  const vHead = new THREE.Group(); vHead.position.set(0, 1.86, 0.02); vBody.add(vHead);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), pale); skull.scale.set(0.82, 1.12, 0.92); vHead.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.168, 20, 12, 0, TAU, 0, Math.PI * 0.48), black); hair.scale.set(0.84, 1.1, 0.95); hair.rotation.x = -0.25; hair.position.y = 0.02; vHead.add(hair);
  vHead.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), black), 0, 0.1, 0.13, 0.4, 0, Math.PI));
  for (const s of [-1, 1]) {
    vHead.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), pale), s * 0.14, 0.04, -0.01, 0, 0, -s * 1.2));
    vHead.add(at(P.box(0.07, 0.012, 0.01, black), s * 0.05, 0.06, 0.145, 0, 0, s * 0.35));
    vHead.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.04, 6), P.mat({ color: 0xf8f4ea })), s * 0.022, -0.085, 0.14, Math.PI));
  }
  vHead.add(at(P.box(0.07, 0.008, 0.01, P.mat({ color: 0x3a0606 })), 0, -0.065, 0.145));
  const vEyes = [-0.05, 0.05].map(x => {
    vHead.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a })), x, 0.03, 0.14));
    const e = P.glowSprite(0xff1a10, 0.13, 0.7); e.position.set(x, 0.03, 0.16); vHead.add(e); return e;
  });
  // Long pale hands that deal.
  const hands = [-1, 1].map(s => {
    const h = new THREE.Group(); vamp.add(h);
    h.add(at(P.box(0.09, 0.03, 0.11, pale), 0, 0, 0));
    for (let f = 0; f < 4; f++) h.add(at(P.cyl(0.008, 0.006, 0.13, pale, 5), (f - 1.5) * 0.022, 0, 0.11, HALF));
    h.add(at(P.cyl(0.009, 0.007, 0.08, pale, 5), -s * 0.05, 0, 0.04, HALF, 0, -s * 0.8));
    h.add(at(P.cyl(0.05, 0.05, 0.5, black, 8), 0, 0.05, -0.3, HALF - 0.3));
    return { g: h, s, rest: new THREE.Vector3(s * 0.38, TOP + 0.02, 0.75), target: new THREE.Vector3(s * 0.38, TOP + 0.02, 0.75) };
  });
  const V = { rise: 0, fury: 0, laugh: 0, eyes: 0.6 };

  /* ---------- cards on the table ---------- */
  const slots = [-0.84, -0.28, 0.28, 0.84].map(x => new THREE.Vector3(x, TOP + 0.012, -6.3));
  const deckPos = new THREE.Vector3(-0.85, TOP + 0.03, -7.1), burnPos = new THREE.Vector3(1.2, TOP + 0.012, -7.15);
  const deckMesh = new THREE.Group(); scene.add(deckMesh);
  for (let i = 0; i < 6; i++) { const c = cardMesh(); c.rotation.z = Math.PI; c.position.y = i * 0.006; deckMesh.add(c); }
  deckMesh.position.copy(deckPos);
  const fan = new THREE.Group(); fan.position.set(0, 1.4, -7.4); scene.add(fan);
  const fanCards = [];
  for (let i = 0; i < 7; i++) { const c = cardMesh(); c.rotation.set(-HALF, 0, 0); const piv = new THREE.Group(); piv.add(c); c.position.set(0, 0.25, 0); fan.add(piv); fanCards.push(piv); }
  fan.visible = false;
  let onTable = [];   // card meshes currently dealt
  let burned = [];
  const tw = (dur, fn, ease = 'inOut') => HH.Tween.add({ dur, update: fn, ease });

  /* ---------- secret panel (exit) ---------- */
  const holder = new THREE.Group(); holder.position.set(7.0, 0, -11.3); holder.rotation.y = -HALF; scene.add(holder);
  const panel = P.door({ w: 1.6, h: 3.0, tone: '#2a1208', hinge: 'left', max: 1.4 });
  holder.add(panel.pivot);
  const vb = P.doorway(1.6, 3.0, 2.2, 'warm'); vb.position.set(0.8, 1.5, -1.1); holder.add(vb);
  const exit = { k: 0, set(k) { this.k = k; panel.set(k * 0.9); } };

  const fog = P.fogLayer({ count: 12, w: 13, d: 12, x: 0, z: -6.5, y: 0.1, size: 4, color: 0x9a6a7a, opacity: 0.08, speed: 0.05, spread: 0.4 });
  scene.add(fog.group); updaters.push(fog);
  const web = (x, y, z, ry, flip) => { const w = P.cobweb(1.4); at(w, x, y, z, 0, ry); if (flip) w.scale.x = -1; scene.add(w); };
  web(-7, H, -12.96, 0); web(7, H, -12.96, 0, true);

  const handTo = (i, p, dur = 0.5) => { const h = hands[i], p0 = h.target.clone(); return tw(dur, k => h.target.lerpVectors(p0, p, k)); };
  const local = v => vamp.worldToLocal(v.clone());

  const set = {
    scene, lights: rig, ambience: 'parlor', autoLightning: [9, 18], flashScale: 0.08, ceiling: H,
    home: { pos: new THREE.Vector3(0, 1.7, -1.4), look: new THREE.Vector3(0, 1.3, -8) },
    view: { pos: new THREE.Vector3(0, 1.8, -4.25), look: new THREE.Vector3(0, 0.95, -6.75) },
    anchors: { table: new THREE.Vector3(0, TOP, -6.8), exit: new THREE.Vector3(6.9, 1.7, -10.5) },
    exitVia: [new THREE.Vector3(2.8, 0, -5.5)],
    doorAt: { exit },

    setFlash(f) { panes.forEach(p => p.material.color.setScalar(0.7 + f * 3)); moon.intensity = 0.25 + f * 2.5; },

    // He lifts the deck, fans it out, then sets it down.
    async revealDeck() {
      deckMesh.visible = false; fan.visible = true; fan.position.set(-0.4, 0.6, -7.5);
      fanCards.forEach(p => { p.rotation.z = 0; });
      handTo(0, local(new THREE.Vector3(-0.4, 1.0, -7.3)), 1.2);
      HH.Audio.sfx.whisper(0.25, 0);
      await tw(1.2, k => { fan.position.set(-0.4 + 0.4 * k, 0.6 + 0.85 * k, -7.5 + 0.2 * k); });
      HH.Audio.sfx.cardDeal();
      await tw(0.9, k => fanCards.forEach((p, i) => { p.rotation.z = (i - 3) * 0.18 * k; }), 'out');
      await HH.Cine.wait(1.0);
      await tw(0.6, k => fanCards.forEach((p, i) => { p.rotation.z = (i - 3) * 0.18 * (1 - k); }));
      await tw(0.8, k => { fan.position.lerpVectors(new THREE.Vector3(0, 1.45, -7.3), deckPos, k); });
      fan.visible = false; deckMesh.visible = true;
      HH.Audio.sfx.cardDeal();
      await handTo(0, hands[0].rest, 0.6);
    },

    // Deal a card face-down from the deck to slot i.
    async deal(i, card) {
      const m = cardMesh();
      m.card = card;
      m.front.material.map = cardFace(card); m.front.material.needsUpdate = true;
      m.rotation.z = Math.PI; m.position.copy(deckPos).setY(deckPos.y + 0.04);
      scene.add(m); onTable[i] = m;
      handTo(0, local(deckPos).setY(TOP + 0.06), 0.3);
      await HH.Cine.wait(0.3);
      HH.Audio.sfx.cardDeal();
      const p0 = m.position.clone(), p1 = slots[i];
      await tw(0.55, k => {
        m.position.lerpVectors(p0, p1, k); m.position.y += Math.sin(k * Math.PI) * 0.12;
        hands[0].target.copy(local(m.position).setY(TOP + 0.05));
      });
      handTo(0, hands[0].rest, 0.5);
    },

    // A card kept from an earlier attempt: straight onto slot i, face-up.
    async placeFaceUp(i, card) {
      const m = cardMesh();
      m.card = card;
      m.front.material.map = cardFace(card); m.front.material.needsUpdate = true;
      m.rotation.z = 0;
      const y1 = slots[i].y, y0 = y1 + 0.3;
      m.position.copy(slots[i]).setY(y0);
      scene.add(m); onTable[i] = m;
      HH.Audio.sfx.cardDeal();
      await tw(0.35, k => { m.position.y = y0 + (y1 - y0) * k; }, 'in');
    },

    // Turn slot i face-up.
    async flip(i) {
      const m = onTable[i];
      handTo(1, local(m.position).setY(TOP + 0.06), 0.35);
      await HH.Cine.wait(0.35);
      HH.Audio.sfx.cardFlip();
      const y0 = m.position.y;
      await tw(0.5, k => { m.rotation.z = Math.PI * (1 - k); m.position.y = y0 + Math.sin(k * Math.PI) * 0.18; });
      m.position.y = y0;
      handTo(1, hands[1].rest, 0.5);
    },

    // Push the card in slot i aside onto the discard pile.
    async burn(i) {
      const m = onTable[i];
      const p0 = m.position.clone(), p1 = burnPos.clone().setY(burnPos.y + burned.length * 0.004);
      HH.Audio.sfx.cardDeal();
      await tw(0.5, k => { m.position.lerpVectors(p0, p1, k); m.rotation.y = 0.3 * k; });
      burned.push(m); onTable[i] = null;
    },

    // Defeated: he rises, slams the table, the candles die, the panel opens.
    async fury() {
      V.eyes = 1.6;
      HH.Audio.sfx.voice(0.7, 1.1);
      await tw(0.9, k => { V.rise = k; V.fury = k; });
      await Promise.all([handTo(0, new THREE.Vector3(-0.4, 1.5, 0.55), 0.35), handTo(1, new THREE.Vector3(0.4, 1.5, 0.55), 0.35)]);
      await Promise.all([handTo(0, new THREE.Vector3(-0.38, TOP + 0.02, 0.8), 0.12), handTo(1, new THREE.Vector3(0.38, TOP + 0.02, 0.8), 0.12)]);
      HH.Audio.sfx.slam(0.9); HH.World.shake(0.7);
      onTable.concat(burned).forEach(m => { if (m) { const y0 = m.position.y; tw(0.4, k => { m.position.y = y0 + Math.sin(k * Math.PI) * 0.12; m.rotation.y += 0.02; }); } });
      HH.Audio.sfx.whoosh(0.6);
      await tw(0.7, k => { rig.darkness = 0.85 * k; }, 'out');
      await HH.Cine.wait(0.6);
      HH.Cine.look([6.9, 1.7, -10.5], 1.3);
      HH.Audio.sfx.doorOpen(2.2);
      await tw(2.2, k => exit.set(k));
    },

    // He wins: laughs and sweeps away the card that beat them (and any burned
    // ones). Correctly predicted cards stay on the table.
    async gloat(slot) {
      HH.Audio.sfx.laugh(0.7, 1.35);
      await tw(1.6, k => { V.laugh = Math.sin(k * Math.PI); });
      HH.Audio.sfx.cardDeal();
      const gone = burned.concat(slot === undefined ? onTable : [onTable[slot]]).filter(Boolean);
      const from = gone.map(m => m.position.clone());
      await tw(0.7, k => gone.forEach((m, j) => { m.position.lerpVectors(from[j], deckPos, k); }));
      gone.forEach(m => { m.visible = false; });
    },

    reset() {
      rig.darkness = 0; rig.chaos = 0;
      onTable.concat(burned).forEach(m => { if (m) scene.remove(m); });
      onTable = []; burned = [];
      deckMesh.visible = true; fan.visible = false;
      V.rise = 0; V.fury = 0; V.laugh = 0; V.eyes = 0.6;
      hands.forEach(h => h.target.copy(h.rest));
      exit.set(0);
    },
    solved() { set.reset(); exit.set(1); V.eyes = 0.2; },
    onEnter() { rig.darkness = 0; rig.chaos = 0; },

    update(t, dt) {
      updaters.forEach(u => u.update(t));
      vBody.position.y = V.rise * 0.3 + V.laugh * Math.abs(Math.sin(t * 20)) * 0.03;
      vBody.rotation.x = -V.laugh * 0.12 + V.fury * 0.1;
      vHead.rotation.x = -V.laugh * 0.35 + Math.sin(t * 0.5) * 0.04;
      vHead.rotation.y = Math.sin(t * 0.35) * 0.12;
      vEyes.forEach(e => { e.material.opacity = Math.min(1, V.eyes * (0.6 + Math.sin(t * 3) * 0.2)); e.scale.setScalar(0.13 * (1 + V.fury * 0.8)); });
      hands.forEach((h, i) => {
        h.g.position.lerp(h.target, Math.min(1, dt * 12));
        h.g.position.y += Math.sin(t * 4 + i * 2) * 0.002;
      });
    }
  };
  return set;
});
