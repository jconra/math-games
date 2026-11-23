// A SHIP OF YOUR OWN (src/own.js, src/missions.js OWN RUNS; the game's maker: "You have to buy the ship if you want to
// fly it at your leisure"; BUY1-2: "the amount of questions that you are asked should probably go up by about 50% if you
// take it out yourself. So you can make more, but you do more math. If you take a crew then you pay them, and you get
// less math questions."): the prices and the price check, the spend, what a run of your own pays the owner and the crew
// they hired, who is aboard, how many more cards each of their own jobs asks on each of the four runs, the pay slip's
// words, and just flying. No browser: plain numbers and words.
//   node --test pi-nebula/tests/own.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRICES, SHIP_NAMES, shipsOf, owns, saleOf, buy, moreCards, OWN } from '../src/own.js';
import { MISSIONS, ROLES, CARDS, LAMPS, lampPlan, lampAt, rockCards, shareOf, payOf, sign, signOwn, hiredOf, shareFor, ownShare, contractOf, stepsFor, aboardOf, crewFor, land, collect, tearUp, payoutOrder, payoutLines, payoutForm, freeFlight, missions, RESCUE, SUPPLY } from '../src/missions.js';
import { EXPLORE, planOf, foundOf } from '../src/exploreplan.js';
import { cargoLink } from '../src/jobs/cargolink.js';
import { CARDS as CARGO_CARDS, orderOf, JOB as CARGO } from '../src/jobs/cargo.js';
import { startRun } from '../src/supplyrun.js';
import { SHIPS, flightOf } from '../src/fleet.js';

const maya = (more = {}) => ({ id: 'p1', name: 'Maya', credits: 500, ...more });
const found = { runs: 1, worlds: [], distress: true, finds: [] };
const RUNS = [['mining', 'miner'], ['rescue', 'medic'], ['explore', 'explorer'], ['supply', 'hauler']];
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

test('a run of your own: only in a ship that is yours, for at least one job, with no other mission on; the Hauler\'s once the old station is found', () => {
  assert.equal(signOwn(maya(), 'mining', ['pilot']), null);                                   // (not their ship)
  assert.equal(signOwn(maya({ ships: ['medic'] }), 'mining', ['pilot']), null);
  assert.equal(signOwn(maya({ ships: ['miner'] }), 'mining', []), null);                      // (no job of theirs)
  assert.equal(signOwn(maya({ ships: ['miner'] }), 'mining', ['medic']), null);               // (no job of this run's)
  const c = maya({ ships: ['miner', 'medic'] });
  const m = signOwn(c, 'mining', ['engineer', 'pilot'], 5, () => 0);
  assert.deepEqual([m.id, m.captain, m.roles, m.own, m.hired, m.state, m.tune], ['mining', 'ruiz', ['pilot', 'engineer'], true, ['drill'], 'signed', 'arrive']);
  assert.equal(contractOf(c), m);
  assert.equal(signOwn(c, 'rescue', ['pilot']), null);                                        // (a mission still on)
  // (it is no contract of the captain's: he asks as ever)
  assert.equal(missions.state('ruiz', c), 'new');
  const k = maya(); sign(k, 'mining', ['pilot']); assert.equal(missions.state('ruiz', k), 'signed');
  // (a run to a planet keeps its seed, as a contract does)
  tearUp(c); const r = signOwn(c, 'rescue', ['medic'], 5, Math.random, () => 0.5); assert.equal(r.seed, 500000); assert.deepEqual(r.hired, ['pilot', 'engineer']);
  // (the Hauler: just flying until the old station is found; then its own run)
  const h = maya({ ships: ['hauler'] });
  assert.equal(signOwn(h, 'supply', ['pilot']), null);
  h.explored = found; assert.ok(signOwn(h, 'supply', ['pilot']));
});

