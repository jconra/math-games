// THE GAME'S OWN SOUNDS, the plain part: which Sound Lab patch plays for what, how loud, and the engines' rules. No page
// and no three.js, so node tests it (tests/sounds.test.mjs). Every sound here is a patch written in the Sound Lab
// (~/sound-lab/sounds/pi-nebula.js, where the game's maker opens each one from the rail and tunes it by ear) and reaches
// the game only through the lab's sync script, in src/audio/patch.js; src/sound.js plays it (sound.patch). The game's
// maker (2026-11-24): "We should try to use the sound lab engine for everything that we can. It would be great to have
// all the sound code in one place and organized."
//
//   SOUNDS        the patches' names: the engine, the jump's three moments, the chime for a right answer
//   LEVEL         how loud each is played (the volume given to sound.patch, before its group and the HUD's volume)
//   ENGINE        the engines' rules: how near is full and how far is heard, the fades, how quickly the RPMs may move,
//                 how many engines may sound at once at each of the game's quality levels (src/station.js QUALITY)
//   rpmOf(S)      the RPMs (0 idle .. 1 full) of a ship flown with src/flymodel.js, from what it is doing
//   rpmOfSpeed(v) the RPMs of a ship that moves by itself (the Miner landing on its own, the jet past the tower), from
//                 its speed (m/s)
//   easeRpm(now, want, dt)   the RPMs moved toward what is wanted, never faster than ENGINE.rise / ENGINE.fall a second
//   nearest(list, n, out)    of engines that could sound ({ d: metres from the ears }), the n nearest within ENGINE.far,
//                 the ship flown first (d 0); `out` filled and returned, nothing made (it runs every frame)
import { FEEL } from './flymodel.js';
import { JUMP } from './wormplan.js';

export const SOUNDS = {
  // the game's maker (2026-11-27): "For engine noises. We could use something that sounds like the lurcher engine (but
  // maybe softer)". Five takes in the lab, for him to choose by ear: A the Lurcher's own sound, quieter; B rounder; C a
  // gentler, slower throb; D quieter but brighter and buzzier, so a phone's own speaker plays it; E between A and D, a
  // hum with some body that a phone still plays (A, B and C are nearly all below 300 Hz, lower than a phone's speaker
  // goes, and he plays on his phone). E until he chooses: by the numbers it is the easier on the ear of the two a phone
  // plays (a tenth of D's share above 1 kHz, the middle of its sound about 200 Hz against D's 275, a shallower chop),
  // for 2 dB less of it on a phone's speaker than D and 6 dB more than A.
  engine: 'SHIP — ENGINE E',
  // the wormhole's moments (src/wormplan.js JUMP): the tear opening and coming over the ship; the colours all round,
  // for as long as they last; the far end opening
  jump: { tear: 'JUMP — TEAR', tunnel: 'JUMP — TUNNEL', open: 'JUMP — OPEN' },
  // a right answer, wherever a maths answer is checked (src/jobs/panel.js; a pod's lock opened, src/podlock.js)
  chime: 'CHIME — RIGHT A',
};

// HOW LOUD (measured from renders, ~/pw/space-math/SOUNDS_1_PI_NEBULA.md): with the HUD's volume as it starts (0.8), a
// voice clip speaks at about -23 dB and the station's music plays at about -29 dB; the engine (take E) at 0.27 sits at
// about -38 dB idling to -32 dB at full RPMs, 9 to 15 dB under a voice and 3 to 9 dB under the music, so a person
// speaking stays clear over it with nothing turned down. The jump at about -30 dB in all (its loudest stretch, the colours all round, -28 dB); a chime at about -29 dB
// (A) and -26 dB (B) over its first 0.3 s.
export const LEVEL = { engine: 0.27, jump: 1, chime: 0.8 };

