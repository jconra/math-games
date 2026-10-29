// FOLK: the people of the West. The bodies are the world's (world/objects/people.js: Quaternius' modular characters, one
// skinned mesh each with what every part is written in its vertices), prepared for this game into models/people/ by
// ~/pw/bandit-math/rigs/people_bm.mjs: nine outfits, seventeen clips a skeleton, and the farmer's cowboy hat lifted out
// on its own (hat.glb, in the Head bone's own space). Here each person is dressed in period colours: every clothes group
// (top, bottom, shoes, hat or pack) painted one chosen colour while keeping the model's own shading (its folds and
// seams: how light each vertex was against that group's average), and given the hat.
// The clips, the same names for both skeletons: Idle, Idle_Neutral, Walk, Run, Run_Back, Run_Left, Run_Right, Wave,
// Interact, Idle_Gun, Idle_Gun_Pointing, Idle_Gun_Shoot, Gun_Shoot, Run_Shoot, HitRecieve (the pack's spelling), Death,
// Roll; and the ones made for this game in Blender (clips_m.glb / clips_f.glb, listed in people.json as extraClips):
// Lasso_Swing, Lasso_Throw (once), Lasso_Pull, Ride and Ride_Gallop (as long as the horse's Walk and Gallop: play both at
// one speed; seat the rider at the fixed offset from the saddle, seatRider in src/actors/seat.js, not sitOn).
//
//   loadFolk(base, { shade }) -> Promise<lib>   base: the game's folder (default: found from this file), its models/
//                                               folder, or the people folder itself. shade(shader): the world's own
//                                               lighting patch, run after the colours' one (as the world's Person takes)
//   makePerson(lib, { outfit, palette, skin, hair, hat, hatColour, hatStyle, shadows, kid, badge, holster }) -> person
//     outfit   farmer_m (default; the player), adventurer_m, adventurer_f, casual_m, casual_f, worker_m, suit_m,
//              suit_f, formal_f
//     palette  a name from PALETTES, or four colours [top, bottom, shoes, hat/pack]
//     skin, hair   a colour ('#c68d62', 0xc68d62, a THREE.Color) or a number: an index into SKINS / HAIRS
//     hat      true: the cowboy hat on the Head bone (hair that would poke through tucked in); false: bare-headed.
//              Default: on, but for the formal dress (her piled-up hair won't go under it). hatColour: the hat apart
//              from the palette's fourth colour. hatStyle: which hat (an id from src/hats.js: the cowboy hat when
//              unset; the others are shaped in hatshapes.js and come in their own colour unless hatColour is given)
//   badge    true: a gold star on the left breast (the sheriff and the deputy); holster: true: a six-shooter in a
//            leather holster tied down on the right thigh (both made in code, shared; hung on the Chest and UpperLegR
//            bones where that outfit's clothes are, in the Idle pose)
//   person.root (place and turn it: feet on y = 0, facing +Z, 1.8 m or so), .mesh, .bones { name: bone } (three.js
//     drops the dots: Wrist.R is bones.WristR), .hat (the hat's mesh, on bones.Head; null without one), .play(name,
//     { fade, speed, once }), .update(dt), .stride (m/s the Walk and Run clips carry them at speed 1), .clips,
//     .setPalette(p), .setSkin(c), .setHair(c), .hatOff() -> the hat, let go of in the world where it was (to tumble),
//     .hatOn(), .setHat(style) (another hat, the same place), .hatStyle, .gear (the star and holster meshes), .fade (1
//     solid .. 0 gone: a dissolve, the screen's pixels left out in a fine pattern; the shadow goes under a half), .dispose()
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { loadPeople, Person, STRIDE } from '../../world/objects/people.js';
import { softShade } from './shading.js';
import { hatPiece } from './hatshapes.js';
import { indoorPre, indoorPost, INDOOR_KEY } from '../../world/objects/indoorlight.js';

