// The station, round four (2026-11-17), as the room file and the kit's plain numbers say it: the ward's bays (curtains
// between the beds in place of dividers, a bedside table and a machine at every bed, no two bays alike, room to walk in
// beside every bed), the small pair of boards at a person's own height in three places, and the scanner's own floor
// under the way its patient walks. (What they look like is the pictures' business: ~/pw/space-math/shots/station-4/.)
//   node --test pi-nebula/tests/station4.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { curtainOf, clothSpan, tableThings, tableOk, wardBedOf, bedHeadOf, THING_NAMES, CURTAIN_HOW } from '../kit/ward-names.js';
import { SCAN_BED } from '../src/life.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const S = JSON.parse(read('../kit/rooms/station.json'));
const room = (id) => S.rooms.find((r) => r.id === id);
// where a placement is in the station (kit/grid.js: 2 m cells, quarter turns, `off` in the piece's own turned frame)
function at(pl) {
  let [ox, oy, oz] = pl.off || [0, 0, 0];
  for (let i = 0; i < (((pl.turn || 0) % 4) + 4) % 4; i++) [ox, oz] = [oz, -ox];
  return { x: pl.cell[0] * 2 + ox, y: oy, z: pl.cell[1] * 2 + oz };
}
// the way a placement's own +x runs in the station ([x, z])
const along = (pl) => [[1, 0], [0, -1], [-1, 0], [0, 1]][(((pl.turn || 0) % 4) + 4) % 4];
// a number, or a list of numbers, named in a kit file's own text (the kit draws with three.js, which Node has not got)
function numbers(text, name, n = 1) {
  const m = new RegExp(name + '\\s*[:=]\\s*' + (n === 1 ? '(-?[\\d.]+)' : '\\[\\s*' + Array(n).fill('(-?[\\d.]+)').join('\\s*,\\s*') + '\\s*\\]')).exec(text);
  assert.ok(m, 'the kit names ' + name); return n === 1 ? +m[1] : m.slice(1).map(Number);
}

test('the ward names read as the kit reads them', () => {
  assert.deepEqual(curtainOf('side drawn 2.5'), { where: 'side', how: 'drawn', len: 2.5 });
  assert.equal(curtainOf('3.35'), null);     // (round three's curtains were named by their length alone)
  for (const how of CURTAIN_HOW) assert.equal(curtainOf('foot ' + how + ' 3').how, how);
  assert.equal(clothSpan('foot bare 9.1'), null);
  const [a, b] = clothSpan('side drawn 2.5'), [c, d] = clothSpan('side back 2.5'), [e, f] = clothSpan('side end 2.5');
  assert.ok(a < 0.1 && b > 2.4 && d - c < 0.6 && c < 0.1 && f > 2.4 && f - e < 0.6);
  assert.deepEqual(tableThings('flowers2 card2 cup'), ['flowers2', 'card2', 'cup']); assert.deepEqual(tableThings('bare'), []);
  assert.ok(tableOk('bear books') && tableOk('bare') && !tableOk('bear rocket') && !tableOk('book cup card bear'));
  assert.deepEqual(wardBedOf('ward 3, left rail down'), { ward: 3, down: -1 }); assert.deepEqual(wardBedOf('ward 2'), { ward: 2, down: 0 });
  assert.equal(wardBedOf('arm left'), null);
  assert.ok(THING_NAMES.includes('bear') && THING_NAMES.includes('flowers') && THING_NAMES.includes('card') && THING_NAMES.includes('books'));
});

