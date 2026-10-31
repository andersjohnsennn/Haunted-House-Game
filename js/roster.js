/* ==========================================================================
   Player registration. Two teams, any number of players, an optional photo
   each. A player's photo is a file named after them in the photo folder set
   in js/party.js (e.g. "photos/anna.png"), or one uploaded on the setup
   screen, which wins. make-photos.bat packs the folder into
   js/photos.local.js, so the photos also show when index.html is opened by
   double-clicking (the browser won't let a page read photo files from disk). Photos are cropped to a 256 px square JPEG; uploads
   are kept only in this browser (localStorage), never uploaded anywhere.

   HH.Roster.avatar(player, size) renders a portrait: the photo, or the
   player's initials on a spooky silhouette.
   ========================================================================== */

window.HH = window.HH || {};

HH.Roster = (function () {
  const PHOTO_KEY = 'theHauntedHouse.photos.v1';
  const ROSTER_KEY = 'theHauntedHouse.roster.v1';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

  let photos = read(PHOTO_KEY) || {};
  let draft = read(ROSTER_KEY) || blank();
  if (!draft.host) draft.host = { name: '' };
  // The guest list (js/party.js) fills the teams once per version; edits after that are kept.
  const party = HH.PARTY;
  if (party && party.version && draft.party !== party.version) { draft.teams = guestTeams(); draft.party = party.version; saveDraft(); }
  // The host named in js/party.js, set once; the setup card can still change it.
  if (party && party.host && draft.hostFrom !== party.host) { draft.host.name = party.host; draft.hostFrom = party.host; saveDraft(); }
  let callbacks = {};

  function blank() { return { host: { name: '' }, teams: [{ name: '', players: [] }, { name: '', players: [] }] }; }

  // The tentative teams from js/party.js. Ids come from the names, so photos survive a reset.
  function guestTeams() {
    const used = {};
    const id = name => {
      const base = 'guest-' + name.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '-');
      used[base] = (used[base] || 0) + 1;
      return used[base] > 1 ? base + used[base] : base;
    };
    return [0, 1].map(i => {
      const t = (party.teams || [])[i] || {};
      return { name: t.name || '', players: (t.players || []).map(n => ({ id: id(n), name: n })) };
    });
  }

  // Deal every named player into two even teams at random. Team names stay.
  function shuffleTeams(model) {
    const all = HH.Kit.shuffle(model.teams.flatMap(t => t.players.filter(p => p.name.trim())));
    const half = Math.ceil(all.length / 2), first = HH.Kit.rand(2);
    model.teams[first].players = all.slice(0, half);
    model.teams[1 - first].players = all.slice(half);
  }

  // The host's photo can also simply be a file in the game folder: img/host.jpg or img/host.png.
  let hostFile = null;
  ['img/host.jpg', 'img/host.png'].reduce((p, src) => p.then(found => found || new Promise(res => {
    const im = new Image(); im.onload = () => res(src); im.onerror = () => res(null); im.src = src;
  })), Promise.resolve(null)).then(src => {
    hostFile = src;
    if (src) hostChanged();
  });

  // Repaint the host's portrait in the house and refresh the setup card.
  function hostChanged() {
    if (HH.HostPortrait) HH.HostPortrait.repaint();
    const box = $('roster-host');
    if (box && box.firstElementChild) hostCard(box, draft.host);
  }
  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function saveDraft() { write(ROSTER_KEY, draft); }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  /* ---------- photos as files in the photo folder (js/party.js `photos`) ---------- */
  // "<folder>/<name>.png" (or .jpg), the name in lower case: "photos/bjørn.png".
  const DIR = ((party && party.photos) || '').split('/').map(encodeURIComponent).join('/');
  const filePics = {}, hostPics = {};   // lower-case name -> data URL (players 256 px, the host 512 px); null if none (yet)
  const packed = HH.PHOTOS || {};       // js/photos.local.js: the same photos, already cropped
  const nameKey = name => String(name || '').trim().toLowerCase().normalize('NFC');
  function loadFile(key, size, cache) {
    if (!key || key in cache) return;
    if (packed[key]) { cache[key] = packed[key]; return; }
    if (!DIR) return;
    cache[key] = null;
    (function attempt(exts) {
      if (!exts.length) return;
      const img = new Image();
      img.onload = () => {
        // Opened from disk, the browser won't hand over the pixels: run make-photos.bat.
        try { cache[key] = crop(img, size, true); } catch (e) { return; }
        photosChanged();
      };
      img.onerror = () => attempt(exts.slice(1));
      img.src = DIR + encodeURIComponent(key) + '.' + exts[0];
    })(['png', 'jpg', 'jpeg']);
  }
  // Load everyone on the setup screen and in a saved game right away, so no portrait pops in late.
  const saved = read('theHauntedHouse.save.v1');
  [draft, saved].forEach(d => ((d && d.teams) || []).forEach(t => (t.players || []).forEach(p => loadFile(nameKey(p.name), 256, filePics))));
  loadFile(nameKey(draft.host.name), 512, hostPics);

  // A folder photo arrived: refresh the host's portrait and whatever setup step is showing.
  let refresh = null;
  function photosChanged() {
    clearTimeout(refresh);
    refresh = setTimeout(() => {
      hostChanged();
      const el = $('screen-setup');
      if (!el || !el.classList.contains('show')) return;
      if (el.classList.contains('step-review')) $('roster-review').innerHTML = reviewHTML(clean(draft));
      else columns($('roster-cols'), draft, saveDraft);
    }, 120);
  }

  // An uploaded photo, then the host file (img/host.*), then the photo folder.
  function photo(id, name) {
    if (!id) return null;
    if (photos[id]) return photos[id];
    if (id === 'host') {
      if (hostFile) return hostFile;
      const k = nameKey(draft.host && draft.host.name);
      loadFile(k, 512, hostPics);
      return hostPics[k] || null;
    }
    const k = nameKey(name);
    loadFile(k, 256, filePics);
    return filePics[k] || null;
  }

  // The Master of the House (the host): hangs on the wall and leads the room's toasts.
  function host() {
    const name = ((draft.host && draft.host.name) || '').trim();
    return { id: 'host', name: name || 'The Master of the House', named: !!name };
  }

  function hostCard(box, model) {
    const p = { id: 'host', name: model.name || 'Host' };
    box.innerHTML = `
      <div class="hcard">
        <label class="ph" title="Upload a photo of the host">${avatar(p, 'mid')}<input type="file" accept="image/*" hidden><i>${photo('host') ? 'Change' : 'Photo'}</i></label>
        <div class="hinfo">
          <span class="tlabel">MASTER OF THE HOUSE</span>
          <input class="hname" maxlength="28" placeholder="Host name" value="${esc(model.name || '')}" aria-label="Host name">
          <small>The host's portrait hangs in the house and leads the room's toasts.</small>
        </div>
      </div>`;
    box.querySelector('.hname').onchange = e => { model.name = e.target.value; if (model === draft.host) { saveDraft(); hostChanged(); } };
    box.querySelector('input[type=file]').onchange = async e => {
      if (!e.target.files[0]) return;
      try { if (setPhoto('host', await readPhoto(e.target.files[0], 512))) { hostCard(box, model); hostChanged(); } } catch (err) { alert(err.message); }
    };
  }

  function setPhoto(id, data) {
    if (data) photos[id] = data; else delete photos[id];
    if (!write(PHOTO_KEY, photos)) {
      delete photos[id];
      alert('The browser ran out of space for photos. Try smaller images or remove some.');
      return false;
    }
    return true;
  }

  // Keep only the photos of players that still exist.
  function prunePhotos(keep) {
    const ids = new Set(keep.concat('host'));
    Object.keys(photos).forEach(id => { if (!ids.has(id)) delete photos[id]; });
    write(PHOTO_KEY, photos);
  }

  function avatar(p, size = 'mid') {
    const pic = p && photo(p.id, p.name);
    return `<div class="avatar ${size}${pic ? ' has-photo' : ''}">` +
      (pic ? `<img src="${pic}" alt="">` : `<span>${p ? esc(initials(p.name)) : ''}</span>`) + '</div>';
  }

  // Center-crop (biased up, where faces are) to a square JPEG (256 px for players, bigger for the host's portrait).
  // `tight`: the folder's head-and-shoulders shots, framed closer around the face.
  function crop(img, size, tight) {
    const m = Math.min(img.width, img.height), s = tight ? m * 0.75 : m, c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d').drawImage(img, (img.width - s) / 2, tight ? img.height * 0.02 : (img.height - s) * 0.3, s, s, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.85);
  }

  function readPhoto(file, size = 256) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        res(crop(img, size));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read that image.')); };
      img.src = url;
    });
  }

  /* ---------- editable two-column roster (used by setup and the host editor) ---------- */
  function columns(box, model, onChange) {
    function render(focusId) {
      box.innerHTML = model.teams.map((t, ti) => `
        <div class="rcol" data-t="${ti}">
          <label class="tlabel">TEAM ${ti + 1}</label>
          <input class="tname" maxlength="24" placeholder="Team ${ti + 1}" value="${esc(t.name)}" aria-label="Team ${ti + 1} name">
          <div class="plist">${t.players.map(p => `
            <div class="prow" data-id="${esc(p.id)}">
              <label class="ph" title="Upload a photo">${avatar(p, 'small')}<input type="file" accept="image/*" hidden><i>${photo(p.id, p.name) ? 'Change' : 'Photo'}</i></label>
              <input class="pname" maxlength="28" placeholder="Player name" value="${esc(p.name)}" aria-label="Player name">
              <button class="mv" title="Move to Team ${2 - ti}" aria-label="Move to the other team">⇄</button>
              <button class="rm" title="Remove" aria-label="Remove player">×</button>
            </div>`).join('')}
          </div>
          <button class="addp">+ Add player</button>
          <div class="count">${t.players.filter(p => p.name.trim()).length} players</div>
        </div>`).join('');
      if (focusId) { const el = box.querySelector(`.prow[data-id="${focusId}"] .pname`); if (el) el.focus(); }
    }
    const find = el => {
      const col = el.closest('.rcol'), row = el.closest('.prow');
      const t = model.teams[+col.dataset.t];
      return { t, ti: +col.dataset.t, p: row ? t.players.find(x => x.id === row.dataset.id) : null };
    };
    const changed = () => {
      onChange && onChange();
      box.querySelectorAll('.rcol').forEach((col, ti) => {
        col.querySelector('.count').textContent = model.teams[ti].players.filter(p => p.name.trim()).length + ' players';
      });
    };
    const add = (ti, after) => {
      const p = { id: uid(), name: '' }, list = model.teams[ti].players;
      const at = after ? list.indexOf(after) + 1 : list.length;
      list.splice(at, 0, p);
      render(p.id); changed();
    };

    box.oninput = e => {
      const { t, p } = find(e.target);
      if (e.target.classList.contains('tname')) t.name = e.target.value;
      if (e.target.classList.contains('pname') && p) p.name = e.target.value;
      changed();
    };
    box.onkeydown = e => {
      if (e.key === 'Enter' && e.target.classList.contains('pname')) { e.preventDefault(); const { ti, p } = find(e.target); add(ti, p); }
    };
    box.onclick = e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const { t, ti, p } = find(btn);
      if (btn.classList.contains('addp')) add(ti);
      if (btn.classList.contains('rm') && p) { t.players.splice(t.players.indexOf(p), 1); render(); changed(); }
      if (btn.classList.contains('mv') && p) { t.players.splice(t.players.indexOf(p), 1); model.teams[1 - ti].players.push(p); render(); changed(); }
    };
    box.onchange = async e => {
      if (e.target.type !== 'file' || !e.target.files[0]) return;
      const { p } = find(e.target);
      try {
        const data = await readPhoto(e.target.files[0]);
        if (setPhoto(p.id, data)) { render(); changed(); }
      } catch (err) { alert(err.message); }
    };
    render();
  }

  function clean(model) {
    return model.teams.map((t, i) => ({
      name: t.name.trim() || `Team ${i + 1}`,
      players: t.players.filter(p => p.name.trim()).map(p => ({ id: p.id, name: p.name.trim() }))
    }));
  }

  function reviewHTML(spec) {
    const h = host();
    return `<div class="rv-host">${avatar(h, 'big')}<div><span class="tlabel">MASTER OF THE HOUSE</span><b>${esc(h.name)}</b></div></div>` + spec.map(t => `
      <div class="rv-team">
        <h3>${esc(t.name)}</h3>
        ${t.players.length ? `<div class="rv-grid">${t.players.map(p => `<div class="rv-card">${avatar(p, 'big')}<span>${esc(p.name)}</span></div>`).join('')}</div>`
          : '<p class="rv-empty">No players registered. Random picks will say "one of you".</p>'}
      </div>`).join('');
  }

  /* ---------- setup screen ---------- */
  function step(name) {
    const el = $('screen-setup');
    el.classList.toggle('step-edit', name === 'edit');
    el.classList.toggle('step-review', name === 'review');
    el.scrollTop = 0;
  }

  function showSetup({ hasSave, saved }) {
    const empty = draft.teams.every(t => !t.name && !t.players.length);
    if (empty && saved && saved.teams) {
      draft.teams = saved.teams.map(t => ({ name: t.name, players: (t.players || []).map(p => ({ id: p.id, name: p.name })) }));
    }
    if (!draft.teams.some(t => t.players.length)) draft.teams.forEach(t => t.players.push({ id: uid(), name: '' }));
    $('btn-resume').hidden = !hasSave;
    $('btn-guests').hidden = !(party && party.teams);
    const out = (party && party.sittingOut) || [];
    $('roster-bench').textContent = out.length ? 'Not playing: ' + out.join(', ') : '';
    hostCard($('roster-host'), draft.host);
    columns($('roster-cols'), draft, saveDraft);
    step('edit');
    $('screen-setup').classList.add('show');
  }

  function init(cb) {
    callbacks = cb;
    $('btn-review').onclick = () => {
      saveDraft();
      $('roster-review').innerHTML = reviewHTML(clean(draft));
      step('review');
      HH.Audio.sfx.ui();
    };
    $('btn-edit-back').onclick = () => { step('edit'); hostCard($('roster-host'), draft.host); columns($('roster-cols'), draft, saveDraft); };
    $('btn-shuffle').onclick = () => {
      shuffleTeams(draft);
      saveDraft();
      columns($('roster-cols'), draft, saveDraft);
      HH.Audio.sfx.whoosh(0.3);
    };
    $('btn-guests').onclick = () => {
      if (!confirm('Put the teams back to the guest list from js/party.js? Changes to the teams are lost.')) return;
      draft.teams = guestTeams();
      saveDraft();
      columns($('roster-cols'), draft, saveDraft);
      HH.Audio.sfx.ui();
    };
    $('btn-begin').onclick = () => {
      const spec = clean(draft);
      prunePhotos(spec.flatMap(t => t.players.map(p => p.id)));
      $('screen-setup').classList.remove('show');
      callbacks.onBegin(spec);
    };
    $('btn-resume').onclick = () => { $('screen-setup').classList.remove('show'); callbacks.onResume(); };
  }

  /* ---------- host editor (mid-game, progress untouched) ---------- */
  function openEditor(data, onSave) {
    const src = data ? data.teams : draft.teams;
    const model = { teams: src.map(t => ({ name: t.name, players: (t.players || []).map(p => ({ id: p.id, name: p.name })) })) };
    const hostModel = { name: (draft.host && draft.host.name) || '' };
    const ed = $('roster-editor');
    hostCard($('roster-editor-host'), hostModel);
    columns($('roster-editor-cols'), model);
    ed.classList.add('show');
    $('roster-cancel').onclick = () => ed.classList.remove('show');
    $('roster-save').onclick = () => {
      const spec = clean(model);
      Object.assign(draft, { host: { name: hostModel.name.trim() }, teams: spec.map(t => ({ name: t.name, players: t.players.slice() })) });
      saveDraft();
      hostChanged();
      ed.classList.remove('show');
      onSave(spec);
    };
  }

  return { init, showSetup, openEditor, avatar, photo, initials, host };
})();
