// strands.js: THE REGISTRY of the game's kinds of math (the strands) and of where every question maker's steps sit on
// them (the maps). Data only; src/math/skill.js does the work (seeding, the baseline, the 80% staircase, time).
//
// Each strand is a scale from 0 to 100, laid on one rough school guide so a number means about the same school year
// in every strand:   0 = starting kindergarten, 10 = first grade, 20 = second grade, ... 80 = eighth grade,
// 90 to 100 = algebra 1. A strand's `scale` says what a few points on it mean, for the stats page and for whoever
// places a new maker on it.
//
// ADDING A STRAND = one entry in STRANDS: { id, name, short, seed, scale }. Nothing else has to change: saves keep any
// strand (rider.skill.strands), the stats page lists whatever is here, and the skill model seeds and places it the
// first time a job asks for it. seed: the related strands and a discount for each (a strand first met starts at the
// average of the related ones met so far, each times its discount); fallback: the same, used only when none of the
// seed strands is met yet (the arithmetic from equations, for a rider who has only done lock boxes). Past algebra 1, later strands (trigonometry,
// calculus...) go in the same way, with points above 90 (their own scale may start there).
//
// ADDING A MAKER (a ladder of questions) or steps = one entry in MAPS, in the block of the lane that owns the maker:
//   id: { strand, strands?, file, anchors: [point of step 1, step 2, ...], ids?, base?, inGame?, grows?, opens?, starts? }
//   anchors climb; ids name the steps when the maker names them (the lock box's rungs); base: 0 when the maker counts
//   its steps from 0 (the range), else 1; strands: a maker on two strands (positive & negative is the top of both
//   adding and taking away); inGame: false for a maker not in the game yet (it doesn't count toward a strand's top);
//   grows: true for a maker that grows its numbers within a step (stepFor's frac: the lock box's levels, the counter's
//   questions), so its top step can be asked up to TOP_MARGIN past its point; any other maker's hardest question is its
//   top step's own point (skill.js capOf); opens: see positive & negative; starts: { strand: point } for a maker on two
//   strands whose questions for one of them start further up its ladder (skill.js startOf).
//   Today's points for today's steps stay as they are (old saves were read with them); new steps go in between or at
//   the ends. A lane edits only its own blocks (ADAPTIVE.md, "CONTRACT (foundation)").
// A bad entry (a map that doesn't climb, a seed naming no strand) is left out with a console error and listed in
// PROBLEMS, which tests/skill.test.mjs checks is empty, so a slip shows in the tests and never stops the game loading.

