// THE SHIPS' ENGINES, heard. The game's maker (2026-11-27): "For engine noises. We could use something that sounds like
// the lurcher engine (but maybe softer)". One Sound Lab patch (src/sounds.js SOUNDS.engine) played by the game's sound
// player (src/sound.js sound.patch) for each ship whose engine is running near the ears, kept running while it is
// wanted, and ONE number of it moved, its RPMs (as RMRF's vehicles do: rmrf/js/SoundManager.js), eased, so the pitch, the
// throb and the brightness follow what the ship is doing and never jump.
//
// WHAT IS HEARD (what moves in the game, and which of it has an engine to hear):
//   - the ship of the run, from its power on to its power off, through every part of the run: flown by the crew
//     member, the autopilot or the crew's own pilot (src/flying.js, each frame), and moved by the run itself where the
//     flight model rests (src/rescue.js: flown down, the hover, set down, standing, the lift and the climb; src/
//     fieldfly.js: the drill at the rocks; src/explore.js: each place an exploring run goes to). Heard from everywhere,
//     not placed: the ears are in its cockpit, or just behind it. Down where it stands: idling; held up: a little more;
//     moving or climbing: more, by its speed;
//   - the Miner coming in to land in its hangar by itself (src/crane.js, its landing), heard from where it is;
//   - the jet that flies past the control room's windows (src/lift.js, the fly-by), heard from where it is;
//   NOT heard: the ships parked in the other hangars, shoved by a ship flown into them (they slide with their engines
//   off), the small jets parked on the roof (they never move), Cargo's forklift (not a ship; not this round).
// AT MOST A FEW AT ONCE: the nearest, as many as the quality level allows (src/sounds.js ENGINE.most); one farther off,
// or past the number, fades out, and fades in again when it is among them.
// NOTHING RUNS ON BY ITSELF: an engine no one has asked for in ENGINE.linger seconds (a ship put away, a run given up, a
// landing over) fades out and stops; with the sound muted or turned right down, every engine is stopped; the page
// hidden, the sound player stops them (src/sound.js) and they start again on the first frame back; and if the
// engines' update stops coming at all (the game's loop gone), a watchdog stops every engine after ENGINE.watchdog s.
//
//   const E = makeEngines({ sound })    (the game's one: `engines`, below)
//   E.own(S, standing)          each frame, the ship of the run (its flight model's state, src/flymodel.js). standing:
//                               the run has it down on the ground (it idles) though the flight model says it is aloft
//   E.other(key, x, y, z)       each frame, a ship moving by itself, where it is (its speed is worked out here)
//   E.update(dt, ears, quality) each frame, after everything has moved: ears, the camera's place ({ x, y, z });
//                               quality: the game's quality level ('low', 'medium', 'high')
//   E.state()                   for the rigs: { sounding, engines: [{ key, rpm, want, d, on }] }
import { sound as gameSound } from './sound.js';
import { SOUNDS, LEVEL, ENGINE, rpmOf, rpmOfSpeed, easeRpm, nearest, mostFor } from './sounds.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function makeEngines({ sound = gameSound } = {}) {
  const slots = new Map(), list = [], chosen = [];
  const values = { rpm: 0 };
  function slotOf(key) {
    let s = slots.get(key);
    if (!s) {
      s = { key, own: key === 'own', want: 0, rpm: 0, sent: -1, d: 0, at: { x: 0, y: 0, z: 0 }, was: { x: 0, y: 0, z: 0 }, moved: false, speed: 0, asked: false, quiet: 0, h: null, live: false, S: null, standing: false };
      slots.set(key, s); list.push(s);
    }
    return s;
  }
  // where it is now, and how far it went since last time (a leap is a ship put somewhere, not flown: no speed from it)
  function seen(s, x, y, z) {
    if (!s.live) { s.speed = 0; s.moved = false; }
    else { s.was.x = s.at.x; s.was.y = s.at.y; s.was.z = s.at.z; s.moved = true; }
    s.at.x = x; s.at.y = y; s.at.z = z; s.asked = true;
    if (s.moved && Math.hypot(x - s.was.x, y - s.was.y, z - s.was.z) > ENGINE.leap) s.moved = false;
  }
  const stop = (s) => { if (s.h) { s.h.stop(ENGINE.fadeOut); s.h = null; } s.sent = -1; };
  const stopAll = () => { for (const s of list) stop(s); };
  // THE WATCHDOG: engines sounding, and no update for ENGINE.watchdog s: all stopped
  let last = 0, dog = 0;
  const watch = () => {
    if (now() - last > ENGINE.watchdog * 1000) stopAll();
    if (!list.some((s) => s.h)) { clearInterval(dog); dog = 0; }
  };
  const E = {
    own(S, standing = false) {
      if (!S || !S.power) return;
      const s = slotOf('own'); s.S = S; s.standing = !!standing;
      seen(s, S.p[0], S.p[1], S.p[2]);
    },
    other(key, x, y, z) { seen(slotOf(key), x, y, z); },
    update(dt, ears, quality) {
      const step = dt > 0 ? dt : 0;
      last = now();
      // (who has asked this frame; one not asked for a while is let go)
      for (const s of list) {
        if (s.asked) s.quiet = 0; else s.quiet += step;
        s.live = s.quiet < ENGINE.linger;
        if (s.moved && step > 0) { const v = Math.hypot(s.at.x - s.was.x, s.at.y - s.was.y, s.at.z - s.was.z) / step; s.speed += (v - s.speed) * Math.min(1, step * 4); }
        if (!s.own) s.want = rpmOfSpeed(s.speed);
        // (the ship of the run: from its flight model; moved by the run itself, the flight model still, by its speed)
        else if (s.S) { const v = s.S.v, still = !v[0] && !v[1] && !v[2]; s.want = s.standing ? 0 : Math.max(rpmOf(s.S), still && !s.S.landed ? rpmOfSpeed(s.speed) : 0); }
        s.d = s.own ? 0 : ears ? Math.hypot(s.at.x - ears.x, s.at.y - ears.y, s.at.z - ears.z) : Infinity;
        if (!s.live) s.d = Infinity;
        s.asked = false; s.moved = false;
        // (one stopped by the sound player itself, the page hidden: started again below)
        if (s.h && !s.h.on) { s.h = null; s.sent = -1; }
      }
      if (!sound.audible()) { stopAll(); return; }
      nearest(list, mostFor(quality), chosen);
      for (const s of list) {
        if (chosen.indexOf(s) < 0) { stop(s); continue; }
        if (!s.h) {
          s.rpm = s.want; values.rpm = s.rpm;
          s.h = sound.patch(SOUNDS.engine, { at: s.own ? null : s.at, volume: LEVEL.engine, group: 'effects', near: ENGINE.near, far: ENGINE.far, fade: ENGINE.fadeIn, values });
          s.sent = s.rpm;
          if (s.h && !dog) dog = setInterval(watch, 250);
          continue;
        }
        s.rpm = easeRpm(s.rpm, s.want, step);
        if (Math.abs(s.rpm - s.sent) > 0.002) { s.h.set('rpm', s.rpm); s.sent = s.rpm; }
        if (!s.own) s.h.move(s.at);
      }
    },
    state: () => ({ sounding: list.filter((s) => !!s.h).length, engines: list.map((s) => ({ key: s.key, rpm: +s.rpm.toFixed(3), want: +s.want.toFixed(3), d: Number.isFinite(s.d) ? +s.d.toFixed(1) : null, on: !!s.h })) }),
  };
  return E;
}

export const engines = makeEngines();
