// THE POSITIONS AND THEIR COLOURS: one table for everyone of our crew who holds a position, the station's people, the
// ships' crews and the sleepers in the rescue's stasis pods alike. The game's maker (2026-11-21, of the sleepers): "I
// like it when it looks like they are wearing certain colors for their position like red-Captain, purple-engineer,
// yellow-drill or whatever"; asked whether our own crew should too: "Let's do them all".
// The colours are the crew kit's band colours (kit/crew.js BAND_COLOURS, by name): his three (red for a captain, purple
// for an engineer, yellow for a drill operator: the kit's gold) and two more: blue for a pilot, green for a medic.
//
// HOW IT IS WORN (the sleepers' way first, src/sleeper.js): on the crew uniform's bands (the crew kit's colours.uniform:
// the grey uniform's (atlantis2) chest and side panels, the dark one's (atlantis1) stripes on the chest and arms). An
// outfit without such bands (a jacket, a captain's uniform, the medic's whites, the smelter's suit: on them the same
// colour fills the whole outfit, or nothing at all) is swapped for the crew uniform of its build (the suit's skeleton:
// 'm' atlantis1, 'f' atlantis2). The rest of the person (head, hair, skin, face, height) is as their look has it.
// OUR OWN CREW KEEP THEIR OWN BODIES (the game's maker, JOB1-1 B, 2026-11-22: the captains and the medic in their own
// bodies and their own colours, no job colour on them): for the station's people and the ships' crews (keep: true) the
// colour goes on the bands only of someone already in a crew uniform; anyone else is left exactly as their look has them.
// Only the sleepers change into the crew uniform.
//
//   POSITIONS { id: { name, colour, band } }, POSITION_IDS, CREW_UNIFORM { m, f }
//   wearPosition(recipe, position, lib, { keep })   -> the recipe in that position's colour (a new object; no position, or one
//                                         not in the table: the recipe as it was). lib: the crew kit's (loadCrew), for
//                                         the build of an outfit that is not a crew uniform; a recipe may also say its
//                                         own position (recipe.position), worn when none is given. A body that brings
//                                         its own head (Captain Vega's, the androids') is left as made. keep: their own
//                                         body kept (not in a crew uniform: the recipe as it was)
export const POSITIONS = {
  captain: { name: 'Captain', colour: '#d9463e', band: 'red' },
  pilot: { name: 'Pilot', colour: '#3f8fe8', band: 'blue' },
  engineer: { name: 'Engineer', colour: '#6e28b2', band: 'purple' },
  drill: { name: 'Drill operator', colour: '#e3b341', band: 'gold' },
  medic: { name: 'Medic', colour: '#5cbf5a', band: 'green' },
};
export const POSITION_IDS = Object.keys(POSITIONS);
// the crew uniforms (the outfits with bands), by the build of the body
export const CREW_UNIFORM = { m: 'atlantis1', f: 'atlantis2' };

export function wearPosition(R, position = null, lib = null, { keep = false } = {}) {
  if (!R) return R;
  const id = position || R.position, P = POSITIONS[id];
  if (!P) return R;
  let suit = R.suit;
  if (!Object.values(CREW_UNIFORM).includes(suit)) {
    if (keep) return R;
    // (a body that brings its own head (Captain Vega's, an android's: the head made for that body only) is worn as made)
    const e = lib && lib.entry ? lib.entry('suit', suit) : null, h = lib && lib.entry && R.head ? lib.entry('head', R.head) : null;
    if (h && h.with) return R;
    suit = (e && CREW_UNIFORM[e.skeleton]) || suit;
  }
  return { ...R, suit, position: id, colours: { ...(R.colours || {}), uniform: P.colour } };
}
