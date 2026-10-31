# The Haunted House

A two-team, first-person cinematic horror game for a Halloween party. One person drives it on a TV or projector; the room decides together. The first team to escape the mansion wins. There is no overall timer.

## Running it

Double-click `index.html` (Chrome or Edge recommended), press **F** for fullscreen, and click once anywhere so the browser allows sound.

It needs an internet connection for Three.js (cdnjs) and the fonts. To play offline, download
`https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` into `js/vendor/three.min.js`; the page falls back to it automatically. Fonts fall back to Georgia.

Progress, players, photos and edited quiz questions are saved in the browser. If the page is refreshed mid-game, **Resume saved game** appears on the title screen. Nothing is uploaded anywhere.

## Before the party: players

The title screen has two columns, one per team. It starts with the teams from your guest list (see *Your own party* below). Name the teams, add players (**Enter** in a name field adds the next player), and click a player's portrait to upload a photo. ⇄ moves a player to the other team, × removes one. **Shuffle teams** deals everyone into two even teams at random; **Guest list** puts the teams from your guest list back. Changes are remembered in this browser. **Review players** shows everyone as portraits before **Begin**. Players without a photo get their initials on a silhouette. Late arrivals can be added mid-game: **H** → **Players**.

**Photos from the folder:** each player's photo is a file in `photos/`, named after the player in lower case (`anna.png`, `bjørn.png`; `.jpg` works too). The game crops it to the face automatically. A photo uploaded on the setup screen wins over the file. The folder is set by `photos` in the party file.

### Your own party

`js/party.js` is an empty template. Copy it to `js/party.local.js` and fill in the two teams, who is sitting out, the host and the photo folder. `index.html` loads `js/party.local.js` right after `js/party.js`, and it replaces the template. `.gitignore` keeps `js/party.local.js`, the photos in `photos/` and `img/host.*` on your computer, so names and faces never end up in git. Without a `party.local.js` the game starts with empty teams (the browser console shows a harmless 404 for the missing file).

