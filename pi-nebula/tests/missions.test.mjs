// A captain's run (src/missions.js) and the pilot's seat (src/jobs/pilot.js): the contract's shares, what a haul the
// crew flew sells for and each share of it, the rich rock's one in five, the trip's steps and what is kept with the
// crew member, the payout card at every level, and every level of the pilot's ladder.
//   node --test pi-nebula/tests/missions.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import * as MS from '../src/missions.js';
import { missions, ROLES, MISSIONS, CARDS, RICH, ORE_BY_CLEAN } from '../src/missions.js';
import { JOB as pilot, pickAsk } from '../src/jobs/pilot.js';
import { JOB as smelter, haulOf, flownHaul, forget, CARRIES, LOADS, ORE_SELLS, RICH_METAL, METALS } from '../src/jobs/smelter.js';
import { helpPicture } from '../src/jobs/pics.js';
import { CAPTAINS } from '../src/lines.js';
import { workOf } from '../../mathwood-valley/src/math/longwork.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';
import { PROBLEMS, PLACE } from '../../mathwood-valley/src/levels/places.js';
import { setLevelAt } from '../../mathwood-valley/src/levels/model.js';

const crewOf = (age = null) => ({ id: 'c1', name: 'Maya', look: { id: 'zuri' }, age });
// an answer's amount from its label: "9.6 kilometres", "1,800 credits", "beacon 13"
const num = (label) => { const s = String(label).replace(/,/g, ''), m = s.match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : NaN; };
const rightOf = (o) => num(o.coins.find((c) => c.good).label);
const near = (a, b) => Math.abs(a - b) < 1e-9;
const endOf = (x) => (x.op === 'add' ? x.a + x.b : x.op === 'sub' ? x.a - x.b : x.op === 'mul' ? x.a * x.b : x.a / x.b);
const MINING = MISSIONS.mining;

// ── the contract ─────────────────────────────────────────────────────────────────────────────────────────────────
test('the contract: the three roles and their shares, as the game\'s maker gave them', () => {
  // "10% for piloting to location / 20% for operating the drill / 20% for serving as engineer"
  assert.deepEqual(MINING.roles, ['pilot', 'drill', 'engineer']);
  assert.deepEqual(MINING.roles.map((id) => ROLES[id].share), [10, 20, 20]);
  assert.equal(MS.shareOf(MINING.roles), 50, 'all three roles: half the haul');
  assert.equal(MS.shareOf(['pilot']), 10); assert.equal(MS.shareOf(['pilot', 'drill']), 30); assert.equal(MS.shareOf([]), 0);
  // "if the ore is worth 10000, and the contract said they get 50% of it, then they would make 5,000 credits"
  assert.equal(MS.payOf(10000, 50), 5000); assert.equal(MS.payOf(18000, 10), 1800);
  // every role is data: a name, what it does, its share, whether its game is made, and who does it otherwise
  for (const id of MINING.roles) { const R = ROLES[id]; assert.ok(R.name && R.does && R.crew && Number.isInteger(R.share) && typeof R.ready === 'boolean', id); }
  assert.match(MINING.paid, /share of what the haul sells for/); assert.match(MINING.paid, /smelter/);
  assert.equal(MINING.captain, 'ruiz'); assert.equal(CAPTAINS.ruiz.mission, 'mining'); assert.equal(missions.ready('ruiz'), true);
  // the other captains' trips are not made yet: their offers end as before
  assert.equal(missions.ready('vega'), false); assert.equal(missions.ready('hale'), false);
});

test('the contract: the pilot and the drill can be signed for, alone or together; the engineer is his crew\'s, and switches on with one flag', () => {
  const R = MS.rolesOf(MINING);
  assert.deepEqual(R.map((r) => [r.id, r.open]), [['pilot', true], ['drill', true], ['engineer', false]]);
  assert.deepEqual(MS.openRoles(MINING), ['pilot', 'drill']);
  const crew = crewOf();
  // asking for more than is open signs for what is open
  const m = MS.sign(crew, 'mining', ['pilot', 'drill', 'engineer'], 1000);
  assert.deepEqual(m, { id: 'mining', captain: 'ruiz', roles: ['pilot', 'drill'], state: 'signed', signed: 1000 });
  assert.equal(MS.sign(crewOf(), 'mining', ['engineer']), null, 'nothing open among those asked: no contract');
  assert.equal(MS.sign(crew, 'mining', ['pilot']), null, 'one mission at a time');
  // each alone
  assert.deepEqual(MS.sign(crewOf(), 'mining', ['pilot']).roles, ['pilot']); assert.deepEqual(MS.sign(crewOf(), 'mining', ['drill']).roles, ['drill']);
  // the drill and not the pilot: the field is the crew member's, the jumps the crew's own pilot's (the short version)
  const S = MS.stepsFor(MINING, ['drill']);
  assert.deepEqual(S.map((s) => [s.id, s.mine]), [['out', false], ['jumpOut', false], ['field', true], ['jumpHome', false], ['home', false]]);
  assert.deepEqual(MS.stepsFor(MINING, ['pilot', 'drill']).filter((s) => s.mine).map((s) => s.id), ['jumpOut', 'field', 'jumpHome']);
  // who does what on the trip: the crew member their own role, the captain's crew the rest
  assert.deepEqual(MS.crewFor(MINING, ['pilot'], 'Maya').map((c) => c.name), ['Maya', 'Miner Kestrel', 'Engineer Okafor']);
  assert.equal(MS.rolesWords(['pilot']), 'Pilot'); assert.equal(MS.rolesWords(['pilot', 'drill', 'engineer']), 'Pilot, drill operator and engineer');
  // the engineer's game made: one flag, and it can be signed for, its step is the crew member's, its share is added
  ROLES.engineer.ready = true;
  try {
    assert.deepEqual(MS.openRoles(MINING), ['pilot', 'drill', 'engineer']);
    const all = MS.sign(crewOf(), 'mining', ['engineer', 'drill', 'pilot']);
    assert.deepEqual(all.roles, ['pilot', 'drill', 'engineer']); assert.equal(MS.shareOf(all.roles), 50);
    assert.equal(MS.stepsFor(MINING, ['engineer']).find((s) => s.id === 'field').mine, true);
    assert.equal(MS.stepsFor(MINING, ['engineer']).find((s) => s.id === 'jumpOut').mine, false, 'the crew\'s pilot flies it');
  } finally { ROLES.engineer.ready = false; }
});

