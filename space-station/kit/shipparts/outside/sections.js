// HULL SECTIONS AND CAP STYLES: plain data (no three.js), shared by the hull pieces (hull.js) and the planner that
// lays them out (hullplan.js), which also runs outside the browser to write a ship's layout file.
// A SECTION is a hull's cross-section on the ship grid (kit/grid.js SHIP_GRID: 0.5 m cells, 0.5 m steps from the deck):
//   w   half-width, in cells from the hull's middle line (a half for an odd number of cells across: the middle line is
//       then the middle of a cell, as the station's cells are numbered; a whole number puts it on a cell edge)
//   b   the belly's level, r the roof's (steps from the deck: -1 is 0.76 m off the ground, 6 is 4.26 m)
//   lo  the lower chamfer [cells across, steps up]; up the upper chamfer [cells across, steps up]
// The side wall runs from level b + lo[1] to r - up[1].
export const SECTIONS = {
  sample: { w: 4.5, b: -1, r: 6, lo: [1, 1], up: [1, 1] },     // 4.5 m wide, from 0.76 m to 4.26 m off the ground
  medic: { w: 6.5, b: -1, r: 6, lo: [1, 1], up: [2, 2] },      // 6.5 m wide, broad shoulders
  miner: { w: 5.5, b: -1, r: 6, lo: [1, 1], up: [2, 1] },      // 5.5 m, a shallow upper chamfer
  explorer: { w: 5.5, b: -1, r: 6, lo: [2, 1], up: [2, 2] },   // 5.5 m, deep chamfers top and bottom
  hauler: { w: 5.5, b: -1, r: 6, lo: [1, 1], up: [1, 1] },     // 5.5 m, boxy
};
// CAP STYLES (the hull's ends): steps in toward the end, each `len` cells long, bringing the sides in `w` cells, the
// roof down `r` steps and the belly up `b` steps (the chamfers keep their slope); `glass` makes a step's roof and upper
// chamfers a canopy (dark glass in frames); `paint` paints a step's facets by name ({ belly, lo, side, up, roof });
// `face` paints the flat end face
export const CAP_STYLES = {
  flat: { stages: [], face: 'white' },                                                                    // a flat end (engines go here)
  blunt: { stages: [{ len: 1, w: 1, r: 1, b: 1, paint: { belly: 'dark', lo: 'dark' } }], face: 'dark' },  // one 45 degree band all round
  canopy: { stages: [{ len: 4, w: 1, r: 2, b: 0, glass: true }, { len: 1, w: 1, r: 1, b: 1, paint: { belly: 'dark', lo: 'dark', side: 'dark' } }], face: 'dark' },
  wedge: { stages: [{ len: 3, w: 1, r: 3, b: 0, glass: true }, { len: 2, w: 1, r: 0, b: 1, paint: { belly: 'dark', lo: 'dark' } }], face: 'dark' },
  taper: { stages: [{ len: 2, w: 1, r: 1, b: 1 }], face: 'dark' },
};
// the sections a cap steps through, from the hull's own (z 0) to its end face; throws if a step leaves no room
export function capRings(S, style) {
  const rings = [{ S, z: 0 }];
  let cur = S, z = 0;
  for (const st of style.stages) {
    const n = { ...cur, w: cur.w - st.w, r: cur.r - st.r, b: cur.b + st.b };
    if (n.w - n.lo[0] < 0 || n.w - n.up[0] < 0 || n.r - n.up[1] < n.b + n.lo[1]) throw new Error('kit: a cap step leaves no room for its chamfers');
    z += st.len; cur = n; rings.push({ S: n, z, st });
  }
  return rings;
}
// how long a cap is (cells along the hull)
export const capLength = (style) => (CAP_STYLES[style] || style).stages.reduce((s, st) => s + st.len, 0);
