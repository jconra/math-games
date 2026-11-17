// The dock's bridge job, a try (src/jobs/dock.js): its ladder joins Mathwood's levels, every level deals good questions
// (the youngest's: the squares to brace, no buttons to pick), every right answer is right, every wrong one has its why,
// help has a picture and its steps, and the sums can be worked on paper.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import { JOB as dock, MAKERS, TRY, BRIDGE, PLACE, bridgeOf, built, nextShip } from '../src/jobs/dock.js';
import { helpPicture } from '../src/jobs/pics.js';
import { workOf } from '../../mathwood-valley/src/math/longwork.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';
import { PLACE as PLACES, PROBLEMS } from '../../mathwood-valley/src/levels/places.js';
import { setLevelAt } from '../../mathwood-valley/src/levels/model.js';

const crewOf = (age = null) => ({ id: 'c1', name: 'Test', look: { id: 'zuri' }, age });
const num = (c) => Number(String(c.v).replace(/,/g, ''));

test('the dock is open, a bridge of nine rings, and joins Mathwood\'s levels: easiest first, on the geometry strand', () => {
  assert.equal(dock.open, true);
  assert.equal(BRIDGE.rings, 9); assert.equal(BRIDGE.squares, 3);
  assert.equal(E.register(dock), true);
  assert.deepEqual(PROBLEMS, []);
  assert.ok(PLACES.dock);
  for (let i = 1; i < PLACE.levels.length; i++) assert.ok(PLACE.levels[i].grade > PLACE.levels[i - 1].grade, `${PLACE.levels[i].id} after ${PLACE.levels[i - 1].id}`);
  for (const L of PLACE.levels) assert.equal(L.strand, 'geo', L.id);
  assert.deepEqual(PLACE.levels.map((L) => L.id), ['brace', 'fit', 'count', 'angle', 'corner', 'line', 'area', 'parallel', 'third', 'quad', 'twostep', 'diag']);
  // (a new crew member climbs a level for each right answer while their level is found, and the squares can't be
  // missed: a young child's first rings stay young, up to counting the triangles)
  assert.ok(PLACE.levels[2].grade < 30, 'the third level is still for the young');
});

test('fewer right-triangle sides, more angles (the game\'s maker, DT-5): angles in four-sided shapes and two-step angles', () => {
  // the asks of every level, by their weights: a right triangle's side only at the top level, and a third of it
  const sides = [], angles = [];
  for (const L of PLACE.levels) {
    const tot = L.gen.mix.reduce((t, a) => t + (a.w ?? 1), 0);
    const side = L.gen.mix.filter((a) => a.maker === 'diag').reduce((t, a) => t + (a.w ?? 1), 0) / tot;
    if (side) sides.push([L.id, side]);
    if (L.gen.mix.some((a) => ['angle', 'corner', 'line', 'parallel', 'third', 'quad', 'twostep'].includes(a.maker))) angles.push(L.id);
  }
  assert.deepEqual(sides.map((x) => x[0]), ['diag'], 'right-triangle sides at the top level only');
  assert.ok(sides[0][1] <= 0.34, 'and a third of its cards at most');
  assert.ok(angles.length >= 8, 'angles at most levels: ' + angles);
  // the brace's length only, never a side from it; its squares and their sum walked by Work it out; roots a child knows
  const rand = seeded(9);
  for (let k = 0; k < 40; k++) {
    const d = MAKERS.diag.make(1 + (k % 2), { rand });
    assert.equal(d.facts.ask, 'd');
    assert.equal(d.sum.chain.length, 3);
    assert.ok([50, 100, 150].includes(d.facts.d), String(d.facts.d));
  }
  // four-sided shapes (a square leaning over, a pane at the collar) and two-step angles both come up
  const kinds = new Set();
  for (let k = 0; k < 60; k++) { kinds.add(MAKERS.quad.make(1, { rand }).facts.kind); kinds.add(MAKERS.twostep.make(1, { rand }).facts.kind); kinds.add(MAKERS.parallel.make(1, { rand }).facts.kind); }
  for (const k of ['lean', 'pane', 'outside', 'panel', 'z', 'c']) assert.ok(kinds.has(k), k);
});

