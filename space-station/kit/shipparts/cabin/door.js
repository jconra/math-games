// THE 8-SIDED DOORWAY: the game's maker's door picture (2026-11-09, refs/ships/door_ref_2026-11-09.md) in the bevel
// helper's language (kit/bevel.js). A sliding door through a wall with a face on both sides:
//   - the opening a tall "rectangular octagon": chamfered at the top corners, a little at the foot
//   - round it on each face a stepped frame: a raised ring with a bevelled edge, a second ring a step down carrying a
//     white light strip up each side (upper and lower, a small dark plate between them at mid-height), and a third
//     stepping down below the wall's face to the leaves (a negative bevel round the opening); the frame runs down to
//     the floor (its bottom left open)
//   - two leaves parting, their meeting edge a stepped zigzag (straight, a 45-degree step across, straight, and back),
//     or one leaf sliding to one side; every leaf border-bevelled: its face a flat border round a sunk field with
//     chamfered corners, a second, shallower chamfered panel in the field, handle slots at mid-height and by the foot,
//     a few bolts, a stencil or two
//   - over the frame, a sign plate naming the room the door leads to; beside it, a small control panel (a dark screen
//     reading STANDBY, up and down buttons, a chamfered bezel) over a strip of hazard hatching
// Frame: as the cabin kit's doorway (kit/shipparts/cabin.js): x along the wall, centred on the opening, z = 0 on the wall
// line, a face both ways (+z is the front), y = 0 the floor. The leaves slide on into the walls beside it, between the
// walls' faces, as the station's do.
//   octDoor(p, o)
//     w (clear + 2 frame)  the doorway's own width of wall; clear (0.8) the opening; h (2.0) its height
//     leaves (2)    2: parting; 1 / -1: one leaf sliding toward +x / -x
//     frameW (0.1)  the frame's width round the opening (the blueprint's FRAME: its pocket checks count on it)
//     chamfer ([0.12, 0.16])  the opening's corners: [foot, top] (the foot's at most 0.12 of the opening's width)
//     shared        the sides (-1, +1, the doorway's own x) where another doorway's frame meets this one: no strips there
//     face, slot, leaf  how deep the wall's layers sit: its faces (0.03 from the line), the gap the leaves run in
//                   (0.0125 each side), a leaf's half thickness (0.0105): a ship's thin wall; the station's are 0.22,
//                   0.03 and 0.026
//     room (2.5)    the wall's height (its face is drawn up to here over the frame)
//     signs         { front, back }: the room kind each face's sign names (kit/shipparts/cabin/print.js SIGNS), or none
//     panels        { front, back }: which side of the door each face's control panel is on (+1: +x, -1: -x, as the
//                   doorway's own x; 0: none). It stands just past the doorway's width, on the wall beside it.
//     panelScale (1)  the control panel's size (the station's taller walls take a bigger one)
//     near (1.6)    how close someone comes before it opens; locked: shut for good (a red light, no panel)
import { put, plane } from '../../geo.js';
import { kitTextures } from '../../materials.js';
import { shape, octagon, inset, relief, solid, prism, plate, RINGS, add } from '../../bevel.js';
import { FACE } from './ship.js';
import { SIGNS } from './print.js';
import { wallPanel, trim, slabRow, band, backing, floorTile, BAND, TOP as STATION_TOP, Z0, G } from '../../shell.js';
import { part, placeInto } from '../place.js';

const PI = Math.PI, K = 2 - Math.SQRT2;
export const OCT = { frame: 0.1, chamfer: [0.12, 0.16], slot: 0.0125, leaf: 0.0105, overlap: 0.035, seam: 0.035, gap: 0.003 };
// the surfaces (the station's names: a cabin's look swaps each, kit/ships/cabin-built.js)
const FRAME_SURF = 'black', LEAF_SURF = 'white2', FIELD_SURF = 'grey2', WALL_SURF = 'white';

