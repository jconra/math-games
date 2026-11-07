// THE CREW: the station's people, put together from parts (a suit, a head, hair) on one shared skeleton, playing the
// Mathwood Valley people's clips.
//
// THE SKELETON is the Mathwood men's (Quaternius' modular characters, 62 bones: Root, Body, Hips, Abdomen, Torso,
// Chest, Neck, Head, the clavicles, arms, five fingers a hand, legs, feet; mathwood-valley/models/people/). Each part
// is rigged to it in Blender (~/pw/space-math/rigs/crew-rig/: the joints moved to the crew body's own proportions,
// every bone keeping the Mathwood bone's own rest turn, the body re-posed into that rest pose before binding), so the
// Mathwood clips play on it as they are. The bodies, the clips and the playing are Mathwood's own code: the person is
// made by world/objects/people.js (Person: its clip mixer, fades, and the bones put back before each mixer update),
// imported, never copied.
//   Two things differ from a Mathwood person, both done here at load and after each update:
//   - the clips' moves (their position tracks: the body's root, the feet, a shrug; the Blender-made clips carry one
//     for every bone) were made for the Mathwood bones' lengths, so each is laid on the crew's own rest offset:
//     crew rest + (the clip's value - the Mathwood rest) x the hips' height ratio (retargetClips);
//   - the Mathwood feet are not children of the shins (the original rig placed them with IK), so each foot is put at
//     its own shin's end every frame (the clips keep that rule on their own skeleton: the foot's root = the shin's root
//     + the shin's own direction x the shin's length), or a longer shin would leave the boot behind.
//
// THE PARTS (space-station/assets/crew/: suit_<id>.glb, head_<id>.glb, hair_<id>.glb; listed in crew.json). Each is
// skinned to the full skeleton and carries it; the head and the hair are bound to the suit's own bones when a person
// is put together, so any head goes with any suit and any hair with any head. Where they meet is fixed (the attachment
// rules, ~/pw/space-math/characters/CHARACTERS.md): a head is skinned to the Neck and Head bones only and its neck runs
// down inside the collar; hair is skinned to the Head bone only and sits on the standard skull.
//
// COLOURS without new textures: each part's material is patched so its marked areas take a colour (the masks, written
// by the rig's post step):
//   suit   the amber marks, the teal light lines (they glow) and the dark panels, by JOBS; the whites (the light, near-
//          neutral cloth and plates), by the UNIFORM colour. All four in the suit's own small mask texture (in its
//          material's occlusion slot at strength 0: R marks, G lines, B 128 neither, up to 255 white, down to 0 panel);
//          a suit made before it (no whites) has the first three in its textures' spare channels (the metal-roughness
//          texture's red, the colour texture's alpha, the normal map's alpha), still read. A suit that keeps its own
//          colours (crewPart.jobColours false: the captains' uniforms) takes no job colour, only the uniform colour.
//   head   the skin (the colour texture's alpha), by a skin tone
//   hair   all of it, by a hair colour
// A colour is laid on as a shift from the part's own (measured) colour, scaled by how light each texel is (skin: by
// each channel's ratio to the head's own), so the texture's shading and detail stay and the part's own colours give it
// back exactly.
//
// A VISOR (an android's helmet: Captain Vega): the head part's second mesh, its material named 'visor', laid out as
// seen from the front (x across, up up, one scale both ways, the visor's middle at the layout's middle). It is plain
// dark glass, and the face on it is drawn by its shader as glowing strokes, as the character sheet draws them: EXPRESSIONS
// (neutral, happy, thinking with its turning ring of dots, surprised), set with c.setExpression(name).
//
// CARD HAIR (Blender-made styles: a smooth shell plus hair cards, crew.json `cards: true`): one shared grey strand atlas
// for every style (crew.json hairAtlas), tinted by the hair colour, drawn in one alpha-to-coverage pass (hairCardMaterial).
// The Mathwood hair comes smooth-shaded (crew.json `smooth`: the same triangles, its vertices merged and its normals
// smoothed) unless loadCrew({ smoothHair: false }) or lib.smoothHair = false (then its flat facets, as the pack has them).
//
// A HAIR'S FIT (crew.json: a hair entry's optional `fit`, made with the Crew Lab's Fit row; see "a hair's fit" below):
// nudged, sized, its lower edges tucked in toward the head, on every head or one head's own way. Applied to the person's
// own copy of the hair's positions when it's put together, so the game and the lab show the same.
//
//   const lib = await loadCrew()                lib.list: crew.json; lib.part(kind, id) -> its glTF; lib.clipsFor(suit id)
//                                               -> { body, rig, clips (fitted to that suit), stride }; lib.hairAtlas();
//                                               lib.fitOf(hair id, head id) -> the fit makeCrew gives that hair on that
//                                               head; lib.fits { hair id: fit } (empty: a layer over crew.json's, each
//                                               entry replacing that hair's whole fit; the Crew Lab's while it's edited)
//   const c = await makeCrew(lib, recipe)       recipe { suit, head, hair, colours: { job, uniform, skin, hair } }
//     c.root (place and turn it: feet on y 0, facing +z), c.person (Mathwood's Person), c.play(name, { fade, speed, once }),
//     c.update(dt), c.setColours({ job, uniform, skin, hair }), c.meshes { suit, head, hair, visor }, c.bones, c.body ('m' | 'f':
//     the suit's skeleton, whose clips it plays), c.stride (m/s at speed 1: { Walk, Run }), c.dispose(),
//     c.setExpression(name) (a visor's face; recipe.expression sets the first), c.expression,
//     await c.setFit(fit) (the hair's fit, live: { offset, scale, tuck, tuckStart } as lib.fitOf gives; null: as made),
//     c.fit (the fit it wears), c.fitStats ({ tucked: points the tuck moved, held: of those, how many it stopped 4 mm off
//     the head })
//   JOBS, UNIFORM_COLOURS, SKIN_TONES, HAIR_COLOURS, CLIPS, EXPRESSIONS, fitFor, SKULL, HAIR_CLEAR
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Person, STRIDE } from '../../mathwood-valley/world/objects/people.js';

export const CREW_DIR = new URL('../assets/crew/', import.meta.url).href;
export const PEOPLE_DIR = new URL('../../mathwood-valley/models/people/', import.meta.url).href;

