// THE CREW LAB'S PICTURE BUTTONS (2026-11-11; the game's maker: "It would be cool if the Body, Head, and Hair menus had a
// grid with picture buttons I could click"). Each outfit, head and hair has a small picture, drawn in this browser from
// the crew kit itself (kit/crew.js makeCrew: the very parts the game wears), so a part improved shows improved:
//   an outfit   on a plain grey stand-in (a head painted plain grey, no hair), from the knees up, turned a little
//   a head      on its own (no outfit, no hands, no hair), front three-quarter
//   a hair      on a plain grey head (STAND_HEAD), front three-quarter from a little above; "No hair": the head bare.
//               The buzz cut, which is paint on the skin, on the head in its own skin
// drawn PX x PX (twice that, scaled down) on a see-through background, one at a time, only when a window with that grid
// is opened (so the lab opens as fast as ever), by a small drawing board of its own (a second WebGL canvas, closed when
// its list is done). Kept for this browser tab (sessionStorage, under STORE): opening the window again shows them at once.
//   const T = makeThumbs(lib)    T.get(kind, id) -> data: address or null; T.want(kind, ids) draws the ones missing, in
//   order; T.onPicture(fn) -> fn(kind, id, address) as each arrives; T.drawn: how many this visit, T.ms the time drawing
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeCrew } from '../../kit/crew.js';

export const PX = 88, STORE = 'crewlab.thumbs.v2';
const OVER = 2;
// (the stand-in head under the hair and in the outfits, painted plain grey: the 30s man's, a plain everyday skull)
export const STAND_HEAD = 't6';
const GREY = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.72, metalness: 0.0 });

export function makeThumbs(lib) {
  const pics = new Map(), heard = new Set();
  try { const j = JSON.parse(sessionStorage.getItem(STORE) || '{}'); for (const [k, v] of Object.entries(j || {})) if (typeof v === 'string' && v.startsWith('data:image/')) pics.set(k, v); } catch (_) { /* none kept */ }
  const keep = () => { try { sessionStorage.setItem(STORE, JSON.stringify(Object.fromEntries(pics))); } catch (_) { /* full: drawn again next time */ } };
  let studio = null;
  function open() {
    if (studio) return studio;
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0); renderer.setSize(PX * OVER, PX * OVER, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene(), pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.HemisphereLight(0xdfeaff, 0x3a4048, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(2.5, 5, 3.5); scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfd8ff, 0.9); fill.position.set(-3, 2.5, 2); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xcfe6ff, 2.0); rim.position.set(-2.4, 3.2, -3.6); scene.add(rim);
    const out = document.createElement('canvas'); out.width = PX; out.height = PX;
    studio = { canvas, renderer, scene, pmrem, camera: new THREE.PerspectiveCamera(24, 1, 0.05, 40), out, pen: out.getContext('2d') };
    return studio;
  }
  function close() {
    if (!studio) return;
    studio.scene.environment.dispose(); studio.pmrem.dispose(); studio.renderer.dispose(); studio.renderer.forceContextLoss();
    studio = null;
  }
  // (a suit on the skeleton a head was made for: the outfits' grid uses each outfit's own)
  const suitFor = (head) => ((lib.entry('head', head) || {}).skeleton === 'f' ? 'atlantis2' : 'atlantis1');
  const _h = new THREE.Vector3(), _t = new THREE.Vector3();
  async function draw(kind, id) {
    const S = open();
    const recipe = kind === 'suit' ? { suit: id, head: STAND_HEAD, hair: null }
      : kind === 'head' ? { suit: suitFor(id), head: id, hair: null, hand: null }
        : { suit: suitFor(STAND_HEAD), head: STAND_HEAD, hair: id || null, hand: null };
    const c = await makeCrew(lib, recipe);
    S.scene.add(c.root);
    const clip = c.person.actions.Stand_Listen ? 'Stand_Listen' : 'Idle';
    c.play(clip, { fade: 0 }); c.update(0); c.update(0.6);
    if (c.gaze) c.lookAt(null);
    const M = c.meshes, paintHair = kind === 'hair' && !!c.paint && !M.hair;   // (a cut that is paint alone, on the skin)
    // (the outfit and hands left out of a head's or a hair's picture; the stand-in head plain grey, its eyes shut away)
    if (kind !== 'suit') for (const k of ['suit', 'hand']) if (M[k]) M[k].visible = false;
    if (kind === 'suit' || (kind === 'hair' && !paintHair)) {
      if (M.head) M.head.material = GREY;
      for (const k of ['eyes', 'cornea', 'visor']) if (M[k]) M[k].visible = false;
    }
    c.root.updateMatrixWorld(true);
    c.bones.Head.getWorldPosition(_h); _h.y += 0.09; _h.z += 0.03;
    const cam = S.camera;
    if (kind === 'suit') {
      // (from the knees up: the outfit, its collar and the stand-in's grey head)
      const topY = _h.y + 0.14, bottom = 0.5, tall = topY - bottom;
      cam.fov = 22; _t.set(0, (topY + bottom) / 2, 0.02);
      const d = tall / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.04;
      cam.position.set(d * 0.3, _t.y + d * 0.06, d * 0.95);
    } else if (kind === 'head') {
      cam.fov = 24; _t.set(_h.x, _h.y - 0.035, _h.z - 0.01);
      cam.position.set(_t.x + 0.25, _t.y + 0.03, _t.z + 0.62);
    } else {
      cam.fov = 24; _t.set(_h.x, _h.y - 0.01, _h.z - 0.03);
      cam.position.set(_t.x + 0.33, _t.y + 0.13, _t.z + 0.55);
    }
    cam.aspect = 1; cam.updateProjectionMatrix(); cam.lookAt(_t);
    S.renderer.render(S.scene, cam);
    S.pen.clearRect(0, 0, PX, PX); S.pen.imageSmoothingEnabled = true; S.pen.imageSmoothingQuality = 'high';
    S.pen.drawImage(S.canvas, 0, 0, PX, PX);
    const url = S.out.toDataURL('image/webp', 0.86);
    S.scene.remove(c.root); c.dispose();
    return url;
  }
  const queue = [];
  let busy = false;
  const T = { drawn: 0, ms: 0, failed: null };
  const breath = () => new Promise((go) => setTimeout(go, 16));
  async function run() {
    if (busy) return; busy = true;
    const t0 = performance.now();
    try {
      while (queue.length) {
        const [kind, id] = queue.shift(), k = kind + ':' + (id || '');
        if (pics.has(k)) continue;
        try { pics.set(k, await draw(kind, id)); T.drawn++; } catch (e) { T.failed = (T.failed || 0) + 1; console.warn('Crew Lab: no picture for ' + k + ' (' + e.message + ')'); pics.set(k, ''); }
        for (const fn of heard) { try { fn(kind, id, pics.get(k)); } catch (e) { console.error(e); } }
        await breath();
      }
    } finally { busy = false; T.ms += Math.round(performance.now() - t0); close(); keep(); }
  }
  T.get = (kind, id) => pics.get(kind + ':' + (id || '')) || null;
  T.want = (kind, ids) => { for (const id of ids) { const k = kind + ':' + (id || ''); if (!pics.has(k) && !queue.some((q) => q[0] === kind && (q[1] || '') === (id || ''))) queue.push([kind, id]); } run(); };
  T.onPicture = (fn) => { heard.add(fn); return () => heard.delete(fn); };
  T.busy = () => busy || queue.length > 0;
  return T;
}
