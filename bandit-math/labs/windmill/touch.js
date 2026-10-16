// WHERE BOARDS TOUCH: the building side's geometry (snapping, the green circles where a board will be nailed, the
// nails drawn, the crash's pins, what comes down with a board taken down, the triangles the miller asks about). Plain
// numbers, no three.js, so node can load it. (The physics finds its own joints its own way; these only have to agree
// with it on what touches: centre lines closer than TOL.)
//
// Two flavours:
//   * on one plane, in its own (u, y) coordinates: touch(p, q) and findJoints(segs), for segments
//     { ax, ay, bx, by, len } (tower.js planeSegments): the v2 rules, unchanged. A leaning wall's coordinates are true
//     lengths up its slope (tower.js toPlane), so these hold on it just as on an upright one.
//   * in the world, across planes: touch3(p, q), joints3(boards), contactsOf(board, boards) for boards
//     { a: { X, Y, Z }, b, len } (a beam's end on the front crosspiece, a post's foot on a beam)

export const TOL = 0.2;               // feet: boards whose centre lines come closer than this are touching (a 2x4 is
                                      // 0.29 ft wide)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── on one plane ─────────────────────────────────────────────────────────────────────────────────────────────────────
// where two boards touch: a list of { x, y, ti, tj, butt } (ti, tj: feet along each board from its a end)
export function touch(p, q) {
  const dpx = (p.bx - p.ax) / p.len, dpy = (p.by - p.ay) / p.len, dqx = (q.bx - q.ax) / q.len, dqy = (q.by - q.ay) / q.len;
  const cross = dpx * dqy - dpy * dqx;
  if (Math.abs(cross) < 0.05) {
    // (nearly) parallel: they only touch if they lie along the same line
    const off = Math.abs((q.ax - p.ax) * dpy - (q.ay - p.ay) * dpx);
    if (off > TOL) return [];
    const t0 = (q.ax - p.ax) * dpx + (q.ay - p.ay) * dpy, t1 = (q.bx - p.ax) * dpx + (q.by - p.ay) * dpy;
    const lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(p.len, Math.max(t0, t1));
    const same = dpx * dqx + dpy * dqy > 0 ? 1 : -1;
    const at = (t) => ({ x: p.ax + dpx * t, y: p.ay + dpy * t, ti: t, tj: clamp((t - t0) * same, 0, q.len) });
    if (hi - lo > TOL) return [{ ...at(lo), butt: false }, { ...at(hi), butt: false }];     // lapped side by side
    if (hi - lo > -TOL) { const m = (lo + hi) / 2; return [{ ...at(clamp(m, 0, p.len)), butt: true }]; }   // end to end
    return [];
  }
  // crossing lines: where they meet, then the nearest point actually on each board
  const rx = q.ax - p.ax, ry = q.ay - p.ay;
  const tp = clamp((rx * dqy - ry * dqx) / cross, 0, p.len), tq = clamp((rx * dpy - ry * dpx) / cross, 0, q.len);
  const px = p.ax + dpx * tp, py = p.ay + dpy * tp, qx = q.ax + dqx * tq, qy = q.ay + dqy * tq;
  // (re-project each onto the other once, so an end that stops just short of a board still counts as touching it)
  const tp2 = clamp((qx - p.ax) * dpx + (qy - p.ay) * dpy, 0, p.len), tq2 = clamp((px - q.ax) * dqx + (py - q.ay) * dqy, 0, q.len);
  const ax = p.ax + dpx * tp2, ay = p.ay + dpy * tp2, bx = q.ax + dqx * tq2, by = q.ay + dqy * tq2;
  const gap = Math.min(Math.hypot(px - qx, py - qy), Math.hypot(ax - qx, ay - qy), Math.hypot(px - bx, py - by));
  if (gap > TOL) return [];
  return [{ x: (px + qx) / 2, y: (py + qy) / 2, ti: tp, tj: tq, butt: false }];
}

