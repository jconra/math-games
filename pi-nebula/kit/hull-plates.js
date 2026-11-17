// THE HULL'S PLATES, AS PLAIN NUMBERS: a hull given as a plan (an outline, and tiers stepping in above and below it)
// is cut into flat strips, each strip is laid with separate bevelled armour plates, and the plates come out as lists of
// numbers ready for the graphics card. No three.js here (kit/hull.js wraps these lists in meshes), so the tests can
// count and measure the plates in Node. The game's maker, 2026-11-17: "several tiers of heavily beveled shapes so we
// don't have any large flat surfaces ... like overlapping armor that can deflect meteoroid impacts".
//
// THE PLAN  { path, closed, back, tiers, doors, windows }          (metres; y is up)
//   path     the hull's outline seen from above, [[x, z], ...], walked with the OUTSIDE ON YOUR RIGHT (walking toward
//            -z, the outside is +x). Every tier is drawn against this one outline.
//   closed   true: the outline joins up (a whole hull). false: a piece of one; its two ends and its back are cut flat
//   back     for a piece: how far in from the outline its flat back is (the cut faces are drawn dark and plain)
//   tiers    [{ name, profile, parts }]: a tier's shape cut across, from its lowest point up.
//            profile  [[o, y, 'in'?], ...]: o is how far OUT from the outline (minus: stepped in), y the height. 'in'
//                     marks a point that sits in an inside corner against another tier (the shading is wider there,
//                     and the plates stop short of the corner so they do not run into the other tier's)
//            parts    one for each step of the profile: { group: 'band' | 'tiers' | 'trim', kind: 'plates' |
//                     'windows' }, or null for a step that is not drawn. 'windows': a row of lit windows in trim
//                     frames between two trim lips
//   doors    [{ tier, step, run, at, w, h, y, sill, head, jamb, proud }]: a hangar door in the wall that is step
//            `step` of tier `tier` on the outline's straight run `run`: its middle `at` metres along that run, the
//            opening w wide and h tall, the frame's foot at height y, a sill under the opening, a head over it, a
//            jamb each side, the frame standing `proud` of the wall. The opening is left open (a shield goes across)
//   windows  { w, h, pitch, lip, sink, skip }: a window pane's size, one every `pitch` along a row, the lips' height,
//            how far the pane is sunk into its frame, every `skip`th left blank
//
// THE PLATES' SIZES  { w, h, lap, bevel, gap, shift, uneven }   (kit/hull-look.js plateSizes(look))
//   Each strip is laid in rows `h` tall of plates `w` wide (fitted, so a whole number fills the strip). A plate is a
//   flat top with a 45-degree bevel all round, `bevel` wide and deep, standing on the dark backing; `gap` is the seam
//   between neighbours; each row is slid `shift` of a plate along from the row below; `uneven` (0 to 1) makes the
//   plates of a row differ in width. With `lap`, every row reaches that far down over the row below, tilted like a
//   roof tile, its lower edge standing clear.
//
// WHAT COMES OUT  hullArrays(plan, sizes) -> { groups: { band, tiers, trim }, windows, shields, stats }
//   a group   position, normal, uv (metres, slid by a different amount on each plate so a finish never runs across a
//             seam), edge (each corner's distance to its plate's four sides: foot, right, top, left), kind (how wide
//             the shading along each of those sides is: SEAM or INSIDE), tone (which grey: 0 main, 1 second; a random
//             -1..1 for the plate; how dark: 1 a plate, less for the backing and the cut faces; the plate's own
//             bevel, metres), index
//   windows   the lit panes: position, shade (how brightly each is lit, 0 to 1), index
//   shields   the doors' openings: position, uv, index
//   stats     plates and triangles for each group, panes, strips
export const SEAM = 1, INSIDE = 3;
// (how dark, of the trim colour, the backing behind the seams, a window's reveal and the cut faces are)
const DARK = { back: 0.42, reveal: 0.55, cut: 0.3 };

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// a number from 0 to 1 that is always the same for the same strip, row, plate and use
function hash(a, b, c, d = 0) {
  let h = (Math.imul(a + 1, 374761393) ^ Math.imul(b + 1, 668265263) ^ Math.imul(c + 1, 2246822519) ^ Math.imul(d + 1, 3266489917)) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ── THE OUTLINE ─────────────────────────────────────────────────────────────────────────────────────────────────
// the outline moved o metres OUT (minus: in): every straight run slid along its own normal, the corners mitred. A
// piece's two ends slide along their own run's normal, so they stay on the planes the piece is cut at.
export function offsetPath(path, o, closed = false) {
  const n = path.length, runs = closed ? n : n - 1, out = [];
  const line = (i) => {
    const a = path[i], b = path[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, d = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    return { p: [a[0] - d[1] * o, a[1] + d[0] * o], d };
  };
  for (let k = 0; k < n; k++) {
    if (!closed && k === 0) { out.push(line(0).p); continue; }
    if (!closed && k === n - 1) { const L = line(n - 2); out.push([path[k][0] - L.d[1] * o, path[k][1] + L.d[0] * o]); continue; }
    const A = line((k - 1 + runs) % runs), B = line(k % runs), c = A.d[0] * B.d[1] - A.d[1] * B.d[0];
    if (Math.abs(c) < 1e-9) { out.push(B.p); continue; }
    const s = ((B.p[0] - A.p[0]) * B.d[1] - (B.p[1] - A.p[1]) * B.d[0]) / c;
    out.push([A.p[0] + A.d[0] * s, A.p[1] + A.d[1] * s]);
  }
  return out;
}

// ── FLAT SHAPES IN A STRIP'S OWN u, v (u along the hull, v up the strip) ──────────────────────────────────────
// a convex shape (corners counter-clockwise) with each side moved in by its own distance
export function insetPoly(pts, dists) {
  const n = pts.length, lines = [];
  for (let k = 0; k < n; k++) {
    const a = pts[k], b = pts[(k + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, d = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], t = Array.isArray(dists) ? dists[k] : dists;
    lines.push({ p: [a[0] - d[1] * t, a[1] + d[0] * t], d });
  }
  const out = [];
  for (let k = 0; k < n; k++) {
    const A = lines[(k - 1 + n) % n], B = lines[k], c = A.d[0] * B.d[1] - A.d[1] * B.d[0];
    if (Math.abs(c) < 1e-9) { out.push(B.p.slice()); continue; }
    const s = ((B.p[0] - A.p[0]) * B.d[1] - (B.p[1] - A.p[1]) * B.d[0]) / c;
    out.push([A.p[0] + A.d[0] * s, A.p[1] + A.d[1] * s]);
  }
  return out;
}
// how far a point is inside each side of a shape (the side from corner k to the next)
function sideDists(pts, q) {
  const out = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    out.push((-(b[1] - a[1]) * (q[0] - a[0]) + (b[0] - a[0]) * (q[1] - a[1])) / l);
  }
  return out;
}
const area2 = (pts) => { let a = 0; for (let k = 0; k < pts.length; k++) { const p = pts[k], q = pts[(k + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

// ── THE STRIPS: every flat strip of the hull (a straight run of the outline by a step of a tier's profile) ────────
// A strip has its own frame: O a corner, U along the hull (to the right, seen from outside), V up the strip, N out of
// it; its shape in that frame is `quad` ([foot left, foot right, top right, top left]: the foot and top run along U,
// the ends may slant where two runs meet at a mitre); `kinds` say what each side is against (foot, right, top, left).
export function hullStrips(plan) {
  const closed = !!plan.closed, n = plan.path.length, runs = closed ? n : n - 1, strips = [];
  const offs = new Map(), off = (o) => { const k = o.toFixed(4); if (!offs.has(k)) offs.set(k, offsetPath(plan.path, o, closed)); return offs.get(k); };
  const dir = (i) => { const a = plan.path[i], b = plan.path[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  // (a corner of the outline between run i and the next: an inside corner if the next run turns toward the outside)
  const turnIn = (i) => { const a = dir(i), b = dir((i + 1) % runs); return b[0] * -a[1] + b[1] * a[0] > 1e-6; };
  plan.tiers.forEach((tier, ti) => {
    const P = tier.profile;
    // (a corner of the profile: an inside corner if the next step turns toward the outside)
    const stepIn = (j) => { if (j <= 0 || j >= P.length - 1) return false; const a = [P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]], b = [P[j + 1][0] - P[j][0], P[j + 1][1] - P[j][1]]; return b[0] * a[1] - b[1] * a[0] > 1e-6; };
    for (let j = 0; j < P.length - 1; j++) {
      const part = tier.parts[j]; if (!part) continue;
      const [oa, ya] = P[j], [ob, yb] = P[j + 1], PA = off(oa), PB = off(ob);
      const foot = P[j][2] === 'in' || stepIn(j) ? INSIDE : SEAM, head = P[j + 1][2] === 'in' || stepIn(j + 1) ? INSIDE : SEAM;
      for (let i = 0; i < runs; i++) {
        const i1 = (i + 1) % n;
        const A0 = [PA[i][0], ya, PA[i][1]], A1 = [PA[i1][0], ya, PA[i1][1]], B0 = [PB[i][0], yb, PB[i][1]], B1 = [PB[i1][0], yb, PB[i1][1]];
        const d = dir(i), U = [d[0], 0, d[1]], La = dot(sub(A1, A0), U);
        const N = unit(cross(U, sub(B0, A0))), V = cross(N, U), H = dot(sub(B0, A0), V);
        if (La < 1e-4 || H < 1e-4) continue;
        const left = !closed && i === 0 ? SEAM : turnIn((i - 1 + runs) % runs) ? INSIDE : SEAM;
        const right = !closed && i === runs - 1 ? SEAM : turnIn(i) ? INSIDE : SEAM;
        strips.push({ id: strips.length, tier: ti, step: j, run: i, group: part.group, kind: part.kind || 'plates', O: A0, U, V, N,
          quad: [[0, 0], [La, 0], [dot(sub(B1, A0), U), H], [dot(sub(B0, A0), U), H]], kinds: [foot, right, head, left] });
      }
    }
  });
  return strips;
}

// ── LAYING PLATES ───────────────────────────────────────────────────────────────────────────────────────────────
// the plates of one four-sided part of a strip: rows h tall, plates w wide, fitted. Returns each plate's four corners
// (before the seam is cut round it), what each of its sides is against, and its row and place in the row.
//   part   { quad, kinds }: the foot and the top along u; the ends may slant
//   S      { w, h, lap, shift, uneven }; salt: a number that makes this part's uneven widths its own
export function layPlates(part, S, salt = 0) {
  const [p0, p1, p2, p3] = part.quad, v0 = p0[1], v1 = p3[1], H = v1 - v0, out = [];
  if (H < 1e-4) return out;
  const uL = (v) => p0[0] + (p3[0] - p0[0]) * (v - v0) / H, uR = (v) => p1[0] + (p2[0] - p1[0]) * (v - v0) / H;
  const rows = Math.max(1, Math.round(H / S.h)), hr = H / rows, lap = Math.min(S.lap || 0, hr * 0.6);
  for (let r = 0; r < rows; r++) {
    const a = v0 + r * hr, b = a + hr, mid = (a + b) / 2, span = uR(mid) - uL(mid);
    if (span < 1e-4) continue;
    const cols = Math.max(1, Math.round(span / S.w)), wf = span / cols;
    // (the seams inside the row: one every plate's width, slid along on every other row, each nudged a little either
    // way when the widths are uneven; none too near an end)
    const L0 = Math.max(uL(a), uL(b)), R0 = Math.min(uR(a), uR(b)), s0 = uL(mid) + (r % 2 ? (S.shift || 0) * wf : 0), cuts = [];
    // (a row too short for two plates is one plate)
    for (let k = 0; k <= cols && cols > 1; k++) { const u = s0 + k * wf + (hash(salt, r, k, 9) - 0.5) * 0.7 * (S.uneven || 0) * wf; if (u > L0 + 0.3 * wf && u < R0 - 0.3 * wf) cuts.push(u); }
    // (a row over another reaches down over it by the lap)
    const low = r > 0 ? a - lap : a;
    for (let c = 0; c <= cuts.length; c++) {
      const ua = c === 0 ? null : cuts[c - 1], ub = c === cuts.length ? null : cuts[c];
      out.push({ row: r, col: c, rows, w: wf, h: hr, lap: r > 0 ? lap : 0,
        quad: [[ua ?? uL(low), low], [ub ?? uR(low), low], [ub ?? uR(b), b], [ua ?? uL(b), b]],
        kinds: [r === 0 ? part.kinds[0] : SEAM, ub == null ? part.kinds[1] : SEAM, r === rows - 1 ? part.kinds[2] : SEAM, ua == null ? part.kinds[3] : SEAM] });
    }
  }
  return out;
}

// ── THE LISTS OF NUMBERS ────────────────────────────────────────────────────────────────────────────────────────
class Lists {
  constructor() { this.position = []; this.normal = []; this.uv = []; this.edge = []; this.kind = []; this.tone = []; this.index = []; this.plates = 0; }
  get count() { return this.position.length / 3; }
  // a flat facet: its corners (3 or 4, counter-clockwise seen from outside), each { p: [x, y, z], uv: [u, v], e: [4] }
  facet(c, kind, tone) {
    // (its normal from all its corners, so a facet squeezed to a triangle at one end still has one)
    const n = [0, 0, 0];
    for (let i = 0; i < c.length; i++) { const a = c[i].p, b = c[(i + 1) % c.length].p; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-9) return 0;
    const base = this.count; let made = 0;
    for (const v of c) { this.position.push(v.p[0], v.p[1], v.p[2]); this.normal.push(n[0] / l, n[1] / l, n[2] / l); this.uv.push(v.uv[0], v.uv[1]); this.edge.push(v.e[0], v.e[1], v.e[2], v.e[3]); this.kind.push(kind[0], kind[1], kind[2], kind[3]); this.tone.push(tone[0], tone[1], tone[2], tone[3] || 0); }
    for (let i = 1; i < c.length - 1; i++) {
      const t = cross(sub(c[i].p, c[0].p), sub(c[i + 1].p, c[0].p));
      if (Math.hypot(t[0], t[1], t[2]) > 1e-9) { this.index.push(base, base + i, base + i + 1); made++; }
    }
    return made;
  }
  arrays() {
    return { position: new Float32Array(this.position), normal: new Float32Array(this.normal), uv: new Float32Array(this.uv), edge: new Float32Array(this.edge),
      kind: new Float32Array(this.kind), tone: new Float32Array(this.tone), index: new Uint32Array(this.index), plates: this.plates, triangles: this.index.length / 3 };
  }
}
const FAR = [50, 50, 50, 50], PLAIN = [SEAM, SEAM, SEAM, SEAM];

// ONE PLATE on a strip: the seam cut round it, a wall up from the backing where it stands proud or is tilted, the
// bevel, the flat top (with a sunk window in it, if it has one). Returns the pane's corners, if any.
//   o   { gap, bevel, proud (how far its foot stands off the backing), rise (how far its lower edge is lifted over its
//         upper edge: the lap's tilt), tone: [which grey, random, how dark], slide: [du, dv] (the finish slid by this),
//         window: { w, h, sink } }
function plate(G, st, quad, kinds, o) {
  const g2 = Math.max(0, o.gap / 2), clear = (o.bevel || 0) + g2 + 0.01;
  // (a side in an inside corner stops short of it, so this plate and the other face's do not run into one another)
  const base = insetPoly(quad, kinds.map((k) => (k >= INSIDE ? clear : g2)));
  if (area2(base) < 1e-4) return null;
  const wMid = ((base[1][0] - base[0][0]) + (base[2][0] - base[3][0])) / 2, hMid = base[3][1] - base[0][1];
  if (wMid < 0.02 || hMid < 0.02) return null;
  const bev = Math.max(0, Math.min(o.bevel || 0, wMid * 0.3, hMid * 0.3)), top = bev > 1e-5 ? insetPoly(base, bev) : base;
  const vTop = base[3][1], vFoot = base[0][1], rise = o.rise || 0, proud = o.proud || 0;
  const lift = (v) => proud + rise * (vTop - v) / Math.max(1e-6, vTop - vFoot);
  const at = (q, h) => ({ p: add(add(add(st.O, mul(st.U, q[0])), mul(st.V, q[1])), mul(st.N, h)), uv: [q[0] + o.slide[0], q[1] + o.slide[1]], e: sideDists(base, q).map((d) => Math.max(0, d)) });
  const ground = base.map((q) => at(q, 0)), shoulder = base.map((q) => at(q, lift(q[1]))), crown = top.map((q) => at(q, lift(q[1]) + bev));
  const tone = [o.tone[0], o.tone[1], o.tone[2], bev];
  // (the wall and the bevel are seen edge on: every corner of a side's facet counts as right on that side)
  for (let k = 0; k < 4; k++) {
    const j = (k + 1) % 4;
    if (lift(base[k][1]) > 1e-4 || lift(base[j][1]) > 1e-4) G.facet([ground[k], ground[j], shoulder[j], shoulder[k]], kinds, [o.tone[0], o.tone[1], o.tone[2] * 0.7, bev]);
    if (bev > 1e-5) G.facet([shoulder[k], shoulder[j], crown[j], crown[k]], kinds, tone);
  }
  G.plates++;
  const win = o.window, tw = top[1][0] - top[0][0], th = top[3][1] - top[0][1];
  const square = Math.abs(top[0][0] - top[3][0]) < 1e-6 && Math.abs(top[1][0] - top[2][0]) < 1e-6;
  if (!win || !square || tw < win.w + 0.3 || th < win.h + 0.16) { G.facet(crown, kinds, tone); return null; }
  // a window: the top as a frame round a hole, the hole's sides sloping in to the pane
  // (the pane is sunk into its frame, never deeper than the frame is thick)
  const cx = (top[0][0] + top[1][0]) / 2, cy = (top[0][1] + top[3][1]) / 2, sink = Math.min(win.sink, win.w * 0.2, win.h * 0.2, (lift(cy) + bev) * 0.75);
  const hole = [[cx - win.w / 2 - sink, cy - win.h / 2 - sink], [cx + win.w / 2 + sink, cy - win.h / 2 - sink], [cx + win.w / 2 + sink, cy + win.h / 2 + sink], [cx - win.w / 2 - sink, cy + win.h / 2 + sink]];
  const pane = [[cx - win.w / 2, cy - win.h / 2], [cx + win.w / 2, cy - win.h / 2], [cx + win.w / 2, cy + win.h / 2], [cx - win.w / 2, cy + win.h / 2]];
  const rim = hole.map((q) => at(q, lift(q[1]) + bev)), glass = pane.map((q) => at(q, lift(q[1]) + bev - sink));
  for (let k = 0; k < 4; k++) {
    const j = (k + 1) % 4;
    G.facet([crown[k], crown[j], rim[j], rim[k]], kinds, tone);
    G.facet([rim[k], rim[j], glass[j], glass[k]], PLAIN, [o.tone[0], o.tone[1], o.tone[2] * DARK.reveal, 0]);
  }
  return glass.map((c) => c.p);
}
// a plain dark face (the backing behind the seams, a cut face): corners in the world, counter-clockwise from outside
// (every corner reads the same point of the finish's picture and the wear's, so the face stays plain)
function flat(G, pts, dark) { G.facet(pts.map((p) => ({ p, uv: [0, 0], e: FAR })), PLAIN, [0, 0, dark, 0]); }

// the plan's doors that are in one strip, as that strip's u, v: { u0, u1 (the frame's outside), v0, v1, d (the door) }
function doorsIn(plan, st) {
  return (plan.doors || []).filter((d) => d.tier === st.tier && d.step === st.step && d.run === st.run).map((d) => {
    const jamb = d.jamb ?? 1.2, sill = d.sill ?? 0.8, head = d.head ?? 0.4, v0 = (d.y ?? 0) - st.O[1];
    return { d, jamb, sill, head, u0: d.at - d.w / 2 - jamb, u1: d.at + d.w / 2 + jamb, v0, v1: v0 + sill + d.h + head };
  }).sort((a, b) => a.u0 - b.u0);
}

export const WINDOWS = { w: 2.6, h: 1.05, pitch: 4.2, lip: 0.3, sink: 0.14, skip: 5 };

// THE WHOLE HULL as lists of numbers
export function hullArrays(plan, sizes) {
  const S = { w: Math.max(0.3, sizes.w), h: Math.max(0.3, sizes.h), lap: Math.max(0, sizes.lap || 0), bevel: Math.max(0, sizes.bevel || 0), gap: Math.max(0, sizes.gap || 0), shift: Math.max(0, Math.min(0.5, sizes.shift || 0)), uneven: Math.max(0, Math.min(1, sizes.uneven || 0)) };
  const G = { band: new Lists(), tiers: new Lists(), trim: new Lists() }, W = { position: [], shade: [], index: [] }, SH = { position: [], uv: [], index: [] };
  const strips = hullStrips(plan), win = { ...WINDOWS, ...(plan.windows || {}) };
  const world = (st, q, h = 0) => add(add(add(st.O, mul(st.U, q[0])), mul(st.V, q[1])), mul(st.N, h));
  const backing = (st, quad) => flat(G.trim, quad.map((q) => world(st, q)), DARK.back);
  // rows of plates on a part of a strip
  function plates(st, part, group, o = {}) {
    const P = { ...S, ...(o.sizes || {}) }, salt = st.id * 31 + (o.salt || 0), list = layPlates(part, P, salt), out = [];
    for (const pl of list) {
      // (a lapped row is tilted: its lower edge lifted clear of the row below's top)
      const rise = pl.lap > 0.005 ? P.bevel * (pl.h + pl.lap) / pl.h + 0.012 : 0;
      const pane = plate(G[group], st, pl.quad, pl.kinds, { gap: P.gap, bevel: P.bevel, proud: o.proud || 0, rise,
        tone: [(pl.row + pl.col) % 2, hash(salt, pl.row, pl.col, 1) * 2 - 1, 1], slide: [hash(salt, pl.row, pl.col, 2) * 8, hash(salt, pl.row, pl.col, 3) * 8],
        window: o.window && o.window(pl) ? win : null });
      if (pane) out.push(pane);
    }
    return out;
  }
  // (a pane: lit, each a little brighter or dimmer than the next, about one in nine dark)
  const pane = (c) => {
    const b = W.position.length / 3, n = b / 4, lit = hash(n, 7, 3, 5) < 0.11 ? 0.05 : 0.62 + 0.38 * hash(n, 11, 5, 2);
    for (const p of c) { W.position.push(p[0], p[1], p[2]); W.shade.push(lit); }
    W.index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };

  for (const st of strips) {
    const [p0, p1, p2, p3] = st.quad, H = p3[1], K = st.kinds;
    if (st.kind === 'windows') {
      // a row of windows: a trim lip along the foot and the top, the framed panes between them
      backing(st, st.quad);
      const lip = Math.min(win.lip, H * 0.2), uAt = (a, b, v) => a[0] + (b[0] - a[0]) * v / H;
      const cut = (va, vb) => [[uAt(p0, p3, va), va], [uAt(p1, p2, va), va], [uAt(p1, p2, vb), vb], [uAt(p0, p3, vb), vb]];
      const bar = { sizes: { w: win.pitch * 2, h: lip, lap: 0, shift: 0, uneven: 0, bevel: Math.min(S.bevel, lip * 0.3), gap: S.gap }, proud: 0.2 };
      plates(st, { quad: cut(0, lip), kinds: [K[0], K[1], SEAM, K[3]] }, 'trim', { ...bar, salt: 1 });
      plates(st, { quad: cut(H - lip, H), kinds: [SEAM, K[1], K[2], K[3]] }, 'trim', { ...bar, salt: 2 });
      const panes = plates(st, { quad: cut(lip, H - lip), kinds: [SEAM, K[1], SEAM, K[3]] }, 'trim',
        { sizes: { w: win.pitch, h: H, lap: 0, shift: 0, uneven: 0, bevel: Math.min(S.bevel, 0.12), gap: S.gap }, proud: 0.1, salt: 3, window: (pl) => (pl.col + st.run * 2 + st.tier) % win.skip !== win.skip - 1 });
      for (const c of panes) pane(c);
      continue;
    }
    // a plated strip, cut round any doors in it
    const doors = doorsIn(plan, st);
    if (!doors.length) { backing(st, st.quad); plates(st, st, st.group); continue; }
    let u = null;                         // (the left side of the next stretch of wall: null is the strip's own slanted end)
    const wall = (ua, ub, va, vb, kinds) => {
      const q = [[ua ?? p0[0] + (p3[0] - p0[0]) * va / H, va], [ub ?? p1[0] + (p2[0] - p1[0]) * va / H, va], [ub ?? p1[0] + (p2[0] - p1[0]) * vb / H, vb], [ua ?? p0[0] + (p3[0] - p0[0]) * vb / H, vb]];
      if (q[1][0] - q[0][0] < 0.05 || vb - va < 0.05) return;
      backing(st, q); plates(st, { quad: q, kinds }, st.group, { salt: Math.round((ua ?? 0) * 7 + va * 13) });
    };
    for (const D of doors) {
      const { d, jamb, sill, head } = D, proud = d.proud ?? 0.45;
      wall(u, D.u0, 0, H, [K[0], SEAM, K[2], u == null ? K[3] : SEAM]);                        // the wall before the door
      wall(D.u0, D.u1, 0, D.v0, [K[0], SEAM, SEAM, SEAM]);                                     // under the frame
      wall(D.u0, D.u1, D.v1, H, [SEAM, SEAM, K[2], SEAM]);                                     // over it
      // the frame: two jambs, a sill and a head, in trim, standing proud; the opening left open, a shield across it
      const bars = [[D.u0, D.u0 + jamb, D.v0, D.v1], [D.u1 - jamb, D.u1, D.v0, D.v1], [D.u0 + jamb, D.u1 - jamb, D.v0, D.v0 + sill], [D.u0 + jamb, D.u1 - jamb, D.v1 - head, D.v1]];
      bars.forEach(([ua, ub, va, vb], k) => {
        const q = [[ua, va], [ub, va], [ub, vb], [ua, vb]];
        backing(st, q);
        plates(st, { quad: q, kinds: PLAIN }, 'trim', { sizes: { w: k < 2 ? ub - ua : S.w * 1.5, h: vb - va, lap: 0, shift: 0, uneven: 0, bevel: Math.min(Math.max(S.bevel, 0.08), 0.2), gap: S.gap }, proud: proud - Math.min(Math.max(S.bevel, 0.08), 0.2), salt: 40 + k });
      });
      const o0 = [D.u0 + jamb, D.v0 + sill], o1 = [D.u1 - jamb, D.v1 - head], sb = SH.position.length / 3;
      for (const [q, uv] of [[[o0[0], o0[1]], [0, 0]], [[o1[0], o0[1]], [1, 0]], [[o1[0], o1[1]], [1, 1]], [[o0[0], o1[1]], [0, 1]]]) { const p = world(st, q, proud * 0.35); SH.position.push(p[0], p[1], p[2]); SH.uv.push(uv[0], uv[1]); }
      SH.index.push(sb, sb + 1, sb + 2, sb, sb + 2, sb + 3);
      u = D.u1;
    }
    wall(u, null, 0, H, [K[0], K[1], K[2], SEAM]);                                              // the wall after the last door
  }

  // a piece's cut faces: its two ends and its back, dark and plain
  if (!plan.closed && plan.back != null) {
    const n = plan.path.length, B = offsetPath(plan.path, -plan.back, false);
    let yLo = Infinity, yHi = -Infinity; for (const t of plan.tiers) for (const p of t.profile) { yLo = Math.min(yLo, p[1]); yHi = Math.max(yHi, p[1]); }
    // (a face given its corners and the way it should look: turned round if it faces the other way)
    const face = (pts, out) => { const nn = cross(sub(pts[1], pts[0]), sub(pts[pts.length - 1], pts[0])); flat(G.trim, dot(nn, out) >= 0 ? pts : pts.slice().reverse(), DARK.cut); };
    for (let i = 0; i < n - 1; i++) {
      const a = B[i], b = B[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, d = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
      face([[a[0], yLo, a[1]], [b[0], yLo, b[1]], [b[0], yHi, b[1]], [a[0], yHi, a[1]]], [d[1], 0, -d[0]]);
    }
    for (const [k, sgn] of [[0, -1], [n - 1, 1]]) {
      const i = k === 0 ? 0 : n - 2, a = plan.path[i], b = plan.path[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, out = [(b[0] - a[0]) / l * sgn, 0, (b[1] - a[1]) / l * sgn];
      for (const t of plan.tiers) for (let j = 0; j < t.profile.length - 1; j++) {
        const [oa, ya] = t.profile[j], [ob, yb] = t.profile[j + 1]; if (Math.abs(yb - ya) < 1e-6) continue;
        const A = offsetPath(plan.path, oa, false)[k], C = offsetPath(plan.path, ob, false)[k], Z = B[k];
        face([[A[0], ya, A[1]], [C[0], yb, C[1]], [Z[0], yb, Z[1]], [Z[0], ya, Z[1]]], out);
      }
    }
  }

  const groups = { band: G.band.arrays(), tiers: G.tiers.arrays(), trim: G.trim.arrays() };
  const stats = { strips: strips.length, panes: W.index.length / 6, doors: SH.index.length / 6, plates: {}, triangles: {} };
  for (const k of Object.keys(groups)) { stats.plates[k] = groups[k].plates; stats.triangles[k] = groups[k].triangles; }
  stats.plates.all = stats.plates.band + stats.plates.tiers + stats.plates.trim;
  stats.triangles.all = stats.triangles.band + stats.triangles.tiers + stats.triangles.trim + stats.panes * 2 + stats.doors * 2;
  return { groups, windows: { position: new Float32Array(W.position), shade: new Float32Array(W.shade), index: new Uint32Array(W.index) },
    shields: { position: new Float32Array(SH.position), uv: new Float32Array(SH.uv), index: new Uint32Array(SH.index) }, stats, strips };
}
