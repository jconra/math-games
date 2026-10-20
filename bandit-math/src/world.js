// THE WORLD: the game's wrapper over the valley (world/valley.js, a copy of the Terrain Lab's world from jconra.com):
// the land, its water, trees, plants, sky and time of day, with the little western town (cabin, stable, general store,
// sheriff's office, saloon, and an open-air stage), the dirt trail out to the pasture and the fenced corral beside it.
// The game only talks to it here.
//
//   const W = await makeWorld({ renderer, camera, quality, look, onProgress })
//     renderer: the game's THREE.WebGLRenderer (its pixel ratio and tone mapping are set here, for the tier);
//     camera: the game's PerspectiveCamera (moved by the game; placed at the spawn while the world loads; its far plane
//       pushed out to 5 km if it was nearer, since the sky is a dome 4.5 km round: the Terrain Lab's camera is 55 deg, 0.1 to 5000);
//     quality: 'potato' | 'normal' | 'gaming', or chooseTier()'s answer (world/quality.js), or nothing (picked here: ?q= in
//       the address, else the machine's own);
//     look: 'green' (the Terrain Lab as it is) or 'summer' (the meadows a little drier and more golden, the forests green);
//     onProgress(p, text): how far the loading is, 0..1, and what it is doing, for the title screen;
//     wait (default true): resolve only once the trees and plants are laid and baked and the shaders built, so the first
//       frame of play is smooth; false: resolve as soon as the land is laid (then call W.update each frame until W.settled())
//     live (for the bake rig only): the land worked out here and now, not read from its bake (models/town/land): slow
//   W.scene      the valley's scene (sky, sun, haze): the game adds its own things to it
//   W.update(dt) each frame, after the game has placed the camera and W.camTarget
//   W.render()   draws the frame (and sets the renderer's exposure for the time of day)
//   W.heightAt(x, z)   the ground's height (m), the buildings' levelled pads included
//   W.waterAt(x, z)    how wet, 0..1 (over 0.3: in a stream or pond)
//   W.settled()        true once the trees and plants are laid and baked
//   W.blocked(x, z)    true where a walker can't go: a building (its footprint and half a metre round it), a fence, a tree's
//                      trunk, ground steeper than ~39 degrees (~58 by a creek or pond: a bank can be scrambled), water
//                      deeper than 0.9 m, or off the land's edge
//   W.addBlocker(fn)   fn(x, z) -> true also blocks there (the farm's fences and barn); returns a function that takes it off
//   W.places     where things are (metres; rot: radians, the way the thing faces: a front facing +z is 0, as three's
//                rotation.y, so the facing direction is (sin rot, cos rot)):
//                  spawn:   { x, z, rot }                      the square, facing the sheriff's office
//                  cabin, stable, store, sheriff, saloon, stage: { x, z, rot, door: { x, z }, size, w, d, h, kind }
//                           door: a spot on the ground just in front of the steps (the stage's: in front of its middle);
//                           size: the longest side; w, d, h: width (along its front), depth and height
//                           stage.crowd: { x, z, r }: the trodden patch in front of the stage where an audience stands
//                  buildings: [ the six above ] (for anything that must keep out of them all, the camera say)
//                  square:  { x, z, r }                         the dusty open square the buildings face
//                  pasture: { x, z, r }                         open meadow, where the cattle graze
//                  corral:  { x, z, r, w, d, rot, gate: { x, z, rot, width, in: { x, z }, out: { x, z } } }
//                           a fenced square w by d (r: a circle inside it); gate: the gap in the fence (rot: the way out; width: m),
//                           in / out: a few metres inside and outside it, for walking an animal through
//                  trail:   [[x, z], ...]                       the dirt trail from the square to the pasture
//                  farm:    { x, z, rot, r, w, d }              open, nearly flat ground north of the town (behind the
//                           cabin), where src/farm.js lays out the barn, the pens and the sheep pasture (its rot as
//                           the buildings': the farm's front, and its lane in, face the town)
//   THE TIME OF DAY (the Terrain Lab's sun, moving: a whole day in DAY_MIN minutes of play; nights bright, by a full moon):
//   W.hour       the clock, 0..24 (local sun time: 12 is noon; the sun is up from about 5:00 to 19:00, and it is fully
//                night from about 19:50 to 4:10, so about a third of the day is night: 8 minutes of play)
//   W.night      0 by day .. 1 at night, gradually through the dusk and the dawn (the sun from 3° up to 8° below the
//                horizon: about a minute of play): the lamps, the windows, the townsfolk going home all follow it
//   W.timeRuns   true: the clock goes on as the frames go by (W.update); false: it stands still (the title shows the morning)
//   W.setHour(h) the clock set to h at once (the land's light follows within a second or so)
//   W.dayStart   the hour each ride starts at (DAY_START, or ?hour=21 in the address)
//   W.lights.set(id, v), .get(id)   how lit a building's windows are at night, by its layout id ('saloon', 'home2',
//                'cabin'), 0..1 (eased over a second): the shops and homes 1, the player's cabin 0 (src/cabin lights it)
//   THE VALLEY'S ENDS: a bank of mist across each end (thin from W.ends.west.a / east.a metres out along x, full by .b);
//   riding on into it, at .wrap, the rider comes out of the other end's mist, riding back toward the town:
//   W.wrap(position, cameraAt)   null, or { x, z, dx, dy, dz, from } where a rider past a wrap line comes out (the game moves the
//                      rider, the horse, the camera and the dog by dx, dy, dz: src/main.js)
//   W.fogAt(x, z)      how thick the mist is there, 0..1 (things to fade into it, or keep out of it: camps, wagons)
//   W.roadEnds         set by the game: () -> { west: {x, z, dx, dz}, east: {...} } the road's two ends (dx, dz: the way
//                      out along it there), or null; a rider wrapping near one comes out by the other (on its line)
//   W.ends             { west, east: { a, b, wrap, floor, lo, hi (the band of walkable ground across the end) }, ... }
//   W.warmFor(root)   the shaders of things not in the scene yet built in the background, for the valley's lights
//   W.warm()     the scene's shaders not built yet built ahead, a couple a frame: done by itself a few seconds into the
//                ride, later, and in the mist before the way round; call it after adding new kinds of things
//   W.tier       'potato' | 'normal' | 'gaming'
//   W.camTarget  a THREE.Vector3 the game keeps on the player: the plants' and trees' circles and the sun's shadows
//                follow it (the valley reads it as its "controls target")
//   W.V          the valley itself (advanced use only: its tunings, maps and forests)
import * as THREE from 'three';
import { makeValley, TIER_SET } from '../world/valley.js';
import { BACKWOODS } from './missions/backwoods.js';
import { chooseTier, TIERS } from '../world/quality.js';
import { footprintOf } from '../world/objects/village.js';
import { BASE } from '../world/base.js';

