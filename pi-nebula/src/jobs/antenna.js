// THE RADIO TOWER: the station's antenna upgrade, worked from the control room's radio desk, the plan the game's maker
// approved (DT-12 A, 2026-11-17: "Right plan and the right size for one job"; its drawing
// ~/pw/space-math/shots/dock-try/build-ideas/idea_antenna.png): built the way Mathwood's windmill and bridge are, a part
// at a time, and at its end a faint call is heard: a station in distress. His words:
//   2026-11-16  "I wanted the player to be able to build something ... like a communications antenna or something"
//   2026-11-17  (DT-12) "We'll see. I feel like our station needs a main control center for this."
//   2026-11-19  "The control room might be the place to work on the radio antenna and hear the signal from the other
//               station."
//   2026-11-22  (EXPL1-2) the station in distress "should be quickly discovered after the radio tower is repaired. And if
//               the radio tower is not repaired I think Capt Vega should mention that we might be able to find more
//               signals if the radio tower was built."
//   2026-11-23  asked where it should stand: "I was thinking it would be at the very top of the station, over the
//               control tower." So it stands on the control tower's roof (kit/antenna-plan.js), and the cards' words
//               name that place.
// THE EIGHT STEPS, one card each, as the drawing's eight panels (what is placed in each, and its math):
//   1 the old antenna   how tall the new one must be: past 9 m, and more: 12 m (the drawing: "over the hangar roofs, 9 m,
//                       and more"; where it stands now, on top of the control tower, nothing is over it: the 9 m is
//                       how tall it must stand to hear further out than our own ships)
//   2 lay the footing   four pads at the corners of a 2 m square (a square; is its corner square? 1.5, 2, 2.5)
//   3 the first legs    four legs of 1.5 m: 3 m struts from the rack cut in half
//   4 brace each face   a brace across each face, corner to corner (the youngest tap the wobbly faces, as at the dock)
//   5 stack it up       eight sections of 1.5 m: 12 m
//   6 cables to the arms   three at each of two heights; 12 m up and 5 m out: 13 m (the drawing: "cables to the roof";
//                       the control tower's roof is 4.8 m across, so three arms carry the anchors 5 m out)
//   7 the dish on top   tilted 30 degrees up, turned a right angle and half of one more: 135 degrees
//   8 the test, a call  switched on, the dish sweeps and the mast holds; something is heard: three short, three long,
//                       three short (SOS); one bar of five at 135 degrees, three bars turned 5 degrees more, to 140
// THE LEVELS: the drawing gives each step the youngest's math and the older's; the job's ladder has three levels
// (Mathwood's levels need them to place a crew member): the youngest's (counting and shapes), the middle one (the
// youngest's second sums from the drawing: halves, adding, groups of the same), and the older's (square corners and long
// sides). Every level asks the step the antenna is at (pickAsk below): the card follows the build.
// THE ANTENNA IS KEPT with the crew member (crew.jobs.antenna, saved with them), as the dock's bridge is:
//   built      the steps built so far (0 to 8)
//   repaired   true once the call has been heard (the eighth step answered); stays true if it is built again
// THE FLAG THE GAME READS: antennaRepaired(crew) (crew.jobs.antenna.repaired === true): the exploring run reads it, so
// the next exploring run after the repair finds the station in distress, and before it Captain Vega can say that more
// signals might be heard if the radio tower was built.
// This file is the math (pure: node tests it, pi-nebula/tests/antenna.test.mjs). The antenna itself, the camera outside,
// the faces to tap and the call are src/jobs/antennalink.js (the panel's `live`).
import { ownOrder } from './engine.js';
import { squareSvg } from './dock.js';

export const STEPS = [
  { id: 'tall', name: 'The old antenna' },
  { id: 'footing', name: 'Lay the footing' },
  { id: 'legs', name: 'The first legs' },
  { id: 'brace', name: 'Brace each face' },
  { id: 'stack', name: 'Stack it up' },
  { id: 'cables', name: 'Cables to the arms' },
  { id: 'dish', name: 'The dish on top' },
  { id: 'call', name: 'The test, and a call' },
];
export const FACES = 4;      // the first section's faces a young player braces
// THE CALL as it comes in (the drawing's words; the station's name left out of it for the game's maker)
export const CALL = ['...elp...', '...this is...', '...station...', '...power failing...', '...any ship...', '...please...'];
export const SIGNAL = { at: 135, best: 140, bars: 5, heard: 1, clear: 3 };

// ── THE ANTENNA KEPT WITH THE CREW MEMBER ────────────────────────────────────────────────────────────────────────
const tallyOf = (crew) => { if (!crew.jobs || typeof crew.jobs !== 'object') crew.jobs = {}; return (crew.jobs.antenna = crew.jobs.antenna && typeof crew.jobs.antenna === 'object' ? crew.jobs.antenna : {}); };
//   antennaOf(crew) -> { built: steps built (0..8), repaired }
export function antennaOf(crew) {
  const t = tallyOf(crew);
  t.built = Number.isInteger(t.built) ? Math.max(0, Math.min(STEPS.length, t.built)) : 0;
  t.repaired = t.repaired === true;
  return t;
}
//   stepBuilt(crew) a step built: -> the antenna (the eighth: the call heard, repaired)
export function stepBuilt(crew) { const a = antennaOf(crew); a.built = Math.min(STEPS.length, a.built + 1); if (a.built >= STEPS.length) a.repaired = true; return a; }
//   buildAgain(crew) from the first step again (the radio tower stays repaired)
export function buildAgain(crew) { const a = antennaOf(crew); a.built = 0; return a; }
//   antennaSeen(crew) the same, only read: a crew member who never went to the radio desk is left as they were (the
//   antenna on the roof shows each crew member's own, every frame)
export function antennaSeen(crew) {
  const t = crew?.jobs?.antenna, b = t && Number.isInteger(t.built) ? Math.max(0, Math.min(STEPS.length, t.built)) : 0;
  return { built: b, repaired: !!t && t.repaired === true };
}
// THE FLAG: the radio tower repaired (the call heard). Only read: a crew member who never went to the radio desk is left
// as they were.
export function antennaRepaired(crew) { return crew?.jobs?.antenna?.repaired === true; }