// the Mathwood clips a crew member can use (the gun, lasso, riding and instrument clips left out), by skeleton (the men's
// 'm' and the women's 'f' are built differently: a suit is rigged to one of them) and file
const BASIC = ['Idle', 'Idle_Neutral', 'Walk', 'Run', 'Run_Back', 'Run_Left', 'Run_Right', 'Wave', 'Interact', 'Roll', 'HitRecieve', 'Death'];
const CROWD = ['Stand_Listen', 'Stand_Clap', 'Sit_Listen', 'Sit_Clap', 'Stool_Bar', 'Stool_Clap'];
export const CLIP_FILES = {
  m: { 'anims_m.glb': BASIC, 'clips_crowd_m.glb': [...CROWD, 'Bar_Polish'], 'clips_work_m.glb': ['Hammer', 'Tend_Forge'], 'clips_drive_m.glb': ['Drive'] },
  f: { 'anims_f.glb': BASIC, 'clips_crowd_f.glb': CROWD, 'clips_drive_f.glb': ['Drive'] },
};
export const CLIPS = [...new Set(Object.values(CLIP_FILES).flatMap((F) => Object.values(F).flat()))];
// (the clips that play once and hold their last pose)
export const ONCE = new Set(['Death', 'Roll', 'HitRecieve']);

// colours by job (sRGB, as a picker shows them): the suit's amber marks, its light lines, its dark panels. null keeps
// the suit's own. The explorers wear the suit as made.
export const JOBS = {
  explorer: { name: 'Explorer', marks: null, lines: null, panels: null },
  miner: { name: 'Miner', marks: '#ffd21a', lines: '#ffb21e', panels: '#2b2a26' },
  medic: { name: 'Medic', marks: '#e8f6f4', lines: '#26e0cf', panels: '#c3ccd2' },
  hauler: { name: 'Hauler', marks: '#ff6a12', lines: '#ff8a2a', panels: '#3b322c' },
  staff: { name: 'Station staff', marks: '#3d7fe0', lines: '#4fb6ff', panels: '#6c7682' },
};
// the uniform's whites (any sRGB colour; null keeps the suit's own): a few to pick from
export const UNIFORM_COLOURS = ['#e9ecef', '#c9ccd1', '#8a96a3', '#3b4a5c', '#1f3a6b', '#2f6db3', '#2b6b5a', '#6b2d34', '#b8742a', '#d9c7a1'];
export const SKIN_TONES = ['#f2d3bd', '#e8bf9f', '#d9a37f', '#c48a62', '#a66d45', '#86522f', '#663b22', '#47291a'];
export const HAIR_COLOURS = ['#17110d', '#2e1f15', '#4a2f1d', '#6b4127', '#8f5a32', '#b4824f', '#d8bc84', '#a83c22', '#8f8a84', '#d6d3cc'];

// a visor's faces (kit/crew.js visorMaterial), in the order its shader numbers them
export const EXPRESSIONS = { neutral: 'Neutral', happy: 'Happy', thinking: 'Thinking', surprised: 'Surprised' };

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const clean = (n) => THREE.PropertyBinding.sanitizeNodeName(n);
const lin = (s) => new THREE.Color(s);          // (sRGB string -> three's linear working colour)

// a texture as GLTFLoader loads one (an ImageBitmap where it can, never premultiplied, so the colour under the strand
// atlas's clear texels survives for the mipmaps; laid out as glTF's: no flip)
const UA = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const FF = UA.includes('Firefox') ? +(UA.match(/Firefox\/([0-9]+)\./) || [0, 0])[1] : -1;
const texLoader = typeof createImageBitmap === 'undefined' || /^((?!chrome|android).)*safari/i.test(UA) || (FF >= 0 && FF < 98)
  ? new THREE.TextureLoader() : new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'none', premultiplyAlpha: 'none' });
function hairTexture(url, srgb) {
  return new Promise((ok, no) => texLoader.load(url, (img) => {
    const t = img.isTexture ? img : new THREE.Texture(img);
    t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; t.needsUpdate = true;
    ok(t);
  }, undefined, no));
}

// ── loading ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function loadCrew({ dir = CREW_DIR, people = PEOPLE_DIR, smoothHair = true } = {}) {
  const list = await (await fetch(dir + 'crew.json')).json();
  const parts = new Map(), raws = new Map(), fitted = new Map();
  const lib = { dir, list };
  lib.entry = (kind, id) => (list.parts[kind] || []).find((p) => p.id === id);
  // a skeleton's own clips, as the Mathwood files have them (loaded once, when a suit on that skeleton first comes)
  lib.rawClips = (body) => {
    if (!raws.has(body)) {
      const F = CLIP_FILES[body];
      raws.set(body, Promise.all(Object.keys(F).map((f) => loader.loadAsync(people + f))).then((files) => {
        const raw = []; Object.keys(F).forEach((f, i) => { for (const c of files[i].animations) if (F[f].includes(c.name)) raw.push(c); });
        return raw;
      }));
    }
    return raws.get(body);
  };
  // (the Mathwood hair comes smooth-shaded unless lib.smoothHair is set false: an entry's `smooth` file)
  lib.smoothHair = smoothHair;
  lib.fileOf = (kind, id) => { const P = lib.entry(kind, id); return P && (kind === 'hair' && lib.smoothHair && P.smooth ? P.smooth : P.file); };
  lib.part = (kind, id) => {
    const P = lib.entry(kind, id);
    if (!P) return Promise.reject(new Error(`crew: no ${kind} "${id}" in crew.json`));
    const file = lib.fileOf(kind, id), key = kind + ':' + file;
    if (!parts.has(key)) parts.set(key, loader.loadAsync(dir + file));
    return parts.get(key);
  };
  // a hair's fit on a head (a hair's fit, below): lib.fits' entry for that hair if it has one, else crew.json's
  lib.fits = {};
  lib.fitOf = (hair, head) => {
    if (!hair) return null;
    return fitFor(Object.prototype.hasOwnProperty.call(lib.fits, hair) ? lib.fits[hair] : (lib.entry('hair', hair) || {}).fit, head);
  };
  // a head's outline round the skull's upright axis, for the tuck (once a head)
  const fields = new Map();
  lib.headField = (id) => { if (!fields.has(id)) fields.set(id, lib.part('head', id).then(headField)); return fields.get(id); };
  // the card hair's one shared strand atlas and its normal map (list.hairAtlas), loaded once for every style
  let atlas = null;
  lib.hairAtlas = () => atlas || (atlas = Promise.all([hairTexture(dir + list.hairAtlas.map, true), hairTexture(dir + list.hairAtlas.normal, false)])
    .then(([map, normalMap]) => ({ map, normalMap })));
  // the clips fitted to one suit (its own bones' lengths: see the top), once a suit
  lib.clipsFor = async (id) => {
    if (!fitted.has(id)) {
      fitted.set(id, (async () => {
        const g = await lib.part('suit', id), rig = g.scene.userData.crewRig, body = lib.entry('suit', id).skeleton || 'm';
        const rest = {}; g.scene.traverse((o) => { if (o.isBone) rest[o.name] = o.quaternion.toArray(); });
        return { body, rig, clips: retargetClips(await lib.rawClips(body), rig, rest), stride: strideOf(rig, body) };
      })());
    }
    return fitted.get(id);
  };
  return lib;
}

