// THE MEDICAL CENTRE'S BIG SCANNER: the game's maker's pick from the option sheet ("I like the slim ring. It might be
// cool if it could slide on rails like the arch"): a slim tall hoop with a wide opening and a band of light that turns
// inside it, standing on a carriage that rides two floor rails and glides slowly along the bed and back, as a scan.
// Sized like a real one: the hoop 2.4 m across (2.45 m to its top), the bed about 3 m long in front of the parked hoop.
//
//   bigscanner   a POINT piece: its back on the scanner room's back wall (z = 0 is the wall's face), the bed running
//                out along +z toward the way in, x across the room. 'slim ring'.
//
// What stands still (part of its room, lit and walked round like any furniture): the bed (a board on a pillar at the
// wall and a pedestal at its foot, so the hoop can pass along between them), the two rails with a line of light
// each and a stop at each end, the cable trough beside one rail, the line painted on the floor round it all.
// What moves (kit/piece.js glide: nobody works it, it goes by the kit's clock, and only while its room is drawn):
//   - the hoop on its carriage, from rest by the wall SCAN.travel metres toward the way in and back;
//   - the cable chain's loop beside the rail, which rolls along at half the carriage's speed, as a real one does.
// The band of light is the kit's live glow (kit/shipparts/cabin/live.js liveBand): its bright part goes round the
// hoop's mouth, worked out on the graphics card from the clock: nothing is done for it each frame.
// THE LIGHT: the moving parts throw no light and cast no shadow in the room's saved light (a shadow or a glow saved
// in one place would stay behind when the hoop glides off); they are lit as they stand at rest, with their room.
// On the high quality setting the band's glow falls on the bed, the floor and the wall live, and goes with the hoop
// (kit/materials.js hoopLit: a few sums a pixel in this one room's materials, nothing anywhere else).
import { sweep, bend, lathe as lathe2, put } from './geo.js';
import { liveBand, liveFace, liveLamp } from './shipparts/cabin/live.js';

const PI = Math.PI;
export const SCAN = {
  y: 1.25, R: 1.2, bore: 0.62, deep: 0.6,   // the hoop: its middle's height, its outer radius, its opening's radius, its depth along the bed
  home: 0.74, travel: 2.1,                  // where the hoop's middle rests (from the wall's face), how far it glides
  go: 9, rest: 3,                           // seconds gliding each way (eased in and out), seconds still at each end
  turn: 4,                                  // seconds for the light to go once round the hoop
  glow: 1.0,                                // how strongly the band lights the room round it (live, on the high quality setting only)
  rail: 1.12, railZ: [0.16, 3.42],          // the rails: how far either side of the bed's middle, and their two ends
  bed: { w: 0.6, top: 0.85, z: [0.1, 4.02], foot: [3.36, 3.98] },   // the board (its top, its ends), the pedestal at its foot
  keep: { x: 1.62, z: 4.25 },               // the line painted on the floor round it
};
// (the picked sketch's own colours: a clean white shell, pale grey machinery, a blue pad; teal and blue light)
const SHELL = { c: '#e7e8e6', r: 0.35, m: 0.02, w: 0.3 }, GREY = { c: '#a9adb1', r: 0.4, m: 0.1, w: 0.3 }, PAD = { c: '#3f6f8a', r: 0.75, m: 0, w: 0.2 };
const CHAIN = { c: '#2b2d31', r: 0.55, m: 0.1, w: 0.2 };
const TEAL = [0.25, 2.4, 2.0], TEAL_DIM = [0.1, 0.95, 0.8], BLUE = [0.5, 1.4, 3.4];
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
// a flat ring of steady light facing +z, from radius r0 to r1, its middle at `at`. It is one of the live glows (a lamp
// that never changes: its uv says so, as live.js liveLamp's does), so it is drawn with the bands, in their one draw.
function washer(p, look, r0, r1, at, seg = 64) {
  const g = put(lathe2([[r1, 0], [r0, 0]], seg), at, [PI / 2, 0, 0]), uv = g.attributes.uv.array;
  for (let i = 0; i < uv.length; i += 2) { uv[i] = 2; uv[i + 1] = 4.5; }
  return p.add('live', g, look);
}

