// THE DOCK'S BRIDGE: the docking port's telescoping bridge, the lattice tube the game's maker picked (option C of the
// dock's option sheet: a round glass tube held by a lattice of triangles), built out to a ship waiting at the far end.
// The bridge grows one ring at a time and each ring needs one answer; the player never places struts, the lattice is
// the reward. A right answer and the new ring's braces go in, it locks with a glow, and the tube slides out further.
// THE RINGS STAY BUILT (the game's maker, DT-6: "Keep them, but build a new bridge for each ship that docks"): a crew
// member's bridge for the ship at the port now is kept between visits (bridgeOf, built); its ninth ring reaches the
// ship, the port opens and the ship docks; the next ship to come gets a new bridge (nextShip). One ship waits at a time.
// What a ring asks, by level (the one idea the bridge teaches: a square folds, a triangle can't; then its angles. The
// game's maker, DT-5: "lets not ask to many questions about right triangle sides unless we offer a calculator or
// work-it-out. I like the questions about angles more. We can always have some questions about angles in 4 sided
// shapes or finding one angle by having to work out another angle (2 step angle problem)"):
//   1  the youngest TAP the wobbly squares of the new ring: each tap puts a brace across one, two triangles, stiff (the
//      player builds that much; its twin on the far side of the tube goes in too)
//   2  which glass pane fits the gap: the gap's shape among other shapes, turned round or not
//   3  how many triangles: each braced square is two (counting by 2s)
//   4  kinds of angles: two struts meet, acute, right, obtuse or straight (Mathwood's own maker: labs/windmill)
//   5  a brace in a square corner: the other part of the 90° (Mathwood's own maker)
//   6  a straight strut: a brace meets it, the two angles side by side make 180° (Mathwood's own maker)
//   7  a triangle pane's glass: half of base × height
//   8  parallel struts: a brace across the panel's two long struts, a Z (equal) or a C (they make 180°)
//   9  the third corner of a triangle (Mathwood's own maker)
//  10  four corners: a square leaning over before its brace, a pane at the collar: the four make 360°
//  11  two steps: the corner inside a triangle from the angle outside it, then its third corner; or a braced panel's
//      angle at the top, from the brace's at the bottom (the panel's corners are square)
//  12  a brace's length across a panel, corner to corner (3, 4, 5 made bigger: 60 cm by 80 cm makes 100 cm), a third
//      of the top level's cards, the rest two-step angles: the only right-triangle side asked, and Work it out walks
//      through its squares and their sum
// (Levels 3 and 4 keep a young child's first rings young: a new crew member climbs a level with each right answer
// while their level is found, and the squares can't be missed.)
// This file is the math (pure: node tests it, pi-nebula/tests/dock.test.mjs): the ladder, the makers, their pictures,
// the bridge kept for each ship. The bridge itself, the camera outside and the squares to tap are src/jobs/docklink.js
// (the panel's `live`).
import { ownOrder } from './engine.js';
import { questionOf as windmillQ } from '../../../mathwood-valley/labs/windmill/questions.js';

export const BRIDGE = { rings: 9, squares: 3 };   // the whole bridge: nine rings out to the ship; three squares to brace on a ring
export const TRY = BRIDGE;   // (its old name, from the three-ring try)

// ── THE BRIDGE KEPT FOR THE SHIP AT THE PORT (DT-6), with the crew member (crew.jobs.dock.bridge, saved with them) ──
//   bridgeOf(crew) -> { ship: which ship this is (1, 2, ...), rings: rings built for it (0..9), docked: true once all are }
//   built(crew)    a ring built: -> the bridge
//   nextShip(crew) the next ship comes to the port: a new bridge for it, from ring 1 -> the bridge
const tallyOf = (crew) => { if (!crew.jobs || typeof crew.jobs !== 'object') crew.jobs = {}; return (crew.jobs.dock = crew.jobs.dock && typeof crew.jobs.dock === 'object' ? crew.jobs.dock : {}); };
export function bridgeOf(crew) {
  const t = tallyOf(crew), b = t.bridge && typeof t.bridge === 'object' ? t.bridge : (t.bridge = {});
  b.ship = Number.isInteger(b.ship) && b.ship > 0 ? b.ship : 1;
  b.rings = Number.isInteger(b.rings) ? Math.max(0, Math.min(BRIDGE.rings, b.rings)) : 0;
  b.docked = b.rings >= BRIDGE.rings;
  return b;
}
export function built(crew) { const b = bridgeOf(crew); b.rings = Math.min(BRIDGE.rings, b.rings + 1); b.docked = b.rings >= BRIDGE.rings; return b; }
export function nextShip(crew) { const b = bridgeOf(crew); b.ship += 1; b.rings = 0; b.docked = false; return b; }

// ── the pictures: on the panel's light card, as the station's others (src/jobs/pics.js): the numbers given, a "?" for
// what is asked. The bridge's struts steel grey, its glass pale blue, a brace amber.
const INK = '#2b2219', SOFT = '#8a7558', ASK = '#b5523a', STRUT = '#4e5763', JOINT = '#2f353d', GLASS = '#a9d1ee', GLASS_LINE = '#5d97c9', BRACE = '#d9811f', OK = '#3f8a5a';
const W = 360;
const svg = (h, body, w = W) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg">${body}</svg>`;
const f1 = (v) => +v.toFixed(1);
const text = (x, y, s, { size = 15, fill = INK, weight = 700, anchor = 'middle' } = {}) => `<text x="${f1(x)}" y="${f1(y)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="system-ui, sans-serif">${s}</text>`;
const seg = (a, b, col = STRUT, w = 6, extra = '') => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"${extra}/>`;
const poly = (pts, fill, stroke = 'none', w = 0, extra = '') => `<polygon points="${pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round"${extra}/>`;
// a frame of struts round a shape, a bolt at each corner (light struts on the panel's dark buttons)
const frame = (pts, w = 6, col = STRUT, joint = JOINT) => pts.map((p, i) => seg(p, pts[(i + 1) % pts.length], col, w)).join('') + pts.map((p) => `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${w * 0.75}" fill="${joint}"/>`).join('');
// an angle's arc at V (screen points), from the way to A round to the way to B (the short way), radius r
function arc(V, A, B, r, fill = 'rgba(232,146,42,.28)') {
  const a0 = Math.atan2(A[1] - V[1], A[0] - V[0]), a1 = Math.atan2(B[1] - V[1], B[0] - V[0]);
  let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  if (Math.abs(Math.abs(d) - Math.PI) < 1e-6) d = Math.sin(a0 + Math.PI / 2) < 0 ? Math.PI : -Math.PI;   // (a straight angle: its arc over the line, not under)
  const p0 = [V[0] + Math.cos(a0) * r, V[1] + Math.sin(a0) * r], p1 = [V[0] + Math.cos(a0 + d) * r, V[1] + Math.sin(a0 + d) * r];
  return `<path d="M${f1(V[0])} ${f1(V[1])} L${f1(p0[0])} ${f1(p0[1])} A${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${f1(p1[0])} ${f1(p1[1])} Z" fill="${fill}" stroke="${INK}" stroke-width="1.2"/>`;
}
// where an angle's label goes: along the middle of the angle, out from V
function mid(V, A, B, r) {
  const a0 = Math.atan2(A[1] - V[1], A[0] - V[0]), a1 = Math.atan2(B[1] - V[1], B[0] - V[0]);
  let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  if (Math.abs(Math.abs(d) - Math.PI) < 1e-6) d = Math.sin(a0 + Math.PI / 2) < 0 ? Math.PI : -Math.PI;   // (a straight angle: its arc over the line, not under)
  const m = a0 + d / 2; return [V[0] + Math.cos(m) * r, V[1] + Math.sin(m) * r + 5];
}
const squareMark = (V, A, B, r = 13) => {
  const ua = [(A[0] - V[0]), (A[1] - V[1])], ub = [(B[0] - V[0]), (B[1] - V[1])], la = Math.hypot(...ua), lb = Math.hypot(...ub);
  const p = (k, j) => [V[0] + ua[0] / la * r * k + ub[0] / lb * r * j, V[1] + ua[1] / la * r * k + ub[1] / lb * r * j];
  const [a, b, c] = [p(1, 0), p(1, 1), p(0, 1)];
  return `<path d="M${f1(a[0])} ${f1(a[1])} L${f1(b[0])} ${f1(b[1])} L${f1(c[0])} ${f1(c[1])}" fill="none" stroke="${INK}" stroke-width="2"/>`;
};
const n0 = (v) => v.toLocaleString('en-US');

