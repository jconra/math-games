// Captain Vega's exploring run (src/missions.js 'explore'; its plan src/exploreplan.js; each place src/explore.js): his
// contract and its three jobs, the run's scenario and places from its seed (more or fewer jumps, a lead at each, the
// finding at the end), the station in distress only once the radio tower is repaired, the steps for each job, so much
// for each place explored and the payout card at the survey table at every level, the survey table found in the
// Explorer's own blueprint, his words for every moment, the jump computer's cards told of the lead, and his crew in
// their own clothes.
//   node --test pi-nebula/tests/explore.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../src/jobs/engine.js';
import * as MS from '../src/missions.js';
import { missions, ROLES, MISSIONS, CORE } from '../src/missions.js';
import { planOf, SCENARIOS, SCENARIO_IDS, WORLD_NAMES, antennaUp, foundOf, keepFind, EXPLORE, TOWER_LINE, findNews } from '../src/exploreplan.js';
import { ANNOUNCE, makeAnnouncer, newsClip } from '../src/announce.js';
import { TALKS } from '../src/lines.js';
import { JOB as pilot } from '../src/jobs/pilot.js';
import { JOB as survey } from '../src/jobs/survey.js';
import { helpPicture } from '../src/jobs/pics.js';
import { CAPTAINS, RUN_TALK } from '../src/lines.js';
import { CREWS, crewRecipe } from '../kit/positions.js';
import { kindOf } from '../src/planet/kinds.js';

const X = MISSIONS.explore;
const crewOf = () => ({ id: 'c1', name: 'Maya', look: { id: 'zuri' } });
const num = (label) => { const s = String(label).replace(/,/g, ''), m = s.match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : NaN; };
const rightOf = (o) => num(o.coins.find((c) => c.good).label);
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const SEEDS = Array.from({ length: 400 }, (_, i) => 1 + i * 2477);

test('his run is data: Captain Vega, the Explorer; Pilot 10%, Sensor operator 20%, Engineer 20%, all three his to sign; paid at the survey table', () => {
  assert.equal(X.captain, 'vega'); assert.equal(X.ship, 'explorer'); assert.equal(X.place, 'explore'); assert.equal(X.payAt, 'survey');
  assert.deepEqual(X.roles, ['pilot', 'sensor', 'engineer']);
  assert.deepEqual(X.roles.map((id) => ROLES[id].share), [10, 20, 20]);
  assert.deepEqual(MS.rolesOf(X).map((r) => [r.id, r.open]), [['pilot', true], ['sensor', true], ['engineer', true]]);
  assert.equal(ROLES.sensor.name, 'Sensor operator');
  assert.equal(missions.ready('vega'), true); assert.equal(MS.missionOf('vega'), X); assert.equal(CAPTAINS.vega.mission, 'exploring');
  // (his words for the contract, as it is signed, and home with the share waiting; his offer's own recorded clips kept)
  for (const k of ['contract', 'signed', 'payout']) assert.ok(typeof CAPTAINS.vega[k] === 'string' && CAPTAINS.vega[k].length < 100, k);
  assert.match(CAPTAINS.vega.signed, /Explorer/); assert.match(CAPTAINS.vega.payout, /survey table/); assert.equal(CAPTAINS.vega.offer.clip, 'vega-pitch');
  assert.match(X.paid, /survey table/);
  // each job alone, or with the others
  for (const mine of [['pilot'], ['sensor'], ['engineer'], ['pilot', 'sensor'], ['sensor', 'engineer'], ['pilot', 'sensor', 'engineer']]) {
    const c = crewOf(), m = MS.sign(c, 'explore', mine, 1, () => 0, () => 0.5);
    assert.deepEqual(m.roles, mine); assert.ok(m.seed > 0, 'a seed for the run'); assert.equal(MS.seedOf(c), m.seed);
    assert.equal(m.tune, mine.includes('engineer') ? 'arrive' : undefined);
  }
});

