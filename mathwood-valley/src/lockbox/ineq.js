// Inequalities: the "less than / more than" boxes, the rungs after the equations (I1 .. I4).
//
// An inequality is a chain of ROOMS with a sign between each two: 2x + 3 < 11 has two rooms, 3x − 9 < 6x < 3x + 12
// has three ("three rooms: whatever you do to one, do to every room"). Two chains joined by "or" (x + 2 < 0 or 2x > 8)
// are worked one after the other. A move is done to every room of the chain being worked. Multiplying or dividing by a
// negative turns every sign round (< becomes >, ≤ becomes ≥): THE FLIP.
// A chain is solved when x stands alone (x < 4, −3 < x < 4, 4 > x); the answer is then given on a number line: four
// pictures with open or closed circles, shaded between or outward (lineChoices).
//
// Nothing here touches the page, so the node tests can check it.
//
//   chain(rooms, rels)              rooms: [side, side(, side)]; rels: ['<' | '≤' | '>' | '≥'] between them
//   state = { form: 'one' | 'three' | 'or', chains: [chain(, chain)], active: index of the chain being worked }
//   applyChain(chain, move, events) -> { out, mid, ev, flipped } (mid/ev per room, as engine.js applyMove per side)
//   chainSolved, chainSet (a solved chain's numbers on the line), stateSet, satisfies(state, x), inSet(set, x)
//   solveChain(chain, stage) -> { d }   fewest moves to x alone (a small search over the cancelling moves)
//   chainRoute / chainCardLeft / chainCardMoves   the steps card's order for a chain (see INEQ_STEPS)
//   chainButtons(chain, stage, { rng, fav, steps }) -> the tray, as buttons.js buildButtons makes it for equations
//   chainParts(state, move, { rng }) -> the parts to work out (parts.js roomParts room by room), plus, after a × or ÷,
//                                       "which way does the sign point now?"
//   lineChoices(set, { rng }) -> { win: { lo, hi }, choices: [{ set, right, tag, key }] } four number-line pictures
//   testValue(set), checkRows(state, x)   the check: a number from the shaded part put into the beginning inequality
//   INEQ_RECIPES, makeIneqProblem(rungId, start, stage)   the recipes for the rungs (generate.js uses them)

import {
  F, MINUS, num, xt, applyMove, lineFits, sideKey, sideText, fracText, evalSide, keySteps, candidateMoves, moveLabel,
  moveId, divBy, mulBy, FLIP,
} from './engine.js';
import { sortInfo } from './steps.js';
import { roomParts } from './parts.js';
import { buildButtons } from './buttons.js';

export const RELS = ['<', '≤', '>', '≥'];
const FLIPPED = { '<': '>', '>': '<', '≤': '≥', '≥': '≤' };
const STRICT_SWAP = { '<': '≤', '≤': '<', '>': '≥', '≥': '>' };
export const flipRel = (r) => FLIPPED[r];
export const RANGE = 20;   // the answers' numbers stay within ±20

const clone = (t) => (t.t === 'b' ? { t: 'b', p: t.p, in: t.in.map(clone) } : { t: t.t, v: t.v });
const cloneSide = (s) => s.map(clone);
export const chain = (rooms, rels) => ({ rooms, rels });
export const cloneChain = (c) => ({ rooms: c.rooms.map(cloneSide), rels: [...c.rels] });
export const cloneState = (s) => ({ form: s.form, chains: s.chains.map(cloneChain), active: s.active ?? 0 });

// ---------- writing ----------

