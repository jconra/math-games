// LONG MULTIPLICATION AND LONG DIVISION, worked a step at a time, the school way, on paper: the worked area that opens
// from a store order or a supply slip when its sum is too big to do in your head (16 × 7, 112 ÷ 5). The panel that
// draws it and asks each step is src/ui/longwork.js; this file is the math (pure, no page: tests/longwork.test.mjs).
//
// LONG DIVISION (112 ÷ 5), exactly as a teacher works it at the board:
//   the bracket is drawn with 5 outside and 112 inside. 5 doesn't go into 1, so start with 11:
//   "How many times does 5 go into 11?" (the place on top where the answer goes is marked), four answers to tap.
//   2: the 2 goes on top, 2 × 5 = 10 is written under the 11, 11 − 10 = 1, the next 2 is brought down: 12.
//   "How many times does 5 go into 12?" 2 again: 2 × 5 = 10, 12 − 10 = 2, nothing left to bring down, so 2 is the
//   remainder: 22 r 2. Then the word answer, from the story ("22 crates hold 110 cans; the last 2 need a crate too:
//   23 crates"). A zero in the answer (412 ÷ 4 = 103) is asked like any other digit ("How many times does 4 go into
//   1?" 0), the slip being the 0 left out (13).
// LONG MULTIPLICATION (16 × 7, 16 × 24), with carrying:
//   "7 × 6 = ?" 42: the 2 is written under the 6, the 4 carried (small, over the 1). "7 × 1, plus the 4 carried = ?"
//   11: written in front, 112. With a two-digit number underneath, a second row: a 0 holds the ones place (it's 2
//   TENS), then the 2 times each digit, and the rows are added ("64 + 320 = ?"); the classic slip, leaving the 0 out
//   (64 + 32 = 96), is one of the answers to tap.
// Every step: four answers in order, one right, the others the slips kids really make (one too many or too few times,
// the carry forgotten or added twice, added instead of multiplied, the zero left out), each with a one-line nudge. The
// right answer goes on the board with what follows from it said in one line.
//
// WHERE A SUM SITS ON THE STRANDS (the skill model, src/math/skill.js): pointOf(op, a, b) -> { strand, at }. A fact in
// the tables is the times tables' or dividing's own point (7 × 6 at 47 on Multiplication, 28 ÷ 7 at 37 on Division);
// anything bigger is the Long work strand's: longPoint(op, a, b), the map `long` below (36 21 × 3 · 40 84 ÷ 4 · 44
// 16 × 7 · 50 112 ÷ 5 r 2 · 54 112 × 5 · 58 16 × 24 · 64 412 ÷ 4 · 72 124 × 36 · 80 288 ÷ 12). needsLong(op, a, b):
// true when nobody should be asked it in their head (the worked area is offered).
//
//   workMul(a, b, { lead })   -> Work   (lead: { a, b, ask }: a first fact before the long sum, "One day first: 8 × 2";
//                                       a and b are then that fact's answer and the other number: workMul(16, 7, ...))
//   workDiv(n, d)             -> Work
//   Work = { op, a, b | n, d, answer (product, or { q, r }), point, line ('16 × 7 = 112'), steps: [Step], board,
//            first (the index of the first step the board shows from) }
//   Step = { kind: 'lead' | 'mul' | 'carry' | 'zero' | 'sum' | 'div' | 'add' | 'sub', ask, answer, choices: [{ v, label, good, why }],
//            intro (a line said as the step comes up, or ''), done (a line said once it's answered), fact: { strand, at }
//            (where this one tap sits, for the skill model), slot: { r, c, w } (where the answer goes on the board, or
//            null), focus: [[r, c]...] (the digits it uses) }
//   board = { rows, cols, cells: [{ r, c, ch, kind, from, off }], rules: [{ r, c0, c1, from, kind }] }
//            a cell shows while the step being asked is at least `from` (and is faded from `off` on); kind: 'given'
//            (the problem), 'divisor' (the number outside the bracket), 'kid' (an answer the kid tapped), 'work'
//            (written by the board), 'carry' (small), 'down' (a digit brought down), 'from' (where it came from: a mark,
//            no digit), 'sign'; a rule is a line under row r (kind 'bar'), or the division bracket
//            ('bracket': over row r from c0 to c1, with its curve left of c0)
//   workAdd(a, b), workSub(a, b) -> Work (or null)   the columns for adding and taking away (Work it out, any job):
//            Step kinds 'add' and 'sub'; the carrying and the borrowing are written by the board itself (kinds 'carry'
//            and 'borrow', the digit borrowed from faded), every column's sum is asked with 4 choices
//   DECIMALS (Work it out, 2026-10-26): workAdd / workSub / workMul / workDiv take decimals as written (2.6, 1.75) and
//            { money, cash } for dollars and cents, and work them the teacher's way: adding and taking away with the
//            points lined up (a 0 put on the end, kind 'pad', in its own colour) and the point brought straight down;
//            times as if there were no points, then a step (kind 'point') that counts the digits after the point and
//            asks where it goes in the answer (4 placings); dividing with the point gone straight up into the answer,
//            and by a decimal with both points moved first (kind 'move': "6 ÷ 0.5 is the same as?", 4 sums, wide).
//            The board's extra cells: 'point' (drawn at the corner of the digit in front of it; tone 'kid' in the
//            answer), 'unit' (the $), 'pad'. Work gains places, money, strand 'dec'; a step may have wide, note (the
//            sum as given, over the empty board), count (the point step's digits counted), slot.ring (the whole
//            answer row ringed, its digits in view).
//   sumFrom(text) -> { op: 'add' | 'sub' | 'mul' | 'div', a, b, money?, cash? } | null   the sum in a question's working
//            (decimals as decimals; see the reader below)
//   sumWords(sum) -> '2.6 × 6', '$1.30 + $5.75'   placesOf(x), dotted(n, places), shown(x, dollars)
//   factFrom(text) -> { a, b } | null   the times fact in a question's working (both up to 12), for the times chart
//   workOf(sum) -> Work for any of the four (decimals and money too)
//   LADDER, makeLong(step, { rand, op }) -> { op, a, b } | { op, n, d }   a sum at a step of the `long` map (op: the
//            nearest step of that kind at or below)
//   mulAt, divAt, addAt, subAt, longPoint, pointOf, needsLong, noCarry, digitsOf, seeded
//
// The panel moves through the steps; the job that opened it records each tap (its fact, at a light weight) and the
// whole worked sum (the Long work strand, at its point) through save.js.

// ---- the dials (defaults; change them here) --------------------------------------------------------------------
export const LONG = {
  COMFORT: 12,   // a rider whose Long work level is this far past a sum's point gets the coins first, the worked area
                 // offered with a button (below that, it opens by itself)
  CHOICES: 4,    // answers to tap at each step
};

// ---- small helpers ---------------------------------------------------------------------------------------------
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const tools = (rand) => ({
  int: (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)),
  pick: (a) => a[Math.floor(rand() * a.length)],
  chance: (p) => rand() < p,
});
// the digits of a whole number, the biggest place first: 412 -> [4, 1, 2]
export const digitsOf = (n) => String(Math.abs(Math.round(n))).split('').map(Number);
const len = (n) => String(Math.abs(Math.round(n))).length;
const MINUS = '−', TIMES = '×', DIV = '÷';
const isPow10 = (n) => n === 10 || n === 100 || n === 1000;

