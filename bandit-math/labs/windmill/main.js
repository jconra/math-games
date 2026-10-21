// THE WINDMILL TOWER LAB: build a windmill tower as high as a stack of lumber allows, then call the wind and see how
// much of it stands. A Bandit Math prototype page, standing on its own (it changes nothing in the game; it reads the
// game's fonts, ground textures, trees and townsfolk).
//
// This page is the builder's HOST on its own hilltop: it makes the renderer and the camera, the hilltop scene (scene.js
// makeScene: the sky, the hill, the mill house, the trees, the stones and the lumber pile, the wind blowing things by),
// and runs the frame loop. The builder itself (the lumber panel, placing boards, the twins, the miller and his
// questions, the wind test) is builder.js mountWindmill, the same one the game mounts at the mill hill in the valley.
// Here the miller's questions climb the lab's own ladder (kept in localStorage), and the best tower is kept there too.
//
// ?perf shows frames per second and draw calls, ?askall asks at every chance.
// window.WM: the builder's handle for test scripts (builder.js, the top of the file), plus WM.renderer.
import * as THREE from 'three';
import { makeScene, groundY } from './scene.js';
import { mountWindmill, ladderAsker, localBest, MARKUP } from './builder.js';

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
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 2000);   // (narrow, so the wall in front reads flat and square)
const world = makeScene({ low: phone });

let fps = 0;
const B = mountWindmill({
  root, scene: world.scene, origin: new THREE.Vector3(), camera,
  // (the canvas fills the view: it is sized to it, and the camera's shape is the view's)
  fit: (r) => { renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); },
  canvasRect: () => $('c').getBoundingClientRect(),
  yard: world, groundY, asker: ladderAsker(), best: localBest(), low: phone, fps: () => fps,
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

window.WM = Object.assign(B.handle, { renderer });
