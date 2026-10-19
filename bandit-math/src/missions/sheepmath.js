// The math behind the sick-sheep job (missions/sheep.js): a flock's worth of equations, each written over a sheep. A
// healthy sheep's sum is right; a sick sheep's sum has one real mistake in it, the kind kids make:
//   times      a times fact one row off (7 × 8 = 63 is 7 × 9: one 7 too many), the times tables' own slip
//   negatives  a sign slip from the positive & negative topic (src/math/negatives.js): went the wrong way along the line
//              (−10 + 18 = −28), the right size on the wrong side of zero (−8), or dropped the signs (28)
//   algebra    a step of solving for x done wrong: the undoing done the wrong way (x + 5 = 12, so x = 17), or done to
//              one side only (x = 12), or on a times, taking away instead of dividing (3x = 12, so x = 9). The lock box's
//              steps card in reverse: the kid checks someone else's step
//   dividing   a division fact a row off (24 ÷ 6 = 5 is 30 ÷ 6: one 6 too many) or taken away instead (24 ÷ 6 = 18); on
//              the remainder steps (src/math/dividing.js) the leftover dropped (17 ÷ 5 = 3) or left big enough to go
//              round again (17 ÷ 5 = 2 r 7)
//   counting, adding, taking   a fact from the early topics with one of their real slips in it (after 6 comes 8, a
//              number skipped; 8 + 5 = 12, the 8 counted as a hop; 9 − 4 = 6, the same going back): their own files
//              (src/math/counting.js, adding.js, taking.js) make the sheep (sheepItem), help: { kind: 'count', ... }
//              is drawn by src/ui/counthelp.js
// Each sheep comes with two or three medicine bottles, each a fix ("should be 56"): on a sick sheep one is right and the
// others are other real slips; on a healthy sheep all of them would "fix" a right sum, so the bottles never give away
// which sheep is sick. The math is the only tell.
//
// Which kind of math, and how hard, come from the rider's skill model (src/math/skill.js, asked through
// src/math/asking.js): each flock goes to a maker that fits the rider now (counting or adding sums for a young rider,
// times facts, division, positive & negative or a step of solving for x for an older one), at the rider's level in
// that kind of math, and the first bottle given to each sick sheep goes back to it (sheep.js; a travel job: no time).
// The step of each maker: the times tables open at it and how far up they go, the positive & negative step's shapes
// and sizes, the solving-for-x rung (the lock boxes' own ladder).
//
//   SHEEP_MATH.maps, MAP_TOPIC            the makers this job deals from (skill.js map ids) and the topic each one is
//   flockTopics(rider)                    the topics whose makers fit the rider now, in SHEEP_MATH.topics order
//   flockFor(rider, { last, rand })       -> { topic, map, q } the next flock's topic and the model's answer (q: asking.js
//                                         askFor: q.at, q.step; it starts a strand's baseline the first time: save after)
//   flockStep(topic, q)                   the maker's step for makeFlock from q (the lock box's rung as its place in
//                                         the ladder)
//   levelOf(rider, topic)                 the kid's old topic step there (rider.topics.*: tests and old riders only)
//   makeFlock(rider, topic, { size, sick, rand, step }) -> { topic, level, sheep: [item, ...] }   (step: the maker's
//                                         step to deal at; left out, levelOf)
//     item = { kind, sick, top, shown, fixed, answer, slip, bottles: [{ label, value, right, why }], fine, healed, help }
//       top     the line before, for an algebra step ('x + 5 = 12'), else null
//       shown   the sum as written over the sheep ('7 × 8 = 63', 'x = 17'); fixed: the same, made right
//       answer  the right value; slip: the sick sheep's mistake (null on a healthy one)
//       bottles each fix: label ('should be 56'), its value, right (true on the one cure), why (one plain line said
//               when it is picked and isn't the cure)
//       fine    what Old Hob says when a healthy sheep is dosed: she's fine, and why her sum is right
//       healed  the line shown when the cure is given
//       help    the picture that helps: { kind: 'chart', table, missed } | { kind: 'line', start, change, op, term }
//               | { kind: 'rule', line } | { kind: 'count', frame, line } (src/ui/counthelp.js's picture)
//       op      positive & negative only: '+' or '-', the sum's sign (it counts in Addition or Subtraction)
//   SHEEP_MATH                            the dials
import { slipsFor, explainPick, problemText, numText, LADDER as NEG_LADDER, CONTRAST_CHANCE } from '../math/negatives.js';
import { tablesAt, reachAt } from '../math/times.js';
import { RUNG_IDS } from '../lockbox/generate.js';
import { LADDER as DIV_LADDER, remCode, remLabel } from '../math/dividing.js';
import { LADDER as COUNT_LADDER, sheepItem as countItem } from '../math/counting.js';
import { LADDER as ADD_LADDER, sheepItem as addItem } from '../math/adding.js';
import { LADDER as TAKE_LADDER, sheepItem as takeItem } from '../math/taking.js';
import { fits } from '../math/skill.js';
import { chooseFor, askFor } from '../math/asking.js';
import { youngMost } from '../lockbox/strand.js';
const EARLY = { counting: { ladder: COUNT_LADDER, item: countItem }, adding: { ladder: ADD_LADDER, item: addItem }, taking: { ladder: TAKE_LADDER, item: takeItem } };

