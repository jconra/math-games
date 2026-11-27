// POSES 1: one person to a bench seat, a seat's steps (sitting down and getting up as a person does), the forklift
// climbed onto, the talkers' turns, the hands on the work.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SEAT_APART, SEATS } from '../src/life.js';
import { seatSteps, leanOf, SIT, mountAt, MOUNT } from '../src/seatsteps.js';
import { talkRole } from '../src/chatter.js';
import { surfaceAhead, handsAt, wheelLocal, FORKLIFT_WHEEL } from '../src/atwork.js';

const flat = (p, q) => Math.hypot(p[0] - q[0], p[2] - q[2]);
// (a bench, kit/furniture.js chair 'bench': 1.7 m long; a seated person's hips about 0.42 m across)
const BENCH = 1.7, HIPS = 0.42;

test('a bench seats two at its two ends, a person\'s width and more apart, each on the bench', () => {
  assert.ok(SEATS.window.every((d) => d.two), 'the window benches seat two');
  assert.ok(SEAT_APART >= HIPS * 2 + 0.25, `two strangers keep a hand's breadth and more between them (${SEAT_APART} m middle to middle)`);
  assert.ok(SEAT_APART / 2 + HIPS / 2 <= BENCH / 2 + 1e-9, 'each sitter wholly on the bench');
});

const bench = { seat: [0, 0, 0], heading: 0, pos: [0, 0, 0.5] };        // (stood in front of it)
const desk = { seat: [0, 0, 0], heading: 0, pos: [0.6, 0, 0] };         // (beside the chair)
const stool = { seat: [0, 0, 0], heading: 0, pos: [0, 0, -0.55] };      // (behind the stool, its table ahead)

test('sitting down: to just in front of the seat, its back to it, then lowered onto it', () => {
  for (const [name, S] of [['bench', bench], ['desk', desk], ['stool', stool]]) {
    const { down } = seatSteps(S);
    const last = down[down.length - 1], before = down[down.length - 2];
    assert.equal(last.move, 'lower', name + ': the last step lowers them onto it');
    assert.deepEqual(last.to, S.seat, name + ': onto the seat');
    assert.ok(Math.abs(flat(before.to, S.seat) - (name === 'stool' ? SIT.preTable : SIT.pre)) < 1e-9, name + ': stood just in front of it first');
    assert.equal(before.heading, S.heading, name + ': facing the way it faces as they lower');
    assert.ok(down.every((s) => s.secs >= SIT.least), name + ': no step snapped');
    // (nothing walks through the seat: every point a step goes through is clear of it but the lowering)
    let at = S.pos;
    for (const s of down.slice(0, -1)) {
      for (let u = 0; u <= 1; u += 0.05) { const p = [at[0] + (s.to[0] - at[0]) * u, 0, at[2] + (s.to[2] - at[2]) * u]; assert.ok(flat(p, S.seat) >= SIT.preTable - 0.02, `${name}: ${s.move} passes ${flat(p, S.seat).toFixed(2)} m from the seat's middle`); }
      at = s.to;
    }
  }
  assert.equal(seatSteps(bench).down.find((s) => s.to !== bench.pos && s.move !== 'turn').move, 'back', 'a bench: a step back to it');
  assert.equal(seatSteps(desk).down[0].move, 'walk', 'a desk chair: walked round in front of it');
  for (const S of [bench, desk, stool]) assert.ok([...seatSteps(S).down, ...seatSteps(S).up].every((s) => ['walk', 'back', 'turn', 'lower', 'rise'].includes(s.move)), 'never a sideways run');
  assert.equal(seatSteps(stool).down[0].move, 'walk', 'a stool from behind: round to its side first');
});

test('getting up: up off the seat leaning forward, back to where they stood the way they came', () => {
  for (const S of [bench, desk, stool]) {
    const { down, up } = seatSteps(S);
    assert.equal(up[0].move, 'rise');
    assert.deepEqual(up[up.length - 1].to, S.pos, 'back where they stood');
    assert.ok(leanOf(up[0], 0.4) > 0.3, 'leaning forward as the weight comes off the seat');
    assert.ok(leanOf(down[down.length - 1], 0.6) > 0.3, 'leaning forward as they lower');
    assert.equal(leanOf(up[0], 1), 0, 'upright once up');
  }
});

