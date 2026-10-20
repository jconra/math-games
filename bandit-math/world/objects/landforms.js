// THE LANDFORMS (Bandit Math): the land shaped by hand at a few spots, on top of the land as made (or read from its
// bake) and before the town's pads are laid (world/valley.js townLand). Plain numbers only (no three.js), so the tests
// can run it as it is. The land's own code and its bake are untouched: the bake keeps the land as made, and these are
// laid over it at every load (a few milliseconds).
//
//   HILL      the mill hill west of the stable: a gentle, natural little hill, flat-ish on top, wide enough for a windmill
//             tower and a mill building, its side toward the road long and easy enough for a cart track to wind up
//   CROSSING  where the north-south road crosses the western river south-west of the cow camp: the land round it made
//             flatter (a level shelf on both banks, the road level across it) and the river in a deeper ravine with
//             steep banks, narrowest at the road (`gap` m apart there, ready for a bridge), wider up and down stream
//   FORD      until a bridge stands there: a sunken lane beside the road, down to a shallow ford and up the far side,
//             gentle enough for a horse or a wagon
//   CAMP      flat room beside the road on the town's bank for an engineer's camp and its wagon
//
//   const L = makeLandforms(base)    base(x, z): the land's height before the landforms (m)
//     L.at(x, z, h0)    the shaped height at (x, z), h0 = base(x, z) (passed in: the caller usually has it)
//     L.boxes           [{ x0, z0, x1, z1 }] the boxes the landforms change anything in (outside them L.at returns h0)
//     L.fine            { x0, z0, x1, z1 } where the ground needs drawing finer than the land's 3 m grid (the ravine's
//                       steep banks and the ford's lane): world/valley.js draws a finer patch of ground there
//     L.crossing        { x, z, deck, bed, gap, ford: { pts, bed } } (for the rigs and the tests)
//     L.hill            { x, z, top, level }
//   HILL, CROSSING, FORD, CAMP: the numbers

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const coss = (a, b, x) => (x <= a ? 1 : x >= b ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (x - a) / (b - a)));   // 1 inside a, falling softly to 0 by b

// THE MILL HILL. x, z: its middle (the marked spot); rise: how much higher its top is than the land there (m); top: the
// flat-ish top's radius; foot: where it meets the land round it; footRoad: the foot's radius on the road's side (north,
// -z), shorter so the road beside it stays as it was; crown: how much the top's middle rises over its edge; wobble: how
// far the outline strays from a circle (a share of the radius)
export const HILL = { x: -93.3, z: -171.9, rise: 3.4, top: 8.5, foot: 40, footRoad: 29, crown: 0.25, wobble: 0.1 };

