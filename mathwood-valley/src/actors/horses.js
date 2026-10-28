// HORSES: one way to make the new horse (the steed, the Horse Lab's: models/animals/steed.glb, a coat kind in
// animals.json). makeAnimal (animals.js) gives the body, the eyes, the bones and the clips; this dresses it: its coat from
// a recipe (horsecoat.js, the recipes in horsecoats.js), a far look of the coat for a horse past about 30 m (a second,
// cheaper program on the same uniforms), its glossy eyes, and its mane and tail (horsehair.js: the full cards, or the far
// look's third of them), all sharing one set of uniforms, so a new coat is uniforms only and the horse fades as one.
//
//   makeHorse(lib, { recipe, size, shadows, tier, renderer }) -> horse     lib: from loadAnimals with 'steed' loaded
//     recipe: a preset's name ('bay', 'chestnut', ...: horsecoats.js PRESETS) or a recipe object (filled in: fill)
//     size: 1 is the pack horse's size (the stable's ladder: 0.95 to 1.15); tier: 'potato' | 'normal' | 'gaming' (how
//     far off each look holds: HORSE_LOOK); renderer: the game's (the hair's picture, and whether the screen is smoothed:
//     without multisampling the hair is cut hard at its alpha; else the one warmHorses was given)
//   horse.a                the animal (makeAnimal: .root, .play, .pace, .seat, .bones, .mesh, .eye ...)
//   horse.recipe, .size    its coat and its size, as they are now
//   horse.setRecipe(r)     a new coat (uniforms only: nothing is built again)
//   horse.setSize(s)       a new size, as it stands
//   horse.fade             1 solid .. 0 gone (the 4 x 4 dissolve of a person's: the coat, the eyes and the hair together;
//                          it casts no shadow below a half)
//   horse.look(camPos)     each frame (or whenever): the full or far coat, the full, lite or no hair, the eyes or none, by
//                          how far it stands from the camera and the tier's distances (HORSE_LOOK)
//   horse.lookNow          { coat: 'full' | 'lite', hair: 'full' | 'lite' | 'none', eyes: true | false }
//   horse.setLook(name)    another tier's distances (HORSE_LOOK[name]): the governor's horse dial (horseDial below)
//   horse.speed            null (the hair works out how fast the horse goes from how far it moved), or m/s to use
//   horse.dispose()        off the scene and let go (its materials are dropped, not disposed: that would throw away
//                          the shared shader programs, and the next horse would build them again in one long frame;
//                          the geometry is the kind's, shared)
//   The hair's own uniforms (its clock, how fast the horse goes, which way is behind it, where its tail's root is) are
//   set by the hair itself just before it is drawn: nobody has to tick them.
//
//   warmHorses({ W, lib, renderer, camera, scene }) -> Promise   the coat's, the far look's, the eyes' and the hair's
//                          shaders built (for the valley's lights, W.warmFor; without a W: for scene's lights, which
//                          must be the scene the horses will stand in) and their pictures sent, in the background while the
//                          title shows, so the first horse to come into view doesn't build them in one frame (279 ms
//                          on the desktop, much longer on a phone)
import * as THREE from 'three';
import { makeAnimal } from './animals.js';
import { coatMaterial, eyeMaterial, noiseTexture } from './horsecoat.js';
import { hairMaterial, attachHair, hairTexture } from './horsehair.js';
import { recipe as presetRecipe, fill } from './horsecoats.js';

