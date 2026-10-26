// cards.js: one practice card for any place and level, made by the game's own question makers (read-only imports),
// in one plain shape the practice page can show without three.js or any of the jobs:
//
//   makeCard(placeId, levelId, seed, { into, count }) -> {
//     place, level, seed, into, story (text above the question, or ''), pic (an svg string the maker drew, or ''),
//     lab (true when the choices are made here: the job itself has no choices for that kind of question),
//     parts: [{ ask, mode: 'one' | 'many' | 'order', choices: [{ label, good, why }], help, right, answer,
//               whyAt?(i, picked) (order parts: the why for a wrong tap, given the taps so far) }]
//   }
//
// The same seed (and into) always makes the same card. Every place's maker is the one its ladder's example() calls;
// where a job asks for more than one thing (a herd, a gang, the evens), the part is 'many': tap every right one.
//
// Choices made here, not by the game (LAB_CHOICES): the lock boxes from x on both sides up (the game solves those with
// moves, so there are no answer keys to tap): x = ? with near misses (one off, the sign turned, the moves' numbers), the
// inequalities with the sign or the end point turned, and "every number" / "no solution" for the vault's odd boxes.

import { PLACE } from '../../src/levels/places.js';
import { seeded, shuffle, MINUS } from '../../src/levels/kit.js';
import { seriesCard, whyNot as seriesWhyNot, nudge as seriesNudge, TABLE_ORDER } from '../../src/math/series.js';
import { makeTimes } from '../../src/math/times.js';
import { makeParity } from '../../src/math/parity.js';
import { levelBox } from '../../src/lockbox/levelbox.js';
import { makeRng } from '../../src/lockbox/generate.js';
import { lineText, keySteps } from '../../src/lockbox/engine.js';
import { findHint } from '../../src/lockbox/findx.js';
import { kHint, kNudge } from '../../src/lockbox/kbox.js';
import { chainText, setText } from '../../src/lockbox/ineq.js';
import { supText } from '../../src/lockbox/workout.js';
import { deerShot, whyNot as deerWhyNot } from '../../src/math/deermath.js';
import { questionAt } from '../fishing/pies.js';
import { practiceCreel } from '../fishing/questions.js';
import { itemAt } from '../../src/missions/sheepmath.js';
import { batchAt } from '../../src/missions/pigmath.js';
import { cardAt, whyNot as rangeWhyNot, tipFor, numText } from '../../src/math/numbersense.js';
import { shareAt } from '../../src/math/shares.js';
import { storeOrder, pickAsk } from '../../src/levels/place/store.js';
import { deliveriesOrder } from '../../src/levels/place/deliveries.js';
import { ladderQuestion as windmillQ } from '../windmill/questions.js';
import { panelQ } from '../bridge/questions.js';

export const LAB_CHOICES = { lockbox: ['both', 'bothMul', 'bothDiv', 'opp', 'paren', 'ineq', 'flip', 'vault'] };

const nt = (v) => (typeof v === 'number' ? (v < 0 ? MINUS : '') + Math.abs(v) : String(v));
const C = (label, good, why = '') => ({ label: String(label), good: !!good, why: why || '' });
const one = (ask, choices, more = {}) => ({ ask, mode: 'one', choices, help: '', right: '', answer: (choices.find((c) => c.good) || {}).label || '', ...more });

export function makeCard(placeId, levelId, seed, { into = null, count = null } = {}) {
  const P = PLACE[placeId];
  if (!P) throw new Error('no place ' + placeId);
  const L = P.levels.find((x) => x.id === levelId);
  if (!L) throw new Error(`no level ${placeId}/${levelId}`);
  const rand = seeded(seed >>> 0);
  const n = count || L.count || 5;
  const at = into == null ? Math.floor(rand() * n) : into;
  const card = MAKERS[placeId](L, rand, { into: at, count: n });
  return { place: placeId, level: levelId, seed, into: at, story: '', pic: '', lab: false, ...card };
}

// ---- the round-up and the wagon: series cards, herds, gangs ---------------------------------------------------------