export function chainText(c) { return c.rooms.map((r, i) => (i ? ` ${c.rels[i - 1]} ` : '') + sideText(r)).join(''); }
export function stateText(s) { return s.chains.map(chainText).join(' or '); }
export function chainKey(c) { return c.rooms.map((r, i) => (i ? c.rels[i - 1] : '') + sideKey(r)).join(''); }
export const stateKey = (s) => `${s.chains.map(chainKey).join('|')}#${s.active ?? 0}`;
// a room's name, for the focus caption
export function roomName(c, i) {
  if (c.rooms.length === 3) return ['left room', 'middle room', 'right room'][i];
  return i === 0 ? 'left side' : 'right side';
}
// "−4 < x ≤ 3", "x ≤ −4", "x < −2 or x > 4": a set as school writes it
export function setText(set) {
  const n = (v) => (v < 0 ? MINUS : '') + Math.abs(v);
  return set.map((p) => {
    if (p.lo === null) return `x ${p.hiIn ? '≤' : '<'} ${n(p.hi)}`;
    if (p.hi === null) return `x ${p.loIn ? '≥' : '>'} ${n(p.lo)}`;
    return `${n(p.lo)} ${p.loIn ? '≤' : '<'} x ${p.hiIn ? '≤' : '<'} ${n(p.hi)}`;
  }).join(' or ');
}

// ---------- moves on every room ----------

export const movesFlip = (m) => m.k === 'flip' || ((m.k === 'mul' || m.k === 'div') && m.f.n < 0);

export function applyChain(c, m, withEvents = false) {
  const n = c.rooms.length;
  const out = [], mid = [], ev = [];
  for (let i = 0; i < n; i += 2) {
    const L = c.rooms[i], R = i + 1 < n ? c.rooms[i + 1] : c.rooms[i];
    const r = applyMove({ L, R }, m, withEvents);
    if (!r) return null;
    out[i] = r.out.L; mid[i] = r.mid ? r.mid.L : null; ev[i] = r.ev.L;
    if (i + 1 < n) { out[i + 1] = r.out.R; mid[i + 1] = r.mid ? r.mid.R : null; ev[i + 1] = r.ev.R; }
  }
  const flipped = movesFlip(m);
  return { out: { rooms: out, rels: flipped ? c.rels.map(flipRel) : [...c.rels] }, mid, ev, flipped };
}
export const chainFits = (c, st) => c.rooms.every((r) => lineFits({ L: r, R: r }, st));

// ---------- solved, and what it means ----------

const isX1 = (s) => s.length === 1 && s[0].t === 'x' && s[0].v.isOne();
const isNum = (s) => s.length === 1 && s[0].t === 'n';
export function chainSolved(c) {
  if (c.rooms.length === 2) return (isX1(c.rooms[0]) && isNum(c.rooms[1])) || (isNum(c.rooms[0]) && isX1(c.rooms[1]));
  return isNum(c.rooms[0]) && isX1(c.rooms[1]) && isNum(c.rooms[2]);
}
export const stateSolved = (s) => s.chains.every(chainSolved);

// A set is a list of pieces { lo, loIn, hi, hiIn } (lo/hi null = no end that way), smallest first.
const ray = (rel, n) => (rel === '<' || rel === '≤' ? { lo: null, loIn: false, hi: n, hiIn: rel === '≤' } : { lo: n, loIn: rel === '≥', hi: null, hiIn: false });
export function chainSet(c) {
  if (!chainSolved(c)) return null;
  if (c.rooms.length === 2) {
    const left = isX1(c.rooms[0]);
    const n = (left ? c.rooms[1] : c.rooms[0])[0].v.valueOf();
    return [ray(left ? c.rels[0] : flipRel(c.rels[0]), n)];
  }
  const a = c.rooms[0][0].v.valueOf(), b = c.rooms[2][0].v.valueOf();
  const [r1, r2] = c.rels;
  if (r1 === '<' || r1 === '≤') return [{ lo: a, loIn: r1 === '≤', hi: b, hiIn: r2 === '≤' }];
  return [{ lo: b, loIn: r2 === '≥', hi: a, hiIn: r1 === '≥' }];
}
export function stateSet(s) {
  const pieces = s.chains.map(chainSet);
  if (pieces.some((p) => !p)) return null;
  return pieces.flat().sort((p, q) => (p.lo ?? -Infinity) - (q.lo ?? -Infinity));
}
export const setKey = (set) => set.map((p) => `${p.lo === null ? '-inf' : (p.loIn ? '[' : '(') + p.lo},${p.hi === null ? 'inf' : p.hi + (p.hiIn ? ']' : ')')}`).join('u');

