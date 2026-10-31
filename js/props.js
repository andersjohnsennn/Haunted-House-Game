/* ==========================================================================
   Reusable 3D props shared by every set: flickering light rig, candles,
   doors, fog, dust, the creature, paintings, chandelier, clock, trees...
   ========================================================================== */

window.HH = window.HH || {};

HH.Props = (function () {
  const TAU = Math.PI * 2;
  const T = () => HH.Tex;

  // Hex colours are written as sRGB; r128 treats them as linear, so convert.
  function mat(o) {
    const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0 }, o));
    m.color.convertSRGBToLinear();
    m.emissive.convertSRGBToLinear();
    return m;
  }
  function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
  function cyl(rt, rb, h, m, seg = 12) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); }
  function at(o, x, y, z, rx = 0, ry = 0, rz = 0) { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; }

  const brass = () => mat({ color: 0xa8843a, metalness: 0.5, roughness: 0.42 });
  const iron = () => mat({ color: 0x141414, metalness: 0.6, roughness: 0.6 });

  /* ---------- light rig: every flame and candle light in a set ---------- */
  class LightRig {
    constructor() { this.lights = []; this.flames = []; this.darkness = 0; this.chaos = 0; this.boost = 1; this.blackout = 1; }

    light(l, { amt = 0.18, speed = 1 } = {}) {
      this.lights.push({ l, base: l.intensity, amt, speed, seed: Math.random() * 100 });
      return l;
    }

    flame(sprite, glow) {
      this.flames.push({ s: sprite, glow, base: sprite.scale.clone(), gop: glow ? glow.material.opacity : 0, seed: Math.random() * 100 });
    }

    update(t) {
      let blackout = 1;
      if (this.chaos > 0) {
        const n = Math.sin(t * 23.1) + Math.sin(t * 37.7 + 1.3) + Math.sin(t * 61.3 + 2.1);
        blackout = n > 2.4 - this.chaos * 2.6 ? 0.03 : 1 - this.chaos * 0.45 * Math.random();
      }
      this.blackout = blackout;
      const lit = (1 - this.darkness) * blackout * this.boost;
      for (const it of this.lights) {
        const f = 1 + (Math.sin(t * 7.3 * it.speed + it.seed) * 0.5 + Math.sin(t * 13.7 * it.speed + it.seed * 2) * 0.3 + (Math.random() - 0.5) * 0.35) * it.amt;
        it.l.intensity = Math.max(0, it.base * f * lit);
      }
      const flameOn = (1 - this.darkness) * (blackout < 0.5 ? 0.15 : 1);
      for (const f of this.flames) {
        const k = 1 + Math.sin(t * 11 + f.seed) * 0.07 + (Math.random() - 0.5) * 0.1;
        f.s.scale.set(f.base.x * k, f.base.y * (k + Math.sin(t * 17 + f.seed) * 0.05), 1);
        f.s.material.opacity = flameOn;
        if (f.glow) f.glow.material.opacity = f.gop * flameOn * k;
      }
    }
  }

  function glowSprite(color, size, opacity = 0.5) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: T().glow(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity
    }));
    s.scale.set(size, size, 1);
    return s;
  }

  function candle(rig, { h = 0.22, r = 0.03, color = 0xe2d6b8, flame = 1 } = {}) {
    const g = new THREE.Group();
    const wax = cyl(r * 0.9, r, h, mat({ color, roughness: 0.55, emissive: 0x4a2208, emissiveIntensity: 0.35 }), 10);
    wax.position.y = h / 2; g.add(wax);
    const fs = 0.075 * flame;
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T().flame(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    fl.scale.set(fs * 0.5, fs, 1); fl.position.y = h + fs * 0.4; g.add(fl);
    const gl = glowSprite(0xff9a40, 0.45 * flame, 0.32); gl.position.y = h + fs * 0.4; g.add(gl);
    rig.flame(fl, gl);
    return g;
  }

  function candelabra(rig, arms = 3) {
    const g = new THREE.Group(), m = brass();
    g.add(at(cyl(0.12, 0.16, 0.05, m), 0, 0.025, 0));
    g.add(at(cyl(0.025, 0.035, 0.45, m), 0, 0.27, 0));
    for (let i = 0; i < arms; i++) {
      const x = arms === 1 ? 0 : (i / (arms - 1) - 0.5) * 0.36;
      g.add(at(cyl(0.035, 0.02, 0.05, m), x, 0.5, 0));
      if (x) g.add(at(box(Math.abs(x), 0.02, 0.02, m), x / 2, 0.47, 0));
      g.add(at(candle(rig, { h: 0.18 + Math.random() * 0.08, r: 0.022 }), x, 0.52, 0));
    }
    return g;
  }

  /* ---------- doors ---------- */
  // Pivot sits on the hinge. The door faces +z; set(k) swings it away from +z.
  function door({ w = 1.6, h = 3, t = 0.09, tone = '#2b1810', hinge = 'left', max = 1.45 } = {}) {
    const pivot = new THREE.Group();
    const edge = mat({ color: 0x1a0e08 });
    const face = mat({ map: T().doorPanel(tone), roughness: 0.75 });
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), [edge, edge, edge, edge, face, face]);
    const dir = hinge === 'left' ? 1 : -1;
    leaf.position.set(dir * w / 2, h / 2, 0);
    pivot.add(leaf);

    const handle = new THREE.Group();
    const hx = dir * (w - 0.14);
    handle.position.set(hx, h * 0.47, t / 2 + 0.02);
    const b = brass();
    handle.add(at(cyl(0.035, 0.035, 0.04, b, 12), 0, 0, 0, Math.PI / 2));
    handle.add(at(box(0.16, 0.025, 0.025, b), -dir * 0.07, 0, 0.03));
    pivot.add(handle);
    pivot.add(at(box(0.07, 0.2, 0.01, b), hx, h * 0.47 - 0.05, t / 2 + 0.005));
    const back = handle.clone(); back.position.z = -t / 2 - 0.02; back.rotation.y = Math.PI; pivot.add(back);

    return {
      pivot, leaf, handle, w, h,
      set(k) { pivot.rotation.y = dir * k * max; },
      get k() { return pivot.rotation.y / (dir * max); }
    };
  }

  function doorFrame(w, h, m, depth = 0.3) {
    const g = new THREE.Group(), tw = 0.16;
    g.add(at(box(tw, h + tw, depth, m), -w / 2 - tw / 2, (h + tw) / 2, 0));
    g.add(at(box(tw, h + tw, depth, m), w / 2 + tw / 2, (h + tw) / 2, 0));
    g.add(at(box(w + tw * 2, tw, depth, m), 0, h + tw / 2, 0));
    g.add(at(box(w + tw * 2 + 0.24, 0.1, depth + 0.1, m), 0, h + tw + 0.05, 0));
    return g;
  }

  // A box you see through an open doorway: dark, or lit by warm candlelight.
  function doorway(w, h, depth = 2.2, kind = 'dark') {
    const tex = kind === 'warm' ? T().windowPane('warm') : null;
    const m = new THREE.MeshBasicMaterial({ color: kind === 'warm' ? 0x8a4a22 : 0x020203, map: tex, side: THREE.BackSide });
    const b = box(w + 0.02, h, depth, m);
    b.position.set(0, h / 2, -depth / 2);
    return b;
  }

  /* ---------- atmosphere ---------- */
  function fogLayer({ count = 18, w = 20, d = 20, x = 0, z = 0, y = 0.5, size = 6, color = 0xa9b3c6, opacity = 0.22, speed = 0.12, spread = 0.6 } = {}) {
    const group = new THREE.Group(), items = [];
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T().fog(), color, transparent: true, opacity, depthWrite: false }));
      const sc = size * (0.7 + Math.random() * 0.7);
      s.scale.set(sc, sc * 0.55, 1);
      const bx = x + (Math.random() - 0.5) * w, bz = z + (Math.random() - 0.5) * d;
      s.position.set(bx, y + Math.random() * spread, bz);
      s.material.rotation = Math.random() * TAU;
      group.add(s);
      items.push({ s, bx, bz, ph: Math.random() * TAU, sp: speed * (0.5 + Math.random()) });
    }
    return {
      group, items, opacity,
      update(t) {
        for (const it of items) {
          it.s.position.x = it.bx + Math.sin(t * it.sp + it.ph) * w * 0.07;
          it.s.position.z = it.bz + Math.cos(t * it.sp * 0.7 + it.ph) * d * 0.05;
          it.s.material.rotation += 0.0006;
        }
      }
    };
  }

  function dust({ count = 260, w = 10, h = 5, d = 10, x = 0, y = 2.5, z = 0, color = 0xd8c8a8, size = 0.035, opacity = 0.45 } = {}) {
    const pos = new Float32Array(count * 3), base = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      base[i * 3] = x + (Math.random() - 0.5) * w; base[i * 3 + 1] = y + (Math.random() - 0.5) * h; base[i * 3 + 2] = z + (Math.random() - 0.5) * d;
    }
    pos.set(base);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      size, color, map: T().glow(), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    return {
      points,
      update(t) {
        for (let i = 0; i < count; i++) {
          pos[i * 3] = base[i * 3] + Math.sin(t * 0.13 + i) * 0.3;
          pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.09 + i * 1.7) * 0.25;
          pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.11 + i * 0.7) * 0.3;
        }
        geo.attributes.position.needsUpdate = true;
      }
    };
  }

  function cobweb(size = 1.2) {
    const m = new THREE.MeshBasicMaterial({ map: T().cobweb(), transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(size, size); geo.translate(size / 2, -size / 2, 0);
    return new THREE.Mesh(geo, m); // origin at the web's anchored corner
  }

  /* ---------- the creature ---------- */
  function creature() {
    const g = new THREE.Group();
    const skin = mat({ color: 0x15130f, roughness: 0.6 });
    const rag = mat({ color: 0x050505, roughness: 1, side: THREE.DoubleSide });
    g.add(at(cyl(0.2, 0.11, 1.1, skin, 8), 0, 1.6, 0.05, 0.18));
    g.add(at(cyl(0.035, 0.05, 0.3, skin, 6), 0, 2.2, 0.15, 0.4));
    const head = new THREE.Group(); head.position.set(0, 2.38, 0.24); g.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), skin); skull.scale.set(0.85, 1.3, 1); head.add(skull);
    head.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0x000000 })), 0, -0.12, 0.12, 0, 0, 0));
    const eyes = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff6e0 }));
      e.position.set(s * 0.06, 0.04, 0.14); head.add(e);
      const gl = glowSprite(0xffe9c0, 0.28, 0.9); gl.position.copy(e.position); gl.position.z += 0.02; head.add(gl);
      eyes.push(e, gl);
    }
    for (const s of [-1, 1]) g.add(at(cyl(0.05, 0.035, 1.05, skin, 6), s * 0.11, 0.52, 0, 0, 0, s * 0.04));
    const arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(s * 0.25, 2.05, 0.1); g.add(sh);
      const up = cyl(0.04, 0.03, 0.8, skin, 6); up.geometry.translate(0, -0.4, 0); sh.add(up);
      const el = new THREE.Group(); el.position.y = -0.8; sh.add(el);
      const fo = cyl(0.03, 0.022, 0.85, skin, 6); fo.geometry.translate(0, -0.42, 0); el.add(fo);
      for (let f = 0; f < 4; f++) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.3, 4), skin);
        fin.geometry.translate(0, -0.15, 0); fin.position.set((f - 1.5) * 0.022, -0.85, 0); fin.rotation.z = (f - 1.5) * 0.12; el.add(fin);
      }
      sh.rotation.z = s * 0.18; sh.rotation.x = -0.15; el.rotation.x = -0.2;
      arms.push({ sh, el, s });
    }
    for (let i = 0; i < 7; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.9 + Math.random() * 0.6), rag);
      p.position.set((Math.random() - 0.5) * 0.4, 1.3, (Math.random() - 0.5) * 0.3 + 0.05); p.rotation.y = Math.random() * TAU; g.add(p);
    }
    let reach = 0, pitch = 0;
    return {
      group: g, head,
      setEyes(v) { eyes.forEach(e => { if (e.material.opacity !== undefined) { e.material.transparent = true; e.material.opacity = v; } }); },
      setReach(v) { reach = v; },
      setPitch(v) { pitch = v; },   // tilt the head back (negative) e.g. to look up while crawling
      update(t) {
        head.rotation.z = Math.sin(t * 0.7) * 0.15 + (Math.random() < 0.02 ? (Math.random() - 0.5) * 0.6 : 0);
        head.rotation.x = 0.15 + pitch + Math.sin(t * 0.5) * 0.05;
        arms.forEach(a => {
          a.sh.rotation.x = -0.15 - reach * 1.3 + Math.sin(t * 1.3 + a.s) * 0.06;
          a.sh.rotation.z = a.s * (0.18 + reach * 0.25);
          a.el.rotation.x = -0.2 - reach * 0.4 + Math.sin(t * 2.1 + a.s) * 0.05;
        });
      }
    };
  }

  // A soft silhouette that slides across walls.
  function shadowFigure(h = 2.6) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.filter = 'blur(6px)'; g.fillStyle = '#000';
    g.beginPath(); g.ellipse(70, 40, 18, 24, 0.2, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(50, 60); g.quadraticCurveTo(100, 70, 92, 140); g.lineTo(96, 250); g.lineTo(40, 250); g.lineTo(38, 140); g.quadraticCurveTo(30, 80, 50, 60); g.fill();
    g.beginPath(); g.moveTo(88, 80); g.quadraticCurveTo(122, 140, 116, 200); g.lineTo(108, 200); g.quadraticCurveTo(108, 140, 82, 100); g.fill();
    // Black figure; its alpha comes from the drawing. Fade it in with material.opacity.
    const m = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: 0x000000, transparent: true, opacity: 0, depthWrite: false });
    return new THREE.Mesh(new THREE.PlaneGeometry(h * 0.5, h), m);
  }

  /* ---------- decor ---------- */
  function painting({ w = 1.1, h = 1.4, seed = 1, frame = 0x6a5222 } = {}) {
    const g = new THREE.Group(), fm = mat({ color: frame, metalness: 0.6, roughness: 0.45 }), fw = 0.12;
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat({ map: T().portrait(seed), roughness: 0.55 })), 0, 0, 0.03));
    g.add(at(box(w + fw * 2, fw, 0.08, fm), 0, h / 2 + fw / 2, 0.03));
    g.add(at(box(w + fw * 2, fw, 0.08, fm), 0, -h / 2 - fw / 2, 0.03));
    g.add(at(box(fw, h, 0.08, fm), -w / 2 - fw / 2, 0, 0.03));
    g.add(at(box(fw, h, 0.08, fm), w / 2 + fw / 2, 0, 0.03));
    // Eye positions match where HH.Tex.portrait() paints them (x 113 & 143 of 256, y 128 of 320).
    const eyes = [113, 143].map(px => {
      const s = glowSprite(0xff2a10, 0.16 * w, 0); s.position.set((px / 256 - 0.5) * w, (0.5 - 128 / 320) * h, 0.06); g.add(s); return s;
    });
    return { group: g, setEyes(v) { eyes.forEach(e => { e.material.opacity = v; }); } };
  }

  function windowFrame({ w = 1.3, h = 2.4, kind = 'cold', frame = null } = {}) {
    const g = new THREE.Group(), fm = frame || mat({ color: 0x15100c }), fw = 0.1;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: T().windowPane(kind), toneMapped: false }));
    g.add(pane);
    g.add(at(box(w + fw * 2, fw, 0.15, fm), 0, h / 2 + fw / 2, 0.02));
    g.add(at(box(w + fw * 2 + 0.2, fw * 1.4, 0.25, fm), 0, -h / 2 - fw / 2, 0.06));
    g.add(at(box(fw, h, 0.15, fm), -w / 2 - fw / 2, 0, 0.02));
    g.add(at(box(fw, h, 0.15, fm), w / 2 + fw / 2, 0, 0.02));
    g.add(at(box(0.05, h, 0.06, fm), 0, 0, 0.02));
    g.add(at(box(w, 0.05, 0.06, fm), 0, h * 0.18, 0.02));
    return { group: g, pane };
  }

  function chandelier(rig, drop = 2) {
    const g = new THREE.Group(), m = brass();
    g.add(at(cyl(0.02, 0.02, drop, iron(), 6), 0, -drop / 2, 0));
    const body = new THREE.Group(); body.position.y = -drop; g.add(body);
    body.add(at(cyl(0.08, 0.16, 0.5, m, 10), 0, -0.1, 0));
    body.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), m), 0, -0.45, 0));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.03, 6, 32), m); ring.rotation.x = Math.PI / 2; ring.position.y = -0.35; body.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.025, 6, 24), m); ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.05; body.add(ring2);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU, x = Math.cos(a) * 0.85, z = Math.sin(a) * 0.85;
      const arm = box(0.85, 0.025, 0.025, m); arm.position.set(x / 2, -0.35, z / 2); arm.rotation.y = -a; body.add(arm);
      body.add(at(cyl(0.05, 0.03, 0.06, m, 8), x, -0.32, z));
      body.add(at(candle(rig, { h: 0.16 + Math.random() * 0.1, r: 0.022 }), x, -0.29, z));
    }
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU + 0.3, x = Math.cos(a) * 0.45, z = Math.sin(a) * 0.45;
      body.add(at(candle(rig, { h: 0.14 + Math.random() * 0.08, r: 0.02 }), x, 0.08, z));
    }
    const web = cobweb(0.9); web.position.set(0.05, 0.1, 0); web.rotation.y = 0.6; body.add(web);
    const light = new THREE.PointLight(0xffa04a, 1.7, 24, 1.6); light.position.y = -0.2; body.add(light);
    rig.light(light, { amt: 0.22 });
    return { group: g, body, light };
  }

  function grandfatherClock() {
    const g = new THREE.Group();
    const wm = mat({ map: HH.Tex.tiled(T().wood(4, '#2a160c', 3), 0.5, 1), roughness: 0.6 });
    g.add(at(box(0.6, 1.5, 0.42, wm), 0, 0.75, 0));
    g.add(at(box(0.72, 0.12, 0.5, wm), 0, 0.06, 0));
    g.add(at(box(0.72, 0.65, 0.48, wm), 0, 1.85, 0));
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 3, 1), wm);
    ped.rotation.set(Math.PI / 2, 0, Math.PI / 2); ped.scale.set(1, 1, 0.5); ped.position.set(0, 2.28, 0); g.add(ped);
    g.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.24, 32), mat({ map: T().clockFace(), roughness: 0.4 })), 0, 1.86, 0.245));
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.4, 1.0), new THREE.MeshBasicMaterial({ color: 0x050302 })), 0, 0.85, 0.212));
    const pendulum = new THREE.Group(); pendulum.position.set(0, 1.4, 0.23); g.add(pendulum);
    const b = brass();
    pendulum.add(at(box(0.02, 0.75, 0.01, b), 0, -0.375, 0));
    pendulum.add(at(cyl(0.09, 0.09, 0.02, b, 20), 0, -0.78, 0, Math.PI / 2));
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.02), new THREE.MeshStandardMaterial({ color: 0x223040, transparent: true, opacity: 0.15, roughness: 0.05, metalness: 0.8 })), 0, 0.85, 0.25));
    return { group: g, pendulum, update(t) { pendulum.rotation.z = Math.sin(t * Math.PI) * 0.16; } };
  }

  // Bake a hierarchy of meshes into one mesh (one draw call).
  function merge(group, material) {
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), rel = new THREE.Matrix4();
    const pos = [], nor = [], uv = [], idx = [];
    group.traverse(o => {
      if (!o.isMesh) return;
      const g = o.geometry.clone().applyMatrix4(rel.multiplyMatrices(inv, o.matrixWorld));
      const base = pos.length / 3;
      pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array);
      if (g.index) for (const i of g.index.array) idx.push(i + base);
      g.dispose();
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    return new THREE.Mesh(geo, material);
  }

  let barkMat = null;
  function deadTree(seed = 1, scale = 1) {
    const r = T().rng(seed), g = new THREE.Group();
    const m = barkMat || (barkMat = mat({ map: T().bark(), color: 0x6a625a, roughness: 1 }));
    function branch(parent, len, rad, depth) {
      const geo = new THREE.CylinderGeometry(rad * 0.6, rad, len, 6); geo.translate(0, len / 2, 0);
      const b = new THREE.Mesh(geo, m); parent.add(b);
      if (depth === 0) return;
      const n = 2 + (depth > 2 && r() < 0.35 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const c = new THREE.Group();
        c.position.y = len * (0.55 + r() * 0.4);
        c.rotation.set((r() - 0.5) * 1.1, r() * TAU, (r() - 0.5) * 1.5);
        b.add(c);
        branch(c, len * (0.55 + r() * 0.25), rad * 0.6, depth - 1);
      }
    }
    branch(g, 3.4 * scale, 0.3 * scale, 4);
    const tree = merge(g, m);
    tree.castShadow = true;
    tree.rotation.z = (r() - 0.5) * 0.15;
    return tree;
  }

  function gravestone(seed = 1) {
    const r = T().rng(seed), g = new THREE.Group();
    const m = mat({ map: T().stone('#55534e', 5, 128), roughness: 0.95 });
    const kind = Math.floor(r() * 3);
    if (kind === 0) {
      g.add(at(box(0.7, 0.9, 0.16, m), 0, 0.45, 0));
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.16, 16, 1, false, 0, Math.PI), m);
      top.rotation.set(Math.PI / 2, Math.PI / 2, 0); top.position.y = 0.9; g.add(top);
    } else if (kind === 1) {
      g.add(at(box(0.16, 1.3, 0.14, m), 0, 0.65, 0));
      g.add(at(box(0.7, 0.16, 0.14, m), 0, 0.95, 0));
    } else {
      g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.26, 1.5, 4), m), 0, 0.75, 0, 0, Math.PI / 4));
    }
    g.rotation.set((r() - 0.5) * 0.25, (r() - 0.5) * 0.6, (r() - 0.5) * 0.25);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  function fence(x0, x1, z, h = 1.8) {
    const g = new THREE.Group(), m = iron(), step = 0.22, n = Math.floor((x1 - x0) / step);
    const bars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, h, 5), m, n);
    const tips = new THREE.InstancedMesh(new THREE.ConeGeometry(0.04, 0.16, 4), m, n);
    const d = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const lean = (Math.sin(i * 1.7) * 0.5 + Math.sin(i * 0.31)) * 0.04;
      d.position.set(x0 + i * step, h / 2, z); d.rotation.set(lean, 0, lean * 0.5); d.updateMatrix(); bars.setMatrixAt(i, d.matrix);
      d.position.y = h + 0.06; d.updateMatrix(); tips.setMatrixAt(i, d.matrix);
    }
    g.add(bars, tips);
    g.add(at(box(x1 - x0, 0.04, 0.04, m), (x0 + x1) / 2, h * 0.88, z));
    g.add(at(box(x1 - x0, 0.04, 0.04, m), (x0 + x1) / 2, 0.25, z));
    return g;
  }

  /* ---------- the ghost (quizmaster, cellar keeper) ---------- */
  // A translucent fresnel-glow spirit that floats at `home`, faces the camera,
  // and can appear, rejoice, rage and vanish. Add .group to a scene and call
  // update(t, dt) every frame.
  function ghost(home) {
    const U = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x7fffe6) }, uOpacity: { value: 1 }, uAppear: { value: 0 } };
    const M = new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          vec3 p = position;
          float low = clamp(-p.y * 0.6, 0.0, 1.0);
          p.x += sin(uTime * 2.3 + p.y * 5.0 + p.z * 3.0) * 0.09 * low;
          p.z += cos(uTime * 1.9 + p.y * 4.0 + p.x * 3.0) * 0.09 * low;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = p;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uOpacity; uniform float uAppear; uniform float uTime;
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main() {
          float n = hash(floor(vP * 18.0));
          if (n > uAppear) discard;
          float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
          float bottom = smoothstep(-1.25, -0.2, vP.y);
          float flick = 0.85 + 0.15 * sin(uTime * 13.0 + vP.y * 9.0);
          gl_FragColor = vec4(uColor * (0.35 + fres * 1.4), (0.18 + fres * 0.85) * uOpacity * bottom * flick);
        }`
    });
    const group = new THREE.Group();
    const body = new THREE.Group(); group.add(body);
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.3, 32, 14, true), M); robe.position.y = -0.55; body.add(robe);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 18), M); head.scale.set(0.9, 1.15, 0.95); head.position.y = 0.82; body.add(head);
    const hollow = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 });
    [-0.1, 0.1].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), hollow); e.scale.set(1, 1.4, 0.5); e.position.set(x, 0.86, 0.25); body.add(e); });
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), hollow); mouth.scale.set(1, 1, 0.4); mouth.position.set(0, 0.66, 0.26); body.add(mouth);
    const arms = [-1, 1].map(s => {
      const a = new THREE.Mesh(new THREE.ConeGeometry(0.09, 1.0, 10, 6, true), M);
      a.geometry.translate(0, -0.5, 0); a.position.set(s * 0.42, 0.45, 0.05); body.add(a); return a;
    });
    const aura = glowSprite(0x60ffe0, 3.2, 0); aura.position.y = 0.2; group.add(aura);
    const light = new THREE.PointLight(0x50ffd8, 0, 7, 1.6); light.position.set(0, 0.6, 0.8); group.add(light);

    const G = { home: home.clone(), pos: home.clone(), appear: 0, rage: 0, mouth: 0, recoil: 0, bow: 0 };
    const calm = new THREE.Color(0x7fffe6), angry = new THREE.Color(0xff2a2a), joy = new THREE.Color(0xfff0b0);
    let mood = calm;
    const tw = (dur, fn, ease) => HH.Tween.add({ dur, update: fn, ease });
    group.position.copy(G.home);

    return {
      group, state: G,
      // Materialise right in front of the camera, then drift back home.
      async appear(quick) {
        const r = HH.World.rig, f = new THREE.Vector3().subVectors(r.look, r.pos).setY(0).normalize();
        G.pos.set(r.pos.x + f.x * 2.2, 1.6, r.pos.z + f.z * 2.2);
        mood = calm; G.rage = 0; G.bow = 0; G.recoil = 0;
        HH.Audio.sfx.shriek(0.35); HH.Audio.sfx.whoosh(0.5);
        await tw(quick ? 0.7 : 1.6, k => { G.appear = k; }, 'out');
        HH.Audio.sfx.whisper(0.4, 0);
        const p0 = G.pos.clone();
        await tw(quick ? 0.9 : 2.2, k => { G.pos.lerpVectors(p0, G.home, k); }, 'inOut');
      },
      async happy() {
        mood = joy;
        HH.Audio.sfx.shriek(0.45);
        await tw(0.5, k => { G.recoil = k; G.mouth = k; }, 'out');
        await tw(1.4, k => { G.mouth = 1 - k; G.bow = k; }, 'inOut');
      },
      // Turns red, swells and screams at the camera; `onPeak` runs before it drifts back.
      async rage(onPeak) {
        mood = angry;
        HH.Audio.sfx.shriek(0.9); HH.World.shake(0.6);
        const p0 = G.pos.clone(), r = HH.World.rig, near = new THREE.Vector3().lerpVectors(p0, r.pos, 0.55).setY(1.8);
        await tw(0.6, k => { G.rage = k; G.mouth = k; G.pos.lerpVectors(p0, near, k); }, 'out');
        await HH.Cine.wait(1.2);
        if (onPeak) onPeak();
        await tw(1.2, k => { G.pos.lerpVectors(near, G.home, k); G.mouth = 1 - k; }, 'inOut');
      },
      // Back to its calm self after rejoicing or raging.
      calm() {
        mood = calm;
        const r0 = G.rage, b0 = G.bow, c0 = G.recoil;
        return tw(0.8, k => { G.rage = r0 * (1 - k); G.bow = b0 * (1 - k); G.recoil = c0 * (1 - k); }, 'inOut');
      },
      vanish() { return tw(1.5, k => { G.appear = 1 - k; }, 'in'); },
      reset() { G.appear = 0; G.rage = 0; G.mouth = 0; G.recoil = 0; G.bow = 0; mood = calm; G.pos.copy(G.home); },
      update(t, dt) {
        U.uTime.value = t;
        U.uAppear.value = G.appear;
        U.uColor.value.lerp(mood, Math.min(1, dt * 3));
        group.visible = G.appear > 0.001;
        group.position.set(G.pos.x + Math.sin(t * 0.7) * 0.08, G.pos.y + Math.sin(t * 1.3) * 0.12, G.pos.z);
        group.lookAt(HH.World.camera.position.x, group.position.y, HH.World.camera.position.z);
        body.scale.setScalar(1 + G.rage * 0.45 - G.recoil * 0.12);
        body.rotation.x = G.bow * 0.45 - G.recoil * 0.25;
        arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * (0.25 + Math.sin(t * 1.1 + i) * 0.12 + G.rage * 0.9); a.rotation.x = -G.rage * 0.6; });
        hollow.opacity = G.appear;
        mouth.scale.set(1 + G.mouth * 0.4, 1 + G.mouth * 2.6, 0.4);
        aura.material.color.copy(U.uColor.value);
        aura.material.opacity = G.appear * 0.35;
        light.color.copy(U.uColor.value);
        light.intensity = G.appear * (1.2 + G.rage * 1.5);
      }
    };
  }

  return {
    ghost,
    mat, box, cyl, at, brass, iron, LightRig, glowSprite, candle, candelabra,
    door, doorFrame, doorway, fogLayer, dust, cobweb, creature, shadowFigure,
    painting, windowFrame, chandelier, grandfatherClock, deadTree, gravestone, fence
  };
})();
