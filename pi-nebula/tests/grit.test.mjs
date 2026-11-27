// The ground underfoot (src/planet/grit.js): two blind critics (2026-11-26) found the ground at the player's feet a
// blurry smear or one flat colour on every kind of planet. Its picture of small stones, cracks, tufts and ripples:
// made the same each time, quickly, each part there in a sensible share, and repeating without a seam.
//   node --test pi-nebula/tests/grit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gritData, GRIT } from '../src/planet/grit.js';
import { KINDS } from '../src/planet/kinds.js';

test('the ground underfoot: stones, cracks, tufts and ripples, in sensible shares, the same each time, no seam', () => {
  const t0 = Date.now(), S = 256, a = gritData(S), ms = Date.now() - t0;
  assert.deepEqual(a, gritData(S), 'the same each time');
  assert.ok(ms < 1500, `made in ${ms} ms`);
  const share = (c, over) => { let n = 0; for (let k = c; k < a.length; k += 4) if (a[k] > over) n++; return n / (S * S); };
  const stones = share(0, 0), cracks = share(1, 128), tufts = share(2, 60);
  assert.ok(stones > 0.04 && stones < 0.3, `stones cover ${(stones * 100).toFixed(1)}%`);
  assert.ok(cracks > 0.01 && cracks < 0.15, `cracks cover ${(cracks * 100).toFixed(1)}%`);
  assert.ok(tufts > 0.02 && tufts < 0.35, `tufts cover ${(tufts * 100).toFixed(1)}%`);
  let lo = 255, hi = 0; for (let k = 3; k < a.length; k += 4) { lo = Math.min(lo, a[k]); hi = Math.max(hi, a[k]); }
  assert.ok(lo < 20 && hi > 235, `ripples run ${lo} to ${hi}`);
  // (no seam: across the picture's edge the ripples change no more than across its middle)
  const at = (x, y, c) => a[((y % S) * S + (x % S)) * 4 + c];
  for (const c of [3]) {
    let edge = 0, mid = 0; for (let y = 0; y < S; y++) { edge += Math.abs(at(S - 1, y, c) - at(0, y, c)); mid += Math.abs(at(S / 2 - 1, y, c) - at(S / 2, y, c)); }
    assert.ok(edge < mid * 1.6 + S * 2, `channel ${c}: across the edge ${edge}, across the middle ${mid}`);
  }
  // every kind of planet has its own amounts
  for (const K of KINDS) assert.ok(GRIT.kinds[K.id] && GRIT.kinds[K.id].length === 4, `${K.id} has its ground underfoot`);
});
