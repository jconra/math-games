// COCKPIT SEATS, in the look of his pictures' cockpits (padded seats with side bolsters, dark armrests, a pedestal on
// rails). Each faces +z (the way its sitter faces), stands on the deck (y = 0) and is centred on x = 0; its base fits a
// 0.5 m cell, the seat itself is a little wider (0.62 m across the armrests).
//   flightSeat(p, o)   the pilot's and co-pilot's seat: headrest, armrests, a five-point harness, on a pedestal that
//                      slides along two rails. o: h (cushion top, 0.48), w (cushion width, 0.46), d (cushion depth, 0.47),
//                      back (backrest height, 0.6), recline (radians, 0.21), arm (armrest top above the cushion, 0.22),
//                      arms ('both' | 'none'), harness (true), headrest (true), slide (how far the seat sits forward on
//                      its rails, -0.1 to 0.15; 0), look ('tan' | 'grey' | 'station'), stick / throttle ('left' |
//                      'right' | null: a flight stick or a one-lever throttle on that armrest's end; the sitter's left,
//                      toward +x), badge ('pilot' | 'co-pilot' | 'engineer' | 'crew' | null: a stencilled role on the
//                      headrest's back)
//   crewSeat(p, o)     the engineer's (or any crew) seat: a swivel seat on a round foot, a lower back, a stubby
//                      headrest, armrests, no harness. o: h (0.48), w (0.46), back (0.5), arms (true), look, badge
//   jumpSeat(p, o)     a fold-down seat on a wall: its back on the wall (z = 0), standing on the deck. o: w (0.44),
//                      h (0.46), open (true: the seat is down), harness (true), look
//   SEAT               the flight seat's defaults, and where a sitter's eye, shoulders and hands are (for a 1.75 m person,
//                      measured from the seat): the cockpit set and its checks read these
import * as THREE from 'three';
import { rrect } from '../../geo.js';
import { fixFrames } from '../../wallkit.js';
import { part } from '../place.js';
import { SEAT_LOOK, LEAN, bar, mount } from './look.js';
import { flightStick, throttle } from './controls.js';

const PI = Math.PI, v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const SOFT = { r: 0.026, seg: 1, cell: 9, loops: [] }, FIRM = { r: 0.012, seg: 1, cell: 9, loops: [] }, FLAT = { r: 0 };
// a seated 1.75 m person (from the cushion top and the backrest's line): eye 0.79 m up and 0.17 m out from the
// backrest, shoulder joints 0.58 m up, 0.1 m out and 0.19 m to each side, elbows 0.23 m up
export const SEAT = { h: 0.48, w: 0.46, d: 0.47, back: 0.6, recline: 0.21, arm: 0.22, eye: [0.79, 0.17], shoulder: [0.58, 0.1, 0.19], elbow: 0.23 };
// where things are on a flight seat built with options o: the backrest's line at a height above the cushion, the
// eye, the shoulders (the sitter's right one first, at -x), the armrest ends (where a stick or throttle stands). Left and
// right are the sitter's: facing +z, their left hand is toward +x
export function seatPoints(o = {}) {
  const S = { ...SEAT, slide: 0, ...o }, zb = S.slide - S.d / 2 + 0.02;   // (the backrest's foot, on the cushion's back edge)
  const backAt = (u) => zb - u * Math.tan(S.recline);
  const eye = [0, S.h + S.eye[0], backAt(S.eye[0]) + S.eye[1]];
  const shoulders = [-1, 1].map((s) => [s * S.shoulder[2], S.h + S.shoulder[0], backAt(S.shoulder[0]) + S.shoulder[1]]);
  const xa = S.w / 2 + 0.045, armTop = S.h + S.arm, armEnd = S.slide + S.d / 2 - 0.08;
  return { eye, shoulders, arm: { left: [xa, armTop, armEnd], right: [-xa, armTop, armEnd] }, backAt, h: S.h, slide: S.slide, recline: S.recline };
}

// a flat strap swept along points (a harness belt): width w, its face toward `face`
function strap(p, surf, pts, face, w = 0.045) {
  const path = fixFrames(pts.map((q) => ({ p: v3(...q), x: v3(1, 0, 0), y: face.clone() })));
  p.sweep(surf, rrect(w, 0.007, 0.0025, 1), path);
}

