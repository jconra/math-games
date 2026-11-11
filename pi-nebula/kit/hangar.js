// THE HANGAR, and the docking airlock.
//   baydoor   a POINT piece on the hangar's wall, 16 m wide and 7 m tall: a 14 x 5.6 m opening to space in massive
//             charcoal jambs and lintel (hazard stripes, the big door slid up into the lintel), a glowing shield across
//             it that holds the air in (the 'shield' material), emitters down each jamb and along the sill, and a
//             short deck (the apron) outside with lights along its edge
//   mark      paint on the floor (decals): 'ring' (a landing pad round a grid point: a circle 9 m across, ticks, a
//             cross and its name), 'line' (a yellow line along an edge), 'hazard' (stripes along an edge), 'box'
//             (a white keep-clear box in a cell), 'arrow'
//   airlock   a bulkhead across a corridor (like the hatch) with a round door: 'inner' (two half-round leaves that
//             slide apart, each with a little window into the airlock) and 'outer' (the docking port to space: sealed,
//             a porthole, a red light until a ship docks)
//   crate     cargo: 'small', 'large', 'long', 'stack' (a pallet of them)
//   fuel      'pump' (a fuel station), 'pipe' (2 m of fuel line along the floor), 'elbow' (a turn), 'hose' (a hose
//             from a pump across the floor up to a ship's fuel port)
//   gangway   a wheeled boarding stair up to a ship's door: seven steps of 0.18 m to a platform at 1.26 m
import * as THREE from 'three';
import { WALL_FACE as WF, ROOM_H as H } from './grid.js';
import { MeshData, rrect, circle, line, plane, put, fixWinding, bevelBox, flat } from './geo.js';
import { floorQuad, backing, slabRow, G, Z0 } from './shell.js';
import { kitTextures } from './materials.js';
import { BIG_H } from './windows.js';
import { fixFrames } from './wallkit.js';
import { SCREEN_RECT } from './tex.js';

const PI = Math.PI;
export const DOOR_SILL = 7 * 0.18;   // a ship's door: seven steps up (1.26 m)
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
// a decal lying on the floor (facing up), w along x by d along z, centred at (x, z), turned by a about the up axis
function floorDecal(p, rect, w, d, x, z, a = 0, tint = '#d9b23a', y = 0.004) {
  const r = kitTextures().decal.rect[rect], g = plane(w, d, { uv: r, cell: 9 });
  put(g, [0, 0, 0], [-PI / 2, 0, 0]); put(g, [x, y, z], [0, a, 0]); return p.add('decal', g, tint);
}
// a ring of paint on the floor, radius r0 to r1, from angle a0 to a1
function floorRing(p, r0, r1, tint, a0 = 0, a1 = PI * 2, n = 64, y = 0.004) {
  const rect = kitTextures().decal.rect.solid, u = (rect[0] + rect[2]) / 2, v = (rect[1] + rect[3]) / 2, m = new MeshData();
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, c = Math.cos(a), s = Math.sin(a); m.v(c * r0, y, s * r0, 0, 1, 0, u, v); m.v(c * r1, y, s * r1, 0, 1, 0, u, v); }
  for (let i = 0; i < n; i++) m.quad(i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  return p.add('decal', fixWinding(m.geometry()), tint);
}