export const SHEEP_MATH = {
  size: 6,               // sheep in a flock
  sick: [1, 2],          // how many are sick (each count as likely)
  bottles: 3,            // medicine bottles to pick from (2 when a sum has too few real slips to fill 3)
  topics: ['counting', 'adding', 'taking', 'times', 'dividing', 'negatives', 'algebra'],
  maps: ['counting', 'adding', 'taking', 'times', 'dividing', 'negatives', 'lockbox'],   // (the skill model's makers, same order)
};
export const MAP_TOPIC = { counting: 'counting', adding: 'adding', taking: 'taking', times: 'times', dividing: 'dividing', negatives: 'negatives', lockbox: 'algebra' };

const MINUS = '−', TIMES = '×';
const signed = (n) => numText(n);
const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];
const int = (lo, hi, rand) => (hi < lo ? lo : lo + Math.floor(rand() * (hi - lo + 1)));
function shuffle(a, rand) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function flockTopics(rider) {
  const list = SHEEP_MATH.maps.filter((m) => fits(rider, m, SHEEP_MATH.maps)).map((m) => MAP_TOPIC[m]);
  return list.length ? list : [MAP_TOPIC[chooseFor(rider, SHEEP_MATH.maps)]];
}
export function flockFor(rider, { last = null, rand = Math.random } = {}) {
  const lastMap = last ? SHEEP_MATH.maps.find((m) => MAP_TOPIC[m] === last) : null;
  const map = chooseFor(rider, SHEEP_MATH.maps, { last: lastMap, rand }) || 'times';
  return { topic: MAP_TOPIC[map], map, q: askFor(rider, map, map === 'lockbox' ? { most: youngMost(rider) } : {}) };   // (read aloud: the lock box's hold)
}
export function flockStep(topic, q) {
  if (topic === 'algebra') { const i = RUNG_IDS.indexOf(q && q.id); return i >= 0 ? i + 1 : 1; }   // (a rung the sheep don't know: the first)
  return Math.max(1, Math.round((q && q.step) || 1));
}

export function levelOf(rider, topic) {
  const T = (rider && rider.topics) || {};
  if (topic === 'algebra') { const i = RUNG_IDS.indexOf((T.algebra && T.algebra.rung) || 'R1'); return Math.max(1, i + 1); }
  const st = T[topic] && Number.isFinite(+T[topic].step) ? Math.round(+T[topic].step) : 1;
  const top = topic === 'negatives' ? NEG_LADDER.length : topic === 'dividing' ? DIV_LADDER.length : EARLY[topic] ? EARLY[topic].ladder.length : 99;
  return Math.max(1, Math.min(top, st));
}

