// The character maker's rules (src/maker.js): which parts a player may wear, what the arrows step to, which pairings
// are stepped past, what is saved with a crew member and how a saved look is made safe. Run against the crew kit's own
// list of parts (assets/crew/crew.json), so a part added to or taken out of the kit is seen here.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROWS, KEPT_BACK, APART, NO_HAIR, SKIN_RANGE, BRINGS, brings, wearable, choices, step, goTogether, isMade, keyOf, withPart, withColour, withLook, tidy, skinInRange } from '../src/maker.js';

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

test('a body that brings its own head (an android\'s) wears no hair: the head and hair arrows have nothing to step to while it is worn, and the body arrows go on', () => {
  assert.deepEqual(brings('vega'), { head: 'vega', hair: null });
  assert.equal(brings('civilian'), null); assert.equal(brings(undefined), null); assert.equal(brings('toString'), null);
  // (what it brings is a head the kit has, and one that goes with that body alone)
  for (const [suit, own] of Object.entries(BRINGS)) { assert.ok(KIT.suit.some((p) => p.id === suit), suit); const h = KIT.head.find((p) => p.id === own.head); assert.ok(h, own.head); assert.equal(h.with, suit); }
  const w = { suit: 'vega', head: 't7', hair: 'ponytail' };      // (the head and hair the player had are kept under it)
  assert.deepEqual(choices(KIT, 'head', w), []); assert.deepEqual(choices(KIT, 'hair', w), []);
  assert.equal(step(KIT, 'head', w, 1), 't7'); assert.equal(step(KIT, 'hair', w, -1), 'ponytail');
  const next = step(KIT, 'suit', w, 1);
  assert.notEqual(next, 'vega'); assert.ok(wearable(KIT, 'suit').includes(next));
  // (Captain Vega's own body is his alone: no arrow steps to it)
  for (const from of wearable(KIT, 'suit')) for (const dir of [1, -1]) assert.notEqual(step(KIT, 'suit', { suit: from, head: 't7', hair: 'ponytail' }, dir), 'vega');
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

// how light a colour is, and how much colour it has (0..1 each), as skinInRange measures them
function lightAndColour(hex) {
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255], max = Math.max(...c), min = Math.min(...c), l = (max + min) / 2;
  return [l, max - min < 1e-9 ? 0 : (max - min) / (1 - Math.abs(2 * l - 1))];
}
const SKINS = ['#f2d3bd', '#e8bf9f', '#d9a37f', '#c48a62', '#a66d45', '#86522f', '#663b22', '#47291a'];      // (the crew kit's SKIN_TONES, the title's swatches)

test('a skin colour picked with the + is never white or near white: brought inside the range, not refused', () => {
  // (every swatch is inside the range already, and comes back as it is)
  for (const c of SKINS) assert.equal(skinInRange(c), c, c);
  // white, near white and pale greys: no lighter than the lightest swatch, and with real colour in them
  for (const c of ['#ffffff', '#fefefe', '#f8f8f0', '#f0f4ff', '#fff5f5', '#e6e6e6', '#d0d0d0', '#ffe0e0', '#e0ffe0']) {
    const got = skinInRange(c), [l, col] = lightAndColour(got);
    assert.match(got, /^#[0-9a-f]{6}$/, c);
    assert.ok(l <= SKIN_RANGE.lightest + 0.005, `${c} > ${got}: lightness ${l.toFixed(3)}`);
    assert.ok(l < 0.8 || col >= 0.45, `${c} > ${got}: as light as that, it has colour (${col.toFixed(2)})`);
    const n = parseInt(got.slice(1), 16);
    assert.ok(Math.min(n >> 16, (n >> 8) & 255, n & 255) < 0xd0, `${c} > ${got}: not near white`);
  }
  // (a white takes the swatches' own warm hue: it comes out close to the lightest swatch)
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(skinInRange('#ffffff').slice(i, i + 2), 16));
  assert.ok(r > g && g > b && Math.abs(r - 0xf2) < 12 && Math.abs(g - 0xd3) < 12 && Math.abs(b - 0xbd) < 12, skinInRange('#ffffff'));
  // any hue is the player's to pick, and a colour that is not light is not touched
  for (const c of ['#3f8fe8', '#00ff00', '#6e28b2', '#808080', '#000000', '#a83c22']) assert.equal(skinInRange(c), c, c);
  assert.equal(skinInRange('#D9A37F'), '#d9a37f');
  assert.equal(skinInRange('white'), null);
});

test('a saved look is made safe: kept-back parts and colours that are no colour are dropped, a skin is never near white, the rest kept', () => {
  assert.deepEqual(tidy({ id: 'kai', size: 0.9 }), { id: 'kai', size: 0.9 });
  // (a captain's body, Vega's helmet and coat: never a player's)
  assert.deepEqual(tidy({ id: 'kai', suit: 'captainMan', head: 'vega' }), { id: 'kai' });
  assert.deepEqual(tidy({ id: 'kai', suit: 'vega' }), { id: 'kai' });
  assert.deepEqual(tidy({ id: 'kai', suit: 'cook', head: 't3', hair: null }), { id: 'kai', suit: 'cook', head: 't3', hair: null });
  assert.deepEqual(tidy({ id: 'kai', suit: 7, head: '', hair: 3 }), { id: 'kai' });
  // (any colour picked with a row's + is kept as it is, but for a skin: a white one is brought inside the range)
  assert.deepEqual(tidy({ id: 'kai', colours: { skin: '#ffffff', hair: '#2F6FD0', eyes: 'blue', uniform: '#12ab34', freckles: true, more: 1 } }),
    { id: 'kai', colours: { hair: '#2f6fd0', skin: skinInRange('#ffffff'), uniform: '#12ab34', freckles: 1 } });
  assert.notEqual(tidy({ id: 'kai', colours: { skin: '#ffffff' } }).colours.skin, '#ffffff');
  assert.deepEqual(tidy({ id: 'kai', colours: { skin: '#663b22' } }), { id: 'kai', colours: { skin: '#663b22' } });
  assert.deepEqual(tidy({ id: 'kai', colours: 'red' }), { id: 'kai' });
  // (what a newer build saved beside the look is kept)
  assert.deepEqual(tidy({ id: 'kai', earned: ['hat'] }), { id: 'kai', earned: ['hat'] });
});
