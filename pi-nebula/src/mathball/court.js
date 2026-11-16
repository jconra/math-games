// MATHBALL'S COURT, in plain numbers (no three.js, no page): the shape the game's maker picked (AR3-1 D, 2026-11-16:
// "Octagon, stretched to the room's 18 m: four goals, two at each end, each 8.1 m from the middle"), where its four
// goals, its six ball ports, its light bar's track and its spots are. The kit's piece (kit/arena.js) draws the court
// from these numbers, the game (src/mathball/) plays on them and the tests (pi-nebula/tests/mathball.test.mjs) read
// them, so they never disagree.
//
// THE FRAME: the court's own, metres: its middle on the floor at (0, 0, 0), x to the east (the spine), z to the south
// (the terminal and the door), y up. In the station it stands at COURT.mid (the arena room's middle, cell [4, 6]):
// station = court + mid.
//
// THE SHAPE: the room is 10 x 18 m (9.6 x 17.6 inside). The court fills it: an octagon 9.6 m across with its corners
// cut by slanted walls 4 m long, stretched along the room. The south wall stands 4 cm in front of the terminal's door
// (its two-faced panel: kit/shell.js), so the court is 17.52 m long, not 17.6.
//   walls 0..7 run from corner i to corner i + 1:  0 north, 1 NE (a goal), 2 east, 3 SE (a goal), 4 south (the door),
//   5 SW (a goal), 6 west, 7 NW (a goal)
export const COURT = {
  mid: [8, 0, 12],
  hx: 4.8, hz: 8.76,
  cut: 4.8 - 4.8 * Math.tan(Math.PI / 8),   // 2.812: how far a slanted wall cuts back along each wall it joins
  height: 7, seam: 3.5,                      // two storeys; the line of light between them
  ball: { r: 0.25 },                         // a beach ball: 50 cm across (AR2-4: "the balls should be bigger")
  // AR2-2 D, "proud of the wall": the mouth 2.4 x 1.4 m, chunky cheeks and a brow standing `out` from the slanted
  // wall, the pocket `deep` behind it (the room's own corner); the sign's board on the brow, leaning out (tilt)
  goal: { w: 2.4, h: 1.4, cheek: 0.36, brow: 0.36, out: 0.42, deep: 0.95, board: { w: 3.12, h: 0.9, y: 2.22, z: 0.2, tilt: 0.2 } },
  bar: { y: 3.2, lap: 120, first: 15, every: 30 },   // the light bar: its height; a lap is a round; each goal 30 s apart
  door: { x: 0, w: 1.24, h: 2.32 },          // the terminal's door in the south wall (its doorway: kit/shell.js's)
  hex: { r: 0.62 },                          // the floor's hexagons (round one's: 1.24 m corner to corner)
};

const { hx, hz, cut } = COURT;
// the corners, in order round the court (x, z)
export const CORNERS = [[-hx + cut, -hz], [hx - cut, -hz], [hx, -hz + cut], [hx, hz - cut], [hx - cut, hz], [-hx + cut, hz], [-hx, hz - cut], [-hx, -hz + cut]];

// the walls: from corner i to i + 1; n: the way it faces (into the court); u: along it (as seen from the court, to the
// right); mid: its middle; len: its length
export const WALLS = CORNERS.map((A, i) => {
  const B = CORNERS[(i + 1) % CORNERS.length], dx = B[0] - A[0], dz = B[1] - A[1], len = Math.hypot(dx, dz);
  const u = [dx / len, dz / len];
  // (the corners run clockwise seen from above with z down the page, so in is the left of A to B: (u.z, -u.x)... checked
  // against the middle, which is always inside)
  let n = [u[1], -u[0]]; const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  if (n[0] * -mid[0] + n[1] * -mid[1] < 0) n = [-n[0], -n[1]];
  return { i, A, B, len, u, n, mid, name: ['north', 'NE', 'east', 'SE', 'south', 'SW', 'west', 'NW'][i] };
});

// THE GOALS, in the order the light bar reaches them (SW, NW, NE, SE). Each keeps its colour for good: only its sign
// changes (round three: "the violet goal" stays a place to aim at). Colours: linear light, bright enough to glow,
// low enough to keep their colour (round three's GCOL)
export const GOALS = [
  { key: 'SW', wall: 5, colour: 'pink', glow: [2.0, 0.2, 1.3] },
  { key: 'NW', wall: 7, colour: 'violet', glow: [0.42, 0.14, 2.1] },
  { key: 'NE', wall: 1, colour: 'gold', glow: [1.9, 1.3, 0.12] },
  { key: 'SE', wall: 3, colour: 'green', glow: [0.15, 1.6, 0.45] },
].map((g, i) => {
  const W = WALLS[g.wall];
  // the mouth: its middle on the floor; where a thrown ball aims (a little inside the mouth, waist high)
  return { ...g, i, mid: W.mid, n: W.n, u: W.u, aim: [W.mid[0] - W.n[0] * 0.3, 0.72, W.mid[1] - W.n[1] * 0.3], dist: Math.hypot(...W.mid) };
});
// (a CSS colour for each goal's colour, for the page: the same hue as its light)
export const GOAL_CSS = { pink: '#ff5cc8', violet: '#9b7bff', gold: '#ffc23a', green: '#3be08a' };