const holds = (a, rel, b) => { const s = a.sub(b).sign(); return rel === '<' ? s < 0 : rel === '≤' ? s <= 0 : rel === '>' ? s > 0 : s >= 0; };
// does x (a whole number or a half) make the beginning true? (any one of the chains, for "or")
export function satisfies(s, x) {
  const X = F(Math.round(x * 2), 2);
  return s.chains.some((c) => c.rels.every((rel, i) => holds(evalSide(c.rooms[i], X), rel, evalSide(c.rooms[i + 1], X))));
}
export function inSet(set, x) {
  return set.some((p) => (p.lo === null || x > p.lo || (p.loIn && x === p.lo)) && (p.hi === null || x < p.hi || (p.hiIn && x === p.hi)));
}

// ---------- the search: fewest moves to x alone ----------

function stageAllows(m, st) {
  if (m.k === 'add') return m.term.t === 'x' ? st.addx : st.add;
  if (m.k === 'mul') return st.mul;
  if (m.k === 'div') return st.div;
  if (m.k === 'flip') return st.flip;
  return false;
}
// the cancelling moves, dividing by a number stuck to x, multiplying by a bottom, the flip
function usefulChainMoves(c, st) {
  const out = [], seen = new Set();
  const push = (m) => { const id = moveId(m); if (!seen.has(id) && stageAllows(m, st)) { seen.add(id); out.push(m); } };
  for (const side of c.rooms) {
    for (const t of side) {
      if (t.t === 'n' && !t.v.isZero()) push({ k: 'add', term: { t: 'n', v: t.v.neg() } });
      if (t.t === 'x') {
        push({ k: 'add', term: { t: 'x', v: t.v.neg() } });
        if (t.v.d === 1 && Math.abs(t.v.n) > 1) { push(divBy(t.v.n)); push(divBy(-t.v.n)); }
        if (t.v.d > 1) { push(mulBy(t.v.d)); push(mulBy(-t.v.d)); }
      }
    }
  }
  push(FLIP);
  return out;
}
const SEARCH = new Map();
export function solveChain(c, st, { maxDepth = 6, budget = 6000 } = {}) {
  const key = `${st.id}#${chainKey(c)}`;
  const hit = SEARCH.get(key);
  if (hit) return hit;
  let res = { d: Infinity };
  if (chainSolved(c)) res = { d: 0 };
  else {
    const seen = new Set([chainKey(c)]);
    let layer = [c];
    for (let depth = 1; depth <= maxDepth && layer.length && !Number.isFinite(res.d); depth++) {
      const next = [];
      for (const node of layer) {
        for (const m of usefulChainMoves(node, st)) {
          const r = applyChain(node, m);
          if (!r || !chainFits(r.out, st)) continue;
          if (chainSolved(r.out)) { res = { d: depth }; break; }
          const k = chainKey(r.out);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push(r.out);
        }
        if (Number.isFinite(res.d) || seen.size > budget) break;
      }
      layer = next;
    }
  }
  if (SEARCH.size > 20000) SEARCH.clear();
  SEARCH.set(key, res);
  return res;
}

// ---------- the steps card's order for a chain ----------
// Two rooms: the side x ends on is chosen as for equations (steps.js sortInfo); three rooms: x ends in the middle.
// x-terms out of the other rooms first, then the numbers out of x's room, then free x (÷ or ×; a negative turns the
// sign round).

