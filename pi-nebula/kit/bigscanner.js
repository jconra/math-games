// THE MEDICAL CENTRE'S BIG SCANNER: the game's maker's pick from the option sheet ("I like the slim ring. It might be
// cool if it could slide on rails like the arch"): a slim tall hoop with a wide opening and a band of light that turns
// inside it, standing on a carriage that rides two floor rails and glides slowly along the bed and back, as a scan.
// Sized like a real one: the hoop 2.4 m across (2.45 m to its top), the bed about 3 m long in front of the parked hoop.
//
//   bigscanner   a POINT piece: its back on the scanner room's back wall (z = 0 is the wall's face), the bed running
//                out along +z toward the way in, x across the room. 'slim ring'.
//
// What stands still (part of its room, lit and walked round like any furniture): the bed (a board and its keel on a
// stand at the wall and a pedestal at its foot, so the hoop can pass along between them), the two rails with a line
// of light each and a yellow stop at each end, the machine's own floor between them (a white deck plate with grip
// tape and a warning edge), the cable trough beside one rail, the line painted on the floor round it all.
// What moves (kit/piece.js glide: nobody works it, it goes by the kit's clock, and only while its room is drawn):
//   - the hoop on its carriage, from rest by the wall SCAN.travel metres toward the way in and back;
//   - the cable chain's loop beside the rail, which rolls along at half the carriage's speed, as a real one does.
// The band of light is the kit's live glow (kit/shipparts/cabin/live.js liveBand): its bright part goes round the
// hoop's mouth, worked out on the graphics card from the clock: nothing is done for it each frame.
// THE LIGHT: the moving parts throw no light and cast no shadow in the room's saved light (a shadow or a glow saved
// in one place would stay behind when the hoop glides off); they are lit as they stand at rest, with their room.
// On the high quality setting the band's glow falls on the bed, the floor and the wall live, and goes with the hoop
// (kit/materials.js hoopLit: a few sums a pixel in this one room's materials, nothing anywhere else).
import * as THREE from 'three';
import { sweep, bend } from './geo.js';
import { liveBand, liveFace, liveLamp } from './shipparts/cabin/live.js';

const PI = Math.PI;
export const SCAN = {
  y: 1.25, R: 1.2, bore: 0.62, deep: 0.6,   // the hoop: its middle's height, its outer radius, its opening's radius, its depth along the bed
  home: 0.74, travel: 2.0,                  // where the hoop's middle rests (from the wall's face), how far it glides
  go: 9, rest: 3,                           // seconds gliding each way (eased in and out), seconds still at each end
  turn: 4,                                  // seconds for the light to go once round the hoop
  glow: 1.0,                                // how strongly the band lights the room round it (live, on the high quality setting only)
  rail: 1.12, railZ: [0.12, 3.36],          // the rails: how far either side of the bed's middle, and their two ends
  bed: { w: 0.6, top: 0.85, z: [0.1, 4.02], foot: [3.36, 3.98] },   // the board (its top, its ends), the pedestal at its foot
  keep: { x: 1.62, z: 4.25 },               // the line painted on the floor round it
  // the machine's own floor, between the rails: how far either side of the bed's middle, its two ends, how far its top
  // is over the room's floor; its warning edge's width; the grip tape's two lanes (from, to, either side of the bed)
  deck: { x: 0.955, z: [0.03, 4.1], top: 0.004, edge: 0.07, grip: [0.37, 0.87], gripZ: [0.42, 3.24], seams: [1.38, 2.74] },
};
// (the picked sketch's own colours: a clean white shell, pale grey machinery, a blue pad; teal and blue light. The
// running gear is pale too, and its stops yellow: dark gear on the room's dark floor could not be made out)
const SHELL = { c: '#e7e8e6', r: 0.35, m: 0.02, w: 0.3 }, GREY = { c: '#a9adb1', r: 0.4, m: 0.1, w: 0.3 }, PAD = { c: '#3f6f8a', r: 0.75, m: 0, w: 0.2 };
const CHAIN = { c: '#2b2d31', r: 0.55, m: 0.1, w: 0.2 }, PLATE = { c: '#7f8388', r: 0.45, m: 0.35, w: 0.5 };
const TEAL = [0.25, 2.4, 2.0], BLUE = [0.5, 1.4, 3.4];
const o9 = { r: 0.02, cell: 1.5, loops: [] }, flat = { r: 0, cell: 9, loops: [] };

