// Working every step: after a move is picked, the kid works out each part of the line it changes.
//
// On 5x = 4x + 27, pressing −4x writes 5x − 4x = 4x + 27 − 4x for a beat. Then:
//   - the 4x − 4x on the right cancels by itself (that is what the move was for): the two chips are struck out;
//   - the left asks "5x − 4x = ?" with four answers in the tray: x, 9x, 1, −x.
// After ÷9 on 27 = 9x: "9x ÷ 9 = x" frees x by itself, and "27 ÷ 9 = ?" is asked. After ÷(−3) on −3x = −27:
// "−27 ÷ (−3) = ?" (9, −9, −24, −27). A sum of two numbers shows a number line as a picture (where it starts and which
// way it hops, not where it lands). A wrong pick shakes, Hob gives a one-line nudge, and the right answer stays to pick.
// Once every part is in, the line is exactly the one the move makes (engine.js applyMove), so the ledger is the same.
//
// Nothing here touches the page, so the node tests can check it.
//
//   partsOf(line, move, { rng }) -> null for a move that can't be made (or "open the brackets": products.js asks
//     those), else { show, shown, out, autos: [...], qs: [...] }
//     show   'mid' (an add: the line with the new term on both ends) or 'before' (×, ÷, the flip, combining)
//     shown  that line; every index below points into it
//     autos  the parts that work themselves out, played before the questions:
//            { room, kind: 'zero' | 'free' | 'open' | 'plain', at: [indices], result: [terms], text }
//            zero = a pair that cancels (4x − 4x), struck out; free = x left on its own (9x ÷ 9 = x);
//            open = brackets whose number became 1 (3(x + 2) ÷ 3); plain = nothing to work out (0 + 6, 0 ÷ 3)
//     qs     the questions, left side first: { room, kind: 'sum' | 'scale' | 'join', at: [indices], result: term,
//            prompt: '5x − 4x', tokens: [{ text, from }], answer: 'x', choices: [{ text, right, tag }],
//            line: { start, change } | null (the number-line picture), op, a, b, f }
//            from: an index into the shown side, or 'den' (the ÷ under the side) / 'times' (the · beside it)
//   roomParts(...)  the same for one side (the inequalities use it room by room)
//   partNudge(q, choice) -> Hob's one line after a wrong pick (never the answer itself)
//   partHelp(q)          -> Ask Hob's line while a part is asked
//   assemble(parts)      -> the rooms the answers build (the tests check it is exactly the move's line)
//
// The wrong answers are the real slips, tagged:
//   pm    plus/minus mixed up (5x − 4x as 9x; 27 ÷ 9 as 27 − 9; 4 · 3 as 4 + 3)
//   sign  the right size with the wrong sign (−x; −9 for −27 ÷ (−3))
//   one   the operation done to only one term: this one left as it was (12 for 12 ÷ 6)
//   off   one off (26 for 27)
//   drop  both signs dropped (28 for −10 + 18)
//   nox   the x dropped (1 for 5x − 4x)
//   swap  multiplied instead of dividing, or the other way round

import { F, MINUS, TIMES, applyMove, termText, termBody, fracText, cloneLine, num } from './engine.js';

const wrapNeg = (f) => (f.n < 0 ? `(${fracText(f)})` : fracText(f));
const isInt = (f) => f.d === 1;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clone = (t) => (t.t === 'b' ? { t: 'b', p: t.p, in: t.in.map(clone) } : { t: t.t, v: t.v });

// A term of the same kind as t with a new number: the x-number of an x-term, the number in front of brackets.
function like(t, v) {
  if (t.t === 'b') return { t: 'b', p: v, in: t.in.map(clone) };
  return { t: t.t, v };
}
const valueOf = (t) => (t.t === 'b' ? t.p : t.v);
// A term written on its own, the way an answer is written: '9', '−9', 'x', '−3x', '3x/2', '−(x + 2)'; zero is '0'.
export function answerText(t) {
  if (valueOf(t).isZero()) return '0';
  return termText(t, true);
}
// a key that two answers share when they read the same ('+12' and '12')
const keyOf = (s) => s.replace(/^\+/, '');

