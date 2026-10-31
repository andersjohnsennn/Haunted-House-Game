/* ==========================================================================
   Challenge kit: everything challenge rooms share.
     HH.Markers     glowing in-world choice markers (also used for paths)
     HH.Kit         a context per attempt with TV-sized UI helpers
     HH.Challenges  registry of challenge modules; 'placeholder' lives here

   A challenge module is { async run(ctx) -> 'success' | 'fail' }.
   ctx: { set, loc, challenge, team, teamIndex, ui, alive() }
   When the host forces a result, the context dies: every ctx.ui call
   after that never resolves, so the module simply stops.
   ========================================================================== */

window.HH = window.HH || {};

/* ---------------- in-world markers ---------------- */
HH.Markers = (function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let list = [], onPick = null, hooked = false;

  function show(items, pick) {
    clear();
    if (!hooked) { HH.World.onFrame(place); hooked = true; }
    onPick = pick;
    list = items.map((it, idx) => {
      const el = document.createElement('button');
      el.className = 'hotspot';
      el.innerHTML = `<span class="ring"></span><span class="tag"><span class="key">${esc(it.key)}</span><span class="label">${esc(it.label)}</span></span>`;
      el.style.transitionDelay = (0.15 + idx * 0.2) + 's';
      el.addEventListener('click', () => choose(idx));
      $('hotspots').appendChild(el);
      return { el, key: it.key, anchor: it.anchor || null, idx, n: items.length };
    });
    requestAnimationFrame(() => requestAnimationFrame(() => list.forEach(h => h.el.classList.add('in'))));
  }

  function choose(idx) {
    if (!onPick) return;
    const f = onPick;
    onPick = null;
    HH.Audio.sfx.ui();
    list.forEach((h, i) => h.el.classList.add(i === idx ? 'picked' : 'gone'));
    const stale = list;
    setTimeout(() => { stale.forEach(h => h.el.remove()); if (list === stale) list = []; }, 700);
    f(idx);
  }

  function clear() { onPick = null; list.forEach(h => h.el.remove()); list = []; }

  function handleKey(e) {
    if (!onPick) return false;
    const k = e.key.toUpperCase(), n = parseInt(e.key, 10);
    let idx = list.findIndex(h => String(h.key).toUpperCase() === k);
    if (idx < 0 && n) idx = n - 1;
    if (idx >= 0 && idx < list.length) { choose(idx); return true; }
    return false;
  }

  // The ring sits on the anchor; the label slides sideways to stay on screen.
  function place() {
    if (!list.length) return;
    const w = window.innerWidth, h = window.innerHeight, m = 24;
    list.forEach(hs => {
      const tag = hs.tag || (hs.tag = hs.el.querySelector('.tag'));
      const tw = tag.offsetWidth;
      let x, y, edge = false;
      if (hs.anchor) {
        const p = HH.World.project(hs.anchor);
        x = p.x; y = p.y;
        if (!p.on) {
          edge = true;
          let nx = p.behind ? -p.nx : p.nx, ny = p.behind ? -p.ny : p.ny;
          const mx = Math.max(Math.abs(nx), Math.abs(ny)) || 1;
          nx /= mx; ny /= mx;
          x = (nx * 0.5 + 0.5) * w; y = (-ny * 0.5 + 0.5) * h;
        }
      } else {
        x = (hs.idx + 1) / (hs.n + 1) * w; y = h * 0.7;
      }
      if (edge) x = clamp(x, tw / 2 + m, w - tw / 2 - m);
      x = clamp(x, m + 30, w - m - 30);
      y = clamp(y, 110, h - 190);
      hs.x = x; hs.y = y; hs.tw = tw;
      hs.tx = clamp(x, tw / 2 + m, w - tw / 2 - m);
      hs.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      tag.style.left = (hs.tx - x).toFixed(1) + 'px';
      hs.el.classList.toggle('edge', edge);
    });
    // Labels that would overlap step down into rows, left to right.
    const placed = [];
    list.slice().sort((a, b) => a.tx - b.tx).forEach(hs => {
      let row = 0;
      while (placed.some(p => p.row === row && Math.abs(p.ty - hs.y) < 60 && Math.abs(p.tx - hs.tx) < (p.tw + hs.tw) / 2 + 14)) row++;
      placed.push({ row, tx: hs.tx, tw: hs.tw, ty: hs.y });
      hs.tag.style.top = ((hs.el.classList.contains('edge') ? -24 : 44) + row * 66) + 'px';
    });
  }

  return { show, clear, handleKey, get active() { return !!onPick; } };
})();

