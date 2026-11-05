// WAYS IN: the moving parts that fill the hull's openings (hull.js hullOpening and the tail cap's mouth). Each opens
// by itself as someone comes near, as the station's doors do: sliding leaves (piece.js leaf), and leaves that swing on
// hinges (ramps, fold-down steps). Frame: the opening's foot (the deck's level, y = 0) at its middle on the hull's
// outer face, facing out (+z): the same point the opening piece is placed on, so a ship places both alike.
//
//   sideDoor(p, { steps })      fits 'door' (1.0 x 2.0 m): a pale leaf with a window at the back of the opening that
//       slides into the hull wall (+x), a light over it, and steps: 'fold' (an airstair of seven 0.18 m steps that
//       stands folded up in the opening in front of the leaf, its clad underside outward, and swings down and out to
//       the ground as the door opens), 'fixed' (the boarding stair's gentler steps, with rails, always down), or 'none'
//   airlockHatch(p)             fits 'door' too: a heavy outer airlock door, a ring of yellow and black blocks round
//       it, a thick leaf with a porthole that slides into the wall, a red or green light over it; no steps (a boarding
//       stair or a gangway comes up to it)
//   ramp(p, { w, h, len })      a ramp for a mouth w wide and h tall (its hinge on the sill): shut, its first part
//       stands up in the mouth and its second part folds down inside behind it; open, both unfold into one ramp down
//       to the ground (len 4.2 m: 17.5 degrees from the deck at 1.26 m). Hazard stripes along its edges, treads.
//       The back cargo ramp is { w: 4.4 } (the tail cap's 'mouth 9x5'), the side ramp { w: 2.9 } ('mouth 6x5').
//   bellyLift(p, { size })      fits 'hatch 3': a platform that is the floor of the room above when up (y = 0, the
//       deck) and sinks to the ground (1.26 m down) to let people on, with a rail round three sides (open toward +z),
//       lights on its two posts; the shaft's lining between the deck and the belly. size 1.4 (the platform, metres)
import * as THREE from 'three';
import { SHIP, GLOW_SHIP } from '../palette.js';
import { GLOW } from '../../materials.js';
import { kitTextures } from '../../materials.js';
import { plane, put } from '../../geo.js';
import { SHIP_GRID } from '../../grid.js';
import { Acc } from './facet.js';
import { box, bar, latheZ } from './shapes.js';

const PI = Math.PI, DECK = SHIP_GRID.deck, RISE = 0.18, NSTEPS = 7;
// a hazard-striped strip (the kit's decal) w x h facing `dir` ('up' or +z) at `at`
function hazard(p, w, h, at, up = true, tint = '#d9a21e') {
  const g = plane(w, h, { uv: kitTextures().decal.rect.hazard, cell: 9 });
  put(g, [0, 0, 0], up ? [-PI / 2, 0, 0] : [0, 0, 0]); put(g, at); return p.add('decal', g, tint);
}

