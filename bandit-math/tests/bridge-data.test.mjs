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

test('twins: north to south, across the middle of the gap, and both; a lapped board\'s twin too', () => {
  const br = B.newBridge(16, 7);
  const west = bd(P(-8.5, 0, 3.5), P(-0.5, 0, 3.5), 'w');
  const tw = B.twinsOf(br, west);
  assert.equal(tw.length, 3);
  assert.ok(tw.some((g) => near(g.a, P(-8.5, 0, -3.5))), 'the north side');
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
  assert.ok(/north side/.test(B.deckLine(br).why), 'one side only: no deck yet');
  br.boards.push(...line(-3.5, 'k').slice(0, 2));
  assert.ok(B.deckLine(br).why, 'a gap in the north line: no deck');
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
  assert.equal(B.placeWords(br, br.boards[0]), 'the bottom board on the south side, 3½ ft out from the west bank');
  assert.equal(B.spellUnits(B.placeWords(br, bd(P(-8, 0, 3.5), P(-4, -4, 3.5)))), 'the diagonal on the south side, 2 feet out from the west bank, reaching 4 feet below the deck');
  assert.equal(B.placeWords(br, bd(P(-4, 0, 3.5), P(-4, -4, 3.5))), 'the post on the south side, 4 ft out from the west bank, reaching 4 ft below the deck');
  assert.equal(B.placeWords(br, bd(P(-8, -4, 3.5), P(-8, -1, 3.5))), 'the post on the south side, on the west bank, 4 ft down the stone wall');
  assert.deepEqual(B.pointWords(P(-3, -4, 3.5)), ['3 ft west', '3½ ft south', '4 ft down']);
  assert.deepEqual(B.pointWords(P(3, 4, -3.5)), ['3 ft east', '3½ ft north', '4 ft up']);
});

test('the arrows: only the two pairs across the board show', () => {
  assert.deepEqual(B.arrowAxes(P(-8, 0, 3.5), P(-8, 8, 3.5)).across, ['X', 'Z'], 'a post: green and blue');
  assert.deepEqual(B.arrowAxes(P(-8, 0, 3.5), P(0, 0, 3.5)).across, ['Y', 'Z'], 'along the span: red and blue');
  assert.deepEqual(B.arrowAxes(P(0, 0, -3.5), P(0, 0, 3.5)).across, ['X', 'Y'], 'across the bridge: green and red');
  assert.deepEqual(B.arrowAxes(P(-8, 0, 3.5), P(-2, 4, 3.5)).across, ['Y', 'Z'], 'a flat diagonal along the span: red and blue');
  assert.deepEqual(B.arrowAxes(P(-8, 0, 3.5), P(-4, 6, 3.5)).across, ['X', 'Z'], 'a steep one: green and blue');
  assert.equal(B.arrowStep(P(-8, 0, 3.5), P(-8, 8, 3.5), 8, 'Y', -1), null, 'an arrow not showing does nothing');
});

test('the arrows: a board from a stone-top socket comes down to exactly level, half a foot a press, from any end', () => {
  // the way a builder lays it: green east while it stands steep, then red down (the windmill's arrows could only reach
  // level where dx² + dz² = L² on the half-foot grid: never with its end half a foot back, or with a sawn length)
  for (const [A, len, back] of [[P(-8.5, 0, 3.5), 8, 0], [P(-8, 0, 3.5), 8, 0.5], [P(-8, 0, 3.5), 5.657, 0], [P(-4, -4, 3.5), 7.25, 1]]) {
    let b = P(A.X, A.Y + len, A.Z);
    for (let i = 0; i < back * 2; i++) b = B.arrowStep(A, b, len, 'Z', -1);
    const ys = [];
    for (let i = 0; i < 60 && Math.abs(b.Y - A.Y) > 1e-9; i++) {
      const down = B.arrowAxes(A, b).across.includes('Y');
      b = B.arrowStep(A, b, len, down ? 'Y' : 'X', down ? -1 : 1);
      assert.ok(b, `a stop every press (len ${len})`);
      if (down) ys.push(b.Y);
    }
    assert.ok(Math.abs(b.Y - A.Y) < 1e-9, `level at last (len ${len}, end ${back} ft back): ${b.Y}`);
    assert.ok(Math.abs(Math.hypot(b.X - A.X, b.Y - A.Y, b.Z - A.Z) - len) < 1e-5, 'its length kept');
    assert.ok(ys.every((y) => Number.isInteger(+(y * 2).toFixed(6)) || Math.abs(y - A.Y) < 1e-9), `red stops on the half foot from the bank top, or level: ${ys}`);
  }
  // one press below level is half a foot down, not a jump; the sign of its run is kept
  const A = P(-8, 0, 3.5), lv = P(0, 0, 3.5), below = B.arrowStep(A, lv, 8, 'Y', -1);
  assert.ok(Math.abs(below.Y + 0.5) < 1e-9 && below.X > A.X, JSON.stringify(below));
  assert.deepEqual(B.arrowStep(A, below, 8, 'Y', 1), lv);
});

