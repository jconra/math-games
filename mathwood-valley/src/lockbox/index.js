// The lock boxes, as the rest of the game sees them.
//
//   openLockbox(root, { rider, box: { tier: 'tin'|'iron'|'brass'|'vault', from: 'sheriff'|'loot'|'practice' }, onBox, onDone, next })
//     a full-screen panel over the paused game. Boxes come one after another until the kid presses "Done for now"
//     (or Esc): seized boxes from the sheriff never run out; boxes from the saddlebags (from 'loot') go through
//     rider.lockboxes and the panel closes by itself after the last one.
//     onBox(result) runs as each box finishes (solved or skipped): the caller pays and records it right then
//       (save.js earn + recordLockbox) and takes a solved 'loot' box out of rider.lockboxes; it may return
//       { newTitle, badge } for the coin animation to show. result = { solved, gold, moves, par, rung, tier,
//       clean, left, hints }.
//     onDone(totals) runs once when the panel closes: { solved, boxes, played, gold, moves, par, rung, tier,
//       clean, left, hints, results, paid }. Without onBox the caller pays totals.gold here instead. A box solved
//       a moment before "Done for now" (its check still playing) is paid through onBox first; an unsolved one isn't
//       counted.
//     next(lastResult) (optional) picks the next box, or null to stop.
//     It changes rider.topics.algebra in place (the ladder).
//   makeAlgebra(state) -> { next(tier), record(result), level(), fav(), speed(rung), seenTool(kind), state }
//     the solving-for-x ladder kept in rider.topics.algebra.
//   TIER_GOLD, TIER_NAME   what an opened box of each tier pays (always in full), and its name.

export { openLockbox } from './panel.js';
export { makeAlgebra } from './algebra.js';
export { TIER_GOLD, TIER_NAME, goldFor } from './box.js';
export { RUNGS } from './generate.js';