export const STRANDS = [
  // (each strand's scale follows its makers' own steps: what a rider at that point is really being asked)
  { id: 'number', name: 'Counting & number sense', short: 'Numbers', seed: { add: 0.9, sub: 0.9 }, fallback: { eq: 0.7 },
    scale: [[0, 'counting dots up to 5'], [4, 'what comes next, up to 10'], [7, 'counting dots up to 10'],
      [10, 'one more and one less, up to 10'], [13, 'counting on and back from 10 to 20'], [14, 'biggest and smallest, counting on and back, up to 20'], [16, 'past the tens (29, 30)'],
      [20, 'counting by 2s, 5s and 10s'], [22, 'smallest to largest, up to 50'], [24, '10 more and 10 less, up to 100'],
      [30, 'rounding to the nearest ten'], [34, 'estimating a sum'], [38, 'smallest to largest, up to 1,000'],
      [44, 'rounding to the nearest hundred'], [50, 'estimating differences and products'], [62, 'biggest and smallest with negatives'],
      [68, 'between two numbers, with negatives'], [76, 'smallest to largest, with negatives'], [86, 'putting bigger negatives in order']] },
  { id: 'add', name: 'Addition', short: 'Adding', seed: { sub: 0.95, number: 0.8 }, fallback: { eq: 0.8 },
    scale: [[0, 'adding 1 or 2'], [5, 'adding up to 10 (3 + 4)'], [9, 'making 10'], [12, 'doubles and near doubles (6 + 7)'],
      [15, 'adding past 10 (8 + 5)'], [19, 'tens and ones (23 + 5)'], [24, 'carrying a ten (27 + 6)'], [30, 'two-digit sums to 100'],
      [60, 'a negative plus a positive, landing above zero (−3 + 7)'], [64, 'a negative plus a positive, landing below zero (−7 + 3)'],
      [76, 'adding a negative (4 + (−9))'], [82, 'all the negatives mixed, up to 20'], [90, 'negatives up to 50']] },
  { id: 'sub', name: 'Subtraction', short: 'Taking away', seed: { add: 0.9, number: 0.7 }, fallback: { eq: 0.8 },
    scale: [[0, 'taking away 1 or 2'], [5, 'taking away up to 10 (9 − 4)'], [9, 'taking from 10'], [12, 'missing numbers (8 − ? = 5)'],
      [15, 'taking away from 11 to 20 (17 − 4)'], [19, 'taking away past 10 (13 − 5)'], [24, 'two-digit numbers (34 − 6)'],
      [30, 'two-digit take away two-digit (52 − 27)'], [68, 'a negative going further down (−4 − 5)'], [72, 'taking away past zero (3 − 8)'],
      [76, 'taking away a negative (5 − (−3))'], [82, 'all the negatives mixed, up to 20'], [90, 'negatives up to 50']] },
  { id: 'mul', name: 'Multiplication', short: 'Times', seed: { div: 0.95, add: 0.75, sub: 0.75 }, fallback: { eq: 0.7 },
    scale: [[14, 'the 2s, 10s and 5s up to ×5'], [18, 'the 2s, 10s and 5s up to ×10'], [23, 'the 3s and 4s'], [31, 'the 9s and 11s'],
      [36, 'the 6s and 8s'], [43, 'the 7s and 12s'], [50, 'every table up to ×12'], [52, 'missing numbers (7 × ? = 56)']] },
  { id: 'div', name: 'Division', short: 'Dividing', seed: { mul: 0.9, long: 0.9 }, fallback: { eq: 0.7 },
    scale: [[16, 'sharing out evenly'], [20, 'sharing among 4 and 5'], [25, 'dividing by 2, 10 and 5'], [29, 'dividing by 3 and 4'],
      [33, 'dividing by 6, 9 and 11'], [37, 'dividing by 7, 8 and 12'], [41, 'both ways round (24 ÷ ? = 4)'],
      [45, 'remainders (13 ÷ 4 = 3 r 1)'], [55, 'what to do with a remainder'], [65, 'shares by a rule (3 times as much)']] },
  { id: 'money', name: 'Money', short: 'Money', seed: { add: 0.85, sub: 0.85 },
    scale: [[10, 'counting coins'], [20, 'adding prices up to a dollar'], [30, 'making change from a dollar'],
      [40, 'dollars and cents ($3.45 + $2.80)'], [50, 'making change from $20, buying several'], [60, 'the price of one (unit price)'],
      [70, 'tax and tips']] },
  { id: 'time', name: 'Time', short: 'Time', seed: { add: 0.8, number: 0.8 },
    scale: [[10, 'the clock to the hour'], [15, 'to the half hour'], [20, 'to the quarter hour and 5 minutes'],
      [30, 'to the minute, and how many hours from one time to another'],
      [40, 'am and pm, past noon and midnight (to bed at 11:30 pm, up at 5:30 am)'], [48, 'hours and minutes, minutes in an hour'],
      [56, 'timetables, and time across days']] },
  { id: 'frac', name: 'Fractions', short: 'Fractions', seed: { div: 0.8, mul: 0.75 },
    scale: [[28, 'one part of a whole (1/3 of 9)'], [40, 'several parts (3/4 of 12)'], [50, 'a share at a price'],
      [58, 'two shares of one whole (halves with quarters)']] },
  { id: 'dec', name: 'Decimals', short: 'Decimals', seed: { frac: 0.9, money: 0.9, add: 0.65 },
    scale: [[40, 'tenths (0.3 is three tenths)'], [45, 'hundredths, and which decimal is bigger'], [50, 'adding and taking away decimals'],
      [55, 'times and divided by 10 and 100'], [60, 'multiplying decimals'], [66, 'dividing decimals']] },
  { id: 'pct', name: 'Percent', short: 'Percent', seed: { frac: 0.9, dec: 0.95, div: 0.8 },
    scale: [[58, '50%, 25% and 10% of a number'], [62, 'any percent of a number'], [66, 'discounts and tax'],
      [72, 'how much it went up or down, in percent'], [76, 'simple interest']] },
  { id: 'ratio', name: 'Ratios & rates', short: 'Ratios', seed: { mul: 0.8, div: 0.8, frac: 0.85 },
    scale: [[38, 'miles, hours and speed'], [55, 'scaling a recipe'], [60, 'ratio tables'], [65, 'shares by a ratio (3 to 1)'],
      [72, 'proportions (3/4 = x/20)']] },
  { id: 'long', name: 'Long multiplication & division', short: 'Long work', seed: { mul: 0.85, div: 0.85 },
    scale: [[36, 'two-digit times one-digit (21 × 3)'], [40, 'dividing by one digit (84 ÷ 4)'], [42, 'carrying (16 × 7)'],
      [45, 'long division with a remainder (112 ÷ 5)'], [47, 'three-digit times one-digit (112 × 5)'], [49, 'two-digit times two-digit (16 × 24)'],
      [51, 'a zero in the answer (412 ÷ 4 = 103)'], [54, 'three-digit times two-digit (124 × 36)'], [58, 'dividing by a two-digit number (288 ÷ 12)']] },
  { id: 'words', name: 'Word problems', short: 'Word problems', seed: { add: 0.8, sub: 0.8, mul: 0.8, div: 0.8 },
    scale: [[0, 'picture stories: how many in all'], [6, 'picture stories: how many are left'], [16, 'small equal groups, with pictures'],
      [20, 'equal groups and totals'], [26, 'sharing out'], [30, 'how many more; so much a day for so many days'],
      [38, 'speed; hands, meals and days'], [42, 'money and change; a week of supplies'], [48, 'two steps; rounding up to whole crates'],
      [55, 'recipes, whole crates, what an order costs'], [64, 'big orders by the dozen and the sack'], [66, 'discounts and tax'],
      [75, 'stories told backwards (3x + 5 = 29), with the others mixed in']] },
  { id: 'order', name: 'Order of operations', short: 'Order', seed: { add: 0.7, sub: 0.7, mul: 0.7, div: 0.7 },
    scale: [[45, 'times before plus (3 + 4 × 2)'], [52, 'brackets first'], [60, 'three or more steps'], [68, 'with powers (2 + 3²)'],
      [76, 'with negatives']] },
  { id: 'pow', name: 'Exponents', short: 'Exponents', seed: { mul: 0.9, order: 0.9 },
    scale: [[58, 'squares (5² = 25)'], [62, 'cubes and powers of 10'], [70, 'square roots'], [80, 'multiplying powers (2³ × 2⁴ = 2⁷)'],
      [88, 'zero and negative powers']] },
  { id: 'eq', name: 'Equations', short: 'Equations', seed: { add: 0.75, sub: 0.75, mul: 0.75, div: 0.75, ineq: 1 },
    scale: [[0, 'picture boxes (2 plus what equals 4?)'], [10, 'balancing (= means the same as)'], [14, 'which number fits (x + 6 = 8)'],
      [20, 'x + 4 = 9'], [26, 'x − 3 = 5'], [32, '3x = 12'], [38, 'x ÷ 4 = 3'], [50, 'one step with negatives'],
      [56, 'two steps (2x + 5 = 17)'], [62, 'two steps with negatives'], [66, 'the opposite of x (−x = 4)'],
      [70, 'divided, plus a number (x/3 + 2 = 5)'], [74, 'the whole side divided'], [78, 'brackets (3(x + 2) = 18)'],
      [81, 'like terms (3x + 2x = 15)'], [84, 'x on both sides'], [88, 'both sides with negatives'], [92, 'brackets on both sides'],
      [96, 'x on both sides, now and then no solution or every number']] },
  { id: 'ineq', name: 'Inequalities', short: 'Inequalities', seed: { eq: 0.85 },
    scale: [[70, 'less or more (2x + 3 < 11)'], [78, 'the flip (−3x ≥ 12)'], [88, 'three rooms (3x − 9 < 6x < 3x + 12)'],
      [94, 'either or (x + 2 < 0 or 2x > 8)']] },
  { id: 'geo', name: 'Geometry', short: 'Geometry', seed: { mul: 0.6, add: 0.6, sub: 0.6 },
    scale: [[40, 'naming angles'], [46, 'kinds of triangles'], [58, 'the missing angle'], [78, 'the three corners make 180°'],
      [86, 'right triangles (3, 4, 5)']] },
  // (later, past algebra 1: trigonometry, calculus, ...)
];

