// A captain's run (src/missions.js) and the pilot's seat (src/jobs/pilot.js): the contract's shares, what a haul the
// crew flew sells for and each share of it, the rich rock's one in five, the trip's steps and what is kept with the
// crew member, the payout card at every level, and every level of the pilot's ladder.
//   node --test pi-nebula/tests/missions.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import * as MS from '../src/missions.js';
import { missions, ROLES, MISSIONS, CARDS } from '../src/missions.js';
import { JOB as pilot, pickAsk, plotJudge } from '../src/jobs/pilot.js';
import { JOB as smelter, haulOf, flownHaul, forget, sellsFor, lotsWords, tonnesWords, eighthsText, priceOf, CARRIES, METALS, CHART, PRICE_TIMES, HOLD, CAN_TONNES } from '../src/jobs/smelter.js';
import { crewLoad, seeded as seed } from '../src/drill.js';
import { helpPicture, navMap, mapSpot, PALE, NIGHT } from '../src/jobs/pics.js';
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
const smelterAll = await import('../src/jobs/smelter.js');

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

test('the contract: each of the three jobs can be signed for, alone or with the others; a job whose game is not made is his crew\'s, by one flag', () => {
  const R = MS.rolesOf(MINING);
  assert.deepEqual(R.map((r) => [r.id, r.open]), [['pilot', true], ['drill', true], ['engineer', true]]);
  assert.deepEqual(MS.openRoles(MINING), ['pilot', 'drill', 'engineer']);
  const crew = crewOf();
  const m = MS.sign(crew, 'mining', ['pilot', 'drill'], 1000);
  assert.deepEqual(m, { id: 'mining', captain: 'ruiz', roles: ['pilot', 'drill'], state: 'signed', signed: 1000 });
  assert.equal(MS.sign(crew, 'mining', ['pilot']), null, 'one mission at a time');
  // each alone, and all three: half the haul
  assert.deepEqual(MS.sign(crewOf(), 'mining', ['pilot']).roles, ['pilot']); assert.deepEqual(MS.sign(crewOf(), 'mining', ['drill']).roles, ['drill']);
  assert.deepEqual(MS.sign(crewOf(), 'mining', ['engineer']).roles, ['engineer']); assert.equal(MS.shareOf(['engineer']), 20);
  const all = MS.sign(crewOf(), 'mining', ['engineer', 'drill', 'pilot']);
  assert.deepEqual(all.roles, ['pilot', 'drill', 'engineer']); assert.equal(MS.shareOf(all.roles), 50);
  // a job whose game is not made: asking for more than is open signs for what is open, and nothing open, no contract
  ROLES.engineer.ready = false;
  try {
    assert.deepEqual(MS.rolesOf(MINING).map((r) => [r.id, r.open]), [['pilot', true], ['drill', true], ['engineer', false]]);
    assert.deepEqual(MS.sign(crewOf(), 'mining', ['pilot', 'drill', 'engineer'], 1000), { id: 'mining', captain: 'ruiz', roles: ['pilot', 'drill'], state: 'signed', signed: 1000 });
    assert.equal(MS.sign(crewOf(), 'mining', ['engineer']), null);
    assert.equal(MS.tuneFor(MINING, ['engineer']), null, 'and its step is the crew\'s');
  } finally { ROLES.engineer.ready = true; }
  // the drill and not the pilot: the field is the crew member's, the jumps the crew's own pilot's (the short version)
  const S = MS.stepsFor(MINING, ['drill']);
  assert.deepEqual(S.map((s) => [s.id, s.mine]), [['out', false], ['jumpOut', false], ['field', true], ['jumpHome', false], ['home', false]]);
  assert.deepEqual(MS.stepsFor(MINING, ['pilot', 'drill']).filter((s) => s.mine).map((s) => s.id), ['jumpOut', 'field', 'jumpHome']);
  // who does what on the trip: the crew member their own role, the captain's crew the rest (a crew of three: the one
  // of his crew who comes along, the captain himself for any other: src/missions.js aboardOf)
  assert.deepEqual(MS.crewFor(MINING, ['pilot'], 'Maya', 'Captain Ruiz').map((c) => c.name), ['Maya', 'Miner Kestrel', 'Captain Ruiz']);
  assert.deepEqual(MS.crewFor(MINING, ['engineer'], 'Maya', 'Captain Ruiz').map((c) => c.name), ['Pilot Juno', 'Captain Ruiz', 'Maya']);
  assert.deepEqual(MS.crewFor(MINING, ['pilot', 'drill'], 'Maya', 'Captain Ruiz').map((c) => c.name), ['Maya', 'Maya', 'Engineer Okafor']);
  assert.equal(MS.rolesWords(['pilot']), 'Pilot'); assert.equal(MS.rolesWords(['pilot', 'drill', 'engineer']), 'Pilot, drill operator and engineer');
  // the engineer alone takes no part in anything that is flown: the crew's pilot flies it, the crew drills
  assert.deepEqual(MS.stepsFor(MINING, ['engineer']).map((s) => [s.id, s.mine]), [['out', false], ['jumpOut', false], ['field', false], ['jumpHome', false], ['home', false]]);
});

test('who is aboard: a crew of three, the crew member, the captain and one of his crew; each job left is done by one of the two', () => {
  // "The idea is that it's a ship with a crew of 3"; "if you are just an engineer, then the other 2 models can just sit
  // in the chairs the entire time"; "Later on when you can hire crew ... even if they are just along for the ride"
  const cap = { id: 'ruiz', name: 'Captain Ruiz' };
  const subsets = [['pilot'], ['drill'], ['engineer'], ['pilot', 'drill'], ['pilot', 'engineer'], ['drill', 'engineer'], ['pilot', 'drill', 'engineer']];
  for (const mine of subsets) {
    const A = MS.aboardOf(MINING, mine, cap);
    assert.equal(A.length, 2, mine.join()); assert.ok(A[0].captain && A[0].name === 'Captain Ruiz' && A[0].short === 'Ruiz');
    const jobs = A.flatMap((a) => a.jobs);
    // every job left is someone's, once; none of the crew member's own is
    assert.deepEqual([...jobs].sort(), MINING.roles.filter((r) => !mine.includes(r)).sort(), mine.join());
    for (const r of mine) assert.ok(!jobs.includes(r));
    // his crew member is the one named for the first job left (all signed for: his pilot, along for the ride)
    const left = MINING.roles.filter((r) => !mine.includes(r));
    assert.equal(A[1].name, ROLES[left[0] || 'pilot'].crew); assert.deepEqual(A[1].jobs, left.length ? [left[0]] : []);
  }
  // signed only as engineer: the two flight-deck jobs are the other two's, one each
  const E2 = MS.aboardOf(MINING, ['engineer'], cap);
  assert.deepEqual(E2.map((a) => a.jobs), [['drill'], ['pilot']]); assert.equal(E2[1].short, 'Juno');
});