export const OUTFITS = ['farmer_m', 'adventurer_m', 'adventurer_f', 'casual_m', 'casual_f', 'worker_m', 'suit_m', 'suit_f', 'formal_f'];
// period colours (sRGB, as a picker shows them): [top, bottom, shoes, hat / pack]
export const PALETTES = {
  drifter:   ['#8b5a3a', '#5a4632', '#3b2a1e', '#5b4630'],   // rust shirt, brown duck trousers, dark boots, brown felt
  rancher:   ['#d6c9a8', '#3e4a5c', '#4a3322', '#9a8263'],   // cream shirt, denim, brown boots, tan hat
  outlaw:    ['#2e2b29', '#3f3c39', '#211a15', '#262321'],   // black and charcoal: reads as one of the gang
  homestead: ['#6f7f8f', '#6b5843', '#3b2a1e', '#6e6a63'],   // faded chambray, tan trousers, grey felt
  prairie:   ['#7a4038', '#8a7558', '#3b2a1e', '#cbbd9a'],   // oxblood, tan, a cream bonnet or hat
  townsman:  ['#5c5a50', '#4a463f', '#2a2420', '#3a332c'],   // a grey waistcoat suit
  mustard:   ['#a88a4a', '#5a4632', '#3b2a1e', '#5b4630'],
  sage:      ['#6b6f52', '#4e4234', '#3b2a1e', '#7c6a4f'],
};
// skin and hair colours to choose from (sRGB), light to dark
export const SKINS = ['#efcfb8', '#e6bfa1', '#dba982', '#c68d62', '#a96c43', '#8a5232', '#6b3d24', '#4b2a18'];
export const HAIRS = ['#16110d', '#2b1d14', '#3f2a1b', '#5c3a22', '#7b4524', '#9c5a2c', '#b98a52', '#d8b878', '#e8dcc0', '#8f8a84', '#cfccc6'];
export { STRIDE };

const GAME = new URL('../../', import.meta.url).href;      // (src/actors/ -> the game's own folder)
function folderOf(base) {
  let b = String(base || GAME); if (!b.endsWith('/')) b += '/';
  if (/people\/$/.test(b)) return b;
  if (/models\/$/.test(b)) return b + 'people/';
  return b + 'models/people/';
}
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

// how the farmer's hat sits on each skeleton's Head bone: the men's heads are the farmer's own; the women's are smaller
// and sit lower on their Head bone (measured from the heads' boxes in people.json, then checked by eye)
// outfits that came with a hat of their own (their _KIND 6 on the head): the farmer's felt hat, which everybody now wears
// as a separate piece, and the worker's hard hat, which is no part of the 1880s; both folded away for good
const OWN_HAT = { farmer_m: true, worker_m: true };
// the outfits that leave the hat off unless asked: the formal dress's hair is piled up too high and wide to tuck in
const BARE = { formal_f: true };
// (scale across, up, front to back: the women's heads are narrower but as deep)
const HAT_FIT = { m: { scale: [1, 1, 1], at: [0, 0, 0] }, f: { scale: [0.92, 0.95, 1], at: [0, -0.01, 0.008] } };
// the room inside the hat's crown, in the hat's own space (the Head bone's, as the farmer wears it): an egg standing on
// the head. Hair above the band that would show through the hat is drawn in to it, sideways (and down from the top);
// hair below the band hangs out under the brim as it should
const CROWN = { centre: [0, 0.14, 0.01], radii: [0.098, 0.12, 0.105], band: 0.13 };

// a person's body made ready for the hat: the same model but its hair inside the crown (a copy of only the positions,
// made once an outfit; everything else is shared). Only hair that follows the head alone is moved
function hatReady(kind) {
  if (kind.hatGeometry) return kind.hatGeometry;
  let mesh = null; kind.scene.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
  const g = mesh.geometry, geo = g.clone(); for (const n of Object.keys(g.attributes)) if (n !== 'position') geo.setAttribute(n, g.attributes[n]);
  geo.index = g.index;
  const hi = mesh.skeleton.bones.findIndex((b) => b.name === 'Head'), fit = HAT_FIT[kind.body] || HAT_FIT.m;
  const toHead = new THREE.Matrix4().multiplyMatrices(mesh.skeleton.boneInverses[hi], mesh.bindMatrix), back = toHead.clone().invert();
  const pos = geo.attributes.position, kd = geo.attributes._kind, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const v = new THREE.Vector3(), c = new THREE.Vector3(...CROWN.centre), r = new THREE.Vector3(...CROWN.radii); let moved = 0;
  for (let i = 0; i < pos.count; i++) {
    if (Math.round(kd.getX(i)) !== 2) continue;
    let on = 0; for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === hi) on += sw.getComponent(i, k);
    if (on < 0.98) continue;
    v.fromBufferAttribute(pos, i).applyMatrix4(toHead);
    // into the hat's own space, as this skeleton wears it
    v.set((v.x - fit.at[0]) / fit.scale[0], (v.y - fit.at[1]) / fit.scale[1], (v.z - fit.at[2]) / fit.scale[2]);
    if (v.y < CROWN.band) continue;
    // down under the top, then in toward the middle as far as the crown is wide at that height
    const top = c.y + r.y * 0.96, y = Math.min(v.y, top), h = Math.max(0, (y - c.y) / r.y), k = Math.max(0.25, Math.sqrt(Math.max(0, 1 - h * h)));
    const e = ((v.x - c.x) / (r.x * k)) ** 2 + ((v.z - c.z) / (r.z * k)) ** 2;
    if (e <= 1 && y === v.y) continue;
    const f = e > 1 ? 1 / Math.sqrt(e) : 1;
    v.set(c.x + (v.x - c.x) * f, y, c.z + (v.z - c.z) * f);
    v.set(v.x * fit.scale[0] + fit.at[0], v.y * fit.scale[1] + fit.at[1], v.z * fit.scale[2] + fit.at[2]).applyMatrix4(back);
    pos.setXYZ(i, v.x, v.y, v.z); moved++;
  }
  geo.userData.hairMoved = moved;
  return (kind.hatGeometry = geo);
}

