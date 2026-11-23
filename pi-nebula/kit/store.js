// THE STORE ROOM, the whole lower level (kit/places-plan.js STORE, SLOT, RACKS, FLOOR have the game's maker's words
// and the numbers; ~/pw/space-math/shots/control-room-1/plan_3 is the agreed drawing). Called CARGO wherever a player
// or the Kit Lab shows its name (2026-11-20: "If you call it store then people will think you can buy stuff there");
// 'store' stays its name in the code.
//   storeHall  a CELL piece placed on the station's cell [0, 0] (its frame is the station's, its floor at y = 0): the
//              floor of the station's plates with its painted lines, the walls (the station's panels, ribs and trims,
//              3.75 m tall) on the grid lines inside the deck's hull and one slanting across the cut corner, the four
//              cargo slots in the west wall (three with a container's end come in through its socket, the fourth empty
//              with a shield across it, as a hangar door has), two cold store doors in the east wall (doors only:
//              nothing is behind them), the ceiling and its long lamps over the aisles and the lane, the
//              forklift's painted place (his forklift parks in it: kit/places-plan.js FORKLIFT), and the forklift
//              lap's paint: its start box and line, a numbered square at each of its four corners (LAP)
//   rack       a FREE piece: 'bays <n>', a row of shelving n bays long from x = 0 along +x, its middle on z = 0: two
//              shelves over the floor, orange beams on dark uprights
//   pallet     a FREE piece, a pallet and its load, 1.2 m by 1 m: 'crates', 'boxes', 'drums', 'wrapped', 'totes'
//   scale      a FREE piece: the floor scale, a platform 3 m square with its readout on a post at its north-west corner
//   bench      a FREE piece: 'packing', a packing bench 3.6 m long (two make the row of benches)
//   shipDesk   a FREE piece: the shipping desk, 3.6 m long, its screens and its printer (the bill)
//   forklift   the game's maker's own model, a file of his (kit/forklift.js draws it): listed here so the Kit Lab shows
//              it with Cargo's pieces; the kit builds nothing of it
// Chunky and plain: every copy of a piece is drawn with its room in one draw for each kind of surface (kit/layout.js).
import * as THREE from 'three';
import { MeshData, bevelBox, put } from './geo.js';
import { G, Z0, BAND } from './shell.js';
import { WALL_FACE as WF, RIB_FACE as RF } from './grid.js';
import { SCREEN_RECT } from './tex.js';
import { segText, textWidth } from './shipparts/cabin/segtext.js';
import { subInto } from './lift.js';
import { flatOver } from './tower.js';
import { STORE, SLOT, RACKS, FLOOR, STOPS, LIFT, LOAD, LAP } from './places-plan.js';

const PI = Math.PI, H = STORE.h, TOPW = 3.25, SIZES = { h: H, top: TOPW };
const ROOF = H;

// the room's outline: the walls' lines (their backs), round from the south-west corner
export const HALL = [[STORE.x0, STORE.z1], [STORE.x0, STORE.cut[1][1]], STORE.cut[0], [STORE.x1, STORE.z0], [STORE.x1, STORE.z1]];

// ── the walls ──────────────────────────────────────────────────────────────────────────────────────────────────────
// one straight wall from a to b (its line), the room on its left seen from above going a to b... worked out below: the
// side toward the room's middle. `holes`: [from, to] along it (metres from a) where something else stands in the wall.
// `kinds`: fn(i) -> the panel's variant
const MID = [(STORE.x0 + STORE.x1) / 2, (STORE.z0 + STORE.z1) / 2];
function wallRun(p, a, b, holes = [], kinds = () => 'plain', ribs = true) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
  let nx = -uz, nz = ux; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; if (nx * (MID[0] - mx) + nz * (MID[1] - mz) < 0) { nx = -nx; nz = -nz; }
  const ry = Math.atan2(nx, nz), at = (t) => [a[0] + ux * t, 0, a[1] + uz * t];
  // the stretches between the holes, each in panels about 2 m wide
  const cuts = [0, ...holes.flat().sort((x, y) => x - y), L], spans = [];
  for (let i = 0; i < cuts.length - 1; i += 2) if (cuts[i + 1] - cuts[i] > 0.05) spans.push([cuts[i], cuts[i + 1]]);
  let k = 0;
  for (const [s0, s1] of spans) {
    const n = Math.max(1, Math.round((s1 - s0) / 2)), w = (s1 - s0) / n;
    for (let i = 0; i < n; i++) {
      const t = s0 + (i + 0.5) * w, v = kinds(k++);
      // (a panel's local +x runs along -u or +u: the turn that takes +z to the room side takes +x to (nz, -nx))
      subInto(p, (q) => storePanel(q, v, w), at(t), ry);
      if (ribs && i > 0 && (k + i) % 2 === 0) subInto(p, (q) => storeRib(q), at(s0 + i * w), ry);
    }
    // a black post closing each end of the stretch
    for (const t of [s0, s1]) subInto(p, (q) => q.slab('black', -0.1, 0.1, 0, H, 0, 0.3, { r: 0.02, cell: 1.5 }), at(t), ry);
  }
  return { L, ux, uz, nx, nz, ry, at };
}