test('the arrows: a post leans and comes back straight; a board too short says so; never under the water', () => {
  const A = P(-10, 0, 2.5);
  let b = B.arrowStep(A, P(-10, 8, 2.5), 8, 'X', 1);
  assert.ok(Math.abs(b.X + 9.5) < 1e-9 && b.Y < 8);
  b = B.arrowStep(A, b, 8, 'Z', -1); assert.ok(Math.abs(b.Z - 2) < 1e-9);
  b = B.arrowStep(A, b, 8, 'X', -1); b = B.arrowStep(A, b, 8, 'Z', 1);
  assert.deepEqual(b, P(-10, 8, 2.5), 'straight up again: the socket\'s own X and Z are stops');
  assert.equal(B.arrowStep(P(0, 0, 0), P(4, 0, 0), 4, 'Y', 1) && B.arrowStep(P(0, 0, 0), P(0.0, 4, 0), 4, 'X', 1) !== null, true);
  let t = P(4, 0, 0); for (let i = 0; i < 20 && t; i++) t = B.arrowStep(P(0, 0, 0), t, 4, 'Z', 1) || null;
  assert.equal(B.arrowStep(P(0, 0, 0), P(0, 0, 4), 4, 'Z', 1), null, 'too short to reach any further that way');
  assert.equal(B.arrowStep(P(0, -2, 0), P(4, -2, 0), 4, 'Y', -1).Y, -2.5);
  let w = P(4, -2, 0); for (let i = 0; i < 10; i++) w = B.arrowStep(P(0, -2, 0), w, 4, 'Y', -1) || w;
  assert.ok(w.Y >= B.WATER_Y - 1e-9, `never below the water: ${w.Y}`);
});

test('the deck meets the road: refused on boards below the stone tops, laid at the stone tops\' height on road-height boards', () => {
  const lines = (y, tag) => [-3.5, 3.5].flatMap((Z) => [bd(P(-8.5, y, Z), P(-0.5, y, Z), tag + Z + 'w'), bd(P(0.5, y, Z), P(8.5, y, Z), tag + Z + 'e'), bd(P(-4, y, Z), P(4, y, Z), tag + Z + 'm')]);
  // both sides from bank to bank, a foot and a half below the stone tops: no deck there, and the words say why
  const low = { ...B.newBridge(16, 7) }; low.boards = lines(-1.5, 'lo');
  const d = B.deckLine(low);
  assert.equal(d.planks, undefined, 'never a sunk deck');
  assert.match(d.why, /The deck has to meet the road: put a board on each side from the top of one stone to the other/);
  assert.match(d.why, /1½ feet below the road/);
  assert.deepEqual(d.missing, ['south', 'north']);
  // and a raised line (a side rail 3 ft up) is no deck line either
  const high = { ...B.newBridge(16, 7) }; high.boards = lines(3, 'hi');
  assert.equal(B.deckLine(high).planks, undefined, 'never a raised deck');
  // boards at road height: laid there, the low ones under them left as supports
  const both = { ...B.newBridge(16, 7) }; both.boards = [...lines(-1.5, 'lo'), ...lines(0, 'rd')];
  const ok = B.deckLine(both);
  assert.equal(ok.y, 0); assert.equal(ok.planks.length, 24);
  assert.ok(ok.on.every((id) => id.startsWith('rd')), 'the planks rest on the road-height boards only');
  assert.ok(ok.planks.every((p) => Math.abs(p.a.Y - B.DECK_LIFT) < 1e-9), 'the planks at the stone tops\' height (their line just over the boards\' line)');
  // only one side at road height: says which side still needs one
  const one = { ...B.newBridge(16, 7) }; one.boards = lines(0, 'rd').filter((b) => b.a.Z > 0);
  assert.match(B.deckLine(one).why, /the north side needs a board from the top of one stone to the other/);
});

