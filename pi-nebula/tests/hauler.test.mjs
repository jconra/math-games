// The Hauler (kit/ships/hauler-built.js): his own deck plan, its one plan (the game's maker, HAUL-1 2026-11-20: "Your
// own deck plan, as near as this hull allows"), checked on the space measured inside it as the Ship Lab checks it; its
// engineer's spot found as the other ships' are; nothing of a cargo bay inside (2026-11-19: "we decided to do the
// external cargo containers rather than have the pallets on the inside"); its containers a mix of ribbed boxes and
// tanks (HAUL-2); all six of its pods turning thrusters and its front legs folding into the cab's belly (HAUL-5); and
// its kit named as the other three ships' kits are, so whatever shared code reads one ship reads it too (his words:
// "the ships will basically all fly the same and share the same class"). No browser: plain data and the modules' text.
// (Where it waits, at the dock, is placed in a page: ~/pw/space-math/rigs/hauler-3/dock.cjs measures it.)
//   node --test pi-nebula/tests/hauler.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { checkBlueprint, ROOM_KINDS } from '../kit/ships/blueprint.js';
import { coreIn, CORE } from '../src/missions.js';

const here = (p) => new URL('../' + p, import.meta.url);
const json = (p) => JSON.parse(readFileSync(here(p), 'utf8'));
const SPACE = json('assets/ships/hauler-built.space.json');
const IDS = readdirSync(here('kit/ships')).filter((f) => /^hauler-.*\.blueprint\.json$/.test(f)).map((f) => f.replace('.blueprint.json', ''));
const BP = json('kit/ships/hauler-his-plan.blueprint.json');
const LAB = readFileSync(here('labs/ships/main.js'), 'utf8');
const KIT = readFileSync(here('kit/ships/hauler-built.js'), 'utf8');
const ROOM = json('kit/rooms/ship-hauler-built.json');
const placed = (piece) => ROOM.pieces.filter((p) => p.piece === piece).map((p) => p.variant);
// a const's array or object literal in the kit's text, by its name
const block = (name) => { const m = KIT.match(new RegExp(`export const ${name} = ([\\[{][\\s\\S]*?[\\]}]);\\n`)); assert.ok(m, name); return m[1]; };

test('the Hauler\'s one plan is his own deck plan, the one the Ship Lab shows', () => {
  assert.deepEqual(IDS, ['hauler-his-plan']);
  const m = LAB.match(/const HAULER_BPS = \[([^\]]*)\]/); assert.ok(m, 'HAULER_BPS in the lab');
  assert.deepEqual(m[1].split(',').map((s) => s.trim().replace(/'/g, '')), ['hauler-his-plan']);
  assert.equal(BP.id, 'hauler-his-plan'); assert.equal(BP.shell, 'hauler-built'); assert.equal(BP.grid.deck, SPACE.deck);
});

test('his plan passes every check on the space measured inside the hull', () => {
  const R = checkBlueprint(BP, SPACE), bad = R.checks.filter((k) => !k.pass);
  assert.equal(bad.length, 0, bad.map((k) => `${k.name}: ${k.detail}`).join('; '));
  for (const s of R.sizes) assert.ok(s.ok, `${s.name} is small`);
});

test('his plan: the cockpit for four, the crew area the door opens into, one 2-high bunk, the washroom by a passage, a bigger engineering, no cargo bay', () => {
  const room = (id) => BP.rooms.find((r) => r.id === id), kinds = new Set(BP.rooms.map((r) => r.kind));
  for (const k of ['cockpit', 'galley', 'bunks', 'washroom', 'corridor', 'engineering']) assert.ok(kinds.has(k), `a ${ROOM_KINDS[k].label}`);
  assert.ok(!kinds.has('storage') && !BP.rooms.some((r) => /cargo|pallet|hold|bay/i.test(r.name + ' ' + r.id)), 'no cargo bay inside');
  assert.ok(!(BP.items || []).some((it) => /pallet/i.test(it.name || '')), 'no pallets inside');
  // (one 2 m row down the spine; the cockpit under the canopy at the nose, engineering at the stern)
  for (const r of BP.rooms) assert.ok(r.rect[0] >= -1 && r.rect[2] <= 1, `${r.id} inside the 2 m row`);
  const ck = BP.rooms.find((r) => r.kind === 'cockpit'), en = BP.rooms.find((r) => r.kind === 'engineering');
  assert.equal(ck.ceiling, 'canopy'); assert.ok(BP.rooms.every((r) => r.rect[3] <= ck.rect[3]), 'the cockpit foremost');
  assert.ok(BP.rooms.every((r) => r.rect[1] >= en.rect[1]), 'engineering aftmost');
  // the cockpit for four: two seats and two more behind them
  const seats = BP.items.filter((it) => it.room === ck.id && it.kind === 'seat');
  assert.equal(seats.length, 4); assert.equal(new Set(seats.map((s) => s.rect[1])).size, 2, 'two by two');
  // no airlock: the crew door opens straight into the crew area (the mess)
  assert.ok(!kinds.has('airlock'), 'no airlock');
  const outer = BP.doors.filter((d) => d.rooms[1] === 'outside'); assert.equal(outer.length, 1);
  assert.equal(room(outer[0].rooms[0]).kind, 'galley', 'the crew door into the crew area');
  // one 2-high bunk
  const bunks = BP.items.filter((it) => it.kind === 'bunk'); assert.equal(bunks.length, 1); assert.match(bunks[0].name, /2-high/);
  // the washroom beside a passage: side by side across the row, the passage joining the rooms fore and aft of them
  const wash = BP.rooms.find((r) => r.kind === 'washroom'), pass = BP.rooms.find((r) => r.kind === 'corridor');
  assert.deepEqual([wash.rect[1], wash.rect[3]], [pass.rect[1], pass.rect[3]]); assert.equal(wash.rect[2], pass.rect[0]);
  assert.ok(BP.doors.some((d) => d.rooms.includes(wash.id) && d.rooms.includes(pass.id)), 'the washroom\'s door on the passage');
  // a bigger engineering (the pallet bay's room went to it and the crew area): 3.5 m of the row
  assert.equal(en.rect[3] - en.rect[1], 3.5); assert.equal(room('crew').rect[3] - room('crew').rect[1], 3.5);
});

test('the engineer\'s spot at the reactor, as in the other ships: on clear floor, a step from it', () => {
  const C = coreIn(BP); assert.ok(C);
  const room = BP.rooms.find((r) => r.id === C.room), it = BP.items.find((i) => i.id === C.item), [x, z] = C.stand;
  assert.equal(room.kind, 'engineering'); assert.match(it.name, /reactor/i);
  const far = (r) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - z, 0, z - r[3]));
  assert.ok(far(it.rect) >= CORE.out - 1e-9 && far(it.rect) <= 1.05, `${far(it.rect)} m from it`);
  for (const o of BP.items.filter((i) => i.room === room.id && i.y == null && i !== it)) assert.ok(far(o.rect) >= CORE.room - 1e-9, o.id);
});

