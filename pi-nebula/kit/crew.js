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
//   THE ELBOW (2026-11-16; the game's maker: "Can we fix those issues like the elbow position"): the Mathwood people are
// drawn with short upper arms, and the outfits took their elbow joint from them, some 5 cm too near the shoulder (the
// upper arm 0.57 to 0.85 of the forearm, a person's 1.06 to 1.21, joint to joint). The outfit build now puts each
// outfit's elbow joint where a person's is, the arm from the upper arm's joint (where SHOULDER WIDTH turns it) to the
// wrist split 1.14 to 1 (rigs/crew-rig/crewkit.py place_elbow), and makes the weights for it there; no point of any
// outfit moved. The clips, the skeleton's bones' rest turns and Mathwood's own people are as they were.
//   THE ARMS ONE LENGTH, BOTH SLEEVES ALIKE (2026-11-16; the game's maker: "I meant make every outfits arms the same
// length as each other", "You can also try to make both sleeves the same too"): the outfit build (rigs/crew-rig/arms.py)
// brings every outfit's arm, from the upper arm's joint where SHOULDER WIDTH turns it to the wrist, to a person's share
// of the outfit's height (0.328 a man's, 0.319 a woman's: 59.0 cm every men's outfit, 54.9 every women's), stretching
// the sleeve where its cloth is plainest, the cuff and the hand moved along whole; and makes each outfit's other sleeve
// the shape of its better made one, turned over about the body's own middle (its own texture kept). The arms' joints of
// an outfit whose body stands off the skeleton's middle are mirrored about the body's. Nothing here changed for it.
//   Two things differ from a Mathwood person, both done here at load and after each update:
//   - the clips' moves (their position tracks: the body's root, the feet, a shrug; the Blender-made clips carry one
//     for every bone) were made for the Mathwood bones' lengths, so each is laid on the crew's own rest offset:
//     crew rest + (the clip's value - the Mathwood rest) x the hips' height ratio (retargetClips);
//   - the Mathwood feet are not children of the shins (the original rig placed them with IK), so each foot is put at
//     its own shin's end every frame (the clips keep that rule on their own skeleton: the foot's root = the shin's root
//     + the shin's own direction x the shin's length), or a longer shin would leave the boot behind.
//
// THE PARTS (pi-nebula/assets/crew/: suit_<id>.glb, head_<id>.glb, hair_<id>.glb; listed in crew.json). Each is
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
// A FACE PLATE (the game's maker's six androids, 2026-11-19): the same faces drawn by the head's own material on its
// painted plate (crewPart.face 'plate'), only where his paint is dark; see A FACE PLATE below. c.meshes.visor is then
// the head itself.
//
// CARD HAIR (Blender-made styles: a smooth shell plus hair cards, crew.json `cards: true`): one shared grey strand atlas
// for every style (crew.json hairAtlas), tinted by the hair colour, drawn in one alpha-to-coverage pass (hairCardMaterial).
// The Mathwood hair comes smooth-shaded (crew.json `smooth`: the same triangles, its vertices merged and its normals
// smoothed) unless loadCrew({ smoothHair: false }) or lib.smoothHair = false (then its flat facets, as the pack has them).
// THE MATHWOOD HAIR'S STRANDS (2026-11-08, crewPart.strands; HAIR_STRANDS below): its smooth locks drawn as hair, not
// moulded plastic: fine strands from the same strand atlas running from each lock's root to its tip, a strand highlight
// that slides across the locks, darker roots and grooves, a little colour from lock to lock; shape and colour pick as made.
// PAINT HAIR (crew.json `paint`: the buzz cut): no mesh, a stubble layer in the head's own material (PAINTS); with a `file`
// too (the pink side-swept hair, the mohawk), its mesh AND the paint on the head (a shaved side's stubble).
// EACH HAIRCUT ITS OWN BUZZ, NEVER ON THE EARS (2026-11-08, PAINTS and THE PAINT FIELD): outside a hair's edge only the
// short hair a barber leaves with that cut (crew.json `buzz`: sideburns, a nape taper; a harvested hair's marks); the
// scalp's shade under it stops 4 mm inside its edge; every head's ears (crew.json `ears`) take no paint.
//
// A HAIR'S FIT (crew.json: a hair entry's optional `fit`, made with the Crew Lab's Fit row; see "a hair's fit" below):
// nudged, sized, tucked (drawn in toward the head's centre, thickness kept, down to 2 mm off the head it's on) and hugged
// (its inner layer drawn to 3 mm off THIS head, the dragged-down edge tucked under with it: THE HUG), on every head or
// one head's own way. Applied to the person's own copy of the hair's positions when it's put together, so the game and
// the lab show the same. Then THE STRANDS KEEP THEIR SHAPE (2026-11-11): a point far off the scalp, or one whose
// triangles those moves would stretch, moves with its neighbours, so no strand is torn into spikes.
//
// REAL EYES (the Tripo heads, ~/pw/space-math/rigs/crew-heads/): a ball and a clear wet layer on each of the head's eye
// bones (EyeL, EyeR, under its Head bone); the lids rest on the balls. The gaze looks at a point or straight ahead, with
// small darting movements, jumping and settling as eyes do (THE GAZE, below). A part's own bones (bones the suit's
// skeleton lacks, all under the Head bone) are added to the person's skeleton when it's put together. A head without
// eyes (Vega's helmet) is as it was. (The nine older HD mesh heads, h1 to h9, were taken out 2026-11-11; the old
// portrait set's head, outfit and hair, captain1, 2026-11-17: the game's maker, "It should only be the 13 heads". They
// are kept in ~/pw/space-math/retired/crew-2026-11-17/. The crew.json recipe named captain1 is the Captain herself and
// stays.)
// VEGA'S HELMET is his own (crew.json head entry `with`: the outfit it comes with): a head entry with `with` is no head
// to pick (the Crew Lab's head choices, its line-ups and the measuring sweeps show the 13 human heads only); it comes
// with that outfit and its look (lib.headsToPick(), lib.headWith(suit id)).
//
// FACE BONES (the Tripo heads): small bones under the Head bone (Jaw, Chin, Cheek.L/R, Nose, Bridge, Brow, EyeSocket.L/R,
// Ear.L/R) with smooth weights over the face, each moved or sized from its rest by the sliders in FACE, -1 to 1, kept to
// a believable range so the skin's texture doesn't smear. A recipe's `face` { slider: value } sets them. They ride the
// Head bone, so the clips carry them, and they leave the scalp alone, so the hair's fit is as it was. The eye sockets
// carry the eye bones with them (spacing and size), so the lids stay on the balls.
// THE SMILE (2026-11-08; ~/pw/space-math/rigs/crew-smile): a head built with the smile's bones (Mouth.L/R at the mouth's
// corners, under Jaw; LowerLid.L/R at the eyeballs' centres, under the eye sockets) has FACE.smile: a little closed-mouth
// smile, the corners up, back and out, the cheeks up a touch and the lower lids turned up round the balls. Every head
// that has it wears FACE.smile.default unless its recipe's face sets `smile` (0: a straight face).
//
// HANDS (2026-11-07; ~/pw/space-math/rigs/crew-rig/hands.py): a suit is clothing only, open at its cuffs, and the hands
// are their own part (crew.json parts.hand: both hands in one mesh, skinned to the forearm, wrist and finger bones, with
// a skin mask so the skin tone tints them). A suit wears its skeleton's hands (the entry with that `skeleton`) unless
// the recipe names one (`hand`: an id, or null for none); a suit made with hands of its own (crew.json `ownHands`)
// wears none unless named. The hand is laid on the suit's own wrists (HANDS, below): its stub runs back inside the
// cuff, and stub and cuff fade from the forearm to the wrist by the same rule, so they move together in every clip.
//
// THE FAR COPY (2026-11-16; the game's maker: "Can we use that mesh optimization tool to reduce the triangles?"): every
// part file has a simplified copy, made once by script with meshoptimizer's simplifier (~/pw/space-math/rigs/station-life-2/
// far/far-make.cjs; never at play time): a shorter list of the SAME part's triangles (pi-nebula/assets/crew/far/: far.json
// says what each part's copy keeps, <file>.bin holds them), so the far copy draws the part's own points, with the
// person's own skinning, colours, hair fit and collar fit as they are. makeCrew(lib, recipe, { far: true }) gets them
// ready and c.setFar(true) draws the person with them (the station's people beyond a few metres: src/people.js); the
// eyes have none (never drawn far off). A part re-made since its copy was (its triangles not as far.json says) is drawn
// whole, and the console says so once.
//
//   const lib = await loadCrew()                lib.list: crew.json; lib.part(kind, id) -> its glTF; lib.clipsFor(suit id)
//                                               -> { body, rig, clips (fitted to that suit), stride, moves, shoulders
//                                               (SHOULDER WIDTH's) }; lib.hairAtlas();
//                                               lib.fitOf(hair id, head id) -> the fit makeCrew gives that hair on that
//                                               head; lib.fits { hair id: fit } (empty: a layer over crew.json's, each
//                                               entry replacing that hair's whole fit; the Crew Lab's while it's edited)
//                                               lib.handFor(suit id) -> the hand part a suit wears unless a recipe names one
//                                               lib.headsToPick() -> the heads a person may wear (Vega's helmet left
//                                               out); lib.headWith(suit id) -> the head that comes with that outfit, or null
//                                               lib.buzzOf(hair id) -> the buzz makeCrew gives that hair; lib.buzzes
//                                               { hair id: buzz | null } (empty: a layer over crew.json's; the Crew Lab's
//                                               while it's edited); lib.earsOf(head id) -> that head's ears
//   const c = await makeCrew(lib, recipe, { far })   recipe { suit, head, hair, hand, colours: { job, uniform, skin, hair, eyes }, size }
//     (size: the whole person scaled about the feet, SIZES; left out 1; c.size; c.stride scaled with it)
//     (far: the far copies made ready (THE FAR COPY): c.setFar(on), c.far (whether it is drawn), c.tris() (the
//     triangles drawn, eyes and all); lib.farReady(kind, id) gets one part's ready)
//     c.root (place and turn it: feet on y 0, facing +z), c.person (Mathwood's Person), c.play(name, { fade, speed, once }),
//     c.update(dt), c.setColours({ job, uniform, skin, hair, eyes }), c.meshes { suit, head, hair, hand, visor, eyes, cornea },
//     c.bones, c.lookAt(point | null, { dart }) (real eyes: where they look; null straight ahead), c.gaze (null without),
//     c.setFace({ slider: -1..1 }) (face bones: FACE's sliders; recipe.face sets the first), c.faceSliders (the sliders this
//     head has: [] without), c.body ('m' | 'f':
//     the suit's skeleton, whose clips it plays), c.stride (m/s at speed 1: { Walk, Run }), c.dispose(),
//     c.setExpression(name) (a visor's face; recipe.expression sets the first), c.expression,
//     await c.setFit(fit) (the hair's fit, live: { offset, scale, dims, turn, tilt, lean, tuck, tuckStart, hug, hugGap, placed } as
//     lib.fitOf gives; null: as made), c.fit (the fit it wears), c.fitStats ({ tucked: points the tuck moved, held: of
//     those, how many it stopped 2 mm off the head; hugged, under, cleared, hugHeld, hugMostMm: THE HUG's }), c.fitSkirt,
//     c.paint (paint hair's name, or null), c.buzz (the hair's buzz it wears), c.setBuzz(buzz) (live: { sideburns,
//     nape } as lib.buzzOf gives; null: none), c.paintView({ buzz, under, ears }) (what the head's paint shows: each
//     layer on or off, the ears found tinted; c.paintShown as set), c.collarStats (the collar fit: { moved: points, mostMm, meanMm:
//     how far they came in, pastMm: how far the hidden neck reached past the collar's outside, wideMm: how much wider
//     than the collar's top the neck is, wideAt: where (degrees round, 0 ahead, 90 its left), coverMm: how far down a
//     wide neck covers the collar, deep: points left because the wall was deeper inside the neck than COLLAR.deep, rides:
//     points riding with the cloth, tucked: steps round (of 72) where a neck wider than an opening's rim is drawn in
//     behind the cloth below it, applied: whether the fit is on },
//     or null without one), c.collar (the suit's collar as measured), c.collarDepth (each
//     head point's depth below where the fit starts, metres; minus above it), c.collarMoved (how far each came in, mm)
//   lib.collarFit (true: the collar fit on; false: off, the heads as made, its numbers still measured: collarStats
//   .applied false); lib.collarRide (true: the hidden neck rides with the cloth; false: drawn in only);
//   lib.collarOf(suit id, template) -> the collar
//   lib.headPlaceOf(head id, suit id) -> { seat, forward, side, size, centre, levels: { suit, head, pair } } (THE HEAD'S
//   PLACE: how a head sits on an outfit, its three levels added up; centre: THE HEAD'S CENTRE, the head entry's own); lib.headPlaces { suits: { id: headFit }, heads: { id: headFit } }
//   (empty: a layer over crew.json's, the Crew Lab's while it's tried); lib.seatOf(head id, suit id) (the seat alone);
//   lib.seats (the older layer over a head's older `seat`); HEAD_LIMITS; c.place (the place a person wears)
//   lib.armsOf(suit id) -> its arm thickness (ARM THICKNESS; 1 as made); lib.arms { suit id: thickness } (a layer over
//   crew.json's, the Crew Lab's while it's tried); ARMS_LIMITS; c.arms (the thickness a person wears); CALM (THE CALM
//   STANDING POSE) and lib.calm (tried in its place: set before an outfit's clips are first fitted)
//   lib.armsOutOf(suit id) -> { stand, move } (ARMS OUT, degrees: the standing clips' and the moving clips', the
//   suit entry's `armsOut` and `armsOutMove`); lib.armsOut and lib.armsOutMove { suit id: ... } (tried in their place);
//   c.armsOut (a person's), c.armsOutNow() (the angle worn this frame, the playing clips' mixed by their weights)
//   lib.shouldersOf(suit id) -> how far its upper arms' joints are moved out (SHOULDER WIDTH; metres, 0 as made);
//   lib.shoulders { suit id: metres } (a layer over crew.json's, the Crew Lab's while it's tried); SHOULDER_LIMITS,
//   SHOULDER_STEP; c.shoulders (what a person wears)
//   JOBS, UNIFORM_COLOURS, BAND_COLOURS (THE BANDS), SKIN_TONES, SKIN_LIMIT and skinTone (THE SKIN'S LIMITS),
//   HAIR_UNDERSIDE (THE HAIR'S UNDERSIDE), HAIR_COLOURS, EYE_COLOURS, FACE, CLIPS, EXPRESSIONS, PAINTS, fitFor, hairRotation, SKULL,
//   HAIR_CLEAR, TUCK_CLEAR, TUCK_MAX, HUG_GAP, HUG_MAX, HUG_DEFAULT, COLLAR_CLEAR, COLLAR_BAND, SIDEBURN, NAPE, UNDER_SOFT,
//   EAR_SOFT, lineAt, paintField, HAIR_STRANDS (the Mathwood hair's strand look), STRAND_S, STRAND_P
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
// THE BANDS (2026-11-10; the game's maker: "it would be cool of some of those uniforms where tinted in different colors
// (the white bands), Purple should be an option"). The station uniforms' white bands (atlantis1's stripes on the chest
// and arms, atlantis2's chest and side panels) are their whites, so a recipe's colours.uniform tints them, and left out
// they stay white as made. These eight read well on the dark grey cloth (light enough to stand out, not so light they
// glow), by name, for the Crew Lab's Bands row and the looks' recipes. (2026-11-17, the game's maker: "can we make this
// purple tint on the uniform a more rich purple?": the purple was #9b6ddb, which the cloth showed as a pale lavender;
// now a deeper, richer one, between a violet and a royal purple, tried on the grey and the dark uniforms beside four others)
export const BAND_COLOURS = { white: '#e9ecef', purple: '#6e28b2', teal: '#2ec4b6', orange: '#f0892e', red: '#d9463e', blue: '#3f8fe8', gold: '#e3b341', green: '#5cbf5a' };
// a person's height (a recipe's `size`, the whole body scaled about the feet: THE SIZE, in makeCrew), three steps
export const SIZES = { shorter: 0.9, medium: 1, taller: 1.07 };
export const SKIN_TONES = ['#f2d3bd', '#e8bf9f', '#d9a37f', '#c48a62', '#a66d45', '#86522f', '#663b22', '#47291a'];
// THE SKIN'S LIMITS (2026-11-10; the game's maker: "some of the light skin looks completely white... They look like a
// vampire", and of two characters' hands: "I have never seen hand this white, they should have a limit on how light
// they can go"). A skin tone was laid on as each channel's ratio of the tone to the part's own measured skin, held to
// 0.1 to 4 times: a pale tone on a darker head or hand was multiplied up 2 to 4 times (blue up to 10 times wanted, 4
// given: a pale tone on an orange head came out yellow), its painted highlights past white; and the two palest tones are
// lighter and greyer than skin reads under the title's bright, cool portrait light, so even their mean read as white.
// Now (skinTone, and the head's and hands' shader):
//   the tone's LIGHTNESS (linear luminance): past `soft` it is eased toward `most`, never reaching it, so the palest
//     tones stay the lightest, in order, but no lighter than skin;
//   its WARMTH: a pale tone's colour (its distance from grey) grown till its blue is at most 1 - `warm` of its red, its
//     lightness kept, so cool lights and the tone curve can't grey it to chalk;
//   the LIFT: the most a tone may lighten the HEAD it's on, `lift` times its own skin (a head made darker, whose features
//     were made for it, comes out light, never washed out: of the looks' heads only t9 and t2 are held by it);
//   the hands wear the colour the head came out at, `hands` as light (the backs of the hands face the light more than a
//     face, whose painted shading darkens it), so they match the face;
//   on the part (the shader): the tone's colour times the texel's own light against the part's mean (the painted light
//     and shade, freckles and all, kept whole) times `hue` of the texel's own colour against the mean (lips and cheeks
//     keep some of their colour; the head's own hue no longer fights the tone's channel by channel, so no clamp);
//     and a texel lightened past `shine` eased toward `shineMost`, never darker than it was painted, so the painted
//     highlights never run to white.
// A part in its own skin (no tone given) is drawn exactly as made.
// (2026-11-10, measured on every tone on the looks' seven heads and both hands, in the portrait and station light:
// ~/pw/space-math/CREW_fixes.md. A blind critic still found the palest faces grey and waxy at warm 0.62, most 0.46,
// hue 0.5: so warmer, a touch darker, more of the lips' and cheeks' own colour; a second found Ivy (t9, fair) still
// chalky and at odds with her features, so the lift 3 -> 2.5. The cost: the palest three tones come out close together,
// fair a little lighter than light, light than tan)
export const SKIN_LIMIT = { soft: 0.28, most: 0.43, warm: 0.70, lift: 2.5, hands: 0.85, hue: 0.75, shine: 0.42, shineMost: 0.62 };
const lumOf = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const ease = (l, k, M) => (l <= k ? l : k + (M - k) * (1 - Math.exp(-(l - k) / Math.max(M - k, 1e-6))));
// the colour a skin tone comes out at on a head (linear Colours: the tone picked, the head's own measured skin), by
// THE SKIN'S LIMITS; the hands are given this colour times SKIN_LIMIT.hands
export function skinTone(tone, own, L = SKIN_LIMIT) {
  const t = tone.clone(), l = lumOf(t), s = t.r > 1e-6 ? 1 - t.b / t.r : 1;
  const k = L.warm && s > 1e-6 && s < L.warm ? L.warm / s : 1;
  if (k > 1) {
    t.g = Math.max(t.r * 0.02, t.r - (t.r - t.g) * k); t.b = Math.max(t.r * 0.02, t.r - (t.r - t.b) * k);
    const l2 = lumOf(t); if (l2 > 1e-6) t.multiplyScalar(l / l2);
  }
  if (l > 1e-6) t.multiplyScalar(ease(l, L.soft, L.most) / l);
  const lo = own ? lumOf(own) : 0;
  if (lo > 1e-6 && lumOf(t) > lo * L.lift) t.multiplyScalar(lo * L.lift / lumOf(t));
  return t;
}
export const HAIR_COLOURS = ['#17110d', '#2e1f15', '#4a2f1d', '#6b4127', '#8f5a32', '#b4824f', '#d8bc84', '#a83c22', '#8f8a84', '#d6d3cc'];
// A HAIR COLOURED BY ITS OWN LIGHT AND DARK (2026-11-19; the game's maker, of the character maker's hair colours: "I
// wonder if we should make the pink hair greyscale so it doesn't already have a color. Or will it take on other colors
// okay?"). A hair colour is laid on a hair as a shift from the hair's own colour (the top of this file), which keeps
// whatever of the hair's own colour differs from its mean: fine on a brown or black hair, but the pink side-swept
// hair is painted bright pink over near-black roots, and its pink came through a dark colour (black hair with magenta
// streaks: ~/pw/space-math/shots/character-1/q11_pink_hair.jpg). The hairs named here take a colour by their light and
// dark alone instead (the picture's greyscale, worked out in the shader: no file is changed): the colour picked times
// each texel's lightness against the hair's own mean. Worn in its own colour (no hair colour given) such a hair is
// drawn exactly as made, pink and all.
// EVERY HAIR SO (the same day; the game's maker, shown the pink hair before and after: "Color every hair this way, not
// only the pink one"): every hair mesh takes a colour by its own light and dark (the card hairs, the paint hairs and
// the scalp's shade under a hair already did: the strand atlas is grey). HAIR_BY_LIGHT true: every hair; a list: only
// the hairs named (['pinkSide']: as it was before this). lib.hairByLight, when set, in its place (false: none, the
// shift for every hair, as at first; the checks' before pictures).
export const HAIR_BY_LIGHT = true;
const hairByLight = (lib, id) => { const L = lib.hairByLight === undefined ? HAIR_BY_LIGHT : lib.hairByLight; return L === true || (Array.isArray(L) && L.includes(id)); };

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
  // (VEGA'S HELMET: the heads to pick from, every head but one that comes with its own outfit (a head entry's `with`);
  // and the head an outfit comes with, or null)
  lib.headsToPick = () => (list.parts.head || []).filter((h) => !h.with);
  lib.headWith = (suit) => ((list.parts.head || []).find((h) => h.with && h.with === suit) || {}).id || null;
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
  // a head's own setting for every hair worn on it (a head entry's hairFit: { dims, offset }): lib.headFits' for that
  // head if it has one (the Crew Lab's while it's edited), else crew.json's
  lib.headFits = {};
  lib.headFitOf = (head) => (!head ? null : Object.prototype.hasOwnProperty.call(lib.headFits, head) ? lib.headFits[head] : (lib.entry('head', head) || {}).hairFit || null);
  // how a head sits on an outfit (THE SEAT and THE HEAD'S PLACE): lib.headPlaceOf(head, suit) -> { seat, forward, side,
  // size, centre, levels: { suit, head, pair } each { seat, forward, side, size } }, the three levels added up (sizes
  // multiplied), and the head's own centre (THE HEAD'S CENTRE: the head entry's `centre` [x, z], metres). Each
  // outfit's and head's headFit is lib.headPlaces' for it if it has one (the Crew Lab's while it's tried; a head's
  // replacing its older `seat` too), else crew.json's
  lib.headPlaces = { suits: {}, heads: {} };
  // ARM THICKNESS (makeCrew): lib.arms { suit id: thickness } (the Crew Lab's while it's tried) over the suit entry's `arms`
  lib.arms = {};
  lib.armsOf = (suit) => { const v = own(lib.arms, suit) ? lib.arms[suit] : (lib.entry('suit', suit) || {}).arms; return +v > 0 ? Math.min(ARMS_LIMITS[1], Math.max(ARMS_LIMITS[0], +v)) : 1; };
  // ARMS OUT (makeCrew): an outfit's angles, degrees: { stand, move } (move: one number for every moving clip, or
  // { clip: degrees }; the standing one where the outfit gives none). lib.armsOut { suit id: degrees } and
  // lib.armsOutMove { suit id: degrees | { clip: degrees } } are tried in place of crew.json's, as the checks do
  lib.armsOutOf = (suit) => {
    const E = lib.entry('suit', suit) || {}, a = lib.armsOut && lib.armsOut[suit], m = lib.armsOutMove && lib.armsOutMove[suit];
    const stand = +(a != null ? a : E.armsOut) || 0, mv = m != null ? m : E.armsOutMove;
    return { stand, move: mv == null ? stand : typeof mv === 'object' ? { ...mv } : +mv || 0 };
  };
  // SHOULDER WIDTH (makeCrew, clipsFor): lib.shoulders { suit id: metres } (the Crew Lab's while it's tried) over the
  // suit entry's `shoulders`
  lib.shoulders = {};
  lib.shouldersOf = (suit) => {
    const v = +(own(lib.shoulders, suit) ? lib.shoulders[suit] : (lib.entry('suit', suit) || {}).shoulders);
    return Number.isFinite(v) && v ? +Math.min(SHOULDER_LIMITS[1], Math.max(SHOULDER_LIMITS[0], v)).toFixed(4) : 0;
  };
  // (the older form: a head entry's `seat`, and lib.seats over it, as the Crew Lab kept them before 2026-11-11)
  lib.seats = {};
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const lvl = (o) => ({ seat: +(o && o.seat) || 0, forward: +(o && o.forward) || 0, side: +(o && o.side) || 0, size: o && +o.size > 0 ? +o.size : 1 });
  lib.headPlaceOf = (head, suit) => {
    const S = (own(lib.headPlaces.suits, suit) ? lib.headPlaces.suits[suit] : (lib.entry('suit', suit) || {}).headFit) || {};
    const mine = !!head && own(lib.headPlaces.heads, head), H = (mine ? lib.headPlaces.heads[head] : head && (lib.entry('head', head) || {}).headFit) || {};
    const old = !head || mine ? null : own(lib.seats, head) ? lib.seats[head] : (lib.entry('head', head) || {}).seat;
    const levels = { suit: lvl(S), head: lvl(H), pair: lvl(H.suits && H.suits[suit]) };
    if (old != null) {
      if (typeof old === 'number') levels.head.seat += +old || 0;
      else { if (old[suit] != null) levels.pair.seat += +old[suit] || 0; else if (old.all != null) levels.head.seat += +old.all || 0; }
    }
    const L = Object.values(levels), cl = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
    const c = head && (lib.entry('head', head) || {}).centre, centre = Array.isArray(c) ? [cl(+c[0] || 0, HEAD_LIMITS.side), cl(+c[1] || 0, HEAD_LIMITS.forward)] : [0, 0];
    return { seat: cl(L.reduce((a, l) => a + l.seat, 0), HEAD_LIMITS.seat), forward: cl(L.reduce((a, l) => a + l.forward, 0), HEAD_LIMITS.forward),
      side: cl(L.reduce((a, l) => a + l.side, 0), HEAD_LIMITS.side), size: cl(L.reduce((a, l) => a * l.size, 1), HEAD_LIMITS.size), centre, levels };
  };
  lib.seatOf = (head, suit) => lib.headPlaceOf(head, suit).seat;
  // (the hug a hair wears when its fit gives none: the crew's own hairs (a scalp line) hugged, the rest not)
  lib.hugDefaultOf = (hair) => { const E = (hair && lib.entry('hair', hair)) || {}; return E.scalp && E.scalp.line ? HUG_DEFAULT : 0; };
  lib.fitOf = (hair, head) => {
    if (!hair) return null;
    return fitFor(Object.prototype.hasOwnProperty.call(lib.fits, hair) ? lib.fits[hair] : (lib.entry('hair', hair) || {}).fit, head, lib.headFitOf(head), lib.hugDefaultOf(hair));
  };
  // how far a head reaches along every line from the skull's centre, for the tuck (once a head: THE HEAD'S REACH)
  const fields = new Map();
  lib.headField = (id) => { if (!fields.has(id)) fields.set(id, lib.part('head', id).then(headField)); return fields.get(id); };
  // its triangles in 5 mm cells, for the hug's exact clearance (once a head: THE HUG)
  const triGrids = new Map();
  lib.headTris = (id) => { if (!triGrids.has(id)) triGrids.set(id, lib.part('head', id).then(headTris)); return triGrids.get(id); };
  // a suit's collar, for the collar fit (once a suit: THE COLLAR FIT), measured on a person's template at its rest
  const collars = new Map();
  lib.collarFit = true; lib.collarRide = true;
  lib.collarOf = (id, tpl) => { if (!collars.has(id)) collars.set(id, collarOf(tpl)); return collars.get(id); };
  // the card hair's one shared strand atlas and its normal map (list.hairAtlas), loaded once for every style
  let atlas = null;
  lib.hairAtlas = () => atlas || (atlas = Promise.all([hairTexture(dir + list.hairAtlas.map, true), hairTexture(dir + list.hairAtlas.normal, false)])
    .then(([map, normalMap]) => ({ map, normalMap })));
  // a paint's marks (a hair entry's `marks`: BOTH, at PAINTS), once a file; wrapping round across (azimuth +-180)
  const markTex = new Map();
  lib.paintMarks = (file) => { if (!markTex.has(file)) markTex.set(file, hairTexture(dir + file, true).then((t) => { t.wrapS = THREE.RepeatWrapping; t.needsUpdate = true; return t; })); return markTex.get(file); };
  // a hair's buzz (THE PAINT FIELD): lib.buzzes' entry for that hair if it has one (the Crew Lab's while it's edited;
  // null there: none), else crew.json's; and a head's ears (its own, or every head's together)
  lib.buzzes = {};
  lib.buzzOf = (hair) => (!hair ? null : Object.prototype.hasOwnProperty.call(lib.buzzes, hair) ? lib.buzzes[hair] : (lib.entry('hair', hair) || {}).buzz || null);
  lib.earsOf = (head) => (head && (lib.entry('head', head) || {}).ears) || list.ears || null;
  // the clips fitted to one suit (its own bones' lengths: see the top), once a suit; with hands (HANDS), the hand
  // part's own finger joints in place of the suit's (once a suit and hand)
  // (and the outfit's shoulder width (SHOULDER WIDTH): its upper arms' joints moved out in the rig's rest places, so a
  // clip that sets their places (the crowd's) keeps them there; once a suit, hand and width)
  lib.clipsFor = async (id, hand = null) => {
    const sh = lib.shouldersOf(id), key = id + '|' + (hand || '') + '|' + sh;
    if (!fitted.has(key)) {
      fitted.set(key, (async () => {
        const g = await lib.part('suit', id), body = lib.entry('suit', id).skeleton || 'm', hg = hand ? await lib.part('hand', hand) : null;
        const moves = shoulderMoves(g.scene, sh);
        const rig = shoulderRig(handRig(g.scene.userData.crewRig, hg ? hg.scene.userData.crewRig : null), moves);
        const rest = {}; g.scene.traverse((o) => { if (o.isBone) rest[o.name] = o.quaternion.toArray(); });
        const clips = retargetClips(await lib.rawClips(body), rig, rest);
        // (the crew's own copies: THE CALM STANDING POSE, THE HANDS ON THE THIGHS (sitting) and ON A WHEEL (driving), THE
        // WRISTS A PERSON'S; lib.calm, lib.seat, lib.drive and lib.wrists tried in their places, null: that step left out)
        const has = (k) => Object.prototype.hasOwnProperty.call(lib, k);
        const C0 = lib.calm || CALM; let cl = calmStand(clips, g.scene, { ...C0, ...((C0[body]) || {}) }, moves, rig);
        cl = seatedArms(cl, g.scene, hg ? hg.scene : null, rig, moves, has('seat') ? lib.seat : SEAT, has('drive') ? lib.drive : DRIVE);
        cl = humanWrists(cl, g.scene, has('wrists') ? lib.wrists : WRISTS);
        return { body, rig, moves, shoulders: sh, clips: cl, stride: strideOf(rig, body) };
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
  // THE FAR COPY: far.json once; a part file's far triangles once, the first time someone wearing it is made with them.
  // lib.farIndex: each part mesh's own triangle list -> its far copy's (a person's own copy of a part's points, for the
  // hair's or the collar's fit, keeps the part's triangle list, so it finds its far copy there too)
  let farList = null;
  const farFiles = new Map();
  lib.farIndex = new WeakMap();
  lib.farReady = (kind, id) => {
    const file = lib.fileOf(kind, id); if (!file) return Promise.resolve();
    if (!farFiles.has(file)) farFiles.set(file, (async () => {
      farList = farList || fetch(dir + 'far/far.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const L = await farList, E = L && L.parts && L.parts[file]; if (!E) return;
      const [g, buf] = await Promise.all([lib.part(kind, id), fetch(dir + 'far/' + file.replace(/\.glb$/, '.bin')).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null)]);
      if (!buf) return;
      const meshes = []; g.scene.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
      let at = 0;
      meshes.forEach((o, i) => {
        const M = E.meshes[i], I = o.geometry.index; if (!M) return;
        const n = M.far * 3;
        if (!n) return;
        if (I && M.triangles * 3 === I.count && M.points === o.geometry.attributes.position.count && farCheck(I.array) === M.check && (at + n) * 2 <= buf.byteLength) {
          lib.farIndex.set(I, new THREE.BufferAttribute(new Uint16Array(buf, at * 2, n), 1));
        } else console.warn(`crew: the far copy of ${file} (${M.material}) no longer matches the part (re-made since?): drawn whole; make the far copies again`);
        at += n;
      });
    })());
    return farFiles.get(file);
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
// (the clips that carry the person along, the walk and the runs: their own arms out (ARMS OUT, in makeCrew))
const ARMS_MOVE = /^(Walk|Run)/;
// (the fastest the arms out worn changes, radians a second (90 degrees): quicker than any fade the game or the lab
// plays (16 degrees over a fifth of a second is 80), so it only ever holds back a jump)
const ARMS_RATE = Math.PI / 2;
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
// THE CALM STANDING POSE (2026-11-15; the game's maker: the idle hands "do not look good, they are angled too far
// forwards", and "This left should seems low"). The crew's standing clip (Stand_Listen, the game's STAND) is Mathwood's
// listener: a hand on the hip, that elbow swung out toward the viewer, the body shifted onto one hip, the other wrist
// bent forward. The crew play it calmer, made here at load from the clip itself (Mathwood's own file is left as it is,
// and so is every other clip): both arms hang relaxed, the hands by the thighs with the wrists straight in line with
// the forearms (the rest pose's own wrist turn) and the fingers as Idle has them; the clavicles as Idle has them (level);
// the body's shift onto one hip and its sway kept at CALM.shift of the clip's own (the rest blended toward Idle's first
// frame); the head's listening nods kept as they are.
// Each arm is aimed in the person's own frame (y up, z their front, x out to that arm's side): the upper arm CALM.upper
// [out, forward] degrees off straight down, the forearm CALM.lower; each turned the shortest way from its rest
// direction; then ARMS OUT (makeCrew) still turns a bulky outfit's arms out on top. lib.calm (as CALM) tries other
// values, as the checks do.
//   2026-11-17 (the game's maker: "Why do our models have such weird poses? Nobody stands around with the wrists outwards
// like that. The basic shapes dummy looks more comfortable with it's arms straight down"): turned the shortest way, the
// palms had come to face BACKWARD with the thumbs into the thighs (the hands' rest turn is 45 degrees off palms-down), and
// the hand part's own line, some 10 degrees off its forearm's, hung as a hand bent out at the wrist. Now THE PALMS TO THE
// THIGHS (below): the thumbs forward, the palms to the thighs, the wrists straight; the fingers a hand's at rest, a
// little curled (CALM.fingers: Sit_Listen's first frame; Idle's held them spread); and the arms aimed nearer straight
// down (they were [5, 3] and [4, 14]). And (station life's blind critic: people standing about "knees bent, hips back,
// as if half-sitting") the body blended toward its REST, straight up as the outfit was built (CALM.stand 'rest': the
// knees straight, the hips over the feet), not toward Idle's first frame, its sway at CALM.shift 0.3 of the clip's own
// (it was 0.5). Each outfit's arms out measured again for it (crew.json `armsOut`: the smallest whole degree that keeps
// the sleeves and hands 5 mm off the hips and thighs through the stand; most a degree to three more than before, as the
// upper arm's own aim is two less: the hands about where they were, now turned to the thighs). Tried and not taken: the
// upper arm straight down and the forearm angled out from the elbow (the hands as far out, the elbows into the jacket's
// sides on the men's outfits), and the hands further forward (more arms out, not less).
// (ARM THICKNESS's limits: thinnest, thickest)
export const ARMS_LIMITS = [0.7, 1.1];
export const CALM = { clip: 'Stand_Listen', upper: [3, 3], lower: [2, 10], shift: 0.3, stand: 'rest', palm: 0.5, fingers: 'Sit_Listen' };
const CALM_BODY = /^(Body|Hips|Abdomen|Torso|Chest|UpperLeg[LR]|LowerLeg[LR]|Foot[LR])$/;
const CALM_IDLE = /^(Shoulder[LR]|(Thumb|Index|Middle|Ring|Pinky)\d[LR])$/;
// SHOULDER WIDTH (crew.json suit entry `shoulders`, metres, 2026-11-15; the game's maker, of Ivy in the grey uniform:
// "the main problem I think is her shoulders seem to narrow. And its a wierd pose with the shoulders being so narrow").
// The outfit build places each upper arm's joint by where the Mathwood body has its own, scaled by the two bodies'
// armpits (rigs/crew-rig/crewkit.py fit_joints). The Mathwood women's body wears a shoulder cape that hangs past its
// armpit, so its armpit is measured 2.8 cm too far out, and the outfits on the women's skeleton have their upper arms
// turning 2.4 to 5.9 cm inside their own armpits (the Mathwood woman's own: 3.0; Ivy's 5.8, the joint under the
// collar's edge). A hanging arm turned about a point that far inside the chest swings in and down: narrow shoulders
// sloping from the collar. Here the joint is moved out toward its side by the outfit's `shoulders` (Ivy's 3.5 cm:
// 2.3 cm inside her armpit, as the Security outfit's sits) at rest, each part's bind led by the bone's new place so
// every point stays exactly where it was made at rest (nothing reshaped; the bone from the shoulder to the elbow just
// shorter, the collarbone longer), and the arm turns from there in every clip. 0 as made (every outfit unless set);
// SHOULDER_LIMITS; lib.shouldersOf. (The collarbones are not it: standing, the joint sits 1 to 2 mm lower than at rest)
// (Every women's outfit has its own, to that same place, about 2.3 cm inside its armpit as measured on its own suit
// at rest: the women's spacesuit 2.5 cm, the women's captain and the medic 2.0, the captain's jumpsuit 0.5, Security
// none; the Dock worker 3.0, less than the 4.0 measured: its armpit is its vest's side, and at 4.0 it read padded)
export const SHOULDER_LIMITS = [-0.02, 0.06], SHOULDER_STEP = 0.005;
// (the moves, from the suit's bones at rest: each upper arm's own place moved d metres out toward its side, its
// forearm's place moved back by as much so the elbow stays; { UpperArmL: local move, LowerArmL: ... }, or null)
function shoulderMoves(scene, d) {
  if (!d) return null;
  const bare = bareBones(scene); if (!bare) return null;
  const { B } = bare, W = (n) => B[n].getWorldPosition(new THREE.Vector3()), out = {};
  if (!B.UpperArmL || !B.UpperArmR) return null;
  const side = { L: Math.sign(W('UpperArmL').x - W('UpperArmR').x) || 1 }; side.R = -side.L;
  for (const s of ['L', 'R']) {
    const ua = B['UpperArm' + s], la = B['LowerArm' + s]; if (!ua || !la) continue;
    const u0 = W(ua.name), l0 = W(la.name), p0 = ua.position.clone(), q0 = la.position.clone();
    ua.position.copy(ua.parent.worldToLocal(u0.add(new THREE.Vector3(side[s] * d, 0, 0)))); ua.updateMatrixWorld(true);
    la.position.copy(ua.worldToLocal(l0)); la.updateMatrixWorld(true);
    out[ua.name] = ua.position.clone().sub(p0); out[la.name] = la.position.clone().sub(q0);
  }
  return out;
}
// (the rig's rest places with the moves in, for the clips that set those bones' places)
function shoulderRig(rig, moves) {
  if (!moves) return rig;
  const dst = { ...rig.dstRest };
  for (const k of Object.keys(dst)) { const v = moves[clean(k)]; if (v) dst[k] = [dst[k][0] + v.x, dst[k][1] + v.y, dst[k][2] + v.z]; }
  return { ...rig, dstRest: dst };
}
// (the template's bones moved, and every part's bind for a moved bone led by its new place: the point stays at rest.
// The bind lists are the glTF's own, shared: each part gets a new list)
function moveShoulders(tpl, moves) {
  const bones = {}; tpl.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  tpl.updateMatrixWorld(true);
  const before = {}; for (const n of Object.keys(moves)) if (bones[n]) before[n] = bones[n].matrixWorld.clone();
  for (const [n, v] of Object.entries(moves)) if (bones[n]) bones[n].position.add(v);
  tpl.updateMatrixWorld(true);
  const lead = new THREE.Matrix4();
  tpl.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    let inv = null;
    o.skeleton.bones.forEach((b, i) => {
      const M0 = before[b.name]; if (!M0) return;
      inv = inv || o.skeleton.boneInverses.slice();
      inv[i] = lead.copy(b.matrixWorld).invert().multiply(M0).multiply(o.skeleton.boneInverses[i]).clone();
    });
    if (inv) o.skeleton.boneInverses = inv;
  });
}
// (a bare copy of the suit's bones at rest, in a holder standing where the glTF's armature does: { B: by name, holder }
// (null without bones); the glTF's own is shared, never posed or moved)
function bareBones(scene) {
  scene.updateMatrixWorld(true);
  const B = {}, holder = new THREE.Object3D(); let top = null;
  scene.traverse((o) => { if (o.isBone) { const b = new THREE.Object3D(); b.name = o.name; b.position.copy(o.position); b.quaternion.copy(o.quaternion); b.scale.copy(o.scale); B[o.name] = b; } });
  scene.traverse((o) => { if (!o.isBone) return; if (o.parent && o.parent.isBone) B[o.parent.name].add(B[o.name]); else { top = o; holder.add(B[o.name]); } });
  if (!top) return null;
  top.parent.matrixWorld.decompose(holder.position, holder.quaternion, holder.scale);
  holder.updateMatrixWorld(true);
  return { B, holder };
}
function calmStand(clips, scene, C = CALM, moves = null, rig = null) {
  const i = clips.findIndex((c) => c.name === C.clip), idle = clips.find((c) => c.name === 'Idle');
  if (i < 0 || !idle) return clips;
  const src = clips[i], dur = src.duration;
  const bare = bareBones(scene); if (!bare) return clips;
  const { B, holder } = bare;
  if (!B.UpperArmL || !B.WristL || !B.Middle1L) return clips;
  // (the shoulder width's moves (SHOULDER WIDTH): the arms aimed from where the person's upper arms really turn; and the
  // hand's own finger joints, as the person wears them (HANDS): the hand's line and its thumb taken from them)
  if (moves) { for (const [n, v] of Object.entries(moves)) if (B[n]) B[n].position.add(v); holder.updateMatrixWorld(true); }
  if (rig && rig.hand) { for (const [b, v] of Object.entries(rig.dstRest || {})) { const X = B[clean(b)]; if (X && HAND_BONE.test(b)) X.position.fromArray(v); } holder.updateMatrixWorld(true); }
  const restQ = {}, restDir = {}, W = (n) => B[n].getWorldPosition(new THREE.Vector3());
  for (const s of ['L', 'R']) for (const [n, m] of [['UpperArm' + s, 'LowerArm' + s], ['LowerArm' + s, 'Wrist' + s]]) {
    restQ[n] = B[n].getWorldQuaternion(new THREE.Quaternion()); restDir[n] = W(m).sub(W(n)).normalize();
  }
  const wristRest = { L: B.WristL.quaternion.toArray(), R: B.WristR.quaternion.toArray() };
  const side = { L: Math.sign(W('UpperArmL').x - W('UpperArmR').x) || 1 }; side.R = -side.L;
  const aim = (deg, sg) => { const r = THREE.MathUtils.degToRad; return new THREE.Vector3(sg * Math.tan(r(deg[0])), -1, Math.tan(r(deg[1]))).normalize(); };
  // (the clip's tracks, the body's blended toward its rest (C.stand 'rest': straight up, the knees straight and the hips
  // over the feet, as the outfit was built) or toward Idle's first frame, the clavicles and fingers Idle's, by name)
  const idleAt0 = {}; for (const t of idle.tracks) idleAt0[t.name] = Array.from(t.values.slice(0, t.getValueSize()));
  const restAt = {}; if (C.stand === 'rest') for (const [n, b] of Object.entries(B)) if (CALM_BODY.test(n)) { restAt[n + '.quaternion'] = b.quaternion.toArray(); restAt[n + '.position'] = b.position.toArray(); }
  // (the fingers: C.fingers' clip's first frame (a hand hanging at rest, its fingers a little curled), else Idle's)
  const fc = C.fingers && clips.find((c) => c.name === C.fingers), fingAt0 = {};
  if (fc) for (const t of fc.tracks) if (/^(Thumb|Index|Middle|Ring|Pinky)\d[LR]\./.test(t.name)) fingAt0[t.name] = Array.from(t.values.slice(0, t.getValueSize()));
  const tracks = src.tracks.map((t0) => {
    const [bone, prop] = t0.name.split('.'), held = C.stand === 'rest' && CALM_BODY.test(bone) ? restAt[t0.name] : fingAt0[t0.name] || idleAt0[t0.name];
    if (held && CALM_IDLE.test(bone)) return new t0.constructor(t0.name, [0, dur], [...held, ...held]);
    if (!held || !CALM_BODY.test(bone) || C.shift >= 1) return t0.clone();
    const t = t0.clone(), n = t.getValueSize(), v = t.values, k = C.shift;
    if (prop === 'quaternion') {
      const a = new THREE.Quaternion(), h = new THREE.Quaternion().fromArray(held).normalize();
      for (let j = 0; j < v.length; j += 4) h.clone().slerp(a.fromArray(v, j).normalize(), k).toArray(v, j);
    } else for (let j = 0; j < v.length; j++) v[j] = held[j % n] + (v[j] - held[j % n]) * k;
    return t;
  });
  // the arms aimed, a sample every 1/15 s over the clip (the body under them moves a little: its sway and breathing)
  const interp = tracks.filter((t) => B[t.name.split('.')[0]]).map((t) => [B[t.name.split('.')[0]], t.name.split('.')[1], t.createInterpolant()]);
  const steps = Math.max(2, Math.round(dur * 15) + 1), times = [], arm = {};
  const pq = new THREE.Quaternion(), wq = new THREE.Quaternion(), sw = new THREE.Quaternion(), Q = () => new THREE.Quaternion(), FWD = new THREE.Vector3(0, 0, 1);
  for (let j = 0; j < steps; j++) {
    const t = (dur * j) / (steps - 1); times.push(t);
    for (const [b, p, I] of interp) { const r = I.evaluate(t); if (p === 'quaternion') b.quaternion.fromArray(r).normalize(); else if (p === 'position') b.position.fromArray(r); }
    for (const s of ['L', 'R']) {
      const ua = B['UpperArm' + s], la = B['LowerArm' + s], wr = B['Wrist' + s];
      wr.quaternion.fromArray(wristRest[s]);
      for (const [n, deg] of [['UpperArm' + s, C.upper], ['LowerArm' + s, C.lower]]) {
        holder.updateMatrixWorld(true);
        sw.setFromUnitVectors(restDir[n], aim(deg, side[s]));
        wq.copy(sw).multiply(restQ[n]);
        B[n].parent.getWorldQuaternion(pq);
        B[n].quaternion.copy(pq.invert().multiply(wq));
      }
      // THE PALMS TO THE THIGHS (2026-11-17): the forearm turned about its own line until the thumb points forward (the
      // turn shared with the upper arm about its own line, C.palm of it, so neither the elbow nor the shoulder takes it
      // all), and the wrist straightened: the hand's line onto the forearm's (the hand part's own line runs some 10
      // degrees off its forearm's, which hanging showed as a hand bent out at the wrist)
      if (C.palm != null && B['Thumb1' + s] && B['Middle1' + s]) {
        holder.updateMatrixWorld(true);
        const f = W('Wrist' + s).sub(W('LowerArm' + s)).normalize(), tp = W('Thumb1' + s).sub(W('Wrist' + s));
        tp.addScaledVector(f, -tp.dot(f)).normalize();
        const want = FWD.clone().addScaledVector(f, -FWD.dot(f)).normalize(), phi = Math.atan2(f.dot(tp.clone().cross(want)), tp.dot(want));
        const fw = Q().setFromAxisAngle(f, phi).multiply(la.getWorldQuaternion(Q()));
        const u = W('LowerArm' + s).sub(W('UpperArm' + s)).normalize();
        ua.quaternion.copy(ua.parent.getWorldQuaternion(Q()).invert().multiply(Q().setFromAxisAngle(u, phi * C.palm).multiply(ua.getWorldQuaternion(Q())))); ua.updateMatrixWorld(true);
        la.quaternion.copy(ua.getWorldQuaternion(Q()).invert().multiply(fw)); la.updateMatrixWorld(true);
        const along = W('Middle1' + s).sub(W('Wrist' + s)).normalize();
        wr.quaternion.copy(la.getWorldQuaternion(Q()).invert().multiply(Q().setFromUnitVectors(along, f).multiply(wr.getWorldQuaternion(Q())))); wr.updateMatrixWorld(true);
      }
      for (const n of ['UpperArm' + s, 'LowerArm' + s, 'Wrist' + s]) (arm[n] = arm[n] || []).push(...B[n].quaternion.toArray());
    }
  }
  const out = src.clone(); out.tracks = tracks.map((t) => {
    const bone = t.name.split('.')[0];
    if (t.name.endsWith('.quaternion') && arm[bone]) return new THREE.QuaternionKeyframeTrack(t.name, times, arm[bone]);
    return t;
  });
  out.userData = { ...(src.userData || {}), calm: true };
  return clips.map((c, j) => (j === i ? out : c));
}
// THE HANDS ON THE THIGHS, SITTING; ON A WHEEL, DRIVING (2026-11-17; the game's maker, of the sitting and driving
// clips: "The sitting ones are really bad because the hands just go right through the thighs", "The driving all need to
// be about 6 inches higher or more", and of Sol: "must be holding the smallest steering wheel ever ... fingers
// intertwined"). The Mathwood sitting clips lay the hands where a Mathwood person's thin thighs are: on the crew's
// trousers they sank 6 to 12 cm in. The crew's own copies (made here at load; Mathwood's files and people as they are):
//   SITTING (SEAT.clips: Sit_Listen, which the game plays at its tables, and the Crew Lab's Sit_Clap and stools): at every
//     moment each hand is lifted straight up until none of it, nor the forearm's half next to it, is inside the thigh's
//     cloth below it (SEAT.clear over it), so it rests ON the thigh; a hand the clip rests beside the hip (nearer it than
//     SEAT.along of the thigh, or out beside it further than SEAT.side from its line: the women's sitting clip, whose
//     hands sat on the hips' sides) goes forward along the thigh and in over it first. The arm reaches
//     there by turning at the shoulder and the elbow (its bend kept on the side the clip bends it), the hand turned as the
//     clip has it;
//   DRIVING (DRIVE.clip): each hand DRIVE.up higher, DRIVE.forward further out in front and the two DRIVE.apart apart
//     (their middle as the clip has it, each hand's own steering moves kept), as on a wheel a person can hold, the hand
//     turned as the clip has it.
// The thighs, the forearms and the hands are taken from the outfit and the hand part as made, each point riding the bone
// that carries most of it. lib.seat and lib.drive (as SEAT, DRIVE) try other values, set before an outfit's clips are
// first fitted. The lift is SEAT.most at most (25 cm: the women's clip hangs the hand down from the wrist, and moved onto
// a thick thigh (the dock worker's, the women's spacesuit's, security's, the cook's apron) its fingers went 12 to 14 cm
// down into it; at 12 cm, the first try, those hands stayed inside, checked on the person as drawn: rigs/crew-3/
// sitcheck.js).
// THE HAND'S MIDDLE OVER THE THIGH (2026-11-19; the game's maker's three slim androids, the medical, service and
// feminine ones: sitting, their hands came to rest down the inner side of a thigh by the lap, and the feminine one's
// fingers went up to 6 cm into her thighs: ~/pw/space-math/ANDROIDS_1.md). The rule above places the WRIST over the
// thigh; the women's clip hangs the hand down and in from it, and on a slim thigh the hand's middle then lay past the
// thigh's top, its fingers down the gap between the two thighs, where nothing lifts them. So, after it: a hand whose own
// middle (its points' middle) lies further in toward the other thigh than SEAT.inner of the thigh's half-width (from
// the middle of the thigh's cloth at that place along) is moved out to that, then lifted onto the thigh as before; a
// hand held up off the thigh (clapping) is left as the clip has it: moved less and less from SEAT.near[0] over the
// thigh's top to not at all at SEAT.near[1]. null: left out (as before this). And the lift itself: it only lifted the points it found inside a thigh, and a
// finger hanging under the thigh's lowest point beside it (down that gap) was carried up into the thigh by it, so the
// lift is worked out again from where it put the hand, SEAT.again times at most (0: once, as before).
export const SEAT = { clips: /^(Sit_|Stool_)/, clear: 0.004, most: 0.25, along: 0.45, side: 0.05, inner: 0.35, near: [0.04, 0.12], again: 3 };
export const DRIVE = { clip: 'Drive', up: 0.15, apart: 0.34, forward: 0.08 };
const SEAT_LEG = /^UpperLeg[LR]$/, SEAT_ARM = /^(LowerArm)([LR])$/, SEAT_HAND = /^(Wrist|Thumb\d|Index\d|Middle\d|Ring\d|Pinky\d)([LR])$/;
// (a part's points, each in the frame of the bone that carries most of it, at rest: { bone names, points (x, y, z each) };
// pick(name): the bones whose points are kept)
function pointsByBone(scene, pick) {
  const names = [], pts = [], v = new THREE.Vector3();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const g = o.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, bones = o.skeleton.bones, inv = o.skeleton.boneInverses;
    for (let i = 0; i < P.count; i++) {
      let b = 0, w = -1; for (let k = 0; k < 4; k++) { const x = comp(SW, i, k); if (x > w) { w = x; b = comp(SI, i, k); } }
      const name = clean(bones[b].name); if (!pick(name)) continue;
      v.fromBufferAttribute(P, i).applyMatrix4(o.bindMatrix).applyMatrix4(inv[b]);
      names.push(name); pts.push(v.x, v.y, v.z);
    }
  });
  return { names, pts };
}
// (the arm's two turns found so its wrist joint reaches T (the world): the upper arm turned the least way so the elbow
// lands where the two lengths meet, on the side the elbow already bends to; then the forearm turned the least way onto
// T; then the wrist turned so the hand keeps its turn in the world, H)
const _ik = { s: new THREE.Vector3(), e: new THREE.Vector3(), w: new THREE.Vector3(), u: new THREE.Vector3(), p: new THREE.Vector3(), q: new THREE.Quaternion(), r: new THREE.Quaternion() };
function turnBoneOnto(bone, from, to) {
  const r = _ik.r.setFromUnitVectors(from, to), pw = bone.parent.getWorldQuaternion(new THREE.Quaternion()), bw = bone.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(pw.invert().multiply(r.multiply(bw))); bone.updateMatrixWorld(true);
}
function reachArm(B, s, T, H) {
  const ua = B['UpperArm' + s], la = B['LowerArm' + s], wr = B['Wrist' + s];
  const S = ua.getWorldPosition(_ik.s.clone()), E = la.getWorldPosition(_ik.e.clone()), W = wr.getWorldPosition(_ik.w.clone());
  const a = S.distanceTo(E), b = E.distanceTo(W), u = T.clone().sub(S);
  const d = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, u.length())); u.normalize();
  const pole = E.clone().sub(S); pole.addScaledVector(u, -pole.dot(u));
  if (pole.lengthSq() < 1e-10) pole.copy(W.clone().sub(E)).addScaledVector(u, -W.clone().sub(E).dot(u));
  if (pole.lengthSq() < 1e-10) pole.set(0, 0, -1).addScaledVector(u, u.z);
  pole.normalize();
  const ca = (a * a + d * d - b * b) / (2 * a * d), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  const E2 = S.clone().addScaledVector(u, a * ca).addScaledVector(pole, a * sa);
  turnBoneOnto(ua, E.sub(S).normalize(), E2.clone().sub(S).normalize());
  const E3 = la.getWorldPosition(new THREE.Vector3()), W3 = wr.getWorldPosition(new THREE.Vector3()), T2 = S.clone().addScaledVector(u, d);
  turnBoneOnto(la, W3.sub(E3).normalize(), T2.sub(E3).normalize());
  wr.quaternion.copy(la.getWorldQuaternion(_ik.q).invert().multiply(H)); wr.updateMatrixWorld(true);
}
function seatedArms(clips, scene, handScene, rig, moves, S = SEAT, D = DRIVE) {
  const which = clips.map((c, j) => (S && S.clips.test(c.name) ? 'sit' : D && c.name === D.clip ? 'drive' : null));
  if (!which.some(Boolean)) return clips;
  const bare = bareBones(scene); if (!bare) return clips;
  const { B, holder } = bare;
  if (!B.UpperArmL || !B.UpperArmR || !B.WristL || !B.WristR) return clips;
  if (moves) for (const [n, v] of Object.entries(moves)) if (B[n]) B[n].position.add(v);
  // (the hand's own finger joints, as the person wears them: HANDS)
  if (rig && rig.hand) for (const [b, v] of Object.entries(rig.dstRest || {})) { const X = B[clean(b)]; if (X && HAND_BONE.test(b)) X.position.fromArray(v); }
  holder.updateMatrixWorld(true);
  // (the thighs from 6 cm down them on (the hips' and the seat's cloth, which also rides the thighs, left out: a hand
  // rests on a thigh in front of the hip, and an elbow hangs beside the hip); the forearms' half next to the wrist)
  const along = (P, k, child) => { const c = B[child], d = c ? c.position.clone().normalize() : null; return d ? P.pts[k * 3] * d.x + P.pts[k * 3 + 1] * d.y + P.pts[k * 3 + 2] * d.z : 0; };
  const only = (P, keep) => { const o = { names: [], pts: [] }; for (let k = 0; k < P.names.length; k++) if (keep(k)) { o.names.push(P.names[k]); o.pts.push(P.pts[k * 3], P.pts[k * 3 + 1], P.pts[k * 3 + 2]); } return o; };
  const legs0 = pointsByBone(scene, (n) => SEAT_LEG.test(n)), fore0 = pointsByBone(scene, (n) => SEAT_ARM.test(n));
  const legs = only(legs0, (k) => along(legs0, k, 'LowerLeg' + legs0.names[k].slice(-1)) > 0.06);
  const fore = only(fore0, (k) => { const s = fore0.names[k].slice(-1), w = B['Wrist' + s]; return w && along(fore0, k, 'Wrist' + s) > 0.5 * w.position.length(); });
  const hands = pointsByBone(handScene || scene, (n) => SEAT_HAND.test(n));
  const v = new THREE.Vector3(), C = 0.015;
  const at = (P, k, out) => out.set(P.pts[k * 3], P.pts[k * 3 + 1], P.pts[k * 3 + 2]).applyMatrix4(B[P.names[k]].matrixWorld);
  return clips.map((src, j) => {
    const kind = which[j]; if (!kind) return src;
    const dur = src.duration, interp = src.tracks.filter((t) => B[t.name.split('.')[0]]).map((t) => [B[t.name.split('.')[0]], t.name.split('.')[1], t.createInterpolant()]);
    const steps = Math.max(2, Math.round(dur * 15) + 1), times = [], arm = {};
    const pose = (t) => { for (const [b, p, I] of interp) { const r = I.evaluate(t); if (p === 'quaternion') b.quaternion.fromArray(r).normalize(); else if (p === 'position') b.position.fromArray(r); } holder.updateMatrixWorld(true); };
    // (driving: each wrist's own middle over the clip, to keep its steering moves about)
    const mid = { L: new THREE.Vector3(), R: new THREE.Vector3() };
    if (kind === 'drive') { for (let k = 0; k < steps; k++) { pose((dur * k) / (steps - 1)); for (const s of ['L', 'R']) mid[s].add(B['Wrist' + s].getWorldPosition(v)); } mid.L.divideScalar(steps); mid.R.divideScalar(steps); }
    const centre = mid.L.clone().add(mid.R).multiplyScalar(0.5), side = Math.sign(B.UpperArmL.getWorldPosition(new THREE.Vector3()).x - B.UpperArmR.getWorldPosition(new THREE.Vector3()).x) || 1;
    let moved = 0;
    // (THE HAND'S MIDDLE OVER THE THIGH, below: how far out a hand is to go, at this moment of the clip)
    const hm = new THREE.Vector3(), q = new THREE.Vector3();
    const handOver = (s, hip, ax0, fwd) => {
      const ax = ax0.clone().normalize(), across = new THREE.Vector3(ax.z, 0, -ax.x);
      const other = B[(s === 'L' ? 'UpperLegR' : 'UpperLegL')].getWorldPosition(new THREE.Vector3());
      const inward = Math.sign(other.sub(hip).dot(across)) || 1;
      let n = 0; hm.set(0, 0, 0);
      for (let i = 0; i < hands.names.length; i++) if (hands.names[i].slice(-1) === s) { hm.add(at(hands, i, v).add(fwd)); n++; }
      if (!n) return q.set(0, 0, 0);
      hm.divideScalar(n).sub(hip);
      const t = hm.dot(ax), x = hm.dot(across);
      let lo = Infinity, hi = -Infinity, top = -Infinity;
      for (let i = 0; i < legs.names.length; i++) { if (legs.names[i].slice(-1) !== s) continue; at(legs, i, v).sub(hip); if (Math.abs(v.dot(ax) - t) > 0.025) continue; const xq = v.dot(across); if (xq < lo) lo = xq; if (xq > hi) hi = xq; if (v.y > top) top = v.y; }
      if (!(hi > lo)) return q.set(0, 0, 0);
      // (only a hand down at the thigh: one held up off it, clapping, is the clip's own, and from SEAT.near[0] over the
      // thigh's top to SEAT.near[1] it is moved less and less)
      const up = (hm.y - top - S.near[0]) / (S.near[1] - S.near[0]), w = up <= 0 ? 1 : up >= 1 ? 0 : 1 - up * up * (3 - 2 * up);
      const over = ((x - (lo + hi) / 2) * inward - S.inner * (hi - lo) / 2) * w;
      return over > 0 ? q.copy(across).multiplyScalar(-inward * over) : q.set(0, 0, 0);
    };
    for (let k = 0; k < steps; k++) {
      const t = (dur * k) / (steps - 1); times.push(t); pose(t);
      // (the thighs' cloth seen from above: in each 1.5 cm cell its lowest and its highest point; a hand or forearm point
      // between the two is in the thigh, and is lifted over its top. A point under a thigh's lowest, a hand hanging
      // down beside a knee, is not in it)
      let top = null;
      if (kind === 'sit') {
        top = new Map();
        for (let i = 0; i < legs.names.length; i++) { at(legs, i, v); const key = Math.floor(v.x / C) * 4096 + Math.floor(v.z / C), h = top.get(key); if (!h) top.set(key, [v.y, v.y]); else { if (v.y < h[0]) h[0] = v.y; if (v.y > h[1]) h[1] = v.y; } }
      }
      for (const s of ['L', 'R']) {
        const wr = B['Wrist' + s], W0 = wr.getWorldPosition(new THREE.Vector3()), H = wr.getWorldQuaternion(new THREE.Quaternion());
        let T = null;
        if (kind === 'sit') {
          // (a hand the clip rests beside the hip, nearer it than SEAT.along of the thigh, is moved forward along the
          // thigh to there, level: onto the thigh rather than the hip)
          const hip = B['UpperLeg' + s].getWorldPosition(new THREE.Vector3()), ax = B['LowerLeg' + s].getWorldPosition(new THREE.Vector3()).sub(hip); ax.y = 0;
          const tl = ax.lengthSq(), tc = tl > 1e-6 ? W0.clone().sub(hip).dot(ax) / tl : 1;
          const fwd = tc < S.along ? ax.clone().multiplyScalar(S.along - tc) : new THREE.Vector3();
          // (and a hand beside the thigh, further out from its line than SEAT.side, brought in over it)
          if (tl > 1e-6) { const across = new THREE.Vector3(ax.z, 0, -ax.x).normalize(), off = W0.clone().sub(hip).dot(across); if (Math.abs(off) > S.side) fwd.addScaledVector(across, Math.sign(off) * S.side - off); }
          // (THE HAND'S MIDDLE OVER THE THIGH: a hand whose own middle lies further in toward the other thigh than
          // SEAT.inner of the thigh's half-width from its cloth's middle there is moved out, to that, so it rests on the
          // thigh and not down the gap between the two)
          if (tl > 1e-6 && S.inner != null) fwd.add(handOver(s, hip, ax, fwd));
          // (AND AGAIN: a point under a thigh's lowest in its cell, a finger hanging down beside the thigh, that the lift
          // brings up into the thigh, is lifted over it too: the lift worked out again from where it puts the hand, up to
          // SEAT.again times more)
          let lift = 0;
          for (let pass = 0; pass <= (S.again || 0); pass++) {
            let more = 0;
            for (const P of [hands, fore]) for (let i = 0; i < P.names.length; i++) {
              if (P.names[i].slice(-1) !== s) continue;
              at(P, i, v).add(fwd); v.y += lift; const h = top.get(Math.floor(v.x / C) * 4096 + Math.floor(v.z / C));
              if (h && v.y > h[0] && h[1] + S.clear - v.y > more) more = h[1] + S.clear - v.y;
            }
            if (!(more > 0) || lift >= S.most) break;
            lift += more;
          }
          if (lift > 0 || fwd.lengthSq() > 0) T = W0.clone().add(fwd).add(new THREE.Vector3(0, Math.min(lift, S.most), 0));
        } else {
          const sg = s === 'L' ? side : -side;
          T = W0.clone().add(new THREE.Vector3(centre.x + sg * D.apart / 2 - mid[s].x, D.up, D.forward || 0));
        }
        if (T) { reachArm(B, s, T, H); moved++; }
        for (const n of ['UpperArm' + s, 'LowerArm' + s, 'Wrist' + s]) (arm[n] = arm[n] || []).push(...B[n].quaternion.toArray());
      }
    }
    if (!moved) return src;
    const out = src.clone(); out.tracks = src.tracks.map((t) => {
      const bone = t.name.split('.')[0];
      return t.name.endsWith('.quaternion') && arm[bone] ? new THREE.QuaternionKeyframeTrack(t.name, times, arm[bone]) : t;
    });
    out.userData = { ...(src.userData || {}), seated: kind };
    return out;
  });
}
// THE WRISTS A PERSON'S (2026-11-17; the game's maker, of the work clips close up: "a wrist turned completely backwards
// on itself", "some kind of horrible disfigurement"). The Mathwood clips were made for mitten hands: the polishing, the
// forge, the hammer, sitting and driving turn the hand at the wrist itself by 35 to 180 degrees about the forearm's line
// and bend it up to 140 degrees, and the forearm one way while the wrist turns back the other (the polishing's right
// arm: 105 one way, 64 back). A real forearm does the turning along its length, and a wrist bends 70 to 80 degrees at
// most. On the crew a sleeve's cuff and the hand's stub inside it ride the forearm and the wrist together, so a wrist
// turned or bent that far tore the cuff into jagged bits with the hand showing past it. The crew's own copies of every
// clip (made here at load; Mathwood's files and people as they are), at every moment:
//   THE TURN about the forearm's line, the forearm's and the wrist's together, is shared: the wrist keeps at most
//     WRISTS.twist degrees of it, the forearm takes the rest up to WRISTS.forearm, and what is left past both is let go
//     (the hand turns less than the clip asks); the hand's turn in the world is otherwise as the clip has it;
//   THE BEND at the wrist (all of its turn but that) is held to WRISTS.bend degrees.
// A clip within all three keeps its tracks as they are (the walk, the run, the calm stand). lib.wrists (as WRISTS) tries
// other values, set before an outfit's clips are first fitted. (Tried at 30 and 75 first: the polishing's cuffs still
// broke at their top; at 20 and 55 the cuff stays whole on Ren and nearly so on the cook, the hand turned and bent as
// a person's can.)
export const WRISTS = { twist: 20, forearm: 70, bend: 55 };
const twistAbout = (q, a) => { let t = 2 * Math.atan2(q.x * a.x + q.y * a.y + q.z * a.z, q.w); if (t > Math.PI) t -= 2 * Math.PI; if (t <= -Math.PI) t += 2 * Math.PI; return t; };
function humanWrists(clips, scene, W = WRISTS) {
  if (!W) return clips;
  const bare = bareBones(scene); if (!bare) return clips;
  const { B } = bare, R = {};
  for (const s of ['L', 'R']) {
    const la = B['LowerArm' + s], wr = B['Wrist' + s]; if (!la || !wr) return clips;
    const b0 = wr.position.clone().normalize(), qw0 = wr.quaternion.clone();
    R[s] = { qf0: la.quaternion.clone(), qw0, b0, a: b0.clone().applyQuaternion(qw0.clone().invert()) };
  }
  const D = Math.PI / 180, TW = W.twist * D, FW = W.forearm * D, BEND = W.bend * D, clamp = (x, m) => Math.max(-m, Math.min(m, x));
  const qf = new THREE.Quaternion(), qw = new THREE.Quaternion(), d = new THREE.Quaternion(), tw = new THREE.Quaternion(), sw = new THREE.Quaternion(), I0 = new THREE.Quaternion();
  return clips.map((src) => {
    let tracks = null;
    for (const s of ['L', 'R']) {
      const T0 = tracks || src.tracks, fi = T0.findIndex((t) => t.name === 'LowerArm' + s + '.quaternion'), wi = T0.findIndex((t) => t.name === 'Wrist' + s + '.quaternion');
      if (fi < 0 || wi < 0) continue;
      const { qf0, qw0, b0, a } = R[s], If = T0[fi].createInterpolant(), Iw = T0[wi].createInterpolant();
      const times = [...new Set([...T0[fi].times, ...T0[wi].times])].sort((x, y) => x - y);
      // (each moment's two turns about the forearm's line, kept running on from the moment before (no jump of a whole
      // turn), and the wrist's bend)
      const F = [], Wq = [], th = [];
      let lf = null, lw = null, over = false;
      for (const t of times) {
        qf.fromArray(If.evaluate(t)).normalize(); qw.fromArray(Iw.evaluate(t)).normalize(); F.push(qf.clone()); Wq.push(qw.clone());
        let f = twistAbout(d.copy(qf0).invert().multiply(qf), b0), w = twistAbout(d.copy(qw0).invert().multiply(qw), a);
        if (lf != null) { while (f - lf > Math.PI) f -= 2 * Math.PI; while (f - lf < -Math.PI) f += 2 * Math.PI; while (w - lw > Math.PI) w -= 2 * Math.PI; while (w - lw < -Math.PI) w += 2 * Math.PI; }
        lf = f; lw = w; th.push([f, w]);
        d.copy(qw0).invert().multiply(qw); tw.set(a.x * (d.x * a.x + d.y * a.y + d.z * a.z), a.y * (d.x * a.x + d.y * a.y + d.z * a.z), a.z * (d.x * a.x + d.y * a.y + d.z * a.z), d.w).normalize();
        sw.copy(tw).invert().multiply(d);
        if (Math.abs(w) > TW || Math.abs(f) > FW || 2 * Math.acos(Math.min(1, Math.abs(sw.w))) > BEND) over = true;
      }
      if (!over) continue;
      const fv = [], wv = [], r = new THREE.Quaternion();
      times.forEach((t, k) => {
        const [f, w] = th[k], w2 = clamp(w, TW), f2 = clamp(f + (w - w2), FW), phi = f2 - f;
        const qa = F[k].clone().multiply(r.setFromAxisAngle(b0, phi));
        const qb = r.setFromAxisAngle(b0, -(w - w2)).clone().multiply(Wq[k]);
        // (the bend held: the wrist's turn from rest taken apart into its turn about the forearm's line and the bend left)
        d.copy(qw0).invert().multiply(qb); const p = d.x * a.x + d.y * a.y + d.z * a.z;
        tw.set(a.x * p, a.y * p, a.z * p, d.w).normalize(); sw.copy(tw).invert().multiply(d);
        if (sw.w < 0) sw.set(-sw.x, -sw.y, -sw.z, -sw.w);
        const ang = 2 * Math.acos(Math.min(1, sw.w));
        if (ang > BEND) { sw.copy(I0.identity().slerp(sw, BEND / ang)); qb.copy(qw0).multiply(tw).multiply(sw); }
        fv.push(...qa.toArray()); wv.push(...qb.normalize().toArray());
      });
      tracks = T0.map((t, k) => (k === fi ? new THREE.QuaternionKeyframeTrack(t.name, times, fv) : k === wi ? new THREE.QuaternionKeyframeTrack(t.name, times, wv) : t));
    }
    if (!tracks) return src;
    const out = src.clone(); out.tracks = tracks; out.userData = { ...(src.userData || {}), wrists: true };
    return out;
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
    // (THE SKIN'S LIMITS on the part: shine, shineMost, and how much of the texel's own colour (1: all, as made))
    crSkinLook: { value: new THREE.Vector3(SKIN_LIMIT.shine, SKIN_LIMIT.shineMost, 1) },
    crHair: { value: R('hair', 0x402010) }, crHairRef: { value: R('hair', 0x402010) }, crHairOwn: { value: 1 },
    crGlow: { value: refs && refs.glow != null ? refs.glow : 0.0 },
  };
}
function crewMaterial(src, kind, part, paint, atlas, freckles = null) {
  const m = src.clone(), refs = part && part.refs;
  const u = m.userData.crew = crewUniforms(refs);
  const has = part && part.masks ? part.masks : {};
  // (the Mathwood hair's strands: a hair part that carries them (crewPart.strands), with the strand atlas)
  const SL = kind === 'hair' && part && part.strands && atlas ? { ...HAIR_STRANDS, ...((part.strands && part.strands.look) || {}) } : null;
  if (SL) strandUniforms(u, SL, atlas);
  // (a plain hair mesh, not the Mathwood hair's strands: its shading normal leant out from the skull's centre, THE HAIR'S
  // UNDERSIDE; the skull's centre in its own frame set by makeCrew)
  const PB = kind === 'hair' && !SL && HAIR_UNDERSIDE.plain > 0;
  if (PB) { u.crStrandSkull = { value: new THREE.Vector3() }; u.crBend = { value: HAIR_UNDERSIDE.plain }; }
  // (paint on a head with skin: PAINTS and THE PAINT FIELD below (paintOf): the stubble's look (a hair's own changes to
  // PAINTS.stubble), the scalp shade's (to PAINTS.under), the buzz cut's hairline, the field, a hair's marks)
  const PT = paint && kind === 'head' && has.skin ? paint : null;
  if (PT) {
    const B = { ...PAINTS.stubble, ...(PT.buzzLook || {}) }, U = { ...PAINTS.under, ...(PT.underLook || {}) };
    u.crPaintMap = { value: PT.atlas.map }; u.crPaintTile = { value: new THREE.Vector3(...B.tile) };
    u.crBuzzLook = { value: new THREE.Vector4(B.mean, B.size, B.cover, B.soft) };
    u.crBuzzMore = { value: new THREE.Vector4(B.coarse, B.tone, B.shade, B.wander) };
    u.crUnderLook = { value: new THREE.Vector4(U.cover, U.coarse, U.tone, U.shade) };
    u.crPaintShow = { value: new THREE.Vector4(1, 1, 1, 0) };
    u.crField = { value: PT.field };
    if (PT.line) u.crLine = { value: lineSamples(PT.line) };
    u.crHeadFrame = { value: PT.frame };
    if (PT.marks) u.crMarkMap = { value: PT.marks };
    if (PT.colour) u.crHairRef.value.copy(lin(PT.colour));
    else if (PT.colourLinear) u.crHairRef.value.fromArray(PT.colourLinear);
    u.crHair.value.copy(u.crHairRef.value);
  }
  // (skin and hair: no sheen of the room's reflections; the painted face carries its own light and shade. A part that
  // gives its own skin roughness (crewPart.rough: the Tripo heads) wears it as it is)
  if (kind !== 'suit') { m.roughness = part && part.rough != null ? part.rough : Math.max(m.roughness, 0.78); m.envMapIntensity = 0.55; }
  // (the suit's generated normal map is busy, ripples where the plates are smooth: half strength)
  else if (m.normalMap) m.normalScale.set(0.5, 0.5);
  if (SL) { m.roughness = SL.rough; m.envMapIntensity = SL.env; }
  m.defines = { ...(m.defines || {}), [KIND_DEF[kind]]: '' };
  if (SL) Object.assign(m.defines, { CREW_STRANDS: '', CR_S_SCALE: STRAND_S.toFixed(3), CR_P_SCALE: STRAND_P.toFixed(3) });
  if (PB) m.defines.CREW_BEND = '';
  // (a suit's own mask texture: in the occlusion slot at strength 0, taken out of it as the masks)
  if (kind === 'suit' && has.tex === 'occlusion' && m.aoMap) { u.crMaskMap = { value: m.aoMap }; m.aoMap = null; m.defines.CREW_MASKTEX = ''; }
  else if (has.marks) m.defines.CREW_MARKS = '';
  if (!('CREW_MASKTEX' in m.defines)) { if (has.lines) m.defines.CREW_LINES = ''; if (has.panels) m.defines.CREW_PANELS = ''; }
  if (has.skin) m.defines.CREW_SKIN = '';
  // (FRECKLES, below: on a head with skin whose recipe asks for them; every other head's shader is as it was)
  const FK = freckles && kind === 'head' && has.skin ? freckles : null;
  if (FK) {
    m.defines.CREW_FRECKLES = '';
    u.crFrecFrame = { value: FK.frame }; u.crFrecAt = { value: new THREE.Vector4(...FK.at) }; u.crFreckles = { value: 1 };
    u.crFrecLook = { value: new THREE.Vector4(FRECKLES.cell, FRECKLES.dot[0], FRECKLES.dot[1], FRECKLES.share) }; u.crFrecTint = { value: new THREE.Vector4(...FRECKLES.tint, FRECKLES.depth) };
  }
  if (PT) {
    m.defines.CREW_PAINT = ''; m.defines.CR_SKULL = `vec3(${SKULL.map((v) => v.toFixed(4)).join(', ')})`;
    if (PT.line) { m.defines.CR_LINE = ''; m.defines.CR_LINE_N = LINE_N; }
    if (PT.marks) m.defines.CR_MARKS = '';
  }
  m.userData.crewOwnColours = !!(part && part.jobColours === false);
  // (A FACE PLATE, below: a head packed with a face layout on its painted plate (crewPart.face 'plate': the androids'))
  const FP = !!(part && part.kind === 'head' && part.face === 'plate');
  if (FP) {
    m.defines.CREW_FACE = '';
    m.userData.visor = { vsExpr: { value: 0 }, vsTime: { value: 0 }, vsGlow: { value: 1.5 }, vsCol: { value: new THREE.Color(VISOR_OWN) } };
    Object.assign(u, m.userData.visor, { crFaceAt: { value: new THREE.Vector4(0, 0, 1, 0) }, crFaceLook: { value: new THREE.Vector4(...PLATE_FACE.dark, 0, PLATE_FACE.rough) } });
  }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    if (FP) {
      sh.vertexShader = 'attribute vec2 crFace; varying vec2 vCrFace;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  vCrFace = crFace;`);
      sh.fragmentShader = 'varying vec2 vCrFace; uniform vec4 crFaceAt, crFaceLook;\n' + VISOR_GLSL + PLATE_GLSL + sh.fragmentShader;
    }
    if (PT) sh.vertexShader = 'uniform mat4 crHeadFrame; varying vec3 vCrHead; varying vec3 vCrHeadN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  vCrHead = (crHeadFrame * vec4(position, 1.0)).xyz; vCrHeadN = mat3(crHeadFrame) * normal;`);
    if (FK) sh.vertexShader = 'uniform mat4 crFrecFrame; varying vec3 vCrFrec;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  vCrFrec = (crFrecFrame * vec4(position, 1.0)).xyz;`);
    if (SL) sh.vertexShader = STRAND_VERTEX + sh.vertexShader.replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
  crStrandVertex();`);
    if (PB) sh.vertexShader = 'uniform vec3 crStrandSkull; varying vec3 vCrRadial;\n' + sh.vertexShader.replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
  {
    vec3 crR = position - crStrandSkull;
#ifdef USE_SKINNING
    crR = (skinMatrix * vec4(crR, 0.0)).xyz;
#endif
    vCrRadial = (modelViewMatrix * vec4(crR, 0.0)).xyz;
  }`);
    sh.fragmentShader = `uniform vec3 crMarks, crMarksRef, crLines, crLinesRef, crPanels, crPanelsRef, crWhites, crWhitesRef, crSkin, crSkinRef, crHair, crHairRef; uniform float crGlow, crHairOwn; uniform vec3 crSkinLook;
#ifdef CREW_MASKTEX
uniform sampler2D crMaskMap;
#endif
#ifdef CREW_PAINT
${PAINT_GLSL}
#endif
#ifdef CREW_STRANDS
${STRAND_GLSL}
#endif
#ifdef CREW_FRECKLES
${FRECKLE_GLSL}
#endif
float crLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// (a mask kept in an alpha channel between 4 and 255: lossy WebP drops the colour under a fully clear pixel)
float crA(float a) { return clamp((a * 255.0 - 4.0) / 251.0, 0.0, 1.0); }
// (a colour laid on as a shift from the part's own, scaled by how light this texel is against it)
vec3 crShift(vec3 c, vec3 to, vec3 ref, float m) { return max(c + (to - ref) * min(crLum(c) / max(crLum(ref), 1e-4), 2.5) * m, 0.0); }
` + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
  float crLineMask = 0.0;
#ifdef CREW_FACE
  // (on the plate's layout (every other face of the head lies at its corner (0, 1)), where his paint is dark)
  float crFaceOn = 0.0, crFaceLens = 0.0;
  #ifdef USE_MAP
  float crFaceIn = 1.0 - step(vCrFace.x, 0.001) * step(0.999, vCrFace.y);
  crFaceOn = crFaceIn * (1.0 - smoothstep(crFaceLook.x, crFaceLook.y, crLum(sampledDiffuseColor.rgb)));
  // (ONE EYE on a round lens (crFaceLook.z: the lens's radius, in the face's own measure): its middle made the eye's dark
  // glass, below, and the eye drawn there whatever the paint)
  if (crFaceLook.z > 0.0) crFaceLens = crFaceIn * (1.0 - smoothstep(crFaceLook.z * 0.85, crFaceLook.z, length((vCrFace - vec2(0.5) - vec2(crFaceAt.x, -crFaceAt.y)) / crFaceAt.z)));
  crFaceOn = max(crFaceOn, crFaceLens);
  #endif
#endif
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
    // (skin by ratios, not a shift: a darker tone darkens the painted face's own light and shade alike, where a shift
    // would take more red than blue out of the shadows and turn them green; the hands the same. THE SKIN'S LIMITS: the
    // tone times the texel's light against the part's mean, times crSkinLook.z of its own colour against the mean (1,
    // a part in its own skin: exactly as made); a texel lightened past crSkinLook.x eased toward .y, never darker than
    // it was painted, so a pale tone's painted highlights never run to white)
    {
      vec3 crC = diffuseColor.rgb, crR = max(crSkinRef, vec3(1e-4));
      float crL0 = crLum(crC), crLR = max(crLum(crR), 1e-4);
      vec3 crQ = clamp((crC / crR) * (crLR / max(crL0, 1e-4)), 0.25, 4.0);
      vec3 crO = crSkin * (crL0 / crLR) * pow(crQ, vec3(crSkinLook.z));
      float crL = crLum(crO), crK = crSkinLook.x, crM = crSkinLook.y;
      if (crL > crK && crL > crL0) crO *= max(crK + (crM - crK) * (1.0 - exp(-(crL - crK) / max(crM - crK, 1e-4))), crL0) / crL;
      diffuseColor.rgb = mix(crC, crO, crA(sampledDiffuseColor.a));
    }
  #endif
  #ifdef CREW_FRECKLES
    diffuseColor.rgb = mix(diffuseColor.rgb, crFreckled(diffuseColor.rgb), crA(sampledDiffuseColor.a));
  #endif
  #ifdef CREW_FACE
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.004, 0.005, 0.007), crFaceLens); crLineMask *= 1.0 - crFaceLens;
  #endif
  diffuseColor.a = opacity;
