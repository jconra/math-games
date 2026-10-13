// THE WAGON: one of the owner's four Tripo wagons (models/wagons/, made game-ready by
// ~/pw/bandit-math/rigs/wagons/build_wagons.mjs), pulled by a team of two horses with a driver on the seat, rolling
// along a path at a steady pace: the body pitching and rolling with the ground under its four wheels, each wheel turning
// exactly as far as it rolls, the front wheels and the tongue swinging to follow the team round the bends, the horses'
// legs keeping pace (their clip's speed is the pace over their stride: gaitFor in actors/animals.js), the driver
// holding the reins (the Drive clip, made in Blender: ~/pw/bandit-math/rigs/wagons/build_drive_clip.py).
//
// The four kinds (wagons.json says each one's size, where its wheels go, its seat and its bed):
//   covered  the prairie schooner (white canvas over hoops, a seat in front)        from wagon2.glb
//   chuck    a chuck wagon (canvas cover, the chuck box at the back)               from wagon.glb
//   farm     an open farm wagon loaded with crates, barrels and sacks             from wagon3.glb
//   freight  an open freight wagon with a chest, trunks and crates                 from wagon4.glb
// All four share one wheel (wheel.glb: the brief's rebuild of wagon3's back wheel, twelve even spokes), scaled to each
// axle: the back wheels about 1.2 m across, the front about 1.0 m. Each wagon is about 3.3-3.6 m long, 1.5-2 m wide.
//
//   const lib = await loadWagons({ animals, folk })   animals: actors/animals.js's lib, folk: actors/folk.js's (the horse
//                                                     and the driver's clip are loaded into them here); kinds: only these
//   lib.need(kind) -> Promise                         loads one more kind later
//   const wg = makeWagon(lib, { kind, W, team, driver, look, shadows })
//        W: the world (W.heightAt: the ground under the wheels); team: false for no horses; driver: false for nobody on
//        the seat; look: the driver's folk.js look ({ outfit, palette, skin, hair }); shadows (default true)
//     .root           add it to the scene (it holds the wagon, the horses and the harness; it stays put itself)
//     .setPath(curve, { at, dir })   curve: any three.js curve on the ground (getPointAt / getTangentAt / getLength,
//                     e.g. roadCurve(W)); at: 0..1 along it, where the middle of the wagon is; dir: +1 along, -1 back
//     .speed          m/s the driver wants (it eases to it: about 0.8 m/s each second up, 1.8 down); 0 stops it
//     .stop() / .go(speed)
//     .update(dt)     each frame: moves it along its path and sets everything moving
//     .lane           m to the right of the path's middle it keeps to (the way it is going; default 0)
//     .pace           m/s it is going now        .u  metres along the path (its middle)   .t  the same, 0..1
//     .pos            the middle of the wagon on the ground (Vector3)    .heading  radians, as three's rotation.y
//     .front          the lead horses' noses (Vector3, on the ground)    .ended  at an end of its path (it stops there)
//     .length / .width   metres, the team included / the widest part
//     .nose / .tail   metres from its middle (.u) forward to the lead horses' noses, and back to the tailboard
//     .seats          { driver, beside }: Object3Ds on the seat (the seat of the trousers): getWorldPosition for a spot
//     .cargo          an Object3D on the middle of the bed's floor: add a strongbox to it and it rides along
//     .team           [left horse, right horse] (actors/animals.js animals)     .driver   the person (or null)
//     .body           the wagon itself (moves and tilts each frame)       .kind, .info (its wagons.json entry)
//     .boxes          [the wagon, its team]: boxes on the ground, kept up to date (see WAGONS_OUT below)
//     .dispose()
//   WAGONS_OUT            every wagon made and not yet put away (a Set)
//   pushFromWagons(x, z, r, W)   a walker r metres round at (x, z) inside a wagon or its team: where to put it just
//                         outside (never into a wall or another wagon), or null (src/player.js: on foot and the horse)
//   inWagons(x, z, r)     true there (src/townlife.js: a chicken doesn't step into one)
//   roadCurve(W, which)   the road as a CatmullRomCurve3 on the ground: 'trail' the town's trail from the square to the
//                         pasture (W.places.trail); 'through' (default) the road through the valley: in from the foot of
//                         the western hills, down the west trail into the town square, out along the trail and away east
//                         to the foot of the eastern hills (ROAD below), about 1.3 km. Its .laneAt(s, dir, want): how far
//                         from the middle a wagon going dir keeps its lane there; .narrowAt(s): no room for two to pass;
//                         .narrows: the one-way stretches, [[from, to], ...] metres along
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeAnimal } from './actors/animals.js';
import { makePerson } from './actors/folk.js';

