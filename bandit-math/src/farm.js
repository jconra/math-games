// THE FARM: a settler's farm on open ground north of the town (W.places.farm, behind the cabin), where the farm jobs
// happen. A red plank barn at the back, a windmill beside it (it turns, and it is tall enough to be seen from the town
// square), and three fenced spots either side of a lane that runs from the front of the farm (the side facing the town)
// up to the barn doors:
//   the sheep pasture (left of the lane, as you ride in): the flock grazes here; the sick-sheep job (missions/sheep.js)
//   the paddock (right, at the front): a few farm-pack cows and a horse, idling and pottering about
//   the pig yard (right, at the back, beside the barn): a yard with three small pens along its back fence, each with a
//     gap for a gate in its front. The pens are left EMPTY: they are for the loose-pigs job
// Everything is laid out in the farm's own frame (metres; x across the front, z toward the town, so the lane runs along
// +z) and turned into the world by the farm's place; farmLayout(place) gives every spot in world coordinates without
// making anything, so a job can find the pens and gates on its own.
//
// The barn, the windmill's tower, the troughs and the hay are one shape (one draw); the windmill's wheel turns (one
// more); the fences are the town's fences (posts and two rails, the same material: two draws). The barn, the fences, the
// troughs, the hay and the windmill's legs block walkers (W.addBlocker), so the player, the horse and the animals go
// round them and in through the gates.
//
//   const F = makeFarm({ W, animals, scene })   animals: the animal library (src/actors/animals.js); the farm-pack cow
//                                                 and horse are loaded here (lib.need) if they aren't yet
//   F.layout          farmLayout(W.places.farm): see below
//   F.ready           a promise: the paddock animals are in
//   F.update(dt, at)  each frame: at = the player's position (the animals only move within FARM.awake metres of it)
//   F.blocked(x, z)   true where the farm itself blocks (also in W.blocked)
//   F.state()         for rigs
//   F.dispose()
//
// farmLayout(place) -> {   (world coordinates, metres; rot as three's rotation.y: a front facing +z is 0)
//   x, z, rot, w, d          the farm's middle and turn (its front, the lane's open end, faces the way rot says)
//   at(lx, lz)               a point in the farm's own frame, in the world: { x, z }
//   local(x, z)              the other way: a world point in the farm's frame: { x, z }
//   entry                    the lane's open end at the front of the farm, where a rider comes in: { x, z }
//   barn                     { x, z, rot, w, d, h, door: { x, z } }   door: on the ground in front of the big doors
//   windmill                 { x, z }
//   sheep, paddock, yard     the fenced spots: { x, z, rot, w, d, gate: { x, z, rot, width, in, out } } (gate.rot: the way
//                            out, as three's rotation.y; in / out: 3 m inside and outside the gap)
//   pens                     [ { x, z, rot, w, d, gate } x 3 ]   inside the pig yard, along its back fence; their gates
//                            open into the yard (gate.out is in the yard, gate.in inside the pen)
//   area(spot, inset)        a helper for one of those: { contains(x, z), random(rand) -> { x, z } }, inset metres in
//                            from the fence
// }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeAnimal, COATS } from './actors/animals.js';

