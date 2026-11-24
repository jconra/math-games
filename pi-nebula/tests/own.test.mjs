// A SHIP OF YOUR OWN (src/own.js, src/missions.js OWN RUNS; the game's maker: "You have to buy the ship if you want to
// fly it at your leisure"; BUY1-2: "the amount of questions that you are asked should probably go up by about 50% if you
// take it out yourself. So you can make more, but you do more math. If you take a crew then you pay them, and you get
// less math questions."): the prices and the price check, the spend, what a run of your own pays the owner and the crew
// they hired, who is aboard, how many more cards each of their own jobs asks on each of the four runs, the pay slip's
// words, and just flying. No browser: plain numbers and words.
//   node --test pi-nebula/tests/own.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PRICES, SHIP_NAMES, shipsOf, owns, saleOf, buy, moreCards, OWN, SEATS, askCrew, crewOf, onCrew } from '../src/own.js';
import { MISSIONS, ROLES, CARDS, LAMPS, lampPlan, lampAt, rockCards, shareOf, payOf, sign, signOwn, crewJobsOf, shareFor, ownShare, OPS, aboardIds, friendOf, RUN_PIP, contractOf, stepsFor, aboardOf, crewFor, land, collect, tearUp, payoutOrder, payoutLines, payoutForm, freeFlight, missions, RESCUE, SUPPLY } from '../src/missions.js';
import { FRIENDS, agreesToCrew, meterOf } from '../src/friends.js';
import { CREW_ASK } from '../src/lines.js';
import { HAULER_CAPTAIN } from '../src/life.js';
import { placesOf } from '../src/aboardplan.js';
import { patientBeds } from '../src/rescueplan.js';
import { EXPLORE, planOf, foundOf } from '../src/exploreplan.js';
import { cargoLink } from '../src/jobs/cargolink.js';
import { CARDS as CARGO_CARDS, orderOf, JOB as CARGO } from '../src/jobs/cargo.js';
import { startRun } from '../src/supplyrun.js';
import { SHIPS, flightOf } from '../src/fleet.js';

const maya = (more = {}) => ({ id: 'p1', name: 'Maya', credits: 500, ...more });
const found = { runs: 1, worlds: [], distress: true, finds: [] };
const RUNS = [['mining', 'miner'], ['rescue', 'medic'], ['explore', 'explorer'], ['supply', 'hauler']];
// (the blueprint each ship is boarded by: src/boarding.js SHIPS, DOCKED_SHIP)
const SHIPS_BP = { miner: 'miner-ore-cockpit', medic: 'medic-open-bench', explorer: 'explorer-c-row', hauler: 'hauler-his-plan' };
const subsets = (roles) => [[0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]].map((ix) => ix.map((i) => roles[i]));

test('the four prices: the Explorer 50,000, the Medic 55,000, the Miner 60,000, the Hauler 80,000', () => {
  assert.deepEqual(PRICES, { explorer: 50000, medic: 55000, miner: 60000, hauler: 80000 });
  // (his figures: the Explorer cheapest; the Medic and the Miner 50,000 to 60,000; the Hauler about 80,000)
  assert.equal(Math.min(...Object.values(PRICES)), PRICES.explorer);
  for (const id of ['medic', 'miner']) assert.ok(PRICES[id] >= 50000 && PRICES[id] <= 60000);
  assert.equal(PRICES.hauler, 80000);
  // (a price for every ship the fleet flies, and for nothing else; each said by the fleet's own name)
  const fleet = [...SHIPS.map((s) => s.id), 'hauler'].sort();
  assert.deepEqual(Object.keys(PRICES).sort(), fleet);
  for (const id of Object.keys(PRICES)) assert.equal(SHIP_NAMES[id], flightOf(id).name);
  // (every ship's run is one of the four missions, its captain's)
  for (const [mid, ship] of RUNS) assert.equal(MISSIONS[mid].ship, ship);
});

test('the price check: short of credits it says how many more; enough, it can be bought; the Hauler only once the bridge is built', () => {
  let S = saleOf(maya({ credits: 59000 }), 'miner');
  assert.deepEqual([S.price, S.owned, S.open, S.short, S.can], [60000, false, true, 1000, false]);
  S = saleOf(maya({ credits: 60000 }), 'miner'); assert.deepEqual([S.short, S.can], [0, true]);
  S = saleOf(maya({ credits: 123456 }), 'explorer'); assert.deepEqual([S.price, S.short, S.can, S.credits], [50000, 0, true, 123456]);
  // (credits kept badly: counted as none)
  S = saleOf(maya({ credits: 'lots' }), 'medic'); assert.deepEqual([S.short, S.can], [55000, false]);
  S = saleOf({ id: 'x' }, 'medic'); assert.equal(S.short, 55000);
  // (the Hauler: not for sale until this crew member's bridge is built, however many credits)
  S = saleOf(maya({ credits: 200000 }), 'hauler', { bridge: false });
  assert.deepEqual([S.open, S.can, S.short], [false, false, 0]); assert.match(S.why, /bridge/);
  S = saleOf(maya({ credits: 200000 }), 'hauler', { bridge: true }); assert.deepEqual([S.open, S.can], [true, true]);
  S = saleOf(maya({ credits: 79999 }), 'hauler', { bridge: true }); assert.deepEqual([S.can, S.short], [false, 1]);
  // (the others are for sale from the start, bridge or no bridge)
  for (const id of ['miner', 'medic', 'explorer']) assert.equal(saleOf(maya({ credits: 99999 }), id, { bridge: false }).can, true);
  // (one already theirs is not for sale to them again)
  S = saleOf(maya({ credits: 99999, ships: ['miner'] }), 'miner'); assert.deepEqual([S.owned, S.can], [true, false]);
  assert.equal(saleOf(maya(), 'gunship'), null);
});