export function flightSeat(p, o = {}) {
  const { h = SEAT.h, w = SEAT.w, d = SEAT.d, back = SEAT.back, recline = SEAT.recline, arm = SEAT.arm, arms = 'both', harness = true, headrest = true, slide = 0, look = 'tan', stick = null, throttle: thr = null, badge = null } = o;
  const S = SEAT_LOOK[look] || SEAT_LOOK.tan, z0 = slide, zc0 = z0 - d / 2, zc1 = z0 + d / 2;
  // the base: a plate bolted to the deck, two rails the seat slides on, end stops
  p.slab('black', -0.2, 0.2, 0, 0.022, -0.24, 0.24, FLAT);
  for (const x of [-0.13, 0.13]) { p.slab('rail', x - 0.016, x + 0.016, 0.022, 0.046, -0.235, 0.235, FLAT); for (const z of [-0.225, 0.225]) p.slab('black', x - 0.022, x + 0.022, 0.022, 0.06, z - 0.012, z + 0.012, { r: 0 }); }
  // the carriage on the rails, a boot and the pedestal up to the pan, the slide lever under the front edge
  p.slab(S.frame, -0.165, 0.165, 0.046, 0.08, z0 - 0.16, z0 + 0.16, FLAT);
  p.slab('rubber', -0.1, 0.1, 0.08, 0.17, z0 - 0.12, z0 + 0.08, LEAN);
  p.slab(S.frame, -0.075, 0.075, 0.17, h - 0.1, z0 - 0.1, z0 + 0.05, FLAT);
  p.box('yellow', [0.12, 0.016, 0.016], [0.06, h - 0.13, zc1 - 0.04], null, { r: 0 });
  p.box('black', [0.016, 0.016, 0.07], [0.006, h - 0.13, zc1 - 0.07], null, { r: 0 });
  // the pan, the cushion between two raised side bolsters, a rolled front edge
  p.slab(S.frame, -w / 2 - 0.015, w / 2 + 0.015, h - 0.11, h - 0.065, zc0, zc1 - 0.01, FLAT);
  p.slab(S.pad, -w / 2 + 0.07, w / 2 - 0.07, h - 0.075, h, zc0 + 0.03, zc1 - 0.03, SOFT);
  for (const s of [-1, 1]) p.slab(S.seam, s < 0 ? -w / 2 : w / 2 - 0.072, s < 0 ? -w / 2 + 0.072 : w / 2, h - 0.075, h + 0.045, zc0 + 0.03, zc1, SOFT);
  p.slab(S.seam, -w / 2 + 0.07, w / 2 - 0.07, h - 0.08, h - 0.005, zc1 - 0.06, zc1, SOFT);
  // the backrest: built in its own frame (u along it, n out of its face), leaning back by `recline` from its foot
  const up = v3(0, Math.cos(recline), -Math.sin(recline)), fwd = v3(0, Math.sin(recline), Math.cos(recline)), foot = v3(0, h - 0.04, zc0 + 0.02);
  const B = (x, u, n) => foot.clone().addScaledVector(up, u).addScaledVector(fwd, n).setX(x).toArray();
  const bslab = (surf, x0, x1, u0, u1, n0, n1, opts) => p.box(surf, [x1 - x0, u1 - u0, n1 - n0], B((x0 + x1) / 2, (u0 + u1) / 2, (n0 + n1) / 2), [-recline, 0, 0], opts);
  // (a shell behind, a thick pad, deep side bolsters that wrap the shoulders, a stitched seam across)
  bslab(S.shell, -w / 2 - 0.025, w / 2 + 0.025, 0, back + 0.01, -0.1, -0.04, { ...FIRM, r: 0.022 });
  bslab(S.pad, -w / 2 + 0.08, w / 2 - 0.08, 0.03, back - 0.02, -0.05, 0.045, SOFT);
  for (const s of [-1, 1]) bslab(S.seam, s < 0 ? -w / 2 - 0.02 : w / 2 - 0.095, s < 0 ? -w / 2 + 0.095 : w / 2 + 0.02, 0.04, back * 0.97, -0.05, 0.12, SOFT);
  bslab(S.seam, -w / 2 + 0.08, w / 2 - 0.08, back * 0.42, back * 0.47, -0.045, 0.049, { r: 0 });
  for (const x of [-0.05, 0.05]) bslab(S.seam, x - 0.006, x + 0.006, 0.06, back - 0.04, -0.045, 0.049, { r: 0 });   // (stitched channels down it)
  for (const s of [-1, 1]) bslab(S.frame, s * (w / 2 + 0.025) - 0.008, s * (w / 2 + 0.025) + 0.008, 0.02, back - 0.01, -0.1, -0.035, { r: 0 });   // (dark sides on the shell)
  for (const u of [back * 0.3, back * 0.62]) bslab(S.seam, -w / 2 - 0.018, w / 2 + 0.018, u, u + 0.012, -0.104, -0.096, { r: 0 });   // (seams across its back)
  if (headrest) {
    // (a dark neck, then the headrest: its own shell behind it, a role badge on its back)
    bslab(S.frame, -0.1, 0.1, back - 0.01, back + 0.04, -0.09, 0.02, { r: 0 });
    bslab(S.shell, -0.2, 0.2, back + 0.03, back + 0.34, -0.1, -0.04, { ...FIRM, r: 0.022 });
    bslab(S.pad, -0.19, 0.19, back + 0.035, back + 0.33, -0.06, 0.06, SOFT);
    for (const s of [-1, 1]) bslab(S.seam, s < 0 ? -0.2 : 0.13, s < 0 ? -0.13 : 0.2, back + 0.04, back + 0.32, -0.06, 0.09, SOFT);   // (its wings)
    bslab(S.seam, -0.13, 0.13, back + 0.035, back + 0.065, -0.062, 0.062, FLAT);
    bslab(S.seam, -0.2, 0.2, back + 0.27, back + 0.285, -0.104, -0.096, { r: 0 });   // (a seam across its back)
    if (badge) p.decal('cp:badge:' + badge, 0.2, 0.05, B(0, back + 0.2, -0.1015), [-recline, PI, 0], '#e8e4da');
  }
  if (harness) {
    for (const s of [-1, 1]) bslab('black', s * 0.085 - 0.03, s * 0.085 + 0.03, back - 0.06, back - 0.045, -0.04, 0.048, { r: 0 });   // the strap slots
    const buckle = [0, h + 0.05, zc0 + 0.24], face = fwd.clone();
    for (const s of [-1, 1]) {
      strap(p, S.strap, [B(s * 0.085, back - 0.05, 0.051), B(s * 0.08, back * 0.6, 0.055), B(s * 0.065, 0.16, 0.06), [s * 0.04, h + 0.055, zc0 + 0.2]], face);
      strap(p, S.strap, [[s * (w / 2 - 0.08), h + 0.035, zc0 + 0.07], [s * 0.12, h + 0.05, zc0 + 0.17], [s * 0.035, h + 0.052, buckle[2]]], v3(0, 1, 0), 0.04);
    }
    strap(p, S.strap, [[0, h - 0.004, zc1 - 0.07], [0, h + 0.02, zc1 - 0.14], [0, h + 0.048, buckle[2] + 0.03]], v3(0, 1, 0), 0.04);
    p.cyl('chrome', 0.032, 0.014, buckle, [PI / 2 - 0.15, 0, 0], 10);
    p.cyl('dark', 0.02, 0.016, [0, buckle[1] + 0.002, buckle[2] + 0.002], [PI / 2 - 0.15, 0, 0], 8);
  }
  // armrests: a bracket from the pan up at the back, a padded rest, a plate at its end for a stick or a throttle
  if (arms !== 'none') {
    const xa = w / 2 + 0.045, top = h + arm, z1 = zc1 - 0.03;   // (the armrests stop short of the cushion's front)
    for (const s of [-1, 1]) {
      const x = s * xa;
      p.slab(S.frame, x - 0.02, x + 0.02, h - 0.1, top - 0.03, zc0 + 0.04, zc0 + 0.12, FLAT);
      bar(p, S.frame, [x, h - 0.08, zc0 + 0.22], [x, top - 0.04, zc0 + 0.36], 0.024);
      p.slab(S.frame, x - 0.032, x + 0.032, top - 0.045, top - 0.02, zc0 + 0.04, z1, FLAT);
      p.slab(S.arm, x - 0.035, x + 0.035, top - 0.028, top, zc0 + 0.03, z1 - 0.07, { ...SOFT, r: 0.012 });
      p.slab('black', x - 0.035, x + 0.035, top - 0.028, top - 0.002, z1 - 0.07, z1, LEAN);
    }
    const P = seatPoints({ h, w, d, recline, arm, slide });
    if (stick) mount(p, part(flightStick, { mount: 'arm', hand: stick }), { at: P.arm[stick] }, 'stick', 'y');
    if (thr) mount(p, part(throttle, { mount: 'arm' }), { at: P.arm[thr], scale: thr === 'left' ? [-1, 1, 1] : 1 }, 'throttle', 'y');
  }
}

