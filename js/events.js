/* ==========================================================================
   Room-wide events. Every so often the house interrupts the game for
   EVERYONE in the room, whichever team is playing. The rules are explained
   once, on the house-rules screen at the start of a game; after that the
   events strike without warning.

   When: while a team is standing at a decision and still talking it over,
   after a random delay (never mid-cutscene or mid-challenge). The host can
   also start one from the host panel, or switch random events off.

   Portraits of the host also hang in several rooms (the entrance hall, and
   junction rooms with `portrait` in js/mansion-data.js). The first time a
   team arrives in one, the camera notices it, looks, and the portrait leads
   the toast. Each portrait does this once per game (see portraitToasts).

   TO ADD AN EVENT: add an entry to HH.EVENTS.list using an existing type
   ('freeze' or 'cheers'), or write a new type in TYPES below.
   ========================================================================== */

window.HH = window.HH || {};

HH.EVENTS = {
  random: true,            // default for the host's "Random events" switch
  chance: 0.25,            // chance that a decision gets an event
  delaySeconds: [5, 25],   // it strikes this long after the decision appears, if the team is still deciding
  minGapMinutes: 4,        // never two events closer than this
  graceMinutes: 3,         // nothing in the first minutes of a game
  portraitToasts: 'game',  // a hanging portrait toasts once per 'game', once per 'team', or 'off'

  list: [
    {
      id: 'bloodmoon', type: 'freeze', weight: 1,
      title: 'Blood Moon',
      shout: 'Freeze!',
      holdSeconds: 4,      // how long FREEZE! stays up while the host watches
      penalty: 'must chug',
      note: 'Any drink counts.',
      rule: 'At any moment the Blood Moon can rise. When FREEZE! appears, everyone in the room must freeze instantly. The last one to freeze must chug.'
    },
    {
      id: 'cheers', type: 'cheers', weight: 1,
      title: 'A Toast',
      shout: 'Cheers!',
      rule: 'When the Master of the House raises a glass, the whole room drinks together.',
      toasts: [
        'To those who did not make it out!',
        'To the demon. May it go hungry tonight!',
        'To whoever escapes first!',
        'To the dead, and the soon to be dead!',
        'To the hooded figure. Nobody knows his name.',
        'To the knight. He never loses… almost.'
      ]
    }
  ]
};