export const WAGON_KINDS = ['covered', 'chuck', 'farm', 'freight'];
export const WAGON = {
  horse: 'farmHorse',       // the team: the farm pack's horse (stockier than the riding horse: a draft horse's build)
  gap: 1.15,                // m between the two horses' middles, side to side
  ahead: 2.5,               // m from the front axle to the horses' middles
  yoke: 0.8,                // m in front of the horses' middles: the neck yoke, where the tongue ends
  yokeUp: 1.3,              // m above the ground: the neck yoke's height (at the chest, just under the collars)
  tree: 0.55,               // m in front of the front axle: the doubletree (the crossbar the traces pull on)
  collar: { up: 0.847, fwd: 0.224, tilt: -1.0, x: 0.055 },   // each horse's collar: its middle at these shares of the horse's height
                            // and length (from its middle), tipped forward this far (radians) to lie round the neck, and x
                            // metres to its left (the neck's middle sits a little off the body's there)
  bit: [0, -0.28, 0.42],    // m from a horse's head bone (in the horse's own turn) to its mouth, where the reins end
  walkMost: 2.6,            // m/s: up to this a team walks (its Walk sped up); a pulling team only gallops past it
  accel: 0.8, brake: 1.8,   // m/s each second, speeding up and slowing down
  steerMost: 0.7,           // radians: the most the front wheels turn either way
  settle: 0.12,             // s: how quickly the body takes up a new tilt (a little give, so it doesn't twitch)
  seatDrop: 0.45,           // m from the seat's top down to the driver's feet (the Drive clip's root: build_drive_clip.py)
  driverAt: -0.3,           // m across the seat: the driver (on the right), and a passenger (on the left)
  besideAt: 0.32,
  drivers: [                // who drives (folk.js looks), picked by the wagon's number
    { outfit: 'farmer_m', palette: 'rancher', skin: 3, hair: 1 },
    { outfit: 'adventurer_m', palette: 'homestead', skin: 5, hair: 0 },
    { outfit: 'casual_f', palette: 'prairie', skin: 1, hair: 4 },
    { outfit: 'worker_m', palette: 'sage', skin: 2, hair: 9 },
    { outfit: 'adventurer_f', palette: 'mustard', skin: 4, hair: 2 },
  ],
};
const GAME = new URL('../', import.meta.url).href;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

// loaded once and kept for the whole visit (every ride after the first gets the same models, wheel and harness, rather
// than loading and uploading them all again)
const libs = [];
export function loadWagons({ base = GAME, animals = null, folk = null, kinds = WAGON_KINDS, horse = WAGON.horse } = {}) {
  let dir = String(base); if (!dir.endsWith('/')) dir += '/';
  if (!/wagons\/$/.test(dir)) dir += /models\/$/.test(dir) ? 'wagons/' : 'models/wagons/';
  const key = dir + '|' + kinds.join(',') + '|' + horse;
  let c = libs.find((x) => x.key === key && x.animals === animals && x.folk === folk);
  if (!c) {
    c = { key, animals, folk, p: loadLib(dir, { animals, folk, kinds, horse }) };
    libs.push(c);
    c.p.catch(() => { const i = libs.indexOf(c); if (i >= 0) libs.splice(i, 1); });   // (a failed load is tried again next time)
  }
  return c.p;
}
async function loadLib(dir, { animals, folk, kinds, horse }) {
  const res = await fetch(dir + 'wagons.json'); if (!res.ok) throw new Error('wagons.json: ' + res.status);
  const info = await res.json();
  const lib = { dir, info, kinds: {}, loading: {}, wheel: null, animals, folk, horse };
  const meshOf = (scene, name) => { let m = null; scene.traverse((o) => { if (o.isMesh && (o.name === name || (o.parent && o.parent.name === name))) m = m || o; }); return m; };
  lib.need = (kind) => {
    if (!info.kinds[kind]) return Promise.reject(new Error('no such wagon: ' + kind));
    return lib.loading[kind] || (lib.loading[kind] = loader.loadAsync(dir + info.kinds[kind].file).then((g) => {
      const body = meshOf(g.scene, 'body'), tongue = meshOf(g.scene, 'tongue');
      for (const m of [body, tongue]) if (m) { m.material.roughness = 0.85; m.material.metalness = 0; }
      lib.kinds[kind] = { body, tongue, info: info.kinds[kind] };
      return lib.kinds[kind];
    }));
  };
  const wheel = loader.loadAsync(dir + info.wheel.file).then((g) => {
    let m = null; g.scene.traverse((o) => { if (o.isMesh && !m) m = o; });
    m.material.roughness = 0.85; m.material.metalness = 0;
    lib.wheel = { geometry: m.geometry, material: m.material };
  });
  // the driver's clip (both skeletons), into the folk's own clip lists before anybody is made
  const drive = folk ? Promise.all(['m', 'f'].map((b) => loader.loadAsync(folk.dir + `clips_drive_${b}.glb`)
    .then((g) => folk.addClips(b, g.animations)).catch((e) => console.warn('wagon: no Drive clip for', b, e)))) : null;
  await Promise.all([...kinds.map(lib.need), wheel, animals ? animals.need(horse) : null, drive]);
  lib.harness = harnessParts();
  return lib;
}

// THE HARNESS, made here: the doubletree (the crossbar in front of the front axle) with a singletree at each end, a
// collar round each horse's neck, and the leather: traces from each collar back to its singletree, reins from the
// driver's hands to each horse's head (thin straps, all of a wagon's in one instanced mesh, moved each frame)
function harnessParts() {
  const wood = new THREE.MeshStandardMaterial({ color: 0x5b4330, roughness: 0.85 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.7 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.6, metalness: 0.3 });
  const half = WAGON.gap / 2;
  const tree = mergeGeometries([
    new THREE.BoxGeometry(WAGON.gap + 0.12, 0.07, 0.07),
    new THREE.BoxGeometry(0.72, 0.05, 0.05).translate(half, 0, 0.09),
    new THREE.BoxGeometry(0.72, 0.05, 0.05).translate(-half, 0, 0.09),
  ]);
  // a collar: a padded ring round the base of the neck, a little longer than wide, its front tipped forward
  // (sized to the farm horse's neck where it sits, measured with rays from the ring's middle: the neck is about 0.41 m
  // wide and 0.43 m deep there and squarish, so the ring's inside is 0.5 x 0.54 m; rigs: fix-wagons-r2/collar.cjs)
  const collar = new THREE.TorusGeometry(0.31, 0.06, 6, 18).scale(1.0, 1.08, 1);
  const strap = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);    // (stretched between two points: see strapTo)
  return { wood, leather, iron, tree, collar, strap };
}