// Four answers: the right one and three slips (fewer only when the numbers can't make three different ones).
// cands: [{ term, tag }] in the order they are wanted; extra: more terms to fall back on.
function choicesFor(right, cands, extra, rand) {
  const rightText = answerText(right);
  const seen = new Set([keyOf(rightText)]);
  const picked = [];
  const tryAdd = (term, tag) => {
    if (!term || picked.length >= 3) return;
    const v = valueOf(term);
    if (Math.abs(v.n) > 999 || v.d > 99) return;
    const text = answerText(term);
    if (seen.has(keyOf(text))) return;
    seen.add(keyOf(text));
    picked.push({ text, right: false, tag });
  };
  for (const c of cands) tryAdd(c.term, c.tag);
  for (const c of extra) tryAdd(c.term, c.tag);
  const choices = [{ text: rightText, right: true, tag: null }, ...picked];
  for (let i = choices.length - 1; i > 0; i--) { const k = Math.floor(rand() * (i + 1)); [choices[i], choices[k]] = [choices[k], choices[i]]; }
  return choices;
}

// The slips for a sum a + b (both the same kind of term).
function sumChoices(A, B, sum, rand, extraTerms = []) {
  const a = valueOf(A), b = valueOf(B), c = valueOf(sum);
  const mk = (v) => like(sum, F(v));
  const cands = [{ term: mk(a.sub(b)), tag: 'pm' }];
  if (!c.isZero()) cands.push({ term: mk(c.neg()), tag: 'sign' });
  const more = [];
  if (sum.t === 'x') more.push({ term: { t: 'n', v: c }, tag: 'nox' });
  if (a.sign() * b.sign() < 0) more.push({ term: mk(a.abs().add(b.abs())), tag: 'drop' });
  if (isInt(c)) more.push({ term: mk(c.add(F(rand() < 0.5 ? 1 : -1))), tag: 'off' });
  more.push({ term: clone(A), tag: 'one' });
  // the x answer always offers the dropped x (5x − 4x: x, 9x, 1, −x); the rest come in a random order
  const fixed = sum.t === 'x' ? more.filter((m) => m.tag === 'nox') : [];
  const rest = shuffle(more.filter((m) => !fixed.includes(m)), rand);
  const extra = [];
  if (isInt(c)) for (const d of [1, -1, 2, -2, 10, -10]) extra.push({ term: mk(c.add(F(d))), tag: 'off' });
  extraTerms.forEach((t) => extra.push({ term: t, tag: 'one' }));
  return choicesFor(sum, [...cands, ...fixed, ...rest], extra, rand);
}

// The slips for a term times f (f = 1/d for ÷d). move: the move pressed (its number is what the kid sees).
function scaleChoices(T, result, move, rand) {
  const v = valueOf(T), r = valueOf(result);
  const mk = (x) => like(result, F(x));
  const shown = move.k === 'flip' ? F(-1) : move.f;
  const cands = [];
  if (!r.isZero()) cands.push({ term: mk(r.neg()), tag: 'sign' });
  const more = [];
  if (move.k === 'div') {
    if (T.t !== 'b' && isInt(v) && isInt(shown)) more.push({ term: mk(v.sub(shown)), tag: 'pm' });
    more.push({ term: mk(v.mul(shown)), tag: 'swap' });
  } else if (move.k === 'mul') {
    if (T.t !== 'b' && isInt(v) && isInt(shown)) more.push({ term: mk(v.add(shown)), tag: 'pm' });
    if (!v.div(shown).eq(r)) more.push({ term: mk(v.div(shown)), tag: 'swap' });
  } else {
    if (isInt(v)) more.push({ term: mk(v.add(F(-1))), tag: 'pm' });
  }
  more.push({ term: clone(T), tag: 'one' });
  if (isInt(r)) more.push({ term: mk(r.add(F(rand() < 0.5 ? 1 : -1))), tag: 'off' });
  if (result.t === 'x') more.push({ term: { t: 'n', v: r }, tag: 'nox' });
  const extra = [];
  if (isInt(r)) for (const d of [1, -1, 2, -2, 3, -3]) extra.push({ term: mk(r.add(F(d))), tag: 'off' });
  else extra.push({ term: mk(r.mul(F(2))), tag: 'off' }, { term: mk(r.mul(F(1, 2))), tag: 'off' });
  return choicesFor(result, [...cands, ...shuffle(more, rand)], extra, rand);
}

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(rand() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; }
  return a;
}