// the average lightness of each clothes group (3 top, 4 bottom, 5 shoes, 6 hat / pack) of one model, so a chosen colour
// is laid on with the model's own light and dark kept
function groupMeans(geometry) {
  const col = geometry.attributes.color, kind = geometry.attributes._kind, sum = new Float64Array(7), n = new Float64Array(7);
  for (let i = 0; i < col.count; i++) {
    const k = Math.round(kind.getX(i)); sum[k] += 0.2126 * col.getX(i) + 0.7152 * col.getY(i) + 0.0722 * col.getZ(i); n[k]++;
  }
  return new THREE.Vector4(...[3, 4, 5, 6].map((k) => (n[k] ? sum[k] / n[k] : 1)));
}

export async function loadFolk(base, { shade = null } = {}) {
  const dir = folderOf(base);
  const res = await fetch(dir + 'people.json'); if (!res.ok) throw new Error('people.json: ' + res.status);
  const meta = await res.json();
  const [lib, hat, ...extra] = await Promise.all([
    loadPeople(dir), loader.loadAsync(dir + (meta.hat ? meta.hat.file : 'hat') + '.glb'),
    ...Object.entries(meta.extraClips || {}).map(([body, file]) => loader.loadAsync(dir + file).then((g) => [body, g.animations]))]);
  // clips made for this game in Blender (lassoing, riding), when there are any: added to their skeleton's own
  for (const [body, clips] of extra) for (const c of clips) if (!lib.clips[body].some((d) => d.name === c.name)) lib.clips[body].push(c);
  // the hat's mesh and where it sits in the Head bone's space (packing it small moved part of its size onto its node)
  let hatMesh = null; hat.scene.updateMatrixWorld(true); hat.scene.traverse((o) => { if (o.isMesh) hatMesh = o; });
  lib.dir = dir; lib.meta = meta; lib.shade = shade;
  lib.hat = hatMesh && { geometry: softShade(hatMesh.geometry), matrix: hatMesh.matrixWorld.clone(), mean: groupMeans(hatMesh.geometry) };
  lib.byOutfit = {}; for (const k of lib.kinds) { lib.byOutfit[k.file] = k; k.scene.traverse((o) => { if (o.isSkinnedMesh) { k.means = groupMeans(o.geometry); o.geometry = softShade(o.geometry); } }); }
  lib.addClips = (body, clips) => { for (const c of clips) if (!lib.clips[body].some((d) => d.name === c.name)) lib.clips[body].push(c); };
  return lib;
}

