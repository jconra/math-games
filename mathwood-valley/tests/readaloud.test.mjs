// Tests for read-aloud (src/audio/readaloud.js): every line the Counting, Adding and Taking away cards can say is put
// together from the recorded clips with nothing missing, every number 0 to 109 can be said, every clip the lines use is
// shipped in sounds/read/ (.ogg and .m4a), and the reactions keep to their rules.
// Run with:  node --test mathwood-valley/tests/readaloud.test.mjs
// Every random choice is seeded; SEED_OFFSET=1000 runs it on another seed set.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { READ, READ_CLIPS, READ_EDGES, PHRASES, numberParts, compose, timeline, clipEdge, makeReactions, makeReadAloud } from '../src/audio/readaloud.js';
import * as E from '../src/math/early.js';
import * as Cn from '../src/math/counting.js';
import * as Ad from '../src/math/adding.js';
import * as Tk from '../src/math/taking.js';
import { READ_TOPICS, fixRider } from '../src/save.js';

const OFFSET = Number(process.env.SEED_OFFSET) || 0;
const seeded = (seed) => E.seeded(seed + OFFSET);
const TOPIC = { counting: Cn, adding: Ad, taking: Tk };
const MAKE = { counting: Cn.makeCounting, adding: Ad.makeAdding, taking: Tk.makeTaking };
const SOUNDS = new URL('../sounds/read/', import.meta.url);

test('the topics read aloud are the three youngest, the same list in save.js and readaloud.js', () => {
  assert.deepEqual([...READ.topics].sort(), ['adding', 'counting', 'taking']);
  assert.deepEqual([...READ_TOPICS].sort(), [...READ.topics].sort());
});

test('every number from 0 to 109 is said from clips', () => {
  for (let n = 0; n <= 109; n++) {
    const c = compose(String(n));
    assert.ok(c, `${n} can be said`);
    for (const k of c.clips) assert.ok(k in READ_CLIPS, `${n}: clip ${k} is a known clip`);
  }
  assert.deepEqual(numberParts(7).map((p) => p.clip), ['n7']);
  assert.deepEqual(numberParts(20).map((p) => p.clip), ['n20']);
  assert.deepEqual(numberParts(60).map((p) => p.clip), ['n60']);
  assert.deepEqual(numberParts(34).map((p) => p.clip), ['x30', 'o4']);
  assert.ok(numberParts(34)[1].gap < 0 && numberParts(34)[1].gap >= -0.015 && numberParts(34)[1].gap <= -0.005, 'tens and ones crossfade 5-15 ms');
  assert.deepEqual(numberParts(100).map((p) => p.clip), ['n100']);
  assert.deepEqual(numberParts(105).map((p) => p.clip), ['x100', 'and', 'n5']);
  assert.equal(numberParts(110), null, 'past what was recorded: not said');
  assert.equal(numberParts(-1), null);
  assert.equal(numberParts(2.5), null);
});

// Many cards from every rung of a topic's ladder (the same way its trainer deals them: problem(shape, row) then card)
function lines(topic, perRung = 400, seed = 1) {
  const M = TOPIC[topic], rand = seeded(seed), out = [];
  M.LADDER.forEach((row, i) => {
    for (const shape of row.shapes) {
      for (let k = 0; k < perRung; k++) {
        const p = M.problem(shape, row, rand);
        out.push({ rung: i + 1, shape, say: M.card(p, { rand }).say });
      }
    }
  });
  return out;
}

