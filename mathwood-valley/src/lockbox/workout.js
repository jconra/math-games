// The "Work it out" boxes: one expression, worked a part at a time, in the same lock box.
//
// Two strands use them (src/math/strands.js MAPS order and pow):
//   ORDER OF OPERATIONS   O1 Times before plus    3 + 4 × 2              (45)
//                         O2 Brackets first       (3 + 4) × 2            (52)
//                         O3 Three or more steps  2 + 3 × 4 − 6 ÷ 2      (60)
//                         O4 With powers          2 + 3²                 (68)
//                         O5 With negatives       −3 + 4 × (−2)          (76)
//   EXPONENTS             P1 Squares              5²                     (58)
//                         P2 Cubes, powers of 10  4³, 10⁵                (62)
//                         P3 Square roots         √49, √36 + √64         (70)
//                         P4 Multiplying powers   2³ × 2⁴, 5⁶ ÷ 5²       (80)
//                         P5 Zero and negative    7⁰, 2⁻³                (88)
//
// An order box is worked the way it is taught: first "Which part do you work out first?" (the parts that could be
// worked are offered; the wrong ones are the real slips: plus before times, the right-hand part before the left, the
// sum outside the brackets, a number without its power), then that part is worked out with four answers (the slips
// again: 4 + 2 for 4 × 2, 3 × 2 for 3²), and the expression is written again with the answer in place, until one number
// is left. Where only one part can be worked, it is asked straight away. An exponent box asks what the power means
// ("5² means 5 × 5"), then works it out.
//
// Everything is made in advance: a problem is a list of steps the panel plays one after another (src/lockbox/
// workpanel.js), so the node tests check every step.
//   problem = { rung, map, name, mode: 'work', kind: 'one', key, start (text), answer (text), par (steps), steps, lines,
//               rule (the rung's rule, for the steps card), example (a worked example) }
//   step    = { kind: 'pick', expr, choices: [{ text, right, span, why }], rule, right (text) }
//           | { kind: 'part', expr, span, cap, q (text), eq ('=' or 'means'), answer (text), choices: [{ text, right,
//               nudge }], op, a, b (the arithmetic it is: '+' '−' '×' '÷' '^', or x: true for a part that is the
//               strand's own skill: what a power means, a root, a power rule), help, line ({ start, change } for a
//               sum worth a number line, or null), after (expr) }
//   expr    = the expression as display pieces ['3', '+', '4', '×', '2', '^2']; span = [first, last] piece of the
//             part being worked. Text uses ^ for a power (2^3) and a/b for a fraction; workpanel.js draws them.
//   workProblem(rungId, { rng, frac, recent })   frac 0..1: how far the level is toward the next rung (the numbers grow)
//   WORK_RUNGS, WORK_RUNG, WORK_IDS, ORDER_RULES, toText(expr), supText(text) (for tests and logs)
//   parse(text), nextOp(tokens), candidates(tokens), apply(tokens, op), valueOf(text)   the order engine

import { MINUS } from './engine.js';

export const WORK_RUNGS = [
  { id: 'O1', map: 'order', name: 'Times before plus', note: '3 + 4 × 2' },
  { id: 'O2', map: 'order', name: 'Brackets first', note: '(3 + 4) × 2' },
  { id: 'O3', map: 'order', name: 'Three or more steps', note: '2 + 3 × 4 − 6 ÷ 2' },
  { id: 'O4', map: 'order', name: 'With powers', note: '2 + 3^2' },
  { id: 'O5', map: 'order', name: 'With negatives', note: `${MINUS}3 + 4 × (${MINUS}2)` },
  { id: 'P1', map: 'pow', name: 'Squares', note: '5^2' },
  { id: 'P2', map: 'pow', name: 'Cubes and powers of ten', note: '4^3, 10^5' },
  { id: 'P3', map: 'pow', name: 'Square roots', note: '√49' },
  { id: 'P4', map: 'pow', name: 'Multiplying powers', note: '2^3 × 2^4' },
  { id: 'P5', map: 'pow', name: 'Zero and negative powers', note: `7^0, 2^${MINUS}3` },
];
export const WORK_RUNG = Object.fromEntries(WORK_RUNGS.map((r) => [r.id, r]));
export const WORK_IDS = WORK_RUNGS.map((r) => r.id);

// The order of operations, as the steps card shows it (the row lit is the rule the part being worked follows)
export const ORDER_RULES = [
  { n: 1, id: 'brackets', label: 'Brackets ( ) first', short: 'Brackets first' },
  { n: 2, id: 'powers', label: 'Powers (the small raised number)', short: 'Powers' },
  { n: 3, id: 'times', label: '× and ÷, left to right', short: '× and ÷' },
  { n: 4, id: 'plus', label: '+ and −, left to right', short: '+ and −' },
];
const ORDER_RULE = 'Same kind of step? Work left to right.';

// ---------- numbers as text ----------

export const fmt = (n) => {
  const a = Math.abs(n);
  const s = a >= 1000 ? a.toLocaleString('en-US') : String(a);
  return n < 0 ? MINUS + s : s;
};
const fmtExp = (e) => (e < 0 ? MINUS + Math.abs(e) : String(e));
// a number as the right-hand side of an operation, or the base of a power: a negative one in brackets
const wrapNeg = (n) => (n < 0 ? `(${fmt(n)})` : fmt(n));

// text with ^ powers -> the same with raised digits (tests, logs)
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', [MINUS]: '⁻', '-': '⁻' };
export const supText = (s) => String(s).replace(/\^([−-]?\d+)/g, (m, e) => [...e].map((c) => SUP[c] ?? c).join(''));

// ---------- the order engine: an expression as a flat list of tokens ----------
// { t: 'n', v } a whole number · { t: 'o', op } + − × ÷ · { t: '(' } · { t: ')' } · { t: 'p', e } a power on what is
// just before it (a number, or a bracket)

