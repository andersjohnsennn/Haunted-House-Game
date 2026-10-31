/* ==========================================================================
   THE HAUNTED HOUSE — mansion layout
   --------------------------------------------------------------------------
   Everything about the house lives in this file. Both teams explore this
   exact same map; correct and fatal paths are never randomised.

   TO ADD A ROOM
     1. Add an entry to HH.MANSION.locations below.
     2. Point a choice in an existing location at it with `to: '<id>'`.
     3. Reload. Open the browser console: HH.Mansion.validate() reports
        broken links, dead ends and the current shortest route.

   LOCATION FIELDS
     name        Title card + HUD text.
     label       Optional kicker above the name, e.g. 'ROOM 1'.
     tagline     Optional line a challenge room shows after its title.
     scene       3D set to show. Either a built set name
                   'exterior' | 'entrance_hall' | 'cursed_chamber' |
                   'sacrifice_chamber' | 'knight_hall' | 'ghost_library' | 'vampire_parlor' |
                   'wine_cellar'
                 or a generated template:
                   { template: 'junction', theme: 'crypt'|'gallery'|'wing'|'corridors',
                     portals: ['door','nurseryDoor','arch','passage','stairsUp','stairsDown'],
                     portrait: 'left'|'right' }
                     -> one portal per choice, anchors 'p0', 'p1', ... left to right;
                        `portrait` hangs the host's portrait on that wall: the first
                        team to arrive is stopped by it for a toast (js/events.js)
                   { template: 'corridor', doors: 3, length: 16, tint: '#2a1a22' }
                     -> doors at the far end, anchors 'door0', 'door1', ...
     type        'start' | 'room' | 'exit'            (default 'room')
     checkpoint  true  -> arriving here safely saves it as the team's
                          checkpoint (default true).
                 false -> a "deceptive" room: dying in here sends the team
                          back to the last real checkpoint.
     arrival     Optional cutscene played after arriving (see cinematics.js).
     prompt      Optional line shown under the choices.
     challenge   Optional challenge the team must beat before moving on:
                   { id, type, title, ... }
                 type: 'placeholder'  host-confirmed, text from title/instructions
                       'sacrifice'    three random players, host confirms each
                       'knightDuel'   nominate a champion, pick a cup (its time stays secret), host confirms
                       'ghostQuiz'    one question from js/quiz-bank.js; with
                                      bonus: { flag, item } a team that answered right
                                      may try one more question for the flag (e.g. a
                                      weapon) or move on. A wrong bonus answer ends the
                                      turn; next turn the team may try again or leave.
                       'vampireCards' four card predictions (correct cards are kept for retries)
                       'shellGame'    follow the key under three goblets (harder each retry)
                 Failing ends the turn (no death). The team returns to this room
                 and must beat it before any choice appears. Completed
                 challenges are never repeated. Beating one spins the Wheel of
                 Bones for the other team, failing one spins it for the team
                 itself (js/wheel.js); add wheel: false to skip it.
     onComplete  Optional { to, cutscene } walked automatically after the
                 challenge is beaten (through the door it opened). Without it,
                 the room's own choices appear.
     choices     Any number of choices (2, 3, 4...). Empty = under construction.

   CHOICE FIELDS
     key         Letter shown to players. Auto-assigned A, B, C... if omitted.
     label       Text on the in-world marker.
     anchor      Named point in the 3D set that the marker floats over.
     to          Destination location id (safe choices).
     fatal       true -> the demon kills the team on this path.
     demon       How the demon appears: 'doorway' | 'lightsOut' | 'behind' |
                 'ceiling' | 'crawl' (default 'lightsOut'). The staircase in the
                 entrance hall uses its own cutscene, 'stairsDeath'.
     cutscene    Cutscene override. Defaults: 'genericWalk' / 'demonDeath'.
     death       Optional { title, message } overrides for the death screen.
     forfeit     Optional forfeit text specific to this death.
     requires    Optional array of flags the team needs for this choice to show.
     sets        Optional array of flags given to the team when it picks this.
     chase       Optional { unless: flag }: the demon chases the team down this
                 path. A team with the flag fights it off and walks on; any
                 other team is caught (a death), but only the first time: on its
                 next turn the way is clear. The demon comes from behind, or from
                 the set's 'chase' anchor if it has one.
   ========================================================================== */

window.HH = window.HH || {};

