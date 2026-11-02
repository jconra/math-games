// WHAT THE PLAYING HANDS DO ON TOP OF THE SET POSE, from the clip's own time (the clips are four beats, kept on the music's
// beat by the stage): the harmonica player's cupped hands open and close, the banjo player's hand strikes down a
// bum-ditty with the nail and drops the thumb, the fiddler's fingers fall on the strings. Laid on after H.after() on bones
// H.before() puts back, so nothing piles up. One piece of code for the stage and the Hands Lab.
//   const L = makePlayHands(person, H, who) (null for a player with no such layer); L.update()
import { Quaternion } from 'three';
import { PLAY, harpOpen, strike } from './playplan.js';

const DEG = Math.PI / 180, Q = new Quaternion();
const CLIP = { harpist: 'Play_Harmonica', banjo: 'Play_Banjo', fiddler: 'Play_Fiddle' };
export function makePlayHands(person, H, who) {
  const clip = CLIP[who], acts = person.person.actions, B = person.bones;
  if (!clip || !acts[clip]) return null;
  const turn = (name, joint, deg) => { const b = B[name], ax = H.axis(name, joint); if (b && ax && deg) b.quaternion.multiply(Q.setFromAxisAngle(ax, deg * DEG)); };
  const curl = (s, f, deg) => { turn(f + '2' + s, 'curl', deg); turn(f + '3' + s, 'curl', deg * 0.7); };
  const L = { update() {
    const a = acts[clip], w = a && a.isScheduled() ? a.getEffectiveWeight() : 0; if (w <= 0.01) return;
    const dur = a.getClip().duration, beat = (a.time / dur) * 4, beatLen = dur / 4 / Math.max(0.05, a.getEffectiveTimeScale() || 1);
    if (who === 'harpist') {
      const k = harpOpen(beat) * w, P = PLAY.harp;
      for (const s of ['R', 'L']) { turn('Wrist' + s, 'tip', -P.wrist[s] * k); for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) curl(s, f, -P.curl[s] * k); }
    } else if (who === 'banjo') {
      const k = strike(beat, beatLen) * w, P = PLAY.banjo;
      turn('WristR', 'tip', P.wrist * (k - 0.5));
      curl('R', 'Index', -P.nail * (1 - k)); curl('R', 'Middle', -P.nail * 0.5 * (1 - k));
      turn('Thumb2R', 'curl', 14 * k);
    } else {
      const step = Math.floor(beat * 2) % 4, fs = ['Index', 'Ring', 'Middle', 'Pinky'];
      curl('L', fs[step], -PLAY.fiddle.lift * w);
    }
  } };
  return L;
}
