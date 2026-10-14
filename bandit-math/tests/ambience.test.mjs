// The town's sounds (src/audio/ambience.js): the parts that need no browser. Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CLIPS, SOURCES, BURST, AMB, HOOVES, TOWN_PATCHES, clipExt, pickClip, crossed, duckOf, airCut, burstPlan } from '../src/audio/ambience.js';

const SOUNDS = new URL('../sounds/', import.meta.url);

test('every clip the game plays is in sounds/ as .ogg and .m4a, with a credit; nothing unplayed is shipped', () => {
  const credits = fs.readFileSync(new URL('CREDITS.md', SOUNDS), 'utf8');
  for (const name of Object.keys(CLIPS)) {
    for (const ext of ['.ogg', '.m4a']) assert.ok(fs.existsSync(new URL(name + ext, SOUNDS)), name + ext);
    const row = credits.split('\n').find((l) => l.startsWith('| `' + name + '`'));
    assert.ok(row, name + ' has a row in sounds/CREDITS.md');
    assert.match(row, /https?:\/\//, name + ': source page');
    assert.match(row, /CC0|[Pp]ublic domain/, name + ': licence');
  }
  const files = fs.readdirSync(SOUNDS).filter((f) => /\.(ogg|m4a)$/.test(f));
  for (const f of files) assert.ok(CLIPS[f.replace(/\.(ogg|m4a)$/, '')], f + ' is played by the game');
});

test("the owner's picks by ear: one moo for every cow, no whine, the pug's woof, the grating bark rare", () => {
  const cows = Object.keys(CLIPS).filter((n) => n.startsWith('cow_'));
  assert.deepEqual(cows.sort(), ['cow_herd_distant', 'cow_moo_1']);
  assert.deepEqual(SOURCES.cows.clips.map(([n]) => n), ['cow_moo_1']);
  assert.ok(!CLIPS.dog_whine, 'no hurt dog');
  assert.deepEqual(SOURCES.pug.first.map(([n]) => n), ['dog_woof']);
  for (const k of ['shiba', 'husky']) {
    assert.ok(!SOURCES[k].first.some(([n]) => n === 'dog_woof'), k + ' is not a small dog');
    const w = Object.fromEntries(SOURCES[k].first);
    assert.ok(w.dog_bark_1 > 5 * (w.dog_bark_rare || 0), k + ': the favourite bark far more often than the grating one');
    assert.deepEqual(SOURCES[k].then.map(([n]) => n), ['dog_bark_1']);
  }
  assert.ok(CLIPS.dog_bark_rare.rare >= 300 && CLIPS.dog_husky_howl.rare >= 180, 'rare ones wait minutes');
  // every clip a source names is a shipped clip
  for (const S of Object.values(SOURCES)) for (const list of [S.clips, S.first, S.then]) for (const [n] of list || []) assert.ok(CLIPS[n], n);
});

test('cows and dogs call in bursts, then stay quiet a good while; each cow its own pitch in 0.8 to 1.15', () => {
  for (const k of ['cows', 'dogs']) assert.ok(BURST[k].quiet[0] >= 30 && BURST[k].quiet[1] >= 90, k + ': tens of seconds to minutes of quiet');
  assert.ok(BURST.cows.rate[0] >= 0.8 && BURST.cows.rate[1] <= 1.15);
  assert.ok(BURST.cows.after[1] < BURST.cows.quiet[0] / 5, 'the answers come within a few seconds');
  let rolls = [0.5, 0.5, 0.5, 0.9], i = 0;
  assert.deepEqual(burstPlan(3, () => rolls[i++]), [{ who: 0 }, { who: 1 }, { who: 2 }, { who: 3 }].slice(0, 4));
  i = 0; rolls = [0.9]; assert.deepEqual(burstPlan(3, () => rolls[i++]), [{ who: 0 }]);
  assert.deepEqual(burstPlan(0, () => 0), [{ who: 0 }], 'nobody to answer: one call');
  let total = 0; for (let k = 0; k < 2000; k++) total += burstPlan(3).length - 1;
  assert.ok(total / 2000 > 0.8 && total / 2000 < 1.8, 'about one answer on average: ' + total / 2000);
});

test('a clip is never the same twice running (unless asked), and a rare one waits', () => {
  const list = [['sheep_baa_1', 1], ['sheep_baa_2', 1], ['sheep_baa_3', 1]];
  let last = null;
  for (let k = 0; k < 200; k++) { const n = pickClip(list, last); assert.notEqual(n, last); last = n; }
  assert.equal(pickClip([['cow_moo_1', 1]], 'cow_moo_1'), 'cow_moo_1', 'the only one may repeat');
  assert.equal(pickClip([['dog_bark_1', 1], ['dog_woof', 1]], 'dog_bark_1', 0, {}, () => 0, true), 'dog_bark_1', 'a burst may repeat a bark');
  // a common clip may follow itself, so the rare ones keep their weighted share (the horse: snort 4, each whinny 1)
  { let l = null; const n = {}; let k = 0; const rand = () => ((k = (k * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 0; i < 6000; i++) { l = pickClip(SOURCES.horses.clips, l, 0, {}, rand); n[l] = (n[l] || 0) + 1; }
    const whinny = ((n.horse_whinny_1 || 0) + (n.horse_whinny_2 || 0)) / 6000;
    assert.ok(whinny > 0.24 && whinny < 0.38, `whinnies ${(whinny * 100).toFixed(1)}% of horse calls (weighted 33%)`); }
  const hawk = [['bird_hawk', 1]];
  assert.equal(pickClip(hawk, null, 100, { bird_hawk: 50 }), null, 'the hawk waits');
  assert.equal(pickClip(hawk, null, 50 + CLIPS.bird_hawk.rare + 1, { bird_hawk: 50 }), 'bird_hawk');
  assert.equal(pickClip([['nope', 1]], null), null);
  assert.equal(pickClip([['dog_bark_rare', 0]], null), null, 'a weight of 0 never plays');
});

test('Ogg where the browser plays it, else .m4a (Safari)', () => {
  assert.equal(clipExt(() => 'probably'), '.ogg');
  assert.equal(clipExt(() => 'maybe'), '.ogg');
  assert.equal(clipExt(() => ''), '.m4a');
  assert.equal(clipExt(null), '.m4a');
  assert.equal(clipExt(() => { throw new Error('x'); }), '.m4a');
});

test('the mix: dips under the music and Hob, quieter indoors; the air dulls far sounds; fewer on potato', () => {
  assert.equal(duckOf({}), 1);
  assert.ok(duckOf({ music: 1 }) < 0.6 && duckOf({ voice: true }) < 0.7 && duckOf({ indoor: true }) < 0.5);
  assert.ok(duckOf({ music: 5 }) === duckOf({ music: 1 }) && duckOf({ music: -1 }) === 1);
  assert.equal(airCut(5), AMB.air.top);
  assert.ok(airCut(50) < airCut(30) && airCut(400) === AMB.air.low);
  assert.ok(AMB.voices.potato < AMB.voices.normal && AMB.slower.potato > 1);
  assert.ok(AMB.level <= 0.6, 'quiet');
});

test('hooves land where the clips put them down; a gallop louder than a walk', () => {
  assert.ok(crossed(0.2, 0.3, 0.24) && !crossed(0.2, 0.3, 0.4) && crossed(0.9, 0.1, 0.96) && crossed(0.9, 0.1, 0.05) && !crossed(-1, 0.5, 0.3));
  for (const k of ['horse', 'horseWhite', 'donkey', 'farmHorse']) for (const c of ['Walk', 'Gallop']) {
    const l = HOOVES[k][c]; assert.equal(l.length, 4, k + c);
    for (let i = 0; i < 4; i++) { assert.ok(l[i] > 0 && l[i] <= 1); if (i) assert.ok(l[i] > l[i - 1]); }
  }
  assert.ok(HOOVES.level.Gallop > HOOVES.level.Walk);
});

test('the made sounds are noise, never ringing tones; the Sound Lab has them too', () => {
  for (const name of ['TOWN — HOOF', 'TOWN — HOOF SPLASH', 'TOWN — GRUNT']) {
    const P = TOWN_PATCHES[name]; assert.ok(P, name);
    assert.ok(!P.nodes.some((n) => n.type === 'osc'), name + ': no oscillator');
    assert.ok(P.nodes.some((n) => n.type === 'noise'), name + ': noise');
  }
  const src = fs.readFileSync(new URL('../src/audio/ambience.js', import.meta.url), 'utf8');
  assert.ok(!/createOscillator\(\)[^;]*;\s*\w+\.type = 'sine'/.test(src), 'no sine oscillator for a hit');
  const lab = new URL('../../../sound-lab/patch.js', import.meta.url);
  if (fs.existsSync(lab)) { const s = fs.readFileSync(lab, 'utf8'); for (const name of Object.keys(TOWN_PATCHES)) assert.ok(s.includes(`'${name}'`), name + ' is in ~/sound-lab'); }
});
