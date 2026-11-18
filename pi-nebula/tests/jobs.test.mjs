// The station jobs' math (src/jobs/engine.js, galley.js, medical.js, smelter.js): every level of every open job deals good
// questions, answers move the level and pay credits as they should, the arrows step, and Mathwood's own places are
// untouched by the jobs joining them.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import { JOB as galley } from '../src/jobs/galley.js';
import { JOB as medical } from '../src/jobs/medical.js';
import { JOB as smelter, STEADY, CARRIES, METALS, CHART, PRICE_TIMES, CAN_TONNES, HOLD, forget, haulOf, flownHaul, sellsFor, chartOf, priceOf } from '../src/jobs/smelter.js';
import { parseFrac, value } from '../../mathwood-valley/labs/fishing/frac.js';
import { SPOTS } from '../src/life.js';
import { readFileSync } from 'node:fs';
import { helpPicture } from '../src/jobs/pics.js';
import { workOf } from '../../mathwood-valley/src/math/longwork.js';
import { answerOf } from '../../mathwood-valley/src/math/jobsums.js';
import { JOB as arena } from '../src/jobs/arena.js';
import { JOB as dock } from '../src/jobs/dock.js';
import { JOB as crane } from '../src/jobs/crane.js';
import { JOB as pilot } from '../src/jobs/pilot.js';
import { JOB as drill } from '../src/jobs/drill.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';
import { PROBLEMS, PLACE } from '../../mathwood-valley/src/levels/places.js';
import { setLevelAt } from '../../mathwood-valley/src/levels/model.js';

// (the pilot's seat is not one of the station's job spots: its cards come up on a captain's run, src/trip.js; its
// ladder is a job's ladder like the others', and its own tests are missions.test.mjs)
const OPEN = [galley, medical, smelter, crane, arena, pilot, drill];
const crewOf = (age = null) => ({ id: 'c1', name: 'Test', look: { id: 'zuri' }, age });

test('the open jobs join Mathwood\'s levels cleanly', () => {
  for (const J of OPEN) assert.equal(E.register(J), true, J.id);
  assert.deepEqual(PROBLEMS, []);
  for (const J of OPEN) {
    const P = PLACE[J.id];
    assert.ok(P, J.id);
    // easiest first: the grades never drop
    for (let i = 1; i < P.levels.length; i++) assert.ok(P.levels[i].grade >= P.levels[i - 1].grade, `${J.id}/${P.levels[i].id}: ${P.levels[i].grade} after ${P.levels[i - 1].grade}`);
  }
  // Mathwood's own places are all still there
  for (const id of ['roundup', 'store', 'lockbox', 'sheep']) assert.ok(PLACE[id], id);
});