export function octDoor(p, o = {}) {
  const clear = o.clear ?? 0.8, h = o.h ?? 2.0, fw = o.frameW ?? OCT.frame, w = o.w ?? clear + 2 * fw, [cb, ct] = o.chamfer ?? [Math.min(OCT.chamfer[0], clear * 0.12), OCT.chamfer[1]];
  const face = o.face ?? FACE, slot = o.slot ?? OCT.slot, t = o.leaf ?? OCT.leaf, room = o.room ?? 2.5, leaves = o.leaves ?? 2, locked = !!o.locked;
  const k = w / 2, hw = clear / 2;
  // the frame's outline: the opening grown by its width (at the top its chamfer grows by fw (2 - sqrt 2); at the foot,
  // where the frame stays on the floor, it shrinks by fw (sqrt 2 - 1))
  const outer = shape(clear + 2 * fw, h + fw, [Math.max(0, cb - fw * (Math.SQRT2 - 1)), ct + fw * K], 0, (h + fw) / 2, 'bottom');
  const opening = inset(outer, fw), O = octagon(opening), P = octagon(outer);
  // the rings, from the frame's outer edge in (as parts of its width and of its depth over the face): up a bevel to a
  // flat; a step down to the strips' flat; a step down under the wall's face to the inner rim; the jamb back to the slot
  const f = fw, rings = [{ inset: 0, depth: 0.32 * f, bevel: 0.14 * f }, { inset: 0.24 * f, depth: 0.18 * f, bevel: 0.1 * f }, { inset: 0.26 * f, depth: -0.08 * f, bevel: 0.12 * f }, { inset: 0.14 * f, depth: -0.08 * f, bevel: 0 }];
  const stripX = hw + f * 0.39, stripZ = face + 0.18 * f + 0.0008;
  for (const [side, sgn] of [['front', 1], ['back', -1]]) {
    // (each face drawn as the front, then the back's turned round: what is at +x on the back's drawing ends at -x)
    const parts = [], lights = [];
    const A = (look, g, at, rot, mat = 'solid') => { put(g, at || [0, 0, 0], rot || [0, 0, 0]); parts.push({ mat, geo: g, look }); };
    // the wall's face round the frame, up to the ceiling (a sliver beside the frame where the doorway is wider; o.wall
    // 'top': only over the frame, the bays beside it drawn by whoever places it, as the station sample does)
    const W = outer.w / 2, full = W < k - 0.004 && o.wall !== 'top', E = full ? k : W;
    const wall = full ? [[-k, 0], P[0], P[7], P[6], P[5], P[4], P[3], P[2], P[1], [k, 0], [k, room], [-k, room]] : [[-E, P[6][1]], P[6], P[5], P[4], P[3], [E, P[3][1]], [E, room], [-E, room]];
    A(WALL_SURF, prism(wall, face, face, { back: false, sides: false }));
    if (!full && P[0][0] > P[7][0] + 1e-4) for (const sx of [-1, 1]) A(WALL_SURF, prism([[sx * W, 0], [sx * P[1][0], 0], [sx * W, P[2][1]]], face, face, { back: false, sides: false }));
    // the frame's rings, the jamb carried back to the slot, and the slot's own dark walls (seen with the door open)
    // (the relief's levels are from its own face: drawn at z = 0, then moved onto the wall's face)
    A(FRAME_SURF, relief(outer, rings, { hole: true, jamb: slot - face }), [0, 0, face]);
    A('dark', prism([[-k, 0], O[0], O[7], O[6], O[5], O[4], O[3], O[2], O[1], [k, 0], [k, h + fw], [-k, h + fw]], slot, slot, { front: false, sides: false }));
    // the light strips up each side, upper and lower; a small dark plate at mid-height between them
    for (const sx of [-1, 1]) {
      if ((o.shared || []).includes(sgn > 0 ? sx : -sx)) continue;   // (another doorway's frame meets it there)
      for (const [y0, y1] of [[0.12 * h, 0.44 * h], [0.56 * h, 0.88 * h]]) {
        A('white', plate(shape(0.1 * f, y1 - y0, 0.004, sx * stripX, (y0 + y1) / 2)), [0, 0, stripZ], null, 'glow');
        lights.push({ at: [sx * (stripX + 0.06), (y0 + y1) / 2, stripZ + 0.12], i: 0.15, color: [1, 0.98, 0.95], dir: [0, -0.35, 0.94], reach: 1.6, strip: true });
      }
      A('dark', solid(shape(0.16 * f, 0.07 * h, 0.006, sx * stripX, h / 2), 0.004, { edge: 0.0015, back: false }), [0, 0, stripZ - 0.001]);
    }
    // (a pool of light on the floor in front of the door, from its strips, for a cabin's real-time lights: kit/ships/cabin-built.js
    // POOLS; nothing in the bake, which has the strips' own)
    lights.push({ at: [0, 0.16, face + 0.3], i: 0, color: [1, 0.98, 0.95], dir: null, reach: 1.3, pool: { i: 0.22, reach: 1.3 } });
    // the sign over the frame, naming the room beyond
    const sign = o.signs?.[side], sy = h + fw + 0.1;
    if (sign && SIGNS[sign]) {
      A(FRAME_SURF, solid(shape(0.46, 0.085, 0.022, 0, sy), 0.006, { edge: 0.003, back: false }), [0, 0, face]);
      A('#d9d6cf', planeAt(0.4, 0.05, 'cabin:sign:' + sign), [0, sy, face + 0.0065], null, 'decal');
    }
    // the control panel beside the door, on the wall past its width (on the side asked for, as this face sees it)
    const ps = (o.panels?.[side] ?? 0) * (sgn > 0 ? 1 : -1);
    const ks = o.panelScale ?? 1;
    if (ps && !locked) controlPanel(A, ps * (k + 0.04 + 0.07 * ks), 1.22 + 0.1 * (ks - 1), face, ks);
    // (each part turned round for the back face; its lights too)
    for (const pt of parts) { if (sgn < 0) put(pt.geo, [0, 0, 0], [0, PI, 0]); p.add(pt.mat, pt.geo, pt.look); }
    for (const L of lights) p.lights.push(sgn < 0 ? { ...L, at: [-L.at[0], L.at[1], -L.at[2]], dir: L.dir && [-L.dir[0], L.dir[1], -L.dir[2]] } : L);
  }
  // the threshold: a gunmetal plate through the opening
  add(p, 'gun', solid(shape(clear - 2 * cb + 0.02, 2 * (face + 0.012), 0.01), 0.02, { edge: 0.004, back: false }), [0, -0.012, 0], [-PI / 2, 0, 0]);
  if (locked) for (const sz of [1, -1]) p.glowSlab('red', -0.12, 0.12, h + fw + 0.03, h + fw + 0.05, sz > 0 ? face : -face - 0.003, sz > 0 ? face + 0.003 : -face, { loops: [] });
  // the leaves
  const L = { hw, h, t, ct, cb, overlap: OCT.overlap, seam: OCT.seam, gap: OCT.gap }, key = `oct-leaf:${clear}x${h}:${t}:${ct}x${cb}`;
  if (leaves === 2) {
    const s = OCT.seam, slide = hw + s + 0.015;
    p.leaf(key + ':L', (q) => leaf(q, { ...L, kind: 'L' }), { slide: [-slide, 0, 0], door: 0 });
    p.leaf(key + ':R', (q) => leaf(q, { ...L, kind: 'R' }), { slide: [slide, 0, 0], door: 0 });
  } else if (leaves < 0) p.leaf(key + ':one', (q) => leaf(q, { ...L, kind: 'one' }), { slide: [-(2 * hw + 0.05), 0, 0], door: 0 });
  else p.leaf(key + ':one', (q) => leaf(q, { ...L, kind: 'one' }), { rot: [0, PI, 0], slide: [2 * hw + 0.05, 0, 0], door: 0 });
  if (!locked) p.door(0, [0, Math.min(1.2, h / 2), 0], o.near ?? 1.6);
  return p;
}