export const FARM = {
  // the spots, in the farm's own frame (metres from its middle; +z toward the town): x0..x1 across, z0..z1 back to front
  sheep: { x0: -27, x1: -5, z0: -6, z1: 22, gate: { side: '+z', at: -11, width: 4.5 } },
  paddock: { x0: 8, x1: 27, z0: 1, z1: 22, gate: { side: '-x', at: 11.5, width: 4.5 } },
  yard: { x0: 8, x1: 27, z0: -22, z1: -4, gate: { side: '+z', at: 11.5, width: 3.5 } },
  pens: { n: 3, depth: 6, gate: 2.2 },        // along the yard's back fence: how many, how deep (m), each one's gap (m)
  barn: { x: 0, z: -15, w: 12, d: 9, wall: 4.4, ridge: 7.4, rot: 0 },   // its big doors face the lane (+z)
  windmill: { x: -15, z: -14, tall: 9.5, wheel: 2.3 },
  troughs: [{ x: -23.5, z: -2.5, rot: 0 }, { x: 23.5, z: 18.5, rot: 0 }],
  hay: [{ x: -9.4, z: -12.2 }, { x: -9.6, z: -14.4 }, { x: -9.3, z: -13.3, up: true }, { x: 25, z: 3.4 }],
  fence: { gap: 2.2, h: 1.1, half: 0.35 },     // posts about this far apart (as the town's), their height; a rail blocks this far either side
  cows: 3,                                     // farm-pack cows in the paddock (and one horse)
  awake: 220,                                  // metres from the player within which the paddock animals move
  windTurn: 0.55,                              // the windmill wheel's turn (radians a second)
  pad: 0.5,                                    // the barn blocks this far round its walls (as the town's buildings)
  mowFade: 5,                                  // metres outside the farm over which its mown ground gives way to the meadow
};

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ── THE LAYOUT (no three.js objects: a job can call it on its own) ───────────────────────────────────────────────
export function farmLayout(place) {
  const P = place || { x: 0, z: 0, rot: 0, w: 56, d: 48 };
  const rot = P.rot || 0, c = Math.cos(rot), s = Math.sin(rot);
  // (as world.js turns the corral: local x across, local z toward the front)
  const at = (lx, lz) => ({ x: P.x + c * lx + s * lz, z: P.z - s * lx + c * lz });
  const local = (x, z) => { const dx = x - P.x, dz = z - P.z; return { x: c * dx - s * dz, z: s * dx + c * dz }; };
  const OUT = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] };
  // a fenced rectangle in the farm's frame -> its record in the world
  function spot(R) {
    const mx = (R.x0 + R.x1) / 2, mz = (R.z0 + R.z1) / 2, g = R.gate, o = OUT[g.side];
    const gx = o[0] ? (o[0] > 0 ? R.x1 : R.x0) : g.at, gz = o[1] ? (o[1] > 0 ? R.z1 : R.z0) : g.at;
    const gate = { ...at(gx, gz), rot: wrap(rot + Math.atan2(o[0], o[1])), width: g.width, in: at(gx - o[0] * 3, gz - o[1] * 3), out: at(gx + o[0] * 3, gz + o[1] * 3) };
    return { ...at(mx, mz), rot, w: R.x1 - R.x0, d: R.z1 - R.z0, gate, box: R };
  }
  const Y = FARM.yard, PN = FARM.pens, pw = (Y.x1 - Y.x0) / PN.n;
  const pens = [];
  for (let i = 0; i < PN.n; i++) {
    const x0 = Y.x0 + i * pw, x1 = x0 + pw, z0 = Y.z0, z1 = Y.z0 + PN.depth;
    pens.push(spot({ x0, x1, z0, z1, gate: { side: '+z', at: (x0 + x1) / 2, width: PN.gate } }));
  }
  const B = FARM.barn, bd = at(B.x, B.z + B.d / 2 + 1.5);
  const L = {
    x: P.x, z: P.z, rot, w: P.w || 56, d: P.d || 48, at, local,
    entry: at(1, (P.d || 48) / 2),
    barn: { ...at(B.x, B.z), rot: wrap(rot + B.rot), w: B.w, d: B.d, h: B.ridge, door: bd },
    windmill: at(FARM.windmill.x, FARM.windmill.z),
    sheep: spot(FARM.sheep), paddock: spot(FARM.paddock), yard: spot(FARM.yard), pens,
  };
  // a spot's inside, inset metres in from its fence
  L.area = (sp, inset = 1.5) => {
    const b = sp.box, x0 = b.x0 + inset, x1 = b.x1 - inset, z0 = b.z0 + inset, z1 = b.z1 - inset;
    return {
      contains: (x, z) => { const p = local(x, z); return p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1; },
      random: (rand = Math.random) => at(x0 + rand() * (x1 - x0), z0 + rand() * (z1 - z0)),
    };
  };
  return L;
}

// the fence lines in the farm's frame: each spot's four sides with its gate left open, and the pens' fronts and sides
function fenceLines() {
  const lines = [];
  const rect = (R, gaps = []) => {
    const sides = { '-z': [[R.x0, R.z0], [R.x1, R.z0]], '+x': [[R.x1, R.z0], [R.x1, R.z1]], '+z': [[R.x1, R.z1], [R.x0, R.z1]], '-x': [[R.x0, R.z1], [R.x0, R.z0]] };
    for (const [side, [a, b]] of Object.entries(sides)) lines.push(...cut(a, b, gaps.filter((g) => g.side === side)));
  };
  // a straight line with gaps cut out of it (each gap at `at` along the side's own axis, `width` wide)
  function cut(a, b, gaps) {
    const along = a[0] === b[0] ? 1 : 0, lo = Math.min(a[along], b[along]), hi = Math.max(a[along], b[along]);
    const holes = gaps.map((g) => [g.at - g.width / 2, g.at + g.width / 2]).sort((p, q) => p[0] - q[0]);
    const out = []; let from = lo;
    for (const [h0, h1] of holes) { if (h0 > from + 0.3) out.push([from, h0]); from = Math.max(from, h1); }
    if (hi > from + 0.3) out.push([from, hi]);
    return out.map(([u0, u1]) => (along ? [[a[0], u0], [a[0], u1]] : [[u0, a[1]], [u1, a[1]]]));
  }
  for (const k of ['sheep', 'paddock', 'yard']) rect(FARM[k], [FARM[k].gate]);
  // the pens: a front line along the yard with a gap for each pen, and the walls between them (the yard's own back
  // and side fences close them in)
  const Y = FARM.yard, PN = FARM.pens, pw = (Y.x1 - Y.x0) / PN.n, fz = Y.z0 + PN.depth;
  const gaps = []; for (let i = 0; i < PN.n; i++) gaps.push({ at: Y.x0 + (i + 0.5) * pw, width: PN.gate });
  lines.push(...cut([Y.x0, fz], [Y.x1, fz], gaps));
  for (let i = 1; i < PN.n; i++) lines.push([[Y.x0 + i * pw, Y.z0], [Y.x0 + i * pw, fz]]);
  return lines;
}