// ── the bay door ──────────────────────────────────────────────────────────────────────────────────────────────────
const BW = 7, BH = 5.6, BZ0 = -0.7, BZ1 = 0.5;
export function bayDoor(p) {
  const o = { r: 0.03, cell: 1.0, loops: [0.08] };
  // the jambs and the lintel: massive charcoal blocks, stepped on the room's side
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -BW - 1 : BW, x1 = s < 0 ? -BW : BW + 1;
    p.slab('black', x0, x1, 0, BIG_H, BZ0, BZ1, o);
    p.slab('gun', s < 0 ? x0 + 0.15 : x0 + 0.3, s < 0 ? x1 - 0.3 : x1 - 0.15, 0.2, BH - 0.2, BZ1, BZ1 + 0.12, { r: 0.02, cell: 1.0 });
    // the shield's emitter down the jamb's inner face, a glowing blue channel
    const [d0, d1] = s < 0 ? [-BW - 0.08, -BW + 0.01] : [BW - 0.01, BW + 0.08], [e0, e1] = s < 0 ? [-BW - 0.005, -BW + 0.012] : [BW - 0.012, BW + 0.005];
    p.slab('dark', d0, d1, 0.05, BH - 0.05, -0.12, 0.12, { r: 0.01, cell: 1.0 });
    p.glowSlab('blue', e0, e1, 0.1, BH - 0.1, -0.05, 0.05);
    for (let y = 0.8; y < BH; y += 1.6) p.light([s * (BW - 0.4), y, 0.4], 1.2, [0.35, 0.7, 1.4], [-s, 0, 0.5], 7);
    // hazard stripes up the jamb's room face, to head height
    for (let k = 0; k < 2; k++) { const g = plane(1.4, 0.36, { uv: kitTextures().decal.rect.hazard, cell: 9 }); put(g, [(x0 + x1) / 2, 0.45 + k * 0.6, BZ1 + 0.122]); p.add('decal', g, '#d9b23a'); }
  }
  p.slab('black', -BW - 1, BW + 1, BH, BIG_H, BZ0, BZ1, o);
  p.slab('gun', -BW, BW, BH + 0.25, BIG_H - 0.2, BZ1, BZ1 + 0.12, { r: 0.02, cell: 1.0 });
  // the big door itself, slid up into the lintel: its heavy bottom edge shows in the slot
  p.slab('grey', -BW + 0.02, BW - 0.02, BH - 0.12, BH + 0.01, -0.32, 0.1, { r: 0.02, cell: 1.0 });
  for (let x = -BW + 0.6; x < BW; x += 1.2) p.slab('black', x - 0.04, x + 0.04, BH - 0.11, BH - 0.01, 0.09, 0.125, { r: 0.006 });
  // stripes along the lintel's room face, and the shield emitter along its underside
  for (let x = -BW + 0.7; x < BW; x += 1.4) { const g = plane(1.4, 0.32, { uv: kitTextures().decal.rect.hazard, cell: 9 }); put(g, [x, BH + 0.42, BZ1 + 0.122]); p.add('decal', g, '#d9b23a'); }
  p.glowSlab('blue', -BW + 0.05, BW - 0.05, BH - 0.025, BH - 0.02, 0.22, 0.3);
  // the sill: a heavy plate with the third emitter, a glowing slot across the floor
  p.slab('gun', -BW, BW, -0.03, 0.02, BZ0, BZ1, { r: 0.008, cell: 1.0 });
  p.slab('dark', -BW + 0.05, BW - 0.05, 0.015, 0.025, -0.08, 0.08, { r: 0.004, cell: 1.0 });
  p.glowSlab('blue', -BW + 0.1, BW - 0.1, 0.02, 0.026, -0.03, 0.03);
  for (let x = -BW + 1; x < BW; x += 2.5) p.light([x, 0.4, 0.5], 0.8, [0.35, 0.7, 1.4], [0, 0.4, 0.9], 5);
  // the shield: one sheet across the whole opening
  const sh = plane(2 * BW, BH, { cell: 9 }); put(sh, [0, BH / 2, 0]); p.add('shield', sh);
  for (let x = -BW + 1.75; x < BW; x += 3.5) for (const y of [1.4, 4.2]) p.light([x, y, 0.6], 2.2, [0.3, 0.65, 1.3], [0, 0, 1], 10);
  // the apron outside: a deck 4 m deep, a charcoal edge, lights along it (amber at the corners)
  for (let x = -BW + 1; x < BW; x += 2) floorQuad(p, 'tread', x - 1, x + 1, BZ0 - 4, BZ0, 0);
  p.slab('black', -BW - 1, BW + 1, -0.35, 0.0, BZ0 - 4.2, BZ0 - 4, { r: 0.02, cell: 1.0 });
  for (const s of [-1, 1]) p.slab('black', s < 0 ? -BW - 1 : BW, s < 0 ? -BW : BW + 1, -0.35, 0.12, BZ0 - 4.2, BZ0, { r: 0.02, cell: 1.0 });
  p.slab('dark', -BW - 1, BW + 1, -0.4, -0.35, BZ0 - 4.2, BZ0, { r: 0, cell: 9 });
  for (let x = -BW + 0.5; x <= BW - 0.5; x += 1) { const amber = Math.abs(x) > BW - 1; p.slab('black', x - 0.07, x + 0.07, 0, 0.03, BZ0 - 4.1, BZ0 - 3.96, { r: 0.008 }); p.glowSlab(amber ? 'amber' : 'white', x - 0.05, x + 0.05, 0.03, 0.036, BZ0 - 4.08, BZ0 - 3.98); }
}