#endif
#ifdef CREW_HAIR
  #ifdef CREW_HAIR_LIGHT
  // (A HAIR COLOURED BY ITS OWN LIGHT AND DARK, below: the colour picked times this texel's lightness against the hair's
  // own mean, none of its own colour kept; in its own colour (crHairOwn 1) exactly as made)
  diffuseColor.rgb = mix(crHair * min(crLum(diffuseColor.rgb) / max(crLum(crHairRef), 1e-4), 2.5), diffuseColor.rgb, crHairOwn);
  #else
  diffuseColor.rgb = crShift(diffuseColor.rgb, crHair, crHairRef, 1.0);
  #endif
#endif
#ifdef CREW_STRANDS
  diffuseColor.rgb = crStrands(diffuseColor.rgb);
#endif
#ifdef CREW_PAINT
  diffuseColor.rgb = crPaint(diffuseColor.rgb);
#endif`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
#ifdef CREW_PAINT
  roughnessFactor = mix(roughnessFactor, 0.92, crPaintM);
#endif
#ifdef CREW_FACE
  roughnessFactor = mix(roughnessFactor, crFaceLook.w, crFaceOn);
#endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += crLines * crLineMask * crGlow;
#ifdef CREW_FACE
  totalEmissiveRadiance += vsCol * vsGlow * crPlateFace(vCrFace) * crFaceOn;
