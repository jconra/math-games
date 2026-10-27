// THE SUM IN FRONT OF THE KID, job by job, for the tools' Work it out (src/ui/tools.js). Each job hands over the sum of
// what is on screen now (J.workSum(): the part of a delivery the slip is on, the lock box's part being asked, the
// builder's card; the others call these with their own question), rather than the tools reading words off a card on the
// screen (the range draws its own card, so there was nothing to read there).
//
// A sum is { op: 'add' | 'sub' | 'mul' | 'div', a, b, story?, money?, cash?, say? }: whole numbers or decimals, never
// below 0 (the columns don't do negatives).
//   story: true   the sum is not written on the question (a blank to fill, a story): Work it out still opens straight
//                 on it (the columns, filled in), but its button says "The sum on this question" rather than the sum
//   money, cash   dollars and cents ("$2.90 + $3.80": src/math/longwork.js sumFrom), the $ written on the board
//   say           what the sum finds, in plain words, never its answer ("First the cost of 3 tins")
// SUMS IN STEPS: a question answered with one coin that takes two sums or more (the bill and then the change; all the
// parts, one part, then a family's parts) is { chain: [Step, Step ...], story? }: each Step a sum with its say, and
// carried: { a?: k, b?: k } (its numbers that are step k's answer, carried in: the $6.75 bill into $20 − $6.75). Work it
// out walks them in order (src/ui/longwork.js).
// null: nothing on screen to work in columns (a clock to read, a series, a fraction to compare, a move to pick): Work it
// out opens the entry to type a sum by hand (src/ui/ownsum.js).
// What stays the kid's: estimating at the range (the exact sum is the help, the nearest bottle is still theirs), the
// sheep's check (the sum worked, the kid still says which sheep is wrong), the pigs' pen, a square root, every coin.
//
//   sumOf(x, extra)       a maker's sum or list of steps checked and tidied: a sum, { chain }, or null
//   workFrom(text, extra) the sums in a question's working, as steps ("3 × $2.25 = $6.75, then $20 − $6.75 = $13.25":
//                         the bill, then the change), else its one sum (sumFrom), else null
//   answerOf(sum)         a step's answer (a division that doesn't come out: its whole answer)
//   plainSum(text)        the first plain "a op b" in words ("18 + 26: LESS THAN 50 ...", "$2.90 + $3.80"), not negative
//   blankSum(eq)          a sum with a blank or an x: "9 + ? = 12" -> 12 − 9 (story), "? × 6 = 42" -> 42 ÷ 6,
//                         "x − 7 = 3" -> 3 + 7; "58 ÷ 7 = 8, ? left over" -> 58 ÷ 7; "10 more than 48 is ?" -> 48 + 10
//   blankWork(eq)         blankSum, and two steps too: "2x + 7 = 15" -> 15 − 7, then 8 ÷ 2
//   rangeSum(card)        the bottle range (src/math/numbersense.js card): an estimating card's exact sum
//   waveSum(wave)         the round-up's and the wagon's waves: a missing-number card ("7 × ? = 56"); series and
//                         herds -> null
//   sheepSum(item)        a sick-sheep sum as written ("24 + 49 = 63" -> 24 + 49); a step of solving for x -> null
//   pigSum(item)          a pig's sum ("18 + 26")
//   deerSum(shot)         a deer photo's question (blankWork of shot.eq)
//   lootSum(problem)      a share of the loot (src/math/shares.js): total ÷ families or ÷ a load (story); by a rule:
//                         the parts added, one part, then that family's parts
//   fishSum(q)            a fishing question (labs/fishing/pies.js): a fraction of the fish caught -> all ÷ the bottom
//                         number, then times the top (story); the other fraction questions -> null
//   partSum(text)         a lock box's part being asked ("27 ÷ 9", "5x − 4x" as 5 − 4, "4 × 3") or an order-of-operations
//                         box's ("5 × 5 × 5", "2^3" as 2 × 2, then 4 × 2); a negative, a fraction or a root -> null
//   buildSum(q, prompt)   a builder's card (the windmill's and the bridge's geometry, labs/windmill/questions.js), its
//                         numbers read off the card's line: the missing angle (180 − 65), the third corner (the two
//                         added, then from 180), a right triangle's squares (3 × 3, 4 × 4, added: the root stays the
//                         kid's), half a board; naming an angle or a triangle, angles that are equal -> null
//   ownNumber(text), ownSum(a, sign, b)   a sum typed by hand (src/ui/ownsum.js): { sum } or { why, at, swap? }
// Pure: no page (tests/jobsums.test.mjs).

