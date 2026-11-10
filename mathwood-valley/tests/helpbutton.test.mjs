// The help button (src/helpplan.js, src/levels/model.js skipLevel; the page part is src/ui/helpmenu.js): the "seems
// stuck" rule, the skip's gentle miss on the level, what the form sends with and without a question up, the how-to
// video kept hidden until it has an id, the menu's parts in order, the line about a build, and Work it out's example sum.
import test from 'node:test';
import assert from 'node:assert/strict';

const H = await import('../src/helpplan.js');
const { STUCK, makeStuckWatch, HOWTO, howtoLink, clockText, buildSummary, reportOf, sectionsFor, sumIn, ftIn, LINKS, videoJob } = H;
const M = await import('../src/levels/model.js');
const { LEVELS, PLACE, levelFor, recordLevel, stateOf, setLevelAt, skipLevel, startHere, levelsOf } = M;
const S = await import('../src/save.js');

const T0 = Date.UTC(2026, 10, 10, 15);
const fresh = () => ({ skill: { v: 1, migrated: 1, strands: {} } });
const ids = (place) => PLACE[place].levels.map((L) => L.id);

// ---- seems stuck --------------------------------------------------------------------------------------------------

test('stuck: the table is the one the notes give (3 wrong in a row, 45 s with a question up, 60 s at a builder)', () => {
  assert.deepEqual({ ...STUCK }, { wrongInRow: 3, askedSecs: 45, buildSecs: 60 });
});

test('stuck: three wrong answers in a row on the same kind light it; a right one puts it out', () => {
  const W = makeStuckWatch();
  W.answered('add', false); W.answered('add', false);
  assert.equal(W.on, false, 'two wrong is not yet');
  W.answered('add', false);
  assert.equal(W.on, true); assert.equal(W.why, 'wrong');
  W.answered('add', true);
  assert.equal(W.on, false, 'a right answer puts it out');
  W.answered('add', false); W.answered('add', false);
  assert.equal(W.on, false, 'and the count started again');
});

test('stuck: wrong answers on different kinds of question are not a streak', () => {
  const W = makeStuckWatch();
  W.answered('add', false); W.answered('mul', false); W.answered('add', false); W.answered('mul', false);
  assert.equal(W.on, false);
  W.answered('mul', false); W.answered('mul', false);
  assert.equal(W.on, true, 'three in a row of one kind');
});

test('stuck: about 45 s with a question up and no answer lights it; an answer or the question going starts again', () => {
  const W = makeStuckWatch();
  for (let i = 0; i < 88; i++) W.tick(0.5, { asking: true });
  assert.equal(W.on, false, '44 s is not yet');
  W.tick(0.5, { asking: true }); W.tick(0.5, { asking: true });
  assert.equal(W.on, true); assert.equal(W.why, 'waiting');
  W.tick(0.5, { asking: false });
  assert.equal(W.on, false, 'no question up any more (the rider left the job): out');
  for (let i = 0; i < 80; i++) W.tick(0.5, { asking: true });
  W.answered('add', false);   // (a wrong answer is still an answer: the waiting count starts again)
  for (let i = 0; i < 80; i++) W.tick(0.5, { asking: true });
  assert.equal(W.on, false, '40 s after the last answer');
});

test('stuck: about 60 s at a builder with nothing built lights it; building something puts it out', () => {
  const W = makeStuckWatch();
  for (let i = 0; i < 119; i++) W.tick(0.5, { building: true, progress: '0|6|6' });
  assert.equal(W.on, false, '59.5 s is not yet');
  W.tick(0.5, { building: true, progress: '0|6|6' });
  assert.equal(W.on, true); assert.equal(W.why, 'build');
  W.tick(0.5, { building: true, progress: '1|6|6' });
  assert.equal(W.on, false, 'a board nailed: out');
  for (let i = 0; i < 100; i++) W.tick(0.5, { building: true, progress: i % 2 ? '2|6|6' : '1|6|6' });
  assert.equal(W.on, false, 'still building: never lit');
});