// a flat quad w x h facing +z, centred, its uv a rect of the decal sheet
export function planeAt(w, h, rectName) { const r = kitTextures().decal.rect[rectName]; if (!r) throw new Error('kit: no decal ' + rectName); return plane(w, h, { uv: r, cell: 9 }); }

// the control panel: a chamfered charcoal bezel standing off the wall, a sunk dark screen reading STANDBY with a white
// bar, an up and a down button, the hazard hatching under it (centred on x, y; standing on the wall's face at z; s: its
// size, 1 a ship's, bigger on the station's taller walls)
export function controlPanel(A0, x0, y0, z0, s = 1) {
  const A = (look, g, at, rot, mat) => { put(g, at || [0, 0, 0], rot || [0, 0, 0]); g.scale(s, s, s); g.translate(x0, y0, z0); A0(look, g, null, null, mat); };
  const x = 0, y = 0, z = 0;
  A('black', solid(shape(0.13, 0.25, 0.026, x, y), 0.016, { edge: 0.004, back: false, front: [{ inset: 0.012, depth: -0.004, bevel: 0.004 }] }), [0, 0, z]);
  A({ c: '#15181c', r: 0.25, m: 0.2, w: 0.1 }, plate(shape(0.09, 0.09, 0.012, x, y + 0.055)), [0, 0, z + 0.0125]);
  A('#cfe6ff', planeAt(0.08, 0.02, 'cabin:standby'), [x, y + 0.06, z + 0.013], null, 'decal');
  A('white', plate(shape(0.05, 0.005, 0.001, x, y + 0.035)), [0, 0, z + 0.0132], null, 'glow');
  for (const [by, ry] of [[y - 0.03, 0], [y - 0.075, PI]]) {
    A('gun', solid(shape(0.04, 0.032, 0.008, x, by), 0.006, { edge: 0.002, back: false }), [0, 0, z + 0.012]);
    A('#e9edf2', planeAt(0.02, 0.02, 'cabin:arrow'), [x, by, z + 0.0185], [0, 0, ry], 'decal');
  }
  A('#c9a032', planeAt(0.13, 0.03, 'hazard'), [x, y - 0.155, z + 0.002], null, 'decal');
}

