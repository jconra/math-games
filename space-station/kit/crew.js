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
// rules, ~/pw/space-math/characters/CHARACTERS.md): a head is skinned to the Neck and Head bones and its neck runs
// down inside the collar (a Tripo head's neck is its own, as made, down to where its model ends: never cut or
// lengthened; bound by height, it blends from the Neck bone to the Chest bone below the Neck joint), and the part of it
// hidden inside the collar is drawn in clear of the cloth (THE COLLAR FIT, below); hair is skinned to the Head bone only
// and sits on the standard skull.
//
// THE COLLAR FIT (2026-11-07): when a person is put together, the suit's collar is measured from the suit itself (its
// rim, its centre and its inner wall all the way round, down the inside) and the head's neck points that sit below the
// rim, hidden in the collar, are drawn in toward its centre to stay COLLAR_CLEAR inside the wall; the neck above the rim,
// what shows, never moves. c.collarStats says how far (see "the collar fit", below).
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
// PAINT HAIR (crew.json `paint`: the buzz cut): no mesh, a stubble layer in the head's own material (PAINTS).
//
// A HAIR'S FIT (crew.json: a hair entry's optional `fit`, made with the Crew Lab's Fit row; see "a hair's fit" below):
// nudged, sized, tucked (drawn in toward the head's centre, thickness kept, down to 2 mm off the head it's on), on every
// head or one head's own way. Applied to the person's own copy of the hair's positions when it's put together, so the
// game and the lab show the same.
//
// REAL EYES (the Tripo heads, ~/pw/space-math/rigs/crew-heads/): a ball and a clear wet layer on each of the head's eye
// bones (EyeL, EyeR, under its Head bone); the lids rest on the balls. The gaze looks at a point or straight ahead, with
// small darting movements, jumping and settling as eyes do (THE GAZE, below). A part's own bones (bones the suit's
// skeleton lacks, all under the Head bone) are added to the person's skeleton when it's put together. A head without
// eyes (the Meshy heads, crew 1's, the captain's, Vega's helmet) is as it was.
//
// FACE BONES (the Tripo heads): small bones under the Head bone (Jaw, Chin, Cheek.L/R, Nose, Bridge, Brow, EyeSocket.L/R,
// Ear.L/R) with smooth weights over the face, each moved or sized from its rest by the sliders in FACE, -1 to 1, kept to
// a believable range so the skin's texture doesn't smear. A recipe's `face` { slider: value } sets them. They ride the
// Head bone, so the clips carry them, and they leave the scalp alone, so the hair's fit is as it was. The eye sockets
// carry the eye bones with them (spacing and size), so the lids stay on the balls.
//
// HANDS (2026-11-07; ~/pw/space-math/rigs/crew-rig/hands.py): a suit is clothing only, open at its cuffs, and the hands
// are their own part (crew.json parts.hand: both hands in one mesh, skinned to the forearm, wrist and finger bones, with
// a skin mask so the skin tone tints them). A suit wears its skeleton's hands (the entry with that `skeleton`) unless
// the recipe names one (`hand`: an id, or null for none); a suit made with hands of its own (crew.json `ownHands`)
// wears none unless named. The hand is laid on the suit's own wrists (HANDS, below): its stub runs back inside the
// cuff, and stub and cuff fade from the forearm to the wrist by the same rule, so they move together in every clip.
//
//   const lib = await loadCrew()                lib.list: crew.json; lib.part(kind, id) -> its glTF; lib.clipsFor(suit id)
//                                               -> { body, rig, clips (fitted to that suit), stride }; lib.hairAtlas();
//                                               lib.fitOf(hair id, head id) -> the fit makeCrew gives that hair on that
//                                               head; lib.fits { hair id: fit } (empty: a layer over crew.json's, each
//                                               entry replacing that hair's whole fit; the Crew Lab's while it's edited)
//                                               lib.handFor(suit id) -> the hand part a suit wears unless a recipe names one
//   const c = await makeCrew(lib, recipe)       recipe { suit, head, hair, hand, colours: { job, uniform, skin, hair, eyes } }
//     c.root (place and turn it: feet on y 0, facing +z), c.person (Mathwood's Person), c.play(name, { fade, speed, once }),
//     c.update(dt), c.setColours({ job, uniform, skin, hair, eyes }), c.meshes { suit, head, hair, hand, visor, eyes, cornea },
//     c.bones, c.lookAt(point | null, { dart }) (real eyes: where they look; null straight ahead), c.gaze (null without),
//     c.setFace({ slider: -1..1 }) (face bones: FACE's sliders; recipe.face sets the first), c.faceSliders (the sliders this
//     head has: [] without), c.body ('m' | 'f':
//     the suit's skeleton, whose clips it plays), c.stride (m/s at speed 1: { Walk, Run }), c.dispose(),
//     c.setExpression(name) (a visor's face; recipe.expression sets the first), c.expression,
//     await c.setFit(fit) (the hair's fit, live: { offset, scale, tuck, tuckStart } as lib.fitOf gives; null: as made),
//     c.fit (the fit it wears), c.fitStats ({ tucked: points the tuck moved, held: of those, how many it stopped 2 mm off
//     the head }), c.paint (paint hair's name, or null), c.collarStats (the collar fit: { moved: points, mostMm, meanMm:
//     how far they came in, pastMm: how far the hidden neck reached past the collar's outside, wideMm: how much wider
//     than the collar's top the neck is, wideAt: where (degrees round, 0 ahead, 90 its left), coverMm: how far down a
//     wide neck covers the collar, deep: points left because the wall was deeper inside the neck than COLLAR.deep, rides:
//     points riding with the cloth, applied: whether the fit is on },
//     or null without one), c.collar (the suit's collar as measured), c.collarDepth (each
//     head point's depth below where the fit starts, metres; minus above it), c.collarMoved (how far each came in, mm)
//   lib.collarFit (true: the collar fit on; false: off, the heads as made, its numbers still measured: collarStats
//   .applied false); lib.collarOf(suit id, template) -> the collar
//   JOBS, UNIFORM_COLOURS, SKIN_TONES, HAIR_COLOURS, EYE_COLOURS, FACE, CLIPS, EXPRESSIONS, PAINTS, fitFor, SKULL,
//   HAIR_CLEAR, TUCK_CLEAR, TUCK_MAX, COLLAR_CLEAR, COLLAR_BAND
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
  // how far a head reaches along every line from the skull's centre, for the tuck (once a head: THE HEAD'S REACH)
  const fields = new Map();
  lib.headField = (id) => { if (!fields.has(id)) fields.set(id, lib.part('head', id).then(headField)); return fields.get(id); };
  // a suit's collar, for the collar fit (once a suit: THE COLLAR FIT), measured on a person's template at its rest
  const collars = new Map();
  lib.collarFit = true;
  lib.collarOf = (id, tpl) => { if (!collars.has(id)) collars.set(id, collarOf(tpl)); return collars.get(id); };
  // the card hair's one shared strand atlas and its normal map (list.hairAtlas), loaded once for every style
  let atlas = null;
  lib.hairAtlas = () => atlas || (atlas = Promise.all([hairTexture(dir + list.hairAtlas.map, true), hairTexture(dir + list.hairAtlas.normal, false)])
    .then(([map, normalMap]) => ({ map, normalMap })));
  // the clips fitted to one suit (its own bones' lengths: see the top), once a suit; with hands (HANDS), the hand
  // part's own finger joints in place of the suit's (once a suit and hand)
  lib.clipsFor = async (id, hand = null) => {
    const key = id + '|' + (hand || '');
    if (!fitted.has(key)) {
      fitted.set(key, (async () => {
        const g = await lib.part('suit', id), body = lib.entry('suit', id).skeleton || 'm';
        const rig = handRig(g.scene.userData.crewRig, hand ? (await lib.part('hand', hand)).scene.userData.crewRig : null);
        const rest = {}; g.scene.traverse((o) => { if (o.isBone) rest[o.name] = o.quaternion.toArray(); });
        return { body, rig, clips: retargetClips(await lib.rawClips(body), rig, rest), stride: strideOf(rig, body) };
      })());
    }
    return fitted.get(key);
  };
  // the hands a suit wears unless a recipe names some (HANDS): its skeleton's, none if the suit has its own
  lib.handFor = (suit) => {
    const S = lib.entry('suit', suit); if (!S || S.ownHands) return null;
    const H = (list.parts.hand || []).filter((h) => (h.skeleton || 'm') === (S.skeleton || 'm'));
    return (H.find((h) => h.default) || H[0] || {}).id || null;
  };
  return lib;
}

