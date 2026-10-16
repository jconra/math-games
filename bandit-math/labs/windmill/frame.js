// THE WIND TEST IN THREE DIMENSIONS: the whole tower as one frame, built anywhere over the stones. Plain numbers, no
// three.js: node runs it for the tests and rigs, and the page runs it in a worker (wind-worker.js).
//
// How it works, in plain words:
//   * Every board is a beam that can stretch, twist, and bend both ways: easily the thin way (across its 1½ in), about
//     five times harder on its wide side (across its 3½ in). Between every two joints along a board is one piece (a
//     "frame element": each end can move three ways and turn three ways, six numbers per end, and the textbook
//     stiffness of a beam ties the twelve together).
//   * Wherever boards touch (centre lines closer than TOL) they are nailed. A nailed spot is a JOINT: a small hub that
//     every board there is tied to by springs in all six directions. How stiff and how strong depends on the kind:
//       - lapped or crossing boards (three nails through the faces): they slide a hair, turn about the nail fairly
//         easily (that is what lets a square with no brace rack), and hardly turn the other ways (the faces bear);
//       - two boards end to end along one line (a butt): a couple of slanted nails, weak;
//       - a board's END on another board's side (a beam on a crosspiece, a post standing on a beam): toe-nailed, so it
//         bears when pushed together and pulls out easily;
//       - a post on its footing stone: strapped down, strong;
//       - a board's end on the bare dirt off the stones: it rests there, and hardly holds against lifting or sliding.
//   * Loads: the boards' weight, and the wind. Only the part of the wind blowing ACROSS a board pushes it, with that
//     part's speed squared, so a board leaning toward the wind at 45 degrees gets half the push of an upright one, and
//     a board edge on to the wind (in a wall the wind runs along) only catches its thin edge. Boards behind other boards
//     are sheltered: behind a wall of boards (the more solid the wall, the more shelter), and in the wake of a single
//     board (most shelter close behind it, the wind filling in further back).
//   * We solve "stiffness times movement = load" for every board end, joint and hub at once (a thousand numbers or so,
//     so the solver keeps only the numbers near the diagonal, after numbering the parts so that neighbours get nearby
//     numbers), with the weight leaning on the movement (a tower that sways is pushed further by its own weight).
//   * Then every part is checked against what it holds: each board (bending both ways, twisting, squeezed: a long board
//     in compression buckles the thin way long before it crushes; stretched), each board's nails at each joint (sliding,
//     pulling out, twisting about the nail, and bent the stiff ways, where one edge's nails draw out), every board's
//     lean between the floors it spans (a storey leaning more than 1/30 of its height is folding over: it RACKS), a board
//     with its top free (bending over), and the whole tower tipping over on its downwind stones. The lean checks count
//     for every board by how upright it stands (a post fully, a board leaning 10 degrees nearly fully, a brace at 45
//     degrees half), so there is no cut-off angle where they suddenly stop.
//   * When something gives, it goes: a snapped board falls, nails pulled out free that board from that joint (nails
//     that only twisted loose leave a hinge: the board still hangs there and bears, but turns freely about the nail), a
//     racked storey's posts come out, a bent top falls, and everything that was held up only through them falls with
//     them. The rest is solved again in the same wind, and the test carries on to the end: what is left standing after
//     the big gust is the tower's height.
//
// Units: feet, pounds, radians. The tower: { W, D, boards: [{ id, a: { X, Y, Z }, b: { X, Y, Z }, len, n }] } (tower.js),
// the front facing +Z, the ground at Y = 0, the stones at (±W/2, ±D/2).
//
// Exports: windTest (the CONTRACT in DESIGN.md), and the numbers the page may want to show or draw by (STAGES, WINDS,
// WOOD, NAILS, DRIFT_LIMIT, TOL, DRAG, pressure, stoneLb, leeShade, wakeShade), windOn (the wind's push on each board,
// for drawing or explaining it), boardRole (a board's name in words). `internals` is for the rigs and tests only.

// ── the wood and the nails ──────────────────────────────────────────────────────────────────────────────────────────
// A 2x4 is 1½ by 3½ inches. It bends on its wide side (in its own plane: the stiff way) or the thin way (out of it).
export const WOOD = {
  E: 1.6e6 * 144,                       // stiffness of pine, pounds per square foot
  G: 1.6e6 * 144 / 16,                  // its stiffness against twisting (shear), about a sixteenth of that
  A: (1.5 * 3.5) / 144,                 // cross-section, square feet
  I: (1.5 * 3.5 ** 3 / 12) / 20736,     // bending on its wide side (in its own plane), feet^4
  Iweak: (3.5 * 1.5 ** 3 / 12) / 20736, // bending the thin way (out of its plane: how a squeezed board buckles)
  J: 2.877 / 20736,                     // twisting: a 1½ by 3½ in rectangle's torsion constant (2.88 in^4), feet^4
  weight: 1.3,                          // pounds per foot
  bendHolds: 1500,                      // pound-feet of bending on its wide side before it snaps
  bendHoldsWeak: 1500 * 1.5 / 3.5,      // ...the thin way (643: the section is that much thinner that way)
  twistHolds: 170,                      // pound-feet of twisting before it splits along the grain
  pullHolds: 12000,                     // pounds of straight pull
  width: 3.5 / 12, thick: 1.5 / 12,     // feet
};
// The joints. Springs: kt (pounds per foot of sliding, any way), kr (pound-feet per radian of turning about the nail: the
// soft way), kb (turning the other ways, where the faces bear on each other). Strength: holds (pounds of sliding force),
// pull (pounds pulling the boards apart: nails drawn out of the wood), twist (pound-feet of turning about the nail),
// bend (lapped boards only: pound-feet of turning the stiff ways, where the faces bear on one edge and the nails at the
// other edge draw out). Pushing two boards together takes nothing from the nails (the wood bears), so only pulling apart
// counts.
export const NAILS = {
  // three 16-penny nails through two boards lying face to face (v2's numbers). Pulling apart: three nails drawn 2 in out
  // of pine hold about 600 lb. Turning the stiff ways, the faces bear on one edge while the nails on the other draw out:
  // ten times the soft way, and it holds what those nails hold against drawing out on a lever of half a board's width
  // (600 lb times 1¾ in: about 90 pound-feet; a board nailed flat to one other at a single spot and pushed on its face,
  // like a lone board lapped over the top crosspiece, works its nails out this way).
  face:  { kt: 2.2e5, kr: 2300, kb: 2.3e4, holds: 750, pull: 600, twist: 110, bend: 600 * 1.75 / 12 },
  // two boards touching end to end along one line (a couple of slanted nails; v2's numbers). Pushed together they bear.
  butt:  { kt: 6e4, kr: 250, kb: 250, holds: 180, pull: 180, twist: 12 },
  // a board's end on another's side, nailed at a slant (toe-nailed): nearly a hinge. It bears when pushed onto the other
  // board (and a beam resting on top of a crosspiece bears its weight). Three toe-nails hold about two thirds of what
  // three face nails do against pulling out (400 lb) and five sixths sideways (600 lb: the carpenters' toe-nail factors),
  // and turning, that pull acting across about half the post's depth (40 lb-ft).
  toe:   { kt: 1e5, kr: 300, kb: 300, holds: 600, pull: 400, twist: 40 },
  // (several boards standing on one spot, like a post's foot on a beam with a brace's foot beside it: every one of them
  // is toe-nailed to the beam. The post's three toe-nails are the numbers above; each brace's foot adds its own two:
  // TOE_SHARE of them, two thirds, per extra board. Only the strength grows; the springs stay one joint's.)
  // a post on its footing stone, strapped down (v2's numbers); the stone bears it down for nothing. A board leaning out
  // of upright on its stone is strapped too, but a strap holds a leaning foot less well, the more so the further it
  // leans (strapOf, below): a post leaning in 10 degrees nearly fully, 30 degrees about half, a brace at 45 not at all.
  stone: { kt: 1e6, kr: 3000, kb: 3e4, holds: 2200, pull: 2200, twist: 160 },
  // a board's end on the bare dirt off the stones: it bears down, and holds by friction alone (half what presses it down,
  // plus a few pounds of dirt round it)
  dirt:  { kt: 5e4, kr: 100, kb: 100, holds: 5, pull: 5, twist: 5, friction: 0.5 },
};
export const TOE_SHARE = 2 / 3;         // what each extra board standing on a toe joint adds to its strength (above)
export const DRIFT_LIMIT = 1 / 30;      // a post leaning more than 1/30 of its height between joints is folding over
export const TOL = 0.2;                 // feet: boards whose centre lines come closer than this touch (touch.js agrees)
const MERGE = TOL * 1.5;                // touching spots closer than this are one joint (hub)
const STRAP = TOL * 1.5;                // a board's foot this close to a stone's corner is strapped to the stone
const UP = Math.cos(8 * Math.PI / 180); // a board within 8 degrees of straight up is called a post in words (as v2);
                                        // the checks never use this cut-off: they go by uprightOf, below
// How upright a board stands, 0 (level) .. 1 (straight up): the square of the upward part of its direction. The lean
// checks (racking, bending over) count a board by it, so a post leaning 10 degrees counts 0.97, 20 degrees 0.88, a
// brace at 45 degrees 0.5: no angle where a check suddenly switches off.
const uprightOf = (b) => b.d[1] * b.d[1];
// How well a strap holds a board's foot on its stone, 0..1: fully for a post, less the further it leans, nothing for a
// board lying at 45 degrees or flatter (from 1 at upright to 0 at 45 degrees, evenly by the upward part of its
// direction: 10 degrees 0.95, 20 degrees 0.79, 30 degrees 0.54)
const strapOf = (b) => clamp((Math.abs(b.d[1]) - Math.SQRT1_2) / (1 - Math.SQRT1_2), 0, 1);
// a nail group that only twisted loose becomes a hinge: it turns this much more easily about the nail
const HINGE = 0.01;

// the wind test: a breeze, then growing gusts. Speeds in miles per hour.
export const STAGES = [
  { name: 'Breeze', mph: 20 },
  { name: 'Stiff wind', mph: 35 },
  { name: 'Gust', mph: 50 },
  { name: 'Big gust', mph: 65 },
];
// the four winds, in the order they are tried; dir: the way the wind blows (toward)
export const WINDS = [
  { from: 'west', dir: { X: 1, Z: 0 } },
  { from: 'east', dir: { X: -1, Z: 0 } },
  { from: 'north', dir: { X: 0, Z: 1 } },
  { from: 'south', dir: { X: 0, Z: -1 } },
];
export const DRAG = 2.0;                // how hard wind pushes on a flat board (a drag coefficient)
// (Measured against v2 on the reference towers at 50 mph: the shelter alone gives v2's total push within 7%, but the
// honest total is about a sixth lower, 12 to 20%: half the corner posts show the wind their 1½ in edge, not their 3½ in
// face, and a board slanting edge on catches less again. DRAG was not raised to make up for it: the push is what the
// boards really catch.)
// wind pressure (pounds per square foot) at a height: speed squared, a little stronger higher up
export function pressure(mph, y) { return 0.00256 * mph * mph * Math.pow(Math.max(y, 5) / 15, 2 / 7); }
// The wind shadow behind a wall of boards facing the wind (v2's): 0.8 of the wind behind a wall that is all gaps, less
// the more of it is wood (about 0.6 behind a 6 ft wall with posts and a brace, down to 0.15 behind a narrow solid one).
// solidity: the part of that wall that is wood, at that height.
export const leeShade = (solidity) => Math.max(0.15, Math.min(0.8, 0.8 - 1.4 * solidity));
// Straight downwind of a single board (a post, or a board seen end on), most of the wind misses: close behind, 0.1 of
// it gets through, and it fills in again further back (half a foot back: 0.2; 1½ ft: 0.4; 6 ft: 0.85). d: feet behind.
export const wakeShade = (d) => 1 - 0.9 * Math.exp(-Math.max(0, d) / (12 * WOOD.width));
// One footing stone's weight by how far apart the stones are set (v2's: flat fieldstones about as thick, so a wide base
// sits on big ones): 250 lb at half a foot, 500 at 3 ft, 800 at 6, 1000 at 8. The page draws them by it (scene.js).
export const stoneLb = (w) => 200 + 100 * w;