#endif`);
    if (PB) sh.fragmentShader = 'varying vec3 vCrRadial; uniform float crBend;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  normal = normalize(mix(normal, normalize(vCrRadial + 1e-6), crBend));`);
    if (SL) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + STRAND_NORMAL)
      .replace('#include <opaque_fragment>', STRAND_LIGHT + '\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'crew-2-' + Object.keys(m.defines).join('-');
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
// THE HAIR'S UNDERSIDE (2026-11-10; the game's maker, of Sol's side part: "the dark line at the top of his forehead that
// is caused I assume from the hair curling under", and "the answer to the hair might be to change the normals to point
// up so they don't show dark areas on the bottom? I think we did something like that for plants"). The line was the
// side part's front lip, where it curls under over the forehead: its underside faces down, away from the lamps, and
// counted as the hair's inside (darkened, no highlight), so it read as a dark band across the forehead; not the scalp's
// shade under the hair (off, the band stayed), not a cast shadow (off, it stayed), not the skin (no hair: no band).
// Now the card hair's shading normal is leant `bend` of the way toward the line out from the skull's centre (as the
// foliage's normals lean up), and its inside is judged by that normal, so a curl turning under lights as the hair's
// outside (0.8 flattened the hair's shape; 0.5 kept it); a plain hair mesh (a harvested or Tripo hair) is leant `plain`
// (its own curls carry their shape, and 0.5 washed them flat); the Mathwood hair has its strands' own `puff`.
// `inside`: how much of the card hair's darkening of its inner side is kept (1: all, as before).
export const HAIR_UNDERSIDE = { bend: 0.5, plain: 0.3, inside: 1 };
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
  // (THE HAIR'S UNDERSIDE: the skull's centre in the part's own frame (makeCrew sets it), how far the shading normal leans
  // out from it, and how much of the inside's darkening is kept)
  u.crStrandSkull = { value: new THREE.Vector3() }; u.crBend = { value: HAIR_UNDERSIDE.bend }; u.crInsideK = { value: HAIR_UNDERSIDE.inside };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute vec3 _strand; varying vec3 vCrStrand; uniform vec3 crStrandSkull; varying vec3 vCrRadial;\n' + sh.vertexShader.replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
  vec3 crS = _strand, crR = position - crStrandSkull;
#ifdef USE_SKINNING
  crS = (skinMatrix * vec4(crS, 0.0)).xyz; crR = (skinMatrix * vec4(crR, 0.0)).xyz;
#endif
  vCrStrand = normalize((modelViewMatrix * vec4(crS, 0.0)).xyz + 1e-6);
  vCrRadial = (modelViewMatrix * vec4(crR, 0.0)).xyz;`);
    sh.fragmentShader = `varying vec3 vCrStrand; varying vec3 vCrRadial; uniform float crBend, crInsideK;
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
  // (THE HAIR'S UNDERSIDE, 2026-11-10: by the normal leant crBend of the way out from the skull's centre, so a curl's
  // underside facing the eye from above the face counts as hair's outside; crInsideK of the darkening kept)
  vec3 crNg = normalize(mix(normalize(vNormal), normalize(vCrRadial + 1e-6), crBend));
  float crFacing = smoothstep(-0.12, -0.45, dot(crNg, normalize(vViewPosition)));
  float crInside = crInsideK * (vMapUv.y > 0.76 ? (gl_FrontFacing ? 0.0 : mix(1.0, crFacing, crBend)) : crFacing);
  diffuseColor.rgb *= 1.0 - 0.35 * crInside;`)
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace(/\n[^\n]*\*= faceDirection;/g, ''))
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  // (the shading normal, strands' relief and all, leant out from the skull's centre: the hair lights as one soft mass,
  // a curl's underside as its top)
  normal = normalize(mix(normal, normalize(vCrRadial + 1e-6), crBend));`)
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
  m.customProgramCacheKey = () => 'crew-hair-cards-4';
  return m;
}
// (the shadow a card hair casts: its strands' cut-out, not its cards' rectangles)
function hairDepthMaterial(atlas) {
  return new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas.map, alphaTest: 0.5, side: THREE.DoubleSide });
}

