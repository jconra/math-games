// THE HOMESTEAD: the rider's own farm animals, in a little yard behind the player's cabin in town (W.places.cabin), on
// the open ground between the cabin's back wall and the creek, clear of the wagon road, the trail, the porch and the
// door. Each kind has a home made in code in the farm's style, which appears with the first animal of its kind:
//   the coop   a small plank hen house on legs with a ramp, in a run of chicken wire        (the hens)
//   the pen    a low plank pen with a mud wallow, a trough and a lean-to                     (the pigs)
//   the corral a little post-and-rail corral with a water trough and a bale of hay          (the sheep and the milk cow)
// The animals potter about inside their own home (a walk, a stand, the hens peck), feet on the ground (each clip at
// its own pace over its stride), and their names (typed at the store, as the dog's are) float over them when you walk
// near. Goods are laid up over play time (src/math/goods.js: eggs, wool, milk) and wait at the yard (a basket of eggs
// by the coop, a milk can and a bundle of wool by the corral); walking past picks them up into the saddlebags, with a
// small note ("+6 eggs"), no button. They are sold at the general store counter as word problems (missions/store.js
// asks H.saleOrder now and then).
//
// Bought at the general store (shop.js: the "Farm animals" rows come from H.shop): the store already has the
// counter where goods are sold and the dogs' buy-and-name row, so the animals sit beside them (simpler than a new
// farmer at the settlers' farm). Hens are for sale from the start; pigs, sheep and milk cows only once the rider has
// earned a young one of that kind (src/math/goods.js unlocked): a locked kind shows one line saying what earns it.
// Thank-yous: a whole flock healed, a whole batch of pigs penned or a whole wave roped at the round-up now and then gives
// a lamb, a piglet or a calf (H.jobDone), when there's room; the first of each kind comes for sure within a few jobs
// and unlocks that kind at the store (a toast and a line from Hob say so).
//
//   const H = makeHomestead({ W, animals, rider, hud, hob, refresh })
//     animals: the animal library (actors/animals.js; the pig, sheep and farm cow are loaded when first needed)
//   H.update(dt, at)        each frame of play (not while paused or inside the cabin): at = the player's position
//   H.changed()             the rider's animals changed (one bought, a thank-you): the homes and animals are made again
//   H.jobDone(event)        a whole job finished ('flockDone', 'pigsDone', 'waveDone'): maybe a thank-you lamb, piglet or calf
//   H.saleOrder({ step, who }) -> a sale order for the store counter, or null (not this time, or nothing to sell)
//   H.sold(order)           a sale's right coin: the goods come out of the saddlebags
//   H.goodsLine()           the saddlebags' goods for the HUD ('30 eggs · 6 qt milk to sell', or '')
//   H.shop                  the general store's rows: { store: { html(), click(what, id, body), input(e) } } (shop.js)
//   H.layout                the yard in the world: { at(lx, lz), local(x, z), homes: { coop, pen, corral } }
//   H.state(), H.dev: { give(kind, name, young), goods(n), lay(seconds), gift(event), unlock(kind) }, H.dispose()
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeAnimal } from './actors/animals.js';
import { preloadChickens, makeChicken, CHICKEN } from './townlife.js';
import { makeTag } from './dog.js';
import { saveRider, spend } from './save.js';
import {
  ANIMALS, KINDS, GOODS, GOODS_IDS, GROW, homestead, animalsOf, countOf, hasRoom, buyAnimal, thankYou, lay, waiting, collect,
  gotLine, goodsLine, makeSale, sold, SELL, cleanName, YOUNG, GIFT, unlocked, earnLine,
} from './math/goods.js';

export const YARD = {
  // the homes, in the cabin's own frame (metres): z out of the cabin's back wall (the back wall is about 4.8 m from the
  // cabin's middle), x across it (+x toward the picnic table, -x toward the wagon road). x0..x1 across, z0..z1 out
  coop: { x0: 3.2, x1: 9.6, z0: 7.6, z1: 12.4, house: { x: 7.4, z: 11.0, w: 1.7, d: 1.3 } },
  pen: { x0: -10.4, x1: -4.4, z0: 7.6, z1: 12.8 },
  corral: { x0: -7.5, x1: 7.5, z0: 15.6, z1: 24.6 },
  inset: { coop: 0.45, pen: 0.9, corral: 1.2 },   // how far inside its fence an animal keeps (its middle)
  collect: 4,          // metres from any home's fence where the goods waiting are picked up as you walk past
  tagNear: 7,          // the names show within this many metres (fading out to tagFar)
  tagFar: 10,
  tagsAtOnce: 3,       // only the nearest few show their names (six hens in a small run would pile their names up)
  awake: 140,          // metres from the player within which the animals move (beyond, they stand still)
  room: { hen: 0.55, pig: 1.6, sheep: 1.3, cow: 2.4 },   // how far apart animals of a home keep
  young: 0.6,          // a just-given lamb or piglet's size (it grows to 1 over GROW seconds of play)
  youngOf: { cow: 0.5 },   // (a calf starts smaller: a grown milk cow is far bigger than a sheep or a pig)
  saveEvery: 30,       // seconds between saves while goods are being laid up
  retry: 20,           // seconds before an animal whose model failed to load is tried again
  shadowNear: 25,      // metres from the camera's target within which an animal casts a shadow
  mowFade: 4,          // metres round the homes over which the mown ground gives way to the meadow
};
const HOME_OF = { hen: 'coop', pig: 'pen', sheep: 'corral', cow: 'corral' };
const MODEL_OF = { pig: 'pig', sheep: 'sheep', cow: 'farmCow' };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rnd = (a, b) => a + Math.random() * (b - a);

