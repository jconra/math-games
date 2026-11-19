// THE ENGINEER'S DISPLAY: the one thing that draws a question's shape for the engineer's cards (src/jobs/engineer.js).
// The game's maker (2026-11-19): "I am thinking it would be good to have some questions about volume, surface areas, and
// edge lengths." And: "I like the idea of the engineering covering questions about volume, area, and edges. I imagine
// something like a display with some kind of cube configuration (depending on the level). So a basic level could just
// show a 2d box and ask what its height is and what its length is. The levels would progress through area and volume.
// The high levels could show a cluster of cubes (the more, the harder) in 3d that can spin around. The questions can
// claim that the cubes are fuel pellets that need a containment field or something."
// He also agreed that a cluster turns slowly by itself and can be dragged round.
//
// Dark, with light lines, as the station's other screens. It draws exactly what a question's facts say (the shape the
// maker hands over, engineer.js): a flat box of pellets on a grid, a block of pellets, a see-through box (the
// containment field by itself, its sides marked), a cluster of pellets; the field as the amber box round the pellets
// where the question is about it.
//
// NO SECOND WEBGL PICTURE. A flat shape is a still drawing (SVG). A shape in 3D is drawn on a small 2D canvas: this
// file works out the cubes' faces itself (which faces have no pellet against them, which of those face the eye, and the
// order to paint them in, far to near) and fills them, a few dozen four-sided shapes a frame. It turns slowly by
// itself; a drag with the mouse or a finger turns it (the canvas takes the touch, so the page does not scroll under
// it); a few seconds after the finger lifts it turns by itself again.
//
// Everything above mountShape is pure (no page): node tests it, and the maker uses it for the still pictures a card and
// its help carry.
//   shapeSvg(shape, { yaw, pitch })   -> the shape as a still picture (an SVG string)
//   mountShape(host, shape)           -> the shape shown in `host`: still for a flat shape, turning for one in 3D.
//                                        -> { el, flat, state(), set(yaw, pitch), hold(on), stop() }
//   seenFrom(shape, yaw, pitch)       -> which pellets (indexes into shape.cells) show a face from that side
//   outsideFaces(cells)               -> the faces with no pellet against them: [{ i, c, d }]
//   listOf(shape, yaw, pitch, { h })  -> what is drawn, in order: [{ k: 'p' | 'l' | 't', ... }] (the tests read it)
//   camera(shape, yaw, pitch)         -> the eye: { eye, pt(x, y, z) -> [x, y] on the display, k, mid, D, rot }
//   plansSvg, pairsSvg                -> two of the help's pictures: a cluster layer by layer; a box's faces in pairs
//   engineerLink()                    -> the job panel's `live` for this job (src/jobs/panel.js): the card's top, and
//                                        the display put on each new card
//
// A SHAPE (plain facts; x along its length, y up, z along its width):
//   { kind: 'flat', l, h, cells: [[x, y], ...], pellets, field, marks: [{ a: [x, y], b: [x, y], text }], note }
//   { kind: 'block' | 'box' | 'cluster', l, w, h, cells: [[x, y, z], ...], pellets, field, frame, skin,
//     marks: [{ axis: 'l' | 'w' | 'h', text }], note, view: { yaw, pitch } }
// and, for the help's pictures only: lit, bands, tags, caption (flat); lit, tones, edgeTones, legend (3D).

export const VIEW = { w: 360, h: 220, least: 120, most: 290 };   // the display's own units: a shape is drawn 360 wide, and 220 high unless the page gives it another height (120 to 290)
export const START = { yaw: -0.62, pitch: 0.46 };          // how a 3D shape is first seen: its front, its right side, its top
export const TURN = { spin: 0.3, drag: 0.011, rest: 3, most: 1.45 };   // radians a second by itself; radians a pixel dragged; seconds still after a drag; the most it tips up or down
const CAM = { far: 8, most: 48, pad: 7, marked: 16 };     // the eye, in half-widths of the shape away; the biggest a pellet is drawn; room round the shape, and round one with its sides marked
// the colours (src/jobs/pics.js NIGHT's, and the two this display adds: a pellet's faces and its light edges)
const K = { INK: '#dfe9f2', SOFT: '#8fa3b6', GRID: '#1e2d3b', ASK: '#ffd560', FIELD: '#ffab45', EDGE: '#a8ecff', PLATE: '#0b1118',
  P0: [9, 27, 38], P1: [44, 118, 142],                     // a pellet's face, in the dark and in the light
  LONG: '#6fc3ff', WIDE: '#59d68b', HIGH: '#ffab45' };     // the three kinds of edge, and of face, in the help's pictures
