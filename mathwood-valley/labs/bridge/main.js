// THE BRIDGE LAB: build a bridge across the western river from a stack of lumber, lay its deck, then send loads across
// it, lighter to heavier, and see what it carries. A Mathwood Valley prototype page, standing on its own (it changes nothing
// in the game; it reads the game's fonts, textures, trees, people, animals and wagons).
//
// This page is the builder's HOST at its own river crossing: it makes the renderer and the camera, the scene (scene.js
// makeScene: the sky, the banks and the river, the stone abutments, the road, the engineer's camp and wagon, the trees,
// the lumber and plank piles), and runs the frame loop. The builder itself (the lumber panel, placing boards, the twins,
// the deck, the engineer and his questions, the crossing test) is builder.js mountBridge, the same one the game mounts
// at the ravine on the western river in the valley. Here the engineer's questions climb the lab's own ladder (kept in
// localStorage), and the best rating is kept there too.
//
// ?perf shows frames per second and draw calls, ?askall asks at every chance, ?bridge=<code> (from a result card's
// "Copy this bridge") puts that bridge up.
// window.BR: the builder's handle for test scripts (builder.js, the top of the file), plus BR.renderer.
import * as THREE from 'three';
import { makeScene, groundY } from './scene.js';
import { mountBridge, ladderAsker, localBest, MARKUP } from './builder.js';
import { decodeBridge } from './bridge.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const phone = matchMedia('(max-width: 700px)').matches || /Mobi|Android/i.test(navigator.userAgent);

// the page: the lumber panel and the view, with the view's own canvas
const root = $('app');
root.innerHTML = MARKUP;
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const camera = new THREE.PerspectiveCamera(30, 1, 0.3, 1000);   // (near 0.3, far just past the sky dome: depth to spare for the painted letters)
const world = makeScene({ low: phone });

let fps = 0;
const B = mountBridge({
  root, scene: world.scene, origin: new THREE.Vector3(), camera,
  // (the canvas fills the view: it is sized to it, and the camera's shape is the view's)
  fit: (r) => { renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); },
  canvasRect: () => $('c').getBoundingClientRect(),
  yard: world, groundY, waterY: world.water.position.y, asker: ladderAsker(), best: localBest(), low: phone, fps: () => fps, az: -0.38,
});

// ── the loop ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let frames = 0, fpsT = 0;
const perf = params.has('perf');
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  B.frame(dt);
  // the sun's shadow box follows the camera's target
  const look = B.cam.look;
  world.sun.position.set(look.x - 0.55 * 40, 0.62 * 40, look.z + 0.56 * 40); world.sun.target.position.copy(look); world.sun.target.position.y = 0;
  renderer.render(world.scene, camera);
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; if (perf) { $('perf').hidden = false; $('perf').textContent = `${fps.toFixed(0)} fps · ${renderer.info.render.calls} draws`; } }
}
loop();
world.treeLoad.then(() => { $('loading').classList.add('is-done'); });
setTimeout(() => $('loading').classList.add('is-done'), 6000);

window.BR = Object.assign(B.handle, { renderer });
// ?bridge=<code> (from a result card's "Copy this bridge"): that bridge put up, its deck laid if it had one
{
  const code = params.get('bridge'), want = code ? decodeBridge(code) : null;
  if (want) setTimeout(() => { try { window.BR.load({ S: want.S, D: want.D, boards: want.boards }); if (want.deck) window.BR.layDeck(); } catch (e) { console.warn('bridge lab: that bridge code did not load', e); } }, 300);
}
