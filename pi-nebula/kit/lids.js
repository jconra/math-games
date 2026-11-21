// EYELIDS THAT CLOSE: the crew kit's heads shut their eyes while they sleep and blink while awake (2026-11-20; the
// game's maker, asked whether the stasis pods' sleepers should keep their eyes open: "Give our crew eyelids that close
// (for everyone, in the Crew Lab), and shut them while they sleep", and "Shut would be better if we can manage it. Then
// we could probably make them blink too").
//
// THE LIDS ARE THE HEAD'S OWN. Every Tripo head (t1 to t11, Crew 1, the Captain) has real eyes (kit/crew.js REAL EYES: a
// ball on each eye bone) behind lids that rest on the balls, as the game's maker's heads were made and built. Nothing is
// cut or added: to shut an eye, the head's own upper lid turns down over the ball about the ball's own centre (its
// level axis, as a real lid does) to meet the lower lid, which comes up a little; the skin over the upper lid follows
// less and less up toward the brow, and none of the face beyond moves. As it turns, the lid lies down toward the ball
// (`flat` of the way to `push` off it: a thick fold stretches thinner over the eye, and the shut lid stays clear of the
// clear layer's bulge over the iris), and the socket's own cup behind the lids stays inside the ball. Its own paint (this
// person's skin tone and freckles) rides with it; shut, the upper lid's edge is drawn as the lashes' line and the lid over
// it in its skin's own colour (its paint, the open lid's shadow and liner, would lie stretched over it), and it is shaded
// as lying round the ball. Open, every point is exactly where the head has it: the head as made. The head's shadow is cast
// as its lids lie.
//   How far each point turns is worked out once a head, from the head itself (lidLines, lidTurns): the opening seen
// from the front (the head's triangles drawn into a small depth picture round each eye, against the ball: where the ball
// is in front, the eye is open), its top and bottom edge column by column as angles round the ball's level axis, and
// from them each point's turn when shut: the upper lid's points down to the meeting line (and `past` it, tucked under the
// lower lid's edge), the lower lid's up to it, faded by how far over (or under) its lid line a point is and how far in
// front of the ball. Toward each corner the opening narrows to nothing, and so does the turn. Drawn by the head's own
// shader (kit/crew.js crewMaterial, CREW_LIDS): one number a person says how shut (0 open, 1 shut).
//
// WHEN (makeLids): a person is awake and blinks now and then, or asleep with their eyes shut; or 'open' (awake, never
// blinking: for still pictures held open).
//   - A BLINK: shut in BLINK.close seconds, open again in BLINK.open (0.06 + 0.09: about 0.15 s, as a person's), every 2 to
//     6 seconds: each person their own pace (a mean BLINK.own apart, drawn once), each wait a little different from the
//     last (BLINK.vary either side of their own mean, never outside BLINK.every).
//   - ASLEEP: the lids close over BLINK.sleep seconds (falling asleep) and stay shut; waking, they open over BLINK.wake.
//   - A STEP LONGER THAN A FRAME (BLINK.jump: a pose laid on at once, a picture taken, a person not drawn for a while):
//     the eyes are open at its end (or shut, asleep), never caught in a blink; the next blink a fresh wait away.
//
//   import { LIDS, BLINK, makeLids, blinkShut, lidLines, lidTurns, eyesOf } from './lids.js'   (plain numbers: tested in Node)
//   const L = makeLids(rand)  L.mode ('blink' | 'open' | 'shut'), L.shut (0..1 now), L.sleep (0..1: how far asleep, no blink
//                             in it: an android's face dark), L.set(mode, { now }) (now: at once),
//                             L.update(dt) -> whether L.shut changed, L.next() -> seconds until the lids next move
//                             (0: moving now; Infinity: not till something changes), L.pace (this person's mean wait, s)
//   blinkShut(t)              how shut a blink is t seconds after it starts (0 open, 1 shut; 0 after BLINK.close + open)
//   eyesOf(P)                 two balls' points (x, y, z flat, the head's frame) -> [{ c: [x, y, z], r }, ...] left (+x) first
//   lidLines(P, I, eye)       the head's points and triangles (the head's frame: x to their left, y up, z forward) and
//                             one eye -> { x0, x1 (the corners, metres across from the ball's centre), step, up, lo
//                             (each column's top and bottom edge: angles round the ball's level axis, up from straight
//                             ahead, NaN where shut), open (pixels open), px } or null when no opening is found
//   lidTurns(P, eyes, lines)  -> Float32Array, 4 a point: [which eye (1 left, -1 right, 0 none), its turn shut (radians:
//                             + up, - down), how far it lies down onto the ball shut (0..1: to `push` off it; never the
//                             socket's cup, inside the ball), its paint shut (minus: the lashes' line, that dark; plus:
//                             the upper lid's skin in its own colour, that much; 0 as painted)]

