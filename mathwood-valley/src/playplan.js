// THE PLAYING HANDS' NUMBERS (no three.js: src/playhands.js and the tests read the same ones)
export const PLAY = {
  harp: { beats: 2, wrist: { R: 1.5, L: 1.5 }, curl: { R: 14, L: 14 }, onBar: 0.12 },   // one open and close in this many beats; degrees at the widest. onBar: the share of it the index and middle fingers take (they stay on the top plate; the ring and little fingers do the cupping)
  banjo: { notes: [0, 1, 1.5, 2, 3, 3.5], strike: 0.09, back: 0.22, wrist: 10, nail: 12 },   // beats of a four-beat clip; s; degrees
  fiddle: { lift: 11 },                                                 // degrees: a finger off the string
};
// how open the cupped hand is, 0 closed .. 1 wide, at a beat
export const harpOpen = (beat, P = PLAY.harp) => { const k = 0.5 - 0.5 * Math.cos(2 * Math.PI * beat / P.beats); return k * k * (3 - 2 * k); };
// the picking hand: 0 at rest above the strings, 1 down on them at the note, falling back after
export function strike(beat, beatLen, P = PLAY.banjo) {
  const s = beatLen; let best = 0;
  for (const n of P.notes) for (const at of [n, n + 4]) {
    const t = (beat - at) * s;
    if (t > -P.strike && t <= 0) best = Math.max(best, 1 + t / P.strike); else if (t > 0 && t < P.back) best = Math.max(best, 1 - t / P.back);
  }
  return best;
}