function herdPart(T, w, t, ask) {
  return {
    ask, mode: 'many',
    choices: w.targets.map((x) => C(x.n, x.good, x.good ? '' : T.explain(x.n, t).line)),
    help: T.hint(t), right: `The ${t}s here: ${w.targets.filter((x) => x.good).map((x) => x.n).sort((a, b) => a - b).join(', ')}`,
    answer: w.targets.filter((x) => x.good).map((x) => x.n).sort((a, b) => a - b).join(', '),
  };
}

function roundup(L, rand) {
  const g = L.gen;
  if (g.kind === 'herd') {
    const t = g.tables[Math.floor(rand() * g.tables.length)];
    const T = makeTimes({}, { rand, now: () => 0 });
    const w = T.wave({ count: 11, table: t, reach: 12 });
    return { parts: [herdPart(T, w, t, `${w.rule}: rope every steer in it`)] };
  }
  const c = seriesCard(g, rand, { read: !!L.read });
  return { parts: [one(`${c.text}`, c.targets.map((x) => C(x.label, x.good, x.good ? '' : seriesWhyNot(c, x).line)),
    { help: `${c.sub ? c.sub + '. ' : ''}${seriesNudge(c)}`, right: c.done, answer: c.answerText })] };
}

function wagon(L, rand) {
  const g = L.gen;
  if (g.kind === 'parity') {
    const Pa = makeParity({ rand });
    const w = Pa.wave({ count: 8, want: g.want, top: g.top });
    const goods = w.targets.filter((x) => x.good).map((x) => x.n).sort((a, b) => a - b).join(', ');
    return { parts: [{ ask: `${w.rule}`, mode: 'many',
      choices: w.targets.map((x) => { const e = Pa.explain(x.n); return C(x.n, x.good, x.good ? '' : `${e.line}.${e.also ? ' ' + e.also + '.' : ''}`); }),
      help: Pa.hint(), right: `The ${w.want}s: ${goods}`, answer: goods }] };
  }
  const T = makeTimes({}, { rand, now: () => 0 });
  if (g.kind === 'gang') {
    const t = g.table || g.open[Math.floor(rand() * g.open.length)];
    const w = T.wave({ count: 8, table: t, reach: 12 });
    return { parts: [herdPart(T, w, t, `The ${t}-Gang: rope every bandit wearing a ${t}s number`)] };
  }
  // missing: the same fact as the levels page's example picks (the job picks it by the rider's red facts)
  const t = TABLE_ORDER[Math.floor(rand() * TABLE_ORDER.length)], a = 2 + Math.floor(rand() * (g.upTo - 1));
  const tt = Math.min(t, g.upTo);
  const w = T.wave({ count: 6, fact: { t: tt, a, upTo: g.upTo } });
  const good = w.targets.find((x) => x.good);
  return { parts: [one(w.rule, w.targets.map((x) => C(x.n, x.good, x.good ? '' : T.explain(x.n).line)),
    { help: T.hint(), right: `${good.n} ${'×'} ${tt} = ${good.n * tt}` })] };
}

// ---- the lock boxes ------------------------------------------------------------------------------------------------

// "With x = 4: 2·4 + 6 is 14, but x + 11 is 15"
function subWhy(start, v) {
  try {
    const a = keySteps(start.L, v), b = keySteps(start.R, v);
    const av = a[a.length - 1], bv = b[b.length - 1];
    return `With x = ${nt(v)}: ${a[0]} is ${av}, but ${b[0]} is ${bv}.`;
  } catch (e) { return `x = ${nt(v)} doesn't make both sides the same.`; }
}
function checkLine(start, v) {
  try {
    const a = keySteps(start.L, v), b = keySteps(start.R, v);
    return `Check: ${a[0]} = ${a[a.length - 1]} and ${b[0]} = ${b[b.length - 1]}.`;
  } catch (e) { return ''; }
}
// near misses for x (the lab's own: the job has none at these levels)
function xChoices(x, route, rand) {
  const out = new Set([x]);
  const nums = route.map((m) => Number(String(m).replace(MINUS, '-').replace(/[^0-9.-]/g, ''))).filter((v) => Number.isFinite(v) && v !== 0);
  const cands = shuffle([x + 1, x - 1, -x, x + 2, x * 2, ...nums.map((k) => x + k), ...nums.map((k) => x - k)], rand)
    .filter((v) => Number.isInteger(v) && v !== x);
  for (const v of cands) { if (out.size >= 4) break; out.add(v); }
  for (let k = 3; out.size < 4; k++) out.add(x + k);
  return [...out];
}
function ineqVariants(set) {
  const p = set[0];
  const flip = [{ lo: p.hi, loIn: p.hiIn, hi: p.lo, hiIn: p.loIn }];
  const edge = [{ ...p, loIn: p.lo === null ? p.loIn : !p.loIn, hiIn: p.hi === null ? p.hiIn : !p.hiIn }];
  const off = [{ ...p, lo: p.lo === null ? null : p.lo + 1, hi: p.hi === null ? null : p.hi - 1 }];
  const neg = [{ lo: p.hi === null ? null : -p.hi, loIn: p.hiIn, hi: p.lo === null ? null : -p.lo, hiIn: p.loIn }];
  return { flip, edge, off, neg };
}