// ── paint on the floor ────────────────────────────────────────────────────────────────────────────────────────────
export function mark(p, v) {
  if (v === 'ring') {
    floorRing(p, 4.3, 4.55, '#d9b23a'); floorRing(p, 3.85, 3.93, '#d9b23a');
    for (let k = 0; k < 4; k++) { const a = k * PI / 2; floorDecal(p, 'solid', 0.12, 0.9, Math.cos(a) * 4.95, Math.sin(a) * 4.95, -a + PI / 2); }
    for (let k = 0; k < 16; k++) { const a = (k + 0.5) * PI / 8, r = 4.1; floorDecal(p, 'solid', 0.06, 0.24, Math.cos(a) * r, Math.sin(a) * r, -a + PI / 2, '#d9b23a'); }
    floorDecal(p, 'solid', 1.6, 0.12, 0, 0, 0, '#d9d7cf'); floorDecal(p, 'solid', 0.12, 1.6, 0, 0, 0, '#d9d7cf');
    floorRing(p, 0.45, 0.53, '#d9d7cf');
    floorDecal(p, 'label:PAD 1', 2.4, 0.6, 0, 3.15, 0, '#d9d7cf'); floorDecal(p, 'label:PAD 1', 2.4, 0.6, 0, -3.15, PI, '#d9d7cf');
    return;
  }
  if (v === 'line') { floorDecal(p, 'solid', 2.0, 0.12, 0, 0.12); return; }
  if (v === 'hazard') { floorDecal(p, 'hazard', 2.0, 0.42, 0, 0.26); return; }
  if (v === 'arrow') { floorDecal(p, 'arrow', 1.2, 0.3, 0, 0, -PI / 2, '#d9d7cf'); return; }
  // a keep-clear box: four white lines round the cell, ticks across the corners
  for (const [w, d, x, z] of [[1.8, 0.07, 0, -0.9], [1.8, 0.07, 0, 0.9], [0.07, 1.8, -0.9, 0], [0.07, 1.8, 0.9, 0]]) floorDecal(p, 'solid', w, d, x, z, 0, '#d9d7cf');
  for (const [x, z, a] of [[-0.62, -0.62, PI / 4], [0.62, 0.62, PI / 4], [0.62, -0.62, -PI / 4], [-0.62, 0.62, -PI / 4]]) floorDecal(p, 'solid', 0.5, 0.06, x, z, a, '#d9d7cf');
}

