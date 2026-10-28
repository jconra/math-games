// THE BAND: three players on the stage inside the saloon (labs/buildings/saloon.js, a code-built building). A piano
// player sits at the saloon's upright piano, a harmonica player stands at the front of the stage and a drummer sits on a
// packing crate at its left and plays the crate with his hands (folk.js people in period colours). The music they play
// (src/audio/stagemusic.js) comes from where they are: each instrument is its own positioned sound (a PannerNode; the
// camera is the ears). In the hall it is full and open; outside, it comes through the saloon's walls quiet and muffled,
// and more of it, brighter, near a doorway and in front of it (src/bandplan.js soundThrough), fading away down the
// street and, past a few dozen metres, not running at all.
//
// The players' clips (Play_Piano, Piano_Rest, Play_Harmonica, Harmonica_Rest, Play_Box, Box_Rest, made in Blender:
// ~/pw/bandit-math/rigs/clips/build_stage_clips.py, files models/people/clips_stage_m.glb and _f.glb) are four beats of
// the music long; while the music plays they are kept on its beat (the harmonica player's foot taps with it, the pianist
// nods with it, the drummer's hands land on it), and the harmonica player lifts the harmonica for each phrase and lowers
// it between.
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
//   S.players               { pianist, harpist, drummer } once made (or null);  S.spots  their places in the world
//   S.state()               for rigs: { near, made, playing, resting, inside, through, gain, hz, distance, clips, song, ... }
//   S.analyser()            for rigs: an AnalyserNode on the band's sound as it goes into the game's mix (or null)
//   S.setOff(on)            for rigs: the saloon without its band (none drawn, moved or heard) while on
//   S.dispose()
// With no saloon in the town (W.V.CODE has none, or it has no stage) the handle waits for one, quiet: no players, no
// music and no prompt.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makePerson } from './actors/folk.js';
import { makeStageMusic, makeRoom, SONGS } from './audio/stagemusic.js';
import { bandChoices, bandLine, soundThrough } from './bandplan.js';
import { howdy } from './ui/howdy.js';

export const STAGE = {
  // who plays (folk.js looks)
  pianist: { outfit: 'suit_m', palette: 'townsman', skin: 4, hair: 1 },
  harpist: { outfit: 'adventurer_f', palette: 'prairie', skin: 1, hair: 5 },
  drummer: { outfit: 'worker_m', palette: 'rancher', skin: 3, hair: 2 },
  // the drummer's packing crate (metres: across, front to back, tall; as build_stage_clips.py's BOX, which he sits on)
  crate: { w: 0.5, d: 0.38, h: 0.4 },
  make: 45,               // metres from the saloon's middle within which the players are made (hidden till its inside is in)
  near: 16,               // metres from the stage: full volume (as near things are: the distance itself still softens it)
  far: 70,                // metres: silent; past this the music stops
  start: 60,              // metres: the music starts again when the player comes this near
  level: 3.5,             // the band's loudness (the patches are written quieter, for the Sound Lab)
  boxLevel: 3.2,          // the drummer's crate's loudness
  room: 0.6,              // how much of the room's echo
  // the positioned sound: full at refDistance metres, softening as 1 / distance past it (rolloff: how fast)
  ref: 3, rolloff: 1.1,
  muffle: { from: 12, to: 70, hz: 1100 },    // the far sound loses its highs (air, the buildings): open at `from` m, down
                                             // to `hz` at `to` m (the saloon's walls muffle it more: src/bandplan.js)
  lift: 0.6,              // s before a harmonica phrase that the player lifts it to the mouth (and after, keeps it there)
  // the harmonica in her hands (metres: long, tall, deep; how far it sits behind the middle of her hands, toward her, and
  // above it: at the lips while she plays)
  harp: { long: 0.105, tall: 0.026, deep: 0.028, back: 0.035, up: 0.022 },
  ask: 3.2,               // metres from the stage's front edge where the band can be asked
  between: 1.4,           // s from asking to the next song's first beat (what was sounding rings out meanwhile)
  askAgain: 1.2,          // s after an ask before the prompt comes back (a double tap doesn't skip a song)
  say: 4200,              // ms a player's answer stays up
  restClip: { pianist: 'Piano_Rest', harpist: 'Idle', drummer: 'Box_Rest' },
};
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const CLIPS = { m: 'clips_stage_m.glb', f: 'clips_stage_f.glb' };
const PROMPT = 'Ask the band for a song';