// ── a leaf ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// drawn shut, in the doorway's frame: kind 'L' (the left of two, from -x to the seam), 'R' (the right of two), 'one'
// (the whole opening, its edges tucked behind the frame both sides; a leaf sliding toward +x is it turned round)
function leaf(q, L) {
  const { hw, h, t, ct, cb, overlap: o, seam: s, gap: g, kind } = L, y0 = 0.004, yT = h + o;
  // its outer corners chamfered to match the opening's, grown by how far it runs on behind the frame
  const cT = ct + o * K, cB = Math.max(0, cb - o * (Math.SQRT2 - 1)), X = hw + o;
  // the seam: straight up, a 45-degree step across to the other side, straight, and back (the left leaf's edge)
  const y1 = 0.45 * h, y2 = 0.62 * h, seam = [[s, y0], [s, y1], [-s, y1 + 2 * s], [-s, y2], [s, y2 + 2 * s], [s, yT]];
  let pts;
  if (kind === 'L') pts = [[-X + cB, y0], ...seam.map(([x, y]) => [x - g, y]), [-X + cT, yT], [-X, yT - cT], [-X, y0 + cB]];
  else if (kind === 'R') pts = [[s + g, y0], [X - cB, y0], [X, y0 + cB], [X, yT - cT], [X - cT, yT], ...seam.slice().reverse().map(([x, y]) => [x + g, y])];
  else { const X2 = hw + 0.025; pts = octagon({ w: X + X2, h: yT - y0, c: [cB, Math.max(0, cb - 0.025 * (Math.SQRT2 - 1)), ct + 0.025 * K, cT], x: (X2 - X) / 2, y: (y0 + yT) / 2 }); }
  // the field: a chamfered panel sunk into its face, clear of the seam and its handle slot
  const b = 0.055, edge = kind === 'L' ? -s - g - 0.06 : kind === 'R' ? s + g + 0.06 : hw - 0.075, start = kind === 'L' ? -hw + b : kind === 'R' ? hw - b : -hw + b;
  const fx0 = Math.min(start, edge), fx1 = Math.max(start, edge), fy0 = 0.2, fy1 = h - 0.16;
  const field = shape(fx1 - fx0, fy1 - fy0, [0.04, 0.07], (fx0 + fx1) / 2, (fy0 + fy1) / 2);
  // handle slots: one upright at mid-height by the meeting edge, one across by the foot
  const hx = kind === 'L' ? -s - g - 0.032 : kind === 'R' ? s + g + 0.032 : hw - 0.04, hy = (y1 + 2 * s + y2) / 2;
  const slots = [shape(0.02, 0.15, 0.008, hx, kind === 'one' ? h * 0.5 : hy), shape(0.12, 0.022, 0.008, (fx0 + fx1) / 2, 0.105)];
  const holes = [octagon(field), ...slots.map(octagon)];
  const d = t / 0.0105;   // (its relief scaled with its thickness: a station leaf is two and a half times a ship's)
  add(q, LEAF_SURF, prism(pts, -t, t, { holes, sides: false }));
  add(q, 'dark', prism(pts, -t, t, { front: false, back: false }));
  const fieldRings = [{ inset: 0, depth: -0.0075 * d, bevel: 0.012 * d }, { inset: 0.024, depth: -0.0045 * d, bevel: 0.004 * d }];
  for (const sz of [1, -1]) {
    // (the back face's reliefs drawn mirrored, then turned round onto it)
    const m = (S) => ({ ...S, x: sz > 0 ? S.x : -S.x }), rot = sz > 0 ? [0, 0, 0] : [0, PI, 0], z = sz * t;
    add(q, FIELD_SURF, relief(m(field), fieldRings), [0, 0, z], rot);
    for (const S of slots) add(q, 'black', relief(m(S), RINGS.sunk(0.005 * d, 0.003)), [0, 0, z], rot);
    // a stencil or two in the field, and bolts at its top corners
    const fz = sz * (t - 0.0045 * d + 0.0004), cx = (fx0 + fx1) / 2;
    q.decal('cabin:seal', Math.min(0.16, fx1 - fx0 - 0.06), 0.04, [cx, fy1 - 0.2, fz], sz > 0 ? null : [0, PI, 0], '#3c3f44');
    q.decal('cabin:clear', Math.min(0.14, fx1 - fx0 - 0.06), 0.035, [cx, fy0 + 0.1, fz], sz > 0 ? null : [0, PI, 0], '#3c3f44');
    for (const bx of [fx0 + 0.02, fx1 - 0.02]) q.slab('gun', bx - 0.006, bx + 0.006, fy1 + 0.035 - 0.006, fy1 + 0.035 + 0.006, sz > 0 ? t : -t - 0.003, sz > 0 ? t + 0.003 : -t, { r: 0 });
  }
  return q;
}