for (const topic of ['counting', 'adding', 'taking']) {
  test(`${topic}: every card's say line on every rung is put together from clips, nothing missing`, () => {
    const all = lines(topic);
    const seen = new Set();
    for (const { rung, shape, say } of all) {
      assert.ok(say, `${topic} rung ${rung} ${shape}: the card has a say line`);
      const c = compose(say);
      assert.ok(c, `${topic} rung ${rung} ${shape}: "${say}" can be said`);
      for (const k of c.clips) assert.ok(k in READ_CLIPS, `"${say}": clip ${k} is known`);
      seen.add(say);
    }
    assert.ok(seen.size > 30, `${topic}: many different lines tried (${seen.size})`);
  });

  test(`${topic}: the cards a trainer really deals (waves through the ladder, right and wrong answers) can all be said`, () => {
    for (let seed = 1; seed <= 4; seed++) {
      const rand = seeded(seed * 17);
      const T = MAKE[topic]({}, { rand, now: () => 1e12 });
      for (let w = 0; w < 40; w++) {
        const wave = T.wave({ count: 5 });
        for (const card of wave.cards) assert.ok(compose(card.say), `${topic} step ${wave.step}: "${card.say}" can be said`);
        // answer every card right (now and then wrong first) so the ladder climbs
        let c = wave.card, guard = 0;
        while (c && guard++ < 30) {
          const wrong = c.targets.find((t) => !t.good);
          if (wrong && rand() < 0.2) T.answer(wrong.n, false, c.id);
          const r = T.answer(c.answer, true, c.id);
          if (r.card && compose(r.card.say) == null) assert.fail(`"${r.card.say}" can't be said`);
          c = r.waveDone ? null : r.card;
        }
      }
    }
  });
}

test('the card lines come out as the right clips, with natural gaps', () => {
  const clips = (t) => compose(t).clips;
  assert.deepEqual(clips('how many dots'), ['dots']);
  assert.deepEqual(clips('what comes after 7'), ['after', 'n7']);
  assert.deepEqual(clips('what comes before 30'), ['before', 'n30']);
  assert.deepEqual(clips('one more than 34'), ['onemore', 'x30', 'o4']);
  assert.deepEqual(clips('ten less than 58'), ['tenless', 'x50', 'o8']);
  assert.deepEqual(clips('9 plus 5'), ['n9', 'plus', 'n5']);
  assert.deepEqual(clips('3 and what make 8'), ['n3', 'andwhatmake', 'n8']);
  assert.deepEqual(clips('8 take away what leaves 5'), ['n8', 'takeawaywhatleaves', 'n5']);
  assert.deepEqual(clips('9 take away 4'), ['n9', 'takeaway', 'n4']);
  assert.deepEqual(clips('9 cows, 4 run off'), ['n9', 'cows', 'n4', 'runoff']);
  // counting by 2s, 5s, 10s is followed by "what comes next?"
  for (const by of [2, 5, 10]) assert.deepEqual(clips(`counting by ${by}s`), [`by${by}`, 'next']);
  // the gaps: words 60-120 ms apart, a comma longer, "what comes next" after a pause
  const gaps = (t) => compose(t).parts.slice(1).map((p) => p.gap);
  for (const g of gaps('3 and what make 8')) assert.ok(g >= 0.06 && g <= 0.12, `a word gap ${g}`);
  const cw = gaps('9 cows, 4 run off');
  assert.ok(cw[1] > 0.2 && cw[1] < 0.4, 'the comma');
  assert.ok(gaps('counting by 5s')[0] >= 0.2, 'a pause before "what comes next?"');
});

test('a line with a word the clips do not hold is not said at all (no robot voice mixed in)', () => {
  for (const t of ['seven', 'what comes after seven', '3 times 4', 'rope the 6-herd', '7 × ? = 56', '', '   ', 'how many cows', '200']) {
    assert.equal(compose(t), null, `"${t}" is not said`);
  }
  // the reactions are said from their own clips
  for (const t of ["that's right", 'not that one', "count 'em again", 'what comes next', 'minus']) assert.ok(compose(t), t);
  assert.deepEqual(compose('12 minus 3').clips, ['n12', 'minus', 'n3'], '"minus" works if a card ever says it');
});

test('every clip is shipped as .ogg and .m4a, small, and nothing extra is in the folder', () => {
  const files = new Set(fs.readdirSync(SOUNDS));
  for (const k of Object.keys(READ_CLIPS)) {
    for (const ext of ['.ogg', '.m4a']) {
      assert.ok(files.has(k + ext), `${k}${ext} is shipped`);
      const size = fs.statSync(new URL(k + ext, SOUNDS)).size;
      assert.ok(size > 1000 && size < 40000, `${k}${ext} is a small clip (${size} bytes)`);
    }
  }
  for (const f of files) assert.ok(f.replace(/\.(ogg|m4a)$/, '') in READ_CLIPS, `${f} is a clip the game knows`);
  // every phrase and number clip is in READ_CLIPS
  for (const p of PHRASES) assert.ok(p.clip in READ_CLIPS, p.clip);
});