// ── the trip's steps ─────────────────────────────────────────────────────────────────────────────────────────────
test('the mission\'s steps: out, the jump, the field, the jump home, home; a pilot does the two jumps', () => {
  assert.deepEqual(MINING.steps.map((s) => [s.id, s.kind]), [['out', 'leave'], ['jumpOut', 'jump'], ['field', 'work'], ['jumpHome', 'jump'], ['home', 'land']]);
  const S = MS.stepsFor(MINING, ['pilot']);
  assert.deepEqual(S.filter((s) => s.mine).map((s) => s.id), ['jumpOut', 'jumpHome']);
  // "calculate a jump (with maybe 3 questions)": three cards a jump, one for each lamp
  for (const s of S.filter((x) => x.kind === 'jump')) assert.equal(s.cards, 3);
  assert.equal(CARDS, 3); assert.equal(MS.LAMPS.length, CARDS);
  assert.deepEqual(S.filter((s) => s.kind === 'jump').map((s) => s.to), ['field', 'home']);
  // only the jump out counts toward the haul; the crew's own drilling is a short scene (15 to 25 seconds)
  assert.equal(S.find((s) => s.id === 'jumpOut').counts, true); assert.ok(!S.find((s) => s.id === 'jumpHome').counts);
  const work = S.find((s) => s.kind === 'work'); assert.ok(work.secs >= 15 && work.secs <= 25, String(work.secs));
  // the parts of a pilot-only run that are not cards come to well under a minute, so the run is about two minutes
  const fixed = S.reduce((t, s) => t + (s.secs || 0), 0);
  assert.ok(fixed >= 20 && fixed <= 45, String(fixed));
});

// ── the haul and the money ───────────────────────────────────────────────────────────────────────────────────────
test('the haul a crew flew: more green lamps on the jump out bring more ore home, never harshly', () => {
  // three green lamps: 7 tonnes; two: 6; one or none: 5 (eight canisters, a part of a tonne of ore in each)
  assert.deepEqual([3, 2, 1, 0].map((c) => MS.forecast({ clean: c }).oreTonnes), [7, 6, 5, 5]);
  for (const [a, d] of ORE_BY_CLEAN) assert.ok(a < d && Number.isInteger(CARRIES * a / d));
  assert.deepEqual(MS.oreFor(9), ORE_BY_CLEAN[3]); assert.deepEqual(MS.oreFor(-1), ORE_BY_CLEAN[0]);
  // never harshly: every card missed still brings home five sevenths of the best haul
  assert.ok(MS.forecast({ clean: 0 }).sold / MS.forecast({ clean: 3 }).sold > 0.7);
  // what it sells for: 3,000 credits a tonne of ore; the pilot's tenth
  assert.deepEqual([3, 2, 1].map((c) => MS.forecast({ clean: c }).sold), [21000, 18000, 15000]);
  assert.deepEqual([3, 2, 1].map((c) => MS.forecast({ clean: c }).pay), [2100, 1800, 1500]);
});

test('the money is the size the game\'s maker asked: about 2,000 for the pilot, about 8,300 for all three roles, double for a rich rock', () => {
  // the pilot alone, a usual rock: 1,500 to 2,100; counting the one rich rock in five, about 2,000 a run
  const mean = (clean, roles) => { const usual = MS.forecast({ clean, roles }).pay, rich = MS.forecast({ clean, roles, rich: true }).pay; return usual * (1 - RICH) + rich * RICH; };
  for (const c of [1, 2, 3]) assert.ok(mean(c, ['pilot']) >= 1700 && mean(c, ['pilot']) <= 2600, `${c} green: ${mean(c, ['pilot'])}`);
  assert.ok(Math.abs(mean(2, ['pilot']) - 2000) < 250, String(mean(2, ['pilot'])));
  // all three roles (when their games are made), a usual rock: 7,500 to 10,500, his 8,300 inside it
  const all = [1, 2, 3].map((c) => MS.forecast({ clean: c, roles: MINING.roles }).pay);
  assert.deepEqual(all, [7500, 9000, 10500]);
  assert.ok(all[0] < 8300 && all[2] > 8300);
  // a rich rock: exactly double
  for (const c of [0, 1, 2, 3]) assert.equal(MS.forecast({ clean: c, rich: true }).pay, 2 * MS.forecast({ clean: c }).pay);
});