// THE STORE'S OWN WALL PANEL: the station's panel (kit/shell.js wallPanel: white slabs over a dark backing, the dark
// band across at the same height, a charcoal upright in the middle, a skirting), made of fewer and plainer parts and
// taller (3.75 m): a big room's walls are many and are seen from far off. 'dark': its upper half a dark inset
const FLATBOX = { r: 0.007, cell: 9, loops: [] };
function storePanel(q, v, w) {
  const k = w / 2, x0 = -k + G, x1 = k - G;
  q.slab('dark', -k, k, 0, H, 0.03, Z0, { r: 0, cell: 9, skip: ['-z'] });
  q.slab('black', -k, k, 0, 0.15, Z0, WF + 0.03, { ...FLATBOX, skip: ['-z'] });
  q.slab('white', x0, x1, 0.15 + G, BAND[0] - G, Z0, WF + 0.02, { ...FLATBOX, skip: ['-z'] });
  q.slab('band', x0, x1, BAND[0] + G, BAND[1] - G, Z0, WF - 0.03, { ...FLATBOX, skip: ['-z'] });
  for (const [a, b] of [[x0, -0.06], [0.06, x1]]) q.slab(v === 'dark' ? 'grey2' : 'white', a, b, BAND[1] + G, TOPW - G, Z0, WF, { ...FLATBOX, skip: ['-z'] });
  q.slab('black', -0.055, 0.055, 0.1, TOPW, Z0, WF + 0.09, { ...FLATBOX, r: 0.016 });
  q.slab('white2', x0, x1, TOPW + G, H, Z0, WF - 0.02, { ...FLATBOX, skip: ['-z'] });
  q.slab('black', -k, k, TOPW - 0.035, TOPW + G, Z0, WF + 0.01, { r: 0, cell: 9, skip: ['-z'] });
}
// a rib between panels, with its strip of light (the station's rib, plainer)
function storeRib(q) {
  q.slab('black', -0.12, 0.12, 0, H, 0.03, 0.2, { ...FLATBOX, r: 0.018 });
  q.slab('black', -0.07, 0.07, 0.1, TOPW, 0.18, RF, { ...FLATBOX, r: 0.02 });
  q.glowSlab('white', -0.011, 0.011, 0.78, TOPW - 0.3, RF, RF + 0.005);
  for (const y of [1.0, 2.0, 3.0]) q.light([0, y, RF + 0.08], 1.25, [1, 0.98, 0.95], [0, 0, 1], 7);
}

// ── a cargo slot in the west wall: its socket's frame, the header over it with its number; a container's end come in
// through it (the outside's own container, drawn again here a little bigger so the room's light is on it), or a shield ──
const ROOM_FACE = 0.22;
function slot(p, k) {
  const z = SLOT.z[k], hw = SLOT.w / 2, sh = SLOT.h, x = STORE.x0, full = SLOT.full.includes(k);
  // the header over the opening, and the frame round it: chunky black jambs and head, yellow and black on the jambs
  p.slab('white2', x + 0.03, x + ROOM_FACE, sh + 0.1, TOPW, z - hw - 0.3, z + hw + 0.3, { r: 0.008, cell: 1.5, skip: ['-x'] });
  p.slab('white2', x + 0.03, x + ROOM_FACE, TOPW, H, z - hw - 0.3, z + hw + 0.3, { r: 0.008, cell: 1.5, skip: ['-x'] });
  for (const s of [-1, 1]) {
    p.slab('black', x, x + 0.34, 0, sh + 0.1, z + s * hw - (s > 0 ? 0 : 0.3), z + s * hw + (s > 0 ? 0.3 : 0), { r: 0.03, cell: 1.5 });
    for (let i = 0; i < 6; i++) p.slab(i % 2 ? 'black' : 'yellow', x + 0.34, x + 0.345, 0.12 + i * 0.3, 0.42 + i * 0.3, z + s * (hw + 0.15) - 0.14, z + s * (hw + 0.15) + 0.14, { r: 0, cell: 9 });
  }
  p.slab('black', x, x + 0.34, sh, sh + 0.22, z - hw - 0.3, z + hw + 0.3, { r: 0.03, cell: 1.5 });
  p.slab('gun', x, x + 0.3, -0.02, 0.03, z - hw, z + hw, { r: 0.008, cell: 1.5 });       // the sill
  segText(p, '0' + (k + 1), { h: 0.28, t: 0.045, at: [x + ROOM_FACE + 0.006, sh + 0.42, z], rot: [0, PI / 2, 0], look: full ? 'white' : 'amber', mat: 'glow' });
  p.light([x + 0.8, sh + 0.5, z], 0.5, [1, 0.95, 0.85], [1, -0.3, 0], 3.5);
  if (!full) {
    // the empty slot: a shield across the opening (space beyond it), as a hangar door has
    const g = new THREE.PlaneGeometry(SLOT.w, sh, 1, 1); put(g, [x + 0.12, sh / 2, z], [0, PI / 2, 0]); p.add('shield', g);
    p.slab('dark', x - 0.6, x + 0.02, -0.04, 0.0, z - hw, z + hw, { r: 0, cell: 1.5, skip: ['-y'] });   // (the socket's floor, out to the hull)
    return;
  }
  // THE CONTAINER'S END: a coloured box from the wall to x = SLOT.end, its two doors facing the room with their four
  // locking bars, a seal round it in the socket
  const [W, Ht] = SLOT.box, c = SLOT.colours[k], col = { c, r: 0.5, m: 0.25, w: 0.6 }, dk = { c: '#' + new THREE.Color(c).multiplyScalar(0.6).getHexString(), r: 0.5, m: 0.25, w: 0.6 };
  const x1 = SLOT.end + 0.02, y0 = 0.04, y1 = y0 + Ht + 0.04, hz = W / 2 + 0.045;
  // (a container the supply run loads, LOAD: open, its doors drawn apart so they can swing, kit/containerdoors.js)
  if (LOAD.slots.includes(k)) { openEnd(p, k, { x, z, x1, y0, y1, hz, col, dk }); return; }
  p.slab(col, x - 0.4, x1 - 0.06, y0, y1, z - hz, z + hz, { r: 0.02, cell: 1.5 });
  for (const xr of [x1 - 0.7, x1 - 2.05]) p.slab(dk, xr - 0.04, xr + 0.04, y0 + 0.1, y1 - 0.1, z - hz - 0.025, z + hz + 0.025, { r: 0.01, cell: 1.5 });   // its ribs
  p.slab('gun', x1 - 0.1, x1, y0, y1, z - hz, z + hz, { r: 0.02, cell: 1.5 });       // the end frame
  for (const s of [-1, 1]) {
    p.slab(col, x1 - 0.06, x1 + 0.02, y0 + 0.14, y1 - 0.14, z + (s > 0 ? 0.01 : -hz + 0.12), z + (s > 0 ? hz - 0.12 : -0.01), { r: 0.01, cell: 1.5 });
    for (const t of [0.3, 0.75]) { const zz = z + s * t; p.cyl('rail', 0.022, y1 - y0 - 0.3, [x1 + 0.06, (y0 + y1) / 2, zz], null, 10); p.slab('rail', x1 + 0.02, x1 + 0.12, 1.1, 1.16, zz - 0.02, zz + 0.12 * -s, { r: 0.01 }); }
  }
  segText(p, '0' + (k + 1), { h: 0.5, t: 0.07, at: [x1 + 0.025, 2.1, z], rot: [0, PI / 2, 0], look: 'white' });
  // the seal, filling the socket round it
  p.slab('rubber', x, x + 0.18, y1, sh, z - hw, z + hw, { r: 0.02, cell: 1.5 });
  for (const s of [-1, 1]) p.slab('rubber', x, x + 0.18, 0, sh, s > 0 ? z + hz : z - hw, s > 0 ? z + hw : z - hz, { r: 0.02, cell: 1.5 });
}

