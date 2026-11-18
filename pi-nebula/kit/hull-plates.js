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
//                     frames between two trim lips. A 'plates' part may also ask for any of THE SHAPES below
//                     (stack, slab, shoulders): they are made of the same plates, in the part's own group
//   doors    [{ tier, step, run, at, w, h, y, sill, head, jamb, proud }]: a hangar door in the wall that is step
//            `step` of tier `tier` on the outline's straight run `run`: its middle `at` metres along that run, the
//            opening w wide and h tall, the frame's foot at height y, a sill under the opening, a head over it, a
//            jamb each side, the frame standing `proud` of the wall. The opening is left open (a shield goes across)
//   windows  { w, h, pitch, lip, sink, panes, bar, cut, lit, seed }: a window's size, one every `pitch` along a row,
//            the lips' height, how far its glass is sunk into its frame, how many panes its glass is in and the bar
//            between them, how far its four corners are cut back (an eight-sided window; 0: square), what share of
//            the windows are lit (0.5: about half, the rest dark; which ones is settled by `seed`, so they are the
//            same windows every time). The windows come in twos and threes: of every seven frames along a row, two
//            are blank
//
//   flats    [{ group, kind, O, U, V, w, h, kinds, doors, ...shapes }]: flat faces given outright, beside the tiers or
//            in place of them (a roof, an underside, a wall of a part that has no outline of its own): O a corner in
//            the world, U along it (to the right, seen from outside), V up it, w by h metres (or quad: its four
//            corners in U, V, the foot at V = 0 and the top along U, the ends free to slant); kinds: what its foot,
//            right, top and left are against (SEAM, or INSIDE for an inside corner); doors: its own, as above with
//            `at` measured along U from O. A door may also say frame: false (no frame is built), shield: false
//            (nothing across the opening), glass: 0 to 1 (a pane of glass across it, lit that brightly)
//
// THE SHAPES a 'plates' part can ask for (the game's maker, 2026-11-18: "plates that were more tiered. So a plate
// could be on the top and overlap on two that are lower"; "a big plate sitting on-top of a flat wall section that is
// more than 10 meters or so"; "Some plate bulges should look like shoulders and some flat surfaces should have a
// recessed beveled area in the middle of them"). A FLAT STRETCH is a part of a strip with nothing cut out of it: the
// whole strip, or the wall each side of a door, under it and over it.
//   stack      STACKED PLATES: a second layer of raised plates on the first, each sitting over the seam between two
//              lower plates of a row (so a lower plate with a seam at each end carries two upper ones).
//              { cover: how much of each lower plate an upper one covers, from the seam (0.4 of its width, a
//                little more or less from plate to plate, never as much as half),
//                step: how far an upper plate's foot stands above the lower plates' tops (0.3 m),
//                margin: how far it stops short of its row's foot and top, as a part of the row's height (0.1),
//                heavier: its bevel, as so many times the look's (1.4), or bevel: its bevel in metres,
//                cut: its corner cut (the look's, if not given) }
//   slab       A BIG RAISED PLATE on every flat stretch at least `over` long or tall (10 m) and at least `least`
//              the other way (4 m): one slab `inset` in from the stretch's edges, standing `proud` of the wall, its
//              bevel `bevel` wide and deep, its corners cut by `cut`; the wall's own plates are laid round it.
//              recess: A RECESSED PANEL in the slab's middle: { inset: from the edge of the slab's flat top to the
//              panel's mouth, depth: how far it is sunk (its sides slope in at 45 degrees), cut: its corners }
//   shoulders  SHOULDERS: thick blocks on every flat stretch at least `least` tall (3 m): one at each end of the
//              stretch, or one filling it if it is narrower than 1.6 blocks (the wall each side of a door, so a door
//              gets a shoulder each side). { w: a block's width, inset: in from the stretch's edges, foot, top: where
//              it starts and stops up the stretch (0 to 1: 0.36 to 1, the upper part), proud, bevel, cut }.
//              With a slab as well, the big plate goes on what is left of the stretch between its two shoulders
//
// THE PLATES' SIZES  { w, h, lap, bevel, gap, cut, shift, uneven, unevenRows }   (kit/hull-look.js plateSizes(look))
//   Each strip is laid in rows `h` tall of plates `w` wide (fitted, so a whole number fills the strip). A plate is a
//   flat top with a 45-degree bevel all round, `bevel` wide and deep, standing on the dark backing; its four corners
//   are cut back at 45 degrees by `cut` (the kit's "rectangular octagon"; the trim's plates keep theirs); `gap` is the seam
//   between neighbours; each row is slid `shift` of a plate along from the row below; `uneven` (0 to 1) makes the
//   plates of a row differ in width, `unevenRows` the rows differ in height. With `lap`, every row reaches that far down over the row below, tilted like a
//   roof tile, its lower edge standing clear.
//
// WHAT COMES OUT  hullArrays(plan, sizes) -> { groups: { band, tiers, trim }, windows, shields, stats }
//   a group   position, normal, uv (metres, slid by a different amount on each plate so a finish never runs across a
//             seam), edge (each corner's distance to its plate's four sides: foot, right, top, left), kind (how wide
//             the shading along each of those sides is: SEAM or INSIDE), tone (which grey: 0 main, 1 second; a random
//             -1..1 for the plate; how dark: 1 a plate, less for the backing and the cut faces; the plate's own
//             bevel, metres), cut (the plate's corner cut, metres), index
//   windows   the glass: position, shade (how brightly each corner is lit, 0 to 1: a lit window's foot dimmer than its
//             top, a dark window nearly black all over), index. One eight-sided piece of glass a window; the bars
//             between its panes are thin dark strips in the trim, just in front of it
//   shields   the doors' openings: position, uv, index
//   stats     plates and triangles for each group, windows (and how many are lit), glass (its triangles), strips,
//             shapes: { stacked, slabs, recesses, shoulders } (how many of each were made)
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
  const path = plan.path || [], tiers = plan.tiers || [], closed = !!plan.closed, n = path.length, runs = closed ? n : n - 1, strips = [];
  const offs = new Map(), off = (o) => { const k = o.toFixed(4); if (!offs.has(k)) offs.set(k, offsetPath(path, o, closed)); return offs.get(k); };
  const dir = (i) => { const a = path[i], b = path[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  // (a corner of the outline between run i and the next: an inside corner if the next run turns toward the outside)
  const turnIn = (i) => { const a = dir(i), b = dir((i + 1) % runs); return b[0] * -a[1] + b[1] * a[0] > 1e-6; };
  tiers.forEach((tier, ti) => {
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
        strips.push({ id: strips.length, tier: ti, step: j, run: i, group: part.group, kind: part.kind || 'plates', part, O: A0, U, V, N,
          quad: [[0, 0], [La, 0], [dot(sub(B1, A0), U), H], [dot(sub(B0, A0), U), H]], kinds: [foot, right, head, left] });
      }
    }
  });
  // THE FLATS: flat faces given outright, each in its own frame (a roof, an underside, a wall that is not part of an
  // outline). A flat is laid, cut round its doors and given its shapes exactly as a strip of a tier is.
  (plan.flats || []).forEach((f, k) => {
    const U = unit(f.U), V = unit(f.V), N = unit(cross(U, V));
    strips.push({ id: strips.length, tier: tiers.length + k, step: 0, run: 0, group: f.group || 'tiers', kind: f.kind || 'plates', part: f, O: f.O, U, V, N,
      quad: f.quad || [[0, 0], [f.w, 0], [f.w, f.h], [0, f.h]], kinds: f.kinds || [SEAM, SEAM, SEAM, SEAM], doors: f.doors || [] });
  });
  return strips;
}

