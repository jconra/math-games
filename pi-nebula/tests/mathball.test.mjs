// MATHBALL (src/mathball/): the rule sets and every rule change pass the ball check; the balls come to rest showing
// their numbers to the camera, upright, and never turn while it looks at them; the other player keeps up with a slow
// player and a quick one alike without running away with it; the light bar reaches each goal on its time.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { LADDER, SETS, ORDER } from '../src/mathball/ladder.js';
import { ruleOf, fits, goalsFor, checkSet, dealable, pickChange } from '../src/mathball/rules.js';
import { makeBalls, facing, PHYS, qrand } from '../src/mathball/physics.js';
import { makeRound, OTHER, ROUND } from '../src/mathball/game.js';
import { simPlayer, playRound } from '../src/mathball/sim.js';
import { COURT, GOALS, PORTS, STATIONS, TRACK, barAt, inside, WALLS } from '../src/mathball/court.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';

const valid = (rules, ball) => { const n = goalsFor(rules, ball).length; return n >= 1 && n < rules.length; };
const onCourt = (G) => G.balls.filter((b) => ['air', 'roll', 'rest', 'turn', 'held'].includes(b.mode) && !b.fading);

// ── the rule sets ──────────────────────────────────────────────────────────────────────────────────────────────────
test('the ladder: every rule set in ORDER exists, has four goals and rules that read', () => {
  assert.ok(LADDER.length >= 5);
  assert.deepEqual(LADDER.map((s) => s.key), ORDER.filter((k) => SETS[k]));
  for (const S of LADDER) {
    assert.equal(S.goals.length, 4, S.key);
    assert.equal(new Set(S.goals).size, 4, `${S.key}: two goals alike`);
    for (const r of [...S.goals, ...S.spares]) {
      const R = ruleOf(r);
      assert.ok(R.say && R.help && R.list && R.sign.length >= 1, r);
      assert.ok(!/NaN|undefined/.test(`${R.say} ${R.help} ${R.list} ${R.why(12)}`), r);
    }
  }
  // the game's maker's own: easy (even, odd, less than 5, more than 10), then multiples 2, 3, 5, 10; 4, 6, 9, 11; 7, 8, 12
  assert.deepEqual(SETS.oddeven.goals, ['even', 'odd', 'less:5', 'more:10']);
  assert.deepEqual(SETS.tables1.goals, ['mult:2', 'mult:3', 'mult:5', 'mult:10']);
  assert.deepEqual(SETS.tables2.goals, ['mult:4', 'mult:6', 'mult:9', 'mult:11']);
  for (const k of [7, 8, 12]) assert.ok(SETS.tables3.goals.includes('mult:' + k));
  assert.ok(SETS.squares.goals.includes('square'));
});

test('every rule set passes the ball check: each ball dealt fits a goal and never all four; every goal takes some', () => {
  for (const S of LADDER) {
    const deal = dealable(S.goals, S.pool), c = checkSet(S.goals, deal);
    assert.ok(deal.length >= 12, `${S.key}: only ${deal.length} balls to deal`);
    assert.ok(c.ok, `${S.key}: ${JSON.stringify({ none: c.none, every: c.every, dead: c.dead })}`);
    assert.ok(c.choice >= 4, `${S.key}: only ${c.choice} balls fit more than one goal`);
    // (and every goal can take a ball that fits it alone, so each goal is worth knowing)
    for (let g = 0; g < 4; g++) assert.ok(deal.some((b) => goalsFor(S.goals, b).length === 1 && fits(S.goals[g], b)) || deal.filter((b) => fits(S.goals[g], b)).length >= 2, `${S.key}: goal ${S.goals[g]}`);
  }
});