// ── A CONTAINER THE SUPPLY RUN LOADS (LOAD.slots: 03 and 02), open to the room: its sides, roof and floor round an
// inside (painted grey inside, as many containers are, a dark plywood floor, ribs down its walls), the door frame round the doorway (two posts, a
// header, a steel sill flush with its floor), and its back closed off where it goes into the station's side (the
// rest of its length is outside, kit/outside-plan.js, which stops it there). Its doors are not here: they swing, and are
// drawn apart (kit/containerdoors.js: closed they look as the others' do). Its numbers and bars are on its doors.
export const CONTAINER_IN = { back: STORE.x0 - 0.35, skin: 0.05, rib: 1.0, floor: { c: '#4a3a2c', r: 0.85, m: 0, w: 0.4 }, inside: { c: '#8b9096', r: 0.6, m: 0.2, w: 0.5 }, ribs: { c: '#62676d', r: 0.6, m: 0.25, w: 0.5 } };
function openEnd(p, k, { x, z, x1, y0, y1, hz, col, dk }) {
  const sk = CONTAINER_IN.skin, xb = CONTAINER_IN.back, o = { r: 0.012, cell: 1.5 };
  const inner = CONTAINER_IN.inside, ribs = CONTAINER_IN.ribs;
  // its sides and roof: the outer skin in its colour, the inside grey
  for (const s of [-1, 1]) {
    p.slab(col, x - 0.4, x1 - 0.06, y0, y1, s > 0 ? z + hz - sk : z - hz, s > 0 ? z + hz : z - hz + sk, o);
    p.slab(inner, xb, x1 - 0.1, LOAD.floor, y1 - sk, s > 0 ? z + hz - sk - 0.012 : z - hz + sk, s > 0 ? z + hz - sk : z - hz + sk + 0.012, { r: 0, cell: 1.5 });
  }
  p.slab(col, x - 0.4, x1 - 0.06, y1 - sk, y1, z - hz, z + hz, o);
  p.slab(inner, xb, x1 - 0.1, y1 - sk - 0.012, y1 - sk, z - hz + sk, z + hz - sk, { r: 0, cell: 1.5 });
  // its floor (the forks carry a pallet over its sill), and its back where it goes into the station's side
  p.slab(CONTAINER_IN.floor, xb, x1 - 0.06, 0, LOAD.floor, z - hz + sk, z + hz - sk, { r: 0.004, cell: 1.5 });
  p.slab(inner, xb - 0.05, xb, 0, y1, z - hz, z + hz, { r: 0, cell: 1.5 });
  // ribs down its inside walls and across its roof, a darker grey
  for (let xr = x1 - 0.55; xr > xb + 0.3; xr -= CONTAINER_IN.rib) {
    for (const s of [-1, 1]) p.slab(ribs, xr - 0.04, xr + 0.04, LOAD.floor, y1 - sk, s > 0 ? z + hz - sk - 0.05 : z - hz + sk, s > 0 ? z + hz - sk : z - hz + sk + 0.05, { r: 0.008, cell: 1.5 });
    p.slab(ribs, xr - 0.04, xr + 0.04, y1 - sk - 0.05, y1 - sk, z - hz + sk, z + hz - sk, { r: 0.008, cell: 1.5 });
  }
  // its outside ribs round the part in the room: up its sides and over its roof
  for (const xr of [x1 - 0.7, x1 - 2.05]) {
    for (const s of [-1, 1]) p.slab(dk, xr - 0.04, xr + 0.04, y0 + 0.1, y1 - 0.1, s > 0 ? z + hz : z - hz - 0.025, s > 0 ? z + hz + 0.025 : z - hz, { r: 0.01, cell: 1.5 });
    p.slab(dk, xr - 0.04, xr + 0.04, y1, y1 + 0.02, z - hz + 0.1, z + hz - 0.1, { r: 0.01, cell: 1.5 });
  }
  // the door frame: its two corner posts, its header, its sill
  const post = hz - LOAD.door;
  for (const s of [-1, 1]) p.slab('gun', x1 - LOAD.frame, x1, y0, y1, s > 0 ? z + hz - post : z - hz, s > 0 ? z + hz : z - hz + post, { r: 0.02, cell: 1.5 });
  p.slab('gun', x1 - LOAD.frame, x1, y1 - 0.16, y1, z - hz, z + hz, { r: 0.02, cell: 1.5 });
  p.slab('gun', x1 - LOAD.frame, x1, 0, LOAD.floor + 0.002, z - LOAD.door, z + LOAD.door, { r: 0.004, cell: 1.5 });
  // the seal, filling the socket round it
  const hw = SLOT.w / 2, sh = SLOT.h;
  p.slab('rubber', x, x + 0.18, y1, sh, z - hw, z + hw, { r: 0.02, cell: 1.5 });
  for (const s of [-1, 1]) p.slab('rubber', x, x + 0.18, 0, sh, s > 0 ? z + hz : z - hw, s > 0 ? z + hw : z - hz, { r: 0.02, cell: 1.5 });
}

