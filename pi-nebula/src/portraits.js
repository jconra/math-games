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
import { makeCrew, SIZES as HEIGHTS } from '../kit/crew.js';
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
  // (the person the character maker left standing in it, A MADE LOOK'S PICTURES below, and the window's canvas: THE
  // FIGURE IN THE MAKER'S WINDOW)
  if (LIVE.host) liveHide(false);
  if (held) { studio.scene.remove(held.c.root); held.c.dispose(); held = null; }
  studio.scene.environment.dispose(); studio.pmrem.dispose(); studio.renderer.dispose(); studio.renderer.forceContextLoss();
  studio = null;
}

const _h = new THREE.Vector3(), _t = new THREE.Vector3();
// one person, posed, drawn as each kind asked for: { face: data address, body: ... } (whoever else stands in the studio,
// the maker's window's person, stands aside meanwhile)
async function draw(lib, recipe, kinds, pose = null, quality = 0.9) {
  const S = openStudio(), stand = { ...POSE, ...(pose || {}) };
  const c = await makeCrew(lib, recipe);
  S.scene.add(c.root);
  c.play(stand.clip, { fade: 0 }); c.update(0); c.update(stand.at);
  const other = held && held.c.root;
  if (other) other.visible = false;
  const got = snap(S, c, kinds, quality);
  if (other) other.visible = true;
  S.scene.remove(c.root); c.dispose();
  liveRender();
  return got;
}
// a person standing in the studio, drawn as each kind asked for
function snap(S, c, kinds, quality = 0.9) {
  const got = {};
  // (as made: facing the front and their own height, whatever the maker's window last had them turned to)
  c.root.rotation.set(0, 0, 0); c.root.scale.setScalar(1);
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

// (what a person is put together from, apart from their colours: two looks alike in this are one person, coloured)
const pkOf = (recipe) => JSON.stringify([recipe.suit, recipe.head, recipe.hair, recipe.face || {}, !!(recipe.colours && recipe.colours.freckles)]);
const coloursOf = (recipe) => ({ uniform: null, skin: null, hair: null, eyes: null, ...(recipe.colours || {}) });
// The person left standing in the studio (held), wearing the recipe: the one standing, coloured, if it is put together
// from the same parts; else put together afresh. One at a time (the pictures and the maker's window both ask for one).
// (still: asked again when its turn comes, and nothing done if it says no: the looks stepped past in the window)
let standQ = Promise.resolve();
function standFor(recipe, still = null) {
  const run = standQ.then(async () => {
    const pk = pkOf(recipe);
    if (still && !still()) return null;
    if (!held || held.pk !== pk) {
      const c = await makeCrew(lib, recipe), S = openStudio();
      if (held) { S.scene.remove(held.c.root); held.c.dispose(); }
      held = { pk, c, frame: null }; S.scene.add(c.root);
      c.play(POSE.clip, { fade: 0 }); c.update(0);
      posed(c); held.frame = frameOf(c);
      if (pk === LIVE.pk) live.made++;
    } else held.c.setColours(coloursOf(recipe));
    return held.c;
  });
  standQ = run.catch(() => {});
  return run;
}
// (stood as the ready-made pictures' people stand, the eyes on the face picture's camera, as after a picture)
function posed(c) {
  c.root.rotation.set(0, 0, 0); c.root.scale.setScalar(1);
  if (c.person.cur) c.person.cur.time = 0;
  c.update(0); c.update(POSE.at);
  c.root.updateMatrixWorld(true);
  const k = c.place && +c.place.size > 0 ? +c.place.size : 1;
  c.bones.Head.getWorldPosition(_h);
  c.lookAt(_t.set(_h.x + 0.26 * k, _h.y + 0.09 * k, _h.z + 0.88 * k), { dart: false }); c.update(0.3);
}
async function drawMade(look) {
  const recipe = recipeOf(look, lib);
  delete recipe.size;
  // (another crew member's look while the maker's window shows someone else: drawn on its own, the one in the window
  // left standing as they are)
  if (LIVE.host && held && pkOf(recipe) !== LIVE.pk) return draw(lib, recipe, ['body', 'face'], null, 0.86);
  const c = await standFor(recipe);
  // (stood as the ready-made pictures' people stand, each time)
  if (c.person.cur) c.person.cur.time = 0;
  c.update(0); c.update(POSE.at);
  const got = snap(openStudio(), c, ['body', 'face'], 0.86);
  // (the window's person in the window's own colours again, drawn again at once: the picture was taken in between)
  if (LIVE.recipe && held && held.c === c && held.pk === LIVE.pk) c.setColours(coloursOf(LIVE.recipe));
  liveRender();
  return got;
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
  if (waiting.length) pump(); else rest();
}
// (the studio put away a while after its last picture, unless the maker's window is showing its person)
function rest() { clearTimeout(restTimer); restTimer = setTimeout(() => { if (!busy && !LIVE.host) closeStudio(); }, REST_AFTER); }
// (when the game starts: the maker's window is gone with the title, and the studio with it)
export function restStudio() { clearTimeout(restTimer); if (LIVE.host) liveHide(false); if (!busy) closeStudio(); else restTimer = setTimeout(restStudio, 1500); }

// ── THE FIGURE IN THE MAKER'S WINDOW (2026-11-19; the game's maker, asked whether a still picture of the character was
// enough: "I would give it orbit controls with the real model") ────────────────────────────────────────────────────
// The character maker's window (ui/title.js) shows the real 3D person, put together by the crew kit as they are aboard,
// and the player turns them round and comes nearer (ui/turn.js). To stay quick on a phone it is ONE person, the studio's
// own (the person a made look's pictures are taken of: a part changed is put together once, for both), drawn into the
// studio's own canvas laid in the window, only while the window is on the screen and only when something changes (a
// turn, a part, a colour, the window's size): nothing is drawn while the player just looks. They stand as the pictures'
// people stand (POSE) and wear the height picked; they turn on the spot under the studio's lights (the lights stay
// with the eye, so whichever side is seen is lit as the front is in the pictures). While a new part is on its way the
// person before stays in the window, dimmed.
//   liveShow(el, look)   the person wearing `look` in the element `el` (the window): its canvas laid in it, and el's
//                        data-live attribute 'ready' (drawn as worn now) or 'coming' (the one before, still drawn);
//                        false (nothing done) until the crew kit is in
//   liveView(v)          { yaw: radians round, pitch: radians from above, zoom: 0 the whole person .. 1 the face };
//                        with v, the view set and drawn (each part held to LIVE_VIEW's limits); the view as it is now
//   liveHide()           the canvas taken out of the window; nothing drawn till liveShow again
//   live                 for the rigs: { frames drawn, made: people put together for it, view, blinks: of the frames,
//                        those drawn while a blink moved the lids }
// THE PERSON BLINKS (EYELIDS THAT CLOSE, kit/lids.js): now and then, every 2 to 6 s, as everyone does in the game; drawn
// only while the lids move (a blink is about 0.15 s: some ten frames), and nothing in between.
// The view is kept from one look to the next (an arrow pressed with the person seen from behind still shows them from
// behind), and starts as the pictures stand: a little turned, as a three-quarter view.
export const LIVE_VIEW = { yaw: -0.24, pitch: 0.05, zoom: 0, pitchMost: [-0.2, 0.55], fov: 22, close: 0.6, px: 2 };
const LIVE = { el: null, host: null, recipe: null, pk: null, size: 1, view: { yaw: LIVE_VIEW.yaw, pitch: LIVE_VIEW.pitch, zoom: LIVE_VIEW.zoom }, raf: 0, ro: null, cam: null };
export const live = { frames: 0, made: 0, view: LIVE.view, blinks: 0 };
const TALLEST = Math.max(...Object.values(HEIGHTS));
// (where the person's head is, as made and facing the front: what the window frames them by)
function frameOf(c) {
  c.root.updateMatrixWorld(true);
  const k = c.place && +c.place.size > 0 ? +c.place.size : 1;
  c.bones.Head.getWorldPosition(_h);
  return { head: _h.y + 0.09 * k, headZ: _h.z + 0.03 * k };
}
export function liveShow(el, look) {
  if (!lib || !el) return false;
  const recipe = recipeOf(look, lib), size = +recipe.size > 0 ? +recipe.size : 1;
  delete recipe.size;
  const pk = pkOf(recipe);
  LIVE.recipe = recipe; LIVE.size = size; LIVE.pk = pk;
  const S = openStudio();
  clearTimeout(restTimer);
  if (LIVE.host !== el) {
    if (LIVE.ro) LIVE.ro.disconnect();
    if (LIVE.host && LIVE.host !== el) LIVE.host.removeAttribute('data-live');
    LIVE.host = el;
    LIVE.ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => liveDraw()) : null;
    if (LIVE.ro) LIVE.ro.observe(el);
  }
  if (S.canvas.parentElement !== el) {
    S.canvas.setAttribute('aria-hidden', 'true');
    S.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    el.appendChild(S.canvas);
  }
  if (held && held.pk === pk) held.c.setColours(coloursOf(recipe));
  else standFor(recipe, () => LIVE.pk === pk).then((c) => { if (LIVE.pk === pk && held && held.c === c) { c.setColours(coloursOf(LIVE.recipe)); liveDraw(); } }).catch((e) => console.warn('Pi Nebula: the character could not be put together', e));
  liveDraw();
  return true;
}
export function liveView(v) {
  if (v) {
    const V = LIVE.view, M = LIVE_VIEW.pitchMost;
    if (Number.isFinite(+v.yaw)) V.yaw = +v.yaw;
    if (Number.isFinite(+v.pitch)) V.pitch = Math.max(M[0], Math.min(M[1], +v.pitch));
    if (Number.isFinite(+v.zoom)) V.zoom = Math.max(0, Math.min(1, +v.zoom));
    liveDraw();
  }
  return { ...LIVE.view };
}
export function liveHide(soon = true) {
  if (LIVE.ro) LIVE.ro.disconnect();
  LIVE.ro = null;
  if (LIVE.host) LIVE.host.removeAttribute('data-live');
  if (studio && studio.canvas.parentElement) studio.canvas.remove();
  LIVE.host = null;
  if (LIVE.raf) cancelAnimationFrame(LIVE.raf);
  LIVE.raf = 0; liveBlink(false);
  if (soon && !busy) rest();
}
// (drawn once, at the next frame, however many changes asked for it meanwhile)
function liveDraw() { if (LIVE.host && !LIVE.raf) LIVE.raf = requestAnimationFrame(() => { LIVE.raf = 0; liveRender(); }); }
const _c = new THREE.Vector3();
function liveRender() {
  const el = LIVE.host, S = studio;
  if (!el || !S || !el.isConnected) return;
  const ready = !!held && held.pk === LIVE.pk;
  el.setAttribute('data-live', held ? (ready ? 'ready' : 'coming') : 'coming');
  if (!held || !held.frame) return;
  const w = el.clientWidth, h = el.clientHeight;
  if (w < 2 || h < 2) return;
  const px = Math.min(LIVE_VIEW.px, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
  const c = held.c, F = held.frame, V = LIVE.view, size = ready ? LIVE.size : 1;
  c.root.rotation.set(0, V.yaw, 0); c.root.scale.setScalar(size); c.root.updateMatrixWorld(true);
  const cam = LIVE.cam || (LIVE.cam = new THREE.PerspectiveCamera(LIVE_VIEW.fov, 1, 0.05, 60));
  // the whole person, with room over their head for the tallest height (so a height picked is seen), the feet at the
  // bottom; nearer, their head and shoulders (zoom eased, so the first steps in are small)
  const z = V.zoom * V.zoom * (3 - 2 * V.zoom);
  const top = (F.head + 0.2) * TALLEST, bottom = -0.04;
  const mid = (top + bottom) / 2 + ((F.head - 0.07) * size - (top + bottom) / 2) * z, tall = (top - bottom) + (LIVE_VIEW.close - (top - bottom)) * z;
  cam.fov = LIVE_VIEW.fov; cam.aspect = w / h; cam.updateProjectionMatrix();
  const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  // (the height fits, and the person's width when the window is narrow)
  const d = Math.max(tall / 2 / t, (1.0 - 0.55 * z) / 2 / (t * cam.aspect));
  _c.set(0, mid, F.headZ * size * z);
  cam.position.set(_c.x, _c.y + Math.sin(V.pitch) * d, _c.z + Math.cos(V.pitch) * d);
  cam.lookAt(_c);
  // (the canvas sized again only when it must: a picture taken in between, or the window's size changed; sizing it
  // clears and remakes its drawing buffer, which a phone feels on every frame of a drag)
  const cw = Math.round(w * px), ch = Math.round(h * px);
  if (S.canvas.width !== cw || S.canvas.height !== ch) S.renderer.setSize(cw, ch, false);
  S.renderer.shadowMap.needsUpdate = true;
  S.renderer.render(S.scene, cam);
  live.frames++;
  if (!LIVE.blinkRaf) liveBlink();
}
// (the next blink: a wait as the person's own lids say, then their lids moved on frame by frame and drawn while they
// move; off: no blink waited for)
function liveBlink(on = true) {
  clearTimeout(LIVE.blinkT); LIVE.blinkT = 0;
  if (LIVE.blinkRaf) cancelAnimationFrame(LIVE.blinkRaf);
  LIVE.blinkRaf = 0;
  const c = held && held.c;
  if (!on || !LIVE.host || !c || !c.lidsStep) return;
  const wait = c.lids.next();
  if (!Number.isFinite(wait)) return;
  const at = performance.now();
  LIVE.blinkT = setTimeout(() => {
    LIVE.blinkT = 0;
    if (!LIVE.host || !held || held.c !== c) return;
    // (the wait gone by, as frames: a step longer than a frame would be taken as a pose laid on, the blink skipped)
    for (let left = (performance.now() - at) / 1000; left > 0; left -= 0.1) c.lidsStep(Math.min(0.1, left));
    let t0 = performance.now();
    const step = (now) => {
      LIVE.blinkRaf = 0;
      if (!LIVE.host || !held || held.c !== c) return;
      c.lidsStep(Math.min(0.05, Math.max(0, (now - t0) / 1000))); t0 = now;
      live.blinks++; LIVE.blinkRaf = -1; liveRender(); LIVE.blinkRaf = 0;
      if (c.lids.next() === 0) LIVE.blinkRaf = requestAnimationFrame(step); else liveBlink();
    };
    LIVE.blinkRaf = requestAnimationFrame(step);
  }, Math.max(0, wait * 1000));
}
