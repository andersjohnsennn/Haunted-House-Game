/* ==========================================================================
   Challenge: THE GHOST'S QUIZ (whole team, digital). One multiple-choice
   question from the bank (js/quiz-bank.js); a team never gets the same
   question on its next attempt. One click commits the answer.

   With a `bonus` (the silver dagger), a team that answered correctly may try
   one extra question for the reward flag, or move on. Every wrong answer
   ends the turn (CHALLENGE FAILED and the Wheel of Bones). After a wrong
   bonus answer the team keeps its first answer: next turn the ghost only
   asks whether to try again for the reward or to leave.
   Data: challenge: { id, type: 'ghostQuiz', bonus: { flag, item } }
   ========================================================================== */

HH.Challenges.ghostQuiz = {
  async run(ctx) {
    const s = ctx.set, ui = ctx.ui, ch = ctx.challenge, S = HH.State, i = ctx.teamIndex;

    s.reset();
    await HH.Cutscenes.helpers.toView(s, 2.0, 'wood');
    await s.ghost.appear(ctx.quick);

    // A team that missed the bonus question last time starts at the offer.
    const again = !!(S.getProgress(i, ch.id) || {}).passed;
    if (!again) {
      await ui.banner(ctx.loc.tagline || 'Answer correctly, or you shall remain here.', '', { tone: 'ghost', hold: ctx.quick ? 1.6 : 3.2 });
      const { right, answer } = await this.ask(ctx, 'The Ghost asks');
      if (!right) {
        await s.ghost.wrong();
        await ui.banner('Wrong answer', answer ? `The answer was ${answer}` : '', { tone: 'bad', hold: 3.2 });
        return 'fail';
      }
      S.setProgress(i, ch.id, { passed: true });
      HH.Audio.sfx.bell(330, 0.4);
      await s.ghost.correct();
      await ui.banner('Correct', answer, { tone: 'good', hold: 2.6 });
    }

    if (ch.bonus && !S.hasFlag(i, ch.bonus.flag) && await this.bonus(ctx, again) === 'missed') {
      const item = ch.bonus.item || 'the reward';
      ctx.failNote = `No ${item.replace(/^the /, '')} this time. Next turn, ${ctx.team.name} can try again or leave.`;
      return 'fail';
    }

    const a = s.anchors.exit;
    HH.Cine.look([a.x, a.y, a.z], 1.4);
    s.ghost.vanish();
    await s.doorAt.exit.unlock();
    HH.Audio.sfx.doorOpen(2);
    await HH.Tween.add({ dur: 2, update: k => s.doorAt.exit.set(k) });
    return 'success';
  },

  // One question from the bank, one click. Resolves { right, answer }.
  async ask(ctx, kicker) {
    const s = ctx.set, ui = ctx.ui, L = 'ABCD';
    const { q, exhausted } = HH.QuizBank.pickFor(ctx.teamIndex);
    if (!q) {
      const right = await ui.prompt({
        kicker: 'The question bank is empty',
        title: 'No questions yet',
        text: 'Add questions in Host controls → Question bank, or record a result for this question.',
        keys: false,
        buttons: [{ label: 'Mark as correct', value: true, primary: true }, { label: 'Mark as wrong', value: false, tone: 'ghost' }]
      });
      return { right, answer: '' };
    }

    // Count it as asked right away, so a refresh can't replay the same question.
    HH.State.useQuestion(ctx.teamIndex, q.id);
    s.writeBoard(q.question);
    HH.Audio.sfx.whisper(0.3, 0);
    const note = exhausted === 'all' ? 'Host: every question has been used. Add more in the question bank.'
      : exhausted === 'shared' ? 'Host: the other team has already seen this question.'
      : 'Discuss together, then choose. One answer only.';

    const pick = await ui.prompt({
      kicker: q.category ? `${kicker} · ${q.category}` : kicker,
      title: q.question,
      variant: 'quiz',
      place: 'bottom',
      note,
      buttons: q.answers.map((a, n) => ({ label: a, value: n }))
    });
    return { right: pick === q.correct, answer: `${L[q.correct]}: ${q.answers[q.correct]}` };
  },

  // One try for the reward this turn. Resolves 'got', 'left' or 'missed'.
  async bonus(ctx, again) {
    const s = ctx.set, ui = ctx.ui, A = HH.Audio, b = ctx.challenge.bonus;
    const item = b.item || 'the reward', Item = item[0].toUpperCase() + item.slice(1);
    s.ghost.calm();
    A.sfx.whisper(0.35, 0);
    const go = await ui.prompt({
      kicker: 'The Ghost',
      title: again ? `Back for ${item}?` : `One more question, for ${item}`,
      text: again
        ? `Try another question for ${item}, or spin the Wheel of Bones and leave without it. A wrong answer ends your turn again.`
        : `Answer one more question correctly and ${item} is yours. What it is for, the ghost will not say. ` +
          `Get it wrong and your turn ends; next turn you can try again or leave.`,
      buttons: again
        ? [{ label: 'Try again', value: true, primary: true }, { label: 'Spin the wheel and leave', value: false, tone: 'ghost' }]
        : [{ label: `Try for ${item}`, value: true, primary: true }, { label: 'Move on', value: false, tone: 'ghost' }]
    });
    if (!go) return 'left';

    const { right, answer } = await this.ask(ctx, `For ${item}`);
    if (right) {
      A.sfx.bell(440, 0.4);
      HH.State.setFlag(ctx.teamIndex, b.flag);
      await s.ghost.correct();
      await HH.Weapon.present(s, s.anchors.ghost);
      await ui.banner(`${Item} is yours`, 'Keep it close.', { tone: 'good', hold: 2.8 });
      await HH.Weapon.take();
      return 'got';
    }
    await s.ghost.wrong();
    await ui.banner('Wrong answer', (answer ? `The answer was ${answer}. ` : '') + `No ${item.replace(/^the /, '')} this time.`, { tone: 'bad', hold: 3.2 });
    return 'missed';
  }
};
