// THE DOCK'S BRIDGE CHALLENGE, a try: three rings of the docking port's telescoping bridge, the lattice tube the game's
// maker picked (option C of the dock's option sheet: a round glass tube held by a lattice of triangles). The bridge grows
// one ring at a time and each ring needs one answer; the player never places struts, the lattice is the reward. A right
// answer and the new ring's braces go in, it locks with a glow, and the tube slides out further toward the ship waiting
// at the far end. After the third ring, a short "that's the try" (the full job is eight or ten rings, out to the ship,
// and then the docking port opens).
// What a ring asks, by level (the one idea the bridge teaches: a square folds, a triangle can't):
//   1  the youngest TAP the wobbly squares of the new ring: each tap puts a brace across one, two triangles, stiff (the
//      player builds that much; its twin on the far side of the tube goes in too)
//   2  which glass pane fits the gap (the same shape and size, turned round or not)
//   3  a brace in a square corner: the other part of the 90° (Mathwood's own maker: labs/windmill/questions.js)
//   4  a triangle pane's glass: half of base × height
//   5  the third corner of a triangle (Mathwood's own maker)
//   6  a brace's length across a panel, corner to corner (whole right triangles: 60 cm by 80 cm makes 100 cm)
// This file is the math (pure: node tests it, pi-nebula/tests/dock.test.mjs): the ladder, the makers, their pictures.
// The bridge itself, the camera outside and the squares to tap are src/jobs/docklink.js (the panel's `live`).
import { ownOrder } from './engine.js';
import { questionOf as windmillQ } from '../../../mathwood-valley/labs/windmill/questions.js';

export const TRY = { rings: 3, squares: 3 };   // the try: three rings, then its end; three squares to brace on a ring

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
  const p0 = [V[0] + Math.cos(a0) * r, V[1] + Math.sin(a0) * r], p1 = [V[0] + Math.cos(a0 + d) * r, V[1] + Math.sin(a0 + d) * r];
  return `<path d="M${f1(V[0])} ${f1(V[1])} L${f1(p0[0])} ${f1(p0[1])} A${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${f1(p1[0])} ${f1(p1[1])} Z" fill="${fill}" stroke="${INK}" stroke-width="1.2"/>`;
}
// where an angle's label goes: along the middle of the angle, out from V
function mid(V, A, B, r) {
  const a0 = Math.atan2(A[1] - V[1], A[0] - V[0]), a1 = Math.atan2(B[1] - V[1], B[0] - V[0]);
  let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
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
    + '</svg>';
}

