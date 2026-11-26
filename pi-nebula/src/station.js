// THE STATION, as the game draws it: the kit's own room file (kit/rooms/station.json) built by the kit's own code,
// with its saved light, the sky outside, the bloom, and each room's own picture of itself for its shine. This is the
// Kit Lab's way of showing the station (labs/kit/main.js) with nothing of the lab's menus: the lab and the game build
// the station from the same kit, so a change to a room shows in both.
//
//   const W = await loadStation({ canvas, quality, say })       say(fraction, words) as the loading moves on
//   W.frame(dt, now, eyes)   one drawn frame: which rooms are drawn, the doors (they open for any of `eyes`, the
//                            points where people are; a door in W.keepShut stays shut, one in W.driven is left to
//                            whatever drives it), what glides by itself (the big scanner's ring, by the clock `now`),
//                            the dust, the sky, the picture
//   W.view(name) / W.place(name) / W.room(id)                   the station file's named views, spots and rooms
//   W.alone = Set of room ids   only these rooms are drawn, and none of the doors' leaves: a ship out on a trip
//                            (src/trip.js: the station is not out there); null: as always
//   W.rooms = fn             a last word on which rooms are drawn: fn(room, drawn) -> drawn (src/outside.js); null: none
//   W.seenFrom = point       a view from outside (the dock's bridge job): the rooms drawn are those seen from this point
//                            inside the station, not from the camera out in space (null: from the camera, as always)
//   W.after                  a Set of fn(renderer): each is called once the frame's picture is drawn, to draw something
//                            small of its own over it (the landing guide's small model and hologram: src/flying.js)
//
// NOTHING HERE KNOWS A COORDINATE. Rooms, doors, views and spots are found by name through the station file, which
// is being rebuilt; the game's own markers are in spots.js, keyed by those names.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeMaterials, U } from '../kit/materials.js';
import { createSky } from '../world/sky.js';
import { buildRoomSoon, updateDoors, updateGlides, hoopLights, setDoors, loadRoom, updateZones, zoneAt } from '../kit/layout.js';
import { loadBake } from '../kit/bakefile.js';
import { makeDust } from '../kit/dust.js';
import { OUTSIDE_BOX } from '../kit/outside-plan.js';
import { makeBeams, beamsOf } from '../kit/beams.js';

// low: no bloom, 1x; medium: bloom, 1.5x; high: bloom, a sharper room picture, 2x (the Kit Lab's own three steps; the
// `bake` numbers are used only for a room whose saved light no longer matches it). hoop: the big scanner's band of
// light falls on its room live as it glides (kit/layout.js hoopLights)
export const QUALITY = {
  low: { ratio: 1, bloom: false, bake: { voxel: 0.09, rays: 20, shadows: false }, probe: 64, hoop: false },
  medium: { ratio: 1.5, bloom: true, bake: { voxel: 0.07, rays: 28, shadows: true }, probe: 128, hoop: false },
  high: { ratio: 2, bloom: true, bake: { voxel: 0.05, rays: 40, shadows: true }, probe: 256, hoop: true },
};
export const pickQuality = (asked) => (asked in QUALITY ? asked : (matchMedia('(pointer: coarse)').matches ? 'medium' : 'high'));

const RANGE = 34;   // (how far a room's own picture of itself looks, metres)
// how far the camera sees, metres: the station's own outside is 270 m from end to end and is seen from the windows
// (src/outside.js; it was 120 m while there was nothing outside to see). A ship flown outside sees further (src/flying.js).
export const SEES = 700;
const FAR = new THREE.Vector3(1e6, 1e6, 1e6), ONE = [null];

