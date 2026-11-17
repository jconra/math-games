// The station jobs' math (src/jobs/engine.js, galley.js, medical.js, smelter.js): every level of every open job deals good
// questions, answers move the level and pay credits as they should, the arrows step, and Mathwood's own places are
// untouched by the jobs joining them.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import { JOB as galley } from '../src/jobs/galley.js';
import { JOB as medical } from '../src/jobs/medical.js';
import { JOB as smelter, STEADY, CARRIES, METALS, LOADS, forget, haulOf } from '../src/jobs/smelter.js';
import { parseFrac, value } from '../../mathwood-valley/labs/fishing/frac.js';
import { SPOTS } from '../src/life.js';
import { readFileSync } from 'node:fs';
import { helpPicture } from '../src/jobs/pics.js';
import { workOf } from '../../mathwood-valley/src/math/longwork.js';
import { JOB as arena } from '../src/jobs/arena.js';
import { JOB as dock } from '../src/jobs/dock.js';
import { JOB as crane } from '../src/jobs/crane.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';
import { PROBLEMS, PLACE } from '../../mathwood-valley/src/levels/places.js';
import { setLevelAt } from '../../mathwood-valley/src/levels/model.js';

const OPEN = [galley, medical, smelter, crane, arena];
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

test('the smelter: counting, parts, weights, percents and pay are right, and decimals stay decimals', () => {
  const rand = seeded(11), M = smelter.makers;
  for (let k = 0; k < 300; k++) {
    const frac = (k % 5) / 4;
    // counting: the right answer is the number of canisters drawn that the question asks for
    for (const step of [1, 2, 3]) {
      const o = M.count.make(step, { rand }), f = o.facts, pic = o.help.pic;
      assert.equal(o.picFirst, true); assert.equal(o.coins.length, 3, o.story);
      if (f.kind === 'racks') { assert.equal(rightOf(o), f.g * f.e); assert.equal(pic.g * pic.e, rightOf(o)); }
      else if (f.kind === 'full' || f.kind === 'empty') assert.equal(pic.slots.filter((x) => x === f.kind).length, rightOf(o), o.ask);
      else assert.equal(pic.slots.filter((x) => x !== 'none').length, rightOf(o), o.ask);
      assert.ok(rightOf(o) <= (step === 1 ? 5 : step === 2 ? CARRIES : 12));
    }
    // a part of the load
    for (const step of [1, 2]) { const o = M.part.make(step, { rand, frac }), f = o.facts; assert.ok(near(rightOf(o), f.whole * f.n / f.d), o.story); assert.ok(Number.isInteger(rightOf(o))); }
    // weights in tenths: adding, taking away, a load of canisters
    const a = M.weigh.make(1, { rand, frac }), fa = a.facts;
    assert.ok(near(rightOf(a), (fa.op === '+' ? fa.a + fa.b : fa.a - fa.b) / 10), a.story);
    const l = M.weigh.make(2, { rand, frac }), fl = l.facts;
    assert.ok(near(rightOf(l), fl.n * fl.w / 10), l.story);
    // percent
    for (const step of [1, 2]) { const o = M.percent.make(step, { rand, frac }), f = o.facts; assert.ok(near(rightOf(o), f.whole * f.pct / 100), `${o.story} -> ${o.answer}`); }
    // pay: tonnes times the price; the whole slip
    const p = M.pay.make(1, { rand, frac }), fp = p.facts;
    assert.ok(near(rightOf(p), fp.w / 10 * fp.price), p.story);
    assert.ok(METALS.some((m) => m.price === fp.price && p.story.includes(m.name)), 'a metal at its own price');
    const s = M.pay.make(2, { rand, frac }), fs = s.facts;
    assert.ok(near(rightOf(s), fs.n * fs.w / 10 * fs.pct / 100 * fs.price), s.story);
    assert.ok(near(fs.ore, fs.n * fs.w / 10) && near(fs.metal, fs.ore * fs.pct / 100));
    assert.equal(s.lines[s.lines.length - 1][1], '?');
    // no answer button hides a decimal as a fraction, and none shows a number gone wrong
    for (const o of [a, l, p, s]) for (const c of o.coins) assert.ok(/^[\d,]+(\.\d{1,2})?$/.test(c.big), `${o.story}: ${c.big}`);
  }
});

