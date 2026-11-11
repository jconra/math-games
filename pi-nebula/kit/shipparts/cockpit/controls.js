// FLIGHT CONTROLS: the stick, the throttles and the pedals. Each faces +z (toward the person working it) and is centred
// on x = 0.
//   flightStick(p, o)  a joystick: a grip leaning forward a little, a hat switch, a red button and a trigger, on a
//                      rubber boot. o: mount ('arm': a small plate that sits on an armrest's end, its foot at y = 0 |
//                      'floor': a column from the deck between the knees, its grip about 0.7 m up), hand ('right' |
//                      'left': which way the thumb buttons sit)
//   throttle(p, o)     a throttle quadrant: two or three levers in slots on a humped housing, a printed scale and a
//                      lamp for each. o: mount ('pedestal': on a console from the deck, 0.26 m wide and d long, to
//                      stand between two seats, its top rising from h - 0.04 at its near end to h + 0.04 at its far
//                      end (where it tucks under a dashboard's lip), a small screen on it | 'dash': the quadrant
//                      alone, its foot at y = 0 | 'arm': one lever on a small plate for an armrest's end), levers (2),
//                      d (0.5), h (0.6), body (the pedestal's sides: look.js's CHAR, the cockpit's charcoal | 'white')
//   pedals(p, o)       two pedals on a heel plate, for under a dashboard: o: gap (between their middles, 0.3); the heel
//                      plate's back edge is at z = 0.12, toward the seat
//   GRIP               where the hand goes on each (for the reach checks): stick(o), throttle(o) -> [x, y, z]
import * as THREE from 'three';
import { part } from '../place.js';
import { LEAN, LIT, CHAR, local, bar, glowBox, mfd, mount as setOn } from './look.js';
import { buttonGrid } from './panels.js';

const PI = Math.PI, FIRM = { r: 0.01, seg: 1, cell: 9, loops: [] };

// the stick's grip: where it stands and how it leans, for each mount
function stickFrame(mount) { return mount === 'floor' ? { at: [0, 0.58, 0.075], rot: [0.15, 0, 0] } : { at: [0, 0.04, 0], rot: [0.15, 0, 0] }; }
// the pedestal's top: it rises from its near end (+z, h - 0.04) to its far end (-z, h + 0.04), so it faces the seats;
// the quadrant stands on its near half, following the slope
function pedestalTop({ d = 0.5, h = 0.6 } = {}) {
  const a = Math.atan2(0.08, d), y = (z) => h - 0.08 * z / d, z0 = d / 2 - 0.13;
  return { a, y, z0, quad: { at: [0, y(z0), z0], rot: [a, 0, 0] } };
}
export const GRIP = {
  stick: (o = {}) => { const F = stickFrame(o.mount || 'arm'); return local(F.at, F.rot, 0, 0.075, 0); },
  throttle: (o = {}) => { if (o.mount === 'arm') return [0, 0.085, 0.005]; if (o.mount === 'dash') return [0, 0.135, 0.02]; const Q = pedestalTop(o).quad; return local(Q.at, Q.rot, 0, 0.135, 0.02); },
};

