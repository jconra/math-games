// THE HULL LAB'S SAMPLE: a real-size piece of the station's hull, as a plan for kit/hull.js buildHull (plain numbers:
// the tests read it too). The sizes are the block-out's the game's maker chose from (the idea called H, 2026-11-17: the
// hangars' wide middle band, two tiers stepping in above it and two below, every edge cut back), with ONE hangar door
// (22 m wide, 9 m tall) and one bevelled end.
//   x runs out of the door, y up from the hangar's floor, z along the hull; the door's middle is at z = 0.
//   The piece is cut flat 15.5 m past the door's middle on one side (where the hull would carry on to the next hangar)
//   and 16 m in from its skin at the back; the other end is the hull's own bevelled end.
const plates = (group, shapes) => ({ group, kind: 'plates', ...shapes }), windows = { group: 'trim', kind: 'windows' };
export const SAMPLE = {
  closed: false, back: 16,
  // (walked with the outside on the right: along the door's face toward -z, round the bevelled end, in along the end)
  path: [[0, 15.5], [0, -14.5], [-7.5, -31], [-24, -31]],
  tiers: [
    { name: 'lower tier 2', profile: [[-16, -13.6], [-10.5, -13.6], [-8.5, -11.6], [-8.5, -8.6, 'in']], parts: [plates('tiers'), plates('tiers'), windows] },
    { name: 'lower tier 1', profile: [[-8.5, -8.6, 'in'], [-5.5, -8.6], [-3.5, -6.6], [-3.5, -3.4, 'in']], parts: [plates('tiers'), plates('tiers'), windows] },
    { name: 'middle band', profile: [[-3.5, -3.4, 'in'], [-1.6, -3.4], [0, -1.8], [0, 10.2], [-1.6, 11.8], [-4.5, 11.8, 'in']], parts: [plates('band'), plates('band'), plates('band'), plates('band'), plates('band')] },
    { name: 'upper tier 1', profile: [[-4.5, 11.8, 'in'], [-4.5, 15], [-6.5, 17], [-9.5, 17, 'in']], parts: [windows, plates('tiers'), plates('tiers')] },
    { name: 'upper tier 2', profile: [[-9.5, 17, 'in'], [-9.5, 20], [-11.5, 22], [-16, 22]], parts: [windows, plates('tiers'), plates('tiers')] },
  ],
  // the hangar's door, in the middle band's wall on the long straight run
  doors: [{ tier: 2, step: 2, run: 0, at: 15.5, w: 22, h: 9, y: 0, sill: 0.8, head: 0.4, jamb: 1.2, proud: 0.45 }],
  windows: { w: 2.6, h: 1.05, pitch: 4.2, lip: 0.3, sink: 0.14, panes: 2, bar: 0.09 },
};
// the sample's size (for the camera and the scale markers), and where its door is
// (with room for what stands out of its skin: the door's frame 0.45 m, a shoulder block up to 1.3 m)
export const SAMPLE_BOX = { min: [-24, -14.9, -32.3], max: [1.3, 23.3, 15.5] };
export const DOOR = { w: 22, h: 9, sill: 0.8, z: 0, x: 0 };

// ── THE FOUR SHAPE OPTIONS, A TO D ──────────────────────────────────────────────────────────────────────────────
// The same piece (the same outline, the same door, the same middle band), shaped four ways for the game's maker to
// choose from (2026-11-18: "I would prefer to see options, like A, B, C or D"). Each is a whole plan for buildHull,
// made of the kit's own shapes (kit/hull-plates.js: stack, slab and its recess, shoulders) in a different balance,
// and each has tiers that step in by different amounts and are different heights ("I don't want the tiers to all be
// the same step, because that is boring"; "I don't want everything to look like a pyramid").
//   up, down   the tiers above and below the middle band, nearest it first: [how far in from the outline its wall
//              stands, its wall's height, its sloping face's size]
//   wall       the shapes on the middle band's upright wall (the one the door is in)
//   face       the shapes on every other plated face (the band's bevels and ledges, the tiers' slopes and ledges)
export const SHAPES = ['A', 'B', 'C', 'D'];
export const SHAPE_NAMES = { A: 'Stacked plates', B: 'Shoulders', C: 'Big plates, sunk panels', D: 'A mix' };
export const SHAPE_SAYS = {
  A: 'Two layers of plates everywhere: each raised plate sits over the seam between two plates below it.',
  B: 'Thick blocks, like shoulders, each side of the door and at the corners. The tiers differ most here.',
  C: 'One big raised plate on each wide wall, with a sunk panel with sloping sides in its middle.',
  D: 'Some of each: shoulders, a big plate with a sunk panel between them, stacked plates on the sloping faces.',
};
const RECIPES = {
  A: { up: [[-3.2, 2.8, 1.4], [-10.4, 3.4, 2.6]], down: [[-6, 3.6, 1.2], [-9, 2.8, 2.6]], wall: { stack: true }, face: { stack: true } },
  B: { up: [[-2.8, 3.6, 2.4], [-11, 2.6, 1.6]], down: [[-3.2, 2.6, 2.6], [-9.6, 3.4, 1.6]], wall: { shoulders: { w: 5 } }, face: {} },
  C: { up: [[-6, 3, 1], [-8.6, 3.4, 2.8]], down: [[-3, 3.4, 1.8], [-8.4, 2.8, 2.2]], wall: { slab: { recess: true } }, face: {} },
  D: { up: [[-4.6, 2.4, 1.6], [-7.4, 3.6, 2.6]], down: [[-5, 3.4, 1.4], [-8.2, 2.6, 2.8]], wall: { shoulders: { w: 3.4 }, slab: { inset: 1, recess: true } }, face: { stack: true } },
};
export function shapePlan(letter) {
  const R = RECIPES[letter] || RECIPES.A, face = (g) => plates(g, R.face), tiers = [], BACK = -16;
  // (the plan lists the tiers from the lowest up: the lower tiers, the middle band, the upper tiers)
  let y = -3.4;
  R.down.forEach(([o, h, s], k) => {
    const next = R.down[k + 1], foot = y - h - s;
    tiers.unshift({ name: 'lower tier ' + (k + 1), profile: [next ? [next[0], foot, 'in'] : [BACK, foot], [o - s, foot], [o, y - h], [o, y, 'in']], parts: [face('tiers'), face('tiers'), windows] });
    y = foot;
  });
  tiers.push({ name: 'middle band', profile: [[R.down[0][0], -3.4, 'in'], [-1.6, -3.4], [0, -1.8], [0, 10.2], [-1.6, 11.8], [R.up[0][0], 11.8, 'in']], parts: [face('band'), face('band'), plates('band', R.wall), face('band'), face('band')] });
  y = 11.8;
  R.up.forEach(([o, h, s], k) => {
    const next = R.up[k + 1], top = y + h + s;
    tiers.push({ name: 'upper tier ' + (k + 1), profile: [[o, y, 'in'], [o, y + h], [o - s, top], next ? [next[0], top, 'in'] : [BACK, top]], parts: [windows, face('tiers'), face('tiers')] });
    y = top;
  });
  return { ...SAMPLE, tiers, doors: SAMPLE.doors.map((d) => ({ ...d, tier: R.down.length })) };
}
// how far in each tier's wall stands from the one before it, and how tall each tier is: [above, below] the middle band
export function shapeSteps(letter) {
  const R = RECIPES[letter] || RECIPES.A, steps = (list) => list.map(([o, h, s], k) => ({ in: +((k ? list[k - 1][0] : 0) - o).toFixed(3), tall: +(h + s).toFixed(3) }));
  return { up: steps(R.up), down: steps(R.down) };
}