// the clips' position tracks laid on the crew's own rest offsets (see the top); and every bone a clip leaves alone that
// Idle moves (Wave, Interact and Hit move only the upper body) held where Idle's first frame has it, so the legs stand
// rather than keep whatever the clip before left in them (the Mathwood person keeps its bent bones from frame to frame)
// (and a kept bone that Idle leaves alone too, the feet's turn, held at the rest pose: flat on the floor)
const KEPT = /^(Hips|Abdomen|Torso|Chest|Neck|Head|Shoulder[LR]|UpperArm[LR]|LowerArm[LR]|Wrist[LR]|UpperLeg[LR]|LowerLeg[LR]|Foot[LR])$/;
export function retargetClips(clips, rig, rest = {}) {
  const out = retargetMoves(clips, rig), idle = out.find((c) => c.name === 'Idle');
  return out.map((c) => {
    const has = new Set(c.tracks.map((t) => t.name));
    for (const t of idle ? idle.tracks : []) {
      if (has.has(t.name)) continue;
      const n = t.getValueSize(), v = Array.from(t.values.slice(0, n));
      c.tracks.push(new t.constructor(t.name, [0, c.duration], [...v, ...v])); has.add(t.name);
    }
    for (const [bone, q] of Object.entries(rest)) {
      const name = bone + '.quaternion';
      if (!KEPT.test(bone) || has.has(name)) continue;
      c.tracks.push(new THREE.QuaternionKeyframeTrack(name, [0, c.duration], [...q, ...q]));
    }
    return c;
  });
}
function retargetMoves(clips, rig) {
  const map = {}; for (const k of Object.keys(rig.dstRest)) map[clean(k)] = k;
  const k = rig.dstRest.Body[1] / rig.srcRest.Body[1];
  return clips.map((c0) => {
    const c = c0.clone();
    for (const t of c.tracks) {
      if (!t.name.endsWith('.position')) continue;
      const b = map[t.name.slice(0, -9)], s = b && rig.srcRest[b], d = b && rig.dstRest[b];
      if (!s || !d) continue;
      const v = t.values;
      for (let i = 0; i < v.length; i += 3) { v[i] = d[0] + (v[i] - s[0]) * k; v[i + 1] = d[1] + (v[i + 1] - s[1]) * k; v[i + 2] = d[2] + (v[i + 2] - s[2]) * k; }
    }
    return c;
  });
}
// how fast the Walk and Run carry the crew at speed 1 (m/s): the Mathwood men's, with the hips' height
const strideOf = (rig, body) => { const k = rig.dstRest.Body[1] / rig.srcRest.Body[1], S = STRIDE[body] || STRIDE.m; return { Walk: S.Walk * k, Run: S.Run * k }; };

// ── the materials: each part's own, patched for its colours ────────────────────────────────────────────────────────
const KIND_DEF = { suit: 'CREW_SUIT', head: 'CREW_HEAD', hair: 'CREW_HAIR' };
function crewUniforms(refs) {
  const R = (n, d) => (refs && refs[n] ? new THREE.Color().fromArray(refs[n]) : new THREE.Color(d));
  return {
    crMarks: { value: R('marks', 0xe0a020) }, crMarksRef: { value: R('marks', 0xe0a020) },
    crLines: { value: R('lines', 0x20c0c0) }, crLinesRef: { value: R('lines', 0x20c0c0) },
    crPanels: { value: R('panels', 0x202020) }, crPanelsRef: { value: R('panels', 0x202020) },
    crWhites: { value: R('whites', 0xc8c8c8) }, crWhitesRef: { value: R('whites', 0xc8c8c8) },
    crSkin: { value: R('skin', 0xc08060) }, crSkinRef: { value: R('skin', 0xc08060) },
    crHair: { value: R('hair', 0x402010) }, crHairRef: { value: R('hair', 0x402010) },
    crGlow: { value: refs && refs.glow != null ? refs.glow : 0.0 },
  };
}
function crewMaterial(src, kind, part) {
  const m = src.clone(), refs = part && part.refs;
  const u = m.userData.crew = crewUniforms(refs);
  const has = part && part.masks ? part.masks : {};
  // (skin and hair: no sheen of the room's reflections; the painted face carries its own light and shade)
  if (kind !== 'suit') { m.roughness = Math.max(m.roughness, 0.78); m.envMapIntensity = 0.55; }
  // (the suit's generated normal map is busy, ripples where the plates are smooth: half strength)
  else if (m.normalMap) m.normalScale.set(0.5, 0.5);
  m.defines = { ...(m.defines || {}), [KIND_DEF[kind]]: '' };
  // (a suit's own mask texture: in the occlusion slot at strength 0, taken out of it as the masks)
  if (kind === 'suit' && has.tex === 'occlusion' && m.aoMap) { u.crMaskMap = { value: m.aoMap }; m.aoMap = null; m.defines.CREW_MASKTEX = ''; }
  else if (has.marks) m.defines.CREW_MARKS = '';
  if (!('CREW_MASKTEX' in m.defines)) { if (has.lines) m.defines.CREW_LINES = ''; if (has.panels) m.defines.CREW_PANELS = ''; }
  if (has.skin) m.defines.CREW_SKIN = '';
  m.userData.crewOwnColours = !!(part && part.jobColours === false);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = `uniform vec3 crMarks, crMarksRef, crLines, crLinesRef, crPanels, crPanelsRef, crWhites, crWhitesRef, crSkin, crSkinRef, crHair, crHairRef; uniform float crGlow;
#ifdef CREW_MASKTEX
uniform sampler2D crMaskMap;
#endif
float crLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// (a mask kept in an alpha channel between 4 and 255: lossy WebP drops the colour under a fully clear pixel)
float crA(float a) { return clamp((a * 255.0 - 4.0) / 251.0, 0.0, 1.0); }
// (a colour laid on as a shift from the part's own, scaled by how light this texel is against it)
vec3 crShift(vec3 c, vec3 to, vec3 ref, float m) { return max(c + (to - ref) * min(crLum(c) / max(crLum(ref), 1e-4), 2.5) * m, 0.0); }
` + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
  float crLineMask = 0.0;
#ifdef USE_MAP
  #if defined(CREW_SUIT) && defined(CREW_MASKTEX)
  {
    vec4 crM = texture2D(crMaskMap, vMapUv);
    float crB = crM.b * 255.0;
    crLineMask = crM.g;
    diffuseColor.rgb = crShift(diffuseColor.rgb, crWhites, crWhitesRef, clamp((crB - 128.0) / 127.0, 0.0, 1.0));
    diffuseColor.rgb = crShift(diffuseColor.rgb, crLines, crLinesRef, crLineMask);
    diffuseColor.rgb = crShift(diffuseColor.rgb, crMarks, crMarksRef, crM.r);
    diffuseColor.rgb = crShift(diffuseColor.rgb, crPanels, crPanelsRef, clamp((128.0 - crB) / 128.0, 0.0, 1.0));
  }
  #endif
  #if defined(CREW_SUIT) && defined(CREW_LINES)
    crLineMask = crA(sampledDiffuseColor.a);
    diffuseColor.rgb = crShift(diffuseColor.rgb, crLines, crLinesRef, crLineMask);
  #endif
  #if defined(CREW_SUIT) && defined(CREW_MARKS)
    diffuseColor.rgb = crShift(diffuseColor.rgb, crMarks, crMarksRef, texture2D(roughnessMap, vRoughnessMapUv).r);
  #endif
  #if defined(CREW_SUIT) && defined(CREW_PANELS)
    diffuseColor.rgb = crShift(diffuseColor.rgb, crPanels, crPanelsRef, crA(texture2D(normalMap, vNormalMapUv).a));
  #endif
  #if defined(CREW_HEAD) && defined(CREW_SKIN)
    // (skin by each channel's ratio, not a shift: a darker tone darkens the painted face's own light and shade
    // alike, where a shift would take more red than blue out of the shadows and turn them green)
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * clamp(crSkin / max(crSkinRef, vec3(1e-4)), 0.1, 4.0), crA(sampledDiffuseColor.a));
  #endif
  diffuseColor.a = opacity;