// ── the cable chain: a run of dark links along z, a gap between each ──────────────────────────────────────────────
// (it lies in a trough outside the east rail: a lower run on the trough's floor from the wall's end, a loop, an upper
// run back to the carriage's tow arm. The loop rolls along at half the carriage's speed.)
const CH = { x: -1.35, w: 0.09, low: [0.014, 0.048], up: [0.124, 0.158], pitch: 0.07, fixed: 0.3, tail: 1.12 };
// where the loop is with the carriage at rest: the upper run is then at its longest (the travel, and a bit over)
const TOW = -0.4, LOOP0 = SCAN.home + TOW + SCAN.travel + 0.1;
function chainRun(q, y, z0, z1, slim = 0) {
  const n = Math.max(1, Math.round((z1 - z0) / CH.pitch)), step = (z1 - z0) / n, hw = CH.w / 2 - slim;
  for (let i = 0; i < n; i++) q.slab(CHAIN, CH.x - hw, CH.x + hw, y[0] + slim, y[1] - slim, z0 + i * step + 0.006, z0 + (i + 1) * step - 0.006, flat);
}
// the loop, in its own frame (z = 0 where the chain turns back): five links round the turn, and a length of each run
// behind it (the lower one a little slimmer: where it lies over the still lower run it is hidden inside it)
function chainLoop(q) {
  const yc = (CH.low[0] + CH.low[1] + CH.up[0] + CH.up[1]) / 4, rad = (CH.up[0] + CH.up[1] - CH.low[0] - CH.low[1]) / 4, th = CH.low[1] - CH.low[0];
  for (let i = 0; i < 5; i++) { const a = (i + 0.5) / 5 * PI; q.box(CHAIN, [CH.w, th, rad * PI / 5 - 0.008], [CH.x, yc - rad * Math.cos(a), rad * Math.sin(a)], [-a, 0, 0], flat); }
  chainRun(q, CH.low, -CH.tail, 0, 0.004); chainRun(q, CH.up, -CH.tail, 0);
}