export const HORSE_KIND = 'steed';
// HOW FAR OFF EACH LOOK HOLDS (m, from the camera), by the tier: the full coat out to `full` (the far look past it), the
// full hair to `hair`, the lite hair to `hairLite` (none past it), the eyes to `eyes`. The potato tier (no WebGL 2: Dad's
// work PC; fill-rate bound) always has the far look, never the full hair, the lite hair to 25 m. (They live here, not in
// world/valley.js TIER_SET, so the horse's file says what the horse does on each tier.)
export const HORSE_LOOK = {
  potato: { full: 0, hair: 0, hairLite: 25, eyes: 20 },
  normal: { full: 30, hair: 35, hairLite: 80, eyes: 40 },
  gaming: { full: 40, hair: 45, hairLite: 110, eyes: 50 },
  margin: 1.5,                // (m: a look changes this much past its distance going out, and this much inside coming in)
};
// THE GOVERNOR'S HORSE DIAL (world/governor.js, GOVERNOR.md Hooks): { look (HORSE_LOOK's name), player ('old': the
// player's own horse is the old pack horse; 'new': the new one), pen (how many in the pen), penFar (the pen's always in
// their far look), every (every horse in the valley the new one: the road riders too) }. It changes only at load and at
// a hiding moment (a menu, the title, the cabin, the end mist). Without a governor: what the tier always gave.
export function horseDial(W) {
  if (W && W.governor) { try { return W.governor.value('horse'); } catch (e) { /* (no such dial: an older governor) */ } }
  const t = (W && W.tier) || 'normal';
  return { look: t, player: 'new', pen: t === 'potato' ? 3 : 4, penFar: t === 'potato', every: false };
}
// subscribe to it (called at once with the value now, then at each change); returns the way to stop
export function onHorseDial(W, fn) {
  if (W && W.governor && W.governor.on) { try { return W.governor.on('horse', (v) => fn(v)); } catch (e) { /* (no such dial) */ } }
  fn(horseDial(W)); return () => {};
}
const PX = { value: 0.001 };  // metres across a pixel one metre off (the coat's streaks fade out below a pixel): every horse's
let RENDERER = null;          // (the game's, once warmHorses or a makeHorse has been given it)
const _p = new THREE.Vector3(), _v2 = new THREE.Vector2(), _back = new THREE.Vector3();

// the game's renderer, as soon as there is one (the hair's picture, and whether the screen is smoothed)
export function horseRenderer(r) { if (r) RENDERER = r; }
export function makeHorse(lib, { recipe = 'bay', size = 1, shadows = true, tier = 'normal', renderer = null } = {}) {
  const K = lib.kinds[HORSE_KIND];
  if (!K) throw new Error(lib.info && lib.info[HORSE_KIND] ? `the horse is not loaded yet (lib.need('${HORSE_KIND}'))` : 'no horse in this animal library');
  if (renderer) RENDERER = renderer;
  const a = makeAnimal(lib, HORSE_KIND, { shadows, size });
  const r0 = typeof recipe === 'string' ? presetRecipe(recipe) : fill(recipe || {});
  const full = coatMaterial(K.shape, r0, { px: PX });
  const U = full.coat.uniforms;
  const lite = coatMaterial(K.shape, null, { lite: true, uniforms: U });
  a.mesh.material = full;
  if (a.eye) a.eye.material = eyeMaterial(K.shape, K.shape.eye.material, { fade: U.uFade });
  const hairMat = hairMaterial(K.shape, U, RENDERER);
  const hair = attachHair(a.mesh, K.hair.geometry, hairMat);
  hair.receiveShadow = shadows;
  // the pixel's size, from the camera drawing it (once a frame is plenty: every horse shares it)
  a.mesh.onBeforeRender = (r, s, cam) => {
    if (!cam.isPerspectiveCamera) return;
    r.getDrawingBufferSize(_v2); PX.value = 2 * Math.tan(cam.fov * Math.PI / 360) / Math.max(1, _v2.y);
  };
  // the hair's uniforms, just before it is drawn: its clock, how fast the horse has gone since it was last drawn (eased),
  // which way is behind it, where its tail's root is
  const HU = hairMat.hair.uniforms, dock = a.bones.Tail1 || a.bones.Tail2, was = new THREE.Vector3();
  let lastT = -1, speed = 0;
  hair.onBeforeRender = () => {
    const t = performance.now() / 1000;
    a.root.getWorldPosition(_p);
    if (lastT >= 0 && t > lastT) {
      const dt = Math.min(0.25, t - lastT), v = _p.distanceTo(was) / dt;
      if (v < 30) speed += (v - speed) * (1 - Math.exp(-8 * dt));   // (a jump to another place isn't a gallop)
    }
    was.copy(_p); lastT = t;
    HU.uTime.value = t % 1000; HU.uSpeed.value = H.speed != null ? H.speed : speed;
    a.root.getWorldDirection(_back); HU.uBackW.value.copy(_back.negate());
    if (dock) dock.getWorldPosition(HU.uDockW.value);
  };
  let at = HORSE_LOOK[tier] || HORSE_LOOK.normal; const M = HORSE_LOOK.margin;   // (setLook changes it)
  const now = { coat: 'full', hair: 'full', eyes: true };
  let fade = 1, cast = shadows;
  const H = {
    a, get recipe() { return H._r; }, _r: r0, get size() { return a.size; },
    speed: null,   // (m/s for the hair, when its owner knows better than the distance between frames: a posed rig)
    get lookNow() { return { ...now }; },
    setLook(name) { if (HORSE_LOOK[name]) at = HORSE_LOOK[name]; return H; },   // (the next look() uses it)
    setRecipe(r) { H._r = typeof r === 'string' ? presetRecipe(r) : fill(r || {}); full.coat.set(H._r); return H; },
    setSize(s) { a.setSize(s); return H; },
    get fade() { return fade; },
    set fade(f) {
      fade = Math.max(0, Math.min(1, +f)); U.uFade.value = fade;
      a.mesh.castShadow = cast && fade > 0.5;   // (gone at 0: every pixel left out; whether it is shown at all is its owner's)
    },
    look(camPos) {
      a.root.getWorldPosition(_p);
      const d = _p.distanceTo(camPos);
      const coat = at.full <= 0 ? 'lite' : now.coat === 'lite' ? (d < at.full - M ? 'full' : 'lite') : (d > at.full + M ? 'lite' : 'full');
      if (coat !== now.coat) { now.coat = coat; a.mesh.material = coat === 'lite' ? lite : full; }
      const lvl = (x) => (x === 'full' ? 2 : x === 'lite' ? 1 : 0), cur = lvl(now.hair);
      const want = d < at.hair + (cur >= 2 ? M : -M) ? 2 : d < at.hairLite + (cur >= 1 ? M : -M) ? 1 : 0;
      const hn = ['none', 'lite', 'full'][want];
      if (hn !== now.hair) { now.hair = hn; hair.visible = want > 0; if (want) hair.geometry = want === 2 ? K.hair.geometry : K.hairLite.geometry; }
      const eyes = d < at.eyes + (now.eyes ? M : -M);
      if (eyes !== now.eyes) { now.eyes = eyes; if (a.eye) a.eye.visible = eyes; }
      return H;
    },
    // (for the rigs and the labs: the materials, the hair mesh)
    parts: { full, lite, hairMat, hair, uniforms: U },
    dispose() { a.dispose(); hair.onBeforeRender = () => {}; a.mesh.onBeforeRender = () => {}; },
  };
  return H;
}