// ── 1. the squares: a square folds, a triangle can't ───────────────────────────────────────────────────────────────
// (the help's picture: a square frame leaning over, beside one with a brace across it, two triangles, standing square)
export function foldPicture() {
  const s = 92, y0 = 30, y1 = y0 + s;
  const lean = [[34, y1], [34 + s, y1], [34 + s + 38, y0 + 8], [34 + 38, y0 + 8]];
  const L = 214, sq = [[L, y1], [L + s, y1], [L + s, y0], [L, y0]];
  let b = poly(lean, 'rgba(232,146,42,.12)') + frame(lean);
  b += `<path d="M${34 + 38 + 8} ${y0 - 8} l26 0" stroke="${ASK}" stroke-width="3" fill="none" marker-end="url(#dkar)"/>`;
  b += poly([sq[0], sq[1], sq[2]], 'rgba(169,209,238,.75)') + poly([sq[0], sq[2], sq[3]], 'rgba(169,209,238,.4)');
  b += frame(sq) + seg(sq[0], sq[2], BRACE, 6);
  b += text(34 + s / 2 + 19, y1 + 26, 'A square folds', { size: 14 }) + text(L + s / 2, y1 + 26, 'Two triangles: stiff', { size: 14, fill: OK });
  const defs = `<defs><marker id="dkar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${ASK}"/></marker></defs>`;
  return svg(160, defs + b);
}
// one square to tap on the card (the brace strip, src/jobs/docklink.js): a frame, and its brace (drawn when braced)
// (corners: bottom left, bottom right, top right, top left; the brace leans one way on even squares, the other on odd,
// as the lattice's braces do round the ring; the two triangles it makes are shaded once it is in)
export function squareSvg(i = 0) {
  const [p0, p1, p2, p3] = [[12, 88], [88, 88], [88, 12], [12, 12]], up = i % 2 === 0;
  const [a, c] = up ? [p0, p2] : [p1, p3];
  const t1 = up ? [p0, p1, p2] : [p1, p2, p3], t2 = up ? [p0, p2, p3] : [p1, p3, p0];
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="dkb-sq-svg" aria-hidden="true">`
    + `<g class="dkb-tris">${poly(t1, 'rgba(169,209,238,.9)')}${poly(t2, 'rgba(169,209,238,.5)')}</g>`
    + `<g class="dkb-frame">${frame([p0, p1, p2, p3], 7, '#d3dbe4', '#f1f4f7')}</g>`
    + `<line class="dkb-brace" x1="${a[0]}" y1="${a[1]}" x2="${c[0]}" y2="${c[1]}" stroke="${BRACE}" stroke-width="8" stroke-linecap="round" pathLength="1"/>`
    // (a ripple in the middle, shown on the square to tap next: "tap here", for a child who can't read yet)
    + '<circle class="dkb-tap" cx="50" cy="50" r="16" fill="none" stroke="#ffd29e" stroke-width="5"/><circle class="dkb-tap2" cx="50" cy="50" r="7" fill="#ffd29e"/>'
    + '</svg>';
}

// ── 2. which pane fits the gap ─────────────────────────────────────────────────────────────────────────────────
// A panel of the new ring, braced corner to corner: one half has its glass, the other is the gap. The panes on offer are
// other shapes beside the gap's own (turned round or not), all drawn to one scale among themselves: the question is the
// shape (3 corners or 4, a square corner or none, long and short sides as the gap's), not the size, as the card's picture
// and its buttons are not drawn to one scale on every screen.
const U = 26;   // pixels to a unit of a panel (the corner's picture)
const UL = 40, UC = 22;   // (the gap's picture; the panes on the buttons)
// a right triangle with legs a (across) and b (up), its square corner at the bottom left, turned by `turn` quarter
// turns, centred at c, u pixels to a unit: its three points
function rightTri(a, b, turn, c, u = UC) {
  let P = [[0, 0], [a, 0], [0, b]].map(([x, y]) => [x * u, -y * u]);
  for (let k = 0; k < turn; k++) P = P.map(([x, y]) => [-y, x]);
  const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return P.map(([x, y]) => [x - cx + c[0], y - cy + c[1]]);
}
const paneOf = (pts) => poly(pts, 'rgba(169,209,238,.8)', GLASS_LINE, 3);
// the panes: their points about a centre, and why each wrong one won't fit
const PIECES = {
  right: (a, b, turn) => ({ pts: (c) => rightTri(a, b, turn, c), why: '' }),
  square: (a, b) => ({ pts: (c) => [[c[0] - a * UC / 2, c[1] + b * UC / 2], [c[0] + a * UC / 2, c[1] + b * UC / 2], [c[0] + a * UC / 2, c[1] - b * UC / 2], [c[0] - a * UC / 2, c[1] - b * UC / 2]],
    why: 'That pane has 4 corners: it is the whole panel. The gap is a triangle, with 3 corners.' }),
  other: (a, b, turn) => ({ pts: (c) => (a === b ? rightTri(a, b * 1.75, turn, c) : rightTri(Math.max(a, b), Math.max(a, b), turn, c)),
    why: 'A triangle with a square corner, but its sides are not like the gap\'s: see how long and how short they are.' }),
  even: (a) => ({ pts: (c) => { const s = 2.6 * UC, h = s * Math.sqrt(3) / 2; return [[c[0] - s / 2, c[1] + h / 2], [c[0] + s / 2, c[1] + h / 2], [c[0], c[1] - h / 2]]; },
    why: 'A triangle, but it has no square corner. The gap has one, where the struts meet.' }),
  wide: (a, b, turn) => ({ pts: (c) => { let P = [[-1.9, 0.7], [1.9, 0.7], [1.2, -0.7]].map(([x, y]) => [x * UC, y * UC]); if (turn % 2) P = P.map(([x, y]) => [-x, y]); return P.map(([x, y]) => [x + c[0], y + c[1]]); },
    why: 'A triangle, but one of its corners is wider than a square corner. The gap\'s widest corner is square.' }),
};
const NAMES = { right: 'the triangle with a square corner', square: 'the four-cornered pane', other: 'the long triangle', even: 'the triangle with even sides', wide: 'the flat triangle' };
function gapPicture(a, b, half, flip, { answer = false } = {}) {
  // the panel: a by b units, its brace from one corner to the other; `half` 0: the gap below the brace, 1: above it
  const h = b * UL + 26, x0 = (W - a * UL) / 2 - 50, y1 = h - 12, x1 = x0 + a * UL, y0 = y1 - b * UL;
  const P = flip ? [[x1, y1], [x0, y1], [x0, y0], [x1, y0]] : [[x0, y1], [x1, y1], [x1, y0], [x0, y0]];
  const lower = [P[0], P[1], P[2]], upper = [P[0], P[2], P[3]], gap = half ? upper : lower, glass = half ? lower : upper;
  let s = poly(glass, 'rgba(169,209,238,.8)', GLASS_LINE, 2);
  s += answer ? paneOf(gap) : poly(gap, 'rgba(232,146,42,.10)', BRACE, 2.5, ' stroke-dasharray="7 5"');
  s += frame(P) + seg(P[0], P[2], BRACE, 6);
  if (!answer) { const c = [(gap[0][0] + gap[1][0] + gap[2][0]) / 3, (gap[0][1] + gap[1][1] + gap[2][1]) / 3]; s += text(c[0], c[1] + 8, '?', { size: 26, fill: ASK }); }
  const tx = Math.max(x0, x1) + 30, ty = (y0 + y1) / 2;
  s += answer ? text(tx, ty - 8, 'It fits:', { size: 15, fill: SOFT, anchor: 'start' }) + text(tx, ty + 14, 'the same shape', { size: 15, fill: SOFT, anchor: 'start' })
    : text(tx, ty + 6, 'The gap', { size: 16, fill: SOFT, anchor: 'start' });
  return svg(h, s);
}
const paneCoin = (pts) => svg(100, paneOf(pts([70, 50])), 140);

// ── counting the triangles: n squares in a row, each braced, two triangles each (help: each triangle numbered) ──────
function countPicture(n, { numbered = false } = {}) {
  const s = Math.min(58, 300 / n), x0 = (W - n * s) / 2, y1 = 110, y0 = y1 - s;
  let o = '';
  for (let i = 0; i < n; i++) {
    const a = [x0 + i * s, y1], b = [x0 + (i + 1) * s, y1], c = [x0 + (i + 1) * s, y0], d = [x0 + i * s, y0], up = i % 2 === 0;
    const [t1, t2] = up ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
    o += poly(t1, 'rgba(169,209,238,.9)') + poly(t2, 'rgba(169,209,238,.45)');
    // (help: the first two squares' triangles counted, the rest to count on)
    if (numbered && i < 2) for (const [k, t] of [[2 * i + 1, t1], [2 * i + 2, t2]]) o += text((t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3 + 5, String(k), { size: 13, fill: ASK });
  }
  for (let i = 0; i < n; i++) { const a = [x0 + i * s, y1], b = [x0 + (i + 1) * s, y1], c = [x0 + (i + 1) * s, y0], d = [x0 + i * s, y0]; o += i % 2 === 0 ? seg(a, c, BRACE, 5) : seg(b, d, BRACE, 5); }
  for (let i = 0; i < n; i++) o += seg([x0 + i * s, y1], [x0 + (i + 1) * s, y1]) + seg([x0 + i * s, y0], [x0 + (i + 1) * s, y0]);
  for (let i = 0; i <= n; i++) o += seg([x0 + i * s, y1], [x0 + i * s, y0]);
  o += numbered ? text(W / 2, y1 + 28, 'Count on by 2s: 2, 4, ...', { size: 15 })
    : text(W / 2 + 34, y1 + 28, `${n} squares, each braced:`, { size: 15, anchor: 'end' }) + text(W / 2 + 50, y1 + 30, '?', { size: 20, fill: ASK }) + text(W / 2 + 64, y1 + 28, 'triangles', { size: 15, anchor: 'start' });
  return svg(150, o);
}
// ── kinds of angles: two struts meeting at a joint (Mathwood's numbers) ────────────────────────────────────────────
const KINDS = ['acute', 'right', 'obtuse', 'straight'], cap = (s) => s[0].toUpperCase() + s.slice(1);
function anglePicture(deg, flip, { w = W, h = 150, label = '' } = {}) {
  const V = [w / 2 + (flip ? 40 : -40) * (w / W), h - (label ? 34 : 24)], L = Math.min(w * 0.36, 120), a0 = flip ? 180 : 0, a1 = flip ? 180 - deg : deg;
  const at = (a) => [V[0] + Math.cos(a * Math.PI / 180) * L, V[1] - Math.sin(a * Math.PI / 180) * L];
  const A = at(a0), B = at(a1), r = L * 0.32;
  let o = deg === 90 ? squareMark(V, A, B, r * 0.75) : arc(V, A, B, r);
  o += seg(V, A, STRUT, w < W ? 5 : 7) + seg(V, B, STRUT, w < W ? 5 : 7) + `<circle cx="${f1(V[0])}" cy="${f1(V[1])}" r="${w < W ? 4 : 6}" fill="${JOINT}"/>`;
  if (label) o += text(w / 2, h - 8, label, { size: 13 });
  return o;
}
function angleKinds(kind) {
  // the four kinds side by side, the one asked shaded (help: what each looks like)
  let o = '';
  [45, 90, 135, 180].forEach((d, i) => {
    const k = KINDS[i];
    o += `<svg x="${i * 90}" y="0" width="90" height="120" viewBox="0 0 90 120">${k === kind ? '<rect x="3" y="3" width="84" height="114" rx="8" fill="rgba(63,138,90,.18)"/>' : ''}${anglePicture(d, false, { w: 90, h: 120, label: cap(k) })}</svg>`;
  });
  return svg(120, o);
}

// ── 3. a brace in a square corner (Mathwood's numbers) ───────────────────────────────────────────────────────────
// The panel drawn so its brace really leans at the angle: the given part at the bottom strut, the asked part at the side
function cornerPicture(a, flip, { other = '?', otherFill = ASK } = {}) {
  const t = Math.tan(a * Math.PI / 180), w = a <= 45 ? 5 * U : 5 * U / t, h = a <= 45 ? 5 * U * t : 5 * U;
  const x0 = (W - w) / 2, y1 = 138, P = flip ? [[x0 + w, y1], [x0, y1], [x0, y1 - h], [x0 + w, y1 - h]] : [[x0, y1], [x0 + w, y1], [x0 + w, y1 - h], [x0, y1 - h]];
  let s = frame(P) + seg(P[0], P[2], BRACE, 6);
  s += arc(P[0], P[1], P[2], 42) + arc(P[0], P[2], P[3], 30, 'rgba(181,82,58,.22)');
  // (the given part's label along its middle; a narrow panel has no room for it there, so beside the panel's far side)
  let g = angleAt(P[0], P[1], P[2], 60);
  const far = flip ? x0 : x0 + w;
  if (Math.abs(g[0] - far) < 24) g = [far + (flip ? -26 : 26), g[1]];
  s += text(g[0], g[1], `${a}°`, { size: 16 }) + angleLabel(P[0], P[2], P[3], 48, other, { size: 18, fill: otherFill });
  return svg(156, s);
}
// an angle's label along its middle, out from V: further out for a narrow angle, so it clears the struts either side
function angleAt(V, A, B, r) {
  const a0 = Math.atan2(A[1] - V[1], A[0] - V[0]), a1 = Math.atan2(B[1] - V[1], B[0] - V[0]);
  let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const rl = Math.min(105, Math.max(r, r * 0.42 / Math.max(0.08, Math.sin(Math.abs(d) / 2)))), m = a0 + d / 2;
  return [V[0] + Math.cos(m) * rl, V[1] + Math.sin(m) * rl + 5];
}
function angleLabel(V, A, B, r, s, o) { const p = angleAt(V, A, B, r); return text(p[0], p[1], s, o); }

// ── 4. a triangle pane's glass ─────────────────────────────────────────────────────────────────────────────────
function areaPicture(b, h, at, { box = false } = {}) {
  // base b and height h (cm) drawn to fit; the top corner `at` of the way along the base. The height's number is on a
  // measuring line of its own right of the pane, level with its top corner (a narrow pane has no room for it inside)
  const sc = Math.min(200 / b, 110 / h), bw = b * sc, hh = h * sc, x0 = (W - bw - 76) / 2, y1 = 128, top = [x0 + bw * at, y1 - hh];
  let s = '';
  if (box) s += poly([[x0, y1], [x0 + bw, y1], [x0 + bw, y1 - hh], [x0, y1 - hh]], 'rgba(232,146,42,.08)', BRACE, 2, ' stroke-dasharray="6 5"');
  s += poly([[x0, y1], [x0 + bw, y1], top], 'rgba(169,209,238,.8)') + frame([[x0, y1], [x0 + bw, y1], top], 5);
  s += seg(top, [top[0], y1], INK, 2, ' stroke-dasharray="5 4"') + squareMark([top[0], y1], [x0 + bw, y1], top, 10);
  const xd = x0 + bw + 18;
  s += seg([top[0] + 7, top[1]], [xd - 7, top[1]], SOFT, 1.5, ' stroke-dasharray="2 4"') + seg([xd, y1], [xd, top[1]], INK, 2)
    + seg([xd - 6, y1], [xd + 6, y1], INK, 2) + seg([xd - 6, top[1]], [xd + 6, top[1]], INK, 2);
  s += text(x0 + bw / 2, y1 + 19, `${b} cm`, { size: 15 }) + text(xd + 10, y1 - hh / 2 + 5, `${h} cm`, { size: 15, anchor: 'start' });
  // (the glass asked about: a "?" in the pane, beside the height)
  const side = at > 0.5 ? 1 : -1, room = (side > 0 ? x0 + bw - top[0] : top[0] - x0) * 2 / 3;
  s += text(top[0] + side * Math.min(26, room * 0.55), y1 - hh / 3 + 7, '?', { size: 20, fill: ASK });
  return svg(150, s);
}

// ── 5. the third corner (Mathwood's numbers) ───────────────────────────────────────────────────────────────────
function triPicture(pts, labels, ask, { fillAsk = ASK } = {}) {
  // pts: Mathwood's triangle (math frame, y up), fitted to the card
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = Math.min(250 / Math.max(1e-6, x1 - x0), 112 / Math.max(1e-6, y1 - y0)), ox = (W - (x1 - x0) * s) / 2, oy = 146;
  const P = pts.map((p) => [ox + (p.x - x0) * s, oy - (p.y - y0) * s]);
  let o = poly(P, 'rgba(169,209,238,.8)') + frame(P, 5);
  const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const mx = (P[0][0] + P[1][0] + P[2][0]) / 3;
  const spot = P.map((V, i) => {
    const A = P[(i + 1) % 3], B = P[(i + 2) % 3];
    o += arc(V, A, B, 22, i === ask ? 'rgba(181,82,58,.22)' : 'rgba(232,146,42,.28)');
    // (its label inside the corner when there is room, else just outside it, past the corner's point)
    const u = unit([A[0] - V[0] + (B[0] - V[0]) * Math.hypot(A[0] - V[0], A[1] - V[1]) / Math.hypot(B[0] - V[0], B[1] - V[1]), A[1] - V[1] + (B[1] - V[1]) * Math.hypot(A[0] - V[0], A[1] - V[1]) / Math.hypot(B[0] - V[0], B[1] - V[1])]);
    const ang = Math.acos(Math.max(-1, Math.min(1, ((A[0] - V[0]) * (B[0] - V[0]) + (A[1] - V[1]) * (B[1] - V[1])) / (Math.hypot(A[0] - V[0], A[1] - V[1]) * Math.hypot(B[0] - V[0], B[1] - V[1]))))) * 180 / Math.PI;
    return { inside: ang >= 50, at: ang >= 50 ? [V[0] + u[0] * 42, V[1] + u[1] * 42 + 5] : [V[0] - u[0] * 24, V[1] - u[1] * 24 + 6], beside: [V[0] + (V[0] < mx ? -30 : 30), V[1] + 5] };
  });
  // (a tall, narrow triangle: two labels inside would meet in the middle; those two go beside their corners instead)
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    const a = spot[i], b = spot[j];
    if (a.inside && b.inside && Math.abs(a.at[0] - b.at[0]) < 40 && Math.abs(a.at[1] - b.at[1]) < 20) { a.at = a.beside; b.at = b.beside; }
  }
  spot.forEach((p, i) => { o += text(p.at[0], p.at[1], labels[i], { size: i === ask ? 18 : 15, fill: i === ask ? fillAsk : INK }); });
  return svg(166, o);
}

// ── 6. a brace's length across a panel ─────────────────────────────────────────────────────────────────────────
function diagPicture(w, h, ask) {
  const sc = Math.min(190 / w, 104 / h), ww = w * sc, hh = h * sc, x0 = (W - ww) / 2 - 20, y1 = 128, P = [[x0, y1], [x0 + ww, y1], [x0 + ww, y1 - hh], [x0, y1 - hh]];
  let s = poly([P[0], P[1], P[2]], 'rgba(169,209,238,.6)') + frame(P) + seg(P[0], P[2], BRACE, 6) + squareMark(P[1], P[0], P[2], 12);
  const lab = (k, v) => (ask === k ? '?' : `${v} cm`), col = (k) => (ask === k ? ASK : INK);
  s += text(x0 + ww / 2, y1 + 21, lab('w', w), { size: 15, fill: col('w') }) + text(x0 + ww + 36, y1 - hh / 2 + 5, lab('h', h), { size: 15, fill: col('h') });
  s += text(x0 + ww / 2 - 22, y1 - hh / 2 - 8, lab('d', Math.hypot(w, h)), { size: ask === 'd' ? 19 : 15, fill: col('d') });
  return svg(150, s);
}
function squaresPicture(a, b, c, ask) {
  const sq = (v) => n0(v * v);
  const l1 = ask === 'd' ? `${a} × ${a} + ${b} × ${b}` : `${c} × ${c} − ${a} × ${a}`;
  const l2 = ask === 'd' ? `= ${sq(a)} + ${sq(b)} = ${sq(c)}` : `= ${sq(c)} − ${sq(a)} = ${sq(b)}`;
  const l3 = ask === 'd' ? `? × ? = ${sq(c)}` : `? × ? = ${sq(b)}`;
  return svg(110, text(W / 2, 28, l1, { size: 16 }) + text(W / 2, 56, l2, { size: 16 }) + text(W / 2, 90, l3, { size: 17, fill: ASK }));
}

// ── 7. a straight strut: a brace meets it, two angles side by side that make 180° ─────────────────────────────
// (V the joint, the strut level through it; the brace up at `a` from the strut's right-hand part, or mirrored)
function linePicture(a, flip, { other = '?', otherFill = ASK } = {}) {
  const V = [W / 2 + (flip ? 34 : -34), 122], L = 112, s = flip ? -1 : 1;
  const R = [V[0] + s * 150, V[1]], Lf = [V[0] - s * 150, V[1]], B = [V[0] + s * Math.cos(a * Math.PI / 180) * L, V[1] - Math.sin(a * Math.PI / 180) * L];
  let o = arc(V, R, B, 38) + arc(V, B, Lf, 30, 'rgba(181,82,58,.22)');
  o += seg(Lf, R) + seg(V, B, BRACE, 6) + `<circle cx="${f1(V[0])}" cy="${f1(V[1])}" r="6" fill="${JOINT}"/>`;
  o += angleLabel(V, R, B, 58, `${a}°`, { size: 16 }) + angleLabel(V, B, Lf, 50, other, { size: 18, fill: otherFill });
  o += text(W / 2, 148, 'one straight strut', { size: 13, fill: SOFT });
  return svg(156, o);
}

// ── 8. parallel struts: a brace crosses from one to the other (the panel's long sides run along the bridge) ────
// kind 'z': the angle the brace makes with the top strut on the other side of it (equal: a Z); 'c': on the same side
// (the two inside angles make 180°: a C). The given angle at the bottom joint, right of the brace.
function parallelPicture(a, kind, flip, { other = '?', otherFill = ASK } = {}) {
  const y1 = 128, y0 = 44, dx = (y1 - y0) / Math.tan(a * Math.PI / 180), s = flip ? -1 : 1;
  const X = (x) => W / 2 + s * (x - W / 2);
  const P1 = [X(W / 2 - dx / 2), y1], P2 = [X(W / 2 + dx / 2), y0];
  let o = '';
  // (the struts run on past the panel, faint, both ways: they are the bridge's long struts)
  for (const y of [y0, y1]) o += seg([18, y], [W - 18, y], STRUT, 6) + `<path d="M${X(54) - s * 7} ${y - 7} l${s * 8} 7 l${-s * 8} 7" fill="none" stroke="${INK}" stroke-width="2"/>`;
  o += seg(P1, P2, BRACE, 6);
  for (const P of [P1, P2]) o += `<circle cx="${f1(P[0])}" cy="${f1(P[1])}" r="5.5" fill="${JOINT}"/>`;
  const right1 = [X(W / 2 - dx / 2 + 60), y1], left2 = [X(W / 2 + dx / 2 - 60), y0], right2 = [X(W / 2 + dx / 2 + 60), y0];
  o += arc(P1, right1, P2, 30) + angleLabel(P1, right1, P2, 46, `${a}°`, { size: 16 });
  const far = kind === 'z' ? left2 : right2;
  o += arc(P2, P1, far, 26, 'rgba(181,82,58,.22)') + angleLabel(P2, P1, far, 44, other, { size: 18, fill: otherFill });
  return svg(150, o);
}

// ── 9. four-sided shapes: a square leaning over (before its brace), a pane where the bridge meets the collar ─────
// corners in order round the shape: bottom left, bottom right, top right, top left; ask: the one to find
function quadPicture(kind, A, ask, { answer = false } = {}) {
  const h = 84, y1 = 128, y0 = y1 - h, t = h / Math.tan(A * Math.PI / 180);
  let P, ang;
  if (kind === 'lean') {
    const w = 150, x0 = W / 2 - (w + t) / 2;
    P = [[x0, y1], [x0 + w, y1], [x0 + w + t, y0], [x0 + t, y0]]; ang = [A, 180 - A, A, 180 - A];
  } else {
    const w = 210, x0 = W / 2 - w / 2;
    P = [[x0, y1], [x0 + w, y1], [x0 + w, y0], [x0 + t, y0]]; ang = [A, 90, 90, 180 - A];
  }
  let o = '';
  if (kind === 'lean') o += poly([[P[0][0], y1], [P[1][0], y1], [P[1][0], y0], [P[0][0], y0]], 'none', SOFT, 1.5, ' stroke-dasharray="5 5"');
  else o += poly(P, 'rgba(169,209,238,.8)');
  o += frame(P, 6);
  P.forEach((V, i) => {
    const A1 = P[(i + 1) % 4], B1 = P[(i + 3) % 4], isAsk = i === ask;
    if (ang[i] === 90 && !isAsk) { o += squareMark(V, A1, B1, 12); return; }
    o += arc(V, A1, B1, 24, isAsk ? (answer ? 'rgba(63,138,90,.25)' : 'rgba(181,82,58,.22)') : 'rgba(232,146,42,.28)');
  });
  P.forEach((V, i) => {
    const A1 = P[(i + 1) % 4], B1 = P[(i + 3) % 4], isAsk = i === ask;
    // (a square corner's label close in to its corner, so two of them on one side never read as one)
    o += angleLabel(V, A1, B1, ang[i] === 90 && !isAsk ? 24 : 40, isAsk && !answer ? '?' : `${ang[i]}°`, { size: isAsk ? 18 : ang[i] === 90 ? 13 : 15, fill: isAsk ? (answer ? OK : ASK) : INK });
  });
  if (kind === 'lean') o += text(W / 2, 148, 'the square it was, before it leaned', { size: 12, fill: SOFT });
  return { svg: svg(154, o), ang };
}

// ── 10. two steps: an angle found first, then the one asked ───────────────────────────────────────────────────
// 'outside': a triangle of the lattice whose bottom strut runs on past a joint: the angle outside it given (180° with
// the corner inside), another corner given, the third asked. 'panel': a braced panel, the brace's angle with the bottom
// strut given; asked, its angle with the side strut at the top (the panel's corners are square).
function outsidePicture(A, B, { answer = false } = {}) {
  // corners: P0 bottom left (A), P1 bottom right (B inside, 180 - B outside), P2 top
  const ta = Math.tan(A * Math.PI / 180), tb = Math.tan(B * Math.PI / 180), base = 1;
  // (the top from both ends: x = h / ta from the left, base - h / tb from the right)
  const hh = base / (1 / ta + 1 / tb), xt = hh / ta;
  const sc = Math.min(200 / base, 104 / hh), x0 = 50, y1 = 132;
  const P0 = [x0, y1], P1 = [x0 + base * sc, y1], P2 = [x0 + xt * sc, y1 - hh * sc], E = [Math.min(W - 16, P1[0] + 110), y1];
  let o = poly([P0, P1, P2], 'rgba(169,209,238,.8)') + frame([P0, P1, P2], 5);
  o += seg(P1, E, STRUT, 5, ' stroke-dasharray="9 6"') + text(E[0] - 4, y1 + 18, 'the strut runs on', { size: 11, fill: SOFT, anchor: 'end' });
  o += arc(P0, P1, P2, 26) + angleLabel(P0, P1, P2, 42, `${A}°`, { size: 15 });
  o += arc(P1, E, P2, 22) + angleLabel(P1, E, P2, 44, `${180 - B}°`, { size: 15 });
  o += arc(P1, P2, P0, 18, answer ? 'rgba(63,138,90,.22)' : 'rgba(43,34,25,.07)');
  if (answer) o += angleLabel(P1, P2, P0, 34, `${B}°`, { size: 13, fill: OK });
  // (the top corner's label: inside it, or above the corner when it is too narrow to hold it)
  const C = 180 - A - B, lab = answer ? `${C}°` : '?', st = { size: 18, fill: answer ? OK : ASK };
  o += arc(P2, P0, P1, 20, answer ? 'rgba(63,138,90,.25)' : 'rgba(181,82,58,.22)') + (C < 50 ? text(P2[0] + 14, P2[1] - 4, lab, { ...st, anchor: 'start' }) : angleLabel(P2, P0, P1, 38, lab, st));
  return svg(156, o);
}
function panelPicture(a, flip, { answer = false } = {}) {
  // the panel A (bottom left) B (bottom right) C (top right) D (top left), its brace A to C at `a` from the bottom strut
  const t = Math.tan(a * Math.PI / 180), w = a <= 40 ? 5.4 * U : 5.4 * U * 0.62 / t, h = a <= 40 ? 5.4 * U * t : 5.4 * U * 0.62;
  const x0 = (W - w) / 2, y1 = 136, s = flip ? -1 : 1, X = (x) => W / 2 + s * (x - W / 2);
  const A = [X(x0), y1], B = [X(x0 + w), y1], C = [X(x0 + w), y1 - h], D = [X(x0), y1 - h];
  let o = poly([A, B, C], 'rgba(169,209,238,.6)') + frame([A, B, C, D]) + seg(A, C, BRACE, 6);
  o += squareMark(B, A, C, 11) + squareMark(D, C, A, 11);
  o += arc(A, B, C, 34) + angleLabel(A, B, C, 52, `${a}°`, { size: 15 });
  if (answer) o += arc(C, D, A, 22, 'rgba(63,138,90,.18)') + angleLabel(C, D, A, 40, `${a}°`, { size: 12, fill: OK });
  o += arc(C, A, B, 26, answer ? 'rgba(63,138,90,.25)' : 'rgba(181,82,58,.22)') + angleLabel(C, A, B, 44, answer ? `${90 - a}°` : '?', { size: 18, fill: answer ? OK : ASK });
  return svg(152, o);
}

// ── the makers ─────────────────────────────────────────────────────────────────────────────────────────────────
const pick = (a, rand) => a[Math.floor(rand() * a.length) % a.length];
const fives = (lo, hi) => { const o = []; for (let v = lo; v <= hi; v += 5) o.push(v); return o; };
// the right answer and three wrong ones (each a sensible slip, none the right answer, none twice, all 5 to 175)
function degSlips(ans, wrongs) {
  const out = [], seen = new Set([ans]);
  for (const [v, slip, why] of [...wrongs, ...[15, -15, 20, -20, 25].map((d) => [ans + d, 'off', `Not quite: ${ans + d}° is ${Math.abs(d)}° too ${d > 0 ? 'big' : 'small'}. Work it out from the angles you know.`])]) {
    if (out.length >= 3 || v == null || seen.has(v) || v <= 0 || v >= 180) continue;
    seen.add(v); out.push({ ...DEG(v), slip, why });
  }
  return out;
}
const shuffle = (a, rand) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const DEG = (v) => ({ v, big: `${v}°`, small: '', label: `${v} degrees` });
const CM = (v) => ({ v, big: n0(v), small: 'cm', label: `${n0(v)} centimetres` });
const CM2 = (v) => ({ v, big: n0(v), small: 'square cm', label: `${n0(v)} square centimetres` });
// a panel's sides and brace (cm): whole right triangles, the size of the bridge's own panels (3, 4, 5 made bigger: the
// brace's root is 50, 100 or 150)
const TRIPLES = [[30, 40, 50], [40, 30, 50], [60, 80, 100], [80, 60, 100], [90, 120, 150], [120, 90, 150]];

export const MAKERS = {
  // 1: the squares to tap (no answers to pick: the card's own squares, and the new ring's in the view)
  brace: {
    strand: 'geo', at: () => 4,
    make(step, { rand = Math.random } = {}) {
      const o = ownOrder({
        key: 'brace', story: 'This new ring is wobbly.', ask: 'Tap each square to brace it.',
        right: { v: 'braced', big: 'Braced', small: '', label: 'Every square braced' }, slips: [],
        rightWhy: 'Two triangles in every square: the ring is stiff!',
        help: { title: 'Squares fold, triangles don\'t', svg: foldPicture(), line: 'Push on a square\'s corner and it leans over and folds flat. A brace across it, corner to corner, makes two triangles, and a triangle can\'t change its shape.',
          steps: ['Tap a square that wobbles.', 'A brace goes across it, corner to corner: two triangles.', 'Brace every square, and the ring is stiff.'] },
        own: { strand: 'geo', at: 4 }, facts: { squares: TRY.squares },
      }, rand, 1);
      o.play = 'brace';
      return o;
    },
  },
  // 2: which pane fits the gap
  fit: {
    strand: 'geo', at: () => 14,
    make(step, { rand = Math.random } = {}) {
      const [a, b] = pick([[2, 2], [2, 2], [2, 3], [3, 2]], rand), half = rand() < 0.5 ? 1 : 0, flip = rand() < 0.5;
      const turn = Math.floor(rand() * 4) % 4;
      // (for the young, shapes plainly different: four corners, no square corner, a corner wider than square)
      const wrongs = shuffle(['square', 'even', 'wide'], rand);
      const coin = (kind) => { const P = PIECES[kind](a, b, turn); return { v: kind, big: '', small: '', label: NAMES[kind], svg: paneCoin(P.pts), slip: kind, why: P.why }; };
      const right = coin('right');
      const o = ownOrder({
        key: `fit:${a}x${b}`, story: 'One pane of glass is missing.', ask: 'Which pane fits the gap?',
        right, slips: wrongs.map(coin),
        rightWhy: 'The same shape: it fits, even turned round.',
        help: { title: 'The same shape', svg: gapPicture(a, b, half, flip, { answer: true }), line: 'The pane must be the same shape as the gap: 3 corners, one of them square, and its long and short sides like the gap\'s. Turned round is fine.',
          steps: ['Count the corners: the gap has 3.', 'Find its square corner, where two struts meet.', 'Look at its sides: one long, two shorter, like the gap\'s.'] },
        own: { strand: 'geo', at: 14 }, facts: { a, b, half, flip, turn, wrongs },
      }, rand);
      // (the panel shows each pane's picture on its button: ownOrder keeps only the plain fields, so put them back)
      for (const c of o.coins) { const k = c.good ? right : coin(c.v); c.svg = k.svg; }
      o.lead = gapPicture(a, b, half, flip);
      o.leadDone = gapPicture(a, b, half, flip, { answer: true });   // (the card's picture once it is answered: the gap filled)
      return o;
    },
  },
  // counting the triangles: each braced square is two (counting by 2s)
  count: {
    strand: 'geo', at: () => 18,
    make(step, { rand = Math.random } = {}) {
      const n = pick([3, 4, 5, 5, 6], rand), ans = 2 * n;
      const N = (v) => ({ v, big: String(v), small: v === 1 ? 'triangle' : 'triangles', label: `${v} ${v === 1 ? 'triangle' : 'triangles'}` });
      const o = ownOrder({
        key: 'count', story: `On the plan, ${n} squares of the ring are braced. Each brace makes a square two triangles.`, ask: 'How many triangles is that?',
        right: N(ans),
        slips: [
          { ...N(n), slip: 'squares', why: `${n} is the squares. Each square is 2 triangles: count 2 for every square.` },
          { ...N(ans + 2), slip: 'over', why: `That's one square too many: ${n + 1} squares would make ${ans + 2}.` },
          { ...N(ans - 2), slip: 'under', why: `That's one square short: ${n - 1} squares make ${ans - 2}.` },
          { ...N(n + 2), slip: 'plus', why: `Not ${n} and 2 more: 2 triangles in every one of the ${n} squares.` },
        ],
        rightWhy: `${n} squares, 2 triangles in each: ${ans} triangles`,
        sum: { op: 'mul', a: n, b: 2, say: 'The squares, 2 triangles in each' },
        help: { title: 'Two in every square', svg: countPicture(n, { numbered: true }), line: 'A brace cuts a square into 2 triangles. Count by 2s, one square at a time.',
          steps: ['Count the squares.', 'Each square is 2 triangles: count 2, 4, 6, ...'] },
        own: { strand: 'geo', at: 18 }, credit: [{ strand: 'mul', at: 14, weight: 0.4 }], facts: { n, ans },
      }, rand);
      o.lead = countPicture(n);
      return o;
    },
  },
  // kinds of angles: Mathwood's maker (which kind, the angle), the bridge's struts
  angle: {
    strand: 'geo', at: () => 40,
    make(step, { rand = Math.random } = {}) {
      const q = windmillQ('name-angle', 1, rand), kind = q.answer, deg = q.geo.deg, flip = rand() < 0.5;
      const why = {
        acute: 'Acute is narrower than a square corner.', right: 'A right angle is a square corner, exactly 90°.',
        obtuse: 'Obtuse is wider than a square corner, but not a flat line.', straight: 'Straight is a flat line, 180°.',
      };
      const K = (k) => ({ v: k, big: cap(k), small: '', label: `${cap(k)}` });
      const o = ownOrder({
        key: 'angle', story: 'Two struts of the lattice meet at a joint.', ask: 'What kind of angle do they make?',
        right: K(kind), slips: KINDS.filter((k) => k !== kind).map((k) => ({ ...K(k), slip: k, why: `${why[k]} These two struts are not.` })),
        rightWhy: q.why,
        help: { title: 'What kind of angle?', svg: angleKinds(kind), line: q.rule, steps: ['Hold it up to a square corner (90°).', 'Narrower is acute, square is right, wider is obtuse, flat is straight.'] },
        own: { strand: 'geo', at: 40 }, facts: { kind, deg },
      }, rand);
      o.lead = svg(150, anglePicture(deg, flip) + text(W - 70, 40, '?', { size: 26, fill: ASK }));
      return o;
    },
  },
  // 3: a brace in a square corner: Mathwood's maker (the numbers, the choices, why), the bridge's own picture
  corner: {
    strand: 'geo', at: () => 58,
    make(step, { rand = Math.random } = {}) {
      const q = windmillQ('corner', 3, rand), a = q.geo.a, ans = q.answer, flip = !!q.geo.flip;
      const why = (v) => (v === 180 - a ? `That would fill a straight line, 180°. The square corner is 90°.`
        : v === a ? `${a}° is the part you know. The other part fills the rest of the 90°.`
          : `${a}° and ${v}° make ${a + v}°. The two parts of a square corner make 90°.`);
      const o = ownOrder({
        key: 'corner', story: `A brace splits a panel's square corner in two. One part is ${a}°.`, ask: 'How big is the other part?',
        right: DEG(ans), slips: q.choices.filter((v) => v !== ans).map((v) => ({ ...DEG(v), slip: 'corner', why: why(v) })),
        rightWhy: `${a}° + ${ans}° = 90°, a square corner`,
        sum: { op: 'sub', a: 90, b: a, say: 'The square corner, less the part you know' },
        help: { title: 'A square corner is 90°', svg: cornerPicture(a, flip), line: q.rule,
          steps: [`The two parts fill a square corner: ${a} + ? = 90.`, `So the other part is 90 − ${a}.`] },
        own: { strand: 'geo', at: 58 }, credit: [{ strand: 'sub', at: 20, weight: 0.3 }], facts: { a, ans },
      }, rand);
      o.lead = cornerPicture(a, flip);
      return o;
    },
  },
  // 4: a triangle pane's glass: half of base × height
  area: {
    strand: 'geo', at: () => 64,
    make(step, { rand = Math.random } = {}) {
      for (let tries = 0; tries < 60; tries++) {
        const b = pick([40, 60, 80, 100, 120], rand), h = pick([30, 40, 50, 60, 80, 90], rand);
        if (h / b < 0.4 || h / b > 1.6) continue;
        const A = b * h / 2, at = pick([0.25, 0.35, 0.5, 0.65, 0.75], rand);
        const o = ownOrder({
          key: 'area', story: `A triangle pane of glass for the bridge: its base is ${b} cm and its height is ${h} cm.`, ask: 'How much glass is in it?',
          right: CM2(A),
          slips: [
            { ...CM2(b * h), slip: 'whole', why: `${n0(b * h)} square cm is the whole rectangle round the triangle. The triangle is half of it.` },
            { ...CM2(b + h), slip: 'added', why: `${b} + ${h} adds the two lengths. Glass is base × height, and then half.` },
            { ...CM2(b * h / 4), slip: 'quarter', why: `That's half of it twice: a quarter of the rectangle. The triangle is half.` },
            { ...CM2(A + b), slip: 'off', why: `Base × height is ${n0(b * h)}: half of that is not ${n0(A + b)}.` },
          ],
          rightWhy: `${b} × ${h} = ${n0(b * h)}, and half of that is ${n0(A)} square cm`,
          sum: [{ op: 'mul', a: b, b: h, say: 'First the rectangle round it' }, { op: 'div', a: b * h, b: 2, say: 'Then half of it: the triangle' }],
          help: { title: 'Half of a rectangle', svg: areaPicture(b, h, at, { box: true }), line: 'A triangle is half of the rectangle round it. Base × height gives the rectangle, then take half.',
            steps: [`The rectangle: ${b} × ${h}`, 'The triangle: half of that, ÷ 2'] },
          own: { strand: 'geo', at: 64 }, credit: [{ strand: 'mul', at: 30, weight: 0.4 }], facts: { b, h, A }, size: 2,
        }, rand);
        o.lead = areaPicture(b, h, at);
        return o;
      }
      throw new Error('dock area: nothing made');
    },
  },
  // 5: the third corner: Mathwood's maker, the bridge's picture (a triangle of the lattice)
  third: {
    strand: 'geo', at: () => 78,
    make(step, { rand = Math.random } = {}) {
      const q = windmillQ('tri-sum', 5, rand), ang = q.geo.ang, ask = q.ask, shown = [0, 1, 2].filter((i) => i !== ask).map((i) => ang[i]), ans = q.answer;
      const labels = ang.map((v, i) => (i === ask ? '?' : `${v}°`)), sum = shown[0] + shown[1];
      const why = (v) => (v === sum ? `${sum}° is the two you know added. The three corners make 180°: take it from 180.`
        : `${shown[0]}° + ${shown[1]}° + ${v}° = ${sum + v}°. The three corners of a triangle make 180°.`);
      const o = ownOrder({
        key: 'third', story: `A triangle in the bridge's lattice has corners of ${shown[0]}° and ${shown[1]}°.`, ask: 'How big is its third corner?',
        right: DEG(ans), slips: q.choices.filter((v) => v !== ans).map((v) => ({ ...DEG(v), slip: 'tri', why: why(v) })),
        rightWhy: `${shown[0]}° + ${shown[1]}° + ${ans}° = 180°`,
        sum: [{ op: 'add', a: shown[0], b: shown[1], say: 'First the two corners you know' }, { op: 'sub', a: 180, b: sum, say: 'Then the rest of the 180°' }],
        help: { title: 'The corners make 180°', svg: triPicture(q.geo.pts, labels, ask), line: q.rule,
          steps: [`Add the two you know: ${shown[0]} + ${shown[1]}`, 'Take that from 180'] },
        own: { strand: 'geo', at: 78 }, credit: [{ strand: 'sub', at: 30, weight: 0.3 }], facts: { ang, ask, ans }, size: 2,
      }, rand);
      o.lead = triPicture(q.geo.pts, labels, ask);
      return o;
    },
  },
  // a straight strut: the brace's two angles on it make 180° (Mathwood's own maker: the windmill's missing angle)
  line: {
    strand: 'geo', at: () => 60,
    make(step, { rand = Math.random } = {}) {
      const q = windmillQ('line', 3, rand), a = q.geo.a, ans = q.answer, flip = !!q.geo.flip;
      const why = (v) => (v === 90 - a || (a > 90 && v === a - 90) ? `That fills a square corner, 90°. The two angles on a straight strut make 180°.`
        : v === a ? `${a}° is the angle you know. The other one is on the other side of the brace.`
          : `${a}° and ${v}° make ${a + v}°. Side by side on one straight strut they make 180°.`);
      const o = ownOrder({
        key: 'line', story: `A brace meets a straight strut of the bridge. On one side of it the angle is ${a}°.`, ask: 'How big is the angle on the other side?',
        right: DEG(ans), slips: q.choices.filter((v) => v !== ans).map((v) => ({ ...DEG(v), slip: 'line', why: why(v) })),
        rightWhy: `${a}° + ${ans}° = 180°: a straight line`,
        sum: { op: 'sub', a: 180, b: a, say: 'The straight strut, less the angle you know' },
        help: { title: 'A straight line is 180°', svg: linePicture(a, flip, { other: `${ans}°`, otherFill: OK }), line: q.rule,
          steps: [`Together they make a straight line: ${a} + ? = 180.`, `So the other angle is 180 − ${a}.`] },
        own: { strand: 'geo', at: 60 }, credit: [{ strand: 'sub', at: 30, weight: 0.3 }], facts: { a, ans },
      }, rand);
      o.lead = linePicture(a, flip);
      return o;
    },
  },
  // parallel struts: a brace across them makes a Z (the two angles equal) or a C (the two inside angles make 180°)
  parallel: {
    strand: 'geo', at: () => 72,
    make(step, { rand = Math.random } = {}) {
      const kind = rand() < 0.6 ? 'z' : 'c', a = pick(fives(35, 145).filter((v) => Math.abs(v - 90) >= 20), rand), flip = rand() < 0.5;
      const ans = kind === 'z' ? a : 180 - a;
      const slips = degSlips(ans, [
        [kind === 'z' ? 180 - a : a, 'other', kind === 'z' ? 'That would be the angle on the other side of the brace. Across the brace, in a Z, the two angles are the same.' : 'That is the angle across the brace, in a Z. On the same side, in a C, the two make 180° together.'],
        [90 - a > 0 ? 90 - a : a - 90, 'square', 'A square corner is 90°, but the brace does not make one here. Look at the two struts: they run the same way.'],
        [ans + 10, 'off', `Not quite: the struts are parallel, so the angles match up exactly. ${kind === 'z' ? `It is the same ${a}°.` : `${a}° and ? make 180°.`}`],
        [ans - 10, 'off', `Not quite: the struts are parallel, so the angles match up exactly. ${kind === 'z' ? `It is the same ${a}°.` : `${a}° and ? make 180°.`}`],
      ]);
      const o = ownOrder({
        key: 'parallel:' + kind, story: `A brace crosses a panel from one long strut to the other. The two struts are parallel: they run the same way. The brace makes ${a}° with the bottom strut.`,
        ask: 'How big is the angle with the question mark, at the top strut?',
        right: DEG(ans), slips,
        rightWhy: kind === 'z' ? `A Z between parallel struts: the two angles are the same, ${a}°` : `A C between parallel struts: ${a}° + ${ans}° = 180°`,
        ...(kind === 'c' ? { sum: { op: 'sub', a: 180, b: a, say: 'The two inside angles make 180°: take away the one you know' } } : {}),
        help: { title: kind === 'z' ? 'A Z between parallel struts' : 'A C between parallel struts', svg: parallelPicture(a, kind, flip, { other: `${ans}°`, otherFill: OK }),
          line: kind === 'z' ? 'The struts run the same way, so the brace crosses both at the same slant: the angles in the corners of a Z are equal.' : 'The struts run the same way: the two angles inside a C, on the same side of the brace, add up to 180°.',
          steps: kind === 'z' ? [`Trace the Z: bottom strut, brace, top strut.`, 'The angles in its two corners are equal.', `So it is ${a}°.`] : [`Trace the C: bottom strut, brace, top strut, on one side.`, `The two angles inside it make 180°: ${a} + ? = 180.`, `So it is 180 − ${a}.`] },
        own: { strand: 'geo', at: 72 }, facts: { kind, a, ans },
      }, rand);
      o.lead = parallelPicture(a, kind, flip);
      return o;
    },
  },
  // four-sided shapes: the four corners make 360° (a square leaning over before its brace; a pane at the collar)
  quad: {
    strand: 'geo', at: () => 80,
    make(step, { rand = Math.random } = {}) {
      const kind = rand() < 0.5 ? 'lean' : 'pane';
      const A = kind === 'lean' ? pick(fives(55, 80), rand) : pick([...fives(55, 80), ...fives(100, 125)], rand);
      const { ang } = quadPicture(kind, A, 0), ask = pick(kind === 'lean' ? [0, 1, 2, 3] : [0, 3], rand), ans = ang[ask], known = ang.filter((v, i) => i !== ask), sumK = known.reduce((s, v) => s + v, 0);
      const slips = degSlips(ans, [
        [180 - sumK > 0 ? 180 - sumK : null, 'tri', `The corners of a triangle make 180°. This shape has four corners: they make 360°.`],
        [180 - ans, 'next', `That is the corner next to it. Add the three you know and take them from 360°.`],
        [ans + 10, 'off', `${known.join('° + ')}° + ${ans + 10}° = ${sumK + ans + 10}°, not 360°.`],
        [ans - 10, 'off', `${known.join('° + ')}° + ${ans - 10}° = ${sumK + ans - 10}°, not 360°.`],
      ].filter((w) => w[0] != null));
      const words = kind === 'lean' ? 'A square of the new ring leans over before its brace goes in: it has four corners still, but none of them square.' : 'The glass pane where the bridge meets the docking collar has four corners.';
      const o = ownOrder({
        key: 'quad:' + kind, story: `${words} Three of them are ${known.slice(0, 2).join('°, ')}° and ${known[2]}°.`, ask: 'How big is the fourth corner?',
        right: DEG(ans), slips,
        rightWhy: `${known.join('° + ')}° + ${ans}° = 360°`,
        sum: [{ op: 'add', a: known[0], b: known[1], say: 'First add two of the corners you know' }, { op: 'add', a: known[0] + known[1], b: known[2], say: 'Then the third' }, { op: 'sub', a: 360, b: sumK, say: 'Then take them from 360' }],
        help: { title: 'Four corners make 360°', svg: quadPicture(kind, A, ask, { answer: true }).svg,
          line: `The four corners of any four-sided shape add up to 360°: two triangles' worth.${kind === 'lean' ? ' (A leaning square keeps it: opposite corners stay equal.)' : ''}`,
          steps: [`Add the three you know: ${known.join(' + ')} = ${sumK}.`, `Take that from 360: 360 − ${sumK}.`] },
        own: { strand: 'geo', at: 80 }, credit: [{ strand: 'add', at: 30, weight: 0.3 }], facts: { kind, A, ang, ask, ans },
      }, rand);
      o.lead = quadPicture(kind, A, ask).svg;
      return o;
    },
  },
  // two steps: an angle worked out first (inside the triangle, or at the panel's top), then the one asked
  twostep: {
    strand: 'geo', at: () => 84,
    make(step, { rand = Math.random } = {}) {
      if (rand() < 0.55) {
        // the outside angle: 180° with the corner inside; then the triangle's three corners make 180°
        for (let tries = 0; tries < 60; tries++) {
          const A = pick(fives(30, 80), rand), B = pick(fives(40, 100), rand), C = 180 - A - B;
          if (C < 25) continue;
          const out = 180 - B;
          const slips = degSlips(C, [
            [B, 'inside', `${B}° is the corner inside the triangle at the joint: the first step. Now the third corner: 180 − ${A} − ${B}.`],
            [180 - A - out, 'outside', `That uses the ${out}° as if it were inside the triangle. Inside, at that joint, the corner is 180 − ${out}.`],
            [180 - A, 'one', `That leaves out the corner at the joint. The three corners inside make 180°.`],
            [C + 10, 'off', `${A}° + ${B}° + ${C + 10}° = ${A + B + C + 10}°, not 180°.`],
          ]);
          const o = ownOrder({
            key: 'twostep:outside', story: `A triangle in the bridge's lattice: its bottom strut runs on past a joint, and outside the triangle there it makes ${out}°. Another corner of the triangle is ${A}°.`,
            ask: 'How big is the corner at the top, with the question mark?',
            right: DEG(C), slips,
            rightWhy: `Inside the joint: 180° − ${out}° = ${B}°; then ${A}° + ${B}° + ${C}° = 180°`,
            sum: [{ op: 'sub', a: 180, b: out, say: 'First the corner inside the triangle at the joint: a straight strut is 180' }, { op: 'add', a: A, b: B, say: 'Then add the two corners you know' }, { op: 'sub', a: 180, b: A + B, say: 'Then the rest of the triangle\'s 180' }],
            help: { title: 'First the corner inside', svg: outsidePicture(A, B, { answer: true }), line: `Two steps. A straight strut is 180°, so inside the joint the triangle's corner is 180 − ${out}. Then the three corners of the triangle make 180°.`,
              steps: [`The corner inside, at the joint: 180 − ${out} = ${B}.`, `The third corner: 180 − ${A} − ${B}.`] },
            own: { strand: 'geo', at: 84 }, credit: [{ strand: 'sub', at: 30, weight: 0.3 }], facts: { kind: 'outside', A, B, out, ans: C }, size: 2,
          }, rand);
          o.lead = outsidePicture(A, B);
          return o;
        }
      }
      // the braced panel: the brace's angle with the bottom strut given; asked, its angle with the side strut at the top
      // (a wide panel, so its corners have room for their angles: the brace low, 25° to 40°)
      const a = pick([25, 30, 35, 40], rand), flip = rand() < 0.5, ans = 90 - a;
      const slips = degSlips(ans, [
        [a, 'z', `${a}° is the brace's angle with the top strut (the struts are parallel): the first step. The side strut is square to the top one: 90 − ${a}.`],
        [180 - a, 'line', `The brace and the side strut make a corner of a triangle, smaller than a square corner.`],
        [ans + 10, 'off', `In the triangle under the brace: 90° + ${a}° + ${ans + 10}° = ${90 + a + ans + 10}°, not 180°.`],
        [ans - 10, 'off', `In the triangle under the brace: 90° + ${a}° + ${ans - 10}° = ${90 + a + ans - 10}°, not 180°.`],
      ]);
      const o = ownOrder({
        key: 'twostep:panel', story: `A brace crosses a square-cornered panel. It makes ${a}° with the bottom strut.`, ask: 'How big is its angle with the side strut, at the top?',
        right: DEG(ans), slips,
        rightWhy: `The corner at the bottom right is square: 180° − 90° − ${a}° = ${ans}°`,
        sum: [{ op: 'add', a: 90, b: a, say: 'First the two corners you know of the triangle under the brace: the square one and the brace\'s' }, { op: 'sub', a: 180, b: 90 + a, say: 'Then the rest of the triangle\'s 180' }],
        help: { title: 'First another angle', svg: panelPicture(a, flip, { answer: true }), line: 'Two steps. The brace, the bottom strut and the side strut make a triangle, and its corner at the bottom right is square (90°). Or: the brace makes the same angle with the top strut (the struts are parallel), and the side strut is square to it.',
          steps: [`The corner at the bottom right is 90°.`, `The three corners make 180°: 180 − 90 − ${a}.`] },
        own: { strand: 'geo', at: 84 }, credit: [{ strand: 'sub', at: 30, weight: 0.3 }], facts: { kind: 'panel', a, ans }, size: 2,
      }, rand);
      o.lead = panelPicture(a, flip);
      return o;
    },
  },
  // a brace's length, corner to corner (the bridge's panels: the 3, 4, 5 family only, so the root at the end is one a
  // child knows: 50 x 50 is 2,500; and only the brace itself, never a side from it: the game's maker, DT-5, "lets not
  // ask to many questions about right triangle sides unless we offer a calculator or work-it-out": Work it out walks
  // through its squares and their sum, and it is a third of the top level's cards)
  diag: {
    strand: 'geo', at: () => 86,
    make(step, { rand = Math.random } = {}) {
      const [w, h, d] = pick(TRIPLES, rand), side = false;
      const askK = side ? (rand() < 0.5 ? 'w' : 'h') : 'd', known = askK === 'w' ? h : w, ans = askK === 'd' ? d : askK === 'w' ? w : h;
      const slips = askK === 'd'
        ? [{ ...CM(w + h), slip: 'added', why: `${w} + ${h} is going round two sides. Straight across is shorter.` },
          { ...CM(d + 10), slip: 'off', why: `${d + 10} × ${d + 10} = ${n0((d + 10) ** 2)}, but ${w} × ${w} + ${h} × ${h} = ${n0(d * d)}.` },
          { ...CM(d - 10), slip: 'off', why: `${d - 10} × ${d - 10} = ${n0((d - 10) ** 2)}, but ${w} × ${w} + ${h} × ${h} = ${n0(d * d)}.` },
          { ...CM(Math.max(w, h)), slip: 'side', why: `${Math.max(w, h)} cm is a side of the panel. The brace goes corner to corner: it is the longest.` }]
        : [{ ...CM(d - known), slip: 'minus', why: `${d} − ${known} takes the lengths away. Take the squares away: ${d} × ${d} − ${known} × ${known}.` },
          { ...CM(ans + 10), slip: 'off', why: `${ans + 10} × ${ans + 10} = ${n0((ans + 10) ** 2)}, but ${d} × ${d} − ${known} × ${known} = ${n0(ans * ans)}.` },
          { ...CM(ans - 10), slip: 'off', why: `${ans - 10} × ${ans - 10} = ${n0((ans - 10) ** 2)}, but ${d} × ${d} − ${known} × ${known} = ${n0(ans * ans)}.` },
          { ...CM(d), slip: 'brace', why: `${d} cm is the brace. The side is shorter than the brace.` }];
      const o = ownOrder({
        key: `diag:${askK}`, story: askK === 'd' ? `A panel is ${w} cm wide and ${h} cm tall. A brace goes across it, corner to corner.` : `A brace ${d} cm long goes corner to corner across a panel ${known} cm ${askK === 'w' ? 'tall' : 'wide'}.`,
        ask: askK === 'd' ? 'How long is the brace?' : `How ${askK === 'w' ? 'wide' : 'tall'} is the panel?`,
        right: CM(ans), slips: slips.filter((s) => s.v > 0 && s.v !== ans),
        rightWhy: askK === 'd' ? `${w} × ${w} + ${h} × ${h} = ${n0(d * d)}, and ${d} × ${d} = ${n0(d * d)}` : `${d} × ${d} − ${known} × ${known} = ${n0(ans * ans)}, and ${ans} × ${ans} = ${n0(ans * ans)}`,
        sum: askK === 'd' ? [{ op: 'mul', a: w, b: w, say: 'First one side squared' }, { op: 'mul', a: h, b: h, say: 'Then the other side squared' }, { op: 'add', a: w * w, b: h * h, say: 'Add them: that is the brace squared' }]
          : [{ op: 'mul', a: d, b: d, say: 'First the brace squared' }, { op: 'mul', a: known, b: known, say: 'Then the side you know, squared' }, { op: 'sub', a: d * d, b: known * known, say: 'Take it away: that is the other side squared' }],
        help: { title: 'Squares on the sides', svg: diagPicture(w, h, askK) + squaresPicture(askK === 'd' ? w : known, askK === 'd' ? h : ans, d, askK),
          line: 'The panel\'s corner is square, so the brace is the long side of a right triangle: the two short sides squared add up to the brace squared.',
          steps: askK === 'd' ? [`${w} × ${w} and ${h} × ${h}`, 'Add them', 'Which number times itself makes that?'] : [`${d} × ${d} and ${known} × ${known}`, 'Take the smaller from the bigger', 'Which number times itself makes that?'] },
        own: { strand: 'geo', at: askK === 'd' ? 86 : 88 }, credit: [{ strand: 'mul', at: 40, weight: 0.3 }], facts: { w, h, d, ask: askK, ans }, size: 2,
      }, rand);
      o.lead = diagPicture(w, h, askK);
      return o;
    },
  },
};

