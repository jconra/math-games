// THE MEDIC'S MED BAY: the gear the game's maker asked for on its walls (2026-11-10: "stuff all over the walls ... really
// shallow lockers and drawers and various medical stuff. Maybe a machine showing some x-rays/bones ... some lights on
// arms over the area where the beds are ... cargo strap weaved wall pockets with some equipment, maybe some to-go
// medkits, masks, maybe a hazmat suit or 2, or at least the mask ... Some oxygen tanks. Maybe a stretcher on the wall by
// one of the doors. An axe maybe? All the stuff you might see on a firetruck or ambulance."), drawn after his med bay
// picture (refs/ships/medic/medicalbay_2026-11-10.png: black strap-pouch panels under white labels, a red trauma bag, a
// vitals monitor, IV bags over pumps, a strapped stretcher bed, shallow drawers with lit handles) and his ambulance kit
// chart. Every piece is shallow (0.2 m or less off its wall), its corners cut at 45 degrees where it has free corners.
// Frames (kit/shipparts/cabin/ship.js): a WALL fitting stands on a wall line, x along the wall, y up from the deck, z out
// from the line (its back at the wall's face, FACE), facing +z; the parts placed at a given x and height take them in
// their options.
//   patientBed(p, o)    the bed, its head at the wall, running out along +z: a white built-in base with cut corners, lit
//                       strips down its sides and its number on its foot (o.label), and on it an ambulance stretcher
//                       docked (kit/shipparts/cabin/stretcher.js: yellow frame, black pads, its back raised o.back, a
//                       grey pillow, straps, black rails up). o.len (2.0, from the wall line), o.w (0.9, the base),
//                       o.padW (0.72, the stretcher), o.top (0.8, the pads' top)
//   armLamp(p, o)       a lamp on a jointed arm from the ceiling (a CEILING fitting: x, z as the room's, its mount at x 0,
//                       z 0, the ceiling at o.ceil): a plate, a drop, two arms with their joints, a yoke, the lamp's head
//                       with a glowing disc under it throwing a beam with dust (kit/shipparts/cabin/lights.js downlight).
//                       o.head [x, y, z]: where the head's middle is; o.drop: how far its beam goes
//   pouchPanel(p, o)    a black strap-webbing panel under a white label (o.label, segment lettering), rows of pockets with
//                       the things they hold showing over the straps (o.kind: what sort: 'airway', 'fluids', 'meds',
//                       'wound', 'diag', 'tools', 'resp', 'monitor', 'misc', 'masks', 'o2'). o.x, o.y0, o.w, o.h, o.rows
//   traumaBag(p, o)     the red TRAUMA bag with silver stripes, hung in the webbing. o.x, o.y0, o.w, o.h, o.d
//   o2Tank(p, o)        a green oxygen cylinder, white shoulder, valve and gauge, strapped to the wall. o.x, o.r, o.h
//   wallStretcher(p, o) a folding stretcher hung upright in two clips: yellow poles, black pad, straps. o.x, o.y0, o.y1, o.w
//   fireAxe(p, o)       a fire axe upright in two clips on a red-edged board. o.x, o.y0, o.len
//   extinguisher(p, o)  a small red fire extinguisher in its bracket. o.x, o.y0
//   defib(p, o)         the defibrillator on its bracket: its own small screen (a screen() of its own), a green trace,
//                       two paddles. o.x, o.y0
//   sharpsBin(p, o)     a red sharps bin, yellow lid, in a bracket. o.x, o.y0
//   spineBoard(p, o)    an orange spine board with its hand holds, three straps, on two brackets, lying along the wall.
//                       o.x, o.y0, o.len, o.w
//   hazmatLocker(p, o)  a shallow locker with a glass door: the yellow hazmat suit folded on its shelf, its hood and gloves,
//                       its boots; lit inside; HAZMAT over the door. o.x, o.w, o.h, o.d, o.cut [left, right]
//   xrayViewer(p, o)    a wall viewer showing two films as line drawings (a chest: spine, ribs, collar bones, shoulders,
//                       hips; a hand), its screen a screen() of its own, the drawing over it. o.x, o.y0, o.w, o.h
//   vitalsMonitor(p, o) the vital signs monitor: its own screen(), three traces and the numbers (72, 98, 14, 118/76)
//                       over it, on a wall plate. o.x, o.y (its middle), o.w, o.h
//   ivStation(p, o)     a rail with two infusion pumps and, over them, two IV bags on a hook bar, their lines down to the
//                       pumps. o.x, o.y0
//   bedHead(p, o)       the panel at a bed's head: oxygen, air and suction outlets, a flow meter, the teal pulse line.
//                       o.x, o.y0, o.w
//   wallCabinet(p, o)   a row of shallow lockers hung high on a wall: its plan's free corners cut, doors with lit
//                       handles, a light rail under it cut at 45 degrees with a strip on the cut. o.x0, o.x1, o.y0, o.y1,
//                       o.depth, o.cut [left, right], o.handle, o.trim
//   lines(p, pts, t, glow, z)  a glowing line through points ([x, y]) t wide on the plane z (a trace, a bone)
// The screens are each one screen() call (kit/shipparts/cabin/bits.js), so live screens can be given to them later; the
// drawings over them are glow lines in front, and can be left out then.
import * as THREE from 'three';
import { shape, solid, plate, relief, prism, add } from '../../bevel.js';
import { FACE } from './ship.js';
import { screen, glowStrip, FLAT } from './bits.js';
import { downlight } from './lights.js';
import { segText } from './segtext.js';
import { spun, aim } from './round.js';
import { placeInto, part } from '../place.js';
import { ambulanceStretcher } from './stretcher.js';
const r3 = (v) => +v.toFixed(3);

