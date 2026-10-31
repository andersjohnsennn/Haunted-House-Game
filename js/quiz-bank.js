/* ==========================================================================
   The Ghost's question bank.

   The questions below are SAMPLES for testing only. Replace them with your
   own, either here or in the game (Host controls → Question bank). Edits
   made in the game are stored in this browser; use Export there to save a
   copy, and paste the exported list over HH.QUIZ_SAMPLES to make it the
   permanent default.

   Each question: { id, category, question, answers: [4 strings], correct: 0-3 }
   ========================================================================== */

window.HH = window.HH || {};

HH.QUIZ_SAMPLES = [
  { id: 'sample-1', category: 'SAMPLE', question: 'SAMPLE: In Ireland, which vegetable was carved into the first jack-o\'-lanterns?', answers: ['Pumpkin', 'Turnip', 'Potato', 'Cabbage'], correct: 1 },
  { id: 'sample-2', category: 'SAMPLE', question: 'SAMPLE: In which year was the original film "Halloween" released?', answers: ['1974', '1978', '1982', '1986'], correct: 1 },
  { id: 'sample-3', category: 'SAMPLE', question: 'SAMPLE: Who wrote the novel "Frankenstein"?', answers: ['Bram Stoker', 'Edgar Allan Poe', 'Mary Shelley', 'H. P. Lovecraft'], correct: 2 },
  { id: 'sample-4', category: 'SAMPLE', question: 'SAMPLE: What is a group of crows called?', answers: ['A murder', 'A coven', 'A wake', 'A parliament'], correct: 0 },
  { id: 'sample-5', category: 'SAMPLE', question: 'SAMPLE: How many legs does a spider have?', answers: ['Six', 'Eight', 'Ten', 'Twelve'], correct: 1 },
  { id: 'sample-6', category: 'SAMPLE', question: 'SAMPLE: Which planet is known as the Red Planet?', answers: ['Venus', 'Jupiter', 'Mars', 'Saturn'], correct: 2 }
];

