// THE DRUMS IN NUMBERS (no three.js: the model, the drummer's hands, the lab and the tests read the same ones). Double
// drumming, as in the bands of the 1880s and 90s before the foot pedal took over: one drummer with two sticks, a rope-tuned
// bass drum standing on its rim at his right with a small cymbal on top, a snare on a folding stand between his knees. In
// the player's own frame (metres): x to his left, y up, z the way he faces, his stool at the origin.
//   DRUMS         the sizes and places
//   handOf(hit)   which hand plays a box hit of the music's: 0 his left (slap and tap, the snare), 1 his right (thump, the bass drum)
//   strokeHeight(now, nextAt, lastAt, S) -> 0..1   how far the stick is off the drum: 0 on the skin at the note
export const DRUMS = {
  snare: { at: [0, 0.63, 0.56], r: 0.18, depth: 0.14 },      // at: the middle of its top skin
  bass: { at: [-0.62, 0.38, 0.34], r: 0.36, depth: 0.3, face: [0.9, 0, 0.43] },   // at: its middle; face: the way the skin he plays looks
  cymbal: { r: 0.15, post: 0.05 },                              // on top of the bass drum
  stick: { long: 0.33, r0: 0.0085, r1: 0.0045, grip: 0.07 },      // the grip: how far along from the butt his hand is
};
const D = DRUMS;
const off = (a, n, k) => [a[0] + n[0] * k, a[1] + n[1] * k, a[2] + n[2] * k];
// the skin's middle he plays, on the bass drum
export const bassSkin = () => off(D.bass.at, D.bass.face, D.bass.depth / 2);
// where each stick's tip lands: left on the snare's middle, right on the bass drum above its middle (he plays it from above)
export const STRIKE = { L: [D.snare.at[0] + 0.02, D.snare.at[1] + 0.003, D.snare.at[2] - 0.02], R: (() => { const s = bassSkin(); return [s[0], s[1] + 0.2, s[2]]; })() };
export const handOf = (hit) => (hit === 'thump' ? 1 : 0);
export const STROKE = {
  down: 0.07,    // s: the stick's last drop to the skin
  up: 0.1,       // s: the rebound off it
  ready: 0.4,    // how high it comes to rest between notes (1: the full lift)
  prep: 0.3,     // s before a note that the hand starts the full lift
  lift: { L: 0.08, R: 0.09 },   // m: the hand's way off the skin at the full lift
  turn: 36,      // degrees: the wrist's lift of the stick at the full lift
  calmHead: 0.5,   // how much of the clip's head nod is taken off (src/drumhands.js)
};
const ease = (t) => t * t * (3 - 2 * t);
export function strokeHeight(now, nextAt, lastAt, S = STROKE) {
  const toNext = nextAt - now, since = now - lastAt, gap = nextAt - lastAt;
  // (a quick pair: a shorter lift, as there's no time for a full one)
  const top = gap < 0.5 ? Math.max(0.35, gap / 0.5) : 1;
  let h = S.ready;
  if (since >= 0 && since < S.up) h = S.ready * ease(since / S.up);
  if (toNext >= 0 && toNext < S.prep + S.down) {
    const want = toNext < S.down ? top * ease(toNext / S.down) : top + (Math.min(h, S.ready) - top) * ease((toNext - S.down) / S.prep);
    h = toNext < S.down ? want : Math.max(Math.min(h, want), want * (since < S.up ? ease(Math.max(0, since) / S.up) : 1));
  }
  return Math.max(0, Math.min(1, h));
}
