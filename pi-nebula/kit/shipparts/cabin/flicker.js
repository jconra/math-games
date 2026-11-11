// A TIRED STRIP LIGHT: time in (seconds), brightness out (1 = full, never under FLICKER.least).
//   flicker(t, seed)   steady nearly all the time; now and then one brief, shallow dip, a slow sag, or a dip that
//                      catches (comes part of the way back, sits dim for a second, then recovers)
// One such light on a ship, not one per room: the strip's glow takes it as it is drawn (kit/shipparts/cabin/live.js:
// the 'flicker' lamp follows LIVE.flick) and the room's pool of light under it is multiplied by the same number, so
// the wall dims with the strip.
//
// SAFETY (a children's game: nothing here may strobe). The rule it is built to: never more than three brightness
// changes in any one second, never full on to full off, dips shallow (to about half) and short, long calm gaps between.
// How it keeps to it, by construction and not by luck:
//   - time is cut into slots of FLICKER.slot seconds, and a slot holds at most ONE event
//   - an event starts only between `from` and `to` seconds into its slot and is over within `longest` seconds, so the
//     end of one event and the start of the next are always more than a second apart (slot + from - to - longest)
//   - an event is at most three moves (down, most of the way up, the rest of the way up), and the last of the three
//     starts more than a second after the first: no second of time holds more than two of them
//   - the lowest any event goes is `least` (half); between events the light is exactly 1 (no shimmer)
//   - whole stretches of `calm` slots in a row have no events at all (about one stretch in three)
// Measured over six hours of ship time at a thousand samples a second (rigs/motion/flickercheck.mjs): see MOTION.md.
// No randomness at run time: the same t gives the same brightness on every machine, every time.
export const FLICKER = { slot: 3.4, from: 0.4, to: 1.2, longest: 1.5, least: 0.5, calm: 6, quiet: 0.35, chance: 0.55 };

// a whole number shuffled into 0..1 (the same in every browser: whole-number arithmetic only)
function dice(n, salt) {
  let h = (Math.imul(n | 0, 0x9e3779b1) ^ Math.imul((salt | 0) + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const ease = (x) => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };
// from a to b as x goes 0..1, eased
const go = (a, b, x) => a + (b - a) * ease(x);

// what happens in slot k: null (nothing), or { at (seconds into the slot), kind, low, hold }
export function flickerEvent(k, seed = 0) {
  const F = FLICKER;
  if (dice(Math.floor(k / F.calm), seed * 7 + 1) < F.quiet) return null;        // a calm stretch
  if (dice(k, seed * 7 + 2) > F.chance) return null;                            // nothing this slot
  const r = dice(k, seed * 7 + 3), at = F.from + (F.to - F.from) * dice(k, seed * 7 + 4), q = dice(k, seed * 7 + 5);
  if (r < 0.5) return { at, kind: 'dip', low: 0.58 + 0.17 * q, hold: 0.1 + 0.08 * q };
  if (r < 0.72) return { at, kind: 'sag', low: 0.76 + 0.08 * q, hold: 0.2 + 0.2 * q };
  return { at, kind: 'catch', low: F.least + 0.1 * q, hold: 0.95 + 0.07 * q };
}
// the three kinds, x seconds after the event starts:
//   dip     down in 0.07 s, held a moment, back in 0.18 s (0.35 to 0.43 s in all: long enough to read as a light
//           dimming and not as a dropped frame)
//   sag     down slowly (0.25 s), held, back slowly (0.35 s) (under 1 s in all)
//   catch   down in 0.07 s to about half, back to DIM (three quarters) in 0.1 s, held there half lit until more than a
//           second after it began, then the rest of the way in 0.3 s (under 1.5 s in all)
const DIM = 0.76;
function shapeOf(E, x) {
  if (x <= 0) return 1;
  if (E.kind === 'dip') return x < 0.07 ? go(1, E.low, x / 0.07) : x < 0.07 + E.hold ? E.low : go(E.low, 1, (x - 0.07 - E.hold) / 0.18);
  if (E.kind === 'sag') return x < 0.25 ? go(1, E.low, x / 0.25) : x < 0.25 + E.hold ? E.low : go(E.low, 1, (x - 0.25 - E.hold) / 0.35);
  return x < 0.07 ? go(1, E.low, x / 0.07) : x < 0.17 ? go(E.low, DIM, (x - 0.07) / 0.1) : x < 0.17 + E.hold ? DIM : go(DIM, 1, (x - 0.17 - E.hold) / 0.3);
}
export function flicker(t, seed = 0) {
  const F = FLICKER, k = Math.floor(t / F.slot), E = flickerEvent(k, seed);
  if (!E) return 1;
  const v = shapeOf(E, t - k * F.slot - E.at);
  return v < F.least ? F.least : v > 1 ? 1 : v;
}
// when the next event starts at or after time t (for a lab that wants to show one, or a test), or -1 if none within
// `within` seconds
export function nextFlicker(t, seed = 0, within = 600) {
  const F = FLICKER;
  for (let k = Math.floor(t / F.slot); k * F.slot < t + within; k++) { const E = flickerEvent(k, seed); if (E && k * F.slot + E.at >= t) return k * F.slot + E.at; }
  return -1;
}
