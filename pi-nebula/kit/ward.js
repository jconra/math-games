// THE WARD: a hospital ward's beds and what stands round them, in the station's look (pale chunky panels with their
// corners cut, dark seams, teal for medical, small coloured lights). The game's maker (2026-11-17), after looking at
// real wards and with a picture of the bed he had in mind (a pale padded bed under a wall panel with a screen and a
// light strip): "Maybe it would be better to just have curtains in the hospital ward. Most them seem to have curtains
// that hang down almost to the floor", "It would be cool if the beds had thicker sides on them too", "It might be better
// if there were little tables on either side and the flowers, bear, and cards where on the tables ... It just seems kind
// of empty. I feel like there would be more medical machinery. Maybe some of those stands with wheels that you put an
// IV bag on. Or one of the machines that they roll around and measure patients vitals could be on one side and a table
// on the other."
//
// Each thing is a piece of its own, placed by the room file and told apart by its variant's name, so a bay is dressed
// (and dressed again) by changing lines of the room file:
//   wardBed(p, o, pulse)  the bed (kit/shipparts/cabin/medical.js medBed draws it for its 'ward ...' variants; the
//                 ship's own beds are untouched): thick padded side rails (one by the head, a longer one beside it with
//                 a strip of small coloured buttons on its top), a thick foot board with two hand holds, a sunk panel
//                 with the pulse line and the bed's number, a head board, wheels; a mattress, a pillow, a blanket with
//                 a darker band across it. o.ward: its number; o.down: -1 or 1, that side's long rail folded down (as
//                 real ones fold, for whoever gets on from that side); o.len, o.w, o.gap, o.top as medBed's
//   bedhead     the wall panel behind a bed's head ('1', '2' ...: the bed's number): a plate with the number, a screen
//               of vital signs (two traces, three numbers), a white light strip under them that lights the pillow (the
//               bed's own light), rows of small sockets, a few of them coloured. Hangs on a wall's face. The light is
//               set bed by bed, as whoever is in the bed has it: '2' (dim), '2 bright', '2 off' (kit/ward-names.js)
//   curtain     a ward curtain on a slim track hung from the ceiling, the cloth hanging from it to 30 cm off the floor
//               in soft folds. '<where> <how> <length>': where 'side' (from a wall out along a bed's side: its first end
//               on the wall) or 'foot' (free at both ends, across the bays' feet); how 'drawn' (along the whole track),
//               'half' (drawn half way from its first end), 'back' (pulled back and gathered at its first end), 'end'
//               (gathered at its far end) or 'bare' (the track alone); length in metres. Along x from 0. (A gathered
//               curtain reaches down to 30 cm off the floor: a person cannot walk through it. The ward's foot track is
//               bare: a bunch of cloth anywhere along it stood in the way in beside a bed.)
//   bedtable    a bedside table on small wheels (a top, a drawer, an open shelf under it), about as high as the bed,
//               and on it the things a recovering patient is given: the variant names them ('flowers card',
//               'bear books', 'flowers2 card2 cup', 'bare' ...: THINGS below). Its back on z = 0.
//   ivstand     a drip stand on five wheeled legs: a pole, hooks, a bag and its line ('one bag'; 'two bags' and a
//               pump clamped to the pole)
//   vitals      the machine a nurse rolls up to take a patient's vital signs ('pole'): a screen on a wheeled pole
//               (numbers and one small trace), a handle, a basket with the cuff in it
//   medcart     a low cart of drawers on wheels ('drawers'), a tray of things on its top
//   medstool    a round stool on five wheeled legs ('wheeled')
import * as THREE from 'three';
import { put, cylinder } from './geo.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { shape, solid, plate, add } from './bevel.js';
import { segText } from './shipparts/cabin/segtext.js';
import { lines } from './shipparts/cabin/medbay.js';
import { FLAT } from './shipparts/cabin/bits.js';
import { lean } from './shipparts/cabin/galley.js';
import { SHEET } from './shipparts/cabin/ship.js';
import { CURTAIN_HOW, curtainOf, clothSpan, tableThings, tableOk, bedHeadOf, BED_LIGHT } from './ward-names.js';