// the buildings by the names the game uses
const PLACE_OF = { cabin: 'cabin', stable: 'stable', generalStore: 'store', sheriff: 'sheriff', saloon: 'saloon', stage: 'stage' };
// DEEP: the creeks' channels are carved 0.8 m deep (the west river's, the creek north of town): wadeable, by horse or on
// foot, so a creek can be crossed anywhere its banks allow, both ways (at 0.7 they blocked: a creek crossed where it ran
// shallow was a wall on the way back, and riding in looked like being stuck in the middle). The pond's middle, deeper
// than this, still stops a walker, at its own edge.
// BANK: right by a creek or a pond (within BANK_NEAR cells of its water), ground up to this steep can be scrambled down
// and up: the channels are carved with banks steeper than STEEP, and a creek with a low bank on one side and a steep one
// on the other let a walker down into it and not up the far side (stuck in the middle).
const BANK = 1.6, BANK_NEAR = 2;
const STEEP = 0.8, DEEP = 0.9, EDGE = 780, FENCE_HALF = 0.35, WALL_PAD = 0.5, TRUNK = 0.4;   // (slope as rise over run; metres; a trunk's radius for a tree of scale 1)
// THE VALLEY'S ENDS: the mist banks across them (the valley's FOG_DIR.bank0/1: thin from `a` metres out along x, full by
// `b`; topping out `top` metres over each end's floor) and the line in the full mist where a rider comes out of the
// other end's (`wrap`, inside the land's edge at EDGE). West -x, east +x (the valley's floor runs out west and south-east)
// m either side of the road's end (along z) within which a rider wrapping comes out by the other end of the road (W.wrap)
const WRAP_ROAD = 45;
const ENDS = { west: { a: 500, b: 680, wrap: 720 }, east: { a: 540, b: 700, wrap: 740 }, thick: 0.22, top: 70 };
// where a rider comes out of the mist: clear of the trees' crowns (CROWN m round a tree of scale 1) over them and the
// camera, WRAP_CLEAR m behind (W.wrap)
const CROWN = 5, WRAP_CLEAR = 12;
// THE DAY: minutes of play a whole day takes, and the hour a ride starts at (mid-morning, as the Terrain Lab opens)
const DAY_MIN = 24, DAY_START = 9 + 40 / 60;
const nightOf = (elev) => THREE.MathUtils.smoothstep(-elev, -3, 8);   // (0 with the sun 3° up or higher, 1 once it is 8° down)

