// THE LOADS, drawn: a person walking, a horse and rider, the covered wagon with its horse, the freight wagon with its
// team, and the cattle drive, each crossing from the west bank to the east along the middle of the deck (frame.js LOADS
// says where every foot, hoof and wheel is, and how much it weighs; this only draws them there). The game's own people,
// animals and wagons (src/actors/folk.js, animals.js, seat.js; src/wagon.js for the wagons with their team and harness),
// each falling back to plain shapes if they can't load.
//   const L = makeLoads(scene)
//   L.ready                 a promise: the models are in (or have failed and the plain shapes stand in)
//   L.show(key)             puts that load's figure on the bank, ready to go (and hides any other)
//   L.place(key, x, yAt)    its front at X = x feet; yAt(X) -> the deck's (or the bank's) height there, feet
//   L.back(key, k)          k 0..1: retreating to the west bank and fading (after the deck gave way under it)
//   L.update(dt, v)         the clips, at v feet a second along
//   L.hide(), L.dispose() (out of the scene, every figure it made let go; the models stay loaded for the next time)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { LOADS } from './frame.js';
import { FT } from './scene.js';

const GAME = new URL('../../', import.meta.url).href;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const byKey = Object.fromEntries(LOADS.map((l) => [l.key, l]));
// (the farm wagons' wheels come from models/wagons/wagons.json, as the game's src/wagon.js reads them: each wheel's hub
// (x, y, z) and radius r in metres in the wagon's own space; wheel.glb is one wheel of radius 1, scaled by r. The
// numbers below stand in only if the file can't load.)
let WHEELS = {
  covered: [[0.836, 0.5401, 0.9755, 0.5401], [-0.836, 0.5401, 0.9755, 0.5401], [0.8349, 0.6142, -0.9755, 0.6], [-0.8349, 0.6142, -0.9755, 0.6]],
  freight: [[0.7079, 0.5042, 1.0285, 0.4949], [-0.8226, 0.5042, 1.0055, 0.4954], [0.78, 0.6036, -1.0011, 0.6036], [-0.7592, 0.6036, -1.0329, 0.5964]],
};

// the game's people, animals and wagons, loaded once for the page and kept (a builder opened again in the game loads
// nothing new); each piece left null if it can't load (the plain shapes stand in)
// libs: the host's own, already loaded ({ animals, folk, wagons }: the game's actors/animals.js and folk.js libraries
// and src/wagon.js's wagons; the few kinds missing are asked for): nothing is loaded twice, and the loads are the
// game's own people, horses, cattle and wagons
let LIBS = null;
const HOSTED = new WeakMap();
function hostedLibs(libs) {
  if (HOSTED.has(libs.animals)) return HOSTED.get(libs.animals);
  const p = (async () => {
    const L = { lib: null, folk: null, seatRider: null, wheelScene: null, wagons: {}, gameWagons: null };
    try { const A = await import('../../src/actors/animals.js'); await Promise.all(['horse', 'horseWhite', 'cow', 'bull'].map((k) => libs.animals.need(k))); L.lib = { A, animals: libs.animals }; } catch (e) { console.warn('bridge: the animals for the loads', e); }
    try { const F = await import('../../src/actors/folk.js'); L.folk = { F, lib: libs.folk }; L.seatRider = (await import('../../src/actors/seat.js')).seatRider; } catch (e) { console.warn('bridge: the people for the loads', e); }
    try { if (libs.wagons && L.lib && L.folk) { await Promise.all(['covered', 'freight'].map((k) => libs.wagons.need(k))); L.gameWagons = { W: await import('../../src/wagon.js'), lib: libs.wagons }; } } catch (e) { console.warn('bridge: the wagons for the loads', e); }
    return L;
  })();
  HOSTED.set(libs.animals, p);
  return p;
}
function loadLibs(libs = null) {
  if (libs && libs.animals && libs.folk) return hostedLibs(libs);
  if (LIBS) return LIBS;
  LIBS = (async () => {
    const L = { lib: null, folk: null, seatRider: null, wheelScene: null, wagons: {}, gameWagons: null };
    try {
      const A = await import('../../src/actors/animals.js');
      L.lib = { A, animals: await A.loadAnimals(GAME, { kinds: ['horse', 'horseWhite', 'cow', 'bull'] }) };
    } catch (e) { console.warn('bridge lab: the animals did not load; plain shapes stand in', e); }
    try {
      const F = await import('../../src/actors/folk.js');
      L.folk = { F, lib: await F.loadFolk(GAME) };
      try { L.seatRider = (await import('../../src/actors/seat.js')).seatRider; } catch (e) { L.seatRider = null; }
    } catch (e) { console.warn('bridge lab: the people did not load; plain shapes stand in', e); }
    try {
      const info = await (await fetch(GAME + 'models/wagons/wagons.json')).json();
      for (const k of ['covered', 'freight']) WHEELS[k] = ['FL', 'FR', 'BL', 'BR'].map((id) => { const w = info.kinds[k].wheels[id]; return [w.x, w.y, w.z, w.r]; });
    } catch (e) { /* (the numbers above) */ }
    try { L.wheelScene = (await loader.loadAsync(GAME + 'models/wagons/wheel.glb')).scene; } catch (e) { L.wheelScene = null; }
    for (const k of ['covered', 'freight']) { try { L.wagons[k] = (await loader.loadAsync(GAME + `models/wagons/${k}.glb`)).scene; } catch (e) { L.wagons[k] = null; } }
    // the game's own wagon and team (src/wagon.js: the body, wheels, tongue up at the neck yoke, the harness, the team
    // and the driver), when the animals and the people loaded; the plain wagon below stands in if not
    try {
      if (L.lib && L.folk) { const W = await import('../../src/wagon.js'); L.gameWagons = { W, lib: await W.loadWagons({ base: GAME, animals: L.lib.animals, folk: L.folk.lib, kinds: ['covered', 'freight'] }) }; }
    } catch (e) { console.warn('bridge lab: the game\'s wagons did not load; the plain ones stand in', e); L.gameWagons = null; }
    return L;
  })();
  return LIBS;
}