// ── LAYING PLATES ───────────────────────────────────────────────────────────────────────────────────────────────
// the plates of one four-sided part of a strip: rows h tall, plates w wide, fitted. Returns each plate's four corners
// (before the seam is cut round it), what each of its sides is against, and its row and place in the row.
//   part   { quad, kinds }: the foot and the top along u; the ends may slant
//   S      { w, h, lap, shift, uneven, unevenRows }; salt: a number that makes this part's uneven widths its own;
//          rowSalt: one for its uneven heights (the same for every part that should keep the same rows)
export function layPlates(part, S, salt = 0, rowSalt = salt) {
  const [p0, p1, p2, p3] = part.quad, v0 = p0[1], v1 = p3[1], H = v1 - v0, out = [];
  if (H < 1e-4) return out;
  const uL = (v) => p0[0] + (p3[0] - p0[0]) * (v - v0) / H, uR = (v) => p1[0] + (p2[0] - p1[0]) * (v - v0) / H;
  const rows = Math.max(1, Math.round(H / S.h));
  // (the rows' heights: all the same, or each its own when the heights are uneven; together they still fill the strip)
  const share = Array.from({ length: rows }, (_, r) => 1 + (hash(rowSalt, r, 77, 4) - 0.5) * 0.9 * (S.unevenRows || 0)), all = share.reduce((x, y) => x + y, 0), tops = [];
  share.reduce((sum, x) => { tops.push(v0 + H * (sum + x) / all); return sum + x; }, 0);
  for (let r = 0; r < rows; r++) {
    const a = r ? tops[r - 1] : v0, b = r === rows - 1 ? v1 : tops[r], hr = b - a, lap = Math.min(S.lap || 0, hr * 0.6), mid = (a + b) / 2, span = uR(mid) - uL(mid);
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

const FAR = [50, 50, 50, 50], PLAIN = [SEAM, SEAM, SEAM, SEAM];

// ── THE LISTS OF NUMBERS ────────────────────────────────────────────────────────────────────────────────────────
class Lists {
  constructor() { this.position = []; this.normal = []; this.uv = []; this.edge = []; this.kind = []; this.tone = []; this.cut = []; this.index = []; this.plates = 0; }
  get count() { return this.position.length / 3; }
  // a flat facet: its corners (3 or more, counter-clockwise seen from outside), each { p: [x, y, z], uv: [u, v], e: [4] };
  // tone: [which grey, the plate's random, how dark, the plate's bevel, the plate's corner cut]
  facet(c, kind, tone) {
    // (its normal from all its corners, so a facet squeezed to a triangle at one end still has one)
    const n = [0, 0, 0];
    for (let i = 0; i < c.length; i++) { const a = c[i].p, b = c[(i + 1) % c.length].p; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-9) return 0;
    const base = this.count; let made = 0;
    for (const v of c) { this.position.push(v.p[0], v.p[1], v.p[2]); this.normal.push(n[0] / l, n[1] / l, n[2] / l); this.uv.push(v.uv[0], v.uv[1]); this.edge.push(v.e[0], v.e[1], v.e[2], v.e[3]); this.kind.push(kind[0], kind[1], kind[2], kind[3]); this.tone.push(tone[0], tone[1], tone[2], tone[3] || 0); this.cut.push(tone[4] || 0); }
    for (let i = 1; i < c.length - 1; i++) {
      const t = cross(sub(c[i].p, c[0].p), sub(c[i + 1].p, c[0].p));
      if (Math.hypot(t[0], t[1], t[2]) > 1e-9) { this.index.push(base, base + i, base + i + 1); made++; }
    }
    return made;
  }
  arrays() {
    return { position: new Float32Array(this.position), normal: new Float32Array(this.normal), uv: new Float32Array(this.uv), edge: new Float32Array(this.edge),
      kind: new Float32Array(this.kind), tone: new Float32Array(this.tone), cut: new Float32Array(this.cut), index: new Uint32Array(this.index), plates: this.plates, triangles: this.index.length / 3 };
  }
}

// ONE PLATE on a strip: the seam cut round it, a wall up from the backing where it stands proud or is tilted, the
// bevel, the flat top (with a hole sunk in it, if it has one). Returns the hole's floor, if it has one: { floor: its
// corners in the strip's u, v; rect: [x0, y0, x1, y1]; cut; h: how far off the wall it is }.
//   o   { gap, bevel, cut (its four corners cut back at 45 degrees by this much: the kit's "rectangular octagon"),
//         proud (how far its foot stands off the backing), rise (how far its lower edge is lifted over its upper edge:
//         the lap's tilt), tone: [which grey, random, how dark], slide: [du, dv] (the finish slid by this),
//         hole: A HOLE SUNK IN ITS TOP, its sides sloping in at 45 degrees to a floor that is left for whoever asked
//               (a window's glass, a recessed panel's floor). Given by its floor { w, h, cut, depth } (a window: the
//               glass's size) or by its mouth { inset: in from the top's edge, cut, depth }; keep: the most of the
//               plate's thickness it may be sunk through (0.75); dark: how dark its sloping sides are }
const K8 = 2 - Math.SQRT2;              // (a corner cut shrinks by this much of the distance its plate's sides move in)
const MIN_CUT = 0.02;                   // (a corner cut smaller than this cannot be seen and is not made: it would cost twelve triangles a plate)
const octagon = (r, c) => [[r[0][0] + c, r[0][1]], [r[1][0] - c, r[1][1]], [r[1][0], r[1][1] + c], [r[2][0], r[2][1] - c], [r[2][0] - c, r[2][1]], [r[3][0] + c, r[3][1]], [r[3][0], r[3][1] - c], [r[0][0], r[0][1] + c]];
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// where a hole goes in a plate's flat top (`face`, `thick` off the wall): its mouth, its mouth's corner cut and its
// depth; or null if it does not fit
function holeIn(face, h, thick) {
  if (!h) return null;
  const fw = face[1][0] - face[0][0], fh = face[3][1] - face[0][1], cx = (face[0][0] + face[1][0]) / 2, cy = (face[0][1] + face[3][1]) / 2;
  let depth = Math.min(h.depth, thick * (h.keep ?? 0.75)), mw, mh, cut;
  if (h.w != null) { depth = Math.min(depth, h.w * 0.2, h.h * 0.2); mw = h.w + 2 * depth; mh = h.h + 2 * depth; cut = h.cut >= MIN_CUT ? h.cut + depth * K8 : 0; }
  else { mw = fw - 2 * h.inset; mh = fh - 2 * h.inset; cut = h.cut || 0; }
  if (depth < 0.01 || mw > fw - 0.02 || mh > fh - 0.02 || mw < 2 * depth + 0.2 || mh < 2 * depth + 0.2) return null;
  return { x0: cx - mw / 2, y0: cy - mh / 2, x1: cx + mw / 2, y1: cy + mh / 2, cut: Math.min(cut, mw * 0.3, mh * 0.3), depth };
}
function plate(G, st, quad, kinds, o) {
  const g2 = Math.max(0, o.gap / 2), clear = (o.bevel || 0) + g2 + 0.01;
  // (a side in an inside corner stops short of it, so this plate and the other face's do not run into one another)
  const base = insetPoly(quad, kinds.map((k) => (k >= INSIDE ? clear : g2)));
  if (area2(base) < 1e-4) return null;
  const wMid = ((base[1][0] - base[0][0]) + (base[2][0] - base[3][0])) / 2, hMid = base[3][1] - base[0][1];
  if (wMid < 0.02 || hMid < 0.02) return null;
  const bev = Math.max(0, Math.min(o.bevel || 0, wMid * 0.3, hMid * 0.3)), face = bev > 1e-5 ? insetPoly(base, bev) : base;
  // (only a plate with square ends has its corners cut; one with a slanted end, where two runs meet, keeps them)
  const square = Math.abs(base[0][0] - base[3][0]) < 1e-6 && Math.abs(base[1][0] - base[2][0]) < 1e-6;
  const cut = square && (o.cut || 0) >= MIN_CUT ? Math.min(o.cut, wMid * 0.3, hMid * 0.3) : 0;
  const rim = cut ? octagon(base, cut) : base, top = cut ? octagon(face, Math.max(1e-4, cut - bev * K8)) : face, n = rim.length;
  const vTop = base[3][1], vFoot = base[0][1], rise = o.rise || 0, proud = o.proud || 0;
  const lift = (v) => proud + rise * (vTop - v) / Math.max(1e-6, vTop - vFoot);
  // (every corner knows how far it is from its plate's four sides, as they were before any corner was cut)
  const at = (q, h) => ({ p: add(add(add(st.O, mul(st.U, q[0])), mul(st.V, q[1])), mul(st.N, h)), uv: [q[0] + o.slide[0], q[1] + o.slide[1]], e: sideDists(base, q).map((d) => Math.max(0, d)) });
  const ground = rim.map((q) => at(q, 0)), shoulder = rim.map((q) => at(q, lift(q[1]))), crown = top.map((q) => at(q, lift(q[1]) + bev));
  const tone = [o.tone[0], o.tone[1], o.tone[2], bev, cut];
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n;
    if (lift(rim[k][1]) > 1e-4 || lift(rim[j][1]) > 1e-4) {
      // (the finish carries on down the wall as if it were folded out flat, so it is not smeared)
      const l = Math.hypot(rim[j][0] - rim[k][0], rim[j][1] - rim[k][1]) || 1, ox = (rim[j][1] - rim[k][1]) / l, oy = -(rim[j][0] - rim[k][0]) / l;
      const foot = (g, q) => ({ p: g.p, e: g.e, uv: [g.uv[0] + ox * lift(q[1]), g.uv[1] + oy * lift(q[1])] });
      G.facet([foot(ground[k], rim[k]), foot(ground[j], rim[j]), shoulder[j], shoulder[k]], kinds, [o.tone[0], o.tone[1], o.tone[2] * 0.7, bev, cut]);
    }
    if (bev > 1e-5) G.facet([shoulder[k], shoulder[j], crown[j], crown[k]], kinds, tone);
  }
  G.plates++;
  const hole = square && !rise ? holeIn(face, o.hole, proud + bev) : null;
  if (!hole) { G.facet(crown, kinds, tone); return null; }
  // a hole: the top as a frame round its mouth, its sides sloping in to its floor. The mouth has eight corners if the
  // hole's are cut (or the plate's own are), four if not
  const d = hole.depth, eight = n === 8 || hole.cut >= MIN_CUT, mc = Math.max(hole.cut, 1e-3), fc = Math.max(mc - d * K8, 1e-3);
  const mr = rect(hole.x0, hole.y0, hole.x1, hole.y1), fr = rect(hole.x0 + d, hole.y0 + d, hole.x1 - d, hole.y1 - d);
  const mouthUV = eight ? octagon(mr, mc) : mr, floorUV = eight ? octagon(fr, fc) : fr, m = mouthUV.length;
  const mouth = mouthUV.map((q) => at(q, proud + bev)), floor = floorUV.map((q) => at(q, proud + bev - d));
  if (n === m) for (let k = 0; k < n; k++) { const j = (k + 1) % n; G.facet([crown[k], crown[j], mouth[j], mouth[k]], kinds, tone); }
  // (a square top round an eight-sided mouth: a piece along each side, a triangle at each corner)
  else for (let k = 0; k < 4; k++) { const j = (k + 1) % 4; G.facet([crown[k], crown[j], mouth[2 * k + 1], mouth[2 * k]], kinds, tone); G.facet([crown[j], mouth[(2 * k + 2) % 8], mouth[2 * k + 1]], kinds, tone); }
  const side = [o.tone[0], o.tone[1], o.tone[2] * (o.hole.dark ?? 0.8), 0, 0];
  for (let k = 0; k < m; k++) { const j = (k + 1) % m; G.facet([mouth[k], mouth[j], floor[j], floor[k]], PLAIN, side); }
  return { floor: floorUV, rect: [hole.x0 + d, hole.y0 + d, hole.x1 - d, hole.y1 - d], cut: eight ? fc : 0, h: proud + bev - d };
}
// a plain dark face (the backing behind the seams, a cut face): corners in the world, counter-clockwise from outside
// (every corner reads the same point of the finish's picture and the wear's, so the face stays plain)
function flat(G, pts, dark) { G.facet(pts.map((p) => ({ p, uv: [0, 0], e: FAR })), PLAIN, [0, 0, dark, 0, 0]); }

// the plan's doors that are in one strip, as that strip's u, v: { u0, u1 (the frame's outside), v0, v1, d (the door) }
function doorsIn(plan, st) {
  return (st.doors || (plan.doors || []).filter((d) => d.tier === st.tier && d.step === st.step && d.run === st.run)).map((d) => {
    const jamb = d.jamb ?? 1.2, sill = d.sill ?? 0.8, head = d.head ?? 0.4, v0 = (d.y ?? 0) - st.O[1];
    return { d, jamb, sill, head, u0: d.at - d.w / 2 - jamb, u1: d.at + d.w / 2 + jamb, v0, v1: v0 + sill + d.h + head };
  }).sort((a, b) => a.u0 - b.u0);
}

export const WINDOWS = { w: 2.6, h: 1.05, pitch: 4.2, lip: 0.3, sink: 0.14, panes: 2, bar: 0.09, cut: 0.3, lit: 0.5, seed: 11 };
// the shapes' own sizes, where a part does not give them (metres)
export const STACK = { cover: 0.4, step: 0.3, margin: 0.1, heavier: 1.4 };
export const SLAB = { over: 10, least: 4, inset: 1.4, proud: 0.3, bevel: 0.45, cut: 0 };
export const RECESS = { inset: 1.9, depth: 0.5, cut: 0.5 };
export const SHOULDERS = { least: 3, w: 4.2, inset: 0.35, foot: 0.36, top: 1, proud: 0.7, bevel: 0.55, cut: 0.9 };

// THE WHOLE HULL as lists of numbers
export function hullArrays(plan, sizes) {
  const S = { w: Math.max(0.3, sizes.w), h: Math.max(0.3, sizes.h), lap: Math.max(0, sizes.lap || 0), bevel: Math.max(0, sizes.bevel || 0), gap: Math.max(0, sizes.gap || 0), shift: Math.max(0, Math.min(0.5, sizes.shift || 0)), uneven: Math.max(0, Math.min(1, sizes.uneven || 0)), unevenRows: Math.max(0, Math.min(1, sizes.unevenRows || 0)), cut: Math.max(0, sizes.cut || 0) };
  const G = { band: new Lists(), tiers: new Lists(), trim: new Lists() }, W = { position: [], shade: [], index: [] }, SH = { position: [], uv: [], index: [] };
  const strips = hullStrips(plan), win = { ...WINDOWS, ...(plan.windows || {}) }, made = { stacked: 0, slabs: 0, recesses: 0, shoulders: 0 };
  const world = (st, q, h = 0) => add(add(add(st.O, mul(st.U, q[0])), mul(st.V, q[1])), mul(st.N, h));
  const backing = (st, quad) => flat(G.trim, quad.map((q) => world(st, q)), DARK.back);
  // rows of plates on a part of a strip
  //   o   { sizes, salt, cut, proud, window: (plate) => true for a frame with a window in it, stack: STACKED PLATES }
  function plates(st, part, group, o = {}) {
    // (uneven rows go by the tier and its step, not by the strip: a row carries on at one height round every corner)
    const P = { ...S, ...(o.sizes || {}) }, salt = st.id * 31 + (o.salt || 0), list = layPlates(part, P, salt, st.tier * 131 + st.step * 17 + 5), out = [];
    // (a window's glass is sunk into its frame, never deeper than the frame is thick)
    const hole = o.window ? { w: win.w, h: win.h, cut: win.cut, depth: win.sink, dark: DARK.reveal } : null;
    for (const pl of list) {
      // (a lapped row is tilted: its lower edge lifted clear of the row below's top)
      const rise = pl.lap > 0.005 ? P.bevel * (pl.h + pl.lap) / pl.h + 0.012 : 0;
      const sunk = plate(G[group], st, pl.quad, pl.kinds, { gap: P.gap, bevel: P.bevel, cut: o.cut ?? P.cut, proud: o.proud || 0, rise,
        tone: [(pl.row + pl.col) % 2, hash(salt, pl.row, pl.col, 1) * 2 - 1, 1], slide: [hash(salt, pl.row, pl.col, 2) * 8, hash(salt, pl.row, pl.col, 3) * 8],
        hole: hole && o.window(pl) ? hole : null });
      if (sunk) out.push({ ...sunk, col: pl.col });
    }
    // STACKED PLATES: over every seam between two plates of a row, a raised plate that sits on them both. (Not on
    // lapped rows: they are tilted.)
    if (o.stack && !(P.lap > 0.005)) for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i], b = list[i + 1]; if (a.row !== b.row) continue;
      const K = { ...STACK, ...(o.stack === true ? {} : o.stack) }, u = a.quad[1][0], wide = (pl) => Math.min(pl.quad[1][0] - pl.quad[0][0], pl.quad[2][0] - pl.quad[3][0]);
      // (how much of each neighbour it covers differs a little from plate to plate; never as much as half)
      const f = Math.min(0.46, K.cover * (0.8 + 0.4 * hash(salt, a.row, a.col, 21))), v0 = a.quad[0][1], v1 = a.quad[3][1], m = Math.max(0.15, K.margin * (v1 - v0));
      const q = rect(u - f * wide(a), v0 + m, u + f * wide(b), v1 - m);
      if (q[1][0] - q[0][0] < 0.8 || q[3][1] - q[0][1] < 0.5) continue;
      // (it stands on the lower plates' tops: their bevel is as deep as it is wide, less on a small plate)
      const under = Math.min(P.bevel, wide(a) * 0.3, wide(b) * 0.3, (v1 - v0) * 0.3), before = G[group].plates;
      plate(G[group], st, q, PLAIN, { gap: 0, bevel: K.bevel ?? P.bevel * K.heavier, cut: K.cut ?? o.cut ?? P.cut, proud: under + K.step,
        tone: [(a.row + a.col + 1) % 2, hash(salt, a.row, a.col, 22) * 2 - 1, 1], slide: [hash(salt, a.row, a.col, 23) * 8, hash(salt, a.row, a.col, 24) * 8] });
      made.stacked += G[group].plates - before;
    }
    return out;
  }
  // A WINDOW'S GLASS: one piece, lit or dark (about half of them lit: which ones is settled by where the window is, so
  // they are the same windows every time), a lit one a little brighter or dimmer than the next and dimmer at its foot
  // than at its top, as a lit room shows. The bars between its panes: thin dark strips just in front of it.
  let windows = 0, lit = 0, panes = 0;
  const glaze = (st, g) => {
    const on = hash(st.tier * 16 + st.run, g.col, win.seed, 5) < win.lit, bright = on ? 0.62 + 0.38 * hash(st.tier * 16 + st.run, g.col, 11, 2) : 0.05, b = W.position.length / 3, [x0, y0, x1, y1] = g.rect;
    windows++; if (on) lit++;
    for (const q of g.floor) { const p = world(st, q, g.h); W.position.push(p[0], p[1], p[2]); W.shade.push(on ? bright * (0.7 + 0.3 * (q[1] - y0) / (y1 - y0)) : bright); }
    for (let i = 1; i < g.floor.length - 1; i++) W.index.push(b, b + i, b + i + 1);
    const count = Math.max(1, Math.round(win.panes || 1)), bar = Math.min(win.bar ?? 0.09, (x1 - x0) * 0.1);
    for (let i = 1; i < count; i++) { const x = x0 + (x1 - x0) * i / count; flat(G.trim, rect(x - bar / 2, y0, x + bar / 2, y1).map((q) => world(st, q, g.h + 0.015)), DARK.back * 0.6); }
  };

  for (const st of strips) {
    const [p0, p1, p2, p3] = st.quad, H = p3[1], K = st.kinds, part = st.part || {};
    if (st.kind === 'windows') {
      // a row of windows: a trim lip along the foot and the top, the framed panes between them
      backing(st, st.quad);
      const lip = Math.min(win.lip, H * 0.2), uAt = (a, b, v) => a[0] + (b[0] - a[0]) * v / H;
      const cut = (va, vb) => [[uAt(p0, p3, va), va], [uAt(p1, p2, va), va], [uAt(p1, p2, vb), vb], [uAt(p0, p3, vb), vb]];
      const bar = { sizes: { w: win.pitch * 2, h: lip, lap: 0, shift: 0, uneven: 0, unevenRows: 0, bevel: Math.min(S.bevel, lip * 0.3), gap: S.gap }, proud: 0.2, cut: 0 };
      plates(st, { quad: cut(0, lip), kinds: [K[0], K[1], SEAM, K[3]] }, 'trim', { ...bar, salt: 1 });
      plates(st, { quad: cut(H - lip, H), kinds: [SEAM, K[1], K[2], K[3]] }, 'trim', { ...bar, salt: 2 });
      const glass = plates(st, { quad: cut(lip, H - lip), kinds: [SEAM, K[1], SEAM, K[3]] }, 'trim',
        { sizes: { w: win.pitch, h: H, lap: 0, shift: 0, uneven: 0, unevenRows: 0, bevel: Math.min(S.bevel, 0.12), gap: S.gap }, proud: 0.1, salt: 3, cut: 0,
          // (the windows come in twos and threes: of every seven frames along a row, the third and the seventh are blank)
          window: (pl) => ![2, 6].includes((pl.col + st.run * 3 + st.tier * 2) % 7) });
      for (const g of glass) glaze(st, g);
      continue;
    }
    // a plated strip. The part of it between two heights and two places along it (null: the strip's own slanted end)
    const cutOut = (ua, ub, va, vb) => (ua == null && ub == null && va === 0 && vb === H ? st.quad
      : [[ua ?? p0[0] + (p3[0] - p0[0]) * va / H, va], [ub ?? p1[0] + (p2[0] - p1[0]) * va / H, va], [ub ?? p1[0] + (p2[0] - p1[0]) * vb / H, vb], [ua ?? p0[0] + (p3[0] - p0[0]) * vb / H, vb]]);
    // a wall: its dark backing and its rows of plates (stacked, if the part asks)
    const wall = (ua, ub, va, vb, kinds) => {
      const q = cutOut(ua, ub, va, vb);
      if (q[1][0] - q[0][0] < 0.05 || vb - va < 0.05) return;
      backing(st, q); plates(st, { quad: q, kinds }, st.group, { salt: Math.round((ua ?? 0) * 7 + va * 13), stack: part.stack });
    };
    // one thick plate standing on the wall (a big raised plate, a shoulder), with a recessed panel in it if asked
    const block = (b, o, salt) => {
      const q = rect(b.u0, b.v0, b.u1, b.v1), id = st.id * 31 + salt, tone = [0, hash(id, 3, 5, 1) * 2 - 1, 1], slide = [hash(id, 3, 5, 2) * 8, hash(id, 3, 5, 3) * 8];
      backing(st, q);
      const R = o.recess ? { ...RECESS, ...(o.recess === true ? {} : o.recess) } : null;
      const sunk = plate(G[st.group], st, q, PLAIN, { gap: S.gap, bevel: o.bevel, cut: o.cut, proud: o.proud, tone, slide, hole: R && { inset: R.inset, cut: R.cut, depth: R.depth, keep: 0.8 } });
      if (!sunk) return;
      // (the panel's floor: a plate of its own, in the second grey, a little darker, shaded in from its rim as an inside corner is)
      const [x0, y0, x1, y1] = sunk.rect;
      plate(G[st.group], { ...st, O: add(st.O, mul(st.N, sunk.h)) }, rect(x0, y0, x1, y1), [INSIDE, INSIDE, INSIDE, INSIDE], { gap: 0, bevel: 0, cut: sunk.cut, proud: 0, tone: [1, -tone[1], 0.88], slide: [slide[1], slide[0]] });
      made.recesses++;
    };
    // A FLAT STRETCH of the strip: its shoulders and its big raised plate, where the part asks for them and the stretch
    // is big enough, and the wall's own plates round them
    const stretch = (ua, ub, va, vb, kinds) => {
      const q = cutOut(ua, ub, va, vb), x0 = Math.max(q[0][0], q[3][0]), x1 = Math.min(q[1][0], q[2][0]), w = x1 - x0, h = vb - va, blocks = [];
      const sl = part.slab ? { ...SLAB, ...(part.slab === true ? {} : part.slab) } : null, sh = part.shoulders ? { ...SHOULDERS, ...(part.shoulders === true ? {} : part.shoulders) } : null;
      // (shoulders first: one at each end, or one filling a narrow stretch; then a big plate on what is left between them)
      let lo = x0, hi = x1;
      if (sh && h >= sh.least) {
        const n = w >= sh.w * 1.6 ? 2 : 1, bw = n === 2 ? Math.min(sh.w, (w - 3 * sh.inset) / 2) : w - 2 * sh.inset, v0 = va + Math.max(sh.inset, sh.foot * h), v1 = va + Math.min(h - sh.inset, sh.top * h);
        if (bw >= 0.8 && v1 - v0 >= 1.5) {
          for (let i = 0; i < n; i++) blocks.push({ u0: i ? x1 - sh.inset - bw : x0 + sh.inset, u1: i ? x1 - sh.inset : x0 + sh.inset + bw, v0, v1, o: sh, kind: 'shoulders' });
          if (n === 2) { lo = blocks[0].u1; hi = blocks[1].u0; } else hi = lo;
        }
      }
      if (sl && Math.max(hi - lo, h) >= sl.over && Math.min(hi - lo, h) >= sl.least && Math.min(hi - lo, h) - 2 * sl.inset >= 1.5) blocks.splice(blocks.length ? 1 : 0, 0, { u0: lo + sl.inset, u1: hi - sl.inset, v0: va + sl.inset, v1: vb - sl.inset, o: sl, kind: 'slabs' });
      let u = ua;
      blocks.forEach((b, i) => {
        wall(u, b.u0, va, vb, [kinds[0], SEAM, kinds[2], i ? SEAM : kinds[3]]);
        wall(b.u0, b.u1, va, b.v0, [kinds[0], SEAM, SEAM, SEAM]); wall(b.u0, b.u1, b.v1, vb, [SEAM, SEAM, kinds[2], SEAM]);
        block(b, b.o, Math.round(b.u0 * 7 + b.v0 * 13) + 500); made[b.kind]++;
        u = b.u1;
      });
      wall(u, ub, va, vb, [kinds[0], kinds[1], kinds[2], blocks.length ? SEAM : kinds[3]]);
    };
    // the strip, cut round any doors in it
    let u = null;                         // (the left side of the next stretch of wall: null is the strip's own slanted end)
    for (const D of doorsIn(plan, st)) {
      const { d, jamb, sill, head } = D, proud = d.proud ?? 0.45;
      stretch(u, D.u0, 0, H, [K[0], SEAM, K[2], u == null ? K[3] : SEAM]);                     // the wall before the door
      stretch(D.u0, D.u1, 0, D.v0, [K[0], SEAM, SEAM, SEAM]);                                  // under the frame
      stretch(D.u0, D.u1, D.v1, H, [SEAM, SEAM, K[2], SEAM]);                                  // over it
      // the frame: two jambs, a sill and a head, in trim, standing proud; the opening left open, a shield across it
      const bars = [[D.u0, D.u0 + jamb, D.v0, D.v1], [D.u1 - jamb, D.u1, D.v0, D.v1], [D.u0 + jamb, D.u1 - jamb, D.v0, D.v0 + sill], [D.u0 + jamb, D.u1 - jamb, D.v1 - head, D.v1]];
      if (d.frame !== false) bars.forEach(([ua, ub, va, vb], k) => {
        const q = [[ua, va], [ub, va], [ub, vb], [ua, vb]];
        backing(st, q);
        plates(st, { quad: q, kinds: PLAIN }, 'trim', { sizes: { w: k < 2 ? ub - ua : S.w * 1.5, h: vb - va, lap: 0, shift: 0, uneven: 0, unevenRows: 0, bevel: Math.min(Math.max(S.bevel, 0.08), 0.2), gap: S.gap }, proud: proud - Math.min(Math.max(S.bevel, 0.08), 0.2), salt: 40 + k, cut: 0 });
      });
      const o0 = [D.u0 + jamb, D.v0 + sill], o1 = [D.u1 - jamb, D.v1 - head], sb = SH.position.length / 3;
      if (d.glass != null) {
        // (a real room's window: one pane of glass a little way in, lit as brightly as asked, dimmer at its foot)
        const b = W.position.length / 3;
        for (const [q, k] of [[[o0[0], o0[1]], 0.7], [[o1[0], o0[1]], 0.7], [[o1[0], o1[1]], 1], [[o0[0], o1[1]], 1]]) { const p = world(st, q, -(d.sink ?? 0.12)); W.position.push(p[0], p[1], p[2]); W.shade.push(d.glass * k); }
        W.index.push(b, b + 1, b + 2, b, b + 2, b + 3); panes++;
      } else if (d.shield !== false) {
        for (const [q, uv] of [[[o0[0], o0[1]], [0, 0]], [[o1[0], o0[1]], [1, 0]], [[o1[0], o1[1]], [1, 1]], [[o0[0], o1[1]], [0, 1]]]) { const p = world(st, q, proud * 0.35); SH.position.push(p[0], p[1], p[2]); SH.uv.push(uv[0], uv[1]); }
        SH.index.push(sb, sb + 1, sb + 2, sb, sb + 2, sb + 3);
      }
      u = D.u1;
    }
    stretch(u, null, 0, H, [K[0], K[1], K[2], u == null ? K[3] : SEAM]);                        // the wall after the last door (or the whole strip)
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
  const stats = { strips: strips.length, windows, lit, panes, glass: W.index.length / 3, doors: SH.index.length / 6, shapes: made, plates: {}, triangles: {} };
  for (const k of Object.keys(groups)) { stats.plates[k] = groups[k].plates; stats.triangles[k] = groups[k].triangles; }
  stats.plates.all = stats.plates.band + stats.plates.tiers + stats.plates.trim;
  stats.triangles.all = stats.triangles.band + stats.triangles.tiers + stats.triangles.trim + stats.glass + stats.doors * 2;
  return { groups, windows: { position: new Float32Array(W.position), shade: new Float32Array(W.shade), index: new Uint32Array(W.index) },
    shields: { position: new Float32Array(SH.position), uv: new Float32Array(SH.uv), index: new Uint32Array(SH.index) }, stats, strips };
}

