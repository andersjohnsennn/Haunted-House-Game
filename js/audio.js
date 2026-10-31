/* ==========================================================================
   Audio. Every sound is synthesised with WebAudio, so the game ships with no
   sound files. HH.Audio.init() must run from a click (browser autoplay rules).
   ========================================================================== */

window.HH = window.HH || {};

HH.Audio = (function () {
  let ctx = null, master, sfxBus, ambBus, verbSend, noiseBuf, brownBuf;
  let volume = 0.8, muted = false;
  let bed = null, timers = [], heartTimer = null, clockTimer = null;

  /* ---------- plumbing ---------- */
  const now = () => ctx.currentTime;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function gain(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
  function filt(type, f, q = 1) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  function noise(buf = noiseBuf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s; }
  function chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; }

  // Route a finished sound to the sfx bus with optional reverb and pan.
  function out(node, wet = 0.3, pan = 0, bus = sfxBus) {
    let n = node;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; n.connect(p); n = p; }
    n.connect(bus);
    if (wet) { const w = gain(wet); n.connect(w); w.connect(verbSend); }
  }

  function perc(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function makeNoise(kind) {
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0, peak = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last; } else d[i] = w;
      peak = Math.max(peak, Math.abs(d[i]));
    }
    for (let i = 0; i < len; i++) d[i] /= peak;
    return buf;
  }

  function impulse(seconds, decay) {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function distortion(k) {
    const n = 2048, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; curve[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    return curve;
  }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = gain(muted ? 0 : volume);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.25;
    master.connect(comp); comp.connect(ctx.destination);

    const verb = ctx.createConvolver(); verb.buffer = impulse(3.8, 2.4);
    const verbOut = gain(0.55); verb.connect(verbOut); verbOut.connect(master);
    verbSend = gain(1); verbSend.connect(verb);

    sfxBus = gain(1); sfxBus.connect(master);
    ambBus = gain(0.7); ambBus.connect(master);
    noiseBuf = makeNoise('white');
    brownBuf = makeNoise('brown');
  }

  /* ---------- sound effects ---------- */
  function click(t, v = 0.2, f = 2800) {
    const n = noise(); const b = filt('bandpass', f, 6); const g = gain();
    chain(n, b, g); perc(g, t, v, 0.002, 0.05); out(g, 0.2);
    n.start(t, Math.random()); n.stop(t + 0.1);
  }

  function thump(t, v = 0.8, f0 = 90, f1 = 45, len = 0.18) {
    const o = osc('sine', f0); const g = gain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len);
    chain(o, g); perc(g, t, v, 0.004, len); out(g, 0.25);
    o.start(t); o.stop(t + len + 0.05);
  }

  const S = {
    thunder(dist = 0.4) {
      const t = now();
      if (dist < 0.75) {
        const n = noise(); const hp = filt('highpass', 900); const g = gain();
        chain(n, hp, g); perc(g, t, 0.9 * (1 - dist), 0.008, 0.7); out(g, 0.7);
        n.start(t); n.stop(t + 0.9);
      }
      const r = noise(brownBuf); const lp = filt('lowpass', 500); const g = gain();
      chain(r, lp, g);
      lp.frequency.setValueAtTime(600 - dist * 300, t);
      lp.frequency.exponentialRampToValueAtTime(70, t + 6);
      g.gain.setValueAtTime(0.0001, t);
      let k = t + 0.05 + dist * 0.4;
      g.gain.linearRampToValueAtTime(1.6 - dist * 0.6, k);
      for (let i = 0; i < 9; i++) { k += rnd(0.25, 0.7); g.gain.linearRampToValueAtTime(rnd(0.4, 1.3) * (1.4 - dist * 0.6), k); }
      g.gain.exponentialRampToValueAtTime(0.0001, k + 3);
      out(g, 0.5); r.start(t, rnd(0, 2)); r.stop(k + 3.2);
    },

    creak(dur = 2, pitch = 1, vol = 0.5) {
      const t = now();
      const o = osc('sawtooth', 25 * pitch);
      let k = t;
      while (k < t + dur) { k += rnd(0.04, 0.16); o.frequency.linearRampToValueAtTime(rnd(14, 60) * pitch, k); }
      const g = gain();
      [[480, 6], [950, 12], [1900, 9]].forEach(([f, q]) => { const b = filt('bandpass', f * pitch, q); o.connect(b); b.connect(g); });
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol * 3, t + 0.12);
      for (let j = t + 0.2; j < t + dur - 0.1; j += rnd(0.1, 0.3)) g.gain.linearRampToValueAtTime(vol * rnd(1.2, 3.4), j);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      out(g, 0.35, rnd(-0.3, 0.3)); o.start(t); o.stop(t + dur + 0.05);
    },

    doorOpen(dur = 2.8) { S.creak(dur, 0.85, 0.55); },

    slam(vol = 1) {
      const t = now();
      const n = noise(); const lp = filt('lowpass', 2400); const g = gain();
      chain(n, lp, g); perc(g, t, 1.5 * vol, 0.003, 0.55);
      lp.frequency.exponentialRampToValueAtTime(180, t + 0.45);
      out(g, 0.9); n.start(t); n.stop(t + 0.7);
      thump(t, 1.8 * vol, 120, 32, 0.6);
      for (let i = 0; i < 6; i++) click(t + 0.07 + i * 0.05 + rnd(0, 0.03), 0.2 * vol * (1 - i / 7), rnd(1800, 3200));
    },

    step(kind = 'wood', vol = 0.45, pan = 0) {
      const t = now();
      const n = noise(); const g = gain();
      const f = kind === 'grass' ? filt('bandpass', rnd(1500, 2600), 0.7) : filt('lowpass', kind === 'stone' ? 1100 : 650);
      chain(n, f, g); perc(g, t, vol * (kind === 'grass' ? 0.6 : 1), 0.006, kind === 'grass' ? 0.2 : 0.12);
      out(g, 0.25, pan); n.start(t, rnd(0, 2)); n.stop(t + 0.3);
      if (kind !== 'grass') thump(t, vol * 0.9, 95, 50, 0.12);
      if ((kind === 'wood' && Math.random() < 0.3) || kind === 'stair') S.creak(rnd(0.25, 0.6), rnd(0.8, 1.5), kind === 'stair' ? 0.35 : 0.18);
    },

    handle() {
      const t = now();
      [0, 0.12, 0.2, 0.55, 0.62].forEach((d, i) => click(t + d, 0.3 - i * 0.03, rnd(2200, 3600)));
      thump(t + 0.6, 0.3, 300, 150, 0.05);
    },

    whoosh(vol = 0.5) {
      const t = now();
      const n = noise(); const b = filt('bandpass', 300, 1.2); const g = gain();
      chain(n, b, g);
      b.frequency.setValueAtTime(250, t); b.frequency.exponentialRampToValueAtTime(2200, t + 0.35); b.frequency.exponentialRampToValueAtTime(400, t + 0.9);
      perc(g, t, vol, 0.25, 0.7); out(g, 0.4); n.start(t); n.stop(t + 1.1);
    },

    whisper(vol = 0.25, pan = null) {
      const t = now();
      const n = noise(); const b1 = filt('bandpass', 2500, 2.5); const b2 = filt('bandpass', 1100, 4); const g = gain(0);
      n.connect(b1); n.connect(b2); b1.connect(g); b2.connect(g);
      let k = t; const end = t + rnd(1.2, 2.6);
      while (k < end) {
        const len = rnd(0.07, 0.25);
        g.gain.setValueAtTime(0, k);
        g.gain.linearRampToValueAtTime(vol * rnd(0.6, 1.4), k + len * 0.35);
        g.gain.linearRampToValueAtTime(0, k + len);
        b1.frequency.setValueAtTime(rnd(1700, 4200), k);
        b2.frequency.setValueAtTime(rnd(700, 1500), k);
        k += len + rnd(0, 0.09);
      }
      out(g, 0.8, pan === null ? rnd(-0.9, 0.9) : pan); n.start(t, rnd(0, 2)); n.stop(k + 0.1);
    },

    bell(freq = 146.8, vol = 0.45) {
      const t = now();
      [[1, 1, 5], [2, 0.6, 3.5], [2.4, 0.45, 3], [3, 0.35, 2.5], [4.5, 0.25, 1.8], [5.4, 0.2, 1.2]].forEach(([m, a, d]) => {
        const o = osc('sine', freq * m); const g = gain(); chain(o, g); perc(g, t, vol * a, 0.005, d);
        out(g, 0.8); o.start(t); o.stop(t + d + 0.1);
      });
    },

    stinger(vol = 0.6) {
      const t = now();
      [1661, 1760, 1865, 2217].forEach((f, i) => {
        const o = osc(i % 2 ? 'sawtooth' : 'triangle', f); const g = gain(); const lp = filt('lowpass', 5000);
        const trem = osc('sine', rnd(9, 14)); const tg = gain(f * 0.012); trem.connect(tg); tg.connect(o.frequency);
        chain(o, lp, g); perc(g, t, vol * 0.18, 0.01, 2.2);
        out(g, 0.7); o.start(t); trem.start(t); o.stop(t + 2.4); trem.stop(t + 2.4);
      });
      thump(t, vol * 1.4, 70, 30, 1.2);
    },

    scream(vol = 1) {
      const t = now(), dur = 1.5;
      const pre = gain(0.35), sh = ctx.createWaveShaper(); sh.curve = distortion(30);
      const f1 = filt('bandpass', 1150, 2.5), f2 = filt('bandpass', 2700, 3), outG = gain();
      [430, 610, 870, 1230].forEach((f, i) => {
        const o = osc('sawtooth', f);
        o.frequency.setValueAtTime(f * 0.6, t);
        o.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.22);
        o.frequency.exponentialRampToValueAtTime(f * 0.75, t + dur);
        const lfo = osc('sine', 16 + i * 6); const lg = gain(f * 0.07); lfo.connect(lg); lg.connect(o.frequency);
        o.connect(pre); o.start(t); lfo.start(t); o.stop(t + dur); lfo.stop(t + dur);
      });
      pre.connect(sh); sh.connect(f1); sh.connect(f2); f1.connect(outG); f2.connect(outG);
      const n = noise(); const hp = filt('highpass', 1800); const ng = gain(0.5); chain(n, hp, ng, outG);
      n.start(t); n.stop(t + dur);
      outG.gain.setValueAtTime(0.0001, t);
      outG.gain.linearRampToValueAtTime(vol * 1.1, t + 0.025);
      outG.gain.setValueAtTime(vol * 1.1, t + dur * 0.55);
      outG.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      out(outG, 0.45);
      S.boom(vol);
    },

    boom(vol = 1) {
      const t = now();
      thump(t, 1.8 * vol, 75, 26, 2.2);
      const n = noise(brownBuf); const lp = filt('lowpass', 600); const g = gain();
      chain(n, lp, g); perc(g, t, 1.1 * vol, 0.008, 2); out(g, 1);
      n.start(t, rnd(0, 2)); n.stop(t + 2.3);
    },

    deathSting(vol = 0.8) {
      const t = now();
      const lp = filt('lowpass', 2400, 2), g = gain();
      lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(120, t + 5);
      [65.4, 69.3, 92.5, 98, 130.8, 138.6].forEach(f => {
        const o = osc('sawtooth', f); o.detune.value = rnd(-12, 12); o.connect(lp); o.start(t); o.stop(t + 6);
      });
      chain(lp, g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35 * vol, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 6); out(g, 0.9);
      S.boom(vol);
    },

    hoot() {
      const t = now();
      [0, 0.45, 0.62].forEach((d, i) => {
        const o = osc('sine', 390 - i * 15); const g = gain(); chain(o, g);
        o.frequency.setValueAtTime(400 - i * 15, t + d); o.frequency.linearRampToValueAtTime(360 - i * 20, t + d + 0.3);
        perc(g, t + d, 0.06, 0.05, 0.35); out(g, 0.9, -0.6); o.start(t + d); o.stop(t + d + 0.5);
      });
    },

    crackle(vol = 0.08) { click(now(), vol * rnd(0.3, 1.2), rnd(1500, 5000)); },

    firework() {
      const t = now();
      const o = osc('sine', 500); const g = gain(); chain(o, g);
      o.frequency.exponentialRampToValueAtTime(1800, t + 0.7); perc(g, t, 0.05, 0.3, 0.45); out(g, 0.5, rnd(-0.6, 0.6));
      o.start(t); o.stop(t + 0.8);
      setTimeout(() => {
        if (!ctx) return;
        const t2 = now(); thump(t2, 0.9, 90, 30, 0.8);
        for (let i = 0; i < 18; i++) click(t2 + 0.1 + rnd(0, 0.9), rnd(0.05, 0.16), rnd(2500, 6000));
      }, 750);
    },

    winSting() {
      const t = now();
      [293.7, 349.2, 440, 587.3].forEach((f, i) => setTimeout(() => ctx && S.bell(f, 0.3), i * 280));
      setTimeout(() => {
        if (!ctx) return;
        const t2 = now(); const lp = filt('lowpass', 300, 1); const g = gain();
        lp.frequency.linearRampToValueAtTime(2400, t2 + 3);
        [146.8, 220, 293.7, 370, 440, 587.3].forEach(f => {
          const o = osc('sawtooth', f); o.detune.value = rnd(-8, 8); o.connect(lp); o.start(t2); o.stop(t2 + 7);
        });
        chain(lp, g); g.gain.setValueAtTime(0.0001, t2); g.gain.linearRampToValueAtTime(0.14, t2 + 2.5);
        g.gain.exponentialRampToValueAtTime(0.0001, t2 + 7); out(g, 0.9);
        S.bell(587.3, 0.25);
      }, 1300);
      return t;
    },

    ui() { click(now(), 0.06, 2400); },

    drum(vol = 1) {
      const t = now();
      thump(t, 1.2 * vol, 120, 55, 0.35);
      const n = noise(); const b = filt('bandpass', 180, 1.2); const g = gain();
      chain(n, b, g); perc(g, t, 0.9 * vol, 0.003, 0.25); out(g, 0.6);
      n.start(t, rnd(0, 2)); n.stop(t + 0.4);
    },

    // A failed challenge: a falling minor line, not the death sting.
    failSting() {
      const t = now();
      [[220, 0], [207.7, 0.35], [196, 0.7], [164.8, 1.05]].forEach(([f, d]) => {
        const o = osc('sawtooth', f); const lp = filt('lowpass', 1200); const g = gain();
        chain(o, lp, g); perc(g, t + d, 0.12, 0.02, 0.9); out(g, 0.8);
        o.start(t + d); o.stop(t + d + 1.1);
      });
      thump(t + 1.05, 0.9, 80, 35, 1.2);
    },

    // A deep wordless voice: the knight, the vampire, the hooded figure.
    voice(vol = 0.5, pitch = 1) {
      const t = now(), dur = rnd(1.2, 1.8);
      const o = osc('sawtooth', 70 * pitch), sh = ctx.createWaveShaper(); sh.curve = distortion(8);
      const f1 = filt('bandpass', 500, 6), f2 = filt('bandpass', 1100, 8), g = gain(0);
      o.connect(sh); sh.connect(f1); sh.connect(f2); f1.connect(g); f2.connect(g);
      let k = t;
      while (k < t + dur) {
        const len = rnd(0.12, 0.3);
        g.gain.setValueAtTime(0, k); g.gain.linearRampToValueAtTime(vol * rnd(0.6, 1), k + 0.04); g.gain.linearRampToValueAtTime(0, k + len);
        f1.frequency.setValueAtTime(rnd(350, 750), k); f2.frequency.setValueAtTime(rnd(900, 1500), k);
        o.frequency.setValueAtTime(70 * pitch * rnd(0.9, 1.1), k);
        k += len + rnd(0.02, 0.08);
      }
      out(g, 0.6); o.start(t); o.stop(k + 0.1);
    },

    laugh(vol = 0.7, pitch = 1) {
      const t = now();
      for (let i = 0; i < 6; i++) {
        const st = t + i * 0.24, f = (110 - i * 6) * pitch;
        const o = osc('sawtooth', f), f1 = filt('bandpass', 650, 5), f2 = filt('bandpass', 1050, 6), g = gain();
        o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g);
        o.frequency.setValueAtTime(f * 1.1, st); o.frequency.exponentialRampToValueAtTime(f * 0.85, st + 0.18);
        perc(g, st, vol * (1 - i * 0.1), 0.02, 0.18);
        out(g, 0.7); o.start(st); o.stop(st + 0.25);
      }
    },

    // The ghost. Thin and high, nothing like the demon's scream.
    shriek(vol = 0.7) {
      const t = now(), dur = 1.8, g = gain();
      [1, 1.5, 2.02].forEach(m => {
        const o = osc('triangle', 900 * m), l = osc('sine', 7), lg = gain(40 * m);
        l.connect(lg); lg.connect(o.frequency);
        o.frequency.setValueAtTime(700 * m, t); o.frequency.exponentialRampToValueAtTime(1500 * m, t + 0.4); o.frequency.exponentialRampToValueAtTime(600 * m, t + dur);
        o.connect(g); o.start(t); l.start(t); o.stop(t + dur); l.stop(t + dur);
      });
      const n = noise(), hp = filt('highpass', 3000), ng = gain(0.15); chain(n, hp, ng, g); n.start(t); n.stop(t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * 0.35, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      out(g, 1);
    },

    gulp(vol = 0.5) {
      const t = now();
      const o = osc('sine', 320), g = gain(); chain(o, g);
      o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.12);
      perc(g, t, vol * 0.5, 0.01, 0.12); out(g, 0.2); o.start(t); o.stop(t + 0.2);
      const n = noise(brownBuf), lp = filt('lowpass', 500), ng = gain(); chain(n, lp, ng);
      perc(ng, t, vol, 0.01, 0.14); out(ng, 0.2); n.start(t, rnd(0, 2)); n.stop(t + 0.2);
    },

    cardDeal() {
      const t = now(), n = noise(), b = filt('bandpass', 4000, 0.8), g = gain();
      chain(n, b, g); b.frequency.setValueAtTime(2500, t); b.frequency.exponentialRampToValueAtTime(6000, t + 0.15);
      perc(g, t, 0.25, 0.02, 0.16); out(g, 0.3, rnd(-0.3, 0.3)); n.start(t, rnd(0, 2)); n.stop(t + 0.25);
    },

    cardFlip() { const t = now(); click(t, 0.3, 3200); click(t + 0.05, 0.18, 2200); },

    // Stone sliding over stone.
    grind(dur = 3, vol = 0.7) {
      const t = now(), n = noise(brownBuf), b = filt('bandpass', 220, 1.5), g = gain(0);
      chain(n, b, g);
      for (let k = t; k < t + dur; k += 0.08) g.gain.linearRampToValueAtTime(vol * rnd(0.4, 1.2), k);
      g.gain.linearRampToValueAtTime(0, t + dur + 0.2);
      out(g, 0.6); n.start(t, rnd(0, 2)); n.stop(t + dur + 0.3);
      thump(t, 0.6, 55, 38, Math.min(dur, 2));
    },

    chains(vol = 0.5) {
      const t = now();
      for (let i = 0; i < 22; i++) click(t + rnd(0, 0.9), vol * rnd(0.2, 0.6), rnd(2500, 6000));
      thump(t + 0.85, vol, 160, 90, 0.2);
    },

    // Glasses clinking together.
    // The wheel's dagger clicking over a bone peg.
    tick(vol = 0.3) {
      const t = now();
      click(t, vol, rnd(1700, 2100));
      thump(t, vol * 0.45, 320, 180, 0.03);
    },

    clink(vol = 0.5) {
      const t = now();
      for (let g = 0; g < 4; g++) {
        const st = t + g * rnd(0.03, 0.09), base = rnd(1900, 2600);
        [1, 2.76, 5.4].forEach((m, i) => {
          const o = osc('sine', base * m), gg = gain(); chain(o, gg);
          perc(gg, st, vol * 0.16 / (i + 1), 0.002, 1.2 - i * 0.3); out(gg, 0.6, rnd(-0.6, 0.6));
          o.start(st); o.stop(st + 1.3);
        });
      }
    },

    // A blade drawn or striking: a bright metallic ring over a rising hiss.
    blade(vol = 0.6) {
      const t = now();
      const n = noise(), b = filt('bandpass', 3000, 2), g = gain();
      b.frequency.setValueAtTime(3000, t); b.frequency.exponentialRampToValueAtTime(8000, t + 0.25);
      chain(n, b, g); perc(g, t, vol * 0.35, 0.01, 0.3); out(g, 0.3);
      n.start(t, Math.random()); n.stop(t + 0.4);
      [1, 2.32, 4.25].forEach((m, i) => {
        const o = osc('sine', 1850 * m), gg = gain(); chain(o, gg);
        perc(gg, t + 0.03, vol * 0.1 / (i + 1), 0.003, 1.1 - i * 0.25); out(gg, 0.5);
        o.start(t); o.stop(t + 1.3);
      });
    },

    // Metal cup on a wooden table.
    clank(vol = 0.6) {
      const t = now();
      thump(t, vol * 1.4, 150, 70, 0.25);
      [1, 2.7, 4.1].forEach(m => {
        const o = osc('sine', 420 * m), g = gain(); chain(o, g);
        perc(g, t, vol * 0.12 / m, 0.002, 0.6); out(g, 0.5); o.start(t); o.stop(t + 0.7);
      });
    }
  };

  function lub(v) {
    const t = now();
    thump(t, v, 62, 38, 0.16);
    const n = noise(brownBuf); const lp = filt('lowpass', 140); const g = gain();
    chain(n, lp, g); perc(g, t, v * 0.9, 0.01, 0.14); out(g, 0.1); n.start(t, rnd(0, 2)); n.stop(t + 0.2);
  }

  /* ---------- ambience beds ---------- */
  function startBed(kind) {
    const t = now(), g = gain(0), nodes = [];
    g.connect(ambBus);
    const add = n => { nodes.push(n); return n; };
    const drone = (freqs, level) => freqs.forEach(f => {
      const o = add(osc('sine', f)); const og = gain(level);
      const l = add(osc('sine', rnd(0.05, 0.15))); const lg = gain(level * 0.6); l.connect(lg); lg.connect(og.gain);
      chain(o, og, g);
    });

    if (kind === 'exterior') {
      const n = add(noise(brownBuf)); const bp = filt('bandpass', 380, 0.6); const wg = gain(0.55);
      const l1 = add(osc('sine', 0.06)); const l1g = gain(220); l1.connect(l1g); l1g.connect(bp.frequency);
      const l2 = add(osc('sine', 0.11)); const l2g = gain(0.3); l2.connect(l2g); l2g.connect(wg.gain);
      chain(n, bp, wg, g);
      const w = add(noise()); const wb = filt('bandpass', 1300, 18); const wwg = gain(0.05);
      const l3 = add(osc('sine', 0.045)); const l3g = gain(500); l3.connect(l3g); l3g.connect(wb.frequency);
      chain(w, wb, wwg, g);
      drone([55, 55.4, 82.4], 0.05);
    } else {
      const n = add(noise(brownBuf)); const lp = filt('lowpass', 220); const rg = gain(0.35);
      chain(n, lp, rg, g);
      drone([41.2, 43.65, 87.3], 0.06);
      const hi = add(osc('triangle', 1318)); const hi2 = add(osc('triangle', 1397)); const hg = gain(0.004);
      hi.connect(hg); hi2.connect(hg); hg.connect(g);
      if (kind === 'chamber' || kind === 'tavern') {
        const f = add(noise(brownBuf)); const fb = filt('bandpass', 260, 0.8); const fg = gain(kind === 'tavern' ? 0.45 : 0.3);
        chain(f, fb, fg, g);
      }
      if (kind === 'ritual') {
        // a low, wordless choir
        [110, 130.8, 164.8, 220].forEach(f => {
          const o = add(osc('sawtooth', f)); o.detune.value = rnd(-10, 10);
          const v = add(osc('sine', rnd(4, 6))); const vg = gain(f * 0.008); v.connect(vg); vg.connect(o.frequency);
          const b1 = filt('bandpass', 700, 6), b2 = filt('bandpass', 1150, 8), og = gain(0.035);
          o.connect(b1); o.connect(b2); b1.connect(og); b2.connect(og); og.connect(g);
        });
      }
      if (kind === 'library') {
        const w = add(noise(brownBuf)); const wb = filt('bandpass', 600, 0.8); const wg = gain(0.25);
        const l = add(osc('sine', 0.08)); const lg = gain(300); l.connect(lg); lg.connect(wb.frequency);
        chain(w, wb, wg, g);
      }
      if (kind === 'parlor') {
        const r = add(noise()); const hp = filt('highpass', 2500), lp = filt('lowpass', 7000); const rg = gain(0.05);
        chain(r, hp, lp, rg, g);
      }
    }
    nodes.forEach(n => n.start(t));
    g.gain.linearRampToValueAtTime(1, t + 3);
    return { g, nodes, kind };
  }

  function every(minS, maxS, fn) {
    const loop = () => { timers.push(setTimeout(() => { if (ctx) fn(); loop(); }, rnd(minS, maxS) * 1000)); };
    loop();
  }

  function ambience(kind) {
    if (!ctx) return;
    if (bed && bed.kind === kind) return;
    if (bed) {
      const old = bed, t = now();
      old.g.gain.cancelScheduledValues(t);
      old.g.gain.setValueAtTime(old.g.gain.value, t);
      old.g.gain.linearRampToValueAtTime(0, t + 1.8);
      setTimeout(() => old.nodes.forEach(n => { try { n.stop(); } catch (e) { /* stopped */ } }), 2000);
    }
    timers.forEach(clearTimeout); timers = [];
    bed = kind && kind !== 'none' ? startBed(kind) : null;
    if (kind === 'exterior') {
      every(14, 30, S.hoot);
    } else if (kind) {
      every(7, 16, () => S.creak(rnd(0.6, 1.6), rnd(0.6, 1.3), 0.08));
      every(kind === 'library' ? 9 : 18, kind === 'library' ? 20 : 40, () => S.whisper(0.1));
      if (kind === 'chamber' || kind === 'tavern') every(0.08, 0.6, () => S.crackle(0.07));
    }
  }

  function heartbeat(bpm) {
    clearInterval(heartTimer); heartTimer = null;
    if (!bpm || !ctx) return;
    const beat = () => { lub(0.9); setTimeout(() => ctx && lub(0.6), 170); };
    beat(); heartTimer = setInterval(beat, 60000 / bpm);
  }

  function clock(on) {
    clearInterval(clockTimer); clockTimer = null;
    if (!on || !ctx) return;
    let tock = false;
    clockTimer = setInterval(() => { click(now(), 0.07, tock ? 1600 : 2100); thump(now(), 0.05, 400, 300, 0.03); tock = !tock; }, 1000);
  }

  function apply() { if (master) master.gain.setTargetAtTime(muted ? 0 : volume, now(), 0.05); }

  const sfx = {};
  Object.keys(S).forEach(k => { sfx[k] = (...a) => { if (!ctx) return; try { S[k](...a); } catch (e) { console.warn('audio', k, e); } }; });

  return {
    init, ambience, heartbeat, clock, sfx,
    setVolume(v) { volume = v; apply(); },
    getVolume() { return volume; },
    toggleMute() { muted = !muted; apply(); return muted; },
    isMuted() { return muted; },
    stopLoops() { heartbeat(0); clock(false); }
  };
})();
