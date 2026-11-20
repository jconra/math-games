// The Hauler (kit/ships/hauler-built.js): its blueprints checked on the space measured inside it, as the Ship Lab
// checks them; its engineer's spot found as the other ships' are; nothing of a cargo bay inside (the game's maker,
// 2026-11-19: "we decided to do the external cargo containers rather than have the pallets on the inside"); and its
// kit named as the other three ships' kits are, so whatever shared code reads one ship reads it too (his words: "the
// ships will basically all fly the same and share the same class"). No browser: plain data and the modules' text.
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
const PLANS = Object.fromEntries(IDS.map((id) => [id, json(`kit/ships/${id}.blueprint.json`)]));
const LAB = readFileSync(here('labs/ships/main.js'), 'utf8');

test('the Hauler\'s plans: the three drawn, each listed in the Ship Lab, the plainest first', () => {
  assert.deepEqual(IDS.slice().sort(), ['hauler-bunks-forward', 'hauler-his-plan', 'hauler-row']);
  const m = LAB.match(/const HAULER_BPS = \[([^\]]*)\]/); assert.ok(m, 'HAULER_BPS in the lab');
  const listed = m[1].split(',').map((s) => s.trim().replace(/'/g, ''));
  assert.deepEqual(listed.slice().sort(), IDS.slice().sort()); assert.equal(listed[0], 'hauler-row');
  for (const [id, bp] of Object.entries(PLANS)) { assert.equal(bp.id, id); assert.equal(bp.shell, 'hauler-built'); assert.equal(bp.grid.deck, SPACE.deck, id); }
});

test('every plan passes every check on the space measured inside the hull', () => {
  for (const [id, bp] of Object.entries(PLANS)) {
    const R = checkBlueprint(bp, SPACE), bad = R.checks.filter((k) => !k.pass);
    assert.equal(bad.length, 0, `${id}: ` + bad.map((k) => `${k.name}: ${k.detail}`).join('; '));
    for (const s of R.sizes) assert.ok(s.ok, `${id}: ${s.name} is small`);
  }
});

test('every plan has the rooms asked for, in one 2 m row down the spine, and no cargo bay', () => {
  for (const [id, bp] of Object.entries(PLANS)) {
    const kinds = new Set(bp.rooms.map((r) => r.kind));
    for (const k of ['cockpit', 'galley', 'bunks', 'washroom', 'engineering']) assert.ok(kinds.has(k), `${id}: a ${ROOM_KINDS[k].label}`);
    assert.ok(!kinds.has('storage') && !bp.rooms.some((r) => /cargo|pallet|hold|bay/i.test(r.name + ' ' + r.id)), `${id}: no cargo bay inside`);
    assert.ok(!(bp.items || []).some((it) => /pallet/i.test(it.name || '')), `${id}: no pallets inside`);
    // (the row: every room between x -1 and 1; the cockpit under the canopy at the nose, engineering at the stern)
    for (const r of bp.rooms) assert.ok(r.rect[0] >= -1 && r.rect[2] <= 1, `${id}: ${r.id} inside the 2 m row`);
    const ck = bp.rooms.find((r) => r.kind === 'cockpit'), en = bp.rooms.find((r) => r.kind === 'engineering');
    assert.equal(ck.ceiling, 'canopy'); assert.ok(bp.rooms.every((r) => r.rect[3] <= ck.rect[3]), `${id}: the cockpit foremost`);
    assert.ok(bp.rooms.every((r) => r.rect[1] >= en.rect[1]), `${id}: engineering aftmost`);
    // (a pilot's seat and a second one at least; the plan from his deck plan four)
    const seats = bp.items.filter((it) => it.room === ck.id && it.kind === 'seat').length;
    assert.ok(seats >= 2, `${id}: ${seats} seats`); if (id === 'hauler-his-plan') assert.equal(seats, 4);
    // (the crew door: one, in the shell's own door)
    const outer = bp.doors.filter((d) => d.rooms[1] === 'outside'); assert.equal(outer.length, 1, id);
  }
});

test('the engineer\'s spot at the reactor, as in the other ships: on clear floor, a step from it', () => {
  for (const [id, bp] of Object.entries(PLANS)) {
    const C = coreIn(bp); assert.ok(C, id);
    const room = bp.rooms.find((r) => r.id === C.room), it = bp.items.find((i) => i.id === C.item), [x, z] = C.stand;
    assert.equal(room.kind, 'engineering'); assert.match(it.name, /reactor/i);
    const far = (r) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - z, 0, z - r[3]));
    assert.ok(far(it.rect) >= CORE.out - 1e-9 && far(it.rect) <= 1.05, `${id}: ${far(it.rect)} m from it`);
    for (const o of bp.items.filter((i) => i.room === room.id && i.y == null && i !== it)) assert.ok(far(o.rect) >= CORE.room - 1e-9, `${id}: ${o.id}`);
  }
});

test('the measured inside: 16 m nose to stern as his picture, the spine\'s rooms 2.5 m high and over 2 m wide', () => {
  const [, , L] = SPACE.size; assert.ok(Math.abs(L - 16) < 0.25, `${L} m long`);
  const H = SPACE.H, at = (x, z) => { const a = Math.floor((x - H.x0) / H.cell + 1e-6), b = Math.floor((z - H.z0) / H.cell + 1e-6), n = a + H.nx * b; return [H.floorCm[n] / 100, H.topCm[n] / 100]; };
  // (down the spine, z -5.5 to 2.5: clear from the deck to 2.5 m right out to the rooms' walls)
  for (let z = -5.45; z < 2.5; z += 0.5) for (const x of [-0.95, 0, 0.95]) { const [F, T] = at(x, z); assert.ok(F <= 0.01 && T >= 2.5 - 1e-9, `z ${z.toFixed(2)} x ${x}: ${F}..${T}`); }
  // (the crew door: on the port side behind the cab, 2 m high from the deck)
  const d = SPACE.doors.list.find((q) => q.kind === 'crew'); assert.equal(d.side, 'port'); assert.equal(d.height, 2);
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
});