// ── TIMES TABLES ─────────────────────────────────────────────────────────────────────────────────────────────────
function timesItem(step, sick, rand, used) {
  let tables = tablesAt(step); if (!tables.length) tables = [2];
  // a fact from the kid's own tables; when the first steps run short of new ones (the 2s up to x5 has only four), the
  // same fact turned round (3 × 2 for 2 × 3) is a new sum to check. Its rows are still the table's own (the 2s)
  let a = 2, b = 2, flip = false;
  for (let k = 0; k < 40; k++) {
    a = pick(tables, rand); const reach = Math.max(3, reachAt(a, step) || 5);
    b = int(2, reach, rand); flip = k >= 20 && rand() < 0.5;
    if (!used.has(flip ? `${b}x${a}` : `${a}x${b}`)) break;
  }
  used.add(flip ? `${b}x${a}` : `${a}x${b}`);
  const r = a * b, fact = flip ? `${b} ${TIMES} ${a}` : `${a} ${TIMES} ${b}`;
  // the fixes a kid could reach for, each a real slip: a row up, a row down, the next table's row
  const kinds = [
    { slip: 'rowUp', value: a * (b + 1), why: `That's ${a} ${TIMES} ${b + 1}, one row too far. ${fact} is one ${a} less: ${a * (b + 1)} ${MINUS} ${a} = ${r}.` },
    { slip: 'rowDown', value: a * (b - 1), why: `That's ${a} ${TIMES} ${b - 1}, a row short. ${fact} is one more ${a}: ${a * (b - 1)} + ${a} = ${r}.` },
    { slip: 'table', value: (a + 1) * b, why: `That's ${a + 1} ${TIMES} ${b}, from the ${a + 1}s. In the ${a}s, ${fact} = ${r}.` },
    { slip: 'near', value: r + (rand() < 0.5 ? 1 : -1), why: null },
  ].filter((k) => k.value > 0 && k.value !== r);
  for (const k of kinds) if (!k.why) k.why = `Just one off. Count up the ${a}s: ${fact} = ${r}.`;
  const rows = kinds.filter((k) => k.slip === 'rowUp' || k.slip === 'rowDown');
  const slipK = sick ? pick(rows, rand) : null;
  const shown = sick ? slipK.value : r;
  const others = shuffle(kinds.filter((k) => k !== slipK && k.value !== shown), rand);
  // the bottles: the cure and other real slips (rows first: they are the ones that look most like the cure)
  others.sort((p, q) => (p.slip === 'near') - (q.slip === 'near'));
  const wrong = dedupe(others, r, shown).slice(0, sick ? SHEEP_MATH.bottles - 1 : SHEEP_MATH.bottles);
  const bottles = shuffle([...(sick ? [{ value: r, right: true, why: null }] : []), ...wrong.map((k) => ({ value: k.value, right: false, why: k.why }))], rand)
    .map((x) => ({ ...x, label: `should be ${x.value}` }));
  const before = b > 1 ? ` (${a} ${TIMES} ${b - 1} = ${a * (b - 1)}, and one more ${a} is ${r})` : '';
  return {
    kind: 'times', sick, top: null, shown: `${fact} = ${shown}`, fixed: `${fact} = ${r}`, answer: r, slip: sick ? slipK.slip : null,
    bottles, fine: `She's fine: ${fact} = ${r} is right${before}.`,
    healed: sick ? (slipK.slip === 'rowUp' ? `${fact} = ${r}: ${shown} was ${a} ${TIMES} ${b + 1}, one row too far.` : `${fact} = ${r}: ${shown} was ${a} ${TIMES} ${b - 1}, a row short.`) : `${fact} = ${r}`,
    help: { kind: 'chart', table: a, missed: sick ? shown : null },
  };
}
// distinct values, none the right answer or the sum already written
function dedupe(list, r, shown) {
  const seen = new Set([r, shown]), out = [];
  for (const k of list) if (!seen.has(k.value)) { seen.add(k.value); out.push(k); }
  return out;
}