export const LIDS = {
  px: 1 / 48,            // the depth picture's pixel, in balls' radii
  rim: 0.0005,           // open where nothing lies further in front of the ball than this (metres: the socket's cup comes
                         // a little out of the ball at the lids' edge, where it turns in; the lids lie further out)
  meet: 0.18,            // where the lids meet, shut: this share of the opening up from the lower lid's edge
  past: 0.07,            // the upper lid's edge goes this far past the meeting line, shut (radians: about 4 degrees), over
                         // the lower lid's edge
  up: [0.3, 0.95],       // the upper lid's points turn fully to this far over its edge (radians), none past the second
  low: [0.1, 0.42],      // the lower lid's points likewise under its edge
  fold: [0.05, 0.18, 0.01, 0.014], // (the upper lid within the first of this over its edge (radians) turns whole, its fold
                         // standing up to the third in front of the ball (metres; none past the fourth: a brow right
                         // over the eye); past the second over its edge, `out` holds)
  out: [0.0045, 0.0095], // and fully to this far in front of the ball (metres), none past the second (the brow, the cheek)
  push: [0.0014, 0.0003], // shut, the upper lid and the lower lie down toward this far off the ball (metres; the clear
                         // layer bulges 0.85 mm over the iris; the upper lid lies over the lower's edge)
  flat: 0.5,             // shut, how far a turned point lies down onto the ball (1: to `push` off it)
  lash: [0, 0.07],       // shut, the upper lid's edge drawn as the lashes' line: dark at its edge, gone this far over it
                         // (radians)
  lay: [0.006, 0.01],    // (shut, the upper lid's side over the ball and within the first of this in front of it (metres)
                         // is shaded as lying round the ball, none past the second (the brow))
  brow: [0.01, 0.015],   // (and not the brow: none of the skin's colour this far in front of the ball (metres))
  skin: [0.04, 0.22],    // and the upper lid wears its skin's own colour from this far over its edge, fully by the
                         // second (the paint there, the lid's shadow and liner, is drawn for the lid open and folded up
                         // under the brow: shut, it would lie stretched dark over the whole lid)
  round: 0.95,           // shut, the lid's shading normal leans this far toward the way out from the ball's centre
  reach: 6,              // (the lean reaches out this many times further than the turn itself, so
                         // the skin stretched between the lid and the brow is shaded as the lid is)
  cup: 0.0006,           // (the socket's own cup, inside the ball behind the lids, is never pushed out through it: a point
                         // takes its push in full only from the ball's surface out, none from this far inside it)
  corner: 0.1,           // past each corner the turn fades to nothing over this share of the ball's radius
  smooth: 6,             // the edges' angles smoothed over this many columns either side
  // (for one head alone, its entry's `lids` in crew.json; none of these on any other head: as they were)
  deep: [0, 1],          // the opening takes in, further toward the nose than the second (in balls' radii from its
                         // centre), skin lying less than the first in front of the ball's centre (metres): the inner
                         // corner's pocket, on a head whose opening runs on past the ball, so the inner part of the upper
                         // lid comes down with the rest
  cover: 0,              // shut, the upper lid's skin colour over every point of it that turns, and this many rings of
                         // points round them (the brow, by `brow`, kept)
  relax: 0,              // the turns smoothed over the head's own triangles this many rounds (the lid itself, up to
                         // `fold`'s first over its edge, held): a fold with no sharp creases
};
// (seconds; every: the waits' range; own: each person's own mean wait drawn from this; vary: each wait this far either
// side of the person's own mean; first: the first blink at least this long after a person is made)
export const BLINK = { close: 0.06, open: 0.09, every: [2, 6], own: [3, 5], vary: 1, first: 1.2, sleep: 0.9, wake: 0.35, jump: 0.25 };

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// how shut a blink is, t seconds in: down quickly (eased in, as the lid falls), up a little slower (eased out)
export function blinkShut(t) {
  const c = BLINK.close, o = BLINK.open;
  if (!(t > 0) || t >= c + o) return 0;
  if (t < c) { const u = t / c; return Math.sin(u * Math.PI / 2) ** 2; }
  const u = (t - c) / o; return Math.cos(u * Math.PI / 2) ** 2;
}

