// THE SMALL MOVES' RULES (the review, 2026-11-27): who gets the stance and the hands on the work (by distance and the
// picture's quality), each person's own moments for the weight going over, the stepped turn, the desk sitters' place,
// and the way round a stool kept to its clear side.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fineFor, FINE, nextStance, STANCE, turnStep, TURN_STEP, deskSeat, DESK_SIT } from '../src/finemoves.js';
import { seatSteps, roundAt, SIT } from '../src/seatsteps.js';

test('the stance and the hands on the work: near, above the low quality; the hands never on the far copy', () => {
  for (const q of ['medium', 'high']) {
    assert.deepEqual(fineFor(q, 3), { stance: true, hands: true }, q + ' near');
    assert.deepEqual(fineFor(q, 3, false, true), { stance: true, hands: false }, q + ' near, the far copy');
    assert.deepEqual(fineFor(q, FINE.near + 0.5), { stance: false, hands: false }, q + ' past the near');
    // (let go a metre past where it was taken up: no flicker at the edge)
    assert.equal(fineFor(q, FINE.near + 0.5, true).stance, true);
    assert.equal(fineFor(q, FINE.near + FINE.give + 0.1, true).stance, false);
    assert.equal(fineFor(q, 30).stance, false);
  }
  for (const far of [0, 3, 8]) assert.deepEqual(fineFor('low', far), { stance: false, hands: false }, 'never on low');
});

test('the weight goes over at each person\'s own moments, from one leg to the other or to both', () => {
  // (two people, each their own random numbers: their changes never in step)
  const seq = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  const times = (rand) => { let w = 1, t = 0; const out = []; for (let i = 0; i < 8; i++) { const n = nextStance(w, false, rand); w = n.want; t += n.after; out.push(+t.toFixed(3)); } return out; };
  const a = times(seq(7)), b = times(seq(91));
  assert.notDeepEqual(a, b);
  for (let i = 0; i < 400; i++) {
    const r = seq(i + 1), n = nextStance([1, -1, 0][i % 3], i % 2 === 1, r);
    assert.ok([1, -1, 0].includes(n.want));
    if ((i % 3) === 2) assert.notEqual(n.want, 0, 'from both legs, onto one');
    assert.ok(n.after >= STANCE.every[0] * 0.5 * 0.45 - 1e-9 && n.after <= STANCE.every[1] + 1e-9, 'a while, not every moment');
  }
});

test('a turn on the spot bigger than a small one is stepped round, the legs walking it; the last of it stood', () => {
  assert.deepEqual(turnStep(TURN_STEP / 2, false), { stepping: false, clip: 'stand' });
  assert.deepEqual(turnStep(TURN_STEP + 0.1, false), { stepping: true, clip: 'walk' });
  // (once stepping, the steps go on to the end of the turn, and stop as it is done)
  assert.deepEqual(turnStep(0.2, true), { stepping: true, clip: 'walk' });
  assert.deepEqual(turnStep(0.02, true), { stepping: true, clip: 'stand' });
});

test('a desk chair\'s sitter sits forward of its middle, nearer the desk; stood first in front of the chair itself', () => {
  assert.ok(DESK_SIT > 0.08 && DESK_SIT < 0.2);
  const seat = deskSeat([1, 0.5, 2], [0, 0, 1]);
  assert.deepEqual(seat, [1, 0.5, 2 + DESK_SIT]);
  // (people.js gives a desk seat pre = SIT.pre - DESK_SIT: where they stand is where it was before they sat forward)
  const { down } = seatSteps({ seat, heading: 0, pos: [1.6, 0, 2 + DESK_SIT], pre: SIT.pre - DESK_SIT });
  const before = down[down.length - 2].to;
  assert.ok(Math.abs(before[2] - (2 + SIT.pre)) < 1e-9, JSON.stringify(before));
});

test('the way round a stool: the side kept clear of what is there; neither clear, straight to its front', () => {
  // (the smelter control room's long table, station.json: its top x 50.2 to 52.2, z -23.75 to -22.85; a stool south of
  // it, at (51.7, -24), its sitter facing the table (+z), stood 0.55 m behind it to sit)
  const inTable = (p) => p[0] > 50.2 - 0.1 && p[0] < 52.2 + 0.1 && p[2] > -23.75 - 0.1 && p[2] < -22.85 + 0.1;
  const S = { seat: [51.7, 0, -24], heading: 0, pos: [51.7, 0, -24.55] };
  const sides = [1, -1].map((k) => ({ k, p: roundAt(S, k) }));
  // (both sides' points lie in or by the long table: the way round is no way there)
  assert.ok(sides.every((s) => inTable(s.p)), JSON.stringify(sides));
  // (what people.js keeps: a clear side, else 0, straight to the front)
  const kept = sides.find((s) => !inTable(s.p))?.k ?? 0;
  const straight = seatSteps({ ...S, round: kept });
  assert.equal(kept, 0);
  assert.ok(straight.down.every((m) => !(m.move === 'walk' && inTable(m.to) && Math.hypot(m.to[0] - S.seat[0], m.to[2] - S.seat[2]) > SIT.preTable + 0.01)), 'no step into the table');
  // (at a round table one side is clear: that side is the one walked)
  const T = { seat: [0, 0, 0], heading: 0, pos: [0, 0, -0.55] }, wall = (p) => p[0] < -0.3;     // (a wall on their right)
  const k = [1, -1].find((s) => !wall(roundAt(T, s)));
  assert.equal(k, 1);
  const w = seatSteps({ ...T, round: k }).down.find((m) => m.move === 'walk');
  assert.ok(w.to[0] > 0.4, 'round by their left');
  assert.deepEqual(w.to, roundAt(T, 1));
});