#endif
#ifdef CREW_HAIR
  diffuseColor.rgb = crShift(diffuseColor.rgb, crHair, crHairRef, 1.0);
#endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += crLines * crLineMask * crGlow;`);
  };
  m.customProgramCacheKey = () => 'crew-1-' + Object.keys(m.defines).join('-');
  return m;
}

// ── card hair (made in Blender: ~/pw/space-math/rigs/crew-hair/) ─────────────────────────────────────────────────
// One mesh: a smooth shell under the hair (opaque texels of the atlas) and hair cards over it (strand clumps with
// coverage in the alpha), all mapped into one shared grey strand atlas (lib.hairAtlas) and tinted by the hair colour
// (the colour over the atlas's mean value, so the hair averages out to the colour picked). Drawn in ONE pass: an alpha
// cut-out with alpha-to-coverage (MSAA turns the cut into soft edges; no sorting), double-sided, the normals never
// flipped on back faces (the cards carry normals bent outward from the head, so both faces light as the hair's outer
// surface), the cut sharpened by its screen-space rate and lifted with the mip level so cards don't thin out at a
// distance. A strand highlight (Kajiya-Kay, two lobes) runs along each vertex's strand direction (_strand, skinned with
// the bones). The vertex colour darkens the inner layers (rgb) and fades the roots at the hairline (alpha). Shadows are
// cast through a cut-out depth material (c.meshes.hair.customDepthMaterial).
export const HAIR_SPEC = { shift1: -0.08, shift2: 0.12, exp1: 90.0, exp2: 18.0, spec1: 0.045, spec2: 0.5 };
const HAIR_CUT = 0.42;
function hairCardMaterial(part, atlas) {
  // (a style's own look, from its part: how strong its highlight and its strands' relief are, how rough it is)
  const refs = part.refs || {}, look = { spec: 1, normal: 0.7, rough: 0.78, env: 0.55, ...(part.look || {}) };
  const m = new THREE.MeshStandardMaterial({ name: 'hair_cards', map: atlas.map, normalMap: atlas.normalMap, vertexColors: true,
    alphaTest: HAIR_CUT, alphaToCoverage: true, side: THREE.DoubleSide, roughness: look.rough, metalness: 0, envMapIntensity: look.env });
  m.normalScale.set(look.normal, -look.normal);   // (glTF's normal maps are +y up the texture; three's uv runs the other way)
  const u = m.userData.crew = crewUniforms(refs);
  u.crMean = { value: part.mean || 0.5 }; u.crTexSize = { value: (atlas.map.image && atlas.map.image.width) || 1024 };
  for (const [k, v] of Object.entries(HAIR_SPEC)) u['cr_' + k] = { value: /^spec/.test(k) ? v * look.spec : v };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute vec3 _strand; varying vec3 vCrStrand;\n' + sh.vertexShader.replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
  vec3 crS = _strand;
#ifdef USE_SKINNING
  crS = (skinMatrix * vec4(crS, 0.0)).xyz;
#endif
  vCrStrand = normalize((modelViewMatrix * vec4(crS, 0.0)).xyz + 1e-6);`);
    sh.fragmentShader = `varying vec3 vCrStrand;
uniform vec3 crHair; uniform float crMean, crTexSize, cr_shift1, cr_shift2, cr_exp1, cr_exp2, cr_spec1, cr_spec2;
` + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
  diffuseColor.rgb *= crHair / crMean;`)
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace(/\n[^\n]*\*= faceDirection;/g, ''))
      .replace('#include <alphatest_fragment>', `
  {
    // (a fade in the vertex alpha (a hairline, a card's roots) takes the darker strands first, so a faded edge breaks
    // up along the strands instead of ending in a clean line)
    float crVA = 1.0;
#ifdef USE_COLOR_ALPHA
    crVA = vColor.a;
#endif
    diffuseColor.a = opacity * sampledDiffuseColor.a * clamp((crVA - (1.0 - sampledDiffuseColor.r) * 0.85) / 0.15, 0.0, 1.0);
    vec2 crT = vMapUv * crTexSize;
    float crMip = max(0.0, 0.5 * log2(max(dot(dFdx(crT), dFdx(crT)), dot(dFdy(crT), dFdy(crT)))));
    diffuseColor.a *= 1.0 + crMip * 0.25;
    // (the cut sharpened to about a pixel wide, so alpha-to-coverage spreads only the edge across the MSAA samples;
    // three r158 has no define of its own for alpha-to-coverage, and without MSAA this is a plain cut-out a pixel wider)
    diffuseColor.a = clamp((diffuseColor.a - alphaTest) / max(fwidth(diffuseColor.a), 0.0001) + 0.5, 0.0, 1.0);
    if (diffuseColor.a <= 0.0) discard;
  }`)
      .replace('#include <opaque_fragment>', `
#if NUM_DIR_LIGHTS > 0
  {
    vec3 crDx = dFdx(-vViewPosition), crDy = dFdy(-vViewPosition);
    vec3 crStr = normalize(vCrStrand - normal * dot(vCrStrand, normal) + 1e-6);
    vec3 crV = normalize(vViewPosition);
    // (cards seen edge-on have no steady strand direction: their highlight fades out)
    float crFace = smoothstep(0.08, 0.35, abs(dot(normalize(cross(crDx, crDy)), crV)));
    float crGrain = sampledDiffuseColor.r;
    vec3 crHi = vec3(0.0);
    for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
      vec3 L = directionalLights[i].direction; vec3 H = normalize(L + crV);
      vec3 T1 = normalize(crStr + normal * cr_shift1), T2 = normalize(crStr + normal * cr_shift2);
      float d1 = dot(T1, H), d2 = dot(T2, H);
      float s1 = pow(sqrt(max(0.0, 1.0 - d1 * d1)), cr_exp1), s2 = pow(sqrt(max(0.0, 1.0 - d2 * d2)), cr_exp2);
      float lit = smoothstep(-0.15, 0.45, dot(normal, L)) * crFace;
      crHi += directionalLights[i].color * lit * (s1 * cr_spec1 * mix(0.4, 1.3, crGrain) + s2 * cr_spec2 * diffuseColor.rgb * crGrain);
    }
    outgoingLight += crHi;
  }
#endif
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'crew-hair-cards-1';
  return m;
}
// (the shadow a card hair casts: its strands' cut-out, not its cards' rectangles)
function hairDepthMaterial(atlas) {
  return new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas.map, alphaTest: 0.5, side: THREE.DoubleSide });
}
// ── a visor: dark glass, and a face drawn on it ──────────────────────────────────────────────────────────────────
// The face is drawn in the visor's own layout (p: x across, y up, the visor's middle at 0, its width about 1) by
// distances to strokes: a stroke's core and a soft glow round it, added to the light the glass gives off. The eyes are
// 0.38 apart; each expression is the sheet's:
//   neutral    two upright eyes and a short straight mouth (the character sheet shows none: a plain one), blinking now and then
//   happy      eyes closed in arcs (upside-down U's) and a smile
//   thinking   one eye a dash, the other a ring of dots turning as a loading ring does, the mouth a small frown
//   surprised  round eyes, a small round mouth
const VISOR_GLSL = `
uniform int vsExpr; uniform float vsTime, vsGlow; uniform vec3 vsCol;
float vsSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
// (an arc of the circle round c of radius r, from angle a0 to a1 (radians, a0 < a1): a stroke's distance)
float vsArc(vec2 p, vec2 c, float r, float a0, float a1) {
  vec2 q = p - c; float a = atan(q.y, q.x), m = 0.5 * (a0 + a1), h = 0.5 * (a1 - a0);
  if (abs(mod(a - m + 3.14159265, 6.2831853) - 3.14159265) <= h) return abs(length(q) - r);
  return min(length(p - c - r * vec2(cos(a0), sin(a0))), length(p - c - r * vec2(cos(a1), sin(a1))));
}
float vsFace(vec2 uv) {
  vec2 p = vec2(uv.x - 0.5, 0.5 - uv.y);
  float d = 1e3;
  if (vsExpr == 1) {
    d = min(d, vsArc(p, vec2(-0.19, 0.03), 0.075, 0.45, 2.69));
    d = min(d, vsArc(p, vec2(0.19, 0.03), 0.075, 0.45, 2.69));
    d = min(d, vsArc(p, vec2(0.0, -0.05), 0.16, -2.45, -0.69));
  } else if (vsExpr == 2) {
    d = min(d, vsSeg(p, vec2(-0.27, 0.06), vec2(-0.12, 0.06)));
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7853982 + vsTime * 3.0;
      d = min(d, length(p - vec2(0.19, 0.06) - 0.072 * vec2(cos(a), sin(a))) - (0.006 + 0.011 * float(i) / 7.0));
    }
    d = min(d, vsArc(p, vec2(0.0, -0.25), 0.075, 0.75, 2.39));
  } else if (vsExpr == 3) {
    d = min(d, length(p - vec2(-0.19, 0.06)) - 0.052);
    d = min(d, length(p - vec2(0.19, 0.06)) - 0.052);
    d = min(d, abs(length(p - vec2(0.0, -0.17)) - 0.042));
  } else {
    float b = fract(vsTime / 4.3); b = 1.0 - smoothstep(0.0, 0.025, b) * (1.0 - smoothstep(0.035, 0.06, b));
    float e = 0.045 * b;
    d = min(d, vsSeg(p, vec2(-0.19, 0.06 - e), vec2(-0.19, 0.06 + e)) - 0.012);
    d = min(d, vsSeg(p, vec2(0.19, 0.06 - e), vec2(0.19, 0.06 + e)) - 0.012);
    d = min(d, vsSeg(p, vec2(-0.08, -0.16), vec2(0.08, -0.16)));
  }
  float w = 0.017;
  return (1.0 - smoothstep(w * 0.55, w, d)) + 0.22 * exp(-max(d - w, 0.0) * 34.0);
}
`;
function visorMaterial(src) {
  const m = new THREE.MeshStandardMaterial({ name: 'visor', color: 0x05070a, roughness: 0.14, metalness: 0.0, envMapIntensity: 1.3 });
  const u = m.userData.visor = { vsExpr: { value: 0 }, vsTime: { value: 0 }, vsGlow: { value: 1.5 }, vsCol: { value: new THREE.Color(0x35f2e4) } };
  m.defines = { USE_UV: '' };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = VISOR_GLSL + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += vsCol * vsGlow * vsFace(vUv);`);
  };
  m.customProgramCacheKey = () => 'crew-visor-1';
  if (src && src.dispose) src.dispose();
  return m;
}