// ---- where a sum sits on the strands ---------------------------------------------------------------------------
// The times tables (src/math/strands.js MAPS.times): the point where a table is learnt up to ×5, ×10 and ×12, as
// [the tables, to ×5, to ×10, to ×12]. A fact counts at the easier of its two ways round (7 × 2 is in the 2s).
const TABLES = [
  [[0, 1], 10, 10, 10],
  [[2, 5, 10], 15, 19, 24],
  [[3, 4], 24, 28, 34],
  [[9, 11], 31, 32, 36],
  [[6, 8], 37, 41, 48],
  [[7, 12], 44, 47, 50],
];
function tableAt(table, by) {
  const row = TABLES.find((r) => r[0].includes(table));
  if (!row) return 50;
  return by <= 5 ? row[1] : by <= 10 ? row[2] : row[3];
}
// a times-table fact (both numbers 0..12) on the Multiplication strand
export function mulAt(a, b) { return Math.min(tableAt(a, b), tableAt(b, a)); }
// a division in the tables on the Division strand (src/math/dividing.js): by the divisor, then a remainder makes it
// a remainder question (45; 50 once the answer passes 10)
const DIV_AT = { 1: 16, 2: 25, 5: 25, 10: 25, 3: 29, 4: 29, 6: 33, 9: 33, 11: 33, 7: 37, 8: 37, 12: 37 };
export function divAt(n, d) {
  let at = DIV_AT[d] || 37;
  if (n % d) at = Math.max(at, Math.floor(n / d) >= 10 ? 50 : 45);
  return at;
}
// adding (src/math/adding.js): +1 or 2, to 10, making 10, past 10, tens and ones, carrying, two-digit, then bigger
export function addAt(a, b) {
  const s = a + b, lo = Math.min(a, b);
  if (s <= 10) return lo <= 2 ? 0 : s === 10 ? 9 : 5;
  if (s <= 20 && Math.max(a, b) < 10) return 15;
  if (s <= 20) return 12;
  const carry = (a % 10) + (b % 10) >= 10;
  if (s < 100) return lo < 10 ? (carry ? 24 : 19) : 30;
  return carry ? 36 : 34;   // (three-digit sums: between two-digit sums and the negatives, where the strand has room)
}
// taking away (src/math/taking.js): the same kind of ladder
export function subAt(a, b) {
  if (a <= 10) return b <= 2 ? 0 : a === 10 ? 9 : 5;
  const borrow = (a % 10) < (b % 10);
  if (a <= 20) return borrow ? 19 : 15;
  if (a < 100) return b < 10 ? (borrow ? 24 : 19) : 30;
  return borrow ? 36 : 34;
}
// is it a long sum: too big for the tables (and not just times or divided by 10)?
export function needsLong(op, a, b) {
  if (op === 'mul') return !(isPow10(a) || isPow10(b) || (a <= 12 && b <= 12) || a === 0 || b === 0 || a === 1 || b === 1);
  if (op === 'div') {
    const q = Math.floor(a / b);
    if (isPow10(b) || b === 1 || (b <= 12 && q <= 12)) return false;
    // by 20, 25, 50 ... when it goes in fewer than 10 times: counting up in 20s or 25s, not long division
    return !(q <= 9 && (b % 10 === 0 || b % 25 === 0));
  }
  return false;
}
// a long sum's point on the Long work strand (the map `long` below)
export function longPoint(op, a, b) {
  if (op === 'mul') {
    const [top, bot] = len(a) >= len(b) ? [a, b] : [b, a];
    const lt = len(top), lb = len(bot);
    // (school years as the strands' guide has them: two-digit by one-digit in grade 4, two-digit by two-digit late in
    // grade 4, bigger ones and dividing by a two-digit number in grade 5, by a three-digit one in grade 6)
    if (lb === 1) {
      if (lt === 2) return hasCarry(top, bot) ? 42 : 36;
      if (lt === 3) return 47;
      return 50;
    }
    if (lb === 2) return lt === 2 ? 49 : lt === 3 ? 54 : 56;
    return 58;
  }
  if (op === 'div') {
    if (len(b) >= 3) return 60;
    if (len(b) === 2) return 58;
    const q = Math.floor(a / b), qd = digitsOf(q);
    if (qd.slice(1).includes(0)) return 51;
    return a % b ? 45 : 40;
  }
  return 0;
}
// a carry anywhere in multiplying by one digit (16 × 7: 6 × 7 = 42 carries the 4)
function hasCarry(top, digit) {
  const d = digitsOf(top).reverse();
  let carry = 0;
  for (let i = 0; i < d.length - 1; i++) { const p = d[i] * digit + carry; carry = Math.floor(p / 10); if (carry) return true; }
  return false;
}
// where any sum sits: the times tables' or dividing's own point when it's in the tables, else the Long work strand
export function pointOf(op, a, b) {
  if (op === 'mul') return needsLong('mul', a, b) ? { strand: 'long', at: longPoint('mul', a, b) } : { strand: 'mul', at: a <= 12 && b <= 12 ? mulAt(a, b) : 20 };
  if (op === 'div') return needsLong('div', a, b) ? { strand: 'long', at: longPoint('div', a, b) } : { strand: 'div', at: isPow10(b) ? 30 : divAt(a, b) };
  if (op === 'add') return { strand: 'add', at: addAt(a, b) };
  if (op === 'sub') return { strand: 'sub', at: subAt(a, b) };
  return null;
}
// a product worked with every carry forgotten (16 × 7 -> 72), row by row, the rows added properly
export function noCarry(a, b) {
  const top = digitsOf(a).reverse();
  let total = 0;
  digitsOf(b).reverse().forEach((bj, j) => {
    let row = 0;
    top.forEach((ai, i) => { const p = ai * bj; row += (i === top.length - 1 ? p : p % 10) * 10 ** i; });
    total += row * 10 ** j;
  });
  return total;
}

// ---- the choices for a step ------------------------------------------------------------------------------------
// the right answer and the slips (in order, the likeliest first), as 4 choices in number order, each wrong one with
// its nudge. Slips that repeat, equal the answer or fall outside lo..hi are skipped; near numbers fill any gap.
function choicesOf(answer, slips, { lo = 0, hi = Infinity, near = (v) => `Not ${v}. Look again.` } = {}) {
  const used = new Set([answer]), out = [{ v: answer, label: String(answer), good: true, why: '' }];
  for (const s of slips) {
    if (out.length >= LONG.CHOICES) break;
    if (!Number.isInteger(s.v) || s.v < lo || s.v > hi || used.has(s.v)) continue;
    used.add(s.v); out.push({ v: s.v, label: String(s.v), good: false, why: s.why, slip: s.slip || null });
  }
  for (let k = 1; out.length < LONG.CHOICES && k < 40; k++) {
    for (const v of [answer + k, answer - k]) {
      if (out.length >= LONG.CHOICES || v < lo || v > hi || used.has(v)) continue;
      used.add(v); out.push({ v, label: String(v), good: false, why: near(v), slip: 'near' });
    }
  }
  return out.sort((x, y) => x.v - y.v);
}
// b × a (+ the carry): the multiplying slips
function mulChoices(b, a, carry) {
  const right = b * a + carry, plus = carry ? ` + ${carry}` : '';
  const slips = [];
  if (carry) slips.push({ v: b * a, slip: 'carryLost', why: `${b} × ${a} = ${b * a}. Don't forget the ${carry} you carried: ${b * a} + ${carry}.` });
  if (carry) slips.push({ v: b * a + 2 * carry, slip: 'carryTwice', why: `That adds the ${carry} twice. Times first, then add the ${carry} carried just once.` });
  if (a > 1 && b > 1) slips.push({ v: b + a + carry, slip: 'added', why: `That adds ${b} and ${a}. ${b} × ${a} is ${a} groups of ${b}${carry ? `, then the ${carry} carried` : ''}.` });
  slips.push({ v: b * (a + 1) + carry, slip: 'groupOff', why: `That's ${b} × ${a + 1}${plus}. The digit is ${a}.` });
  if (a > 0) slips.push({ v: b * (a - 1) + carry, slip: 'groupOff', why: `That's ${b} × ${a - 1}${plus}. The digit is ${a}.` });
  if (a === 0) slips.push({ v: b + carry, slip: 'zero', why: `0 × ${b} is 0: nothing at all.${carry ? ` Just the ${carry} carried is left.` : ''}` });
  slips.push({ v: right + 10, slip: 'tens', why: `Not quite: ${b} × ${a} is ${a} group${a === 1 ? '' : 's'} of ${b}${carry ? `, then add the ${carry} carried` : ''}.` });
  return choicesOf(right, slips, { near: (v) => `${v} isn't ${b} × ${a}${plus}. Count up in ${b}s, ${a} time${a === 1 ? '' : 's'}${carry ? `, then add the ${carry}` : ''}.` });
}
// how many times does d go into cur (one digit, 0..9)
function divChoices(cur, d) {
  const q = Math.floor(cur / d);
  const over = (v) => `${v} × ${d} = ${v * d}: that's more than ${cur}. Try a smaller number.`;
  const under = (v) => `${v} × ${d} = ${v * d}, and ${cur} ${MINUS} ${v * d} = ${cur - v * d}: still ${d} or more, so ${d} fits in more times.`;
  const slips = [];
  if (q === 0) slips.push({ v: 1, slip: 'zeroSkipped', why: `1 × ${d} = ${d}: more than ${cur}. ${d} doesn't go into ${cur} at all, so 0 goes on top.` });
  slips.push({ v: q + 1, slip: 'over', why: over(q + 1) }, { v: q - 1, slip: 'under', why: under(q - 1) });
  slips.push({ v: q + 2, slip: 'over', why: over(q + 2) }, { v: q - 2, slip: 'under', why: under(q - 2) });
  return choicesOf(q, slips, { lo: 0, hi: 9, near: (v) => (v > q ? over(v) : under(v)) });
}
// adding the rows of a long multiplication
function sumChoices(rows, plain) {
  const s = rows.reduce((a, b) => a + b, 0);
  const slips = [];
  // the 0 left out: the second row not moved over a place
  if (plain !== s) slips.push({ v: plain, slip: 'noZero', why: `That adds the rows without the 0 that holds the ones place. The second row is tens: ${rows[1]}.` });
  // a carry dropped in the adding
  const dropped = addNoCarry(rows);
  if (dropped !== s) slips.push({ v: dropped, slip: 'carryLost', why: 'A column passed 9 there: carry the 1 into the next column.' });
  slips.push({ v: s + 10, slip: 'tens', why: 'Add the ones, then the tens, carrying when a column passes 9.' });
  slips.push({ v: s - 10, slip: 'tens', why: 'Add the ones, then the tens, carrying when a column passes 9.' });
  slips.push({ v: s + 100, slip: 'tens', why: 'Check the hundreds column again.' });
  return choicesOf(s, slips, { lo: 1, near: () => 'Add the ones, then the tens, then the hundreds, carrying when a column passes 9.' });
}
function addNoCarry(rows) {
  const w = Math.max(...rows.map(len));
  let out = 0;
  for (let p = 0; p < w; p++) out += (rows.reduce((a, r) => a + (Math.floor(r / 10 ** p) % 10), 0) % 10) * 10 ** p;
  return out;
}