// THE SHADERS AHEAD OF TIME: two stand-in horses (the full look and the far look, the full and the lite hair) built for
// the valley's lights in the background (W.warmFor: three's compileAsync), their pictures sent; then let go (the
// programs stay: nothing is disposed). Loads the horse first if it isn't yet. Resolves when done (it never throws).
export async function warmHorses({ W = null, lib, renderer = null, camera = null, scene = null } = {}) {
  try {
    if (renderer) RENDERER = renderer;
    await lib.need(HORSE_KIND);
    const g = new THREE.Group(), near = makeHorse(lib, { tier: 'gaming' }), far = makeHorse(lib, { tier: 'potato' });
    near.look(new THREE.Vector3(0, 1, 5)); far.look(new THREE.Vector3(0, 1, 20));   // (the far one: the far look, the lite hair)
    g.add(near.a.root, far.a.root); near.a.update(0); far.a.update(0); g.updateMatrixWorld(true);
    const r = RENDERER;
    if (r) for (const t of [noiseTexture(), hairTexture(r)]) { try { r.initTexture(t); } catch (e) { /* (sent when first drawn) */ } }
    if (W && W.warmFor) await W.warmFor(g);
    else if (r && camera) { if (r.compileAsync) await r.compileAsync(g, camera, scene || g); else r.compile(g, camera, scene || g); }
    // then one real draw through a single pixel, in the scene they'll stand in, just in front of the camera: what the
    // compile can't do (the graphics driver's own set-up the first time each shader draws, and the shapes, the bones'
    // picture and the coat's pictures sent to the card). Built but never drawn, the first horse's frame still took
    // 80-110 ms on the desktop (tests/horses.html)
    const into = W ? W.scene : scene;
    if (r && camera && into) {
      camera.updateMatrixWorld();
      camera.getWorldDirection(_p); g.position.copy(camera.position).addScaledVector(_p, 8); g.position.y -= 1;
      near.a.root.position.set(-1.6, 0, 0); far.a.root.position.set(1.6, 0, 0);
      into.add(g); g.updateMatrixWorld(true);
      const sc = r.getScissorTest(), px = 1 / r.getPixelRatio();
      r.setScissorTest(true); r.setScissor(0, 0, px, px);
      try { if (W && W.render) W.render(); else r.render(into, camera); } finally { r.setScissorTest(sc); into.remove(g); }
    }
    near.dispose(); far.dispose();
    return true;
  } catch (e) { console.warn('horses: the shaders could not be built ahead', e); return false; }
}
