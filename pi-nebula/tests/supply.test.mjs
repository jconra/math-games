// THE HAULER'S SUPPLY RUN TO THE OLD STATION (src/missions.js 'supply'; the game's maker, HAUL3-6: "you don't fly it
// until you discover the other station and need to bring supplies to it. After that then you can go on hauling missions
// as much as you want to make money. It does have a dock, that is what the bridge is for."): the contract and its three
// jobs, when it is offered, the cargo run it starts, the Hauler's own facts as the one flying flies it (docked, not
// parked in a hangar), docking by the same flight model, the pay and its pay slip, the lines, the old station's rooms.
// No browser: plain numbers and words.
//   node --test pi-nebula/tests/supply.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as F from '../src/fleet.js';
import * as M from '../src/flymodel.js';
import { MISSIONS, ROLES, SUPPLY, rolesOf, openRoles, shareOf, sign, contractOf, stepsFor, tuneWhen, aboardOf, crewFor, land, collect, payoutOrder, payoutLines, payoutForm, stationFound, supplyRuns, missionOf } from '../src/missions.js';
import { makeSupplyRun, runOf, lastRun, RUN } from '../src/supplyrun.js';
import { RUN_TALK, OLD_STATION, TALKS } from '../src/lines.js';
import { keepFind, foundOf } from '../src/exploreplan.js';
import { lineOf } from '../src/announce.js';
import { oldStationPlans, oldStationGear, LIT, LIT_SAVED, BRIDGE } from '../kit/oldstation-plan.js';
import { OUTSIDE_BOX } from '../kit/outside-plan.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const STATION = JSON.parse(read('../kit/rooms/station.json')), OLD = JSON.parse(read('../kit/rooms/oldstation.json'));
const DT = 1 / 60, S = MISSIONS.supply;
const found = (more = {}) => ({ id: 'p1', name: 'Maya', credits: 500, explored: { runs: 1, worlds: [], distress: true, finds: [] }, ...more });
const sets = [['pilot'], ['engineer'], ['cargo'], ['pilot', 'engineer'], ['pilot', 'cargo'], ['engineer', 'cargo'], ['pilot', 'engineer', 'cargo']];

test('the contract: the Hauler\'s supply run, the shipping clerk\'s, with three jobs: Pilot, Engineer and Loader', () => {
  assert.equal(S.ship, 'hauler'); assert.equal(S.desk, 'cargo'); assert.equal(S.payAt, 'cargo'); assert.equal(S.by, 'Gus'); assert.equal(S.place, 'oldstation');
  assert.deepEqual(S.roles, ['pilot', 'engineer', 'cargo']);
  const R = rolesOf(S);
  assert.deepEqual(R.map((r) => [r.name, r.share, r.open]), [['Pilot', 10, true], ['Engineer', 20, true], ['Loader', 20, true]]);
  assert.match(R[2].does, /working out and loading the supplies/);
  assert.equal(shareOf(S.roles), 50);
  // (every job has a crew member of the Hauler's own for when it is left to them; nobody of another ship's crew)
  for (const r of R) assert.match(r.crew, /^(Pilot Remy|Engineer Sol|Loader Hob)$/);
  // (nobody walks the station with it: it is no captain's)
  assert.equal(missionOf('gus'), S); for (const id of ['ruiz', 'hale', 'vega']) assert.notEqual(missionOf(id), S);
  // (its words say what the old station asked for, and where it is paid)
  assert.match(S.about, /fuel cells, food and spare parts/); assert.match(S.paid, /shipping computer/);
  assert.ok(!/hangar/i.test(S.about + S.paid));
});