// the joints on one plane: contacts merged into hubs. Returns [{ x, y, ground, butt, items: [{ s (seg index), t }] }]
export function findJoints(segs, { ground = true } = {}) {
  const raw = [];
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) for (const c of touch(segs[i], segs[j])) raw.push({ ...c, i, j });
  const hubs = [];
  const near = (x, y) => hubs.find((h) => Math.hypot(h.x - x, h.y - y) < TOL * 1.5);
  const add = (h, s, t) => { const o = h.items.find((it) => it.s === s); if (o) o.t = (o.t + t) / 2; else h.items.push({ s, t }); };
  for (const c of raw) {
    let h = near(c.x, c.y);
    if (!h) { h = { x: c.x, y: c.y, ground: false, butt: true, items: [] }; hubs.push(h); }
    if (!c.butt) h.butt = false;
    add(h, c.i, c.ti); add(h, c.j, c.tj);
  }
  if (ground) {
    segs.forEach((s, i) => {
      for (const [x, y, t] of [[s.ax, s.ay, 0], [s.bx, s.by, s.len]]) {
        if (y > TOL) continue;
        let h = hubs.find((q) => Math.hypot(q.x - x, q.y - y) < TOL * 1.5);
        if (!h) { h = { x, y: 0, ground: true, butt: false, items: [] }; hubs.push(h); }
        h.ground = true; h.butt = false; h.y = 0; add(h, i, t);
      }
    });
  }
  return hubs.filter((h) => h.ground || h.items.length > 1);
}

// a knee brace: a short slanting board (4 ft or less) that props a post against a crosspiece near the corner, so it
// does not reach across the wall from post to post. On a narrow wall (W feet wide) a brace corner to corner can be that
// short too, and it is a real brace.
const angOf = (s) => Math.abs(Math.atan2(s.by - s.ay, s.bx - s.ax) * 180 / Math.PI) % 180;
export const isLevel = (s) => { const a = angOf(s); return a < 8 || a > 172; };
export const isUp = (s) => Math.abs(angOf(s) - 90) < 8;
export const isKnee = (s, W) => !isLevel(s) && !isUp(s) && s.len <= 4 && !(W > 0 && Math.abs(s.bx - s.ax) > W - 0.25);

// ── in the world ─────────────────────────────────────────────────────────────────────────────────────────────────────
const sub = (p, q) => [p.X - q.X, p.Y - q.Y, p.Z - q.Z];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const dirOf = (b) => { const d = sub(b.b, b.a), L = Math.hypot(...d) || 1; return [d[0] / L, d[1] / L, d[2] / L]; };
const along = (b, d, t) => ({ X: b.a.X + d[0] * t, Y: b.a.Y + d[1] * t, Z: b.a.Z + d[2] * t });
const dist = (p, q) => Math.hypot(p.X - q.X, p.Y - q.Y, p.Z - q.Z);
// where two boards touch in the world: [{ X, Y, Z, ti, tj, butt }] (ti, tj: feet along each from its a end)
export function touch3(p, q) {
  const lp = p.len || dist(p.a, p.b), lq = q.len || dist(q.a, q.b);
  const dp = dirOf(p), dq = dirOf(q), b = dot(dp, dq);
  const cx = dp[1] * dq[2] - dp[2] * dq[1], cy = dp[2] * dq[0] - dp[0] * dq[2], cz = dp[0] * dq[1] - dp[1] * dq[0];
  if (Math.hypot(cx, cy, cz) < 0.05) {
    // (nearly) parallel: only along the same line
    const w = sub(q.a, p.a), s = dot(w, dp);
    if (Math.hypot(w[0] - dp[0] * s, w[1] - dp[1] * s, w[2] - dp[2] * s) > TOL) return [];
    const t0 = s, t1 = dot(sub(q.b, p.a), dp), lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(lp, Math.max(t0, t1));
    const same = b > 0 ? 1 : -1;
    const at = (t) => ({ ...along(p, dp, t), ti: t, tj: clamp((t - t0) * same, 0, lq) });
    if (hi - lo > TOL) return [{ ...at(lo), butt: false }, { ...at(hi), butt: false }];
    if (hi - lo > -TOL) return [{ ...at(clamp((lo + hi) / 2, 0, lp)), butt: true }];
    return [];
  }
  // the nearest points of the two lines, then the nearest points actually on the boards
  const w0 = sub(p.a, q.a), d = dot(dp, w0), e = dot(dq, w0), den = 1 - b * b;
  const tp = clamp((b * e - d) / den, 0, lp), tq = clamp((e - b * d) / den, 0, lq);
  const P = along(p, dp, tp), Q = along(q, dq, tq);
  const tp2 = clamp(dot(sub(Q, p.a), dp), 0, lp), tq2 = clamp(dot(sub(P, q.a), dq), 0, lq);
  const P2 = along(p, dp, tp2), Q2 = along(q, dq, tq2);
  const opts = [[dist(P, Q), P, Q, tp, tq], [dist(P2, Q), P2, Q, tp2, tq], [dist(P, Q2), P, Q2, tp, tq2]].sort((u, v) => u[0] - v[0]);
  const [gap, A, B, ti, tj] = opts[0];
  if (gap > TOL) return [];
  return [{ X: (A.X + B.X) / 2, Y: (A.Y + B.Y) / 2, Z: (A.Z + B.Z) / 2, ti, tj, butt: false }];
}
// how far apart two boards' centre lines come (feet), and where on p (t)
export function gap3(p, q) {
  const lp = p.len || dist(p.a, p.b), lq = q.len || dist(q.a, q.b), dp = dirOf(p), dq = dirOf(q);
  let best = { d: Infinity, t: 0 };
  // (a few rounds of nearest point back and forth: plenty for straight boards)
  let t = 0;
  for (const start of [0, lp / 2, lp]) {
    t = start;
    for (let i = 0; i < 4; i++) {
      const P = along(p, dp, t), u = clamp(dot(sub(P, q.a), dq), 0, lq), Q = along(q, dq, u);
      t = clamp(dot(sub(Q, p.a), dp), 0, lp);
      const d = dist(along(p, dp, t), Q);
      if (d < best.d) best = { d, t };
    }
  }
  return best;
}
// how far a point is from a board's centre line
export function pointGap(p, b) {
  const d = dirOf(b), L = b.len || dist(b.a, b.b), t = clamp(dot(sub(p, b.a), d), 0, L);
  return { d: dist(p, along(b, d, t)), t };
}