// ── THE ROAD ───────────────────────────────────────────────────────────────────────────────────────────────────────
// the planting's strokes by name (the land's own footpaths and the town's trails)
function strokes(W) {
  const list = (W.V && W.V.PLANTING_FIRST && W.V.PLANTING_FIRST.strokes) || [];
  const m = {}; for (const s of list) m[s.id] = s.pts; return m;
}
// a run of [x, z] points thinned to about `every` metres (the land's paths are drawn every 2-3 m; a curve through them
// all would wobble)
function thin(pts, every = 8) {
  const out = [pts[0]]; let last = pts[0];
  for (let i = 1; i < pts.length - 1; i++) { const p = pts[i]; if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= every) { out.push(p); last = p; } }
  out.push(pts[pts.length - 1]);
  return out;
}
export const ROAD = {
  // the road through the valley, in order (each a stroke of the planting, reversed where marked, only the points `keep`
  // says yes to): in from the west where the land's west path comes down out of the hills (about 650 m out of town;
  // further west it climbs through the trees to the land's edge), along the town's west trail, across the square, out
  // along the trail to where the land's north-east path leaves it (past the corral's north side and the pasture's), and
  // up that path toward the north-east hills. (It keeps clear of the open land south-east of the pasture, where the
  // "Protect the wagon" job has its own road.) Surveyed with ~/pw/bandit-math/rigs/wagons/road_survey.cjs.
  through: [['landpath4', { reverse: true, keep: (x) => x > -645 }], ['westtrail'], ['trail', { keep: (x) => x <= 94 }],
    ['landpath2'], ['landpath1', { keep: (x) => x < 420 }]],
  every: 8,                 // m between the points the curve passes through
  half: 1.2,                // m either side of the middle a wagon needs clear
  aside: 6,                 // m the road may step aside round something at its edge (the thicket on the land's west path,
                            // about 650 m west of town, needs most of that)
  ease: 30,                 // m of road either side of a snag that may bend to get round it
  turn: 0.375,              // m the road may move across for each metre along it, getting round something
  bend: 0.125,              // ... and how much that may change from one metre to the next (so it curves, never zigzags)
  wide: 2.5,                // m: the most a wagon's lane is looked for either side of the middle (see laneAt)
  narrow: 8,                // m before and after a tight place that a lane has already come in
  pass: 2.2,                // m between two wagons' lanes for them to pass (each about 2 m wide, a hair apart)
  oneWay: 10,               // m past each end of a narrow place that two wagons don't meet in either
};
// (worked out once for each world and kept: every ride after the first gets the same road at once)
const roads = new WeakMap();
export function roadCurve(W, which = 'through') {
  const key = which + '|' + [ROAD.every, ROAD.half, ROAD.aside, ROAD.ease, ROAD.turn, ROAD.bend].join(',') + '|' + !!W.blocked;
  let m = roads.get(W); if (!m) roads.set(W, m = new Map());
  if (!m.has(key)) m.set(key, makeRoad(W, which));
  return m.get(key);
}
function makeRoad(W, which) {
  const S = strokes(W); let pts = [];
  if (which === 'trail') pts = (W.places.trail || []).map((p) => [p[0], p[1]]);
  else for (const [id, o = {}] of ROAD[which] || ROAD.through) {
    let p = (S[id] || []).map((q) => [q[0], q[1]]);
    if (id === 'trail' && !p.length) p = (W.places.trail || []).map((q) => [q[0], q[1]]);
    if (o.reverse) p.reverse();
    if (o.keep) p = p.filter((q) => o.keep(q[0], q[1]));
    // (each stroke joins the last at whichever of its ends is nearer)
    if (pts.length && p.length) {
      const e = pts[pts.length - 1], d0 = Math.hypot(p[0][0] - e[0], p[0][1] - e[1]), d1 = Math.hypot(p[p.length - 1][0] - e[0], p[p.length - 1][1] - e[1]);
      if (d1 < d0) p.reverse();
      if (Math.hypot(p[0][0] - e[0], p[0][1] - e[1]) < 1) p.shift();
    }
    pts.push(...p);
  }
  pts = thin(pts, ROAD.every);
  // where a tree or a fence post stands at the road's edge, the road steps aside (up to ROAD.aside metres) to where a
  // wagon's width is clear. Checked every half metre along the road (laid on the ground, as the road itself is); over
  // each stretch with a snag in it (and ROAD.ease metres more either side) the way through is worked out a metre at a
  // time, for every place across it could be (an eighth of a metre apart): the one that keeps nearest the middle,
  // moving across at most ROAD.turn metres a metre and changing that by at most ROAD.bend a metre (so it curves round a
  // tree, never kinks or zigzags). Through those stretches the curve passes through a point every metre; elsewhere the
  // road is just as it was.
  const ACROSS = 0.125;
  if (W.blocked && pts.length > 2) {
    const base = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, W.heightAt(x, z), z)), false, 'centripetal');
    base.arcLengthDivisions = Math.max(200, pts.length * 8);
    const L = base.getLength(), N = Math.floor(L) + 1;
    const BP = [], BN = [], P = new THREE.Vector3(), T = new THREE.Vector3();
    for (let h = 0; h < 2 * N; h++) { base.getPointAt(Math.min(1, h / 2 / L), P); base.getTangentAt(Math.min(1, h / 2 / L), T); const n = Math.hypot(T.x, T.z) || 1; BP.push([P.x, P.z]); BN.push([T.z / n, -T.x / n]); }
    const H = ROAD.half + 0.15;   // (a hair more than the wagon needs)
    const ACR = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map((f) => f * H);   // (looked at a third of a metre apart: no trunk slips between)
    const clearHalf = (h, k) => ACR.every((w) => !W.blocked(BP[h][0] + BN[h][0] * (k + w), BP[h][1] + BN[h][1] * (k + w)));
    const clearAt = (d, k) => clearHalf(2 * d, k) && clearHalf(2 * d + 1, k);
    // the stretches to work out: each snag and ROAD.ease metres either side (stretches that meet join up)
    const spans = [];
    for (let d = 1; d < N - 1; d++) {
      if (clearAt(d, 0)) continue;
      const a = Math.max(0, d - ROAD.ease), b = Math.min(N - 1, d + ROAD.ease), last = spans[spans.length - 1];
      if (last && a <= last[1]) last[1] = b; else spans.push([a, b]);
    }
    const off = new Float64Array(N);
    const STEPS = Math.round(ROAD.aside / ACROSS), K = 2 * STEPS + 1;
    const R = Math.max(1, Math.round(ROAD.turn / ACROSS)), B = Math.max(1, Math.round(ROAD.bend / ACROSS)), M = 2 * R + 1;
    for (const [a, b] of spans) {
      // state: where across (k) and how far it moved across coming here (m, -R..R); cost: how far off the middle, a
      // great deal more where it isn't clear, a little for each bend; it starts and ends in the middle, going straight
      const n = b - a + 1, S = K * M, cost = new Float64Array(n * S).fill(Infinity), from = new Int32Array(n * S);
      const ok = new Uint8Array(n * K);
      for (let i = 0; i < n; i++) for (let k = 0; k < K; k++) ok[i * K + k] = clearAt(a + i, (k - STEPS) * ACROSS) ? 1 : 0;
      cost[STEPS * M + R] = 0;
      for (let i = 1; i < n; i++) {
        for (let k = 0; k < K; k++) {
          const here = Math.abs(k - STEPS) * ACROSS + (ok[i * K + k] ? 0 : 1000);
          for (let m = -R; m <= R; m++) {
            const j = k - m; if (j < 0 || j >= K) continue;
            let best = Infinity, bs = 0;
            for (let pm = Math.max(-R, m - B); pm <= Math.min(R, m + B); pm++) { const c = cost[(i - 1) * S + j * M + pm + R] + Math.abs(m - pm) * 0.05; if (c < best) { best = c; bs = j * M + pm + R; } }
            if (best < Infinity) { cost[i * S + k * M + m + R] = best + here; from[i * S + k * M + m + R] = bs; }
          }
        }
      }
      let st = STEPS * M + R;
      for (let i = n - 1; i >= 0; i--) { off[a + i] = (Math.floor(st / M) - STEPS) * ACROSS; st = from[i * S + st]; }
    }
    if (spans.length) {
      // the points the road passes through: the old ones outside the stretches, one every metre inside them
      const near = (q) => { let bh = 0, bd = Infinity; for (let h = 0; h < BP.length; h++) { const e = (BP[h][0] - q[0]) ** 2 + (BP[h][1] - q[1]) ** 2; if (e < bd) { bd = e; bh = h; } } return bh / 2; };
      const at = pts.map(near), out = [];
      let si = 0;
      for (let i = 0; i < pts.length; i++) {
        while (si < spans.length && spans[si][1] < at[i]) si++;
        const sp = spans[si];
        if (sp && at[i] >= sp[0]) {
          if (!sp.done) { sp.done = true; for (let d = sp[0]; d <= sp[1]; d++) out.push([BP[2 * d][0] + BN[2 * d][0] * off[d], BP[2 * d][1] + BN[2 * d][1] * off[d]]); }
          continue;
        }
        out.push(pts[i]);
      }
      pts = out;
    }
  }
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, W.heightAt(x, z), z)), false, 'centripetal');
  curve.arcLengthDivisions = Math.max(200, Math.ceil(pts.length * 8));   // (the arc-length table: fine enough for an even pace)
  // the lanes, metre by metre: curve.laneAt(s, dir, want) is how far from the middle a wagon going `dir` (+1 along the
  // road, -1 back; it keeps to its right) has its lane, `want` metres where there is room. Each side's room is how far
  // the road is clear to that side (looked at every half metre, out to ROAD.wide metres past ROAD.half) less the room a
  // wagon needs (ROAD.half), the least of it within ROAD.narrow metres either way, easing back out at ROAD.turn metres a
  // metre. Where one side is tight (a hitching rail by the road), that lane comes in toward the middle and the other
  // moves out, if it has room, to keep two wagons ROAD.pass apart; where there isn't room for both
  // (curve.narrowAt(s): a thicket on a forest path) they share one way, and src/traffic.js has a wagon wait short of
  // it for one coming the other way to come through.
  if (W.blocked) {
    const L = curve.getLength(), N = Math.floor(L) + 1, capP = new Float32Array(N).fill(ROAD.wide), capM = new Float32Array(N).fill(ROAD.wide);
    const P = new THREE.Vector3(), T = new THREE.Vector3();
    const reach = (x, z, nx, nz) => { let k = 0; while (k < ROAD.wide + ROAD.half && !W.blocked(x + nx * (k + 0.25), z + nz * (k + 0.25))) k += 0.25; return k; };
    for (let h = 0; h < 2 * N; h++) {
      const u = Math.min(1, h / 2 / L); curve.getPointAt(u, P); curve.getTangentAt(u, T);
      const n = Math.hypot(T.x, T.z) || 1, nx = T.z / n, nz = -T.x / n, d = h >> 1;
      capP[d] = Math.min(capP[d], reach(P.x, P.z, nx, nz) - ROAD.half); capM[d] = Math.min(capM[d], reach(P.x, P.z, -nx, -nz) - ROAD.half);
    }
    for (const cap of [capP, capM]) {
      const raw = Float32Array.from(cap);
      for (let d = 0; d < N; d++) for (let j = Math.max(0, d - ROAD.narrow); j <= Math.min(N - 1, d + ROAD.narrow); j++) if (raw[j] < cap[d]) cap[d] = raw[j];
      for (let d = 1; d < N; d++) cap[d] = Math.min(cap[d], cap[d - 1] + ROAD.turn);
      for (let d = N - 2; d >= 0; d--) cap[d] = Math.min(cap[d], cap[d + 1] + ROAD.turn);
    }
    const lerp = (a, s) => { const i = Math.max(0, Math.min(N - 1, s)), j = Math.floor(i), k = Math.min(N - 1, j + 1); return a[j] + (a[k] - a[j]) * (i - j); };
    // both lanes at s: [the way along's (on the road's -normal side), the way back's (+normal)]
    const lanes = (s, want) => {
      const cM = lerp(capM, s), cP = lerp(capP, s);
      let m = Math.min(want, cM), p = Math.min(want, cP);
      if (m + p < ROAD.pass) { if (cP - p > cM - m) p = Math.min(cP, ROAD.pass - m); else m = Math.min(cM, ROAD.pass - p); }
      return [m, p];
    };
    curve.laneAt = (s, dir = 1, want = 1.3) => lanes(s, want)[dir > 0 ? 0 : 1];
    curve.narrowAt = (s, want = 1.3) => { const [m, p] = lanes(s, want); return m + p < ROAD.pass - 0.05; };
    // the one-way stretches as [from, to] metres along: each run of narrow road and ROAD.oneWay metres more at either
    // end (so a wagon waiting outside one stands where two can pass), runs closer together than that joined into one
    curve.narrows = [];
    for (let d = 0; d < N; d++) {
      if (!curve.narrowAt(d)) continue;
      const a = Math.max(0, d - ROAD.oneWay), b = Math.min(L, d + ROAD.oneWay), last = curve.narrows[curve.narrows.length - 1];
      if (last && a <= last[1] + ROAD.oneWay) last[1] = b; else curve.narrows.push([a, b]);
    }
  }
  return curve;
}