const PI = Math.PI;
// the looks: the webbing, the labels, the bag, the tanks, the stretcher, the bed
export const FABRIC = { c: '#1b1d20', r: 0.92, m: 0, w: 0.3 }, WEB = { c: '#2c2e32', r: 0.86, m: 0, w: 0.35 }, LABEL = { c: '#dcdcd6', r: 0.6, m: 0, w: 0.3 };
export const BAG = { c: '#a3231b', r: 0.7, m: 0, w: 0.35 }, TANK = { c: '#2e7a48', r: 0.42, m: 0.3, w: 0.4 }, SHOULDER = { c: '#e2e2dc', r: 0.45, m: 0.2, w: 0.3 };
export const BRIGHT_YELLOW = { c: '#e3b11c', r: 0.45, m: 0.03, w: 0.5 }, ORANGE = { c: '#e0601a', r: 0.5, m: 0, w: 0.4 }, MATTRESS = { c: '#3a3d43', r: 0.7, m: 0, w: 0.25 }, PILLOW = { c: '#a4a7ac', r: 0.85, m: 0, w: 0.2 };
export const PLASTIC = { c: '#d4e2e8', r: 0.18, m: 0, w: 0.1 }, DEVICE = { c: '#d8dad6', r: 0.45, m: 0.05, w: 0.3 }, CASE = { c: '#3a3d42', r: 0.5, m: 0.2, w: 0.4 };
const AMBER = { c: '#b8762a', r: 0.3, m: 0, w: 0.2 }, BLUE = { c: '#2f6fb3', r: 0.4, m: 0, w: 0.3 }, CLEAR = { c: '#aebfc6', r: 0.12, m: 0, w: 0.1 };
export const TRACE = { ecg: [0.45, 3.4, 1.1], spo2: [0.35, 2.4, 3.6], resp: [3.3, 2.7, 0.5], bp: [3.0, 3.0, 3.0], bone: [1.45, 1.85, 2.3], teal: [0.4, 4.6, 4.0] };
const box = (p, look, x0, x1, y0, y1, z0, z1) => p.slab(look, Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1), Math.min(z0, z1), Math.max(z0, z1), { r: 0, cell: 9, loops: [] });
// a chamfered block standing out of the wall from z0, its face w x h centred at (x, y)
const block = (p, look, x, y, w, h, z0, d, c = 0.02, edge = 0.006) => add(p, look, solid(shape(w, h, c, x, y), d, { edge, back: false }), [0, 0, z0]);
const cyl = (p, look, r, h, at, rot, seg = 8) => { const g = new THREE.CylinderGeometry(r, r, h, seg, 1); if (rot) g.rotateX(rot[0]).rotateY(rot[1]).rotateZ(rot[2]); g.translate(...at); return add(p, look, g); };

// ── a glowing line through points ───────────────────────────────────────────────────────────────────────────────
export function lines(p, pts, t, glow, z, at = [0, 0, 0], rot = [0, 0, 0]) {
  const g = lineGeo(pts, t, z);
  return g ? add(p, glow, g, at, rot, 'glow') : p;
}
// (the same line's geometry, for any material: a painted wire is one in 'solid')
export function lineGeo(pts, t, z) {
  const pos = [], idx = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay); if (L < 1e-6) continue;
    const nx = -(by - ay) / L * t / 2, ny = (bx - ax) / L * t / 2, ex = (bx - ax) / L * t * 0.35, ey = (by - ay) / L * t * 0.35, b0 = pos.length / 3;
    pos.push(ax - ex - nx, ay - ey - ny, z, bx + ex - nx, by + ey - ny, z, bx + ex + nx, by + ey + ny, z, ax - ex + nx, ay - ey + ny, z);
    idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3)); g.setIndex(idx);
  return g;
}

// ── the patient bed ─────────────────────────────────────────────────────────────────────────────────────────────
export function patientBed(p, o = {}) {
  const len = o.len ?? 2.0, w = o.w ?? 0.9, top = o.top ?? 0.8, hw = w / 2, z0 = FACE + 0.02, z1 = len - 0.04, pad = 0.12, bt = top - pad;
  // the base: a white built-in on a dark plinth set back, its foot corners cut at 45 degrees; a lit strip down each side
  // and its number on the foot end
  const bw = hw - 0.04, c = 0.12, ft = z1 - 0.12, cut = (b, e) => [[-b, z0], [b, z0], [b, e - c], [b - c, e], [-b + c, e], [-b, e - c]];
  add(p, 'white2', prism(cut(bw, ft).map(([x, z]) => [x, -z]), 0.1, bt - 0.03, { back: false }), [0, 0, 0], FLAT);
  add(p, 'dark', prism(cut(bw - 0.035, ft - 0.035).map(([x, z]) => [x, -z]), 0, 0.1, { front: false, back: false }), [0, 0, 0], FLAT);
  for (const sx of [-1, 1]) glowStrip(p, z1 - 0.12 - c - 0.25, [sx * (bw + 0.001), bt - 0.12, (z0 + z1 - 0.12 - c) / 2 + 0.05], [0, sx * PI / 2, 0], { wid: 0.012, glow: 'blue', i: 0.3, dir: [0, -0.5, 0.86], reach: 1.2, pool: 0.08, poolReach: 1.2 });
  glowStrip(p, 2 * bw - 2 * c - 0.04, [0, 0.05, z1 - 0.12 - 0.035], [0, 0, 0], { wid: 0.01, glow: 'blue', i: 0.25, dir: [0, -0.6, 0.8], reach: 1.0 });
  if (o.label) segText(p, o.label, { h: 0.045, at: [0, bt - 0.2, z1 - 0.12 + 0.001], look: 'dark' });
  // THE STRETCHER docked on it (kit/shipparts/cabin/stretcher.js, his stretcher picture; his med bay picture's bed is a
  // stretcher on a base): its yellow frame on the base's top, its head at the wall, its back section raised, a pillow,
  // its straps, its rails up
  placeInto(p, part(ambulanceStretcher, { len: r3(len - 0.2), w: o.padW ?? 0.72, frame: r3(bt - 0.02), legs: 'none', back: o.back ?? 0.3, pillow: true, straps: true }), { at: [0, 0, r3(z0 + (len - 0.2) / 2 + 0.02)] });
  return p;
}

// ── the lamp on an arm ──────────────────────────────────────────────────────────────────────────────────────────
export function armLamp(p, o = {}) {
  const ceil = o.ceil ?? 2.5, [hx, hy, hz] = o.head || [0.6, 2.0, 0], dropTo = o.drop ?? 1.2, G = 'black';
  // the plate on the ceiling, the drop to the first joint, the first arm out and down to the elbow, the second to the
  // yoke over the head
  add(p, 'gun', solid(shape(0.2, 0.2, 0.05), 0.02, { edge: 0.006 }), [0, ceil - 0.02, 0], [PI / 2, 0, 0]);
  const j0 = [0, ceil - 0.24, 0], el = [hx * 0.55, ceil - 0.3, hz * 0.55], yk = [hx, hy + 0.2, hz];
  cyl(p, G, 0.022, 0.22, [0, ceil - 0.13, 0], null, 8);
  cyl(p, 'gun', 0.04, 0.07, j0, null, 10);
  const arm = (a, b, r) => { const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(), g = new THREE.BoxGeometry(r, r, L); g.lookAt(d); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); add(p, 'white2', g); };
  arm(j0, el, 0.05); cyl(p, 'gun', 0.036, 0.07, el, null, 10); arm(el, yk, 0.04);
  // the yoke: down each side of the head to its pivots
  cyl(p, 'gun', 0.025, 0.05, yk, null, 8);
  box(p, G, hx - 0.2, hx + 0.2, hy + 0.17, hy + 0.2, hz - 0.015, hz + 0.015);
  for (const s of [-1, 1]) box(p, G, hx + s * 0.2 - 0.015, hx + s * 0.2 + 0.015, hy + 0.02, hy + 0.2, hz - 0.015, hz + 0.015);
  // the head: a shallow dome, its rim; under it the disc, throwing its beam down onto the bed
  add(p, 'white2', aim(spun([[0.19, 0.0], [0.185, 0.03], [0.15, 0.075], [0.08, 0.105], [0.001, 0.11]], { seg: 12, caps: [false, false] }), [hx, hy, hz]));
  add(p, 'black', aim(spun([[0.16, -0.014], [0.19, -0.012], [0.19, 0.0]], { seg: 12, caps: [false, false] }), [hx, hy, hz]));
  downlight(p, { at: [hx, hy - 0.012 + 0.022, hz], r: 0.13, i: o.i ?? 0.55, reach: 2.2, drop: dropTo, pool: o.pool ?? 0.45, poolDrop: 0.6, poolReach: 1.6, spread: 0.2, beam: o.beam ?? 0.8, color: [1, 0.98, 0.94] });
  return p;
}