// a closed outline (points [across, along] in order round it) as a profile for a sweep. Every corner is crisp (the
// point twice, once for each side's normal) unless it is listed in `soft` (once, the normal halfway between). The
// normals point to the left of the way round.
function outline(points, soft = []) {
  const n = points.length, pts = [], nrm = [];
  const left = (i) => { const a = points[i], b = points[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [-dy / l, dx / l]; };
  for (let i = 0; i < n; i++) {
    const before = left((i + n - 1) % n), after = left(i);
    if (soft.includes(i)) { const x = before[0] + after[0], y = before[1] + after[1], l = Math.hypot(x, y) || 1; pts.push(points[i]); nrm.push([x / l, y / l]); }
    else { pts.push(points[i], points[i]); nrm.push(before, after); }
  }
  return { pts, nrm };
}
// a thin strip round a circle of radius r in the x-y plane, w wide along z, facing outward (a seam round a hoop's rim)
function rimStrip(r, w, seg = 64) {
  const pos = [], nrm = [], uv = [], ix = [];
  for (let i = 0; i <= seg; i++) {
    const a = i / seg * PI * 2, c = Math.cos(a), s = Math.sin(a);
    for (const k of [-1, 1]) { pos.push(r * c, r * s, k * w / 2); nrm.push(c, s, 0); uv.push(i / seg, k); }
    if (i < seg) ix.push(i * 2, i * 2 + 2, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix); return g;
}

// ── the cable chain: a run of dark links along z, a gap between each ──────────────────────────────────────────────
// (it lies in a pale trough outside the east rail: a lower run on the trough's floor from the wall's end, a loop, an
// upper run back to the carriage's tow arm. The loop rolls along at half the carriage's speed. `tail`: the length of
// each run that goes with the loop, and of the upper run that goes with the carriage: between half the travel and a
// little more, so that between them they always cover the runs and never stick out past either end.)
const CH = { x: -1.37, w: 0.09, low: [0.014, 0.048], up: [0.164, 0.198], pitch: 0.07, fixed: 0.3, tail: SCAN.travel / 2 + 0.075 };
// where the loop is with the carriage at rest: the upper run is then at its longest (the travel, and a bit over)
const TOW = -0.4, LOOP0 = SCAN.home + TOW + SCAN.travel + 0.1, TROUGH = LOOP0 + SCAN.travel / 2 + 0.3;
function chainRun(q, y, z0, z1, slim = 0) {
  const n = Math.max(1, Math.round((z1 - z0) / CH.pitch)), step = (z1 - z0) / n, hw = CH.w / 2 - slim;
  for (let i = 0; i < n; i++) q.slab(CHAIN, CH.x - hw, CH.x + hw, y[0] + slim, y[1] - slim, z0 + i * step + 0.006, z0 + (i + 1) * step - 0.006, flat);
}
// the loop, in its own frame (z = 0 where the chain turns back): seven links round the turn, and a length of each run
// behind it (the lower one a little slimmer: where it lies over the still lower run it is hidden inside it)
function chainLoop(q) {
  const yc = (CH.low[0] + CH.low[1] + CH.up[0] + CH.up[1]) / 4, rad = (CH.up[0] + CH.up[1] - CH.low[0] - CH.low[1]) / 4, th = CH.low[1] - CH.low[0];
  for (let i = 0; i < 7; i++) { const a = (i + 0.5) / 7 * PI; q.box(CHAIN, [CH.w, th, (rad + th / 2) * PI / 7 - 0.004], [CH.x, yc - rad * Math.cos(a), rad * Math.sin(a)], [-a, 0, 0], flat); }
  chainRun(q, CH.low, -CH.tail, 0, 0.004); chainRun(q, CH.up, -CH.tail, 0);
}

// ── the hoop on its carriage, in its own frame: the hoop's middle over the origin, the floor at y = 0, +z the way in ─
function carriage(q) {
  const { y, R, bore, deep } = SCAN, hd = deep / 2, R0 = (R + bore) / 2;
  // the hoop: a slim shell, its mouths cut back at 45 degrees (where the bands of light lie), its outer edge rounded;
  // a dark seam round its rim and four across each face, where its panels meet
  const prof = outline([[bore, -hd + 0.1], [bore, hd - 0.1], [bore + 0.1, hd], [R - 0.12, hd], [R - 0.04, hd - 0.05], [R, hd - 0.14], [R, -hd + 0.14], [R - 0.04, -hd + 0.05], [R - 0.12, -hd], [bore + 0.1, -hd]].map(([r, a]) => [r - R0, a]), [3, 4, 5, 6, 7, 8]);
  q.add('solid', sweep(prof, bend([0, y, 0], R0, [1, 0, 0], [0, 1, 0], 0, 2 * PI * (1 - 1 / 64), 63), { closed: true }), SHELL);
  q.add('solid', rimStrip(R + 0.0015, 0.012).translate(0, y, 0), 'dark');
  for (const k of [-1, 1]) for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; q.box('dark', [0.3, 0.006, 0.004], [0.9 * Math.cos(a), y + 0.9 * Math.sin(a), k * (hd + 0.001)], [0, 0, a], flat); }
  // the light: a band on each mouth's cut (their bright parts opposite each other, like the two halves of a scanner's
  // works), one round the middle of the opening, and a thin line on the front face with a bright dash running round
  // it: the one mark on the white face that shows the turning from across the room
  const band = { glow: TEAL, every: SCAN.turn, seg: 64 };
  liveBand(q, { ...band, r: bore + 0.05 - 0.0015, w: 0.1, lean: PI / 4 }, [0, y, hd - 0.05 + 0.0015]);
  liveBand(q, { ...band, r: bore + 0.05 - 0.0015, w: 0.1, lean: PI / 4, turn: -1 }, [0, y, -hd + 0.05 - 0.0015], [0, PI, 0]);
  liveBand(q, { ...band, r: bore - 0.002, w: 0.07, lean: PI / 2, gain: 0.7 }, [0, y, 0]);
  liveBand(q, { ...band, r: R - 0.3, w: 0.028, lean: 0, rest: 0.4, gain: 0.8 }, [0, y, hd + 0.002]);
  // the carriage: a low bridge under the hoop from rail to rail, and a cradle: two arms that rise out of the bridge
  // round the hoop's lower flanks, a little wider than the hoop and lipped over its edge (one clean round joint)
  q.slab(GREY, -0.98, 0.98, 0.04, 0.36, -0.36, 0.36, { r: 0.04, cell: 1.5, loops: [] });
  const Rc = R, arm = outline([[R - 0.07, -hd - 0.045], [R - 0.07, hd + 0.045], [R + 0.04, hd + 0.045], [R + 0.07, hd + 0.015], [R + 0.07, -hd - 0.015], [R + 0.04, -hd - 0.045]].map(([r, a]) => [r - Rc, a]));
  for (const [a0, a1] of [[-62, -27], [-153, -118]]) q.add('solid', sweep(arm, bend([0, y, 0], Rc, [1, 0, 0], [0, 1, 0], a0 * PI / 180, a1 * PI / 180, 10), { caps: true }), GREY);
  // a truck on each rail (the rail runs through it), its drive's motor lying on top
  for (const s of [-1, 1]) {
    q.slab(GREY, s * SCAN.rail - 0.12, s * SCAN.rail + 0.12, 0.03, 0.32, -0.42, 0.42, { r: 0.03, cell: 1.5, loops: [] });
    q.cyl('band', 0.055, 0.26, [s * SCAN.rail, 0.375, -0.25], [PI / 2, 0, 0], 12); q.cyl('rail', 0.035, 0.02, [s * SCAN.rail, 0.375, -0.11], [PI / 2, 0, 0], 10);
  }
  // on the hoop's face at shoulder height, each in a housing of its own: the machine's screen on the door's side
  // (live: its readouts), a red stop button on the other
  q.slab('band', 0.74, 1.02, y - 0.15, y + 0.15, hd - 0.01, hd + 0.03, { r: 0.012, cell: 9, loops: [] });
  liveFace(q, { show: 'drive', seed: 0.4, w: 0.22, h: 0.24, c: 0.02 }, [0.88, y, hd + 0.0315]);
  q.slab('yellow', -0.96, -0.82, y - 0.07, y + 0.07, hd - 0.01, hd + 0.025, { r: 0.01, cell: 9, loops: [] });
  q.cyl('red', 0.04, 0.035, [-0.89, y, hd + 0.04], [PI / 2, 0, 0], 16);
  // the tow arm out over the cable chain (pale, with a yellow clamp on the chain's end), and the length of the chain's
  // upper run that goes with the carriage
  q.slab(GREY, CH.x - 0.02, -SCAN.rail - 0.1, CH.up[1] + 0.012, CH.up[1] + 0.06, TOW - 0.03, TOW + 0.07, flat);
  q.slab('yellow', CH.x - CH.w / 2 - 0.008, CH.x + CH.w / 2 + 0.008, CH.up[0] - 0.006, CH.up[1] + 0.012, TOW - 0.01, TOW + 0.05, flat);
  chainRun(q, CH.up, TOW, TOW + CH.tail, 0.004);
}

// ── the machine's own floor ──────────────────────────────────────────────────────────────────────────────────────
// (the game's maker, 2026-11-17: "it also seems like a machine like this would have it's own bottom. I think a
// textured (with grip tape and maybe a warning boundary) white floor between the rails would look nice there"): a
// white deck plate from rail to rail and from the wall out past the bed's foot, in three plates (two dark seams across
// it); a yellow and black warning edge down both its sides and across its front; a lane of dark grip tape either side
// of the bed, where its patient walks and stands to get on. It lies flat on the room's floor, SCAN.deck.top proud of
// it: the patient's feet stay at the room's floor height (src/people.js walks them along it), so nothing of how they
// get on and off changes, and their soles are that little way into it, which does not show.
const TAPE = { c: '#25272a', r: 0.96, m: 0, w: 0.9 }, UNDER = { c: '#1b1c1f', r: 0.7, m: 0, w: 0.3 };
// slanted stripes lying flat at height y, along a band `wide` across: from a to b along the band (the band's own way
// along is `dir` [x, z], its way across `side` [x, z], from the point `at` [x, z]); each stripe `w` wide, `pitch` apart.
// One geometry of painted quads (no print, so no draw of its own).
function slantStripes(at, dir, side, a, b, wide, y, w = 0.034, pitch = 0.07) {
  const pos = [], nrm = [], uv = [], ix = [];
  for (let u = a; u + w + wide <= b + 1e-6; u += pitch) {
    const k = pos.length / 3;
    for (const [al, ac] of [[u, 0], [u + w, 0], [u + w + wide, wide], [u + wide, wide]]) { pos.push(at[0] + dir[0] * al + side[0] * ac, y, at[1] + dir[1] * al + side[1] * ac); nrm.push(0, 1, 0); uv.push(al, ac); }
    ix.push(k, k + 2, k + 1, k, k + 3, k + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix); return g;
}
function deck(p) {
  const D = SCAN.deck, [z0, z1] = D.z, y = D.top, paint = { r: 0, cell: 9, loops: [], skip: ['-y', '-x', '+x', '-z', '+z'] };
  p.slab(SHELL, -D.x, D.x, 0, y, z0, z1, { r: 0, cell: 0.3, loops: [], skip: ['-y'] });
  for (const z of D.seams) p.slab('dark', -D.x, D.x, y, y + 0.0015, z - 0.004, z + 0.004, paint);
  // the warning edge: a black band down each side from near the wall and across the front, yellow stripes slanted on it
  const e = D.edge, x1 = D.x - 0.012, x0 = x1 - e, zf = z1 - 0.012, za = z0 + 0.05;
  for (const s of [-1, 1]) {
    p.slab(UNDER, Math.min(s * x0, s * x1), Math.max(s * x0, s * x1), y, y + 0.0015, za, zf, paint);
    p.add('solid', slantStripes([s * x1, za], [0, 1], [-s, 0], 0, zf - za, e, y + 0.003), 'yellow');
  }
  p.slab(UNDER, -x0, x0, y, y + 0.0015, zf - e, zf, paint);
  p.add('solid', slantStripes([-x0, zf], [1, 0], [0, -1], 0, 2 * x0, e, y + 0.003), 'yellow');
  // the grip tape: thin dark strips across each lane (none on a seam)
  const [g0, g1] = D.grip, [gz0, gz1] = D.gripZ, pitch = 0.095, bar = 0.034;
  for (const s of [-1, 1]) for (let z = gz0; z + bar <= gz1 + 1e-6; z += pitch) {
    if (D.seams.some((q) => q > z - 0.02 && q < z + bar + 0.02)) continue;
    p.slab(TAPE, Math.min(s * g0, s * g1), Math.max(s * g0, s * g1), y, y + 0.0015, z, z + bar, paint);
  }
}

// ── the whole thing ──────────────────────────────────────────────────────────────────────────────────────────────
export function bigScanner(p) {
  const { rail, railZ: [r0, r1], bed: B, keep } = SCAN, HEAD = SCAN.home + SCAN.deep / 2 + 0.08;   // (where the head rest starts)
  deck(p);
  // the rails: a grey foot plate, a bright rail, a line of blue light along its inner side between its two stops; each
  // stop a yellow block with a dark pad toward the carriage, which comes to rest a hand's width short of it
  for (const s of [-1, 1]) {
    const x = s * rail;
    p.slab(PLATE, x - 0.15, x + 0.15, 0, 0.02, r0, r1, { r: 0.006, cell: 1.5, loops: [] });
    p.slab('rail', x - 0.028, x + 0.028, 0.02, 0.1, r0 + 0.02, r1 - 0.02, { r: 0.01, cell: 1.5, loops: [] });
    p.glowSlab(BLUE, x - s * 0.134 - 0.008, x - s * 0.134 + 0.008, 0.02, 0.025, r0 + 0.17, r1 - 0.17, { r: 0 });
    for (const [z0, z1] of [[r0 + 0.02, r0 + 0.14], [r1 - 0.14, r1 - 0.02]]) {
      p.slab('yellow', x - 0.1, x + 0.1, 0.02, 0.22, z0, z1, { r: 0.02, cell: 1.5, loops: [] });
      p.slab('black', x - 0.035, x + 0.035, 0.08, 0.15, z0 < 1 ? z1 : z0 - 0.02, z0 < 1 ? z1 + 0.02 : z0, flat);
    }
  }
  // the cable trough outside the east rail (a pale floor plate between two low lips, a lip across its far end), the
  // box at the wall where the cable comes out, and the chain's lower run lying in it as far as the loop ever leaves it
  p.slab('grey2', CH.x - 0.09, CH.x + 0.09, 0, 0.012, CH.fixed, TROUGH, flat);
  for (const s of [-1, 1]) p.slab('rail', CH.x + s * 0.084 - 0.006, CH.x + s * 0.084 + 0.006, 0.012, 0.05, CH.fixed, TROUGH, flat);
  p.slab('rail', CH.x - 0.09, CH.x + 0.09, 0.012, 0.05, TROUGH - 0.012, TROUGH, flat);
  p.slab(GREY, CH.x - 0.095, CH.x + 0.095, 0, 0.24, 0, CH.fixed + 0.02, o9);
  liveLamp(p, { w: 0.05, h: 0.025, mode: 'breathe', every: 5, glow: 'green', gain: 0.5 }, [CH.x, 0.19, CH.fixed + 0.021]);
  chainRun(p, CH.low, CH.fixed + 0.02, LOOP0);
  // the bed: a stand at the wall and a pedestal at its foot, made alike (a dark kick, a pale body, a bar of blue light
  // low on the face that looks down the bed); a keel from one to the other under the board; a blue pad; a head rest
  // just clear of the hoop at rest. Nothing stands under the board between the two: the hoop's carriage passes there,
  // and nothing stands behind the hoop's opening but the wall.
  p.slab('black', -0.32, 0.32, 0, 0.08, 0, 0.27, o9);
  p.slab(GREY, -0.3, 0.3, 0.08, B.top - 0.17, 0.03, 0.25, { r: 0.04, cell: 1.5, loops: [] });
  p.glowSlab(BLUE, -0.26, 0.26, 0.13, 0.16, 0.25, 0.256, { r: 0 });
  p.slab('black', -0.32, 0.32, 0, 0.08, B.foot[0] - 0.02, B.foot[1] + 0.02, o9);
  p.slab(GREY, -0.3, 0.3, 0.08, B.top - 0.08, B.foot[0], B.foot[1], { r: 0.04, cell: 1.5, loops: [] });
  p.slab(GREY, -0.16, 0.16, B.top - 0.17, B.top - 0.08, 0.03, B.foot[0] + 0.04, { r: 0.015, cell: 1.5, loops: [] });
  p.slab(SHELL, -B.w / 2, B.w / 2, B.top - 0.08, B.top, B.z[0], B.z[1], { r: 0.03, cell: 1.5, loops: [] });
  p.slab(PAD, -B.w / 2 + 0.04, B.w / 2 - 0.04, B.top, B.top + 0.065, B.z[0] + 0.3, B.z[1] - 0.06, { r: 0.03, cell: 1.5, loops: [] });
  p.slab(PAD, -0.19, 0.19, B.top + 0.05, B.top + 0.1, HEAD, HEAD + 0.32, { r: 0.03, cell: 9, loops: [] });
  // the pedestal's front, toward the way in: a bar of blue light low down, and the scanner's screen (live: its sweep)
  p.glowSlab(BLUE, -0.26, 0.26, 0.13, 0.16, B.foot[1], B.foot[1] + 0.006, { r: 0 });
  p.slab('black', -0.19, 0.19, 0.34, 0.62, B.foot[1], B.foot[1] + 0.012, { r: 0.008, cell: 9, loops: [] });
  liveFace(p, { show: 'scan', seed: 0.15, w: 0.33, h: 0.23, c: 0.02 }, [0, 0.48, B.foot[1] + 0.0135]);
  p.light([0, 0.3, B.foot[1] + 0.25], 0.35, [0.35, 0.6, 1.3], [0, -0.287, 0.958], 2.2);
  // the line on the floor, from the wall round the rails and the bed's foot and back to the wall: keep clear while it
  // runs (a few millimetres of pale paint, painted parts like the rest: the room needs no other kind of draw for it)
  const LINE = { c: '#8fcfc6', r: 0.6, m: 0, w: 0.4 }, lw = 0.025, paint = { r: 0, cell: 1.5, loops: [], skip: ['-y'] };
  for (const s of [-1, 1]) p.slab(LINE, s * keep.x - lw, s * keep.x + lw, 0, 0.004, -0.01, keep.z + lw, paint);
  p.slab(LINE, -keep.x + lw, keep.x - lw, 0, 0.004, keep.z - lw, keep.z + lw, paint);
  // what moves: the hoop on its carriage, and the cable chain's loop at half its speed
  p.glide('scan', { go: SCAN.go, rest: SCAN.rest });
  p.leaf('bigscan-hoop', carriage, { at: [0, 0, SCAN.home], slide: [0, 0, SCAN.travel], door: 'scan', still: true,
    hoop: { at: [0, SCAN.y, 0], r: SCAN.bore + 0.05, color: [0.3, 1, 0.85], i: SCAN.glow, reach: 3, every: SCAN.turn } });
  p.leaf('bigscan-loop', chainLoop, { at: [0, 0, LOOP0], slide: [0, 0, SCAN.travel / 2], door: 'scan', still: true });
}

export const BIGSCANNER_PIECES = {
  bigscanner: { name: 'The big scanner (slim ring on rails)', group: 'Medical', at: 'point', variants: ['slim ring'], foot: [3.3, 2.5, 4.3], build: bigScanner },
};
