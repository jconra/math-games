// COCKPIT CONSOLES: the curved dashboard, the engineer's station and a small wall console. Their screens are the
// station's screen sheet (look.js's MFD crops, and the station's own wall screen), their panels panels.js's.
//   dashboard(p, o)  the curved dashboard across the front of the cockpit, for two or three seats: screens edge to edge
//                    in two rows, switches on the shelf, and the maths on a hero screen raised on its own hood. Its near edge (the
//                    seats' side) runs along an arc whose ends come back toward the seats; it faces +z, its near edge's
//                    middle at x = 0, z = 0, reaching forward (-z) toward the nose. Its section, from the seats: a
//                    padded lip over the knees, a shelf of switches, a sloped face of screens (two before each seat), a
//                    hood, a top deck under the windscreen; under the lip, room for the knees and the feet, closed by a
//                    toe board. o: seats (2 | 3), w (the near edge's width: 2.0 for two, 3.0 for three), bow (how far its
//                    ends come back, 0.17: clear of the seats' outer armrests), depth (0.7), h (the top of the face of screens, 1.08; the hood stands 0.06
//                    over it), knee (the lip's underside, 0.66), toe (the toe board, 0.45 forward of the edge), seatsAt (the
//                    seats' x, in its own frame: [-0.5, 0.5] or [-1, 0, 1]), deckY (the top deck's height at its far
//                    end, h: give depth and deckY to run the deck on to a windscreen's foot)
//   engineerStation(p, o)  a sit-down console against a wall (its back on z = 0, facing +z): a desk with knee room,
//                    screens on a raised back panel, switches and a lamp hood. o: w (1.0: 1.0, 1.5, 2.0 on the ship
//                    grid), d (0.5), h (the desk top, 0.76)
//   wallConsole(p, o)  the station's wall screen on a back plate with a keypad shelf under it; its back on the wall
//                    (z = 0), its bottom `y` above the deck. o: face ('status' | 'terminal' | 'radar' | 'math'),
//                    y (1.0), w (0.64)
//   dashFace(o)      where the dashboard's faces are: shelf(x) and screens(x) -> { at, rot } for a panel there
import * as THREE from 'three';
import { MeshData } from '../../geo.js';
import { wallScreen } from '../../wallkit.js';
import { part } from '../place.js';
import { LEAN, LIT, CHAR, CHAR2, MFD, mfd, turn, glowBox, mount, bar, local } from './look.js';
import { buttonGrid, switchRow, knobRow } from './panels.js';

const PI = Math.PI, FIRM = { r: 0.01, seg: 1, cell: 9, loops: [] };

// the dashboard's shape for options o: its arc and its section (a closed outline in (s, y), s forward from the near
// edge, counter-clockwise; each point names the surface of the edge that ends there: null, the floor, isn't drawn)
function dashShape(o = {}) {
  const seats = o.seats === 3 ? 3 : 2, w = o.w ?? (seats === 3 ? 3.0 : 2.0), bow = o.bow ?? 0.17, depth = o.depth ?? 0.7, h = o.h ?? 1.08, knee = o.knee ?? 0.66, toe = o.toe ?? 0.45, deckY = o.deckY ?? h;
  const R = (w * w / 4 + bow * bow) / (2 * bow), T = Math.asin(w / 2 / R);
  const seatsAt = o.seatsAt || (seats === 3 ? [-1, 0, 1] : [-0.5, 0.5]);
  const fs = 0.12, fe = fs + (h - 0.02 - knee - 0.12);   // (the face of screens rises at 45 degrees from the shelf to the hood)
  const shelf = [[0, knee + 0.09], [fs, knee + 0.12]], face = [[fs, knee + 0.12], [fe, h - 0.02]];
  const outline = [
    [toe, 0, 'body'], [depth, 0, null], [depth, deckY, 'body'], [fe + 0.06, h + 0.06, 'deck'], [fe - 0.02, h + 0.05, 'black'], [fe - 0.04, h + 0.02, 'black'],
    [fe, h - 0.02, 'black'], [fs, knee + 0.12, 'top'], [0, knee + 0.09, 'body'], [-0.03, knee + 0.07, 'black'], [-0.03, knee + 0.04, 'black'],
    [0, knee, 'black'], [0.1, knee - 0.02, 'body'], [toe, 0.4, 'body'],
  ];
  return { seats, w, bow, depth, h, knee, toe, deckY, R, T, seatsAt, shelf, face, fs, fe, outline };
}
// a point on the arc: s forward of the near edge, at height y, at angle th round the arc
const arcAt = (R, s, y, th) => [(R + s) * Math.sin(th), y, R - (R + s) * Math.cos(th)];
// where a panel goes on a run of the section (from a to b in (s, y)): u along it, `off` out of it, at the arc angle
// for x; the rot lays a panel's face (+z) on it, its top up the slope
function onRun(S, [a, b], u, x, off = 0) {
  const ds = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(ds, dy), ns = dy / L, ny = -ds / L;   // (the outward normal: the outline runs b to a)
  const s = a[0] + ds * u / L - ns * off, y = a[1] + dy * u / L - ny * off;
  const th = Math.asin(Math.max(-1, Math.min(1, x / (S.R + s))));
  return { at: arcAt(S.R, s, y, th), rot: turn(-th, Math.atan2(-ny, ns)), len: L, th };   // (the lean back: atan2(ds, dy))
}
export function dashFace(o = {}) {
  const S = dashShape(o);
  return { S, shelf: (x, u = 0.06, off = 0.002) => onRun(S, S.shelf, u, x, off), screens: (x, u, off = 0.002) => onRun(S, S.face, u ?? Math.hypot(S.fe - S.fs, S.h - S.knee - 0.14) / 2, x, off) };
}