export function makeLids(rand = Math.random) {
  const pace = BLINK.own[0] + rand() * (BLINK.own[1] - BLINK.own[0]);
  const wait = () => clamp(pace + (rand() * 2 - 1) * BLINK.vary, BLINK.every[0], BLINK.every[1]);
  // (rest: 0 awake .. 1 asleep, eased as it goes; blink: seconds into a blink, or -1; till: seconds to the next blink)
  const L = { mode: 'blink', shut: 0, sleep: 0, pace, rest: 0, blink: -1, till: Math.max(BLINK.first, wait() * rand()) };
  // (L.sleep: how far asleep, 0..1, eased as the lids are: no blink in it)
  const shutNow = () => { const r = L.rest * L.rest * (3 - 2 * L.rest); L.sleep = r; return Math.max(r, L.blink >= 0 ? blinkShut(L.blink) : 0); };
  L.set = (mode, { now = false } = {}) => {
    mode = mode === 'shut' || mode === 'open' ? mode : 'blink';
    if (mode !== L.mode) { L.mode = mode; if (mode !== 'blink') L.blink = -1; else if (L.till < BLINK.first) L.till = wait(); }
    if (now) { L.rest = mode === 'shut' ? 1 : 0; L.blink = -1; }
    const was = [L.shut, L.sleep], s = shutNow(); L.shut = s; return s !== was[0] || L.sleep !== was[1];
  };
  L.update = (dt) => {
    dt = +dt || 0; if (dt <= 0) return false;
    const was = L.shut, wasSleep = L.sleep;
    if (dt > BLINK.jump) {
      // (a step, not a frame: the lids where they come to rest, never caught in a blink)
      L.rest = L.mode === 'shut' ? 1 : 0; L.blink = -1; if (L.till <= dt) L.till = wait(); else L.till -= dt;
    } else {
      if (L.mode === 'shut') L.rest = Math.min(1, L.rest + dt / BLINK.sleep);
      else L.rest = Math.max(0, L.rest - dt / BLINK.wake);
      if (L.blink >= 0) { L.blink += dt; if (L.blink >= BLINK.close + BLINK.open) L.blink = -1; }
      if (L.mode === 'blink' && L.rest === 0 && L.blink < 0) { L.till -= dt; if (L.till <= 0) { L.blink = Math.min(-L.till, BLINK.close); L.till = wait(); } }
    }
    L.shut = shutNow();
    return L.shut !== was || L.sleep !== wasSleep;
  };
  L.next = () => {
    if (L.blink >= 0 || (L.mode === 'shut' ? L.rest < 1 : L.rest > 0)) return 0;
    return L.mode === 'blink' ? Math.max(0, L.till) : Infinity;
  };
  return L;
}