// a pause long enough for the screen to be drawn (so the title's loading bar moves between the heavy steps); a
// hidden tab draws nothing, so it never waits on a frame for long
// (a beat between two pieces of the work, the shortest the page allows: whatever the player did meanwhile, a key typed
// in the title's name box or a press of its maker, is seen to before the next piece. THE MAKER WHILE THE GAME LOADS,
// 2026-11-26: the rooms' shine was worked out in one go of some nine seconds, and nothing typed got through)
const beat = () => new Promise((done) => setTimeout(done, 0));
// (THE MAKER WHILE THE GAME LOADS: each shader's first use, when three asks the graphics card how it came out and where
// its inputs are (some 10 ms each, a few hundred of them, all at the first picture before), taken a few at a time with
// a beat between, for the shaders of what is under root; three's own program objects, as its renderer keeps them)
export async function usePrograms(renderer, root) {
  const progs = new Set();
  root.traverse((o) => { for (const m of [].concat(o.material || [])) { const P = renderer.properties.get(m); if (P && P.programs) for (const p of P.programs.values()) progs.add(p); } });
  let t0 = performance.now();
  for (const p of progs) {
    try { p.getUniforms(); p.getAttributes(); } catch (e) { /* used at its first picture, as before */ }
    if (performance.now() - t0 > 12) { await beat(); t0 = performance.now(); }
  }
}
// (a cube camera's six pictures, as three's CubeCamera.update draws them, a beat between each: one room's six held the
// page about a third of a second: THE MAKER WHILE THE GAME LOADS)
async function cubeSoon(cc, renderer, scene) {
  if (cc.parent === null) cc.updateMatrixWorld();
  const { renderTarget, activeMipmapLevel } = cc;
  if (cc.coordinateSystem !== renderer.coordinateSystem) { cc.coordinateSystem = renderer.coordinateSystem; cc.updateCoordinateSystem(); }
  const cams = cc.children.slice(0, 6), mips = renderTarget.texture.generateMipmaps;
  renderTarget.texture.generateMipmaps = false;
  for (let i = 0; i < 6; i++) {
    const was = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), level = renderer.getActiveMipmapLevel(), xr = renderer.xr.enabled;
    renderer.xr.enabled = false;
    if (i === 5) renderTarget.texture.generateMipmaps = mips;     // (the mipmaps made with the last side)
    renderer.setRenderTarget(renderTarget, i, activeMipmapLevel);
    renderer.render(scene, cams[i]);
    renderer.setRenderTarget(was, face, level); renderer.xr.enabled = xr;
    if (i < 5) await beat();
  }
  renderTarget.texture.needsPMREMUpdate = true;
}
const breath = () => new Promise((done) => { let went = false; const go = () => { if (!went) { went = true; done(); } }; requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 120); });

