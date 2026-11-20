// The character maker's rules (src/maker.js): which parts a player may wear, what the arrows step to, which pairings
// are stepped past, what is saved with a crew member and how a saved look is made safe. Run against the crew kit's own
// list of parts (assets/crew/crew.json), so a part added to or taken out of the kit is seen here.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROWS, KEPT_BACK, APART, NO_HAIR, wearable, choices, step, goTogether, isMade, keyOf, withPart, withColour, withLook, tidy } from '../src/maker.js';

const KIT = JSON.parse(readFileSync(new URL('../assets/crew/crew.json', import.meta.url), 'utf8')).parts;
const KAI = { suit: 'civilian', head: 't10', hair: 'curlyShort', colours: { skin: '#d9a37f', hair: '#2e1f15' } };      // (the look "kai"'s own recipe)
const worn = (o = {}) => ({ suit: 'civilian', head: 't10', hair: 'curlyShort', ...o });

test('the arrows have three rows: hair, head and body, and the player reads those words', () => {
  assert.deepEqual(ROWS.map((r) => r.word), ['Hair', 'Head', 'Body']);
  assert.deepEqual(ROWS.map((r) => r.part), ['hair', 'head', 'suit']);
  for (const r of ROWS) assert.ok(!/outfit|uniform|suit/i.test(r.word), r.word);
});

test('what a player may wear: every body but the captains\' and Vega\'s, the 13 heads (never Vega\'s helmet), every hair and no hair', () => {
  const suits = wearable(KIT, 'suit'), heads = wearable(KIT, 'head'), hairs = wearable(KIT, 'hair');
  assert.equal(suits.length, KIT.suit.length - 4);
  for (const s of ['vega', 'captainMan', 'captainOld', 'captainWoman']) assert.ok(!suits.includes(s), s);
  assert.equal(heads.length, 13);
  assert.ok(!heads.includes('vega'));
  assert.equal(hairs.length, KIT.hair.length + 1);
  assert.equal(hairs[hairs.length - 1], NO_HAIR);
  // (every part kept back or left apart is a part the kit really has: a name mistyped would leave nothing out)
  for (const [part, ids] of Object.entries(KEPT_BACK)) for (const id of ids) assert.ok(KIT[part].some((p) => p.id === id), `${part} ${id}`);
  for (const [suit, heads2] of Object.entries(APART.suit)) { assert.ok(suits.includes(suit), suit); for (const h of heads2) assert.ok(heads.includes(h), h); }
  for (const [hair, heads2] of Object.entries(APART.hair)) { assert.ok(hairs.includes(hair), hair); for (const h of heads2) assert.ok(heads.includes(h), h); }
});

test('an arrow steps to the next choice or the one before, and a row comes round to where it began', () => {
  for (const part of ['hair', 'head', 'suit']) {
    const all = choices(KIT, part, worn());
    let at = worn()[part];
    const seen = [];
    for (let i = 0; i < all.length; i++) { seen.push(at); const next = step(KIT, part, worn({ [part]: at }), 1); assert.equal(step(KIT, part, worn({ [part]: next }), -1), at, `${part}: back from ${next}`); at = next; }
    assert.equal(at, worn()[part], `${part}: round again`);
    assert.equal(new Set(seen).size, all.length, `${part}: every choice once`);
  }
  // (after the last hair comes no hair, then the first hair again)
  const hairs = wearable(KIT, 'hair');
  assert.equal(step(KIT, 'hair', worn({ hair: hairs[hairs.length - 2] }), 1), null);
  assert.equal(step(KIT, 'hair', worn({ hair: null }), 1), hairs[0]);
});

test('pairings that do not go together are stepped past, whichever part is being changed', () => {
  for (const [suit, heads] of Object.entries(APART.suit)) for (const head of heads) {
    assert.equal(goTogether({ suit, head, hair: null }), false);
    // on that body the head row never offers that head; with that head on, the body row never offers that body
    assert.ok(!choices(KIT, 'head', worn({ suit, head: 't10' })).includes(head), `${head} on ${suit}`);
    assert.ok(!choices(KIT, 'suit', worn({ suit: 'civilian', head })).includes(suit), `${suit} under ${head}`);
    // (but a pairing already worn stays one of its own choices, so the row still starts from it)
    assert.ok(choices(KIT, 'head', worn({ suit, head })).includes(head));
  }
  assert.equal(goTogether(worn()), true);
});