// ── the side door ──
// (the fold-down steps are an airstair, steeper than the station's boarding stair: seven 0.18 m steps, 0.22 m deep, so
// folded up the flight is just under 2 m and stands inside the door's 0.3 m deep opening, its clad underside to the
// outside: shut, it is the door's outer face. The fixed steps keep the boarding stair's 0.27 m and have rails.)
const GO_FOLD = 0.22;
export function sideDoor(p, o = {}) {
  const steps = o.steps ?? 'fold', W = 1.0, H = 2.0, fold = steps === 'fold';
  // the leaf, at the back of the opening: pale, a dark band low across it, a small window, a yellow handle (all flat:
  // folded steps stand just in front of it)
  p.leaf('ship-door-leaf', (q) => {
    const a = new Acc();
    box(a, SHIP.hull, [-W / 2 - 0.03, W / 2 + 0.03], [-0.02, H + 0.03], [-0.0125, 0.0125]);   // (a little over the hole all round: its edges hide in the lining)
    box(a, SHIP.trim, [-W / 2 + 0.12, W / 2 - 0.12], [0.55, 0.7], [0.0125, 0.017]);
    box(a, SHIP.frame, [-0.2, 0.2], [1.3, 1.62], [0.0125, 0.02]);
    box(a, SHIP.yellow, [W / 2 - 0.16, W / 2 - 0.1], [0.9, 1.15], [0.0125, 0.02]);
    box(a, SHIP.trim, [-W / 2 - 0.03, -W / 2], [-0.02, H + 0.03], [-0.016, 0.016]);
    a.flush(q);
    q.glass(0.34, 0.26, [0, 1.46, 0.021]);
  }, { at: [0, 0, -0.2875], slide: [W + 0.05, 0, 0], door: 0 });
  // a light over it (green), and the light it gives
  const a = new Acc();
  box(a, SHIP.trim, [-0.3, 0.3], [H + 0.12, H + 0.2], [0, 0.05]);
  box(a, GLOW.green, [-0.26, 0.26], [H + 0.135, H + 0.185], [0.05, 0.055], 'glow');
  if (steps !== 'none') {
    // the flight, drawn going down and out from its top at the origin: treads with yellow nosings, two stringers, a
    // foot plate; folding ones are clad underneath (off-white, framed: the door's face when folded up), fixed ones have
    // rails
    const go = fold ? GO_FOLD : 0.27, len = NSTEPS * go, L = Math.hypot(DECK, len), below = [-len / L, -DECK / L];
    const flight = (q) => {
      const s = new Acc(), hw = 0.45;
      for (let i = 0; i < NSTEPS - 1; i++) { const y = -(i + 1) * RISE, z = (i + 1) * go; box(s, SHIP.gun, [-hw + 0.04, hw - 0.04], [y - 0.03, y], [z - go + 0.02, z + 0.02]); box(s, SHIP.yellow, [-hw + 0.04, hw - 0.04], [y - 0.006, y + 0.001], [z - 0.02, z + 0.02]); }
      for (const x of [-hw, hw]) {
        bar(s, SHIP.trim, [x, -0.05, 0.01], [x, -DECK + 0.08, len - 0.06], 0.05, fold ? 0.1 : 0.16);   // (its foot on the ground, its head at the sill)
        if (!fold) {
          bar(s, SHIP.trim, [x, 0.95, 0.15], [x, -DECK + 0.95, len - 0.05], 0.04, 0.04);
          for (let k = 0; k <= 2; k++) { const t = 0.15 + 0.75 * k / 2, P = [x, -DECK * t, len * t]; bar(s, SHIP.trim, P, [x, P[1] + 0.95, P[2] + 0.02], 0.035, 0.035); }
        }
      }
      if (fold) {
        // (the cladding: a plate under the treads along the flight, a charcoal edge down each side)
        const at = (x, t, off) => [x, -DECK * t + below[0] * off, len * t + below[1] * off];
        bar(s, SHIP.hull, at(0, 0.03, 0.175), at(0, 0.78, 0.175), 0.86, 0.015);
        for (const x of [-0.43, 0.43]) bar(s, SHIP.trim, at(x, 0.03, 0.17), at(x, 0.78, 0.17), 0.04, 0.03);
      }
      box(s, SHIP.frame, [-hw, hw], [-DECK, -DECK + 0.04], [len - 0.1, len + 0.12]);
      s.flush(q);
    };
    if (!fold) { const q = new (p.constructor)(); flight(q); for (const part of q.parts) { part.geo.translate(0, 0, 0.02); p.parts.push(part); } }
    else {
      // folded up inside the opening, in front of the leaf (turned about a hinge across the opening's floor until the
      // flight stands up), swung down and out to open
      const down = Math.atan2(DECK, len), shut = -(PI / 2 + down), at = [0, 0, -0.195];
      p.leaf('ship-door-steps', flight, { at, rot: [shut, 0, 0], hinge: { at, axis: [1, 0, 0], angle: -shut }, door: 0 });
    }
  }
  a.flush(p);
  p.light([0, H + 0.1, 0.5], 0.6, [0.5, 1, 0.6], [0, -0.5, 1], 3);
  p.door(0, [0, 1.0, 1.4], 2.6, 1.2);
  return p;
}