export async function loadStation({ canvas, quality = null, rig = false, room = 'station', say = () => {} } = {}) {
  const qName = pickQuality(quality), Q = QUALITY[qName];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: rig });
  if (!renderer.capabilities.isWebGL2) throw new Error('This game needs WebGL2, which this browser does not have.');
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.74;
  renderer.shadowMap.enabled = false; renderer.info.autoReset = false;
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.ratio));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 0.03, SEES);
  await beat();      // (THE MAKER WHILE THE GAME LOADS: the page's turn between these first pieces too)
  const mats = makeMaterials(), pmrem = new THREE.PMREMGenerator(renderer);
  await beat();
  const fill = new THREE.HemisphereLight(0xdde2e8, 0x5d6065, 0.75); scene.add(fill);
  const dust = makeDust(); dust.visible = false; scene.add(dust);
  await beat();
  const sky = createSky(renderer, { quality: qName }); scene.add(sky.object);
  scene.fog = new THREE.Fog(0x8a8e93, 7, 60);
  U.aoDirect.value = 0.6; U.bakeGain.value = 1;
  for (const m of Object.values(mats)) if ('envMapIntensity' in m) m.envMapIntensity = m === mats.glass ? 0.35 : 1.25;
  const stats = { calls: 0, tris: 0, quality: qName };

  // ── the picture: straight to the screen, or through the bloom ──────────────────────────────────────────────────
  let composer = null;
  if (Q.bloom) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2()).max(new THREE.Vector2(2, 2));
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 }));
    // (the scene's own draws are counted inside its pass, before the bloom's passes add theirs)
    const rp = new RenderPass(scene, camera), rpRender = rp.render.bind(rp);
    rp.render = (r, wb, rb, ...a) => {
      renderer.info.reset();
      if (!split()) rpRender(r, wb, rb, ...a);
      else twoDepths((first) => { if (!first) { renderer.setRenderTarget(rp.renderToScreen ? null : rb); renderer.clearDepth(); rp.clear = false; } rpRender(r, wb, rb, ...a); rp.clear = true; });
      stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles;
    };
    composer.addPass(rp); composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.32, 2.2)); composer.addPass(new OutputPass());
  }
  function resize(force = false) {
    const w = Math.max(2, innerWidth), h = Math.max(2, innerHeight), pr = renderer.getPixelRatio();
    if (!force && canvas.width === Math.floor(w * pr) && canvas.height === Math.floor(h * pr)) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); }
  }
  resize(true);
  // THE PICTURE IN TWO DEPTHS, SEEN FROM OUT IN SPACE (2026-11-26: the game's maker saw flickering on the station from
  // outside in the trailer). The depth buffer tells near from far finely close to the eye and coarsely far off; with
  // the eye's near limit a few centimetres out (the cockpit's 5 cm, a person's 3 cm), the station a few hundred metres
  // away was told apart only to tens of centimetres, so its plates, frames and windows fought for the picture. With the
  // camera outside the station's box (and nothing of a trip drawn alone), the picture is drawn twice: everything from
  // SPLIT.at metres out to the far limit, then, over it, whatever is nearer than that (the cockpit, its own hull) with the
  // eye's own near limit. Each part has the whole depth buffer to itself: at 700 m things are told apart to under a
  // centimetre. The second pass draws only what reaches that close (most of the station is not in its view at all).
  const box = OUTSIDE_BOX, SPLIT = { at: 6, margin: 4, on: true };
  const split = () => {
    if (!SPLIT.on || W0.alone || camera.near >= SPLIT.at) return false;
    const p = camera.position, m = SPLIT.margin;
    return p.x < box.min[0] - m || p.x > box.max[0] + m || p.y < box.min[1] - m || p.y > box.max[1] + m || p.z < box.min[2] - m || p.z > box.max[2] + m;
  };
  // (the second pass leaves out what cannot reach that close: every room whose box is further off than the split, where
  // it stands now (a flown ship's room is moved by its group's matrix), and the station's outside hull, which is never
  // that near once the camera is outside its box)
  // (a room holding a moved part, a flown ship's pods drawn with its hangar, is kept: the part may be near; the moving
  // parts of the doors, each drawn for all of its kind at once, are left out where every room they belong to is)
  const _inv = new THREE.Matrix4(), _eye = new THREE.Vector3(), _off = [], _far = new Set();
  let leafZones = null;
  function twoDepths(once) {
    const n0 = camera.near, f0 = camera.far, skyOn = sky.object.visible, bg = scene.background;
    camera.near = SPLIT.at; camera.updateProjectionMatrix();
    once(true);
    camera.near = n0; camera.far = Math.min(f0, SPLIT.at * 1.001); camera.updateProjectionMatrix();
    sky.object.visible = false; scene.background = null;
    _off.length = 0; _far.clear();
    for (const z of built.zones) {
      if (!z.group.visible) { _far.add(z.id); continue; }
      _eye.copy(camera.position).applyMatrix4(_inv.copy(z.group.matrixWorld).invert());
      if (z.box.distanceToPoint(_eye) > SPLIT.at && !z.group.children.some((c) => c.matrixAutoUpdate === false)) { z.group.visible = false; _off.push(z.group); _far.add(z.id); }
    }
    if (!leafZones) { leafZones = new Map(); for (const D of built.doors) for (const leaf of D.leaves) for (const im of leaf.meshes || []) { if (!leafZones.has(im)) leafZones.set(im, new Set()); leafZones.get(im).add(D.zone); } }
    for (const [im, zs] of leafZones) if (im.visible && im.matrixAutoUpdate !== false && [...zs].every((id) => _far.has(id))) { im.visible = false; _off.push(im); }
    for (const o of scene.children) if (o.name === 'outside' && o.visible) { o.visible = false; _off.push(o); }
    once(false);
    for (const o of _off) o.visible = true;
    camera.far = f0; camera.updateProjectionMatrix(); sky.object.visible = skyOn; scene.background = bg;
  }
  function draw(dt) {
    if (composer) composer.render(dt);
    else {
      renderer.info.reset();
      if (!split()) renderer.render(scene, camera);
      else { const ac = renderer.autoClear; twoDepths((first) => { if (!first) { renderer.autoClear = false; renderer.clearDepth(); } renderer.render(scene, camera); }); renderer.autoClear = ac; }
      stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles;
    }
  }

  // ── the rooms ──────────────────────────────────────────────────────────────────────────────────────────────────
  say(0.05, 'Reading the station map');
  const R = await loadRoom(new URL('../kit/rooms/' + room + '.json', import.meta.url));
  say(0.14, 'Finding the light switches');
  const saved = R.bake ? await loadBake(new URL('../kit/rooms/' + R.bake, import.meta.url)) : null;
  say(0.3, 'Building the rooms'); await breath();
  // each room has its own copy of the painted materials, so each can shine with its own picture of itself
  const zoneSets = new Map();
  const zoneMats = (id) => {
    if (!zoneSets.has(id)) { const m = makeMaterials(); zoneSets.set(id, { ...mats, solid: m.solid, floor: m.floor, decal: m.decal, solidInst: mats.solidInst, floorInst: mats.floorInst, decalInst: mats.decalInst }); }
    return zoneSets.get(id);
  };
  const built = await buildRoomSoon(R, mats, { bake: Q.bake, saved, zoneMats, compact: true }, beat);   // (a piece at a time: the title usable meanwhile)
  scene.add(built.group);
  hoopLights(built, Q.hoop, mats);   // (before the first picture: its room's materials are made once, with it or without)
  // (the beams of lit haze some lights carry, as the Kit Lab shows them: the forge's pours; none at low quality)
  const beamList = qName === 'low' ? [] : beamsOf(built.lights || []);
  const beams = beamList.length ? makeBeams(beamList) : null;
  if (beams) scene.add(beams.object);
  if (built.stats.problems.length) console.warn('station: ' + built.stats.problems.join('; '));
  setDoors(built.doors, 0);
  const start = new THREE.Vector3(...(R.views?.start?.at || R.spawn?.at || [0, 1.6, 0]));
  updateZones(built, start, 0.01);

  // ── the shine: the station's picture of itself (twice, so the second holds the first's shine), then each room's ──
  say(0.62, 'Switching on the lights'); await breath();
  // (THE MAKER WHILE THE GAME LOADS: every picture the rooms' materials use sent to the graphics card one at a time, a
  // beat between, before the first pictures below would send them all in one go)
  { const seen = new Set(); let t0 = performance.now();
    const maps = []; scene.traverse((o) => { for (const m of [].concat(o.material || [])) for (const v of Object.values(m)) if (v && v.isTexture && !v.isRenderTargetTexture && !seen.has(v)) { seen.add(v); maps.push(v); } });
    for (const t of maps) { try { renderer.initTexture(t); } catch (e) { /* sent at its first picture, as before */ } if (performance.now() - t0 > 12) { await beat(); t0 = performance.now(); } } }
  // (THE MAKER WHILE THE GAME LOADS, 2026-11-26: each room's shaders built on their own, a beat between rooms, before
  // the pictures below would build them all in one go; the same shaders, so the same light, but the title's name box
  // and maker are heard between rooms)
  // (target: what the pictures below are drawn into, a cube's render target: a shader is built for what it draws into,
  // the screen or a target, so it is built for that)
  const warm = async (target = null) => {
    for (const z of built.zones) {
      const was = z.group.visible; z.group.visible = true;
      // (three's compileAsync: the shaders handed to the graphics card at once, then waited for without holding the page;
      // a browser that cannot build them alongside builds them there and then, a room at a time)
      let ready = null;
      const was2 = renderer.getRenderTarget(); renderer.setRenderTarget(target);
      try { ready = renderer.compileAsync ? renderer.compileAsync(z.group, camera, scene) : (renderer.compile(z.group, camera, scene), null); } catch (e) { /* drawn as before: built at its first picture */ }
      renderer.setRenderTarget(was2);
      z.group.visible = was;
      if (ready) await ready.catch(() => {});
      await beat();
      await usePrograms(renderer, z.group);
    }
  };
  let envTex = null;
  {
    const rt = new THREE.WebGLCubeRenderTarget(Q.probe, { type: THREE.HalfFloatType }), cc = new THREE.CubeCamera(0.05, 80, rt);
    cc.position.set(...(R.probe || R.views?.start?.at || R.spawn?.at || [0, 1.6, 0])); scene.add(cc);
    scene.environment = null; sky.object.visible = false;
    await warm(rt);
    for (let i = 0; i < 2; i++) { if (i) await warm(rt); await cubeSoon(cc, renderer, scene); const t = pmrem.fromCubemap(rt.texture).texture; if (envTex) envTex.dispose(); envTex = t; scene.environment = t; await beat(); }
    sky.object.visible = true; scene.remove(cc); rt.dispose();
  }
  if (R.rooms) {
    await breath();
    const rt = new THREE.WebGLCubeRenderTarget(Q.probe, { type: THREE.HalfFloatType }), cc = new THREE.CubeCamera(0.05, 90, rt);
    scene.add(cc);
    for (let pass = 0; pass < 2; pass++) {
      say(0.7 + pass * 0.12, pass ? 'Polishing the floors' : 'Switching on the lights');
      await warm(rt);      // (the station's shine, then each room's own, on the materials: their shaders built again, room by room)
      const envs = [];
      for (const z of built.zones) {
        if (z.with) { envs.push(null); continue; }
        const c = z.box.getCenter(new THREE.Vector3());
        cc.position.set(...(z.probe || [c.x, z.box.min.y + 1.6, c.z]));
        updateZones(built, cc.position, RANGE); await cubeSoon(cc, renderer, scene);
        envs.push(pmrem.fromCubemap(rt.texture).texture);
        await beat();
      }
      built.zones.forEach((z, i) => {
        if (z.with) return;
        const set = zoneSets.get(z.id); if (set.env) set.env.dispose(); set.env = envs[i];
        for (const k of ['solid', 'floor', 'decal']) { set[k].envMap = envs[i]; set[k].envMapIntensity = mats[k].envMapIntensity * (z.sky ? 0.7 : 1); set[k].needsUpdate = true; }
      });
      await breath();
    }
    scene.remove(cc); rt.dispose();
  }
  dust.visible = qName !== 'low';
  say(0.92, 'Opening the shutters');

  // ── by name ────────────────────────────────────────────────────────────────────────────────────────────────────
  const zoneById = new Map(built.zones.map((z) => [z.id, z]));
  const view = (name) => { const v = R.views?.[name]; return v ? { at: new THREE.Vector3(...v.at), look: new THREE.Vector3(...v.look), fov: v.fov || 60 } : null; };
  const place = (name) => { const p = R.places?.[name]; return Array.isArray(p) ? new THREE.Vector3(...p) : null; };
  const roomOf = (id) => zoneById.get(id) || null;
  // the shine of the room a point is in (for the people walking through it)
  const envAt = (p) => { const z = zoneAt(built, p), set = z && zoneSets.get(z.id); return (set && set.env) || envTex; };

  const keepShut = new Set(), driven = new Set();   // (driven: doors something else works, a parked ship's ways in: boarding.js)
  // (a view from outside the station, the dock's bridge job: the rooms to draw are the ones seen from a point inside it,
  // W.seenFrom (a Vector3), not from the camera, out in space where no room is near; null: from the camera)
  // (a ship out on a trip, src/trip.js: only its own room is drawn, W.alone; the doors' leaves, which hang on the
  // station itself and not on a room, are put away with the rest and brought back as they were)
  // (W.rooms: a last word on which rooms are drawn, fn(room, drawn) -> drawn; the station's outside has it: the white
  // stand-in walls it covers are put away, and a ship flown outside is seen from out there, src/outside.js)
  const W0 = { seenFrom: null, alone: null, hidden: null, rooms: null, after: new Set() };
  function setAlone(ids) {
    if (W0.hidden) { for (const [o, v] of W0.hidden) o.visible = v; W0.hidden = null; }
    W0.alone = ids ? new Set(ids) : null;
    if (!W0.alone) return;
    const zoneGroups = new Set(built.zones.map((z) => z.group));
    W0.hidden = built.group.children.filter((o) => !zoneGroups.has(o)).map((o) => [o, o.visible]);
    for (const [o] of W0.hidden) o.visible = false;
  }
  function frame(dt, now, eyes = null) {
    U.time.value = now;
    resize();
    if (built.zones.length > 1) updateZones(built, W0.seenFrom || camera.position, RANGE, camera, R.portals);
    if (W0.alone) for (const z of built.zones) z.group.visible = W0.alone.has(z.id);
    if (W0.rooms) for (const z of built.zones) z.group.visible = !!W0.rooms(z, z.group.visible);
    if (dust.visible) dust.userData.update(dt, camera.position);
    sky.update(dt);
    // each door opens for whoever is nearest it (the kit's doors sense one point at a time); a door in keepShut (one
    // that leads nowhere a person can stand: walls.js) stays shut
    for (const D of built.doors) {
      if (driven.has(D)) continue;
      let best = FAR, bd = Infinity;
      if (eyes) for (const e of eyes) { const d = e.distanceToSquared(D.sense); if (d < bd) { bd = d; best = e; } }
      ONE[0] = D; updateDoors(ONE, best, dt, keepShut.has(D) ? 'shut' : 'auto');
    }
    // (what glides by itself, the big scanner's ring: by the clock, and only in a room that is being drawn)
    updateGlides(built, now);
    draw(dt);
    for (const f of W0.after) f(renderer);
  }

  return { target: () => (composer ? composer.readBuffer : null), renderer, scene, camera, R, built, mats, sky, dust, fill, beams, stats, quality: qName, frame, resize, view, place, room: roomOf, envAt, zoneAt: (p) => zoneAt(built, p), keepShut, driven, get env() { return envTex; },
    get seenFrom() { return W0.seenFrom; }, set seenFrom(p) { W0.seenFrom = p || null; },
    // (the picture in two depths from outside: on by itself out there; false keeps it off, for the cost rigs' before and after)
    get twoDepths() { return SPLIT.on; }, set twoDepths(v) { SPLIT.on = !!v; },
    get alone() { return W0.alone; }, set alone(ids) { setAlone(ids); },
    get rooms() { return W0.rooms; }, set rooms(fn) { W0.rooms = fn || null; }, after: W0.after, sees: SEES, pmrem };
}