test('every rule change keeps the balls on the court passing (or swaps out the few it cannot), never the ones in a hand', () => {
  const rand = seeded(41);
  for (const S of LADDER) {
    const deal = dealable(S.goals, S.pool), spares = [...S.goals, ...S.spares];
    let safe = 0, tries = 0;
    for (let k = 0; k < 150; k++) {
      const balls = []; while (balls.length < 8) { const b = deal[Math.floor(rand() * deal.length)]; if (!balls.includes(b)) balls.push(b); }
      const held = [balls[0]];
      for (let at = 0; at < 4; at++) {
        const ch = pickChange(S.goals, at, S.pool, balls.slice(1), { held, rand, spares }); tries++;
        assert.ok(ch, `${S.key}: no change at all for goal ${at}`);
        assert.notEqual(ch.rule, S.goals[at]);
        assert.ok(valid(ch.rules, held[0]), `${S.key}: the ball in a hand (${held[0]}) lost its goal`);
        // the balls left on the court all pass; the ones swapped out are exactly the ones that would not
        for (const b of balls.slice(1)) assert.equal(valid(ch.rules, b), !ch.strand.includes(b), `${S.key}: ${b}`);
        if (ch.safe) safe++;
        // the pool can still feed every goal after the change
        const d2 = dealable(ch.rules, S.pool);
        for (const r of ch.rules) assert.ok(d2.some((b) => fits(r, b)), `${S.key}: nothing could ever go in ${r}`);
      }
    }
    assert.ok(safe / tries > 0.6, `${S.key}: only ${safe} of ${tries} changes keep every ball`);
  }
});

test('in whole rounds, after every rule change every ball on the court (and in a hand) fits a goal and never all four', () => {
  const rand = seeded(7);
  for (const S of LADDER) for (let r = 0; r < 2; r++) {
    const G = makeRound({ set: S, rand, other: { level: 1 } }), P = simPlayer({ rand, think: [1, 3], aim: [0.6, 1.5] });
    let changes = 0;
    for (let t = 0; t < 140 && G.phase !== 'end'; t += 1 / 30) {
      const you = P.step(G, 1 / 30);
      G.step(1 / 30, { eye: [you.x, 2.6, you.z + 3], sees: () => true, you });
      const ev = G.take();
      if (ev.some((e) => e.type === 'change')) changes++;
      for (const b of onCourt(G)) assert.ok(valid(G.goals.map((g) => g.rule), b.num), `${S.key} at ${G.t.toFixed(1)} s: ${b.num} (${b.mode}) with ${G.goals.map((g) => g.rule)}`);
    }
    assert.equal(G.phase, 'end', S.key);
    assert.equal(changes, 4, `${S.key}: ${changes} rule changes`);
  }
});

// ── the light bar ──────────────────────────────────────────────────────────────────────────────────────────────────
test('the light bar: a lap of the room is a round; it reaches each goal on its time, one every 30 seconds', () => {
  assert.deepEqual(STATIONS.map((s) => s.t), [15, 45, 75, 105]);
  assert.deepEqual(STATIONS.map((s) => GOALS[s.goal].key), ['SW', 'NW', 'NE', 'SE']);
  for (const s of STATIONS) assert.ok(Math.abs(barAt(s.t) - s.s) < 1e-9);
  let last = -1; for (let t = 0; t <= COURT.bar.lap; t += 0.5) { const s = barAt(t); assert.ok(s >= last - 1e-9); last = s; }
  assert.equal(barAt(0), 0); assert.ok(Math.abs(barAt(COURT.bar.lap) - TRACK.len) < 1e-9);
  // the goals are where the game's maker picked: four, two at each end, about 8.1 m from the middle
  for (const g of GOALS) assert.ok(Math.abs(g.dist - 8.1) < 0.15, `${g.key} ${g.dist}`);
  for (const P of PORTS) assert.ok(Math.abs(inside(P.at[0], P.at[2])) < 1e-6);
});