export function crewSeat(p, o = {}) {
  const { h = SEAT.h, w = SEAT.w, back = 0.5, arms = true, look = 'tan', badge = null } = o;
  const S = SEAT_LOOK[look] || SEAT_LOOK.tan, d = 0.44, rec = 0.16;
  // a round foot bolted to the deck, a column, a swivel under the pan
  p.lathe('black', [[0.001, 0], [0.2, 0], [0.205, 0.012], [0.19, 0.03], [0.06, 0.045], [0.001, 0.045]], 14);
  p.cyl('gun', 0.05, h - 0.17, [0, 0.045 + (h - 0.17) / 2, 0], null, 12);
  p.lathe('rubber', [[0.001, 0.045], [0.08, 0.045], [0.07, 0.08], [0.055, 0.12], [0.001, 0.12]], 12);   // (a boot over its foot)
  p.cyl(S.frame, 0.045, 0.1, [0, 0.1, 0], null, 10);
  p.cyl(S.frame, 0.07, 0.03, [0, h - 0.11, 0], null, 12);
  p.slab(S.frame, -w / 2 - 0.01, w / 2 + 0.01, h - 0.1, h - 0.065, -d / 2, d / 2 - 0.01, FLAT);
  p.slab(S.pad, -w / 2 + 0.02, w / 2 - 0.02, h - 0.075, h, -d / 2 + 0.02, d / 2, SOFT);
  p.slab(S.seam, -w / 2 + 0.02, w / 2 - 0.02, h - 0.08, h - 0.006, d / 2 - 0.05, d / 2, SOFT);
  // the back on a spine from behind the pan
  const up = v3(0, Math.cos(rec), -Math.sin(rec)), fwd = v3(0, Math.sin(rec), Math.cos(rec)), foot = v3(0, h + 0.02, -d / 2 + 0.01);
  const B = (x, u, n) => foot.clone().addScaledVector(up, u).addScaledVector(fwd, n).setX(x).toArray();
  p.box(S.frame, [0.06, 0.26, 0.03], [0, h - 0.04, -d / 2 - 0.03], [-0.25, 0, 0], FLAT);
  p.box(S.shell, [w + 0.02, back, 0.05], B(0, back / 2, -0.06), [-rec, 0, 0], { ...FIRM, r: 0.018 });
  p.box(S.pad, [w - 0.02, back - 0.06, 0.07], B(0, back / 2 + 0.01, -0.01), [-rec, 0, 0], SOFT);
  p.box(S.seam, [w - 0.04, 0.03, 0.074], B(0, back * 0.45, -0.01), [-rec, 0, 0], { r: 0 });
  // side bolsters and a stubby headrest, as on the flight seats
  for (const s of [-1, 1]) p.box(S.seam, [0.07, back - 0.08, 0.1], B(s * (w / 2 - 0.035), back / 2 + 0.01, 0.0), [-rec, 0, 0], SOFT);
  p.box(S.shell, [0.3, 0.2, 0.05], B(0, back + 0.08, -0.06), [-rec, 0, 0], { ...FIRM, r: 0.018 });
  p.box(S.pad, [0.28, 0.17, 0.07], B(0, back + 0.085, -0.01), [-rec, 0, 0], SOFT);
  if (badge) p.decal('cp:badge:' + badge, 0.16, 0.04, B(0, back + 0.08, -0.0865), [-rec, PI, 0], '#e8e4da');
  if (arms) for (const s of [-1, 1]) {
    const x = s * (w / 2 + 0.03);
    p.slab(S.frame, x - 0.015, x + 0.015, h - 0.09, h + 0.18, -0.03, 0.03, FLAT);   // (a post at the armrest's middle)
    p.slab(S.arm, x - 0.03, x + 0.03, h + 0.17, h + 0.2, -d / 2 + 0.04, d / 2 - 0.06, { ...SOFT, r: 0.012 });
  }
}