// ── small vector helpers (3D points and directions as [x, y, z]) ────────────────────────────────────────────────────
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const norm = (u) => Math.hypot(u[0], u[1], u[2]);
const unit = (u) => { const l = norm(u) || 1; return [u[0] / l, u[1] / l, u[2] / l]; };
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ptAt = (b, t) => [b.A[0] + b.d[0] * t, b.A[1] + b.d[1] * t, b.A[2] + b.d[2] * t];
const r3 = (v) => { const r = Math.round(v * 1e3) / 1e3; return r === 0 ? 0 : r; };
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ── the boards, ready for the sums ──────────────────────────────────────────────────────────────────────────────────
// Which way a board's wide face looks. PLANES ARE X OR Z this round ('X': flat in a plane of constant X, 'Z': constant
// Z); a later round's leaning planes may hand a direction { X, Y, Z } instead, and that works here too. This is the one
// place that reads n.
function faceNormal(b, d) {
  let n = b.n === 'X' ? [1, 0, 0] : b.n === 'Z' ? [0, 0, 1] : b.n && typeof b.n === 'object' ? [b.n.X || 0, b.n.Y || 0, b.n.Z || 0] : [0, 0, 1];
  // (square it up against the board's own line, in case it is a hair off)
  const k = dot(n, d); n = [n[0] - k * d[0], n[1] - k * d[1], n[2] - k * d[2]];
  if (norm(n) < 1e-6) n = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  return unit(n);
}
// the plane key of a board's own plane ('Z:1.5', 'X:-1'; null for a leaning plane), as tower.js names them
function planeKeyOf(b) {
  if (b.n === 'X') return 'X:' + r3(b.a.X);
  if (b.n === 'Z') return 'Z:' + r3(b.a.Z);
  return null;
}
function prepBoards(t) {
  const out = [];
  for (const src of t.boards) {
    const A = [src.a.X, src.a.Y, src.a.Z], B = [src.b.X, src.b.Y, src.b.Z], L = dist(A, B);
    if (!(L > 0.05)) continue;                         // (a board with no length is no board)
    const d = sub(B, A).map((v) => v / L), n = faceNormal(src, d), w = cross(n, d);
    const post = Math.abs(A[0] - B[0]) < 1e-6 && Math.abs(A[2] - B[2]) < 1e-6;
    const b = { id: src.id, src, A, B, L, len: src.len || L, d, n, w, post, upright: post || Math.abs(d[1]) > UP, level: Math.abs(d[1]) < 0.14, key: planeKeyOf(src) };
    // which way is "outward" for this board's nails: away from the tower's middle (it is nailed on the outside of what
    // is under it, as the page draws it); a plane through the middle: toward + (tower.js planeNormal)
    const mid = [(A[0] + B[0]) / 2, 0, (A[2] + B[2]) / 2], s = dot(n, mid);
    b.nOut = s < -1e-9 ? [-n[0], -n[1], -n[2]] : n;
    b.lo = Math.min(A[1], B[1]); b.hi = Math.max(A[1], B[1]);
    out.push(b);
  }
  out.forEach((b, i) => { b.i = i; });
  return out;
}
// do two boards lie in one plane (so they are nailed face to face, lapped)? A post lies in every upright plane through
// its line.
function inPlaneOf(b, P) { return Math.abs(dot(b.n, sub(P, b.A))) < TOL; }
function sharePlane(p, q) {
  if (p.post && q.post) return true;
  if (p.post) return inPlaneOf(q, p.A) && inPlaneOf(q, p.B);
  if (q.post) return inPlaneOf(p, q.A) && inPlaneOf(p, q.B);
  return Math.abs(dot(p.n, q.n)) > 0.99 && inPlaneOf(p, q.A) && inPlaneOf(p, q.B);
}

// ── where boards touch (the same rule as touch.js touch3, so the page's green circles and the physics agree) ─────────
// [{ P (the spot), ti, tj (feet along each from its a end), butt (end to end along one line) }]
function touch3(p, q) {
  const lp = p.len, lq = q.len, dp = p.d, dq = q.d, b = dot(dp, dq), c = cross(dp, dq);
  if (norm(c) < 0.05) {
    // (nearly) parallel: only along the same line
    const w = sub(q.A, p.A), s = dot(w, dp);
    if (Math.hypot(w[0] - dp[0] * s, w[1] - dp[1] * s, w[2] - dp[2] * s) > TOL) return [];
    const t0 = s, t1 = dot(sub(q.B, p.A), dp), lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(lp, Math.max(t0, t1));
    const same = b > 0 ? 1 : -1;
    const at = (t) => ({ P: ptAt(p, t), ti: t, tj: clamp((t - t0) * same, 0, lq) });
    if (hi - lo > TOL) return [{ ...at(lo), butt: false }, { ...at(hi), butt: false }];
    if (hi - lo > -TOL) return [{ ...at(clamp((lo + hi) / 2, 0, lp)), butt: true }];
    return [];
  }
  // the nearest points of the two lines, then the nearest points actually on the boards
  const w0 = sub(p.A, q.A), d = dot(dp, w0), e = dot(dq, w0), den = 1 - b * b;
  const tp = clamp((b * e - d) / den, 0, lp), tq = clamp((e - b * d) / den, 0, lq);
  const P = ptAt(p, tp), Q = ptAt(q, tq);
  const tp2 = clamp(dot(sub(Q, p.A), dp), 0, lp), tq2 = clamp(dot(sub(P, q.A), dq), 0, lq);
  const P2 = ptAt(p, tp2), Q2 = ptAt(q, tq2);
  const opts = [[dist(P, Q), P, Q, tp, tq], [dist(P2, Q), P2, Q, tp2, tq], [dist(P, Q2), P, Q2, tp, tq2]].sort((u, v) => u[0] - v[0]);
  const [gap, A, B, ti, tj] = opts[0];
  if (gap > TOL) return [];
  return [{ P: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2], ti, tj, butt: false }];
}
const boxApart = (p, q) => {
  for (let k = 0; k < 3; k++) {
    if (Math.min(p.A[k], p.B[k]) - TOL > Math.max(q.A[k], q.B[k])) return true;
    if (Math.min(q.A[k], q.B[k]) - TOL > Math.max(p.A[k], p.B[k])) return true;
  }
  return false;
};

// The joints: touching spots merged into hubs (spots within 1.5 TOL are one hub, as touch.js joints3 and v2), and the
// ends at the ground. cuts: [{ id, P }] nails already pulled out (that board is no longer at a hub there).
// Returns hubs [{ P, ground, stone, items: [{ b (board index), t, ground (its end rests on the ground here) }],
//   contacts: [{ i, j, ti, tj, butt }] }]
function findHubs(boards, W, D, cuts) {
  const hubs = [];
  const hubAt = (P) => {
    let h = null;
    for (const q of hubs) if (dist(q.P, P) < MERGE) { h = q; break; }
    if (!h) { h = { P: [...P], ground: false, items: [], contacts: [] }; hubs.push(h); }
    return h;
  };
  const add = (h, i, t, ground = false) => {
    const o = h.items.find((it) => it.b === i);
    if (o) { o.t = (o.t + t) / 2; if (ground) o.ground = true; } else h.items.push({ b: i, t, ground });
  };
  for (let i = 0; i < boards.length; i++) for (let j = i + 1; j < boards.length; j++) {
    if (boxApart(boards[i], boards[j])) continue;
    for (const c of touch3(boards[i], boards[j])) {
      const h = hubAt(c.P);
      add(h, i, c.ti); add(h, j, c.tj); h.contacts.push({ i, j, ti: c.ti, tj: c.tj, butt: c.butt });
    }
  }
  boards.forEach((b, i) => {
    for (const [P, t] of [[b.A, 0], [b.B, b.L]]) {
      if (P[1] > TOL) continue;
      const h = hubAt([P[0], 0, P[2]]); h.ground = true; h.P[1] = 0; add(h, i, t, true);
    }
  });
  // nails pulled out earlier: that board is no longer held at that hub
  if (cuts && cuts.length) {
    for (const h of hubs) {
      const gone = new Set();
      for (const c of cuts) if (dist(c.P, h.P) < MERGE) { const bi = boards.findIndex((b) => b.id === c.id); if (bi >= 0) gone.add(bi); }
      if (!gone.size) continue;
      h.items = h.items.filter((it) => !gone.has(it.b));
      h.contacts = h.contacts.filter((c) => !gone.has(c.i) && !gone.has(c.j));
    }
  }
  const out = hubs.filter((h) => (h.ground ? h.items.length > 0 : h.items.length > 1));
  for (const h of out) {
    if (!h.ground) continue;
    // on a stone (strapped down) or on the bare dirt
    h.stone = [[-W / 2, D / 2], [W / 2, D / 2], [W / 2, -D / 2], [-W / 2, -D / 2]].some(([X, Z]) => Math.hypot(h.P[0] - X, h.P[2] - Z) < STRAP);
  }
  return out;
}

// which boards still reach the ground through their joints: a Set of board indices
function groundedSet(boards, hubs) {
  const parent = boards.map((_, i) => i), G = boards.length; parent.push(G);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  for (const h of hubs) {
    for (let k = 1; k < h.items.length; k++) join(h.items[0].b, h.items[k].b);
    if (h.ground) for (const it of h.items) if (it.ground) join(it.b, G);
  }
  const out = new Set(), g = find(G);
  boards.forEach((_, i) => { if (find(i) === g) out.add(i); });
  return out;
}

