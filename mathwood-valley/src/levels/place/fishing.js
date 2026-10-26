// Fishing off the dock: FRACTIONS, all of it (the agreed design, 2026-10-21: "all fractions ... it still starts off
// easy, and it doesn't always have to be about the fish you caught"). A kindergartner counts the slices in Pam's pie pan
// (1/4, 2/4, 3/4, 4/4); then what one slice is called; "is 2/4 the same as 1/2?" (yes or no, the pies drawn); a fraction
// of the fish you caught for Tom; what's left of Pam's pie; keep or throw back by length; line-ups and weights added
// with the same bottom number; equal fractions; a whole number of fish times a fraction of a pound; different bottom
// numbers; mixed numbers; taking away pie; a fraction of a fraction; how many pieces of a fraction fit.
// Every question still hangs on a caught fish (the card shows it, and it goes in the creel). The ratio questions the
// dock used to ask are the store's now (the mixed place).
//
// gen (what the dock's maker reads: labs/fishing/pies.js questionAt, the ONE maker for the dock and these examples):
//   { kind: 'fish', from, topic?, topics? }   the dock's own fish questions (labs/fishing/questions.js questionFor at its step
//                                     1-6: keep or throw, line-ups, weights added, equal fractions, unlike, mixed)
//   { kind: 'slices' | 'word' | 'same' | 'group' | 'left' | 'timesW' | 'take' | 'times' | 'divide', den?, unit?,
//     choices?, most? }               the questions off the fish (pies.js)

import { questionAt } from '../../../labs/fishing/pies.js';
import { practiceCreel } from '../../../labs/fishing/questions.js';

const L = (id, title, line, grade, gen, more = {}) => ({ id, title, line, grade, strand: 'frac', count: 5, gen, ...more });

export const PLACE = {
  id: 'fishing', name: 'Fishing', short: 'Fishing', math: 'Fractions', pic: 'fish', job: 'fishing', fastFrom: null,
  line: 'Every question at the dock is about fractions: pies, fish, lengths and shares.',
  levels: [
    L('slices', 'Count the slices', 'A pie pan cut in 2 or 4: is it 1/4, 2/4, 3/4 or 4/4 full?', 3, { kind: 'slices', den: [2, 4], choices: 3 }, { read: true }),
    L('slices8', 'Count the slices, more cuts', 'Pans cut in 3, 6 or 8: 5/8 of a pie', 7, { kind: 'slices', den: [3, 4, 6, 8], choices: 4 }, { read: true }),
    L('word', 'Halves, thirds, quarters', 'One slice of a pie cut in 3 is a third', 10, { kind: 'word', den: [2, 3, 4] }, { read: true }),
    L('same', 'Is 2/4 the same as 1/2?', 'Two pies drawn: yes or no', 16, { kind: 'same' }, { read: true }),
    L('group', 'A fraction of your fish', 'You caught 9 fish and give Tom one third: how many?', 22, { kind: 'group', den: [2, 3, 4], unit: true, most: 5 }),
    L('left', "What's left of the pie", "Pam's pie was cut in 8 and 3 slices are gone: 5/8 left", 26, { kind: 'left', den: [3, 4, 6, 8] }),
    L('group2', 'Two thirds of your fish', 'Two thirds of 9 fish, three quarters of 8', 30, { kind: 'group', den: [3, 4, 5], most: 5 }),
    L('keep', 'Keep or throw back', 'Is the fish as long as the keeper limit? Halves and quarters of a foot', 32, { kind: 'fish', from: 1, topic: 'keep' }),
    L('keep8', 'Eighths of a foot', 'Keep or throw, the ruler marked in eighths', 35, { kind: 'fish', from: 2, topic: 'keep' }),
    L('add', 'The same bottom number', '1/4 lb + 1/4 lb; three fish in order', 40, { kind: 'fish', from: 3, topics: ['add', 'order'] }),
    L('equal', 'Equal fractions', '3/4 is the same as 9/12; the simplest form', 44, { kind: 'fish', from: 4 }),
    L('timesW', 'Fish times a fraction', '4 perch of 3/4 of a pound each: 3 pounds', 47, { kind: 'timesW' }),
    L('unlike', 'Different bottom numbers', '5/8 + 1/2; which is longer, 2/3 or 5/8?', 50, { kind: 'fish', from: 5 }),
    L('mixed', 'Mixed numbers', '1 1/4 lb + 3 7/8 lb; inches and feet', 54, { kind: 'fish', from: 6 }),
    L('take', 'Taking away pie', '3/4 of a pie, 1/3 sold: 5/12 left', 56, { kind: 'take' }),
    L('times', 'A fraction of a fraction', '2/3 of a 3/4-pound perch', 60, { kind: 'times' }),
    L('divide', 'How many pieces?', '3 pounds cut in 1/4-pound pieces: 12', 64, { kind: 'divide' }),
  ],
  example: (lv, rand) => fishingExample(lv.gen, rand),
};

export function fishingExample(g, rand) {
  // (the dock's own fish questions that add or line up the fish already in the creel need some there: the levels page
  // has no creel, so its examples bring a few made-up fish, as the dock's "Try it" does; without them every example of
  // "The same bottom number" came out as keep-or-throw)
  const q = questionAt(g, rand, g.kind === 'fish' ? { creel: practiceCreel(g.from, rand) } : {});
  return { q: q.prompt, a: q.answerLabel || String(q.answer) };
}