// THE BRIDGE CROSSING. river: the western river's middle line round the crossing (from the water picture, smoothed:
// rigs/town/spots/river.cjs), west to east; x, z: where the road crosses it; lift: how high the shelf on each bank stands
// over the river's natural bed; lower: how much the bed is dug down at the crossing; gap: the banks' brinks (where they
// fall away steeper than 45 degrees) apart at the road (16 ft, the bridge lab's span); wall: how far each bank runs out at
// the road from where it starts to round over to the bed (m), steep below and rounding over at the top (round: the curve's
// power); wide / wallWide: the brinks apart and the banks' run, up and down stream (from `near` m along the river out to
// `far`), the brink wandering a little in and out (wander, m) as a worn bank does; core / blend: the shelf, flat out to `core` m from the river and back to the land by `core + blend`; along:
// the stretch of river shaped [west, east] m from the road (full), and `alongBlend` m more each way back to the land
export const CROSSING = {
  x: -339.2, z: -42.25, lift: 4.7, lower: 0.6, gap: 4.9, wall: 2.0, round: 2.4, wide: 11.8, wallWide: 3.4, near: 3, far: 28, wander: 0.35,
  core: 14, blend: 18, along: [-36, 18], alongBlend: 26,
  river: [[-460, -54.75], [-448, -54.2], [-440, -49.8], [-432, -45.6], [-424, -43.2], [-416, -42.4], [-408, -43.2], [-400, -44.9],
    [-392, -45.25], [-384, -45.25], [-376, -45.1], [-368, -43.75], [-360, -42.4], [-352, -42.25], [-344, -42.25], [-338, -42.25],
    [-334, -41.6], [-331, -40.2], [-328, -37.4], [-325, -34.4], [-321, -33.0], [-316, -32.6], [-310, -30.9], [-304, -29.9],
    [-296, -29.75], [-280, -29.75], [-260, -29.75], [-240, -29.75]],
};
// THE FORD beside the road, west of it: its lane's middle line from the road on the town's (north) bank, down to the
// river and up the far bank to the road's far side; half: the lane's flat floor either side of its middle (m); slope: its
// ramps (rise over run); flat: the ford's level stretch either side of the river's middle (m); side: the lane's cut sides
// (rise over run, steep enough that a rider keeps to the lane), their tops rounded over `lip` m; above: the ford's floor
// over the river's bed (m: shallow)
export const FORD = {
  pts: [[-338.6, -61], [-343, -59.6], [-348, -56.8], [-351.6, -52.4], [-353.1, -47.4], [-353.4, -42.3], [-353.2, -37.2], [-352.4, -31.6],
    [-351, -26], [-349.2, -20.6], [-347.2, -16.4]],
  half: 2.6, slope: 0.27, flat: 3.2, side: 1.3, lip: 1.4, above: 0.1,
};
// THE ENGINEER'S CAMP's room: flat ground beside the road on the town's bank, north of the ford's lane (x, z: its middle;
// r: flat out to here; blend: back to the land over this much more), at the land's own height there
export const CAMP = { x: -352, z: -72, r: 7.5, blend: 8 };

// a polyline's points every `step` m along a centripetal-ish Catmull-Rom through them (so its bends are round)
function densify(pts, step = 1) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
// the nearest point of a dense polyline to (x, z): { d (m), u (m along it), i (segment) }
function nearest(L, cum, x, z) {
  let best = Infinity, bu = 0, bi = 0;
  for (let i = 1; i < L.length; i++) {
    const ax = L[i - 1][0], az = L[i - 1][1], vx = L[i][0] - ax, vz = L[i][1] - az, l2 = vx * vx + vz * vz || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2)), dx = ax + vx * t - x, dz = az + vz * t - z, d2 = dx * dx + dz * dz;
    if (d2 < best) { best = d2; bu = cum[i - 1] + t * (cum[i] - cum[i - 1]); bi = i; }
  }
  return { d: Math.sqrt(best), u: bu, i: bi };
}
const lengths = (L) => { const c = [0]; for (let i = 1; i < L.length; i++) c.push(c[i - 1] + Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1])); return c; };