test('offered only once the old station has been found, by the exploring run that follows the call for help', () => {
  assert.equal(stationFound(null), false); assert.equal(stationFound({ id: 'a' }), false); assert.equal(stationFound({ explored: { runs: 3, worlds: ['Ora'] } }), false);
  assert.equal(stationFound({ explored: 'yes' }), false);
  // (kept by the exploring run's own keepFind, read as its foundOf reads it)
  const c = { id: 'a' }; keepFind(c, { scenario: 'distress', places: 2, legs: [{}, {}], find: { what: 'x' } });
  assert.equal(foundOf(c).distress, true); assert.equal(stationFound(c), true);
  const d = { id: 'b' }; keepFind(d, { scenario: 'field', places: 1, legs: [{}], find: { what: 'x' } });
  assert.equal(stationFound(d), false);
});

test('any one job alone, any two, or all three can be signed for; the run is kept with the crew member', () => {
  for (const mine of sets) {
    const c = found(), m = sign(c, 'supply', mine, 1000, () => 0, () => 0.5);
    assert.ok(m, mine.join('+')); assert.deepEqual(m.roles, S.roles.filter((r) => mine.includes(r)));
    assert.equal(contractOf(c), m); assert.equal(m.state, 'signed');
    // (the core's tuning out at the old station, for its engineer: on arrival or before the jump home)
    assert.equal(tuneWhen(c), mine.includes('engineer') ? 'arrive' : null);
    const st = stepsFor(S, m.roles, tuneWhen(c)).map((s) => s.id + (s.mine ? '*' : ''));
    const p = mine.includes('pilot') ? '*' : '';
    assert.deepEqual(st, mine.includes('engineer') ? ['out', 'jumpOut' + p, 'core*', 'site' + p, 'jumpHome' + p, 'home'] : ['out', 'jumpOut' + p, 'site' + p, 'jumpHome' + p, 'home']);
    assert.equal(openRoles(S, mine).length, mine.length);
  }
  // (before the jump home, too)
  const c = found(); sign(c, 'supply', ['engineer'], 0, () => 0.999);
  assert.deepEqual(stepsFor(S, ['engineer'], tuneWhen(c)).map((s) => s.id), ['out', 'jumpOut', 'site', 'core', 'jumpHome', 'home']);
});

test('aboard: the Hauler\'s first mate, who leads the run, and one of its crew for the first job left', () => {
  const lead = { id: S.lead.id, name: S.lead.name, look: S.lead.look };
  for (const mine of sets) {
    const A = aboardOf(S, mine, lead), left = S.roles.filter((r) => !mine.includes(r));
    assert.equal(A.length, 2); assert.equal(A[0].name, 'First mate Tully'); assert.equal(A[0].captain, true);
    // (she walks no station: aboard by her own look, not a station person's id)
    assert.equal(typeof A[0].look, 'object'); assert.ok(A[0].look.suit);
    assert.deepEqual([...A[0].jobs, ...A[1].jobs].sort(), [...left].sort());
    if (left.length) assert.deepEqual(A[1].jobs, [left[0]]);
    const who = crewFor(S, mine, 'Maya', lead.name);
    assert.deepEqual(who.filter((w) => w.you).map((w) => w.role), S.roles.filter((r) => mine.includes(r)));
  }
  assert.ok(S.folk.some((f) => /Tully/.test(f.name)) && S.folk.length === 4);
});

