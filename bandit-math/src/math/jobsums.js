// THE SUM IN FRONT OF THE KID, job by job, for the tools' Work it out (src/ui/tools.js). Each job hands its current
// question's sum over itself (J.workSum(): the store and the deliveries have their own; the others call these with
// their own question), rather than the tools reading words off a card on the screen (the range draws its own card, so
// there was nothing to read there).
//
// A sum is { op: 'add' | 'sub' | 'mul' | 'div', a, b, setup? } with whole numbers only (the columns don't do points
// or negatives), or null: a question with no sum on it (a series to finish, a herd to rope, odds and evens, a fraction
// to compare) says so on the button.
//   setup: true   the sum is not written on the question (a blank to fill, a story): Work it out first asks "What do
//                 we work out?" with the two numbers and each sign, so seeing which sum it is stays the kid's
// What stays the kid's: estimating at the range (the exact sum is the help, the nearest bottle is still theirs), the
// sheep's check (the sum worked, the kid still says which sheep is wrong), the pigs' pen.
//
//   plainSum(text)        the first plain "a op b" in words ("18 + 26: LESS THAN 50 ..."), whole and not negative
//   blankSum(eq)          a sum with a blank or an x: "9 + ? = 12" -> 12 − 9 (setup), "? × 6 = 42" -> 42 ÷ 6,
//                         "x − 7 = 3" -> 3 + 7; "58 ÷ 7 = 8, ? left over" -> 58 ÷ 7; "10 more than 48 is ?" -> 48 + 10;
//                         two steps ("2x + 7 = 15") -> null
//   rangeSum(card)        the bottle range (src/math/numbersense.js card): an estimating card's exact sum
//   waveSum(wave)         the round-up's and the wagon's waves: a missing-number card ("7 × ? = 56"); series and
//                         herds -> null
//   sheepSum(item)        a sick-sheep sum as written ("24 + 49 = 63" -> 24 + 49); a step of solving for x -> null
//   pigSum(item)          a pig's sum ("18 + 26")
//   deerSum(shot)         a deer photo's question (blankSum of shot.eq)
//   lootSum(problem)      a share of the loot (src/math/shares.js): total ÷ families or ÷ a load (setup); by a rule -> null
//   fishSum(q)            a fishing question (labs/fishing/pies.js): a fraction of the fish caught -> all ÷ the bottom
//                         number (setup); the other fraction questions -> null
// Pure: no page (tests/jobsums.test.mjs).

import { sumFrom } from './longwork.js';

const OP = { '+': 'add', '−': 'sub', '-': 'sub', '×': 'mul', 'x': 'mul', '*': 'mul', '÷': 'div', '/': 'div' };
const whole = (n) => Number.isInteger(n) && n >= 0;
function make(op, a, b, setup = false) {
  if (!OP[op] && !['add', 'sub', 'mul', 'div'].includes(op)) return null;
  const o = OP[op] || op;
  a = Number(a); b = Number(b);
  if (!whole(a) || !whole(b)) return null;
  if (o === 'sub' && a < b) return null;
  if (o === 'div' && b === 0) return null;
  const s = { op: o, a, b };
  if (setup) s.setup = true;
  return s;
}
const clean = (t) => String(t || '').replace(/(\d),(\d{3})/g, '$1$2').replace(/−/g, '−').trim();

// a negative number in it (−3 + 8, 12 − (−2)) or a bracket: not a sum for the columns
const NEG = /(?:^|[\s(=:,])[−-]\d|\(/;
export function plainSum(text) {
  const t = clean(text);
  if (!t) return null;
  // (only the part before the first "=" or ":": "24 + 49 = 63", "18 + 26: LESS THAN 50 or MORE THAN 50?")
  const head = t.split(/[=:]/)[0];
  if (NEG.test(head) || /\?/.test(head)) return null;
  const s = sumFrom(head);
  return s ? make(s.op, s.a, s.b) : null;
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
    if (o === 'add') return make('sub', c, a, true);   // a + ? = c: c − a
    if (o === 'sub') return make('sub', a, c, true);   // a − ? = c: a − c
    if (o === 'mul') return make('div', c, a, true);   // a × ? = c: c ÷ a
    if (o === 'div') return make('div', a, c, true);   // a ÷ ? = c: a ÷ c
    return null;
  }
  if ((m = RE.blankB.exec(t))) {
    const [, op, b, c] = m, o = OP[op];
    if (o === 'add') return make('sub', c, b, true);   // ? + b = c: c − b
    if (o === 'sub') return make('add', c, b, true);   // ? − b = c: c + b
    if (o === 'mul') return make('div', c, b, true);   // ? × b = c: c ÷ b
    if (o === 'div') return make('mul', c, b, true);   // ? ÷ b = c: c × b
    return null;
  }
  if ((m = RE.kx.exec(t))) return make('div', m[2], m[1], true);   // 7x = 42: 42 ÷ 7
  return null;
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
  return shot && shot.eq ? blankSum(shot.eq) : null;
}

export function lootSum(p) {
  if (!p || !['even', 'rem', 'leftover'].includes(p.kind)) return null;
  return make('div', p.total, p.groups, true);
}

export function fishSum(q) {
  if (!q || q.topic !== 'group') return null;
  const m = /^group:(\d+)\/(\d+):(\d+)$/.exec(String(q.key || ''));
  return m ? make('div', m[3], m[2], true) : null;
}