test('the spend: bought, the price leaves their credits and the ship is kept with them; anything else changes nothing', () => {
  const c = maya({ credits: 61500 });
  const r = buy(c, 'miner', { now: 1000 });
  assert.deepEqual(r, { ok: true, price: 60000, credits: 1500, ships: ['miner'] });
  assert.equal(c.credits, 1500); assert.deepEqual(c.ships, ['miner']); assert.deepEqual(c.bought, { miner: { at: 1000, price: 60000 } });
  assert.ok(owns(c, 'miner')); assert.ok(!owns(c, 'medic'));
  // (it is saved with them as any field is: there again after the save is read back)
  const back = JSON.parse(JSON.stringify(c)); assert.ok(owns(back, 'miner')); assert.equal(back.credits, 1500);
  // (not twice; not short; not the Hauler without the bridge: nothing changes)
  for (const [ship, opts, why] of [['miner', {}, 'owned'], ['medic', {}, 'short'], ['hauler', { bridge: false }, 'closed'], ['yacht', {}, 'unknown']]) {
    const before = JSON.stringify(c), x = buy(c, ship, opts);
    assert.equal(x.ok, false); assert.equal(x.why, why); assert.equal(JSON.stringify(c), before);
  }
  assert.equal(buy(c, 'medic').short, 55000 - 1500);
  // (a second ship, later: both theirs, in the fleet's own order however they were bought)
  c.credits = 140000; assert.ok(buy(c, 'hauler', { bridge: true }).ok); assert.ok(buy(c, 'explorer').ok);
  assert.deepEqual(shipsOf(c), ['explorer', 'miner', 'hauler']); assert.equal(c.credits, 140000 - 80000 - 50000);
  // (each crew member on the device owns their own)
  const other = maya({ id: 'p2', name: 'Leo', credits: 70000 });
  assert.deepEqual(shipsOf(other), []); assert.ok(buy(other, 'medic').ok); assert.deepEqual(shipsOf(other), ['medic']); assert.ok(!owns(c, 'medic'));
  // (a save with ships this build does not know, or kept badly: tidied)
  assert.deepEqual(shipsOf({ ships: ['yacht', 'miner', 'miner'] }), ['miner']); assert.deepEqual(shipsOf({ ships: 'miner' }), []); assert.deepEqual(shipsOf(null), []);
});

// (a crew of your own, as agreed: three of the station's people and a rescued survivor; the five captains are never on it)
const MATES = [{ id: 'cook', name: 'Bo', look: 'cook' }, { id: 'medic', name: 'Ana', look: 'medic' }, { id: 'guard', name: 'Tess', look: 'guard' }, { id: 'w-1', name: 'Nora', look: { suit: 'civilian', head: 't3' } }];
const crewed = (more = {}) => maya({ myCrew: MATES.map((p) => ({ ...p })), ...more });
// (every way the three jobs of a run can be shared out: each yours or one of the first three of your crew, each person
// on one job at most -> [{ mine, jobs }])
function sharings(roles) {
  const out = [], ids = [null, 'cook', 'medic', 'guard'];
  for (const a of ids) for (const b of ids) for (const c of ids) {
    const w = [a, b, c], used = w.filter(Boolean); if (new Set(used).size !== used.length) continue;
    out.push({ mine: roles.filter((_, i) => !w[i]), jobs: Object.fromEntries(roles.map((r, i) => [r, w[i]]).filter(([, x]) => x)) });
  }
  return out;
}