const TONE = { 0: [58, 96, 150], 1: [36, 120, 86], 2: [150, 96, 30] };   // faces by the way they point (x, y, z), for the help
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f1 = (v) => Math.round(v * 10) / 10;
const rgb = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// (the help's colours, for the maker's keys: the three kinds of edge, and faces by the way they point)
export const KEY = { long: K.LONG, wide: K.WIDE, high: K.HIGH, faceX: rgb(TONE[0]), faceY: rgb(TONE[1]), faceZ: rgb(TONE[2]) };
export const is3d = (S) => !!S && S.kind !== 'flat';

// ── what is drawn: a list of plain things (a four-sided shape, a line, words), which the still picture and the canvas
// both paint the same way ────────────────────────────────────────────────────────────────────────────────────────────
const poly = (pts, o = {}) => ({ k: 'p', pts, ...o });                  // { fill, fa, stroke, sa, lw, dash }
const line = (x0, y0, x1, y1, o = {}) => ({ k: 'l', pts: [x0, y0, x1, y1], ...o });
const words = (x, y, s, o = {}) => ({ k: 't', x, y, s: String(s), size: 12.5, fill: K.INK, weight: 600, anchor: 'middle', ...o });
const textWide = (t) => t.s.length * t.size * 0.56 + 8;

function toSvg(list, w, h, label = '') {
  let s = '';
  for (const it of list) {
    if (it.k === 'p' || it.k === 'l') {
      const pts = it.pts.map(f1), stroke = it.stroke ? ` stroke="${it.stroke}" stroke-width="${it.lw || 1}"${it.sa != null ? ` stroke-opacity="${it.sa}"` : ''}${it.dash ? ` stroke-dasharray="${it.dash.join(' ')}"` : ''} stroke-linejoin="round" stroke-linecap="round"` : '';
      if (it.k === 'l') s += `<path d="M${pts[0]} ${pts[1]}L${pts[2]} ${pts[3]}" fill="none"${stroke}/>`;
      else s += `<polygon points="${pts.join(' ')}" fill="${it.fill || 'none'}"${it.fa != null ? ` fill-opacity="${it.fa}"` : ''}${stroke}/>`;
    } else {
      if (it.plate) { const tw = textWide(it), x = it.anchor === 'start' ? it.x - 4 : it.anchor === 'end' ? it.x - tw + 4 : it.x - tw / 2; s += `<rect x="${f1(x)}" y="${f1(it.y - it.size * 0.95)}" width="${f1(tw)}" height="${f1(it.size * 1.3)}" rx="3" fill="${K.PLATE}" fill-opacity="0.82"/>`; }
      s += `<text x="${f1(it.x)}" y="${f1(it.y)}" font-size="${it.size}" font-weight="${it.weight}" fill="${it.fill}" text-anchor="${it.anchor}" font-family="system-ui, sans-serif">${esc(it.s)}</text>`;
    }
  }
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg pne-svg"${label ? ` aria-label="${esc(label)}"` : ''}>${s}</svg>`;
}
function paint(g, list) {
  for (const it of list) {
    if (it.k === 'p' || it.k === 'l') {
      const p = it.pts;
      g.beginPath(); g.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
      if (it.k === 'p') { g.closePath(); if (it.fill) { g.globalAlpha = it.fa ?? 1; g.fillStyle = it.fill; g.fill(); } }
      if (it.stroke) { g.globalAlpha = it.sa ?? 1; g.strokeStyle = it.stroke; g.lineWidth = it.lw || 1; g.setLineDash(it.dash || []); g.stroke(); }
    } else {
      g.font = `${it.weight} ${it.size}px system-ui, sans-serif`; g.textAlign = it.anchor === 'middle' ? 'center' : it.anchor;
      if (it.plate) { const tw = g.measureText(it.s).width + 8, x = it.anchor === 'start' ? it.x - 4 : it.anchor === 'end' ? it.x - tw + 4 : it.x - tw / 2; g.globalAlpha = 0.82; g.fillStyle = K.PLATE; g.fillRect(x, it.y - it.size * 0.95, tw, it.size * 1.3); }
      g.globalAlpha = 1; g.fillStyle = it.fill; g.fillText(it.s, it.x, it.y);
    }
  }
  g.globalAlpha = 1; g.setLineDash([]);
}

