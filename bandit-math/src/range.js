// THE TARGET RANGE: a little shooting range at the east edge of town, across the creek from the general store, on the
// road out to the pasture (src/missions/shooting.js runs the job there). Everything is made in code in the farm's style
// (boxes and cylinders coloured by vertex on the farm's plank picture, merged into one shape: one draw):
//   a lane fenced with split rails on both sides, open at the road end; a plank laid on the ground for the firing line,
//   a barrel by it with a box of cartridges on top and a crate of spare bottles; downrange a shelf of two planks on
//   three posts, where the bottles and tin cans stand; behind it a wall of hay bales to stop the shots; a painted sign
//   facing the road. The ground of the range is mown like the town's yards.
// The range faces south, away from the road (the sun is behind the shooter), and keeps clear of the road, the wagons'
// parking spots, the doors, the cabin's yard and the store counter's view.
//
// Bottles and cans (the targets): R.setCard(list) stands them on the shelf, R.hit(i) breaks one (a bottle shatters into
// glass that rains down; a can spins off the plank and tumbles to the ground in a puff of dust), R.ping(i) is a shot that
// glances off one (a spark, the target rocks on the plank), R.miss(point) is a shot into the hay or the dirt (dust).
//
//   const R = makeRange({ W, scene })
//   R.layout       { x, z, rot, at(lx, lz), local(x, z), stand: { x, z, face }, marksman: { x, z, face }, eye, look }
//                  (the range's own frame: lz downrange from the firing line, lx across; stand: where the shooter
//                  stands; eye / look: the shooter's eye and the shelf's middle, Vector3s, for the view)
//   R.slots(n)     where n targets stand: [{ x, y, z }] (world; their feet), left to right as seen from the line
//   R.setCard(list)   list: [{ kind: 'can' | 'bottle' }] in slot order: the old targets are cleared and these pop up
//   R.targets      [{ kind, mesh, alive, mid (world centre, Vector3), top (just over it), h (height), r (radius) }]
//   R.hit(i), R.ping(i), R.miss(point)   as above; R.clear() takes the targets left standing away
//   R.rayHit(ray)  where a ray from the shooter meets the hay, the shelf or the ground (a Vector3), for a miss
//   R.blocked(x, z)   true where the range itself stops a walker (also in W.blocked)
//   R.update(dt)   each frame while riding;  R.dispose()
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const RANGE = {
  x: 60, z: -193, rot: 0,       // the firing line's middle (the range's frame starts here), and the way it faces (as
                                // three's rotation.y: 0 is +z, south, away from the road; measured with
                                // ~/pw/bandit-math/rigs/shooting/map.cjs: east of the creek, 8 m off the road's middle)
  shelf: 8.5,                   // m downrange to the shelf
  planks: [0.82, 1.42],         // m: the tops of the two planks
  plankW: 3.8, plankD: 0.3,     // the shelf's planks
  posts: [-1.8, 0, 1.8],        // across: the shelf's posts
  hay: 11,                      // m downrange to the hay bales' face
  fence: { at: 4.3, from: -1.2, to: 12.6, gap: 2.35, h: 1.15 },
  mow: { x: 6.5, z0: -4, z1: 14, fade: 4 },
  stand: { x: 0, z: -0.45 },    // where the shooter stands
  marksman: { x: 2.4, z: -0.9 },   // where the range's keeper stands (on the shooter's left)
  eye: 1.62,                    // m: the shooter's eye over the ground
  sign: { x: -3.2, z: -2.6 },   // the painted sign, facing the road
  can: { r: 0.062, h: 0.17 },
  bottle: { r: 0.048, h: 0.3 },
  pop: 0.28,                    // s a target takes to pop up onto the shelf (one after another)
  gravity: 9.8,
};

const COL = { wood: '#7a5a3c', woodDark: '#5b4129', plank: '#9a7650', post: '#6e5136', barrel: '#7c5534', hoop: '#3c3934',
  hay: ['#e2c26a', '#d6b45c', '#ecd07a', '#d9b862'], twine: '#6a5230', crate: '#a07a4c', red: '#9c3a2a', paper: '#e9dfc4', dirt: '#8a6a48' };
const CAN_LABELS = ['#a8382c', '#2f5d8a', '#3f7a42', '#c4932c'];
const GLASS = [{ color: 0x2f7a3e, shard: '#4f9a5c' }, { color: 0x7a4a18, shard: '#a4682c' }, { color: 0x6fa8b8, shard: '#a8d4de' }];

// ── SHAPES (as the farm's: coloured by vertex, the plank picture laid on by the way each face points) ──────────────
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

function plankTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#d8d8d8'; c.fillRect(0, 0, 256, 256);
  for (let b = 0; b < 4; b++) {
    const x = b * 64, tone = 205 + ((b * 37) % 5) * 9;
    c.fillStyle = `rgb(${tone},${tone},${tone})`; c.fillRect(x + 3, 0, 58, 256);
    c.strokeStyle = 'rgba(90, 90, 90, 0.25)'; c.lineWidth = 1;
    for (let g = 0; g < 7; g++) { const gx = x + 8 + g * 7 + ((b + g) % 3); c.beginPath(); c.moveTo(gx, 0); c.bezierCurveTo(gx + 3, 80, gx - 3, 170, gx + 1, 256); c.stroke(); }
    c.fillStyle = '#555'; c.fillRect(x, 0, 3, 256);
    c.fillStyle = 'rgba(60,60,60,0.5)'; c.fillRect(x + 20 + b * 6, 40 + b * 50, 3, 3); c.fillRect(x + 22 + b * 6, 200 - b * 20, 3, 3);
  }
  c.fillStyle = '#dcdcdc'; c.fillRect(100, 100, 56, 56);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// a barrel: staves (a cylinder bulging at the middle) and three dark hoops
function barrel(at, h = 0.9, r = 0.3) {
  const pts = []; for (let k = 0; k <= 6; k++) { const f = k / 6; pts.push(new THREE.Vector2(r * (0.86 + 0.14 * Math.sin(f * Math.PI)), f * h)); }
  const out = [piece(new THREE.LatheGeometry(pts, 12), COL.barrel, { at })];
  out.push(piece(new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.02, 12), COL.woodDark, { at: [at[0], at[1] + h - 0.01, at[2]], plain: true }));
  for (const f of [0.12, 0.5, 0.88]) { const rr = r * (0.87 + 0.14 * Math.sin(f * Math.PI)) + 0.006; out.push(piece(new THREE.CylinderGeometry(rr, rr, 0.035, 12, 1, true), COL.hoop, { at: [at[0], at[1] + f * h, at[2]], plain: true })); }
  return out;
}

// the range's fixed parts, in its own frame; ground(lx, lz) -> the ground's height there
function staticPieces(ground) {
  const R = RANGE, out = [];
  const gS = ground(0, R.shelf);
  // the shelf: three posts and two planks, standing level on the ground at its middle (the posts reach down into it)
  for (const x of R.posts) {
    const g = ground(x, R.shelf), top = gS + R.planks[1] + 0.22, foot = g - 0.3;   // (sunk a little into the ground)
    out.push(piece(box(0.12, top - foot, 0.12), COL.post, { at: [x, (top + foot) / 2, R.shelf + 0.16] }));
  }
  for (const y of R.planks) out.push(piece(box(R.plankW, 0.05, R.plankD), COL.plank, { at: [0, gS + y - 0.025, R.shelf], shade: 0.15 }));
  // the firing line: a plank laid on the ground
  out.push(piece(box(4.2, 0.07, 0.22), COL.wood, { at: [0, ground(0, 0) + 0.02, 0], shade: 0.2 }));
  // a barrel by the line, a box of cartridges on it; a crate of spare bottles; two more barrels downrange
  const bx = -2.1, bz = 0.2, bg = ground(bx, bz);
  out.push(...barrel([bx, bg - 0.04, bz]));
  out.push(piece(box(0.24, 0.1, 0.16), COL.red, { at: [bx + 0.02, bg + 0.86 + 0.05, bz], rot: [0, 0.4, 0], plain: true }));
  out.push(piece(box(0.25, 0.012, 0.165), COL.paper, { at: [bx + 0.02, bg + 0.86 + 0.106, bz], rot: [0, 0.4, 0], plain: true }));
  const cx = 3.1, cz = 0.7, cg = ground(cx, cz);
  out.push(piece(box(0.62, 0.36, 0.42), COL.crate, { at: [cx, cg + 0.16, cz], rot: [0, -0.3, 0], shade: 0.2 }));
  for (let k = 0; k < 6; k++) { const ox = ((k % 3) - 1) * 0.16, oz = (Math.floor(k / 3) - 0.5) * 0.15, c = Math.cos(-0.3), s = Math.sin(-0.3);
    out.push(piece(new THREE.CylinderGeometry(0.014, 0.02, 0.14, 6), ['#3f6e46', '#7a4a1c', '#6a8c96'][k % 3], { at: [cx + c * ox + s * oz, cg + 0.39, cz - s * ox + c * oz], plain: true })); }
  out.push(...barrel([2.75, ground(2.75, R.shelf - 0.5) - 0.04, R.shelf - 0.5], 0.85, 0.28));
  out.push(...barrel([-2.9, ground(-2.9, R.shelf + 0.9) - 0.04, R.shelf + 0.9], 0.85, 0.28));
  // the fences: split rails along both sides of the lane (open at the road end and behind the hay)
  const F = R.fence;
  for (const side of [-1, 1]) {
    const n = Math.max(1, Math.round((F.to - F.from) / F.gap)), x = side * F.at;
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const z = F.from + (F.to - F.from) * k / n, g = ground(x, z);
      out.push(piece(box(0.13, F.h + 0.16, 0.13), COL.post, { at: [x, g + (F.h + 0.16) / 2 - 0.12, z], rot: [0, k * 1.3, 0] }));
      if (prev) for (const f of [0.45, 0.85]) {
        const y0 = prev.g + F.h * f, y1 = g + F.h * f, len = Math.hypot(z - prev.z, y1 - y0);
        out.push(piece(box(0.07, 0.09, len + 0.1), COL.wood, { at: [x, (y0 + y1) / 2, (prev.z + z) / 2], rot: [-Math.atan2(y1 - y0, z - prev.z), 0, 0], shade: 0.2 }));   // (tilted with the ground)
      }
      prev = { z, g };
    }
  }
  // the sign's post (its board is a shape of its own, with the painted words)
  const sg = ground(R.sign.x, R.sign.z);
  out.push(piece(box(0.12, 2.2, 0.12), COL.post, { at: [R.sign.x - 0.7, sg + 0.95, R.sign.z] }));
  out.push(piece(box(0.12, 2.2, 0.12), COL.post, { at: [R.sign.x + 0.7, sg + 0.95, R.sign.z] }));
  return out;
}