// ── PIECES OF THE BARN AND THE REST (simple shapes, coloured by vertex, merged into one) ───────────────────────────
// Every piece gets the same attributes (position, normal, uv, colour), no index. Its uv is laid flat on the wall or roof
// it is part of, in metres, so the plank picture runs the same way and size everywhere; `plain` pieces (stone, hay,
// water) sit on a smooth part of the picture.
function piece(geo, color, { at = [0, 0, 0], rot = [0, 0, 0], plain = false, shade = 0 } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ')), new THREE.Vector3(1, 1, 1)));
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2), col = new Float32Array(p.count * 3);
  const base = new THREE.Color(color);
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    let u, v;
    if (plain) { u = 0.5; v = 0.5; }
    else if (ny > 0.85) { u = p.getX(i); v = p.getZ(i); }
    else if (nx > nz) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u; uv[i * 2 + 1] = v;
    const k = 1 + shade * (Math.sin(p.getX(i) * 3.1 + p.getZ(i) * 1.7) * 0.5);
    col[i * 3] = base.r * k; col[i * 3 + 1] = base.g * k; col[i * 3 + 2] = base.b * k;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// a gable end: a triangle w wide and h tall, t thick, its base on y = 0
function gable(w, h, t) {
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath();
  return new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }).translate(0, 0, -t / 2);
}

// the plank picture: grey boards with dark seams and a little grain, multiplied over the vertex colours (1 m square)
function plankTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#d8d8d8'; c.fillRect(0, 0, 256, 256);
  for (let b = 0; b < 4; b++) {
    const x = b * 64, tone = 205 + ((b * 37) % 5) * 9;
    c.fillStyle = `rgb(${tone},${tone},${tone})`; c.fillRect(x + 3, 0, 58, 256);
    c.strokeStyle = 'rgba(90, 90, 90, 0.25)'; c.lineWidth = 1;
    for (let g = 0; g < 7; g++) { const gx = x + 8 + g * 7 + ((b + g) % 3); c.beginPath(); c.moveTo(gx, 0); c.bezierCurveTo(gx + 3, 80, gx - 3, 170, gx + 1, 256); c.stroke(); }
    c.fillStyle = '#555'; c.fillRect(x, 0, 3, 256);                       // the seam between boards
    c.fillStyle = 'rgba(60,60,60,0.5)'; c.fillRect(x + 20 + b * 6, 40 + b * 50, 3, 3); c.fillRect(x + 22 + b * 6, 200 - b * 20, 3, 3);   // nail heads
  }
  // the middle of the second board is left smooth for the plain pieces (uv 0.5, 0.5)
  c.fillStyle = '#dcdcdc'; c.fillRect(100, 100, 56, 56);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const COL = {
  barn: '#8c3a2b', trim: '#e7dcc7', roof: '#55504a', doorIn: '#6e2c21', stone: '#8a857c', wood: '#7a5a3c', dark: '#3a2d22',
  hay2: ['#e6c66a', '#d8b55c', '#efd27a', '#ddbb62'], twine: '#5b4a30', water: '#5d8794', metal: '#8f969a', vane: '#b04a36',
};