test('the ward: curtains between the beds, no dividers and no shelves, a wall panel behind every bed', () => {
  const W = room('med-ward').pieces;
  assert.ok(!S.rooms.some((r) => r.pieces.some((p) => p.piece === 'divider')), 'no dividers are left in the station');
  // the beds: the ward's own (thick sides), numbered 1 to 3 along the wall; the Medic ship's cabin keeps its own beds
  const beds = W.filter((p) => p.piece === 'cabinMedBed').map((p) => ({ ...wardBedOf(p.variant), ...at(p), pl: p })).sort((a, b) => a.z - b.z);
  assert.equal(beds.length, 3); assert.deepEqual(beds.map((b) => b.ward), [1, 2, 3]);
  const ship = JSON.parse(read('../kit/rooms/ship-medic.json')), shipBeds = JSON.stringify(ship).match(/"piece":"cabinMedBed"[^}]*/g) || [];
  assert.ok(shipBeds.length >= 1 && shipBeds.every((s) => !/ward/.test(s)), "the Medic's own beds are not the ward's");
  // behind each bed's head: its wall panel, with the bed's number, in line with the bed (a panel's name is its bed's
  // number, and since round five how that bed's light is set: '2 bright')
  const heads = W.filter((p) => p.piece === 'bedhead').map((p) => ({ n: (bedHeadOf(p.variant) || {}).n, ...at(p) }));
  for (const b of beds) { const h = heads.find((q) => q.n === b.ward); assert.ok(h && Math.abs(h.z - b.z) < 0.02, 'bed ' + b.ward + ' has its panel'); }
  // between each pair of beds: one curtain on a track from the beds' wall, halfway between them, as long as a bed
  const sides = W.filter((p) => p.piece === 'curtain' && curtainOf(p.variant) && curtainOf(p.variant).where === 'side').map((p) => ({ ...curtainOf(p.variant), ...at(p), dir: along(p) }));
  assert.equal(sides.length, beds.length - 1);
  for (let i = 0; i + 1 < beds.length; i++) {
    const mid = (beds[i].z + beds[i + 1].z) / 2, c = sides.find((q) => Math.abs(q.z - mid) < 0.15);
    assert.ok(c, 'a curtain between beds ' + (i + 1) + ' and ' + (i + 2));
    assert.deepEqual(c.dir, [1, 0]); assert.ok(c.len >= 2.3 && c.len <= 2.7 && c.x > 33.15 && c.x < 33.3, 'from the wall out along the beds');
    assert.ok(c.how !== 'bare');
  }
  assert.ok(sides.some((c) => c.how === 'drawn') && sides.some((c) => c.how !== 'drawn'), 'not every curtain is drawn alike');
  // the side toward the walkway: a track across the bays' feet with no cloth on it (cloth anywhere along it stood in
  // the way in beside a bed), and every curtain named as the kit reads it
  const foot = W.filter((p) => p.piece === 'curtain' && curtainOf(p.variant) && curtainOf(p.variant).where === 'foot');
  assert.ok(foot.length >= 1 && foot.every((p) => clothSpan(p.variant) === null));
  assert.ok(W.filter((p) => p.piece === 'curtain').every((p) => curtainOf(p.variant)));
});

test('the ward: a table on one side of every bed and a machine on the other, no two bays alike, room to walk in', () => {
  const W = room('med-ward').pieces, beds = W.filter((p) => p.piece === 'cabinMedBed').map((p) => ({ ...wardBedOf(p.variant), ...at(p) })).sort((a, b) => a.z - b.z);
  const things = W.filter((p) => ['bedtable', 'ivstand', 'vitals', 'medcart', 'medstool'].includes(p.piece)).map((p) => ({ piece: p.piece, variant: p.variant, ...at(p) }));
  const dressed = beds.map((b, i) => {
    const lo = i ? (beds[i - 1].z + b.z) / 2 : -Infinity, hi = i + 1 < beds.length ? (b.z + beds[i + 1].z) / 2 : Infinity;
    return things.filter((t) => t.z > lo && t.z < hi).map((t) => ({ ...t, side: Math.sign(t.z - b.z), off: Math.abs(t.z - b.z) }));
  });
  dressed.forEach((bay, i) => {
    const tables = bay.filter((t) => t.piece === 'bedtable'), machines = bay.filter((t) => ['ivstand', 'vitals', 'medcart'].includes(t.piece));
    assert.ok(tables.length >= 1 && machines.length >= 1, 'bay ' + (i + 1) + ' has a table and a machine');
    assert.ok(tables.every((t) => tableOk(t.variant) && tableThings(t.variant).length >= 1), 'with get-well things on its table');
    assert.ok(tables.some((t) => machines.some((m) => m.side === -t.side)), 'a machine on the other side from a table');
    // (clear of the bed, which with its rails is 0.57 m either side of its middle; and by its head, within a metre and a
    // half of the wall, so the way in beside the bed from the walkway stays open)
    for (const t of bay) assert.ok(t.off > 0.6 && t.x < 33.22 + 1.5, t.piece + ' in bay ' + (i + 1) + ' stands by the head, off the bed');
  });
  const kinds = dressed.map((bay) => bay.map((t) => t.piece + ':' + t.variant).sort().join(' + '));
  assert.equal(new Set(kinds).size, kinds.length, 'no two bays are dressed alike: ' + kinds.join(' | '));
  assert.ok(things.some((t) => t.piece === 'ivstand') && things.some((t) => t.piece === 'vitals'));
  // the ways in beside the beds: between a bed's side and the curtain (or the wall) next to it, more than a person's
  // width (0.56 m) with something to spare (a bed with its leaning rails: 0.57 m either side of its middle)
  const sides = W.filter((p) => p.piece === 'curtain' && curtainOf(p.variant).where === 'side').map((p) => at(p).z);
  const edges = [75.22, ...sides, 84.78].sort((a, b) => a - b);
  for (const b of beds) for (const e of edges) if (Math.abs(e - b.z) < 2.2) assert.ok(Math.abs(e - b.z) - 0.57 > 0.85, 'beside bed ' + b.ward);
});