// ── the Mathwood hair's strands (2026-11-08) ─────────────────────────────────────────────────────────────────────────
// The game's maker: "Can you give the textures from Mathwood a hairlike texture? Right now they look cool, but kind of
// like plastic." Every Mathwood hair is built of locks (tubes of four-sided rings from a root to a tip) and the bob and
// long hair of a skull cap under them. Its build (~/pw/space-math/rigs/mathwood-hair/strands.mjs) writes into each
// vertex where it is on its lock: _strand (the strand's direction, root to tip; the cap: down from the crown), _flow (its
// share of the way round the lock, with the lock's first and last lines marked so the face across the wrap carries the
// strands on round without a seam; 0 weight at the tip, so the tip's faces run into it) and _hair (how far from the
// root, the lock's girth and length, how open the point is: 0 shut in by other locks). The hair's material
// (crewMaterial, CREW_STRANDS) is the part's own with, over the hair colour picked:
//   fine strands: the strand atlas's sheet tile (straight strands), `width` metres of hair across a repeat and `length`
//     along it, round each lock a whole number of repeats (its girth over `width`), so they run from root to tip and
//     close round it, light and dark `contrast` times the tile's own;
//   clumps: the atlas's stubble tile drawn out along the strands (`clumpWidth` across a repeat, `clumpLength` along),
//     streaks of every width, so the strands never stand evenly spaced like wood grain (`clumpContrast`);
//   darker roots (`rootDark`, gone `rootLen` metres along), the grooves' shade (`ao` of the openness), the shade
//   taking on the hair's own colour as it deepens (`deep`: a blond's shade golden brown, not olive), a little brightness
//   and warmth from lock to lock (`lockVar`), `gain` so it averages about the colour picked; each lock its own place in
//   the tiles (a number from its girth and length);
//   the shape's light: each point's normal leant toward the way out from the skull's centre, across the strands only
//     (`puff`; none along a spike that stands straight out), so the locks shade as one soft mass of hair instead of
//     carved four-sided sticks;
//   the light: rougher (`rough`, `env`), the smooth surface's own round highlight (`gloss` of it) and some of the room's
//     reflection (`envGloss`) taken off, the room's light on it taking the hair's own colour (`scatter`), and a strand
//     highlight (Kajiya-Kay, two lobes as the card hair's: `shift`, `exp`, `spec`) along each point's strand direction,
//     so it lies across the locks as a band and slides along them as the light and eye move, broken up by the strands
//     (`wobble`), tinted by the hair's colour (`tint`, more for light hair: white on blond read as paper); from the
//     directional lights, and `sky` of it from the hemisphere light above, so the back of the head has its sheen too;
//     seen at a glancing angle, toward the hair's outline, dimmed (`rim`), or the locks' edges glowed like paper's.
// The colour the shade takes on (`deep`, `scatter`) grows with how light the hair is (none for black or dark brown,
// whose shade only darkens; full from about a mid blond), as light bounces among light hair and hardly among dark; the
// strands' contrast eases a little on light hair (on blond it read as wood grain).
// A hair part without crewPart.strands (the card hair, the Tripo hair, the captain's braids) is drawn as before; this
// costs it nothing. A part can change any of these (crewPart.strands.look).
export const HAIR_STRANDS = {
  width: 0.006, length: 0.35, contrast: 0.6, clumpWidth: 0.03, clumpLength: 0.3, clumpContrast: 0.8, wobble: 0.15,
  rootDark: 0.3, rootLen: 0.035, ao: 0.4, deep: 0.8, scatter: 0.8, gain: 1.05, lockVar: 0.07, puff: 0.6,
  shift1: -0.07, shift2: 0.12, exp1: 50.0, exp2: 10.0, spec1: 0.13, spec2: 0.4, tint: 0.5, sky: 0.7, rim: 0.6, gloss: 0.9,
  envGloss: 0.75, rough: 0.9, env: 1.0,
};
// (_hair's distance along from the root and girth, stored over these many metres; the build's S_SCALE and P_SCALE)
export const STRAND_S = 0.5, STRAND_P = 1.0;
// (the strand atlas's sheet tile (straight strands) and stubble tile: u0, v0 and size in glTF's uv, and the mean, linear)
const STRAND_TILE = [0.046875, 0.796875, 0.15625, 0.5803], CLUMP_TILE = [0.546875, 0.796875, 0.15625, 0.3884];
function strandUniforms(u, L, atlas) {
  const V = (...a) => ({ value: new THREE.Vector4(...a) });
  Object.assign(u, {
    crStrandMap: { value: atlas.map }, crStrandTile: V(...STRAND_TILE), crStrandTile2: V(...CLUMP_TILE),
    crStrandLook: V(L.width, L.length, L.contrast, L.wobble), crStrandClump: V(L.clumpWidth, L.clumpLength, L.clumpContrast, L.lockVar),
    crStrandShade: V(L.rootDark, L.rootLen, L.puff, 0), crStrandDeep: V(L.ao, L.deep, L.scatter, L.gain),
    crStrandSpec: V(L.shift1, L.shift2, L.exp1, L.exp2), crStrandSpec2: V(L.spec1, L.spec2, L.sky, L.gloss),
    crStrandSpec3: V(L.envGloss, L.tint, L.rim, 0),
    // (the skull's centre in the part's own frame: makeCrew sets it from the hair mesh as bound)
    crStrandSkull: { value: new THREE.Vector3() },
  });
}
const STRAND_VERTEX = `attribute vec3 _strand; attribute vec4 _flow; attribute vec4 _hair; uniform vec3 crStrandSkull;
varying vec3 vCrStrand; varying vec3 vCrRadial; varying vec4 vCrFlow; varying vec4 vCrHairV;
#ifdef USE_SKINNING
#define CR_SKIN(v) v = (skinMatrix * vec4(v, 0.0)).xyz
#else
#define CR_SKIN(v)
#endif
#define crStrandVertex() { vec3 crS = _strand, crR = position - crStrandSkull; CR_SKIN(crS); CR_SKIN(crR); vCrStrand = normalize((modelViewMatrix * vec4(crS, 0.0)).xyz + 1e-6); vCrRadial = (modelViewMatrix * vec4(crR, 0.0)).xyz; vCrFlow = _flow; vCrHairV = _hair; }
`;
const STRAND_GLSL = `
uniform sampler2D crStrandMap;
uniform vec4 crStrandTile, crStrandTile2, crStrandLook, crStrandClump, crStrandShade, crStrandDeep, crStrandSpec, crStrandSpec2, crStrandSpec3;
varying vec3 vCrStrand; varying vec3 vCrRadial; varying vec4 vCrFlow; varying vec4 vCrHairV;
float crStrandG = 0.0;          // (this point's strands against the mean, -1 dark to 1 light: the highlight's wobble)
float crStrandO = 1.0;          // (how open it is, with the grooves' shade: the highlight's too)
vec3 crStrandHue = vec3(1.0);   // (the hair's own colour, its brightest channel 1)
float crStrandLight = 0.0;      // (how light the hair colour is: 0 dark brown and darker, 1 from about a mid blond)
// (a tile of the atlas at st (in repeats, unbroken across them), over its mean: its mip level from st itself, so the
// repeats leave no seams)
float crTileAt(vec4 T, vec2 st, vec2 gx, vec2 gy) {
  vec2 uv = T.xy + fract(st) * T.z;
#if __VERSION__ >= 300
  return textureGrad(crStrandMap, uv, gx * T.z, gy * T.z).r / T.w;
#else
  return texture2D(crStrandMap, uv).r / T.w;
#endif
}
// (a layer of strands: m repeats round the lock (whole, so the ring closes), along metres a repeat along it; the wrap's
// jump of m repeats is no change in the strands, so it's taken out of the mip level's rates)
float crLayer(vec4 T, float a, float s, float m, float along, vec2 off) {
  vec2 st = vec2(a * m + off.x, s / along + off.y), gx = dFdx(st), gy = dFdy(st);
  gx.x -= m * floor(gx.x / m + 0.5); gy.x -= m * floor(gy.x / m + 0.5);
  return crTileAt(T, st, gx, gy);
}
// (the two lobes of the strand highlight from one light)
vec3 crKK(vec3 L, vec3 lc, vec3 n, vec3 V, vec3 T1, vec3 T2, vec3 tint, vec3 diff) {
  vec3 H = normalize(L + V);
  float d1 = dot(T1, H), d2 = dot(T2, H);
  float s1 = pow(max(0.0, 1.0 - d1 * d1), 0.5 * crStrandSpec.z), s2 = pow(max(0.0, 1.0 - d2 * d2), 0.5 * crStrandSpec.w);
  return lc * smoothstep(-0.1, 0.5, dot(n, L)) * (s1 * crStrandSpec2.x * tint + s2 * crStrandSpec2.y * diff);
}
vec3 crStrands(vec3 col) {
  // (round the lock, 0 to 1: the wrap's face adds its first line's 1; the tip's faces divided by their ring's weight)
  float w = max(vCrFlow.w, 1e-3);
  float a = (vCrFlow.x + (vCrFlow.z > 1e-3 ? vCrFlow.y : 0.0)) / w;
  float s = vCrHairV.x * CR_S_SCALE, girth = vCrHairV.y * CR_P_SCALE, len = vCrHairV.z * CR_S_SCALE;
  float own = fract(sin(girth * 1271.3 + len * 3117.7) * 43758.5453);
  crStrandLight = smoothstep(0.03, 0.35, dot(crHair, vec3(0.2126, 0.7152, 0.0722)));
  float t = crLayer(crStrandTile, a, s, max(1.0, floor(girth / crStrandLook.x + 0.5)), crStrandLook.y, vec2(own * 17.0, own * 5.3));
  float c = crLayer(crStrandTile2, a, s, max(1.0, floor(girth / crStrandClump.x + 0.5)), crStrandClump.y, vec2(own * 7.0, own * 3.1));
  crStrandG = clamp(t - 1.0 + 0.5 * (c - 1.0), -1.0, 1.0);
  float ease = 1.0 - 0.3 * crStrandLight;
  float f = max(0.0, 1.0 + crStrandLook.z * ease * (t - 1.0)) * max(0.0, 1.0 + crStrandClump.z * ease * (c - 1.0));
  float root = mix(1.0 - crStrandShade.x, 1.0, smoothstep(0.0, crStrandShade.y, s));
  crStrandO = mix(1.0, vCrHairV.w, crStrandDeep.x);
  crStrandHue = col / max(max(col.r, max(col.g, col.b)), 1e-4);
  // (deeper is darker and, in light hair, more of its own colour: light that goes in among it comes out coloured)
  float d = root * crStrandO;
  vec3 deep = d * mix(vec3(1.0), crStrandHue, crStrandDeep.y * crStrandLight * (1.0 - d));
  float lock = 1.0 + crStrandClump.w * (own - 0.5) * 2.0;
  vec3 warm = vec3(1.0 + 0.06 * (own - 0.5), 1.0, 1.0 - 0.06 * (own - 0.5));
  return col * warm * deep * (f * lock * crStrandDeep.w);
}`;
// (the locks shaded as one soft mass: the normal leant toward the way out from the skull's centre, by as much of that way
// as lies across the strands)
const STRAND_NORMAL = `
  {
    vec3 crT0 = normalize(vCrStrand), crR = normalize(vCrRadial + 1e-6);
    normal = normalize(normal + (crR - crT0 * dot(crR, crT0)) * crStrandShade.z);
  }`;
const STRAND_LIGHT = `
  // (the smooth surface's own round highlight and some of the room's reflection taken off: they're the plastic; and
  // light that goes in among hair comes out coloured: the room's light on it takes the hair's own colour)
  outgoingLight -= reflectedLight.directSpecular * crStrandSpec2.w + reflectedLight.indirectSpecular * crStrandSpec3.x;
  outgoingLight += reflectedLight.indirectDiffuse * (pow(crStrandHue, vec3(crStrandDeep.z * crStrandLight)) - 1.0);
  {
    vec3 crT = normalize(vCrStrand - normal * dot(vCrStrand, normal) + 1e-6), crV = normalize(vViewPosition);
    float crWob = crStrandG * crStrandLook.w;
    vec3 crT1 = normalize(crT + normal * (crStrandSpec.x + crWob)), crT2 = normalize(crT + normal * (crStrandSpec.y + crWob));
    vec3 crTint = mix(vec3(1.0), crStrandHue, min(1.0, crStrandSpec3.y + 0.3 * crStrandLight)) * (1.0 + 0.5 * crStrandG), crHi = vec3(0.0);
#if NUM_DIR_LIGHTS > 0
    for (int i = 0; i < NUM_DIR_LIGHTS; i++) crHi += crKK(directionalLights[i].direction, directionalLights[i].color, normal, crV, crT1, crT2, crTint, diffuseColor.rgb);
#endif
#if NUM_HEMI_LIGHTS > 0
    // (the sky's light from above: a soft band too, so hair turned away from the lamps still has its sheen)
    for (int i = 0; i < NUM_HEMI_LIGHTS; i++) crHi += crStrandSpec2.z * crKK(hemisphereLights[i].direction, hemisphereLights[i].skyColor, normal, crV, crT1, crT2, crTint, diffuseColor.rgb);
#endif
    // (dimmed toward the outline, where it lit the locks' edges like paper's)
    outgoingLight += crHi * crStrandO * (1.0 - crStrandSpec3.z * (1.0 - smoothstep(0.0, 0.4, abs(dot(normal, crV)))));
  }`;

// ── FRECKLES (2026-11-19, the character maker; the game's maker, asked whether it should have eye colour and freckles:
// "Why not, people usually like customizing characters") ───────────────────────────────────────────────────────────
// A recipe's colours.freckles (1: on) lays freckles on the head's own skin, in the head's material, as the paint is: no
// new texture and no change to any head. They are small soft dots a shade darker and redder than the skin under them
// (so they suit every skin tone, and a head's own painted light and shade stay), scattered by a rule in the head's own
// frame, placed by the head's own eyes (the balls' places, measured from the eye mesh when the person is put together:
// their middle, their height and half the way between them, `e`): a band across the bridge of the nose and the cheeks,
// from a little under the eyes down to the nose's tip, fading out toward the ears, and a thinner sprinkle on the
// forehead. Only where the skin faces forward (never the sides of the head or the neck), and only on skin (the mask).
// A head with no eyes of its own (Vega's helmet) takes none. They ride the head as its skin does: the dots are worked
// out from each point's place at rest. Only a head whose recipe asks for them is given this shader.
// Two sizes together: a few big ones (3 to 4 mm: these are what shows on the title's small pictures, where a true
// freckle is less than a dot of the screen) and many small ones between them, fainter (what shows close up).
//   cell: the big dots' grid, in `e`s (an e is about 3 cm): one dot at most in each cell, placed anywhere in it (the
//   small ones' grid is half that); dot: the smallest and largest dot's radius, of a cell; share: how many cells have a
//   dot; tint: what the skin is multiplied by at a dot's middle; depth: how much of that is laid on (1: all)
// (2026-11-19, the game's maker, of the freckles: "The number is fine, but reduce the max size a bit": the largest
// dot's radius 0.26 -> 0.21 of a cell, so the biggest are about 4 mm across, not 5; the smallest, the cells and the
// share as they were)
export const FRECKLES = { cell: 0.34, dot: [0.16, 0.21], share: 0.62, tint: [0.52, 0.36, 0.28], depth: 0.9 };
const FRECKLE_GLSL = `
uniform vec4 crFrecAt, crFrecLook, crFrecTint; uniform float crFreckles;
varying vec3 vCrFrec;
float crFrecHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// (one layer of dots: q in e's, on a grid of cell c turned a little (so no row of dots runs level), shifted by o)
float crFrecDots(vec2 q, float c, float o, float share) {
  float ca = cos(0.5 + o), sa = sin(0.5 + o);
  vec2 g = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y) / c + o, id = floor(g), f = fract(g);
  vec2 at = 0.27 + 0.46 * vec2(crFrecHash(id + 3.1 + o), crFrecHash(id + 7.7 + o));
  float r = mix(crFrecLook.y, crFrecLook.z, crFrecHash(id + 11.3 + o));
  return step(1.0 - share, crFrecHash(id + o)) * (1.0 - smoothstep(r * 0.6, r, length(f - at)));
}
vec3 crFreckled(vec3 skin) {
  float e = max(crFrecAt.w, 1e-4);
  // (across from the middle of the face, up from the eyes' line, forward from the eyes' depth: all in e's)
  vec3 q = vec3((vCrFrec.x - crFrecAt.x) / e, (vCrFrec.y - crFrecAt.y) / e, (vCrFrec.z - crFrecAt.z) / e);
  float ax = abs(q.x);
  // the band over the nose and cheeks: under the eyes (higher on the bridge of the nose, between them), down to the nose's tip
  float top = mix(-0.2, -0.62, smoothstep(0.3, 0.75, ax));
  float band = (1.0 - smoothstep(top - 0.28, top, q.y)) * smoothstep(-1.75, -1.4, q.y) * (1.0 - smoothstep(1.45, 2.35, ax));
  // a thinner sprinkle on the forehead, over the brows
  float brow = 0.4 * smoothstep(0.85, 1.15, q.y) * (1.0 - smoothstep(1.7, 2.3, q.y)) * (1.0 - smoothstep(1.2, 2.0, ax));
  // (only the front of the face: nothing behind the eyes' own depth by more than an e and a half)
  float m = max(band, brow) * smoothstep(-1.9, -1.0, q.z);
  if (m <= 0.001) return skin;
  float d = max(crFrecDots(q.xy, crFrecLook.x, 0.0, crFrecLook.w), 0.5 * crFrecDots(q.xy, crFrecLook.x * 0.5, 5.3, crFrecLook.w));
  return mix(skin, skin * crFrecTint.rgb, d * m * crFrecTint.a * crFreckles);
}`;

