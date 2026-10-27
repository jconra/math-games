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
//   sumFrom(text) -> { op: 'add' | 'sub' | 'mul' | 'div', a, b } | null   the first whole-number sum in a question
//   factFrom(text) -> { a, b } | null   the times fact in a question's working (both up to 12), for the times chart
//   workOf(sum) -> Work for any of the four
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

// ---- the board ---------------------------------------------------------------------------------------------------
function board(rows, cols) {
  const B = { rows, cols, cells: [], rules: [] };
  B.put = (r, c, ch, kind, from, off = null) => { B.cells.push({ r, c, ch: String(ch), kind, from, off }); };
  B.num = (r, right, n, kind, from) => { const d = String(n); for (let k = 0; k < d.length; k++) B.put(r, right - d.length + 1 + k, d[k], kind, from); };
  B.rule = (r, c0, c1, from, kind = 'bar') => { B.rules.push({ r, c0, c1, from, kind }); };
  return B;
}
const done = (B) => { delete B.put; delete B.num; delete B.rule; return B; };

// ---- long multiplication -------------------------------------------------------------------------------------------
// The longer number on top (the school way); the same length: as given (16 × 14, the 16 on top).
export function workMul(x, y, { lead = null } = {}) {
  const [top, bot] = len(x) >= len(y) ? [x, y] : [y, x];
  const A = digitsOf(top).reverse(), Bd = digitsOf(bot).reverse();   // (ones first)
  const product = top * bot;
  const rowsVal = Bd.map((bj, j) => top * bj * 10 ** j);
  const multi = Bd.length > 1;
  const W = Math.max(len(product), len(top), len(bot) + 1) + 1;   // (+1: room for the × sign)
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
  B.num(rA, col(0), top, 'given', first);
  B.num(rB, col(0), bot, 'given', first);
  B.put(rB, col(Math.max(len(top), len(bot))), TIMES, 'sign', first);
  B.rule(rB, col(Math.max(len(product), len(top), len(bot)) - 1), col(0), first);
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
  return { op: 'mul', a: top, b: bot, answer: product, point: longPoint('mul', top, bot), line: `${top} ${TIMES} ${bot} = ${product}`, steps, board: done(B), first };
}