test('asked to join your crew: yes at 5 pips or more, kept with the crew member; no under 5; a captain no whatever the meter; nothing before a ship of your own', () => {
  const c = maya({ friends: { cook: { p: 5 }, medic: { p: 4.5 }, ruiz: { p: 10 } } });
  // (no ship yet: nobody is asked)
  assert.deepEqual(askCrew(c, { id: 'cook', name: 'Bo' }, 5), { yes: false, why: 'ship' });
  c.ships = ['miner'];
  assert.deepEqual(askCrew(c, { id: 'medic', name: 'Ana' }, 4.5), { yes: false, why: 'friends' });
  assert.deepEqual(askCrew(c, { id: 'cook', name: 'Bo', look: 'cook' }, 5, { now: 7 }), { yes: true, why: 'joined' });
  assert.deepEqual(askCrew(c, { id: 'cook', name: 'Bo' }, 9), { yes: true, why: 'already' });
  // (the five captains: each has a ship of their own and stands in the station offering its contracts)
  for (const id of ['ruiz', 'hale', 'vega', 'adair', HAULER_CAPTAIN.id]) assert.deepEqual(askCrew(c, { id, name: 'Captain', captain: true }, 10), { yes: false, why: 'captain' });
  // (the friends' own rule: src/friends.js agreesToCrew, at 5)
  assert.equal(FRIENDS.crew, 5); assert.equal(agreesToCrew(c, 'cook'), true); assert.equal(agreesToCrew(c, 'medic'), false);
  assert.deepEqual(crewOf(c), [{ id: 'cook', name: 'Bo', look: 'cook', at: 7 }]); assert.equal(onCrew(c, 'cook'), true); assert.equal(onCrew(c, 'medic'), false);
  // (a no changes nothing: asked again with more pips, yes; no limit on how many)
  assert.equal(askCrew(c, { id: 'medic', name: 'Ana' }, 5).why, 'joined');
  for (let i = 0; i < 12; i++) assert.equal(askCrew(c, { id: 'p' + i, name: 'P' + i }, 6).why, 'joined');
  assert.equal(crewOf(c).length, 14);
  // (kept tidy: each once, with an id)
  assert.deepEqual(crewOf({ myCrew: [{ id: 'a', name: 'A' }, { id: 'a', name: 'A2' }, null, { name: 'nobody' }] }).map((p) => p.name), ['A']);
  // (each of the captains says so in their own words; everyone else's yes and no are kind)
  for (const id of ['ruiz', 'hale', 'vega', 'adair', HAULER_CAPTAIN.id]) assert.ok(CREW_ASK.captains[id] && CREW_ASK.captains[id].length > 20, id);
  for (const k of ['ask', 'yes', 'no', 'already']) assert.ok(CREW_ASK[k].length >= 1);
  assert.equal(new Set(Object.values(CREW_ASK.captains)).size, 5);
});

test('how many of your crew a ship takes: every place to sit or lie less your own (the Medic keeps four for the people it brings home)', () => {
  const bpOf = (ship) => JSON.parse(fs.readFileSync(new URL(`../kit/ships/${SHIPS_BP[ship]}.blueprint.json`, import.meta.url)));
  for (const ship of ['miner', 'medic', 'explorer', 'hauler']) {
    const bp = bpOf(ship), places = placesOf(bp).length;
    const keep = ship === 'medic' ? 6 - patientBeds(bp, 0).length : 0;
    assert.equal(SEATS[ship], places - 1 - keep, ship);
    assert.ok(SEATS[ship] >= 3, ship + ': room for a crew on all three jobs');
    assert.match(fs.readFileSync(new URL('../src/boarding.js', import.meta.url), 'utf8'), new RegExp(`id: '${ship}'[^\\n]*bp: '${SHIPS_BP[ship]}'`), ship);
  }
  // (more of them than the ship takes: no run)
  const c = crewed({ ships: ['medic'] });
  assert.equal(signOwn(c, 'rescue', [], 1, Math.random, Math.random, { jobs: { pilot: 'cook', medic: 'medic', engineer: 'guard' }, along: ['w-1'] }), null);
  assert.ok(signOwn(c, 'rescue', ['pilot'], 1, Math.random, Math.random, { jobs: { medic: 'medic', engineer: 'guard' }, along: ['w-1'] }));
});

test('a run of your own: only in a ship that is yours, every job yours or your crew\'s, no other mission on; the Hauler\'s once the old station is found', () => {
  assert.equal(signOwn(maya(), 'mining', ['pilot', 'drill', 'engineer']), null);                  // (not their ship)
  assert.equal(signOwn(maya({ ships: ['medic'] }), 'mining', ['pilot', 'drill', 'engineer']), null);
  // (no crew: all three jobs are yours; a job left with nobody on it is no run)
  assert.ok(signOwn(maya({ ships: ['miner'] }), 'mining', ['pilot', 'drill', 'engineer']));
  assert.equal(signOwn(maya({ ships: ['miner'] }), 'mining', ['pilot']), null);
  assert.equal(signOwn(maya({ ships: ['miner'] }), 'mining', []), null);
  // (someone not on your crew, or one person on two jobs, or along and on a job: no run)
  assert.equal(signOwn(crewed({ ships: ['miner'] }), 'mining', ['pilot', 'drill'], 1, Math.random, Math.random, { jobs: { engineer: 'ruiz' } }), null);
  assert.equal(signOwn(crewed({ ships: ['miner'] }), 'mining', ['pilot'], 1, Math.random, Math.random, { jobs: { drill: 'cook', engineer: 'cook' } }), null);
  assert.equal(signOwn(crewed({ ships: ['miner'] }), 'mining', ['pilot', 'drill'], 1, Math.random, Math.random, { jobs: { engineer: 'cook' }, along: ['cook'] }), null);
  // (no job of yours at all: the crew does all three, and you ride along)
  const c = crewed({ ships: ['miner', 'medic'] });
  const m = signOwn(c, 'mining', ['engineer'], 5, () => 0, Math.random, { jobs: { pilot: 'cook', drill: 'w-1' }, along: ['guard'] });
  assert.deepEqual([m.id, m.captain, m.roles, m.own, m.state, m.tune], ['mining', 'ruiz', ['engineer'], true, 'signed', 'arrive']);
  assert.deepEqual(m.crew.map((p) => [p.id, p.jobs]), [['cook', ['pilot']], ['w-1', ['drill']], ['guard', []]]);
  assert.deepEqual(m.crew[1].look, MATES[3].look, 'a rescued survivor in their own look');
  assert.equal(contractOf(c), m);
  assert.equal(signOwn(c, 'rescue', ['pilot', 'medic', 'engineer']), null);                     // (a mission still on)
  // (it is no contract of the captain's: he asks as ever)
  assert.equal(missions.state('ruiz', c), 'new');
  const k = maya(); sign(k, 'mining', ['pilot']); assert.equal(missions.state('ruiz', k), 'signed');
  tearUp(c);
  const all = signOwn(c, 'rescue', [], 5, Math.random, () => 0.5, { jobs: { pilot: 'cook', medic: 'medic', engineer: 'guard' } });
  assert.deepEqual(all.roles, []); assert.equal(all.seed, 500000); assert.equal(contractOf(c), all);
  // (every step the crew's: nothing asks you anything on the way)
  assert.ok(stepsFor(MISSIONS.rescue, all.roles, null, null, { own: true }).every((s) => !s.mine));
  // (the Hauler: just flying until the old station is found; then its own run)
  const h = maya({ ships: ['hauler'] });
  assert.equal(signOwn(h, 'supply', ['pilot', 'engineer', 'cargo']), null);
  h.explored = found; assert.ok(signOwn(h, 'supply', ['pilot', 'engineer', 'cargo']));
  // (a run of your own begun before your crew was your own, with hired hands, not flown yet: gone)
  assert.equal(contractOf(maya({ ships: ['miner'], mission: { id: 'mining', captain: 'ruiz', roles: ['pilot'], state: 'signed', own: true, hired: ['drill', 'engineer'] } })), null);
});

