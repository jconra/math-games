// THE LIFT: one box, the same at every stop (kit/places-plan.js LIFT, STOPS has the game's maker's words). A station
// cell, 2 m by 2 m and 3 m tall, its walls inside the cell so it is 1.56 m clear inside; its doorway on its +z side
// (placed with turn 1 it faces east, as at every stop). Inside: brushed steel walls with a handrail, a dark kick plate,
// the panel of stops by the door, a tread floor 3 cm up off the room's, a light in the ceiling. The game (src/lift.js)
// works its doors and carries the player between the boxes; nothing here moves by itself.
//   liftWall  an EDGE piece, facing +z: a wall of the box seen from inside. 'plain', or 'panel' (the panel of stops,
//             at its +x end, beside the door)
//   liftDoor  an EDGE piece with a face each side: the box's doorway, two steel leaves sliding apart into the wall, a
//             lit LIFT over it on its outer face (+z) and beside it a call plate with its two arrows
//   liftTop   a CELL piece: the free-standing box's roof ('roof'); or 'shaft <h>': its walls carried on h metres up
//             to the room's ceiling, as if the box had come up a shaft (the game's maker: "you'd think it had to have
//             come up the center")
//   liftBox   a PREFAB: 'deck', the box let into the main deck's hallway (its inside only: the station's own walls are
//             round it, and its doorway is a door of its own between it and the hallway); 'free', the box standing
//             in a room (its inside, its doorway, its outside walls, corner posts and roof)
import * as THREE from 'three';
import { WALL_FACE as WF } from './grid.js';
import { backing, slabRow, band, slant, G, Z0, BAND, TOP } from './shell.js';
import { rrect, doorPath, put, bevelBox } from './geo.js';
import { segText, textWidth } from './shipparts/cabin/segtext.js';
import { LIFT } from './places-plan.js';

const PI = Math.PI, H = LIFT.h, C = LIFT.clear;
// brushed steel (a little darker than a walkway's rail), the dark kick plate
const STEEL = { c: '#9aa0a8', r: 0.34, m: 0.75, w: 0.35 };
const STEEL2 = { c: '#878d95', r: 0.4, m: 0.7, w: 0.4 };

// A PIECE BUILT INSIDE ANOTHER, moved and turned (about straight up) as one: its parts, its lights, its door leaves and
// its doors (their ids moved on past the piece's own). Used here and by the tower's and the store's walls, which run
// at angles the grid does not have.
const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
export function subInto(p, build, at = [0, 0, 0], ry = 0) {
  const q = new (p.constructor)(); build(q);
  const M = new THREE.Matrix4().makeRotationY(ry).setPosition(at[0], at[1], at[2]), R = new THREE.Matrix4().makeRotationY(ry);
  for (const part of q.parts) { part.geo.applyMatrix4(M); p.parts.push(part); }
  for (const L of q.lights) p.lights.push({ ...L, at: _v.set(...L.at).applyMatrix4(M).toArray(), dir: L.dir ? _v.set(...L.dir).applyMatrix4(R).toArray() : null });
  const first = p.doors.length;
  for (const D of q.doors) p.doors.push({ ...D, id: D.id + first, sense: _v.set(...D.sense).applyMatrix4(M).toArray() });
  for (const mv of q.movers) p.movers.push({ ...mv, base: _m.copy(M).multiply(mv.base).clone(), slide: mv.slide.clone().applyMatrix4(R), door: mv.door + first });
  return q;
}