// the hay: four rows of bales, staggered, each with two bands of twine (a shape of its own, on the straw picture)
function hayPieces(ground) {
  const R = RANGE, out = [], rows = [7, 6, 6, 5], bw = 1.08, bh = 0.44, bd = 0.56;
  rows.forEach((n, row) => {
    for (let k = 0; k < n; k++) {
      const x = (k - (n - 1) / 2) * (bw + 0.02), z = R.hay + bd / 2 + (row % 2) * 0.04, g = ground(x, R.hay + 0.3), y = g - 0.06 + row * bh + bh / 2;
      out.push(piece(box(bw, bh, bd), COL.hay[(k * 3 + row) % 4], { at: [x, y, z], rot: [0, ((k * 7 + row) % 5 - 2) * 0.012, 0] }));
      for (const f of [-0.28, 0.28]) out.push(piece(box(0.025, bh + 0.01, bd + 0.01), COL.twine, { at: [x + f, y, z], plain: true }));
    }
  });
  return out;
}
// short straws every which way, pale (the bales' own colour is laid over it); the middle is left plain for the twine
function strawTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#d0d0d0'; c.fillRect(0, 0, 256, 256);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 1400; k++) {
    const x = rnd() * 256, y = rnd() * 256, a = (rnd() - 0.5) * 1.2 + (rnd() < 0.5 ? 0 : Math.PI / 2) * 0.15, l = 6 + rnd() * 16, tone = 95 + rnd() * 160;
    c.strokeStyle = `rgba(${tone},${tone},${tone},0.8)`; c.lineWidth = 1 + rnd() * 1.2;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
  }
  c.fillStyle = '#d6d6d6'; c.fillRect(110, 110, 36, 36);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.repeat.set(1.6, 1.6);
  return t;
}

// the painted sign: "TARGET RANGE", and under it "Bottles & cans only"
function signTexture() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 224;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const paint = () => {
    const c = cv.getContext('2d');
    c.fillStyle = '#7d5a39'; c.fillRect(0, 0, 512, 224);
    for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#86613e' : '#76542f'; c.fillRect(0, k * 56, 512, 54); c.fillStyle = '#4a3420'; c.fillRect(0, k * 56 + 54, 512, 2); }
    c.strokeStyle = 'rgba(40,25,12,0.25)'; for (let k = 0; k < 30; k++) { const y = (k * 37) % 224; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(170, y + 4, 340, y - 4, 512, y + 2); c.stroke(); }
    c.fillStyle = '#efe2c2'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const fit = (text, font, size, y, most) => { let k = size; do { c.font = font.replace('#', k); k -= 2; } while (c.measureText(text).width > most && k > 12); c.fillText(text, 256, y); };
    fit('TARGET RANGE', '#px Rye, Georgia, serif', 72, 86, 470);
    fit('Bottles & cans only', 'italic 600 #px Bitter, Georgia, serif', 36, 166, 440);
    t.needsUpdate = true;
  };
  paint();
  // (painted again once the page's western font has loaded, if it hadn't yet)
  try { if (document.fonts) Promise.all([document.fonts.load('72px Rye'), document.fonts.load('italic 600 36px Bitter')]).then(paint).catch(() => {}); } catch (e) { /* the plain font stays */ }
  return t;
}

