// A BOX SOLVED, TOLD: the lock box's optional opts.onSolved (another game's: Pi Nebula's pod locks chime there), called
// once a box at the moment its last answer is judged right. No page: node tests it (tests/lockboxsolved.test.mjs).
//   const told = solvedHook(opts)    told() at every place a box is solved; onSolved runs the first time only; a throw
//                                    from it is logged and the box goes on. Without opts.onSolved: nothing at all.
export function solvedHook(opts = {}) {
  let done = false;
  return () => {
    if (done || !opts || typeof opts.onSolved !== 'function') return;
    done = true;
    try { opts.onSolved(); } catch (e) { console.error(e); }
  };
}