// ── a wall of the box, from inside ─────────────────────────────────────────────────────────────────────────────────
export function liftWall(p, v) {
  backing(p, -1, 1, 0, H, 0.03, Z0);
  // two tall steel panels, each in three, between the corners (the box is 1.56 m clear: the panels stop there)
  for (const [x0, x1] of [[-C, -G], [G, C]]) for (const [y0, y1] of [[0.14, 0.86], [0.86 + 2 * G, 1.7], [1.7 + 2 * G, 2.5]]) p.slab(y0 > 0.8 && y0 < 1 ? STEEL2 : STEEL, x0 + G, x1 - G, y0, y1, Z0, WF, { r: 0.006, skip: ['-z'] });
  p.slab('black', -C, C, 0, 0.14, Z0, WF + 0.012, { r: 0.01, skip: ['-z'] });                     // the kick plate
  for (const s of [-1, 1]) p.slab('black', s > 0 ? C : -1, s > 0 ? 1 : -C, 0, H, Z0, WF + 0.02, { r: 0.008, skip: ['-z'] });   // (the corners)
  slabRow(p, -C, C, 2.5, TOP, [], 'white2', [], {});
  slant(p, 'white', -1 + G, 1 - G, TOP, WF, 0.05, { skip: [] });
  // the handrail, on two brackets
  p.cyl('rail', 0.021, 1.36, [0, 0.95, WF + 0.07], [0, 0, PI / 2], 14);
  for (const x of [-0.56, 0.56]) { p.slab('black', x - 0.025, x + 0.025, 0.92, 0.98, WF, WF + 0.07, { r: 0.008 }); }
  if (v === 'panel') {
    // THE PANEL OF STOPS beside the door: a black plate, a small lit window over it, three round buttons with their
    // places beside them, top to bottom as the stops are
    const x = 0.5, y0 = 1.06, y1 = 1.62, z = WF + 0.012;
    p.slab('black', x - 0.15, x + 0.15, y0, y1, WF - 0.005, z, { r: 0.01 });
    p.slab('dark', x - 0.11, x + 0.11, y1 - 0.12, y1 - 0.04, z, z + 0.004, { r: 0.004 });
    segText(p, 'LIFT', { h: 0.035, at: [x, y1 - 0.08, z + 0.005], look: 'amber', mat: 'glow' });
    ['TOWER', 'DECK', 'CARGO'].forEach((t, i) => {
      const y = y1 - 0.2 - i * 0.12;
      p.cyl('grey', 0.024, 0.014, [x - 0.08, y, z + 0.007], [PI / 2, 0, 0], 14);
      p.add('glow', put(bevelBox([0.03, 0.03, 0.004], [0, 0, 0], { r: 0.002, seg: 1, cell: 9 }), [x - 0.08, y, z + 0.016]), 'soft');
      segText(p, t, { h: 0.026, align: 'left', at: [x - 0.035, y, z + 0.002], look: { c: '#dfe4ea', r: 0.5, m: 0, w: 0.1 } });
    });
    p.light([x, 1.4, WF + 0.3], 0.15, [1, 0.8, 0.45], [0, 0, 1], 1.5);
  }
}