// ── the core's tuning: the engineer's step ───────────────────────────────────────────────────────────────────────
test('the core\'s tuning is a step in the mission\'s data: the engineer\'s, three cards, out at the rocks on arrival or before the jump home, picked for each run', () => {
  const st = MS.tuneOf(MINING);
  assert.deepEqual(st, { id: 'core', kind: 'tune', role: 'engineer', cards: 3, when: ['arrive', 'leave'] });
  assert.equal(st.cards, CARDS, 'as many cards as a jump asks');
  assert.ok(MINING.steps.includes(st), 'listed among the mission\'s steps');
  // a mission that does not list it has none (the exploring, medical and cargo missions get it by listing it)
  assert.equal(MS.tuneOf({ steps: [{ id: 'out', kind: 'leave' }] }), null); assert.equal(MS.tuneOf(null), null);
  // theirs only if they signed as engineer; and with no moment given it is not among the steps of a run
  assert.equal(MS.tuneFor(MINING, ['engineer']), st); assert.equal(MS.tuneFor(MINING, ['pilot', 'drill', 'engineer']), st);
  assert.equal(MS.tuneFor(MINING, ['pilot', 'drill']), null);
  for (const roles of ROLE_MIXES) assert.ok(!MS.stepsFor(MINING, roles).some((s) => s.kind === 'tune'), roles.join());
  // one or the other, picked for each run: both come up, about as often as each other (even chances)
  assert.equal(MS.pickTune(MINING, ['engineer'], () => 0), 'arrive'); assert.equal(MS.pickTune(MINING, ['engineer'], () => 0.49), 'arrive');
  assert.equal(MS.pickTune(MINING, ['engineer'], () => 0.5), 'leave'); assert.equal(MS.pickTune(MINING, ['engineer'], () => 0.9999999), 'leave');
  assert.equal(MS.pickTune(MINING, ['pilot'], () => 0), null, 'not the engineer: no tuning');
  const rand = seeded(7), n = { arrive: 0, leave: 0 };
  for (let k = 0; k < 400; k++) n[MS.pickTune(MINING, ['drill', 'engineer'], rand)]++;
  assert.ok(n.arrive > 150 && n.leave > 150, JSON.stringify(n));
  // kept with the contract as it is signed, and only for an engineer
  assert.equal(MS.sign(crewOf(), 'mining', ['engineer'], 5, () => 0).tune, 'arrive'); assert.equal(MS.sign(crewOf(), 'mining', ['pilot', 'engineer'], 5, () => 0.7).tune, 'leave');
  assert.ok(!('tune' in MS.sign(crewOf(), 'mining', ['pilot', 'drill'], 5, () => 0)));
});

test('the core\'s tuning comes once in a run, out at the rocks: right after the jump out, or right before the jump home', () => {
  // "either right after you arrive at the asteroids, or sometime before you jump back home"
  const plain = ['out', 'jumpOut', 'field', 'jumpHome', 'home'];
  for (const roles of ROLE_MIXES.filter((r) => r.includes('engineer'))) {
    const A = MS.stepsFor(MINING, roles, 'arrive'), L = MS.stepsFor(MINING, roles, 'leave');
    assert.deepEqual(A.map((s) => s.id), ['out', 'jumpOut', 'core', 'field', 'jumpHome', 'home'], roles.join());
    assert.deepEqual(L.map((s) => s.id), ['out', 'jumpOut', 'field', 'core', 'jumpHome', 'home'], roles.join());
    for (const [S, when] of [[A, 'arrive'], [L, 'leave']]) {
      const T = S.filter((s) => s.kind === 'tune');
      assert.equal(T.length, 1, 'once'); assert.equal(T[0].mine, true); assert.equal(T[0].at, when); assert.equal(T[0].cards, CARDS); assert.equal(T[0].role, 'engineer');
      // never while the ship is in its hangar: after the jump out, before the jump home
      const i = S.indexOf(T[0]); assert.ok(i > S.findIndex((s) => s.id === 'jumpOut') && i < S.findIndex((s) => s.id === 'jumpHome'));
      // and every other step is as it is without it
      assert.deepEqual(S.filter((s) => s.kind !== 'tune'), MS.stepsFor(MINING, roles));
    }
  }
  assert.ok(ROLE_MIXES.some((r) => r.includes('engineer') && r.length === 1) && ROLE_MIXES.some((r) => r.length === 3), 'the engineer alone and all three are among the mixes tried');
  // left to the captain's own crew: nothing of it, whatever moment is given
  for (const roles of ROLE_MIXES.filter((r) => !r.includes('engineer'))) for (const when of ['arrive', 'leave']) assert.deepEqual(MS.stepsFor(MINING, roles, when).map((s) => s.id), plain, roles.join());
  ROLES.engineer.ready = false;
  try { assert.deepEqual(MS.stepsFor(MINING, ['pilot', 'engineer'], 'arrive').map((s) => s.id), plain); } finally { ROLES.engineer.ready = true; }
  // a moment the step does not list: left out
  assert.deepEqual(MS.stepsFor(MINING, ['engineer'], 'before').map((s) => s.id), plain); assert.deepEqual(MS.stepsFor(MINING, ['engineer'], null).map((s) => s.id), plain);
  // NOT THE MINING RUN'S ALONE: another mission gets it by listing the step, placed by its own two jumps wherever
  // its data lists it and whatever its work is called
  const SURVEY = { id: 'survey', ship: 'explorer', roles: ['pilot', 'engineer'], steps: [
    { id: 'core', kind: 'tune', role: 'engineer', cards: 2, when: ['arrive', 'leave'] },
    { id: 'away', kind: 'leave' }, { id: 'toSite', kind: 'jump', role: 'pilot', cards: 3, to: 'site' }, { id: 'look', kind: 'work', roles: [] }, { id: 'scan', kind: 'work', roles: [] },
    { id: 'back', kind: 'jump', role: 'pilot', cards: 3, to: 'home' }, { id: 'down', kind: 'land' }] };
  assert.deepEqual(MS.stepsFor(SURVEY, ['engineer'], 'arrive').map((s) => s.id), ['away', 'toSite', 'core', 'look', 'scan', 'back', 'down']);
  assert.deepEqual(MS.stepsFor(SURVEY, ['engineer'], 'leave').map((s) => s.id), ['away', 'toSite', 'look', 'scan', 'core', 'back', 'down']);
  assert.deepEqual(MS.stepsFor(SURVEY, ['pilot'], 'leave').map((s) => s.id), ['away', 'toSite', 'look', 'scan', 'back', 'down']);
  assert.ok(['arrive', 'leave'].includes(MS.pickTune(SURVEY, ['engineer'])));
  // a mission that goes nowhere has nowhere to tune it
  assert.deepEqual(MS.stepsFor({ steps: [{ id: 'core', kind: 'tune', role: 'engineer', when: ['arrive', 'leave'] }, { id: 'hop', kind: 'leave' }] }, ['engineer'], 'arrive').map((s) => s.id), ['hop']);
});