test('the smelter: every question has a picture and steps for Help, and its sums can be worked on paper', () => {
  const rand = seeded(23), M = smelter.makers;
  for (const [maker, steps] of [['count', [1, 2, 3]], ['part', [1, 2]], ['ore', [1, 2]], ['weigh', [1, 2]], ['percent', [1, 2]], ['pay', [1, 2]]]) {
    for (const step of steps) for (let k = 0; k < 60; k++) {
      const o = M[maker].make(step, { rand, frac: (k % 3) / 2 }), pic = helpPicture(o);
      assert.ok(pic.svg.startsWith('<svg') && !/NaN|undefined/.test(pic.svg), `${maker} ${step}: no picture`);
      // the picture never gives the answer away (the youngest count theirs; the others show a "?")
      if (maker !== 'count') assert.ok(pic.svg.includes('?'), `${maker} ${step}: the picture has no "?"`);
      if (maker === 'count') continue;
      // the sums: every step can be laid out by the worked sheet, the last one ends on the right answer, and each
      // later step works on from one before it
      assert.ok(o.sum, `${maker} ${step}: no sum`);
      const chain = o.sum.chain || [o.sum];
      for (const x of chain) assert.doesNotThrow(() => workOf(x), `${maker} ${step}: ${JSON.stringify(x)}`);
      chain.slice(1).forEach((x, i) => assert.ok(x.carried, `${maker} ${step}: step ${i + 2} does not follow on: ${JSON.stringify(chain)}`));
      const last = chain[chain.length - 1], end = last.op === 'add' ? last.a + last.b : last.op === 'sub' ? last.a - last.b : last.op === 'mul' ? last.a * last.b : last.a / last.b;
      assert.ok(near(end, rightOf(o)), `${maker} ${step}: ${o.story} ends on ${end}, the answer is ${o.answer}`);
    }
  }
});

test('the smelter: a slip counts the canisters in the hangar when the count suits and will stay; else its own', () => {
  const rand = seeded(31), M = smelter.makers;
  const load = (over = {}) => ({ canisters: CARRIES, phase: 'unload', onShip: 5, fullOnShip: 5, docked: [{ socket: 0, percent: 0 }, { socket: 2, percent: 40 }], drained: 1, onRack: 8, carried: 1,
    steady: { onShip: 60, fullOnShip: 60, docked: 60, drained: 60, onRack: 60 }, ...over });
  for (let k = 0; k < 120; k++) {
    forget();   // (each case afresh: a count of the hangar is asked about only once, see the next test)
    // the youngest: one of the counts that are 5 or fewer (5 on the ship, 2 at the wall), never the rack's 8
    const c = M.count.make(1, { rand, live: load() });
    assert.equal(c.facts.live, true); assert.ok(['ship', 'wall'].includes(c.facts.kind)); assert.equal(rightOf(c), c.facts.kind === 'ship' ? 5 : 2);
    // how many are still on the Miner: the ones really on it
    const st = M.count.make(2, { rand, live: load() });
    assert.equal(st.facts.kind, 'still'); assert.equal(rightOf(st), 5); assert.equal(st.help.pic.slots.filter((x) => x === 'none').length, CARRIES - 5);
    // a load of canisters: the canisters counted are the full ones on the ship, the ones at the wall, or all the ship carries
    const w = M.weigh.make(2, { rand, live: load() });
    assert.equal(w.facts.live, true); assert.equal(w.facts.n, { ship: 5, wall: 2, load: CARRIES }[w.facts.kind]);
    // ... and each of them holds the same on every slip about that haul (one weight for the whole haul)
    for (const round of [1, 3, LOADS.length + 2]) assert.equal(M.weigh.make(2, { rand, live: load({ round }) }).facts.w, LOADS[round % LOADS.length]);
    if (w.facts.kind === 'load') assert.equal(w.facts.from, 'This haul');
    // the whole slip: first the whole haul's own (all the canisters the Miner carries, wherever they are), once a haul;
    // after it, slips from the log, which do not say "now"
    const slip = M.pay.make(2, { rand, live: load() });
    assert.equal(slip.facts.n, CARRIES); assert.equal(slip.facts.from, 'This haul'); assert.equal(slip.facts.haul, 0);
    const next = M.pay.make(2, { rand, live: load() });
    assert.equal(next.facts.n, CARRIES); assert.equal(next.facts.live, false); assert.equal(next.facts.from, undefined);
    // a count about to change is not asked about; nor one that does not suit the level
    forget();
    const soon = load({ steady: { onShip: STEADY - 5, fullOnShip: STEADY - 5, docked: STEADY - 5, drained: 60, onRack: 60 } });
    assert.equal(M.count.make(1, { rand, live: soon }).facts.live, false);
    assert.notEqual(M.weigh.make(2, { rand, live: soon }).facts.kind, 'ship');
    assert.equal(M.count.make(1, { rand, live: load({ onShip: 8, fullOnShip: 8, docked: [], onRack: 8 }) }).facts.live, false);
    // while empties are going back on, the ship's canisters are not "still full"
    const loading = load({ phase: 'load', onShip: 3, fullOnShip: 0 });
    assert.notEqual(M.weigh.make(2, { rand, live: loading }).facts.kind, 'ship');
    // no hangar (node, the levels page): the job's own numbers
    assert.equal(M.count.make(1, { rand }).facts.live, false);
    assert.equal(M.weigh.make(2, { rand }).facts.live, false);
  }
  // through the engine: the live load reaches the maker
  const crew = crewOf();
  setLevelAt(crew, 'smelter', 'kCount');
  let seen = 0;
  for (let k = 0; k < 40; k++) { forget(); const q = E.deal(crew, smelter, { rand: seeded(k + 1), live: load() }); if (q.order.facts && q.order.facts.live) seen++; }
  assert.ok(seen > 5, `only ${seen} of 40 slips used the hangar's count`);
});

