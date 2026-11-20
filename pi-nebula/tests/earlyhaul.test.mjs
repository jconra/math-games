// THE SMELTER'S QUESTION ABOUT A HAUL THAT CAME HOME EARLY (src/jobs/smelter.js: A HAUL THAT CAME HOME EARLY; the
// game's maker, 2026-11-19: "only ... at the highest level ... for younger ages just ask 'approximate' questions or
// just part of the question", "Tip: 1/8 of 1000 is 125", Work it out holding their hand with the running total kept):
// which level gets which question, once a haul; the answers exact; the approximations rounded as the question says;
// the tip where eighths are asked; Work it out's sums and its running total adding up to the answer.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import * as MS from '../src/missions.js';
import { JOB as smelter, MINE_AT, TIP, mineKind, partFull, roundLots, partCans, haulOf, flownHaul, forget, sellsFor, priceOf, METALS, CARRIES, tonnesWords } from '../src/jobs/smelter.js';
import { helpPicture } from '../src/jobs/pics.js';
import { workOf } from '../../mathwood-valley/src/math/longwork.js';
import { answerOf } from '../../mathwood-valley/src/math/jobsums.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';
import { setLevelAt } from '../../mathwood-valley/src/levels/model.js';

E.register(smelter);
const LEVELS = smelter.place.levels, TOP = LEVELS[LEVELS.length - 1], M = smelter.makers;
const crewOf = () => ({ id: 'c1', name: 'Test', look: { id: 'zuri' }, age: null });
const num = (label) => Number(String(label).replace(/,/g, '').split(' ')[0]);
const rightOf = (o) => num(o.coins.find((c) => c.good).label);
const chainOf = (o) => (!o.sum ? [] : o.sum.chain || [o.sum]);
const hangar = (round) => ({ round, canisters: CARRIES, phase: 'unload', onShip: 5, fullOnShip: 5, docked: [{ socket: 0, percent: 0 }], drained: 1, onRack: 8, carried: 0,
  steady: { onShip: 60, fullOnShip: 60, docked: 60, drained: 60, onRack: 60 } });
const say = (n) => n.toLocaleString('en-US');

// hauls home early as the drill makes them: the Miner's eight canisters, one metal to a canister, each metal's part-full
// canister at a whole number of eighths, at least one part full (the game's maker's own example first)
const HIS = { titanium: 3.875, gold: 1.375, iron: 1, copper: 0.625 };
function earlyStores(n, rand) {
  const out = [HIS, { iron: 2.5 }, { gold: 0.125 }, { nickel: 0.375, gold: 0.25 }, { cobalt: 7.875 }, { iron: 1.5, nickel: 1.5, copper: 1.5, cobalt: 1.5 }];
  while (out.length < n) {
    const names = METALS.map((m) => m.name).sort(() => rand() - 0.5).slice(0, 1 + Math.floor(rand() * 4)), store = {};
    let left = CARRIES;
    for (const name of names) {
      if (left <= 0) break;
      const whole = Math.floor(rand() * Math.min(4, left)), part = Math.floor(rand() * 8);
      if (!whole && !part) continue;
      store[name] = whole + part / 8; left -= whole + (part ? 1 : 0);
    }
    if (Object.keys(store).length && Object.values(store).some((t) => !Number.isInteger(t))) out.push(store);
  }
  return out;
}
const STORES = earlyStores(160, seeded(41));