export function dashboard(p, o = {}) {
  const F = dashFace(o), S = F.S, { R, T, outline } = S, n = Math.max(14, Math.round(S.w * 8));
  // the body: each edge of the section swept round the arc, in its own surface; the ends closed flat
  const m = {};
  for (let k = 0; k < outline.length; k++) {
    const [s0, y0] = outline[k], [s1, y1] = outline[(k + 1) % outline.length], surf = outline[(k + 1) % outline.length][2];
    if (!surf) continue;
    const ds = s1 - s0, dy = y1 - y0, L = Math.hypot(ds, dy), ns = dy / L, ny = -ds / L, M = (m[surf] ||= new MeshData());
    const base = M.count;
    for (let i = 0; i <= n; i++) {
      const th = -T + 2 * T * i / n, st = Math.sin(th), ct = Math.cos(th);
      for (const [s, y] of [[s0, y0], [s1, y1]]) M.v((R + s) * st, y, R - (R + s) * ct, ns * st, ny, -ns * ct, (R + s) * th, y);
    }
    for (let i = 0; i < n; i++) M.quad(base + i * 2, base + i * 2 + 1, base + i * 2 + 3, base + i * 2 + 2);
  }
  const SURFS = { body: CHAR, top: CHAR2, deck: { c: '#26292c', r: 0.85, m: 0.1, w: 0.4 }, black: 'black' };   // (a matte deck: no glare between the screens and the window)
  for (const [surf, M] of Object.entries(m)) p.add('solid', M.geometry(), SURFS[surf] || surf);
  const shape = new THREE.Shape(outline.map(([s, y]) => new THREE.Vector2(s, y)));
  for (const sg of [-1, 1]) {
    const g = new THREE.ShapeGeometry(shape), P = g.attributes.position, N = g.attributes.normal, th = sg * T, nx = sg * Math.cos(th), nz = Math.sin(T);
    for (let i = 0; i < P.count; i++) { const [x, y, z] = arcAt(R, P.getX(i), P.getY(i), th); P.setXYZ(i, x, y, z); N.setXYZ(i, nx, 0, nz); }
    p.add('solid', g, 'white2');
  }
  // the ends' edges: a charcoal trim along the deck's end
  for (const sg of [-1, 1]) { const th = sg * T, a = arcAt(R, S.fe + 0.06, S.h + 0.06, th), b = arcAt(R, S.depth, S.deckY, th); bar(p, 'black', a.map((v, i) => v + (i === 0 ? sg * 0.006 : 0)), b.map((v, i) => v + (i === 0 ? sg * 0.006 : 0)), [0.012, 0.03]); }
  // the hood's lamp: a soft strip under its lip, all along
  const lamp = new MeshData();
  for (let i = 0; i <= n; i++) { const th = -T * 0.97 + 1.94 * T * i / n; for (const s of [S.fe - 0.03, S.fe - 0.005]) { const [x, y, z] = arcAt(R, s, S.h - 0.008, th); lamp.v(x, y, z, 0, -1, 0); } }
  for (let i = 0; i < n; i++) lamp.quad(i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  p.add('glow', lamp.geometry(), LIT.white);
  const strip = (s0, y0, s1, y1, nrm, color) => { const M = new MeshData(); for (let i = 0; i <= n; i++) { const th = -T * 0.98 + 1.96 * T * i / n; for (const [s, y] of [[s0, y0], [s1, y1]]) { const [x, yy, z] = arcAt(R, s, y, th); M.v(x, yy, z, -Math.sin(th) * nrm[0], nrm[1], Math.cos(th) * nrm[0]); } } for (let i = 0; i < n; i++) M.quad(i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); p.add('glow', M.geometry(), color); };
  strip(S.fe - 0.043, S.h + 0.024, S.fe - 0.033, S.h + 0.038, [1, 0.3], LIT.amber);  // (an amber line along the hood's front edge)
  for (let i = 1; i < n; i += 2) { const th = -T + 2 * T * i / n, c = arcAt(R, -0.033, S.knee + 0.055, th), g = new THREE.BoxGeometry(0.03, 0.012, 0.004); g.rotateY(-th); g.translate(...c); p.add('glow', g, i % 4 === 1 ? LIT.green : LIT.blue); }   // (lamps along the lip)
  strip(S.toe - 0.004, 0.33, S.toe - 0.004, 0.345, [1, 0], LIT.blue);                 // (a footwell light along the toe board)
  for (let i = 1; i < n; i += 2) { const th = -T + 2 * T * i / n, c = arcAt(R, S.toe - 0.005, 0.27, th), g = new THREE.BoxGeometry(0.03, 0.02, 0.004); g.rotateY(-th); g.translate(...c); p.add('glow', g, i % 4 === 1 ? LIT.amber : LIT.green); }   // (lamps down the toe board)
  // the face: screens edge to edge in two rows, as the wall of screens in his pictures (two columns before each seat,
  // one between two seats, a narrower one at each end); a row of switches on the shelf before each seat; and the maths
  // on a hero screen twice their size, raised on its own hood over the middle (with three abreast, over the gap on the
  // first seat's side), out of every flier's own window
  const len = Math.hypot(S.fe - S.fs, S.h - S.knee - 0.14), faceR = R + (S.fs + S.fe) / 2, two = len >= 0.39;
  const nudge = o.nudge || 0;   // (for the checks only: every panel pushed out of its face by this much)
  const at = (x, run, src, u) => { const q = run === 'shelf' ? F.shelf(x, u, 0.002 + nudge) : F.screens(x, u, 0.002 + nudge); mount(p, src, { at: q.at, rot: q.rot }, run + ' ' + x.toFixed(2)); return q; };
  const rowsU = two ? [0.109, 0.307] : [len / 2 + 0.022];
  const column = (x, faces, w = 0.3) => rowsU.forEach((u, r) => at(x, 'face', part(mfd, { face: faces[r % faces.length], w }), u));
  const COLS = [['radar', 'bars', 'text', 'radar'], ['bars', 'radar', 'radar', 'text'], ['radar', 'text', 'bars', 'radar']];
  S.seatsAt.forEach((xs, i) => {
    const f = COLS[i % 3];
    column(xs - 0.165, [f[0], f[2]]); column(xs + 0.165, [f[1], f[3]]);
    at(xs, 'shelf', part(switchRow, { n: 5, pitch: 0.045, covers: i === 0 ? 1 : 0, legend: i % 2 ? 'b' : 'a' }));
    const q = F.screens(xs, len / 2, 0.25); p.light(q.at, 0.4, [0.35, 0.65, 1], [Math.sin(-q.th), 0.2, Math.cos(q.th)], 2.4);
  });
  if (S.seats === 2) { column(0, ['text', 'bars']); at(0, 'shelf', part(buttonGrid, { cols: 6, rows: 2, pitch: 0.036, seed: 2 })); }
  else for (const s of [-1, 1]) at(s * 0.5, 'shelf', part(knobRow, { n: 3, pitch: 0.06 }));
  const xo = Math.max(...S.seatsAt.map(Math.abs)) + 0.335, room = Math.sin(T) * faceR - xo;
  if (room > 0.12) for (const s of [-1, 1]) {
    const x = s * (xo + room / 2);
    if (room > 0.2) column(x - s * 0.012, ['text', 'bars'], Math.min(0.24, room - 0.06));   // (clear of the trim at the face's end)
    else { at(x, 'face', part(knobRow, { n: 2, pitch: 0.06 }), 0.09); at(x, 'face', part(buttonGrid, { cols: 3, rows: 3, pitch: 0.034, seed: s < 0 ? 9 : 10 }), 0.25); }
    at(x, 'shelf', part(buttonGrid, { cols: 3, rows: 2, pitch: 0.034, seed: s < 0 ? 11 : 12 }));
  }
  // the hero: a housing standing on the deck just behind the hood, a hood of its own over the screen with an amber lip
  {
    const x = S.seats === 2 ? 0 : (S.seatsAt[0] < 0 ? -0.5 : 0.5), sd = S.fe + 0.17, th = Math.asin(x / (R + sd)), base = arcAt(R, sd, S.h + 0.04, th);
    const rot = turn(-th, 0.18), c = [base[0], S.h + 0.2, base[2]], W = 0.56, H = 0.27;
    p.box('black', [W - 0.08, 0.16, 0.14], local([base[0], S.h + 0.1, base[2]], turn(-th, 0), 0, 0, -0.03), turn(-th, 0), { r: 0.01, seg: 1, cell: 9, loops: [] });   // (its foot on the deck)
    p.box('black', [W, H, 0.07], c, rot, { r: 0.012, seg: 1, cell: 9, loops: [] });
    p.box('black', [W + 0.02, 0.025, 0.1], local(c, rot, 0, H / 2 + 0.006, 0.02), rot, { r: 0.006, seg: 1, cell: 9, loops: [] });   // (its hood)
    glowBox(p, LIT.amber, [W - 0.02, 0.006, 0.006], local(c, rot, 0, H / 2 - 0.006, 0.072), rot);
    mount(p, part(mfd, { face: 'sum', w: 0.5 }), { at: local(c, rot, 0, 0.004, 0.035 + 0.002 + nudge), rot }, 'hero sum');
  }
  // a dark trim and an amber line up each end, where the face meets the off-white cap
  for (const sg of [-1, 1]) { const th = sg * T * 0.995, a = arcAt(R, S.fs, S.knee + 0.12, th), b = arcAt(R, S.fe, S.h - 0.02, th); bar(p, 'black', a, b, [0.03, 0.012]); glowBox(p, LIT.amber, [0.006, 0.006, Math.hypot(...b.map((v, i) => v - a[i])) - 0.02], a.map((v, i) => (v + b[i]) / 2 + (i === 1 ? 0.004 : 0)), turn(-th, -Math.PI / 4)); }
}

export function engineerStation(p, o = {}) {
  const { w = 1.0, d = 0.5, h = 0.76 } = o, back = 1.5, units = w >= 1.0;
  // the desk: closed units at the ends with vents and a lamp (knee room between), a dark top with a black front edge,
  // a raised back panel
  const ux = units ? Math.min(0.35, (w - 0.6) / 2) : 0;
  if (units) for (const s of [-1, 1]) {
    const x0 = s < 0 ? -w / 2 : w / 2 - ux, x1 = s < 0 ? -w / 2 + ux : w / 2;
    if (ux < 0.12) continue;
    p.slab('black', x0 + 0.02, x1 - 0.02, 0, 0.08, 0.02, d - 0.05, LEAN);
    p.slab('white', x0, x1, 0.08, h - 0.035, 0, d - 0.03, { ...FIRM, r: 0.012 });
    p.slab('white2', x0 + 0.02, x1 - 0.02, 0.1, h - 0.06, d - 0.03, d - 0.012, LEAN);
    for (let k = 0; k < 6; k++) p.slab('dark', x0 + 0.05, x1 - 0.05, 0.16 + k * 0.03, 0.172 + k * 0.03, d - 0.012, d - 0.008, { r: 0 });
    p.slab('black', x0 + 0.05, x0 + 0.11, h - 0.16, h - 0.12, d - 0.012, d - 0.006, { r: 0 }); p.glowSlab(s < 0 ? LIT.green : LIT.amber, x0 + 0.06, x0 + 0.1, h - 0.152, h - 0.128, d - 0.006, d - 0.003);
  }
  p.slab('white', -w / 2 + ux, w / 2 - ux, 0.3, h - 0.035, 0, 0.06, FIRM);   // (the modesty panel at the back of the knee room)
  p.slab('band', -w / 2, w / 2, h - 0.035, h, 0, d, { ...FIRM, cell: 0.6 });
  p.slab('black', -w / 2, w / 2, h - 0.045, h + 0.004, d - 0.03, d + 0.01, LEAN);
  p.slab('white2', -w / 2, w / 2, h, back, 0, 0.08, { ...FIRM, r: 0.014, cell: 0.6 });
  p.slab('band', -w / 2 + 0.01, w / 2 - 0.01, h + 0.01, back - 0.01, -0.004, 0.0, { r: 0 });   // (a dark back, for when it stands free)
  p.slab('black', -w / 2 + 0.03, w / 2 - 0.03, h + 0.12, back - 0.12, 0.08, 0.09, LEAN);
  // the hood with its lamp, lighting the desk
  p.slab('white2', -w / 2, w / 2, back - 0.04, back, 0, 0.2, { ...FIRM, r: 0.014 });
  glowBox(p, 'soft', [w - 0.1, 0.006, 0.03], [0, back - 0.043, 0.16]);
  p.light([0, back - 0.15, 0.3], 0.45, [0.95, 0.97, 1], [0, -0.8, 0.6], 2.2);
  // screens across the back panel, switches under them, a grid and knobs on the desk's front
  const faces = ['bars', 'text', 'scope', 'radar'], ns = Math.max(1, Math.floor((w - 0.08) / 0.4)), pitch = (w - 0.08) / ns;
  for (let i = 0; i < ns; i++) {
    const x = -w / 2 + 0.04 + pitch * (i + 0.5);
    mount(p, part(mfd, { face: faces[i % 4], w: faces[i % 4] === 'scope' ? 0.24 : Math.min(0.36, pitch - 0.06) }), { at: [x, h + 0.44, 0.09] }, 'screen ' + i);
    mount(p, part(switchRow, { n: 4, pitch: 0.05, covers: i ? 0 : 1, legend: i % 2 ? 'b' : 'a' }), { at: [x, h + 0.2, 0.09] }, 'switches ' + i);
  }
  mount(p, part(buttonGrid, { cols: 6, rows: 2, pitch: 0.036, seed: 13 }), { at: [-w / 4, h, d - 0.12], rot: [-PI / 2, 0, 0] }, 'buttons');
  mount(p, part(knobRow, { n: 3, pitch: 0.06 }), { at: [w / 4, h, d - 0.12], rot: [-PI / 2, 0, 0] }, 'knobs');
  p.light([0, h + 0.42, 0.4], 0.3, [0.35, 0.65, 1], [0, 0, 1], 2);
}

export function wallConsole(p, o = {}) {
  const { face = 'status', y = 1.0, w = 0.64 } = o;
  p.slab('white2', -w / 2, w / 2, y, y + 0.78, 0, 0.03, { ...FIRM, r: 0.014 });
  p.slab('black', -w / 2 + 0.015, w / 2 - 0.015, y + 0.015, y + 0.765, 0.03, 0.036, LEAN);
  mount(p, part(wallScreen, face), { at: [0, y + 0.33, 0.036] }, 'wall screen');
  // a keypad shelf under the screen, sloping up toward the wall
  p.box('band', [w - 0.06, 0.012, 0.18], [0, y + 0.2, 0.12], [0.5, 0, 0], FIRM);
  p.box('black', [w - 0.06, 0.03, 0.02], [0, y + 0.155, 0.2], null, LEAN);
  const kp = (u, off) => [y + 0.2 + Math.cos(0.5) * off - Math.sin(0.5) * u, 0.12 + Math.sin(0.5) * off + Math.cos(0.5) * u];   // (a point on the shelf's top)
  mount(p, part(buttonGrid, { cols: 4, rows: 2, pitch: 0.036, seed: 14 }), { at: [-0.1, ...kp(0, 0.007)], rot: [0.5 - PI / 2, 0, 0] }, 'keypad');
  mount(p, part(knobRow, { n: 2, pitch: 0.06 }), { at: [0.16, ...kp(0, 0.007)], rot: [0.5 - PI / 2, 0, 0] }, 'knobs');
  for (const s of [-1, 1]) p.glowSlab(s < 0 ? LIT.green : LIT.amber, s * (w / 2 - 0.05) - 0.008, s * (w / 2 - 0.05) + 0.008, y + 0.05, y + 0.066, 0.036, 0.04);
}