test('the measured inside: 16 m nose to stern as his picture, the spine\'s rooms 2.5 m high and over 2 m wide', () => {
  const [, , L] = SPACE.size; assert.ok(Math.abs(L - 16) < 0.25, `${L} m long`);
  const H = SPACE.H, at = (x, z) => { const a = Math.floor((x - H.x0) / H.cell + 1e-6), b = Math.floor((z - H.z0) / H.cell + 1e-6), n = a + H.nx * b; return [H.floorCm[n] / 100, H.topCm[n] / 100]; };
  // (down the spine, z -5.5 to 2.5: clear from the deck to 2.5 m right out to the rooms' walls)
  for (let z = -5.45; z < 2.5; z += 0.5) for (const x of [-0.95, 0, 0.95]) { const [F, T] = at(x, z); assert.ok(F <= 0.01 && T >= 2.5 - 1e-9, `z ${z.toFixed(2)} x ${x}: ${F}..${T}`); }
  // (the crew door: on the port side behind the cab, 2 m high from the deck)
  const d = SPACE.doors.list.find((q) => q.kind === 'crew'); assert.equal(d.side, 'port'); assert.equal(d.height, 2);
});

test('the ship as built: the cockpit for four is its own, with the rooms inside or not', () => {
  assert.deepEqual(placed('hbCockpit'), ['four seats']);
  assert.match(KIT, /hbCockpit: \{ 'four seats': 'four seats, cabin' \}/);
  assert.ok(!BP.swap, 'his plan needs no swap of its own: the ship\'s cockpit is already the one for four');
});

