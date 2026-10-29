// LIGHTING A FIRE IN THE CABIN'S HEARTH: a few quick sums first, fireside ones (the game's maker: "We could always ask
// some math questions. It doesn't have to be an official job"). Three cards of the early card topics (counting,
// adding, taking away: src/math/counting.js, adding.js, taking.js, their own problems, real-slip answers, the line
// that says why a wrong pick is wrong, and the helper's picture: src/ui/counthelp.js), at the rider's own level (the
// skill model, asked as the field jobs ask it: src/math/asking.js chooseFor and askFor). It's not a job: nothing is
// paid, nothing is counted or kept, nothing moves the rider's level; a wrong pick costs nothing (the line and the
// picture come up, then pick again), and the helper is there from the start.
//
//   FIRE_MATH                              the dials
//   fireCards(rider, { rand })  -> { map, step, title, lead, cards: [card] }   card: the topic's ({ text, say, answer,
//                                          targets: [{ n, good, trap }], parts ... }) with `id`
//   wrongLine(set, card, n)     -> the plain line after a wrong pick
//   nudgeLine(set, card)        -> a line for a rider who is stuck (no answer in it)
//   helpPicture(set, card, { reveal, picked, reason })   -> the helper's drawing for src/ui/counthelp.js
import { chooseFor, askFor } from '../math/asking.js';
import { SPEC as COUNTING } from '../math/counting.js';
import { SPEC as ADDING } from '../math/adding.js';
import { SPEC as TAKING } from '../math/taking.js';

export const FIRE_MATH = {
  maps: ['counting', 'adding', 'taking'],   // the skill model's makers the fire deals from
  cards: 3,                                 // sums before the fire catches
  answers: 4,                               // answers on a card (one right)
  stuck: 9,                                 // s without a pick before the helper comes up by itself
};
const SPECS = { counting: COUNTING, adding: ADDING, taking: TAKING };
// (the fireside words over the sums: what the numbers are, as the topic's)
const WORDS = {
  counting: { title: 'Count the kindling', lead: 'Count out the sticks to start it.' },
  adding: { title: 'Stack the firewood', lead: 'Split logs stacked by the hearth: how many?' },
  taking: { title: 'Feed the fire', lead: 'Logs on the fire: how many are left in the box?' },
};

const pickShape = (row, rand) => {
  const ws = row.shapes.map((s) => (row.weights && row.weights[s]) || 1), sum = ws.reduce((a, b) => a + b, 0);
  let r = rand() * sum; for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) return row.shapes[i]; }
  return row.shapes[row.shapes.length - 1];
};

export function fireCards(rider, { rand = Math.random } = {}) {
  const map = chooseFor(rider, FIRE_MATH.maps, { rand }) || 'adding', S = SPECS[map] || ADDING;
  let step = 1;
  try { const q = askFor(rider, map); step = Math.round(q && q.step) || 1; } catch (e) { step = 1; }
  step = Math.max(1, Math.min(S.LADDER.length, step));
  const row = S.LADDER[step - 1], cards = [], seen = new Set();
  for (let i = 0, tries = 0; cards.length < FIRE_MATH.cards && tries < 30; tries++) {
    const p = S.problem(pickShape(row, rand), row, rand), k = S.key(p);
    if (seen.has(k) && tries < 20) continue;
    seen.add(k);
    const c = S.card(p, { size: FIRE_MATH.answers, rand, avoid: cards.length ? cards[cards.length - 1].answer : null });
    cards.push({ ...c, parts: p, shape: p.shape, id: ++i });   // (the problem rides on the card, as the trainer's own cards carry it)
  }
  return { map, step, ...WORDS[map], cards };
}
export const wrongLine = (set, card, n) => { try { return (SPECS[set.map] || ADDING).whyNot(card, n).line; } catch (e) { return `Not that one: it's ${card.answer}.`; } };
export const nudgeLine = (set, card) => { try { return (SPECS[set.map] || ADDING).nudge(card); } catch (e) { return ''; } };
export function helpPicture(set, card, { reveal = false, picked = null, reason = '' } = {}) {
  let p = null; try { p = (SPECS[set.map] || ADDING).picture(card); } catch (e) { p = null; }
  return p ? { ...p, reveal, picked, reason } : null;
}