// ── the pictures: dark, light lines (the space game's "dark mode"; the drawing's colours: amber what is placed, green
// the math, cyan the signal), the numbers given, a "?" for what is asked ──────────────────────────────────────────────
const INK = '#dfe9f2', SOFT = '#8fa3b6', ASK = '#ffd560', STEEL = '#9fb0c2', AMBER = '#ffab45', GREEN = '#7be0a0', CYAN = '#6fd8ff', ROOF = '#3d4a58', FILL = '#1b2836';
const W = 360;
const svg = (h, body, w = W) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg ant-svg">${body}</svg>`;
const f1 = (v) => +v.toFixed(1);
const text = (x, y, s, { size = 15, fill = INK, weight = 700, anchor = 'middle' } = {}) => `<text x="${f1(x)}" y="${f1(y)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="system-ui, sans-serif">${s}</text>`;
const seg = (a, b, col = STEEL, w = 4, extra = '') => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"${extra}/>`;
const dash = (a, b, col = SOFT, w = 2) => seg(a, b, col, w, ' stroke-dasharray="6 5"');
const poly = (pts, fill, stroke = 'none', w = 0, extra = '') => `<polygon points="${pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round"${extra}/>`;
const dot = (p, r = 4, col = AMBER) => `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${r}" fill="${col}"/>`;
const sq = (V, A, B, r = 11) => {
  const ua = [A[0] - V[0], A[1] - V[1]], ub = [B[0] - V[0], B[1] - V[1]], la = Math.hypot(...ua), lb = Math.hypot(...ub);
  const p = (k, j) => [V[0] + ua[0] / la * r * k + ub[0] / lb * r * j, V[1] + ua[1] / la * r * k + ub[1] / lb * r * j];
  const [a, b, c] = [p(1, 0), p(1, 1), p(0, 1)];
  return `<path d="M${f1(a[0])} ${f1(a[1])} L${f1(b[0])} ${f1(b[1])} L${f1(c[0])} ${f1(c[1])}" fill="none" stroke="${INK}" stroke-width="2"/>`;
};
const ROOF_NAME = 'the control tower\'s roof';
const roofLine = (y, x0 = 14, x1 = W - 14) => `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="12" fill="${ROOF}"/>${text((x0 + x1) / 2, y + 26, ROOF_NAME, { size: 12, fill: SOFT, weight: 600 })}`;
// the control tower's top seen from the side, x its middle: its roof 4.8 m across (u pixels a metre), its sides going
// down from under it; and an arm out from the roof to an anchor at ax, propped from the tower's side
const towerTop = (x, y, u) => `<path d="M${f1(x - 2.4 * u)} ${y} H${f1(x + 2.4 * u)} L${f1(x + 3.4 * u)} ${f1(y + u)} V${y + 34} H${f1(x - 3.4 * u)} V${f1(y + u)} Z" fill="${ROOF}"/>${text(x, y + 28, 'the tower\'s roof', { size: 11, fill: SOFT, weight: 600 })}`;
const armLine = (x, y, u, ax, col = STEEL) => { const d = Math.sign(ax - x); return seg([x + d * 2.4 * u, y + 3], [ax + d * 3, y + 3], col, 3) + seg([ax, y + 4], [x + d * 3.4 * u, y + 30], col, 2); };
const fmt = (v) => (Number.isInteger(v) ? String(v) : String(+v.toFixed(2)));
// a lattice mast seen from the side: x the middle, from y0 (its foot) up `n` sections of `s` pixels, `w` across
function mastSide(x, y0, n, s, w = 26, { col = AMBER, braced = true, mark = false } = {}) {
  let o = '';
  for (let k = 0; k < n; k++) {
    const a = y0 - k * s, b = a - s, up = k % 2 === 0;
    if (mark) o += poly([[x - w / 2, a], [x + w / 2, a], [x + w / 2, b], [x - w / 2, b]], k % 2 ? 'rgba(255,171,69,.10)' : 'rgba(255,171,69,.22)');
    if (braced) o += seg(up ? [x - w / 2, a] : [x + w / 2, a], up ? [x + w / 2, b] : [x - w / 2, b], col, 2);
    o += seg([x - w / 2, b], [x + w / 2, b], col, 2);
  }
  o += seg([x - w / 2, y0], [x - w / 2, y0 - n * s], col, 3) + seg([x + w / 2, y0], [x + w / 2, y0 - n * s], col, 3);
  return o;
}