function setColours(mats, { job, uniform, skin, hair } = {}) {
  for (const m of mats) {
    const u = m.userData.crew; if (!u) continue;
    // (a suit that keeps its own colours takes no job's: its marks, lines and panels as made)
    const J = (!m.userData.crewOwnColours && JOBS[job]) || JOBS.explorer;
    for (const k of ['marks', 'lines', 'panels']) { const key = 'cr' + k[0].toUpperCase() + k.slice(1); u[key].value.copy(J[k] ? lin(J[k]) : u[key + 'Ref'].value); }
    u.crWhites.value.copy(uniform ? lin(uniform) : u.crWhitesRef.value);
    u.crSkin.value.copy(skin ? lin(skin) : u.crSkinRef.value);
    u.crHair.value.copy(hair ? lin(hair) : u.crHairRef.value);
  }
}

// ── a hair's fit ────────────────────────────────────────────────────────────────────────────────────────────────────
// Every hair is shaped on the standard skull, so one fit serves it on every head. In crew.json, a hair entry's `fit`:
//   offset [x, y, z]  metres, in the head's frame (y up, z forward, x to their left), after the size
//   scale             the size, about the standard skull's centre (1: as made)
//   tuck              0..1: how much of the gap between the hair and the head its lower parts close, each point drawn in
//                     level toward the skull's upright axis. Nothing at tuckStart below the hair's top, growing to all of
//                     it at the hair's bottom edge (long hair: at the jaw line, fading out over 4 cm below it, so tails
//                     and long ends keep hanging as made). The head it's measured on is the head it's on, and no point
//                     comes nearer to it than 4 mm (the attachment rule: HAIR_CLEAR). Cards and shell move by the same
//                     rule, so their layers keep their order.
//   tuckStart         metres below the hair's top where the tuck begins (0: the crown)
//   heads             { <head id>: { offset, scale, tuck, tuckStart } }: one head's own adjustments, each ADDED to the
//                     hair's own (offsets and tucks added, scales multiplied); a field left out adds nothing
// The head's frame is the Head bone's own: every crew skeleton's Head bone is unturned at rest, so its frame is the
// game's (y up, z forward, metres) from the Head joint, on every suit, and the fit rides the head through every clip.
export const SKULL = [0, 0.106, -0.012];      // the standard skull's centre from the Head joint (the attachment rules)
export const HAIR_CLEAR = 0.004;              // hair stays this far off the head (metres)
// (the head's frame: where long hair's tuck is full, and how far below it it fades)
const TUCK_JAW = -0.025, TUCK_FADE = 0.04;
// the fit a hair wears on a head: its own fit with that head's adjustments added (any field left out: as made)
export function fitFor(f, head) {
  f = f || {}; const d = (f.heads && head && f.heads[head]) || {};
  const o = f.offset || [], p = d.offset || [];
  return { offset: [0, 1, 2].map((i) => (+o[i] || 0) + (+p[i] || 0)), scale: (f.scale == null ? 1 : +f.scale) * (d.scale == null ? 1 : +d.scale),
    tuck: Math.min(1, Math.max(0, (+f.tuck || 0) + (+d.tuck || 0))), tuckStart: Math.max(0, (+f.tuckStart || 0) + (+d.tuckStart || 0)) };
}
const asMade = (f) => !f || (!f.offset.some((v) => Math.abs(v) > 1e-7) && Math.abs(f.scale - 1) < 1e-7 && !(f.tuck > 0));
// a part's bind space -> the head's frame (its Head bone's own)
function frameOf(mesh) {
  const i = mesh.skeleton.bones.findIndex((b) => b.name === 'Head');
  return new THREE.Matrix4().multiplyMatrices(mesh.skeleton.boneInverses[i], mesh.bindMatrix);
}
// THE HEAD FIELD: the head's outline round the skull's upright axis (through SKULL), as the farthest the head reaches
// out from that axis at each height (2 mm bands) and each way round (2 degree steps), from points spread over its
// triangles 1.2 mm apart. Below the Head joint, and below the neck's cut wherever that is higher, it's never narrower
// than above: hair is never drawn in under the jaw, or under the neck's cut into the column where only the plug inside
// the collar is (the cut is the head's open edge, its vertices joined where they meet; on some heads it rises well above
// the Head joint behind the neck). D is that widened by 6 mm up and down and 6 degrees either way (a point at least 4 mm
// outside D is at least 4 mm off the head); S is D smoothed (the gap the tuck closes, so it bends the hair smoothly).
const HF = { y0: -0.2, dy: 0.002, ny: 260, nt: 180 };
const binT = (dx, dz) => ((Math.floor((Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI) * HF.nt) % HF.nt) + HF.nt) % HF.nt;
function headField(g) {
  const { ny, nt } = HF, R = new Float32Array(ny * nt), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const put = (x, y, z) => {
    const yb = Math.floor((y - HF.y0) / HF.dy); if (yb < 0 || yb >= ny) return;
    const dx = x - SKULL[0], dz = z - SKULL[2], r = Math.hypot(dx, dz), k = yb * nt + binT(dx, dz);
    if (r > R[k]) R[k] = r;
  };
  // (the vertices joined where they meet, 0.05 mm apart or less, so the open edges are the head's own, not its texture's
  // seams; an edge is open when one triangle alone has it)
  const joined = new Map(), edges = new Map(), at = [];
  const join = (x, y, z) => { const k = Math.round(x * 2e4) + ',' + Math.round(y * 2e4) + ',' + Math.round(z * 2e4); let i = joined.get(k); if (i == null) { i = at.length; joined.set(k, i); at.push([x, y, z]); } return i; };
  g.scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const M = frameOf(o), pos = o.geometry.attributes.position, idx = o.geometry.index, P = new Float32Array(pos.count * 3), J = new Int32Array(pos.count);
    for (let i = 0; i < pos.count; i++) { a.fromBufferAttribute(pos, i).applyMatrix4(M).toArray(P, i * 3); J[i] = join(a.x, a.y, a.z); }
    const n = idx ? idx.count : pos.count;
    for (let t = 0; t + 2 < n; t += 3) {
      const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
      for (const [p, q] of [[J[i0], J[i1]], [J[i1], J[i2]], [J[i2], J[i0]]]) { const e = p < q ? p * 1e7 + q : q * 1e7 + p; edges.set(e, (edges.get(e) || 0) + 1); }
      a.fromArray(P, i0 * 3); b.fromArray(P, i1 * 3); c.fromArray(P, i2 * 3);
      const s = Math.min(64, Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / 0.0012)));
      for (let u = 0; u <= s; u++) for (let v = 0; v <= s - u; v++) {
        const fu = u / s, fv = v / s, fw = 1 - fu - fv;
        put(a.x * fw + b.x * fu + c.x * fv, a.y * fw + b.y * fu + c.y * fv, a.z * fw + b.z * fu + c.z * fv);
      }
    }
  });
  // (the neck's cut: the highest open edge each way round, below the skull's middle; widened 6 degrees either way)
  const cut = new Float32Array(nt).fill(-Infinity);
  for (const [e, k] of edges) {
    if (k !== 1) continue;
    const p = at[Math.floor(e / 1e7)], q = at[e % 1e7];
    if (Math.max(p[1], q[1]) > SKULL[1] - 0.05) continue;
    const s = Math.max(1, Math.ceil(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) / 0.001));
    for (let i = 0; i <= s; i++) {
      const f = i / s, x = p[0] + (q[0] - p[0]) * f, y = p[1] + (q[1] - p[1]) * f, z = p[2] + (q[2] - p[2]) * f, t = binT(x - SKULL[0], z - SKULL[2]);
      if (y > cut[t]) cut[t] = y;
    }
  }
  const cutW = cut.map((_, t) => { let m = -Infinity; for (let e = -3; e <= 3; e++) m = Math.max(m, cut[(((t + e) % nt) + nt) % nt]); return m; });
  // (carried down from the Head joint, or from 4 mm above the cut where that's higher)
  for (let t = 0; t < nt; t++) {
    const from = Math.min(ny - 1, Math.floor((Math.max(0, cutW[t] + 0.004) - HF.y0) / HF.dy));
    for (let yb = from - 1; yb >= 0; yb--) R[yb * nt + t] = Math.max(R[yb * nt + t], R[(yb + 1) * nt + t]);
  }
  const D = filterField(filterField(R, 3, 0, Math.max), 0, 3, Math.max);
  const S = filterField(filterField(D, 4, 0, null), 0, 4, null);
  return { D, S };
}
// (a field filtered over +-k bands of height and +-j steps round: the largest, or the mean when fn is null)
function filterField(F, k, j, fn) {
  const { ny, nt } = HF, out = new Float32Array(F.length);
  for (let y = 0; y < ny; y++) for (let t = 0; t < nt; t++) {
    let m = 0, n = 0;
    for (let d = -k; d <= k; d++) {
      const yy = y + d; if (yy < 0 || yy >= ny) { if (!fn) n++; continue; }
      for (let e = -j; e <= j; e++) { const v = F[yy * nt + (((t + e) % nt) + nt) % nt]; if (fn) { if (v > m) m = v; } else { m += v; n++; } }
    }
    out[y * nt + t] = fn ? m : m / n;
  }
  return out;
}
// (the field at a point: the nearest band and step, or blended between the four round it)
function fieldAt(F, y, dx, dz, blend) {
  const { ny, nt } = HF, fy = (y - HF.y0) / HF.dy - 0.5, ft = (Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI) * nt - 0.5;
  const at = (yy, tt) => (yy < 0 || yy >= ny ? 0 : F[yy * nt + (((tt % nt) + nt) % nt)]);
  if (!blend) return at(Math.round(fy), Math.round(ft));
  const y0 = Math.floor(fy), t0 = Math.floor(ft), wy = fy - y0, wt = ft - t0;
  return (at(y0, t0) * (1 - wt) + at(y0, t0 + 1) * wt) * (1 - wy) + (at(y0 + 1, t0) * (1 - wt) + at(y0 + 1, t0 + 1) * wt) * wy;
}
const smooth01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// (an attribute's values as plain floats; a part's own, kept on its geometry once read)
function floatsOf(a) {
  const n = a.count, k = a.itemSize, out = new Float32Array(n * k), get = [a.getX, a.getY, a.getZ, a.getW];
  for (let j = 0; j < k; j++) { const g = get[j]; for (let i = 0; i < n; i++) out[i * k + j] = g.call(a, i); }
  return out;
}
function partFloats(src, k) {
  const c = src.userData.fitFloats || (src.userData.fitFloats = {});
  if (!c[k]) c[k] = k === 'n0' ? normalsOf(partFloats(src, 'position'), src.index, src.attributes.position.count) : floatsOf(src.attributes[k]);
  return c[k];
}
// (area-weighted vertex normals of positions P on the triangles of index I)
function normalsOf(P, I, n) {
  const N = new Float32Array(n * 3), m = I ? I.count : n;
  for (let t = 0; t + 2 < m; t += 3) {
    const i = (I ? I.getX(t) : t) * 3, j = (I ? I.getX(t + 1) : t + 1) * 3, k = (I ? I.getX(t + 2) : t + 2) * 3;
    const ux = P[j] - P[i], uy = P[j + 1] - P[i + 1], uz = P[j + 2] - P[i + 2], vx = P[k] - P[i], vy = P[k + 1] - P[i + 1], vz = P[k + 2] - P[i + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    for (const q of [i, j, k]) { N[q] += cx; N[q + 1] += cy; N[q + 2] += cz; }
  }
  return N;
}
// A hair's own geometry for a fit: its positions, normals and strand directions its own, the rest (index, uv, skin
// weights, colours) shared with the part's. Its normals turn as the tuck turns the surface under them (the turn from
// the part's surface to the tucked one, at each point), so the card hair's outward-bent normals and the Mathwood hair's
// smooth or flat shading stay as made, and its strand directions turn with them.
const OWN = ['position', 'normal', '_strand'];
function ownGeometry(src) {
  const g = new THREE.BufferGeometry(); g.name = (src.name || 'hair') + ' (fit)';
  g.setIndex(src.index);
  for (const [k, a] of Object.entries(src.attributes)) g.setAttribute(k, OWN.includes(k) ? new THREE.BufferAttribute(floatsOf(a), a.itemSize) : a);
  for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  g.userData.fitShared = Object.keys(src.attributes).filter((k) => !OWN.includes(k));
  return g;
}
// (only its own buffers freed: the part's shared ones stay for every other person wearing it)
function disposeOwn(g) { g.setIndex(null); for (const k of g.userData.fitShared || []) g.deleteAttribute(k); g.dispose(); }
const _q = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _v = new THREE.Vector3();
function applyFit(dst, src, M, fit, field) {
  const pos = src.attributes.position, n = pos.count, s = fit.scale, o = fit.offset, F = new Float32Array(n * 3);
  let top = -Infinity, bot = Infinity;
  for (let i = 0; i < n; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(M);
    F[i * 3] = SKULL[0] + (_v.x - SKULL[0]) * s + o[0]; F[i * 3 + 1] = SKULL[1] + (_v.y - SKULL[1]) * s + o[1]; F[i * 3 + 2] = SKULL[2] + (_v.z - SKULL[2]) * s + o[2];
    top = Math.max(top, F[i * 3 + 1]); bot = Math.min(bot, F[i * 3 + 1]);
  }
  const stats = { tucked: 0, held: 0 };
  if (fit.tuck > 0 && field) {
    const full = Math.max(bot, TUCK_JAW), start = Math.max(top - fit.tuckStart, full + 0.01);
    for (let i = 0; i < n; i++) {
      const y = F[i * 3 + 1];
      let w = smooth01((start - y) / (start - full));
      if (y < full) w *= 1 - smooth01((full - y) / TUCK_FADE);
      if (w <= 0) continue;
      const dx = F[i * 3] - SKULL[0], dz = F[i * 3 + 2] - SKULL[2], r = Math.hypot(dx, dz);
      if (r < 1e-4) continue;
      const gap = r - fieldAt(field.S, y, dx, dz, true) - HAIR_CLEAR;
      if (gap <= 0) continue;
      const want = r - fit.tuck * w * gap, least = fieldAt(field.D, y, dx, dz, false) + HAIR_CLEAR, r2 = Math.max(want, least);
      if (r2 >= r) continue;
      const k = r2 / r; F[i * 3] = SKULL[0] + dx * k; F[i * 3 + 2] = SKULL[2] + dz * k;
      stats.tucked++; if (least > want) stats.held++;
    }
  }
  const Mi = M.clone().invert(), P = dst.attributes.position.array;
  for (let i = 0; i < n; i++) _v.fromArray(F, i * 3).applyMatrix4(Mi).toArray(P, i * 3);
  dst.attributes.position.needsUpdate = true;
  // the normals and strands: as made, turned where the tuck turned the surface
  const turn = [];
  for (const k of ['normal', '_strand']) {
    const A = dst.attributes[k]; if (!A) continue;
    A.array.set(partFloats(src, k)); A.needsUpdate = true;
    if (A.itemSize === 3) turn.push(A);
  }
  if (stats.tucked && turn.length) {
    const N0 = partFloats(src, 'n0'), N1 = normalsOf(P, src.index, n);
    for (let i = 0; i < n; i++) {
      _a.fromArray(N0, i * 3); _b.fromArray(N1, i * 3);
      if (_a.lengthSq() < 1e-20 || _b.lengthSq() < 1e-20) continue;
      _q.setFromUnitVectors(_a.normalize(), _b.normalize());
      for (const A of turn) { _v.fromArray(A.array, i * 3).applyQuaternion(_q).toArray(A.array, i * 3); }
    }
  }
  dst.boundingBox = null; dst.boundingSphere = null;
  return stats;
}

// ── a person, put together from a recipe ────────────────────────────────────────────────────────────────────────────
// the parts' skinned meshes bound to one skeleton (the suit's): a template a Person is cloned from
function assemble(suit, others) {
  const tpl = suit.scene.clone(true);   // (a plain clone first: its skinned meshes still point at the suit's own bones)
  const bones = {}; tpl.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const meshes = [];
  tpl.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  // (the suit's own mesh re-bound to the template's bones)
  let host = null;
  for (const m of meshes) {
    m.bind(new THREE.Skeleton(m.skeleton.bones.map((b) => bones[b.name]), m.skeleton.boneInverses), m.bindMatrix);
    m.userData.part = 'suit'; host = m.parent;
  }
  for (const [kind, g] of others) {
    g.scene.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const m = new THREE.SkinnedMesh(o.geometry, o.material); m.name = o.name; m.userData.part = kind;
      m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale);
      host.add(m);
      m.bind(new THREE.Skeleton(o.skeleton.bones.map((b) => bones[b.name]), o.skeleton.boneInverses), o.bindMatrix);
    });
  }
  return tpl;
}

