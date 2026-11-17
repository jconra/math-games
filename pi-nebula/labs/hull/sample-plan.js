// THE HULL LAB'S SAMPLE: a real-size piece of the station's hull, as a plan for kit/hull.js buildHull (plain numbers:
// the tests read it too). The sizes are the block-out's the game's maker chose from (the idea called H, 2026-11-17: the
// hangars' wide middle band, two tiers stepping in above it and two below, every edge cut back), with ONE hangar door
// (22 m wide, 9 m tall) and one bevelled end.
//   x runs out of the door, y up from the hangar's floor, z along the hull; the door's middle is at z = 0.
//   The piece is cut flat 15.5 m past the door's middle on one side (where the hull would carry on to the next hangar)
//   and 16 m in from its skin at the back; the other end is the hull's own bevelled end.
const plates = (group) => ({ group, kind: 'plates' }), windows = { group: 'trim', kind: 'windows' };
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
  windows: { w: 2.6, h: 1.05, pitch: 4.2, lip: 0.3, sink: 0.14, skip: 5 },
};
// the sample's size (for the camera and the scale markers), and where its door is
export const SAMPLE_BOX = { min: [-24, -13.6, -31], max: [0.45, 22, 15.5] };
export const DOOR = { w: 22, h: 9, sill: 0.8, z: 0, x: 0 };