// ── the balls ──────────────────────────────────────────────────────────────────────────────────────────────────────
test('the weighted ball: no ball ever comes to rest with its number more than 20 degrees off the camera, or leaning', () => {
  const rand = seeded(19);
  let n = 0, worst = 0;
  for (let run = 0; run < 40; run++) {
    const W = makeBalls({ rand }), eye = [(rand() - 0.5) * 8, 1.8 + rand() * 2.8, (rand() - 0.5) * 15];
    const balls = [];
    for (let i = 0; i < 8; i++) { const b = W.add({ id: i, num: i }); W.launch(PORTS[(i + run) % PORTS.length], b, rand); balls.push(b); }
    // (the camera drifts a little while they settle, as it does behind a walking player)
    for (let t = 0; t < 25 && !balls.every((b) => b.mode === 'rest'); t += 1 / 60) {
      eye[0] += Math.sin(t * 0.7) * 0.01;
      W.step(1 / 60, { eye, sees: () => true });
      for (const b of balls) if (b.mode === 'rest' && !b.checked) {
        b.checked = true; n++;
        const f = facing(b, eye); worst = Math.max(worst, f.angle, f.tilt);
        assert.ok(f.angle <= 20 && f.tilt <= 20, `run ${run} ball ${b.id}: ${f.angle.toFixed(1)} degrees off, leaning ${f.tilt.toFixed(1)}`);
        assert.ok(inside(b.p[0], b.p[2]) > PHYS.r - 0.02, 'a ball came to rest in a wall');
      }
    }
    assert.ok(balls.every((b) => b.mode === 'rest'), `run ${run}: not all at rest after 25 s`);
  }
  assert.equal(n, 320); assert.ok(worst <= PHYS.restAngle + 0.5, `the worst: ${worst}`);
});

test('a ball at rest in view never turns by itself; out of view it turns back to face the camera', () => {
  const rand = seeded(23), W = makeBalls({ rand }), b = W.add({ id: 1, num: 7 });
  W.launch(PORTS[0], b, rand);
  let eye = [0, 2.6, 7];
  for (let t = 0; t < 20 && b.mode !== 'rest'; t += 1 / 60) W.step(1 / 60, { eye, sees: () => true });
  assert.equal(b.mode, 'rest');
  // the camera walks round it, looking at it all the while: the ball keeps still
  const q0 = [...b.q];
  for (let t = 0; t < 3; t += 1 / 60) { eye = [b.p[0] + Math.sin(t) * 5, 2.6, b.p[2] + Math.cos(t) * 5]; W.step(1 / 60, { eye, sees: () => true }); }
  assert.deepEqual(b.q, q0);
  const off = facing(b, eye).angle; assert.ok(off > 25, `the camera went round it (${off.toFixed(1)} degrees off)`);
  // the camera turns away: it turns back to face where the camera now is, quietly
  for (let t = 0; t < 2; t += 1 / 60) W.step(1 / 60, { eye, sees: () => false });
  const f = facing(b, eye);
  assert.ok(f.angle <= 20 && f.tilt <= 20, `${f.angle.toFixed(1)} / ${f.tilt.toFixed(1)}`);
  assert.equal(b.mode, 'rest');
});

