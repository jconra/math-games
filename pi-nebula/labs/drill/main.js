// THE DRILL LAB: the drill operator's game by itself (the game's own code: src/drillview.js, src/drill.js,
// src/jobs/drill.js; nothing here is a copy), under the game's own sky, so it can be tried on a phone without walking
// through the station. A few plain switches along the top: a new field, the question on or off, the question's
// level. Errors show on the page (shared/oops.js).
// IN STEP WITH THE GAME'S FLYING AT THE ROCKS (the game's maker, 2026-11-18: "Either way, you should be able to click on
// an asteroid to travel over to it (If you want to fly and you signed up to be a pilot, you can click a button to fly
// manually if you want)", and "If you signed up for both there can be a button that lets you switch tasks"): whoever
// is in the lab has both jobs, so the button "Fly manually" is here, with the game's own flying (src/flying.js, joined
// to the drill's view by src/fieldfly.js): the same keys, sticks, two views and help corner, the rocks to bump into,
// the claw taking a rock the nose is brought up to, and "Back to the drill". And each new field is come to as in the
// game: out of the far end of the wormhole (src/wormhole.js), seen from the seat, then the eye glides out to the
// drill's view (?arrive=0: straight to the drill's view).
//   ?seed=7 the same field each time; ?ask=0; ?level=percent; ?bloom=0; ?rig=1 (for pictures); ?arrive=0
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createSky } from '../../world/sky.js';
import { buildShip, makeDrillView, ORE_LOOKS, ROCK_LOOKS } from '../../src/drillview.js';
import { startFlying } from '../../src/flying.js';
import { makeFieldFlying } from '../../src/fieldfly.js';
import { makeWormhole } from '../../src/wormhole.js';
import { seeded } from '../../src/drill.js';
import { JOB as SCAN } from '../../src/jobs/drill.js';
import { lotsWords, sellsFor } from '../../src/jobs/smelter.js';
import * as E from '../../src/jobs/engine.js';
import { setLevelAt } from '../../../mathwood-valley/src/levels/model.js';

const Q = new URLSearchParams(location.search), $ = (id) => document.getElementById(id);
const canvas = $('c'), rigged = Q.has('rig');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: rigged });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.74;
renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.5 : 2)); renderer.info.autoReset = false;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 1, 0.3, 2400);
scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x20262e, 0.55));
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const sky = createSky(renderer, { quality: matchMedia('(pointer: coarse)').matches ? 'medium' : 'high' }); scene.add(sky.object);

// the picture: through the game's own bloom (src/station.js), or straight to the screen (?bloom=0)
let composer = null;
const stats = { calls: 0, tris: 0, ms: 0 };
if (Q.get('bloom') !== '0') {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2()).max(new THREE.Vector2(2, 2));
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 }));
  const rp = new RenderPass(scene, camera), rpRender = rp.render.bind(rp);
  rp.render = (...a) => { renderer.info.reset(); rpRender(...a); stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles; };
  composer.addPass(rp); composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.32, 2.2)); composer.addPass(new OutputPass());
}
function resize() {
  const w = Math.max(2, innerWidth), h = Math.max(2, innerHeight);
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
}
addEventListener('resize', resize); resize();
// (the game's own boxes sit under this page's top bar, however many rows it wraps to)
const topBar = () => document.documentElement.style.setProperty('--pdr-top', document.getElementById('top').offsetHeight + 'px');
new ResizeObserver(topBar).observe(document.getElementById('top')); topBar();

// ── the switches ──
// (ore: how the ore in the rocks is shown: 'glow' as the game shows it, 'veins', 'sparkle', 'cracks' or 'crystals', for
// the game's maker to choose between: the Ore button goes round them; ?ore=sparkle starts with that one)
const st = { ask: Q.get('ask') !== '0', seed: Q.has('seed') ? +Q.get('seed') : null, n: 0, ore: ORE_LOOKS.includes(Q.get('ore')) ? Q.get('ore') : 'dots', rock: ROCK_LOOKS.includes(Q.get('rock')) ? Q.get('rock') : 'natural' };
const crew = { id: 'drill-lab', name: 'Driller' };
E.register(SCAN);
const levelEl = $('level');
levelEl.innerHTML = SCAN.place.levels.map((L, i) => `<option value="${L.id}">Question ${i + 1}: ${L.title}</option>`).join('');
const setLevel = (id) => { try { setLevelAt(crew, 'drill', id); levelEl.value = id; } catch (e) { /* no such level */ } };
setLevel(SCAN.place.levels.some((L) => L.id === Q.get('level')) ? Q.get('level') : 'part');
const paint = () => { $('ask').textContent = 'Question: ' + (st.ask ? 'on' : 'off'); $('ask').setAttribute('aria-pressed', String(st.ask)); $('ore').textContent = 'Ore: ' + st.ore; $('rock').textContent = 'Rock: ' + st.rock; };
const note = (w) => { $('note').textContent = w; };