test('the cargo run begins with the contract: the Loader\'s own, or Cargo\'s crew\'s, worked out and loading', () => {
  const mk = () => { const c = found(), saved = []; return { c, R: makeSupplyRun({ crew: () => c, save: () => saved.push(1), forklift: { stock: null, doors: null } }), saved }; };
  // signed as the Loader: a run, its questions and its pallets theirs
  { const { c, R } = mk(), r = R.contract(true);
    assert.ok(RUN.pallets.includes(r.pallets)); assert.equal(r.worked, false); assert.ok(!r.byCrew); assert.equal(runOf(c), r); assert.equal(R.contractRun(r.n), r);
    assert.equal(R.contractRun(r.n + 1), null);
    // (worked out at the computer, it loads itself once they have left Cargo; boarded, whatever is not in goes in)
    R.worked(); assert.equal(R.depart(r.n), true); assert.equal(r.done, true); assert.equal(r.loaded, r.pallets); assert.equal(r.flown, true);
    assert.equal(runOf(c), null); assert.equal(lastRun(c), r); }
  // not the Loader: Cargo's crew's run, worked out already, the crew member told so
  { const { c, R } = mk(), r = R.contract(false);
    assert.equal(r.worked, true); assert.equal(r.byCrew, true); assert.equal(R.handed, true); assert.match(R.line().title, /Cargo's crew/);
    assert.equal(runOf(c), r); }
  // a run already on at the computer when the contract is signed is the contract's run
  { const { c, R } = mk(), a = R.begin(), b = R.contract(true); assert.equal(a, b); assert.equal(c.jobs.cargo.runs, 1); }
  // the next contract after a run flown: a new run
  { const { R } = mk(), a = R.contract(true); R.worked(); R.depart(a.n); const b = R.contract(true); assert.notEqual(a, b); assert.equal(b.n, a.n + 1); assert.equal(b.done, false); }
});

test('the pay: so much for each pallet delivered, the share of it; the first run saves the old station, later ones haul', () => {
  assert.equal(S.perPallet, SUPPLY.perPallet); assert.ok(SUPPLY.perPallet >= 4000 && SUPPLY.perPallet % 1000 === 0);
  for (const mine of sets) for (const pallets of RUN.pallets) {
    const c = found(); sign(c, 'supply', mine);
    assert.equal(supplyRuns(c), 0);
    const P = land(c, { pallets, now: 5 });
    assert.deepEqual(P, { kind: 'supply', pallets, per: SUPPLY.perPallet, sold: pallets * SUPPLY.perPallet, share: shareOf(mine), pay: Math.round(pallets * SUPPLY.perPallet * shareOf(mine) / 100), at: 5, first: true });
    assert.ok(Number.isInteger(P.pay)); assert.equal(supplyRuns(c), 1);
    const got = collect(c); assert.equal(got.pay, P.pay); assert.equal(c.credits, 500 + P.pay); assert.equal(contractOf(c), null);
    // (again: the same contract, a hauling run; not the first any more)
    sign(c, 'supply', mine); const Q = land(c, { pallets, now: 6 }); assert.ok(!('first' in Q)); assert.equal(supplyRuns(c), 2); assert.equal(Q.pay, P.pay);
  }
  // (a run as long as a mining run pays about what one does: 3 or 4 pallets round a mining haul's 25,000 or so)
  const mean = (RUN.pallets[0] + RUN.pallets[1]) / 2 * SUPPLY.perPallet; assert.ok(mean > 20000 && mean < 30000, String(mean));
});

test('the pay slip at the shipping computer, at every level: count the pallets, pallets times so much, a part, a percent', () => {
  for (const mine of sets) for (const pallets of RUN.pallets) for (let grade = 0; grade <= 80; grade += 4) {
    const c = found(); sign(c, 'supply', mine); land(c, { pallets });
    const m = contractOf(c), o = payoutOrder(m, grade, () => 0.37), form = payoutForm(grade);
    assert.equal(o.form, form); assert.equal(o.payout, m.payout.pay);
    const good = o.coins.filter((k) => k.good); assert.equal(good.length, 1, `${mine} ${pallets} ${grade}: one right answer`);
    assert.equal(good[0].v, form === 'count' ? pallets : form === 'add' ? m.payout.sold : m.payout.pay);
    assert.equal(new Set(o.coins.map((k) => k.v)).size, o.coins.length); assert.ok(o.coins.length >= 3);
    for (const k of o.coins) if (!k.good) assert.ok(k.why && k.why.length > 8);
    const words = [o.story, o.ask, o.rightWhy, ...o.coins.map((k) => k.why || ''), ...o.lines.flat()].join(' ');
    assert.ok(!/haul sold|tonne|canister|people from the pods|places? nobody|rescue/i.test(words), words);
    if (form === 'count' || form === 'add') assert.match(words, /pallet/);
  }
  const c = found(); sign(c, 'supply', ['pilot']); land(c, { pallets: 4 });
  assert.deepEqual(payoutLines(contractOf(c).payout), [['Delivered', '4 pallets'], ['Each pallet', `${SUPPLY.perPallet.toLocaleString('en-US')} credits`], ['The run paid', `${(4 * SUPPLY.perPallet).toLocaleString('en-US')} credits`], ['Your share', '10%'], ['Your pay', `${(4 * SUPPLY.perPallet / 10).toLocaleString('en-US')} credits`]]);
  // (its picture to count: a pallet each)
  assert.match(read('../src/jobs/pics.js'), /\n  pallets\(\{ n \}\) \{/);
});

test('the Hauler flies by the one shared flying from its own facts: docked at the bridge\'s end, no hangar of its own', () => {
  // (the hangars' ships are as they were; the Hauler is not parked among them)
  assert.deepEqual(F.SHIPS.map((s) => s.id), ['miner', 'explorer', 'medic']); assert.deepEqual(F.SHIP_IDS, ['miner', 'explorer', 'medic']);
  assert.deepEqual(F.DOCKED.map((s) => s.id), ['hauler']);
  for (const id of F.SHIP_IDS) assert.ok(!F.othersOf(id).some((o) => o.id === 'hauler'), id + ' meets no Hauler in a hangar');
  const H = F.shipOf('hauler'), cfg = F.flightOf('hauler');
  assert.equal(cfg, F.flightOf('hauler')); assert.equal(cfg.name, 'Hauler'); assert.equal(cfg.bay, null); assert.equal(cfg.floor, null); assert.deepEqual(cfg.others, []); assert.equal(cfg.room, null);
  // ITS DOCK, from the station file's own outer docking port: out along the bridge (kit/dockbridge.js: 9 rings of 0.9 m
  // from 0.34 m, a 0.28 m gap) to its clamp frames' posts (2.72 m out from its middle), its crew door (3.23 m ahead of
  // its middle) on the bridge's line, its deck (1.05 m) at the bridge's (0.47 m)
  const port = STATION.rooms.flatMap((r) => r.pieces || []).find((p) => p.piece === 'airlock' && p.variant === 'outer');
  assert.ok(port && port.turn === 1, 'the outer port faces west');
  const CELL = 2, SKIN = 0.25, out = 0.34 + 9 * 0.9 + 0.28 + 2.72;
  const want = [port.cell[0] * CELL - SKIN - out, 0.47 - 1.05, port.cell[1] * CELL - 3.23];
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(cfg.pad[i] - want[i]) < 0.005, `its docked place ${cfg.pad} is the port's ${want.map((v) => +v.toFixed(3))}`);
  assert.deepEqual(H.dock.nose, [0, 0, 1]); assert.deepEqual(H.dock.away, [-1, 0, 0]);
  // (clear of the station's own box: nothing of it reaches in)
  assert.ok(cfg.pad[0] + 2.75 < OUTSIDE_BOX.min[0] + 0.1);
  // turned as it lies: its nose along the station's side, its port side to the station
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(near(M.turn(cfg.q0, [1, 0, 0]), [0, 0, 1])); assert.ok(near(M.turn(cfg.q0, [0, 0, -1]), [1, 0, 0]), 'its port (the flight model\'s left) toward the station');
  assert.ok(near(M.parkedNose(cfg), [0, 0, 1]));
  // THE PILOT'S EYES: over the middle of his deck plan's pilot's seat, 1.27 m over the cockpit's floor
  const bp = JSON.parse(read('../kit/ships/hauler-his-plan.blueprint.json')), space = JSON.parse(read('../assets/ships/' + bp.shell + '.space.json'));
  const seat = bp.items.find((it) => it.room === 'cockpit' && it.kind === 'seat' && /pilot/i.test(it.name) && !/co-?pilot/i.test(it.name)), room = bp.rooms.find((r) => r.id === 'cockpit');
  assert.ok(Math.abs(cfg.seat.eye[0] - (seat.rect[0] + seat.rect[2]) / 2) < 0.01 && Math.abs(cfg.seat.eye[2] - (seat.rect[1] + seat.rect[3]) / 2) < 0.02);
  assert.ok(Math.abs(cfg.seat.eye[1] - (space.deck + room.floor + 1.27)) < 0.005);
  assert.ok(cfg.seat.look[2] > cfg.seat.eye[2] + 7 && cfg.dash.at[2] > cfg.seat.eye[2] + 0.5 && cfg.dash.at[2] < room.rect[3]);
  // its shape: as long, wide and tall as it waits at the dock (src/haulerdock.js SIZE)
  assert.match(read('../src/haulerdock.js'), /export const SIZE = \{ x: \[-2\.75, 2\.75\], y: \[0\.4, 4\.4\], z: \[-8\.05, 8\.0\] \};/);
  assert.deepEqual(H.boxes, [{ a: [-8.05, 8.0], r: 2.75, h: 4.4 }]); assert.equal(cfg.points.length, 24);
  // (its line in the boarding's ships says how it is flown: its main engines; and it is flown only on a contract)
  assert.match(read('../src/boarding.js'), /export const DOCKED_SHIP = \{ id: 'hauler', dock: true, [^\n]*flight: flight\(HB\), ways: \[\] \};/);
});

test('docking is the same flight model: it leaves its dock, comes back to it and is taken exactly onto its place', () => {
  const cfg = F.flightOf('hauler'), S0 = M.makeShip(cfg);
  assert.equal(S0.landed, true); assert.equal(M.onPad(S0), true); assert.equal(M.standing(S0), 'pad'); assert.equal(M.canGetUp(S0), true); assert.equal(M.floorUnder(S0), null);
  const run = (S, plan, most) => { let t = 0; while (t < most) { const C = M.fly(S, plan, DT); if (!C) break; M.stepShip(S, C, DT); t += DT; if (plan.goalLanded && S.landed) break; } return t; };
  // THE AUTOPILOT AWAY: straight out from the station's side first, turned as it lay, then clear of the station
  S0.power = true;
  const leave = M.planLeave(S0), first = leave[0];
  assert.ok(first.to[0] < cfg.pad[0] - 30 && Math.abs(first.to[2] - cfg.pad[2]) < 1e-9 && first.face[2] === 1, 'backs straight off the bridge');
  let minX = Infinity, turned = 0; { let t = 0; const plan = leave; while (t < 120) { const C = M.fly(S0, plan, DT); if (!C) break; M.stepShip(S0, C, DT); t += DT; if (S0.p[0] > cfg.pad[0] - 20) turned = Math.max(turned, Math.abs(M.turn(S0.q, [1, 0, 0])[0])); minX = Math.min(minX, S0.p[0]); } assert.ok(t < 60, 'clear in under a minute: ' + t.toFixed(1)); }
  assert.equal(S0.landed, false); assert.ok(M.clearOf(S0.p), 'clear of the station'); assert.ok(turned < 0.05, 'not turned while it is still beside the bridge');
  // HOME: out of the jump on its own side of the station, round to the bridge's line, in, and docked exactly
  const A = M.arrival(cfg); assert.ok(A.p[0] < cfg.pad[0] - 250 && M.clearOf(A.p));
  M.place(S0, A.p, A.q);
  const plan = M.planLand(S0); assert.deepEqual(plan[plan.length - 1], { down: true });
  { let t = 0; while (t < 180 && !S0.landed) { const C = M.fly(S0, plan, DT) || M.noControls(); M.stepShip(S0, C, DT); t += DT; } assert.ok(S0.landed, 'docked by the autopilot in ' + t.toFixed(1) + ' s'); }
  assert.deepEqual(S0.p, cfg.pad); assert.deepEqual(S0.q, cfg.q0); assert.equal(M.onPad(S0), true); assert.equal(S0.justLanded, true);
  // from anywhere round the station: never through it, always docked
  for (const from of [[200, 40, 27], [20, 150, -80], [-60, -40, 160]]) {
    M.place(S0, from, M.facing([1, 0, 0])); const p2 = M.planLand(S0); let t = 0;
    while (t < 240 && !S0.landed) { const C = M.fly(S0, p2, DT) || M.noControls(); M.stepShip(S0, C, DT); t += DT; assert.ok(M.boxDist(S0.p) > 0 || S0.p[0] < OUTSIDE_BOX.min[0], 'outside the station\'s box'); }
    assert.ok(S0.landed && M.onPad(S0), `docked from ${from} in ${t.toFixed(0)} s`);
  }
  // A PILOT'S OWN DOCKING: close beside the dock, slow, nearly turned as it lies: the dock takes it, exactly
  M.place(S0, [cfg.pad[0] - 2.0, cfg.pad[1] + 0.5, cfg.pad[2] + 0.8], M.facing([0.1, 0, 1]));
  { let t = 0; while (t < 20 && !S0.landed) { M.stepShip(S0, M.noControls(), DT); t += DT; } assert.ok(S0.landed && M.onPad(S0), 'taken and docked in ' + t.toFixed(1) + ' s'); }
  // ... not from too far, too fast, or turned away
  M.place(S0, [cfg.pad[0] - (M.DOCKING.grab + 1.5), cfg.pad[1], cfg.pad[2]], cfg.q0); for (let i = 0; i < 90; i++) M.stepShip(S0, M.noControls(), DT); assert.ok(!S0.landed && !S0.settle, 'too far');
  M.place(S0, [cfg.pad[0] - 2, cfg.pad[1], cfg.pad[2]], M.facing([1, 0, 0])); for (let i = 0; i < 90; i++) M.stepShip(S0, M.noControls(), DT); assert.ok(!S0.landed && !S0.settle, 'turned a quarter round');
  M.place(S0, [cfg.pad[0] - 2, cfg.pad[1], cfg.pad[2] - 4], cfg.q0); S0.v = [0, 0, 6]; M.stepShip(S0, { ...M.noControls(), move: [1, 0, 0] }, DT); assert.ok(!S0.settle, 'too fast');
  // ... and a ship that has just undocked is not taken again until it has been away
  M.park(S0); S0.power = true; S0.engine = 0.15;
  for (let i = 0; i < 40; i++) M.stepShip(S0, { ...M.noControls(), move: [0, 1, 0] }, DT);
  assert.equal(S0.landed, false); assert.equal(S0.undocked, true);
  for (let i = 0; i < 180; i++) M.stepShip(S0, M.noControls(), DT);
  assert.ok(!S0.landed && !S0.settle, 'left alone beside its dock');
  // the guide asks toward the dock as toward a pad: its place, and turned as it lies there once near
  M.place(S0, [cfg.pad[0] - 6, cfg.pad[1], cfg.pad[2]], cfg.q0);
  const g = M.guideOf(S0); assert.ok(g.near && g.keys.left > 0 && g.keys.right === 0 && g.keys.forward === 0, 'the dock is to its port side: ' + JSON.stringify(g.keys));
  // the words for a ship that docks
  assert.ok(M.helpFor('seat', { dock: true }).some(([k, w]) => w === 'Undock') && !M.helpFor('seat', { dock: true }).some(([, w]) => /Lift off/.test(w)));
  assert.ok(M.helpFor('seat', {}).some(([, w]) => w === 'Lift off'));
});

test('a far dock, the old station\'s own bridge: the same docking with the dock moved there; clear is well out from it', () => {
  // (their port faces as ours does, so the Hauler lies at their bridge as at ours, moved over)
  assert.deepEqual(BRIDGE.out, [-1, 0, 0]); assert.deepEqual(BRIDGE.across, [0, 0, 1]);
  const home = F.flightOf('hauler'), port = STATION.rooms.flatMap((r) => r.pieces || []).find((p) => p.piece === 'airlock' && p.variant === 'outer');
  const here = [BRIDGE.at[0] - (port.cell[0] * 2 - 0.25), 0, BRIDGE.at[2] - port.cell[1] * 2];
  const cfg = { ...home, pad: home.pad.map((v, i) => v + here[i]), bay: null, floor: null, others: null, far: 170 };
  const S1 = M.makeFieldShip([cfg.pad[0] - 230, cfg.pad[1] + 24, cfg.pad[2] - 60], [1, 0, 0.25], cfg);
  const plan = M.planLand(S1); let t = 0;
  while (t < 180 && !S1.landed) { const C = M.fly(S1, plan, DT) || M.noControls(); M.stepShip(S1, C, DT); t += DT; }
  assert.ok(S1.landed && M.onPad(S1), 'docked at their bridge in ' + t.toFixed(0) + ' s'); assert.deepEqual(S1.p, cfg.pad);
  const away = M.planLeave(S1); t = 0;
  while (t < 120) { const C = M.fly(S1, away, DT); if (!C) break; M.stepShip(S1, C, DT); t += DT; }
  assert.ok(M.dockOff(S1).dist > 150, 'clear of their bridge: ' + M.dockOff(S1).dist.toFixed(0) + ' m');
});

test('the words: its first mate\'s for every moment of the run; the old station\'s people name what was brought', () => {
  const T = RUN_TALK.supply;
  for (const k of ['tune', 'tuned', 'tunedFree', 'backJump', 'backDock', 'backAway', 'letGo', 'out', 'crewOut', 'there', 'thereAgain', 'dock', 'dockCrew', 'docked', 'dockedAgain', 'done', 'away', 'awayCrew', 'clear', 'clearCrew', 'home', 'homeCrew', 'landed', 'landedCrew']) {
    assert.ok(Array.isArray(T[k]) && T[k].length && T[k].every((w) => typeof w === 'string' && w.length > 8 && w.length <= 110), k);
  }
  // (a dock, not a hangar: nothing of bay doors or pads)
  assert.ok(!/bay door|hangar|\bpad\b|rocks|wreck|planet/i.test(Object.values(T).flat().join(' ')));
  assert.match(T.landed.join(' '), /shipping computer/);
  const first = OLD_STATION.first.map((l) => l.w).join(' ');
  assert.match(first, /Fuel cells/); assert.match(first, /food/i); assert.match(first, /Spare parts/i); assert.match(first, /Thank you/);
  assert.equal(OLD_STATION.first.filter((l) => l.lights).length, 1, 'one line is the lights coming up');
  assert.ok(OLD_STATION.first.findIndex((l) => l.lights) > OLD_STATION.first.findIndex((l) => /Fuel cells/.test(l.w)), 'the lights after the fuel cells');
  for (const l of [...OLD_STATION.first, ...OLD_STATION.again]) { assert.ok([0, 1, 2].includes(l.who) && l.w.length <= 100); }
  // (the old station has no name yet, nor its people: none is given)
  assert.ok(!/station [A-Z][a-z]+\b/.test(first));
  // the station's news of it, and its people's talk
  assert.ok(TALKS.some((t) => t.news === 'supply'));
  assert.match(read('../src/announce.js'), /n\.kind !== 'find' && n\.kind !== 'supply' && n\.kind !== 'call'/);
  // (and where the run begins is said once, as the Explorer comes home with the find: a text line, nobody's talk)
  assert.match(read('../src/trip.js'), /plan\.scenario === 'distress'\) news\.add\(\{ kind: 'call', ship: 'Hauler', text: 'A word from Cargo\. Gus at the shipping desk/);
  assert.ok(!TALKS.some((t) => t.news === 'call'));
  // (both are said by the station's own text line, each once)
  const found = lineOf('found'), told = new Set();
  assert.deepEqual(found.say({ news: [{ kind: 'haul', id: 'haul:1' }, { kind: 'call', text: 'A word from Cargo.', id: 'call:2' }], told }), { text: 'A word from Cargo.', news: 'call:2' });
  assert.deepEqual(found.say({ news: [{ kind: 'supply', text: 'News from the Hauler.', id: 'supply:3' }], told }), { text: 'News from the Hauler.', news: 'supply:3' });
  assert.equal(found.say({ news: [{ kind: 'call', text: 'A word from Cargo.', id: 'call:2' }], told: new Set(['call:2']) }), null);
  // no browser speech anywhere in the run's own files
  for (const f of ['../src/oldstationsite.js', '../src/trip.js', '../src/mission.js', '../src/supplyrun.js']) assert.ok(!/speechSynthesis|SpeechSynthesisUtterance/.test(read(f)), f);
});

test('the old station\'s rooms: its dock airlock, the very port ours is, and a hall behind it; its own file, no saved light', () => {
  assert.deepEqual(OLD.rooms.map((r) => r.id), ['old-airlock', 'old-hall']);
  assert.ok(!('bake' in OLD), 'no saved light of its own: worked out as it is built');
  assert.equal(STATION.bake, 'station.bake');
  const ours = STATION.rooms.find((r) => r.id === 'airlock').pieces, theirs = OLD.rooms[0].pieces;
  for (const v of ['outer', 'inner']) { const a = ours.find((p) => p.piece === 'airlock' && p.variant === v), b = theirs.find((p) => p.piece === 'airlock' && p.variant === v); assert.deepEqual(b, a, 'the ' + v + ' door where ours is'); }
  // (nothing there that names our dock or needs power)
  assert.ok(!theirs.some((p) => p.piece === 'label' || p.piece === 'screen'));
  // every piece and variant is one the kit has
  const CAT = read('../kit/catalog.js');
  for (const p of OLD.rooms.flatMap((r) => r.pieces)) {
    const m = CAT.match(new RegExp('\\n  ' + p.piece + ': \\{[^\\n]*')); assert.ok(m, 'the kit has ' + p.piece);
    if (p.variant) assert.ok(m[0].includes(`'${p.variant}'`), `${p.piece}: ${p.variant}`);
  }
  // the hall: 4 by 4 cells, floored and ceiled, four ceiling lights to come back up, open to the airlock's inner end
  const hall = OLD.rooms[1].pieces, cells = (k) => hall.filter((p) => p.piece === k);
  assert.equal(cells('floor').length, 16); assert.equal(cells('ceiling').length, 16); assert.equal(cells('ceiling').filter((p) => p.variant === 'light').length, 4);
  assert.ok(!hall.some((p) => p.piece === 'wall' && p.cell[0] === -4.5 && (p.cell[1] === 15 || p.cell[1] === 16)), 'open to the airlock');
  // its people's places in the hall, on its floor, and where the crew member is met
  assert.equal(OLD.places.people.length, 3);
  for (const s of OLD.places.people) assert.ok(s.at[0] > -9 && s.at[0] < -1 && s.at[2] > 27 && s.at[2] < 35);
  // outside: once saved most of its windows are lit; with its real airlock built, no plain stand-in behind the port
  const dark = oldStationPlans({ seed: 7 }), lit = oldStationPlans({ seed: 7, lit: LIT_SAVED });
  assert.equal(dark[0].windows.lit, LIT.hull); assert.equal(lit[0].windows.lit, LIT_SAVED.hull); assert.ok(LIT_SAVED.hull > LIT.hull * 3 && LIT_SAVED.tower > LIT.tower * 2);
  assert.ok(oldStationGear({ inside: true }).lit.triangles < oldStationGear().lit.triangles);
  assert.equal(oldStationGear().lit.triangles, oldStationGear({ inside: false }).lit.triangles);
});
