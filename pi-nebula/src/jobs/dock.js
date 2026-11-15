// THE DOCK'S BRIDGE CHALLENGE: triangles and trusses for the telescoping boarding bridge; solving it unlocks the
// docking port. COMING SOON: the docking port and its bridge are picked from option sheets first, so only its spot (by
// the docking airlock) is marked today.
//
// TO FILL IT IN (~/pw/space-math/JOBS.md, "Adding a job"): Mathwood's geometry makers are the windmill's and the
// bridge's (mathwood-valley/labs/windmill/questions.js, labs/bridge/questions.js: angles, kinds of triangles, the missing
// angle, right triangles), on the 'geo' strand; a SETTING or a maker of its own for the truss's lengths; a `card` (the
// bridge's blueprint). The unlock is a level reached (engine.js level()). Then set open: true.
export const PLACE = null;
export const JOB = {
  id: 'dock', name: 'The docking bridge', short: 'Dock', open: false,
  spot: { place: 'airlock', toward: { place: 'galley' }, out: 3.5 },
  sign: 'Docking bridge', hint: 'The triangle bridge challenge: coming soon',
  place: PLACE, setting: null, makers: null, card: 'blueprint',
};
