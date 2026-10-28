// THE STAGE: a band on the town's open-air stage. A piano player sits at the stage's piano and a harmonica player stands at
// the front (folk.js people in period colours), and the music they play (src/audio/stagemusic.js) comes from where they
// are: each instrument is its own positioned sound (a PannerNode; the camera is the ears), louder as you walk up, fading
// away as you leave the town and, past a couple of hundred metres, not running at all.
//
// The players' clips (Play_Piano, Play_Harmonica, Harmonica_Rest, made in Blender: ~/pw/bandit-math/rigs/clips/
// build_stage_clips.py, files models/people/clips_stage_m.glb and _f.glb) are four beats of the music long; while the
// music plays they are kept on its beat (the harmonica player's foot taps with it, the pianist nods with it), and the
// harmonica player lifts the harmonica for each phrase and lowers it between.
//
// The players are only made, drawn and moved near the town (STAGE.show); out on the trail they cost nothing.
//
// The band knows a few songs (src/audio/stagemusic.js SONGS: an easy one, a quick one, a waltz, a slow lonesome one).
// Walk (or ride) up to the front of the stage and the prompt says "Ask the band for another song": E (or a tap on the
// prompt) asks, the harmonica player says which one they'll play in a speech bubble (src/ui/howdy.js; read out for a
// rider who can't read yet), the notes already sounding ring out, and after a breath the band strikes up the next song,
// harmonica and all. Each ask moves on to the next song, round and round.
//
//   const S = makeStage({ W, folk, audio, scene, speak })   folk: the people (src/actors/folk.js); audio: src/audio/audio.js's;
//                           speak(text): says a line out loud for a rider who can't read yet (or null)
//   S.update(dt, at)        each frame while riding: at = the player's position
//   S.prompt                'Ask the band for another song' when the player is at the front of the stage, else null
//   S.ask()                 asks the band for another song (as E does there): -> the song asked for ({ id, name, ... })
//   S.song                  the song the band plays (or will play when the music next starts): one of SONGS
//   S.music                 the stage music while it plays (or null)
//   S.state()               for rigs: { near, made, playing, gain, distance, clips, song, asked }
//   S.analyser()            for rigs: an AnalyserNode on the band's sound as it goes into the game's mix (or null)
//   S.dispose()
// With no stage in the town (W.places.stage missing) the handle is a quiet one: no players, no music, no prompt.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { makePerson } from './actors/folk.js';
import { makeStageMusic, makeRoom, SONGS } from './audio/stagemusic.js';
import { howdy } from './ui/howdy.js';

export const STAGE = {
  // where the players are, in the stage model's own frame as the town stands it (metres: x across its front, y up from
  // its lowest point, z toward its front; measured: ~/pw/bandit-math/rigs/stage/rays.cjs). The stool's middle, on the
  // stage floor, and the way the keys face from it (radians, as three's rotation.y); the harmonica player's spot.
  piano: { x: 1.107, y: 1.118, z: -0.817, rot: 2.0508 },
  harmonica: { x: -0.35, y: 1.118, z: 1.15, rot: 0.12 },
  // who plays (folk.js looks)
  pianist: { outfit: 'suit_m', palette: 'townsman', skin: 4, hair: 1 },
  harpist: { outfit: 'adventurer_f', palette: 'prairie', skin: 1, hair: 5 },
  show: 140,              // metres from the stage within which the players are drawn and moved
  near: 45,               // metres: full volume (as near things are: the distance itself still softens it)
  far: 110,               // metres: silent; past this the music stops
  start: 100,             // metres: the music starts again when the player comes this near
  level: 3.5,             // the band's loudness (the patches are written quieter, for the Sound Lab)
  room: 0.6,              // how much of the little room's echo
  // the positioned sound: full at refDistance metres, softening as 1 / distance past it (rolloff: how fast)
  ref: 3, rolloff: 1.1,
  muffle: { from: 12, to: 110, hz: 1100 },   // the far sound loses its highs (air, the buildings): open at `from` m, down
                                             // to `hz` at `to` m
  lift: 0.6,              // s before a harmonica phrase that the player lifts it to the mouth (and after, keeps it there)
  // the harmonica in her hands (metres: long, tall, deep; how far it sits behind the middle of her hands, toward her, and
  // above it: at the lips while she plays)
  harp: { long: 0.105, tall: 0.026, deep: 0.028, back: 0.035, up: 0.022 },
  ask: 6.5,               // metres from the front of the stage (or inside the crowd's patch) where the band can be asked
  between: 1.4,           // s from asking to the next song's first beat (what was sounding rings out meanwhile)
  askAgain: 2.5,          // s after an ask before the prompt comes back (a double tap doesn't skip a song)
  say: 4200,              // ms the harmonica player's answer stays up
};
const GAME = new URL('../', import.meta.url).href;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const CLIPS = { m: 'clips_stage_m.glb', f: 'clips_stage_f.glb' };