export const ENGINE = {
  near: 8, far: 120,             // another ship's engine: full within 8 m, quieter on out to 120 m, not heard past it
  fadeIn: 0.4, fadeOut: 0.5,     // s: an engine starts and stops softly (never a click)
  rise: 1.2, fall: 0.8,          // the most the RPMs move in a second, up and down (with the engine's own 50 ms glide)
  linger: 0.25,                  // s: an engine nobody has asked for in this long is stopped (a ship put away, a run given up)
  // THE WATCHDOG (makeWatch): a check every `every` s; `misses` checks in a row with no frame between them (the game's
  // loop gone, not one slow frame: a new planet's first picture can take over a second) and every engine and the
  // jump's hum are stopped
  watch: { every: 0.25, misses: 6 },
  leap: 50,                      // m: a ship moved further than this in one frame was put somewhere, not flown: no speed from it
  idle: 0.15,                    // the flight model's own idle (src/flymodel.js stepShip: S.engine eases to it, power on)
  aloft: 0.2,                    // the RPMs of a ship held up off the floor, going nowhere
  fast: 25,                      // m/s: a ship that moves by itself at this speed or more is at full RPMs
  // how many engines may sound at once, the nearest, at each quality level (the flown ship's always among them)
  most: { low: 2, medium: 3, high: 4 },
};

const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x);

// THE RPMS OF A FLOWN SHIP, from what it is doing (src/flymodel.js): its throttle is S.engine (0.15 idling, up to 1 with
// "forward" held, eased by the flight model itself); held up off the floor it works at least ENGINE.aloft; climbing or
// coming down it works harder, up to halfway with the most up or down speed it has. Down on the floor with the power on
// it idles (0); with the power off its engine is silent (rpmOf is 0, and src/engines.js plays nothing).
export function rpmOf(S) {
  if (!S || !S.power || S.landed) return 0;
  const throttle = clamp01((S.engine - ENGINE.idle) / (1 - ENGINE.idle));
  const climb = clamp01(Math.abs(S.v[1]) / FEEL.speed.up);
  return Math.max(ENGINE.aloft, throttle, ENGINE.aloft + (1 - ENGINE.aloft) * 0.5 * climb);
}
// a ship that moves by itself (or a flown ship moved by a scripted part of a run, its flight model still, its own speed
// zero): held up at least ENGINE.aloft, at full by ENGINE.fast m/s
export const rpmOfSpeed = (v) => ENGINE.aloft + (1 - ENGINE.aloft) * clamp01((+v || 0) / ENGINE.fast);

// THE FLOOR A RUN GIVES ITS SHIP WHERE IT MOVES IT ITSELF (src/engines.js own(S, floor)): a rescue's (src/rescue.js),
// by its part: standing on the ground with the pods, idling; flown down, the hover, the lift, the climb, above: held up.
// At the rocks (src/fieldfly.js: the drill, the ride) the ship floats in space: idling when still.
const GROUND = new Set(['pods', 'wait', 'board']);
export const rescueFloor = (phase) => (GROUND.has(phase) ? 0 : ENGINE.aloft);
export const FIELD_FLOOR = 0;

// the RPMs eased toward what is wanted: never a jump in pitch, whatever the number asked for does
export function easeRpm(now, want, dt) {
  const d = want - now, up = ENGINE.rise * dt, down = ENGINE.fall * dt;
  return now + (d > up ? up : d < -down ? -down : d);
}

// THE ENGINES THAT SOUND: of those that could, the n nearest the ears, none past ENGINE.far
const byD = (a, b) => a.d - b.d;
export function nearest(list, n, out) {
  out.length = 0;
  for (let i = 0; i < list.length; i++) if (list[i].d <= ENGINE.far) out.push(list[i]);
  out.sort(byD);
  if (out.length > n) out.length = Math.max(0, n);
  return out;
}
export const mostFor = (quality) => ENGINE.most[quality] ?? ENGINE.most.medium;