const PI = Math.PI;
// the looks: a bed's pale padded plastic, its blanket and the darker band across it, a pillow; the cloth of a curtain
// and its hems; a table's top; clear plastic, a bag's label; the small coloured buttons and sockets
const PAD = { c: '#c3c5c3', r: 0.5, m: 0, w: 0.35 }, HOLE = { c: '#33363b', r: 0.6, m: 0.1, w: 0.3 }, PILLOW = { c: '#d3d6d8', r: 0.92, m: 0, w: 0.15 };
// (a hand hold sunk in a pale panel: a shade of blue-grey, not black: black patches on white read as stickers, or dice)
const GRIP = { c: '#7b838c', r: 0.6, m: 0, w: 0.3 }, DARKSCREEN = { c: '#070a12', r: 0.14, m: 0.2, w: 0.02 };
const BLANKET = { c: '#9aa9b6', r: 0.94, m: 0, w: 0.2 }, BANDED = { c: '#586574', r: 0.94, m: 0, w: 0.2 };
const CLOTH = { c: '#8ab9b4', r: 0.94, m: 0, w: 0.2 }, TOP = { c: '#c9cac6', r: 0.35, m: 0.05, w: 0.5 }, MEDTEAL = { c: '#3f9f98', r: 0.5, m: 0, w: 0.3 };
const CLEAR = { c: '#cfdfe6', r: 0.15, m: 0, w: 0.1 }, FLUID = { c: '#a9cbdc', r: 0.2, m: 0, w: 0.1 }, LABEL = { c: '#2f6fb3', r: 0.45, m: 0, w: 0.3 };
const DOT = { orange: { c: '#e0802a', r: 0.4 }, blue: { c: '#3d7fd0', r: 0.4 }, white: { c: '#e4e6e4', r: 0.4 }, red: { c: '#c8402f', r: 0.4 }, yellow: { c: '#d9b23a', r: 0.4 }, green: { c: '#3f9a58', r: 0.4 } };
const TRACE = { green: [0.45, 3.4, 1.1], cyan: [0.35, 2.4, 3.6], white: [3.0, 3.0, 3.0] };
// (a plain box with nothing rounded: 12 triangles, or fewer with faces left out)
const flat = (skip) => ({ r: 0, cell: 9, loops: [], skip });
const mergeV = (g) => { g.deleteAttribute('uv'); const m = mergeVertices(g, 1e-5); m.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(m.attributes.position.count * 2), 2)); return m; };
// (a small ball, squashed or stretched, turned: an icosphere of the fewest faces that still read as round)
function ball(p, look, r, at, scale = [1, 1, 1], rot = [0, 0, 0], detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail); put(g, at, rot, scale); return p.add('solid', g.index ? g : mergeV(g), look);
}
// a rod of any slant from a to b ([x, y, z])
function rod(p, look, r, a, b, seg = 6) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), g = cylinder(r, d.length(), [0, 0, 0], seg);
  g.applyMatrix4(new THREE.Matrix4().compose(A.add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1)));
  return p.add('solid', g, look);
}
// A CHUNKY PANEL STANDING ALONG z (a bed's side rail): an eight-sided outline drawn with its width along z and its
// height up, `thick` through (along x) about x, leaning out from its foot by `tilt` (radians; +x leans toward +x);
// `holes`: sunk patches on both its faces (shapes in the same drawing), which read as its hand holds; `more(q)` draws
// anything else onto it in its own drawing (x along it, y up, z through it), so it leans with it
function sidePanel(p, look, s, thick, x, holes = [], tilt = 0, more = null) {
  const q = new (p.constructor)(), g = solid(s, thick, { edge: Math.min(0.02, thick * 0.3) });
  put(g, [0, 0, -thick / 2]); q.add('solid', g, look);
  for (const h of holes) {
    q.add('solid', plate(h, thick / 2 + 0.0012), GRIP);
    const b = plate({ ...h, x: -(h.x || 0) }, thick / 2 + 0.0012); put(b, [0, 0, 0], [0, PI, 0]); q.add('solid', b, GRIP);
  }
  if (more) more(q);
  // (the drawing's x runs along z, its depth along x; then the lean, about the line along its foot)
  const foot = (s.y || 0) - s.h / 2, lean_ = new THREE.Matrix4().makeTranslation(x, foot, 0).multiply(new THREE.Matrix4().makeRotationZ(-tilt)).multiply(new THREE.Matrix4().makeTranslation(-x, -foot, 0));
  for (const part of q.parts) { put(part.geo, [x, 0, 0], [0, -PI / 2, 0]); part.geo.applyMatrix4(lean_); p.parts.push(part); }
}

// ── the bed ────────────────────────────────────────────────────────────────────────────────────────────────────────
// (a wall fitting, as medBed: z = 0 on the wall line, the bed running out along +z from o.gap, x across, standing on
// y = 0; 'left' is -x, the left of someone at its foot looking at its head)
export function wardBed(p, o = {}, pulse = null) {
  p = lean(p);
  const len = o.len ?? 2.1, w = o.w ?? 0.9, gap = o.gap ?? 0.15, top = o.top ?? 0.68, down = o.down ?? 0, num = o.ward === true ? 1 : (o.ward || 1);
  const hw = w / 2, z0 = gap, z1 = gap + len, zm = (z0 + z1) / 2, mt = 0.14, deck = top - mt;
  // the wheels (dark, each under a pale housing at a corner of the frame, so they show against a dark floor), a grey
  // frame on them, the pale lift between it and the deck
  for (const sx of [-1, 1]) for (const z of [z0 + 0.14, z1 - 0.14]) {
    const x = sx * (hw - 0.05);
    ball(p, 'rubber', 0.07, [x, 0.07, z], [0.6, 1, 1], [0, 0, 0], 1);
    p.slab(PAD, x - 0.05, x + 0.05, 0.085, 0.22, z - 0.075, z + 0.075, { r: 0.02, seg: 1, cell: 9, loops: [], skip: ['-y'] });
  }
  p.slab('grey', -hw + 0.03, hw - 0.03, 0.15, 0.22, z0 + 0.06, z1 - 0.06, flat());
  add(p, 'white2', solid(shape(0.44, deck - 0.07 - 0.22, 0.03, 0, (deck - 0.07 + 0.22) / 2), 1.1, { edge: 0.012 }), [0, 0, zm - 0.55]);
  p.slab('band', -0.225, 0.225, 0.29, 0.34, zm - 0.555, zm + 0.555, flat(['-y', '+y']));
  // the deck's frame (its corners cut), the mattress, the pillow, the blanket turned down under the pillow's end, a
  // darker band across it
  add(p, PAD, solid(shape(w + 0.04, len, 0.07, 0, -zm), 0.07, { edge: 0.014 }), [0, deck - 0.07, 0], FLAT);
  p.slab(SHEET, -hw + 0.04, hw - 0.04, deck, top, z0 + 0.06, z1 - 0.07, { r: 0.045, seg: 1, cell: 1.2, loops: [] });
  p.box(PILLOW, [0.56, 0.11, 0.36], [0, top + 0.045, z0 + 0.3], [0.06, 0, 0], { r: 0.05, seg: 1, cell: 9, loops: [] });
  p.slab(BLANKET, -hw + 0.022, hw - 0.022, deck + 0.03, top + 0.022, z0 + 0.72, z1 - 0.06, { r: 0.022, seg: 1, cell: 1.2, loops: [], skip: ['-y'] });
  p.slab(SHEET, -hw + 0.018, hw - 0.018, top - 0.01, top + 0.034, z0 + 0.64, z0 + 0.76, { r: 0.02, seg: 1, cell: 9, loops: [], skip: ['-y'] });
  p.slab(BANDED, -hw + 0.0195, hw - 0.0195, deck + 0.03, top + 0.0245, z0 + 1.38, z0 + 1.48, { r: 0.0245, seg: 1, cell: 9, loops: [], skip: ['-y'] });
  // the side rails, thick and leaning out a little: by the head a tall one, its top sloping down toward the foot;
  // beside it the longer one, a dark strip of small coloured buttons along its top; each with a hand hold sunk in it.
  // (o.down: that side's longer rail folded down beside the deck)
  const t = 0.088, xr = hw + 0.034, TILT = 0.1;
  for (const sx of [-1, 1]) {
    sidePanel(p, PAD, shape(0.6, 0.48, [0.07, 0.07, 0.18, 0.09], z0 + 0.4, deck + 0.2), t, sx * xr, [shape(0.26, 0.055, 0.022, z0 + 0.3, deck + 0.3)], sx * TILT);
    const dy = down === sx ? -0.34 : 0, zc = z0 + 1.16, ry = deck + 0.36 + dy;
    sidePanel(p, PAD, shape(0.8, 0.4, [0.07, 0.07, 0.11, 0.11], zc, ry - 0.2), t, sx * xr, [shape(0.44, 0.055, 0.022, zc, ry - 0.12)], sx * TILT, (q) => {
      q.slab(HOLE, zc - 0.27, zc + 0.27, ry, ry + 0.0015, -0.019, 0.019, flat(['-y', '-x', '+x', '-z', '+z']));
      ['orange', 'yellow', 'blue', 'blue', 'white', 'white', 'red'].forEach((c, i) => q.slab(DOT[c], zc - 0.235 + i * 0.07, zc - 0.185 + i * 0.07, ry + 0.0015, ry + 0.007, -0.014, 0.014, flat(['-y'])));
    });
  }
  // the head board, and the thick foot board: its top corners cut, a hand hold sunk in each, a sunk panel in its
  // outer face with the pulse line (the medical mark, kept on the beds) and the bed's tag over it
  add(p, PAD, solid(shape(w + 0.06, 0.6, [0.04, 0.04, 0.1, 0.1], 0, deck + 0.14), 0.06, { edge: 0.016 }), [0, 0, z0 - 0.05]);
  const fy = deck + 0.06, fz = z1 - 0.005, ft = 0.085, fw = w + 0.12;
  add(p, PAD, solid(shape(fw, 0.58, [0.08, 0.08, 0.13, 0.13], 0, fy), ft, { edge: 0.022 }), [0, 0, fz]);
  for (const sx of [-1, 1]) for (const [z, ry] of [[fz + ft + 0.0012, 0], [fz - 0.0012, PI]]) add(p, GRIP, plate(shape(0.2, 0.065, 0.028, sx * (fw / 2 - 0.2) * (ry ? -1 : 1), fy + 0.2)), [0, 0, z], [0, ry, 0]);
  add(p, 'grey2', plate(shape(0.5, 0.2, 0.03, 0, fy - 0.07)), [0, 0, fz + ft + 0.0012]);
  if (pulse) pulse(p, -0.21, 0.21, fy - 0.07, fz + ft + 0.003, 0.055);
  // (W for ward and its number: the kit's bar lettering has no clear B or D, and BED read as 3E3 from the walkway)
  segText(p, 'W-' + num, { h: 0.055, t: 0.009, at: [0, fy + 0.09, fz + ft + 0.0015], look: HOLE });
  return p;
}