// ── the doorway: a wall with a face each side, the steel leaves, LIFT over it ─────────────────────────────────────────
// (the station's own doorway, kit/shell.js wallPanel 'door', with the lift's leaves: brushed steel, no windows)
const DOOR = { hw: LIFT.doorHalf, top: 2.25, side: 0.62, back: 0.6, backY: 2.3, lintel: 2.32, plate: [2.4, 2.47], glow: [2.42, 2.45], ly: 2.43 };
// ('deck': the doorway let into the hallway's wall, where the hallway's cornice hides the wall over the door: its LIFT
// is on the plate right over the opening instead)
export function liftDoor(p, v = 'two') {
  const X0 = -1 + G, X1 = 1 - G, D = DOOR;
  for (const s of [0, 1]) {
    const q = new (p.constructor)();
    backing(q, -1, -D.back, 0, H, 0.03, Z0); backing(q, D.back, 1, 0, H, 0.03, Z0); backing(q, -D.back, D.back, D.backY, H, 0.03, Z0);
    if (s === 0) {
      // the outside (+z): the station's white panels round a steel surround, LIFT over the door, the call plate beside it
      slabRow(q, X0, -D.side, 0.15, BAND[0], [], 'white', [0.02], {}); band(q, X0, -D.side); slabRow(q, X0, -D.side, BAND[1], TOP, [], 'white', [0.02], {});
      slabRow(q, D.side, X1, 0.15, BAND[0], [], 'white', [0.02], {}); band(q, D.side, X1); slabRow(q, D.side, X1, BAND[1], TOP, [], 'white', [0.02], {});
      q.slab(STEEL2, -D.side, D.side, D.lintel, TOP, Z0, WF + 0.01, { r: 0.008, skip: ['-z'] });
      slabRow(q, X0, X1, TOP, H, [], 'white2', [], {});
      if (v !== 'deck') {
        q.slab('black', -0.36, 0.36, 2.6, 2.84, WF, WF + 0.03, { r: 0.01 });
        segText(q, 'LIFT', { h: 0.13, t: 0.02, at: [0, 2.72, WF + 0.032], look: 'white', mat: 'glow' });
        q.light([0, 2.72, WF + 0.3], 0.35, [0.8, 0.9, 1], [0, 0, 1], 3);
      }
      // the call plate: a black plate with an up and a down arrow, lit
      const cx = D.side + 0.17;
      q.slab('black', cx - 0.07, cx + 0.07, 1.1, 1.36, WF + 0.02, WF + 0.04, { r: 0.008 });
      for (const [y, up] of [[1.28, 1], [1.18, -1]]) {
        const g = new THREE.BufferGeometry(), h = 0.03 * up;
        g.setAttribute('position', new THREE.Float32BufferAttribute([cx - 0.035, y - h / 2, 0, cx + 0.035, y - h / 2, 0, cx, y + h / 2, 0], 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); g.setIndex([0, 1, 2]);
        put(g, [0, 0, WF + 0.042]); q.add('glow', g, 'amber');
      }
    } else {
      // the inside (-z, turned): the steel walls of the box carried round the doorway
      for (const [x0, x1] of [[-C, -D.side], [D.side, C]]) for (const [y0, y1] of [[0.14, 0.86], [0.86 + 2 * G, 1.7], [1.7 + 2 * G, 2.5]]) q.slab(STEEL, x0 + G, x1 - G, y0, y1, Z0, WF, { r: 0.006, skip: ['-z'] });
      q.slab('black', -C, -D.side, 0, 0.14, Z0, WF + 0.012, { r: 0.01, skip: ['-z'] }); q.slab('black', D.side, C, 0, 0.14, Z0, WF + 0.012, { r: 0.01, skip: ['-z'] });
      for (const sx of [-1, 1]) q.slab('black', sx > 0 ? C : -1, sx > 0 ? 1 : -C, 0, H, Z0, WF + 0.02, { r: 0.008, skip: ['-z'] });
      q.slab(STEEL2, -D.side, D.side, D.lintel, 2.5, Z0, WF, { r: 0.008, skip: ['-z'] });
      slabRow(q, -C, C, 2.5, TOP, [], 'white2', [], {});
      slant(q, 'white', -1 + G, 1 - G, TOP, WF, 0.05, { skip: [] });
    }
    if (s === 0 && v === 'deck') {
      q.slab('black', -0.42, 0.42, D.lintel - 0.02, TOP - 0.01, WF, WF + 0.03, { r: 0.008 });
      segText(q, 'LIFT', { h: 0.12, t: 0.019, at: [0, (D.lintel + TOP) / 2 - 0.005, WF + 0.032], look: 'white', mat: 'glow' });
      q.light([0, D.ly, WF + 0.3], 0.35, [0.8, 0.9, 1], [0, 0, 1], 3);
    } else { q.slab('black', -0.3, 0.3, D.plate[0], D.plate[1], WF, WF + 0.02, { r: 0.008 }); q.glowSlab('green', -0.26, 0.26, D.glow[0], D.glow[1], WF + 0.02, WF + 0.024); }
    for (const part of q.parts) { if (s) put(part.geo, [0, 0, 0], [0, PI, 0]); p.parts.push(part); }
    for (const L of q.lights) p.lights.push(s ? { ...L, at: [-L.at[0], L.at[1], -L.at[2]], dir: L.dir && [-L.dir[0], L.dir[1], -L.dir[2]] } : L);
  }
  p.sweep('black', rrect(0.1, 0.5, 0.015, 2, 0.05, 0), doorPath(D.hw, D.top, 0.12), {});
  p.slab('gun', -D.hw, D.hw, -0.02, 0.012, -0.25, 0.25, { r: 0.006 });
  // two leaves of brushed steel, each with a dark line across at the band and a black edge where they meet
  const lw = D.hw + 0.04, lh = D.top + 0.02;
  const leaf = (q) => {
    q.slab(STEEL, -lw, -0.012, 0.01, lh, -0.024, 0.024, { r: 0.012 });
    q.slab('black', -0.014, 0, 0.01, lh, -0.027, 0.027, { r: 0.004 });
    q.slab('band', -lw + 0.05, -0.06, BAND[0] + 0.1, BAND[0] + 0.16, -0.028, 0.028, { r: 0.006 });
  };
  p.leaf('lift-leaf', leaf, { slide: [-(D.hw + 0.06), 0, 0], door: 0 });
  p.leaf('lift-leaf', leaf, { rot: [0, PI, 0], slide: [D.hw + 0.06, 0, 0], door: 0 });
  p.door(0, [0, 1.2, 0], 2.4);
}

// ── the box's top: its roof, or its walls carried on up to the ceiling ─────────────────────────────────────────────
export function liftTop(p, v) {
  const o = 1 + WF;                                    // (the outside walls' faces)
  if (v === 'roof') {
    p.slab('grey2', -o - 0.02, o + 0.02, H, H + 0.12, -o - 0.02, o + 0.02, { r: 0.02, cell: 0.8 });
    p.slab('black', -o, o, H + 0.12, H + 0.16, -o, o, { r: 0.01, cell: 0.8 });
    return;
  }
  const h = Math.max(0.05, parseFloat(v.split(' ')[1]) || 1);
  // four sides of plain off-white panels from the box's top up to the ceiling, a black band where the box ends
  p.slab('black', -o - 0.03, o + 0.03, H - 0.04, H + 0.08, -o - 0.03, o + 0.03, { r: 0.012, cell: 0.8, skip: ['+y'] });
  for (let s = 0; s < 4; s++) {
    const q = new (p.constructor)();
    q.slab('white2', -o + G, o - G, H + 0.08, H + h, o - 0.04, o, { r: 0.006, cell: 0.8, skip: ['-z'] });
    for (const x of [-0.5, 0.5]) q.slab('dark', x - 0.02, x + 0.02, H + 0.08, H + h, o, o + 0.004, { r: 0, cell: 9 });
    for (const part of q.parts) { put(part.geo, [0, 0, 0], [0, s * PI / 2, 0]); p.parts.push(part); }
  }
}
export const liftTopAccepts = (v) => /^shaft \d+(\.\d+)?$/.test(v);

// ── the whole box, as placements (the box's frame: its doorway at +z) ─────────────────────────────────────────────
export function liftBox(v) {
  const step = [0, LIFT.step, 0];
  const inside = [
    { piece: 'floor', cell: [0, 0], turn: 0, variant: 'tread', off: step },
    { piece: 'ceiling', cell: [0, 0], turn: 0, variant: 'light' },
    { piece: 'liftWall', cell: [0, -0.5], turn: 0, variant: 'plain' },
    { piece: 'liftWall', cell: [-0.5, 0], turn: 1, variant: 'plain' },
    { piece: 'liftWall', cell: [0.5, 0], turn: 3, variant: 'panel' },
  ];
  if (v === 'deck') return inside;
  const top = v.startsWith('free ') ? 'shaft ' + v.split(' ')[1] : 'roof';
  return [...inside,
    { piece: 'liftDoor', cell: [0, 0.5], turn: 0 },
    { piece: 'wall', cell: [0, -0.5], turn: 2, variant: 'plain' },
    { piece: 'wall', cell: [-0.5, 0], turn: 3, variant: 'plain' },
    { piece: 'wall', cell: [0.5, 0], turn: 1, variant: 'plain' },
    { piece: 'corner', cell: [-0.5, -0.5], turn: 2, variant: 'outside' },
    { piece: 'corner', cell: [0.5, -0.5], turn: 1, variant: 'outside' },
    { piece: 'corner', cell: [0.5, 0.5], turn: 0, variant: 'outside' },
    { piece: 'corner', cell: [-0.5, 0.5], turn: 3, variant: 'outside' },
    { piece: 'liftTop', cell: [0, 0], turn: 0, variant: top },
  ];
}

export const LIFT_PIECES = {
  liftWall: { name: 'Lift wall', group: 'Lift', at: 'edge', variants: ['plain', 'panel'], foot: [2, 3, 0.3], build: liftWall },
  liftDoor: { name: 'Lift doorway', group: 'Lift', at: 'edge', variants: ['two', 'deck'], foot: [2, 3, 0.5], build: liftDoor },
  liftTop: { name: 'Lift top', group: 'Lift', at: 'cell', variants: ['roof', 'shaft 1.2'], accepts: liftTopAccepts, foot: [2.5, 1.2, 2.5], build: liftTop },
  // (free <h>: standing in a room whose ceiling is h metres over the box's top: its walls carried up to it)
  liftBox: { name: 'Lift box', group: 'Lift', at: 'cell', variants: ['free', 'deck', 'free 1.2'], accepts: (v) => /^free \d+(\.\d+)?$/.test(v), foot: [2.5, 3.2, 2.5], prefab: liftBox },
};
export { textWidth };
