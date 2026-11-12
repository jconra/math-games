// Tests for the arched deck (labs/bridge/bridge.js deckLine, deckTopAt; frame.js): the deck's path from bank to bank
// is the highest one along the tops of a side's boards, each no steeper than people and horses can walk, a board
// leading on to the next only where their tops come within a few inches; a flat path is the road-height deck exactly as
// it always was; the deck's top follows the arch (where the valley's travellers walk and roll); wagons stay off a deck
// steeper than they can climb; a bridge saved before arched decks keeps its deck and its fingerprint; and the
// engineer's own sums, with no special rule for arches, on the same boards built straight and as an arch.
// The idea came from a young bridge builder: "a deck that arched".
// node --test tests/bridge-arch.test.mjs   (from mathwood-valley)
import test from 'node:test';
import assert from 'node:assert/strict';

const B = await import('../labs/bridge/bridge.js');
const F = await import('../labs/bridge/frame.js');
const { bridgeSig } = await import('../src/bridgeplan.js');

const r6 = (v) => Math.round(v * 1e6) / 1e6;
const P = (X, Y, Z) => ({ X: r6(X), Y: r6(Y), Z: r6(Z) });
const bd = (a, b, id) => ({ id, a, b, len: r6(Math.hypot(b.X - a.X, b.Y - a.Y, b.Z - a.Z)) });
// one side's boards [x0, y0, x1, y1, name] on both sides of the bridge (south 'f', north 'k')
const both = (one, D = 7) => [-1, 1].flatMap((s) => one.map(([x0, y0, x1, y1, n]) => bd(P(x0, y0, s * D / 2), P(x1, y1, s * D / 2), (s > 0 ? 'f' : 'k') + n)));
const flatLine = [[-8.5, 0, -0.5, 0, 'L0'], [0.5, 0, 8.5, 0, 'L1'], [-4, 0, 4, 0, 'L2']];
// an arch over 16 ft: two 8 ft ribs a side, their feet half a foot down the stone faces, rising `inch` inches so their
// tips meet at the middle; a short road board on each bank's edge out to where the rib comes up through road height
function arch(inch = 14, { S = 16, braced = false } = {}) {
  const h = S / 2, rise = inch / 12, run = Math.sqrt(64 - rise * rise), foot = -0.5;
  const rh = Math.min(run, h), k = rise / run, tipX = -h + rh, tipY = foot + rh * k;
  const yAt = (X) => foot + (h - Math.abs(X)) * k, sx = Math.ceil((-h + -foot / k) * 2) / 2;
  const boards = both([[-h, foot, tipX, tipY, 'R0'], [h, foot, -tipX, tipY, 'R1'], [-h - 0.5, 0, sx, 0, 'S0'], [h + 0.5, 0, -sx, 0, 'S1']]);
  // (two X's of boards across under the deck, from one side's arch to the other's)
  if (braced) for (const [x0, x1, i] of [[-h + 2.5, -2, 0], [2, h - 2.5, 1]]) boards.push(bd(P(x0, yAt(x0), 3.5), P(x1, yAt(x1), -3.5), 'x' + i + 'a'), bd(P(x0, yAt(x0), -3.5), P(x1, yAt(x1), 3.5), 'x' + i + 'b'));
  return { S, D: 7, arch: true, boards };
}
const laid = (br) => { const d = B.deckLine(br); assert.ok(d.planks, d.why); br.deck = d; return br; };

test('the path: the highest one from bank to bank, so an arch over a road-height line carries the deck', () => {
  const br = { ...arch(14), boards: [...arch(14).boards, ...both(flatLine)] };
  const d = B.deckLine(br);
  assert.ok(d.arch && d.rise > 0.6, `the deck rides the arch (rise ${d.rise} ft)`);
  assert.ok(d.on.includes('fR0') && d.on.includes('kR1'), 'on the ribs');
  assert.ok(!d.on.includes('fL2'), 'not on the middle of the flat line, under the arch');
  const mid = d.planks.reduce((m, p) => (Math.abs(p.X) < Math.abs(m.X) ? p : m));
  assert.ok(mid.a.Y > 0.6, 'the middle plank up at the crown');
  assert.ok(d.slope > 8 && d.slope < 9, `its steepest board: ${d.slope}°`);
  // (its lines, for the glow, run from the top of one bank to the other)
  for (const sd of ['south', 'north']) { const L = d.lines[sd]; assert.equal(L[0][0], -8); assert.equal(L[L.length - 1][0], 8); assert.ok(Math.abs(L[0][1]) <= B.ROAD_TOL); }
});