test('dragging the free end swings it smoothly in one upright plane, with level a strong stop', async () => {
  const { swingEnd, planeFor } = await import('../labs/bridge/bridge.js');
  const A = { X: -8, Y: 0, Z: 3.5 }, L = 8;
  assert.equal(planeFor({ X: 0.1, Y: -0.3, Z: -0.9 }), 'X');   // looking north: the east-west plane
  assert.equal(planeFor({ X: 0.9, Y: -0.3, Z: 0.2 }), 'Z');    // looking east: the north-south plane
  // finger a little above level, east of the socket: snaps to exactly level, Z untouched
  let B = swingEnd(A, L, 'X', { X: -2, Y: 0.3, Z: 3.5 });
  assert.deepEqual(B, { X: 0, Y: 0, Z: 3.5 });
  // and a little below
  B = swingEnd(A, L, 'X', { X: -1, Y: -0.4, Z: 3.5 });
  assert.equal(B.Y, 0); assert.equal(B.X, 0);
  // in between: smooth, rise to the whole inch, length kept, no north-south drift
  for (const y of [1, 2.2, 3.7, 5.1]) {
    B = swingEnd(A, L, 'X', { X: -3, Y: y, Z: 3.5 });
    assert.equal(B.Z, 3.5);
    assert.ok(Math.abs(B.Y * 12 - Math.round(B.Y * 12)) < 1e-4);
    assert.ok(Math.abs(Math.hypot(B.X - A.X, B.Y - A.Y) - L) < 1e-4);
  }
  // nearly straight up snaps straight up; never below the water
  assert.deepEqual(swingEnd(A, L, 'X', { X: -7.8, Y: 5, Z: 3.5 }), { X: -8, Y: 8, Z: 3.5 });
  assert.ok(swingEnd(A, L, 'X', { X: -7.5, Y: -9, Z: 3.5 }).Y >= -4.5);
  // looking west: the north-south plane, X stays the socket's
  B = swingEnd(A, L, 'Z', { X: -8, Y: 0.2, Z: -3 });
  assert.deepEqual(B, { X: -8, Y: 0, Z: -4.5 });
});

test('a bridge copied as a code comes back exactly (the result card\'s "Copy this bridge", ?bridge=)', () => {
  const br = { S: 16, D: 7, deck: { y: 0 }, boards: [
    { id: 'x1', a: { X: -8.5, Y: 0, Z: 3.5 }, b: { X: -0.5, Y: 0, Z: 3.5 }, len: 8 },
    { id: 'x2', a: { X: -8, Y: -3, Z: 1.9444 }, b: { X: -0.5838, Y: 0, Z: 1.9444 }, len: 8 },
  ] };
  const code = B.encodeBridge(br);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  const back = B.decodeBridge(code);
  assert.equal(back.S, 16); assert.equal(back.D, 7); assert.equal(back.deck, true);
  assert.deepEqual(back.boards.map((b) => [b.a, b.b, b.len]), br.boards.map((b) => [b.a, b.b, b.len]));
  assert.equal(B.decodeBridge('not a code!'), null);
});

test('twins across the width: a strut under one of five stringers is offered under all five, at both ends', () => {
  const br = { S: 16, D: 7, boards: [] }; let n = 0;
  for (const z of [3.5, 1.75, 0, -1.75, -3.5]) for (const [x0, x1] of [[-8.5, -0.5], [-1.5, 6.5], [5.5, 8.5]]) br.boards.push({ id: 'r' + ++n, a: { X: x0, Y: 0, Z: z }, b: { X: x1, Y: 0, Z: z }, len: x1 - x0 });
  const strut = { id: 'st', a: { X: -8, Y: -3, Z: 1.75 }, b: { X: -8 + Math.sqrt(55), Y: 0, Z: 1.75 }, len: 8 };
  br.boards.push(strut);
  const tw = B.twinsOf(br, strut);
  const key = (g) => `${Math.sign(g.a.X + g.b.X)}:${((g.a.Z + g.b.Z) / 2).toFixed(2)}`;
  const got = new Set(tw.map(key));
  for (const z of [3.5, 1.75, 0, -1.75, -3.5]) for (const s of [-1, 1]) if (!(s === -1 && z === 1.75)) assert.ok(got.has(`${s}:${z.toFixed(2)}`), `a twin under the stringer at Z ${z}, ${s < 0 ? 'west' : 'east'} end`);
  assert.equal(tw.length, 9);
  // nearest first
  const d = (g) => Math.hypot((g.a.X + g.b.X) / 2 - (strut.a.X + strut.b.X) / 2, (g.a.Z + g.b.Z) / 2 - 1.75);
  for (let i = 1; i < tw.length; i++) assert.ok(d(tw[i]) >= d(tw[i - 1]) - 1e-9);
  // one already built is not offered again
  br.boards.push({ id: 'st2', ...tw[0] });
  assert.equal(B.twinsOf(br, strut).length, 8);
});