test('the smelter: a count of the hangar is asked about once, and again only when the crane has changed it', () => {
  const rand = seeded(41), M = smelter.makers;
  const load = (over = {}) => ({ canisters: CARRIES, phase: 'unload', round: 2, onShip: 5, fullOnShip: 5, docked: [{ socket: 0, percent: 0 }, { socket: 2, percent: 40 }], drained: 1, onRack: 8, carried: 1,
    steady: { onShip: 60, fullOnShip: 60, docked: 60, drained: 60, onRack: 60 }, ...over });
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
  // a load of canisters: the ship's, the wall's and the whole load's are three sums, each asked once a round
  forget();
  const sums = [1, 2, 3, 4, 5, 6, 7].map(() => M.weigh.make(2, { rand, live: load() }).facts);
  assert.deepEqual(sums.map((f) => f.live), [true, true, true, false, false, false, false]);
  assert.deepEqual(sums.slice(0, 3).map((f) => f.kind).sort(), ['load', 'ship', 'wall']);
  assert.equal(new Set(sums.slice(0, 3).map((f) => f.n)).size, 3);
  // a new round's load is new
  assert.equal(M.weigh.make(2, { rand, live: load({ round: 3 }) }).facts.live, true);
  forget();
});

test('the smelter: canisters of ore, a whole number of canisters times a fraction of a tonne, are right, with the real slips', () => {
  const rand = seeded(53), M = smelter.makers;
  // a whole number, a fraction or a mixed number on every button: never a decimal, never a "1." before it
  const FORM = /^(\d+|\d+\/\d+|\d+ \d+\/\d+)$/;
  // what each slip stands for, for n canisters of a/d of a tonne (Mathwood's fishing dock's slips, and the job's own)
  const SLIP = {
    partsOnly: (n, a) => n * a, leftOver: (n, a, d) => Math.floor(n * a / d), added: (n, a, d) => n + a / d, oneCanister: (n, a, d) => a / d,
    topAdded: (n, a, d) => (a + n) / d, bottomTimes: (n, a, d) => a / (d * n), groupOff: (n, a, d, v) => near(v, (n + 1) * a / d) || near(v, (n - 1) * a / d),
  };
  const AMBER = 'rx="1.5" fill="#e8922a"', WHITE = 'rx="1.5" fill="#fff"';
  for (let k = 0; k < 400; k++) {
    const step = 1 + (k % 2), o = M.ore.make(step, { rand, frac: (k % 5) / 4, who: { name: 'Miner Dov', she: false } }), f = o.facts, want = f.n * f.a / f.d;
    assert.ok(near(rightOf(o), want), `${o.story} -> ${o.answer}`);
    assert.deepEqual(f.ans, [f.n * f.a, f.d]);
    assert.ok(f.a < f.d && f.n >= 2, o.story);
    assert.ok(o.story.includes(`${f.n} `) && o.story.includes(`${f.a}/${f.d} of a tonne`), o.story);
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
    // help: the canisters, each cut in d equal parts with a of them shaded; the steps; the sums end on the answer
    const pic = helpPicture(o);
    assert.equal(o.help.pic.kind, 'orecans');
    assert.equal(pic.svg.split(AMBER).length - 1, f.n * f.a, `${o.story}: the shaded parts`);
    assert.equal(pic.svg.split(WHITE).length - 1, f.n * (f.d - f.a), `${o.story}: the parts not shaded`);
    assert.equal(o.help.steps.length, step === 1 ? 2 : 3);
    const chain = o.sum.chain || [o.sum], last = chain[chain.length - 1];
    assert.equal(last.op, 'div'); assert.equal(last.b, f.d); assert.ok(near(last.a / last.b, want));
  }
});