// ── the strap-webbing pouch panels ──────────────────────────────────────────────────────────────────────────────
// what shows over a row's strap in each sort of panel: a list of [thing, look]; drawn in turn across the row
const RED = { c: '#b8352a', r: 0.6, m: 0, w: 0.3 }, GREEN = { c: '#3f8a4a', r: 0.6, m: 0, w: 0.3 };
const STOCK = {
  airway: [['bulb', BLUE], ['packet', PLASTIC], ['tube', 'white'], ['bag', PLASTIC]],
  fluids: [['bag', PLASTIC], ['tube', 'white'], ['bag', PLASTIC], ['packet', 'white']],
  meds: [['bottle', 'white'], ['bottle', AMBER], ['box', 'white'], ['bottle', 'white']],
  wound: [['packet', 'white'], ['roll', 'white'], ['packet', PLASTIC], ['roll', 'white']],
  diag: [['device', DEVICE], ['roll', CASE], ['tube', 'white'], ['box', BLUE]],
  tools: [['scissors', 'rail'], ['tube', 'rail'], ['scissors', 'rail'], ['packet', 'white']],
  resp: [['mask', 'white'], ['bulb', BLUE], ['mask', 'white'], ['tube', 'white']],
  monitor: [['device', DEVICE], ['roll', CASE], ['box', GREEN], ['tube', 'white']],
  misc: [['can', 'white'], ['packet', PLASTIC], ['bottle', AMBER], ['box', RED]],
  masks: [['mask', 'white'], ['mask', 'white'], ['mask', 'white'], ['mask', 'white']],
  o2: [['o2', TANK], ['o2', TANK], ['o2', TANK]],
};
function thing(p, kind, look, x, y, z) {
  if (kind === 'bottle') { cyl(p, look, 0.022, 0.1, [x, y + 0.05, z], null, 5); box(p, 'black', x - 0.012, x + 0.012, y + 0.1, y + 0.12, z - 0.004, z + 0.012); }
  else if (kind === 'packet') box(p, look, x - 0.03, x + 0.03, y, y + 0.13, z - 0.006, z + 0.006);
  else if (kind === 'box') box(p, look, x - 0.028, x + 0.028, y, y + 0.1, z - 0.018, z + 0.018);
  else if (kind === 'bag') { box(p, look, x - 0.032, x + 0.032, y, y + 0.16, z - 0.012, z + 0.012); box(p, BLUE, x - 0.024, x + 0.024, y + 0.09, y + 0.12, z + 0.012, z + 0.014); }
  else if (kind === 'tube') cyl(p, look, 0.009, 0.15, [x, y + 0.075, z], null, 5);
  else if (kind === 'roll') cyl(p, look, 0.03, 0.08, [x, y + 0.04, z], null, 6);
  else if (kind === 'device') { box(p, look, x - 0.04, x + 0.04, y, y + 0.12, z - 0.02, z + 0.02); box(p, 'dark', x - 0.028, x + 0.028, y + 0.07, y + 0.105, z + 0.02, z + 0.023); }
  else if (kind === 'scissors') { for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(0.012, 0.15, 0.006); g.rotateZ(s * 0.18); g.translate(x, y + 0.07, z); add(p, look, g); } box(p, 'black', x - 0.03, x + 0.03, y + 0.12, y + 0.16, z - 0.005, z + 0.005); }
  else if (kind === 'bulb') { cyl(p, look, 0.034, 0.11, [x, y + 0.055, z], null, 6); cyl(p, 'black', 0.02, 0.03, [x, y + 0.125, z], null, 5); }
  else if (kind === 'mask') { const g = new THREE.CylinderGeometry(0.02, 0.034, 0.04, 7, 1); g.rotateX(-PI / 2); g.scale(1, 1.25, 1); g.translate(x, y + 0.08, z + 0.02); add(p, look, g); box(p, 'black', x - 0.03, x + 0.03, y + 0.075, y + 0.085, z - 0.004, z + 0.004); }
  else if (kind === 'can') { cyl(p, look, 0.024, 0.13, [x, y + 0.065, z], null, 5); box(p, 'red', x - 0.01, x + 0.01, y + 0.13, y + 0.155, z - 0.01, z + 0.01); }
  else if (kind === 'o2') { cyl(p, look, 0.034, 0.2, [x, y + 0.1, z], null, 6); cyl(p, SHOULDER, 0.026, 0.04, [x, y + 0.215, z], null, 6); box(p, 'black', x - 0.01, x + 0.01, y + 0.235, y + 0.265, z - 0.01, z + 0.01); }
}
export function pouchPanel(p, o = {}) {
  const x = o.x ?? 0, y0 = o.y0 ?? 0.5, w = o.w ?? 0.4, h = o.h ?? 0.45, rows = o.rows ?? 2, lab = o.label ? 0.06 : 0, z = FACE + 0.006;
  // the black backing, its webbing: two straps up it, each row's strap across
  box(p, FABRIC, x - w / 2, x + w / 2, y0, y0 + h, FACE, FACE + 0.012);
  for (const s of [-1, 1]) box(p, WEB, x + s * w * 0.27 - 0.016, x + s * w * 0.27 + 0.016, y0 + 0.02, y0 + h - lab - 0.01, FACE + 0.012, FACE + 0.02);
  // the label: a white strip across its top, the word in dark segment lettering
  if (o.label) { box(p, LABEL, x - w / 2 + 0.025, x + w / 2 - 0.025, y0 + h - lab + 0.004, y0 + h - 0.012, FACE + 0.012, FACE + 0.02); segText(p, o.label, { h: 0.026, at: [x, y0 + h - lab / 2 - 0.004, FACE + 0.0205], look: 'black', gap: 0.007 }); }
  // the rows: the things packed in each pocket (each row starting further along the stock, so no two rows match), and
  // the pocket's strap in front of them, deep enough to tuck them in
  const S = STOCK[o.kind] || STOCK.misc, rh = (h - lab - 0.03) / rows, n = S.length;
  for (let r = 0; r < rows; r++) {
    const yb = y0 + 0.02 + r * rh, ys = yb + rh * 0.1;
    for (let i = 0; i < n; i++) { const [k, look] = S[(i + r * 2) % n]; thing(p, k, look, x - w / 2 + (i + 0.5) * w / n, ys + ((i * 7 + r * 3) % 4) * 0.008, z + 0.03); }
    box(p, WEB, x - w / 2 + 0.01, x + w / 2 - 0.01, ys - 0.005, ys + 0.075, FACE + 0.012, z + 0.058);
  }
  return p;
}