export function xRoomOf(c, st) {
  if (c.rooms.length === 3) return 1;
  return sortInfo({ L: c.rooms[0], R: c.rooms[1] }, { keepX: !st.addx }).side === 'L' ? 0 : 1;
}
export function nextChainMove(c, st) {
  if (chainSolved(c)) return null;
  const xr = xRoomOf(c, st);
  for (let i = 0; i < c.rooms.length; i++) {
    if (i === xr) continue;
    for (const t of c.rooms[i]) if (t.t === 'x') return { step: 'sort', move: { k: 'add', term: { t: 'x', v: t.v.neg() } } };
  }
  for (const t of c.rooms[xr]) if (t.t === 'n' && !t.v.isZero()) return { step: 'sort', move: { k: 'add', term: { t: 'n', v: t.v.neg() } } };
  const xs = c.rooms[xr].filter((t) => t.t === 'x');
  if (xs.length !== 1) return null;
  const a = xs[0].v;
  if (a.isOne()) return null;
  if (a.eq(F(-1))) return { step: 'free', move: st.flip ? FLIP : divBy(-1) };
  if (a.d === 1) return { step: 'free', move: divBy(a.n) };
  if (Math.abs(a.n) === 1) return { step: 'free', move: mulBy(a.n * a.d) };
  return null;
}
export function chainRoute(c, st) {
  const route = [];
  let cur = c;
  for (let guard = 0; guard < 10; guard++) {
    if (chainSolved(cur)) return route;
    const nx = nextChainMove(cur, st);
    if (!nx || !stageAllows(nx.move, st)) return null;
    const r = applyChain(cur, nx.move);
    if (!r || !chainFits(r.out, st)) return null;
    route.push(nx);
    cur = r.out;
  }
  return null;
}
export const chainCardLeft = (c, st) => { const r = chainRoute(c, st); return r ? r.length : Infinity; };
// every move that follows the card from here (its own next move first, then the same step done another way)
export function chainCardMoves(c, st) {
  const s0 = chainCardLeft(c, st);
  if (!Number.isFinite(s0) || s0 === 0) return [];
  const out = [], seen = new Set();
  const tryMove = (m) => {
    if (!m || !stageAllows(m, st)) return;
    const r = applyChain(c, m);
    if (!r || !chainFits(r.out, st)) return;
    const k = chainKey(r.out);
    if (seen.has(k) || chainCardLeft(r.out, st) !== s0 - 1) return;
    seen.add(k);
    out.push(m);
  };
  tryMove(nextChainMove(c, st)?.move);
  for (const m of usefulChainMoves(c, st)) if (m.k === 'add') tryMove(m);
  return out;
}

// The step the card is on for a chain: 'sort' (x's out of the way) or 'free' (x alone, a number stuck to it), or
// 'done'. needs: which of the two the chain needed at the start.
export function chainStep(c, st) {
  if (chainSolved(c)) return 'done';
  const nx = nextChainMove(c, st);
  return nx ? nx.step : 'sort';
}

// ---------- the tray ----------

// all the rooms' terms in one line, for what buttons.js reads from a line (the numbers on it, brackets)
const mergedLine = (c) => ({ L: [].concat(...c.rooms.slice(0, -1)), R: c.rooms[c.rooms.length - 1] });

export function chainButtons(c, st, { rng = null, fav = null } = {}) {
  const ml = mergedLine(c);
  const d0 = solveChain(c, st).d;
  const s0 = chainCardLeft(c, st);
  const seen = new Set([chainKey(c)]);
  const all = [];
  for (const m of candidateMoves(ml, st)) {
    if (m.k === 'dist' || m.k === 'comb') continue;
    const r = applyChain(c, m);
    if (!r || !chainFits(r.out, st)) continue;
    const key = chainKey(r.out);
    if (seen.has(key)) continue;
    seen.add(key);
    const d = solveChain(r.out, st).d;
    const closer = d < d0 || (Number.isFinite(s0) && chainCardLeft(r.out, st) < s0);
    all.push({ move: m, out: r.out, key, d: closer ? d : null, closer });
  }
  const cm = { d: d0, closer: all.filter((x) => x.closer), all };
  return buildButtons(ml, st, { count: 4, rng, fav, steps: chainCardMoves(c, st), cm,
    keyOf: (m) => { const r = applyChain(c, m); return r ? chainKey(r.out) : null; } });
}

// ---------- the parts to work out ----------

const ROOM_LETTER = 'AB';
export const roomId = (ci, i) => `${ROOM_LETTER[ci]}${i}`;
export const relId = (ci) => `${ROOM_LETTER[ci]}r`;