HH.QuizBank = (function () {
  const KEY = 'theHauntedHouse.quiz.v1';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const clone = x => JSON.parse(JSON.stringify(x));

  let list = load() || clone(HH.QUIZ_SAMPLES);
  let editing = null, filter = '';

  function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v.filter(valid) : null; } catch (e) { return null; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { alert('Could not save the question bank in this browser.'); } }
  function valid(q) {
    return q && typeof q.question === 'string' && q.question.trim() && Array.isArray(q.answers) && q.answers.length === 4 &&
      q.answers.every(a => typeof a === 'string' && a.trim()) && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4;
  }
  const uid = () => 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const pick = arr => arr[HH.Kit ? HH.Kit.rand(arr.length) : Math.floor(Math.random() * arr.length)];

  /* ---------- choosing a question for a team ---------- */
  // Unused by both teams first, then unused by this team, then least recently
  // used, and never the question this team saw last.
  function pickFor(i) {
    if (!list.length) return { q: null };
    const d = HH.State.data, log = (d && d.quizLog) || [], mine = (d && d.teams[i].usedQuestions) || [];
    const fresh = list.filter(q => !log.includes(q.id));
    if (fresh.length) return { q: pick(fresh) };
    const notMine = list.filter(q => !mine.includes(q.id));
    if (notMine.length) return { q: pick(notMine), exhausted: 'shared' };
    const last = mine[mine.length - 1];
    let best = null, bestIdx = Infinity;
    list.forEach(q => {
      if (q.id === last && list.length > 1) return;
      const idx = log.lastIndexOf(q.id);
      if (idx < bestIdx) { bestIdx = idx; best = q; }
    });
    return { q: best || list[0], exhausted: 'all' };
  }

  /* ---------- import / export ---------- */
  function exportJSON() {
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'haunted-house-questions.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function importJSON(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!Array.isArray(data)) throw new Error('The file must contain a list of questions.');
        const ok = data.filter(valid).map(q => ({ id: q.id || uid(), category: q.category || '', question: q.question.trim(), answers: q.answers.map(a => a.trim()), correct: q.correct }));
        if (!ok.length) throw new Error('No valid questions found (each needs a question, 4 answers and a correct index 0-3).');
        if (!confirm(`Replace the current ${list.length} questions with ${ok.length} imported questions?`)) return;
        list = ok; save(); render();
      } catch (e) { alert(e.message); }
    };
    r.readAsText(file);
  }

  /* ---------- the host editor ---------- */
  function usage(id) {
    const d = HH.State.data;
    if (!d) return '';
    return d.teams.map((t, i) => `<span class="qe-badge ${t.usedQuestions.includes(id) ? 'on' : ''}" title="${esc(t.name)}">T${i + 1}</span>`).join('');
  }

  function formHTML(q) {
    const a = q.answers || ['', '', '', ''];
    return `<div class="qe-form">
      <label>Category (optional)<input data-f="category" value="${esc(q.category || '')}" maxlength="40"></label>
      <label>Question<textarea data-f="question" maxlength="300">${esc(q.question || '')}</textarea></label>
      <div class="qe-answers">${[0, 1, 2, 3].map(i => `
        <div class="qe-answer"><input type="radio" name="qe-correct" value="${i}" ${q.correct === i ? 'checked' : ''} title="Correct answer">
        <b>${'ABCD'[i]}</b><input type="text" data-f="a${i}" value="${esc(a[i] || '')}" maxlength="120" placeholder="Answer ${'ABCD'[i]}"></div>`).join('')}
      </div>
      <div class="muted">Tick the circle next to the correct answer.</div>
      <div class="editor-actions"><button data-a="cancel">Cancel</button><button data-a="save" class="primary">Save question</button></div>
    </div>`;
  }

  function render() {
    const box = $('quiz-editor-box');
    const cats = [...new Set(list.map(q => q.category || '').filter(Boolean))];
    const shown = list.filter(q => !filter || (q.category || '') === filter);
    box.innerHTML = `
      <h3>Question bank</h3>
      <p class="muted">${list.length} questions. Each failed attempt at the Ghost's Quiz uses a new one. Changes are saved in this browser; Export keeps a copy.</p>
      <div class="qe-toolbar">
        <button data-a="add" class="primary">+ Add question</button>
        <select data-a="filter"><option value="">All categories</option>${cats.map(c => `<option ${c === filter ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <span class="spacer"></span>
        <button data-a="reset-usage">Reset usage</button>
        <button data-a="export">Export JSON</button>
        <button data-a="import">Import JSON</button><input type="file" accept="application/json,.json" hidden data-a="file">
        <button data-a="close">Close</button>
      </div>
      <div id="qe-form-slot">${editing ? formHTML(editing) : ''}</div>
      <div class="qe-list">${shown.length ? shown.map(q => `
        <div class="qe-row" data-id="${esc(q.id)}">
          <span class="cat">${esc(q.category || '—')}</span>
          <span class="q">${esc(q.question)}<small>✓ ${'ABCD'[q.correct]}: ${esc(q.answers[q.correct])}</small></span>
          <span class="used">${/^sample-/.test(q.id) ? '<span class="qe-badge sample">SAMPLE</span>' : ''}${usage(q.id)}</span>
          <span><button data-a="edit">Edit</button> <button data-a="delete" class="danger">Delete</button></span>
        </div>`).join('') : '<div class="qe-empty">No questions yet. Add one, or import a file.</div>'}
      </div>`;
  }

  function readForm() {
    const f = $('qe-form-slot');
    const val = k => f.querySelector(`[data-f="${k}"]`).value.trim();
    const checked = f.querySelector('input[name="qe-correct"]:checked');
    return { category: val('category'), question: val('question'), answers: [0, 1, 2, 3].map(i => val('a' + i)), correct: checked ? +checked.value : -1 };
  }

  function onClick(e) {
    const btn = e.target.closest('[data-a]');
    if (!btn || btn.tagName === 'SELECT' || btn.tagName === 'INPUT') return;
    const a = btn.dataset.a, row = btn.closest('.qe-row'), q = row && list.find(x => x.id === row.dataset.id);
    if (a === 'close') { editing = null; $('quiz-editor').classList.remove('show'); }
    if (a === 'add') { editing = { id: null, category: filter, question: '', answers: ['', '', '', ''], correct: -1 }; render(); $('qe-form-slot').querySelector('textarea').focus(); }
    if (a === 'edit' && q) { editing = clone(q); render(); $('qe-form-slot').scrollIntoView({ block: 'nearest' }); }
    if (a === 'delete' && q && confirm(`Delete this question?\n\n${q.question}`)) { list = list.filter(x => x !== q); save(); render(); }
    if (a === 'cancel') { editing = null; render(); }
    if (a === 'save') {
      const v = readForm();
      if (!v.question) return alert('Write the question.');
      if (v.answers.some(x => !x)) return alert('All four answers are needed.');
      if (v.correct < 0) return alert('Tick the correct answer.');
      if (editing.id) Object.assign(list.find(x => x.id === editing.id), v);
      else list.push(Object.assign({ id: uid() }, v));
      editing = null; save(); render();
    }
    if (a === 'reset-usage' && confirm('Forget which questions both teams have already answered?')) { HH.State.resetQuestionUsage(); render(); }
    if (a === 'export') exportJSON();
    if (a === 'import') $('quiz-editor-box').querySelector('input[data-a="file"]').click();
  }

  function openEditor() {
    const box = $('quiz-editor-box');
    if (!box.dataset.bound) {
      box.addEventListener('click', onClick);
      box.addEventListener('change', e => {
        if (e.target.dataset.a === 'filter') { filter = e.target.value; render(); }
        if (e.target.dataset.a === 'file' && e.target.files[0]) importJSON(e.target.files[0]);
      });
      box.dataset.bound = '1';
    }
    render();
    $('quiz-editor').classList.add('show');
  }

  return {
    all: () => list,
    pickFor, openEditor, exportJSON,
    add(q) { if (!valid(q)) return false; list.push(Object.assign({ id: uid() }, q)); save(); return true; },
    remove(id) { list = list.filter(q => q.id !== id); save(); },
    restoreSamples() { list = clone(HH.QUIZ_SAMPLES); save(); }
  };
})();
