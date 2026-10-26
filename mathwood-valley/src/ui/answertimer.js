// answertimer.js: times one sit-down answer for the skill model (src/math/skill.js), and says when the time can't be
// trusted. Lock boxes, the store's slips and the long work panel use it; travel jobs (roping, deer, sheep, pigs, the
// range, the wagon) don't time their answers at all.
//
//   const t = answerTimer();                 when the question is up on the screen
//   ... the kid taps an answer ...
//   recordAnswer(rider, right, { strands: [{ strand: 'words', at }], sitDown: true, size: 2, ...t.stop() })
//   t.stop() -> { ms, hidden, idle }
//     ms      how long the question was up
//     hidden  the tab was hidden (another tab, the window minimised) at some point meanwhile
//     idle    no key, mouse, touch or wheel input for idleMs (60 s) at some point: the kid may have walked away
//   The answer still counts either way; skill.js only leaves its time out (and any time over 3 times the rider's usual).
//   t.lap() -> the same as stop(), and starts timing again at once (a slip with several parts, one after another)
//   t.cancel()   stop listening without a result (the panel closed)
//
// Without a page (node tests) it still measures ms; hidden and idle stay false.

export const IDLE_MS = 60000;

export function answerTimer({ idleMs = IDLE_MS, now = () => (globalThis.performance ? performance.now() : Date.now()) } = {}) {
  const doc = typeof document !== 'undefined' ? document : null;
  let start = now(), lastInput = start, longest = 0, hidden = !!(doc && doc.visibilityState === 'hidden'), live = true;
  const onInput = () => { const t = now(); longest = Math.max(longest, t - lastInput); lastInput = t; };
  const onVis = () => { if (doc && doc.visibilityState === 'hidden') hidden = true; };
  const EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
  if (doc) {
    for (const e of EVENTS) doc.addEventListener(e, onInput, { passive: true, capture: true });
    doc.addEventListener('visibilitychange', onVis);
  }
  const off = () => {
    if (!live) return;
    live = false;
    if (doc) {
      for (const e of EVENTS) doc.removeEventListener(e, onInput, { capture: true });
      doc.removeEventListener('visibilitychange', onVis);
    }
  };
  const read = () => {
    const t = now();
    return { ms: Math.max(0, Math.round(t - start)), hidden, idle: Math.max(longest, t - lastInput) > idleMs };
  };
  return {
    stop() { const r = read(); off(); return r; },
    lap() {
      const r = read();
      start = lastInput = now(); longest = 0; hidden = !!(doc && doc.visibilityState === 'hidden');
      return r;
    },
    cancel: off,
  };
}
