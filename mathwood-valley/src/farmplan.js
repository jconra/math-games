// THE FARM, LAID OUT (plain data and plain functions, no page and no three.js, so the node tests read it): where the
// farm's spots are, its fences, and its buildings and props as the town's layout has its own. src/farm.js makes the farm
// from it (its fences and animals); the world puts the barn, the wind pump, the troughs and the hay into the town's
// layout as the valley is made (src/world.js); the jobs find the pens and gates through the farm's layout.
//
// FARM: the spots and numbers, in the farm's own frame (metres; x across the front, z toward the town, so the lane runs
// along +z), turned into the world by the farm's place (W.places.farm: { x, z, rot, w, d })
//
// farmLayout(place) -> {   (world coordinates, metres; rot as three's rotation.y: a front facing +z is 0)
//   x, z, rot, w, d          the farm's middle and turn (its front, the lane's open end, faces the way rot says)
//   at(lx, lz)               a point in the farm's own frame, in the world: { x, z }
//   local(x, z)              the other way: a world point in the farm's frame: { x, z }
//   entry                    the lane's open end at the front of the farm, where a rider comes in: { x, z }
//   barn                     { x, z, rot, w, d, h, door: { x, z } }   door: on the ground in front of the big doors
//   windmill                 { x, z }
//   sheep, paddock, yard     the fenced spots: { x, z, rot, w, d, gate: { x, z, rot, width, in, out } } (gate.rot: the way
//                            out, as three's rotation.y; in / out: 3 m inside and outside the gap)
//   pens                     [ { x, z, rot, w, d, gate } x 2 ]   inside the pig yard, along its back fence; their gates
//                            open into the yard (gate.out is in the yard, gate.in inside the pen)
//   area(spot, inset)        a helper for one of those: { contains(x, z), random(rand) -> { x, z } }, inset metres in
//                            from the fence
// }
// farmItems(place) -> [{ id, type: 'model' | 'prop', kind, x, z, rot (degrees), level }]   the barn, the wind pump, the
//                            troughs and the hay, in the world, as the town's layout has its own (objects/village.js)
// fenceLines() -> [[[x, z], [x, z]], ...]   the fence runs in the farm's frame (the gates left open)

export const FARM = {
  // the spots, in the farm's own frame (metres from its middle; +z toward the town): x0..x1 across, z0..z1 back to front
  sheep: { x0: -27, x1: -5, z0: -6, z1: 22, gate: { side: '+z', at: -11, width: 4.5 } },
  paddock: { x0: 8, x1: 27, z0: 1, z1: 22, gate: { side: '-x', at: 11.5, width: 4.5 } },
  yard: { x0: 8, x1: 27, z0: -22, z1: -4, gate: { side: '+z', at: 11.5, width: 3.5 } },
  pens: { n: 2, depth: 6, gate: 2.2 },        // along the yard's back fence: how many (two: the pig job sorts by a side), how deep (m), each one's gap (m)
  barn: { x: 0, z: -15, w: 12, d: 9, ridge: 7.4, rot: 0 },   // its big doors face the lane (+z) (labs/buildings/barn.js: 12 x 9 m walls)
  windmill: { x: -15, z: -14 },                // the wind pump (labs/buildings/windpump.js), its wheel facing the town
  // the troughs (rot: radians in the farm's frame): the sheep's, the paddock's, and the stock tank at the end of the wind
  // pump's pipe, just outside its legs
  troughs: [{ x: -23.5, z: -2.5, rot: 0 }, { x: 23.5, z: 18.5, rot: 0 }, { x: -12.95, z: -14, rot: Math.PI / 2 }],
  // the hay: a haystack between the barn and the wind pump, a stack of bales by the barn's front corner, one in the paddock
  hay: [{ kind: 'haystack', x: -10.2, z: -12.5, rot: Math.PI / 2 }, { kind: 'hayBales', x: -8.4, z: -8.7, rot: 0.25 }, { kind: 'hayBales', x: 24.3, z: 3.2, rot: 0 }],
  fence: { gap: 2.2, h: 1.1, half: 0.35 },     // posts about this far apart (as the town's), their height; a rail blocks this far either side
  cows: 3,                                     // farm-pack cows in the paddock (and one horse)
  awake: 220,                                  // metres from the player within which the paddock animals move
  mowFade: 5,                                  // metres outside the farm over which its mown ground gives way to the meadow
};

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ── THE LAYOUT (no three.js objects: a job can call it on its own) ───────────────────────────────────────────────
export function farmLayout(place) {
  const P = place || { x: 0, z: 0, rot: 0, w: 56, d: 48 };
  const rot = P.rot || 0, c = Math.cos(rot), s = Math.sin(rot);
  // (as world.js turns the corral: local x across, local z toward the front)
  const at = (lx, lz) => ({ x: P.x + c * lx + s * lz, z: P.z - s * lx + c * lz });
  const local = (x, z) => { const dx = x - P.x, dz = z - P.z; return { x: c * dx - s * dz, z: s * dx + c * dz }; };
  const OUT = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] };
  // a fenced rectangle in the farm's frame -> its record in the world
  function spot(R) {
    const mx = (R.x0 + R.x1) / 2, mz = (R.z0 + R.z1) / 2, g = R.gate, o = OUT[g.side];
    const gx = o[0] ? (o[0] > 0 ? R.x1 : R.x0) : g.at, gz = o[1] ? (o[1] > 0 ? R.z1 : R.z0) : g.at;
    const gate = { ...at(gx, gz), rot: wrap(rot + Math.atan2(o[0], o[1])), width: g.width, in: at(gx - o[0] * 3, gz - o[1] * 3), out: at(gx + o[0] * 3, gz + o[1] * 3) };
    return { ...at(mx, mz), rot, w: R.x1 - R.x0, d: R.z1 - R.z0, gate, box: R };
  }
  const Y = FARM.yard, PN = FARM.pens, pw = (Y.x1 - Y.x0) / PN.n;
  const pens = [];
  for (let i = 0; i < PN.n; i++) {
    const x0 = Y.x0 + i * pw, x1 = x0 + pw, z0 = Y.z0, z1 = Y.z0 + PN.depth;
    pens.push(spot({ x0, x1, z0, z1, gate: { side: '+z', at: (x0 + x1) / 2, width: PN.gate } }));
  }
  const B = FARM.barn, bd = at(B.x, B.z + B.d / 2 + 1.5);
  const L = {
    x: P.x, z: P.z, rot, w: P.w || 56, d: P.d || 48, at, local,
    entry: at(1, (P.d || 48) / 2),
    barn: { ...at(B.x, B.z), rot: wrap(rot + B.rot), w: B.w, d: B.d, h: B.ridge, door: bd },
    windmill: at(FARM.windmill.x, FARM.windmill.z),
    sheep: spot(FARM.sheep), paddock: spot(FARM.paddock), yard: spot(FARM.yard), pens,
  };
  // a spot's inside, inset metres in from its fence
  L.area = (sp, inset = 1.5) => {
    const b = sp.box, x0 = b.x0 + inset, x1 = b.x1 - inset, z0 = b.z0 + inset, z1 = b.z1 - inset;
    return {
      contains: (x, z) => { const p = local(x, z); return p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1; },
      random: (rand = Math.random) => at(x0 + rand() * (x1 - x0), z0 + rand() * (z1 - z0)),
    };
  };
  return L;
}