export function flightStick(p, o = {}) {
  const { mount = 'arm', hand = 'right' } = o, sx = hand === 'left' ? -1 : 1, F = stickFrame(mount);
  if (mount === 'floor') {
    p.slab('black', -0.08, 0.08, 0, 0.018, -0.09, 0.09, LEAN);
    p.lathe('rubber', [[0.001, 0.018], [0.075, 0.018], [0.07, 0.04], [0.045, 0.09], [0.034, 0.13], [0.001, 0.13]], 10);
    bar(p, 'gun', [0, 0.1, 0.01], [0, F.at[1] - 0.06, F.at[2] - 0.005], 0.06, { ...LEAN, r: 0.012 });
    p.lathe('rubber', [[0.001, F.at[1] - 0.09], [0.05, F.at[1] - 0.09], [0.045, F.at[1] - 0.06], [0.03, F.at[1] - 0.035], [0.001, F.at[1] - 0.035]], 10, [0, 0, F.at[2]]);
    const ring = new THREE.CylinderGeometry(0.085, 0.085, 0.006, 12, 1, true); ring.translate(0, 0.021, 0); p.add('glow', ring, LIT.blue);   // (a lit ring round its foot)
  } else {
    p.slab('black', -0.036, 0.036, 0, 0.012, -0.05, 0.05, { r: 0 });
  }
  // the boot over the gimbal, then the grip (a lathe), leaning forward
  const [bx, by, bz] = F.at;
  p.lathe('rubber', [[0.001, by - 0.03], [0.034, by - 0.03], [0.03, by - 0.016], [0.017, by + 0.004], [0.011, by + 0.016], [0.001, by + 0.016]], 8, [bx, 0, bz]);
  const k = mount === 'floor' ? 1.3 : 1;   // (the floor stick's grip is bigger)
  p.lathe('black', [[0.001, 0], [0.015, 0.012], [0.019, 0.055], [0.0175, 0.085], [0.022, 0.11], [0.018, 0.122], [0.001, 0.126]].map(([r, y]) => [r * k, y]), 8, F.at, F.rot);
  p.box('black', [0.032, 0.022, 0.044], local(F.at, F.rot, 0, 0.13, 0.004), F.rot, { r: 0.009, seg: 1, cell: 9, loops: [] });   // (the head, over the grip's top)
  p.box('grey', [0.012, 0.012, 0.012], local(F.at, F.rot, -0.008 * sx, 0.141, 0.0), F.rot, { r: 0 });            // hat switch
  p.box('red', [0.016, 0.008, 0.016], local(F.at, F.rot, 0.007 * sx, 0.144, -0.006), F.rot, { r: 0 });            // the red button on top
  glowBox(p, LIT.red, [0.008, 0.002, 0.008], local(F.at, F.rot, 0.007 * sx, 0.1485, -0.006), F.rot);
  p.box('dark', [0.014, 0.024, 0.012], local(F.at, F.rot, 0, 0.1, 0.024), F.rot, { r: 0 });                       // trigger
  p.box('dark', [0.01, 0.03, 0.014], local(F.at, F.rot, -0.015 * sx, 0.07, 0.008), F.rot, { r: 0 });               // pinky lever
}

// the quadrant itself: a humped housing (its foot at y0), levers in slots, a scale, lamps
function quadrantPart(p, { levers = 2 } = {}) { quadrant(p, levers, 0, 0); }
function quadrant(p, levers, y0, z0) {
  const W = 0.05 + 0.045 * levers, out = [[-0.12, 0], [0.12, 0], [0.12, 0.03], [0.075, 0.062], [-0.075, 0.062], [-0.12, 0.03]];
  p.extrude('dark', out, W, 0.006).rotateY(-PI / 2).translate(W / 2, y0, z0);
  const top = y0 + 0.062, CAPS = ['orange', 'yellow', 'orange', 'red'];
  for (let i = 0; i < levers; i++) {
    const x = -W / 2 + 0.025 + 0.045 * (i + 0.5), zl = z0 + (i % 2 ? -0.025 : 0.02);
    p.slab('black', x - 0.007, x + 0.007, top, top + 0.003, z0 - 0.07, z0 + 0.07, { r: 0 });
    bar(p, 'rail', [x, top, zl], [x, top + 0.075, zl + 0.012], 0.01);
    p.box('black', [0.034, 0.03, 0.036], [x, top + 0.087, zl + 0.014], null, { r: 0 });
    p.box(CAPS[i % 4], [0.036, 0.012, 0.04], [x, top + 0.106, zl + 0.014], null, { r: 0 });
    p.glowSlab(i === levers - 1 ? LIT.amber : LIT.green, x - 0.005, x + 0.005, top, top + 0.004, z0 + 0.08, z0 + 0.09);
  }
  p.decal('cp:scale', 0.15, 0.0375, [-W / 2 + 0.014, top + 0.0005, z0], [-PI / 2, 0, PI / 2], '#d9d7cf');
}

