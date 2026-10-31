/* ==========================================================================
   Sets: Room 1 (the cursed chamber) and a generic corridor template that
   any future location can use until it gets a custom set.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Room 1: The Cursed Chamber. Room spans x -6..6, z 0 (door) .. -12, ceiling 4.6.
   -------------------------------------------------------------------------- */
HH.World.define('cursed_chamber', function () {
  const P = HH.Props, Tx = HH.Tex, at = P.at, HALF = Math.PI / 2, TAU = Math.PI * 2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020101);
  scene.fog = new THREE.FogExp2(0x0a0405, 0.05);
  const rig = new P.LightRig();
  const updaters = [];

  const paper = (w, h) => P.mat({ map: Tx.tiled(Tx.wallpaper('#26100f', '#3e1b1a', 8), w / 3, h / 3), roughness: 0.92 });
  const dark = P.mat({ map: Tx.tiled(Tx.wood(12, '#1e1008', 6), 2, 1), roughness: 0.7 });
  const trim = P.mat({ color: 0x140a06, roughness: 0.6 });
  const stoneM = P.mat({ map: Tx.tiled(Tx.stone('#3a3631', 19, 48), 1, 1), roughness: 0.95 });

  const floorTex = Tx.tiled(Tx.wood(15, '#26160c', 8), 2, 2.5); floorTex.rotation = HALF;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), P.mat({ map: floorTex, roughness: 0.6 }));
  floor.rotation.x = -HALF; floor.position.set(0, 0, -6); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), P.mat({ color: 0x0c0705 }));
  ceil.rotation.x = HALF; ceil.position.set(0, 4.6, -6); scene.add(ceil);
  for (const z of [-2.5, -6, -9.5]) scene.add(at(P.box(12, 0.3, 0.35, trim), 0, 4.45, z));

  const wall = (w, h, x, y, z, ry) => scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(w, h), paper(w, h)), x, y, z, 0, ry));
  // Left wall is built around the side door (z -5.6 .. -7.2, 3 m tall).
  wall(5.6, 4.6, -6, 2.3, -2.8, HALF);
  wall(4.8, 4.6, -6, 2.3, -9.6, HALF);
  wall(1.6, 1.6, -6, 3.8, -6.4, HALF);
  wall(12, 4.6, 6, 2.3, -6, -HALF);
  wall(12, 4.6, 0, 2.3, -12, 0);
  wall(5.15, 4.6, -3.425, 2.3, 0, Math.PI);
  wall(5.15, 4.6, 3.425, 2.3, 0, Math.PI);
  wall(1.7, 1.5, 0, 3.85, 0, Math.PI);
  const wains = (len, x, z, ry) => scene.add(at(P.box(len, 1.0, 0.06, dark), x, 0.5, z, 0, ry), at(P.box(len, 0.07, 0.11, trim), x, 1.03, z, 0, ry));
  wains(5.6, -5.97, -2.8, HALF); wains(4.8, -5.97, -9.6, HALF); wains(12, 5.97, -6, HALF); wains(12, 0, -11.97, 0);

  // Way out A: the side door between the sheeted furniture. Swings into the dark.
  const sideHolder = new THREE.Group(); sideHolder.position.set(-6.0, 0, -5.6); sideHolder.rotation.y = HALF; scene.add(sideHolder);
  const sideDoor = P.door({ w: 1.6, h: 3.0, tone: '#24140c', hinge: 'left', max: 1.4 });
  sideHolder.add(sideDoor.pivot);
  sideHolder.add(at(P.doorFrame(1.6, 3.0, trim, 0.3), 0.8, 0, 0));
  const sideVoid = P.doorway(1.6, 3.0, 2.2, 'dark'); sideVoid.position.set(0.8, 1.5, -1.1); sideHolder.add(sideVoid);

  // Way out C: a trapdoor in the middle of the ritual circle, over a black drop.
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  hole.rotation.x = -HALF; hole.position.set(0, 0.016, -6.5); scene.add(hole);
  const hatch = new THREE.Group(); hatch.position.set(0, 0.02, -7.1); scene.add(hatch);
  hatch.add(at(P.box(1.24, 0.06, 1.24, P.mat({ map: Tx.tiled(Tx.wood(31, '#2a1a0e', 5), 1, 1), roughness: 0.8 })), 0, 0.03, 0.62));
  for (const z of [0.25, 0.95]) hatch.add(at(P.box(1.26, 0.07, 0.08, P.iron()), 0, 0.04, z));
  hatch.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 6, 16), P.iron()), 0, 0.08, 1.0, HALF));
  const trapdoor = { set(k) { hatch.rotation.x = -k * 1.9; } };

  // Entry door (behind the camera on arrival). Swings into the room.
  scene.add(at(P.doorFrame(1.7, 3.1, trim, 0.3), 0, 0, -0.05, 0, Math.PI));
  const back = P.doorway(1.7, 3.1, 1.2, 'warm'); back.rotation.y = Math.PI; back.position.set(0, 1.55, 0.6); scene.add(back);
  const holder = new THREE.Group(); holder.position.set(0.85, 0, -0.06); holder.rotation.y = Math.PI; scene.add(holder);
  const entryDoor = P.door({ w: 1.7, h: 3.1, tone: '#2e1a10', hinge: 'left', max: 1.4 });
  holder.add(entryDoor.pivot);

  /* ---------- ritual circle and candles ---------- */
  const circle = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshStandardMaterial({ map: Tx.ritual(), transparent: true, roughness: 0.8, depthWrite: false }));
  circle.rotation.x = -HALF; circle.position.set(0, 0.012, -6.5); scene.add(circle);
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * TAU, h = 0.12 + Math.random() * 0.3;
    scene.add(at(P.candle(rig, { h, r: 0.035 + Math.random() * 0.015, color: i % 4 ? 0xdcd0b4 : 0x2a0a0a }), Math.cos(a) * 2.6, 0, -6.5 + Math.sin(a) * 2.6));
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.08 + Math.random() * 0.06, 12), P.mat({ color: 0xcfc3a5, roughness: 0.4 }));
    puddle.rotation.x = -HALF; puddle.position.set(Math.cos(a) * 2.6, 0.014, -6.5 + Math.sin(a) * 2.6); scene.add(puddle);
  }
  const circleLight = new THREE.PointLight(0xff7a3a, 1.1, 8, 1.8); circleLight.position.set(0, 0.8, -6.5); scene.add(circleLight);
  rig.light(circleLight, { amt: 0.2 });

  /* ---------- fireplace ---------- */
  scene.add(at(P.box(0.55, 2.1, 0.6, stoneM), -1.3, 1.05, -11.7));
  scene.add(at(P.box(0.55, 2.1, 0.6, stoneM), 1.3, 1.05, -11.7));
  scene.add(at(P.box(3.4, 0.5, 0.6, stoneM), 0, 1.85, -11.7));
  scene.add(at(P.box(3.7, 0.12, 0.8, dark), 0, 2.16, -11.62));
  const firebox = new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.6, 0.9), P.mat({ color: 0x0a0605, side: THREE.BackSide, roughness: 1 }));
  firebox.position.set(0, 0.8, -12.0); scene.add(firebox);
  const embers = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: Tx.glow(), color: 0xff4a10, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  embers.rotation.x = -HALF; embers.position.set(0, 0.06, -11.85); scene.add(embers);
  const fireFlames = [];
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tx.flame(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, color: 0xffb070 }));
    f.position.set(-0.6 + i * 0.24, 0.32, -11.9); f.scale.set(0.3, 0.55, 1); scene.add(f);
    fireFlames.push({ f, seed: Math.random() * 10 });
    rig.flame(f, null);
  }
  for (let i = 0; i < 3; i++) scene.add(at(P.cyl(0.07, 0.07, 1.1, P.mat({ color: 0x0b0806 }), 6), 0, 0.1 + i * 0.07, -11.9 + i * 0.05, 0, 0.3 * i, HALF));
  const fireLight = new THREE.PointLight(0xff5a1a, 1.5, 11, 1.6); fireLight.position.set(0, 0.8, -11.0); scene.add(fireLight);
  rig.light(fireLight, { amt: 0.35, speed: 1.6 });
  [-1.5, -1.1, -0.7, 0.9, 1.4].forEach((x, i) => scene.add(at(P.candle(rig, { h: 0.15 + i * 0.05, r: 0.03 }), x, 2.22, -11.55)));
  const skull = new THREE.Group(); skull.position.set(0.2, 2.34, -11.55); scene.add(skull);
  const bone = P.mat({ color: 0xbdb39a, roughness: 0.6 });
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), bone); cranium.scale.set(1, 0.95, 1.15); skull.add(cranium);
  skull.add(at(P.box(0.14, 0.07, 0.12, bone), 0, -0.1, 0.06));
  for (const s of [-1, 1]) skull.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: 0 })), s * 0.045, 0.0, 0.12));
  const writing = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.2), new THREE.MeshStandardMaterial({ map: Tx.writing('GET OUT'), transparent: true, roughness: 0.6, depthWrite: false }));
  writing.position.set(0, 3.35, -11.96); scene.add(writing);

  /* ---------- covered furniture and the rocking chair ---------- */
  const sheetM = P.mat({ map: Tx.sheet(), roughness: 1 });
  const drape = (w, h, d, x, z, ry) => {
    const g = new THREE.Group(); at(g, x, 0, z, 0, ry); scene.add(g);
    g.add(at(P.box(w, h, d, sheetM), 0, h / 2, 0));
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), sheetM); top.scale.set(w * 1.05, 0.35, d * 1.05); top.position.y = h; g.add(top);
  };
  drape(1.2, 0.9, 1.0, -4.9, -3.4, 0.3);
  drape(0.9, 2.3, 0.6, -5.4, -10.4, 0.1);
  drape(1.6, 0.8, 0.8, 4.6, -10.9, -0.2);

  const rocker = new THREE.Group(); rocker.position.set(-3.6, 0, -8.3); rocker.rotation.y = 0.85; scene.add(rocker);
  const rw = P.mat({ map: Tx.tiled(Tx.wood(21, '#2a170c', 4), 0.5, 0.5), roughness: 0.7 });
  const body = new THREE.Group(); rocker.add(body);
  for (const s of [-1, 1]) {
    // Curved runner: a slice of a big torus, centred on its lowest point, turned to run front-to-back.
    const runner = new THREE.Group(); runner.position.x = s * 0.28; runner.rotation.y = HALF; body.add(runner);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.03, 6, 24, 0.75), rw);
    arc.rotation.z = -HALF - 0.375; arc.position.y = 1.43; runner.add(arc);
    body.add(at(P.box(0.05, 0.45, 0.05, rw), s * 0.28, 0.27, 0.22));
    body.add(at(P.box(0.05, 1.2, 0.05, rw), s * 0.28, 0.65, -0.25, -0.15));
    body.add(at(P.box(0.05, 0.05, 0.55, rw), s * 0.28, 0.72, 0.0));
  }
  body.add(at(P.box(0.6, 0.05, 0.55, rw), 0, 0.47, 0));
  for (let i = 0; i < 5; i++) body.add(at(P.box(0.05, 0.75, 0.03, rw), -0.2 + i * 0.1, 0.9, -0.31, -0.15));
  body.add(at(P.box(0.62, 0.08, 0.05, rw), 0, 1.27, -0.37, -0.15));
  let lastRock = 0;

  /* ---------- the cracked mirror ---------- */
  const mirror = new THREE.Group(); mirror.position.set(5.94, 2.1, -6); mirror.rotation.y = -HALF; scene.add(mirror);
  const gold = P.mat({ color: 0x6a5222, metalness: 0.7, roughness: 0.4 });
  mirror.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.4), P.mat({ color: 0x3a434c, metalness: 0.9, roughness: 0.12, emissive: 0x0b0d10 })), 0, 0, 0.02));
  const crack = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.4), new THREE.MeshBasicMaterial({ map: Tx.crack(), transparent: true, opacity: 0.6, depthWrite: false }));
  crack.position.z = 0.03; mirror.add(crack);
  const ghost = P.shadowFigure(1.9); ghost.position.set(0.15, -0.15, 0.025); mirror.add(ghost);
  for (const [w, h, x, y] of [[1.6, 0.15, 0, 1.27], [1.6, 0.15, 0, -1.27], [0.15, 2.7, -0.72, 0], [0.15, 2.7, 0.72, 0]]) mirror.add(at(P.box(w, h, 0.1, gold), x, y, 0.04));
  scene.add(at(P.box(0.6, 0.85, 0.6, dark), 5.5, 0.425, -8.4));
  scene.add(at(P.candelabra(rig, 3), 5.5, 0.85, -8.4));
  const mirrorLight = new THREE.PointLight(0xffa050, 0.8, 7, 1.8); mirrorLight.position.set(5.0, 1.8, -8.0); scene.add(mirrorLight);
  rig.light(mirrorLight, { amt: 0.2 });

  /* ---------- chains ---------- */
  const linkGeo = new THREE.TorusGeometry(0.05, 0.012, 6, 10), chainM = P.iron();
  const chains = [[2.2, -3.8, 12], [-1.6, -9.2, 15], [3.4, -9.6, 10]].map(([x, z, n]) => {
    const g = new THREE.Group(); g.position.set(x, 4.6, z); scene.add(g);
    for (let i = 0; i < n; i++) { const l = new THREE.Mesh(linkGeo, chainM); l.position.y = -i * 0.085; l.rotation.y = i % 2 ? HALF : 0; g.add(l); }
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 6, 12, Math.PI * 1.4), chainM); hook.position.y = -n * 0.085 - 0.08; g.add(hook);
    return g;
  });

  scene.add(new THREE.HemisphereLight(0x2a1c22, 0x0a0505, 0.22));
  const web = (x, y, z, ry, flip) => { const w = P.cobweb(1.3); at(w, x, y, z, 0, ry); if (flip) w.scale.x = -1; scene.add(w); };
  web(-6, 4.6, -11.96, 0); web(6, 4.6, -11.96, 0, true); web(-5.96, 4.6, -0.02, HALF); web(5.96, 4.6, -0.02, -HALF, true);
  const fog = P.fogLayer({ count: 16, w: 11, d: 11, x: 0, z: -6, y: 0.1, size: 3.5, color: 0x9a7070, opacity: 0.11, speed: 0.05, spread: 0.4 });
  scene.add(fog.group); updaters.push(fog);
  const dust = P.dust({ count: 200, w: 10, h: 4, d: 10, x: 0, y: 2.2, z: -6, color: 0xe0b090 });
  scene.add(dust.points); updaters.push(dust);
  let ghostT = -1;

  return {
    scene, lights: rig, ambience: 'chamber', flashScale: 0,
    home: { pos: new THREE.Vector3(0, 1.7, -2.2), look: new THREE.Vector3(0, 1.2, -9) },
    anchors: {
      center: new THREE.Vector3(0, 0.6, -6.5),
      fireplace: new THREE.Vector3(0, 1.2, -11.6),
      mirror: new THREE.Vector3(5.9, 2.1, -6),
      rockingChair: new THREE.Vector3(-3.6, 1, -8.3),
      writing: new THREE.Vector3(0, 3.35, -11.9),
      sideDoor: new THREE.Vector3(-5.95, 1.8, -6.4),
      trapdoor: new THREE.Vector3(0, 0.35, -6.5)
    },
    entryDoor,
    doorAt: { sideDoor, trapdoor },
    ceiling: 4.6,
    showGhost() { ghostT = 0; },
    onEnter() { rig.darkness = 0; rig.chaos = 0; entryDoor.set(0); sideDoor.set(0); trapdoor.set(0); },
    update(t, dt) {
      updaters.forEach(u => u.update(t));
      const rock = Math.sin(t * 1.5);
      body.rotation.x = rock * 0.1;
      if (Math.sign(rock) !== Math.sign(lastRock) && rock > 0 && HH.World.current && HH.World.current.scene === scene) HH.Audio.sfx.creak(0.45, 1.6, 0.05);
      lastRock = rock;
      embers.material.opacity = 0.75 + Math.sin(t * 3) * 0.15 + Math.random() * 0.1;
      fireFlames.forEach(o => { o.f.scale.y = 0.5 + Math.sin(t * 9 + o.seed) * 0.12 + Math.random() * 0.08; });
      chains.forEach((c, i) => { c.rotation.z = Math.sin(t * 0.6 + i) * 0.03; c.rotation.x = Math.sin(t * 0.45 + i * 2) * 0.03; });
      if (ghostT >= 0) {
        ghostT += dt;
        ghost.material.opacity = Math.max(0, Math.sin(Math.min(1, ghostT / 2.2) * Math.PI)) * 0.85;
        if (ghostT > 2.2) { ghostT = -1; ghost.material.opacity = 0; }
      }
    }
  };
});

