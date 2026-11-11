// ENGINEERING: the reactor core that glows, with the station's pipe runs (kit/wallkit.js) going in and out of it, and a
// yellow safety rail round it, as the game's maker's engineering pictures have.
//   reactor(p, o)
//     o.form 'upright'  'upright': a glowing core standing floor to ceiling in a cage of bars and rings, between a
//                       charcoal base housing and a top housing whose collar meets the ceiling; 'drum': a long drum
//                       lying along x on two cradles, heavy charcoal rings with a lit seam in each, a white pipe and
//                       two copper ones up from it into the ceiling (his engineering pictures' drum, as big as the room
//                       takes: its depth o.w, 1.6 by default, less 0.7 m: o.w 2.0 gives a drum 1.3 m across), its rail
//                       0.3 m clear of its rings
//     o.w 1.2           the footprint (upright: w x w; drum: its depth along z)
//     o.len 2.0         the drum's length along x
//     o.h 2.5           the ceiling (the upright's collar and the drum's pipe reach it, no further)
//     o.pipes 0.4       how far a pipe run leaves the footprint each side along x (0: none); a ship carries it on to a
//                       wall with more of the wall kit's pipe runs (the upright's at o.pipeY, 2.138 m up: a flange's
//                       hanger from it just meets a 2.5 m ceiling)
//     o.rail true       the yellow rail (open on the +z side, where the engineer comes up to it)
// Frame: free-standing, centred on the origin, on the deck (y = 0); its open side faces +z.
import * as THREE from 'three';
import { circle, rrect, cylinder, lathe, sweep, put } from '../../geo.js';
import { pipe } from '../../wallkit.js';
import { part, placeInto } from '../place.js';
import { lean } from './galley.js';

const PI = Math.PI;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const CORE = [2.0, 4.6, 8.0], CORE2 = [1.0, 2.6, 5.2];   // the core's glow: white-blue, and a deeper blue for its bands
const ring = (r, y, n = 28) => Array.from({ length: n }, (_, i) => { const a = i / n * PI * 2, c = Math.cos(a), s = Math.sin(a); return { p: v3(c * r, y, s * r), x: v3(c, 0, s), y: v3(0, 1, 0) }; });
// a pipe run of the station's (wallkit 'straight', x -1..1) from x0 to x1 at height y, z: its length by a scale on x
function run(p, x0, x1, y, z) { placeInto(p, part(pipe, 'straight'), { at: [(x0 + x1) / 2, y, z], scale: [Math.abs(x1 - x0) / 2, 1, 1] }); }

// the yellow rail: posts and two rails round a U from (-hx, z) on the +z side, back round -z, to (hx, z)
function rail(p, hx, hz, open) {
  const rc = 0.12, path = (y) => {
    const out = [], seg = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.4)); for (let i = 0; i < n; i++) { const t = i / n; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } };
    // straight legs with rounded corners (rc) at the two back corners
    seg([-hx, open], [-hx, -hz + rc]);
    for (let k = 0; k <= 6; k++) { const a = PI + PI / 2 * k / 6; out.push([-hx + rc + Math.cos(a) * rc, -hz + rc + Math.sin(a) * rc]); }
    seg([-hx + rc, -hz], [hx - rc, -hz]);
    for (let k = 0; k <= 6; k++) { const a = -PI / 2 + PI / 2 * k / 6; out.push([hx - rc + Math.cos(a) * rc, -hz + rc + Math.sin(a) * rc]); }
    seg([hx, -hz + rc], [hx, open]); out.push([hx, open]);
    const fr = out.map(([x, z]) => ({ p: v3(x, y, z), x: v3(1, 0, 0), y: v3(0, 1, 0) }));
    // (each point's frame: y up, x across the way it runs)
    for (let i = 0; i < fr.length; i++) { const a = fr[Math.max(0, i - 1)].p, b = fr[Math.min(fr.length - 1, i + 1)].p, t = b.clone().sub(a).normalize(); fr[i].x = new THREE.Vector3().crossVectors(fr[i].y, t); }
    return fr;
  };
  for (const y of [0.55, 1.05]) p.sweep('yellow', circle(0.02, 8), path(y), { caps: true });
  const c = rc * (1 - Math.SQRT1_2);   // (the back corners' posts sit on the rounded corner)
  for (const [x, z] of [[-hx, open], [hx, open], [-hx + c, -hz + c], [hx - c, -hz + c], [0, -hz], [-hx, (open - hz) / 2], [hx, (open - hz) / 2]]) { p.cyl('yellow', 0.022, 1.05, [x, 0.525, z], null, 10); p.cyl('black', 0.045, 0.02, [x, 0.01, z], null, 12); }
}