// ── a cold store door in the east wall (shut: nothing is behind it) ─────────────────────────────────────────────────
function coldDoor(p, { z, n }) {
  const x = STORE.x1, hw = 1.2, dh = 2.7, F = ROOM_FACE;
  const ice = { c: '#d6dee6', r: 0.45, m: 0.05, w: 0.4 }, frame = { c: '#3e5466', r: 0.4, m: 0.3, w: 0.4 };
  p.slab('white2', x - F, x - 0.03, dh + 0.15, H, z - hw - 0.25, z + hw + 0.25, { r: 0.008, cell: 1.5, skip: ['+x'] });
  for (const s of [-1, 1]) p.slab(frame, x - 0.36, x, 0, dh + 0.15, s > 0 ? z + hw : z - hw - 0.25, s > 0 ? z + hw + 0.25 : z - hw, { r: 0.03, cell: 1.5 });
  p.slab(frame, x - 0.36, x, dh, dh + 0.18, z - hw - 0.25, z + hw + 0.25, { r: 0.03, cell: 1.5 });
  // the door: a thick insulated slab, grooved across, a long steel pull, a kick strip
  p.slab(ice, x - 0.3, x - 0.08, 0.02, dh, z - hw, z + hw, { r: 0.04, seg: 2, cell: 1.5 });
  for (let y = 0.45; y < dh - 0.2; y += 0.42) p.slab('grey', x - 0.305, x - 0.295, y, y + 0.025, z - hw + 0.08, z + hw - 0.08, { r: 0, cell: 9 });
  p.cyl('rail', 0.028, 1.1, [x - 0.39, 1.15, z + hw - 0.25], null, 12);
  for (const y of [0.62, 1.68]) p.slab('rail', x - 0.4, x - 0.3, y - 0.03, y + 0.03, z + hw - 0.28, z + hw - 0.22, { r: 0.01 });
  for (let i = 0; i < 8; i++) p.slab(i % 2 ? 'black' : 'yellow', x - 0.305, x - 0.3, 0.04, 0.3, z - hw + i * 0.3, z - hw + (i + 1) * 0.3, { r: 0, cell: 9 });
  // its sign and its readout: COLD STORE n, lit blue, and the cold inside it
  p.slab('black', x - F - 0.03, x - F, dh + 0.22, dh + 0.5, z - 1.05, z + 1.05, { r: 0.01, cell: 1.5 });
  segText(p, 'COLD STORE ' + n, { h: 0.15, t: 0.022, at: [x - F - 0.034, dh + 0.36, z], rot: [0, -PI / 2, 0], look: 'blue', mat: 'glow' });
  p.slab('black', x - F - 0.04, x - F, 1.4, 1.62, z - hw - 0.75, z - hw - 0.35, { r: 0.008 });
  segText(p, '-18 C', { h: 0.07, t: 0.012, at: [x - F - 0.044, 1.51, z - hw - 0.55], rot: [0, -PI / 2, 0], look: 'amber', mat: 'glow' });
  p.light([x - 0.8, dh + 0.4, z], 0.5, [0.55, 0.75, 1], [-1, -0.2, 0], 3.5);
}

// ── paint on the floor ───────────────────────────────────────────────────────────────────────────────────────────
const PLATES = { c: '#5f6368', r: 0.34, m: 0.35, w: 0.45 }, PAINT = { c: '#c9a032', r: 0.6, m: 0, w: 0.9 }, WHITE_PAINT = { c: '#b9bcbf', r: 0.6, m: 0, w: 0.9 };
function line(p, look, a, b, w = 0.1, y = 0.003) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), g = bevelBox([L + w, 0.004, w], [0, 0, 0], { r: 0, cell: 9 });
  put(g, [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], [0, -Math.atan2(b[1] - a[1], b[0] - a[0]), 0]); return p.add('solid', g, look);
}
function box(p, look, [x0, x1, z0, z1], w = 0.1, y = 0.003) { line(p, look, [x0, z0], [x1, z0], w, y); line(p, look, [x1, z0], [x1, z1], w, y); line(p, look, [x1, z1], [x0, z1], w, y); line(p, look, [x0, z1], [x0, z0], w, y); }
// THE FORKLIFT LAP's paint (kit/places-plan.js LAP has the game's maker's words): the start box in the lane with START
// in it, read by the driver stopped in it; its line, the box's edge the lap sets off over, two rows of chequers across
// the box and a plain line across the rest of the lane; and at each of the lap's four corners a square with its number,
// read by the driver coming to it. White, as the lane's own line is (the yellow is the loading floor's and the
// forklift's place), a millimetre over the room's other paint (the first corner's square crosses the loading floor's
// edge). The game lights them as a lap goes (src/cargolap.js).
export function lapPaint(p) {
  const [x0, x1, z0, z1] = LAP.box, west = Math.cos(LAP.face) < 0, lx = west ? x0 : x1, bx = west ? x1 : x0, into = west ? 1 : -1, C = 0.2, Y = 0.004;
  // (the box: its back and its two sides; its fourth side is the line)
  line(p, WHITE_PAINT, [lx, z0], [bx, z0], 0.1, Y); line(p, WHITE_PAINT, [bx, z0], [bx, z1], 0.1, Y); line(p, WHITE_PAINT, [bx, z1], [lx, z1], 0.1, Y);
  line(p, WHITE_PAINT, [lx, LAP.lane[0]], [lx, LAP.lane[1]], 0.12, Y);
  for (let r = 0; r < 2; r++) for (let k = 0; k * C < z1 - z0 - 1e-6; k++) {
    if ((r + k) % 2) continue;
    const a = lx + into * (0.06 + r * C), b = a + into * C;
    p.slab(WHITE_PAINT, Math.min(a, b), Math.max(a, b), Y - 0.002, Y + 0.002, z0 + k * C, Math.min(z1, z0 + (k + 1) * C), { r: 0, cell: 9 });
  }
  // (lettering on the floor, its top the way the driver is going: h, a pose's turn)
  const words = (text, at, h, o) => segText(p, text, { ...o, at: [at[0], Y + 0.003, at[1]], rot: [-PI / 2, 0, h - PI / 2], look: WHITE_PAINT });
  words('START', [(x0 + x1) / 2 + into * 0.35, (z0 + z1) / 2], LAP.face, { h: 0.44, t: 0.07 });
  let from = [lx, (z0 + z1) / 2];
  LAP.corners.forEach((c, i) => {
    box(p, WHITE_PAINT, [c[0] - LAP.gate / 2, c[0] + LAP.gate / 2, c[1] - LAP.gate / 2, c[1] + LAP.gate / 2], 0.1, Y);
    words(String(i + 1), c, Math.atan2(-(c[1] - from[1]), c[0] - from[0]), { h: 0.9, t: 0.13 });
    from = c;
  });
}

