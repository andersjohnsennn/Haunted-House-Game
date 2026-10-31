/* ==========================================================================
   Challenge: THE SACRIFICE CHAMBER (physical, host-confirmed).
   Accept or refuse; then N rounds, each picking one random player of the
   active team. Unique picks when the team has at least N players. Any
   refusal fails the whole challenge. A retry starts again from round 1.
   Data: challenge: { id, type: 'sacrifice', rounds: 3 }
   ========================================================================== */

HH.Challenges.sacrifice = {
  async run(ctx) {
    const s = ctx.set, ui = ctx.ui, A = HH.Audio, W = HH.World;
    const rounds = ctx.challenge.rounds || 3;
    const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

    s.reset();
    await HH.Cutscenes.helpers.toView(s, 2.2, 'stone');
    [0, 1, 2].forEach(i => s.chalice(i, 0.3));
    s.figure.setEyes(1);
    A.sfx.voice(0.5, 0.8);
    await ui.banner(ctx.loc.tagline || 'Three sacrifices are required to open the door.', '', { tone: 'voice', hold: ctx.quick ? 1.6 : 3.4 });

    const accept = await ui.prompt({
      kicker: 'The hooded figure waits',
      title: 'Do you accept the sacrifice?',
      text: `${rounds} of you will be chosen, one at a time. Each chosen player must complete the drink the host has prepared.`,
      note: 'Taking part is voluntary. A non-alcoholic drink is always an option.',
      keys: false,
      buttons: [
        { label: 'Accept challenge', value: true, primary: true },
        { label: 'Refuse', value: false, tone: 'ghost' }
      ]
    });
    if (!accept) return fail('The team refused the sacrifice.');

    const players = ctx.team.players || [];
    const unique = players.length >= rounds;
    const chosen = new Set();

    for (let r = 0; r < rounds; r++) {
      s.figure.raiseHand(1);
      A.sfx.voice(0.45, 0.8);
      const p = await ui.revealPlayer(ctx.team, { avoid: unique ? chosen : null, kicker: `Sacrifice ${ROMAN[r]} of ${rounds}` });
      if (p) chosen.add(p.id);
      s.chalice(r, 0.65);
      A.sfx.whoosh(0.3);
      const ok = await ui.host({
        label: `Sacrifice ${r + 1} of ${rounds}: ${p ? p.name : 'one of the team'}`,
        buttons: [
          { label: 'Sacrifice completed', value: true, tone: 'good' },
          { label: 'Sacrifice refused', value: false, tone: 'bad' }
        ]
      });
      ui.hidePortrait();
      s.figure.raiseHand(0);
      if (!ok) return fail(`${p ? p.name : 'The chosen one'} refused. All ${rounds} sacrifices are required.`);
      s.chalice(r, 1);
      A.sfx.bell(98 + r * 24, 0.4); A.sfx.boom(0.5); W.shake(0.15);
      await ui.wait(1.0);
    }

    // Accepted: the chalices burn, the room shakes, the wall opens.
    s.allChalices(1);
    A.sfx.voice(0.6, 0.7);
    await ui.wait(1.2);
    HH.Cine.move({ pos: [1.6, 1.8, -7.2], look: [6.9, 1.7, -8.5], dur: 1.6 });
    A.sfx.grind(3.4, 0.8);
    let shakes = 0;
    const quake = setInterval(() => { W.shake(0.28); if (++shakes > 10) clearInterval(quake); }, 300);
    s.figure.vanish();
    await HH.Tween.add({ dur: 3.3, update: k => s.doorAt.exit.set(k), ease: 'inOut' });
    clearInterval(quake);
    A.sfx.boom(0.8);
    await ui.banner('Sacrifice accepted', 'A hidden door has opened.', { tone: 'good', hold: 2.8 });
    return 'success';

    async function fail(sub) {
      ui.hidePortrait();
      ui.hideHost();
      A.sfx.whoosh(0.5);
      A.sfx.voice(0.55, 0.6);
      s.allChalices(0);
      s.figure.turnAway(1);
      HH.Tween.add({ dur: 1.6, update: k => { s.lights.darkness = 0.65 * k; }, ease: 'out' });
      await ui.banner('The sacrifice was refused', sub, { tone: 'bad', hold: 3 });
      return 'fail';
    }
  }
};