// ── the wall panel behind a bed's head ──────────────────────────────────────────────────────────────────────────────
// (hangs on a wall's face: z = 0 on the face, centred on x = 0, its heights from the floor)
const VITALS = { 1: ['72', '98', '16'], 2: ['64', '97', '14'], 3: ['81', '99', '18'], 4: ['68', '96', '15'] };
// (the strip itself: a bright one glows about twice as white as a dim one; one switched off is a pale grey lens)
const STRIP_BRIGHT = [6.4, 6.4, 6.3], STRIP_OFF = { c: '#7d8388', r: 0.25, m: 0, w: 0.1 };
export function bedHead(p, v) {
  p = lean(p);
  const { n, light } = bedHeadOf(v) || { n: 1, light: 'dim' }, W = 1.5, y0 = 0.94, y1 = 2.02, d = 0.1;   // (10 cm deep: it takes in a plain wall panel's middle upright, which stands 9 cm out)
  add(p, 'white2', solid(shape(W, y1 - y0, 0.07, 0, (y0 + y1) / 2), d, { edge: 0.012, back: false }), [0, 0, 0]);
  p.slab('dark', -W / 2 + 0.05, W / 2 - 0.05, 1.335, 1.343, d, d + 0.002, flat(['-z', '-y', '+y', '-x', '+x']));
  // the plate with the bed's tag
  add(p, 'white', solid(shape(0.6, 0.36, 0.035, -0.4, 1.76), 0.012, { edge: 0.005, back: false }), [0, 0, d]);
  segText(p, 'W-' + n, { h: 0.15, t: 0.022, at: [-0.4, 1.78, d + 0.0135], look: HOLE });
  p.slab(MEDTEAL, -0.63, -0.17, 1.645, 1.657, d + 0.012, d + 0.014, flat(['-z', '-y', '+y', '-x', '+x']));
  // the screen of vital signs: two traces across its left (the heart's, the breathing's), three numbers down its right
  const sx = 0.4, sy = 1.74, sw = 0.5, sh = 0.32;
  add(p, 'white', solid(shape(sw + 0.1, sh + 0.1, 0.04, sx, sy), 0.02, { edge: 0.007, back: false }), [0, 0, d]);
  add(p, 'black', solid(shape(sw + 0.024, sh + 0.024, 0.02, sx, sy), 0.008, { edge: 0.004, back: false }), [0, 0, d + 0.02]);
  add(p, DARKSCREEN, plate(shape(sw, sh, 0.012, sx, sy)), [0, 0, d + 0.0285]);
  const tz = d + 0.0305, tw = sw * 0.6, tx0 = -sw / 2 + 0.025, L = (pts, c) => lines(p, pts, 0.0045, c, tz, [sx, sy, 0]);
  const beat = []; for (let b = 0; b < 3; b++) { const bx = tx0 + b * tw / 3; beat.push([bx, 0], [bx + 0.028, 0], [bx + 0.036, 0.008], [bx + 0.044, 0], [bx + 0.052, -0.01], [bx + 0.06, 0.042], [bx + 0.068, -0.016], [bx + 0.076, 0], [bx + 0.09, 0.01], [bx + 0.098, 0]); }
  beat.push([tx0 + tw, 0]); L(beat.map(([a, b]) => [a, b + sh * 0.2]), TRACE.green);
  const air = []; for (let k = 0; k <= 16; k++) { const u = k / 16; air.push([tx0 + u * tw, Math.sin(u * PI * 5 + n) * 0.02 - sh * 0.2]); } L(air, TRACE.cyan);
  const [hr, ox, br] = VITALS[n] || VITALS[1], nx = sx + sw / 2 - 0.075;
  segText(p, hr, { h: 0.058, at: [nx, sy + sh * 0.27, tz], look: TRACE.green, mat: 'glow', t: 0.009 });
  segText(p, ox, { h: 0.058, at: [nx, sy, tz], look: TRACE.cyan, mat: 'glow', t: 0.009 });
  segText(p, br, { h: 0.058, at: [nx, sy - sh * 0.27, tz], look: TRACE.white, mat: 'glow', t: 0.009 });
  // the light strip under them, in a dark slot: the bed's own light, on the pillow, set as whoever is in the bed has
  // it (dim, bright or off)
  p.slab('dark', -0.47, 0.47, 1.375, 1.455, d, d + 0.008, flat(['-z']));
  if (light === 'off') p.slab(STRIP_OFF, -0.44, 0.44, 1.393, 1.437, d + 0.008, d + 0.012, { r: 0.003, seg: 1, cell: 9 });
  else p.glowSlab(light === 'bright' ? STRIP_BRIGHT : 'strip', -0.44, 0.44, 1.393, 1.437, d + 0.008, d + 0.012);
  // (a pool of light on the pillow, the bed and the floor beside it: three lights along the strip, aimed down and out)
  if (BED_LIGHT[light] > 0) for (const x of [-0.3, 0, 0.3]) p.light([x, 1.4, d + 0.12], BED_LIGHT[light], [1, 0.97, 0.92], [0, -0.74, 0.67], 4.4);
  // two rows of small sockets, a few of them coloured (and a dark slot in each)
  const row = (y, xs, cols) => xs.forEach((x, i) => {
    p.slab(cols[i] ? DOT[cols[i]] : 'white', x - 0.033, x + 0.033, y - 0.048, y + 0.048, d, d + 0.01, flat(['-z']));
    p.slab(HOLE, x - 0.014, x + 0.014, y - 0.022, y + 0.022, d + 0.01, d + 0.0115, flat(['-z', '-y', '+y', '-x', '+x']));
  });
  row(1.26, [-0.62, -0.52, -0.42, 0.42, 0.52, 0.62], [null, null, 'red', null, 'yellow', null]);
  row(1.1, [-0.62, -0.52, -0.3, -0.2, 0.2, 0.3, 0.52, 0.62], ['red', null, null, null, null, 'yellow', 'green', 'green']);
  return p;
}