// ── the trauma bag ──────────────────────────────────────────────────────────────────────────────────────────────
export function traumaBag(p, o = {}) {
  const x = o.x ?? 0, y0 = o.y0 ?? 0.5, w = o.w ?? 0.34, h = o.h ?? 0.34, d = o.d ?? 0.14, z = FACE + 0.01, yc = y0 + h / 2;
  block(p, BAG, x, yc, w, h, z, d, 0.04, 0.02);
  // its front pocket, two silver reflective stripes round it, its straps and handle, TRAUMA on the pocket
  block(p, BAG, x, yc - 0.035, w - 0.07, h * 0.58, z + d, 0.035, 0.03, 0.01);
  for (const y of [y0 + 0.045, y0 + h - 0.06]) box(p, 'chrome', x - w / 2 + 0.01, x + w / 2 - 0.01, y, y + 0.022, z + d - 0.002, z + d + 0.004);
  for (const s of [-1, 1]) box(p, WEB, x + s * 0.09 - 0.017, x + s * 0.09 + 0.017, y0 + 0.01, y0 + h + 0.02, z + d + 0.004, z + d + 0.01);
  box(p, WEB, x - 0.08, x + 0.08, y0 + h - 0.01, y0 + h + 0.03, z + d * 0.4, z + d * 0.6);
  segText(p, 'TRAUMA', { h: 0.032, at: [x, yc - 0.03, z + d + 0.0355], look: 'white2', gap: 0.008 });
  return p;
}

// ── an oxygen tank ──────────────────────────────────────────────────────────────────────────────────────────────
export function o2Tank(p, o = {}) {
  const x = o.x ?? 0, r = o.r ?? 0.09, h = o.h ?? 1.0, z = FACE + 0.015 + r, at = [x, 0, z];
  add(p, TANK, spun([[0.001, 0.01], [r * 0.9, 0.01], [r, 0.04], [r, h - 0.2]], { seg: 6, caps: [false, false] }), at);
  add(p, SHOULDER, spun([[r, h - 0.2], [r, h - 0.13], [r * 0.7, h - 0.05], [0.028, h - 0.015], [0.028, h]], { seg: 6, caps: [false, true] }), at);
  // the valve, its handwheel and the gauge facing out
  cyl(p, 'black', 0.022, 0.07, [x, h + 0.035, z], null, 6);
  cyl(p, 'rail', 0.03, 0.012, [x, h + 0.075, z], null, 8);
  cyl(p, 'white', 0.028, 0.02, [x, h + 0.03, z + 0.04], [PI / 2, 0, 0], 8);
  // its strap to the wall: a band round it, a plate on the wall
  add(p, 'yellow', spun([[r + 0.006, h * 0.62], [r + 0.006, h * 0.62 + 0.045]], { seg: 6, caps: [false, false] }), at);
  box(p, 'rail', x - 0.07, x + 0.07, h * 0.62 - 0.01, h * 0.62 + 0.055, FACE, FACE + 0.015);
  segText(p, 'O2', { h: 0.06, at: [x, h * 0.42, z + r + 0.002], look: 'white2', gap: 0.012 });
  return p;
}

// ── the stretcher on the wall ───────────────────────────────────────────────────────────────────────────────────
export function wallStretcher(p, o = {}) {
  const x = o.x ?? 0, y0 = o.y0 ?? 0.15, y1 = o.y1 ?? 2.08, w = o.w ?? 0.5, z = FACE + 0.03;
  for (const s of [-1, 1]) {
    const px = x + s * (w / 2 - 0.022);
    box(p, BRIGHT_YELLOW, px - 0.02, px + 0.02, y0, y1, z, z + 0.04);
    for (const y of [y0, y1 - 0.12]) box(p, 'black', px - 0.024, px + 0.024, y, y + 0.12, z - 0.002, z + 0.042);
  }
  box(p, MATTRESS, x - w / 2 + 0.04, x + w / 2 - 0.04, y0 + 0.16, y1 - 0.16, z + 0.005, z + 0.045);
  for (const y of [y0 + 0.5, (y0 + y1) / 2, y1 - 0.5]) { box(p, WEB, x - w / 2 + 0.03, x + w / 2 - 0.03, y - 0.025, y + 0.025, z + 0.045, z + 0.05); box(p, 'rail', x + w / 2 - 0.14, x + w / 2 - 0.08, y - 0.03, y + 0.03, z + 0.05, z + 0.056); }
  // the two clips holding it to the wall, and a hook bar over its top with its two hooks (light metal)
  for (const y of [y0 + 0.3, y1 - 0.3]) box(p, 'rail', x - w / 2 - 0.02, x + w / 2 + 0.02, y - 0.03, y + 0.03, FACE, z + 0.052);
  box(p, 'rail', x - w / 2 + 0.02, x + w / 2 - 0.02, y1 + 0.02, y1 + 0.05, FACE, FACE + 0.03);
  for (const s of [-1, 1]) box(p, 'rail', x + s * (w / 2 - 0.05) - 0.012, x + s * (w / 2 - 0.05) + 0.012, y1 - 0.04, y1 + 0.05, FACE + 0.02, z + 0.03);
  return p;
}

// ── the fire axe ────────────────────────────────────────────────────────────────────────────────────────────────
export function fireAxe(p, o = {}) {
  const x = o.x ?? 0, y0 = o.y0 ?? 0.9, len = o.len ?? 0.9, z = FACE + 0.012;
  box(p, 'red', x - 0.12, x + 0.12, y0 - 0.05, y0 + len + 0.05, FACE, FACE + 0.006);
  box(p, 'white2', x - 0.1, x + 0.1, y0 - 0.03, y0 + len + 0.03, FACE + 0.006, FACE + 0.01);
  // the handle (yellow), its grip (black), the head at the top: a red blade and a pick, the blade's edge bright
  box(p, BRIGHT_YELLOW, x - 0.016, x + 0.016, y0, y0 + len - 0.05, z + 0.01, z + 0.035);
  box(p, 'black', x - 0.019, x + 0.019, y0, y0 + 0.2, z + 0.008, z + 0.037);
  const yh = y0 + len - 0.1, head = [[-0.02, -0.04], [0.11, -0.07], [0.12, 0.07], [-0.02, 0.05], [-0.1, 0.01], [-0.1, -0.005]];
  add(p, 'red', prism(head.map(([a, b]) => [x + a, yh + b]), z + 0.012, z + 0.033), [0, 0, 0]);
  add(p, 'chrome', prism([[0.1, -0.068], [0.125, -0.072], [0.135, 0.072], [0.11, 0.07]].map(([a, b]) => [x + a, yh + b]), z + 0.014, z + 0.031), [0, 0, 0]);
  for (const y of [y0 + 0.25, y0 + len - 0.25]) box(p, 'gun', x - 0.04, x + 0.04, y - 0.02, y + 0.02, FACE + 0.01, z + 0.04);
  return p;
}