// the barn, the windmill's tower, the troughs and the hay, in the farm's frame, each standing on its own ground
// (ground(lx, lz) -> height in metres)
function staticPieces(ground) {
  const out = [];
  const B = FARM.barn, hw = B.w / 2, hd = B.d / 2;
  // the barn stands on its highest corner (plus a little), with a stone footing down to below its lowest one
  let hi = -Infinity, lo = Infinity;
  for (const [x, z] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd], [0, 0]]) { const h = ground(B.x + x, B.z + z); hi = Math.max(hi, h); lo = Math.min(lo, h); }
  const y0 = hi + 0.25, foot = y0 - lo + 0.6;
  const bp = (g, color, o = {}) => out.push(piece(g, color, { ...o, at: [B.x + (o.at ? o.at[0] : 0), y0 + (o.at ? o.at[1] : 0), B.z + (o.at ? o.at[2] : 0)] }));
  bp(box(B.w + 0.4, foot, B.d + 0.4), COL.stone, { at: [0, -foot / 2 + 0.05, 0], plain: true, shade: 0.12 });
  bp(box(B.w, B.wall, B.d), COL.barn, { at: [0, B.wall / 2 + 0.05, 0], shade: 0.06 });
  for (const s of [1, -1]) bp(gable(B.w, B.ridge - B.wall, 0.12), COL.barn, { at: [0, B.wall + 0.05, s * (hd - 0.06)], shade: 0.06 });
  // the roof: two slabs from the ridge down past the walls
  const run = hw + 0.7, rise = B.ridge - B.wall, slope = Math.atan2(rise, hw), len = run / Math.cos(slope);
  for (const s of [1, -1]) bp(box(len, 0.16, B.d + 1.0), COL.roof, { at: [s * (len / 2) * Math.cos(slope), B.ridge + 0.16 - (len / 2) * Math.sin(slope), 0], rot: [0, 0, -s * slope], shade: 0.08 });
  bp(box(0.3, 0.3, B.d + 1.1), COL.roof, { at: [0, B.ridge + 0.16, 0], rot: [0, 0, Math.PI / 4] });
  // the big doors on the front: a dark inset, white frame, the cross braces
  const fz = hd + 0.04, dw = 4.4, dh = 3.4;
  bp(box(dw, dh, 0.08), COL.doorIn, { at: [0, dh / 2 + 0.05, fz] });
  for (const [w, h, x, y] of [[dw + 0.3, 0.2, 0, dh + 0.1], [0.2, dh, -dw / 2 - 0.05, dh / 2], [0.2, dh, dw / 2 + 0.05, dh / 2], [0.14, dh, 0, dh / 2]]) bp(box(w, h, 0.12), COL.trim, { at: [x, y + 0.05, fz + 0.03] });
  const diag = Math.hypot(dw / 2, dh) - 0.2, ang = Math.atan2(dh, dw / 2);
  for (const sx of [-1, 1]) for (const k of [1, -1]) bp(box(diag, 0.14, 0.1), COL.trim, { at: [sx * dw / 4, dh / 2 + 0.05, fz + 0.05], rot: [0, 0, k * ang] });
  // the hay-loft door above, and white boards on the corners and under the eaves
  bp(box(1.5, 1.4, 0.08), COL.doorIn, { at: [0, B.wall + 0.9, fz] });
  for (const [w, h, x, y] of [[1.8, 0.16, 0, B.wall + 1.65], [1.8, 0.16, 0, B.wall + 0.15], [0.16, 1.5, -0.83, B.wall + 0.9], [0.16, 1.5, 0.83, B.wall + 0.9]]) bp(box(w, h, 0.1), COL.trim, { at: [x, y, fz + 0.03] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bp(box(0.22, B.wall, 0.22), COL.trim, { at: [sx * (hw - 0.05), B.wall / 2 + 0.05, sz * (hd - 0.05)] });
  // a small window either side wall
  for (const sx of [-1, 1]) {
    bp(box(0.08, 1.0, 1.4), COL.dark, { at: [sx * (hw + 0.02), 2.4, -1] });
    bp(box(0.1, 1.2, 0.14), COL.trim, { at: [sx * (hw + 0.04), 2.4, -1.75] }); bp(box(0.1, 1.2, 0.14), COL.trim, { at: [sx * (hw + 0.04), 2.4, -0.25] });
    bp(box(0.1, 0.14, 1.6), COL.trim, { at: [sx * (hw + 0.04), 2.95, -1] }); bp(box(0.1, 0.14, 1.6), COL.trim, { at: [sx * (hw + 0.04), 1.85, -1] });
  }

  // THE WINDMILL'S TOWER: four legs leaning in, cross braces, a little platform; the wheel is its own shape (it turns)
  const M = FARM.windmill, my = ground(M.x, M.z) - 0.2, base = 1.3, top = 0.38, T = M.tall;
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of legs) {
    const dx = (top - base) * sx, dz = (top - base) * sz, L = Math.hypot(T, Math.hypot(dx, dz));
    const g = box(0.13, L, 0.13);
    // lean it from (base) at the foot to (top) at the head
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, T, dz).normalize());
    g.applyQuaternion(q); g.translate(M.x + sx * (base + top) / 2, my + T / 2, M.z + sz * (base + top) / 2);
    out.push(piece(g, COL.wood, {}));
  }
  for (const f of [0.3, 0.6, 0.9]) {
    const r = base + (top - base) * f, y = my + T * f;
    for (const [w, d, x, z] of [[2 * r, 0.08, 0, r], [2 * r, 0.08, 0, -r], [0.08, 2 * r, r, 0], [0.08, 2 * r, -r, 0]]) out.push(piece(box(w, 0.08, d), COL.wood, { at: [M.x + x, y, M.z + z] }));
  }
  out.push(piece(box(1.3, 0.1, 1.3), COL.wood, { at: [M.x, my + T, M.z] }));
  out.push(piece(box(0.5, 0.5, 0.9), COL.metal, { at: [M.x, my + T + 0.35, M.z], plain: true }));                       // the gear box
  out.push(piece(box(0.06, 0.06, 1.6), COL.metal, { at: [M.x, my + T + 0.35, M.z - 1.1], plain: true }));                // the tail's arm (behind)
  out.push(piece(box(0.05, 0.8, 1.0), COL.vane, { at: [M.x, my + T + 0.45, M.z - 1.9], plain: true }));                  // the tail vane
  out.push(piece(box(1.6, 0.9, 0.9), COL.wood, { at: [M.x + 1.6, ground(M.x + 1.6, M.z) + 0.3, M.z], shade: 0.1 }));     // a stock tank at its foot
  out.push(piece(box(1.4, 0.06, 0.7), COL.water, { at: [M.x + 1.6, ground(M.x + 1.6, M.z) + 0.72, M.z], plain: true }));

  // THE TROUGHS AND THE HAY
  for (const t of FARM.troughs) {
    const y = ground(t.x, t.z);
    out.push(piece(box(2.4, 0.55, 0.7), COL.wood, { at: [t.x, y + 0.22, t.z], rot: [t.rot, 0, 0], shade: 0.1 }));
    out.push(piece(box(2.2, 0.05, 0.52), COL.water, { at: [t.x, y + 0.47, t.z], rot: [t.rot, 0, 0], plain: true }));
  }
  // a bale: four pressed flakes of straw in slightly different golds, a little ragged, with two bands of twine round it
  for (const h of FARM.hay) {
    const y = ground(h.x, h.z) + (h.up ? 0.92 : 0.42), o = { at: [h.x, y, h.z], rot: [h.up ? 0.4 : 0.1, 0, 0], plain: true };
    for (let f = 0; f < 4; f++) {
      const grow = [0.03, 0, 0.04, 0.01][f];
      out.push(piece(box(0.31, 0.85 + grow, 0.9 + grow).translate(-0.4875 + f * 0.325, 0, 0), COL.hay2[f], { ...o, shade: 0.2 }));
    }
    for (const bx of [-0.33, 0.33]) out.push(piece(box(0.035, 0.9, 0.95).translate(bx, 0, 0), COL.twine, o));
  }
  return out;
}