// ── the joint kinds and their springs ───────────────────────────────────────────────────────────────────────────────
// For each board at a hub: what kind of joint holds it there, which ways it turns easily, and which pushes on it cost the
// nails nothing (the wood bears). Fills in each item: kind, soft (unit axes it turns about easily), eIn (for an end: the
// way along the board from the joint into it), endToEnd (its end meets another board's end on its line), lapped (it lies
// face to face with a board in its own plane).
// A board's END on another board's side (a post's foot standing on a beam, a beam's end on a crosspiece) is toe-nailed:
// the boards whose ends stand there (with whatever is nailed face to face with them there, like a brace's foot beside a
// post's) are one cluster, and that cluster is toe-nailed to the board it stands on (the CARRIER). So the carrier's tie
// to the hub is the toe-nailed one (kind 'toe', with toeEnd: the board standing on it, and toeAxis: the way along that
// board from the joint into it), and the boards of the cluster keep their own joints with each other.
// Which ends stand on a board (toe-nailed): a board's lower end, rising from there, on another board's side: a post's
// foot on anything but a post; any rising board's foot on a level board (a crosspiece, a beam), in its own plane or
// across it, whatever its tilt (a lone board stood on the top crosspiece is toe-nailed whether it stands straight up or
// leans a little: the end only overlaps the crosspiece by half its width); and any board's end on a board in another
// plane (a beam's end on a crosspiece). A brace's end on a post's side in its own plane is lapped (face nails).
function contactKind(boards, c) {
  if (c.butt) return { type: 'butt' };
  const p = boards[c.i], q = boards[c.j], shared = sharePlane(p, q);
  const endOf = (b, t) => t < TOL || t > b.L - TOL;
  const foot = (b, t) => !b.level && Math.abs(ptAt(b, t)[1] - b.lo) < TOL;
  const stands = (b, t, o) => endOf(b, t) && !o.post && ((foot(b, t) && (b.post || o.level)) || (!b.post && !shared));
  if (stands(p, c.ti, q) && !endOf(q, c.tj)) return { type: 'toe', end: c.i, tEnd: c.ti, carrier: c.j };
  if (stands(q, c.tj, p) && !endOf(p, c.ti)) return { type: 'toe', end: c.j, tEnd: c.tj, carrier: c.i };
  return { type: 'face', shared };
}
function classify(boards, hubs) {
  for (const h of hubs) {
    const here = new Set(h.items.map((it) => it.b));
    const cs = h.contacts.filter((c) => here.has(c.i) && here.has(c.j)).map((c) => ({ ...c, ...contactKind(boards, c) }));
    const ends = new Set(cs.filter((c) => c.type === 'toe').map((c) => c.end));
    // on a stone: the board standing most nearly upright there is strapped down (as well as its lean lets a strap hold
    // it: strapOf); the others there are nailed to its foot
    let strapped = null;
    if (h.ground && h.stone) for (const it of h.items) if (it.ground && strapOf(boards[it.b]) > 0 && (!strapped || Math.abs(boards[it.b].d[1]) > Math.abs(boards[strapped.b].d[1]))) strapped = it;
    for (const it of h.items) {
      const b = boards[it.b], end = it.t < TOL ? 'a' : it.t > b.L - TOL ? 'b' : null;
      it.eIn = end === 'a' ? b.d : end === 'b' ? [-b.d[0], -b.d[1], -b.d[2]] : null;
      it.soft = []; it.lapped = false; it.endToEnd = false; it.restsOn = false;
      // an end on the ground: a post's foot on a stone is strapped down (a leaning one less firmly); a brace's foot
      // beside it is nailed to that post's foot (held through the post: face nails); anything else just rests there,
      // on the stone or the dirt
      if (h.ground && it.ground) {
        it.onStone = !!h.stone;
        if (it === strapped) { it.kind = 'stone'; it.strap = strapOf(b); }
        else if (strapped) { it.kind = 'face'; it.soft = [b.n]; it.lapped = !b.post; }
        else it.kind = 'dirt';
        continue;
      }
      const mine = cs.filter((c) => c.i === it.b || c.j === it.b);
      // the carrier of a toe joint (and not itself standing on anything here)
      const toes = mine.filter((c) => c.type === 'toe' && c.carrier === it.b);
      if (toes.length && !ends.has(it.b) && !h.ground) {
        // (several boards standing on it here: the one standing most nearly upright is the one that bears)
        const c = toes.reduce((a, x) => (Math.abs(boards[x.end].d[1]) > Math.abs(boards[a.end].d[1]) ? x : a));
        const e = boards[c.end], eEnd = c.tEnd < e.L / 2 ? e.d : [-e.d[0], -e.d[1], -e.d[2]];
        it.kind = 'toe'; it.toeEnd = c.end; it.toeAxis = eEnd;
        // (how many boards stand on it here: each is toe-nailed with its own nails, so a brace's foot set beside a post's
        // foot on a beam adds what its nails hold: TOE_SHARE)
        it.toeN = new Set(toes.map((x) => x.end)).size;
        // a level board laid on top of a level one rests on it: its weight bears too
        it.restsOn = !e.post && Math.abs(e.d[1]) < 0.3 && Math.abs(b.d[1]) < 0.3;
        continue;
      }
      let face = false, butt = true;
      const soft = [];
      for (const c of mine) {
        const j = c.i === it.b ? c.j : c.i, o = boards[j];
        if (c.type === 'butt') { it.endToEnd = true; continue; }
        butt = false;
        if (c.type === 'toe') continue;            // (standing on a carrier: the carrier holds the toe joint)
        face = true;
        if (c.shared) { if (!b.post) { soft.push(b.n); it.lapped = true; } else if (!o.post) soft.push(o.n); else soft.push(b.n); }
        else { const c2 = cross(b.d, o.d); if (norm(c2) > 0.1) soft.push(unit(c2)); }
      }
      it.endToEnd = it.endToEnd && !!it.eIn;
      // (a board whose only joint here is standing on a carrier: nailed to it through the toe joint, so its own tie to
      // the hub is an ordinary one, in a row with the carrier's)
      it.kind = face || !butt ? 'face' : 'butt';
      it.soft = it.kind === 'face' ? (soft.length ? orthoSet(soft) : [b.n]) : [];
    }
  }
}
// the distinct directions among a few unit vectors, squared up to each other (Gram-Schmidt), at most three
function orthoSet(vs) {
  const out = [];
  for (const v of vs) {
    let u = [...v];
    for (const o of out) { const k = dot(u, o); u = [u[0] - k * o[0], u[1] - k * o[1], u[2] - k * o[2]]; }
    if (norm(u) > 0.3) out.push(unit(u));
    if (out.length === 3) break;
  }
  return out;
}
// has this board's nail group at this joint twisted loose about the soft axis s (it.hinges: the axes it did, from
// state.hinges)?
const hinged = (it, s) => !!it.hinges && it.hinges.some((x) => Math.abs(dot(x, s)) > 0.9);
// an item's springs: [kt (any way), the 3x3 turning stiffness (row by row)]
function springOf(it) {
  const k = NAILS[it.kind];
  const R = [k.kb, 0, 0, 0, k.kb, 0, 0, 0, k.kb];
  // turning easily about the soft axes: kb + (kr - kb) * (s s^T) for each (a hinge: nails that twisted loose about that
  // axis, kr * HINGE)
  const soft = it.kind === 'face' ? it.soft : it.kind === 'stone' ? [[1, 0, 0], [0, 0, 1]] : null;
  if (soft) {
    for (const s of soft) {
      const kr = it.kind === 'face' && hinged(it, s) ? k.kr * HINGE : k.kr;
      for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) R[a * 3 + c] += (kr - k.kb) * s[a] * s[c];
    }
  }
  else for (let a = 0; a < 3; a++) R[a * 4] = k.kr;
  return { kt: k.kt, R };
}

// ── the beam piece: its stiffness (and how a push or pull along it changes that: P-delta) ───────────────────────────
// Local axes: x along the board, y across it in its own plane (the 3½ in way: it bends that way on its wide side,
// WOOD.I), z its face normal (the 1½ in way: the thin way, WOOD.Iweak). R: the three axes in the world, row by row.
function localK(L) {
  const { E, G, A, I, Iweak, J } = WOOD, k = new Float64Array(144);
  const s = (i, j, v) => { k[i * 12 + j] = v; k[j * 12 + i] = v; };
  const ea = E * A / L, gj = G * J / L;
  s(0, 0, ea); s(6, 6, ea); s(0, 6, -ea);
  s(3, 3, gj); s(9, 9, gj); s(3, 9, -gj);
  // bending in its own plane (moving along y, turning about z): the wide side
  const z1 = 12 * E * I / L ** 3, z2 = 6 * E * I / L ** 2, z3 = 4 * E * I / L, z4 = 2 * E * I / L;
  s(1, 1, z1); s(1, 5, z2); s(1, 7, -z1); s(1, 11, z2); s(5, 5, z3); s(5, 7, -z2); s(5, 11, z4); s(7, 7, z1); s(7, 11, -z2); s(11, 11, z3);
  // bending the thin way (moving along z, turning about y)
  const y1 = 12 * E * Iweak / L ** 3, y2 = 6 * E * Iweak / L ** 2, y3 = 4 * E * Iweak / L, y4 = 2 * E * Iweak / L;
  s(2, 2, y1); s(2, 4, -y2); s(2, 8, -y1); s(2, 10, -y2); s(4, 4, y3); s(4, 8, y2); s(4, 10, y4); s(8, 8, y1); s(8, 10, y2); s(10, 10, y3);
  return k;
}
// the change in stiffness per pound of pull along the piece (a squeezed board, negative pull, grows softer sideways)
function localKg(L) {
  const k = new Float64Array(144), s = (i, j, v) => { k[i * 12 + j] = v; k[j * 12 + i] = v; };
  const a = 6 / 5 / L, b = 1 / 10, c = 2 * L / 15, d = -L / 30;
  s(1, 1, a); s(1, 5, b); s(1, 7, -a); s(1, 11, b); s(5, 5, c); s(5, 7, -b); s(5, 11, d); s(7, 7, a); s(7, 11, -b); s(11, 11, c);
  s(2, 2, a); s(2, 4, -b); s(2, 8, -a); s(2, 10, -b); s(4, 4, c); s(4, 8, b); s(4, 10, d); s(8, 8, a); s(8, 10, b); s(10, 10, c);
  return k;
}
// world = T^T local T, with T four copies of R down the diagonal (worked block by block)
function toWorld(kl, R) {
  const out = new Float64Array(144), tmp = new Float64Array(9);
  for (let bi = 0; bi < 4; bi++) for (let bj = 0; bj < 4; bj++) {
    // tmp = k_block * R
    for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) {
      let v = 0; for (let m = 0; m < 3; m++) v += kl[(bi * 3 + a) * 12 + bj * 3 + m] * R[m * 3 + c]; tmp[a * 3 + c] = v;
    }
    // out_block = R^T * tmp
    for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) {
      let v = 0; for (let m = 0; m < 3; m++) v += R[m * 3 + a] * tmp[m * 3 + c]; out[(bi * 3 + a) * 12 + bj * 3 + c] = v;
    }
  }
  return out;
}
// a world 12-vector -> local (and back)
function vecToLocal(R, g, out) {
  for (let blk = 0; blk < 4; blk++) for (let a = 0; a < 3; a++) out[blk * 3 + a] = R[a * 3] * g[blk * 3] + R[a * 3 + 1] * g[blk * 3 + 1] + R[a * 3 + 2] * g[blk * 3 + 2];
  return out;
}
function vecToWorld(R, l, out) {
  for (let blk = 0; blk < 4; blk++) for (let c = 0; c < 3; c++) out[blk * 3 + c] = R[c] * l[blk * 3] + R[3 + c] * l[blk * 3 + 1] + R[6 + c] * l[blk * 3 + 2];
  return out;
}
// a force f (local [fx, fy, fz]) at xi (0..1 along the piece) shared out to the piece's two ends the way a beam carries
// it (the "consistent" loads: forces and end moments), added into the local 12-vector out
function addPointLoad(out, L, xi, f) {
  const x2 = xi * xi, x3 = x2 * xi;
  const N1 = 1 - 3 * x2 + 2 * x3, N2 = L * (xi - 2 * x2 + x3), N3 = 3 * x2 - 2 * x3, N4 = L * (x3 - x2);
  out[0] += (1 - xi) * f[0]; out[6] += xi * f[0];
  out[1] += N1 * f[1]; out[5] += N2 * f[1]; out[7] += N3 * f[1]; out[11] += N4 * f[1];
  out[2] += N1 * f[2]; out[4] -= N2 * f[2]; out[8] += N3 * f[2]; out[10] -= N4 * f[2];
}

