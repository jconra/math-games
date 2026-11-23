// Captain Hale's rescue run (src/missions.js 'rescue'; at the planet src/rescue.js): her contract and its jobs, her own
// crew for the jobs left to them, the planet kept with the contract, so much for each person brought home, the payout
// card at the triage desk at every level, her words and her crew's along the run, and the jump computer's cards on her
// run (the Medic, the crashed ship, her crew; the mining run's own as they were).
//   node --test pi-nebula/tests/rescue.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import * as MS from '../src/missions.js';
import { missions, ROLES, MISSIONS, RESCUE } from '../src/missions.js';
import { JOB as pilot } from '../src/jobs/pilot.js';
import { JOB as medical } from '../src/jobs/medical.js';
import { helpPicture } from '../src/jobs/pics.js';
import { CAPTAINS, RUN_TALK } from '../src/lines.js';
import { podCount, PODS } from '../src/planet/pods.js';

const R = MISSIONS.rescue, MINING = MISSIONS.mining;
const crewOf = () => ({ id: 'c1', name: 'Maya', look: { id: 'zuri' } });
const num = (label) => { const s = String(label).replace(/,/g, ''), m = s.match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : NaN; };
const rightOf = (o) => num(o.coins.find((c) => c.good).label);
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test('her run is data: Captain Hale, the Medic, to a planet; Pilot 10%, Paramedic 20%, Engineer 20%; paid at the triage desk', () => {
  assert.equal(R.captain, 'hale'); assert.equal(R.ship, 'medic'); assert.equal(R.place, 'planet'); assert.equal(R.payAt, 'medical');
  assert.deepEqual(R.roles, ['pilot', 'medic', 'engineer']);
  assert.deepEqual(R.roles.map((id) => ROLES[id].share), [10, 20, 20], 'the mining run\'s shares');
  assert.equal(MS.shareOf(R.roles), 50);
  assert.equal(CAPTAINS.hale.mission, 'rescue'); assert.equal(missions.ready('hale'), true); assert.equal(MS.missionOf('hale'), R);
  // her contract's words, her own; the mining run's as they were
  assert.match(R.about, /Medic/); assert.match(R.about, /pods/); assert.match(R.paid, /triage desk/);
  assert.match(MINING.about, /^The Miner flies out to the rocks, fills its 8 canisters with ore and comes home\./); assert.equal(MINING.payAt, 'smelter');
  for (const k of ['contract', 'signed', 'payout']) assert.ok(CAPTAINS.hale[k], 'her ' + k + ' line');
  assert.match(CAPTAINS.hale.payout, /triage desk/);
  // the steps: out, the jump to the planet, the rescue (her crew's for now), the jump home, home; the core's tuning out there
  assert.deepEqual(R.steps.map((s) => s.kind), ['leave', 'jump', 'tune', 'rescue', 'jump', 'land']);
  assert.equal(R.steps[1].to, 'planet'); assert.equal(R.steps[4].to, 'home');
  assert.deepEqual(MS.stepsFor(R, ['pilot', 'engineer'], 'arrive').map((s) => s.id + (s.mine ? '*' : '')), ['out', 'jumpOut*', 'core*', 'site', 'jumpHome*', 'home']);
  assert.deepEqual(MS.stepsFor(R, ['pilot', 'engineer'], 'leave').map((s) => s.id + (s.mine ? '*' : '')), ['out', 'jumpOut*', 'site', 'core*', 'jumpHome*', 'home']);
  assert.deepEqual(MS.stepsFor(R, ['engineer'], 'arrive').map((s) => s.id + (s.mine ? '*' : '')), ['out', 'jumpOut', 'core*', 'site', 'jumpHome', 'home']);
  // (signed as the paramedic: the planet's part, the pods, is theirs)
  assert.deepEqual(MS.stepsFor(R, ['medic']).map((s) => s.id + (s.mine ? '*' : '')), ['out', 'jumpOut', 'site*', 'jumpHome', 'home']);
  assert.deepEqual(MS.stepsFor(R, ['pilot', 'medic', 'engineer'], 'leave').map((s) => s.id + (s.mine ? '*' : '')), ['out', 'jumpOut*', 'site*', 'core*', 'jumpHome*', 'home']);
});

