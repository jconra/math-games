// THE FENCE PLAN: where the town's fences and gates go, worked out from the planting's strokes, with no three.js (so the
// node tests read it). world/objects/fences.js draws what this plans; world/valley.js draws the plain fence as it always
// has.
//
// A fence is a planting stroke of the fence kind (drawn with a drag), its `style` one of FENCE_STYLES. A stroke with no
// style (every fence made before there were styles) is the PLAIN two-rail fence, drawn exactly as before. A gate is a
// stroke of the gate kind: one spot, put on the nearest fence drawn before it (within GATE_REACH); it cuts a gap in
// that fence as wide as the style's gate and takes the style's look. A later Clear stroke with the fence chosen takes
// down the fence under it (a styled fence: the stretch under the brush; the plain fence: its posts, as before) and any
// gate under it; one with the gate chosen, the gates only.
//
//   FENCE_STYLES[id] -> { name, h (its height at size 1, m), gate (its gate's kind, GATES), half (how far either side of
//                       its line it blocks a walker, m) }
//   PLAIN              the plain two-rail fence's own (no style)
//   GATES[kind]     -> { name, w (the gap it leaves, m), reach (how near something comes for it to swing open, m) }
//   planFences(strokes, { fence, gate, inStroke }) -> { runs, gates }
//     runs:  [{ si, stroke, style (null: plain), size, pts, cum, len, gaps, pieces }] every fence stroke drawn, with
//            pieces: [{ a, b, pts, gateA, gateB }] what stands of it (a, b: metres along it; gateA / gateB: a gate's
//            post stands at that end, so the fence leaves its own post out there)
//     gates: [{ gi, id, run, kind, s, a, b, A, B, w }] each gate: on which run, its middle and its ends along it (m), its
//            two posts' spots A and B ([x, z])
//   fenceLines(style, piece) -> [[x, z], ...] the line a piece stands on (a zigzag fence: its zigzag), for the blockers
//   wormCorners(pts, panel, amp) -> [[x, z], ...] a zigzag fence's corners along a line (both ends on the line itself)
//   nearestFence(plan, x, z, reach) -> { run, s, x, z, d } | null   the fence point nearest a spot (the lab's Gate tool)

export const FENCE_STYLES = {
  picketWhite: { name: 'White picket', note: 'garden or yard, whitewashed, pointed pickets', h: 0.95, gate: 'picketWhite', half: 0.35 },
  picket: { name: 'Bare picket', note: 'garden or yard, bare boards, dog-eared pickets', h: 0.95, gate: 'picket', half: 0.35 },
  corral: { name: 'Horse corral', note: 'four wide sawn boards on square posts', h: 1.5, gate: 'corral', half: 0.35 },
  worm: { name: 'Zigzag rail', note: 'split rails stacked in a zigzag, no posts', h: 1.35, gate: 'ranch', half: 0.35 },
  buck: { name: 'Buck and rail', note: 'X-bucks with rails, the Montana ranch fence', h: 1.3, gate: 'ranch', half: 0.55 },
  wire: { name: 'Post and wire', note: 'wooden posts, three strands of barbed wire', h: 1.2, gate: 'ranch', half: 0.35 },
  stone: { name: 'Low stone wall', note: 'dry-stacked field stone', h: 0.85, gate: 'board', half: 0.4 },
  logRail: { name: 'Log rail', note: 'rough round posts and three log rails', h: 1.25, gate: 'ranch', half: 0.35 },
  wattle: { name: 'Wattle', note: 'woven willow rods on stakes, a garden fence', h: 0.85, gate: 'picket', half: 0.35 },
};
export const PLAIN = { name: 'Two-rail (plain)', note: 'the town\'s first fence: square posts and two rails', h: 1.1, gate: 'board', half: 0.35 };
export const GATES = {
  picketWhite: { name: 'picket gate', w: 1.15, reach: 2.4 },
  picket: { name: 'picket gate', w: 1.15, reach: 2.4 },
  corral: { name: 'corral gate', w: 3.8, reach: 5.5 },
  board: { name: 'board gate', w: 3.0, reach: 5 },
  ranch: { name: 'ranch gate', w: 3.8, reach: 5.5 },
};
export const GATE_REACH = 2.5;            // (m: a gate goes on a fence this near the spot clicked, or nowhere)
const MIN_PIECE = 0.3;                    // (m: a stretch of fence shorter than this left between gaps isn't drawn)
const STEP = 0.2;                         // (m: how finely a styled run is looked along for the Clear strokes over it)