test('the pay of a run of your own: operating costs 25% always, each job your crew does its own share, the rest yours (75% to 25%); every set of jobs on all four runs adds up to the credit', () => {
  assert.equal(OPS.pct, 25);
  const SOLD = { mining: [{ iron: 4, nickel: 2, copper: 2 }, { copper: 6 }, { iron: 4.375, nickel: 0.125 }, { copper: 4, iron: 0.5, nickel: 0.125 }], rescue: [18000, 36000], explore: [EXPLORE.find + 2 * EXPLORE.perPlace, EXPLORE.find + 3 * EXPLORE.perPlace], supply: [3 * SUPPLY.perPallet, 4 * SUPPLY.perPallet] };
  let n = 0;
  for (const [mid, ship] of RUNS) {
    const M = MISSIONS[mid];
    for (const { mine, jobs } of sharings(M.roles)) {
      const c = crewed({ ships: [ship], explored: found }), m = signOwn(c, mid, mine, 1, Math.random, Math.random, { jobs });
      assert.ok(m, `${mid} ${JSON.stringify(jobs)}`);
      const took = Object.keys(jobs).reduce((a, r) => a + ROLES[r].share, 0);
      assert.equal(shareFor(m), 75 - took); assert.equal(ownShare(M, mine), 75 - took);
      assert.ok(shareFor(m) >= 25 && shareFor(m) <= 75);
      assert.deepEqual(crewJobsOf(m).map((h) => [h.role, h.id, h.share]), M.roles.filter((r) => jobs[r]).map((r) => [r, jobs[r], ROLES[r].share]));
      // (land with each of that run's own amounts)
      for (const x of SOLD[mid]) {
        const c2 = crewed({ ships: [ship], explored: found }); signOwn(c2, mid, mine, 1, Math.random, Math.random, { jobs });
        const P = mid === 'mining' ? land(c2, { n: 1, store: x }) : land(c2, { people: x / RESCUE.perPerson, places: (x - EXPLORE.find) / EXPLORE.perPlace, find: 'world', pallets: x / SUPPLY.perPallet, now: 9 });
        const sold = mid === 'mining' ? P.sold : x;
        assert.equal(P.sold, sold, mid); assert.ok(sold > 0);
        assert.equal(P.own, true); assert.equal(P.opsPct, 25); assert.equal(P.ops, payOf(sold, 25)); assert.equal(P.share, 75 - took);
        for (const h of P.crew) assert.equal(h.pay, payOf(sold, h.share));
        assert.ok(Number.isInteger(P.pay) && P.pay >= 0);
        // (the operating costs, the crew's pay and yours are the whole of it, to the credit)
        assert.equal(P.ops + P.crew.reduce((a, h) => a + h.pay, 0) + P.pay, sold, `${mid} ${sold} ${JSON.stringify(jobs)}`);
        if (Number.isInteger(sold / 20)) assert.equal(P.pay, payOf(sold, 75 - took));
        const before = c2.credits; collect(c2); assert.equal(c2.credits, before + P.pay); assert.equal(contractOf(c2), null);
        n++;
      }
    }
  }
  assert.equal(n, 34 * 10);
  // (alone, all three jobs: 24,000 pays 18,000; your crew on all three: 6,000; the same jobs on the captain's contract: 12,000)
  assert.equal(payOf(24000, ownShare(MISSIONS.mining, ['pilot', 'drill', 'engineer'])), 18000);
  assert.equal(payOf(24000, ownShare(MISSIONS.mining, [])), 6000);
  assert.equal(payOf(24000, shareOf(['pilot', 'drill', 'engineer'])), 12000);
  // (along for the ride takes no share)
  const a = crewed({ ships: ['miner'] }); signOwn(a, 'mining', ['pilot', 'drill', 'engineer'], 1, Math.random, Math.random, { along: ['cook', 'medic'] });
  const Pa = land(a, { n: 1, store: { copper: 6 } }); assert.equal(Pa.pay, 18000); assert.deepEqual(Pa.crew, []); assert.deepEqual(Pa.along, ['Bo', 'Ana']);
  // (a captain's contract is as it was: its payout says nothing of owning or operating costs)
  const k = maya(); sign(k, 'mining', ['pilot']); const Pk = land(k, { n: 1, store: { iron: 8 } });
  assert.equal(shareFor(k.mission), 10); assert.equal(Pk.pay, 1600); assert.equal(Pk.own, undefined); assert.equal(Pk.ops, undefined); assert.equal(Pk.crew, undefined);
});

