// THE SMALL MOVES' RULES, as plain sums (people.js, moves.js and player.js use them; the tests run them):
//   fineFor(quality, far, was)   who gets the weight on one leg and the hands laid on their work: only near enough to
//                     see it (FINE.near m from the camera, FINE.give more to let it go, so nobody flickers at the
//                     edge), never on the low picture quality: each costs leg and arm solves every update, and a phone
//                     does not pay for a desktop's look. -> { stance, hands } (hands: and not drawn as the far copy,
//                     farCopy)
//   nextStance(want, talking, rand)   the stance's next change, each person's own: { want (+1 the weight on their
//                     left, -1 their right, 0 on both), after (s) }, from their own random numbers (rand(): 0 to 1)
//   turnStep(diff, stepping)     a turn on the spot (diff radians still to go): bigger than TURN_STEP is stepped round,
//                     the legs walking it, never swivelled on still feet -> { stepping, clip: 'walk' | 'stand' }
//   deskSeat(chair, ahead)       where a desk chair's sitter sits: DESK_SIT m forward of its middle, nearer the desk (its
//                     chair stands an arm's length off the desk, in the station's own file)
export const FINE = { near: 12, give: 1 };
export function fineFor(quality, far, was = false, farCopy = false) {
  const stance = quality !== 'low' && far < FINE.near + (was ? FINE.give : 0);
  return { stance, hands: stance && !farCopy };
}

export const STANCE = { shift: 0.04, drop: 0.02, roll: 0.07, chest: 0.04, free: 0.05, every: [5, 13], even: 0.2, ease: 1.1 };
export function nextStance(want, talking, rand = Math.random) {
  const w = want === 0 ? (rand() < 0.5 ? 1 : -1) : rand() < STANCE.even ? 0 : -want;
  // (on both legs a shorter while; in a talk, over from one leg to the other more often)
  const after = (STANCE.every[0] + rand() * (STANCE.every[1] - STANCE.every[0])) * (w === 0 ? 0.5 : 1) * (talking ? 0.45 : 1);
  return { want: w, after };
}

export const TURN_STEP = 0.35;
export function turnStep(diff, stepping) {
  const s = stepping || Math.abs(diff) > TURN_STEP;
  return { stepping: s, clip: s && Math.abs(diff) > 0.05 ? 'walk' : 'stand' };
}

export const DESK_SIT = 0.14;
export const deskSeat = (chair, ahead) => [chair[0] + ahead[0] * DESK_SIT, chair[1], chair[2] + ahead[2] * DESK_SIT];