test('the rich rock: one in five', () => {
  assert.equal(RICH, 0.2);
  const rand = seeded(77); let rich = 0; const N = 20000;
  for (let k = 0; k < N; k++) if (MS.isRich(rand)) rich++;
  assert.ok(rich / N > 0.185 && rich / N < 0.215, `${rich} of ${N}`);
  assert.equal(MS.isRich(() => 0.19), true); assert.equal(MS.isRich(() => 0.2), false);
});

test('a flown haul is one haul on every slip: its ore, its weight, its metal, what it sells for; a rich rock is titanium and pays double', () => {
  const rand = seeded(5), M = smelter.makers;
  const live = (round) => ({ round, canisters: CARRIES, phase: 'unload', onShip: 5, fullOnShip: 5, docked: [{ socket: 0, percent: 0 }, { socket: 1, percent: 30 }, { socket: 2, percent: 90 }], drained: 1, onRack: 8, carried: 0,
    steady: { onShip: 60, fullOnShip: 60, docked: 60, drained: 60, onRack: 60 } });
  for (let n = 1; n <= 40; n++) for (const clean of [0, 1, 2, 3]) for (const rich of [false, true]) {
    forget(); flownHaul(n, null);
    const before = haulOf(n);
    const crew = crewOf(); MS.sign(crew, 'mining', ['pilot']);
    const P = MS.land(crew, { n, clean, rich, now: 5 }), H = haulOf(n);
    assert.equal(H.flown, true); assert.equal(H.rich, rich); assert.equal(H.n, n); assert.equal(H.canisters, CARRIES);
    // the ore the crew had time to cut, in every canister; whole tonnes in all
    assert.deepEqual([H.ore.n, H.ore.d], ORE_BY_CLEAN[clean]); assert.equal(H.oreTonnes, MS.forecast({ clean }).oreTonnes);
    // its canisters weigh the haul's own weight or the next heavy enough to hold that ore and a tenth of a tonne of slag
    assert.ok(LOADS.includes(H.fill) && H.ore.n / H.ore.d <= H.fill / 10 - 0.1 + 1e-9, `haul ${n}: ${H.ore.n}/${H.ore.d} in ${H.fill / 10}`);
    if (before.ore.n / before.ore.d >= H.ore.n / H.ore.d) assert.equal(H.fill, before.fill);
    // a rich rock is titanium; a usual one the haul's own metal; a tonne of ore sells for 3,000, a rich rock's 6,000
    assert.equal(H.metal.name, rich ? RICH_METAL : before.metal.name); assert.ok(METALS.includes(H.metal));
    assert.equal(H.pay, H.oreTonnes * ORE_SELLS * (rich ? 2 : 1));
    assert.ok(Number.isInteger(H.metal10) && near(H.pay, H.metal10 / 10 * H.metal.price));
    // the payout is that haul's: what it sold for, the pilot's tenth
    assert.deepEqual(P, { n, canisters: CARRIES, ore: ORE_BY_CLEAN[clean], oreTonnes: H.oreTonnes, metal: H.metal.name, price: H.metal.price, yield: H.yield, rich, clean, sold: H.pay, share: 10, pay: H.pay / 10, at: 5 });
    assert.deepEqual(P, { ...P, ...MS.forecast({ clean, rich }) , ore: P.ore });
    if (n % 7) { flownHaul(n, null); continue; }
    // ... and the smelter's own slips about that haul say the same: its ore, its whole pay slip, its canisters' weight
    const ore = M.ore.make(1, { rand, live: live(n) }), pay = M.pay.make(2, { rand, live: live(n) }), load = M.weigh.make(2, { rand, live: { ...live(n), docked: [], fullOnShip: 0, phase: 'load' } });
    const top = rich ? 'This haul: a rich rock' : 'This haul';
    assert.equal(ore.facts.kind, 'haul'); assert.equal(ore.facts.from, top); assert.equal(rightOf(ore), H.oreTonnes); assert.ok(ore.story.includes(`${H.metal.name} ore`), ore.story);
    assert.equal(pay.facts.from, top); assert.ok(near(rightOf(pay), P.sold), `${pay.story} -> ${pay.answer}`);
    assert.ok(pay.story.includes(`${H.yield}% of the ore is ${H.metal.name}`) && pay.story.includes(`${H.metal.price.toLocaleString('en-US')} credits a tonne`), pay.story);
    assert.equal(load.facts.kind, 'load'); assert.equal(load.facts.w, H.fill); assert.equal(load.facts.from, top);
    flownHaul(n, null);
  }
  forget();
  // a haul nobody the player knows flew is as it was: never rich, its own ore
  assert.equal(flownHaul(3), null); assert.equal(haulOf(3).flown, false);
  assert.throws(() => flownHaul(3, { ore: [1, 3] }), /whole tonnes/);
  assert.throws(() => flownHaul(3, { ore: [9, 8] }));
});