test('the ladder: approximately from the payout card\'s adding on, one part from its parts on, the exact question at the top only', () => {
  // the same points as the payout card's forms (src/missions.js): adding from 20, parts from 44
  assert.equal(MS.payoutForm(MINE_AT.approx), 'add'); assert.equal(MS.payoutForm(MINE_AT.approx - 1), 'count'); assert.equal(MS.payoutForm(MINE_AT.part), 'part');
  // the exact question is the top level's (the whole pay slip) and no other's
  assert.equal(TOP.id, 'payslip'); assert.equal(TOP.grade, MINE_AT.exact);
  for (const L of LEVELS.slice(0, -1)) assert.ok(L.grade < MINE_AT.exact, `${L.id} at ${L.grade}`);
  const kinds = LEVELS.map((L) => [L.id, mineKind(L.grade)]);
  assert.deepEqual(kinds, [['kCount', null], ['kFull', null], ['kRacks', null], ['loads', 'approx'], ['share', 'approx'], ['part', 'approx'], ['parts', 'approx'],
    ['oreWhole', 'part'], ['oreTimes', 'part'], ['tenths', 'part'], ['percent', 'part'], ['tonnes', 'part'], ['anyPercent', 'part'], ['eachMetal', 'part'], ['credits', 'part'], ['sale', 'part'], ['payslip', 'exact']]);
});

test('at every level, a haul home early is asked about once, by the level\'s kind, and never by a kind the level should not get', () => {
  let n = 100;
  for (const L of LEVELS) for (const store of STORES.slice(0, 24)) {
    forget(); const round = ++n; flownHaul(round, { store });
    const crew = crewOf(); setLevelAt(crew, 'smelter', L.id);
    const want = mineKind(L.grade), H = haulOf(round), tellable = want === 'approx' ? roundLots(H.lots).length > 0 : !!want;
    const keys = [];
    for (let k = 0; k < 8; k++) keys.push(E.deal(crew, smelter, { rand: seeded(n * 13 + k), live: hangar(round) }).order.key);
    const mine = keys.filter((x) => x.startsWith('mine:'));
    const why = `${L.id} (${L.grade}) ${JSON.stringify(store)}: ${keys.join(', ')}`;
    if (!tellable) { assert.deepEqual(mine, [], why); flownHaul(round, null); continue; }
    // the first slip is about it, of the level's own kind; the rest are the level's own
    assert.equal(keys[0], `mine:${want}`, why); assert.equal(mine.length, 1, why);
    // and never the old exact slip at a lower rung
    assert.ok(!keys.some((x) => x.startsWith('pay:mine')), why);
    flownHaul(round, null);
  }
  // a haul home with every canister full (whole tonnes) is never asked about this way
  for (const L of LEVELS) {
    forget(); flownHaul(77, { store: { iron: 4, nickel: 3, copper: 1 } }); const crew = crewOf(); setLevelAt(crew, 'smelter', L.id);
    for (let k = 0; k < 6; k++) assert.ok(!E.deal(crew, smelter, { rand: seeded(k + 5), live: hangar(77) }).order.key.startsWith('mine:'), L.id);
    flownHaul(77, null);
  }
  // nor a haul nobody the player knows flew, nor any slip from the log (no hangar)
  forget();
  for (const L of LEVELS) { const crew = crewOf(); setLevelAt(crew, 'smelter', L.id); for (let k = 0; k < 6; k++) { assert.ok(!E.deal(crew, smelter, { rand: seeded(k), live: hangar(3) }).order.key.startsWith('mine:')); assert.ok(!E.deal(crew, smelter, { rand: seeded(k) }).order.key.startsWith('mine:')); } }
  forget();
});

