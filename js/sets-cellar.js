/* ==========================================================================
   Set: the Wine Cellar. A vaulted stone cellar x -6..6, z 0..-12, ceiling 4.2.
   A barrel table at z -6.6 with three pewter goblets and a golden key; the
   ghost behind it; wine racks on the walls; an iron gate in the right wall
   at z -3.5 (the exit).
   ========================================================================== */

HH.World.define('wine_cellar', function () {
  const P = HH.Props, Tx = HH.Tex, at = P.at, HALF = Math.PI / 2, TAU = Math.PI * 2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030303);
  scene.fog = new THREE.FogExp2(0x07080a, 0.06);
  const rig = new P.LightRig();
  const updaters = [];
  const H = 4.2, TOP = 1.01, CUP_H = 0.42;

  /* ---------- shell ---------- */
  const stoneWall = (w, h) => P.mat({ map: Tx.tiled(Tx.stone('#39342d', 111, 48), w / 3.5, h / 3.5), roughness: 0.95 });
  const wall = (w, h, x, y, z, ry) => scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(w, h), stoneWall(w, h)), x, y, z, 0, ry));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), P.mat({ map: Tx.tiled(Tx.stone('#2c2925', 112, 80), 3, 3), roughness: 0.95 }));
  floor.rotation.x = -HALF; floor.position.set(0, 0, -6); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), P.mat({ color: 0x0a0807 }));
  ceil.rotation.x = HALF; ceil.position.set(0, H, -6); scene.add(ceil);
  const ribM = P.mat({ map: Tx.tiled(Tx.stone('#46413a', 113, 48), 2, 0.4), roughness: 0.95 });
  for (const z of [-2, -5, -8, -11]) { const rib = new THREE.Mesh(new THREE.TorusGeometry(6, 0.22, 6, 24, Math.PI), ribM); rib.scale.set(1, 0.16, 1); rib.position.set(0, H - 0.05, z); scene.add(rib); }
  wall(12, H, -6, H / 2, -6, HALF);
  wall(2.5, H, 6, H / 2, -1.25, -HALF);
  wall(7.5, H, 6, H / 2, -8.25, -HALF);
  wall(2, H - 2.8, 6, 2.8 + (H - 2.8) / 2, -3.5, -HALF);
  wall(12, H, 0, H / 2, -12, 0);
  wall(12, H, 0, H / 2, 0, Math.PI);

  /* ---------- wine racks: two instanced meshes of bottles ---------- */
  const rackWood = P.mat({ map: Tx.tiled(Tx.wood(114, '#2a1a0e', 4), 2, 1), roughness: 0.8 });
  const spots = [];
  // Left wall rack (bottles point along x) and back wall rack (bottles point along z).
  scene.add(at(P.box(0.5, 3.0, 9.4, rackWood), -5.78, 1.5, -6.6));
  for (let r = 0; r < 7; r++) for (let z = -2.1; z > -11.2; z -= 0.2) spots.push({ x: -5.6, y: 0.35 + r * 0.38, z, axis: 'x' });
  for (const x0 of [-4.6, 1.2]) {
    scene.add(at(P.box(3.4, 3.0, 0.5, rackWood), x0 + 1.7, 1.5, -11.78));
    for (let r = 0; r < 7; r++) for (let x = x0 + 0.1; x < x0 + 3.3; x += 0.2) spots.push({ x, y: 0.35 + r * 0.38, z: -11.6, axis: 'z' });
  }
  const glass = P.mat({ color: 0x14341c, roughness: 0.12, metalness: 0.35 });
  const bodies = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), glass, spots.length);
  const necks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.016, 0.022, 0.12, 6), glass, spots.length);
  const d = new THREE.Object3D();
  spots.forEach((sp, i) => {
    const rx = sp.axis === 'z' ? HALF : 0, rz = sp.axis === 'x' ? HALF : 0, full = Math.random() > 0.12;
    d.rotation.set(rx, 0, rz); d.position.set(sp.x, sp.y, sp.z); d.scale.setScalar(full ? 1 : 0.0001); d.updateMatrix(); bodies.setMatrixAt(i, d.matrix);
    d.position.set(sp.x + (sp.axis === 'x' ? 0.21 : 0), sp.y, sp.z + (sp.axis === 'z' ? 0.21 : 0)); d.updateMatrix(); necks.setMatrixAt(i, d.matrix);
  });
  scene.add(bodies, necks);

  // Barrels: a stack lying on its side and two upright.
  const barrelM = P.mat({ map: Tx.tiled(Tx.wood(115, '#3a2414', 8), 1, 1), roughness: 0.75 });
  const iron = P.iron();
  const barrel = (x, y, z, lying) => {
    const g = new THREE.Group(); at(g, x, y, z, 0, 0, lying ? HALF : 0); scene.add(g);
    g.add(P.cyl(0.46, 0.46, 1.0, barrelM, 18));
    for (const yy of [-0.35, 0.35]) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.02, 6, 24), iron), 0, yy, 0, HALF));
    return g;
  };
  [[3.4, 0.46, -10.6], [4.4, 0.46, -10.6], [3.9, 1.26, -10.6]].forEach(([x, y, z]) => barrel(x, y, z, true));
  barrel(4.9, 0.5, -7.2); barrel(-4.4, 0.5, -3.2);

  /* ---------- the barrel table, goblets and key ---------- */
  const table = new THREE.Group(); table.position.set(0, 0, -6.6); scene.add(table);
  table.add(at(P.cyl(0.55, 0.6, 0.95, barrelM, 20), 0, 0.475, 0));
  for (const y of [0.18, 0.78]) table.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.022, 6, 24), iron), 0, y, 0, HALF));
  table.add(at(P.cyl(1.05, 1.05, 0.06, P.mat({ map: Tx.tiled(Tx.wood(116, '#4a2e18', 6), 1, 1), roughness: 0.6 }), 32), 0, TOP - 0.03, 0));

  const slots = [-0.55, 0, 0.55].map(x => new THREE.Vector3(x, TOP, -6.45));
  const pewter = P.mat({ color: 0x9a9890, metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide });
  const prof = [[0, 0], [0.1, 0], [0.1, 0.02], [0.03, 0.05], [0.025, 0.17], [0.07, 0.22], [0.13, 0.32], [0.155, 0.42]].map(([r, y]) => new THREE.Vector2(r, y));
  const cupGeo = new THREE.LatheGeometry(prof, 24);
  const cups = slots.map(p => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(cupGeo, pewter); m.rotation.x = Math.PI; m.position.y = CUP_H; g.add(m);   // upside down, mouth on the table
    g.position.copy(p); scene.add(g);
    return g;
  });
  let cupAt = [0, 1, 2];        // slot -> cup index
  let keyCup = -1;              // which cup covers the key (-1: none yet)
  let keyLift = 0;

  const gold = P.mat({ color: 0xe8b84a, metalness: 0.85, roughness: 0.25, emissive: 0x3a2400 });
  const key = new THREE.Group(); scene.add(key);
  key.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 18), gold), -0.09, 0.012, 0, HALF));
  key.add(at(P.box(0.15, 0.016, 0.016, gold), 0.02, 0.012, 0));
  key.add(at(P.box(0.02, 0.016, 0.04, gold), 0.08, 0.012, 0.02));
  key.add(at(P.box(0.02, 0.016, 0.03, gold), 0.045, 0.012, 0.015));
  const keyGlow = P.glowSprite(0xffd060, 0.5, 0); keyGlow.position.y = 0.06; key.add(keyGlow);
  key.scale.setScalar(1.7);
  key.visible = false;

  /* ---------- the ghost, candles, light ---------- */
  const spirit = P.ghost(new THREE.Vector3(0, 1.95, -8.5));
  scene.add(spirit.group);
  [[-0.85, -6.95], [0.85, -6.95]].forEach(([x, z], i) => scene.add(at(P.candle(rig, { h: 0.18 + i * 0.06, r: 0.035 }), x, TOP, z)));
  [[4.9, 1.0, -7.2], [-4.4, 1.0, -3.2]].forEach(([x, y, z]) => scene.add(at(P.candle(rig, { h: 0.25, r: 0.045, flame: 1.3 }), x, y, z)));
  const lantern = new THREE.Group(); lantern.position.set(0, 3.1, -6.3); scene.add(lantern);
  lantern.add(at(P.cyl(0.01, 0.01, 1.1, iron, 4), 0, 0.55, 0));
  lantern.add(at(P.box(0.22, 0.3, 0.22, P.mat({ color: 0x111111, metalness: 0.5 })), 0, 0, 0));
  lantern.add(at(P.candle(rig, { h: 0.12, r: 0.03, flame: 1.4 }), 0, -0.12, 0));
  lantern.add(P.glowSprite(0xffa050, 1.4, 0.35));
  const l1 = new THREE.PointLight(0xffa050, 1.25, 8, 1.7); l1.position.set(0, 2.7, -6.2); scene.add(l1); rig.light(l1, { amt: 0.2 });
  const l2 = new THREE.PointLight(0xff9040, 0.7, 7, 1.8); l2.position.set(-4.0, 1.6, -3.4); scene.add(l2); rig.light(l2, { amt: 0.25 });
  scene.add(new THREE.HemisphereLight(0x2a2a30, 0x050505, 0.25));

  /* ---------- iron gate (exit) ---------- */
  const gate = new THREE.Group(); gate.position.set(5.98, 0, -2.5); scene.add(gate);
  for (let i = 0; i < 8; i++) gate.add(at(P.cyl(0.025, 0.025, 2.75, iron, 6), 0, 1.38, -0.12 - i * 0.25));
  for (const y of [0.3, 1.4, 2.6]) gate.add(at(P.box(0.05, 0.06, 2.0, iron), 0, y, -1.0));
  const gateVoid = new THREE.Mesh(new THREE.BoxGeometry(3, 2.8, 2.02), new THREE.MeshBasicMaterial({ color: 0x020203, side: THREE.BackSide }));
  gateVoid.position.set(7.5, 1.4, -3.5); scene.add(gateVoid);
  const exit = { k: 0, silent: true, set(k) { this.k = k; gate.rotation.y = -k * 1.4; } };

  const fog = P.fogLayer({ count: 14, w: 11, d: 11, x: 0, z: -6, y: 0.1, size: 3.5, color: 0x8a90a0, opacity: 0.1, speed: 0.05, spread: 0.3 });
  scene.add(fog.group); updaters.push(fog);
  const web = (x, y, z, ry, flip) => { const w = P.cobweb(1.4); at(w, x, y, z, 0, ry); if (flip) w.scale.x = -1; scene.add(w); };
  web(-6, H, -11.96, 0); web(6, H, -11.96, 0, true); web(-5.96, H, -0.04, HALF);

  const tw = (dur, fn, ease = 'inOut') => HH.Tween.add({ dur, update: fn, ease });
  const lifted = [0, 0, 0];     // per cup, 0..1
  const liftTo = (cupIdx, v, dur = 0.45) => { const from = lifted[cupIdx]; return tw(dur, k => { lifted[cupIdx] = from + (v - from) * k; }); };

  const set = {
    scene, lights: rig, ambience: 'interior', flashScale: 0, ceiling: H,
    home: { pos: new THREE.Vector3(0, 1.7, -1.6), look: new THREE.Vector3(0, 1.3, -8) },
    view: { pos: new THREE.Vector3(0, 2.2, -4.7), look: new THREE.Vector3(0, 0.95, -6.7) },
    anchors: {
      cup0: new THREE.Vector3(-0.55, TOP + 0.55, -6.45), cup1: new THREE.Vector3(0, TOP + 0.55, -6.45), cup2: new THREE.Vector3(0.55, TOP + 0.55, -6.45),
      exit: new THREE.Vector3(5.9, 1.7, -3.5)
    },
    doorAt: { exit },
    ghost: spirit,
    tremor: 0,                  // while > 0 the camera never shakes less than this

    // Lift every goblet, show the key at `slot`, cover it again.
    async showKey(slot) {
      keyCup = cupAt[slot];
      await Promise.all(cups.map((c, i) => liftTo(i, 1)));
      key.visible = true; keyGlow.material.opacity = 0.8;
      HH.Audio.sfx.bell(784, 0.18);
      await HH.Cine.wait(1.4);
      await Promise.all(cups.map((c, i) => liftTo(i, 0)));
      key.visible = false; keyGlow.material.opacity = 0;
      HH.Audio.sfx.clank(0.25);
    },

    // The goblets in slots a and b trade places, one passing in front, one behind.
    async swap(a, b, dur) {
      const ca = cupAt[a], cb = cupAt[b], pa = slots[a], pb = slots[b];
      HH.Audio.sfx.whoosh(0.12);
      await tw(dur, k => {
        const arc = Math.sin(k * Math.PI);
        cups[ca].position.set(pa.x + (pb.x - pa.x) * k, TOP + arc * 0.03, pa.z + arc * 0.3);
        cups[cb].position.set(pb.x + (pa.x - pb.x) * k, TOP + arc * 0.03, pb.z - arc * 0.3);
      });
      cupAt[a] = cb; cupAt[b] = ca;
      HH.Audio.sfx.clank(0.08);
    },

    // Lift the goblet in `slot`; the key shows if it is under it.
    async lift(slot) {
      const c = cupAt[slot];
      if (c === keyCup) { key.visible = true; keyGlow.material.opacity = 0.9; }
      await liftTo(c, 1, 0.5);
      return c === keyCup;
    },

    // For testing: the slot whose goblet actually sits over the key.
    keySlotFromMeshes() {
      const x = cups[keyCup].position.x;
      return slots.reduce((best, s, i) => (Math.abs(s.x - x) < Math.abs(slots[best].x - x) ? i : best), 0);
    },

    async openGate() {
      HH.Cine.look([5.9, 1.6, -3.5], 1.3);
      HH.Audio.sfx.creak(1.8, 0.7, 0.4);
      await tw(1.8, k => exit.set(k));
    },

    reset() {
      rig.darkness = 0; rig.chaos = 0; set.tremor = 0;
      cupAt = [0, 1, 2]; keyCup = -1;
      cups.forEach((c, i) => { c.position.copy(slots[i]); lifted[i] = 0; });
      key.visible = false; keyGlow.material.opacity = 0;
      spirit.reset();
      exit.set(0);
    },
    solved() { set.reset(); exit.set(1); },
    onEnter() { rig.darkness = 0; rig.chaos = 0; },

    update(t, dt) {
      updaters.forEach(u => u.update(t));
      if (set.tremor > 0) HH.World.rig.trauma = Math.max(HH.World.rig.trauma, set.tremor);
      cups.forEach((c, i) => { c.children[0].position.y = CUP_H + lifted[i] * 0.22; });
      if (keyCup >= 0) { key.position.set(cups[keyCup].position.x, TOP, cups[keyCup].position.z); key.rotation.y = 0.4; }
      keyLift = keyGlow.material.opacity;
      if (keyLift > 0) keyGlow.material.opacity = 0.7 + Math.sin(t * 6) * 0.2;
      lantern.rotation.z = Math.sin(t * 0.6) * 0.03;
      spirit.update(t, dt);
    }
  };
  return set;
});