export function makeStage({ W, folk, audio, camera = null, scene = W.scene, speak = null }) {
  let disposed = false, made = null, making = null, visible = false, music = null, gain = 0, hz = 20000, distance = Infinity;
  let hall = null, findT = 0, frame = null, unframe = null, walls = null, spots = null, middle = null, front = null, ways = [], hear = false, inside = false, through = 0;
  let songI = 0, intro = true, asked = 0, askT = 0, resting = false;   // (which of SONGS; a song asked for starts without the piano's intro line)
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
    spots = { piano: at(A.piano), harmonica: at(A.harmonica), drummer: at(dr), yaw, rot: { piano: A.piano.rot, harmonica: A.harmonica.rot, drummer: dr.rot } };
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
    if (crate) seatCrate();
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
    const looks = [STAGE.pianist, STAGE.harpist, STAGE.drummer];
    const bodies = [...new Set(looks.map((p) => (folk.byOutfit[p.outfit] || {}).body).filter(Boolean))];
    making = Promise.all(bodies.map((b) => loader.loadAsync(folk.dir + CLIPS[b]).then((g) => folk.addClips(b, g.animations))))
      .then(() => {
        if (disposed) return;
        const add = (look, who, clip) => {
          const p = makePerson(folk, look); p.who = who;
          // (no sun shadow cast in the hall: the saloon's inside is lit by its bake, its own parts cast none either)
          p.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
          p.play(clip, { fade: 0 });
          scene.add(p.root); players.push(p); seat(p);
          return p;
        };
        made = {
          pianist: add(STAGE.pianist, 'piano', 'Play_Piano'),
          harpist: add(STAGE.harpist, 'harmonica', 'Harmonica_Rest'),
          drummer: add(STAGE.drummer, 'drummer', 'Play_Box'),
        };
        harmonica = makeHarmonica(); scene.add(harmonica);
        crate = makeCrate(); scene.add(crate); seatCrate();
        setVisible(visible);
      })
      .catch((e) => console.error('stage: the players could not be made', e));
    return making;
  }
  function seat(p) { if (!spots) return; p.root.position.copy(spots[p.who]); p.root.rotation.y = spots.yaw + spots.rot[p.who]; }
  function setVisible(on) { visible = on; for (const p of players) p.root.visible = on; if (harmonica) harmonica.visible = on && !resting; if (crate) crate.visible = on; }
  // the harmonica: a little metal box with the wooden comb showing along its front, so the cupped hands read as playing
  // one. Each frame it goes between her hands: along the line between them, its front facing out.
  let harmonica = null;
  const HB = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), x: new THREE.Vector3(),
    y: new THREE.Vector3(), z: new THREE.Vector3(), m: new THREE.Matrix4() };
  function makeHarmonica() {
    const H = STAGE.harp, g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0xd4d8dc, metalness: 0.35, roughness: 0.3 });   // (the world has no reflections to show, so a fully metal surface would look black)
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4426, metalness: 0, roughness: 0.8 });
    const cover = new THREE.Mesh(new THREE.BoxGeometry(H.long, H.tall, H.deep * 0.8), metal); cover.position.z = -H.deep * 0.1;
    const comb = new THREE.Mesh(new THREE.BoxGeometry(H.long * 0.96, H.tall * 0.4, H.deep), wood);
    g.add(cover, comb);
    return g;
  }
  function placeHarmonica(P) {
    const B = P.bones; if (!B.WristL || !B.WristR || !B.Index1L || !B.Index1R) return;
    const { a, b, c, d, x, y, z, m } = HB;
    B.WristL.getWorldPosition(a); B.WristR.getWorldPosition(b); B.Index1L.getWorldPosition(c); B.Index1R.getWorldPosition(d);
    const mid = c.add(d).add(a).add(b).multiplyScalar(0.25);
    x.subVectors(B.Index1L.getWorldPosition(a), B.Index1R.getWorldPosition(d)).normalize();   // (toward her left hand)
    z.set(Math.sin(P.root.rotation.y), 0, Math.cos(P.root.rotation.y));                        // (the way she faces)
    y.crossVectors(z, x).normalize(); z.crossVectors(x, y);
    m.makeBasis(x, y, z); harmonica.quaternion.setFromRotationMatrix(m);
    harmonica.position.copy(mid).addScaledVector(z, -STAGE.harp.back).addScaledVector(y, STAGE.harp.up);
  }
  // the drummer's packing crate: rough boards across each face with dark gaps between, a batten up each corner and a
  // stencilled band of darker wood, in plain colours (one mesh, one material)
  let crate = null;
  function makeCrate() {
    const { w, d, h } = STAGE.crate, parts = [], col = new THREE.Color();
    const board = (sx, sy, sz, x, y, z, tone) => {
      const g = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed(); g.translate(x, y, z);
      col.setRGB(0.25 * tone, 0.15 * tone, 0.075 * tone);   // (linear: a weathered pine brown)
      const c = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) c.set([col.r, col.g, col.b], i);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3)); parts.push(g);
    };
    // (a dark core, so the gaps between the boards show)
    board(w - 0.03, h - 0.03, d - 0.03, 0, h / 2, 0, 0.35);
    const n = 4, bh = h / n, tones = [1.0, 0.86, 0.95, 0.8, 1.05, 0.9];
    for (let i = 0; i < n; i++) {
      const y = bh * (i + 0.5), t = tones[i % tones.length];
      board(w, bh - 0.012, 0.018, 0, y, d / 2 - 0.009, t); board(w, bh - 0.012, 0.018, 0, y, -d / 2 + 0.009, t * 0.95);
      board(0.018, bh - 0.012, d - 0.036, w / 2 - 0.009, y, 0, t * 0.92); board(0.018, bh - 0.012, d - 0.036, -w / 2 + 0.009, y, 0, t * 0.97);
    }
    for (let i = 0; i < 3; i++) board(w - 0.01, 0.018, d / 3 - 0.01, 0, h - 0.009, -d / 2 + d / 3 * (i + 0.5), tones[i + 2]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) board(0.04, h, 0.04, sx * (w / 2 - 0.012), h / 2, sz * (d / 2 - 0.012), 0.7);
    const geo = mergeGeometries(parts); for (const g of parts) g.dispose();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }));
    m.castShadow = false; m.receiveShadow = true; m.name = 'band crate';
    return m;
  }
  function seatCrate() { if (!spots) return; crate.position.copy(spots.drummer); crate.rotation.y = spots.yaw + spots.rot.drummer; }
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
    for (const n of [harp, piano, box, echo]) n.connect(fade);
    const room = makeRoom(ctx), wet = ctx.createGain(); wet.gain.value = STAGE.room;
    room.output.connect(wet).connect(echo);
    const harpIn = ctx.createGain(), pianoIn = ctx.createGain(), boxIn = ctx.createGain(); harpIn.gain.value = pianoIn.gain.value = STAGE.level; boxIn.gain.value = STAGE.boxLevel;
    harpIn.connect(harp); pianoIn.connect(piano); boxIn.connect(box);
    const roomIn = ctx.createGain(); roomIn.gain.value = STAGE.level; roomIn.connect(room.input);
    bus = { ctx, fade, muffle, harp, harpIn, pianoIn, boxIn, roomIn, nodes: [fade, muffle, harp, piano, box, echo, wet, harpIn, pianoIn, boxIn, roomIn, room.output], sent: null,
      at: [[harp, () => spots.harmonica, 1.55], [piano, () => spots.piano, 1.0], [box, () => spots.drummer, 0.3], [echo, () => middle, 1.5]] };
    // when the sound goes to sleep (a pause, a panel, a hidden tab), the band stops and lets its notes go; it starts a
    // fresh line when the sound wakes. (Asleep, the sound's clock stands still while the notes' own timers don't, so the
    // notes made ahead would be cut off by their own timers meanwhile, and leave a gap after the pause.)
    bus.onState = () => { if (ctx.state !== 'running') stopMusic(true); if (bus) bus.sent = null; };
    ctx.addEventListener('statechange', bus.onState);
  }
  function startMusic(at = null) {
    if (music || !bus || resting) return;
    music = makeStageMusic(bus.ctx, { harp: bus.harpIn, piano: bus.pianoIn, box: bus.boxIn, room: bus.roomIn, seed: 1 + Math.floor(Math.random() * 1e6), song: SONGS[songI].id, intro });
    music.start(at != null ? at : bus.ctx.currentTime + 0.2);
  }
  function stopMusic(now = false) { if (music) { music.stop({ now }); music = null; } }
  // the notes sounding ring out (the ones made ahead let go), and the band stops
  function ringOut() { if (music && bus) { music.stop({ from: bus.ctx.currentTime + 0.05 }); music = null; } }

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
    songI = i; intro = false; asked++; askT = STAGE.askAgain; resting = false;
    const song = SONGS[songI];
    say('harpist', bandLine(same ? 'same' : 'song', song));
    ringOut();
    if (bus && bus.ctx.state === 'running' && hear) startMusic(bus.ctx.currentTime + STAGE.between);
    S.prompt = null;
    return song;
  };
  S.ask = () => S.request(SONGS[(songI + 1) % SONGS.length].id);
  S.again = () => {
    if (disposed || !resting) return null;
    resting = false; intro = false; asked++; askT = STAGE.askAgain;
    say('harpist', bandLine('again', SONGS[songI]));
    if (bus && bus.ctx.state === 'running' && hear) startMusic(bus.ctx.currentTime + STAGE.between);
    return SONGS[songI];
  };
  S.rest = () => {
    if (disposed || resting) return false;
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
      hear = !resting && distance < (music ? STAGE.far : STAGE.start);
      audio.need('stage', hear);
      if (hear && audio.ctx && !bus) makeSound(audio.ctx, audio.out);
      if (hear && bus && audio.running) startMusic();
      if (!hear && !resting) stopMusic();
      if (bus) {
        const u = Math.max(0, Math.min(1, (distance - STAGE.near) / (STAGE.far - STAGE.near)));
        const T = soundThrough({ inside, ways: inside ? [] : ways.map((w) => throughWay(w, ear)) });
        through = T.through;
        gain = distance < STAGE.far ? (1 - u * u * (3 - 2 * u)) * T.gain : 0;   // (on a break too: the last notes ring out)
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
    if (resting) {
      for (const [who, clip] of Object.entries(STAGE.restClip)) made[who].play(clip, { fade: 0.8 });
    } else {
      const playing = music && (music.harmonicaAt(t + STAGE.lift) || music.harmonicaAt(t) || music.harmonicaAt(t - STAGE.lift * 0.5));
      made.harpist.play(playing ? 'Play_Harmonica' : 'Harmonica_Rest', { fade: 0.45 });
      made.pianist.play('Play_Piano', { fade: 0.6 }); made.drummer.play('Play_Box', { fade: 0.5 });
      if (harmonica && !harmonica.visible) harmonica.visible = true;
    }
    for (const p of players) { if (beat != null && !resting) onBeat(p, beat, music.beatLen); p.update(dt); }
    if (harmonica && harmonica.visible) { made.harpist.root.updateMatrixWorld(true); placeHarmonica(made.harpist); }
  };
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
    for (const g of [bus.harpIn, bus.pianoIn, bus.roomIn]) g.gain.setValueAtTime(on ? 0 : STAGE.level, t);
    bus.boxIn.gain.setValueAtTime(on ? 0 : STAGE.boxLevel, t);
    return true;
  };
  S.state = () => ({ near: visible, made: !!made, playing: !!music, resting, inside, through: +through.toFixed(3), gain, hz: Math.round(hz), distance, saloon: !!hall,
    clips: players.map((p) => p.clip), notes: music ? music.played : 0, context: audio && audio.ctx ? audio.ctx.state : 'none', song: SONGS[songI].id, asked,
    prompt: S.prompt, inReach: S.inReach, beatLen: music ? music.beatLen : null, harmonica: !!(harmonica && harmonica.visible) });
  Object.defineProperty(S, 'song', { get: () => SONGS[songI] });
  Object.defineProperty(S, 'resting', { get: () => resting });
  // (rigs) an analyser on the band's own sound, after its fades (what reaches the game's mix from the stage)
  S.analyser = () => { if (!bus) return null; if (!bus.an) { bus.an = bus.ctx.createAnalyser(); bus.an.fftSize = 4096; bus.muffle.connect(bus.an); bus.nodes.push(bus.an); } return bus.an; };
  Object.defineProperty(S, 'spots', { get: () => spots });
  Object.defineProperty(S, 'music', { get: () => music });
  Object.defineProperty(S, 'players', { get: () => made });
  S.dispose = () => {
    disposed = true; stopMusic(); S.prompt = null; S.inReach = false;
    if (audio) audio.need('stage', false);
    if (bus) { const b = bus; bus = null; b.ctx.removeEventListener('statechange', b.onState); b.fade.gain.setTargetAtTime(0, b.ctx.currentTime, 0.05); setTimeout(() => { for (const n of b.nodes) try { n.disconnect(); } catch (e) { /* gone */ } }, 400); }
    for (const p of players) { p.root.removeFromParent(); p.dispose(); }
    players.length = 0; made = null;
    for (const o of [harmonica, crate]) if (o) { o.removeFromParent(); o.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } }); }
    harmonica = crate = null;
  };
  return S;
}

// the distance (on the ground) from p to the segment a-b
function segDist(p, a, b) {
  const ax = b.x - a.x, az = b.z - a.z, L = ax * ax + az * az || 1;
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * ax + (p.z - a.z) * az) / L));
  return Math.hypot(p.x - (a.x + ax * u), p.z - (a.z + az * u));
}