// wait: ms before the models start loading (the game: after the camera's glide to the site, so the loading doesn't
// stutter it); figures made before they are in are plain, and made again once they are. libs: the host's own
// (above), or nothing for the lab's own loading. The loads fade with copies of their materials (src/wagon.js fadeAll),
// never the shared ones: a load fading back to the bank leaves every townsman and horse that shares them as it was
export function makeLoads(scene, { wait = 0, libs = null } = {}) {
  const root = new THREE.Group(); scene.add(root);
  const figs = {};            // key -> { group, parts: [{ obj, dx (feet behind the front, to its middle), z, kind }], clips: [...] }
  let lib = null, folk = null, seatRider = null, wheelScene = null, wagons = {}, gameWagons = null, dead = false;
  // (the deck's height for the game's wagons: its world asks the ground's height, and the deck is that ground)
  let groundAt = () => 0;
  const deckWorld = { heightAt: (x, z) => groundAt(x / FT) * FT };
  const along = new THREE.LineCurve3(new THREE.Vector3(-90, 0, 0), new THREE.Vector3(90, 0, 0));   // (east: +X)
  let fadeAll = null, unfade = null;
  import('../../src/wagon.js').then((m) => { fadeAll = m.fadeAll; unfade = m.unfade; }).catch(() => null);
  const ready = new Promise((res) => setTimeout(res, wait)).then(() => (dead ? null : loadLibs(libs))).then((L) => {
    if (!L || dead) return;
    ({ lib, folk, seatRider, wheelScene, wagons, gameWagons } = L);
    // (plain figures made while waiting: made again with the models, unless one is on show just now)
    for (const k of Object.keys(figs)) if (k !== shown) { freeFig(figs[k]); delete figs[k]; }
  });
  const shadow = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } }); return o; };
  const plainBody = (w, h, l, col) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), new THREE.MeshLambertMaterial({ color: col })); m.userData.plain = true; m.position.y = h / 2 + 0.4; const g = new THREE.Group(); g.add(m); return shadow(g); };
  function person(palette = 'rancher', outfit = 'casual_m') {
    if (folk) { try { const p = folk.F.makePerson(folk.lib, { outfit, palette, skin: 2, hair: 4, hat: true }); p.play('Walk', { fade: 0 }); shadow(p.root); return p; } catch (e) { /* plain */ } }
    const g = plainBody(0.45, 1.3, 0.3, 0x8a6a4a); return { root: g, play() {}, update() {}, stride: 1.2 };
  }
  function animal(kind, fallbackCol = 0x7a5232) {
    if (lib) { try { const a = lib.A.makeAnimal(lib.animals, kind); a.play('Walk', { fade: 0 }); shadow(a.root); return a; } catch (e) { /* plain */ } }
    const g = plainBody(0.6, 1.0, 2.0, fallbackCol); return { root: g, play() {}, update() {}, stride: { Walk: 1 } };
  }
  function wagon(kind) {
    const g = new THREE.Group(), wheels = [];
    if (wagons[kind]) g.add(shadow(wagons[kind].clone()));
    else { const bed = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 3.2), new THREE.MeshLambertMaterial({ color: 0x7a5a3a })); bed.userData.plain = true; bed.position.y = 0.9; g.add(shadow(bed)); }
    // (each wheel on its hub, its size the game's: wheel.glb is radius 1, scaled by the wheel's own radius)
    for (const [x, y, z, r] of WHEELS[kind]) {
      let w;
      if (wheelScene) { w = wheelScene.clone(); w.scale.setScalar(r); if (x < 0) w.rotation.y = Math.PI; }
      else { w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 16).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x4a3626 })); w.userData.plain = true; }
      const hub = new THREE.Group(); hub.position.set(x, y, z); hub.add(w); g.add(hub); wheels.push({ hub, r });
      shadow(w);
    }
    return { root: g, wheels };
  }
  // a figure for each load: its pieces, each standing at its own place along the load (dx: feet behind the load's front
  // to the piece's middle, z across), turned to face east
  function build(key) {
    const L = byKey[key], g = new THREE.Group(), parts = [], clips = [];
    const add = (obj, dx, z, kind, extra = {}) => { obj.root.rotation.y = Math.PI / 2; g.add(obj.root); parts.push({ obj, dx, z, kind, ...extra }); if (obj.update) clips.push(obj); };
    if (key === 'person') add(person('rancher', 'casual_m'), 0, 0, 'walker');
    else if (key === 'horse') {
      const h = animal('horse'); add(h, -2.15, 0, 'horse');
      const p = person('drifter', 'farmer_m'); g.add(p.root); p.play('Ride', { fade: 0 }) || p.play('Idle', { fade: 0 }); clips.push(p); parts.push({ obj: p, rider: h, kind: 'rider' });
    } else if (L.model && gameWagons) {
      // the game's wagon: its axles where the load's wheels bear (frame.js LOADS), the team ahead of it as the game
      // puts it; the whole thing moved along a straight line east over the deck
      const wg = gameWagons.W.makeWagon(gameWagons.lib, { kind: L.model, W: deckWorld, team: true, driver: true });
      // (not one of the valley's wagons: its boxes are in the bridge's own frame, so it is taken out of the set the
      // valley's walkers keep clear of (src/wagon.js WAGONS_OUT) at once)
      if (gameWagons.W.WAGONS_OUT) gameWagons.W.WAGONS_OUT.delete(wg);
      const wb = L.parts.filter((p) => p.wheel), mid = (Math.max(...wb.map((p) => p.dx)) + Math.min(...wb.map((p) => p.dx))) / 2;
      wg.setPath(along, { at: 0.5, dir: 1 }); wg.speed = 0;
      g.add(wg.root); parts.push({ obj: { root: wg.root }, kind: 'game', wg, mid });
    } else if (L.model) {
      const n = L.horses || 1, zs = n === 2 ? [-1.3, 1.3] : [0];
      for (const z of zs) add(animal(z < 0 ? 'horse' : 'horseWhite'), -2.15, z, 'horse');
      const w = wagon(L.model), wb = L.parts.filter((p) => p.wheel), front = Math.max(...wb.map((p) => p.dx)), back = Math.min(...wb.map((p) => p.dx));
      add(w, (front + back) / 2, 0, 'wagon', { wheels: w.wheels });
      // the tongue: a pole from the wagon's front to between the horses
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1), new THREE.MeshLambertMaterial({ color: 0x5a4030 })); pole.userData.plain = true; g.add(pole);
      parts.push({ obj: { root: pole }, kind: 'pole', from: front + 0.6, to: -3.4 });
    } else if (key === 'cattle') {
      for (let r = 0; r < L.head / 2; r++) for (const z of [-1.4, 1.4]) add(animal((r + (z > 0 ? 1 : 0)) % 3 === 0 ? 'bull' : 'cow', 0x6a4a32), -r * L.rowGap - 2.2, z, 'steer', { phase: Math.random() });
    }
    g.visible = false; root.add(g);
    return (figs[key] = { group: g, parts, clips, x: -100 });
  }
  let shown = null;
  // (the people in a figure: a game person fades itself, by its own .fade)
  const folkOf = (f) => f.parts.map((q) => q.obj).filter((o) => o && typeof o === 'object' && 'fade' in o);
  function show(key) { hide(); const f = figs[key] || build(key); f.group.visible = true; shown = key; if (f.mem && unfade) { unfade(f.mem); f.mem = null; for (const o of folkOf(f)) o.fade = 1; } return f; }
  function hide() { for (const f of Object.values(figs)) f.group.visible = false; shown = null; }
  const v3 = new THREE.Vector3();
  function place(key, x, yAt) {
    const f = figs[key]; if (!f) return; f.x = x;
    groundAt = yAt;
    for (const p of f.parts) {
      if (p.kind === 'rider') continue;
      if (p.kind === 'game') { p.at = 90 + (x + p.mid) * FT; if (!p.started) { p.wg.u = p.at; p.wg.update(0); p.started = true; } continue; }
      if (p.kind === 'pole') {
        const xa = x + p.from, xb = x + p.to, ya = yAt(xa) * FT + 0.55, yb = yAt(xb) * FT + 0.75;
        p.obj.root.position.set((xa + xb) / 2 * FT, (ya + yb) / 2, 0); p.obj.root.scale.z = Math.abs(xb - xa) * FT;
        p.obj.root.rotation.set(0, Math.PI / 2, 0); p.obj.root.rotateX(-Math.atan2(yb - ya, (xb - xa) * FT));
        continue;
      }
      const X = x + p.dx, half = p.kind === 'wagon' ? 3.3 : p.kind === 'walker' ? 0.4 : 2.2;
      // (on a slope between the bank and a raised deck, or a sag: level between its front and back feet)
      const yf = yAt(X + half), yb = yAt(X - half);
      p.obj.root.position.set(X * FT, (yf + yb) / 2 * FT, p.z * FT);
      p.obj.root.rotation.set(0, Math.PI / 2, 0); p.obj.root.rotateX(-Math.atan2((yf - yb) * FT, 2 * half * FT));
    }
  }
  let lastX = null;
  function update(dt, v = 4) {
    if (!shown) return;
    const f = figs[shown];
    for (const p of f.parts) {
      // (the game's wagon goes at the load's pace, landing where the load is: its own update turns the wheels, swings
      // the tongue, walks the team and sets the harness)
      if (p.kind === 'game') { const w = p.wg; w.pace = w.speed = v * FT; w.u = (p.at ?? w.u) - w.pace * dt; w.ended = false; w.update(dt); continue; }
      if (p.kind === 'wagon') for (const w of p.wheels) w.hub.rotation.x += v * FT * dt / w.r;
      const o = p.obj;
      if (o.play && p.kind !== 'rider') {
        // (the walk at the speed it is going, so the feet keep to the deck; standing still: idle)
        const stride = typeof o.stride === 'number' ? o.stride : o.stride && o.stride.Walk ? o.stride.Walk : 1;
        if (v > 0.05) { o.play('Walk', { fade: 0.2, speed: Math.max(0.3, v * FT / stride) }); } else o.play('Idle', { fade: 0.3 });
      }
    }
    for (const c of f.clips) c.update(dt);
    for (const p of f.parts) if (p.kind === 'rider') { if (seatRider) { try { seatRider(p.rider, p.obj); } catch (e) { /* plain */ } } else { p.rider.root.updateWorldMatrix(true, true); p.obj.root.position.copy(p.rider.root.position).add(v3.set(0, 1.0, 0)); p.obj.root.rotation.copy(p.rider.root.rotation); } }
    lastX = f.x;
  }
  // retreating to the bank after the deck gave way: k 0..1 (it fades as it goes)
  function back(key, k) {
    const f = figs[key]; if (!f) return;
    const o = 1 - Math.max(0, (k - 0.5) * 2);
    if (fadeAll) { if (!f.mem) f.mem = {}; fadeAll(f.group, o, f.mem, folkOf(f)); }
    if (o <= 0.01) f.group.visible = false;
  }
  // everything this made let go: each figure's own skeletons (their bone textures) and instanced straps, the plain
  // shapes' geometry and colours, the figure out of the scene. The game's people, animals and wagons share their
  // shapes with the loaded models, and their materials are left to the garbage collector, never disposed: disposing
  // the last material drawn with a shader program throws the program away, and the next traveller to come along would
  // build it again (a 90 ms frame; src/wagon.js says the same of its fade copies)
  function freeFig(f) {
    if (f.mem && unfade) { unfade(f.mem); f.mem = null; }
    for (const p of f.parts) {
      const o = p.kind === 'game' ? p.wg : p.obj;
      try {
        if (p.kind === 'game' && gameWagons && gameWagons.W.WAGONS_OUT) gameWagons.W.WAGONS_OUT.delete(p.wg);
        const r = o && o.root; if (!r) continue;
        r.traverse((m) => {
          if (m.isSkinnedMesh && m.skeleton) m.skeleton.dispose();
          else if (m.isInstancedMesh) m.dispose();
          else if (m.isMesh && m.userData.plain) { m.geometry.dispose(); m.material.dispose(); }
        });
        r.removeFromParent();
      } catch (e) { /* let go as it is */ }
    }
    root.remove(f.group);
  }
  function dispose() { dead = true; hide(); for (const k of Object.keys(figs)) { freeFig(figs[k]); delete figs[k]; } scene.remove(root); }
  return { ready, show, hide, place, update, back, dispose, root, get shown() { return shown; }, figs };
}
