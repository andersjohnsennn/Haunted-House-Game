/* ==========================================================================
   Cinematics. HH.Cine holds the camera / screen helpers; HH.Cutscenes holds
   every named cutscene the mansion data can reference.

   A cutscene is: async function (ctx) { ... }
     ctx.team    the active team's state
     ctx.from    location the team is leaving
     ctx.to      destination location (safe choices) or null
     ctx.choice  the choice that was picked (null for arrivals)
     ctx.loc     location being arrived at (arrival / resume cutscenes)
   Cutscenes that move to another set call HH.World.use(ctx.to.scene)
   themselves while the screen is dark.
   ========================================================================== */

window.HH = window.HH || {};

HH.Cine = (function () {
  const $ = id => document.getElementById(id);
  const R = () => HH.World.rig;
  const v3 = a => (a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));
  const wait = s => HH.Tween.wait(s);
  const tween = (dur, fn, ease = 'inOut') => HH.Tween.add({ dur, update: fn, ease });

  // Glide the camera. `walk` adds head-bob and footsteps of that surface.
  function move({ pos, look, dur = 2, ease = 'inOut', walk = null, rate = 1.7 }) {
    const r = R(), p0 = r.pos.clone(), l0 = r.look.clone();
    const p1 = pos ? v3(pos) : p0.clone(), l1 = look ? v3(look) : l0.clone();
    if (walk) { r.steps = walk; r.stepRate = rate; }
    return tween(dur, (k, raw) => {
      r.pos.lerpVectors(p0, p1, k);
      r.look.lerpVectors(l0, l1, k);
      if (walk) r.walk = Math.min(1, Math.min(raw, 1 - raw) * 6);
    }, ease).then(() => { if (walk) { r.walk = 0; r.steps = null; } });
  }

  const look = (target, dur = 1, ease = 'inOut') => move({ look: target, dur, ease });

  // The newest fade wins: an older one still running stops touching the screen.
  let fadeSeq = 0;
  function fade(to, dur = 1) {
    const el = $('fx-fade'), from = parseFloat(el.style.opacity || 0), seq = ++fadeSeq;
    return tween(dur, k => { if (seq === fadeSeq) el.style.opacity = (from + (to - from) * k).toFixed(3); }, 'linear');
  }
  function black(on) { fadeSeq++; $('fx-fade').style.opacity = on ? 1 : 0; }

  function hit(strength = 1, color = '#fff', ms = 600) {
    const el = $('fx-hit');
    el.style.transition = 'none'; el.style.background = color; el.style.opacity = strength;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = `opacity ${ms}ms ease-out`; el.style.opacity = 0; }));
  }

  function letterbox(on) { document.body.classList.toggle('cinema', on); }

  // Eyelids: 0 open, 1 shut. blink() shuts them for a moment and opens again.
  function lids(k) {
    const el = $('fx-lids'), off = (125 * (1 - k)).toFixed(1);
    el.children[0].style.transform = `translateY(-${off}%)`;
    el.children[1].style.transform = `translateY(${off}%)`;
  }
  async function blink(close = 0.08, hold = 0.05, open = 0.14) {
    await tween(close, lids, 'in');
    await wait(hold);
    await tween(open, k => lids(1 - k), 'out');
  }

  async function title(kicker, name, sub, hold = 3) {
    const el = $('titlecard');
    el.querySelector('.kicker').textContent = kicker || '';
    el.querySelector('h2').textContent = name;
    el.querySelector('p').textContent = sub || '';
    el.classList.add('show');
    await wait(hold);
    el.classList.remove('show');
    await wait(0.7);
  }

  // Full-screen demon face, glitching and strobing. Real time, so skipping can't cut it short.
  function jumpscare(dur = 1.2) {
    const cv = $('jumpscare'), g = cv.getContext('2d'), face = HH.Tex.faceCanvas();
    cv.width = window.innerWidth; cv.height = window.innerHeight;
    cv.style.display = 'block';
    const t0 = performance.now();
    return new Promise(res => {
      function frame(now) {
        const k = Math.min(1, (now - t0) / 1000 / dur), w = cv.width, h = cv.height;
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        const s = Math.max(w, h) * (0.8 + k * 0.7) * (1 + (Math.random() - 0.5) * 0.08);
        const x = (w - s) / 2 + (Math.random() - 0.5) * 50, y = (h - s) / 2 + s * 0.06 + (Math.random() - 0.5) * 50;
        g.drawImage(face, x, y, s, s);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35;
        g.drawImage(face, x + 14, y - 6, s, s);
        g.globalCompositeOperation = 'multiply'; g.globalAlpha = 1;
        g.fillStyle = Math.random() < 0.5 ? '#ff5050' : '#ffd0c0'; g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 6; i++) {
          const sy = Math.random() * h, sh = 8 + Math.random() * 60;
          g.drawImage(cv, 0, sy, w, sh, (Math.random() - 0.5) * 120, sy, w, sh);
        }
        cv.style.filter = Math.random() < 0.12 ? 'invert(1)' : 'none';
        if (k < 1) requestAnimationFrame(frame);
        else { black(true); cv.style.display = 'none'; cv.style.filter = 'none'; res(); }
      }
      requestAnimationFrame(frame);
    });
  }

  return { move, look, fade, black, hit, letterbox, lids, blink, title, jumpscare, wait, tween, v3 };
})();