test('timeline: clips follow one another with their gaps, a crossfade overlaps', () => {
  const c = compose('one more than 34'), len = { onemore: 1, x30: 0.5, o4: 0.4 };
  const { at, end } = timeline(c.parts, (k) => len[k]);
  assert.equal(at[0], 0);
  assert.ok(Math.abs(at[1] - (1 + READ.lead)) < 1e-9);
  assert.ok(Math.abs(at[2] - (at[1] + 0.5 - READ.xfade)) < 1e-9, 'the ones start before the tens end');
  assert.ok(Math.abs(end - (at[2] + 0.4)) < 1e-9);
});

test('reactions: "That\'s right!" about one in three, never twice running; wrong picks always get theirs', () => {
  const B = makeReactions(seeded(5));
  let said = 0, prev = false, n = 3000;
  for (let i = 0; i < n; i++) {
    const r = B.pick('right');
    if (r) { assert.ok(!prev, 'never twice running'); said++; }
    prev = !!r;
  }
  assert.ok(said / n > 0.2 && said / n < 0.33, `about one in three (well, a little under: never twice running): ${(said / n).toFixed(2)}`);
  assert.equal(B.pick('wrong'), 'notthat');
  assert.equal(B.pick('recount'), 'again');
  assert.equal(B.pick('nonsense'), null);
  // a wrong pick between two right ones lets the next right one be praised again
  const C = makeReactions(() => 0);
  assert.equal(C.pick('right'), 'right'); assert.equal(C.pick('right'), null); C.pick('wrong'); assert.equal(C.pick('right'), 'right');
});

test('read aloud is off unless a grown-up turns it on (older saves start off)', () => {
  assert.equal(fixRider({ name: 'A' }).readAloud, false);
  assert.equal(fixRider({ name: 'A', readAloud: false }).readAloud, false);
  assert.equal(fixRider({ name: 'A', readAloud: true }).readAloud, false);              // the old "by itself" default
  assert.equal(fixRider({ name: 'A', readAloud: true, readV: 2 }).readAloud, true);     // chosen since
  assert.equal(fixRider({ name: 'A', readAloud: 'on' }).readAloud, 'on');
  assert.equal(fixRider(fixRider({ name: 'A', readAloud: true })).readAloud, false);    // and it stays off on reload
});

