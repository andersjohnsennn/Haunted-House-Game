/* ==========================================================================
   The Wheel of Bones: a spinning punishment wheel of skulls and bones.
   - A team that beats a challenge spins it to decide what the OTHER team drinks.
   - A team that fails a challenge spins it for its own punishment.

   Edit HH.WHEEL below. `chance` is each outcome's odds in percent, and also
   its share of the wheel; `slices` is how many pieces the wheel is cut into
   (each outcome gets slices in proportion to its chance, spread around).
   A challenge with `wheel: false` in js/mansion-data.js skips the wheel.
   ========================================================================== */

window.HH = window.HH || {};

HH.WHEEL = {
  slices: 10,
  outcomes: [
    { label: '1 shot', chance: 10, color: '#4c0a08', ink: '#e3c8a4', dread: true },
    { label: '7 sips', chance: 20, color: '#2c211a', ink: '#cdbf9f' },
    { label: '5 sips', chance: 30, color: '#6a5e4b', ink: '#1d140c' },
    { label: '3 sips', chance: 40, color: '#171412', ink: '#b3a68a' }
  ],
  // {team} spins; {other} is the other team; {room} the challenge room.
  text: {
    challengeKicker: '{room} conquered',
    challengeTitle: '{team} spins the Wheel of Bones',
    challengeSub: 'Whatever it lands on, {other} must drink.',
    failedKicker: '{room}: challenge failed',
    failedTitle: '{team} spins for its punishment',
    failedSub: 'The Wheel of Bones decides what you drink.',
    drinks: '{team} drinks',
    spin: 'Spin the wheel'
  }
};