// "3 + 4 * 2^2", "(-2)^2 + 5", "6 - (-3) * 2": a minus is a negative sign at the start or after "(", else taking away
export function parse(text) {
  const out = [];
  const s = String(text).replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i++; continue; }
    const prev = out[out.length - 1];
    if (/\d/.test(c) || (c === '-' && (!prev || prev.t === '(') && /\d/.test(s[i + 1] || ''))) {
      let j = i + 1;
      while (j < s.length && /\d/.test(s[j])) j++;
      out.push({ t: 'n', v: Number(s.slice(i, j)) });
      i = j;
    } else if (c === '^') {
      let j = i + 1;
      if (s[j] === '-') j++;
      while (j < s.length && /\d/.test(s[j])) j++;
      out.push({ t: 'p', e: Number(s.slice(i + 1, j)) });
      i = j;
    } else if (c === '(' || c === ')') { out.push({ t: c }); i++; }
    else if ('+-*/'.includes(c)) { out.push({ t: 'o', op: { '+': '+', '-': MINUS, '*': '×', '/': '÷' }[c] }); i++; }
    else throw new Error(`parse: ${text}`);
  }
  return out;
}

// the tokens as display pieces (one per token) and as one line of text
const piece = (t) => (t.t === 'n' ? fmt(t.v) : t.t === 'o' ? t.op : t.t === 'p' ? `^${fmtExp(t.e)}` : t.t);
export const piecesOf = (toks) => toks.map(piece);
export function toText(expr) {
  const ps = expr.map((p) => (typeof p === 'string' ? p : piece(p)));
  const isOp = (p) => ['+', MINUS, '×', '÷'].includes(p);
  return ps.map((p, i) => (i > 0 && (isOp(p) || isOp(ps[i - 1])) ? ` ${p}` : p)).join('');
}