// ── 2. which pane fits the gap ─────────────────────────────────────────────────────────────────────────────────
// A panel of the new ring, braced corner to corner: one half has its glass, the other is the gap. The panes on offer
// are drawn to the same scale as the gap, so a pane too big or too small looks it.
const U = 26;   // pixels to a unit of the plan, in the gap's picture and on the panes alike
// a right triangle with legs a (across) and b (up), its square corner at the bottom left, turned by `turn` quarter
// turns, centred at c: its three points
function rightTri(a, b, turn, c) {
  let P = [[0, 0], [a, 0], [0, b]].map(([x, y]) => [x * U, -y * U]);
  for (let k = 0; k < turn; k++) P = P.map(([x, y]) => [-y, x]);
  const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return P.map(([x, y]) => [x - cx + c[0], y - cy + c[1]]);
}
const paneOf = (pts) => poly(pts, 'rgba(169,209,238,.8)', GLASS_LINE, 3);
// the pieces: { kind, pts (a function of the centre), why (when wrong) }
const PIECES = {
  right: (a, b, turn) => ({ pts: (c) => rightTri(a, b, turn, c), why: '' }),
  square: (a, b) => ({ pts: (c) => [[c[0] - a * U / 2, c[1] + b * U / 2], [c[0] + a * U / 2, c[1] + b * U / 2], [c[0] + a * U / 2, c[1] - b * U / 2], [c[0] - a * U / 2, c[1] - b * U / 2]],
    why: 'That pane has 4 corners: it is the whole panel. The gap is a triangle, with 3 corners.' }),
  small: (a, b, turn) => ({ pts: (c) => rightTri(a / 2, b / 2, turn, c), why: 'The right shape, but too small: it would leave a gap round it.' }),
  big: (a, b, turn) => ({ pts: (c) => rightTri(a * 1.5, b * 1.5, turn, c), why: 'The right shape, but too big: it would stick out past the struts.' }),
  other: (a, b, turn) => ({ pts: (c) => (a === b ? rightTri(a, b * 1.5, turn, c) : rightTri(Math.max(a, b), Math.max(a, b), turn, c)), why: 'A triangle, but not the gap\'s shape: its sides are not as long as the gap\'s.' }),
  even: (a) => ({ pts: (c) => { const s = a * U * 1.1, h = s * Math.sqrt(3) / 2; return [[c[0] - s / 2, c[1] + h / 2], [c[0] + s / 2, c[1] + h / 2], [c[0], c[1] - h / 2]]; }, why: 'A triangle, but it has no square corner. The gap has one, where the struts meet.' }),
};
const NAMES = { right: 'the triangle pane', square: 'the square pane', small: 'the small triangle', big: 'the big triangle', other: 'the long triangle', even: 'the triangle with even sides' };
function gapPicture(a, b, half, flip, { answer = false } = {}) {
  // the panel: a by b units, its brace from one corner to the other; `half` 0: the gap below the brace, 1: above it
  const x0 = (W - a * U) / 2 - 40, y1 = 128, x1 = x0 + a * U, y0 = y1 - b * U;
  const P = flip ? [[x1, y1], [x0, y1], [x0, y0], [x1, y0]] : [[x0, y1], [x1, y1], [x1, y0], [x0, y0]];
  const lower = [P[0], P[1], P[2]], upper = [P[0], P[2], P[3]], gap = half ? upper : lower, glass = half ? lower : upper;
  let s = poly(glass, 'rgba(169,209,238,.8)', GLASS_LINE, 2);
  s += answer ? paneOf(gap) : poly(gap, 'rgba(232,146,42,.10)', BRACE, 2.5, ' stroke-dasharray="7 5"');
  s += frame(P) + seg(P[0], P[2], BRACE, 6);
  if (!answer) { const c = [(gap[0][0] + gap[1][0] + gap[2][0]) / 3, (gap[0][1] + gap[1][1] + gap[2][1]) / 3]; s += text(c[0], c[1] + 7, '?', { size: 22, fill: ASK }); }
  s += text(x1 + 74, y0 + 34, answer ? 'It fits:' : 'The gap', { size: 14, fill: SOFT }) + text(x1 + 74, y0 + 54, answer ? 'same shape,' : 'in the panel', { size: 14, fill: SOFT });
  if (answer) s += text(x1 + 74, y0 + 74, 'same size', { size: 14, fill: SOFT });
  return svg(150, s);
}
const paneCoin = (pts) => svg(130, paneOf(pts([85, 65])), 170);

// ── 3. a brace in a square corner (Mathwood's numbers) ───────────────────────────────────────────────────────────
// The panel drawn so its brace really leans at the angle: the given part at the bottom strut, the asked part at the side
function cornerPicture(a, flip, { other = '?', otherFill = ASK } = {}) {
  const t = Math.tan(a * Math.PI / 180), w = a <= 45 ? 5 * U : 5 * U / t, h = a <= 45 ? 5 * U * t : 5 * U;
  const x0 = (W - w) / 2, y1 = 138, P = flip ? [[x0 + w, y1], [x0, y1], [x0, y1 - h], [x0 + w, y1 - h]] : [[x0, y1], [x0 + w, y1], [x0 + w, y1 - h], [x0, y1 - h]];
  let s = frame(P) + seg(P[0], P[2], BRACE, 6);
  s += arc(P[0], P[1], P[2], 42) + arc(P[0], P[2], P[3], 30, 'rgba(181,82,58,.22)');
  s += text(...mid(P[0], P[1], P[2], 60), `${a}°`, { size: 16 }) + text(...mid(P[0], P[2], P[3], 48), other, { size: 18, fill: otherFill });
  return svg(156, s);
}