test('the containers: some ribbed steel boxes, some eight-sided tanks, four and four, the two sides alike', () => {
  const mix = block('CARGO_MIX'), looks = readFileSync(here('kit/ships/cargo-container.js'), 'utf8');
  assert.match(mix, /upper: 'ribbed'/); assert.match(mix, /lower: 'tank'/);
  assert.match(looks, /\n  ribbed: \{/); assert.match(looks, /\n  tank: \{/);
  assert.match(block('CARGO_LOOK'), /look: 'mix'/);
  const mounts = placed('hbContainer'); assert.equal(mounts.length, 8);
  for (const side of ['port', 'starboard']) for (const row of ['upper', 'lower']) assert.equal(mounts.filter((m) => m.startsWith(`${side} ${row}`)).length, 2, `${side} ${row}`);
});

test('all six pods turn and fire; the front legs fold into the cab\'s belly', () => {
  const pods = [...block('PODS').matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
  assert.equal(pods.length, 6); assert.deepEqual(placed('hbPod'), pods, 'every pod placed, in PODS\' order (podStep pairs them so)');
  assert.ok(pods.includes('front port') && pods.includes('front starboard'));
  assert.ok(!/LEG_PODS/.test(KIT), 'no fixed leg pods left');
  // (the front pods stand out from the cab far enough to turn: their middle 2.1 m out)
  for (const m of block('PODS').matchAll(/name: 'front (?:port|starboard)', at: \[(-?[\d.]+), ([\d.]+), ([\d.]+)\]/g)) assert.equal(Math.abs(+m[1]), 2.1);
  // the legs: the front two under the cab's belly (inside its flat middle), folding about a hinge under the cockpit's
  // floor into wells there; the rear two as before
  const gear = block('GEAR'), at = (k) => gear.match(new RegExp(`'${k}': \\[(-?[\\d.]+), (-?[\\d.]+)\\]`)).slice(1).map(Number);
  for (const k of ['port front', 'starboard front']) { const [x, z] = at(k); assert.ok(Math.abs(x) < 0.6 && z > 5 && z < 7, `${k} at ${x}, ${z}`); }
  for (const k of ['port rear', 'starboard rear']) assert.deepEqual(at(k).map(Math.abs), [1.5, 4.4]);
  const fold = block('FOLD');
  const hinge = +fold.match(/hinge: ([\d.]+)/)[1], top = +fold.match(/top: ([\d.]+)/)[1], deck = ROOM.grid.deck, floor = +KIT.match(/export const COCKPIT = \{ floor: ([\d.]+)/)[1];
  assert.ok(hinge < top && top < deck + floor, `the hinge ${hinge} and the wells' top ${top} under the cockpit's floor ${deck + floor}`);
  assert.deepEqual(placed('hbGear').slice().sort(), ['port front', 'port rear', 'starboard front', 'starboard rear']);
});

test('the Hauler\'s kit is named as the other ships\' kits are', () => {
  const src = (n) => readFileSync(here(`kit/ships/${n}-built.js`), 'utf8');
  const names = (s) => new Set([...s.matchAll(/^export (?:const|function|let) ([A-Za-z_]\w*)/gm)].map((m) => m[1]));
  const E = names(src('explorer')), M = names(src('miner')), D = names(src('medic')), H = names(src('hauler'));
  // every name all three others export (but their catalogs, each its own), the Hauler exports too
  const all = [...E].filter((k) => M.has(k) && D.has(k) && !/^SHIP_/.test(k));
  assert.ok(all.length >= 15, all.join(' '));
  for (const k of all) assert.ok(H.has(k), `the Hauler's kit lacks ${k}`);
  assert.ok(H.has('SHIP_HAULER_BUILT'));
  // the thruster pods by the Miner's names (kit/ships/flight.js flies a ship by them), the crew door's by the Medic's
  for (const k of ['PODS', 'POD_SWING', 'POD_JET', 'podJets', 'podStep', 'CREWDOOR', 'CREWSTAIR', 'GEAR', 'GLASS_TINT']) assert.ok(H.has(k), k);
  // its LAB's controls are the shared ones, by the same names
  const ctl = src('hauler').match(/controls: \[([^\]]*)\]/)[1].split(',').map((s) => s.trim().replace(/'/g, ''));
  const known = new Set(['arms', 'thrusters', 'canisters', 'ramps', 'rampCount', 'gear', 'door', 'dirt', 'throttle']);
  for (const k of ctl) assert.ok(known.has(k), `a control of its own: ${k}`);
  for (const k of ['thrusters', 'canisters', 'gear', 'door', 'dirt', 'throttle']) assert.ok(ctl.includes(k), k);
  // the rooms inside, as the others have them: LAB.cabin's pieces that change (each a variant the catalog has) and its
  // outer door
  const H2 = src('hauler'), cab = H2.match(/cabin: \{ swap: \{(.*?)\} \}, outer: \{ head: (.*?), sill: (.*?) \} \}/);
  assert.ok(cab, 'LAB.cabin { swap, outer: { head, sill } }');
  for (const [, piece, to] of cab[1].matchAll(/(hb\w+): \{ [^:]+: '([^']+)' \}/g)) assert.ok(new RegExp(`${piece}: \\{[^\\n]*variants: \\[[^\\]]*'${to}'`).test(H2), `${piece} has the variant '${to}'`);
});
