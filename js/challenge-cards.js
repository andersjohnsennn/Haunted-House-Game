/* ==========================================================================
   Challenge: THE VAMPIRE'S TABLE (whole team, digital). Four predictions in
   a row, dealt without replacement from a freshly shuffled deck:
     1  red or black
     2  higher or lower than card 1     (same rank: burned, dealt again)
     3  inside or outside cards 1 & 2   (inside = strictly between;
                                         equal to either: burned, dealt again)
     4  the exact suit
   One wrong prediction fails the challenge. Cards the team already got right
   stay on the table for its next attempt, which resumes at the stage it
   failed with a new card (the new deck leaves out the cards on the table).
   Each wrong suit takes that suit out of the game for the team's next
   tries: 1 in 4, then 1 in 3, 1 in 2, and finally a sure thing. The last
   card is always dealt from the suits still in play.
   Aces are low (A = 1 ... K = 13) unless aceLow: false.
   Data: challenge: { id, type: 'vampireCards', aceLow: true }
   ========================================================================== */

HH.CardLogic = (function () {
  const SUITS = [
    { k: 'H', name: 'Hearts', red: true, sym: '♥' },
    { k: 'D', name: 'Diamonds', red: true, sym: '♦' },
    { k: 'C', name: 'Clubs', red: false, sym: '♣' },
    { k: 'S', name: 'Spades', red: false, sym: '♠' }
  ];
  const FACE = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const WORD = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };

  function rand(n) {
    const a = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return a[0] % n;
  }

  function card(rank, suitKey, aceLow = true) {
    return { rank, value: rank === 1 && !aceLow ? 14 : rank, label: FACE[rank] || String(rank), suit: SUITS.find(s => s.k === suitKey) };
  }

  // A full deck minus `exclude`, Fisher-Yates shuffled. Draw with pop(): no replacement.
  function deck(aceLow = true, exclude = []) {
    const skip = new Set(exclude.map(c => c.rank + c.suit.k));
    const d = [];
    SUITS.forEach(suit => { for (let r = 1; r <= 13; r++) if (!skip.has(r + suit.k)) d.push(card(r, suit.k, aceLow)); });
    for (let i = d.length - 1; i > 0; i--) { const j = rand(i + 1); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }

  const rankName = (v, aceLow = true) => (v === 14 || (v === 1 && aceLow) ? 'A' : FACE[v] || String(v));
  const cardName = c => `${WORD[c.label] || c.label} of ${c.suit.name}`;

  // Outcome of a stage given the revealed card; 'redraw' means burn and deal again.
  function stage2(first, c) {
    if (c.value === first.value) return 'redraw';
    return c.value > first.value ? 'higher' : 'lower';
  }
  function stage3(a, b, c) {
    const lo = Math.min(a.value, b.value), hi = Math.max(a.value, b.value);
    if (c.value === lo || c.value === hi) return 'redraw';
    return c.value > lo && c.value < hi ? 'inside' : 'outside';
  }

  // "INSIDE = 7, 8 · OUTSIDE = A–5, 10–K · 6 or 9: the vampire draws again"
  function rangeText(a, b, aceLow = true) {
    const lo = Math.min(a.value, b.value), hi = Math.max(a.value, b.value);
    const min = aceLow ? 1 : 2, max = aceLow ? 13 : 14;
    const span = (x, y) => (x > y ? null : x === y ? rankName(x, aceLow) : y === x + 1 ? `${rankName(x, aceLow)}, ${rankName(y, aceLow)}` : `${rankName(x, aceLow)}–${rankName(y, aceLow)}`);
    const inside = span(lo + 1, hi - 1) || 'none';
    const outside = [span(min, lo - 1), span(hi + 1, max)].filter(Boolean).join(', ') || 'none';
    return `INSIDE = ${inside} · OUTSIDE = ${outside} · ${rankName(lo, aceLow)} or ${rankName(hi, aceLow)}: the vampire draws again`;
  }

  return { SUITS, card, deck, stage2, stage3, rangeText, rankName, cardName, rand };
})();