// ── POSITIVE & NEGATIVE ──────────────────────────────────────────────────────────────────────────────────────────
// A problem of one shape with numbers up to max (the same shapes as the positive & negative ladder, src/math/negatives.js)
function negProblem(shape, max, rand) {
  const low = max >= 50 ? 4 : max >= 20 ? 2 : 1;
  const big = (lo) => int(Math.max(lo, Math.ceil(max / 3)), max, rand);
  for (let tries = 0; tries < 30; tries++) {
    let p;
    switch (shape) {
      case 'upPos': { const b = big(low + 1); const a = int(low, b - 1, rand); p = { s: -a, op: '+', t: b }; break; }
      case 'upNeg': { const a = big(low + 1); const b = int(low, a - 1, rand); p = { s: -a, op: '+', t: b }; break; }
      case 'zero': { const a = int(Math.max(2, low), max, rand); p = { s: -a, op: '+', t: a }; break; }
      case 'down': { const a = int(low, max - 1, rand); const b = int(low, Math.max(low, Math.min(max, max - a + 4)), rand); p = { s: -a, op: '-', t: b }; break; }
      case 'cross': { const b = big(low + 1); const a = int(low, b - 1, rand); p = { s: a, op: '-', t: b }; break; }
      case 'short': { const a = big(low + 1); const b = int(low, a - 1, rand); p = { s: a, op: '-', t: b }; break; }
      case 'double': { const a = int(Math.max(2, low), Math.max(2, Math.floor(max / 2)), rand); const k = rand(); p = k < 0.4 ? { s: -a, op: '-', t: a } : k < 0.7 ? { s: -a, op: '+', t: -a } : { s: a, op: '-', t: -a }; break; }
      case 'subNeg': { const a = int(low, max - 1, rand) * (rand() < 0.7 ? 1 : -1); const b = int(low, max - 1, rand); p = { s: a, op: '-', t: -b }; break; }
      case 'addNeg': { const a = int(low, max, rand) * (rand() < 0.75 ? 1 : -1); const b = int(low, max, rand); p = { s: a, op: '+', t: -b }; break; }
      default: { const a = int(Math.max(2, low), max, rand); let b = int(Math.max(2, low), max, rand); if (b === a) b = a < max ? a + 1 : a - 1; p = { s: -a, op: rand() < 0.5 ? '+' : '-', t: b }; break; }
    }
    const r = p.s + (p.op === '-' ? -p.t : p.t);
    if (Math.abs(r) <= 99 && p.s !== 0 && r !== 0) return p;   // (no zero answers: "should be 0" next to a zero pair is no puzzle)
  }
  return { s: -3, op: '+', t: 7 };
}
function negItem(step, sick, rand, used) {
  const row = NEG_LADDER[step - 1] || NEG_LADDER[0];
  let p = null;
  for (let k = 0; k < 20; k++) {
    const shape = row.contrast && rand() < CONTRAST_CHANCE ? row.contrast : pick(row.shapes, rand);
    p = negProblem(shape, row.max, rand);
    if (!used.has(problemText(p.s, p.op, p.t))) break;
  }
  const text = problemText(p.s, p.op, p.t); used.add(text);
  const c = p.op === '-' ? -p.t : p.t, r = p.s + c, sl = slipsFor(p.s, p.op, p.t);
  const card = { text, parts: { start: p.s, change: c, op: p.op, term: p.t } };
  // the slips this sum allows, the wrong way first (the one this topic is here for)
  const slips = [
    { slip: 'way', value: sl.way, w: 3 }, { slip: 'sign', value: sl.sign, w: 2 }, { slip: 'drop', value: sl.drop, w: 1 },
    { slip: 'start', value: sl.start, w: 1 }, { slip: 'near', value: r + 1, w: 0.5 }, { slip: 'near', value: r - 1, w: 0.5 },
  ].filter((k) => k.value !== r);
  let slipK = null;
  if (sick) {
    const main = slips.filter((k) => k.slip === 'way' || k.slip === 'sign' || k.slip === 'drop');
    let sum = 0; for (const k of main) sum += k.w;
    let x = rand() * sum; slipK = main[main.length - 1];
    for (const k of main) { x -= k.w; if (x < 0) { slipK = k; break; } }
  }
  const shown = sick ? slipK.value : r;
  const wrong = dedupe(slips.filter((k) => k !== slipK), r, shown).slice(0, sick ? SHEEP_MATH.bottles - 1 : SHEEP_MATH.bottles);
  const bottles = shuffle([...(sick ? [{ value: r, right: true, why: null }] : []), ...wrong.map((k) => ({ value: k.value, right: false, why: explainPick(card, k.value).line }))], rand)
    .map((x) => ({ ...x, label: `should be ${signed(x.value)}` }));
  const how = explainPick(card, r).line;     // '−10 + 18 = 8: 10 steps to zero, 8 more.'
  const said = { way: 'went the wrong way along the line', sign: 'landed on the wrong side of zero', drop: 'dropped the signs' };
  return {
    kind: 'negatives', op: p.op, sick, top: null, shown: `${text} = ${signed(shown)}`, fixed: `${text} = ${signed(r)}`, answer: r, slip: sick ? slipK.slip : null,
    bottles, fine: `She's fine: ${how}`, healed: sick ? `${how} Her sum ${said[slipK.slip] || 'slipped'}.` : how,
    help: { kind: 'line', start: p.s, change: c, op: p.op, term: p.t },
  };
}