// ── the docking airlock ───────────────────────────────────────────────────────────────────────────────────────────
const AR = 0.95, AC = 1.42, ASKIN = 0.25, AHALF = 2;   // (a raised sill, 0.47 m: a step up each side)   // the round door: radius, centre height; the bulkhead's depth and half-width
function roundFace(z) {
  // rings of quads from the round hole out to the 4 x 3 m edge, along rays from the hole's centre
  const m = new MeshData(), T = [0, 0.04, 0.12, 0.26, 0.48, 0.74, 1], N = 48, ang = [];
  for (let i = 0; i < N; i++) ang.push(i / N * PI * 2);
  for (const [x, y] of [[AHALF, 0], [AHALF, H], [-AHALF, H], [-AHALF, 0]]) ang.push(Math.atan2(y - AC, x));
  ang.sort((a, b) => a - b);
  const pts = ang.map((a) => {
    const c = Math.cos(a), s = Math.sin(a), t = Math.min(Math.abs(c) > 1e-9 ? AHALF / Math.abs(c) : Infinity, s > 1e-9 ? (H - AC) / s : s < -1e-9 ? AC / -s : Infinity);
    return [[c * AR, AC + s * AR], [c * t, AC + s * t]];
  });
  pts.push(pts[0]);
  for (const [[ax, ay], [bx, by]] of pts) for (const t of T) m.v(ax + (bx - ax) * t, ay + (by - ay) * t, z, 0, 0, Math.sign(z), 0, 0);
  const n = T.length;
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j; m.quad(a, a + n, a + n + 1, a + 1); }
  return fixWinding(m.geometry());
}
const ringPath = (r, z, n = 48) => { const out = []; for (let i = 0; i <= n; i++) { const a = i / n * PI * 2, c = Math.cos(a), s = Math.sin(a); out.push({ p: v3(c * r, AC + s * r, z), x: v3(c, s, 0), y: v3(0, 0, 1) }); } return out; };
export function airlock(p, v) {
  const outer = v === 'outer';
  for (const z of [ASKIN, -ASKIN]) p.add('solid', roundFace(z), 'white');
  for (const s of [-1, 1]) p.slab('white', s > 0 ? AHALF - 0.02 : -AHALF, s > 0 ? AHALF : -AHALF + 0.02, 0, H, -ASKIN, ASKIN, { r: 0.004, cell: 0.6 });
  p.slab('white', -AHALF, AHALF, H - 0.02, H, -ASKIN, ASKIN, { r: 0.004, cell: 0.6 });
  // the lining through the hole, and on each face: a charcoal rim, a ring of yellow and black blocks, bolts, clamps
  p.sweep('black', rrect(0.12, 2 * ASKIN + 0.06, 0.016, 2, -0.06, 0), ringPath(AR, 0), { closed: true });
  for (const s of [1, -1]) {
    const q = new (p.constructor)(), z = ASKIN;
    q.sweep('black', rrect(0.16, 0.07, 0.016, 2, 0.08, 0.02), ringPath(AR + 0.0, z + 0.015), { closed: true });
    for (let k = 0; k < 24; k++) {
      const a0 = k / 24 * PI * 2 + 0.004, a1 = (k + 1) / 24 * PI * 2 - 0.004, r = AR + 0.26, path = [];
      for (let i = 0; i <= 4; i++) { const a = a0 + (a1 - a0) * i / 4, c = Math.cos(a), s = Math.sin(a); path.push({ p: v3(c * r, AC + s * r, z + 0.02), x: v3(c, s, 0), y: v3(0, 0, 1) }); }
      q.sweep(k % 2 ? 'black' : 'yellow', rrect(0.2, 0.03, 0.004, 1), path, { caps: true });
    }
    q.sweep('black', rrect(0.08, 0.06, 0.012, 2, 0.04, 0.02), ringPath(AR + 0.36, z + 0.01), { closed: true });
    for (let k = 0; k < 16; k++) { const a = (k + 0.5) / 16 * PI * 2; q.cyl('grey', 0.016, 0.014, [Math.cos(a) * (AR + 0.4), AC + Math.sin(a) * (AR + 0.4), z + 0.05], [PI / 2, 0, 0], 10); }
    q.slab('gun', -0.75, 0.75, 0, 0.235, z, z + 0.32, { r: 0.012 }); q.slab('yellow', -0.75, 0.75, 0.226, 0.236, z + 0.28, z + 0.32, { r: 0.004 });   // (the step up)
    // four docking clamps round the ring, each with an amber light
    for (const a of [PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4]) {
      const cx = Math.cos(a) * (AR + 0.6), cy = AC + Math.sin(a) * (AR + 0.6);
      if (cy < 0.2 || cy > H - 0.25) continue;
      q.box('dark', [0.34, 0.3, 0.05], [cx, cy, z + 0.025], [0, 0, a], { r: 0.012 });
      q.box('black', [0.26, 0.2, 0.14], [cx, cy, z + 0.09], [0, 0, a], { r: 0.024 });
      { const g = new THREE.BoxGeometry(0.06, 0.03, 0.01); put(g, [cx + Math.cos(a) * 0.06, cy + Math.sin(a) * 0.06, z + 0.165], [0, 0, a]); q.add('glow', g, 'amber'); }
    }
    // a status light over the door: green on the station's side of the inner door, red on a sealed port
    q.slab('black', -0.3, 0.3, 2.82, 2.9, z, z + 0.04, { r: 0.01 });
    q.glowSlab(outer || s < 0 ? 'red' : 'green', -0.26, 0.26, 2.835, 2.885, z + 0.04, z + 0.044);
    q.light([0, 2.86, z + 0.2], 0.4, outer || s < 0 ? [1, 0.2, 0.15] : [0.3, 1, 0.5], [0, 0, 1], 3);
    for (const part of q.parts) { if (s < 0) put(part.geo, [0, 0, 0], [0, PI, 0]); p.parts.push(part); }
    for (const L of q.lights) p.lights.push(s < 0 ? { ...L, at: [-L.at[0], L.at[1], -L.at[2]], dir: L.dir && [-L.dir[0], L.dir[1], -L.dir[2]] } : L);
  }
  p.slab('gun', -0.6, 0.6, AC - AR - 0.02, AC - AR + 0.012, -ASKIN - 0.03, ASKIN + 0.03, { r: 0.006 });
  const leafR = AR + 0.03;
  if (outer) {
    // a sealed round door with a porthole to space
    const pts = []; for (let i = 0; i < 48; i++) { const a = i / 48 * PI * 2; pts.push([Math.cos(a) * leafR, Math.sin(a) * leafR]); }
    const hole = []; for (let i = 47; i >= 0; i--) { const a = i / 48 * PI * 2; hole.push([Math.cos(a) * 0.3, Math.sin(a) * 0.3 + 0.25]); }
    p.extrude('white2', pts, 0.1, 0.014, { holes: [hole] }).translate(0, AC, -0.05);
    p.sweep('black', rrect(0.06, 0.13, 0.01, 2, -0.03, 0), ringPath(0.3, 0).map((f) => ({ ...f, p: f.p.clone().add(v3(0, 0.25, 0)) })), { closed: true });
    p.glass(0.6, 0.6, [0, AC + 0.25, -0.03]);
    for (const a of [0, PI / 2, PI, 3 * PI / 2]) p.box('black', [0.5, 0.1, 0.05], [Math.cos(a) * 0.65, AC + Math.sin(a) * 0.65 - (a === 3 * PI / 2 ? 0 : 0), 0.06], [0, 0, a], { r: 0.012 });
    p.slab('band', -0.7, 0.7, AC - 0.5, AC - 0.3, 0.05, 0.065, { r: 0.006 });
    return;
  }
  const leaf = (q) => {
    // half a round door (the left half: x from -r to 0) with half a round window cut into its straight edge, so the two
    // leaves shut make one window in the middle; a charcoal edge, a dark band low across it
    const WR = 0.17, WY = 0.3, pts = [];
    for (let i = 0; i <= 24; i++) { const a = -PI / 2 - PI * i / 24; pts.push([Math.cos(a) * leafR, Math.sin(a) * leafR]); }
    pts.push([0, WY + WR]); for (let i = 1; i < 12; i++) { const a = PI / 2 + PI * i / 12; pts.push([Math.cos(a) * WR, WY + Math.sin(a) * WR]); } pts.push([0, WY - WR]);
    q.extrude('white2', pts, 0.06, 0.012).translate(0, AC, -0.03);
    q.slab('black', -0.016, 0, AC - leafR, AC + WY - WR, -0.034, 0.034, { r: 0.004 }); q.slab('black', -0.016, 0, AC + WY + WR, AC + leafR, -0.034, 0.034, { r: 0.004 });
    q.slab('band', -leafR + 0.2, -0.06, AC - 0.62, AC - 0.46, -0.034, 0.034, { r: 0.006 });
    const half = []; for (let i = 0; i <= 12; i++) { const a = PI / 2 + PI * i / 12; half.push([Math.cos(a) * (WR + 0.01), WY + Math.sin(a) * (WR + 0.01)]); }
    for (const back of [false, true]) { const g = flat(half, 0.0005); g.translate(0, AC, 0); if (back) g.scale(1, 1, -1); q.add('glass', g); }   // (one facing each way)
  };
  p.leaf('airlock-leaf', leaf, { slide: [-(AR + 0.0), 0, 0], door: 0 });
  p.leaf('airlock-leaf', leaf, { rot: [0, PI, 0], slide: [AR + 0.0, 0, 0], door: 0 });
  p.door(0, [0, 1.2, 0], 2.8, 1.1);
}