// ── the extinguisher ────────────────────────────────────────────────────────────────────────────────────────────
export function extinguisher(p, o = {}) {
  const x = o.x ?? 0, y0 = o.y0 ?? 0.1, r = 0.06, h = 0.42, z = FACE + 0.015 + r, at = [x, y0, z];
  box(p, 'black', x - 0.045, x + 0.045, y0 + 0.05, y0 + h - 0.05, FACE, FACE + 0.014);
  add(p, 'red', spun([[0.001, 0], [r * 0.9, 0], [r, 0.03], [r, h - 0.07], [r * 0.7, h - 0.02], [0.02, h]], { seg: 9, caps: [true, true] }), at);
  cyl(p, 'black', 0.016, 0.05, [x, y0 + h + 0.02, z], null, 6);
  box(p, 'black', x - 0.012, x + 0.012, y0 + h + 0.03, y0 + h + 0.05, z, z + 0.1);
  box(p, 'black', x + r - 0.005, x + r + 0.012, y0 + 0.12, y0 + h, z - 0.01, z + 0.006);
  box(p, 'black', x - r - 0.004, x + r + 0.004, y0 + 0.2, y0 + 0.24, FACE + 0.01, z + r + 0.004);
  return p;
}

// ── the defibrillator ───────────────────────────────────────────────────────────────────────────────────────────
export function defib(p, o = {}) {
  const x = o.x ?? 0, y0 = o.y0 ?? 1.05, w = 0.32, h = 0.26, d = 0.13, z = FACE + 0.015, yc = y0 + h / 2;
  box(p, 'black', x - w / 2 - 0.02, x + w / 2 + 0.02, y0 - 0.03, y0 + 0.01, FACE, z + d * 0.6);
  block(p, CASE, x, yc, w, h, z, d, 0.03, 0.012);
  // a yellow handle over it and a yellow band round its face; its small screen with the green trace; its buttons; the
  // two paddles in their cups either side
  box(p, BRIGHT_YELLOW, x - 0.09, x + 0.09, y0 + h + 0.005, y0 + h + 0.03, z + d * 0.3, z + d * 0.7);
  box(p, BRIGHT_YELLOW, x - w / 2 + 0.015, x + w / 2 - 0.015, y0 + 0.02, y0 + 0.045, z + d, z + d + 0.004);
  screen(p, { w: 0.13, h: 0.085, live: 'rest', seed: o.seed ?? 0.6, bezel: 0.012, depth: 0.008 }, [x - 0.05, yc + 0.03, z + d]);
  segText(p, 'DEFIB', { h: 0.022, at: [x + 0.085, yc + 0.06, z + d + 0.001], look: 'white2', gap: 0.005 });
  for (let i = 0; i < 3; i++) box(p, i === 0 ? 'red' : 'grey', x + 0.05 + i * 0.03 - 0.011, x + 0.05 + i * 0.03 + 0.011, yc - 0.005, yc + 0.017, z + d, z + d + 0.008);
  for (const s of [-1, 1]) { const px = x + s * (w / 2 + 0.035); box(p, 'white2', px - 0.03, px + 0.03, yc - 0.07, yc + 0.03, z + 0.03, z + 0.09); box(p, BRIGHT_YELLOW, px - 0.015, px + 0.015, yc + 0.03, yc + 0.08, z + 0.045, z + 0.075); }
  return p;
}

// ── the sharps bin ──────────────────────────────────────────────────────────────────────────────────────────────
export function sharpsBin(p, o = {}) {
  const x = o.x ?? 0, y0 = o.y0 ?? 1.0, z = FACE + 0.012;
  box(p, 'black', x - 0.09, x + 0.09, y0 - 0.02, y0 + 0.02, FACE, z + 0.12);
  box(p, 'red', x - 0.08, x + 0.08, y0, y0 + 0.2, z, z + 0.11);
  box(p, BRIGHT_YELLOW, x - 0.083, x + 0.083, y0 + 0.2, y0 + 0.235, z - 0.003, z + 0.113);
  box(p, 'black', x - 0.04, x + 0.04, y0 + 0.235, y0 + 0.238, z + 0.03, z + 0.08);
  return p;
}

// ── the spine board ─────────────────────────────────────────────────────────────────────────────────────────────
export function spineBoard(p, o = {}) {
  const x = o.x ?? 0, y0 = o.y0 ?? 1.5, L = o.len ?? 1.8, W = o.w ?? 0.42, z = FACE + 0.03, c = 0.1, yc = y0 + W / 2, hl = L / 2, hw = W / 2;
  const out = [[-hl + c, -hw], [hl - c, -hw], [hl, -hw + c], [hl, hw - c], [hl - c, hw], [-hl + c, hw], [-hl, hw - c], [-hl, -hw + c]].map(([a, b]) => [x + a, yc + b]);
  // (its hand holds: slots along both long edges and one in each end)
  const holes = [];
  for (let k = 0; k < 5; k++) for (const s of [-1, 1]) { const a = -hl + 0.25 + k * (L - 0.5) / 4, b = s * (hw - 0.06); holes.push([[a - 0.06, b - 0.022], [a + 0.06, b - 0.022], [a + 0.06, b + 0.022], [a - 0.06, b + 0.022]].map(([u, v]) => [x + u, yc + v])); }
  for (const s of [-1, 1]) { const a = s * (hl - 0.07); holes.push([[a - 0.022, -0.07], [a + 0.022, -0.07], [a + 0.022, 0.07], [a - 0.022, 0.07]].map(([u, v]) => [x + u, yc + v])); }
  add(p, ORANGE, prism(out, z, z + 0.035, { holes }), [0, 0, 0]);
  for (const a of [-0.45, 0.1, 0.6]) { box(p, 'black', x + a - 0.025, x + a + 0.025, y0 - 0.006, y0 + W + 0.006, z + 0.035, z + 0.04); box(p, BRIGHT_YELLOW, x + a - 0.03, x + a + 0.03, yc - 0.03, yc + 0.03, z + 0.04, z + 0.046); }
  for (const s of [-1, 1]) box(p, 'gun', x + s * (hl - 0.3) - 0.04, x + s * (hl - 0.3) + 0.04, y0 - 0.03, y0 + 0.02, FACE, z + 0.04);
  return p;
}

