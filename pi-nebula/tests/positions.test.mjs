// Our crew in their positions' colours (kit/positions.js; the game's maker, of the stasis pods' sleepers in red for a
// captain, purple for an engineer, yellow for a drill operator, asked whether our own crew should too: "Let's do them
// all"): one table for the sleepers, the station's people and the ships' crews; worn on the crew uniform's bands. A
// sleeper in an outfit without bands is swapped for the crew uniform of its build; our own crew keep their own bodies
// (his answer JOB1-1 B: the captains and the medic in their own bodies and colours, no job colour on them), so only those
// already in a crew uniform show it. Run against the crew kit's own list of parts (assets/crew/crew.json).
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { POSITIONS, POSITION_IDS, CREW_UNIFORM, wearPosition } from '../kit/positions.js';
import * as POD from '../kit/stasispod-plan.js';
import { ROSTER, ROOM_CREW, lookRecipe } from '../src/life.js';
import { ROLES, MISSIONS, aboardOf } from '../src/missions.js';

const CREW = JSON.parse(readFileSync(new URL('../assets/crew/crew.json', import.meta.url), 'utf8'));
const lib = { list: CREW, entry: (kind, id) => (CREW.parts[kind] || []).find((p) => p.id === id) || null };
// (the crew kit's band colours, read from its source: kit/crew.js loads three.js, which node has not)
const BANDS = JSON.parse(readFileSync(new URL('../kit/crew.js', import.meta.url), 'utf8').match(/export const BAND_COLOURS = (\{[^}]*\})/)[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
const dressed = (def) => lookRecipe(def.look, def.position, lib);
const ownOf = (look) => (typeof look === 'string' ? CREW.recipes[look] : look);
const inUniform = (R) => Object.values(CREW_UNIFORM).includes(R.suit);

test('one table: the five positions, each a band colour of the crew kit\'s by its name, his three as he named them', () => {
  assert.deepEqual(POSITION_IDS, ['captain', 'pilot', 'engineer', 'drill', 'medic']);
  for (const id of POSITION_IDS) assert.equal(POSITIONS[id].colour, BANDS[POSITIONS[id].band], id);
  assert.equal(POSITIONS.captain.band, 'red'); assert.equal(POSITIONS.engineer.band, 'purple'); assert.equal(POSITIONS.drill.band, 'gold');
  // (the pods' plan hands on the very same table, not a copy)
  assert.equal(POD.POSITIONS, POSITIONS); assert.equal(POD.POSITION_IDS, POSITION_IDS);
});

test('the sleepers\' way: a crew uniform kept, any other outfit swapped for the crew uniform of its build; kept bodies: only a crew uniform takes the colour', () => {
  for (const s of CREW.parts.suit) {
    const head = CREW.parts.head.find((h) => h.with === s.id);
    const R0 = { suit: s.id, head: head ? head.id : 't3', colours: { skin: '#c48a62' } };
    const R = wearPosition(R0, 'medic', lib), K = wearPosition(R0, 'medic', lib, { keep: true });
    if (head) { assert.equal(R, R0, s.id + ' brings its own head: as made'); assert.equal(K, R0); continue; }
    assert.equal(R.suit, Object.values(CREW_UNIFORM).includes(s.id) ? s.id : CREW_UNIFORM[s.skeleton], s.id);
    assert.equal(lib.entry('suit', R.suit).skeleton, s.skeleton, s.id + ' keeps its build');
    assert.equal(R.colours.uniform, POSITIONS.medic.colour); assert.equal(R.colours.skin, '#c48a62');
    if (inUniform(R0)) assert.deepEqual(K, R); else assert.equal(K, R0, s.id + ' kept as it is');
  }
  const R = { suit: 'civilian', head: 't1' };
  assert.equal(wearPosition(R, null, lib), R); assert.equal(wearPosition(R, 'cook', lib), R);
  assert.equal(wearPosition({ ...R, position: 'pilot' }, null, lib).colours.uniform, POSITIONS.pilot.colour, 'a recipe\'s own position');
});

test('the captains, the medic and the miner keep their own bodies in their own colours (JOB1-1 B); Jon the mechanic in the engineer\'s purple (JOB1-2 B)', () => {
  for (const [id, pos] of Object.entries({ ruiz: 'captain', hale: 'captain', adair: 'captain', medic: 'medic', 'miner-oso': 'drill' })) {
    const def = ROSTER.find((d) => d.id === id); assert.ok(def, id); assert.equal(def.position, pos, id);
    assert.equal(dressed(def), ownOf(def.look), id + ' exactly as their look');
  }
  assert.equal(ROSTER.find((d) => d.id === 'adair').look.colours.uniform, '#2f6db3', 'Captain Adair in her own blue');
  const jon = dressed(ROSTER.find((d) => d.id === 'mechanic'));
  assert.equal(jon.suit, 'atlantis1'); assert.equal(jon.colours.uniform, POSITIONS.engineer.colour);
  // (Captain Vega's body brings its own head: as made)
  assert.equal(dressed(ROSTER.find((d) => d.id === 'vega')).suit, 'vega');
});

test('everyone whose work is none of the five keeps their own clothes, exactly as their look has them (Ada, Dara as now: JOB1-3 A)', () => {
  for (const def of [...ROSTER, ...ROOM_CREW]) {
    if (def.position) continue;
    assert.equal(dressed(def), ownOf(def.look), def.id + ' as their look has it');
  }
  assert.equal(ROSTER.find((d) => d.id === 'crew-ada').look.colours.uniform, '#6e28b2');
  assert.equal(ROOM_CREW.find((d) => d.id === 'duty-dara').look.colours.uniform, '#3f8fe8');
});

test('the Miner\'s crew aboard: the pilot and the engineer (crew uniforms) in their jobs\' colours, the drill operator and Captain Ruiz in their own', () => {
  const M = MISSIONS.mining;
  for (const first of M.roles) {
    const mine = M.roles.filter((r) => r !== first && M.roles.indexOf(r) < M.roles.indexOf(first));     // (the roles before it signed for)
    const A = aboardOf(M, mine);
    const crew = A.find((a) => !a.captain); assert.equal(crew.id, 'crew-' + first);
    const R = lookRecipe(crew.look, null, lib), own = ROLES[first].look;
    if (inUniform(own)) { assert.equal(R.suit, own.suit, first); assert.equal(R.colours.uniform, POSITIONS[first].colour, first); }
    else { assert.equal(R.suit, own.suit, first + ' in their own body'); assert.equal((R.colours || {}).uniform, (own.colours || {}).uniform, first); }
    assert.equal(ROLES[first].look.position, undefined, 'the role\'s own look is not changed');
    const cap = A.find((a) => a.captain), def = ROSTER.find((d) => d.id === cap.look);
    assert.equal(dressed(def), ownOf(def.look));
  }
  assert.ok(inUniform(ROLES.pilot.look) && inUniform(ROLES.engineer.look), 'the pilot and the engineer wear crew uniforms');
});
