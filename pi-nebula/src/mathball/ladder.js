// MATHBALL'S LADDER: the rule sets, easiest first. A round is played on one of them (the four goals' first rules, the
// balls that can come out of the ports, the rules a goal may change to as the light bar reaches it); a crew member
// climbs it as every job's ladder is climbed (Mathwood's levels: src/jobs/arena.js).
//
// The game's maker (2026-11-16): "It should start out easy and work up to harder questions. By easy I mean the goals can
// say even, odd, 'less than 5', 'more than 10' ... then easier multiples (2,3,5,10), then medium (4, 6, 9, 11), then
// harder (7,8,12). I like the question about squares also. Feel free to give me a way to sort the difficulty of
// questions if that helps."
//
// TO SORT THEM: the lab (pi-nebula/labs/mathball/) lists every rule set in ORDER with an example court; drag them into
// the order you want, press Copy the order, and paste the line it gives over the ORDER line below. A rule set left out
// of ORDER is left out of the game. (A crew member already on a rule set keeps it, wherever it moves to.)
//
// A RULE SET: name and line (what the levels show); strand and grade (where it sits on Mathwood's school guide: what a
// right ball counts toward, and its pay); goals (the four goals' rules at the start of a round: rules.js names them);
// pool (every ball that may come out: the game deals only those that fit at least one goal and never all four); spares
// (more rules a goal may change to as the light bar reaches it, besides the goals' own).
export const ORDER = ['oddeven', 'tables1', 'tables2', 'tables3', 'squares', 'primes'];

const upTo = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
export const SETS = {
  oddeven: {
    name: 'Odd and even, bigger and smaller', short: 'Odd and even', line: 'Even, odd, less than 5, more than 10: the numbers 1 to 20',
    strand: 'number', grade: 14, goals: ['even', 'odd', 'less:5', 'more:10'], pool: upTo(1, 20), spares: ['less:8', 'more:15', 'more:5', 'less:10'],
  },
  tables1: {
    name: 'Easy times tables: 2, 3, 5 and 10', short: 'Times 2, 3, 5, 10', line: 'Multiples of 2, 3, 5 and 10, up to 50',
    strand: 'mul', grade: 20, goals: ['mult:2', 'mult:3', 'mult:5', 'mult:10'], pool: upTo(2, 50), spares: ['odd', 'more:25', 'less:20', 'mult:4'],
  },
  tables2: {
    name: 'Times tables: 4, 6, 9 and 11', short: 'Times 4, 6, 9, 11', line: 'Multiples of 4, 6, 9 and 11, up to 99',
    strand: 'mul', grade: 32, goals: ['mult:4', 'mult:6', 'mult:9', 'mult:11'], pool: upTo(4, 99), spares: ['mult:3', 'mult:8', 'even', 'more:50'],
  },
  tables3: {
    name: 'Hard times tables: 7, 8 and 12', short: 'Times 7, 8, 12', line: 'Multiples of 7, 8 and 12 (and 9 to mix them up), up to 99',
    strand: 'mul', grade: 42, goals: ['mult:7', 'mult:8', 'mult:12', 'mult:9'], pool: upTo(7, 99), spares: ['mult:6', 'mult:4', 'more:50', 'odd'],
  },
  squares: {
    name: 'Factors, multiples and square numbers', short: 'Factors and squares', line: 'Factors of 24 and 36, multiples of 8, square numbers (the game\'s maker\'s own example)',
    strand: 'mul', grade: 50, goals: ['fact:24', 'mult:8', 'fact:36', 'square'], pool: [1, 2, 3, 4, 6, 8, 9, 12, 16, 18, 24, 25, 32, 36, 40, 48, 49, 56, 64, 72, 81],
    spares: ['mult:6', 'fact:30', 'mult:5', 'fact:48'],
  },
  primes: {
    name: 'Prime numbers and square numbers', short: 'Primes and squares', line: 'Primes, squares, odd numbers and more than 30, up to 100',
    strand: 'div', grade: 52, goals: ['prime', 'square', 'odd', 'more:30'], pool: [...upTo(1, 50), 53, 59, 61, 64, 67, 71, 73, 79, 81, 83, 89, 97, 100],
    spares: ['fact:60', 'mult:3', 'less:10', 'even'],
  },
};

// the ladder as the game plays it: the sets in ORDER (any set ORDER leaves out is left out), each with its key
export const LADDER = ORDER.filter((k) => SETS[k]).map((key) => ({ key, ...SETS[key] }));
