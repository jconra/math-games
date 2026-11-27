// THE SHIPS' ENGINES, heard. The game's maker (2026-11-27): "For engine noises. We could use something that sounds like
// the lurcher engine (but maybe softer)". One Sound Lab patch (src/sounds.js SOUNDS.engine) played by the game's sound
// player (src/sound.js sound.patch) for each ship whose engine is running near the ears, kept running while it is
// wanted, and ONE number of it moved, its RPMs (as RMRF's vehicles do: rmrf/js/SoundManager.js), eased, so the pitch, the
// throb and the brightness follow what the ship is doing and never jump.
//
// WHAT IS HEARD (what moves in the game, and which of it has an engine to hear):
//   - the ship being flown, by the crew member or by whoever flies it with them aboard (the autopilot, the crew's own
//     pilot), at the station, out at the rocks, over a planet, at the old station's dock: src/flying.js tells it each
//     frame (E.own). Heard from everywhere, not placed: the ears are in its cockpit, or just behind it. Power on, down on
//     the floor: idling; power off: silent;
//   - the Miner coming in to land in its hangar by itself (src/crane.js, its landing), heard from where it is;
//   - the jet that flies past the control room's windows (src/lift.js, the fly-by), heard from where it is;
//   NOT heard: the ships parked in the other hangars, shoved by a ship flown into them (they slide with their engines
//   off), the small jets parked on the roof (they never move), Cargo's forklift (not a ship; not this round).
// AT MOST A FEW AT ONCE: the nearest, as many as the quality level allows (src/sounds.js ENGINE.most); one farther off,
// or past the number, fades out, and fades in again when it is among them.
// NOTHING RUNS ON BY ITSELF: an engine no one has asked for in ENGINE.linger seconds (a ship put away, a run given up, a
// landing over) fades out and stops; with the sound muted or turned right down, every engine is stopped.
//
//   const E = makeEngines({ sound })    (the game's one: `engines`, below)
//   E.own(S)                    each frame, the ship being flown (its flight model, src/flymodel.js)
//   E.other(key, x, y, z)       each frame, a ship moving by itself, where it is (its speed is worked out here)
//   E.update(dt, ears, quality) each frame, after everything has moved: ears, the camera's place ({ x, y, z });
//                               quality: the game's quality level ('low', 'medium', 'high')
//   E.state()                   for the rigs: { sounding, engines: [{ key, rpm, want, d, on }] }
import { sound as gameSound } from './sound.js';
import { SOUNDS, LEVEL, ENGINE, rpmOf, rpmOfSpeed, easeRpm, nearest, mostFor } from './sounds.js';

export function makeEngines({ sound = gameSound } = {}) {
  const slots = new Map(), list = [], chosen = [];
  const values = { rpm: 0 };
  function slotOf(key) {
    let s = slots.get(key);
    if (!s) {
      s = { key, own: key === 'own', want: 0, rpm: 0, sent: -1, d: 0, at: { x: 0, y: 0, z: 0 }, was: { x: 0, y: 0, z: 0 }, moved: false, speed: 0, asked: false, quiet: 0, h: null, live: false };
      slots.set(key, s); list.push(s);
    }
    return s;
  }
  const stop = (s) => { if (s.h) { s.h.stop(ENGINE.fadeOut); s.h = null; } s.sent = -1; };
  const E = {
    own(S) {
      if (!S || !S.power) return;
      const s = slotOf('own'); s.want = rpmOf(S); s.asked = true;
    },
    other(key, x, y, z) {
      const s = slotOf(key);
      // (first seen, or seen again after a while: where it is, and no speed from the jump to there)
      if (!s.live) { s.speed = 0; s.moved = false; }
      else { s.was.x = s.at.x; s.was.y = s.at.y; s.was.z = s.at.z; s.moved = true; }
      s.at.x = x; s.at.y = y; s.at.z = z; s.asked = true;
    },
    update(dt, ears, quality) {
      const step = dt > 0 ? dt : 0;
      // (who has asked this frame; one not asked for a while is let go)
      for (const s of list) {
        if (s.asked) s.quiet = 0; else s.quiet += step;
        s.live = s.quiet < ENGINE.linger;
        if (!s.own) {
          if (s.moved && step > 0) { const v = Math.hypot(s.at.x - s.was.x, s.at.y - s.was.y, s.at.z - s.was.z) / step; s.speed += (v - s.speed) * Math.min(1, step * 4); }
          s.want = rpmOfSpeed(s.speed);
        }
        s.d = s.own ? 0 : ears ? Math.hypot(s.at.x - ears.x, s.at.y - ears.y, s.at.z - ears.z) : Infinity;
        if (!s.live) s.d = Infinity;
        s.asked = false; s.moved = false;
      }
      if (!sound.audible()) { for (const s of list) stop(s); return; }
      nearest(list, mostFor(quality), chosen);
      for (const s of list) {
        if (chosen.indexOf(s) < 0) { stop(s); continue; }
        if (!s.h) {
          s.rpm = s.want; values.rpm = s.rpm;
          s.h = sound.patch(SOUNDS.engine, { at: s.own ? null : s.at, volume: LEVEL.engine, group: 'effects', near: ENGINE.near, far: ENGINE.far, fade: ENGINE.fadeIn, values });
          s.sent = s.rpm;
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