// ---- long division ---------------------------------------------------------------------------------------------------
export function workDiv(n, d) {
  const D = digitsOf(n), L = D.length, q = Math.floor(n / d), r = n % d;
  // the first chunk: digits until the divisor fits (5 doesn't go into 1: start with 11)
  let i0 = 0, cur = D[0];
  while (cur < d && i0 < L - 1) { i0++; cur = cur * 10 + D[i0]; }
  const nSteps = L - i0;
  const X0 = len(d) + 1;
  const W = X0 + L + (r ? 2 + len(r) : 0);
  const B = board(2 + 2 * nSteps, W);
  const steps = [];
  const first = 0;
  B.num(1, len(d) - 1, d, 'divisor', 0);
  B.num(1, X0 + L - 1, n, 'given', 0);
  B.rule(1, X0, X0 + L - 1, 0, 'bracket');
  let row = 1, qText = '';
  for (let k = 0; k < nSteps; k++) {
    const i = i0 + k, qi = Math.floor(cur / d), p = qi * d, diff = cur - p, s = steps.length;
    const curCells = [];
    for (let c = X0 + i - len(cur) + 1; c <= X0 + i; c++) curCells.push([row, c]);
    const focus = [...curCells, ...Array.from({ length: len(d) }, (_, c) => [1, c])];
    let intro = '';
    if (k === 0 && i0 > 0) intro = `${d} doesn't go into ${D.slice(0, i0).join('')}, so start with ${cur}.`;
    const next = i < L - 1 ? D[i + 1] : null, newCur = next == null ? null : diff * 10 + next;
    let doneLine = `${qi} goes on top. ${qi} ${TIMES} ${d} = ${p}, under the ${cur}. ${cur} ${MINUS} ${p} = ${diff}.`;
    if (next != null) doneLine += ` Bring down the ${next}: ${newCur}.`;
    else doneLine += diff ? ` Nothing left to bring down, so ${diff} is the remainder: ${q} r ${diff}.` : ` Nothing left over: ${n} ${DIV} ${d} = ${q}.`;
    steps.push({ kind: 'div', ask: `How many times does ${d} go into ${cur}?`, answer: qi, choices: divChoices(cur, d), intro, done: doneLine,
      fact: { strand: 'div', at: d <= 12 ? divAt(cur, d) : 52 }, slot: { r: 0, c: X0 + i, w: 1 }, focus });
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
  if (r) { B.put(0, X0 + L + 1, 'r', 'kid', nSteps); B.num(0, X0 + L + 1 + len(r), r, 'kid', nSteps); }
  return { op: 'div', n, d, answer: { q, r }, point: longPoint('div', n, d), line: `${n} ${DIV} ${d} = ${q}${r ? ` r ${r}` : ''}`, steps, board: done(B), first };
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
export function workAdd(a, b) {
  const [top, bot] = a >= b ? [a, b] : [b, a];
  const T = digitsOf(top).reverse(), Bd = digitsOf(bot).reverse(), sum = top + bot;
  const W = Math.max(len(sum), len(top), len(bot) + 1) + 1;
  const rC = 0, rA = 1, rB = 2, rS = 3;
  const B = board(4, W);
  const col = (place) => W - 1 - place;
  B.num(rA, col(0), top, 'given', 0);
  B.num(rB, col(0), bot, 'given', 0);
  B.put(rB, col(Math.max(len(top), len(bot))), '+', 'sign', 0);
  B.rule(rB, col(Math.max(len(sum), len(top), len(bot)) - 1), col(0), 0);
  const steps = [];
  let carry = 0;
  for (let i = 0; i < T.length; i++) {
    const x = T[i], y = i < Bd.length ? Bd[i] : null, last = i === T.length - 1, s = steps.length;
    if (y == null && !carry) {   // (nothing under it, nothing carried: it comes straight down)
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
    steps.push({ kind: 'add', ask, answer: v, choices: addChoices(x, y ?? 0, carry), intro: i === 0 ? 'The ones column first.' : '', done: doneLine,
      fact: pointOf('add', x, (y ?? 0) + carry), slot: { r: rS, c: col(i) - (w - 1), w }, focus });
    B.num(rS, col(i), last ? v : v % 10, 'kid', s + 1);
    carry = last ? 0 : Math.floor(v / 10);
    if (carry) B.put(rC, col(i + 1), carry, 'carry', s + 1);
  }
  if (!steps.length) return null;
  steps[steps.length - 1].done += ` ${top} + ${bot} = ${sum}.`;
  return { op: 'add', a: top, b: bot, answer: sum, point: addAt(top, bot), line: `${top} + ${bot} = ${sum}`, steps, board: done(B), first: 0 };
}
export function workSub(a, b) {
  if (!(a >= b) || b < 0) return null;
  const T = digitsOf(a).reverse(), Bd = digitsOf(b).reverse(), diff = a - b;
  const W = Math.max(len(a), len(b) + 1) + 1;
  const rC = 0, rA = 1, rB = 2, rS = 3;
  const B = board(4, W);
  const col = (place) => W - 1 - place;
  B.num(rA, col(0), a, 'given', 0);
  B.num(rB, col(0), b, 'given', 0);
  B.put(rB, col(Math.max(len(a), len(b))), MINUS, 'sign', 0);
  B.rule(rB, col(len(a) - 1), col(0), 0);
  const steps = [];
  const now = [...T];                          // (the top digits as they stand after any borrowing)
  const givenAt = (i) => B.cells.find((c) => c.r === rA && c.c === col(i) && c.kind === 'given');
  const smallAt = new Map();                   // (the small digit written over a column, the latest one)
  const writeSmall = (i, v, from) => {
    const old = smallAt.get(i); if (old) old.off = from;
    const g = givenAt(i); if (g && g.off == null) g.off = from;
    B.put(rC, col(i), v, 'borrow', from);
    smallAt.set(i, B.cells[B.cells.length - 1]);
  };
  const dLen = len(diff);
  for (let i = 0; i < T.length; i++) {
    const y = i < Bd.length ? Bd[i] : null, s = steps.length;
    let borrowed = false, intro = i === 0 ? 'The ones column first.' : '';
    if (y != null && now[i] < y) {
      // borrow a ten by itself: from the next column that has something, through any zeros
      let k = i + 1; while (now[k] === 0) k++;
      const was = now[i];
      now[k] -= 1; writeSmall(k, now[k], s);
      for (let j = k - 1; j > i; j--) { now[j] = 9; writeSmall(j, 9, s); }
      now[i] += 10; writeSmall(i, now[i], s);
      borrowed = true;
      intro = `${was} is less than ${y}: borrow a ten${k > i + 1 ? ' (through the 0s)' : ''}. ${was} becomes ${now[i]}.`;
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
  steps[steps.length - 1].done += ` ${a} ${MINUS} ${b} = ${diff}.`;
  return { op: 'sub', a, b, answer: diff, point: subAt(a, b), line: `${a} ${MINUS} ${b} = ${diff}`, steps, board: done(B), first: 0 };
}

// ---- a sum read from a question --------------------------------------------------------------------------------------
// The first "a op b" in a question's words or its working, for Work it out: "7 × 8 = ?", "83 − 33", "4 pies × 3 pounds
// = 12 pounds", "112 ÷ 5", "45 miles ÷ 9 hours". Whole numbers only (a decimal or dollars and cents: null, the columns
// here don't do points), and a question with a blank (? or "what") in the sum isn't a sum to work. Money in whole cents
// or whole dollars is plain numbers to the columns: "50¢ − 15¢" is 50 − 15, "$20 − $7" is 20 − 7, and beside cents a
// whole dollar written "$1.00" is 100 ("$1.00 − 35¢": 100 − 35); with no cents about, "$2.00" is 2.
const OPS = { '×': 'mul', 'x': 'mul', '*': 'mul', '÷': 'div', '/': 'div', '+': 'add', '−': 'sub', '-': 'sub' };
export function sumFrom(text) {
  let s = String(text || '').replace(/(\d),(\d{3})/g, '$1$2');
  if (/¢/.test(s)) s = s.replace(/\$(\d+)\.(\d\d)(?!\d)/g, (m, d, c) => String(Number(d) * 100 + Number(c)));
  else s = s.replace(/\$(\d+)\.00(?!\d)/g, '$$$1');   // ("$2.00" with no cents about is $2: whole dollars)
  s = s.replace(/(\d)\s*¢/g, '$1').replace(/\$(\d)/g, '$1');
  const re = /(\d+(?:\.\d+)?)(?:\s+[A-Za-z][A-Za-z' ]{0,24}?)?\s*([×x*÷+−-])\s*[$]?(\d+(?:\.\d+)?)(?!\s*\/)/g;
  let m;
  while ((m = re.exec(s))) {
    const pre = s.slice(Math.max(0, m.index - 1), m.index), [, A, op, Bn] = m;
    if (/[.$\d/]/.test(pre) || /\./.test(A + Bn)) continue;
    if (op === 'x' && !/\d\s*x\s*\d/.test(m[0])) continue;   // ("x" is times only between two numbers: 7 x 8)
    const a = Number(A), b = Number(Bn), o = OPS[op];
    if (!Number.isFinite(a) || !Number.isFinite(b) || !o) continue;
    if (o === 'div' && (b === 0 || a % 1)) continue;
    if (o === 'sub' && a < b) continue;
    return { op: o, a, b };
  }
  return null;
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
export function workOf(sum, o = {}) {
  if (sum.op === 'add') return workAdd(sum.a, sum.b);
  if (sum.op === 'sub') return workSub(sum.a, sum.b);
  if (sum.op === 'div') return workDiv(sum.n ?? sum.a, sum.d ?? sum.b);
  return workMul(sum.a, sum.b, o);
}
