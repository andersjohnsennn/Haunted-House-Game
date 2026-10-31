/* ==========================================================================
   Set: the Ghost's library. x -7..7, z 0..-14, ceiling 7. Bookshelves on
   the walls, an antique desk, floating books and candles, a blackboard on
   the back wall where the question is chalked, the ghost quizmaster, and a
   chained door in the right wall near the entrance (the exit).
   ========================================================================== */

HH.World.define('ghost_library', function () {
  const P = HH.Props, Tx = HH.Tex, at = P.at, HALF = Math.PI / 2, TAU = Math.PI * 2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020506);
  scene.fog = new THREE.FogExp2(0x041012, 0.045);
  const rig = new P.LightRig();
  const updaters = [];
  const H = 7;

  /* ---------- shell ---------- */
  const paper = (w, h) => P.mat({ map: Tx.tiled(Tx.wallpaper('#141c1c', '#1e2a2a', 91), w / 3.2, h / 3.2), roughness: 0.9 });
  const wall = (w, h, x, y, z, ry) => scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(w, h), paper(w, h)), x, y, z, 0, ry));
  const floorTex = Tx.tiled(Tx.wood(92, '#24170d', 8), 3, 3); floorTex.rotation = HALF;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), P.mat({ map: floorTex, roughness: 0.6 }));
  floor.rotation.x = -HALF; floor.position.set(0, 0, -7); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), P.mat({ color: 0x080606 }));
  ceil.rotation.x = HALF; ceil.position.set(0, H, -7); scene.add(ceil);
  wall(14, H, -7, H / 2, -7, HALF);
  wall(2.6, H, 7, H / 2, -1.3, -HALF);
  wall(9.8, H, 7, H / 2, -9.1, -HALF);
  wall(1.6, H - 3, 7, 3 + (H - 3) / 2, -3.4, -HALF);
  wall(14, H, 0, H / 2, -14, 0);
  wall(14, H, 0, H / 2, 0, Math.PI);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4, 6), P.mat({ map: Tx.rug(), color: 0x6a8a8a, roughness: 1 }));
  rug.rotation.x = -HALF; rug.position.set(0, 0.012, -6.5); scene.add(rug);

  /* ---------- bookshelves: one instanced mesh of book spines ---------- */
  const shelfWood = P.mat({ map: Tx.tiled(Tx.wood(93, '#22140a', 4), 1, 2), roughness: 0.7 });
  const shelves = [];   // [x, zFrom, zTo, facing(+1 = faces +x), height]
  shelves.push([-6.65, -1.2, -13.5, 1, 6], [6.65, -5.0, -13.5, -1, 6]);
  const backShelves = [[-4.9, -13.65, 3.4], [4.9, -13.65, 3.4]];
  const books = [];
  const COLORS = [0x4a1010, 0x10301a, 0x14203a, 0x3a2a10, 0x2a1030, 0x3a3a30, 0x5a3a1a, 0x1a1a1a];
  shelves.forEach(([x, z0, z1, f, h]) => {
    const len = Math.abs(z1 - z0), zc = (z0 + z1) / 2;
    scene.add(at(P.box(0.7, h, len, shelfWood), x - f * 0.0, h / 2, zc));
    for (let s = 0; s < 6; s++) {
      const y = 0.35 + s * 0.95;
      scene.add(at(P.box(0.72, 0.05, len, shelfWood), x + f * 0.02, y - 0.03, zc));
      let z = Math.max(z0, z1) - 0.05;
      while (z > Math.min(z0, z1) + 0.1) {
        const w = 0.05 + Math.random() * 0.06, bh = 0.5 + Math.random() * 0.3;
        if (Math.random() > 0.06) books.push({ x: x + f * 0.36, y: y + bh / 2, z: z - w / 2, w, h: bh, d: 0.42 + Math.random() * 0.15, lean: Math.random() < 0.08 ? (Math.random() - 0.5) * 0.5 : 0, axis: 'z' });
        z -= w + 0.004;
      }
    }
  });
  backShelves.forEach(([x, z, w]) => {
    scene.add(at(P.box(w, 6, 0.6, shelfWood), x, 3, z));
    for (let s = 0; s < 6; s++) {
      const y = 0.35 + s * 0.95;
      let xx = x - w / 2 + 0.08;
      while (xx < x + w / 2 - 0.1) {
        const bw = 0.05 + Math.random() * 0.06, bh = 0.5 + Math.random() * 0.3;
        books.push({ x: xx + bw / 2, y: y + bh / 2, z: z + 0.32, w: bw, h: bh, d: 0.42, lean: 0, axis: 'x' });
        xx += bw + 0.004;
      }
    }
  });
  const bookMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), P.mat({ roughness: 0.8 }), books.length);
  const dmy = new THREE.Object3D(), col = new THREE.Color();
  books.forEach((b, i) => {
    dmy.position.set(b.x, b.y, b.z);
    dmy.rotation.set(b.axis === 'z' ? b.lean : 0, 0, b.axis === 'x' ? b.lean : 0);
    dmy.scale.set(b.axis === 'z' ? b.d : b.w, b.h, b.axis === 'z' ? b.w : b.d);
    dmy.updateMatrix(); bookMesh.setMatrixAt(i, dmy.matrix);
    col.setHex(COLORS[i % COLORS.length]).convertSRGBToLinear().multiplyScalar(0.7 + Math.random() * 0.6);
    bookMesh.setColorAt(i, col);
  });
  scene.add(bookMesh);

  /* ---------- blackboard ---------- */
  const boardCanvas = document.createElement('canvas'); boardCanvas.width = 1024; boardCanvas.height = 512;
  const boardTex = new THREE.CanvasTexture(boardCanvas); boardTex.encoding = THREE.sRGBEncoding;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.6), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.9, emissive: 0xffffff, emissiveMap: boardTex, emissiveIntensity: 0.12 }));
  board.position.set(0, 3.6, -13.95); scene.add(board);
  for (const [w, h, x, y] of [[5.5, 0.16, 0, 4.98], [5.5, 0.2, 0, 2.22], [0.16, 2.9, -2.68, 3.6], [0.16, 2.9, 2.68, 3.6]]) scene.add(at(P.box(w, h, 0.12, shelfWood), x, y, -13.9));
  function writeBoard(text) {
    const g = boardCanvas.getContext('2d');
    g.fillStyle = '#0f1a16'; g.fillRect(0, 0, 1024, 512);
    g.globalAlpha = 0.18; g.drawImage(Tx.noiseCanvas(94, 8), 0, 0, 1024, 512); g.globalAlpha = 1;
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(200,220,210,${Math.random() * 0.05})`; g.beginPath(); g.ellipse(Math.random() * 1024, Math.random() * 512, 60 + Math.random() * 140, 20 + Math.random() * 50, Math.random(), 0, TAU); g.fill(); }
    if (text) {
      g.fillStyle = 'rgba(235,240,232,0.92)'; g.textAlign = 'center'; g.textBaseline = 'middle';
      let size = 58, lines;
      do {
        g.font = `italic ${size}px Georgia, serif`;
        lines = []; let line = '';
        text.split(/\s+/).forEach(w => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > 920 && line) { lines.push(line); line = w; } else line = t; });
        if (line) lines.push(line);
        size -= 4;
      } while (lines.length * size * 1.25 > 420 && size > 24);
      lines.forEach((l, i) => g.fillText(l, 512 + (Math.random() - 0.5) * 4, 256 + (i - (lines.length - 1) / 2) * size * 1.3));
    } else {
      g.strokeStyle = 'rgba(235,240,232,0.5)'; g.lineWidth = 4;
      for (let i = 0; i < 6; i++) { g.beginPath(); const y = 120 + i * 50; g.moveTo(140 + Math.random() * 40, y); for (let x = 180; x < 880; x += 40) g.lineTo(x, y + (Math.random() - 0.5) * 12); g.stroke(); }
    }
    boardTex.needsUpdate = true;
  }
  writeBoard('');

  /* ---------- desk, candles, floating things ---------- */
  const desk = new THREE.Group(); desk.position.set(1.6, 0, -9.2); scene.add(desk);
  desk.add(at(P.box(2.4, 0.1, 1.2, shelfWood), 0, 0.86, 0));
  for (const x of [-0.95, 0.95]) desk.add(at(P.box(0.5, 0.8, 1.1, shelfWood), x, 0.41, 0));
  const pageM = P.mat({ color: 0xd8ccb0, roughness: 0.9, side: THREE.DoubleSide });
  for (const s of [-1, 1]) desk.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.46), pageM), s * 0.17, 0.92, 0.1, -HALF, 0, s * 0.12));
  desk.add(at(P.cyl(0.05, 0.06, 0.08, P.mat({ color: 0x101018 }), 10), 0.7, 0.95, -0.2));
  desk.add(at(P.candle(rig, { h: 0.25, r: 0.04 }), -0.75, 0.91, -0.25));
  const deskLight = new THREE.PointLight(0xffb060, 0.7, 6, 1.8); deskLight.position.set(0.8, 1.5, -9.4); scene.add(deskLight); rig.light(deskLight, { amt: 0.25 });

  const floaters = [];
  for (let i = 0; i < 9; i++) {
    const isCandle = i % 3 === 0;
    const g = new THREE.Group(); scene.add(g);
    if (isCandle) g.add(P.candle(rig, { h: 0.22, r: 0.035 }));
    else {
      g.add(at(P.box(0.32, 0.06, 0.24, P.mat({ color: COLORS[i % COLORS.length], roughness: 0.8 })), 0, 0, 0));
      g.add(at(P.box(0.3, 0.045, 0.22, pageM), 0.01, 0, 0));
    }
    floaters.push({ g, base: new THREE.Vector3(-4 + Math.random() * 8, 2.6 + Math.random() * 2.4, -4 - Math.random() * 8), ph: Math.random() * TAU, sp: 0.3 + Math.random() * 0.4, spin: (Math.random() - 0.5) * 0.6, fling: null });
  }

  /* ---------- the ghost (shared with the wine cellar: HH.Props.ghost) ---------- */
  const spirit = P.ghost(new THREE.Vector3(-1.4, 1.8, -8.2));
  scene.add(spirit.group);

  /* ---------- chained door (exit) ---------- */
  const trim = P.mat({ color: 0x140c08, roughness: 0.6 });
  const holder = new THREE.Group(); holder.position.set(7.0, 0, -4.2); holder.rotation.y = -HALF; scene.add(holder);
  const door = P.door({ w: 1.6, h: 3.0, tone: '#2a1a12', hinge: 'left', max: 1.4 });
  holder.add(door.pivot);
  holder.add(at(P.doorFrame(1.6, 3.0, trim, 0.3), 0.8, 0, 0));
  const voidB = P.doorway(1.6, 3.0, 2.2, 'dark'); voidB.position.set(0.8, 1.5, -1.1); holder.add(voidB);
  const chainG = new THREE.Group(); chainG.position.set(0.8, 0, 0.12); holder.add(chainG);
  const ironM = P.iron();
  for (const s of [-1, 1]) chainG.add(at(P.box(1.9, 0.07, 0.04, ironM), 0, 1.6, 0, 0, 0, s * 0.95));
  chainG.add(at(P.box(0.2, 0.24, 0.08, P.brass()), 0, 1.6, 0.05));
  chainG.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 14, Math.PI), ironM), 0, 1.74, 0.05));
  // A candle on the wall beside it, so the way out can be seen.
  const sconce = new THREE.Group(); sconce.position.set(6.98, 2.1, -1.9); scene.add(sconce);
  sconce.add(at(P.box(0.06, 0.24, 0.1, ironM), -0.03, -0.08, 0));
  sconce.add(at(P.box(0.26, 0.035, 0.12, ironM), -0.13, 0, 0));
  sconce.add(at(P.candle(rig, { h: 0.2, r: 0.035 }), -0.16, 0.02, 0));
  const doorLight = new THREE.PointLight(0xffa050, 1.0, 6, 1.8); doorLight.position.set(6.4, 2.5, -2.3); scene.add(doorLight); rig.light(doorLight, { amt: 0.25 });

  const exit = {
    k: 0, unlocked: false,
    set(k) { this.k = k; door.set(k * 0.85); },
    unlock() { this.unlocked = true; HH.Audio.sfx.chains(0.7); return HH.Tween.add({ dur: 0.9, update: k => { chainG.position.y = -1.4 * k * k; chainG.rotation.z = k * 0.5; }, ease: 'in' }).then(() => { chainG.visible = false; }); }
  };

  /* ---------- light ---------- */
  scene.add(new THREE.HemisphereLight(0x1a3a3a, 0x050505, 0.35));
  for (const [x, z] of [[-3.5, -6], [3.5, -9]]) { const l = new THREE.PointLight(0x40ffd0, 0.9, 11, 1.6); l.position.set(x, 4.4, z); scene.add(l); rig.light(l, { amt: 0.2, speed: 0.7 }); }
  const fog = P.fogLayer({ count: 16, w: 13, d: 13, x: 0, z: -7, y: 0.1, size: 4, color: 0x7ad8c8, opacity: 0.1, speed: 0.05, spread: 0.5 });
  scene.add(fog.group); updaters.push(fog);
  const dust = P.dust({ count: 240, w: 12, h: 6, d: 12, x: 0, y: 3, z: -7, color: 0xa8fff0 });
  scene.add(dust.points); updaters.push(dust);
  const web = (x, y, z, ry, flip) => { const w = P.cobweb(1.5); at(w, x, y, z, 0, ry); if (flip) w.scale.x = -1; scene.add(w); };
  web(-7, H, -13.96, 0); web(7, H, -13.96, 0, true);

  const set = {
    scene, lights: rig, ambience: 'library', flashScale: 0, ceiling: H,
    home: { pos: new THREE.Vector3(0, 1.7, -1.8), look: new THREE.Vector3(0, 2.6, -12) },
    view: { pos: new THREE.Vector3(0.2, 1.75, -3.4), look: new THREE.Vector3(-0.4, 2.7, -12) },
    anchors: { board: new THREE.Vector3(0, 3.6, -13.9), ghost: spirit.state.home.clone(), exit: new THREE.Vector3(6.9, 1.7, -3.4) },
    doorAt: { exit },
    writeBoard,

    ghost: {
      appear: quick => spirit.appear(quick),
      correct: () => spirit.happy(),
      calm: () => spirit.calm(),
      // Wrong answer: the lights fail and the floating books are flung about.
      wrong() {
        rig.chaos = 0.75;
        floaters.forEach(o => { o.fling = new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6); });
        return spirit.rage(() => { rig.chaos = 0; });
      },
      vanish: () => spirit.vanish()
    },

    reset() {
      rig.darkness = 0; rig.chaos = 0;
      spirit.reset();
      floaters.forEach(o => { o.fling = null; });
      chainG.visible = true; chainG.position.y = 0; chainG.rotation.z = 0; exit.unlocked = false; exit.set(0);
      writeBoard('');
    },
    solved() { set.reset(); chainG.visible = false; exit.set(1); },
    onEnter() { rig.darkness = 0; rig.chaos = 0; },

    update(t, dt) {
      updaters.forEach(u => u.update(t));
      floaters.forEach(o => {
        if (o.fling) {
          o.g.position.addScaledVector(o.fling, dt); o.fling.y -= 6 * dt; o.g.rotation.x += dt * 6;
          if (o.g.position.y < 0.1) { o.g.position.y = 0.1; o.fling.set(0, 0, 0); }
          return;
        }
        o.g.position.set(o.base.x + Math.sin(t * o.sp + o.ph) * 0.4, o.base.y + Math.sin(t * o.sp * 1.7 + o.ph) * 0.25, o.base.z + Math.cos(t * o.sp + o.ph) * 0.4);
        o.g.rotation.y = t * o.spin; o.g.rotation.z = Math.sin(t + o.ph) * 0.2;
      });
      spirit.update(t, dt);
    }
  };
  return set;
});