// ── the solver: symmetric, only the band of numbers near the diagonal kept (a "skyline" or envelope), LDL^T ──────────
// The parts are first numbered so neighbours get nearby numbers (reverse Cuthill-McKee), which keeps that band narrow.
// order: rank of each node; links: per node, the nodes it is tied to.
function rcm(links) {
  const n = links.length, deg = links.map((l) => l.length), seen = new Uint8Array(n), order = [];
  const bfs = (s) => {
    const q = [s], lv = new Int32Array(n).fill(-1); lv[s] = 0; let last = s;
    for (let k = 0; k < q.length; k++) { const v = q[k]; last = v; for (const w of links[v]) if (lv[w] < 0 && !seen[w]) { lv[w] = lv[v] + 1; q.push(w); } }
    // the far end: the lowest-degree node on the last level
    let best = last; for (const v of q) if (lv[v] === lv[last] && deg[v] < deg[best]) best = v;
    return best;
  };
  for (;;) {
    let s = -1; for (let v = 0; v < n; v++) if (!seen[v] && (s < 0 || deg[v] < deg[s])) s = v;
    if (s < 0) break;
    s = bfs(bfs(s));                             // a node at one far end of its piece of the graph
    const q = [s]; seen[s] = 1;
    for (let k = 0; k < q.length; k++) {
      const v = q[k], nb = links[v].filter((w) => !seen[w]).sort((a, b) => deg[a] - deg[b]);
      for (const w of nb) { seen[w] = 1; q.push(w); }
    }
    order.push(...q);
  }
  order.reverse();
  const rank = new Int32Array(n); order.forEach((v, i) => { rank[v] = i; });
  return rank;
}
// the envelope for 6 numbers per node: row r keeps columns fc[r]..r
function makeEnvelope(links, rank) {
  const nn = links.length, n = nn * 6, fc = new Int32Array(n), rp = new Int32Array(n + 1);
  for (let v = 0; v < nn; v++) {
    let m = rank[v]; for (const w of links[v]) m = Math.min(m, rank[w]);
    for (let k = 0; k < 6; k++) fc[rank[v] * 6 + k] = m * 6;
  }
  for (let r = 0; r < n; r++) rp[r + 1] = rp[r] + (r - fc[r] + 1);
  return { n, fc, rp, a: new Float64Array(rp[n]) };
}
const envAdd = (env, i, j, v) => { if (i < j) { const t = i; i = j; j = t; } env.a[env.rp[i] + j - env.fc[i]] += v; };
// factor in place: L (unit lower, below the diagonal) and D (on it). A pivot that comes out (nearly) zero is a part
// with nothing stopping it moving: it is noted, and held still so the rest can still be solved.
function factor(env) {
  const { n, fc, rp, a } = env, diag = new Float64Array(n), loose = [];
  for (let i = 0; i < n; i++) {
    const ri = rp[i], fi = fc[i];
    const orig = a[ri + i - fi];
    for (let j = fi; j < i; j++) {
      const rj = rp[j], fj = fc[j], k0 = Math.max(fi, fj);
      let s = a[ri + j - fi];
      for (let k = k0; k < j; k++) s -= a[ri + k - fi] * a[rj + k - fj];
      a[ri + j - fi] = s;                        // (L_ij times D_j, for now)
    }
    let d = orig;
    for (let j = fi; j < i; j++) { const u = a[ri + j - fi], l = u / diag[j]; a[ri + j - fi] = l; d -= u * l; }
    if (!(d > Math.abs(orig) * 1e-10) || !Number.isFinite(d)) { loose.push(i); d = Math.max(Math.abs(orig), 1) * 1e6; }
    diag[i] = d; a[ri + i - fi] = d;
  }
  env.diag = diag; env.loose = loose;
  return env;
}
function solveEnv(env, b, x = new Float64Array(env.n)) {
  const { n, fc, rp, a, diag } = env;
  for (let i = 0; i < n; i++) { const ri = rp[i], fi = fc[i]; let s = b[i]; for (let k = fi; k < i; k++) s -= a[ri + k - fi] * x[k]; x[i] = s; }
  for (let i = 0; i < n; i++) x[i] /= diag[i];
  for (let i = n - 1; i >= 0; i--) { const ri = rp[i], fi = fc[i], xi = x[i]; for (let k = fi; k < i; k++) x[k] -= a[ri + k - fi] * xi; }
  return x;
}

// ── the model of the standing tower: nodes, pieces, springs, its stiffness factored ─────────────────────────────────
// Every board gets a node at each joint along it and at both ends; every hub off the ground gets a node of its own.
function buildModel(W, D, boards, hubs) {
  const nodes = [], boardNodes = boards.map(() => []);
  const nodeAt = (bi, t) => {
    const list = boardNodes[bi];
    for (const m of list) if (Math.abs(nodes[m].t - t) < 0.05) return m;
    nodes.push({ b: bi, t, P: ptAt(boards[bi], t), hub: -1 }); list.push(nodes.length - 1); return nodes.length - 1;
  };
  hubs.forEach((h) => { for (const it of h.items) it.node = nodeAt(it.b, it.t); });
  boards.forEach((b, bi) => { if (boardNodes[bi].length) { nodeAt(bi, 0); nodeAt(bi, b.L); } });
  boardNodes.forEach((l) => l.sort((p, q) => nodes[p].t - nodes[q].t));
  hubs.forEach((h, hi) => { if (h.ground) { h.node = -1; return; } nodes.push({ b: -1, t: 0, P: h.P, hub: hi }); h.node = nodes.length - 1; });
  // the pieces
  const elems = [];
  boardNodes.forEach((list, bi) => {
    const b = boards[bi];
    for (let k = 0; k + 1 < list.length; k++) {
      const na = list[k], nb = list[k + 1], L = nodes[nb].t - nodes[na].t;
      if (L < 1e-6) continue;
      const R = new Float64Array([...b.d, ...b.w, ...b.n]);
      elems.push({ b: bi, na, nb, L, R, kl: localK(L), kgl: localKg(L), t0: nodes[na].t });
    }
  });
  for (const e of elems) { e.K = toWorld(e.kl, e.R); e.Kg = toWorld(e.kgl, e.R); }
  // the springs (on a stone, a brace's foot is nailed to the strapped post's foot, so it is tied to that post's end and
  // moves and turns with it, not to the stone itself)
  const springs = [];
  hubs.forEach((h, hi) => {
    const strap = h.ground ? h.items.find((it) => it.kind === 'stone') : null;
    for (const it of h.items) springs.push({ hub: hi, it, node: it.node, to: strap && it !== strap && it.kind === 'face' ? strap.node : h.node, ...springOf(it) });
  });
  // number the nodes, then the stiffness
  const links = nodes.map(() => []);
  const link = (p, q) => { if (p < 0 || q < 0 || p === q) return; links[p].push(q); links[q].push(p); };
  for (const e of elems) link(e.na, e.nb);
  for (const s of springs) link(s.node, s.to);
  const rank = rcm(links), env = makeEnvelope(links, rank);
  const dof = (node, k) => rank[node] * 6 + k;
  for (const e of elems) {
    const g = []; for (let k = 0; k < 6; k++) g.push(dof(e.na, k)); for (let k = 0; k < 6; k++) g.push(dof(e.nb, k));
    e.dof = g;
    for (let p = 0; p < 12; p++) for (let q = 0; q <= p; q++) { const v = e.K[p * 12 + q]; if (v) envAdd(env, g[p], g[q], v); }
  }
  for (const s of springs) {
    for (let k = 0; k < 3; k++) {
      envAdd(env, dof(s.node, k), dof(s.node, k), s.kt);
      if (s.to >= 0) { envAdd(env, dof(s.to, k), dof(s.to, k), s.kt); envAdd(env, dof(s.node, k), dof(s.to, k), -s.kt); }
    }
    for (let a = 0; a < 3; a++) for (let c = 0; c <= a; c++) {
      const v = s.R[a * 3 + c]; if (!v) continue;
      envAdd(env, dof(s.node, 3 + a), dof(s.node, 3 + c), v);
      if (s.to >= 0) {
        envAdd(env, dof(s.to, 3 + a), dof(s.to, 3 + c), v);
        envAdd(env, dof(s.node, 3 + a), dof(s.to, 3 + c), -v);
        if (a !== c) envAdd(env, dof(s.node, 3 + c), dof(s.to, 3 + a), -v);
      }
    }
  }
  const M = { W, D, boards, hubs, nodes, boardNodes, elems, springs, rank, dof, n: env.n, env };
  factor(env);
  // the weight on every piece (shared out to its ends the way a beam carries it)
  M.Fg = new Float64Array(env.n);
  for (const e of elems) {
    e.fg = new Float64Array(12);
    const m = Math.max(2, Math.ceil(e.L / 0.5)), ds = e.L / m, f = [0, -WOOD.weight * ds, 0], fl = [0, 0, 0];
    for (let a = 0; a < 3; a++) fl[a] = e.R[a * 3] * f[0] + e.R[a * 3 + 1] * f[1] + e.R[a * 3 + 2] * f[2];
    for (let k = 0; k < m; k++) addPointLoad(e.fg, e.L, (k + 0.5) / m, fl);
    const gw = vecToWorld(e.R, e.fg, new Float64Array(12));
    for (let p = 0; p < 12; p++) M.Fg[e.dof[p]] += gw[p];
  }
  M.ug = solveEnv(env, M.Fg);
  M.wind = [];                                  // per wind (filled when first needed): its loads for 1 mph
  return M;
}

