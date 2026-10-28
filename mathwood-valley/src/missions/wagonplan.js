// THE WAGON JOB'S PLAN, in plain numbers (no three.js, so the tests can load it): the road the wagon rolls round, where
// the riders ride round it, which gang rides next, and the job's small rules. Used by src/missions/wagonjob.js; tested
// in tests/wagonjob.test.mjs (and the gangs by tests/series.test.mjs and the levels rigs).

import { pickFact, pickTable } from '../math/facts.js';
import { TABLE_ORDER } from '../math/series.js';
import { isOn } from '../levels/model.js';
import { slotFiles, slotTakes } from '../audio/clipslots.js';

// ── WHICH GANG RIDES NEXT ────────────────────────────────────────────────────────────────────────────────────────────
// From the rider's level here (q: src/levels/model.js levelFor 'wagon'): odds and evens, a table's gang, or a
// missing-number card. A gang level's own table, but once placed every third gang (n: gangs dealt this ride, counting
// this one) is an earlier table the rider has met on the way (the weak ones more: src/math/facts.js pickTable),
// recorded at that table's own level; the any-table level picks every gang that way. A table's first two gangs reach
// up to x10 (met: the times trainer's gangs of it so far), then x12.
//   chooseGang(rider, q, { n, lastTable, lastFact, met }) -> { kind: 'parity', want, top, level, count }
//     | { kind: 'rule', table, reach, level, count } | { kind: 'missing', fact: { t, a, upTo }, key, level, count }
export const GANG = { riders: 8, reviewEvery: 3 };   // riders in a gang (about half of them the gang); a review every 3rd
export function chooseGang(rider, q, { n = 1, lastTable = null, lastFact = null, met = () => 0, rand = Math.random } = {}) {
  const g = q.level.gen, count = GANG.riders;
  if (g.kind === 'parity') return { kind: 'parity', want: g.want, top: g.top, level: q.id, count };
  if (g.kind === 'missing') {
    const f = pickFact(rider, { tables: TABLE_ORDER.filter((t) => t <= g.upTo), upTo: g.upTo, from: 2, last: lastFact, rand });
    return { kind: 'missing', fact: { t: f ? f.a : 7, a: f ? f.b : 8, upTo: g.upTo }, key: f ? f.key : null, level: q.id, count };
  }
  let t = g.table, level = q.id;
  if (!t) t = pickTable(rider, g.open, { last: lastTable, rand }) || g.open[0];
  else if (!q.placing && n % GANG.reviewEvery === 0 && g.open.length > 1) {
    // (an earlier table whose gang level a grown-up switched off on the levels page isn't reviewed either)
    const r = pickTable(rider, g.open.filter((x) => x !== t && isOn(rider, 'wagon', `g${x}`)), { last: lastTable, rand });
    if (r) { t = r; level = `g${r}`; }
  }
  return { kind: 'rule', table: t, reach: met(t) < 2 ? 10 : 12, level, count };
}

// The road: a closed loop over the open, nearly level land east of the pasture (checked on the real land with
// ~/pw/bandit-math/rigs/bandits/road_check.cjs: nothing blocks it or 12 m to either side, no water, gentle slopes; it
// keeps more than 80 m from the middle of the round-up's pasture, out of reach of its target ring, and about 15 m from
// the Hollis camp at its nearest). The wagon starts at its west end, the nearest point to the pasture.
export const ROAD_POINTS = (() => {
  // an oval 144 by 92 m: its tightest bends (the ends) are about 24 m across, gentle for a wagon and a team
  const c = { x: 316, z: -251 }, rx = 72, rz = 46, n = 16, pts = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / n) * Math.PI * 2;
    pts.push([c.x + Math.cos(a) * rx, c.z + Math.sin(a) * rz]);
  }
  return pts;
})();

