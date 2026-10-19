// sayline.js: the browser's own voice for the lines around a question that a rider who can't read yet would miss: Old
// Hob's directions and the why of a wrong pick (the round-up's help, the range's, the store's and the loot's slips).
// The questions themselves are read from the maker's recorded clips (src/audio/readaloud.js), or, a whole story, by
// the store slip's speakLine. The callers say a line only while skill.js readAloud(rider) is on.
//
//   sayLine(text, { now = false, after = 0 })   now: cut short whatever the browser's voice is saying (a wrong pick's
//                                                why: the newest line matters most); else it waits its turn behind the
//                                                one being said. after: ms to wait first (a reaction clip goes first).
//                                                -> false when the browser has no voice
//   talking()                                    true while the browser's voice is speaking (main.js: the card clips wait)
//   hush()                                       stop the browser's voice
//
// The money and math in a line are said in words (storeslip.js sayable: "$3.45" as "3 dollars and 45 cents").

import { sayable } from '../ui/storeslip.js';

let waiting = 0;   // (a line set to start after a moment: its timer)

export function sayLine(text, { now = false, after = 0 } = {}) {
  let S, Utt;
  try { S = globalThis.speechSynthesis; Utt = globalThis.SpeechSynthesisUtterance; } catch (e) { return false; }
  if (!S || !Utt || !text) return false;
  const go = () => {
    try {
      if (now) S.cancel();
      const u = new Utt(sayable(String(text)));
      u.rate = 0.92; u.lang = 'en-US';
      S.speak(u);
    } catch (e) { /* no voice: the line is still on screen */ }
  };
  if (now && waiting) { clearTimeout(waiting); waiting = 0; }
  if (after > 0) waiting = setTimeout(() => { waiting = 0; go(); }, after); else go();
  return true;
}

export function talking() {
  try { return !!(globalThis.speechSynthesis && globalThis.speechSynthesis.speaking); } catch (e) { return false; }
}

export function hush() {
  if (waiting) { clearTimeout(waiting); waiting = 0; }
  try { if (globalThis.speechSynthesis) globalThis.speechSynthesis.cancel(); } catch (e) { /* nothing to stop */ }
}