import { sumFrom, sumsFrom, workOf } from './longwork.js';

const OP = { '+': 'add', '−': 'sub', '-': 'sub', '×': 'mul', 'x': 'mul', '*': 'mul', '÷': 'div', '/': 'div' };
const ok = (n) => Number.isFinite(n) && n >= 0;
const STORY = { story: true };
// extra: { story, money, cash } (kept only when set)
function make(op, a, b, extra = {}) {
  if (!OP[op] && !['add', 'sub', 'mul', 'div'].includes(op)) return null;
  const o = OP[op] || op;
  a = Number(a); b = Number(b);
  if (!ok(a) || !ok(b)) return null;
  if (o === 'sub' && a < b) return null;
  if (o === 'div' && b === 0) return null;
  const s = { op: o, a, b };
  if (extra.story) s.story = true;
  if (extra.money) { s.money = true; s.cash = extra.cash || ''; }
  if (extra.say) s.say = String(extra.say);
  return s;
}
const clean = (t) => String(t || '').replace(/(\d),(\d{3})/g, '$1$2').replace(/−/g, '−').trim();
const r9 = (x) => Math.round(x * 1e9) / 1e9;
const near = (x, y) => Math.abs(x - y) < 1e-9;

// ---- sums in steps ------------------------------------------------------------------------------------------------
// a step's answer: what is carried into the next step (a division that doesn't come out: its whole answer, 17 ÷ 7 is 2;
// dollars shared out come out in cents, $4.00 ÷ 10 is $0.40)
export function answerOf(s) {
  if (!s) return NaN;
  const { op, a, b } = s;
  if (op === 'add') return r9(a + b);
  if (op === 'sub') return r9(a - b);
  if (op === 'mul') return r9(a * b);
  if (op === 'div' && b) return s.money ? r9(Math.round((a / b) * 100) / 100) : Number.isInteger(a) && Number.isInteger(b) && a % b ? Math.floor(a / b) : r9(a / b);
  return NaN;
}
// a maker's sum, list of steps or { chain } -> one sum, { chain: [...] } (two steps or more), or null (a step the
// columns can't do: then none of it, rather than half a question). Each later step's numbers that are an earlier
// step's answer are marked carried (the latest step it could have come from). extra: { story, ask }
export function sumOf(x, extra = {}) {
  if (!x) return null;
  const list = Array.isArray(x) ? x : Array.isArray(x.chain) ? x.chain : [x];
  const steps = [];
  for (const y of list) {
    if (!y) continue;
    const s = make(y.op, y.a ?? y.n, y.b ?? y.d, y);
    if (!s) return null;
    steps.push(s);
  }
  if (!steps.length) return null;
  steps.forEach((s, i) => {
    for (const side of ['a', 'b']) {
      for (let k = i - 1; k >= 0; k--) if (near(answerOf(steps[k]), s[side])) { (s.carried ||= {})[side] = k; break; }
    }
    delete s.story;
  });
  const out = steps.length === 1 ? steps[0] : { chain: steps };
  if (extra.story || x.story || list.some((y) => y && y.story)) out.story = true;
  if (extra.ask) out.ask = extra.ask;
  return out;
}
// a sum that only checks one already worked, the other way round ("$1.35 ÷ 3 = 45¢: 3 × 45¢ = $1.35")
function checksBack(s, x) {
  if (x.steps.length !== 1) return false;
  const y = x.steps[0], c = answerOf(s);
  return near(x.answer, s.a) && ((near(y.a, s.b) && near(y.b, c)) || (near(y.b, s.b) && near(y.a, c)));
}
const nothingNew = (s) => (s.op === 'mul' && (s.a === 1 || s.b === 1)) || ((s.op === 'add' || s.op === 'sub') && s.b === 0);
// the sums in a working, as Work it out's steps: every sum written with its answer (src/math/longwork.js sumsFrom), a
// later one kept when it works on with an answer already found (the bill carried into the change); a check back, a
// "× 1" or a "+ 0" left out. No sum written with its answer: the working's first sum (sumFrom), as before.
export function workFrom(text, extra = {}) {
  const xs = sumsFrom(text);
  if (!xs.length) { const s = sumFrom(text); return s ? sumOf(s, extra) : null; }
  const steps = [];
  for (const x of xs) {
    if (steps.length) {
      const done = steps.map(answerOf), y = x.steps[0];
      if (!done.some((v) => near(v, y.a) || near(v, y.b)) || steps.some((s) => checksBack(s, x))) continue;
    }
    steps.push(...x.steps);
  }
  const kept = steps.filter((s) => !nothingNew(s));
  return sumOf(kept.length ? kept : steps, extra);
}