// ── the game ──
// (the ship stands turned so the planet and its rings are off to the left of the looking view)
const AT = new THREE.Matrix4().makeRotationY(-0.62);
let ship = null, view = null, FF = null;
// (what the flying needs of a game: the picture, the scene, the camera)
const LABW = { renderer, scene, camera, after: new Set(), dust: null, sees: 2400 };
const hole = makeWormhole({ scene, quality: matchMedia('(pointer: coarse)').matches ? 'medium' : 'high' });
const kept = (() => { try { return JSON.parse(localStorage.getItem('pi-nebula.flightlab')) || {}; } catch (e) { return {}; } })();
function start() {
  if (FF) { FF.close(); FF = null; }
  if (view) view.close();
  const rand = st.seed != null ? seeded(st.seed + st.n) : Math.random; st.n++;
  view = makeDrillView({ scene, camera, renderer, ship, at: AT, crew, rand, ask: st.ask, ore: st.ore, rock: st.rock, lab: true, flier: 'The autopilot', pilot: true, onFly: () => { if (FF) FF.fly(); },
    onDone: (r) => { const m = Math.floor(r.secs / 60), s = Math.round(r.secs % 60); st.last = r; note(`The last load${r.early ? " (home early, each part-full canister rounded to the nearest 1/8)" : ""}: ${lotsWords(sellsFor(r.store).lots)}, from ${r.stats.rocks} rocks and ${r.stats.holes} holes (${r.stats.bare} in bare rock), in ${m} min ${s} s. It would sell for ${r.sells.toLocaleString('en-US')} credits: the drill operator's share ${Math.round(r.sells * 0.2).toLocaleString('en-US')}. A new field is up.`); start(); } });
  // THE FLYING, KEPT AT THE ROCKS, as in the game: from the seat while the wormhole's far end opens on the field, then
  // the eye glides out to the drill's view ("flip up and down" is the Flight Lab's own, kept in this browser)
  FF = makeFieldFlying({ W: LABW, drill: view, startFlying, pilot: true, flier: 'The autopilot', settings: kept, onSettings: (set) => { try { localStorage.setItem('pi-nebula.flightlab', JSON.stringify(set)); } catch (e) { /* blocked: not kept */ } }, words: () => {} });
  if (Q.get('arrive') === '0') { hole.stop(); FF.out(0.01); } else hole.arrive({ onDone: () => { if (FF) FF.out(2.4); } });
  window.DRILLLAB.view = view; window.DRILLLAB.field = FF;
  if (st.set) view.oreSet(st.set); paintSet();
}
$('new').addEventListener('click', () => { note(''); start(); });
$('ask').addEventListener('click', () => { st.ask = !st.ask; paint(); start(); });
$('ore').addEventListener('click', () => { st.ore = ORE_LOOKS[(ORE_LOOKS.indexOf(st.ore) + 1) % ORE_LOOKS.length]; if (view) { view.oreLook(st.ore); st.set = view.oreSet(); } paint(); paintSet(); });
// THE LOOK'S SLIDERS (the game's maker, from his phone: "give me some controls for glow and dots"): the soft glow under
// the ore, how many dots, how big a dot, how hard the light falls on the rocks, and how bright the dust round the field is. A look starts with its own.
const RNG = ['glow', 'dots', 'size', 'light', 'dust'];
// (put away behind one button, so a phone's screen is not full of them: pressed, they show)
$('sliders').addEventListener('click', () => { const on = !$('top').classList.contains('is-sliders'); $('top').classList.toggle('is-sliders', on); $('sliders').setAttribute('aria-pressed', String(on)); });
function paintSet() { if (!view) return; const S = view.oreSet(); for (const k of RNG) { const el = $(k); el.value = S[k]; el.parentElement.querySelector('b').textContent = (+S[k]).toFixed(2); } }
for (const k of RNG) $(k).addEventListener('input', () => { if (!view) return; st.set = view.oreSet({ [k]: +$(k).value }); paintSet(); });
$('rock').addEventListener('click', () => { st.rock = ROCK_LOOKS[(ROCK_LOOKS.indexOf(st.rock) + 1) % ROCK_LOOKS.length]; if (view) view.rockLook(st.rock); paint(); });
levelEl.addEventListener('change', () => { setLevel(levelEl.value); });
paint();

// one step of the game's clock: the drill's view, the flying, the wormhole, then the eye
function tick(dt) { view.update(dt); FF.update(dt); hole.update(dt); FF.aim(camera, dt); if (hole.on) hole.place(camera, FF.matrix); }
window.DRILLLAB = { ready: false, view: null, field: null, hole, renderer, scene, camera, stats, crew, st, start, three: THREE,
  // (a rig's own clock: so many seconds of the game at once, then one picture)
  step(secs, dt = 1 / 30) { for (let t = 0; t < secs; t += dt) tick(dt); frame(0); } };

let last = performance.now(), held = false;
function frame(dt) {
  sky.update(dt);
  const t0 = performance.now();
  if (composer) composer.render(dt); else { renderer.info.reset(); renderer.render(scene, camera); stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles; }
  stats.ms = performance.now() - t0;
  // (whatever is drawn over the picture once it is drawn: W.after, as the station's own frame has it)
  for (const f of LABW.after) f(renderer);
}
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!view || held) return;
  tick(dt); frame(dt);
}
window.DRILLLAB.hold = (on) => { held = !!on; };

ship = await buildShip();
start();
$('loading').remove();
window.DRILLLAB.ready = true;
requestAnimationFrame(loop);