// ---- decimals: the same columns, the points put back the way a teacher does it -----------------------------------
// places after the point in a number as written: 2.6 -> 1, 1.75 -> 2, 3 -> 0
export function placesOf(x) {
  if (!Number.isFinite(x) || Number.isInteger(x)) return 0;
  const s = String(Math.abs(x)), i = s.indexOf('.');
  return i < 0 ? 0 : Math.min(6, s.length - i - 1);
}
// a number as a whole number of its last place: scale(2.6, 1) -> 26
const scale = (x, p) => Math.round(x * 10 ** p);
// a whole number of the smallest place written with its point: dotted(156, 1) -> '15.6', dotted(6, 2) -> '0.06'
export function dotted(n, p) {
  if (!p) return String(n);
  const s = String(n).padStart(p + 1, '0');
  return `${s.slice(0, -p)}.${s.slice(-p)}`;
}
// the digits of a whole number with 0s in front up to m of them (a decimal keeps a digit before its point: 045 for 0.45)
const digitsTo = (n, m) => String(Math.abs(Math.round(n))).padStart(m, '0').split('').map(Number);
const PLACE = ['ones', 'tenths', 'hundredths', 'thousandths'];
const many = (n, one, lots = `${one}s`) => `${n} ${n === 1 ? one : lots}`;
// a number in a sum as the kid sees it written: 2.6, 6, $5.70 (dollars always with their cents)
export function shown(x, dollars = false) { return dollars ? `$${x.toFixed(2)}` : String(x); }
// a sum written out: "2.6 × 6", "$1.30 + $5.75" (sum: { op, a, b, money, cash }: cash says which numbers are dollars,
// 'a', 'b' or 'ab'; for adding and taking away, both are)
export function sumWords(sum) {
  if (!sum) return '';
  const SIGN = { add: '+', sub: MINUS, mul: TIMES, div: DIV }, [ca, cb] = cashOf(sum);
  return `${shown(sum.a ?? sum.n, ca)} ${SIGN[sum.op] || '?'} ${shown(sum.b ?? sum.d, cb)}`;
}
function cashOf({ op, a, b, n, d, money = false, cash = '' }) {
  if (!money) return [false, false];
  if (op === 'add' || op === 'sub') return [true, true];
  const x = a ?? n, y = b ?? d;
  if (!cash) return op === 'div' ? [true, false] : [!Number.isInteger(x) || Number.isInteger(y), !Number.isInteger(y) && Number.isInteger(x)];
  return [cash.includes('a'), cash.includes('b')];
}
// adding and taking away: both numbers in the same place (P places after the point; money: 2, the cents), each as a
// whole number of that place, and the 0s put on the end to line the points up (5.7 over 1.43: 5.70)
function lineUp(a, b, money) {
  const pa = placesOf(a), pb = placesOf(b), P = money ? 2 : Math.max(pa, pb);
  const pad = (p) => (money ? (p ? 0 : 2) : P - p);   // (a whole dollar is written $5.00: two 0s put on)
  return { P, A: scale(a, P), B: scale(b, P), padA: pad(pa), padB: pad(pb) };
}
// the board's extras for a decimal: the point (drawn at the corner of the digit in front of it), the $, the 0s put on
function marks(B, P, money) {
  return {
    point: (r, col, from, tone = null, off = null) => { if (P) B.put(r, col, '.', 'point', from, off, tone); },
    cash: (r, col, from, tone = null) => { if (money) B.put(r, col, '$', 'unit', from, null, tone); },
    pads: (r, right, k) => { for (const c of B.cells) if (c.r === r && c.c > right - k && c.c <= right && c.kind === 'given') c.kind = 'pad'; },
  };
}
// the line said first in a decimal's columns: the points lined up, the 0s put on
function lineUpLine(P, items) {
  const pads = items.filter((x) => x.pad && x.str);
  let t = 'Line up the points, one under the other.';
  for (const x of pads) t += ` ${x.str} has no ${PLACE[P] || 'last place'}: ${x.pad === 1 ? 'a 0 holds the place' : '0s hold the places'}, ${x.padded}.`;
  return `${t} Then the ${PLACE[P] || 'right-hand'} column first, as with whole numbers.`;
}

// ---- the board ---------------------------------------------------------------------------------------------------
function board(rows, cols) {
  const B = { rows, cols, cells: [], rules: [] };
  B.put = (r, c, ch, kind, from, off = null, tone = null) => { const x = { r, c, ch: String(ch), kind, from, off }; if (tone) x.tone = tone; B.cells.push(x); };
  B.num = (r, right, n, kind, from) => { const d = String(n); for (let k = 0; k < d.length; k++) B.put(r, right - d.length + 1 + k, d[k], kind, from); };
  B.rule = (r, c0, c1, from, kind = 'bar') => { B.rules.push({ r, c0, c1, from, kind }); };
  return B;
}
const done = (B) => { delete B.put; delete B.num; delete B.rule; return B; };