// ── the airlock's outer hatch ──
export function airlockHatch(p) {
  const W = 1.0, H = 2.0, a = new Acc();
  // a ring of yellow and black blocks round the opening, outside the hull's own frame
  const blocks = [];
  for (let y = 0.1; y < H; y += 0.25) blocks.push([-W / 2 - 0.2, -W / 2 - 0.08, y, y + 0.23], [W / 2 + 0.08, W / 2 + 0.2, y, y + 0.23]);
  for (let x = -W / 2 - 0.2; x < W / 2 + 0.2 - 0.01; x += 0.25) blocks.push([x, Math.min(x + 0.23, W / 2 + 0.2), H + 0.08, H + 0.2]);
  blocks.forEach(([x0, x1, y0, y1]) => box(a, Math.round((x0 + y0) / 0.25) % 2 ? SHIP.trim : SHIP.yellow, [x0, x1], [y0, y1], [0.03, 0.06]));   // (yellow and black by turns up each side and across)
  box(a, SHIP.trim, [-0.34, 0.34], [H + 0.26, H + 0.34], [0, 0.05]);
  box(a, GLOW.red, [-0.3, 0.3], [H + 0.275, H + 0.325], [0.05, 0.055], 'glow');
  // a keypad beside it
  box(a, SHIP.trim, [W / 2 + 0.28, W / 2 + 0.46], [1.1, 1.36], [0, 0.06]);
  box(a, GLOW_SHIP.strip, [W / 2 + 0.31, W / 2 + 0.43], [1.24, 1.32], [0.06, 0.064], 'glow');
  a.flush(p);
  p.leaf('ship-hatch-leaf', (q) => {
    const b = new Acc();
    box(b, SHIP.hull2, [-W / 2 - 0.03, W / 2 + 0.03], [-0.02, H + 0.03], [-0.05, 0.05]);
    for (const y of [0.35, H - 0.35]) box(b, SHIP.trim, [-W / 2 + 0.08, W / 2 - 0.08], [y - 0.06, y + 0.06], [0.05, 0.06]);
    box(b, SHIP.yellow, [-W / 2 + 0.08, W / 2 - 0.08], [0.9, 0.96], [0.05, 0.058]);
    latheZ(b, [[0.2, 0.08], [0.2, 0.05], [0.14, 0.05], [0.14, 0.08]], 16, () => SHIP.frame, { at: [0, 1.4, 0] });
    b.flush(q);
    const g = new THREE.CircleGeometry(0.14, 16); g.translate(0, 1.4, 0.04); q.add('glass', g);
    const g2 = g.clone(); g2.rotateY(PI); g2.translate(0, 0, 0.0); q.add('glass', g2);
  }, { at: [0, 0, -0.18], slide: [-(W + 0.05), 0, 0], door: 0 });
  p.light([0, H + 0.3, 0.5], 0.4, [1, 0.25, 0.2], [0, -0.3, 1], 2.5);
  p.door(0, [0, 1.0, 1.0], 2.2, 0.9);
  return p;
}