// ── cargo ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function crateBox(p, w, h, d, at, look = 'white') {
  // a crate: a pale body, charcoal corner frames, an orange band, a stencilled label on two faces
  const [x, y, z] = at, e = 0.06;
  p.box(look, [w - 0.02, h - 0.02, d - 0.02], [x, y + h / 2, z], null, { r: 0.012, cell: 0.6 });
  const fo = { r: 0.01, cell: 9, loops: [] };   // (the frame bars: no extra rows of vertices, there are many crates)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box('black', [e, h, e], [x + sx * (w / 2 - e / 2 + 0.005), y + h / 2, z + sz * (d / 2 - e / 2 + 0.005)], null, fo);
  for (const sy of [0, 1]) { p.box('black', [w + 0.01, e, e], [x, y + (sy ? h - e / 2 : e / 2), z + d / 2 - e / 2 + 0.005], null, fo); p.box('black', [w + 0.01, e, e], [x, y + (sy ? h - e / 2 : e / 2), z - d / 2 + e / 2 - 0.005], null, fo); p.box('black', [e, e, d + 0.01], [x + w / 2 - e / 2 + 0.005, y + (sy ? h - e / 2 : e / 2), z], null, fo); p.box('black', [e, e, d + 0.01], [x - w / 2 + e / 2 - 0.005, y + (sy ? h - e / 2 : e / 2), z], null, fo); }
  p.box('orange', [w - 0.1, Math.min(0.14, h * 0.16), d + 0.004], [x, y + h * 0.7, z], null, { r: 0.006, cell: 0.8 });
  if (w > 0.5) p.decal('label:CARGO', Math.min(0.8, w * 0.6), Math.min(0.2, w * 0.15), [x, y + h * 0.4, z + d / 2 + 0.003], null, '#2a2c30');
  if (d > 0.5) p.decal('label:CARGO', Math.min(0.8, d * 0.6), Math.min(0.2, d * 0.15), [x + w / 2 + 0.003, y + h * 0.4, z], [0, PI / 2, 0], '#2a2c30');
}
export function crate(p, v) {
  if (v === 'cart') {
    // a red tool chest on castors: drawers with dark pulls, a charcoal top, a push handle
    p.slab('red', -0.42, 0.42, 0.14, 1.0, -0.26, 0.26, { r: 0.02 });
    p.slab('black', -0.44, 0.44, 1.0, 1.04, -0.28, 0.28, { r: 0.012 });
    for (let k = 0; k < 5; k++) { const y = 0.22 + k * 0.155; p.slab('red', -0.39, 0.39, y, y + 0.13, 0.26, 0.275, { r: 0.006 }); p.slab('black', -0.15, 0.15, y + 0.09, y + 0.11, 0.275, 0.29, { r: 0.006 }); }
    for (const sx of [-1, 1]) p.slab('rail', sx * 0.46 - 0.015, sx * 0.46 + 0.015, 0.8, 1.15, -0.02, 0.02, { r: 0.006 });
    p.cyl('rail', 0.018, 0.95, [0, 1.14, 0], [0, 0, PI / 2], 10);
    for (const [x, z] of [[-0.34, -0.18], [0.34, -0.18], [-0.34, 0.18], [0.34, 0.18]]) { p.cyl('rubber', 0.06, 0.04, [x, 0.06, z], [0, 0, PI / 2], 14); p.slab('black', x - 0.03, x + 0.03, 0.06, 0.14, z - 0.03, z + 0.03, { r: 0.006 }); }
    return;
  }
  if (v === 'small') return crateBox(p, 0.6, 0.6, 0.6, [0, 0, 0]);
  if (v === 'large') return crateBox(p, 1.2, 1.1, 1.2, [0, 0, 0], 'white2');
  if (v === 'long') return crateBox(p, 2.0, 0.75, 0.8, [0, 0, 0], 'grey2');
  // a pallet: dark skids, two big crates and a small one on top
  for (const z of [-0.55, 0, 0.55]) p.slab('dark', -0.75, 0.75, 0, 0.12, z - 0.07, z + 0.07, { r: 0.01, cell: 0.8 });
  p.slab('gun', -0.78, 0.78, 0.12, 0.16, -0.65, 0.65, { r: 0.008, cell: 0.8 });
  crateBox(p, 0.72, 0.8, 1.2, [-0.37, 0.16, 0], 'white2'); crateBox(p, 0.72, 0.62, 1.1, [0.38, 0.16, -0.02]);
  crateBox(p, 0.6, 0.5, 0.6, [0.36, 0.78, 0.1]);
}