// ── paint: stubble on the head's own skin (the buzz cut, and the scalp's shade under a hair with a line) ────────────
// A hair entry with `paint` (crew.json: the name of one of PAINTS, and its own `colour`) has no mesh: it is a layer in
// the HEAD's material, so no gap or edge can show. The stubble is the shared strand atlas's stubble patch (its repeating
// tile), tinted by the hair colour, laid on by three flat projections in the head's own frame (the Head bone's, from the
// head's points as bound: it sits still on the skin through every clip and needs none of the head's own UVs, so any
// head takes it), cut by a hairline defined round the standard skull's centre (SKULL: elevation by azimuth, degrees, as
// the Blender styles' hairlines are), so one mask fits every head on the standard skull. The same tile looked up again
// 4.3 times larger gives patches of thicker and thinner stubble, which still read at a few metres where the fine strands
// have blurred to a tint, and break the hairline up so it is never a clean curve; the line also wanders (`wander`),
// arcs over each ear (and each head's own ears are cut out of it: THE PAINT FIELD) and fades over `soft` degrees; the scalp shows through where the
// strands are dark (`cover` at most) and is shaded a little under them (`shade`); `tone` scales the hair's colour.
// A hairline is elevations by azimuth, either side alike (azimuths 0 to 180), or ALL ROUND (2026-11-07: azimuths -180 to
// 180, 90 their left; a table with a negative azimuth is read so): a hair that isn't the same both sides has a line of
// its own each side.
// BOTH (2026-11-07, the pink side-swept hair): a hair entry with a `file` AND a `paint` wears its mesh and the paint
// together: with `marks` (a texture in the assets folder, laid round the standard skull's centre: azimuth -180 to 180
// across, elevation 90 at the top down to -90; its lower half's alpha the stubble's density (a shaved side's fade, taken
// from his bust); its upper half once held painted lines, no longer drawn: 2026-11-08, "You don't have to include
// glowing marks and stuff with the haircut", and the textures now carry none), the stubble on a shaved side, on the
// head's own skin so it suits every skin tone. The stubble takes the hair colour picked (as the buzz cut's).
// EACH HAIRCUT ITS OWN BUZZ, NEVER ON THE EARS (2026-11-08): a hair's paint is two layers on the head's skin, both cut
// round the ears, laid out by THE PAINT FIELD (below) from crew.json:
//   the BUZZ (PAINTS.stubble's look, a hair's `buzz.look` changing it): the short hair a barber leaves outside that
//     cut's edge: the buzz cut's own hairline (`line`, PAINTS.stubble.line unless the entry gives one), a harvested
//     hair's `marks` (his bust's own fade and shaved sides), or a hair's `buzz` { sideburns, nape } (THE PAINT FIELD);
//     none where the cut leaves none, so nothing shows past the hair that a barber wouldn't leave;
//   the scalp's SHADE under the hair (PAINTS.under's look, `scalp.look` changing it): a dark shade of the hair's colour
//     in the footprint of `scalp.line`, so a gap under the hair reads as hair and its shadow. The line is measured from
//     the hair itself (buzzdata, ~/pw/space-math/rigs/crew-buzz/): UNDER_MARGIN (4 mm) INSIDE the hair's edge all
//     round, so the shade never shows past it as a band; `scalp.edge` is the edge itself.
// (Before, a hair's whole scalp line was painted, and it reached past the hair: crew 1's swept hair showed a band of
// stubble in front of and above his ears, and on them.)
//   tile [u0, v0, size]: the atlas's stubble tile (glTF's uv); mean: its mean grey (the tint is the colour over it);
//   size: metres a tile on the head; coarse: how much the large patches thin and thicken it
export const PAINTS = {
  stubble: {
    tile: [0.546875, 0.796875, 0.15625], mean: 0.3884, size: 0.022, cover: 0.64, soft: 3.0, coarse: 1.4, tone: 1.0, shade: 0.12, wander: 1.0,
    line: [[0, 31], [20, 30], [40, 25], [55, 14], [63, 0], [70, -6], [78, -9], [84, -7], [88, -3], [92, 4], [97, 8], [104, 9], [110, 7], [114, 3],
      [118, -3], [124, -13], [132, -25], [145, -36], [160, -41], [180, -43]],
  },
  // (the shade comes in over `soft` degrees above its line, never below it)
  under: { cover: 0.75, soft: 2.0, coarse: 0.4, tone: 0.45, shade: 0.35 },
};
const LINE_N = 49;        // (a hairline as 49 elevations, 7.5 degrees apart all round, -180 (the nape, their right) to 180)
// (a hairline's elevation at an azimuth; a table either side alike (no negative azimuth) is read at the azimuth's size)
export function lineAt(T, a) {
  if (!T.some((p) => p[0] < 0)) a = Math.abs(a);
  if (a <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (a <= T[i][0]) return T[i - 1][1] + (T[i][1] - T[i - 1][1]) * (a - T[i - 1][0]) / Math.max(T[i][0] - T[i - 1][0], 1e-6);
  return T[T.length - 1][1];
}
function lineSamples(T) { return Array.from({ length: LINE_N }, (_, i) => new THREE.Vector2(-180 + i * 7.5, lineAt(T, -180 + i * 7.5))); }

// THE PAINT FIELD (2026-11-08): each person with paint carries one small texture laid round the standard skull's centre
// as the marks are (azimuth -180 to 180 across, 90 their left; elevation 90 at the top down to -90; a degree a texel),
// made when the person is put together, from crew.json alone:
//   r  the hair's own BUZZ (its `buzz`; the Crew Lab's lib.buzzes while he edits one):
//        sideburns  a strip just in front of each ear (SIDEBURN.width degrees wide, its back at the ear's clear margin),
//                   from SIDEBURN.under degrees in under the hair's edge down to `sideburns` mm below the top of that ear (0: level with it; less than
//                   0: higher); its foot soft over SIDEBURN.soft degrees. Left out (or null): none.
//        width      (2026-11-15) the sideburns' width front to back, mm (left out: SIDEBURN.width degrees, about 17 mm)
//        around     (2026-11-15; the game's maker, of crew 1's hair: "a really weird sideburn ... skinny and narrow")
//                   'over': the sideburn carries on round the ear, up over its top (OVER.up of the width above it, or
//                   to under the hair's edge if that's higher) and down behind it (OVER.behind of the width past the
//                   ear's back), its foot as the sideburns' all the way; left out: stops in front of the ear, as before
//        temple     (2026-11-17; the game's maker, a line drawn on three heads: "a control to get the sideburns to curve
//                   forward like this") how far forward, mm, the sideburn's front edge has swept by the time it reaches
//                   the hair's edge: straight for the lowest TEMPLE.from of its height, then leaning forward in one
//                   smooth curve to meet the hairline at the temple (above the sideburn's own top, straight up at its
//                   furthest forward to in under the hair's edge there). Left out or 0: a straight front edge, as before
//        nape       a taper at the back: from in under the hair's edge (scalp.edge) down `nape` mm below it, fading out downward, round to
//                   behind the ears (full from NAPE.full degrees round from the face, none nearer it than NAPE.from).
//        front      a hairline along the forehead (2026-11-10; the game's maker, of Ren's crop: "needs to be sunk into
//                   his head better along the forehead, it looks really choppy"): the same taper as the nape's, from in
//                   under the hair's edge down `front` mm below it, fading out downward, across the face (full to
//                   FRONT.full degrees round from the face, none past FRONT.to), so a cut-out edge of hair reads as
//                   growing out of the scalp, short hair thinning out below it.
//   g  the scalp's SHADE under the hair: 0 below `scalp.line`, full UNDER_SOFT degrees above it
//   b  the EARS: 1 on each ear and a margin round it (the head's crew.json `ears`, measured from its own geometry by
//      buzzdata: where the head stands out from its smooth outline at the sides, grown by EAR_MARGIN; crew.json's `ears`
//      for a head without its own: every head's together). Every paint is taken off there: the buzz, the shade, the buzz
//      cut, a hair's marks.
// A millimetre on the head is taken as on the standard skull (MM_DEG millimetres a degree).
export const SIDEBURN = { width: 11, soft: 1.5, under: 5 }, TEMPLE = { from: 0.3 }, OVER = { up: 0.8, behind: 0.7 }, NAPE = { from: 112, full: 140 }, FRONT = { full: 55, to: 80 }, UNDER_SOFT = 2.0, EAR_SOFT = 1.5;
const MM_DEG = 0.09 * Math.PI / 180 * 1000, FW = 360, FH = 180;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// (an ear's table [[azimuth, bottom, top], ...] each 2 degrees (azimuths their side's own, 0 to 180), grown by the margin:
// the bottom and top at an azimuth, null off the ear)
function earAt(tab, a) {
  if (!tab || !tab.length || a < tab[0][0] - 1 || a > tab[tab.length - 1][0] + 1) return null;
  if (a <= tab[0][0]) return [tab[0][1], tab[0][2], 1 - (tab[0][0] - a)];
  for (let i = 1; i < tab.length; i++) if (a <= tab[i][0]) { const t = (a - tab[i - 1][0]) / Math.max(tab[i][0] - tab[i - 1][0], 1e-6); return [tab[i - 1][1] + (tab[i][1] - tab[i - 1][1]) * t, tab[i - 1][2] + (tab[i][2] - tab[i - 1][2]) * t, 1]; }
  const L = tab[tab.length - 1]; return [L[1], L[2], 1 - (a - L[0])];
}
// the field's texels (Uint8 RGBA, FW x FH) for a hair entry (HE), its buzz and a head's ears; into `data` when given
export function paintField(HE, buzz, ears, data) {
  const D = data || new Uint8Array(FW * FH * 4), sc = HE && HE.scalp, under = sc && sc.line, edge = sc && (sc.edge || sc.line);
  const B = buzz || {}, sb = B.sideburns != null && Number.isFinite(+B.sideburns) ? +B.sideburns : null, nape = +B.nape > 0 ? +B.nape : 0, fr = +B.front > 0 ? +B.front : 0;
  const sbW = +B.width > 0 ? +B.width / MM_DEG : SIDEBURN.width, over = B.around === 'over';
  // (a sideburn given a width or carried round the ear fades out at its edges as a barber's taper does, a third of its width)
  const sSoft = over || +B.width > 0 ? Math.max(SIDEBURN.soft, sbW / 3) : SIDEBURN.soft;
  // (each side's ear: its own front and top; the sideburn's strip in front of it)
  const side = { L: ears && ears.L, R: ears && ears.R };
  // (the temple's sweep, degrees forward at the hair's edge; and on each side the height it is measured against: the
  // sideburn's own top, in under the hair's edge at the ear's front)
  const tmp = sb != null && +B.temple > 0 ? +B.temple / MM_DEG : 0;
  const topOf = (S, sign) => (tmp && edge && S && S.front != null ? lineAt(edge, sign * (S.tab && S.tab.length ? S.tab[0][0] + 1 : S.front)) + SIDEBURN.under : null);
  const tTop = { L: topOf(side.L, 1), R: topOf(side.R, -1) };
  for (let j = 0; j < FW; j++) {
    const az = -180 + j + 0.5, S = az >= 0 ? side.L : side.R, sa = Math.abs(az);
    const uLine = under ? lineAt(under, az) : 999, eLine = edge ? lineAt(edge, az) : 999;
    // (the sideburn's strip: how much of it at this azimuth, and its foot; its back at the front of the ear's clear margin,
    // its top SIDEBURN.under degrees in under the hair's edge)
    let sw = 0, foot = 999, sTop = eLine + SIDEBURN.under, tFront = null, tBack = 0, tH = 0;
    const ear = S && S.tab ? earAt(S.tab, sa) : null;
    if (sb != null && S && S.front != null) {
      const back = S.tab && S.tab.length ? S.tab[0][0] + 1 : S.front, front = back - sbW;
      // (over: on past the ear's back by OVER.behind of the width, and up over the ear's top by OVER.up of it)
      const end = over ? (S.tab && S.tab.length ? S.tab[S.tab.length - 1][0] - 1 : back + 20) + sbW * OVER.behind : back;
      sw = sstep(front, front + sSoft, sa) * (1 - sstep(end - sSoft, end, sa));
      foot = S.top - sb / MM_DEG;
      if (over) sTop = Math.max(sTop, (ear ? ear[1] : S.top) + sbW * OVER.up);
      // (the temple: in the columns its sweep can reach, the strip's front edge is worked out at each height, below)
      const tt = az >= 0 ? tTop.L : tTop.R;
      if (tmp && tt != null && tt > foot && sa > front - tmp - sSoft && sa < front + sSoft) { tFront = front; tBack = 1 - sstep(end - sSoft, end, sa); tH = tt - foot; }
    }
    const nw = nape ? sstep(NAPE.from, NAPE.full, sa) : 0, nFoot = eLine - nape / MM_DEG;
    const fw = fr ? 1 - sstep(FRONT.full, FRONT.to, sa) : 0, fFoot = eLine - fr / MM_DEG;
    for (let i = 0; i < FH; i++) {
      const el = 90 - i - 0.5, o = (i * FW + j) * 4;
      let r = 0, s = sw;
      if (tFront != null) { const f = tFront - tmp * sstep(TEMPLE.from, 1, (el - foot) / tH); s = sstep(f, f + sSoft, sa) * tBack; }
      if (s > 0) r = Math.max(r, s * sstep(foot - sSoft / 2, foot + sSoft / 2, el) * (1 - sstep(sTop - 2, sTop, el)));
      if (nw > 0 && eLine < 90) r = Math.max(r, nw * (el >= eLine ? 1 - sstep(eLine + SIDEBURN.under - 2, eLine + SIDEBURN.under, el) : Math.min(1, Math.max(0, (el - nFoot) / Math.max(eLine - nFoot, 1e-3)))));
      if (fw > 0 && eLine < 90) r = Math.max(r, fw * (el >= eLine ? 1 - sstep(eLine + SIDEBURN.under - 2, eLine + SIDEBURN.under, el) : Math.min(1, Math.max(0, (el - fFoot) / Math.max(eLine - fFoot, 1e-3))) ** 1.5));
      const g = sstep(uLine, uLine + UNDER_SOFT, el);
      const b = ear ? ear[2] * sstep(ear[0] - EAR_SOFT, ear[0], el) * (1 - sstep(ear[1], ear[1] + EAR_SOFT, el)) : 0;
      D[o] = Math.round(255 * r); D[o + 1] = Math.round(255 * g); D[o + 2] = Math.round(255 * Math.max(0, Math.min(1, b))); D[o + 3] = 255;
    }
  }
  return D;
}
function fieldTexture(D) {
  const t = new THREE.DataTexture(D, FW, FH, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  return t;
}
// a person's paint (on its head), from its hair entry: null when the hair paints nothing. The buzz cut (a paint with no
// mesh): its hairline and look; a hair with a mesh: its marks, its buzz, its shade
function paintOf(HE, buzz, ears, { atlas, marks, frame, hairRefs }) {
  const sc = HE.scalp && HE.scalp.line ? HE.scalp : null, cut = !!(HE.paint && PAINTS[HE.paint] && !HE.file);
  if (!cut && !sc && !(HE.paint && marks)) return null;
  const field = fieldTexture(paintField(HE, buzz, ears));
  // (a hair with a mesh and paint (BOTH) whose scalp.look was its stubble's look before its own buzz.look)
  const buzzLook = { ...((buzz && buzz.look) || (HE.file && HE.paint && sc && sc.look) || {}) };
  return { atlas, frame, marks: HE.paint ? marks : null, field, line: cut ? (HE.line || PAINTS[HE.paint].line) : null,
    buzzLook, underLook: sc && !(HE.file && HE.paint && !(buzz && buzz.look)) ? sc.look : null,
    colour: HE.colour || null, colourLinear: HE.colour ? null : ((hairRefs || {}).refs || {}).hair };
}
const PAINT_GLSL = `
uniform sampler2D crPaintMap, crField; uniform vec3 crPaintTile; uniform vec4 crBuzzLook, crBuzzMore, crUnderLook, crPaintShow;
#ifdef CR_LINE
uniform vec2 crLine[CR_LINE_N];
#endif
#ifdef CR_MARKS
uniform sampler2D crMarkMap;
#endif
varying vec3 vCrHead; varying vec3 vCrHeadN;
#ifdef CR_LINE
// (the hairline's elevation at an azimuth from the face (-180 to 180, 90 their left))
float crLineAt(float a) {
  for (int i = 1; i < CR_LINE_N; i++) {
    if (a <= crLine[i].x) return mix(crLine[i - 1].y, crLine[i].y, clamp((a - crLine[i - 1].x) / max(crLine[i].x - crLine[i - 1].x, 1e-3), 0.0, 1.0));
  }
  return crLine[CR_LINE_N - 1].y;
}
#endif
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
  vec3 P = vCrHead / crBuzzLook.y, Px = dFdx(P), Py = dFdy(P);
  float s = crTri(P, Px, Py, w);
  // (the large patches: the same tile 4.3 times larger and shifted, about 1 on average)
  float k = 0.233; vec3 Q = P * k + vec3(0.37, 0.11, 0.73);
  float c = crTri(Q, Px * k, Py * k, w) / crBuzzLook.x;
  // (THE PAINT FIELD: r the hair's own buzz, g the scalp's shade, b the ears; azimuth across, wrapping round)
  vec4 F = texture2D(crField, vec2(az / 360.0 + 0.5, clamp((90.0 - el) / 180.0, 0.0, 1.0)));
  float clear = 1.0 - F.b;
  float mB = F.r;
#ifdef CR_LINE
  // (the buzz cut's hairline, wandering)
  float line = crLineAt(az) + crBuzzMore.w * (0.8 * sin(ar * 7.0) + 0.5 * sin(ar * 17.0 + 1.3) + 0.35 * sin(ar * 29.0 + 0.4) + 1.6 * (c - 1.0));
  mB = max(mB, smoothstep(line - 0.3 * crBuzzLook.w, line + crBuzzLook.w, el));
#endif
#ifdef CR_MARKS
  // (a shaved side's marks (BOTH, above), round the skull's centre: the stubble's density in the lower half's alpha;
  // glTF's layout, no flip: the image's top at v 0. The upper half's painted lines are not drawn (2026-11-08: a haircut's
  // paint is its stubble only; the marks no longer carry any))
  float mv = clamp((90.0 - el) / 180.0, 0.002, 0.998) * 0.5, mu = az / 360.0 + 0.5;
  // (NO LINE DOWN THE BACK, 2026-11-17; the game's maker: "a line right down the middle that flickers". The azimuth jumps
  // from 180 to -180 down the back of the head, and across that jump the lookup's own slope is huge, so the picture's
  // smallest copy was read there: a thin line of its average. The slope is taken from the same place counted the other
  // way round instead (mw: its jump is at the face), whichever of the two has no jump here)
  float mw = fract(mu + 0.5) - 0.5;
  vec2 mA = vec2(mu, 0.5 + mv), mW = vec2(mw, 0.5 + mv);
  vec2 mAx = dFdx(mA), mAy = dFdy(mA), mWx = dFdx(mW), mWy = dFdy(mW);
  bool mBack = abs(mAx.x) + abs(mAy.x) > abs(mWx.x) + abs(mWy.x);
#if __VERSION__ >= 300
  mB = max(mB, textureGrad(crMarkMap, mA, mBack ? mWx : mAx, mBack ? mWy : mAy).a);
#else
  mB = max(mB, texture2D(crMarkMap, mBack ? mW : mA).a);
#endif
#endif
  // (never on the ears; each layer shown unless the lab's view takes it off)
  mB *= clear * crPaintShow.x;
  float mU = F.g * clear * crPaintShow.y;
  float sc = smoothstep(0.06, 0.45, s), st = s / crBuzzLook.x;
  // the buzz: stubble, the scalp showing through where the strands are dark and shaded a little under them
  float dB = mB * clamp(1.0 + crBuzzMore.x * (c - 1.0), 0.15, 1.4);
  vec3 col = mix(skin * (1.0 - crBuzzMore.z * mB), crHair * crBuzzMore.y * st, clamp(crBuzzLook.z * dB * sc, 0.0, 1.0));
  // the scalp's shade under the hair, over it
  float dU = mU * clamp(1.0 + crUnderLook.y * (c - 1.0), 0.15, 1.4);
  col = mix(col * (1.0 - crUnderLook.w * mU), crHair * crUnderLook.z * st, clamp(crUnderLook.x * dU * sc, 0.0, 1.0));
  crPaintM = max(mB, mU);
  // (the lab's view of the ears found: tinted)
  col = mix(col, vec3(0.85, 0.12, 0.55), 0.6 * F.b * crPaintShow.w);
  return col;
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
const VISOR_OWN = 0x35f2e4;      // the colour a visor's face glows in when no eye colour is given
// A FACE PLATE (2026-11-19, the game's maker's six androids: "It would be great to have faces on the ones that have
// fave plates. There's at least one that has a circle where their face is. So Im not sure about that one. But you can
// try something"). An android's face plate is part of its head as he painted it (not cut out as glass: cut by whole
// faces its edge was a saw of white teeth); the head part carries a second layout over the plate (crewPart.face 'plate',
// rigs/crew-rig/parts.py face_layout: seen from the front as a visor's is), and the head's own material draws the
// visor's faces and expressions there (vsFace), glowing in the eye colour, only where his paint is dark (PLATE_FACE.dark:
// the texel's lightness, fully dark below the first, none above the second), the plate a little glossier there
// (PLATE_FACE.rough). crew.json's head entry `plateFace` places it: at [x, y] (the face's middle moved, in the layout's
// width: + to the head's left and up), size (1: as a visor's), eye (true: ONE EYE, for a plate that is one round lens:
// a round eye that blinks, a happy arc, the turning ring of dots, a wide ring), lens (the lens's middle, out to that
// radius in the face's own measure, taken as the eye's dark glass: his painted pupil gives way to the drawn eye).
//   THE ONE EYE'S HAPPY ARC A SMILE (2026-11-20; the game's maker, of the heavy android's one eye: "Shouldn't the happy be
// on the bottom side like a smile?"): the arc is the bottom of its circle (a U), where it was the top (an upside-down
// U, as the two-eyed faces close their eyes); the same circle and length, turned over about the lens's middle. The
// two-eyed faces (vsFace) keep their closed-eye arcs over a smile.
const PLATE_FACE = { dark: [0.03, 0.09], rough: 0.16 };
const PLATE_GLSL = `
float vsEye(vec2 uv) {
  vec2 p = vec2(uv.x - 0.5, 0.5 - uv.y);
  float d = 1e3;
  if (vsExpr == 1) d = vsArc(p, vec2(0.0, 0.05), 0.13, -2.69, -0.45);
  else if (vsExpr == 2) {
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7853982 + vsTime * 3.0;
      d = min(d, length(p - 0.13 * vec2(cos(a), sin(a))) - (0.008 + 0.016 * float(i) / 7.0));
    }
  } else if (vsExpr == 3) d = min(abs(length(p) - 0.17), length(p) - 0.04);
  else {
    float b = fract(vsTime / 4.3); b = 1.0 - smoothstep(0.0, 0.025, b) * (1.0 - smoothstep(0.035, 0.06, b));
    d = length(vec2(p.x, p.y / max(b, 0.12))) - 0.09;
  }
  float w = 0.024;
  return (1.0 - smoothstep(w * 0.55, w, d)) + 0.22 * exp(-max(d - w, 0.0) * 34.0);
}
float crPlateFace(vec2 uv) {
  vec2 q = vec2(0.5) + (uv - vec2(0.5) - vec2(crFaceAt.x, -crFaceAt.y)) / crFaceAt.z;
  return crFaceAt.w > 0.5 ? vsEye(q) : vsFace(q);
}
`;
function visorMaterial(src) {
  const m = new THREE.MeshStandardMaterial({ name: 'visor', color: 0x05070a, roughness: 0.14, metalness: 0.0, envMapIntensity: 1.3 });
  const u = m.userData.visor = { vsExpr: { value: 0 }, vsTime: { value: 0 }, vsGlow: { value: 1.5 }, vsCol: { value: new THREE.Color(VISOR_OWN) } };
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
// `turn` (radians round the bone's own x, y, z) turns a bone, `default` is the value a recipe that doesn't set the slider
// gets. THE SMILE at 1: the mouth's corners 4.5 mm up, 0.7 mm back and 0.5 mm out, the cheeks 1.2 mm up, the lower lids
// turned 4 degrees up round the balls (their edge about 0.85 mm); worn at `default` (two thirds of that: the corners 3 mm up).
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
  smile: { name: 'Smile', default: 0.67, bones: { MouthL: { move: [0.0005, 0.0045, -0.0007] }, MouthR: { move: [-0.0005, 0.0045, -0.0007] },
    CheekL: { move: [0, 0.0012, 0] }, CheekR: { move: [0, 0.0012, 0] }, LowerLidL: { turn: [-0.07, 0, 0] }, LowerLidR: { turn: [-0.07, 0, 0] } } },
};
// the face bones a person has, at rest; and the sliders whose bones they all are
function faceRig(bones) {
  const rest = {};
  for (const S of Object.values(FACE)) for (const b of Object.keys(S.bones)) if (bones[b] && !rest[b]) rest[b] = { p: bones[b].position.clone(), s: bones[b].scale.clone(), q: bones[b].quaternion.clone() };
  const sliders = Object.keys(FACE).filter((k) => Object.keys(FACE[k].bones).every((b) => rest[b]) && Object.keys(FACE[k].bones).some((b) => !/^Eye[LR]$/.test(b)));
  return { rest, sliders };
}
const _faceQ = new THREE.Quaternion(), _faceE = new THREE.Euler();
function applyFace(bones, rig, values = {}) {
  for (const [b, r] of Object.entries(rig.rest)) { bones[b].position.copy(r.p); bones[b].scale.copy(r.s); bones[b].quaternion.copy(r.q); }
  for (const k of rig.sliders) {
    const v = Math.max(-1, Math.min(1, +(values[k] != null ? values[k] : FACE[k].default) || 0)); if (!v) continue;
    for (const [b, e] of Object.entries(FACE[k].bones)) {
      const B = bones[b];
      if (e.move) B.position.set(B.position.x + e.move[0] * v, B.position.y + e.move[1] * v, B.position.z + e.move[2] * v);
      if (e.scale) B.scale.set(B.scale.x * (1 + e.scale[0] * v), B.scale.y * (1 + e.scale[1] * v), B.scale.z * (1 + e.scale[2] * v));
      if (e.turn) B.quaternion.multiply(_faceQ.setFromEuler(_faceE.set(e.turn[0] * v, e.turn[1] * v, e.turn[2] * v)));
    }
  }
}

function setColours(mats, { job, uniform, skin, hair, eyes, freckles } = {}) {
  for (const m of mats) {
    if (m.userData.eye) { const e = m.userData.eye; e.crIris.value.copy(eyes ? lin(eyes) : e.crIrisOwn.value); }
    const u = m.userData.crew; if (!u) continue;
    // (a suit that keeps its own colours takes no job's: its marks, lines and panels as made)
    const J = (!m.userData.crewOwnColours && JOBS[job]) || JOBS.explorer;
    for (const k of ['marks', 'lines', 'panels']) { const key = 'cr' + k[0].toUpperCase() + k.slice(1); u[key].value.copy(J[k] ? lin(J[k]) : u[key + 'Ref'].value); }
    u.crWhites.value.copy(uniform ? lin(uniform) : u.crWhitesRef.value);
    // (hands with no skin tone given take the head's own skin, so they match the face: m.userData.crewSkinOf; a tone
    // given comes out as THE SKIN'S LIMITS let it on the head, and the hands wear that same colour: skinTone)
    u.crSkinLook.value.set(SKIN_LIMIT.shine, SKIN_LIMIT.shineMost, skin ? SKIN_LIMIT.hue : 1);
    u.crSkin.value.copy(skin ? skinTone(lin(skin), m.userData.crewSkinHead || u.crSkinRef.value) : m.userData.crewSkinOf || u.crSkinRef.value);
    if (skin && m.userData.crewHand) u.crSkin.value.multiplyScalar(SKIN_LIMIT.hands);
    u.crHair.value.copy(hair ? lin(hair) : u.crHairRef.value); u.crHairOwn.value = hair ? 0 : 1;
    // (FRECKLES: on a head made with them, shown or not)
    if (u.crFreckles) u.crFreckles.value = +freckles > 0 ? 1 : 0;
  }
}

// ── a hair's fit ────────────────────────────────────────────────────────────────────────────────────────────────────
// Every hair is shaped on the standard skull, so one fit serves it on every head. The settings layer up (2026-11-08, the
// game's maker: "different settings for the hair if applied to that head, like +8% scale to the x axis for this head"):
//   1. THE HEAD'S OWN (crew.json, a head entry's `hairFit`: { dims, offset, turn, tilt, lean }): applied to EVERY hair worn on that head
//      (a narrow skull's x -8% for all hairs); started from each head's skull against the Tripo heads' mean (the hair
//      rig's skulls.py, setheads.py); it fades out below the jaw as the tuck does (a skull's shape: long ends hang as
//      their hair made them, clear of the neck);
//   2. THE HAIR'S OWN (a hair entry's `fit`), on every head;
//   3. THE PAIR'S (the hair's fit.heads[<head id>]), only where one hair on one head needs more;
//   then the hair's tuck and THE HUG (below), worked out on this head.
// A hair entry's `fit`:
//   offset [x, y, z]  metres, in the head's frame (y up, z forward, x to their left), after the size
//   scale             the size, about the standard skull's centre (1: as made)
//   dims [x, y, z]    width, height and depth, each its own scale about the standard skull's centre (1: as made)
//   turn              degrees round the upright line through the standard skull's centre (+: the hair's front to its
//                     left), after the size
//   tilt              degrees round the line from ear to ear through the standard skull's centre (+: the hair's front
//                     tipped down, its back up; 2026-11-08, the game's maker: "I rotated the MediumFullHair forward to
//                     eliminate the gap above the forehead")
//   lean              degrees round the line from the back of the head to the face through the standard skull's centre
//                     (+: the hair's top tipped to their left)
//                     (the three together: the lean first, then the tilt, then the turn: hairRotation)
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
//   hug               0..1 (0% to 100%; left out: 100% for the crew's own hairs, the ones with a scalp line (built in
//                     Blender or harvested), 0 for the rest: the Mathwood hairs; lib.hugDefaultOf):
//                     THE HUG, after the tuck: the hair's inner layer drawn to its
//                     hugGap off THIS head's scalp wherever it stands further off, the dragged-down edge tucked under with
//                     it; 0 is off (the tuck alone, as before 2026-11-08)
//   hugGap            metres (left out: HUG_GAP, 3 mm): how far off the scalp the hug leaves the inner layer; under
//                     TUCK_CLEAR (the short coils: almost on the skin) it is also how near any point may come
//   heads             { <head id>: { offset, scale, dims, turn, tilt, lean, tuck, tuckStart, hug, hugGap, placed } }: the
//                     pair's own, each ADDED to the hair's own and the head's (offsets, turns, tilts, leans, tucks, hugs
//                     and gaps added, scales and dims multiplied); a field left out adds nothing. `placed` (his placement
//                     by hand, written by the hair rig's placement.py from his Blender file): the hair AS CUT (its _CUT
//                     points, before the harvest lifted it clear of every head) with the head's own and the pair's dims,
//                     turn, tilt, lean and offset, and nothing else: not the hair's own numbers, no tuck, no hug: exactly
//                     as he placed it
// The head's frame is the Head bone's own: every crew skeleton's Head bone is unturned at rest, so its frame is the
// game's (y up, z forward, metres) from the Head joint, on every suit, and the fit rides the head through every clip.
export const SKULL = [0, 0.106, -0.012];      // the standard skull's centre from the Head joint (the attachment rules)
export const HAIR_CLEAR = 0.004;              // hair as made stays this far off every head (metres)
export const TUCK_CLEAR = 0.002;              // the tuck draws hair in to this far off the head it's on, never nearer
export const TUCK_MAX = 5;                    // the most tuck there is (500%)
export const HUG_GAP = 0.003;                 // the hug draws the hair's inner layer to this far off the head it's on
export const HUG_MAX = 1, HUG_DEFAULT = 1;    // the most hug there is (100%), and a fit's when it gives none
// (the head's frame: where long hair's tuck is full and how far below it it fades; how far above tuckStart it fades in)
const TUCK_JAW = -0.025, TUCK_FADE = 0.04, TUCK_RAMP = 0.02;
const CUT_K = 20;      // (a harvested hair's _cut: the way to where each point was cut, metres times this)
// the fit a hair wears on a head: the head's own (hl: its entry's hairFit), the hair's own and the pair's, layered (any
// field left out: as made). A fit already worn (resolved) comes back as it is.
const v3 = (a, i, z) => (a && a[i] != null && isFinite(+a[i]) ? +a[i] : z);
export function fitFor(f, head, hl, hug0 = HUG_DEFAULT) {
  if (f && f.resolved) return { ...f, offset: [...f.offset], dims: [...f.dims] };   // (turn, tilt and lean, numbers, as they are)
  f = f || {}; const d = (f.heads && head && f.heads[head]) || {}, H = hl || {}, placed = !!d.placed, o = placed ? {} : f;
  const ang = (k) => (+H[k] || 0) + (+o[k] || 0) + (+d[k] || 0);
  return { offset: [0, 1, 2].map((i) => v3(H.offset, i, 0) + v3(o.offset, i, 0) + v3(d.offset, i, 0)),
    scale: (o.scale == null ? 1 : +o.scale) * (d.scale == null ? 1 : +d.scale),
    dims: [0, 1, 2].map((i) => v3(H.dims, i, 1) * v3(o.dims, i, 1) * v3(d.dims, i, 1)),
    turn: ang('turn'), tilt: ang('tilt'), lean: ang('lean'),
    tuck: placed ? 0 : Math.min(TUCK_MAX, Math.max(0, (+o.tuck || 0) + (+d.tuck || 0))), tuckStart: Math.max(0, (+o.tuckStart || 0) + (+d.tuckStart || 0)),
    hug: placed ? 0 : Math.min(HUG_MAX, Math.max(0, (o.hug == null ? hug0 : +o.hug || 0) + (+d.hug || 0))),
    hugGap: Math.max(0, (o.hugGap == null ? HUG_GAP : +o.hugGap || 0) + (+d.hugGap || 0)), placed, resolved: true,
    // (the head's own share, apart: applyFit fades it out below the jaw, as the tuck fades)
    head: { dims: [0, 1, 2].map((i) => v3(H.dims, i, 1)), turn: +H.turn || 0, tilt: +H.tilt || 0, lean: +H.lean || 0, offset: [0, 1, 2].map((i) => v3(H.offset, i, 0)) } };
}
const asMade = (f) => !f || (!f.placed && !f.offset.some((v) => Math.abs(v) > 1e-7) && Math.abs(f.scale - 1) < 1e-7 && !f.dims.some((v) => Math.abs(v - 1) > 1e-7) && !f.turn && !f.tilt && !f.lean && !(f.tuck > 0) && !(f.hug > 0));
// a hair fit's turn, tilt and lean (degrees) as one rotation in the head's frame, row by row (9 numbers): the lean (round
// z, the top to their left) first, then the tilt (round x, the front down), then the turn (round y, the front to their
// left). The hair rig's placement.py takes his placements apart the same way.
export function hairRotation(turn, tilt, lean) {
  const cy = Math.cos((turn || 0) / DEG), sy = Math.sin((turn || 0) / DEG), cx = Math.cos((tilt || 0) / DEG), sx = Math.sin((tilt || 0) / DEG);
  const cz = Math.cos((lean || 0) / DEG), sz = Math.sin((lean || 0) / DEG);
  return [cy * cz - sy * sx * sz, cy * sz + sy * sx * cz, sy * cx,
    -cx * sz, cx * cz, -sx,
    -sy * cz - cy * sx * sz, -sy * sz + cy * sx * cz, cy * cx];
}
// a part's bind space -> the head's frame (its Head bone's own)
function frameOf(mesh) {
  // (a head seated lower (THE SEAT) keeps the frame it was bound in: its fit, paint and strands are worked out there)
  if (mesh.userData.frame) return new THREE.Matrix4().fromArray(mesh.userData.frame);
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
  // (welded: the points that share a place share the sum. A Tripo head is split along its picture's seams, one place
  // several points; summed apart, each patch's points turned their normals their own way as the collar fit moved the
  // neck, and the patches shaded as blocks (the game's maker's "blocky squares on peoples necks", 2026-11-11))
  const key = (v) => Math.round(P[v * 3] * 1e5) + ',' + Math.round(P[v * 3 + 1] * 1e5) + ',' + Math.round(P[v * 3 + 2] * 1e5);
  const sum = new Map(), keys = new Array(n);
  for (let v = 0; v < n; v++) { const k = keys[v] = key(v); const s = sum.get(k); if (s) { s[0] += N[v * 3]; s[1] += N[v * 3 + 1]; s[2] += N[v * 3 + 2]; } else sum.set(k, [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]]); }
  for (let v = 0; v < n; v++) { const s = sum.get(keys[v]); N[v * 3] = s[0]; N[v * 3 + 1] = s[1]; N[v * 3 + 2] = s[2]; }
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
function applyFit(dst, src, M, fit, field, hug) {
  const pos = src.attributes.position, n = pos.count, s = fit.scale, o = fit.offset, F = new Float32Array(n * 3);
  // (the points the fit starts from (B0, the head's frame): the part's own; a hair that keeps where it was cut (_cut, the
  // way from each point to where it was cut, in the head's axes, times CUT_K: the hair rig's tripo_hair.py, 2026-11-08)
  // starts from the hair AS CUT, on every head: lifted clear of THIS head alone by the clearance (THE HUG, below), not
  // of every head at once as the harvest lifted it; a placement by hand wears it as cut, exactly)
  const cut = src.attributes._cut || null, B0 = new Float32Array(n * 3);
  // (the sizes, the turn, tilt and lean and the offset: in one step for a placement by hand (exactly as placement.py
  // measured it); else the hair's and the pair's, then the head's own, which fades out below the jaw as the tuck does: a
  // head's setting is its skull's shape, and long ends hang as their hair made them, clear of the neck)
  const Hd = (!fit.placed && fit.head) || null, one = (q, k, R, oo, out) => {
    const x = (q[0] - SKULL[0]) * k[0], y = (q[1] - SKULL[1]) * k[1], z = (q[2] - SKULL[2]) * k[2];
    out[0] = SKULL[0] + R[0] * x + R[1] * y + R[2] * z + oo[0]; out[1] = SKULL[1] + R[3] * x + R[4] * y + R[5] * z + oo[1];
    out[2] = SKULL[2] + R[6] * x + R[7] * y + R[8] * z + oo[2]; return out;
  };
  const less = (k) => (fit[k] || 0) - (Hd ? Hd[k] || 0 : 0);
  const kA = Hd ? [0, 1, 2].map((i) => s * fit.dims[i] / Hd.dims[i]) : [0, 1, 2].map((i) => s * fit.dims[i]), RA = hairRotation(less('turn'), less('tilt'), less('lean'));
  const RH = Hd ? hairRotation(Hd.turn, Hd.tilt, Hd.lean) : null;
  const oA = Hd ? [0, 1, 2].map((i) => o[i] - Hd.offset[i]) : o, q0 = [0, 0, 0], q1 = [0, 0, 0], q2 = [0, 0, 0];
  let top = -Infinity;
  for (let i = 0; i < n; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(M);
    if (cut) { _v.x += cut.getX(i) / CUT_K; _v.y += cut.getY(i) / CUT_K; _v.z += cut.getZ(i) / CUT_K; }
    _v.toArray(B0, i * 3); _v.toArray(q0);
    one(q0, kA, RA, oA, q1);
    if (Hd) {
      one(q1, Hd.dims, RH, Hd.offset, q2);
      const wj = q1[1] < TUCK_JAW ? 1 - smooth01((TUCK_JAW - q1[1]) / TUCK_FADE) : 1;
      for (let a = 0; a < 3; a++) q1[a] += (q2[a] - q1[a]) * wj;
    }
    F[i * 3] = q1[0]; F[i * 3 + 1] = q1[1]; F[i * 3 + 2] = q1[2];
    top = Math.max(top, F[i * 3 + 1]);
  }
  const stats = { tucked: 0, held: 0 };
  // (where the sizes, turns and offsets put each point, before the tuck and the hug move it: THE STRANDS KEEP THEIR SHAPE)
  const A0 = field && !fit.placed ? Float32Array.from(F) : null;
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
  Object.assign(stats, { hugged: 0, under: 0, cleared: 0, hugHeld: 0, hugMostMm: 0, skirt: null });
  if (field && !fit.placed) hugFit(F, B0, src, M, fit, field, hug || {}, stats);
  if (A0) relaxFit(F, A0, B0, src, field, stats);
  // (a placement by hand: worn as placed, but a point it leaves a hair's breadth under THIS head's skin (PLACED_UNDER:
  // his point on his head 0.1 mm off it, the parts' packing moving each a few hundredths: the long-neck t10's forehead
  // under the short curly) held just outside it, along the skin's own normal; deeper, his dragged-in edge, left)
  else if (fit.placed && hug && hug.tris) {
    const H = hug.tris, P = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      P[0] = F[i * 3]; P[1] = F[i * 3 + 1]; P[2] = F[i * 3 + 2];
      let d = nearestHead(H, ...P); if (!nearestHead.found || nearestHead.out || d > PLACED_UNDER) continue;
      for (let k = 0; k < 4 && nearestHead.found && !nearestHead.out; k++) { const nn = nearestHead.n, st = d + 0.00003; P[0] += nn.x * st; P[1] += nn.y * st; P[2] += nn.z * st; d = nearestHead(H, ...P); }
      F[i * 3] = P[0]; F[i * 3 + 1] = P[1]; F[i * 3 + 2] = P[2]; stats.cleared++;
    }
  }
  const Mi = M.clone().invert(), P = dst.attributes.position.array;
  for (let i = 0; i < n; i++) _v.fromArray(F, i * 3).applyMatrix4(Mi).toArray(P, i * 3);
  dst.attributes.position.needsUpdate = true;
  // the normals and strands: as made, turned where the tuck and the hug turned the surface
  const turn = [];
  for (const k of ['normal', '_strand']) {
    const A = dst.attributes[k]; if (!A) continue;
    A.array.set(partFloats(src, k)); A.needsUpdate = true;
    if (A.itemSize === 3) turn.push(A);
  }
  if ((stats.tucked || stats.hugged || stats.cleared || cut || fit.turn || fit.tilt || fit.lean || fit.dims.some((v) => Math.abs(v - 1) > 1e-7)) && turn.length) {
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

// ── the hug ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// (2026-11-08; the game's maker on the grey bob: "this haircut should be closer to the skin, the area I dragged down to
// cover any gap is showing too much"; on the short coils: "It needs to be really close to the shape of the head".) A hair
// harvested from a Tripo bust is one shape lifted clear of every head, its edge flared in under the scalp. The tuck draws
// each line of it in by how far its underside stands off the head; but near the hairline the underside it finds is the
// flared edge, already under the skin, so the hair there stays where the lift left it: a lip standing 1 to 3 cm off the
// forehead and temples, and the dragged-down band from the lip to the skin showing as a flat smear. THE HUG, per head and
// hair, when a person is put together (after the tuck, on the same copy of the hair's positions), along each point's line
// from the skull's centre (SKULL):
//   - THE SKIRT: the dragged-down edge: points within SKIRT of the hairline (the hair's open edge chains of EDGE_MAIN or
//     more, along its surface; card hair: its shell's) with hair standing further out over them (within 8 degrees, by
//     SKIRT_COVER), and any point within SKIRT_FLARE of it under this head's skin (the flare). They follow the hair
//     over them.
//   - THE INNER LAYER: on a 2 degree grid round the centre, the innermost of the rest (card hair: each point less its
//     height over the hair's underside, _UNDER, as the tuck does).
//   - HOW FAR: where the inner layer stands more than the hair's hugGap off this head's scalp (the head's reach, as the
//     tuck's S), in by the difference. Filled over the grid where only skirt lies, then the mean within 2 degrees (so
//     the hair bends smoothly; the most within 4 degrees over-drew everything near a lip to the floor).
//   - EACH POINT moves along its line by that times the hug (0..1) and the tuck's own fade below the jaw (long ends hang
//     as made); a point HUG_SOFT above the inner layer goes HUG_OUTER as far (a gentle falloff outward through the hair's
//     thickness: the outside keeps more of its volume); a skirt point the whole way.
//   - THE CLEARANCE, after the hug and whatever moved the hair before it (the head's own and the pair's dims and offsets
//     can narrow a hair into a head): no point but the skirt ends nearer this head than TUCK_CLEAR (or its hugGap, if
//     less), or than it was as made; one that would is moved out with its line (the most each 2 degree cell needs, the
//     most within 4 degrees and the mean of that, so the hair bends out rather than dents), then singly; held off the
//     head's mean reach (the near skin) as well as its most (a line down through a neck meets the neck's far side); and
//     last THE EXACT CLEARANCE: a point ending within a few mm of the skin measured against the head's own triangles
//     (lib.headTris) and moved out along its line until it is as far off as it may be (the reach can't see an ear or a
//     bump beside the line; inside or out told by the nearest triangle's own facing). A line whose most reach runs
//     HUG_DEEP past its mean goes down through the neck: a point on one is never drawn in nor pushed along its line, only
//     out along the nearest skin's own normal by the exact clearance.
//   - The skirt goes on in under the skin with the hair over it (as the flare is), and a skirt point already under the
//     skin stays under it.
// c.fitStats: hugged (points the hug moved), under (skirt points taken in under the skin), cleared (points moved out by
// the clearance), hugHeld (held by it), hugMostMm (the most a point moved); c.fitSkirt (the skirt, a flag a point, each
// hair mesh in turn, for the checks).
const HUG_SOFT = 0.02, HUG_OUTER = 0.5;
const SKIRT = 0.025, SKIRT_FLARE = 0.01, SKIRT_COVER = 0.002, SKIRT_UNDER = 0.001, EDGE_MAIN = 0.10, HUG_INSIDE = 0.002, HUG_MARGIN = 0.0004;
const HUG_DEEP = 0.015, HUG_PUSH = 0.008;   // (a line through the neck: its most reach this far past its mean; the most a line is pushed out)
// (the exact clearance leaves a point that lay under THIS head's skin as made only when it lay this far under it: his
// dragged-in edge, the flare; a point a hair's breadth under as made (a hair cut on another head, its as-cut place on this
// one; the nearest triangle's facing unsure at a crease) is held just outside instead)
const EXACT_UNDER = 0.001;
// (a placement by hand: a point under the skin by no more than this is the parts' packing, not his doing: held just out)
const PLACED_UNDER = 0.0002;
const HC = { ne: 90, na: 180 };     // (the grid: 2 degree cells, elevation by azimuth round from the face)
function hugCell(dx, dy, dz, r) {
  const e = Math.min(HC.ne - 1, Math.max(0, Math.floor((Math.asin(Math.max(-1, Math.min(1, dy / r))) * DEG + 90) / 2)));
  return e * HC.na + ((((Math.floor((Math.atan2(dx, dz) * DEG + 180) / 2)) % HC.na) + HC.na) % HC.na);
}
// (a grid's values within k cells (wider toward the poles): the largest, the least or the mean of those that have one;
// NaN where none has)
function hugFilter(A, k, op) {
  const { ne, na } = HC, out = new Float32Array(A.length).fill(NaN);
  for (let e = 0; e < ne; e++) {
    const cw = Math.min(na >> 1, Math.ceil(k / Math.max(0.05, Math.cos(((e + 0.5) * 2 - 90) / DEG))));
    for (let a = 0; a < na; a++) {
      let m = op === 'max' ? -Infinity : Infinity, s = 0, c = 0;
      for (let de = -k; de <= k; de++) {
        const ee = e + de; if (ee < 0 || ee >= ne) continue;
        for (let da = -cw; da <= cw; da++) {
          const v = A[ee * na + ((((a + da) % na) + na) % na)]; if (v !== v) continue;
          c++; s += v; if (op === 'max' ? v > m : v < m) m = v;
        }
      }
      if (c) out[e * na + a] = op === 'mean' ? s / c : m;
    }
  }
  return out;
}
// (cells with no value take the mean of their neighbours', pass by pass)
function hugFill(A, passes) {
  for (let p = 0; p < passes; p++) {
    const B = hugFilter(A, 1, 'mean'); let left = 0;
    for (let k = 0; k < A.length; k++) if (A[k] !== A[k]) { A[k] = B[k]; if (B[k] !== B[k]) left++; }
    if (!left) break;
  }
  return A;
}
// THE HAIRLINE, once a part: each point's distance along the hair's surface to its open edge chains EDGE_MAIN long or
// more (metres, Infinity past SKIRT x 1.6), its points joined where they meet (0.05 mm); card hair: its shell's faces
// only (a corner on the atlas's opaque patches, v over 0.76, as the checks tell them)
function hairlineOf(src, M, cards) {
  const c = src.userData.fitFloats || (src.userData.fitFloats = {});
  if (c.hairline) return c.hairline;
  const pos = src.attributes.position, n = pos.count, I = src.index, m = I ? I.count : n, uv = src.attributes.uv;
  const id = new Int32Array(n), at = [], keys = new Map();
  for (let i = 0; i < n; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(M);
    const k = Math.round(_v.x * 2e4) + ',' + Math.round(_v.y * 2e4) + ',' + Math.round(_v.z * 2e4);
    let j = keys.get(k); if (j == null) { j = at.length / 3; keys.set(k, j); at.push(_v.x, _v.y, _v.z); }
    id[i] = j;
  }
  const W = at.length / 3, E = new Map();
  for (let t = 0; t + 2 < m; t += 3) {
    const v = [I ? I.getX(t) : t, I ? I.getX(t + 1) : t + 1, I ? I.getX(t + 2) : t + 2];
    if (cards && !(uv && v.some((j) => uv.getY(j) > 0.76))) continue;
    for (const [p, q] of [[id[v[0]], id[v[1]]], [id[v[1]], id[v[2]]], [id[v[2]], id[v[0]]]]) {
      if (p === q) continue;
      const e = p < q ? p * W + q : q * W + p; E.set(e, (E.get(e) || 0) + 1);
    }
  }
  const len = (p, q) => Math.hypot(at[p * 3] - at[q * 3], at[p * 3 + 1] - at[q * 3 + 1], at[p * 3 + 2] - at[q * 3 + 2]);
  // (the open edges, gathered into chains: a chain's length is its edges')
  const root = new Int32Array(W).map((_, i) => i), find = (x) => { while (root[x] !== x) x = root[x] = root[root[x]]; return x; };
  const adj = Array.from({ length: W }, () => []), open = [];
  for (const [e, k] of E) {
    const p = Math.floor(e / W), q = e % W, l = len(p, q);
    adj[p].push(q, l); adj[q].push(p, l);
    if (k === 1) { open.push(p, q, l); root[find(p)] = find(q); }
  }
  const chain = new Map();
  for (let i = 0; i < open.length; i += 3) { const r = find(open[i]); chain.set(r, (chain.get(r) || 0) + open[i + 2]); }
  // (from every point of a long chain, outward along the surface: Dijkstra, a binary heap)
  const D = new Float32Array(W).fill(Infinity), cap = SKIRT * 1.6, H = [];
  const push = (d, i) => { H.push([d, i]); let k = H.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (H[p][0] <= H[k][0]) break; [H[p], H[k]] = [H[k], H[p]]; k = p; } };
  const pop = () => { const top = H[0], last = H.pop(); if (H.length) { H[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let s = k; if (l < H.length && H[l][0] < H[s][0]) s = l; if (r < H.length && H[r][0] < H[s][0]) s = r; if (s === k) break; [H[s], H[k]] = [H[k], H[s]]; k = s; } } return top; };
  for (let i = 0; i < open.length; i += 3) for (const p of [open[i], open[i + 1]]) if (chain.get(find(p)) >= EDGE_MAIN && D[p] > 0) { D[p] = 0; push(0, p); }
  while (H.length) {
    const [d, p] = pop(); if (d > D[p]) continue;
    const A = adj[p];
    for (let k = 0; k < A.length; k += 2) { const q = A[k], nd = d + A[k + 1]; if (nd < D[q] && nd < cap) { D[q] = nd; push(nd, q); } }
  }
  const out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = D[id[i]];
  return (c.hairline = out);
}
// THE EXACT CLEARANCE (the hug's last pass): a head's triangles in its frame in HT_CELL cells; a point's distance to the
// nearest of them within a cell either way (HT_CELL: anything further counts as HT_CELL)
const HT_CELL = 0.005; nearestHead.n = new THREE.Vector3(); const _ta = new THREE.Vector3(), _tb = new THREE.Vector3(), _tc = new THREE.Vector3(), _tp = new THREE.Vector3(), _tq = new THREE.Vector3(), _tt = new THREE.Triangle();
function headTris(g) {
  const T = [], grid = new Map(), v = new THREE.Vector3(), key = (x, y, z) => x + ',' + y + ',' + z;
  g.scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const M = frameOf(o), P = o.geometry.attributes.position, I = o.geometry.index, n = I ? I.count : P.count, Q = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) v.fromBufferAttribute(P, i).applyMatrix4(M).toArray(Q, i * 3);
    for (let t = 0; t + 2 < n; t += 3) {
      const ids = [I ? I.getX(t) : t, I ? I.getX(t + 1) : t + 1, I ? I.getX(t + 2) : t + 2], k = T.length / 9;
      for (const j of ids) T.push(Q[j * 3], Q[j * 3 + 1], Q[j * 3 + 2]);
      const lo = [0, 1, 2].map((a) => Math.floor(Math.min(...ids.map((j) => Q[j * 3 + a])) / HT_CELL)), hi = [0, 1, 2].map((a) => Math.floor(Math.max(...ids.map((j) => Q[j * 3 + a])) / HT_CELL));
      for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const kk = key(x, y, z); if (!grid.has(kk)) grid.set(kk, []); grid.get(kk).push(k); }
    }
  });
  return { T: Float32Array.from(T), grid };
}
// (and nearestHead.found: whether any is within reach; nearestHead.out: whether the point lies on the outer side of that
// nearest triangle (its winding: every head is wound outward))
function nearestHead(H, x, y, z) {   // (nearestHead.n: that triangle's outward normal)
  const cx = Math.floor(x / HT_CELL), cy = Math.floor(y / HT_CELL), cz = Math.floor(z / HT_CELL), seen = new Set(); let best = HT_CELL;
  nearestHead.out = false; nearestHead.found = false;
  _tp.set(x, y, z);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    const L = H.grid.get((cx + i) + ',' + (cy + j) + ',' + (cz + k)); if (!L) continue;
    for (const t of L) {
      if (seen.has(t)) continue; seen.add(t);
      _ta.fromArray(H.T, t * 9); _tb.fromArray(H.T, t * 9 + 3); _tc.fromArray(H.T, t * 9 + 6); _tt.set(_ta, _tb, _tc).closestPointToPoint(_tp, _tq);
      const d = _tq.distanceTo(_tp);
      if (d < best) { best = d; nearestHead.found = true; _tb.sub(_ta); _tc.sub(_ta); _tb.cross(_tc); nearestHead.out = _tb.dot(_ta.subVectors(_tp, _tq)) >= 0; nearestHead.n.copy(_tb).normalize(); }
    }
  }
  return best;
}
// (a point's distance to the head, minus inside it. No triangle within reach (HT_CELL) counts as that far OUTSIDE: the
// exact clearance steps a point out from within a few mm of the skin, so one that ends past every triangle's reach is
// clear of it. Read as "inside" (2026-11-11), each step out from there was the full reach again, six steps along the
// line and six more along a stale normal: a single point thrown up to 9 cm, the triangles that stuck out of long hair)
function signedHead(H, x, y, z) { const d = nearestHead(H, x, y, z); return !nearestHead.found ? HT_CELL : nearestHead.out ? d : -d; }
// (hug: { cards: card hair }; F: the hair's positions in the head's frame, moved; B0: where they started (the part as
// made, or as cut), for the clearance as made)
function hugFit(F, B0, src, M, fit, field, hug, stats) {
  const n = F.length / 3, NC = HC.ne * HC.na, s = fit.scale, gap = fit.hugGap, clear = Math.min(TUCK_CLEAR, gap);
  const under = hug.cards && src.attributes._under ? underOf(src, M) : null, edge = hairlineOf(src, M, hug.cards);
  const r = new Float32Array(n), cell = new Int32Array(n), Sv = new Float32Array(n), Dv = new Float32Array(n), w = new Float32Array(n), lo = new Float32Array(n), deep = new Uint8Array(n);
  const Rmax = new Float32Array(NC).fill(NaN);
  for (let i = 0; i < n; i++) {
    const dx = F[i * 3] - SKULL[0], y = F[i * 3 + 1], dy = y - SKULL[1], dz = F[i * 3 + 2] - SKULL[2], ri = Math.hypot(dx, dy, dz);
    r[i] = ri; lo[i] = -Infinity; if (ri < 1e-4) { cell[i] = -1; continue; }
    const k = hugCell(dx, dy, dz, ri); cell[i] = k;
    Sv[i] = reach(field.S, dx, dy, dz, ri, true); Dv[i] = reach(field.D, dx, dy, dz, ri, false);
    // (the tuck's fade below the jaw: long ends hang as made)
    w[i] = y < TUCK_JAW ? 1 - smooth01((TUCK_JAW - y) / TUCK_FADE) : 1;
    if (!(Rmax[k] >= ri)) Rmax[k] = ri;
    // (how near it may come, along its line: `clear` off the head (the most it reaches within 3 degrees, and HUG_MARGIN for
    // the reach's sampling), or as near as it was made, which may be under that reach (by an ear, on a bump); and as far
    // off its mean reach, the near skin (a line down through the neck: the most it reaches is the neck's far side, and
    // hair hanging beside the neck was drawn onto it); a line whose most reach runs HUG_DEEP past its mean goes down
    // through the neck, and out along it is into the neck: a point on one is left where the tuck and the sizes put it,
    // never drawn in, never pushed out; a point plainly under the skin as made (HUG_INSIDE under the head's mean reach:
    // the flare, his dragged-in edge, hair cutting in) none)
    const ex = B0[i * 3] - SKULL[0], ey = B0[i * 3 + 1] - SKULL[1], ez = B0[i * 3 + 2] - SKULL[2], r0 = Math.hypot(ex, ey, ez);
    const D0 = r0 > 1e-4 ? reach(field.D, ex, ey, ez, r0, false) : 0, S0 = r0 > 1e-4 ? reach(field.S, ex, ey, ez, r0, true) : 0;
    if (D0 > 0 && Dv[i] > 0 && !(S0 > 0 && r0 < S0 - HUG_INSIDE)) {
      deep[i] = Dv[i] - Sv[i] > HUG_DEEP || D0 - S0 > HUG_DEEP ? 1 : 0;
      if (!deep[i]) {
        lo[i] = Dv[i] + Math.min(clear + HUG_MARGIN, r0 - D0);
        if (Sv[i] > 0 && r0 >= S0) lo[i] = Math.max(lo[i], Sv[i] + Math.min(clear + HUG_MARGIN, r0 - S0));
      }
    }
  }
  const over = hugFilter(Rmax, 4, 'max'), skirt = new Uint8Array(n), L = new Float32Array(NC).fill(NaN);
  for (let i = 0; i < n; i++) {
    const k = cell[i]; if (k < 0) continue;
    skirt[i] = (edge[i] < SKIRT && over[k] > r[i] + SKIRT_COVER) || (edge[i] < SKIRT_FLARE && Sv[i] > 0 && r[i] < Sv[i]) ? 1 : 0;
    if (skirt[i] || w[i] <= 0 || !(Sv[i] > 0)) continue;
    const l = r[i] - (under ? under[i] * s : 0); if (!(L[k] <= l)) L[k] = l;
  }
  const u = new THREE.Vector3(), cellDir = (k) => {
    const el = ((Math.floor(k / HC.na) + 0.5) * 2 - 90) / DEG, az = ((k % HC.na + 0.5) * 2 - 180) / DEG;
    return u.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  };
  const r1 = Float32Array.from(r);
  // THE HUG: how far each cell's inner layer wants to come in
  if (fit.hug > 0) {
    const want = new Float32Array(NC).fill(NaN);
    for (let k = 0; k < NC; k++) {
      if (L[k] !== L[k]) continue;
      cellDir(k); const S = reach(field.S, u.x, u.y, u.z, 1, true);
      if (S > 0) want[k] = Math.max(0, L[k] - S - gap);
    }
    hugFill(want, 8); hugFill(L, 8);
    const P = hugFilter(want, 1, 'mean');
    for (let i = 0; i < n; i++) {
      const k = cell[i]; if (k < 0 || w[i] <= 0 || !(Sv[i] > 0) || !(Dv[i] > 0)) continue;
      const pull = (P[k] || 0) * fit.hug * w[i]; if (!(pull > 1e-6)) continue;
      r1[i] = r[i] - pull * (skirt[i] || !(L[k] === L[k]) ? 1 : 1 - (1 - HUG_OUTER) * smooth01((r[i] - L[k]) / HUG_SOFT));
      // (a point under the head's mean reach as made (beside an ear the reach can't tell it from the skin) never drawn further in)
      const fl = lo[i] === -Infinity ? r[i] : Math.min(r[i], lo[i]);
      if (!skirt[i] && r1[i] < fl) { r1[i] = fl; stats.hugHeld++; }
    }
  }
  // THE CLEARANCE: lines moved out where a point (not the skirt) would end nearer than it may
  const need = new Float32Array(NC).fill(NaN); let any = false;
  for (let i = 0; i < n; i++) {
    const k = cell[i]; if (k < 0 || skirt[i] || !(lo[i] > r1[i] + 1e-6)) continue;
    const d = Math.min(HUG_PUSH, lo[i] - r1[i]); if (!(need[k] >= d)) need[k] = d; any = true;
  }
  if (any) {
    const N = hugFilter(hugFilter(need, 2, 'max'), 2, 'mean');
    for (let i = 0; i < n; i++) {
      const k = cell[i]; if (k < 0 || !(N[k] > 1e-6)) continue;
      const before = r1[i]; r1[i] += N[k];
      if (skirt[i] && r[i] < Sv[i]) r1[i] = Math.min(r1[i], Math.max(before, Sv[i] - SKIRT_UNDER));
      if (r1[i] > before + 1e-6) stats.cleared++;
    }
    for (let i = 0; i < n; i++) if (!skirt[i] && lo[i] > r1[i]) { r1[i] = lo[i]; stats.cleared++; }
  }
  // THE EXACT CLEARANCE: a point (not the skirt, not under the skin as made) that ends within a few mm of the skin is
  // measured against the head's own triangles, and moved out along its line until it is as far off as the smaller of
  // TUCK_CLEAR (its gap, if less) and its distance as made: the radial reach can't see a bump or an ear beside the line
  if (hug.tris) {
    const H = hug.tris, at = (i, rr) => { const q = rr / r[i]; return [SKULL[0] + (F[i * 3] - SKULL[0]) * q, SKULL[1] + (F[i * 3 + 1] - SKULL[1]) * q, SKULL[2] + (F[i * 3 + 2] - SKULL[2]) * q]; };
    for (let i = 0; i < n; i++) {
      if (cell[i] < 0 || skirt[i] || !(Sv[i] > 0)) continue;
      if (r1[i] - Sv[i] > 0.015 && r1[i] - Dv[i] > 0.010) continue;
      // (a line down through the neck: out along it is into the neck; moved out along the nearest skin's own normal instead,
      // its own new place kept (F), its line's radius left)
      if (deep[i]) {
        // (no skin within reach: clear of it, nothing to do)
        const P = at(i, r1[i]); let d1 = nearestHead(H, ...P); if (!nearestHead.found || (d1 >= clear + 1e-4 && nearestHead.out)) continue;
        const d0 = nearestHead(H, B0[i * 3], B0[i * 3 + 1], B0[i * 3 + 2]), in0 = !nearestHead.found || !nearestHead.out;
        if (in0 && (!nearestHead.found || d0 > EXACT_UNDER)) continue;
        const want = in0 ? 0.00002 : Math.max(0.00002, Math.min(clear, d0) - 0.00005); d1 = signedHead(H, ...P); if (d1 >= want) continue;
        for (let k = 0; k < 6 && d1 < want; k++) { const nn = nearestHead.n, st = (want - d1) * 1.2 + 0.00005; P[0] += nn.x * st; P[1] += nn.y * st; P[2] += nn.z * st; d1 = signedHead(H, ...P); }
        const q = r[i] / r1[i]; F[i * 3] = SKULL[0] + (P[0] - SKULL[0]) * q; F[i * 3 + 1] = SKULL[1] + (P[1] - SKULL[1]) * q; F[i * 3 + 2] = SKULL[2] + (P[2] - SKULL[2]) * q;
        stats.cleared++; stats.hugged++; continue;
      }
      // (far enough off, and outside: an inside point is never far enough, however far in)
      let d1 = nearestHead(H, ...at(i, r1[i])); if (!nearestHead.found || (d1 >= clear + 1e-4 && nearestHead.out)) continue;
      // (as made: how far off, and on the outside (a point under the skin as made, the flare or his dragged-in edge, is left)
      // (none within reach as made: far off the skin, unless the reach says it lay under it)
      const d0 = nearestHead(H, B0[i * 3], B0[i * 3 + 1], B0[i * 3 + 2]), in0 = nearestHead.found && !nearestHead.out;
      if (nearestHead.found ? in0 && d0 > EXACT_UNDER : lo[i] === -Infinity) continue;
      const want = in0 ? 0.00002 : Math.max(0.00002, Math.min(clear, d0) - 0.00005); d1 = signedHead(H, ...at(i, r1[i])); if (d1 >= want) continue;
      for (let k = 0; k < 6 && d1 < want; k++) { r1[i] += (want - d1) * 1.3 + 0.00005; d1 = signedHead(H, ...at(i, r1[i])); }
      // (still too near after six steps out along its line, which there runs along the skin (over an ear's fold): out
      // along the nearest skin's own normal from where it got to, its line's radius left)
      if (d1 < want) {
        const P = at(i, r1[i]);
        for (let k = 0; k < 6 && d1 < want; k++) { const nn = nearestHead.n, st = (want - d1) * 1.2 + 0.00005; P[0] += nn.x * st; P[1] += nn.y * st; P[2] += nn.z * st; d1 = signedHead(H, ...P); }
        const q = r[i] / r1[i]; F[i * 3] = SKULL[0] + (P[0] - SKULL[0]) * q; F[i * 3 + 1] = SKULL[1] + (P[1] - SKULL[1]) * q; F[i * 3 + 2] = SKULL[2] + (P[2] - SKULL[2]) * q;
      }
      stats.cleared++; stats.exact = (stats.exact || 0) + 1;
    }
  }
  for (let i = 0; i < n; i++) {
    if (cell[i] < 0 || Math.abs(r1[i] - r[i]) < 1e-6) continue;
    const q = r1[i] / r[i];
    F[i * 3] = SKULL[0] + (F[i * 3] - SKULL[0]) * q; F[i * 3 + 1] = SKULL[1] + (F[i * 3 + 1] - SKULL[1]) * q; F[i * 3 + 2] = SKULL[2] + (F[i * 3 + 2] - SKULL[2]) * q;
    stats.hugged++; if (skirt[i] && r[i] >= Sv[i] && r1[i] < Sv[i]) stats.under++;
    stats.hugMostMm = Math.max(stats.hugMostMm, +(Math.abs(r1[i] - r[i]) * 1000).toFixed(1));
  }
  stats.skirt = skirt;
  // (for the checks: what the hug saw at the points globalThis.__hugDbg names)
  if (globalThis.__hugDbg) stats.dbg = globalThis.__hugDbg.map((i) => ({ i, r: r[i], r1: r1[i], lo: lo[i], Sv: Sv[i], Dv: Dv[i], skirt: skirt[i], edge: edge[i], w: w[i], L: L[cell[i]] }));
  return stats;
}

// THE STRANDS KEEP THEIR SHAPE (2026-11-11; the game's maker saw triangles sticking out of long hair on heads it wasn't
// placed on: the white stripe's long left side on the Captain, a bob's back): the tuck, the hug and the clearance each
// move a point along its own line from the skull's centre, by what its own 2 degree cell, its own skirt flag and its own
// nearest skin say. Next to the scalp that is what fits the hair to this head; but a strand's points run across many
// cells, and its tip far from the scalp, or the edge beside a point the skirt took under the skin, was moved on its own,
// a different way from the point next to it: the strand's triangles stretched into spikes and saw teeth. So after them,
// on each point's move (where it ended less where the sizes, turns and offsets put it):
//   - a point more than RELAX_NEAR off this head's skin (along its line, against the head's near reach) moves less on
//     its own and more as its neighbours along the hair's surface move, fully so from RELAX_FAR off: well away from the
//     scalp, a strand moves with its scalp-side neighbours;
//   - so does any point one of whose edges the moves stretched past RELAX_RATIO its length (and by more than
//     RELAX_GROW), wherever it is: no single point is thrown off on its own;
//   the moves are evened out that way RELAX_PASSES times (each pass reaching one edge further along the strand), points
//   at one place (the mesh's seams) moving as one. A point near the scalp with whole triangles keeps its own move, so
//   the hug and the clearance stand there. A placement by hand is never touched. c.fitStats.relaxed: points it moved
//   (0.1 mm or more), relaxMostMm: the most.
const RELAX_NEAR = 0.008, RELAX_FAR = 0.02, RELAX_RATIO = 1.4, RELAX_GROW = 0.001, RELAX_PASSES = 16;
// (once a part: its points joined where they start (0.05 mm), and each joined point's neighbours along its triangles)
function relaxGraph(src, B0) {
  const c = src.userData.fitFloats || (src.userData.fitFloats = {});
  if (c.relax) return c.relax;
  const n = B0.length / 3, I = src.index, m = I ? I.count : n, id = new Int32Array(n), keys = new Map();
  let W = 0;
  for (let i = 0; i < n; i++) {
    const k = Math.round(B0[i * 3] * 2e4) + ',' + Math.round(B0[i * 3 + 1] * 2e4) + ',' + Math.round(B0[i * 3 + 2] * 2e4);
    let j = keys.get(k); if (j == null) { j = W++; keys.set(k, j); } id[i] = j;
  }
  const seen = new Set(), pairs = [];
  for (let t = 0; t + 2 < m; t += 3) {
    const v = [id[I ? I.getX(t) : t], id[I ? I.getX(t + 1) : t + 1], id[I ? I.getX(t + 2) : t + 2]];
    for (const [p, q] of [[v[0], v[1]], [v[1], v[2]], [v[2], v[0]]]) {
      if (p === q) continue;
      const e = p < q ? p * W + q : q * W + p; if (seen.has(e)) continue; seen.add(e); pairs.push(p, q);
    }
  }
  const start = new Int32Array(W + 1);
  for (const p of pairs) start[p + 1]++;
  for (let w = 0; w < W; w++) start[w + 1] += start[w];
  const nb = new Int32Array(pairs.length), fill = start.slice(0, W);
  for (let k = 0; k < pairs.length; k += 2) { nb[fill[pairs[k]]++] = pairs[k + 1]; nb[fill[pairs[k + 1]]++] = pairs[k]; }
  return (c.relax = { id, W, pairs: Int32Array.from(pairs), start, nb });
}
function relaxFit(F, A, B0, src, field, stats) {
  const { id, W, pairs, start, nb } = relaxGraph(src, B0), n = F.length / 3;
  // (each joined point: where it starts (A) and its move (D0), the mean of its points')
  const cnt = new Float32Array(W), S = new Float64Array(W * 3), D0 = new Float64Array(W * 3);
  for (let i = 0; i < n; i++) { const w = id[i]; cnt[w]++; for (let a = 0; a < 3; a++) { S[w * 3 + a] += A[i * 3 + a]; D0[w * 3 + a] += F[i * 3 + a] - A[i * 3 + a]; } }
  for (let w = 0; w < W; w++) for (let a = 0; a < 3; a++) { S[w * 3 + a] /= cnt[w]; D0[w * 3 + a] /= cnt[w]; }
  // (how freely each moves with its neighbours: by how far off the skin it ends, and by how stretched its edges are)
  const f = new Float32Array(W);
  for (let w = 0; w < W; w++) {
    const dx = S[w * 3] + D0[w * 3] - SKULL[0], dy = S[w * 3 + 1] + D0[w * 3 + 1] - SKULL[1], dz = S[w * 3 + 2] + D0[w * 3 + 2] - SKULL[2], r = Math.hypot(dx, dy, dz);
    if (r < 1e-4) continue;
    // (a line with no head over the neck's cut (down through the neck's opening): the hair there hangs free)
    const Sv = reach(field.S, dx, dy, dz, r, true), h = Sv > 0 ? r - Sv : Infinity;
    f[w] = smooth01((h - RELAX_NEAR) / (RELAX_FAR - RELAX_NEAR));
  }
  const len = (X, Y, p, q) => Math.hypot(X[p * 3] + Y[p * 3] - X[q * 3] - Y[q * 3], X[p * 3 + 1] + Y[p * 3 + 1] - X[q * 3 + 1] - Y[q * 3 + 1], X[p * 3 + 2] + Y[p * 3 + 2] - X[q * 3 + 2] - Y[q * 3 + 2]);
  const Z = new Float64Array(W * 3);
  for (let k = 0; k < pairs.length; k += 2) {
    const p = pairs[k], q = pairs[k + 1], l0 = len(S, Z, p, q), l1 = len(S, D0, p, q);
    const t = smooth01((l1 / Math.max(l0, 0.0003) - RELAX_RATIO) / 0.6) * smooth01((l1 - l0 - RELAX_GROW) / 0.002);
    if (t > f[p]) f[p] = t; if (t > f[q]) f[q] = t;
  }
  // (the moves evened out, pass by pass: each free point toward the mean of its neighbours' moves)
  let D = Float64Array.from(D0), N = new Float64Array(W * 3);
  for (let pass = 0; pass < RELAX_PASSES; pass++) {
    for (let w = 0; w < W; w++) {
      const fw = f[w], k0 = start[w], k1 = start[w + 1];
      if (!(fw > 0) || k1 === k0) { N[w * 3] = D0[w * 3]; N[w * 3 + 1] = D0[w * 3 + 1]; N[w * 3 + 2] = D0[w * 3 + 2]; continue; }
      let x = 0, y = 0, z = 0;
      for (let k = k0; k < k1; k++) { const j = nb[k] * 3; x += D[j]; y += D[j + 1]; z += D[j + 2]; }
      const c = 1 / (k1 - k0);
      N[w * 3] = (1 - fw) * D0[w * 3] + fw * x * c; N[w * 3 + 1] = (1 - fw) * D0[w * 3 + 1] + fw * y * c; N[w * 3 + 2] = (1 - fw) * D0[w * 3 + 2] + fw * z * c;
    }
    const T = D; D = N; N = T;
  }
  // (only the free points written: every other point keeps its own move exactly)
  let moved = 0, most = 0;
  for (let i = 0; i < n; i++) {
    const w = id[i]; if (!(f[w] > 0)) continue;
    const x = A[i * 3] + D[w * 3], y = A[i * 3 + 1] + D[w * 3 + 1], z = A[i * 3 + 2] + D[w * 3 + 2];
    const d = Math.hypot(x - F[i * 3], y - F[i * 3 + 1], z - F[i * 3 + 2]);
    F[i * 3] = x; F[i * 3 + 1] = y; F[i * 3 + 2] = z;
    if (d >= 0.0001) moved++; if (d > most) most = d;
  }
  stats.relaxed = moved; stats.relaxMostMm = +(most * 1000).toFixed(1);
}

// THE SHADE FOLLOWS THE HAIR (2026-11-08): the scalp's shade starts 4 mm inside a hair's edge as made (scalp.line,
// THE PAINT FIELD); the hug takes the dragged-down edge in under the skin, so on a head the hair's visible edge can stand
// higher than that. After the fit, the hair's edge as worn on this head (each 2 degrees round: the lowest of its points
// standing WORN_OUT or more off the head's skin, the middle of five neighbours), and the person's paint field made again
// with the shade starting no lower than WORN_IN above it and the buzz's edge no lower than it (c.paintScalp: the line and
// edge worn).
const WORN_OUT = 0.0005, WORN_IN = 4 / (0.09 * Math.PI / 180 * 1000);
function wornScalp(sc, hairFit, field) {
  const NA = 180, low = new Float32Array(NA).fill(Infinity), v = new THREE.Vector3();
  for (const [m, , M] of hairFit) {
    const P = m.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(M);
      const dx = v.x - SKULL[0], dy = v.y - SKULL[1], dz = v.z - SKULL[2], r = Math.hypot(dx, dy, dz); if (r < 1e-4) continue;
      const S = reach(field.S, dx, dy, dz, r, true); if (!(S > 0) || r < S + WORN_OUT) continue;
      const el = Math.asin(Math.max(-1, Math.min(1, dy / r))) * DEG, k = ((Math.floor((Math.atan2(dx, dz) * DEG + 180) / 2) % NA) + NA) % NA;
      if (el < low[k]) low[k] = el;
    }
  }
  const edgeAt = (a) => { const k0 = Math.floor((a + 180) / 2), V = []; for (let d = -2; d <= 2; d++) { const x = low[(((k0 + d) % NA) + NA) % NA]; if (x < 90) V.push(x); } V.sort((p, q) => p - q); return V.length >= 3 ? V[V.length >> 1] : null; };
  const line = [], edge = []; let raised = 0;
  for (let a = -180; a <= 180; a += 7.5) {
    const e = edgeAt(a), l0 = lineAt(sc.line, a), e0 = lineAt(sc.edge || sc.line, a);
    const l1 = e == null ? l0 : Math.max(l0, e + WORN_IN), e1 = e == null ? e0 : Math.max(e0, e);
    if (l1 > l0 + 0.05) raised++;
    line.push([a, +l1.toFixed(2)]); edge.push([a, +e1.toFixed(2)]);
  }
  return { ...sc, line, edge, raised };
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
//   (the head keeps its own shape; counted as wideMm, coverMm), and the fit starts below it. But where the rim is an
//   OPENING's (COLLAR.open below the collar's highest: the civilian's T-shirt neckline under its open jacket), a wider
//   neck lies over the cloth below, not over a collar's top (t10's long neck: a V of skin on the shirt with a hard
//   edge): it is drawn in behind the cloth from the rim, over 5 mm (2026-11-09; counted as tucked), the neck above the
//   rim, what shows, as made.
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
// 4.6 cm): whatever lies nearer, inside a collar, is passed. Tried at 0 on 2026-11-17: it changes the collar found on
// most outfits, so it stays)
// (far: where the look in starts: a wall must be the suit's OUTERMOST cloth along its line out to here, so an inner
// surface with the suit's own back or a pack beyond it (spaceMan's funnel inside its ring) is never taken for the
// collar; a wall farther than reach is none (the suit is far off there). jump: the most a collar's outside comes in from
// one level to the next, going down; deep: the most a neck point is ever drawn in, a safety stop; open: a rim this far
// below the collar's highest is an opening's (a shirt's neckline under an open collar), never a collar's top)
const COLLAR = { step: 0.005, below: 0.15, top: -0.02, nt: 72, reach: 0.16, far: 0.35, least: 0.042, around: 0.75, jump: 0.01, deep: 0.045, open: 0.05 };
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
function neckFit(m, C, rideOn = true) {
  m.updateMatrixWorld(true);
  const bones = m.skeleton.bones, head = bones.find((b) => b.name === 'Head');
  const F = head.matrixWorld.clone().invert();
  // (which of the skin's bones ride the Head: the Head and every bone under it (the eyes', the face's))
  const rides = bones.map((b) => { for (let p = b; p; p = p.parent) if (p === head) return true; return false; });
  const g = m.geometry, pos = g.attributes.position, n = pos.count, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const P = floatsOf(pos), depth = new Float32Array(n).fill(-1), moved = new Float32Array(n), X = new THREE.Vector3();
  const st = { moved: 0, mostMm: 0, meanMm: 0, pastMm: 0, wideMm: 0, wideAt: null, coverMm: 0, deep: 0, rides: 0, tucked: 0 };
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
  const start = new Float32Array(C.nt).fill(-Infinity), band = new Float32Array(C.nt).fill(COLLAR_BAND), rimTop = Math.max(...C.rim);
  for (let j = 0; j < C.nt; j++) {
    if (!(C.rim[j] > -Infinity)) continue;
    let k = Math.min(C.ny - 1, Math.round((C.rim[j] - C.y0) / C.step));
    const k0 = k, w0 = C.wall[k][j], r0 = near(k, j);
    if (w0 < Infinity && r0 - w0 > st.wideMm / 1000) { st.wideMm = (r0 - w0) * 1000; st.wideAt = Math.round((-Math.PI + (j + 0.5) * 2 * Math.PI / C.nt) * DEG); }
    // (2026-11-09: where the rim is an OPENING's, over COLLAR.open below the collar's highest (the civilian's T-shirt
    // under its open jacket: its neckline 7.5 cm below the jacket's collar), a neck wider than it isn't covering a
    // collar's top but lying over the cloth below (t10's long neck: a V of skin on the shirt, a hard edge): it is drawn
    // in behind the cloth from the rim, over 5 mm; the neck above the rim, what shows, as made)
    if (rimTop - C.rim[j] > COLLAR.open) { if (w0 < Infinity && r0 - w0 > 0.002) { st.tucked++; band[j] = 0.005; } start[j] = C.rim[j]; continue; }
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
    const wb = CL && rideOn ? smooth01((below - 0.005) / COLLAR_BAND) * ride : 0;
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
// ARM THICKNESS in the outfit's own points (2026-11-17): an outfit's own geometry with its sleeves drawn in toward their
// arm's line at rest (the skeleton's own space as bound: the upper arm's line from its joint to the elbow, the forearm's
// from the elbow to the wrist; a point on both, a mix of the two by their weights), each point by as much as the arms
// move it: its distance off the line times 1 - (its upper arm's and forearm's weights) x (1 - k). The hands, the
// wrists' weights, never; the body never. Only the positions its own, the rest (the triangles too, so the far copy finds
// its own) shared with the part's. The normals as made: a sleeve drawn in evenly keeps its surface's way.
const ARM_OWN = ['position'];
function armGeometry(mesh, k) {
  const src = mesh.geometry, sk = mesh.skeleton, P0 = src.attributes.position, SI = src.attributes.skinIndex, SW = src.attributes.skinWeight;
  if (!sk || !SI || !SW) return null;
  const idx = (n) => sk.bones.findIndex((b) => b.name === n);
  const joint = (i) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(sk.boneInverses[i]).invert());
  const sides = [];
  for (const s of ['L', 'R']) {
    const iu = idx('UpperArm' + s), il = idx('LowerArm' + s), iw = idx('Wrist' + s); if (iu < 0 || il < 0 || iw < 0) continue;
    const sh = joint(iu), el = joint(il), wr = joint(iw);
    sides.push({ iu, il, sh, du: el.clone().sub(sh).normalize(), el, dl: wr.clone().sub(el).normalize() });
  }
  if (!sides.length) return null;
  const n = P0.count, P = new Float32Array(n * 3), q = new THREE.Vector3(), cu = new THREE.Vector3(), cl = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    q.fromBufferAttribute(P0, i);
    for (const S of sides) {
      let wu = 0, wl = 0;
      for (let j = 0; j < 4; j++) { const b = SI.getComponent(i, j), w = SW.getComponent(i, j); if (b === S.iu) wu += w; else if (b === S.il) wl += w; }
      if (wu + wl < 1e-4) continue;
      q.applyMatrix4(mesh.bindMatrix);
      cu.copy(S.du).multiplyScalar(_a.copy(q).sub(S.sh).dot(S.du)).add(S.sh);
      cl.copy(S.dl).multiplyScalar(_a.copy(q).sub(S.el).dot(S.dl)).add(S.el);
      c.copy(cu).multiplyScalar(wu).addScaledVector(cl, wl).divideScalar(wu + wl);
      q.sub(c).multiplyScalar(1 - Math.min(1, wu + wl) * (1 - k)).add(c).applyMatrix4(mesh.bindMatrixInverse);
      break;
    }
    q.toArray(P, i * 3);
  }
  const g = new THREE.BufferGeometry(); g.name = (src.name || 'suit') + ' (arm thickness)';
  g.setIndex(src.index);
  for (const [key, a] of Object.entries(src.attributes)) g.setAttribute(key, key === 'position' ? new THREE.BufferAttribute(P, 3) : a);
  for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  g.userData.fitShared = Object.keys(src.attributes).filter((key) => !ARM_OWN.includes(key));
  if (src.boundingSphere) g.boundingSphere = src.boundingSphere.clone();
  return g;
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
// THE SEAT (2026-11-10; the game's maker, of two heads: "Their necks are too long. I stretched the necks down so the
// bottoms had no chance of being seen, but they need to be pushed down into the torso more") and THE HEAD'S PLACE
// (2026-11-11; the game's maker: "When I have the cook outfit selected, almost every head looks small compared to the
// body... Can we add forward/reverse and size for heads"). How a head sits on an outfit, three settings:
//   seat     metres lower (+), deeper into the collar
//   forward  metres forward (+, toward the face) or back
//   side     metres to their left (+) or their right (2026-11-15, for the game's maker's own fine-tuning)
//   size     a scale (1: as made), about the Head joint: the head grows round its own joint, the neck under it reaching
//            further down inside the collar
// each set at three levels, which add up (seats, forwards and sides added, sizes multiplied: lib.headPlaceOf):
//   THIS OUTFIT, EVERY HEAD   the outfit's entry's `headFit` { seat, forward, side, size } (the cook's: every head too small)
//   THIS HEAD, EVERY OUTFIT   the head's entry's `headFit` { seat, forward, side, size }
//   THIS HEAD ON THIS OUTFIT  the head's entry's `headFit.suits[<outfit id>]` { seat, forward, side, size }
// (the older form, a head entry's `seat`: { <suit id>: metres, all: metres } or one number for every suit, still read:
// a suit's seat at the pair's level, `all` or one number at the head's; lib.seats over it, as the Crew Lab once kept)
// The Crew Lab tries its own over crew.json's (lib.headPlaces: { suits: { <id>: headFit }, heads: { <id>: headFit } },
// each entry replacing that outfit's or head's whole headFit, and a head's older `seat` with it). All of it at zero by
// default: a person as made. Per outfit, because a neck's length shows against each outfit's own collar: t9 and t3 20 mm
// lower in the station uniform (atlantis2) look right, but in the medic's high collar and the spacesuit's ring the same
// 20 mm rested the chin on the collar.
// (2026-11-15; the game's maker, of a look seen from BEHIND in a ship: "this neck is freakishly long". Those 20 mm were
// judged from the front; the game's camera follows the player from behind. Measured from behind, the side and the
// front (labs/crew/sweeps.js figureOf, against real adults' ranges): the station uniform's collar is cut level, as low
// behind as in front, so EVERY head showed a long neck from behind on it. Now atlantis2 seats every head 30 mm (the
// outfit's own), t3 10 mm more, each other head its own few millimetres; and in atlantis1's open collar the heads whose
// necks are long above the joint (t1, t5, t6, t8, t11, crew 1, the captains) sit 15 mm lower. No seat brings that
// uniform's nape and chin both well inside a person's range: its collar's back wants raising in Blender.
// ~/pw/space-math/PROPORTIONS.md)
// (2026-11-16; the game's maker: "Can we fix those issues like the elbow position and men's heads being to small". The
// men's Tripo heads were made at a woman's size: 20.5 to 21.7 cm chin to crown and 14.0 to 14.9 cm wide, where a man's
// is 23.2 and 15.2 on the mean, so the men stood 8.2 to 8.7 heads tall (a person: 7.1 to 8.15) on outfits of an average
// man's height. Each is sized at its own level, THIS HEAD, EVERY OUTFIT: t6 and t8 112%, crew1 110%, t1 108%, t4 105%,
// t2 103%; the men now stand 7.7 to 7.9 heads tall. The women's heads and t10 (a boy of about 16) as made.
// ~/pw/space-math/PROPORTIONS_2.md)
// (2026-11-17: the head places are the game's maker's own now, set by eye in the Crew Lab on the old collars: on
// atlantis2 every head 4 cm back. He also raised that collar's back in Blender (its top edge 3.4 cm higher
// behind, 0.85 cm in front), so the seats that hid the neck from behind in the old collar put the hair on the new one
// and the chin in it: atlantis2's own seat is 50 > 20 mm, every head 3 cm less deep. From behind the neck is what he
// tuned on the old collar (never longer); in front the chin, which sat on the collar, stands 0.11 to 0.14 of a head
// over it on the four heads the game's figures wear there (a person's least is 0.10) and 0.08 to 0.10 on the rest.
// And the two thickest necks, t8's and crew 1's, came through the raised collar's back where he had them: each
// is 1 cm further forward on this outfit (forward 6 > 16 mm). His forward for the outfit, and every other head's own
// seat, forward and size on it, are as he set them. ~/pw/space-math/CREW_3B.md)
// Done on the bind, not the points (placeHead): each outfit bone the head and hair are skinned to carries them by the
// move at rest (its inverse bind led by it), and the part's own bones (eyes, face) are moved, turned and sized the same,
// so every point moves alike whatever its weights, the head's neck as made (never cut, never stretched), its eyes, face
// and the hair worn on it all together, and the head still turns on the outfit's own neck and head joints. The collar fit
// then draws in whatever of the neck now lies inside the collar. Each mesh keeps the frame it was bound in (frameOf), so
// the hair's fit, the paint and the strands are worked out exactly as before, and a sized head carries its hair sized.
// THE HEAD'S CENTRE (2026-11-15): a head mesh made off-centre on its own Neck and Head joints, put right once, at the head:
// the head entry's `centre` [x, z] (metres: x to their left, z forward), added to the place on every outfit, under the
// three levels (the Crew Lab shows only the levels; the centre is the head's as made, put right). Every Tripo head (t1..
// t11, Crew 1, the Captain) came about 6 mm to their left of its joints (its skull 6.2 mm, Crew 1's 5.7) and its neck 6 to
// 10 mm, so its neck sat to their left in every collar: each is moved by its neck's own offset as the Crew Lab's neck sweep
// measured it in the collars (every outfit, labs/crew/sweeps.js neckOf). Front to back each is left as made (0): the
// outfits' collars differ there, and the pair fits of the 2026-11-15 sweep already set it. The hair worn rides the head,
// so a hair fitted by hand to a head stays where it was put on it.
export const HEAD_LIMITS = { seat: [-0.03, 0.09], forward: [-0.04, 0.04], side: [-0.02, 0.02], size: [0.8, 1.25] };
function placeHead(tpl, { seat = 0, forward = 0, side = 0, size = 1, centre = [0, 0] }) {
  const sx = side + (+centre[0] || 0), fz = forward + (+centre[1] || 0);
  tpl.updateMatrixWorld(true);
  const shared = new Set(), meshes = [];
  let pivot = null;
  tpl.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (o.userData.part === 'suit') for (const b of o.skeleton.bones) { shared.add(b.name); if (b.name === 'Head' && !pivot) pivot = b.getWorldPosition(new THREE.Vector3()); }
    else if (o.userData.part === 'head' || o.userData.part === 'hair') meshes.push(o);
  });
  // (the move at rest: sized about the Head joint, then lowered and brought forward)
  const T = new THREE.Matrix4().makeTranslation(sx, -seat, fz);
  if (size !== 1 && pivot) T.multiply(new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z)).multiply(new THREE.Matrix4().makeScale(size, size, size)).multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  const moved = new Set(), w = new THREE.Vector3(), L = new THREE.Matrix4();
  for (const m of meshes) {
    m.userData.frame = frameOf(m).toArray();
    // (new matrices: the part's own are shared by every person made from it)
    m.skeleton.boneInverses = m.skeleton.boneInverses.map((inv, i) => {
      const b = m.skeleton.bones[i];
      return shared.has(b.name) ? new THREE.Matrix4().copy(b.matrixWorld).invert().multiply(T).multiply(b.matrixWorld).multiply(inv) : inv.clone();
    });
    for (const b of m.skeleton.bones) {
      if (shared.has(b.name) || !b.parent || !shared.has(b.parent.name) || moved.has(b)) continue;
      moved.add(b);
      // (a bone of the part's own hanging from an outfit bone: moved as the head moves; sized too, its own bones under it
      // following, so the eyes and the face bones size with the head)
      if (size === 1) { b.getWorldPosition(w); w.x += sx; w.y -= seat; w.z += fz; b.position.copy(b.parent.worldToLocal(w)); }
      else { L.copy(b.parent.matrixWorld).invert().multiply(T).multiply(b.matrixWorld); L.decompose(b.position, b.quaternion, b.scale); }
    }
  }
  tpl.updateMatrixWorld(true);
}
// FRECKLES: a head's eyes in its own frame, from its eye mesh on the template (the two balls' box: its middle, and half
// the way between the balls' centres), and that frame from the skin's own points: { frame, at: [x, y, z, half] }; null
// for a head without eyes
function frecklesOf(tpl) {
  let eyes = null, skin = null;
  tpl.traverse((o) => {
    if (!o.isSkinnedMesh || o.userData.part !== 'head') return;
    const n = o.material && o.material.name;
    if (n === 'eye') eyes = o; else if (n !== 'cornea' && n !== 'visor' && (!skin || o.geometry.attributes.position.count > skin.geometry.attributes.position.count)) skin = o;
  });
  if (!eyes || !skin) return null;
  const F = frameOf(eyes.userData.frame || eyes.skeleton.bones.some((b) => b.name === 'Head') ? eyes : skin), P = eyes.geometry.attributes.position, v = new THREE.Vector3(), lo = new THREE.Vector3(Infinity, Infinity, Infinity), hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(F); lo.min(v); hi.max(v); }
  const r = (hi.y - lo.y) / 2, half = (hi.x - lo.x) / 2 - r;
  if (!(half > 0.01 && half < 0.06)) return null;
  return { frame: frameOf(skin), at: [(lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2, half] };
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

// THE FAR COPY: the check far.json keeps of a part's own triangle list (the far copies' maker sums it the same way)
function farCheck(I) { let s = 0; for (let i = 0; i < I.length; i++) s = (s + I[i] * ((i % 7) + 1)) % 1000000007; return s; }
// a far copy's geometry: the near one's points, all of them shared (as worn: the part's own, or the person's own copy for
// a fit), with the far triangle list
function farGeometry(g, index) {
  const f = new THREE.BufferGeometry(); f.name = (g.name || 'part') + ' (far)';
  for (const [k, a] of Object.entries(g.attributes)) f.setAttribute(k, a);
  f.setIndex(index); f.userData.nearOf = g;
  if (g.boundingSphere) f.boundingSphere = g.boundingSphere;
  return f;
}
// (only its own wrapper freed: the points and the triangle lists are shared with the near copy and every other person)
function disposeFar(f) { if (!f) return; f.setIndex(null); for (const k of Object.keys(f.attributes)) f.deleteAttribute(k); f.dispose(); }

export async function makeCrew(lib, recipe, { far = false } = {}) {
  // (the hands: the recipe's if it names them (null: none), else the suit's skeleton's: HANDS)
  const R = { suit: recipe.suit, head: recipe.head, hair: recipe.hair, hand: recipe.hand !== undefined ? recipe.hand : lib.handFor(recipe.suit) };
  // (card hair, paint hair and the scalp's shade under a hair draw from the shared strand atlas; paint hair has no part of
  // its own unless it gives a `file` too (BOTH, at PAINTS): then its mesh and its paint together, the paint's marks loaded)
  const HE = (R.hair && lib.entry('hair', R.hair)) || {}, cards = !!HE.cards, paint = HE.paint && PAINTS[HE.paint] ? HE.paint : null;
  const hasPart = (k) => R[k] && !(k === 'hair' && paint && !HE.file);
  const [suit, head, hair, hand, fit, atlas0, marks] = await Promise.all([...['suit', 'head', 'hair', 'hand'].map((k) => (hasPart(k) ? lib.part(k, R[k]) : null)), lib.clipsFor(R.suit, R.hand),
    cards || paint || (HE.scalp && HE.scalp.line) ? lib.hairAtlas() : null, paint && HE.marks ? lib.paintMarks(HE.marks) : null,
    // (THE FAR COPY: each part's far triangles, when asked for)
    ...(far && lib.farReady ? ['suit', 'head', 'hair', 'hand'].filter(hasPart).map((k) => lib.farReady(k, R[k])) : [])]);
  // (the Mathwood hair's strands draw from the strand atlas too: THE MATHWOOD HAIR'S STRANDS)
  const atlas = atlas0 || (hair && (hair.scene.userData.crewPart || {}).strands ? await lib.hairAtlas() : null);
  const tpl = assemble(suit, [['head', head], ['hair', hair], ['hand', hand]].filter((x) => x[1]));
  // SHOULDER WIDTH: the upper arms' joints where this outfit's clips have them (lib.clipsFor), the parts kept as made
  if (fit.moves) moveShoulders(tpl, fit.moves);
  // THE SEAT, THE HEAD'S PLACE and THE HEAD'S CENTRE: the head (its neck, its eyes and face bones) and its hair lowered,
  // brought forward, moved side to side and sized as the outfit, the head and the pair say, and centred on its joints as
  // the head entry says, before the collar fit measures the neck
  const place = head ? lib.headPlaceOf(R.head, R.suit) : null;
  if (place && (place.seat || place.forward || place.side || place.size !== 1 || place.centre[0] || place.centre[1])) placeHead(tpl, place);
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
    // (a suit whose collar stands open round the neck (crew.json `collarRide: false`: atlantis1, atlantis2) keeps the
    // neck's own weights: there the riding neck is in view, and as the head turned it sheared from the neck above into
    // steps of light and dark, Sol's "dark triangles", 2026-11-10. atlantis2 since 2026-11-16: its collar stands 6 cm
    // off the neck behind, the game's camera looks down into it from behind and above, and with the heads seated lower
    // the riding neck showed as a dark ragged band at the neck's foot (Zuri's, Ivy's). Through all 19 clips no neck
    // comes through that collar without the ride: ~/pw/space-math/rigs/proportions/ride_check.cjs)
    if (collar && hm) neck = neckFit(hm, collar, lib.collarRide !== false && (lib.entry('suit', R.suit) || {}).collarRide !== false);
  }
  const refsOf = { suit: suit && suit.scene.userData.crewPart, head: head && head.scene.userData.crewPart, hair: hair && hair.scene.userData.crewPart, hand: hand && hand.scene.userData.crewPart };
  // a Person of the Mathwood world, from the template (its clone, mixer, fades and bone keeping), on the suit's skeleton
  const person = new Person({ clips: { [fit.body]: fit.clips } }, { scene: tpl, body: fit.body }, { shadows: true });
  const meshes = {}, mats = [];
  const made = person.mesh.material;            // (the Mathwood vertex-colour material it made: not ours)
  // (the template's own materials, in the same order as the clone's meshes: a head with a visor has two)
  const src = []; tpl.traverse((t) => { if (t.isSkinnedMesh) src.push(t.material); });
  let i = 0, visor = null, painted = null;
  const hairMeshes = [];
  // (FRECKLES: asked for by the recipe, on a head with eyes: their places in the head's own frame)
  const freck = head && recipe.colours && +recipe.colours.freckles > 0 ? frecklesOf(tpl) : null;
  person.root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const kind = o.userData.part || 'suit', own = o.material === made ? src[i] : o.material; i++;
    if (kind === 'hair') hairMeshes.push(o);
    if (own && own.name === 'visor') { o.material = visor = visorMaterial(); meshes.visor = o; }
    else if (own && own.name === 'eye') { const mat = eyeMaterial(own, (refsOf.head || {}).eyes || {}); o.material = mat; mats.push(mat); meshes.eyes = o; o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; return; }
    else if (own && own.name === 'cornea') { const mat = corneaMaterial(); o.material = mat; mats.push(mat); meshes.cornea = o; o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; o.renderOrder = 1; return; }
    else if (kind === 'hair' && cards) {
      const mat = hairCardMaterial(refsOf.hair || {}, atlas); o.material = mat; mats.push(mat); meshes.hair = o;
      mat.userData.crew.crStrandSkull.value.fromArray(SKULL).applyMatrix4(frameOf(o).invert());
      o.customDepthMaterial = hairDepthMaterial(atlas); mats.push(o.customDepthMaterial);
    } else {
      // (a painted cut on the head, or a hair's buzz and the scalp's shade under it: THE PAINT FIELD)
      const pt = kind === 'head' && R.hair ? paintOf(HE, lib.buzzOf(R.hair), lib.earsOf(R.head), { atlas, marks, frame: frameOf(o), hairRefs: refsOf.hair }) : null;
      // (AN ANDROID'S HEAD is plated as its body is: a head part packed with a suit's colour masks (crewPart.masks.tex:
      // the six androids') is coloured as a suit is, so the job's colours and the body's colour lie on its plating as
      // they lie on the body's. Captain Vega's helmet is packed without them and is drawn as it was.)
      const plated = kind === 'head' && !!(refsOf.head && refsOf.head.masks && refsOf.head.masks.tex);
      const mat = crewMaterial(own, plated ? 'suit' : kind, refsOf[kind], pt, kind === 'hair' ? atlas : null, kind === 'head' ? freck : null); o.material = mat; mats.push(mat); meshes[kind] = o;
      // (A FACE PLATE: the head's own material draws the face, as a visor's is drawn (its expressions, its eye colour);
      // where on the plate and how big from crew.json's head entry `plateFace`; its layout read as the attribute crFace)
      if (mat.userData.visor) {
        visor = mat; meshes.visor = o;
        if (o.geometry.attributes.uv1 && !o.geometry.attributes.crFace) o.geometry.setAttribute('crFace', o.geometry.attributes.uv1);
        const F = (lib.entry('head', R.head) || {}).plateFace || {};
        mat.userData.crew.crFaceAt.value.set((F.at || [0, 0])[0], (F.at || [0, 0])[1], F.size || 1, F.eye ? 1 : 0); mat.userData.crew.crFaceLook.value.z = +F.lens || 0;
      }
      // (the Mathwood hair's strands: the skull's centre in the hair's own frame, for the way out from it)
      if (mat.userData.crew.crStrandSkull) mat.userData.crew.crStrandSkull.value.fromArray(SKULL).applyMatrix4(frameOf(o).invert());
      // (A HAIR COLOURED BY ITS OWN LIGHT AND DARK: set before the material is first drawn, so its shader is made with it)
      if (kind === 'hair' && hairByLight(lib, R.hair)) mat.defines.CREW_HAIR_LIGHT = '';
      if (pt) { painted = pt; pt.mat = mat; }
      // (the hands, when no skin tone is given, take the head's own skin: HANDS)
      const hs = kind === 'hand' && refsOf.head && refsOf.head.refs && refsOf.head.refs.skin;
      if (hs) mat.userData.crewSkinOf = new THREE.Color().fromArray(hs);
      // (a tone given is worked out against the head's own skin, for the head and the hands alike: THE SKIN'S LIMITS)
      if (kind === 'head' || kind === 'hand') { mat.userData.crewSkinHead = hs ? mat.userData.crewSkinOf.clone() : null; mat.userData.crewHand = kind === 'hand'; }
    }
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
  });
  made.dispose();
  // (the collar fit on the person's head: its own positions where any point moved)
  const collarGeo = lib.collarFit !== false && neck && (neck.stats.moved || neck.stats.rides) && meshes.head ? collarGeometry(meshes.head.geometry, neck.P, neck.SI, neck.SW) : null;
  let armGeo = null;             // (the outfit's own points with its sleeves thinned: ARM THICKNESS, below)
  if (collarGeo) meshes.head.geometry = collarGeo;
  if (neck) neck.stats.applied = !!collarGeo;
  const bones = {}; person.root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  // the shins' lengths, for the foot rule (the rest pose: the foot's root on the shin's line)
  person.root.updateMatrixWorld(true);
  const shin = {}; for (const s of ['L', 'R']) shin[s] = bones['LowerLeg' + s].getWorldPosition(new THREE.Vector3()).distanceTo(bones['Foot' + s].getWorldPosition(new THREE.Vector3()));
  // THE SIZE (2026-11-10; the game's maker: "Maybe we can offer a size option, but I don't think we need new models"): a
  // recipe's `size` scales the whole person about their feet (SIZES: shorter, medium, taller; left out, 1 as made). Set
  // on the root after everything above is measured at the suit's own rest (the collar fit, the hair's fit and the shins
  // all work in the parts' own sizes), so the clips, the feet at the shins' ends (their lengths scaled by the bones'
  // world scale) and the stride all follow it
  const size = +recipe.size > 0 ? Math.min(1.25, Math.max(0.75, +recipe.size)) : 1;
  if (size !== 1) { person.root.scale.setScalar(size); person.root.updateMatrixWorld(true); }
  const A = new THREE.Vector3(), Y = new THREE.Vector3(), M = new THREE.Matrix4();
  // (real eyes: a ball on each eye bone; the gaze turns them, see THE GAZE)
  const gaze = meshes.eyes && bones.EyeL && bones.EyeR ? makeGaze(person.root, bones.Head, [bones.EyeL, bones.EyeR]) : null;
  if (gaze) gaze.shade(meshes.eyes, meshes.eyes.material);
  // (face bones, at rest before the clips' first frame)
  const faceR = faceRig(bones);
  // ARM THICKNESS (crew.json suit entry `arms`, 2026-11-15; the game's maker, of Ivy in the grey uniform: "The arm also
  // seems really big compared with the rest of her body"): the bones are a normal length, the sleeves are thick, so the
  // sleeves are drawn in toward their arm's line, in the person's own copy of the outfit's points (armGeometry, below).
  // 1 as made (every outfit unless set), ARMS_LIMITS; lib.armsOf. (Until 2026-11-17 each upper arm's bone was scaled
  // thinner instead, the forearm taking its scale as a child does; once the elbow bent, that scale lay across the
  // forearm's own length and the forearm shrank. The points thinned at rest bend as made.)
  const armK = lib.armsOf(R.suit);
  armGeo = armK !== 1 && meshes.suit ? armGeometry(meshes.suit, armK) : null;
  if (armGeo) meshes.suit.geometry = armGeo;
  // ARMS OUT (crew.json suit entry `armsOut`, degrees, 2026-11-07): bulky trousers or a coat's skirts that the hands would
  // sink into in the standing clips: each upper arm turned out that far from the body, as much as it hangs down (none
  // when it's raised or reaching forward), on top of the clip and taken off again before the next frame's clip
  // (lib.armsOut { suit id: degrees }: tried in place of crew.json's, as the checks do)
  // EACH CLIP ITS OWN (2026-11-15; the game's maker: "the arms/hands drifting away from the body"): the standing pose
  // hangs the arms straight down beside the hips and needs the most; a walk swings them past the thighs and needs far
  // less, and one angle for both had everyone walking with their arms held off their sides. So `armsOut` is the
  // standing clips' angle, and the moving clips (ARMS_MOVE: the walk, the runs) take the outfit's `armsOutMove`: one
  // number for them all, or { clip: degrees } (a moving clip it leaves out, and an outfit without it: the standing
  // one); a clip that sits, drives or works (ARMS_KEEP) puts the hands on something: none. crew.json gives each
  // outfit { Walk, Run, Run_Back }, each the smallest that keeps its sleeves and hands 5 mm off its hips and thighs
  // through that clip (the runs sideways are left on the standing one: there a knee comes up to the hand in the clip
  // itself, which no angle clears). (2026-11-16: every value measured again once the elbows were put at a person's
  // place, THE ELBOW at the top: the forearm swings from lower down, and most outfits need less, the walk and the run
  // most of all; Vega standing one degree more. And again once THE ARMS ONE LENGTH made the arms longer: the same or a
  // degree or two less, the men's captain and the older captain's coat walking with their arms near their sides; Vega
  // standing 19, not the 14 his hips and thighs alone would take: his right forearm's box would sink 2.7 cm into his coat
  // at the belt, and 19 is the least that keeps all of it under 1 cm in (before this, 1.4 cm in).) What is worn is the
  // clips' own mix: each playing clip's angle by its weight in
  // the mixer, so while one clip fades into another the arms follow that same fade, and nothing steps when someone
  // starts or stops walking. (And never faster than ARMS_RATE: a fade cut short by the next clip makes the mixer's
  // own weights jump (a station person stopping for the player and setting off again within a third of a second), and
  // the arms ease through that rather than jump with it; a pose set at once, update(0), is worn at once.) lib.armsOutOf
  const AO = lib.armsOutOf(R.suit), armQ = {}, rad = THREE.MathUtils.degToRad;
  const armsOf = (name) => (ARMS_KEEP.test(name) ? 0 : !ARMS_MOVE.test(name) ? AO.stand : typeof AO.move === 'number' ? AO.move : AO.move[name] != null ? +AO.move[name] : AO.stand);
  const armsBy = Object.entries(person.actions).map(([name, a]) => [a, rad(armsOf(name))]);
  const armsAny = armsBy.some((x) => x[1] !== 0);
  const _d = new THREE.Vector3(), _ax = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _rq = new THREE.Quaternion();
  let armsNow = rad(AO.stand);
  function armsOutApply(dt) {
    // (the clips playing, each by its weight: three's own, as the mixer has just mixed the bones)
    let sw = 0, sa = 0;
    for (const [a, ang] of armsBy) { if (!a.enabled || !a.isScheduled()) continue; const w = a.getEffectiveWeight(); if (w > 0) { sw += w; sa += w * ang; } }
    if (sw > 0) { const to = sa / sw, most = dt > 0 ? ARMS_RATE * dt : Infinity; armsNow += Math.max(-most, Math.min(most, to - armsNow)); }
    person.root.getWorldQuaternion(_rq);
    for (const [s, sg] of [['L', 1], ['R', -1]]) {
      const ua = bones['UpperArm' + s], la = bones['LowerArm' + s]; if (!ua || !la) continue;
      armQ[s] = ua.quaternion.clone();
      _d.subVectors(la.getWorldPosition(_d), ua.getWorldPosition(_ax)).normalize();
      const down = new THREE.Vector3(0, -1, 0).applyQuaternion(_rq), w = Math.max(0, _d.dot(down)) ** 2;
      if (w <= 0 || !armsNow) continue;
      _ax.set(0, 0, 1).applyQuaternion(_rq).applyQuaternion(ua.parent.getWorldQuaternion(_pq).invert());
      ua.quaternion.premultiply(_q.setFromAxisAngle(_ax, armsNow * sg * w));
    }
    person.root.updateMatrixWorld(true);
  }
  // THE FAR COPY: the person's meshes that have one (made ready above when asked for; the eyes have none)
  const farMeshes = [];
  if (far) person.root.traverse((o) => { const fi = o.isSkinnedMesh && o.geometry.index && lib.farIndex && lib.farIndex.get(o.geometry.index); if (fi) farMeshes.push({ mesh: o, index: fi, near: null, geo: null }); });
  const c = {
    root: person.root, person, meshes, bones, recipe: { ...recipe }, body: fit.body, rig: fit.rig, paint, hand: R.hand, arms: armK, shoulders: fit.shoulders,
    // (ARMS OUT: the outfit's angles, degrees, and the angle worn this frame)
    armsOut: AO, armsOutNow: () => THREE.MathUtils.radToDeg(armsNow),
    // (THE HEAD'S PLACE: how this head sits on this outfit, each level's and the total)
    place,
    // (THE SIZE: the whole person scaled, and their stride with them)
    size, stride: { Walk: fit.stride.Walk * size, Run: fit.stride.Run * size },
    play: (name, o = {}) => person.play(name, { once: ONCE.has(name), ...o }),
    update(dt) {
      // (arms out: the clip's own turn back first, so the mixer, which writes only what changed, never stacks it)
      if (armsAny) for (const s of ['L', 'R']) if (armQ[s]) bones['UpperArm' + s].quaternion.copy(armQ[s]);
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
      if (armsAny) armsOutApply(dt);
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
    setColours(col) {
      c.recipe.colours = { ...(c.recipe.colours || {}), ...col }; setColours(mats, c.recipe.colours);
      // (an android's eyes are the face on its visor: an eye colour given is the colour that face glows in; none, its own)
      if (visor) visor.userData.visor.vsCol.value.set(c.recipe.colours.eyes || VISOR_OWN);
    },
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
    fit: null, fitStats: { tucked: 0, held: 0, hugged: 0, under: 0, cleared: 0, hugHeld: 0, hugMostMm: 0, relaxed: 0, relaxMostMm: 0 }, fitSkirt: [],
    async setFit(fit) {
      // (THE FAR COPY is taken off while the hair's own points are made, and put back after: a fit is worked on the
      // geometry as worn up close)
      fitting++; if (c.far) applyFar(false);
      try { return await fitHair(fit); } finally { fitting--; if (!fitting && farWanted) applyFar(true); }
    },
    // THE FAR COPY: drawn with each part's far triangles (on), or as made (off); c.far says which is drawn
    far: false,
    setFar(on) { farWanted = !!on; if (!fitting) applyFar(farWanted); },
    // (the triangles drawn, eyes and all, as the person is drawn now)
    tris() { let n = 0; person.root.traverse((o) => { if (o.isMesh && o.visible && o.geometry) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return n; },
    // the hair's buzz (THE PAINT FIELD), live: { sideburns, nape, look } as lib.buzzOf gives (null: none); the field
    // remade (a look's change needs the person put together again)
    buzz: lib.buzzOf(R.hair),
    setBuzz(buzz) {
      c.buzz = buzz || null;
      if (painted) { paintField(c.paintScalp && c.paintScalp !== HE.scalp ? { ...HE, scalp: c.paintScalp } : HE, c.buzz, lib.earsOf(R.head), painted.field.image.data); painted.field.needsUpdate = true; }
    },
    // what the paint shows (the Crew Lab's view): { buzz, under, ears } (each true or false: the buzz, the scalp's
    // shade; ears: the ears found, tinted); c.paintShown, as set
    paintShown: { buzz: true, under: true, ears: false },
    paintView(v = {}) {
      Object.assign(c.paintShown, v);
      const u = painted && painted.mat.userData.crew, S = c.paintShown;
      if (u && u.crPaintShow) u.crPaintShow.value.set(S.buzz ? 1 : 0, S.under ? 1 : 0, 0, S.ears ? 1 : 0);
    },
    dispose() {
      // (the far copy's wrappers first, the person as made again: THE FAR COPY)
      farWanted = false; applyFar(false); for (const F of farMeshes) { disposeFar(F.geo); F.geo = null; }
      for (const m of mats) m.dispose(); if (visor) visor.dispose();
      if (painted) painted.field.dispose();
      for (const [m, g0] of hairFit) if (m.geometry !== g0) { disposeOwn(m.geometry); m.geometry = g0; }
      if (collarGeo) disposeOwn(collarGeo);
      if (armGeo) disposeOwn(armGeo);
      person.mixer.stopAllAction(); person.root.removeFromParent();
    },
  };
  let fitting = 0, farWanted = false;
  function applyFar(on) {
    on = !!on && farMeshes.length > 0;
    if (on === c.far) return;
    c.far = on;
    for (const F of farMeshes) {
      if (on) {
        F.near = F.mesh.geometry;
        if (!F.geo || F.geo.userData.nearOf !== F.near) { disposeFar(F.geo); F.geo = farGeometry(F.near, F.index); }
        F.mesh.geometry = F.geo;
      } else if (F.near) { F.mesh.geometry = F.near; F.near = null; }
    }
  }
  async function fitHair(fit) {
    // (a fit given as written (not as lib.fitOf gives it) wears this head's own setting under it)
    const f = fit ? (fit.resolved ? fitFor(fit) : fitFor(fit, R.head, lib.headFitOf(R.head), lib.hugDefaultOf(R.hair))) : null, plain = asMade(f);
    // (the head's reach: for the tuck and the hug, and for the shade's line as worn (a placement by hand too))
    const field = !plain && R.head ? await lib.headField(R.head) : null, tris = field ? await lib.headTris(R.head) : null;
    const stats = { tucked: 0, held: 0, hugged: 0, under: 0, cleared: 0, hugHeld: 0, hugMostMm: 0, relaxed: 0, relaxMostMm: 0 }, skirts = [];
    for (const [m, g0, M] of hairFit) {
      if (plain) { if (m.geometry !== g0) { disposeOwn(m.geometry); m.geometry = g0; } continue; }
      if (m.geometry === g0) m.geometry = ownGeometry(g0);
      const s = applyFit(m.geometry, g0, M, f, field, { cards, tris });
      for (const k of Object.keys(stats)) stats[k] = k.endsWith('MostMm') ? Math.max(stats[k], s[k] || 0) : stats[k] + (s[k] || 0);
      skirts.push(s.skirt || null); if (s.dbg) c.fitDbg = s.dbg;
    }
    c.fitSkirt = skirts;
    c.fit = plain ? null : f; c.fitStats = stats;
    // (THE SHADE FOLLOWS THE HAIR: the paint field again, from the hair's edge as worn on this head)
    const sc = HE.scalp && HE.scalp.line ? HE.scalp : null;
    c.paintScalp = sc && field ? wornScalp(sc, hairFit, field) : sc;
    if (painted && sc) { paintField(c.paintScalp === sc ? HE : { ...HE, scalp: c.paintScalp }, c.buzz, lib.earsOf(R.head), painted.field.image.data); painted.field.needsUpdate = true; }
    return stats;
  }
  // (each hair mesh, the part's own geometry it shares, and its bind space -> the head's frame)
  const hairFit = hairMeshes.map((m) => [m, m.geometry, frameOf(m)]);
  c.setColours(recipe.colours || {});
  c.setExpression(recipe.expression || 'neutral');
  if (faceR.sliders.length) c.setFace(recipe.face || {});
  await c.setFit(lib.fitOf(R.hair, R.head));
  return c;
}