test('stuck: opening the help menu puts it out and starts every count again', () => {
  const W = makeStuckWatch();
  for (let k = 0; k < 3; k++) W.answered('sub', false);
  assert.equal(W.on, true);
  W.opened();
  assert.equal(W.on, false);
  W.answered('sub', false); W.answered('sub', false);
  assert.equal(W.on, false, 'the streak started again from the opening');
  for (let i = 0; i < 89; i++) W.tick(0.5, { asking: true });
  assert.equal(W.on, false);
});

// ---- the skip: a gentle miss --------------------------------------------------------------------------------------

test('skip: half a miss off the bar, never recorded as an answer, and the next question one level down, once', () => {
  const r = fresh(), L = ids('roundup');
  setLevelAt(r, 'roundup', L[6], { placed: true, into: 3, now: T0 });
  const before = JSON.parse(JSON.stringify(stateOf(r, 'roundup')));
  const out = skipLevel(r, 'roundup', { now: T0 });
  const s = stateOf(r, 'roundup');
  assert.equal(s.id, L[6], 'the same level');
  assert.equal(s.into, 3 - LEVELS.SKIP_DOWN, 'two off the bar (a miss takes four)');
  assert.equal(LEVELS.SKIP_DOWN * 2, LEVELS.DOWN, 'half a miss');
  assert.deepEqual([s.n, s.r, s.h], [before.n, before.r, before.h], 'no answer recorded: the counts and the history are untouched');
  assert.equal(out.ease, true);
  const q = levelFor(r, 'roundup', { now: T0 });
  assert.equal(q.id, L[5], 'the next question: the level below');
  assert.equal(q.eased, true);
  assert.equal(levelFor(r, 'roundup', { now: T0 }).id, L[5], 'until an answer is recorded');
  // a right answer down there doesn't move the rider up, and the easier question is over
  recordLevel(r, 'roundup', { right: true, level: q.id, now: T0 });
  assert.equal(stateOf(r, 'roundup').id, L[6]);
  assert.equal(stateOf(r, 'roundup').into, 1);
  const q2 = levelFor(r, 'roundup', { now: T0 });
  assert.equal(q2.id, L[6], 'then back to their own level');
  assert.equal(q2.eased, false);
});

test('skip: with the bar nearly empty it goes back a level, near the end of the one before (as a miss would)', () => {
  const r = fresh(), L = ids('roundup');
  setLevelAt(r, 'roundup', L[6], { placed: true, into: 1, now: T0 });
  const out = skipLevel(r, 'roundup', { now: T0 });
  const s = stateOf(r, 'roundup'), count = PLACE.roundup.levels[5].count || LEVELS.COUNT;
  assert.equal(s.id, L[5]); assert.equal(out.moved, -1);
  assert.equal(s.into, count - 1, 'one short of the end: one right answer and they are back');
  assert.equal(levelFor(r, 'roundup', { now: T0 }).id, L[4], 'and the next question is easier again (the level below that)');
});

test('skip: on the lowest level there is nothing easier: the bar stays at 0 and a fresh question comes at that level', () => {
  const r = fresh(), L = ids('sheep');
  setLevelAt(r, 'sheep', L[0], { placed: true, into: 1, now: T0 });
  skipLevel(r, 'sheep', { now: T0 });
  assert.equal(stateOf(r, 'sheep').id, L[0]);
  assert.equal(stateOf(r, 'sheep').into, 0);
  const q = levelFor(r, 'sheep', { now: T0 });
  assert.equal(q.id, L[0]); assert.equal(q.eased, false);
});

test('skip while the level is still being found: the climb settles on the highest level answered right, or steps down', () => {
  const r = fresh(), L = ids('lockbox');
  levelFor(r, 'lockbox', { now: T0 });
  for (let k = 0; k < 3; k++) { const q = levelFor(r, 'lockbox', { now: T0 }); recordLevel(r, 'lockbox', { right: true, level: q.id, now: T0 }); }
  assert.equal(stateOf(r, 'lockbox').id, L[3]);
  skipLevel(r, 'lockbox', { now: T0 });
  assert.equal(stateOf(r, 'lockbox').placed, true, 'placed');
  assert.equal(stateOf(r, 'lockbox').id, L[2], 'on the highest level answered right: easier than the one skipped');
  // a rider who skips the very first question: a level down (when there is one), still finding the level
  const r2 = fresh();
  setLevelAt(r2, 'roundup', ids('roundup')[4], { placed: false, now: T0 });
  skipLevel(r2, 'roundup', { now: T0 });
  assert.equal(stateOf(r2, 'roundup').id, ids('roundup')[3]);
  assert.equal(stateOf(r2, 'roundup').placed, false);
  assert.equal(stateOf(r2, 'roundup').base.phase, 'down');
});