// the period colours, worked out a vertex: _kind 0 as made (eyes, buckles), 1 skin and 2 hair (stored as how light against
// the character's own, over 2.5), 3..6 the clothes groups: the chosen colour times how light this vertex is against its
// group's average (softened, and kept within reason so a seam never goes black or white). hide: an outfit's own hat (its
// _kind 6 that rides on the Head bone, fkHead) folded away to nothing, as the farmer wears the separate one like
// everybody else (his gloves are _kind 6 too, on his hands: they stay)
const FOLK_VS = `
  attribute float _kind;
  uniform vec3 fkSkin, fkHair, fkTop, fkBottom, fkShoes, fkHat; uniform vec4 fkMean; uniform float fkHide, fkHead;
  vec3 fkColour(vec3 c, float kind) {
    if (kind < 0.5) return c;
    if (kind < 1.5) return fkSkin * (c.r * 2.5);
    if (kind < 2.5) return fkHair * (c.r * 2.5);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); int g = int(floor(kind + 0.5)) - 3;
    vec3 t = g == 0 ? fkTop : g == 1 ? fkBottom : g == 2 ? fkShoes : fkHat;
    float m = g == 0 ? fkMean.x : g == 1 ? fkMean.y : g == 2 ? fkMean.z : fkMean.w;
    return t * clamp(pow(l / max(m, 1e-4), 0.6), 0.55, 1.35);
  }
`;
// FADING (a person stepping out of a door or in through one dissolves in or out over half a second rather than popping):
// fkFade 1 is solid, 0 gone; between, a 4 x 4 pattern of the screen's pixels is left out, more of it the lower it is
const FOLK_FS = `
  uniform float fkFade;
  // (a 4 x 4 ordered dither made by arithmetic, no arrays, so it compiles on WebGL1 too)
  float fkBayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
  float fkBayer(vec2 p) { return fkBayer2(p * 0.5) * 0.25 + fkBayer2(p) + 0.5 / 16.0; }
`;
function folkMaterial(u, shade, key) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = FOLK_VS + sh.vertexShader
      .replace('#include <color_vertex>', '#include <color_vertex>\n  vColor.rgb = fkColour(vColor.rgb, _kind);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_SKINNING\n  if (fkHide > 0.5 && _kind > 5.5 && dot(skinWeight, vec4(equal(skinIndex, vec4(fkHead)))) > 0.5) transformed = vec3(0.0);\n#endif');
    sh.fragmentShader = FOLK_FS + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (fkFade < 0.999 && fkBayer(gl_FragCoord.xy) >= fkFade) discard;');
    // (lit like the room round them when they stand inside a building: world/objects/indoorlight.js)
    indoorPre(sh);
    if (shade) shade(sh);
    indoorPost(sh);
  };
  mat.customProgramCacheKey = () => 'folk-2-' + key + (shade ? '-shaded' : '') + INDOOR_KEY;
  return mat;
}

const toColour = (c, list, fallback) => {
  if (c && c.isColor) return c.clone();
  if (typeof c === 'number' && Number.isInteger(c) && c >= 0 && c < list.length) return new THREE.Color(list[c]);
  if (c !== undefined && c !== null && c !== '') return new THREE.Color(c);
  return new THREE.Color(fallback);
};

