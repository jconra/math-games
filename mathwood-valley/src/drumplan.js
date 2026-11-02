// THE DRUMS IN NUMBERS (no three.js: the model, the drummer's hands, the lab and the tests read the same ones). The kit as the game's
// maker's photos have it (~/pw/bandit-math/refs/hands/drum_kit.png, drum_snare.png): a big rope-tuned bass drum with a skin head, struck
// by a felt beater on a foot pedal; a rope-tuned snare on a stand between his knees; a big cymbal on its own stand at his right. In the
// player's own frame (metres): x to his left, y up, z the way he faces, his stool at the origin.
//   DRUMS         the sizes and places
//   handOf(hit)   who plays a box hit of the music's: 0 his left (tap, on the snare), 1 his right (slap, on the snare), 2 his right foot
//                 (thump, the bass drum). Sticks take turns on slaps close together: planHits
//   planHits(ev, st) -> { limb: 'L', 'R' or 'foot', cymbal }   one hit's limb, in order; st: its memory; a loud thump is an accent: his right stick strikes the cymbal on it, and the crash sounds (src/audio/stagemusic.js)
//   strokeHeight(now, nextAt, lastAt, S) -> 0..1   how far the stick (or beater) is off the drum: 0 on the skin at the note
export const DRUMS = {
  snare: { at: [0, 0.64, 0.58], r: 0.19, depth: 0.17 },       // at: the middle of its top skin
  bass: { at: [-0.37, 0.46, 1.0], r: 0.46, depth: 0.36, face: [0.1, 0, -0.995] },   // at: its middle; face: the way the skin the beater strikes looks
  cymbal: { at: [-0.58, 1.02, 0.62], r: 0.21 },                  // on its own stand
  // the pedal, in front of the skin: the beater's axle; the shaft and its felt ball; the foot plate from its heel hinge to the toe end
  pedal: { axle: [-0.31, 0.13, 0.72], shaft: 0.33, ball: 0.045, rest: 34, heel: [-0.3, 0.015, 0.44], toe: [-0.3, 0.05, 0.68], tip: 14 },
  stick: { long: 0.4, r0: 0.0085, r1: 0.0045, grip: 0.1 },    // the grip: how far along from the butt his hand is
};
const D = DRUMS;
const off = (a, n, k) => [a[0] + n[0] * k, a[1] + n[1] * k, a[2] + n[2] * k];
// the skin's middle the beater strikes
export const bassSkin = () => off(D.bass.at, D.bass.face, D.bass.depth / 2);
// where each stick's tip lands on the snare; the right one's on the cymbal's edge on an accent
export const STRIKE = { L: [D.snare.at[0] + 0.06, D.snare.at[1] + 0.003, D.snare.at[2] - 0.01], R: [D.snare.at[0] - 0.06, D.snare.at[1] + 0.003, D.snare.at[2] - 0.01], cymbal: [D.cymbal.at[0] + 0.14, D.cymbal.at[1] + 0.012, D.cymbal.at[2] - 0.1] };
export const handOf = (hit) => (hit === 'thump' ? 2 : hit === 'slap' ? 1 : 0);
export const ACCENT = { vel: 0.95, gap: 32 };   // a thump this loud, this long (s) since the last, is an accent: the cymbal is rare, sight and sound together (the game's maker found it too much)
// is this hit an accent? st: its memory. The music asks as it schedules a hit and plays the crash; what it says goes on the event (ev.cymbal), so his stick strikes on that very hit
export function accentDue(ev, st) { const due = ev.hit === 'thump' && ev.vel >= ACCENT.vel && ev.at - (st.cym ?? -1e9) >= ACCENT.gap; if (due) st.cym = ev.at; return due; }
export function planHits(ev, st) {
  if (ev.hit === 'thump') return { limb: 'foot', cymbal: ev.cymbal != null ? ev.cymbal : accentDue(ev, st) };
  if (ev.hit === 'slap') { const limb = st.next === 'L' && ev.at - (st.slap ?? -1e9) < 0.6 ? 'L' : 'R'; st.next = limb === 'R' ? 'L' : 'R'; st.slap = ev.at; return { limb, cymbal: false }; }
  return { limb: 'L', cymbal: false };
}
export const STROKE = {
  down: 0.07,    // s: the stick's last drop to the skin
  up: 0.1,       // s: the rebound off it
  ready: 0.4,    // how high it comes to rest between notes (1: the full lift)
  prep: 0.3,     // s before a note that the hand starts the full lift
  lift: { L: 0.08, R: 0.08 },   // m: the hand's way off the skin at the full lift
  turn: 36,      // degrees: the wrist's lift of the stick at the full lift
  calmHead: 0.5,   // how much of the clip's head nod is taken off (src/drumhands.js)
  // the foot: quicker, with a shorter wind-up
  foot: { down: 0.06, up: 0.14, ready: 0.22, prep: 0.2 },
  cymbalWay: [-0.45, -0.3, 0.85],   // the right stick's way, butt to tip, on the cymbal (his own frame): out and down onto the rim, never back at him
  toCymbal: 0.22,  // s the right hand takes over to the cymbal and back
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
