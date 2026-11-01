// The props library's catalog: every prop whole, the names fixed, recipes kept honest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, PROPS, PROP_LIST, ALIASES, PICTURES, resolveKind, normaliseRecipe, propsIn } from '../world/props/catalog.js';

const IDS = ['roundTable', 'spindleChair', 'barStool', 'pianoStool', 'piano', 'bench', 'framedPicture', 'bed', 'washstand', 'ragRug', 'boots', 'barrel', 'keg', 'crate', 'bucket', 'pail', 'sack', 'coalBucket', 'washtub', 'milkCan', 'woolSack', 'eggCrate', 'shovel', 'broom', 'hangingLantern', 'trough', 'hitchrail', 'bale', 'plank', 'woodpile', 'signpost'];
test('every prop has its name, category, floor, rank and budget, and defaults in their ranges', () => {
  for (const p of PROP_LIST) {
    assert.ok(p.name && CATEGORIES.includes(p.cat), p.kind);
    assert.ok(p.foot.length === 2 && p.h > 0 && p.tris > 0, p.kind);
    assert.ok(p.rank >= 0 && p.rank <= 3, p.kind);
    for (const f of p.fields) {
      if (f.options) assert.ok(f.options.includes(f.def), p.kind + f.key);
      else if (!f.check) assert.ok(f.def >= f.min && f.def <= f.max, p.kind + f.key);
    }
  }
});
test('kinds are unique and do not change by accident (a save names them)', () => {
  assert.deepEqual(PROP_LIST.map((p) => p.kind).sort(), [...IDS].sort());
  assert.equal(Object.keys(PROPS).length, PROP_LIST.length);
});
test('aliases resolve; an unknown kind does not', () => {
  for (const a of Object.keys(ALIASES)) assert.ok(resolveKind(a), a);
  assert.equal(resolveKind('nope'), null);
  assert.equal(normaliseRecipe('nope', {}), null);
});
test('a recipe is clamped, checked, and keeps only what differs', () => {
  assert.deepEqual(normaliseRecipe('roundTable', { r: 9, junk: 1 }), { kind: 'roundTable', r: 0.7 });
  assert.deepEqual(normaliseRecipe('roundTable', { r: 0.46 }), { kind: 'roundTable' });
  assert.deepEqual(normaliseRecipe('framedPicture', { pic: 'nobody' }), { kind: 'framedPicture' });
  assert.deepEqual(normaliseRecipe('framedPicture', { pic: 'lake' }), { kind: 'framedPicture', pic: 'lake' });
  assert.deepEqual(normaliseRecipe('hitchingPost', { seed: 7 }), { kind: 'hitchrail', seed: 7 });
});
test('every category that is a tab has props; pictures are named', () => {
  for (const c of CATEGORIES) assert.ok(propsIn(c).length, c);
  assert.equal(new Set(PICTURES).size, 12);
});
