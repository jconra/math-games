// BUTTON PANELS for a cockpit: the small panels the consoles are dressed with, and the overhead and side panels that
// carry them. The detail is in lit caps, printed legends (the decal sheet's 'cp:' cells, kit/tex.js) and screens, not
// in geometry.
// The small panels are centred on x = 0, y = 0 with their back on z = 0, facing +z (a console places them on its faces):
//   buttonGrid(p, o)   a grid of square buttons, some lit (blue, amber, green, white). o: cols (4), rows (3), pitch (0.034),
//                      seed (1: which are lit, and in what colour)
//   switchRow(p, o)    a row of toggle switches, each in a U-shaped guard (the first `covers` under a red flip cover),
//                      a lamp over each, a printed legend under them. o: n (5), pitch (0.045), guards (true), covers (1),
//                      legend ('a' | 'b': which set of names)
//   knobRow(p, o)      a row of rotary knobs over printed tick rings. o: n (3), pitch (0.06)
// The bigger ones stand in the room:
//   overheadPanel(p, o)  a shallow console hung from the ceiling on four bars, between the seats: its face underneath
//                        looks down and back (toward +z) at the seats, lower at its far end (-z). It hangs from y = ceil,
//                        centred on x = 0 and z = 0. A lamp along its far end lights the dashboard; amber strips run
//                        along its sides. o: w (0.4), d (0.75 along z),
//                        ceil (2.5), drop (0.62: how far its far end hangs below the ceiling; its lowest point is then
//                        1.86 m up, over a 1.75 m person's head), body (look.js's CHAR, the cockpit's charcoal, as his
//                        pictures | 'white': the station's off-white)
//   sidePanel(p, o)      a side console along a wall, beside a seat: its back on the wall (z = 0), standing on the deck,
//                        running along x, its top sloping down toward the seat (about 25 degrees) with a screen and panels on it.
//                        o: len (1.0, or 0.5: a screen and a grid only), d (0.35), h (0.7, the top's front edge), body
//                        (CHAR | 'white', as the overhead's), pod (true on a 1.0 m console: a raised screen pod on its +x end,
//                        turned toward the seats, so the dashboard seems to wrap round into it; place a mirrored copy
//                        on the other side)
//   faceOf               where each one's face is (for checks and for placing more on it)
import { part } from '../place.js';
import { LEAN, LIT, CHAR, mfd, glowBox, mount, bar, turn, local } from './look.js';

const PI = Math.PI, FIRM = { r: 0.008, seg: 1, cell: 9, loops: [] };
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export function buttonGrid(p, o = {}) {
  const { cols = 4, rows = 3, pitch = 0.034, seed = 1 } = o, R = rng(seed);
  const W = cols * pitch + 0.024, H = rows * pitch + 0.024, b = pitch * 0.4;
  p.slab('band', -W / 2, W / 2, -H / 2, H / 2, 0, 0.012, { r: 0 });
  const COLS = [LIT.blue, LIT.amber, LIT.green, LIT.red];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = -W / 2 + 0.012 + pitch * (c + 0.5), y = H / 2 - 0.012 - pitch * (r + 0.5), k = R();
    if (k < 0.62) p.glowSlab(COLS[Math.floor(R() * (k < 0.3 ? 2 : 4))], x - b, x + b, y - b, y + b, 0.012, 0.018);
    else p.slab('dark', x - b, x + b, y - b, y + b, 0.012, 0.019, { r: 0 });
  }
}

export function switchRow(p, o = {}) {
  const { n = 5, pitch = 0.045, guards = true, covers = 1, legend = 'a' } = o;
  const W = n * pitch + 0.03, H = 0.115;
  p.slab('band', -W / 2, W / 2, -H / 2, H / 2, 0, 0.012, { r: 0 });
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.015 + pitch * (i + 0.5), y = 0.008, up = i % 3 !== 1;   // (the row stands high enough that a switch thrown down clears its name)
    p.cyl('chrome', 0.008, 0.008, [x, y, 0.016], [PI / 2, 0, 0], 6);
    p.box('white2', [0.007, 0.034, 0.007], [x, y + (up ? 0.013 : -0.013), 0.028], [up ? -0.5 : 0.5, 0, 0], { r: 0 });
    if (guards) {
      for (const s of [-1, 1]) p.slab('black', x + s * 0.015 - 0.0025, x + s * 0.015 + 0.0025, y - 0.025, y + 0.025, 0.012, 0.045, { r: 0 });
      p.slab('black', x - 0.0175, x + 0.0175, y - 0.028, y - 0.023, 0.012, 0.045, { r: 0 });
    }
    if (i < covers) p.box('red', [0.03, 0.05, 0.004], [x, y + 0.022, 0.05], [-1.0, 0, 0], { r: 0 });   // (a flip cover, lifted)
    p.glowSlab(i < covers ? LIT.red : up ? LIT.green : LIT.amber, x - 0.005, x + 0.005, H / 2 - 0.018, H / 2 - 0.01, 0.012, 0.016);
  }
  if (n >= 3 && n <= 6) p.decal(`cp:lg${n}${legend}`, n * pitch, n * pitch / 16, [0, -H / 2 + 0.01, 0.0125], null, '#d9d7cf');
}

