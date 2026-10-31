/* ==========================================================================
   Challenge: THE WINE CELLAR (whole team, digital). The ghost hides a key
   under one of three goblets and shuffles them; the team picks one.
   While the goblets fly, the cellar haunts the team: the floor shakes, the
   view blinks and the lights die for a moment (only the ghost's glow is left).
   Each failed attempt makes the next one harder (more, faster swaps).
   Data: challenge: { id, type: 'shellGame', swaps: [16, 20, 24], swapTime: [0.25, 0.21, 0.18] }
     swaps[n] / swapTime[n] are used on the team's attempt n (the last entry repeats).
     swapTime is the full speed; the first few swaps start slower.
     haunt: false turns the shaking, blinking and darkness off.
   ========================================================================== */

HH.Challenges.shellGame = {
  async run(ctx) {
    const s = ctx.set, ui = ctx.ui, A = HH.Audio, ch = ctx.challenge, K = HH.Kit;
    const L = 'ABC';
    const n = HH.State.attempts(ctx.teamIndex, ch.id);
    const pick = (arr, fallback) => (arr && arr.length ? arr[Math.min(n, arr.length - 1)] : fallback);
    const swaps = pick(ch.swaps, 16), swapTime = pick(ch.swapTime, 0.25);

    s.reset();
    await HH.Cutscenes.helpers.toView(s, 2.0, 'stone');
    await s.ghost.appear(ctx.quick);
    await ui.banner(ctx.loc.tagline || 'Follow the key. Lose it, and you stay down here.',
      n ? `Attempt ${n + 1}: the ghost moves faster.` : '', { tone: 'ghost', hold: ctx.quick ? 1.8 : 3.2 });

    // Show the key, cover it, shuffle. Track where it goes.
    let keySlot = K.rand(3), done = 0;
    await s.showKey(keySlot);
    const stopHaunt = ch.haunt === false ? () => {} : this.haunt(ctx, s, () => done / swaps);
    for (; done < swaps && ctx.alive(); done++) {
      const a = K.rand(3);
      let b = K.rand(2);
      if (b >= a) b++;
      // Ease in over the first third, then full speed.
      await s.swap(a, b, swapTime * (1 + 0.7 * Math.max(0, 1 - done / (swaps * 0.3))));
      if (keySlot === a) keySlot = b; else if (keySlot === b) keySlot = a;
    }
    stopHaunt();
    ctx.keySlot = keySlot; // for testing from the console

    const choice = await ui.pickInWorld([0, 1, 2].map(i => ({ key: L[i], label: `Goblet ${L[i]}`, anchor: s.anchors['cup' + i] })));
    A.sfx.whoosh(0.3);
    const found = await s.lift(choice);

    if (found) {
      A.sfx.bell(330, 0.4);
      await s.ghost.happy();
      await ui.banner('The key is yours', 'The cellar gate unlocks.', { tone: 'good', hold: 2.6 });
      s.ghost.vanish();
      await s.openGate();
      return 'success';
    }
    await HH.Cine.wait(0.6);
    await s.lift(keySlot);
    await s.ghost.rage();
    await ui.banner('Wrong goblet', `The key was under ${L[keySlot]}.`, { tone: 'bad', hold: 3 });
    return 'fail';
  },

  // Runs alongside the shuffle and gets worse as `progress()` goes 0 -> 1:
  // a constant tremor, eye blinks, short blackouts and sudden jolts.
  // Returns stop(), which puts the room back to normal.
  haunt(ctx, s, progress) {
    const A = HH.Audio, rig = s.lights;
    let on = true, fast = false;
    s.tremor = 0.3;
    A.heartbeat(100);
    (async () => {
      await HH.Tween.wait(0.4);
      while (on && ctx.alive()) {
        const p = progress(), r = Math.random();
        s.tremor = 0.3 + p * 0.15;
        if (!fast && p > 0.5) { fast = true; A.heartbeat(135); }
        if (r < 0.4) {
          await HH.Cine.blink(0.07, 0.04 + p * 0.05, 0.12);
        } else if (r < 0.78) {
          rig.darkness = 1;
          A.sfx.whoosh(0.2);
          if (Math.random() < 0.5) A.sfx.whisper(0.22);
          await HH.Tween.wait(0.14 + Math.random() * 0.14 + p * 0.1);
          if (!on) break;
          rig.darkness = 0; rig.chaos = 0.6;
          await HH.Tween.wait(0.18);
          rig.chaos = 0;
        } else {
          HH.World.shake(0.5 + p * 0.25);
          A.sfx.boom(0.3);
        }
        await HH.Tween.wait((1.1 - p * 0.6) * (0.5 + Math.random() * 0.8));
      }
    })();
    return () => {
      on = false;
      s.tremor = 0; rig.darkness = 0; rig.chaos = 0;
      A.heartbeat(0);
    };
  }
};