// the windmill's wheel: twelve blades on a hub, facing +z (turned about z in the frame)
function wheelGeometry(r) {
  const parts = [piece(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 10).rotateX(Math.PI / 2), COL.metal, { plain: true })];
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const blade = box(0.26, r * 0.62, 0.03).translate(0, r * 0.62, 0).rotateY(0.35).rotateZ(a);
    parts.push(piece(blade, COL.metal, { plain: true, shade: 0.05 }));
    parts.push(piece(box(0.05, r * 0.38, 0.05).translate(0, r * 0.19, 0).rotateZ(a), COL.metal, { plain: true }));
  }
  parts.push(piece(new THREE.TorusGeometry(r * 0.94, 0.035, 4, 32), COL.metal, { plain: true }));
  parts.push(piece(new THREE.TorusGeometry(r * 0.4, 0.03, 4, 24), COL.metal, { plain: true }));
  return mergeGeometries(parts);
}

// ── MAKING THE FARM ──────────────────────────────────────────────────────────────────────────────────────────────
export function makeFarm({ W, animals = null, scene = W.scene }) {
  const L = farmLayout(W.places.farm);
  const ground = (lx, lz) => { const p = L.at(lx, lz); return W.heightAt(p.x, p.z); };
  const root = new THREE.Group(); root.name = 'farm';
  root.position.set(L.x, 0, L.z); root.rotation.y = L.rot;
  scene.add(root);
  const shadows = !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  // the town's own land shading (the hill's shade and the street lamps), borrowed from the town's fences when there are any
  const fm = W.V && W.V.FENCE && W.V.FENCE.mat;
  const landShade = (m) => { if (fm && fm.onBeforeCompile) { m.onBeforeCompile = fm.onBeforeCompile; m.customProgramCacheKey = fm.customProgramCacheKey; } return m; };

  // the barn and the rest: one shape
  const tex = plankTexture();
  const mat = landShade(new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.88, metalness: 0 }));
  const geo = mergeGeometries(staticPieces(ground));
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'farm-buildings';
  mesh.castShadow = mesh.receiveShadow = true;
  root.add(mesh);
  // the windmill's wheel, high on its tower, facing the town
  const M = FARM.windmill, wgeo = wheelGeometry(M.wheel);
  const wmat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.6, metalness: 0.3 });
  const wheel = new THREE.Mesh(wgeo, wmat); wheel.name = 'farm-windmill-wheel'; wheel.castShadow = true;
  wheel.position.set(M.x, ground(M.x, M.z) - 0.2 + M.tall + 0.35, M.z + 0.6);
  root.add(wheel);

  // THE FENCES: the town's look (posts about every 2.2 m, two rails), standing on the land
  const lines = fenceLines(), posts = [], rails = [];
  const F = FARM.fence;
  for (const [a, b] of lines) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / F.gap));
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const lx = a[0] + (b[0] - a[0]) * i / n, lz = a[1] + (b[1] - a[1]) * i / n, p = [lx, ground(lx, lz), lz];
      posts.push(p); if (prev) rails.push([prev, p]); prev = p;
    }
  }
  const fmat = fm || new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.92 });
  const postG = new THREE.BoxGeometry(0.14, 1, 0.14).translate(0, 0.5, 0), railG = new THREE.BoxGeometry(1, 0.08, 0.06).translate(0.5, 0, 0);
  const pm = new THREE.InstancedMesh(postG, fmat, posts.length), rm = new THREE.InstancedMesh(railG, fmat, rails.length * 2);
  {
    const Mx = new THREE.Matrix4(), Q = new THREE.Quaternion(), Yv = new THREE.Vector3(0, 1, 0), Xv = new THREE.Vector3(1, 0, 0), c = new THREE.Color(), dir = new THREE.Vector3();
    const h01 = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
    posts.forEach((p, i) => { const r = h01(p[0], p[2]); pm.setMatrixAt(i, Mx.compose(new THREE.Vector3(p[0], p[1] - 0.08, p[2]), Q.setFromAxisAngle(Yv, r * 6.28), new THREE.Vector3(1, F.h + 0.08 + r * 0.1, 1))); pm.setColorAt(i, c.setScalar(0.8 + 0.35 * r)); });
    rails.forEach(([p, q], i) => {
      dir.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]); const len = dir.length(); dir.normalize(); Q.setFromUnitVectors(Xv, dir);
      for (const [k, f] of [[0, 0.42], [1, 0.82]]) { rm.setMatrixAt(i * 2 + k, Mx.compose(new THREE.Vector3(p[0], p[1] + F.h * f, p[2]), Q, new THREE.Vector3(len, 1, 1))); rm.setColorAt(i * 2 + k, c.setScalar(0.85 + 0.3 * h01(p[0] + k, p[2]))); }
    });
  }
  for (const m of [pm, rm]) { m.castShadow = m.receiveShadow = shadows; m.name = 'farm-fences'; root.add(m); }

  // ── WHAT BLOCKS (in the farm's frame) ──────────────────────────────────────────────────────────────────────────
  const B = FARM.barn, segs = lines.map(([a, b]) => [a[0], a[1], b[0], b[1]]);
  const boxes = [
    [B.x - B.w / 2 - FARM.pad, B.z - B.d / 2 - FARM.pad, B.x + B.w / 2 + FARM.pad, B.z + B.d / 2 + FARM.pad],
    [M.x - 1.6, M.z - 1.6, M.x + 2.6, M.z + 1.6],                       // the windmill's legs and its stock tank
    ...FARM.troughs.map((t) => [t.x - 1.4, t.z - 0.5, t.x + 1.4, t.z + 0.5]),
    ...FARM.hay.map((h) => [h.x - 0.8, h.z - 0.6, h.x + 0.8, h.z + 0.6]),
  ];
  const reach = Math.hypot(L.w, L.d) / 2 + 4;
  function blockedLocal(lx, lz) {
    for (const b of boxes) if (lx > b[0] && lx < b[2] && lz > b[1] && lz < b[3]) return true;
    const r2 = F.half * F.half;
    for (const [ax, az, bx, bz] of segs) {
      const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1e-9, t = Math.max(0, Math.min(1, ((lx - ax) * vx + (lz - az) * vz) / l2));
      const dx = ax + vx * t - lx, dz = az + vz * t - lz; if (dx * dx + dz * dz < r2) return true;
    }
    return false;
  }
  const blocked = (x, z) => { if (Math.abs(x - L.x) > reach || Math.abs(z - L.z) > reach) return false; const p = L.local(x, z); return blockedLocal(p.x, p.z); };
  const offBlock = W.addBlocker ? W.addBlocker(blocked) : () => {};

  // ── THE GROUND: mown, as the town's yards are (the valley's TOWN.yard: lawn, no tall meadow), so the sheep and the
  // pens aren't lost in grass taller than a sheep; fading back to the meadow over FARM.mowFade metres outside. The plants
  // round the player are laid again from it as the player moves (their remembered tiles are let go); the old values come
  // back on dispose
  const unmow = mow();
  const unlawn = potatoLawn();
  // On the potato tier the ground has no pictures, only each layer's average colour, and its meadow is darkened by the
  // plants on it: mown, the farm showed one flat, bright lime green. There a thin sheet laid over the farm's ground gives
  // it the meadow's darker green, mottled a little, fading out at its edge.
  function potatoLawn() {
    if (W.tier !== 'potato') return () => {};
    const fade = FARM.mowFade, hw = L.w / 2 + fade, hd = L.d / 2 + fade, step = 2;
    const nx = Math.ceil(hw * 2 / step), nz = Math.ceil(hd * 2 / step);
    const pos = [], col = [], idx = [];
    const noise = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.31 + Math.sin(z * 0.17) * 2.1) * Math.cos(z * 0.27 - x * 0.06) + 0.25 * Math.sin(x * 0.9 + z * 0.7);
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const lx = -hw + i * hw * 2 / nx, lz = -hd + j * hd * 2 / nz, p = L.at(lx, lz);
      pos.push(lx, W.heightAt(p.x, p.z) + 0.06, lz);
      const out = Math.max(0, Math.abs(lx) - L.w / 2, Math.abs(lz) - L.d / 2) / fade, a = 1 - Math.min(1, out), n = noise(p.x, p.z);
      // (meadow greens, from the darker to the lighter)
      col.push(0.20 + 0.06 * n, 0.30 + 0.07 * n, 0.11 + 0.03 * n, a * a * (3 - 2 * a) * 0.8);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * (nx + 1) + i; idx.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const sheet = new THREE.Mesh(g, m); sheet.name = 'farm-lawn'; sheet.renderOrder = 1; sheet.receiveShadow = false;
    // (laid out in the farm's own frame, but the heights were read in the world's: the sheet sits in the scene, turned)
    sheet.position.set(L.x, 0, L.z); sheet.rotation.y = L.rot;
    scene.add(sheet);
    return () => { sheet.removeFromParent(); g.dispose(); m.dispose(); };
  }
  function mow() {
    const V = W.V, T = V && V.TOWN;
    if (!T || !T.yard || !V.N || !V.TEX) return () => {};
    const N = V.N, TEX = V.TEX, SIZE = V.SIZE, hw = L.w / 2, hd = L.d / 2, fade = FARM.mowFade, R = Math.hypot(hw, hd) + fade + TEX;
    const old = new Map();
    for (let j = Math.max(0, Math.floor((L.z - R + SIZE / 2) / TEX)); j <= Math.min(N - 1, Math.ceil((L.z + R + SIZE / 2) / TEX)); j++)
      for (let i = Math.max(0, Math.floor((L.x - R + SIZE / 2) / TEX)); i <= Math.min(N - 1, Math.ceil((L.x + R + SIZE / 2) / TEX)); i++) {
        const p = L.local((i + 0.5) * TEX - SIZE / 2, (j + 0.5) * TEX - SIZE / 2);
        const out = Math.hypot(Math.max(0, Math.abs(p.x) - hw), Math.max(0, Math.abs(p.z) - hd)), t = Math.min(1, out / fade), y = 1 - t * t * (3 - 2 * t);
        const k = j * N + i; if (y > T.yard[k]) { old.set(k, T.yard[k]); T.yard[k] = y; }
      }
    const forget = () => { const c = V.COVER && V.COVER.cache; if (c && c.tiles) c.tiles.clear(); };
    forget();
    return () => { for (const [k, v] of old) T.yard[k] = v; forget(); };
  }

  // ── THE PADDOCK: a few cows and a horse ────────────────────────────────────────────────────────────────────────
  const herd = [], pad = L.area(L.paddock, 2);
  let disposed = false;
  const ready = (animals ? Promise.all(['farmCow', 'farmHorse'].map((k) => animals.need(k))) : Promise.reject(new Error('no animal library')))
    .then(() => {
      if (disposed) return;
      const kinds = [...Array(FARM.cows).fill('farmCow'), 'farmHorse'];
      kinds.forEach((k, i) => {
        const a = makeAnimal(animals, k, { shadows, tint: k === 'farmCow' && i ? COATS[(i * 3) % COATS.length] : null });
        let p = pad.random(), rot = Math.random() * Math.PI * 2;
        for (let t = 0; t < 20 && (herd.some((o) => Math.hypot(o.a.root.position.x - p.x, o.a.root.position.z - p.z) < 4) || !clear(a, p.x, p.z, rot)); t++) { p = pad.random(); rot = Math.random() * Math.PI * 2; }
        a.root.position.set(p.x, W.heightAt(p.x, p.z), p.z); a.root.rotation.y = rot;
        scene.add(a.root);
        herd.push(wanderer(a, pad, { rest: [5, 14], walk: 0.6, others: herd, room: 3 }));
      });
    })
    .catch((e) => console.warn('farm: the paddock animals could not load', e));

  // true when an animal standing at (x, z) facing `rot` is clear of what blocks from nose to tail (a blocker only tests
  // a point, and a cow or a horse is about 2 m long: tested at its middle alone, its head ends up in the trough)
  function clear(a, x, z, rot) {
    const h = (a.length || 1) * 0.5, sx = Math.sin(rot) * h, sz = Math.cos(rot) * h;
    return !W.blocked(x, z) && !W.blocked(x + sx, z + sz) && !W.blocked(x - sx, z - sz);
  }

  // true when (x, z) is at least w.room from each of w.others, where it stands and where it is heading
  function roomy(w, x, z) {
    if (!w.others) return true;
    for (const o of w.others) {
      if (o === w) continue;
      const q = o.a.root.position;
      if (Math.hypot(q.x - x, q.z - z) < w.room || (o.goal && Math.hypot(o.goal.x - x, o.goal.z - z) < w.room)) return false;
    }
    return true;
  }

  // a pottering animal: stands (Idle) a while, then ambles to a spot nearby at its slow walk (feet on the ground: the
  // clip at its own pace), and stands again. It keeps inside its area and its whole body out of what blocks
  // others: the animals it shares the area with (it keeps `room` metres from where they stand or are heading)
  function wanderer(a, area, { rest = [4, 10], walk = 0.5, others = null, room = 0 } = {}) {
    const w = { a, area, goal: null, t: rest[0] + Math.random() * (rest[1] - rest[0]), rest, walk, others, room };
    a.play('Idle');
    return w;
  }
  function wanderStep(w, dt) {
    const a = w.a, r = a.root;
    if (!w.goal) {
      if ((w.t -= dt) <= 0) {
        for (let k = 0; k < 8; k++) {
          const ang = Math.random() * Math.PI * 2, d = 2 + Math.random() * 5, x = r.position.x + Math.sin(ang) * d, z = r.position.z + Math.cos(ang) * d;
          if (w.area.contains(x, z) && clear(a, x, z, ang) && roomy(w, x, z)) { w.goal = { x, z }; break; }
        }
        if (!w.goal) w.t = 2;
      }
    } else {
      const dx = w.goal.x - r.position.x, dz = w.goal.z - r.position.z, d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz), turn = wrap(want - r.rotation.y);
      r.rotation.y += turn * Math.min(1, 2.5 * dt);
      const v = a.stride.WalkSlow * (Math.abs(turn) > 1.2 ? 0.4 : 1), step = Math.min(d, v * dt);
      const nx = r.position.x + Math.sin(r.rotation.y) * step, nz = r.position.z + Math.cos(r.rotation.y) * step;
      // (the nose is tested the way it is heading, toward the goal, so an animal still turning round isn't held up)
      const nose = (a.length || 1) * 0.5, hx = nx + Math.sin(want) * nose, hz = nz + Math.cos(want) * nose;
      // (and it stops short rather than walk into another animal of its area)
      const bump = !!w.others && w.others.some((o) => { if (o === w) return false; const q = o.a.root.position, dn = Math.hypot(q.x - nx, q.z - nz); return dn < w.room * 0.6 && dn < Math.hypot(q.x - r.position.x, q.z - r.position.z); });
      if (d < 0.3 || bump || !w.area.contains(nx, nz) || W.blocked(nx, nz) || W.blocked(hx, hz)) { w.goal = null; w.t = w.rest[0] + Math.random() * (w.rest[1] - w.rest[0]); a.play('Idle', { fade: 0.35 }); }
      else { r.position.set(nx, W.heightAt(nx, nz), nz); a.play('WalkSlow', { fade: 0.35, speed: v / a.stride.WalkSlow }); }
    }
    a.update(dt);
  }

  const farm = {
    layout: L, ready, blocked, root, herd,
    wanderer, wanderStep,
    update(dt, at) {
      wheel.rotation.z -= FARM.windTurn * dt;
      const d = at ? Math.hypot(at.x - L.x, at.z - L.z) : 0;
      if (d > FARM.awake) return;
      for (const w of herd) wanderStep(w, dt);
    },
    state: () => ({ at: { x: L.x, z: L.z }, posts: posts.length, rails: rails.length, animals: herd.map((w) => ({ kind: w.a.kind, x: +w.a.root.position.x.toFixed(1), z: +w.a.root.position.z.toFixed(1), clip: w.a.clip })) }),
    dispose() {
      disposed = true; offBlock(); unmow(); unlawn();
      for (const w of herd) w.a.dispose();
      herd.length = 0;
      root.removeFromParent();
      geo.dispose(); mat.dispose(); wgeo.dispose(); wmat.dispose(); tex.dispose();
      postG.dispose(); railG.dispose(); pm.dispose(); rm.dispose();
      if (!fm) fmat.dispose();
    },
  };
  return farm;
}
