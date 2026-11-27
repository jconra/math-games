// THE SMALL MOVES' RULES (the review, 2026-11-27): who gets the stance and the hands on the work (by distance and the
// picture's quality), each person's own moments for the weight going over, the stepped turn, the desk sitters' place,
// and the way round a stool kept to its clear side.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fineFor, FINE, nextStance, STANCE, turnStep, TURN_STEP, deskSeat, DESK_SIT } from '../src/finemoves.js';
import { seatSteps, roundAt, SIT, wayClear } from '../src/seatsteps.js';

test('the stance and the hands on the work: near, above the low quality; the stance on medium only on the full copy', () => {
  for (const q of ['medium', 'high']) {
    assert.deepEqual(fineFor(q, 3), { stance: true, hands: true }, q + ' near');
    assert.deepEqual(fineFor(q, 3, false, true), { stance: q === 'high', hands: true }, q + ' near, the far copy: the hands held, no change as the player walks up');
    assert.equal(fineFor(q, FINE.near + 0.5, false, false, {}, true).hands, true, 'the hands let go a metre past');
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

test('the way round a stool, through the very check the station uses: clear of a long table, of a round one, and of the stool itself', () => {
  // (furniture as the walls feel it: a long table's top at 0.75 m, x 50.2 to 52.2, z -23.75 to -22.85; a round cafe
  // table, radius 0.4, its middle 0.7 m ahead of a stool at the origin; each stool a cushion of radius 0.18 at 0.5 m)
  const longTop = (x, z) => x > 50.2 && x < 52.2 && z > -23.75 && z < -22.85;
  const roundTop = (x, z) => Math.hypot(x, z - 0.7) < 0.4;
  const stools = [[0, 0, 0], [51.7, 0, -24]];
  const solidAt = (x, y, z) => (y < 0.75 && (longTop(x, z) || roundTop(x, z))) || (y > 0.4 && y < 0.55 && stools.some((s) => Math.hypot(x - s[0], z - s[2]) < 0.18));
  const floorAt = (x, z) => (longTop(x, z) || roundTop(x, z) ? 0.75 : 0);
  // the long table's stool, its sitter facing the table (+z), stood 0.55 m behind it: no side is clear: not used
  const L = { seat: [51.7, 0, -24], heading: 0, pos: [51.7, 0, -24.55] };
  assert.deepEqual([1, -1].map((k) => wayClear(seatSteps({ ...L, round: k }), L.pos, L.seat, solidAt, floorAt)), [false, false]);
  // a cafe stool: both sides clear of the table, and of the stool's own cushion with the walker's width
  const C = { seat: [0, 0, 0], heading: 0, pos: [0, 0, -0.55] };
  assert.deepEqual([1, -1].map((k) => wayClear(seatSteps({ ...C, round: k }), C.pos, C.seat, solidAt, floorAt)), [true, true]);
  // (and never a way that passes the stool nearer than its cushion and a half width: the old way round grazed it)
  const old = { ...SIT };
  try { SIT.round = 0.52; SIT.aside = 0.3; assert.equal(wayClear(seatSteps({ ...C, round: 1 }), C.pos, C.seat, solidAt, floorAt), false); } finally { Object.assign(SIT, old); }
  // a wall on their right: that side is not clear, the left is
  const wall = (x, y, z) => solidAt(x, y, z) || x < -0.45;
  assert.deepEqual([1, -1].map((k) => wayClear(seatSteps({ ...C, round: k }), C.pos, C.seat, wall, floorAt)), [true, false]);
  assert.ok(roundAt(C, 1)[0] > 0.5, 'round by their left');
});

test('getting up always ends, and nobody is moved by it: the player on the spot first keeps them seated, later lets them finish where they stand', async () => {
  const { riseStep } = await import('../src/seatsteps.js');
  // (a stool's way up: rise, turn, walk, turn, walk: 5 steps)
  assert.equal(riseStep(0, 5, null, 0, 3), 'go');
  assert.equal(riseStep(0, 5, 'player', 0, 3), 'seated', 'the player there before they rise: they stay seated, as the game had it');
  for (const si of [1, 2, 4]) assert.equal(riseStep(si, 5, 'player', 0, 3), 'done', 'the player there once they are up: done where they stand');
  assert.equal(riseStep(4, 5, 'other', 1, 3), 'hold', 'someone else on the spot: a short wait standing');
  assert.equal(riseStep(4, 5, 'other', 3.01, 3), 'done', '... never longer than the wait');
  assert.equal(riseStep(2, 5, 'other', 0, 3), 'go', 'someone near the spot before the last step: on with the steps');
  // (whatever happens, the rule never gives a place to be put: 'done' is where they stand)
  for (const by of [null, 'player', 'other']) for (let si = 0; si < 5; si++) assert.ok(['go', 'seated', 'done', 'hold'].includes(riseStep(si, 5, by, 0, 3)));
});

test('the out-of-reach alarm: a settled hold short past its arm counts, one being taken up or let go never does', async () => {
  const { reachShort, OUT_OF_REACH } = await import('../src/finemoves.js');
  assert.equal(reachShort(OUT_OF_REACH.settle + 0.1, 0.05), 0.05);
  assert.equal(reachShort(0.5, 0.05), 0, 'still being taken up');
  assert.equal(reachShort(5, 0.01), 0, 'within a hand\'s give');
});

test('a desk\'s sitter is never drawn forward of the chair\'s cushion (its front 0.23 m forward of the chair\'s middle)', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/people.js', import.meta.url), 'utf8');
  const cushion = +/DESK_CUSHION = ([0-9.]+)/.exec(src)[1];
  assert.equal(cushion, 0.23);
  // (the step in a sitter is given: at most the cushion's front less the seat's own forward place, whatever the desk)
  assert.match(src, /Math\.min\(DESK_CUSHION - DESK_SIT, f\.d - DESK_REACH\)/);
  for (const d of [0.4, 0.46, 0.5, 0.7, 1]) assert.ok(DESK_SIT + Math.max(0, Math.min(cushion - DESK_SIT, d - 0.45)) <= cushion + 1e-9, String(d));
});