HH.MANSION = {
  startLocation: 'outside',

  // A candle flip picks which team enters first. false: Team 1 always starts.
  randomFirstTeam: true,

  // Number of correct decisions on the shortest escape route. Only used for the
  // progress indicator while no exit is reachable; otherwise the route length
  // is computed from the graph automatically.
  plannedRouteLength: 9,

  // Real-life forfeits after a death, shown on the forfeit card. One is picked
  // at random unless the fatal choice names its own `forfeit`. Leave empty to
  // show a placeholder card. (The house rules in index.html say 3 sips too.)
  forfeits: ['3 sips'],

  deathDefaults: {
    title: 'YOU DIED',
    message: 'The house has claimed another victim.'
  },

  locations: {
    outside: {
      name: 'Outside the Mansion',
      scene: 'exterior',
      type: 'start',
      // The host presses START; the team walks in. Not a decision.
      enter: { to: 'entrance_hall', cutscene: 'enterMansion' },
      choices: []
    },

    /* ---- D1 ---- */
    entrance_hall: {
      name: 'The Entrance Hall',
      scene: 'entrance_hall',
      arrival: 'establishHall',
      prompt: 'Two ways forward. Decide together.',
      choices: [
        { key: 'A', label: 'Go upstairs', anchor: 'stairs', fatal: true, cutscene: 'stairsDeath' },
        { key: 'B', label: 'Enter the room on the right', anchor: 'rightDoor', to: 'cursed_chamber', cutscene: 'rightDoorEnter' }
      ]
    },

    /* ---- D2 ---- */
    cursed_chamber: {
      label: 'ROOM 1',
      name: 'The Cursed Chamber',
      scene: 'cursed_chamber',
      arrival: 'establishChamber',
      challenge: {
        id: 'cursed',
        type: 'placeholder',
        title: 'The host has a challenge for you',
        instructions: 'Listen closely: the host will now give you your challenge. ' +
                      'Complete it, and the chamber lets you pass.'
      },
      prompt: 'Three ways out of the chamber.',
      choices: [
        { key: 'A', label: 'The door between the sheets', anchor: 'sideDoor', to: 'sacrifice_chamber' },
        { key: 'B', label: 'The cracked mirror', anchor: 'mirror', fatal: true, demon: 'behind' },
        { key: 'C', label: 'The trapdoor in the circle', anchor: 'trapdoor', fatal: true, demon: 'crawl' }
      ]
    },

    sacrifice_chamber: {
      label: 'CHALLENGE',
      name: 'The Sacrifice Chamber',
      tagline: 'Three sacrifices are required to open the door.',
      scene: 'sacrifice_chamber',
      arrival: 'establishSacrifice',
      challenge: { id: 'sacrifice', type: 'sacrifice', title: 'The Sacrifice', rounds: 3 },
      onComplete: { to: 'crypt_landing', cutscene: 'throughDoor' },
      choices: []
    },

    /* ---- D3 ---- */
    crypt_landing: {
      name: 'The Crypt Landing',
      scene: { template: 'junction', theme: 'crypt', portals: ['stairsDown', 'stairsUp', 'passage'], portrait: 'left' },
      arrival: 'establishJunction',
      prompt: 'Down, up, or through the wall.',
      choices: [
        { key: 'A', label: 'Down to the cellar', anchor: 'p0', fatal: true, demon: 'behind' },
        { key: 'B', label: 'Up the spiral stairs', anchor: 'p1', to: 'knight_hall' },
        { key: 'C', label: 'The narrow passage', anchor: 'p2', fatal: true, demon: 'doorway' }
      ]
    },

    knight_hall: {
      label: 'CHALLENGE',
      name: "The Knight's Drinking Duel",
      tagline: 'Send me your champion. Defeat me, and you may pass.',
      scene: 'knight_hall',
      arrival: 'establishKnight',
      challenge: { id: 'knight', type: 'knightDuel', title: "The Knight's Drinking Duel", durations: [3, 5, 10, 25] },
      onComplete: { to: 'portrait_gallery', cutscene: 'throughDoor' },
      choices: []
    },

    /* ---- D4 ---- */
    portrait_gallery: {
      name: 'The Portrait Gallery',
      scene: { template: 'junction', theme: 'gallery', portals: ['arch', 'stairsUp', 'door'], portrait: 'right' },
      arrival: 'establishJunction',
      prompt: 'The portraits are watching. Choose.',
      choices: [
        { key: 'A', label: 'The long corridor', anchor: 'p0', to: 'ghost_library' },
        { key: 'B', label: 'The attic stairs', anchor: 'p1', fatal: true, demon: 'ceiling' },
        { key: 'C', label: 'The door with claw marks', anchor: 'p2', fatal: true, demon: 'lightsOut' }
      ]
    },

    // A right answer earns the chance at the silver dagger: one more question.
    // The dagger is needed at the very last door (see `beyond`).
    ghost_library: {
      label: 'CHALLENGE',
      name: "The Ghost's Quiz",
      tagline: 'Answer correctly, or you shall remain here.',
      scene: 'ghost_library',
      arrival: 'establishLibrary',
      challenge: { id: 'ghost', type: 'ghostQuiz', title: "The Ghost's Quiz", bonus: { flag: 'weapon', item: 'the silver dagger' } },
      onComplete: { to: 'east_wing', cutscene: 'throughDoor' },
      choices: []
    },

    /* ---- D5 ---- */
    east_wing: {
      name: 'The East Wing',
      scene: { template: 'junction', theme: 'wing', portals: ['door', 'nurseryDoor'], portrait: 'right' },
      arrival: 'establishJunction',
      prompt: 'Two doors. One of them is humming a lullaby.',
      choices: [
        { key: 'A', label: 'The antique door', anchor: 'p0', to: 'vampire_parlor' },
        { key: 'B', label: 'The nursery', anchor: 'p1', fatal: true, demon: 'crawl' }
      ]
    },

    vampire_parlor: {
      label: 'CHALLENGE',
      name: "The Vampire's Table",
      tagline: 'Four correct predictions. One chance.',
      scene: 'vampire_parlor',
      arrival: 'establishVampire',
      challenge: { id: 'vampire', type: 'vampireCards', title: "The Vampire's Table", aceLow: true },
      onComplete: { to: 'three_corridors', cutscene: 'throughDoor' },
      choices: []
    },

    /* ---- D6 ---- */
    three_corridors: {
      name: 'The Three Corridors',
      scene: { template: 'junction', theme: 'corridors', portals: ['arch', 'arch', 'arch'], portrait: 'left' },
      arrival: 'establishJunction',
      prompt: 'Three corridors. Only one leads on.',
      choices: [
        { key: 'A', label: 'The left corridor', anchor: 'p0', fatal: true, demon: 'lightsOut' },
        { key: 'B', label: 'The middle corridor', anchor: 'p1', to: 'wine_cellar' },
        { key: 'C', label: 'The right corridor', anchor: 'p2', fatal: true, demon: 'doorway' }
      ]
    },

    wine_cellar: {
      label: 'CHALLENGE',
      name: 'The Wine Cellar',
      tagline: 'Follow the key. Lose it, and you stay down here.',
      scene: 'wine_cellar',
      arrival: 'establishCellar',
      challenge: { id: 'cellar', type: 'shellGame', title: 'The Wine Cellar', swaps: [16, 20, 24], swapTime: [0.25, 0.21, 0.18] },
      onComplete: { to: 'beyond', cutscene: 'throughDoor' },
      choices: []
    },

    /* ---- D7 ---- */
    // The last corridor: the door at the end leads out of the house, and the
    // demon guards it. With the silver dagger (the Ghost's Quiz) the team
    // fights it off and escapes; without it the team is caught, and can only
    // leave on its next turn, once the demon has fed.
    beyond: {
      name: 'The Way Onward',
      scene: { template: 'corridor', doors: 1, length: 18, tint: '#1a1820', accent: '#26222e', glow: true },
      prompt: 'One door left. Freedom is on the other side.',
      choices: [
        { key: 'A', label: 'The way out', anchor: 'door0', to: 'exit', chase: { unless: 'weapon' },
          death: { title: 'CAUGHT', message: 'The demon was waiting at the way out. Without the silver dagger, you never stood a chance.' } }
      ]
    },

    // The way out. Reaching any location with type 'exit' wins the game.
    exit: {
      name: 'Freedom',
      scene: 'exterior',
      type: 'exit',
      arrival: 'escape',
      choices: []
    }
  }
};