test('nobody hired: no run of your own ever has anyone aboard but you and your crew who came; no hired hands in any word of the game', () => {
  for (const [mid, ship] of RUNS) {
    const M = MISSIONS[mid];
    for (const { mine, jobs } of sharings(M.roles)) {
      const c = crewed({ ships: [ship], explored: found }), m = signOwn(c, mid, mine, 1, Math.random, Math.random, { jobs, along: Object.values(jobs).includes('guard') ? [] : ['guard'] });
      const A = aboardOf(M, m.roles, null, { own: true, crew: m.crew });
      // (exactly your crew who came: those on its jobs and those along for the ride; no captain, nobody of his)
      assert.deepEqual(A.map((a) => a.id).sort(), m.crew.map((p) => p.id).sort());
      for (const a of A) { assert.equal(a.captain, false); assert.ok(MATES.some((p) => p.id === a.id)); assert.deepEqual(a.look, MATES.find((p) => p.id === a.id).look); }
      assert.deepEqual(M.roles.filter((r) => !mine.includes(r)).map((r) => A.find((a) => a.jobs.includes(r)).id), M.roles.filter((r) => jobs[r]).map((r) => jobs[r]));
      assert.ok(A.find((a) => a.id === 'guard') ? A.find((a) => a.id === 'guard').jobs.length <= 1 : true);
      const W = crewFor(M, m.roles, 'You', null, { own: true, crew: m.crew });
      for (const w of W) assert.equal(w.name, w.you ? 'You' : MATES.find((p) => p.id === jobs[w.role]).name);
    }
    // (no crew: nobody else aboard)
    assert.deepEqual(aboardOf(M, M.roles, null, { own: true }), []);
    // (the captain's contract: as it was, the captain first)
    const C = aboardOf(M, [M.roles[0]], { id: M.captain, name: 'Captain X' });
    assert.equal(C.length, 2); assert.equal(C[0].captain, true);
  }
  // (the owner's card and the pay slip say nothing of hiring: their sources)
  for (const f of ['contract.js', 'missions.js']) {
    const src = fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    const live = f === 'missions.js' ? src.replace(/const shareRows[\s\S]*?\n/, '').replace(/export function payoutOrder[\s\S]*$/, '') : src;
    assert.ok(!/Hired:|hire for it|anyone you hire/.test(live), f);
  }
});

test('a run made raises friendship: one pip for everyone who was aboard, when it is paid; a run given up adds nothing', () => {
  assert.equal(RUN_PIP, 1);
  // (a run of your own: your crew who came, on a job or along for the ride)
  const c = crewed({ ships: ['miner'], friends: { cook: { p: 5 }, medic: { p: 6 }, guard: { p: 5 }, 'w-1': { p: 5 } } });
  signOwn(c, 'mining', ['pilot', 'drill'], 1, Math.random, Math.random, { jobs: { engineer: 'cook' }, along: ['medic'] });
  assert.deepEqual(aboardIds(c.mission), ['cook', 'medic']);
  land(c, { n: 1, store: { copper: 6 } }); assert.equal(meterOf(c, 'cook').p, 5, 'nothing yet: not paid');
  collect(c);
  assert.deepEqual(['cook', 'medic', 'guard', 'w-1'].map((id) => meterOf(c, id).p), [6, 7, 5, 5]);
  // (given up: nothing)
  signOwn(c, 'mining', ['pilot', 'drill', 'engineer'], 1, Math.random, Math.random, { along: ['guard'] }); tearUp(c);
  assert.equal(meterOf(c, 'guard').p, 5);
  // (a captain's contract: the captain and the one of his crew who came, every set of jobs, every captain)
  for (const [mid] of RUNS) {
    const M = MISSIONS[mid];
    for (const mine of subsets(M.roles)) {
      const k = maya({ explored: found }); sign(k, mid, mine);
      const ids = aboardIds(k.mission), A = aboardOf(M, mine, { id: M.captain, name: 'C' });
      assert.deepEqual(ids, [M.captain, friendOf(A[1].name)]);
      land(k, { n: 1, store: { iron: 8 }, people: 4, places: 2, pallets: 3 }); collect(k);
      for (const id of ids) assert.equal(meterOf(k, id).p, 1, `${mid} ${id}`);
    }
  }
  assert.equal(friendOf('Pilot Juno'), 'crew-pilot-juno');
  // (at most the meter's ten)
  const f = maya({ friends: { ruiz: { p: 10 } } }); sign(f, 'mining', ['pilot']); land(f, { n: 1, store: { iron: 8 } }); collect(f); assert.equal(meterOf(f, 'ruiz').p, 10);
});