export function knobRow(p, o = {}) {
  const { n = 3, pitch = 0.06 } = o, W = n * pitch + 0.02, H = 0.075;
  p.slab('band', -W / 2, W / 2, -H / 2, H / 2, 0, 0.012, { r: 0 });
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.01 + pitch * (i + 0.5);
    p.decal('cp:ticks', 0.052, 0.052, [x, 0.004, 0.0125], null, '#d9d7cf');
    p.lathe('black', [[0.001, 0], [0.017, 0], [0.017, 0.014], [0.001, 0.021]], 8, [x, 0.004, 0.012], [PI / 2, 0, 0]);
    p.cyl(['orange', 'yellow', 'red'][i % 3], 0.009, 0.003, [x, 0.004, 0.0345], [PI / 2, 0, 0], 8);   // (a coloured cap)
    p.box('white2', [0.003, 0.012, 0.002], [x, 0.012, 0.0365], [0, 0, (i - 1) * 0.9], { r: 0 });
  }
  p.decal(`cp:lg${Math.min(6, Math.max(3, n))}c`, n * pitch, n * pitch / 16, [0, -H / 2 + 0.008, 0.0125], null, '#d9d7cf');   // (the knobs' own names)
}

// a housing drawn as an outline in (z, y), pushed out across x (width w, centred)
function across(p, surf, outline, w, r = 0.008) { return p.extrude(surf, outline, w, r).rotateY(-PI / 2).translate(w / 2, 0, 0); }

export const faceOf = {
  // the overhead's face: a point at distance u along it from its far end, and the rot that lays a panel on it (the
  // panel's top toward the near end: looking up at it from the seats, its near end is the top of the view)
  overhead: (o = {}) => {
    const { d = 0.75, ceil = 2.5, drop = 0.62 } = o, yf = ceil - drop, yn = ceil - drop * 0.45, b = Math.atan2(yn - yf, d);
    return { at: (u, off = 0) => [0, yf + Math.sin(b) * u - Math.cos(b) * off, -d / 2 + Math.cos(b) * u + Math.sin(b) * off], rot: [PI / 2 - b, 0, 0], len: Math.hypot(d, yn - yf), normal: [0, -Math.cos(b), Math.sin(b)] };
  },
  side: (o = {}) => {
    const { d = 0.35, h = 0.7 } = o, rise = 0.16, b = Math.atan2(rise, d);
    return { at: (u, off = 0) => [0, h + Math.sin(b) * u + Math.cos(b) * off, d - Math.cos(b) * u + Math.sin(b) * off], rot: [-(PI / 2 - b), 0, 0], len: Math.hypot(d, rise), normal: [0, Math.cos(b), Math.sin(b)] };
  },
};

export function overheadPanel(p, o = {}) {
  const { w = 0.4, d = 0.75, ceil = 2.5, drop = 0.62, body = CHAR } = o, yf = ceil - drop, yn = ceil - drop * 0.45, F = faceOf.overhead({ d, ceil, drop });
  const th = Math.min(0.14, ceil - yn - 0.01), top = (z) => yf + th + (z + d / 2) * (yn - yf) / d;   // (a shallow housing, never through the ceiling)
  across(p, body, [[-d / 2, yf + th], [-d / 2, yf + 0.03], [-d / 2 + 0.03, yf], [d / 2, yn], [d / 2, yn + th]], w, 0.012);
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-d / 4, d / 4]) { bar(p, 'black', [x, top(z) - 0.01, z], [x, ceil, z], 0.04); p.slab('black', x - 0.05, x + 0.05, ceil - 0.012, ceil, z - 0.05, z + 0.05, { r: 0 }); }
  // the dark face plate, then (from the far end) a lamp strip, two switch rows, a button grid, a knob row
  p.box('dark', [w - 0.03, F.len - 0.04, 0.012], F.at(F.len / 2, 0.004), F.rot, FIRM);
  const put = (src, u, off = 0.01) => mount(p, src, { at: F.at(u, off), rot: F.rot }, 'overhead ' + u);
  p.box('black', [w - 0.06, 0.04, 0.012], F.at(0.05, 0.012), F.rot, { r: 0 });
  glowBox(p, 'soft', [w - 0.08, 0.022, 0.004], F.at(0.05, 0.019), F.rot);
  put(part(switchRow, { n: 5, pitch: 0.06, covers: 2, legend: 'a' }), 0.16);
  put(part(buttonGrid, { cols: 8, rows: 2, pitch: 0.04, seed: 5 }), 0.3);
  put(part(switchRow, { n: 4, pitch: 0.075, covers: 0, legend: 'b' }), 0.44);
  put(part(knobRow, { n: 4, pitch: 0.08 }), 0.58);
  put(part(buttonGrid, { cols: 8, rows: 2, pitch: 0.04, seed: 15 }), F.len - 0.1);
  for (const s of [-1, 1]) { const [, y, z] = F.at(F.len / 2, -0.035); glowBox(p, LIT.amber, [0.006, 0.014, F.len - 0.12], [s * (w / 2 + 0.002), y, z], [-Math.atan2(yn - yf, d), 0, 0]); }
  const L = F.at(0.05, 0.05); p.light(L, 0.5, [0.95, 0.97, 1], [0, -0.6, -0.8], 2.6);
}