HH.Cutscenes = (function () {
  const C = HH.Cine, W = HH.World, A = HH.Audio;
  const { move, look, fade, wait, tween } = C;
  const R = () => W.rig;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  /* ---------- shared pieces ---------- */
  const flat = (a, b) => V(b.x - a.x, 0, b.z - a.z);
  const fwdOf = r => flat(r.pos, r.look).normalize();

  // Walk until `stop` metres short of the anchor, looking at it.
  async function approach(a, stop = 1.8, surface = 'wood') {
    const r = R(), dir = flat(r.pos, a), dist = dir.length();
    dir.normalize();
    const go = Math.max(0, dist - stop);
    await move({ pos: V(r.pos.x + dir.x * go, 1.7, r.pos.z + dir.z * go), look: [a.x, Math.max(1.2, a.y), a.z], dur: Math.max(1.4, go / 1.4), walk: go > 0.3 ? surface : null });
  }

  async function openPortal(s, name, k = 0.85, dur = 2.2) {
    const d = s.doorAt && s.doorAt[name];
    if (!d) return;
    if (!d.silent) A.sfx.doorOpen(dur);
    await tween(dur, x => d.set(x * k));
  }

  // Every death ends the same way: the demon lunges, the face, black.
  async function lunge(s) {
    const r = R(), D = HH.Demon, c = D.creature, f = fwdOf(r);
    D.pose('stand');
    c.setReach(1);
    const p0 = D.root.position.clone();
    const target = V(r.pos.x + f.x * 0.55, r.pos.y - 2.3, r.pos.z + f.z * 0.55);
    D.face(r.pos);
    if (s.lights) { s.lights.chaos = 0; s.lights.darkness = Math.min(s.lights.darkness, 0.45); }
    A.sfx.scream(1);
    tween(0.32, k => D.root.position.lerpVectors(p0, target, k), 'in');
    tween(0.32, k => { r.fovKick = -14 * k; }, 'in');
    look([target.x, r.pos.y, target.z], 0.25, 'out');
    await wait(0.28);
    W.shake(1);
    await C.jumpscare(1.25);
    r.fovKick = 0;
    A.heartbeat(0);
    D.leave();
    if (s.lights) { s.lights.darkness = 0; s.lights.chaos = 0; }
    if (s.setPaintingEyes) s.setPaintingEyes(0);
  }

  // Fade out, switch to the next location's set and glide in from behind its home spot.
  async function enterNext(toLoc, surface = 'wood') {
    const r = R(), next = W.use(toLoc.scene), h = next.home;
    r.pos.copy(h.pos).addScaledVector(flat(h.look, h.pos).normalize(), 1.2);
    r.look.copy(h.look);
    fade(0, 1);
    await move({ pos: h.pos, dur: 1.6, walk: surface });
  }

  // Pan across a set's named anchors, then settle home.
  async function pan(s, names, hold = 0.5) {
    for (const n of names) {
      const a = s.anchors[n];
      if (!a) continue;
      await move({ look: [a.x, a.y, a.z], dur: 1.6 });
      await wait(hold);
    }
    await move({ look: s.home.look, dur: 1.4 });
  }

  // Walk into a challenge room's playing position.
  async function toView(s, dur = 4, surface = 'wood') {
    if (!s.view) return;
    await move({ pos: s.view.pos, look: s.view.look, dur, walk: surface, rate: 1.4 });
  }

  const cutscenes = {
    /* ---------- outside -> through the front door -> entrance hall ---------- */
    async enterMansion(ctx) {
      if (ctx.quick) return cutscenes.enterMansionQuick(ctx);
      const ext = W.use('exterior'), r = R();
      ext.idle = false;
      C.black(true);
      r.pos.set(0, 1.75, 31); r.look.set(0, 6.5, -20);
      C.letterbox(true);
      await fade(0, 1.6);
      W.lightning(1);
      await move({ pos: [0, 1.75, 12], look: [0, 5, -20], dur: 7.5, walk: 'grass', rate: 1.6, ease: 'sine' });
      await move({ pos: [0, 1.75, -12.8], look: [0, 3.4, -20], dur: 6.5, walk: 'stone', rate: 1.6, ease: 'sine' });
      await move({ pos: [0, 2.75, -16.8], look: [0, 2.9, -20], dur: 2.2, walk: 'wood', rate: 1.4, ease: 'sine' });
      await wait(1.0);
      A.sfx.doorOpen(3.4);
      await tween(3.4, k => ext.door.set(k * 0.95));
      A.sfx.whisper(0.3, 0);
      await wait(0.7);
      fade(1, 2.0);
      await move({ pos: [0, 2.75, -21.2], look: [0, 2.7, -26], dur: 2.6, walk: 'wood', rate: 1.3, ease: 'in' });

      // Inside. The candles are barely alive; the door is still open behind us.
      const hall = W.use(ctx.to.scene);
      hall.lights.darkness = 0.85;
      hall.frontDoor.set(-0.95);
      r.pos.set(0, 1.7, -0.25); r.look.set(0, 1.9, -10);
      fade(0.35, 0.8);
      await move({ pos: [0, 1.7, -2.6], dur: 1.9, walk: 'wood', rate: 1.3 });
      await wait(0.5);
      await tween(0.28, k => hall.frontDoor.set(-0.95 * (1 - k)), 'in');
      A.sfx.slam(1.2); W.shake(0.85); C.hit(0.35, '#000', 300);
      hall.lights.darkness = 1;
      await fade(0, 0.2);
      await move({ look: [0.4, 1.9, 0.5], dur: 0.55, ease: 'out' });
      A.heartbeat(70);
      await wait(1.5);
      A.heartbeat(0);
      W.lightning(0.9);
      A.sfx.whoosh(0.5);
      tween(3, k => { hall.lights.darkness = 1 - k; });
      await move({ look: [6, 2.2, -4], dur: 1.2, ease: 'in' });
      await move({ pos: hall.home.pos, look: hall.home.look, dur: 2.4, ease: 'out' });
      A.sfx.bell(98, 0.45);
    },

    // Seen it before: start on the porch, straight through the door, slam, done.
    async enterMansionQuick(ctx) {
      const ext = W.use('exterior'), r = R();
      ext.idle = false;
      // From the gate straight to the porch: cut through black, never a visible jump.
      C.black(true);
      r.pos.set(0, 2.75, -15.6); r.look.set(0, 2.9, -20);
      C.letterbox(true);
      await fade(0, 0.8);
      A.sfx.doorOpen(1.6);
      await tween(1.6, k => ext.door.set(k * 0.95));
      fade(1, 1.0);
      await move({ pos: [0, 2.75, -21.2], look: [0, 2.7, -26], dur: 1.4, walk: 'wood', ease: 'in' });
      const hall = W.use(ctx.to.scene);
      hall.lights.darkness = 0.6;
      hall.frontDoor.set(-0.95);
      r.pos.set(0, 1.7, -0.25); r.look.copy(hall.home.look);
      fade(0, 0.6);
      await move({ pos: [0, 1.7, -1.6], dur: 1.0, walk: 'wood' });
      await tween(0.25, k => hall.frontDoor.set(-0.95 * (1 - k)), 'in');
      A.sfx.slam(1.1); W.shake(0.7);
      tween(1.4, k => { hall.lights.darkness = 0.6 * (1 - k); });
      await move({ pos: hall.home.pos, look: hall.home.look, dur: 1.4 });
    },

    /* ---------- entrance hall: the establishing pan ---------- */
    async establishHall() {
      const s = W.current;
      await move({ look: [-6.2, 3.0, -10], dur: 2.4 });
      await move({ look: [-6.2, 5.8, -18.5], dur: 1.8 });
      A.sfx.whisper(0.15, -0.6);
      await wait(0.6);
      await move({ look: [7.9, 1.6, -10], dur: 2.6 });
      await wait(0.6);
      await move({ look: s.home.look, dur: 1.8 });
    },

    /* ---------- WRONG: up the staircase. The demon rushes down at you. ---------- */
    async stairsDeath() {
      const s = W.current, st = s.stairs, r = R(), D = HH.Demon;
      C.letterbox(true);
      await move({ pos: [-3.8, 1.7, -3.4], look: [-6.2, 3.2, -12], dur: 2.6, walk: 'wood' });
      await move({ pos: [-6.2, 1.7, -4.3], look: [-6.2, 4.6, -14], dur: 1.4, walk: 'wood', rate: 1.4 });
      A.heartbeat(62);
      for (let i = 0; i < 9; i++) {
        const y = 1.7 + (i + 1) * st.rise, z = st.z0 - (i + 0.5) * st.run;
        A.sfx.step('stair', 0.5, i % 2 ? 0.2 : -0.2);
        if (i === 3) { s.lights.chaos = 0.3; A.sfx.whisper(0.25); }
        if (i === 6) s.setPaintingEyes(0.9);
        await move({ pos: [-6.2, y, z], look: [-6.2, y + 1.3, -16], dur: 0.65 + i * 0.03 });
      }
      s.lights.chaos = 0.85; A.heartbeat(92);
      await wait(1.1);
      s.lights.chaos = 0; s.lights.darkness = 1;
      A.sfx.creak(1.3, 0.6, 0.3);
      await wait(1.0);

      // It is standing in the doorway at the top.
      D.enter(s);
      D.place(V(-6.2, 4.5, -19.3), r.pos);
      s.lights.darkness = 0.72;
      A.sfx.stinger(0.7); W.shake(0.2);
      await look([-6.2, 6.3, -19], 0.5);
      await wait(1.6);
      s.lights.darkness = 1;
      await wait(0.7);

      // Now it is at the top of the stairs.
      D.place(V(-6.2, 4.5, -14.5), r.pos);
      D.creature.setReach(0.5);
      s.lights.darkness = 0.66;
      A.sfx.whisper(0.45, 0); A.heartbeat(132);
      await look([-6.2, 6.1, -14.5], 0.3);
      await wait(1.1);
      await lunge(s);
    },

    /* ---------- WRONG anywhere else: the same demon, staged for the place ---------- */
    async demonDeath(ctx) {
      const s = W.current, r = R(), D = HH.Demon;
      const name = ctx.choice && ctx.choice.anchor;
      const a = (s.anchors && s.anchors[name]) || V(r.look.x, 1.7, r.look.z);
      const style = (ctx.choice && ctx.choice.demon) || 'lightsOut';
      const kind = s.portalKinds && s.portalKinds[name];
      C.letterbox(true);
      A.heartbeat(60);

      const styles = {
        // Eyes in the dark opening, then it rushes out.
        async doorway() {
          await approach(a, 2.4);
          await openPortal(s, name, 0.85, 2);
          A.sfx.whisper(0.35, 0);
          await wait(0.8);
          const f = fwdOf(r);
          D.enter(s);
          D.place(V(a.x + f.x * 1.3, 0, a.z + f.z * 1.3), r.pos);
          if (s.lights) s.lights.darkness = 0.4;
          A.sfx.stinger(0.6); A.heartbeat(112);
          await look([a.x, 2.0, a.z], 0.4);
          await wait(1.5);
          await lunge(s);
        },

        // The lights die. When they return, it is an arm's length away.
        async lightsOut() {
          await approach(a, 2.8);
          await openPortal(s, name, 0.6, 1.6);
          if (s.lights) s.lights.chaos = 0.8;
          A.heartbeat(92); A.sfx.whisper(0.35);
          await wait(1.4);
          if (s.lights) { s.lights.chaos = 0; s.lights.darkness = 1; }
          A.sfx.creak(1.0, 0.6, 0.25);
          await wait(1.3);
          const f = fwdOf(r);
          D.enter(s);
          D.place(V(r.pos.x + f.x * 2.3, 0, r.pos.z + f.z * 2.3), r.pos);
          if (s.lights) s.lights.darkness = 0.55;
          A.sfx.stinger(0.8); W.shake(0.4);
          await wait(0.55);
          await lunge(s);
        },

        // Something whispers behind you. You turn round.
        async behind() {
          await approach(a, 1.9);
          await openPortal(s, name, 0.6, 1.6);
          if (kind === 'stairsDown') await move({ pos: V(r.pos.x + fwdOf(r).x * 1.1, 1.3, r.pos.z + fwdOf(r).z * 1.1), dur: 1.6, walk: 'stone', rate: 1.2 });
          if (s.showGhost) s.showGhost();
          A.sfx.whisper(0.4, 0);
          await wait(1.3);
          A.sfx.whisper(0.55, -0.9); A.heartbeat(104);
          await wait(0.9);
          const f = fwdOf(r), side = V(-f.z, 0, f.x);
          D.enter(s);
          D.place(V(r.pos.x - f.x * 2.0, 0, r.pos.z - f.z * 2.0), r.pos);
          await look([r.pos.x + side.x * 3, r.pos.y, r.pos.z + side.z * 3], 1.1, 'in');
          A.sfx.stinger(0.85);
          await look([r.pos.x - f.x * 3, r.pos.y + 0.2, r.pos.z - f.z * 3], 0.45, 'out');
          W.shake(0.35);
          await wait(0.35);
          await lunge(s);
        },

        // A creak overhead. Look up. It drops.
        async ceiling() {
          await approach(a, 2.4);
          await openPortal(s, name, 0.8, 1.6);
          A.sfx.creak(1.4, 0.5, 0.3);
          await wait(0.7);
          const f = fwdOf(r), ceil = s.ceiling || 4.2;
          const p = V(r.pos.x + f.x * 1.4, ceil, r.pos.z + f.z * 1.4);
          D.enter(s);
          D.pose('hang');
          D.place(p, r.pos);
          if (s.lights) s.lights.chaos = 0.5;
          A.sfx.whisper(0.4, 0); A.heartbeat(112);
          await look([p.x, Math.max(2.4, ceil - 0.8), p.z], 1.3);
          A.sfx.stinger(0.9);
          await wait(0.8);
          D.pose('stand');
          const top = Math.max(0, ceil - 2.5);
          D.place(V(p.x, top, p.z), r.pos);
          look([p.x, 1.8, p.z], 0.25, 'in');
          await tween(0.25, k => { D.root.position.y = top * (1 - k); }, 'in');
          A.sfx.slam(0.7); W.shake(0.6);
          await wait(0.35);
          await lunge(s);
        },

        // It crawls out of the opening, low and fast.
        async crawl() {
          await approach(a, 3.0);
          await openPortal(s, name, 0.85, 1.8);
          A.sfx.creak(1.0, 1.2, 0.2); A.sfx.whisper(0.3);
          await wait(0.8);
          await look([a.x, 0.3, a.z], 0.9);
          // The crawling body is ~2.3 m long, head first: the root (feet) starts
          // deep in the opening and stops so the head is ~1.4 m from the camera.
          const toCam = flat(a, r.pos).normalize(), dist = flat(a, r.pos).length();
          const p0 = V(a.x - toCam.x * 2.6, 0, a.z - toCam.z * 2.6);
          const endK = Math.max(-0.6, dist - 1.4 - 2.25);
          const p1 = V(a.x + toCam.x * endK, 0, a.z + toCam.z * endK);
          D.enter(s);
          D.pose('crawl');
          D.place(p0, r.pos);
          if (s.lights) s.lights.darkness = 0.35;
          A.sfx.stinger(0.6); A.heartbeat(124);
          const head = () => V(D.root.position.x + toCam.x * 2.25, 0.5, D.root.position.z + toCam.z * 2.25);
          const scrape = setInterval(() => A.sfx.creak(0.3, 1.6, 0.12), 300);
          await tween(2.0, k => { D.root.position.lerpVectors(p0, p1, k); r.look.lerp(head(), 0.08); });
          clearInterval(scrape);
          await wait(0.5);
          await lunge(s);
        }
      };
      await (styles[style] || styles.lightsOut)();
    },

    // Older data may still name this one.
    async genericDeath(ctx) {
      return cutscenes.demonDeath(Object.assign({}, ctx, { choice: Object.assign({ demon: 'lightsOut' }, ctx.choice) }));
    },

    /* ---------- a way out the demon guards (choice.chase) ----------
       ctx.outcome: 'armed'  it charges, the dagger comes up, one thrust and it is gone
                    'caught' it charges, the door won't open (or slams shut), it takes you
                    'clear'  it has already fed: only a distant scream
       The walk through the door afterwards is a separate cutscene. */
    async demonChase(ctx) {
      const s = W.current, r = R(), D = HH.Demon, L = s.lights;
      const name = ctx.choice && ctx.choice.anchor, a = s.anchors[name], door = s.doorAt && s.doorAt[name];
      C.letterbox(true);

      if (ctx.outcome === 'clear') {
        A.heartbeat(72);
        await approach(a, 2.6);
        if (L) L.chaos = 0.35;
        A.sfx.scream(0.12);
        await wait(1.6);
        if (L) L.chaos = 0;
        A.heartbeat(0);
        return;
      }

      // Toward the door. Something whispers behind you.
      A.heartbeat(84);
      await approach(a, 2.8);
      if (L) L.chaos = 0.6;
      A.sfx.whisper(0.5, -0.9);
      await wait(1.0);

      // It is at the far end of the room. Turn round.
      const f = fwdOf(r);
      const p0 = s.anchors.chase ? V(s.anchors.chase.x, 0, s.anchors.chase.z) : V(r.pos.x - f.x * 7, 0, r.pos.z - f.z * 7);
      D.enter(s);
      D.place(p0, r.pos);
      D.creature.setReach(0.4);
      if (L) { L.chaos = 0; L.darkness = 0.5; }
      A.sfx.stinger(0.9); A.heartbeat(140);
      await look([p0.x, 1.9, p0.z], 0.45, 'out');
      W.shake(0.3);
      await wait(0.45);

      // It runs at you.
      A.sfx.scream(0.7);
      const toCam = flat(p0, r.pos).normalize();
      const head = () => V(D.root.position.x, 1.9, D.root.position.z);
      const thuds = setInterval(() => A.sfx.step('stone', 0.9, 0), 190);
      try {
        if (ctx.outcome === 'armed') {
          // Stand and fight: the dagger comes up, it leaps, one thrust.
          const p1 = V(r.pos.x - toCam.x * 2.6, 0, r.pos.z - toCam.z * 2.6);
          HH.Weapon.raise(s);
          await tween(1.2, k => { D.root.position.lerpVectors(p0, p1, k); r.look.lerp(head(), 0.12); }, 'in');
          clearInterval(thuds);
          D.creature.setReach(1);
          A.sfx.scream(1);
          const p2 = V(r.pos.x - toCam.x * 1.0, 0, r.pos.z - toCam.z * 1.0);
          tween(0.2, k => { D.root.position.lerpVectors(p1, p2, k); r.fovKick = -8 * k; }, 'in');
          await wait(0.14);
          HH.Weapon.strike();
          await wait(0.1);
          C.hit(1, '#dcefff', 1100); W.shake(1);
          A.sfx.blade(1); A.sfx.boom(0.9); A.sfx.shriek(0.8);
          D.leave();
          r.fovKick = 0;
          if (L) { L.darkness = 0; L.chaos = 0; }
          A.heartbeat(0);
          await wait(1.4);
          await HH.Weapon.lower();
          await look([a.x, a.y, a.z], 1.2);
          return;
        }

        // Caught: run for the door. An open door slams shut in your face; a shut one won't open.
        const p1 = V(r.pos.x + f.x * 1.3 - f.x * 1.8, 0, r.pos.z + f.z * 1.3 - f.z * 1.8);
        const charge = tween(1.7, k => { D.root.position.lerpVectors(p0, p1, k); }, 'in');
        await wait(0.3);
        if (L) L.darkness = 0.1;
        await look([a.x, 1.7, a.z], 0.3, 'out');
        const run = move({ pos: V(r.pos.x + f.x * 1.3, 1.7, r.pos.z + f.z * 1.3), dur: 0.75, walk: 'wood', rate: 3.2, ease: 'in' });
        if (door && door.k > 0.2) {
          await wait(0.3);
          const k0 = door.k;
          await tween(0.2, k => door.set(k0 * (1 - k)), 'in');
          // The gust from the slam drowns the candles.
          A.sfx.slam(1.2); W.shake(0.7);
          if (L) { L.darkness = 0.6; L.chaos = 0.5; }
          await wait(0.35);
          if (L) L.chaos = 0;
        } else {
          // Locked. Rattle the handle; the candles behind you gutter out.
          await run;
          for (let n = 0; n < 3; n++) {
            A.sfx.handle(); W.shake(0.18);
            if (door) await tween(0.12, k => door.set(0.025 * Math.sin(k * Math.PI)));
            else await wait(0.12);
            await wait(0.08);
          }
          if (L) { L.darkness = 0.6; L.chaos = 0.4; }
          await wait(0.3);
          if (L) L.chaos = 0;
        }
        await charge;
        clearInterval(thuds);
        A.heartbeat(160); A.sfx.whisper(0.6, 0);
        await wait(0.5);
        D.face(r.pos);
        await look(head(), 0.45, 'out');
        await wait(0.2);
        await lunge(s);
      } finally {
        clearInterval(thuds);
      }
    },

    /* ---------- CORRECT: the door on the right ---------- */
    async rightDoorEnter(ctx) {
      const s = W.current, r = R(), d = s.rightDoor;
      C.letterbox(true);
      await move({ pos: [5.5, 1.7, -9.7], look: [8, 1.7, -10], dur: 3.3, walk: 'wood' });
      await wait(0.6);
      A.sfx.whisper(0.25, 0.7);
      await wait(0.9);
      A.sfx.handle();
      await tween(1.3, k => { d.handle.rotation.z = -0.7 * k; });
      A.sfx.doorOpen(3);
      tween(0.4, k => { d.handle.rotation.z = -0.7 * (1 - k); });
      await tween(3, k => d.set(k * 0.85));
      await wait(0.5);
      fade(1, 1.6);
      await move({ pos: [8.7, 1.7, -10], look: [12, 1.7, -10], dur: 2.1, walk: 'wood', ease: 'in' });

      const room = W.use(ctx.to.scene);
      room.entryDoor.set(-0.9);
      room.lights.darkness = 0.3;
      r.pos.set(0, 1.7, -0.3); r.look.copy(room.home.look);
      fade(0, 0.9);
      await move({ pos: room.home.pos, dur: 1.7, walk: 'wood' });
      await wait(0.4);
      await tween(0.25, k => room.entryDoor.set(-0.9 * (1 - k)), 'in');
      A.sfx.slam(1); W.shake(0.6);
      room.lights.darkness = 0.85;
      await wait(0.6);
      A.sfx.whoosh(0.4);
      await tween(1.8, k => { room.lights.darkness = 0.85 * (1 - k); });
    },

    /* ---------- the Cursed Chamber: the establishing pan ---------- */
    async establishChamber() {
      const s = W.current;
      await move({ look: [0, 0.2, -6.5], dur: 2.2 });
      await move({ look: [-3.6, 0.8, -8.3], dur: 2.0 });
      A.sfx.creak(0.8, 1.4, 0.15);
      await wait(0.4);
      await move({ look: [5.9, 2.1, -6], dur: 2.2 });
      s.showGhost(); A.sfx.whisper(0.3, 0.8);
      await wait(1.8);
      await move({ look: [0, 3.0, -11.9], dur: 2.0 });
      await wait(0.6);
      await move({ look: s.home.look, dur: 1.6 });
    },

    /* ---------- junctions: look at each way on ---------- */
    async establishJunction() {
      const s = W.current;
      if (s.onArrive) s.onArrive();
      await pan(s, Object.keys(s.anchors).filter(k => /^p\d+$/.test(k)), 0.4);
    },

    /* ---------- challenge rooms: walk in to the playing position ---------- */
    async establishSacrifice() {
      const s = W.current;
      const kindle = [1.2, 2.2, 3.2].map((t, i) => setTimeout(() => { s.chalice(i, 0.35); A.sfx.whoosh(0.25); }, t * 1000));
      await toView(s, 5, 'stone');
      kindle.forEach(clearTimeout);
      [0, 1, 2].forEach(i => s.chalice(i, 0.35));
      s.figure.setEyes(1);
      A.sfx.whisper(0.3, 0);
      await wait(0.8);
    },

    async establishKnight() {
      const s = W.current;
      await move({ look: [-6, 2.4, -9], dur: 1.8 });
      await move({ look: s.home.look, dur: 1.4 });
      await toView(s, 3.6, 'stone');
      s.knight.wake();
      A.sfx.voice(0.6);
      await wait(1.2);
    },

    async establishLibrary() {
      const s = W.current;
      await move({ look: [-5.5, 3.5, -7], dur: 2.0 });
      await move({ look: [5.5, 3.5, -7], dur: 2.6 });
      A.sfx.whisper(0.25, 0.6);
      await toView(s, 3, 'wood');
    },

    async establishCellar() {
      const s = W.current;
      await move({ look: [-4.5, 1.6, -7], dur: 1.6 });
      A.sfx.whisper(0.2, -0.5);
      await toView(s, 3, 'stone');
    },

    async establishVampire() {
      const s = W.current;
      await move({ look: [-6, 2.6, -8], dur: 1.8 });
      W.lightning(0.7);
      await move({ look: s.home.look, dur: 1.4 });
      await toView(s, 3.4, 'wood');
    },

    /* ---------- generic: walk to the chosen anchor, through its door ---------- */
    async genericWalk(ctx) {
      const s = W.current, r = R(), name = ctx.choice && ctx.choice.anchor;
      const a = s.anchors && s.anchors[name];
      C.letterbox(true);
      if (a) {
        await approach(a, 1.6);
        await openPortal(s, name, 0.85, 2.4);
        fade(1, 1.3);
        const dir = flat(r.pos, a).normalize();
        await move({ pos: V(a.x + dir.x * 1.4, 1.7, a.z + dir.z * 1.4), dur: 1.5, walk: 'wood', ease: 'in' });
      } else {
        await fade(1, 1.2);
      }
      // The way out: the escape scene takes over from black.
      if (ctx.to && ctx.to.type === 'exit') return fade(1, 0.3);
      await enterNext(ctx.to);
    },

    /* ---------- after a challenge: through the door it opened ---------- */
    async throughDoor(ctx) {
      const s = W.current, r = R(), a = s.anchors && s.anchors.exit;
      C.letterbox(true);
      if (a) {
        for (const p of (s.exitVia || [])) await move({ pos: [p.x, 1.7, p.z], look: [a.x, 1.7, a.z], dur: 1.8, walk: 'stone' });
        await approach(a, 1.4, 'stone');
        // Normally the challenge already opened it; after a host "force success" it may not have.
        const d = s.doorAt && s.doorAt.exit;
        if (d && d.unlock && !d.unlocked) await d.unlock();
        if (d && d.k !== undefined && d.k < 0.5) await openPortal(s, 'exit', 1, 1.6);
        fade(1, 1.3);
        const dir = flat(r.pos, a).normalize();
        await move({ pos: V(a.x + dir.x * 1.6, 1.7, a.z + dir.z * 1.6), dur: 1.6, walk: 'stone', ease: 'in' });
      } else {
        await fade(1, 1.2);
      }
      await enterNext(ctx.to, 'stone');
    },

    /* ---------- a team picks up at its checkpoint ---------- */
    async resume(ctx) {
      const set = W.use(ctx.loc.scene), r = R(), h = set.home;
      r.pos.copy(h.pos).addScaledVector(flat(h.look, h.pos).normalize(), 1.5);
      r.look.copy(h.look);
      if (set.lights) set.lights.darkness = 0.6;
      fade(0, 1.6);
      if (set.lights) tween(2.4, k => { set.lights.darkness = 0.6 * (1 - k); });
      await move({ pos: h.pos, dur: 2.4, walk: 'wood' });
    },

    /* ---------- the way out ---------- */
    async escape() {
      const ext = W.use('exterior'), r = R();
      ext.idle = false;
      C.letterbox(true);
      C.black(true);
      ext.door.set(0);
      r.pos.set(0, 2.75, -22.45); r.look.set(0, 2.6, -10);
      await wait(0.8);
      A.sfx.doorOpen(2.2);
      fade(0, 1.4);
      await tween(2.2, k => ext.door.set(k * 0.95));
      W.lightning(0.6);
      await move({ pos: [0, 2.75, -17.6], look: [0, 2.2, 0], dur: 2.4, walk: 'wood' });
      await move({ pos: [0, 1.75, -12.6], look: [0, 1.9, 10], dur: 1.8, walk: 'stone', rate: 2 });
      await move({ pos: [0, 1.75, -1], look: [0, 1.9, 22], dur: 2.8, walk: 'grass', rate: 2.4 });
      await move({ look: [10, 2.4, 0], dur: 0.9, ease: 'in' });
      await move({ pos: [0.6, 1.8, 6], look: [0, 7.5, -20], dur: 1.7, ease: 'out' });
      await tween(0.3, k => ext.door.set(0.95 * (1 - k)), 'in');
      A.sfx.slam(1); W.shake(0.35);
      await wait(0.5);
      W.lightning(1);
      ext.windowsOut();
      await wait(1.6);
      A.sfx.winSting();
      const cols = [0xff7a1a, 0xa04aff, 0x6aff8a, 0xffd04a, 0xff3a6a];
      for (let i = 0; i < 5; i++) {
        ext.firework(V(-12 + Math.random() * 26, 22 + Math.random() * 10, -30 + Math.random() * 10), cols[i % cols.length]);
        await wait(0.5 + Math.random() * 0.4);
      }
      await move({ pos: [0, 2.6, 18], look: [0, 10, -20], dur: 4.5 });
    }
  };

  // Challenge modules use these too.
  cutscenes.helpers = { approach, openPortal, toView, pan };
  return cutscenes;
})();