// Work it out's sums, as the sheet works them: each workable in columns, whole numbers, a carried number the answer of
// the sum it is carried from; and the running total: each row its metal's value, each total the last one and that row
function checkWork(o, want, why) {
  const chain = chainOf(o);
  for (const x of chain) { assert.ok(Number.isInteger(x.a) && Number.isInteger(x.b) && x.a >= 0 && x.b >= 0, `${why}: ${JSON.stringify(x)}`); assert.ok(workOf(x).steps.length > 0, why); if (x.op === 'sub') assert.ok(x.a >= x.b, why); }
  chain.forEach((x, i) => { for (const side of ['a', 'b']) if (x.carried && x.carried[side] != null) { assert.ok(x.carried[side] < i, why); assert.equal(answerOf(chain[x.carried[side]]), x[side], `${why}: sum ${i + 1}'s ${side}`); } });
  if (chain.length) assert.equal(answerOf(chain[chain.length - 1]), want, `${why}: the last sum ends on the answer`);
  return chain;
}
function checkTally(o, rows, why) {
  const T = o.tally, chain = chainOf(o);
  assert.ok(T && chain.length > 1, why);
  assert.deepEqual(T.rows.map((r) => [r.label.toLowerCase(), r.value]), rows, why);
  let total = 0;
  T.rows.forEach((r, i) => {
    // a row's value is its sum's answer, once done; or the chart's own number (a whole tonne), with no sum
    if (r.to >= r.from) assert.equal(answerOf(chain[r.to]), r.value, `${why}: ${r.label}`); else assert.equal(r.value, priceOf(r.label.toLowerCase()), `${why}: ${r.label} from the chart`);
    total += r.value;
    const t = T.totals[i];
    assert.equal(t.value, total, `${why}: the running total after the ${r.label}`);
    if (i > 0) { assert.equal(chain[t.after].op, 'add', why); assert.equal(answerOf(chain[t.after]), total, why); assert.deepEqual([chain[t.after].a, chain[t.after].b], [total - r.value, r.value], why); }
    // (it is written in as the sums come: never before its row's own value)
    assert.ok(t.after >= r.to, why);
  });
  assert.equal(T.totals[T.totals.length - 1].value, rightOf(o), `${why}: the running total adds up to the answer`);
  assert.equal(T.totals[T.totals.length - 1].after, chain.length - 1, why);
}

test('the exact question (the top): every metal in eighths, the total sale price exact, the tip, and Work it out metal by metal his way with a running total that adds up to it', () => {
  let n = 300;
  for (const store of STORES) {
    forget(); const round = ++n; flownHaul(round, { store });
    const H = haulOf(round), o = M.mine.make(3, { rand: seeded(n), live: hangar(round) }), why = JSON.stringify(store);
    assert.equal(o.key, 'mine:exact'); assert.equal(o.ask, 'What is the total sale price?'); assert.equal(o.tip, TIP);
    assert.equal(rightOf(o), sellsFor(store).pay, why); assert.equal(o.facts.ans, H.pay);
    assert.equal(o.coins.filter((c) => c.good).length, 1, why); assert.ok(o.coins.length >= 3, why);
    for (const c of o.coins) if (!c.good) assert.ok(num(c.label) !== H.pay && c.why.length > 15, why);
    // the amounts as they came home, an eighth as a fraction, never a decimal
    assert.equal(o.story, `Your crew came home with ${H.lots.map((L) => `${tonnesWords(L.tonnes, true)} of ${L.metal.name}`).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`);
    assert.ok(!/\d\.\d/.test(`${o.story} ${(o.lines || []).flat().join(' ')} ${o.rightWhy}`), why);
    const chain = checkWork(o, H.pay, why);
    if (chain.length > 1) checkTally(o, H.lots.map((L) => [L.metal.name, L.pay]), why);
    // HIS WAY: a part of a tonne starts from what 1/8 of a tonne sells for, 125 lots of the price in thousands; a
    // canister more than half full from the next whole tonne, the eighths it is short taken away
    for (const L of H.lots) {
      const k8 = Math.round(L.tonnes * 8), part = k8 % 8, said = chain.filter((x) => (x.say || '').toLowerCase().startsWith(L.metal.name));
      if (!part) continue;
      assert.ok(said.some((x) => x.op === 'mul' && x.a === 125 && x.b === L.price / 1000), `${why}: ${L.metal.name}'s eighth`);
      const own = chain.find((x) => x.say && x.say.startsWith(`So the ${L.metal.name} sells for`));
      if (Math.floor(k8 / 8) + (part >= 5 ? 1 : 0) === 0) continue;   // (under half a tonne: so many eighths, nothing to add to)
      assert.ok(own, `${why}: ${L.metal.name}'s own sum`); assert.equal(own.op, part >= 5 ? 'sub' : 'add', `${why}: ${L.metal.name}`);
      assert.equal(own.a, (part >= 5 ? Math.ceil(L.tonnes) : Math.floor(L.tonnes)) * L.price, why);
    }
    const pic = helpPicture(o, { dark: true }); assert.ok(pic.svg.startsWith('<svg') && !/NaN|undefined/.test(pic.svg + JSON.stringify(o)), why);
    flownHaul(round, null);
  }
  // the game's maker's own example: Titanium is 4 × 6,000 − (125 × 6), and 23,250 is kept for him
  forget(); flownHaul(9, { store: HIS });
  const o = M.mine.make(3, { rand: seeded(1), live: hangar(9) }), chain = chainOf(o).map((x) => [x.op, x.a, x.b]);
  assert.deepEqual(chain.slice(0, 3), [['mul', 125, 6], ['mul', 4, 6000], ['sub', 24000, 750]]);
  assert.deepEqual(o.tally.rows.map((r) => [r.label, r.note, r.value]), [['Titanium', '3 7/8 tonnes', 23250], ['Gold', '1 3/8 tonnes', 11000], ['Iron', '1 tonne', 2000], ['Copper', '5/8 of a tonne', 2500]]);
  assert.deepEqual(o.tally.totals.map((t) => t.value), [23250, 34250, 36250, 38750]);
  assert.equal(rightOf(o), 38750);
  flownHaul(9, null); forget();
});