// a soft round puff picture (dust, sparks)
function puffPicture(inner, mid) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(0.5, mid); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ── THE TARGETS' SHAPES ──────────────────────────────────────────────────────────────────────────────────────────
// a tin can (its feet at y 0): a paper label round the middle, bare tin at the rims and the lid
function canGeometry(label) {
  const { r, h } = RANGE.can;
  const parts = [
    piece(new THREE.CylinderGeometry(r, r, h * 0.7, 14, 1, true), label, { at: [0, h / 2, 0], plain: true }),
    piece(new THREE.CylinderGeometry(r * 1.02, r * 1.02, h * 0.15, 14, 1, true), '#b9bcbd', { at: [0, h * 0.925, 0], plain: true }),
    piece(new THREE.CylinderGeometry(r * 1.02, r * 1.02, h * 0.15, 14, 1, true), '#b9bcbd', { at: [0, h * 0.075, 0], plain: true }),
    piece(new THREE.CircleGeometry(r, 14).rotateX(-Math.PI / 2), '#a7aaab', { at: [0, h, 0], plain: true }),
    piece(new THREE.CircleGeometry(r, 14).rotateX(Math.PI / 2), '#8c8f90', { at: [0, 0, 0], plain: true }),
    piece(new THREE.CylinderGeometry(r * 1.005, r * 1.005, h * 0.08, 14, 1, true), '#efe6cf', { at: [0, h * 0.5, 0], plain: true }),   // (a pale band on the label)
  ];
  return mergeGeometries(parts);
}
// a bottle: a lathe from the foot up to the lip
function bottleGeometry() {
  const { r, h } = RANGE.bottle;
  const prof = [[0, 0], [r * 0.92, 0], [r, 0.02], [r, h * 0.56], [r * 0.9, h * 0.64], [r * 0.45, h * 0.74], [r * 0.32, h * 0.8], [r * 0.32, h * 0.95], [r * 0.4, h * 0.96], [r * 0.4, h], [0, h]];
  const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 12);
  g.computeVertexNormals();
  return g;
}