// ── the hoop on its carriage, in its own frame: the hoop's middle over the origin, the floor at y = 0, +z the way in ─
function carriage(q) {
  const { y, R, bore, deep } = SCAN, hd = deep / 2, R0 = (R + bore) / 2, CHEEK = hd + 0.04;
  // the hoop: a slim shell, its mouths cut back at 45 degrees (where the bands of light lie), its outer edge rounded
  const prof = outline([[bore, -hd + 0.1], [bore, hd - 0.1], [bore + 0.1, hd], [R - 0.12, hd], [R - 0.04, hd - 0.05], [R, hd - 0.14], [R, -hd + 0.14], [R - 0.04, -hd + 0.05], [R - 0.12, -hd], [bore + 0.1, -hd]].map(([r, a]) => [r - R0, a]), [3, 4, 5, 6, 7, 8]);
  q.add('solid', sweep(prof, bend([0, y, 0], R0, [1, 0, 0], [0, 1, 0], 0, 2 * PI * (1 - 1 / 64), 63), { closed: true }), SHELL);
  // the light: a band on each mouth's cut (their bright parts opposite each other, like the two halves of a scanner's
  // works) and one round the middle of the opening; a thin steady line on the front face
  const band = { glow: TEAL, every: SCAN.turn, seg: 64 };
  liveBand(q, { ...band, r: bore + 0.05 - 0.0015, w: 0.1, lean: PI / 4 }, [0, y, hd - 0.05 + 0.0015]);
  liveBand(q, { ...band, r: bore + 0.05 - 0.0015, w: 0.1, lean: PI / 4, turn: -1 }, [0, y, -hd + 0.05 - 0.0015], [0, PI, 0]);
  liveBand(q, { ...band, r: bore - 0.002, w: 0.07, lean: PI / 2, gain: 0.7 }, [0, y, 0]);
  washer(q, TEAL_DIM, R - 0.3, R - 0.288, [0, y, hd + 0.002]);
  // the carriage: a low bridge under the hoop from rail to rail, a cheek either side holding the hoop's flanks, a dark
  // truck on each rail (the rail runs through it) with its drive's housing on top
  q.slab(GREY, -0.98, 0.98, 0.04, 0.36, -0.36, 0.36, { r: 0.04, cell: 1.5, loops: [] });
  q.slab('band', -0.98, 0.98, 0.36, 0.385, -0.31, 0.31, o9);
  for (const s of [-1, 1]) {
    // (the cheeks stand a little proud of the hoop's flat faces, front and back: a face level with them would flicker)
    q.slab(SHELL, s * 0.92 - 0.14, s * 0.92 + 0.14, 0.3, 1.0, -CHEEK, CHEEK, { r: 0.05, cell: 1.5, loops: [] });
    q.slab('gun', s * SCAN.rail - 0.12, s * SCAN.rail + 0.12, 0.03, 0.32, -0.42, 0.42, { r: 0.03, cell: 1.5, loops: [] });
    q.slab('black', s * SCAN.rail - 0.09, s * SCAN.rail + 0.09, 0.32, 0.4, -0.4, -0.08, o9);
    q.slab('yellow', s * SCAN.rail - 0.122, s * SCAN.rail + 0.122, 0.05, 0.11, 0.4, 0.424, flat);      // (a bumper plate at each end)
    q.slab('yellow', s * SCAN.rail - 0.122, s * SCAN.rail + 0.122, 0.05, 0.11, -0.424, -0.4, flat);
  }
  // on the cheek by the door: the machine's own little screen (live: its readouts). On the other: a red stop button
  q.slab('black', 0.8, 1.04, 0.66, 0.86, CHEEK, CHEEK + 0.012, { r: 0.008, cell: 9, loops: [] });
  liveFace(q, { show: 'drive', seed: 0.4, w: 0.21, h: 0.16, c: 0.016 }, [0.92, 0.76, CHEEK + 0.0135]);
  q.cyl('yellow', 0.05, 0.012, [-0.92, 0.78, CHEEK + 0.006], [PI / 2, 0, 0], 16); q.cyl('red', 0.034, 0.03, [-0.92, 0.78, CHEEK + 0.026], [PI / 2, 0, 0], 16);
  // the tow arm out to the cable chain, and the length of the chain's upper run that goes with the carriage
  q.slab('gun', CH.x - CH.w / 2, -SCAN.rail - 0.1, CH.up[1] - 0.002, CH.up[1] + 0.04, TOW - 0.02, TOW + 0.06, flat);
  chainRun(q, CH.up, TOW, TOW + CH.tail, 0.004);
}