test('approximately: each metal to the nearest whole tonne (a half up, under a half left out), the approximate payout from those, the exact pay never a wrong answer', () => {
  let n = 600, asked = 0, leftOut = 0;
  for (const store of STORES) {
    forget(); const round = ++n; flownHaul(round, { store });
    const H = haulOf(round), why = JSON.stringify(store);
    const want = H.lots.map((L) => [L.metal.name, L.tonnes % 1 >= 0.5 ? Math.ceil(L.tonnes) : Math.floor(L.tonnes)]).filter(([, t]) => t > 0);
    if (!want.length) { assert.equal(roundLots(H.lots).length, 0); assert.throws(() => M.mine.make(1, { rand: seeded(n), live: hangar(round) })); flownHaul(round, null); continue; }
    if (want.length < H.lots.length) leftOut++;
    const o = M.mine.make(1, { rand: seeded(n), live: hangar(round) }); asked++;
    assert.equal(o.key, 'mine:approx'); assert.equal(o.ask, 'What is your approximate payout?'); assert.equal(o.tip, undefined, 'no eighths asked: no tip');
    assert.deepEqual(o.facts.load.parts.map((p) => [p.metal, p.amt]), want, why);
    assert.equal(o.story, `You brought approximately ${want.map(([m, t]) => `${t} ${t === 1 ? 'tonne' : 'tonnes'} of ${m}`).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`);
    assert.ok(!/\/|\d\.\d/.test(`${o.story} ${o.coins.map((c) => c.label).join(' ')}`), why);
    const approx = want.reduce((a, [m, t]) => a + t * priceOf(m), 0);
    assert.equal(rightOf(o), approx, why); assert.equal(o.facts.exact, H.pay);
    assert.ok(o.rightWhy.includes(`${say(H.pay)} credits exactly`), o.rightWhy);
    assert.equal(o.coins.filter((c) => c.good).length, 1); assert.ok(o.coins.length >= 3, why);
    for (const c of o.coins) if (!c.good) assert.ok(num(c.label) !== H.pay && c.why.length > 15, `${why}: ${c.label}`);
    const chain = checkWork(o, approx, why);
    if (chain.length > 1) checkTally(o, want.map(([m, t]) => [m, t * priceOf(m)]), why);
    flownHaul(round, null);
  }
  assert.ok(asked > 100 && leftOut > 5, `${asked} asked, ${leftOut} with a metal left out`);
  // his own example, word for word but the capitals
  forget(); flownHaul(9, { store: HIS });
  const o = M.mine.make(1, { rand: seeded(2), live: hangar(9) });
  assert.equal(o.story, 'You brought approximately 4 tonnes of titanium, 1 tonne of gold, 1 tonne of iron and 1 tonne of copper.');
  assert.equal(rightOf(o), 38000);
  flownHaul(9, null); forget();
});