// 1. how tall: the old pole, too low, and the 9 m it must get past (dashed across), a dashed mast with a "?" (or the
// right one marked)
function tallPicture({ ask = true, lowM = 9, newM = 12, oldM = 3 } = {}) {
  const u = 13, base = 196, top = (m) => base - m * u;
  let o = roofLine(base);
  // the 9 m line: below it, too low to hear further out
  o += `<rect x="14" y="${top(lowM)}" width="${W - 28}" height="${lowM * u}" fill="rgba(255,120,90,.07)"/>` + dash([14, top(lowM)], [W - 14, top(lowM)], 'rgba(255,150,120,.75)');
  o += seg([300, base], [300, top(lowM)], GREEN, 2) + text(312, top(lowM / 2) + 5, `${lowM} m`, { size: 15, fill: GREEN, anchor: 'start' });
  o += text(258, top(lowM) + 18, 'too low', { size: 12, fill: 'rgba(255,170,150,.9)', weight: 600 });
  // the old antenna: a 3 m pole with a small dish
  o += seg([60, base], [60, top(oldM)], STEEL, 4) + `<path d="M48 ${top(oldM) - 12} q12 14 26 0" fill="none" stroke="${STEEL}" stroke-width="4"/>` + text(60, top(oldM) - 22, `${oldM} m`, { size: 13, fill: SOFT });
  // the new one, dashed, with its height asked
  o += `<g opacity=".9">${mastSide(160, base, 8, newM * u / 8, 24, { col: ask ? 'rgba(255,171,69,.55)' : AMBER, braced: !ask })}</g>`;
  o += text(196, top(newM) + 14, ask ? '?' : `${newM} m`, { size: ask ? 22 : 15, fill: ask ? ASK : GREEN, anchor: 'start' });
  return svg(226, o);
}
// 2. the footing, from above: the four pads at the corners of a square on the grid (each square 0.5 m)
function footingPicture({ mode = 'square', ask = true } = {}) {
  const g = 28, x0 = 110, y0 = 22, n = 4;
  let o = '';
  for (let i = 0; i <= 6; i++) o += seg([x0 - g + i * g, y0 - 8], [x0 - g + i * g, y0 + (n + 1) * g + 8], 'rgba(150,180,210,.16)', 1) + seg([x0 - g - 8, y0 + i * g], [x0 + (n + 1) * g + 8, y0 + i * g], 'rgba(150,180,210,.16)', 1);
  const A = [x0, y0 + n * g], B = [x0 + n * g, y0 + n * g], C = [x0 + n * g, y0], D = [x0, y0];
  o += [[A, B], [B, C], [C, D], [D, A]].map(([p, q]) => dash(p, q, AMBER, 2)).join('');
  for (const p of [A, B, C, D]) o += `<rect x="${p[0] - 9}" y="${p[1] - 9}" width="18" height="18" rx="3" fill="${AMBER}"/>`;
  if (mode === 'square') {
    o += text(x0 + n * g / 2, y0 + n * g + 30, '4 squares', { size: 13, fill: GREEN }) + text(x0 - 16, y0 + n * g / 2 + 5, '4', { size: 13, fill: GREEN, anchor: 'end' });
    o += sq(A, B, D, 12) + sq(B, C, A, 12) + sq(C, D, B, 12) + sq(D, A, C, 12);
  } else if (mode === 'round') {
    o += text(x0 + n * g / 2, y0 + n * g + 30, '2 m', { size: 15, fill: GREEN }) + text(x0 + n * g + 16, y0 + n * g / 2 + 5, '2 m', { size: 15, fill: GREEN, anchor: 'start' });
    o += text(x0 + n * g / 2, y0 + n * g / 2 + 8, ask ? '?' : '8 m', { size: ask ? 24 : 16, fill: ask ? ASK : GREEN }) + text(x0 + n * g / 2, y0 + n * g / 2 + 26, 'all the way round', { size: 11, fill: SOFT, weight: 600 });
  } else {
    // (is the corner square? 1.5 m along, 2 m up: the line between)
    const P = [x0 + 3 * g, y0 + n * g], Q = [x0, y0 + 0 * g];
    o += seg(A, P, GREEN, 3) + seg(A, Q, GREEN, 3) + seg(P, Q, ask ? ASK : GREEN, 3, ask ? ' stroke-dasharray="7 5"' : '') + sq(A, P, Q, 12);
    o += dot(P, 5, GREEN) + dot(Q, 5, GREEN);
    o += text((A[0] + P[0]) / 2, A[1] + 30, '1.5 m', { size: 14, fill: GREEN }) + text(A[0] - 14, (A[1] + Q[1]) / 2 + 5, '2 m', { size: 14, fill: GREEN, anchor: 'end' });
    o += text((P[0] + Q[0]) / 2 + 16, (P[1] + Q[1]) / 2, ask ? '?' : '2.5 m', { size: ask ? 22 : 14, fill: ask ? ASK : GREEN, anchor: 'start' });
  }
  return svg(y0 + n * g + 44, o);
}
// the shapes a young player picks the footing from (on the buttons): a square, a long box, a leaning one, a kite
function shapeCoin(kind) {
  const c = [70, 50];
  const P = {
    square: [[-32, 32], [32, 32], [32, -32], [-32, -32]],
    long: [[-48, 22], [48, 22], [48, -22], [-48, -22]],
    lean: [[-44, 28], [22, 28], [44, -28], [-22, -28]],
    kite: [[0, 36], [30, 0], [0, -36], [-30, 0]],
  }[kind].map(([x, y]) => [x + c[0], y + c[1]]);
  return svg(100, poly(P, 'rgba(255,171,69,.18)', AMBER, 4) + P.map((p) => dot(p, 6)).join(''), 140);
}
// 3. a 3 m strut cut in half; or four legs of 1.5 m and the struts on the rack
function legsPicture({ mode = 'count', ask = true } = {}) {
  let o = '';
  if (mode === 'count') {
    // the four pads in a row, seen from the side, a leg to stand in each (dashed: still to come)
    o += roofLine(118);
    for (let i = 0; i < 4; i++) { const x = 70 + i * 74; o += `<rect x="${x - 14}" y="110" width="28" height="8" rx="2" fill="${AMBER}"/>` + dash([x, 106], [x, 28], 'rgba(255,171,69,.6)', 4); }
    o += text(W / 2, 20, ask ? '? legs' : '4 legs', { size: 15, fill: ask ? ASK : GREEN });
    return svg(150, o);
  }
  if (mode === 'half') {
    const x0 = 40, x1 = 320, y = 70;
    o += seg([x0, y], [x1, y], AMBER, 10) + seg([(x0 + x1) / 2, y - 22], [(x0 + x1) / 2, y + 22], ASK, 3, ' stroke-dasharray="5 4"');
    o += text((x0 + x1) / 2, y - 30, '3 m', { size: 16, fill: GREEN });
    o += text((x0 + (x0 + x1) / 2) / 2, y + 38, ask ? '?' : '1.5 m', { size: ask ? 22 : 15, fill: ask ? ASK : GREEN }) + text(((x0 + x1) / 2 + x1) / 2, y + 38, ask ? '?' : '1.5 m', { size: ask ? 22 : 15, fill: ask ? ASK : GREEN });
    return svg(120, o);
  }
  // four legs of 1.5 m, and the rack's 3 m struts
  for (let i = 0; i < 4; i++) { const x = 40 + i * 40; o += seg([x, 150], [x, 60], AMBER, 6); }
  o += text(100, 176, '4 legs, each 1.5 m', { size: 13, fill: GREEN });
  o += text(272, 36, 'the strut rack', { size: 12, fill: SOFT, weight: 600 });
  for (let i = 0; i < 3; i++) o += seg([212, 60 + i * 26], [332, 60 + i * 26], i === 0 ? STEEL : 'rgba(159,176,194,.35)', 6);
  o += text(272, 150, '3 m each', { size: 13, fill: GREEN }) + text(272, 174, ask ? 'how many?' : '2 struts', { size: 14, fill: ask ? ASK : GREEN });
  return svg(190, o);
}
// 4. a face of the first section: 2 m wide, 1.5 m tall, its brace corner to corner
function facePicture({ ask = true, count = false } = {}) {
  let o = '';
  if (count) {
    // four faces braced, side by side, each two triangles
    for (let i = 0; i < 4; i++) {
      const x = 22 + i * 82, y = 30, w = 70, h = 52, up = i % 2 === 0;
      const a = [x, y + h], b = [x + w, y + h], c = [x + w, y], d = [x, y];
      const [t1, t2] = up ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
      o += poly(t1, 'rgba(111,216,255,.30)') + poly(t2, 'rgba(111,216,255,.14)') + poly([a, b, c, d], 'none', STEEL, 3) + seg(up ? a : b, up ? c : d, AMBER, 3);
    }
    o += text(W / 2, 118, ask ? '4 faces, each braced: ? triangles' : '4 faces, 2 triangles each: 8', { size: 15, fill: ask ? ASK : GREEN });
    return svg(132, o);
  }
  const x0 = 70, y1 = 150, w = 160, h = 120, a = [x0, y1], b = [x0 + w, y1], c = [x0 + w, y1 - h], d = [x0, y1 - h];
  o += poly([a, b, c], 'rgba(111,216,255,.22)') + poly([a, c, d], 'rgba(111,216,255,.10)') + poly([a, b, c, d], 'none', STEEL, 4);
  o += seg(a, c, ask ? ASK : AMBER, 4, ask ? ' stroke-dasharray="8 6"' : '') + sq(a, b, d, 13);
  o += text(x0 + w / 2, y1 + 24, '2 m', { size: 15, fill: GREEN }) + text(x0 + w + 12, y1 - h / 2 + 5, '1.5 m', { size: 15, fill: GREEN, anchor: 'start' });
  o += text(x0 + w / 2 - 14, y1 - h / 2 - 6, ask ? '?' : '2.5 m', { size: ask ? 22 : 15, fill: ask ? ASK : GREEN, anchor: 'end' });
  return svg(184, o);
}
// 5. the mast stacked: eight sections; with the heights up its side (counting up by 1.5)
function stackPicture({ mode = 'count', ask = true } = {}) {
  const base = 222, s = 24, x = 110;
  let o = roofLine(base, 30, 330) + mastSide(x, base, 8, s, 34, { mark: mode === 'count' });
  if (mode === 'count') {
    for (let k = 0; k < 8; k++) o += text(x + 30, base - k * s - s / 2 + 5, ask && k > 1 ? '' : String(k + 1), { size: 13, fill: GREEN, anchor: 'start' });
    if (!ask) o += text(240, 110, '8 sections', { size: 15, fill: GREEN });
  } else if (mode === 'up') {
    o += seg([x + 40, base], [x + 40, base - 8 * s], GREEN, 2);
    for (let k = 1; k <= 8; k++) { const y = base - k * s; o += seg([x + 34, y], [x + 46, y], GREEN, 2); o += text(x + 54, y + 5, k === 8 && ask ? '?' : k <= 3 || !ask ? `${fmt(k * 1.5)} m` : '', { size: k === 8 && ask ? 20 : 13, fill: k === 8 && ask ? ASK : GREEN, anchor: 'start' }); }
  } else {
    o += seg([x + 30, base], [x + 30, base - s], GREEN, 2) + text(x + 38, base - s / 2 + 5, '1.5 m', { size: 13, fill: GREEN, anchor: 'start' });
    o += text(250, 110, '8 sections', { size: 15, fill: GREEN }) + text(250, 136, ask ? 'how tall? ?' : '12 m', { size: 15, fill: ask ? ASK : GREEN });
  }
  return svg(248, o);
}
// 6. the cables: the mast, two heights, three cables from each; or the right triangle, 12 m up and 5 m out
function cablesPicture({ mode = 'count', ask = true } = {}) {
  let o = '';
  if (mode === 'tri') {
    const u = 15, A = [110, 204], T = [110, 204 - 12 * u], B = [110 + 5 * u, 204];
    o += towerTop(110, 204, u) + armLine(110, 204, u, B[0]);
    o += mastSide(110, 204, 8, 12 * u / 8, 18, { col: AMBER });
    o += seg(T, B, ask ? ASK : AMBER, 3, ask ? ' stroke-dasharray="8 6"' : '') + sq(A, B, T, 12) + dot(B, 6, AMBER);
    o += text(92, 204 - 6 * u, '12 m', { size: 15, fill: GREEN, anchor: 'end' }) + text(B[0] + 12, 204 + 5, '5 m out', { size: 15, fill: GREEN, anchor: 'start' });
    o += text(B[0] + 12, 204 + 24, 'on its arm', { size: 11, fill: SOFT, weight: 600, anchor: 'start' });
    o += text((T[0] + B[0]) / 2 + 18, (T[1] + B[1]) / 2, ask ? '?' : '13 m', { size: ask ? 22 : 15, fill: ask ? ASK : GREEN, anchor: 'start' });
    return svg(246, o);
  }
  // the mast on the tower's roof, the three arms out from it, and three cables from each of two heights down to the
  // anchors on the arms' ends (one arm behind the mast, seen as its own)
  // (not to scale across: the arms drawn long, so that the six cables are easy to count)
  const base = 204, x = 180, s = 22, u = s / 1.5, hi = base - 8 * s, lo = base - 4 * s, anchors = [x - 106, x + 106, x + 64];
  o += towerTop(x, base, u) + anchors.map((ax, i) => armLine(x, base, u, ax, i === 2 ? 'rgba(159,176,194,.5)' : STEEL)).join('') + mastSide(x, base, 8, s, 20);
  anchors.forEach((ax, i) => {
    const col = i === 2 ? 'rgba(123,224,160,.55)' : GREEN;
    o += seg([x + (ax < x ? -10 : 10), hi], [ax, base], col, 2) + seg([x + (ax < x ? -10 : 10), lo], [ax, base], col, 2) + dot([ax, base], 5, AMBER);
  });
  // (the two heights named out at the side, clear of the cables, a faint line from each to the mast)
  o += dash([x + 14, hi], [x + 106, hi], 'rgba(143,163,182,.45)', 1) + dash([x + 14, lo], [x + 106, lo], 'rgba(143,163,182,.45)', 1);
  o += text(x + 110, hi + 4, 'here', { size: 12, fill: SOFT, anchor: 'start', weight: 600 }) + text(x + 110, lo + 4, 'and here', { size: 12, fill: SOFT, anchor: 'start', weight: 600 });
  if (!ask) o += text(W / 2, 22, mode === 'groups' ? '3 and 3: 6 cables' : '6 cables', { size: 15, fill: GREEN });
  return svg(240, o);
}
// 7. the dish's turn, seen from above: from the station's bow (straight up the picture) round toward its far side;
// in slices of half a square corner (the youngest count them), or the numbers
function dishPicture({ mode = 'slices', ask = true, turn = 135 } = {}) {
  const c = [W / 2, 116], r = 88, D2R = Math.PI / 180;
  const at = (deg, k = r) => [c[0] + Math.sin(deg * D2R) * k, c[1] - Math.cos(deg * D2R) * k];
  let o = `<circle cx="${c[0]}" cy="${c[1]}" r="${r}" fill="none" stroke="${SOFT}" stroke-width="2"/>`;
  o += text(c[0], c[1] - r - 10, "the station's bow", { size: 12, fill: SOFT, weight: 600 });
  o += seg(c, at(0), STEEL, 3);
  if (mode === 'slices') {
    for (let k = 0; k < 3; k++) {
      const a0 = k * 45, a1 = (k + 1) * 45, p0 = at(a0, r - 6), p1 = at(a1, r - 6);
      o += `<path d="M${f1(c[0])} ${f1(c[1])} L${f1(p0[0])} ${f1(p0[1])} A${r - 6} ${r - 6} 0 0 1 ${f1(p1[0])} ${f1(p1[1])} Z" fill="${k % 2 ? 'rgba(255,171,69,.30)' : 'rgba(255,171,69,.18)'}" stroke="${AMBER}" stroke-width="1.5"/>`;
      const m = at((a0 + a1) / 2, r * 0.62); if (!ask) o += text(m[0], m[1] + 5, String(k + 1), { size: 15, fill: GREEN });
    }
  } else {
    const p0 = at(0, 40), p1 = at(turn, 40);
    o += `<path d="M${f1(p0[0])} ${f1(p0[1])} A40 40 0 ${turn > 180 ? 1 : 0} 1 ${f1(p1[0])} ${f1(p1[1])}" fill="none" stroke="${GREEN}" stroke-width="3"/>`;
    if (mode === 'sum') { const m1 = at(45, 58), m2 = at(112, 58); o += text(m1[0] + 8, m1[1], '90°', { size: 14, fill: GREEN, anchor: 'start' }) + text(m2[0] + 8, m2[1] + 6, '45°', { size: 14, fill: GREEN, anchor: 'start' }) + seg(c, at(90), 'rgba(159,176,194,.5)', 2); o += sq(c, at(0), at(90), 12); }
    else o += sq(c, at(0), at(90), 12) + seg(c, at(90), 'rgba(159,176,194,.5)', 2);
  }
  // the dish itself, pointing the way it turns to
  const tip = at(turn, r - 4), back = at(turn, 18);
  o += seg(c, back, AMBER, 4) + `<circle cx="${f1(tip[0])}" cy="${f1(tip[1])}" r="9" fill="${AMBER}"/>`;
  o += mode !== 'slices' ? text(tip[0] - 4, tip[1] + 30, ask ? '?' : `${turn}°`, { size: ask ? 22 : 15, fill: ask ? ASK : GREEN, anchor: 'end' }) : '';
  return svg(222, o);
}
// 8. the call: the beeps (dots and dashes), or the signal's bars at the dish's turn
function callPicture({ mode = 'beeps', ask = true, at = SIGNAL.at, bars = SIGNAL.heard } = {}) {
  let o = '';
  if (mode === 'beeps') {
    const marks = ['s', 's', 's', 'l', 'l', 'l', 's', 's', 's'];
    let x = 26;
    marks.forEach((m, i) => {
      if (i === 3 || i === 6) x += 14;
      if (m === 's') { o += `<circle cx="${x + 9}" cy="60" r="9" fill="${CYAN}"/>`; if (!ask) o += text(x + 9, 92, String(i + 1), { size: 12, fill: GREEN }); x += 30; }
      else { o += `<rect x="${x}" y="51" width="34" height="18" rx="9" fill="${CYAN}"/>`; if (!ask) o += text(x + 17, 92, String(i + 1), { size: 12, fill: GREEN }); x += 46; }
    });
    o += text(W / 2, 24, '3 short, 3 long, 3 short', { size: 14, fill: SOFT, weight: 600 });
    return svg(104, o);
  }
  // the signal box: a weak wave and the bars, at the dish's turn
  o += `<rect x="16" y="12" width="${W - 32}" height="112" rx="10" fill="#08131c" stroke="${CYAN}" stroke-width="2"/>`;
  o += text(32, 36, 'SIGNAL', { size: 13, fill: CYAN, anchor: 'start' });
  for (let i = 0; i < SIGNAL.bars; i++) o += `<rect x="${W - 112 + i * 16}" y="${36 - 6 - i * 4}" width="11" height="${10 + i * 4}" fill="${i < bars ? CYAN : 'rgba(111,216,255,.2)'}"/>`;
  let d = 'M32 82'; for (let i = 0; i <= 60; i++) { const x = 32 + i * 4.9, y = 82 + Math.sin(i * 1.3) * (bars > 1 ? 14 : 5) * (0.6 + 0.4 * Math.sin(i * 0.37)); d += ` L${f1(x)} ${f1(y)}`; }
  o += `<path d="${d}" fill="none" stroke="${CYAN}" stroke-width="2" opacity="${bars > 1 ? 1 : 0.55}"/>`;
  o += text(32, 116, `the dish at ${at}°`, { size: 13, fill: GREEN, anchor: 'start' });
  return svg(136, o);
}

