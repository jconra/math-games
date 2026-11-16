// THE ARENA: Mathball, the game's maker's Tron-style number-ball game in the square inside the loop ("grab balls that
// are numbers and throw them in the right goals. And there is another character competing with you"; the name is his:
// "Did you hear that the Captain lost at Mathball last night?"). It is a game more than a card: walking up to the ring
// inside the arena's door and pressing Start opens the game itself (src/mathball/index.js), not the job panel.
//
// It is still a job like the others, Mathwood's way (engine.js):
//   - its PLACE is the rule sets of src/mathball/ladder.js, easiest first, as Mathwood levels: a round is played on the
//     level the crew member is on (Mathwood's levelFor), and every ball they throw is an answer at that level (right:
//     it fitted the goal), so the 4-in-5 staircase climbs it as it climbs every job's;
//   - a right ball pays as a right answer does (engine.js payFor), and counts in Mathwood's kinds of math;
//   - its own maker, `goal`, makes the same question as a card ("A ball with 12 on it: which goal does it go in?"),
//     for Mathwood's levels page and the tests: one ball that fits one goal of the level's four.
import { ownOrder } from './engine.js';
import { LADDER } from '../mathball/ladder.js';
import { ruleOf, goalsFor, dealable } from '../mathball/rules.js';
import { GOALS } from '../mathball/court.js';

const setOf = (step) => LADDER[Math.max(0, Math.min(LADDER.length - 1, step - 1))];
// (a level's grade never drops below the one before it, whatever order the game's maker puts the sets in: a set moved
// up the ladder pays at least what the sets under it pay, and Mathwood's ladders stay easiest first)
const GRADES = LADDER.reduce((a, S) => [...a, Math.max(S.grade, a.length ? a[a.length - 1] : 0)], []);
const gradeAt = (step) => GRADES[Math.max(0, Math.min(GRADES.length - 1, step - 1))];
// a goal as an answer button: the number big (or the word), the words small
const face = (rule, gi) => {
  const R = ruleOf(rule), big = R.sign.length === 2 ? R.sign[1] : R.sign[0].split(' ')[0], small = R.sign.length === 2 ? R.sign[0] : R.sign[0].split(' ').slice(1).join(' ');
  return { v: R.id, big, small, label: `the ${GOALS[gi].colour} goal: ${R.say}` };
};

export const MAKERS = {
  goal: {
    strand: 'mul', at: (step) => gradeAt(step),
    make(step, { rand = Math.random } = {}) {
      const S = setOf(step), goals = S.goals;
      const one = dealable(goals, S.pool).filter((b) => goalsFor(goals, b).length === 1);
      const ball = one[Math.floor(rand() * one.length)], gi = goalsFor(goals, ball)[0], R = ruleOf(goals[gi]);
      return ownOrder({
        key: 'goal:' + S.key, story: `A ball with ${ball} on it rolls up to you. The goals say ${goals.map((r) => ruleOf(r).say).join(', ')}.`,
        ask: 'Which goal does it go in?',
        right: face(goals[gi], gi),
        slips: goals.map((r, i) => (i === gi ? null : { ...face(r, i), slip: 'rule', why: ruleOf(r).why(ball) })).filter(Boolean),
        rightWhy: R.why(ball),
        help: { title: 'Which goal?', pic: null, line: goals.map((r) => `${ruleOf(r).say}: ${ruleOf(r).list}`).join(' · '), steps: goals.map((r) => ruleOf(r).help) },
        own: { strand: S.strand, at: gradeAt(step) }, facts: { ball, goal: gi, set: S.key },
      }, rand);
    },
  },
};

export const PLACE = {
  id: 'arena', name: 'Mathball', short: 'Mathball', math: 'Number rules: odd and even, times tables, factors, squares', pic: 'arena', job: null,
  line: 'Throw number balls into the goals they fit; the goals\' rules change as the light bar goes round.',
  levels: LADDER.map((S, i) => ({ id: S.key, title: S.short, line: S.line, grade: GRADES[i], strand: S.strand, count: 5, gen: { mix: [{ maker: 'goal', step: i + 1 }] } })),
};

export const JOB = {
  id: 'arena', name: 'Mathball', short: 'Mathball', open: true, game: 'mathball',
  // the ring inside the arena's door, on the court's south end, facing up the court (the court's own frame: court.js)
  spot: { piece: 'arena', local: [0, 0, 6.9], face: [0, -1] },
  sign: 'Mathball', signSub: 'Arena game', hint: 'Throw number balls into the goals they fit',
  place: PLACE, setting: null, makers: MAKERS, card: 'arena',
};