// ── WHERE THE WAGONS STAND (for the player, the horse and the chickens) ───────────────────────────────────────────
// Every wagon made and not yet put away (the town's traffic and the "Protect the wagon" job's), each with two boxes on
// the ground (its .boxes, kept up to date as it moves): the wagon itself, and its team from the front axle to the lead
// horses' noses. A box: { x, z (its middle), s, c (the sine and cosine of the way it faces), hw, hl (half its width and
// half its length) }.
export const WAGONS_OUT = new Set();
const inBox = (b, x, z, r) => { const dx = x - b.x, dz = z - b.z, lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c; return Math.abs(lx) < b.hw + r && Math.abs(lz) < b.hl + r; };
// true where a walker r metres round at (x, z) would be inside a wagon or its team
export function inWagons(x, z, r = 0) {
  for (const G of WAGONS_OUT) if (G.boxes && Math.abs(x - G.pos.x) < 14 && Math.abs(z - G.pos.z) < 14) for (const b of G.boxes) if (inBox(b, x, z, r)) return true;
  return false;
}
// a walker r metres round standing at (x, z) inside a wagon or its team: the nearest place just outside it (out the
// side it is nearest, else the next nearest, and so on: never into a wall, W.blocked, or another wagon), or null when it
// isn't inside one (or there is no way out: then it is left where it is, free to walk out itself, never trapped)
export function pushFromWagons(x, z, r, W = null) {
  if (!WAGONS_OUT.size) return null;
  for (const G of WAGONS_OUT) {
    if (!G.boxes || Math.abs(x - G.pos.x) > 14 || Math.abs(z - G.pos.z) > 14) continue;
    for (const b of G.boxes) {
      const dx = x - b.x, dz = z - b.z, lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
      const px = b.hw + r - Math.abs(lx), pz = b.hl + r - Math.abs(lz);
      if (px <= 0 || pz <= 0) continue;
      const sx = lx < 0 ? -1 : 1, sz = lz < 0 ? -1 : 1, e = 0.02;
      const ways = [[px, sx * (b.hw + r + e), lz], [pz, lx, sz * (b.hl + r + e)], [b.hw + r + Math.abs(lx), -sx * (b.hw + r + e), lz], [b.hl + r + Math.abs(lz), lx, -sz * (b.hl + r + e)]]
        .sort((p, q) => p[0] - q[0]);
      for (const [, ox, oz] of ways) {
        const nx = b.x + ox * b.c + oz * b.s, nz = b.z - ox * b.s + oz * b.c;
        if (W && W.blocked(nx, nz)) continue;
        let other = false;
        for (const H of WAGONS_OUT) if (H.boxes) for (const q of H.boxes) if (q !== b && inBox(q, nx, nz, r)) other = true;
        if (!other) return { x: nx, z: nz };
      }
      return null;
    }
  }
  return null;
}

