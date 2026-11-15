// THE LOOKS' PICTURES, drawn from the crew kit: the very files (kit/crew.js and assets/crew/) the game's people are
// built from. The title shows them READY-MADE: stored in assets/looks/ by a rig that runs this same studio
// (~/pw/space-math/rigs/portraits/make.cjs; re-run it whenever a head, a hair, an outfit or the stance changes), so all
// eight are on the screen as the page opens.
//
//   pictureOf(id, kind)         a look's picture ('face': head and shoulders, 'body': the whole person) as an address
//                               for CSS or an <img>, or null while it is still on its way
//   onPicture(fn)               fn(id) as each look's two pictures arrive (the stored ones all together)
//   storedReady                 a promise: the stored pictures are in; it gives the ids that had none
//   drawLooks(lib, { only })    draws looks here in the browser (those with no stored picture), one at a time
//   drawLook(lib, id)           one look's two pictures as data: addresses (the rig stores these)
//   shoot(lib, recipe, kind, pose)   one picture of any recipe, as a data: address (the picture page and its rig use it)
//
// How a picture is made: the person is built with the crew kit's makeCrew, stood in the listening stance (POSE: the
// arms hang by the sides; the plain Idle holds them out, which in a still picture reads as a shop dummy), lit by a
// small studio (a soft room all round, a key light high to one side, a cool fill, a light from behind so dark hair and
// a dark uniform stand off the dark glass), drawn at twice the size and scaled down, on a see-through background.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeCrew } from '../kit/crew.js';
import { LOOKS, lookById, recipeOf } from './looks.js';

// the pictures' sizes (the title shows a face at 44 to 110 px and a body at up to about 270 px tall: these are about
// twice that, for sharp screens)
export const SIZES = { face: [224, 224], body: [300, 540] };
export const POSE = { clip: 'Stand_Listen', at: 0.6 };
const OVER = 2;
const KEEP = 'calc-station.looks.pictures';     // (the last visit's pictures, in this browser)

// ── the studio ─────────────────────────────────────────────────────────────────────────────────────────────────
let studio = null;
function openStudio() {
  if (studio) return studio;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x3a4048, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(2.5, 5, 3.5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  for (const [k, v] of Object.entries({ left: -2, right: 2, top: 3, bottom: -1, near: 0.5, far: 14 })) sun.shadow.camera[k] = v;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfd8ff, 0.9); fill.position.set(-3, 2.5, 2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xcfe6ff, 2.2); rim.position.set(-2.4, 3.2, -3.6); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 60);
  const out = document.createElement('canvas');
  studio = { canvas, renderer, scene, camera, pmrem, out, pen: out.getContext('2d') };
  return studio;
}
export function closeStudio() {
  if (!studio) return;
  studio.scene.environment.dispose(); studio.pmrem.dispose(); studio.renderer.dispose(); studio.renderer.forceContextLoss();
  studio = null;
}

const _h = new THREE.Vector3(), _t = new THREE.Vector3();
// one person, posed, drawn as each kind asked for: { face: data address, body: ... }
async function draw(lib, recipe, kinds, pose = null) {
  const S = openStudio(), stand = { ...POSE, ...(pose || {}) }, got = {};
  const c = await makeCrew(lib, recipe);
  S.scene.add(c.root);
  c.play(stand.clip, { fade: 0 }); c.update(0); c.update(stand.at);
  for (const kind of kinds) {
    const [w, h] = SIZES[kind] || SIZES.face, cam = S.camera;
    c.root.updateMatrixWorld(true);
    c.bones.Head.getWorldPosition(_h); _h.y += 0.09; _h.z += 0.03;   // (the middle of the head)
    if (kind === 'body') {
      // the whole person: a little room over the head, the feet at the bottom edge
      const top = _h.y + 0.2, bottom = -0.03, tall = top - bottom;
      cam.fov = 22; _t.set(0, (top + bottom) / 2, 0);
      const d = tall / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      cam.position.set(d * 0.24, _t.y + d * 0.05, d * 0.97);
    } else {
      // the head, with the collar under it, turned a little
      cam.fov = 24; _t.set(_h.x, _h.y - 0.04, _h.z - 0.03);
      cam.position.set(_t.x + 0.26, _t.y + 0.04, _t.z + 0.88);
    }
    cam.aspect = w / h; cam.updateProjectionMatrix(); cam.lookAt(_t);
    // the eyes on whoever looks at the picture (held still), then a moment for the eyes to settle
    c.lookAt(cam.position, { dart: false }); c.update(0.3);
    S.renderer.setSize(w * OVER, h * OVER, false);
    S.renderer.shadowMap.needsUpdate = true;
    S.renderer.render(S.scene, cam);
    S.out.width = w; S.out.height = h;
    S.pen.clearRect(0, 0, w, h); S.pen.imageSmoothingEnabled = true; S.pen.imageSmoothingQuality = 'high';
    S.pen.drawImage(S.canvas, 0, 0, w, h);
    got[kind] = S.out.toDataURL('image/webp', 0.9);
  }
  S.scene.remove(c.root); c.dispose();
  return got;
}