test('the owner\'s pay: all the run brought but the hired crew\'s shares, which are the contract\'s own', () => {
  for (const [mid, ship] of RUNS) {
    const M = MISSIONS[mid];
    for (const mine of subsets(M.roles)) {
      const c = maya({ ships: [ship], explored: found }), m = signOwn(c, mid, mine);
      const hired = hiredOf(m), took = hired.reduce((a, h) => a + h.share, 0);
      // (a hired crew member takes the very share the contract gives that job; the owner the rest: 100, 90, 80, 70 or 60)
      for (const h of hired) { assert.equal(h.share, ROLES[h.role].share); assert.ok(!mine.includes(h.role)); assert.equal(h.name, (M.jobs && M.jobs[h.role] ? M.jobs[h.role].crew : ROLES[h.role].crew)); }
      assert.equal(hired.length, 3 - mine.length);
      assert.equal(shareFor(m), 100 - took); assert.equal(ownShare(M, mine), 100 - took);
      assert.ok([100, 90, 80, 70, 60].includes(shareFor(m)));
      // (more than a contract ever pays for the same jobs: a contract's three jobs together are 50%)
      assert.ok(shareFor(m) > shareOf(mine)); assert.equal(shareOf(M.roles), 50);
      const P = land(c, { n: 1, store: { iron: 4, nickel: 2, copper: 2 }, people: 5, places: 2, find: 'world', pallets: 4, now: 9 });
      const sold = mid === 'mining' ? 4 * 2000 + 2 * 3000 + 2 * 4000 : mid === 'rescue' ? 5 * RESCUE.perPerson : mid === 'explore' ? EXPLORE.find + 2 * EXPLORE.perPlace : 4 * SUPPLY.perPallet;
      assert.equal(P.sold, sold); assert.equal(P.share, 100 - took); assert.equal(P.pay, payOf(sold, 100 - took));
      assert.equal(P.own, true); assert.deepEqual(P.hired, hired);
      // (the owner's pay and the hired crew's shares are the whole of it, to the credit)
      assert.equal(P.pay + hired.reduce((a, h) => a + payOf(sold, h.share), 0), sold);
      const before = c.credits, got = collect(c);
      assert.equal(got.pay, P.pay); assert.equal(c.credits, before + P.pay); assert.equal(contractOf(c), null);
    }
  }
  // (alone, all three jobs: 24,000 pays 24,000; the same jobs on the captain's contract: 12,000)
  assert.equal(payOf(24000, ownShare(MISSIONS.mining, ['pilot', 'drill', 'engineer'])), 24000);
  assert.equal(payOf(24000, shareOf(['pilot', 'drill', 'engineer'])), 12000);
  // (two hired, the pilot's seat theirs: 60%, where the contract pays the pilot 10%)
  assert.equal(ownShare(MISSIONS.mining, ['pilot']), 60);
  // (a captain's contract is as it was: its payout says nothing of owning)
  const k = maya(); sign(k, 'mining', ['pilot']); const Pk = land(k, { n: 1, store: { iron: 8 } });
  assert.equal(shareFor(k.mission), 10); assert.equal(Pk.pay, 1600); assert.equal(Pk.own, undefined); assert.equal(Pk.hired, undefined);
});

test('aboard on a run of your own: no captain; the crew you hired, one for each job you left, each doing it', () => {
  for (const [mid] of RUNS) {
    const M = MISSIONS[mid];
    for (const mine of subsets(M.roles)) {
      const A = aboardOf(M, mine, null, { own: true }), left = M.roles.filter((id) => !mine.includes(id));
      assert.equal(A.length, left.length);
      assert.deepEqual(A.map((a) => a.jobs), left.map((id) => [id]));
      for (const a of A) { assert.equal(a.captain, false); assert.equal(a.hired, true); assert.ok(!/captain|first mate/i.test(a.name)); assert.ok(a.look && a.look.crew === M.ship); }
      // (the same people the captain has for those jobs)
      assert.deepEqual(A.map((a) => a.name), left.map((id) => (M.jobs && M.jobs[id] ? M.jobs[id].crew : ROLES[id].crew)));
      const W = crewFor(M, mine, 'You', null, { own: true });
      assert.deepEqual(W.map((w) => w.you), M.roles.map((id) => mine.includes(id)));
      for (const w of W) assert.ok(w.you ? w.name === 'You' : A.some((a) => a.name === w.name));
    }
    // (the captain's contract: as it was, the captain first)
    const C = aboardOf(M, [M.roles[0]], { id: M.captain, name: 'Captain X' });
    assert.equal(C.length, 2); assert.equal(C[0].captain, true);
  }
  assert.deepEqual(aboardOf(MISSIONS.mining, ['pilot', 'drill', 'engineer'], null, { own: true }), []);
  assert.deepEqual(aboardOf(MISSIONS.mining, ['engineer'], null, { own: true }).map((a) => a.name), ['Pilot Juno', 'Miner Kestrel']);
});