// ── HANDS ────────────────────────────────────────────────────────────────────────────────────────────────────────────
// A hand part carries the full skeleton but deforms only by the forearms, the wrists and the fingers. It is laid on the
// suit's own wrists: each of its bones' bind is taken from the person's skeleton at rest, shifted by how far the suit's
// wrist is from the hand's (each side its own), so at rest the hand stands at the suit's wrist exactly as it was made at
// its own, and every bone moves it from there as it moves the suit. The fingers are the hand's: the joints under each
// wrist (the hand bones) take the hand part's rest places, in the template and in the clips' moves (handRig).
const HAND_BONE = /^(Thumb|Index|Middle|Ring|Pinky)\d\.?[LR]$/;
// (the clips whose hands rest on something (a seat, a wheel, a bar, a hammer): no arms out (ARMS OUT, in makeCrew))
const ARMS_KEEP = /^(Sit_|Stool_|Drive|Bar_Polish|Hammer|Tend_Forge)/;
function handRig(rig, hand) {
  if (!hand) return rig;
  const dst = { ...rig.dstRest };
  for (const [b, v] of Object.entries(hand.dstRest || {})) if (HAND_BONE.test(b)) dst[b] = v;
  return { ...rig, dstRest: dst, hand: true };
}
// (the template's hand bones put at the hand's rest places (rig: the hand part's crewRig); then each of the hand's bones
// bound from the template's rest, shifted by the wrists' difference. Returns the shift, each side)
// (the part's own skin matrices at its rest are kept inside the new ones: a packed file's inverse bind matrices also
// carry its points' unpacking (gltf-transform's quantize folds it in there for a skinned mesh), so they're never
// replaced, only led by the template's bone: new = template bone at rest, inverted x the shift x the part's own bone at
// rest x its own inverse bind)
function layHand(tpl, bones, m, o, rig) {
  if (rig) for (const [b, v] of Object.entries(rig.dstRest || {})) { const B = bones[clean(b)]; if (B && HAND_BONE.test(b)) B.position.fromArray(v); }
  tpl.updateMatrixWorld(true);
  let top = o; while (top.parent) top = top.parent; top.updateMatrixWorld(true);
  const own = o.skeleton.bones.map((b) => b.name), shift = {};
  for (const s of ['L', 'R']) {
    const i = own.indexOf('Wrist' + s); if (i < 0 || !bones['Wrist' + s]) continue;
    shift[s] = bones['Wrist' + s].getWorldPosition(new THREE.Vector3()).sub(o.skeleton.bones[i].getWorldPosition(new THREE.Vector3()));
  }
  const inv = own.map((name, i) => {
    const B = bones[name], s = /[LR]$/.test(name) ? name.slice(-1) : null, d = (s && shift[s]) || new THREE.Vector3();
    return new THREE.Matrix4().copy(B.matrixWorld).invert().multiply(new THREE.Matrix4().makeTranslation(d.x, d.y, d.z))
      .multiply(o.skeleton.bones[i].matrixWorld).multiply(o.skeleton.boneInverses[i]);
  });
  m.bind(new THREE.Skeleton(own.map((n) => bones[n]), inv), o.bindMatrix);
  return shift;
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
const KIND_DEF = { suit: 'CREW_SUIT', head: 'CREW_HEAD', hair: 'CREW_HAIR', hand: 'CREW_HAND' };
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
function crewMaterial(src, kind, part, paint) {
  const m = src.clone(), refs = part && part.refs;
  const u = m.userData.crew = crewUniforms(refs);
  const has = part && part.masks ? part.masks : {};
  // (paint on a head with skin: PAINTS below; paint.over: a hair's own changes to its look, paint.line its own hairline)
  const P = paint && kind === 'head' && has.skin && PAINTS[paint.kind] ? { ...PAINTS[paint.kind], ...(paint.over || {}) } : null;
  if (P) {
    u.crPaintMap = { value: paint.atlas.map }; u.crPaintTile = { value: new THREE.Vector3(...P.tile) };
    u.crPaintLook = { value: new THREE.Vector4(P.mean, P.size, P.cover, P.soft) };
    u.crPaintMore = { value: new THREE.Vector4(P.coarse, P.tone, P.shade, P.wander) };
    u.crLine = { value: lineSamples(paint.line || P.line) };
    u.crHeadFrame = { value: paint.frame };
    if (paint.colour) u.crHairRef.value.copy(lin(paint.colour));
    else if (paint.colourLinear) u.crHairRef.value.fromArray(paint.colourLinear);
    u.crHair.value.copy(u.crHairRef.value);
  }
  // (skin and hair: no sheen of the room's reflections; the painted face carries its own light and shade. A part that
  // gives its own skin roughness (crewPart.rough: the Tripo heads) wears it as it is)
  if (kind !== 'suit') { m.roughness = part && part.rough != null ? part.rough : Math.max(m.roughness, 0.78); m.envMapIntensity = 0.55; }
  // (the suit's generated normal map is busy, ripples where the plates are smooth: half strength)
  else if (m.normalMap) m.normalScale.set(0.5, 0.5);
  m.defines = { ...(m.defines || {}), [KIND_DEF[kind]]: '' };
  // (a suit's own mask texture: in the occlusion slot at strength 0, taken out of it as the masks)
  if (kind === 'suit' && has.tex === 'occlusion' && m.aoMap) { u.crMaskMap = { value: m.aoMap }; m.aoMap = null; m.defines.CREW_MASKTEX = ''; }
  else if (has.marks) m.defines.CREW_MARKS = '';
  if (!('CREW_MASKTEX' in m.defines)) { if (has.lines) m.defines.CREW_LINES = ''; if (has.panels) m.defines.CREW_PANELS = ''; }
  if (has.skin) m.defines.CREW_SKIN = '';
  if (P) { m.defines.CREW_PAINT = ''; m.defines.CR_LINE_N = LINE_N; m.defines.CR_SKULL = `vec3(${SKULL.map((v) => v.toFixed(4)).join(', ')})`; }
  m.userData.crewOwnColours = !!(part && part.jobColours === false);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    if (P) sh.vertexShader = 'uniform mat4 crHeadFrame; varying vec3 vCrHead; varying vec3 vCrHeadN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  vCrHead = (crHeadFrame * vec4(position, 1.0)).xyz; vCrHeadN = mat3(crHeadFrame) * normal;`);
    sh.fragmentShader = `uniform vec3 crMarks, crMarksRef, crLines, crLinesRef, crPanels, crPanelsRef, crWhites, crWhitesRef, crSkin, crSkinRef, crHair, crHairRef; uniform float crGlow;
#ifdef CREW_MASKTEX
uniform sampler2D crMaskMap;
#endif
#ifdef CREW_PAINT
${PAINT_GLSL}
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
  #if (defined(CREW_HEAD) || defined(CREW_HAND)) && defined(CREW_SKIN)
    // (skin by each channel's ratio, not a shift: a darker tone darkens the painted face's own light and shade
    // alike, where a shift would take more red than blue out of the shadows and turn them green; the hands the same)
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * clamp(crSkin / max(crSkinRef, vec3(1e-4)), 0.1, 4.0), crA(sampledDiffuseColor.a));
  #endif
  diffuseColor.a = opacity;
#endif
#ifdef CREW_HAIR
  diffuseColor.rgb = crShift(diffuseColor.rgb, crHair, crHairRef, 1.0);
#endif
#ifdef CREW_PAINT
  diffuseColor.rgb = crPaint(diffuseColor.rgb);
#endif`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
#ifdef CREW_PAINT
  roughnessFactor = mix(roughnessFactor, 0.92, crPaintM);
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
  const refs = part.refs || {}, look = { spec: 1, normal: 0.7, rough: 0.78, env: 0.3, ...(part.look || {}) };
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
  diffuseColor.rgb *= crHair / crMean;
  // (the hair's inside, seen through the shell's open edge from below or at a slant, or a card from beneath: every
  // vertex's normal points out of the hair, so a surface whose normal faces away from the eye is the hair's inner side,
  // shaded dark and given no highlight, never lit as its outside (which showed as pale slivers). By the normals, not
  // the faces' winding, which the cards don't keep one way)
  // (round 3: the shell's own faces are wound outward, so its inside is its back faces; a card's winding isn't kept one
  // way, so only a card plainly facing away by its normal counts, or hanging hair seen level went dark in blotches. The
  // shell is the faces mapped to the atlas's opaque patches: v above 0.76 as glTF lays it out)
  float crInside = vMapUv.y > 0.76 ? (gl_FrontFacing ? 0.0 : 1.0) : smoothstep(-0.12, -0.45, dot(normalize(vNormal), normalize(vViewPosition)));
  diffuseColor.rgb *= 1.0 - 0.35 * crInside;`)
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
  // (round 3: most of the surface's own (smooth-surface) reflection taken off: at a grazing angle it lit the sides of the
  // ponytail and the side part's top as pale grey streaks. Hair's sheen is the strand highlight below)
  outgoingLight -= totalSpecular * 0.75;
#if NUM_DIR_LIGHTS > 0
  {
    vec3 crDx = dFdx(-vViewPosition), crDy = dFdy(-vViewPosition);
    vec3 crStr = normalize(vCrStrand - normal * dot(vCrStrand, normal) + 1e-6);
    vec3 crV = normalize(vViewPosition);
    // (cards seen edge-on have no steady strand direction: their highlight fades out)
    float crFace = smoothstep(0.08, 0.35, abs(dot(normalize(cross(crDx, crDy)), crV)));
    float crGrain = sampledDiffuseColor.r;
    vec3 crHi = vec3(0.0);
    // (the first highlight, the strands' own surface reflection, takes some of the hair's colour: white, it read as a
    // grey streak, like grey hair or plastic)
    vec3 crHiTint = mix(vec3(1.0), crHair / max(max(crHair.r, max(crHair.g, crHair.b)), 1e-3), 0.7);
    for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
      vec3 L = directionalLights[i].direction; vec3 H = normalize(L + crV);
      vec3 T1 = normalize(crStr + normal * cr_shift1), T2 = normalize(crStr + normal * cr_shift2);
      float d1 = dot(T1, H), d2 = dot(T2, H);
      float s1 = pow(sqrt(max(0.0, 1.0 - d1 * d1)), cr_exp1), s2 = pow(sqrt(max(0.0, 1.0 - d2 * d2)), cr_exp2);
      float lit = smoothstep(-0.15, 0.45, dot(normal, L)) * crFace;
      crHi += directionalLights[i].color * lit * (s1 * cr_spec1 * mix(0.4, 1.3, crGrain) * crHiTint + s2 * cr_spec2 * diffuseColor.rgb * crGrain);
    }
    outgoingLight += crHi * (1.0 - crInside);
  }
#endif
  // (the inside takes no reflection: at a grazing angle the room's reflection made it a neutral grey strip under the
  // hairline. Its diffuse light only, darker: the hair's shadowed underside, a shade of its own colour)
  outgoingLight = mix(outgoingLight, (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) * 0.75, crInside);
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'crew-hair-cards-3';
  return m;
}
// (the shadow a card hair casts: its strands' cut-out, not its cards' rectangles)
function hairDepthMaterial(atlas) {
  return new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas.map, alphaTest: 0.5, side: THREE.DoubleSide });
}

// ── paint: stubble on the head's own skin (the buzz cut, and the scalp's shade under a hair with a line) ────────────
// A hair entry with `paint` (crew.json: the name of one of PAINTS, and its own `colour`) has no mesh: it is a layer in
// the HEAD's material, so no gap or edge can show. The stubble is the shared strand atlas's stubble patch (its repeating
// tile), tinted by the hair colour, laid on by three flat projections in the head's own frame (the Head bone's, from the
// head's points as bound: it sits still on the skin through every clip and needs none of the head's own UVs, so any
// head takes it), cut by a hairline defined round the standard skull's centre (SKULL: elevation by azimuth, degrees, as
// the Blender styles' hairlines are), so one mask fits every head on the standard skull. The same tile looked up again
// 4.3 times larger gives patches of thicker and thinner stubble, which still read at a few metres where the fine strands
// have blurred to a tint, and break the hairline up so it is never a clean curve; the line also wanders (`wander`),
// arcs over each ear (clear of the ears of every head) and fades over `soft` degrees; the scalp shows through where the
// strands are dark (`cover` at most) and is shaded a little under them (`shade`); `tone` scales the hair's colour.
// A hair's crew.json entry (a Blender style's, or a hair harvested from Tripo) may give `scalp: { line, look }`: its own
// hairline, and the 'under' paint is laid in that footprint (a dark shade of the hair's colour), so any gap under the
// hair reads as hair and its shadow.
//   tile [u0, v0, size]: the atlas's stubble tile (glTF's uv); mean: its mean grey (the tint is the colour over it);
//   size: metres a tile on the head; coarse: how much the large patches thin and thicken it
export const PAINTS = {
  stubble: {
    tile: [0.546875, 0.796875, 0.15625], mean: 0.3884, size: 0.022, cover: 0.64, soft: 3.0, coarse: 1.4, tone: 1.0, shade: 0.12, wander: 1.0,
    line: [[0, 31], [20, 30], [40, 25], [55, 14], [63, 0], [70, -6], [78, -9], [84, -7], [88, -3], [92, 4], [97, 8], [104, 9], [110, 7], [114, 3],
      [118, -3], [124, -13], [132, -25], [145, -36], [160, -41], [180, -43]],
  },
  under: {
    tile: [0.546875, 0.796875, 0.15625], mean: 0.3884, size: 0.022, cover: 0.75, soft: 2.0, coarse: 0.4, tone: 0.45, shade: 0.35, wander: 0.5,
    line: null,
  },
};
const LINE_N = 25;        // (a hairline as 25 elevations, 7.5 degrees apart from the face round to the nape)
function lineSamples(T) {
  const at = (a) => { for (let i = 1; i < T.length; i++) if (a <= T[i][0]) return T[i - 1][1] + (T[i][1] - T[i - 1][1]) * (a - T[i - 1][0]) / Math.max(T[i][0] - T[i - 1][0], 1e-6); return T[T.length - 1][1]; };
  return Array.from({ length: LINE_N }, (_, i) => new THREE.Vector2(i * 7.5, at(i * 7.5)));
}
const PAINT_GLSL = `
uniform sampler2D crPaintMap; uniform vec3 crPaintTile; uniform vec4 crPaintLook, crPaintMore; uniform vec2 crLine[CR_LINE_N];
varying vec3 vCrHead; varying vec3 vCrHeadN;
// (the hairline's elevation at an azimuth from the face, either side)
float crLineAt(float a) {
  for (int i = 1; i < CR_LINE_N; i++) {
    if (a <= crLine[i].x) return mix(crLine[i - 1].y, crLine[i].y, clamp((a - crLine[i - 1].x) / max(crLine[i].x - crLine[i - 1].x, 1e-3), 0.0, 1.0));
  }
  return crLine[CR_LINE_N - 1].y;
}
// (the stubble tile at st (in tiles, unbroken across them): its mip level from st itself, so the tile's repeats leave no seams)
float crTile(vec2 st, vec2 gx, vec2 gy) {
  vec2 uv = crPaintTile.xy + fract(st) * crPaintTile.z;
#if __VERSION__ >= 300
  return textureGrad(crPaintMap, uv, gx * crPaintTile.z, gy * crPaintTile.z).r;
#else
  return texture2D(crPaintMap, uv).r;
#endif
}
// (the tile laid on by three flat projections, weighted by the surface's facing)
float crTri(vec3 P, vec3 Px, vec3 Py, vec3 w) {
  return crTile(P.zy, Px.zy, Py.zy) * w.x + crTile(P.xz, Px.xz, Py.xz) * w.y + crTile(P.xy, Px.xy, Py.xy) * w.z;
}
float crPaintM = 0.0;
vec3 crPaint(vec3 skin) {
  vec3 q = vCrHead - CR_SKULL; vec3 d = normalize(q);
  float el = degrees(asin(clamp(d.y, -1.0, 1.0))), az = degrees(atan(d.x, d.z)), ar = radians(az);
  vec3 w = pow(abs(normalize(vCrHeadN)), vec3(4.0)); w /= (w.x + w.y + w.z);
  vec3 P = vCrHead / crPaintLook.y, Px = dFdx(P), Py = dFdy(P);
  float s = crTri(P, Px, Py, w);
  // (the large patches: the same tile 4.3 times larger and shifted, about 1 on average)
  float k = 0.233; vec3 Q = P * k + vec3(0.37, 0.11, 0.73);
  float c = crTri(Q, Px * k, Py * k, w) / crPaintLook.x;
  float line = crLineAt(abs(az)) + crPaintMore.w * (0.8 * sin(ar * 7.0) + 0.5 * sin(ar * 17.0 + 1.3) + 0.35 * sin(ar * 29.0 + 0.4) + 1.6 * (c - 1.0));
  float m = smoothstep(line - 0.3 * crPaintLook.w, line + crPaintLook.w, el);
  crPaintM = m;
  float dens = m * clamp(1.0 + crPaintMore.x * (c - 1.0), 0.15, 1.4);
  float cover = clamp(crPaintLook.z * dens * smoothstep(0.06, 0.45, s), 0.0, 1.0);
  return mix(skin * (1.0 - crPaintMore.z * m), crHair * crPaintMore.y * (s / crPaintLook.x), cover);
}`;
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

// ── real eyes (the Tripo heads) ────────────────────────────────────────────────────────────────────────────────────
// Each eye is a ball (material 'eye': the white and the iris, from one shared texture: the grey iris inside 0.25 of the
// layout's middle, the white beyond) and a clear layer over it (material 'cornea': a thin shell bulging over the iris),
// both on the eye's bone (EyeL, EyeR, under the Head bone, at the ball's centre). The head's lids rest on the ball and
// turn in behind it, so the ball turns freely under them. The part's crewPart.eyes gives { r: the ball's radius, iris:
// the iris's own colour as painted, sclera: the white's }; a recipe's colours.eyes tints the iris.
//   - the ball: the iris tinted (the texture's grey over its mean, times the colour), the pupil painted black (crPupil:
//     its share of the iris's radius), the white the head's own; and the lids' shade: the ball darker toward its top
//     (the upper lid's shadow), measured in the head's frame, not the ball's, so the shade stays as the ball turns.
//   - the clear layer: black and glossy, ADDED over the ball (no colour of its own: only the light and the room it
//     reflects), so the eye has its wet shine and catches the light.
export const EYE_COLOURS = ['#2e1c10', '#4a2e18', '#6b4426', '#8a6a3a', '#6a6a3c', '#4f7354', '#3f6b8c', '#7d9cbd', '#8e959b'];
const IRIS_MEAN = 0.214, WHITE_MEAN = 0.708;     // (the iris texture's mean grey and its white, linear)
function eyeMaterial(src, eyes) {
  const m = new THREE.MeshStandardMaterial({ name: 'eye', map: src && src.map, roughness: 0.4, metalness: 0, envMapIntensity: 0.35 });
  const u = m.userData.eye = { crIris: { value: lin(eyes.iris || '#4a2e18') }, crIrisOwn: { value: lin(eyes.iris || '#4a2e18') }, crSclera: { value: lin(eyes.sclera || '#d6cfc6') },
    crPupil: { value: 0.36 }, crEyeR: { value: eyes.r || 0.0125 }, crEyeC: { value: [new THREE.Vector3(), new THREE.Vector3()] }, crEyeUp: { value: new THREE.Vector3(0, 1, 0) } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = 'uniform vec3 crIris, crSclera, crEyeUp; uniform float crPupil, crEyeR; uniform vec3 crEyeC[2];\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
  {
    float r = length(vMapUv - 0.5);
    float iris = 1.0 - smoothstep(0.236, 0.256, r);
    float pupil = 1.0 - smoothstep(crPupil * 0.25 - 0.007, crPupil * 0.25 + 0.003, r);
    vec3 c = diffuseColor.rgb;
    diffuseColor.rgb = mix(c * crSclera / ${WHITE_MEAN}, c * crIris / ${IRIS_MEAN}, iris);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.004), pupil);
    // (the lids' shade: by height in the head's frame from the nearer ball's centre, all in view space)
    vec3 p = -vViewPosition;
    vec3 cc = distance(p, crEyeC[0]) < distance(p, crEyeC[1]) ? crEyeC[0] : crEyeC[1];
    float up = dot(p - cc, crEyeUp) / crEyeR;
    diffuseColor.rgb *= (1.0 - 0.5 * smoothstep(0.0, 0.62, up)) * 0.9;
  }`);
  };
  m.customProgramCacheKey = () => 'crew-eye-1';
  return m;
}
function corneaMaterial() {
  return new THREE.MeshStandardMaterial({ name: 'cornea', color: 0x000000, roughness: 0.06, metalness: 0, envMapIntensity: 1.1,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
}
// THE GAZE: where the eyes look. A target (a point in the world) or none (straight ahead); each eye turns to it from its
// own place (so near things draw the eyes in), within an eye's reach (34 degrees either way, 20 up, 12 down: the lids
// don't follow the eyes, so a look far down would stare). The eyes
// don't track smoothly: they jump (a saccade) to where they should look once it's more than 1.5 degrees off, overshoot a
// little and settle (a stiff spring, a little under-damped); while the target holds still they dart now and then to a
// point a degree or two beside it and back. All in the Head bone's frame, so the gaze rides the head through every clip.
const GAZE = { yaw: 0.6, up: 0.35, down: 0.21, jump: 0.026, w: 55, z: 0.62, dart: [0.6, 2.4], dartYaw: 0.044, dartPitch: 0.03 };
function makeGaze(root, head, eyes) {
  root.updateMatrixWorld(true);
  const q0 = eyes.map((b) => b.quaternion.clone());
  const toHead = head.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(root.getWorldQuaternion(new THREE.Quaternion()));
  const F = new THREE.Vector3(0, 0, 1).applyQuaternion(toHead), U = new THREE.Vector3(0, 1, 0).applyQuaternion(toHead), Lf = new THREE.Vector3(1, 0, 0).applyQuaternion(toHead);
  const g = { target: null, fix: [0, 0], cur: [0, 0], vel: [0, 0], dart: [0, 0], next: 0.5, t: 0, eye: [[0, 0], [0, 0]], darting: true };
  const P = new THREE.Vector3(), D = new THREE.Vector3(), Q = new THREE.Quaternion();
  const clampYP = (y, p) => [Math.max(-GAZE.yaw, Math.min(GAZE.yaw, y)), Math.max(-GAZE.down, Math.min(GAZE.up, p))];
  // each eye's wanted (yaw, pitch) in the head's frame
  function wanted() {
    if (!g.target) return [[0, 0], [0, 0]];
    P.copy(g.target); head.worldToLocal(P);
    return eyes.map((b) => { D.copy(P).sub(b.position).normalize(); return clampYP(Math.atan2(D.dot(Lf), D.dot(F)), Math.asin(Math.max(-1, Math.min(1, D.dot(U))))); });
  }
  g.lookAt = (target, { dart = true } = {}) => { g.target = target ? target.clone() : null; g.darting = dart; };
  g.update = (dt) => {
    g.t += dt;
    const w = wanted(), mid = [(w[0][0] + w[1][0]) / 2, (w[0][1] + w[1][1]) / 2];
    const want = clampYP(mid[0] + g.dart[0], mid[1] + g.dart[1]);
    // (a jump when the eyes are far enough off where they should look; darts now and then while it holds)
    if (Math.hypot(want[0] - g.fix[0], want[1] - g.fix[1]) > GAZE.jump) { g.dart = [0, 0]; g.fix = clampYP(mid[0], mid[1]); g.next = g.t + 0.3 + Math.random() * 0.8; }
    else if (g.darting && g.t > g.next) {
      // (back to the target itself now and then; else a point 1 to 2.5 degrees beside it, any way round, flatter up and down)
      const a = Math.random() * 2 * Math.PI, r = 0.4 + 0.6 * Math.random();
      g.dart = Math.random() < 0.35 ? [0, 0] : [Math.cos(a) * r * GAZE.dartYaw, Math.sin(a) * r * GAZE.dartPitch];
      g.fix = clampYP(mid[0] + g.dart[0], mid[1] + g.dart[1]);
      g.next = g.t + GAZE.dart[0] + Math.random() * (GAZE.dart[1] - GAZE.dart[0]);
    }
    // (the spring toward the fixation: stiff, a little under-damped, stepped finely so a slow frame can't upset it)
    const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
    for (let s = 0; s < n; s++) for (let k = 0; k < 2; k++) {
      const a = GAZE.w * GAZE.w * (g.fix[k] - g.cur[k]) - 2 * GAZE.z * GAZE.w * g.vel[k];
      g.vel[k] += a * h; g.cur[k] += g.vel[k] * h;
    }
    eyes.forEach((b, i) => {
      // (each eye: the shared gaze, plus its own turn toward a near target)
      const y = g.cur[0] + (w[i][0] - mid[0]), p = g.cur[1] + (w[i][1] - mid[1]);
      g.eye[i] = [y, p];
      D.copy(F).multiplyScalar(Math.cos(p) * Math.cos(y)).addScaledVector(Lf, Math.cos(p) * Math.sin(y)).addScaledVector(U, Math.sin(p)).normalize();
      Q.setFromUnitVectors(F, D); b.quaternion.copy(Q).multiply(q0[i]);
    });
  };
  // (the lids' shade on the balls: their centres and the head's up, in view space, each time they're drawn)
  g.shade = (mesh, mat) => {
    const C = new THREE.Vector3(), HQ = new THREE.Quaternion();
    mesh.onBeforeRender = (renderer, scene, camera) => {
      const u = mat.userData.eye; if (!u) return;
      eyes.forEach((b, i) => u.crEyeC.value[i].copy(b.getWorldPosition(C)).applyMatrix4(camera.matrixWorldInverse));
      u.crEyeUp.value.copy(U).applyQuaternion(head.getWorldQuaternion(HQ)).transformDirection(camera.matrixWorldInverse);
    };
  };
  return g;
}

// ── face bones ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Each slider, at 1, moves its bones by `move` (metres, in the Head bone's frame: x to their left, y up, z forward) and
// sizes them by 1 + `scale` along each axis; at -1 the other way; values between in proportion. The ranges: jaw width
// 5%, jaw length and chin 4 mm, cheekbones 2 mm out (1.5 forward), nose length 10% and width 18%, the bridge 3 mm, the
// brow 2.5 mm, the eyes 2.5 mm apart each and 8% in size, the ears 6%. (The jaw's width, the cheekbones and the ears
// are held where hair over them stays outside the head with every slider at its end: faceclear.cjs)
const eyes3 = (k) => [k, k, k];
export const FACE = {
  jawWidth: { name: 'Jaw width', bones: { Jaw: { scale: [0.05, 0, 0] } } },
  jawLength: { name: 'Jaw length', bones: { Chin: { move: [0, -0.004, 0] } } },
  chin: { name: 'Chin', bones: { Chin: { move: [0, 0, 0.004] } } },
  cheekbones: { name: 'Cheekbones', bones: { CheekL: { move: [0.002, 0, 0.0015] }, CheekR: { move: [-0.002, 0, 0.0015] } } },
  noseLength: { name: 'Nose length', bones: { Nose: { scale: [0, 0.1, 0.03] } } },
  noseWidth: { name: 'Nose width', bones: { Nose: { scale: [0.18, 0, 0] } } },
  noseBridge: { name: 'Nose bridge', bones: { Bridge: { move: [0, 0, 0.003] } } },
  brow: { name: 'Brow', bones: { Brow: { move: [0, 0, 0.0025] } } },
  eyeSpacing: { name: 'Eye spacing', bones: { EyeSocketL: { move: [0.0025, 0, 0] }, EyeSocketR: { move: [-0.0025, 0, 0] }, EyeL: { move: [0.0025, 0, 0] }, EyeR: { move: [-0.0025, 0, 0] } } },
  eyeSize: { name: 'Eye size', bones: { EyeSocketL: { scale: eyes3(0.08) }, EyeSocketR: { scale: eyes3(0.08) }, EyeL: { scale: eyes3(0.08) }, EyeR: { scale: eyes3(0.08) } } },
  ears: { name: 'Ears', bones: { EarL: { scale: eyes3(0.06) }, EarR: { scale: eyes3(0.06) } } },
};
// the face bones a person has, at rest; and the sliders whose bones they all are
function faceRig(bones) {
  const rest = {};
  for (const S of Object.values(FACE)) for (const b of Object.keys(S.bones)) if (bones[b] && !rest[b]) rest[b] = { p: bones[b].position.clone(), s: bones[b].scale.clone() };
  const sliders = Object.keys(FACE).filter((k) => Object.keys(FACE[k].bones).every((b) => rest[b]) && Object.keys(FACE[k].bones).some((b) => !/^Eye[LR]$/.test(b)));
  return { rest, sliders };
}
function applyFace(bones, rig, values = {}) {
  for (const [b, r] of Object.entries(rig.rest)) { bones[b].position.copy(r.p); bones[b].scale.copy(r.s); }
  for (const k of rig.sliders) {
    const v = Math.max(-1, Math.min(1, +values[k] || 0)); if (!v) continue;
    for (const [b, e] of Object.entries(FACE[k].bones)) {
      const B = bones[b];
      if (e.move) B.position.set(B.position.x + e.move[0] * v, B.position.y + e.move[1] * v, B.position.z + e.move[2] * v);
      if (e.scale) B.scale.set(B.scale.x * (1 + e.scale[0] * v), B.scale.y * (1 + e.scale[1] * v), B.scale.z * (1 + e.scale[2] * v));
    }
  }
}

function setColours(mats, { job, uniform, skin, hair, eyes } = {}) {
  for (const m of mats) {
    if (m.userData.eye) { const e = m.userData.eye; e.crIris.value.copy(eyes ? lin(eyes) : e.crIrisOwn.value); }
    const u = m.userData.crew; if (!u) continue;
    // (a suit that keeps its own colours takes no job's: its marks, lines and panels as made)
    const J = (!m.userData.crewOwnColours && JOBS[job]) || JOBS.explorer;
    for (const k of ['marks', 'lines', 'panels']) { const key = 'cr' + k[0].toUpperCase() + k.slice(1); u[key].value.copy(J[k] ? lin(J[k]) : u[key + 'Ref'].value); }
    u.crWhites.value.copy(uniform ? lin(uniform) : u.crWhitesRef.value);
    // (hands with no skin tone given take the head's own skin, so they match the face: m.userData.crewSkinOf)
    u.crSkin.value.copy(skin ? lin(skin) : m.userData.crewSkinOf || u.crSkinRef.value);
    u.crHair.value.copy(hair ? lin(hair) : u.crHairRef.value);
  }
}

// ── a hair's fit ────────────────────────────────────────────────────────────────────────────────────────────────────
// Every hair is shaped on the standard skull, so one fit serves it on every head. In crew.json, a hair entry's `fit`:
//   offset [x, y, z]  metres, in the head's frame (y up, z forward, x to their left), after the size
//   scale             the size, about the standard skull's centre (1: as made)
//   tuck              0..5 (0% to 500%): the hair drawn in toward the CENTRE of the head (the standard skull's, SKULL),
//                     at every height, each point along its own line from the centre: the sides come in as well as the
//                     edges. Every point on one line moves alike, so the hair keeps its thickness and its layers their
//                     order: at 1 (100%) its underside sits TUCK_CLEAR (2 mm) off the head it's on, all over; past 1 it
//                     is pressed thinner too (2: half as thick above those 2 mm, 5: a fifth). The underside is the
//                     hair's own: a card hair carries each point's height over it (_UNDER, from its Blender build);
//                     other hair is measured (its innermost points along each line). No point comes nearer the head it's
//                     on than TUCK_CLEAR, and none moves outward. Long hair is drawn in down to the jaw line and less
//                     below it (not at all 4 cm under it), so tails and long ends keep hanging as made.
//   tuckStart         metres below the hair's top where the tuck is full; above that it fades out over 2 cm (0: full
//                     all over)
//   heads             { <head id>: { offset, scale, tuck, tuckStart } }: one head's own adjustments, each ADDED to the
//                     hair's own (offsets and tucks added, scales multiplied); a field left out adds nothing
// The head's frame is the Head bone's own: every crew skeleton's Head bone is unturned at rest, so its frame is the
// game's (y up, z forward, metres) from the Head joint, on every suit, and the fit rides the head through every clip.
export const SKULL = [0, 0.106, -0.012];      // the standard skull's centre from the Head joint (the attachment rules)
export const HAIR_CLEAR = 0.004;              // hair as made stays this far off every head (metres)
export const TUCK_CLEAR = 0.002;              // the tuck draws hair in to this far off the head it's on, never nearer
export const TUCK_MAX = 5;                    // the most tuck there is (500%)
// (the head's frame: where long hair's tuck is full and how far below it it fades; how far above tuckStart it fades in)
const TUCK_JAW = -0.025, TUCK_FADE = 0.04, TUCK_RAMP = 0.02;
// the fit a hair wears on a head: its own fit with that head's adjustments added (any field left out: as made)
export function fitFor(f, head) {
  f = f || {}; const d = (f.heads && head && f.heads[head]) || {};
  const o = f.offset || [], p = d.offset || [];
  return { offset: [0, 1, 2].map((i) => (+o[i] || 0) + (+p[i] || 0)), scale: (f.scale == null ? 1 : +f.scale) * (d.scale == null ? 1 : +d.scale),
    tuck: Math.min(TUCK_MAX, Math.max(0, (+f.tuck || 0) + (+d.tuck || 0))), tuckStart: Math.max(0, (+f.tuckStart || 0) + (+d.tuckStart || 0)) };
}
const asMade = (f) => !f || (!f.offset.some((v) => Math.abs(v) > 1e-7) && Math.abs(f.scale - 1) < 1e-7 && !(f.tuck > 0));
// a part's bind space -> the head's frame (its Head bone's own)
function frameOf(mesh) {
  const i = mesh.skeleton.bones.findIndex((b) => b.name === 'Head');
  return new THREE.Matrix4().multiplyMatrices(mesh.skeleton.boneInverses[i], mesh.bindMatrix);
}
// THE HEAD'S REACH: how far the head reaches out from the skull's centre (SKULL) along each line from it, on a 1 degree
// grid (rows: elevation, -90 to 90; columns: azimuth, round from the face), the farthest of points spread over its
// triangles 0.8 mm apart. D: the farthest within 3 degrees, of every point (anything within 2 mm of a point lies within
// about 1.4 degrees of its line, at 8 cm, and a cell is a degree: so a point TUCK_CLEAR outside D along its line is that
// far off the head); S: the mean within 3 degrees of the points over the neck's cut (the head the tuck draws to, smooth,
// so the hair bends smoothly over bumps). The cut is the head's open edge, its vertices joined where they meet; on some
// heads it rises well above the Head joint behind the neck, or runs along a jaw's rim: a line with no head over the cut
// (the neck's opening) has no S, and hair on it is never drawn in; the jaw and neck under the cut still hold it off.
const RF = { ne: 180, na: 360, nt: 180 };
const REACH_MAX = 0.2;          // (metres from the centre: past the chin and the nape, short of the neck's end inside the suit)
const DEG = 180 / Math.PI;
// (the neck's cut is kept each 2 degrees round the skull's upright axis)
const binT = (dx, dz) => ((Math.floor((Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI) * RF.nt) % RF.nt) + RF.nt) % RF.nt;
function headField(g) {
  const { ne, na, nt } = RF, R = new Float32Array(ne * na), RA = new Float32Array(ne * na), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  // (the vertices joined where they meet, 0.05 mm apart or less, so the open edges are the head's own, not its texture's
  // seams; an edge is open when one triangle alone has it)
  const joined = new Map(), edges = new Map(), at = [], tris = [];
  const join = (x, y, z) => { const k = Math.round(x * 2e4) + ',' + Math.round(y * 2e4) + ',' + Math.round(z * 2e4); let i = joined.get(k); if (i == null) { i = at.length; joined.set(k, i); at.push([x, y, z]); } return i; };
  g.scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const M = frameOf(o), pos = o.geometry.attributes.position, idx = o.geometry.index, P = new Float32Array(pos.count * 3), J = new Int32Array(pos.count);
    for (let i = 0; i < pos.count; i++) { a.fromBufferAttribute(pos, i).applyMatrix4(M).toArray(P, i * 3); J[i] = join(a.x, a.y, a.z); }
    const n = idx ? idx.count : pos.count;
    for (let t = 0; t + 2 < n; t += 3) {
      const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
      for (const [p, q] of [[J[i0], J[i1]], [J[i1], J[i2]], [J[i2], J[i0]]]) { const e = p < q ? p * 1e7 + q : q * 1e7 + p; edges.set(e, (edges.get(e) || 0) + 1); }
      tris.push(P.subarray(i0 * 3, i0 * 3 + 3), P.subarray(i1 * 3, i1 * 3 + 3), P.subarray(i2 * 3, i2 * 3 + 3));
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
  // (every point counts toward how far the head reaches (RA: what the hair is kept off); those over the neck's cut alone
  // toward where the tuck draws to (R). Points farther than REACH_MAX from the centre count for neither: a head's neck
  // runs on down inside the suit, and a line through the nape that met the neck's far side low down would read the head
  // as reaching past the hair there, holding the hair where it is)
  const put = (x, y, z) => {
    const dx = x - SKULL[0], dy = y - SKULL[1], dz = z - SKULL[2];
    const r = Math.hypot(dx, dy, dz); if (r < 1e-6 || r > REACH_MAX) return;
    const e = Math.min(ne - 1, Math.max(0, Math.floor(Math.asin(dy / r) * DEG + 90))), z0 = ((Math.floor(Math.atan2(dx, dz) * DEG + 180) % na) + na) % na, k = e * na + z0;
    if (r > RA[k]) RA[k] = r;
    if (y > cutW[binT(dx, dz)] + 0.004 && r > R[k]) R[k] = r;
  };
  for (let t = 0; t < tris.length; t += 3) {
    a.fromArray(tris[t]); b.fromArray(tris[t + 1]); c.fromArray(tris[t + 2]);
    const s = Math.min(64, Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / 0.0008)));
    for (let u = 0; u <= s; u++) for (let v = 0; v <= s - u; v++) {
      const fu = u / s, fv = v / s, fw = 1 - fu - fv;
      put(a.x * fw + b.x * fu + c.x * fv, a.y * fw + b.y * fu + c.y * fv, a.z * fw + b.z * fu + c.z * fv);
    }
  }
  return { D: sphereFilter(RA, 3, true), S: sphereFilter(R, 3, false) };
}
// (a field on the sphere filtered within k degrees: k rows either way, then k degrees of arc either way along each row
// (more columns toward the poles); the farthest (max) or the mean of the cells that have a head (0: none))
function sphereFilter(F, k, max) {
  const { ne, na } = RF, A = new Float32Array(F.length), N = new Float32Array(F.length), out = new Float32Array(F.length);
  for (let e = 0; e < ne; e++) for (let z = 0; z < na; z++) {
    let m = 0, s = 0, n = 0;
    for (let d = -k; d <= k; d++) { const ee = e + d; if (ee < 0 || ee >= ne) continue; const v = F[ee * na + z]; if (v > 0) { if (v > m) m = v; s += v; n++; } }
    A[e * na + z] = max ? m : s; N[e * na + z] = n;
  }
  for (let e = 0; e < ne; e++) {
    const cw = Math.min(na >> 1, Math.ceil(k / Math.max(0.02, Math.cos((e + 0.5 - 90) / DEG))));
    for (let z = 0; z < na; z++) {
      let m = 0, s = 0, n = 0;
      for (let d = -cw; d <= cw; d++) { const i = e * na + (((z + d) % na) + na) % na; if (max) { if (A[i] > m) m = A[i]; } else { s += A[i]; n += N[i]; } }
      out[e * na + z] = max ? m : (n ? s / n : 0);
    }
  }
  return out;
}
// (a field along the line (dx, dy, dz) of length r from SKULL: the mean of the four cells round it that have a head
// (blend), or the largest of them; 0 when none has)
function reach(F, dx, dy, dz, r, blend) {
  const { ne, na } = RF, fe = Math.asin(Math.max(-1, Math.min(1, dy / r))) * DEG + 90 - 0.5, fa = Math.atan2(dx, dz) * DEG + 180 - 0.5;
  const e0 = Math.floor(fe), a0 = Math.floor(fa), we = fe - e0, wa = fa - a0;
  let s = 0, ws = 0, m = 0;
  for (const [de, w1] of [[0, 1 - we], [1, we]]) for (const [da, w2] of [[0, 1 - wa], [1, wa]]) {
    const e = Math.min(ne - 1, Math.max(0, e0 + de)), v = F[e * na + ((((a0 + da) % na) + na) % na)];
    if (!(v > 0)) continue;
    s += v * w1 * w2; ws += w1 * w2; if (v > m) m = v;
  }
  return blend ? (ws > 1e-6 ? s / ws : 0) : m;
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
// THE HAIR'S UNDERSIDE, for the tuck: each point's height over it along the point's own line from the skull's centre
// (metres, as made; once a part). A card hair carries it (_UNDER, written by its Blender build, which knows where the
// hair's volume starts: its shell has no inside). Other hair is measured: its innermost points along each line, the
// innermost within 6 degrees (2 degree cells, so a sparse mesh still finds its inside).
function underOf(src, M) {
  const c = src.userData.fitFloats || (src.userData.fitFloats = {});
  if (c.under) return c.under;
  if (src.attributes._under) return (c.under = floatsOf(src.attributes._under));
  const pos = src.attributes.position, n = pos.count, ne = 90, na = 180, lo = new Float32Array(ne * na).fill(Infinity);
  const r = new Float32Array(n), cell = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(M);
    const dx = _v.x - SKULL[0], dy = _v.y - SKULL[1], dz = _v.z - SKULL[2], d = Math.hypot(dx, dy, dz);
    const e = Math.min(ne - 1, Math.max(0, Math.floor((Math.asin(Math.max(-1, Math.min(1, dy / Math.max(d, 1e-9)))) * DEG + 90) / 2))), a = ((Math.floor((Math.atan2(dx, dz) * DEG + 180) / 2) % na) + na) % na;
    r[i] = d; cell[i] = e * na + a; if (d < lo[cell[i]]) lo[cell[i]] = d;
  }
  // (the innermost within 3 cells: rows, then columns, wider toward the poles)
  const A = new Float32Array(lo.length).fill(Infinity), B = new Float32Array(lo.length).fill(Infinity);
  for (let e = 0; e < ne; e++) for (let a = 0; a < na; a++) for (let d = -3; d <= 3; d++) { const ee = e + d; if (ee >= 0 && ee < ne) A[e * na + a] = Math.min(A[e * na + a], lo[ee * na + a]); }
  for (let e = 0; e < ne; e++) {
    const cw = Math.min(na >> 1, Math.ceil(3 / Math.max(0.02, Math.cos(((e + 0.5) * 2 - 90) / DEG))));
    for (let a = 0; a < na; a++) for (let d = -cw; d <= cw; d++) B[e * na + a] = Math.min(B[e * na + a], A[e * na + ((((a + d) % na) + na) % na)]);
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.max(0, r[i] - B[cell[i]]);
  return (c.under = out);
}
const _q = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _v = new THREE.Vector3();
function applyFit(dst, src, M, fit, field) {
  const pos = src.attributes.position, n = pos.count, s = fit.scale, o = fit.offset, F = new Float32Array(n * 3);
  let top = -Infinity;
  for (let i = 0; i < n; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(M);
    F[i * 3] = SKULL[0] + (_v.x - SKULL[0]) * s + o[0]; F[i * 3 + 1] = SKULL[1] + (_v.y - SKULL[1]) * s + o[1]; F[i * 3 + 2] = SKULL[2] + (_v.z - SKULL[2]) * s + o[2];
    top = Math.max(top, F[i * 3 + 1]);
  }
  const stats = { tucked: 0, held: 0 };
  if (fit.tuck > 0 && field) {
    // (up to 100%: each point moved in along its line by a share of how far its underside is past the 2 mm; past 100%
    // the height over those 2 mm divided down too)
    const under = underOf(src, M), t1 = Math.min(1, fit.tuck), t2 = Math.max(0, fit.tuck - 1), full = top - fit.tuckStart;
    for (let i = 0; i < n; i++) {
      const y = F[i * 3 + 1];
      let w = smooth01((full + TUCK_RAMP - y) / TUCK_RAMP);
      if (y < TUCK_JAW) w *= 1 - smooth01((TUCK_JAW - y) / TUCK_FADE);
      if (w <= 0) continue;
      const dx = F[i * 3] - SKULL[0], dy = y - SKULL[1], dz = F[i * 3 + 2] - SKULL[2], r = Math.hypot(dx, dy, dz);
      if (r < 1e-4) continue;
      const S = reach(field.S, dx, dy, dz, r, true), D = reach(field.D, dx, dy, dz, r, false);
      if (!(S > 0) || !(D > 0)) continue;
      const base = S + TUCK_CLEAR, least = D + TUCK_CLEAR, U = r - under[i] * s;
      let r1 = r - w * t1 * Math.max(0, U - base);
      if (t2 > 0 && r1 > base) r1 = base + (r1 - base) / (1 + w * t2);
      const r2 = Math.max(r1, least);
      if (r2 >= r - 1e-7) continue;
      const k = r2 / r; F[i * 3] = SKULL[0] + dx * k; F[i * 3 + 1] = SKULL[1] + dy * k; F[i * 3 + 2] = SKULL[2] + dz * k;
      stats.tucked++; if (least > r1) stats.held++;
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

// ── the collar fit ──────────────────────────────────────────────────────────────────────────────────────────────────
// (2026-11-07; the game's maker: "detect if it is going through the collar and adjust accordingly... finding the center
// of the collar would be something a script is good at.") Every head keeps its own neck as made; where that neck runs
// down inside a suit's collar, the part hidden there is drawn in so it never pokes through the cloth. Per head and suit,
// when a person is put together (as the hair's tuck is), on the person's own copy of the head's positions.
//   THE COLLAR (once a suit; collarOf): the suit at its rest, in its Head bone's frame (metres, y up, z forward, the
//   Head joint at 0). Level slices of it every COLLAR.step from COLLAR.below under its Neck joint up to 2 cm under its
//   Head joint; on each, from the collar's centre outward, the first of the suit's OUTSIDE met each 5 degrees round (a
//   face turned away from the neck: the collar's cloth; its inner hem, a funnel closing a suit's inside and a lining or
//   plug painted with one texel all lie inside that, hidden): the WALL (none within COLLAR.reach: open there, as a V
//   neck's front; nothing nearer the centre than COLLAR.least counts). The CENTRE on each level: the middle of the wall's points where
//   the wall goes at least three quarters of the way round (found from the Neck joint's line, then found again from
//   there); elsewhere the nearest such level's. The RIM each way round: the highest level with a wall there (the top of
//   the collar's cloth, to COLLAR.step). The wall is eased (the least within 10 degrees and a level, then the mean
//   within 10 degrees), so a fold or a seam doesn't dent the neck.
//   THE FIT (neckFit): each head point at the suit's rest; below the rim at its own angle round the centre, and riding
//   the neck (its Head bone's share under a half: the chin and the face never move), it is kept COLLAR_CLEAR inside the
//   wall at its height, drawn in level toward the centre, only as far as it is past that (never more than COLLAR.deep:
//   a wall deeper inside the neck than that is a suit's inner surface, and the point is left; counted as deep). Going
//   down from the rim, a wall that comes in by over COLLAR.jump in a level is such an inner surface too. The fit grows from nothing at
//   the rim to full COLLAR_BAND below it, so the neck above the rim, what shows, never moves and there is no seam.
//   Where a neck is wider than the collar's top (it covers the collar: the collar's top hidden inside the neck), the
//   neck below the rim is what shows, down to where the collar comes out from under it: that stretch never moves either
//   (the head keeps its own shape; counted as wideMm, coverMm), and the fit starts below it.
//   Nothing is cut, nothing is stretched: a neck too short for a collar stays as short.
//   THE HIDDEN NECK RIDES WITH THE CLOTH: from 5 mm below where the fit starts, a point's skin weights blend toward those
//   of the nearest suit point (full COLLAR_BAND further down; its spine bones only, Hips to Head: a neck never rides an
//   arm, and where the cloth there rides mostly the arms the point keeps its own), so in every clip it moves as the
//   collar round it moves
//   (bound by height alone, a neck turned on its Neck bone while the cloth beside it followed the suit's own weights, and
//   came out through the back of a tight collar in some clips). Each changed point's place in the head's own bind space
//   is solved again through its new weights, so at the suit's rest it stands exactly where the fit put it.
export const COLLAR_CLEAR = 0.003;            // the hidden neck kept this far inside the collar's inner wall (metres)
export const COLLAR_BAND = 0.015;             // the fit grows from nothing at the rim to full this far below it
// (least: nothing nearer the collar's centre than this is a collar a neck goes into (no neck is thinner than about
// 4.6 cm): an older suit's leftovers inside its collar (captain1's) are passed)
// (far: where the look in starts: a wall must be the suit's OUTERMOST cloth along its line out to here, so an inner
// surface with the suit's own back or a pack beyond it (spaceMan's funnel inside its ring) is never taken for the
// collar; a wall farther than reach is none (the suit is far off there). jump: the most a collar's outside comes in from
// one level to the next, going down; deep: the most a neck point is ever drawn in, a safety stop)
const COLLAR = { step: 0.005, below: 0.15, top: -0.02, nt: 72, reach: 0.16, far: 0.35, least: 0.042, around: 0.75, jump: 0.01, deep: 0.045 };
// (the spine's bones: what the hidden neck may ride, borrowed from the cloth beside it)
const SPINE = /^(Hips|Abdomen|Torso|Chest|Neck|Head)$/;
// (an attribute's k-th component of item i, as a number: a packed attribute's unpacked)
const comp = (A, i, k) => (k === 0 ? A.getX(i) : k === 1 ? A.getY(i) : k === 2 ? A.getZ(i) : A.getW(i));
// (a skinned mesh's point i at its skeleton's pose now, in the frame F)
function poseOf(m, i, F, out) { m.getVertexPosition(i, out); return out.applyMatrix4(m.matrixWorld).applyMatrix4(F); }
function collarOf(tpl) {
  tpl.updateMatrixWorld(true);
  const bones = {}; tpl.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  if (!bones.Head || !bones.Neck) return null;
  const F = bones.Head.matrixWorld.clone().invert(), N = bones.Neck.getWorldPosition(new THREE.Vector3()).applyMatrix4(F);
  const { step, nt } = COLLAR, y0 = N.y - COLLAR.below, ny = Math.max(2, Math.floor((COLLAR.top - y0) / step) + 1);
  // (the suit's triangles round the neck, at rest, sliced level by level into segments (x, z))
  // (the cloth that counts is the suit's OUTSIDE, what a poke-through would show past: the first cloth met coming in
  // toward the neck. A collar's inner hem, the inner surfaces some suits close their insides with (a funnel down from
  // the rim) and a face painted with one texel (a lining or a plug: the older suits') lie inside it; the hem still hides
  // the skin from above. Which way a face is wound is not trusted.) And the suit's points there with their bones and
  // weights (by bone name), on a 1 cm grid, so the hidden neck can move as the cloth beside it moves.
  const seg = Array.from({ length: ny }, () => []), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const cloth = { P: [], B: [], W: [], names: [], grid: new Map() }, nameAt = new Map();
  tpl.traverse((m) => {
    if (!m.isSkinnedMesh || m.userData.part !== 'suit') return;
    const g = m.geometry, n = g.attributes.position.count, P = new Float32Array(n * 3), I = g.index, UV = g.attributes.uv;
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    for (let i = 0; i < n; i++) {
      poseOf(m, i, F, a).toArray(P, i * 3);
      if (Math.abs(a.x - N.x) > 0.25 || Math.abs(a.z - N.z) > 0.25 || a.y < y0 - 0.05 || a.y > COLLAR.top + 0.02) continue;
      const q = cloth.P.length / 3; cloth.P.push(a.x, a.y, a.z);
      for (let k = 0; k < 4; k++) {
        const nm = m.skeleton.bones[comp(si, i, k)].name; if (!nameAt.has(nm)) { nameAt.set(nm, cloth.names.length); cloth.names.push(nm); }
        cloth.B.push(nameAt.get(nm)); cloth.W.push(comp(sw, i, k));
      }
      const key = `${Math.floor(a.x / 0.01)},${Math.floor(a.y / 0.01)},${Math.floor(a.z / 0.01)}`;
      (cloth.grid.get(key) || cloth.grid.set(key, []).get(key)).push(q);
    }
    const near = (k) => Math.abs(P[k] - N.x) < COLLAR.far + 0.05 && Math.abs(P[k + 2] - N.z) < COLLAR.far + 0.05 && P[k + 1] > y0 - step && P[k + 1] < COLLAR.top + step;
    const m3 = I ? I.count : n;
    for (let t = 0; t + 2 < m3; t += 3) {
      const i0 = I ? I.getX(t) : t, i1 = I ? I.getX(t + 1) : t + 1, i2 = I ? I.getX(t + 2) : t + 2, ia = i0 * 3, ib = i1 * 3, ic = i2 * 3;
      if (!near(ia) && !near(ib) && !near(ic)) continue;
      if (UV && Math.hypot(UV.getX(i0) - UV.getX(i1), UV.getY(i0) - UV.getY(i1)) + Math.hypot(UV.getX(i0) - UV.getX(i2), UV.getY(i0) - UV.getY(i2)) < 1e-5) continue;
      a.fromArray(P, ia); b.fromArray(P, ib); c.fromArray(P, ic);
      const lo = Math.min(a.y, b.y, c.y), hi = Math.max(a.y, b.y, c.y);
      for (let k = Math.max(0, Math.ceil((lo - y0) / step)); k < ny && y0 + k * step <= hi; k++) {
        const y = y0 + k * step, pts = [];
        for (const [p, q] of [[a, b], [b, c], [c, a]]) {
          if ((p.y - y) * (q.y - y) > 0 || p.y === q.y) continue;
          const f = (y - p.y) / (q.y - p.y); pts.push(p.x + (q.x - p.x) * f, p.z + (q.z - p.z) * f);
        }
        if (pts.length >= 4) seg[k].push(pts[0], pts[1], pts[2], pts[3]);
      }
    }
  });
  // (the suit's outside at angle th (0 ahead, +z; 90 the head's left, +x) round (cx, cz) on level k: the first cloth met
  // coming in from COLLAR.far toward the centre, its distance from the centre (none nearer than COLLAR.least); Infinity
  // when there's none or it is farther than COLLAR.reach)
  const ray = (k, cx, cz, th) => {
    const dx = Math.sin(th), dz = Math.cos(th), S = seg[k]; let best = -Infinity;
    for (let s = 0; s < S.length; s += 4) {
      const ex = S[s + 2] - S[s], ez = S[s + 3] - S[s + 1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-12) continue;
      const wx = S[s] - cx, wz = S[s + 1] - cz, t = (wx * ez - wz * ex) / den, u = (wx * dz - wz * dx) / den;
      if (t >= COLLAR.least && t <= COLLAR.far && t > best && u >= 0 && u <= 1) best = t;
    }
    return best > 0 && best <= COLLAR.reach ? best : Infinity;
  };
  const TH = Array.from({ length: nt }, (_, j) => -Math.PI + (j + 0.5) * 2 * Math.PI / nt);
  const cx = new Float32Array(ny).fill(N.x), cz = new Float32Array(ny).fill(N.z), round = new Uint8Array(ny);
  for (let k = 0; k < ny; k++) {
    for (let it = 0; it < 2; it++) {
      let sx = 0, sz = 0, h = 0;
      for (const th of TH) { const r = ray(k, cx[k], cz[k], th); if (r < Infinity) { sx += cx[k] + r * Math.sin(th); sz += cz[k] + r * Math.cos(th); h++; } }
      if (h < COLLAR.around * nt) break;
      cx[k] = sx / h; cz[k] = sz / h; round[k] = 1;
    }
  }
  // (a level whose wall doesn't go round takes the nearest level's centre that does, below first)
  for (let k = 0; k < ny; k++) if (!round[k]) for (let d = 1; d < ny; d++) {
    const q = [k - d, k + d].find((j) => j >= 0 && j < ny && round[j]); if (q != null) { cx[k] = cx[q]; cz[k] = cz[q]; break; }
  }
  const W = Array.from({ length: ny }, (_, k) => Float32Array.from(TH, (th) => ray(k, cx[k], cz[k], th)));
  // (the rim each way round: the highest level with a wall there, to the top)
  const rim = new Float32Array(nt).fill(-Infinity);
  for (let j = 0; j < nt; j++) for (let k = ny - 1; k >= 0; k--) if (W[k][j] < Infinity) { rim[j] = y0 + k * step; break; }
  // (down from the rim, a wall that comes in by more than COLLAR.jump in one level is not the collar's outside but an
  // inner surface met where the outside is out of reach (spaceMan's funnel under its ring): passed, as no wall)
  for (let j = 0; j < nt; j++) {
    if (!(rim[j] > -Infinity)) continue;
    let last = Infinity;
    for (let k = Math.round((rim[j] - y0) / step); k >= 0; k--) {
      const v = W[k][j]; if (!(v < Infinity)) continue;
      if (last < Infinity && v < last - COLLAR.jump) { W[k][j] = Infinity; continue; }
      last = v;
    }
  }
  // (the wall eased: the least within 2 steps round and a level, then the mean within 2 steps round of the walls there)
  const E = W.map((row, k) => Float32Array.from(row, (_, j) => {
    let m = Infinity;
    for (let dk = -1; dk <= 1; dk++) { const kk = k + dk; if (kk < 0 || kk >= ny) continue; for (let dj = -2; dj <= 2; dj++) m = Math.min(m, W[kk][(j + dj + nt) % nt]); }
    return row[j] < Infinity ? m : Infinity;
  }));
  const wall = E.map((row) => Float32Array.from(row, (v, j) => {
    if (!(v < Infinity)) return Infinity;
    let s = 0, n = 0; for (let dj = -2; dj <= 2; dj++) { const u = row[(j + dj + nt) % nt]; if (u < Infinity) { s += u; n++; } }
    return s / n;
  }));
  return { y0, step, ny, nt, cx, cz, wall, rim, neck: N.toArray(), round: Array.from(round), cloth };
}
// the collar's wall at height y and angle th round the centre (bilinear; the least of the cells that have one, nearer
// an opening; Infinity where none has), and the rim at angle th (linear round)
function wallAt(C, y, th) {
  const fk = (y - C.y0) / C.step, fj = (th + Math.PI) / (2 * Math.PI) * C.nt - 0.5;
  const k0 = Math.floor(fk), j0 = Math.floor(fj), wk = fk - k0, wj = fj - j0;
  let s = 0, ws = 0, m = Infinity;
  for (const [dk, a] of [[0, 1 - wk], [1, wk]]) for (const [dj, b] of [[0, 1 - wj], [1, wj]]) {
    const k = Math.min(C.ny - 1, Math.max(0, k0 + dk)), v = C.wall[k][(((j0 + dj) % C.nt) + C.nt) % C.nt];
    if (v < Infinity) { s += v * a * b; ws += a * b; m = Math.min(m, v); }
  }
  return ws > 0.999 ? s / ws : m;
}
function rimAt(C, th) {
  const fj = (th + Math.PI) / (2 * Math.PI) * C.nt - 0.5, j0 = Math.floor(fj), w = fj - j0;
  const a = C.rim[((j0 % C.nt) + C.nt) % C.nt], b = C.rim[(((j0 + 1) % C.nt) + C.nt) % C.nt];
  return a > -Infinity && b > -Infinity ? a + (b - a) * w : Math.max(a, b);
}
const centreAt = (C, y) => {
  const fk = Math.min(C.ny - 1, Math.max(0, (y - C.y0) / C.step)), k0 = Math.floor(fk), k1 = Math.min(C.ny - 1, k0 + 1), w = fk - k0;
  return [C.cx[k0] + (C.cx[k1] - C.cx[k0]) * w, C.cz[k0] + (C.cz[k1] - C.cz[k0]) * w];
};
// (the head's points moved: m the template's head mesh at the suit's rest, C its suit's collar. Returns the moved
// positions in the head's own bind space (the geometry's), each point's depth below the rim, and the numbers)
function neckFit(m, C) {
  m.updateMatrixWorld(true);
  const bones = m.skeleton.bones, head = bones.find((b) => b.name === 'Head');
  const F = head.matrixWorld.clone().invert();
  // (which of the skin's bones ride the Head: the Head and every bone under it (the eyes', the face's))
  const rides = bones.map((b) => { for (let p = b; p; p = p.parent) if (p === head) return true; return false; });
  const g = m.geometry, pos = g.attributes.position, n = pos.count, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const P = floatsOf(pos), depth = new Float32Array(n).fill(-1), moved = new Float32Array(n), X = new THREE.Vector3();
  const st = { moved: 0, mostMm: 0, meanMm: 0, pastMm: 0, wideMm: 0, wideAt: null, coverMm: 0, deep: 0, rides: 0 };
  let sum = 0;
  // (every point at the suit's rest, in its Head bone's frame: its height, its angle and distance round the collar's
  // centre, its Head share; and the neck's outside on the collar's grid, the farthest of the neck's points (the Head's
  // share under a half) in each level and step round)
  const PX = new Float32Array(n * 3), TH = new Float32Array(n), RR = new Float32Array(n), HW = new Float32Array(n);
  const NR = Array.from({ length: C.ny }, () => new Float32Array(C.nt).fill(-Infinity));
  for (let i = 0; i < n; i++) {
    poseOf(m, i, F, X); X.toArray(PX, i * 3);
    const [cx, cz] = centreAt(C, X.y), dx = X.x - cx, dz = X.z - cz;
    RR[i] = Math.hypot(dx, dz); TH[i] = Math.atan2(dx, dz);
    let hw = 0; for (let k = 0; k < 4; k++) if (rides[comp(si, i, k)]) hw += comp(sw, i, k);
    HW[i] = hw;
    const k = Math.round((X.y - C.y0) / C.step), j = Math.floor((TH[i] + Math.PI) / (2 * Math.PI) * C.nt) % C.nt;
    if (hw < 0.5 && k >= 0 && k < C.ny && RR[i] > NR[k][j]) NR[k][j] = RR[i];
  }
  // (where the fit starts each way round: at the rim, unless the neck there COVERS the collar's top (wider than the
  // collar's outside by over 2 mm: the collar's top is hidden inside the neck, and the neck below the rim is what
  // shows); then from where the collar comes out from under the neck. The covered stretch never moves: a neck wider
  // than a collar keeps its own shape, and is counted (wideMm, coverMm))
  const near = (k, j) => { let v = -Infinity; for (let dk = -1; dk <= 1; dk++) { const kk = k + dk; if (kk < 0 || kk >= C.ny) continue; for (let dj = -1; dj <= 1; dj++) v = Math.max(v, NR[kk][(j + dj + C.nt) % C.nt]); } return v; };
  const start = new Float32Array(C.nt).fill(-Infinity), band = new Float32Array(C.nt).fill(COLLAR_BAND);
  for (let j = 0; j < C.nt; j++) {
    if (!(C.rim[j] > -Infinity)) continue;
    let k = Math.min(C.ny - 1, Math.round((C.rim[j] - C.y0) / C.step));
    const k0 = k, w0 = C.wall[k][j], r0 = near(k, j);
    if (w0 < Infinity && r0 - w0 > st.wideMm / 1000) { st.wideMm = (r0 - w0) * 1000; st.wideAt = Math.round((-Math.PI + (j + 0.5) * 2 * Math.PI / C.nt) * DEG); }
    while (k > 0) { const r = near(k, j), w = C.wall[k][j]; if (!(r > -Infinity) || !(w < Infinity) || r <= w + 0.002) break; k--; }
    start[j] = C.y0 + k * C.step; st.coverMm = Math.max(st.coverMm, (k0 - k) * C.step * 1000);
    // (where the collar comes out from under a wider neck, skin and cloth already meet: the fit comes in over 5 mm)
    if (k < k0) band[j] = 0.005;
  }
  const bandAt = (th) => band[(((Math.round((th + Math.PI) / (2 * Math.PI) * C.nt - 0.5)) % C.nt) + C.nt) % C.nt];
  const startAt = (th) => {
    const fj = (th + Math.PI) / (2 * Math.PI) * C.nt - 0.5, j0 = Math.floor(fj), w = fj - j0;
    const a = start[((j0 % C.nt) + C.nt) % C.nt], b = start[(((j0 + 1) % C.nt) + C.nt) % C.nt];
    return a > -Infinity && b > -Infinity ? a + (b - a) * w : Math.max(a, b);
  };
  // (each bone's whole skin matrix at this rest (the head's bind space to the world); the head's weights as numbers; the
  // suit's points round the neck, nearest within 3 cm on its 1 cm grid)
  const S4 = bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, m.skeleton.boneInverses[i]).multiply(m.bindMatrix));
  const byName = new Map(bones.map((b, i) => [b.name, i]));
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { SI[i * 4 + k] = comp(si, i, k); SW[i * 4 + k] = comp(sw, i, k); }
  const CL = C.cloth;
  const nearestCloth = (x, y, z) => {
    let best = -1, bd = 0.03 * 0.03; const gx = Math.floor(x / 0.01), gy = Math.floor(y / 0.01), gz = Math.floor(z / 0.01);
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) for (let c = -3; c <= 3; c++) {
      const L2 = CL.grid.get(`${gx + a},${gy + b},${gz + c}`); if (!L2) continue;
      for (const q of L2) { const d2 = (CL.P[q * 3] - x) ** 2 + (CL.P[q * 3 + 1] - y) ** 2 + (CL.P[q * 3 + 2] - z) ** 2; if (d2 < bd) { bd = d2; best = q; } }
    }
    return best;
  };
  const Mw = new THREE.Matrix4(), Me = Mw.elements, Xw = new THREE.Vector3(), w0 = new Uint16Array(4), w1 = new Float32Array(4);
  for (let i = 0; i < n; i++) {
    X.fromArray(PX, i * 3);
    const r = RR[i], th = TH[i], [cx, cz] = centreAt(C, X.y), dx = X.x - cx, dz = X.z - cz;
    const top = startAt(th); if (!(top > -Infinity)) continue;
    const below = top - X.y; depth[i] = below;
    if (below <= 0) continue;
    const ride = 1 - smooth01((HW[i] - 0.2) / 0.3), w = smooth01(below / bandAt(th)) * ride;
    // (in toward the centre, to COLLAR_CLEAR inside the suit's outside)
    let r2 = r;
    const a = wallAt(C, X.y, th) - COLLAR_CLEAR;
    if (a < Infinity && r > a && w > 0 && r > 1e-5) {
      if (r - a > COLLAR.deep) st.deep++;
      else { st.pastMm = Math.max(st.pastMm, (r - a) * 1000); r2 = r - w * (r - a); }
    }
    // (and riding as the cloth beside it rides: its weights blended toward the nearest suit point's, from 5 mm below the
    // start to full COLLAR_BAND further down, so in every clip the hidden neck moves with the collar round it)
    const wb = CL ? smooth01((below - 0.005) / COLLAR_BAND) * ride : 0;
    let rew = false;
    for (let k = 0; k < 4; k++) { w0[k] = SI[i * 4 + k]; w1[k] = SW[i * 4 + k]; }
    if (wb > 0) {
      const q = nearestCloth(X.x, X.y, X.z);
      // (only the cloth's spine bones count: the cloth at the neck's foot is often the shoulders' tops, which ride the
      // arms, and a neck must never swing with an arm; where the cloth there rides mostly the arms, the point keeps its own)
      let sp = 0; if (q >= 0) for (let k = 0; k < 4; k++) if (SPINE.test(CL.names[CL.B[q * 4 + k]])) sp += CL.W[q * 4 + k];
      if (q >= 0 && sp >= 0.5) {
        const acc = new Map();
        for (let k = 0; k < 4; k++) { const wt = SW[i * 4 + k] * (1 - wb); if (wt > 0) acc.set(SI[i * 4 + k], (acc.get(SI[i * 4 + k]) || 0) + wt); }
        for (let k = 0; k < 4; k++) { const nm = CL.names[CL.B[q * 4 + k]], bi = byName.get(nm), wt = CL.W[q * 4 + k] * wb / sp; if (bi != null && wt > 0 && SPINE.test(nm)) acc.set(bi, (acc.get(bi) || 0) + wt); }
        const top4 = [...acc.entries()].sort((p, q2) => q2[1] - p[1]).slice(0, 4), s = top4.reduce((t, e) => t + e[1], 0);
        if (s > 1e-6) { for (let k = 0; k < 4; k++) { SI[i * 4 + k] = top4[k] ? top4[k][0] : 0; SW[i * 4 + k] = top4[k] ? top4[k][1] / s : 0; } rew = true; }
      }
    }
    if (r2 === r && !rew) continue;
    // (its bind place solved anew, so at this rest, through its (new) weights, it stands where the fit puts it)
    const k2 = r2 / r; Xw.set(cx + dx * k2, X.y, cz + dz * k2).applyMatrix4(head.matrixWorld);
    Me.fill(0);
    for (let k = 0; k < 4; k++) { const wt = SW[i * 4 + k]; if (!wt) continue; const E = S4[SI[i * 4 + k]].elements; for (let e = 0; e < 16; e++) Me[e] += wt * E[e]; }
    if (Math.abs(Mw.determinant()) < 1e-18) { for (let k = 0; k < 4; k++) { SI[i * 4 + k] = w0[k]; SW[i * 4 + k] = w1[k]; } continue; }
    Xw.applyMatrix4(Mw.invert()); P[i * 3] = Xw.x; P[i * 3 + 1] = Xw.y; P[i * 3 + 2] = Xw.z;
    if (rew) st.rides++;
    if (r2 < r) { const mm = (r - r2) * 1000; st.moved++; sum += mm; st.mostMm = Math.max(st.mostMm, mm); moved[i] = mm; }
  }
  st.meanMm = st.moved ? sum / st.moved : 0;
  for (const k of ['mostMm', 'meanMm', 'pastMm', 'wideMm', 'coverMm']) st[k] = Math.round(st[k] * 10) / 10;
  return { P, SI, SW, depth, moved, start, stats: st };
}
// (a head's own geometry for the collar fit: its positions, normals and skin weights its own, the rest shared with the
// part's; the normals turned as the fit turned the surface under them)
const COLLAR_OWN = ['position', 'normal', 'skinIndex', 'skinWeight'];
function collarGeometry(src, P, SI, SW) {
  const g = new THREE.BufferGeometry(); g.name = (src.name || 'head') + ' (collar fit)';
  g.setIndex(src.index);
  for (const [k, a] of Object.entries(src.attributes)) {
    g.setAttribute(k, k === 'position' ? new THREE.BufferAttribute(P, 3) : k === 'normal' ? new THREE.BufferAttribute(floatsOf(a), 3)
      : k === 'skinIndex' ? new THREE.Uint16BufferAttribute(SI, 4) : k === 'skinWeight' ? new THREE.BufferAttribute(SW, 4) : a);
  }
  for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  g.userData.fitShared = Object.keys(src.attributes).filter((k) => !COLLAR_OWN.includes(k));
  const A = g.attributes.normal;
  if (A) {
    const n = P.length / 3, N0 = partFloats(src, 'n0'), N1 = normalsOf(P, src.index, n);
    for (let i = 0; i < n; i++) {
      _a.fromArray(N0, i * 3); _b.fromArray(N1, i * 3);
      if (_a.lengthSq() < 1e-20 || _b.lengthSq() < 1e-20 || _a.normalize().dot(_b.normalize()) > 0.999999) continue;
      _q.setFromUnitVectors(_a, _b); _v.fromArray(A.array, i * 3).applyQuaternion(_q).toArray(A.array, i * 3);
    }
  }
  return g;
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
      addOwnBones(o.skeleton.bones, bones);
      const m = new THREE.SkinnedMesh(o.geometry, o.material); m.name = o.name; m.userData.part = kind;
      m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale);
      host.add(m);
      // (hands: laid on the suit's own wrists, HANDS above)
      if (kind === 'hand') tpl.userData.handShift = layHand(tpl, bones, m, o, g.scene.userData.crewRig);
      else m.bind(new THREE.Skeleton(o.skeleton.bones.map((b) => bones[b.name]), o.skeleton.boneInverses), o.bindMatrix);
    });
  }
  return tpl;
}
// A part's own bones, which the suit's skeleton doesn't have (a Tripo head's eye bones and face bones, all under its
// Head bone): each made on the template under the bone of its parent's name, where the part has it from that parent,
// so it rides the suit's Head bone (whichever skeleton) as it rode the part's own.
function addOwnBones(list, bones) {
  let left = list.filter((b) => !bones[b.name]);
  while (left.length) {
    const next = [];
    for (const b of left) {
      const p = b.parent && bones[b.parent.name];
      if (!p) { next.push(b); continue; }
      const n = new THREE.Bone(); n.name = b.name; n.position.copy(b.position); n.quaternion.copy(b.quaternion); n.scale.copy(b.scale);
      p.add(n); bones[b.name] = n;
    }
    if (next.length === left.length) throw new Error('crew: a part\'s bones hang from no bone the suit has: ' + next.map((b) => b.name).join(', '));
    left = next;
  }
}