// ── A FLAT SHAPE: pellets in the squares of a grid, the field the amber line round them ────────────────────────────────
const k2 = (x, y) => `${x},${y}`;
// the sides of the shape's outline: every side of a square with no square of the shape beyond it. -> [[x0, y0, x1, y1, nx, ny]]
export function outline(cells) {
  const set = new Set(cells.map((c) => k2(c[0], c[1]))), out = [];
  for (const [x, y] of cells) {
    if (!set.has(k2(x, y - 1))) out.push([x, y, x + 1, y, 0, -1]);
    if (!set.has(k2(x, y + 1))) out.push([x, y + 1, x + 1, y + 1, 0, 1]);
    if (!set.has(k2(x - 1, y))) out.push([x, y, x, y + 1, -1, 0]);
    if (!set.has(k2(x + 1, y))) out.push([x + 1, y, x + 1, y + 1, 1, 0]);
  }
  return out;
}
function flatList(S, { w: W = VIEW.w, h: H = VIEW.h } = {}) {
  const out = [], set = new Set(S.cells.map((c) => k2(c[0], c[1])));
  // the sides marked: which way each lies, and which way is out from it (the side of the line where the shape is not;
  // a mark may say its own, `out`)
  const marks = (S.marks || []).map((m) => {
    const flatways = m.a[1] === m.b[1], mx = (m.a[0] + m.b[0]) / 2, my = (m.a[1] + m.b[1]) / 2;
    return { ...m, flatways, nx: m.out ? m.out[0] : flatways ? 0 : set.has(k2(m.a[0], Math.floor(my))) ? -1 : 1, ny: m.out ? m.out[1] : !flatways ? 0 : set.has(k2(Math.floor(mx), m.a[1])) ? -1 : 1 };
  });
  // room for the words: only on the sides of the shape's box that have a mark outside them
  const side = marks.some((m) => !m.flatways && (m.nx < 0 ? m.a[0] === 0 : m.a[0] === S.l)) ? 50 : (S.tags || []).length ? 30 : 14;
  const top = marks.some((m) => m.flatways && m.ny > 0 && m.a[1] === S.h) ? 26 : 8, bot = (marks.some((m) => m.flatways && m.ny < 0 && m.a[1] === 0) ? 26 : 8) + (S.caption ? 22 : 0);
  const u = Math.min(44, (W - 2 * side) / (S.l + 1), (H - top - bot) / (S.h + 1));
  const x0 = (W - S.l * u) / 2, yb = top + (H - top - bot + S.h * u) / 2;
  const X = (x) => x0 + x * u, Y = (y) => yb - y * u;
  // the grid, half a square past the shape all round
  for (let x = 0; x <= S.l; x++) out.push(line(X(x), Y(-0.5), X(x), Y(S.h + 0.5), { stroke: K.GRID, lw: 1 }));
  for (let y = 0; y <= S.h; y++) out.push(line(X(-0.5), Y(y), X(S.l + 0.5), Y(y), { stroke: K.GRID, lw: 1 }));
  // (the help's tinted boxes: an L-shape's two boxes, a row marked)
  for (const b of S.bands || []) out.push(poly([X(b.x), Y(b.y), X(b.x + b.l), Y(b.y), X(b.x + b.l), Y(b.y + b.h), X(b.x), Y(b.y + b.h)], { fill: b.fill || K.LONG, fa: b.fa ?? 0.2, ...(b.stroke ? { stroke: b.stroke, lw: 1.4, dash: [4, 3] } : {}) }));
  const lit = S.lit ? new Set(S.lit.map((c) => k2(c[0], c[1]))) : null, i = u * 0.09;
  for (const [x, y] of S.cells) {
    if (S.pellets) {
      const on = !lit || lit.has(k2(x, y));
      out.push(poly([X(x) + i, Y(y) - i, X(x + 1) - i, Y(y) - i, X(x + 1) - i, Y(y + 1) + i, X(x) + i, Y(y + 1) + i], { fill: rgb(mix(K.P0, K.P1, on ? 0.62 : 0.2)), stroke: lit && on ? K.ASK : K.EDGE, sa: on ? 0.95 : 0.3, lw: lit && on ? 1.8 : 1.1 }));
    } else if (!(S.bands || []).length) out.push(poly([X(x), Y(y), X(x + 1), Y(y), X(x + 1), Y(y + 1), X(x), Y(y + 1)], { fill: K.LONG, fa: 0.06 }));
  }
  // the field: the line round the shape, with a soft glow under it
  if (S.field) for (const pass of [{ lw: 6, sa: 0.16 }, { lw: 2.2, sa: 1 }]) for (const [ax, ay, bx, by] of outline(S.cells)) out.push(line(X(ax), Y(ay), X(bx), Y(by), { stroke: K.FIELD, ...pass }));
  // a side's length written along it, on the outside: a thin measure line with a tick at each end, and the words
  for (const m of marks) {
    const [ax, ay] = m.a, [bx, by] = m.b, { flatways, nx, ny } = m;
    const ask = m.text === '?', col = ask ? K.ASK : K.SOFT, off = 9, px = X(ax) + nx * off, py = Y(ay) - ny * off, qx = X(bx) + nx * off, qy = Y(by) - ny * off, tk = 3.5;
    out.push(line(px, py, qx, qy, { stroke: col, lw: 1.1 }));
    out.push(flatways ? line(px, py - tk, px, py + tk, { stroke: col, lw: 1.1 }) : line(px - tk, py, px + tk, py, { stroke: col, lw: 1.1 }));
    out.push(flatways ? line(qx, qy - tk, qx, qy + tk, { stroke: col, lw: 1.1 }) : line(qx - tk, qy, qx + tk, qy, { stroke: col, lw: 1.1 }));
    const tx = (px + qx) / 2 + nx * 7, ty = flatways ? (ny > 0 ? py - 6 : py + 15) : (py + qy) / 2 + 4.5;
    out.push(words(tx, ty, m.text, { fill: ask ? K.ASK : K.INK, weight: ask ? 800 : 600, size: ask ? 15 : 12.5, anchor: flatways ? 'middle' : nx < 0 ? 'end' : 'start' }));
  }
  for (const t of S.tags || []) out.push(words(X(t.x), Y(t.y) + 4.5, t.text, { fill: t.ask ? K.ASK : K.INK, weight: t.ask ? 800 : 700, size: t.size || 12.5, anchor: t.anchor || 'middle', plate: !!t.plate }));
  if (S.note) out.push(words(X(S.l / 2), Y(S.h / 2) + 4.5, S.note, { fill: K.INK, weight: 700, size: 13, plate: true }));
  if (S.caption) out.push(words(W / 2, H - 8, S.caption, { fill: K.ASK, weight: 800, size: 13.5 }));
  return out;
}