// two balls' points (the head's frame) -> each ball's centre and radius, the left one (+x) first (a sphere through each
// ball's points, by least squares: the balls are not whole spheres, so their box is not their middle)
export function eyesOf(P) {
  const n = P.length / 3; if (n < 8) return null;
  let mx = 0; for (let i = 0; i < n; i++) mx += P[i * 3] / n;
  const balls = [1, -1].map((s) => {
    // (x² + y² + z² = 2ax + 2by + 2cz + d, about the points' own mean for good numbers)
    const pts = []; for (let i = 0; i < n; i++) if ((P[i * 3] - mx) * s > 0) pts.push([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
    if (pts.length < 8) return null;
    const m0 = [0, 1, 2].map((k) => pts.reduce((q, p) => q + p[k], 0) / pts.length);
    const A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], B = [0, 0, 0, 0];
    for (const p of pts) {
      const x = p[0] - m0[0], y = p[1] - m0[1], z = p[2] - m0[2], row = [2 * x, 2 * y, 2 * z, 1], f = x * x + y * y + z * z;
      for (let a = 0; a < 4; a++) { B[a] += row[a] * f; for (let b = 0; b < 4; b++) A[a][b] += row[a] * row[b]; }
    }
    const q = solve4(A, B); if (!q) return null;
    const c = [q[0] + m0[0], q[1] + m0[1], q[2] + m0[2]], r = Math.sqrt(Math.max(0, q[3] + q[0] * q[0] + q[1] * q[1] + q[2] * q[2]));
    return r > 0 ? { c, r, side: s } : null;
  });
  return balls[0] && balls[1] ? balls : null;
}
function solve4(A, B) {
  const M = A.map((r, i) => [...r, B[i]]);
  for (let c = 0; c < 4; c++) {
    let p = c; for (let r = c + 1; r < 4; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-18) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < 4; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 5; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[4] / r[i]);
}

// THE OPENING, seen from the front: the head's triangles drawn into a depth picture round the eye (the front-most
// surface at each pixel), against the ball's own front; open where the ball is in front. The opening is the open
// pixels joined to the one straight in front of the ball's centre (or the nearest open one to it).
export function lidLines(P, I, eye, o = {}) {
  const K = { ...LIDS, ...o }, { c, r } = eye, s = r * K.px;
  const hw = 1.6 * r, hh = 1.35 * r, W = Math.ceil(2 * hw / s), H = Math.ceil(2 * hh / s);
  const x0w = c[0] - hw, y0w = c[1] - hh;
  const Z = new Float32Array(W * H).fill(-Infinity);
  const zFront = c[2];   // (only what lies in front of the ball's centre can hide its front)
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, d = I[t + 2] * 3;
    if (P[a + 2] < zFront && P[b + 2] < zFront && P[d + 2] < zFront) continue;
    const ax = (P[a] - x0w) / s, ay = (P[a + 1] - y0w) / s, bx = (P[b] - x0w) / s, by = (P[b + 1] - y0w) / s, dx = (P[d] - x0w) / s, dy = (P[d + 1] - y0w) / s;
    const minx = Math.max(0, Math.floor(Math.min(ax, bx, dx))), maxx = Math.min(W - 1, Math.ceil(Math.max(ax, bx, dx)));
    const miny = Math.max(0, Math.floor(Math.min(ay, by, dy))), maxy = Math.min(H - 1, Math.ceil(Math.max(ay, by, dy)));
    if (minx > maxx || miny > maxy) continue;
    const den = (by - dy) * (ax - dx) + (dx - bx) * (ay - dy); if (Math.abs(den) < 1e-12) continue;
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const px = x + 0.5, py = y + 0.5;
      const l1 = ((by - dy) * (px - dx) + (dx - bx) * (py - dy)) / den, l2 = ((dy - ay) * (px - dx) + (ax - dx) * (py - dy)) / den, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const z = l1 * P[a + 2] + l2 * P[b + 2] + l3 * P[d + 2];
      if (z > Z[y * W + x]) Z[y * W + x] = z;
    }
  }
  // (open: the ball's front in front of every surface there; K.deep: past the ball's side toward the nose, the inner
  // corner's pocket too)
  const open = new Uint8Array(W * H), toNose = eye.side > 0 ? -1 : 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x0w + (x + 0.5) * s - c[0], v = y0w + (y + 0.5) * s - c[1], q = r * r - u * u - v * v;
    if (K.deep[0] > 0 && u * toNose > K.deep[1] * r && Z[y * W + x] - c[2] < K.deep[0]) { open[y * W + x] = 1; continue; }
    if (q <= 0) continue;
    if (c[2] + Math.sqrt(q) > Z[y * W + x] - K.rim) open[y * W + x] = 1;
  }
  // (the opening: joined to the pixel in front of the ball's centre, or the nearest open one)
  let seed = -1, best = Infinity;
  const cx = Math.floor(hw / s), cy = Math.floor(hh / s);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (open[y * W + x]) { const d2 = (x - cx) ** 2 + (y - cy) ** 2; if (d2 < best) { best = d2; seed = y * W + x; } }
  if (seed < 0 || best > (0.5 * r / s) ** 2) return null;
  const mark = new Uint8Array(W * H), st = [seed]; mark[seed] = 1; let count = 0;
  while (st.length) {
    const k = st.pop(); count++; const x = k % W, y = (k - x) / W;
    for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + ex, Y = y + ey; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const q = Y * W + X; if (open[q] && !mark[q]) { mark[q] = 1; st.push(q); } }
  }
  // (each column's top and bottom edge, as angles round the level axis on the ball)
  let first = -1, last = -1; const top = new Float32Array(W).fill(NaN), bot = new Float32Array(W).fill(NaN);
  // (past the ball's side, the pocket's edges by the skin's own depth just outside them)
  const ang = (u, v, z) => (K.deep[0] > 0 && u * toNose > K.deep[1] * r && Number.isFinite(z) ? Math.atan2(v, Math.max(z - c[2], r * 0.14)) : Math.atan2(v, Math.sqrt(Math.max(r * r - u * u - v * v, r * r * 0.02))));
  for (let x = 0; x < W; x++) {
    let lo = -1, hi = -1;
    for (let y = 0; y < H; y++) if (mark[y * W + x]) { if (lo < 0) lo = y; hi = y; }
    if (lo < 0) continue;
    if (first < 0) first = x; last = x;
    const u = x0w + (x + 0.5) * s - c[0];
    top[x] = ang(u, y0w + (hi + 1) * s - c[1], Z[Math.min(H - 1, hi + 1) * W + x]); bot[x] = ang(u, y0w + lo * s - c[1], Z[Math.max(0, lo - 1) * W + x]);
  }
  if (first < 0 || last - first < 4) return null;
  const n = last - first + 1, up = new Float32Array(n), lo = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let a = 0, b = 0, m = 0;
    for (let k = -K.smooth; k <= K.smooth; k++) { const j = first + i + k; if (j < first || j > last || Number.isNaN(top[j])) continue; a += top[j]; b += bot[j]; m++; }
    up[i] = a / m; lo[i] = b / m;
  }
  return { x0: x0w + first * s - c[0], x1: x0w + (last + 1) * s - c[0], step: s, up, lo, open: count, px: s, W, H, mark, x0w, y0w };
}