function lockbox(L, rand, { into, count }) {
  const rng = makeRng(Math.floor(rand() * 2 ** 32));
  const p = levelBox(L.gen, { rng, into, count });
  const pick = () => rand();
  if (p.mode === 'count') {
    return { parts: [one(p.words, p.choices.map((v) => C(v, v === p.answer, v === p.answer ? '' : kNudge(p, v))),
      { help: `${kHint(p, 1)} ${kHint(p, 2)}`, right: p.op === '+' ? `${p.a} + ${p.answer} = ${p.b}` : `${p.a} ${MINUS} ${p.answer} = ${p.b}` })] };
  }
  if (p.mode === 'key') {
    return { parts: [one(`${lineText(p.start)}: find x`, p.choices.map((v) => C(`x = ${nt(v)}`, v === p.answer, v === p.answer ? '' : subWhy(p.start, v))),
      { help: findHint(p, 2), right: `x = ${nt(p.answer)}. ${checkLine(p.start, p.answer)}` })] };
  }
  if (p.mode === 'work') {
    // a 'pick' step: which part goes first (order of operations); a 'part' step: work that part out
    const parts = p.steps.map((s, i) => {
      const last = i === p.steps.length - 1;
      const helpOf = Array.isArray(s.help) ? s.help[0] : s.help || p.rule || '';
      if (s.kind === 'pick') {
        return one(`${supText(s.expr.join(' ').replace(/ \^/g, '^'))}: which part first?`, s.choices.map((c) => C(supText(c.text), c.right, c.right ? '' : c.why)),
          { help: helpOf, right: last ? p.lines.map(supText).join(' → ') : `${supText(s.right)} first (${s.rule}).` });
      }
      return one(`${s.cap}: ${supText(s.q)} ${s.eq} ?`, s.choices.map((c) => C(supText(c.text), c.right, c.right ? '' : c.nudge)),
        { help: helpOf, right: last ? p.lines.map(supText).join(' → ') : `${supText(s.q)} ${s.eq} ${supText(s.answer)}` });
    });
    return { story: `Work it out: ${supText(p.start)}`, parts };
  }
  const moves = p.route && p.route.length ? `The moves: ${p.route.join(', then ')}.` : '';
  if (p.mode === 'ineq') {
    const q = p.start.chains.map(chainText).join(' or ');
    const right = setText(p.set), V = ineqVariants(p.set);
    const why = {
      flip: 'The sign points the wrong way. Dividing or multiplying by a negative turns it round; otherwise it stays.',
      edge: 'Look at the end number: < and > leave it out, ≤ and ≥ take it in.',
      off: 'One off at the end. Work the moves again and check the end number.',
      neg: 'The sign of the end number is turned.',
    };
    const seen = new Set([right]), choices = [C(right, true)];
    for (const k of shuffle(Object.keys(V), pick)) { const t = setText(V[k]); if (seen.has(t) || choices.length >= 4) continue; seen.add(t); choices.push(C(t, false, why[k])); }
    return { lab: true, parts: [one(`${q}: which numbers work?`, shuffle(choices, pick), { help: 'Do the same to both sides, as with an equation. Times or divide by a negative number turns the sign round.', right: `${moves} ${right}`.trim() })] };
  }
  const q = lineText(p.start);
  if (p.kind === 'all' || p.kind === 'none') {
    const right = p.kind === 'all' ? 'every number' : 'no solution';
    const choices = [C('every number', p.kind === 'all', p.kind === 'all' ? '' : 'The x terms cancel and the numbers left are NOT the same: nothing works.'),
      C('no solution', p.kind === 'none', p.kind === 'none' ? '' : 'The x terms cancel and both sides are the same: every number works.'),
      C('x = 0', false, 'Try x = 1 as well: the two sides behave the same for every number.'), C('x = 1', false, 'Try x = 0 as well: the two sides behave the same for every number.')];
    return { lab: true, parts: [one(`${q}: find x`, shuffle(choices, pick), { help: 'Take the x terms off one side and see what is left.', right: `${moves} ${right}.`.trim() })] };
  }
  const x = typeof p.x === 'number' ? p.x : Number(p.x);
  const vals = xChoices(x, p.route || [], pick);
  return { lab: true, parts: [one(`${q}: find x`, shuffle(vals, pick).map((v) => C(`x = ${nt(v)}`, v === x, v === x ? '' : subWhy(p.start, v))),
    { help: 'Do the same to both sides: get the x terms on one side and the numbers on the other.', right: `${moves} x = ${nt(x)}. ${checkLine(p.start, x)}`.trim() })] };
}

