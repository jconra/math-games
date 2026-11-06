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
// COLOURS without new textures: each part's material is patched so its marked areas take a colour (the masks ride in
// the textures' spare channels, written by the rig's post step):
//   suit   the amber marks (the metal-roughness texture's red), the teal light lines (the colour texture's alpha; they
//          glow) and the dark panels (the normal map's alpha), by JOBS
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
//   const lib = await loadCrew()                lib.list: crew.json; lib.part(kind, id) -> its glTF; lib.clipsFor(suit id)
//                                               -> { body, rig, clips (fitted to that suit), stride }
//   const c = await makeCrew(lib, recipe)       recipe { suit, head, hair, colours: { job, skin, hair } }
//     c.root (place and turn it: feet on y 0, facing +z), c.person (Mathwood's Person), c.play(name, { fade, speed, once }),
//     c.update(dt), c.setColours({ job, skin, hair }), c.meshes { suit, head, hair, visor }, c.bones, c.body ('m' | 'f':
//     the suit's skeleton, whose clips it plays), c.stride (m/s at speed 1: { Walk, Run }), c.dispose(),
//     c.setExpression(name) (a visor's face; recipe.expression sets the first), c.expression
//   JOBS, SKIN_TONES, HAIR_COLOURS, CLIPS, EXPRESSIONS
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
export const SKIN_TONES = ['#f2d3bd', '#e8bf9f', '#d9a37f', '#c48a62', '#a66d45', '#86522f', '#663b22', '#47291a'];
export const HAIR_COLOURS = ['#17110d', '#2e1f15', '#4a2f1d', '#6b4127', '#8f5a32', '#b4824f', '#d8bc84', '#a83c22', '#8f8a84', '#d6d3cc'];

// a visor's faces (kit/crew.js visorMaterial), in the order its shader numbers them
export const EXPRESSIONS = { neutral: 'Neutral', happy: 'Happy', thinking: 'Thinking', surprised: 'Surprised' };

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const clean = (n) => THREE.PropertyBinding.sanitizeNodeName(n);
const lin = (s) => new THREE.Color(s);          // (sRGB string -> three's linear working colour)

// ── loading ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function loadCrew({ dir = CREW_DIR, people = PEOPLE_DIR } = {}) {
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
  lib.part = (kind, id) => {
    const key = kind + ':' + id;
    if (!parts.has(key)) {
      const P = lib.entry(kind, id);
      if (!P) return Promise.reject(new Error(`crew: no ${kind} "${id}" in crew.json`));
      parts.set(key, loader.loadAsync(dir + P.file));
    }
    return parts.get(key);
  };
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
function crewMaterial(src, kind, part) {
  const m = src.clone(), refs = part && part.refs;
  const R = (n, d) => (refs && refs[n] ? new THREE.Color().fromArray(refs[n]) : new THREE.Color(d));
  const u = m.userData.crew = {
    crMarks: { value: R('marks', 0xe0a020) }, crMarksRef: { value: R('marks', 0xe0a020) },
    crLines: { value: R('lines', 0x20c0c0) }, crLinesRef: { value: R('lines', 0x20c0c0) },
    crPanels: { value: R('panels', 0x202020) }, crPanelsRef: { value: R('panels', 0x202020) },
    crSkin: { value: R('skin', 0xc08060) }, crSkinRef: { value: R('skin', 0xc08060) },
    crHair: { value: R('hair', 0x402010) }, crHairRef: { value: R('hair', 0x402010) },
    crGlow: { value: refs && refs.glow != null ? refs.glow : 0.0 },
  };
  const has = part && part.masks ? part.masks : {};
  // (skin and hair: no sheen of the room's reflections; the painted face carries its own light and shade)
  if (kind !== 'suit') { m.roughness = Math.max(m.roughness, 0.78); m.envMapIntensity = 0.55; }
  // (the suit's generated normal map is busy, ripples where the plates are smooth: half strength)
  else if (m.normalMap) m.normalScale.set(0.5, 0.5);
  m.defines = { ...(m.defines || {}), [KIND_DEF[kind]]: '' };
  if (has.marks) m.defines.CREW_MARKS = ''; if (has.lines) m.defines.CREW_LINES = ''; if (has.panels) m.defines.CREW_PANELS = ''; if (has.skin) m.defines.CREW_SKIN = '';
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = `uniform vec3 crMarks, crMarksRef, crLines, crLinesRef, crPanels, crPanelsRef, crSkin, crSkinRef, crHair, crHairRef; uniform float crGlow;
float crLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// (a mask kept in an alpha channel between 4 and 255: lossy WebP drops the colour under a fully clear pixel)
float crA(float a) { return clamp((a * 255.0 - 4.0) / 251.0, 0.0, 1.0); }
// (a colour laid on as a shift from the part's own, scaled by how light this texel is against it)
vec3 crShift(vec3 c, vec3 to, vec3 ref, float m) { return max(c + (to - ref) * min(crLum(c) / max(crLum(ref), 1e-4), 2.5) * m, 0.0); }
` + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
  float crLineMask = 0.0;
#ifdef USE_MAP
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

function setColours(mats, { job, skin, hair } = {}) {
  const J = JOBS[job] || JOBS.explorer;
  for (const m of mats) {
    const u = m.userData.crew; if (!u) continue;
    for (const k of ['marks', 'lines', 'panels']) { const key = 'cr' + k[0].toUpperCase() + k.slice(1); u[key].value.copy(J[k] ? lin(J[k]) : u[key + 'Ref'].value); }
    u.crSkin.value.copy(skin ? lin(skin) : u.crSkinRef.value);
    u.crHair.value.copy(hair ? lin(hair) : u.crHairRef.value);
  }
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
  const [suit, head, hair, fit] = await Promise.all([...['suit', 'head', 'hair'].map((k) => (R[k] ? lib.part(k, R[k]) : null)), lib.clipsFor(R.suit)]);
  const tpl = assemble(suit, [['head', head], ['hair', hair]].filter((x) => x[1]));
  const refsOf = { suit: suit && suit.scene.userData.crewPart, head: head && head.scene.userData.crewPart, hair: hair && hair.scene.userData.crewPart };
  // a Person of the Mathwood world, from the template (its clone, mixer, fades and bone keeping), on the suit's skeleton
  const person = new Person({ clips: { [fit.body]: fit.clips } }, { scene: tpl, body: fit.body }, { shadows: true });
  const meshes = {}, mats = [];
  const made = person.mesh.material;            // (the Mathwood vertex-colour material it made: not ours)
  // (the template's own materials, in the same order as the clone's meshes: a head with a visor has two)
  const src = []; tpl.traverse((t) => { if (t.isSkinnedMesh) src.push(t.material); });
  let i = 0, visor = null;
  person.root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const kind = o.userData.part || 'suit', own = o.material === made ? src[i] : o.material; i++;
    if (own && own.name === 'visor') { o.material = visor = visorMaterial(); meshes.visor = o; }
    else { const mat = crewMaterial(own, kind, refsOf[kind]); o.material = mat; mats.push(mat); meshes[kind] = o; }
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
    dispose() { for (const m of mats) m.dispose(); if (visor) visor.dispose(); person.mixer.stopAllAction(); person.root.removeFromParent(); },
  };
  c.setColours(recipe.colours || {});
  c.setExpression(recipe.expression || 'neutral');
  return c;
}