// a negative number in it (−3 + 8, 12 − (−2)) or a bracket: not a sum for the columns
const NEG = /(?:^|[\s(=:,])[−-]\d|\(/;
export function plainSum(text) {
  const t = clean(text);
  if (!t) return null;
  // (only the part before the first "=" or ":": "24 + 49 = 63", "18 + 26: LESS THAN 50 or MORE THAN 50?")
  const head = t.split(/[=:]/)[0];
  if (NEG.test(head) || /\?/.test(head)) return null;
  const s = sumFrom(head);
  return s ? make(s.op, s.a, s.b, s) : null;
}

const N = '(\\d+)', SP = '\\s*', SIGN = '([+−×÷*/-])';
const RE = {
  left: new RegExp(`^${N}${SP}÷${SP}${N}${SP}=${SP}${N}\\s*,\\s*\\?\\s*left over`, 'i'),
  more: /^(\d+)\s+(more|less)\s+than\s+(\d+)\s+is\s+\?$/i,
  aBlank: new RegExp(`^${N}${SP}${SIGN}${SP}[?x]${SP}=${SP}${N}$`),   // a + ? = c
  blankB: new RegExp(`^[?x]${SP}${SIGN}${SP}${N}${SP}=${SP}${N}$`),   // ? + b = c
  kx: new RegExp(`^${N}${SP}x${SP}=${SP}${N}$`),                         // 7x = 42
};
// the other way round ("9 = x − 7"): turned to "x − 7 = 9"
function flip(t) { const m = /^(\d+)\s*=\s*(.+)$/.exec(t); return m && /[?x]/.test(m[2]) ? `${m[2].trim()} = ${m[1]}` : t; }
export function blankSum(eq) {
  let t = clean(eq).replace(/\s+/g, ' ');
  if (!t || NEG.test(t)) return null;
  let m = RE.left.exec(t);
  if (m) return make('div', m[1], m[2]);
  m = RE.more.exec(t);
  if (m) return make(m[2].toLowerCase() === 'more' ? 'add' : 'sub', m[3], m[1]);
  t = flip(t);
  if ((m = RE.aBlank.exec(t))) {
    const [, a, op, c] = m, o = OP[op];
    if (o === 'add') return make('sub', c, a, STORY);   // a + ? = c: c − a
    if (o === 'sub') return make('sub', a, c, STORY);   // a − ? = c: a − c
    if (o === 'mul') return make('div', c, a, STORY);   // a × ? = c: c ÷ a
    if (o === 'div') return make('div', a, c, STORY);   // a ÷ ? = c: a ÷ c
    return null;
  }
  if ((m = RE.blankB.exec(t))) {
    const [, op, b, c] = m, o = OP[op];
    if (o === 'add') return make('sub', c, b, STORY);   // ? + b = c: c − b
    if (o === 'sub') return make('add', c, b, STORY);   // ? − b = c: c + b
    if (o === 'mul') return make('div', c, b, STORY);   // ? × b = c: c ÷ b
    if (o === 'div') return make('mul', c, b, STORY);   // ? ÷ b = c: c × b
    return null;
  }
  if ((m = RE.kx.exec(t))) return make('div', m[2], m[1], STORY);   // 7x = 42: 42 ÷ 7
  return null;
}

// two steps ("2x + 7 = 15", "4x − 3 = 9", "15 = 2x + 7"): undone the other way round, the number added on first, then
// the lots of x shared out: 15 − 7, then 8 ÷ 2 (story: the button doesn't say them)
const TWO = /^(\d+)x ([+−-]) (\d+) = (\d+)$/;
// the balance ("10 + 7 = ? + 15": the side with no blank worked out first, 10 + 7, then the blank, 17 − 15)
const SIDE = /^(\d+) ([+−]) (\d+)$/, BLANK = /^(?:\? ([+−]) (\d+)|(\d+) ([+−]) \?)$/;
function balanceWork(t) {
  let [l, r] = t.split(' = ').map((x) => x.trim());
  if (r == null || t.split(' = ').length !== 2) return null;
  if (/\?/.test(l)) [l, r] = [r, l];
  const k = SIDE.exec(l), b = BLANK.exec(r);
  if (!k || !b) return null;
  const v = k[2] === '+' ? +k[1] + +k[3] : +k[1] - +k[3];
  const second = b[1] ? (b[1] === '+' ? { op: 'sub', a: v, b: +b[2] } : { op: 'add', a: v, b: +b[2] })
    : b[4] === '+' ? { op: 'sub', a: v, b: +b[3] } : { op: 'sub', a: +b[3], b: v };
  return sumOf([{ op: k[2] === '+' ? 'add' : 'sub', a: +k[1], b: +k[3], say: 'First the side you can work out' }, { ...second, say: 'Then the missing number' }], STORY);
}
export function blankWork(eq) {
  const one = blankSum(eq);
  if (one) return one;
  const t = flip(clean(eq).replace(/\s+/g, ' '));
  if (NEG.test(t)) return null;
  const bal = balanceWork(t);
  if (bal) return bal;
  // (the number first: "11 + 4x = 19" is 4x + 11 = 19; "20 − 3x = 8": 3x is what was taken from 20, 20 − 8)
  let m = TWO.exec(t), a, b, c, first;
  if (m) {
    [a, b, c] = [+m[1], +m[3], +m[4]];
    first = m[2] === '+' ? { op: 'sub', a: c, b, say: `First take away the ${b}` } : { op: 'add', a: c, b, say: `First put back the ${b}` };
  } else if ((m = /^(\d+) ([+−-]) (\d+)x = (\d+)$/.exec(t))) {
    [b, a, c] = [+m[1], +m[3], +m[4]];
    first = m[2] === '+' ? { op: 'sub', a: c, b, say: `First take away the ${b}` } : { op: 'sub', a: b, b: c, say: `First what was taken from the ${b}` };
  } else return null;
  if (a < 2 || !make(first.op, first.a, first.b)) return null;
  return sumOf([first, { op: 'div', a: answerOf(first), b: a, say: `Then share it out: ${a} x's, so one x is` }], STORY);
}

export function rangeSum(card) {
  if (!card || card.kind !== 'estimate' || !card.ask) return null;
  const { a, op, b } = card.ask;
  return make(op, a, b);
}

export function waveSum(wave) {
  if (!wave || wave.done || !wave.w || wave.w.kind !== 'missing') return null;
  return blankSum(wave.w.rule);
}

export function sheepSum(item) {
  if (!item || item.top || !item.shown) return null;
  return plainSum(item.shown);
}

export function pigSum(item) {
  return item && item.text ? plainSum(item.text) : null;
}

export function deerSum(shot) {
  return shot && shot.eq ? blankWork(shot.eq) : null;
}

export function lootSum(p) {
  if (!p) return null;
  if (p.kind === 'rule' || p.kind === 'rule3') {
    // by a rule: every family's parts added, one part, then the family asked about's parts (one part: that's it)
    const rows = p.pic && Array.isArray(p.pic.rows) ? p.pic.rows : null, who = rows && rows.find((r) => r.name === p.pic.ask);
    if (!rows || !who || !(p.total > 0)) return null;
    const steps = [];
    let all = rows[0].parts;
    rows.slice(1).forEach((r, i) => { steps.push({ op: 'add', a: all, b: r.parts, say: i ? 'Then the last family\'s parts too' : 'First all the parts, every family\'s' }); all += r.parts; });
    steps.push({ op: 'div', a: p.total, b: all, say: `Then one part: the ${p.total} cut into ${all} equal parts` });
    if (who.parts > 1) steps.push({ op: 'mul', a: who.parts, b: p.total / all, say: `Then ${who.name}${/s$/.test(who.name) ? "'" : "'s"} ${who.parts} parts` });
    return sumOf(steps, STORY);
  }
  if (!['even', 'rem', 'leftover'].includes(p.kind)) return null;
  return make('div', p.total, p.groups, STORY);
}

const PART = { 2: 'half', 3: 'third', 4: 'quarter', 5: 'fifth', 6: 'sixth', 8: 'eighth', 10: 'tenth', 12: 'twelfth' };
export function fishSum(q) {
  if (!q || q.topic !== 'group') return null;
  const m = /^group:(\d+)\/(\d+):(\d+)$/.exec(String(q.key || ''));
  if (!m) return null;
  const top = +m[1], bot = +m[2], all = +m[3], one = PART[bot] ? `a ${PART[bot]}` : `1/${bot}`;
  if (top <= 1) return make('div', all, bot, STORY);
  // (four fifths of 10: a fifth first, 10 ÷ 5, then four of them)
  return sumOf([{ op: 'div', a: all, b: bot, say: `First ${one} of the ${all} fish` }, { op: 'mul', a: all / bot, b: top, say: `Then ${top} of those ${PART[bot] ? PART[bot] + 's' : 'parts'}` }], STORY);
}

// ---- the lock box's part, and an order-of-operations box's ---------------------------------------------------------
// the numbers' sum of a part being asked: "27 ÷ 9"; x-terms counted like things ("5x − 4x" is 5 − 4, so many x's; "12x
// ÷ 4" is 12 ÷ 4); "5 × 5 × 5" left to right; a power as its times ("2^3": 2 × 2, then 4 × 2). A negative, a fraction,
// a root, brackets, or a division whose answer is a fraction (1 ÷ 8): none
export function partSum(text) {
  const t = clean(text).replace(/·/g, '×').replace(/\*/g, '×').replace(/\s+/g, ' ').trim();
  if (!t || NEG.test(t) || /[√/(]/.test(t)) return null;
  let m = /^(\d+) ?\^ ?(\d)$/.exec(t);
  if (m) {
    const n = +m[1], e = +m[2];
    if (e < 2 || e > 4) return null;
    const steps = [];
    let v = n;
    for (let k = 1; k < e; k++) { steps.push({ op: 'mul', a: v, b: n }); v *= n; }
    return sumOf(steps);
  }
  if ((m = /^(\d*)x ([+−]) (\d*)x$/.exec(t))) return make(m[2] === '+' ? 'add' : 'sub', m[1] === '' ? 1 : +m[1], m[3] === '' ? 1 : +m[3]);
  if ((m = /^(\d+)x ([×÷]) (\d+)$/.exec(t))) return OP[m[2]] === 'div' && +m[1] < +m[3] ? null : make(OP[m[2]], +m[1], +m[3]);
  if (/[x^]/.test(t)) return null;
  const w = t.split(' ');
  if (w.length < 3 || w.length % 2 === 0) return null;
  const steps = [];
  let v = Number(w[0]);
  for (let k = 1; k < w.length; k += 2) {
    const o = OP[w[k]], b = Number(w[k + 1]);
    if (!o || !Number.isFinite(v) || !Number.isFinite(b)) return null;
    if (steps.length && (o === 'add' || o === 'sub') !== (steps[0].op === 'add' || steps[0].op === 'sub')) return null;   // (a mix: the box asks one part at a time)
    if (o === 'div' && b > v) return null;
    steps.push({ op: o, a: v, b });
    v = answerOf({ op: o, a: v, b });
  }
  return sumOf(steps);
}

// ---- a builder's card (the windmill's and the bridge's geometry) ---------------------------------------------------
// q: the card as the builder's handle gives it ({ kind, topic, answer }: labs/windmill/builder.js WM.question(), the
// bridge's BR.question()); prompt: the card's own line, as on screen ("Two corners of this triangle are 65° and 45°.
// What is the third corner?"): its angles and lengths are read off it (lengths as the builders write them: "4 feet",
// "4½ feet", "a 5-foot board", "half a foot")
function lengthsIn(text) {
  const out = [], re = /(\d+)(½)?(?:-foot|\s*(?:feet|foot))(?:\s+(\d+)\s*inch(?:es)?)?|half a foot/g;
  let m;
  while ((m = re.exec(text))) out.push(m[0] === 'half a foot' ? 0.5 : +m[1] + (m[2] ? 0.5 : 0) + (m[3] ? +m[3] / 12 : 0));
  return out;
}
const anglesIn = (text) => [...String(text).matchAll(/(\d+)°/g)].map((m) => +m[1]);
export function buildSum(q, prompt = '') {
  if (!q || q.answered) return null;
  const t = String(prompt || q.prompt || '').replace(/\s+/g, ' '), kind = q.kind, topic = q.topic;
  const ang = anglesIn(t), len = lengthsIn(t);
  // right triangles: the squares, added (or the short one taken from the long one); the square root stays the kid's
  const hyp = ([x, y]) => [{ op: 'mul', a: x, b: x, say: 'First one short side squared' }, { op: 'mul', a: y, b: y, say: 'Then the other short side squared' },
    { op: 'add', a: r9(x * x), b: r9(y * y), say: 'Then add the two squares: that is the long side squared' }];
  const leg = ([c, k]) => [{ op: 'mul', a: c, b: c, say: 'First the long side squared' }, { op: 'mul', a: k, b: k, say: 'Then the short side you know, squared' },
    { op: 'sub', a: r9(c * c), b: r9(k * k), say: 'Then take the short square from the long one' }];
  if ((kind === 'missing' || topic === 'line' || topic === 'corner') && ang.length) {
    const line = topic === 'line' || /straight line/.test(t);
    return sumOf({ op: 'sub', a: line ? 180 : 90, b: ang[0], say: line ? 'A straight line is 180°' : 'A square corner is 90°' }, STORY);
  }
  if (kind === 'cross' && ang.length) return near(q.answer, ang[0]) ? null : sumOf({ op: 'sub', a: 180, b: ang[0], say: 'Side by side they make 180°' }, STORY);
  if ((topic === 'tri-sum' || kind === 'angle') && ang.length === 2) {
    const [x, y] = ang;
    return sumOf([{ op: 'add', a: x, b: y, say: 'First add the two corners you know' }, { op: 'sub', a: 180, b: x + y, say: 'Then take that from 180°, all three corners' }], STORY);
  }
  if (len.length >= 2 && (kind === 'length' || kind === 'slope' || kind === 'panel' || /^(hyp|leg|reach|panel)$/.test(topic || ''))) {
    // the long side asked (two short sides given), or a short side (the long side, then a short one, given)
    const longAsked = /short sides are|wide and .* tall|long and .* tall\. How long a diagonal/.test(t);
    return sumOf(longAsked ? hyp(len) : leg(len), STORY);
  }
  if (kind === 'easy' && len.length) return /in half/i.test(t) ? make('div', len[0], 2, STORY) : make('add', len[0], len[0], STORY);
  return null;
}

// ---- a sum typed by hand (Work it out's own entry, src/ui/ownsum.js) ------------------------------------------------
export const OWN = { digits: 6, places: 2 };   // a number typed: up to 6 digits before its point, 2 after
// a number as typed: "1250", "2.5", "$3.40", ".5" -> { v, dollars, places } | { empty, dollars } | { why }
export function ownNumber(text) {
  const t = String(text ?? '').replace(/[\s,]/g, ''), dollars = t.includes('$'), n = t.replace(/\$/g, '');
  if (!n) return { empty: true, dollars };
  if (!/^\d*\.?\d*$/.test(n) || n === '.') return { why: 'A number is digits, with one point at most.' };
  const [w, f = ''] = n.split('.');
  if (w.replace(/^0+(?=\d)/, '').length > OWN.digits) return { why: `Up to ${OWN.digits} digits before the point.` };
  if (f.length > OWN.places) return { why: `Up to ${OWN.places} digits after the point.` };
  return { v: Number(n), dollars, places: f.length };
}
const SIGNS = { add: 'add', sub: 'sub', mul: 'mul', div: 'div', ...OP };
const typed = (x, t) => `${x.dollars ? '$' : ''}${String(t ?? '').replace(/[\s,$]/g, '')}`;
// -> { sum } ready for the columns, or { why (one friendly line), at: 'a' | 'op' | 'b' (where to look), swap? (true:
// the two numbers the other way round would work) }
export function ownSum(aText, sign, bText) {
  const A = ownNumber(aText), B = ownNumber(bText), o = SIGNS[sign];
  if (A.why) return { why: A.why, at: 'a' };
  if (A.empty) return { why: 'Type the first number.', at: 'a' };
  if (!o) return { why: 'Pick a sign: +, −, × or ÷.', at: 'op' };
  if (B.why) return { why: B.why, at: 'b' };
  if (B.empty) return { why: 'Type the second number.', at: 'b' };
  if (o === 'sub' && A.v < B.v) return { why: `The bigger number goes on top: ${typed(B, bText)} − ${typed(A, aText)} works in columns.`, at: 'b', swap: true };
  if (o === 'div' && B.v === 0) return { why: 'Nothing can be shared into 0 groups. Divide by a number bigger than 0.', at: 'b' };
  let extra = {};
  if (A.dollars || B.dollars) {
    if (o === 'add' || o === 'sub') extra = { money: true, cash: 'ab' };
    else if (o === 'mul') extra = { money: true, cash: A.dollars ? 'a' : 'b' };   // ($3 × $2 isn't a thing: the $ stays on one)
    else if (A.dollars && !B.dollars) extra = { money: true, cash: 'a' };      // ($20 ÷ 4 is dollars each; $20 ÷ $5 is a count)
  }
  const sum = make(o, A.v, B.v, extra);
  let w = null;
  try { w = sum && workOf(sum); } catch (e) { w = null; }
  if (!w) return { why: 'Those numbers don\'t make a sum for the columns. Try others.', at: 'a' };
  return { sum };
}