export function makePerson(lib, { outfit = 'farmer_m', palette = 'drifter', skin = 2, hair = 2, hat, hatColour = null, hatStyle = null, shadows = true, kid = false, badge = false, holster = false } = {}) {
  const kind = lib.byOutfit[outfit];
  if (!kind) throw new Error('no such outfit: ' + outfit + ' (have ' + Object.keys(lib.byOutfit).join(', ') + ')');
  if (hat === undefined) hat = !BARE[outfit];
  const p = new Person(lib, kind, { shadows, kid });
  p.mesh.material.dispose();                                    // (the world's own colouring: replaced by the period one)
  const plainGeometry = p.mesh.geometry;
  if (hat && lib.hat) p.mesh.geometry = hatReady(kind);
  const u = {
    fkSkin: { value: new THREE.Color() }, fkHair: { value: new THREE.Color() }, fkTop: { value: new THREE.Color() }, fkBottom: { value: new THREE.Color() },
    fkShoes: { value: new THREE.Color() }, fkHat: { value: new THREE.Color() }, fkMean: { value: kind.means.clone() }, fkHide: { value: OWN_HAT[outfit] ? 1 : 0 }, fkHead: { value: 0 },
    fkFade: { value: 1 },   // (shared with the hat's material: both fade together)
  };
  p.mesh.material = folkMaterial(u, lib.shade, 'body');
  const bones = {}; for (const b of p.mesh.skeleton.bones) bones[b.name] = b;
  u.fkHead.value = p.mesh.skeleton.bones.indexOf(bones.Head);
  // the hat: the farmer's, on this person's Head bone (his own folded away, so his can come off too). hatMesh is a holder
  // fitted to this skeleton's head; the hat itself sits inside it as the file placed it
  let hatMesh = null, hatU = null, piece = null;
  // (which hat: the farmer's cowboy hat unless hatStyle names another of src/hats.js; its shape from hatshapes.js)
  const fitPiece = (inner) => {
    if (piece.matrix) piece.matrix.decompose(inner.position, inner.quaternion, inner.scale);
    else { inner.position.set(0, 0, 0); inner.quaternion.identity(); inner.scale.set(1, 1, 1); }
    hatU.fkMean.value.set(1, 1, 1, piece.mean);
  };
  if (lib.hat) {
    piece = hatPiece(lib, hatStyle);
    // (its own colour: the farmer's gloves are in the same clothes group as a hat, and keep the palette's)
    hatU = { ...u, fkHat: { value: new THREE.Color() }, fkMean: { value: lib.hat.mean.clone() }, fkHide: { value: 0 } };
    const inner = new THREE.Mesh(piece.geometry, folkMaterial(hatU, lib.shade, 'hat'));
    fitPiece(inner);
    inner.castShadow = shadows; inner.receiveShadow = shadows;
    hatMesh = new THREE.Group(); hatMesh.name = 'hat'; hatMesh.add(inner); hatMesh.userData.mesh = inner;
    const fit = HAT_FIT[kind.body] || HAT_FIT.m; hatMesh.scale.fromArray(fit.scale); hatMesh.position.fromArray(fit.at);
    if (hat) bones.Head.add(hatMesh);
  }
  // the lawman's gear: a gold star on the chest, a holstered six-shooter tied down on the right thigh
  const gear = [];
  if (badge || holster) {
    p.play('Idle', { fade: 0 }); p.update(0); p.root.updateMatrixWorld(true);
    const fit = gearFit(kind, p, bones);
    if (badge && fit.star) gear.push(wear(bones.Chest, gearParts().star, fit.star, shadows));
    if (holster && fit.holster) gear.push(wear(bones.UpperLegR, gearParts().holster, fit.holster, shadows));
    if (holster && fit.belt) gear.push(wear(bones.Hips, { geometry: fit.belt, material: gearParts().holster.material }, fit.beltAt, shadows));
  }
  const person = {
    root: p.root, mesh: p.mesh, bones, person: p, outfit, body: kind.body, stride: STRIDE[kind.body], gear,
    hat: hat ? hatMesh : null, clips: Object.keys(p.actions),
    get clip() { return p.curName; },
    play(name, opts) { if (!p.actions[name]) return false; p.play(name, opts); return true; },
    // how solid (1) or gone (0) the person is: a door's dissolve (src/townpeople.js); no shadow while mostly gone
    get fade() { return u.fkFade.value; },
    set fade(f) {
      f = Math.max(0, Math.min(1, f));
      if (f !== u.fkFade.value) person.fadeAt = performance.now();   // (when it last changed: checkFades below)
      u.fkFade.value = f;
      const cast = shadows && f > 0.5; p.mesh.castShadow = cast; if (hatMesh) hatMesh.userData.mesh.castShadow = cast;
      for (const g of gear) g.castShadow = cast;
    },
    update(dt) { p.update(dt); },
    setPalette(pal) {
      const c = Array.isArray(pal) ? pal : PALETTES[pal] || PALETTES.drifter;
      u.fkTop.value.set(c[0]); u.fkBottom.value.set(c[1]); u.fkShoes.value.set(c[2]); u.fkHat.value.set(hatColour || c[3]);
      if (hatU) hatU.fkHat.value.set(hatColour || (piece && piece.colour) || c[3]);
      person.palette = pal;
    },
    setSkin(c) { u.fkSkin.value.copy(toColour(c, SKINS, SKINS[2])); },
    setHair(c) { u.fkHair.value.copy(toColour(c, HAIRS, HAIRS[2])); },
    // another hat of src/hats.js (its id; the cowboy hat for an unknown one), in its own colour (or the palette's)
    setHat(style) {
      if (!hatMesh) return;
      piece = hatPiece(lib, style); const inner = hatMesh.userData.mesh;
      inner.geometry = piece.geometry; fitPiece(inner); person.hatStyle = piece.id;
      person.setPalette(person.palette);
    },
    // the hat let go of where it is in the world (the caller adds it to the scene and lets it tumble); hatOn puts it back
    hatOff() {
      if (!hatMesh || !hatMesh.parent || hatMesh.parent !== bones.Head) return null;
      hatMesh.updateWorldMatrix(true, false); hatMesh.matrixWorld.decompose(hatMesh.position, hatMesh.quaternion, hatMesh.scale);
      hatMesh.removeFromParent(); person.hat = null; p.mesh.geometry = plainGeometry; return hatMesh;
    },
    hatOn() {
      if (!hatMesh) return; const fit = HAT_FIT[kind.body] || HAT_FIT.m;
      hatMesh.removeFromParent(); hatMesh.position.fromArray(fit.at); hatMesh.quaternion.identity(); hatMesh.scale.fromArray(fit.scale);
      bones.Head.add(hatMesh); person.hat = hatMesh; p.mesh.geometry = hatReady(kind);
    },
    dispose() {
      LIVE.delete(person);
      p.dispose(); if (hatMesh) { hatMesh.userData.mesh.material.dispose(); hatMesh.removeFromParent(); }
      for (const g of gear) g.removeFromParent();   // (their shapes and materials are shared: kept)
      if (p.mesh.skeleton) p.mesh.skeleton.dispose();   // (this person's own skeleton copy and its bone texture)
      p.root.removeFromParent();
    },
  };
  person.hatStyle = piece ? piece.id : null;
  person.setPalette(palette); person.setSkin(skin); person.setHair(hair);
  p.play('Idle', { fade: 0 }); p.update(Math.random() * 2);       // (a crowd shouldn't breathe in step)
  LIVE.add(person);
  return person;
}