export const MAPS = {
  // ---- field lane ----
  // src/math/counting.js LADDER (8): dots to 5, what comes next, dots to 10, one more/less, 10 to 20, past the tens,
  // counting by 2s 5s 10s, 10 more/less to 100
  counting: { strand: 'number', file: 'src/math/counting.js', anchors: [0, 4, 7, 10, 13, 16, 20, 24] },
  // src/math/adding.js LADDER (8): +1 or 2, to 10, making 10, doubles, past 10, tens and ones, carrying, two-digit
  adding: { strand: 'add', file: 'src/math/adding.js', anchors: [0, 5, 9, 12, 15, 19, 24, 30] },
  // src/math/taking.js LADDER (8): −1 or 2, to 10, from 10, missing numbers, 11 to 20, past 10, two-digit, two-digit both
  taking: { strand: 'sub', file: 'src/math/taking.js', anchors: [0, 5, 9, 12, 15, 19, 24, 30] },
  // src/math/negatives.js LADDER (7): the top of BOTH addition and subtraction. Its level is the average of the two;
  // each card counts in the strand of its own sign (a + card in add, a − card in sub)
  // opens: also on offer once Addition or Subtraction is PLACED at 30 or more (skill.js fits): a kid sure of two-digit
  // sums meets the first negatives instead of waiting in the gap (nothing is built between 30 and 60 yet)
  // starts: its take-away cards (Subtraction's) come from step 3 (−4 − 5) up; steps 1 and 2 deal adding only
  negatives: { strand: 'add', strands: ['add', 'sub'], file: 'src/math/negatives.js', anchors: [60, 64, 68, 72, 76, 82, 90], opens: 30, starts: { sub: 68 } },
  // src/math/times.js LADDER (24): the 2s 10s 5s to x5 (1-3), to x10 (4-6), 3s and 4s (7-10), 9s and 11s (11-13),
  // 6s and 8s (14-17), 7s and 12s (18-21), every table to x12 (22), missing numbers to x10 (23), to x12 (24)
  times: { strand: 'mul', file: 'src/math/times.js', anchors: [14, 15, 16, 18, 19, 20, 23, 25, 27, 29, 31, 33, 34, 36, 38, 40, 42, 43, 45, 46, 48, 50, 52, 54] },
  // src/math/dividing.js LADDER (9): sharing among 2-3, among 4-5, ÷2 10 5, ÷3 4, ÷6 9 11, ÷7 8 12, both ways round,
  // remainders, remainders to the 10s
  dividing: { strand: 'div', file: 'src/math/dividing.js', anchors: [16, 20, 25, 29, 33, 37, 41, 45, 50] },
  // src/math/numbersense.js STEPS (11, counted from 0): the target range
  range: { strand: 'number', file: 'src/math/numbersense.js', base: 0, anchors: [14, 22, 30, 34, 38, 44, 50, 62, 68, 76, 86] },
  // labs/windmill/questions.js ladder (7 levels): the windmill lab, not in the game yet
  windmill: { strand: 'geo', file: 'labs/windmill/questions.js', inGame: false, anchors: [40, 46, 58, 72, 78, 86, 92] },

  // ---- lock box lane ----
  // src/lockbox/kbox.js K1..K3: the kindergarten boxes below R0a, the same lock box with pictures and read aloud:
  // "2 + x = 4: 2 plus what equals 4?" (sums to 5, sums to 10, taking away within 10). A map of its own, so the
  // lockbox map below (which the deer use too) keeps today's steps; the panel asks chooseMap over all three.
  lockboxK: { strand: 'eq', file: 'src/lockbox/kbox.js', ids: ['K1', 'K2', 'K3'], anchors: [0, 4, 7], grows: true },
  // src/lockbox/generate.js RUNGS R0a..R15. Within a rung, the box's level (2, 3, 4) is a third of the way to the next
  // rung each: frac 0, 1/3, 2/3 (see skill.js stepAt's frac). Below R0a (0 to 9): the kindergarten boxes (lockboxK)
  lockbox: { strand: 'eq', file: 'src/lockbox/generate.js',
    ids: ['R0a', 'R0b', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R9b', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15'],
    anchors: [10, 14, 20, 26, 32, 38, 50, 56, 62, 66, 70, 74, 78, 81, 84, 88, 92, 96], grows: true },
  // src/lockbox/generate.js RUNGS I1..I4 (ineq.js)
  lockboxIneq: { strand: 'ineq', file: 'src/lockbox/ineq.js', ids: ['I1', 'I2', 'I3', 'I4'], anchors: [70, 78, 88, 94], grows: true },
  // src/lockbox/workout.js: the "Work it out" boxes, one expression worked a part at a time (about one lock box in four
  // once they fit: strand.js WORK). Order of operations: times before plus, brackets first, three or more steps, with
  // powers, with negatives. Exponents: squares, cubes and powers of ten, square roots, multiplying powers, zero and
  // negative powers.
  order: { strand: 'order', file: 'src/lockbox/workout.js', ids: ['O1', 'O2', 'O3', 'O4', 'O5'], anchors: [45, 52, 60, 68, 76], grows: true },
  pow: { strand: 'pow', file: 'src/lockbox/workout.js', ids: ['P1', 'P2', 'P3', 'P4', 'P5'], anchors: [58, 62, 70, 80, 88], grows: true },

  // ---- store lane ----
  // src/math/wordproblems.js LADDER (9): groups, sharing, how many more, rates, money, two steps, recipes and crates,
  // discounts and tax, stories told backwards
  store: { strand: 'words', file: 'src/math/wordproblems.js', anchors: [20, 26, 30, 38, 42, 48, 55, 66, 75] },
  // src/math/supplies.js LADDER (6): the delivery orders worked out on the slip
  supplies: { strand: 'words', file: 'src/math/supplies.js', anchors: [30, 38, 44, 50, 56, 64] },
  // src/math/shares.js LADDER (7): Loot the gang's fair shares (division; its answers count in words too, at 0.5)
  shares: { strand: 'div', file: 'src/math/shares.js', anchors: [22, 32, 45, 50, 55, 65, 72] },
  // src/math/goods.js WOOL.forms (unit, part, priced, two): selling wool by the fraction
  wool: { strand: 'frac', file: 'src/math/goods.js', ids: ['unit', 'part', 'priced', 'two'], anchors: [28, 40, 50, 58] },
  // src/math/goods.js SALE_FORMS (lots, count, leftover, unit): selling eggs and milk by the dozen and the gallon
  sales: { strand: 'words', file: 'src/math/goods.js', ids: ['lots', 'count', 'leftover', 'unit'], anchors: [20, 32, 42, 52] },
  // src/math/wordproblems.js K_LADDER (4): the youngest riders' picture stories at the store (how many in all, how
  // many are left, small equal groups), the things drawn on the slip and the story read out loud
  storeK: { strand: 'words', file: 'src/math/wordproblems.js', anchors: [0, 6, 12, 16] },
  // src/math/longwork.js LADDER (9): long multiplication and long division worked a step at a time (the worked area
  // opens from a store order or a supply slip whose sum is too big for the head)
  // (on the school guide: two-digit by one-digit in grade 4, two-digit by two-digit late in grade 4, bigger ones and
  // dividing by a two-digit number in grade 5; a new strand this run, so no old save was read with other points)
  long: { strand: 'long', file: 'src/math/longwork.js', ids: ['mul21', 'div1', 'mulCarry', 'divRem', 'mul31', 'mul22', 'divZero', 'mul32', 'div2'],
    anchors: [36, 40, 42, 45, 47, 49, 51, 54, 58] },
  // The store counter's other questions (src/math/counter.js: now and then a customer asks one instead of bringing a
  // word problem). Each map's steps are its maker's STEPS, one per point.
  // src/math/money.js (7): counting coins, adding prices to $1, change from $1, dollars and cents, change from $10 or
  // $20, the price of one and the better buy, tax and tips
  money: { strand: 'money', file: 'src/math/money.js', anchors: [10, 20, 30, 40, 50, 60, 70], grows: true },
  // src/math/clock.js (9): the grandfather clock to the hour, half past, quarter past and to, 5 minutes, the minute;
  // hours between, am and pm past noon and midnight, hours and minutes, timetables and across days
  time: { strand: 'time', file: 'src/math/clock.js', anchors: [10, 15, 20, 24, 30, 32, 40, 48, 56], grows: true },
  // src/math/decimals.js (6): tenths, hundredths and which is bigger, adding and taking away, times and divided by 10
  // and 100, multiplying, dividing
  dec: { strand: 'dec', file: 'src/math/decimals.js', anchors: [40, 45, 50, 55, 60, 66], grows: true },
  // src/math/percent.js (5): 50% 25% 10% of, any percent of, discounts and tax, up or down in percent, simple interest
  pct: { strand: 'pct', file: 'src/math/percent.js', anchors: [58, 62, 66, 72, 76], grows: true },
  // src/math/ratios.js (5): speed (the store's rate stories), recipes, ratio tables, shares by a ratio, proportions
  ratio: { strand: 'ratio', file: 'src/math/ratios.js', anchors: [38, 55, 60, 65, 72], grows: true },

  // ---- completion lane, menu lane: no makers ----
};

