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

export const SOUNDS = {
  // the game's maker (2026-11-27): "For engine noises. We could use something that sounds like the lurcher engine (but
  // maybe softer)". Three takes in the lab (A the Lurcher's own sound, quieter; B rounder; C a slower throb), for him to
  // choose by ear; A until he does.
  engine: 'SHIP — ENGINE A',
  // the wormhole's moments (src/wormplan.js JUMP): the tear opening and coming over the ship; the colours all round,
  // for as long as they last; the far end opening
  jump: { tear: 'JUMP — TEAR', tunnel: 'JUMP — TUNNEL', open: 'JUMP — OPEN' },
  // a right answer, wherever a maths answer is checked (src/jobs/panel.js; a pod's lock opened, src/podlock.js)
  chime: 'CHIME — RIGHT A',
};

// HOW LOUD (measured from renders, ~/pw/space-math/SOUNDS_1_PI_NEBULA.md): with the HUD's volume as it starts (0.8), a
// voice clip speaks at about -23 dB and the station's music plays at about -29 dB; the engine at 0.27 sits at about
// -34 dB, 11 dB under a voice and 5 dB under the music, nearly all of it below 600 Hz where a voice has little, so a
// person speaking stays clear over it with nothing turned down. The jump at -27 dB in all (its loudest moment, the
// colours all round, -28 dB); a chime at about -27 dB over its first 0.3 s.
export const LEVEL = { engine: 0.27, jump: 1, chime: 0.8 };

export const ENGINE = {
  near: 8, far: 120,             // another ship's engine: full within 8 m, quieter on out to 120 m, not heard past it
  fadeIn: 0.4, fadeOut: 0.5,     // s: an engine starts and stops softly (never a click)
  rise: 1.2, fall: 0.8,          // the most the RPMs move in a second, up and down (with the engine's own 50 ms glide)
  linger: 0.25,                  // s: an engine nobody has asked for in this long is stopped (a ship put away, a run given up)
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
// a ship that moves by itself: held up at least ENGINE.aloft, at full by ENGINE.fast m/s
export const rpmOfSpeed = (v) => ENGINE.aloft + (1 - ENGINE.aloft) * clamp01((+v || 0) / ENGINE.fast);

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