// THE PORTS the balls are shot out of (AR2-7 B): three in each long wall, over head height, facing across the court
export const PORTS = [-4.2, 0, 4.2].flatMap((z) => [{ at: [hx, 2.55, z], n: [-1, 0, 0] }, { at: [-hx, 2.55, z], n: [1, 0, 0] }])
  .map((p, i) => ({ ...p, i, r: 0.4 }));

// SPOTS: where the player comes in (inside the door, by the job's ring), where the other player starts
export const SPOTS = { player: [0, 6.3], other: [0, -6.3], ring: [0, 6.9] };

// ── inside the court ─────────────────────────────────────────────────────────────────────────────────────────────────
// how far a point is inside the court (its distance to the nearest wall; below 0: outside)
export function inside(x, z) {
  let d = Infinity;
  for (const W of WALLS) d = Math.min(d, W.n[0] * (x - W.A[0]) + W.n[1] * (z - W.A[1]));
  return d;
}
// the nearest point at least d inside the court (a point already there is kept)
export function clampIn(x, z, d) {
  for (let k = 0; k < 3; k++) {
    let moved = false;
    for (const W of WALLS) {
      const s = W.n[0] * (x - W.A[0]) + W.n[1] * (z - W.A[1]);
      if (s < d) { x += W.n[0] * (d - s); z += W.n[1] * (d - s); moved = true; }
    }
    if (!moved) break;
  }
  return [x, z];
}

// ── the light bar's track: round the court above the goals, from over the door going west first ────────────────────
// (the south wall's west half, the SW goal's wall, the west wall, the NW goal's, the north wall, the NE goal's, the east
// wall, the SE goal's, the south wall's east half: back over the door)
const TRACK_IN = 0.06;   // (how far in from the walls it runs)
export const TRACK = (() => {
  const S = WALLS[4], half = [(S.A[0] + S.B[0]) / 2, (S.A[1] + S.B[1]) / 2];
  // the corners going west from the door: 5, 6, 7, 0, 1, 2, 3, 4 (the south wall runs from corner 4 east to 5 west)
  const pts = [half, CORNERS[5], CORNERS[6], CORNERS[7], CORNERS[0], CORNERS[1], CORNERS[2], CORNERS[3], CORNERS[4], half]
    .map(([x, z]) => { const L = Math.hypot(x, z); return [x - x / L * TRACK_IN, z - z / L * TRACK_IN]; });
  const at = [0];
  for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, at, len: at[at.length - 1] };
})();
// the track's length at a goal's middle (the point over it)
function sOf(x, z) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < TRACK.pts.length - 1; i++) {
    const [ax, az] = TRACK.pts[i], [bx, bz] = TRACK.pts[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(px - x, pz - z);
    if (d < bd) { bd = d; best = TRACK.at[i] + Math.sqrt(L2) * t; }
  }
  return best;
}
// the stations: each goal's point on the track and the time in the round the bar reaches it (15, 45, 75, 105 s)
export const STATIONS = GOALS.map((g, i) => ({ goal: i, s: sOf(g.mid[0], g.mid[1]), t: COURT.bar.first + i * COURT.bar.every }));
// where the bar is (metres along the track) at time t into the round: from over the door to each goal in turn, every
// goal reached exactly on its time (so it runs faster along the long walls), and back over the door as the round ends
export function barAt(t) {
  const L = COURT.bar.lap, k = [{ t: 0, s: 0 }, ...STATIONS.map((x) => ({ t: x.t, s: x.s })), { t: L, s: TRACK.len }];
  const tt = Math.max(0, Math.min(L, t));
  for (let i = 1; i < k.length; i++) if (tt <= k[i].t) { const f = (tt - k[i - 1].t) / (k[i].t - k[i - 1].t); return k[i - 1].s + (k[i].s - k[i - 1].s) * f; }
  return TRACK.len;
}
// a point on the track (x, z) at s metres along it, and the way it runs there
export function trackPoint(s) {
  const P = TRACK.pts, A = TRACK.at, ss = Math.max(0, Math.min(TRACK.len, s));
  for (let i = 1; i < P.length; i++) if (ss <= A[i] + 1e-9) {
    const f = (ss - A[i - 1]) / (A[i] - A[i - 1] || 1), dx = P[i][0] - P[i - 1][0], dz = P[i][1] - P[i - 1][1], L = Math.hypot(dx, dz) || 1;
    return { x: P[i - 1][0] + dx * f, z: P[i - 1][1] + dz * f, dx: dx / L, dz: dz / L };
  }
  const n = P.length - 1; return { x: P[n][0], z: P[n][1], dx: 1, dz: 0 };
}

// the court's own frame to the station's, and back
export const toStation = (x, y, z) => [x + COURT.mid[0], y + COURT.mid[1], z + COURT.mid[2]];
export const fromStation = (x, y, z) => [x - COURT.mid[0], y - COURT.mid[1], z - COURT.mid[2]];