export async function makeCrew(lib, recipe) {
  // (the hands: the recipe's if it names them (null: none), else the suit's skeleton's: HANDS)
  const R = { suit: recipe.suit, head: recipe.head, hair: recipe.hair, hand: recipe.hand !== undefined ? recipe.hand : lib.handFor(recipe.suit) };
  // (card hair, paint hair and the scalp's shade under a hair draw from the shared strand atlas; paint hair has no part of
  // its own: PAINTS)
  const HE = (R.hair && lib.entry('hair', R.hair)) || {}, cards = !!HE.cards, paint = HE.paint && PAINTS[HE.paint] ? HE.paint : null;
  const [suit, head, hair, hand, fit, atlas] = await Promise.all([...['suit', 'head', 'hair', 'hand'].map((k) => (R[k] && !(k === 'hair' && paint) ? lib.part(k, R[k]) : null)), lib.clipsFor(R.suit, R.hand),
    cards || paint || (HE.scalp && HE.scalp.line) ? lib.hairAtlas() : null]);
  const tpl = assemble(suit, [['head', head], ['hair', hair], ['hand', hand]].filter((x) => x[1]));
  // THE COLLAR FIT: the suit's collar and the head's points below its rim, on the template at the suit's rest (before any
  // clip), applied to the person's own copy of the head's positions below
  // (measured always, so its numbers can be read with the fit off; applied only while lib.collarFit is on)
  let collar = null, neck = null;
  if (head) {
    tpl.updateMatrixWorld(true);
    collar = lib.collarOf(R.suit, tpl);
    let hm = null;
    tpl.traverse((o) => {
      if (!o.isSkinnedMesh || o.userData.part !== 'head' || ['eye', 'cornea', 'visor'].includes(o.material && o.material.name)) return;
      if (!hm || o.geometry.attributes.position.count > hm.geometry.attributes.position.count) hm = o;
    });
    if (collar && hm) neck = neckFit(hm, collar);
  }
  const refsOf = { suit: suit && suit.scene.userData.crewPart, head: head && head.scene.userData.crewPart, hair: hair && hair.scene.userData.crewPart, hand: hand && hand.scene.userData.crewPart };
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
    else if (own && own.name === 'eye') { const mat = eyeMaterial(own, (refsOf.head || {}).eyes || {}); o.material = mat; mats.push(mat); meshes.eyes = o; o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; return; }
    else if (own && own.name === 'cornea') { const mat = corneaMaterial(); o.material = mat; mats.push(mat); meshes.cornea = o; o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; o.renderOrder = 1; return; }
    else if (kind === 'hair' && cards) {
      const mat = hairCardMaterial(refsOf.hair || {}, atlas); o.material = mat; mats.push(mat); meshes.hair = o;
      o.customDepthMaterial = hairDepthMaterial(atlas); mats.push(o.customDepthMaterial);
    } else {
      // (a painted cut on the head; or under a hair that gives its hairline (crew.json scalp), the scalp's shade in its footprint)
      const sc = HE.scalp && HE.scalp.line ? HE.scalp : null;
      const pt = kind !== 'head' ? null : paint ? { kind: paint, atlas, colour: HE.colour, frame: frameOf(o) }
        : sc ? { kind: 'under', atlas, line: sc.line, over: sc.look, colourLinear: ((refsOf.hair || {}).refs || {}).hair, frame: frameOf(o) } : null;
      const mat = crewMaterial(own, kind, refsOf[kind], pt); o.material = mat; mats.push(mat); meshes[kind] = o;
      // (the hands, when no skin tone is given, take the head's own skin: HANDS)
      const hs = kind === 'hand' && refsOf.head && refsOf.head.refs && refsOf.head.refs.skin;
      if (hs) mat.userData.crewSkinOf = new THREE.Color().fromArray(hs);
    }
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
  });
  made.dispose();
  // (the collar fit on the person's head: its own positions where any point moved)
  const collarGeo = lib.collarFit !== false && neck && (neck.stats.moved || neck.stats.rides) && meshes.head ? collarGeometry(meshes.head.geometry, neck.P, neck.SI, neck.SW) : null;
  if (collarGeo) meshes.head.geometry = collarGeo;
  if (neck) neck.stats.applied = !!collarGeo;
  const bones = {}; person.root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  // the shins' lengths, for the foot rule (the rest pose: the foot's root on the shin's line)
  person.root.updateMatrixWorld(true);
  const shin = {}; for (const s of ['L', 'R']) shin[s] = bones['LowerLeg' + s].getWorldPosition(new THREE.Vector3()).distanceTo(bones['Foot' + s].getWorldPosition(new THREE.Vector3()));
  const A = new THREE.Vector3(), Y = new THREE.Vector3(), M = new THREE.Matrix4();
  // (real eyes: a ball on each eye bone; the gaze turns them, see THE GAZE)
  const gaze = meshes.eyes && bones.EyeL && bones.EyeR ? makeGaze(person.root, bones.Head, [bones.EyeL, bones.EyeR]) : null;
  if (gaze) gaze.shade(meshes.eyes, meshes.eyes.material);
  // (face bones, at rest before the clips' first frame)
  const faceR = faceRig(bones);
  // ARMS OUT (crew.json suit entry `armsOut`, degrees, 2026-11-07): bulky trousers or a coat's skirts that the hands would
  // sink into in the standing clips: each upper arm turned out that far from the body, as much as it hangs down (none
  // when it's raised or reaching forward), on top of the clip and taken off again before the next frame's clip
  // (lib.armsOut { suit id: degrees }: tried in place of crew.json's, as the checks do)
  // (only while standing or moving: a clip that sits, drives or works (ARMS_KEEP) puts the hands on something, and the
  // turn eases in and out over a third of a second as the clips change)
  const armsOut = THREE.MathUtils.degToRad(lib.armsOut && lib.armsOut[R.suit] != null ? lib.armsOut[R.suit] : (lib.entry('suit', R.suit) || {}).armsOut || 0), armQ = {};
  const _d = new THREE.Vector3(), _ax = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _rq = new THREE.Quaternion();
  let armsW = 1;
  function armsOutApply(dt) {
    const want = ARMS_KEEP.test(person.curName || '') ? 0 : 1;
    armsW = dt > 0 ? armsW + Math.max(-dt * 3, Math.min(dt * 3, want - armsW)) : want;
    person.root.getWorldQuaternion(_rq);
    for (const [s, sg] of [['L', 1], ['R', -1]]) {
      const ua = bones['UpperArm' + s], la = bones['LowerArm' + s]; if (!ua || !la) continue;
      armQ[s] = ua.quaternion.clone();
      _d.subVectors(la.getWorldPosition(_d), ua.getWorldPosition(_ax)).normalize();
      const down = new THREE.Vector3(0, -1, 0).applyQuaternion(_rq), w = Math.max(0, _d.dot(down)) ** 2 * armsW;
      if (w <= 0) continue;
      _ax.set(0, 0, 1).applyQuaternion(_rq).applyQuaternion(ua.parent.getWorldQuaternion(_pq).invert());
      ua.quaternion.premultiply(_q.setFromAxisAngle(_ax, armsOut * sg * w));
    }
    person.root.updateMatrixWorld(true);
  }
  const c = {
    root: person.root, person, meshes, bones, recipe: { ...recipe }, stride: fit.stride, body: fit.body, rig: fit.rig, paint, hand: R.hand,
    play: (name, o = {}) => person.play(name, { once: ONCE.has(name), ...o }),
    update(dt) {
      // (arms out: the clip's own turn back first, so the mixer, which writes only what changed, never stacks it)
      if (armsOut) for (const s of ['L', 'R']) if (armQ[s]) bones['UpperArm' + s].quaternion.copy(armQ[s]);
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
      if (armsOut) armsOutApply(dt);
      if (visor) visor.userData.visor.vsTime.value += dt;
      if (gaze) gaze.update(dt);
    },
    // where the eyes look (a head with real eyes): a point in the world (copied: call again to follow it), or null
    // (straight ahead); dart: the small darting movements while it holds (on unless false)
    gaze,
    lookAt(target, o) { if (gaze) gaze.lookAt(target, o); },
    // the face bones (FACE): the sliders this head has, and their values (-1..1) set
    faceSliders: faceR.sliders,
    setFace(values) { c.recipe.face = { ...(values || {}) }; applyFace(bones, faceR, c.recipe.face); },
    setColours(col) { c.recipe.colours = { ...(c.recipe.colours || {}), ...col }; setColours(mats, c.recipe.colours); },
    expression: null,
    setExpression(name) {
      const k = Object.keys(EXPRESSIONS).indexOf(name);
      c.expression = k >= 0 ? name : 'neutral'; c.recipe.expression = c.expression;
      if (visor) visor.userData.visor.vsExpr.value = Math.max(0, k);
    },
    // the collar fit (the collar fit, above): how far the hidden neck came in; the suit's collar; each head point's depth
    // below the rim (metres; minus above it)
    collarStats: neck ? neck.stats : null, collar, collarDepth: neck ? neck.depth : null, collarMoved: neck ? neck.moved : null,
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
      if (collarGeo) disposeOwn(collarGeo);
      person.mixer.stopAllAction(); person.root.removeFromParent();
    },
  };
  // (each hair mesh, the part's own geometry it shares, and its bind space -> the head's frame)
  const hairFit = hairMeshes.map((m) => [m, m.geometry, frameOf(m)]);
  c.setColours(recipe.colours || {});
  c.setExpression(recipe.expression || 'neutral');
  if (faceR.sliders.length) c.setFace(recipe.face || {});
  await c.setFit(lib.fitOf(R.hair, R.head));
  return c;
}