// "5x", "− 4x": one token per term of a sum, the sign kept with the term it belongs to
function sumTokens(terms, idx) {
  return terms.map((t, i) => {
    if (i === 0) return { text: termText(t, true), from: idx[i] };
    const neg = valueOf(t).n < 0;
    return { text: `${neg ? MINUS : '+'} ${termBody(t)}`, from: idx[i] };
  });
}
const sumPrompt = (terms) => terms.map((t, i) => termText(t, i === 0)).join('');

// A whole-number sum of two numbers gets the number line as a picture.
const lineFor = (A, B) => (A.t === 'n' && B.t === 'n' && isInt(A.v) && isInt(B.v) ? { start: A.v.n, change: B.v.n } : null);

// The parts of one side (room). before: the side as it was; mid/out/ev: what applyMove made of it.
// room: the side's name ('L', 'R', or an inequality room id). rand: () -> 0..1
export function roomParts({ room, move, before, mid, out, ev, rand = Math.random }) {
  const autos = [], qs = [];
  if (!ev) return { autos, qs };
  if (move.k === 'add') {
    for (const e of ev) {
      if (e.kind === 'land') continue;
      const A = mid[e.a], B = mid[e.b];
      if (e.kind === 'zero') { autos.push({ room, kind: 'zero', at: [e.a, e.b], result: [], text: e.text }); continue; }
      // merging into a side that was 0 (0 + 6 = 6): nothing to work out
      if (A.t === 'n' && A.v.isZero()) { autos.push({ room, kind: 'plain', at: [e.a, e.b], result: [clone(B)], text: e.text }); continue; }
      const sum = out[e.to];
      qs.push({ room, kind: 'sum', at: [e.a, e.b], result: clone(sum), prompt: sumPrompt([A, B]), tokens: sumTokens([A, B], [e.a, e.b]),
        answer: answerText(sum), choices: sumChoices(A, B, sum, rand), line: lineFor(A, B), a: A, b: B, op: '+' });
    }
  } else if (move.k === 'div' || move.k === 'mul' || move.k === 'flip') {
    for (const e of ev) {
      const T = before[e.a];
      const made = out.slice(e.to, e.to + e.n);
      const f = move.k === 'flip' ? F(-1) : move.f;
      const sym = move.k === 'div' ? '÷' : TIMES;
      const prompt = `${termText(T, true)} ${sym} ${wrapNeg(f)}`;
      const text = `${prompt} = ${made.map((t, i) => termText(t, i === 0)).join('') || '0'}`;
      if (valueOf(T).isZero()) { autos.push({ room, kind: 'plain', at: [e.a], result: made.map(clone), text }); continue; }
      if (T.t === 'b' && made.length !== 1) { autos.push({ room, kind: 'open', at: [e.a], result: made.map(clone), text }); continue; }
      const res = made[0];
      if (res.t === 'x' && res.v.isOne()) { autos.push({ room, kind: 'free', at: [e.a], result: [clone(res)], text }); continue; }
      qs.push({ room, kind: 'scale', at: [e.a], result: clone(res), prompt,
        tokens: [{ text: termText(T, true), from: e.a }, { text: `${sym} ${wrapNeg(f)}`, from: move.k === 'div' ? 'den' : 'times' }],
        answer: answerText(res), choices: scaleChoices(T, res, move, rand), line: null, a: T, f, op: move.k });
    }
  } else if (move.k === 'comb') {
    for (const e of ev) {
      if (e.kind !== 'join') continue;
      const at = [];
      before.forEach((t, i) => { if (t.t === e.t) at.push(i); });
      const terms = at.map((i) => before[i]);
      const total = terms.reduce((s, t) => s.add(t.v), F(0));
      if (total.isZero()) { autos.push({ room, kind: 'zero', at, result: [], text: e.text }); continue; }
      const sum = { t: e.t, v: total };
      // with three or more, the "one" slip is the sum that left the last one out
      const short = terms.slice(0, -1).reduce((s, t) => s.add(t.v), F(0));
      const choices = terms.length === 2 ? sumChoices(terms[0], terms[1], sum, rand)
        : sumChoices({ t: e.t, v: short }, terms[terms.length - 1], sum, rand);
      qs.push({ room, kind: 'join', at, result: sum, prompt: sumPrompt(terms), tokens: sumTokens(terms, at), answer: answerText(sum),
        choices, line: terms.length === 2 ? lineFor(terms[0], terms[1]) : null, a: terms[0], b: terms[1], terms, op: '+' });
    }
  }
  return { autos, qs };
}