test('her three jobs: Pilot, Paramedic, Engineer, each signed for alone or with the others (the game\'s maker, RESC3-1)', () => {
  // ("The medical one can be the paramedic ... For the paramedic the questions are to open the pods")
  assert.equal(ROLES.medic.ready, true); assert.equal(ROLES.medic.name, 'Paramedic'); assert.match(ROLES.medic.does, /stasis pods/);
  assert.deepEqual(MS.rolesOf(R).map((r) => r.name + (r.open ? '' : ' (crew)')), ['Pilot', 'Paramedic', 'Engineer']);
  assert.deepEqual(MS.openRoles(R), ['pilot', 'medic', 'engineer']);
  for (const want of [['pilot'], ['medic'], ['engineer'], ['pilot', 'medic'], ['medic', 'engineer'], ['pilot', 'engineer'], ['pilot', 'medic', 'engineer']]) {
    const c = crewOf(), m = MS.sign(c, 'rescue', want);
    assert.deepEqual(m.roles, want);
    assert.equal(MS.contractOf(JSON.parse(JSON.stringify(c))).roles.join(), want.join(), 'kept through a reload');
  }
  assert.equal(MS.rolesWords(['pilot', 'medic']), 'Pilot and paramedic');
  // (a contract kept from before, signed for the jobs then open: as it was)
  const old = crewOf(); old.mission = { id: 'rescue', captain: 'hale', roles: ['pilot', 'engineer'], state: 'signed', signed: 1, seed: 5 };
  assert.deepEqual(MS.contractOf(old).roles, ['pilot', 'engineer']);
  // (her own paramedic, for the job left to her crew)
  assert.equal(MS.roleOf(R, 'medic').crew, 'Paramedic Teo');
  // (the pilot's words on her contract are her run's: to the planet)
  assert.equal(MS.rolesOf(R)[0].does, 'piloting to the planet and home');
  assert.equal(MS.rolesOf(MINING)[0].does, 'piloting to the rocks and home');
});

test('the planet is picked as the contract is signed and kept with it (its seed), whatever the core\'s moment', () => {
  const c = crewOf(), m = MS.sign(c, 'rescue', ['pilot', 'engineer'], 1, () => 0, seq(0.25));
  assert.equal(m.seed, 1 + Math.floor(0.25 * 999999)); assert.equal(MS.seedOf(c), m.seed);
  assert.equal(m.tune, 'arrive', 'the core\'s moment from its own pick');
  const c2 = crewOf(); MS.sign(c2, 'rescue', ['pilot'], 1, () => 0, () => 0.5);
  assert.equal(MS.seedOf(c2), 1 + Math.floor(0.5 * 999999));
  const c3 = crewOf(); MS.sign(c3, 'mining', ['pilot']); assert.equal(MS.seedOf(c3), null, 'a mining run goes to no planet');
  assert.equal(c3.mission.seed, undefined);
  // (through a reload: the contract as kept)
  const back = JSON.parse(JSON.stringify(c)); assert.equal(MS.seedOf(back), m.seed);
});

