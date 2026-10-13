// Hats, more horses and Old Hob's voice: the parts that need no browser. Run with: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HATS, hatOf, hatColour, hatSVG, hatIcon } from '../src/hats.js';
import { fixRider, newRider } from '../src/save.js';
import { babble, VOICE } from '../src/audio/voice.js';
import { PATCH_PRESETS } from '../src/audio/patch.js';

const source = (path) => fs.readFileSync(new URL(path, import.meta.url)).toString();

test('every hat but the old one has a price at the general store, and a picture', () => {
  const prices = source('../src/shop.js').match(/hat: \{([^}]+)\}/)[1];
  assert.equal(HATS[0].id, 'cowboy', 'the old cowboy hat comes first (free)');
  assert.ok(HATS.length >= 5 && HATS.length <= 8, 'four to six hats to buy, and the old one');
  const costs = [];
  for (const h of HATS.slice(1)) {
    const m = prices.match(new RegExp(`\\b${h.id}: (\\d+)`)); assert.ok(m, `a price for the ${h.id}`); costs.push(+m[1]);
    assert.match(h.colour, /^#[0-9a-f]{6}$/i, `${h.id} has its own colour`);
  }
  assert.deepEqual(costs, [...costs].sort((a, b) => a - b), 'a ladder of prices, cheapest first');
  for (const h of HATS) { assert.match(hatSVG(h.id, '#5b4630'), /<path /); assert.match(hatIcon(h.id), /^<svg /); }
});

test('an old save (no hat style) wears the cowboy hat; a new one keeps the hat it bought', () => {
  const old = fixRider({ name: 'Old', look: { outfit: 'farmer_m', palette: 'drifter' }, owned: { saddle: 'plain', horse: 'white' } });
  assert.equal(hatOf(old.look), 'cowboy');
  assert.equal(old.owned.horse, 'white', 'the white horse from before still rides');
  assert.equal(hatColour(old.look, '#123456'), '#123456', 'the cowboy hat keeps the outfit\'s colour');
  const r = newRider('New', { outfit: 'farmer_m', palette: 'drifter' });
  r.look = { ...r.look, hatStyle: 'bowler' }; r.owned.hats = ['bowler', 'straw']; r.owned.horse = 'donkey'; r.owned.horses = ['bay', 'donkey'];
  const back = fixRider(JSON.parse(JSON.stringify(r)));
  assert.equal(back.look.hatStyle, 'bowler'); assert.deepEqual(back.owned.hats, ['bowler', 'straw']);
  assert.equal(back.owned.horse, 'donkey'); assert.deepEqual(back.owned.horses, ['bay', 'donkey']);
  assert.equal(hatOf(back.look), 'bowler'); assert.equal(hatColour(back.look), HATS.find((h) => h.id === 'bowler').colour);
  assert.equal(hatOf({ ...back.look, hat: false }), null, 'the hat switched off on the title: no hat');
  assert.equal(hatOf({ hatStyle: 'top-hat' }), 'cowboy', 'a hat this build doesn\'t know: the cowboy hat');
});

test("Hob's babble: short, the same each time for a line, a question lifts at the end", () => {
  const line = "Mornin'! Rancher next door needs a hand with his herd. Follow the hoofprints out to the pasture.";
  const a = babble(line), b = babble(line);
  assert.deepEqual(a, b, 'the same line babbles the same way');
  assert.ok(a.length >= 8 && a.length <= VOICE.most, `${a.length} syllables`);
  assert.ok(a[a.length - 1].at < 3, 'about two seconds at most');
  for (let i = 1; i < a.length; i++) assert.ok(a[i].at > a[i - 1].at, 'one after another');
  assert.ok(a.every((s) => Math.abs(s.semi) < 6), 'the pitch stays near his own');
  const q = babble('Where did that steer get to?'), s = babble('Where did that steer get to.');
  assert.ok(q[q.length - 1].semi > s[s.length - 1].semi + 3, 'a question lifts');
  assert.deepEqual(babble(''), []); assert.deepEqual(babble('...'), []);
  assert.equal(babble('Hi').length, 1);
});

test("Hob's voice patch is in the game's engine and the Sound Lab's, the same", () => {
  const p = PATCH_PRESETS[VOICE.patch];
  assert.ok(p, VOICE.patch);
  for (const id of ['buzz', 'f1', 'f2', 'amp', 'out']) assert.ok(p.nodes.some((n) => n.id === id), id + ' (the game sets it per syllable)');
  assert.ok(p.nodes.find((n) => n.id === 'amp').sustain === 0, 'a one-shot: each syllable ends itself');
  const lab = new URL('../../../sound-lab/patch.js', import.meta.url);
  if (fs.existsSync(lab)) assert.ok(fs.readFileSync(lab).toString().includes("'VOICE — OLD HOB'"), 'the patch is in ~/sound-lab too');
  assert.ok(VOICE.level <= 0.4, 'quiet');
});
