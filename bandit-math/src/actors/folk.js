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
//   makePerson(lib, { outfit, palette, skin, hair, hat, hatColour, hatStyle, shadows, kid }) -> person
//     outfit   farmer_m (default; the player), adventurer_m, adventurer_f, casual_m, casual_f, worker_m, suit_m,
//              suit_f, formal_f
//     palette  a name from PALETTES, or four colours [top, bottom, shoes, hat/pack]
//     skin, hair   a colour ('#c68d62', 0xc68d62, a THREE.Color) or a number: an index into SKINS / HAIRS
//     hat      true: the cowboy hat on the Head bone (hair that would poke through tucked in); false: bare-headed.
//              Default: on, but for the formal dress (her piled-up hair won't go under it). hatColour: the hat apart
//              from the palette's fourth colour. hatStyle: which hat (an id from src/hats.js: the cowboy hat when
//              unset; the others are shaped in hatshapes.js and come in their own colour unless hatColour is given)
//   person.root (place and turn it: feet on y = 0, facing +Z, 1.8 m or so), .mesh, .bones { name: bone } (three.js
//     drops the dots: Wrist.R is bones.WristR), .hat (the hat's mesh, on bones.Head; null without one), .play(name,
//     { fade, speed, once }), .update(dt), .stride (m/s the Walk and Run clips carry them at speed 1), .clips,
//     .setPalette(p), .setSkin(c), .setHair(c), .hatOff() -> the hat, let go of in the world where it was (to tumble),
//     .hatOn(), .setHat(style) (another hat, the same place), .hatStyle, .dispose()
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { loadPeople, Person, STRIDE } from '../../world/objects/people.js';
import { softShade } from './shading.js';
import { hatPiece } from './hatshapes.js';

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
function folkMaterial(u, shade, key) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = FOLK_VS + sh.vertexShader
      .replace('#include <color_vertex>', '#include <color_vertex>\n  vColor.rgb = fkColour(vColor.rgb, _kind);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_SKINNING\n  if (fkHide > 0.5 && _kind > 5.5 && dot(skinWeight, vec4(equal(skinIndex, vec4(fkHead)))) > 0.5) transformed = vec3(0.0);\n#endif');
    if (shade) shade(sh);
  };
  mat.customProgramCacheKey = () => 'folk-1-' + key + (shade ? '-shaded' : '');
  return mat;
}

const toColour = (c, list, fallback) => {
  if (c && c.isColor) return c.clone();
  if (typeof c === 'number' && Number.isInteger(c) && c >= 0 && c < list.length) return new THREE.Color(list[c]);
  if (c !== undefined && c !== null && c !== '') return new THREE.Color(c);
  return new THREE.Color(fallback);
};

export function makePerson(lib, { outfit = 'farmer_m', palette = 'drifter', skin = 2, hair = 2, hat, hatColour = null, hatStyle = null, shadows = true, kid = false } = {}) {
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
  const person = {
    root: p.root, mesh: p.mesh, bones, person: p, outfit, body: kind.body, stride: STRIDE[kind.body],
    hat: hat ? hatMesh : null, clips: Object.keys(p.actions),
    get clip() { return p.curName; },
    play(name, opts) { if (!p.actions[name]) return false; p.play(name, opts); return true; },
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
      p.dispose(); if (hatMesh) { hatMesh.userData.mesh.material.dispose(); hatMesh.removeFromParent(); }
      if (p.mesh.skeleton) p.mesh.skeleton.dispose();   // (this person's own skeleton copy and its bone texture)
      p.root.removeFromParent();
    },
  };
  person.hatStyle = piece ? piece.id : null;
  person.setPalette(palette); person.setSkin(skin); person.setHair(hair);
  p.play('Idle', { fade: 0 }); p.update(Math.random() * 2);       // (a crowd shouldn't breathe in step)
  return person;
}