// After a × or ÷ (or the flip): which way does the sign point now? Four answers: the four signs.
export function signQuestion(c, move, ci, rand = Math.random) {
  const flips = movesFlip(move);
  const old = c.rels[0], now = flips ? flipRel(old) : old;
  const tagOf = (r) => (r === now ? null : r === old ? 'kept' : r === flipRel(old) ? 'turned' : 'strict');
  const choices = RELS.map((r) => ({ text: r, right: r === now, tag: tagOf(r) }));
  for (let i = choices.length - 1; i > 0; i--) { const k = Math.floor(rand() * (i + 1)); [choices[i], choices[k]] = [choices[k], choices[i]]; }
  const label = move.k === 'flip' ? `·(${MINUS}1)` : moveLabel(move);
  return { room: relId(ci), kind: 'sign', at: [], tokens: [{ text: old, from: 'rel' }], eq: 'turns into', answer: now, choices,
    flips, label, old, rels: c.rels.map((r) => (flips ? flipRel(r) : r)), prompt: `${old} after ${label}` };
}
export function signNudge(q, c) {
  if (!c || c.right) return '';
  const by = q.label.startsWith('÷') ? 'Dividing' : 'Multiplying';
  if (c.tag === 'kept') return `${by} by a negative turns the sign round: the big end swaps sides.`;
  if (c.tag === 'turned') return `${by} by a positive number keeps the sign the way it was.`;
  return '“Or equal” stays as it was: only the direction can turn.';
}
export function signHelp(q) {
  return q.flips ? `${q.label} is a negative. × or ÷ by a negative turns the sign round (< becomes >).`
    : `${q.label} is positive. × or ÷ by a positive keeps the sign as it is.`;
}

export function chainParts(state, move, { rng = null } = {}) {
  const rand = rng ? rng.next : Math.random;
  const ci = state.active ?? 0;
  const c = state.chains[ci];
  const r = applyChain(c, move, true);
  if (!r) return null;
  const rooms = c.rooms.map((_, i) => roomId(ci, i));
  const autos = [], qs = [];
  c.rooms.forEach((before, i) => {
    const p = roomParts({ room: rooms[i], move, before, mid: r.mid[i], out: r.out.rooms[i], ev: r.ev[i], rand });
    autos.push(...p.autos);
    qs.push(...p.qs);
  });
  if (move.k === 'mul' || move.k === 'div' || move.k === 'flip') qs.push(signQuestion(c, move, ci, rand));
  const shownRooms = move.k === 'add' ? r.mid.map(cloneSide) : c.rooms.map(cloneSide);
  const shown = { form: state.form, active: ci, chains: state.chains.map((ch, k) => (k === ci ? { rooms: shownRooms, rels: [...c.rels] } : cloneChain(ch))) };
  rooms.forEach((id, i) => { shown[id] = shownRooms[i]; });
  const out = { form: state.form, active: ci, chains: state.chains.map((ch, k) => (k === ci ? r.out : cloneChain(ch))) };
  const every = c.rooms.length === 3 ? 'every room' : 'both sides';
  return { show: move.k === 'add' ? 'mid' : 'before', shown, rooms, autos, qs, move, out, flipped: r.flipped,
    note: `${move.k === 'flip' ? `·(${MINUS}1)` : moveLabel(move)} ${every}` };
}

// ---------- the steps card for inequalities ----------
// The same card as the equations', in the inequalities' words; the flip rule shows on it once a sign has turned.

export const INEQ_STEPS = {
  one: [
    { n: 1, id: 'sort', label: 'x’s on one side, numbers on the other', short: 'x’s on one side, numbers on the other', skip: 'Already sorted' },
    { n: 2, id: 'free', label: 'Free x (× or ÷ by a negative: flip the sign)', short: 'Free x', skip: 'x is already free' },
    { n: 3, id: 'line', label: 'Show it on the number line', short: 'Show it on the number line', skip: '' },
    { n: 4, id: 'check', label: 'Check a number', short: 'Check a number', skip: '' },
  ],
  three: [
    { n: 1, id: 'sort', label: 'x’s in the middle room, numbers outside', short: 'x’s in the middle room', skip: 'Already sorted' },
    { n: 2, id: 'free', label: 'Free x (× or ÷ by a negative: flip the signs)', short: 'Free x', skip: 'x is already free' },
    { n: 3, id: 'line', label: 'Show it on the number line', short: 'Show it on the number line', skip: '' },
    { n: 4, id: 'check', label: 'Check a number', short: 'Check a number', skip: '' },
  ],
  or: [
    { n: 1, id: 'first', label: 'Solve the first one', short: 'Solve the first one', skip: '' },
    { n: 2, id: 'second', label: 'Solve the second one', short: 'Solve the second one', skip: '' },
    { n: 3, id: 'line', label: 'Show both parts on the number line', short: 'Show both on the number line', skip: '' },
    { n: 4, id: 'check', label: 'Check a number', short: 'Check a number', skip: '' },
  ],
};
export const INEQ_RULE = {
  one: 'Whatever you do to one side, do to the other.',
  three: 'Three rooms: whatever you do to one, do to every room.',
  or: '“Or”: solve each one on its own, then show both.',
};
export const FLIP_RULE = '× or ÷ by a negative number: flip the sign (< becomes >, ≤ becomes ≥).';