export function jumpSeat(p, o = {}) {
  const { w = 0.44, h = 0.46, open = true, harness = true, look = 'tan' } = o;
  const S = SEAT_LOOK[look] || SEAT_LOOK.tan;
  // the wall frame: a plate with two uprights, a padded back and a headrest on it
  p.slab(S.frame, -w / 2 - 0.035, w / 2 + 0.035, 0.28, 1.4, 0, 0.025, { ...FIRM, cell: 0.6 });
  for (const s of [-1, 1]) p.slab('black', s * (w / 2 + 0.035) - 0.03, s * (w / 2 + 0.035) + 0.03, 0.26, 1.42, 0.0, 0.05, LEAN);
  p.slab(S.pad, -w / 2 + 0.02, w / 2 - 0.02, h + 0.06, h + 0.66, 0.025, 0.085, SOFT);
  p.slab(S.seam, -w / 2 + 0.02, w / 2 - 0.02, h + 0.33, h + 0.36, 0.025, 0.088, { r: 0 });
  p.slab(S.pad, -0.13, 0.13, h + 0.72, h + 0.92, 0.025, 0.09, SOFT);
  // the seat pan on its hinge: down (two struts hold it level) or folded up against the back
  const hinge = [0, h - 0.04, 0.07], dep = 0.4;
  p.cyl('rail', 0.012, w + 0.05, hinge, [0, 0, PI / 2], 10);
  if (open) {
    p.slab(S.frame, -w / 2, w / 2, h - 0.06, h - 0.035, 0.06, 0.06 + dep, FLAT);
    p.slab(S.pad, -w / 2 + 0.01, w / 2 - 0.01, h - 0.04, h, 0.065, 0.06 + dep, SOFT);
    for (const s of [-1, 1]) bar(p, 'black', [s * (w / 2 + 0.006), 0.3, 0.035], [s * (w / 2 - 0.012), h - 0.065, dep - 0.02], 0.018);   // (struts from the uprights' feet)
    p.slab('yellow', -0.05, 0.05, h - 0.06, h - 0.035, 0.06 + dep, 0.07 + dep, { r: 0 });   // (the pull tab)
  } else {
    p.slab(S.frame, -w / 2, w / 2, h - 0.04, h - 0.04 + dep, 0.09, 0.115, FIRM);
    p.slab('yellow', -0.05, 0.05, h - 0.06 + dep, h - 0.035 + dep, 0.09, 0.12, { r: 0 });
  }
  if (harness) for (const s of [-1, 1]) {
    p.slab('black', s * 0.09 - 0.03, s * 0.09 + 0.03, h + 0.62, h + 0.64, 0.025, 0.09, { r: 0 });
    const z = open ? 0.092 : 0.12;
    const end = open ? h + 0.1 : h + 0.42;   // (folded up, the seat covers the back's lower half: the straps stop above it)
    strap(p, S.strap, [[s * 0.09, h + 0.63, 0.09], [s * 0.085, (h + 0.63 + end) / 2, z], [s * 0.075, end, z]], v3(0, 0, 1));
    p.slab('chrome', s * 0.075 - 0.025, s * 0.075 + 0.025, end - 0.03, end + 0.01, z - 0.004, z + 0.008, { r: 0 });
  }
}