// ── a sample for the station (the Kit Lab only: the station's own doorway is unchanged) ──────────────────────────────
// stationDoorSample(p, o): a stretch of the station's corridor wall, its middle panel the 8-sided doorway at the
// station's size (its 2 m panel, a 1.1 x 2.25 m opening, a frame 0.16 wide, the station's 0.22 m deep wall: a deep
// jamb), the station's own plain panels either side with their skirting and cornice, a strip of corridor floor in front.
// o.both: the station's own doorway too, at the left end, to compare.
export const STATION_OCT = { w: 2, clear: 1.1, h: 2.25, frameW: 0.16, chamfer: [0.15, 0.26], face: 0.22, slot: 0.03, leaf: 0.026, room: STATION_TOP, leaves: 2, near: 2.4, panels: { front: 1, back: -1 }, wall: 'top', panelScale: 1.6 };
function stationPiece(q, o) {
  if (o.v === 'oct') {
    octDoor(q, STATION_OCT);
    // (the bays either side of the frame as the station's own doorway draws them: the backing, the panels, the dark band)
    const x0 = STATION_OCT.clear / 2 + STATION_OCT.frameW;
    for (const sz of [1, -1]) {
      const r = new (q.constructor)(), X0 = -1 + G;
      backing(r, -1, -x0, 0, STATION_TOP, 0.03, Z0); backing(r, x0, 1, 0, STATION_TOP, 0.03, Z0);
      for (const [a, b] of [[X0, -x0], [x0, 1 - G]]) { slabRow(r, a, b, 0.15, BAND[0], [], 'white', [0.02]); band(r, a, b); slabRow(r, a, b, BAND[1], STATION_TOP, [], 'white', [0.02]); }
      slabRow(r, X0, 1 - G, STATION_TOP, 3, [], 'white2');
      for (const pt of r.parts) { if (sz < 0) put(pt.geo, [0, 0, 0], [0, PI, 0]); q.parts.push(pt); }
    }
  } else if (o.v === 'trim') trim(q, o.t);
  else if (o.v === 'floor') floorTile(q, 'walk');
  else wallPanel(q, o.v);
  return q;
}
export function stationDoorSample(p, o = {}) {
  for (const x of o.both ? [-4, -2, 0, 2, 4] : [-2, 0, 2]) {
    const v = x === 0 ? 'oct' : o.both && x === -4 ? 'door' : 'plain';
    placeInto(p, part(stationPiece, { v }), { at: [x, 0, 0], id: `w${x}:` });
    placeInto(p, part(stationPiece, { v: 'trim', t: 'cornice' }), { at: [x, 0, 0] });
    if (v === 'plain') placeInto(p, part(stationPiece, { v: 'trim', t: 'base' }), { at: [x, 0, 0] });
    placeInto(p, part(stationPiece, { v: 'floor' }), { at: [x, 0, 1] });
  }
  return p;
}