// ── THE FARM'S THINGS, AS THE TOWN'S OWN (no three.js: the world asks for them before anything is made) ─────────────
// the barn (levelling the ground under it, as the town's buildings do), the wind pump, the troughs and the hay, in world
// coordinates; rot in degrees, as the layout has it
export function farmItems(place) {
  const L = farmLayout(place), deg = (r) => +((((r * 180 / Math.PI) % 360) + 360) % 360).toFixed(1);
  const at = (lx, lz, rot = 0) => { const p = L.at(lx, lz); return { x: +p.x.toFixed(2), z: +p.z.toFixed(2), rot: deg(L.rot + rot) }; };
  const B = FARM.barn, M = FARM.windmill;
  return [
    { id: 'farm-barn', type: 'model', kind: 'barn', ...at(B.x, B.z, B.rot), level: true },
    { id: 'farm-windpump', type: 'model', kind: 'windpump', ...at(M.x, M.z) },
    ...FARM.troughs.map((t, i) => ({ id: 'farm-trough' + (i + 1), type: 'prop', kind: 'trough', ...at(t.x, t.z, t.rot) })),
    ...FARM.hay.map((h, i) => ({ id: 'farm-hay' + (i + 1), type: 'prop', kind: h.kind, ...at(h.x, h.z, h.rot || 0) })),
  ];
}

// the fence lines in the farm's frame: each spot's four sides with its gate left open, and the pens' fronts and sides
export function fenceLines() {
  const lines = [];
  const rect = (R, gaps = []) => {
    const sides = { '-z': [[R.x0, R.z0], [R.x1, R.z0]], '+x': [[R.x1, R.z0], [R.x1, R.z1]], '+z': [[R.x1, R.z1], [R.x0, R.z1]], '-x': [[R.x0, R.z1], [R.x0, R.z0]] };
    for (const [side, [a, b]] of Object.entries(sides)) lines.push(...cut(a, b, gaps.filter((g) => g.side === side)));
  };
  // a straight line with gaps cut out of it (each gap at `at` along the side's own axis, `width` wide)
  function cut(a, b, gaps) {
    const along = a[0] === b[0] ? 1 : 0, lo = Math.min(a[along], b[along]), hi = Math.max(a[along], b[along]);
    const holes = gaps.map((g) => [g.at - g.width / 2, g.at + g.width / 2]).sort((p, q) => p[0] - q[0]);
    const out = []; let from = lo;
    for (const [h0, h1] of holes) { if (h0 > from + 0.3) out.push([from, h0]); from = Math.max(from, h1); }
    if (hi > from + 0.3) out.push([from, hi]);
    return out.map(([u0, u1]) => (along ? [[a[0], u0], [a[0], u1]] : [[u0, a[1]], [u1, a[1]]]));
  }
  for (const k of ['sheep', 'paddock', 'yard']) rect(FARM[k], [FARM[k].gate]);
  // the pens: a front line along the yard with a gap for each pen, and the walls between them (the yard's own back
  // and side fences close them in)
  const Y = FARM.yard, PN = FARM.pens, pw = (Y.x1 - Y.x0) / PN.n, fz = Y.z0 + PN.depth;
  const gaps = []; for (let i = 0; i < PN.n; i++) gaps.push({ at: Y.x0 + (i + 0.5) * pw, width: PN.gate });
  lines.push(...cut([Y.x0, fz], [Y.x1, fz], gaps));
  for (let i = 1; i < PN.n; i++) lines.push([[Y.x0 + i * pw, Y.z0], [Y.x0 + i * pw, fz]]);
  return lines;
}