// ---- long multiplication -------------------------------------------------------------------------------------------
// The longer number on top (the school way); the same length: as given (16 × 14, the 16 on top).
// Decimals (Work it out, 2.6 × 6): multiplied as if there were no points (26 × 6 = 156, the columns as ever), then one
// more step puts the point back: the digits after the point in the two numbers are counted (1 in 2.6, none in 6) and
// "Where does the point go in 156?" has 4 answers (0.156, 1.56, 15.6, 156). Money: the dollars' cents count (6 pounds at
// $0.80: 80 × 6 = 480, two places, $4.80). money: dollars and cents; cash: which of x and y are dollars ('a', 'b').
export function workMul(x, y, { lead = null, money = false, cash = '' } = {}) {
  const [ca, cb] = cashOf({ op: 'mul', a: x, b: y, money, cash });
  const px = ca ? 2 : placesOf(x), py = cb ? 2 : placesOf(y);
  const X = scale(x, px), Y = scale(y, py);
  const [top, bot, pt, pb, $t, $b] = len(X) >= len(Y) ? [X, Y, px, py, +ca, +cb] : [Y, X, py, px, +cb, +ca];
  const P = pt + pb, $p = money ? 1 : 0;   // (the answer's places after the point; its $)
  const A = digitsOf(top).reverse(), Bd = digitsOf(bot).reverse();   // (ones first)
  const product = top * bot;
  const rowsVal = Bd.map((bj, j) => top * bj * 10 ** j);
  const multi = Bd.length > 1;
  // (each number's width on the board: a decimal keeps its 0 in front of the point, 0.4; the $ in front)
  const wt = pt ? Math.max(len(top), pt + 1) : len(top), wb = pb ? Math.max(len(bot), pb + 1) : len(bot), wp = P ? Math.max(len(product), P + 1) : len(product);
  const W = Math.max(wp + $p, wt + $t, wb + $b + 1) + 1;   // (+1: room for the × sign)
  const nCarry = A.length > 1 ? 1 : 0;   // (one row of carries over the top number: a row's carries go when the next row starts)
  const rA = nCarry, rB = rA + 1, rP = rB + 1, rS = rP + Bd.length;
  const B = board(multi ? rS + 1 : rP + 1, W);
  const col = (place) => W - 1 - place;
  const steps = [];
  if (lead) {
    const right = lead.a * lead.b;
    steps.push({ kind: 'lead', ask: `${lead.ask ? lead.ask + ': ' : ''}${lead.a} ${TIMES} ${lead.b} = ?`, answer: right, choices: mulChoices(lead.a, lead.b, 0), intro: '',
      done: `${lead.a} ${TIMES} ${lead.b} = ${right}. Now ${top} ${TIMES} ${bot}.`, fact: pointOf('mul', lead.a, lead.b), slot: null, focus: [] });
  }
  const first = steps.length;
  // the problem: the top number, × and the bottom one, the bar under them
  B.num(rA, col(0), digitsTo(top, wt).join(''), 'given', first);
  B.num(rB, col(0), digitsTo(bot, wb).join(''), 'given', first);
  if (pt) B.put(rA, col(pt), '.', 'point', first);
  if (pb) B.put(rB, col(pb), '.', 'point', first);
  if ($t) B.put(rA, col(wt), '$', 'unit', first);
  if ($b) B.put(rB, col(wb), '$', 'unit', first);
  B.put(rB, col(Math.max(wt + $t, wb + $b)), TIMES, 'sign', first);
  B.rule(rB, col(Math.max(wp + $p, wt + $t, wb + $b) - 1), col(0), first);
  Bd.forEach((bj, j) => {
    const r = rP + j, carryRow = rA - 1;
    const rowStart = steps.length;
    if (j > 0) for (let p = 0; p < j; p++) B.put(r, col(p), 0, 'work', rowStart);   // (the 0s that hold the places)
    const intro = j > 0 ? `Now the ${bj} in the ${['ones', 'tens', 'hundreds'][j]} place: it's really ${bj * 10 ** j}, so ${j === 1 ? 'a 0 holds the ones place' : `0s hold the ${j} places on the right`} first.` : '';
    if (bj === 0) {
      // a 0 in the bottom number: its whole row is 0s, written straight down
      for (let p = j; p < j + A.length; p++) B.put(r, col(p), 0, 'work', rowStart);
      if (steps.length) steps[steps.length - 1].done += ` The next digit is 0, and 0 times anything is 0: that row is all 0s.`;
      return;
    }
    let carry = 0;
    A.forEach((ai, i) => {
      const prod = bj * ai + carry, last = i === A.length - 1, s = steps.length;
      const focus = [[rA, col(i)], [rB, col(j)]];
      if (carry && carryRow >= 0) focus.push([carryRow, col(i)]);
      const write = last ? prod : prod % 10, w = last ? len(prod) : 1;
      const slot = { r, c: col(i + j) - (w - 1), w };
      let doneLine;
      if (last) doneLine = `Write ${prod}${len(prod) > 1 ? ' (the last digit: all of it goes down)' : ''}. ${multi ? `That row is ${top} ${TIMES} ${bj * 10 ** j} = ${rowsVal[j]}.` : `${top} ${TIMES} ${bot} = ${product}.`}`;
      else if (prod >= 10) doneLine = `Write the ${prod % 10}, carry the ${Math.floor(prod / 10)}.`;
      else doneLine = `Write the ${prod}.`;
      steps.push({
        kind: carry ? 'carry' : ai === 0 ? 'zero' : 'mul',
        ask: carry ? `${bj} ${TIMES} ${ai}, plus the ${carry} carried = ?` : `${bj} ${TIMES} ${ai} = ?`,
        answer: prod, choices: mulChoices(bj, ai, carry), intro: i === 0 ? intro : '', done: doneLine,
        fact: { strand: 'mul', at: mulAt(bj, ai) }, slot, focus,
      });
      B.num(r, col(i + j), write, 'kid', s + 1);
      carry = last ? 0 : Math.floor(prod / 10);
      if (carry && carryRow >= 0) {
        B.put(carryRow, col(i + 1), carry, 'carry', s + 1);
        // (the carries fade once their row is done)
        const c = B.cells[B.cells.length - 1]; c.endRow = j;
      }
    });
  });
  if (multi) {
    const s = steps.length;
    const plain = Bd.reduce((a, bj) => a + top * bj, 0);
    B.rule(rS - 1, col(len(product) - 1), col(0), s);
    steps.push({ kind: 'sum', ask: `Add the rows: ${rowsVal.filter((v, j) => Bd[j] !== 0 || j === 0).join(' + ')} = ?`, answer: product,
      choices: sumChoices(rowsVal, plain), intro: 'Now add the rows, the ones column first.', done: `${top} ${TIMES} ${bot} = ${product}.`,
      fact: pointOf('add', rowsVal[0], rowsVal.slice(1).reduce((a, b) => a + b, 0)), slot: { r: rS, c: col(len(product) - 1), w: len(product) }, focus: Bd.map((_, j) => [rP + j, col(0)]) });
    B.num(rS, col(0), product, 'kid', s + 1);
  }
  // the carries of a row fade when the next row starts (they belong to that row only)
  const rowFirst = []; let k = first;
  Bd.forEach((bj, j) => { rowFirst[j] = k; if (bj !== 0) k += A.length; });
  for (const c of B.cells) if (c.endRow != null) { const nx = rowFirst[c.endRow + 1]; if (nx != null) c.off = nx; delete c.endRow; }
  // (the multiplying steps a 0 row skipped: re-point the rows' starts so the 0s show as their row comes up)
  if (!P) return { op: 'mul', a: top, b: bot, answer: product, point: longPoint('mul', top, bot), line: `${top} ${TIMES} ${bot} = ${product}`, steps, board: done(B), first };
  // THE POINT PUT BACK: count the digits after the point in the two numbers, and place it in the answer
  const sayT = shown(top / 10 ** pt, !!$t), sayB = shown(bot / 10 ** pb, !!$b), rowP = multi ? rS : rP;
  steps[first].intro = `Multiply as if there were no points: ${top} ${TIMES} ${bot}. The point goes back in at the end.${steps[first].intro ? ' ' + steps[first].intro : ''}`;
  const s = steps.length, value = product / 10 ** P, say = (k) => (money ? `$${(product / 10 ** k).toFixed(2)}` : dotted(product, k));
  const count = `${pt || 'none'} in ${sayT} and ${pb || 'none'} in ${sayB}`;
  const rx = Math.round(top / 10 ** pt), ry = Math.round(bot / 10 ** pb);
  const about = rx >= 1 && ry >= 1 && rx * ry !== value ? ` About ${rx} ${TIMES} ${ry} = ${rx * ry}, so the answer is near ${rx * ry}.` : '';
  const choices = [];
  for (const k of [P, P - 1, P + 1, 0, P + 2, P - 2, P + 3]) {
    if (choices.length >= LONG.CHOICES || k < 0 || choices.some((c) => c.k === k)) continue;
    if (money && k > 2 && product % 10 ** (k - 2)) continue;   // (money in whole cents only)
    const label = say(k), v = product / 10 ** k;
    if (choices.some((c) => c.label === label || c.v === v)) continue;
    const why = k === P ? '' : k === 0 ? `${label} leaves the point out. Count the digits after the point: ${count}, so ${P} in the answer.${about}`
      : k < P ? `${label} has ${many(k, 'digit')} after the point. Count them in the numbers: ${count}, so ${P}.${about}`
      : `${label} has ${many(k, 'digit')} after the point: too many. Count them in the numbers: ${count}, so ${P}.${about}`;
    choices.push({ k, v, label, good: k === P, why, slip: k === P ? null : k === 0 ? 'pointLost' : k < P ? 'tooFew' : 'tooMany' });
  }
  choices.sort((a2, b2) => a2.v - b2.v).forEach((c) => delete c.k);
  const focus = [];
  for (let p = 0; p < pt; p++) focus.push([rA, col(p)]);
  for (let p = 0; p < pb; p++) focus.push([rB, col(p)]);
  const trail = !money && product % 10 === 0 ? ` (the same as ${String(value)})` : '';
  steps.push({ kind: 'point', ask: `Where does the point go in ${product}?`, answer: value, choices,
    intro: `Now the point. Count the digits after the point: ${count}. That's ${many(P, 'digit')} after the point in the answer.`,
    done: `${say(P)}: ${many(P, 'digit')} after the point${trail}. ${sayT} ${TIMES} ${sayB} = ${say(P)}.`,
    fact: { strand: 'dec', at: 60 }, slot: { r: rowP, c: col(wp - 1 + $p), w: wp + $p, ring: true }, focus,
    count: [{ n: sayT, places: pt }, { n: sayB, places: pb }] });
  // (once it's picked: the 0s in front if the answer needs them, 0.06; the point; the $)
  for (let p = len(product); p < wp; p++) B.put(rowP, col(p), 0, 'work', s + 1);
  B.put(rowP, col(P), '.', 'point', s + 1, null, 'kid');
  if ($p) B.put(rowP, col(wp), '$', 'unit', s + 1, null, 'kid');
  return { op: 'mul', a: top / 10 ** pt, b: bot / 10 ** pb, answer: value, places: P, money, strand: 'dec', point: 60,
    line: `${sayT} ${TIMES} ${sayB} = ${say(P)}`, steps, board: done(B), first };
}