const M = (maker, step = 1, w = 1) => ({ maker, step, w });
export const PLACE = {
  id: 'dock', name: 'The docking bridge', short: 'Dock', math: 'Shapes and angles',
  pic: 'dock', job: null,
  line: 'Build the docking bridge ring by ring: brace the squares, fit the panes, and the angles of its struts, braces, triangles and panels.',
  levels: [
    { id: 'brace', title: 'Brace the squares', line: 'Tap each wobbly square: a brace makes two triangles', gen: { mix: [M('brace')] } },
    { id: 'fit', title: 'Which pane fits?', line: 'The gap\'s shape, even turned round', gen: { mix: [M('fit')] } },
    { id: 'count', title: 'Count the triangles', line: '5 squares braced: 2 triangles in each', gen: { mix: [M('count')] } },
    { id: 'angle', title: 'Kinds of angles', line: 'Acute, right, obtuse or straight?', gen: { mix: [M('angle')] } },
    { id: 'corner', title: 'A brace in a square corner', line: 'One part is 35°: the other part of the 90°', gen: { mix: [M('corner')] } },
    { id: 'line', title: 'A straight strut', line: 'A brace meets a strut at 125°: the other side?', gen: { mix: [M('line', 1, 2), M('corner')] } },
    { id: 'area', title: 'A triangle pane\'s glass', line: 'Half of base × height: 80 cm by 60 cm', gen: { mix: [M('area', 1, 2), M('line')] } },
    { id: 'parallel', title: 'Parallel struts', line: 'A brace across two parallel struts: a Z and a C', gen: { mix: [M('parallel', 1, 2), M('line')] } },
    { id: 'third', title: 'The third corner', line: 'Two corners are 60° and 70°: the third?', gen: { mix: [M('third', 1, 2), M('parallel')] } },
    { id: 'quad', title: 'Four corners', line: 'A pane with four corners: 90°, 90°, 115° and ?', gen: { mix: [M('quad', 1, 2), M('third')] } },
    { id: 'twostep', title: 'Two steps', line: 'Outside the triangle 125°, another corner 50°: the third', gen: { mix: [M('twostep', 1, 2), M('quad')] } },
    // (the only level with a right triangle's side, the brace's length, and a third of its cards at that: Work it out
    // walks through its squares and their sum)
    { id: 'diag', title: 'A brace\'s length', line: 'A panel 60 cm by 80 cm: corner to corner?', gen: { mix: [M('diag', 1, 1), M('twostep', 1, 2)] } },
  ],
};

// the job: its spot in the docking airlock's near room, a step back from the inner door (3.5 m in from the outer port
// was on the inner door's step, in its doorway, where no way could reach: the walk there stopped short)
export const JOB = {
  dark: true,      // its pictures are drawn dark, with light lines (src/jobs/pics.js NIGHT; the game's maker: "the dark mode looks better")
  id: 'dock', name: 'The docking bridge', short: 'Dock', open: true,
  spot: { place: 'airlock', toward: { place: 'galley' }, out: 5 }, face: 'airlock',
  sign: 'Docking bridge', hint: 'Build the bridge out to the ship',
  place: PLACE, setting: null, makers: MAKERS, card: 'blueprint',
  // the bridge outside the port, the camera on it and the squares to tap: src/jobs/docklink.js (index.js makes it)
  link: 'dock',
};