// ---------- the answer on a number line ----------

const cloneSet = (set) => set.map((p) => ({ ...p }));
// the window every picture shares: the ends with room around them (and zero, when it is near)
export function lineWindow(sets) {
  const pts = [];
  for (const set of sets) for (const p of set) { if (p.lo !== null) pts.push(p.lo); if (p.hi !== null) pts.push(p.hi); }
  let lo = Math.min(...pts) - 3, hi = Math.max(...pts) + 3;
  if (lo > 0 && lo <= 4) lo = -1;
  if (hi < 0 && hi >= -4) hi = 1;
  while (hi - lo < 10) { lo -= 1; hi += 1; }
  return { lo, hi };
}
export function lineChoices(set, { rng = null } = {}) {
  const rand = rng ? rng.next : Math.random;
  const variants = [];
  const add = (s, tag) => variants.push({ set: s, tag });
  const toggle = (p, end) => ({ ...p, [end]: !p[end] });
  if (set.length === 1 && (set[0].lo === null || set[0].hi === null)) {
    const p = set[0];
    const n = p.lo === null ? p.hi : p.lo, closed = p.lo === null ? p.hiIn : p.loIn;
    const left = p.lo === null;
    const mk = (l, c, v = n) => (l ? { lo: null, loIn: false, hi: v, hiIn: c } : { lo: v, loIn: c, hi: null, hiIn: false });
    add([mk(left, !closed)], 'circle');
    add([mk(!left, closed)], 'way');
    add([mk(!left, !closed)], 'both');
    if (n !== 0 && Math.abs(n) <= RANGE) add([mk(left, closed, -n)], 'number');
  } else if (set.length === 1) {
    const p = set[0];
    const out = (q) => [{ lo: null, loIn: false, hi: q.lo, hiIn: q.loIn }, { lo: q.hi, loIn: q.hiIn, hi: null, hiIn: false }];
    add([toggle(toggle(p, 'loIn'), 'hiIn')], 'circle');
    add(out(p), 'outward');
    add([toggle(p, p.loIn === p.hiIn ? 'loIn' : 'hiIn')], 'oneend');
    add(out(toggle(toggle(p, 'loIn'), 'hiIn')), 'both');
  } else {
    // x < A or x > B: shaded between instead, the circles the other way, or both
    const [a, b] = set;
    add([{ lo: a.hi, loIn: a.hiIn, hi: b.lo, hiIn: b.loIn }], 'between');
    add([toggle(a, 'hiIn'), toggle(b, 'loIn')], 'circle');
    add([{ lo: a.hi, loIn: !a.hiIn, hi: b.lo, hiIn: !b.loIn }], 'both');
  }
  // three of them, in a random order, never two alike
  const seen = new Set([setKey(set)]);
  const picked = [];
  const pool = [...variants];
  for (let i = pool.length - 1; i > 0; i--) { const k = Math.floor(rand() * (i + 1)); [pool[i], pool[k]] = [pool[k], pool[i]]; }
  // the circle and the way are the two to learn: they come first whenever they are there
  pool.sort((p, q) => (['circle', 'way', 'outward', 'between'].includes(q.tag) ? 1 : 0) - (['circle', 'way', 'outward', 'between'].includes(p.tag) ? 1 : 0));
  for (const v of pool) {
    const k = setKey(v.set);
    if (seen.has(k) || picked.length >= 3) continue;
    seen.add(k);
    picked.push({ set: v.set, right: false, tag: v.tag, key: k });
  }
  const choices = [{ set: cloneSet(set), right: true, tag: null, key: setKey(set) }, ...picked];
  for (let i = choices.length - 1; i > 0; i--) { const k = Math.floor(rand() * (i + 1)); [choices[i], choices[k]] = [choices[k], choices[i]]; }
  return { win: lineWindow(choices.map((c) => c.set)), choices };
}
export function lineNudge(set, c) {
  if (!c || c.right) return '';
  const p = set[0];
  const n = (v) => (v < 0 ? MINUS : '') + Math.abs(v);
  if (c.tag === 'circle' || c.tag === 'both' || c.tag === 'oneend') {
    return 'A filled circle means that number counts too (≤ or ≥); an open circle means it doesn’t (< or >).';
  }
  if (c.tag === 'way') return p.lo === null ? `x ${p.hiIn ? '≤' : '<'} ${n(p.hi)}: the numbers SMALLER than ${n(p.hi)}, to the left.`
    : `x ${p.loIn ? '≥' : '>'} ${n(p.lo)}: the numbers BIGGER than ${n(p.lo)}, to the right.`;
  if (c.tag === 'number') return 'Check where the circle sits: look at the number in the answer.';
  if (c.tag === 'outward') return 'Both signs at once: x sits BETWEEN the two numbers.';
  if (c.tag === 'between') return '“Or”: x can be in either part, so it shades outward from each number.';
  return 'Look at the sign and the number again.';
}
export const LINE_HELP = 'Circle: filled if the number counts too (≤ ≥), open if not (< >). Then shade every number that makes it true.';

