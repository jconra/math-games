// The surveyor's cards at the Explorer's survey table (src/jobs/survey.js) and their pictures (src/jobs/surveyview.js):
// the ladder joins Mathwood's levels cleanly; every level deals good cards; every right answer is worked out again here
// from the card's own facts (the chart's numbers, the readings, the squares), by code that shares nothing with the
// makers; the pictures show those very numbers; no wrong answer is worth the same as the right one; a tap on the map is
// judged by the crossing nearest it; on a captain's run a card pays nothing by itself.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import { JOB, PLACE, MAKERS, KINDS, mapJudge } from '../src/jobs/survey.js';
import { COLOUR, landMap } from '../src/jobs/surveyview.js';
import { mapSpot } from '../src/jobs/pics.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';
import { setLevelAt } from '../../mathwood-valley/src/levels/model.js';
import { PROBLEMS, PLACE as PLACES } from '../../mathwood-valley/src/levels/places.js';
import { STRAND } from '../../mathwood-valley/src/math/skill.js';

const crewOf = () => ({ id: 'c1', name: 'Test', look: { id: 'zuri' } });
const MINUS = (s) => String(s).replace(/−/g, '-');
const pt = (x, y) => `(${x}, ${y})`.replace(/-/g, '−');
const right = (o) => o.coins.find((c) => c.good);
// every card of a level, dealt as the game deals them
function cards(levelId, n, seed) {
  const rand = seeded(seed), out = [];
  for (let k = 0; k < n; k++) { const crew = crewOf(); setLevelAt(crew, 'survey', levelId); out.push(E.deal(crew, JOB, { rand }).order); }
  return out;
}
const ALL = () => PLACE.levels.flatMap((L, i) => cards(L.id, 120, 1000 + i * 7));
const fracVal = (s) => { const [a, b] = String(s).split('/').map(Number); return a / b; };

test('the surveyor\'s ladder joins Mathwood\'s levels cleanly, on the school guide, with no new kind of math', () => {
  assert.equal(E.register(JOB), true);
  assert.deepEqual(PROBLEMS, []);
  assert.ok(PLACES.survey, 'the survey place');
  assert.equal(PLACE.levels.length, 24);
  for (let i = 0; i < PLACE.levels.length; i++) {
    const L = PLACE.levels[i];
    assert.ok(Number.isFinite(L.grade) && L.grade >= 0 && L.grade <= 100, `${L.id}: grade ${L.grade}`);
    assert.ok(STRAND[L.strand], `${L.id}: strand ${L.strand} is one of Mathwood's`);
    if (i) assert.ok(L.grade >= PLACE.levels[i - 1].grade, `${L.id}: ${L.grade} after ${PLACE.levels[i - 1].grade}`);
  }
  assert.equal(PLACE.levels[0].grade, 0);
  assert.ok(PLACE.levels[PLACE.levels.length - 1].grade >= 75);
  // charts, averages, chance and the map: each has levels
  for (const m of ['count', 'pict', 'bar', 'dots', 'line', 'map', 'mean', 'chance']) assert.ok(PLACE.levels.some((L) => L.gen.mix[0].maker === m), m);
  // Mathwood's own places are all still there
  for (const id of ['roundup', 'store', 'lockbox', 'graphs']) assert.ok(PLACES[id], id);
});

