/* ==========================================================================
   Game flow: setup -> turn card -> cutscenes -> choices / challenges ->
   death (forfeit) or failed challenge -> team switch -> ... -> escape.
   Also the HUD and the host panel.
   ========================================================================== */

window.HH = window.HH || {};

HH.Game = (function () {
  const S = HH.State, M = HH.Mansion, W = HH.World, C = HH.Cine, A = HH.Audio;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const sceneKey = s => (typeof s === 'string' ? s : JSON.stringify(s));

  let mode = 'loading';
  let busy = false;
  let fireworkTimer = null;
  let deathAdvance = null, failAdvance = null;
  let liveChallenge = null;

  const SKULL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C6.9 2 3 5.6 3 10.3c0 2.7 1.3 4.6 3 5.8V19c0 .6.4 1 1 1h1.5v-2h1.5v2h4v-2h1.5v2H17c.6 0 1-.4 1-1v-2.9c1.7-1.2 3-3.1 3-5.8C21 5.6 17.1 2 12 2Zm-3.5 11.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm7 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM12 16l-1.2-2h2.4L12 16Z"/></svg>';

  const DAGGER = '<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(45 12 12)" fill="currentColor"><path d="M12 1.5 14 5v9h3.5v2h-4.3v4h-2.4v-4H6.5v-2H10V5z"/><circle cx="12" cy="21.4" r="1.6"/></g></svg>';

  function show(id, on = true) { $(id).classList.toggle('show', on); }
  function hideAll() { HH.Wheel.abort(); HH.Weapon.hide(); document.querySelectorAll('.screen.show, .panel.show').forEach(e => e.classList.remove('show')); }
  function challengeLoc(id) {
    const k = Object.keys(HH.MANSION.locations).find(l => (HH.MANSION.locations[l].challenge || {}).id === id);
    return k ? M.get(k) : null;
  }

  /* ================= boot ================= */
  function boot() {
    W.init($('gl'));
    W.prewarm(M.scenes());
    const ext = W.use('exterior');
    W.home(ext); ext.idle = true;
    M.validate();
    HH.Roster.init({ onBegin: beginNewGame, onResume: resumeSaved });
    bindUI();
    W.onFrame(grain());
    try { const v = parseFloat(localStorage.getItem('theHauntedHouse.volume')); if (!isNaN(v)) { A.setVolume(v); $('vol').value = v; } } catch (e) { /* ignore */ }
    show('screen-loading', false);
    showSetup();
    C.fade(0, 3);
  }

  function unlockAudio() {
    A.init();
    if (W.current) A.ambience(W.current.ambience || 'interior');
  }

  /* ================= setup ================= */
  function showSetup() {
    mode = 'setup';
    document.body.classList.remove('in-game');
    hideAll();
    HH.Roster.showSetup({ hasSave: S.hasSave(), saved: S.peek() });
  }

  async function beginNewGame(spec) {
    unlockAudio(); A.sfx.boom(0.7);
    S.newGame(spec);
    // Every game starts fresh: the first team sees each scene in full, repeats play short.
    HH.Pace.forget();
    mode = 'rules';
    await showRules();
    if (HH.MANSION.randomFirstTeam !== false) S.setActive(await flipFirstTeam());
    startTurn();
  }

  // The house rules, read out once at the start (and from the host panel).
  function showRules(buttonLabel = 'Let the night begin') {
    return new Promise(res => {
      $('rules-events').innerHTML = HH.Events.rulesHTML();
      $('btn-rules').textContent = buttonLabel;
      $('btn-rules').onclick = () => { A.sfx.ui(); show('screen-rules', false); res(); };
      A.sfx.bell(98, 0.4);
      show('screen-rules');
    });
  }

  // Two candles, one per team. They flicker back and forth; one goes out.
  async function flipFirstTeam() {
    mode = 'flip';
    const winner = HH.Kit.rand(2);
    const el = $('screen-flip');
    [0, 1].forEach(i => {
      $('flip' + i).className = 'flip-candle';
      $('flip' + i).querySelector('.plate').textContent = S.team(i).name;
    });
    $('flip-result').textContent = '';
    el.classList.add('show');
    await sleep(1400);
    let delay = 90, i = winner;
    const steps = 14 + HH.Kit.rand(2);   // ends on the winner either way
    for (let n = 0; n < steps || i !== winner; n++) {
      i = 1 - i;
      $('flip' + i).classList.add('glow'); $('flip' + (1 - i)).classList.remove('glow');
      A.sfx.crackle(0.3);
      await sleep(delay);
      delay = Math.min(420, delay * 1.13);
    }
    $('flip' + (1 - winner)).classList.add('out');
    A.sfx.whoosh(0.6);
    await sleep(800);
    A.sfx.bell(147, 0.5);
    $('flip-result').textContent = `${S.team(winner).name} enters first`;
    await sleep(2600);
    el.classList.remove('show');
    return winner;
  }

  function resumeSaved() {
    unlockAudio(); A.sfx.boom(0.7);
    if (!S.load()) return showSetup();
    startTurn();
  }

  /* ================= turns ================= */
  // Put the room's props in the right state for this team (door shut or open).
  function prepareSet(set, loc, i) {
    if (!loc.challenge) return;
    if (S.hasCompleted(i, loc.challenge.id)) { if (set.solved) set.solved(); }
    else if (set.reset) set.reset();
  }

  // Tidy the next room before it's on screen, so no team walks in on the
  // other team's leftovers (an angry ghost, an open gate, cards on the table).
  function prepareAhead(to) {
    if (!to || to.type === 'exit' || to.type === 'start') return;
    const set = W.peek(to.scene);
    if (set !== W.current) prepareSet(set, to, S.activeIndex());
  }

  function startTurn(opts = {}) {
    mode = 'turn';
    hideAll(); HH.Markers.clear();
    document.body.classList.add('in-game');
    C.letterbox(false);
    const i = S.activeIndex(), t = S.active();
    const loc = M.get(t.started ? t.checkpoint : HH.MANSION.startLocation);
    const set = W.use(loc.type === 'start' ? 'exterior' : loc.scene);
    W.home(set);
    set.idle = !t.started;
    prepareSet(set, loc, i);
    hud();

    const reason = opts.died != null ? 'died' : opts.failed != null ? 'failed' : opts.passed != null ? 'passed' : null;
    const prev = reason ? S.team(opts.died ?? opts.failed ?? opts.passed).name : '';
    const card = $('screen-turn');
    card.classList.toggle('after-death', !!reason);
    card.classList.toggle('after-fail', reason === 'failed');
    $('turn-died').textContent = { died: `${prev} has died`, failed: `${prev} failed the challenge`, passed: `${prev} ends its turn` }[reason] || '';
    $('turn-team').textContent = t.name;
    // Where the team picks up stays a surprise until it gets there.
    $('turn-sub').textContent = !t.started ? 'Your team stands before the mansion.' :
      t.pendingChallenge ? 'Unfinished business is waiting.' : 'The house remembers where you left off.';
    $('btn-turn').textContent = t.started ? 'CONTINUE' : 'START';
    // A team that hasn't started sees the mansion behind the card; any other team sees black.
    if (reason) {
      C.black(true);
      A.sfx.boom(1);
      setTimeout(() => A.sfx.bell(73.4, 0.5), 1500);
      if (!t.started) C.fade(0.15, 3);
    } else if (t.started) {
      C.black(true);
    } else {
      C.fade(0, 1);
    }
    show('screen-turn');
  }

  async function beginTurn() {
    if (mode !== 'turn') return;
    unlockAudio(); A.sfx.ui();
    show('screen-turn', false);
    await playQueued();
    const t = S.active();
    W.current.idle = false;
    if (!t.started) {
      const start = M.get(HH.MANSION.startLocation);
      await runCutscene(start.enter.cutscene, { team: t, from: start, to: M.get(start.enter.to), choice: null });
      await arrive(start.enter.to);
    } else {
      const loc = M.get(t.checkpoint);
      C.black(true);
      await runCutscene('resume', { team: t, loc });
      await arrive(loc.id, { resumed: true });
    }
  }

  // The pacing key a cutscene uses, and how much faster its quick version runs.
  function paceFor(name, ctx) {
    if (name === 'escape') return null;
    if (name === 'enterMansion') return { key: 'cut:enterMansion', speed: 1 };
    if (name === 'resume') return { key: 'walk:resume', speed: 1.8 };
    if (name === 'demonChase') return { key: `chase:${ctx.from.id}:${ctx.outcome}`, speed: 1.4 };
    if (/Death$/.test(name)) return { key: `death:${ctx.from && ctx.from.id}:${ctx.choice && ctx.choice.anchor}`, speed: 1.5 };
    if (ctx.from && ctx.to) return { key: `walk:${ctx.from.id}->${ctx.to.id}`, speed: 1.8 };
    return null;
  }

  async function runCutscene(name, ctx) {
    mode = 'cutscene'; busy = true;
    document.body.classList.add('busy');
    HH.Markers.clear(); show('prompt', false);
    const pace = paceFor(name, ctx);
    ctx.quick = pace ? HH.Pace.quick(pace.key) : !!ctx.quick;
    HH.Tween.speed = ctx.quick && pace ? pace.speed : 1;
    try {
      const fn = HH.Cutscenes[name];
      if (fn) await fn(ctx); else console.warn('[cutscene] missing:', name);
    } catch (e) { console.error('[cutscene]', name, e); }
    HH.Tween.speed = 1;
    busy = false;
    document.body.classList.remove('busy');
  }

  async function arrive(locId, opts = {}) {
    const i = S.activeIndex(), t = S.active(), loc = M.get(locId);
    S.arrive(i, locId);
    hud();
    if (loc.type === 'exit') return win(i);

    if (!W.current || W.current.key !== sceneKey(loc.scene)) {
      await C.fade(1, 0.5);
      W.home(W.use(loc.scene));
      prepareSet(W.current, loc, i);
      await C.fade(0, 0.8);
    }
    prepareSet(W.current, loc, i);
    C.fade(0, 0.6);
    mode = 'cutscene';
    // Seen this room before: short title, no establishing pan.
    const quick = HH.Pace.quick('arrive:' + loc.id);
    const titled = C.title(opts.resumed ? 'CHECKPOINT' : (loc.label || ''), loc.name, opts.resumed ? `${t.name} returns` : '', quick ? 1.6 : 3.2);
    if (!opts.resumed && !quick && loc.arrival && HH.Cutscenes[loc.arrival]) await runCutscene(loc.arrival, { team: t, loc });
    await titled;
    C.letterbox(false);
    await portraitEncounter(loc);
    if (loc.challenge && !S.hasCompleted(i, loc.challenge.id)) return runChallenge(loc);
    // Beaten already but never walked on (e.g. a refresh mid-walk): continue to the next room.
    if (loc.challenge && loc.onComplete && !M.choicesFor(loc, t).length) return challengeWon(loc);
    presentChoices(loc);
  }

  /* ================= choices ================= */
  async function presentChoices(loc, skipEvent) {
    const t = S.active(), choices = M.choicesFor(loc, t);
    if (!choices.length) return showDeadEnd(loc);
    if (!skipEvent) await playQueued();
    mode = 'choosing';
    const set = W.current;
    HH.Markers.show(choices.map(c => ({ key: c.key, label: c.label, anchor: (set.anchors && set.anchors[c.anchor]) || null })), idx => choose(choices[idx]));
    $('prompt-team').textContent = t.name;
    $('prompt-text').textContent = loc.prompt || 'Choose your path.';
    $('prompt-keys').textContent = choices.map(c => c.key).join(' · ');
    show('prompt');
    armSurprise();
  }

  async function choose(c) {
    if (mode !== 'choosing') return;
    disarmSurprise();
    mode = 'cutscene';
    A.sfx.whoosh(0.25);
    const i = S.activeIndex(), t = S.active(), from = M.get(t.location);
    show('prompt', false);
    await sleep(700);
    S.recordChoice(i, from.id, c);
    const to = c.to ? M.get(c.to) : null;
    if (c.chase) return chase(c, from, to);
    if (!c.fatal) prepareAhead(to);
    await runCutscene(c.cutscene || (c.fatal ? 'demonDeath' : 'genericWalk'), { team: t, from, to, choice: c });
    if (c.fatal) return death(c);
    await arrive(c.to);
  }

  // A way out the demon guards (choice.chase, the last door of the house). A
  // team holding the weapon fights it off and walks on. Any other team is
  // caught and dies, but only once: on its next turn the demon has fed and
  // the way is clear.
  async function chase(c, from, to) {
    const i = S.activeIndex(), t = S.active(), key = 'chase:' + from.id;
    const outcome = S.hasFlag(i, c.chase.unless) ? 'armed' : S.getProgress(i, key) ? 'clear' : 'caught';
    await runCutscene('demonChase', { team: t, from, to, choice: c, outcome });
    if (outcome === 'caught') {
      S.setProgress(i, key, 'caught');
      return death(c);
    }
    if (outcome === 'armed') await HH.Kit.banner('The demon flees', `${itemName(c.chase.unless) || 'The weapon'} drove it back. The way out is yours.`, { tone: 'good', hold: 2.8 });
    else await HH.Kit.banner('The demon has fed', 'It caught you last time. Now the way out is clear.', { tone: 'info', hold: 2.8 });
    await runCutscene(c.cutscene || 'genericWalk', { team: t, from, to, choice: c });
    await arrive(to.id);
  }

  // Rewards a challenge can give (challenge.bonus), by flag: the HUD and host panel show them.
  function items() {
    return Object.values(HH.MANSION.locations).map(l => l.challenge && l.challenge.bonus).filter(Boolean);
  }
  function itemName(flag) {
    const b = items().find(x => x.flag === flag);
    return b && b.item ? b.item[0].toUpperCase() + b.item.slice(1) : '';
  }

  /* ================= room-wide events (js/events.js) ================= */
  // Events the host queued start at the next turn or decision.
  async function playQueued() {
    const ev = HH.Events.takeQueued();
    if (ev) await playEvent(ev);
  }

  // Random events strike without warning while a team is still talking a
  // decision over. A rolled event stays pending until it gets its moment.
  const surprise = { ev: null, timer: null };
  function armSurprise() {
    clearTimeout(surprise.timer);
    if (!surprise.ev) surprise.ev = HH.Events.roll();
    if (surprise.ev) surprise.timer = setTimeout(fireSurprise, HH.Events.delay());
  }
  function disarmSurprise() { clearTimeout(surprise.timer); surprise.timer = null; }
  async function fireSurprise() {
    if (mode !== 'choosing' || !surprise.ev) return;
    const ev = surprise.ev;
    surprise.ev = null;
    await playEvent(ev);
    presentChoices(M.get(S.active().location), true);
  }

  async function playEvent(ev, opts) {
    const prev = mode;
    mode = 'event';
    HH.Markers.clear(); show('prompt', false);
    document.body.classList.add('in-event');
    try { await HH.Events.play(ev, opts); } catch (e) { console.error('[event]', ev.id, e); }
    HH.World.renderer.domElement.style.filter = '';
    document.body.classList.remove('in-event');
    mode = prev;
  }

  // A portrait of the host hangs in this room and hasn't raised its glass yet:
  // the camera notices it, looks, and the Master of the House leads a toast.
  async function portraitEncounter(loc) {
    const set = W.current, per = HH.EVENTS.portraitToasts || 'game', e = HH.Events.find('cheers');
    if (!set || !set.hostPortrait || !e || per === 'off') return;
    const key = per === 'team' ? `${loc.id}:${S.activeIndex()}` : loc.id;
    if (((S.data.events || {}).log || []).some(x => x.portrait === key)) return;
    await playEvent(e, { discover: key });
  }

  // From the host panel: now if the game is waiting on the players, otherwise at the next safe moment.
  async function hostEvent(id) {
    const ev = HH.Events.find(id);
    if (!ev || !S.data) return flashNote('Start a game first.');
    if (mode === 'choosing') {
      disarmSurprise();
      await playEvent(ev);
      presentChoices(M.get(S.active().location), true);
    } else if (mode === 'turn') {
      show('screen-turn', false);
      await playEvent(ev);
      show('screen-turn');
    } else {
      HH.Events.queue(ev);
      flashNote(`${ev.title} starts at the next safe moment.`);
    }
  }

  /* ================= challenges ================= */
  async function runChallenge(loc) {
    mode = 'challenge';
    const i = S.activeIndex(), t = S.active(), ch = loc.challenge;
    const mod = HH.Challenges[ch.type] || HH.Challenges.placeholder;
    document.body.classList.add('in-challenge');
    const ctx = HH.Kit.context({ set: W.current, loc, challenge: ch, team: t, teamIndex: i, quick: HH.Pace.quick('intro:' + ch.id) });
    liveChallenge = ctx;
    renderHost();
    let result;
    try {
      result = await Promise.race([mod.run(ctx), ctx.forced]);
    } catch (e) {
      console.error('[challenge]', ch.type, e);
      toggleHost(true);
      flashNote('The challenge hit an error. Use Force success or Force fail.', 8000);
      result = await ctx.forced;
    }
    ctx.end();
    liveChallenge = null;
    document.body.classList.remove('in-challenge');
    renderHost();
    return result === 'success' ? challengeWon(loc) : challengeLost(loc, ctx.failNote);
  }

  async function challengeWon(loc) {
    S.completeChallenge(S.activeIndex(), loc.challenge.id);
    hud();
    await punishmentWheel(loc);
    if (loc.onComplete) {
      const to = M.get(loc.onComplete.to);
      prepareAhead(to);
      await runCutscene(loc.onComplete.cutscene || 'throughDoor', { team: S.active(), from: loc, to, choice: null });
      return arrive(to.id);
    }
    presentChoices(loc);
  }

  // The winners spin the Wheel of Bones for the other team. Remembered per
  // challenge, so a refresh after the spin doesn't spin again.
  async function punishmentWheel(loc) {
    const i = S.activeIndex(), key = 'wheel:' + loc.challenge.id;
    if (loc.challenge.wheel === false || S.getProgress(i, key)) return;
    mode = 'wheel';
    C.letterbox(false);
    const o = await HH.Wheel.forChallenge(S.active(), S.team(S.otherIndex()), loc);
    S.setProgress(i, key, o.label);
  }

  // Not a death: no demon, no forfeit. The team spins the Wheel of Bones for its
  // punishment, keeps its place and retries next turn.
  async function challengeLost(loc, note) {
    mode = 'failed';
    const i = S.activeIndex(), t = S.active();
    S.failChallenge(i, loc.challenge.id);
    hud();
    C.letterbox(false);
    C.fade(0.6, 1.2);
    A.sfx.failSting();
    $('failed-msg').textContent = note || `${t.name} must face ${loc.name} again on its next turn.`;
    show('screen-failed');
    await new Promise(res => { failAdvance = res; setTimeout(res, HH.Pace.quick('screen:failed') ? 4000 : 6000); });
    failAdvance = null;
    show('screen-failed', false);
    if (loc.challenge.wheel !== false) await HH.Wheel.forFailure(t, loc);
    S.switchTeam();
    startTurn({ failed: i });
  }

  function showDeadEnd() {
    mode = 'deadend';
    $('deadend-other').textContent = S.team(S.otherIndex()).name;
    show('panel-deadend');
  }

  /* ================= death, forfeit, switching ================= */
  async function death(choice) {
    mode = 'death';
    const i = S.activeIndex();
    S.die(i);
    hud();
    C.black(true); C.letterbox(false);
    A.sfx.deathSting(0.9);
    const d = Object.assign({}, HH.MANSION.deathDefaults, choice && choice.death);
    $('death-title').textContent = d.title;
    $('death-msg').textContent = d.message;
    show('screen-death');
    await new Promise(res => { deathAdvance = res; setTimeout(res, HH.Pace.quick('screen:death') ? 4000 : 6000); });
    deathAdvance = null;
    show('screen-death', false);
    showForfeit(choice);
  }

  function showForfeit(choice) {
    mode = 'forfeit';
    const text = M.pickForfeit(choice);
    $('forfeit-team').textContent = S.active().name;
    $('forfeit-text').innerHTML = text ? esc(text) :
      '<span class="placeholder">[ Forfeit to be announced ]</span><small>Add real forfeits to HH.MANSION.forfeits in js/mansion-data.js</small>';
    A.sfx.boom(0.6);
    show('screen-forfeit');
  }

  function forfeitDone() {
    if (mode !== 'forfeit') return;
    A.sfx.ui();
    show('screen-forfeit', false);
    const dead = S.activeIndex();
    S.switchTeam();
    startTurn({ died: dead });
  }

  function passTurn() {
    if (busy || mode === 'challenge' || HH.Wheel.active) return;
    const was = S.activeIndex();
    S.switchTeam();
    startTurn({ passed: was });
  }

  /* ================= winning ================= */
  async function win(i) {
    S.win(i);
    hud();
    hideAll();
    await runCutscene('escape', { team: S.team(i) });
    mode = 'won';
    document.body.classList.remove('in-game');
    const t = S.team(i), o = S.team(1 - i);
    $('win-team').textContent = `${t.name} wins!`;
    $('win-deaths').textContent = t.deaths === 0 ? 'Escaped without a single death.' : `Total deaths: ${t.deaths}`;
    $('win-other').textContent = `${o.name}: ${o.deaths} ${o.deaths === 1 ? 'death' : 'deaths'}, still trapped inside.`;
    show('screen-win');
    clearInterval(fireworkTimer);
    const cols = [0xff7a1a, 0xa04aff, 0x6aff8a, 0xffd04a, 0xff3a6a];
    fireworkTimer = setInterval(() => {
      const ext = W.current;
      if (mode === 'won' && ext && ext.firework) ext.firework(new THREE.Vector3(-14 + Math.random() * 28, 20 + Math.random() * 12, -30 + Math.random() * 10), cols[Math.floor(Math.random() * cols.length)]);
    }, 1500);
  }

  function restart() {
    clearInterval(fireworkTimer);
    if (liveChallenge) { liveChallenge.end(); liveChallenge = null; }
    S.clear();
    hideAll(); HH.Markers.clear();
    HH.Tween.speed = 1;
    A.heartbeat(0);
    document.body.classList.remove('in-challenge');
    const ext = W.use('exterior');
    W.home(ext); ext.idle = true;
    C.letterbox(false);
    C.black(true); C.fade(0, 2);
    showSetup();
  }

  /* ================= HUD ================= */
  function hud() {
    const d = S.data;
    if (!d) return;
    const total = M.routeLength();
    d.teams.forEach((t, i) => {
      const el = $('team' + i);
      el.classList.toggle('active', i === d.active);
      el.querySelector('.name').textContent = t.name;
      el.querySelector('.deaths').innerHTML = SKULL + `<b>${t.deaths}</b>` +
        items().filter(b => t.flags[b.flag]).map(b => `<span class="item" title="${esc(itemName(b.flag))}">${DAGGER}</span>`).join('');
      const filled = t.started ? Math.round(M.progress(t.location) * total) : 0;
      el.querySelector('.pips').innerHTML = Array.from({ length: total }, (_, k) => `<i class="${k < filled ? 'on' : ''}"></i>`).join('');
      el.querySelector('.status').textContent = t.pendingChallenge ? 'Retry pending' : '';
    });
    // While a returning team's turn card is up, the room stays a secret.
    const loc = M.get(S.active().location), secret = mode === 'turn' && S.active().started;
    $('hud-loc-kicker').textContent = secret ? '' : loc.label || '';
    $('hud-loc-name').textContent = secret ? '' : S.active().started ? loc.name : 'Outside the mansion';
    renderHost();
  }

  /* ================= host panel ================= */
  function renderHost() {
    const d = S.data, box = $('host-teams');
    $('host-force-win').disabled = $('host-force-fail').disabled = !liveChallenge;
    document.querySelectorAll('[data-pace]').forEach(b => b.classList.toggle('on', b.dataset.pace === HH.Pace.mode));
    HH.Events.renderHost();
    if (!d) { box.innerHTML = '<p class="muted">No game running.</p>'; return; }
    const opts = M.list().map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('');
    box.innerHTML = d.teams.map((t, i) => {
      const pend = t.pendingChallenge && challengeLoc(t.pendingChallenge);
      return `
      <div class="host-team ${i === d.active ? 'active' : ''}">
        <div class="row"><input data-act="rename" data-i="${i}" value="${esc(t.name)}" aria-label="Team ${i + 1} name"></div>
        <div class="row small">Deaths <button data-act="dec" data-i="${i}">−</button><b>${t.deaths}</b><button data-act="inc" data-i="${i}">+</button>
          <span class="muted">· ${t.players.length} players · at ${esc(M.get(t.location).name)}</span></div>
        ${pend ? `<div class="row small warn">Must retry: ${esc(pend.name)}</div>` : ''}
        <div class="row"><select data-i="${i}" aria-label="Checkpoint">${opts}</select><button data-act="setcp" data-i="${i}">Set checkpoint</button></div>
        ${items().map(b => `<label class="row small"><input type="checkbox" data-flag="${esc(b.flag)}" data-i="${i}" ${t.flags[b.flag] ? 'checked' : ''}> Has ${esc(b.item || b.flag)}</label>`).join('')}
        <div class="row"><button data-act="reset" data-i="${i}">Reset to start</button><button data-act="active" data-i="${i}" ${i === d.active ? 'disabled' : ''}>Make active</button></div>
      </div>`;
    }).join('');
    d.teams.forEach((t, i) => { box.querySelector(`select[data-i="${i}"]`).value = t.checkpoint; });
  }

  function hostAction(e) {
    const b = e.target.closest('[data-act]');
    if (!b || !S.data || b.tagName === 'INPUT') return;
    const i = +b.dataset.i, act = b.dataset.act;
    if ((busy || liveChallenge) && act !== 'inc' && act !== 'dec') return flashNote('Wait for the cutscene or challenge to end (or force/skip it).');
    if (act === 'inc' || act === 'dec') S.setDeaths(i, S.team(i).deaths + (act === 'inc' ? 1 : -1));
    if (act === 'setcp') S.setCheckpoint(i, $('host-teams').querySelector(`select[data-i="${i}"]`).value);
    if (act === 'reset') S.resetTeam(i);
    if (act === 'active') S.setActive(i);
    if ((act === 'setcp' || act === 'reset') && i === S.activeIndex() && S.team(i).location === 'exit') { hideAll(); arrive('exit'); return; }
    if (act === 'setcp' || act === 'reset' || act === 'active') { if (i === S.activeIndex() || act === 'active') startTurn(); }
    hud();
  }

  function flashNote(msg, ms = 2500) {
    const n = $('host-note'); n.textContent = msg; n.classList.add('show');
    clearTimeout(flashNote.t); flashNote.t = setTimeout(() => n.classList.remove('show'), ms);
  }

  function skip() { if (busy) HH.Tween.speed = 8; }

  function force(result) {
    if (!liveChallenge) return flashNote('No challenge is running.');
    liveChallenge.force(result);
  }

  function testEscape() {
    if (!S.data || busy || liveChallenge) return flashNote(S.data ? 'Wait for the cutscene or challenge to end.' : 'Start a game first.');
    hideAll(); HH.Markers.clear();
    arrive('exit');
  }

  let restartArmed = false;
  function restartClick(btn) {
    if (!restartArmed) {
      restartArmed = true; btn.textContent = 'Click again to restart';
      setTimeout(() => { restartArmed = false; btn.textContent = 'Restart entire game'; }, 3000);
      return;
    }
    restartArmed = false; btn.textContent = 'Restart entire game';
    restart();
  }

  function toggleHost(force) {
    const p = $('host');
    const on = force === undefined ? !p.classList.contains('show') : force;
    p.classList.toggle('show', on);
    if (on) renderHost();
  }

  function fullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen && document.exitFullscreen();
  }

  /* ================= film grain ================= */
  function grain() {
    const cv = $('fx-grain'), g = cv.getContext('2d');
    cv.width = 192; cv.height = 108;
    const img = g.createImageData(cv.width, cv.height);
    let frame = 0;
    return () => {
      if (frame++ % 2) return;
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      g.putImageData(img, 0, 0);
    };
  }

  /* ================= wiring ================= */
  function bindUI() {
    document.addEventListener('pointerdown', unlockAudio, { once: true });
    $('btn-turn').onclick = beginTurn;
    $('btn-pass').onclick = passTurn;
    $('btn-test-escape').onclick = testEscape;
    $('btn-again').onclick = restart;
    $('btn-forfeit').onclick = forfeitDone;
    $('screen-death').onclick = () => deathAdvance && deathAdvance();
    $('screen-failed').onclick = () => failAdvance && failAdvance();
    $('btn-host').onclick = () => toggleHost();
    $('btn-host-close').onclick = () => toggleHost(false);
    $('host-skip').onclick = skip;
    $('host-pass').onclick = () => { if (S.data && !busy && !liveChallenge && mode !== 'won') passTurn(); };
    $('host-escape').onclick = testEscape;
    $('host-fullscreen').onclick = fullscreen;
    $('host-restart').onclick = e => restartClick(e.currentTarget);
    $('host-force-win').onclick = () => force('success');
    $('host-force-fail').onclick = () => force('fail');
    $('host-players').onclick = () => {
      HH.Roster.openEditor(S.data, spec => {
        if (!S.data) return;
        spec.forEach((t, i) => { S.rename(i, t.name); S.setPlayers(i, t.players); });
        hud();
      });
    };
    $('host-quiz').onclick = () => HH.QuizBank.openEditor();
    document.querySelectorAll('[data-pace]').forEach(b => {
      b.onclick = () => {
        HH.Pace.setMode(b.dataset.pace); renderHost();
        flashNote({ auto: 'Full the first time, short after that.', full: 'Every cinematic plays in full.', quick: 'Every cinematic plays short.' }[b.dataset.pace]);
      };
    });
    $('host-forget').onclick = () => { HH.Pace.forget(); flashNote('Every cinematic will play in full again.'); };
    $('host-rules').onclick = async () => {
      if (!S.data || busy || liveChallenge || mode === 'event' || mode === 'rules') return flashNote('Wait for the current scene to finish.');
      const prev = mode;
      disarmSurprise();
      mode = 'rules';
      await showRules('Back to the game');
      mode = prev;
      if (mode === 'choosing') armSurprise();
    };
    $('host-events').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-event-random')) {
        HH.Events.setRandom(!HH.Events.random);
        flashNote(HH.Events.random ? 'Random events are on.' : 'Random events are off. Use the buttons to start one.');
      } else if (b.dataset.event) hostEvent(b.dataset.event);
    });
    $('host-teams').addEventListener('click', hostAction);
    $('host-teams').addEventListener('change', e => {
      if (e.target.dataset.flag) { S.setFlag(+e.target.dataset.i, e.target.dataset.flag, e.target.checked); hud(); }
      if (e.target.dataset.act === 'rename') { S.rename(+e.target.dataset.i, e.target.value.trim() || `Team ${+e.target.dataset.i + 1}`); hud(); }
    });
    $('btn-mute').onclick = () => { unlockAudio(); const m = A.toggleMute(); $('btn-mute').classList.toggle('muted', m); };
    $('vol').oninput = e => {
      unlockAudio(); A.setVolume(+e.target.value);
      try { localStorage.setItem('theHauntedHouse.volume', e.target.value); } catch (err) { /* ignore */ }
    };

    document.addEventListener('keydown', e => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (document.querySelector('.editor.show')) return;
      const k = e.key.toUpperCase();
      if (k === 'H') return toggleHost();
      if (k === 'F') return fullscreen();
      if (k === 'M') return $('btn-mute').click();
      if (k === 'K') return skip();
      if ((mode === 'choosing' || mode === 'challenge') && HH.Kit.handleKey(e)) return;
      if (e.key === 'Enter' || e.key === ' ') {
        if (HH.Wheel.active) HH.Wheel.press();
        else if (mode === 'rules') $('btn-rules').click();
        else if (mode === 'turn') beginTurn();
        else if (mode === 'death' && deathAdvance) deathAdvance();
        else if (mode === 'failed' && failAdvance) failAdvance();
      }
    });
  }

  return { boot, get mode() { return mode; }, force, hostEvent, get challenge() { return liveChallenge; } };
})();

window.addEventListener('load', () => {
  if (!window.THREE) {
    document.getElementById('loading-text').textContent = 'Could not load Three.js. Check the internet connection, or see README for playing offline.';
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(HH.Game.boot, 30)));
});
