// YOUR OWN BEST ROUND (2026-11-20, the game's maker, of the station's line "A new Mathball high score has been set in
// the arena": "Keep only your own best round. This plays when you beat it."). Each crew member keeps the most right
// balls they have scored in one round of Mathball (a round's score: src/mathball/game.js G.score.you, "Most right balls
// wins"), saved with the rest of their progress: the arena's own tally in their save, crew.jobs.arena.best. A round
// that scores more than it is a new best, and the station says so once the round is over (src/announce.js, the
// 'highscore' line, on the 'best' event). The very first round only sets it: nothing was beaten, so nothing is said.
// A round left before its end (Leave) is no round and is not counted.
//   keepBest(tally, score) -> { best, was, beaten }   (tally: the arena's, engine.js jobTally(crew, 'arena'))
export function keepBest(tally, score) {
  const s = Math.max(0, Math.floor(Number(score) || 0));
  const was = Number.isFinite(tally.best) && tally.best >= 0 ? Math.floor(tally.best) : null;
  const beaten = was != null && s > was;
  if (was == null || s > was) tally.best = s;
  return { best: tally.best, was, beaten };
}
// ON THE END CARD (2026-11-20, the game's maker: "Under the credits on the end card: "Your best: 6". When you beat it:
// "New best!""). The line under the credits on the card at the end of a round: the crew member's own best, or, the
// round that beat it, "New best!". (The first round only sets it, as the station says nothing then: "Your best: 3".)
// Nothing of it on the card where you pick who to play.
//   bestWords(keepBest's { best, beaten }) -> 'Your best: 6' | 'New best!' | '' (no best)
export function bestWords(r) {
  if (!r || !Number.isFinite(r.best)) return '';
  return r.beaten ? 'New best!' : `Your best: ${r.best}`;
}