// ── the other player ───────────────────────────────────────────────────────────────────────────────────────────────
const SKILLS = {
  slow: { think: [4, 8], aim: [3, 6], acc: 0.65 },
  mid: { think: [2, 4.5], aim: [1.2, 3], acc: 0.8 },
  quick: { think: [0.8, 2], aim: [0.5, 1.2], acc: 0.95 },
};
function rounds(skill, level, n, seed) {
  const rand = seeded(seed), out = [];
  let rate = OTHER.youRate;
  for (let r = 0; r < n; r++) {
    const G = makeRound({ set: LADDER[r % LADDER.length], rand, other: { level }, youRate: rate });
    const res = playRound(G, simPlayer({ ...SKILLS[skill], rand }));
    rate = G.rateAfter();
    if (r >= 2) out.push(res);   // (the first two rounds find the player's pace, as a new player's do)
  }
  return out;
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

test('the other player is fair: at each level the score gap stays small on average, for slow and quick players alike', () => {
  const report = [];
  for (const skill of Object.keys(SKILLS)) for (let level = 0; level < 3; level++) {
    const R = rounds(skill, level, 12, 100 + level * 7 + skill.length), gaps = R.map((r) => r.them - r.you);
    const m = mean(gaps), abs = mean(gaps.map(Math.abs)), most = Math.max(...gaps.map(Math.abs));
    report.push(`${skill}/${OTHER.levels[level].key}: you ${mean(R.map((r) => r.you)).toFixed(1)}, them ${mean(R.map((r) => r.them)).toFixed(1)}, gap ${m.toFixed(2)}`);
    // nobody steamrolls: the gap is a few balls at most, on average and in any one round
    assert.ok(abs <= 3, `${skill}/${level}: the gap averaged ${abs.toFixed(2)}`);
    assert.ok(most <= 8, `${skill}/${level}: a round ended ${most} apart`);
    // the easier player tends to lose to you, the harder to beat you, the middle one about even
    if (level === 0) assert.ok(m < 0.5, `${skill}: the easier one wins on average (${m.toFixed(2)})`);
    if (level === 1) assert.ok(Math.abs(m) <= 1.6, `${skill}: the fair match is not even (${m.toFixed(2)})`);
    if (level === 2) assert.ok(m > -0.5, `${skill}: the harder one loses on average (${m.toFixed(2)})`);
    // and every player has a chance: it never wins or loses every round
    if (level === 1) assert.ok(gaps.some((g) => g <= 0) && gaps.some((g) => g >= 0), `${skill}: always the same winner`);
  }
  console.log('    ' + report.join('\n    '));
});

test('the other player takes a ball the player keeps passing over', () => {
  const rand = seeded(3), S = SETS.oddeven;
  let taken = 0, passed = 0;
  for (let r = 0; r < 4; r++) {
    // (this player never picks an odd number: those are passed over again and again)
    const G = makeRound({ set: S, rand, other: { level: 1 } }), P = simPlayer({ rand, avoid: (n) => n % 2 === 1, think: [0.5, 1.5], aim: [0.4, 1] });
    const grabbed = [];
    for (let t = 0; t < 130 && G.phase !== 'end'; t += 1 / 30) {
      const you = P.step(G, 1 / 30);
      const before = G.other.holding;
      G.step(1 / 30, { eye: [you.x, 2.6, you.z + 3], sees: () => true, you });
      for (const e of G.take()) if (e.type === 'got' && e.who === 'them') { const b = G.balls.find((x) => x.id === e.ball); if (b) grabbed.push(b.passed); }
      void before;
    }
    passed += grabbed.length; taken += grabbed.filter((p) => p >= OTHER.passed).length;
  }
  assert.ok(taken >= 4, `it took ${taken} passed-over balls of ${passed} it picked`);
});

test('the other player never just stands still while it waits: it jogs about and turns', () => {
  const rand = seeded(5);
  const G = makeRound({ set: SETS.tables1, rand, other: { level: 0 } }), P = simPlayer({ rand, think: [3, 6], aim: [2, 4] });
  let still = 0, longest = 0, lastH = G.other.heading;
  for (let t = 0; t < 120 && G.phase !== 'end'; t += 1 / 30) {
    const you = P.step(G, 1 / 30);
    G.step(1 / 30, { eye: [you.x, 2.6, you.z + 3], sees: () => true, you });
    const O = G.other, moving = Math.hypot(O.vx, O.vz) > 0.15 || Math.abs(O.heading - lastH) > 0.01 || O.holding;
    lastH = O.heading;
    still = moving ? 0 : still + 1 / 30; longest = Math.max(longest, still);
  }
  assert.ok(longest < 1.5, `it stood still for ${longest.toFixed(1)} s`);
});

test('the court: every wall faces in, the goals sit across the corners, the ports in the long walls', () => {
  for (const W of WALLS) assert.ok(W.n[0] * -W.mid[0] + W.n[1] * -W.mid[1] > 0, W.name);
  assert.deepEqual(GOALS.map((g) => g.wall).sort(), [1, 3, 5, 7]);
  assert.ok(Math.abs(COURT.hz * 2 - 17.52) < 0.01 && Math.abs(COURT.hx * 2 - 9.6) < 1e-9);
  for (const p of PORTS) assert.ok(Math.abs(Math.abs(p.at[0]) - COURT.hx) < 1e-9);
  assert.ok(ROUND.start >= 6 && ROUND.most >= ROUND.start);
});
