// THE BAND: six players on the stage inside the saloon (labs/buildings/saloon.js, a code-built building). A piano
// player sits at the saloon's upright piano, a harmonica player stands at the front of the stage, a drummer sits on a
// stool at its left with a bass drum on a foot pedal, a snare on a stand and a cymbal, two sticks (src/drums.js,
// src/drumhands.js: his strokes and his foot from the music's own box hits), and a fiddler stands at its front right with a fiddle
// made in code (src/fiddle.js; it plays the old fiddle tunes' turns with real violin samples, src/audio/stagemusic.js
// THE FIDDLE), and a banjo player sits on a stool at its right front with a banjo made in code (src/banjo.js; it plays
// the banjo tunes' turns and their bum-ditty strum with the synth banjo, src/audio/banjosynth.js) (folk.js people in
// period colours). The music they play
// (src/audio/stagemusic.js) comes from where they are: each instrument is its own positioned sound (a PannerNode; the
// camera is the ears). In the hall it is full and open; outside, it comes through the saloon's walls quiet and muffled,
// and more of it, brighter, near a doorway and in front of it (src/bandplan.js soundThrough), fading away down the
// street and, past a few dozen metres, not running at all.
//
// The players' clips (Play_Piano, Piano_Rest, Play_Harmonica, Harmonica_Rest, Play_Box, Box_Rest, made in Blender:
// ~/pw/bandit-math/rigs/clips/build_stage_clips.py, files models/people/clips_stage_m.glb and _f.glb) are four beats of
// the music long; while the music plays they are kept on its beat (the harmonica player's foot taps with it, the pianist
// nods with it, the drummer's hands land on it), and the harmonica player lifts the harmonica for each phrase and lowers
// it between. The fiddler's clips (Play_Fiddle, Fiddle_Rest, Fiddle_Up, Fiddle_Down: rigs/clips/fiddle_clips.py) are
// made round his fiddle and bow, which ride his wrist bones (src/fiddleplan.js HOLD): he lifts the fiddle a moment before
// his turn comes so it is under his chin as his first note sounds, bows a stroke a beat while his notes sound, lowers it
// when his turn has passed, and holds the last chord's note in one long bow when the tune is his. The banjo player's
// (Play_Banjo, Banjo_Rest: rigs/clips/banjo_clips.py) are made round his banjo on his lap (src/banjoplan.js PLACE, which
// rides his root): he picks while his banjo sounds (its turns with the tune, its strum behind the others) and rests his
// hands on it when it doesn't.
//
// The players follow the saloon's inside (world/objects/codebuildings.js THE INSIDES): made when the player comes within
// STAGE.make metres of the saloon (before its inside can come in, so they never pop in), drawn and moved only while its
// inside is loaded and seen, and out on the trail nothing at all.
//
// The band takes requests: walk up to the front of the stage and the prompt says "Ask the band for a song"; E (or a tap
// on the prompt) opens the band's card (src/ui/bandcard.js, main.js) with the songs by name and "Take a break". A song
// picked: a player says which one in a speech bubble (src/ui/howdy.js), the notes already sounding ring out, and after a
// breath the band strikes it up, harmonica and all. A break: the music rings out and stops, the players rest (the
// harmonica put away, the pianist turned to the room, the drummer sitting up) until a song or "Play again" is picked.
// Nothing of it is saved: the band's song and break are the town's for this ride.
//
// SONGS END. A song goes on two or three minutes (a written tune two or three times round: src/bandplan.js songLines),
// then the band plays to the end of the line (a round) and lands on its home chord together (src/audio/songend.js); the
// players rest a moment while the crowd in the saloon claps (src/saloonfolk.js, src/audio/applause.js), the harmonica
// player names the next song (src/bandplan.js nextSong: not one of the last two, the band's own and the old tunes in a
// fair mix) and the pianist leads it in. A song picked from the card still changes it at once (no clapping for a song cut
// off); a song picked from the card that is played to its end is clapped like any other. On a break nothing changes on
// its own. Out of earshot for a good while, the band has moved on to another song when the player comes back.
//
// THE MUSIC CARRIES across the town and past its edge (STAGE.far): softer with distance (more gently than a bare
// speaker would, STAGE.carry), its highs lost to the air and the buildings, fading out at the far end; through the
// saloon's walls a little muffled, in front of its open doors loud and bright down the street (src/bandplan.js BAND).
// The band steps back under the hold-up's action music and the shift's fanfare (STAGE.duck).
//
//   const S = makeStage({ W, folk, audio, camera, scene, speak })   folk: the people (src/actors/folk.js); audio:
//                           src/audio/audio.js's; camera: the ears (where the sound is heard from; else the player);
//                           speak(text): says a line out loud for a rider who can't read yet (or null)
//   S.update(dt, at)        each frame while riding: at = the player's position
//   S.prompt                'Ask the band for a song' when the player is at the front of the stage, else null
//   S.inReach               true while the player is at the front of the stage (the card closes when they walk off)
//   S.request(id)           asks for a song by its id (one of SONGS): -> the song. The song playing now starts again
//   S.rest()                the band takes a break;  S.again()  back to the song they stopped on
//   S.ask()                 the next song round (as the old stage's E did): -> the song
//   S.choices()             the band card's rows now (src/bandplan.js bandChoices)
//   S.song, S.resting       the song the band plays (or will play when the music next starts), and on a break or not
//   S.music                 the stage music while it plays (or null)
//   S.players               { pianist, harpist, drummer, fiddler, banjo, bassist } once made (or null);  S.spots  their places in the world
//   S.state()               for rigs: { near, made, playing, resting, phase, inside, through, gain, hz, distance, clips,
//                           song, played, next, ... }
//   S.crowd                 the saloon's crowd (src/saloonfolk.js; main.js sets it): told when a song ends (crowd.applaud)
//   S.soundIn()             { ctx, input } the band's sound path (its distance and walls) for the crowd's own sounds, or null
//   S.endSong()             for rigs: the song finishes at the end of the line now playing (as it would on its own)
//   S.phase                 'play' (a song on, or waiting to start), 'end' (its last chord ringing, the crowd clapping)
//   S.analyser()            for rigs: an AnalyserNode on the band's sound as it goes into the game's mix (or null)
//   S.setOff(on)            for rigs: the saloon without its band (none drawn, moved or heard) while on
//   S.dispose()
// With no saloon in the town (W.V.CODE has none, or it has no stage) the handle waits for one, quiet: no players, no
// music and no prompt.
import { makePlayHands } from './playhands.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makePerson } from './actors/folk.js';
import { makeStageMusic, makeRoom, SONGS, loadFiddle, loadBanjo, loadCrash } from './audio/stagemusic.js';
import { bakedBand } from './audio/bake.js';
import { bandChoices, bandLine, soundThrough, songLines, nextSong } from './bandplan.js';
import { playEnding } from './audio/songend.js';
import { howdy } from './ui/howdy.js';
import { makeHarmonicaModel, holdFiddleOn, holdBanjoOn, holdDrumsOn, holdBassOn, addBassClips } from './bandgear.js';
import { makeFretHands, makeBassPluck } from './frethands.js';
import { banjoPlaying } from './banjoplan.js';
import { loadHands, makeHandPose } from './handpose.js';
import { makePianoHands } from './pianohands.js';
import { makeDrumHands } from './drumhands.js';