// ── ramps ──
export function ramp(p, o = {}) {
  const w = o.w ?? 4.4, h = o.h ?? 2.5, len = o.len ?? 4.2, t = 0.1, l1 = h - 0.05, l2 = len - l1;
  const slope = Math.asin(DECK / len);   // (17.5 degrees for 4.2 m)
  // a section of ramp, drawn lying flat from its hinge (z 0) out along +z, its top at y 0: a plate, a tread, a
  // hazard stripe down each edge, a dark edge beam
  const section = (L, first) => (q) => {
    const a = new Acc();
    box(a, SHIP.grey, [-w / 2, w / 2], [-t, 0], [0, L]);
    box(a, SHIP.trim, [-w / 2, -w / 2 + 0.08], [-t - 0.06, 0.02], [0, L]); box(a, SHIP.trim, [w / 2 - 0.08, w / 2], [-t - 0.06, 0.02], [0, L]);
    for (let z = 0.25; z < L - 0.1; z += 0.3) box(a, SHIP.gun, [-w / 2 + 0.3, w / 2 - 0.3], [0, 0.015], [z, z + 0.05]);
    // (the underside, which is the outside when shut: off-white panels like the hull, with a seam)
    box(a, SHIP.hull, [-w / 2 + 0.02, w / 2 - 0.02], [-t - 0.005, -t], [0.02, L - 0.02]);
    if (!first) box(a, SHIP.frame, [-w / 2, w / 2], [-t, 0.01], [L - 0.06, L]);
    a.flush(q);
    for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) hazard(q, 0.22, L - 0.1, [x, 0.017, L / 2], true);
  };
  // shut, the first section stands up in the mouth (turned up about the sill, its treads facing in, its off-white
  // underside out); opening turns it down and out about the sill until it meets the ground
  const sill = [0, 0, -0.12], open = PI / 2 + slope;
  p.leaf('ship-ramp-a' + [w, h, len].join('/'), section(l1, true), { at: sill, rot: [-PI / 2, 0, 0], hinge: { at: sill, axis: [1, 0, 0], angle: open }, door: 0 });
  // the second section, folded down inside behind the first from the fold at its top (treads to treads); opening
  // unfolds it about that fold (where the fold is when shut, swinging in through the bay), as the whole ramp turns
  const fold = [0, l1, sill[2]];
  p.leaf('ship-ramp-b' + [w, h, len].join('/'), section(l2, false), { at: fold, rot: [PI / 2, 0, 0], hinge: [{ at: sill, axis: [1, 0, 0], angle: open }, { at: fold, axis: [1, 0, 0], angle: PI }], door: 0 });
  // lights in the mouth's top corners
  for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) p.light([x, h - 0.2, 0.4], 0.8, [1.3, 1.1, 0.8], [0, -0.6, 1], 4);
  p.door(0, [0, 1.0, 3.2], 3.6, 0.7);
  return p;
}

// ── the belly lift ──
export function bellyLift(p, o = {}) {
  const s = o.size ?? 1.4, hs = s / 2;
  // the shaft's lining from the deck down to the belly (half a metre), dark, a yellow lip at the bottom
  const a = new Acc(), hh = hs + 0.06;
  for (const [x0, x1, z0, z1] of [[-hh, hh, -hh, -hs], [-hh, hh, hs, hh], [-hh, -hs, -hs, hs], [hs, hh, -hs, hs]]) box(a, SHIP.trim, [x0, x1], [-0.5, -0.02], [z0, z1]);
  a.flush(p);
  p.leaf('ship-lift', (q) => {
    const b = new Acc();
    box(b, SHIP.gun, [-hs, hs], [-0.12, 0], [-hs, hs]);
    box(b, SHIP.trim, [-hs, hs], [-0.32, -0.12], [-hs, hs]);
    // a rail round three sides, open toward +z; two posts at the back with lights
    for (const x of [-hs + 0.04, hs - 0.04]) { bar(b, SHIP.trim, [x, 0, -hs + 0.04], [x, 1.0, -hs + 0.04], 0.05, 0.05); bar(b, SHIP.trim, [x, 0, hs - 0.1], [x, 1.0, hs - 0.1], 0.04, 0.04); bar(b, SHIP.yellow, [x, 1.0, -hs + 0.04], [x, 1.0, hs - 0.1], 0.04, 0.04); }
    bar(b, SHIP.yellow, [-hs + 0.04, 1.0, -hs + 0.04], [hs - 0.04, 1.0, -hs + 0.04], 0.04, 0.04);
    for (const x of [-hs + 0.04, hs - 0.04]) box(b, GLOW_SHIP.warm, [x - 0.012, x + 0.012], [0.3, 0.9], [-hs + 0.066, -hs + 0.07], 'glow');
    b.flush(q);
    hazard(q, s - 0.1, 0.2, [0, 0.003, hs - 0.14], true);
  }, { at: [0, 0, 0], slide: [0, -DECK, 0], door: 0 });
  p.light([0, -0.6, 0], 0.7, [1.2, 1.0, 0.7], [0, -1, 0], 3);
  p.door(0, [0, -0.4, hs + 1.2], 2.0, 0.5);
  return p;
}
