// THE PAINT OF A SHIP THAT IS YOURS (kit/ships/paints.js, src/paint.js, src/paintcard.js, src/shippaint.js; the game's
// maker, asked what he would want to change on a ship that is his: "Its colour: pick the paint of its hull."): the set
// of paints; what of each ship is paint, held to its kit; how a paint is laid on a built ship (only the skin's corners,
// nothing added, back exactly as built); who may paint (only a ship that is theirs); how it is kept (with the crew
// member, for that ship, each crew member their own); the swatches on the owner's card; the Ships Lab's picker.
// No browser: plain numbers, words, and the modules' text.
//   node --test pi-nebula/tests/paint.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAINTS, FACTORY, SKIN, SHIP_IDS, paintById, tidyPaint, hullColour, lin, hexOf, lum, tintOf, paintBuilt } from '../kit/ships/paints.js';
import { COST, paintsOf, paintOf, mayPaint, setPaint, swatchesOf } from '../src/paint.js';
import { paintHtml, paintButton } from '../src/paintcard.js';
import { PRICES, buy } from '../src/own.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const maya = (more = {}) => ({ id: 'p1', name: 'Maya', credits: 500, ...more });
const leo = (more = {}) => ({ id: 'p2', name: 'Leo', credits: 500, ...more });
const bytesOf = (hex) => lin(hex).map((v) => Math.round(v * 255));

test('the paints: a small set, the ship\'s own first, each with a name and a colour of its own', () => {
  assert.ok(PAINTS.length >= 8 && PAINTS.length <= 10, `8 to 10 paints (${PAINTS.length})`);
  assert.equal(PAINTS[0].id, FACTORY); assert.equal(PAINTS[0].c, undefined, 'the ship\'s own paint has no colour: nothing is changed');
  assert.equal(new Set(PAINTS.map((p) => p.id)).size, PAINTS.length); assert.equal(new Set(PAINTS.map((p) => p.name)).size, PAINTS.length);
  for (const p of PAINTS.slice(1)) { assert.match(p.c, /^#[0-9a-f]{6}$/, p.id); assert.ok(p.name.length > 2 && p.name.length < 16, p.name); }
  assert.equal(new Set(PAINTS.slice(1).map((p) => p.c)).size, PAINTS.length - 1);
  assert.equal(paintById('olive').name, 'Olive drab'); assert.equal(paintById('pink'), null);
  assert.equal(tidyPaint('navy'), 'navy'); assert.equal(tidyPaint('pink'), FACTORY); assert.equal(tidyPaint(undefined), FACTORY);
  // (a paint for every ship that can be bought, and for nothing else)
  assert.deepEqual([...SHIP_IDS].sort(), Object.keys(PRICES).sort());
});

test('muted, not candy: no paint is vivid, none is as bright as a ship\'s own skin, and no two are hard to tell apart', () => {
  for (const p of PAINTS.slice(1)) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(p.c.slice(i, i + 2), 16) / 255), hi = Math.max(r, g, b), lo = Math.min(r, g, b);
    assert.ok(hi <= 0.72, `${p.id}: not bright (${hi.toFixed(2)})`);
    assert.ok((hi - lo) / hi <= 0.82, `${p.id}: not vivid (${((hi - lo) / hi).toFixed(2)})`);
    // (a glowing emblem that reads on the ship's own skin has more to stand out from on every paint: each is darker)
    for (const ship of SHIP_IDS) assert.ok(lum(p.c) < 0.75 * lum(SKIN[ship].c[0]), `${p.id} is darker than the ${ship}'s skin`);
  }
  const far = (a, b) => Math.hypot(...lin(a).map((v, i) => Math.sqrt(v) - Math.sqrt(lin(b)[i])));
  for (const a of PAINTS.slice(1)) for (const b of PAINTS.slice(1)) if (a.id < b.id) assert.ok(far(a.c, b.c) > 0.1, `${a.id} and ${b.id} can be told apart (${far(a.c, b.c).toFixed(2)})`);
  // (and none is a ship's dark trim over again: its panels would be lost in its lower hull)
  for (const dark of ['#474c53', '#3a3e44', '#43484f', '#3d4249']) for (const p of PAINTS.slice(1)) assert.ok(far(p.c, dark) > 0.08, `${p.id} is not the trim ${dark} (${far(p.c, dark).toFixed(2)})`);
});