// ---- deer ----------------------------------------------------------------------------------------------------------

function deer(L, rand, { into, count }) {
  const rng = makeRng(Math.floor(rand() * 2 ** 32));
  const s = deerShot({ ...L.gen, read: !!L.read }, { n: 4, rng, into, count });
  const steps = (s.steps || []).map((st) => st.text + (st.note ? ` (${st.note})` : '')).join(' → ');
  return { story: s.words || '', parts: [one(`${s.eq}: photograph the deer whose tag fills the blank`,
    s.values.map((v, i) => C(numText(v), i === s.right, i === s.right ? '' : deerWhyNot(s, v))),
    { right: `${steps}${s.solved ? ` · ${s.solved}` : ''}` })] };
}

// ---- fishing and the building (their own question cards: prompt, choices, why, a picture) -------------------------

const strip = (v) => String(v);
function cardQ(q, labelOf) {
  const choices = q.choices.map((c, i) => {
    const good = strip(c) === strip(q.answer);
    return C(labelOf(c, i), good, good ? '' : q.why || '');
  });
  const steps = Array.isArray(q.steps) ? q.steps.join(' ') : '';
  const right = q.why && steps && (q.why.includes(steps) || steps.includes(q.why)) ? (steps.length > q.why.length ? steps : q.why) : [q.why, steps].filter(Boolean).join(' ');
  return one(q.prompt, choices, { help: q.rule || '', right });
}
function fishing(L, rand) {
  const g = L.gen;
  const q = questionAt(g, rand, g.kind === 'fish' ? { creel: practiceCreel(g.from, rand) } : {});
  const part = cardQ(q, (c, i) => (q.labels && q.labels[i] != null ? q.labels[i] : c));
  return { pic: typeof q.svg === 'string' ? q.svg : '', parts: [part] };
}
function building(L, rand) {
  const q = L.gen.level >= 8 ? panelQ(rand) : windmillQ(L.gen.level, rand);
  const unit = String(q.unit || '').trim() || (typeof q.answer === 'number' && q.kind === 'panel' ? 'ft' : '');
  const lab = (c, i) => (Array.isArray(q.labels) && q.labels[i] != null ? q.labels[i] : `${c}${typeof c === 'number' ? (unit === '°' ? '°' : unit ? ` ${unit}` : '') : ''}`);
  return { pic: typeof q.svg === 'string' ? q.svg : '', story: q.title || '', parts: [cardQ(q, lab)] };
}

// ---- sheep, pigs, range, loot --------------------------------------------------------------------------------------