test('the run\'s plan from its seed: one of his scenarios by chance, 1 to 3 jumps out, a lead at each place, the finding at the last', () => {
  const by = {}, legs = new Set();
  for (const s of SEEDS) {
    const P = planOf(s), S = SCENARIOS[P.scenario];
    assert.deepEqual(planOf(s), P, 'the same seed, the same run');
    assert.ok(['world', 'wreck', 'field', 'artifact'].includes(P.scenario), 'by chance: never the distress call without the radio tower');
    assert.ok(P.places >= S.legs[0] && P.places <= S.legs[1] && P.places >= 1 && P.places <= 3, P.scenario + ' ' + P.places);
    assert.equal(P.legs.length, P.places); legs.add(P.places);
    by[P.scenario] = (by[P.scenario] || 0) + 1;
    P.legs.forEach((L, i) => {
      assert.equal(L.last, i === P.places - 1); assert.equal(L.lead, S.noun); assert.ok(L.place.seed > 0);
      if (!L.last) { assert.equal(L.place.where, 'land', 'every place on the way is above land: its scan is of the land below'); assert.equal(L.place.show, null); }
      if (L.place.where === 'land') assert.equal(kindOf(L.place.seed).id, L.place.kind, 'its seed makes the kind of planet asked for');
    });
    const end = P.legs[P.places - 1].place;
    if (P.scenario === 'world') { assert.equal(end.kind, 'meadow'); assert.ok(WORLD_NAMES.includes(P.name)); }
    if (P.scenario === 'wreck') assert.equal(end.show, 'wreck');
    if (P.scenario === 'artifact') assert.equal(end.show, 'artifact');
    if (P.scenario === 'field') { assert.equal(end.where, 'space'); assert.equal(end.show, 'field'); }
  }
  // (each of the four comes up, and runs of one, two and three jumps)
  for (const id of ['world', 'wreck', 'field', 'artifact']) assert.ok(by[id] > 60, id + ' ' + by[id]);
  assert.deepEqual([...legs].sort(), [1, 2, 3]);
});

test('the station in distress: only once the radio tower is repaired, on the next run, and never again; the one flag read defensively', () => {
  // (the radio tower's own job keeps it with the crew member: crew.jobs.antenna.repaired, src/jobs/antenna.js)
  assert.equal(antennaUp(null), false); assert.equal(antennaUp({}), false); assert.equal(antennaUp({ jobs: {} }), false); assert.equal(antennaUp({ jobs: { antenna: { built: 3 } } }), false);
  assert.equal(antennaUp({ jobs: { antenna: { repaired: false } } }), false); assert.equal(antennaUp({ jobs: { antenna: 'yes' } }), false);
  assert.equal(antennaUp({ jobs: { antenna: { repaired: true, built: 8 } } }), true);
  for (const s of SEEDS.slice(0, 40)) {
    const P = planOf(s, { antenna: true });
    assert.equal(P.scenario, 'distress'); assert.equal(P.places, 2);
    assert.equal(P.legs[0].place.where, 'land'); assert.equal(P.legs[1].place.show, 'station'); assert.equal(P.legs[1].scan, false, 'nothing to scan at the station: the finding alone');
    assert.ok(P.talk.radio.length >= 2, 'its people talk by radio'); assert.deepEqual(P.talk.tower, [], 'the tower repaired: nothing said of it');
    // (heard once: found, the next run is by chance again)
    const c = crewOf(); c.jobs = { antenna: { repaired: true } }; keepFind(c, P);
    assert.equal(foundOf(c).distress, true); assert.notEqual(planOf(s, { antenna: true, found: foundOf(c) }).scenario, 'distress');
  }
  // (the tower not repaired: he says that with it they might hear more, at the finding)
  assert.deepEqual(planOf(5).talk.tower, [TOWER_LINE]); assert.match(TOWER_LINE, /radio tower/);
});

test('a new world\'s name: one of the six the speakers can say, not given twice while any is left', () => {
  const c = crewOf(), names = [];
  for (const s of SEEDS) { const P = planOf(s, { found: foundOf(c) }); if (P.scenario !== 'world') continue; names.push(P.name); keepFind(c, P); if (names.length >= 6) break; }
  assert.equal(new Set(names).size, 6, names.join()); assert.deepEqual(new Set(foundOf(c).worlds), new Set(WORLD_NAMES));
  assert.ok(foundOf(c).runs >= 6);
});

