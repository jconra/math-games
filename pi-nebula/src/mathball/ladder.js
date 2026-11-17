// MATHBALL'S LADDER: the rule sets, easiest first, and the levels built from them. A round is played on one level (the
// four goals' first rules, the balls that can come out of the ports, the rules a goal may change to as the light bar
// reaches it); a crew member climbs the levels as every job's ladder is climbed (Mathwood's levels: src/jobs/arena.js).
//
// The game's maker (2026-11-16): "It should start out easy and work up to harder questions. By easy I mean the goals can
// say even, odd, 'less than 5', 'more than 10' ... then easier multiples (2,3,5,10), then medium (4, 6, 9, 11), then
// harder (7,8,12). I like the question about squares also." And on his questions page (2026-11-17, MB-2: "Add fractions
// and decimals after these"): "Why does 6th say 'odd numbers'? Isn't that the easiest? And what do you mean more than
// 30? Any kind of more than or less than is way easier than multiples and factors. I think they all need to encompass a
// range, except for level 1. 1: 1 / 2: 1, 2 / 3: 2, 3 / 4: 2, 3, 4 / 5: 3, 4, 5 / 6: 3, 4, 5, 6".
//
// So a LEVEL takes its goals' rules from a RANGE of the rule sets (RANGES: his table, and the same pattern on for the
// levels after it: level n from set n/2 rounded up to set n). A round at a level starts with four goals drawn from all
// of them (startGoals: one or two from the level's own set, the newest, the rest from the others, the newer more often),
// and a goal's rule changes to another of them as the light bar reaches it, the level's own set's rules first. The
// balls come from all of the sets' balls (only those that fit at least one goal and never all four). The sixth set has
// only hard rules (no odd numbers, no more than or less than); after it, the fractions, the decimals, and the two
// together (the same amount written two ways).
//
// TO SORT THE SETS: the lab (pi-nebula/labs/mathball/) lists the levels, each with the sets it draws from and an example
// court; drag the sets into the order you want, press Copy the order, and paste the line it gives over the ORDER line
// below. A set left out of ORDER is left out of the game. (A crew member already on a level keeps it, wherever its set
// moves to: a level is known by its own set's key.)
//
// A RULE SET: name, short and line (what the levels show); strand and grade (where it sits on Mathwood's school guide:
// what a right ball counts toward, and its pay); rules (every rule of the set: rules.js names them); starts (the four a
// level made of this set alone starts with, when it has more than four); pool (every ball it may bring: whole numbers,
// fractions '3/4', decimals '0.75').
import { checkSet, dealable, crowded, ruleOf } from './rules.js';
export const ORDER = ['oddeven', 'tables1', 'tables2', 'tables3', 'squares', 'primes', 'fractions', 'decimals', 'sameamount'];
// level n (1, 2, 3 ...) takes its rules from sets lo to hi of ORDER: his table for the first six, then his pattern on
export const RANGES = [[1, 1], [1, 2], [2, 3], [2, 4], [3, 5], [3, 6], [4, 7], [4, 8], [5, 9], [5, 10], [6, 11], [6, 12]];
export const rangeOf = (n) => RANGES[n - 1] || [Math.ceil(n / 2), n];