test('the smelter: the haul is the same haul on every slip about it, its ore against its slag', () => {
  for (let r = 0; r < 120; r++) {
    const H = haulOf(r);
    assert.deepEqual(H, haulOf(r));
    assert.equal(H.canisters, CARRIES); assert.equal(H.fill, LOADS[r % LOADS.length]);
    // the ore in each canister: halves, quarters or eighths of a tonne, under a tonne, with a tenth of a tonne or more of slag beside it
    const q = H.ore.n / H.ore.d;
    assert.ok([2, 4, 8].includes(H.ore.d) && q < 1 && q <= H.fill / 10 - 0.1 + 1e-9, `haul ${r}: ${H.ore.n}/${H.ore.d} of a tonne in ${H.fill / 10}`);
    assert.ok(Number.isInteger(H.oreTonnes) && near(H.oreTonnes, CARRIES * q));
    assert.ok(Number.isInteger(H.metal10) && H.metal10 >= 5 && Number.isInteger(H.pay) && near(H.pay, H.metal10 / 10 * H.metal.price));
    assert.ok(METALS.includes(H.metal));
  }
  const rand = seeded(61), M = smelter.makers;
  const live = (round) => ({ round, canisters: CARRIES, phase: 'unload', onShip: 5, fullOnShip: 5, docked: [{ socket: 0, percent: 0 }, { socket: 1, percent: 30 }, { socket: 2, percent: 90 }], drained: 1, onRack: 8, carried: 0,
    steady: { onShip: 60, fullOnShip: 60, docked: 60, drained: 60, onRack: 60 } });
  for (const round of [0, 4, 7, 22]) {
    forget();
    const H = haulOf(round), L = live(round);
    // the whole haul's ore and its pay: the same canisters, ore and metal
    const ore = M.ore.make(1, { rand, live: L }), pay = M.pay.make(2, { rand, live: L }), load = M.weigh.make(2, { rand, live: { ...L, docked: [], fullOnShip: 0, phase: 'load' } });
    assert.equal(ore.facts.kind, 'haul'); assert.equal(ore.facts.from, 'This haul'); assert.equal(ore.facts.haul, round);
    assert.deepEqual([ore.facts.n, ore.facts.a, ore.facts.d, ore.facts.metal], [CARRIES, H.ore.n, H.ore.d, H.metal.name]);
    assert.equal(rightOf(ore), H.oreTonnes);
    assert.equal(pay.facts.from, 'This haul'); assert.equal(pay.facts.ore, H.oreTonnes); assert.deepEqual(pay.facts.each, [H.ore.n, H.ore.d]);
    assert.ok(pay.story.includes(H.metal.name) && pay.story.includes(`${H.ore.n}/${H.ore.d} of a tonne`) && pay.story.includes(`${H.yield}%`), pay.story);
    assert.ok(near(rightOf(pay), H.pay), `${pay.story} -> ${pay.answer}`);
    assert.equal(pay.sum.chain[pay.sum.chain.length - 1].b, H.metal.price);
    assert.equal(load.facts.kind, 'load'); assert.equal(load.facts.w, H.fill); assert.equal(load.facts.from, 'This haul');
    // the canisters of it at the wall or on the ship, counted in the hangar: the haul's ore in each
    const some = M.ore.make(2, { rand, live: L });
    assert.ok(['wall', 'ship'].includes(some.facts.kind), some.story);
    assert.deepEqual([some.facts.a, some.facts.d, some.facts.n], [H.ore.n, H.ore.d, some.facts.kind === 'wall' ? 3 : 5]);
    // each once a haul: the next slips about the whole of it are from the log; a new haul is new
    assert.equal(M.ore.make(1, { rand, live: L }).facts.kind, 'own');
    assert.equal(M.pay.make(2, { rand, live: L }).facts.from, undefined);
    assert.equal(M.ore.make(1, { rand, live: live(round + 1) }).facts.kind, 'haul');
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
  // the ladder: the canisters of ore between "several parts" and "weights in tenths", no big jumps
  const ids = smelter.place.levels.map((L) => L.id), i = ids.indexOf('oreWhole');
  assert.deepEqual(ids.slice(i - 1, i + 3), ['parts', 'oreWhole', 'oreTimes', 'tenths']);
  E.register(smelter);
  assert.deepEqual(smelter.place.levels.slice(i - 1, i + 3).map((L) => L.grade), [40, 44, 47, 50]);
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