test('the path: a board floating above the deck, not joined within a few inches, is never the path', () => {
  const base = both(flatLine);
  const float = (dy) => ({ S: 16, D: 7, arch: true, boards: [...base, ...both([[-3, dy, 3, dy, 'H']])] });
  assert.deepEqual(B.deckLine(float(0.5)).planks.map((p) => p.a.Y), B.deckLine({ S: 16, D: 7, arch: true, boards: base }).planks.map((p) => p.a.Y), 'six inches up: left out, the deck flat');
  // (a board two inches up, lapped on the line, leads on: the deck steps up onto it there)
  const d = B.deckLine(float(2 / 12));
  assert.ok(d.arch && d.on.includes('fH'), 'two inches up: the deck rides it');
  assert.ok(Math.abs(d.planks.find((p) => Math.abs(p.X) < 0.5).a.Y - (2 / 12 + B.DECK_LIFT)) < 1e-6);
  assert.ok(B.DECK_GAP >= 2 / 12 && B.DECK_GAP < 0.5, 'the gap a few inches');
});

test('the path: no board steeper than people and horses can walk; too steep says so', () => {
  assert.equal(B.SLOPES.walk, 25); assert.equal(B.SLOPES.wagon, 15);
  // a hump of two boards at 30 degrees from the road: no path, and the words say why
  const k = Math.tan(30 * Math.PI / 180), top = 8 * k;
  const hump = { S: 16, D: 7, arch: true, boards: both([[-8.5, 0, -8, 0, 'E0'], [8, 0, 8.5, 0, 'E1'], [-8, 0, 0, top, 'U0'], [8, 0, 0, top, 'U1']]) };
  const d = B.deckLine(hump);
  assert.equal(d.planks, undefined);
  assert.match(d.why, /can't climb that steeply: a board on its way across slopes 30°/);
  // ...and at 20 degrees it's walkable, but too steep for the wagons
  const k2 = Math.tan(20 * Math.PI / 180), hump2 = { S: 16, D: 7, arch: true, boards: both([[-8.5, 0, -8, 0, 'E0'], [8, 0, 8.5, 0, 'E1'], [-8, 0, 0, 8 * k2, 'U0'], [8, 0, 0, 8 * k2, 'U1']]) };
  const d2 = B.deckLine(hump2);
  assert.ok(d2.planks && Math.abs(d2.slope - 20) < 0.2);
  assert.equal(B.wagonsCan(d2), false);
  assert.equal(B.wagonsCan(B.deckLine(arch(14))), true);
});

test('the path: two boards at the same height, lapped, both carry the planks (a tie is no choice at all)', () => {
  const br = { S: 16, D: 7, arch: true, boards: [...both(flatLine), ...both([[-6, 0, 2, 0, 'T']])] };
  const d = B.deckLine(br);
  assert.ok(!d.arch, 'still the flat deck');
  assert.ok(d.on.includes('fT') && d.on.includes('fL2'));
});

test('the two sides have to match: one side arched, the other flat, is no deck, and the words say so', () => {
  const a = arch(14).boards.filter((b) => b.id[0] === 'f'), f = both(flatLine).filter((b) => b.id[0] === 'k');
  const d = B.deckLine({ S: 16, D: 7, arch: true, boards: [...a, ...f] });
  assert.equal(d.planks, undefined);
  assert.match(d.why, /two sides don't match: the south side's boards are \d+ inches higher in the middle/);
});

test('a flat path is the road-height deck exactly as it always was (with or without the arch mark)', () => {
  const lines = (y) => both([[-8.5, y, -0.5, y, 'w'], [0.5, y, 8.5, y, 'e'], [-4, y, 4, y, 'm']]);
  for (const boards of [lines(0), [...lines(0), ...lines(-1.5)], [...lines(0), bd(P(-4, 0, 0), P(4, 0, 0), 'mid')]]) {
    const old = B.deckLine({ S: 16, D: 7, boards }), now = B.deckLine({ S: 16, D: 7, arch: true, boards });
    assert.deepEqual(now, old);
    assert.ok(now.planks.every((p) => p.n.Y === 1 && Math.abs(p.a.Y - B.DECK_LIFT) < 1e-9));
  }
  // a bridge saved before arched decks (no mark) keeps the road-height deck even with an arch over it
  const both2 = [...arch(14).boards, ...both(flatLine)];
  assert.ok(!B.deckLine({ S: 16, D: 7, boards: both2 }).arch, 'no mark: the deck it always had');
  assert.ok(B.deckLine({ S: 16, D: 7, arch: true, boards: both2 }).arch, 'laid again: the arch');
  assert.equal(B.newBridge(16).arch, true, 'every bridge begun now has the mark');
  // (its fingerprint, and so the rating it earned, unchanged; the mark is a new fingerprint)
  const br = { boards: both(flatLine) };
  assert.equal(bridgeSig(br, 24), bridgeSig({ ...br }, 24));
  assert.ok(!bridgeSig(br, 24).endsWith('|a'));
  assert.notEqual(bridgeSig({ ...br, arch: true }, 24), bridgeSig(br, 24));
  // (cleaned, a bridge keeps its mark and an arched deck its tilted planks and its lines)
  const c = B.cleanBridge(laid(arch(14)));
  assert.equal(c.arch, true); assert.ok(c.deck.arch && c.deck.lines.south.length > 2 && c.deck.planks.some((p) => p.n.X !== 0));
});

test('the deck\'s top follows the arch: the road at the banks, up to the crown, down again (where the travellers go)', () => {
  const d = laid(arch(14)).deck, h = 8, top = (X) => B.deckTopAt(d, X, 16);
  assert.ok(Math.abs(top(-h) - (d.ends[0] + B.DECK_TOP)) < 1e-9 && Math.abs(d.ends[0]) <= B.ROAD_TOL, 'the road\'s height at the west bank');
  assert.ok(Math.abs(top(h) - top(-h)) < 1e-6, 'the same at the east');
  assert.ok(top(0) - top(-h) > 0.6, 'up at the crown');
  assert.equal(top(-h - 2), top(-h), 'past the edge: the road');
  let up = 0, down = 0;
  for (let X = -h; X < h - 0.05; X += 0.1) { const s = top(X + 0.1) - top(X); if (X < -0.3 && s < -1e-9) up++; if (X > 0.3 && s > 1e-9) down++; }
  assert.equal(up, 0, 'never down on the way up'); assert.equal(down, 0, 'never up on the way down');
  // (a plank's top, right over it)
  for (const p of d.planks) assert.ok(Math.abs(top(p.X) - (p.a.Y - B.DECK_LIFT + B.DECK_TOP)) < 1e-9);
  // a flat deck: one height all the way, as the valley always had it
  const f = laid({ S: 16, D: 7, boards: both(flatLine) }).deck;
  for (const X of [-9, -8, -3.3, 0, 7.9]) assert.equal(B.deckTopAt(f, X, 16), f.planks[0].a.Y - B.DECK_LIFT + B.DECK_TOP);
});

test('the room a load needs is measured up from an arched deck: braces under it are out of the way, a board over it is not', () => {
  const br = laid(arch(14, { braced: true }));
  assert.deepEqual(F.inTheWay(br, F.LOADS[2]), [], 'the X-braces under the deck');
  const low = laid({ ...arch(14), boards: [...arch(14).boards, bd(P(-1, 3, -3.5), P(-1, 3, 3.5), 'over')] });
  assert.deepEqual(F.inTheWay(low, F.LOADS[2]), ['over'], 'a cross piece 3 ft up: 2 ft over the crown, in the covered wagon\'s way');
});

test('wagons stay on the bank of a deck steeper than they can climb: the test says so', () => {
  // (a 14 ft gap: 8 ft ribs meeting at the middle at 18 degrees, braced)
  const S = 14, k = Math.tan(18 * Math.PI / 180), rise = 7 * k, inch = Math.round(Math.hypot(7, rise) > 8 ? 0 : rise * 12);
  const br = laid(arch(inch, { S, braced: true }));
  assert.ok(br.deck.slope > 15 && br.deck.slope < 25, `${br.deck.slope}°`);
  const r = F.crossTest(br, { loads: F.LOADS.slice(0, 3) });
  assert.ok(r.crossings[2].steep > 15, 'the covered wagon: too steep');
  assert.equal(r.crossings[2].made, false);
  assert.ok(r.rating <= 1);
});

test('the same boards, straight and arched (16 ft): the braced arch carries far more, and sags far less', () => {
  const run = (br) => F.crossTest(laid(br));
  const flatBraced = { S: 16, D: 7, arch: true, boards: [...both(flatLine), ...arch(14, { braced: true }).boards.filter((b) => b.id[0] === 'x').map((b) => ({ ...b, a: { ...b.a, Y: 0 }, b: { ...b.b, Y: 0 } }))] };
  const straight = run(flatBraced), arched = run(arch(14, { braced: true }));
  assert.ok(straight.rating >= 0, 'both arms ran: the straight span carried the person');
  assert.ok(arched.rating >= straight.rating + 2, `straight: ${F.LOADS[straight.rating].short}; arch: ${F.LOADS[arched.rating].short}`);
  assert.ok(arched.crossings[0].sag < straight.crossings[0].sag / 3, 'and under the person it sags a third as much or less');
  // ...but unbraced, squeezed that hard, the two arches lean over sideways together
  const loose = run(arch(14));
  assert.ok(loose.rating < arched.rating);
  const ev = [...loose.calm.events, ...loose.crossings.flatMap((c) => c.events)][0];
  assert.equal(ev.kind, 'bow');
});