// ── the wind on every board ─────────────────────────────────────────────────────────────────────────────────────────
// How wide a board looks to wind crossing it in direction vp (unit, across the board): 3½ in where it hits the wide face,
// 1½ in on the edge, in between by angle (the width of its shadow).
const seenWidth = (b, vp) => WOOD.width * Math.abs(dot(b.n, vp)) + WOOD.thick * Math.abs(dot(b.w, vp));
// The across-flow on a board for wind v: [sin² of the angle between them, the unit across-flow direction]
function across(b, v) {
  const k = dot(v, b.d), s2 = 1 - k * k;
  if (s2 < 1e-9) return [0, null];
  const r = Math.sqrt(s2);
  return [s2, [(v[0] - k * b.d[0]) / r, (v[1] - k * b.d[1]) / r, (v[2] - k * b.d[2]) / r]];
}
// The shelter for wind v: walls of boards facing the wind (the planes square to it), band by band of height, and each
// board's own shadow strip. Returns shade(P, board index) -> 0..1.
// The wood of a wall is tallied in quarter-foot bands, each bit of board only in the height it really covers (a
// crosspiece lying level at 8 ft covers 7.85 to 8.15 ft, its 3½ in). How solid the wall is at a height is the wood in
// the foot of wall centred there (v2 counted it by whole feet from the ground up, so a crosspiece at exactly 8 ft
// sheltered all of 8 to 9 ft and nothing below it; now it shelters 7½ to 8½ ft, half a foot either side of it, the
// way a thin board's shadow spreads).
const BAND = 0.25, SPREAD = 0.5;
function shelterFor(boards, v) {
  const lat = [-v[2], 0, v[0]];               // across the wind, level
  // the walls facing the wind (PLANES ARE X OR Z: the planes square to a wind along X or Z; posts stand in all of them)
  const screens = new Map();
  for (const b of boards) {
    if (!b.post && Math.abs(dot(b.n, v)) < 0.99) continue;
    const a = dot(b.A, v), key = Math.round(a * 1000);
    let S = screens.get(key); if (!S) { S = { a, bands: new Map() }; screens.set(key, S); }
    const [s2, vp] = across(b, v); if (!s2) continue;
    const wide = seenWidth(b, vp), m = Math.max(1, Math.ceil(b.L / 0.25)), ds = b.L / m;
    // (how tall one bit of it stands: its length's rise, and its cross-section's height: 3½ in where its wide side is
    // up and down, as a level board's is)
    const ext = ds * Math.abs(b.d[1]) + WOOD.width * Math.abs(b.w[1]) + WOOD.thick * Math.abs(b.n[1]);
    for (let k = 0; k < m; k++) {
      const P = ptAt(b, (k + 0.5) * ds), u = dot(P, lat), y0 = Math.max(0, P[1] - ext / 2), y1 = Math.max(y0 + 1e-6, P[1] + ext / 2);
      for (let j = Math.floor(y0 / BAND); j * BAND < y1; j++) {
        const part = (Math.min(y1, (j + 1) * BAND) - Math.max(y0, j * BAND)) / (y1 - y0);
        if (part <= 0) continue;
        let band = S.bands.get(j); if (!band) { band = { area: 0, lo: Infinity, hi: -Infinity }; S.bands.set(j, band); }
        band.area += ds * wide * part; band.lo = Math.min(band.lo, u); band.hi = Math.max(band.hi, u);
      }
    }
  }
  const walls = [...screens.values()];
  // each board's shadow: its line seen along the wind, and half its seen width
  const strips = boards.map((b) => {
    const [s2, vp] = across(b, v), wide = s2 ? seenWidth(b, vp) : WOOD.thick, h = wide / 2 + 0.01;
    const prA = sub(b.A, v.map((x) => x * dot(b.A, v))), pd = sub(b.d, v.map((x) => x * dot(b.d, v)));
    return { b, h, wide, prA, pd, aA: dot(b.A, v), dv: dot(b.d, v), ylo: b.lo - 0.5, yhi: b.hi + 0.5 };
  });
  // a wall's wood in the foot of height centred at y: { area, lo, hi } (lo, hi: how far it reaches across the wind)
  const windowOf = (S, y) => {
    const y0 = y - SPREAD, y1 = y + SPREAD;
    let area = 0, lo = Infinity, hi = -Infinity;
    for (let j = Math.floor(y0 / BAND); j * BAND < y1; j++) {
      const band = S.bands.get(j); if (!band) continue;
      const w = (Math.min(y1, (j + 1) * BAND) - Math.max(y0, j * BAND)) / BAND; if (w <= 0) continue;
      area += band.area * w; lo = Math.min(lo, band.lo); hi = Math.max(hi, band.hi);
    }
    return area > 0 ? { area, lo, hi } : null;
  };
  return (P, self) => {
    const aP = dot(P, v), uP = dot(P, lat);
    let s = 1;
    // behind a wall: the more of it is wood at this height, the more shelter (only well inside its edges: the wind wraps
    // round the edges of a wall, and a board right at its edge is sheltered by the post's wake instead)
    for (const S of walls) {
      if (aP - S.a <= 0.3) continue;
      const band = windowOf(S, P[1]);
      if (!band || uP <= band.lo + 0.25 || uP >= band.hi - 0.25) continue;
      s = Math.min(s, leeShade(band.area / (2 * SPREAD * (band.hi - band.lo + WOOD.width))));
    }
    // in a board's wake: the nearest upwind spot of a board whose shadow strip covers this point. A board in front
    // shelters only as much of this one's width as it covers: a 1½ in edge in front of a 3½ in face hides 3/7 of it.
    const prP = sub(P, v.map((x) => x * aP)), mine = strips[self] ? strips[self].wide : WOOD.width;
    for (const st of strips) {
      if (st.b.i === self || P[1] < st.ylo || P[1] > st.yhi) continue;
      const r = sub(st.prA, prP), pp = dot(st.pd, st.pd), rp = dot(r, st.pd), rr = dot(r, r), h2 = st.h * st.h;
      let s1, s2;
      if (pp < 1e-12) { if (rr > h2) continue; s1 = 0; s2 = st.b.L; }
      else { const disc = rp * rp - pp * (rr - h2); if (disc < 0) continue; const q = Math.sqrt(disc); s1 = (-rp - q) / pp; s2 = (-rp + q) / pp; }
      s1 = Math.max(s1, 0); s2 = Math.min(s2, st.b.L); if (s1 > s2) continue;
      // upwind of P (by more than a hair: boards in the same plane don't shade each other)
      const lim = aP - 0.05 - st.aA;
      let best;
      if (Math.abs(st.dv) < 1e-9) { if (lim < 0) continue; best = s2; }
      else if (st.dv > 0) { const e = Math.min(s2, lim / st.dv); if (e < s1) continue; best = e; }
      else { const e = Math.max(s1, lim / st.dv); if (e > s2) continue; best = e; }
      const d = aP - (st.aA + st.dv * best), cover = Math.min(1, st.wide / mine);
      s = Math.min(s, 1 - (1 - wakeShade(d)) * cover);
    }
    return s;
  };
}
// The wind for 1 mph from wind k on every piece of model M: consistent loads (local, per piece), the load vector, the
// total push along the wind, and its turning push about the downwind edge of the stones (pound-feet, for tipping).
function windOf(M, k) {
  if (M.wind[k]) return M.wind[k];
  const dv = WINDS[k].dir, v = [dv.X, 0, dv.Z], shade = shelterFor(M.boards, v);
  const depth = Math.abs(v[0]) > 0.5 ? M.W : M.D;
  const F = new Float64Array(M.n), fl = [0, 0, 0], perElem = [], perBoard = new Map();
  let total = 0, turn = 0;
  for (const e of M.elems) {
    const b = M.boards[e.b], [s2, vp] = across(b, v), loc = new Float64Array(12);
    perElem.push(loc);
    if (!s2) continue;
    const wide = seenWidth(b, vp), m = Math.max(2, Math.ceil(e.L / 0.5)), ds = e.L / m;
    let pushed = 0;
    for (let q = 0; q < m; q++) {
      const t = e.t0 + (q + 0.5) * ds, P = ptAt(b, t);
      const f = pressure(1, P[1]) * DRAG * wide * s2 * shade(P, b.i) * ds, fv = [vp[0] * f, vp[1] * f, vp[2] * f];
      for (let a = 0; a < 3; a++) fl[a] = e.R[a * 3] * fv[0] + e.R[a * 3 + 1] * fv[1] + e.R[a * 3 + 2] * fv[2];
      addPointLoad(loc, e.L, (q + 0.5) / m, fl);
      const along = dot(fv, v);
      total += along; pushed += along;
      turn += along * P[1] + fv[1] * (depth / 2 - dot(P, v));
    }
    perBoard.set(b.id, (perBoard.get(b.id) || 0) + pushed);
    const gw = vecToWorld(e.R, loc, new Float64Array(12));
    for (let p = 0; p < 12; p++) F[e.dof[p]] += gw[p];
  }
  const u = solveEnv(M.env, F);
  return (M.wind[k] = { F, u, perElem, total, turn, perBoard, v, depth });
}

// ── one wind on the model: how it moves (with the weight leaning on the movement) ───────────────────────────────────
// Solves (K + Kg(N)) u = F by repeating u = K^-1 (F - Kg(N(u)) u) from the plain answer: the stiffness K is factored once
// for every wind and every stage, and each round costs only one pass back through it. If the rounds grow instead of
// settling, the tower is past the point where its weight can be held up as it leans: it folds (unstable).
function solveWind(M, k, mph) {
  const W = windOf(M, k), q = mph * mph, n = M.n;
  const F = new Float64Array(n), u = new Float64Array(n);
  for (let i = 0; i < n; i++) { F[i] = M.Fg[i] + q * W.F[i]; u[i] = M.ug[i] + q * W.u[i]; }
  const N = new Float64Array(M.elems.length), ue = new Float64Array(12), r = new Float64Array(n);
  let unstable = false, last = Infinity, grow = 0, rounds = 0;
  for (let it = 0; it < 40; it++) {
    rounds++;
    r.set(F);
    for (let e = 0; e < M.elems.length; e++) {
      const el = M.elems[e], g = el.dof;
      for (let p = 0; p < 12; p++) ue[p] = u[g[p]];
      // the pull along the piece: EA/L times how much it stretched
      N[e] = WOOD.E * WOOD.A / el.L * (el.R[0] * (ue[6] - ue[0]) + el.R[1] * (ue[7] - ue[1]) + el.R[2] * (ue[8] - ue[2]));
      const Ne = N[e]; if (!Ne) continue;
      for (let p = 0; p < 12; p++) { let s = 0; const row = p * 12; for (let c = 0; c < 12; c++) s += el.Kg[row + c] * ue[c]; r[g[p]] -= Ne * s; }
    }
    const nu = solveEnv(M.env, r);
    let diff = 0, big = 0;
    for (let i = 0; i < n; i++) { diff = Math.max(diff, Math.abs(nu[i] - u[i])); big = Math.max(big, Math.abs(nu[i])); }
    u.set(nu);
    if (diff <= 1e-9 + 1e-7 * big) break;
    if (diff > last * 0.97) grow++; else grow = 0;
    last = diff;
    if (grow >= 3 || big > 100) { unstable = true; break; }
    if (it === 39) unstable = true;
  }
  return { u, N, unstable, rounds, k, mph };
}

