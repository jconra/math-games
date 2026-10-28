// sayline.js: the browser's own (synthetic) voice is NOT used in the game. Only the maker's recorded clips are read
// out (src/audio/readaloud.js), and only while a grown-up has turned Read aloud on. sayLine and talking stay as quiet
// stand-ins so the callers need no change: the line is still shown on screen, and sayLine returns false ("no voice").
//
//   sayLine(text, opts)   -> false (nothing is said)
//   talking()             -> false
//   hush()                stops any browser voice that might still be speaking (from an older page in the same tab)

let waiting = 0;   // (kept for hush)

export function sayLine(text, opts = {}) {   // eslint-disable-line no-unused-vars
  return false;
}

export function talking() {
  return false;
}

export function hush() {
  if (waiting) { clearTimeout(waiting); waiting = 0; }
  try { if (globalThis.speechSynthesis) globalThis.speechSynthesis.cancel(); } catch (e) { /* nothing to stop */ }
}