// A smooth closed road through points (a centripetal Catmull-Rom curve: it passes through every point without loops
// or overshoot), measured into steps of `step` metres.
//   road.at(s, out) at s metres along (any s: it wraps) -> { x, z, h (heading: facing (sin h, cos h)), nx, nz (one
//                   metre to the left-hand side) }
//   road.length, road.nearest(x, z) -> s, road.track(x, z, s, win) -> s (the nearest within win metres of s: cheap),
//   road.gap(a, b) -> b - a along the loop the short way round (-length / 2 .. length / 2)
export function makeRoad(points, step = 1) {
  const P = points, m = P.length, dense = [];
  const knot = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) || 1e-4;
  for (let i = 0; i < m; i++) {
    const p0 = P[(i - 1 + m) % m], p1 = P[i], p2 = P[(i + 1) % m], p3 = P[(i + 2) % m];
    const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
    for (let k = 0; k < 40; k++) {
      const t = t1 + (t2 - t1) * (k / 40), pt = [0, 0];
      for (let d = 0; d < 2; d++) {
        const A1 = (t1 - t) / (t1 - t0) * p0[d] + (t - t0) / (t1 - t0) * p1[d];
        const A2 = (t2 - t) / (t2 - t1) * p1[d] + (t - t1) / (t2 - t1) * p2[d];
        const A3 = (t3 - t) / (t3 - t2) * p2[d] + (t - t2) / (t3 - t2) * p3[d];
        const B1 = (t2 - t) / (t2 - t0) * A1 + (t - t0) / (t2 - t0) * A2;
        const B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3;
        pt[d] = (t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2;
      }
      dense.push(pt);
    }
  }
  // the length along it, then points every `step` metres
  const cum = [0];
  for (let i = 1; i <= dense.length; i++) { const a = dense[i - 1], b = dense[i % dense.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const length = cum[cum.length - 1], n = Math.max(8, Math.round(length / step)), seg = length / n;
  const X = new Float64Array(n), Z = new Float64Array(n), H = new Float64Array(n);
  for (let i = 0, j = 0; i < n; i++) {
    const want = i * seg; while (cum[j + 1] < want) j++;
    const a = dense[j], b = dense[(j + 1) % dense.length], f = (want - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
    X[i] = a[0] + (b[0] - a[0]) * f; Z[i] = a[1] + (b[1] - a[1]) * f;
  }
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, k = (i + n - 1) % n; H[i] = Math.atan2(X[j] - X[k], Z[j] - Z[k]); }
  const road = { length, points, n };
  road.at = (s, out = {}) => {
    let u = (((s % length) + length) % length) / seg; const i = Math.floor(u) % n, j = (i + 1) % n; u -= Math.floor(u);
    out.x = X[i] + (X[j] - X[i]) * u; out.z = Z[i] + (Z[j] - Z[i]) * u;
    const dh = Math.atan2(Math.sin(H[j] - H[i]), Math.cos(H[j] - H[i]));
    out.h = H[i] + dh * u; out.nx = Math.cos(out.h); out.nz = -Math.sin(out.h);
    return out;
  };
  road.nearest = (x, z) => { let best = 0, bd = Infinity; for (let i = 0; i < n; i++) { const d = (X[i] - x) ** 2 + (Z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } } return best * seg; };
  road.track = (x, z, s, win = 30) => {
    const i0 = Math.round(s / seg), w = Math.ceil(win / seg); let best = s, bd = Infinity;
    for (let k = -w; k <= w; k++) { const i = ((i0 + k) % n + n) % n, d = (X[i] - x) ** 2 + (Z[i] - z) ** 2; if (d < bd) { bd = d; best = (i0 + k) * seg; } }
    return best;
  };
  road.gap = (a, b) => { const d = (((b - a) % length) + length) % length; return d > length / 2 ? d - length : d; };
  return road;
}

// where each rider rides round the wagon: [side (1 left, -1 right), metres out from the road's middle, metres ahead of
// the wagon (behind: negative)]. The first few are dealt first: close in front and beside, the rest behind.
export const SLOTS = [[1, 6, 5], [-1, 6.5, 3], [1, 9, -3], [-1, 9.5, -5], [1, 6, -10], [-1, 7, -11], [1, 11, 9], [-1, 11, 8],
  [1, 12, -15], [-1, 12, -16], [1, 8, 14], [-1, 8, -21]];

// "not in the 6-herd" from the times trainer reads "not in the 6-Gang" out here
export const gangLine = (line) => String(line || '').replace(/(\d+)-herd/g, '$1-Gang');

// the sacks a roped bandit drops for his number: 24 in the 6-Gang drops 4 sacks of 6 (on a missing-number card the
// number IS how many sacks of the table); an odds-and-evens bandit drops his number in pairs (8: 4 sacks of 2; 7: 3,
// the odd one kept), none past 24 (too many to lay out)
export function sacksFor(n, table, kind = 'rule') {
  if (!table) return { sacks: 0, per: 0 };
  if (kind === 'missing') return { sacks: n, per: table };
  if (kind === 'parity') return { sacks: n <= 24 ? Math.floor(n / 2) : 0, per: 2 };
  return n % table === 0 ? { sacks: n / table, per: table } : { sacks: 0, per: table };
}

// The wagon's speed notch (an index into the job's speeds) after a wave. The math and the speed are two separate dials
// and are never raised together: a wave that moved the kid up a step leaves the speed alone, a new table opening slows
// the wagon right back to a walk, a clean wave otherwise picks up the pace a notch, and a rough one (two misses or more)
// eases it a notch.
export function nextSpeed(level, { misses = 0, stepUp = false, newTable = false, top = 3 } = {}) {
  if (newTable) return 0;
  if (misses >= 2) return Math.max(0, level - 1);
  if (misses === 0 && !stepUp) return Math.min(top, level + 1);
  return level;
}

// ── THE TRIP: the job's wagon goes from one end of its road to the other ────────────────────────────────────────────
// The job's wagon drives from one end of the loop to the other (A to B), the gangs riding in along the way. Once it is
// safely past the far end's mark, with no gang about, it pulls up there, the driver thanks the player and pays a
// little, and the job rests (a word with the driver, or riding off and back, starts the next trip, on round to the
// other end). A gang still riding with it at the mark: it rolls on until they're seen off, then pulls up.
export const TRIP = {
  marks: [0, 0.5],    // the ends (shares of the way round from where the road starts): the west end, nearest the
                      // pasture, where the wagon first waits, and the east end
  least: 90,          // m: a trip is at least this long (a mark nearer than this ahead is passed for the next one)
  quiet: 45,          // m: no new gang rides in this close to the trip's end
  pay: 8,             // gold the driver pays at the end of a trip, on top of each gang's pay
  ease: 0.6,          // m/s each second the wagon slows at, pulling up at the mark
};
// metres from s (along the loop, going forward) to the trip's end: the next mark at least `least` ahead
export function tripLeft(s, length, { marks = TRIP.marks, least = TRIP.least } = {}) {
  let best = Infinity;
  for (const m of marks) {
    let d = (((m * length - s) % length) + length) % length;
    while (d < least) d += length;
    best = Math.min(best, d);
  }
  return best;
}

// ── AN OPEN ROAD: a stretch of the road through the valley, the way a wagon goes along it ──────────────────────────
// The same shape as makeRoad's, for a road that doesn't loop: points [[x, z], ...] evenly spaced along it (about a
// metre apart), in the order the wagon goes. at(s) works for any s (past either end, straight on from the end); gap(a,
// b) is just b - a; track and nearest as makeRoad's.
export function makeOpenRoad(points) {
  const n = points.length, X = new Float64Array(n), Z = new Float64Array(n), H = new Float64Array(n);
  for (let i = 0; i < n; i++) { X[i] = points[i][0]; Z[i] = points[i][1]; }
  let length = 0; for (let i = 1; i < n; i++) length += Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]);
  const seg = length / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) { const j = Math.min(n - 1, i + 1), k = Math.max(0, i - 1); H[i] = Math.atan2(X[j] - X[k], Z[j] - Z[k]); }
  const road = { length, points, n, open: true };
  road.at = (s, out = {}) => {
    let x, z, h;
    if (s <= 0) { h = H[0]; x = X[0] + Math.sin(h) * s; z = Z[0] + Math.cos(h) * s; }
    else if (s >= length) { h = H[n - 1]; x = X[n - 1] + Math.sin(h) * (s - length); z = Z[n - 1] + Math.cos(h) * (s - length); }
    else {
      const u = s / seg, i = Math.min(n - 2, Math.floor(u)), f = u - i, dh = Math.atan2(Math.sin(H[i + 1] - H[i]), Math.cos(H[i + 1] - H[i]));
      x = X[i] + (X[i + 1] - X[i]) * f; z = Z[i] + (Z[i + 1] - Z[i]) * f; h = H[i] + dh * f;
    }
    out.x = x; out.z = z; out.h = h; out.nx = Math.cos(h); out.nz = -Math.sin(h);
    return out;
  };
  road.nearest = (x, z) => { let best = 0, bd = Infinity; for (let i = 0; i < n; i++) { const d = (X[i] - x) ** 2 + (Z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } } return best * seg; };
  road.track = (x, z, s, win = 30) => {
    const i0 = Math.round(s / seg), w = Math.ceil(win / seg); let best = s, bd = Infinity;
    for (let k = -w; k <= w; k++) { const i = Math.max(0, Math.min(n - 1, i0 + k)), d = (X[i] - x) ** 2 + (Z[i] - z) ** 2; if (d < bd) { bd = d; best = i * seg; } }
    return best;
  };
  road.gap = (a, b) => b - a;
  return road;
}