// ── 4. a triangle pane's glass ─────────────────────────────────────────────────────────────────────────────────
function areaPicture(b, h, at, { box = false } = {}) {
  // base b and height h (cm) drawn to fit; the top corner `at` of the way along the base
  const sc = Math.min(200 / b, 110 / h), bw = b * sc, hh = h * sc, x0 = (W - bw) / 2 - 18, y1 = 132, top = [x0 + bw * at, y1 - hh];
  let s = '';
  if (box) s += poly([[x0, y1], [x0 + bw, y1], [x0 + bw, y1 - hh], [x0, y1 - hh]], 'rgba(232,146,42,.08)', BRACE, 2, ' stroke-dasharray="6 5"');
  s += poly([[x0, y1], [x0 + bw, y1], top], 'rgba(169,209,238,.8)') + frame([[x0, y1], [x0 + bw, y1], top], 5);
  s += seg(top, [top[0], y1], INK, 2, ' stroke-dasharray="5 4"') + squareMark([top[0], y1], [x0 + bw, y1], top, 10);
  s += text(x0 + bw / 2, y1 + 20, `${b} cm`, { size: 15 }) + text(top[0] + (at > 0.5 ? -30 : 30), y1 - hh / 2 + 5, `${h} cm`, { size: 15 });
  // (the glass asked about: a "?" in the pane, on the other side of the height from its label)
  const side = at > 0.5 ? 1 : -1, room = (side > 0 ? x0 + bw - top[0] : top[0] - x0) * 2 / 3;
  s += text(top[0] + side * Math.min(26, room * 0.55), y1 - hh / 3 + 7, '?', { size: 20, fill: ASK });
  return svg(150, s);
}

// ── 5. the third corner (Mathwood's numbers) ───────────────────────────────────────────────────────────────────
function triPicture(pts, labels, ask, { fillAsk = ASK } = {}) {
  // pts: Mathwood's triangle (math frame, y up), fitted to the card
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = Math.min(220 / Math.max(1e-6, x1 - x0), 100 / Math.max(1e-6, y1 - y0)), ox = (W - (x1 - x0) * s) / 2, oy = 126;
  const P = pts.map((p) => [ox + (p.x - x0) * s, oy - (p.y - y0) * s]);
  let o = poly(P, 'rgba(169,209,238,.8)') + frame(P, 5);
  for (let i = 0; i < 3; i++) {
    const V = P[i], A = P[(i + 1) % 3], B = P[(i + 2) % 3];
    o += arc(V, A, B, 24, i === ask ? 'rgba(181,82,58,.22)' : 'rgba(232,146,42,.28)');
    o += text(...mid(V, A, B, 44), labels[i], { size: i === ask ? 18 : 15, fill: i === ask ? fillAsk : INK });
  }
  return svg(150, o);
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
  const l1 = ask === 'd' ? `${a} × ${a} + ${b} × ${b} = ${sq(a)} + ${sq(b)} = ${sq(c)}` : `${c} × ${c} − ${a} × ${a} = ${sq(c)} − ${sq(a)} = ${sq(b)}`;
  const l2 = ask === 'd' ? `? × ? = ${sq(c)}` : `? × ? = ${sq(b)}`;
  return svg(84, text(W / 2, 32, l1, { size: 16 }) + text(W / 2, 64, l2, { size: 17, fill: ASK }));
}

// ── the makers ─────────────────────────────────────────────────────────────────────────────────────────────────
const pick = (a, rand) => a[Math.floor(rand() * a.length) % a.length];
const shuffle = (a, rand) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const DEG = (v) => ({ v, big: `${v}°`, small: '', label: `${v} degrees` });
const CM = (v) => ({ v, big: n0(v), small: 'cm', label: `${n0(v)} centimetres` });
const CM2 = (v) => ({ v, big: n0(v), small: 'square cm', label: `${n0(v)} square centimetres` });
// a panel's sides and brace (cm): whole right triangles, the size of the bridge's own panels
const TRIPLES = [[30, 40, 50], [40, 30, 50], [60, 80, 100], [80, 60, 100], [90, 120, 150], [120, 90, 150], [50, 120, 130], [120, 50, 130]];