// ── what is kept with the crew member ────────────────────────────────────────────────────────────────────────────
test('kept with the crew member: the contract through a reload, the payout through a reload, the credits when it is collected', () => {
  const crew = crewOf(); crew.credits = 450;
  assert.equal(MS.contractOf(crew), null); assert.equal(MS.land(crew, { n: 1 }), null, 'no contract, no payout'); assert.equal(MS.collect(crew), null);
  MS.sign(crew, 'mining', ['pilot'], 123);
  // (saved as the game saves it: text and back)
  const reload = (c) => JSON.parse(JSON.stringify(c));
  let back = reload(crew);
  assert.deepEqual(MS.contractOf(back), { id: 'mining', captain: 'ruiz', roles: ['pilot'], state: 'signed', signed: 123 });
  // a reload in the middle of a trip: nothing of the trip itself is kept, so the contract is still signed
  assert.equal(MS.contractOf(back).state, 'signed'); assert.equal(MS.collect(back), null, 'nothing to collect before the run is flown');
  // home: the payout waits, through a reload too
  flownHaul(4, null);
  const P = MS.land(back, { n: 4, clean: 3, rich: true, now: 999 });
  assert.equal(MS.contractOf(back).state, 'payout'); assert.equal(P.pay, 4200);
  assert.equal(E.credits(back), 450, 'not paid until it is collected');
  back = reload(back);
  assert.deepEqual(MS.contractOf(back).payout, P);
  assert.equal(MS.land(back, { n: 5 }), null, 'one run, one payout');
  assert.equal(MS.sign(back, 'mining', ['pilot']), null, 'no new contract while a share waits');
  // collected: the credits arrive as a job's pay does, in whole credits; the mission is done
  assert.deepEqual(MS.collect(back), { pay: 4200, credits: 4650 });
  assert.equal(E.credits(back), 4650); assert.equal(back.jobs.mining.earned, 4200); assert.equal(back.jobs.mining.n, 1);
  assert.equal(back.mission, undefined); assert.equal(MS.contractOf(back), null); assert.equal(MS.collect(back), null);
  assert.ok(MS.sign(back, 'mining', ['pilot']), 'and the captain can be signed with again');
  // something kept that this build does not know is left alone, not taken for a contract
  for (const bad of [{ id: 'salvage', roles: ['pilot'], state: 'signed' }, { id: 'mining', roles: [], state: 'signed' }, { id: 'mining', roles: ['pilot'], state: 'payout' }, 'mining', null]) assert.equal(MS.contractOf({ mission: bad }), null, JSON.stringify(bad));
  flownHaul(4, null);
});

test('the captain\'s offer for a crew member: new, asked, then by their contract', () => {
  const crew = crewOf(), cap = { id: 'ruiz', name: 'Captain Ruiz', ship: 'Miner', mission: 'mining' };
  const heard = [], went = [];
  missions.on((c, yes) => heard.push([c.id, yes])); missions.onGo((c, yes) => went.push([c.id, yes]));
  missions.asked('ruiz'); assert.equal(missions.state('ruiz', crew), 'asked');
  missions.answer(cap, true); assert.equal(missions.state('ruiz', crew), 'interested'); assert.deepEqual(heard, [['ruiz', true]]);
  // the card put away unsigned: the offer stays open
  missions.declined('ruiz'); assert.equal(missions.state('ruiz', crew), 'declined'); assert.equal(MS.contractOf(crew), null);
  MS.sign(crew, 'mining', ['pilot']); assert.equal(missions.state('ruiz', crew), 'signed');
  assert.equal(missions.state('vega', crew), 'new', 'another captain is not this contract\'s');
  missions.go(cap, true); assert.deepEqual(went, [['ruiz', true]]);
  flownHaul(2, null); MS.land(crew, { n: 2 }); assert.equal(missions.state('ruiz', crew), 'payout');
  MS.collect(crew); assert.equal(missions.state('ruiz', crew), 'declined', 'collected: this visit\'s answer again, and he asks afresh');
  assert.equal(missions.state('ruiz', crewOf()), 'declined'); assert.equal(missions.state('hale'), 'new');
  flownHaul(2, null);
});

