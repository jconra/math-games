// The fishing lab's questions (labs/fishing/questions.js): on every step of the ladder, many times over, every answer is
// checked by working it out again from the question's own numbers (exact fractions, no decimals), the wrong answers are
// real alternatives (never the same amount as the right one, never twice, never zero or less), the words follow the
// game's rule (units spelled out in sentences, "ft", "in." and "lb" only on labels), the same numbers don't come back
// within a few questions, and the ladder climbs and drops as it says.
import test from 'node:test';
import assert from 'node:assert/strict';

const Q = await import('../labs/fishing/questions.js');
const F = await import('../labs/fishing/frac.js');
const P = await import('../labs/fishing/pics.js');
const seeded = (s = 7) => () => { s = (s + 0x6D2B79F5) | 0; let r = Math.imul(s ^ (s >>> 15), 1 | s); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };

// a session of catches on one step: kept fish go in the creel, the counts grow, recent keys are steered clear of
function session(level, n, seed) {
  const rnd = seeded(seed), creel = [], counts = {}, recent = [], out = [];
  for (let i = 0; i < n; i++) {
    const q = Q.ladderQuestion(level, rnd, { creel, counts }, recent);
    out.push(q);
    recent.push(q.key); if (recent.length > Q.RECENT) recent.shift();
    counts[q.fish.kind] = (counts[q.fish.kind] || 0) + 1;
    if (q.action === 'keep') { creel.push(q.fish); if (creel.length > 8) creel.shift(); }
  }
  return out;
}
const valueOfChoice = (q, c) => {
  if (q.check.kind === 'keep' || q.check.kind === 'order') return null;
  const f = F.parseFrac(c); assert.ok(f, `${q.topic}: choice "${c}" is not a number`); return f;
};
// the words in a sentence: units spelled out; on labels the short forms
function checkWords(q) {
  const sentences = [q.prompt, q.why, ...q.steps, q.rule].join(' ');
  assert.doesNotMatch(sentences, /\d (ft|lb)\b/, `short unit in a sentence: ${sentences}`);
  assert.doesNotMatch(sentences, /\d in\./, `"in." in a sentence: ${sentences}`);
  assert.doesNotMatch(sentences, /undefined|NaN|null|\[object/, sentences);
  assert.doesNotMatch(sentences, /\d\.\d/, `a decimal: ${sentences}`);
  assert.doesNotMatch(sentences, /\b\d+\/1\b|\b0\/\d/, `a fraction over 1, or 0 over something: ${sentences}`);
  assert.doesNotMatch(sentences, /(?<![\d/] ?)\b1 (?:feet|inches|pounds)\b|\b(?:[02-9]|\d\d+) (?:foot|inch|pound)\b/, `one/many: ${sentences}`);
  for (const l of q.labels) { assert.doesNotMatch(l, /undefined|NaN|feet|inches|pounds/, l); assert.doesNotMatch(l, /\d in(?!\.)\b/, l); }
}
// real sizes: every fish at least half a foot and a length its kind comes in, a weight that suits it, every keeper
// limit at least half a foot and one that kind has posted; the creel's fish in a line-up too
function realSizes(q) {
  const f = q.fish, L = F.feet(f.len);
  assert.ok(F.value(L) >= 0.5 - 1e-9, `${q.topic}: a ${f.kind} ${F.label(f.len)} long`);
  assert.ok(Q.lengthFits(f.kind, L), `${q.topic}: a ${f.kind} doesn't come ${F.label(f.len)} long`);
  assert.ok(Q.weightFits(f.kind, L, f.lb), `${q.topic}: a ${F.label(f.len)} ${f.kind} weighing ${F.label(f.lb)}`);
  if (q.topic === 'keep') {
    assert.ok(F.value(F.feet(q.limit)) >= 0.5 - 1e-9, `a limit of ${F.label(q.limit)}`);
    assert.ok(Q.limitFits(f.kind, F.feet(q.limit)), `a ${f.kind} limit of ${F.label(q.limit)}`);
  }
  if (q.topic === 'order') for (const m of q.check.list) assert.ok(F.value(F.feet(m)) >= 0.5 - 1e-9, `a ${F.label(m)} fish in a line-up`);
  if (q.topic === 'add') for (const w of [q.check.a, q.check.b]) assert.ok(F.value(w) >= 0.25 - 1e-9, `a ${F.label(F.measure(w, 'lb'))} fish in the creel`);
}
// a picture shown WITH the question is a tool only: no fish laid on it, no limit (or any marked) line, no shading, and
// none of the answer's own words or numbers in it
function noGiveAway(q) {
  if (!q.svg) return;
  assert.doesNotMatch(q.svg, /<path/, `${q.topic}: a fish (or another shape) drawn in the question's picture`);
  assert.doesNotMatch(q.svg, /stroke-dasharray/, `${q.topic}: a marked line in the question's picture`);
  assert.doesNotMatch(q.svg, /opacity="0\.85"|rgba\(79,122,42/, `${q.topic}: something shaded in the question's picture`);
  assert.doesNotMatch(q.svg, /limit|Longer|Shorter|same/i, `${q.topic}: words of the answer in the question's picture`);
  // the ruler's numbers are the only numbers in it (no fish length, no limit)
  const texts = [...q.svg.matchAll(/>([^<]+)</g)].map((m) => m[1].trim()).filter(Boolean);
  for (const t of texts) assert.match(t, /^(\d+|ft|in\.)$/, `${q.topic}: "${t}" written in the question's picture`);
}
function checkPictures(q) {
  for (const s of [q.helper, q.lessonPic, q.svg].filter(Boolean)) {
    assert.match(s, /^<svg class="pic" viewBox="0 0 320 \d+(\.\d+)?">/);
    assert.doesNotMatch(s, /NaN|undefined|Infinity/, `${q.topic}: a broken picture`);
  }
  assert.ok(q.helper && q.lessonPic, `${q.topic}: no helper picture`);
}
// the right answer worked out again from the question's own numbers
function checkAnswer(q) {
  const c = q.check;
  if (c.kind === 'keep') {
    const s = F.compareM(c.a, c.b), want = s < 0 ? 'shorter' : s === 0 ? 'same' : 'longer';
    assert.equal(q.answer, want, q.prompt);
    assert.equal(q.action, want === 'shorter' ? 'throw' : 'keep');
    assert.deepEqual(q.choices, ['shorter', 'same', 'longer']);
    assert.equal(F.compareM(q.fish.len, c.a), 0, 'the fish is the length asked about');
  } else if (c.kind === 'order') {
    const vals = c.list.map((m) => F.value(F.inches(m)));
    assert.equal(new Set(vals).size, 3, 'three different lengths');
    const want = [0, 1, 2].sort((i, j) => vals[j] - vals[i]).join('');
    assert.equal(q.answer, want, q.prompt);
    for (const ch of q.choices) assert.equal([...ch].sort().join(''), '012', 'every choice is a line-up of all three');
  } else if (c.kind === 'add') {
    assert.ok(F.same(F.parseFrac(q.answer), F.plus(c.a, c.b)), q.prompt);
    assert.ok(F.isSimplest(F.parseFrac(q.answer)), 'the sum in simplest form');
  } else if (c.kind === 'same') {
    assert.ok(F.same(F.parseFrac(q.answer), c.given), q.prompt);
    assert.notEqual(q.answer, F.fracText(c.given, 'frac'), 'asks for other numbers');
  } else if (c.kind === 'cook') {
    assert.equal(c.n % (c.a + c.b), 0);
    assert.equal(+q.answer, c.n / (c.a + c.b) * (c.askA ? c.a : c.b), q.prompt);
  } else if (c.kind === 'bait') {
    assert.equal(c.w % c.f, 0); assert.equal(+q.answer, c.w / c.f * c.m, q.prompt);
  } else if (c.kind === 'rule') {
    assert.equal(+q.answer, c.fwd ? c.k : c.n * c.k, q.prompt);
  } else if (c.kind === 'part') {
    assert.ok(F.same(F.parseFrac(q.answer), F.fr(c.a, c.a + c.b)), q.prompt);
  } else assert.fail('unknown kind ' + c.kind);
}
function checkChoices(q) {
  assert.ok(q.choices.includes(q.answer), `${q.topic}: the answer is a choice`);
  assert.equal(q.labels.length, q.choices.length);
  assert.equal(new Set(q.choices).size, q.choices.length, `${q.topic}: a choice twice: ${q.labels}`);
  assert.equal(new Set(q.labels).size, q.labels.length, `${q.topic}: a label twice: ${q.labels}`);
  assert.ok(q.choices.length >= 3 && q.choices.length <= 4, `${q.topic}: ${q.choices.length} choices`);
  const vals = q.choices.map((c) => valueOfChoice(q, c));
  if (vals[0]) {
    // no two the same amount (6/8 next to 3/4 would be two right answers), all more than 0
    for (let i = 0; i < vals.length; i++) {
      assert.ok(vals[i].n > 0 && vals[i].d > 0, `${q.topic}: ${q.labels[i]}`);
      for (let j = i + 1; j < vals.length; j++) assert.ok(!F.same(vals[i], vals[j]), `${q.topic}: ${q.labels[i]} and ${q.labels[j]} are the same amount`);
    }
    // the wrong ones are near enough to be tempting: within a factor of 4 of the answer
    const a = F.value(F.parseFrac(q.answer));
    for (const v of vals) assert.ok(F.value(v) <= a * 4 + 2 && F.value(v) >= a / 4 - 1, `${q.topic}: ${F.fracText(v)} far from ${q.answer}`);
  }
}

test('every step, hundreds of catches: right answers, real wrong ones, the words, the pictures', () => {
  const seen = {};
  for (let level = 1; level <= Q.LADDER_TOP; level++) for (const seed of [1, 2, 3]) {
    for (const q of session(level, 160, seed * 100 + level)) {
      seen[level] = seen[level] || {}; seen[level][q.topic] = (seen[level][q.topic] || 0) + 1;
      assert.equal(q.level, level);
      checkAnswer(q); checkChoices(q); checkWords(q); checkPictures(q);
      assert.ok(q.rule && q.steps.length >= 1 && q.answerLabel, `${q.topic}: no lesson`);
      assert.ok(Q.KINDS[q.fish.kind], 'a fish of a known kind');
      assert.ok(q.fish.lb && q.fish.lb.n > 0, 'it has a weight');
      if (q.from <= 2 && q.topic === 'keep') assert.ok(q.svg, 'steps 1 and 2 show a ruler with the question');
      noGiveAway(q);
      realSizes(q);
    }
  }
  // each step asks what it says it asks
  assert.deepEqual(Object.keys(seen[1]), ['keep']);
  assert.deepEqual(Object.keys(seen[2]), ['keep']);
  for (const t of ['order', 'add', 'keep']) assert.ok(seen[3][t] > 20, `step 3 ${t}: ${seen[3][t]}`);
  for (const t of ['keep', 'same']) assert.ok(seen[4][t] > 40, `step 4 ${t}`);
  for (const t of ['keep', 'order', 'add']) assert.ok(seen[5][t] > 20, `step 5 ${t}: ${seen[5][t]}`);
  for (const t of ['keep', 'order', 'add']) assert.ok(seen[6][t] > 20, `step 6 ${t}: ${seen[6][t]}`);
  for (const t of ['cook', 'bait', 'rule', 'part']) assert.ok(seen[7][t] > 30, `step 7 ${t}`);
  assert.ok(Object.keys(seen[8]).length >= 6, 'step 8 mixes them: ' + Object.keys(seen[8]));
});

test('the steps climb: what each step\'s lengths are made of', () => {
  const dens = (level) => new Set(session(level, 200, 9).filter((q) => q.topic === 'keep').flatMap((q) => [q.check.a.d, q.check.b.d]));
  assert.deepEqual([...dens(1)].sort((a, b) => a - b).filter((d) => d > 1), [2, 4], 'step 1: halves and quarters');
  for (const d of dens(2)) assert.ok([1, 2, 4, 8].includes(d), 'step 2: eighths at most');
  assert.ok(dens(2).has(8));
  assert.ok([...dens(5)].some((d) => d % 3 === 0) && [...dens(5)].some((d) => d === 5 || d === 10), 'step 5: thirds, fifths ...');
  const six = session(6, 200, 11).filter((q) => q.topic === 'keep');
  assert.ok(six.some((q) => q.check.a.unit === 'in'), 'step 6: inches');
  assert.ok(six.some((q) => q.check.a.unit !== q.check.b.unit), 'step 6: feet against inches');
  assert.ok(six.some((q) => q.check.a.form === 'frac' && q.check.a.n > q.check.a.d), 'step 6: improper fractions');
  // keep or throw back: every verdict comes up on every keep step, and "the same" is never the most common
  for (const level of [1, 2, 4, 5, 6]) {
    const n = { shorter: 0, same: 0, longer: 0 };
    for (const q of session(level, 300, 21 + level)) if (q.topic === 'keep') n[q.answer]++;
    assert.ok(n.shorter > 20 && n.longer > 20, `step ${level}: ${JSON.stringify(n)}`);
    if (level !== 5) assert.ok(n.same > 5 && n.same < Math.max(n.shorter, n.longer), `step ${level}: ${JSON.stringify(n)}`);
  }
});

test('no repeats: the same numbers are not asked again within a few catches', () => {
  for (let level = 1; level <= Q.LADDER_TOP; level++) for (const seed of [5, 6, 7]) {
    const keys = session(level, 120, seed * 31 + level).map((q) => q.key);
    const window = level === 1 ? 6 : Q.RECENT;
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < Math.min(keys.length, i + window); j++) {
      assert.notEqual(keys[i], keys[j], `step ${level}: ${keys[i]} again ${j - i} questions later`);
    }
  }
});

test('Teach me / Try it: a fresh practice question of every topic, said as a "say" and with its lesson', () => {
  const rnd = seeded(77);
  for (const [step, topics] of Object.entries(Q.TOPICS_AT)) for (const topic of topics) for (let i = 0; i < 30; i++) {
    const q = Q.questionOf(topic, +step, rnd);
    assert.equal(q.topic, topic, `step ${step} ${topic}`);
    checkAnswer(q); checkChoices(q); checkWords(q); checkPictures(q);
    if (['keep', 'order', 'add', 'same'].includes(topic)) assert.match(q.prompt, /Say /, 'a made-up fish is said as one: ' + q.prompt);
  }
});

test('the ladder: placing climbs fast, then three right in a row climbs, a wrong one drops', () => {
  let s = Q.freshLadder();
  assert.deepEqual(s, { level: 1, streak: 0, placing: true, slips: 0 });
  assert.equal(Q.PLACE_JUMP, 2);
  s = Q.stepLadder(s, true); s = Q.stepLadder(s, true);
  assert.equal(s.level, 5, 'placing: two steps for each right answer');
  s = Q.stepLadder(s, false);
  assert.equal(s.level, 5, 'the first slip is forgiven'); assert.equal(s.placing, true);
  s = Q.stepLadder(s, true); assert.equal(s.level, 7);
  s = Q.stepLadder(s, false);
  assert.equal(s.level, 6, 'the second slip ends placing a step down'); assert.equal(s.placing, false);
  s = Q.stepLadder(s, false); assert.equal(s.level, 5);
  s = Q.stepLadder(s, false); assert.equal(s.level, 4);
  assert.equal(Q.CLEAN_TO_CLIMB, 3);
  s = Q.stepLadder(s, true); s = Q.stepLadder(s, true); assert.equal(s.level, 4);
  s = Q.stepLadder(s, true); assert.equal(s.level, 5, 'three right in a row');
  s = Q.stepLadder(s, true); s = Q.stepLadder(s, true); s = Q.stepLadder(s, false); assert.equal(s.level, 4, 'a wrong one drops a step'); assert.equal(s.streak, 0);
  // never under 1 or over the top
  let low = { level: 1, streak: 0, placing: false, slips: 2 };
  for (let i = 0; i < 5; i++) low = Q.stepLadder(low, false);
  assert.equal(low.level, 1);
  let high = Q.freshLadder(); for (let i = 0; i < 40; i++) high = Q.stepLadder(high, true);
  assert.equal(high.level, Q.LADDER_TOP);
  // saved and read back; junk reads as a fresh ladder
  assert.deepEqual(Q.readLadder(JSON.stringify({ level: 5, streak: 2, placing: false, slips: 2 })), { level: 5, streak: 2, placing: false, slips: 2 });
  for (const junk of [null, '', '{', '{"level":0}', '{"level":99}', '"x"', '[]']) assert.deepEqual(Q.readLadder(junk), Q.freshLadder(), String(junk));
});

test('the ladder moves with the kid: simulated anglers settle where they get about 4 in 5 right', () => {
  // a kid who knows steps up to `knows` well (95% right there) and guesses above it (a third right)
  const settle = (knows, seed) => {
    const rnd = seeded(seed); let s = Q.freshLadder(); const levels = [], rights = [];
    for (let i = 0; i < 600; i++) {
      const right = rnd() < (s.level <= knows ? 0.95 : 0.33);
      if (i >= 100) { levels.push(s.level); rights.push(right); }
      s = Q.stepLadder(s, right);
    }
    return { mean: levels.reduce((a, b) => a + b, 0) / levels.length, right: rights.filter(Boolean).length / rights.length };
  };
  for (const knows of [1, 3, 5, 7]) {
    const runs = [11, 12, 13].map((seed) => settle(knows, seed * 7 + knows));
    for (const r of runs) {
      assert.ok(Math.abs(r.mean - (knows + 0.5)) < 1.2, `knows ${knows}: settles at ${r.mean.toFixed(2)}`);
      assert.ok(r.right > 0.6 && r.right < 0.95, `knows ${knows}: ${(r.right * 100).toFixed(0)}% right`);
    }
  }
  // an always-right kid reaches the top in a handful of fish; an always-wrong one stays on step 1
  let s = Q.freshLadder(), n = 0; while (s.level < Q.LADDER_TOP) { s = Q.stepLadder(s, true); n++; }
  assert.equal(n, 4, `${n} fish to the top`);
  // how many fish a fresh kid who knows steps up to k well takes to be working on step k or above (placing only)
  for (const knows of [3, 5, 7]) {
    let t = Q.freshLadder(), fish = 0;
    while (t.level < Math.min(knows, Q.LADDER_TOP) && fish < 20) { t = Q.stepLadder(t, t.level <= knows); fish++; }
    assert.ok(fish <= Math.ceil((knows - 1) / 2) + 1, `knows ${knows}: ${fish} fish to reach it`);
  }
  s = Q.freshLadder(); for (let i = 0; i < 20; i++) s = Q.stepLadder(s, false); assert.equal(s.level, 1);
});

test('fractions, measures and words', () => {
  assert.equal(F.fracText(F.fr(5, 4)), '1 1/4'); assert.equal(F.fracText(F.fr(5, 4), 'frac'), '5/4'); assert.equal(F.fracText(F.fr(8, 4)), '2');
  assert.deepEqual(F.parseFrac('1 1/4'), F.fr(5, 4)); assert.deepEqual(F.parseFrac('7'), F.fr(7, 1)); assert.equal(F.parseFrac('x'), null);
  assert.equal(F.words(F.M(3, 4, 'ft')), '3/4 of a foot'); assert.equal(F.words(F.M(1, 1, 'ft')), '1 foot'); assert.equal(F.words(F.M(5, 4, 'ft')), '1 1/4 feet');
  assert.equal(F.words(F.M(5, 4, 'ft', 'frac')), '5/4 feet'); assert.equal(F.words(F.M(15, 2, 'in')), '7 1/2 inches'); assert.equal(F.words(F.M(1, 2, 'lb')), '1/2 of a pound');
  assert.equal(F.label(F.M(15, 2, 'in')), '7 1/2 in.'); assert.equal(F.label(F.M(3, 4, 'ft')), '3/4 ft'); assert.equal(F.label(F.M(3, 2, 'lb')), '1 1/2 lb');
  assert.equal(F.compareM(F.M(3, 4, 'ft'), F.M(9, 1, 'in')), 0, '3/4 of a foot is 9 inches');
  assert.equal(F.compare(F.fr(5, 8), F.fr(2, 3)), -1); assert.ok(F.same(F.fr(6, 8), F.fr(3, 4)));
});

test('the fish: kinds that come that long, weights, sizes, the record and the book', () => {
  const rnd = seeded(3);
  for (let q = 2; q <= 12; q++) {
    const L = F.fr(q, 4), k = Q.kindFor(L, rnd);
    assert.ok(F.value(L) >= F.value(Q.KINDS[k].min) && F.value(L) <= F.value(Q.KINDS[k].max), `${k} at ${F.fracText(L)} ft`);
    const w = Q.weightFor(k, L); assert.ok(w.n > 0 && [1, 2, 4, 8].includes(w.d) && F.value(w) >= 0.25, F.label(w));
  }
  assert.equal(Q.kindFor(F.fr(1, 3), rnd), null, 'no fish a third of a foot long');
  assert.equal(Q.kindFor(F.fr(3, 4), rnd, {}, F.fr(1, 6)), null, 'no limit of a sixth of a foot');
  assert.equal(Q.kindFor(F.fr(3, 4), rnd, {}, F.fr(1, 2)), 'perch', 'only perch have a 6 inch limit');
  for (const k of Q.KIND_LIST) { const K = Q.KINDS[k]; assert.ok(F.value(K.limLo) >= 0.5 && F.value(K.min) >= 0.5, k); if (k !== 'perch') assert.ok(F.value(K.limLo) >= 2 / 3 - 1e-9 && F.value(K.limHi) <= 1.25, k); }
  assert.equal(F.label(Q.weightFor('bass', F.fr(5, 4))), '1 3/4 lb', 'a 15 inch bass is about 1 3/4 pounds');
  assert.equal(F.label(Q.weightFor('perch', F.fr(1, 2))), '1/4 lb', 'a fish half a foot long weighs at least a quarter pound');
  assert.ok(!Q.weightFits('trout', F.fr(1), F.M(1, 8, 'lb')), 'a 1 ft trout is no eighth of a pound');
  assert.equal(Q.sizeOf({ kind: 'trout', len: F.M(1, 2, 'ft') }), 'small');
  assert.equal(Q.sizeOf({ kind: 'trout', len: F.M(1, 1, 'ft') }), 'keeper');
  assert.equal(Q.sizeOf({ kind: 'trout', len: F.M(18, 1, 'in') }), 'trophy');
  const rec = { kind: 'bass', len: F.M(5, 4, 'ft'), lb: F.M(7, 4, 'lb') };
  assert.ok(Q.beatsRecord(null, rec)); assert.ok(!Q.beatsRecord(rec, { len: F.M(15, 1, 'in') })); assert.ok(Q.beatsRecord(rec, { len: F.M(31, 2, 'in') }));
  assert.deepEqual(Q.readRecord(JSON.stringify(rec)), rec);
  for (const junk of [null, '{', '{"kind":"shark"}', '{"kind":"bass","len":{"n":1,"d":0}}']) assert.equal(Q.readRecord(junk), null);
  const book = Q.readBook(JSON.stringify({ bass: { small: true, trophy: true, caught: 3 } }));
  assert.equal(Q.bookCount(book), 2); assert.equal(Q.BOOK_TOTAL, 12); assert.equal(book.bass.caught, 3);
  assert.equal(Q.bookCount(Q.readBook('junk')), 0);
});

test('pictures draw stacked fractions and stay inside their frames', () => {
  const r = P.rulerPic({ unit: 'ft', to: 1, parts: 8, marks: [{ kind: 'fish', v: F.fr(5, 8), label: '5/8 ft', colour: '#888' }, { kind: 'limit', v: F.fr(3, 4), label: 'limit 3/4 ft' }] });
  assert.match(r, /<line[^>]+stroke-dasharray="5 3"/, 'the limit line');
  assert.ok((r.match(/>5</g) || []).length >= 1 && (r.match(/>8</g) || []).length >= 1, 'the 5 over the 8');
  const xs = [...r.matchAll(/x="(-?[\d.]+)"/g)].map((m) => +m[1]);
  assert.ok(Math.min(...xs) >= 0 && Math.max(...xs) <= 320, `x from ${Math.min(...xs)} to ${Math.max(...xs)}`);
  const t = P.tablePic({ head: ['trout', 'bass', 'in all'], rows: [[3, 2, 5], [6, 4, 10]], hl: [1, 0], steps: ['× 2'] });
  assert.match(t, /rgba\(79,122,42/);
  assert.ok(P.textWidth('1 1/4 ft', 16) < P.textWidth('1 11/40 ft', 16));
});