// ---------- the check: a number from the shaded part, put into the beginning ----------

export function testValue(set) {
  const ends = new Set(set.flatMap((p) => [p.lo, p.hi]).filter((v) => v !== null));
  if (inSet(set, 0) && !ends.has(0)) return 0;
  const p = set[0];
  if (p.lo === null) return p.hi - 1;
  if (p.hi === null) return p.lo + 1;
  let v = Math.round((p.lo + p.hi) / 2);
  if (!inSet(set, v) || ends.has(v)) v = p.lo + 1;
  return v;
}
// -> { chain index, rows: per room [the working steps], values, ok } for the chain the number satisfies
export function checkRows(state, x) {
  const X = F(x);
  let ci = state.chains.findIndex((c) => c.rels.every((rel, i) => holds(evalSide(c.rooms[i], X), rel, evalSide(c.rooms[i + 1], X))));
  if (ci < 0) ci = 0;
  const c = state.chains[ci];
  const rows = c.rooms.map((r) => keySteps(r, X));
  const values = c.rooms.map((r) => evalSide(r, X));
  const ok = c.rels.every((rel, i) => holds(values[i], rel, values[i + 1]));
  return { ci, rows, values: values.map(fracText), rels: c.rels, ok };
}

// ---------- the recipes ----------
// Every recipe picks the answer first (whole numbers within ±20) and builds the inequality around it.

const S3 = (size, a, b, c) => [a, b, c][Math.max(1, Math.min(3, size)) - 1];
const nonZeroSide = (terms) => (terms.length ? terms : [num(0)]);
// one side worked out to x rel n: a·x + b rel a·n + b, or with a negative a (the sign is turned to match)
function oneSided(rng, size, n, rel, { neg = false } = {}) {
  const a = neg ? -(rng.chance(0.25) ? 1 : rng.int(2, S3(size, 4, 6, 7))) : (rng.chance(0.3) ? 1 : rng.int(2, S3(size, 4, 6, 8)));
  let b = rng.chance(Math.abs(a) === 1 ? 0.95 : 0.7) ? rng.signed(1, S3(size, 9, 12, 15), 0.45) : 0;
  if (Math.abs(a) === 1 && b === 0) b = rng.int(2, 9);
  const c = a * n + b;
  const r = neg ? flipRel(rel) : rel;
  const xs = xt(a);
  let L = b ? (rng.chance(neg && Math.abs(a) === 1 ? 0.6 : 0.2) ? [num(b), xs] : [xs, num(b)]) : [xs];
  const R = [num(c)];
  // "=" reads both ways: now and then the x side is on the right (with the sign turned so it means the same)
  if (rng.chance(0.25)) return chain([R, L], [flipRel(r)]);
  return chain([L, R], [r]);
}
const pickN = (rng, size) => rng.int(-S3(size, 9, 14, RANGE), S3(size, 12, 16, RANGE));

