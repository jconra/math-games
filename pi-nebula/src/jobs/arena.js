// THE ARENA: the game's maker's Tron-style number-ball game in the square inside the loop (grab balls that are numbers
// and throw them into the right goals, against a computer opponent). COMING SOON: its goals, number balls, dispensers
// and court lines are picked from option sheets first, so only its spot (by the loop hallway) is marked today.
//
// TO FILL IT IN (~/pw/space-math/JOBS.md, "Adding a job"): it is a game more than a card, so it brings its own scene;
// its questions can still come from the job system (engine.js deal and answer: a PLACE and a SETTING, as the galley's),
// each ball a coin. Then set open: true.
export const PLACE = null;
export const JOB = {
  id: 'arena', name: 'The arena', short: 'Arena', open: false,
  spot: { room: 'loop' },
  sign: 'The arena', hint: 'The number-ball game: coming soon',
  place: PLACE, setting: null, makers: null, card: 'arena',
};
