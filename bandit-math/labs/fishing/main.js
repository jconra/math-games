// THE FISHING LAB: fish off the end of a dock, and every fish that comes up asks a fractions or ratio question. A Bandit
// Math prototype page, standing on its own (it changes nothing in the game; it reads the game's fonts, ground
// textures, trees, the cabin and the townsfolk, and borrows the windmill lab's teach card and wood pictures).
//
// This file is the lab page's HOST: its renderer, its own lake (scene.js makeLake), the frame loop, the lab's own
// question ladder and records in localStorage. The fishing itself (the cast, the reel, the card, the stringer, the
// fish book) is builder.js mountFishing, which the game mounts at its own dock too (src/fishingjob.js).
//
// Files: builder.js (the fishing), scene.js (the lake; the dock and the rings both use), angler.js (the person, the
// rod, line and bobber), fish.js (fish made in code), questions.js (the math), frac.js (exact fractions and the
// words), pics.js (the pictures), sound.js.
// ?perf shows frames a second; ?fast makes the fish bite quickly; ?step=N starts on step N (1 to 8).
// window.FI, a handle for test scripts: builder.js's handle (FI.state(), FI.question(), FI.toScreen(x, y, z),
//   FI.waterSpot(x, z), FI.bobber(), FI.view(...)), with FI.fps(), FI.setStep(n), FI.renderInfo() from here.
import * as THREE from 'three';
import { makeLake } from './scene.js';
import { mountFishing, ladderAsker, localRecords } from './builder.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const phone = matchMedia('(max-width: 700px)').matches || /Mobi|Android/i.test(navigator.userAgent);

// ── the renderer, camera, lake ─────────────────────────────────────────────────────────────────────────────────────
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
// (near 0.1 m: nothing comes closer to the lens, even held up to look at; far 1500 m: past the far hills, the sky is
// drawn at the far plane anyway. A tight range keeps the depth sorting sharp for small things on the dock.)
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1500);
const lake = makeLake({ low: phone });
const { scene } = lake;
renderer.setSize(innerWidth, innerHeight, false);

// ── the fishing, mounted on this page ────────────────────────────────────────────────────────────────────────────────
const asker = ladderAsker({ start: params.has('step') ? params.get('step') : null });
const B = mountFishing({
  root: $('app'), scene, camera, canvasRect: () => canvas.getBoundingClientRect(),
  dock: lake.kit, water: { isWater: lake.isWater, ripple: lake.ripple, update: lake.update },
  asker, records: localRecords(), fast: params.has('fast'),
});
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); B.resize(); });

// ── the loop ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const perf = params.has('perf');
let last = performance.now(), frames = 0, fpsT = 0, fps = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  B.frame(dt);
  renderer.render(scene, camera);
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; if (perf) { $('perf').hidden = false; $('perf').textContent = `${fps.toFixed(0)} fps · ${renderer.info.render.calls} draws · ${renderer.info.render.triangles} tris`; } }
}
requestAnimationFrame(loop);
const ready = Promise.all([B.ready, Promise.race([lake.treeLoad, new Promise((r) => setTimeout(r, 7000))])]);
ready.then(() => $('loading').classList.add('is-done'));
setTimeout(() => $('loading').classList.add('is-done'), 9000);

// ── a handle for test scripts ────────────────────────────────────────────────────────────────────────────────────────
window.FI = {
  ...B.handle,
  fps: () => fps,
  setStep: (n) => asker.setStep(n),
  renderInfo: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
};