// ── the fuel line ─────────────────────────────────────────────────────────────────────────────────────────────────
const FR = 0.055, FY = 0.14;   // the fuel line: its radius and height off the floor
export function fuel(p, v) {
  if (v === 'pipe' || v === 'elbow') {
    // yellow line on low black saddles, a dark collar at each joint
    if (v === 'pipe') p.sweep('yellow', circle(FR, 14), line([-1, FY, 0], [1, FY, 0], [0, 1, 0], 0.5), { caps: true });
    else {
      const path = [...line([-1, FY, 0], [-0.4, FY, 0], [0, 1, 0], 0.3)];
      for (let i = 1; i <= 8; i++) { const a = PI / 2 * i / 8; path.push({ p: v3(-0.4 + Math.sin(a) * 0.4, FY, 0.4 - Math.cos(a) * 0.4), x: v3(0, 0, 1), y: v3(0, 1, 0) }); }
      path.push({ p: v3(0, FY, 1), x: v3(0, 0, 1), y: v3(0, 1, 0) });
      p.sweep('yellow', circle(FR, 14), fixFrames(path), { caps: true });
    }
    for (const x of v === 'pipe' ? [-0.5, 0.5] : [-0.7]) { p.slab('black', x - 0.05, x + 0.05, 0, FY - FR + 0.005, -0.09, 0.09, { r: 0.008 }); p.cyl('black', FR + 0.012, 0.06, [x, FY, 0], [0, 0, PI / 2], 14); }
    p.cyl('dark', FR + 0.018, 0.05, [-0.98, FY, 0], [0, 0, PI / 2], 14);
    return;
  }
  if (v === 'hose') {
    // a hose from (0, 0, 0) along +x across the floor, rising at the end to a ship's fuel port at 1.1 m
    const pts = [v3(0, 0.6, 0), v3(0.25, 0.25, 0.05), v3(0.6, 0.05, 0.1), v3(1.4, 0.04, 0.35), v3(2.4, 0.04, 0.2), v3(3.2, 0.06, -0.1), v3(3.7, 0.3, -0.1), v3(3.9, 0.85, -0.05), v3(3.95, 1.1, 0)];
    const path = new THREE.CatmullRomCurve3(pts).getPoints(40).map((q) => ({ p: q, x: v3(1, 0, 0), y: v3(0, 1, 0) }));
    p.sweep('rubber', circle(0.035, 10), fixFrames(path), { caps: true });
    for (const t of [0.3, 0.55, 0.8]) { const q = new THREE.CatmullRomCurve3(pts).getPoint(t); p.cyl('yellow', 0.045, 0.04, [q.x, q.y, q.z], [0, 0, PI / 2], 12); }
    p.cyl('black', 0.06, 0.16, [3.95, 1.12, 0], null, 14);
    return;
  }
  // the pump: a yellow cabinet with a charcoal face, a screen, a hose reel, a nozzle in its holster
  p.slab('black', -0.45, 0.45, 0, 0.1, -0.32, 0.32, { r: 0.012 });
  p.slab('yellow', -0.4, 0.4, 0.1, 1.45, -0.28, 0.28, { r: 0.03 });
  p.slab('black', -0.32, 0.32, 0.55, 1.36, 0.27, 0.3, { r: 0.012 });
  p.screen(SCREEN_RECT.fuel, 0.42, 0.24, [0, 1.12, 0.302], null, 1.1);
  p.slab('dark', -0.22, 0.22, 0.6, 0.82, 0.29, 0.31, { r: 0.008 });
  for (let k = 0; k < 3; k++) p.cyl(k === 0 ? 'orange' : 'grey', 0.022, 0.02, [-0.12 + k * 0.12, 0.7, 0.31], [PI / 2, 0, 0], 12);
  { const g = plane(0.6, 0.18, { uv: kitTextures().decal.rect.hazard, cell: 9 }); put(g, [0, 0.3, 0.282]); p.add('decal', g, '#2a2c30'); }
  p.cyl('black', 0.26, 0.16, [0.5, 0.95, 0], [0, 0, PI / 2], 24); p.cyl('rubber', 0.2, 0.17, [0.5, 0.95, 0], [0, 0, PI / 2], 24);
  p.cyl('grey', 0.05, 0.2, [0.5, 0.95, 0], [0, 0, PI / 2], 12);
  p.slab('black', -0.5, -0.4, 1.0, 1.2, -0.08, 0.08, { r: 0.01 }); p.box('black', [0.06, 0.24, 0.06], [-0.52, 1.0, 0], [0, 0, 0.3], { r: 0.012 });
  p.slab('black', 0.36, 0.42, 1.38, 1.44, 0.22, 0.28, { r: 0.004 }); p.glowSlab('green', 0.37, 0.41, 1.44, 1.446, 0.23, 0.27);
  p.light([0, 1.1, 0.6], 0.35, [0.35, 0.65, 1], [0, 0, 1], 2.5);
}