// ── ONE WAGON ──────────────────────────────────────────────────────────────────────────────────────────────────────
let made = 0;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const Z = new THREE.Vector3(0, 0, 1);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function makeWagon(lib, { kind = 'covered', W = null, team = true, driver = true, look = null, shadows = true } = {}) {
  const K = lib.kinds[kind];
  if (!K) throw new Error(lib.info.kinds[kind] ? `wagon ${kind} is not loaded yet (lib.need('${kind}'))` : 'no such wagon: ' + kind);
  const info = K.info, number = made++;
  const root = new THREE.Group(); root.name = 'wagon:' + kind;
  const body = new THREE.Group(); body.name = 'wagon body'; root.add(body);
  const shade = (m) => { m.castShadow = shadows; m.receiveShadow = shadows; return m; };
  body.add(shade(new THREE.Mesh(K.body.geometry, K.body.material)));

  // the wheels: each on a holder at its hub (a right-hand wheel turned round, so its cap faces out), spinning inside it
  const wheels = [];
  const piv = info.tongue ? info.tongue.pivot : [0, (info.wheels.FL.y + info.wheels.FR.y) / 2, (info.wheels.FL.z + info.wheels.FR.z) / 2];
  const fore = new THREE.Group(); fore.name = 'front axle'; fore.position.fromArray(piv); body.add(fore);
  for (const id of ['FL', 'FR', 'BL', 'BR']) {
    const w = info.wheels[id], front = id[0] === 'F', left = id[1] === 'L';
    const holder = new THREE.Group(); holder.name = 'wheel ' + id;
    if (front) holder.position.set(w.x, w.y - piv[1], w.z - piv[2]); else holder.position.set(w.x, w.y, w.z);
    if (!left) holder.rotation.y = Math.PI;
    const spin = shade(new THREE.Mesh(lib.wheel.geometry, lib.wheel.material)); spin.scale.setScalar(w.r);
    holder.add(spin); (front ? fore : body).add(holder);
    wheels.push({ id, front, side: left ? 1 : -1, x: w.x, z: w.z, r: w.r, spin, at: null });
  }
  // the tongue (the wagon's own pole, from its front axle forward), swung with the front wheels, lifted to the neck yoke
  // and stretched to reach it (the models' poles stop short of where a team stands)
  const pole = new THREE.Group(); pole.name = 'tongue'; fore.add(pole);
  if (K.tongue) pole.add(shade(new THREE.Mesh(K.tongue.geometry, K.tongue.material)));
  const H = lib.harness;
  const tree = shade(new THREE.Mesh(H.tree, H.wood)); tree.position.set(0, 0.06, WAGON.tree); fore.add(tree);

  // the seats and the bed
  const seats = { driver: new THREE.Object3D(), beside: new THREE.Object3D() };
  seats.driver.position.set(WAGON.driverAt, info.seat.y, info.seat.z); seats.beside.position.set(WAGON.besideAt, info.seat.y, info.seat.z);
  const cargo = new THREE.Object3D(); cargo.name = 'cargo'; cargo.position.set(0, info.cargo.y, info.cargo.z);
  body.add(seats.driver, seats.beside, cargo);

  // the team
  const horses = [];
  if (team && lib.animals && lib.animals.kinds[lib.horse]) {
    for (const side of [1, -1]) {
      const h = makeAnimal(lib.animals, lib.horse, { shadows });
      const c = shade(new THREE.Mesh(H.collar, H.leather));
      c.position.set(WAGON.collar.x, h.height * WAGON.collar.up, h.length * WAGON.collar.fwd); c.rotation.x = WAGON.collar.tilt; h.root.add(c);
      // (hung on the neck bone where it sits now, so it rides the neck's bob through the walk instead of sinking into it)
      // (measured on the walk's first frame, the pose the place was set by eye on, not on the Idle the horse starts in)
      if (h.bones.Neck) {
        if (h.play('Walk', { fade: 0 })) h.update(0);
        h.root.updateMatrixWorld(true); h.bones.Neck.attach(c);
      }
      h.side = side; root.add(h.root); horses.push(h);
    }
  }
  // the driver
  let person = null;
  if (driver && lib.folk) {
    const L = look || WAGON.drivers[number % WAGON.drivers.length];
    person = makePerson(lib.folk, { ...L, shadows });
    person.root.position.set(WAGON.driverAt, info.seat.y - WAGON.seatDrop, info.seat.z);
    if (!person.play('Drive', { fade: 0 })) person.play('Idle', { fade: 0 });
    body.add(person.root);
  }
  // the straps: four traces (two a horse) and two reins
  const straps = horses.length ? new THREE.InstancedMesh(H.strap, H.leather, 6) : null;
  if (straps) { straps.frustumCulled = false; straps.castShadow = false; root.add(straps); }

  const halfWheel = Math.abs(info.wheels.FL.z - info.wheels.BL.z) / 2;           // half the distance between the axles
  const track = (Math.abs(info.wheels.FL.x - info.wheels.FR.x) + Math.abs(info.wheels.BL.x - info.wheels.BR.x)) / 2;
  const hl = horses.length ? horses[0].length : 0;
  const G = {
    root, body, kind, info, seats, cargo, team: horses, driver: person,
    speed: 0, pace: 0, u: 0, t: 0, dir: 1, heading: 0, ended: false, lane: 0,
    pos: new THREE.Vector3(), front: new THREE.Vector3(),
    length: Math.max(info.box.max[2], piv[2] + (horses.length ? WAGON.ahead + hl / 2 : (info.tongue ? info.tongue.tip : 0))) - info.box.min[2],
    nose: Math.max(info.box.max[2], piv[2] + (horses.length ? WAGON.ahead + hl / 2 : (info.tongue ? info.tongue.tip : 0))),
    tail: -info.box.min[2],
    width: Math.max(info.box.max[0] - info.box.min[0], track + 0.3, horses.length ? WAGON.gap + horses[0].info.width : 0),
    curve: null, L: 0,
    boxes: null,
  };
  // its two boxes on the ground (see WAGONS_OUT): the wagon (its model's own size), and the team with the tongue and
  // the doubletree, from just in front of the front axle to the lead horses' noses
  const bx = (info.box.min[0] + info.box.max[0]) / 2, bz = (info.box.min[2] + info.box.max[2]) / 2;
  const boxBody = { x: 0, z: 0, s: 0, c: 1, hw: (info.box.max[0] - info.box.min[0]) / 2, hl: (info.box.max[2] - info.box.min[2]) / 2 };
  const back = WAGON.ahead - WAGON.tree;   // (from the horses' middles back to the doubletree)
  const boxTeam = horses.length ? { x: 0, z: 0, s: 0, c: 1, hw: (WAGON.gap + horses[0].info.width) / 2, hl: (hl / 2 + back) / 2 } : null;
  G.boxes = boxTeam ? [boxBody, boxTeam] : [boxBody];
  WAGONS_OUT.add(G);
  let tilt = { pitch: 0, roll: 0, first: true }, steer = 0;

  // a point on the path s metres along (past either end: straight on from the end, along its direction)
  // (and out to the right of the way it is going by its lane)
  const tmpT = new THREE.Vector3();
  // (where the road is tight, its lane comes in toward the middle, or moves out: the curve's laneAt, from roadCurve)
  function at(s, out) {
    const C = G.curve, L = G.L, lane = G.lane && C.laneAt ? C.laneAt(s, G.dir, G.lane) : G.lane;
    if (s <= 0) { C.getPointAt(0, out); C.getTangentAt(0, tmpT); out.addScaledVector(tmpT, s); }
    else if (s >= L) { C.getPointAt(1, out); C.getTangentAt(1, tmpT); out.addScaledVector(tmpT, s - L); }
    else { C.getPointAt(s / L, out); if (lane) C.getTangentAt(s / L, tmpT); }
    if (lane) { out.x -= tmpT.z * G.dir * lane; out.z += tmpT.x * G.dir * lane; }
    return out;
  }
  function dirAt(s, out) { G.curve.getTangentAt(Math.min(1, Math.max(0, s / G.L)), out); if (G.dir < 0) out.negate(); return out; }

  G.setPath = (curve, { at: t = 0, dir = 1 } = {}) => {
    G.curve = curve; G.L = curve.getLength(); G.dir = dir < 0 ? -1 : 1;
    G.u = Math.min(G.L, Math.max(0, t * G.L)); G.ended = false; tilt.first = true;
    for (const w of wheels) w.at = null;
    place(0);
    return G;
  };
  G.stop = () => { G.speed = 0; };
  G.go = (v = 2) => { G.speed = v; G.ended = false; };

  const ground = (x, z) => (W ? W.heightAt(x, z) : 0);
  const Pf = new THREE.Vector3(), Pr = new THREE.Vector3(), Ph = new THREE.Vector3(), Dh = new THREE.Vector3(), Y = new THREE.Vector3();
  // put everything where the path says for G.u (dt: the frame's time, for the wheels' turn and the tilt's give)
  function place(dt) {
    const half = halfWheel, d = G.dir;
    at(G.u + d * half, Pf); at(G.u - d * half, Pr);
    const heading = Math.atan2(Pf.x - Pr.x, Pf.z - Pr.z); G.heading = heading;
    const s = Math.sin(heading), c = Math.cos(heading);
    G.pos.set((Pf.x + Pr.x) / 2, 0, (Pf.z + Pr.z) / 2);
    // the ground under the four wheels: the body sits on the plane through them (pitch from front to back, roll from
    // side to side)
    let hF = 0, hB = 0, hL = 0, hR = 0;
    for (const w of wheels) {
      const wx = G.pos.x + w.x * c + w.z * s, wz = G.pos.z - w.x * s + w.z * c, h = ground(wx, wz);
      if (w.front) hF += h / 2; else hB += h / 2;
      if (w.side > 0) hL += h / 2; else hR += h / 2;
    }
    const pitch = Math.atan2(hF - hB, 2 * half), roll = Math.atan2(hL - hR, track);
    const k = tilt.first || !dt ? 1 : 1 - Math.exp(-dt / WAGON.settle);
    tilt.pitch += (pitch - tilt.pitch) * k; tilt.roll += (roll - tilt.roll) * k; tilt.first = false;
    G.pos.y = (hF + hB) / 2;
    body.position.copy(G.pos);
    body.rotation.set(-tilt.pitch, heading, tilt.roll, 'YXZ');
    body.updateMatrixWorld(true);

    // the team: their middles on the path ahead of the front axle, side by side, facing along it, tipped with the ground
    const uh = G.u + d * (half + WAGON.ahead);
    at(uh, Ph); dirAt(uh, Dh);
    const hh = Math.atan2(Dh.x, Dh.z), hs = Math.sin(hh), hc = Math.cos(hh);
    for (const h of horses) {
      const x = Ph.x + hc * h.side * WAGON.gap / 2, z = Ph.z - hs * h.side * WAGON.gap / 2;
      const fy = ground(x + hs * 0.9, z + hc * 0.9), by = ground(x - hs * 0.9, z - hc * 0.9);
      h.root.position.set(x, (fy + by) / 2, z);
      h.root.rotation.set(-Math.atan2(fy - by, 1.8), hh, 0, 'YXZ');
    }
    G.front.set(Ph.x + hs * hl / 2, Ph.y, Ph.z + hc * hl / 2);
    boxBody.x = G.pos.x + bx * c + bz * s; boxBody.z = G.pos.z - bx * s + bz * c; boxBody.s = s; boxBody.c = c;
    if (boxTeam) { const m = (hl / 2 - back) / 2; boxTeam.x = Ph.x + hs * m; boxTeam.z = Ph.z + hc * m; boxTeam.s = hs; boxTeam.c = hc; }
    if (!horses.length) G.front.set(Pf.x + s * (info.tongue ? info.tongue.tip : 0.5), Pf.y, Pf.z + c * (info.tongue ? info.tongue.tip : 0.5));

    // the front wheels and the tongue: pointed at the neck yoke (between the horses' chests)
    const yx = Ph.x + hs * WAGON.yoke, yz = Ph.z + hc * WAGON.yoke;
    fore.updateMatrixWorld(true); fore.getWorldPosition(Y);
    const want = horses.length ? wrap(Math.atan2(yx - Y.x, yz - Y.z) - heading) : wrap(Math.atan2(Dh.x, Dh.z) - heading);
    steer = Math.max(-WAGON.steerMost, Math.min(WAGON.steerMost, want));
    fore.rotation.y = steer;
    if (K.tongue && horses.length) {
      const flat = Math.hypot(yx - Y.x, yz - Y.z), up = ground(yx, yz) + WAGON.yokeUp - Y.y;
      pole.rotation.x = -(Math.atan2(up, flat) - tilt.pitch);
      pole.scale.z = Math.max(1, Math.hypot(flat, up) / info.tongue.tip);
    }

    // the wheels turn by how far each one rolled since the last frame (along the way it points)
    const fs = Math.sin(heading + steer), fc = Math.cos(heading + steer);
    for (const w of wheels) {
      let wx, wz;
      if (w.front) { const rx = w.x, rz = w.z - piv[2]; wx = Y.x + rx * fc + rz * fs; wz = Y.z - rx * fs + rz * fc; }
      else { wx = G.pos.x + w.x * c + w.z * s; wz = G.pos.z - w.x * s + w.z * c; }
      if (w.at && dt) {
        const dx = wx - w.at[0], dz = wz - w.at[1], roll = w.front ? dx * fs + dz * fc : dx * s + dz * c;
        w.spin.rotation.x += w.side * roll / w.r;
      }
      w.at = w.at || [0, 0]; w.at[0] = wx; w.at[1] = wz;
    }
    G.t = G.L ? G.u / G.L : 0;
  }

  // a strap from a to b (world), as instance i
  const up = new THREE.Vector3(0, 1, 0);
  function strapTo(i, a, b, w = 0.035, t = 0.012) {
    _d.subVectors(b, a); const len = _d.length() || 1e-3; _d.divideScalar(len);
    _q.setFromUnitVectors(Z, _d); _s.set(w, t, len);
    _m.compose(a, _q, _s); straps.setMatrixAt(i, _m);
  }
  function harness() {
    if (!straps) return;
    // the traces: from the singletree's ends (each horse's own, either side of it) to its collar's sides
    tree.updateMatrixWorld(true);
    let i = 0;
    for (const h of horses) {
      h.root.updateMatrixWorld(true);
      for (const s of [1, -1]) {
        _a.set(h.side * WAGON.gap / 2 + s * 0.34, 0, 0.09).applyMatrix4(tree.matrixWorld);
        _b.set(s * h.info.width * 0.42, h.height * 0.72, h.length * 0.24).applyMatrix4(h.root.matrixWorld);
        strapTo(i++, _a, _b);
      }
    }
    // the reins: from the driver's fists to each horse's head
    if (person && person.bones.Middle1L && person.bones.Middle1R) {
      for (const h of horses) {
        const hand = h.side > 0 ? person.bones.Middle1L : person.bones.Middle1R;
        hand.getWorldPosition(_a);
        const hb = h.bones[h.info.head] || h.bones.Head;
        hb.getWorldPosition(_b); _c.fromArray(WAGON.bit).applyQuaternion(h.root.quaternion); _b.add(_c);
        strapTo(i++, _a, _b, 0.022, 0.008);
      }
    } else for (; i < 6; i++) { _m.makeScale(0, 0, 0); straps.setMatrixAt(i, _m); }
    straps.instanceMatrix.needsUpdate = true;
  }

  G.update = (dt) => {
    if (!G.curve) return;
    // ease toward the wanted speed
    const want = G.ended ? 0 : Math.max(0, G.speed);
    if (G.pace < want) G.pace = Math.min(want, G.pace + WAGON.accel * dt); else G.pace = Math.max(want, G.pace - WAGON.brake * dt);
    G.u += G.dir * G.pace * dt;
    const lo = halfWheel, hi = G.L - halfWheel - (horses.length ? WAGON.ahead + hl / 2 : 0);
    if (G.dir > 0 && G.u >= hi) { G.u = hi; G.ended = true; G.pace = 0; }
    if (G.dir < 0 && G.u <= lo + (horses.length ? WAGON.ahead + hl / 2 : 0)) { G.u = lo + (horses.length ? WAGON.ahead + hl / 2 : 0); G.ended = true; G.pace = 0; }
    place(dt);
    for (const h of horses) {
      // walking (sped up) at a wagon's usual paces; a gallop only when it really runs (gaitFor's own switch is lower)
      if (G.pace >= 0.05 && G.pace < WAGON.walkMost) h.play('Walk', { speed: G.pace / h.stride.Walk });
      else h.pace(G.pace);
      h.update(dt);
    }
    if (person) {
      // the driver's jog keeps time with the team's steps (the clip is two of the horses' Walk steps long)
      const walk = horses.length ? horses[0].stride.Walk : 1;
      if (person.person && person.person.cur) person.person.cur.setEffectiveTimeScale(Math.max(0.25, Math.min(2.5, G.pace / walk)));
      person.update(dt);
    }
    root.updateMatrixWorld(true);
    harness();
  };
  G.dispose = () => {
    WAGONS_OUT.delete(G);
    for (const h of horses) h.dispose();
    if (person) person.dispose && person.dispose();
    if (straps) straps.dispose();
    root.removeFromParent();
  };
  return G;
}