/* --------------------------------------------------------------------------
   Generic corridor: one door per choice at the far end (anchors door0, door1...).
   Options: { doors, length, tint, accent, glow }
   glow: true -> pale moonlight seeps round the first door (a way out).
   -------------------------------------------------------------------------- */
HH.World.define('corridor', function (opts) {
  const P = HH.Props, Tx = HH.Tex, at = P.at, HALF = Math.PI / 2;
  const n = Math.max(1, opts.doors || 2), L = opts.length || 14;
  const W = Math.max(4.4, n * 2.3 + 0.8), H = 4.2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020203);
  scene.fog = new THREE.FogExp2(0x060509, 0.06);
  const rig = new P.LightRig();
  const updaters = [];
  const paper = (w, h) => P.mat({ map: Tx.tiled(Tx.wallpaper(opts.tint || '#1d1a22', opts.accent || '#2e2836', 23), w / 3, h / 3), roughness: 0.9 });
  const trim = P.mat({ color: 0x140c08 });

  const floorTex = Tx.tiled(Tx.wood(27, '#26180e', 8), W / 4, L / 4); floorTex.rotation = HALF;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), P.mat({ map: floorTex, roughness: 0.6 }));
  floor.rotation.x = -HALF; floor.position.set(0, 0, -L / 2); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, L), P.mat({ color: 0x0a0706 }));
  ceil.rotation.x = HALF; ceil.position.set(0, H, -L / 2); scene.add(ceil);
  scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(L, H), paper(L, H)), -W / 2, H / 2, -L / 2, 0, HALF));
  scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(L, H), paper(L, H)), W / 2, H / 2, -L / 2, 0, -HALF));
  scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(W, H), paper(W, H)), 0, H / 2, -L, 0, 0));
  scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(W, H), paper(W, H)), 0, H / 2, 0, 0, Math.PI));
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.8, L - 1), P.mat({ map: Tx.rug(), roughness: 1 }));
  runner.rotation.x = -HALF; runner.position.set(0, 0.012, -L / 2); scene.add(runner);

  const anchors = {}, doorAt = {}, doors = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 2.3, w = 1.5, h = 2.9;
    scene.add(at(P.doorFrame(w, h, trim, 0.25), x, 0, -L + 0.05));
    const v = P.doorway(w, h, 2, 'dark'); v.position.set(x, h / 2, -L - 1); scene.add(v);
    const d = P.door({ w, h, tone: ['#2b1810', '#20160f', '#2f1c12'][i % 3], hinge: 'left', max: 1.4 });
    d.pivot.position.set(x - w / 2, 0, -L + 0.02); scene.add(d.pivot);
    anchors['door' + i] = new THREE.Vector3(x, 2.0, -L + 0.1);
    doorAt['door' + i] = d; doors.push(d);
  }

  let lights = 0;
  for (let z = -2.5; z > -L + 1; z -= 4) {
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * (W / 2 - 0.08), 2.3, z); scene.add(g);
      g.add(at(P.box(0.06, 0.3, 0.16, P.brass()), 0, 0, 0));
      g.add(at(P.candle(rig, { h: 0.2, r: 0.03, flame: 1.2 }), -s * 0.15, -0.05, 0));
    }
    if (lights < 3) {
      const l = new THREE.PointLight(0xff9a48, 0.9, 8, 1.8); l.position.set(0, 2.6, z); scene.add(l); rig.light(l, { amt: 0.2 }); lights++;
    }
  }
  if (opts.glow) {
    // Moonlight from outside seeping round the door: thin bright lines at its
    // edges, a glow under it, and a cold light on the door and floor. Not
    // fogged, so the way out reads from the far end of the corridor.
    const x = -(n - 1) / 2 * 2.3, w = 1.5, h = 2.9, moon = 0xa8c4ff;
    const leak = new THREE.MeshBasicMaterial({ color: moon, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    for (const s of [-1, 1]) scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.022, h), leak), x + s * (w / 2 - 0.01), h / 2, -L + 0.075));
    scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(w, 0.022), leak), x, h - 0.01, -L + 0.075));
    const under = P.glowSprite(moon, 1, 0.6); under.scale.set(2.0, 0.3, 1); under.position.set(x, 0.04, -L + 0.3); under.material.fog = false; scene.add(under);
    const l = new THREE.PointLight(moon, 0.8, 6, 1.6); l.position.set(x, 1.2, -L + 0.8); scene.add(l); rig.light(l, { amt: 0.15, speed: 0.4 });
  }
  if (L > 8) { const p = P.painting({ seed: 9, w: 0.9, h: 1.2 }); at(p.group, -W / 2 + 0.03, 2.4, -L / 2, 0, HALF); scene.add(p.group); }
  scene.add(new THREE.HemisphereLight(0x2a2a38, 0x080606, 0.2));
  const fog = P.fogLayer({ count: 12, w: W, d: L, x: 0, z: -L / 2, y: 0.1, size: 3.5, color: 0x8a8a9a, opacity: 0.1, speed: 0.05, spread: 0.3 });
  scene.add(fog.group); updaters.push(fog);

  return {
    scene, lights: rig, ambience: 'interior', flashScale: 0,
    home: { pos: new THREE.Vector3(0, 1.7, -1.4), look: new THREE.Vector3(0, 1.8, -L) },
    anchors, doorAt, doors, ceiling: H,
    onEnter() { rig.darkness = 0; rig.chaos = 0; doors.forEach(d => d.set(0)); },
    update(t) { updaters.forEach(u => u.update(t)); }
  };
});