test('the steps: the jump and the scan for each place, in turn; the core\'s tuning on arrival or before the jump home; each job its own', () => {
  for (const s of SEEDS.slice(0, 60)) {
    const P = planOf(s), n = P.places;
    for (const [mine, when] of [[['pilot', 'sensor', 'engineer'], 'arrive'], [['pilot', 'sensor', 'engineer'], 'leave'], [['pilot'], null], [['sensor'], null], [['engineer'], 'arrive']]) {
      const st = MS.stepsFor(X, mine, when, P), ids = st.map((x) => x.id);
      assert.equal(st.filter((x) => x.kind === 'jump' && x.to !== 'home').length, n); assert.equal(st.filter((x) => x.kind === 'scan').length, n);
      assert.equal(ids[0], 'out'); assert.equal(ids[ids.length - 1], 'home'); assert.equal(ids[ids.length - 2], 'jumpHome');
      for (let i = 0; i < n; i++) { const j = ids.indexOf(i ? 'jumpOut' + (i + 1) : 'jumpOut'), k = ids.indexOf(i ? 'scan' + (i + 1) : 'scan'); assert.ok(j > 0 && k > j, 'a place\'s scan after its jump'); assert.equal(st[k].leg, i); assert.equal(st[j].leg, i); }
      for (const x of st) if (x.kind === 'jump') assert.equal(x.mine, mine.includes('pilot')); else if (x.kind === 'scan') assert.equal(x.mine, mine.includes('sensor'));
      const core = ids.indexOf('core');
      if (!when) assert.equal(core, -1); else if (when === 'arrive') assert.equal(ids[core - 1], 'jumpOut'); else assert.equal(ids[core + 1], 'jumpHome');
    }
  }
  // (any other mission, or no plan: its steps as they are)
  assert.deepEqual(MS.stepsFor(MISSIONS.mining, ['pilot'], null, planOf(3)).map((x) => x.id), ['out', 'jumpOut', 'field', 'jumpHome', 'home']);
  assert.deepEqual(MS.legSteps(X, null), X.steps);
});

test('the pay: so much for what it finds and so much more for each place explored, the same on every run; each share a whole number of credits', () => {
  assert.equal(X.perPlace, EXPLORE.perPlace); assert.equal(X.findPays, EXPLORE.find); assert.ok(EXPLORE.perPlace % 1000 === 0 && EXPLORE.find % 1000 === 0);
  for (const places of [1, 2, 3]) for (const roles of [['pilot'], ['sensor'], ['engineer'], ['pilot', 'sensor', 'engineer']]) {
    const c = crewOf(); MS.sign(c, 'explore', roles, 1, () => 0, () => 0.3);
    const P = MS.land(c, { places, find: 'world' });
    assert.equal(P.kind, 'explore'); assert.equal(P.places, places); assert.equal(P.sold, EXPLORE.find + places * EXPLORE.perPlace); assert.equal(P.base, EXPLORE.find);
    assert.equal(P.pay, P.sold * MS.shareOf(roles) / 100); assert.ok(Number.isInteger(P.pay)); assert.equal(P.find, 'world');
    const r = MS.collect(c); assert.equal(r.pay, P.pay); assert.equal(c.mission, undefined);
  }
});

test('the payout card at the survey table: count the places, so many at so much each, a part, a percent; the pay with the right answer at every level', () => {
  E.register(survey);
  const forms = new Set();
  for (const places of [1, 2, 3]) for (const roles of [['pilot'], ['sensor'], ['pilot', 'sensor', 'engineer']]) for (const grade of [0, 10, 26, 40, 50, 66, 78]) {
    const c = crewOf(); MS.sign(c, 'explore', roles, 1, () => 0, () => 0.3); MS.land(c, { places });
    const m = MS.contractOf(c), o = MS.payoutOrder(m, grade, seq(0.1, 0.5, 0.9));
    forms.add(o.form); assert.equal(o.payout, m.payout.pay);
    assert.equal(o.coins.filter((x) => x.good).length, 1); assert.ok(o.coins.length >= 3, 'at least three to pick from');
    assert.equal(new Set(o.coins.map((x) => x.label)).size, o.coins.length, 'no answer twice');
    for (const x of o.coins) { assert.ok(num(x.label) > 0, 'nothing of none: ' + x.label); if (!x.good) assert.ok(x.why && x.why.length > 10); }
    const v = rightOf(o);
    if (o.form === 'count') { assert.equal(v, places); assert.match(o.ask, /places/); assert.ok(helpPicture(o).svg.includes('ellipse'), 'a planet to count for each'); }
    else if (o.form === 'add') { assert.equal(v, m.payout.sold); assert.match(o.story, /for what it found, and .* more for each place explored/); assert.deepEqual(o.sum.chain.map((x) => x.op), ['mul', 'add']); }
    else assert.equal(v, m.payout.pay);
    const txt = [o.story, o.ask, o.rightWhy, JSON.stringify(o.lines)].join(' ');
    for (const w of ['haul', 'tonne', 'canister', 'rescue', 'people', 'person']) assert.ok(!new RegExp('\\b' + w + '\\b', 'i').test(txt), w + ': ' + txt);
  }
  assert.deepEqual([...forms].sort(), ['add', 'count', 'part', 'percent']);
  // (the rescue's card, sharing the same order, says what it said: people)
  const c = crewOf(); MS.sign(c, 'rescue', ['pilot'], 1, () => 0, () => 0.3); MS.land(c, { people: 4 });
  const o = MS.payoutOrder(MS.contractOf(c), 0, seq(0.1, 0.5, 0.9)); assert.equal(o.ask, 'How many people did your crew bring home?'); assert.equal(rightOf(o), 4);
});