export const STAGE = {
  // who plays (folk.js looks)
  pianist: { outfit: 'suit_m', palette: 'townsman', skin: 4, hair: 1 },
  // (a riding jacket and trousers: the adventurer's bedroll stood out behind her shoulders and her bare legs shone white
  // in the footlights, a critic)
  harpist: { outfit: 'suit_f', palette: 'prairie', skin: 2, hair: 5 },
  drummer: { outfit: 'worker_m', palette: 'rancher', skin: 3, hair: 2 },
  // (a man: his clips are made on the men's skeleton, models/people/clips_stage_m.glb)
  fiddler: { outfit: 'casual_m', palette: 'homestead', skin: 2, hair: 4 },
  // (a man too: his clips are on the men's skeleton; the farmer's work clothes in mustard, unlike the others)
  banjoist: { outfit: 'farmer_m', palette: 'mustard', skin: 5, hair: 0, bareHands: true },
  // (a man: the men's skeleton; a waistcoat over a work shirt as near as the outfits come, unlike the others' colours)
  bassist: { outfit: 'suit_m', palette: 'drifter', skin: 1, hair: 3, bareHands: true },
  make: 45,               // metres from the saloon's middle within which the players are made (hidden till its inside is in)
  near: 16,               // metres from the stage: the sound's own distance only, as near things are
  fade: 130,              // metres: from here the band fades out ...
  far: 250,               // ... silent here; past this the music stops (the town's buildings, porches and yards are all
                          // within about 75 m of the band, the farm and the lake's dock about 95, the corral 160, the
                          // pasture 210: heard all over town and out to the farm, fading over the corral, faint at the
                          // pasture, gone a little past it)
  start: 235,             // metres: the music starts again when the player comes this near
  // past `near` the band carries further than a bare speaker would: the distance's softening (the panners' 1 / distance)
  // made up by (distance / near) ^ k, so it falls about 3 dB a doubling of the distance instead of 6
  carry: 0.5,
  level: 3.5,             // the band's loudness (the patches are written quieter, for the Sound Lab)
  boxLevel: 3.2,          // the drums' loudness
  // the sampled fiddle (src/audio/stagemusic.js THE FIDDLE): its samples load when the band is first heard, and then the
  // old fiddle tunes take it into their turns (the fiddle, the harmonica, the piano, the fiddle and the harmonica
  // together), heard from the fiddler. Off: the harmonica plays the fiddle's turns and the fiddler only stands with it
  // (world/governor.js may leave it out on the cheapest tier: S.fiddleOn)
  fiddle: true,
  // the banjo (src/audio/banjosynth.js, the synth banjo: nothing to load): the banjo tunes give it turns and, between
  // them, its bum-ditty strum, heard from the banjo player. Off: those turns go to the others and he sits with it
  banjo: true,
  banjoHold: 0.35,        // s: he keeps picking this long after a banjo note (the strum's gaps), and starts this far ahead
  // the fiddler's playing (s): his lift takes `up` (Fiddle_Up, timed to end on his first note); he keeps the fiddle up
  // while a note sounded within `hold` or the next comes within `gap` (a rest inside his turn), and lowers it after
  // (a lift of `up` s: the fiddle comes up first with the bow still at his side, the bow only once the fiddle's near his chin;
  // `down` s the other way about. A rest shorter than `gap` he plays through with both up; shorter than `fiddleUp`, the bow
  // comes down and the fiddle stays under his chin)
  bowing: { up: 1.7, down: 1.4, hold: 0.45, gap: 1.8, fiddleUp: 3.6, fiddleUpAt: 0.62, ending: 0.28 },   // ending: the clip's speed through the last chord's long bow
  room: 0.6,              // how much of the room's echo
  baked: true,            // the piano's and the box's notes from src/audio/bake.js (false: every note live, for a rig to compare)
  // the positioned sound: full at refDistance metres, softening as 1 / distance past it (rolloff: how fast)
  ref: 3, rolloff: 1.1,
  muffle: { from: 20, to: 250, hz: 1500 },   // the far sound loses its highs (air, the buildings): open at `from` m, down
                                             // to `hz` at `to` m (the saloon's walls muffle it more: src/bandplan.js)
  // the band steps back (this much of it, eased over `tc` s) while any of these sounds is wanted (src/audio/audio.js
  // need): the hold-up's action music ('ambush', src/missions/wagonjob.js), the shift's fanfare
  duck: { under: ['ambush', 'fanfare'], gain: 0.28, tc: 0.4 },
  // a song's end (in s from its last chord): the crowd claps from `clap`, the harmonica player names the next song at
  // `name`, the next song's first beat at `next` (its opening line, the piano's alone, leads it in); the players rest
  // from `rest` until a moment before
  end: { ahead: 1.5, clap: 0.18, name: 2.4, next: 5.6, rest: 1.6, back: 0.9 },
  awayNew: 90,            // s out of earshot after which the band is on another song when the player comes back
  lift: 1.1,              // s her lift takes, side to mouth: she starts it so it arrives on the phrase's first note
  lower: 0.7,             // s from the mouth to her side
  chest: 0.62,            // how far up she holds it at her chest (0 her side .. 1 the mouth) ...
  chestGap: 2,            // ... for a gap shorter than this, s, to her next phrase (no down-and-up in a breath)
  mouthGap: 0.6,          // s: a gap shorter than this she stays at the mouth
  // the harmonica in her hands (metres: long, tall, deep; how far it sits behind the middle of her hands, toward her, and
  // above it: at the lips while she plays)
  harp: { long: 0.09, tall: 0.017, deep: 0.022, back: 0.06, up: 0.03 },
  ask: 3.2,               // metres from the stage's front edge where the band can be asked
  between: 1.4,           // s from asking to the next song's first beat (what was sounding rings out meanwhile)
  askAgain: 1.2,          // s after an ask before the prompt comes back (a double tap doesn't skip a song)
  say: 4200,              // ms a player's answer stays up
  keys: { far: 22 },      // metres from the band's middle within which the pianist's hands follow the notes (src/pianohands.js)
  restClip: { pianist: 'Piano_Rest', harpist: 'Idle', drummer: 'Box_Rest', banjo: 'Banjo_Rest', bassist: 'Bass_Rest' },   // (the fiddler's: his own course, fiddlerStep)
};
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const CLIPS = { m: 'clips_stage_m.glb', f: 'clips_stage_f.glb' };
const GAME_DIR = new URL('../', import.meta.url).href;
const PROMPT = 'Ask the band for a song';