export const styleOf = (st) => (st && FENCE_STYLES[st.style] ? st.style : null);
export const styleInfo = (style) => FENCE_STYLES[style] || PLAIN;
export const gateKindOf = (style) => styleInfo(style).gate;

// ── a line's lengths ──────────────────────────────────────────────────────────────────────────────────────────────────
export function measure(pts) { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return cum; }
// the spot s metres along, and which straight run of the line it is on
export function pointAt(pts, cum, s) {
  const n = pts.length; if (s <= 0) return [pts[0][0], pts[0][1], 0];
  for (let k = 0; k < n - 1; k++) if (s <= cum[k + 1] || k === n - 2) {
    const L = cum[k + 1] - cum[k] || 1e-9, t = Math.min(1, Math.max(0, (s - cum[k]) / L));
    return [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t, k];
  }
  return [pts[n - 1][0], pts[n - 1][1], n - 2];
}
// the part of the line from a to b metres along (its corners kept)
export function slice(pts, cum, a, b) {
  const A = pointAt(pts, cum, a), B = pointAt(pts, cum, b), out = [[A[0], A[1]]];
  for (let k = 1; k < pts.length - 1; k++) if (cum[k] > a + 1e-6 && cum[k] < b - 1e-6) out.push([pts[k][0], pts[k][1]]);
  out.push([B[0], B[1]]);
  return out;
}
// the point of the line nearest a spot: how far off (d), how far along (s), which straight run (k)
export function nearestOn(pts, cum, x, z) {
  let best = { d: Infinity, s: 0, x: pts[0][0], z: pts[0][1], k: 0 };
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], dx = pts[k + 1][0] - ax, dz = pts[k + 1][1] - az, L2 = dx * dx + dz * dz || 1e-12;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { d, s: cum[k] + t * (cum[k + 1] - cum[k]), x: px, z: pz, k };
  }
  return best;
}
const tidy = (pts) => { const out = []; for (const p of pts || []) if (Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1]) && (!out.length || Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) > 0.02)) out.push([+p[0], +p[1]]); return out; };