export function partsOf(l, move, { rng = null } = {}) {
  if (!move || move.k === 'dist') return null;
  const r = applyMove(l, move, true);
  if (!r) return null;
  const rand = rng ? rng.next : Math.random;
  const show = move.k === 'add' ? 'mid' : 'before';
  const shown = show === 'mid' ? r.mid : cloneLine(l);
  const autos = [], qs = [];
  for (const room of ['L', 'R']) {
    const p = roomParts({ room, move, before: l[room], mid: r.mid ? r.mid[room] : null, out: r.out[room], ev: r.ev[room], rand });
    autos.push(...p.autos);
    qs.push(...p.qs);
  }
  return { show, shown, out: r.out, mid: r.mid || null, ev: r.ev, move, autos, qs };
}

// The rooms the answers build, from the shown line: what the kid's answers put back together. It must be exactly the
// line the move makes (the tests check this on every rung).
export function assemble(parts, rooms = ['L', 'R']) {
  const res = {};
  for (const room of rooms) {
    const side = parts.shown[room].map(clone);
    const repl = new Map();   // index -> [terms]
    const gone = new Set();
    const put = (at, result) => { repl.set(at[0], result); at.slice(1).forEach((i) => gone.add(i)); };
    for (const a of parts.autos.filter((x) => x.room === room)) {
      if (a.kind === 'zero') a.at.forEach((i) => gone.add(i));
      else if (a.kind === 'plain' && parts.move.k === 'add') { repl.set(a.at[0], a.result); gone.add(a.at[1]); }
      else put(a.at, a.result);
    }
    for (const q of parts.qs.filter((x) => x.room === room)) put(q.at, [q.result]);
    let out = [];
    side.forEach((t, i) => {
      if (gone.has(i)) return;
      if (repl.has(i)) out.push(...repl.get(i).map(clone));
      else out.push(t);
    });
    if (!out.length) out = [num(0)];
    res[room] = out;
  }
  return res;
}

// ---------- Hob's lines ----------

const n = (f) => fracText(f);
const absTxt = (f) => fracText(f.abs());
const signRule = (a, b, op) => {
  const word = op === 'div' ? '÷' : 'times';
  if (a.n < 0 && b.n < 0) return `minus ${word} minus makes plus`;
  if (a.n < 0 || b.n < 0) return `minus ${word} plus makes minus`;
  return `plus ${word} plus stays plus`;
};
const xs = (f) => `${absTxt(f)} x’s`;