// THE WAY INTO EACH BACK-WOODS CAMP: a strip kept clear of trees from just in front of each camp spot (its open side
// faces the town square: src/missions/loot.js) out CAMP_WAY.len m toward the square, so a rider riding up to one from
// the town's side, and the camera trailing behind, isn't in the leaves (crowns reaching within CAMP_WAY.half m of its
// line are left out, as along the east road's end: world/valley.js TREE_CLEAR)
const CAMP_WAY = { from: 3, len: 28, half: 1.5 };
function campWays(game) {
  const sq = game && (game.square || game.spawn); if (!sq || !Number.isFinite(+sq.x) || !Number.isFinite(+sq.z)) return [];
  return BACKWOODS.map((b) => {
    const dx = +sq.x - b.x, dz = +sq.z - b.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
    return { ax: b.x + ux * CAMP_WAY.from, az: b.z + uz * CAMP_WAY.from, bx: b.x + ux * CAMP_WAY.len, bz: b.z + uz * CAMP_WAY.len, half: CAMP_WAY.half };
  });
}

export async function makeWorld({ renderer, camera, quality = null, look = 'green', onProgress = () => {}, wait = true, live = false } = {}) {
  const say = (p, text) => { try { onProgress(p, text); } catch (e) { console.warn('world: onProgress threw', e); } };
  // THE TIER: as asked, else chosen from the address (?q=) or the machine
  const QUAL = typeof quality === 'string' && TIERS.includes(quality) ? { tier: quality, why: 'asked for', source: 'forced' }
    : quality && TIERS.includes(quality.tier) ? quality : chooseTier(renderer);
  const TS = TIER_SET[QUAL.tier];
  renderer.setPixelRatio(Math.min(devicePixelRatio, TS.ratio));       // (the tier's resolution: half on potato, double on gaming)
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  { const s = renderer.getSize(new THREE.Vector2()); renderer.setSize(s.x || innerWidth, s.y || innerHeight, false); }   // (the drawing buffer at the new ratio)
  // what the valley calls its controls: only the point it looks at is read (where the plants and the shadows gather)
  const camTarget = new THREE.Vector3();
  const controls = { target: camTarget, enabled: true, update() {}, addEventListener() {}, removeEventListener() {} };
  // the town's own data: the places that aren't buildings (the spawn, the square, the pasture, the corral) live in the
  // layout's `game` block, the trail in the planting (its stroke 'trail'); fetched here (the valley reads them too)
  const getJSON = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const layoutP = getJSON(BASE + 'models/town/layout.json');
  say(0.02, 'Riding into the valley');
  const t0 = performance.now();
  const GAME = ((await layoutP) || {}).game || {};
  const V = await makeValley({ renderer, camera, controls, quality: QUAL, look, live, slice: true, showcase: false, folk: false, treeClear: campWays(GAME) });
  say(0.45, 'The land is laid');

  // ── THE PLACES ─────────────────────────────────────────────────────────────────────────────────────────
  const places = {}, FOOT = [];
  for (const it of V.TOWN.village.layout.items) {
    if (it.type !== 'model') continue;
    const { w, d, h } = footprintOf(it), rot = it.rot * Math.PI / 180, c = Math.cos(rot), s = Math.sin(rot);
    FOOT.push({ x: it.x, z: it.z, c, s, hw: w / 2 + WALL_PAD, hd: d / 2 + WALL_PAD });
    const name = PLACE_OF[it.kind]; if (!name || places[name]) continue;
    const out = d / 2 + 1.5;                                             // (just past the steps, in front of the middle)
    places[name] = { kind: it.kind, x: it.x, z: it.z, rot, door: { x: it.x + s * out, z: it.z + c * out }, size: Math.max(w, d), w, d, h };
  }
  const xz = (p, rot = false) => (p ? { x: +p.x || 0, z: +p.z || 0, ...(rot ? { rot: (+p.rot || 0) * Math.PI / 180 } : {}) } : null);
  places.spawn = xz(GAME.spawn, true) || { x: 0, z: 0, rot: 0 };
  places.square = GAME.square ? { ...xz(GAME.square), r: +GAME.square.r || 15 } : { ...places.spawn, r: 15 };
  places.pasture = GAME.pasture ? { ...xz(GAME.pasture), r: +GAME.pasture.r || 30 } : null;
  if (GAME.corral) {   // a w x d square turned by rot (degrees in the file), its gate a gap in the side named by gate.side
    const C = GAME.corral, rot = (+C.rot || 0) * Math.PI / 180, c = Math.cos(rot), s = Math.sin(rot), at = (lx, lz) => ({ x: C.x + c * lx + s * lz, z: C.z - s * lx + c * lz });
    const g = C.gate || { side: '+z', at: 0 }, out = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[g.side] || [0, 1];
    const half = out[0] ? C.w / 2 : C.d / 2, along = g.at || 0, gx = out[0] ? out[0] * half : along, gz = out[1] ? out[1] * half : along;
    const gate = { ...at(gx, gz), rot: Math.atan2(c * out[0] + s * out[1], -s * out[0] + c * out[1]), width: +g.width || 4, in: at(gx - out[0] * 4, gz - out[1] * 4), out: at(gx + out[0] * 4, gz + out[1] * 4) };
    places.corral = { x: C.x, z: C.z, r: Math.min(C.w, C.d) / 2 - 1, w: C.w, d: C.d, rot, gate };
  }
  if (places.stage && GAME.crowd) places.stage.crowd = { ...xz(GAME.crowd), r: +GAME.crowd.r || 5 };
  Object.defineProperty(places, 'buildings', { value: Object.values(PLACE_OF).map((k) => places[k]).filter(Boolean), enumerable: false });   // (not enumerable: a loop over the places still meets each building once)
  const trail = (V.PLANTING_FIRST && V.PLANTING_FIRST.strokes || []).find((st) => st.id === 'trail');
  places.trail = trail ? trail.pts.map(([x, z]) => [x, z]) : [];
  // the farm: a spot picked from a survey of the land (height within about 2.5 m over its 56 by 48 m, no water, no
  // trees, clear of the trail, the corral and the pasture); the layout's `game.farm` can move it
  places.farm = GAME.farm ? { ...xz(GAME.farm, true), r: +GAME.farm.r || 34, w: +GAME.farm.w || 56, d: +GAME.farm.d || 48 }
    : { x: -6, z: -278, rot: 0, r: 34, w: 56, d: 48 };

  // ── WHERE A WALKER CAN'T GO ────────────────────────────────────────────────────────────────────────────
  const segNear = (x, z, ax, az, bx, bz, r) => { const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1e-9, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)), dx = ax + vx * t - x, dz = az + vz * t - z; return dx * dx + dz * dz < r * r; };
  // the trees' trunks, in 8 m squares (made again if the forest is ever laid again)
  const TREES = { of: null, cells: new Map() };
  function trunks() {
    const f = V.treeForest; if (TREES.of === f) return TREES.cells; TREES.of = f; TREES.cells.clear();
    for (const t of (f && f.fixed) || []) { const k = Math.floor(t.x / 8) + ',' + Math.floor(t.z / 8); let c = TREES.cells.get(k); if (!c) TREES.cells.set(k, c = []); c.push([t.x, t.z, TRUNK * (t.scale || 1)]); }
    return TREES.cells;
  }
  // the creeks' and ponds' banks: the cells within BANK_NEAR of water (made the first time it's asked)
  let banks = null;
  function bankAt(k) {
    if (!banks) {
      const N = V.N, D = V.WDEPTH; banks = new Uint8Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (D[j * N + i] > 0.2)
        for (let dj = -BANK_NEAR; dj <= BANK_NEAR; dj++) for (let di = -BANK_NEAR; di <= BANK_NEAR; di++) { const a = i + di, b = j + dj; if (a >= 0 && a < N && b >= 0 && b < N) banks[b * N + a] = 1; }
    }
    return banks[k] === 1;
  }
  // more things that block, added by the game after the world is made (the farm's fences and barn): W.addBlocker(fn),
  // fn(x, z) -> true where a walker can't go
  const EXTRA = [];
  function blocked(x, z) {
    if (!(Math.abs(x) < EDGE && Math.abs(z) < EDGE)) return true;
    for (let i = 0; i < EXTRA.length; i++) if (EXTRA[i](x, z)) return true;
    { const cells = trunks(), ci = Math.floor(x / 8), cj = Math.floor(z / 8);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const c = cells.get((ci + di) + ',' + (cj + dj)); if (c) for (const [tx, tz, r] of c) if ((x - tx) ** 2 + (z - tz) ** 2 < r * r) return true; } }
    for (const b of FOOT) { const dx = x - b.x, dz = z - b.z; if (Math.abs(b.c * dx - b.s * dz) < b.hw && Math.abs(b.s * dx + b.c * dz) < b.hd) return true; }
    for (const [p, q] of V.FENCE.rails || []) if (segNear(x, z, p[0], p[2], q[0], q[2], FENCE_HALF)) return true;
    const i = Math.min(V.N - 1, Math.max(0, Math.floor((x + V.SIZE / 2) / V.TEX))), j = Math.min(V.N - 1, Math.max(0, Math.floor((z + V.SIZE / 2) / V.TEX)));
    if (V.inFine && V.inFine(x, z)) {   // (where the ground is drawn finer than its grid, the bridge crossing's ravine and ford: its own slope, and no scrambling down a bank there)
      const e = 0.6, gx = V.heightAt(x + e, z) - V.heightAt(x - e, z), gz = V.heightAt(x, z + e) - V.heightAt(x, z - e);
      if (Math.hypot(gx, gz) / (2 * e) > STEEP) return true;
    } else { const sl = V.slopeAt(i, j); if (sl > STEEP && (sl > BANK || !bankAt(j * V.N + i))) return true; }
    if (V.WDEPTH[j * V.N + i] > DEEP && V.waterAt(x, z) > 0.3) return true;
    return false;
  }

  const W = {
    scene: V.scene, V, tier: QUAL.tier, quality: QUAL, look, camTarget, places, blocked,
    addBlocker: (fn) => { EXTRA.push(fn); return () => { const i = EXTRA.indexOf(fn); if (i >= 0) EXTRA.splice(i, 1); }; },
    heightAt: V.heightAt, waterAt: V.waterAt, settled: V.settled,
    update: (dt) => { V.update(Math.min(dt, 0.1)); warmLater(dt); },   // (a long pause, a tab come back, counts as a tenth of a second)
    render: () => V.render(),
    loadedIn: 0,                                                         // (seconds to settled, for the record)
    dayStart: (() => { const q = new URLSearchParams(location.search), h = parseFloat(q.get('hour')); return Number.isFinite(h) ? ((h % 24) + 24) % 24 : DAY_START; })(),   // (?hour=21 in the address: start there, to see the night)
    // the town's lit windows at night (world/objects/nightLights.js): how lit a building is, by its layout id ('saloon',
    // 'home2', 'cabin'), 0..1, eased over a second; the shops and the homes 1, the player's cabin 0 until it is lit
    lights: { set: (id, v) => V.NIGHT_LIGHTS.set(id, v), get: (id) => V.NIGHT_LIGHTS.get(id) },
    setHour: (h) => { const D = V.DAY; h = ((+h % 24) + 24) % 24; if (!Number.isFinite(h)) return; D.hour = D.t = h; D.dirty = true; D.reshade = true; },
  };
  // ── THE VALLEY'S ENDS: the mist and the way round ──────────────────────────────────────────────────────
  // each end's floor (the lowest ground across it, near the wrap line) and the band of ground a rider can be on there
  // (the run of walkable ground round the floor), so a rider coming out of the other end's mist comes out at the same
  // share of the way across it
  for (const [k, E] of Object.entries(ENDS)) {
    if (k === 'thick' || k === 'top') continue;
    const sx = k === 'west' ? -1 : 1, x = sx * (E.wrap - 3);
    let low = null; for (let z = -760; z <= 760; z += 4) { const h = V.heightAt(x, z); if (!low || h < low.h) low = { z, h }; }
    const ok = (z) => !blocked(x, z) && V.heightAt(x, z) < low.h + 60;
    let lo = low.z, hi = low.z; while (lo - 2 > -770 && ok(lo - 2)) lo -= 2; while (hi + 2 < 770 && ok(hi + 2)) hi += 2;
    Object.assign(E, { side: sx, floor: low.h, floorZ: low.z, lo, hi });
  }
  { const B = V.FOG_DIR.bank0, B1 = V.FOG_DIR.bank1;
    B.x = ENDS.west.a; B.y = ENDS.west.b; B.z = ENDS.east.a; B.w = ENDS.east.b;
    B1.x = ENDS.thick; B1.y = ENDS.west.floor + ENDS.top; B1.z = ENDS.east.floor + ENDS.top; B1.w = 1; }
  // how thick the mist is at a spot, 0 (none) .. 1 (full): for things that should fade into it, or keep out of it
  W.fogAt = (x, z = 0) => { const E = x < 0 ? ENDS.west : ENDS.east, u = Math.abs(x); return Math.min(1, Math.max(0, (u - E.a) / (E.b - E.a))); };
  W.ends = ENDS;
  // how clear of the trees' crowns a spot is (m to spare, below 0: under one), along the stretch from it WRAP_CLEAR m
  // out toward the land's edge (sx: that way along x), where the camera follows a rider riding in
  // (sz: that way along z too, for a stretch on a slant: out along the road past its end)
  function crownClear(x, z, sx, sz = 0) {
    const cells = trunks(); let worst = Infinity;
    const l = Math.hypot(sx, sz) || 1, ux = sx / l, uz = sz / l;
    for (let u = 0; u <= WRAP_CLEAR; u += 3) {
      const px = x + ux * u, pz = z + uz * u, ci = Math.floor(px / 8), cj = Math.floor(pz / 8);
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const c = cells.get((ci + di) + ',' + (cj + dj)); if (c) for (const [tx, tz, r] of c) worst = Math.min(worst, Math.hypot(px - tx, pz - tz) - CROWN * r / TRUNK - 1.5); }
    }
    return worst;
  }
  // THE WAY ROUND: a spot past an end's wrap line -> where it comes out at the other end, just inside that end's line
  // (deep in its mist too, so nothing seen changes), the same share of the way across the valley there, on ground a
  // walker can stand on: { x, z, dx, dy, dz } (dy: the ground's change), or null where it doesn't
  W.crownClear = crownClear;   // (rigs: how clear of the crowns a spot and the stretch behind it are)
  W.wrap = (p, cam = null) => {   // (cam: where the camera is now: the stretch kept clear is the way it trails the rider)
    const x = p.x, z = p.z, from = x <= -ENDS.west.wrap ? ENDS.west : x >= ENDS.east.wrap ? ENDS.east : null; if (!from) return null;
    const to = from === ENDS.west ? ENDS.east : ENDS.west, past = Math.abs(x) - from.wrap;
    let nx = to.side * (to.wrap - 0.5 - past);
    const t = Math.min(1, Math.max(0, (z - from.lo) / Math.max(1, from.hi - from.lo)));
    let want = to.lo + t * (to.hi - to.lo), back = [to.side, 0], road = null;   // (back: the way the camera trails the rider; road: spots by the other road end)
    // (riding on along the road through the valley, past its end in the mist: out by the other end of the road, as far
    // to the side of it as before, so the rider comes out on the road and rides it back to town. The road can run out
    // of the band of ground the share is worked across: the west road ends north of it)
    const R = typeof W.roadEnds === 'function' ? W.roadEnds() : null;
    if (R && R.west && R.east) {
      // (each road end's line carried on out the way the road was going: how far the rider is to the side of it, at
      // the same x, is kept)
      const fr = from === ENDS.west ? R.west : R.east, tr = from === ENDS.west ? R.east : R.west;
      const lineZ = (e, atX) => e.z + (Math.abs(e.dx) > 0.2 ? (e.dz / e.dx) * (atX - e.x) : 0);
      const side = z - lineZ(fr, x);
      if (Math.abs(side) < WRAP_ROAD) {
        // (by the other end of the road, where the mist is still about full: just past its end, else a little way in
        // along it, where the trees are cleared for the road and the camera trailing behind comes out of no leaves)
        road = [3, -4, -10, -16].map((k) => tr.x + to.side * k).filter((rx) => W.fogAt(rx) >= 0.9 && Math.abs(rx) < to.wrap - 1)
          .map((rx) => ({ x: rx, z: lineZ(tr, rx) + side }));
        if (road.length) { nx = road[0].x; want = road[0].z; }
        back = [tr.dx, tr.dz];
      }
    }
    if (cam) { const bx = cam.x - x, bz = cam.z - z, bl = Math.hypot(bx, bz); if (bl > 0.5) back = [bx / bl, bz / bl]; }
    // out on either side of that, the nearest spot with ground to stand on and no tree's crown over the rider or over
    // the camera behind them (a stretch WRAP_CLEAR m back toward the land's edge): else the view comes out in leaves
    const search = (sx, sz, reach) => {
      let best = null;
      for (let k = 0; k <= reach; k++) {
        const z1 = sz + (k % 2 ? 1 : -1) * 2 * Math.ceil(k / 2);
        if (blocked(sx, z1)) continue;
        const c = crownClear(sx, z1, back[0], back[1]); if (c >= 0) return { z: z1, clear: true };
        if (!best || c > best.c) best = { z: z1, c };
      }
      return best || { z: sz };
    };
    let nz = want, got = null;
    // (by the road: within 8 m of its line at each spot along it in turn where that is clear of the crowns)
    if (road) for (const r of road) { const f = search(r.x, r.z, 8); if (f.clear) { nx = r.x; nz = f.z; got = f; break; } }
    // (else on the road's line itself, under whatever the road itself runs under: the east end's last 120 m run through
    // the woods' crowns, and every rider on it rides there)
    if (road && !got) for (let k = 0; k <= 4 && !got; k++) { const z1 = road[0].z + (k % 2 ? 1 : -1) * Math.ceil(k / 2); if (!blocked(road[0].x, z1)) { nx = road[0].x; nz = z1; got = true; } }
    if (!got) nz = search(nx, want, 80).z;
    const y0 = V.heightAt(x, z), y1 = V.heightAt(nx, nz);
    return { x: nx, z: nz, dx: nx - x, dy: y1 - y0, dz: nz - z, from: from === ENDS.west ? 'west' : 'east' };
  };
  Object.defineProperties(W, {
    hour: { get: () => V.DAY.hour, enumerable: true },
    night: { get: () => nightOf(V.DAY.elev), enumerable: true },
    timeRuns: { get: () => V.DAY.auto, set: (on) => { V.DAY.auto = !!on; }, enumerable: true },
  });
  V.DAY.dayMin = DAY_MIN;
  W.setHour(W.dayStart);

  // ── THE SHADERS, WARMED AGAIN LATER ──────────────────────────────────────────────────────────────────────
  // what the game adds after loading (the homes, the cabin's pieces, camps) is first drawn when it first comes into
  // view, and a material never drawn has its shader built then, stalling that frame (riding out of the far end's mist
  // and looking back down the valley the first time: ~250 ms). So the shaders of everything in the scene not built yet
  // are built ahead, a few seconds into the ride, again later, and each time the rider is deep in an end's mist (where
  // nothing shows) before the way round. A FEW A FRAME (WARM.per new ones at most): the graphics card links each one
  // while it draws, and fifteen handed over in one frame held the next one up ~130 ms.
  const WARM = { t: 0, at: [4, 15, 45], next: 0, mistAt: -1e9, n: 0, tex: null, queue: null, per: 2, built: 0 };
  // and the pictures: three sends a material's textures to the graphics card the first time it is drawn (a big tree
  // bark or a roof, ~90 ms in one frame); each one in the scene not sent yet is sent here, a few a frame (warmLater)
  const SENT = new WeakSet(), ready = (im) => !!im && !Array.isArray(im) && (!!im.data || (im.width > 0 && im.complete !== false));
  function texturesOf(root) {
    const out = new Set(), add = (v) => { if (v && v.isTexture && !v.isRenderTargetTexture && !SENT.has(v) && v.version > 0 && ready(v.image)) out.add(v); };   // (a picture still loading is left for a later warm)
    root.traverseVisible((o) => { for (const m of [].concat(o.material || [])) { if (!m) continue; for (const k in m) add(m[k]); if (m.uniforms) for (const k in m.uniforms) { const u = m.uniforms[k]; if (u) add(u.value); } } });
    return [...out];
  }
  // the things in the scene with a material whose shader isn't built yet (each material once)
  const unbuilt = (m) => !!m && !(renderer.properties && renderer.properties.get(m).currentProgram);
  function toBuild(root) {
    const out = [], seen = new Set();
    root.traverse((o) => { for (const m of [].concat(o.material || [])) { if (!m || seen.has(m)) continue; seen.add(m); if (unbuilt(m)) { out.push(o); break; } } });
    return out;
  }
  W.warm = () => {
    if (WARM.queue && WARM.queue.length) return false;
    WARM.n++; WARM.tex = texturesOf(V.scene); WARM.queue = toBuild(V.scene);
    return true;
  };
  function buildSome() {   // (a few shaders a frame, for the valley's lights: three's compile, an object at a time)
    const Q = WARM.queue; if (!Q || !Q.length) return;
    const progs = () => (renderer.info.programs || []).length, p0 = progs(), t0 = performance.now();
    while (Q.length && progs() - p0 < WARM.per && performance.now() - t0 < 4) {
      const o = Q.pop();
      if (![].concat(o.material || []).some(unbuilt)) continue;   // (built since: drawn, or shares a material built just now)
      try { renderer.compile(o, camera, V.scene); } catch (e) { console.warn('world: shader warm-up', e); }
    }
    WARM.built += progs() - p0;
  }
  // things not in the scene yet (a road rider's kit, a wagon of each kind: made and let go again at once) built for the
  // valley's lights in the background, so the first one to come into range draws without stalling a frame
  W.warmFor = (root) => {
    try { return renderer.compileAsync ? renderer.compileAsync(root, camera, V.scene).catch((e) => console.warn('world: shader warm-up', e)) : (renderer.compile(root, camera, V.scene), Promise.resolve()); }
    catch (e) { console.warn('world: shader warm-up', e); return Promise.resolve(); }
  };
  function sendSome() {   // (a few pictures a frame, not all at once)
    const t0 = performance.now();
    while (WARM.tex && WARM.tex.length && performance.now() - t0 < 2) { const t = WARM.tex.pop(); if (SENT.has(t)) continue; SENT.add(t); try { renderer.initTexture(t); } catch (e) { /* (a picture still loading: sent when drawn) */ } }
  }
  function warmLater(dt) {
    WARM.t += Math.min(dt, 0.1); sendSome(); buildSome();
    if (WARM.next < WARM.at.length && WARM.t >= WARM.at[WARM.next]) { WARM.next++; W.warm(); }
    const c = camTarget; if (c && W.fogAt && W.fogAt(c.x) > 0.6 && WARM.t - WARM.mistAt > 20) { WARM.mistAt = WARM.t; W.warm(); }
  }
  W.warmState = () => ({ t: WARM.t, n: WARM.n, busy: !!(WARM.queue && WARM.queue.length), left: WARM.tex ? WARM.tex.length : 0, toBuild: WARM.queue ? WARM.queue.length : 0, built: WARM.built });

  // ── WAITING FOR THE TREES AND PLANTS (off stage: nothing drawn but a pixel) ────────────────────────────────
  // the camera put where the game starts, so the plants are laid and the shaders built for that view
  if (camera.far < 5000) { camera.far = 5000; camera.updateProjectionMatrix(); }
  { const s = places.spawn, y = V.heightAt(s.x, s.z); camTarget.set(s.x, y + 1.6, s.z);
    camera.position.set(s.x - Math.sin(s.rot) * 6, y + 3.4, s.z - Math.cos(s.rot) * 6); camera.lookAt(camTarget); camera.updateMatrixWorld(); }
  if (wait) {
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    let last = performance.now();
    for (let n = 0; !V.settled(); n++) {
      const now = performance.now(); V.update(Math.min(0.1, (now - last) / 1000), null, true); last = now;
      const parts = [V.treeForest && V.treeForest.ready, V.coverForest && V.coverForest.ready, V.coverForest && !V.COVER.job];
      say(0.5 + 0.4 * parts.filter(Boolean).length / parts.length, !parts[0] ? 'Growing the trees' : !parts[1] ? 'Growing the grass' : 'Laying the meadow');
      if (now - t0 > 90000) { console.warn('world: still not settled after 90 s; going on'); break; }
      await frame();
    }
    say(0.92, 'Saddling up');
    try { if (renderer.compileAsync) await renderer.compileAsync(V.scene, camera); else renderer.compile(V.scene, camera); } catch (e) { console.warn('world: shader warm-up', e); }
    for (const t of texturesOf(V.scene)) { SENT.add(t); try { renderer.initTexture(t); } catch (e) { /* (still loading) */ } }   // (every picture sent now, off stage)
    // one real draw through a single pixel: what the compile can't do (pictures and shapes sent to the graphics card)
    const sc = renderer.getScissorTest(), px = 1 / renderer.getPixelRatio();
    V.update(1 / 60, null, true); renderer.setScissorTest(true); renderer.setScissor(0, 0, px, px); V.render(); renderer.setScissorTest(sc);
  }
  W.loadedIn = (performance.now() - t0) / 1000;
  say(1, 'Ready');
  return W;
}