HH.Wheel = (function () {
  const $ = id => document.getElementById(id);
  const A = () => HH.Audio;
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fill = (tpl, v) => String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));
  const rad = deg => (deg - 90) * Math.PI / 180;          // degrees clockwise from 12 o'clock -> canvas angle
  const S = 1200, C = S / 2, R_FACE = S * 0.43, R_RIM = S * 0.49, R_HUB = S * 0.105;
  const BONE = '#b9aa8b', DARK = 'rgba(8,5,3,.88)';

  let el = null, rotEl, face, shade, pointer, slices = [], bounds = [], drawn = false;
  let rot = 0, flick = 0, active = false, onPress = null;

  /* ---------- layout: slices spread around the wheel ---------- */
  // Each outcome gets slices in proportion to its chance. Tries a few spacings
  // until no two slices of the same outcome sit side by side.
  function arrange(counts) {
    const N = counts.reduce((a, b) => a + b, 0), steps = [0.5, 0, 0.25, 0.75];
    const combos = Math.min(4096, Math.pow(steps.length, counts.length));
    let fallback = null;
    for (let combo = 0; combo < combos; combo++) {
      const seq = [];
      let c = combo;
      counts.forEach((n, j) => {
        const off = steps[c % steps.length]; c = Math.floor(c / steps.length);
        for (let k = 0; k < n; k++) seq.push({ j, p: (k + off) * N / n });
      });
      seq.sort((a, b) => a.p - b.p || a.j - b.j);
      const order = seq.map(s => s.j);
      if (order.every((j, i) => j !== order[(i + 1) % N])) return order;
      fallback = fallback || order;
    }
    return fallback;
  }

  function layout() {
    const outs = HH.WHEEL.outcomes, total = outs.reduce((s, o) => s + o.chance, 0);
    const n = Math.max(outs.length, HH.WHEEL.slices || 10);
    const counts = outs.map(o => Math.max(1, Math.round(o.chance / total * n)));
    let a = 0;
    slices = arrange(counts).map(j => {
      const w = outs[j].chance / total * 360 / counts[j];
      const s = { o: outs[j], a0: a, a1: a + w, mid: a + w / 2 };
      a += w;
      return s;
    });
    bounds = slices.map(s => s.a0);
  }

  // Outcome by its odds, then one of its slices (by width), then a spot
  // well inside that slice so it never lands on a bone.
  function choose() {
    const outs = HH.WHEEL.outcomes, total = outs.reduce((s, o) => s + o.chance, 0);
    let r = HH.Kit.rand(1e6) / 1e6 * total, o = outs[outs.length - 1];
    for (const x of outs) { if (r < x.chance) { o = x; break; } r -= x.chance; }
    const own = slices.filter(s => s.o === o);
    const s = own[HH.Kit.rand(own.length)];
    return { slice: s, angle: s.a0 + (s.a1 - s.a0) * (0.14 + 0.72 * HH.Kit.rand(1e6) / 1e6) };
  }

  /* ---------- drawing ---------- */
  function tint(hex, f) {
    const n = parseInt(hex.slice(1), 16), ch = sh => Math.round(Math.min(255, ((n >> sh) & 255) * f));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  // A bone along the x axis from x0 to x1, `w` thick: dark outline first, then the fill over it.
  function bone(g, x0, x1, w, color = BONE) {
    const k = w * 0.5;
    g.beginPath();
    g.rect(x0 + k, -w * 0.27, x1 - x0 - 2 * k, w * 0.54);
    for (const x of [x0 + k, x1 - k]) for (const sy of [-1, 1]) { g.moveTo(x + k, sy * w * 0.3); g.arc(x, sy * w * 0.3, k, 0, Math.PI * 2); }
    g.lineJoin = 'round'; g.lineWidth = w * 0.3; g.strokeStyle = DARK; g.stroke();
    const gr = g.createLinearGradient(0, -w, 0, w);
    gr.addColorStop(0, tint(color, 1.15)); gr.addColorStop(0.45, color); gr.addColorStop(1, tint(color, 0.5));
    g.fillStyle = gr; g.fill();
  }

  // A skull centred on (x, y); `s` is the cranium radius. `eyes` adds a glow in the sockets.
  function skull(g, x, y, s, { color = BONE, eyes = null, bones = false } = {}) {
    g.save(); g.translate(x, y);
    if (bones) for (const a of [-0.62, 0.62]) { g.save(); g.translate(0, s * 0.3); g.rotate(a); bone(g, -s * 1.85, s * 1.85, s * 0.4, color); g.restore(); }
    const shape = () => {
      g.beginPath();
      g.arc(0, -s * 0.1, s, 0, Math.PI * 2);
      const w = s * 0.64, top = s * 0.3, bot = s * 0.98, r = s * 0.22;
      g.moveTo(-w + r, top); g.lineTo(w - r, top); g.quadraticCurveTo(w, top, w, top + r); g.lineTo(w, bot - r);
      g.quadraticCurveTo(w, bot, w - r, bot); g.lineTo(-w + r, bot); g.quadraticCurveTo(-w, bot, -w, bot - r);
      g.lineTo(-w, top + r); g.quadraticCurveTo(-w, top, -w + r, top);
    };
    shape(); g.lineWidth = s * 0.16; g.strokeStyle = DARK; g.stroke();
    const gr = g.createRadialGradient(-s * 0.35, -s * 0.55, s * 0.1, 0, 0, s * 1.3);
    gr.addColorStop(0, tint(color, 1.18)); gr.addColorStop(0.55, color); gr.addColorStop(1, tint(color, 0.45));
    shape(); g.fillStyle = gr; g.fill();
    g.fillStyle = '#0a0604';
    for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * s * 0.38, s * 0.12, s * 0.27, s * 0.31, sx * -0.25, 0, Math.PI * 2); g.fill(); }
    if (eyes) {
      g.save(); g.shadowColor = eyes; g.shadowBlur = s * 0.6; g.fillStyle = eyes;
      for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * s * 0.36, s * 0.16, s * 0.09, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
    g.fillStyle = '#0a0604';
    g.beginPath(); g.moveTo(0, s * 0.36); g.lineTo(-s * 0.11, s * 0.58); g.lineTo(s * 0.11, s * 0.58); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(10,6,4,.9)'; g.lineWidth = s * 0.055; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-s * 0.44, s * 0.78); g.lineTo(s * 0.44, s * 0.78);
    for (let i = -2; i <= 2; i++) { g.moveTo(i * s * 0.15, s * 0.66); g.lineTo(i * s * 0.15, s * 0.94); }
    g.stroke();
    g.lineWidth = s * 0.04;
    g.beginPath(); g.moveTo(s * 0.22, -s * 1.06); g.lineTo(s * 0.32, -s * 0.78); g.lineTo(s * 0.2, -s * 0.6); g.lineTo(s * 0.28, -s * 0.46); g.stroke();
    g.restore();
  }

  // Largest font size (up to `max`) that keeps `text` within `width`.
  function fit(g, text, weight, max, width) {
    g.font = `${weight} ${max}px Cinzel, Georgia, serif`;
    const w = g.measureText(text).width;
    const size = w > width ? Math.floor(max * width / w) : max;
    g.font = `${weight} ${size}px Cinzel, Georgia, serif`;
    return size;
  }

  function grime(g, clipR, alpha) {
    g.save();
    g.beginPath(); g.arc(C, C, clipR, 0, Math.PI * 2); g.clip();
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = alpha;
    g.drawImage(HH.Tex.noiseCanvas(613, 24), 0, 0, S, S);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    for (let i = 0; i < 220; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * clipR, l = 8 + Math.random() * 40, d = Math.random() * Math.PI;
      const x = C + Math.cos(a) * r, y = C + Math.sin(a) * r;
      g.strokeStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.28)' : 'rgba(230,210,170,.07)';
      g.lineWidth = 1 + Math.random();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(d) * l, y + Math.sin(d) * l); g.stroke();
    }
    g.restore();
  }

  function drawFace() {
    const g = face.getContext('2d');
    g.clearRect(0, 0, S, S);
    if ('letterSpacing' in g) g.letterSpacing = '0px';

    // iron rim
    g.beginPath(); g.arc(C, C, R_RIM, 0, Math.PI * 2);
    const rim = g.createRadialGradient(C, C, R_FACE, C, C, R_RIM);
    rim.addColorStop(0, '#0b0907'); rim.addColorStop(0.35, '#3a322a'); rim.addColorStop(0.7, '#1e1915'); rim.addColorStop(1, '#070605');
    g.fillStyle = rim; g.fill();
    g.lineWidth = 4; g.strokeStyle = '#000'; g.stroke();
    for (let d = 0; d < 360; d += 6) {
      const x = C + Math.cos(rad(d + 3)) * (R_RIM - S * 0.022), y = C + Math.sin(rad(d + 3)) * (R_RIM - S * 0.022);
      const rv = g.createRadialGradient(x - 2, y - 2, 0, x, y, 6);
      rv.addColorStop(0, '#6a5e50'); rv.addColorStop(1, '#14110e');
      g.fillStyle = rv; g.beginPath(); g.arc(x, y, 5.5, 0, Math.PI * 2); g.fill();
    }

    // slices
    slices.forEach(s => {
      g.beginPath(); g.moveTo(C, C); g.arc(C, C, R_FACE, rad(s.a0), rad(s.a1)); g.closePath();
      const gr = g.createRadialGradient(C, C, R_HUB, C, C, R_FACE);
      gr.addColorStop(0, tint(s.o.color, 0.45)); gr.addColorStop(0.6, s.o.color); gr.addColorStop(1, tint(s.o.color, 0.62));
      g.fillStyle = gr; g.fill();
    });
    grime(g, R_FACE, 0.55);

    // labels and skulls, upright when the slice is under the pointer
    slices.forEach(s => {
      const o = s.o, half = (s.a1 - s.a0) * Math.PI / 360;
      const chord = r => 2 * r * Math.sin(half) * 0.8;
      const m = String(o.label).trim().match(/^(\S+)\s+(.+)$/);
      const big = m ? m[1] : o.label, small = m ? m[2] : '';
      g.save(); g.translate(C, C); g.rotate(s.mid * Math.PI / 180);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,.75)'; g.shadowBlur = 10; g.shadowOffsetY = 3;
      g.fillStyle = o.ink || BONE;
      fit(g, big, 900, S * 0.105, chord(R_FACE * 0.75));
      g.fillText(big, 0, -R_FACE * 0.75);
      if (small) {
        if ('letterSpacing' in g) g.letterSpacing = '4px';
        fit(g, small.toUpperCase(), 700, S * 0.036, chord(R_FACE * 0.57));
        g.fillText(small.toUpperCase(), 0, -R_FACE * 0.575);
        if ('letterSpacing' in g) g.letterSpacing = '0px';
      }
      g.shadowColor = 'transparent';
      if (o.dread) skull(g, 0, -R_FACE * 0.38, S * 0.03, { bones: true, eyes: 'rgba(255,40,20,.95)', color: '#a8987a' });
      else skull(g, 0, -R_FACE * 0.375, S * 0.021, { color: tint(BONE, 0.8) });
      g.restore();
    });

    // bones between the slices
    slices.forEach(s => {
      g.save(); g.translate(C, C); g.rotate(rad(s.a0));
      bone(g, R_HUB * 1.02, R_FACE * 0.985, S * 0.02);
      g.restore();
    });

    // face vignette
    g.save();
    g.beginPath(); g.arc(C, C, R_FACE, 0, Math.PI * 2); g.clip();
    const v = g.createRadialGradient(C, C, R_FACE * 0.45, C, C, R_FACE);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)');
    g.fillStyle = v; g.fillRect(0, 0, S, S);
    g.restore();

    // bone pegs on the rim: the dagger clicks over these
    slices.forEach(s => {
      const x = C + Math.cos(rad(s.a0)) * (R_FACE + S * 0.016), y = C + Math.sin(rad(s.a0)) * (R_FACE + S * 0.016);
      const pg = g.createRadialGradient(x - 4, y - 4, 1, x, y, S * 0.016);
      pg.addColorStop(0, '#d8cbb0'); pg.addColorStop(1, '#5c5140');
      g.beginPath(); g.arc(x, y, S * 0.014, 0, Math.PI * 2);
      g.lineWidth = 4; g.strokeStyle = DARK; g.stroke(); g.fillStyle = pg; g.fill();
    });

    // hub: iron boss with a skull on crossed bones
    g.beginPath(); g.arc(C, C, R_HUB, 0, Math.PI * 2);
    const hub = g.createRadialGradient(C - R_HUB * 0.3, C - R_HUB * 0.4, 4, C, C, R_HUB);
    hub.addColorStop(0, '#4a4036'); hub.addColorStop(1, '#0c0a08');
    g.fillStyle = hub; g.fill(); g.lineWidth = 6; g.strokeStyle = '#000'; g.stroke();
    skull(g, C, C - R_HUB * 0.08, R_HUB * 0.42, { bones: true, color: '#a6977a', eyes: 'rgba(200,30,10,.55)' });
  }

  // The pointer: a dark dagger pointing down with a skull for a pommel.
  function drawPointer() {
    const g = pointer.getContext('2d'), w = pointer.width;
    g.clearRect(0, 0, w, pointer.height);
    const cx = w / 2;
    g.beginPath();
    g.moveTo(cx - 21, 140); g.lineTo(cx + 21, 140); g.lineTo(cx + 15, 300); g.lineTo(cx, 352); g.lineTo(cx - 15, 300); g.closePath();
    g.lineWidth = 5; g.strokeStyle = DARK; g.stroke();
    const bl = g.createLinearGradient(cx - 21, 0, cx + 21, 0);
    bl.addColorStop(0, '#2c2a27'); bl.addColorStop(0.48, '#7b7670'); bl.addColorStop(0.52, '#4a4642'); bl.addColorStop(1, '#1c1a18');
    g.fillStyle = bl; g.fill();
    const blood = g.createLinearGradient(0, 270, 0, 352);
    blood.addColorStop(0, 'rgba(90,6,4,0)'); blood.addColorStop(1, 'rgba(100,8,5,.85)');
    g.fillStyle = blood; g.fill();
    g.strokeStyle = 'rgba(200,190,175,.25)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx, 146); g.lineTo(cx, 330); g.stroke();
    g.fillStyle = '#2a1a10'; g.fillRect(cx - 11, 96, 22, 30);
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2;
    for (let y = 100; y < 126; y += 6) { g.beginPath(); g.moveTo(cx - 11, y); g.lineTo(cx + 11, y + 4); g.stroke(); }
    g.save(); g.translate(cx, 130); bone(g, -96, 96, 26); g.restore();
    skull(g, cx, 66, 38, { color: '#b2a385', eyes: 'rgba(255,50,20,.8)' });
  }

  function drawShade(s) {
    const g = shade.getContext('2d');
    g.clearRect(0, 0, S, S);
    g.beginPath(); g.arc(C, C, R_FACE, 0, Math.PI * 2);
    g.moveTo(C, C); g.arc(C, C, R_FACE, rad(s.a1), rad(s.a0), true); g.closePath();
    g.fillStyle = 'rgba(0,0,0,.62)'; g.fill('evenodd');
    g.save();
    g.beginPath(); g.moveTo(C, C); g.arc(C, C, R_FACE, rad(s.a0), rad(s.a1)); g.closePath();
    g.shadowColor = s.o.dread ? 'rgba(255,30,10,.95)' : 'rgba(255,140,60,.8)'; g.shadowBlur = 36;
    g.lineWidth = 7; g.strokeStyle = s.o.dread ? 'rgba(200,30,15,.9)' : 'rgba(210,140,70,.75)'; g.stroke();
    g.restore();
  }

  async function ensure() {
    if (!el) {
      el = $('screen-wheel');
      rotEl = el.querySelector('.wh-rot'); face = el.querySelector('.wh-face'); shade = el.querySelector('.wh-shade'); pointer = el.querySelector('.wh-pointer');
      face.width = face.height = shade.width = shade.height = S;
      layout();
    }
    if (drawn) return;
    // Wait (briefly) for the Cinzel font so the canvas labels use it.
    try {
      await Promise.race([Promise.all([document.fonts.load('900 100px Cinzel'), document.fonts.load('700 40px Cinzel')]), new Promise(r => setTimeout(r, 1500))]);
    } catch (e) { /* fall back to Georgia */ }
    drawFace(); drawPointer();
    drawn = true;
  }

  /* ---------- screen ---------- */
  function slot(name, html) {
    const n = el.querySelector(`[data-w="${name}"]`);
    n.innerHTML = html;
    n.classList.remove('pop'); void n.offsetWidth; if (html) n.classList.add('pop');
  }
  function button(label) {
    return new Promise(res => {
      slot('host', '');
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = label;
      onPress = () => { onPress = null; b.disabled = true; A().sfx.ui(); res(); };
      b.onclick = () => onPress && onPress();
      el.querySelector('[data-w="host"]').appendChild(b);
    });
  }
  function apply() {
    rotEl.style.transform = `rotate(${rot.toFixed(3)}deg)`;
    pointer.style.transform = `rotate(${(-flick * 18).toFixed(2)}deg)`;
  }

  // Wind up a little, then spin 5-6 turns and coast to a stop on `target`
  // (degrees clockwise from 12 o'clock on the wheel). The dagger clicks over each bone.
  async function spinTo(target) {
    const back = rot - 9;
    A().sfx.creak(0.5, 1.4, 0.25);
    const r0 = rot;
    await HH.Tween.add({ dur: 0.45, ease: 'inOut', update: k => { rot = r0 + (back - r0) * k; apply(); } });
    const start = rot, turns = 5 + HH.Kit.rand(2), DUR = 6.4;
    const delta = turns * 360 + (((-target - start) % 360) + 360) % 360;
    let last = -start, prevK = 0, lastTick = -1;
    A().sfx.whoosh(0.4);
    A().heartbeat(118);
    await HH.Tween.add({
      dur: DUR, ease: 'linear',
      update: (_, k) => {
        rot = start + delta * (1 - Math.pow(1 - k, 3));
        const u = -rot, t = k * DUR, dt = (k - prevK) * DUR;
        prevK = k;
        let crossed = 0;
        for (const b of bounds) crossed += Math.floor((last - b) / 360) - Math.floor((u - b) / 360);
        last = u;
        if (crossed > 0) { flick = 1; if (t - lastTick > 0.03) { lastTick = t; A().sfx.tick(0.32); } }
        flick = Math.max(0, flick - dt * 6);
        apply();
      }
    });
    A().heartbeat(0);
    await HH.Tween.add({ dur: 0.35, ease: 'out', update: k => { flick = flick * (1 - k); apply(); } });
    flick = 0; rot = ((rot % 360) + 360) % 360; apply();
  }

  // Show the wheel and wait for a spin and a "done". Resolves with the outcome.
  async function run({ kicker, title, sub, drinker, done }) {
    await ensure();
    active = true;
    el.classList.remove('landed');
    shade.getContext('2d').clearRect(0, 0, S, S);
    ['kicker', 'title', 'sub', 'who', 'result', 'host'].forEach(n => slot(n, ''));
    el.querySelector('[data-w="result"]').classList.remove('dread');
    slot('kicker', esc(kicker)); slot('title', esc(title)); slot('sub', esc(sub));
    flick = 0; apply();
    document.body.classList.add('in-wheel');
    el.classList.add('show');
    A().sfx.boom(0.45); A().sfx.whoosh(0.3);

    await button(HH.WHEEL.text.spin);
    if (!active) return new Promise(() => {});
    slot('host', '');
    const pick = choose();
    await spinTo(pick.angle);
    if (!active) return new Promise(() => {});

    const o = pick.slice.o;
    drawShade(pick.slice);
    el.classList.add('landed');
    slot('sub', '');
    const players = (drinker && drinker.players) || [];
    slot('who', `<span>${esc(fill(HH.WHEEL.text.drinks, { team: drinker ? drinker.name : '' }))}</span>` +
      (players.length ? `<span class="wh-faces">${players.map(p => HH.Roster.avatar(p, 'small')).join('')}</span>` : ''));
    slot('result', esc(o.label));
    el.querySelector('[data-w="result"]').classList.toggle('dread', !!o.dread);
    if (o.dread) {
      A().sfx.boom(0.9); A().sfx.stinger(0.7); A().sfx.laugh(0.55, 0.75);
      HH.Cine.hit(0.45, '#3a0000', 900); HH.World.shake(0.35);
    } else {
      A().sfx.boom(0.35); A().sfx.bell(196, 0.32);
    }

    await HH.Tween.wait(0.8);
    await button(done || 'Done');
    if (!active) return new Promise(() => {});
    close();
    return o;
  }

  function close() {
    active = false; onPress = null;
    if (!el) return;
    el.classList.remove('show');
    document.body.classList.remove('in-wheel');
    A().heartbeat(0);
  }

  return {
    // The winning team spins; the other team drinks.
    forChallenge(team, other, loc) {
      const v = { team: team.name, other: other.name, room: loc.name }, T = HH.WHEEL.text;
      return run({ kicker: fill(T.challengeKicker, v), title: fill(T.challengeTitle, v), sub: fill(T.challengeSub, v), drinker: other, done: 'Done' });
    },
    // The team that failed a challenge spins for itself.
    forFailure(team, loc) {
      const v = { team: team.name, room: loc.name }, T = HH.WHEEL.text;
      return run({ kicker: fill(T.failedKicker, v), title: fill(T.failedTitle, v), sub: fill(T.failedSub, v), drinker: team, done: 'Done' });
    },
    press() { if (onPress) onPress(); },
    // For testing from the console: where a spin would land, without spinning.
    pick() { if (!slices.length) layout(); return choose(); },
    abort: close,
    get active() { return active; },
    get slices() { return slices; }
  };
})();