// ── the payout card ──────────────────────────────────────────────────────────────────────────────────────────────
test('the payout card: a question about this haul for every level, the same pay with each, its picture and its sums', () => {
  const rand = seeded(9);
  assert.deepEqual([0, 5, 6, 19, 20, 43, 44, 57, 58, 80].map(MS.payoutForm), ['count', 'count', 'count', 'count', 'times', 'times', 'part', 'part', 'percent', 'percent']);
  const haulFor = (roles, clean, rich, n) => { const crew = crewOf(); flownHaul(n, null); crew.mission = { id: 'mining', captain: 'ruiz', roles, state: 'signed', signed: 1 }; MS.land(crew, { n, clean, rich }); return crew; };
  for (const roles of [['pilot'], ['pilot', 'drill'], ['drill', 'engineer'], ['pilot', 'drill', 'engineer']]) for (const clean of [0, 2, 3]) for (const rich of [false, true]) {
    const crew = haulFor(roles, clean, rich, 6), P = crew.mission.payout;
    assert.equal(P.pay, P.sold * MS.shareOf(roles) / 100);
    for (const grade of [0, 6, 16, 20, 30, 44, 50, 58, 76]) {
      const o = MS.payoutOrder(crew.mission, grade, rand), form = MS.payoutForm(grade), why = `${roles} ${clean} ${rich} at ${grade}`;
      assert.equal(o.form, form); assert.equal(o.payout, P.pay, why);
      assert.equal(o.coins.filter((c) => c.good).length, 1, why); assert.ok(o.coins.length >= 3, why);
      assert.equal(new Set(o.coins.map((c) => c.label)).size, o.coins.length, why);
      for (const c of o.coins) { assert.ok(/^[\d,]+$/.test(c.big), c.big); if (!c.good) assert.ok(c.why && c.why.length > 15 && num(c.label) !== rightOf(o), `${why}: ${c.label}`); }
      const text = `${o.story} ${o.ask} ${o.coins.map((c) => `${c.label} ${c.why}`).join(' ')} ${o.rightWhy} ${(o.lines || []).flat().join(' ')} ${o.help.line} ${(o.help.steps || []).join(' ')}`;
      assert.ok(!/NaN|undefined|Infinity|\[object/.test(text), text);
      // the right answer: the canisters (the four on one side for the youngest), what it sold for, or the pay itself
      const want = form === 'count' ? (grade < 6 ? 4 : 8) : form === 'times' ? P.sold : P.pay;
      assert.equal(rightOf(o), want, `${why}: ${o.story} ${o.ask}`);
      // the card always says what the share comes to, or asks for it: the pay is never a surprise
      assert.ok(form === 'part' || form === 'percent' || `${o.story} ${o.rightWhy}`.includes(`${P.pay.toLocaleString('en-US')} credits`), why);
      assert.equal(o.facts.from, rich ? 'Your share: a rich rock' : 'Your share');
      // Help: a picture (the youngest count theirs on the card; the others show a "?"), and sums that end on the answer
      const pic = helpPicture(o);
      assert.ok(pic.svg.startsWith('<svg') && !/NaN|undefined/.test(pic.svg), why);
      if (form === 'count') { assert.equal(o.picFirst, true); assert.equal(o.help.pic.slots.length, want); continue; }
      assert.ok(pic.svg.includes('?'), why);
      const chain = o.sum.chain || [o.sum];
      for (const x of chain) assert.doesNotThrow(() => workOf(x), JSON.stringify(x));
      chain.slice(1).forEach((x) => assert.ok(x.carried, `${why}: ${JSON.stringify(chain)}`));
      assert.ok(near(endOf(chain[chain.length - 1]), want), `${why}: ends on ${endOf(chain[chain.length - 1])}`);
    }
    flownHaul(6, null);
  }
});

// ── the pilot's ladder ───────────────────────────────────────────────────────────────────────────────────────────
const LEVELS = ['kHops', 'kMore', 'kBack', 'kPast', 'kCan', 'kEqual', 'jumps', 'share', 'plot1', 'turn', 'speed', 'fast', 'sensor', 'minutes', 'plot4', 'round', 'table', 'course', 'legs', 'minsec', 'triangle', 'span'];
test('the pilot\'s seat joins Mathwood\'s levels: twenty-two levels, easiest first, kindergarten to past eighth grade', () => {
  assert.equal(E.register(pilot), true); assert.deepEqual(PROBLEMS, []);
  const L = PLACE.pilot.levels;
  assert.deepEqual(L.map((x) => x.id), LEVELS);
  for (let i = 1; i < L.length; i++) assert.ok(L[i].grade >= L[i - 1].grade, `${L[i].id}: ${L[i].grade} after ${L[i - 1].grade}`);
  assert.equal(L[0].grade, 0); assert.ok(L[L.length - 1].grade >= 80);
  // no step up is more than about a school year
  for (let i = 1; i < L.length; i++) assert.ok(L[i].grade - L[i - 1].grade <= 12, `${L[i - 1].id} to ${L[i].id}: ${L[i].grade - L[i - 1].grade}`);
});

test('every level of the pilot\'s ladder deals good cards about navigating: one right answer, wrong ones that say why, a picture', () => {
  const WEST = /\b(horse|cattle|wagon|saloon|stagecoach|rifle|cowhand|steer|Yuma|Tucson|jerky|harvest supper|town social|miles?)\b/i;
  // every card is about the way, the fuel, the map or the heading: no sum with only a space word on it
  const NAV = /\b(hops?|jumps?|fuel|field|rocks|station|beacons?|course|heading|nose|compass|map|kilometres|trip|way ahead|sensor|planet|asteroid|flies|flew|thrusters|reactor)\b/i;
  const seenKinds = new Set();
  for (const L of pilot.place.levels) {
    const rand = seeded(L.id.length * 131 + L.grade);
    const keys = new Set();
    for (let k = 0; k < 80; k++) {
      const crew = crewOf();
      setLevelAt(crew, 'pilot', L.id);
      const to = k % 2 ? 'home' : 'field', q = E.deal(crew, pilot, { rand, live: k % 5 === 4 ? null : { lamp: ['distance', 'charge', 'go'][k % 3], to } }), o = q.order;
      assert.equal(q.level.id, L.id); keys.add(o.key); seenKinds.add(o.key.split(':')[0]);
      assert.equal(o.coins.filter((c) => c.good).length, 1, `${L.id}: ${o.story}`);
      assert.ok(o.coins.length >= 3, `${L.id}: ${o.coins.length} answers`);
      assert.equal(new Set(o.coins.map((c) => c.label)).size, o.coins.length, `${L.id}: two answers alike`);
      const text = `${o.story} ${o.ask} ${o.coins.map((c) => `${c.big} ${c.small} ${c.label} ${c.why}`).join(' ')} ${o.rightWhy || ''}`;
      assert.ok(!/NaN|undefined|Infinity|\[object/.test(text), `${L.id}: ${text}`);
      assert.ok(!WEST.test(`${o.story} ${o.ask}`), `${L.id}: the west got in: ${o.story} ${o.ask}`);
      assert.ok(NAV.test(`${o.story} ${o.ask}`), `${L.id}: not about navigating: ${o.story} ${o.ask}`);
      for (const c of o.coins.filter((x) => !x.good)) assert.ok(c.why && c.why.length > 12, `${L.id}: ${c.label} has no line why`);
      // an answer is a number with its unit, a yes or no, a point, a heading, or a picture (a map, a diagram with its equation)
      for (const c of o.coins) assert.ok(c.svg ? c.svg.startsWith('<svg') && !/NaN|undefined/.test(c.svg) : /^([\d,]+(\.\d{1,2})?°?|Yes|No|\(-?\d, -?\d\))$/.test(c.big), `${L.id}: ${c.big}`);
      if (o.lead) assert.ok(o.lead.startsWith('<svg') && o.lead.includes('?') && !/NaN|undefined/.test(o.lead), `${L.id}/${o.key}: its map`);
      // Help: a picture for this card
      const pic = helpPicture(o);
      assert.ok(pic.svg.startsWith('<svg') && !/NaN|undefined/.test(pic.svg), `${L.id}/${o.key}: no picture`);
      assert.ok(q.worth.pay >= E.PAY.min && q.worth.pay <= E.PAY.max && q.worth.secs > 4 && q.worth.secs < 60, `${L.id}: ${q.worth.pay} for ${q.worth.secs} s`);
    }
    assert.ok(keys.size >= 2, `${L.id}: only ${[...keys]}`);
    const ex = E.example(pilot, L, seeded(3));
    assert.ok(ex.q.length > 20 && ex.a, L.id);
  }
  for (const kind of ['hops', 'fuel', 'plot', 'heading', 'rate', 'method', 'groups', 'share', 'parts', 'ratio']) assert.ok(seenKinds.has(kind), kind);
});

test('the pilot\'s own makers are right: the hops, the fuel, the map, the headings, the speeds and times, which sum fits', () => {
  const rand = seeded(21), M = pilot.makers;
  // (a card's sums: each can be laid out by the worked sheet, and the last works on from the ones before it)
  const sumEnds = (o) => { const chain = o.sum.chain || [o.sum]; for (const x of chain) assert.doesNotThrow(() => workOf(x), `${o.key}: ${JSON.stringify(x)}`); assert.ok(chain.length === 1 || chain[chain.length - 1].carried, `${o.key}: ${JSON.stringify(chain)}`); return endOf(chain[chain.length - 1]); };
  const good = (o) => o.coins.find((c) => c.good);
  for (let k = 0; k < 400; k++) {
    const live = k % 3 ? { to: k % 2 ? 'home' : 'field' } : null, frac = (k % 5) / 4;
    // the hops: counted on the card
    for (const step of [1, 2, 3, 4]) {
      const o = M.hops.make(step, { rand, live }), f = o.facts, r = rightOf(o);
      assert.equal(o.picFirst, true); assert.equal(o.coins.length, 3, o.story); assert.equal(o.help.pic.kind, 'hops');
      const want = { count: f.n, more: f.a + f.b, left: f.n - f.b, land: f.a + f.b, gap: f.b, equal: f.g * f.e }[f.kind];
      assert.equal(r, want, `${o.story} ${o.ask}`);
      assert.ok(r <= [5, 10, 20, 50][step - 1], `${o.story}: ${r}`);
      if (step === 3) assert.ok(f.end > 10 && f.end <= 20, o.story);
      if (o.sum) assert.ok(near(sumEnds(o), want), o.story);
      if (live && f.to) assert.equal(f.to, live.to);
    }
    // the fuel against the way: what is left, there and back, can we get there and back
    for (const step of [1, 2, 3]) {
      const o = M.fuel.make(step, { rand }), f = o.facts, lab = good(o).label;
      assert.equal(o.picFirst, true); assert.equal(o.coins.length, 3, o.story); assert.equal(o.help.pic.kind, 'fuel');
      if (f.kind === 'left') { assert.equal(rightOf(o), f.fuel - f.out); assert.ok(f.fuel <= 10 && f.fuel > f.out); assert.ok(near(sumEnds(o), f.fuel - f.out)); }
      else if (f.kind === 'back') { assert.equal(rightOf(o), 2 * f.out); assert.ok(2 * f.out <= 12); }
      else {
        const d = f.fuel - 2 * f.out;
        assert.equal(f.ans, d); assert.equal(f.need, 2 * f.out);
        assert.equal(lab, d > 0 ? `Yes, with ${d} ${d === 1 ? 'unit' : 'units'} to spare` : d === 0 ? 'Yes, with none to spare' : `No, we are ${-d} ${d === -1 ? 'unit' : 'units'} short`, o.story);
        assert.equal(good(o).big, d >= 0 ? 'Yes' : 'No');
        assert.ok(near(sumEnds(o), Math.abs(d)), o.story);
      }
    }
    // the map: a point in one quarter, a point anywhere, a course round the rings
    for (const step of [1, 2]) {
      const o = M.plot.make(step, { rand }), f = o.facts, P = `(${f.x}, ${f.y})`;
      assert.equal(o.coins.length, 4, o.story);
      if (step === 1) assert.ok(f.x >= 1 && f.x <= 6 && f.y >= 1 && f.y <= 6 && f.x !== f.y); else assert.ok(Math.abs(f.x) <= 8 && Math.abs(f.y) <= 8 && f.x * f.y !== 0 && (f.x < 0 || f.y < 0), P);
      assert.ok(good(o).label.endsWith(P), `${o.story}: ${good(o).label}`);
      if (f.form === 'mark') { assert.ok(o.story.includes(P)); for (const c of o.coins) assert.ok(c.svg, 'four small maps'); assert.ok(o.coins.some((c) => c.label.endsWith(`(${f.y}, ${f.x})`)), 'across and up swapped is one of them'); }
      else { assert.ok(o.lead && !o.story.includes(P)); assert.ok(!o.lead.includes(P), 'the map does not write the answer'); }
      assert.ok(helpPicture(o).svg.includes('?'));
    }
    const c3 = M.plot.make(3, { rand }), f3 = c3.facts;
    assert.equal(rightOf(c3), f3.a + f3.b + 2 * f3.h, c3.story); assert.ok(near(sumEnds(c3), f3.a + f3.b + 2 * f3.h)); assert.ok(c3.lead.includes('?'));
    assert.ok(c3.coins.some((c) => num(c.label) === f3.a + f3.b), 'the straight line through the rings is one of the wrong ones');
    // headings: a turn, a new heading, the sensor's angle, round the compass, the way home
    for (const step of [1, 2, 3]) {
      const o = M.heading.make(step, { rand }), f = o.facts, lab = good(o).label;
      assert.equal(o.coins.length, 4, o.story); assert.equal(o.help.pic.kind, 'compass'); assert.ok(helpPicture(o).svg.includes('?'));
      if (f.form === 'turn') assert.equal(rightOf(o), f.to - f.now);
      else if (f.form === 'new') assert.equal(rightOf(o), f.now + f.turn);
      else if (f.form === 'sensor') { assert.equal(f.ans, f.s + f.g); assert.equal(lab, `${Math.abs(f.ans)} degrees to the ${f.ans < 0 ? 'left' : 'right'}`, o.story); assert.ok(f.ans !== 0 && Math.abs(f.ans) <= 120); assert.ok(near(sumEnds(o), Math.abs(f.ans))); }
      else if (f.form === 'round') { assert.equal(rightOf(o), (f.now + f.turn) % 360); assert.ok(f.now + f.turn > 360); assert.ok(near(sumEnds(o), rightOf(o))); }
      else { assert.equal(rightOf(o), f.out + 180); assert.ok(f.out + 180 < 360); }
    }
    // speed, time and distance
    for (const step of [1, 2, 3, 4, 5, 6]) {
      const o = M.rate.make(step, { rand, live, frac }), f = o.facts, r = rightOf(o);
      let want;
      if (step <= 3) { assert.equal(f.d, f.sp * f.tm); want = f.form === 'distance' ? f.d : f.form === 'speed' ? f.sp : f.tm; if (step === 1) assert.equal(f.form, 'distance'); if (step === 2) assert.ok(f.form !== 'distance'); }
      else if (step === 4) { assert.equal(f.d10, f.sp * f.tm); want = f.form === 'distance' ? f.d10 / 10 : f.tm; }
      else if (step === 5) { assert.deepEqual(f.d, [f.s[0] * f.t[0], f.s[1] * f.t[1]]); want = f.form === 'legs' ? f.t[0] + f.t[1] : (f.d[0] + f.d[1]) / (f.t[0] + f.t[1]); }
      else { assert.equal(f.d, f.sp * f.m * 60); want = f.form === 'minutes' ? f.m : f.d; }
      assert.ok(near(r, want), `${o.story} ${o.ask} -> ${o.answer}, not ${want}`);
      assert.ok(near(sumEnds(o), want), `${o.key}: ${o.story}`);
      assert.equal(o.coins.length, 4, `${o.key}: ${o.story}`);
      assert.ok(helpPicture(o).svg.includes('?'), o.key);
    }
    // which is the right way to work it out: four diagrams, each with its equation; the computer does the sum
    for (const step of [1, 2]) {
      const o = M.method.make(step, { rand }), f = o.facts, eq = good(o).label;
      assert.equal(o.coins.length, 4, o.story);
      for (const c of o.coins) { assert.ok(c.svg && c.svg.includes(c.label.replace(/&/g, '&amp;')), 'the equation is on its diagram'); }
      const want = { hyp: ['distance = √(a² + b²)', Math.hypot(f.P || 0, f.F || 0)], leg: ['ring = √(c² − a²)', Math.sqrt((f.D || 0) ** 2 - (f.P || 0) ** 2)],
        span: ['length = 2 × distance × tan(angle ÷ 2)', 2 * (f.D || 0) * Math.tan((f.A || 0) / 2 * Math.PI / 180)], range: ['distance = (length ÷ 2) ÷ tan(angle ÷ 2)', (f.L || 0) / 2 / Math.tan((f.A || 0) / 2 * Math.PI / 180)] }[f.form];
      assert.equal(eq, want[0], o.story); assert.ok(near(f.ans, want[1]) && f.ans > 0);
      assert.ok(o.rightWhy.startsWith('The ship\'s computer:') && o.rightWhy.includes(Math.round(want[1]).toLocaleString('en-US')), o.rightWhy);
      assert.ok(helpPicture(o).svg.includes('?') && o.help.steps.length >= 2);
    }
  }
});

test('where the jump is going: the cards of the way out speak of the rocks, the cards of the way home of the station', () => {
  const rand = seeded(4), M = pilot.makers;
  for (let k = 0; k < 60; k++) {
    for (const [maker, step] of [['hops', 1], ['hops', 2], ['rate', 2], ['rate', 3], ['rate', 6]]) {
      const out = M[maker].make(step, { rand, live: { to: 'field' } }), home = M[maker].make(step, { rand, live: { to: 'home' } });
      assert.ok(!/station/i.test(`${out.story} ${out.ask}`), `${out.story} ${out.ask}`);
      assert.ok(!/\brocks\b/i.test(`${home.story} ${home.ask}`), `${home.story} ${home.ask}`);
    }
  }
});

test('the jump\'s three lamps: a card that suits the lamp is dealt where the level has one', () => {
  const rand = seeded(8);
  // the youngest: the hops for DISTANCE, the fuel against the way for CHARGE
  const L1 = pilot.place.levels.find((x) => x.id === 'kHops').gen.mix;
  for (let k = 0; k < 30; k++) {
    assert.equal(pickAsk(L1, { rand, live: { lamp: 'distance' } }).maker, 'hops');
    assert.equal(pickAsk(L1, { rand, live: { lamp: 'charge' } }).maker, 'fuel');
    assert.equal(pickAsk(L1, { rand, live: { lamp: 'go' } }), null, 'none suits: the level\'s own pick');
    assert.equal(pickAsk(L1, { rand, live: null }), null); assert.equal(pickAsk(L1, { rand }), null);
  }
  // through the engine, on a trip: lamp by lamp
  const crew = crewOf(); setLevelAt(crew, 'pilot', 'fast'); crew.levels.places.pilot.keep = true;
  for (let k = 0; k < 30; k++) {
    assert.equal(E.deal(crew, pilot, { rand, live: { lamp: 'go', to: 'field' } }).order.facts.form === 'distance', false, 'GO: how fast or how long');
    assert.equal(E.deal(crew, pilot, { rand, live: { lamp: 'distance', to: 'field' } }).order.facts.form, 'distance');
  }
});

test('the cards of a run pay nothing by themselves, but the level and the kinds of math hear them', () => {
  const crew = crewOf(); crew.credits = 300;
  setLevelAt(crew, 'pilot', 'speed');
  const start = E.level(crew, pilot).i;
  for (let k = 0; k < 8; k++) {
    const q = E.deal(crew, pilot, { rand: seeded(30 + k), live: { lamp: 'distance', to: 'field' } });
    const r = E.answer(crew, pilot, q, q.order.coins.findIndex((c) => c.good), { ms: 9000, pay: false });
    assert.equal(r.right, true); assert.equal(r.pay, 0); assert.equal(r.credits, 300); assert.ok(r.worth > 0);
  }
  assert.ok(E.level(crew, pilot).i > start, 'the level climbed');
  // a miss, then the right one: nothing paid either way, and the miss is the pick the level hears
  const q9 = E.deal(crew, pilot, { rand: seeded(41), live: { lamp: 'distance', to: 'home' } });
  const miss = E.answer(crew, pilot, q9, q9.order.coins.findIndex((c) => !c.good), { pay: false });
  assert.equal(miss.right, false); assert.equal(miss.pay, 0);
  assert.equal(E.answer(crew, pilot, q9, q9.order.coins.findIndex((c) => c.good), { pay: false }).pay, 0);
  assert.equal(E.credits(crew), 300); assert.equal(crew.jobs.pilot.earned, 0); assert.equal(crew.jobs.pilot.n, 9); assert.equal(crew.jobs.pilot.right, 8);
  assert.ok(crew.skill && Object.keys(crew.skill).length > 0, 'the kinds of math heard them');
  // any other card still pays as it did
  const q = E.deal(crew, pilot, { rand: seeded(99) });
  assert.equal(E.answer(crew, pilot, q, q.order.coins.findIndex((c) => c.good), { ms: 9000 }).pay, q.worth.pay);
});
