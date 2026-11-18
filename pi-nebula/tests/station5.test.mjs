// The station, round five (2026-11-18), as the room file and the plain numbers say it: each bed of the ward has its
// own light (most dim, a few bright, the same every visit), and a captain's line picked on a jobs board gives the
// guide a place that is that captain, wherever they walk. (What they look like is the pictures' business:
// ~/pw/space-math/shots/station-5/.)
//   node --test pi-nebula/tests/station5.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bedHeadOf, wardBedOf, BED_LIGHT } from '../kit/ward-names.js';
import { CAPTAIN_ROWS, CAPTAIN_NEAR, targetOf } from '../src/boardpick.js';
import { CAPTAINS } from '../src/lines.js';
import { ROSTER } from '../src/life.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const S = JSON.parse(read('../kit/rooms/station.json'));
const room = (id) => S.rooms.find((r) => r.id === id);
// where a placement is in the station (kit/grid.js: 2 m cells, quarter turns, `off` in the piece's own turned frame)
function at(pl) {
  let [ox, oy, oz] = pl.off || [0, 0, 0];
  for (let i = 0; i < (((pl.turn || 0) % 4) + 4) % 4; i++) [ox, oz] = [oz, -ox];
  return { x: pl.cell[0] * 2 + ox, y: oy, z: pl.cell[1] * 2 + oz };
}

test('a bed\'s wall panel says how its own light is set: dim, bright or off', () => {
  assert.deepEqual(bedHeadOf('3'), { n: 3, light: 'dim' });       // (the number alone: dim, as every bed was)
  assert.deepEqual(bedHeadOf('3 dim'), { n: 3, light: 'dim' });
  assert.deepEqual(bedHeadOf('2 bright'), { n: 2, light: 'bright' });
  assert.deepEqual(bedHeadOf('1 off'), { n: 1, light: 'off' });
  assert.equal(bedHeadOf('2 glowing'), null); assert.equal(bedHeadOf('bright'), null);
  // off gives no light at all; bright is at least twice as strong as dim
  assert.equal(BED_LIGHT.off, 0); assert.ok(BED_LIGHT.dim > 0 && BED_LIGHT.bright >= 2 * BED_LIGHT.dim);
});

test('the ward: each bed its own light, most dim, a few bright, the same every visit', () => {
  const W = room('med-ward').pieces;
  const beds = W.filter((p) => p.piece === 'cabinMedBed').map((p) => ({ ...wardBedOf(p.variant), ...at(p) })).sort((a, b) => a.z - b.z);
  const heads = W.filter((p) => p.piece === 'bedhead').map((p) => ({ ...bedHeadOf(p.variant), name: p.variant, ...at(p) }));
  assert.equal(heads.length, beds.length); assert.ok(heads.every((h) => h.light), 'every panel\'s name is one the kit reads');
  const lights = beds.map((b) => { const h = heads.find((q) => q.n === b.ward); assert.ok(h && Math.abs(h.z - b.z) < 0.02, 'bed ' + b.ward + ' has its own panel'); return h.light; });
  const count = (k) => lights.filter((l) => l === k).length;
  assert.ok(count('dim') > lights.length / 2, 'most beds are dim: ' + lights.join(', '));
  assert.ok(count('bright') >= 1 && count('bright') < count('dim'), 'a few are bright: ' + lights.join(', '));
  assert.ok(count('off') <= 1, 'one at the most is off');
  assert.ok(new Set(lights).size > 1, 'the beds are not all alike');
  // the same every visit: a bed's light is its panel's name in the room file; the kit throws no dice and reads no
  // clock for it
  const kit = read('../kit/ward.js') + read('../kit/ward-names.js');
  assert.ok(!/Math\.random|Date\.now|performance\.now/.test(kit));
  // a bay's own ceiling light is on over a bright bed and off over every other (the ceiling's 2 m squares over the
  // beds: the two rows by the beds' wall); the three over the walkway stay on, as before
  const ceil = W.filter((p) => p.piece === 'ceiling').map((p) => ({ lit: p.variant === 'light', ...at(p) }));
  beds.forEach((b, i) => {
    const over = ceil.filter((c) => c.x < 37 && Math.abs(c.z - b.z) < 1.01);
    assert.ok(over.length >= 2, 'bed ' + b.ward + ' has a ceiling over it');
    if (lights[i] === 'bright') assert.ok(over.some((c) => c.lit), 'the ceiling light over bed ' + b.ward + ' is on');
    else assert.ok(over.every((c) => !c.lit), 'no ceiling light is on over bed ' + b.ward);
  });
  assert.equal(ceil.filter((c) => c.x < 37 && c.lit).length, count('bright'), 'one ceiling light on for each bright bed');
  assert.equal(ceil.filter((c) => c.x > 37 && c.lit).length, 3, 'the walkway keeps its three');
});