test('the ship\'s own core is its place: found in each parked ship\'s own plan, with room to stand before it', async () => {
  const { readFileSync } = await import('node:fs');
  const plan = (name) => JSON.parse(readFileSync(new URL(`../kit/ships/${name}.blueprint.json`, import.meta.url), 'utf8'));
  // (the three ships parked in the station, as src/boarding.js SHIPS has them: the Miner's is the one in use; the
  // Explorer's and the Medic's are there for their missions to list the step)
  const want = { 'miner-ore-cockpit': ['engineering', 'reactor'], 'explorer-c-row': ['engineering', 'reactor'], 'medic-open-bench': ['eng', 'drive'] };
  for (const [name, [roomId, itemId]] of Object.entries(want)) {
    const bp = plan(name), C = MS.coreIn(bp);
    assert.ok(C, name); assert.equal(C.room, roomId, name); assert.equal(C.item, itemId, name);
    const room = bp.rooms.find((r) => r.id === C.room), it = bp.items.find((i) => i.id === C.item), [x, z] = C.stand;
    assert.equal(room.kind, 'engineering'); assert.match(it.name, /reactor/i, name);
    // where to stand: on the room's clear floor, a step from the reactor and no more than need be, clear of the walls
    // and of everything else that stands on the floor
    const far = (r) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - z, 0, z - r[3]));
    assert.ok(x >= room.rect[0] + MS.CORE.room - 1e-9 && x <= room.rect[2] - MS.CORE.room + 1e-9 && z >= room.rect[1] + MS.CORE.room - 1e-9 && z <= room.rect[3] - MS.CORE.room + 1e-9, `${name}: ${C.stand}`);
    assert.ok(far(it.rect) >= MS.CORE.out - 1e-9 && far(it.rect) <= 1.05, `${name}: ${far(it.rect)} m from it`);
    for (const o of bp.items.filter((i) => i.room === room.id && i.y == null && i !== it)) assert.ok(far(o.rect) >= MS.CORE.room - 1e-9, `${name}: ${far(o.rect)} m from ${o.id}`);
    // where to look: the middle of the reactor, about waist high
    assert.ok(C.look[0] > it.rect[0] && C.look[0] < it.rect[2] && C.look[2] > it.rect[1] && C.look[2] < it.rect[3] && C.look[1] > 0.6 && C.look[1] < 1.2, `${name}: ${C.look}`);
  }
  // the Miner's: in the aisle of its Engineering, the reactor to starboard
  assert.deepEqual(MS.coreIn(plan('miner-ore-cockpit')).stand, [0.25, -5.25]);
  // a ship with no engineering room, or none of its machines: no core, and nothing breaks
  assert.equal(MS.coreIn({ rooms: [{ id: 'mess', kind: 'galley', rect: [0, 0, 2, 2] }], items: [] }), null);
  assert.equal(MS.coreIn({ rooms: [{ id: 'eng', kind: 'engineering', rect: [0, 0, 2, 2] }], items: [] }), null); assert.equal(MS.coreIn(null), null);
});

test('the core\'s tuning: its moment is kept with the contract; nothing in the hangar waits for it and the share is never held', () => {
  const crew = crewOf(), m = MS.sign(crew, 'mining', ['pilot', 'engineer'], 1, () => 0);
  assert.equal(m.tune, 'arrive'); assert.equal(MS.tuneWhen(crew), 'arrive');
  // kept as plain facts with the crew member: the same moment after a reload, so a run flown again has it there again
  assert.equal(MS.tuneWhen(JSON.parse(JSON.stringify(crew))), 'arrive');
  assert.deepEqual(Object.keys(m).sort(), ['captain', 'id', 'roles', 'signed', 'state', 'tune'], 'nothing else is kept of it');
  // home: the share is there to be collected at once, whatever became of the tuning
  const P = MS.land(crew, { n: 31, store: { iron: 4, nickel: 2, titanium: 2 } });
  assert.equal(MS.tuneWhen(crew), null, 'the run is flown'); assert.equal(P.share, 30); assert.equal(P.pay, 7800);
  assert.deepEqual(MS.collect(crew), { pay: 7800, credits: 7800 }); assert.equal(MS.contractOf(crew), null);
  const late = crewOf(); assert.equal(MS.sign(late, 'mining', ['engineer'], 1, () => 0.9).tune, 'leave'); assert.equal(MS.tuneWhen(late), 'leave');
  // no card of the tuning changes the pay: it is what the haul sells for times the share, as ever
  const Q = MS.land(late, { n: 32, store: { copper: 8 } });
  assert.equal(Q.sold, 32000); assert.equal(Q.share, 20); assert.equal(Q.pay, 6400);
  assert.deepEqual(MS.collect(late), { pay: 6400, credits: 6400 });
  // nobody's contract, or not the engineer: there is no tuning
  assert.equal(MS.tuneWhen(crewOf()), null); assert.equal(MS.tuneWhen(null), null);
  const other = crewOf(); MS.sign(other, 'mining', ['pilot', 'drill'], 1, () => 0); assert.equal(MS.tuneWhen(other), null);
  // the two rules of the old placing are gone: nothing says a tuning is "due" at the station
  assert.ok(!('tuneDue' in MS) && !('tuned' in MS));
});

test('the core\'s tuning: contracts kept from when it was done in the hangar still play', () => {
  const kept = (more) => ({ ...crewOf(), mission: { id: 'mining', captain: 'ruiz', roles: ['pilot', 'engineer'], state: 'signed', signed: 1, ...more } });
  // 'before' the run is now on arrival at the rocks, 'after' it is now before the jump home
  assert.equal(MS.tuneWhen(kept({ tune: 'before' })), 'arrive'); assert.equal(MS.tuneWhen(kept({ tune: 'after' })), 'leave');
  // its core already tuned in the hangar, the run not flown yet: no second tuning
  assert.equal(MS.tuneWhen(kept({ tune: 'before', tuned: true })), null);
  // a moment this build does not know, or none kept: the first of the step's own
  assert.equal(MS.tuneWhen(kept({ tune: 'sometime' })), 'arrive'); assert.equal(MS.tuneWhen(kept({})), 'arrive');
  // each of them gives a run its steps, the tuning once or not at all
  for (const more of [{ tune: 'before' }, { tune: 'after' }, { tune: 'before', tuned: true }, {}]) {
    const c = kept(more), S = MS.stepsFor(MINING, c.mission.roles, MS.tuneWhen(c));
    assert.equal(S.filter((s) => s.kind === 'tune').length, more.tuned ? 0 : 1, JSON.stringify(more));
    assert.deepEqual(S.filter((s) => s.kind !== 'tune').map((s) => s.id), ['out', 'jumpOut', 'field', 'jumpHome', 'home']);
  }
  // home already with the share waiting and the tuning never done (it was held for it then): the share is paid now
  const home = kept({ tune: 'after' }); const P = MS.land(home, { n: 33, store: { gold: 8 } });
  assert.equal(MS.tuneWhen(home), null); assert.deepEqual(MS.collect(JSON.parse(JSON.stringify(home))), { pay: P.pay, credits: P.pay }); assert.ok(P.pay > 0);
});