// ── the hazmat locker ───────────────────────────────────────────────────────────────────────────────────────────
export function hazmatLocker(p, o = {}) {
  const x = o.x ?? 0, w = o.w ?? 0.58, h = o.h ?? 2.1, d = o.d ?? 0.24, [cl, cr] = o.cut || [0, 0], base = 0.08, x0 = x - w / 2, x1 = x + w / 2;
  // the body: its plan's free front corners cut at 45 degrees; a dark plinth set back; a dark inside behind the glass
  const plan = (set = 0) => { const zf = d - set; const P = [[x0, FACE], [x1, FACE]]; if (cr) P.push([x1, zf - cr], [x1 - cr, zf]); else P.push([x1, zf]); if (cl) P.push([x0 + cl, zf], [x0, zf - cl]); else P.push([x0, zf]); return P.map(([a, b]) => [a, -b]); };
  add(p, 'white', prism(plan(), base, h, { back: false }), [0, 0, 0], FLAT);
  add(p, 'dark', prism(plan(0.035), 0, base, { front: false, back: false }), [0, 0, 0], FLAT);
  const gx0 = x0 + Math.max(cl, 0.04) + 0.02, gx1 = x1 - Math.max(cr, 0.04) - 0.02, gy0 = base + 0.08, gy1 = h - 0.2, zf = d + 0.001;
  box(p, 'dark', gx0, gx1, gy0, gy1, zf - 0.004, zf);
  // inside (seen through the glass, drawn on the dark): three shelves; the suit folded on the middle one (yellow, a white
  // zip strip, its yellow gloves on top), its hood on the top one with its clear visor, its boots on the bottom
  const sx = (gx0 + gx1) / 2, sw = gx1 - gx0, zi = zf + 0.003;
  for (const y of [gy0 + 0.42, gy0 + 0.95, gy0 + 1.4]) box(p, 'white2', gx0, gx1, y - 0.012, y, zi, zi + 0.012);
  const Y = { c: '#d9b21c', r: 0.75, m: 0, w: 0.3 }, Y2 = { c: '#b8951a', r: 0.75, m: 0, w: 0.3 };
  box(p, Y, sx - sw * 0.38, sx + sw * 0.38, gy0 + 0.95, gy0 + 1.08, zi, zi + 0.012); box(p, Y2, sx - sw * 0.36, sx + sw * 0.36, gy0 + 1.08, gy0 + 1.14, zi, zi + 0.012);
  box(p, Y, sx - sw * 0.34, sx + sw * 0.34, gy0 + 1.14, gy0 + 1.25, zi, zi + 0.012);
  box(p, 'white2', sx - 0.012, sx + 0.012, gy0 + 0.97, gy0 + 1.24, zi + 0.012, zi + 0.014);
  for (const s of [-1, 1]) box(p, Y2, sx + s * 0.07 - 0.04, sx + s * 0.07 + 0.04, gy0 + 1.25, gy0 + 1.29, zi, zi + 0.012);
  box(p, Y, sx - sw * 0.3, sx + sw * 0.3, gy0 + 1.4, gy0 + 1.6, zi, zi + 0.012); box(p, CLEAR, sx - sw * 0.18, sx + sw * 0.18, gy0 + 1.45, gy0 + 1.56, zi + 0.012, zi + 0.014);
  for (const s of [-1, 1]) { box(p, Y, sx + s * 0.07 - 0.05, sx + s * 0.07 + 0.05, gy0 + 0.42, gy0 + 0.66, zi, zi + 0.012); box(p, 'black', sx + s * 0.07 - 0.055, sx + s * 0.07 + 0.055, gy0 + 0.42, gy0 + 0.46, zi, zi + 0.014); }
  // the light along the inside's top, then the glass door in its dark frame, its handle, HAZMAT over it
  glowStrip(p, sw - 0.06, [sx, gy1 - 0.02, zi + 0.004], [0, 0, 0], { wid: 0.01, i: 0.14, dir: [0, -0.7, 0.7], reach: 1.2 });
  for (const [a0, a1, b0, b1] of [[gx0 - 0.02, gx1 + 0.02, gy0 - 0.02, gy0], [gx0 - 0.02, gx1 + 0.02, gy1, gy1 + 0.02], [gx0 - 0.02, gx0, gy0, gy1], [gx1, gx1 + 0.02, gy0, gy1]]) box(p, 'black', a0, a1, b0, b1, zf, zf + 0.014);
  p.glass(gx1 - gx0, gy1 - gy0, [sx, (gy0 + gy1) / 2, zf + 0.008]);
  glints(p, gx0, gx1, gy0, gy1, zf + 0.0095);
  box(p, 'black', gx1 - 0.05, gx1 - 0.03, 0.95, 1.15, zf + 0.012, zf + 0.03);
  box(p, LABEL, gx0, gx1, gy1 + 0.04, gy1 + 0.11, d - 0.004, d + 0.002);
  segText(p, 'HAZMAT', { h: 0.034, at: [sx, gy1 + 0.075, d + 0.0025], look: 'black', gap: 0.009 });
  return p;
}

// two pale streaks across a pane of glass (a reflection's glint, so the glass reads as glass)
export function glints(p, x0, x1, y0, y1, z) {
  const w = x1 - x0, h = y1 - y0;
  for (const [a, b, t] of [[0.15, 0.55, 0.012], [0.32, 0.62, 0.005]]) { const g = lineGeo([[x0 + w * a, y0 + h * (b + 0.25)], [x0 + w * (a + 0.4), y0 + h * b]], t, z); if (g) add(p, { c: '#d6e2e8', r: 0.1, m: 0.3, w: 0.05 }, g); }
}

