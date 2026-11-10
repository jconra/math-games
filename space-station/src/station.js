// THE STATION, as the game draws it: the kit's own room file (kit/rooms/station.json) built by the kit's own code,
// with its saved light, the sky outside, the bloom, and each room's own picture of itself for its shine. This is the
// Kit Lab's way of showing the station (labs/kit/main.js) with nothing of the lab's menus: the lab and the game build
// the station from the same kit, so a change to a room shows in both.
//
//   const W = await loadStation({ canvas, quality, say })       say(fraction, words) as the loading moves on
//   W.frame(dt, now, eyes)   one drawn frame: which rooms are drawn, the doors (they open for any of `eyes`, the
//                            points where people are; a door in W.keepShut stays shut), the dust, the sky, the picture
//   W.view(name) / W.place(name) / W.room(id)                   the station file's named views, spots and rooms
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
import { buildRoom, updateDoors, setDoors, loadRoom, updateZones, zoneAt } from '../kit/layout.js';
import { loadBake } from '../kit/bakefile.js';
import { makeDust } from '../kit/dust.js';
import { makeBeams, beamsOf } from '../kit/beams.js';

// low: no bloom, 1x; medium: bloom, 1.5x; high: bloom, a sharper room picture, 2x (the Kit Lab's own three steps; the
// `bake` numbers are used only for a room whose saved light no longer matches it)
export const QUALITY = {
  low: { ratio: 1, bloom: false, bake: { voxel: 0.09, rays: 20, shadows: false }, probe: 64 },
  medium: { ratio: 1.5, bloom: true, bake: { voxel: 0.07, rays: 28, shadows: true }, probe: 128 },
  high: { ratio: 2, bloom: true, bake: { voxel: 0.05, rays: 40, shadows: true }, probe: 256 },
};
export const pickQuality = (asked) => (asked in QUALITY ? asked : (matchMedia('(pointer: coarse)').matches ? 'medium' : 'high'));

const RANGE = 34;   // (how far a room's own picture of itself looks, metres)
const FAR = new THREE.Vector3(1e6, 1e6, 1e6), ONE = [null];

// a pause long enough for the screen to be drawn (so the title's loading bar moves between the heavy steps); a
// hidden tab draws nothing, so it never waits on a frame for long
const breath = () => new Promise((done) => { let went = false; const go = () => { if (!went) { went = true; done(); } }; requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 120); });

export async function loadStation({ canvas, quality = null, rig = false, room = 'station', say = () => {} } = {}) {
  const qName = pickQuality(quality), Q = QUALITY[qName];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: rig });
  if (!renderer.capabilities.isWebGL2) throw new Error('This game needs WebGL2, which this browser does not have.');
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.74;
  renderer.shadowMap.enabled = false; renderer.info.autoReset = false;
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.ratio));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 0.03, 120);
  const mats = makeMaterials(), pmrem = new THREE.PMREMGenerator(renderer);
  const fill = new THREE.HemisphereLight(0xdde2e8, 0x5d6065, 0.75); scene.add(fill);
  const dust = makeDust(); dust.visible = false; scene.add(dust);
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
    rp.render = (...a) => { renderer.info.reset(); rpRender(...a); stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles; };
    composer.addPass(rp); composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.32, 2.2)); composer.addPass(new OutputPass());
  }
  function resize(force = false) {
    const w = Math.max(2, innerWidth), h = Math.max(2, innerHeight), pr = renderer.getPixelRatio();
    if (!force && canvas.width === Math.floor(w * pr) && canvas.height === Math.floor(h * pr)) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); }
  }
  resize(true);
  function draw(dt) {
    if (composer) composer.render(dt);
    else { renderer.info.reset(); renderer.render(scene, camera); stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles; }
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
  const built = buildRoom(R, mats, { bake: Q.bake, saved, zoneMats, compact: true });
  scene.add(built.group);
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
  let envTex = null;
  {
    const rt = new THREE.WebGLCubeRenderTarget(Q.probe, { type: THREE.HalfFloatType }), cc = new THREE.CubeCamera(0.05, 80, rt);
    cc.position.set(...(R.probe || R.views?.start?.at || R.spawn?.at || [0, 1.6, 0])); scene.add(cc);
    scene.environment = null; sky.object.visible = false;
    for (let i = 0; i < 2; i++) { cc.update(renderer, scene); const t = pmrem.fromCubemap(rt.texture).texture; if (envTex) envTex.dispose(); envTex = t; scene.environment = t; }
    sky.object.visible = true; scene.remove(cc); rt.dispose();
  }
  if (R.rooms) {
    await breath();
    const rt = new THREE.WebGLCubeRenderTarget(Q.probe, { type: THREE.HalfFloatType }), cc = new THREE.CubeCamera(0.05, 90, rt);
    scene.add(cc);
    for (let pass = 0; pass < 2; pass++) {
      say(0.7 + pass * 0.12, pass ? 'Polishing the floors' : 'Switching on the lights');
      const envs = [];
      for (const z of built.zones) {
        if (z.with) { envs.push(null); continue; }
        const c = z.box.getCenter(new THREE.Vector3());
        cc.position.set(...(z.probe || [c.x, z.box.min.y + 1.6, c.z]));
        updateZones(built, cc.position, RANGE); cc.update(renderer, scene);
        envs.push(pmrem.fromCubemap(rt.texture).texture);
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

  const keepShut = new Set();
  function frame(dt, now, eyes = null) {
    U.time.value = now;
    resize();
    if (built.zones.length > 1) updateZones(built, camera.position, RANGE, camera, R.portals);
    if (dust.visible) dust.userData.update(dt, camera.position);
    sky.update(dt);
    // each door opens for whoever is nearest it (the kit's doors sense one point at a time); a door in keepShut (one
    // that leads nowhere a person can stand: walls.js) stays shut
    for (const D of built.doors) {
      let best = FAR, bd = Infinity;
      if (eyes) for (const e of eyes) { const d = e.distanceToSquared(D.sense); if (d < bd) { bd = d; best = e; } }
      ONE[0] = D; updateDoors(ONE, best, dt, keepShut.has(D) ? 'shut' : 'auto');
    }
    draw(dt);
  }

  return { renderer, scene, camera, R, built, mats, sky, dust, fill, beams, stats, quality: qName, frame, resize, view, place, room: roomOf, envAt, zoneAt: (p) => zoneAt(built, p), keepShut, get env() { return envTex; } };
}