export function storeHall(p) {
  // the floor (the lift's box has its own)
  const S = STOPS.find((s) => s.id === 'store'), lx = S.at[0], lz = S.at[2], lh = LIFT.half + LIFT.wall - 0.04;
  // (the terminal's floor and the control room's: dark polished plates a metre square, a fine seam between them)
  flatOver(p, HALL, PLATES, { y: 0, step: 1, skip: (x, z) => Math.abs(x - lx) < lh && Math.abs(z - lz) < lh });
  { const [[ax, az], [bx, bz]] = STORE.cut, kk = (bz - az) / (bx - ax), zAt = (x) => (x < bx || x > ax ? STORE.z0 : az + (x - ax) * kk), xAt = (z) => (z > bz ? STORE.x0 : ax + (z - az) / kk);
    for (let x = STORE.x0 + 2; x < STORE.x1 - 0.5; x += 2) p.slab('dark', x - 0.008, x + 0.008, 0, 0.002, zAt(x) + 0.3, STORE.z1 - 0.25, { r: 0, cell: 9 });
    for (let z = STORE.z0 + 2; z < STORE.z1 - 0.5; z += 2) p.slab('dark', Math.max(STORE.x0, xAt(z)) + 0.3, STORE.x1 - 0.25, 0, 0.002, z - 0.008, z + 0.008, { r: 0, cell: 9 }); }
  // the walls: west (the cargo slots), south, east (the cold store doors), north, and across the cut corner
  const sl = SLOT.z.map((z) => [z - SLOT.w / 2 - 0.3 - STORE.cut[1][1], z + SLOT.w / 2 + 0.3 - STORE.cut[1][1]]);
  const kinds = (pat) => (i) => pat[i % pat.length];
  wallRun(p, [STORE.x0, STORE.cut[1][1]], [STORE.x0, STORE.z1], sl.map(([a, b]) => [a, b]), kinds(['plain', 'plain', 'dark']));
  wallRun(p, [STORE.x0, STORE.z1], [STORE.x1, STORE.z1], [], kinds(['plain', 'locker', 'plain', 'plain', 'dark', 'plain']));
  wallRun(p, [STORE.x1, STORE.z1], [STORE.x1, STORE.z0], FLOOR.cold.map((d) => [STORE.z1 - d.z - 1.45, STORE.z1 - d.z + 1.45]), kinds(['plain', 'plain', 'dark', 'plain']));
  wallRun(p, [STORE.x1, STORE.z0], STORE.cut[0], [], kinds(['plain', 'dark', 'plain', 'locker']));
  wallRun(p, STORE.cut[0], STORE.cut[1], [], kinds(['plain', 'dark']));
  for (let k = 0; k < SLOT.z.length; k++) slot(p, k);
  for (const d of FLOOR.cold) coldDoor(p, d);
  // the ceiling: off-white panels, a dark seam every 2 m both ways (the station's cells), cut along the slanting wall
  flatOver(p, HALL, 'white', { y: ROOF, down: true, step: 1, skip: (x, z) => Math.abs(x - lx) < lh && Math.abs(z - lz) < lh });
  const [[cx0, cz0], [cx1, cz1]] = STORE.cut, k = (cz1 - cz0) / (cx1 - cx0);
  const zAt = (x) => (x < cx1 || x > cx0 ? STORE.z0 : cz0 + (x - cx0) * k), xAt = (z) => (z > cz1 ? STORE.x0 : cx0 + (z - cz0) / k);
  for (let x = STORE.x0 + 2; x < STORE.x1 - 0.5; x += 2) p.slab('dark', x - 0.012, x + 0.012, ROOF - 0.006, ROOF, zAt(x) + 0.3, STORE.z1 - 0.2, { r: 0, cell: 9 });
  for (let z = STORE.z0 + 2; z < STORE.z1 - 0.5; z += 2) p.slab('dark', Math.max(STORE.x0, xAt(z)) + 0.3, STORE.x1 - 0.2, ROOF - 0.006, ROOF, z - 0.012, z + 0.012, { r: 0, cell: 9 });
  // the lamps: long bars hung under the ceiling down every aisle, over the lane and across the south end
  const bar = (x0, x1, z) => {
    const y = ROOF - 0.16;
    p.slab('black', x0, x1, y, y + 0.1, z - 0.13, z + 0.13, { r: 0.015, cell: 1.5 });
    for (const xr of [x0 + 0.3, x1 - 0.3]) p.slab('gun', xr - 0.01, xr + 0.01, y + 0.1, ROOF, z - 0.01, z + 0.01, { r: 0, cell: 9 });
    p.glowSlab('soft', x0 + 0.05, x1 - 0.05, y - 0.008, y, z - 0.09, z + 0.09, { cell: 9 });
    for (let t = x0 + 0.6; t < x1 - 0.3; t += 1.2) p.light([t, y - 0.1, z], 2.6, [1, 0.97, 0.92], [0, -1, 0], 8);
  };
  const barZ = (z0, z1, x) => {
    const y = ROOF - 0.16;
    p.slab('black', x - 0.13, x + 0.13, y, y + 0.1, z0, z1, { r: 0.015, cell: 1.5 });
    for (const zr of [z0 + 0.3, z1 - 0.3]) p.slab('gun', x - 0.01, x + 0.01, y + 0.1, ROOF, zr - 0.01, zr + 0.01, { r: 0, cell: 9 });
    p.glowSlab('soft', x - 0.09, x + 0.09, y - 0.008, y, z0 + 0.05, z1 - 0.05, { cell: 9 });
    for (let t = z0 + 0.6; t < z1 - 0.3; t += 1.2) p.light([x, y - 0.1, t], 2.6, [1, 0.97, 0.92], [0, -1, 0], 8);
  };
  const aisles = [RACKS.z[0] - 2.4, ...RACKS.z.slice(0, -1).map((z, i) => (z + RACKS.z[i + 1]) / 2), RACKS.z[RACKS.z.length - 1] + 2.6];
  for (const z of aisles) bar(5.2, 20.4, z);
  barZ(-6.5, 33, 22.3);                                // the lane up the east wall
  barZ(-0.5, 22, 1.6);                                 // the loading floor
  for (const x of [-2.6, 7, 17]) bar(x - 3.6, x + 3.6, 28.6);   // the south end: the benches, the desk, the lift, the forklift
  bar(-2, 4, -5.4);                                    // by the scale
  // paint: the loading floor's edge, the forklift's place with its name, a line along the lane
  box(p, PAINT, [STORE.x0 + 0.5, 4.6, 1.2, 22.6]);
  const [fx0, fx1, fz0, fz1] = FLOOR.forklift;
  box(p, PAINT, FLOOR.forklift, 0.12);
  for (let t = 0; t < 4; t++) line(p, PAINT, [fx0 + 0.3 + t * 1.05, fz1 - 0.3], [fx0 + 0.9 + t * 1.05, fz1 - 0.95], 0.08);
  segText(p, 'FORKLIFT', { h: 0.42, t: 0.07, at: [(fx0 + fx1) / 2, 0.006, fz0 + 0.75], rot: [-PI / 2, 0, 0], look: PAINT });
  line(p, WHITE_PAINT, [20.6, -7.6], [20.6, 34.5], 0.08);
  // the forklift lap: its start box and line, a numbered square at each of its four corners
  lapPaint(p);
}