// ── checking every part ─────────────────────────────────────────────────────────────────────────────────────────────
// Returns { items (every part's use of its strength, 1 = at its limit), strain (per board id), joints (per hub),
// move (per board id), tip }
function checkAll(M, sol) {
  const { u, N } = sol, W = windOf(M, sol.k), q = sol.mph * sol.mph;
  const items = [], strain = {}, hubUtil = new Float64Array(M.hubs.length);
  const bump = (id, v) => { if (!(strain[id] >= v)) strain[id] = v; };
  for (const b of M.boards) strain[b.id] = 0;
  // the boards, piece by piece
  const ue = new Float64Array(12), ul = new Float64Array(12), f = new Float64Array(12);
  M.elems.forEach((el, e) => {
    const g = el.dof; for (let p = 0; p < 12; p++) ue[p] = u[g[p]];
    vecToLocal(el.R, ue, ul);
    const Ne = N[e], wl = W.perElem[e];
    for (let p = 0; p < 12; p++) {
      let s = 0; const row = p * 12; for (let c = 0; c < 12; c++) s += (el.kl[row + c] + Ne * el.kgl[row + c]) * ul[c];
      f[p] = s - el.fg[p] - q * wl[p];
    }
    const pull = (f[6] - f[0]) / 2;
    const Ms = Math.max(Math.abs(f[5]), Math.abs(f[11])), Mw = Math.max(Math.abs(f[4]), Math.abs(f[10])), T = Math.abs(f[3]);
    const buckleAt = Math.PI ** 2 * WOOD.E * WOOD.Iweak / (el.L * el.L);
    const squash = pull < 0 ? -pull / Math.min(WOOD.pullHolds, buckleAt) : pull / WOOD.pullHolds;
    const bend = Ms / WOOD.bendHolds + Mw / WOOD.bendHoldsWeak;
    const sigma = squash + bend, tau = T / WOOD.twistHolds;
    const util = Math.hypot(sigma, tau);
    const b = M.boards[el.b], P = ptAt(b, el.t0 + el.L / 2);
    items.push({ type: 'board', util, b: el.b, id: b.id, P, buckle: pull < 0 && squash > bend, N: pull, Ms, Mw, T });
    bump(b.id, util);
  });
  // the nails: each board at each joint
  for (const sp of M.springs) {
    const it = sp.it, a = M.dof(sp.node, 0), hb = sp.to >= 0 ? M.dof(sp.to, 0) : -1;
    const dt = [0, 0, 0], dr = [0, 0, 0];
    for (let k = 0; k < 3; k++) { dt[k] = (hb >= 0 ? u[hb + k] : 0) - u[a + k]; dr[k] = (hb >= 0 ? u[hb + 3 + k] : 0) - u[a + 3 + k]; }
    // the force and the turning the joint puts on the board
    const F = [sp.kt * dt[0], sp.kt * dt[1], sp.kt * dt[2]];
    const Mo = [0, 1, 2].map((r) => sp.R[r * 3] * dr[0] + sp.R[r * 3 + 1] * dr[1] + sp.R[r * 3 + 2] * dr[2]);
    const r = nailUse(M.boards[it.b], it, F, Mo, M.hubs[sp.hub]);
    const h = M.hubs[sp.hub];
    items.push({ type: 'joint', util: r.util, b: it.b, id: M.boards[it.b].id, hub: sp.hub, P: h.P, kind: it.kind, onStone: it.onStone, toeEnd: it.toeEnd, toeN: it.toeN, ...r });
    bump(M.boards[it.b].id, r.util);
    hubUtil[sp.hub] = Math.max(hubUtil[sp.hub], r.util);
  }
  // How far each post leans between its joints (racking), and a post with its top free (bending over).
  // A storey runs from floor to floor: the post's lowest and highest joints, and every joint where a level board (a
  // crosspiece, a beam) holds it. A joint where only a brace lands is inside a storey, not a floor of it: the stretch of
  // post between a brace's top and the crosspiece above bends (and is checked as a board), but it is not a storey that
  // can fold over by itself. (Measured joint to joint, a post turned the thin way in that wall bends 1¾ in over the
  // 2.7 ft above a brace's top in the big gust: the wood is at 0.43 of what it holds, while the storey leans 1/40.)
  // Every board that rises counts here by how upright it stands (uprightOf: a post fully, a post leaning in 10 degrees
  // 0.97, a brace at 45 degrees half, a level board not at all), so a tapered storey's leaning posts rack like straight
  // ones, and a board leaning past some angle never stops being checked.
  const hubMove = (hi) => { const h = M.hubs[hi]; if (h.node < 0) return [0, 0, 0]; const d = M.dof(h.node, 0); return [u[d], u[d + 1], u[d + 2]]; };
  // A storey's lean is measured against the floor it stands on. A tier standing on beams tips a little as a whole when
  // the boards under it give (its feet on one side go down a hair, the other side's up: the beams and crosspieces under
  // it bend, their joints give). That turns the tier without folding it, so the turn of its floor is taken off its lean:
  // what is left is the storey folding over (racking). (A 1 × 1 top on beams over a 2 × 3 tier: its floor turns about
  // 1/35 in the big gust, which would carry its top 1¾ in over 5 ft, while the 1 × 1 itself, braced, leans 1/300.)
  // The floor's turn: the up-and-down movement of every foot standing at that height (a hub with a board rising from
  // it), the best-fitting tilted plane through them; on the stones it is nothing.
  const floorTilt = new Map();
  const tiltOf = (y) => {
    const key = Math.round(y * 100);
    if (floorTilt.has(key)) return floorTilt.get(key);
    const pts = [];
    M.hubs.forEach((h, hi) => {
      if (Math.abs(h.P[1] - y) > 0.3) return;
      if (!h.items.some((it) => { const o = M.boards[it.b]; return uprightOf(o) > 0.5 && Math.abs(ptAt(o, it.t)[1] - o.lo) < TOL; })) return;
      pts.push([h.P[0], h.P[2], hubMove(hi)[1]]);
    });
    let tilt = [0, 0];
    if (pts.length > 1) {
      const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, mz = pts.reduce((s, p) => s + p[1], 0) / n, my = pts.reduce((s, p) => s + p[2], 0) / n;
      let sxx = 1e-9, szz = 1e-9, sxz = 0, sxy = 0, szy = 0;
      for (const [x, z, dy] of pts) { const a = x - mx, c = z - mz, e = dy - my; sxx += a * a; szz += c * c; sxz += a * c; sxy += a * e; szy += c * e; }
      const det = sxx * szz - sxz * sxz;
      if (det > 1e-12) tilt = [(sxy * szz - szy * sxz) / det, (szy * sxx - sxy * sxz) / det];
    }
    floorTilt.set(key, tilt);
    return tilt;
  };
  M.boards.forEach((b, bi) => {
    const up = uprightOf(b);
    if (up < 0.02) return;
    const at = [];
    M.hubs.forEach((h, hi) => {
      for (const it of h.items) {
        if (it.b !== bi) continue;
        const floor = h.ground || h.items.some((o) => o.b !== bi && M.boards[o.b].level);
        at.push({ hi, y: ptAt(b, it.t)[1], t: it.t, floor });
      }
    });
    at.sort((p, q2) => p.y - q2.y);
    const floors = at.filter((p, k) => p.floor || k === 0 || k === at.length - 1);
    for (let k = 0; k + 1 < floors.length; k++) {
      const m0 = hubMove(floors[k].hi), m1 = hubMove(floors[k + 1].hi), dy = floors[k + 1].y - floors[k].y;
      if (dy < 0.3) continue;
      // (less what its floor's turn carries the top along: a floor turned so its +X side rose by s per foot carries a
      // spot dy above it s * dy toward -X)
      const [sx, sz] = tiltOf(floors[k].y);
      const lean = Math.hypot(m1[0] - m0[0] + sx * dy, m1[2] - m0[2] + sz * dy) / Math.max(1, dy);
      const util = up * lean / DRIFT_LIMIT;
      items.push({ type: 'drift', util, b: bi, id: b.id, y0: floors[k].y, y1: floors[k + 1].y, P: ptAt(b, (floors[k].t + floors[k + 1].t) / 2), lean, dir: [m1[0] - m0[0], m1[2] - m0[2]] });
      bump(b.id, util);
    }
    // the top: its upper end a foot or more (along it) past its last joint, free. How far that end moves square across
    // the board, against the bottom end, over the length between them: it is bending (or turning on its nails) over.
    const list = M.boardNodes[bi]; if (list.length < 2 || !at.length) return;
    const top = list.reduce((p, m) => (M.nodes[m].P[1] > M.nodes[p].P[1] ? m : p)), bot = list.reduce((p, m) => (M.nodes[m].P[1] < M.nodes[p].P[1] ? m : p));
    if (top === bot) return;
    const tTop = M.nodes[top].t, free = Math.min(...at.map((p) => Math.abs(p.t - tTop)));
    if (free < 1) return;
    const dt0 = M.dof(top, 0), db0 = M.dof(bot, 0), rel = [u[dt0] - u[db0], u[dt0 + 1] - u[db0 + 1], u[dt0 + 2] - u[db0 + 2]];
    const k = dot(rel, b.d), sq = Math.hypot(rel[0] - k * b.d[0], rel[1] - k * b.d[1], rel[2] - k * b.d[2]);
    const lean = sq / Math.max(1, Math.abs(tTop - M.nodes[bot].t));
    items.push({ type: 'top', util: up * lean / DRIFT_LIMIT, b: bi, id: b.id, P: ptAt(b, b.L / 2), lean });
    bump(b.id, up * lean / DRIFT_LIMIT);
  });
  // a board with nothing stopping it moving (the equations had no answer for it: the solver held it still to finish).
  // (Only the boards' own numbers count: a hub is only the meeting point, and holding it still changes nothing.)
  if (M.env.loose.length) {
    const inv = new Int32Array(M.nodes.length); M.rank.forEach((r, node) => { inv[r] = node; });
    const seen = new Set();
    for (const d of M.env.loose) {
      const nd = M.nodes[inv[Math.floor(d / 6)]];
      for (const bi of nd.b >= 0 ? [nd.b] : []) {
        if (seen.has(bi)) continue; seen.add(bi);
        const b = M.boards[bi];
        items.push({ type: 'loose', util: 99, b: bi, id: b.id, P: ptAt(b, b.L / 2) }); bump(b.id, 1);
      }
    }
  }
  // the whole tower tipping on its downwind stones
  const tip = tipping(M, W, q);
  items.push({ type: 'tip', util: tip.util, P: [W.v[0] * M.W / 2, 0, W.v[2] * M.D / 2], ...tip });
  if (sol.unstable) {
    // past holding itself up: the worst lean goes, whatever it measured
    let w = null; for (const it of items) if ((it.type === 'drift' || it.type === 'top') && (!w || it.util > w.util)) w = it;
    if (!w) for (const it of items) if (it.type === 'board' && (!w || -it.N > -w.N)) w = it;
    if (w) { w.util = Math.max(w.util, 1.5); w.unstable = true; bump(w.id, w.util); }
  }
  // the page's numbers: the nail spots and how far every board's ends moved
  const joints = M.hubs.map((h, hi) => ({ X: h.P[0], Y: h.P[1], Z: h.P[2], util: hubUtil[hi] }));
  const move = {};
  M.boards.forEach((b, bi) => {
    const list = M.boardNodes[bi]; if (!list.length) return;
    const e0 = list[0], e1 = list[list.length - 1], d0 = M.dof(e0, 0), d1 = M.dof(e1, 0);
    move[b.id] = [[u[d0], u[d0 + 1], u[d0 + 2]], [u[d1], u[d1 + 1], u[d1 + 2]]];
  });
  for (const k in strain) strain[k] = +strain[k].toFixed(4);
  let worst = null; for (const it of items) if (!worst || it.util > worst.util) worst = it;
  return { items, worst, strain, joints, move, tip };
}
// How much of its strength one board's nails at one joint are using. F, Mo: the force and turning the joint puts on the
// board. The parts the wood bears for nothing come off first: pushed onto the board it is nailed to (the faces bear),
// pushed end on against a board on its line, a post or brace pressed down onto its stone, a toe-nailed end pushed onto
// the board it stands on (and a beam resting on top of a crosspiece).
function nailUse(b, it, F, Mo, h) {
  const k = NAILS[it.kind];
  let f = [...F], pull = 0;
  const take = (dir, bears) => {
    // the part of f along dir: free if it pushes that way (bears), else it pulls
    const c = dot(f, dir);
    f = [f[0] - c * dir[0], f[1] - c * dir[1], f[2] - c * dir[2]];
    if (c < 0 || !bears) pull = Math.hypot(pull, Math.abs(c));
  };
  let twist;
  if (it.kind === 'stone' || it.kind === 'dirt') {
    const up = f[1]; f[1] = 0;
    // (a strap round a leaning foot holds less: it.strap, 0..1)
    const s = it.kind === 'stone' ? Math.max(0.02, it.strap ?? 1) : 1;
    const slide = Math.hypot(f[0], f[2]), lift = Math.max(0, -up), press = Math.max(0, up);
    const holds = it.kind === 'dirt' ? k.holds + k.friction * press : k.holds * s;
    twist = it.kind === 'stone' ? Math.hypot(Mo[0], Mo[2]) : norm(Mo);
    const parts = [slide / holds, lift / (k.pull * s), twist / (k.twist * s)];
    return { util: Math.hypot(...parts), force: slide, pull: lift, twist, parts };
  }
  if (it.kind === 'face') {
    if (it.endToEnd) take(it.eIn, true);
    if (it.lapped) take(b.nOut, true);
    // (each way it turns easily is held by its own group of nails: a corner post turns in the front wall against the
    // front crosspiece's nails, and in the side wall against the side crosspiece's. A hinge, where those nails already
    // twisted loose, turns freely: nothing to check there.)
    let tw = 0, axis = null;
    for (const s of it.soft) { if (hinged(it, s)) continue; const m = Math.abs(dot(Mo, s)); if (m > tw) { tw = m; axis = s; } }
    twist = tw;
    // turning the stiff ways (every axis but the soft ones): the faces bear on one edge and the nails at the other draw
    // out, adding to any straight pull on them
    let bm = [...Mo];
    for (const s of it.soft) { const m = dot(bm, s); bm = [bm[0] - m * s[0], bm[1] - m * s[1], bm[2] - m * s[2]]; }
    const bend = norm(bm), slide = norm(f);
    const parts = [slide / k.holds, pull / k.pull + bend / k.bend, twist / k.twist];
    return { util: Math.hypot(...parts), force: slide, pull, twist, bend, axis, parts };
  } else if (it.kind === 'butt') {
    if (it.eIn) take(it.eIn, true);
    twist = norm(Mo);
  } else {   // toe: on the carrier. The board standing on it pushing onto it bears (the hub presses the carrier away from
             // that board); pulling it off draws the toe-nails; a level board resting on top presses it down for nothing.
    const a = it.toeAxis;
    take([-a[0], -a[1], -a[2]], true);
    if (it.restsOn && f[1] < 0) f[1] = 0;
    twist = norm(Mo);
  }
  // (a toe joint with several boards standing on it holds what all their toe-nails hold)
  const share = it.kind === 'toe' ? 1 + TOE_SHARE * Math.max(0, (it.toeN || 1) - 1) : 1;
  const slide = norm(f), parts = [slide / (k.holds * share), pull / (k.pull * share), twist / (k.twist * share)];
  return { util: Math.hypot(...parts), force: slide, pull, twist, parts };
}
// Tipping over in one piece, like a box on a table: the wind's turning push about the downwind edge of the stones,
// against the tower's weight (from its centre of weight to that edge) and the two windward stones it would have to lift
// (each stoneLb of the smaller of W and D, a full depth from that edge).
function tipping(M, W, q) {
  let weight = 0, a = 0;
  for (const b of M.boards) { const w = WOOD.weight * b.L; weight += w; a += w * (dot(b.A, W.v) + dot(b.B, W.v)) / 2; }
  const cg = weight ? a / weight : 0;
  const hold = weight * (W.depth / 2 - cg) + 2 * stoneLb(Math.min(M.W, M.D)) * W.depth;
  const turn = q * W.turn;
  return { util: hold > 0 ? Math.max(0, turn / hold) : (turn > 0 ? 99 : 0), turn, hold, weight, push: q * W.total };
}