test('the bridge stays built for the ship at the port; a new ship, a new bridge (DT-6)', () => {
  const crew = crewOf();
  assert.deepEqual(bridgeOf(crew), { ship: 1, rings: 0, docked: false });
  for (let k = 0; k < 4; k++) built(crew);
  // (kept with the crew member, as the save keeps it: a copy through JSON, as the shared store does)
  const back = JSON.parse(JSON.stringify(crew));
  assert.deepEqual(bridgeOf(back), { ship: 1, rings: 4, docked: false });
  for (let k = 0; k < 9; k++) built(back);
  assert.deepEqual(bridgeOf(back), { ship: 1, rings: 9, docked: true }, 'no more than the nine rings; the ship docks');
  assert.deepEqual(nextShip(back), { ship: 2, rings: 0, docked: false });
  // a bridge saved before (or a broken one) reads as a fresh bridge
  const odd = { jobs: { dock: { n: 3, bridge: { ship: 'x', rings: 99 } } } };
  assert.deepEqual(bridgeOf(odd), { ship: 1, rings: 9, docked: true });
  assert.equal(odd.jobs.dock.n, 3, 'the tally is kept');
});

test('every level deals good questions: one right answer, words for every wrong one, help with a picture', () => {
  for (const L of PLACE.levels) {
    const rand = seeded(L.grade * 31 + 7);
    for (let k = 0; k < 60; k++) {
      const crew = crewOf();
      setLevelAt(crew, 'dock', L.id);
      const q = E.deal(crew, dock, { rand });
      const o = q.order;
      assert.equal(q.level.id, L.id);
      assert.equal(o.coins.filter((c) => c.good).length, 1, `${L.id}: ${o.story}`);
      const text = `${o.story} ${o.ask} ${o.coins.map((c) => `${c.big} ${c.small} ${c.label} ${c.why}`).join(' ')} ${o.rightWhy} ${o.help.title} ${o.help.line} ${o.help.steps.join(' ')}`;
      assert.ok(!/NaN|undefined|Infinity|\[object/.test(text), `${L.id}: ${text}`);
      assert.ok(o.own && o.own.strand === 'geo' && Number.isFinite(o.own.at), `${L.id}: no strand`);
      const h = helpPicture(o);
      assert.ok(h.svg.startsWith('<svg') && h.title && h.line, `${L.id}: help`);
      assert.ok(o.help.steps.length >= 2, `${L.id}: help steps`);
      if (L.id === 'brace') {
        // the youngest: the squares on the card are the answer; one coin, picked by the job when they are all braced
        assert.equal(o.play, 'brace'); assert.equal(o.coins.length, 1); assert.equal(o.facts.squares, TRY.squares);
        continue;
      }
      assert.ok(!o.play, `${L.id}: a question to pick`);
      assert.equal(o.coins.length, 4, `${L.id}: ${o.coins.length} coins`);
      assert.equal(new Set(o.coins.map((c) => c.label)).size, 4, `${L.id}: two coins alike`);
      for (const c of o.coins) if (!c.good) assert.ok(c.why && c.why.length > 12, `${L.id}: a wrong answer with no why: ${c.label}`);
      assert.ok(o.lead && o.lead.startsWith('<svg'), `${L.id}: the question's picture`);
      // (no picture gives the answer away: the asked part is a "?")
      assert.ok(o.lead.includes('>?<'), `${L.id}: the picture shows the answer`);
      // the sums worked on paper (Mathwood's worked sheet)
      if (o.sum) for (const s of o.sum.chain || [o.sum]) assert.doesNotThrow(() => workOf(s), `${L.id}: ${JSON.stringify(s)}`);
    }
  }
});

test('the right answers are right', () => {
  const rand = seeded(42);
  for (let k = 0; k < 300; k++) {
    // a pane that fits: the gap's own triangle (any quarter turn); the others not
    const f = MAKERS.fit.make(1, { rand }), F = f.facts;
    assert.equal(f.coins.find((c) => c.good).v, 'right');
    assert.ok(f.coins.every((c) => c.svg && c.svg.startsWith('<svg')), 'every pane drawn');
    assert.equal(new Set(f.coins.map((c) => c.v)).size, 4);
    assert.ok([[2, 2], [2, 3], [3, 2]].some(([a, b]) => a === F.a && b === F.b));
    // the triangles: two in every braced square
    const n = MAKERS.count.make(1, { rand }), nr = n.coins.find((x) => x.good);
    assert.equal(nr.v, 2 * n.facts.n, n.story);
    // a kind of angle: the one its size says
    const g = MAKERS.angle.make(1, { rand }), gr = g.coins.find((x) => x.good), deg = g.facts.deg;
    assert.equal(gr.v, deg < 90 ? 'acute' : deg === 90 ? 'right' : deg < 180 ? 'obtuse' : 'straight', `${deg}°`);
    assert.equal(g.coins.length, 4);
    // a square corner: the two parts make 90
    const c = MAKERS.corner.make(1, { rand }), cr = c.coins.find((x) => x.good);
    assert.equal(cr.v + c.facts.a, 90, c.story);
    // a triangle pane: half of base times height
    const a = MAKERS.area.make(1, { rand }), ar = a.coins.find((x) => x.good);
    assert.equal(num(ar), a.facts.b * a.facts.h / 2, a.story);
    // the third corner: the three make 180
    const t = MAKERS.third.make(1, { rand }), tr = t.coins.find((x) => x.good);
    assert.equal(t.facts.ang.reduce((s, v) => s + v, 0), 180);
    assert.equal(tr.v, t.facts.ang[t.facts.ask], t.story);
    // a straight strut: the two make 180
    const l = MAKERS.line.make(1, { rand }), lr = l.coins.find((x) => x.good);
    assert.equal(lr.v + l.facts.a, 180, l.story);
    // parallel struts: a Z the same, a C 180 together
    const p = MAKERS.parallel.make(1, { rand }), pr = p.coins.find((x) => x.good);
    assert.equal(pr.v, p.facts.kind === 'z' ? p.facts.a : 180 - p.facts.a, p.story);
    // four corners: 360 together; a leaning square's opposite corners equal
    const q = MAKERS.quad.make(1, { rand }), qr = q.coins.find((x) => x.good), Q = q.facts;
    assert.equal(Q.ang.reduce((t, v) => t + v, 0), 360); assert.equal(qr.v, Q.ang[Q.ask], q.story);
    if (Q.kind === 'lean') { assert.equal(Q.ang[0], Q.ang[2]); assert.equal(Q.ang[1], Q.ang[3]); }
    // two steps: the corner inside from the one outside, then the third; the panel's angle at the top
    const w = MAKERS.twostep.make(1, { rand }), wr = w.coins.find((x) => x.good), T2 = w.facts;
    if (T2.kind === 'outside') { assert.equal(T2.B, 180 - T2.out); assert.equal(wr.v, 180 - T2.A - T2.B, w.story); }
    else assert.equal(wr.v, 90 - T2.a, w.story);
    for (const o of [l, p, q, w]) { assert.equal(o.coins.length, 4, o.story); for (const x of o.coins) if (!x.good) assert.notEqual(x.v, o.coins.find((y) => y.good).v); }
    // a brace across a panel: the squares add up
    const d = MAKERS.diag.make(1 + (k % 2), { rand }), dr = num(d.coins.find((x) => x.good)), D = d.facts;
    assert.equal(D.w * D.w + D.h * D.h, D.d * D.d);
    assert.equal(dr, D.ask === 'd' ? D.d : D.ask === 'w' ? D.w : D.h, d.story);
    // the wrong ones are wrong
    for (const o of [c, a, t, d]) for (const x of o.coins) if (!x.good) assert.notEqual(num(x), num(o.coins.find((y) => y.good)));
  }
});

test('the squares answer: once all are braced the one coin pays, as any right first answer', () => {
  const crew = crewOf(5);
  setLevelAt(crew, 'dock', 'brace');
  const q = E.deal(crew, dock, { rand: seeded(3) });
  const r = E.answer(crew, dock, q, 0);
  assert.equal(r.right, true); assert.equal(r.first, true); assert.equal(r.pay, q.worth.pay);
  assert.ok(r.pay >= 100 && r.pay <= 150, 'an easy card for the youngest: ' + r.pay);
  assert.equal(crew.jobs.dock.n, 1);
});
