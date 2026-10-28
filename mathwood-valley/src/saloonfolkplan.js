// THE SALOON CROWD'S PLAN: the plain parts of the townsfolk in the saloon (src/saloonfolk.js), with no three.js in them,
// so the tests can read them: the dials, how many are in by the quality tier, which seat or spot a newcomer takes, and
// the ways they walk in the hall (between the aisles' points, round the tables, the bar, the stage, the stairs, never
// through the places kept clear). Everything here is in the saloon's own centred frame (labs/buildings/saloon.js
// anchors.crowd: { seats, stands, nodes, doors, obstacles, keep, stage, walls, floor }).
//
//   SALOON_FOLK                 the dials
//   crowdMost(tier)             how many in the hall at most by a tier's name (the governor's 'saloon' dial overrides)
//   spotsOf(crowd)              every seat and standing spot that can be walked to: [{ i, kind ('chair' | 'stool' | 'stand'), x, z, rot, h,
//                               view (how square it faces the stage, -1..1), near (m to the stage), at (where it is
//                               walked to and from: beside a chair, behind a stool, the spot itself) }]
//   pickSpot(spots, taken, rand) -> a spot nobody has, likelier the better it looks at the stage (or null)
//   makeNav(crowd)              the walking: { clear(a, b) (a straight walk from a to b misses everything in the way),
//                               path(from, to) -> [{ x, z }, ...] (from `from` to `to` through the aisles' points; the
//                               first point is `from`, the last `to`; null when there is no way) }
//   faceTo(from, to)            three's rotation.y that faces from one point to the other
//   lookAt(rot, from, to, most) -> radians to turn the head from facing `rot` toward `to` (within +-most)
export const SALOON_FOLK = {
  most: { potato: 2, normal: 4, gaming: 6 },   // the most in the hall by tier (the governor's 'saloon' dial, live)
  stay: [150, 420],      // s a person stays (then walks out)
  gap: [5, 16],          // s between one arriving and the next while there is room
  again: 45,             // s before someone who walked out may be back in
  first: 0.75,           // the share of the most already there when the saloon is first come to (placed unseen)
  walk: [1.0, 1.2],      // m/s walking in the hall
  sit: 0.65,             // s to sit down or get up (sliding into the seat while the clip turns)
  fadeIn: 0.55,          // s fading in or out at a doorway
  body: 0.22,            // m: a walker's half width (kept off whatever is in the way)
  wait: 0.85,            // m: someone stops for the player this near ahead of them ...
  waitMost: 2.5,         // ... for at most this long
  turn: 0.6,             // radians a seated person turns on the seat toward the stage (at most)
  head: 1.05,            // radians the head turns toward the band (at most)
  make: 45,              // m from the saloon's middle within which their bodies are made (before the inside loads)
  // how a spot is liked: its view of the stage (facing it), nearness to it, standing less liked than sitting
  like: { view: 1.6, near: 0.08, stand: 0.6, stool: 0.85 },
  // the person's own clips for each kind of spot (src/saloonfolk.js; models/people/clips_crowd_*.glb)
  clips: { chair: ['Sit_Listen', 'Sit_Clap'], stool: ['Stool_Bar', 'Stool_Clap'], stand: ['Stand_Listen', 'Stand_Clap'] },
  shoutAsk: 0.35,        // the chance someone calls out when the band is asked for a song
  asks: ['Yeehaw!', 'Good one!', 'Oh, I love this one!', 'Whoo!'],
};

export const crowdMost = (tier) => SALOON_FOLK.most[tier] ?? SALOON_FOLK.most.normal;

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const faceTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
export function lookAt(rot, from, to, most = SALOON_FOLK.head) { return Math.max(-most, Math.min(most, wrap(faceTo(from, to) - rot))); }

export function spotsOf(crowd) {
  const st = { x: crowd.stage[0], z: crowd.stage[1] }, nav = makeNav(crowd), out = [];
  const door = crowd.doors.length ? nav.nodes[crowd.doors[0].node] : null;
  const all = [...crowd.seats, ...crowd.stands];
  all.forEach((s, i) => {
    const d = Math.hypot(st.x - s.x, st.z - s.z), view = Math.cos(wrap(faceTo(s, st) - s.rot));
    let at = { x: s.x, z: s.z };
    if (s.kind === 'chair') {
      // beside the chair (its left or right, a little back), whichever is clear and can be walked to
      const f = [Math.sin(s.rot), Math.cos(s.rot)], side = [f[1], -f[0]];
      const tries = [[0.52, -0.12], [-0.52, -0.12], [0.45, -0.4], [-0.45, -0.4], [0, -0.55]].map(([a, b]) => ({ x: s.x + side[0] * a + f[0] * b, z: s.z + side[1] * a + f[1] * b }));
      at = tries.find((p) => nav.free(p, s) && nav.reach(p)) || tries[0];
    } else if (s.kind === 'stool') {
      const f = [Math.sin(s.rot), Math.cos(s.rot)];   // (facing the bar: the way in is behind)
      at = { x: s.x - f[0] * 0.5, z: s.z - f[1] * 0.5 };
    }
    // (a spot that can't be walked to from the doors is left out: the table in the corner behind the barrels)
    if (door && !nav.path(door, at)) return;
    out.push({ i, kind: s.kind, x: s.x, z: s.z, rot: s.rot, h: s.h, view: +view.toFixed(3), near: +d.toFixed(2), at, table: s.table || null });
  });
  return out;
}

