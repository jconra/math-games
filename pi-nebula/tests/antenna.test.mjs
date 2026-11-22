// The radio tower job (src/jobs/antenna.js): its ladder joins Mathwood's levels; every level asks the step the antenna
// is at, one card for each of the plan's eight steps, at the youngest's, the middle and the older's math; every card has
// one right answer, a why for each wrong one, help with a picture and steps, and sums that work out; the antenna is kept
// with the crew member and the flag the exploring run reads (antennaRepaired) is set by the eighth step and kept; and
// where it stands on the roof is clear of the control tower's foot and of the roof's edges.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import { JOB as antenna, MAKERS, PLACE, STEPS, CALL, SIGNAL, antennaOf, antennaSeen, stepBuilt, buildAgain, antennaRepaired, pickAsk } from '../src/jobs/antenna.js';
import { readFileSync } from 'node:fs';
import { ANTENNA, anchorsAt, corners, TOP } from '../kit/antenna-plan.js';
import { MASSES, SPIRE, boxPath, PYRAMIDS, RAISED } from '../kit/outside-plan.js';
import { offsetPath } from '../kit/hull-plates.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';
import { PLACE as PLACES, PROBLEMS } from '../../mathwood-valley/src/levels/places.js';
import { setLevelAt } from '../../mathwood-valley/src/levels/model.js';

const crewOf = (age = null) => ({ id: 'c1', name: 'Test', look: { id: 'zuri' }, age });

test('the radio tower is open, worked at the control room\'s radio desk, and joins Mathwood\'s levels, easiest first', () => {
  assert.equal(antenna.open, true);
  // (listed with the station's jobs: src/jobs/index.js, read as text, as it draws with three.js)
  const idx = readFileSync(new URL('../src/jobs/index.js', import.meta.url), 'utf8');
  assert.match(idx, /export const JOBS = \[[^\]]*\bantenna\b[^\]]*\]/);
  assert.deepEqual(antenna.spot, { piece: 'console', variant: 'radio', room: 'tower', local: [0, 0, 1.15], face: [0, -1] });
  assert.equal(antenna.link, 'antenna');
  assert.equal(E.register(antenna), true);
  assert.deepEqual(PROBLEMS, []);
  assert.ok(PLACES.antenna);
  assert.equal(PLACE.levels.length, 3);
  for (let i = 1; i < PLACE.levels.length; i++) assert.ok(PLACE.levels[i].grade > PLACE.levels[i - 1].grade, PLACE.levels[i].id);
  // every level has a card for every one of the eight steps, in the plan's order
  assert.deepEqual(STEPS.map((s) => s.id), ['tall', 'footing', 'legs', 'brace', 'stack', 'cables', 'dish', 'call']);
  for (const L of PLACE.levels) assert.deepEqual(L.gen.mix.map((a) => a.maker), STEPS.map((s) => s.id), L.id);
});

test('every level asks the step the antenna is at: one card a step, at the level\'s own math', () => {
  for (const L of PLACE.levels) {
    STEPS.forEach((s, k) => {
      const crew = crewOf();
      setLevelAt(crew, 'antenna', L.id);
      const q = E.deal(crew, antenna, { rand: seeded(k + 1), live: { step: k } });
      assert.equal(q.level.id, L.id);
      assert.equal(q.order.facts.step, s.id, `${L.id}: step ${k + 1}`);
      assert.equal(q.order.facts.tier, PLACE.levels.indexOf(L) + 1);
    });
  }
  // (with nothing to say which step, the levels page's examples: any step)
  assert.equal(pickAsk(PLACE.levels[0].gen.mix, {}), null);
  assert.equal(pickAsk(PLACE.levels[0].gen.mix, { live: { step: 4 } }).maker, 'stack');
});