// ── the x-ray viewer ────────────────────────────────────────────────────────────────────────────────────────────
const arc = (cx, cy, rx, ry, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
export function xrayViewer(p, o = {}) {
  const x = o.x ?? 0, y0 = o.y0 ?? 1.1, w = o.w ?? 0.8, h = o.h ?? 0.62, z = FACE, yc = y0 + h / 2 + 0.03;
  // the housing: a pale box with cut corners, a control strip under the screen (three lit buttons, X-RAY)
  add(p, 'white2', solid(shape(w + 0.08, h + 0.14, 0.05, x, yc - 0.03), 0.07, { edge: 0.012, back: false }), [0, 0, z]);
  const sw = w - 0.02, sh = h - 0.06, fz = z + 0.07;
  // (its screen still and nearly black, the films drawn over it: no live programme draws bones)
  screen(p, { w: sw, h: sh, rect: 'radar', sub: [0.05, 0.08, 0.11, 0.18], gain: 0.25, bezel: 0.014, depth: 0.01, oct: 0.02 }, [x, yc, fz]);
  for (let i = 0; i < 3; i++) add(p, i === 2 ? [0.4, 3.0, 1.2] : [1.6, 1.8, 2.0], plate(shape(0.022, 0.012, 0.004, x + sw / 2 - 0.1 + i * 0.035, y0 - 0.005)), [0, 0, fz + 0.001], null, 'glow');
  segText(p, 'X-RAY', { h: 0.024, at: [x - sw / 2 + 0.06, y0 - 0.005, fz + 0.001], look: 'dark', gap: 0.006 });
  // THE FILMS, drawn in pale lines over the screen: a film's edge each, a chest on the left (the spine, seven pairs of
  // ribs, the collar bones, the tops of the arms, the hips' crests) and a hand on the right (wrist, palm bones, fingers)
  const L = (pts, t = 0.006) => lines(p, pts, t, TRACE.bone, fz + 0.0112, [x, yc, 0]);
  const cw = sw * 0.58, cx = -sw / 2 + cw / 2 + 0.01, hx = sw / 2 - (sw - cw) / 2 + 0.005, fh = sh - 0.05;
  for (const [fx, fw] of [[cx, cw - 0.03], [hx, sw - cw - 0.04]]) L([[fx - fw / 2, -fh / 2], [fx + fw / 2, -fh / 2], [fx + fw / 2, fh / 2], [fx - fw / 2, fh / 2], [fx - fw / 2, -fh / 2]], 0.003);
  const sy0 = -fh / 2 + 0.09, sy1 = fh / 2 - 0.03;
  for (let k = 0; k < 11; k++) { const y = sy1 - (k + 0.5) * (sy1 - sy0) / 11; L([[cx - 0.012, y], [cx + 0.012, y]], 0.016); }
  for (let k = 0; k < 7; k++) {
    const y = sy1 - 0.07 - k * 0.04, span = Math.min(0.17, 0.11 + k * 0.012);
    for (const s of [-1, 1]) L([[cx + s * 0.016, y], [cx + s * span * 0.4, y + 0.012], [cx + s * span * 0.75, y + 0.002], [cx + s * span * 0.95, y - 0.025], [cx + s * span, y - 0.055]], 0.006);
  }
  for (const s of [-1, 1]) {
    L([[cx + s * 0.02, sy1 - 0.035], [cx + s * 0.09, sy1 - 0.025], [cx + s * 0.16, sy1 - 0.04]], 0.008);
    L(arc(cx + s * 0.19, sy1 - 0.075, 0.03, 0.035, 0, 2 * PI, 7), 0.006);
    L([[cx + s * 0.2, sy1 - 0.11], [cx + s * 0.215, sy0 + 0.04]], 0.012);
    L([[cx + s * 0.02, sy0 - 0.035], [cx + s * 0.06, sy0 + 0.015], [cx + s * 0.12, sy0 + 0.02], [cx + s * 0.15, sy0 - 0.015], [cx + s * 0.13, sy0 - 0.06]], 0.008);
  }
  // the hand: the wrist's small bones, five palm bones fanning up, the fingers' bones in three (the thumb's two)
  const wy = -fh / 2 + 0.07;
  for (let k = 0; k < 4; k++) L([[hx - 0.04 + k * 0.026, wy], [hx - 0.03 + k * 0.026, wy + 0.012]], 0.014);
  [[150, [0.05, 0.04, 0.03]], [100, [0.08, 0.045, 0.03, 0.022]], [90, [0.085, 0.05, 0.033, 0.024]], [80, [0.08, 0.046, 0.03, 0.022]], [68, [0.07, 0.035, 0.024, 0.02]]].forEach(([deg, bones]) => {
    const a = deg * PI / 180, ux = Math.cos(a), uy = Math.sin(a);
    let px = hx + ux * 0.03, py = wy + 0.03 + uy * 0.015;
    for (const l of bones) { const qx = px + ux * l, qy = py + uy * l; L([[px, py], [qx, qy]], 0.008); px = qx + ux * 0.008; py = qy + uy * 0.008; }
  });
  return p;
}

// ── the vital signs monitor ─────────────────────────────────────────────────────────────────────────────────────
export function vitalsMonitor(p, o = {}) {
  const x = o.x ?? 0, y = o.y ?? 1.6, w = o.w ?? 0.5, h = o.h ?? 0.32, z = FACE + 0.04;
  // its wall plate and arm, then the monitor's own screen (a screen() of its own) in its bezel
  box(p, 'black', x - 0.07, x + 0.07, y - 0.08, y + 0.08, FACE, FACE + 0.02);
  box(p, 'gun', x - 0.025, x + 0.025, y - 0.025, y + 0.025, FACE + 0.02, z);
  block(p, 'black', x, y, w + 0.05, h + 0.06, z, 0.035, 0.02, 0.008);
  const fz = z + 0.035;
  // (o.live: a live programme, kit/shipparts/cabin/live.js ('rest': the heartbeat sweeping across, the breathing, the
  // rate), and nothing drawn over it; else a still screen with the traces and numbers below drawn over it)
  screen(p, o.live ? { w, h, live: o.live, seed: o.seed ?? 0, bezel: 0.01, depth: 0.006, oct: 0.012 } : { w, h, rect: 'status', gain: 0.08, bezel: 0.01, depth: 0.006, oct: 0.012 }, [x, y, fz]);
  if (o.live) return p;
  // three traces across its left: the heartbeat (green), the oxygen wave (cyan), the breathing (yellow); the numbers on
  // its right: 72 the heart rate, 98 the oxygen, 14 the breaths, 118/76 the blood pressure (white)
  const tz = fz + 0.0075, L = (pts, c) => lines(p, pts, 0.0045, c, tz, [x, y, 0]), tw = w * 0.62, tx0 = -w / 2 + 0.02;
  const ecg = []; for (let b = 0; b < 3; b++) { const bx = tx0 + b * tw / 3; ecg.push([bx, 0], [bx + 0.03, 0], [bx + 0.04, 0.01], [bx + 0.05, 0], [bx + 0.06, -0.012], [bx + 0.068, 0.05], [bx + 0.076, -0.02], [bx + 0.085, 0], [bx + 0.1, 0.012], [bx + 0.11, 0]); }
  ecg.push([tx0 + tw, 0]); L(ecg.map(([a, b]) => [a, b + h * 0.24]), TRACE.ecg);
  const sp = []; for (let k = 0; k <= 18; k++) { const t = k / 18; sp.push([tx0 + t * tw, Math.max(0, Math.sin(t * PI * 6)) ** 1.6 * 0.035 - 0.01]); } L(sp, TRACE.spo2);
  const rs = []; for (let k = 0; k <= 12; k++) { const t = k / 12; rs.push([tx0 + t * tw, Math.sin(t * PI * 3) * 0.018 - h * 0.27]); } L(rs, TRACE.resp);
  const nx = w / 2 - 0.07;
  segText(p, '72', { h: 0.05, at: [x + nx, y + h * 0.27, tz], look: TRACE.ecg, mat: 'glow', t: 0.008 });
  segText(p, '98', { h: 0.04, at: [x + nx, y + 0.005, tz], look: TRACE.spo2, mat: 'glow', t: 0.007 });
  segText(p, '14', { h: 0.035, at: [x + nx, y - h * 0.24, tz], look: TRACE.resp, mat: 'glow', t: 0.006 });
  segText(p, '118/76', { h: 0.026, at: [x - w / 2 + 0.1, y - h / 2 + 0.03, tz], look: TRACE.bp, mat: 'glow', t: 0.005, gap: 0.006 });
  return p;
}

// ── the IV bags and pumps ───────────────────────────────────────────────────────────────────────────────────────
export function ivStation(p, o = {}) {
  const x = o.x ?? 0, y0 = o.y0 ?? 1.0, top = o.top ?? 2.0, z = FACE + 0.02;
  // the rail up the wall on two brackets, the hook bar across its top
  for (const y of [y0 + 0.05, top - 0.08]) box(p, 'black', x - 0.03, x + 0.03, y - 0.025, y + 0.025, FACE, z + 0.01);
  box(p, 'rail', x - 0.012, x + 0.012, y0, top, z, z + 0.024);
  box(p, 'rail', x - 0.14, x + 0.14, top - 0.012, top + 0.012, z + 0.01, z + 0.03);
  // two bags hung from it, their drip chambers and lines down to the two pumps clamped on the rail
  for (const s of [-1, 1]) {
    const bx = x + s * 0.085;
    box(p, 'rail', bx - 0.004, bx + 0.004, top - 0.05, top, z + 0.016, z + 0.024);
    box(p, PLASTIC, bx - 0.045, bx + 0.045, top - 0.22, top - 0.05, z + 0.006, z + 0.03);
    box(p, BLUE, bx - 0.03, bx + 0.03, top - 0.12, top - 0.09, z + 0.03, z + 0.032);
    cyl(p, CLEAR, 0.008, 0.04, [bx, top - 0.245, z + 0.018], null, 6);
    box(p, CLEAR, bx - 0.002, bx + 0.002, y0 + 0.42, top - 0.265, z + 0.016, z + 0.02);
  }
  for (const [k, y] of [[0, y0 + 0.2], [1, y0 + 0.42]]) {
    block(p, DEVICE, x, y, 0.13, 0.17, z + 0.02, 0.08, 0.015, 0.006);
    add(p, [0.4, 2.2, 3.0], plate(shape(0.08, 0.04, 0.006, x, y + 0.035)), [0, 0, z + 0.101], null, 'glow');
    add(p, k ? [3.2, 0.5, 0.3] : [0.4, 3.2, 1.0], plate(shape(0.012, 0.012, 0.003, x + 0.045, y - 0.05)), [0, 0, z + 0.101], null, 'glow');
    box(p, 'dark', x - 0.05, x + 0.02, y - 0.065, y - 0.035, z + 0.1, z + 0.103);
  }
  return p;
}

// ── a bed's head panel ──────────────────────────────────────────────────────────────────────────────────────────
export function bedHead(p, o = {}) {
  const x = o.x ?? 0, y0 = o.y0 ?? 0.92, w = o.w ?? 0.6, h = 0.24, z = FACE + 0.035;
  add(p, 'white2', solid(shape(w, h, 0.03, x, y0 + h / 2), 0.035, { edge: 0.008, back: false }), [0, 0, FACE]);
  // oxygen (green), air (black and white), suction (yellow): a ring and a socket each; a flow meter on the oxygen
  [[TANK, -0.2], ['black', -0.08], [BRIGHT_YELLOW, 0.04]].forEach(([look, dx]) => { cyl(p, look, 0.026, 0.02, [x + dx, y0 + 0.09, z + 0.01], [PI / 2, 0, 0], 8); cyl(p, 'dark', 0.012, 0.022, [x + dx, y0 + 0.09, z + 0.012], [PI / 2, 0, 0], 6); });
  box(p, CLEAR, x - 0.215, x - 0.185, y0 + 0.12, y0 + 0.21, z + 0.01, z + 0.035); box(p, 'white', x - 0.207, x - 0.193, y0 + 0.16, y0 + 0.174, z + 0.02, z + 0.03);
  // a small lit switch for the reading light, and the teal pulse line along its top
  add(p, [0.4, 2.0, 3.2], plate(shape(0.018, 0.018, 0.004, x + 0.18, y0 + 0.09)), [0, 0, z + 0.001], null, 'glow');
  const k = 0.17; lines(p, [[-k, 0], [-0.04, 0], [-0.03, 0.012], [-0.02, -0.018], [-0.008, 0.035], [0.004, -0.012], [0.016, 0], [k, 0]], 0.005, TRACE.teal, z + 0.001, [x + 0.05, y0 + h - 0.045, 0]);
  return p;
}

// ── shallow lockers hung high on a wall ─────────────────────────────────────────────────────────────────────────
export function wallCabinet(p, o = {}) {
  const x0 = o.x0 ?? -0.5, x1 = o.x1 ?? 0.5, y0 = o.y0 ?? 1.95, y1 = o.y1 ?? 2.45, d = o.depth ?? 0.2, [cl, cr] = o.cut || [0, 0], cols = o.cols ?? Math.max(1, Math.round((x1 - x0) / 0.45));
  const P = [[x0, FACE], [x1, FACE]]; if (cr) P.push([x1, d - cr], [x1 - cr, d]); else P.push([x1, d]); if (cl) P.push([x0 + cl, d], [x0, d - cl]); else P.push([x0, d]);
  add(p, 'white', prism(P.map(([a, b]) => [a, -b]), y0 + 0.04, y1, {}), [0, 0, 0], FLAT);
  // the rail under it: its front underside cut at 45 degrees, the strip on the cut shining down the wall and what is
  // under it
  const fx0 = x0 + cl, fx1 = x1 - cr;
  add(p, o.trim || 'black', prism([[FACE, y0 + 0.04], [FACE, y0], [d - 0.035, y0], [d + 0.004, y0 + 0.039], [d + 0.004, y0 + 0.04]].map(([a, b]) => [-a, b]), fx0 + 0.01, fx1 - 0.01), [0, 0, 0], [0, PI / 2, 0]);
  glowStrip(p, fx1 - fx0 - 0.08, [(fx0 + fx1) / 2, y0 + 0.0195 - 0.0009, d - 0.0155 + 0.0009], [PI / 4, 0, 0], { wid: 0.012, i: o.light ?? 0.22, dir: [0, -0.8, 0.6], reach: 1.6, pool: o.pool ?? 0.06, poolAt: [(fx0 + fx1) / 2, y0 - 0.5, d + 0.25] });
  // the doors on its face, raised, each with its handle slot and a small blue light
  const dw = (fx1 - fx0 - 0.016) / cols;
  for (let c = 0; c < cols; c++) {
    const cx = fx0 + 0.008 + dw * (c + 0.5), dy0 = y0 + 0.055, dy1 = y1 - 0.02;
    add(p, 'white2', relief(shape(dw - 0.016, dy1 - dy0, Math.min(0.025, dw * 0.1), cx, (dy0 + dy1) / 2), [{ inset: 0, depth: 0.006, bevel: 0.005 }, { inset: 0.025, depth: 0.003, bevel: 0.004 }]), [0, 0, d + 0.001]);
    add(p, o.handle || 'black', plate(shape(Math.min(0.14, dw * 0.45), 0.022, 0.008, cx, dy0 + 0.045)), [0, 0, d + 0.0075]);
    add(p, 'blue', plate(shape(0.03, 0.006, 0.002, cx, dy0 + 0.065)), [0, 0, d + 0.0078], null, 'glow');
  }
  return p;
}