// ── A SHAPE IN 3D ───────────────────────────────────────────────────────────────────────────────────────────────────
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
// a face's four corners, going round it, as steps from its cube's low corner, for each of the six ways it can point
const QUADS = [
  [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
  [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]],
];
const k3 = (x, y, z) => `${x},${y},${z}`;
// the faces with no pellet against them: i the pellet (its place in cells), c its cube, d which way the face points (DIRS)
export function outsideFaces(cells) {
  const set = new Set(cells.map((c) => k3(c[0], c[1], c[2]))), out = [];
  cells.forEach((c, i) => DIRS.forEach((d, k) => { if (!set.has(k3(c[0] + d[0], c[1] + d[1], c[2] + d[2]))) out.push({ i, c, d: k }); }));
  return out;
}
const facesKept = new WeakMap();
const facesFor = (cells) => { let f = facesKept.get(cells); if (!f) { f = cells.map(() => []); for (const o of outsideFaces(cells)) f[o.i].push(o.d); facesKept.set(cells, f); } return f; };

// the eye: the shape turned by yaw (round its upright) and then tipped by pitch (toward the eye), seen from a little
// way off so that the near side is a little bigger than the far one
export function camera(S, yaw, pitch, W = VIEW.w, H = VIEW.h, lift = 0) {
  const c = [S.l / 2, S.h / 2, S.w / 2], r = Math.hypot(S.l, S.w, S.h) / 2, D = r * CAM.far, big = CAM.far / (CAM.far - 1);
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const pad = (S.marks || []).length ? CAM.marked : CAM.pad;
  const k = Math.min(CAM.most, ((H - lift) / 2 - pad) / (r * big), (W / 2 - pad - 16) / (Math.hypot(S.l, S.w) / 2 * big));
  const rot = (x, y, z) => { const x1 = x * cy + z * sy, z1 = -x * sy + z * cy; return [x1, y * cp - z1 * sp, y * sp + z1 * cp]; };
  const mid = (H - lift) / 2;
  const pt = (x, y, z) => { const v = rot(x - c[0], y - c[1], z - c[2]), f = D / (D - v[2]); return [W / 2 + v[0] * k * f, mid - v[1] * k * f]; };
  return { rot, pt, k, c, r, D, mid, eye: [c[0] - D * cp * sy, c[1] + D * sp, c[2] + D * cp * cy] };
}
const LIGHT = (() => { const v = [-0.38, 0.74, 0.56], n = Math.hypot(...v); return v.map((x) => x / n); })();
// the 12 edges of the box round a shape: its two ends, the two faces that meet along it (DIRS), and which way it runs
function boxEdges(l, h, w) {
  const E = [];
  for (const y of [0, h]) for (const z of [0, w]) E.push({ a: [0, y, z], b: [l, y, z], f: [y ? 2 : 3, z ? 4 : 5], axis: 'l' });
  for (const x of [0, l]) for (const z of [0, w]) E.push({ a: [x, 0, z], b: [x, h, z], f: [x ? 0 : 1, z ? 4 : 5], axis: 'h' });
  for (const x of [0, l]) for (const y of [0, h]) E.push({ a: [x, y, 0], b: [x, y, w], f: [x ? 0 : 1, y ? 2 : 3], axis: 'w' });
  return E;
}
const AXIS_TONE = { l: K.LONG, w: K.WIDE, h: K.HIGH };
function solidList(S, yaw, pitch, { w: W = VIEW.w, h: H = VIEW.h } = {}) {
  const out = [], legend = S.legend || [], lift = (S.note ? 20 : 0) + (legend.length ? 22 : 0);
  const cam = camera(S, yaw, pitch, W, H, lift), { pt, eye } = cam, { l, w, h } = S;
  // which of the box's six sides face the eye
  const mids = [[l, h / 2, w / 2], [0, h / 2, w / 2], [l / 2, h, w / 2], [l / 2, 0, w / 2], [l / 2, h / 2, w], [l / 2, h / 2, 0]];
  const toward = DIRS.map((n, k) => n[0] * (eye[0] - mids[k][0]) + n[1] * (eye[1] - mids[k][1]) + n[2] * (eye[2] - mids[k][2]) > 0);
  const shade = DIRS.map((n) => { const v = cam.rot(n[0], n[1], n[2]); return Math.max(0, Math.min(1, 0.22 + 0.78 * Math.max(0, v[0] * LIGHT[0] + v[1] * LIGHT[1] + v[2] * LIGHT[2]))); });
  const boxFace = (k) => QUADS[k].flatMap((o) => pt(o[0] * l, o[1] * h, o[2] * w));
  const edges = S.field || S.kind === 'box' ? boxEdges(l, h, w) : [], bold = S.frame || S.edgeTones ? 2.6 : 1.7;
  const edgeLine = (e, front) => { const a = pt(...e.a), b = pt(...e.b), col = S.edgeTones ? AXIS_TONE[e.axis] : K.FIELD; return line(a[0], a[1], b[0], b[1], front ? { stroke: col, lw: bold, sa: 1 } : { stroke: col, lw: Math.max(1.1, bold - 0.8), sa: S.edgeTones ? 0.7 : 0.45, dash: [3, 3] }); };
  // the far side of the field first: its faces (a see-through box's, faintly) and its edges, dimmer and dashed
  if (S.kind === 'box') for (let k = 0; k < 6; k++) if (!toward[k]) out.push(poly(boxFace(k), { fill: K.FIELD, fa: S.skin ? 0.1 : 0.04 }));
  for (const e of edges) if (!toward[e.f[0]] && !toward[e.f[1]]) out.push(edgeLine(e, false));
  // the pellets, far to near (in each of the three directions, the cubes further from the eye first: a cube can only
  // hide one that is no nearer than it in all three)
  if (S.pellets) {
    const faces = facesFor(S.cells), far = S.cells.map((c, i) => [Math.abs(c[0] + 0.5 - eye[0]), Math.abs(c[1] + 0.5 - eye[1]), Math.abs(c[2] + 0.5 - eye[2]), i]);
    far.sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2]);
    const lit = S.lit ? new Set(S.lit.map((c) => k3(c[0], c[1], c[2]))) : null;
    for (const [, , , i] of far) {
      const c = S.cells[i], on = !lit || lit.has(k3(c[0], c[1], c[2]));
      for (const d of faces[i]) {
        const n = DIRS[d];
        if (n[0] * (eye[0] - c[0] - 0.5 - n[0] * 0.5) + n[1] * (eye[1] - c[1] - 0.5 - n[1] * 0.5) + n[2] * (eye[2] - c[2] - 0.5 - n[2] * 0.5) <= 0) continue;
        const fill = S.tones ? rgb(mix(TONE[d >> 1], [255, 255, 255], shade[d] * 0.16)) : rgb(mix(K.P0, K.P1, shade[d]));
        out.push(poly(QUADS[d].flatMap((o) => pt(c[0] + o[0], c[1] + o[1], c[2] + o[2])), { fill, fa: on ? 1 : 0.16, stroke: lit && on ? K.ASK : K.EDGE, sa: on ? 0.9 : 0.22, lw: 1, i, d }));   // (i, d: which pellet's face, pointing which way: the tests read them)
      }
    }
  }
  // the near side of the field: a faint sheet over each side facing the eye, then its edges, bright
  if (S.field || S.kind === 'box') for (let k = 0; k < 6; k++) if (toward[k]) out.push(poly(boxFace(k), { fill: K.FIELD, fa: S.skin ? 0.16 : S.kind === 'box' ? 0.06 : 0.035 }));
  for (const e of edges) if (toward[e.f[0]] || toward[e.f[1]]) out.push(edgeLine(e, true));
  // a side's length, written beside the middle of one edge that runs that way, on the outside
  const MARK = { l: [[0, 0, w], [l, 0, w]], w: [[l, 0, 0], [l, 0, w]], h: [[0, 0, w], [0, h, w]] };
  for (const m of S.marks || []) {
    const [a, b] = MARK[m.axis], p = pt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), dx = p[0] - W / 2, dy = p[1] - cam.mid, n = Math.hypot(dx, dy) || 1, ask = m.text === '?';
    out.push(words(p[0] + dx / n * 20, p[1] + dy / n * 15 + 4.5, m.text, { fill: ask ? K.ASK : K.INK, weight: ask ? 800 : 700, size: ask ? 15 : 12.5, plate: true }));
  }
  if (S.note) out.push(words(W / 2, H - (legend.length ? 30 : 9), S.note, { fill: K.INK, weight: 700, size: 13 }));
  // (the help's key: a dot of each colour and what it is)
  legend.forEach((g, i) => { const x = W * (i + 0.5) / legend.length; out.push(poly([x - 46, H - 16, x - 36, H - 16, x - 36, H - 6, x - 46, H - 6], { fill: g.fill, stroke: K.INK, sa: 0.5, lw: 0.8 })); out.push(words(x - 30, H - 6.5, g.text, { anchor: 'start', size: 11.5, fill: K.INK })); });
  return out;
}

