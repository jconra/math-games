// The radio tower job (src/jobs/antenna.js): its ladder joins Mathwood's levels; every level asks the step the antenna
// is at, one card for each of the plan's eight steps, at the youngest's, the middle and the older's math; every card has
// one right answer, a why for each wrong one, help with a picture and steps, and sums that work out; the antenna is kept
// with the crew member and the flag the exploring run reads (antennaRepaired) is set by the eighth step and kept; and
// it stands at the very top of the station, on the control tower's roof: its footing on that roof's big plate, its
// anchors on the roof itself toward its corners (no arms), its red light the station's highest point, inside the box the ships keep out of.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import { JOB as antenna, MAKERS, PLACE, STEPS, CALL, SIGNAL, antennaOf, antennaSeen, stepBuilt, buildAgain, antennaRepaired, pickAsk } from '../src/jobs/antenna.js';
import { readFileSync } from 'node:fs';
import { ANTENNA, TOWER_TOP, anchorsAt, squareOut, cableFrom, corners, TOP, DISH_TOP } from '../kit/antenna-plan.js';
import { SPIRE, SPIRE_TOP, OUTSIDE_BOX, outsidePlans, outsideGear } from '../kit/outside-plan.js';
import { TOWER } from '../kit/places-plan.js';
import { JET } from '../src/roofjets.js';
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