test('a captain\'s line picked gives a place that is that captain, wherever they walk', () => {
  // (a captain as the people have them: their own place, which moves as they walk)
  const ruiz = { pos: { x: 1, y: 0, z: 2 } }, hale = { pos: { x: -6, y: 0, z: 30 } };
  const captainAt = (id) => ({ ruiz, hale }[id] || null);
  const t = targetOf('ruiz', { captainAt });
  assert.equal(t.kind, 'captain'); assert.equal(t.id, 'ruiz');
  assert.equal(t.pos, ruiz.pos, 'the place is the captain\'s own, not somewhere near them');
  assert.equal(t.follow(), ruiz.pos);
  ruiz.pos.x = 14; ruiz.pos.z = 25;         // (they walk on)
  assert.deepEqual({ x: t.follow().x, z: t.follow().z }, { x: 14, z: 25 }, 'and the place walks with them');
  assert.notEqual(targetOf('hale', { captainAt }).follow(), ruiz.pos, 'each captain\'s line is their own');
  // the line is done with inside the distance at which a captain speaks up, so the offer is beginning as it fades
  const offer = +/FRIENDLY = \{[^}]*\boffer:\s*([\d.]+)/.exec(read('../src/people.js'))[1];
  assert.ok(t.near === CAPTAIN_NEAR && CAPTAIN_NEAR < offer && CAPTAIN_NEAR > 1.5, CAPTAIN_NEAR + ' inside ' + offer);
  // a captain with no mission to pick (the ship down for repairs) has a line to read, and no place to be led to
  assert.equal(targetOf('adair', { captainAt: () => ({ pos: { x: 0, y: 0, z: 0 } }) }), null);
  // a captain who is not aboard yet: nothing to lead to
  assert.equal(targetOf('vega', { captainAt: () => null }), null);
  // a station job, as before: its spot, which stays put (nothing to follow), done with just inside the job's own ring
  const spot = { pos: { x: 9, y: 0, z: 30 }, job: { near: 1.2 } };
  const j = targetOf('galley', { spotOf: (id) => (id === 'galley' ? spot : null), captainAt, rows: [{ id: 'galley', colour: '#ffb347' }] });
  assert.equal(j.kind, 'job'); assert.equal(j.pos, spot.pos); assert.equal(j.follow, undefined); assert.ok(Math.abs(j.near - 1.1) < 1e-9); assert.equal(j.colour, '#ffb347');
  assert.equal(targetOf('nowhere', { captainAt }), null);
});

test('the captains\' rows: the board\'s own order, each a captain of the roster, only Captain Adair not to be picked', () => {
  // (the board's picture lists the crews in this order: kit/tex.js HIRING, read as text: it draws with three.js)
  const hiring = /export const HIRING = \[(.*?)\];/.exec(read('../kit/tex.js'));
  assert.ok(hiring, 'the kit names the captains\' rows');
  assert.deepEqual([...hiring[1].matchAll(/\['(\w+)',/g)].map((m) => m[1]), CAPTAIN_ROWS.map((r) => r.crew));
  for (const r of CAPTAIN_ROWS) {
    const who = ROSTER.find((p) => p.id === r.id);
    assert.ok(who && who.captain, r.id + ' is a captain of the roster'); assert.equal(who.name, r.name);
    assert.equal(r.pick, !CAPTAINS[r.id].down, r.id);
  }
  assert.deepEqual(CAPTAIN_ROWS.filter((r) => !r.pick).map((r) => r.id), ['adair']);
});