// SEVERAL HULLS AS ONE: the lists of numbers of each (hullArrays) joined end to end, so a station made of many parts is
// still one mesh for each group of plates, one for the glass and one for the shields.
export function mergeHulls(list) {
  if (list.length === 1) return list[0];
  const cat = (arrs, T = Float32Array) => { let n = 0; for (const a of arrs) n += a.length; const out = new T(n); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out; };
  const idx = (parts) => { let n = 0; for (const p of parts) n += p.index.length; const out = new Uint32Array(n); let o = 0, base = 0; for (const p of parts) { for (let i = 0; i < p.index.length; i++) out[o + i] = p.index[i] + base; o += p.index.length; base += p.position.length / 3; } return out; };
  const groups = {}, sum = (f) => list.reduce((t, a) => t + f(a), 0);
  for (const g of ['band', 'tiers', 'trim']) {
    const P = list.map((a) => a.groups[g]); groups[g] = { index: idx(P), plates: P.reduce((t, p) => t + p.plates, 0), triangles: P.reduce((t, p) => t + p.triangles, 0) };
    for (const k of ['position', 'normal', 'uv', 'edge', 'kind', 'tone', 'cut']) groups[g][k] = cat(P.map((p) => p[k]));
  }
  const Wn = list.map((a) => a.windows), Sh = list.map((a) => a.shields), stats = { strips: sum((a) => a.stats.strips), windows: sum((a) => a.stats.windows), lit: sum((a) => a.stats.lit), panes: sum((a) => a.stats.panes), glass: sum((a) => a.stats.glass), doors: sum((a) => a.stats.doors), shapes: {}, plates: {}, triangles: {} };
  for (const k of ['stacked', 'slabs', 'recesses', 'shoulders']) stats.shapes[k] = sum((a) => a.stats.shapes[k]);
  for (const k of ['band', 'tiers', 'trim', 'all']) { stats.plates[k] = sum((a) => a.stats.plates[k]); stats.triangles[k] = sum((a) => a.stats.triangles[k]); }
  return { groups, windows: { position: cat(Wn.map((w) => w.position)), shade: cat(Wn.map((w) => w.shade)), index: idx(Wn) },
    shields: { position: cat(Sh.map((w) => w.position)), uv: cat(Sh.map((w) => w.uv)), index: idx(Sh) }, stats, strips: list.flatMap((a) => a.strips) };
}