test('the plan\'s own numbers: 12 m, past 9 m, a 2 m square, 3 m struts halved, 2.5 m braces, 8 x 1.5 m, 6.5 m cables, 135 then 140 degrees', () => {
  const r = seeded(3), ans = (id, t) => MAKERS[id].make(t, { rand: r }).facts.ans;
  assert.equal(ans('tall', 1), 12); assert.equal(ans('tall', 2), 12);
  assert.equal(ans('footing', 1), 'square'); assert.equal(ans('footing', 2), 8); assert.equal(ans('footing', 3), 2.5);
  assert.equal(ans('legs', 1), 4); assert.equal(ans('legs', 2), 1.5); assert.equal(ans('legs', 3), 2);
  assert.equal(ans('brace', 2), 8); assert.equal(ans('brace', 3), 2.5);
  assert.equal(ans('stack', 1), 8); assert.equal(ans('stack', 2), 12); assert.equal(ans('stack', 3), 12);
  assert.equal(ans('cables', 1), 6); assert.equal(ans('cables', 2), 6); assert.equal(ans('cables', 3), 6.5);
  assert.equal(ans('dish', 1), 3); assert.equal(ans('dish', 2), 135); assert.equal(ans('dish', 3), 135);
  assert.equal(ans('call', 1), 9); assert.equal(ans('call', 2), 140); assert.equal(ans('call', 3), 5);
  assert.equal(SIGNAL.best - SIGNAL.at, 5);
  // (the 3D antenna is the plan's: eight sections of 1.5 m make 12 m, three cables at each of two heights, the top ones
  // from the mast's top; the anchors 2.5 m out on the roof (the game's maker's choice, 2026-11-24): the lower ones 6 m
  // up and 2.5 m out, the card's 6.5 m)
  assert.equal(TOP, 12); assert.equal(ANTENNA.out, 2.5); assert.equal(ANTENNA.holds.length, 2); assert.equal(anchorsAt().length, 3);
  assert.equal(ANTENNA.holds[1], TOP); assert.equal(ANTENNA.holds[0], 6); assert.equal(Math.hypot(ANTENNA.holds[0], ANTENNA.out), 6.5);
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

test('the cards name where it stands now: on top of the control tower, its cables down to the roof, no arms', () => {
  const said = (o) => `${o.story} ${o.ask} ${o.coins.map((c) => c.why || '').join(' ')} ${o.rightWhy || ''} ${o.help.line} ${o.help.steps.join(' ')} ${(o.sum ? o.sum.chain || [o.sum] : []).map((x) => x.say || '').join(' ')}`;
  for (let tier = 1; tier <= 3; tier++) {
    assert.match(MAKERS.tall.make(tier, { rand: seeded(tier) }).story, /on top of the control tower/);
    assert.match(MAKERS.cables.make(tier, { rand: seeded(tier) }).story, /anchor rings on the roof/);
    // (nothing left of the places it stood or was drawn before: the tower's foot, the terminal's or the hangars' roof;
    // nor of the arms round 2 had; nor in any card's picture)
    for (const s of STEPS) for (const k of [1, 7]) { const o = MAKERS[s.id].make(tier, { rand: seeded(k) }); assert.ok(!/tower's foot|terminal|hangar|\barms?\b/i.test(said(o) + ' ' + (o.lead || '') + ' ' + o.help.svg), `${s.id} at ${tier}`); }
  }
  assert.equal(STEPS[5].name, 'Cables to the roof');
  assert.match(PLACE.line, /on top of the control tower/);
});

const D2R = Math.PI / 180;
test('where it stands: at the very top of the station, on the control tower\'s roof, its footing and the old pole on the roof\'s big plate', () => {
  // the tower's top as the outside's own plan has it: the tower is a 10 m square about its middle, and its profile's
  // last two points are the wall under the top (how far in or out from that square, how high) and the top itself
  const prof = outsidePlans({ inside: true }).find((q) => q.name === 'spire').tiers[0].profile, top = prof[prof.length - 1], wall = prof[prof.length - 2];
  assert.equal(top[1], SPIRE_TOP); assert.equal(TOWER_TOP.y, SPIRE_TOP);
  assert.ok(Math.abs(5 + top[0] - TOWER_TOP.half) < 1e-9, 'the roof is 4.8 m across');
  assert.ok(Math.abs(5 + wall[0] - TOWER_TOP.wall) < 1e-9 && wall[1] === TOWER_TOP.shoulder, 'the wall under it, 3.4 m out, up to 62 m');
  assert.deepEqual([TOWER_TOP.x, TOWER_TOP.z], [SPIRE.x, SPIRE.z]);
  // the footing's middle is the tower's own, on the roof's big plate (0.32 m proud: measured in the game)
  assert.deepEqual(ANTENNA.at, [SPIRE.x, SPIRE_TOP + TOWER_TOP.plate.up, SPIRE.z]);
  assert.ok(TOWER_TOP.plate.up > 0 && TOWER_TOP.plate.up < 0.5 && TOWER_TOP.plate.x <= TOWER_TOP.half && TOWER_TOP.plate.z <= TOWER_TOP.half);
  const onPlate = (what, x, z, r) => assert.ok(Math.abs(x) + r <= TOWER_TOP.plate.x && Math.abs(z) + r <= TOWER_TOP.plate.z, `${what} at ${x.toFixed(2)}, ${z.toFixed(2)} is off the roof's big plate`);
  for (const [x, z] of corners()) onPlate('a pad', x, z, 0.24);
  const [ox, , oz] = ANTENNA.old.at;
  onPlate('the old pole', ox, oz, 0.3);
  // the old pole stands beside the mast, not in it, and clear of the anchors and their cables (its dish, 0.32 m round,
  // 0.34 m out east of it at the top)
  assert.ok(Math.max(Math.abs(ox), Math.abs(oz)) - 0.3 > ANTENNA.half + 0.06, 'the old pole is outside the footing');
  anchorsAt().forEach(([ax, az], k) => {
    assert.ok(Math.hypot(ox - ax, oz - az) > 0.9, 'the old pole is clear of an anchor');
    for (const h of ANTENNA.holds) {
      const a = cableFrom(ANTENNA.bearings[k], h);
      for (let t = 0; t <= 1; t += 0.05) { const x = a[0] + (ax - a[0]) * t, z = a[2] + (az - a[2]) * t, y = h + (ANTENNA.drop[k] - h) * t; if (y < ANTENNA.old.pole + 0.5) assert.ok(Math.hypot(x - ox - 0.17, z - oz) > 0.6, 'the old dish is clear of a cable'); }
    }
  });
  // THE STATION'S HIGHEST POINT: nothing of the station's outside stands over the tower's top any more (the plain pole
  // and its white ball are gone), the red light is over the dish however it is turned, and its rod is clear of it
  const g = outsideGear({ inside: true });
  let gearTop = -Infinity;
  for (const a of [g.lit, g.glow, g.heat]) for (let i = 1; i < a.position.length; i += 3) gearTop = Math.max(gearTop, a.position[i]);
  assert.ok(gearTop < SPIRE_TOP, 'nothing of the gear over the tower\'s top: ' + gearTop.toFixed(1));
  assert.ok(ANTENNA.tip.h > DISH_TOP() + 0.3 && ANTENNA.tip.h > TOP, 'the red light at the very top');
  assert.ok(Math.hypot(...ANTENNA.tip.at) > ANTENNA.dish.r + 0.3, 'its rod clear of the dish as it turns');
  // ... and all of it inside the box the ships' own ways keep out of (src/flymodel.js: 30 m and more from it)
  const tip = ANTENNA.at[1] + ANTENNA.tip.h;
  assert.ok(tip < OUTSIDE_BOX.max[1], 'the tip, ' + tip.toFixed(1) + ' m, under the box\'s top');
  for (const [x, z] of anchorsAt()) assert.ok(ANTENNA.at[0] + x - 0.5 > OUTSIDE_BOX.min[0] && ANTENNA.at[0] + x + 0.5 < OUTSIDE_BOX.max[0] && ANTENNA.at[2] + z - 0.5 > OUTSIDE_BOX.min[2] && ANTENNA.at[2] + z + 0.5 < OUTSIDE_BOX.max[2]);
});

test('the anchors: on the roof itself, 2.5 m out toward three of its corners (no arms); the cables leave the mast\'s corners, short and steep', () => {
  const A = anchorsAt();
  assert.equal(A.length, 3); assert.equal(ANTENNA.drop.length, 3);
  assert.equal(ANTENNA.arm, undefined, 'no arms');
  for (const [x, z] of A) {
    assert.ok(Math.abs(Math.hypot(x, z) - 2.5) < 1e-9);
    // toward a corner of the roof (on its diagonal), on the roof with room for its block (0.22 m round), clear of the pads
    assert.ok(Math.abs(Math.abs(x) - Math.abs(z)) < 1e-9, 'on the roof\'s diagonal, toward its corner');
    assert.ok(Math.abs(x) + 0.22 < TOWER_TOP.half && Math.abs(z) + 0.22 < TOWER_TOP.half, 'on the roof');
    for (const [cx, cz] of corners()) assert.ok(Math.abs(x - cx) > 0.24 + 0.22 || Math.abs(z - cz) > 0.24 + 0.22, 'clear of a pad');
    // not the north-east corner: the red light's rod stands over that one
    assert.ok(!(Math.sign(x) === Math.sign(ANTENNA.tip.at[0]) && Math.sign(z) === Math.sign(ANTENNA.tip.at[1])));
  }
  // down on the roof's lower plates there (63.0 to 63.22 m, measured in the game), under the footing's big plate
  for (const d of ANTENNA.drop) assert.ok(d < 0 && d > -TOWER_TOP.plate.up);
  // short and steep: the lower cable is the card's 6.5 m, and every cable runs steeper than 2 up for 1 out
  for (const h of ANTENNA.holds) ANTENNA.bearings.forEach((deg, k) => {
    const [x, y, z] = cableFrom(deg, h), [ax, az] = A[k];
    assert.ok((y - ANTENNA.drop[k]) / Math.hypot(ax - x, az - z) > 2, 'steep');
  });
  // each cable leaves the mast on its own side facing the anchor
  for (const h of ANTENNA.holds) ANTENNA.bearings.forEach((deg) => {
    const [x, y, z] = cableFrom(deg, h);
    assert.equal(y, h);
    assert.ok(Math.abs(Math.max(Math.abs(x), Math.abs(z)) - ANTENNA.half) < 0.12, 'on the mast\'s side (at its corner)');
    assert.ok(Math.abs(Math.atan2(z, x) / D2R - (deg > 180 ? deg - 360 : deg)) < 1e-6, 'toward its anchor');
  });
});

test('the small ship that flies past the control room\'s windows keeps well clear of it: 10 m and more from the antenna\'s anchors, under them', () => {
  // (src/lift.js draws with three.js, so its numbers are read as text: FLYBY.near, how far out from the tower's middle
  // it passes; and how far over the control room's floor at most)
  const lift = readFileSync(new URL('../src/lift.js', import.meta.url), 'utf8');
  const near = /FLYBY = \{[^}]*near: \[(\d+), (\d+)\]/.exec(lift), up = /TOWER\.floor \+ rand\((-?[\d.]+), ([\d.]+)\)/.exec(lift);
  assert.ok(near && up, 'the fly-past\'s numbers are where they were (src/lift.js FLYBY and startFlyby)');
  const top = TOWER.floor + +up[2];
  // the lowest and widest of the antenna: the anchors' blocks on the roof
  const foot = ANTENNA.at[1] + Math.min(...ANTENNA.drop) - 0.24, out = Math.max(...anchorsAt().map(([x, z]) => Math.hypot(x, z))) + 0.32;
  assert.ok(top < foot - 8, `the fly-past is ${(foot - top).toFixed(1)} m under the anchors at its highest`);
  const gap = Math.hypot(+near[1] - out, foot - top) - JET.wide / 2;
  assert.ok(gap > 10, `its wingtip comes ${gap.toFixed(1)} m from an anchor`);
});

test('a ship flown by hand cannot fly through what stands on the tower\'s top for the crew member playing, and nothing unseen is solid', async () => {
  const { standingBoxes } = await import('../kit/antenna-plan.js');
  const { stationSolid, outsideTriangles } = await import('../src/flysolid.js');
  const [ax, ay, az] = ANTENNA.at, [ox, , oz] = ANTENNA.old.at;
  // the boxes as each step is built: the old dish's three (its plate, its pole, its dish) until the new dish goes on;
  // the pads; the first section; the whole mast and the rod of the light at the very top; the anchors and six cables;
  // the dish
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => standingBoxes(n).length), [3, 3, 4, 5, 5, 6, 15, 13, 13]);
  const span = (L) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const b of L) for (let i = 0; i < b.position.length; i++) { lo[i % 3] = Math.min(lo[i % 3], b.position[i]); hi[i % 3] = Math.max(hi[i % 3], b.position[i]); } return { lo, hi }; };
  // nothing unseen: before the mast goes up, nothing over the old dish's top; the whole of it no higher than the light
  // at the very top, no wider than its anchors, and nothing where the old pole stood once the new dish is on
  assert.ok(span(standingBoxes(4)).hi[1] < ay + ANTENNA.old.pole + 0.5);
  const all = span(standingBoxes(8));
  assert.ok(Math.abs(all.hi[1] - (ay + ANTENNA.tip.h)) < 1e-4 && all.lo[1] > ay - 0.4);
  const reach = Math.max(...anchorsAt().map(([x, z]) => Math.max(Math.abs(x), Math.abs(z)))) + 0.22;
  assert.ok(Math.max(all.hi[0] - ax, ax - all.lo[0], all.hi[2] - az, az - all.lo[2]) <= reach + 1e-4);
  for (const b of standingBoxes(8)) for (let i = 0; i < 24; i += 3) assert.ok(!(Math.abs(b.position[i] - ax - ox) < 0.25 && Math.abs(b.position[i + 2] - az - oz) < 0.25 && b.position[i + 1] - ay > 1), 'nothing where the old pole stood');
  // and as the station's solid has it (what a flown ship bumps into, src/flysolid.js): with nothing built, the old pole
  // is solid and the air where the mast will stand is not; repaired, the mast, the dish and the light are, the old pole
  // is not
  const base = outsideTriangles(), solid = (n) => stationSolid({ lists: [...base, ...standingBoxes(n)] });
  const S0 = solid(0), S8 = solid(8);
  const mastMid = [ax, ay + 7, az], dish = [ax, ay + TOP + 0.6, az], pole = [ax + ox, ay + 2, az + oz];
  assert.ok(S0.dist(...pole) < 0.6, 'the old pole: ' + S0.dist(...pole).toFixed(2));
  assert.ok(S0.dist(...mastMid) > 2.5 && S0.dist(...dish) > 2.5, 'nothing yet where the mast will stand');
  assert.ok(S8.dist(ax + ANTENNA.half, ay + 7, az) < 0.6 && S8.dist(...dish) < 1.2 && S8.dist(ax + ANTENNA.tip.at[0], ay + ANTENNA.tip.h - 0.5, az + ANTENNA.tip.at[1]) < 0.6, 'the mast, the dish and the light are solid');
  assert.ok(S8.dist(ax + ox + 0.3, ay + 2.6, az + oz) > S0.dist(ax + ox + 0.3, ay + 2.6, az + oz) + 0.2, 'the old dish is gone');
  // a straight flight through the mast's middle, 7 m up, east to west: blocked once it stands, not before
  const a = [ax + 12, ay + 7, az], b = [ax - 12, ay + 7, az];
  assert.equal(S0.clear(a, b, 0.8), 1);
  assert.ok(S8.clear(a, b, 0.8) < 0.6);
});