// what a shape is, in words, for a screen reader
function wordsOf(S) {
  if (S.kind === 'flat') return S.pellets ? `A flat shape of ${S.cells.length} fuel pellets on a grid` : 'A flat containment field with its sides marked';
  if (S.kind === 'box') return 'A containment field: a box with its sides marked';
  return `${S.kind === 'block' ? 'A block' : 'A cluster'} of fuel pellets${S.field ? ' in its containment field' : ''}, turning`;
}
export const listOf = (S, yaw = (S.view && S.view.yaw) ?? START.yaw, pitch = (S.view && S.view.pitch) ?? START.pitch, size = {}) => (is3d(S) ? solidList(S, yaw, pitch, size) : flatList(S, size));
// the shape as a still picture
export function shapeSvg(S, { yaw, pitch, h = VIEW.h } = {}) { return toSvg(listOf(S, yaw, pitch, { h }), VIEW.w, h, wordsOf(S)); }

// WHICH PELLETS SHOW A FACE from one side: a face that points toward the eye shows if, from its middle or from a little
// in from one of its corners, nothing stands between it and the eye. -> a Set of places in shape.cells
export function seenFrom(S, yaw = START.yaw, pitch = START.pitch) {
  const { eye, r } = camera(S, yaw, pitch, VIEW.w, VIEW.h), set = new Set(S.cells.map((c) => k3(c[0], c[1], c[2]))), seen = new Set();
  const full = (x, y, z) => set.has(k3(Math.floor(x), Math.floor(y), Math.floor(z)));
  for (const f of outsideFaces(S.cells)) {
    if (seen.has(f.i)) continue;
    const n = DIRS[f.d], q = QUADS[f.d].map((o) => [f.c[0] + o[0], f.c[1] + o[1], f.c[2] + o[2]]), m = [0, 1, 2].map((a) => (q[0][a] + q[1][a] + q[2][a] + q[3][a]) / 4);
    if (n[0] * (eye[0] - m[0]) + n[1] * (eye[1] - m[1]) + n[2] * (eye[2] - m[2]) <= 0) continue;
    for (const s of [m, ...q.map((p) => [0, 1, 2].map((a) => m[a] + (p[a] - m[a]) * 0.7))]) {
      const from = [0, 1, 2].map((a) => s[a] + n[a] * 0.01), d = [0, 1, 2].map((a) => eye[a] - from[a]), len = Math.hypot(...d);
      let hit = false;
      for (let t = 0.04; t < 2 * r + 1 && !hit; t += 0.04) hit = full(from[0] + d[0] / len * t, from[1] + d[1] / len * t, from[2] + d[2] / len * t);
      if (!hit) { seen.add(f.i); break; }
    }
  }
  return seen;
}