test('the core\'s tuning: the ship\'s own words for it, and the captain\'s', async () => {
  const { SHIP_CLIPS, clipUrl } = await import('../src/voices.js'), { RUN_TALK } = await import('../src/lines.js'), { existsSync } = await import('node:fs'), { fileURLToPath } = await import('node:url');
  // "a "Reactor imbalance" voice for when you need to do the engineering questions": the Miner's own clip, in the game
  const c = SHIP_CLIPS[MINING.ship].reactor;
  assert.equal(c.words, 'Reactor imbalance.'); assert.ok(existsSync(fileURLToPath(clipUrl(c.id))), c.id);
  for (const k of Object.values(SHIP_CLIPS[MINING.ship])) assert.ok(existsSync(fileURLToPath(clipUrl(k.id))), k.id);
  // "the captain tells you the core needs to be adjusted. So you go back to mechanical"; and a word when it is done
  const T = RUN_TALK[MINING.id];
  for (const key of ['tune', 'tuned']) { assert.ok(Array.isArray(T[key]) && T[key].length, key); for (const w of T[key]) assert.ok(w.length <= 90, w); }
  for (const w of T.tune) { assert.match(w, /core needs adjusting/); assert.match(w, /Engineering/); }
  // "Then you make your way back up to the pilot seat": tuned, he asks them back to their seat; nothing of the
  // hangar or the smelter is in either line
  for (const w of T.tuned) assert.match(w, /seat/);
  for (const w of [...T.tune, ...T.tuned]) assert.doesNotMatch(w, /smelter|hangar|cockpit first/i);
  assert.ok(!('tunedBefore' in T) && !('tunedAfter' in T));
  // the captain's word at the rocks, drilling himself while the crew member is the engineer, names the run's engineer;
  // the one of his crew who drills is named as whoever that is
  assert.ok(T.fieldMine.some((w) => /\{engineer\}/.test(w))); assert.ok(!Object.values(T).flat().some((w) => /Okafor|Kestrel/.test(w)));
  for (const k of ['field', 'fieldFly']) assert.ok(T[k].every((w) => /\{driller\}/.test(w)), k);
});

// ── the trip's steps ─────────────────────────────────────────────────────────────────────────────────────────────
test('the mission\'s steps: out, the jump, the field, the jump home, home; a pilot does the two jumps', () => {
  assert.deepEqual(MINING.steps.filter((s) => s.kind !== 'tune').map((s) => [s.id, s.kind]), [['out', 'leave'], ['jumpOut', 'jump'], ['field', 'work'], ['jumpHome', 'jump'], ['home', 'land']]);
  const S = MS.stepsFor(MINING, ['pilot']);
  assert.deepEqual(S.map((s) => s.id), ['out', 'jumpOut', 'field', 'jumpHome', 'home']);
  assert.deepEqual(S.filter((s) => s.mine).map((s) => s.id), ['jumpOut', 'jumpHome']);
  // "calculate a jump (with maybe 3 questions)": three cards a jump, one for each lamp
  for (const s of S.filter((x) => x.kind === 'jump')) assert.equal(s.cards, 3);
  assert.equal(CARDS, 3); assert.equal(MS.LAMPS.length, CARDS);
  assert.deepEqual(S.filter((s) => s.kind === 'jump').map((s) => s.to), ['field', 'home']);
  // no jump counts toward the haul; the crew's own drilling is a short scene (15 to 25 seconds)
  assert.ok(!S.find((s) => s.id === 'jumpOut').counts && !S.find((s) => s.id === 'jumpHome').counts);
  const work = S.find((s) => s.kind === 'work'); assert.ok(work.secs >= 15 && work.secs <= 25, String(work.secs));
  // the parts of a pilot-only run that are not cards come to well under a minute, so the run is about two minutes
  const fixed = S.reduce((t, s) => t + (s.secs || 0), 0);
  assert.ok(fixed >= 20 && fixed <= 45, String(fixed));
});

// ── the haul and the money ───────────────────────────────────────────────────────────────────────────────────────
// (three loads to try: the game's maker's own example, a load of one metal, and one of odd amounts)
// (three loads of the Miner's eight canisters: the game's maker's own example, 50% iron, 25% nickel, 25% titanium;
// one metal; and a mixed one that headed home early, its part-full canisters rounded to eighths: 7 1/2 tonnes in all)
const LOADS3 = [{ iron: 4, nickel: 2, titanium: 2 }, { copper: 8 }, { iron: 2.625, nickel: 1.25, cobalt: 1.5, gold: 0.75, copper: 1.375 }], TONNES3 = [8, 8, 7.5];
const ROLE_MIXES = [['pilot'], ['drill'], ['engineer'], ['pilot', 'drill'], ['pilot', 'engineer'], ['drill', 'engineer'], ['pilot', 'drill', 'engineer']];

test('one price list: the game\'s maker\'s chart, every price the same number of times it', () => {
  assert.deepEqual(CHART, { iron: 20, nickel: 30, copper: 40, cobalt: 50, titanium: 60, gold: 80 });
  assert.deepEqual(METALS.map((m) => m.name), Object.keys(CHART));
  // the proportions are his, exactly: one number multiplies them all
  for (const m of METALS) { assert.equal(m.price, CHART[m.name] * PRICE_TIMES); assert.equal(m.price / METALS[0].price, CHART[m.name] / CHART.iron); assert.equal(priceOf(m.name), m.price); }
  assert.ok(Number.isInteger(PRICE_TIMES) && PRICE_TIMES > 0); assert.equal(priceOf('cheese'), 0);
  // a hundredth of a tonne of any metal sells for whole credits, and so does an eighth of a tonne (a load headed home
  // early), so the plain sum never has a part of a credit in it
  for (const m of METALS) assert.ok(Number.isInteger(m.price / 100) && Number.isInteger(m.price / 8), m.name);
  // there is no other list: nothing else in the smelter's file or the missions' prices anything
  for (const gone of ['ORE_PRICE', 'ORE_SELLS', 'RICH_METAL']) assert.ok(!(gone in (smelterAll)), gone);
  // one canister holds one tonne, so the list is a canister's price too; the canister of 3/4 of a tonne is gone
  assert.equal(CAN_TONNES, 1); for (const gone of ['CAN_HOLDS', 'LOADS']) assert.ok(!(gone in (smelterAll)), gone);
});

test('the pay is the plain sum: each metal\'s tonnes times what a tonne of it sells for, added up; and each mix of jobs its share of that', () => {
  assert.equal(HOLD, 8);
  const want = [26000, 32000, 28000];
  LOADS3.forEach((store, i) => {
    const S = sellsFor(store), plain = Object.entries(store).reduce((a, [m, t]) => a + t * CHART[m] * PRICE_TIMES, 0);
    assert.ok(near(S.pay, plain)); assert.equal(S.pay, want[i]); assert.equal(S.tonnes, TONNES3[i]);
    assert.deepEqual(S.lots.map((L) => [L.metal.name, L.tonnes, L.price, L.pay]).sort(), Object.entries(store).map(([m, t]) => [m, t, priceOf(m), Math.round(t * priceOf(m))]).sort());
    for (let k = 1; k < S.lots.length; k++) assert.ok(S.lots[k].tonnes <= S.lots[k - 1].tonnes, 'the most tonnes first');
    for (const roles of ROLE_MIXES) {
      const F = MS.forecast({ store, roles }), share = MS.shareOf(roles);
      assert.equal(F.sold, plain); assert.equal(F.share, share); assert.equal(F.pay, plain * share / 100); assert.ok(Number.isInteger(F.pay));
    }
    // the shares add up: the three jobs together are half the haul
    assert.equal(MINING.roles.reduce((a, id) => a + MS.forecast({ store, roles: [id] }).pay, 0), MS.forecast({ store, roles: MINING.roles }).pay);
    assert.equal(MS.forecast({ store, roles: MINING.roles }).pay, plain / 2);
  });
  // what the three loads pay each mix of jobs (the notes' table)
  assert.deepEqual(ROLE_MIXES.map((r) => MS.forecast({ store: LOADS3[0], roles: r }).pay), [2600, 5200, 5200, 7800, 7800, 10400, 13000]);
  // an empty store sells for nothing; a metal the smelter does not pour is not in it
  assert.equal(sellsFor({}).pay, 0); assert.deepEqual(sellsFor({ cheese: 2, iron: 1 }).lots.map((L) => L.metal.name), ['iron']);
});

