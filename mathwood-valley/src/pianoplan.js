// THE PIANO'S KEYS IN NUMBERS (no three.js: the picture, the pianist's hands and the tests read the same ones). The saloon's
// upright (labs/buildings/saloonprops.js) has one long box for its keys, with the keyboard drawn on it: a real piano's 88
// keys, 52 white, A0 to C8. Measured in the pianist's own frame: his feet's root on the stage floor under the middle of the
// stool, x to his left, y up, z toward the piano. Low notes are at his left, as on any piano.
//   keyX(midi), isBlack(midi), handOf(midi), fitFingers(keys, hx, tips), KEYBOARD
export const KEYBOARD = { whites: 52, first: 21, width: 1.34, top: 0.74, front: 0.325, depth: 0.15, split: 55 };
const WHITE = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];   // (from C)
export const isBlack = (midi) => !WHITE[((midi % 12) + 12) % 12];
// how many white keys lie below this one (a black key: the fractional place on the line between its two white neighbours)
export function whitesBelow(midi) {
  let n = 0; const m = Math.round(midi);
  for (let k = KEYBOARD.first; k < m; k++) if (!isBlack(k)) n++;
  return isBlack(m) ? n : n + 0.5;
}
export const keyWidth = () => KEYBOARD.width / KEYBOARD.whites;
export const keyX = (midi) => (0.5 - whitesBelow(midi) / KEYBOARD.whites) * KEYBOARD.width;
// which hand: 0 his left (the low notes), 1 his right (the high). The stage music's parts leave a gap about G3.
export const handOf = (midi) => (midi < KEYBOARD.split ? 0 : 1);
// which fingers for these keys (their x, any order), the wrist now at hx, tips[f]: finger f's tip's x from the wrist.
// -> { fingers: [one per key, in the keys' given order], hx: where the wrist should be }. The fingers keep the keys' order
// along the hand; of the ways to do that, the one needing the least stretch between them, then the least hand movement.
export function fitFingers(keys, hx, tips) {
  const order = keys.map((x, i) => i).sort((a, b) => keys[a] - keys[b]);
  const byX = tips.map((x, f) => f).sort((a, b) => tips[a] - tips[b]), n = Math.min(keys.length, 5);
  let best = null, bestCost = Infinity;
  const pick = [];
  const walk = (from) => {
    if (pick.length === n) {
      let mean = 0; for (let i = 0; i < n; i++) mean += keys[order[i]] - tips[byX[pick[i]]]; mean /= n;
      let stretch = 0; for (let i = 0; i < n; i++) stretch += Math.abs(keys[order[i]] - tips[byX[pick[i]]] - mean);
      let ends = 0; if (n === 1 && (pick[0] === 0 || pick[0] === byX.length - 1)) ends = 0.012;   // (a lone note: the thumb and little finger only if it saves a move)
      const cost = stretch * 3 + Math.abs(mean - hx) + ends;
      if (cost < bestCost) { bestCost = cost; best = { pick: pick.slice(), hx: mean }; }
      return;
    }
    for (let k = from; k < byX.length; k++) { pick.push(k); walk(k + 1); pick.pop(); }
  };
  walk(0);
  const fingers = new Array(keys.length).fill(-1);
  for (let i = 0; i < n; i++) fingers[order[i]] = byX[best.pick[i]];
  return { fingers, hx: best.hx };
}