test('the survey table, in the Explorer\'s own blueprint, where its science lab has it; every ship\'s core as it was', () => {
  const bp = (id) => JSON.parse(readFileSync(new URL(`../kit/ships/${id}.blueprint.json`, import.meta.url)));
  const ex = bp('explorer-c-row'), T = MS.surveyIn(ex), item = ex.items.find((i) => i.id === T.item);
  assert.equal(T.room, 'science'); assert.equal(item.kind, 'holo');
  const far = Math.hypot(Math.max(item.rect[0] - T.stand[0], 0, T.stand[0] - item.rect[2]), Math.max(item.rect[1] - T.stand[1], 0, T.stand[1] - item.rect[3]));
  assert.ok(far >= CORE.out - 1e-9 && far < 0.8, 'before it, within reach: ' + far);
  assert.ok(Math.abs(T.look[1] - item.h) < 1e-9, 'looked at across its top');
  assert.deepEqual(MS.coreIn(ex), { room: 'engineering', item: 'reactor', floor: 0, stand: [-0.25, -4.25], look: [-1.375, 0.9, -4.25] }, 'the reactor where it was');
  assert.equal(MS.surveyIn(bp('miner-ore-cockpit')), null, 'no other ship has one');
});

test('his words along the run: every scenario has a line for every moment, short enough for a bubble; his sensor operator, or himself', () => {
  const T = RUN_TALK.explore;
  for (const k of ['tune', 'tuned', 'tunedFree', 'backJump', 'scan', 'scanned', 'home', 'homeCrew', 'landed', 'landedCrew']) assert.ok(T[k] && T[k].length, k);
  for (const id of SCENARIO_IDS) {
    const S = SCENARIOS[id], P = id === 'distress' ? planOf(9, { antenna: true }) : null;
    for (const k of ['out', 'crewOut', 'arrive', 'lead', 'there', 'found']) {
      assert.ok(Array.isArray(S[k]) && S[k].length, id + ' ' + k);
      for (const w of S[k]) assert.ok(w.length <= 140 && !/\{(?!player|sensor|pilot|name)\w+\}/.test(w), id + ' ' + k + ': ' + w);
    }
    // (each mystery answered with more questions)
    assert.ok(S.found.some((w) => w.includes('?')) || (P && P.talk.radio.some((w) => w.includes('?'))), id + ': a question at the finding');
    assert.ok(S.lead.every((w) => w.includes('?') || /Plot the jump/.test(w)), id + ': the lead asks, and points on');
  }
  assert.ok(SCENARIOS.world.found.some((w) => w.includes('{name}')), 'a new world is named');
  assert.ok(SCENARIOS.world.out.some((w) => /pull|mass/.test(w)), 'the mysterious mass');
  assert.ok(SCENARIOS.wreck.out.some((w) => /signal/.test(w)), 'the faint signal');
  assert.ok(SCENARIOS.artifact.out.some((w) => /trader|marks/.test(w)), 'the rumour');
});