function sheep(L, rand) {
  const it = itemAt(L.gen, true, rand, new Set());
  return { story: it.top ? `${it.top}` : '', parts: [one(`A sick sheep wears ${it.shown}. Which bottle cures her?`,
    it.bottles.map((b) => C(b.label, b.right, b.right ? '' : b.why)),
    { right: it.healed || it.fixed || '', help: typeof it.hint === 'string' ? it.hint : '' })] };
}
function pigs(L, rand) {
  const b = batchAt(L.gen, { size: 2, rand });
  const p = b.pigs[Math.floor(rand() * b.pigs.length)];
  const pen = (x) => `${x.label}${x.sub ? ` (${x.sub})` : ''}`;
  return { parts: [one(`A pig wears ${p.text}. Which pen?`, b.pens.map((x, i) => C(pen(x), i === p.pen, i === p.pen ? '' : p.done)),
    { help: p.help || '', right: p.done || '' })] };
}
function range(L, rand) {
  const c = cardAt(L.gen, { rng: makeRng(Math.floor(rand() * 2 ** 32)), what: rand() < 0.5 ? 'can' : 'bottle' });
  const pic = c.kind === 'dot' ? `A number line from ${numText(c.ask.lo)} to ${numText(c.ask.hi)}, the dot at ${numText(c.ask.v)}.` : '';
  const goods = c.targets.map((t, i) => i).filter((i) => c.targets[i].good);
  if (c.kind === 'order') {
    const order = c.targets.map((t, i) => i).sort((a, b) => (c.ask.dir === 'down' ? c.targets[b].n - c.targets[a].n : c.targets[a].n - c.targets[b].n));
    return { story: pic, parts: [{ ask: c.rule, mode: 'order', choices: c.targets.map((t) => C(numText(t.n), true)),
      order, help: tipFor(c), right: order.map((i) => numText(c.targets[i].n)).join(', '), answer: order.map((i) => numText(c.targets[i].n)).join(', '),
      whyAt: (i, picked) => rangeWhyNot(c, i, new Set(picked)) }] };
  }
  const part = { ask: c.rule, mode: goods.length > 1 ? 'many' : 'one',
    choices: c.targets.map((t, i) => C(numText(t.n), t.good, t.good ? '' : rangeWhyNot(c, i))),
    help: tipFor(c), right: tipFor(c), answer: goods.map((i) => numText(c.targets[i].n)).join(', ') };
  return { story: [c.sub, pic].filter(Boolean).join(' '), parts: [part] };
}
const coinsPart = (ask, coins, rightWhy, more = {}) => one(ask, coins.map((k) => C(k.label, k.good, k.good ? '' : k.why)), { right: rightWhy || '', ...more });
function loot(L, rand) {
  const p = shareAt(L.gen, { rand });
  return { story: p.story, parts: [coinsPart(p.ask, p.coins, p.rightWhy)] };
}
function store(L, rand, { into, count }) {
  const o = storeOrder(pickAsk(L.gen.mix, rand), { rand, longMost: 0, frac: into / Math.max(1, count) });
  return { story: o.story, kind: `${o.ask_.maker} step ${o.ask_.step}`, parts: [coinsPart(o.ask, o.coins, [o.rightWhy, o.afterWhy].filter(Boolean).join(' '))] };
}
function deliveries(L, rand) {
  const o = deliveriesOrder(L.gen, { rand, vocab: { week: true, fortnight: true } });
  return { story: o.story, parts: o.parts.map((p) => coinsPart(p.ask, p.coins, p.rightWhy)) };
}

const MAKERS = { roundup, wagon, lockbox, deer, fishing, sheep, pigs, range, loot, store, deliveries, building };

// The card as plain text (the "Confusing?" link copies this)
export function cardText(c, P, L) {
  const lines = [`Mathwood Valley practice: ${P.short} / ${L.id} "${L.title}" (level ${P.levels.indexOf(L) + 1} of ${P.levels.length})`,
    `seed ${c.seed}, into ${c.into}${c.lab ? ', choices made by the practice page' : ''}`];
  if (c.story) lines.push(c.story);
  c.parts.forEach((p, i) => {
    lines.push(`${c.parts.length > 1 ? `Q${i + 1}: ` : 'Q: '}${p.ask}`);
    lines.push('Choices: ' + p.choices.map((x) => (p.mode !== 'order' && x.good ? `[${x.label}]` : x.label)).join(' | '));
    lines.push('Answer: ' + p.answer);
  });
  return lines.join('\n');
}