/* --------------------------------------------------------------------------
   Map helpers. Nothing below needs editing when adding rooms.
   -------------------------------------------------------------------------- */
HH.Mansion = (function () {
  const M = HH.MANSION;
  const KEYS = 'ABCDEFGHIJ';

  function get(id) {
    const loc = M.locations[id];
    if (!loc) return null;
    loc.id = id;
    return loc;
  }

  function choicesFor(loc, team) {
    const flags = (team && team.flags) || {};
    return (loc.choices || [])
      .filter(c => !c.requires || c.requires.every(f => flags[f]))
      .map((c, i) => Object.assign({}, c, { key: c.key || KEYS[i], index: i }));
  }

  // Edges of the map: [target, cost]. Automatic walks cost no decision.
  function edges(id) {
    const loc = get(id);
    if (!loc) return [];
    const out = [];
    if (loc.enter && loc.enter.to) out.push([loc.enter.to, 0]);
    if (loc.onComplete && loc.onComplete.to) out.push([loc.onComplete.to, 0]);
    (loc.choices || []).forEach(c => { if (!c.fatal && c.to) out.push([c.to, 1]); });
    return out;
  }

  // 0-1 BFS: fewest decisions from `from` to every reachable location.
  function distancesFrom(from) {
    const dist = { [from]: 0 };
    const queue = [from];
    while (queue.length) {
      const id = queue.shift();
      edges(id).forEach(([to, cost]) => {
        const d = dist[id] + cost;
        if (dist[to] === undefined || d < dist[to]) {
          dist[to] = d;
          cost === 0 ? queue.unshift(to) : queue.push(to);
        }
      });
    }
    return dist;
  }

  function decisionsToExit(from) {
    const dist = distancesFrom(from);
    let best = null;
    Object.keys(dist).forEach(id => {
      const loc = get(id);
      if (loc && loc.type === 'exit' && (best === null || dist[id] < best)) best = dist[id];
    });
    return best;
  }

  function routeLength() {
    return decisionsToExit(M.startLocation) || M.plannedRouteLength;
  }

  function depth(id) {
    const d = distancesFrom(M.startLocation)[id];
    return d === undefined ? 0 : d;
  }

  function progress(id) {
    const loc = get(id);
    if (loc && loc.type === 'exit') return 1;
    return Math.max(0, Math.min(1, depth(id) / routeLength()));
  }

  function validate() {
    const problems = [];
    Object.keys(M.locations).forEach(id => {
      const loc = get(id);
      (loc.choices || []).forEach((c, i) => {
        if (!c.fatal && !c.to) problems.push(`${id}: choice ${i} is neither fatal nor has a destination`);
        if (c.to && !M.locations[c.to]) problems.push(`${id}: choice "${c.label}" leads to missing location "${c.to}"`);
      });
      if (loc.enter && !M.locations[loc.enter.to]) problems.push(`${id}: enter leads to missing "${loc.enter.to}"`);
      if (loc.onComplete && !M.locations[loc.onComplete.to]) problems.push(`${id}: onComplete leads to missing "${loc.onComplete.to}"`);
      if (loc.onComplete && !loc.challenge) problems.push(`${id}: onComplete without a challenge is never used`);
      if (loc.challenge && HH.Challenges && !HH.Challenges[loc.challenge.type]) problems.push(`${id}: unknown challenge type "${loc.challenge.type}"`);
      if (loc.type !== 'exit' && loc.type !== 'start' && !(loc.choices || []).length && !loc.onComplete) {
        problems.push(`${id}: dead end (no choices yet: shown as "under construction")`);
      }
    });
    const exitDist = decisionsToExit(M.startLocation);
    if (exitDist === null) {
      const d = distancesFrom(M.startLocation);
      const deepest = Math.max(...Object.values(d));
      problems.push(`No exit is reachable yet: deepest point is ${deepest} decisions in; progress uses plannedRouteLength (${M.plannedRouteLength}).`);
    } else if (exitDist < 8 || exitDist > 10) problems.push(`Shortest escape route is ${exitDist} decisions (target 8–10).`);
    problems.forEach(p => console.info('[mansion]', p));
    return problems;
  }

  function list() {
    return Object.keys(M.locations).map(id => ({ id, name: (M.locations[id].label ? M.locations[id].label + ': ' : '') + M.locations[id].name }));
  }

  // Every distinct 3D set the map uses (for building them all up front).
  function scenes() {
    const seen = {}, out = [];
    Object.keys(M.locations).forEach(id => {
      const s = M.locations[id].scene, k = typeof s === 'string' ? s : JSON.stringify(s);
      if (!seen[k]) { seen[k] = 1; out.push(s); }
    });
    return out;
  }

  function pickForfeit(choice) {
    if (choice && choice.forfeit) return choice.forfeit;
    if (M.forfeits.length) return M.forfeits[Math.floor(Math.random() * M.forfeits.length)];
    return null;
  }

  return { get, choicesFor, decisionsToExit, routeLength, depth, progress, validate, list, scenes, pickForfeit };
})();