// ── the boarding stair ────────────────────────────────────────────────────────────────────────────────────────────
// seven steps up along -z from z = +1.7, to a platform at the door's sill from z = -0.3 to -1.4 (its open end, at
// z = -1.4, goes against a ship's door), 1.1 m wide, on a wheeled frame
export function gangway(p) {
  const n = 7, r = 0.18, g = 0.27, z0 = 1.7, hw = 0.55, top = DOOR_SILL, zp = z0 - n * g + g, o = { r: 0.012, cell: 0.8 };
  for (let k = 0; k < n - 1; k++) {
    const zf = z0 - k * g, y = (k + 1) * r;
    p.slab('gun', -hw + 0.03, hw - 0.03, y - 0.03, y, zf - g, zf, { r: 0.006, cell: 0.8 });
    p.slab('yellow', -hw + 0.03, hw - 0.03, y - 0.008, y + 0.002, zf - 0.04, zf, { r: 0.003 });
  }
  // the platform, at the sill's height
  p.slab('gun', -hw - 0.05, hw + 0.05, top - 0.06, top, -1.4, zp, { r: 0.008, cell: 0.8 });
  p.slab('black', -hw - 0.05, hw + 0.05, top - 0.24, top - 0.06, -1.4, zp, { r: 0.01, cell: 0.8 });
  { const gg = plane(1.2, 0.16, { uv: kitTextures().decal.rect.hazard, cell: 9 }); put(gg, [0, top - 0.15, -1.405], [0, PI, 0]); p.add('decal', gg, '#d9b23a'); }
  // the frame: two stringers, a base with four wheels, a post under the platform
  const len = Math.hypot((n - 1) * g, (n - 1) * r), ang = Math.atan2((n - 1) * r, (n - 1) * g);
  for (const s of [-1, 1]) {
    p.box('black', [0.06, 0.2, len + 0.15], [s * (hw + 0.03), (n - 1) * r / 2, z0 - (n - 1) * g / 2], [ang, 0, 0], o);
    p.slab('black', s * hw - 0.04, s * hw + 0.04, 0.12, top - 0.2, -1.32, -1.2, o); p.slab('black', s * hw - 0.04, s * hw + 0.04, 0.12, top - 0.2, zp - 0.12, zp, o);
    // rails: up the stair, round the platform's two sides
    for (let i = 0; i <= 3; i++) { const z = z0 - (n - 1) * g * i / 3, y = (n - 1) * r * i / 3; p.slab('black', s * (hw + 0.03) - 0.025, s * (hw + 0.03) + 0.025, y + 0.08, y + 1.0, z - 0.025, z + 0.025, o); }
    p.box('black', [0.05, 0.05, len + 0.1], [s * (hw + 0.03), (n - 1) * r / 2 + 1.0, z0 - (n - 1) * g / 2], [ang, 0, 0], { r: 0.02, cell: 0.8 });
    // (the platform's rails stop short of its end: a ship's hull bulges out over the last half metre)
    p.slab('black', s * (hw + 0.03) - 0.025, s * (hw + 0.03) + 0.025, top, top + 1.0, -0.95, -0.9, o);
    p.slab('black', s * (hw + 0.03) - 0.025, s * (hw + 0.03) + 0.025, top + 0.97, top + 1.02, -0.95, zp, { r: 0.02, cell: 0.8 });
    p.slab('rail', s * (hw + 0.03) - 0.015, s * (hw + 0.03) + 0.015, top + 0.5, top + 0.53, -0.95, zp, o);
  }
  p.slab('black', -hw - 0.08, hw + 0.08, 0.1, 0.2, -1.4, z0 + 0.1, { r: 0.02, cell: 0.8 });
  for (const [x, z] of [[-hw, -1.2], [hw, -1.2], [-hw, z0 - 0.1], [hw, z0 - 0.1]]) { p.cyl('rubber', 0.09, 0.07, [x, 0.09, z], [0, 0, PI / 2], 16); p.cyl('grey', 0.04, 0.08, [x, 0.09, z], [0, 0, PI / 2], 10); }
  p.slab('black', -0.12, 0.12, 0.2, top - 0.24, -1.0, -0.7, o);
  p.glowSlab('amber', -0.04, 0.04, top - 0.2, top - 0.19, -1.41, -1.405);
}