test('half as many cards again: a turn of 3 asks 5 then 4 then 5; a turn of 1 asks 2 then 1; the Loader\'s 5 ask 8', () => {
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

test('the Loader on a run of your own: 8 questions, the five that work out the load and three of the next load\'s; a contract: 5', () => {
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
      assert.match(L.head(o), new RegExp(`question ${k + 1} of 8`)); assert.match(L.head(o), k < 5 ? /To the old station/ : /The next load/);
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

test('the pay slip of a run of your own: one right answer at every level, your pay, the hired crew\'s part; no word of a share, a contract or a captain', () => {
  const BAD = /your share|contract|captain/i;
  for (const [mid, ship] of RUNS) {
    const M = MISSIONS[mid];
    for (const mine of [M.roles, [M.roles[0]], [M.roles[1], M.roles[2]]]) {
      const c = maya({ ships: [ship], explored: found }); signOwn(c, mid, mine);
      const P = land(c, { n: 1, store: { iron: 4, nickel: 2, copper: 2 }, people: 4, places: 2, find: 'field', pallets: 3 }), alone = mine.length === 3;
      for (const grade of [0, 6, 22, 30, 46, 50, 60, 75]) {
        const o = payoutOrder(c.mission, grade, () => 0.37), text = [o.story, o.ask, o.rightWhy, ...o.coins.map((q) => q.why || ''), ...o.lines.flat(), o.help ? o.help.line : ''].join(' | ');
        assert.equal(o.coins.filter((q) => q.good).length, 1, `${mid} ${grade}`);
        assert.equal(o.payout, P.pay); assert.equal(o.facts.from, 'Your own run');
        assert.ok(!BAD.test(text), `${mid} at ${grade}: ${text}`);
        // (nobody hired: all of it is theirs, so there is no part or percent of it to work out)
        if (alone) { assert.ok(['count', 'add'].includes(o.form)); assert.ok(o.lines.some((r) => r[0] === 'Yours' && r[1] === 'All of it')); assert.ok(!o.lines.some((r) => r[0] === 'Hired crew')); }
        else {
          assert.equal(o.form, payoutForm(grade) === 'percent' || payoutForm(grade) === 'part' ? payoutForm(grade) : o.form);
          assert.ok(o.lines.some((r) => r[0] === 'Hired crew' && r[1] === `${100 - P.share}%`));
          if (o.form === 'part' || o.form === 'percent') { assert.match(o.story, /The crew you hired take/); assert.equal(o.coins.find((q) => q.good).v, P.pay); }
        }
        assert.match(o.rightWhy + ' ' + o.story, alone ? /All of it is yours|Your pay is/ : /is yours|are yours|What is left|Your pay is|credits$/);
      }
      // (the slip's last rows)
      const rows = payoutLines(P);
      assert.deepEqual(rows[rows.length - 1], ['Your pay', `${P.pay.toLocaleString('en-US')} credits`]);
      assert.deepEqual(rows[rows.length - 2], ['Yours', alone ? 'All of it' : `${P.share}%`]);
    }
  }
  // (a captain's contract: its slip as it was)
  const k = maya(); sign(k, 'mining', ['pilot', 'drill']); land(k, { n: 1, store: { iron: 8 } });
  const o = payoutOrder(k.mission, 60, () => 0.3);
  assert.equal(o.facts.from, 'Your share'); assert.match(o.story, /Your contract pays you 30% of it/); assert.deepEqual(o.lines[o.lines.length - 2], ['Your share', 'Pilot and drill operator: 30%']);
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