const upTo = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
export const SETS = {
  oddeven: {
    name: 'Odd and even, bigger and smaller', short: 'Odd and even', line: 'Even, odd, less than 5, more than 10: the numbers 1 to 20',
    strand: 'number', grade: 14, rules: ['even', 'odd', 'less:5', 'more:10', 'less:8', 'more:15', 'less:10', 'more:12'], starts: ['even', 'odd', 'less:5', 'more:10'], pool: upTo(1, 20),
  },
  tables1: {
    name: 'Easy times tables: 2, 3, 5 and 10', short: 'Times 2, 3, 5, 10', line: 'Multiples of 2, 3, 5 and 10, up to 50',
    strand: 'mul', grade: 20, rules: ['mult:2', 'mult:3', 'mult:5', 'mult:10'], pool: upTo(2, 50),
  },
  tables2: {
    name: 'Times tables: 4, 6, 9 and 11', short: 'Times 4, 6, 9, 11', line: 'Multiples of 4, 6, 9 and 11, up to 99',
    strand: 'mul', grade: 32, rules: ['mult:4', 'mult:6', 'mult:9', 'mult:11'], pool: upTo(4, 99),
  },
  tables3: {
    name: 'Hard times tables: 7, 8 and 12', short: 'Times 7, 8, 12', line: 'Multiples of 7, 8 and 12, up to 99',
    strand: 'mul', grade: 42, rules: ['mult:7', 'mult:8', 'mult:12'], pool: upTo(7, 99),
  },
  squares: {
    name: 'Factors and square numbers', short: 'Factors and squares', line: 'Factors of 24, 30, 36 and 48, and square numbers (the game\'s maker\'s own example: factors of 24 beside multiples of 8)',
    strand: 'mul', grade: 50, rules: ['fact:24', 'fact:36', 'square', 'fact:30', 'fact:48'], starts: ['fact:24', 'fact:36', 'square', 'fact:48'],
    pool: [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 16, 18, 24, 25, 30, 32, 36, 40, 48, 49, 56, 64, 72, 81],
  },
  primes: {
    name: 'Prime, square and cube numbers', short: 'Primes and cubes', line: 'Prime numbers, square numbers, cube numbers, factors of 60 and of 72, up to 100',
    strand: 'div', grade: 52, rules: ['prime', 'square', 'cube', 'fact:60', 'fact:72'], starts: ['prime', 'square', 'cube', 'fact:60'],
    pool: [...upTo(1, 50), 53, 59, 60, 61, 64, 67, 71, 72, 73, 79, 81, 83, 89, 97, 100],
  },
  // (fraction balls: a fraction against one half, equal to one; the top number against half the bottom one)
  fractions: {
    name: 'Fractions: more or less than a half', short: 'Fractions', line: 'Fraction balls: equal to 1/2, more than 1/2, less than 1/2, between 1/2 and 1, equal to 1, less than 1/4',
    strand: 'frac', grade: 54, rules: ['eq:1/2', 'more:1/2', 'less:1/2', 'between:1/2:1', 'eq:1', 'less:1/4'], starts: ['eq:1/2', 'more:1/2', 'less:1/2', 'eq:1'],
    pool: ['1/2', '2/4', '3/6', '4/8', '5/10', '1/3', '1/4', '1/5', '1/6', '1/8', '2/5', '3/8', '3/10', '2/3', '3/4', '3/5', '4/5', '5/6', '5/8', '7/8', '7/10', '2/2', '3/3', '4/4'],
  },
  // (decimal balls, tenths and a few quarters: between 0 and 1, the nearest whole number; never a half, which rounds
  // both ways to a child's eye)
  decimals: {
    name: 'Decimals: between 0 and 1, and rounding', short: 'Decimals', line: 'Decimal balls: between 0 and 1, rounds to 1, 2, 3 or 4, more than 2.5, less than 1.5',
    strand: 'dec', grade: 56, rules: ['between:0:1', 'round:2', 'round:3', 'more:2.5', 'round:1', 'round:4', 'less:1.5'], starts: ['between:0:1', 'round:2', 'round:3', 'more:2.5'],
    pool: ['0.2', '0.3', '0.4', '0.6', '0.7', '0.8', '0.9', '0.25', '0.75', '1.2', '1.3', '1.4', '1.6', '1.7', '1.8', '1.25', '2.1', '2.2', '2.3', '2.4', '2.6', '2.7', '2.8', '2.9', '2.75', '3.1', '3.2', '3.3', '3.4', '3.6', '3.7', '3.8', '3.25', '4.1', '4.2', '4.3', '4.4'],
  },
  // (fractions and decimals together: 0.5 and 2/4 both go in "equal to 1/2")
  sameamount: {
    name: 'Fractions and decimals: the same amount', short: 'Same amount', line: 'Fraction and decimal balls: 0.5 and 2/4 are both equal to 1/2, 0.25 and 2/8 are 1/4, 0.75 and 6/8 are 3/4',
    strand: 'frac', grade: 58, rules: ['eq:1/2', 'eq:1/4', 'eq:3/4', 'eq:1', 'more:1/2', 'less:1/2'], starts: ['eq:1/2', 'eq:1/4', 'eq:3/4', 'more:1/2'],
    pool: ['1/2', '2/4', '3/6', '5/10', '0.5', '1/4', '2/8', '3/12', '0.25', '3/4', '6/8', '9/12', '0.75', '4/4', '2/2', '1', '1/3', '2/3', '0.4', '0.6', '0.8', '1/8', '7/8'],
  },
};