// ── THE LAYOUT (no three.js objects) ──────────────────────────────────────────────────────────────────────────────
export function yardLayout(cabin) {
  const C = cabin || { x: 0, z: 0, rot: 0 };
  const r = (C.rot || 0) + Math.PI, c = Math.cos(r), s = Math.sin(r);   // (the frame faces out of the cabin's back)
  const at = (lx, lz) => ({ x: C.x + c * lx + s * lz, z: C.z - s * lx + c * lz });
  const local = (x, z) => { const dx = x - C.x, dz = z - C.z; return { x: c * dx - s * dz, z: s * dx + c * dz }; };
  const homes = {};
  for (const k of ['coop', 'pen', 'corral']) {
    const R = YARD[k], m = at((R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2);
    homes[k] = { ...m, box: R, w: R.x1 - R.x0, d: R.z1 - R.z0, rot: r };
  }
  // inside a home, inset metres from its fence; how far a point is from its fence (0 inside)
  const inside = (k, x, z, inset = YARD.inset[k]) => { const R = YARD[k], p = local(x, z); return p.x > R.x0 + inset && p.x < R.x1 - inset && p.z > R.z0 + inset && p.z < R.z1 - inset; };
  const off = (k, x, z) => { const R = YARD[k], p = local(x, z); return Math.hypot(Math.max(0, R.x0 - p.x, p.x - R.x1), Math.max(0, R.z0 - p.z, p.z - R.z1)); };
  const random = (k, inset = YARD.inset[k], rand = Math.random) => { const R = YARD[k]; return at(R.x0 + inset + rand() * (R.x1 - R.x0 - 2 * inset), R.z0 + inset + rand() * (R.z1 - R.z0 - 2 * inset)); };
  return { x: C.x, z: C.z, rot: r, at, local, homes, inside, off, random };
}

// ── SHAPES (simple boxes coloured by vertex, merged into one; as the farm's barn) ──────────────────────────────────────
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
    if (plain) { u = 0.5; v = 0.5; } else if (ny > 0.85) { u = p.getX(i); v = p.getZ(i); } else if (nx > nz) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u; uv[i * 2 + 1] = v;
    const k = 1 + shade * (Math.sin(p.getX(i) * 3.1 + p.getZ(i) * 1.7) * 0.5);
    col[i * 3] = base.r * k; col[i * 3 + 1] = base.g * k; col[i * 3 + 2] = base.b * k;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// a box from point a to point b (a rail or a board), t thick and h high, its middle on the line
function beam(a, b, t, h, color, o = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
  const g = box(len, h, t);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(dx, dy, dz).normalize());
  g.applyQuaternion(q); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return piece(g, color, o);
}
// grey boards with dark seams (multiplied over the vertex colours), 1 m square, as the farm's
function plankTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#d8d8d8'; c.fillRect(0, 0, 128, 128);
  for (let b = 0; b < 4; b++) {
    const x = b * 32, tone = 200 + ((b * 37) % 5) * 10;
    c.fillStyle = `rgb(${tone},${tone},${tone})`; c.fillRect(x + 2, 0, 29, 128);
    c.strokeStyle = 'rgba(90, 90, 90, 0.25)'; c.lineWidth = 1;
    for (let g = 0; g < 4; g++) { const gx = x + 5 + g * 7; c.beginPath(); c.moveTo(gx, 0); c.bezierCurveTo(gx + 2, 40, gx - 2, 90, gx + 1, 128); c.stroke(); }
    c.fillStyle = '#555'; c.fillRect(x, 0, 2, 128);
  }
  c.fillStyle = '#dcdcdc'; c.fillRect(50, 50, 28, 28);   // (a smooth patch for the plain pieces: uv 0.5, 0.5)
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// chicken wire: thin twisted wire in hexagons on clear, for the run's panels (cut out: alphaTest)
const WIRE = 0.14;    // metres the picture repeats over (each hexagon about 7 cm across)
function wireTexture() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const c = cv.getContext('2d');
  c.strokeStyle = 'rgba(214, 218, 219, 1)'; c.lineWidth = 1.6;
  const hex = (cx, cy, r) => { c.beginPath(); for (let i = 0; i <= 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); };
  for (const [x, y] of [[16, 0], [48, 0], [0, 27.7], [32, 27.7], [64, 27.7], [16, 55.4], [48, 55.4], [16, 83], [48, 83]]) hex(x, y, 16.5);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const COL = {
  wood: '#7a5a3c', old: '#8a7560', dark: '#3a2d22', roof: '#5a4f45', coop: '#a0522d', trim: '#e7dcc7', mud: '#4a3626',
  water: '#5d8794', hay: '#e2c26a', twine: '#5b4a30', post: '#6e5238', egg: '#f2e8d2', basket: '#8b6a3e', can: '#a7adb0', wool: '#ece4d4',
};