test('skip: never a penalty a child can see: no gold, no accuracy, no stats, no answer counted', () => {
  const r = S.fixRider({ name: 'Wren', gold: 40 });
  setLevelAt(r, 'roundup', ids('roundup')[6], { placed: true, into: 3, now: T0 });
  const stats = JSON.stringify(r.stats), gold = r.gold, acc = S.accuracyOf(r);
  skipLevel(r, 'roundup', { now: T0 });
  assert.equal(JSON.stringify(r.stats), stats);
  assert.equal(r.gold, gold);
  assert.deepEqual(S.accuracyOf(r), acc);
  assert.equal(stateOf(r, 'roundup').n, 0);
  assert.equal(stateOf(r, 'roundup').k, 1, 'only a quiet count of skips is kept');
});

test('skip: a level picked by hand ends the easier question; a save that never skipped stays exactly as it was', () => {
  const r = fresh(), L = ids('roundup');
  setLevelAt(r, 'roundup', L[6], { placed: true, into: 3, now: T0 });
  skipLevel(r, 'roundup', { now: T0 });
  startHere(r, 'roundup', L[8], { now: T0 });
  assert.equal(levelFor(r, 'roundup', { now: T0 }).id, L[8]);
  const old = fresh();
  setLevelAt(old, 'sheep', ids('sheep')[2], { placed: true, now: T0 });
  const was = JSON.stringify(old.levels);
  levelsOf(old);
  assert.equal(JSON.stringify(old.levels), was, 'no new fields on a place that never skipped');
  assert.equal('ease' in stateOf(old, 'sheep'), false);
});

// ---- the form ---------------------------------------------------------------------------------------------------

test('the form with a question up sends what the old "Confusing?" chip sent, and the note', () => {
  const q = { job: 'sheep', strand: 'add', pct: 31.5, step: null, text: '27 + 6 = 23', choices: ['should be 33', 'should be 43'], picked: ['should be 43'],
    right: 'should be 33', hint: null, place: 'the farm', tier: 'normal' };
  const d = reportOf({ q, job: 'sheep', note: '  the tens confused me  ' });
  for (const k of Object.keys(q)) assert.deepEqual(d[k], q[k], `${k} as the chip sent it`);
  assert.equal(d.note, 'the tens confused me');
  assert.equal(d.via, 'help');
  assert.equal(reportOf({ q, note: '' }).note, null, 'an empty box still sends the mark, with no note');
  assert.equal(reportOf({ q, note: 'x'.repeat(400) }).note.length, 300, 'a note is kept to 300 letters, as before');
});

test('the form with no question up (the windmill): the job, a line about the build and its numbers', () => {
  const build = { boards: 14, height: 9.5, W: 4, D: 4, full: 12, best: 6, mins: 12 };
  const summary = buildSummary('windmill', build);
  const d = reportOf({ job: 'windmill', summary, build, note: 'how do I brace it', place: 'the mill hill', tier: 'gaming' });
  assert.equal(d.job, 'windmill');
  assert.equal(d.text, summary);
  assert.deepEqual(d.build, build);
  assert.deepEqual([d.strand, d.choices, d.right], [null, null, null]);
  assert.deepEqual([d.place, d.tier, d.note, d.via], ['the mill hill', 'gaming', 'how do I brace it', 'help']);
  assert.ok(JSON.stringify(d).length < 2000, 'small enough for one post');
});