export function makeLandforms(base) {
  // ── THE HILL ──
  const H = HILL, hillLevel = base(H.x, H.z) + H.rise;
  const hillOut = (dx, dz, r) => {   // how far the outline is out along this way: 1 a circle; the road's side drawn in
    const a = Math.atan2(dz, dx), w = 1 + H.wobble * (0.6 * Math.sin(2 * a + 0.7) + 0.4 * Math.sin(3 * a + 2.1));
    return { w, foot: H.foot + (H.footRoad - H.foot) * Math.max(0, -dz / (r || 1)) };
  };
  function hillAt(x, z, h0) {
    const dx = x - H.x, dz = z - H.z, r = Math.hypot(dx, dz); if (r >= H.foot * (1 + H.wobble)) return h0;
    const o = hillOut(dx, dz, r), q = r / o.w, k = coss(H.top, o.foot, q); if (k <= 0) return h0;
    const top = hillLevel + H.crown * Math.max(0, 1 - (q / H.top) ** 2);
    return h0 + (top - h0) * k;
  }
  const hillBox = { x0: H.x - H.foot * 1.2, x1: H.x + H.foot * 1.2, z0: H.z - H.foot * 1.2, z1: H.z + H.foot * 1.2 };

  // ── THE CROSSING ──
  const C = CROSSING, R = C.river, RD = densify(R, 1), RC = lengths(RD);
  const zc = (x) => { if (x <= R[0][0]) return R[0][1]; for (let i = 1; i < R.length; i++) if (x <= R[i][0]) { const t = (x - R[i - 1][0]) / (R[i][0] - R[i - 1][0]); return R[i - 1][1] + (R[i][1] - R[i - 1][1]) * t; } return R[R.length - 1][1]; };
  // the river's natural bed along it (each metre's own, evened out over ~9 m so the shelf over it runs smooth)
  const raw = RD.map(([x, z]) => base(x, z)), bedOf = raw.map((_, i) => { let s = 0, n = 0; for (let k = -4; k <= 4; k++) { const j = i + k; if (j >= 0 && j < raw.length) { s += raw[j]; n++; } } return s / n; });
  const sOf = (x) => x - C.x;                                         // (m along the river from the road, east +: the river runs about west-east here)
  const alongW = (s) => (s < C.along[0] ? coss(0, C.alongBlend, C.along[0] - s) : s > C.along[1] ? coss(0, C.alongBlend, s - C.along[1]) : 1);
  // the brink's distance from the river's middle (wandering in and out a little, least at the road), and the bank's run
  const halfTop = (s) => { const a = Math.abs(s), g = smooth(C.near, C.far, a);
    return C.gap / 2 + (C.wide - C.gap) / 2 * g + (0.45 * Math.sin(s * 0.29 + 1.3) + C.wander * (0.6 * Math.sin(s * 1.7 + 0.6) + 0.4 * Math.sin(s * 3.3 + 2.2))) * smooth(C.near - 1.5, C.near + 6, a); };
  const wallRun = (s) => (C.wall + (C.wallWide - C.wall) * smooth(C.near, C.far, Math.abs(s))) * (1 + 0.15 * Math.sin(s * 0.83 + 0.5) * smooth(C.near, C.near + 6, Math.abs(s)));
  // (read by x, as the shelf is: the river runs west to east here, and the nearest point of a bend jumps from one side
  // of it to the other a little way out, which drew a step across the shelf)
  const bedAt = (x) => { if (x <= RD[0][0]) return bedOf[0]; for (let i = 1; i < RD.length; i++) if (x <= RD[i][0]) { const t = (x - RD[i - 1][0]) / ((RD[i][0] - RD[i - 1][0]) || 1); return bedOf[i - 1] + (bedOf[i] - bedOf[i - 1]) * t; } return bedOf[bedOf.length - 1]; };
  const bedRoad = bedAt(C.x);
  // the river at (x, z): signed distance across (south +), m along it from the road, the bed's natural height there
  function riverAt(x, z) {
    const n = nearest(RD, RC, x, z), side = z >= zc(x) ? 1 : -1;
    return { d: n.d * side, s: sOf(x), bed: bedAt(x) };
  }
  // the land shaped by the crossing alone (the shelf, the ravine)
  function crossingAt(x, z, h0) {
    const s = sOf(x), wa = alongW(s); if (wa <= 0) return h0;
    const rv = riverAt(x, z), ad = Math.abs(rv.d); if (ad >= C.core + C.blend) return h0;
    // the bank: 1 - (1 - t)^round from its foot (t 0) to its top (t 1): steep below, rounding over at the top; placed so
    // that it falls at 45 degrees at the brink (halfTop)
    const bed = rv.bed - C.lower * wa, shelf = rv.bed + C.lift, D = Math.max(0.5, shelf - bed), run = wallRun(s), p = C.round;
    const tb = 1 - Math.min(1, run / (p * D)) ** (1 / (p - 1)), top = halfTop(s) + run * (1 - tb), foot = Math.max(1, top - run);
    let hc, w;
    if (ad < top) {   // (the bed, and the bank rising from it, eased up off the bed over its first 15% so the corner is rounded)
      const t = Math.max(0, (ad - foot) / (top - foot));
      hc = bed + D * (1 - (1 - t) ** p) * smooth(0, 0.15, t); w = wa;
    }
    else { hc = shelf + 0.02 * (ad - top); w = wa * coss(C.core, C.core + C.blend, ad); }
    return h0 + (hc - h0) * w;
  }
  // ── THE FORD: a lane cut down to the river and up again (it only ever digs) ──
  const F = FORD, FD = densify(F.pts, 0.5), FC = lengths(FD);
  let fordI = 0; { let best = Infinity; for (let i = 0; i < FD.length; i++) { const dd = Math.abs(FD[i][1] - zc(FD[i][0])); if (dd < best) { best = dd; fordI = i; } } }   // (where the lane crosses the river's middle)
  const fordU = FC[fordI], fordAt0 = FD[fordI], fordBed = bedAt(fordAt0[0]) - C.lower * alongW(sOf(fordAt0[0])) + F.above;
  function fordAt(x, z, h) {
    const n = nearest(FD, FC, x, z), reach = F.half + 8 / F.side + F.lip; if (n.d >= reach) return h;
    const half = F.half + 0.3 * Math.sin(n.u * 0.45 + 1) + 0.15 * Math.sin(n.u * 1.3), floor = fordBed + F.slope * Math.max(0, Math.abs(n.u - fordU) - F.flat), cut = floor + F.side * Math.max(0, n.d - half);
    const k = F.lip, q = Math.max(0, k - Math.abs(h - cut)) / k * smooth(half, half + 0.6, n.d);
    return Math.min(h, cut) - q * q * k / 4;   // (a smooth minimum: the cut's top edge rounded over; the floor left flat)
  }
  // ── THE CAMP's room: flat at the land's own height round its middle ──
  const P = CAMP, campLevel = (() => { let s = 0, n = 0; for (let a = 0; a < 8; a++) for (const r of [0, P.r * 0.5, P.r]) { s += crossingAt(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r, base(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r)); n++; } return s / n; })();
  function campAt(x, z, h) { const r = Math.hypot(x - P.x, z - P.z), k = coss(P.r, P.r + P.blend, r); return k > 0 ? h + (campLevel - h) * k : h; }

  const zs = F.pts.map((p) => p[1]);
  const crossBox = { x0: C.x + C.along[0] - C.alongBlend - 2, x1: C.x + C.along[1] + C.alongBlend + 2, z0: Math.min(C.z - C.core - C.blend - 14, ...zs) - 12, z1: Math.max(C.z + C.core + C.blend + 14, ...zs) + 12 };
  // (drawn finer: the ravine where its banks are steep, out to where it is nearly the land's own again, and the ford's lane)
  const fine = { x0: C.x + C.along[0] - C.alongBlend * 0.8, x1: C.x + C.along[1] + C.alongBlend * 0.8, z0: Math.min(...zs) - 7, z1: Math.max(...zs) + 4 };
  function at(x, z, h0) {
    let h = h0;
    if (x > hillBox.x0 && x < hillBox.x1 && z > hillBox.z0 && z < hillBox.z1) h = hillAt(x, z, h);
    if (x > crossBox.x0 && x < crossBox.x1 && z > crossBox.z0 && z < crossBox.z1) { h = crossingAt(x, z, h); h = campAt(x, z, h); h = fordAt(x, z, h); }
    return h;
  }
  return {
    at, boxes: [hillBox, crossBox], fine,
    // strips kept clear of trees ([ax, az, bx, bz, half]): the ford's lane and the camp's room
    clear: [...F.pts.slice(1).map((q, i) => [F.pts[i][0], F.pts[i][1], q[0], q[1], F.half + 1.5]), [P.x, P.z, P.x, P.z, P.r + P.blend * 0.5]],
    hill: { x: H.x, z: H.z, top: H.top, level: hillLevel },
    crossing: { x: C.x, z: C.z, deck: bedRoad + C.lift, bed: bedRoad - C.lower, gap: C.gap, halfTop, riverAt, ford: { pts: FD, u: fordU, bed: fordBed }, camp: { x: P.x, z: P.z, r: P.r, level: campLevel } },
  };
}