HH.Challenges.vampireCards = {
  async run(ctx) {
    const s = ctx.set, ui = ctx.ui, A = HH.Audio, L = HH.CardLogic, S = HH.State, id = ctx.challenge.id;
    const aceLow = ctx.challenge.aceLow !== false;
    const suitBtn = suit => `<span style="color:${suit.red ? '#e02424' : '#e9dfc9'}">${suit.sym}︎</span> ${suit.name}`;

    // Cards this team already predicted correctly on an earlier attempt, and suits it has guessed wrong.
    const saved = S.getProgress(ctx.teamIndex, id) || {};
    const kept = (saved.cards || []).map(c => L.card(c.rank, c.suit, aceLow));
    const got = kept.slice(), gone = (saved.gone || []).slice();
    const remember = () => S.setProgress(ctx.teamIndex, id, { cards: got.map(c => ({ rank: c.rank, suit: c.suit.k })), gone });
    const suits = L.SUITS.filter(su => !gone.includes(su.k));
    const names = list => list.map(k => L.SUITS.find(su => su.k === k).name).join(', ').replace(/, ([^,]*)$/, ' and $1');

    s.reset();
    await HH.Cutscenes.helpers.toView(s, 2.0, 'wood');
    if (!kept.length && !ctx.quick) await s.revealDeck();
    for (let k = 0; k < kept.length; k++) await s.placeFaceUp(k, kept[k]);
    A.sfx.voice(0.5, 1.15);
    if (kept.length) await ui.banner('Your correct cards remain', `Stage ${kept.length + 1} of 4.` + (kept.length === 3 && gone.length ? ` ${suits.length === 1 ? 'One suit' : suits.length + ' suits'} left.` : ''), { tone: 'voice', hold: ctx.quick ? 1.8 : 2.8 });
    else await ui.banner(ctx.loc.tagline || 'Four correct predictions. One chance.', '', { tone: 'voice', hold: ctx.quick ? 1.6 : 3.2 });

    const deck = L.deck(aceLow, kept);
    ctx.deck = deck; // for testing from the console
    const draw = () => deck.pop();
    // The top card that passes `ok`, taken out of the shuffled deck.
    const drawWhere = ok => { for (let i = deck.length - 1; i >= 0; i--) if (ok(deck[i])) return deck.splice(i, 1)[0]; return draw(); };

    const ask = (stage, title, text, buttons) => ui.prompt({ kicker: `Stage ${stage} of 4`, title, text, buttons, variant: 'cards', place: 'bottom' });
    async function correct() { A.sfx.bell(262, 0.3); await ui.banner('Correct', 'The vampire\'s smile thins.', { tone: 'good', hold: 1.3 }); }
    async function redraw(slot, why) {
      await ui.banner('The vampire draws again', why, { tone: 'info', hold: 1.8 });
      await s.burn(slot);
      const c = draw();
      await s.deal(slot, c);
      await s.flip(slot);
      return c;
    }
    const miss = (c, sub) => ({ lost: c, sub });

    const stages = [
      async () => {
        const c = draw();
        await s.deal(0, c);
        const p = await ask(1, 'Red or black?', 'Hearts and diamonds are red. Clubs and spades are black.', [
          { html: '<span style="color:#e02424">♥︎♦︎</span> Red', value: 'red', tone: 'red' },
          { html: '♣︎♠︎ Black', value: 'black', tone: 'black' }
        ]);
        await s.flip(0);
        const actual = c.suit.red ? 'red' : 'black';
        return actual === p ? c : miss(c, `It was ${actual}.`);
      },
      async () => {
        const c1 = got[0];
        let c = draw();
        await s.deal(1, c);
        const p = await ask(2, 'Higher or lower?', `Than the ${L.cardName(c1)}. Aces are ${aceLow ? 'low' : 'high'}. The same rank is dealt again.`, [
          { label: 'Higher', value: 'higher' }, { label: 'Lower', value: 'lower' }
        ]);
        await s.flip(1);
        while (L.stage2(c1, c) === 'redraw') c = await redraw(1, `Same rank as the first card. Your prediction stands: ${p}.`);
        return L.stage2(c1, c) === p ? c : miss(c, `It was ${L.stage2(c1, c)}.`);
      },
      async () => {
        const [c1, c2] = got;
        let c = draw();
        await s.deal(2, c);
        const p = await ask(3, 'Inside or outside?', L.rangeText(c1, c2, aceLow), [
          { label: 'Inside', value: 'inside' }, { label: 'Outside', value: 'outside' }
        ]);
        await s.flip(2);
        while (L.stage3(c1, c2, c) === 'redraw') c = await redraw(2, `It matched one of the first two cards. Your prediction stands: ${p}.`);
        return L.stage3(c1, c2, c) === p ? c : miss(c, `It was ${L.stage3(c1, c2, c)}.`);
      },
      async () => {
        // Only the suits still in play: dealt from them, and offered as answers.
        const c = drawWhere(card => suits.some(su => su.k === card.suit.k));
        await s.deal(3, c);
        const text = gone.length ? `One last card. ${names(gone)} ${gone.length > 1 ? 'are' : 'is'} out of the game.` : 'One last card. Name its suit.';
        const p = await ask(4, 'Guess the suit', text, suits.map(suit => ({ html: suitBtn(suit), value: suit.k })));
        await s.flip(3);
        if (c.suit.k === p) return c;
        gone.push(p);
        return miss(c, `It was ${c.suit.name.toLowerCase()}.`);
      }
    ];

    for (let st = got.length; st < 4; st++) {
      const r = await stages[st]();
      if (r.lost) {
        await s.gloat(st);
        const keepNote = (got.length ? ` Your ${got.length} correct card${got.length > 1 ? 's stay' : ' stays'} for next time.` : '') +
          (st === 3 ? ` Next time, ${names(gone.slice(-1))} is out.` : '');
        remember();
        await ui.banner('Wrong prediction', `${L.cardName(r.lost)}. ${r.sub}${keepNote}`, { tone: 'bad', hold: 3.2 });
        return 'fail';
      }
      got.push(r);
      remember();
      if (st < 3) await correct();
    }

    // Victory: fury, darkness, the secret door.
    await s.fury();
    await ui.banner('The vampire has been defeated', 'A secret door opens behind him.', { tone: 'good', hold: 3 });
    return 'success';
  }
};