Edited your party file and want the setup screen to pick it up? Bump its `version`; the next page load replaces the teams once (the host's name and photos are kept).

## How a turn works

A team keeps playing until it **dies** or **fails a challenge**:

| | Wrong path (death) | Failed challenge |
|---|---|---|
| What happens | The demon appears and kills the team | The room's own failure scene, then **CHALLENGE FAILED** |
| Forfeit | Yes: 3 sips | No: the team spins the Wheel of Bones instead |
| Counts as a death | Yes | No |
| Next turn starts at | The last decision point | The same challenge, from the start |

The turn card never says where a team will pick up (no room name, a black screen behind it); the room is revealed when the team gets there.

A team that **beats** a challenge spins the Wheel of Bones before it moves on, and the **other** team drinks what it lands on. A team that **fails** one spins it for itself.

Completed challenges are never repeated. Each team's players, checkpoint, deaths, completed challenges, failed challenge awaiting retry, visited rooms and used quiz questions are tracked separately (`js/state.js`).

## Controls

| Key | Action |
| --- | --- |
| A / B / C… or 1 / 2 / 3… | Pick a path, a cup, an answer or a card prediction (or click it) |
| Enter / Space | Start / continue a turn; spin the wheel and close it |
| H | Host controls |
| K | Fast-forward the current cutscene |
| F | Fullscreen |
| M | Mute |

Host controls (**H**): per-team checkpoints, deaths and active team; **Has the silver dagger** (give or take the weapon); **Players**; **Question bank**; **Force challenge success / fail** (if something goes wrong mid-challenge); **Cinematics: Auto / Full / Quick** and **Forget seen**; pass turn; test the escape; restart.

## The Wheel of Bones

A dark wheel of skulls and bones with a dagger for a pointer. It appears:

- **After a beaten challenge:** the winning team spins; the other team drinks the result.
- **After a failed challenge:** after CHALLENGE FAILED, the team that failed spins for itself, then the turn passes.

| On the wheel | Chance |
| --- | --- |
| 1 shot | 10% |
| 7 sips | 20% |
| 5 sips | 30% |
| 3 sips | 40% |

Each outcome's share of the wheel matches its odds. Edit the slices, odds, colours and wording in `js/wheel.js` (`HH.WHEEL`). Add `wheel: false` to a challenge to skip the wheel after it (won or lost). A death still ends with the forfeit card (**The house demands a sacrifice**).

## The house rules and room-wide events

A new game opens with **The House Rules**, read out once: the wrong path, a beaten challenge, a failed challenge, the Blood Moon and the toast (**H** → **House rules** shows them again). After that, events strike for everyone in the room without warning, whichever team is playing. They hit while a team is standing at a decision and still talking it over, a random 5–25 seconds after the choices appear, never mid-cutscene or mid-challenge. By default a decision has a 25% chance of getting one, never within 4 minutes of the last event and never in the first 3 minutes.

- **Blood Moon:** no build-up. The screen turns blood red and **FREEZE!** slams in. Everyone in the room must freeze instantly. The host taps the portrait of whoever froze last, and that player must chug.
- **A Toast:** the lights dim and the camera turns to the portrait of the **Master of the House** (the host), hanging on the wall. The host's portrait leads the toast, a 3-2-1 countdown, and the whole room drinks together: **Cheers!**

Host panel → **Events**: start either event yourself, or switch random events off. Timings, the toasts, the shout word and the wording are in `js/events.js` (`HH.EVENTS`), and new events can be added there.

## The Master of the House (the host's portrait)

Name the host with `host` in your party file (the host may also play on a team); the portrait then uses that player's photo from the photo folder. To change the host, type another name in the **Master of the House** card at the top of the setup screen (or later under **H** → **Players**), or upload a different photo there. Alternatively, put a picture in the game folder as `img/host.jpg` or `img/host.png`. The photo is painted as an old oil portrait in a gilded frame with a brass name plaque.

Portraits hang in five rooms along the route: the entrance hall (right-hand wall by the door), the crypt landing, the portrait gallery (among the cursed paintings), the east wing and the three corridors. The first time a team arrives in one of these rooms, the house stops them: *"…what is that?"*, a whisper from that side, the camera turns to the wall out of focus, the portrait sharpens as the camera pushes in, and the Master of the House raises a glass for the whole room. Each portrait does this once per game; afterwards it just hangs there.

- Hang one in another decision room: add `portrait: 'left'` or `'right'` to its junction `scene` in `js/mansion-data.js`.
- Once per team instead of once per game, or off: `portraitToasts` in `js/events.js`.
- A portrait toast doesn't hold back the random Blood Moon. The random toast still works too: it uses the room's portrait if there is one, or makes one appear on the nearest wall.

## Pacing

A new game starts with a candle flip that picks which team enters first (`randomFirstTeam` in `js/mansion-data.js`).

Cinematics play in full the first time something is seen in a game and short after that: the second team's walk into the mansion takes about 9 seconds instead of 44, establishing pans are skipped, titles and challenge intros are shorter, and walks between rooms run faster. A repeated death speeds up its build-up, but the demon itself always plays at full speed. Every new game starts fresh (so the first team always gets the full scenes, however much you tested beforehand); a refreshed page keeps what the current game has seen. In the host panel, **Full** always plays everything in full (for a first-time audience), **Quick** always plays short, and **Forget seen** starts over.

## The mansion so far

```
Outside → Entrance Hall (D1) → Cursed Chamber [placeholder challenge] (D2)
  → Sacrifice Chamber [challenge] → Crypt Landing (D3)
  → Knight's Drinking Duel [challenge] → Portrait Gallery (D4)
  → Ghost's Quiz [challenge, the silver dagger] → East Wing (D5)
  → Vampire's Table [challenge] → Three Corridors (D6)
  → Wine Cellar [challenge] → The Way Onward (D7: the way out, past the demon) → escape
```

Seven correct decisions from the front door to freedom (pressing the last door counts as one; more rooms can go in before The Way Onward). The first team through the last door wins.

**The last door.** The Way Onward is a long corridor with moonlight seeping round the door at the end. When a team presses **A · The way out**, the demon charges up the corridor behind it:

- **With the silver dagger:** the team turns, stabs it, it flees ("The demon flees"), and the team walks out and wins.
- **Without it:** the door won't open, and the demon takes the team (**CAUGHT**): a death and its 3 sips, then the other team plays. That happens only once per team: on its next turn the demon has fed, and the team walks out. Every wrong path is the same demon, staged for the place: rushing down the stairs, behind you, out of the dark, from the ceiling, crawling out, or there when the lights come back.

## The challenge rooms

- **The Sacrifice Chamber** (host-confirmed): accept or refuse; three random players are chosen one at a time with their portrait, and the host confirms each drink. Unique picks when the team has three or more players. Any refusal fails. A non-alcoholic option is always fine.
- **The Knight's Drinking Duel** (one champion, host-confirmed): the team nominates its champion first, then the champion picks one of four cups. The cups hide 3, 5, 10 and 25 seconds (reshuffled every attempt), but the time is never shown: after START DUEL and a 3-second countdown the knight drinks, and only a bar runs down, with no numbers. The host records **Team wins** or **Knight wins**. On a retry the last champion is marked **Last time**; pick them again or choose someone new.
- **The Ghost's Quiz** (whole team): one question from the bank; one click answers. A team never gets the same question on its next attempt.
  - **The silver dagger.** After a right answer the ghost offers one more question, for the dagger the team will need at the last door (see *The last door* above). The players are not told what it is for: the ghost "will not say". Every wrong answer ends the turn:

    | Answer | What happens |
    | --- | --- |
    | Question 1 wrong | CHALLENGE FAILED, the team spins the wheel for itself, the other team plays. Next turn: question 1 again. |
    | Question 1 right | **Try for the silver dagger** or **Move on** |
    | Move on | The winners' wheel (the other team drinks), then out of the room, without the dagger |
    | Dagger question right | The ghost hands over the dagger, the winners' wheel, then out of the room |
    | Dagger question wrong | CHALLENGE FAILED ("No silver dagger this time"), the team spins the wheel for itself, the other team plays |
    | Next turn after that | No question 1: **Try again** (as above) or **Spin the wheel and leave** |

  - A team keeps the dagger for the rest of the game; it shows as a glowing dagger next to the team's death count.
- **The Vampire's Table** (whole team): red/black, higher/lower, inside/outside, then the suit, from a freshly shuffled deck. Aces are low. Equal ranks (and, in stage 3, a card matching either of the first two) are burned and dealt again; the rule for stage 3 is spelled out on screen. Cards a team got right stay on the table for its next attempt, which resumes at the stage it failed. A wrong suit is taken out of the game for that team, and the last card is always dealt from the suits still in play: 1 in 4, then 1 in 3, 1 in 2, and finally a sure thing.
- **The Wine Cellar** (whole team): the ghost hides a key under one of three goblets and shuffles them; the team picks one. The shuffle is long and fast (16 swaps, speeding up to 0.25 s each), and while it runs the cellar fights back: the camera shakes, the view blinks shut and the candles die for a moment so only the ghost's glow is left. Each retry has more, faster swaps (`swaps` and `swapTime` in the data; `haunt: false` turns the effects off).

## Adding content later

Everything lives in data files; the field reference is at the top of each.

- **Rooms and paths:** `js/mansion-data.js`. Add a location, point a choice at it with `to`. Fatal choices take `demon: 'doorway' | 'lightsOut' | 'behind' | 'ceiling' | 'crawl'`.
- **Decision rooms without a custom 3D set:** `scene: { template: 'junction', theme: 'crypt' | 'gallery' | 'wing' | 'corridors', portals: ['door', 'nurseryDoor', 'arch', 'passage', 'stairsUp', 'stairsDown'] }`, one portal per choice (anchors `p0`, `p1`, ...).
- **New challenges:** give a room `challenge: { id, type: 'placeholder', title, instructions }` for a host-confirmed challenge you describe in text, or reuse a type (`sacrifice`, `knightDuel`, `ghostQuiz`, `vampireCards`, `shellGame`). Add `onComplete: { to }` to walk automatically to the next junction afterwards. A new kind of challenge is a module `HH.Challenges.<type> = { async run(ctx) { ... return 'success' | 'fail'; } }` using the helpers in `js/challenge-kit.js`.
- **Quiz questions:** in the game (**H** → **Question bank**: add, edit, delete, mark the correct answer, categories, usage, export/import JSON). To make a list permanent, export it and paste it over `HH.QUIZ_SAMPLES` in `js/quiz-bank.js`. The shipped questions are clearly marked SAMPLE.
- **Rewards and chases:** a quiz room's `challenge.bonus: { flag, item }` offers the extra question for a flag (the dagger is `flag: 'weapon'`), and a choice with `chase: { unless: 'weapon' }` (on The Way Onward's door) sets the demon on the team unless it holds that flag. A corridor with `glow: true` gets the moonlit door.
- **Forfeits (deaths):** `HH.MANSION.forfeits` (now `['3 sips']`; add more strings and one is picked at random), or give a fatal choice its own `forfeit`. The house rules screen in `index.html` mentions the 3 sips too.
- **The Wheel of Bones (challenges):** slices, odds and wording in `js/wheel.js`.
- **The exit:** the door in The Way Onward (`beyond`) leads to `exit`. To add rooms before the end, point the Wine Cellar's `onComplete` at a new room and lead the new rooms back to `beyond`.
- **Players:** your guest list, host and photo folder go in `js/party.local.js` (template: `js/party.js`).
- Run `HH.Mansion.validate()` in the browser console to list broken links, dead ends and the current shortest route length.