export const MAKERS = {
  // 1: the squares to tap (no answers to pick: the card's own squares, and the new ring's in the view)
  brace: {
    strand: 'geo', at: () => 4,
    make(step, { rand = Math.random } = {}) {
      const o = ownOrder({
        key: 'brace', story: 'The new ring wobbles. Its squares can fold flat.', ask: 'Tap each wobbly square to put a brace across it.',
        right: { v: 'braced', big: 'Braced', small: '', label: 'Every square braced' }, slips: [],
        rightWhy: 'Every square is two triangles now. The ring is stiff!',
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
      const wrongs = shuffle(['square', 'small', 'big', 'other', 'even'], rand).slice(0, 3);
      const coin = (kind) => { const P = PIECES[kind](a, b, turn); return { v: kind, big: '', small: '', label: NAMES[kind], svg: paneCoin(P.pts), slip: kind, why: P.why }; };
      const right = coin('right');
      const o = ownOrder({
        key: `fit:${a}x${b}`, story: 'The new ring needs its glass. One pane of a panel is missing.', ask: 'Which pane fits the gap?',
        right, slips: wrongs.map(coin),
        rightWhy: 'Same shape, same size: it fits, even turned round.',
        help: { title: 'The same shape and size', svg: gapPicture(a, b, half, flip, { answer: true }), line: 'The pane must be the same shape as the gap and just as big. Turning it round is fine.',
          steps: ['Count the corners: the gap has 3.', 'Find its square corner, where two struts meet.', 'Check its sides are as long as the gap\'s.'] },
        own: { strand: 'geo', at: 14 }, facts: { a, b, half, flip, turn, wrongs },
      }, rand);
      // (the panel shows each pane's picture on its button: ownOrder keeps only the plain fields, so put them back)
      for (const c of o.coins) { const k = c.good ? right : coin(c.v); c.svg = k.svg; }
      o.lead = gapPicture(a, b, half, flip);
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
  // 6: a brace's length, corner to corner (step 2: a side of the panel, from the brace)
  diag: {
    strand: 'geo', at: (step) => (step <= 1 ? 86 : 88),
    make(step, { rand = Math.random } = {}) {
      const [w, h, d] = pick(TRIPLES, rand), side = step >= 2 && rand() < 0.6;
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
  id: 'dock', name: 'The docking bridge', short: 'Dock', math: 'Shapes, angles and triangles', pic: 'dock', job: null,
  line: 'Build the docking bridge ring by ring: brace the squares, fit the panes, the angles and lengths of its triangles.',
  levels: [
    { id: 'brace', title: 'Brace the squares', line: 'Tap each wobbly square: a brace makes two triangles', gen: { mix: [M('brace')] } },
    { id: 'fit', title: 'Which pane fits?', line: 'The same shape and size, even turned round', gen: { mix: [M('fit')] } },
    { id: 'corner', title: 'A brace in a square corner', line: 'One part is 35°: the other part of the 90°', gen: { mix: [M('corner')] } },
    { id: 'area', title: 'A triangle pane\'s glass', line: 'Half of base × height: 80 cm by 60 cm', gen: { mix: [M('area')] } },
    { id: 'third', title: 'The third corner', line: 'Two corners are 60° and 70°: the third?', gen: { mix: [M('third')] } },
    { id: 'diag', title: 'A brace\'s length', line: 'A panel 60 cm by 80 cm: corner to corner?', gen: { mix: [M('diag', 1, 2), M('diag', 2)] } },
  ],
};

// the job: its spot in the docking airlock's near room, a step back from the inner door (3.5 m in from the outer port
// was on the inner door's step, in its doorway, where no way could reach: the walk there stopped short)
export const JOB = {
  id: 'dock', name: 'The docking bridge', short: 'Dock', open: true,
  spot: { place: 'airlock', toward: { place: 'galley' }, out: 5 },
  sign: 'Docking bridge', hint: 'Build the bridge to the ship: a try',
  place: PLACE, setting: null, makers: MAKERS, card: 'blueprint',
  // the bridge outside the port, the camera on it and the squares to tap: src/jobs/docklink.js (index.js makes it)
  link: 'dock',
};