export function makeStage({ W, folk, audio, camera = null, scene = W.scene, speak = null }) {
  let disposed = false, made = null, making = null, visible = false, music = null, gain = 0, hz = 20000, distance = Infinity;
  let hall = null, findT = 0, frame = null, unframe = null, walls = null, spots = null, middle = null, front = null, ways = [], hear = false, inside = false, through = 0;
  let songI = Math.max(0, SONGS.indexOf(nextSong({ played: [] }))), intro = true, asked = 0, askT = 0, resting = false;   // (which of SONGS; a song asked for starts without the piano's intro line)
  // a song's course: when it began (ctx time of its first beat), how many lines it goes on, the seconds of it still to
  // play (kept over a pause), the songs played (for the next pick); its end: the phase, the last chord's time, the next
  // song and when it starts, whether it has been named yet
  let songT0 = null, lines = null, left = null, phase = 'play', endAt = null, nextAt = null, nextI = null, named = false, ending = null, awayT = 0, duck = 1;
  const played = [];
  const players = [];

  // ── THE SALOON: its stage's spots in the world (found once the code-built buildings are made; again if it moves) ────
  function findSaloon() {
    const C = W.V && W.V.CODE, o = C && C.find ? C.find('saloon') : null;
    return o && o.code && o.code.B && o.code.B.anchors && o.code.B.anchors.stage ? o : null;
  }
  function place() {
    const g = hall.code.group; g.updateMatrixWorld(true);
    frame = g.matrixWorld.clone();
    const A = hall.code.B.anchors.stage, yaw = new THREE.Euler().setFromRotationMatrix(frame, 'YXZ').y;
    const at = (p) => new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(frame);
    // (the drummer's spot from an older saloon without one: left of the harmonica player, a little back)
    const dr = A.drummer || { x: A.harmonica.x - 1.1, y: A.harmonica.y, z: A.harmonica.z - 0.4, rot: 0.35 };
    // (and the fiddler's, from a saloon without one: right of the harmonica player, toward the piano)
    const fd = A.fiddler || { x: A.harmonica.x + 1.8, y: A.harmonica.y, z: A.harmonica.z - 0.1, rot: -0.35 };
    // (and the banjo player's, from a saloon without one: right of the fiddler, toward the stage's front)
    const bj = A.banjo || { x: fd.x + 1.2, y: fd.y, z: fd.z - 0.1, rot: -0.3 };
    // (and the bass player's: back of the harmonica player, between her and the drummer)
    const bs = A.bass || { x: A.harmonica.x - 0.5, y: A.harmonica.y, z: A.harmonica.z - 0.9, rot: 0.3 };
    spots = { piano: at(A.piano), harmonica: at(A.harmonica), drummer: at(dr), fiddler: at(fd), banjo: at(bj), bass: at(bs), yaw, rot: { piano: A.piano.rot, harmonica: A.harmonica.rot, drummer: dr.rot, fiddler: fd.rot, banjo: bj.rot, bass: bs.rot } };
    middle = new THREE.Vector3().add(spots.piano).add(spots.harmonica).add(spots.drummer).multiplyScalar(1 / 3);
    // the stage's front edge (for the prompt) and the doorways (for the sound through them), in the world
    const R = A.rect, fz = R ? R.z1 : A.front[2];
    front = { a: at({ x: R ? R.x0 : A.front[0] - 2, y: A.floor, z: fz }), b: at({ x: R ? R.x1 : A.front[0] + 2, y: A.floor, z: fz }), floor: at({ x: 0, y: A.floor, z: fz }).y };
    // (the hall: the building's own walls, in its frame, a hand's width in from them, under its roof)
    const F = hall.code.B.anchors.footprint; walls = F && F.building ? { ...F.building, h: F.h } : null; unframe = frame.clone().invert();
    ways = (hall.code.B.anchors.doorways || []).filter((D) => !D.inner).map((D, i) => {
      const c = new THREE.Vector3(...D.centre).applyMatrix4(frame), n = new THREE.Vector3(...D.out).transformDirection(frame); n.y = 0; n.normalize();
      return { i, x: c.x, z: c.z, nx: n.x, nz: n.z };
    });
    for (const p of players) seat(p);
    if (bus) for (const [n, p, y] of bus.at) setPos(n, p(), y);
  }
  // a point in the saloon's hall (not out on its boardwalk under the balcony)
  const LP = new THREE.Vector3();
  function inHall(p) {
    if (!walls) return false;
    LP.set(p.x, p.y, p.z).applyMatrix4(unframe);
    return LP.x > walls.x0 + 0.1 && LP.x < walls.x1 - 0.1 && LP.z > walls.z0 + 0.1 && LP.z < walls.z1 - 0.1 && LP.y < walls.h && LP.y > -1;
  }
  const keyOf = (o) => { o.code.group.updateMatrixWorld(true); const e = o.code.group.matrixWorld.elements; return `${e[12].toFixed(2)},${e[14].toFixed(2)},${e[0].toFixed(3)},${e[8].toFixed(3)}`; };
  let placedKey = '';

  // ── THE PLAYERS ──────────────────────────────────────────────────────────────────────────────────────────────────
  function makePlayers() {
    if (making) return making;
    const looks = [STAGE.pianist, STAGE.harpist, STAGE.drummer, STAGE.fiddler, STAGE.banjoist, STAGE.bassist];
    const bodies = [...new Set(looks.map((p) => (folk.byOutfit[p.outfit] || {}).body).filter(Boolean))];
    making = Promise.all([loadHands(GAME_DIR), ...bodies.map((b) => loader.loadAsync(folk.dir + CLIPS[b]).then((g) => folk.addClips(b, g.animations)))])
      .then(() => {
        if (disposed) return;
        addBassClips(folk);
        const add = (look, who, clip) => {
          const p = makePerson(folk, look); p.who = who;
          // (no sun shadow cast in the hall: the saloon's inside is lit by its bake, its own parts cast none either)
          p.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
          if (!p.play(clip, { fade: 0 })) p.play('Idle', { fade: 0 });
          scene.add(p.root); players.push(p); seat(p);
          return p;
        };
        made = {
          pianist: add(STAGE.pianist, 'piano', 'Play_Piano'),
          harpist: add(STAGE.harpist, 'harmonica', 'Harmonica_Rest'),
          drummer: add(STAGE.drummer, 'drummer', 'Play_Box'),
          fiddler: add(STAGE.fiddler, 'fiddler', 'Fiddle_Rest'),
          banjo: add(STAGE.banjoist, 'banjo', 'Banjo_Rest'),
          bassist: add(STAGE.bassist, 'bass', 'Play_Bass'),
        };
        holdFiddle(made.fiddler); holdBanjo(made.banjo);
        // (the hands set by hand in the Hands Lab, models/people/hands.json: laid over the clips each frame)
        harmonica = makeHarmonica(); scene.add(harmonica);
        drumGear = holdDrumsOn(made.drummer);
        made.pianist.hands = makePianistPose(made.pianist);
        made.drummer.hands = makeHandPose(made.drummer, 'drummer', { props: { stool: drumGear.stool, stickL: drumGear.stickL, stickR: drumGear.stickR } }); drumHands = makeDrumHands(made.drummer, made.drummer.hands, drumGear.parts);
        made.fiddler.hands = makeHandPose(made.fiddler, 'fiddler', { props: { fiddle: fiddleProps && fiddleProps.fiddle, bow: fiddleProps && fiddleProps.bow } });
        made.banjo.hands = makeHandPose(made.banjo, 'banjo', { props: { banjo: banjoProps && banjoProps.banjo, stool: banjoProps && banjoProps.stool } });
        made.harpist.hands = makeHandPose(made.harpist, 'harpist', { props: { harmonica }, harp: STAGE.harp });
        for (const P of [made.harpist, made.banjo, made.fiddler]) P.playLayer = makePlayHands(P, P.hands, P === made.harpist ? 'harpist' : P === made.banjo ? 'banjo' : 'fiddler');
        bassProps = holdBassOn(made.bassist);
        made.bassist.hands = makeHandPose(made.bassist, 'bassist', { props: { bass: bassProps.bass } });
        made.bassist.fret = makeFretHands(made.bassist, made.bassist.hands, 'bass'); made.bassist.pluck = makeBassPluck(made.bassist, made.bassist.hands, made.bassist.fret);
        made.fiddler.fret = makeFretHands(made.fiddler, made.fiddler.hands, 'fiddle'); made.banjo.fret = makeFretHands(made.banjo, made.banjo.hands, 'banjo');
        made.harpist.hands.captureLift(); made.fiddler.hands.captureLift();
        setVisible(visible);
      })
      .catch((e) => console.error('stage: the players could not be made', e));
    return making;
  }
  function seat(p) { if (!spots) return; p.root.position.copy(spots[p.who]); p.root.rotation.y = spots.yaw + spots.rot[p.who]; }
  function setVisible(on) { visible = on; for (const p of players) p.root.visible = on && !(fiddlerOff && p.who === 'fiddler'); if (harmonica) harmonica.visible = on && !resting;  }
  // the harmonica, the fiddle and bow, the banjo and his stool: src/bandgear.js (the Hands Lab shows the same ones)
  let harmonica = null, fiddleProps = null, banjoProps = null, bassProps = null, drumGear = null, drumHands = null, pianoHands = null, keysAllowed = true;
  const makeHarmonica = () => makeHarmonicaModel(STAGE.harp);
  // (the pianist: the same pose layer, and his hands going to the keys of the music's own notes, src/pianohands.js)
  function makePianistPose(P) { const H = makeHandPose(P, 'pianist'); pianoHands = makePianoHands(P, H); return H; }
  function holdFiddle(P) { fiddleProps = holdFiddleOn(P); }
  function holdBanjo(P) { banjoProps = holdBanjoOn(P); }
  // keep a clip on the music's beat: its time set from the beat (the clips are four beats long, made for the first
  // song's beat: a quicker song plays them quicker, a slower one slower)
  function onBeat(p, beat, beatLen) {
    const a = p.person && p.person.cur; if (!a) return;
    const d = a.getClip().duration, want = (((beat % 4) + 4) % 4) / 4 * d, base = d / (4 * beatLen);
    let diff = want - a.time; if (diff > d / 2) diff -= d; if (diff < -d / 2) diff += d;
    if (Math.abs(diff) > 0.08 * base) a.time = want;          // far off (a start, a pause, a new song): jump to it
    else a.setEffectiveTimeScale(base * (1 + Math.max(-0.2, Math.min(0.2, diff * 2 / base))));   // near: ease into step
  }

  // ── THE SOUND ────────────────────────────────────────────────────────────────────────────────────────────────────
  // made the first time the band is heard: a panner at each player, one at the stage for the room's echo, and a bus
  // (the distance's fade and the walls' muffle on the way out)
  let bus = null;
  function setPos(n, p, y) { if (n.positionX) { n.positionX.value = p.x; n.positionY.value = p.y + y; n.positionZ.value = p.z; } else n.setPosition(p.x, p.y + y, p.z); }
  function makeSound(ctx, out) {
    const panner = (p, y) => {
      const n = ctx.createPanner();
      n.panningModel = 'equalpower'; n.distanceModel = 'inverse'; n.refDistance = STAGE.ref; n.rolloffFactor = STAGE.rolloff; n.maxDistance = 10000;
      setPos(n, p, y);
      return n;
    };
    const fade = ctx.createGain(); fade.gain.value = 0;
    const muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 20000; muffle.Q.value = 0.5;
    fade.connect(muffle).connect(out);
    const harp = panner(spots.harmonica, 1.55), piano = panner(spots.piano, 1.0), box = panner(spots.drummer, 0.3), echo = panner(middle, 1.5);
    const fid = panner(spots.fiddler, 1.45);   // (the fiddle, at the fiddler's chest)
    const ban = panner(spots.banjo, 0.75);     // (the banjo, on the banjo player's lap)
    for (const n of [harp, piano, box, fid, ban, echo]) n.connect(fade);
    const room = makeRoom(ctx), wet = ctx.createGain(); wet.gain.value = STAGE.room;
    room.output.connect(wet).connect(echo);
    const harpIn = ctx.createGain(), pianoIn = ctx.createGain(), boxIn = ctx.createGain(); harpIn.gain.value = pianoIn.gain.value = STAGE.level; boxIn.gain.value = STAGE.boxLevel;
    harpIn.connect(harp); pianoIn.connect(piano); boxIn.connect(box);
    const fiddleIn = ctx.createGain(); fiddleIn.gain.value = STAGE.level; fiddleIn.connect(fid);
    const banjoIn = ctx.createGain(); banjoIn.gain.value = STAGE.level; banjoIn.connect(ban);
    const roomIn = ctx.createGain(); roomIn.gain.value = STAGE.level; roomIn.connect(room.input);
    bus = { ctx, fade, muffle, harp, harpIn, pianoIn, boxIn, fiddleIn, banjoIn, roomIn, fiddleKit: null, loading: null, nodes: [fade, muffle, harp, piano, box, fid, ban, echo, wet, harpIn, pianoIn, boxIn, fiddleIn, banjoIn, roomIn, room.output], sent: null,
      at: [[harp, () => spots.harmonica, 1.55], [piano, () => spots.piano, 1.0], [box, () => spots.drummer, 0.3], [fid, () => spots.fiddler, 1.45], [ban, () => spots.banjo, 0.75], [echo, () => middle, 1.5]] };
    loadKit();
    if (STAGE.baked && typeof OfflineAudioContext !== 'undefined') try { bus.baked = bakedBand(ctx.sampleRate); } catch (e) { console.warn('Mathwood Valley: no baked notes', e); }
    // when the sound goes to sleep (a pause, a panel, a hidden tab), the band stops and lets its notes go; it starts a
    // fresh line when the sound wakes. (Asleep, the sound's clock stands still while the notes' own timers don't, so the
    // notes made ahead would be cut off by their own timers meanwhile, and leave a gap after the pause.)
    bus.onState = () => { if (ctx.state !== 'running') stopMusic(true); if (bus) bus.sent = null; };
    ctx.addEventListener('statechange', bus.onState);
    // (the crash on the accents: fetched on the side, the song never waits for it)
    { const b = bus; loadCrash(ctx).then((buf) => { b.crash = buf; }).catch((e) => console.warn('Mathwood Valley: no crash', e)); }
  }
  // the fiddle's samples: loaded once, when the band is first heard with the fiddle in it (STAGE.fiddle, and not left out
  // by the governor: S.fiddleOn)
  let fiddleAllowed = true, musicFiddled = false;
  const crashNow = () => (bus && bus.crash) || null;
  const fiddleOK = () => STAGE.fiddle && fiddleAllowed;
  function loadKit() {
    if (!bus || bus.loading || !fiddleOK()) return;
    const b = bus, t0 = performance.now();
    b.loading = loadFiddle(b.ctx).then((kit) => { b.fiddleKit = kit; b.loadMs = Math.round(performance.now() - t0); if (music && music.setFiddleKit && fiddleOK()) { music.setFiddleKit(kit); musicFiddled = true; } }).catch((e) => console.warn('Mathwood Valley: no fiddle', e));
    // the banjo: the recorded one for now (the synth banjo cost the sound thread about as much again as the rest of the band:
    // crackle on slower machines; banjosynth.js stays, to be played from recordings of its own notes later)
    if (STAGE.banjo) loadBanjo(b.ctx).then((kit) => { b.banjoKit = kit; }).catch((e) => console.warn('Mathwood Valley: no banjo', e));
  }
  function startMusic(at = null) {
    if (music || !bus || resting || phase !== 'play') return;
    const song = SONGS[songI], lineSecs = song.beat * song.bar * 4, open = intro ? lineSecs : 0;
    if (left == null) left = songLines(song, { intro }) * lineSecs;   // (a song begun: how long it goes on)
    // (the lines from what is left of it: a written tune to the end of a round, at least once round)
    lines = song.round ? (intro ? 1 : 0) + Math.max(1, Math.round((left - open) / (song.round * lineSecs))) * song.round : Math.max(1, Math.round(left / lineSecs));
    const kit = fiddleOK() ? bus.fiddleKit : null; musicFiddled = !!kit;
    if (bus.baked) try { bus.baked.start(song.id); } catch (e) { console.warn('Mathwood Valley: baking the notes', e); }
    music = makeStageMusic(bus.ctx, { harp: bus.harpIn, piano: bus.pianoIn, box: bus.boxIn, room: bus.roomIn, seed: 1 + Math.floor(Math.random() * 1e6), song: song.id, intro, fiddle: bus.fiddleIn, fiddleKit: kit, fiddleComing: !kit && fiddleOK(),
      banjo: bus.banjoIn, banjoKit: STAGE.banjo ? bus.banjoKit || null : null, baked: bus.baked || null, crash: crashNow });
    songT0 = at != null ? at : bus.ctx.currentTime + 0.2;
    music.start(songT0);
  }
  // (the seconds of the song still to play, when it stops short of its end: a pause, a break)
  function spent() { if (music && bus && songT0 != null && left != null) left = Math.max(0, left - Math.max(0, bus.ctx.currentTime - songT0)); }
  function stopMusic(now = false) { if (music) { spent(); music.stop({ now }); music = null; } }
  // the notes sounding ring out (the ones made ahead let go), and the band stops
  function ringOut() { if (music && bus) { spent(); music.stop({ from: bus.ctx.currentTime + 0.05 }); music = null; } }
  // the song's end: the notes up to the end of its last line play on, the ones made past it are let go, and the band
  // lands on the home chord there; the crowd claps, the next song is chosen
  function finish(tEnd) {
    const song = SONGS[songI];
    music.stop({ from: tEnd - 0.004 }); music = null;
    ending = playEnding(bus.ctx, { harp: bus.harpIn, piano: bus.pianoIn, box: bus.boxIn, room: bus.roomIn, song, at: tEnd, fiddle: bus.fiddleIn, fiddleKit: musicFiddled ? bus.fiddleKit : null });
    played.push(song.id); if (played.length > 12) played.shift();
    phase = 'end'; endAt = tEnd; named = false; left = null;
    nextI = Math.max(0, SONGS.indexOf(nextSong({ played })));
    nextAt = tEnd + STAGE.end.next;
    if (S.crowd && S.crowd.applaud) try { S.crowd.applaud(tEnd + STAGE.end.clap); } catch (e) { console.error('stage: the crowd could not clap', e); }
  }
  // a song's end let go (the card asked for another, or a break): the last chord too, if it is still to come, and the
  // clapping with it
  function unEnd() {
    if (phase !== 'end') return;
    if (ending && bus && bus.ctx.currentTime < ending.at) { ending.stop(); if (S.crowd && S.crowd.hush) S.crowd.hush(); }
    phase = 'play'; ending = null; nextAt = null;
  }

  const S = { prompt: null, inReach: false };
  // a player says it (and it is read out for a rider who can't read yet)
  function say(who, text) {
    const p = made && made[who];
    if (p) howdy(p, text, { ms: STAGE.say, key: 'band' });
    if (speak) try { speak(text); } catch (e) { /* (no voice) */ }
  }
  // a song asked for: the harmonica player says which; the notes sounding ring out and the new song starts after a
  // breath (or, with the music asleep, when it next starts)
  S.request = (id) => {
    if (disposed) return null;
    const i = Math.max(0, SONGS.findIndex((s) => s.id === id)), same = i === songI && !resting && !!music;   // (the one playing: from the top)
    if (music && !same) { played.push(SONGS[songI].id); if (played.length > 12) played.shift(); }   // (cut short, but heard)
    unEnd();
    songI = i; intro = false; asked++; askT = STAGE.askAgain; resting = false;
    const song = SONGS[songI];
    say('harpist', bandLine(same ? 'same' : 'song', song));
    if (S.crowd && S.crowd.cheer) S.crowd.cheer();   // (now and then someone in the saloon calls out)
    ringOut(); left = null;
    if (bus && bus.ctx.state === 'running' && hear) startMusic(bus.ctx.currentTime + STAGE.between);
    S.prompt = null;
    return song;
  };
  S.ask = () => S.request(SONGS[(songI + 1) % SONGS.length].id);
  S.again = () => {
    if (disposed || !resting) return null;
    resting = false; intro = false; asked++; askT = STAGE.askAgain;
    if (left != null && left < 20) left = null;   // (a song stopped near its end starts afresh)
    say('harpist', bandLine('again', SONGS[songI]));
    if (bus && bus.ctx.state === 'running' && hear) startMusic(bus.ctx.currentTime + STAGE.between);
    return SONGS[songI];
  };
  S.rest = () => {
    if (disposed || resting) return false;
    if (phase === 'end') { unEnd(); songI = nextI; left = null; intro = true; }   // (between songs: the next one is the one played again)
    resting = true; asked++; askT = STAGE.askAgain;
    say('drummer', bandLine('break', SONGS[songI]));
    ringOut();
    if (harmonica) harmonica.visible = false;   // (put away in her pocket)
    return true;
  };
  S.choices = () => bandChoices({ song: SONGS[songI], resting });
  // (rigs) the saloon without its band for a while: none drawn or moved, no music; false: back as they were
  let off = false;
  S.setOff = (on) => { off = !!on; if (off) { stopMusic(true); setVisible(false); S.prompt = null; S.inReach = false; } };

  S.update = (dt, pos) => {
    if (disposed || !pos) return;
    if (off) { if (audio) audio.need('stage', false); return; }
    // the saloon: found (and checked for a move) about once a second
    if ((findT -= dt) <= 0) {
      findT = 1;
      const o = findSaloon();
      if (o !== hall) { hall = o; placedKey = ''; if (!hall) { stopMusic(); setVisible(false); S.prompt = null; S.inReach = false; } }
      if (hall) { const k = keyOf(hall); if (k !== placedKey) { placedKey = k; place(); } }
    }
    if (!hall || !spots) { if (audio) audio.need('stage', false); return; }
    distance = Math.hypot(pos.x - middle.x, pos.z - middle.z);
    // the ears: the camera's place (the panners hear from there), else the player's; in the saloon's hall, or outside
    // (the player in the hall counts as well: a camera squeezed out past a wall doesn't take the kid out of the room)
    const ear = camera ? camera.position : pos;
    inside = inHall(ear) || inHall(pos);
    // the prompt: in the hall, on its floor, near the stage's front edge (and the players there to ask)
    if (askT > 0) askT -= dt;
    const C = hall.code;
    S.inReach = !!made && visible && pos.y < front.floor + 1.2 && segDist(pos, front.a, front.b) < STAGE.ask && inHall(pos);
    S.prompt = S.inReach && askT <= 0 ? PROMPT : null;
    // the players: made ahead of the saloon's inside, drawn while it is
    if (!making && distance < STAGE.make) makePlayers();
    const show = !!made && C.loaded && C.seen !== false;
    if (show !== visible) setVisible(show);
    // the sound: the band plays while the player is in earshot (and not on a break)
    if (audio) {
      hear = !resting && distance < (music || phase === 'end' ? STAGE.far : STAGE.start);
      audio.need('stage', hear);
      if (hear && audio.ctx && !bus) makeSound(audio.ctx, audio.out);
      // (out of earshot a good while: the band has played on, and is on another song when the player comes back)
      if (!hear && !resting && phase === 'play') awayT += dt;
      else if (hear) { if (awayT > STAGE.awayNew && !music) { played.push(SONGS[songI].id); songI = Math.max(0, SONGS.indexOf(nextSong({ played }))); intro = true; left = null; } awayT = 0; }
      if (hear && bus && audio.running) startMusic();
      if (!hear && !resting) stopMusic();
      if (bus && audio.running) {
        // the song's end: found a little ahead of its last line's end (its notes up to there already made); then the
        // pause: the next song named, and started
        const t = bus.ctx.currentTime;
        if (music && phase === 'play' && lines != null && songT0 != null) {
          const song = SONGS[songI], tEnd = songT0 + lines * song.beat * song.bar * 4;
          if (t >= tEnd - STAGE.end.ahead) finish(tEnd);
        }
        if (phase === 'end') {
          if (!named && t >= endAt + STAGE.end.name) { named = true; if (visible) say('harpist', bandLine('next', SONGS[nextI])); }
          if (t >= nextAt - 0.3) { phase = 'play'; songI = nextI; intro = true; left = null; ending = null; if (hear) startMusic(Math.max(nextAt, t + 0.1)); }
        }
      }
      if (bus) {
        const u = Math.max(0, Math.min(1, (distance - STAGE.fade) / (STAGE.far - STAGE.fade)));
        const T = soundThrough({ inside, ways: inside ? [] : ways.map((w) => throughWay(w, ear)) });
        through = T.through;
        const D = STAGE.duck, ducked = !!audio.needs && D.under.some((n) => audio.needs.has(n));
        duck += ((ducked ? D.gain : 1) - duck) * Math.min(1, dt / D.tc);
        const carry = Math.pow(Math.max(1, distance / STAGE.near), STAGE.carry);
        gain = distance < STAGE.far ? (1 - u * u * (3 - 2 * u)) * T.gain * carry * duck : 0;   // (on a break too: the last notes ring out)
        const M = STAGE.muffle, f = Math.max(0, Math.min(1, (distance - M.from) / (M.to - M.from)));
        hz = Math.min(20000 * Math.pow(M.hz / 20000, f), T.hz);
        // only while the sound is awake, and only when the level or the muffle has moved a little: asleep, its clock
        // stands still and every change would pile up waiting at the same moment
        const last = bus.sent;
        if (bus.ctx.state === 'running' && (!last || Math.abs(gain - last.gain) > 0.002 || Math.abs(hz / last.hz - 1) > 0.005)) {
          const t = bus.ctx.currentTime;
          bus.fade.gain.setTargetAtTime(gain, t, 0.15);
          bus.muffle.frequency.setTargetAtTime(hz, t, 0.15);
          bus.sent = { gain, hz };
        }
      }
    }
    if (!made || !visible) return;
    // the players' clips: on the music's beat while it plays (as heard: the output's own delay taken off); resting,
    // their own rest clips at their own pace
    const beat = music && bus ? music.beat() - (bus.ctx.outputLatency || 0) / music.beatLen : null;
    const t = bus ? bus.ctx.currentTime : 0;
    // (between two songs: a breather while the crowd claps, the harmonica in her right hand at her side)
    const between = phase === 'end' && endAt != null && t > endAt + STAGE.end.rest && t < nextAt - STAGE.end.back;
    if (resting || between) {
      for (const [who, clip] of Object.entries(STAGE.restClip)) if (who !== 'harpist') made[who].play(clip, { fade: 0.8 });
    } else {
      made.pianist.play('Play_Piano', { fade: 0.6 }); made.drummer.play('Play_Box', { fade: 0.5 }); made.bassist.play('Play_Bass', { fade: 0.6 });
      if (harmonica && !harmonica.visible) harmonica.visible = true;
    }
    harpStep(dt, t, resting, between);
    fiddlerStep(dt, t, resting || between);
    if (!(resting || between)) made.banjo.play(banjoAt(t) ? 'Play_Banjo' : 'Banjo_Rest', { fade: 0.25 });
    for (const p of players) {
      if (fiddlerOff && p === made.fiddler) continue;
            if (beat != null && !resting) onBeat(p, beat, music.beatLen);
      if (p.hands) p.hands.before();   // (the hands' bends taken off first: the clips don't write what didn't change)
      // (the fret hands go where the song's notes are, near by and off the lowest tier: src/frethands.js)
      const fretNear = p.fret && keysAllowed && W.tier !== 'potato' && distance < STAGE.keys.far, nowH = bus ? bus.ctx.currentTime - (bus.ctx.outputLatency || 0) : 0;
      if (p.fret) p.fret.before(nowH, dt, fretNear && music ? music.events : null, fretNear ? fretWeight(p, t) : 0);
      if (p.pluck) p.pluck.before(nowH, dt, fretNear && music ? music.events : null, fretNear ? fretWeight(p, t) : 0);
      p.update(dt);
      if (p.hands) p.hands.after();
      if (p.playLayer && W.tier !== 'potato' && distance < STAGE.keys.far) p.playLayer.update();
      if (fretNear) { p.fret.after(nowH); if (p.pluck) p.pluck.after(nowH); }
      if (pianoHands && p === made.pianist) {
        const on = keysAllowed && W.tier !== 'potato' && distance < STAGE.keys.far && p.person.actions.Play_Piano;
        const w = on ? p.person.actions.Play_Piano.getEffectiveWeight() : 0;
        const now = bus ? bus.ctx.currentTime - (bus.ctx.outputLatency || 0) : 0;
        pianoHands.update(now, dt, music ? music.events : null, w);
      }
      if (drumHands && p === made.drummer) {
        const near = keysAllowed && W.tier !== 'potato' && distance < STAGE.keys.far, A = p.person.actions.Play_Box, w = A ? A.getEffectiveWeight() : 0;
        drumHands.update(bus ? bus.ctx.currentTime - (bus.ctx.outputLatency || 0) : 0, music ? music.events : null, w, !near, dt);
      }
    }
  };
  // how much a player's fret hand follows the notes: the fiddler's only while the fiddle's up and sounding (it goes home before he lowers it)
  function fretWeight(p, t) {
    if (p === made.fiddler) return fK >= 1 && music && (music.fiddleAt(t) || music.fiddleAt(t - 0.15) || (music.nextFiddle(t) ?? Infinity) - t < 0.3) ? 1 : 0;
    const a = p.person.actions[p === made.banjo ? 'Play_Banjo' : 'Play_Bass'];
    return a ? a.getEffectiveWeight() : 0;
  }
  // THE BANJO PLAYER: picking while a banjo note sounds (or comes within STAGE.banjoHold), from the music's notes
  const banjoAt = (t) => !!music && banjoPlaying(music.events, t, STAGE.banjoHold);
  // THE FIDDLER'S COURSE, from the fiddle's notes (M.fiddleAt / M.nextFiddle): resting (Fiddle_Rest) -> the lift
  // (Fiddle_Up, timed to end on his first note) -> playing (Play_Fiddle, a stroke a beat) while his notes sound and
  // through the short rests inside his turn -> lowering (Fiddle_Down) once it has passed -> resting. At the end of a tune
  // that was his he holds the last chord's note in one long bow, and lowers the fiddle while the crowd claps.
  let fState = 'rest', fK = 0, fEnding = false, fLifts = 0, fiddlerOff = false;
  function fiddlerStep(dt, t, off) {
    const F = made.fiddler, B = STAGE.bowing; if (!F) return;
    let want = 0, next = null;
    if (!off && music) {
      next = music.nextFiddle(t);
      const to = next != null ? next - t : Infinity;
      if (music.fiddleAt(t) || music.fiddleAt(t - B.hold) || to < B.gap || to <= (1 - fK) * B.up + 0.05) want = 1;
      else if (to < B.fiddleUp && fK > 0.3) want = B.fiddleUpAt;
    } else if (!off && phase === 'end' && endAt != null && ending && ending.fiddle) {
      next = endAt; want = t > endAt - B.up - 0.05 && t < endAt + STAGE.end.rest ? 1 : 0;
    }
    fEnding = want === 1 && phase === 'end';
    const was = fK;
    fK = want > fK ? Math.min(want, fK + dt / B.up) : Math.max(want, fK - dt / B.down);
    if (was === 0 && fK > 0) fLifts++;
    fState = fK <= 0 ? 'rest' : fK >= 1 ? 'play' : fK > was ? 'up' : fK < was ? 'down' : 'play';
    between2(F, 'Fiddle_Rest', 'Play_Fiddle', fK);
    // (the last chord: the bow drawn slowly, one long stroke)
    if (fState === 'play' && F.person && F.person.cur) { if (fEnding) F.person.cur.setEffectiveTimeScale(B.ending); }
  }
  // a player between a rest clip and a play clip by how far the lift has got (k 0..1): both clips run, their shares set here,
  // the arms worked through by the pose's own lift (src/handpose.js H.setLift)
  function between2(P, rest, play, k) {
    const acts = P.person.actions, u = k * k * (3 - 2 * k), name = k > 0.5 ? play : rest;
    if (P.clip !== name) { if (P.clip && P.clip !== rest && P.clip !== play) P.play(name, { fade: 0.4 }); else P.play(name, { fade: 0.001 }); }
    for (const n of [rest, play]) { const a = acts[n]; a.stopFading(); if (!a.isRunning()) a.play(); a.enabled = true; a.setEffectiveWeight(n === play ? u : 1 - u); }
    P.hands.setLift(k);
  }
  // THE HARMONICA PLAYER'S COURSE, from her notes: k 0 (at her side) .. 1 (at the mouth). She starts up so that she arrives on
  // the phrase's first note, stays at the mouth through a breath, holds it at her chest through a short gap, lowers it for a
  // longer one. On a break the harmonica is away, and she stands easy (her Idle clip).
  let hK = 0, hIdle = false, hBack = 0;
  function harpStep(dt, t, away, between) {
    const P = made.harpist;
    if (away) {
      if (!hIdle) { hIdle = true; P.hands.setLift(null); for (const n of ['Harmonica_Rest', 'Play_Harmonica']) if (n !== P.clip) { P.person.actions[n].stopFading(); P.person.actions[n].stop(); } P.play('Idle', { fade: 0.8 }); }
      hK = 0; return;
    }
    if (hIdle) { hIdle = false; hBack = 0.4; P.play('Harmonica_Rest', { fade: 0.4 }); }
    if (hBack > 0) { hBack -= dt; if (hBack > 0) return; }
    let want = 0;
    if (between) want = 0;
    else if (music) {
      const next = music.nextHarmonica(t), to = next != null ? next - t : Infinity, tail = 0.12;
      if (music.harmonicaAt(t) || music.harmonicaAt(t - tail) || to <= (1 - hK) * STAGE.lift + 0.05 || to < STAGE.mouthGap) want = 1;
      else if (to < STAGE.chestGap) want = STAGE.chest;
    } else if (phase === 'end' && endAt != null && t > endAt - STAGE.lift && t < endAt + 2.0) want = 1;   // (the last chord's held note)
    hK = want > hK ? Math.min(want, hK + dt / STAGE.lift) : Math.max(want, hK - dt / STAGE.lower);
    between2(P, 'Harmonica_Rest', 'Play_Harmonica', hK);
  }
  // (the governor) the fiddle in the band, or left out: the harmonica then plays its turns and the fiddler only stands
  // with his fiddle; on, its samples load if they haven't
  // (the lowest tier) the pianist's hands left to his clip and his set pose
  S.keysOn = (on) => { keysAllowed = !!on; };
  S.pianoHands = () => pianoHands;
  S.drumHands = () => drumHands;
  S.fiddleOn = (on) => { fiddleAllowed = !!on; if (fiddleAllowed) loadKit(); };
  // a doorway as heard from the ears: how far, how square in front of it, how open its doors stand (the saloon's batwings
  // rest open: as open as a doorway with no door)
  function throughWay(w, ear) {
    const dx = ear.x - w.x, dz = ear.z - w.z, dist = Math.hypot(dx, dz) || 1e-3;
    const doors = hall.code.doors.filter((d) => d.way === w.i);
    const open = doors.length ? Math.max(...doors.map((d) => d.t)) : 1;
    return { dist, facing: (dx * w.nx + dz * w.nz) / dist, open };
  }
  // for rigs: a steady tone in place of the band (the music muted meanwhile), through the harmonica's positioned sound and
  // the same fades, to measure how the level changes with distance and the walls without the tune's own ups and downs
  let tone = null;
  S.testTone = (on) => {
    if (!bus) return false;
    const t = bus.ctx.currentTime;
    if (on && !tone) { tone = bus.ctx.createOscillator(); tone.frequency.value = 440; tone.g = bus.ctx.createGain(); tone.g.gain.value = 0.2; tone.connect(tone.g).connect(bus.harp); tone.start(); }
    if (!on && tone) { tone.stop(); tone.g.disconnect(); tone = null; }
    for (const g of [bus.harpIn, bus.pianoIn, bus.fiddleIn, bus.banjoIn, bus.roomIn]) g.gain.setValueAtTime(on ? 0 : STAGE.level, t);
    bus.boxIn.gain.setValueAtTime(on ? 0 : STAGE.boxLevel, t);
    return true;
  };
  S.state = () => ({ near: visible, made: !!made, playing: !!music, resting, inside, through: +through.toFixed(3), gain, hz: Math.round(hz), distance, saloon: !!hall,
    clips: players.map((p) => p.clip), notes: music ? music.played : 0, context: audio && audio.ctx ? audio.ctx.state : 'none', song: SONGS[songI].id, asked,
    prompt: S.prompt, inReach: S.inReach, beatLen: music ? music.beatLen : null, harmonica: !!(harmonica && harmonica.visible),
    fiddler: fState, fiddleLifts: fLifts, liftH: +hK.toFixed(3), liftF: +fK.toFixed(3), banjoist: made ? made.banjo.clip : null, banjoIn: STAGE.banjo, fiddleIn: fiddleOK(), fiddleKit: !!(bus && bus.fiddleKit), fiddleLoadMs: bus ? bus.loadMs || null : null, fiddling: musicFiddled && !!music,
    endingFiddle: !!(ending && ending.fiddle), fiddleKitMB: bus && bus.fiddleKit ? +(bus.fiddleKit.reduce((n, x) => n + x.buf.length * x.buf.numberOfChannels * 4, 0) / 1048576).toFixed(2) : null,
    phase, played: played.slice(-6), next: phase === 'end' && nextI != null ? SONGS[nextI].id : null, lines, songAt: songT0, endAt, nextAt, left: left == null ? null : +left.toFixed(1),
    duck: +duck.toFixed(3), now: bus ? bus.ctx.currentTime : null, baked: bus && bus.baked ? bus.baked.stats() : null });
  // (rigs) the song ends at the end of the line playing now, as it would on its own
  S.endSong = () => {
    if (!music || !bus || phase !== 'play') return false;
    const song = SONGS[songI], L = song.beat * song.bar * 4, k = Math.floor((bus.ctx.currentTime - songT0) / L);
    lines = k + ((songT0 + (k + 1) * L) - bus.ctx.currentTime > STAGE.end.ahead + 0.3 ? 1 : 2);
    return songT0 + lines * L;
  };
  // the band's sound path for the crowd's own sounds (their clapping): into the band's distance and walls
  S.soundIn = () => (bus ? { ctx: bus.ctx, input: bus.fade, room: bus.roomIn } : null);
  Object.defineProperty(S, 'phase', { get: () => phase });
  Object.defineProperty(S, 'song', { get: () => SONGS[songI] });
  Object.defineProperty(S, 'resting', { get: () => resting });
  // (rigs) an analyser on the band's own sound, after its fades (what reaches the game's mix from the stage); 'fiddle':
  // on the fiddle's own input alone (before its panner)
  S.analyser = (which = null) => {
    if (!bus) return null;
    const k = which === 'fiddle' ? 'anF' : 'an';
    if (!bus[k]) { bus[k] = bus.ctx.createAnalyser(); bus[k].fftSize = 4096; (which === 'fiddle' ? bus.fiddleIn : bus.muffle).connect(bus[k]); bus.nodes.push(bus[k]); }
    return bus[k];
  };
  // (rigs) the band without its fiddler (not drawn or moved, the fiddle left out of the music) while on, to measure him
  S.setFiddlerOff = (on) => { fiddlerOff = !!on; S.fiddleOn(!on); if (made) made.fiddler.root.visible = visible && !fiddlerOff; };
  Object.defineProperty(S, 'spots', { get: () => spots });
  Object.defineProperty(S, 'music', { get: () => music });
  Object.defineProperty(S, 'players', { get: () => made });
  S.dispose = () => {
    disposed = true; stopMusic(); if (ending) ending.stop(); S.prompt = null; S.inReach = false;
    if (audio) audio.need('stage', false);
    if (bus) { const b = bus; bus = null; b.ctx.removeEventListener('statechange', b.onState); b.fade.gain.setTargetAtTime(0, b.ctx.currentTime, 0.05); setTimeout(() => { for (const n of b.nodes) try { n.disconnect(); } catch (e) { /* gone */ } }, 400); }
    for (const p of players) { p.root.removeFromParent(); p.dispose(); }
    players.length = 0; made = null;
    for (const o of [harmonica, drumGear && drumGear.kit, drumGear && drumGear.stool, drumGear && drumGear.stickL, drumGear && drumGear.stickR]) if (o) { o.removeFromParent(); o.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } }); }
    harmonica = drumGear = drumHands = null;
    if (pianoHands) { pianoHands.dispose(); pianoHands = null; }
    if (bassProps) { bassProps.bass.removeFromParent(); bassProps.bass.geometry.dispose(); bassProps.mat.dispose(); bassProps = null; }
    if (banjoProps) { for (const m of [banjoProps.banjo, banjoProps.stool]) { m.removeFromParent(); m.geometry.dispose(); } banjoProps.mat.dispose(); banjoProps = null; }
    if (fiddleProps) { for (const m of [fiddleProps.fiddle, fiddleProps.bow]) { m.removeFromParent(); m.geometry.dispose(); } fiddleProps.mat.dispose(); fiddleProps = null; }
  };
  return S;
}

// the distance (on the ground) from p to the segment a-b
function segDist(p, a, b) {
  const ax = b.x - a.x, az = b.z - a.z, L = ax * ax + az * az || 1;
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * ax + (p.z - a.z) * az) / L));
  return Math.hypot(p.x - (a.x + ax * u), p.z - (a.z + az * u));
}
