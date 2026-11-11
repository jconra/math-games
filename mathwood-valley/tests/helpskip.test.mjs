// Skip everywhere (the help menu's "Skip to a new question"): the game's maker asked why it didn't work on the wagon's
// gang, the loot's share-out slip, selling goods and a builder's card after a wrong answer. Each job now deals a fresh
// question when skipped; when one can't just then, the menu says why in one plain, kind line (src/helpplan.js SKIP_WHY).
// The jobs need three.js and a page, so their hooks are read as text here (as tests/wagonjob.test.mjs does); what they
// do in the game is checked by ~/pw/bandit-math/rigs/help/jobs.cjs at 1280 and 400.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SKIP_WHY, SKIP_LINE, skipWhy, skipLine } from '../src/helpplan.js';

const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
// the body of a function or a handle's arrow function, up to its closing line
const body = (src, start, end = '\n  };') => { const a = src.indexOf(start); assert.ok(a >= 0, `${start} is there`); return src.slice(a, src.indexOf(end, a)); };
const main = read('src/main.js');
const skips = main.slice(main.indexOf('const SKIPS = {'), main.indexOf('const SKIP_NO_LEVEL'));

test('every job with questions has a skip in main.js', () => {
  for (const job of ['roundup', 'sheep', 'pigs', 'store', 'delivery', 'graphs', 'range', 'deer', 'wagon', 'loot', 'sell', 'windmill', 'bridge', 'fishing', 'boxes'])
    assert.match(skips, new RegExp(`\\b${job}:`), `${job} has a skip`);
  assert.match(skips, /wagon: \(\) => WJ && WJ\.skip\(\)/);
  assert.match(skips, /loot: \(\) => LJ && LJ\.skip\(\)/);
  assert.match(skips, /sell: \(\) => GD && GD\.skip\(\)/);
  assert.match(skips, /delivery: \(\) => DL && DL\.skip\(\)/);
});

test('the wagon\'s gang: the gang rides off and a fresh one for the same wave rides in, at the level now', () => {
  const src = read('src/missions/wagonjob.js');
  const g = body(src, 'WJ.skip = () => {');
  assert.match(g, /state !== 'on' \|\| grab/, 'not between waves, nor once the box is grabbed');
  assert.ok(g.indexOf('waveN--') >= 0 && g.indexOf('waveN--') < g.indexOf('newWave()'), 'the same wave number, dealt afresh');
  assert.match(src, /WJ\.skip = \(\) => !!\(A && A\.G\.skip && A\.G\.skip\(\)\)/, 'the job hands it to the hold-up under way');
  // a new gang asks the level now (the skip's easier one) and the bandits already roped still count
  const nw = body(src, 'function newWave() {', '\n  }\n');
  assert.ok(nw.includes("levelFor(rider, 'wagon')") && nw.includes('bankCaught(wave)'));
});

test('the loot\'s share-out slip: the bundle on the slip dealt again at the level now, from the folks waiting', () => {
  const g = body(read('src/missions/loot.js'), 'LJ.skip = () => {');
  assert.match(g, /U\.busy/, 'not while the coins fly');
  assert.match(g, /dealAt\(levelFor\(rider, 'loot'\), \{ among: trip\.families\.map\(\(f\) => f\.name\), only: true \}\)/);
  assert.match(g, /trip\.problems\[trip\.at\] = p;\s*showProblem\(\)/);
  assert.ok(!/picked|missed/.test(g), 'a wrong coin already tried doesn\'t hold it back');
});

test('selling goods: Ezra offers a different deal, and the sale on the slip stays if he has none', () => {
  const g = body(read('src/missions/sellgoods.js'), 'G.skip = () => {');
  assert.match(g, /const was = order;\s*if \(next\(\)\) return true;\s*order = was;/);
  assert.ok(main.includes("const SKIP_NO_LEVEL = new Set(['sell'])"), 'a sale never moves the store\'s level, so skipping one doesn\'t');
});

test('the deliveries: a new order for the same camp from its first step, even with a step answered', () => {
  const g = body(read('src/missions/delivery.js'), 'DL.skip = () => {');
  assert.ok(!/picked/.test(g), 'a step already answered doesn\'t hold it back');
  assert.match(g, /makeOrder\(camp\)[\s\S]*showPart\(\)/);
});

test('a builder\'s card after a wrong answer is dealt again (the windmill\'s and the bridge\'s, lab and game alike)', () => {
  for (const f of ['labs/windmill/builder.js', 'labs/bridge/builder.js']) {
    const g = body(read(f), 'const relevel = () => {', '\n};');
    assert.ok(!g.includes('!w || !w.hidden'), `${f}: an answered card isn't refused outright`);
    assert.match(g, /if \(!w\.hidden && !c\.querySelector\('\.choices \.is-wrong'\)\) return false;/, `${f}: only one answered RIGHT stays`);
  }
  // the menu offers no skip on a card answered right (it is done), and the "why" up after a wrong one still counts as a question
  assert.match(main, /const siteDone = \(\) =>/);
  assert.match(main, /const cardDone = !!\(BS && BS\.active\) && siteDone\(\);/);
  assert.match(main, /skip: up && !cardDone && SKIPS\[job\]/);
});

test('when a job can\'t swap just then, the menu says why in one plain, kind line; and what a skip does there', () => {
  for (const job of ['wagon', 'loot', 'sell', 'windmill', 'bridge', 'fishing', 'store', 'delivery', 'boxes', 'range', 'deer'])
    assert.ok(SKIP_WHY[job], `${job} has its own line`);
  for (const [job, line] of Object.entries(SKIP_WHY)) {
    assert.match(line, /^[A-Z][^]*[.]$/, `${job}: a sentence`);
    assert.ok(line.length <= 140, `${job}: short (${line.length})`);
    assert.ok(!/error|fail|invalid|cannot/i.test(line), `${job}: plain words`);
  }
  assert.equal(skipWhy('nobody'), SKIP_WHY.default);
  assert.equal(skipLine('sell'), SKIP_LINE.sell);
  assert.equal(skipLine('roundup'), SKIP_LINE.default);
  assert.match(SKIP_LINE.wagon, /still count/);
  // main.js hands the line back when a job's hook says no, and the menu shows it in place of skipping
  assert.ok((main.match(/return skipWhy\(job\)/g) || []).length >= 4);
  const menu = read('src/ui/helpmenu.js');
  assert.match(menu, /typeof r === 'string' \? r :/);
});