test('who is aboard: her and one of her own crew, in the Medic\'s uniform in their position\'s colour', () => {
  const H = { id: 'hale', name: 'Captain Hale' };
  const a1 = MS.aboardOf(R, ['pilot', 'engineer'], H);
  assert.deepEqual(a1.map((a) => a.name + ':' + a.jobs.join('+')), ['Captain Hale:', 'Paramedic Teo:medic']);
  const a2 = MS.aboardOf(R, ['engineer'], H);
  assert.deepEqual(a2.map((a) => a.name + ':' + a.jobs.join('+')), ['Captain Hale:medic', 'Pilot Cass:pilot']);
  assert.equal(a2[1].look.position, 'pilot'); assert.equal(a2[1].look.crew, 'medic');
  const a3 = MS.aboardOf(R, ['pilot'], H);
  assert.deepEqual(a3.map((a) => a.name + ':' + a.jobs.join('+')), ['Captain Hale:engineer', 'Paramedic Teo:medic']);
  // (signed as the paramedic: her pilot comes along and flies, she sees to the core)
  assert.deepEqual(MS.aboardOf(R, ['medic'], H).map((a) => a.name + ':' + a.jobs.join('+')), ['Captain Hale:engineer', 'Pilot Cass:pilot']);
  assert.deepEqual(MS.aboardOf(R, ['pilot', 'medic'], H).map((a) => a.name + ':' + a.jobs.join('+')), ['Captain Hale:', 'Engineer Mara:engineer']);
  assert.equal(a3[1].look.position, 'medic'); assert.equal(a3[1].look.crew, 'medic');
  // her crew, never the Miner's
  for (const mine of [[], ['pilot'], ['engineer'], ['pilot', 'engineer']]) for (const a of MS.aboardOf(R, mine, H)) assert.ok(!/Juno|Kestrel|Okafor/.test(a.name), a.name);
  assert.deepEqual(MS.crewFor(R, ['pilot'], 'You', 'Captain Hale').map((c) => c.name), ['You', 'Paramedic Teo', 'Captain Hale']);
  // the mining run's crew as it was
  assert.deepEqual(MS.aboardOf(MINING, ['pilot'], { id: 'ruiz', name: 'Captain Ruiz' }).map((a) => a.name), ['Captain Ruiz', 'Miner Kestrel']);
});

test('the pay: the same for each person brought home, however many there are; each share a whole number of credits', () => {
  // "it should always pay the same per person. If there are more people then that is just getting lucky."
  assert.ok(Number.isInteger(RESCUE.perPerson / 1000), 'a whole thousand a person');
  assert.equal(R.perPerson, RESCUE.perPerson);
  for (let n = PODS.count[0]; n <= PODS.count[1]; n++) for (const roles of [['pilot'], ['engineer'], ['pilot', 'engineer']]) {
    const c = crewOf(); MS.sign(c, 'rescue', roles);
    const P = MS.land(c, { people: n, n: 99, store: { gold: 8 } });
    assert.equal(P.kind, 'rescue'); assert.equal(P.people, n); assert.equal(P.per, RESCUE.perPerson);
    assert.equal(P.sold, n * RESCUE.perPerson, 'so much a person, nothing of a haul');
    assert.equal(P.pay, n * RESCUE.perPerson * MS.shareOf(roles) / 100); assert.ok(Number.isInteger(P.pay));
    const r = MS.collect(c); assert.equal(r.pay, P.pay); assert.equal(c.mission, undefined);
  }
  // how many there are is the planet's: 3 to 6 pods, by its seed
  const seen = new Set(); for (let s = 1; s < 400; s++) seen.add(podCount(s));
  assert.deepEqual([...seen].sort(), [3, 4, 5, 6]);
});

