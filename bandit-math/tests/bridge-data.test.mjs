// The bridge lab's bridge as data (labs/bridge/bridge.js): sockets on the banks' stone tops and walls, where a board rests
// on a bank, twins mirrored front to back and across the middle of the gap, lapped boards' twins, the free end hanging
// below the bank top (down to the water), the deck (both sides from bank to bank at one height; a middle board joins it),
// and the words that name a board by where it is.
// node --test tests/bridge-data.test.mjs   (from bandit-math)
import test from 'node:test';
import assert from 'node:assert/strict';

const B = await import('../labs/bridge/bridge.js');
const P = (X, Y, Z) => ({ X, Y, Z });
const bd = (a, b, id) => ({ id, a, b, len: Math.round(Math.hypot(b.X - a.X, b.Y - a.Y, b.Z - a.Z) * 1e6) / 1e6 });
const near = (p, q, e = 1e-6) => Math.abs(p.X - q.X) < e && Math.abs(p.Y - q.Y) < e && Math.abs(p.Z - q.Z) < e;

test('sockets: on each bank\'s stone top and down its wall, across the bridge\'s width, on the half foot', () => {
  const br = B.newBridge(16, 7), s = B.socketsOf(br);
  const tops = s.filter((q) => q.kind === 'top'), faces = s.filter((q) => q.kind === 'face');
  assert.equal(tops.length, 2 * 7 * 15, 'tops: 7 rows back from each edge (3 ft of stone), 15 across');
  assert.equal(faces.length, 2 * 8 * 15, 'walls: 8 rows down to 4 ft, 15 across');
  assert.ok(tops.every((q) => Math.abs(q.X) >= 8 - 1e-9 && Math.abs(q.X) <= 11 + 1e-9 && q.Y === 0));
  assert.ok(faces.every((q) => Math.abs(Math.abs(q.X) - 8) < 1e-9 && q.Y < 0 && q.Y >= -4));
  // and along a board, every half foot from its ends
  br.boards.push(bd(P(-8.5, 0, 3.5), P(-0.5, 0, 3.5), 'a'));
  const on = B.socketsOf(br).filter((q) => q.on && q.on.id === 'a');
  assert.ok(on.length >= 15 && on.some((q) => near(q, P(-4, 0, 3.5))), 'sockets along the board, 4 ft out among them');
});

test('where a board rests: a board across a bank\'s edge bears at the edge, an end on a wall bears into the stone', () => {
  const br = B.newBridge(16, 7);
  const lying = B.supportsOf(br, bd(P(-8.5, 0, 3.5), P(-0.5, 0, 3.5)));
  assert.equal(lying.length, 1); assert.ok(near(lying[0].P, P(-8, 0, 3.5)), 'at the stone edge, not its end further back');
  const strut = B.supportsOf(br, bd(P(-8, -3, 3.5), P(-4, 0, 3.5)));
  assert.equal(strut.length, 1); assert.equal(strut[0].kind, 'face'); assert.deepEqual(strut[0].n, [1, 0, 0]);
  assert.equal(B.supportsOf(br, bd(P(-2, 0, 3.5), P(2, 0, 3.5))).length, 0, 'a board out over the water rests on nothing');
  // and what touches nothing falls
  br.boards.push(bd(P(-8.5, 0, 3.5), P(-0.5, 0, 3.5), 'a'), bd(P(-2, 2, 3.5), P(2, 2, 3.5), 'lost'));
  const g = B.grounded(br);
  assert.ok(g.has(br.boards[0]) && !g.has(br.boards[1]));
});

test('twins: front to back, across the middle of the gap, and both; a lapped board\'s twin too', () => {
  const br = B.newBridge(16, 7);
  const west = bd(P(-8.5, 0, 3.5), P(-0.5, 0, 3.5), 'w');
  const tw = B.twinsOf(br, west);
  assert.equal(tw.length, 3);
  assert.ok(tw.some((g) => near(g.a, P(-8.5, 0, -3.5))), 'the back side');
  assert.ok(tw.some((g) => near(g.a, P(8.5, 0, 3.5))), 'the east end');
  assert.ok(tw.some((g) => near(g.a, P(8.5, 0, -3.5))), 'both');
  // the middle piece lapping the west and east pieces: its twin on the back is offered, and not taken by a lap
  br.boards.push(west, bd(P(0.5, 0, 3.5), P(8.5, 0, 3.5), 'e'), bd(P(-8.5, 0, -3.5), P(-0.5, 0, -3.5), 'wb'), bd(P(0.5, 0, -3.5), P(8.5, 0, -3.5), 'eb'));
  const mid = bd(P(-4, 0, 3.5), P(4, 0, 3.5), 'm'), mt = B.twinsOf(br, mid);
  assert.equal(mt.length, 1); assert.ok(near(mt[0].a, P(-4, 0, -3.5)));
  assert.equal(B.spotTaken(br, mt[0]), false, 'a lap of 3½ ft over an 8 ft board is no taken spot');
  assert.equal(B.spotTaken(br, bd(P(-8, 0, 3.5), P(-1, 0, 3.5))), true, 'a board lying along most of another is');
  // a diagonal's mirror on its own side would cross it in an X: that is the builder's call, not a twin
  const d = bd(P(-4, 0, 3.5), P(0, -4, 3.5));
  assert.ok(!B.twinsOf(br, bd(P(-2, 0, 3.5), P(2, -4, 3.5))).some((g) => near(g.a, P(2, 0, 3.5)) && near(g.b, P(-2, -4, 3.5))), 'no X twin');
  assert.ok(B.twinsOf(br, d).length >= 2);
});