// A WATCH ON A SOUND KEPT GOING BY THE GAME'S FRAMES: beat() each frame; arm() once something sounds; when ENGINE.watch
// .misses checks in a row have come with no beat between them, dead() is called and the watch stops (armed again by
// the next sound). One slow frame is one missed check, never enough.
export function makeWatch(dead) {
  let iv = 0, beats = 0, missed = 0;
  const check = () => {
    if (beats) { beats = 0; missed = 0; return; }
    if (++missed >= ENGINE.watch.misses) { W.disarm(); dead(); }
  };
  const W = {
    beat() { beats++; },
    // (in node's tests a timer that keeps nothing alive: .unref; a browser's is a number)
    arm() { if (!iv) { missed = 0; beats = 0; iv = setInterval(check, ENGINE.watch.every * 1000); if (iv && iv.unref) iv.unref(); } },
    disarm() { if (iv) { clearInterval(iv); iv = 0; } },
    get armed() { return !!iv; },
  };
  return W;
}

// THE JUMP, HEARD (src/wormhole.js): the three patches at the wormhole's own moments, in the game's own time.
//   const J = makeJumpSound(sound)    (the game's sound player, or a stand-in)
//   J.begin(tunnel)   a jump begins: the tear (tunnel: begun in the colours, as the Drill Lab's arrival: the hum at once)
//   J.event(ev)       'shut' (the hum), 'open' (the hum stops, the far end opens)
//   J.step(jump)      each frame with the jump's plain state (src/wormplan.js): while the colours are all round the hum
//                     sounds, started again if anything stopped it (a hidden page, its own last guard); it ends with
//                     the colours: at 'open', or once they are past the longest they can last, in the game's own time
//   J.hush()          everything stopped (the jump put away)
// The hum is under a watch (makeWatch): if the frames stop coming mid-tunnel (the game's loop gone), it stops.
const HUM = { volume: LEVEL.jump, fade: 0.15, most: 120 }, TEAR = { volume: LEVEL.jump }, OPEN = { volume: LEVEL.jump };
export function makeJumpSound(sound) {
  let tear = null, hum = null;
  const humOff = (f = 0.3) => { if (hum) { hum.stop(f); hum = null; } watch.disarm(); };
  const watch = makeWatch(() => humOff());
  // (its wall-clock `most`, 120 s, is only the last guard against a hum left behind: the colours' own end is game time)
  const humOn = () => { if (!hum || !hum.on) { hum = sound.patch(SOUNDS.jump.tunnel, HUM); if (hum) watch.arm(); } };
  const J = {
    hush() { if (tear) { tear.stop(0.15); tear = null; } humOff(); },
    begin(tunnel = false) { J.hush(); if (tunnel) humOn(); else tear = sound.patch(SOUNDS.jump.tear, TEAR); },
    event(ev) {
      if (ev === 'shut') { tear = null; humOn(); }
      else if (ev === 'open') { humOff(); sound.patch(SOUNDS.jump.open, OPEN); }
    },
    step(jump) {
      watch.beat();
      if (!jump || jump.phase !== 'tunnel') return;
      if (jump.t > JUMP.most + 1) humOff(); else humOn();
    },
    get humming() { return !!(hum && hum.on); },
  };
  return J;
}

// A POD'S LOCK, HEARD (src/podlock.js): the chime for a right answer once for a lock, at the moment its last answer is
// judged right (the lock box's onSolved); a lock closed so quickly after its solving move that the box never said so
// chimes as it opens instead (its onBox, solved); a box thrown away after its chime (a level arrow in its review) and
// solved again does not chime a second time for the same lock.
//   const L = makeLockChime(sound)    L.solved()   L.opened()   L.chimed
const CHIME = { volume: LEVEL.chime };
export function makeLockChime(sound) {
  let chimed = false;
  const ring = () => { if (chimed) return; chimed = true; sound.patch(SOUNDS.chime, CHIME); };
  return { solved: ring, opened: ring, get chimed() { return chimed; } };
}