// every spot where a board meets the others (and the ground: an end at the ground rests on it, or on a stone):
// [{ X, Y, Z, t (feet along it from its a end), other (the board, or null for the ground), end ('a', 'b' or null),
//    butt, theirEnd (its end on the other's side, or the other's end on its side) }]
export function contactsOf(me, boards, { ground = true, skip = null } = {}) {
  const out = [], L = me.len || dist(me.a, me.b), near = (t) => (t < TOL ? 'a' : t > L - TOL ? 'b' : null);
  for (const o of boards) {
    if (o === me || (skip && o.id === skip)) continue;
    const lo = o.len || dist(o.a, o.b);
    for (const c of touch3(me, o)) out.push({ X: c.X, Y: c.Y, Z: c.Z, t: c.ti, other: o, end: near(c.ti), butt: c.butt, theirEnd: c.tj < TOL || c.tj > lo - TOL });
  }
  if (ground) for (const [p, t, e] of [[me.a, 0, 'a'], [me.b, L, 'b']]) if (p.Y <= TOL) out.push({ X: p.X, Y: 0, Z: p.Z, t, other: null, end: e, butt: false, ground: true });
  return out;
}
// does a board touch anything (a board, or the ground)?
export const touchesAny = (me, boards) => contactsOf(me, boards).length > 0;

// the joints of the whole tower: contacts merged into hubs (touching spots within 1.5 TOL are one hub).
// Returns [{ X, Y, Z, ground, butt, items: [{ i (board index), t }] }]
export function joints3(boards, { ground = true } = {}) {
  const hubs = [];
  const add = (h, i, t) => { const o = h.items.find((it) => it.i === i); if (o) o.t = (o.t + t) / 2; else h.items.push({ i, t }); };
  const hubAt = (p) => {
    let h = hubs.find((q) => dist(q, p) < TOL * 1.5);
    if (!h) { h = { X: p.X, Y: p.Y, Z: p.Z, ground: false, butt: true, items: [] }; hubs.push(h); }
    return h;
  };
  for (let i = 0; i < boards.length; i++) for (let j = i + 1; j < boards.length; j++) {
    for (const c of touch3(boards[i], boards[j])) { const h = hubAt(c); if (!c.butt) h.butt = false; add(h, i, c.ti); add(h, j, c.tj); }
  }
  if (ground) boards.forEach((b, i) => {
    for (const [p, t] of [[b.a, 0], [b.b, b.len]]) {
      if (p.Y > TOL) continue;
      const h = hubAt({ X: p.X, Y: 0, Z: p.Z }); h.ground = true; h.butt = false; h.Y = 0; add(h, i, t);
    }
  });
  return hubs.filter((h) => h.ground || h.items.length > 1);
}

// which boards reach the ground through their joints (the rest would come down): a Set of boards
export function grounded(boards) {
  const links = new Map(), held = new Set();
  const link = (a, b) => { (links.get(a) || links.set(a, new Set()).get(a)).add(b); (links.get(b) || links.set(b, new Set()).get(b)).add(a); };
  for (const h of joints3(boards)) {
    const bs = h.items.map((it) => boards[it.i]);
    if (h.ground) bs.forEach((b) => held.add(b));
    for (let k = 1; k < bs.length; k++) link(bs[0], bs[k]);
  }
  const reach = new Set(held), stack = [...held];
  while (stack.length) { const s = stack.pop(); for (const o of links.get(s) || []) if (!reach.has(o)) { reach.add(o); stack.push(o); } }
  return reach;
}