export function pickSpot(spots, taken, rand = Math.random) {
  const L = SALOON_FOLK.like, w = spots.map((s) => {
    if (taken.has(s.i)) return 0;
    let v = Math.exp(L.view * s.view) * Math.exp(-L.near * s.near);
    if (s.kind === 'stand') v *= L.stand; else if (s.kind === 'stool') v *= L.stool;
    return v;
  });
  let sum = 0; for (const v of w) sum += v;
  if (!(sum > 0)) return null;
  let x = rand() * sum;
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0 && w[i] > 0) return spots[i]; }
  return spots.find((s, i) => w[i] > 0) || null;
}

// ── WALKING ──────────────────────────────────────────────────────────────────────────────────────────────────────
function segCircle(a, b, c, r) {
  const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz || 1e-9;
  const u = Math.max(0, Math.min(1, ((c[0] - a.x) * dx + (c[1] - a.z) * dz) / L));
  return Math.hypot(a.x + dx * u - c[0], a.z + dz * u - c[1]) < r;
}
function segRect(a, b, R, pad) {
  const x0 = Math.min(R[0], R[2]) - pad, x1 = Math.max(R[0], R[2]) + pad, z0 = Math.min(R[1], R[3]) - pad, z1 = Math.max(R[1], R[3]) + pad;
  // (sampled along the segment: the rects are big and the walks short)
  const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1));
  for (let k = 0; k <= n; k++) { const u = k / n, x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u; if (x > x0 && x < x1 && z > z0 && z < z1) return true; }
  return false;
}
const KEEP_WALK = 0.7;   // (a walk keeps this share of a kept place's reach from its middle)
export function makeNav(crowd) {
  const B = SALOON_FOLK.body, O = crowd.obstacles, K = crowd.keep, nodes = crowd.nodes.map(([x, z]) => ({ x, z }));
  const nearC = (c, p) => Math.hypot(c[0] - p.x, c[1] - p.z) < 0.05;
  // a point stood on is free of everything in the way (but `own`: the seat being sat on)
  const free = (p, own = null) => !O.circles.some((c) => !(own && nearC(c, own)) && Math.hypot(c[0] - p.x, c[1] - p.z) < c[2] + B)
    && !O.rects.some((R) => segRect(p, p, R, B));
  // a straight walk (each end may be on what it is getting to: the seat's own chair); the places kept clear are walked
  // round (well clear of their middles), but for the doorways' ways in, which are walked through
  const clear = (a, b, own = null) => !O.circles.some((c) => !(own && nearC(c, own)) && segCircle(a, b, c, c[2] + B)) && !O.rects.some((R) => segRect(a, b, R, B))
    && !K.circles.some((c) => !c[3] && segCircle(a, b, c, c[2] * KEEP_WALK));
  const edges = nodes.map((n, i) => nodes.map((m, j) => (i !== j && clear(n, m) ? Math.hypot(n.x - m.x, n.z - m.z) : null)));
  const reach = (p) => nodes.some((n) => clear(n, p));
  function path(from, to, own = null) {
    if (clear(from, to, own)) return [from, to];
    // Dijkstra over the nodes, from those `from` can walk straight to, to those that can reach `to`
    const n = nodes.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
    for (let i = 0; i < n; i++) if (clear(from, nodes[i])) dist[i] = Math.hypot(from.x - nodes[i].x, from.z - nodes[i].z);
    const ends = nodes.map((m) => (clear(m, to, own) ? Math.hypot(m.x - to.x, m.z - to.z) : null));
    let best = -1, bestD = Infinity;
    for (;;) {
      let u = -1; for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0) break;
      done[u] = true;
      if (ends[u] != null && dist[u] + ends[u] < bestD) { bestD = dist[u] + ends[u]; best = u; }
      for (let v = 0; v < n; v++) if (edges[u][v] != null && dist[u] + edges[u][v] < dist[v]) { dist[v] = dist[u] + edges[u][v]; prev[v] = u; }
    }
    if (best < 0) return null;
    const pts = [to]; for (let u = best; u >= 0; u = prev[u]) pts.push(nodes[u]);
    pts.push(from);
    return pts.reverse();
  }
  return { nodes, edges, clear, free, reach, path };
}