// a stand-in for the browser's sound: a clock the test moves, sources that end on that clock, and fetches that answer
// at once (or fail, for one format)
function fakeSound({ badExt = null } = {}) {
  const ctx = { currentTime: 0, srcs: [] };
  const node = () => ({ gain: { value: 1, setTargetAtTime() {} }, connect() {}, disconnect() {} });
  ctx.createGain = node;
  ctx.createBufferSource = () => { const s = { connect() {}, start(t) { s.at = t; ctx.srcs.push(s); }, stop() { s.stopped = true; } }; return s; };
  ctx.decodeAudioData = (ab, ok, no) => (ab.bad ? no(new Error('bad')) : ok({ duration: 0.5, name: ab.name }));
  const asked = [];
  const fetchFn = async (url) => { asked.push(url.split('/').pop()); const name = url.split('/').pop(); return { ok: true, arrayBuffer: async () => ({ name, bad: !!(badExt && name.endsWith(badExt)) }) }; };
  return { audio: { ctx, out: node(), running: true }, asked, fetchFn };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

test('a right pick\'s "That\'s right!" is said, and the next card (dealt the same moment) is read after it', async () => {
  const F = fakeSound(), was = globalThis.fetch; globalThis.fetch = F.fetchFn;
  try {
    const R = makeReadAloud({ audio: F.audio, base: 'http://x/', rand: () => 0, canPlay: () => 'probably' });
    assert.ok(R.react('right', { topic: 'adding' }));
    assert.ok(R.say('5 and what make 9', { topic: 'adding' }));
    await settle(); R.update(0.016);
    let s = R.state();
    assert.equal(s.now, 'right', 'the reaction is said first');
    assert.equal(s.waiting, '5 and what make 9', 'the card waits behind it');
    F.audio.ctx.currentTime = 0.5; R.update(0.5);
    assert.equal(R.state().now, 'right', 'the card waits for the reaction to finish');
    F.audio.ctx.currentTime = READ_CLIPS.right + 0.1; R.update(0.5);
    s = R.state();
    assert.equal(s.now, '5 and what make 9');
    assert.deepEqual(s.said.map((x) => x.kind), ['react', 'card']);
    assert.equal(R.react('right', { topic: 'adding' }), false, 'never over a card being read');
  } finally { globalThis.fetch = was; }
});

test('a clip that will not decode in one format is fetched in the other; a slow fetch still gets read', async () => {
  const F = fakeSound({ badExt: '.ogg' }), was = globalThis.fetch; globalThis.fetch = F.fetchFn;
  try {
    const R = makeReadAloud({ audio: F.audio, base: 'http://x/', canPlay: () => 'probably' });
    R.update(5);   // (time passes before the line: the wait counts from when it was asked)
    assert.ok(R.say('one more than 4', { topic: 'counting' }));
    R.update(READ.wait + 1);   // (longer than the wait for another voice, but the clips are not in yet)
    await settle(); await settle(); await settle();
    R.update(0.016);
    assert.equal(R.state().now, 'one more than 4');
    assert.ok(F.asked.includes('onemore.ogg') && F.asked.includes('onemore.m4a'), F.asked.join(' '));
  } finally { globalThis.fetch = was; }
});

test('a wave\'s clips can be fetched before its cards are read', async () => {
  const F = fakeSound(), was = globalThis.fetch; globalThis.fetch = F.fetchFn;
  try {
    const R = makeReadAloud({ audio: F.audio, base: 'http://x/', canPlay: () => 'maybe' });
    assert.equal(R.preload(['what comes after 7', '9 cows, 4 run off'], { topic: 'times' }), 0, 'other topics are not read');
    const n = R.preload(['what comes after 7', '9 cows, 4 run off', 'nonsense words'], { topic: 'counting' });
    await settle(); await settle();
    assert.equal(n, 3 + 6);
    assert.equal(R.state().loaded, 9);
    assert.ok(F.asked.every((x) => x.endsWith('.ogg')));
  } finally { globalThis.fetch = was; }
});

test('the gap between words is heard from sound to sound; the joins inside a number are not moved', () => {
  assert.deepEqual(Object.keys(READ_EDGES).sort(), Object.keys(READ_CLIPS).sort(), 'every clip has its edges');
  for (const [k, [a, b]] of Object.entries(READ_EDGES)) assert.ok(a >= 0 && b >= 0 && a + b < READ_CLIPS[k] / 2, k);
  const c = compose('9 plus 42'), len = (k) => READ_CLIPS[k];
  const { at } = timeline(c.parts, len, clipEdge);
  const heard = (i) => (at[i] + clipEdge(c.clips[i])[0]) - (at[i - 1] + len(c.clips[i - 1]) - clipEdge(c.clips[i - 1])[1]);
  assert.ok(Math.abs(heard(1) - READ.gap) < 1e-9, 'n9 > plus');
  assert.ok(Math.abs(heard(2) - READ.gap) < 1e-9, 'plus > x40');
  assert.deepEqual(c.clips, ['n9', 'plus', 'x40', 'o2']);
  assert.ok(Math.abs(at[3] - (at[2] + len('x40') + READ.stop)) < 1e-9, '"two" gets its moment of quiet after the tens');
  const d = compose('one more than 34'), t2 = timeline(d.parts, len, clipEdge);
  assert.ok(Math.abs(t2.at[2] - (t2.at[1] + len('x30') - READ.xfade)) < 1e-9, 'the other ones still crossfade');
});