// ── A STUCK DISSOLVE ────────────────────────────────────────────────────────────────────────────────────────────────
// Every dissolve in the game (a door, a road's end in the haze, a wagon made in sight, the dock) runs in a second or two.
// A person drawn in the scene whose fade has sat part-way for FADE_CHECK.hold seconds while they walked FADE_CHECK.moved
// metres is a see-through person walking about: something stopped their dissolve half-way. checkFades(scene) (the game
// calls it about once a second) snaps each one found solid and says so in the console, with who it was and where.
const LIVE = new Set();   // (every person made and not yet let go)
export const FADE_CHECK = { hold: 4, moved: 2 };
const _fw = new THREE.Vector3();
export function checkFades(scene) {
  const now = performance.now(), fixed = [];
  for (const p of LIVE) {
    const f = p.fade;
    if (f <= 0.02 || f >= 0.98 || now - (p.fadeAt || 0) < FADE_CHECK.hold * 1000) { p.fadeStuck = null; continue; }
    // (drawn: in the scene, it and everything above it shown)
    let o = p.root, shown = true;
    for (; o.parent; o = o.parent) if (!o.visible) { shown = false; break; }
    if (!shown || o !== scene || !scene.visible) { p.fadeStuck = null; continue; }
    p.root.getWorldPosition(_fw);
    if (!p.fadeStuck) { p.fadeStuck = { x: _fw.x, z: _fw.z, f }; continue; }
    if (Math.hypot(_fw.x - p.fadeStuck.x, _fw.z - p.fadeStuck.z) < FADE_CHECK.moved) continue;
    p.fade = 1; p.fadeStuck = null;
    const at = { outfit: p.outfit, fade: +f.toFixed(2), x: +_fw.x.toFixed(1), z: +_fw.z.toFixed(1) };
    fixed.push(at);
    console.info(`folk: a ${at.outfit} walking about part-faded (${at.fade}) at ${at.x}, ${at.z}: made solid`);
  }
  return fixed;
}