test('the forklift: turned, up and across onto it standing, then down onto the seat; off the same way back', () => {
  const floor = 0, seat = 0.56;
  let y0 = -1;
  for (let k = 0; k <= 1.0001; k += 0.02) {
    const m = mountAt(k, true, floor, seat);
    if (m.across > 0.02 && m.across < 0.98) assert.equal(m.clip, 'walk', 'climbing across, the legs step');
    if (m.clip === 'sit') assert.equal(m.across, 1, 'sitting only over the seat');
    if (k <= MOUNT.climb) { assert.ok(m.y >= y0 - 1e-9, 'up, never down, while climbing'); y0 = m.y; }
  }
  assert.ok(Math.abs(mountAt(1, true, floor, seat).y - seat) < 1e-9, 'seated at the end');
  assert.equal(mountAt(0, true, floor, seat).y, floor);
  assert.ok(Math.abs(mountAt(1, false, floor, seat).y - floor) < 1e-9, 'off: on the floor at the end');
  assert.equal(mountAt(0.1, false, floor, seat).clip, 'stand', 'off: standing up off the seat first');
});

test('two talking: one talks with their hands, the other listens, by turns, never both and never neither', () => {
  const A = {}, B = {}, C = { A, B, speaking: null, last: null };
  const lines = [A, B, B, A, B];
  for (const S of lines) {
    for (const phase of ['line', 'gap']) {
      if (phase === 'line') C.speaking = S; else { C.last = C.speaking; C.speaking = null; }
      const r = [talkRole(A, C), talkRole(B, C)];
      assert.deepEqual(r.sort(), ['listen', 'speak'], `${phase}: ${r}`);
      assert.equal(talkRole(S, C), 'speak', 'the one speaking, and between lines the one who spoke last');
    }
  }
});

test('hands on the work land on its top, within an arm\'s reach of where they stand', () => {
  // (a desk 0.78 m high whose front edge is 0.62 m ahead)
  const floorAt = (x, z, top, drop) => { const h = z >= 0.62 && z <= 1.6 ? 0.78 : 0; return h <= top && h >= top - drop ? h : (0 <= top && 0 >= top - drop ? 0 : null); };
  const f = surfaceAhead(floorAt, [0, 0, 0], 0, { from: 0.3, to: 1.0, lo: 0.6, hi: 0.95 });
  assert.ok(f && Math.abs(f.d - 0.65) < 0.051 && f.y === 0.78, JSON.stringify(f));
  assert.equal(surfaceAhead(floorAt, [0, 0, 0], Math.PI, { from: 0.3, to: 1.0, lo: 0.6, hi: 0.95 }), null, 'nothing behind');
  const S = { at: [0, f.y, f.d], heading: 0 };
  for (const kind of ['desk', 'panel', 'wipe']) for (let t = 0; t < 12; t += 0.37) {
    const { hands, lean } = handsAt(kind, S, t, 4.2);
    for (const h of hands) {
      assert.ok(h[1] >= f.y && h[1] < f.y + 0.05, `${kind}: on its top (${h[1].toFixed(3)})`);
      assert.ok(h[2] >= f.d - 1e-9 && h[2] < f.d + 0.3, `${kind}: past its near edge, not far in (${h[2].toFixed(3)})`);
    }
    assert.ok(hands[0][0] > hands[1][0], `${kind}: the left hand on their left`);
    // (bowed over it, low in the back, as far as their reach needs (atwork.js REACH, tests/reach.test.mjs): never folded over)
    assert.ok(lean > 0 && lean <= 0.8, kind + ': leaning in, not folded over');
  }
  // (the forklift's wheel: both hands on its rim, one each side, its own radius from its middle)
  const [L, R] = wheelLocal(0.53), W = FORKLIFT_WHEEL, c = [0, 0.53 + W.up, W.ahead];
  assert.ok(L[0] > 0 && R[0] < 0, 'left hand on the left');
  for (const h of [L, R]) assert.ok(Math.abs(Math.hypot(h[0] - c[0], h[1] - c[1], h[2] - c[2]) - W.r) < 0.04, 'on the rim');
});