test('the small boards: both, at a person\'s own height, in the terminal, by the junction and by the quarters', () => {
  const pairs = S.rooms.flatMap((r) => r.pieces.filter((p) => p.piece === 'jobs' && p.variant === 'pair').map((p) => ({ room: r.id, ...at(p) })));
  assert.deepEqual(pairs.map((p) => p.room).sort(), ['c2', 'qc', 'terminal']);
  // (its middle 1.45 m up: the lower screen at a person's chest, the upper at their eyes; never up with the big boards)
  for (const p of pairs) assert.ok(p.y > 1.3 && p.y < 1.6, p.room + ': ' + p.y);
  // the two big boards still hang in the terminal
  const big = room('terminal').pieces.filter((p) => p.piece === 'jobs' && ['hang', 'station'].includes(p.variant));
  assert.equal(big.length, 2); assert.ok(big.every((p) => p.off[1] > 4));
  // the quarters' pair is by the player's own door: within 3 m of it, on the same wall (the station file's door there)
  const q = pairs.find((p) => p.room === 'qc'), door = S.portals.find((P) => P.a === 'quarters' && P.b === 'qc').door;
  assert.ok(Math.hypot(q.x - door[0], q.z - door[1]) < 3 && Math.abs(q.x - door[0]) < 0.3);
  // the small screens are the big board's own picture, not stretched: the same shape, under a quarter of its size
  const f = read('../kit/furniture.js');
  const bigW = numbers(f, 'JOBS_SCREEN = \\{ w'), bigH = numbers(f, 'JOBS_SCREEN = \\{ w: [\\d.]+, h'), w = numbers(f, 'JOBS_PAIR = \\{ w'), h = numbers(f, 'JOBS_PAIR = \\{ w: [\\d.]+, h');
  assert.ok(Math.abs(w / h - bigW / bigH) < 1e-6, 'the same shape'); assert.ok(w <= bigW / 4 && w >= 0.9, 'small, but a row can still be read');
});

test('the scanner\'s own floor: between the rails, a centimetre thick, under the whole of its patient\'s way', () => {
  const k = read('../kit/bigscanner.js'), deck = /deck:\s*\{([^}]*)\}/.exec(k);
  assert.ok(deck, 'the scanner has a deck');
  const x = numbers(deck[1], 'x'), [z0, z1] = numbers(deck[1], 'z', 2), top = numbers(deck[1], 'top'), [g0, g1] = numbers(deck[1], 'grip', 2), [gz0, gz1] = numbers(deck[1], 'gripZ', 2);
  const rail = numbers(k, 'rail'), bedW = numbers(k, 'bed: \\{ w');
  // from rail to rail (inside the rails' own foot plates, 0.15 m either side of each), wider than the bed
  assert.ok(x > bedW / 2 + 0.4 && x < rail - 0.15 + 1e-9, String(x));
  // a centimetre thick at the most, so it is no step: the patient's way and moves are lifted by what the floor itself
  // says is under their feet (src/people.js), and the moves on and off the bed are untouched (src/onbed.js)
  assert.ok(top > 0 && top <= 0.012, String(top));
  // the patient's way along the bed (src/life.js SCAN_BED, after the spot they wait at) and where they stand to get
  // on: on the deck, on its grip tape; from the wall to past the bed's foot
  const way = [...SCAN_BED.path.slice(1), SCAN_BED.stand];
  for (const [px, pz] of way) { assert.ok(Math.abs(px) < x - 0.1 && pz > z0 && pz < z1, 'on the deck: ' + px + ', ' + pz); assert.ok(Math.abs(px) > g0 && Math.abs(px) < g1 && pz > gz0 - 0.1 && pz < gz1 + 0.1, 'on the grip tape: ' + px + ', ' + pz); }
  assert.ok(z0 < 0.1 && z1 > 4.02, 'from the wall out past the bed\'s foot');
});
