/* ==========================================================================
   Pacing. Cinematics play in full the first time something is seen in a
   game and short after that (the other team, retries). A new game starts
   with nothing seen; a refreshed page keeps what this game has seen.
   The host can force Full or Quick from the host panel.

   HH.Pace.quick(key) -> true when this should play short (and marks it seen).
   Keys look like 'cut:enterMansion', 'arrive:<location>', 'walk:<from>-><to>',
   'intro:<challenge>', 'death:<location>:<anchor>'.
   ========================================================================== */

window.HH = window.HH || {};

HH.Pace = (function () {
  const MODE_KEY = 'theHauntedHouse.pace';
  const SEEN_KEY = 'theHauntedHouse.seen.v1';
  const MODES = ['auto', 'full', 'quick'];

  let mode = 'auto';
  let seen = new Set();
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (MODES.includes(m)) mode = m;
    seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY)) || []);
  } catch (e) { /* defaults */ }

  function save() { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch (e) { /* ignore */ } }
  function mark(key) { if (!seen.has(key)) { seen.add(key); save(); } }

  return {
    get mode() { return mode; },
    setMode(m) {
      if (!MODES.includes(m)) return;
      mode = m;
      try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* ignore */ }
    },
    quick(key) {
      if (!key) return mode === 'quick';
      const was = seen.has(key);
      mark(key);
      return mode === 'quick' || (mode === 'auto' && was);
    },
    seen: key => seen.has(key),
    forget() { seen = new Set(); save(); }
  };
})();