// ── the plan ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export function planFences(strokes, { fence, gate, inStroke }) {
  const runs = [], gates = [], list = Array.isArray(strokes) ? strokes : [];
  list.forEach((st, si) => {
    if (!st || st.kind !== fence || st.mode === 'clear') return;
    const pts = tidy(st.pts); if (pts.length < 2) return;
    const cum = measure(pts), len = cum[cum.length - 1]; if (len < 0.1) return;
    const style = styleOf(st), cut = [];
    if (style) {   // (a styled fence: the stretches under a later Clear with the fence chosen are taken down)
      const clears = list.filter((c, ci) => ci > si && c && c.mode === 'clear' && c.kind === fence);
      if (clears.length) {
        let from = null; const n = Math.max(2, Math.ceil(len / STEP));
        for (let i = 0; i <= n; i++) { const s = len * i / n, [x, z] = pointAt(pts, cum, s), gone = clears.some((c) => inStroke(c, x, z));
          if (gone && from === null) from = Math.max(0, s - len / n / 2); else if (!gone && from !== null) { cut.push([from, s - len / n / 2]); from = null; } }
        if (from !== null) cut.push([from, len]);
      }
    }
    runs.push({ si, stroke: st, style, size: +st.size || 1, pts, cum, len, cut, gaps: [], pieces: [] });
  });
  const isCut = (R, s) => R.cut.some(([a, b]) => s >= a && s <= b);
  list.forEach((st, gi) => {
    if (!st || st.kind !== gate || st.mode === 'clear' || !Array.isArray(st.pts) || !st.pts.length) return;
    const p = st.pts[st.pts.length - 1], gx = +p[0], gz = +p[1]; if (!Number.isFinite(gx) || !Number.isFinite(gz)) return;
    if (list.some((c, ci) => ci > gi && c && c.mode === 'clear' && (c.kind === fence || c.kind === gate) && inStroke(c, gx, gz))) return;   // (taken away)
    let best = null;
    for (const R of runs) {
      if (R.si > gi) continue;                                            // (only a fence that was there when the gate went in)
      const n = nearestOn(R.pts, R.cum, gx, gz); if (n.d > GATE_REACH || isCut(R, n.s)) continue;
      if (!best || n.d < best.n.d - 1e-6 || (Math.abs(n.d - best.n.d) <= 1e-6 && R.si > best.R.si)) best = { R, n };
    }
    if (!best) return;
    const { R, n } = best, kind = gateKindOf(R.style), w = Math.min(GATES[kind].w, R.len - 0.4);
    if (w < 0.8) return;                                                  // (a fence too short for a gate)
    // the gate kept on one straight run of the fence where it can be (a gate is straight); otherwise within the fence
    const s0 = R.cum[n.k], s1 = R.cum[n.k + 1];
    const s = s1 - s0 >= w ? Math.min(s1 - w / 2, Math.max(s0 + w / 2, n.s)) : Math.min(R.len - w / 2, Math.max(w / 2, n.s));
    const a = s - w / 2, b = s + w / 2;
    if (R.gaps.some(([p0, q0]) => a < q0 + 0.3 && b > p0 - 0.3)) return;   // (on top of another gate)
    const A = pointAt(R.pts, R.cum, a), B = pointAt(R.pts, R.cum, b);
    const G = { gi, id: st.id, run: R, kind, s, a, b, A: [A[0], A[1]], B: [B[0], B[1]], w };
    R.gaps.push([a, b, gates.length]); gates.push(G);
  });
  // what stands of each run: the whole of it less its gates' gaps and the stretches taken down
  for (const R of runs) {
    const holes = [...R.cut.map(([a, b]) => [a, b, -1]), ...R.gaps].sort((p, q) => p[0] - q[0]);
    let at = 0, gateAt = -1;
    const add = (a, b, gA, gB) => { if (b - a >= MIN_PIECE) R.pieces.push({ a, b, pts: slice(R.pts, R.cum, a, b), gateA: gA, gateB: gB }); };
    for (const [a, b, g] of holes) { if (a > at) add(at, a, gateAt >= 0, g >= 0); if (b >= at) { at = Math.max(at, b); gateAt = g; } }
    add(at, R.len, gateAt >= 0, false);
  }
  return { runs, gates };
}

// ── a zigzag (worm) fence: its corners, swinging amp either side of the line turn about, both ends on the line. The
// corners are a whole panel apart and the end panels half one, so every panel runs at the same slant off the line
// (atan(2 amp / panel): about 28 degrees), however short the run
export function wormCorners(pts, panel = 2.6, amp = 0.7) {
  const cum = measure(pts), len = cum[cum.length - 1], m = Math.max(0, Math.round(len / panel - 1)), P = len / (m + 1), out = [];
  const at = (s, off) => { const [x, z, k] = pointAt(pts, cum, s), dx = pts[k + 1][0] - pts[k][0], dz = pts[k + 1][1] - pts[k][1], L = Math.hypot(dx, dz) || 1; return [x - dz / L * off, z + dx / L * off]; };
  out.push(at(0, 0));
  for (let i = 0; i <= m; i++) out.push(at(P / 2 + i * P, i % 2 ? -amp : amp));
  out.push(at(len, 0));
  return out;
}
export const WORM = { panel: 2.6, amp: 0.7 };   // (each panel about 28 degrees off the run, the corners 0.7 m either side)
// the line a piece of fence stands on: the zigzag's own for the zigzag fence, else the piece's line
export function fenceLines(style, piece) { return style === 'worm' ? wormCorners(piece.pts, WORM.panel, WORM.amp) : piece.pts; }

// the fence point nearest a spot, of every run with something standing there (null: none within reach)
export function nearestFence(plan, x, z, reach = GATE_REACH) {
  let best = null;
  for (const R of plan.runs) {
    const n = nearestOn(R.pts, R.cum, x, z); if (n.d > reach) continue;
    if (!R.pieces.some((p) => n.s >= p.a - 0.05 && n.s <= p.b + 0.05) && !R.gaps.some(([a, b]) => n.s >= a && n.s <= b)) continue;
    if (!best || n.d < best.d) best = { run: R, s: n.s, x: n.x, z: n.z, d: n.d };
  }
  return best;
}
