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
//   W.tier       'potato' | 'normal' | 'gaming'
//   W.camTarget  a THREE.Vector3 the game keeps on the player: the plants' and trees' circles and the sun's shadows
//                follow it (the valley reads it as its "controls target")
//   W.V          the valley itself (advanced use only: its tunings, maps and forests)
import * as THREE from 'three';
import { makeValley, TIER_SET } from '../world/valley.js';
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
  const V = await makeValley({ renderer, camera, controls, quality: QUAL, look, live, slice: true, showcase: false, folk: false });
  const GAME = ((await layoutP) || {}).game || {};
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
    { const sl = V.slopeAt(i, j); if (sl > STEEP && (sl > BANK || !bankAt(j * V.N + i))) return true; }
    if (V.WDEPTH[j * V.N + i] > DEEP && V.waterAt(x, z) > 0.3) return true;
    return false;
  }

  const W = {
    scene: V.scene, V, tier: QUAL.tier, quality: QUAL, look, camTarget, places, blocked,
    addBlocker: (fn) => { EXTRA.push(fn); return () => { const i = EXTRA.indexOf(fn); if (i >= 0) EXTRA.splice(i, 1); }; },
    heightAt: V.heightAt, waterAt: V.waterAt, settled: V.settled,
    update: (dt) => V.update(Math.min(dt, 0.1)),                       // (a long pause, a tab come back, counts as a tenth of a second)
    render: () => V.render(),
    loadedIn: 0,                                                         // (seconds to settled, for the record)
  };

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
    // one real draw through a single pixel: what the compile can't do (pictures and shapes sent to the graphics card)
    const sc = renderer.getScissorTest(), px = 1 / renderer.getPixelRatio();
    V.update(1 / 60, null, true); renderer.setScissorTest(true); renderer.setScissor(0, 0, px, px); V.render(); renderer.setScissorTest(sc);
  }
  W.loadedIn = (performance.now() - t0) / 1000;
  say(1, 'Ready');
  return W;
}