export async function makeCrew(lib, recipe) {
  const R = { suit: recipe.suit, head: recipe.head, hair: recipe.hair };
  const cards = !!(R.hair && (lib.entry('hair', R.hair) || {}).cards);
  const [suit, head, hair, fit, atlas] = await Promise.all([...['suit', 'head', 'hair'].map((k) => (R[k] ? lib.part(k, R[k]) : null)), lib.clipsFor(R.suit),
    cards ? lib.hairAtlas() : null]);
  const tpl = assemble(suit, [['head', head], ['hair', hair]].filter((x) => x[1]));
  const refsOf = { suit: suit && suit.scene.userData.crewPart, head: head && head.scene.userData.crewPart, hair: hair && hair.scene.userData.crewPart };
  // a Person of the Mathwood world, from the template (its clone, mixer, fades and bone keeping), on the suit's skeleton
  const person = new Person({ clips: { [fit.body]: fit.clips } }, { scene: tpl, body: fit.body }, { shadows: true });
  const meshes = {}, mats = [];
  const made = person.mesh.material;            // (the Mathwood vertex-colour material it made: not ours)
  // (the template's own materials, in the same order as the clone's meshes: a head with a visor has two)
  const src = []; tpl.traverse((t) => { if (t.isSkinnedMesh) src.push(t.material); });
  let i = 0, visor = null;
  const hairMeshes = [];
  person.root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const kind = o.userData.part || 'suit', own = o.material === made ? src[i] : o.material; i++;
    if (kind === 'hair') hairMeshes.push(o);
    if (own && own.name === 'visor') { o.material = visor = visorMaterial(); meshes.visor = o; }
    else if (kind === 'hair' && atlas) {
      const mat = hairCardMaterial(refsOf.hair || {}, atlas); o.material = mat; mats.push(mat); meshes.hair = o;
      o.customDepthMaterial = hairDepthMaterial(atlas); mats.push(o.customDepthMaterial);
    } else { const mat = crewMaterial(own, kind, refsOf[kind]); o.material = mat; mats.push(mat); meshes[kind] = o; }
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
  });
  made.dispose();
  const bones = {}; person.root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  // the shins' lengths, for the foot rule (the rest pose: the foot's root on the shin's line)
  person.root.updateMatrixWorld(true);
  const shin = {}; for (const s of ['L', 'R']) shin[s] = bones['LowerLeg' + s].getWorldPosition(new THREE.Vector3()).distanceTo(bones['Foot' + s].getWorldPosition(new THREE.Vector3()));
  const A = new THREE.Vector3(), Y = new THREE.Vector3(), M = new THREE.Matrix4();
  const c = {
    root: person.root, person, meshes, bones, recipe: { ...recipe }, stride: fit.stride, body: fit.body, rig: fit.rig,
    play: (name, o = {}) => person.play(name, { once: ONCE.has(name), ...o }),
    update(dt) {
      person.update(dt);
      // each foot at its shin's end (see the top)
      person.root.updateMatrixWorld(true);
      for (const s of ['L', 'R']) {
        const sh = bones['LowerLeg' + s], f = bones['Foot' + s];
        sh.getWorldPosition(A); Y.setFromMatrixColumn(sh.matrixWorld, 1).normalize();
        A.addScaledVector(Y, shin[s] * sh.matrixWorld.elements.slice(4, 7).reduce((q, v) => q + v * v, 0) ** 0.5);
        f.position.copy(f.parent.worldToLocal(A));
      }
      person.root.updateMatrixWorld(true);
      if (visor) visor.userData.visor.vsTime.value += dt;
    },
    setColours(col) { c.recipe.colours = { ...(c.recipe.colours || {}), ...col }; setColours(mats, c.recipe.colours); },
    expression: null,
    setExpression(name) {
      const k = Object.keys(EXPRESSIONS).indexOf(name);
      c.expression = k >= 0 ? name : 'neutral'; c.recipe.expression = c.expression;
      if (visor) visor.userData.visor.vsExpr.value = Math.max(0, k);
    },
    // the hair's fit (a hair's fit, above): each hair mesh gets its own positions while it wears one
    fit: null, fitStats: { tucked: 0, held: 0 },
    async setFit(fit) {
      const f = fit ? fitFor(fit) : null, plain = asMade(f);
      const field = !plain && f.tuck > 0 && R.head ? await lib.headField(R.head) : null;
      const stats = { tucked: 0, held: 0 };
      for (const [m, g0, M] of hairFit) {
        if (plain) { if (m.geometry !== g0) { disposeOwn(m.geometry); m.geometry = g0; } continue; }
        if (m.geometry === g0) m.geometry = ownGeometry(g0);
        const s = applyFit(m.geometry, g0, M, f, field); stats.tucked += s.tucked; stats.held += s.held;
      }
      c.fit = plain ? null : f; c.fitStats = stats;
      return stats;
    },
    dispose() {
      for (const m of mats) m.dispose(); if (visor) visor.dispose();
      for (const [m, g0] of hairFit) if (m.geometry !== g0) { disposeOwn(m.geometry); m.geometry = g0; }
      person.mixer.stopAllAction(); person.root.removeFromParent();
    },
  };
  // (each hair mesh, the part's own geometry it shares, and its bind space -> the head's frame)
  const hairFit = hairMeshes.map((m) => [m, m.geometry, frameOf(m)]);
  c.setColours(recipe.colours || {});
  c.setExpression(recipe.expression || 'neutral');
  await c.setFit(lib.fitOf(R.hair, R.head));
  return c;
}
