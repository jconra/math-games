// The grow pods in the station's cafeteria (the terminal's galley), as the room file says it: the game's maker
// (2026-11-10) "It might be cool to have some of those plant pods in the station cafeteria area also (and the other
// ships)". A pair of the ships' rotary gardens on the galley's back wall over the soup counter, in the wall's dark band,
// either side of the panel's middle upright. (What they look like: ~/pw/space-math/shots/growpod-2/.)
//   node --test pi-nebula/tests/growpods.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const S = JSON.parse(readFileSync(new URL('../kit/rooms/station.json', import.meta.url), 'utf8'));
const terminal = S.rooms.find((r) => r.id === 'terminal');
const pods = S.rooms.flatMap((r) => (r.pieces || []).filter((p) => p.piece === 'growpod').map((p) => ({ ...p, room: r.id })));
// (a pair's plate: 1.29 m across, 0.566 m tall, its bottom at off y; kit/catalog.js STATION_PODS.pair with POD_MOUNT)
const PAIR = { w: 2 * 0.486 + 0.234 + 0.08, h: 0.486 + 0.08 };
const BAND = [1.22, 1.52];   // (kit/shell.js: the dark band across a wall)

test('the cafeteria has its grow pods: one pair, in the terminal, nowhere else in the station', () => {
  assert.equal(pods.length, 1);
  assert.equal(pods[0].room, 'terminal');
  assert.equal(pods[0].variant, 'pair');
});

test('the pair hangs on a plain wall panel of the galley, behind the counter with the soup, its middle in the dark band', () => {
  const p = pods[0], wall = terminal.pieces.find((q) => q.piece === 'wall' && !q.deck && q.cell[0] === p.cell[0] && q.cell[1] === p.cell[1] && q.turn === p.turn);
  assert.equal(wall?.variant, 'plain');
  // (the plain counter with the two pots of soup stands in front of that panel)
  assert.ok(terminal.pieces.some((q) => q.piece === 'counter' && q.variant === 'plain' && q.cell[1] === p.cell[1]));
  assert.ok(terminal.pieces.filter((q) => q.piece === 'pot' && q.cell[1] === p.cell[1]).length === 2);
  const mid = p.off[1] + PAIR.h / 2;
  assert.ok(mid > BAND[0] && mid < BAND[1], 'middle ' + mid);
  // (centred on the panel, so its two pods stand either side of the panel's middle upright, inside the panel's 2 m)
  assert.equal(p.off[0], 0); assert.ok(PAIR.w < 2 - 0.4);
});

test('nothing else hangs on that panel where the pair is', () => {
  const p = pods[0], y0 = p.off[1], y1 = y0 + PAIR.h;
  for (const q of terminal.pieces) {
    if (q === p || q.piece === 'growpod' || q.deck || !q.off || q.cell[0] !== p.cell[0] || q.cell[1] !== p.cell[1]) continue;
    if (['wall', 'trim', 'filler', 'rib'].includes(q.piece)) continue;
    assert.ok(q.off[1] > y1 || q.off[1] < y0 - 0.5, q.piece + ' at ' + q.off[1]);
  }
});
