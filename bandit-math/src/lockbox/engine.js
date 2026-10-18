// The equation engine for the lock boxes.
//
// It holds:
//   - Frac: exact fractions (whole-number top and bottom, always reduced), so 1/3 never turns into 0.333.
//   - Equations that remember the order their terms were written in, so a line like 4x − 6 + 6 = −8x + 18 + 6 can be
//     shown for a beat before it tidies itself into 4x = −8x + 24.
//   - The moves the buttons make: add or take away a number or an x-term on both sides, multiply or divide both sides,
//     flip every sign (times −1), open brackets, and combine like terms.
//   - A search that finds the fewest moves left to reach x = N (the "par" when asked at the start), trying every move
//     the current rung allows, not only the buttons on screen.
//
// Nothing here touches the page, so the node tests can load it directly.

export const MINUS = '−';   // the real minus sign: wider than a hyphen and lines up with +
export const TIMES = '·';   // the school dot for "times"; never a cross that looks like x

// ---------- exact fractions ----------

export function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}

export class Frac {
  constructor(n, d = 1) {
    if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error(`Frac needs whole numbers, got ${n}/${d}`);
    if (d === 0) throw new Error('Frac with a zero bottom');
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1;
    this.n = n / g + 0;   // "+ 0" turns -0 into 0
    this.d = n === 0 ? 1 : d / g;
  }
  add(o) { return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Frac(this.n * o.n, this.d * o.d); }
  div(o) { if (o.n === 0) throw new Error('divide by zero'); return new Frac(this.n * o.d, this.d * o.n); }
  neg() { return new Frac(-this.n, this.d); }
  abs() { return new Frac(Math.abs(this.n), this.d); }
  eq(o) { return this.n === o.n && this.d === o.d; }
  isZero() { return this.n === 0; }
  isOne() { return this.n === 1 && this.d === 1; }
  isInt() { return this.d === 1; }
  sign() { return Math.sign(this.n); }
  valueOf() { return this.n / this.d; }
  toString() { return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`; }
}

export const F = (n, d = 1) => (n instanceof Frac ? n : new Frac(n, d));
const ONE = F(1);
const NEG1 = F(-1);

// ---------- terms, sides and lines ----------
// A term is one of:
//   { t: 'n', v: Frac }                 a plain number
//   { t: 'x', v: Frac }                 an x-term; v is the number stuck to x (3 for 3x, 1/4 for x/4)
//   { t: 'b', p: Frac, in: [terms] }    brackets: p(…), for example 3(x + 2); with p = 1/2 it is the whole
//                                       group over a number, (5x − 10)/2 (an "over" term: a fraction bar)
// A side is an array of terms in the order they are written. A line is { L: side, R: side }.

export const num = (v) => ({ t: 'n', v: F(v) });
export const xt = (v) => ({ t: 'x', v: F(v) });
export const br = (p, inner) => ({ t: 'b', p: F(p), in: inner });
export const line = (L, R) => ({ L, R });

function cloneTerm(t) {
  if (t.t === 'b') return { t: 'b', p: t.p, in: t.in.map(cloneTerm) };
  return t.t === 'q' ? { t: 'q' } : { t: t.t, v: t.v };
}
export function cloneLine(l) { return { L: l.L.map(cloneTerm), R: l.R.map(cloneTerm) }; }

// ---------- writing terms the way school does ----------

function fracBody(f) { return f.d === 1 ? `${Math.abs(f.n)}` : `${Math.abs(f.n)}/${f.d}`; }

// The term without its leading sign: '6', 'x', '4x', 'x/4', '3x/4', '3(x + 2)'.
export function termBody(t) {
  if (t.t === 'q') return '?';   // the blank coin on the warm-up rung (7 + 5 = ? + 8)
  if (t.t === 'n') return fracBody(t.v);
  if (t.t === 'x') {
    const a = Math.abs(t.v.n), d = t.v.d;
    const top = a === 1 ? 'x' : `${a}x`;
    return d === 1 ? top : `${top}/${d}`;
  }
  const inner = `(${sideText(t.in)})`;
  // a whole side over a number, (5x − 10)/2, is a bracket whose number is a fraction (1/2)
  if (t.p.d > 1) return `${Math.abs(t.p.n) === 1 ? '' : Math.abs(t.p.n)}${inner}/${t.p.d}`;
  return t.p.abs().isOne() ? inner : `${fracBody(t.p)}${inner}`;
}

// True when the term is written with a minus in front of it.
export function termNeg(t) { return t.t === 'q' ? false : (t.t === 'b' ? t.p : t.v).n < 0; }

export function termText(t, first) {
  const neg = termNeg(t);
  if (first) return (neg ? MINUS : '') + termBody(t);
  return (neg ? ` ${MINUS} ` : ' + ') + termBody(t);
}

export function sideText(side) {
  if (!side.length) return '0';
  return side.map((t, i) => termText(t, i === 0)).join('');
}

export function lineText(l) { return `${sideText(l.L)} = ${sideText(l.R)}`; }

// A signed number as plain text: '6', '−6', '3/4'.
export function fracText(f) { return (f.n < 0 ? MINUS : '') + fracBody(f); }

// ---------- a key that ignores the order of terms (for the search and the caches) ----------

// (The search builds hundreds of thousands of these, so they are kept cheap.)
const fracKey = (f) => (f.d === 1 ? String(f.n) : f.n + '/' + f.d);
function termKey(t) {
  if (t.t === 'n' || t.t === 'x') return t.t + fracKey(t.v);
  if (t.t === 'q') return 'q';
  return 'b' + fracKey(t.p) + '(' + sideKey(t.in) + ')';
}
export function sideKey(side) {
  if (side.length === 1) return termKey(side[0]);
  const ks = side.map(termKey);
  ks.sort();
  return ks.join(',');
}
export function lineKey(l) { return sideKey(l.L) + '=' + sideKey(l.R); }

// ---------- moves ----------
// A move is one of:
//   { k: 'add', term }       add this number or x-term to both sides (a negative one takes away)
//   { k: 'mul', f }          multiply both sides by f
//   { k: 'div', f }          divide both sides by f
//   { k: 'flip' }            multiply both sides by −1 (every chip flips over, like a coin)
//   { k: 'dist' }            open the brackets: 3(x + 2) becomes 3x + 6
//   { k: 'comb' }            combine like terms on each side: 3x + 2 + 2x becomes 5x + 2

export const addNum = (v) => ({ k: 'add', term: num(v) });
export const addX = (v) => ({ k: 'add', term: xt(v) });
export const mulBy = (v) => ({ k: 'mul', f: F(v) });
export const divBy = (v) => ({ k: 'div', f: F(v) });
export const FLIP = { k: 'flip' };
export const DIST = { k: 'dist' };
export const COMB = { k: 'comb' };

function wrapNeg(f) { return f.n < 0 ? `(${fracText(f)})` : fracText(f); }

// What the button says: '+6', '−6', '+8x', '·3', '÷(−4)', '·(−1)'.
export function moveLabel(m) {
  if (m.k === 'add') return (termNeg(m.term) ? MINUS : '+') + termBody(m.term);
  if (m.k === 'mul') return TIMES + wrapNeg(m.f);
  if (m.k === 'div') return '÷' + wrapNeg(m.f);
  if (m.k === 'flip') return `${TIMES}(${MINUS}1)`;
  if (m.k === 'dist') return 'Open brackets';
  if (m.k === 'comb') return 'Combine like terms';
  return '?';
}

// A short id for a move, used for tests and the rig ("add:x:-8", "div:12").
export function moveId(m) {
  if (m.k === 'add') return `add:${m.term.t}:${m.term.v}`;
  if (m.k === 'mul' || m.k === 'div') return `${m.k}:${m.f}`;
  return m.k;
}

// What the margin note says: '+6 both sides', '÷12 both sides'.
export function moveNote(m) {
  if (m.k === 'dist') return 'opened the brackets';
  if (m.k === 'comb') return 'combined like terms';
  if (m.k === 'flip') return `${TIMES}(${MINUS}1) both sides`;
  return `${moveLabel(m)} both sides`;
}

// "a + b = c" written out: '−6 + 6 = 0', '18 + 6 = 24', '−8x − 4x = −12x'.
function sumText(terms, result) {
  const left = terms.map((t, i) => termText(t, i === 0)).join('');
  return `${left} = ${result ? termText(result, true) : '0'}`;
}

function isZeroSide(side) { return side.length === 1 && side[0].t === 'n' && side[0].v.isZero(); }

// Add one term to one side, then let it meet its partner: a zero pair vanishes, a like term merges.
// Returns { mid, out, ev } where mid is the side with the new term on the end (shown for one beat).
function addToSide(side, term, events) {
  const mid = [...side.map(cloneTerm), cloneTerm(term)];
  const bi = mid.length - 1;
  if (isZeroSide(side)) {
    const out = [cloneTerm(term)];
    if (events) events.push({ kind: 'merge', a: 0, b: bi, to: 0, text: sumText([side[0], term], term) });
    return { mid, out };
  }
  // The partner: a zero pair if there is one; otherwise the like term, but only when there is exactly one
  // (with two or more like terms already there, the new one waits for "combine like terms"). This rule never looks
  // at the order of the terms, so two lines with the same terms always behave the same.
  let partner = -1, likes = 0, lastLike = -1;
  for (let i = side.length - 1; i >= 0; i--) {
    const s = side[i];
    if (s.t !== term.t) continue;
    likes++;
    if (lastLike < 0) lastLike = i;
    if (partner < 0 && s.v.add(term.v).isZero()) partner = i;
  }
  if (partner < 0 && likes === 1) partner = lastLike;
  if (partner < 0) {
    if (events) events.push({ kind: 'land', b: bi, to: side.length });
    return { mid, out: mid.map(cloneTerm) };
  }
  const s = side[partner];
  const sum = s.v.add(term.v);
  if (sum.isZero()) {
    let out = side.filter((_, i) => i !== partner).map(cloneTerm);
    if (!out.length) out = [num(0)];
    if (events) events.push({ kind: 'zero', a: partner, b: bi, to: -1, text: sumText([s, term], null) });
    return { mid, out };
  }
  const out = side.map(cloneTerm);
  out[partner] = { t: term.t, v: sum };
  if (events) events.push({ kind: 'merge', a: partner, b: bi, to: partner, text: sumText([s, term], out[partner]) });
  return { mid, out };
}

// Multiply every term on a side by f. Brackets keep their inside and change the number in front;
// a bracket whose number becomes 1 opens up on its own: 3(x + 2) ÷ 3 = x + 2.
function scaleSide(side, f, events) {
  const out = [];
  side.forEach((t, i) => {
    if (t.t === 'b') {
      const p = t.p.mul(f);
      const from = out.length;
      if (p.isOne()) t.in.forEach((u) => out.push(cloneTerm(u)));
      else out.push({ t: 'b', p, in: t.in.map(cloneTerm) });
      if (events) events.push({ kind: 'scale', a: i, to: from, n: out.length - from });
    } else {
      out.push({ t: t.t, v: t.v.mul(f) });
      if (events) events.push({ kind: 'scale', a: i, to: out.length - 1, n: 1 });
    }
  });
  return out;
}

function distSide(side, events) {
  const out = [];
  side.forEach((t, i) => {
    if (t.t !== 'b') { out.push(cloneTerm(t)); return; }
    const from = out.length;
    const made = t.in.map((u) => ({ t: u.t, v: u.v.mul(t.p) }));
    made.forEach((u) => out.push(u));
    if (events) {
      const spelled = t.in.map((u, j) => {
        const sign = j === 0 ? (t.p.n < 0 ? MINUS : '') : ' + ';
        return `${sign}${fracBody(t.p)}${TIMES}${u.v.n < 0 ? `(${termText(u, true)})` : termBody(u)}`;
      }).join('');
      events.push({ kind: 'expand', a: i, to: from, n: made.length,
        text: `${termText(t, true)} = ${spelled} = ${made.map((u, j) => termText(u, j === 0)).join('')}` });
    }
  });
  return out;
}

function combSide(side, events) {
  const out = [];
  const where = { n: -1, x: -1 };
  const groups = { n: [], x: [] };
  side.forEach((t) => {
    if (t.t === 'b') { out.push(cloneTerm(t)); return; }
    groups[t.t].push(t);
    if (where[t.t] < 0) { where[t.t] = out.length; out.push(cloneTerm(t)); }
    else out[where[t.t]] = { t: t.t, v: out[where[t.t]].v.add(t.v) };
  });
  const keep = out.filter((t) => t.t === 'b' || !t.v.isZero());
  if (events) {
    for (const k of ['x', 'n']) {
      if (groups[k].length < 2) continue;
      const res = out[where[k]];
      // vals: the numbers joined, when they are whole (the panel draws a number line for −10 + 18)
      const vals = groups[k].every((t) => t.v.isInt()) ? groups[k].map((t) => t.v.n) : null;
      events.push({ kind: 'join', t: k, vals, text: sumText(groups[k], res.v.isZero() ? null : res) });
    }
  }
  return keep.length ? keep : [num(0)];
}

export function hasBracket(l) { return l.L.some((t) => t.t === 'b') || l.R.some((t) => t.t === 'b'); }
// A group over a number, (5x − 10)/2: a bracket whose number has a bottom.
export const isOver = (t) => t.t === 'b' && t.p.d > 1;
export function hasOver(l) { return l.L.some(isOver) || l.R.some(isOver); }
function sideHasLike(side) {
  let n = 0, x = 0;
  for (const t of side) { if (t.t === 'n') n++; else if (t.t === 'x') x++; }
  return n > 1 || x > 1;
}
export function hasLike(l) { return sideHasLike(l.L) || sideHasLike(l.R); }

// Apply a move. With withEvents, also say what happened to each chip so the panel can animate it.
// Returns { out, mid, ev: { L: [...], R: [...] } } (mid only for adds), or null when the move cannot be made.
export function applyMove(l, m, withEvents = false) {
  const evL = withEvents ? [] : null, evR = withEvents ? [] : null;
  if (m.k === 'add') {
    const a = addToSide(l.L, m.term, evL), b = addToSide(l.R, m.term, evR);
    return { out: { L: a.out, R: b.out }, mid: { L: a.mid, R: b.mid }, ev: { L: evL, R: evR } };
  }
  if (m.k === 'mul' || m.k === 'div' || m.k === 'flip') {
    const f = m.k === 'flip' ? NEG1 : m.k === 'mul' ? m.f : ONE.div(m.f);
    if (f.isZero()) return null;
    return { out: { L: scaleSide(l.L, f, evL), R: scaleSide(l.R, f, evR) }, ev: { L: evL, R: evR } };
  }
  if (m.k === 'dist') {
    if (!hasBracket(l)) return null;
    return { out: { L: distSide(l.L, evL), R: distSide(l.R, evR) }, ev: { L: evL, R: evR } };
  }
  if (m.k === 'comb') {
    if (!hasLike(l)) return null;
    return { out: { L: combSide(l.L, evL), R: combSide(l.R, evR) }, ev: { L: evL, R: evR } };
  }
  return null;
}

// ---------- is it solved? ----------

// The value of x when the line reads x = N or N = x; otherwise null. −x = 7 is NOT solved.
export function solvedValue(l) {
  const one = (a, b) => (a.length === 1 && b.length === 1 && a[0].t === 'x' && a[0].v.isOne() && b[0].t === 'n'
    ? b[0].v : null);
  return one(l.L, l.R) ?? one(l.R, l.L);
}
export function isSolved(l) { return solvedValue(l) !== null; }

// −x = 7 (or 7 = −x): "the opposite of x is 7".
export function isOppositeOfX(l) {
  const one = (a, b) => a.length === 1 && b.length === 1 && a[0].t === 'x' && a[0].v.eq(NEG1) && b[0].t === 'n';
  return one(l.L, l.R) || one(l.R, l.L);
}

// Which side x lives on: 'L', 'R', 'both' or 'none'.
export function xSide(l) {
  const has = (s) => s.some((t) => t.t === 'x' || (t.t === 'b' && t.in.some((u) => u.t === 'x')));
  const a = has(l.L), b = has(l.R);
  return a && b ? 'both' : a ? 'L' : b ? 'R' : 'none';
}

// ---------- working out a side for a given x (the check, after x stands alone) ----------

export function evalTerm(t, x) {
  if (t.t === 'q') return F(x);   // the blank coin takes the value being tried
  if (t.t === 'n') return t.v;
  if (t.t === 'x') return t.v.mul(x);
  return t.p.mul(t.in.reduce((s, u) => s.add(evalTerm(u, x)), F(0)));
}
export function evalSide(side, x) { return side.reduce((s, t) => s.add(evalTerm(t, x)), F(0)); }

// The steps a teacher writes when checking a key: 4·2 − 6 → 8 − 6 → 2.
// Returns an array of strings; the last one is the value of the side.
export function keySteps(side, x) {
  x = F(x);
  const xs = x.n < 0 || !x.isInt() ? `(${fracText(x)})` : fracText(x);
  const join = (parts) => parts.map(([neg, body], i) => (i === 0 ? (neg ? MINUS : '') : neg ? ` ${MINUS} ` : ' + ') + body).join('');
  // An x-term with the key put in: 4·2, (−3), 2·5/3. A lone x at the very front of a group with no minus of its own
  // needs no brackets around a negative key: −1 − 3, not (−1) − 3.
  const subX = (t, lead) => {
    const a = t.v.abs();
    const k = lead && !termNeg(t) ? fracText(x) : xs;
    if (a.d === 1) return a.isOne() ? k : `${a.n}${TIMES}${xs}`;
    return a.n === 1 ? `${k}/${a.d}` : `${a.n}${TIMES}${xs}/${a.d}`;
  };
  const front = (t) => (t.p.abs().isOne() || t.p.d > 1 ? '' : `${fracBody(t.p)}`);
  const over = (t, inner) => (t.p.d > 1 ? `(${inner})/${t.p.d}` : `${front(t)}(${inner})`);
  const steps = [];
  const push = (s) => { if (s !== steps[steps.length - 1]) steps.push(s); };
  // 1: x replaced by the key
  push(join(side.map((t, i) => {
    if (t.t === 'q') return [x.n < 0, fracBody(x)];
    if (t.t === 'n') return [termNeg(t), termBody(t)];
    if (t.t === 'x') return [termNeg(t), subX(t, i === 0)];
    const inner = join(t.in.map((u, j) => [termNeg(u), u.t === 'x' ? subX(u, j === 0) : termBody(u)]));
    return [termNeg(t), over(t, inner)];
  })));
  // 2: brackets worked out inside: 2(5 + 3) -> 2·8
  if (side.some((t) => t.t === 'b')) {
    push(join(side.map((t, i) => {
      if (t.t === 'q') return [x.n < 0, fracBody(x)];
      if (t.t === 'n') return [termNeg(t), termBody(t)];
      if (t.t === 'x') return [termNeg(t), subX(t, i === 0)];
      const inside = t.in.reduce((s, u) => s.add(evalTerm(u, x)), F(0));
      const insideText = inside.n < 0 ? `(${fracText(inside)})` : fracText(inside);
      if (t.p.d > 1) return [termNeg(t), `${insideText}/${t.p.d}`];
      return [termNeg(t), front(t) ? `${front(t)}${TIMES}${insideText}` : insideText];
    })));
  }
  // 3: every term worked out on its own
  push(join(side.map((t) => { const v = evalTerm(t, x); return [v.n < 0, fracBody(v)]; })));
  // 4: the total
  push(fracText(evalSide(side, x)));
  return steps;
}

// ---------- the rules a rung plays by ----------
// A stage says which moves exist on this rung and which lines are allowed:
//   { id, add, addx, mul, div, flip, dist, comb, sign: 'plus'|'sub'|'any', frac, max, maxTerms }
//   sign 'plus': no minus anywhere; 'sub': taking away is fine but no number stands alone as negative
//   frac: x-terms may be fractions like x/4 (plain numbers stay whole either way)
//   over: a whole group may sit over a number, (5x − 10)/2

export function makeStage(o) {
  const st = { add: true, addx: false, mul: false, div: false, flip: false, dist: false, comb: false,
    sign: 'any', frac: false, over: false, max: 99, maxTerms: 5, ...o };
  st.id = st.id || ['add', 'addx', 'mul', 'div', 'flip', 'dist', 'comb'].filter((k) => st[k]).join('+')
    + `|${st.sign}|${st.frac ? 'f' : ''}${st.over ? 'o' : ''}|${st.max}|${st.maxTerms}`;
  return st;
}

function fracFits(v, st, kind) {
  if (Math.abs(v.n) > st.max || v.d > st.max) return false;
  if (v.d !== 1 && !(st.frac && kind === 'x')) return false;
  return true;
}

function termFits(t, st) {
  if (t.t === 'b') {
    // (a group over a number, (5x − 10)/2, only on the rungs that have it: one over a whole number)
    const pOk = t.p.isInt() ? fracFits(t.p, st, 'p') : st.over && Math.abs(t.p.n) === 1 && t.p.d <= st.max;
    return pOk && t.in.every((u) => termFits(u, st));
  }
  return fracFits(t.v, st, t.t);
}

function sideFits(side, st) {
  let count = 0;
  for (let i = 0; i < side.length; i++) {
    const t = side[i];
    if (!termFits(t, st)) return false;
    count += t.t === 'b' ? t.in.length : 1;
    if (st.sign !== 'any') {
      const neg = termNeg(t);
      if (st.sign === 'plus' && neg) return false;
      if (st.sign === 'sub' && neg && (i === 0 || t.t !== 'n')) return false;   // "− 3" yes, "−3 = …" or "−2x" no
      if (t.t === 'b' && t.in.some((u, j) => termNeg(u) && (j === 0 || st.sign === 'plus'))) return false;
    }
  }
  return count <= st.maxTerms;
}

export function lineFits(l, st) { return sideFits(l.L, st) && sideFits(l.R, st); }

// ---------- every move the stage allows from a line ----------
// Built from the numbers on the line, their opposites, the numbers stuck to x and the bottoms of fractions.
// This covers the cancelling moves and all the classic slips (wrong sign, wrong undo, part of the number).

function divisorsOver1(m) {
  const out = [];
  for (let k = 2; k <= m; k++) if (m % k === 0) out.push(k);
  return out;
}

export function candidateMoves(l, st) {
  const consts = new Set(), coefs = new Set(), dens = new Set(), mults = new Set();
  let bracket = false;
  const walk = (t) => {
    if (t.t === 'n') { if (t.v.isInt() && t.v.n) consts.add(Math.abs(t.v.n)); }
    else if (t.t === 'x') { coefs.add(Math.abs(t.v.n)); if (t.v.d > 1) dens.add(t.v.d); }
    else { bracket = true; if (t.p.isInt()) mults.add(Math.abs(t.p.n)); else dens.add(t.p.d); t.in.forEach(walk); }
  };
  l.L.forEach(walk); l.R.forEach(walk);
  const moves = [];
  const signs = st.sign === 'any' ? [1, -1] : [1];
  if (st.add) {
    const s = new Set([...consts, ...coefs, ...mults]);
    for (const m of [...s].sort((a, b) => a - b)) { moves.push(addNum(-m)); moves.push(addNum(m)); }
  }
  if (st.addx) {
    for (const m of [...coefs].sort((a, b) => a - b)) {
      for (const d of [1, ...dens]) { moves.push(addX(F(-m, d))); moves.push(addX(F(m, d))); }
    }
  }
  if (st.mul) {
    const s = new Set([...dens, ...coefs, ...mults]);
    for (const m of [...s].sort((a, b) => a - b)) if (m > 1) for (const g of signs) moves.push(mulBy(g * m));
  }
  if (st.div) {
    const s = new Set();
    for (const m of [...coefs, ...mults]) divisorsOver1(m).forEach((k) => s.add(k));
    for (const m of consts) if (m > 1) s.add(m);
    for (const m of dens) if (bracket) s.add(m);   // ÷2 on (5x − 10)/2: the wrong way to undo it
    for (const m of [...s].sort((a, b) => a - b)) for (const g of signs) moves.push(divBy(g * m));
  }
  if (st.flip) moves.push(FLIP);
  if (st.dist && bracket) moves.push(DIST);
  if (st.comb && hasLike(l)) moves.push(COMB);
  return moves;
}

// The legal moves: candidates whose result changes the line and still fits the stage.
// Returns [{ move, out, key }]. Two moves with the same effect keep only the first.
export function legalMoves(l, st) { return legalFrom(l, st, candidateMoves(l, st)); }

// ---------- the search: fewest moves left ----------
// A layer-by-layer search from the line (each layer is one more move) until some line reaches the goal (x = N or
// N = x; on the vault rung, a verdict). It remembers which first moves start a shortest route, so one search tells the
// panel every "closer" move on a line.
//
// It tries every legal move (legalMoves above: what the stage allows, traps included), as the design asks: a clever
// route can start with a move that looks like a trap. On 2(x + 6) − x = 3x + 22, pressing −22 is productive because
// −x next makes every x-number even (−22, −x, ÷2, combine), which a search over cancelling moves alone misses.
//
// usefulMoves (the cancelling moves, dividing by the number stuck to x, the flip, brackets, combining) is kept as a
// smaller move set the tests compare against; nothing in the game judges a press with it.
//
// For x = N the last layer is never built in full: a line is one move from x = N only through a cancelling move, a
// divide by its own x number, a multiply by a fraction's bottom, the flip or a combine (see finishMoves), so only those
// are tried.
//
// Every move is about 20 choices a step, so a line five or more moves from done can take half a second. A node budget
// keeps each search quick: when it runs out, the answer comes from the smaller usefulMoves search instead and is marked
// approx. Starts and the lines a kid reaches near a good route are well inside the budget (the tests check the exact
// answer against a brute force there); only lines that wandered far off use the fallback, and the jam guard rewinds
// those anyway.

const CACHE = new Map();
const CACHE_MAX = 30000;
export const MAX_DEPTH = 8;
export const NODE_BUDGET = 15000;

function legalFrom(l, st, moves) {
  const here = lineKey(l);
  const seen = new Set([here]);
  const out = [];
  for (const m of moves) {
    const r = applyMove(l, m);
    if (!r || !lineFits(r.out, st)) continue;
    const key = lineKey(r.out);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ move: m, out: r.out, key });
  }
  return out;
}

function cancelMoves(l, st, out) {
  for (const side of [l.L, l.R]) {
    for (const t of side) {
      if (t.t === 'n' && st.add && !t.v.isZero()) out.push({ k: 'add', term: { t: 'n', v: t.v.neg() } });
      else if (t.t === 'x' && st.addx) out.push({ k: 'add', term: { t: 'x', v: t.v.neg() } });
    }
  }
}

export function usefulMoves(l, st) {
  // tidying moves first, so the route the search reports (the "shortest trail" shown after a box) tidies before it
  // cancels, the way a teacher would write it
  const moves = [];
  if (st.comb && hasLike(l)) moves.push(COMB);
  if (st.dist && hasBracket(l)) moves.push(DIST);
  cancelMoves(l, st, moves);
  const coefs = new Set(), dens = new Set();
  const walk = (t) => {
    if (t.t === 'x') { coefs.add(Math.abs(t.v.n)); if (t.v.d > 1) dens.add(t.v.d); }
    else if (t.t === 'b') { if (t.p.isInt()) coefs.add(Math.abs(t.p.n)); else dens.add(t.p.d); t.in.forEach(walk); }
  };
  l.L.forEach(walk); l.R.forEach(walk);
  const signs = st.sign === 'any' ? [1, -1] : [1];
  if (st.div) {
    const ks = new Set();
    coefs.forEach((m) => divisorsOver1(m).forEach((k) => ks.add(k)));
    [...ks].sort((a, b) => a - b).forEach((k) => signs.forEach((g) => moves.push(divBy(g * k))));
  }
  if (st.mul) [...dens].sort((a, b) => a - b).forEach((k) => signs.forEach((g) => moves.push(mulBy(g * k))));
  if (st.flip) moves.push(FLIP);
  return legalFrom(l, st, moves);
}

// The only moves that can turn a line into x = N in one go.
function finishMoves(l, st) {
  const moves = [];
  cancelMoves(l, st, moves);
  for (const t of [...l.L, ...l.R]) {
    if (t.t !== 'x') continue;
    const v = t.v;
    if (v.d === 1 && Math.abs(v.n) > 1 && st.div && (v.n > 0 || st.sign === 'any')) moves.push(divBy(v.n));
    if (v.d > 1 && Math.abs(v.n) === 1 && st.mul && (v.n > 0 || st.sign === 'any')) moves.push(mulBy(v.n * v.d));
  }
  if (st.flip) moves.push(FLIP);
  if (st.comb && hasLike(l)) moves.push(COMB);
  return legalFrom(l, st, moves);
}

// The only moves that can make a vault line show its verdict in one go: cancelling a term (x leaves both sides, or the
// sides become the same), combining, opening brackets, and dividing by a bracket's number (the bracket then opens by
// itself). Scaling or flipping both sides can't make two different sides equal, and adding a term that cancels
// nothing changes both sides alike. The tests check this against trying every move.
export function verdictFinishMoves(l, st) {
  const moves = [];
  cancelMoves(l, st, moves);
  if (st.comb && hasLike(l)) moves.push(COMB);
  if (st.dist && hasBracket(l)) moves.push(DIST);
  if (st.div) for (const t of [...l.L, ...l.R]) if (t.t === 'b' && t.p.isInt() && Math.abs(t.p.n) > 1) moves.push(divBy(t.p.n));
  return legalFrom(l, st, moves);
}

// solve(line, stage, { goal, goalId, finish, useful, maxDepth, budget })
//   goal     a function (line -> truthy) for a goal other than x = N (the vault verdicts); goalId names it for the cache
//   finish   (line, stage) -> the only moves that can reach that goal in one step (without it every move is tried)
//   useful   search with the smaller usefulMoves set instead of every legal move (tests only)
// -> { d, path: [moves], goodKeys: [line keys one move on along a shortest route], goodMoves: [one move per key], approx }
// d is Infinity when no finish was found within maxDepth moves. approx = the budget ran out and the smaller move set
// answered (opts.fallback = false returns Infinity with cut = true instead).
export function solve(l, st, opts = {}) {
  const useful = opts.useful === true;
  const goal = opts.goal || null;
  const maxDepth = opts.maxDepth ?? MAX_DEPTH;
  const budget = opts.budget ?? NODE_BUDGET;
  const rootKey = lineKey(l);
  const ck = `${useful ? 'U' : 'F'}${goal ? `:${opts.goalId || 'goal'}` : ''}${st.id}#${rootKey}`;
  const hit = CACHE.get(ck);
  if (hit && (hit.d !== Infinity || (hit.depth >= maxDepth && !hit.cut) || (hit.cut && hit.budget >= budget))) return hit;
  const moveSet = useful ? (x) => usefulMoves(x, st) : (x) => legalMoves(x, st);
  const done = goal || isSolved;
  // the moves tried on the last step: for x = N only the few that can finish; for a verdict, every move
  const lastMoves = goal ? (opts.finish ? (x) => opts.finish(x, st) : null) : (x) => finishMoves(x, st);
  let res = null;
  if (done(l)) res = { d: 0, path: [], goodKeys: [], goodMoves: [], depth: maxDepth };
  else {
    const depthOf = new Map([[rootKey, 0]]);
    const firstOf = new Map([[rootKey, null]]);   // key -> Set of root-child keys that reach it in the fewest moves
    const parent = new Map();                      // key -> [parentKey, move]
    const firstMove = new Map();                   // root-child key -> the move that makes it
    let layer = [{ key: rootKey, line: l }];
    let nodes = 0, cut = false;
    for (let depth = 0; depth < maxDepth && layer.length; depth++) {
      // can any line in this layer reach the goal in one more move?
      const good = new Set();
      let found = null;
      for (const n of layer) {
        n.kids = lastMoves ? null : moveSet(n.line);
        for (const f of lastMoves ? lastMoves(n.line) : n.kids) {
          if (!done(f.out)) continue;
          if (depth === 0) { good.add(f.key); firstMove.set(f.key, f.move); }
          else firstOf.get(n.key).forEach((k) => good.add(k));
          if (!found) found = { key: n.key, move: f.move };
        }
      }
      if (found) {
        const path = [found.move];
        let k = found.key;
        while (k !== rootKey) { const [pk, mv] = parent.get(k); path.unshift(mv); k = pk; }
        const goodKeys = [...good];
        res = { d: depth + 1, path, goodKeys, goodMoves: goodKeys.map((k2) => firstMove.get(k2)), depth: maxDepth };
        break;
      }
      if (depth === maxDepth - 1) break;
      const next = [];
      for (const n of layer) {
        const fs = firstOf.get(n.key);
        for (const c of n.kids || moveSet(n.line)) {
          const seenAt = depthOf.get(c.key);
          const mine = depth === 0 ? [c.key] : fs;
          if (depth === 0 && !firstMove.has(c.key)) firstMove.set(c.key, c.move);
          if (seenAt === undefined) {
            depthOf.set(c.key, depth + 1);
            firstOf.set(c.key, new Set(mine));
            parent.set(c.key, [n.key, c.move]);
            next.push({ key: c.key, line: c.out });
          } else if (seenAt === depth + 1) {
            const s2 = firstOf.get(c.key);
            mine.forEach((k) => s2.add(k));
          }
        }
        n.kids = null;
        if (next.length + nodes > budget) { cut = true; break; }
      }
      if (cut) break;
      nodes += next.length;
      layer = next;
    }
    if (!res) res = { d: Infinity, path: [], goodKeys: [], goodMoves: [], depth: maxDepth, cut, budget };
    if (cut && !useful && opts.fallback !== false) res = { ...solve(l, st, { ...opts, useful: true }), approx: true, depth: maxDepth, budget };
  }
  if (CACHE.size > CACHE_MAX) CACHE.clear();
  CACHE.set(ck, res);
  return res;
}

export function distance(l, st, opts) { return solve(l, st, opts).d; }

// Every legal move (traps included) that brings the goal closer: the first moves of the shortest routes, from one
// search. A move is closer exactly when the fewest moves left after it is one less than before.
// opts are passed to solve (goal/goalId for the vault boxes).
// -> { d, closer: [{ move, key, out, d }], all: [{ move, key, out, d }] }   (d on a move: d − 1 if closer, else null)
export function closerMoves(l, st, opts = {}) {
  const s = solve(l, st, opts);
  const good = new Set(s.goodKeys);
  const all = legalMoves(l, st).map((c) => ({ ...c, d: good.has(c.key) ? s.d - 1 : null }));
  return { d: s.d, closer: all.filter((c) => good.has(c.key)), all };
}
export function clearSearchCache() { CACHE.clear(); }

// ---------- the true answer, worked out directly (for checking) ----------
// Collapses each side to a·x + b and solves. Returns { kind: 'one', x } | { kind: 'all' } | { kind: 'none' }.
export function linearForm(side) {
  let a = F(0), b = F(0);
  const walk = (t, k) => {
    if (t.t === 'n') b = b.add(t.v.mul(k));
    else if (t.t === 'x') a = a.add(t.v.mul(k));
    else t.in.forEach((u) => walk(u, k.mul(t.p)));
  };
  side.forEach((t) => walk(t, ONE));
  return { a, b };
}
export function trueAnswer(l) {
  const p = linearForm(l.L), q = linearForm(l.R);
  const a = p.a.sub(q.a), b = q.b.sub(p.b);
  if (a.isZero()) return b.isZero() ? { kind: 'all' } : { kind: 'none' };
  return { kind: 'one', x: b.div(a) };
}

// Every number printed on the line (signs dropped), for the "x must not be printed" rule.
export function printedNumbers(l) {
  const out = new Set();
  const walk = (t) => {
    if (t.t === 'n') { out.add(Math.abs(t.v.n)); if (t.v.d > 1) out.add(t.v.d); }
    else if (t.t === 'x') { if (Math.abs(t.v.n) !== 1) out.add(Math.abs(t.v.n)); if (t.v.d > 1) out.add(t.v.d); }
    else if (t.t === 'b') { if (Math.abs(t.p.n) !== 1) out.add(Math.abs(t.p.n)); if (t.p.d > 1) out.add(t.p.d); t.in.forEach(walk); }
  };
  l.L.forEach(walk); l.R.forEach(walk);
  return out;
}

// Every number on the line, signs kept (for the ±99 rule).
export function allValues(l) {
  const out = [];
  const walk = (t) => {
    if (t.t === 'b') { out.push(t.p); t.in.forEach(walk); } else out.push(t.v);
  };
  l.L.forEach(walk); l.R.forEach(walk);
  return out;
}