export function reactor(p, o = {}) {
  p = lean(p);
  const form = o.form ?? 'upright', w = o.w ?? 1.2, h = o.h ?? 2.5, out = o.pipes ?? 0.4, py = o.pipeY ?? 2.138, hw = w / 2;
  if (form === 'drum') return drum(p, o);
  // the base: a dark plinth, a charcoal housing stepping in to the core
  p.cyl('dark', hw - 0.04, 0.1, [0, 0.05, 0], null, 28);
  p.lathe('black', [[0.001, 0.1], [0.46, 0.1], [0.47, 0.13], [0.47, 0.5], [0.44, 0.55], [0.33, 0.6], [0.001, 0.6]], 28);
  p.sweep('yellow', rrect(0.012, 0.05, 0.004, 1), ring(0.472, 0.4), { closed: true });
  // the core: a glowing column, a sleeve of glass round it, bars and rings caging it
  p.add('glow', cylinder(0.2, 1.3, [0, 1.25, 0], 24), CORE);
  p.add('glass', cylinder(0.27, 1.28, [0, 1.25, 0], 28));
  for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2 + PI / 8; p.box('gun', [0.045, 1.3, 0.045], [Math.cos(a) * 0.3, 1.25, Math.sin(a) * 0.3], [0, -a, 0], { r: 0.012 }); }
  for (const y of [0.78, 1.25, 1.72]) { p.sweep('black', rrect(0.07, 0.07, 0.015, 1), ring(0.31, y), { closed: true }); p.add('glow', sweep(rrect(0.008, 0.02, 0.003, 1), ring(0.346, y, 28), { closed: true }), CORE2); }
  // the top housing, a yellow band, the collar up to the ceiling with coolant lines into it
  p.lathe('black', [[0.001, 1.9], [0.33, 1.9], [0.44, 1.95], [0.47, 2.0], [0.47, 2.2], [0.44, 2.24], [0.001, 2.24]], 28);
  p.sweep('yellow', rrect(0.012, 0.05, 0.004, 1), ring(0.472, 2.1), { closed: true });
  p.cyl('dark', 0.3, h - 2.24, [0, (h + 2.24) / 2, 0], null, 24);
  p.slab('black', -0.38, 0.38, h - 0.03, h, -0.38, 0.38, { r: 0.01, skip: ['+y'] });
  for (const a of [PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4]) p.cyl('orange', 0.03, 1.6, [Math.cos(a) * 0.39, 1.25, Math.sin(a) * 0.39], null, 10);   // copper-orange coolant lines
  // the pipe runs, in through sleeves on the top housing and out along x
  if (out > 0) for (const sx of [-1, 1]) {
    const x0 = sx * 0.47, x1 = sx * (hw + out);
    run(p, x0, x1, py, 0);
    placeInto(p, part(pipe, 'sleeve'), { at: [sx * 0.5, py, 0] });
    placeInto(p, part(pipe, sx > 0 ? 'valve' : 'flange'), { at: [sx * (hw + 0.1), py, 0] });
  }
  if (o.rail ?? true) rail(p, hw - 0.06, hw - 0.06, hw - 0.12);
  // a little status panel on the base housing, facing +z
  p.slab('dark', -0.12, 0.12, 0.25, 0.42, 0.44, 0.49, { r: 0.008 }); for (const [x, c] of [[-0.06, 'green'], [0, 'amber'], [0.06, 'blue']]) p.glowSlab(c, x - 0.018, x + 0.018, 0.36, 0.385, 0.49, 0.494);
  p.light([0, 1.25, 0.45], 2.6, [0.45, 0.72, 1], null, 5);
  p.light([0, 1.25, -0.45], 1.6, [0.45, 0.72, 1], null, 4);
}