// ── HOLD-UPS: a gang jumps a wagon travelling the long roads ───────────────────────────────────────────────────────
// Out on the road through the valley, well away from the town, now and then a gang rides up on a travelling wagon: it
// pulls up, the driver shouts "Help!", and the player rides over and ropes the bandits (the wagon job's gang: the same
// numbers, at the rider's own level). With 3 to 5 roped the rest ride off; the driver thanks the player, pays a little
// and drives on the way it was going. "Protect the wagon" turned off for the rider: no hold-ups.
export const AMBUSH = {
  out: 170,           // m along the road from the town square: a wagon further out than this is on the long roads
  player: 130,        // m: the player too must be out this far along the road ...
  roadNear: 45,       // ... and no further than this from its middle
  from: 45, to: 175,  // m from the player to the wagon: near enough to see, not right on top of them
  first: 45,          // s out on the long roads before the first hold-up of a ride
  every: [110, 220],  // s out on the long roads between one hold-up and the next
  riders: [6, 9],     // riders in the bunch for a gang wearing a table's multiples (about half are the gang: 3 to 5)
  most: 5,            // bandits roped that see the gang off (any more ride off with the rest)
  bonus: 10,          // gold the driver pays the player on top of the gang's usual pay
  wait: 150,          // s the gang holds a wagon up for a player who doesn't come; then the driver makes a run for it
  far: 240,           // m: the player further than this from the hold-up: the driver makes a run for it
  helpEvery: 3.5,     // s between the driver's shouts of "Help!" ...
  helpNear: 20,       // ... till the player is this close (m)
  // the driver's recorded shouts (src/audio/clipslots.js, slot helpBandits: Dad's four takes, sounds/voice/help_1..4 .ogg
  // and .m4a): one at a time at random (never the same twice running), positioned at the wagon, his bubble saying that
  // take's words; then helpRest s of quiet before the next. With no sound the bubble shows "Help!" alone
  helpClips: slotFiles('helpBandits'),
  helpTakes: slotTakes('helpBandits'),
  helpRest: 2.5,
  spawn: [70, 190],   // m along the road from the wagon the gang rides in from (the nearest out of the player's sight)
  hold: 26,           // m: wagons and travellers coming up behind (or toward) a held-up wagon wait this far short of it
  open: 0.65,         // the share of the ground round the wagon that must be clear for the riders (no thick trees)
  jobs: 70,           // m: none held up this near the round-up's pasture or the corral (two jobs' questions at once there)
  mist: 0.1,          // the most mist at the wagon (W.fogAt, the banks at the valley's ends): none held up in it, unseen
  // the driver's words (a bubble over his head): his shout, and his thanks once the gang is seen off
  words: { help: 'Help!', thanks: ['Much obliged, partner!', 'Thank you kindly!', "You're a real life saver!", 'Bless you, partner!'] },
};
// how many riders ride up for a gang
export const gangSize = (rand = Math.random) => AMBUSH.riders[0] + Math.floor(rand() * (AMBUSH.riders[1] - AMBUSH.riders[0] + 1));
// the player is out on the long roads: pu metres along the road (the nearest point), off metres from its middle,
// square: where the town square is along it
export const outOnRoad = ({ pu, off, square }) => Math.abs(pu - square) >= AMBUSH.player && off <= AMBUSH.roadNear;
// which travelling wagon a gang jumps, or null. Each candidate: { u (m along the road), dist (m from the player), made
// (drawn), onRoad (on its way, not pulling off or standing at a spot), held, ended, plan (it means to pull off in
// town), seen (in the player's view), open (the share of the ground round it that is clear), mist (W.fogAt there), atJob (within AMBUSH.jobs of the pasture or the corral) }. Out on the long roads,
// near enough to see and not on top of the player, with room round it for the riders; one in view first, then the
// one nearest a middling distance.
export function ambushPick(list, { square }) {
  const ok = list.filter((t) => t.made && t.onRoad && !t.held && !t.ended && !t.plan && Math.abs(t.u - square) >= AMBUSH.out
    && t.dist >= AMBUSH.from && t.dist <= AMBUSH.to && (t.open ?? 1) >= AMBUSH.open && (t.mist ?? 0) <= AMBUSH.mist && !t.atJob);
  if (!ok.length) return null;
  ok.sort((a, b) => (b.seen ? 1 : 0) - (a.seen ? 1 : 0) || Math.abs(a.dist - 100) - Math.abs(b.dist - 100));
  return ok[0];
}