// the value a card's sums come to, worked through in order (each sum's result can be the next one's)
const worked = (sum) => sum.map((s) => ({ add: s.a + s.b, sub: s.a - s.b, mul: s.a * s.b, div: s.a / s.b }[s.op]));
test('every card: one right answer among different ones, a why for each wrong one, help with a picture and its steps', () => {
  for (let tier = 1; tier <= 3; tier++) {
    for (const s of STEPS) {
      for (let k = 0; k < 12; k++) {
        const o = MAKERS[s.id].make(tier, { rand: seeded(tier * 100 + k) });
        const tag = `${s.id} at ${tier}: ${o.story} ${o.ask}`;
        const text = `${o.story} ${o.ask} ${o.coins.map((c) => `${c.big} ${c.small} ${c.label} ${c.why}`).join(' ')} ${o.rightWhy || ''}`;
        assert.ok(!/NaN|undefined|Infinity|\[object/.test(text), tag);
        assert.ok(o.own && Number.isFinite(o.own.at), tag);
        assert.ok(o.help && o.help.svg && o.help.svg.startsWith('<svg') && o.help.line && o.help.steps.length, `${tag}: help`);
        assert.equal(o.coins.filter((c) => c.good).length, 1, tag);
        if (o.play === 'brace') { assert.equal(s.id, 'brace'); assert.equal(tier, 1); assert.equal(o.coins.length, 1); continue; }
        assert.equal(o.coins.length, 4, tag);
        assert.equal(new Set(o.coins.map((c) => String(c.v))).size, 4, `${tag}: two answers alike`);
        for (const c of o.coins) if (!c.good) assert.ok(c.why && c.why.length > 8, `${tag}: no why for ${c.big}`);
        const right = o.coins.find((c) => c.good);
        assert.equal(String(right.v), String(o.facts.ans), tag);
        // (the card's sums work out: the last comes to the answer, or for a long side to its square)
        if (o.sum) {
          const ws = worked(o.sum.chain || [o.sum]), last = ws[ws.length - 1];
          if (typeof last === 'number' && Number.isFinite(last)) assert.ok(Math.abs(last - o.facts.ans) < 1e-9 || Math.abs(last - o.facts.ans ** 2) < 1e-9, `${tag}: sums come to ${last}`);
        }
        // (the youngest's footing: shapes on the buttons)
        if (s.id === 'footing' && tier === 1) for (const c of o.coins) assert.ok(c.svg && c.svg.startsWith('<svg'), 'a shape on each button');
      }
    }
  }
});

test('the plan\'s own numbers: 12 m over a 9 m roof, a 2 m square, 3 m struts halved, 2.5 m braces, 8 x 1.5 m, 13 m cables, 135 then 140 degrees', () => {
  const r = seeded(3), ans = (id, t) => MAKERS[id].make(t, { rand: r }).facts.ans;
  assert.equal(ans('tall', 1), 12); assert.equal(ans('tall', 2), 12);
  assert.equal(ans('footing', 1), 'square'); assert.equal(ans('footing', 2), 8); assert.equal(ans('footing', 3), 2.5);
  assert.equal(ans('legs', 1), 4); assert.equal(ans('legs', 2), 1.5); assert.equal(ans('legs', 3), 2);
  assert.equal(ans('brace', 2), 8); assert.equal(ans('brace', 3), 2.5);
  assert.equal(ans('stack', 1), 8); assert.equal(ans('stack', 2), 12); assert.equal(ans('stack', 3), 12);
  assert.equal(ans('cables', 1), 6); assert.equal(ans('cables', 2), 6); assert.equal(ans('cables', 3), 13);
  assert.equal(ans('dish', 1), 3); assert.equal(ans('dish', 2), 135); assert.equal(ans('dish', 3), 135);
  assert.equal(ans('call', 1), 9); assert.equal(ans('call', 2), 140); assert.equal(ans('call', 3), 5);
  assert.equal(SIGNAL.best - SIGNAL.at, 5);
  // (the 3D antenna is the plan's: eight sections of 1.5 m make 12 m, anchors 5 m out, three cables at each of two heights)
  assert.equal(TOP, 12); assert.equal(ANTENNA.out, 5); assert.equal(ANTENNA.holds.length, 2); assert.equal(anchorsAt().length, 3);
  assert.equal(ANTENNA.dish.turn, 135); assert.equal(ANTENNA.dish.tilt, 30);
  // (the call: no name in it, text only)
  assert.ok(CALL.length >= 4 && CALL.every((l) => typeof l === 'string' && l.length));
});

test('a right answer at each step pays as any card, and the youngest\'s bracing pays as a right answer', () => {
  const crew = crewOf(6);
  E.register(antenna);
  setLevelAt(crew, 'antenna', 'count');
  const q = E.deal(crew, antenna, { rand: seeded(9), live: { step: 3 } });
  assert.equal(q.order.play, 'brace');
  const r = E.answer(crew, antenna, q, 0, { ms: 9000 });
  assert.equal(r.right, true); assert.ok(r.pay > 0);
});

test('THE FLAG: the antenna is kept with the crew member, step by step; the eighth step repairs the radio tower, and it stays repaired', () => {
  const crew = crewOf();
  assert.equal(antennaRepaired(crew), false);
  assert.deepEqual(antennaSeen(crew), { built: 0, repaired: false });
  assert.equal(crew.jobs, undefined, 'only read: a crew member who never went to the radio desk is left as they were');
  assert.deepEqual({ ...antennaOf(crew) }, { built: 0, repaired: false });
  for (let k = 1; k < STEPS.length; k++) { assert.equal(stepBuilt(crew).built, k); assert.equal(antennaRepaired(crew), false, `not yet at step ${k}`); }
  assert.equal(stepBuilt(crew).built, 8);
  assert.equal(antennaRepaired(crew), true);
  assert.equal(crew.jobs.antenna.repaired, true, 'the flag, plainly: crew.jobs.antenna.repaired');
  // (saved and loaded again, as the crew member is)
  const back = JSON.parse(JSON.stringify(crew));
  assert.equal(antennaRepaired(back), true);
  // built again from the first step: still repaired
  assert.equal(buildAgain(back).built, 0); assert.equal(antennaRepaired(back), true);
  assert.equal(stepBuilt(back).built, 1); assert.equal(antennaRepaired(back), true);
  assert.deepEqual(antennaSeen(back), { built: 1, repaired: true });
  // (a broken save: nothing repaired, nothing built past the end)
  assert.equal(antennaRepaired({ jobs: { antenna: { repaired: 'yes' } } }), false);
  assert.equal(antennaOf({ jobs: { antenna: { built: 99 } } }).built, 8);
  assert.equal(antennaRepaired(null), false);
});

// is a point [x, z] inside an outline (any way round)?
function inside(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > p[1]) !== (zj > p[1]) && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}
const ring = (x, z, r) => Array.from({ length: 12 }, (u, k) => [x + r * Math.cos(k * Math.PI / 6), z + r * Math.sin(k * Math.PI / 6)]);
test('where it stands: on the raised level\'s flat top, its pads, anchors and the old pole clear of the tower\'s foot and the edges', () => {
  const raised = MASSES.find((m) => m.name === 'raised level');
  const top = offsetPath(raised.path, -raised.bevel, true);
  const tower = offsetPath(boxPath(SPIRE.x - 5, SPIRE.x + 5, SPIRE.z - 5, SPIRE.z + 5, 2.2), 3.2, true);
  // (on the raised level's top, 23 m, standing on its plates: the big one under the footing is 0.75 m proud, measured)
  assert.ok(ANTENNA.at[1] >= 18.2 + RAISED.to && ANTENNA.at[1] <= 18.2 + RAISED.to + 0.8, String(ANTENNA.at[1]));
  assert.equal(ANTENNA.drop.length, 3);
  const [ax, , az] = ANTENNA.at;
  const things = [
    ...corners().map(([x, z]) => ['a pad', x, z, 0.3]),
    ...anchorsAt().map(([x, z]) => ['an anchor', x, z, 0.3]),
    ['the old pole', ANTENNA.old.at[0], ANTENNA.old.at[2], 0.35],
  ];
  for (const [what, x, z, r] of things) {
    for (const p of ring(ax + x, az + z, r)) {
      assert.ok(inside(p, top), `${what} at ${(ax + x).toFixed(2)}, ${(az + z).toFixed(2)} is off the flat top`);
      assert.ok(!inside(p, tower), `${what} at ${(ax + x).toFixed(2)}, ${(az + z).toFixed(2)} is on the tower's foot`);
      for (const P of PYRAMIDS) assert.ok(!inside(p, P.path), `${what} on ${P.name}`);
    }
  }
  // the anchors 5 m out, all three
  for (const [x, z] of anchorsAt()) assert.ok(Math.abs(Math.hypot(x, z) - 5) < 1e-9);
});