// ── words ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// a board's name: a corner post, a post, a crosspiece, a beam (a level board resting on others by its ends), a knee brace
// (a short slanting board that props a post against a crosspiece, not reaching across its wall), a brace
function roleOf(b, W, D, hubs, boards) {
  if (b.post) return Math.abs(Math.abs(b.A[0]) - W / 2) < 1e-6 && Math.abs(Math.abs(b.A[2]) - D / 2) < 1e-6 ? 'a corner post' : 'a post';
  if (b.upright) return 'a post';
  if (b.level) {
    // (a beam stands by its ends on other boards: it is what stands on a toe joint)
    const toe = hubs && hubs.some((h) => h.items.some((it) => it.kind === 'toe' && it.toeEnd === b.i));
    return toe ? 'a beam' : 'a crosspiece';
  }
  // a slanting board: a brace (from post to post, or any long one), a knee brace (short: it props a post against a
  // crosspiece), or a leaning board (an end free in the air, or resting on nothing but the ground)
  if (hubs && boards) {
    const at = (t) => hubs.filter((h) => h.items.some((it) => it.b === b.i && Math.abs(it.t - t) < TOL));
    const others = (hs, f) => new Set(hs.flatMap((h) => h.items.filter((it) => it.b !== b.i && f(boards[it.b])).map((it) => it.b)));
    const h0 = at(0), h1 = at(b.L);
    const p0 = others(h0, (o) => o.upright), p1 = others(h1, (o) => o.upright);
    const n0 = others(h0, () => true), n1 = others(h1, () => true);
    if (!n0.size || !n1.size) return 'a leaning board';
    if (p0.size && p1.size && [...p1].some((x) => !p0.has(x))) return 'a brace';
    if (b.L > 4) return 'a brace';
    return (p0.size && others(h1, (o) => o.level).size) || (p1.size && others(h0, (o) => o.level).size) ? 'a knee brace' : 'a brace';
  }
  if (b.L > 4) return 'a brace';
  // (no joints to look at: by its reach, as v2 did: one that spans its wall is a brace)
  const span = Math.abs(b.n[0]) > 0.9 ? D : W, reach = Math.hypot(b.B[0] - b.A[0], b.B[2] - b.A[2]);
  return reach < span - 0.25 ? 'a knee brace' : 'a brace';
}
// a board's name in words, as the test names it ("a corner post", "a beam", "a knee brace"...), from the joints it has in
// that tower (a board not in the tower: by its shape alone)
export function boardRole(tower, board) {
  const W = tower.W, D = tower.D ?? tower.W, bs = prepBoards(tower), me = bs.find((b) => b.id === board.id);
  if (!me) { const one = prepBoards({ boards: [board] }); return one.length ? roleOf(one[0], W, D, null) : 'a board'; }
  const hubs = findHubs(bs, W, D, []); classify(bs, hubs);
  return roleOf(me, W, D, hubs, bs);
}
// a plain sentence for what gave way
function describe(M, it) {
  const b = it.b !== undefined ? M.boards[it.b] : null, role = b ? roleOf(b, M.W, M.D, M.hubs, M.boards) : '';
  switch (it.type) {
    case 'board': return role + (it.buckle ? ' buckled under the squeeze' : ' snapped');
    case 'joint':
      if (it.kind === 'stone') return b.post ? 'a post tore loose from its footing' : role + ' tore loose from its footing stone';
      if (it.kind === 'dirt') return 'the foot of ' + role.replace(/^an? /, 'a ') + (it.pull > it.force ? ' lifted off ' : ' slid on ') + (it.onStone ? 'its stone' : 'the bare ground');
      if (it.kind === 'butt') return 'two boards butted end to end pulled apart';
      if (it.kind === 'toe') {
        // (b is the carrier; the board standing on it is the one whose toe-nails pulled)
        const e = M.boards[it.toeEnd], er = roleOf(e, M.W, M.D, M.hubs, M.boards);
        return e.upright ? `${er} standing on ${role} pulled its toe-nails out` : `the end of ${er} resting on ${role} pulled its toe-nails out`;
      }
      return role === 'a knee brace' ? 'the nails in a knee brace pulled out' : 'the nails at a joint pulled out';
    case 'drift': {
      // (knee braces only count when they lie inside the storey that racked, both ends between its floors, in a wall
      // through the post that leaned: the braces of the storey above start on this one's top floor and are not its own)
      const knees = M.boards.some((o) => !o.upright && !o.level && o.lo >= it.y0 - 0.3 && o.hi <= it.y1 + 0.3 && sharePlane(o, b) && roleOf(o, M.W, M.D, M.hubs, M.boards) === 'a knee brace');
      return knees ? 'the knee braces could not hold it square: the posts bent and it racked over' : 'the square racked: it folded over sideways';
    }
    case 'top': return (b.post ? 'a post' : 'a board') + ' stood with nothing holding its top, and the wind bent it over';
    case 'tip': return 'the wind tipped the whole tower over: the stones on the windward side lifted';
    case 'loose': return role + ' had nothing holding it still, and came loose';
    default: return 'something gave way';
  }
}
const KIND = { board: (it) => (it.buckle ? 'buckle' : 'snap'), joint: (it) => (it.kind === 'butt' ? 'butt' : it.kind === 'stone' || it.kind === 'dirt' ? 'footing' : 'nails'), drift: () => 'rack', top: () => 'bend', tip: () => 'tip', loose: () => 'loose' };

// ── the standing tower, as the test goes ────────────────────────────────────────────────────────────────────────────
// state: { W, D, boards (the board objects still standing), cuts ([{ id, P }]: nails pulled out) }. model() builds (or
// reuses) the frame of what stands; settle() drops what no longer reaches the ground.
// (A board lying on the ground, both ends down, is already as low as it can go: it takes no part in the frame and never
// falls. It stays in what stands.)
const lyingOn = (b) => b.a.Y <= TOL && b.b.Y <= TOL;
const upOf = (state) => state.boards.filter((b) => !lyingOn(b));
function modelOf(state) {
  if (state.M) return state.M;
  const boards = prepBoards({ boards: upOf(state) });
  const hubs = findHubs(boards, state.W, state.D, state.cuts);
  classify(boards, hubs);
  // nails that twisted loose earlier: that board turns freely about that axis at that joint (a hinge)
  if (state.hinges && state.hinges.length) {
    for (const h of hubs) for (const it of h.items) {
      const id = boards[it.b].id, axes = state.hinges.filter((x) => x.id === id && dist(x.P, h.P) < MERGE).map((x) => x.axis);
      if (axes.length) it.hinges = axes;
    }
  }
  state.M = buildModel(state.W, state.D, boards, hubs);
  state.models++;
  return state.M;
}
// everything that no longer reaches a stone (or the ground) through its joints falls: returns the ids that fell
function settle(state) {
  const up = upOf(state), boards = prepBoards({ boards: up }), hubs = findHubs(boards, state.W, state.D, state.cuts);
  const keep = groundedSet(boards, hubs), gone = boards.filter((b, i) => !keep.has(i)).map((b) => b.id);
  // (and any board too short to be a board)
  const ids = new Set(boards.map((b) => b.id));
  for (const b of up) if (!ids.has(b.id)) gone.push(b.id);
  if (gone.length) remove(state, gone);
  return gone;
}
function remove(state, ids) {
  const s = new Set(ids);
  state.boards = state.boards.filter((b) => !s.has(b.id));
  state.M = null;
}
// what gives when the worst part is past its limit: takes it away, then what falls with it. Returns the event.
function giveWay(state, M, chk, w) {
  // lapped nails that gave mostly by twisting about the nail (not sliding or drawing out) work loose but stay in: that
  // board still hangs at the joint and bears there, and turns freely about the nail (a hinge). Only a second overload,
  // sliding or pulling, frees it from that joint.
  const hinge = w.type === 'joint' && w.kind === 'face' && w.axis && w.parts && w.parts[2] >= Math.max(w.parts[0], w.parts[1]);
  const kind = KIND[w.type](w), text = hinge ? hingeWords(M, w) : describe(M, w);
  const b = w.b !== undefined ? M.boards[w.b] : null;
  let broke = [], out = [];
  if (w.type === 'board' || w.type === 'top') { broke = [b.id]; out = [b.id]; }
  else if (hinge) {
    broke = [b.id];
    (state.hinges || (state.hinges = [])).push({ id: b.id, P: [...M.hubs[w.hub].P], axis: [...w.axis] }); state.M = null;
  }
  else if (w.type === 'joint') {
    // nails pulled out: that board is freed from that joint (a toe joint: the carrier is freed from what stood on it,
    // and the board that stood there is the one whose toe-nails pulled)
    broke = [w.kind === 'toe' && w.toeEnd !== undefined ? M.boards[w.toeEnd].id : b.id];
    state.cuts.push({ id: b.id, P: [...M.hubs[w.hub].P] }); state.M = null;
  }
  else if (w.type === 'drift') {
    // the storey that racked: every post leaning past the limit at about that height comes out
    const set = new Set([b.id]);
    for (const it of chk.items) if (it.type === 'drift' && it.util > 1 && Math.min(it.y1, w.y1) - Math.max(it.y0, w.y0) > 0.3) set.add(it.id);
    broke = [...set]; out = [...set];
  } else if (w.type === 'tip') { out = upOf(state).map((x) => x.id); }
  else if (w.type === 'loose') { const set = new Set(chk.items.filter((it) => it.type === 'loose').map((it) => it.id)); broke = [...set]; out = [...set]; }
  if (out.length) remove(state, out);
  const fell = [...out, ...settle(state)];
  // where (and in which plane): a board's own plane; for a rack, the upright plane it leaned in
  let plane = b ? b.key : null;
  if (w.type === 'drift' && b) plane = Math.abs(w.dir[0]) >= Math.abs(w.dir[1]) ? 'Z:' + r3(b.A[2]) : 'X:' + r3(b.A[0]);
  const at = { X: w.P[0], Y: w.P[1], Z: w.P[2] };
  const ev = { kind, text, at, plane, broke, fell, util: +w.util.toFixed(3) };
  if (hinge) ev.hinge = true;
  // (a board's foot sliding on the dirt with nothing coming down is worth a word, not a failure)
  if (w.type === 'joint' && w.kind === 'dirt' && !fell.length) ev.note = true;
  return ev;
}
// the words for nails that twisted loose and left a hinge
function hingeWords(M, w) {
  const b = M.boards[w.b], role = roleOf(b, M.W, M.D, M.hubs, M.boards);
  return `the nails holding ${role} twisted loose at a joint: it hangs on, but turns freely there now`;
}

