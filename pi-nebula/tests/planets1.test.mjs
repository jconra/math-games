// PLANETS 1, round 4's rules that need no browser: nothing taller than her knee in the camera's own space where she
// first stands (src/planet/land.js kneeCap), and the pods planned from the pieces as main laid them (src/planet/wreck.js
// settle's main), the pieces themselves resting where they toppled to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLand, CLEARING, kneeCap } from '../src/planet/land.js';
import { wreckPlan, breakApart, wreckSite, settle, wreckFor } from '../src/planet/wreck.js';
import * as EXPLORER from '../kit/ships/explorer-built.hull.js';
import * as MINER from '../kit/ships/miner-built.hull.js';
import * as MEDIC from '../kit/ships/medic-built.hull.js';
import * as HAULER from '../kit/ships/hauler-built.hull.js';

test('the camera\'s own space: within kneeIn of where the ship came down nothing taller than her knee, easing back by kneeOut', () => {
  const land = { width: 1024, landing: { x: 10, z: -20 } };
  assert.equal(kneeCap(land, 10, -20), CLEARING.knee);
  assert.equal(kneeCap(land, 10 + CLEARING.kneeIn - 0.1, -20), CLEARING.knee);
  const mid = kneeCap(land, 10 + (CLEARING.kneeIn + CLEARING.kneeOut) / 2, -20);
  assert.ok(mid > CLEARING.knee && mid < Infinity, `half way out: ${mid}`);
  assert.equal(kneeCap(land, 10 + CLEARING.kneeOut + 0.1, -20), Infinity);
  // (where the ship really came down, once it has: land.start)
  land.start = { x: 200, z: 200 };
  assert.equal(kneeCap(land, 10, -20), Infinity);
  assert.equal(kneeCap(land, 205, 198), CLEARING.knee);
  // (across the planet's wrap)
  land.start = { x: 510, z: 0 };
  assert.equal(kneeCap(land, -510, 0), CLEARING.knee);
  assert.ok(CLEARING.knee <= 0.55, 'her knee');
  // (and along the walks from the ramp's foot to each pod)
  land.start = { x: 0, z: 0 }; land.walks = [[0, 0, 100, 0]];
  assert.equal(kneeCap(land, 80, CLEARING.kneeWalk - 0.5), CLEARING.knee);
  assert.ok(kneeCap(land, 80, (CLEARING.kneeWalk + CLEARING.kneeWalkOut) / 2) > CLEARING.knee);
  assert.equal(kneeCap(land, 80, CLEARING.kneeWalkOut + 0.5), Infinity);
  assert.equal(kneeCap(land, 130, 0), Infinity);
});

const buf = (s) => { const b = Buffer.from(s, 'base64'), u = new Uint8Array(b.length); u.set(b); return u.buffer; };
const soup = ({ HULL, Q }) => { const p = new Int16Array(buf(HULL.pos)), t = new Uint16Array(buf(HULL.tris)), pos = new Float32Array(t.length * 3); for (let i = 0; i < t.length; i++) for (let c = 0; c < 3; c++) pos[i * 3 + c] = p[t[i] * 3 + c] / Q; return { skin: { position: { size: 3, array: pos } } }; };
const HULLS = { explorer: soup(EXPLORER), miner: soup(MINER), medic: soup(MEDIC), hauler: soup(HAULER) };
const boxOf = (soups) => { const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; for (const S of Object.values(soups)) { const A = S.position.array; for (let i = 0; i < A.length; i += 3) for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], A[i + c]); max[c] = Math.max(max[c], A[i + c]); } } return { min, max }; };

test('settle hands the pods main\'s resting places: the same seed the same each time, the pieces\' own toppled ones beside them', () => {
  for (const [kind, seed] of [['moon', 51], ['canyon', 77], ['meadow', 7]]) {
    const land = makeLand(seed, { kind, n: 512 }), w = wreckFor(seed), soups = HULLS[w.ship], plan = wreckPlan(seed, boxOf(soups), { ship: w.ship, pieces: w.pieces });
    const ps = breakApart(soups, plan).pieces.map((pc) => { const b = boxOf(pc); return { pts: pc.skin.position.array, pivot: [0, 1, 2].map((c) => (b.min[c] + b.max[c]) / 2) }; });
    const a = settle(ps, land, wreckSite(land, seed), plan), b = settle(ps, land, wreckSite(land, seed), plan);
    assert.ok(a.main && a.main.mats.length === a.mats.length, `${kind} ${seed}: main's places for each piece`);
    assert.deepEqual(a.main.mats, b.main.mats, `${kind} ${seed}: main's places the same each time`);
    assert.ok(Number.isFinite(a.main.site.x) && Number.isFinite(a.main.site.y), `${kind} ${seed}: main's site`);
    // (the toppled pieces lie near main's: within a couple of metres)
    for (let k = 0; k < a.mats.length; k++) { const d = Math.hypot(a.mats[k][12] - a.main.mats[k][12], a.mats[k][14] - a.main.mats[k][14]); assert.ok(d < 3, `${kind} ${seed} piece ${k}: ${d.toFixed(2)} m from main's`); }
  }
});