// ---- checks, when this file loads (a bad entry is left out and listed, never thrown) ---------------------------
export const PROBLEMS = [];
const bad = (what) => { PROBLEMS.push(what); try { console.error('Bandit Math strands.js: ' + what); } catch (e) { /* no console */ } };
{
  const seen = new Set(), keep = [];
  for (const s of STRANDS) {
    const ok = s && typeof s.id === 'string' && s.id && typeof s.name === 'string' && Array.isArray(s.scale) && s.scale.length;
    if (!ok || seen.has(s.id)) { bad(`strand ${s && s.id} left out (needs a new id, a name and a scale)`); continue; }
    seen.add(s.id); keep.push(s);
    s.short = s.short || s.name;
    s.seed = s.seed && typeof s.seed === 'object' ? s.seed : {};
    s.fallback = s.fallback && typeof s.fallback === 'object' ? s.fallback : {};
  }
  STRANDS.splice(0, STRANDS.length, ...keep);   // (the first entry with an id wins)
  for (const s of STRANDS) for (const f of ['seed', 'fallback']) for (const k of Object.keys(s[f])) if (!seen.has(k) || !(s[f][k] > 0)) { bad(`strand ${s.id}: ${f} ${k} left out`); delete s[f][k]; }
  for (const [k, m] of Object.entries(MAPS)) {
    if (!m || !Array.isArray(m.anchors) || !m.anchors.length) { bad(`map ${k} left out (no anchors)`); delete MAPS[k]; continue; }
    m.id = k;
    m.strands = Array.isArray(m.strands) && m.strands.length ? m.strands : [m.strand];
    m.strand = m.strand || m.strands[0];
    m.base = m.base === 0 ? 0 : 1;
    if (m.inGame === undefined) m.inGame = true;
    let why = null;
    if (m.strands.some((s) => !seen.has(s))) why = 'its strand is not in STRANDS';
    for (let i = 0; i < m.anchors.length && !why; i++) if (!(typeof m.anchors[i] === 'number' && m.anchors[i] >= 0 && m.anchors[i] <= 100 && (i === 0 || m.anchors[i] > m.anchors[i - 1]))) why = 'its points must climb, from 0 to 100';
    if (!why && m.ids && m.ids.length !== m.anchors.length) why = 'it needs one id per step';
    if (why) { bad(`map ${k} left out: ${why}`); delete MAPS[k]; }
  }
}

export const STRAND = Object.fromEntries(STRANDS.map((s) => [s.id, s]));
export const STRAND_IDS = STRANDS.map((s) => s.id);