export function makeRange({ W, scene = W.scene }) {
  const R0 = RANGE, rot = R0.rot, c = Math.cos(rot), s = Math.sin(rot);
  const at = (lx, lz) => ({ x: R0.x + c * lx + s * lz, z: R0.z - s * lx + c * lz });
  const local = (x, z) => { const dx = x - R0.x, dz = z - R0.z; return { x: c * dx - s * dz, z: s * dx + c * dz }; };
  const ground = (lx, lz) => { const p = at(lx, lz); return W.heightAt(p.x, p.z); };
  const shadows = !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  const root = new THREE.Group(); root.name = 'range';
  root.position.set(R0.x, 0, R0.z); root.rotation.y = rot;
  scene.add(root);
  // the town's own land shading (the hill's shade and the street lamps), borrowed from the town's fences, as the farm does
  const fm = W.V && W.V.FENCE && W.V.FENCE.mat;
  const landShade = (m) => { if (fm && fm.onBeforeCompile) { m.onBeforeCompile = fm.onBeforeCompile; m.customProgramCacheKey = fm.customProgramCacheKey; } return m; };

  const tex = plankTexture();
  const mat = landShade(new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.88, metalness: 0 }));
  const mesh = new THREE.Mesh(mergeGeometries(staticPieces(ground)), mat); mesh.name = 'range-pieces';
  mesh.castShadow = mesh.receiveShadow = shadows;
  root.add(mesh);
  const strawTex = strawTexture();
  const hayMat = landShade(new THREE.MeshStandardMaterial({ vertexColors: true, map: strawTex, roughness: 0.95, metalness: 0 }));
  const hay = new THREE.Mesh(mergeGeometries(hayPieces(ground)), hayMat); hay.name = 'range-hay';
  hay.castShadow = hay.receiveShadow = shadows;
  root.add(hay);
  // the sign's painted board, facing the road (back up the range: -z in its frame)
  const signTex = signTexture();
  const sg = ground(R0.sign.x, R0.sign.z);
  const plainWood = new THREE.MeshStandardMaterial({ color: 0x6e4f31, roughness: 0.9 });
  // (a box's faces: +x, -x, +y, -y, +z, -z; the painted one is -z, the side toward the road)
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.74, 0.06), [plainWood, plainWood, plainWood, plainWood, plainWood, new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.85 })]);
  board.position.set(R0.sign.x, sg + 1.65, R0.sign.z - 0.08);
  board.castShadow = shadows; board.name = 'range-sign';
  root.add(board);

  // ── THE GROUND: mown like the town's yards (no meadow taller than a can growing up round the shelf) ─────────────
  const unmow = mow();
  function mow() {
    const V = W.V, T = V && V.TOWN;
    if (!T || !T.yard || !V.N || !V.TEX) return () => {};
    const N = V.N, TEX = V.TEX, SIZE = V.SIZE, M = R0.mow, old = new Map(), oldB = new Map();
    const mid = at(0, (M.z0 + M.z1) / 2), Rr = Math.hypot(2 * M.x, M.z1 - M.z0) / 2 + M.fade + TEX;
    for (let j = Math.max(0, Math.floor((mid.z - Rr + SIZE / 2) / TEX)); j <= Math.min(N - 1, Math.ceil((mid.z + Rr + SIZE / 2) / TEX)); j++)
      for (let i = Math.max(0, Math.floor((mid.x - Rr + SIZE / 2) / TEX)); i <= Math.min(N - 1, Math.ceil((mid.x + Rr + SIZE / 2) / TEX)); i++) {
        const p = local((i + 0.5) * TEX - SIZE / 2, (j + 0.5) * TEX - SIZE / 2);
        const out = Math.hypot(Math.max(0, -M.x - p.x, p.x - M.x), Math.max(0, M.z0 - p.z, p.z - M.z1)), f = Math.min(1, out / M.fade), y = 1 - f * f * (3 - 2 * f);
        const k = j * N + i; if (y > T.yard[k]) { old.set(k, T.yard[k]); T.yard[k] = y; }
        if (T.block && Math.abs(p.x) < RANGE.fence.at + 0.5 && p.z > -1.5 && p.z < RANGE.hay + 1 && T.block[k] < 1) { oldB.set(k, T.block[k]); T.block[k] = 1; }
      }
    const forget = () => { const cc = V.COVER && V.COVER.cache; if (cc && cc.tiles) cc.tiles.clear(); };
    forget();
    const bare = V.LAWN_SKIP ? (x, z) => { const p = local(x, z); return Math.abs(p.x) < RANGE.fence.at + 0.6 && p.z > -1.5 && p.z < RANGE.hay + 1; } : null;
    if (bare) { V.LAWN_SKIP.push(bare); if (V.placeLawn) V.placeLawn(); }
    return () => { for (const [k, v] of old) T.yard[k] = v; for (const [k, v] of oldB) T.block[k] = v; if (bare) { const i = V.LAWN_SKIP.indexOf(bare); if (i >= 0) V.LAWN_SKIP.splice(i, 1); if (V.placeLawn) V.placeLawn(); } forget(); };
  }

  // ── WHAT BLOCKS (in the range's frame) ─────────────────────────────────────────────────────────────────────────
  const boxes = [
    [-R0.plankW / 2 - 0.1, R0.shelf - 0.3, R0.plankW / 2 + 0.1, R0.shelf + 0.3],     // the shelf
    [-4, R0.hay - 0.1, 4, R0.hay + 0.75],                                              // the hay
    [-2.5, -0.15, -1.7, 0.6], [2.7, 0.35, 3.5, 1.05],                                  // the barrel and the crate by the line
    [2.35, R0.shelf - 0.85, 3.15, R0.shelf - 0.15], [-3.3, R0.shelf + 0.5, -2.5, R0.shelf + 1.3],   // the barrels downrange
    [R0.sign.x - 0.85, R0.sign.z - 0.2, R0.sign.x + 0.85, R0.sign.z + 0.15],          // the sign
    [R0.marksman.x - 0.4, R0.marksman.z - 0.4, R0.marksman.x + 0.4, R0.marksman.z + 0.4],   // the range's keeper
  ];
  function blockedLocal(lx, lz) {
    for (const b of boxes) if (lx > b[0] && lx < b[2] && lz > b[1] && lz < b[3]) return true;
    if (Math.abs(Math.abs(lx) - R0.fence.at) < 0.3 && lz > R0.fence.from - 0.2 && lz < R0.fence.to + 0.2) return true;
    return false;
  }
  const blocked = (x, z) => { const p = local(x, z); return Math.abs(p.x) < 8 && p.z > -4 && p.z < 15 && blockedLocal(p.x, p.z); };
  const offBlock = W.addBlocker ? W.addBlocker(blocked) : () => {};

  // ── THE TARGETS ────────────────────────────────────────────────────────────────────────────────────────────────
  const canGeos = CAN_LABELS.map(canGeometry), bottleGeo = bottleGeometry();
  const canMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35, flatShading: false });
  const glassMats = GLASS.map((g) => new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.1, metalness: 0.15, transparent: true, opacity: 0.86 }));
  const pool = { can: [], bottle: [] };   // the meshes, made once and reused card to card
  const R = { targets: [], root };
  const shelfY = (y) => ground(0, R0.shelf) + y;

  // narrow: a phone held upright (a narrow screen): the targets bunched in the middle of the shelf, two or three a
  // plank, so the view can come in closer and they show bigger
  R.slots = (n, { narrow = false } = {}) => {
    // up to four along the top plank; five or six: three on top and the rest along the bottom one
    const top = narrow ? Math.min(3, Math.ceil(n / 2)) : n <= 4 ? n : Math.ceil(n / 2), bottom = n - top, out = [];
    const row = (k, y) => { const w = narrow ? (k <= 2 ? 0.75 : 1.4) : k <= 2 ? 1.3 : k === 3 ? 2.3 : 2.7; for (let i = 0; i < k; i++) { const lx = k === 1 ? 0 : w / 2 - (w * i) / (k - 1); out.push({ lx, ly: y, lz: R0.shelf }); } };
    row(top, R0.planks[1]); row(bottom, R0.planks[0]);
    // (left to right as seen from the line: the range faces +lz, so its +lx is on the shooter's left)
    return out.map((q) => { const p = at(q.lx, q.lz); return { x: p.x, y: shelfY(q.ly), z: p.z, lx: q.lx, ly: q.ly, lz: q.lz }; });
  };

  function takeMesh(kind, k) {
    const list = pool[kind];
    let m = list.find((q) => !q.used);
    if (!m) {
      const mesh = new THREE.Mesh(kind === 'can' ? canGeos[0] : bottleGeo, kind === 'can' ? canMat : glassMats[0]);
      mesh.castShadow = shadows; mesh.name = 'range-' + kind;
      root.add(mesh); m = { mesh, used: false }; list.push(m);
    }
    m.used = true;
    m.mesh.geometry = kind === 'can' ? canGeos[k % canGeos.length] : bottleGeo;
    m.mesh.material = kind === 'can' ? canMat : glassMats[k % glassMats.length];
    m.mesh.visible = true;
    return m;
  }

  R.setCard = (list, o = {}) => {
    clearNow();
    const slots = R.slots(list.length, o);
    R.targets = list.map((q, i) => {
      const kind = q.kind === 'can' ? 'can' : 'bottle', S = kind === 'can' ? R0.can : R0.bottle, sl = slots[i];
      const m = takeMesh(kind, Math.floor(Math.random() * 4));
      const T = { kind, m, mesh: m.mesh, alive: true, h: S.h, r: S.r, glass: kind === 'bottle' ? GLASS[Math.max(0, glassMats.indexOf(m.mesh.material))] : null,
        lx: sl.lx, ly: sl.ly, lz: sl.lz, state: 'pop', t: -i * 0.07, mid: new THREE.Vector3(), top: new THREE.Vector3(), vel: new THREE.Vector3(), spin: new THREE.Vector3(), bounces: 0, yaw: Math.random() * 6 };
      place(T, 0);
      return T;
    });
    return R.targets;
  };

  // the target's mesh where its state says (the range's frame: the group is turned already)
  function place(T, dt) {
    const mesh = T.mesh, base = shelfY(T.ly);
    if (T.state === 'pop' || T.state === 'sink') {
      T.t += dt;
      const f = Math.max(0, Math.min(1, T.t / R0.pop)), e = T.state === 'pop' ? 1 - Math.pow(1 - f, 3) : 1 - f * f;
      mesh.position.set(T.lx, base - T.h * (1 - e) - 0.02 * (1 - e), T.lz);
      mesh.scale.setScalar(Math.max(0.001, T.state === 'pop' ? 0.3 + 0.7 * e : e));
      mesh.rotation.set(0, T.yaw, 0);
      if (T.state === 'pop' && f >= 1) T.state = 'stand';
      if (T.state === 'sink' && f >= 1) { T.state = 'gone'; mesh.visible = false; T.m.used = false; }
    } else if (T.state === 'stand' || T.state === 'wobble') {
      if (T.state === 'wobble') { T.t += dt; if (T.t > 0.9) T.state = 'stand'; }
      const w = T.state === 'wobble' ? 0.2 * Math.exp(-5 * T.t) * Math.sin(T.t * 22) : 0;
      mesh.position.set(T.lx, base, T.lz); mesh.scale.setScalar(1);
      mesh.rotation.set(w, T.yaw, w * 0.4);
    } else if (T.state === 'fly') {
      // a can knocked off the plank: flies, spins, and tumbles to the ground behind the shelf, where it lies
      T.t += dt;
      T.vel.y -= R0.gravity * dt;
      mesh.position.addScaledVector(T.vel, dt);
      mesh.rotation.x += T.spin.x * dt; mesh.rotation.z += T.spin.z * dt; mesh.rotation.y += T.spin.y * dt;
      const g = ground(mesh.position.x, mesh.position.z) + T.r * 0.9;
      if (mesh.position.z > R0.hay - 0.2) { mesh.position.z = R0.hay - 0.2; T.vel.z *= -0.3; }
      if (mesh.position.y < g && T.vel.y < 0) {
        mesh.position.y = g;
        if (++T.bounces === 1) dust(at(mesh.position.x, mesh.position.z), g - T.r * 0.9, 0.7, COL.dirt);
        T.vel.y = -T.vel.y * 0.32; T.vel.x *= 0.55; T.vel.z *= 0.55; T.spin.multiplyScalar(0.5);
        if (Math.abs(T.vel.y) < 0.5 || T.bounces > 3) {
          T.state = 'down'; mesh.position.y = g;
          mesh.rotation.set(Math.PI / 2, mesh.rotation.y, 0);   // (lying on its side)
        }
      }
    }
    // where it is in the world (its middle, and a point just over its top) for the page's tags and the aim
    if (T.state !== 'gone') {
      const p = at(mesh.position.x, mesh.position.z), y = mesh.position.y;
      T.mid.set(p.x, y + T.h * 0.5 * mesh.scale.y, p.z); T.top.set(p.x, y + (T.h + 0.04) * mesh.scale.y, p.z);
    }
  }

  // ── THE EFFECTS: glass, dust, sparks ───────────────────────────────────────────────────────────────────────────
  const SHARDS = 90;
  const shardGeo = new THREE.TetrahedronGeometry(0.018).scale(1, 0.4, 1.6);
  const shardMat = new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.85 });
  const shards = new THREE.InstancedMesh(shardGeo, shardMat, SHARDS); shards.name = 'range-glass';
  shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage); shards.count = 0; shards.frustumCulled = false;
  root.add(shards);
  const shardList = [];   // { p, v, r, w, t, life, col }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();
  for (let i = 0; i < SHARDS; i++) shards.setColorAt(i, _c.set('#ffffff'));
  const dustMap = puffPicture('rgba(210,190,160,0.9)', 'rgba(180,160,130,0.45)');
  const sparkMap = puffPicture('rgba(255,255,230,1)', 'rgba(255,200,90,0.8)');
  const puffs = [];
  for (let i = 0; i < 12; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustMap, depthWrite: false, transparent: true, opacity: 0, color: 0xffffff }));
    sp.visible = false; scene.add(sp); puffs.push({ sp, t: 9, life: 1, size: 1, v: new THREE.Vector3() });
  }
  const sparks = [];
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkMap, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false }));
    sp.visible = false; scene.add(sp); sparks.push({ sp, t: 9 });
  }
  // a puff of dust at a world spot (x, z) and height y
  function dust(p, y, size = 1, color = COL.dirt) {
    const d = puffs.find((q) => q.t >= q.life) || puffs[0];
    d.sp.position.set(p.x, y + 0.08 * size, p.z); d.sp.material.color.set(color); d.size = size; d.t = 0; d.life = 0.9 + size * 0.3;
    d.v.set((Math.random() - 0.5) * 0.3, 0.35 + Math.random() * 0.2, (Math.random() - 0.5) * 0.3); d.sp.visible = true;
  }
  function spark(p) { const q = sparks.find((k) => k.t > 0.12) || sparks[0]; q.sp.position.copy(p); q.t = 0; q.sp.visible = true; q.sp.material.rotation = Math.random() * 6; }

  // a right shot: the bottle bursts, or the can is knocked off the plank. -> the point it was hit
  R.hit = (i) => {
    const T = R.targets[i]; if (!T || !T.alive) return null;
    T.alive = false;
    const hitAt = T.mid.clone();
    if (T.kind === 'bottle') {
      T.mesh.visible = false; T.state = 'gone'; T.m.used = false;
      const col = new THREE.Color(T.glass ? T.glass.shard : '#88b090');
      const base = shelfY(T.ly);
      for (let k = 0; k < 32; k++) {
        if (shardList.length >= SHARDS) shardList.shift();
        const a = Math.random() * Math.PI * 2, up = Math.random();
        shardList.push({ p: new THREE.Vector3(T.lx + Math.cos(a) * T.r * 0.6, base + up * T.h, T.lz + Math.sin(a) * T.r * 0.6),
          v: new THREE.Vector3(Math.cos(a) * (0.6 + Math.random() * 1.6), 0.8 + Math.random() * 2.2, Math.sin(a) * (0.6 + Math.random() * 1.2) + 1.2 + Math.random() * 1.4),
          r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w: new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0),
          t: 0, life: 1.6 + Math.random() * 0.8, col: col.clone().multiplyScalar(0.85 + Math.random() * 0.4), s: 0.9 + Math.random() * 1.1, rest: false });
      }
      spark(hitAt);
    } else {
      T.state = 'fly'; T.t = 0; T.bounces = 0;
      T.vel.set((Math.random() - 0.5) * 1.2, 2.4 + Math.random() * 1.0, 1.8 + Math.random() * 1.0);
      T.spin.set(8 + Math.random() * 10, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 12);
      dust(at(T.lx, T.lz), shelfY(T.ly), 0.35, '#c9b48e');
      spark(hitAt);
    }
    return hitAt;
  };
  // a shot that glances off a target: a spark, and it rocks on the plank
  R.ping = (i) => {
    const T = R.targets[i]; if (!T || !T.alive) return null;
    T.state = 'wobble'; T.t = 0;
    const p = T.mid.clone(); p.y += (Math.random() - 0.5) * T.h * 0.4;
    spark(p);
    dust(at(T.lx + (Math.random() - 0.5) * 0.2, T.lz + 0.1), shelfY(T.ly), 0.25, '#b89d74');
    return p;
  };
  // a shot into the hay or the dirt
  R.miss = (p) => { if (!p) return; const l = local(p.x, p.z); dust(p, p.y - 0.08, 0.55, l.z > R0.hay - 0.3 ? '#e2cc8a' : COL.dirt); };
  // where a ray from the shooter lands: the hay's face, else the ground (stepped along it)
  const _p = new THREE.Vector3();
  R.rayHit = (ray) => {
    for (let d = 1; d < 40; d += 0.1) {
      ray.at(d, _p);
      const l = local(_p.x, _p.z), g = W.heightAt(_p.x, _p.z);
      if (_p.y <= g) return _p.clone().setY(g + 0.02);
      if (l.z >= R0.hay && Math.abs(l.x) < 3.9 && _p.y < g + 1.85) return _p.clone();
      if (Math.abs(l.z - R0.shelf) < 0.16 && Math.abs(l.x) < R0.plankW / 2 && R0.planks.some((y) => Math.abs(_p.y - shelfY(y) + 0.025) < 0.04)) return _p.clone();
    }
    return null;
  };

  // the targets left standing are taken away (they drop back behind the plank)
  // (a can knocked down stays lying behind the shelf until its mesh is wanted again for a new target)
  function clearNow() {
    for (const T of R.targets) { T.m.used = false; if (T.state !== 'down') T.mesh.visible = false; T.state = 'gone'; }
    R.targets = [];
  }
  R.clear = () => { for (const T of R.targets) if (T.alive && T.state !== 'gone') { T.state = 'sink'; T.t = 0; T.alive = false; } };

  // ── EACH FRAME ─────────────────────────────────────────────────────────────────────────────────────────────────
  R.update = (dt) => {
    for (const T of R.targets) if (T.state !== 'gone' && T.state !== 'down') place(T, dt);
    // the glass: flying, tumbling, then lying a moment and fading out
    let n = 0;
    for (let k = shardList.length - 1; k >= 0; k--) {
      const q = shardList[k];
      q.t += dt;
      if (q.t > q.life) { shardList.splice(k, 1); continue; }
      if (!q.rest) {
        q.v.y -= R0.gravity * dt; q.p.addScaledVector(q.v, dt); q.r.x += q.w.x * dt; q.r.y += q.w.y * dt;
        const g = ground(q.p.x, q.p.z) + 0.006;
        if (q.p.y < g) { q.p.y = g; q.rest = true; q.r.x = Math.PI / 2; }
      }
    }
    for (const q of shardList) {
      const fade = Math.min(1, (q.life - q.t) / 0.4);
      _s.set(q.s * fade, q.s * fade, q.s * fade);
      shards.setMatrixAt(n, _m.compose(q.p, _q.setFromEuler(q.r), _s));
      shards.setColorAt(n, q.col); n++;
    }
    shards.count = n; shards.instanceMatrix.needsUpdate = true; if (shards.instanceColor) shards.instanceColor.needsUpdate = true;
    for (const d of puffs) {
      if (d.t >= d.life) { d.sp.visible = false; continue; }
      d.t += dt; const f = d.t / d.life;
      d.sp.position.addScaledVector(d.v, dt); d.v.multiplyScalar(Math.exp(-dt * 2));
      d.sp.scale.setScalar(d.size * (0.25 + 0.75 * Math.sqrt(f)));
      d.sp.material.opacity = 0.7 * (1 - f) * Math.min(1, d.t * 10);
    }
    for (const q of sparks) { q.t += dt; q.sp.visible = q.t < 0.1; q.sp.scale.setScalar(0.22 * (1 - q.t / 0.1) + 0.05); }
  };

  // ── THE LAYOUT ─────────────────────────────────────────────────────────────────────────────────────────────────
  const st = at(R0.stand.x, R0.stand.z), mk = at(R0.marksman.x, R0.marksman.z);
  const eye = new THREE.Vector3(st.x, W.heightAt(st.x, st.z) + R0.eye, st.z);
  const mid = at(0, R0.shelf), look = new THREE.Vector3(mid.x, shelfY((R0.planks[0] + R0.planks[1]) / 2 + 0.12), mid.z);
  R.layout = { x: R0.x, z: R0.z, rot, at, local, eye, look,
    stand: { x: st.x, z: st.z, face: rot }, marksman: { x: mk.x, z: mk.z, face: rot + Math.PI - 0.9 } };
  R.blocked = blocked;
  R.state = () => ({ targets: R.targets.map((T) => ({ kind: T.kind, alive: T.alive, state: T.state, x: +T.mid.x.toFixed(2), y: +T.mid.y.toFixed(2), z: +T.mid.z.toFixed(2) })), shards: shardList.length });
  R.dispose = () => {
    offBlock(); unmow();
    root.removeFromParent();
    for (const d of [...puffs, ...sparks]) { d.sp.removeFromParent(); d.sp.material.dispose(); }
    root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    shards.dispose();   // (the glass's own instance buffers: its geometry and material go with the rest)
    for (const m of [mat, hayMat, canMat, shardMat, ...glassMats, plainWood, board.material[5]]) { if (m.map) m.map.dispose(); m.dispose(); }
    for (const g of canGeos) g.dispose(); bottleGeo.dispose();
    dustMap.dispose(); sparkMap.dispose(); tex.dispose();
  };
  return R;
}