test('the jump computer on his run: the Explorer, the lead it follows and his crew in every card at every level', () => {
  E.register(pilot);
  const bad = [], leads = new Set(Object.values(SCENARIOS).map((S) => S.noun));
  for (const lead of leads) for (let L = 0; L < pilot.place.levels.length; L += 2) for (let k = 0; k < 6; k++) {
    const c = crewOf(); for (let s = 0; s < L; s++) E.step(c, pilot, 1);
    const live = { lamp: ['distance', 'charge', 'go'][k % 3], to: 'lead', ship: 'Explorer', far: 'explore', folk: X.folk, lead };
    const o = E.deal(c, pilot, { live, rand: seq(((L * 7 + k * 3) % 10) / 10 + 0.05, 0.37, 0.71, 0.13) }).order;
    const txt = [o.story, o.ask, o.rightWhy, JSON.stringify(o.help || {}), typeof o.lead === 'string' ? o.lead.replace(/<[^>]*>/g, ' ') : '', ...(o.coins || []).map((x) => x.why || '')].join(' ').replace(/"kind":"field"/g, '').replace(/"to":"lead"/g, '');
    for (const w of ['Miner', 'asteroid field', 'mine', 'field', 'rocks', 'Juno', 'Ruiz', 'Kestrel', 'Okafor']) if (new RegExp('\\b' + w + '\\b').test(txt)) bad.push(w + ': ' + o.story);
  }
  assert.deepEqual(bad, []);
  assert.deepEqual(X.folk.map((f) => f.name), ['Captain Vega', 'Pilot Wren', 'Sensor operator Arlo', 'Engineer Nia']);
});

test('who is aboard: Captain Vega and one of his crew, in their own clothes (his EXPL1-3 A)', () => {
  assert.equal(CREWS.explorer.standard, false); assert.equal(CREWS.explorer.captain, 'vega');
  for (const mine of [['pilot'], ['sensor'], ['engineer'], ['pilot', 'sensor', 'engineer']]) {
    const A = MS.aboardOf(X, mine, { id: 'vega', name: 'Captain Vega' });
    assert.equal(A[0].id, 'vega'); assert.equal(A.length, 2);
    const left = X.roles.filter((r) => !mine.includes(r));
    assert.deepEqual([...A[0].jobs, ...A[1].jobs].sort(), left.sort(), 'every job left is someone\'s');
    const look = A[1].look; assert.ok(look && look.suit && look.head, 'his crew member has a look');
    assert.deepEqual(crewRecipe(look, { ship: 'explorer', position: look.position }), look, 'worn as it is: their own clothes');
  }
  const words = MS.crewFor(X, ['sensor'], 'You', 'Captain Vega').map((c) => c.role + ':' + c.name).join();
  assert.equal(words, 'pilot:Pilot Wren,sensor:You,engineer:Captain Vega');
});

test('the station\'s news of a finding: a new world by its recorded line; anything else a text line in the run\'s own words, said once, and talked of', () => {
  const by = {};
  for (const sd of SEEDS) { const P = planOf(sd); if (!by[P.scenario]) by[P.scenario] = P; }
  by.distress = planOf(9, { antenna: true });
  const W = findNews(by.world); assert.equal(W.kind, 'planet'); assert.ok(WORLD_NAMES.includes(W.planet)); assert.ok(newsClip({ ...W, id: 'planet:1' }), 'its recorded line');
  for (const id of ['wreck', 'field', 'artifact', 'distress']) {
    const N = findNews(by[id]);
    assert.equal(N.kind, 'find'); assert.equal(newsClip({ ...N, id: 'find:1' }), null, 'no recorded line says it');
    assert.match(N.text, /^News from the Explorer\. Captain Vega's crew has found .+\.$/); assert.ok(N.text.length <= 150, N.text);
    if (id === 'wreck' || id === 'artifact') assert.match(N.what, /(on a cratered moon|on a meadow world|in a canyon world)/);
  }
  assert.equal(findNews(null), null);
  // (on the speakers: the chime and its words shown, once)
  const S = { played: [], load() {}, has: () => true, length: (n) => (n.endsWith(':chime') ? ANNOUNCE.chime : 4), play(name, o) { const h = { name, v: o.volume, volume(v) { h.v = v; } }; S.played.push(h); return h; } };
  const shown = [], item = { id: 'find:3', ...findNews(by.field) };
  const A = makeAnnouncer({ sound: S, read: null, rand: seq(0.3, 0.6, 0.1, 0.8), onText: (w) => shown.push(w) });
  const facts = { playing: true, place: 'terminal', math: false, news: [item], captains: {}, scan: null, alarm: null, events: [] };
  for (let t = 0; t < 400; t += 0.1) A.update(0.1, facts);
  const L = A.log.filter((x) => x.id === 'found');
  assert.equal(L.length, 1); assert.deepEqual(L[0].clips, ['chime']); assert.equal(L[0].words, item.text); assert.deepEqual(shown, [item.text, null]);
  // (and the station's people talk of it, its words filled in)
  const T = TALKS.find((x) => x.news === 'find'); assert.ok(T && T.lines[0].includes('{what}'));
});