// ── THE LAWMAN'S GEAR (the sheriff and the deputy: makePerson's badge and holster) ──────────────────────────────────
// Made in code once and shared: a five-pointed star in gold with a little ball on each point; a leather holster
// (tapered, its belt loop and the strap that ties it round the thigh) with a revolver's walnut grip, hammer and cylinder
// showing over its top. Each is hung on its bone where it sits on that outfit's body: worked out once an outfit, from
// the person standing in the Idle pose (the star on the left breast, just off the coat; the holster against the outside
// of the right thigh, its top at the belt).
let GEAR = null;
// the gun belt: tan leather worn low over the clothes, dipping on the holster's side, a brass buckle at the front
const BELT = { y: 0.875, high: 0.045, dip: 0.03, off: 0.009, thick: 0.008, leather: '#8b5a2b', dark: '#5a3418', buckle: '#c49a3a' };
function gearParts() {
  if (GEAR) return GEAR;
  // the star: points 4.5 cm out, a thin plate with a bevel, the balls on its points
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.019 : 0.045, a = i / 10 * Math.PI * 2; const x = Math.sin(a) * r, y = Math.cos(a) * r; if (i) sh.lineTo(x, y); else sh.moveTo(x, y); }
  const plate = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 1 });
  const balls = []; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; balls.push(new THREE.SphereGeometry(0.0055, 6, 4).translate(Math.sin(a) * 0.047, Math.cos(a) * 0.047, 0.003)); }
  const star = mergeAll([plate, ...balls]);
  // the holster, in the person's own frame (y up, z forward, +x in toward the leg, as it hangs on the right side); its top
  // (the belt) at y = 0
  const tint = (g, hex) => { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const pouch = new THREE.CylinderGeometry(0.036, 0.024, 0.25, 6, 1).scale(0.62, 1, 1).translate(0, -0.135, 0.004).rotateX(0.12);
  const loop = new THREE.BoxGeometry(0.03, 0.05, 0.1).translate(0.006, -0.01, 0);
  const tie = new THREE.TorusGeometry(0.082, 0.006, 3, 10, Math.PI * 1.2).rotateX(Math.PI / 2).rotateY(-Math.PI * 0.4).translate(0.08, -0.21, 0);
  const grip = new THREE.BoxGeometry(0.026, 0.085, 0.032).translate(0, 0.05, 0).rotateX(-0.55).translate(0, 0.03, -0.012);
  const frame = new THREE.BoxGeometry(0.022, 0.03, 0.06).translate(0, 0.028, 0.012);
  const cyl = new THREE.CylinderGeometry(0.018, 0.018, 0.04, 6).rotateX(Math.PI / 2).translate(0, 0.022, 0.03);
  const hammer = new THREE.BoxGeometry(0.008, 0.022, 0.012).translate(0, 0.05, -0.008).rotateX(-0.3);
  const holster = mergeAll([tint(pouch, BELT.leather), tint(loop, BELT.dark), tint(tie, BELT.dark), tint(grip, '#3b2416'), tint(frame, '#2c2b2a'), tint(cyl, '#3a3937'), tint(hammer, '#2c2b2a')]);
  GEAR = {
    star: { geometry: star, material: new THREE.MeshStandardMaterial({ color: 0xe0b23e, metalness: 0.35, roughness: 0.32, emissive: 0x2a1c02 }) },
    holster: { geometry: holster, material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.12 }) },
  };
  return GEAR;
}
function mergeAll(list) {
  // (every part with the same attributes: position, normal, colour if any; no uv needed)
  const parts = list.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k); return n; });
  const withColour = parts.some((g) => g.attributes.color);
  let total = 0; for (const g of parts) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = withColour ? new Float32Array(total * 3) : null;
  let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (col && g.attributes.color) col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