export function sidePanel(p, o = {}) {
  const { len = 1.0, d = 0.35, h = 0.7, body = CHAR } = o, F = faceOf.side({ d, h }), short = len < 0.75, pod = o.pod ?? !short;
  p.slab('black', -len / 2 + 0.02, len / 2 - 0.02, 0, 0.06, 0.02, d - 0.04, { r: 0 });
  across(p, body, [[0, 0.06], [d - 0.02, 0.06], [d - 0.02, h - 0.03], [d, h - 0.01], [d, h], [0, h + 0.16]], len, 0.012);
  for (const s of [-1, 1]) p.slab('white2', s * len / 2 - 0.006, s * len / 2 + 0.006, 0.08, h - 0.06, 0.03, d - 0.03, { r: 0 });   // (off-white end plates)
  p.box('dark', [len - 0.02, F.len - 0.01, 0.012], F.at(F.len / 2, 0.004), F.rot, FIRM);
  p.slab('black', -len / 2, len / 2, h - 0.045, h - 0.01, d - 0.012, d + 0.008, { r: 0 });
  p.glowSlab(LIT.amber, -len / 2 + 0.03, len / 2 - 0.03, h - 0.06, h - 0.05, d - 0.02, d - 0.012);
  // down its front: a status strip with four lamps, an off-white line along the kick
  p.slab('dark', -len / 2 + 0.06, len / 2 - 0.06, 0.4, 0.46, d - 0.02, d - 0.014, { r: 0 });
  [LIT.green, LIT.green, LIT.amber, LIT.blue].forEach((c, i) => p.glowSlab(c, -len / 2 + 0.1 + i * 0.05, -len / 2 + 0.13 + i * 0.05, 0.42, 0.44, d - 0.014, d - 0.011));
  p.slab('white2', -len / 2 + 0.02, len / 2 - 0.02, 0.1, 0.115, d - 0.02, d - 0.016, { r: 0 });
  for (let k = 0; k < 5; k++) p.slab('black', -len / 2 + 0.08, -len / 2 + 0.08 + Math.min(0.3, len * 0.35), 0.17 + k * 0.035, 0.182 + k * 0.035, d - 0.02, d - 0.016, { r: 0 });   // (vents)
  const put = (src, x, u) => { const [, y, z] = F.at(u, 0.01); mount(p, src, { at: [x, y, z], rot: F.rot }, 'side ' + x); };
  if (short) {
    put(part(mfd, { face: 'text', w: 0.2 }), -0.1, 0.2);
    put(part(buttonGrid, { cols: 3, rows: 4, pitch: 0.034, seed: 7 }), 0.15, 0.18);
  } else {
    put(part(mfd, { face: 'text', w: 0.22 }), -len / 2 + 0.17, 0.2);
    put(part(switchRow, { n: 4, pitch: 0.05, covers: 1, legend: 'b' }), -0.06, 0.12);
    put(part(knobRow, { n: 3, pitch: 0.06 }), -0.06, 0.26);
    if (!pod) put(part(buttonGrid, { cols: 4, rows: 4, pitch: 0.034, seed: 8 }), len / 2 - 0.16, 0.18);
  }
  if (pod) {
    // a raised pod on the +x end, up to 1.18 m, turned 35 degrees toward the seats: a screen, a grid, a lit top edge
    const top = 1.18, rot = turn(-0.61, 0.1), c = [len / 2 - 0.2, (h - 0.02 + top) / 2, d - 0.17], H = top + 0.02 - h, on = (x, y, off) => local(c, rot, x, y, 0.07 + off);
    p.box(body, [0.34, H, 0.14], c, rot, { r: 0.012, seg: 1, cell: 9, loops: [] });
    p.box('black', [0.345, 0.02, 0.145], local(c, rot, 0, H / 2 - 0.01, 0), rot, { r: 0 });
    glowBox(p, LIT.amber, [0.32, 0.006, 0.006], on(0, H / 2 - 0.025, 0.003), rot);
    mount(p, part(mfd, { face: 'bars', w: 0.29 }), { at: on(0, H / 2 - 0.13, 0.002), rot }, 'pod screen');
    mount(p, part(buttonGrid, { cols: 7, rows: 2, pitch: 0.038, seed: 16 }), { at: on(0, -H / 2 + 0.19, 0.002), rot }, 'pod buttons');   // (above where the pod sinks into the console's top)
  }
  p.light([0, h + 0.15, d + 0.1], 0.25, [0.4, 0.65, 1], [0, 0.3, 1], 1.8);
}
