// THE POSITIONS AND THEIR COLOURS: one table for every position a crew member can hold, and the colour it wears: the
// sleepers in the rescue's stasis pods, and the crews whose standard is a uniform. The game's maker (2026-11-21, of the
// sleepers): "I like it when it looks like they are wearing certain colors for their position like red-Captain,
// purple-engineer, yellow-drill or whatever". The colours are the crew kit's band colours (kit/crew.js BAND_COLOURS, by
// name): his three (red for a captain, purple for an engineer, yellow for a drill operator: the kit's gold) and two
// more: blue for a pilot, green for a medic.
//
// HOW IT IS WORN (the sleepers' way, src/sleeper.js): on the crew uniform's bands (the crew kit's colours.uniform: the
// grey uniform's (atlantis2) chest and side panels, the dark one's (atlantis1) stripes on the chest and arms). An outfit
// without such bands (a jacket, a captain's uniform, the medic's whites, the smelter's suit: on them the same colour
// fills the whole outfit, or nothing at all) is swapped for the crew uniform of its build (the suit's skeleton: 'm'
// atlantis1, 'f' atlantis2). The rest of the person (head, hair, skin, face, height) is as their look has it.
//
// A CREW'S STANDARD, NOT THE STATION'S (the game's maker, 2026-11-22: "I don't think everyone in our station needs to
// conform to the same kind of colors or uniforms. I was just thinking that certain crews might all use a standard
// uniform. Like maybe on the miner everyone wears whatever they want. But on the medic ship everyone wears the Atlantis
// uniforms and the colors mean something."). CREWS, by ship: a crew with a standard (standard: true) wears the crew
// uniform in each one's position's colour; any other crew, and the station's people, wear their own clothes. The
// captain of a crew with a standard keeps their own body (his answer JOB1-1 B) unless captainToo: Captain Hale wears the
// Medic's uniform in the captain's red as her official uniform, everywhere (the game's maker, 2026-11-22: "Yeah I think
// that the captain should also have the crews uniform. So we can just make an Atlantis uniform as Captain Hales official
// uniform."); the other captains keep their own bodies. positions: the jobs the crew has (the Medic's: the rescue run's
// contract, Pilot, Medic, Engineer: ~/pw/space-math/RESCUE_PLAN.md), for the rescue run's own crew to take their colour.
//
//   POSITIONS { id: { name, colour, band } }, POSITION_IDS, CREW_UNIFORM { m, f }, CREWS { ship: { name, captain,
//   standard, captainToo, positions } }
//   wearPosition(recipe, position, lib)   -> the recipe in that position's colour (a new object; no position, or one
//                                         not in the table: the recipe as it was). lib: the crew kit's (loadCrew), for
//                                         the build of an outfit that is not a crew uniform; a recipe may also say its
//                                         own position (recipe.position), worn when none is given. A body that brings
//                                         its own head (Captain Vega's, the androids') is left as made
//   crewRecipe(recipe, { ship, position, captain }, lib)   -> as a member of that ship's crew wears it: its standard
//                                         (the position's colour on the crew uniform; a captain: 'captain', if captainToo)
//                                         or, without one, the recipe as it was
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
// the crews, by their ship (src/life.js ROSTER captain.ship, src/missions.js MISSIONS ship)
export const CREWS = {
  medic: { name: 'the Medic', captain: 'hale', standard: true, captainToo: true, positions: ['pilot', 'medic', 'engineer'] },
  miner: { name: 'the Miner', captain: 'ruiz', standard: false, positions: ['pilot', 'drill', 'engineer'] },
  // (Captain Vega's crew wear their own clothes, as the Miner's do: the game's maker, 2026-11-22, EXPL1-3 A)
  explorer: { name: 'the Explorer', captain: 'vega', standard: false, positions: ['pilot', 'sensor', 'engineer'] },
};

export function wearPosition(R, position = null, lib = null) {
  if (!R) return R;
  const id = position || R.position, P = POSITIONS[id];
  if (!P) return R;
  let suit = R.suit;
  if (!Object.values(CREW_UNIFORM).includes(suit)) {
    // (a body that brings its own head (Captain Vega's, an android's: the head made for that body only) is worn as made)
    const e = lib && lib.entry ? lib.entry('suit', suit) : null, h = lib && lib.entry && R.head ? lib.entry('head', R.head) : null;
    if (h && h.with) return R;
    suit = (e && CREW_UNIFORM[e.skeleton]) || suit;
  }
  return { ...R, suit, position: id, colours: { ...(R.colours || {}), uniform: P.colour } };
}

export function crewRecipe(R, { ship = null, position = null, captain = false } = {}, lib = null) {
  const C = CREWS[ship];
  if (!R || !C || !C.standard || (captain && !C.captainToo)) return R;
  return wearPosition(R, captain ? 'captain' : position, lib);
}
