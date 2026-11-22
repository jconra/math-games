// Our crew in their positions' colours (kit/positions.js; the game's maker, of the stasis pods' sleepers in red for a
// captain, purple for an engineer, yellow for a drill operator, asked whether our own crew should too: "Let's do them
// all"): one table for the sleepers, the station's people and the ships' crews; worn on the crew uniform's bands, an
// outfit without bands swapped for the crew uniform of its build. Run against the crew kit's own list of parts
// (assets/crew/crew.json).
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

test('one table: the five positions, each a band colour of the crew kit\'s by its name, his three as he named them', () => {
  assert.deepEqual(POSITION_IDS, ['captain', 'pilot', 'engineer', 'drill', 'medic']);
  for (const id of POSITION_IDS) assert.equal(POSITIONS[id].colour, BANDS[POSITIONS[id].band], id);
  assert.equal(POSITIONS.captain.band, 'red'); assert.equal(POSITIONS.engineer.band, 'purple'); assert.equal(POSITIONS.drill.band, 'gold');
  // (the pods' plan hands on the very same table, not a copy)
  assert.equal(POD.POSITIONS, POSITIONS); assert.equal(POD.POSITION_IDS, POSITION_IDS);
});

test('worn on the crew uniform\'s bands: a crew uniform kept, any other outfit swapped for the crew uniform of its build', () => {
  for (const s of CREW.parts.suit) {
    const head = CREW.parts.head.find((h) => h.with === s.id);
    const R = wearPosition({ suit: s.id, head: head ? head.id : 't3', colours: { skin: '#c48a62' } }, 'medic', lib);
    if (head) { assert.equal(R.suit, s.id, s.id + ' brings its own head: as made'); assert.equal(R.colours.uniform, undefined); continue; }
    assert.equal(R.suit, Object.values(CREW_UNIFORM).includes(s.id) ? s.id : CREW_UNIFORM[s.skeleton], s.id);
    assert.equal(lib.entry('suit', R.suit).skeleton, s.skeleton, s.id + ' keeps its build');
    assert.equal(R.colours.uniform, POSITIONS.medic.colour); assert.equal(R.colours.skin, '#c48a62');
  }
  const R = { suit: 'civilian', head: 't1' };
  assert.equal(wearPosition(R, null, lib), R); assert.equal(wearPosition(R, 'cook', lib), R);
  assert.equal(wearPosition({ ...R, position: 'pilot' }, null, lib).colours.uniform, POSITIONS.pilot.colour, 'a recipe\'s own position');
});

test('the station\'s captains and medic, and the miner off the Miner, in their positions\' colours; the captains in red', () => {
  const want = { ruiz: 'captain', hale: 'captain', adair: 'captain', medic: 'medic', 'miner-oso': 'drill' };
  for (const [id, pos] of Object.entries(want)) {
    const def = ROSTER.find((d) => d.id === id); assert.ok(def, id); assert.equal(def.position, pos, id);
    const R = dressed(def);
    assert.equal(R.colours.uniform, POSITIONS[pos].colour, id); assert.ok(Object.values(CREW_UNIFORM).includes(R.suit), id + ' in a crew uniform');
    assert.ok(lib.entry('head', R.head) && (R.hair === null || R.hair === undefined || lib.entry('hair', R.hair)), id + ' head and hair as their look');
  }
  // (Captain Vega's body brings its own head: as made)
  const vega = ROSTER.find((d) => d.id === 'vega'); assert.equal(dressed(vega).suit, 'vega');
});

test('everyone whose work is none of the five keeps their own clothes, exactly as their look has them', () => {
  const positioned = new Set(['ruiz', 'hale', 'adair', 'medic', 'miner-oso']);
  for (const def of [...ROSTER, ...ROOM_CREW]) {
    if (positioned.has(def.id)) continue;
    assert.equal(def.position, undefined, def.id);
    const R = dressed(def), own = typeof def.look === 'string' ? CREW.recipes[def.look] : def.look;
    assert.equal(R, own, def.id + ' as their look has it');
  }
});

test('the ships\' crews: the Miner\'s pilot, drill operator and engineer aboard in their jobs\' colours, Captain Ruiz in red', () => {
  const M = MISSIONS.mining;
  for (const first of M.roles) {
    const mine = M.roles.filter((r) => r !== first && M.roles.indexOf(r) < M.roles.indexOf(first));     // (the roles before it signed for)
    const A = aboardOf(M, mine);
    const crew = A.find((a) => !a.captain); assert.equal(crew.id, 'crew-' + first);
    const R = lookRecipe(crew.look, null, lib);
    assert.equal(R.colours.uniform, POSITIONS[first].colour, first); assert.ok(Object.values(CREW_UNIFORM).includes(R.suit), first);
    assert.equal(ROLES[first].look.position, undefined, 'the role\'s own look is not changed');
    const cap = A.find((a) => a.captain), def = ROSTER.find((d) => d.id === cap.look);
    assert.equal(dressed(def).colours.uniform, POSITIONS.captain.colour);
  }
});