test('half as many cards again: a turn of 3 asks 5 then 4 then 5; a turn of 1 asks 2 then 1; the Loadmaster\'s 5 ask 8', () => {
  assert.equal(OWN.more, 1.5);
  assert.deepEqual([0, 1, 2, 3].map((k) => moreCards(3, k)), [5, 4, 5, 4]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => moreCards(1, k)), [2, 1, 2, 1, 2, 1]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(rockCards), [2, 1, 2, 1, 2, 1]);
  assert.equal(moreCards(5, 0), 8); assert.equal(moreCards(0, 0), 0);
  // (over any two turns in a row it is exactly half as many again)
  for (const n of [1, 3, 5]) for (const k of [0, 1, 2]) assert.equal(moreCards(n, k) + moreCards(n, k + 1), 3 * n);
  // (never fewer than a contract asks, never twice as many)
  for (const n of [1, 2, 3, 4, 5, 6]) for (const k of [0, 1]) { assert.ok(moreCards(n, k) >= n); assert.ok(moreCards(n, k) <= 2 * n); }
});

test('where the extra cards come, for each job of each run: the jumps, the core, the scans; a hired job asks nothing more', () => {
  const cardsOf = (steps) => steps.filter((s) => s.cards).map((s) => `${s.id}:${s.cards}${s.mine ? '*' : ''}`).join(' ');
  // THE MINER'S, THE MEDIC'S, THE HAULER'S: the pilot's two jumps 5 and 4 (9 for 6); the engineer's core 5 (for 3)
  for (const mid of ['mining', 'rescue', 'supply']) {
    const M = MISSIONS[mid];
    for (const when of ['arrive', 'leave']) {
      const S = stepsFor(M, M.roles, when, null, { own: true });
      assert.equal(cardsOf(S), when === 'arrive' ? 'jumpOut:5* core:5* jumpHome:4*' : 'jumpOut:5* core:5* jumpHome:4*');
      assert.deepEqual(S.filter((s) => s.cards).map((s) => s.was), [3, 3, 3]);
      // (the same run on the captain's contract: 3 each, as ever)
      assert.equal(cardsOf(stepsFor(M, M.roles, when)), 'jumpOut:3* core:3* jumpHome:3*');
    }
    // (the pilot's seat hired out: the jumps are the hired pilot's, 3 lamps lit by themselves; the core theirs: 5)
    assert.equal(cardsOf(stepsFor(M, ['engineer'], 'leave', null, { own: true })), 'jumpOut:3 core:5* jumpHome:3');
    // (the engineer hired: no core for them at all; their jumps 5 and 4)
    assert.equal(cardsOf(stepsFor(M, ['pilot'], null, null, { own: true })), 'jumpOut:5* jumpHome:4*');
  }
  // THE EXPLORER'S: the pilot's jumps 5, 4, 5 ... through its places and home; the sensor operator's scans 5, 4, 5; the core 5
  const X = MISSIONS.explore, seen = new Set();
  for (let seed = 1; seed < 400 && seen.size < 3; seed++) {
    const plan = planOf(seed, { antenna: false, found: foundOf(maya()) }), n = plan.legs.length; if (seen.has(n)) continue; seen.add(n);
    const S = stepsFor(X, X.roles, 'leave', plan, { own: true });
    const jumps = S.filter((s) => s.kind === 'jump').map((s) => s.cards), scans = S.filter((s) => s.kind === 'scan' && s.cards).map((s) => s.cards);
    assert.deepEqual(jumps, Array.from({ length: n + 1 }, (_, k) => moreCards(CARDS, k)));
    assert.deepEqual(scans, Array.from({ length: scans.length }, (_, k) => moreCards(CARDS, k)));
    assert.equal(S.find((s) => s.kind === 'tune').cards, 5);
    // (the contract: 3 everywhere)
    for (const s of stepsFor(X, X.roles, 'leave', plan)) if (s.cards) assert.equal(s.cards, 3);
    // (about half as many again over the whole run, whatever its length)
    const own = S.reduce((a, s) => a + (s.cards || 0), 0), was = stepsFor(X, X.roles, 'leave', plan).reduce((a, s) => a + (s.cards || 0), 0);
    assert.ok(own / was >= 1.4 && own / was <= 1.7, `${own} for ${was}`);
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
  // (only the sensor operator's job theirs: the scans grow, the hired pilot's jumps do not)
  const plan2 = planOf(3, { antenna: false, found: foundOf(maya()) }), S2 = stepsFor(X, ['sensor'], null, plan2, { own: true });
  for (const s of S2) if (s.kind === 'jump') assert.equal(s.cards, 3);
  assert.equal(S2.find((s) => s.kind === 'scan' && s.cards).cards, 5);
  // (the mission's own data is never touched)
  for (const M of Object.values(MISSIONS)) for (const s of M.steps) if (s.cards) assert.equal(s.cards, CARDS);
});

test('a jump of 4 or 5 cards still has its three lamps: the cards shared out, the first lamps taking the odd ones', () => {
  assert.equal(LAMPS.length, 3);
  assert.deepEqual(lampPlan(3), [1, 1, 1]); assert.deepEqual(lampPlan(4), [2, 1, 1]); assert.deepEqual(lampPlan(5), [2, 2, 1]); assert.deepEqual(lampPlan(6), [2, 2, 2]);
  assert.deepEqual([0, 1, 2].map((i) => lampAt(i, 3)), [0, 1, 2]);
  assert.deepEqual([0, 1, 2, 3].map((i) => lampAt(i, 4)), [0, 0, 1, 2]);
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => lampAt(i, 5)), [0, 0, 1, 1, 2]);
  // (past the last card: the last lamp, as the three-card jump always had it)
  assert.equal(lampAt(3, 3), 2); assert.equal(lampAt(5, 5), 2);
  for (const n of [3, 4, 5, 6, 7]) { assert.equal(lampPlan(n).reduce((a, b) => a + b, 0), n); assert.ok(lampPlan(n).every((k) => k >= 1)); }
});