test('the free end hangs below the bank top, down to the water and no further', () => {
  assert.deepEqual(B.freeEnd(P(-4, 0, 3.5), 4, 0, 0, -1), P(-4, -4, 3.5));
  assert.equal(B.freeEnd(P(0, 0, 0), 8, 0, 0, -1), null, 'eight feet down is under the water');
  assert.equal(B.freeEnd(P(0, 0, 0), 4, 5, 0, 1), null, 'too short to reach that far over');
});

test('the deck: both sides from bank to bank at one height, a plank every 8 inches; a middle board joins it', () => {
  const br = B.newBridge(16, 7);
  const line = (Z, t) => [bd(P(-8.5, 0, Z), P(-0.5, 0, Z), t + 'w'), bd(P(0.5, 0, Z), P(8.5, 0, Z), t + 'e'), bd(P(-4, 0, Z), P(4, 0, Z), t + 'm')];
  br.boards.push(...line(3.5, 'f'));
  assert.ok(/back side/.test(B.deckLine(br).why), 'one side only: no deck yet');
  br.boards.push(...line(-3.5, 'k').slice(0, 2));
  assert.ok(B.deckLine(br).why, 'a gap in the back line: no deck');
  br.boards.push(line(-3.5, 'k')[2]);
  const d = B.deckLine(br);
  assert.equal(d.y, 0); assert.equal(d.planks.length, 24); assert.equal(d.on.length, 6);
  assert.ok(Math.abs(d.planks[1].X - d.planks[0].X - 8 / 12) < 1e-6, 'one every 8 inches');
  assert.ok(Math.abs(d.planks[0].len - (7 + 1.5 / 12)) < 1e-6, 'each flush with the outer faces of the boards it rests on');
  br.boards.push(bd(P(-4, 0, 0), P(4, 0, 0), 'mid'));
  assert.ok(B.deckLine(br).on.includes('mid'), 'a board along the middle under the planks carries them too');
});

test('words: a board named by what it is and where, its lengths spelled out in a sentence', () => {
  const br = B.newBridge(16, 7);
  br.boards.push(bd(P(-8.5, 0, 3.5), P(-0.5, 0, 3.5), 'w'), bd(P(-8.5, 0, -3.5), P(-0.5, 0, -3.5), 'wb'), bd(P(0.5, 0, 3.5), P(8.5, 0, 3.5), 'e'), bd(P(0.5, 0, -3.5), P(8.5, 0, -3.5), 'eb'),
    bd(P(-4, 0, 3.5), P(4, 0, 3.5), 'm'), bd(P(-4, 0, -3.5), P(4, 0, -3.5), 'mb'));
  br.deck = B.deckLine(br);
  assert.equal(B.placeWords(br, br.boards[0]), 'the bottom board on the front, 3½ ft out from the west bank');
  assert.equal(B.spellUnits(B.placeWords(br, bd(P(-8, 0, 3.5), P(-4, -4, 3.5)))), 'the diagonal on the front, 2 feet out from the west bank, reaching 4 feet below the deck');
  assert.equal(B.placeWords(br, bd(P(-4, 0, 3.5), P(-4, -4, 3.5))), 'the post on the front, 4 ft out from the west bank, reaching 4 ft below the deck');
  assert.equal(B.placeWords(br, bd(P(-8, -4, 3.5), P(-8, -1, 3.5))), 'the post on the front, on the west bank, 4 ft down the stone wall');
  assert.deepEqual(B.pointWords(P(-3, -4, 3.5)), ['3 ft west', '3½ ft front', '4 ft down']);
  assert.deepEqual(B.pointWords(P(3, 4, -3.5)), ['3 ft east', '3½ ft back', '4 ft up']);
});