test('the money as it is now: an ordinary mixed load of eight tonnes sells for 24,000 to 27,500, about 2,600 for the pilot, 12,000 to 13,750 for all three jobs', () => {
  // The prices are the game's maker's own and are not changed here. His sums (2026-11-17) were for a load of six
  // tonnes: about 17,000 to 20,000, the pilot's tenth about 2,000, all three jobs 8,500 to 10,000. A canister holds a
  // whole tonne now, so the same rocks at the same prices fill a store a third bigger and a load sells for about a
  // third more. Whether the prices should come down for it is his to say (src/jobs/smelter.js PRICE_TIMES: "If they
  // make too much money then reduce the sell price"; 2026-11-18: "I need to play test the game to really give you
  // good feedback"). One metal to a canister changes what an ordinary load sells for very little: 25,800 before,
  // 25,600 now.
  // (an ordinary load: what the captain's own driller brings home, working the nearest rocks of many fields until all
  // eight canisters are full)
  let sum = 0; const N = 300;
  for (let s = 1; s <= N; s++) sum += sellsFor(crewLoad(seed(s)).store).pay;
  const sold = sum / N;
  assert.ok(sold >= 24000 && sold <= 27500, `an ordinary load sells for ${Math.round(sold)}`);
  assert.ok(Math.abs(sold * 0.1 - 2600) < 300, `the pilot's tenth: ${Math.round(sold * 0.1)}`);
  assert.ok(sold * 0.2 >= 4800 && sold * 0.2 <= 5500, `the drill's fifth: ${Math.round(sold * 0.2)}`);
  assert.ok(sold * 0.5 >= 12000 && sold * 0.5 <= 13750, `all three jobs: ${Math.round(sold * 0.5)}`);
});

test('no answer changes the haul: what comes home is the store, whatever the lamps showed and whatever was answered', () => {
  // nothing in a mission's steps counts answers; the missions keep no rule of lamps, clean jumps or rich rocks
  for (const s of MINING.steps) assert.ok(!('counts' in s), s.id);
  for (const gone of ['RICH', 'isRich', 'ORE_BY_CLEAN', 'oreFor', 'CREW_CLEAN', 'forecastLoad']) assert.ok(!(gone in MS), gone);
  // the same store lands the same payout, whatever else is said of the run
  const store = LOADS3[2], pays = [];
  for (const extra of [{}, { clean: 0 }, { clean: 3 }, { rich: true }, { lamps: ['late', 'late', 'late'] }, { first: false }]) {
    const crew = crewOf(); MS.sign(crew, 'mining', ['pilot', 'drill']); flownHaul(9, null);
    const P = MS.land(crew, { n: 9, store, now: 5, ...extra }); pays.push(JSON.stringify(P));
    assert.deepEqual(Object.keys(P).sort(), ['at', 'canisters', 'lots', 'n', 'pay', 'share', 'sold', 'tonnes']);
    assert.equal(P.sold, 28000); assert.equal(P.pay, 8400);
  }
  assert.equal(new Set(pays).size, 1); flownHaul(9, null);
});

test('a haul the player went out for is one haul on every slip: its store in the eight canisters, what it sells for, and the smelter\'s slip telling the same amounts', () => {
  const rand = seeded(5), M = smelter.makers;
  const live = (round) => ({ round, canisters: CARRIES, phase: 'unload', onShip: 5, fullOnShip: 5, docked: [{ socket: 0, percent: 0 }, { socket: 1, percent: 30 }, { socket: 2, percent: 90 }], drained: 1, onRack: 8, carried: 0,
    steady: { onShip: 60, fullOnShip: 60, docked: 60, drained: 60, onRack: 60 } });
  for (let n = 1; n <= 40; n++) LOADS3.forEach((store, i) => {
    forget(); flownHaul(n, null);
    assert.equal(haulOf(n).flown, false);
    const crew = crewOf(); MS.sign(crew, 'mining', ['pilot']);
    const P = MS.land(crew, { n, store, now: 5 }), H = haulOf(n), S = sellsFor(store);
    assert.equal(H.flown, true); assert.equal(H.n, n); assert.equal(H.canisters, CARRIES); assert.deepEqual(H.store, store);
    // a tonne to a canister, one metal to each: eight tonnes with all eight full, less headed home early; nothing of it
    // is anything but metal, and all of it is sold
    assert.equal(H.tonnes, TONNES3[i]); assert.ok(H.tonnes <= H.canisters * CAN_TONNES); assert.equal(H.pay, S.pay); assert.deepEqual(H.lots, S.lots);
    assert.deepEqual(Object.keys(H).sort(), ['canisters', 'flown', 'lots', 'n', 'pay', 'store', 'tonnes']);
    // the payout is that haul's: what it sold for, the pilot's tenth
    assert.deepEqual(P, { n, canisters: CARRIES, tonnes: TONNES3[i], lots: S.lots.map((L) => ({ metal: L.metal.name, tonnes: L.tonnes, price: L.price, pay: L.pay })), sold: S.pay, share: 10, pay: S.pay / 10, at: 5 });
    assert.deepEqual([P.sold, P.share, P.pay], [MS.forecast({ store }).sold, 10, MS.forecast({ store }).pay]);
    if (n % 7) { flownHaul(n, null); return; }
    // ... and the smelter's own slip about that haul says the same: its amounts as they came home (whole tonnes; home
    // early, eighths of a tonne as fractions), each at its price on the chart, added up: the payout's own total
    const pay = M.pay.make(2, { rand, live: live(n) });
    assert.equal(pay.facts.from, 'Your crew\'s haul'); assert.equal(pay.facts.mine, true); assert.equal(rightOf(pay), P.sold, pay.story);
    assert.deepEqual(Object.fromEntries(pay.facts.load.parts.map((x) => [x.metal, x.amt])), store);
    assert.ok(!/about/i.test(`${pay.story} ${pay.ask} ${pay.rightWhy}`), pay.story); assert.ok(!('about' in pay.facts) && !('sold' in pay.facts));
    assert.ok(/Your crew came home with/.test(pay.story) && !/canister|\d\.\d/.test(pay.story), pay.story);
    assert.equal(pay.story, `Your crew came home with ${lotsWords(pay.facts.load.parts.map((x) => ({ metal: x.metal, tonnes: x.amt })))}.`);
    flownHaul(n, null);
  });
  forget();
  // eighths are said as fractions, never as 0.125; hundredths (a payout kept from before) stay decimals
  assert.equal(lotsWords(sellsFor(LOADS3[2]).lots), '2 5/8 tonnes of iron, 1 1/2 tonnes of cobalt, 1 3/8 tonnes of copper, 1 1/4 tonnes of nickel and 3/4 of a tonne of gold');
  assert.equal(lotsWords(sellsFor(LOADS3[0]).lots), '4 tonnes of iron, 2 tonnes of titanium and 2 tonnes of nickel'); assert.equal(lotsWords([{ metal: 'gold', tonnes: 0.125 }]), '1/8 of a tonne of gold');
  assert.equal(lotsWords([{ metal: 'iron', tonnes: 4.67 }, { metal: 'gold', tonnes: 0.5 }]), '4.67 tonnes of iron and 0.5 of a tonne of gold');
  assert.deepEqual([0.125, 0.5, 1, 2.875, 8].map(eighthsText), ['1/8', '1/2', '1', '2 7/8', '8']); assert.equal(tonnesWords(0.75), '0.75 of a tonne'); assert.equal(tonnesWords(0.75, true), '3/4 of a tonne');
  assert.equal(sellsFor({ nickel: 0.125 }).pay, 375); assert.equal(sellsFor({ nickel: 0.125 }).tonnes, 0.125);
  // a haul nobody the player knows flew is one of the Miner's own: whole canisters of each metal, in quarters of the load
  assert.equal(flownHaul(3), null); assert.equal(haulOf(3).flown, false); assert.equal(haulOf(3).tonnes, 8);
  for (let n = 0; n < 24; n++) { const H = haulOf(n); assert.equal(H.tonnes, 8); for (const L of H.lots) assert.ok(Number.isInteger(L.tonnes) && L.tonnes % 2 === 0, `haul ${n}: ${L.tonnes} canisters of ${L.metal.name}`); }
  assert.throws(() => flownHaul(3, { store: {} }), /its store/); assert.throws(() => flownHaul(3, { ore: [3, 4] }), /its store/);
});