export const INEQ_RECIPES = {
  // 2x + 3 < 11, x − 4 ≥ 2, 15 > 3x
  I1(rng, size) {
    return { form: 'one', chains: [oneSided(rng, size, pickN(rng, size), rng.pick(RELS))] };
  },
  // −3x ≥ 12, −2x + 5 < 11, 4 − x > 1: dividing by a negative turns the sign round
  I2(rng, size) {
    return { form: 'one', chains: [oneSided(rng, size, pickN(rng, size), rng.pick(RELS), { neg: true })] };
  },
  // three rooms: −9 < 3x < 12, 2 ≤ x + 5 < 9, 3x − 9 < 6x < 3x + 12
  I3(rng, size) {
    const lo = rng.int(-S3(size, 8, 12, 16), S3(size, 4, 8, 12));
    const hi = lo + rng.int(2, S3(size, 8, 10, 14));
    if (Math.abs(hi) > RANGE) return null;
    const a = rng.chance(0.25) ? 1 : rng.int(2, S3(size, 4, 5, 6));
    const b = rng.chance(a === 1 ? 1 : 0.55) ? rng.signed(1, S3(size, 8, 10, 12), 0.45) : 0;
    const c = size >= 2 && rng.chance(0.45) ? rng.int(1, S3(size, 2, 3, 4)) : 0;
    const outer = (v) => nonZeroSide([...(c ? [xt(c)] : []), ...(v ? [num(v)] : [])]);
    const mid = [xt(a + c), ...(b ? [num(b)] : [])];
    const r1 = rng.pick(['<', '≤']), r2 = rng.pick(['<', '≤']);
    return { form: 'three', chains: [chain([outer(a * lo + b), mid, outer(a * hi + b)], [r1, r2])] };
  },
  // either or: x + 2 < 0 or 2x > 8 (a part that points left and a part that points right, apart)
  I4(rng, size) {
    const a = rng.int(-S3(size, 10, 14, 16), S3(size, 4, 8, 12));
    const b = a + rng.int(2, S3(size, 8, 10, 12));
    if (Math.abs(b) > RANGE) return null;
    const left = oneSided(rng, Math.min(size, 2), a, rng.pick(['<', '≤']), { neg: rng.chance(0.3) });
    const right = oneSided(rng, Math.min(size, 2), b, rng.pick(['>', '≥']), { neg: rng.chance(0.3) });
    return { form: 'or', chains: rng.chance(0.5) ? [left, right] : [right, left] };
  },
};

// A box from its beginning: par (the card's count where it is longer than the fewest moves), the route the card
// takes, and the answer set. null when it can't be solved on this rung's moves.
export function makeIneqProblem(rungId, start, st, { maxPar = 6 } = {}) {
  const state = { form: start.form, chains: start.chains.map(cloneChain), active: 0 };
  if (!state.chains.every((c) => chainFits(c, st))) return null;
  let par = 0;
  const route = [];
  const solved = [];
  for (const c of state.chains) {
    if (chainSolved(c)) return null;
    const card = chainRoute(c, st);
    if (!card) return null;
    const d = solveChain(c, st, { maxDepth: Math.max(2, maxPar) }).d;
    if (!Number.isFinite(d)) return null;
    par += Math.max(d, card.length);
    let cur = c;
    for (const s of card) { route.push(moveLabel(s.move)); cur = applyChain(cur, s.move).out; }
    solved.push(cur);
  }
  if (par > maxPar) return null;
  const set = stateSet({ chains: solved });
  if (!set) return null;
  for (const p of set) for (const v of [p.lo, p.hi]) if (v !== null && (!Number.isInteger(v) || Math.abs(v) > RANGE)) return null;
  return { rung: rungId, mode: 'ineq', kind: 'ineq', form: state.form, key: `${rungId}:${stateText(state)}`, start: state, x: null,
    par, route, set };
}