## Files

| File | What it holds |
| --- | --- |
| `js/mansion-data.js` | Map, choices, challenges, forfeits, map helpers |
| `js/state.js` | Per-team progress and saving |
| `js/pace.js` | Full vs quick cinematics, and what has been seen |
| `js/game.js` | Turn flow, challenge runner, HUD, host panel |
| `js/wheel.js` | The Wheel of Bones: punishments after challenges |
| `js/events.js` | Room-wide events (Blood Moon, the toast) |
| `js/party.js` | The guest list template: teams, the host, the photo folder |
| `js/party.local.js` | Your own guest list (not in git; copy `js/party.js`) |
| `photos/` | Player photos, one per player (`<name>.png`; not in git) |
| `js/roster.js` | Player registration and photos |
| `js/challenge-kit.js` | Shared challenge UI, in-world markers, the placeholder challenge |
| `js/challenge-*.js`, `js/quiz-bank.js` | The four challenges and the question bank |
| `js/demon.js` | The one demon |
| `js/weapon.js` | The silver dagger, held in first person |
| `js/cinematics.js` | Camera helpers and every cutscene |
| `js/world.js` | Renderer, camera rig, lightning, set registry |
| `js/sets-*.js` | The 3D locations (`sets-junction.js` is the decision-room template) |
| `js/props.js`, `js/textures.js` | Shared 3D props and procedural textures |
| `js/audio.js` | Synthesised sound (no audio files) |
| `css/expansion.css` | Styles for registration, challenges and editors |
