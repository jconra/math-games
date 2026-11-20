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
import { isMade, keyOf } from './maker.js';

// the pictures' sizes (the title shows a face at 44 to 110 px and a body at up to about 270 px tall: these are about
// twice that, for sharp screens)
export const SIZES = { face: [224, 224], body: [300, 540] };
export const POSE = { clip: 'Stand_Listen', at: 0.6 };
const OVER = 2;
const KEEP = 'calc-station.looks.pictures';     // (the last visit's pictures, in this browser)

// ── the studio ─────────────────────────────────────────────────────────────────────────────────────────────────
let studio = null, held = null;      // (held: the person the character maker last drew, left standing: { pk, c })
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
  // (the person the character maker left standing in it, A MADE LOOK'S PICTURES below)
  if (held) { studio.scene.remove(held.c.root); held.c.dispose(); held = null; }
  studio.scene.environment.dispose(); studio.pmrem.dispose(); studio.renderer.dispose(); studio.renderer.forceContextLoss();
  studio = null;
}

const _h = new THREE.Vector3(), _t = new THREE.Vector3();
// one person, posed, drawn as each kind asked for: { face: data address, body: ... }
async function draw(lib, recipe, kinds, pose = null) {
  const S = openStudio(), stand = { ...POSE, ...(pose || {}) };
  const c = await makeCrew(lib, recipe);
  S.scene.add(c.root);
  c.play(stand.clip, { fade: 0 }); c.update(0); c.update(stand.at);
  const got = snap(S, c, kinds);
  S.scene.remove(c.root); c.dispose();
  return got;
}
// a person standing in the studio, drawn as each kind asked for
function snap(S, c, kinds, quality = 0.9) {
  const got = {};
  // (a head sized on its outfit, kit/crew.js THE HEAD'S PLACE, is sized about its Head joint: its middle, and the face
  // picture's camera, are taken by that size, so every face fills its window alike. 1 for a head as made)
  const k = c.place && +c.place.size > 0 ? +c.place.size : 1;
  for (const kind of kinds) {
    const [w, h] = SIZES[kind] || SIZES.face, cam = S.camera;
    c.root.updateMatrixWorld(true);
    c.bones.Head.getWorldPosition(_h); _h.y += 0.09 * k; _h.z += 0.03 * k;   // (the middle of the head)
    if (kind === 'body') {
      // the whole person: a little room over the head, the feet at the bottom edge
      const top = _h.y + 0.2, bottom = -0.03, tall = top - bottom;
      cam.fov = 22; _t.set(0, (top + bottom) / 2, 0);
      const d = tall / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      cam.position.set(d * 0.24, _t.y + d * 0.05, d * 0.97);
    } else {
      // the head, with the collar under it, turned a little
      cam.fov = 24; _t.set(_h.x, _h.y - 0.04 * k, _h.z - 0.03 * k);
      cam.position.set(_t.x + 0.26 * k, _t.y + 0.04 * k, _t.z + 0.88 * k);
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
    got[kind] = S.out.toDataURL('image/webp', quality);
  }
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

// ── A MADE LOOK'S PICTURES (the character maker: maker.js, ui/title.js) ────────────────────────────────────────────
// A look the player has changed (another body, head or hair, a colour) has no stored picture: its two pictures are
// drawn here in the browser by the same studio, once the crew kit is in (useKit), and only when they are wanted. The
// parts come as the crew kit fetches them (a part is downloaded the first time someone wears it), so nothing more is
// loaded as the page opens. While a changed look's own picture is on its way, the picture it was changed from stands
// in for it, so the screen always shows someone (coming() says so, and the title dims it a little).
// The person last drawn is left standing in the studio: a colour changed is laid on them and drawn again, with no one
// put together afresh. The studio is put away a little after the last picture, and when the game starts (restStudio).
// The saved crew's own made pictures are kept in this browser (keepPictures), so they are there as the page opens next
// time; they are drawn again when the stored pictures' rig has run since (the crew kit has changed).
//
//   useKit(lib), kit(), onKit(fn)        the crew kit once it has loaded (main.js gives it; fn(lib) then, or at once)
//   picKey(look)                         the name a look's pictures go by: a ready-made look's id, a made look's own key
//   pictureFor(look, kind)               its picture's address, or null: a made look's own once drawn, till then the
//                                        one it was changed from
//   coming(look)                         true while a made look's own picture is still on its way
//   wantPicture(look, { from, now })     draw a made look's pictures (from: the look it was changed from; now: the
//                                        player is looking at it, so it goes first and older such wishes are dropped)
//   keepPictures(looks)                  the made looks whose pictures are kept for the next visit (the saved crew's)
//   restStudio()                         the studio put away
const MADE_KEEP = 'calc-station.looks.made', MADE_MOST = 40, REST_AFTER = 20000;
const MADE = new Map();          // a made look's key -> { face, body, own: its own picture (not a stand-in), t, kit }
const waiting = [], failed = new Set(), kitHeard = new Set();
let lib = null, busy = false, doing = null, restTimer = 0, keepTimer = 0;      // (doing: the key being drawn now)
const kept = new Map();          // the made looks kept for the next visit: key -> look
export const made = { drawn: 0, ms: 0, last: 0, failed: 0 };       // (for the rigs: how many were drawn, and how long they took)

export const kit = () => lib;
export function useKit(l) { lib = l; for (const fn of kitHeard) { try { fn(l); } catch (e) { console.error(e); } } pump(); }
export const onKit = (fn) => { kitHeard.add(fn); if (lib) fn(lib); return () => kitHeard.delete(fn); };
export const picKey = (look) => (isMade(look) ? 'made:' + keyOf(look) : lookById(look && look.id).id);
export function pictureFor(look, kind = 'face') {
  if (!isMade(look)) return pictureOf(look && look.id, kind);
  const m = MADE.get(keyOf(look));
  return (m && m[kind]) || null;
}
export const coming = (look) => isMade(look) && !failed.has(keyOf(look)) && !(MADE.get(keyOf(look)) || {}).own;

// the pictures kept from the last visit (shown at once; drawn again if the crew kit has changed since: `kit` is the
// stored pictures' own date, which their rig moves on each time it runs)
try {
  const j = JSON.parse(localStorage.getItem(MADE_KEEP) || 'null');
  if (j && j.pics) {
    for (const [k, v] of Object.entries(j.pics)) if (v && typeof v.face === 'string' && typeof v.body === 'string') MADE.set(k, { face: v.face, body: v.body, own: true, t: 0, kit: j.kit || null });
    storedReady.then(() => {
      for (const [k, m] of MADE) if (m.t === 0 && m.kit !== info.made) { m.own = false; if (kept.has(k)) wantPicture(kept.get(k)); }
    }).catch(() => {});
  }
} catch (e) { /* none kept, or saves blocked: drawn again */ }
function store() {
  clearTimeout(keepTimer);
  keepTimer = setTimeout(() => {
    const pics = {};
    for (const k of kept.keys()) { const m = MADE.get(k); if (m && (m.own || m.t === 0)) pics[k] = { face: m.face, body: m.body }; }
    try { if (Object.keys(pics).length) localStorage.setItem(MADE_KEEP, JSON.stringify({ kit: info.made, pics })); else localStorage.removeItem(MADE_KEEP); } catch (e) { /* full or blocked: drawn again next time */ }
  }, 600);
}
// the saved crew's made looks: their pictures are kept for the next visit, and any not drawn yet is drawn
export function keepPictures(looks) {
  kept.clear();
  for (const l of looks || []) if (isMade(l)) { kept.set(keyOf(l), JSON.parse(JSON.stringify(l))); wantPicture(l); }
  store();
}
// (the oldest pictures dropped once there are many: the ones kept, waited for or standing in stay)
function trim() {
  if (MADE.size <= MADE_MOST) return;
  const safe = new Set([...kept.keys(), ...waiting.map((w) => w.key)]);
  for (const [k, m] of [...MADE].sort((a, b) => a[1].t - b[1].t)) { if (MADE.size <= MADE_MOST) break; if (!safe.has(k)) MADE.delete(k); }
}

export function wantPicture(look, { from = null, now = false } = {}) {
  if (!isMade(look)) return;
  const key = keyOf(look), have = MADE.get(key);
  failed.delete(key);
  if (have && have.own) { have.t = Date.now(); return; }
  // (until its own is drawn: the picture of the look it was changed from)
  if (!have && from) { const f = { face: pictureFor(from, 'face'), body: pictureFor(from, 'body') }; if (f.face || f.body) MADE.set(key, { ...f, own: false, t: Date.now() }); }
  const at = waiting.findIndex((w) => w.key === key);
  if (doing === key || (at >= 0 && !now)) return;
  const w = at >= 0 ? waiting.splice(at, 1)[0] : { look: JSON.parse(JSON.stringify(look)), key, now: false, tries: 0 };
  if (now) {
    // (the looks stepped through on the way here are not drawn: only where the player has stopped)
    for (let i = waiting.length - 1; i >= 0; i--) if (waiting[i].now) { const d = waiting.splice(i, 1)[0], m = MADE.get(d.key); if (m && !m.own && !kept.has(d.key)) MADE.delete(d.key); }
    w.now = true; waiting.unshift(w);
  } else waiting.push(w);
  pump();
}

async function drawMade(look) {
  const recipe = recipeOf(look, lib);
  delete recipe.size;
  const pk = JSON.stringify([recipe.suit, recipe.head, recipe.hair, recipe.face || {}, !!(recipe.colours && recipe.colours.freckles)]);
  if (!held || held.pk !== pk) {
    const c = await makeCrew(lib, recipe), S = openStudio();
    if (held) { S.scene.remove(held.c.root); held.c.dispose(); }
    held = { pk, c }; S.scene.add(c.root);
    c.play(POSE.clip, { fade: 0 }); c.update(0);
  } else held.c.setColours({ uniform: null, skin: null, hair: null, eyes: null, ...(recipe.colours || {}) });
  // (stood as the ready-made pictures' people stand, each time)
  const c = held.c;
  if (c.person.cur) c.person.cur.time = 0;
  c.update(0); c.update(POSE.at);
  return snap(openStudio(), c, ['body', 'face'], 0.86);
}
async function pump() {
  if (busy || !lib || !waiting.length) return;
  busy = true; clearTimeout(restTimer);
  const w = waiting.shift(), t0 = performance.now();
  doing = w.key;
  try {
    const got = await drawMade(w.look);
    MADE.set(w.key, { ...got, own: true, t: Date.now(), kit: info.made });
    made.drawn++; made.last = Math.round(performance.now() - t0); made.ms += made.last;
    trim(); store();
  } catch (e) {
    // (a part that did not arrive: tried once more, then the picture it had stays and the next change tries again)
    console.warn('Pi Nebula: a look\'s picture could not be drawn', e);
    if (++w.tries < 2) waiting.push(w); else { failed.add(w.key); made.failed++; }
  }
  doing = null;
  tell(picKey(w.look));
  await breath();
  busy = false;
  if (waiting.length) pump(); else restTimer = setTimeout(() => { if (!busy) closeStudio(); }, REST_AFTER);
}
export function restStudio() { clearTimeout(restTimer); if (!busy) closeStudio(); else restTimer = setTimeout(restStudio, 1500); }