test('every level deals questions with one right answer, no numbers gone wrong, and Mathwood\'s west left out', () => {
  const WEST = /\b(horse|cattle|wagon|saloon|stagecoach|rifle|cowhand|steer|Yuma|Tucson|jerky|harvest supper|town social)\b/i;
  for (const J of OPEN) {
    for (const L of J.place.levels) {
      const rand = seeded(L.id.length * 97 + L.grade);
      for (let k = 0; k < 40; k++) {
        const crew = crewOf();
        setLevelAt(crew, J.place.id, L.id);
        const q = E.deal(crew, J, { rand });
        const o = q.order;
        assert.equal(q.level.id, L.id);
        assert.equal(o.coins.filter((c) => c.good).length, 1, `${J.id}/${L.id}: ${o.story}`);
        assert.ok(o.coins.length >= 3, `${J.id}/${L.id}: ${o.coins.length} coins`);
        assert.equal(new Set(o.coins.map((c) => c.label)).size, o.coins.length, `${J.id}/${L.id}: two coins alike`);
        const text = `${o.story} ${o.ask} ${o.coins.map((c) => `${c.big} ${c.small} ${c.why}`).join(' ')} ${o.rightWhy || ''}`;
        assert.ok(!/NaN|undefined|Infinity|\[object/.test(text), `${J.id}/${L.id}: ${text}`);
        assert.ok(!WEST.test(`${o.story} ${o.ask}`), `${J.id}/${L.id}: the west got in: ${o.story} ${o.ask}`);
        assert.ok(o.own && Number.isFinite(o.own.at), `${J.id}/${L.id}: no strand`);
      }
    }
  }
});

test('the own makers: the galley\'s cups and the medical drip are right', () => {
  const rand = seeded(5);
  for (let k = 0; k < 200; k++) {
    const g = galley.makers.cups.make(1 + (k % 2), { rand });
    const f = g.facts, right = g.coins.find((c) => c.good);
    const want = f.amt[0] * f.k[0] / (f.amt[1] * f.k[1]);
    const [t, b] = right.v.slice(1).split('/').map(Number);
    assert.ok(Math.abs(t / b - want) < 1e-9, `cups: ${g.story} -> ${right.label}`);
    const d = medical.makers.drip.make(1 + (k % 2), { rand });
    const r = d.coins.find((c) => c.good).v;
    if (d.facts.V) assert.equal(r * d.facts.h, d.facts.V);
    else assert.equal(r * 60, d.facts.R * d.facts.F);
  }
});

// ── the smelter's own makers ─────────────────────────────────────────────────────────────────────────────────
// (an answer's amount from its label: "9.6 tonnes", "1,200 credits", and the fractions "3/4 of a tonne", "3 3/4 tonnes")
const num = (label) => {
  const s = String(label).replace(/,/g, ''), f = s.match(/^(?:(\d+) )?(\d+)\/(\d+)\b/);
  return f ? value(parseFrac(f[0])) : Number(s.split(' ')[0]);
};
const rightOf = (o) => num(o.coins.find((c) => c.good).label);
const near = (a, b) => Math.abs(a - b) < 1e-9;
const sumsOf = (o) => (!o.sum ? [] : o.sum.chain || [o.sum]);
// a card's words, all of them: the question as told, its rows, its answers and their lines why, its help, its sums' words
const wordsOf = (o) => `${o.story} ${o.ask} ${(o.lines || []).flat().join(' ')} ${o.coins.map((c) => `${c.label} ${c.why}`).join(' ')} ${o.rightWhy || ''} ${o.help ? `${o.help.title || ''} ${o.help.line || ''} ${(o.help.steps || []).join(' ')}` : ''} ${sumsOf(o).map((x) => x.say || '').join(' ')}`;
// what a load sells for by the one price list: each metal's amount times what a tonne of it sells for, added up
const plainSum = (load) => load.parts.reduce((a, p) => a + Math.round(p.amt * priceOf(p.metal)), 0);
// the hangar as the crane's timetable hands it to a slip
const hangar = (over = {}) => ({ canisters: CARRIES, phase: 'unload', onShip: 5, fullOnShip: 5, docked: [{ socket: 0, percent: 0 }, { socket: 2, percent: 40 }], drained: 1, onRack: 8, carried: 1,
  steady: { onShip: 60, fullOnShip: 60, docked: 60, drained: 60, onRack: 60 }, ...over });

test('the smelter: counting, parts, weights, percents and pay are right, and decimals stay decimals', () => {
  const rand = seeded(11), M = smelter.makers;
  for (let k = 0; k < 300; k++) {
    const frac = (k % 5) / 4;
    forget();
    // counting: the right answer is the number of canisters drawn that the question asks for
    for (const step of [1, 2, 3]) {
      const o = M.count.make(step, { rand }), f = o.facts, pic = o.help.pic;
      assert.equal(o.picFirst, true); assert.equal(o.coins.length, 3, o.story);
      if (f.kind === 'racks') { assert.equal(rightOf(o), f.g * f.e); assert.equal(pic.g * pic.e, rightOf(o)); }
      else if (f.kind === 'full' || f.kind === 'empty') assert.equal(pic.slots.filter((x) => x === f.kind).length, rightOf(o), o.ask);
      else assert.equal(pic.slots.filter((x) => x !== 'none').length, rightOf(o), o.ask);
      assert.ok(rightOf(o) <= (step === 1 ? 5 : step === 2 ? CARRIES : 12));
    }
    // a part of the load, in tonnes or in canisters: a whole number of them
    for (const step of [1, 2]) { const o = M.part.make(step, { rand, frac }), f = o.facts; assert.ok(near(rightOf(o), f.whole * f.n / f.d), o.story); assert.ok(Number.isInteger(rightOf(o))); assert.ok(o.coins.every((c) => c.small === (c.v === 1 ? f.unit.slice(0, -1) : f.unit)), o.story); }
    // weights in tenths: adding, taking away, pour after pour
    const a = M.weigh.make(1, { rand, frac }), fa = a.facts;
    assert.ok(near(rightOf(a), (fa.op === '+' ? fa.a + fa.b : fa.a - fa.b) / 10), a.story);
    const l = M.weigh.make(2, { rand, frac }), fl = l.facts;
    assert.ok(near(rightOf(l), fl.n * fl.w / 10), l.story); assert.ok(l.story.includes(`${fl.n} `) && l.story.includes(`${fl.w / 10} tonnes`), l.story);
    // percent
    for (const step of [1, 2]) { const o = M.percent.make(step, { rand, frac }), f = o.facts; assert.ok(near(rightOf(o), f.whole * f.pct / 100), `${o.story} -> ${o.answer}`); if (f.unit === 'canisters') assert.ok(o.coins.every((c) => /^\d+$/.test(c.big)), `${o.story}: a part of a canister offered`); }
    // what a metal sells for: its tonnes times the price
    const p = M.pay.make(1, { rand, frac }), fp = p.facts;
    assert.ok(near(rightOf(p), fp.w / 10 * fp.price), p.story);
    assert.ok(METALS.some((m) => m.price === fp.price && p.story.includes(m.name)), 'a metal at its own price');
    // the total sale price: the second of its two slips, and the whole pay slip in one go
    const first = M.pay.make(2, { rand, frac }), total = M.pay.make(2, { rand, frac }), slip = M.pay.make(3, { rand, frac });
    assert.equal(first.facts.step, 'each'); assert.equal(total.facts.step, 'total'); assert.equal(slip.facts.step, 'slip');
    assert.equal(rightOf(total), plainSum(total.facts.load)); assert.equal(rightOf(slip), plainSum(slip.facts.load));
    assert.equal(total.lines[total.lines.length - 1][1], '?');
    // no answer button hides a decimal as a fraction, and none shows a number gone wrong
    for (const o of [a, l, p, total, slip]) for (const c of o.coins) assert.ok(/^[\d,]+(\.\d{1,2})?$/.test(c.big), `${o.story}: ${c.big}`);
  }
  forget();
});

test('the smelter: every question has a picture and steps for Help, and its sums can be worked on paper', () => {
  const rand = seeded(23), M = smelter.makers;
  for (const [maker, steps] of [['count', [1, 2, 3]], ['part', [1, 2]], ['lots', [1, 2]], ['weigh', [1, 2]], ['percent', [1, 2]], ['each', [1]], ['pay', [1, 2, 3]]]) {
    for (const step of steps) for (let k = 0; k < 60; k++) {
      const o = M[maker].make(step, { rand, frac: (k % 3) / 2 }), pic = helpPicture(o);
      assert.ok(pic.svg.startsWith('<svg') && !/NaN|undefined/.test(pic.svg), `${maker} ${step}: no picture`);
      // the picture never gives the answer away (the youngest count theirs; the others show a "?")
      if (maker !== 'count') assert.ok(pic.svg.includes('?'), `${maker} ${step}: the picture has no "?"`);
      if (maker === 'count') continue;
      // Help teaches: a title, and a line or steps of its own, or Mathwood's picture with its own line
      assert.ok((o.help && o.help.line && o.help.line.length > 20) || (pic.line && pic.line.length > 10), `${maker} ${step}: Help has no line: ${o.story}`);
      // the sums: every step can be laid out by the worked sheet
      assert.ok(o.sum, `${maker} ${step}: no sum`);
      const chain = sumsOf(o);
      for (const x of chain) assert.doesNotThrow(() => workOf(x), `${maker} ${step}: ${JSON.stringify(x)}`);
      const good = o.coins.find((c) => c.good);
      if (good.rows) {
        // how much of each metal: every amount of the right set is worked out by one of the steps
        for (const [name, n] of good.rows) assert.ok(chain.some((x) => near(answerOf(x), Number(n))), `${maker} ${step}: no step finds the ${name}'s ${n}: ${JSON.stringify(chain)}`);
        continue;
      }
      // the last one ends on the right answer; where the steps are one sum after another, each works on from one
      // before it; where several metals are each worked out and then added, the adding does
      const last = chain[chain.length - 1], end = last.op === 'add' ? last.a + last.b : last.op === 'sub' ? last.a - last.b : last.op === 'mul' ? last.a * last.b : last.a / last.b;
      assert.ok(near(end, rightOf(o)), `${maker} ${step}: ${o.story} ends on ${end}, the answer is ${o.answer}`);
      if (o.facts.load) chain.filter((x, i) => i && x.op === 'add').forEach((x) => assert.ok(x.carried && x.carried.a != null && x.carried.b != null, `${maker} ${step}: an adding step that adds something not worked out: ${JSON.stringify(chain)}`));
      else chain.slice(1).forEach((x, i) => assert.ok(x.carried, `${maker} ${step}: step ${i + 2} does not follow on: ${JSON.stringify(chain)}`));
    }
  }
  forget();
});

test('the smelter: a slip counts the canisters in the hangar when the count suits and will stay; else its own', () => {
  const rand = seeded(31), M = smelter.makers, load = hangar;
  for (let k = 0; k < 120; k++) {
    forget();   // (each case afresh: a count of the hangar is asked about only once, see the next test)
    // the youngest: one of the counts that are 5 or fewer (5 on the ship, 2 at the wall), never the rack's 8
    const c = M.count.make(1, { rand, live: load() });
    assert.equal(c.facts.live, true); assert.ok(['ship', 'wall'].includes(c.facts.kind)); assert.equal(rightOf(c), c.facts.kind === 'ship' ? 5 : 2);
    // how many are still on the Miner: the ones really on it
    const st = M.count.make(2, { rand, live: load() });
    assert.equal(st.facts.kind, 'still'); assert.equal(rightOf(st), 5); assert.equal(st.help.pic.slots.filter((x) => x === 'none').length, CARRIES - 5);
    // a count about to change is not asked about; nor one that does not suit the level
    forget();
    const soon = load({ steady: { onShip: STEADY - 5, fullOnShip: STEADY - 5, docked: STEADY - 5, drained: 60, onRack: 60 } });
    assert.equal(M.count.make(1, { rand, live: soon }).facts.live, false);
    assert.equal(M.count.make(1, { rand, live: load({ onShip: 8, fullOnShip: 8, docked: [], onRack: 8 }) }).facts.live, false);
    // no hangar (node, the levels page): the job's own numbers
    assert.equal(M.count.make(1, { rand }).facts.live, false);
    // (a canister holds one tonne, so no slip multiplies canisters counted in the hangar by a weight any more: the
    // slips of weights, and of lots of a fraction, are from the log, in tonnes only)
    for (const o of [M.weigh.make(2, { rand, live: load() }), M.lots.make(1, { rand, live: load() }), M.lots.make(2, { rand, live: load() })]) { assert.equal(o.facts.live, false); assert.ok(!/canister/.test(o.story), o.story); }
  }
  // through the engine: the live load reaches the maker
  const crew = crewOf();
  setLevelAt(crew, 'smelter', 'kCount');
  let seen = 0;
  for (let k = 0; k < 40; k++) { forget(); const q = E.deal(crew, smelter, { rand: seeded(k + 1), live: load() }); if (q.order.facts && q.order.facts.live) seen++; }
  assert.ok(seen > 5, `only ${seen} of 40 slips used the hangar's count`);
  forget();
});

test('the smelter: a count of the hangar is asked about once, and again only when the crane has changed it; a slip about the whole haul once a haul', () => {
  const rand = seeded(41), M = smelter.makers;
  const load = (over = {}) => hangar({ round: 2, ...over });
  forget();
  // level 1: 5 on the ship and 2 at the wall are each asked once, in either order; then slips from the log
  const first = [1, 2, 3, 4, 5, 6].map(() => M.count.make(1, { rand, live: load() }).facts);
  assert.deepEqual(first.map((f) => f.live), [true, true, false, false, false, false]);
  assert.deepEqual(first.slice(0, 2).map((f) => f.kind).sort(), ['ship', 'wall']);
  // the crane docks another: 3 at the wall is new, and is asked once
  const more = { docked: [{ socket: 0, percent: 0 }, { socket: 2, percent: 0 }, { socket: 4, percent: 90 }], onShip: 4, fullOnShip: 4 };
  const next = [1, 2, 3, 4].map(() => M.count.make(1, { rand, live: load(more) }).facts);
  assert.equal(next.filter((f) => f.live).length, 2); assert.equal(next.slice(2).filter((f) => f.live).length, 0);
  // how many are still on the Miner: once for 4, and once more when it is 3
  forget();
  assert.equal(M.count.make(2, { rand, live: load(more) }).facts.live, true);
  for (let k = 0; k < 10; k++) assert.equal(M.count.make(2, { rand, live: load(more) }).facts.live, false);
  assert.equal(M.count.make(2, { rand, live: load({ ...more, onShip: 3, fullOnShip: 3 }) }).facts.n, 3);
  // the whole haul: its shares, how much of each metal, what it sells for: each kind of slip once a round
  forget();
  for (const [maker, step] of [['part', 1], ['part', 2], ['each', 1], ['pay', 3]]) {
    const two = [1, 2, 3].map(() => M[maker].make(step, { rand, live: load() }).facts);
    assert.deepEqual(two.map((f) => f.live), [true, false, false], `${maker} ${step}`); assert.equal(two[0].from, 'This haul');
    // a new round's haul is new
    assert.equal(M[maker].make(step, { rand, live: load({ round: 3 }) }).facts.live, maker === 'part' && step === 2 ? false : true, `${maker} ${step}: the next haul`);
  }
  // (the two steps: the haul's two slips first, both "This haul"; then pairs from the log)
  forget();
  const pair = [1, 2, 3, 4].map(() => M.pay.make(2, { rand, live: load() }).facts);
  assert.deepEqual(pair.map((f) => [f.step, f.live]), [['each', true], ['total', true], ['each', false], ['total', false]]);
  forget();
});

test('the smelter: lots of a fraction, a whole number of trips with a fraction of a tonne on each, are right, with the real slips, in tonnes only', () => {
  const rand = seeded(53), M = smelter.makers;
  // a whole number, a fraction or a mixed number on every button: never a decimal, never a "1." before it
  const FORM = /^(\d+|\d+\/\d+|\d+ \d+\/\d+)$/;
  // what each slip stands for, for n lots of a/d of a tonne (Mathwood's fishing dock's slips, and the job's own)
  const SLIP = {
    partsOnly: (n, a) => n * a, leftOver: (n, a, d) => Math.floor(n * a / d), added: (n, a, d) => n + a / d, oneLot: (n, a, d) => a / d,
    topAdded: (n, a, d) => (a + n) / d, bottomTimes: (n, a, d) => a / (d * n), groupOff: (n, a, d, v) => near(v, (n + 1) * a / d) || near(v, (n - 1) * a / d),
  };
  const AMBER = 'rx="1.5" fill="#e8922a"', WHITE = 'rx="1.5" fill="#fff"';
  const things = new Set();
  for (let k = 0; k < 400; k++) {
    const step = 1 + (k % 2), o = M.lots.make(step, { rand, frac: (k % 5) / 4, who: { name: 'Miner Dov', she: false } }), f = o.facts, want = f.n * f.a / f.d;
    assert.ok(near(rightOf(o), want), `${o.story} -> ${o.answer}`);
    assert.deepEqual(f.ans, [f.n * f.a, f.d]);
    assert.ok(f.a < f.d && f.n >= 2, o.story);
    assert.ok(o.story.includes(`${f.n} `) && o.story.includes(`${f.a}/${f.d} of a tonne`), o.story);
    // told in tonnes: a drone's trips, a ladle's pours, pallets of bars; never a canister that is a part of a tonne
    assert.ok(!/canister/.test(wordsOf(o)), o.story); assert.ok(['trip', 'pour', 'pallet'].includes(f.thing)); things.add(f.thing);
    // step 1: whole tonnes, 2 or more; step 2: a mixed number
    if (step === 1) assert.ok(Number.isInteger(want) && want >= 2, o.story); else assert.ok(!Number.isInteger(want) && want > 1, o.story);
    assert.equal(o.coins.length, 4, o.story);
    for (const c of o.coins) {
      assert.ok(FORM.test(c.big), `${o.story}: ${c.big}`);
      assert.ok(['tonnes', 'tonne', 'of a tonne'].includes(c.small), c.small);
      if (c.good) continue;
      assert.ok(c.why && c.why.length > 20, `${o.story}: ${c.big} has no line why`);
      const v = num(c.label), fn = SLIP[c.slip];
      assert.ok(fn, `${c.slip}: not a slip`);
      assert.ok(c.slip === 'groupOff' ? fn(f.n, f.a, f.d, v) : near(v, fn(f.n, f.a, f.d)), `${c.slip}: ${c.label} for ${o.story}`);
    }
    // help: the lots, each cut in d equal parts with a of them shaded; the steps; the sums end on the answer
    const pic = helpPicture(o);
    assert.equal(o.help.pic.kind, 'fraclots');
    assert.equal(pic.svg.split(AMBER).length - 1, f.n * f.a, `${o.story}: the shaded parts`);
    assert.equal(pic.svg.split(WHITE).length - 1, f.n * (f.d - f.a), `${o.story}: the parts not shaded`);
    assert.ok(!/canister/.test(pic.svg), 'the picture names no canister');
    assert.equal(o.help.steps.length, step === 1 ? 2 : 3);
    const chain = o.sum.chain || [o.sum], last = chain[chain.length - 1];
    assert.equal(last.op, 'div'); assert.equal(last.b, f.d); assert.ok(near(last.a / last.b, want));
  }
  assert.equal(things.size, 3);
});

test('the smelter: the haul is the same haul on every slip about it: eight tonnes in eight canisters, all of it metal, all of it sold', () => {
  const kinds = new Set();
  for (let r = 0; r < 120; r++) {
    const H = haulOf(r);
    assert.deepEqual(H, haulOf(r));
    assert.equal(H.canisters, CARRIES); assert.equal(H.tonnes, HOLD); assert.equal(HOLD, CARRIES * CAN_TONNES); assert.equal(CAN_TONNES, 1);
    assert.equal(H.flown, false);
    // whole canisters of each metal, in quarters of the load: as easily said as fractions as percents
    for (const [m, t] of Object.entries(H.store)) { assert.ok(METALS.some((x) => x.name === m)); assert.ok([2, 4, 6].includes(t), `haul ${r}: ${t} tonnes of ${m}`); }
    assert.equal(Object.values(H.store).reduce((a, b) => a + b, 0), HOLD);
    // it sells for the plain sum, at the one price list's prices
    assert.equal(H.pay, Object.entries(H.store).reduce((a, [m, t]) => a + t * CHART[m] * PRICE_TIMES, 0)); assert.deepEqual(H.lots, sellsFor(H.store).lots);
    for (const gone of ['ore', 'fill', 'yield', 'oreTonnes', 'metal10', 'metal']) assert.ok(!(gone in H), `a haul has no ${gone}`);
    kinds.add(JSON.stringify(H.store));
  }
  assert.ok(kinds.size >= 10, 'hauls differ');
  // (the first is the game's maker's own example: 50% iron, 25% nickel, 25% titanium)
  assert.deepEqual(haulOf(0).store, { iron: 4, nickel: 2, titanium: 2 }); assert.equal(haulOf(0).pay, 26000);
  const rand = seeded(61), M = smelter.makers;
  for (const round of [0, 2, 4, 7, 22]) {
    forget();
    const H = haulOf(round), L = hangar({ round, docked: [{ socket: 0, percent: 0 }, { socket: 1, percent: 30 }, { socket: 2, percent: 90 }] });
    const cans = (name) => H.store[name], pct = (name) => H.store[name] / HOLD * 100;
    // how much of each metal: the haul's shares in percent, its canisters of each
    const each = M.each.make(1, { rand, live: L }), fe = each.facts;
    assert.equal(fe.from, 'This haul'); assert.equal(fe.haul, round); assert.equal(fe.load.unit, 'canisters'); assert.equal(fe.load.total, CARRIES);
    for (const p of fe.load.parts) { assert.equal(p.amt, cans(p.metal)); assert.equal(p.pct, pct(p.metal)); assert.ok(each.story.includes(`${p.pct}% ${p.metal}`), each.story); }
    assert.equal(fe.load.parts.length, Object.keys(H.store).length);
    assert.deepEqual(each.coins.find((c) => c.good).rows, fe.load.parts.map((p) => [p.metal, String(p.amt)]));
    // the two steps, and the whole slip in one go: the same canisters, and the haul's own pay
    const a = M.pay.make(2, { rand, live: L }), b = M.pay.make(2, { rand, live: L }), c = M.pay.make(3, { rand, live: L });
    assert.deepEqual(a.facts.load, fe.load); assert.deepEqual(b.facts.load.parts.map((p) => [p.metal, p.amt]), fe.load.parts.map((p) => [p.metal, p.amt])); assert.deepEqual(c.facts.load, fe.load);
    for (const o of [a, b, c]) { assert.equal(o.facts.from, 'This haul'); assert.equal(o.facts.haul, round); }
    assert.equal(rightOf(b), H.pay, `${b.story} -> ${b.answer}`); assert.equal(rightOf(c), H.pay, `${c.story} -> ${c.answer}`);
    assert.equal(b.chart.title, 'A canister sells for'); assert.equal(c.chart.title, 'A canister sells for');
    // a part of it, as a fraction: one of its shares, its canisters
    const part = M.part.make(1, { rand, live: L }), fp = part.facts;
    assert.equal(fp.from, 'This haul'); assert.equal(fp.unit, 'canisters'); assert.equal(fp.whole, CARRIES); assert.ok(Object.values(H.store).includes(rightOf(part)), part.story);
    assert.ok(part.story.includes(`${fp.n}/${fp.d} hold`) && part.story.startsWith('Of the 8 canisters of this haul'), part.story);
    // each once a haul: the next slips are from the log; a new haul is new
    assert.equal(M.each.make(1, { rand, live: L }).facts.from, undefined);
    assert.equal(M.pay.make(3, { rand, live: L }).facts.from, undefined);
    assert.equal(M.each.make(1, { rand, live: hangar({ round: round + 1 }) }).facts.from, 'This haul');
  }
  forget();
});

// ── what the game's maker asked of these slips (2026-11-18) ────────────────────────────────────────────────────
// every slip of every level, over many seeds, from the log and about the haul in the hangar (one of the Miner's own,
// and one the player went out for)
function everySlip(fn, each = 60) {
  const flown = { iron: 4.67, nickel: 2.9, copper: 0.43 };
  smelter.place.levels.forEach((L, i) => {
    for (let k = 0; k < each; k++) {
      const crew = crewOf(); setLevelAt(crew, 'smelter', L.id);
      // (a third from the log, a third with one of the Miner's own hauls in the hangar, a third with the player's)
      const way = k % 3, round = 30 + (k % 12);
      if (k % 6 === 0) forget();
      flownHaul(round, way === 2 ? { store: flown } : null);
      const q = E.deal(crew, smelter, { rand: seeded(1000 * (i + 1) + k), live: way ? hangar({ round }) : null });
      fn(q.order, L, way);
      flownHaul(round, null);
    }
  });
  forget();
}

test('the smelter: every level, over many seeds, deals slips with one right answer', () => {
  const seen = new Set();
  everySlip((o, L) => {
    assert.equal(o.coins.filter((c) => c.good).length, 1, `${L.id}: ${o.story}`); assert.ok(o.coins.length >= 3, `${L.id}: ${o.story}`);
    assert.equal(new Set(o.coins.map((c) => c.label)).size, o.coins.length, `${L.id}: two answers alike: ${o.story}`);
    assert.equal(new Set(o.coins.map((c) => String(c.v))).size, o.coins.length, `${L.id}: two answers of one amount: ${o.story}`);
    for (const c of o.coins) if (!c.good) assert.ok(c.why && c.why.length > 15, `${L.id}: ${c.label} has no line why`);
    assert.ok(!/NaN|undefined|Infinity|\[object/.test(wordsOf(o)), wordsOf(o));
    seen.add(o.key);
  });
  // (the ladder's own kinds of slip all came up)
  for (const k of ['pay:each', 'pay:total', 'pay:slip', 'pay:mine', 'each', 'lots:whole', 'lots:mixed', 'weigh:lots', 'part:one', 'part:some', 'percent:any']) assert.ok([...seen].some((x) => x.startsWith(k)), `no ${k} slip`);
});

test('the smelter: no question names both tonnes and canisters, and a canister is never a part of a tonne', () => {
  let tonnes = 0, cans = 0;
  everySlip((o, L) => {
    const text = `${wordsOf(o)} ${helpPicture(o).svg.replace(/<[^>]+>/g, ' ')} ${o.chart ? o.chart.title : ''}`, t = /\btonnes?\b/i.test(text), c = /\bcanisters?\b/i.test(text);
    assert.ok(!(t && c), `${L.id}: tonnes and canisters in one question: ${text}`);
    if (t) tonnes++; if (c) cans++;
    assert.ok(!(c && /of a tonne|\d\.\d/.test(`${o.story} ${o.ask}`)), `${L.id}: a canister with a part of a tonne: ${o.story}`);
    // the chart beside a question is in the question's own unit
    if (o.chart) assert.equal(o.chart.title, c ? 'A canister sells for' : 'A tonne sells for');
  });
  assert.ok(tonnes > 100 && cans > 100, `both ways of telling are used: ${tonnes} in tonnes, ${cans} in canisters`);
});

test('the smelter: a load is all metal: no slag, no yield, no ore of which a part goes unpaid; its shares add up to the whole', () => {
  let ore = 0;
  everySlip((o, L) => {
    const text = `${wordsOf(o)} ${helpPicture(o).svg.replace(/<[^>]+>/g, ' ')}`, load = o.facts && o.facts.load;
    assert.ok(!/slag|yield|crusher|poured from|is metal\b/i.test(text), `${L.id}: ${text}`);
    // "ore" only as the game's maker told it: so many tonnes of ore, every tonne of it one metal or another
    if (/\bores?\b/i.test(text)) {
      ore++;
      assert.ok(/collected \d+ tonnes of ore[.:]/.test(o.story) && !/\bores?\b/i.test(text.replace(/tonnes of ore/g, '')), `${L.id}: ${o.story}`);
      assert.ok(load && near(load.parts.reduce((a, p) => a + p.amt, 0), load.total), `${L.id}: ore that is not all metal: ${o.story}`);
    }
    // a load told by its shares: they add up to 100%, the amounts to the whole load, each amount its share of it
    if (load && load.parts[0].pct != null) {
      assert.equal(load.parts.reduce((a, p) => a + p.pct, 0), 100, o.story);
      assert.ok(near(load.parts.reduce((a, p) => a + p.amt, 0), load.total), o.story);
      for (const p of load.parts) { assert.ok(near(p.amt, load.total * p.pct / 100), o.story); assert.ok(o.story.includes(`${p.pct}%`) || o.facts.step === 'total', o.story); }
      // amounts a child at that rung can reach: whole canisters; tonnes whole or in halves, in tenths on the top rung only
      for (const p of load.parts) assert.ok(load.unit === 'canisters' ? Number.isInteger(p.amt) : L.id === 'payslip' ? near(p.amt * 10, Math.round(p.amt * 10)) : Number.isInteger(p.amt * 2), `${L.id}: ${p.amt} ${load.unit} of ${p.metal}`);
    }
    // a part of a load told by fractions: the fractions named add up to the whole, or the rest is named, or it is the part melted so far
    if (o.key.startsWith('part:')) {
      const fr = [...o.story.matchAll(/(\d+)\/(\d+)/g)].map((m) => m[1] / m[2]);
      assert.ok(fr.length > 1 ? near(fr.reduce((a, b) => a + b, 0), 1) : /the rest (is|hold)|has melted/.test(o.story), `${L.id}: ${o.story}`);
    }
    if (o.key.startsWith('percent:')) assert.ok(/the rest (is|hold)|has melted/.test(o.story), `${L.id}: ${o.story}`);
  });
  assert.ok(ore > 20, 'his own words are used: so many tonnes of ore, all of it metal');
});

test('the smelter: the pay is the plain sum, by the one price list, and the two steps are two slips about one load', () => {
  const rand = seeded(71), M = smelter.makers, LIST = METALS.map((m) => [m.name, m.price]);
  assert.deepEqual(chartOf().rows, LIST); assert.equal(chartOf().title, 'A tonne sells for'); assert.equal(chartOf(['canister', 'canisters']).title, 'A canister sells for');
  forget();
  for (let k = 0; k < 300; k++) {
    const frac = (k % 4) / 3, who = { name: k % 2 ? 'Miner Dov' : 'Pilot Juno', she: !(k % 2) };
    // STEP ONE: how much of each metal, a choice between whole sets of numbers
    const a = M.pay.make(2, { rand, frac, who }), fa = a.facts, right = a.coins.find((c) => c.good);
    assert.equal(fa.step, 'each'); assert.ok(/How many (tonnes|canisters) of each metal/.test(a.ask), a.ask);
    assert.deepEqual(right.rows, fa.load.parts.map((p) => [p.metal, String(p.amt)])); assert.equal(right.small, fa.load.unit);
    for (const c of a.coins) {
      assert.equal(c.rows.length, fa.load.parts.length); assert.deepEqual(c.rows.map((r) => r[0]), fa.load.parts.map((p) => p.metal));
      if (!c.good) assert.notDeepEqual(c.rows, right.rows);
    }
    // (one of the wrong sets adds up to the whole load too, so adding them up is not enough to tell)
    assert.ok(!a.chart, 'no chart yet: the first step is the amounts');
    // STEP TWO: the same load, by its amounts, with the chart beside it: each amount at its price, added up
    const b = M.pay.make(2, { rand, frac, who: { name: 'Engineer Okafor', she: false } }), fb = b.facts;
    assert.equal(fb.step, 'total'); assert.deepEqual(fb.load, { ...fa.load }); assert.equal(b.ask, 'What is the total sale price?');
    assert.equal(b.who, who, 'the second slip is the same crew\'s');
    assert.equal(rightOf(b), plainSum(fb.load)); assert.equal(fb.ans, plainSum(fb.load));
    assert.deepEqual(b.chart.rows, LIST); assert.equal(b.chart.title, fb.load.unit === 'canisters' ? 'A canister sells for' : 'A tonne sells for');
    assert.deepEqual(b.lines.slice(0, -1).map(([name]) => name.toLowerCase()), fb.load.parts.map((p) => p.metal)); assert.deepEqual(b.lines[b.lines.length - 1], ['Sold for', '?']);
    fb.load.parts.forEach((p, i) => assert.ok(b.lines[i][1].startsWith(String(p.amt)), `${b.lines[i]}`));
    // THE WHOLE PAY SLIP in one go: the shares and the chart
    const c = M.pay.make(3, { rand, frac, who }), fc = c.facts;
    assert.equal(rightOf(c), plainSum(fc.load)); assert.deepEqual(c.chart.rows, LIST); assert.ok(fc.load.parts.length <= 3, 'the top rung: two or three metals');
    for (const p of fc.load.parts) assert.ok(c.story.includes(`${p.pct}%`), c.story);
    // every wrong answer is wrong, and says why
    for (const o of [b, c]) for (const x of o.coins) if (!x.good) assert.ok(num(x.label) !== rightOf(o) && x.why.length > 20, `${o.story}: ${x.label}`);
    // one metal: its tonnes times what a tonne of it sells for
    const one = M.pay.make(1, { rand, frac }), f1 = one.facts;
    assert.ok(near(rightOf(one), f1.w / 10 * f1.price)); assert.ok(METALS.some((m) => m.price === f1.price));
  }
  forget();
});

test('the smelter job stands at the forge\'s console in the smelter\'s hall, the pours in view; the control room\'s desk is gone', () => {
  assert.deepEqual(smelter.spot, { place: 'smelterControls' }); assert.equal(smelter.face, 'smelterControlsScreen'); assert.equal(smelter.view, 'smelter-controls');
  const S = JSON.parse(readFileSync(new URL('../kit/rooms/station.json', import.meta.url), 'utf8'));
  const hall = S.rooms.find((r) => r.id === 'smelter-hall'), control = S.rooms.find((r) => r.id === 'smelter-control');
  // the hall's floor, from its floor cells (2 m each)
  const cells = hall.pieces.filter((p) => p.piece === 'floor' && !p.deck), xs = cells.map((p) => p.cell[0] * 2), zs = cells.map((p) => p.cell[1] * 2);
  const box = { x: [Math.min(...xs) - 1, Math.max(...xs) + 1], z: [Math.min(...zs) - 1, Math.max(...zs) + 1] };
  const inHall = (x, z, m = 0) => x > box.x[0] + m && x < box.x[1] - m && z > box.z[0] + m && z < box.z[1] - m;
  // where one stands: on the hall's floor, on the forge console's operator side, facing the middle of its two screens
  const at = S.places.smelterControls, scr = S.places.smelterControlsScreen, con = S.places.forge.console;
  assert.equal(at[1], 0); assert.ok(inHall(at[0], at[2], 0.4), String(at));
  assert.ok(Math.hypot(at[0] - con[0], at[2] - con[2]) < 0.5, 'at the console');
  assert.ok(scr[1] > 1 && scr[1] < 1.8 && Math.abs(scr[2] - at[2]) < 0.3 && at[0] - scr[0] > 0.5 && at[0] - scr[0] < 1.4, 'facing its screens');
  // the camera: in the hall, turned toward the nearer pour (within 25 degrees of it), the pour 3 to 8 m off
  const V = S.views['smelter-controls'], pours = S.places.forge.pours;
  assert.ok(V && inHall(V.at[0], V.at[2], 0.1), 'the view is in the hall');
  const pour = pours.reduce((b, p) => (Math.hypot(p[0] - V.at[0], p[2] - V.at[2]) < Math.hypot(b[0] - V.at[0], b[2] - V.at[2]) ? p : b));
  const ang = (x, z) => Math.atan2(x, z), dLook = ang(V.look[0] - V.at[0], V.look[2] - V.at[2]), dPour = ang(pour[0] - V.at[0], pour[2] - V.at[2]);
  assert.ok(Math.abs(Math.atan2(Math.sin(dLook - dPour), Math.cos(dLook - dPour))) < 25 * Math.PI / 180, 'the view looks toward a pour');
  const far = Math.hypot(pour[0] - V.at[0], pour[2] - V.at[2]); assert.ok(far > 3 && far < 8, String(far));
  // the station's people keep their spots by the forge: the smelter's by the console's south end (life.js forgeConsole)
  // and the forge's middle are clear of the job's ring and the margin people keep (people.js KEEP_OFF: 0.8 m and 0.3)
  for (const s of [...SPOTS.forge, ...SPOTS.forgeConsole]) {
    const x = box.x[0] + (box.x[1] - box.x[0]) * s.at[0], z = box.z[0] + (box.z[1] - box.z[0]) * s.at[1];
    assert.ok(Math.hypot(x - at[0], z - at[2]) > 0.8 + 0.3 + 0.5, `the people's spot at ${x}, ${z} is on the job's ring`);
  }
  // the pay desk and its places are gone from the control room; the crane's chair is still there
  assert.ok(!control.pieces.some((p) => p.piece === 'desk'));
  assert.ok(control.pieces.some((p) => p.piece === 'opChair'));
  assert.equal(S.places.smelterPayDesk, undefined); assert.equal(S.places.smelterPayDeskScreen, undefined);
  // the ladder: the lots of a fraction (the rungs still called 'oreWhole' and 'oreTimes', so a crew member's place is
  // kept) between "several parts" and "weights in tenths", no big jumps
  const ids = smelter.place.levels.map((L) => L.id), i = ids.indexOf('oreWhole');
  assert.deepEqual(ids.slice(i - 1, i + 3), ['parts', 'oreWhole', 'oreTimes', 'tenths']);
  E.register(smelter);
  assert.deepEqual(smelter.place.levels.slice(i - 1, i + 3).map((L) => L.grade), [40, 44, 47, 50]);
  // every rung there was is still there by its name (a saved place on the ladder holds), with the pay's two new rungs:
  // how much of each metal, and the total sale price in its two steps, under the whole pay slip
  assert.deepEqual(ids, ['kCount', 'kFull', 'kRacks', 'loads', 'share', 'part', 'parts', 'oreWhole', 'oreTimes', 'tenths', 'percent', 'tonnes', 'anyPercent', 'eachMetal', 'credits', 'sale', 'payslip']);
  assert.deepEqual(smelter.place.levels.slice(-5).map((L) => L.grade), [62, 64, 66, 70, 76]);
  // no rung's name or line speaks of slag, a yield, ore, or a canister that is a part of a tonne
  for (const L of smelter.place.levels) assert.ok(!/slag|yield|\bore\b|canisters? (with|of) \d\/\d|canisters of \d\.\d/i.test(`${L.title} ${L.line}`), `${L.id}: ${L.title}: ${L.line}`);
  assert.ok(!/slag|yield|\bore\b/i.test(`${smelter.place.math} ${smelter.place.line} ${smelter.hint}`));
});

test('an answer: the first pick counts, a right one pays, a miss pays nothing, the level moves', () => {
  const crew = crewOf(9);
  const q = E.deal(crew, galley, { rand: seeded(3) });
  const wrong = q.order.coins.findIndex((c) => !c.good), right = q.order.coins.findIndex((c) => c.good);
  const a = E.answer(crew, galley, q, wrong);
  assert.equal(a.right, false); assert.equal(a.pay, 0); assert.equal(E.credits(crew), 0);
  const b = E.answer(crew, galley, q, right);
  // (a right pick after a miss: half the card's pay, in tens)
  assert.equal(b.right, true); assert.equal(b.first, false); assert.equal(b.pay, Math.round(q.worth.pay * E.PAY.half / 10) * 10);
  assert.equal(E.answer(crew, galley, q, right), null, 'a finished question takes no more picks');
  // right first time, again and again: credits at each card's own pay, and the level climbs
  const start = E.level(crew, galley).i;
  let paid = 0;
  for (let k = 0; k < 8; k++) {
    const q2 = E.deal(crew, galley, { rand: seeded(10 + k) });
    const r = E.answer(crew, galley, q2, q2.order.coins.findIndex((c) => c.good));
    assert.equal(r.pay, q2.worth.pay); assert.equal(r.worth, q2.worth.pay); paid += r.pay;
  }
  assert.equal(E.credits(crew), b.pay + paid);
  assert.ok(E.level(crew, galley).i > start, 'the level climbed');
  assert.equal(crew.jobs.galley.n, 9);
});

test('a level\'s own amount (Mathball\'s balls): 50 at the easiest, about 100 in the middle, 200 at the top, in tens', () => {
  assert.equal(E.levelPay({ grade: 0 }), 50);
  assert.equal(E.levelPay({ grade: 80 }), 200);
  assert.equal(E.levelPay({ grade: 100 }), 200, 'no more above the top');
  assert.ok(E.levelPay({ grade: 30 }) >= 90 && E.levelPay({ grade: 30 }) <= 110, String(E.levelPay({ grade: 30 })));
  assert.equal(E.payFor, E.levelPay, 'its old name still works');
  for (const J of OPEN) {
    E.register(J);
    for (const L of J.place.levels) { const p = E.levelPay(L); assert.ok(p >= 50 && p <= 200 && p % 10 === 0, `${J.id}/${L.id}: ${p}`); }
  }
  assert.equal(E.SHIP, 50000);
});

test('the arrows step the level by hand, and stop at the ends', () => {
  const crew = crewOf();
  E.deal(crew, medical, { rand: seeded(1) });
  const v0 = E.level(crew, medical);
  const up = E.step(crew, medical, 1);
  assert.equal(up.i, v0.i + 1);
  assert.equal(E.deal(crew, medical, { rand: seeded(2) }).level.id, up.id);
  setLevelAt(crew, 'medical', medical.place.levels[0].id);
  assert.equal(E.step(crew, medical, -1), null);
});

test('the jobs still to come are marked, with nothing to play yet', () => {
  // (none is left to come: the arena is Mathball, its own tests mathball.test.mjs; the dock's bridge is open, a try of
  // three rings: its own tests, dock.test.mjs. A job closed again would have to be marked as one still to come)
  for (const J of [arena, dock].filter((j) => j.open === false)) {
    assert.equal(J.open, false); assert.equal(J.place, null);
    assert.ok(J.spot && J.sign && J.hint, J.id);
  }
  assert.equal(dock.open, true); assert.equal(arena.open, true);
});