// ── the cards ────────────────────────────────────────────────────────────────────────────────────────────────────
const pick = (a, rand) => a[Math.floor(rand() * a.length) % a.length];
const N = (v, unit, one = unit) => ({ v, big: fmt(v), small: v === 1 ? one : unit, label: `${fmt(v)} ${v === 1 ? one : unit}` });
const M_ = (v) => ({ v, big: fmt(v), small: 'm', label: `${fmt(v)} metres` });
const DEG = (v) => ({ v, big: `${v}°`, small: '', label: `${v} degrees` });
const T = { 1: 'young', 2: 'middle', 3: 'older' };
// each step's card at each level (tier 1 the youngest's, 2 the middle, 3 the older's): make(tier, { rand })
export const MAKERS = {
  // ── 1. the old antenna: how tall must the new one be? Over the hangars' roof, 9 m, and more: 12 m ──
  tall: {
    strand: 'number', at: (t) => [4, 4, 22, 22][t] ?? 22,
    make(tier = 1, { rand = Math.random } = {}) {
      // (the drawing's story had the old pole on the terminal's roof with the hangars beside it, 9 m over it; where the
      // antenna stands now, on top of the control tower, nothing stands over it: the 9 m is told as how tall it must
      // be to hear further out than our own ships)
      // (kept as short as it was: a phone's card has no room for another line)
      const story = 'The old dish on top of the control tower is on a 3 m pole: too low, it only hears our own ships. To hear further, the new antenna must stand more than 9 m tall.';
      if (tier <= 1) {
        return ownOrder({
          key: 'tall:1', story, ask: 'Which new antenna is taller than 9 m?',
          right: M_(12),
          slips: [{ ...M_(3), slip: 'old', why: 'That is the old pole: too low.' }, { ...M_(6), slip: 'less', why: '6 is less than 9: still too low.' }, { ...M_(8), slip: 'less', why: '8 is just under 9: still too low.' }],
          rightWhy: '12 is more than 9: tall enough!',
          help: { title: 'Taller than 9 m', svg: tallPicture({ ask: false }), line: 'The new antenna must be a bigger number than 9.', steps: ['Start at 9.', 'Count on past 9: 10, 11, 12.', 'Which one is more than 9?'] },
          own: { strand: 'number', at: 14 }, facts: { step: 'tall', tier, ans: 12 },
        }, rand);
      }
      const o = ownOrder({
        key: 'tall:2', story, ask: 'It must reach 3 m past 9 m. How tall must it be?',
        right: M_(12),
        slips: [{ ...M_(9), slip: 'roof', why: '9 m is still too low. It must go 3 m more.' }, { ...M_(6), slip: 'minus', why: '9 − 3 takes away. It must go 3 m higher: 9 + 3.' }, { ...M_(3), slip: 'old', why: 'That is the old pole. 9 m, and 3 m more.' }],
        rightWhy: '9 + 3 = 12: a 12 m antenna',
        sum: [{ op: 'add', a: 9, b: 3, say: '9 m, and 3 m more' }],
        help: { title: 'Past 9 m', svg: tallPicture({ ask: false }), line: 'Up to 9 m; then 3 m more on top.', steps: ['9 m', '3 m more: 9 + 3.'] },
        own: { strand: 'add', at: 15 }, facts: { step: 'tall', tier, ans: 12 },
      }, rand);
      o.lead = tallPicture();
      return o;
    },
  },
  // ── 2. lay the footing: four pads at the corners of a 2 m square ──
  footing: {
    strand: 'geo', at: (t) => [6, 6, 26, 84][t] ?? 84,
    make(tier = 1, { rand = Math.random } = {}) {
      const story = 'The footing: four pads bolted down at the corners of a 2 m square.';
      if (tier <= 1) {
        const coin = (k, why = '') => ({ v: k, big: '', small: '', label: { square: 'the square', long: 'the long box', lean: 'the leaning shape', kite: 'the kite' }[k], svg: shapeCoin(k), slip: k, why });
        const o = ownOrder({
          key: 'footing:1', story, ask: 'Which one is a square?',
          right: coin('square'),
          slips: [coin('long', 'Its sides are not all the same: two long, two short.'), coin('lean', 'Its corners are not square: it leans over.'), coin('kite', 'Its corners are not square corners.')],
          rightWhy: '4 sides the same and 4 square corners: a square!',
          help: { title: 'A square', svg: footingPicture({ mode: 'square' }), line: 'A square has 4 sides all the same, and 4 square corners.', steps: ['Count its sides: 4.', 'Are they all the same? Count the grid\'s squares.', 'Are its corners square, like a book\'s corner?'] },
          own: { strand: 'geo', at: 6 }, facts: { step: 'footing', tier, ans: 'square' },
        }, rand);
        for (const c of o.coins) c.svg = shapeCoin(c.v);
        return o;
      }
      if (tier === 2) {
        const o = ownOrder({
          key: 'footing:2', story, ask: 'Each side is 2 m. How far is it all the way round?',
          right: M_(8),
          slips: [{ ...M_(4), slip: 'sides', why: '4 is how many sides. Each side is 2 m: 2 + 2 + 2 + 2.' }, { ...M_(6), slip: 'three', why: 'That is 3 sides. A square has 4: 2 + 2 + 2 + 2.' }, { ...M_(2), slip: 'one', why: 'That is one side. Go all the way round: 4 sides.' }],
          rightWhy: '2 + 2 + 2 + 2 = 8 m all the way round',
          sum: [{ op: 'mul', a: 4, b: 2, say: '4 sides of 2 m' }],
          help: { title: 'All the way round', svg: footingPicture({ mode: 'round', ask: false }), line: 'A square has 4 sides, all the same: add them all.', steps: ['4 sides, each 2 m.', '2 + 2 + 2 + 2, or 4 × 2.'] },
          own: { strand: 'geo', at: 26 }, credit: [{ strand: 'mul', at: 14, weight: 0.3 }], facts: { step: 'footing', tier, ans: 8 },
        }, rand);
        o.lead = footingPicture({ mode: 'round' });
        return o;
      }
      const o = ownOrder({
        key: 'footing:3', story: `${story} Is its corner square? The builders' check: 1.5 m along one side, 2 m along the other.`,
        ask: 'How long must the line between them be?',
        right: M_(2.5),
        slips: [{ ...M_(3.5), slip: 'added', why: '1.5 + 2 is going round two sides. Straight across is shorter.' }, { ...M_(3), slip: 'off', why: '3 × 3 = 9, but 1.5 × 1.5 + 2 × 2 = 6.25.' }, { ...M_(2), slip: 'side', why: '2 m is a side. The line across a square corner is the longest of the three.' }],
        rightWhy: '1.5 × 1.5 + 2 × 2 = 6.25, and 2.5 × 2.5 = 6.25: the builders\' 3, 4, 5, each halved',
        sum: [{ op: 'mul', a: 1.5, b: 1.5, say: 'One side squared' }, { op: 'mul', a: 2, b: 2, say: 'The other side squared' }, { op: 'add', a: 2.25, b: 4, say: 'Add them: the line between, squared' }],
        help: { title: 'The builders\' 3, 4, 5', svg: footingPicture({ mode: 'check', ask: false }), line: 'At a square corner the line between is the long side of a right triangle: 3, 4, 5 is one, and so is half of each: 1.5, 2, 2.5.', steps: ['1.5 × 1.5 and 2 × 2', 'Add them', 'Which number times itself makes that?'] },
        own: { strand: 'geo', at: 84 }, credit: [{ strand: 'dec', at: 46, weight: 0.3 }], facts: { step: 'footing', tier, ans: 2.5 }, size: 2,
      }, rand);
      o.lead = footingPicture({ mode: 'check' });
      return o;
    },
  },
  // ── 3. the first legs: four legs, 3 m struts from the rack each cut in half ──
  legs: {
    strand: 'number', at: (t) => [4, 4, 24, 46][t] ?? 46,
    make(tier = 1, { rand = Math.random } = {}) {
      if (tier <= 1) {
        const o = ownOrder({
          key: 'legs:1', story: 'A leg stands up in each pad of the footing.', ask: 'How many legs?',
          right: N(4, 'legs', 'leg'),
          slips: [{ ...N(3, 'legs', 'leg'), slip: 'under', why: 'Count every pad: 1, 2, 3, 4.' }, { ...N(5, 'legs', 'leg'), slip: 'over', why: 'Count the pads once each: there are 4.' }, { ...N(2, 'legs', 'leg'), slip: 'under', why: 'There is a pad at every corner: count them all.' }],
          rightWhy: 'A leg in each of the 4 pads: 4 legs',
          help: { title: 'Count the pads', svg: footingPicture({ mode: 'square' }), line: 'One leg goes in each pad. Count the pads.', steps: ['Touch each pad as you count.', '1, 2, 3, 4.'] },
          own: { strand: 'number', at: 4 }, facts: { step: 'legs', tier, ans: 4 },
        }, rand);
        o.lead = legsPicture({ mode: 'count' });
        return o;
      }
      if (tier === 2) {
        const o = ownOrder({
          key: 'legs:2', story: 'Each leg is a 3 m strut from the rack, cut in half.', ask: 'How long is each leg?',
          right: M_(1.5),
          slips: [{ ...M_(3), slip: 'whole', why: '3 m is the whole strut. Cut in half, each piece is shorter.' }, { ...M_(1), slip: 'third', why: '1 m is a third of 3 m. Half is 1 m and half a metre more.' }, { ...M_(6), slip: 'double', why: 'That is two struts. Half of one 3 m strut is less than 3.' }],
          rightWhy: 'Half of 3 is 1.5: each leg is 1.5 m',
          help: { title: 'Half of 3', svg: legsPicture({ mode: 'half', ask: false }), line: 'Half of 2 is 1, and half of the 1 m left is half a metre: 1.5 m.', steps: ['Half of 2 m is 1 m.', 'Half of the last 1 m is 0.5 m.', '1 + 0.5'] },
          own: { strand: 'frac', at: 24 }, facts: { step: 'legs', tier, ans: 1.5 },
        }, rand);
        o.lead = legsPicture({ mode: 'half' });
        return o;
      }
      const o = ownOrder({
        key: 'legs:3', story: 'Four legs, each 1.5 m: cut from the rack\'s 3 m struts.', ask: 'How many 3 m struts are needed?',
        right: N(2, 'struts', 'strut'),
        slips: [{ ...N(4, 'struts', 'strut'), slip: 'legs', why: '4 is the legs. Each 3 m strut makes two 1.5 m legs.' }, { ...N(6, 'struts', 'strut'), slip: 'metres', why: '6 is the metres of strut: 4 × 1.5. In 3 m struts that is 6 ÷ 3.' }, { ...N(3, 'struts', 'strut'), slip: 'off', why: '3 struts of 3 m is 9 m. 4 × 1.5 is only 6 m.' }],
        rightWhy: '4 × 1.5 = 6 m of strut, and 6 ÷ 3 = 2 struts',
        sum: [{ op: 'mul', a: 4, b: 1.5, say: 'The metres of strut' }, { op: 'div', a: 6, b: 3, say: 'In 3 m struts' }],
        help: { title: 'Metres, then struts', svg: legsPicture({ mode: 'rack', ask: false }), line: 'First the metres all four legs take; then how many 3 m struts make that.', steps: ['4 × 1.5', 'That many metres ÷ 3'] },
        own: { strand: 'dec', at: 46 }, credit: [{ strand: 'div', at: 25, weight: 0.4 }], facts: { step: 'legs', tier, ans: 2 }, size: 2,
      }, rand);
      o.lead = legsPicture({ mode: 'rack' });
      return o;
    },
  },
  // ── 4. brace each face: a square folds, a triangle can't (the youngest tap each face, as at the dock) ──
  brace: {
    strand: 'geo', at: (t) => [4, 4, 18, 86][t] ?? 86,
    make(tier = 1, { rand = Math.random } = {}) {
      if (tier <= 1) {
        const o = ownOrder({
          key: 'brace:1', story: 'The four legs wobble: each face can fold.', ask: 'Tap each face to brace it.',
          right: { v: 'braced', big: 'Braced', small: '', label: 'Every face braced' }, slips: [],
          rightWhy: 'Two triangles in every face: the mast is stiff!',
          help: { title: 'Squares fold, triangles don\'t', svg: facePicture({ ask: false, count: true }), line: 'Push on a face\'s corner and it leans over and folds. A brace across it, corner to corner, makes two triangles, and a triangle can\'t change its shape.', steps: ['Tap a face that wobbles.', 'A brace goes across it, corner to corner: two triangles.', 'Brace every face, and the mast is stiff.'] },
          own: { strand: 'geo', at: 4 }, facts: { step: 'brace', tier, faces: FACES },
        }, rand, 1);
        o.play = 'brace';
        return o;
      }
      if (tier === 2) {
        const o = ownOrder({
          key: 'brace:2', story: 'A brace across each of the 4 faces, corner to corner: each face is two triangles.', ask: 'How many triangles is that?',
          right: N(8, 'triangles', 'triangle'),
          slips: [{ ...N(4, 'triangles', 'triangle'), slip: 'faces', why: '4 is the faces. Each face is 2 triangles: count 2 for every face.' }, { ...N(6, 'triangles', 'triangle'), slip: 'three', why: 'That is 3 faces. There are 4: 2, 4, 6, 8.' }, { ...N(10, 'triangles', 'triangle'), slip: 'over', why: 'That is one face too many: 4 faces make 8.' }],
          rightWhy: '4 faces, 2 triangles each: 8 triangles',
          sum: [{ op: 'mul', a: 4, b: 2, say: '4 faces, 2 triangles in each' }],
          help: { title: 'Count by 2s', svg: facePicture({ ask: false, count: true }), line: 'Every face braced is two triangles. Count by 2s, one face at a time.', steps: ['2 for the first face.', '4, 6, 8: one more face each time.'] },
          own: { strand: 'mul', at: 16 }, credit: [{ strand: 'geo', at: 18, weight: 0.4 }], facts: { step: 'brace', tier, ans: 8 },
        }, rand);
        o.lead = facePicture({ count: true });
        return o;
      }
      const o = ownOrder({
        key: 'brace:3', story: 'A face of the mast is 2 m wide and 1.5 m tall. Its brace goes corner to corner.', ask: 'How long is the brace?',
        right: M_(2.5),
        slips: [{ ...M_(3.5), slip: 'added', why: '2 + 1.5 goes round two sides. Straight across is shorter.' }, { ...M_(2), slip: 'side', why: '2 m is the face\'s width. The brace corner to corner is the longest side.' }, { ...M_(3), slip: 'off', why: '3 × 3 = 9, but 2 × 2 + 1.5 × 1.5 = 6.25.' }],
        rightWhy: '2 × 2 + 1.5 × 1.5 = 6.25, and 2.5 × 2.5 = 6.25: the footing\'s 3, 4, 5 again',
        sum: [{ op: 'mul', a: 2, b: 2, say: 'The width squared' }, { op: 'mul', a: 1.5, b: 1.5, say: 'The height squared' }, { op: 'add', a: 4, b: 2.25, say: 'Add them: the brace squared' }],
        help: { title: 'The footing\'s 3, 4, 5 again', svg: facePicture({ ask: false }), line: 'The face\'s corner is square, so the brace is the long side of a right triangle: 1.5, 2 and 2.5, the builders\' 3, 4, 5 halved.', steps: ['2 × 2 and 1.5 × 1.5', 'Add them', 'Which number times itself makes that?'] },
        own: { strand: 'geo', at: 86 }, credit: [{ strand: 'dec', at: 46, weight: 0.3 }], facts: { step: 'brace', tier, ans: 2.5 }, size: 2,
      }, rand);
      o.lead = facePicture();
      return o;
    },
  },
  // ── 5. stack it up: section on section, eight of them, each 1.5 m ──
  stack: {
    strand: 'number', at: (t) => [6, 6, 30, 50][t] ?? 50,
    make(tier = 1, { rand = Math.random } = {}) {
      if (tier <= 1) {
        const o = ownOrder({
          key: 'stack:1', story: 'Section on section, braced as it goes up.', ask: 'How many sections make the whole mast?',
          right: N(8, 'sections', 'section'),
          slips: [{ ...N(7, 'sections', 'section'), slip: 'under', why: 'Count every section, the top one too.' }, { ...N(9, 'sections', 'section'), slip: 'over', why: 'Count each section once, from the bottom up.' }, { ...N(6, 'sections', 'section'), slip: 'under', why: 'Count them all, from the roof to the top: 8.' }],
          rightWhy: '1, 2, 3, 4, 5, 6, 7, 8: eight sections',
          help: { title: 'Count up the mast', svg: stackPicture({ mode: 'count', ask: false }), line: 'Count the sections from the bottom up, one at a time.', steps: ['Start at the roof: 1.', 'Count each one up to the top.'] },
          own: { strand: 'number', at: 6 }, facts: { step: 'stack', tier, ans: 8 },
        }, rand);
        o.lead = stackPicture({ mode: 'count' });
        return o;
      }
      const up = tier === 2;
      const o = ownOrder({
        key: `stack:${tier}`, story: 'Eight sections, each 1.5 m tall, stacked one on another.', ask: up ? 'Count up by 1.5 m: how tall is the mast?' : 'How tall is the mast?',
        right: M_(12),
        slips: [{ ...M_(9.5), slip: 'added', why: '8 + 1.5 adds. Eight sections of 1.5 m each: 8 × 1.5.' }, { ...M_(10.5), slip: 'seven', why: 'That is seven sections. Count up to the eighth: 12.' }, { ...M_(8), slip: 'count', why: '8 is the sections. Each one is 1.5 m tall.' }],
        rightWhy: up ? '1.5, 3, 4.5, 6, 7.5, 9, 10.5, 12: 12 m' : '8 × 1.5 = 12: the mast is 12 m',
        sum: [{ op: 'mul', a: 8, b: 1.5, say: '8 sections of 1.5 m' }],
        help: { title: up ? 'Count up by 1.5s' : 'Sections times their height', svg: stackPicture({ mode: 'up', ask: false }), line: up ? 'Each section adds 1.5 m: 1.5, 3, 4.5, ... one for every section.' : 'Eight sections, each 1.5 m: 8 × 1.5. Or count up by 1.5s.', steps: up ? ['1.5, 3, 4.5, 6', '7.5, 9, 10.5, 12'] : ['8 × 1 = 8', '8 × 0.5 = 4', '8 + 4'] },
        own: up ? { strand: 'add', at: 30 } : { strand: 'dec', at: 50 }, credit: [{ strand: 'mul', at: 23, weight: 0.3 }], facts: { step: 'stack', tier, ans: 12 },
      }, rand);
      o.lead = stackPicture({ mode: up ? 'up' : 'times' });
      return o;
    },
  },
  // ── 6. cables to the arms: three at each of two heights; 12 m up, 5 m out: 13 m ──
  cables: {
    strand: 'number', at: (t) => [8, 8, 18, 86][t] ?? 86,
    make(tier = 1, { rand = Math.random } = {}) {
      // (the anchors stand on the ends of three arms out from the tower's roof, which is too small for them)
      const story = 'Cables from the mast down to an anchor ring on each of three arms, pulled tight: three at each of two heights.';
      if (tier <= 2) {
        const young = tier <= 1;
        const o = ownOrder({
          key: `cables:${tier}`, story, ask: young ? 'How many cables?' : '3 cables at each of 2 heights: how many cables in all?',
          right: N(6, 'cables', 'cable'),
          slips: [{ ...N(3, 'cables', 'cable'), slip: 'one', why: '3 is one height. There are two heights: 3 and 3.' }, { ...N(5, 'cables', 'cable'), slip: 'added', why: young ? 'Count them all: 3 up high and 3 lower down.' : '3 + 2 adds the heights. 3 cables at each of 2 heights: 3 × 2.' }, { ...N(9, 'cables', 'cable'), slip: 'over', why: 'That is 3 heights. There are 2: 3 and 3.' }],
          rightWhy: '3 and 3: 6 cables',
          ...(young ? {} : { sum: [{ op: 'mul', a: 3, b: 2, say: '3 cables at each of 2 heights' }] }),
          help: { title: young ? 'Count the cables' : 'Groups of the same', svg: cablesPicture({ mode: young ? 'count' : 'groups', ask: false }), line: young ? 'Count the cables up high, then the ones lower down.' : '2 heights, 3 cables at each: 2 groups of 3.', steps: young ? ['Up high: 1, 2, 3.', 'Lower down: 4, 5, 6.'] : ['3 at the top, 3 lower down.', '3 + 3, or 3 × 2.'] },
          own: young ? { strand: 'number', at: 8 } : { strand: 'mul', at: 18 }, facts: { step: 'cables', tier, ans: 6 },
        }, rand);
        o.lead = cablesPicture({ mode: young ? 'count' : 'groups' });
        return o;
      }
      const o = ownOrder({
        key: 'cables:3', story: `${story} The top ones run from 12 m up the mast to an anchor 5 m out.`, ask: 'How long is a top cable?',
        right: M_(13),
        slips: [{ ...M_(17), slip: 'added', why: '12 + 5 goes down the mast and out along the arm. The cable goes straight across.' }, { ...M_(12), slip: 'side', why: '12 m is the mast. The cable is the long side, longer than both.' }, { ...M_(14), slip: 'off', why: '14 × 14 = 196, but 5 × 5 + 12 × 12 = 169.' }],
        rightWhy: '5 × 5 + 12 × 12 = 169, and 13 × 13 = 169: 13 m',
        sum: [{ op: 'mul', a: 5, b: 5, say: 'Out to the anchor, squared' }, { op: 'mul', a: 12, b: 12, say: 'Up the mast, squared' }, { op: 'add', a: 25, b: 144, say: 'Add them: the cable squared' }],
        help: { title: 'Squares on the sides', svg: cablesPicture({ mode: 'tri', ask: false }), line: 'The mast stands square to the roof and its arms, so the cable is the long side of a right triangle: the two short sides squared add up to it squared.', steps: ['5 × 5 and 12 × 12', 'Add them', 'Which number times itself makes that?'] },
        own: { strand: 'geo', at: 86 }, credit: [{ strand: 'mul', at: 43, weight: 0.3 }], facts: { step: 'cables', tier, ans: 13 }, size: 2,
      }, rand);
      o.lead = cablesPicture({ mode: 'tri' });
      return o;
    },
  },
  // ── 7. the dish on top: tilted 30 degrees up, turned a right angle and half of one more: 135 degrees ──
  dish: {
    strand: 'geo', at: (t) => [8, 8, 30, 44][t] ?? 44,
    make(tier = 1, { rand = Math.random } = {}) {
      const story = 'The new dish is lifted to the top and tilted 30° up. Now turn it round from the station\'s bow to the sky\'s far side.';
      if (tier <= 1) {
        const S = (v) => N(v, 'slices', 'slice');
        const o = ownOrder({
          key: 'dish:1', story: 'The new dish is on top. Turn it round: each slice is half a square corner.', ask: 'How many slices does the dish turn?',
          right: S(3),
          slips: [{ ...S(2), slip: 'under', why: 'Count every slice, from the bow round to the dish.' }, { ...S(4), slip: 'over', why: 'Count only the slices the dish has turned.' }, { ...S(1), slip: 'under', why: 'Count them all, one after another.' }],
          rightWhy: 'Three slices: a square corner and half of one more',
          help: { title: 'Count the slices', svg: dishPicture({ mode: 'slices', ask: false }), line: 'Start at the bow and count each slice round to the dish.', steps: ['The first slice: 1.', 'Count on round to the dish.'] },
          own: { strand: 'number', at: 6 }, credit: [{ strand: 'geo', at: 8, weight: 0.4 }], facts: { step: 'dish', tier, ans: 3 },
        }, rand);
        o.lead = dishPicture({ mode: 'slices' });
        return o;
      }
      const sum = tier === 2;
      const o = ownOrder({
        key: `dish:${tier}`, story, ask: sum ? 'A right angle, 90°, and 45° more: how far round is that?' : 'Turn it a right angle and half of one more: how far round is that?',
        right: DEG(135),
        slips: [{ ...DEG(90), slip: 'right', why: '90° is the right angle alone. Half of one more goes on top.' }, { ...DEG(180), slip: 'two', why: '180° is two right angles. Only half of one more: 45°.' }, { ...DEG(sum ? 125 : 120), slip: 'off', why: sum ? '90 + 45: 90 + 40 is 130, and 5 more.' : 'Half of 90° is 45°: 90 + 45.' }],
        rightWhy: '90 + 45 = 135°',
        sum: sum ? [{ op: 'add', a: 90, b: 45, say: 'The right angle and 45° more' }] : [{ op: 'div', a: 90, b: 2, say: 'Half of a right angle' }, { op: 'add', a: 90, b: 45, say: 'The right angle and that half' }],
        help: { title: 'A right angle and a half', svg: dishPicture({ mode: 'sum', ask: false }), line: 'A right angle is a square corner, 90°. Half of one is 45°. Put them together.', steps: sum ? ['90 + 45'] : ['Half of 90°', '90° and that'] },
        own: { strand: 'geo', at: sum ? 30 : 44 }, credit: [{ strand: 'add', at: 24, weight: 0.4 }], facts: { step: 'dish', tier, ans: 135 }, size: sum ? 1 : 2,
      }, rand);
      o.lead = dishPicture({ mode: sum ? 'sum' : 'turn' });
      return o;
    },
  },
  // ── 8. the test, and a call: three short, three long, three short; 1 bar of 5 at 135°, 3 bars 5° more, at 140° ──
  call: {
    strand: 'number', at: (t) => [8, 8, 20, 28][t] ?? 28,
    make(tier = 1, { rand = Math.random } = {}) {
      if (tier <= 1) {
        const B = (v) => N(v, 'beeps', 'beep');
        const o = ownOrder({
          key: 'call:1', story: 'The dish sweeps the sky, and the mast holds. Something is beeping: three short, three long, three short.', ask: 'How many beeps?',
          right: B(9),
          slips: [{ ...B(6), slip: 'two', why: 'Count all three groups: short, long, short.' }, { ...B(3), slip: 'one', why: 'That is one group. There are three groups of 3.' }, { ...B(8), slip: 'under', why: 'Count every beep, the last one too.' }],
          rightWhy: '3, 6, 9: nine beeps. That is SOS: someone needs help!',
          help: { title: 'Count the beeps', svg: callPicture({ mode: 'beeps', ask: false }), line: 'Count each beep, the short ones and the long ones.', steps: ['The short ones: 1, 2, 3.', 'The long ones: 4, 5, 6.', 'The short ones again: 7, 8, 9.'] },
          own: { strand: 'number', at: 8 }, facts: { step: 'call', tier, ans: 9 },
        }, rand);
        o.lead = callPicture({ mode: 'beeps' });
        return o;
      }
      const add = tier === 2;
      const story = `The dish sweeps the sky, and the mast holds. A faint signal: 1 bar of ${SIGNAL.bars} with the dish at ${SIGNAL.at}°.`;
      const o = add
        ? ownOrder({
          key: 'call:2', story: `${story} It is clearer 5° further round.`, ask: 'Turn the dish 5° more: where does it point?',
          right: DEG(140),
          slips: [{ ...DEG(130), slip: 'back', why: '135 − 5 turns it back. 5° more: 135 + 5.' }, { ...DEG(145), slip: 'off', why: '135 + 5: count on 5 from 135.' }, { ...DEG(135), slip: 'same', why: 'That is where it is now. Turn it 5° more.' }],
          rightWhy: '135 + 5 = 140°: three bars!',
          sum: [{ op: 'add', a: 135, b: 5, say: '5° more' }],
          help: { title: 'Count on 5', svg: callPicture({ mode: 'bars', ask: false }), line: 'The dish is at 135°. Count on 5 more.', steps: ['135', '136, 137, 138, 139, 140'] },
          own: { strand: 'add', at: 20 }, facts: { step: 'call', tier, ans: 140 },
        }, rand)
        : ownOrder({
          key: 'call:3', story: `${story} Turning it, it is clearest at ${SIGNAL.best}°.`, ask: 'How many degrees more must the dish turn?',
          right: DEG(5),
          slips: [{ ...DEG(15), slip: 'off', why: `${SIGNAL.best} − ${SIGNAL.at}: from 135 count on to 140.` }, { ...DEG(10), slip: 'off', why: `From 135 to 140 is less than 10: count on.` }, { ...DEG(45), slip: 'half', why: '45° is half a right angle. Only from 135 to 140.' }],
          rightWhy: '140 − 135 = 5° more: three bars!',
          sum: [{ op: 'sub', a: 140, b: 135, say: 'From 135° on to 140°' }],
          help: { title: 'How far on', svg: callPicture({ mode: 'bars', ask: false }), line: 'The dish is at 135°; the signal is clearest at 140°. How far from one to the other?', steps: ['140 − 135'] },
          own: { strand: 'sub', at: 28 }, facts: { step: 'call', tier, ans: 5 },
        }, rand);
      o.lead = callPicture({ mode: 'bars' });
      return o;
    },
  },
};
// (the card's squares a young player taps: the dock's own, one for each face)
export const faceSvg = (k) => squareSvg(k);