test('one part: one part-full canister, and what filling it would have brought, exactly; the tip; Work it out ends on it', () => {
  let n = 900;
  const seen = new Set();
  for (const store of STORES) for (let k = 0; k < 3; k++) {
    forget(); const round = ++n; flownHaul(round, { store });
    const H = haulOf(round), o = M.mine.make(2, { rand: seeded(n), live: hangar(round) }), why = JSON.stringify(store), f = o.facts;
    assert.equal(o.key, 'mine:part'); assert.equal(o.tip, TIP); assert.equal(o.ask, 'How much more would you have gotten if you finished filling it?');
    // the canister is one of the haul's part-full ones, as full as that metal's part of a tonne
    const can = partCans(H.lots).find((c) => c.m.name === f.metal);
    assert.ok(can && can.n === f.n && f.n >= 1 && f.n <= 7, why);
    assert.equal(o.story, `You filled ${/^[aeiou]/.test(f.metal) ? 'an' : 'a'} ${f.metal} canister up to ${tonnesWords(f.n / 8, true)}.`);
    const want = (8 - f.n) * priceOf(f.metal) / 8;
    assert.ok(Number.isInteger(want)); assert.equal(rightOf(o), want, why); assert.equal(f.ans, want);
    assert.equal(o.coins.filter((c) => c.good).length, 1); assert.ok(o.coins.length >= 3, why);
    for (const c of o.coins) if (!c.good) assert.ok(c.why.length > 15, why);
    const chain = checkWork(o, want, why);
    assert.deepEqual([chain[0].op, chain[0].a, chain[0].b], ['sub', 8, f.n]); assert.deepEqual([chain[1].op, chain[1].a, chain[1].b], ['mul', 125, priceOf(f.metal) / 1000]);
    const pic = helpPicture(o, { dark: true }); assert.ok(pic.svg.startsWith('<svg') && pic.svg.split('>?<').length - 1 === 8 - f.n, `${why}: a ? for each empty eighth`);
    seen.add(`${f.metal}:${f.n}`);
    flownHaul(round, null);
  }
  assert.ok(seen.size > 20, `${seen.size} canisters asked about`);
  // his own example: a gold canister at 3/8 of a tonne, 5/8 of 8,000 still to come
  forget(); flownHaul(9, { store: { gold: 1.375 } });
  const o = M.mine.make(2, { rand: seeded(3), live: hangar(9) });
  assert.equal(o.story, 'You filled a gold canister up to 3/8 of a tonne.'); assert.equal(rightOf(o), 5000);
  flownHaul(9, null); forget();
});

test('the tip is on a card only where eighths of a tonne are asked', () => {
  forget(); let tips = 0;
  for (const L of LEVELS) for (let k = 0; k < 30; k++) {
    const round = 1000 + k; flownHaul(round, k % 2 ? { store: STORES[k] } : null);
    const crew = crewOf(); setLevelAt(crew, 'smelter', L.id);
    const o = E.deal(crew, smelter, { rand: seeded(k * 31 + L.grade), live: hangar(round) }).order;
    const eighths = /\b\d\/8\b|[1357]\/8 of a tonne/.test(`${o.story} ${(o.lines || []).flat().join(' ')}`) || o.key === 'mine:part' || o.key === 'mine:exact';
    assert.equal(!!o.tip, eighths && o.key.startsWith('mine:'), `${L.id}: ${o.key} ${o.story}`);
    if (o.tip) { tips++; assert.equal(o.tip, 'Tip: 1/8 of 1000 is 125.'); }
    flownHaul(round, null);
  }
  assert.ok(tips > 20, `${tips} tips`); forget();
});
