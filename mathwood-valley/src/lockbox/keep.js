// A LOCK BOX THAT IS WON IS NEVER DEALT OVER.
// Two things deal a new box over the one that is up (panel.js): the level arrows in the box's top strip, and the
// help menu's "Skip to a new question". Neither may throw away a box that is already solved. Its check may still be
// playing, or its working may be up with "Next problem" under it, and its gold is paid only when that button is
// pressed: dealt over there, the box was lost unpaid (and in Pi Nebula a pod's lock, solved, stayed shut).
// The level still moves when an arrow is pressed on such a box: the next box comes at the new level.
//
//   mayDealOver(phase, solved) -> true when the box that is up may be swapped for a new one
//     phase    the box's phase (play | anim | parts | brackets | nlpick | review | open | done)
//     solved   the box's own word that its last answer is in and right (its B.solved)
export function mayDealOver(phase, solved) {
  if (solved) return false;   // won: it goes on by its own button, and is paid there
  return phase !== 'review' && phase !== 'open' && phase !== 'done';
}
