/* ==========================================================================
   Set: the Sacrifice Chamber. Stone vault x -7..7, z 0..-16, ceiling 6.5.
   A stone altar on a dais at z -11 with three chalices; a hooded figure
   behind it; a hidden stone slab in the right wall at z -8.5 (the exit).
   ========================================================================== */

HH.World.define('sacrifice_chamber', function () {
  const P = HH.Props, Tx = HH.Tex, at = P.at, HALF = Math.PI / 2, TAU = Math.PI * 2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050102);
  scene.fog = new THREE.FogExp2(0x0c0203, 0.05);
  const rig = new P.LightRig();
  const updaters = [];
  const H = 6.5;

  const stoneWall = (w, h) => P.mat({ map: Tx.tiled(Tx.stone('#3a2e2a', 61, 56), w / 4, h / 4), roughness: 0.95 });
  const stoneM = P.mat({ map: Tx.tiled(Tx.stone('#433834', 62, 96), 2, 1), roughness: 0.92 });
  const wall = (w, h, x, y, z, ry) => scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(w, h), stoneWall(w, h)), x, y, z, 0, ry));

  /* ---------- shell ---------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 16), P.mat({ map: Tx.tiled(Tx.stone('#2e2522', 63, 96), 4, 4), roughness: 0.95 }));
  floor.rotation.x = -HALF; floor.position.set(0, 0, -8); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 16), P.mat({ color: 0x0a0605 }));
  ceil.rotation.x = HALF; ceil.position.set(0, H, -8); scene.add(ceil);
  for (const z of [-3, -7, -11, -15]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(7, 0.25, 6, 24, Math.PI), stoneM);
    rib.scale.set(1, 0.18, 1); rib.position.set(0, H - 0.05, z); scene.add(rib);
  }
  wall(16, H, -7, H / 2, -8, HALF);
  wall(7.5, H, 7, H / 2, -3.75, -HALF);
  wall(6.5, H, 7, H / 2, -12.75, -HALF);
  wall(2, H - 3, 7, 3 + (H - 3) / 2, -8.5, -HALF);
  wall(14, H, 0, H / 2, -16, 0);
  wall(14, H, 0, H / 2, 0, Math.PI);
  scene.add(at(P.doorFrame(1.6, 3.0, stoneM, 0.4), -0.0, 0, -0.1, 0, Math.PI));

  /* ---------- floor sigil and wall symbols ---------- */
  const sigil = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), new THREE.MeshStandardMaterial({ map: Tx.ritual(), transparent: true, depthWrite: false, roughness: 0.8, emissive: 0x400000, emissiveMap: Tx.ritual(), emissiveIntensity: 0.6 }));
  sigil.rotation.x = -HALF; sigil.position.set(0, 0.012, -7.2); scene.add(sigil);
  const symbols = [];
  [[-6.96, 3.2, -5, HALF], [-6.96, 3.4, -12, HALF], [6.96, 3.4, -13.5, -HALF], [-3.8, 3.8, -15.96, 0], [3.8, 3.8, -15.96, 0]].forEach(([x, y, z, ry]) => {
    const m = new THREE.MeshBasicMaterial({ map: Tx.ritual(), transparent: true, opacity: 0.5, depthWrite: false, color: 0xff3a2a, blending: THREE.AdditiveBlending });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), m); at(p, x, y, z, 0, ry); scene.add(p); symbols.push(m);
  });

  /* ---------- dais and altar ---------- */
  scene.add(at(P.box(6.4, 0.24, 4.4, stoneM), 0, 0.12, -11.6));
  scene.add(at(P.box(5.2, 0.12, 0.5, stoneM), 0, 0.06, -9.2));
  scene.add(at(P.box(3.4, 1.0, 1.4, stoneM), 0, 0.74, -11));
  scene.add(at(P.box(3.9, 0.2, 1.75, stoneM), 0, 1.34, -11));
  const front = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.8), new THREE.MeshBasicMaterial({ map: Tx.writing('MORS'), transparent: true, opacity: 0.85, depthWrite: false }));
  front.position.set(0, 0.78, -10.29); scene.add(front);
  scene.add(at(P.box(3.9, 0.04, 0.9, P.mat({ color: 0x3a0505, roughness: 1 })), 0, 1.45, -11.05));

  /* ---------- three chalices ---------- */
  const profile = [[0, 0], [0.13, 0], [0.13, 0.025], [0.035, 0.06], [0.028, 0.2], [0.07, 0.25], [0.12, 0.33], [0.14, 0.44], [0.135, 0.46]].map(([r, y]) => new THREE.Vector2(r, y));
  const chaliceGeo = new THREE.LatheGeometry(profile, 24);
  const gold = P.mat({ color: 0xc09040, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide });
  const chalices = [-1.15, 0, 1.15].map(x => {
    const g = new THREE.Group(); g.position.set(x, 1.44, -11); scene.add(g);
    g.add(new THREE.Mesh(chaliceGeo, gold));
    const liquid = new THREE.Mesh(new THREE.CircleGeometry(0.128, 24), new THREE.MeshBasicMaterial({ color: 0x220000 }));
    liquid.rotation.x = -HALF; liquid.position.y = 0.42; g.add(liquid);
    const glow = P.glowSprite(0xff2010, 1.2, 0); glow.position.y = 0.55; g.add(glow);
    const light = new THREE.PointLight(0xff2a14, 0, 3.4, 1.8); light.position.y = 0.8; g.add(light);
    return { g, liquid, glow, light, level: 0, target: 0 };
  });

  /* ---------- red candles everywhere ---------- */
  const red = { color: 0x6a0a0a };
  [[-1.75, -11], [-1.6, -10.6], [1.75, -11], [1.6, -10.6], [-1.75, -11.4], [1.75, -11.4]].forEach(([x, z], i) =>
    scene.add(at(P.candle(rig, Object.assign({ h: 0.18 + (i % 3) * 0.08, r: 0.035 }, red)), x, 1.44, z)));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU, rr = 3.1 + (i % 2) * 0.35;
    scene.add(at(P.candle(rig, Object.assign({ h: 0.15 + (i % 4) * 0.09, r: 0.04 }, red)), Math.cos(a) * rr, 0, -7.2 + Math.sin(a) * rr * 0.8));
  }
  for (const x of [-5.5, 5.5]) {
    const st = new THREE.Group(); st.position.set(x, 0, -12.5); scene.add(st);
    st.add(at(P.cyl(0.05, 0.16, 1.6, P.iron(), 8), 0, 0.8, 0));
    st.add(at(P.candle(rig, Object.assign({ h: 0.35, r: 0.06, flame: 1.8 }, red)), 0, 1.6, 0));
  }

  /* ---------- the hooded figure ---------- */
  const robeM = P.mat({ color: 0x3a0c10, roughness: 0.9, side: THREE.DoubleSide, transparent: true });
  const fig = new THREE.Group(); fig.position.set(0, 0.24, -13.1); scene.add(fig);
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.3, 20, 1, true), robeM); robe.position.y = 1.15; fig.add(robe);
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), robeM); shoulders.scale.set(1.25, 0.55, 0.85); shoulders.position.y = 2.2; fig.add(shoulders);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 12, HALF + 0.65, TAU - 1.3), robeM); hood.scale.set(1, 1.3, 1.15); hood.position.y = 2.6; fig.add(hood);
  const voidFace = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true })); voidFace.position.set(0, 2.55, -0.02); fig.add(voidFace);
  const eyes = [-0.08, 0.08].map(x => { const e = P.glowSprite(0xff6a2a, 0.22, 0.4); e.position.set(x, 2.6, 0.22); fig.add(e); return e; });
  const skin = P.mat({ color: 0x9a8a7a, roughness: 0.8, transparent: true });
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), skin); handL.position.set(-0.12, 1.65, 0.62); fig.add(handL);
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), skin); handR.position.set(0.12, 1.65, 0.62); fig.add(handR);
  const figMats = [robeM, skin, voidFace.material];
  const figure = {
    hand: 0, turn: 0, fade: 0,
    setEyes(v) { eyes.forEach(e => { e.material.opacity = v * (1 - figure.fade); }); },
    raiseHand(k) { const h0 = figure.hand; HH.Tween.add({ dur: 0.9, update: e => { figure.hand = h0 + (k - h0) * e; }, ease: 'inOut' }); },
    turnAway(k) { HH.Tween.add({ dur: 2.2, update: e => { figure.turn = k * e; }, ease: 'inOut' }); },
    vanish() { HH.Tween.add({ dur: 2.4, update: e => { figure.fade = e; }, ease: 'in' }); }
  };

  /* ---------- the hidden slab in the right wall ---------- */
  const slab = at(P.box(0.45, 3.0, 2.0, stoneM), 6.98, 1.5, -8.5); scene.add(slab);
  const beyond = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 2.02), new THREE.MeshBasicMaterial({ color: 0x1a0303, side: THREE.BackSide }));
  beyond.position.set(8.5, 1.5, -8.5); scene.add(beyond);
  const beyondGlow = P.glowSprite(0xff3018, 2.4, 0); beyondGlow.position.set(9.4, 1.6, -8.5); scene.add(beyondGlow);
  const exit = { k: 0, silent: true, set(k) { this.k = k; slab.position.y = 1.5 - k * 3.05; beyondGlow.material.opacity = k * 0.5; } };

  /* ---------- light ---------- */
  scene.add(new THREE.HemisphereLight(0x3a1414, 0x050202, 0.3));
  for (const x of [-4, 4]) { const l = new THREE.PointLight(0xff2a1a, 1.2, 12, 1.6); l.position.set(x, 3.2, -8); scene.add(l); rig.light(l, { amt: 0.25 }); }
  const altarLight = new THREE.PointLight(0xff7a3a, 1.0, 8, 1.7); altarLight.position.set(0, 2.2, -9.8); scene.add(altarLight);
  rig.light(altarLight, { amt: 0.2 });
  // Picks the hooded figure out of the dark from above.
  const figLight = new THREE.PointLight(0xff5a3a, 1.1, 5, 1.6); figLight.position.set(0, 4.4, -12.2); scene.add(figLight);

  /* ---------- shadows on the walls, fog ---------- */
  const shades = [-1, 1].map(s => { const f = P.shadowFigure(3); at(f, s * 6.9, 2.2, -12, 0, s > 0 ? -HALF : HALF); scene.add(f); return { f, s, t: -1, next: 6 + Math.random() * 10 }; });
  const fog = P.fogLayer({ count: 18, w: 13, d: 15, x: 0, z: -8, y: 0.1, size: 4, color: 0xa06060, opacity: 0.12, speed: 0.05, spread: 0.4 });
  scene.add(fog.group); updaters.push(fog);
  const web = (x, y, z, ry, flip) => { const w = P.cobweb(1.5); at(w, x, y, z, 0, ry); if (flip) w.scale.x = -1; scene.add(w); };
  web(-7, H, -15.96, 0); web(7, H, -15.96, 0, true);

  const set = {
    scene, lights: rig, ambience: 'ritual', flashScale: 0, ceiling: H,
    home: { pos: new THREE.Vector3(0, 1.7, -2.2), look: new THREE.Vector3(0, 1.5, -11) },
    view: { pos: new THREE.Vector3(0, 1.85, -6.4), look: new THREE.Vector3(0, 2.0, -12.4) },
    anchors: { altar: new THREE.Vector3(0, 1.6, -11), exit: new THREE.Vector3(6.9, 1.7, -8.5) },
    doorAt: { exit },
    figure,

    // Glow of chalice i, 0..1 (eases toward it).
    chalice(i, level) { chalices[i].target = level; },
    allChalices(level) { chalices.forEach(c => { c.target = level; }); },

    reset() {
      rig.darkness = 0; rig.chaos = 0;
      chalices.forEach(c => { c.target = c.level = 0; });
      figure.hand = 0; figure.turn = 0; figure.fade = 0; figure.setEyes(0.4);
      exit.set(0);
    },
    solved() { set.reset(); set.allChalices(1); figure.fade = 1; exit.set(1); },
    onEnter() { rig.darkness = 0; rig.chaos = 0; },

    update(t, dt) {
      updaters.forEach(u => u.update(t));
      chalices.forEach((c, i) => {
        c.level += (c.target - c.level) * Math.min(1, dt * 3);
        const f = 0.85 + Math.sin(t * 11 + i * 2) * 0.1 + Math.random() * 0.05;
        c.glow.material.opacity = c.level * 0.85 * f;
        c.light.intensity = c.level * 1.8 * f;
        c.liquid.material.color.setRGB(0.13 + c.level * 0.85, 0.01 + c.level * 0.05, 0.01);
      });
      symbols.forEach((m, i) => { m.opacity = (0.35 + Math.sin(t * 0.8 + i) * 0.12) * (1 - rig.darkness); });
      fig.rotation.z = Math.sin(t * 0.6) * 0.02;
      fig.rotation.y = figure.turn * Math.PI;
      fig.position.y = 0.24 + Math.sin(t * 0.9) * 0.02;
      handR.position.set(0.12 + figure.hand * 0.42, 1.65 + figure.hand * 1.0, 0.62 - figure.hand * 0.1);
      figMats.forEach(m => { m.opacity = 1 - figure.fade; });
      fig.visible = figure.fade < 0.99;
      shades.forEach(sh => {
        if (sh.t < 0 && t > sh.next) sh.t = 0;
        if (sh.t >= 0) {
          sh.t += dt; const k = sh.t / 6;
          sh.f.position.z = -14 + k * 11;
          sh.f.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.5;
          if (k >= 1) { sh.t = -1; sh.next = t + 12 + Math.random() * 15; sh.f.material.opacity = 0; }
        }
      });
    }
  };
  return set;
});