test('the payout card at the triage desk: count the people, so many at so much each, a part, a percent; the pay with the right answer at every level', () => {
  E.register(medical);
  const want = { count: /How many people did your crew bring home/, add: /How many credits did the rescue pay/, part: /How many credits is your share/, percent: /How many credits is your pay/ };
  for (const grade of [0, 5, 10, 19, 20, 30, 43, 44, 50, 57, 58, 70, 80]) for (const n of [3, 4, 5, 6]) for (const roles of [['pilot'], ['pilot', 'engineer'], ['engineer']]) {
    const c = crewOf(); MS.sign(c, 'rescue', roles); MS.land(c, { people: n });
    const m = MS.contractOf(c), P = m.payout, o = MS.payoutOrder(m, grade, seq(0.1, 0.6, 0.3, 0.9));
    const form = MS.payoutForm(grade);
    assert.equal(o.form, form); assert.match(o.ask, want[form]); assert.equal(o.payout, P.pay);
    assert.equal(rightOf(o), form === 'count' ? n : form === 'add' ? P.sold : P.pay, `grade ${grade}, ${n} people, ${roles}`);
    assert.equal(o.coins.filter((k) => k.good).length, 1);
    for (const k of o.coins) if (!k.good) assert.ok(k.why && num(k.label) !== rightOf(o), k.label);
    // (its own words: no haul, tonne, canister or metal on it)
    const words = [o.story, o.ask, o.rightWhy, ...o.lines.flat(), ...o.coins.map((k) => k.why || '')].join(' ');
    assert.ok(!/haul|tonne|canister|metal|smelter|ore\b/i.test(words), words);
    assert.match(o.lines.map((l) => l.join(': ')).join('; '), new RegExp(`Brought home: ${n} people`));
    if (form === 'count' || form === 'add') { const h = helpPicture(o); assert.equal((h.svg.match(/<circle/g) || []).length, n, 'a figure for each person'); }
  }
  // (the mining run's own card as it was: a haul's)
  const c = crewOf(); MS.sign(c, 'mining', ['pilot']); MS.land(c, { n: 3, store: { iron: 8 } });
  assert.match(MS.payoutOrder(MS.contractOf(c), 70).story, /^The haul sold for/);
});

test('her words and her crew\'s along the run: a line for every moment the trip has', () => {
  const T = RUN_TALK.rescue;
  for (const k of ['out', 'crewOut', 'there', 'down', 'find', 'found', 'site', 'sitePod', 'backAboard', 'aboard', 'aboardCrew', 'home', 'homeCrew', 'landed', 'landedCrew', 'tune', 'tuned', 'tunedFree', 'backJump', 'backFind']) assert.ok(Array.isArray(T[k]) && T[k].length, k);
  const all = Object.values(T).flat().join(' ');
  assert.ok(!/rocks|smelter|canister|Juno|drill/i.test(all), 'nothing of the mining run');
  assert.match(T.landed.join(' '), /triage desk/);
});

test('the jump computer on her run: the Medic, the crashed ship and her crew in every card at every level; the mining run\'s cards as they were', () => {
  E.register(pilot);
  const live = (to, k) => ({ lamp: ['distance', 'charge', 'go'][k % 3], to, ship: 'Medic', far: 'planet', folk: R.folk });
  const bad = [];
  for (let L = 0; L < pilot.place.levels.length; L++) for (const to of ['planet', 'home']) for (let k = 0; k < 9; k++) {
    const c = crewOf(); for (let s = 0; s < L; s++) E.step(c, pilot, 1);
    const o = E.deal(c, pilot, { live: live(to, k), rand: seq(((L * 7 + k * 3) % 10) / 10 + 0.05, 0.37, 0.71, 0.13) }).order;
    const txt = [o.story, o.ask, o.rightWhy, JSON.stringify(o.help || {}), ...(o.coins || []).map((x) => x.why || '')].join(' ').replace(/"kind":"field"/g, '');
    for (const w of ['Miner', 'asteroid field', 'mine', 'field', 'rocks', 'Juno', 'Ruiz', 'Kestrel', 'Okafor']) if (new RegExp('\\b' + w + '\\b').test(txt)) bad.push(w + ': ' + o.story);
  }
  assert.deepEqual(bad, []);
  assert.equal(R.folk.length, 4); assert.deepEqual(R.folk.map((f) => f.name), ['Captain Hale', 'Pilot Cass', 'Paramedic Teo', 'Engineer Mara']);
  // (the mining run: nothing changed by its own live words)
  const c = crewOf(); for (let s = 0; s < 12; s++) E.step(c, pilot, 1);
  const r1 = seq(0.2, 0.4, 0.6, 0.8), r2 = seq(0.2, 0.4, 0.6, 0.8);
  const a = E.deal(c, pilot, { live: { lamp: 'distance', to: 'field', ship: 'Miner', far: 'field' }, rand: r1 }).order, b = E.deal(c, pilot, { live: { lamp: 'distance', to: 'field' }, rand: r2 }).order;
  assert.equal(a.story, b.story); assert.equal(a.ask, b.ask);
});