test('the Loadmaster on a run of your own: 8 questions, the five that work out the load and three of the next load\'s; a contract: 5', () => {
  assert.equal(CARGO_CARDS, 5);
  for (const step of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const c = maya({ ships: ['hauler'] }), run = startRun(c, { rand: () => 0.9 }); run.own = true;
    const L = cargoLink({ crew: c, contract: true });
    assert.equal(L.total, 8); assert.equal(L.pay, false);
    const keys = [], people = new Set();
    for (let k = 0; k < 8; k++) {
      const live = L.now(); assert.equal(live.k, k);
      const o = CARGO.makers.load.make(step, { rand: () => 0.4, live });
      keys.push(o.facts.key);
      assert.equal(o.coins.filter((q) => q.good).length, 1);
      assert.match(L.head(o), new RegExp(`question ${k + 1} of 8`)); assert.match(L.head(o), k < 5 ? /To Tangent Station/ : /The next load/);
      assert.equal(L.over(), null);
      // (the people at the old station are as many in the next load's cards as in this one's, where a card says)
      const said = /(\d+) people/.exec(o.story); if (said) people.add(said[1]);
      L.right();
    }
    assert.deepEqual(keys, ['people', 'crates', 'drums', 'pallets', 'containers', 'crates', 'drums', 'pallets'].map((k, i) => (i === 0 && step >= 4 ? 'food' : k)));
    assert.ok(people.size <= 1, `step ${step}: ${[...people]}`);
    assert.equal(run.k, 8); assert.ok(L.over());
  }
  // (the captain's contract, and the computer by itself: five, as ever)
  const c = maya(); startRun(c, { rand: () => 0.1 });
  const L = cargoLink({ crew: c, contract: true });
  assert.equal(L.total, 5); assert.equal(L.now().cardAt, undefined);
  for (let k = 0; k < 5; k++) { assert.match(L.head(null), new RegExp(`question ${k + 1} of 5`)); L.right(); }
  assert.ok(L.over());
});