// ── two of the help's pictures ────────────────────────────────────────────────────────────────────────────────────
// A CLUSTER (or a block) TAKEN APART, one layer at a time, each seen from above: the bottom layer on the left. box: the
// places of the field's box with no pellet in them are drawn too, dotted. names: the words under each layer.
export function plansSvg({ cells, l, w, h, box = false, names = null, caption = '' }) {
  const W = VIEW.w, out = [], gap = 22, u = Math.min(30, (W - 24 - gap * (h - 1)) / (h * l), 96 / w), wide = h * l * u + gap * (h - 1), x0 = (W - wide) / 2, top = 12, tall = top + w * u + 22 + (caption ? 24 : 4);
  const set = new Set(cells.map((c) => k3(c[0], c[1], c[2]))), i = u * 0.09;
  const said = names || (h === 1 ? ['the one layer'] : h === 2 ? ['bottom layer', 'top layer'] : ['bottom layer', ...Array(h - 2).fill('next layer'), 'top layer']);
  for (let y = 0; y < h; y++) {
    const ox = x0 + y * (l * u + gap);
    for (let z = 0; z < w; z++) for (let x = 0; x < l; x++) {
      const px = ox + x * u, py = top + z * u, P = [px + i, py + i, px + u - i, py + i, px + u - i, py + u - i, px + i, py + u - i];
      if (set.has(k3(x, y, z))) out.push(poly(P, { fill: rgb(mix(K.P0, K.P1, 0.62)), stroke: K.EDGE, sa: 0.95, lw: 1.1 }));
      else if (box) out.push(poly(P, { stroke: K.SOFT, sa: 0.7, lw: 1, dash: [2.5, 2.5] }));
    }
    if (box) out.push(poly([ox, top, ox + l * u, top, ox + l * u, top + w * u, ox, top + w * u], { stroke: K.FIELD, lw: 1.6 }));
    out.push(words(ox + l * u / 2, top + w * u + 15, said[y] || '', { size: 11.5, fill: K.SOFT }));
  }
  if (caption) out.push(words(W / 2, tall - 8, caption, { fill: K.ASK, weight: 800, size: 13.5 }));
  return toSvg(out, W, tall, 'The shape taken apart, one layer at a time, each seen from above');
}
// A BOX'S SIX FACES IN THEIR THREE PAIRS: one face of each pair drawn to size, its two sides written on it, "twice"
export function pairsSvg({ l, w, h, caption = '' }) {
  // (each pair has a third of the width, so the words under one never run into the next)
  const W = VIEW.w, out = [], slot = W / 3, pairs = [[l, w, 'top and bottom', K.WIDE], [l, h, 'front and back', K.LONG], [w, h, 'the two ends', K.HIGH]];
  const u = Math.min(22, (slot - 20) / Math.max(l, w), 84 / Math.max(w, h)), tallest = Math.max(w, h) * u, top = 14, tall = top + tallest + 40 + (caption ? 22 : 0);
  pairs.forEach(([a, b, name, col], i) => {
    const mid = slot * (i + 0.5), x = mid - a * u / 2, y = top + (tallest - b * u) / 2;
    out.push(poly([x, y, x + a * u, y, x + a * u, y + b * u, x, y + b * u], { fill: col, fa: 0.16, stroke: col, lw: 1.8 }));
    out.push(words(mid, y + b * u / 2 + 4.5, `${a} × ${b}`, { weight: 800, size: 13, plate: true }));
    out.push(words(mid, top + tallest + 16, name, { size: 11.5, fill: K.SOFT }));
    out.push(words(mid, top + tallest + 31, 'twice', { size: 11.5, fill: K.INK, weight: 700 }));
  });
  if (caption) out.push(words(W / 2, tall - 8, caption, { fill: K.ASK, weight: 800, size: 13.5 }));
  return toSvg(out, W, tall, 'The three pairs of faces of a box');
}

