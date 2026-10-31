/* ==========================================================================
   Game state. Each team keeps its own players, location, checkpoint, deaths,
   completed challenges, the challenge it failed and must retry, visited
   rooms, used quiz questions and flags. Nothing one team does ever touches
   the other team's record. Saved to localStorage after every change so a
   refresh mid-party resumes where everyone was.
   ========================================================================== */

window.HH = window.HH || {};

HH.State = (function () {
  const KEY = 'theHauntedHouse.save.v1';
  let data = null;

  function newTeam(name, players) {
    const start = HH.MANSION.startLocation;
    return {
      name,
      players: (players || []).map(p => ({ id: p.id, name: p.name })),
      started: false,          // has this team walked into the house yet?
      location: start,         // where the team is right now
      checkpoint: start,       // where the team resumes after dying or failing
      deaths: 0,
      failures: 0,
      decisions: 0,
      challengesCompleted: [],
      pendingChallenge: null,  // id of a failed challenge awaiting retry
      attempts: {},            // failed attempts per challenge id (retries get harder)
      challengeProgress: {},   // progress kept between attempts, per challenge id
      usedQuestions: [],       // quiz question ids, oldest first
      visited: [start],
      flags: {},
      history: []              // [{ at, key, label, fatal }]
    };
  }

  // Bring older saves up to the current shape.
  function migrate(d) {
    d.version = 2;
    d.quizLog = d.quizLog || [];
    d.startedAt = d.startedAt || Date.now();
    d.events = d.events || { last: 0, lastId: null, log: [] };
    d.teams.forEach(t => {
      const fresh = newTeam(t.name, t.players);
      Object.keys(fresh).forEach(k => { if (t[k] === undefined) t[k] = fresh[k]; });
      if (!HH.Mansion.get(t.location)) t.location = HH.MANSION.startLocation;
      if (!HH.Mansion.get(t.checkpoint)) t.checkpoint = HH.MANSION.startLocation;
    });
    return d;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode: play on */ }
  }

  function team(i) { return data.teams[i]; }

  const api = {
    get data() { return data; },

    // spec: [{ name, players: [{ id, name }] }, ...] (plain names also accepted)
    newGame(spec) {
      const t = spec.map((s, i) => (typeof s === 'string' ? { name: s, players: [] } : s));
      data = {
        version: 2,
        phase: 'playing',      // 'playing' | 'won'
        active: 0,
        winner: null,
        quizLog: [],           // every question asked, in order, both teams
        startedAt: Date.now(),
        events: { last: 0, lastId: null, log: [] },   // room-wide events (js/events.js)
        teams: [newTeam(t[0].name || 'Team 1', t[0].players), newTeam(t[1].name || 'Team 2', t[1].players)]
      };
      save();
      return data;
    },

    hasSave() {
      try {
        const d = JSON.parse(localStorage.getItem(KEY));
        return !!(d && d.phase === 'playing' && Array.isArray(d.teams));
      } catch (e) { return false; }
    },

    peek() {
      try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
    },

    load() {
      try {
        const d = JSON.parse(localStorage.getItem(KEY));
        if (!d || !Array.isArray(d.teams)) return null;
        data = migrate(d);
        save();
        return data;
      } catch (e) { return null; }
    },

    clear() {
      data = null;
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    },

    team,
    activeIndex() { return data.active; },
    otherIndex() { return 1 - data.active; },
    active() { return team(data.active); },

    // A team arrives safely somewhere.
    arrive(i, locId) {
      const t = team(i);
      const loc = HH.Mansion.get(locId);
      t.location = locId;
      if (loc.type !== 'start') t.started = true;
      if (!t.visited.includes(locId)) t.visited.push(locId);
      if (loc.checkpoint !== false) t.checkpoint = locId;
      save();
    },

    recordChoice(i, locId, choice) {
      const t = team(i);
      t.decisions++;
      t.history.push({ at: locId, key: choice.key, label: choice.label, fatal: !!choice.fatal });
      (choice.sets || []).forEach(f => { t.flags[f] = true; });
      save();
    },

    // Death: count it and rewind to the last safe checkpoint.
    die(i) {
      const t = team(i);
      t.deaths++;
      t.location = t.checkpoint;
      save();
    },

    completeChallenge(i, id) {
      const t = team(i);
      if (!t.challengesCompleted.includes(id)) t.challengesCompleted.push(id);
      if (t.pendingChallenge === id) t.pendingChallenge = null;
      delete t.challengeProgress[id];
      save();
    },

    // A failed challenge is not a death: the team keeps its place and must retry it.
    failChallenge(i, id) {
      const t = team(i);
      t.pendingChallenge = id;
      t.failures++;
      t.attempts[id] = (t.attempts[id] || 0) + 1;
      t.checkpoint = t.location;
      save();
    },

    attempts(i, id) { return team(i).attempts[id] || 0; },
    getProgress(i, id) { return team(i).challengeProgress[id] || null; },
    setProgress(i, id, value) { team(i).challengeProgress[id] = value; save(); },
    clearProgress(i, id) { delete team(i).challengeProgress[id]; save(); },

    hasCompleted(i, id) { return team(i).challengesCompleted.includes(id); },

    // Flags: things a team has earned, such as a weapon. Kept for the whole game.
    hasFlag(i, f) { return !!team(i).flags[f]; },
    setFlag(i, f, on = true) { const t = team(i); if (on) t.flags[f] = true; else delete t.flags[f]; save(); },

    useQuestion(i, qid) {
      const t = team(i);
      t.usedQuestions = t.usedQuestions.filter(q => q !== qid).concat(qid);
      data.quizLog.push(qid);
      save();
    },

    // A room-wide event happened (who had to drink, if anyone).
    // `counts` false: logged, but doesn't restart the gap before the next random event.
    logEvent(id, extra = {}, counts = true) {
      if (!data) return;
      data.events = data.events || { last: 0, lastId: null, log: [] };
      const now = Date.now();
      if (counts) data.events.last = now;
      data.events.lastId = id;
      data.events.log.push(Object.assign({ id, at: now }, extra));
      save();
    },

    resetQuestionUsage() {
      if (!data) return;
      data.quizLog = [];
      data.teams.forEach(t => { t.usedQuestions = []; });
      save();
    },

    switchTeam() {
      data.active = 1 - data.active;
      save();
      return data.active;
    },

    setActive(i) { data.active = i; save(); },

    win(i) {
      data.phase = 'won';
      data.winner = i;
      save();
    },

    rename(i, name) { team(i).name = name; save(); },
    setPlayers(i, players) { team(i).players = players.map(p => ({ id: p.id, name: p.name })); save(); },

    /* ---- host tools ---- */
    setCheckpoint(i, locId) {
      const t = team(i);
      const loc = HH.Mansion.get(locId);
      t.location = locId;
      t.checkpoint = locId;
      t.pendingChallenge = null;
      t.started = loc.type !== 'start';
      if (!t.visited.includes(locId)) t.visited.push(locId);
      save();
    },

    resetTeam(i) {
      const old = team(i);
      const fresh = newTeam(old.name, old.players);
      fresh.deaths = old.deaths;
      fresh.usedQuestions = old.usedQuestions;
      data.teams[i] = fresh;
      save();
    },

    setDeaths(i, n) { team(i).deaths = Math.max(0, n); save(); }
  };

  return api;
})();