test('what is saved: a part or colour laid over the ready-made look, taken out again when put back', () => {
  let l = { id: 'kai', size: 0.9 };
  assert.equal(isMade(l), false);
  l = withPart(l, 'head', 't3', KAI);
  assert.deepEqual(l, { id: 'kai', size: 0.9, head: 't3' });
  assert.equal(isMade(l), true);
  l = withPart(l, 'hair', null, KAI);
  assert.equal(l.hair, null);
  l = withColour(l, 'eyes', '#3f6b8c', KAI);
  l = withColour(l, 'freckles', 1, KAI);
  assert.deepEqual(l.colours, { eyes: '#3f6b8c', freckles: 1 });
  // (put back as the look has them: gone from the save, and the look is the ready-made one again)
  l = withPart(withPart(l, 'head', 't10', KAI), 'hair', 'curlyShort', KAI);
  l = withColour(withColour(l, 'eyes', null, KAI), 'freckles', 0, KAI);
  assert.deepEqual(l, { id: 'kai', size: 0.9 });
  assert.equal(isMade(l), false);
  // (the look's own colour picked again is not saved as a change)
  assert.equal(isMade(withColour({ id: 'kai' }, 'skin', '#d9a37f', KAI)), false);
  // a ready-made look picked: as it is, the height kept
  assert.deepEqual(withLook({ id: 'kai', size: 1.07, head: 't3', colours: { skin: '#663b22' } }, 'zuri'), { id: 'zuri', size: 1.07 });
  assert.deepEqual(withLook({ id: 'kai' }, 'zuri'), { id: 'zuri' });
});

test('a look\'s pictures go by what is in them: the height is not, every part and colour is', () => {
  assert.equal(keyOf({ id: 'kai' }), 'kai');
  assert.equal(keyOf({ id: 'kai', size: 0.9 }), 'kai');
  const a = { id: 'kai', head: 't3' };
  assert.equal(keyOf(a), keyOf({ ...a, size: 1.07 }));
  const keys = [a, { id: 'kai', hair: null }, { id: 'kai', hair: 'afro' }, { id: 'kai', suit: 'cook' }, { id: 'zuri', head: 't3' },
    { id: 'kai', colours: { skin: '#663b22' } }, { id: 'kai', colours: { hair: '#663b22' } }, { id: 'kai', colours: { eyes: '#3f6b8c' } },
    { id: 'kai', colours: { uniform: '#3f8fe8' } }, { id: 'kai', colours: { freckles: 1 } }].map(keyOf);
  assert.equal(new Set(keys).size, keys.length);
});

test('a saved look is made safe: kept-back parts and colours that are not swatches are dropped, the rest kept', () => {
  const allowed = { hair: ['#17110d'], skin: ['#f2d3bd', '#663b22'], uniform: ['#6e28b2'], eyes: ['#3f6b8c'] };
  assert.deepEqual(tidy({ id: 'kai', size: 0.9 }, allowed), { id: 'kai', size: 0.9 });
  // (a captain's body, Vega's helmet and coat: never a player's)
  assert.deepEqual(tidy({ id: 'kai', suit: 'captainMan', head: 'vega' }, allowed), { id: 'kai' });
  assert.deepEqual(tidy({ id: 'kai', suit: 'vega' }, allowed), { id: 'kai' });
  assert.deepEqual(tidy({ id: 'kai', suit: 'cook', head: 't3', hair: null }, allowed), { id: 'kai', suit: 'cook', head: 't3', hair: null });
  assert.deepEqual(tidy({ id: 'kai', suit: 7, head: '', hair: 3 }, allowed), { id: 'kai' });
  // (no skin lighter than the lightest swatch: white, or any colour not a swatch, is dropped)
  assert.deepEqual(tidy({ id: 'kai', colours: { skin: '#ffffff', hair: '#17110D', eyes: 'blue', uniform: '#6e28b2', freckles: true, more: 1 } }, allowed),
    { id: 'kai', colours: { hair: '#17110d', uniform: '#6e28b2', freckles: 1 } });
  assert.deepEqual(tidy({ id: 'kai', colours: 'red' }, allowed), { id: 'kai' });
  // (what a newer build saved beside the look is kept)
  assert.deepEqual(tidy({ id: 'kai', earned: ['hat'] }, allowed), { id: 'kai', earned: ['hat'] });
});
