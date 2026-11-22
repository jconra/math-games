// The positions' colours (kit/positions.js): one table for the stasis pods' sleepers and for a crew whose standard is a
// uniform. The game's maker (2026-11-22): "certain crews might all use a standard uniform. Like maybe on the miner
// everyone wears whatever they want. But on the medic ship everyone wears the Atlantis uniforms and the colors mean
// something"; of Captain Hale: "the captain should also have the crews uniform". So the Medic's crew (Captain Hale too)
// wear the crew uniform in their position's colour; the Miner's crew and the station's people their own clothes; Jon
// the mechanic in the engineer's purple (JOB1-2 B); the other captains their own bodies (JOB1-1 B). Run against the crew
// kit's own list of parts (assets/crew/crew.json).
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { POSITIONS, POSITION_IDS, CREW_UNIFORM, CREWS, wearPosition, crewRecipe } from '../kit/positions.js';
import * as POD from '../kit/stasispod-plan.js';
import { ROSTER, ROOM_CREW, lookRecipe } from '../src/life.js';
import { ROLES, MISSIONS, aboardOf } from '../src/missions.js';

const CREW = JSON.parse(readFileSync(new URL('../assets/crew/crew.json', import.meta.url), 'utf8'));
const lib = { list: CREW, entry: (kind, id) => (CREW.parts[kind] || []).find((p) => p.id === id) || null };
// (the crew kit's band colours, read from its source: kit/crew.js loads three.js, which node has not)
const BANDS = JSON.parse(readFileSync(new URL('../kit/crew.js', import.meta.url), 'utf8').match(/export const BAND_COLOURS = (\{[^}]*\})/)[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
const def = (id) => [...ROSTER, ...ROOM_CREW].find((d) => d.id === id);
const dressed = (d) => lookRecipe(d.look, d, lib);
const ownOf = (look) => (typeof look === 'string' ? CREW.recipes[look] : look);

test('one table: the five positions, each a band colour of the crew kit\'s by its name, his three as he named them', () => {
  assert.deepEqual(POSITION_IDS, ['captain', 'pilot', 'engineer', 'drill', 'medic']);
  for (const id of POSITION_IDS) assert.equal(POSITIONS[id].colour, BANDS[POSITIONS[id].band], id);
  assert.equal(POSITIONS.captain.band, 'red'); assert.equal(POSITIONS.engineer.band, 'purple'); assert.equal(POSITIONS.drill.band, 'gold');
  // (the pods' plan hands on the very same table, not a copy)
  assert.equal(POD.POSITIONS, POSITIONS); assert.equal(POD.POSITION_IDS, POSITION_IDS);
});

test('worn the sleepers\' way: a crew uniform kept, any other outfit swapped for the crew uniform of its build', () => {
  for (const s of CREW.parts.suit) {
    const head = CREW.parts.head.find((h) => h.with === s.id);
    const R0 = { suit: s.id, head: head ? head.id : 't3', colours: { skin: '#c48a62' } }, R = wearPosition(R0, 'medic', lib);
    if (head) { assert.equal(R, R0, s.id + ' brings its own head: as made'); continue; }
    assert.equal(R.suit, Object.values(CREW_UNIFORM).includes(s.id) ? s.id : CREW_UNIFORM[s.skeleton], s.id);
    assert.equal(lib.entry('suit', R.suit).skeleton, s.skeleton, s.id + ' keeps its build');
    assert.equal(R.colours.uniform, POSITIONS.medic.colour); assert.equal(R.colours.skin, '#c48a62');
  }
  const R = { suit: 'civilian', head: 't1' };
  assert.equal(wearPosition(R, null, lib), R); assert.equal(wearPosition(R, 'cook', lib), R);
  assert.equal(wearPosition({ ...R, position: 'pilot' }, null, lib).colours.uniform, POSITIONS.pilot.colour, 'a recipe\'s own position');
});

test('a crew\'s standard: the Medic\'s crew in the crew uniform in their positions\' colours, its captain too; the Miner\'s in their own', () => {
  assert.equal(CREWS.medic.standard, true); assert.equal(CREWS.medic.captainToo, true); assert.equal(CREWS.miner.standard, false);
  for (const p of CREWS.medic.positions) assert.ok(POSITIONS[p], p);
  const jacket = { suit: 'civilian', head: 't1', colours: { skin: '#c48a62' } };
  for (const p of CREWS.medic.positions) {
    const R = crewRecipe(jacket, { ship: 'medic', position: p }, lib);
    assert.equal(R.suit, 'atlantis1', p); assert.equal(R.colours.uniform, POSITIONS[p].colour, p);
    assert.equal(crewRecipe(jacket, { ship: 'miner', position: p }, lib), jacket, 'the Miner\'s ' + p + ' in their own');
    assert.equal(crewRecipe(jacket, { position: p }, lib), jacket, 'no crew: their own');
  }
  assert.equal(crewRecipe(jacket, { ship: 'medic', captain: true }, lib).colours.uniform, POSITIONS.captain.colour);
  assert.equal(crewRecipe(jacket, { ship: 'miner', captain: true }, lib), jacket);
});

test('Captain Hale in the crew uniform in the captain\'s red, her official uniform; the other captains in their own bodies', () => {
  const H = dressed(def('hale'));
  assert.equal(H.suit, 'atlantis2'); assert.equal(H.colours.uniform, POSITIONS.captain.colour);
  const own = ownOf(def('hale').look); assert.equal(H.head, own.head); assert.equal(H.hair, own.hair);
  for (const id of ['ruiz', 'adair', 'vega', 'rook']) assert.equal(dressed(def(id)), ownOf(def(id).look), id);
  assert.equal(def('adair').look.colours.uniform, '#2f6db3', 'Captain Adair in her own blue');
});

test('the station\'s people in their own clothes, exactly as their looks; Jon in the engineer\'s purple (JOB1-2 B); Ada and Dara as they are', () => {
  for (const d of [...ROSTER, ...ROOM_CREW]) {
    if (d.id === 'hale') continue;
    assert.equal(dressed(d), ownOf(d.look), d.id + ' as their look has it');
    assert.equal(d.position, undefined, d.id);
  }
  const jon = dressed(def('mechanic')); assert.equal(jon.suit, 'atlantis1'); assert.equal(jon.colours.uniform, POSITIONS.engineer.colour);
  assert.equal(def('crew-ada').look.colours.uniform, '#6e28b2'); assert.equal(def('duty-dara').look.colours.uniform, '#3f8fe8');
});

test('aboard the Miner: its crew member and Captain Ruiz in their own clothes, whatever roles are signed for', () => {
  const M = MISSIONS.mining; assert.equal(M.ship, 'miner');
  for (const first of M.roles) {
    const mine = M.roles.filter((r) => r !== first && M.roles.indexOf(r) < M.roles.indexOf(first));     // (the roles before it signed for)
    const A = aboardOf(M, mine), crew = A.find((a) => !a.captain);
    assert.equal(crew.id, 'crew-' + first); assert.equal(crew.look.crew, 'miner'); assert.equal(crew.look.position, first);
    const R = lookRecipe(crew.look, null, lib), own = ROLES[first].look;
    assert.equal(R.suit, own.suit, first); assert.equal((R.colours || {}).uniform, (own.colours || {}).uniform, first);
    assert.equal(ROLES[first].look.position, undefined, 'the role\'s own look is not changed');
    const cap = A.find((a) => a.captain); assert.equal(dressed(def(cap.look)), ownOf(def(cap.look).look));
  }
  // (a Medic mission's crew, as missions.js would hand them aboard: in its standard)
  const medicCrew = lookRecipe({ ...ROLES.pilot.look, position: 'pilot', crew: 'medic' }, null, lib);
  assert.equal(medicCrew.colours.uniform, POSITIONS.pilot.colour);
});