test('a half credit: a haul headed home early can sell for an odd 125 credits; the pay is to the nearest whole credit, and the card says so and asks what the haul sold for', () => {
  // 1/8 of a tonne of nickel sells for 375 credits: a tenth of that is not a whole credit
  const rand = seeded(3), store = { iron: 3, nickel: 1.125, gold: 0.5 }, sold = 6000 + 3375 + 4000;
  for (const [roles, pay] of [[['pilot'], 1338], [['drill'], 2675], [['pilot', 'drill'], 4013]]) {
    const crew = crewOf(); flownHaul(8, null); crew.mission = { id: 'mining', captain: 'ruiz', roles, state: 'signed', signed: 1 };
    const P = MS.land(crew, { n: 8, store }), even = Number.isInteger(sold * P.share / 100);
    assert.equal(P.sold, sold); assert.equal(P.pay, pay); assert.equal(P.pay, Math.round(sold * P.share / 100)); assert.equal(even, roles.length === 1 && roles[0] === 'drill');
    for (const grade of [0, 10, 30, 50, 70]) {
      const o = MS.payoutOrder(crew.mission, grade, rand), text = `${o.story} ${o.rightWhy}`;
      assert.equal(o.payout, pay); assert.equal(o.coins.filter((c) => c.good).length, 1);
      // a share that comes out whole is asked as at any level; one that does not is never asked for: the card asks
      // what the haul sold for, and says the pay is to the nearest credit
      if (even) { assert.equal(o.form, MS.payoutForm(grade)); assert.ok(!/nearest credit/.test(text), text); continue; }
      assert.equal(o.form, grade < 20 ? 'count' : 'add'); assert.equal(rightOf(o), grade < 20 ? (grade < 6 ? 4 : 8) : sold, o.ask);
      assert.ok(text.includes(`${pay.toLocaleString('en-US')} credits, to the nearest credit`), text);
    }
    assert.deepEqual(MS.collect(crew), { pay, credits: pay });
  }
  flownHaul(8, null);
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
  const P = MS.land(back, { n: 4, store: { gold: 3, iron: 3 }, now: 999 });
  assert.equal(MS.contractOf(back).state, 'payout'); assert.equal(P.sold, 30000); assert.equal(P.pay, 3000);
  assert.equal(E.credits(back), 450, 'not paid until it is collected');
  back = reload(back);
  assert.deepEqual(MS.contractOf(back).payout, P);
  assert.equal(MS.land(back, { n: 5 }), null, 'one run, one payout');
  assert.equal(MS.sign(back, 'mining', ['pilot']), null, 'no new contract while a share waits');
  // collected: the credits arrive as a job's pay does, in whole credits; the mission is done
  assert.deepEqual(MS.collect(back), { pay: 3000, credits: 3450 });
  assert.equal(E.credits(back), 3450); assert.equal(back.jobs.mining.earned, 3000); assert.equal(back.jobs.mining.n, 1);
  assert.equal(back.mission, undefined); assert.equal(MS.contractOf(back), null); assert.equal(MS.collect(back), null);
  assert.ok(MS.sign(back, 'mining', ['pilot']), 'and the captain can be signed with again');
  // something kept that this build does not know is left alone, not taken for a contract
  for (const bad of [{ id: 'salvage', roles: ['pilot'], state: 'signed' }, { id: 'mining', roles: [], state: 'signed' }, { id: 'mining', roles: ['pilot'], state: 'payout' }, 'mining', null]) assert.equal(MS.contractOf({ mission: bad }), null, JSON.stringify(bad));
  flownHaul(4, null);
});

test('the captain\'s offer for a crew member: new, asked, then by their contract', () => {
  const crew = crewOf(), cap = { id: 'ruiz', name: 'Captain Ruiz', ship: 'Miner', mission: 'mining' };
  const heard = [];
  missions.on((c, yes) => heard.push([c.id, yes]));
  // (no "shall we go now": a contract signed, the captain walks to the ship and the run starts from its seat)
  assert.equal(missions.go, undefined); assert.equal(missions.onGo, undefined);
  missions.asked('ruiz'); assert.equal(missions.state('ruiz', crew), 'asked');
  missions.answer(cap, true); assert.equal(missions.state('ruiz', crew), 'interested'); assert.deepEqual(heard, [['ruiz', true]]);
  // the card put away unsigned: the offer stays open
  missions.declined('ruiz'); assert.equal(missions.state('ruiz', crew), 'declined'); assert.equal(MS.contractOf(crew), null);
  MS.sign(crew, 'mining', ['pilot']); assert.equal(missions.state('ruiz', crew), 'signed');
  assert.equal(missions.state('vega', crew), 'new', 'another captain is not this contract\'s');
  flownHaul(2, null); MS.land(crew, { n: 2, store: { iron: 6 } }); assert.equal(missions.state('ruiz', crew), 'payout');
  MS.collect(crew); assert.equal(missions.state('ruiz', crew), 'declined', 'collected: this visit\'s answer again, and he asks afresh');
  assert.equal(missions.state('ruiz', crewOf()), 'declined'); assert.equal(missions.state('hale'), 'new');
  flownHaul(2, null);
});

