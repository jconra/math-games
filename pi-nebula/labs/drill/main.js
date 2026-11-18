// THE DRILL LAB: the drill operator's game by itself (the game's own code: src/drillview.js, src/drill.js,
// src/jobs/drill.js; nothing here is a copy), under the game's own sky, so it can be tried on a phone without walking
// through the station. A few plain switches along the top: a new field, the rich rock on or off, the question on or
// off, the field (the mix of metals a trip meets, or one metal only), the question's level. Errors show on the page
// (shared/oops.js).
//   ?seed=7 the same field each time; ?rich=1; ?ask=0; ?metal=nickel (that metal only); ?level=percent; ?bloom=0;
//   ?rig=1 (for pictures)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createSky } from '../../world/sky.js';
import { buildShip, makeDrillView } from '../../src/drillview.js';
import { seeded, USUAL } from '../../src/drill.js';
import { JOB as SCAN } from '../../src/jobs/drill.js';
import { lotsWords } from '../../src/jobs/smelter.js';
import * as E from '../../src/jobs/engine.js';
import { setLevelAt } from '../../../mathwood-valley/src/levels/model.js';

const Q = new URLSearchParams(location.search), $ = (id) => document.getElementById(id);
const canvas = $('c'), rigged = Q.has('rig');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: rigged });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.74;
renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.5 : 2)); renderer.info.autoReset = false;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 1, 0.3, 900);
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
const st = { rich: Q.get('rich') === '1', ask: Q.get('ask') !== '0', metal: USUAL.includes(Q.get('metal')) ? Q.get('metal') : '', seed: Q.has('seed') ? +Q.get('seed') : null, n: 0 };
const crew = { id: 'drill-lab', name: 'Driller' };
E.register(SCAN);
const levelEl = $('level'), metalEl = $('metal');
levelEl.innerHTML = SCAN.place.levels.map((L, i) => `<option value="${L.id}">Question ${i + 1}: ${L.title}</option>`).join('');
metalEl.innerHTML = '<option value="">Mixed field</option>' + USUAL.map((m) => `<option value="${m}">${m[0].toUpperCase() + m.slice(1)} only</option>`).join('');
metalEl.value = st.metal;
const setLevel = (id) => { try { setLevelAt(crew, 'drill', id); levelEl.value = id; } catch (e) { /* no such level */ } };
setLevel(SCAN.place.levels.some((L) => L.id === Q.get('level')) ? Q.get('level') : 'part');
const paint = () => { $('rich').textContent = 'Rich rock: ' + (st.rich ? 'on' : 'off'); $('rich').setAttribute('aria-pressed', String(st.rich)); $('ask').textContent = 'Question: ' + (st.ask ? 'on' : 'off'); $('ask').setAttribute('aria-pressed', String(st.ask)); };
const note = (w) => { $('note').textContent = w; };

// ── the game ──
// (the ship stands turned so the planet and its rings are off to the left of the looking view)
const AT = new THREE.Matrix4().makeRotationY(-0.62);
let ship = null, view = null;
function start() {
  if (view) view.close();
  const rand = st.seed != null ? seeded(st.seed + st.n) : Math.random; st.n++;
  view = makeDrillView({ scene, camera, renderer, ship, at: AT, crew, metal: st.metal || null, rich: st.rich, rand, ask: st.ask, lab: true,
    // (what it would sell for is with 3/4 of a tonne of ore in each canister: a run whose jump out the crew's own pilot flew)
    onDone: (r) => { const m = Math.floor(r.secs / 60), s = Math.round(r.secs % 60); st.last = r; note(`The last load: ${lotsWords(r.lots)}, from ${r.stats.rocks} rocks and ${r.stats.holes} holes (${r.stats.wasted} in bare rock), in ${m} min ${s} s. It would sell for ${r.sells.toLocaleString('en-US')} credits: the drill operator's share ${Math.round(r.sells * 0.2).toLocaleString('en-US')}. A new field is up.`); start(); } });
  window.DRILLLAB.view = view;
}
$('new').addEventListener('click', () => { note(''); start(); });
$('rich').addEventListener('click', () => { st.rich = !st.rich; paint(); start(); });
$('ask').addEventListener('click', () => { st.ask = !st.ask; paint(); start(); });
metalEl.addEventListener('change', () => { st.metal = metalEl.value; start(); });
levelEl.addEventListener('change', () => { setLevel(levelEl.value); });
paint();

window.DRILLLAB = { ready: false, view: null, renderer, scene, camera, stats, crew, st, start, three: THREE,
  // (a rig's own clock: so many seconds of the game at once, then one picture)
  step(secs, dt = 1 / 30) { for (let t = 0; t < secs; t += dt) { view.update(dt); view.aim(camera, dt); } frame(0); } };

let last = performance.now(), held = false;
function frame(dt) {
  sky.update(dt);
  const t0 = performance.now();
  if (composer) composer.render(dt); else { renderer.info.reset(); renderer.render(scene, camera); stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles; }
  stats.ms = performance.now() - t0;
}
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!view || held) return;
  view.update(dt); view.aim(camera, dt); frame(dt);
}
window.DRILLLAB.hold = (on) => { held = !!on; };

ship = await buildShip();
start();
$('loading').remove();
window.DRILLLAB.ready = true;
requestAnimationFrame(loop);