// ── THE LEVELS ─────────────────────────────────────────────────────────────────────────────────────────────────────
// level n: its own set (ORDER's n-th: a level is known by its key), the sets it draws from (RANGES), their rules and balls
const uniq = (a) => { const seen = new Set(), o = []; for (const x of a) { const k = String(x); if (!seen.has(k)) { seen.add(k); o.push(x); } } return o; };
export function levelsOf(order = ORDER) {
  const keys = order.filter((k) => SETS[k]);
  return keys.map((key, i) => {
    const [lo, hi] = rangeOf(i + 1), from = keys.slice(Math.max(0, lo - 1), Math.min(keys.length, hi)), S = SETS[key];
    const others = from.filter((k) => k !== key);
    return {
      key, own: key, sets: from, range: [lo, hi], name: S.name, short: S.short,
      line: others.length ? `${S.line}; with ${others.map((k) => SETS[k].short.toLowerCase()).join(', ')}` : S.line,
      strand: S.strand, grade: Math.max(...from.map((k) => SETS[k].grade)),
      rules: uniq([...S.rules, ...others.slice().reverse().flatMap((k) => SETS[k].rules)]),
      theme: [...S.rules], pool: uniq(from.flatMap((k) => SETS[k].pool)),
      // (a plainer rule made for a held ball nothing else suits: only on levels that have the first set's rules)
      plain: from.includes(keys[0]),
    };
  });
}
// the ladder as the game plays it: the levels of ORDER (any set ORDER leaves out is left out), each with the four goals
// it shows before a round (its idle court, the levels page's example)
export const LADDER = levelsOf(ORDER).map((L) => ({ ...L, goals: null }));

// ── THE FOUR GOALS A ROUND STARTS WITH ────────────────────────────────────────────────────────────────────────────
// drawn from the level's rules: one or two from its own set (the newest), the rest from all its sets, a newer set's
// more often; four that pass the ball check over the level's balls (every goal fed, a dozen balls or more to deal, some
// with a choice of goals), no catch-all goal and no two alike (rules.js crowded). A level of one set starts with its
// `starts` (or its rules) as they are. -> four rule names
export function startGoals(L, rand = Math.random) {
  if (L.sets.length === 1) {
    const S = SETS[L.own], four = (S.starts || S.rules).slice(0, 4);
    if (four.length === 4) return four;
  }
  // (the level's own set the most, the one before it next: the newer, the more often)
  const weight = (r) => { const k = L.sets.length - 1 - L.sets.findIndex((s) => SETS[s].rules.includes(r)); return k === 0 ? 4 : k === 1 ? 2 : 1; };
  const draw = (from, n, out) => {
    const left = from.filter((r) => !out.includes(r));
    for (let k = 0; k < n && left.length; k++) {
      const tot = left.reduce((s, r) => s + weight(r), 0); let x = rand() * tot, i = 0;
      while (i < left.length - 1 && (x -= weight(left[i])) > 0) i++;
      out.push(left.splice(i, 1)[0]);
    }
    return out;
  };
  let best = null;
  for (let t = 0; t < 80; t++) {
    const own = SETS[L.own].rules, r0 = rand(), out = draw(own, r0 < 0.15 ? 1 : r0 < 0.85 ? 2 : 3, []);
    draw(L.rules, 4 - out.length, out);
    if (out.length < 4) continue;
    // (the goals in a random order round the court)
    for (let i = 3; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    const deal = dealable(out, L.pool), c = checkSet(out, deal, { per: 3 }), C = crowded(out, L.pool);
    const score = (c.ok ? 0 : 100) + (deal.length >= 12 ? 0 : 50) + (C.broad.length + C.alike.length) * 40 - Math.min(c.choice, 8) * 2 + rand();
    if (!best || score < best.score) best = { out, score };
    if (score < -10) break;
  }
  return best ? best.out : L.rules.slice(0, 4);
}
// (each level's idle court and example goals: drawn once, the same each time the page loads)
{ let s = 12345; const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; for (const L of LADDER) L.goals = startGoals(L, rand); }
export const ruleSay = (r) => ruleOf(r).say;