// ── on the page ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE DISPLAY'S LOOK on a card of the job panel (the panel's own look is src/jobs/jobs.css). The display is as wide as
// the card and AS HIGH AS THE SCREEN LEAVES ROOM FOR, so that the four answers, two lines of why and Help are in view
// under it without scrolling. On a wide screen under 860 px high the panel is set a little closer and the rest of it
// needs about 546 px of the screen's height; under 780 px the card's own top line is left off too (the panel's top
// says what job it is) and the rest needs about 515 px. On a phone the rest needs about 547 px, and this job's panel
// may take more of the screen than the other jobs' do (88 hundredths of its height). Whatever its height, a shape
// is drawn to fit it and its words stay the same size. A finger on a shape in 3D turns it and nothing else.
const CSS = `
.pnj[data-job="engineer"] .pnj-pic.is-lead { padding: 3px; margin: 2px 0 8px; }
.pnj[data-job="engineer"] .pnj-pic svg { max-height: none; }
.pne-view { height: 258px; }
.pne-still, .pne-canvas { display: block; width: 100%; height: 100%; }
.pnj .pne-still svg { display: block; width: 100%; height: 100%; max-height: none; }
.pne-canvas { touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.pne-canvas.is-held { cursor: grabbing; }
@media (min-width: 641px) and (max-height: 860px) {
  .pne-view { height: clamp(150px, calc(100vh - 546px), 258px); }
  .pnj[data-job="engineer"] .pnj-panel { gap: 8px; padding: 10px 14px 12px; }
  .pnj[data-job="engineer"] .pnj-card { padding: 8px 12px 10px; }
  .pnj[data-job="engineer"] .pnj-cardtop { padding-bottom: 5px; margin-bottom: 5px; }
  .pnj[data-job="engineer"] .pnj-story { margin-bottom: 5px; }
  .pnj[data-job="engineer"] .pnj-pic.is-lead { margin: 2px 0 5px; }
  .pnj[data-job="engineer"] .pnj-coin { min-height: 54px; }
}
@media (min-width: 641px) and (max-height: 780px) {
  .pnj[data-job="engineer"] .pnj-cardtop { display: none; }
  .pne-view { height: clamp(150px, calc(100vh - 515px), 258px); }
}
@media (max-width: 640px), (max-height: 480px) and (max-width: 900px) {
  .pnj[data-job="engineer"] .pnj-panel { max-height: 88vh; }
  .pnj[data-job="engineer"] .pnj-story { margin-bottom: 6px; }
  .pne-view { height: clamp(150px, calc(88vh - 547px), 215px); }
}`;
function ensureCss() {
  if (document.getElementById('pne-css')) return;
  const st = document.createElement('style'); st.id = 'pne-css'; st.textContent = CSS; document.head.appendChild(st);
}
// THE SHAPE SHOWN IN `host` (the card's picture box). A flat shape: its still picture. A shape in 3D: a canvas that
// turns slowly by itself and is dragged round. Either is drawn again when its box changes size, and stops by itself
// once it is off the page.
export function mountShape(host, S, { spin = true } = {}) {
  ensureCss();
  host.classList.add('pne-view');
  const flat = !is3d(S), el = document.createElement(flat ? 'div' : 'canvas');
  el.className = flat ? 'pne-still' : 'pne-canvas';
  if (!flat) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', `${wordsOf(S)}. Drag to turn it.`); }
  host.innerHTML = ''; host.appendChild(el);
  // the drawing's own height, from the room the page gives it (its width is always VIEW.w)
  const tall = () => { const w = el.clientWidth, h = el.clientHeight; return w && h ? Math.max(VIEW.least, Math.min(VIEW.most, VIEW.w * h / w)) : VIEW.h; };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => size()) : null;
  let H = VIEW.h, stopped = false, size = () => {};
  if (flat) {
    size = () => { if (!el.isConnected) { if (ro) ro.disconnect(); return; } const h = tall(); if (h === H && el.firstChild) return; H = h; el.innerHTML = shapeSvg(S, { h: H }); };
    size(); if (ro) ro.observe(el);
    return { el, flat: true, state: () => ({ flat: true, tall: H, box: [el.clientWidth, el.clientHeight] }), set() {}, hold() {}, stop() { if (ro) ro.disconnect(); } };
  }
  const cv = el, g = cv.getContext('2d');
  let yaw = (S.view && S.view.yaw) ?? START.yaw, pitch = (S.view && S.view.pitch) ?? START.pitch;
  let held = false, still = false, rest = 0, last = 0, raf = 0, dirty = true, px = 0, py = 0, frames = 0, cost = 0, wPx = 0;
  size = () => {
    const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(w * dpr), Hpx = Math.round(h * dpr);
    if (cv.width !== W || cv.height !== Hpx) { cv.width = W; cv.height = Hpx; }
    wPx = W; H = tall(); dirty = true;
  };
  function draw() {
    if (!wPx) size(); if (!wPx) return;
    const t0 = performance.now(), k = wPx / VIEW.w;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(k, 0, 0, k, 0, Math.max(0, (cv.height - H * k) / 2));   // (a box taller than a shape is ever drawn: the shape in its middle)
    paint(g, solidList(S, yaw, pitch, { h: H }));
    dirty = false; frames++; cost += (performance.now() - t0 - cost) * (frames < 20 ? 1 / frames : 0.05);
  }
  function tick(now) {
    if (stopped) return;
    if (!cv.isConnected) { stop(); return; }           // (the card has gone: no more frames)
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (spin && !held && !still) { if (rest > 0) rest -= dt; else { yaw += TURN.spin * dt; dirty = true; } }
    if (dirty && !document.hidden) draw();
  }
  const down = (e) => { held = true; px = e.clientX; py = e.clientY; cv.classList.add('is-held'); try { cv.setPointerCapture(e.pointerId); } catch (er) { /* a rig's made-up pointer */ } e.preventDefault(); };
  const move = (e) => { if (!held) return; yaw += (e.clientX - px) * TURN.drag; pitch = Math.max(-TURN.most, Math.min(TURN.most, pitch + (e.clientY - py) * TURN.drag)); px = e.clientX; py = e.clientY; dirty = true; e.preventDefault(); };
  const up = () => { if (!held) return; held = false; rest = TURN.rest; cv.classList.remove('is-held'); };
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  // (a finger on the display turns it and nothing else: the page under it stays where it is)
  cv.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false }); cv.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  if (ro) ro.observe(cv);
  function stop() { stopped = true; cancelAnimationFrame(raf); if (ro) ro.disconnect(); }
  size(); draw(); raf = requestAnimationFrame(tick);
  return { el: cv, flat: false, stop, draw,
    state: () => ({ flat: false, yaw, pitch, held, still, frames, ms: cost, tall: H, faces: outsideFaces(S.cells).length, pellets: S.pellets ? S.cells.length : 0, px: [cv.width, cv.height], box: [cv.clientWidth, cv.clientHeight] }),
    set(y, p = pitch) { yaw = y; pitch = Math.max(-TURN.most, Math.min(TURN.most, p)); dirty = true; draw(); },
    hold(on = true) { still = !!on; } };             // (a rig's: no turning by itself, for a picture)
}

// THE JOB PANEL'S `live` FOR THIS JOB (src/jobs/panel.js): the card's top, and the display put on each new card in place
// of its still picture. view(): the display now on the card.
export function engineerLink() {
  let view = null;
  return {
    head: () => '<header class="pnj-cardtop is-jump"><span class="pnj-icon is-jump" aria-hidden="true"></span><b>Core display</b><small>Fuel pellets</small></header>',
    play(o, ui) {
      if (view) view.stop(); view = null;
      const box = ui.card.querySelector('.pnj-pic.is-lead'), S = o.facts && o.facts.shape;
      if (box && S) view = mountShape(box, S);
    },
    view: () => view,
  };
}