// ── the whole thing ──────────────────────────────────────────────────────────────────────────────────────────────
export function bigScanner(p) {
  const { rail, railZ: [r0, r1], bed: B, keep } = SCAN;
  // the rails: a dark foot plate, a bright rail, a line of blue light along its inner side; a stop at each end
  for (const s of [-1, 1]) {
    const x = s * rail;
    p.slab('gun', x - 0.13, x + 0.13, 0, 0.02, r0, r1, { r: 0.006, cell: 1.5, loops: [] });
    p.slab('rail', x - 0.02, x + 0.02, 0.02, 0.085, r0 + 0.02, r1 - 0.02, { r: 0.008, cell: 1.5, loops: [] });
    p.glowSlab(BLUE, x - s * 0.115 - 0.008, x - s * 0.115 + 0.008, 0.02, 0.025, r0 + 0.06, r1 - 0.06, { r: 0 });
    for (const [z0, z1] of [[r0 + 0.02, r0 + 0.14], [r1 - 0.14, r1 - 0.02]]) {
      p.slab('black', x - 0.1, x + 0.1, 0.02, 0.2, z0, z1, { r: 0.02, cell: 1.5, loops: [] });
      p.slab('rubber', x - 0.05, x + 0.05, 0.06, 0.15, z0 < 1 ? z1 : z0 - 0.02, z0 < 1 ? z1 + 0.02 : z0, flat);
    }
  }
  // the cable trough outside the east rail (a floor plate between two low lips), the box at the wall where the cable
  // comes out, and the chain's lower run lying in it as far as the loop ever leaves it
  p.slab('dark', CH.x - 0.09, CH.x + 0.09, 0, 0.012, CH.fixed, LOOP0 + SCAN.travel / 2 + 0.13, flat);
  for (const s of [-1, 1]) p.slab('gun', CH.x + s * 0.084 - 0.006, CH.x + s * 0.084 + 0.006, 0.012, 0.05, CH.fixed, LOOP0 + SCAN.travel / 2 + 0.13, flat);
  p.slab('gun', CH.x - 0.095, CH.x + 0.095, 0, 0.24, 0, CH.fixed + 0.02, o9);
  liveLamp(p, { w: 0.05, h: 0.025, mode: 'breathe', every: 5, glow: 'green', gain: 0.5 }, [CH.x, 0.19, CH.fixed + 0.021]);
  chainRun(p, CH.low, CH.fixed + 0.02, LOOP0);
  // the bed: a pillar on the wall's plate at its head, a pedestal at its foot, a beam between them under the board, a
  // blue pad with a head rest. Nothing stands under the board between the two: the hoop's carriage passes there.
  p.slab(GREY, -0.36, 0.36, 0, 1.05, 0, 0.04, o9);
  p.slab(GREY, -0.2, 0.2, 0, B.top - 0.16, 0.02, 0.22, { r: 0.03, cell: 1.5, loops: [] });
  p.slab('black', -0.32, 0.32, 0, 0.08, B.foot[0] - 0.02, B.foot[1] + 0.02, o9);
  p.slab(GREY, -0.3, 0.3, 0.08, B.top - 0.08, B.foot[0], B.foot[1], { r: 0.04, cell: 1.5, loops: [] });
  p.slab(GREY, -0.09, 0.09, B.top - 0.16, B.top - 0.08, 0.02, B.foot[0] + 0.04, { r: 0.015, cell: 1.5, loops: [] });
  p.slab(SHELL, -B.w / 2, B.w / 2, B.top - 0.08, B.top, B.z[0], B.z[1], { r: 0.03, cell: 1.5, loops: [] });
  p.slab(PAD, -B.w / 2 + 0.04, B.w / 2 - 0.04, B.top, B.top + 0.065, B.z[0] + 0.3, B.z[1] - 0.06, { r: 0.03, cell: 1.5, loops: [] });
  p.slab(PAD, -0.19, 0.19, B.top + 0.05, B.top + 0.1, B.z[0] + 0.36, B.z[0] + 0.68, { r: 0.03, cell: 9, loops: [] });
  p.slab('rail', -0.24, 0.24, B.top - 0.065, B.top - 0.035, B.z[1], B.z[1] + 0.05, { r: 0.012, cell: 9, loops: [] });   // (a grab bar at the foot)
  // the pedestal's front, toward the way in: a bar of blue light low down, and the scanner's screen (live: its sweep)
  p.glowSlab(BLUE, -0.26, 0.26, 0.13, 0.16, B.foot[1], B.foot[1] + 0.006, { r: 0 });
  p.slab('black', -0.19, 0.19, 0.34, 0.62, B.foot[1], B.foot[1] + 0.012, { r: 0.008, cell: 9, loops: [] });
  liveFace(p, { show: 'scan', seed: 0.15, w: 0.33, h: 0.23, c: 0.02 }, [0, 0.48, B.foot[1] + 0.0135]);
  p.light([0, 0.3, B.foot[1] + 0.25], 0.35, [0.35, 0.6, 1.3], [0, -0.287, 0.958], 2.2);
  // the line on the floor: keep clear of the rails while it runs (a few millimetres of pale paint, painted parts like
  // the rest: the room needs no other kind of draw for it)
  const LINE = { c: '#8fcfc6', r: 0.6, m: 0, w: 0.4 }, lw = 0.025, paint = { r: 0, cell: 1.5, loops: [], skip: ['-y'] };
  for (const s of [-1, 1]) p.slab(LINE, s * keep.x - lw, s * keep.x + lw, 0, 0.004, 0.04, keep.z + lw, paint);
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