const OPS = { '+': (a, b) => a + b, [MINUS]: (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => a / b };
const single = (toks, i) => toks[i] && toks[i].t === '(' && toks[i + 1] && toks[i + 1].t === 'n' && toks[i + 2] && toks[i + 2].t === ')';

// The brackets that still have work inside: [open, close] pairs, innermost first (no pair with work inside them)
function workBrackets(toks) {
  const pairs = [], stack = [];
  toks.forEach((t, i) => {
    if (t.t === '(') stack.push(i);
    else if (t.t === ')') { const o = stack.pop(); if (!(i === o + 2 && toks[o + 1].t === 'n')) pairs.push([o, i]); }
  });
  return pairs.filter(([o, c]) => !pairs.some(([o2, c2]) => o2 > o && c2 < c)).sort((a, b) => a[0] - b[0]);
}

// The operands and operators of a stretch with no work brackets in it
function itemsIn(toks, lo, hi) {
  const items = [];
  for (let i = lo; i <= hi;) {
    const t = toks[i];
    if (t.t === 'n' || single(toks, i)) {
      const end = t.t === 'n' ? i : i + 2, v = t.t === 'n' ? t.v : toks[i + 1].v;
      const pw = toks[end + 1] && toks[end + 1].t === 'p' && end + 1 <= hi ? toks[end + 1].e : null;
      items.push({ k: 'num', i0: i, i1: pw === null ? end : end + 1, v, pow: pw });
      i = (pw === null ? end : end + 1) + 1;
    } else if (t.t === 'o') { items.push({ k: 'op', i, op: t.op }); i++; }
    else i++;
  }
  return items;
}

// The part the rules say comes next: { kind: 'pow' | 'bin', span: [i0, i1], a, b | e, op, rule } or null (one number)
export function nextOp(toks) {
  const wb = workBrackets(toks);
  const [lo, hi] = wb.length ? [wb[0][0] + 1, wb[0][1] - 1] : [0, toks.length - 1];
  const items = itemsIn(toks, lo, hi);
  // rule: the steps card's row (brackets, while there are brackets with work in them); inner: the rule inside them
  const ruleOf = (r) => ({ rule: wb.length ? 'brackets' : r, inner: r });
  const p = items.find((x) => x.k === 'num' && x.pow !== null);
  if (p) return { kind: 'pow', span: [p.i0, p.i1], a: p.v, e: p.pow, op: '^', ...ruleOf('powers') };
  for (const ops of [['×', '÷'], ['+', MINUS]]) {
    for (let k = 1; k + 1 < items.length; k += 2) {
      if (!ops.includes(items[k].op)) continue;
      const L = items[k - 1], R = items[k + 1];
      return { kind: 'bin', span: [L.i0, R.i1], a: L.v, b: R.v, op: items[k].op, lbr: toks[L.i0].t === '(', ...ruleOf(ops[0] === '×' ? 'times' : 'plus') };
    }
  }
  return null;
}

// Every part a kid might work first (the right one among them), with the slips marked:
//   cross: one of its numbers is inside brackets that still have work (the 3 × 4 of (2 + 3) × 4)
//   powSlip: one of its numbers has a power on it, taken without it (the 4 × 2 of 4 × 2²)
export function candidates(toks) {
  const out = [];
  toks.forEach((t, i) => {
    if (t.t === 'p') {
      if (toks[i - 1].t === 'n') out.push({ kind: 'pow', span: [i - 1, i], a: toks[i - 1].v, e: t.e, op: '^' });
      else if (toks[i - 1].t === ')' && single(toks, i - 3)) out.push({ kind: 'pow', span: [i - 3, i], a: toks[i - 2].v, e: t.e, op: '^', br: true });
      // (a power on brackets that still have work: the slip is to raise only the last number, the 2² of (3 + 2)²)
      else if (toks[i - 1].t === ')' && toks[i - 2].t === 'n') out.push({ kind: 'pow', span: [i - 2, i], a: toks[i - 2].v, e: t.e, op: '^', cross: true });
    }
  });
  const left = (i) => {
    const j = i - 1, t = toks[j];
    if (!t) return null;
    if (t.t === 'n') return { i0: j, v: t.v };
    if (t.t === 'p') {
      if (toks[j - 1].t === 'n') return { i0: j - 1, v: toks[j - 1].v, powSlip: true };
      if (single(toks, j - 3)) return { i0: j - 3, v: toks[j - 2].v, powSlip: true, br: true };
      return null;
    }
    if (t.t === ')') {
      if (single(toks, j - 2)) return { i0: j - 2, v: toks[j - 1].v, br: true };
      return toks[j - 1].t === 'n' ? { i0: j - 1, v: toks[j - 1].v, cross: true } : null;
    }
    return null;
  };
  const right = (i) => {
    const j = i + 1, t = toks[j];
    if (!t) return null;
    if (t.t === 'n') return { i1: j, v: t.v, powSlip: !!(toks[j + 1] && toks[j + 1].t === 'p') };
    if (t.t === '(') {
      if (single(toks, j)) return { i1: j + 2, v: toks[j + 1].v, powSlip: !!(toks[j + 3] && toks[j + 3].t === 'p') };
      return toks[j + 1].t === 'n' ? { i1: j + 1, v: toks[j + 1].v, cross: true } : null;
    }
    return null;
  };
  toks.forEach((t, i) => {
    if (t.t !== 'o') return;
    const L = left(i), R = right(i);
    if (!L || !R) return;
    out.push({ kind: 'bin', span: [L.i0, R.i1], a: L.v, b: R.v, op: t.op, cross: !!(L.cross || R.cross), powSlip: !!(L.powSlip || R.powSlip), lbr: !!L.br });
  });
  return out.map((c) => ({ ...c, text: opText(c) }));
}
// (a negative on the left keeps the brackets it has on the mat; on the right it always has them)
const opText = (c) => (c.kind === 'pow' ? `${wrapNeg(c.a)}^${fmtExp(c.e)}` : `${c.lbr ? wrapNeg(c.a) : fmt(c.a)} ${c.op} ${wrapNeg(c.b)}`);

export const valueOfOp = (o) => (o.kind === 'pow' ? o.a ** o.e : OPS[o.op](o.a, o.b));

// The part worked: its tokens become one number, and a bracket left holding one number goes (kept round a negative
// that follows an operation or carries a power: 6 − (−3), (−2)²)
export function apply(toks, o) {
  const v = valueOfOp(o);
  const before = toks[o.span[0] - 1];
  // (a negative answer straight after an operation is written in brackets: −3 + (−8), not −3 + −8)
  const put = v < 0 && before && before.t === 'o' ? [{ t: '(' }, { t: 'n', v }, { t: ')' }] : [{ t: 'n', v }];
  let out = [...toks.slice(0, o.span[0]), ...put, ...toks.slice(o.span[1] + 1)];
  for (let guard = 0; guard < 8; guard++) {
    const i = out.findIndex((t, k) => single(out, k) && !(out[k + 1].v < 0 && ((out[k - 1] && out[k - 1].t === 'o') || (out[k + 3] && out[k + 3].t === 'p'))));
    if (i < 0) break;
    out = [...out.slice(0, i), out[i + 1], ...out.slice(i + 3)];
  }
  return out;
}
// the value of an expression worked by the rules (tests)
export function valueOf(text) {
  let toks = typeof text === 'string' ? parse(text) : text;
  for (let g = 0; g < 30; g++) {
    const o = nextOp(toks);
    if (!o) break;
    toks = apply(toks, o);
  }
  return toks.length === 1 && toks[0].t === 'n' ? toks[0].v : NaN;
}

// ---------- the answers to pick from (the slips first) ----------

// three wrong answers to a part, from the slips a kid makes, never the answer, all different
function slipsOf(o, v) {
  const { a, b, e } = o;
  const neg = a < 0 || (b ?? 0) < 0;
  let list;
  if (o.op === '+') list = neg ? [-v, a - b, v + 1, v - 1, b - a] : [v + 1, v - 1, a * b, Math.abs(a - b), v + 10];
  else if (o.op === MINUS) list = neg ? [a + b, -v, v + 1, v - 1, b - a] : [a + b, v + 1, v - 1, b - a, v + 10];
  else if (o.op === '×') list = neg ? [-v, a + b, v + Math.abs(a), v - Math.abs(b)] : [a + b, v + a, v - b, a * (b + 1), v + 10];
  else if (o.op === '÷') list = neg ? [-v, a * b, v + 1, v - 1] : [a * b, v + 1, v - 1, a - b, v + 2];
  else list = [a * e, a + e, a < 0 ? -v : a ** (e + 1), v + a, v - 1, v + 1];   // a power: 3² as 3 × 2, 3 + 2
  const out = [];
  for (const c of [...list, v + 2, v - 2, v + 3, v + 5]) {
    if (out.length >= 3) break;
    if (Number.isInteger(c) && c !== v && !out.includes(c) && Math.abs(c) <= Math.max(200, Math.abs(v) * 10)) out.push(c);
  }
  return out;
}

// a wrong answer's nudge: what it would come from, and the way to the right one
function valueNudge(o, c) {
  const { a, b, e } = o;
  const v = valueOfOp(o);
  if (c === -v && v !== 0) return 'Check the sign: is the answer above zero or below?';
  if (o.op === '^') {
    if (c === a * e) return `That's ${fmt(a)} × ${e}. The small ${e} says how many ${fmt(a)}s to multiply together.`;
    if (c === a + e) return `That adds the ${e}. ${expand(a, e)}.`;
    return `${expand(a, e)}.`;
  }
  if (o.op === '×' && c === a + b) return `That's ${fmt(a)} + ${wrapNeg(b)}. Times means ${wrapNeg(b)} groups of ${wrapNeg(a)}.`;
  if (o.op === '×' && a > 0 && b > 0 && (c === v + a || c === v - a || c === v + b || c === v - b)) return `One group too ${c > v ? 'many' : 'few'}: ${fmt(b)} groups of ${fmt(a)}.`;
  if (o.op === '+' && a >= 0 && b >= 0 && Math.abs(c - v) === 1) return `Count on again: start at ${fmt(Math.max(a, b))} and count ${fmt(Math.min(a, b))} more.`;
  if (o.op === MINUS && a >= 0 && b >= 0 && v >= 0 && Math.abs(c - v) === 1) return `Count back again: start at ${fmt(a)} and take away ${fmt(b)}.`;
  if (o.op === '÷' && c === a * b) return `That multiplies. ${fmt(a)} ÷ ${wrapNeg(b)}: how many ${wrapNeg(b)}s make ${fmt(a)}?`;
  if (o.op === MINUS && c === a + b) return b < 0 ? `Taking away a negative is the same as adding: ${fmt(a)} − ${wrapNeg(b)} = ${fmt(a)} + ${fmt(-b)}.` : `That adds. Take ${fmt(b)} away from ${fmt(a)}.`;
  if (o.op === MINUS && c === b - a) return `That takes ${fmt(a)} from ${fmt(b)}. Start at ${fmt(a)} and take ${wrapNeg(b)} away.`;
  return `${opText({ ...o, kind: o.op === '^' ? 'pow' : 'bin' })} isn't ${fmt(c)}.`;
}
const expand = (a, e) => `${wrapNeg(a)}^${e} = ${Array.from({ length: e }, () => wrapNeg(a)).join(' × ')}`;

// help for a part (Ask Hob)
function valueHelp(o) {
  const { a, b, e } = o;
  if (o.op === '^') return `${expand(a, e)}.${a < 0 ? ' Two negatives multiplied make a positive.' : ''}`;
  const neg = a < 0 || (b ?? 0) < 0;
  if (o.op === '×') {
    if (neg) return 'Multiply the numbers, then the sign: one negative makes it negative, two negatives make it positive.';
    const k = Math.min(Math.abs(a), Math.abs(b)), big = Math.max(Math.abs(a), Math.abs(b));
    return k <= 5 ? `Count by ${big}s, ${k} times: ${Array.from({ length: k }, (_, i) => fmt(big * (i + 1))).join(', ')}.` : `${fmt(a)} × ${fmt(b)}: ${fmt(b)} groups of ${fmt(a)}.`;
  }
  if (o.op === '÷') return neg ? 'Divide the numbers, then the sign: one negative makes it negative, two negatives make it positive.' : `${fmt(a)} ÷ ${fmt(b)}: what times ${fmt(b)} makes ${fmt(a)}?`;
  if (o.op === MINUS && b < 0) return `Taking away a negative is adding: ${fmt(a)} − ${wrapNeg(b)} = ${fmt(a)} + ${fmt(-b)}.`;
  if (neg) return 'Picture the number line: start at the first number and move the second one.';
  return o.op === '+' ? `Start at ${fmt(Math.max(a, b))} and count on ${fmt(Math.min(a, b))}.` : `Start at ${fmt(a)} and count back ${fmt(b)}.`;
}

// a sum worth the number line (it starts below zero, or crosses it): { start, change } or null
function lineOf(o) {
  if (o.op !== '+' && o.op !== MINUS) return null;
  const change = o.op === '+' ? o.b : -o.b, v = o.a + change;
  return o.a < 0 || Math.sign(v) !== Math.sign(o.a) ? { start: o.a, change } : null;
}

// a part of the arithmetic kind: the four answers and their nudges
function valuePart(rng, expr, span, o, cap, after) {
  const v = valueOfOp(o);
  const choices = rng.shuffle([{ text: fmt(v), right: true }, ...slipsOf(o, v).map((c) => ({ text: fmt(c), right: false, nudge: valueNudge(o, c) }))]);
  return { kind: 'part', expr, span, cap, q: opText({ ...o, kind: o.op === '^' ? 'pow' : 'bin' }), eq: '=', answer: fmt(v), choices,
    op: o.op, a: o.a, b: o.op === '^' ? o.e : o.b, help: valueHelp(o), line: lineOf(o), after };
}

// ---------- an order box: the steps, from the expression ----------

// why a wrong first pick isn't first (the rule it broke)
function pickWhy(right, w) {
  if (w.cross || (right.rule === 'brackets' && !w.inside)) return `Brackets first: ${right.text} is inside them.`;
  if (w.powSlip) return 'A power goes first, and it belongs to its own number only.';
  if (right.inner === 'powers') return `Powers come before × ÷ + −: ${right.text} first.`;
  if (right.inner === 'times' && (w.op === '+' || w.op === MINUS)) return `× and ÷ come before + and −: ${right.text} first.`;
  return `Same kind of step: work left to right. ${right.text} comes first.`;
}
const RULE_SAY = { brackets: 'Brackets first.', powers: 'Powers next: before × ÷ + −.', times: '× and ÷ before + and −, left to right.', plus: '+ and −, left to right.' };

export function orderSteps(text, rng) {
  let toks = parse(text);
  const steps = [], lines = [toText(piecesOf(toks))];
  for (let guard = 0; guard < 12; guard++) {
    const o = nextOp(toks);
    if (!o) break;
    const expr = piecesOf(toks);
    const cands = candidates(toks);
    const wb = workBrackets(toks);
    const right = cands.find((c) => c.span[0] === o.span[0] && c.span[1] === o.span[1] && !c.cross && !c.powSlip)
      || { ...o, text: opText(o) };
    right.rule = o.rule; right.inner = o.inner;
    // the wrong ones (inside: whether it sits in the bracket being worked), never two that read the same
    const seen = new Set([right.text]);
    const wrong = [];
    for (const c of cands) {
      if (c === right || seen.has(c.text)) continue;
      seen.add(c.text);
      const inside = wb.length ? c.span[0] > wb[0][0] && c.span[1] < wb[0][1] : true;
      wrong.push({ ...c, inside });
    }
    // the slips worth asking about first: the part that breaks the rule this step follows
    const rank = (c) => (c.cross ? 0 : c.powSlip ? 1 : 2);
    wrong.sort((x, y) => rank(x) - rank(y));
    const shown = wrong.slice(0, 3);
    if (shown.length) {
      steps.push({ kind: 'pick', expr, rule: o.rule, right: right.text,
        choices: rng.shuffle([{ text: right.text, right: true, span: right.span }, ...shown.map((c) => ({ text: c.text, right: false, span: c.span, why: pickWhy(right, c) }))]),
        help: [RULE_SAY[o.rule], `${right.text} first.`] });
    }
    const after = apply(toks, o);
    const cap = shown.length ? ORDER_RULES.find((r) => r.id === o.rule).short : 'Work it out';
    steps.push({ ...valuePart(rng, expr, o.span, o, cap, piecesOf(after)), rule: o.rule });
    toks = after;
    lines.push(toText(piecesOf(toks)));
  }
  return { steps, lines, answer: lines[lines.length - 1] };
}

// ---------- the order makers, by rung (frac 0..1 grows the numbers) ----------

const tb = (rng, f) => rng.int(2, f < 0.34 ? 5 : f < 0.67 ? 9 : 12);   // a times-table number
const ORDER = {
  // (two operations at the bottom of a rung; above it three, so a guess at "which first" is right less often and the
  // plus and minus that are left go left to right)
  O1(rng, f) {
    const b = tb(rng, f), c = tb(rng, f), a = rng.int(2, f < 0.5 ? 12 : 30);
    const q = rng.int(2, f < 0.5 ? 5 : 9), d = q * tb(rng, f), e = rng.int(1, 9);
    if (f < 0.34) {
      return rng.pick([
        `${a} + ${b} * ${c}`, `${b} * ${c} + ${a}`, `${b * c + a} - ${b} * ${c}`,
        `${d} / ${q} + ${a}`, `${a + d / q} - ${d} / ${q}`, `${a} + ${d} / ${q}`,
      ]);
    }
    return rng.pick([
      `${a} + ${b} * ${c} - ${e}`, `${b} * ${c} - ${e} + ${a}`, `${a + e} - ${e} + ${b} * ${c}`,
      `${a} + ${d} / ${q} + ${e}`, `${a + e} - ${d / q} * ${q} + ${e}`.replace(`${d / q} * ${q}`, `${d} / ${q}`), `${e} + ${b} * ${c} + ${a}`,
    ]);
  },
  O2(rng, f) {
    const a = rng.int(2, f < 0.5 ? 9 : 15), b = rng.int(2, f < 0.5 ? 9 : 15), c = tb(rng, f);
    const big = Math.max(a, b), small = Math.min(a, b);
    const q = rng.int(2, 6), n = q * rng.int(2, 6), k = rng.int(1, n - 1);   // (n − k + k) ÷ q: a whole answer
    if (f < 0.34) return rng.pick([`(${a} + ${b}) * ${c}`, `${c} * (${a} + ${b})`, `(${big} - ${small}) * ${c}`, `${c} * (${big} - ${small})`, `(${n - k} + ${k}) / ${q}`]);
    const e = rng.int(2, 9), m = rng.int(2, 3);
    return rng.pick([`${c} * (${a} + ${b}) - ${e}`, `(${a} + ${b}) * ${c} + ${e}`, `${e} + (${big} - ${small}) * ${c}`,
      `${(big - small) * m + e} - (${big} - ${small}) * ${m}`, `(${n - k} + ${k}) / ${q} + ${e}`, `${e} * (${big} - ${small}) + ${c}`]);
  },
  O3(rng, f) {
    const a = rng.int(2, 15), b = tb(rng, f), c = tb(rng, f), q = rng.int(2, 6), d = q * rng.int(2, 6), e = rng.int(2, 9);
    return rng.pick([
      `${a} + ${b} * ${c} - ${d} / ${q}`,                         // two before the plus and minus
      `${d} / ${q} * ${b} + ${a}`,                                 // ÷ then × (left to right)
      `${a + b + c} - ${b} + ${c} * ${e}`,                         // − then + (left to right), after the ×
      `(${a + b} - ${b}) * ${c} + ${e}`,                           // brackets, ×, +
      `${b * c + e} - ${b} * ${c} + ${a}`,
    ]);
  },
  O4(rng, f) {
    const s = rng.int(2, f < 0.5 ? 5 : 9), a = rng.int(2, 20), b = rng.int(2, 5), c = rng.int(1, 3), d = rng.int(2, 4);
    return rng.pick([
      `${a} + ${s}^2`, `${b} * ${s}^2`, `${s}^2 - ${Math.min(a, s * s - 1)}`, `${a + b * s * s} - ${b} * ${s}^2`,
      `(${c} + ${d})^2 * ${b}`, `${d}^3 + ${a}`, `${s}^2 + ${d}^2`, `${b} * (${s}^2 - ${Math.min(a, s * s - 1)})`,
    ]);
  },
  O5(rng, f) {
    const a = rng.int(2, 9), b = rng.int(2, f < 0.5 ? 6 : 9), c = rng.int(2, f < 0.5 ? 6 : 9), d = rng.int(2, 6);
    return rng.pick([
      `-${a} + ${b} * (-${c})`, `(-${d})^2 + ${a}`, `${a} - (-${b}) * ${d}`, `(-${a} + ${Math.max(1, a - b)}) * ${c}`,
      `-${b * c} / (${a} - ${a + c})`, `${b} * (-${c}) - ${a}`, `(-${d})^2 - ${a} * ${b}`, `-${a} - ${b} * ${c}`,
    ]);
  },
};

// ---------- the exponent makers ----------

// the right answer and up to three wrong ones (each a text, or { text, nudge }), never two that read the same
function choiceList(rng, right, wrong) {
  const seen = new Set([right]), out = [{ text: right, right: true }];
  for (const w of wrong) {
    const c = typeof w === 'string' ? { text: w } : w;
    if (out.length >= 4 || seen.has(c.text)) continue;
    seen.add(c.text);
    out.push({ ...c, right: false });
  }
  return rng.shuffle(out);
}
const times = (a, n) => Array.from({ length: n }, () => wrapNeg(a)).join(' × ');

// "What does 5² mean?" -> 5 × 5 (with the slips 5 × 2, 5 + 5, 2 × 2 × 2 × 2 × 2)
function meaningPart(rng, a, e, extra = {}) {
  const right = times(a, e);
  const wrong = [
    { text: `${wrapNeg(a)} × ${e}`, nudge: `${wrapNeg(a)} × ${e} is ${wrapNeg(a)} taken ${e} times over. The small ${e} says how many ${wrapNeg(a)}s to multiply together.` },
    { text: Array.from({ length: e }, () => wrapNeg(a)).join(' + '), nudge: `That adds them. A power multiplies: ${right}.` },
    a > 0 && a <= 6 && a !== e ? { text: times(e, a), nudge: `That multiplies ${e}s. The big number is the one multiplied: ${right}.` } : { text: `${e} × ${e}`, nudge: `The big number is the one multiplied: ${right}.` },
  ];
  return { kind: 'part', expr: [`${wrapNeg(a)}`, `^${e}`], span: [0, 1], cap: 'What the power means', q: `${wrapNeg(a)}^${e}`, eq: 'means',
    answer: right, choices: choiceList(rng, right, wrong), x: true, help: `The small number says how many times to multiply the big one by itself: 4^2 = 4 × 4, 4^3 = 4 × 4 × 4.`,
    line: null, after: right.split(' '), ...extra };
}

const POW = {
  P1(rng, f) {   // squares
    // (not 2: 2 × 2 = 2 + 2 = 2 · 2 gives nothing to choose; up to 12², the tens' squares 20² and 30², and from the
    // middle of the rung up to 15², so a few boxes don't keep coming back)
    const n = rng.chance(0.15) ? rng.pick([20, 30]) : f >= 0.5 && rng.chance(0.25) ? rng.int(13, 15) : rng.int(3, 12);
    const m = meaningPart(rng, n, 2);
    const v = valuePart(rng, m.after, [0, 2], { kind: 'bin', op: '×', a: n, b: n }, 'Work it out', [fmt(n * n)]);
    // (the power slip 2n among the answers: 6² = 12)
    if (!v.choices.some((c) => c.text === fmt(2 * n)) && 2 * n !== n * n) { const k = v.choices.findIndex((c) => !c.right); v.choices[k] = { text: fmt(2 * n), right: false, nudge: `That's ${n} × 2. ${n}^2 is ${n} × ${n}.` }; }
    return { start: `${n}^2`, steps: [m, v], lines: [`${n}^2`, m.answer, fmt(n * n)] };
  },
  P2(rng, f) {   // cubes, and powers of ten (and now and then a small power past the cube: 2^5, 3^4)
    if (rng.chance(0.2)) {
      const [a, k] = rng.pick([[2, 4], [2, 5], [2, 6], [3, 4], [5, 4], [4, 4]]);
      const m = meaningPart(rng, a, k);
      const v = a ** k;
      const val = { kind: 'part', expr: m.after, span: [0, m.after.length - 1], cap: 'Work it out', q: times(a, k), eq: '=', answer: fmt(v),
        choices: choiceList(rng, fmt(v), [{ text: fmt(a * k), nudge: `That's ${a} × ${k}. ${a}^${k} multiplies ${k} ${a}s together.` },
          { text: fmt(a ** (k - 1)), nudge: `That's only ${k - 1} ${a}s multiplied. Count them: ${k}.` }, { text: fmt(a ** (k + 1)), nudge: `That's ${k + 1} ${a}s multiplied. Count them: ${k}.` }]),
        x: true, help: `Multiply left to right: ${a} × ${a} = ${a * a}, then × ${a} again, ${k} ${a}s in all.`, line: null, after: [fmt(v)] };
      return { start: `${a}^${k}`, steps: [m, val], lines: [`${a}^${k}`, m.answer, fmt(v)] };
    }
    if (rng.chance(0.5)) {
      const n = rng.int(2, f < 0.5 ? 6 : 7);
      const m = meaningPart(rng, n, 3);
      const v1 = valuePart(rng, m.after, [0, 2], { kind: 'bin', op: '×', a: n, b: n }, 'Left to right', [fmt(n * n), '×', fmt(n)]);
      const v2 = valuePart(rng, v1.after, [0, 2], { kind: 'bin', op: '×', a: n * n, b: n }, 'Work it out', [fmt(n ** 3)]);
      return { start: `${n}^3`, steps: [m, v1, v2], lines: [`${n}^3`, m.answer, `${fmt(n * n)} × ${n}`, fmt(n ** 3)] };
    }
    const k = rng.int(2, 6);
    const m = meaningPart(rng, 10, k);
    const v = 10 ** k;
    const val = { kind: 'part', expr: m.after, span: [0, m.after.length - 1], cap: 'Work it out', q: times(10, k), eq: '=', answer: fmt(v),
      choices: choiceList(rng, fmt(v), [{ text: fmt(v / 10), nudge: `Count the tens: ${k} of them, so ${k} zeros.` }, { text: fmt(v * 10), nudge: `Count the tens: ${k} of them, so ${k} zeros.` }, { text: fmt(10 * k), nudge: `That's 10 × ${k}. Each × 10 puts one more zero on.` }]),
      x: true, help: 'Each × 10 puts one more zero on: 10, 100, 1,000, 10,000 ...', line: null, after: [fmt(v)] };
    return { start: `10^${k}`, steps: [m, val], lines: [`10^${k}`, m.answer, fmt(v)] };
  },
  P3(rng, f) {   // square roots
    const root = (n, extra) => {
      const N = n * n;
      const wrong = [n + 1, n - 1, N % 2 === 0 ? N / 2 : n + 2, n + 2].filter((c) => c > 0 && c !== n);
      const uniq = [...new Set(wrong)].slice(0, 3);
      return { kind: 'part', cap: 'Square root', q: `√${N}`, eq: '=', answer: fmt(n), x: true,
        choices: choiceList(rng, fmt(n), uniq.map((c) => ({ text: fmt(c), nudge: c === N / 2 ? `That's half of ${N}. √${N} asks: what number times itself makes ${N}?` : `${c} × ${c} = ${fmt(c * c)}, not ${fmt(N)}.` }))),
        help: `√${N} asks: what number times itself makes ${N}? Try ${n - 1} × ${n - 1} = ${(n - 1) ** 2}, ${n} × ${n} = ${N}.`, line: null, ...extra };
    };
    const n = f >= 0.34 && rng.chance(0.2) ? rng.pick([13, 14, 15, 20]) : rng.int(2, 12);
    if (f < 0.34 || rng.chance(0.4)) {
      const r = root(n, { expr: [`√${n * n}`], span: [0, 0], after: [fmt(n)] });
      return { start: `√${n * n}`, steps: [r], lines: [`√${n * n}`, fmt(n)] };
    }
    if (rng.chance(0.5)) {   // √36 + √64
      let m = rng.int(2, 10);
      if (m === n) m = n === 10 ? 9 : n + 1;
      const e0 = [`√${n * n}`, '+', `√${m * m}`];
      const r1 = root(n, { expr: e0, span: [0, 0], after: [fmt(n), '+', `√${m * m}`] });
      const r2 = root(m, { expr: r1.after, span: [2, 2], after: [fmt(n), '+', fmt(m)] });
      const s = valuePart(rng, r2.after, [0, 2], { kind: 'bin', op: '+', a: n, b: m }, 'Work it out', [fmt(n + m)]);
      return { start: e0.join(' '), steps: [r1, r2, s], lines: [e0.join(' '), `${n} + √${m * m}`, `${n} + ${m}`, fmt(n + m)] };
    }
    const k = rng.int(2, 5);   // 3 × √49
    const e0 = [fmt(k), '×', `√${n * n}`];
    const r = root(n, { expr: e0, span: [2, 2], after: [fmt(k), '×', fmt(n)] });
    const t = valuePart(rng, r.after, [0, 2], { kind: 'bin', op: '×', a: k, b: n }, 'Work it out', [fmt(k * n)]);
    return { start: e0.join(' '), steps: [r, t], lines: [e0.join(' '), `${k} × ${n}`, fmt(k * n)] };
  },
  P4(rng, f) {   // multiplying and dividing powers of the same number
    const b = rng.int(2, f < 0.5 ? 3 : 5);
    const form = f < 0.34 ? 'mul' : rng.pick(f < 0.67 ? ['mul', 'div'] : ['mul', 'div', 'pow']);
    let p = rng.int(2, 5), q = rng.int(2, 4);
    let start, right, wrong, help;
    if (form === 'mul') {
      start = `${b}^${p} × ${b}^${q}`; right = `${b}^${p + q}`;
      wrong = [{ text: `${b}^${p * q}`, nudge: `Count the ${b}s: ${p} of them, then ${q} more. Same number: × adds the powers.` },
        { text: `${b * b}^${p + q}`, nudge: `The ${b} stays a ${b}: only the powers add.` }, { text: `${b * b}^${p * q}`, nudge: `The ${b} stays a ${b}, and the powers add.` },
        { text: `${b}^${Math.max(p, q)}`, nudge: `Count the ${b}s: ${p} of them, then ${q} more. Same number: × adds the powers.` }];
      help = `${b}^${p} × ${b}^${q} = (${times(b, p)}) × (${times(b, q)}): count the ${b}s. Same number: × adds the powers.`;
    } else if (form === 'div') {
      if (p <= q) [p, q] = [q + 2, p];
      start = `${b}^${p} ÷ ${b}^${q}`; right = `${b}^${p - q}`;
      wrong = [p % q === 0 && p / q !== p - q ? { text: `${b}^${p / q}`, nudge: `${q} of the ${b}s cancel, leaving ${p - q}. Same number: ÷ takes the powers away.` } : { text: `${b}^${p + q}`, nudge: `÷ takes the powers away: ${p} − ${q}.` },
        { text: `1^${p - q}`, nudge: `The ${b} stays a ${b}: only the powers come off.` }, { text: `${b}^${p * q}`, nudge: `÷ takes the powers away: ${p} − ${q}.` }];
      help = `${b}^${p} ÷ ${b}^${q}: ${q} of the ${p} ${b}s on top cancel with the ${b}s underneath. Same number: ÷ takes the powers away.`;
    } else {
      start = `(${b}^${p})^${q}`; right = `${b}^${p * q}`;
      wrong = [{ text: `${b}^${p + q}`, nudge: `${q} lots of ${b}^${p}: ${q} × ${p} ${b}s in all. A power of a power multiplies the powers.` },
        { text: `${b * q}^${p}`, nudge: `The ${b} stays a ${b}. A power of a power multiplies the powers.` }, { text: `${b * p}^${q}`, nudge: `The ${b} stays a ${b}: ${q} lots of ${p} ${b}s.` },
        { text: `${b}^${p}`, nudge: `The power outside counts too: ${q} lots of ${b}^${p}.` }, { text: `${b}^${p * q + 1}`, nudge: `${q} lots of ${p}: ${p} × ${q} = ${p * q}.` }];
      help = `(${b}^${p})^${q} = ${Array.from({ length: q }, () => `${b}^${p}`).join(' × ')}: ${q} lots of ${p} ${b}s. A power of a power multiplies the powers.`;
    }
    const e0 = start.split(' ');
    const rule = { kind: 'part', expr: e0, span: [0, e0.length - 1], cap: 'Powers of the same number', q: start, eq: '=', answer: right, x: true,
      choices: choiceList(rng, right, wrong), help, line: null, after: [right] };
    const [rb, re] = right.split('^').map(Number);
    const steps = [rule], lines = [start, right];
    if (rb ** re <= 256 && f >= 0.5) {   // and its value, when it is small enough to work out
      const v = rb ** re;
      steps.push({ kind: 'part', expr: [right], span: [0, 0], cap: 'Work it out', q: right, eq: '=', answer: fmt(v), x: true,
        choices: choiceList(rng, fmt(v), [{ text: fmt(rb * re), nudge: `That's ${rb} × ${re}. ${expand(rb, re)}.` }, { text: fmt(v * rb), nudge: `One ${rb} too many: ${expand(rb, re)}.` }, { text: fmt(v / rb), nudge: `One ${rb} too few: ${expand(rb, re)}.` }]),
        help: `${expand(rb, re)}.`, line: null, after: [fmt(v)] });
      lines.push(fmt(v));
    }
    return { start, steps, lines };
  },
  P5(rng, f) {   // zero and negative powers
    if (f < 0.34 || rng.chance(0.3)) {
      const n = rng.pick([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 20, 25, 50, 100]);
      const s = { kind: 'part', expr: [fmt(n), '^0'], span: [0, 1], cap: 'The power 0', q: `${n}^0`, eq: '=', answer: '1', x: true,
        choices: choiceList(rng, '1', [{ text: '0', nudge: `Not 0: ${n}^1 = ${n}, and one step down divides by ${n}, so ${n}^0 = 1.` }, { text: fmt(n), nudge: `That's ${n}^1. One step down divides by ${n}.` }, { text: fmt(n * 10), nudge: `${n}^1 = ${n}; one step down divides by ${n}.` }]),
        help: `${n}^2 = ${fmt(n * n)}, ${n}^1 = ${n}, ${n}^0 = 1: each step down the powers divides by ${n}. Any number (but 0) to the power 0 is 1.`, line: null, after: ['1'] };
      return { start: `${n}^0`, steps: [s], lines: [`${n}^0`, '1'] };
    }
    const n = rng.int(2, 5), k = n === 5 ? rng.int(1, 2) : rng.int(f < 0.67 ? 1 : 2, 3), N = n ** k;
    const E = `${n}^${MINUS}${k}`;
    const pattern = `${n}^1 = ${n}, ${n}^0 = 1, ${n}^${MINUS}1 = 1/${n}, ${n}^${MINUS}2 = 1/${n * n}: each step down divides by ${n}.`;
    const over = k === 1 ? fmt(n) : `${n}^${k}`;   // (2^−1 means 1 ÷ 2; 2^−3 means 1 ÷ 2^3)
    const m = { kind: 'part', expr: [fmt(n), `^${MINUS}${k}`], span: [0, 1], cap: 'A negative power', q: E, eq: 'means', answer: `1 ÷ ${over}`, x: true,
      choices: choiceList(rng, `1 ÷ ${over}`, [{ text: `${MINUS}${n}^${k}`, nudge: `A negative power isn't a negative number: it divides. ${pattern}` }, { text: `${n} × (${MINUS}${k})`, nudge: `The small number isn't multiplied by the big one. ${pattern}` }, { text: `${MINUS}(${n} × ${k})`, nudge: `A negative power divides: 1 ÷ ${n}^${k}.` }]),
      help: pattern, line: null, after: ['1', '÷', over] };
    const steps = [m], lines = [E, `1 ÷ ${over}`];
    if (k >= 2) {
      const v = valuePart(rng, m.after, [2, 2], { kind: 'pow', op: '^', a: n, e: k }, 'The power', ['1', '÷', fmt(N)]);
      steps.push(v);
      lines.push(`1 ÷ ${fmt(N)}`);
    }
    const last = steps[steps.length - 1].after;
    steps.push({ kind: 'part', expr: last, span: [0, last.length - 1], cap: 'As a fraction', q: `1 ÷ ${fmt(N)}`, eq: '=', answer: `1/${N}`, x: true,
      choices: choiceList(rng, `1/${N}`, [{ text: `${MINUS}${fmt(N)}`, nudge: 'A negative power gives a fraction, not a negative number.' }, { text: `1/${n * k}`, nudge: `${n}^${k} is ${times(n, k)} = ${N}, not ${n} × ${k}.` }, { text: fmt(N), nudge: `1 ÷ ${N} is a small fraction: one part of ${N}.` },
        { text: `1/${N * n}`, nudge: `One ${n} too many: 1 ÷ ${N} = 1/${N}.` }]),
      help: `1 ÷ ${N} is the fraction 1/${N}.`, line: null, after: [`1/${N}`] });
    lines.push(`1/${N}`);
    return { start: E, steps, lines };
  },
};

const RULE_TEXT = {
  O1: '× and ÷ come before + and −.', O2: 'Brackets first, whatever is in them.', O3: ORDER_RULE, O4: 'Powers come before × ÷ + −.',
  O5: 'The same order with negatives. Watch the signs.',
  P1: 'A power says how many times to multiply a number by itself.', P2: 'A power says how many times to multiply a number by itself.',
  P3: '√ asks: what number times itself makes this?', P4: 'Same number: × adds the powers, ÷ takes them away.',
  P5: 'Each step down the powers divides: n^0 = 1, n^−1 = 1/n.',
};
const EXAMPLE = {
  O1: ['2 + 3 × 4', '2 + 12', '14'], O2: ['(2 + 3) × 4', '5 × 4', '20'], O3: ['12 ÷ 3 × 2 + 1', '4 × 2 + 1', '8 + 1', '9'],
  O4: ['2 + 3^2 × 2', '2 + 9 × 2', '2 + 18', '20'], O5: [`${MINUS}2 + 3 × (${MINUS}4)`, `${MINUS}2 + (${MINUS}12)`, `${MINUS}14`],
  P1: ['4^2', '4 × 4', '16'], P2: ['2^3', '2 × 2 × 2', '8'], P3: ['√25', '5, since 5 × 5 = 25'], P4: ['2^3 × 2^2', '(2 × 2 × 2) × (2 × 2)', '2^5'],
  P5: ['2^0 = 1', `2^${MINUS}1 = 1/2`, `2^${MINUS}2 = 1/4`],
};

// ---------- the public maker ----------

export function workProblem(rungId, { rng, frac = 0, recent = [] } = {}) {
  const R = WORK_RUNG[rungId];
  if (!R) throw new Error(`no work rung ${rungId}`);
  const f = Math.max(0, Math.min(1, Number(frac) || 0));
  const seen = new Set(recent);
  let made = null;
  for (let tries = 0; tries < 200; tries++) {
    let m;
    if (R.map === 'order') {
      const text = ORDER[rungId](rng, f);
      const w = orderSteps(text, rng);
      const v = valueOf(text);
      if (!Number.isInteger(v) || Math.abs(v) > 999) continue;   // (whole answers only, and not huge)
      if (!w.steps.some((s) => s.kind === 'pick')) continue;      // (an order box asks which part goes first)
      m = { start: w.lines[0], steps: w.steps, lines: w.lines };
    } else m = POW[rungId](rng, f);
    const key = `${rungId}:${m.start}`;
    made = { ...m, key };
    // (none of the recent boxes; a rung with fewer boxes than that: at least none of the last few)
    if (!seen.has(key) || (tries > 100 && !recent.slice(-5).includes(key)) || tries > 190) break;
  }
  const { start, steps, lines, key } = made;
  return {
    rung: rungId, map: R.map, name: R.name, mode: 'work', kind: 'one', key, start, x: null, answer: lines[lines.length - 1],
    par: steps.length, route: [], steps, lines, rule: RULE_TEXT[rungId], example: EXAMPLE[rungId],
  };
}