export function partNudge(q, c) {
  if (!c || c.right) return '';
  if (q.kind === 'sum' || q.kind === 'join') {
    const A = q.a, B = q.kind === 'join' && q.terms.length > 2 ? null : q.b;
    if (q.a.t === 'x' || q.a.t === 'b') {
      if (c.tag === 'nox') return 'Keep the x: x’s and x’s make x’s.';
      if (!B) return 'Add the x’s up one at a time.';
      if (c.tag === 'pm' || c.tag === 'one') return `${cap(xs(A.v))} ${B.v.n < 0 ? 'take away' : 'and'} ${xs(B.v)}.`;
      if (c.tag === 'sign') return 'Mind the sign: are there more plus x’s or more minus x’s?';
      return `Count the x’s again: ${q.prompt}.`;
    }
    if (!B) return 'Add them up one at a time.';
    const a = A.v, b = B.v;
    const hop = `Start at ${n(a)} and go ${b.n < 0 ? 'down' : 'up'} ${absTxt(b)}.`;
    if (c.tag === 'pm') return `${b.n < 0 ? 'Taking away' : 'Adding'} ${absTxt(b)} goes ${b.n < 0 ? 'down' : 'up'} the line. ${hop}`;
    if (c.tag === 'drop') return `Keep the signs: ${a.n < 0 ? `${n(a)} is below zero` : `the ${MINUS}${absTxt(b)} takes away`}. ${hop}`;
    if (c.tag === 'sign') return `Mind the sign: does it land above zero or below? ${hop}`;
    if (c.tag === 'one') return `Use both numbers. ${hop}`;
    return `Close! ${hop}`;
  }
  if (q.kind === 'scale') {
    const v = valueOf(q.a), f = q.f;
    if (q.op === 'flip') return `${TIMES}(${MINUS}1) turns the sign over: plus becomes minus, minus becomes plus.`;
    if (c.tag === 'sign') return `Mind the sign: ${signRule(v, f, q.op)}.`;
    if (c.tag === 'one') return `Every term gets the ${q.op === 'div' ? '÷' : TIMES}${wrapNeg(f)}, this one too.`;
    if (c.tag === 'nox') return 'Keep the x: only the number in front changes.';
    if (q.op === 'div') {
      if (c.tag === 'pm') return `Divide, don’t take away: how many ${absTxt(f)}s make ${absTxt(v)}?`;
      if (c.tag === 'swap') return `Divide, don’t multiply: how many ${absTxt(f)}s make ${absTxt(v)}?`;
      return `How many ${absTxt(f)}s make ${absTxt(v)}? Count again.`;
    }
    if (c.tag === 'pm') return `Times, not plus: ${absTxt(f)} lots of ${absTxt(v)}.`;
    if (c.tag === 'swap') return 'Multiply, don’t divide.';
    return `Count again: ${absTxt(f)} lots of ${absTxt(v)}.`;
  }
  return 'Try again.';
}

export function partHelp(q) {
  if (q.kind === 'sum' || q.kind === 'join') {
    if (q.kind === 'join' && q.terms.length > 2) return 'Add them up one at a time, left to right.';
    const a = q.a.t === 'b' ? q.a.p : q.a.v, b = q.b.t === 'b' ? q.b.p : q.b.v;
    if (q.a.t !== 'n') return `${cap(xs(a))} ${b.n < 0 ? 'take away' : 'and'} ${xs(b)}${a.n < 0 ? ` (the first ${absTxt(a)} are minus)` : ''}.`;
    const toZero = a.n !== 0 && Math.sign(a.n) !== Math.sign(b.n) && Math.abs(b.n) > Math.abs(a.n);
    return `Start at ${n(a)} and go ${b.n < 0 ? 'down' : 'up'} ${absTxt(b)}${toZero ? `: ${absTxt(a)} gets you to zero, then the rest` : ''}.`;
  }
  if (q.kind === 'scale') {
    const v = valueOf(q.a), f = q.f;
    if (q.op === 'flip') return `${TIMES}(${MINUS}1) only turns the sign over.`;
    const neg = v.n < 0 || f.n < 0;
    const sign = neg ? ` Then the sign: ${signRule(v, f, q.op)}.` : '';
    if (q.op === 'div') {
      const d = Math.abs(f.n);
      const count = isInt(f) && isInt(v) && d > 1 && Math.abs(v.n) > d ? ` Count up in ${d}s: ${d}, ${2 * d}, ${3 * d} …` : '';
      return `How many ${absTxt(f)}s make ${absTxt(v)}?${count}${sign}`;
    }
    return `${cap(absTxt(f))} lots of ${absTxt(v)}.${sign}`;
  }
  return 'Work it out one piece at a time.';
}

// The slip tags the ladder counts for adding (algebra.js ARITH_TAGS), from a wrong pick on a sum of two numbers.
export const ARITH_OF = { pm: 'sign', sign: 'flip', drop: 'drop', one: 'oneside' };