// ── the shelving ─────────────────────────────────────────────────────────────────────────────────────────────────────
const UPRIGHT = { c: '#3b4a5c', r: 0.45, m: 0.4, w: 0.5 }, BEAM = 'orange';
export function rack(p, v) {
  const n = Math.max(1, parseInt(v.split(' ')[1], 10) || 1), B = RACKS.bay, D = RACKS.deep / 2, L = n * B, top = RACKS.top, bh = RACKS.beam;
  for (let i = 0; i <= n; i++) {
    const x = i * B;
    for (const z of [-D, D]) {
      p.slab(UPRIGHT, x - 0.045, x + 0.045, 0, top, z - 0.045, z + 0.045, { r: 0.01, cell: 1.5 });
      p.slab('gun', x - 0.08, x + 0.08, 0, 0.015, z - 0.08, z + 0.08, { r: 0, cell: 9 });
      p.slab('yellow', x - 0.07, x + 0.07, 0.02, 0.36, z + (z > 0 ? 0.05 : -0.07), z + (z > 0 ? 0.07 : -0.05), { r: 0.01 });   // (the post's guard)
    }
    // the bracing between the frame's two posts
    for (let k = 0; k < 4; k++) { const y0 = 0.25 + k * 0.75, y1 = y0 + 0.75, g = bevelBox([0.03, Math.hypot(0.75, 2 * D), 0.03], [0, 0, 0], { r: 0, cell: 9 }); put(g, [x, (y0 + y1) / 2, 0], [(k % 2 ? 1 : -1) * Math.atan2(2 * D, 0.75), 0, 0]); p.add('solid', g, 'gun'); }
    p.slab('gun', x - 0.025, x + 0.025, top - 0.05, top, -D, D, { r: 0, cell: 9 });
  }
  // the beams and the shelves' decks
  for (const y of RACKS.levels.slice(1)) {
    for (const z of [-D, D]) p.slab(BEAM, 0.045, L - 0.045, y, y + bh, z - 0.03, z + 0.03, { r: 0.01, cell: 1.5 });
    for (let i = 0; i < n; i++) p.slab('dark', i * B + 0.05, (i + 1) * B - 0.05, y + bh - 0.02, y + bh, -D + 0.03, D - 0.03, { r: 0, cell: 1.5 });
  }
}

// ── a pallet and its load ────────────────────────────────────────────────────────────────────────────────────────────
const CARD = { c: '#8a7656', r: 0.75, m: 0, w: 0.6 }, BLUE = { c: '#3d5d7c', r: 0.5, m: 0.1, w: 0.5 }, OLIVE = { c: '#5f6748', r: 0.6, m: 0.1, w: 0.5 },
  DRUM = { c: '#b8551e', r: 0.42, m: 0.3, w: 0.6 }, DRUM2 = { c: '#2f5f8f', r: 0.42, m: 0.3, w: 0.6 }, WRAP = { c: '#c9ccd0', r: 0.25, m: 0.05, w: 0.3 };
const CHUNK = { r: 0.012, cell: 9, loops: [] };
export function pallet(p, v) {
  // the pallet: three dark skids, a deck on them
  for (const z of [-0.42, 0, 0.42]) p.slab('dark', -0.6, 0.6, 0, 0.1, z - 0.06, z + 0.06, { r: 0, cell: 9 });
  p.slab('gun', -0.6, 0.6, 0.1, 0.14, -0.5, 0.5, { r: 0, cell: 9 });
  const y = 0.14;
  if (v === 'crates') {
    for (const [x, look] of [[-0.29, 'white2'], [0.29, 'grey2']]) { p.slab(look, x - 0.27, x + 0.27, y, y + 0.78, -0.47, 0.47, CHUNK); p.slab('orange', x - 0.275, x + 0.275, y + 0.5, y + 0.6, -0.475, 0.475, CHUNK); }
  } else if (v === 'boxes') {
    for (const x of [-0.3, 0.3]) for (const z of [-0.24, 0.24]) for (const k of [0, 1]) p.slab(CARD, x - 0.28, x + 0.28, y + k * 0.4, y + k * 0.4 + 0.39, z - 0.23, z + 0.23, { r: 0, cell: 9 });
    p.slab('black', -0.59, 0.59, y + 0.36, y + 0.42, -0.012, 0.012, { r: 0, cell: 9 });        // (a strap round them)
  } else if (v === 'drums') {
    for (const x of [-0.29, 0.29]) for (const z of [-0.23, 0.23]) { p.cyl(DRUM, 0.24, 0.84, [x, y + 0.42, z], null, 12); p.cyl('black', 0.245, 0.03, [x, y + 0.3, z], null, 12); p.cyl('black', 0.245, 0.03, [x, y + 0.6, z], null, 12); }
  } else if (v === 'drums2') {
    for (const x of [-0.29, 0.29]) for (const z of [-0.23, 0.23]) { p.cyl(DRUM2, 0.24, 0.84, [x, y + 0.42, z], null, 12); p.cyl('black', 0.245, 0.03, [x, y + 0.3, z], null, 12); p.cyl('black', 0.245, 0.03, [x, y + 0.6, z], null, 12); }
  } else if (v === 'wrapped') {
    p.slab(WRAP, -0.58, 0.58, y, y + 0.9, -0.48, 0.48, { r: 0.06, seg: 2, cell: 9, loops: [] });
    p.slab('orange', -0.585, 0.585, y + 0.62, y + 0.7, -0.485, 0.485, CHUNK);
  } else if (v === 'totes') {
    for (const [x, look] of [[-0.3, BLUE], [0.3, OLIVE]]) for (const k of [0, 1, 2]) { p.slab(look, x - 0.28, x + 0.28, y + k * 0.3, y + k * 0.3 + 0.28, -0.46, 0.46, { r: 0, cell: 9 }); p.slab('black', x - 0.285, x + 0.285, y + k * 0.3 + 0.24, y + k * 0.3 + 0.28, -0.465, 0.465, { r: 0, cell: 9 }); }
  }
}
export const PALLET_LOADS = ['crates', 'boxes', 'drums', 'wrapped', 'totes', 'drums2'];