// ── MAKING THE YARD ──────────────────────────────────────────────────────────────────────────────────────────────
export function makeHomestead({ W, animals, rider, hud, hob = null, refresh = () => {}, scene = W.scene }) {
  const L = yardLayout(W.places.cabin);
  homestead(rider);
  const shadows = W.tier !== 'potato';
  const fm = W.V && W.V.FENCE && W.V.FENCE.mat;
  // the town's own land shading (the hill's shade, the street lamps), borrowed from the town's fences
  const landShade = (m) => { if (fm && fm.onBeforeCompile) { m.onBeforeCompile = fm.onBeforeCompile; m.customProgramCacheKey = fm.customProgramCacheKey; } return m; };
  const tex = plankTexture(), wtex = wireTexture();
  const mat = landShade(new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.9, metalness: 0 }));
  const wmat = new THREE.MeshStandardMaterial({ map: wtex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.4, color: 0xb8bcbd });
  const root = new THREE.Group(); root.name = 'homestead'; scene.add(root);
  const ground = (lx, lz) => { const p = L.at(lx, lz); return W.heightAt(p.x, p.z); };
  // (pieces are laid in the yard's own frame; the group is turned into the world)
  root.position.set(L.x, 0, L.z); root.rotation.y = L.rot;

  let built = '', mesh = null, wire = null, offBlock = () => {}, unmow = () => {}, disposed = false;
  const marks = {};   // the goods waiting: { eggs, milk, wool } little shapes, shown while there is some to pick up
  const H = { layout: L };

  // which homes the rider's animals need
  const homesWanted = () => { const s = new Set(); for (const a of animalsOf(rider)) s.add(HOME_OF[a.kind]); return ['coop', 'pen', 'corral'].filter((k) => s.has(k)); };

  // a fence along a closed rectangle (posts every `gap` m, standing on the land): lines of [a, b] in the frame
  function fenceLines(R, inset = 0) {
    const x0 = R.x0 + inset, x1 = R.x1 - inset, z0 = R.z0 + inset, z1 = R.z1 - inset;
    return [[[x0, z0], [x1, z0]], [[x1, z0], [x1, z1]], [[x1, z1], [x0, z1]], [[x0, z1], [x0, z0]]];
  }
  function postsAlong([a, b], gap) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / gap)), out = [];
    for (let i = 0; i <= n; i++) { const lx = a[0] + (b[0] - a[0]) * i / n, lz = a[1] + (b[1] - a[1]) * i / n; out.push([lx, ground(lx, lz), lz]); }
    return out;
  }

  function coopPieces(out, wires, segs) {
    const R = YARD.coop, Hs = R.house;
    // the run: posts, a top rail and a bottom board, chicken wire between
    for (const line of fenceLines(R)) {
      const ps = postsAlong(line, 1.6);
      for (let i = 0; i < ps.length; i++) {
        const [x, y, z] = ps[i];
        out.push(piece(box(0.09, 1.05, 0.09), COL.post, { at: [x, y + 0.45, z], shade: 0.1 }));
        if (i) {
          const [px, py, pz] = ps[i - 1];
          out.push(beam([px, py + 0.95, pz], [x, y + 0.95, z], 0.05, 0.06, COL.wood));
          out.push(beam([px, py + 0.08, pz], [x, y + 0.08, z], 0.03, 0.16, COL.old, { shade: 0.1 }));
          // a wire panel between the two posts, ground to rail (the picture repeats every WIRE m: two cells across)
          const len = Math.hypot(x - px, z - pz), g = new THREE.PlaneGeometry(len, 0.82);
          const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * len / WIRE, uv.getY(k) * 0.82 / WIRE);
          g.rotateY(-Math.atan2(z - pz, x - px)); g.translate((x + px) / 2, (y + py) / 2 + 0.53, (z + pz) / 2);
          wires.push(g);
        }
      }
      segs.push([line[0][0], line[0][1], line[1][0], line[1][1]]);
    }
    // the hen house: a plank box on four legs, a sloping roof, a dark doorway with a ramp down to the run, a nest box
    const gy = Math.max(ground(Hs.x - Hs.w / 2, Hs.z - Hs.d / 2), ground(Hs.x + Hs.w / 2, Hs.z + Hs.d / 2), ground(Hs.x, Hs.z));
    const floor = gy + 0.45, wall = 0.95;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(piece(box(0.1, 0.62, 0.1), COL.dark, { at: [Hs.x + sx * (Hs.w / 2 - 0.08), floor - 0.25, Hs.z + sz * (Hs.d / 2 - 0.08)] }));
    out.push(piece(box(Hs.w, wall, Hs.d), COL.coop, { at: [Hs.x, floor + wall / 2, Hs.z], shade: 0.08 }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(piece(box(0.08, wall, 0.08), COL.trim, { at: [Hs.x + sx * (Hs.w / 2 - 0.02), floor + wall / 2, Hs.z + sz * (Hs.d / 2 - 0.02)], plain: true }));
    // (the roof slopes down toward the run, -z, overhanging all round)
    const rise = 0.35, run = Hs.d + 0.4, ang = Math.atan2(rise, run);
    out.push(piece(box(Hs.w + 0.4, 0.07, Math.hypot(run, rise)), COL.roof, { at: [Hs.x, floor + wall + rise / 2 + 0.03, Hs.z], rot: [-ang, 0, 0], shade: 0.08 }));
    // (the gable ends under the slope)
    for (const sx of [-1, 1]) {
      const sh = new THREE.Shape(); sh.moveTo(-Hs.d / 2, 0); sh.lineTo(Hs.d / 2, 0); sh.lineTo(Hs.d / 2, rise * Hs.d / run); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }).translate(0, 0, -0.02).rotateY(-Math.PI / 2);
      out.push(piece(g, COL.coop, { at: [Hs.x + sx * (Hs.w / 2 - 0.02), floor + wall, Hs.z], plain: true }));
    }
    const fz = Hs.z - Hs.d / 2 - 0.01;
    out.push(piece(box(0.36, 0.42, 0.04), COL.dark, { at: [Hs.x - 0.3, floor + 0.23, fz] }));               // the hens' doorway
    out.push(piece(box(0.5, 0.36, 0.04), COL.trim, { at: [Hs.x + 0.38, floor + 0.62, fz], plain: true })); // a little window frame
    out.push(piece(box(0.4, 0.28, 0.05), COL.dark, { at: [Hs.x + 0.38, floor + 0.62, fz - 0.01] }));
    const rz = fz - 0.75, ry = ground(Hs.x - 0.3, rz);
    out.push(beam([Hs.x - 0.3, ry + 0.02, rz], [Hs.x - 0.3, floor + 0.02, fz], 0.3, 0.04, COL.old, { shade: 0.1 }));       // the ramp
    for (let k = 1; k < 5; k++) { const f = k / 5; out.push(beam([Hs.x - 0.44, ry + (floor - ry) * f + 0.05, rz + (fz - rz) * f], [Hs.x - 0.16, ry + (floor - ry) * f + 0.05, rz + (fz - rz) * f], 0.03, 0.025, COL.dark)); }
    out.push(piece(box(0.42, 0.42, 0.9), COL.coop, { at: [Hs.x + Hs.w / 2 + 0.2, floor + 0.3, Hs.z], shade: 0.08 }));        // the nest box on its side
    out.push(piece(box(0.5, 0.05, 1.0), COL.roof, { at: [Hs.x + Hs.w / 2 + 0.22, floor + 0.55, Hs.z], rot: [0, 0, -0.35] }));
    boxes.push([Hs.x - Hs.w / 2 - 0.15, Hs.z - Hs.d / 2 - 0.85, Hs.x + Hs.w / 2 + 0.5, Hs.z + Hs.d / 2 + 0.15, 'coop']);
  }

  function penPieces(out, segs) {
    const R = YARD.pen;
    // board fence: posts every 1.75 m and three boards on the outside (narrow boards with a hand's gap between, so a
    // young piglet shows through them)
    for (const line of fenceLines(R)) {
      const ps = postsAlong(line, 1.75);
      for (let i = 0; i < ps.length; i++) {
        const [x, y, z] = ps[i];
        out.push(piece(box(0.13, 1.05, 0.13), COL.post, { at: [x, y + 0.42, z], shade: 0.1 }));
        if (i) for (const h of [0.16, 0.45, 0.74]) { const [px, py, pz] = ps[i - 1]; out.push(beam([px, py + h, pz], [x, y + h, z], 0.04, 0.15, h > 0.5 ? COL.old : COL.wood, { shade: 0.12 })); }
      }
      segs.push([line[0][0], line[0][1], line[1][0], line[1][1]]);
    }
    // the trough along the front, the lean-to at the back corner
    const tx = (R.x0 + R.x1) / 2 + 0.8, tz = R.z0 + 0.75, ty = ground(tx, tz);
    out.push(piece(box(1.8, 0.32, 0.5), COL.dark, { at: [tx, ty + 0.14, tz], shade: 0.1 }));
    out.push(piece(box(1.6, 0.04, 0.34), '#7a6a4a', { at: [tx, ty + 0.29, tz], plain: true }));
    const lx = R.x0 + 1.4, lz = R.z1 - 1.1, ly = ground(lx, lz);
    for (const [px, pz, h] of [[-1.1, -0.8, 1.15], [1.1, -0.8, 1.15], [-1.1, 0.8, 1.55], [1.1, 0.8, 1.55]]) out.push(piece(box(0.1, h, 0.1), COL.post, { at: [lx + px, ly + h / 2 - 0.05, lz + pz] }));
    out.push(piece(box(2.6, 0.06, 2.1), COL.roof, { at: [lx, ly + 1.38, lz], rot: [-0.245, 0, 0], shade: 0.1 }));
    boxes.push([tx - 0.95, tz - 0.3, tx + 0.95, tz + 0.3, 'pen']);
  }

  function corralPieces(out, segs) {
    const R = YARD.corral;
    // post and rail, as the town's corral: posts every 2.2 m, three rails; a two-rail gate (shut) toward the cabin
    let gate = null;    // (the near side's middle span: no rails there, the gate fills it)
    fenceLines(R).forEach((line, side) => {
      const ps = postsAlong(line, 2.2);
      for (let i = 0; i < ps.length; i++) {
        const [x, y, z] = ps[i];
        out.push(piece(box(0.15, 1.45, 0.15), COL.post, { at: [x, y + 0.6, z], shade: 0.1 }));
        if (!i) continue;
        const [px, py, pz] = ps[i - 1];
        if (side === 0 && !gate && Math.min(px, x) <= 0 && Math.max(px, x) >= 0) { gate = { a: Math.min(px, x), b: Math.max(px, x), z }; continue; }
        for (const h of [0.45, 0.85, 1.22]) out.push(beam([px, py + h, pz], [x, y + h, z], 0.07, 0.11, COL.wood, { shade: 0.1 }));
      }
      segs.push([line[0][0], line[0][1], line[1][0], line[1][1]]);   // (the gate is shut: the whole side still blocks)
    });
    // the gate: weathered boards between the two posts, a stile at each end, a cross brace, iron hinges on one post
    if (gate) {
      const ga = gate.a + 0.1, gb = gate.b - 0.1, gz = gate.z, gy = ground((ga + gb) / 2, gz);
      for (const gx of [ga + 0.05, gb - 0.05]) out.push(piece(box(0.1, 1.2, 0.07), COL.old, { at: [gx, gy + 0.72, gz], shade: 0.1 }));
      for (const h of [0.3, 0.72, 1.14]) out.push(beam([ga, gy + h, gz], [gb, gy + h, gz], 0.06, 0.14, COL.old, { shade: 0.12 }));
      out.push(beam([ga + 0.08, gy + 0.32, gz - 0.035], [gb - 0.08, gy + 1.12, gz - 0.035], 0.04, 0.11, COL.old, { shade: 0.12 }));
      for (const h of [0.3, 1.14]) out.push(piece(box(0.24, 0.05, 0.08), COL.dark, { at: [ga + 0.06, gy + h, gz], plain: true }));
      out.push(piece(box(0.09, 0.07, 0.1), COL.dark, { at: [gb - 0.02, gy + 0.9, gz], plain: true }));   // the latch
    }
    // a water trough and a bale of hay inside
    const wx = R.x1 - 2.2, wz = R.z1 - 1.2, wy = ground(wx, wz);
    // (hollow: a floor and four sides, the water a hand below the rim, so the two faces never share a plane)
    out.push(piece(box(2.2, 0.2, 0.7), COL.wood, { at: [wx, wy + 0.05, wz], shade: 0.1 }));
    for (const sz of [-1, 1]) out.push(piece(box(2.2, 0.4, 0.09), COL.wood, { at: [wx, wy + 0.35, wz + sz * 0.305], shade: 0.1 }));
    for (const sx of [-1, 1]) out.push(piece(box(0.1, 0.4, 0.52), COL.wood, { at: [wx + sx * 1.05, wy + 0.35, wz], shade: 0.1 }));
    out.push(piece(box(2.0, 0.02, 0.52), COL.water, { at: [wx, wy + 0.42, wz], plain: true }));
    const hx = R.x0 + 1.9, hz = R.z1 - 1.4, hy = ground(hx, hz) + 0.42;
    out.push(piece(box(1.3, 0.85, 0.9), COL.hay, { at: [hx, hy, hz], rot: [0, 0.25, 0], plain: true, shade: 0.2 }));
    for (const bx of [-0.33, 0.33]) out.push(piece(box(0.035, 0.9, 0.95).translate(bx, 0, 0), COL.twine, { at: [hx, hy, hz], rot: [0, 0.25, 0], plain: true }));
    boxes.push([wx - 1.2, wz - 0.45, wx + 1.2, wz + 0.45, 'corral'], [hx - 0.9, hz - 0.8, hx + 0.9, hz + 0.8, 'corral']);
  }

  // the little shapes for goods waiting at the yard: a basket of eggs by the coop, a milk can and a bundle of wool
  // by the corral's gate (outside the fences, where you walk past)
  function goodsMarks() {
    for (const k of Object.keys(marks)) { marks[k].removeFromParent(); marks[k].geometry.dispose(); delete marks[k]; }
    const add = (id, parts, lx, lz) => {
      const y = ground(lx, lz), g = mergeGeometries(parts.map((p) => p));
      const m = new THREE.Mesh(g, mat); m.position.set(lx, y, lz); m.castShadow = shadows; m.visible = false; m.name = 'homestead-' + id;
      root.add(m); marks[id] = m;
    };
    if (built.includes('coop')) {
      const parts = [piece(new THREE.CylinderGeometry(0.2, 0.15, 0.16, 10), COL.basket, { at: [0, 0.08, 0], plain: true, shade: 0.2 }),
        piece(new THREE.TorusGeometry(0.17, 0.015, 4, 12, Math.PI), COL.basket, { at: [0, 0.16, 0], plain: true })];
      for (const [x, z] of [[-0.07, 0], [0.07, 0.03], [0, -0.08], [0.02, 0.08]]) parts.push(piece(new THREE.SphereGeometry(0.045, 8, 6).scale(1, 1.3, 1), COL.egg, { at: [x, 0.19, z], plain: true }));
      add('eggs', parts, YARD.coop.x0 + 1.0, YARD.coop.z0 - 0.6);
    }
    if (built.includes('corral')) {
      add('milk', [piece(new THREE.CylinderGeometry(0.14, 0.16, 0.5, 12), COL.can, { at: [0, 0.25, 0], plain: true }),
        piece(new THREE.CylinderGeometry(0.08, 0.12, 0.12, 12), COL.can, { at: [0, 0.56, 0], plain: true }),
        piece(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12), COL.dark, { at: [0, 0.63, 0], plain: true })], 1.9, YARD.corral.z0 - 0.7);
      // (a burlap wool sack, stuffed full, the fleece puffing out of its open top)
      const fleece = [piece(new THREE.CylinderGeometry(0.2, 0.24, 0.5, 12), '#b39466', { at: [0, 0.25, 0], plain: true, shade: 0.15 }),
        piece(new THREE.TorusGeometry(0.205, 0.02, 4, 16).rotateX(Math.PI / 2), COL.twine, { at: [0, 0.44, 0], plain: true })];
      for (const [x, z, r] of [[0, 0, 0.15], [0.09, 0.07, 0.11], [-0.09, 0.06, 0.11], [0.05, -0.1, 0.11], [-0.07, -0.08, 0.1]]) fleece.push(piece(new THREE.SphereGeometry(r, 14, 10), '#f6f1e4', { at: [x, 0.52 + r * 0.25, z], plain: true }));
      add('wool', fleece, -1.9, YARD.corral.z0 - 0.7);
    }
  }

  // ── THE HOMES (made again whenever the set of homes changes) ──────────────────────────────────────────────────────
  const boxes = [], segs = [];
  function buildHomes() {
    const want = homesWanted().join(',');
    if (want === built) return;
    built = want;
    if (mesh) { mesh.removeFromParent(); mesh.geometry.dispose(); mesh = null; }
    if (wire) { wire.removeFromParent(); wire.geometry.dispose(); wire = null; }
    offBlock(); offBlock = () => {}; unmow(); unmow = () => {};
    boxes.length = 0; segs.length = 0;
    const out = [], wires = [];
    if (built.includes('coop')) coopPieces(out, wires, segs);
    if (built.includes('pen')) penPieces(out, segs);
    if (built.includes('corral')) corralPieces(out, segs);
    if (out.length) {
      mesh = new THREE.Mesh(mergeGeometries(out), mat); mesh.name = 'homestead-homes';
      mesh.castShadow = mesh.receiveShadow = shadows; root.add(mesh);
      for (const g of out) g.dispose();
    }
    if (wires.length) {
      wire = new THREE.Mesh(mergeGeometries(wires), wmat); wire.name = 'homestead-wire'; root.add(wire);
      for (const g of wires) g.dispose();
    }
    goodsMarks();
    if (built) { offBlock = W.addBlocker ? W.addBlocker(blocked) : () => {}; unmow = mow(); }
  }
  // what blocks a walker: the fences (a little either side of each line) and the hen house, the trough, the hay
  const FENCE_HALF = 0.32, reach = 40;
  function blockedLocal(lx, lz) {
    for (const b of boxes) if (lx > b[0] && lx < b[2] && lz > b[1] && lz < b[3]) return true;
    for (const [ax, az, bx, bz] of segs) {
      const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1e-9, t = Math.max(0, Math.min(1, ((lx - ax) * vx + (lz - az) * vz) / l2));
      const dx = ax + vx * t - lx, dz = az + vz * t - lz; if (dx * dx + dz * dz < FENCE_HALF * FENCE_HALF) return true;
    }
    return false;
  }
  function blocked(x, z) { if (Math.abs(x - L.x) > reach || Math.abs(z - L.z) > reach) return false; const p = L.local(x, z); return blockedLocal(p.x, p.z); }
  // an animal's own test: inside its home and clear of the hen house, the trough and the hay (not the fences: the
  // inset keeps it off them)
  const clearFor = (home, x, z) => { const p = L.local(x, z); return L.inside(home, x, z) && !boxes.some((b) => b[4] === home && p.x > b[0] - 0.2 && p.x < b[2] + 0.2 && p.z > b[1] - 0.2 && p.z < b[3] + 0.2); };

  // the ground round the homes, mown (as the town's yards: no tall meadow hiding the hens), fading back to the meadow
  function mow() {
    const V = W.V, T = V && V.TOWN;
    if (!T || !T.yard || !V.N || !V.TEX) return () => {};
    const ks = built.split(','); let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const k of ks) { const R = YARD[k]; x0 = Math.min(x0, R.x0 - 1); x1 = Math.max(x1, R.x1 + 1); z0 = Math.min(z0, R.z0 - 1.5); z1 = Math.max(z1, R.z1 + 1); }
    const N = V.N, TEX = V.TEX, SIZE = V.SIZE, fade = YARD.mowFade, Rr = Math.hypot(x1 - x0, z1 - z0) / 2 + fade + TEX;
    const mid = L.at((x0 + x1) / 2, (z0 + z1) / 2), old = new Map();
    for (let j = Math.max(0, Math.floor((mid.z - Rr + SIZE / 2) / TEX)); j <= Math.min(N - 1, Math.ceil((mid.z + Rr + SIZE / 2) / TEX)); j++)
      for (let i = Math.max(0, Math.floor((mid.x - Rr + SIZE / 2) / TEX)); i <= Math.min(N - 1, Math.ceil((mid.x + Rr + SIZE / 2) / TEX)); i++) {
        const p = L.local((i + 0.5) * TEX - SIZE / 2, (j + 0.5) * TEX - SIZE / 2);
        const out = Math.hypot(Math.max(0, x0 - p.x, p.x - x1), Math.max(0, z0 - p.z, p.z - z1)), t = Math.min(1, out / fade), y = 1 - t * t * (3 - 2 * t);
        const k = j * N + i; if (y > T.yard[k]) { old.set(k, T.yard[k]); T.yard[k] = y; }
      }
    const forget = () => { const c = V.COVER && V.COVER.cache; if (c && c.tiles) c.tiles.clear(); };
    forget();
    // the pen's floor: no lawn tufts at all (trodden bare by the pigs), so a young piglet isn't lost in the grass
    const R = YARD.pen, bare = ks.includes('pen') && V.LAWN_SKIP ? (x, z) => { const p = L.local(x, z); return p.x > R.x0 && p.x < R.x1 && p.z > R.z0 && p.z < R.z1; } : null;
    if (bare) V.LAWN_SKIP.push(bare);
    return () => { for (const [k, v] of old) T.yard[k] = v; if (bare) { const i = V.LAWN_SKIP.indexOf(bare); if (i >= 0) V.LAWN_SKIP.splice(i, 1); } forget(); };
  }

  // ── THE ANIMALS ──────────────────────────────────────────────────────────────────────────────────────────────
  const herd = [];    // { rec (the rider's record), kind, home, a (animal or chicken), hen, tag, goal, t, state, size }
  // (the hens are clones of the town flock's chickens: one set of files loaded once for the whole visit, never per ride)
  let view = null;    // (the camera the names were last drawn for)
  // (a load that fails is forgotten, so the next need tries again: a hiccup on the network doesn't leave the coop empty
  // for the whole ride; a missing animal is looked for again every YARD.retry seconds)
  let chickensLib = null, chickensP = null, retryT = 0, missing = false;
  const needChickens = () => chickensP || (chickensP = preloadChickens().then((lib) => { chickensLib = lib; return lib; },
    (e) => { chickensP = null; throw e; }));
  let making = 0;
  async function syncAnimals() {
    const recs = animalsOf(rider), my = ++making;
    missing = false;
    // (the ones no longer owned go; an animal's record is matched by kind and name)
    for (let i = herd.length - 1; i >= 0; i--) if (!recs.includes(herd[i].rec)) { dropAnimal(herd[i]); herd.splice(i, 1); }
    for (const rec of recs) {
      if (herd.some((h) => h.rec === rec)) continue;
      try {
        let a, hen = false;
        if (rec.kind === 'hen') { await needChickens(); hen = true; } else await animals.need(MODEL_OF[rec.kind]);
        if (disposed || my !== making || herd.some((h) => h.rec === rec) || !animalsOf(rider).includes(rec)) continue;
        if (hen) {
          const looks = ['white', 'gold', 'black'], k = looks[Math.abs(hash(rec.name)) % 3];
          a = makeChicken(chickensLib, k, { shadows });
        } else a = makeAnimal(animals, MODEL_OF[rec.kind], { shadows });
        addAnimal(rec, a, hen);
      } catch (e) { missing = true; retryT = 0; console.warn('homestead: an animal could not be made (tried again shortly)', e); }
    }
  }
  const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };
  function sizeOf(rec) { const y = YARD.youngOf[rec.kind] || YARD.young; return rec.young ? y + (1 - y) * Math.min(1, (rec.age || 0) / GROW) : 1; }
  function addAnimal(rec, a, hen) {
    const home = HOME_OF[rec.kind];
    let p = L.random(home), rot = Math.random() * Math.PI * 2;
    // (a free spot: room round its middle, and for the big animals its whole body clear of the others')
    const me = { a, size: sizeOf(rec), base: 1 };
    // (how roomy a spot is: the smallest gap to the others' bodies, and room round the middles; with no free spot in
    // a full pen, the roomiest one tried, never just the last)
    const roomAt = (x, z, yaw) => { let m = Infinity; for (const o of herd) { if (o.home !== home) continue;
      m = Math.min(m, Math.hypot(o.a.root.position.x - x, o.a.root.position.z - z) - YARD.room[rec.kind] * 1.5);
      if (!hen && !o.hen) m = Math.min(m, gap(body(me, x, z, yaw), body(o, o.a.root.position.x, o.a.root.position.z, o.a.root.rotation.y)) - 0.3); } return m; };
    let best = clearFor(home, p.x, p.z) ? roomAt(p.x, p.z, rot) : -Infinity;
    for (let t = 0; t < 60 && best < 0; t++) {
      const q = L.random(home), yaw = Math.random() * Math.PI * 2; if (!clearFor(home, q.x, q.z)) continue;
      const m = roomAt(q.x, q.z, yaw); if (m > best) { best = m; p = q; rot = yaw; }
    }
    a.root.position.set(p.x, W.heightAt(p.x, p.z), p.z); a.root.rotation.y = rot;
    const size = sizeOf(rec), base = hen ? 0.9 + (Math.abs(hash(rec.name)) % 20) / 100 : 1;
    a.root.scale.setScalar(size * base);
    scene.add(a.root);
    const tag = makeTag(rec.name); tag.visible = false; scene.add(tag);
    tag.onBeforeRender = (r, sc, cam) => { view = cam; };   // (the camera the names are drawn for: to keep them apart)
    const h = { rec, kind: rec.kind, home, a, hen, tag, goal: null, t: rnd(0.5, 4), state: 'stand', base, size, v: 0, shadow: shadows };
    herd.push(h);
  }
  function dropAnimal(h) {
    // (a hen shares the flock's model, but its skeleton is its own copy with a bone texture: that is freed)
    if (h.hen) { h.a.mixer.stopAllAction(); h.a.mixer.uncacheRoot(h.a.model); h.a.root.removeFromParent(); h.a.model.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) o.skeleton.dispose(); }); } else h.a.dispose();
    h.tag.removeFromParent(); h.tag.material.map.dispose(); h.tag.material.dispose();
  }

  // an animal pottering in its home: stands a while (a hen pecks too), walks a few steps to a free spot, stands again
  function step(h, dt) {
    const a = h.a, r = a.root;
    if (!h.goal) {
      if ((h.t -= dt) <= 0) {
        if (h.hen && h.state !== 'peck' && Math.random() < 0.45) { h.state = 'peck'; h.t = 1.4 * Math.ceil(rnd(1.01, 3)); a.play('Peck', 0.2); return; }
        const reachM = h.hen ? 1.6 : 3.5;
        for (let k = 0; k < 8 && !h.goal; k++) {
          const ang = Math.random() * Math.PI * 2, d = 0.5 + Math.random() * reachM, x = r.position.x + Math.sin(ang) * d, z = r.position.z + Math.cos(ang) * d;
          if (clearFor(h.home, x, z) && roomy(h, x, z)) h.goal = { x, z };
        }
        if (h.goal) { h.state = 'walk'; h.v = h.hen ? rnd(CHICKEN.walk[0], CHICKEN.walk[1]) : a.stride.WalkSlow * (h.size < 1 ? 0.8 : 1); }
        else { h.state = 'stand'; h.t = rnd(1.5, 3); }
        if (!h.goal) idle(h);
      }
    } else {
      const dx = h.goal.x - r.position.x, dz = h.goal.z - r.position.z, d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz), turn = wrap(want - r.rotation.y), yaw0 = r.rotation.y;
      r.rotation.y += turn * Math.min(1, (h.hen ? 6 : 2.5) * dt);
      const v = h.v * (Math.abs(turn) > 1.2 ? 0.35 : 1), stepD = Math.min(d, v * dt);
      const nx = r.position.x + Math.sin(r.rotation.y) * stepD, nz = r.position.z + Math.cos(r.rotation.y) * stepD;
      const nose = h.hen ? 0.15 : (a.length || 1) * 0.5 * h.size, hx = nx + Math.sin(r.rotation.y) * nose, hz = nz + Math.cos(r.rotation.y) * nose;
      const bump = herd.some((o) => o !== h && o.home === h.home && (h.hen || o.hen
        ? Math.hypot(o.a.root.position.x - nx, o.a.root.position.z - nz) < YARD.room[h.kind] * 0.7 * Math.max(h.size, 0.7)
        : closer(h, nx, nz, r.rotation.y, o, yaw0)));
      if (bump && !h.hen) r.rotation.y = yaw0;   // (nor does it swing its rump into a neighbour turning)
      if (d < 0.08 || bump || !clearFor(h.home, nx, nz) || !L.inside(h.home, hx, hz, h.hen ? 0.12 : 0.3)) { h.goal = null; h.state = 'stand'; h.t = h.hen ? rnd(1.5, 5) : rnd(4, 12); idle(h); }
      else {
        r.position.set(nx, W.heightAt(nx, nz), nz);
        // (the clip at the pace over its stride: feet planted)
        if (h.hen) a.play('Walk', 0.15, v / CHICKEN.stride.Walk / (h.base * h.size));
        else a.play('WalkSlow', { fade: 0.35, speed: v / (a.stride.WalkSlow * h.size) });
      }
    }
  }
  // a body seen from above as a box from nose to tail (as the mesh is: a rounded bar let two animals' square corners
  // sink into each other's flanks): its middle, the way it faces, half its length and half its width
  function body(h, x, z, yaw) {
    const len = (h.a.length || 1) * h.size * h.base;
    return { x, z, s: Math.sin(yaw), c: Math.cos(yaw), hl: len * 0.5, hw: len * 0.18 };
  }
  // how far apart two bodies' edges are (below 0: they overlap, by that much): the widest gap along either box's sides
  function gap(p, q) {
    let sep = -Infinity;
    for (const [nx, nz] of [[p.s, p.c], [p.c, -p.s], [q.s, q.c], [q.c, -q.s]]) {
      const reach = (b) => b.hl * Math.abs(b.s * nx + b.c * nz) + b.hw * Math.abs(b.c * nx - b.s * nz);
      sep = Math.max(sep, Math.abs((q.x - p.x) * nx + (q.z - p.z) * nz) - reach(p) - reach(q));
    }
    return sep - 0.1;
  }
  // a step (or a turn: yaw0 is the way it faced before this frame's turn) that would bring two bodies into each other
  // (one that moves them apart is always fine, so two that somehow ended up touching can walk free)
  function closer(h, nx, nz, yaw, o, yaw0 = yaw) {
    const q = body(o, o.a.root.position.x, o.a.root.position.z, o.a.root.rotation.y);
    const after = gap(body(h, nx, nz, yaw), q);
    return after < 0 && after < gap(body(h, h.a.root.position.x, h.a.root.position.z, yaw0), q);
  }
  function idle(h) { if (h.hen) h.a.play('Idle', 0.25); else h.a.play('Idle', { fade: 0.35 }); }
  function roomy(h, x, z) {
    for (const o of herd) {
      if (o === h || o.home !== h.home) continue;
      const q = o.a.root.position, room = Math.max(YARD.room[h.kind], YARD.room[o.kind]);
      if (Math.hypot(q.x - x, q.z - z) < room || (o.goal && Math.hypot(o.goal.x - x, o.goal.z - z) < room)) return false;
    }
    return true;
  }

  // ── EACH FRAME ───────────────────────────────────────────────────────────────────────────────────────────────
  let saveT = 0, checkT = 0, toldGot = false;
  H.update = (dt, at) => {
    if (disposed) return;
    // the goods laid up, the young ones growing (play time only: the game calls this while playing)
    const grew = lay(rider, dt);
    if (grew.length) { for (const n of grew) { if (hob) hob.event('animalGrew', { name: n }); } saveRider(rider); }
    if ((saveT += dt) > YARD.saveEvery) { saveT = 0; saveRider(rider); }
    if (missing && (retryT += dt) > YARD.retry) { retryT = 0; syncAnimals(); }   // (one that failed to load: try again)
    if (!at) return;
    const far = Math.hypot(at.x - L.x, at.z - L.z);
    // a few times a second: goods picked up as you walk past, the waiting goods shown, the young ones' size
    if ((checkT -= dt) <= 0) {
      checkT = 0.25;
      const w = waiting(rider);
      for (const k of GOODS_IDS) if (marks[k]) marks[k].visible = w[k] > 0;
      // (near any of the homes, everything waiting is picked up: walking past the yard is enough)
      const near = built && built.split(',').some((home) => L.off(home, at.x, at.z) < YARD.collect);
      const got = near ? collect(rider) : null;
      if (got) {
        saveRider(rider); refresh();
        hud.toast(gotLine(got), 'good');
        if (hob) hob.event('goodsCollected');
        for (const k of GOODS_IDS) if (marks[k]) marks[k].visible = waiting(rider)[k] > 0;
        // (the saddlebags full: said once a ride)
        const full = GOODS_IDS.filter((k) => homestead(rider).goods[k] >= GOODS[k].bag);
        if (full.length && !toldGot) { toldGot = true; hud.toast('Your saddlebags are full of goods: sell some at the store counter', 'warn'); }
      }
      // (the nearest few may show their names)
      const byNear = herd.map((h) => [h, Math.hypot(h.a.root.position.x - at.x, h.a.root.position.z - at.z)]).sort((a, b) => a[1] - b[1]);
      byNear.forEach(([h], i) => { h.named = i < YARD.tagsAtOnce; });
      for (const h of herd) {
        const s = sizeOf(h.rec);
        if (Math.abs(s - h.size) > 0.004) { h.size = s; h.a.root.scale.setScalar(s * h.base); }
        // (a shadow only close to the camera's target, and the hens' only on the gaming tier: each shadow is the animal
        // drawn again into the shadow map, about a millisecond for the whole yard on the normal tier)
        const q = h.a.root.position, ct = W.camTarget, sh = shadows && (W.tier === 'gaming' || !h.hen) && (!ct || Math.hypot(q.x - ct.x, q.z - ct.z) < YARD.shadowNear);
        if (sh !== h.shadow) { h.shadow = sh; h.a.root.traverse((o) => { if (o.isMesh) o.castShadow = sh; }); }
      }
    }
    if (far > YARD.awake) { for (const h of herd) h.tag.visible = false; return; }
    for (const h of herd) {
      step(h, dt);
      h.a.update(dt);
      // the name over its head, while you're near
      const p = h.a.root.position, d = Math.hypot(p.x - at.x, p.z - at.z);
      const o = d < YARD.tagNear ? 1 : d < YARD.tagFar ? 1 - (d - YARD.tagNear) / (YARD.tagFar - YARD.tagNear) : 0;
      h.tag.visible = o > 0.02 && !!h.named;
      if (h.tag.visible) {
        const top = h.hen ? 0.48 : (h.a.tall || h.a.height || 1);
        h.tag.position.set(p.x, p.y + top * h.size * h.base + 0.18, p.z); h.tag.material.opacity = o;
      }
    }
    unstack(at);
  };
  // names that would cover each other on screen (hens side by side in the run) are stacked one above the other:
  // the nearest animal's name stays over its head, the next goes just above it, and so on
  const _v = new THREE.Vector3();
  function unstack(at) {
    if (!view) return;
    const shown = herd.filter((h) => h.tag.visible);
    if (shown.length < 2) return;
    shown.sort((a, b) => Math.hypot(a.a.root.position.x - at.x, a.a.root.position.z - at.z) - Math.hypot(b.a.root.position.x - at.x, b.a.root.position.z - at.z));
    const P = view.projectionMatrix.elements, placed = [];
    for (const h of shown) {
      _v.copy(h.tag.position).project(view);
      if (_v.z > 1) continue;   // (behind the camera)
      const hw = h.tag.scale.x * P[0] * 0.5 + 0.01, ht = h.tag.scale.y * P[5], gap = ht * 0.12;
      let y = _v.y, moved = false;
      for (let pass = 0; pass < placed.length; pass++) {
        const hit = placed.find((q) => Math.abs(q.x - _v.x) < q.hw + hw && y < q.y + q.ht + gap && y + ht + gap > q.y);
        if (!hit) break;
        y = hit.y + hit.ht + gap; moved = true;
      }
      placed.push({ x: _v.x, y, hw, ht });
      if (moved) { _v.y = y; h.tag.position.copy(_v.unproject(view)); }
    }
  }

  // ── CHANGES, THANK-YOUS, SALES ─────────────────────────────────────────────────────────────────────────────
  H.changed = () => { homestead(rider); buildHomes(); syncAnimals(); refresh(); };
  // (who sends the young one: the settler at the farm, the rancher whose cattle are rounded up)
  const FROM = { pig: 'the settler', sheep: 'the settler', cow: 'the rancher' };
  H.jobDone = (event) => {
    const kind = GIFT.from[event], jobs = homestead(rider).farm.jobs, before = jobs[kind];
    const a = thankYou(rider, event);
    // (a whole job counted toward a locked kind is saved, so the count shown at the store survives a closed tab)
    if (!a) { if (kind && jobs[kind] !== before) saveRider(rider); return null; }
    saveRider(rider); H.changed();
    const what = `a ${YOUNG[a.kind]}`, where = HOME_OF[a.kind];
    setTimeout(() => {
      if (disposed) return;
      hud.toast(`A thank-you from ${FROM[a.kind]}: ${what} named ${a.name}! In your ${where} behind the cabin.`, 'good');
      // (the first of a kind unlocks it at the store: said after the thank-you has had its moment)
      if (a.unlocked) setTimeout(() => { if (!disposed) hud.toast(`The store will sell you ${ANIMALS[a.kind].many} now.`, 'gold'); }, 5200);
    }, 4600);
    if (hob) hob.event('animalGift', { kind: a.kind, name: a.name, unlocked: !!a.unlocked });
    return a;
  };
  // the store asks at every new customer: now and then (never twice within SELL.every orders) one buys your goods.
  // The first sale of a ride comes on the first, second or third customer (by chance), so a ride with goods in the
  // saddlebags doesn't always open with a sale.
  let sinceSale = Math.floor(Math.random() * SELL.every);
  H.saleOrder = ({ step = 1, who = null } = {}) => {
    if (++sinceSale < SELL.every) return null;
    const o = makeSale(homestead(rider).goods, { step, who });
    if (o) sinceSale = 0;
    return o;
  };
  H.sold = (order) => { sold(rider, order); saveRider(rider); refresh(); if (hob) hob.event('goodsSold', { goods: order.sale && order.sale.goods }); };
  H.goodsLine = () => goodsLine(rider);

  // ── THE GENERAL STORE'S ROWS (shop.js puts them in the store's panel) ──────────────────────────────────────────
  const LOCK = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="vertical-align:-2px"><rect x="5" y="10" width="14" height="11" rx="2" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>';
  const COIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#e2ad4c"/><circle cx="12" cy="12" r="7.4" fill="none" stroke="#a8742a" stroke-width="1.6"/></svg>';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const shop = { kind: null, name: '' };
  const HOME_NAME = { coop: 'coop', pen: 'pen', corral: 'corral' };
  function shopHtml() {
    const mine = animalsOf(rider);
    let h = `<h3 class="bms-h">Farm animals</h3>`;
    if (mine.length) {
      const by = KINDS.filter((k) => countOf(rider, k)).map((k) => {
        const list = mine.filter((a) => a.kind === k), A = ANIMALS[k];
        return `${list.length} ${list.length === 1 ? A.name.toLowerCase() : A.many} (${list.map((a) => esc(a.name) + (a.young ? `, a ${YOUNG[k]}` : '')).join(', ')})`;
      });
      const g = goodsLine(rider);
      h += `<div class="bms-row"><div class="bms-what"><b>Your animals</b><small>${by.join(' · ')}. They live behind your cabin.${g ? ` In your saddlebags: ${esc(g.replace(/ to sell$/, ''))}. Townsfolk buy them at the counter.` : ''}</small></div><div class="bms-act"></div></div>`;
    }
    // (the kinds the store sells this rider: hens from the start, the others once earned; a locked kind gets a row of
    // its own below with the one line saying what earns it, and no button)
    const open = KINDS.filter((k) => unlocked(rider, k)), locked = KINDS.filter((k) => !open.includes(k));
    if (!open.includes(shop.kind)) shop.kind = open.find((k) => hasRoom(rider, k) && rider.gold >= ANIMALS[k].price) || open.find((k) => hasRoom(rider, k)) || 'hen';
    const A = ANIMALS[shop.kind], room = hasRoom(rider, shop.kind), short = rider.gold < A.price;
    const line = room ? A.line : `Your ${HOME_NAME[A.home]} is full: ${A.most} ${A.most === 1 ? A.name.toLowerCase() : A.many} is all it holds.`;
    // (with only hens for sale there is nothing to pick between: no one-button choice, the row just says "A hen")
    const title = open.length > 1 ? (mine.length ? 'Another farm animal' : 'A farm animal for your homestead') : countOf(rider, shop.kind) ? `Another ${A.name.toLowerCase()}` : `A ${A.name.toLowerCase()} for your homestead`;
    h += `<div class="bms-row is-tall"><div class="bms-what"><b>${title}</b><small>${esc(line)}</small>
      ${open.length > 1 ? `<div class="bms-kinds" role="radiogroup" aria-label="Which animal">${open.map((k) => `<button type="button" role="radio" aria-checked="${shop.kind === k}" data-do="animal-kind" data-id="${k}" class="${shop.kind === k ? 'is-on' : ''}">${ANIMALS[k].name}</button>`).join('')}</div>` : ''}
      <div class="bms-name"><input type="text" maxlength="12" placeholder="Name your ${esc(A.name.toLowerCase())}" value="${esc(shop.name)}" aria-label="Your new animal's name" data-animal-name></div></div>
      <div class="bms-act"><span class="bms-price">${COIN}<b>${A.price}</b></span><button type="button" data-do="buy-animal" ${!room || short ? 'disabled' : ''}>${!room ? 'No room' : short ? `Need ${A.price - rider.gold} more` : 'Buy'}</button></div></div>`;
    for (const k of locked) {
      const L = ANIMALS[k], Many = L.many[0].toUpperCase() + L.many.slice(1);
      h += `<div class="bms-row is-locked" data-locked="${k}"><div class="bms-what"><b>${Many}</b><small>${esc(earnLine(rider, k))}</small></div><div class="bms-act"><span class="bms-tag">${LOCK} Not yet</span></div></div>`;
    }
    return h;
  }
  // -> undefined (not ours), or { note, bought }
  function shopClick(what, id, body) {
    if (what === 'animal-kind') {
      // (a name typed while the last kind's home was full was never used: it goes, so new typing isn't added onto it)
      if (ANIMALS[id] && unlocked(rider, id) && id !== shop.kind) { if (shop.kind && !hasRoom(rider, shop.kind)) shop.name = ''; shop.kind = id; }
      return { note: '' };
    }
    if (what !== 'buy-animal') return undefined;
    const kind = shop.kind, input = body && body.querySelector('[data-animal-name]');
    const name = cleanName(input ? input.value : shop.name);
    const res = buyAnimal(rider, kind, name, spend);
    if (res === 'short') return { note: 'Not enough gold yet.' };
    if (res === 'locked') return { note: earnLine(rider, kind) };
    if (res === 'full') return { note: `No room for another: your ${HOME_NAME[ANIMALS[kind].home]} is full.` };
    if (res !== 'bought') return { note: '' };
    const a = animalsOf(rider).filter((x) => x.kind === kind).pop();
    shop.name = ''; saveRider(rider); H.changed();
    if (hob) hob.event('animal', { kind, name: a.name, first: countOf(rider, kind) === 1 });
    const where = { coop: 'the new coop', pen: 'the new pen', corral: 'the new corral' }[ANIMALS[kind].home];
    const first = countOf(rider, kind) === 1 && (kind !== 'cow' || countOf(rider, 'sheep') === 0) && (kind !== 'sheep' || countOf(rider, 'cow') === 0);
    return { bought: 'animal', note: `${a.name} is yours! ${first ? `Waiting in ${where} behind your cabin.` : 'Waiting behind your cabin with the others.'}` };
  }
  H.shop = { store: { html: shopHtml, click: shopClick, input: (e) => { if (e.target.matches('[data-animal-name]')) shop.name = e.target.value; },
    keydown: (e, body) => { if (e.key === 'Enter' && e.target.matches('[data-animal-name]')) { const b = body.querySelector('[data-do="buy-animal"]'); if (b && !b.disabled) b.click(); } } } };

  H.state = () => ({
    homes: built ? built.split(',') : [], animals: herd.map((h) => ({ kind: h.kind, name: h.rec.name, young: !!h.rec.young, size: +h.size.toFixed(2),
      x: +h.a.root.position.x.toFixed(2), z: +h.a.root.position.z.toFixed(2), inside: L.inside(h.home, h.a.root.position.x, h.a.root.position.z, 0), clip: h.a.clip, tag: h.tag.visible })),
    goods: { ...homestead(rider).goods }, yard: { ...homestead(rider).yard }, owned: animalsOf(rider).length,
    farm: { unlocked: KINDS.filter((k) => unlocked(rider, k)), jobs: { ...homestead(rider).farm.jobs } },
  });
  H.dev = {
    give(kind = 'hen', name = '', young = false) { if (!hasRoom(rider, kind)) return false; animalsOf(rider).push({ kind, name: cleanName(name) || `${ANIMALS[kind].name} ${countOf(rider, kind) + 1}`, ...(young ? { young: true, age: 0 } : {}) }); saveRider(rider); H.changed(); return true; },
    goods(n = 30) { const g = homestead(rider).goods; for (const k of GOODS_IDS) g[k] = Math.min(GOODS[k].bag, g[k] + n); saveRider(rider); refresh(); },
    lay(seconds = 600) { lay(rider, seconds); },
    gift(event = 'flockDone') { const c = GIFT_TRY(event); return c; },
    // (a kind unlocked at the store without earning it, for a rig)
    unlock(kind) { const f = homestead(rider).farm; if (GIFT.sure[kind] && !f.unlocked.includes(kind)) f.unlocked.push(kind); saveRider(rider); refresh(); return unlocked(rider, kind); },
  };
  // (a thank-you for a rig, whatever the dice say)
  const GIFT_TRY = (event) => { const a = thankYou(rider, event, () => 0); if (!a) return null; saveRider(rider); H.changed(); if (hob) hob.event('animalGift', { kind: a.kind, name: a.name, unlocked: !!a.unlocked }); hud.toast(`A thank-you from ${FROM[a.kind]}: a ${YOUNG[a.kind]} named ${a.name}!${a.unlocked ? ` The store will sell you ${ANIMALS[a.kind].many} now.` : ''}`, 'good'); return a; };
  // (the goods and the young ones' age since the last save are kept when the page is closed or put away)
  const keep = () => { if (!disposed) saveRider(rider); };
  const onHide = () => { if (document.visibilityState === 'hidden') keep(); };
  addEventListener('pagehide', keep); document.addEventListener('visibilitychange', onHide);
  H.dispose = () => {
    disposed = true; offBlock(); unmow();
    removeEventListener('pagehide', keep); document.removeEventListener('visibilitychange', onHide);
    for (const h of herd) dropAnimal(h);
    herd.length = 0;
    for (const k of Object.keys(marks)) marks[k].geometry.dispose();
    root.removeFromParent();
    if (mesh) mesh.geometry.dispose(); if (wire) wire.geometry.dispose();
    mat.dispose(); wmat.dispose(); tex.dispose(); wtex.dispose();
  };
  H.herd = herd;

  buildHomes();
  syncAnimals();
  return H;
}