// one picture of a look (by id) or of any recipe
export async function shoot(lib, what, kind = 'face', pose = null) {
  const recipe = typeof what === 'string' ? recipeOf({ id: lookById(what).id }) : what;
  return (await draw(lib, recipe, [kind], pose))[kind];
}

// ── the title's pictures ───────────────────────────────────────────────────────────────────────────────────────
// READY-MADE (2026-11-15): the title shows the pictures stored in assets/looks/ (small WebP files, drawn by this same
// studio by a rig: ~/pw/space-math/rigs/portraits/make.cjs, re-run whenever the crew kit changes), so all eight
// appear together as the page opens, while the 3D crew loads behind. They are fetched as soon as this file runs and
// shown only when every one has arrived (the game's maker: "It seemed like one model showed up and the other ones
// too a long time"). A look with no stored picture (one added since the rig last ran) is drawn here in the browser.
export const STORED = new URL('../assets/looks/', import.meta.url).href;
const PICS = new Map(), heard = new Set();
// (what the stored list says: when the rig drew them, and about how many bytes a whole first load of the game is)
const info = { made: null, bytes: 0 };
export const storedInfo = () => info;
export const pictureOf = (id, kind = 'face') => PICS.get(lookById(id).id + '_' + kind) || null;
export const onPicture = (fn) => { heard.add(fn); return () => heard.delete(fn); };
export const drawn = { looks: 0, ms: 0, done: false, failed: null, stored: 0, storedMs: 0 };
const tell = (id) => { for (const fn of heard) { try { fn(id); } catch (e) { console.error(e); } } };
try { localStorage.removeItem('calc-station.looks.pictures'); } catch (e) { /* (the old in-browser keep: not used now) */ }

// the stored pictures' list (looks.json: { made, bytes, pictures: { id: { face, body } } }), then every picture, held
// back until all are in; resolves to the ids still without pictures (to be drawn here)
const t0 = performance.now();
export const storedReady = (async () => {
  let list = null;
  try { const r = await fetch(STORED + 'looks.json', { cache: 'no-cache' }); if (r.ok) list = await r.json(); } catch (e) { /* none: all drawn here */ }
  info.made = list && list.made || null; info.bytes = list && +list.bytes || 0;
  const v = list && list.made ? '?v=' + encodeURIComponent(list.made) : '';
  const got = await Promise.all(LOOKS.map(async (l) => {
    const files = list && list.pictures && list.pictures[l.id];
    if (!files || !files.face || !files.body) return null;
    try {
      const urls = ['face', 'body'].map((k) => STORED + files[k] + v);
      await Promise.all(urls.map((u) => { const im = new Image(); im.src = u; return im.decode(); }));
      return [l.id, urls];
    } catch (e) { return null; }
  }));
  for (const g of got) if (g) { PICS.set(g[0] + '_face', g[1][0]); PICS.set(g[0] + '_body', g[1][1]); drawn.stored++; }
  drawn.storedMs = Math.round(performance.now() - t0);
  for (const g of got) if (g) tell(g[0]);
  return LOOKS.filter((l, i) => !got[i]).map((l) => l.id);
})();
const toBlobURL = (data) => {
  const [head, b64] = data.split(','), bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: head.slice(5).split(';')[0] }));
};
const breath = () => new Promise((go) => { requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 100); });
// draws the looks named (all by default) here in the browser, one at a time
export async function drawLooks(lib, { only = null } = {}) {
  const t0 = performance.now(), ids = (only || LOOKS.map((l) => l.id)).filter((id) => LOOKS.some((l) => l.id === id));
  try {
    for (const id of ids) {
      const got = await draw(lib, recipeOf({ id }), ['body', 'face']);
      for (const kind of ['face', 'body']) PICS.set(id + '_' + kind, toBlobURL(got[kind]));
      drawn.looks++;
      tell(id);
      await breath();
    }
  } catch (e) { drawn.failed = String(e && e.message || e); throw e; } finally { closeStudio(); drawn.ms = Math.round(performance.now() - t0); drawn.done = true; }
}
// one look's two pictures as data: addresses (the rig that stores them uses this)
export const drawLook = async (lib, id) => { try { return await draw(lib, recipeOf({ id }), ['body', 'face']); } finally { closeStudio(); } };