export function makeStage({ W, folk, audio, scene = W.scene, speak = null }) {
  const place = W.places.stage;
  // no stage in the town (the layout's decor took it away: the band is to play inside the saloon, later): no band, no
  // music and no prompt, rather than the players standing at the world's middle
  if (!place) return quietStage();
  // the stage model's frame in the world (the village's own object for it when there is one; else from the places)
  const frame = new THREE.Matrix4();
  {
    const o = W.V && W.V.TOWN && W.V.TOWN.village && W.V.TOWN.village.objs && W.V.TOWN.village.objs.get('stage');
    if (o && o.group) { o.group.updateMatrixWorld(true); frame.copy(o.group.matrixWorld); }
    else if (place) frame.compose(new THREE.Vector3(place.x, W.heightAt(place.x, place.z), place.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), place.rot), new THREE.Vector3(1, 1, 1));
  }
  const yawOf = new THREE.Euler().setFromRotationMatrix(frame, 'YXZ').y;
  const at = (p) => new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(frame);
  const spots = { piano: at(STAGE.piano), harmonica: at(STAGE.harmonica) };
  const middle = new THREE.Vector3().addVectors(spots.piano, spots.harmonica).multiplyScalar(0.5);

  let disposed = false, made = null, making = null, visible = false, music = null, gain = 0, distance = Infinity;
  const players = [];

  // ── THE PLAYERS ──────────────────────────────────────────────────────────────────────────────────────────────────
  function makePlayers() {
    if (making) return making;
    const bodies = [...new Set([STAGE.pianist, STAGE.harpist].map((p) => (folk.byOutfit[p.outfit] || {}).body).filter(Boolean))];
    making = Promise.all(bodies.map((b) => loader.loadAsync(folk.dir + CLIPS[b]).then((g) => folk.addClips(b, g.animations))))
      .then(() => {
        if (disposed) return;
        const add = (look, spot, rot, clip) => {
          const p = makePerson(folk, look);
          p.root.position.copy(spot); p.root.rotation.y = yawOf + rot;
          p.play(clip, { fade: 0 });
          scene.add(p.root); players.push(p);
          return p;
        };
        made = {
          pianist: add(STAGE.pianist, spots.piano, STAGE.piano.rot, 'Play_Piano'),
          harpist: add(STAGE.harpist, spots.harmonica, STAGE.harmonica.rot, 'Harmonica_Rest'),
        };
        harmonica = makeHarmonica(); scene.add(harmonica);
        setVisible(visible);
      })
      .catch((e) => console.error('stage: the players could not be made', e));
    return making;
  }
  function setVisible(on) { visible = on; for (const p of players) p.root.visible = on; if (harmonica) harmonica.visible = on; }
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
    x.subVectors(B.Index1L.getWorldPosition(a), B.Index1R.getWorldPosition(d)).normalize();   // toward her left hand
    z.set(Math.sin(P.root.rotation.y), 0, Math.cos(P.root.rotation.y));                        // the way she faces
    y.crossVectors(z, x).normalize(); z.crossVectors(x, y);
    m.makeBasis(x, y, z); harmonica.quaternion.setFromRotationMatrix(m);
    harmonica.position.copy(mid).addScaledVector(z, -STAGE.harp.back).addScaledVector(y, STAGE.harp.up);
  }
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
  let bus = null;
  function makeSound(ctx, out) {
    const panner = (p, y) => {
      const n = ctx.createPanner();
      n.panningModel = 'equalpower'; n.distanceModel = 'inverse'; n.refDistance = STAGE.ref; n.rolloffFactor = STAGE.rolloff; n.maxDistance = 10000;
      if (n.positionX) { n.positionX.value = p.x; n.positionY.value = p.y + y; n.positionZ.value = p.z; } else n.setPosition(p.x, p.y + y, p.z);
      return n;
    };
    const fade = ctx.createGain(); fade.gain.value = 0;
    const muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 20000; muffle.Q.value = 0.5;
    fade.connect(muffle).connect(out);
    const harp = panner(spots.harmonica, 1.55), piano = panner(spots.piano, 1.0), echo = panner(middle, 1.5);
    for (const n of [harp, piano, echo]) n.connect(fade);
    const room = makeRoom(ctx), wet = ctx.createGain(); wet.gain.value = STAGE.room;
    room.output.connect(wet).connect(echo);
    const harpIn = ctx.createGain(), pianoIn = ctx.createGain(); harpIn.gain.value = pianoIn.gain.value = STAGE.level;
    harpIn.connect(harp); pianoIn.connect(piano);
    const roomIn = ctx.createGain(); roomIn.gain.value = STAGE.level; roomIn.connect(room.input);
    bus = { ctx, fade, muffle, harp, harpIn, pianoIn, roomIn, nodes: [fade, muffle, harp, piano, echo, wet, harpIn, pianoIn, roomIn, room.output], sent: null };
    // when the sound goes to sleep (a pause, a panel, a hidden tab), the band stops and lets its notes go; it starts a
    // fresh line when the sound wakes. (Asleep, the sound's clock stands still while the notes' own timers don't, so the
    // notes made ahead would be cut off unheard and leave a gap after the pause.)
    bus.onState = () => { if (ctx.state !== 'running') stopMusic(true); if (bus) bus.sent = null; };
    ctx.addEventListener('statechange', bus.onState);
  }
  let songI = 0, intro = true, asked = 0, askT = 0;   // (which of SONGS; a song asked for starts without the piano's intro line)
  function startMusic(at = null) {
    if (music || !bus) return;
    music = makeStageMusic(bus.ctx, { harp: bus.harpIn, piano: bus.pianoIn, room: bus.roomIn, seed: 1 + Math.floor(Math.random() * 1e6), song: SONGS[songI].id, intro });
    music.start(at != null ? at : bus.ctx.currentTime + 0.2);
  }
  function stopMusic(now = false) { if (music) { music.stop({ now }); music = null; } }

  const S = { prompt: null };
  // asking the band for another song: the next one round, said by the harmonica player; the notes sounding ring out
  // and the new song starts after a breath (or, with the music asleep, when it next starts)
  const front = place && (place.crowd || place.door);
  S.ask = () => {
    if (disposed) return null;
    songI = (songI + 1) % SONGS.length; intro = false; asked++; askT = STAGE.askAgain;
    const song = SONGS[songI];
    if (made && made.harpist) howdy(made.harpist, song.ask, { ms: STAGE.say, key: 'band' });
    if (speak) try { speak(song.ask); } catch (e) { /* (no voice) */ }
    if (music && bus) { const t = bus.ctx.currentTime; music.stop({ from: t + 0.05 }); music = null; startMusic(t + STAGE.between); }
    S.prompt = null;
    return song;
  };
  S.update = (dt, pos) => {
    if (disposed || !pos) return;
    distance = Math.hypot(pos.x - middle.x, pos.z - middle.z);
    // the prompt: at the front of the stage (the crowd's patch, or by the steps), the band there to ask
    if (askT > 0) askT -= dt;
    const atFront = !!front && (Math.hypot(pos.x - front.x, pos.z - front.z) < (place.crowd ? place.crowd.r + 1.5 : STAGE.ask) || Math.hypot(pos.x - place.door.x, pos.z - place.door.z) < STAGE.ask);
    S.prompt = atFront && made && visible && askT <= 0 ? 'Ask the band for another song' : null;
    // the players: near the town only
    const show = distance < STAGE.show;
    if (show && !making) makePlayers();
    if (show !== visible) setVisible(show);
    // the sound: the band plays while the player is in earshot
    if (audio) {
      const hear = distance < (music ? STAGE.far : STAGE.start);
      audio.need('stage', hear);
      if (hear && audio.ctx && !bus) makeSound(audio.ctx, audio.out);
      if (hear && bus && audio.running) startMusic();
      if (!hear) stopMusic();
      if (bus) {
        const u = Math.max(0, Math.min(1, (distance - STAGE.near) / (STAGE.far - STAGE.near)));
        gain = hear ? 1 - u * u * (3 - 2 * u) : 0;
        const M = STAGE.muffle, f = Math.max(0, Math.min(1, (distance - M.from) / (M.to - M.from)));
        const hz = 20000 * Math.pow(M.hz / 20000, f);
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
    // the players' clips: on the music's beat while it plays (as heard: the output's own delay taken off)
    const beat = music && bus ? music.beat() - (bus.ctx.outputLatency || 0) / music.beatLen : null;
    const t = bus ? bus.ctx.currentTime : 0;
    if (made.harpist) {
      const playing = music && (music.harmonicaAt(t + STAGE.lift) || music.harmonicaAt(t) || music.harmonicaAt(t - STAGE.lift * 0.5));
      made.harpist.play(playing ? 'Play_Harmonica' : 'Harmonica_Rest', { fade: 0.45 });
    }
    for (const p of players) { if (beat != null) onBeat(p, beat, music.beatLen); p.update(dt); }
    if (harmonica && made.harpist) { made.harpist.root.updateMatrixWorld(true); placeHarmonica(made.harpist); }
  };
  // for rigs: a steady tone in place of the band (the music muted meanwhile), through the harmonica's positioned sound and
  // the same distance fade, to measure how the level changes with distance without the tune's own ups and downs
  let tone = null;
  S.testTone = (on) => {
    if (!bus) return false;
    const t = bus.ctx.currentTime;
    if (on && !tone) { tone = bus.ctx.createOscillator(); tone.frequency.value = 440; tone.g = bus.ctx.createGain(); tone.g.gain.value = 0.2; tone.connect(tone.g).connect(bus.harp); tone.start(); }
    if (!on && tone) { tone.stop(); tone.g.disconnect(); tone = null; }
    for (const g of [bus.harpIn, bus.pianoIn, bus.roomIn]) g.gain.setValueAtTime(on ? 0 : STAGE.level, t);
    return true;
  };
  S.state = () => ({ near: visible, made: !!made, playing: !!music, gain, distance, clips: players.map((p) => p.clip), notes: music ? music.played : 0,
    context: audio && audio.ctx ? audio.ctx.state : 'none', song: SONGS[songI].id, asked, prompt: S.prompt, beatLen: music ? music.beatLen : null });
  Object.defineProperty(S, 'song', { get: () => SONGS[songI] });
  // (rigs) an analyser on the band's own sound, after its distance fade (what reaches the game's mix from the stage)
  S.analyser = () => { if (!bus) return null; if (!bus.an) { bus.an = bus.ctx.createAnalyser(); bus.an.fftSize = 4096; bus.muffle.connect(bus.an); bus.nodes.push(bus.an); } return bus.an; };
  S.spots = spots;
  Object.defineProperty(S, 'music', { get: () => music });
  Object.defineProperty(S, 'players', { get: () => made });
  S.dispose = () => {
    disposed = true; stopMusic();
    if (audio) audio.need('stage', false);
    if (bus) { const b = bus; bus = null; b.ctx.removeEventListener('statechange', b.onState); b.fade.gain.setTargetAtTime(0, b.ctx.currentTime, 0.05); setTimeout(() => { for (const n of b.nodes) try { n.disconnect(); } catch (e) { /* gone */ } }, 400); }
    for (const p of players) p.dispose();
    players.length = 0; made = null;
    if (harmonica) { harmonica.removeFromParent(); harmonica.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); harmonica = null; }
  };
  return S;
}

// the band with nowhere to play: the same handle, doing nothing
function quietStage() {
  const S = { prompt: null, spots: null, quiet: true };
  S.ask = () => null;
  S.update = () => {};
  S.testTone = () => false;
  S.state = () => ({ near: false, made: false, playing: false, gain: 0, distance: Infinity, clips: [], notes: 0, context: 'none', song: SONGS[0].id, asked: 0, prompt: null, beatLen: null, quiet: true });
  Object.defineProperty(S, 'song', { get: () => SONGS[0] });
  S.analyser = () => null;
  Object.defineProperty(S, 'music', { get: () => null });
  Object.defineProperty(S, 'players', { get: () => null });
  S.dispose = () => {};
  return S;
}