// ── the floor scale ──────────────────────────────────────────────────────────────────────────────────────────────────
export function scale(p) {
  const h = 1.5, w = 1.5;
  p.slab('gun', -w, w, 0, 0.09, -h, h, { r: 0.02, cell: 1.5 });
  p.slab('rail', -w + 0.12, w - 0.12, 0.09, 0.1, -h + 0.12, h - 0.12, { r: 0, cell: 1.5 });
  for (let i = -4; i <= 4; i++) p.slab('black', -w + 0.15, w - 0.15, 0.1, 0.104, i * 0.3 - 0.015, i * 0.3 + 0.015, { r: 0, cell: 9 });
  for (const s of [-1, 1]) { p.slab('yellow', -w, w, 0.09, 0.1, s * h - (s > 0 ? 0.1 : 0), s * h + (s > 0 ? 0 : 0.1), { r: 0, cell: 9 }); p.slab('yellow', s * w - (s > 0 ? 0.1 : 0), s * w + (s > 0 ? 0 : 0.1), 0.09, 0.1, -h, h, { r: 0, cell: 9 }); }
  // the readout, on a post at its north-west corner, turned to face the platform
  const px = -w - 0.25, pz = -h - 0.25;
  p.slab('black', px - 0.06, px + 0.06, 0, 1.45, pz - 0.06, pz + 0.06, { r: 0.012 });
  const head = bevelBox([0.62, 0.36, 0.14], [0, 0, 0], { r: 0.02, seg: 2, cell: 9 }); put(head, [px + 0.12, 1.55, pz + 0.12], [0, PI / 4, 0]); p.add('solid', head, 'white2');
  const scr = bevelBox([0.5, 0.2, 0.01], [0, 0, 0], { r: 0.004, seg: 1, cell: 9 }); put(scr, [px + 0.12 + 0.05, 1.56, pz + 0.12 + 0.05], [0, PI / 4, 0]); p.add('solid', scr, 'black');
  segText(p, '0 KG', { h: 0.09, t: 0.016, at: [px + 0.12 + 0.058, 1.56, pz + 0.12 + 0.058], rot: [0, PI / 4, 0], look: 'amber', mat: 'glow' });
  segText(p, 'SCALE', { h: 0.06, t: 0.01, at: [px + 0.12 + 0.058, 1.7, pz + 0.12 + 0.058], rot: [0, PI / 4, 0], look: { c: '#2a2c30', r: 0.5, m: 0, w: 0.1 } });
  p.light([px + 0.5, 1.6, pz + 0.5], 0.2, [1, 0.75, 0.35], [1, 0, 1], 1.6);
}

// ── a packing bench: a steel table, a shelf under it, boxes flat and made up, tape, a roll of wrap on its stand ──────
export function bench(p) {
  const L = 1.8, D = 0.45, h = 0.92;
  p.slab('grey2', -L, L, h - 0.05, h, -D, D, { r: 0.015, cell: 1.5 });
  p.slab('black', -L + 0.02, L - 0.02, h - 0.09, h - 0.05, -D + 0.02, D - 0.02, { r: 0.008, cell: 1.5 });
  p.slab('gun', -L + 0.05, L - 0.05, 0.22, 0.25, -D + 0.05, D - 0.05, { r: 0.006, cell: 1.5 });
  for (const x of [-L + 0.06, 0, L - 0.06]) for (const z of [-D + 0.06, D - 0.06]) p.slab('black', x - 0.03, x + 0.03, 0, h - 0.09, z - 0.03, z + 0.03, { r: 0.008 });
  // on the shelf: flat boxes in a stack; on the top: two boxes made up, a tape gun, a roll of labels
  p.slab(CARD, -1.5, -0.5, 0.25, 0.37, -0.35, 0.35, CHUNK);
  p.slab(CARD, 0.3, 1.0, 0.25, 0.65, -0.3, 0.3, CHUNK);
  p.slab(CARD, -1.4, -0.85, h, h + 0.4, -0.3, 0.2, CHUNK); p.slab(CARD, -0.75, -0.2, h, h + 0.3, -0.25, 0.25, CHUNK);
  p.slab('black', -0.75, -0.2, h + 0.3, h + 0.305, -0.02, 0.02, { r: 0, cell: 9 });
  p.slab('red', 0.2, 0.42, h, h + 0.06, -0.05, 0.08, { r: 0.01 }); p.cyl('grey', 0.06, 0.05, [0.3, h + 0.1, 0.0], [PI / 2, 0, 0], 14);
  p.cyl('white2', 0.08, 0.1, [0.75, h + 0.05, 0.15], null, 14);
  // the roll of stretch wrap on its stand at the end
  p.slab('black', L - 0.35, L - 0.31, h, h + 0.5, -0.02, 0.02, { r: 0.006 });
  p.cyl(WRAP, 0.07, 0.42, [L - 0.22, h + 0.27, 0], null, 14);
  p.light([0, h + 1.2, 0.3], 0.3, [1, 0.97, 0.9], [0, -1, 0], 2.5);
}

