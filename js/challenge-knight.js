/* ==========================================================================
   Challenge: THE KNIGHT'S DRINKING DUEL (physical, one representative,
   host-confirmed). The team nominates its champion first; the champion then
   picks one of four cups. Each cup hides how long the knight takes to drain
   it (shuffled on every attempt), and that time is never shown: the champion
   only sees the knight drink and a bar running down. The host records who
   finished first. On a retry the last champion is marked, and the team can
   send them again or choose someone else.
   Data: challenge: { id, type: 'knightDuel', durations: [3, 5, 10, 25] }
   ========================================================================== */

HH.Challenges.knightDuel = {
  async run(ctx) {
    const s = ctx.set, ui = ctx.ui, A = HH.Audio, W = HH.World, S = HH.State, ch = ctx.challenge;
    const durations = HH.Kit.shuffle(ch.durations || [3, 5, 10, 25]);
    ctx.durations = durations; // for testing from the console; never shown on screen

    s.reset();
    await HH.Cutscenes.helpers.toView(s, 2.0, 'wood');
    s.knight.wake();
    A.sfx.voice(0.6, 0.75);
    await ui.banner(ctx.loc.tagline || 'Send me your champion. Defeat me, and you may pass.', '', { tone: 'voice', hold: ctx.quick ? 1.6 : 3.4 });

    // The champion first. A retry marks last time's champion; keep them or choose another.
    const last = (ctx.team.players || []).find(p => p.id === (S.getProgress(ctx.teamIndex, ch.id) || {}).champion) || null;
    const champ = await ui.pickPlayer(ctx.team, last ? 'Your champion: the same, or someone new?' : 'Nominate your champion', { current: last });
    if (champ) S.setProgress(ctx.teamIndex, ch.id, { champion: champ.id });
    const who = champ ? champ.name : 'Your champion';

    // The champion picks a cup. How fast the knight drains it stays his secret.
    A.sfx.voice(0.5, 0.7);
    await ui.banner(`${who}, choose your cup`, 'Each cup hides how fast I drink. Only I know.', { tone: 'voice', kicker: 'The knight', hold: ctx.quick ? 1.8 : 2.8 });
    const idx = await ui.pickInWorld(s.cups.map((c, i) => ({ key: 'ABCD'[i], label: c.name, anchor: s.anchors['cup' + i] })));
    const secs = durations[idx], cupName = s.cups[idx].name.toLowerCase();
    await s.sendCup(idx);
    A.sfx.drum(1.3); W.shake(0.2);
    await ui.banner(`The knight takes ${cupName}`, 'How fast will he drain it? You will find out.', { tone: 'info', kicker: 'Your cup', hold: ctx.quick ? 2.0 : 2.6 });

    await ui.prompt({
      kicker: 'The duel',
      title: `${who} versus the Knight`,
      text: 'Prepare the drink. When the host presses START DUEL, a 3-second countdown begins. Drink on "DRINK!" and finish before the knight does.',
      note: 'Water or a non-alcoholic drink works just as well.',
      keys: false,
      buttons: [{ label: 'Start duel', value: true, primary: true }]
    });

    await ui.countdown(3, 'DRINK!');
    const duel = s.drink(secs);
    let finished = false, stop = false;
    duel.done.then(() => { finished = true; });
    // Only the bar: no seconds anywhere.
    ui.gauge(true, 'The knight drinks');
    const t0 = performance.now();
    (function tick() {
      if (stop || !ctx.alive()) return;
      const e = (performance.now() - t0) / 1000;
      ui.gaugeSet(Math.max(0, 1 - e / secs), finished ? 'The knight has finished!' : '');
      requestAnimationFrame(tick);
    })();

    // Live from "DRINK!": the host decides, whatever the knight is doing.
    const result = await ui.host({
      label: 'Who finished first?',
      buttons: [
        { label: 'Team wins', value: 'team', tone: 'good' },
        { label: 'Knight wins', value: 'knight', tone: 'bad' }
      ]
    });
    stop = true;
    ui.gauge(false);

    if (result === 'team') {
      await s.knightDefeated();
      await ui.banner('The knight yields', `${who} out-drank the dead. You may pass.`, { tone: 'good', hold: 2.8 });
      return 'success';
    }
    if (!finished) duel.finishNow();
    await duel.done;
    await s.knightLaughs();
    await ui.banner('You lost the duel', 'The knight drinks to your defeat.', { tone: 'bad', hold: 2.8 });
    return 'fail';
  }
};