// ── SOLVING FOR X: one step of the working, checked ───────────────────────────────────────────────────────────────
// rung (1 = the first lock-box rung) -> which equations: adding/taking away (x + 5 = 12), then times (3x = 12), then
// with negatives (x + 7 = 3), then two steps (2x + 5 = 17 -> 2x = 12)
const R = (id) => RUNG_IDS.indexOf(id) + 1;
function algebraItem(rung, sick, rand, used) {
  const kinds = ['add', 'sub'];
  if (rung >= R('R3')) kinds.push('times', 'times');
  if (rung >= R('R5')) kinds.push('addNeg');
  if (rung >= R('R6')) kinds.push('two', 'two', 'two');
  const negs = rung >= R('R7');
  let it = null;
  for (let k = 0; k < 20 && (!it || used.has(it.top)); k++) it = algebraOne(pick(kinds, rand), negs, rand);
  used.add(it.top);
  it.slips = it.slips.filter((s) => s.value !== it.answer);
  const slipK = sick ? pick(it.slips.filter((s) => s.sick !== false), rand) : null;
  const shown = sick ? slipK.value : it.answer;
  const wrong = dedupe(it.slips.filter((s) => s !== slipK), it.answer, shown).slice(0, sick ? SHEEP_MATH.bottles - 1 : SHEEP_MATH.bottles);
  const bottles = shuffle([...(sick ? [{ value: it.answer, right: true, why: null }] : []), ...wrong.map((s) => ({ value: s.value, right: false, why: s.why }))], rand)
    .map((x) => ({ ...x, label: `should be ${it.lhs} = ${signed(x.value)}` }));
  return {
    kind: 'algebra', sick, top: it.top, shown: `${it.lhs} = ${signed(shown)}`, fixed: `${it.lhs} = ${signed(it.answer)}`, answer: it.answer, slip: sick ? slipK.slip : null,
    bottles, fine: `She's fine: ${it.how.charAt(0).toLowerCase()}${it.how.slice(1)}`, healed: sick ? `${it.how} ${slipK.healed}` : it.how,
    help: { kind: 'rule', line: 'Whatever you do to one side, do to the other.' },
  };
}
// one equation and the step after it: { top, lhs, answer, how, slips: [{ slip, value, why, healed }] }
function algebraOne(kind, negs, rand) {
  const N = (n) => signed(n);
  if (kind === 'times') {
    const a = int(2, 9, rand), x = int(2, 10, rand), b = a * x;
    return { top: `${a}x = ${b}`, lhs: 'x', answer: x, how: `${a}x means ${a} times x: divide both sides by ${a}, x = ${b} ÷ ${a} = ${x}.`,
      slips: [
        { slip: 'takeAway', value: b - a, why: `${a}x is ${a} times x, not x + ${a}. Undo times by dividing both sides by ${a}: ${b} ÷ ${a} = ${x}.`, healed: 'Her step took away instead of dividing.' },
        { slip: 'timesAgain', value: b * a, why: `Times ${a} again makes it bigger. To undo times ${a}, divide both sides by ${a}: ${b} ÷ ${a} = ${x}.`, healed: 'Her step multiplied instead of dividing.' },
        { slip: 'near', value: x + 1, sick: false, why: `Check it: ${a} ${TIMES} ${x + 1} = ${a * (x + 1)}, not ${b}. ${b} ÷ ${a} = ${x}.` },
      ] };
  }
  if (kind === 'two') {
    const a = int(2, 6, rand), x = negs && rand() < 0.4 ? -int(1, 8, rand) : int(1, 9, rand);
    let b = int(2, 15, rand); if (negs && rand() < 0.5) b = -b;
    const c = a * x + b, ax = a * x, op = b < 0 ? MINUS : '+';
    const undo = b < 0 ? `add ${-b} to` : `take ${b} from`, sum = b < 0 ? `${N(c)} + ${-b}` : `${N(c)} ${MINUS} ${b}`;
    return { top: `${a}x ${op} ${Math.abs(b)} = ${N(c)}`, lhs: `${a}x`, answer: ax,
      how: `To free ${a}x, ${undo} both sides: ${a}x = ${sum} = ${N(ax)}.`,
      slips: [
        { slip: 'way', value: c + b, why: `To undo ${op} ${Math.abs(b)}, ${undo} both sides (not the other way): ${sum} = ${N(ax)}.`, healed: 'Her step went the wrong way.' },
        { slip: 'oneSide', value: c, why: `The ${Math.abs(b)} came off the left side only. Whatever you do to one side, do to the other: ${sum} = ${N(ax)}.`, healed: 'Her step was done to one side only.' },
        { slip: 'sign', value: -ax, why: `Right size, wrong side of zero: ${sum} = ${N(ax)}.`, healed: 'Her sum landed on the wrong side of zero.' },
      ].filter((s) => s.value !== ax) };
  }
  // one step, adding or taking away (with a negative answer from the 'addNeg' rung on)
  let a, x;
  if (kind === 'addNeg') { a = int(3, 12, rand); x = -int(1, a - 1, rand); }
  else { a = int(2, 12, rand); x = int(1, 15, rand); }
  const sub = kind === 'sub', b = sub ? x - a : x + a;
  if (sub && b <= 0) return algebraOne('add', negs, rand);
  const top = sub ? `x ${MINUS} ${a} = ${N(b)}` : `x + ${a} = ${N(b)}`;
  const undo = sub ? `add ${a} to both sides` : `take ${a} from both sides`, sum = sub ? `${N(b)} + ${a}` : `${N(b)} ${MINUS} ${a}`;
  return { top, lhs: 'x', answer: x, how: `To free x, ${undo}: x = ${sum} = ${N(x)}.`,
    slips: [
      { slip: 'way', value: sub ? b - a : b + a, why: `To undo ${sub ? MINUS : '+'} ${a}, ${undo} (not the other way): x = ${sum} = ${N(x)}.`, healed: 'Her step went the wrong way.' },
      { slip: 'oneSide', value: b, why: `The ${a} came off the left side only. Whatever you do to one side, do to the other: x = ${sum} = ${N(x)}.`, healed: 'Her step was done to one side only.' },
      ...(x < 0 ? [{ slip: 'sign', value: -x, why: `Right size, wrong side of zero: ${sum} = ${N(x)}.`, healed: 'Her sum landed on the wrong side of zero.' }] : []),
      { slip: 'near', value: x + 1, sick: false, why: `Just one off: x = ${sum} = ${N(x)}.` },
    ].filter((s) => s.value !== x) };
}