export function throttle(p, o = {}) {
  const { mount = 'pedestal', levers = 2, d = 0.5, h = 0.6, body = CHAR } = o;
  if (mount === 'arm') {
    // one lever on a plate for an armrest's end, a lamp on the front of its box
    p.slab('black', -0.03, 0.03, 0, 0.012, -0.05, 0.05, { r: 0 });
    p.slab('dark', -0.022, 0.022, 0.012, 0.035, -0.045, 0.045, { r: 0 });
    p.slab('black', -0.005, 0.005, 0.035, 0.037, -0.035, 0.035, { r: 0 });
    bar(p, 'rail', [0, 0.035, 0], [0, 0.07, 0.006], 0.01);
    p.box('black', [0.024, 0.022, 0.036], [0, 0.08, 0.006], [0.1, 0, 0], { r: 0 });
    p.box('grey', [0.01, 0.008, 0.01], [0.006, 0.093, 0.0], [0.1, 0, 0], { r: 0 });
    p.glowSlab(LIT.amber, -0.009, 0.009, 0.017, 0.029, 0.045, 0.048);
    return;
  }
  if (mount === 'dash') { quadrant(p, levers, 0, 0); return; }
  // the pedestal: off-white sides on a dark plinth, its dark top rising toward its far end (where it tucks under a
  // dashboard's lip) so it faces the seats; a lit strip along each top edge; a small screen, then the quadrant
  const T = pedestalTop({ d, h });
  p.slab('black', -0.12, 0.12, 0, 0.06, -d / 2 + 0.02, d / 2 - 0.02, { r: 0 });
  p.extrude(body, [[-d / 2, 0.06], [d / 2, 0.06], [d / 2, T.y(d / 2) - 0.03], [-d / 2, T.y(-d / 2) - 0.03]], 0.26, 0.012).rotateY(-PI / 2).translate(0.13, 0, 0);
  const L = Math.hypot(d, 0.08);
  p.box('dark', [0.27, 0.03, L + 0.01], [0, h - 0.015, 0], [T.a, 0, 0], FIRM);
  for (const s of [-1, 1]) { glowBox(p, LIT.blue, [0.006, 0.006, L - 0.04], [s * 0.133, h - 0.006, 0], [T.a, 0, 0]); p.box('white2', [0.008, 0.03, L - 0.02], [s * 0.131, h - 0.045, 0], [T.a, 0, 0], { r: 0 }); }
  p.glowSlab(LIT.amber, -0.05, 0.05, h - 0.12, h - 0.108, d / 2, d / 2 + 0.003);   // (a lamp across its near end, a lit strip down it, a small grid)
  p.glowSlab(LIT.blue, -0.006, 0.006, 0.1, h - 0.16, d / 2, d / 2 + 0.003);
  setOn(p, part(buttonGrid, { cols: 3, rows: 2, pitch: 0.036, seed: 19 }), { at: [0, h - 0.24, d / 2 + 0.001] }, 'end buttons');
  for (const s of [-1, 1]) setOn(p, part(buttonGrid, { cols: 3, rows: 3, pitch: 0.04, seed: 17 + s }), { at: [s * 0.131, h - 0.2, d / 2 - 0.12], rot: [0, s * PI / 2, 0] }, 'side buttons');   // (on each side, facing a seat)
  const onTop = (z, off) => [0, T.y(z) + Math.cos(T.a) * off, z + Math.sin(T.a) * off], flat = [T.a - PI / 2, 0, 0];
  setOn(p, part(mfd, { face: 'text', w: 0.17 }), { at: onTop(-d / 2 + 0.12, 0.001), rot: flat }, 'screen');
  setOn(p, part(quadrantPart, { levers }), T.quad, 'quadrant', 'y');
}

export function pedals(p, o = {}) {
  const { gap = 0.3 } = o;
  p.slab('dark', -gap / 2 - 0.11, gap / 2 + 0.11, 0, 0.02, -0.12, 0.12, { r: 0 });
  for (const s of [-1, 1]) {
    const x = s * gap / 2;
    p.slab('black', x - 0.02, x + 0.02, 0.02, 0.06, -0.12, -0.07, { r: 0 });                            // the pivot
    bar(p, 'gun', [x, 0.05, -0.1], [x, 0.1, -0.075], 0.02);
    p.box('black', [0.1, 0.2, 0.018], [x, 0.13, -0.035], [-0.75, 0, 0], { r: 0 });          // the pedal, leaning back
    for (let k = 0; k < 4; k++) p.box('rubber', [0.084, 0.012, 0.006], local([x, 0.13, -0.035], [-0.75, 0, 0], 0, -0.07 + k * 0.045, 0.011), [-0.75, 0, 0], { r: 0 });
  }
}
