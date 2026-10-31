/* ==========================================================================
   Set template: a junction (decision room). One portal per choice in the
   far wall, anchors 'p0', 'p1', ... from left to right.
     { template: 'junction', theme: 'crypt'|'gallery'|'wing'|'corridors',
       portals: ['door','nurseryDoor','arch','passage','stairsUp','stairsDown'],
       portrait: 'left'|'right' }   optional: the host's portrait on that side wall,
                                    a little ahead of the camera (see js/host-portrait.js)
   Room spans x -W/2..W/2, z 0 (behind camera) .. -D, floor y 0.
   ========================================================================== */

HH.World.define('junction', function (opts) {
  const P = HH.Props, Tx = HH.Tex, at = P.at, HALF = Math.PI / 2, TAU = Math.PI * 2;

  const THEMES = {
    crypt: {
      height: 5.2, depth: 12, portraitZ: -7.0, fog: 0x07080b, density: 0.055, light: 0xffa050, hemi: [0x2a3448, 0x050505, 0.3],
      wall: (w, h) => P.mat({ map: Tx.tiled(Tx.stone('#3b3934', 41, 56), w / 4, h / 4), roughness: 0.95 }),
      floor: (w, d) => P.mat({ map: Tx.tiled(Tx.stone('#33312d', 42, 96), w / 4, d / 4), roughness: 0.95 })
    },
    gallery: {
      height: 6, depth: 13, portraitZ: -7.6, fog: 0x08070a, density: 0.04, light: 0xffa04a, hemi: [0x2c2a30, 0x080605, 0.28],
      wall: (w, h) => P.mat({ map: Tx.tiled(Tx.wallpaper('#18201a', '#26322a', 43), w / 3.2, h / 3.2), roughness: 0.9 }),
      floor: (w, d) => { const t = Tx.tiled(Tx.wood(44, '#2a1a0e', 8), w / 5, d / 5); t.rotation = HALF; return P.mat({ map: t, roughness: 0.6 }); }
    },
    wing: {
      height: 5, depth: 12, portraitZ: -7.4, fog: 0x07080c, density: 0.05, light: 0xffb060, hemi: [0x2a3550, 0x070606, 0.3],
      wall: (w, h) => P.mat({ map: Tx.tiled(Tx.wallpaper('#1a1e28', '#272d3c', 45), w / 3.2, h / 3.2), roughness: 0.9 }),
      floor: (w, d) => { const t = Tx.tiled(Tx.wood(46, '#2c1d12', 8), w / 5, d / 5); t.rotation = HALF; return P.mat({ map: t, roughness: 0.65 }); }
    },
    corridors: {
      height: 5, depth: 11, portraitZ: -7.0, fog: 0x060506, density: 0.05, light: 0xff9440, hemi: [0x2a2420, 0x060505, 0.24],
      wall: (w, h) => P.mat({ map: Tx.tiled(Tx.wood(47, '#24150c', 4), w / 3, h / 3), roughness: 0.75 }),
      floor: (w, d) => { const t = Tx.tiled(Tx.wood(48, '#20140b', 8), w / 5, d / 5); t.rotation = HALF; return P.mat({ map: t, roughness: 0.6 }); }
    }
  };

  // Opening size per portal kind.
  const SIZE = {
    door: [1.6, 3.0], nurseryDoor: [1.5, 2.9], arch: [2.2, 3.4],
    passage: [1.1, 2.3], stairsUp: [2.0, 3.6], stairsDown: [2.0, 3.0]
  };

  const th = THEMES[opts.theme] || THEMES.gallery;
  const portals = (opts.portals || ['door', 'door']).map(k => (SIZE[k] ? k : 'door'));
  const n = portals.length, SP = 3.6;
  const side = opts.portrait === 'left' ? -1 : opts.portrait === 'right' ? 1 : 0;
  const W = Math.max(10, n * SP + 3), D = th.depth, H = th.height;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(th.fog);
  scene.fog = new THREE.FogExp2(th.fog, th.density);
  const rig = new P.LightRig();
  const updaters = [];
  const trim = P.mat({ color: 0x140c08, roughness: 0.6 });
  const stoneTrim = P.mat({ map: Tx.tiled(Tx.stone('#4a4740', 49, 48), 0.5, 1), roughness: 0.95 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x010102, side: THREE.BackSide });

  /* ---------- shell ---------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), th.floor(W, D));
  floor.rotation.x = -HALF; floor.position.set(0, 0, -D / 2); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), P.mat({ color: 0x0b0807 }));
  ceil.rotation.x = HALF; ceil.position.set(0, H, -D / 2); scene.add(ceil);
  const wall = (w, h, x, y, z, ry) => { if (w > 0.01 && h > 0.01) scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(w, h), th.wall(w, h)), x, y, z, 0, ry)); };
  wall(D, H, -W / 2, H / 2, -D / 2, HALF);
  wall(D, H, W / 2, H / 2, -D / 2, -HALF);
  wall(W, H, 0, H / 2, 0, Math.PI);

  // Back wall, built around the openings.
  const xs = portals.map((k, i) => (i - (n - 1) / 2) * SP);
  let edge = -W / 2;
  portals.forEach((k, i) => {
    const [w, h] = SIZE[k], l = xs[i] - w / 2, r = xs[i] + w / 2;
    wall(l - edge, H, (edge + l) / 2, H / 2, -D, 0);
    wall(w, H - h, xs[i], h + (H - h) / 2, -D, 0);
    edge = r;
  });
  wall(W / 2 - edge, H, (edge + W / 2) / 2, H / 2, -D, 0);

  /* ---------- portals ---------- */
  const anchors = {}, doorAt = {}, portalKinds = {}, doors = [];
  const noop = { set() {}, silent: true };

  function voidBox(w, h, depth, x, y = h / 2) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, h, depth), dark);
    b.position.set(x, y, -D - depth / 2);
    scene.add(b);
    return b;
  }

  function steps(x, w, up) {
    const m = P.mat({ map: Tx.tiled(Tx.stone('#3a3732', 50, 64), 1, 0.3), roughness: 0.95 });
    for (let i = 0; i < 9; i++) {
      const rise = 0.34, run = 0.45, y = up ? (i + 1) * rise : -(i + 1) * rise;
      const hgt = up ? y : rise;
      scene.add(at(P.box(w - 0.2, hgt, run, m), x, up ? y / 2 : y + rise / 2, -D - 0.25 - i * run));
    }
  }

  function kidDrawing() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#e9e2cf'; g.fillRect(0, 0, 256, 256);
    g.lineWidth = 5; g.lineCap = 'round'; g.strokeStyle = '#2a2a2a';
    g.strokeRect(40, 120, 110, 90); g.beginPath(); g.moveTo(30, 125); g.lineTo(95, 60); g.lineTo(160, 125); g.stroke();
    g.beginPath(); g.arc(205, 120, 16, 0, TAU); g.moveTo(205, 136); g.lineTo(205, 190); g.moveTo(205, 150); g.lineTo(180, 175); g.moveTo(205, 150); g.lineTo(230, 175);
    g.moveTo(205, 190); g.lineTo(190, 225); g.moveTo(205, 190); g.lineTo(220, 225); g.stroke();
    g.fillStyle = '#c01010'; g.beginPath(); g.arc(199, 117, 3.5, 0, TAU); g.arc(211, 117, 3.5, 0, TAU); g.fill();
    g.fillStyle = '#c01010'; g.font = 'bold 30px Comic Sans MS, sans-serif'; g.fillText('PLAY WITH ME', 20, 40);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }

  portals.forEach((kind, i) => {
    const x = xs[i], [w, h] = SIZE[kind], name = 'p' + i;
    anchors[name] = new THREE.Vector3(x, kind === 'stairsDown' ? 1.4 : 2.0, -D + 0.15);
    portalKinds[name] = kind;
    doorAt[name] = noop;

    if (kind === 'door' || kind === 'nurseryDoor') {
      const pale = kind === 'nurseryDoor';
      scene.add(at(P.doorFrame(w, h, pale ? P.mat({ color: 0x8a8274 }) : trim, 0.3), x, 0, -D + 0.05));
      voidBox(w, h, 2.4, x);
      const d = P.door({ w, h, tone: pale ? '#9a8f7c' : ['#2b1810', '#2a1610', '#331d12'][i % 3], hinge: 'left', max: 1.4 });
      d.pivot.position.set(x - w / 2, 0, -D + 0.02); scene.add(d.pivot);
      doorAt[name] = d; doors.push(d);
      if (pale) {
        const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), P.mat({ map: kidDrawing(), roughness: 0.9 }));
        pic.position.set(w / 2 + 0.05, h * 0.62, 0.06); pic.rotation.z = 0.08; d.pivot.add(pic);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), P.mat({ color: 0x8a1a1a, roughness: 0.5 }));
        ball.position.set(x + 0.9, 0.14, -D + 0.8); scene.add(ball);
      }
    } else if (kind === 'arch') {
      // A dark corridor with a far-off candle, through a round-topped opening:
      // the dark half-disc sits on the wall above the doorway, framed by the stone arch.
      voidBox(w, h, 9, x);
      const crown = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 32, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x010102 }));
      crown.position.set(x, h - 0.01, -D + 0.01); scene.add(crown);
      for (const s of [-1, 1]) scene.add(at(P.box(0.32, h, 0.5, stoneTrim), x + s * (w / 2 + 0.16), h / 2, -D + 0.1));
      const arch = new THREE.Mesh(new THREE.TorusGeometry(w / 2 + 0.16, 0.18, 8, 32, Math.PI), stoneTrim);
      arch.position.set(x, h, -D + 0.1); scene.add(arch);
      const glow = P.glowSprite(0xff9040, 1.4, 0.28); glow.position.set(x + (i - 1) * 0.3, 1.8, -D - 8); scene.add(glow);
      const flame = P.glowSprite(0xffd090, 0.25, 0.7); flame.position.copy(glow.position); scene.add(flame);
      rig.flame(flame, glow);
    } else if (kind === 'passage') {
      // A rough gap in the wall: uneven stones stacked up both sides and across the top.
      voidBox(w, h, 6, x);
      for (const s of [-1, 1]) {
        for (let y = 0; y < h;) {
          const sh = 0.28 + Math.random() * 0.2, sw = 0.34 + Math.random() * 0.16;
          scene.add(at(P.box(sw, sh, 0.42, stoneTrim), x + s * (w / 2 + sw / 2 - 0.04), y + sh / 2, -D + 0.12, 0, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.1));
          y += sh;
        }
      }
      scene.add(at(P.box(w + 0.5, 0.32, 0.44, stoneTrim), x, h + 0.14, -D + 0.12, 0, 0, (Math.random() - 0.5) * 0.06));
    } else if (kind === 'stairsUp') {
      voidBox(w, h + 3, 5, x, (h + 3) / 2);
      steps(x, w, true);
      scene.add(at(P.doorFrame(w, h, trim, 0.3), x, 0, -D + 0.05));
      const top = P.glowSprite(0x8aa0d0, 1.2, 0.18); top.position.set(x, 3.6, -D - 3.4); scene.add(top);
      const l = new THREE.PointLight(0x8aa0d0, 0.9, 6, 1.6); l.position.set(x, 3.2, -D - 2.6); scene.add(l);
    } else if (kind === 'stairsDown') {
      voidBox(w, h + 3.5, 5, x, (h - 3.5) / 2);
      steps(x, w, false);
      scene.add(at(P.doorFrame(w, h, stoneTrim, 0.3), x, 0, -D + 0.05));
      const l = new THREE.PointLight(0xff5020, 0.8, 5, 1.6); l.position.set(x, -1.6, -D - 2.2); scene.add(l);
      rig.light(l, { amt: 0.3 });
    }
  });

  /* ---------- theme dressing ---------- */
  const lights = [];
  const addLight = (x, y, z, intensity = 1, dist = 9) => {
    const l = new THREE.PointLight(th.light, intensity, dist, 1.7); l.position.set(x, y, z); scene.add(l);
    rig.light(l, { amt: 0.22 }); lights.push(l); return l;
  };
  scene.add(new THREE.HemisphereLight(...th.hemi));

  const sconce = (x, z, side) => {
    const g = new THREE.Group(); g.position.set(x, 2.3, z); g.rotation.y = side > 0 ? -HALF : HALF; scene.add(g);
    g.add(at(P.box(0.18, 0.32, 0.06, P.brass()), 0, 0, 0));
    g.add(at(P.candle(rig, { h: 0.2, r: 0.03, flame: 1.2 }), 0, -0.06, 0.18));
  };

  // Sconces between the portals on the back wall.
  for (let i = 0; i <= n; i++) {
    const x = i === 0 ? xs[0] - SP / 2 : i === n ? xs[n - 1] + SP / 2 : (xs[i - 1] + xs[i]) / 2;
    if (Math.abs(x) > W / 2 - 0.4) continue;
    const g = new THREE.Group(); g.position.set(x, 2.5, -D + 0.08); scene.add(g);
    g.add(at(P.box(0.16, 0.3, 0.06, P.brass()), 0, 0, 0));
    g.add(at(P.candle(rig, { h: 0.2, r: 0.03, flame: 1.2 }), 0, -0.05, 0.16));
  }
  addLight(-W / 4, 2.8, -D + 1.6, 1.0);
  addLight(W / 4, 2.8, -D + 1.6, 1.0);
  addLight(0, 3, -D / 2 + 1, 0.6, 11);

  let lullaby = null;
  if (opts.theme === 'crypt') {
    const lid = P.mat({ map: Tx.tiled(Tx.stone('#4a4842', 51, 128), 1, 1), roughness: 0.95 });
    for (const s of [-1, 1]) {
      scene.add(at(P.box(1.0, 0.9, 2.3, lid), s * (W / 2 - 1.0), 0.45, -D / 2 + s * 1.5));
      scene.add(at(P.box(1.1, 0.15, 2.4, lid), s * (W / 2 - 1.0), 0.97, -D / 2 + s * 1.5, 0, s * 0.08));
    }
    const bone = P.mat({ color: 0xb8ae94, roughness: 0.6 });
    for (let k = 0; k < 10; k++) {
      const s = k % 2 ? 1 : -1, z = -2 - (k >> 1) * 2;
      const sk = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), bone); sk.scale.set(1, 0.95, 1.15);
      sk.position.set(s * (W / 2 - 0.12), 3.3 + (k % 3) * 0.1, z); scene.add(sk);
    }
    for (const s of [-1, 1]) {
      const stand = new THREE.Group(); stand.position.set(s * 2.4, 0, -4.5); scene.add(stand);
      stand.add(at(P.cyl(0.04, 0.12, 1.3, P.iron(), 8), 0, 0.65, 0));
      stand.add(at(P.candle(rig, { h: 0.3, r: 0.05, flame: 1.6 }), 0, 1.3, 0));
    }
  } else if (opts.theme === 'gallery') {
    const seeds = [11, 12, 14, 17, 20, 23, 26, 29];
    const paintings = [];
    for (let k = 0; k < 8; k++) {
      const s = k % 2 ? 1 : -1, z = -2.4 - (k >> 1) * 2.6;
      if (side === s && Math.abs(z - th.portraitZ) < 0.5) continue;   // the host's portrait hangs here
      const p = P.painting({ seed: seeds[k], w: 1.1, h: 1.45 });
      at(p.group, s * (W / 2 - 0.04), 2.9, z, 0, s > 0 ? -HALF : HALF); scene.add(p.group); paintings.push(p);
    }
    // Wood panelling along the back wall, broken at each doorway.
    const panel = P.mat({ map: Tx.tiled(Tx.wood(52, '#1e1008', 6), 3, 1) });
    let from = -W / 2;
    portals.forEach((k, i) => {
      const l = xs[i] - SIZE[k][0] / 2 - (k === 'arch' ? 0.32 : 0.1);
      if (l - from > 0.01) scene.add(at(P.box(l - from, 1.0, 0.06, panel), (from + l) / 2, 0.5, -D + 0.03));
      from = xs[i] + SIZE[k][0] / 2 + (k === 'arch' ? 0.32 : 0.1);
    });
    scene.add(at(P.box(W / 2 - from, 1.0, 0.06, panel), (from + W / 2) / 2, 0.5, -D + 0.03));
    const ch = P.chandelier(rig, 1.2); ch.group.position.set(0, H, -D / 2); scene.add(ch.group);
    updaters.push({ update(t) { paintings.forEach((p, i) => p.setEyes(Math.max(0, Math.sin(t * 0.4 + i * 1.7) - 0.92) * 8)); } });
  } else if (opts.theme === 'wing') {
    const sheet = P.mat({ map: Tx.sheet(), roughness: 1 });
    [[-W / 2 + 1.2, -3, 1.4, 1.0], [W / 2 - 1.1, -5.5, 1.0, 1.9]].forEach(([x, z, w, h]) => {
      scene.add(at(P.box(w, h, 0.9, sheet), x, h / 2, z));
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), sheet); top.scale.set(w, 0.3, 0.95); top.position.set(x, h, z); scene.add(top);
    });
    const win = P.windowFrame({ w: 1.3, h: 2.6, kind: 'cold' });
    win.group.position.set(-W / 2 + 0.03, 2.6, -6.5); win.group.rotation.y = HALF; scene.add(win.group);
    const moon = new THREE.DirectionalLight(0x8ea6e0, 0.25); moon.position.set(-8, 6, -6); moon.target.position.set(2, 0, -6); scene.add(moon, moon.target);
    if (portals.includes('nurseryDoor')) lullaby = { notes: [659, 587, 523, 587, 659, 659, 659, 0, 587, 587, 587, 0, 659, 784, 784, 0], i: 0, next: 0 };
  } else if (opts.theme === 'corridors') {
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.8, D - 1.5), P.mat({ map: Tx.rug(), roughness: 1 }));
    runner.rotation.x = -HALF; runner.position.set(0, 0.012, -D / 2 - 0.3); scene.add(runner);
    for (let z = -2.5; z > -D + 1; z -= 3) { sconce(-W / 2 + 0.06, z, -1); sconce(W / 2 - 0.06, z, 1); }
  }

  // The host's portrait, a little ahead of the camera on one side wall.
  const master = side ? HH.HostPortrait.hang(scene, { pos: [side * (W / 2 - 0.08), 2.75, th.portraitZ], ry: -side * HALF, scale: 0.9 }) : null;

  const web = (x, y, z, ry, flip) => { const w = P.cobweb(1.4); at(w, x, y, z, 0, ry); if (flip) w.scale.x = -1; scene.add(w); };
  web(-W / 2, H, -D + 0.04, 0); web(W / 2, H, -D + 0.04, 0, true);

  const fog = P.fogLayer({ count: 16, w: W - 1, d: D - 1, x: 0, z: -D / 2, y: 0.1, size: 4, color: 0x8a8a9c, opacity: 0.1, speed: 0.05, spread: 0.4 });
  scene.add(fog.group); updaters.push(fog);
  const dust = P.dust({ count: 160, w: W - 1, h: H - 1, d: D - 1, x: 0, y: H / 2, z: -D / 2 });
  scene.add(dust.points); updaters.push(dust);

  return {
    scene, lights: rig, ambience: 'interior', flashScale: 0,
    home: { pos: new THREE.Vector3(0, 1.7, -D + 6.8), look: new THREE.Vector3(0, 1.9, -D) },
    anchors: Object.assign(anchors, master ? { hostPortrait: master.anchor } : {}), doorAt, portalKinds, ceiling: H,
    hostPortrait: master,
    onEnter() { rig.darkness = 0; rig.chaos = 0; doors.forEach(d => d.set(0)); },
    update(t) {
      updaters.forEach(u => u.update(t));
      if (lullaby && HH.World.current && HH.World.current.scene === scene && t > lullaby.next) {
        const f = lullaby.notes[lullaby.i++ % lullaby.notes.length];
        if (f) HH.Audio.sfx.bell(f * 2, 0.035);
        lullaby.next = t + 0.42;
      }
    }
  };
});
