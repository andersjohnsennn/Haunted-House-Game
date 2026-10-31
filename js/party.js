/* ==========================================================================
   The guest list: teams for the party.

   This is the template. For your own party, copy this file to
   js/party.local.js and fill it in: index.html loads party.local.js right
   after this file, and it replaces these settings. .gitignore keeps
   party.local.js (and the player photos) on your computer, out of git.

   The setup screen starts from these teams. Everything stays editable there
   (⇄ moves a player, × removes, + adds, Shuffle teams re-deals everyone) and
   mid-game under H → Players. Edits are kept in this browser; "Guest list"
   on the setup screen puts these teams back.

   Changed the file and want the setup screen to load it again? Bump
   `version`: the next page load replaces the teams on the setup screen once
   (the host's name and photos are kept).
   ========================================================================== */

window.HH = window.HH || {};

HH.PARTY = {
  version: 1,

  // Two teams of player names, e.g. players: ['Anna', 'Bjørn', 'Carla'].
  teams: [
    { name: '', players: [] },
    { name: '', players: [] }
  ],

  // Coming to the party, but not playing. Shown on the setup screen as a reminder.
  sittingOut: [],

  // The Master of the House: the host's portrait hangs in the house and leads
  // the toasts. The host may play on a team too. (Filled in once; the setup
  // card can change it.) Empty: type the name on the setup screen.
  host: '',

  // Photos: one file per player in this folder, named after them in lower
  // case: "anna.png", "bjørn.png" (.jpg works too). The host's portrait uses
  // the host's own photo. A photo uploaded on the setup screen wins.
  photos: 'photos/'
};
