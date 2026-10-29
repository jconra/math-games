// The saloon's chalkboard: GRAPHS AND LINES, taught by a traveling mathematician bound for San Francisco
// (src/graphteacher.js; the plan ~/pw/bandit-math/GRAPHS.md). Points first: find one on the grid, read one, then all four
// quarters. The rest of the ladder (the plan's 4 to 9) comes as new `gen` kinds for src/math/graphs.js makeQuestion, each
// a level here: rise over run from two points drawn (whole numbers, then fractions, then negative slopes; strand 'eq'
// about 80), slope from two points by the numbers, point-slope form y - y1 = m(x - x1), point-slope to y = mx + b, a line
// through two points, the parallel line through another point (algebra 1, about 90).
//
// gen (src/math/graphs.js makeQuestion reads it):
//   { kind: 'find', lo, hi }    "Find (2, 3)": tap the spot on a grid from lo to hi both ways
//   { kind: 'read', lo, hi }    a point drawn: "What point is this?", four answers (x first)
//   { kind: 'quads', lo, hi }   both by turns on a grid through zero (at least one of x, y negative)

import { makeQuestion } from '../../math/graphs.js';

const L = (id, title, line, grade, gen, more = {}) => ({ id, title, line, grade, strand: 'geo', count: 5, gen, ...more });

export const PLACE = {
  id: 'graphs', name: "The Professor's chalkboard", short: 'Graphs', math: 'Graphs and lines', pic: 'grid', job: null, fastFrom: null,
  growing: 'rungs 4 to 9 (rise over run to parallel lines) still to come: ~/pw/bandit-math/GRAPHS.md',
  line: 'Find points on a grid and read them, x first: then lines and their slopes.',
  levels: [
    L('find', 'Find the point', 'Find (2, 3): go along x, then up to y, and tap the spot', 50, { kind: 'find', lo: 0, hi: 6 }),
    L('read', 'Read the point', 'A point on the grid: what is it? x first, then y', 52, { kind: 'read', lo: 0, hi: 6 }),
    L('quads', 'All four quarters', 'Points with negatives, from −5 to 5: left and down are below zero', 62, { kind: 'quads', lo: -5, hi: 5 }),
  ],
  example: (lv, rand) => {
    const q = makeQuestion(lv.gen, rand, { i: Math.floor(rand() * 2) });
    if (q.kind === 'find') return { q: q.text, a: `the dot ${q.answer}` };
    return { q: `${q.text} (a dot at ${q.answer}): ${q.choices.map((c) => c.label).join(' · ')}`, a: q.answer };
  },
};