// the drum: lying along x, rings round it, glowing bands between, end caps, cradles, a pipe up and runs out each end
function drum(p, o) {
  const len = o.len ?? 2.0, w = o.w ?? 1.6, h = o.h ?? 2.5, out = o.pipes ?? 0.4, R = Math.min(0.75, w / 2 - 0.35), cy = R + 0.25, hl = len / 2;   // (0.35: its rings, and its rail 0.3 m clear of them)
  const along = (g, x) => { put(g, [x, cy, 0], [0, 0, PI / 2]); return g; };
  // the shell in segments, a glowing band between each, a charcoal ring over each joint
  const n = Math.max(2, Math.round((len - 0.5) / 0.4)), L = (len - 0.5) / n;
  for (let k = 0; k < n; k++) {
    const x = -hl + 0.25 + (k + 0.5) * L;
    p.add('solid', along(cylinder(R, L - 0.1, [0, 0, 0], 32), x), 'grey');
    if (k) { const xj = -hl + 0.25 + k * L, t = 0.035 + R * 0.06; p.add('glow', along(cylinder(R - 0.01, 0.1, [0, 0, 0], 32), xj), CORE); p.add('solid', along(lathe([[R - 0.005, -0.09], [R + t, -0.085], [R + t, -0.03], [R - 0.005, -0.025]], 32), xj), 'black'); p.add('solid', along(lathe([[R - 0.005, 0.025], [R + t, 0.03], [R + t, 0.085], [R - 0.005, 0.09]], 32), xj), 'black'); }
  }
  // the end caps: domed charcoal, a yellow ring
  for (const sx of [-1, 1]) {
    const g = lathe([[R + 0.04, 0], [R + 0.04, 0.12], [R * 0.8, 0.2], [R * 0.4, 0.25], [0.001, 0.26]], 32); put(g, [sx * (hl - 0.25), cy, 0], [0, 0, -sx * PI / 2]); p.add('solid', g, 'gun');
    p.add('solid', along(cylinder(R + 0.045, 0.03, [0, 0, 0], 32), sx * (hl - 0.27)), 'yellow');
  }
  // two cradles
  for (const x of [-hl + 0.45, hl - 0.45]) { p.slab('black', x - 0.09, x + 0.09, 0, cy - R * 0.55, -R * 0.85, R * 0.85, { r: 0.02 }); p.slab('dark', x - 0.12, x + 0.12, 0, 0.06, -R - 0.02, R + 0.02, { r: 0.01 }); }
  // a pipe up into the ceiling from the drum's top, runs out of each end cap along x
  const top = cy + R;
  placeInto(p, part(pipe, 'straight'), { at: [0, (top + h) / 2, 0], rot: [0, 0, PI / 2], scale: [(h - top) / 2, 1, 1] });
  placeInto(p, part(pipe, 'sleeve'), { at: [0, top + 0.03, 0], rot: [0, 0, PI / 2] });
  // two copper lines up out of the shell's shoulders into the ceiling, a charcoal collar where each leaves it
  for (const sx of [-1, 1]) {
    const x = sx * Math.min(hl - 0.5, hl * 0.55), y0 = cy + R * 0.92, z = -R * 0.38;
    p.cyl('orange', 0.045, h - y0, [x, (y0 + h) / 2, z], null, 14); p.cyl('black', 0.065, 0.06, [x, y0 + 0.03, z], null, 14); p.cyl('black', 0.065, 0.04, [x, h - 0.02, z], null, 14);
  }
  if (out > 0) for (const sx of [-1, 1]) { run(p, sx * (hl - 0.05), sx * (hl + out), cy, 0); placeInto(p, part(pipe, sx > 0 ? 'valve' : 'sleeve'), { at: [sx * (hl + (sx > 0 ? 0.15 : 0.04)), cy, 0] }); }
  // a straight rail along the front (+z), on posts
  if (o.rail ?? true) {
    const z = R + 0.06 + 0.25, x0 = -hl + 0.3, x1 = hl - 0.3;
    for (const y of [0.55, 1.05]) p.sweep('yellow', circle(0.02, 8), [{ p: v3(x0, y, z), x: v3(0, 0, -1), y: v3(0, 1, 0) }, { p: v3(x1, y, z), x: v3(0, 0, -1), y: v3(0, 1, 0) }], { caps: true });
    for (let k = 0; k <= 2; k++) { const x = x0 + (x1 - x0) * k / 2; p.cyl('yellow', 0.022, 1.05, [x, 0.525, z], null, 10); p.cyl('black', 0.045, 0.02, [x, 0.01, z], null, 12); }
  }
  p.light([0, cy, R + 0.3], 2.0, [0.45, 0.72, 1], null, 5);
}