const M = (maker, step) => ({ maker, step, w: 1 });
const mix = (tier) => STEPS.map((s) => M(s.id, tier));
export const PLACE = {
  id: 'antenna', name: 'The radio tower', short: 'Radio', math: 'Building the antenna',
  pic: 'antenna', job: null,
  line: 'Build the station\'s new antenna on top of the control tower, a part at a time from the radio desk: the footing, the legs, the braces, the sections, the cables and the dish; then listen.',
  levels: [
    { id: 'count', title: 'Count and shapes', line: 'Count the legs, the sections, the cables; find the square', grade: 4, strand: 'number', gen: { mix: mix(1) } },
    { id: 'groups', title: 'Halves, adding and groups', line: 'Half of a 3 m strut; 3 cables at each of 2 heights; 90° and 45°', grade: 22, strand: 'add', gen: { mix: mix(2) } },
    { id: 'corners', title: 'Square corners and long sides', line: '1.5 m and 2 m at a square corner; 12 m up and 5 m out', grade: 60, strand: 'geo', gen: { mix: mix(3) } },
  ],
};
// every level asks the step the antenna is at (live: the link's now(), { step }); with none (node, the levels page) any
export function pickAsk(m, { live = null } = {}) {
  const id = live && STEPS[live.step] ? STEPS[live.step].id : null;
  return id ? m.find((a) => a.maker === id) || null : null;
}

// the job: its spot at the control room's radio desk, in front of its dial, between its two chairs (Rhea sits on one
// of them), facing the desk and the windows over it; a step nearer the desk than the place behind its chairs where the
// duty officer stands now and then to look at its screens (src/life.js radioBehind, 1.75 m out)
export const JOB = {
  dark: true,
  id: 'antenna', name: 'The radio tower', short: 'Radio', open: true,
  spot: { piece: 'console', variant: 'radio', room: 'tower', local: [0, 0, 1.15], face: [0, -1] },
  sign: 'Radio tower', signSub: 'Radio desk', hint: 'Build the new antenna, then listen',
  place: PLACE, setting: null, makers: MAKERS, pickAsk, card: 'radio',
  // the antenna on the control tower's roof, the camera on it, the faces to tap, the call: src/jobs/antennalink.js
  // (index.js makes it)
  link: 'antenna',
};
export { T as TIERS, tallPicture, footingPicture, legsPicture, facePicture, stackPicture, cablesPicture, dishPicture, callPicture };