// an edge's angle at x across (metres from the ball's centre): the column's, or nothing past the opening
function edgeAt(L, x) {
  const f = (x - L.x0) / L.step - 0.5, n = L.up.length;
  if (f < 0 || f > n - 1) return null;
  const i = Math.min(n - 2, Math.floor(f)), t = f - i;
  return [L.up[i] + (L.up[i + 1] - L.up[i]) * t, L.lo[i] + (L.lo[i + 1] - L.lo[i]) * t];
}
// THE TURNS: each of the head's points, its eye, how far it turns shut and how far out it is pushed
// (I: the head's triangles, for K.relax and K.cover)
export function lidTurns(P, eyes, lines, o = {}, I = null) {
  const K = { ...LIDS, ...o }, n = P.length / 3, out = new Float32Array(n * 4);
  const relax = (K.relax > 0 || K.cover > 0) && I ? { near: new Int8Array(n), hold: new Uint8Array(n), brow: new Float32Array(n) } : null;
  for (let i = 0; i < n; i++) {
    const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
    let e = -1, bd = Infinity;
    eyes.forEach((E, k) => { const d = Math.hypot(p[0] - E.c[0], p[1] - E.c[1], p[2] - E.c[2]); if (d < bd) { bd = d; e = k; } });
    const E = eyes[e], L = lines[e]; if (!L) continue;
    const vx = p[0] - E.c[0], vy = p[1] - E.c[1], vz = p[2] - E.c[2], dist = Math.hypot(vx, vy, vz);
    if (dist > 2.6 * E.r || vz < 0.05 * E.r) continue;
    if (relax) { relax.near[i] = E.side; relax.brow[i] = 1 - smooth(K.brow[0], K.brow[1], dist - E.r); }
    // (the edges where this point's column is; past a corner, the corner's own, faded out over K.corner radii)
    let fade = 1, xx = vx;
    if (vx < L.x0 + L.step) { fade = 1 - (L.x0 + L.step - vx) / (K.corner * E.r); xx = L.x0 + L.step; }
    else if (vx > L.x1 - L.step) { fade = 1 - (vx - L.x1 + L.step) / (K.corner * E.r); xx = L.x1 - L.step; }
    if (fade <= 0) continue;
    const ed = edgeAt(L, xx); if (!ed) continue;
    const [up, lo] = ed, gap = up - lo; if (!(gap > 0)) continue;
    const meet = lo + K.meet * gap, mid = (up + lo) / 2, psi = Math.atan2(vy, vz);
    const front = dist - E.r;
    let wOut = 1 - smooth(K.out[0], K.out[1], front);
    let turn, w, paint = 0;
    if (psi >= mid) {
      w = 1 - smooth(K.up[0], K.up[1], psi - up); turn = -(up - meet + K.past);
      if (relax && psi - up < K.fold[0]) relax.hold[i] = 1;
      // (the lid itself, up to its fold, turns whole however thick; only over it does the distance in front count)
      wOut = wOut + (1 - smooth(K.fold[2], K.fold[3], front) - wOut) * (1 - smooth(K.fold[0], K.fold[1], psi - up));
      // (the upper lid's paint shut: the lashes' line at its edge (minus), its skin's own colour over it (plus), the
      // brow kept)
      const over = psi - up, lash = 1 - smooth(K.lash[0], K.lash[1], over), skin = smooth(K.skin[0], K.skin[1], over) * (1 - smooth(K.brow[0], K.brow[1], front));
      paint = (lash > skin ? -lash : skin) * fade;
    } else { w = 1 - smooth(K.low[0], K.low[1], lo - psi); turn = meet - lo; if (relax) relax.hold[i] = 1; }
    w *= wOut * fade;
    if (w <= 0.001 && Math.abs(paint) <= 0.001) continue;
    out[i * 4] = E.side; out[i * 4 + 1] = turn * w; out[i * 4 + 2] = w * smooth(-K.cup, 0, front); out[i * 4 + 3] = paint;
  }
  if (relax) relaxTurns(out, P, I, relax, K.relax, K.cover);
  return out;
}
// (K.relax: each point's turn as the mean of its own and its neighbours' over the head's triangles, round after round;
// only over the eyes (near: which eye's, 0 none), the upper lid itself and all under the opening's middle held (the lower
// lid as it was); how far a point lies down onto the ball kept as it was; the points at one place (a seam in the paint's
// layout splits a point in two) taken as one, so they move as one)
function relaxTurns(T, P, I, { near, hold, brow }, rounds, cover) {
  const n = near.length, nb = Array.from({ length: n }, () => []), one = new Int32Array(n), at = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(P[i * 3] * 1e6)},${Math.round(P[i * 3 + 1] * 1e6)},${Math.round(P[i * 3 + 2] * 1e6)}`;
    if (!at.has(k)) at.set(k, i); one[i] = at.get(k);
  }
  for (let i = 0; i < n; i++) if (hold[i]) hold[one[i]] = 1;
  for (let t = 0; t < I.length; t += 3) for (let a = 0; a < 3; a++) {
    const p = one[I[t + a]], q = one[I[t + (a + 1) % 3]];
    if (p !== q && near[p] && near[q] === near[p]) { nb[p].push(q); nb[q].push(p); }
  }
  // (free: the skin over the upper lid that turns at all, as found; all else keeps its turn: the lid itself its own, the
  // skin round about none)
  const tu = new Float32Array(n), free = new Uint8Array(n);
  for (let i = 0; i < n; i++) { tu[i] = T[i * 4 + 1]; if (T[i * 4 + 1] < 0) free[one[i]] = 1; }
  for (let i = 0; i < n; i++) if (hold[i]) free[i] = 0;
  for (let r = 0; r < rounds; r++) {
    const t2 = Float32Array.from(tu);
    for (let i = 0; i < n; i++) {
      if (one[i] !== i || !free[i] || !nb[i].length) continue;
      let a = tu[i]; for (const q of nb[i]) a += tu[q];
      t2[i] = a / (nb[i].length + 1);
    }
    tu.set(t2);
  }
  for (let i = 0; i < n; i++) if (free[one[i]]) T[i * 4 + 1] = tu[one[i]];
  // (K.cover: the upper lid's skin colour, shut, over every point of it that turns down and this many rings of points
  // round them, the brow kept: the skin stretched between the lid and the brow is no longer its paint stretched)
  if (!(cover > 0)) return;
  const skin = new Float32Array(n);
  for (let i = 0; i < n; i++) { const j = one[i]; if (T[i * 4 + 1] < 0 && T[i * 4 + 3] >= 0) skin[j] = Math.max(skin[j], brow[j]); }
  for (let r = 0; r < cover; r++) {
    const s2 = Float32Array.from(skin);
    for (let i = 0; i < n; i++) if (one[i] === i && skin[i] > 0) for (const q of nb[i]) s2[q] = Math.max(s2[q], brow[q] * skin[i]);
    skin.set(s2);
  }
  for (let i = 0; i < n; i++) {
    const j = one[i]; if (!(skin[j] > 0) || T[i * 4 + 3] < 0 || T[i * 4 + 1] > 0) continue;
    T[i * 4 + 3] = Math.max(T[i * 4 + 3], skin[j]); if (!T[i * 4]) T[i * 4] = near[i];
  }
}
