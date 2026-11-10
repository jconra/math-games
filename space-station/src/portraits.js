// THE LOOKS' PICTURES, drawn in the player's own browser from the crew kit: the very files (kit/crew.js and
// assets/crew/) the game's people are built from. Nothing is pasted in: when a head, a hair or an outfit is improved,
// the title screen's pictures show it on the next visit, with nothing to remake.
//
//   drawLooks(lib, { first })   draws every look in src/looks.js (the ids in `first` before the rest), one at a time,
//                               then closes its small drawing board
//   pictureOf(id, kind)         a look's picture ('face': head and shoulders, 'body': the whole person) as an address
//                               for CSS or an <img>, or null while it is still being drawn
//   onPicture(fn)               fn(id) as each look's two pictures arrive
//   shoot(lib, recipe, kind, pose)   one picture of any recipe, as a data: address (the picture page and its rig use it)
//
// While a visit's pictures are being drawn the last visit's are shown (kept in this browser), so the cards are not
// empty on a second visit; the first visit shows the empty frames for a few seconds.
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
const PICS = new Map(), heard = new Set();
const toBlobURL = (data) => {
  const [head, b64] = data.split(','), bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: head.slice(5).split(';')[0] }));
};
function put(id, kind, data) {
  const old = PICS.get(id + '_' + kind); if (old) URL.revokeObjectURL(old);
  PICS.set(id + '_' + kind, toBlobURL(data));
}
// (the last visit's, shown until this visit's are drawn)
let kept = {};
try { kept = JSON.parse(localStorage.getItem(KEEP) || '{}') || {}; } catch (e) { kept = {}; }
for (const l of LOOKS) for (const kind of ['face', 'body']) { const d = kept[l.id + '_' + kind]; if (typeof d === 'string' && d.startsWith('data:image/')) try { put(l.id, kind, d); } catch (e) { /* a broken keep: drawn again below */ } }

export const pictureOf = (id, kind = 'face') => PICS.get(lookById(id).id + '_' + kind) || null;
export const onPicture = (fn) => { heard.add(fn); return () => heard.delete(fn); };
export const drawn = { looks: 0, ms: 0, done: false, failed: null };

const breath = () => new Promise((go) => { requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 100); });
export async function drawLooks(lib, { first = [] } = {}) {
  const t0 = performance.now(), ids = [...new Set([...first.filter(Boolean), ...LOOKS.map((l) => l.id)])].filter((id) => LOOKS.some((l) => l.id === id));
  const keep = {};
  try {
    for (const id of ids) {
      const got = await draw(lib, recipeOf({ id }), ['body', 'face']);
      for (const kind of ['face', 'body']) { put(id, kind, got[kind]); keep[id + '_' + kind] = got[kind]; }
      drawn.looks++;
      for (const fn of heard) { try { fn(id); } catch (e) { console.error(e); } }
      await breath();
    }
  } catch (e) { drawn.failed = String(e && e.message || e); throw e; } finally { closeStudio(); drawn.ms = Math.round(performance.now() - t0); drawn.done = true; }
  try { localStorage.setItem(KEEP, JSON.stringify(keep)); } catch (e) { /* full: drawn again next visit */ }
}