HH.Events = (function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const A = () => HH.Audio;
  const KEY = 'theHauntedHouse.events';
  const queued = [];

  let randomOn = HH.EVENTS.random;
  try { const v = localStorage.getItem(KEY); if (v) randomOn = v === 'on'; } catch (e) { /* default */ }

  function pick(list) {
    const total = list.reduce((s, e) => s + (e.weight || 1), 0);
    let r = Math.random() * total;
    return list.find(e => (r -= (e.weight || 1)) < 0) || list[0];
  }

  // Roll the dice for a random event. Returns the event or null.
  function roll() {
    const d = HH.State.data;
    if (!d || !randomOn) return null;
    const cfg = HH.EVENTS, now = Date.now(), ev = d.events || {};
    if (now - (d.startedAt || now) < cfg.graceMinutes * 60000) return null;
    if (ev.last && now - ev.last < cfg.minGapMinutes * 60000) return null;
    if (Math.random() >= cfg.chance) return null;
    const usable = cfg.list.filter(e => TYPES[e.type]);
    const fresh = usable.filter(e => e.id !== ev.lastId);
    return usable.length ? pick(fresh.length ? fresh : usable) : null;
  }

  // A random delay (ms) before an armed event strikes.
  function delay() {
    const [lo, hi] = HH.EVENTS.delaySeconds || [5, 25];
    return (lo + Math.random() * (hi - lo)) * 1000;
  }

  /* ---------- the event screen ---------- */
  function screen(cls) {
    const el = $('screen-event');
    el.className = 'screen show ' + cls;
    el.querySelectorAll('[data-slot]').forEach(n => { n.innerHTML = ''; n.classList.remove('pop'); });
    return el;
  }
  function slot(name, html) {
    const n = $('screen-event').querySelector(`[data-slot="${name}"]`);
    n.innerHTML = html;
    n.classList.remove('pop'); void n.offsetWidth; if (html) n.classList.add('pop');
  }
  function close() { $('screen-event').className = 'screen'; }

  // Host buttons at the bottom of the event screen.
  function hostButtons(list) {
    return new Promise(res => {
      slot('host', '');
      const box = $('screen-event').querySelector('[data-slot="host"]');
      list.forEach(b => {
        const btn = document.createElement('button');
        btn.className = 'ck-hbtn tone-' + (b.tone || 'neutral');
        btn.textContent = b.label;
        btn.onclick = () => { A().sfx.ui(); res(b.value); };
        box.appendChild(btn);
      });
    });
  }

  // Every registered player, both teams. Resolves with a player, or null for "no one".
  function pickAnyone(title) {
    const teams = HH.State.data.teams;
    slot('title', esc(title));
    if (!teams.some(t => t.players.length)) {
      slot('sub', 'Point at whoever it was.');
      return hostButtons([{ label: 'Done', value: null, tone: 'good' }]);
    }
    return new Promise(res => {
      slot('pick', teams.map((t, ti) => `
        <div class="ev-team"><h4>${esc(t.name)}</h4><div class="ev-grid">${t.players.map(p => `
          <button class="ev-p" data-t="${ti}" data-id="${esc(p.id)}">${HH.Roster.avatar(p, 'mid')}<span>${esc(p.name)}</span></button>`).join('')}
        </div></div>`).join(''));
      $('screen-event').querySelectorAll('.ev-p').forEach(b => {
        b.onclick = () => { A().sfx.ui(); res(teams[+b.dataset.t].players.find(p => p.id === b.dataset.id)); };
      });
      hostButtons([{ label: 'No one / skip', value: null }]).then(res);
    });
  }

  /* ---------- event types ---------- */
  const TYPES = {
    // BLOOD MOON: no warning. FREEZE! slams onto the screen; the host names the last to freeze.
    async freeze(e) {
      const W = HH.World, s = W.current, dark0 = s && s.lights ? s.lights.darkness : 0;
      const el = screen('ev-bloodmoon moon-now frozen');
      A().sfx.boom(1.4); A().sfx.stinger(1); A().sfx.slam(1);
      W.lightning(1, false); W.shake(1);
      if (s && s.lights) s.lights.darkness = 0.5;
      slot('title', esc(e.title));
      slot('big', esc(e.shout || 'Freeze!'));
      await sleep((e.holdSeconds || 4) * 1000);
      el.classList.remove('frozen');
      slot('big', '');

      const who = await pickAnyone('Who froze last?');
      slot('pick', ''); slot('host', ''); slot('sub', '');
      if (who) {
        A().sfx.drum(1.2); A().sfx.boom(0.8);
        el.classList.add('reveal');
        slot('title', '');
        slot('pic', HH.Roster.avatar(who, 'big'));
        slot('big', `${esc(who.name)}<small>${esc(e.penalty)}</small>`);
        slot('sub', esc(e.note));
        await hostButtons([{ label: 'Done', value: true, tone: 'good' }]);
      }
      HH.State.logEvent(e.id, who ? { player: who.name } : {});
      if (s && s.lights) s.lights.darkness = dark0;
      close();
      await sleep(600);
    },

    // A TOAST: the lights dim, the camera turns to the host's portrait on the wall
    // (the one in the entrance hall, or one that appears on the wall ahead), and
    // the Master of the House leads the whole room in a toast.
    // With opts.discover (a portrait the team walked in on), the camera notices
    // it first and turns to it out of focus; the picture sharpens as it pushes in.
    async cheers(e, opts = {}) {
      const host = HH.Roster.host(), W = HH.World, s = W.current, r = W.rig, HP = HH.HostPortrait;
      const look0 = r.look.clone(), dark0 = s.lights ? s.lights.darkness : 0;
      const tw = (dur, fn, ease) => HH.Tween.add({ dur, update: fn, ease });
      const el = screen('ev-cheers portrait');

      let spot, temp = null;
      const hung = s.hostPortrait || null;
      if (hung) spot = s.anchors.hostPortrait;
      else {
        const at = HP.wallSpot(s);
        temp = HP.make();
        temp.group.scale.setScalar(0.85);
        temp.group.position.copy(at.pos);
        temp.group.lookAt(at.pos.clone().add(at.normal));
        temp.setOpacity(0);
        s.scene.add(temp.group);
        spot = at.pos;
      }
      const pic = hung || temp;
      // Zoom until the portrait fills about half the screen.
      const base = W.camera.userData.baseFov, d = W.camera.position.distanceTo(spot);
      const fov = Math.max(16, Math.min(base, (2 * Math.atan(1.4 / d) * 180 / Math.PI) / 0.55));
      const bells = () => { A().sfx.bell(523, 0.35); setTimeout(() => A().sfx.bell(659, 0.3), 250); setTimeout(() => A().sfx.bell(784, 0.3), 500); };

      if (opts.discover && hung) {
        // "...what is that?" A glint at the edge of view, a whisper from that side.
        const gl = W.renderer.domElement, blur = v => { gl.style.filter = v > 0.05 ? `blur(${v.toFixed(2)}px)` : ''; };
        const toSpot = spot.clone().sub(r.pos), fwd = r.look.clone().sub(r.pos);
        const pan = Math.max(-0.9, Math.min(0.9, (fwd.z * toSpot.x - fwd.x * toSpot.z) / (fwd.length() * toSpot.length()) * -1.2));
        A().sfx.whisper(0.32, pan);
        tw(0.9, k => pic.setGlow(Math.sin(k * Math.PI) * 0.6));
        slot('sub', '<em class="ev-wonder">…what is that?</em>');
        await sleep(1100);
        // Turn to it, out of focus.
        A().sfx.creak(1.2, 0.8, 0.12);
        if (s.lights) tw(2.4, k => { s.lights.darkness = dark0 + (0.55 - dark0) * k; });
        tw(0.9, k => blur(k * 6));
        await HH.Cine.look([spot.x, spot.y - 0.15, spot.z], 2.2);
        slot('sub', '');
        // It comes into focus as the camera pushes in.
        bells();
        await tw(1.9, k => { r.fovKick = (fov - base) * k; blur(6 * (1 - k)); });
        blur(0);
      } else {
        A().sfx.whoosh(0.5);
        bells();
        if (s.lights) tw(1.2, k => { s.lights.darkness = dark0 + (0.55 - dark0) * k; });
        HH.Cine.look([spot.x, spot.y - 0.15, spot.z], 1.8);
        tw(1.8, k => { r.fovKick = (fov - base) * k; });
        if (temp) await tw(2.0, k => temp.setOpacity(k), 'out'); else await sleep(1800);
      }
      tw(1.0, k => pic.setGlow(k));
      A().sfx.bell(392, 0.3);

      slot('kicker', 'The Master of the House');
      slot('title', host.named ? `${esc(host.name)} raises a glass` : 'raises a glass');
      await sleep(2600);
      const toasts = e.toasts || [];
      if (toasts.length) {
        const line = toasts[Math.floor(Math.random() * toasts.length)];
        slot('sub', `“${esc(line)}”${host.named ? `<small>— ${esc(host.name)}</small>` : ''}`);
        await sleep(3400);
      }
      slot('sub', 'Everyone in the room: raise your glass!');
      await sleep(2600);
      slot('kicker', ''); slot('title', ''); slot('sub', '');
      for (const n of [3, 2, 1]) { slot('big', String(n)); A().sfx.drum(0.9); await sleep(900); }
      slot('big', esc(e.shout || 'Cheers!'));
      el.classList.add('burst');
      A().sfx.clink(0.6); setTimeout(() => A().sfx.clink(0.5), 180);
      A().sfx.bell(523, 0.25); A().sfx.bell(784, 0.2);
      const sparks = $('screen-event').querySelector('.ev-sparks');
      sparks.innerHTML = Array.from({ length: 46 }, () => {
        const a = Math.random() * Math.PI * 2, d = 160 + Math.random() * 420;
        return `<i style="--x:${(Math.cos(a) * d).toFixed(0)}px;--y:${(Math.sin(a) * d).toFixed(0)}px;--d:${(Math.random() * 0.3).toFixed(2)}s"></i>`;
      }).join('');
      await sleep(3400);
      // A portrait toast doesn't hold back the random events.
      if (opts.discover) HH.State.logEvent(e.id, { portrait: opts.discover }, false); else HH.State.logEvent(e.id);
      sparks.innerHTML = '';
      close();

      // The portrait fades (or stops glowing) and the camera returns to the game.
      tw(1.0, k => pic.setGlow(1 - k));
      if (temp) tw(1.2, k => temp.setOpacity(1 - k), 'in').then(() => s.scene.remove(temp.group));
      HH.Cine.look([look0.x, look0.y, look0.z], 1.4);
      if (s.lights) tw(1.4, k => { s.lights.darkness = 0.55 + (dark0 - 0.55) * k; });
      const kick0 = r.fovKick;
      await tw(1.4, k => { r.fovKick = kick0 * (1 - k); });
      r.fovKick = 0;
    }
  };

  // Cards for the house-rules screen, one per event.
  function rulesHTML() {
    const host = HH.Roster.host();
    return HH.EVENTS.list.filter(e => TYPES[e.type] && e.rule).map(e => `
      <div class="rule rule-${e.type}">
        <div class="rule-icon">${e.type === 'cheers' ? HH.Roster.avatar(host, 'mid') : '<div class="rule-moon"></div>'}</div>
        <div><h3>${esc(e.title)}</h3><p>${esc(e.type === 'cheers' && host.named ? e.rule.replace('the Master of the House', host.name + ', the Master of the House,') : e.rule)}</p></div>
      </div>`).join('');
  }

  function renderHost() {
    const box = $('host-events');
    if (!box) return;
    box.innerHTML = '<span>Events</span>' +
      HH.EVENTS.list.filter(e => TYPES[e.type]).map(e => `<button data-event="${esc(e.id)}">${esc(e.title)}</button>`).join('') +
      `<button data-event-random class="${randomOn ? 'on' : ''}">Random: ${randomOn ? 'on' : 'off'}</button>`;
  }

  return {
    roll, delay, rulesHTML, renderHost,
    play(e, opts) { return TYPES[e.type](e, opts || {}); },
    queue(e) { queued.push(e); },
    takeQueued() { return queued.shift() || null; },
    get random() { return randomOn; },
    setRandom(on) { randomOn = on; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (err) { /* ignore */ } renderHost(); },
    find(id) { return HH.EVENTS.list.find(e => e.id === id); }
  };
})();