test('every level deals cards with one right answer, wrong answers that each say why, a picture, and Help that never gives the answer', () => {
  const WEST = /\b(horse|cattle|wagon|saloon|stagecoach|rifle|cowhand|steer|gold|sheriff|saddle)/i;
  const keys = new Set();
  for (const L of PLACE.levels) {
    for (const o of cards(L.id, 150, L.grade * 13 + 5)) {
      keys.add(o.key);
      const what = `${L.id} ${o.key}: ${o.story} ${o.ask}`;
      assert.equal(o.coins.filter((c) => c.good).length, 1, what);
      assert.ok(o.coins.length >= 3, `${what}: ${o.coins.length} answers`);
      assert.equal(new Set(o.coins.map((c) => c.label)).size, o.coins.length, `${what}: two answers alike`);
      for (const c of o.coins.filter((x) => !x.good && x.v !== 'else')) assert.ok(c.slip && c.why && c.why.length > 12, `${what}: ${c.label} has no why`);
      const text = `${o.story} ${o.ask} ${o.coins.map((c) => `${c.big} ${c.small} ${c.why}`).join(' ')} ${o.rightWhy} ${o.help.line} ${o.help.steps.join(' ')}`;
      assert.ok(!/NaN|undefined|Infinity|\[object|null/.test(text), `${what}: ${text}`);
      assert.ok(!WEST.test(`${o.story} ${o.ask}`), `${what}: the west got in`);
      assert.ok(o.own && STRAND[o.own.strand] && Number.isFinite(o.own.at), `${what}: its kind of math`);
      // a picture on the card (the map to tap is drawn by the card itself), and Help's
      const pic = o.tap ? o.tap.draw([]) : o.lead;
      if (!/^chance:expect/.test(o.key)) assert.ok(pic && pic.startsWith('<svg') && !/NaN|undefined/.test(pic), `${what}: no picture`);
      assert.ok(o.help.svg.startsWith('<svg') && !/NaN|undefined/.test(o.help.svg), `${what}: no help picture`);
      assert.ok(o.help.title && o.help.line && o.help.steps.length, `${what}: help`);
      const R = right(o), help = `${o.help.line} ${o.help.steps.join(' ')}`;
      assert.ok(!help.includes(`= ${R.big}`) && !help.includes(`is ${R.big}.`), `${what}: help gives the answer ${R.big}: ${help}`);
    }
  }
  // every kind of card turns up
  for (const k of ['count:one', 'count:sort', 'count:most', 'pict:read:1', 'pict:more:1', 'pict:all:1', 'pict:read:5', 'bar:read:1', 'bar:fewer:1', 'bar:read:10', 'bar:all4', 'bar:vsTwo',
    'dots:count', 'dots:most', 'dots:over', 'dots:spread', 'line:warmest', 'line:warmer', 'map:tap:quarter', 'map:read:whole', 'map:apart:across', 'map:apart:up',
    'mean:average', 'mean:missing', 'mean:median', 'mean:mode', 'mean:range', 'chance:words', 'chance:fraction', 'chance:percent', 'chance:expect:frac', 'chance:both']) assert.ok(keys.has(k), k);
});

test('every right answer is the one the card\'s own numbers give, worked out again here', () => {
  let n = 0;
  for (const o of ALL()) {
    const f = o.facts, R = right(o), what = `${o.key}: ${o.story} ${o.ask} -> ${R.label}`;
    const [maker, form] = o.key.split(':');
    n++;
    if (maker === 'count') {
      const by = {}; for (const it of f.items) by[it.kind] = (by[it.kind] || 0) + 1;
      if (form === 'one' || form === 'sort') assert.equal(R.v, by[f.kind], what);
      else { const vs = Object.values(by), want = form === 'most' ? Math.max(...vs) : Math.min(...vs); assert.equal(by[R.v], want, what); assert.equal(vs.filter((v) => v === want).length, 1, `${what}: two kinds tie`); }
      // the scan shows exactly the finds counted: each kind's picture as many times as it was found
      for (const [kind, c] of Object.entries(by)) assert.equal((o.lead.match(new RegExp(`fill="${COLOUR[kind]}"`, 'g')) || []).length, c, `${what}: the scan's ${kind}`);
    } else if (maker === 'pict') {
      const v = f.rows.map((r) => r.n * f.key);
      if (form === 'read') assert.equal(R.v, v[f.ask], what);
      else if (form === 'most' || form === 'fewest') assert.equal(v[f.rows.findIndex((r) => r.label.toLowerCase() === R.v)], (form === 'most' ? Math.max : Math.min)(...v), what);
      else assert.equal(R.v, form === 'all' ? v[f.a] + v[f.b] : Math.abs(v[f.a] - v[f.b]), what);
      for (const r of f.rows) assert.ok(o.lead.includes(`>${r.label}<`), `${what}: the chart names ${r.label}`);
    } else if (maker === 'bar') {
      const v = f.bars.map((b) => b.v);
      if (form === 'read') assert.equal(R.v, v[f.ask], what);
      else if (form === 'most' || form === 'fewest') assert.equal(v[f.bars.findIndex((b) => b.label.toLowerCase() === R.v)], (form === 'most' ? Math.max : Math.min)(...v), what);
      else if (form === 'all4') assert.equal(R.v, v.reduce((a, b) => a + b, 0), what);
      else if (form === 'vsTwo') assert.equal(R.v, v[0] - v[1] - v[2], what);
      else assert.equal(R.v, form === 'all' ? v[f.a] + v[f.b] : Math.abs(v[f.a] - v[f.b]), what);
      // every bar stands on a line of the scale, so it can be read exactly
      for (const x of v) assert.equal(x % f.step, 0, `${what}: a bar between the lines`);
      for (const b of f.bars) assert.ok(o.lead.includes(`>${b.label}<`), `${what}: the chart names ${b.label}`);
    } else if (maker === 'dots') {
      const L = Object.keys(f.counts).map(Number), c = (x) => f.counts[x] || 0;
      if (form === 'count') assert.equal(R.v, c(f.at), what);
      if (form === 'all') assert.equal(R.v, L.reduce((s, x) => s + c(x), 0), what);
      if (form === 'most') { const top = Math.max(...L.map(c)); assert.equal(c(R.v), top, what); assert.equal(L.filter((x) => c(x) === top).length, 1, `${what}: two lengths tie`); }
      if (form === 'over') assert.equal(R.v, L.filter((x) => x > f.at).reduce((s, x) => s + c(x), 0), what);
      if (form === 'spread') assert.equal(R.v, Math.max(...L) - Math.min(...L), what);
      // the plot has a dot for every crystal
      assert.equal((o.lead.match(/<circle /g) || []).length, L.reduce((s, x) => s + c(x), 0), `${what}: the dots`);
    } else if (maker === 'line') {
      const v = f.points.map((p) => p.v);
      if (form === 'warmer') assert.equal(R.v, v[f.b] - v[f.a], what);
      else { const want = (form === 'warmest' ? Math.max : Math.min)(...v); assert.equal(v[f.points.findIndex((p) => p.label === R.v)], want, what); assert.equal(v.filter((x) => x === want).length, 1, `${what}: a tie`); }
      for (const x of v) assert.equal(x % 5, 0, `${what}: a point between the lines`);
    } else if (maker === 'map') {
      if (form === 'apart') {
        const i = f.across ? 0 : 1, j = 1 - i;
        assert.equal(f.from[j], f.to[j], `${what}: not in a line`);
        assert.equal(R.v, Math.abs(f.to[i] - f.from[i]), what);
        assert.ok(f.from[i] < 0 && f.to[i] > 0, `${what}: over 0`);
      } else {
        assert.equal(MINUS(R.v), `(${f.x}, ${f.y})`, what);
        if (f.whole) assert.ok(f.x < 0 || f.y < 0, `${what}: the whole map has a minus`);
        else assert.ok(f.x >= 0 && f.y >= 0 && f.x <= 6 && f.y <= 6, what);
      }
    } else if (maker === 'mean') {
      const v = f.values, s = [...v].sort((a, b) => a - b), sum = v.reduce((a, b) => a + b, 0);
      if (form === 'average') assert.equal(R.v * v.length, sum, what);
      if (form === 'missing') { assert.equal(R.v, f.average * v.length - (sum - v[f.missing]), what); assert.equal(R.v, v[f.missing], what); }
      if (form === 'median') assert.equal(R.v, s[(s.length - 1) / 2], what);
      if (form === 'range') assert.equal(R.v, s[s.length - 1] - s[0], what);
      if (form === 'mode') { const c = {}; for (const x of v) c[x] = (c[x] || 0) + 1; const top = Math.max(...Object.values(c)); assert.equal(c[R.v], top, what); assert.equal(Object.values(c).filter((x) => x === top).length, 1, `${what}: two modes`); }
      // the readings in the story are the readings drawn
      if (form !== 'missing') for (const x of v) assert.ok(o.story.includes(String(x)), `${what}: ${x}`);
    } else if (maker === 'chance') {
      if (form === 'words') { const k = f.cells.filter(Boolean).length, N = f.cells.length; assert.equal(R.v, k === N ? 'certain' : k === 0 ? 'impossible' : k * 2 > N ? 'likely' : 'unlikely', what); assert.notEqual(k * 2, N, `${what}: exactly half`); }
      if (form === 'fraction') assert.equal(fracVal(R.v), f.cells.filter(Boolean).length / f.cells.length, what);
      if (form === 'percent') assert.equal(R.v, f.cells.filter(Boolean).length * 100 / f.cells.length, what);
      if (form === 'expect') assert.equal(R.v, f.n * f.a / f.b, what);
      if (form === 'both') assert.equal(fracVal(R.v), (f.a.k / f.a.n) * (f.b.k / f.b.n), what);
      // no wrong answer is worth the same as the right one (3/12 and 1/4 would both be right)
      if (form === 'fraction' || form === 'both') for (const c of o.coins.filter((x) => !x.good)) assert.notEqual(fracVal(c.v), fracVal(R.v), `${what}: ${c.label} is worth the same`);
      // the squares drawn are the squares counted
      if (f.cells && o.lead) assert.equal((o.lead.match(/<path d="M[^"]+Z" fill="#(6fc3ff|ffab45|d79bff)"/g) || []).length, f.cells.filter(Boolean).length, `${what}: the squares drawn`);
    } else assert.fail(`no check for ${o.key}`);
  }
  assert.ok(n > 2500, `${n} cards checked`);
});

test('a tap on the survey map: the crossing nearest the finger; the slips named, any other spot told the way', () => {
  const rand = seeded(42);
  let taps = 0;
  for (let k = 0; k < 400; k++) {
    const o = MAKERS.map.make(1 + (k % 2), { rand });
    if (!o.tap) continue;
    taps++;
    const [x, y] = o.tap.at;
    assert.equal(mapJudge(o, x + 0.3, y - 0.35).right, true, `${o.story}: a finger a little off`);
    assert.deepEqual(mapJudge(o, x + 0.3, y - 0.35).at, [x, y]);
    if (x !== y) { const J = mapJudge(o, y, x); assert.equal(J.right, false); assert.ok(o.coins[J.i].why.includes(pt(y, x)), o.coins[J.i].why); }
    const far = [x > 0 ? x - 2 : x + 2, y > 0 ? y - 2 : y + 2], J = mapJudge(o, far[0], far[1]);
    assert.equal(J.right, false);
    assert.ok(/start at the Explorer|start at 0/.test(o.coins[J.i].why), o.coins[J.i].why);
    // the card draws its own map, in the frame the panel reads taps in: the Explorer's mark is over (0, 0)
    const svg = o.tap.draw([]), m = svg.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="[\d.]+" fill="none" stroke="#4fb6ff"/);
    assert.ok(m, 'the Explorer on the map');
    const at = mapSpot(o.tap.map, +m[1] / o.tap.map.size, +m[2] / o.tap.map.size);
    assert.ok(Math.abs(at[0]) < 0.05 && Math.abs(at[1]) < 0.05, `the Explorer drawn at ${at}`);
    // a tap's marks are drawn on it
    assert.ok(o.tap.draw([{ x, y, kind: 'aim' }]).length > svg.length);
  }
  assert.ok(taps > 100);
  // a map drawn alone
  assert.ok(landMap({ hi: 5, quad: 4, size: 200 }, { points: [{ x: -3, y: 2, kind: 'ice' }] }).startsWith('<svg'));
});

test('on a captain\'s run a card pays nothing by itself, and the level still hears it', () => {
  const crew = crewOf();
  setLevelAt(crew, 'survey', 'average');
  const q = E.deal(crew, JOB, { rand: seeded(3) });
  const r = E.answer(crew, JOB, q, q.order.coins.findIndex((c) => c.good), { pay: false, ms: 9000 });
  assert.equal(r.right, true); assert.equal(r.pay, 0); assert.equal(E.credits(crew), 0);
  assert.ok(r.level, 'the level heard it');
  assert.equal(crew.jobs.survey.right, 1);
});

test('the words: plain, and the finds are the three kinds the pictures draw', () => {
  for (const L of PLACE.levels) assert.ok(L.title && L.line && !/gold|sheriff|saddle/i.test(`${L.title} ${L.line}`), L.id);
  assert.deepEqual(Object.keys(KINDS).sort(), ['crystal', 'ice', 'metal']);
  for (const k of Object.keys(KINDS)) assert.ok(COLOUR[k], k);
  assert.equal(JOB.dark, true);
  assert.equal(JOB.spot, null, 'not a station job spot: its place is the Explorer\'s survey table');
});