// ---- long division ---------------------------------------------------------------------------------------------------
// Decimals (Work it out): a decimal divided by a whole number (7.5 ÷ 3) is long division as ever, with the point gone
// straight up into the answer first, right above its place (2.5); money the same ($2.20 ÷ 4 = $0.55, a 0 written in front
// of the point when the divisor doesn't go into the dollars). A 0 is put on the end while it doesn't come out even
// (7.8 ÷ 4: 7.80, up to the cents or three places). Dividing BY a decimal (6 ÷ 0.5) first makes it a whole number: both
// points move the same number of places, a step of its own with 4 sums to pick ("6 ÷ 0.5 is the same as?" 60 ÷ 5), then
// the board shows 60 ÷ 5 and it's divided as usual. money: dollars and cents; cash: which of n and d are dollars.
export function workDiv(n, d, { money = false, cash = '' } = {}) {
  const [ca, cb] = cashOf({ op: 'div', a: n, b: d, money, cash });
  const pn = ca ? 2 : placesOf(n), pd = cb ? 2 : placesOf(d);
  const decimal = pn > 0 || pd > 0;
  // the divisor as a whole number: both points move pd places (the 0s that takes put on the end of n)
  const dI = scale(d, pd);
  let nI = scale(n, pn), p2 = pn - pd, put = 0;
  if (p2 < 0) { nI *= 10 ** -p2; put = -p2; p2 = 0; }
  const moved = { n: nI, p: p2 };   // (the sum after the move, before any 0s for coming out even)
  if (decimal) while (nI % dI && p2 < (ca && !cb ? 2 : 3)) { nI *= 10; p2++; put++; }
  const $ = ca && !cb ? 1 : 0;   // (the dollars shared out: the $ inside the bracket and on the answer)
  const D = digitsTo(nI, p2 ? p2 + 1 : 0), L = D.length, q = Math.floor(nI / dI), r = nI % dI;
  const ones = L - 1 - p2;   // (the digit in front of the point)
  // the first chunk: digits until the divisor fits (5 doesn't go into 1: start with 11)
  let i0 = 0, cur = D[0];
  while (cur < dI && i0 < L - 1) { i0++; cur = cur * 10 + D[i0]; }
  const nSteps = L - i0;
  const X0 = len(dI) + 1 + $;
  const W = X0 + L + (r ? 2 + len(r) : 0);
  const B = board(2 + 2 * nSteps, W);
  const steps = [];
  const sayN = shown(n, ca), sayD = shown(d, cb), sayQ = (ca && !cb ? '$' : '') + dotted(q, p2), shownQ = r ? `${sayQ} r ${r}` : sayQ;
  if (pd) {
    // THE MOVE: "6 ÷ 0.5 is the same as?" (both points pd places right: 60 ÷ 5)
    const f = 10 ** pd, w = (x, p) => dotted(x, p), right = `${w(moved.n, moved.p)} ${DIV} ${dI}`;
    const nScaled = (k) => { const v = Math.round(n * 10 ** pn) * 10 ** Math.max(0, k - pn); return w(v, Math.max(0, pn - k)); };
    const opts = [
      { label: right, good: true, why: '' },
      { label: `${sayN.replace('$', '')} ${DIV} ${dI}`, slip: 'oneOnly', why: `That moves only the point in ${sayD}. Move the point in ${sayN} the same ${many(pd, 'place')}: ${w(moved.n, moved.p)}.` },
      { label: `${nScaled(pd + 1)} ${DIV} ${dI}`, slip: 'tooFar', why: `That moves the point in ${sayN} ${many(pd + 1, 'place')}. Both move ${pd}, the same as in ${sayD}.` },
      { label: `${dotted(Math.round(n * 10 ** pn), pn + pd)} ${DIV} ${dI}`, slip: 'wrongWay', why: `That moves the point in ${sayN} the wrong way. Both points move to the right: ${sayN} becomes ${w(moved.n, moved.p)}.` },
      { label: `${w(moved.n, moved.p)} ${DIV} ${dI * 10}`, slip: 'divisorFar', why: `${sayD} moved one place too far. It has ${many(pd, 'digit')} after the point: ${dI}.` },
    ];
    const seen = new Set(), choices = [];
    for (const c of opts) { if (choices.length < LONG.CHOICES && !seen.has(c.label)) { seen.add(c.label); choices.push(c); } }
    steps.push({ kind: 'move', ask: `${sayN} ${DIV} ${sayD} is the same as?`, answer: right, wide: true, note: `${sayN} ${DIV} ${sayD}`,
      choices: shuffleFixed(choices).map((c) => ({ v: c.label, ...c })),
      intro: `Dividing by a decimal: make ${sayD} a whole number first. It has ${many(pd, 'digit')} after the point, so both points move ${many(pd, 'place')} to the right.`,
      done: `${right}: ${sayD} became ${dI} and ${sayN} became ${w(moved.n, moved.p)}, both ${f} times bigger, so the answer is the same. Now divide.`,
      fact: { strand: 'dec', at: 66 }, slot: null, focus: [] });
  }
  const first = steps.length;
  B.num(1, len(dI) - 1, dI, 'divisor', first);
  B.num(1, X0 + L - 1, D.join(''), 'given', first);
  if (put) for (const c of B.cells) if (c.r === 1 && c.c > X0 + L - 1 - put && c.kind === 'given') c.kind = 'pad';   // (the 0s put on: their own colour)
  if ($) B.put(1, X0 - 1, '$', 'unit', first);
  B.rule(1, X0 - $, X0 + L - 1, first, 'bracket');
  if (p2) {   // the point, and straight up into the answer above it
    B.put(1, X0 + ones, '.', 'point', first);
    B.put(0, X0 + ones, '.', 'point', first, null, 'kid');
    // (no digit in front of the point yet: a 0 goes on top there, and after it until the first digit, 0.25, 0.05)
    for (let i = ones; i < i0; i++) B.put(0, X0 + i, 0, 'work', first);
  }
  let row = 1, qText = '';
  for (let k = 0; k < nSteps; k++) {
    const i = i0 + k, qi = Math.floor(cur / dI), p = qi * dI, diff = cur - p, s = steps.length;
    const curCells = [];
    for (let c = X0 + i - len(cur) + 1; c <= X0 + i; c++) curCells.push([row, c]);
    const focus = [...curCells, ...Array.from({ length: len(dI) }, (_, c) => [1, c])];
    let intro = '';
    if (k === 0 && i0 > 0) {
      // (the digits skipped, as written: past the point, 0s go on top for them, "3 doesn't go into 0.0")
      const part = D.slice(0, i0).map((x, j) => (p2 && j === ones && j < i0 - 1 ? `${x}.` : String(x))).join('');
      intro = p2 && i0 > ones ? `${dI} doesn't go into ${part}: ${i0 - ones === 1 ? 'a 0 goes' : '0s go'} on top. Start with ${cur}.` : `${dI} doesn't go into ${part}, so start with ${cur}.`;
    }
    if (k === 0 && p2) intro = `The point goes straight up into the answer, right above the point in ${$ ? '$' : ''}${dotted(nI, p2)}.${put && !pd ? ` (${sayN} is the same as ${dotted(nI, p2)}: ${put === 1 ? 'a 0 on the end' : '0s on the end'} so it comes out even.)` : ''}${intro ? ' ' + intro : ''}`;
    const next = i < L - 1 ? D[i + 1] : null, newCur = next == null ? null : diff * 10 + next;
    let doneLine = `${qi} goes on top. ${qi} ${TIMES} ${dI} = ${p}, under the ${cur}. ${cur} ${MINUS} ${p} = ${diff}.`;
    if (next != null) doneLine += ` Bring down the ${next}: ${newCur}.`;
    else doneLine += diff ? ` Nothing left to bring down, so ${diff} is the remainder: ${shownQ}.` : ` Nothing left over: ${sayN} ${DIV} ${sayD} = ${sayQ}.`;
    steps.push({ kind: 'div', ask: `How many times does ${dI} go into ${cur}?`, answer: qi, choices: divChoices(cur, dI), intro, done: doneLine,
      fact: { strand: 'div', at: dI <= 12 ? divAt(cur, dI) : 52 }, slot: { r: 0, c: X0 + i, w: 1 }, focus });
    // what the board writes once it's answered
    B.put(0, X0 + i, qi, 'kid', s + 1);
    B.num(row + 1, X0 + i, p, 'work', s + 1);
    B.rule(row + 1, X0 + i - Math.max(len(p), len(cur)) + 1, X0 + i, s + 1);
    B.num(row + 2, X0 + i, diff, 'work', s + 1);
    if (next != null) {
      B.put(row + 2, X0 + i + 1, next, 'down', s + 1);
      // (the digit brought down is marked where it came from)
      B.cells.push({ r: 1, c: X0 + i + 1, ch: '', kind: 'from', from: s + 1, off: null });
    }
    qText += qi;
    row += 2; cur = newCur;
  }
  if (r) { B.put(0, X0 + L + 1, 'r', 'kid', steps.length); B.num(0, X0 + L + 1 + len(r), r, 'kid', steps.length); }
  if ($) B.put(0, X0 + Math.min(i0, ones) - 1, '$', 'unit', steps.length, null, 'kid');
  if (!decimal && !pd) return { op: 'div', n, d, answer: { q, r }, point: longPoint('div', n, d), line: `${n} ${DIV} ${d} = ${q}${r ? ` r ${r}` : ''}`, steps, board: done(B), first };
  return { op: 'div', n: nI, d: dI, given: { n, d }, answer: { q: q / 10 ** p2, r }, places: p2, money: !!$, strand: 'dec', point: 66,
    line: `${sayN} ${DIV} ${sayD} = ${shownQ}`, steps, board: done(B), first };
}
// the move's four sums in a fixed mixed order (the right one never always first), by their labels
function shuffleFixed(list) {
  const h = (t) => { let x = 7; for (const ch of t) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x; };
  return [...list].sort((a, b) => h(a.label) - h(b.label));
}