// ── the payout card ──────────────────────────────────────────────────────────────────────────────────────────────
test('the payout card shows the plain sum (each metal, its tonnes, its price, the total, the share) and asks a question of this haul for every level; the same pay with each', () => {
  const rand = seeded(9);
  assert.deepEqual([0, 5, 6, 19, 20, 43, 44, 57, 58, 80].map(MS.payoutForm), ['count', 'count', 'count', 'count', 'add', 'add', 'part', 'part', 'percent', 'percent']);
  const haulFor = (roles, store, n) => { const crew = crewOf(); flownHaul(n, null); crew.mission = { id: 'mining', captain: 'ruiz', roles, state: 'signed', signed: 1 }; MS.land(crew, { n, store }); return crew; };
  const sayN = (n) => n.toLocaleString('en-US');
  for (const roles of [['pilot'], ['drill'], ['pilot', 'drill'], ['drill', 'engineer'], ['pilot', 'drill', 'engineer']]) for (const store of LOADS3) {
    const crew = haulFor(roles, store, 6), P = crew.mission.payout;
    assert.equal(P.pay, P.sold * MS.shareOf(roles) / 100);
    for (const grade of [0, 6, 16, 20, 30, 44, 50, 58, 76]) {
      const o = MS.payoutOrder(crew.mission, grade, rand), form = MS.payoutForm(grade), why = `${roles} ${JSON.stringify(store)} at ${grade}`;
      assert.equal(o.form, form); assert.equal(o.payout, P.pay, why);
      assert.equal(o.coins.filter((c) => c.good).length, 1, why); assert.ok(o.coins.length >= 3, why);
      assert.equal(new Set(o.coins.map((c) => c.label)).size, o.coins.length, why);
      for (const c of o.coins) { assert.ok(/^[\d,]+$/.test(c.big), `${why}: ${c.big}`); if (!c.good) assert.ok(c.why && c.why.length > 15 && num(c.label) !== rightOf(o), `${why}: ${c.label}`); }
      const text = `${o.story} ${o.ask} ${o.coins.map((c) => `${c.label} ${c.why}`).join(' ')} ${o.rightWhy} ${(o.lines || []).flat().join(' ')} ${o.help.line} ${(o.help.steps || []).join(' ')}`;
      assert.ok(!/NaN|undefined|Infinity|\[object|rich|double|clean/i.test(text), text);
      // THE SLIP: a row for each metal (its tonnes × its price = what it sold for), then the total, the share, the pay
      const rows = o.lines, lots = P.lots;
      assert.equal(rows.length, lots.length + 3, why);
      lots.forEach((L, i) => { assert.equal(rows[i][0].toLowerCase(), L.metal); assert.ok(rows[i][1].includes(`× ${sayN(L.price)} = ${sayN(L.pay)}`) && rows[i][1].startsWith(`${eighthsText(L.tonnes)} tonne`) && !/\d\.\d/.test(rows[i][1]), `${why}: ${rows[i]}`); });
      assert.equal(rows[lots.length][0], 'Sold for'); assert.equal(rows[lots.length + 1][0], 'Your share'); assert.ok(rows[lots.length + 1][1].includes(form === 'part' ? '/' : `${P.share}%`)); assert.equal(rows[lots.length + 2][0], 'Your pay');
      // (the number asked for is a "?" on the slip; every other one is written out)
      assert.equal(rows[lots.length][1], form === 'add' ? '?' : `${sayN(P.sold)} credits`); assert.equal(rows[lots.length + 2][1], form === 'count' ? `${sayN(P.pay)} credits` : '?');
      // the right answer: the canisters (the four on one side for the youngest), what it sold for, or the pay itself
      const want = form === 'count' ? (grade < 6 ? 4 : 8) : form === 'add' ? P.sold : P.pay;
      assert.equal(rightOf(o), want, `${why}: ${o.story} ${o.ask}`);
      // the card always says what the share comes to, or asks for it: the pay is never a surprise
      assert.ok(form === 'part' || form === 'percent' || `${o.story} ${o.rightWhy}`.includes(`${sayN(P.pay)} credits`), why);
      assert.equal(o.facts.from, 'Your share');
      // Help: one click away, with its line; a picture where one helps (the youngest count theirs on the card)
      const pic = helpPicture(o);
      assert.ok(o.help.line.length > 20 && !/NaN|undefined/.test(pic.svg), why);
      // (the canisters drawn as they came home: all lit with all eight full; home early, the empty ones dark, and
      // the card does not say they are full)
      if (form === 'count') {
        assert.equal(o.picFirst, true); assert.equal(o.help.pic.slots.length, want); assert.ok(pic.svg.startsWith('<svg'));
        const lit = lots.reduce((a, L) => a + Math.ceil(L.tonnes), 0);
        assert.deepEqual(o.help.pic.slots, [...Array(Math.min(want, lit)).fill('full'), ...Array(Math.max(0, want - lit)).fill('empty')], why);
        assert.equal(/with its canisters full/.test(o.story), P.tonnes === 8, o.story);
        continue;
      }
      if (form !== 'add' || lots.length === 1) assert.ok(pic.svg.includes('?'), why);
      const chain = o.sum.chain || [o.sum];
      for (const x of chain) assert.doesNotThrow(() => workOf(x), JSON.stringify(x));
      chain.slice(1).forEach((x) => assert.ok(x.carried, `${why}: ${JSON.stringify(chain)}`));
      assert.ok(near(endOf(chain[chain.length - 1]), want), `${why}: ends on ${endOf(chain[chain.length - 1])}`);
    }
    flownHaul(6, null);
  }
  // a payout kept from before a haul was a store of several metals (a crew member who had not collected yet) still makes a card, and pays
  const old = { id: 'mining', captain: 'ruiz', roles: ['pilot'], state: 'payout', payout: { n: 2, canisters: 8, ore: [3, 4], oreTonnes: 6, metal: 'copper', price: 15000, yield: 20, rich: false, clean: 2, sold: 18000, share: 10, pay: 1800, at: 1 } };
  for (const grade of [0, 30, 50, 70]) { const o = MS.payoutOrder(old, grade, rand); assert.equal(o.payout, 1800); assert.equal(o.coins.filter((c) => c.good).length, 1); assert.ok(!/NaN|undefined/.test(JSON.stringify(o))); }
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
      // (a card answered by a tap on its map: "another spot" gets its line when it is tapped)
      for (const c of o.coins.filter((x) => !x.good && !(o.tap && x.v === 'else'))) assert.ok(c.why && c.why.length > 12, `${L.id}: ${c.label} has no line why`);
      // an answer is a number with its unit, a yes or no, a point, a heading, or a picture (a diagram with its equation)
      for (const c of o.coins) assert.ok(c.svg ? c.svg.startsWith('<svg') && !/NaN|undefined/.test(c.svg) : (o.tap && c.v === 'else') || /^([\d,]+(\.\d{1,2})?°?|Yes|No|\(-?\d, -?\d\))$/.test(c.big), `${L.id}: ${c.big}`);
      if (o.lead) assert.ok(o.lead.startsWith('<svg') && o.lead.includes('?') && !/NaN|undefined/.test(o.lead), `${L.id}/${o.key}: its map`);
      // Help: a picture for this card
      const pic = helpPicture(o, { dark: true });
      assert.ok(pic.svg.startsWith('<svg') && !/NaN|undefined/.test(pic.svg), `${L.id}/${o.key}: no picture`);
      // EVERY PICTURE IS DARK, with light lines: the card's own map, an answer's diagram, and Help's (one of this
      // game's own: none of the pale card's colours; one of Mathwood's own: handed to the panel to turn dark)
      for (const s of [o.lead || '', ...o.coins.map((c) => c.svg || ''), pic.flip ? '' : pic.svg]) for (const pale of [PALE.CARD, PALE.INK, PALE.FILL, PALE.FILL2, 'fill="#fff"']) assert.ok(!s.includes(pale), `${L.id}/${o.key}: a pale colour, ${pale}`);
      assert.ok(pic.flip || pic.dark, `${L.id}/${o.key}`);
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
      if (step === 1) assert.ok(f.x >= 1 && f.x <= 6 && f.y >= 1 && f.y <= 6 && f.x !== f.y); else assert.ok(Math.abs(f.x) <= 7 && Math.abs(f.y) <= 7 && f.x * f.y !== 0 && (f.x < 0 || f.y < 0), P);
      assert.ok(good(o).label.endsWith(P), `${o.story}: ${good(o).label}`);
      if (f.form === 'tap') {
        // plotted by a tap on one map, the planet in the middle: the card says the point, the map does not
        assert.ok(o.story.includes(P)); assert.equal(o.ask, 'Tap that spot on the map.'); assert.deepEqual(o.tap.at, [f.x, f.y]); assert.equal(o.tap.map.quad, 4); assert.ok(o.tap.map.hi >= 7); assert.equal(typeof o.tap.judge, 'function');
        assert.ok(o.coins.every((c) => !c.svg), 'no small maps to pick from'); assert.ok(o.coins.some((c) => c.label.endsWith(`(${f.y}, ${f.x})`)), 'across and up swapped is one of the known slips'); assert.ok(o.coins.some((c) => c.v === 'else'));
        assert.ok(!navMap({ ...o.tap.map, dark: true }).includes(`>${P}<`));
      } else { assert.equal(o.coins.length, 4, o.story); assert.ok(o.lead && !o.story.includes(P)); assert.ok(!o.lead.includes(P), 'the map does not write the answer'); }
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

test('the map\'s tap: the right spot is right, a tap a little off the lines is still that crossing, any other spot is wrong and says why', () => {
  const M = pilot.makers, rand = seeded(33);
  let taps = 0;
  for (let k = 0; k < 400; k++) for (const step of [1, 2]) {
    const o = M.plot.make(step, { rand }); if (!o.tap) continue; taps++;
    const [x, y] = o.tap.at, hi = o.tap.map.hi, said = (p) => `(${p[0]}, ${p[1]})`, coin = (J) => o.coins[J.i];
    // the right spot, dead on, and anywhere nearer to it than to the next crossing: right
    for (const [dx, dy] of [[0, 0], [0.45, 0], [-0.45, 0.45], [0.3, -0.49], [-0.49, -0.49]]) { const J = plotJudge(o, x + dx, y + dy); assert.deepEqual(J.at, [x, y]); assert.equal(J.right, true, `${said([x, y])} tapped at ${x + dx}, ${y + dy}`); assert.equal(coin(J).good, true); }
    // a tap nearer the next crossing is that crossing: wrong, and the line says where it fell and how to count
    for (const [dx, dy] of [[0.55, 0], [0, -0.55], [1, 1], [-0.6, 0.6]]) {
      const J = plotJudge(o, x + dx, y + dy), at = [Math.round(x + dx), Math.round(y + dy)];
      if (Math.abs(at[0]) > hi || Math.abs(at[1]) > hi) continue;
      assert.deepEqual(J.at, at); assert.equal(J.right, false); assert.ok(coin(J).why.includes(said(at)), coin(J).why); assert.ok(coin(J).why.length > 30);
    }
    // the slips children make, each with its own line: across and up swapped, a sign lost
    const sw = plotJudge(o, y, x); assert.equal(sw.right, false); assert.match(coin(sw).why, /first number is how far across/);
    if (step === 2) { const s1 = plotJudge(o, -x, y); assert.equal(s1.right, false); assert.match(coin(s1).why, /minus|first number/); assert.equal(plotJudge(o, -x, -y).right, false); }
    // the planet itself, a far corner, a tap off the map's edge (it counts as the edge): wrong
    for (const [gx, gy] of [[0, 0], [hi, -hi], [hi + 3, y]]) { const J = plotJudge(o, gx, gy); assert.equal(J.right, false); assert.ok(coin(J).why.length > 30); assert.ok(Math.abs(J.at[0]) <= hi && Math.abs(J.at[1]) <= hi); }
    // every crossing of the map is judged, and only one of them is right
    let rights = 0; for (let gx = -hi; gx <= hi; gx++) for (let gy = -hi; gy <= hi; gy++) if (plotJudge(o, gx, gy).right) rights++;
    assert.equal(rights, 1);
    // where a tap on the picture falls on the map: the picture's own frame (the panel hands the judge these)
    const S = o.tap.map.size, pad = 16, u = (S - 2 * pad) / (2 * hi), g = mapSpot(o.tap.map, (pad + (x + hi) * u) / S, (S - pad - (y + hi) * u) / S);
    assert.ok(near(g[0], x) && near(g[1], y), `${g} for ${said([x, y])}`);
    // the map is dark, with light lines, the planet in the middle; the level with no minus numbers lights one quarter
    const map = navMap({ ...o.tap.map, dark: true, marks: [{ x, y, kind: 'field' }, { x: y, y: x, kind: 'miss' }, { x: 1, y: 1, kind: 'aim' }] });
    assert.ok(map.includes(NIGHT.CARD) && map.includes(NIGHT.INK) && !map.includes(PALE.CARD) && !map.includes(PALE.INK)); assert.equal(o.tap.map.lit, step === 1 ? 1 : 0);
    assert.ok(step === 2 ? map.includes('>-6<') : !map.includes('>-2<'), 'minus numbers only on the whole map');
  }
  assert.ok(taps > 150, String(taps));
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

// ── on their feet aboard while it flies (src/trip.js) ────────────────────────────────────────────────────────────
test('on their feet aboard: the captain asks them back to their seat only for a part that is theirs', async () => {
  // "It would be best if the pilot or driller could "Get Up" at any time, but if they are expected to do the next move
  // then it will request them to get back to the seat"
  const { RUN_TALK } = await import('../src/lines.js'), T = RUN_TALK[MINING.id];
  for (const w of T.backJump) { assert.match(w, /seat/); assert.match(w, /jump/); }
  for (const w of T.backDrill) { assert.match(w, /seat/); assert.match(w, /drill/); }
  // (the core tuned and the next part not theirs: no seat asked for; the engineer walks the ship as they like)
  for (const w of T.tunedFree) { assert.doesNotMatch(w, /seat/); assert.match(w, /core is steady/); }
  for (const w of [...T.backJump, ...T.backDrill, ...T.tunedFree]) assert.ok(w.length <= 90, w);
  // signed only as engineer, no seat is theirs: both flight-deck jobs are the other two's
  assert.ok(MS.aboardOf(MINING, ['engineer']).every((a) => a.jobs.length === 1));
});