test('a build in words: pieces, how tall and how far along, how long at it', () => {
  assert.equal(buildSummary('windmill', { boards: 14, height: 9.5, W: 4, D: 4, full: 12, best: 6, mins: 12 }),
    'The windmill: 14 boards up, 9 ft 6 in tall on a 4 × 4 ft base; 53% of the way to 18 ft; best stood in the wind: 6 ft; 12 full boards left; about 12 minutes at it this time.');
  assert.equal(buildSummary('windmill', { boards: 0, W: 6, D: 6, full: 28 }), 'The windmill: no boards up yet, the stones set 6 × 6 ft; 28 full boards left.');
  assert.equal(buildSummary('windmill', { boards: 40, height: 18, W: 4, D: 4 }), 'The windmill: 40 boards up, 18 ft tall on a 4 × 4 ft base; tall enough to finish it (18 ft).');
  assert.equal(buildSummary('bridge', { boards: 22, deck: true, planks: 16, carries: 'horse and rider', next: 'covered wagon', mins: 1 }),
    'The bridge: 22 boards up; the deck laid (16 planks); it has carried a horse and rider; next: a covered wagon; about a minute at it this time.');
  assert.equal(buildSummary('bridge', { boards: 6, deck: false }), 'The bridge: 6 boards up; no deck yet; not tested with a load yet.');
  assert.equal(ftIn(6.9167), '6 ft 11 in');
});

// ---- the video ------------------------------------------------------------------------------------------------------

test('the video is hidden until it has an id: no link, and the menu has no video part', () => {
  assert.equal(HOWTO.id, '', 'no video uploaded yet');
  for (const job of Object.keys(HOWTO.at)) { assert.equal(howtoLink(job), null); assert.equal(HOWTO.at[job], null, `${job}: its time is empty until the edit`); }
  assert.ok(!sectionsFor({ video: howtoLink('windmill') }).some((s) => s.id === 'video'));
  assert.ok(sectionsFor({ video: 'https://youtu.be/PLACEHOLDER?t=795' }).some((s) => s.id === 'video'));
});

test('the video link: one video, the job\'s start time in the address, or its start when the job has no time yet', () => {
  const how = { id: 'PLACEHOLDER', at: { windmill: 795, store: 460, roundup: null } };
  assert.equal(howtoLink('windmill', how), 'https://youtu.be/PLACEHOLDER?t=795');
  assert.equal(howtoLink('roundup', how), 'https://youtu.be/PLACEHOLDER');
  assert.equal(howtoLink('sell', how), 'https://youtu.be/PLACEHOLDER?t=460', 'selling goods is the store\'s chapter');
  assert.equal(videoJob('build'), null);
  assert.equal(howtoLink('windmill', { id: 'not an id!', at: { windmill: 5 } }), null, 'only a real video id makes a link');
  assert.equal(clockText(795), '13:15'); assert.equal(clockText(5), '0:05'); assert.equal(clockText(3725), '1:02:05');
});

// ---- the menu's parts -------------------------------------------------------------------------------------------------

test('the menu: Hob first and open; the example and the form fold, shut; skip only with a question; no External Links yet', () => {
  assert.deepEqual(sectionsFor({ example: true, skip: true, video: 'x' }).map((s) => s.id), ['hob', 'example', 'skip', 'report', 'video']);
  const parts = sectionsFor({ example: true, skip: true });
  assert.equal(parts.find((s) => s.id === 'hob').open, true);
  for (const id of ['example', 'report']) { const s = parts.find((x) => x.id === id); assert.equal(s.fold, true); assert.equal(s.open, false); }
  assert.deepEqual(sectionsFor({}).map((s) => s.id), ['hob', 'report'], 'no question, no example: Hob and the form');
  assert.deepEqual(LINKS, [], 'External Links: none yet (held off)');
  assert.deepEqual(sectionsFor({ links: [{ name: 'a', url: 'https://example.com' }] }).map((s) => s.id).pop(), 'links', 'a clean place for them later, last');
});

test('an example\'s sum for Work it out: a plain sum in its words, else nothing', () => {
  assert.deepEqual(sumIn('27 + 6 = 23'), { op: 'add', a: 27, b: 6 });
  assert.deepEqual(sumIn('918 − 442 = 576'), { op: 'sub', a: 918, b: 442 });
  assert.deepEqual(sumIn('What is 3,420 ÷ 6?'), { op: 'div', a: 3420, b: 6 });
  assert.deepEqual(sumIn('2.6 × 6'), { op: 'mul', a: 2.6, b: 6 });
  assert.equal(sumIn('6, 8, ?, 12'), null);
  assert.equal(sumIn('x + 7 = 12'), null);
  assert.equal(sumIn('5 − 9'), null, 'Work it out takes the bigger number first');
});