// ---- adding and taking away in columns (Work it out, src/ui/tools.js) ------------------------------------------------
// The school way, a column at a time, the ones first. Adding: "6 + 7 = ?" (with "plus the 1 carried" when there is one);
// the board writes the 3 and carries the 1 by itself (small, over the next column). Taking away: when the top digit is
// smaller, the board borrows by itself first (the 3 becomes 13, the 5 next to it is crossed out and a small 4 written
// over it: through zeros too, 400 − 7), and asks "13 − 7 = ?". A column with nothing to work (a digit with nothing
// under it and nothing carried) comes straight down by itself. The slips: the carry forgotten, the smaller digit taken
// from the bigger instead of borrowing, one off.
function addChoices(x, y, carry) {
  const right = x + y + carry, plus = carry ? `, plus the ${carry} carried` : '';
  const slips = [];
  if (carry) slips.push({ v: x + y, slip: 'carryLost', why: `${x} + ${y} = ${x + y}. Don't forget the ${carry} carried: ${x + y} + ${carry}.` });
  if (carry) slips.push({ v: x + y + 2 * carry, slip: 'carryTwice', why: `That adds the ${carry} twice. Add the two digits, then the ${carry} carried just once.` });
  if (x > 1 && y > 1 && x * y !== right) slips.push({ v: x * y + carry, slip: 'times', why: `That's ${x} × ${y}. This sum adds: ${x} + ${y}${plus}.` });
  slips.push({ v: right + 1, slip: 'off', why: `Count on from ${x}: ${y} more${plus}.` });
  if (right > 0) slips.push({ v: right - 1, slip: 'off', why: `Count on from ${x}: ${y} more${plus}.` });
  return choicesOf(right, slips, { near: () => `Count on from ${x}: ${y} more${plus}.` });
}
function subChoices(top, bot, borrowed) {
  const right = top - bot;
  const slips = [];
  if (borrowed) slips.push({ v: bot - (top - 10), slip: 'smallFromBig', why: `That takes the ${top - 10} from the ${bot}. The top number is ${top} now (the ten borrowed): ${top} − ${bot}.` });
  slips.push({ v: right + 1, slip: 'off', why: `Count back ${bot} from ${top}.` });
  if (right > 0) slips.push({ v: right - 1, slip: 'off', why: `Count back ${bot} from ${top}.` });
  slips.push({ v: top + bot, slip: 'added', why: `That adds them. This sum takes ${bot} away from ${top}.` });
  return choicesOf(right, slips, { lo: 0, near: () => `Count back ${bot} from ${top}.` });
}
// Decimals (Work it out): the points lined up one under the other, a 0 put on the end where a number has fewer places
// (5.7 + 1.43: 5.70, the 0 in its own colour), the columns worked as whole numbers, and the point comes straight down
// into the answer at the end. Money is the same in dollars and cents ($1.30 + $5.75 = $7.05), the $ written in front.
//   workAdd(a, b, { money }), workSub(a, b, { money }): a and b as written (5.7, 1.43); money: dollars and cents
export function workAdd(a, b, { money = false } = {}) {
  const U = lineUp(a, b, money), P = U.P, f = 10 ** P;
  const [top, bot, padT, padB] = U.A >= U.B ? [U.A, U.B, U.padA, U.padB] : [U.B, U.A, U.padB, U.padA];
  const m = P ? P + 1 : 0;   // (a decimal keeps a digit in front of its point: 0.45)
  const T = digitsTo(top, m).reverse(), Bd = digitsOf(bot).reverse(), sum = top + bot;
  const wT = T.length, wB = Math.max(len(bot), m), wS = Math.max(len(sum), m), $ = money ? 1 : 0;
  const W = Math.max(wS, wT, wB + 1) + 1 + $;
  const rC = 0, rA = 1, rB = 2, rS = 3;
  const B = board(4, W), K = marks(B, P, money);
  const col = (place) => W - 1 - place;
  B.num(rA, col(0), digitsTo(top, m).join(''), 'given', 0);
  B.num(rB, col(0), digitsTo(bot, m).join(''), 'given', 0);
  K.pads(rA, col(0), padT); K.pads(rB, col(0), padB);
  K.point(rA, col(P), 0); K.point(rB, col(P), 0);
  K.cash(rA, col(wT), 0); K.cash(rB, col(wB), 0);
  B.put(rB, col(Math.max(wT, wB) + $), '+', 'sign', 0);
  B.rule(rB, col(Math.max(wS, wT, wB) - 1 + $), col(0), 0);
  const say = (n) => (money ? '$' : '') + dotted(n, P), written = (n) => (money ? '$' : '') + String(n / f);
  const first = P ? lineUpLine(P, [{ str: written(top), pad: padT, padded: say(top) }, { str: written(bot), pad: padB, padded: say(bot) }]) : 'The ones column first.';
  const steps = [];
  let carry = 0;
  for (let i = 0; i < T.length; i++) {
    const x = T[i], y = i < Bd.length ? Bd[i] : null, last = i === T.length - 1, s = steps.length;
    if (y == null && !carry) {   // (nothing under it, nothing carried: it comes straight down; a 0 in front of the point too)
      B.put(rS, col(i), x, 'work', s);
      if (s) steps[s - 1].done += ` The ${x} comes straight down.`;
      continue;
    }
    const v = x + (y ?? 0) + carry, w = last ? len(v) : 1;
    const focus = [[rA, col(i)]];
    if (y != null) focus.push([rB, col(i)]);
    if (carry) focus.push([rC, col(i)]);
    const ask = y == null ? `${x}, plus the ${carry} carried = ?` : carry ? `${x} + ${y}, plus the ${carry} carried = ?` : `${x} + ${y} = ?`;
    const doneLine = last ? `Write ${v}.` : v >= 10 ? `Write the ${v % 10}, carry the 1.` : `Write the ${v}.`;
    steps.push({ kind: 'add', ask, answer: v, choices: addChoices(x, y ?? 0, carry), intro: i === 0 ? first : '', done: doneLine,
      fact: pointOf('add', x, (y ?? 0) + carry), slot: { r: rS, c: col(i) - (w - 1), w }, focus });
    B.num(rS, col(i), last ? v : v % 10, 'kid', s + 1);
    carry = last ? 0 : Math.floor(v / 10);
    if (carry) B.put(rC, col(i + 1), carry, 'carry', s + 1);
  }
  if (!steps.length) return null;
  const n = steps.length, line = `${say(top)} + ${say(bot)} = ${say(sum)}`;
  if (P) {   // (the point and the $ come straight down into the answer)
    K.point(rS, col(P), n, 'kid'); K.cash(rS, col(wS), n, 'kid');
    steps[n - 1].done += ` The point comes straight down: ${say(sum)}.`;
  } else steps[n - 1].done += ` ${top} + ${bot} = ${sum}.`;
  return { op: 'add', a: top / f, b: bot / f, answer: sum / f, places: P, money, point: P ? 50 : addAt(top, bot), strand: P ? 'dec' : 'add', line, steps, board: done(B), first: 0 };
}
export function workSub(a, b, { money = false } = {}) {
  const U = lineUp(a, b, money), P = U.P, f = 10 ** P;
  const A = U.A, Bn = U.B;
  if (!(A >= Bn) || Bn < 0) return null;
  const m = P ? P + 1 : 0;
  const T = digitsTo(A, m).reverse(), Bd = digitsOf(Bn).reverse(), diff = A - Bn;
  const wA = T.length, wB = Math.max(len(Bn), m), $ = money ? 1 : 0;
  const W = Math.max(wA, wB + 1) + 1 + $;
  const rC = 0, rA = 1, rB = 2, rS = 3;
  const B = board(4, W), K = marks(B, P, money);
  const col = (place) => W - 1 - place;
  B.num(rA, col(0), digitsTo(A, m).join(''), 'given', 0);
  B.num(rB, col(0), digitsTo(Bn, m).join(''), 'given', 0);
  K.pads(rA, col(0), U.padA); K.pads(rB, col(0), U.padB);
  K.point(rA, col(P), 0); K.point(rB, col(P), 0);
  K.cash(rA, col(wA), 0); K.cash(rB, col(wB), 0);
  B.put(rB, col(Math.max(wA, wB) + $), MINUS, 'sign', 0);
  B.rule(rB, col(wA - 1 + $), col(0), 0);
  const say = (n) => (money ? '$' : '') + dotted(n, P), written = (n) => (money ? '$' : '') + String(n / f);
  const first = P ? lineUpLine(P, [{ str: written(A), pad: U.padA, padded: say(A) }, { str: written(Bn), pad: U.padB, padded: say(Bn) }]) : 'The ones column first.';
  const steps = [];
  const now = [...T];                          // (the top digits as they stand after any borrowing)
  const givenAt = (i) => B.cells.find((c) => c.r === rA && c.c === col(i) && (c.kind === 'given' || c.kind === 'pad'));
  const smallAt = new Map();                   // (the small digit written over a column, the latest one)
  const writeSmall = (i, v, from) => {
    const old = smallAt.get(i); if (old) old.off = from;
    const g = givenAt(i); if (g && g.off == null) g.off = from;
    B.put(rC, col(i), v, 'borrow', from);
    smallAt.set(i, B.cells[B.cells.length - 1]);
  };
  const dLen = Math.max(len(diff), m);   // (the answer's digits: a decimal keeps its 0 in front of the point, 0.45)
  for (let i = 0; i < T.length; i++) {
    const y = i < Bd.length ? Bd[i] : null, s = steps.length;
    let borrowed = false, intro = i === 0 ? first : '';
    if (y != null && now[i] < y) {
      // borrow a ten by itself: from the next column that has something, through any zeros
      let k = i + 1; while (now[k] === 0) k++;
      const was = now[i];
      now[k] -= 1; writeSmall(k, now[k], s);
      for (let j = k - 1; j > i; j--) { now[j] = 9; writeSmall(j, 9, s); }
      now[i] += 10; writeSmall(i, now[i], s);
      borrowed = true;
      const thru = k > i + 1 ? ' (through the 0s)' : '';
      const line = P ? `${was} is less than ${y}: borrow 1 from the next column${thru}. ${was} becomes ${now[i]}.` : `${was} is less than ${y}: borrow a ten${thru}. ${was} becomes ${now[i]}.`;
      intro = P && i === 0 ? `${first} ${line}` : line;
    }
    const x = now[i];
    const leading = i >= dLen;   // (a 0 in front of the answer is never written)
    if (y == null) {             // (nothing under it: it comes straight down, unless it's a 0 in front)
      if (!leading) B.put(rS, col(i), x, 'work', s);
      if (s && !leading) steps[s - 1].done += ` The ${x} comes straight down.`;
      continue;
    }
    const v = x - y;
    const focus = [[rA, col(i)], [rB, col(i)]];
    if (smallAt.has(i)) focus.push([rC, col(i)]);
    steps.push({ kind: 'sub', ask: `${x} ${MINUS} ${y} = ?`, answer: v, choices: subChoices(x, y, borrowed), intro,
      done: leading ? `${v}: nothing to write in front.` : `Write the ${v}.`, fact: pointOf('sub', x, y), slot: { r: rS, c: col(i), w: 1 }, focus });
    if (!leading) B.put(rS, col(i), v, 'kid', s + 1);
  }
  if (!steps.length) return null;
  const n = steps.length, line = `${say(A)} ${MINUS} ${say(Bn)} = ${say(diff)}`;
  if (P) {
    K.point(rS, col(P), n, 'kid'); K.cash(rS, col(Math.max(len(diff), m)), n, 'kid');
    steps[n - 1].done += ` The point comes straight down: ${say(diff)}.`;
  } else steps[n - 1].done += ` ${A} ${MINUS} ${Bn} = ${diff}.`;
  return { op: 'sub', a: A / f, b: Bn / f, answer: diff / f, places: P, money, point: P ? 50 : subAt(A, Bn), strand: P ? 'dec' : 'sub', line, steps, board: done(B), first: 0 };
}

