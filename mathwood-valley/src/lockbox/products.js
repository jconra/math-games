// Opening the brackets by hand: the kid works out each product.
//
// When "Open brackets" is pressed, the panel draws a line from the number outside the brackets to each term inside,
// writes "5 · x" and "5 · 8" under them, and asks one product at a time with four answers in the tray:
//   5 · x = ?        5x, 5 + x, 6x, x
//   5 · 8 = ?        40, 13, 58, 45
//   −3 · (−4) = ?    +12, −12, −7, +15
// A right pick fills that product in; a wrong one shakes and Hob gives a one-line nudge, and the right answer stays to
// pick. Once every product is in, the line becomes 5x + 40 exactly as the move would make it (engine.js distSide).
//
// Nothing here touches the page, so the node tests can check it.
//
//   bracketProducts(line, { rng }) -> [{ side, index, j, p, term, product, prompt, under, answer, choices }]
//     one question per term inside each bracket, left side first, in the order they are written.
//     choices: [{ text, right, tag }], four of them (fewer only if the numbers can't make four different ones),
//     shuffled. tag says which slip a wrong one is: 'sign' | 'sum' | 'joined' | 'lot' | 'forgot'.
//   productNudge(question, choice) -> Hob's one line after a wrong pick.

import { F, MINUS, TIMES, termBody, fracText } from './engine.js';

// The answer as written in the tray and under the term: '5x', '−3x', '40', '+12' (a + only when a minus was in the
// product, so "minus times minus" shows its plus).
function show(t, plus) {
  const neg = t.v.n < 0;
  return (neg ? MINUS : plus ? '+' : '') + termBody(t);
}

// a factor as it is spoken in the prompt: 5, −3, (−4), x, −x, 3x
function factorText(t, inner) {
  if (t.t === 'n') return inner && t.v.n < 0 ? `(${fracText(t.v)})` : fracText(t.v);
  const body = termBody(t);
  if (t.v.n < 0) return inner ? `(${MINUS}${body})` : `${MINUS}${body}`;
  return body;
}

export function bracketProducts(l, { rng = null } = {}) {
  const rand = rng ? rng.next : Math.random;
  const out = [];
  for (const side of ['L', 'R']) {
    l[side].forEach((t, index) => {
      if (t.t !== 'b' || t.p.d > 1) return;   // (a group over a number is cleared by multiplying, not opened)
      t.in.forEach((u, j) => {
        const product = { t: u.t, v: u.v.mul(t.p) };
        const negIn = t.p.n < 0 || u.v.n < 0;
        const pText = fracText(t.p);
        const prompt = `${pText} ${TIMES} ${factorText(u, true)}`;
        const plus = negIn && j > 0;
        const answer = show(product, plus);
        // the slips, most telling first: the sign (whenever a minus is in it), adding instead of multiplying, the
        // digits side by side, one lot too many, and forgetting to multiply at all
        const wrong = [];
        const mk = (v, tag) => { if (!F(v).isZero()) wrong.push({ text: show({ t: u.t, v: F(v) }, plus), tag }); };
        const pv = t.p, uv = u.v;
        if (negIn) mk(product.v.neg(), 'sign');
        if (u.t === 'x') {
          // 5 + x written out, then (5 + 1)x, then plain x
          const a = uv.isOne() ? 'x' : uv.eq(F(-1)) ? `${MINUS}x` : `${fracText(uv)}x`;
          wrong.push({ text: `${pText} + ${a}`.replace(`+ ${MINUS}`, `${MINUS} `), tag: 'sum' });
          mk(pv.add(uv), 'sum');
          mk(uv, 'forgot');
          if (!negIn && pv.isInt() && uv.isOne()) wrong.push({ text: `x${pText}`, tag: 'joined' });
        } else {
          mk(pv.add(uv), 'sum');
          if (!negIn && pv.isInt() && uv.isInt()) wrong.push({ text: `${pv.n}${uv.n}`, tag: 'joined' });
          // one lot too many: 5 · 9 for 5 · 8 (the sign kept)
          const lot = uv.add(F(uv.n < 0 ? -1 : 1)).mul(pv);
          mk(lot, 'lot');
          mk(uv, 'forgot');
        }
        const seen = new Set([answer.replace(/^\+/, '')]);
        const picked = [];
        for (const w of wrong) {
          const k = w.text.replace(/^\+/, '');
          if (seen.has(k) || picked.length >= 3) continue;
          seen.add(k);
          picked.push(w);
        }
        const choices = [{ text: answer, right: true, tag: null }, ...picked.map((w) => ({ text: w.text, right: false, tag: w.tag }))];
        for (let i = choices.length - 1; i > 0; i--) { const k = Math.floor(rand() * (i + 1)); [choices[i], choices[k]] = [choices[k], choices[i]]; }
        out.push({ side, index, j, p: t.p, term: u, product, prompt, under: `${pText}${TIMES}${factorText(u, true)}`, answer, choices });
      });
    });
  }
  return out;
}

// Hob's nudge after a wrong pick: never the answer itself, just what to think about.
export function productNudge(q, c) {
  const p = q.p, u = q.term;
  const lots = `${fracText(p.abs())} ${p.abs().isOne() ? 'lot' : 'lots'} of ${u.t === 'x' ? (u.v.abs().isOne() ? 'x' : `${termBody(u)}`) : fracText(u.v.abs())}`;
  const signRule = (p.n < 0) === (u.v.n < 0) ? 'minus times minus makes plus' : 'minus times plus makes minus';
  const anyNeg = p.n < 0 || u.v.n < 0;
  if (c.tag === 'sign') return `Mind the sign: ${signRule}.`;
  if (anyNeg) return `${cap(lots)}, then the sign: ${signRule}.`;
  if (c.tag === 'sum') return `Times, not plus: ${lots}.`;
  if (c.tag === 'joined') return `Multiply them: ${lots}.`;
  if (c.tag === 'forgot') return `The ${fracText(p)} multiplies everything inside: ${lots}.`;
  return `Count again: ${lots}.`;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Hob's help while a product is being asked (Ask Hob): the lots spelled out for small whole numbers.
// 5 · 8 -> "5 lots of 8: 8 + 8 + 8 + 8 + 8."   −3 · (−4) -> "3 lots of 4, then the sign: minus times minus makes plus."
export function productHelp(q) {
  const p = q.p, u = q.term;
  const anyNeg = p.n < 0 || u.v.n < 0;
  const what = u.t === 'x' ? termBody({ t: 'x', v: u.v.abs() }) : fracText(u.v.abs());
  const n = Math.abs(p.n);
  const lots = `${fracText(p.abs())} ${n === 1 && p.d === 1 ? 'lot' : 'lots'} of ${what}`;
  if (anyNeg) return `${cap(lots)}, then the sign: ${(p.n < 0) === (u.v.n < 0) ? 'minus times minus makes plus' : 'minus times plus makes minus'}.`;
  if (p.d === 1 && n >= 2 && n <= 5) return `${cap(lots)}: ${Array(n).fill(what).join(' + ')}.`;
  return `${cap(lots)}.`;
}