test('the pay slip of a run of your own: operating costs, the crew\'s pay and yours; its question about paying the crew, or with none of them paid the operating costs; one right answer at every level, and your pay arrives', () => {
  const BAD = /your share|contract|captain|hired/i;
  const GRADES = [0, 6, 22, 30, 46, 50, 60, 75];
  let seen = new Set();
  for (const [mid, ship] of RUNS) {
    const M = MISSIONS[mid];
    for (const { mine, jobs } of sharings(M.roles)) {
      for (const store of [{ iron: 4, nickel: 2, copper: 2 }, { iron: 4.375, nickel: 0.125 }]) {
        if (mid !== 'mining' && store.nickel === 0.125) continue;
        const c = crewed({ ships: [ship], explored: found }); signOwn(c, mid, mine, 1, Math.random, Math.random, { jobs, along: Object.values(jobs).includes('guard') ? [] : ['guard'] });
        const P = land(c, { n: 1, store, people: 4, places: 2, find: 'field', pallets: 3 }), n = P.crew.length, crewPay = P.crew.reduce((a, h) => a + h.pay, 0);
        for (const grade of GRADES) {
          const o = payoutOrder(c.mission, grade, () => 0.37), text = [o.story, o.ask, o.rightWhy, ...o.coins.map((q) => q.why || ''), ...o.lines.flat(), o.help ? o.help.line : ''].join(' | ');
          const tag = `${mid} ${JSON.stringify(jobs)} ${P.sold} at ${grade}`;
          assert.equal(o.coins.filter((q) => q.good).length, 1, tag);
          assert.equal(new Set(o.coins.map((q) => String(q.v))).size, o.coins.length, tag);
          assert.ok(o.coins.length >= 3, tag);
          assert.ok(o.coins.every((q) => typeof q.v !== 'number' || (Number.isInteger(q.v) && q.v > 0)), tag);
          assert.equal(o.payout, P.pay, tag); assert.equal(o.facts.from, 'Your own run');
          assert.ok(!BAD.test(text), `${tag}: ${text}`);
          // (the right answer: with crew paid, about their pay; with none, about the operating costs)
          const good = o.coins.find((q) => q.good).v, f = o.form;
          assert.equal(f === 'count' ? 'count' : f, f);
          if (n) {
            assert.match(o.ask, /crew|pay out/, tag);
            if (f === 'count') assert.equal(good, n);
            else if (f === 'add' && n === 1) assert.equal(good, P.ops + crewPay);
            else assert.equal(good, crewPay, tag);
          } else {
            assert.match(o.ask, /operating costs|yours|parts/, tag);
            if (f === 'count') assert.equal(good, 3);
            else if (f === 'add') assert.equal(good, P.pay);
            else assert.equal(good, P.ops);
          }
          // (the forms by level, as every slip's; a part or a percent that is not whole credits: add)
          const want = payoutForm(grade);
          if (want === 'count' || want === 'add') assert.equal(f, want, tag);
          else assert.ok(f === want || (f === 'add' && !Number.isInteger(P.sold / (n ? 10 : 4))), tag);
          assert.match(o.rightWhy, /Your pay is the rest|credits\.$/, tag);
          seen.add(`${n ? 'crew' : 'none'}:${f}`);
          // (the rows: the operating costs, each of the crew who did a job, yours, your pay)
          const rows = o.lines.map((r) => r[0]);
          assert.ok(rows.includes('Operating costs') && rows.includes('Yours') && rows.includes('Your pay'), tag);
          for (const h of P.crew) assert.ok(rows.includes(`${ROLES[h.role].name}: ${h.name}`), tag);
        }
        // (the slip, no question on it: every amount)
        const rows = payoutLines(P);
        assert.deepEqual(rows.slice(-2), [['Yours', `${P.share}%`], ['Your pay', `${P.pay.toLocaleString('en-US')} credits`]]);
        assert.deepEqual(rows.find((r) => r[0] === 'Operating costs'), ['Operating costs', `25%: ${P.ops.toLocaleString('en-US')} credits`]);
        if (!Object.values(jobs).includes('guard')) assert.ok(!rows.some((r) => /Tess/.test(r[0])), 'along for the ride: no row, no pay');
      }
    }
  }
  assert.deepEqual([...seen].sort(), ['crew:add', 'crew:count', 'crew:part', 'crew:percent', 'none:add', 'none:count', 'none:part', 'none:percent']);
  // (a captain's contract: its slip as it was)
  const k = maya(); sign(k, 'mining', ['pilot', 'drill']); land(k, { n: 1, store: { iron: 8 } });
  const o = payoutOrder(k.mission, 60, () => 0.3);
  assert.equal(o.facts.from, 'Your share'); assert.match(o.story, /Your contract pays you 30% of it/); assert.deepEqual(o.lines[o.lines.length - 2], ['Your share', 'Pilot and drill operator: 30%']);
  // (a run of your own home in a save from before, with hired hands, its pay waiting: paid as it was)
  const old = maya({ ships: ['miner'], mission: { id: 'mining', captain: 'ruiz', roles: ['pilot'], state: 'payout', own: true, hired: ['drill', 'engineer'], payout: { n: 1, canisters: 8, tonnes: 8, lots: [{ metal: 'iron', tonnes: 8, price: 2000, pay: 16000 }], sold: 16000, share: 60, pay: 9600, at: 1, own: true, hired: [{ role: 'drill', name: 'Miner Kestrel', share: 20 }, { role: 'engineer', name: 'Engineer Okafor', share: 20 }] } } });
  const oo = payoutOrder(contractOf(old), 60, () => 0.3); assert.equal(oo.payout, 9600); assert.equal(collect(old).pay, 9600);
});

test('just flying: the two flown steps and nothing between, no cards, no crew, nobody\'s mission', () => {
  for (const ship of Object.keys(PRICES)) {
    const F = freeFlight(ship);
    assert.equal(F.free, true); assert.equal(F.ship, ship); assert.equal(F.name, 'Your ' + SHIP_NAMES[ship]);
    assert.deepEqual(F.steps.map((s) => s.kind), ['leave', 'land']);
    const S = stepsFor(F, ['pilot']);
    assert.ok(S.every((s) => !s.cards && !s.mine)); assert.equal(S.length, 2);
    assert.equal(MISSIONS[F.id], undefined);
  }
});

test('the page parts, by their source: Join my crew on a person\'s card only with a ship of your own; the owner\'s card\'s jobs and its ride line; the Hauler\'s captain\'s sale gone', () => {
  const src = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  const F = src('friendcard.js'), C = src('contract.js'), P = src('people.js');
  assert.match(F, />Join my crew</); assert.match(F, /askCrew\(/); assert.match(F, /crewRow\.hidden = !\(c && shipsOf\(c\)\.length && id && \(!onCrew\(c, id\) \|\| S\.saying === id\)\)/);
  assert.match(F, /'On your crew'/); assert.match(F, /Digit3/);
  assert.match(C, /Along for the ride/); assert.match(C, /aboardN\(\) < seats/); assert.match(C, /own\.onRun\(ids, \{ jobs: \{ \.\.\.who \}, along: \[\.\.\.along\] \}\)/);
  assert.doesNotMatch(C, /Hired: /);
  assert.doesNotMatch(P, /'sale'|K\.sale/);
});