// ── a ward curtain ──────────────────────────────────────────────────────────────────────────────────────────────────
// The track hangs TRACK m up on slim rods from the ceiling (3 m), so the room's light passes over it into the bay (a
// real ward's curtain has a strip of open mesh at its top for that); the cloth hangs from just under it to HEM off the
// floor. A sheet of cloth is one wavy strip, both its faces: its folds a wave along the track, shallower at the top
// where it hangs from its runners and fuller toward the hem, no two folds quite alike; a stiff band along its top and a
// hem along its foot, a shade darker. Each fold's hollow is painted a little darker than its crest (the saved light is
// too coarse to see into a fold), which is what makes it read as cloth and not as a board.
export const CURTAIN = { track: 2.42, hem: 0.3, ceil: 3.0, top: 2.385 };
function clothSheet(p, x0, x1, { pitch = 0.17, deep = 0.045, seed = 1 } = {}) {
  const cols = Math.max(6, Math.ceil((x1 - x0) / pitch * 6)), T = CURTAIN.top, H = CURTAIN.hem, K = PI * 2 / pitch;
  // (the rows, top to hem: [height, how full the folds are there, the paint's shade]; a band's edge is two rows at one height)
  const rows = [[T, 0.5, 0.82], [T - 0.07, 0.55, 0.82], [T - 0.07, 0.55, 1], [(T + H) / 2 + 0.1, 0.85, 1], [H + 0.07, 1, 1], [H + 0.07, 1, 0.84], [H, 1, 0.84]];
  // (the folds: one wave whose depth swells and shrinks along the track, and a slower, shallower one under it, so no
  // two folds are quite alike; smooth all the way along)
  const s1 = seed * 1.7, s2 = seed * 2.9, s3 = seed * 4.3;
  const wave = (x) => { const m = 0.7 + 0.3 * Math.sin(x * 2.1 + s1); return [m * Math.sin(x * K + s2) + 0.45 * Math.sin(x * K / 2.63 + s3), m * Math.cos(x * K + s2) * K + 0.63 * Math.cos(x * 2.1 + s1) * Math.sin(x * K + s2) + 0.45 * Math.cos(x * K / 2.63 + s3) * K / 2.63]; };
  const pos = [], nrm = [], uv = [], shade = [], ix = [];
  for (const face of [1, -1]) {
    const base = pos.length / 3;
    rows.forEach(([y, full, tone], ri) => {
      for (let c = 0; c <= cols; c++) {
        // (a fold drifts a little sideways on its way down, each its own way, and the hem dips where a fold stands out:
        // a first fresh pair of eyes saw every fold "dead straight and even from rail to hem, like a pressed sheet")
        const x = x0 + (x1 - x0) * c / cols, down = (T - y) / (T - H), xs = x + 0.045 * Math.sin(x * 3.3 + s3) * down * down;
        const [w, dw] = wave(xs), slope = dw * deep * full, l = Math.hypot(1, slope), dip = ri === rows.length - 1 ? 0.014 * w : 0;
        pos.push(x, y - dip, w * deep * full); nrm.push(-slope / l * face, 0, face / l); uv.push(x, y);
        shade.push(tone * (0.87 + 0.13 * Math.max(-1, Math.min(1, w)) * face));
      }
    });
    for (let r = 0; r + 1 < rows.length; r++) {
      if (rows[r][0] === rows[r + 1][0]) continue;
      for (let c = 0; c < cols; c++) { const k = base + r * (cols + 1) + c, m = k + cols + 1; if (face > 0) ix.push(k, m, k + 1, k + 1, m, m + 1); else ix.push(k, k + 1, m, k + 1, m + 1, m); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  // (painted as cloth, then each vertex's shade laid over the paint)
  p.parts.push({ mat: 'solid', geo: paintShaded(g, CLOTH, shade) });
}
// (a geometry painted with a surface as a piece paints one, each vertex's colour then multiplied by its shade)
function paintShaded(g, look, shade) {
  const lin = new THREE.Color(look.c), n = g.attributes.position.count, col = new Float32Array(n * 3), rmw = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = lin.r * shade[i]; col[i * 3 + 1] = lin.g * shade[i]; col[i * 3 + 2] = lin.b * shade[i]; rmw[i * 3] = look.r ?? 0.5; rmw[i * 3 + 1] = look.m ?? 0; rmw[i * 3 + 2] = look.w ?? 0.5; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aRMW', new THREE.BufferAttribute(rmw, 3));
  return g;
}
export function curtain(p, v) {
  const { where, how, len: L } = curtainOf(v) || { where: 'side', how: 'drawn', len: 2.4 }, { track: Y, ceil } = CURTAIN, seed = L * 7 + CURTAIN_HOW.indexOf(how);
  // the track, the rods up to the ceiling (a side track's first end is on the wall: a bracket there, its first rod
  // clear of the wall's slant under the ceiling), a stop at each free end
  p.slab('rail', 0, L, Y, Y + 0.028, -0.014, 0.014, flat());
  const r0 = where === 'side' ? Math.min(0.75, L / 2) : 0.5, r1 = where === 'side' ? L - 0.07 : L - 0.5, gaps = Math.max(1, Math.ceil((r1 - r0) / 1.9));
  const rods = Array.from({ length: gaps + 1 }, (_, i) => r0 + (r1 - r0) * i / gaps);
  for (const x of rods) p.cyl('rail', 0.007, ceil - Y - 0.028, [x, (ceil + Y + 0.028) / 2, 0], null, 6);
  if (where === 'side') p.slab('black', 0, 0.022, Y - 0.03, Y + 0.058, -0.045, 0.045, flat(['-x']));
  // (a foot track's stops stand just in from its ends: where two tracks meet end to end, no two stops are in one place)
  for (const x of where === 'side' ? [L] : [0.016, L - 0.016]) p.slab('black', x - 0.012, x + 0.012, Y - 0.012, Y + 0.04, -0.022, 0.022, flat());
  // the cloth (where along the track it hangs: kit/ward-names.js clothSpan): drawn, in easy folds; half drawn, fuller;
  // gathered in a bunch, its folds tight and deep
  const span = clothSpan(v);
  // (its runners on the track, a small dark block every hand's width or so along the cloth)
  if (span) for (let n = Math.max(2, Math.round((span[1] - span[0]) / (how === 'drawn' ? 0.17 : 0.1))), i = 0; i < n; i++) { const x = span[0] + (span[1] - span[0]) * (i + 0.5) / n; p.slab('black', x - 0.011, x + 0.011, Y - 0.036, Y, -0.009, 0.009, flat(['+y'])); }
  if (span) clothSheet(p, span[0], span[1], how === 'drawn' ? { pitch: 0.17, deep: 0.045, seed } : how === 'half' ? { pitch: 0.12, deep: 0.062, seed } : { pitch: 0.085, deep: 0.075, seed });
}

// ── the things a recovering patient is given ────────────────────────────────────────────────────────────────────────
// (each drawn standing on the origin at its real size, a few flat colours, no print; a table stands them on its top)
const GW = {
  vase: { c: '#8fbfc4', r: 0.12, m: 0.05, w: 0.1 }, stem: { c: '#4f7a3a', r: 0.8, m: 0, w: 0.3 },
  petals: [[{ c: '#f2c14e', r: 0.7 }, { c: '#e88aa4', r: 0.7 }], [{ c: '#f4f1ea', r: 0.7 }, { c: '#d9534f', r: 0.7 }]], heart: { c: '#8a5a2b', r: 0.8 },
  bear: { c: '#a8784a', r: 0.95, m: 0, w: 0.2 }, muzzle: { c: '#dcc19a', r: 0.95, m: 0, w: 0.2 }, eye: { c: '#1d1712', r: 0.35 }, bow: { c: '#c8423b', r: 0.6 },
  card: [{ c: '#f3eee2', r: 0.7 }, { c: '#e9f0f6', r: 0.7 }], cardArt: [{ c: '#f0a43a', r: 0.6 }, { c: '#6aa9d8', r: 0.6 }],
  books: [{ c: '#2f5d8a', r: 0.65 }, { c: '#8a3b3b', r: 0.65 }, { c: '#3f6f4f', r: 0.65 }], pages: { c: '#ece4d0', r: 0.85, m: 0, w: 0.2 },
  cup: { c: '#e6e7e3', r: 0.4, m: 0, w: 0.2 }, water: { c: '#9fc7d8', r: 0.15, m: 0, w: 0.1 },
};
export const THINGS = {
  // flowers in a glass vase: stems fanned out of its mouth, each with a bloom, in two colours; two leaves
  flowers(p, k = 0) {
    p.lathe(GW.vase, [[0.001, 0], [0.034, 0], [0.04, 0.03], [0.036, 0.09], [0.024, 0.12], [0.03, 0.14], [0.026, 0.142], [0.02, 0.12], [0.001, 0.12]], 10);
    [[-0.035, 0.27, -0.02], [0.03, 0.29, 0.01], [-0.005, 0.31, 0.025], [0.045, 0.25, -0.025], [-0.05, 0.24, 0.02]].forEach(([dx, h, dz], i) => {
      rod(p, GW.stem, 0.003, [0, 0.11, 0], [dx, h, dz], 4);
      ball(p, GW.petals[k][i % 2], 0.024, [dx, h, dz], [1, 0.55, 1], [0.3 * dz / 0.03, 0, -0.3 * dx / 0.03], 0);
      ball(p, GW.heart, 0.009, [dx, h + 0.008, dz], [1, 0.6, 1], [0, 0, 0], 0);
    });
    for (const s of [-1, 1]) p.box(GW.stem, [0.06, 0.004, 0.025], [s * 0.035, 0.16, 0.01], [0, 0.4 * s, -0.5 * s], flat());
  },
  flowers2(p) { THINGS.flowers(p, 1); },
  // a teddy bear sitting, its legs out in front: body, head, ears, muzzle and nose, eyes, arms, a bow
  bear(p) {
    const B = GW.bear;
    ball(p, B, 0.05, [0, 0.055, 0], [1, 1.15, 0.9]); ball(p, B, 0.04, [0, 0.14, 0.006]);
    for (const s of [-1, 1]) { ball(p, B, 0.014, [s * 0.03, 0.172, 0], [1, 1, 0.6], [0, 0, 0], 0); ball(p, GW.muzzle, 0.008, [s * 0.03, 0.172, 0.006], [1, 1, 0.5], [0, 0, 0], 0); }
    ball(p, GW.muzzle, 0.018, [0, 0.128, 0.036], [1.1, 0.85, 0.9], [0, 0, 0], 0); ball(p, GW.eye, 0.006, [0, 0.136, 0.053], [1, 0.8, 1], [0, 0, 0], 0);
    for (const s of [-1, 1]) ball(p, GW.eye, 0.0055, [s * 0.016, 0.152, 0.036], [1, 1, 1], [0, 0, 0], 0);
    for (const s of [-1, 1]) ball(p, B, 0.018, [s * 0.05, 0.07, 0.02], [1, 1.9, 1], [0.5, 0, s * 0.35], 0);
    for (const s of [-1, 1]) { ball(p, B, 0.02, [s * 0.026, 0.02, 0.05], [1, 1, 2.0], [0, 0, 0], 0); ball(p, GW.muzzle, 0.014, [s * 0.026, 0.02, 0.088], [1, 1, 0.4], [0, 0, 0], 0); }
    for (const s of [-1, 1]) p.box(GW.bow, [0.026, 0.018, 0.01], [s * 0.013, 0.108, 0.032], [0, 0, s * 0.35], flat());
  },
  // a get-well card standing open, folded down its middle, a bright picture on its front
  card(p, k = 0) {
    for (const s of [-1, 1]) p.box(GW.card[k], [0.075, 0.11, 0.003], [s * 0.033, 0.055, 0.012], [0, s * 0.5, 0], flat());
    p.box(GW.cardArt[k], [0.04, 0.05, 0.002], [0.034, 0.06, 0.03], [0, 0.5, 0], flat());
  },
  card2(p) { THINGS.card(p, 1); },
  // a book lying flat, its cover and spine coloured, its pages pale at the other three edges; two, one on the other
  book(p, k = 0, lift = 0, turn = 0.25) {
    const q = new (p.constructor)();
    q.slab(GW.books[k], -0.07, 0.07, 0, 0.004, -0.05, 0.05, flat(['-y'])); q.slab(GW.books[k], -0.07, 0.07, 0.026, 0.03, -0.05, 0.05, flat());
    q.slab(GW.books[k], -0.07, -0.064, 0, 0.03, -0.05, 0.05, flat()); q.slab(GW.pages, -0.065, 0.066, 0.004, 0.026, -0.047, 0.047, flat(['-y', '+y']));
    for (const part of q.parts) { put(part.geo, [0, lift, 0], [0, turn, 0]); p.parts.push(part); }
  },
  books(p) { THINGS.book(p, 1, 0, -0.15); THINGS.book(p, 2, 0.031, 0.3); },
  // a cup of water
  cup(p) { p.lathe(GW.cup, [[0.001, 0], [0.026, 0], [0.032, 0.085], [0.028, 0.085], [0.023, 0.008], [0.001, 0.008]], 10); p.cyl(GW.water, 0.027, 0.004, [0, 0.07, 0], null, 10); },
};
// (a thing stood at a place, turned, and made bigger: the first shelves' things looked "too tiny" at their real sizes
// from where a player stands, so on a table they are half as big again)
function stand(p, name, at, turn = 0, scale = 1.5) {
  const f = THINGS[name]; if (!f) return;
  const q = new (p.constructor)(); f(q);
  for (const part of q.parts) { put(part.geo, at, [0, turn, 0], [scale, scale, scale]); p.parts.push(part); }
}

// ── the bedside table ───────────────────────────────────────────────────────────────────────────────────────────────
export const TABLE = { w: 0.5, d: 0.44, top: 0.76 };
export function bedTable(p, v) {
  p = lean(p);
  const { w, d, top } = TABLE, hw = w / 2 - 0.02, zf = d - 0.03;
  // four small wheels, the cabinet (its front: a drawer with a dark pull, a teal line under the top, an open shelf
  // with a folded towel on it, a door), the top with its two front corners cut
  for (const sx of [-1, 1]) for (const z of [0.07, d - 0.08]) ball(p, 'rubber', 0.03, [sx * (hw - 0.04), 0.03, z], [0.7, 1, 1], [0, 0, 0], 0);
  add(p, 'white', solid(shape(2 * hw, top - 0.03 - 0.06, 0.02, 0, (top - 0.03 + 0.06) / 2), zf - 0.02, { edge: 0.012 }), [0, 0, 0.02]);
  add(p, 'white2', solid(shape(2 * hw - 0.05, 0.15, 0.014, 0, top - 0.13), 0.012, { edge: 0.005, back: false }), [0, 0, zf]);
  p.slab(HOLE, -0.08, 0.08, top - 0.115, top - 0.097, zf + 0.012, zf + 0.024, flat(['-z']));
  p.slab(MEDTEAL, -hw + 0.025, hw - 0.025, top - 0.047, top - 0.038, zf, zf + 0.004, flat(['-z']));
  add(p, HOLE, plate(shape(2 * hw - 0.05, 0.15, 0.014, 0, 0.455)), [0, 0, zf + 0.0012]);
  p.slab(PILLOW, -hw + 0.07, hw - 0.13, 0.385, 0.44, zf - 0.006, zf + 0.006, flat(['-z', '-y']));
  add(p, 'white2', solid(shape(2 * hw - 0.05, 0.26, 0.014, 0, 0.225), 0.012, { edge: 0.005, back: false }), [0, 0, zf]);
  p.slab(HOLE, hw - 0.1, hw - 0.084, 0.2, 0.3, zf + 0.012, zf + 0.022, flat(['-z']));
  add(p, TOP, solid(shape(w, d, [0.07, 0.07, 0, 0], 0, -d / 2), 0.03, { edge: 0.008 }), [0, top - 0.03, 0], FLAT);
  // the things on its top, left to right (the variant's names)
  const names = tableThings(v), spots = names.length === 1 ? [[0, 0.22]] : names.length === 2 ? [[-0.11, 0.19], [0.12, 0.26]] : [[-0.14, 0.17], [0.04, 0.28], [0.16, 0.14]];
  names.slice(0, 3).forEach((name, i) => stand(p, name, [spots[i][0], top, spots[i][1]], [0.25, -0.35, 0.1][i]));
}

// ── on five wheeled legs ────────────────────────────────────────────────────────────────────────────────────────────
// (the star of legs every wheeled stand and stool has: `r` out to its ball castors, a hub in the middle)
function rollBase(p, r = 0.27, look = 'rail') {
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * PI * 2 + 0.31, c = Math.cos(a), s = Math.sin(a);
    p.box(look, [r, 0.022, 0.04], [c * r / 2, 0.068, s * r / 2], [0, -a, 0], flat(['-y']));
    ball(p, 'rubber', 0.03, [c * (r - 0.012), 0.03, s * (r - 0.012)], [1, 1, 1], [0, 0, 0], 0);
  }
  p.cyl('black', 0.045, 0.06, [0, 0.085, 0], null, 10);
}
// a bag of fluid hung at (x, z), its top at y: the bag, its label, the drip chamber under it, the line down to `to`
function ivBag(p, x, z, y, to) {
  p.slab('rail', x - 0.003, x + 0.003, y, y + 0.045, z - 0.003, z + 0.003, flat());
  p.slab(CLEAR, x - 0.055, x + 0.055, y - 0.2, y, z - 0.02, z + 0.02, { r: 0.016, seg: 1, cell: 9, loops: [] });
  p.slab(FLUID, x - 0.047, x + 0.047, y - 0.192, y - 0.07, z - 0.022, z + 0.022, flat(['-y']));
  p.slab(LABEL, x - 0.034, x + 0.034, y - 0.12, y - 0.085, z + 0.0225, z + 0.024, flat(['-z', '-y', '+y', '-x', '+x']));
  p.cyl(CLEAR, 0.011, 0.045, [x, y - 0.235, z], null, 6);
  rod(p, CLEAR, 0.003, [x, y - 0.255, z], [x * 0.5, y - 0.62, z * 0.5], 4); rod(p, CLEAR, 0.003, [x * 0.5, y - 0.62, z * 0.5], to, 4);
}
export function ivStand(p, v) {
  p = lean(p);
  const two = v === 'two bags', H = 2.0;
  rollBase(p, 0.27);
  // the pole in two tubes (the upper slides in the lower: a dark collar where they meet), a cross of four hooks
  p.cyl('rail', 0.016, 1.05, [0, 0.115 + 0.525, 0], null, 8); p.cyl('black', 0.024, 0.06, [0, 1.17, 0], null, 8); p.cyl('chrome', 0.011, H - 1.18, [0, (H + 1.18) / 2, 0], null, 6);
  for (const ry of [0, PI / 2]) p.box('chrome', [0.3, 0.012, 0.012], [0, H, 0], [0, ry + PI / 4, 0], flat());
  for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; p.box('chrome', [0.012, 0.04, 0.012], [Math.cos(a) * 0.145, H - 0.02, Math.sin(a) * 0.145], null, flat()); }
  const hook = (k) => { const a = k * PI / 2 + PI / 4; return [Math.cos(a) * 0.145, Math.sin(a) * 0.145]; };
  // (the lines run down to a clamp on the pole; with two bags, to a pump clamped there, a small lit window on it)
  const clampY = two ? 1.3 : 0.98;
  ivBag(p, ...hook(0), H - 0.085, [0.02, clampY, 0.02]);
  if (two) {
    ivBag(p, ...hook(2), H - 0.085, [-0.02, clampY, -0.02]);
    add(p, 'white2', solid(shape(0.15, 0.2, 0.02, 0, 1.19), 0.1, { edge: 0.008 }), [0, 0, 0.015]);
    add(p, [0.4, 2.2, 3.0], plate(shape(0.09, 0.045, 0.006, 0, 1.225)), [0, 0, 0.1162], null, 'glow');
    add(p, [0.4, 3.2, 1.0], plate(shape(0.014, 0.014, 0.003, 0.045, 1.135)), [0, 0, 0.1162], null, 'glow');
    p.slab(HOLE, -0.055, 0.02, 1.12, 1.15, 0.115, 0.1165, flat(['-z', '-y', '+y', '-x', '+x']));
  } else p.slab('black', -0.03, 0.03, 0.96, 1.0, -0.03, 0.03, flat());
}

// ── the vital signs machine on a wheeled pole ───────────────────────────────────────────────────────────────────────
export function vitalsPole(p) {
  p = lean(p);
  rollBase(p, 0.25);
  p.cyl('rail', 0.018, 1.08, [0, 0.115 + 0.54, 0], null, 8);
  // the basket: a dark tray with low sides, the cuff rolled up in it and its coiled hose
  for (const [x0, x1, z0, z1] of [[-0.15, 0.15, 0.03, 0.04], [-0.15, 0.15, 0.2, 0.21], [-0.15, -0.14, 0.04, 0.2], [0.14, 0.15, 0.04, 0.2]]) p.slab('gun', x0, x1, 0.74, 0.86, z0, z1, flat());
  p.slab('gun', -0.15, 0.15, 0.73, 0.74, 0.03, 0.21, flat()); p.slab('black', -0.03, 0.03, 0.76, 0.8, -0.02, 0.04, flat());
  p.cyl({ c: '#39424f', r: 0.9 }, 0.05, 0.11, [-0.05, 0.795, 0.12], [0, 0, PI / 2], 8); p.cyl('rubber', 0.035, 0.03, [0.08, 0.76, 0.12], null, 8);
  // the machine's head, tipped back: a pale chunky case, a carrying handle over it, its screen (numbers, one small
  // trace: the breathing's wave, not the heartbeat mark), a row of buttons under the screen
  const q = new (p.constructor)(), W = 0.36, Hh = 0.29;
  add(q, 'white2', solid(shape(W, Hh, 0.04, 0, 0), 0.075, { edge: 0.014 }), [0, 0, -0.04]);
  add(q, 'black', solid(shape(0.274, 0.194, 0.018, -0.025, 0.03), 0.008, { edge: 0.004, back: false }), [0, 0, 0.035]);
  add(q, DARKSCREEN, plate(shape(0.25, 0.17, 0.01, -0.025, 0.03)), [0, 0, 0.0435]);
  const tz = 0.0455;
  segText(q, '118/76', { h: 0.036, at: [-0.05, 0.075, tz], look: TRACE.white, mat: 'glow', t: 0.006, gap: 0.008 });
  segText(q, '72', { h: 0.044, at: [-0.095, 0.012, tz], look: TRACE.green, mat: 'glow', t: 0.007 });
  segText(q, '98', { h: 0.044, at: [0.035, 0.012, tz], look: TRACE.cyan, mat: 'glow', t: 0.007 });
  const wave = []; for (let k = 0; k <= 12; k++) { const u = k / 12; wave.push([-0.135 + u * 0.22, Math.sin(u * PI * 4) * 0.011 - 0.04]); }
  lines(q, wave, 0.0035, TRACE.cyan, tz);
  ['green', 'white', 'white', 'orange'].forEach((c, i) => q.slab(DOT[c], -0.12 + i * 0.05, -0.09 + i * 0.05, -0.115, -0.095, 0.035, 0.041, flat(['-z'])));
  add(q, [0.4, 3.2, 1.0], plate(shape(0.014, 0.014, 0.003, 0.135, 0.09)), [0, 0, 0.0362], null, 'glow');
  for (const sx of [-1, 1]) q.slab('gun', sx * 0.12 - 0.01, sx * 0.12 + 0.01, Hh / 2 - 0.005, Hh / 2 + 0.05, -0.012, 0.008, flat());
  q.slab('gun', -0.13, 0.13, Hh / 2 + 0.04, Hh / 2 + 0.06, -0.014, 0.01, flat());
  for (const part of q.parts) { put(part.geo, [0, 1.33, 0.02], [-0.22, 0, 0]); p.parts.push(part); }
  p.light([0, 1.33, 0.3], 0.22, [0.5, 0.8, 1], [0, -0.2, 1], 1.8);
}

// ── a low cart of drawers ───────────────────────────────────────────────────────────────────────────────────────────
export function medCart(p) {
  p = lean(p);
  const w = 0.56, d = 0.42, h = 0.84, hw = w / 2;
  for (const sx of [-1, 1]) for (const z of [0.07, d - 0.07]) ball(p, 'rubber', 0.035, [sx * (hw - 0.05), 0.035, z], [0.7, 1, 1], [0, 0, 0], 0);
  add(p, 'white', solid(shape(w, h - 0.07, 0.025, 0, (h + 0.07) / 2), d - 0.02, { edge: 0.012 }), [0, 0, 0]);
  // three drawers, each with a dark pull, the top one marked with a teal line; a push bar on one side
  [[0.2, 0.22], [0.44, 0.22], [0.67, 0.2]].forEach(([y, hh], i) => {
    add(p, 'white2', solid(shape(w - 0.07, hh - 0.02, 0.014, 0, y), 0.012, { edge: 0.005, back: false }), [0, 0, d - 0.02]);
    p.slab(HOLE, -0.09, 0.09, y + hh / 2 - 0.05, y + hh / 2 - 0.034, d - 0.008, d + 0.004, flat(['-z']));
    if (i === 2) p.slab(MEDTEAL, -hw + 0.06, hw - 0.06, y - hh / 2 + 0.022, y - hh / 2 + 0.03, d - 0.008, d - 0.0045, flat(['-z']));
  });
  for (const z of [0.08, d - 0.1]) p.slab('rail', hw, hw + 0.05, h - 0.1, h - 0.085, z - 0.008, z + 0.008, flat(['-x']));
  p.slab('rail', hw + 0.04, hw + 0.056, h - 0.1, h - 0.084, 0.07, d - 0.09, flat());
  // its top: a low rail round three sides, and on it a box of gloves, a bottle and a steel dish
  p.slab(TOP, -hw, hw, h, h + 0.012, 0, d - 0.02, flat(['-y']));
  for (const [x0, x1, z0, z1] of [[-hw, hw, 0, 0.012], [-hw, -hw + 0.012, 0.012, d - 0.02], [hw - 0.012, hw, 0.012, d - 0.02]]) p.slab('rail', x0, x1, h + 0.012, h + 0.05, z0, z1, flat(['-y']));
  p.slab({ c: '#7fb0cf', r: 0.6 }, -0.2, -0.02, h + 0.012, h + 0.08, 0.06, 0.17, flat(['-y'])); p.slab(HOLE, -0.15, -0.07, h + 0.08, h + 0.0812, 0.09, 0.14, flat(['-y', '-x', '+x', '-z', '+z']));
  p.lathe({ c: '#e9e9e4', r: 0.35 }, [[0.001, 0], [0.028, 0], [0.028, 0.09], [0.012, 0.11], [0.012, 0.135], [0.001, 0.135]], 8, [0.1, h + 0.012, 0.11]);
  p.lathe('chrome', [[0.001, 0], [0.05, 0], [0.065, 0.03], [0.058, 0.03], [0.046, 0.006], [0.001, 0.006]], 10, [0.12, h + 0.012, 0.27]);
}

// ── a round stool on five wheeled legs ──────────────────────────────────────────────────────────────────────────────
export function medStool(p) {
  rollBase(p, 0.24, 'rail');
  p.cyl('chrome', 0.02, 0.36, [0, 0.115 + 0.18, 0], null, 8);
  p.lathe('black', [[0.001, 0.47], [0.15, 0.47], [0.16, 0.485], [0.001, 0.485]], 12);
  p.lathe({ c: '#56616f', r: 0.85, m: 0, w: 0.3 }, [[0.001, 0.485], [0.165, 0.485], [0.172, 0.52], [0.14, 0.545], [0.001, 0.55]], 12);
}

const wardPiece = (name, variants, foot, build, more = {}) => ({ name, group: 'Medical', at: 'free', variants, foot, build, ...more });
export const WARD_PIECES = {
  bedhead: wardPiece("Bed's wall panel", ['1', '2 bright', '3 off', '4'], [1.5, 2.1, 0.1], bedHead, { at: 'wall', accepts: (v) => !!bedHeadOf(v) }),
  curtain: wardPiece('Ward curtain', ['side drawn 2.5', 'side half 2.5', 'side back 2.5', 'side end 2.5', 'foot bare 3.1', 'foot back 3.1'], [3.1, 3, 0.2], curtain, { accepts: (v) => !!curtainOf(v) }),
  bedtable: wardPiece('Bedside table', ['flowers card', 'bear books', 'flowers2 card2 cup', 'book cup', 'bare'], [0.5, 1.3, 0.45], bedTable, { accepts: tableOk }),
  ivstand: wardPiece('Drip stand', ['one bag', 'two bags'], [0.6, 2.1, 0.6], ivStand),
  vitals: wardPiece('Vital signs machine', ['pole'], [0.55, 1.6, 0.55], vitalsPole),
  medcart: wardPiece('Cart of drawers', ['drawers'], [0.65, 1, 0.45], medCart),
  medstool: wardPiece('Wheeled stool', ['wheeled'], [0.5, 0.6, 0.5], medStool),
};