// ---- a sum read from a question --------------------------------------------------------------------------------------
// The first "a op b" in a question's words or its working, for Work it out: "7 × 8 = ?", "83 − 33", "4 pies × 3 pounds
// = 12 pounds", "112 ÷ 5", "45 miles ÷ 9 hours", "2.5 + 1.75", "6 ÷ 0.5". Decimals stay decimals (2.6 is 2.6, never 26),
// and a question with a blank (? or "what") in the sum isn't a sum to work. Money in whole cents or whole dollars is plain
// numbers to the columns: "50¢ − 15¢" is 50 − 15, "$20 − $7" is 20 − 7, and beside cents a whole dollar written "$1.00"
// is 100 ("$1.00 − 35¢": 100 − 35); with no cents about, "$2.00" is 2. Dollars and cents are decimals with the $ kept:
// "$1.30 + $5.75" -> { op: 'add', a: 1.3, b: 5.75, money: true, cash: 'ab' } (cash: which numbers had the $), and so
// is whole dollars shared out unevenly ("$4.00 ÷ 10" is $0.40 each, cents and all). Working that goes in steps names its
// sums with their answers: the first sum written "= something" wins over a sum said along the way ("12 is 4 × 3, so
// 4 × 4 = 16 cups" is 4 × 4).
const OPS = { '×': 'mul', 'x': 'mul', '*': 'mul', '÷': 'div', '/': 'div', '+': 'add', '−': 'sub', '-': 'sub' };
export function sumFrom(text) {
  let s = String(text || '').replace(/(\d),(\d{3})/g, '$1$2');
  const cents = /¢/.test(s);
  if (cents) s = s.replace(/\$(\d+)\.(\d\d)(?!\d)/g, (m, d, c) => String(Number(d) * 100 + Number(c))).replace(/\$(\d)/g, '$1');
  else if (!/\$\d+\.(?!00(?!\d))\d\d(?!\d)/.test(s)) s = s.replace(/\$(\d+)\.00(?!\d)/g, '$$$1');   // ("$2.00" with no cents about is $2: whole dollars)
  s = s.replace(/(\d)\s*¢/g, '$1');
  const re = /(\$?)(\d+(?:\.\d+)?)(?:\s+[A-Za-z][A-Za-z' ]{0,24}?)?\s*([×x*÷+−-])\s*(\$?)(\d+(?:\.\d+)?)(?![\d.]*\s*\/)(?![\d.])/g;
  let m, first = null;
  while ((m = re.exec(s))) {
    const pre = s.slice(Math.max(0, m.index - 1), m.index), [, da, A, op, db, Bn] = m;
    if (/[.$\d/:]/.test(pre)) continue;   // (the middle of a number, a fraction or a time of day: 6:00 am + 24 hours)
    if (op === 'x' && !/\d\s*x\s*\$?\d/.test(m[0])) continue;   // ("x" is times only between two numbers: 7 x 8)
    const a = Number(A), b = Number(Bn), o = OPS[op];
    if (!Number.isFinite(a) || !Number.isFinite(b) || !o) continue;
    if (o === 'div' && b === 0) continue;
    if (o === 'sub' && a < b) continue;
    const sum = { op: o, a, b };
    const dollars = !!(da || db), cents2 = !Number.isInteger(a) || !Number.isInteger(b);
    if (dollars && (cents2 || (o === 'div' && a % b))) { sum.money = true; sum.cash = (da ? 'a' : '') + (db ? 'b' : ''); }
    if (/^(?:\s*[A-Za-z][A-Za-z' ]{0,24})?\s*=/.test(s.slice(re.lastIndex))) return sum;   // (written with its answer)
    if (!first) first = sum;
  }
  return first;
}

// the times fact a question's working asks, for the times chart (src/math/facts.js recordFact): "4 pies × 3 pounds"
// is 4 × 3; "24 ÷ 4 = 6" is 4 × 6; both numbers up to 12, else null (a long sum is not a times fact)
export function factFrom(text) {
  const s = sumFrom(text);
  if (!s) return null;
  const ok = (n) => Number.isInteger(n) && n >= 1 && n <= 12;
  if (s.op === 'mul' && ok(s.a) && ok(s.b)) return { a: s.a, b: s.b };
  if (s.op === 'div' && s.b && s.a % s.b === 0 && ok(s.b) && ok(s.a / s.b)) return { a: s.b, b: s.a / s.b };
  return null;
}

// ---- a sum at a step of the Long work ladder (the map `long`) ------------------------------------------------------
// make(t) -> [a, b] (times) or [n, d] (divided by); every sum made needs the worked area (needsLong) and sits at its
// step's point (longPoint), which tests/longwork.test.mjs checks across the whole ladder.
const noZero = (n) => !digitsOf(n).includes(0);
// the first step's sums: every two-digit number times 2, 3 or 4 with no carrying (each digit times it stays under 10),
// each as likely as the next (29 of them; picking the multiplier first made 22 × 4 come up one time in ten)
const MUL21 = [];
for (let b = 2; b <= 4; b++) for (let tens = 1; tens * b <= 9; tens++) for (let ones = 1; ones * b <= 9; ones++) MUL21.push([tens * 10 + ones, b]);
export const LADDER = [
  { id: 'mul21', op: 'mul', at: 36, label: 'Two-digit times one-digit (21 × 3)', make: (t) => [...t.pick(MUL21)] },
  { id: 'div1', op: 'div', at: 40, label: 'Dividing by one digit (84 ÷ 4)', make: (t) => {
    for (;;) { const d = t.int(2, 6), q = t.int(13, 49); if (noZero(q) && q * d <= 299) return [q * d, d]; } } },
  { id: 'mulCarry', op: 'mul', at: 42, label: 'Carrying (16 × 7)', make: (t) => {
    for (;;) { const a = t.int(13, 49), b = t.int(3, 9); if (a % 10 && hasCarry(a, b)) return [a, b]; } } },
  { id: 'divRem', op: 'div', at: 45, label: 'A remainder (112 ÷ 5 = 22 r 2)', make: (t) => {
    for (;;) { const d = t.int(3, 9), q = t.int(13, 49), r = t.int(1, d - 1); if (noZero(q) && q * d + r <= 450) return [q * d + r, d]; } } },
  { id: 'mul31', op: 'mul', at: 47, label: 'Three-digit times one-digit (112 × 5)', make: (t) => [t.int(102, 349), t.int(2, 9)] },
  { id: 'mul22', op: 'mul', at: 49, label: 'Two-digit times two-digit (16 × 24)', make: (t) => {
    for (;;) { const a = t.int(12, 49), b = t.int(12, 39); if (noZero(b) && a % 10) return [a, b]; } } },
  { id: 'divZero', op: 'div', at: 51, label: 'A zero in the answer (412 ÷ 4 = 103)', make: (t) => {
    for (;;) {
      const d = t.int(2, 6), hi = t.int(1, 3), q = t.chance(0.7) ? hi * 100 + t.int(1, 9) : hi * 100 + t.int(1, 9) * 10;
      const r = t.chance(0.4) ? t.int(1, d - 1) : 0;
      if (q * d + r <= 999) return [q * d + r, d];
    } } },
  { id: 'mul32', op: 'mul', at: 54, label: 'Three-digit times two-digit (124 × 36)', make: (t) => {
    for (;;) { const a = t.int(102, 299), b = t.int(12, 39); if (noZero(b)) return [a, b]; } } },
  { id: 'div2', op: 'div', at: 58, label: 'Dividing by a two-digit number (288 ÷ 12)', make: (t) => {
    for (;;) { const d = t.int(11, 25), q = t.int(12, 39), r = t.chance(0.5) ? t.int(1, d - 1) : 0; if (noZero(q) && d !== 20 && q * d + r <= 999) return [q * d + r, d]; } } },
];
// a sum at a step (1-based) of the ladder; op: 'mul' or 'div' only (the nearest step of that kind at or below the
// step, or the lowest one above when there is none below)
export function makeLong(step = 1, { rand = Math.random, op = null } = {}) {
  const t = tools(rand);
  let i = Math.max(0, Math.min(LADDER.length - 1, Math.round(step) - 1));
  if (op && LADDER[i].op !== op) {
    let k = i; while (k >= 0 && LADDER[k].op !== op) k--;
    if (k < 0) { k = i; while (k < LADDER.length && LADDER[k].op !== op) k++; }
    i = k;
  }
  const S = LADDER[i];
  for (let tries = 0; tries < 200; tries++) {
    const [a, b] = S.make(t);
    if (needsLong(S.op, a, b) && longPoint(S.op, a, b) === S.at) return S.op === 'mul' ? { op: 'mul', a, b, step: i + 1, id: S.id } : { op: 'div', n: a, d: b, step: i + 1, id: S.id };
  }
  throw new Error('makeLong: nothing made at step ' + (i + 1));
}
// the worked area for a sum: { op: 'mul', a, b }, { op: 'div', n, d } (or a, b), { op: 'add' | 'sub', a, b }
// (decimals and money too: { op, a, b, money, cash } as sumFrom reads them)
export function workOf(sum, o = {}) {
  const m = { money: !!sum.money, cash: sum.cash || '' };
  if (sum.op === 'add') return workAdd(sum.a, sum.b, m);
  if (sum.op === 'sub') return workSub(sum.a, sum.b, m);
  if (sum.op === 'div') return workDiv(sum.n ?? sum.a, sum.d ?? sum.b, m);
  return workMul(sum.a, sum.b, { ...o, ...m });
}