test('what of each ship is paint: its skin, by the names and colours its kit paints it with, and nothing else of its palette', () => {
  for (const ship of SHIP_IDS) {
    const S = SKIN[ship], T = read('kit/ships/' + S.kit);
    const pal = T.match(/export const PAL = \{([\s\S]*?)\n\};/); assert.ok(pal, `${ship}: its kit's palette`);
    const entries = [...pal[1].matchAll(/(\w+): s\('(#[0-9a-fA-F]{6})'/g)].map((m) => [m[1], m[2].toLowerCase()]);
    assert.ok(entries.length > 8, `${ship}: its palette read (${entries.length})`);
    const skin = entries.filter(([n]) => S.names.includes(n));
    assert.equal(skin.length, S.names.length, `${ship}: its skin's names are in its kit (${S.names})`);
    assert.deepEqual([...new Set(skin.map(([, c]) => c))].sort(), [...S.c].sort(), `${ship}: the skin's colours are its kit's`);
    assert.equal(skin[0][1], S.c[0], `${ship}: the first is the skin itself`);
    // (nothing else of the ship is painted that colour: its canisters, its belly, its bunks ... would change with it)
    for (const [n, c] of entries) if (!S.names.includes(n)) for (const k of S.c) assert.ok(Math.max(...bytesOf(c).map((v, i) => Math.abs(v - bytesOf(k)[i]))) > 2, `${ship}: ${n} (${c}) is not the skin's colour ${k}`);
    // (the kit paints its hull's faces by those names: the rules' last word is the skin)
    assert.match(T, new RegExp(`\\['[^']*', \\(\\) => true, (edge\\('${S.names[0]}'\\)|'${S.names[0]}')\\]`), `${ship}: everything not ruled otherwise is its skin`);
    assert.equal(hullColour(ship, FACTORY), S.c[0]); assert.equal(hullColour(ship, 'navy'), paintById('navy').c);
  }
});

test('a corner\'s new colour: the skin comes out as the paint exactly, an edge a shade off stays that shade off, the ship\'s own changes nothing', () => {
  for (const ship of SHIP_IDS) for (const p of PAINTS.slice(1)) {
    const t = tintOf(ship, p.id), out = t(lin(SKIN[ship].c[0]));
    assert.equal(hexOf(out), p.c, `${ship} in ${p.id}`);
    for (const edge of SKIN[ship].c.slice(1)) {
      const e = t(lin(edge)), want = lin(edge).map((v, i) => v / lin(SKIN[ship].c[0])[i] * lin(p.c)[i]);
      e.forEach((v, i) => assert.ok(Math.abs(v - Math.min(1, want[i])) < 1e-9));
      assert.ok(e.every((v) => v >= 0 && v <= 1));
    }
  }
  assert.equal(tintOf('miner', FACTORY), null); assert.equal(tintOf('miner', 'pink'), null); assert.equal(tintOf('gunship', 'navy'), null);
});

// a built ship as the kit's layout makes one, small: rooms with one list of corners each (four bytes a corner, the
// fourth full), and moving parts drawn from small lists of their own (three numbers a corner)
function fakeBuilt() {
  const attr = (arr, itemSize) => ({ array: arr, itemSize, needsUpdate: false });
  const roomList = (colours) => { const a = new Uint8Array(colours.length * 4); colours.forEach((hex, i) => a.set([...bytesOf(hex), 255], i * 4)); return attr(a, 4); };
  const leafList = (colours) => { const a = new Float32Array(colours.length * 3); colours.forEach((hex, i) => a.set(lin(hex), i * 3)); return attr(a, 3); };
  const cream = SKIN.miner.c[0], dark = '#474c53', yellow = '#e2ae1c', can = '#cbc2a8';
  const ship = roomList([cream, dark, cream, yellow, can, cream, dark]), hangar = roomList([cream, '#b7b7b2', cream]), other = roomList([SKIN.explorer.c[0], cream]);
  const leg = leafList([dark, cream, cream]), shared = leafList([cream, cream]), glow = leafList([cream]);
  const mesh = (name, a) => ({ name, geometry: { attributes: { color: a } } });
  return {
    lists: { ship, hangar, other, leg, shared, glow },
    zones: [{ id: 'hangar-miner', merged: { solid: { attributes: { color: hangar } } } }, { id: 'ship-miner', merged: { solid: { attributes: { color: ship } } } }, { id: 'ship-explorer', merged: { solid: { attributes: { color: other } } } }, { id: 'bare', merged: {} }],
    doors: [{ zone: 'ship-miner', leaves: [{ meshes: [mesh('mb-leg:solid', leg), mesh('mb-leg:glow', glow)] }, { meshes: [mesh('door:solid', shared)] }] }, { zone: 'hangar-miner', leaves: [{ meshes: [mesh('door:solid', shared)] }] }],
    glides: [],
  };
}
const quiet = (fn) => { const w = console.warn, said = []; console.warn = (...a) => said.push(a.join(' ')); try { return [fn(), said]; } finally { console.warn = w; } };

test('laid on a built ship: only its skin\'s corners change, in its own room and its own moving parts; nothing is added', () => {
  const B = fakeBuilt(), L = B.lists, was = Object.fromEntries(Object.entries(L).map(([k, a]) => [k, a.array.slice()]));
  const r = paintBuilt(B, 'miner', 'navy', { zones: ['ship-miner'] });
  assert.deepEqual(r, { corners: 5, lists: 2 }, 'three corners of its room and two of its leg');
  const navy = bytesOf(paintById('navy').c);
  // (its room: the three cream corners are navy, the dark, the yellow and the canister's as they were; the fourth byte full)
  for (const i of [0, 2, 5]) assert.deepEqual([...L.ship.array.slice(i * 4, i * 4 + 4)], [...navy, 255]);
  for (const i of [1, 3, 4, 6]) assert.deepEqual([...L.ship.array.slice(i * 4, i * 4 + 4)], [...was.ship.slice(i * 4, i * 4 + 4)]);
  // (its leg: the two cream corners, as plain numbers)
  for (const i of [1, 2]) lin(paintById('navy').c).forEach((v, k) => assert.ok(Math.abs(L.leg.array[i * 3 + k] - v) < 1e-6));
  assert.deepEqual([...L.leg.array.slice(0, 3)], [...was.leg.slice(0, 3)]);
  assert.ok(L.ship.needsUpdate && L.leg.needsUpdate, 'the changed lists are sent to the graphics card again');
  // (not its hangar's walls, not another ship, not a kind of door another room uses too, not a glow)
  for (const k of ['hangar', 'other', 'shared', 'glow']) { assert.deepEqual([...L[k].array], [...was[k]], k); assert.equal(L[k].needsUpdate, false, k); }
  // (the lists are the same lists, the same length: no corner, list or mesh was made)
  for (const [k, a] of Object.entries(L)) assert.equal(a.array.length, was[k].length, k);
});

test('laid again: one paint over another is the same as on the ship as built; the ship\'s own paint puts every byte back', () => {
  const B = fakeBuilt(), L = B.lists, was = { ship: L.ship.array.slice(), leg: L.leg.array.slice() };
  for (const id of ['navy', 'mustard', 'rust', 'olive']) paintBuilt(B, 'miner', id, { zones: ['ship-miner'] });
  const C = fakeBuilt(); paintBuilt(C, 'miner', 'olive', { zones: ['ship-miner'] });
  assert.deepEqual([...L.ship.array], [...C.lists.ship.array], 'no drift from paint to paint');
  assert.deepEqual([...L.leg.array], [...C.lists.leg.array]);
  // (the same paint again: nothing to do, nothing sent)
  L.ship.needsUpdate = false; paintBuilt(B, 'miner', 'olive', { zones: ['ship-miner'] }); assert.equal(L.ship.needsUpdate, false);
  const r = paintBuilt(B, 'miner', FACTORY, { zones: ['ship-miner'] });
  assert.deepEqual(r, { corners: 5, lists: 2 });
  assert.deepEqual([...L.ship.array], [...was.ship], 'as built, to the byte'); assert.deepEqual([...L.leg.array], [...was.leg]);
  // (a paint this build does not know is the ship's own)
  paintBuilt(B, 'miner', 'navy', { zones: ['ship-miner'] }); paintBuilt(B, 'miner', 'pink', { zones: ['ship-miner'] });
  assert.deepEqual([...L.ship.array], [...was.ship]);
});

test('a ship built alone (the Ships Lab, the Hauler at the dock) is painted whole; a ship with no skin found says so out loud', () => {
  const B = fakeBuilt(), r = paintBuilt(B, 'miner', 'teal');
  // (every room and every moving part of the built is the ship: 3 + 2 of the hangar's + 1 of the other's cream + the leg's 2 + the door's 2)
  assert.deepEqual(r, { corners: 10, lists: 5 });
  const [none, said] = quiet(() => paintBuilt(fakeBuilt(), 'hauler', 'teal', { zones: ['ship-miner'] }));
  assert.deepEqual(none, { corners: 0, lists: 0 }); assert.equal(said.length, 1); assert.match(said[0], /nothing of the hauler's skin/);
  assert.deepEqual(paintBuilt(null, 'miner', 'teal'), { corners: 0, lists: 0 }); assert.deepEqual(paintBuilt(fakeBuilt(), 'gunship', 'teal'), { corners: 0, lists: 0 });
});

test('who may paint: only a ship that is theirs; one that is not is in its own paint for them, whatever their save says', () => {
  const m = maya({ ships: ['miner'] }), l = leo();
  assert.equal(mayPaint(m, 'miner'), true); assert.equal(mayPaint(m, 'medic'), false); assert.equal(mayPaint(l, 'miner'), false);
  assert.equal(mayPaint(null, 'miner'), false); assert.equal(mayPaint(m, 'gunship'), false);
  // (not theirs: nothing changes)
  assert.deepEqual(setPaint(l, 'miner', 'navy'), { ok: false, why: 'notyours' }); assert.equal(l.paints, undefined);
  assert.deepEqual(setPaint(m, 'medic', 'navy'), { ok: false, why: 'notyours' }); assert.equal(m.paints, undefined);
  assert.deepEqual(setPaint(m, 'miner', 'pink'), { ok: false, why: 'unknown' }); assert.deepEqual(setPaint(m, 'gunship', 'navy'), { ok: false, why: 'unknown' });
  assert.deepEqual(setPaint(null, 'miner', 'navy'), { ok: false, why: 'unknown' });
  // (a save that names a paint for a ship that is not theirs: its own paint)
  assert.equal(paintOf(leo({ paints: { miner: 'navy' } }), 'miner'), FACTORY);
  assert.equal(paintOf(null, 'miner'), FACTORY); assert.equal(paintOf(m, 'miner'), FACTORY);
});

test('the save: the paint is kept with the crew member for that ship, each crew member their own, the ship\'s own kept as nothing', () => {
  const m = maya({ ships: ['miner', 'hauler'] }), l = leo({ ships: ['miner'] });
  assert.deepEqual(setPaint(m, 'miner', 'olive'), { ok: true, paint: 'olive' });
  assert.deepEqual(m.paints, { miner: 'olive' }); assert.equal(paintOf(m, 'miner'), 'olive');
  assert.equal(paintOf(m, 'hauler'), FACTORY, 'their other ship is as it was');
  assert.equal(paintOf(l, 'miner'), FACTORY, 'another crew member\'s Miner is not painted by it');
  setPaint(l, 'miner', 'rust'); setPaint(m, 'hauler', 'navy');
  assert.deepEqual(m.paints, { miner: 'olive', hauler: 'navy' }); assert.deepEqual(l.paints, { miner: 'rust' });
  // (kept as the save keeps it: written out and read back)
  const back = JSON.parse(JSON.stringify(m));
  assert.equal(paintOf(back, 'miner'), 'olive'); assert.equal(paintOf(back, 'hauler'), 'navy');
  // (each pick is a new record, so whoever watches for a change sees one: src/shippaint.js)
  const before = m.paints; setPaint(m, 'miner', 'teal'); assert.notEqual(m.paints, before); assert.equal(before.miner, 'olive');
  // (the ship's own paint again: nothing kept for it)
  assert.deepEqual(setPaint(m, 'miner', FACTORY), { ok: true, paint: FACTORY }); assert.deepEqual(m.paints, { hauler: 'navy' }); assert.equal(paintOf(m, 'miner'), FACTORY);
  // (a save kept badly is tidied: ships and paints this build knows, nothing else)
  assert.deepEqual(paintsOf({ paints: { miner: 'pink', medic: 'navy', gunship: 'olive', hauler: 7, explorer: 'factory' } }), { medic: 'navy' });
  assert.deepEqual(paintsOf({ paints: ['navy'] }), {}); assert.deepEqual(paintsOf({}), {}); assert.deepEqual(paintsOf(null), {});
});

test('a paint costs nothing, and buying a ship leaves it in its own paint', () => {
  assert.equal(COST, 0);
  const m = maya({ credits: 61500 });
  assert.equal(buy(m, 'miner').ok, true); assert.equal(paintOf(m, 'miner'), FACTORY);
  setPaint(m, 'miner', 'graphite'); assert.equal(m.credits, 1500, 'no credits spent on paint');
});

test('the swatches on the owner\'s card: one for each paint, the ship\'s own skin first, the one that is on marked', () => {
  const m = maya({ ships: ['medic'], paints: { medic: 'teal' } }), L = swatchesOf(m, 'medic');
  assert.deepEqual(L.map((p) => p.id), PAINTS.map((p) => p.id));
  assert.equal(L[0].c, SKIN.medic.c[0]); assert.deepEqual(L.filter((p) => p.on).map((p) => p.id), ['teal']);
  assert.deepEqual(swatchesOf(maya(), 'medic').filter((p) => p.on).map((p) => p.id), [FACTORY]);
  const H = paintHtml('Medic', L);
  assert.match(H, /Your Medic/); assert.match(H, /Paint: <span class="pmc-paintname">Deep teal<\/span>/);
  assert.equal((H.match(/class="pmc-paint[ "]/g) || []).length, PAINTS.length, 'a swatch for each paint');
  assert.equal((H.match(/class="pmc-paint is-on"/g) || []).length, 1);
  for (const p of L) assert.ok(H.includes(`data-paint="${p.id}"`) && H.includes(`aria-label="${p.name}"`) && H.includes(`--c:${p.c}`), p.id);
  assert.match(H, /pmc-paintdone/); assert.doesNotMatch(H, /credit/i, 'no word of a price');
  assert.match(paintButton(L), /--c:#22605c/); assert.match(paintButton(L), />Paint<\/button>$/);
});

test('where it is: the owner\'s card\'s Paint button and paint card; the game lays each ship\'s paint; the Ships Lab has the same paints', () => {
  const C = read('src/contract.js'), M = read('src/mission.js'), G = read('src/main.js'), S = read('src/shippaint.js'), L = read('labs/ships/main.js'), F = read('src/flying.js'), H = read('src/haulerdock.js');
  assert.match(C, /from '\.\/paintcard\.js'/); assert.match(C, /mode === 'paint'/); assert.match(C, /paintButton\(paint\.list\(\)\)/);
  assert.match(M, /paint: W\.shipPaint \? W\.shipPaint\.card\(ship\) : null/, 'the owner\'s card at the seat is given the ship\'s paint');
  assert.match(G, /W\.shipPaint = GAME\.shipPaint = makeShipPaint\(/); assert.match(G, /shipPaint\.aim\(W\.camera\)/);
  // (a view of every ship while its paint is picked; each parked ship's own room, the Hauler's own builds)
  for (const ship of SHIP_IDS) assert.match(S, new RegExp(`\\n  ${ship}: \\{ eye: `), `${ship}: its view`);
  assert.match(S, /zones: \['ship-' \+ id\]/); assert.match(H, /api\.builds = /);
  assert.match(F, /W\.shipPaint \? W\.shipPaint\.modelColour\(cfg\.id, HOLO\.model\) : HOLO\.model/, 'the landing guide\'s small model');
  // (the lab: the kit's own list and the kit's own way of laying it, for each built ship)
  assert.match(L, /import \{ PAINTS, paintBuilt, tidyPaint, hullColour \} from '\.\.\/\.\.\/kit\/ships\/paints\.js'/);
  assert.match(L, /lab\('Paint'\), \.\.\.PAINTS\.map\(/);
  for (const ship of SHIP_IDS) assert.match(L, new RegExp(`skin: '${ship}'`), `${ship} in the lab`);
  // (the plain parts stay plain: no three.js, no page)
  for (const f of ['kit/ships/paints.js', 'src/paint.js']) assert.doesNotMatch(read(f), /from 'three'|document\.|window\./, f);
});