// where the gear sits on this outfit: in the Chest bone's space (the star) and the right thigh's (the holster), from
// the clothes' own surface in the Idle pose (the person at the origin, facing +z; its left is +x)
function gearFit(kind, p, bones) {
  if (kind.gearFit) return kind.gearFit;
  const mesh = p.mesh, pos = mesh.geometry.attributes.position, kd = mesh.geometry.attributes._kind, v = new THREE.Vector3();
  const f = kind.body === 'f' ? 0.94 : 1;   // (the women stand a little shorter)
  let chest = null, hipX = Infinity, hipN = 0, hipZ = 0;
  for (let i = 0; i < pos.count; i++) {
    const k = Math.round(kd.getX(i)); if (k !== 3 && k !== 4) continue;
    v.fromBufferAttribute(pos, i); mesh.applyBoneTransform(i, v); v.applyMatrix4(mesh.matrixWorld);
    // the left breast: the furthest-forward point of the top round (0.095, 1.27)
    if (k === 3 && Math.abs(v.y - 1.27 * f) < 0.03 && Math.abs(v.x - 0.095) < 0.03 && (!chest || v.z > chest.z)) chest = v.clone();
    // the outside of the right thigh a little under the belt: the furthest-out point of the trousers there
    if (k === 4 && Math.abs(v.y - 0.78 * f) < 0.03 && v.x < 0) { if (v.x < hipX) hipX = v.x; hipZ += v.z; hipN++; }
  }
  // (a frame at `at` turned as the person stands, in the bone's own space)
  const put = (bone, at) => {
    bone.updateWorldMatrix(true, false);
    const local = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(new THREE.Matrix4().makeTranslation(at.x, at.y, at.z));
    const L = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() }; local.decompose(L.p, L.q, L.s); return L;
  };
  const fit = {};
  // the belt: round the outside of the clothes at its height (the furthest-out point in each of 32 directions from the
  // middle of the hips), on the Hips bone
  {
    const n = 32, R = new Float32Array(n), mid = { x: 0, z: 0, k: 0 }, pts = [];
    for (let i = 0; i < pos.count; i++) {
      const k = Math.round(kd.getX(i)); if (k !== 3 && k !== 4) continue;
      v.fromBufferAttribute(pos, i); mesh.applyBoneTransform(i, v); v.applyMatrix4(mesh.matrixWorld);
      if (Math.abs(v.y - BELT.y * f) < 0.035) { pts.push(v.x, v.z); mid.x += v.x; mid.z += v.z; mid.k++; }
    }
    if (mid.k > 12 && bones.Hips) {
      mid.x /= mid.k; mid.z /= mid.k;
      for (let q = 0; q < pts.length; q += 2) { const dx = pts[q] - mid.x, dz = pts[q + 1] - mid.z, b = ((Math.round(Math.atan2(dz, dx) / (Math.PI * 2) * n) % n) + n) % n; R[b] = Math.max(R[b], Math.hypot(dx, dz)); }
      for (let pass = 0; pass < 2; pass++) for (let b = 0; b < n; b++) if (!R[b]) R[b] = Math.max(R[(b + 1) % n], R[(b + n - 1) % n]);
      const Rs = R.map((r, b) => Math.max(r, R[(b + 1) % n], R[(b + n - 1) % n]));   // (over the bumps either side)
      fit.belt = beltGeometry(Rs, mid, f);
      fit.beltRight = mid.x - (Rs[n / 2] + BELT.off + BELT.thick);   // (the belt's outside on the right: x)
      fit.beltAt = put(bones.Hips, new THREE.Vector3(0, 0, 0));
    }
  }
  if (chest && bones.Chest) fit.star = put(bones.Chest, chest.clone().add(new THREE.Vector3(0, 0, 0.004)));
  // the holster: against the outside of the thigh, outside the belt too, its top at the belt on that side
  if (hipN && bones.UpperLegR) fit.holster = put(bones.UpperLegR, new THREE.Vector3(Math.min(hipX - 0.022, fit.beltRight != null ? fit.beltRight - 0.016 : Infinity), (BELT.y - BELT.dip) * f + 0.012, hipZ / hipN));
  return (kind.gearFit = fit);
}
// the belt's band: its outer face and its top edge, `off` metres outside the clothes' outline R (32 directions round
// mid), its middle at BELT.y, dipping BELT.dip on the right (the holster's side, -x); the buckle at the front
function beltGeometry(R, mid, f) {
  const n = R.length, P = [], N = [], C = [], col = new THREE.Color(BELT.leather), dark = new THREE.Color(BELT.dark);
  const at = (b, out, up) => { const a = b / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), r = R[b % n] + BELT.off + out, y = BELT.y * f - BELT.dip * Math.max(0, -c) + up;
    return [mid.x + c * r, y, mid.z + s * r, c, s]; };
  const quad = (a, b, c, d, nrm, k) => { for (const q of [a, b, c, a, c, d]) { P.push(q[0], q[1], q[2]); N.push(...nrm(q)); C.push(k.r, k.g, k.b); } };
  for (let b = 0; b < n; b++) {
    const h = BELT.high / 2, t = BELT.thick;
    const o0 = at(b, t, -h), o1 = at(b + 1, t, -h), o2 = at(b + 1, t, h), o3 = at(b, t, h);
    quad(o0, o1, o2, o3, (q) => [q[3], 0, q[4]], col);                               // (the outer face)
    const i2 = at(b + 1, 0, h), i3 = at(b, 0, h);
    quad(o3, o2, i2, i3, () => [0, 1, 0], dark);                                     // (the top edge)
    const i0 = at(b, 0, -h), i1 = at(b + 1, 0, -h);
    quad(i0, i1, o1, o0, () => [0, -1, 0], dark);                                    // (the bottom edge)
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  // the buckle: a brass square at the front (+z)
  const front = at(n / 4, BELT.thick + 0.004, 0), bk = new THREE.BoxGeometry(0.05, 0.042, 0.008).toNonIndexed(); bk.deleteAttribute('uv');
  bk.translate(front[0], front[1], front[2]);
  const bc = new THREE.Color(BELT.buckle), ca = new Float32Array(bk.attributes.position.count * 3); for (let i = 0; i < bk.attributes.position.count; i++) bc.toArray(ca, i * 3);
  bk.setAttribute('color', new THREE.BufferAttribute(ca, 3));
  const out = mergeAll([g, bk]); out.computeBoundingSphere();
  return out;
}
function wear(bone, part, L, shadows) {
  const m = new THREE.Mesh(part.geometry, part.material);
  m.position.copy(L.p); m.quaternion.copy(L.q);
  m.castShadow = shadows; m.receiveShadow = false; m.raycast = () => {};
  bone.add(m);
  return m;
}