/* ---------------- per-attempt UI kit ---------------- */
HH.Kit = (function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const NEVER = new Promise(() => {});
  const KEYS = 'ABCDEFGH';
  let live = null;          // the running context
  let keyed = null;         // { buttons:[{key, el}] } for keyboard picks on the prompt

  function rand(n) {
    const a = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return a[0] % n;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function hideAll() {
    ['ck-banner', 'ck-prompt', 'ck-host', 'ck-portrait', 'ck-picker', 'ck-count', 'ck-gauge'].forEach(id => $(id).classList.remove('show'));
    keyed = null;
    HH.Markers.clear();
  }

  function context(base) {
    let forceRes;
    const c = Object.assign({ dead: false }, base);
    c.forced = new Promise(r => { forceRes = r; });
    c.alive = () => !c.dead;
    c.force = result => { if (c.dead) return; c.dead = true; hideAll(); forceRes(result); };
    c.end = () => { c.dead = true; hideAll(); if (live === c) live = null; };
    c.ui = bind(c);
    live = c;
    return c;
  }

  function bind(c) {
    const guard = fn => (...a) => (c.dead ? NEVER : fn(...a).then(v => (c.dead ? NEVER : v)));
    return {
      banner: guard(banner),
      prompt: guard(prompt),
      host: guard(host),
      revealPlayer: guard(revealPlayer),
      pickPlayer: guard(pickPlayer),
      countdown: guard(countdown),
      pickInWorld: guard(items => new Promise(res => HH.Markers.show(items, res))),
      wait: guard(s => HH.Tween.wait(s)),
      hidePrompt() { $('ck-prompt').classList.remove('show'); keyed = null; },
      hideHost() { $('ck-host').classList.remove('show'); },
      hidePortrait() { $('ck-portrait').classList.remove('show'); },
      gauge(on, label) { if (c.dead) return; $('ck-gauge').classList.toggle('show', on); if (label !== undefined) $('ck-gauge').querySelector('.label').textContent = label; },
      gaugeSet(k, text) {
        if (c.dead) return;
        $('ck-gauge').querySelector('.bar i').style.transform = `scaleX(${Math.max(0, Math.min(1, k)).toFixed(4)})`;
        if (text !== undefined) $('ck-gauge').querySelector('.time').textContent = text;
      },
      clear: hideAll
    };
  }

  /* ---------- banner: a big line over the room ---------- */
  async function banner(title, sub, { tone = 'info', hold = 2.6, kicker = '' } = {}) {
    const el = $('ck-banner');
    el.className = 'tone-' + tone;
    el.querySelector('.kicker').textContent = kicker;
    el.querySelector('h2').textContent = title;
    el.querySelector('p').textContent = sub || '';
    void el.offsetWidth;
    el.classList.add('show');
    await sleep(hold * 1000);
    el.classList.remove('show');
    await sleep(500);
  }

  /* ---------- prompt: what the players read and click ---------- */
  let promptSeq = 0;
  function prompt({ kicker = '', title = '', text = '', note = '', buttons = [], place = 'center', variant = '', keys = true } = {}) {
    const el = $('ck-prompt'), seq = ++promptSeq;
    el.className = `place-${place} ${variant}`;
    el.querySelector('.kicker').textContent = kicker;
    el.querySelector('h3').textContent = title;
    el.querySelector('.text').textContent = text;
    el.querySelector('.note').textContent = note;
    const box = el.querySelector('.btns');
    box.innerHTML = '';
    return new Promise(res => {
      const list = buttons.map((b, i) => {
        const btn = document.createElement('button');
        const key = b.key || (keys ? KEYS[i] : '');
        btn.className = 'ck-btn ' + (b.primary ? 'primary ' : '') + (b.tone ? 'tone-' + b.tone : '');
        btn.innerHTML = (key ? `<span class="k">${esc(key)}</span>` : '') + `<span class="t">${b.html || esc(b.label)}</span>`;
        btn.addEventListener('click', () => {
          if (!keyed || keyed.el !== el) return;
          keyed = null;
          HH.Audio.sfx.ui();
          btn.classList.add('chosen');
          box.querySelectorAll('button').forEach(o => { o.disabled = true; });
          // Fade out after the click flash, unless the next prompt is already up.
          setTimeout(() => { if (seq === promptSeq) el.classList.remove('show'); }, 350);
          res(b.value);
        });
        box.appendChild(btn);
        return { key, el: btn };
      });
      keyed = { el, buttons: list };
      void el.offsetWidth;
      el.classList.add('show');
    });
  }

  /* ---------- host bar: results only the host records ---------- */
  function host({ label = 'Host', buttons = [] } = {}) {
    const el = $('ck-host');
    el.querySelector('.label').textContent = label;
    const box = el.querySelector('.btns');
    box.innerHTML = '';
    return new Promise(res => {
      buttons.forEach(b => {
        const btn = document.createElement('button');
        btn.className = 'ck-hbtn tone-' + (b.tone || 'neutral');
        btn.textContent = b.label;
        btn.addEventListener('click', () => {
          HH.Audio.sfx.ui();
          el.classList.remove('show');
          res(b.value);
        });
        box.appendChild(btn);
      });
      el.classList.add('show');
    });
  }

  /* ---------- portraits ---------- */
  function portraitHTML(p) { return HH.Roster.avatar(p, 'big'); }

  // Flicker through the team's portraits and land on one at random.
  async function revealPlayer(team, { avoid = null, kicker = '' } = {}) {
    const el = $('ck-portrait'), pic = el.querySelector('.pic');
    const players = team.players || [];
    el.classList.remove('chosen');
    el.querySelector('.kicker').textContent = kicker;
    el.querySelector('.name').textContent = '';
    el.querySelector('.sub').textContent = '';
    void el.offsetWidth;
    el.classList.add('show');
    if (!players.length) {
      pic.innerHTML = portraitHTML(null);
      await sleep(900);
      el.classList.add('chosen');
      HH.Audio.sfx.boom(0.7);
      el.querySelector('.name').textContent = 'ONE OF YOU HAS BEEN CHOSEN.';
      el.querySelector('.sub').textContent = 'No players are registered for this team. Choose one member.';
      return null;
    }
    const pool = players.filter(p => !(avoid && avoid.has(p.id)));
    const winner = (pool.length ? pool : players)[rand((pool.length ? pool : players).length)];
    const order = shuffle(players);
    let delay = 70, i = 0;
    while (delay < 340) {
      pic.innerHTML = portraitHTML(order[i++ % order.length]);
      HH.Audio.sfx.crackle(0.25);
      await sleep(delay);
      delay *= 1.13;
    }
    pic.innerHTML = portraitHTML(winner);
    el.classList.add('chosen');
    HH.Audio.sfx.drum(1); HH.Audio.sfx.boom(0.6);
    HH.World.shake(0.25);
    el.querySelector('.name').textContent = `${winner.name.toUpperCase()} HAS BEEN CHOSEN.`;
    return winner;
  }

  // `current`: a player to mark as last time's choice (listed first).
  function pickPlayer(team, title = 'Nominate your champion', { current = null } = {}) {
    const el = $('ck-picker'), grid = el.querySelector('.grid');
    el.querySelector('h3').textContent = title;
    grid.innerHTML = '';
    return new Promise(res => {
      const done = p => { HH.Audio.sfx.ui(); el.classList.remove('show'); res(p); };
      const players = (team.players || []).slice();
      if (current) players.sort((a, b) => (b.id === current.id) - (a.id === current.id));
      players.forEach(p => {
        const b = document.createElement('button');
        const isLast = current && p.id === current.id;
        b.className = 'pick' + (isLast ? ' current' : '');
        b.innerHTML = HH.Roster.avatar(p, 'mid') + `<span>${esc(p.name)}</span>` + (isLast ? '<em>Last time</em>' : '');
        b.addEventListener('click', () => done(p));
        grid.appendChild(b);
      });
      el.querySelector('.skip').onclick = () => done(null);
      el.querySelector('.skip').textContent = (team.players || []).length ? 'Skip' : 'Continue without a name';
      el.classList.add('show');
    });
  }

  async function countdown(n = 3, word = 'GO!') {
    const el = $('ck-count');
    el.classList.add('show');
    for (let i = n; i >= 1; i--) {
      el.textContent = i; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
      HH.Audio.sfx.drum(0.9);
      await sleep(1000);
    }
    el.textContent = word; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    HH.Audio.sfx.drum(1.3); HH.Audio.sfx.boom(0.6);
    setTimeout(() => el.classList.remove('show'), 900);
  }

  // Keyboard picks for the open prompt (A, B, C... or 1, 2, 3...).
  function handleKey(e) {
    if (HH.Markers.handleKey(e)) return true;
    if (!keyed) return false;
    const k = e.key.toUpperCase(), n = parseInt(e.key, 10);
    let b = keyed.buttons.find(x => x.key && x.key.toUpperCase() === k);
    if (!b && n) b = keyed.buttons[n - 1];
    if (b) { b.el.click(); return true; }
    return false;
  }

  return { context, handleKey, shuffle, rand, banner, get live() { return live; } };
})();

/* ---------------- challenge registry ---------------- */
HH.Challenges = HH.Challenges || {};

// Host-confirmed challenge whose content is decided later.
HH.Challenges.placeholder = {
  async run(ctx) {
    const ch = ctx.challenge, ui = ctx.ui;
    const r = await ui.prompt({
      kicker: (ctx.loc.label ? ctx.loc.label + ' · ' : '') + 'Challenge',
      title: ch.title || 'Challenge',
      text: ch.instructions || '',
      note: `Playing: ${ctx.team.name}. One attempt per turn. Failing ends the turn.`,
      place: 'bottom',
      keys: false,
      buttons: [
        { label: 'Challenge completed', value: 'success', primary: true },
        { label: 'Challenge failed', value: 'fail', tone: 'ghost' }
      ]
    });
    if (r === 'success') {
      HH.Audio.sfx.bell(196, 0.35);
      await ui.banner('Challenge complete', `${ctx.team.name} continues`, { tone: 'good', hold: 2 });
    } else {
      HH.Audio.sfx.stinger(0.4); HH.World.shake(0.3);
    }
    return r;
  }
};