// ── the wind test ───────────────────────────────────────────────────────────────────────────────────────────────────
// First, calm air: the tower under its own weight alone. A part that can't even hold itself up (a tier whose posts stand
// on nothing, with no beam under them) gives way as the first breeze starts, before any wind blows: those events come
// first in the first gust, marked calm: true, and the gust carries the calm state they started from (gust.calm: { strain,
// joints, move }). Then, for each stage, the wind from each side in turn: solve; while the worst part is past its limit,
// it gives way (and what it held up falls), and the rest is solved again in the same wind. What fell is gone for the
// later winds. If something gave way in a stage, the winds of that stage already tried on the tower as it was are tried
// again on what is left (a brace left leaning alone after a collapse in the north wind still has to face the west wind
// it met earlier, while it was nailed into a tower). See the CONTRACT in DESIGN.md for what comes back.
export function windTest(tower, { stages = STAGES } = {}) {
  const t0 = now();
  const W = tower.W, D = tower.D ?? tower.W;
  const state = { W, D, boards: tower.boards.map((b) => ({ ...b, a: { ...b.a }, b: { ...b.b } })), cuts: [], hinges: [], M: null, models: 0 };
  const gusts = [];
  let any = false, solves = 0;
  // boards that touch nothing reaching the ground come down as the first breeze rises
  const loose = settle(state);
  // The posts standing on nothing as built (a tier post with no beam under its foot): any event that brings one of
  // them down carries them (nofoot), so the words can name the support that was missing.
  let nofoot = [];
  const footless = (ev) => {
    if (!nofoot.length) return [];
    const gone = new Set([...ev.fell, ...ev.broke]), bare = nofoot.filter((id) => gone.has(id));
    if (bare.length) ev.nofoot = bare;
    return bare;
  };
  // calm air: what can't hold up its own weight goes before the wind (the weight alone: wind 0 at 0 mph)
  const calm = [];
  let calmFirst = null, calmStrain = null;
  if (upOf(state).length) {
    let M = modelOf(state), chk = checkAll(M, solveWind(M, 0, 0)); solves++;
    calmFirst = lying(state, { strain: { ...chk.strain }, joints: chk.joints, move: { ...chk.move } });
    calmStrain = { ...chk.strain };
    nofoot = standsOnNothing(M);
    let named = false, guard = 0;
    while (chk && chk.worst && chk.worst.util > 1 && guard++ < 100) {
      const ev = giveWay(state, M, chk, chk.worst);
      ev.calm = true;
      // (in still air nothing is blown: a top that leans over goes under its own weight)
      ev.text = ev.text.replace(/, and the wind bent it over$/, ', and it fell over under its own weight');
      // (named by what it stood on: nothing. The event that brings those posts down says so.)
      if (nofoot.length) {
        const bare = footless(ev);
        if (bare.length && !named) {
          named = true;
          ev.text = bare.length > 1 ? `${bare.length} posts stood on nothing, with no beam under their feet, and could not hold up even their own weight`
            : 'a post stood on nothing, with no beam under its foot, and could not hold up even its own weight';
        }
      }
      if (upOf(state).length) { M = modelOf(state); chk = checkAll(M, solveWind(M, 0, 0)); solves++; }
      else chk = null;
      ev.after = lying(state, chk ? { strain: chk.strain, joints: chk.joints, move: chk.move } : { strain: {}, joints: [], move: {} });
      calm.push(ev);
    }
  }
  const summary = [];
  let shape = 0;                                // how many times the tower has changed (anything gave way)
  stages.forEach((st, si) => {
    const shown = [];
    let best = null, gave = false;
    // the winds to try, in order; a wind tried on a tower that has changed since is tried again
    const queue = WINDS.map((_, k) => k), triedOn = WINDS.map(() => -1);
    let tries = 0;
    while (queue.length && tries++ < 16) {
      const k = queue.shift(), wd = WINDS[k];
      const first = si === 0 && tries === 1, start = first && (loose.length || calm.length);
      if (!upOf(state).length && !start) continue;
      const gust = { stage: si, name: st.name, mph: st.mph, from: wd.from, dir: { ...wd.dir }, strain: {}, joints: [], move: {}, events: [] };
      let chk = null;
      if (upOf(state).length) { const M = modelOf(state); chk = checkAll(M, solveWind(M, k, st.mph)); solves++; }
      // (the gust gets its own copies: a loose board's strain and move are written into the gust below, never into its
      // event's `after`, which is the same wind without it)
      if (chk) { gust.strain = { ...chk.strain }; gust.joints = chk.joints; gust.move = { ...chk.move }; gust.peak = peakOf(chk); }
      else gust.peak = { util: 0, kind: null, text: '' };
      lying(state, gust);
      if (first && loose.length) {
        for (const id of loose) { gust.strain[id] = 1; gust.move[id] = [[0, 0, 0], [0, 0, 0]]; }
        const lb = tower.boards.find((b) => b.id === loose[0]);
        gust.events.push({ kind: 'loose', text: loose.length > 1 ? 'some boards were not nailed to anything that reaches the ground, and fell' : 'a board was not nailed to anything that reaches the ground, and fell',
          at: lb ? { X: (lb.a.X + lb.b.X) / 2, Y: (lb.a.Y + lb.b.Y) / 2, Z: (lb.a.Z + lb.b.Z) / 2 } : { X: 0, Y: 0, Z: 0 }, plane: lb ? planeKeyOf(lb) : null,
          broke: [...loose], fell: [...loose], util: 1, calm: true,
          after: lying(state, calm.length && calmFirst ? { strain: { ...calmFirst.strain }, joints: calmFirst.joints, move: { ...calmFirst.move } }
            : chk ? { strain: { ...chk.strain }, joints: chk.joints, move: { ...chk.move } } : { strain: {}, joints: [], move: {} }) });
      }
      if (first && calm.length) {
        // (the boards that gave way in calm air stood as this gust started: their strain is what the weight did to them)
        for (const ev of calm) for (const id of ev.fell) { gust.strain[id] = Math.max(calmStrain[id] ?? 1, ev.broke.includes(id) ? 1 : 0); gust.move[id] = calmFirst.move[id] || [[0, 0, 0], [0, 0, 0]]; }
        gust.calm = calmFirst;
        gust.events.push(...calm);
        // (the last of them settles into this wind's own numbers on what is left, as the wind rises)
        const last = calm[calm.length - 1];
        last.after = lying(state, chk ? { strain: { ...chk.strain }, joints: chk.joints, move: { ...chk.move } } : { strain: {}, joints: [], move: {} });
      }
      let guard = 0;
      while (chk && chk.worst && chk.worst.util > 1 && guard++ < 200) {
        const M = modelOf(state), ev = giveWay(state, M, chk, chk.worst);
        footless(ev);
        if (upOf(state).length) { const M2 = modelOf(state); chk = checkAll(M2, solveWind(M2, k, st.mph)); solves++; }
        else chk = null;
        ev.after = lying(state, chk ? { strain: chk.strain, joints: chk.joints, move: chk.move } : { strain: {}, joints: [], move: {} });
        gust.events.push(ev);
      }
      // (a gust where only a note happened, a foot sliding on the dirt with nothing coming down, is shown, but the tower
      // still stood)
      if (gust.events.length) { shown.push(gust); shape++; if (gust.events.some((e) => !e.note)) { any = true; gave = true; } }
      if (!best || gust.peak.util > best.peak.util) best = gust;
      triedOn[k] = shape;
      // (the winds of this stage that met the tower before it changed meet it again)
      if (upOf(state).length) WINDS.forEach((_, j) => { if (triedOn[j] >= 0 && triedOn[j] < shape && !queue.includes(j)) queue.push(j); });
    }
    if (shown.length) gusts.push(...shown); else if (best) gusts.push(best);
    summary.push(best ? { name: st.name, mph: st.mph, gave, peak: best.peak.util, kind: best.peak.kind, from: best.from } : { name: st.name, mph: st.mph, gave: false, peak: null, kind: null, from: null, empty: true });
  });
  const standing = { W, D, boards: state.boards.map((b) => ({ ...b, a: { ...b.a }, b: { ...b.b } })) };
  const height = state.boards.reduce((h, b) => Math.max(h, b.a.Y, b.b.Y), 0);
  // (beyond the CONTRACT: stages, a line per stage: did anything give, and the most any part was used as each wind rose
  // (peak, 1 = at its limit), which part (kind) and from where; solves, models: how many sums it took; cuts: nails that
  // pulled out of boards still standing; hinges: nails that twisted loose and turn freely now. An event may carry
  // note: true (a foot slid on the dirt and nothing came down: the tower still stood), hinge: true, or calm: true (it
  // gave way under the tower's own weight as the first breeze started, before any wind). nofoot: the posts among what
  // gave way or fell that stood on nothing as built (no beam under their feet), in any event. A gust may come more than once from one side in a stage: tried again after something
  // gave way in another wind.)
  return { gusts, height, standing, stood: !any, ms: Math.round((now() - t0) * 10) / 10, stages: summary, solves, models: state.models,
    cuts: state.cuts.map((c) => ({ id: c.id, X: c.P[0], Y: c.P[1], Z: c.P[2] })), hinges: state.hinges.map((c) => ({ id: c.id, X: c.P[0], Y: c.P[1], Z: c.P[2] })) };
}
// The posts standing on nothing: boards standing up (within 8 degrees of straight up; else, if there are none, any
// rising at 45 degrees or steeper) whose foot is up off the ground with nothing under it: no joint there at all, or only
// other boards rising from that same spot (a post and the braces at its foot, with no beam under the lot). A board
// passing through the spot (a beam, a crosspiece), ending there from below, or lying level there carries it. Their ids.
function standsOnNothing(M) {
  const rising = (o, t) => !o.level && Math.abs(ptAt(o, t)[1] - o.lo) < TOL;
  const bare = (b, bi) => {
    if (uprightOf(b) < 0.5 || b.lo <= TOL) return false;
    const tFoot = b.A[1] <= b.B[1] ? 0 : b.L;
    const h = M.hubs.find((x) => x.items.some((it) => it.b === bi && Math.abs(it.t - tFoot) < TOL));
    return !h || (!h.ground && h.items.every((it) => it.b === bi || rising(M.boards[it.b], it.t)));
  };
  const all = M.boards.filter((b, bi) => bare(b, bi));
  const posts = all.filter((b) => b.upright);
  return (posts.length ? posts : all).map((b) => b.id);
}
// (boards lying on the ground: no strain, no movement)
function lying(state, part) {
  for (const b of state.boards) if (lyingOn(b)) { part.strain[b.id] = 0; part.move[b.id] = [[0, 0, 0], [0, 0, 0]]; }
  return part;
}
function peakOf(chk) {
  const w = chk.worst;
  if (!w) return { util: 0, kind: null, text: '' };
  return { util: +w.util.toFixed(3), kind: KIND[w.type](w), id: w.id ?? null };
}

// The wind's push on each board of a tower for one wind (k: index into WINDS) at one speed, every board whether nailed
// or not: { per: { [boardId]: { along, force: [X, Y, Z] } }, total (pounds along the wind), force (the whole push,
// [X, Y, Z]) }. along: the push in the wind's direction; force: the push as it acts, square across the board (a board
// leaning into the wind is lifted as well as pushed). For the page to show what the wind does, and for the rigs.
export function windOn(tower, k, mph) {
  const boards = prepBoards(tower), dv = WINDS[k].dir, v = [dv.X, 0, dv.Z], shade = shelterFor(boards, v), q = mph * mph;
  const per = {}, sum = [0, 0, 0];
  let total = 0;
  for (const b of boards) {
    const [s2, vp] = across(b, v), f3 = [0, 0, 0];
    if (s2) {
      const wide = seenWidth(b, vp), m = Math.max(2, Math.ceil(b.L / 0.5)), ds = b.L / m;
      for (let i = 0; i < m; i++) {
        const P = ptAt(b, (i + 0.5) * ds), f = pressure(mph, P[1]) * DRAG * wide * s2 * shade(P, b.i) * ds;
        for (let a = 0; a < 3; a++) f3[a] += vp[a] * f;
      }
    }
    const along = dot(f3, v);
    per[b.id] = { along, force: f3 };
    total += along; for (let a = 0; a < 3; a++) sum[a] += f3[a];
  }
  return { per, total, force: sum, q };
}

// for the rigs and tests only (the page should not need these)
export const internals = { prepBoards, findHubs, classify, groundedSet, buildModel, solveEnv, factor, solveWind, checkAll, windOf, shelterFor, across, seenWidth, localK, toWorld, describe, roleOf, modelOf, settle, nailUse, touch3, rcm, makeEnvelope };