// ── the shipping desk: two screens (the bill), a printer, papers, a chair's room in front ─────────────────────────────
export function shipDesk(p) {
  const L = 1.8, D = 0.4, h = 0.76;
  p.slab('white2', -L, L, h - 0.04, h, -D, D, { r: 0.012, cell: 1.5 });
  p.slab('white', -L, -0.6, 0.06, h - 0.04, -D + 0.02, D - 0.1, { r: 0.012, cell: 1.5 });
  p.slab('black', L - 0.06, L - 0.02, 0, h - 0.04, -D + 0.04, D - 0.04, { r: 0.008 });
  for (const x of [-0.25, 0.65]) {
    p.slab('black', x - 0.04, x + 0.04, h, h + 0.32, -D + 0.08, -D + 0.14, { r: 0.008 });
    p.slab('white2', x - 0.34, x + 0.34, h + 0.25, h + 0.66, -D + 0.12, -D + 0.17, { r: 0.012 }); p.slab('black', x - 0.31, x + 0.31, h + 0.28, h + 0.63, -D + 0.165, -D + 0.175, { r: 0.006 });
    p.screen(x < 0 ? SCREEN_RECT.math : SCREEN_RECT.terminal, 0.58, 0.31, [x, h + 0.455, -D + 0.176], null, 1.1);
  }
  p.slab('dark', -0.3, 0.6, h, h + 0.015, -0.05, 0.12, { r: 0.006 });           // the keyboard
  p.slab('grey2', 1.0, 1.55, h, h + 0.22, -0.3, 0.15, { r: 0.02 }); p.slab('black', 1.05, 1.5, h + 0.12, h + 0.14, 0.12, 0.2, { r: 0.006 });   // the printer
  p.slab('white2', 1.08, 1.46, h + 0.14, h + 0.142, 0.16, 0.36, { r: 0, cell: 9 });                                                           // its bill coming out
  p.slab('white2', -1.5, -1.0, h, h + 0.04, -0.2, 0.15, { r: 0.004 });          // papers
  p.light([0.2, h + 0.5, 0.2], 0.35, [0.45, 0.75, 1], [0, 0, 1], 2.5);
}

// ── A DOOR LEAF of a container the supply run loads (LOAD.slots), drawn apart from the room so it can swing
// (kit/containerdoors.js). 'north 03' / 'south 03' (and 02): the leaf on that side of container 03's doorway, in its
// own frame: its hinge at the origin (LOAD.hinge: in front of the door frame and past the container's corner), the
// leaf along +z from it (north) or -z (south), its outer face toward +x. Closed it is exactly the doors the other
// containers have: the container's paint, its two locking bars and their handles, half its number.
export function containerDoor(p, v) {
  const [side, num] = String(v).split(' '), k = (+num || 3) - 1, s = side === 'south' ? 1 : -1;
  const [W, Ht] = SLOT.box, c = SLOT.colours[k], col = { c, r: 0.5, m: 0.25, w: 0.6 };
  const x1 = SLOT.end + 0.02, y0 = 0.04, y1 = y0 + Ht + 0.04, hz = W / 2 + 0.045, z = SLOT.z[k];
  const H = LOAD.hinge, px = x1 + H.out, pz = z + s * (hz + H.beyond);
  // (the room's numbers turned into the leaf's: x from its hinge, z from its hinge)
  const X = (x) => x - px, Z = (zz) => zz - pz;
  const za = z + s * 0.01, zb = z + s * (hz - (hz - LOAD.door));
  p.slab(col, X(x1 - 0.06), X(x1 + 0.02), LOAD.floor + 0.016, y1 - 0.16, Math.min(Z(za), Z(zb)), Math.max(Z(za), Z(zb)), { r: 0.01, cell: 1.5 });
  for (const t of [0.3, 0.75]) {
    const zz = z + s * t;
    p.cyl('rail', 0.022, y1 - y0 - 0.3, [X(x1 + 0.06), (y0 + y1) / 2, Z(zz)], null, 10);
    p.slab('rail', X(x1 + 0.02), X(x1 + 0.12), 1.1, 1.16, Math.min(Z(zz - 0.02 * -s), Z(zz + 0.12 * -s)), Math.max(Z(zz - 0.02 * -s), Z(zz + 0.12 * -s)), { r: 0.01 });
  }
  // half its number: read from the room it runs north (its first figure on the south leaf, its second on the north)
  const o = { h: 0.5, t: 0.07 }, full = '0' + (k + 1), Wt = textWidth(full, o), w = textWidth('0', o), gap = Wt - 2 * w;
  const n = s > 0 ? 0 : 1, at = z + Wt / 2 - n * (w + gap);
  segText(p, full[n], { ...o, align: 'left', at: [X(x1 + 0.025), 2.1, Z(at)], rot: [0, PI / 2, 0], look: 'white' });
}
export const DOOR_VARIANTS = LOAD.slots.slice().sort().flatMap((k) => ['north', 'south'].map((side) => side + ' 0' + (k + 1)));

export const STORE_PIECES = {
  storeHall: { name: 'Cargo (the hall)', group: 'Cargo', at: 'cell', variants: ['shell'], foot: [32, 3.75, 46], build: storeHall },
  rack: { name: 'Shelving', group: 'Cargo', at: 'free', variants: ['bays 1', 'bays 3', 'bays 5'], accepts: (v) => /^bays \d+$/.test(v), foot: [13.6, 3.3, 1.1], build: rack },
  pallet: { name: 'Pallet', group: 'Cargo', at: 'free', variants: PALLET_LOADS, foot: [1.2, 1.1, 1], build: pallet },
  scale: { name: 'Floor scale', group: 'Cargo', at: 'free', variants: ['platform'], foot: [3.4, 1.8, 3.4], build: scale },
  bench: { name: 'Packing bench', group: 'Cargo', at: 'free', variants: ['packing'], foot: [3.6, 1.4, 0.9], build: bench },
  shipDesk: { name: 'Shipping desk', group: 'Cargo', at: 'free', variants: ['desk'], foot: [3.6, 1.4, 0.8], build: shipDesk },
  containerDoor: { name: 'Container door', group: 'Cargo', at: 'free', variants: DOOR_VARIANTS, foot: [0.3, 2.6, 1.4], build: containerDoor },
  // the game's maker's own forklift (kit/forklift.js): a file of his, not cut by the kit, so it builds nothing here;
  // the Kit Lab fetches it and stands it on its stand (`model`), and in the station's Cargo in its painted place
  forklift: { name: 'Forklift', group: 'Cargo', at: 'free', variants: ['his model'], foot: [3.45, 2.1, 1.14], build: () => {}, model: 'forklift' },
};
export { textWidth, MeshData };