// ── DIVIDING: a division fact (or a remainder) checked ────────────────────────────────────────────────────────────
// The fact from the kid's own dividing step (src/math/dividing.js): the sharing steps and the facts written as a sum
// (12 ÷ 3 = 4), the remainder steps with their leftover (17 ÷ 5 = 3 r 2). A sick sum is a row off the times table, or
// taken away instead of shared; a sick remainder dropped its leftover or stopped dealing a round early. Its values are
// plain numbers (a remainder's is each × 100 + left over, as the round-up's), each with its label.
function divItem(step, sick, rand, used) {
  const row = DIV_LADDER[step - 1] || DIV_LADDER[0];
  const tables = row.older && rand() < 0.3 ? row.older : row.tables;
  let d = 2, q = 2, r = 0;
  for (let k = 0; k < 30; k++) {
    d = pick(tables, rand); q = int(2, row.most, rand); r = row.kind === 'rem' ? int(1, d - 1, rand) : 0;
    if (!used.has(`${d * q + r}/${d}`)) break;
  }
  const n = d * q + r; used.add(`${n}/${d}`);
  const DIV = '÷', sum = `${n} ${DIV} ${d}`;
  if (row.kind === 'rem') {
    const ans = remCode(q, r), lab = (v) => remLabel(Math.floor(v / 100), v % 100);
    const kinds = [
      { slip: 'noRem', value: remCode(q, 0), why: `${q} ${TIMES} ${d} = ${q * d}, and ${n} ${MINUS} ${q * d} = ${r} is left over. Keep the leftover: ${q} r ${r}.` },
      ...(q >= 2 ? [{ slip: 'short', value: remCode(q - 1, r + d), why: `${r + d} left over is enough for another round of ${d}. The leftover is always smaller than ${d}.` }] : []),
      { slip: 'over', value: remCode(q + 1, 0), why: `${q + 1} ${TIMES} ${d} = ${(q + 1) * d}: more than ${n}. Only ${q} whole rounds fit.` },
      ...(r + 1 < d ? [{ slip: 'near', value: remCode(q, r + 1), why: `${q} ${TIMES} ${d} = ${q * d}, and ${n} ${MINUS} ${q * d} = ${r}, not ${r + 1}.` }] : []),
      ...(r >= 2 ? [{ slip: 'near', value: remCode(q, r - 1), why: `${q} ${TIMES} ${d} = ${q * d}, and ${n} ${MINUS} ${q * d} = ${r}, not ${r - 1}.` }] : []),
    ].filter((k) => k.value !== ans);
    const main = kinds.filter((k) => k.slip === 'noRem' || k.slip === 'short');
    const slipK = sick ? pick(main, rand) : null;
    const shown = sick ? slipK.value : ans;
    const wrong = dedupe(kinds.filter((k) => k !== slipK), ans, shown).slice(0, sick ? SHEEP_MATH.bottles - 1 : SHEEP_MATH.bottles);
    const bottles = shuffle([...(sick ? [{ value: ans, right: true, why: null }] : []), ...wrong.map((k) => ({ value: k.value, right: false, why: k.why }))], rand)
      .map((x) => ({ ...x, label: `should be ${lab(x.value)}` }));
    const how = `${sum} = ${q} r ${r}: ${q} ${TIMES} ${d} = ${q * d}, and ${r} left over.`;
    return {
      kind: 'dividing', sick, top: null, shown: `${sum} = ${lab(shown)}`, fixed: `${sum} = ${q} r ${r}`, answer: ans, slip: sick ? slipK.slip : null,
      bottles, fine: `She's fine: ${how}`, healed: sick ? `${how} ${slipK.slip === 'noRem' ? 'Her sum dropped the leftover.' : 'Her sum stopped a round short.'}` : how,
      help: { kind: 'rule', line: `Deal ${n} out ${d} at a time. The leftover is what can't go round again: always smaller than ${d}.` },
    };
  }
  const kinds = [
    { slip: 'rowUp', value: q + 1, why: `${q + 1} ${TIMES} ${d} = ${(q + 1) * d}, one ${d} too many. ${q} ${TIMES} ${d} = ${n}, so ${sum} = ${q}.` },
    { slip: 'rowDown', value: q - 1, why: `${q - 1} ${TIMES} ${d} = ${(q - 1) * d}, one ${d} short. ${q} ${TIMES} ${d} = ${n}, so ${sum} = ${q}.` },
    { slip: 'sub', value: n - d, why: `${n} ${MINUS} ${d} takes ${d} away once. Sharing asks how many ${d}s make ${n}: ${q}.` },
    { slip: 'divisor', value: d, why: `${d} is what ${n} is shared by. ${q} ${TIMES} ${d} = ${n}, so each gets ${q}.` },
  ].filter((k) => k.value > 0 && k.value !== q);
  const main = kinds.filter((k) => k.slip === 'rowUp' || k.slip === 'rowDown' || (k.slip === 'sub' && rand() < 0.4));
  const slipK = sick ? pick(main, rand) : null;
  const shown = sick ? slipK.value : q;
  const wrong = dedupe(kinds.filter((k) => k !== slipK), q, shown).slice(0, sick ? SHEEP_MATH.bottles - 1 : SHEEP_MATH.bottles);
  const bottles = shuffle([...(sick ? [{ value: q, right: true, why: null }] : []), ...wrong.map((k) => ({ value: k.value, right: false, why: k.why }))], rand)
    .map((x) => ({ ...x, label: `should be ${x.value}` }));
  const how = `${sum} = ${q}, because ${q} ${TIMES} ${d} = ${n}.`;
  const said = { rowUp: `${shown} was one ${d} too many.`, rowDown: `${shown} was one ${d} short.`, sub: `${shown} took ${d} away instead of sharing.` };
  return {
    kind: 'dividing', sick, top: null, shown: `${sum} = ${shown}`, fixed: `${sum} = ${q}`, answer: q, slip: sick ? slipK.slip : null,
    bottles, fine: `She's fine: ${how}`, healed: sick ? `${how} ${said[slipK.slip] || ''}`.trim() : how,
    help: { kind: 'chart', table: d, find: n, rule: `${d} ${TIMES} ? = ${n}` },
  };
}

// ── A FLOCK ──────────────────────────────────────────────────────────────────────────────────────────────────────
export function makeFlock(rider, topic = 'times', { size = SHEEP_MATH.size, sick = null, rand = Math.random, step = null } = {}) {
  const level = step != null ? Math.max(1, Math.round(step)) : levelOf(rider, topic);
  const nSick = Math.max(1, Math.min(size - 1, sick != null ? sick : pick(SHEEP_MATH.sick, rand)));
  const which = new Set(shuffle([...Array(size).keys()], rand).slice(0, nSick));
  const used = new Set(), sheep = [];
  for (let i = 0; i < size; i++) {
    const ill = which.has(i);
    sheep.push(topic === 'negatives' ? negItem(level, ill, rand, used) : topic === 'algebra' ? algebraItem(level, ill, rand, used)
      : topic === 'dividing' ? divItem(level, ill, rand, used) : EARLY[topic] ? EARLY[topic].item(level, ill, rand, used) : timesItem(level, ill, rand, used));
  }
  return { topic, level, sick: nSick, sheep };
}
