// The windmill lab's miller questions are all ones to do in your head (no calculator): every kind, generated many
// times, has a whole-number answer (degrees, a whole number of inches that is a whole or half foot, a whole or half
// foot) and only small, whole-or-half numbers in what it says (no decimals, no "about how high to the inch").
import test from 'node:test';
import assert from 'node:assert/strict';

const Q = await import('../labs/windmill/questions.js');
const T = await import('../labs/windmill/tower.js');
const seeded = (s = 7) => () => { s = (s + 0x6D2B79F5) | 0; let r = Math.imul(s ^ (s >>> 15), 1 | s); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
const halfFoot = (v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;
// every number in the words: "7½" -> 7.5, "½" -> 0.5. None may have a decimal point.
function numbersIn(text) {
  assert.doesNotMatch(text, /\d\.\d/, 'a decimal in: ' + text);
  assert.doesNotMatch(text, /≈|√|[Aa]bout how high|to the inch/, 'a calculator sum in: ' + text);
  return [...text.matchAll(/(\d+)?(½)?/g)].filter((m) => m[1] || m[2]).map((m) => (m[1] ? +m[1] : 0) + (m[2] ? 0.5 : 0));
}
function check(q, kind, maxInput) {
  assert.ok(q, 'no question');
  const words = q.prompt + ' ' + q.why;
  for (const n of numbersIn(q.prompt)) assert.ok(n <= maxInput && halfFoot(n), `${kind}: input ${n} in ${q.prompt}`);
  for (const n of numbersIn(q.why)) assert.ok(n <= 180 && halfFoot(n), `${kind}: ${n} in ${q.why}`);
  if (q.unit === '°') assert.ok(Number.isInteger(q.answer) && q.answer % 5 === 0, `${kind}: ${q.answer}°`);
  else if (q.kind === 'slope') assert.ok(Number.isInteger(q.answer) && q.answer % 6 === 0, `${kind}: ${q.answer} in.`);
  else assert.ok(halfFoot(q.answer) && q.answer <= 20, `${kind}: ${q.answer} ft`);
  assert.ok(q.choices.includes(q.answer)); assert.equal(new Set(q.choices).size, q.choices.length, words);
  for (const c of q.choices) assert.ok(c > 0 && (q.unit === '°' || q.kind === 'slope' ? Number.isInteger(c) : halfFoot(c)), `${kind}: choice ${c}`);
  if (q.helper && q.helper.kind === 'squares') for (const v of [q.helper.a, q.helper.b, q.helper.c]) assert.ok(Number.isInteger(v) && v <= 13);
}

test('how high a slanting board reaches, or an easy one about it: every half-foot board and run', () => {
  let n = 0, slope = 0, easy = 0;
  for (let L = 1; L <= 8; L += 0.5) for (let r = 0.5; r < L; r += 0.5) for (let s = 1; s <= 4; s++) {
    const q = Q.reachQuestion(L, r, seeded(s * 31 + L * 7 + r)); if (!q) continue;
    check(q, `reach ${L}/${r}`, 13); n++; if (q.kind === 'slope') slope++; else easy++;
    if (q.kind === 'slope') assert.ok(Q.isTriple(L, r, q.answer / 12));
  }
  assert.ok(n > 300 && slope > 0 && easy > 0, `${n} ${slope} ${easy}`);
});

test('the brace across an opening: every half-foot width and height', () => {
  let n = 0;
  for (let w = 0.5; w <= 8; w += 0.5) for (let h = 0.5; h <= 8; h += 0.5) for (let s = 1; s <= 3; s++) {
    const q = Q.bayQuestion(w, h, 0, seeded(s + w * 17 + h)); if (!q) continue;
    check(q, `bay ${w}x${h}`, 13); n++;
  }
  assert.ok(n > 0);
});

test('the triangle questions (corners and sides): many random triangles on the half foot, and whole triples', () => {
  const rnd = seeded(99); let angle = 0, length = 0;
  const kinds = [{ ground: true }, { post: true }, { level: true }, {}];
  for (let k = 0; k < 4000; k++) {
    const h = () => Math.round(rnd() * 16) / 2;
    let pts = [{ x: h(), y: h() }, { x: h(), y: h() }, { x: h(), y: h() }];
    if (k % 3 === 0) {   // a whole right triangle, turned any way
      const [a, b] = [[3, 4], [4, 3], [6, 8], [8, 6], [5, 12], [12, 5]][k % 6], x = h(), y = h();
      pts = [[{ x, y }, { x: x + a, y }, { x, y: y + b }], [{ x: x + a, y }, { x, y: y + b }, { x, y }], [{ x, y: y + b }, { x, y }, { x: x + a, y }]][k % 3 === 0 ? (k / 3) % 3 : 0];
    }
    const [P, Q2, R] = pts, area = Math.abs((Q2.x - P.x) * (R.y - P.y) - (R.x - P.x) * (Q2.y - P.y)) / 2;
    if (area < 0.8) continue;
    const q = Q.makeQuestion([{ pts, a: kinds[k % 4], b: kinds[(k >> 2) % 4] }], null, seeded(k));
    if (!q) continue;
    check(q, `tri ${JSON.stringify(pts)}`, 180);
    if (q.kind === 'angle') angle++; else length++;
  }
  assert.ok(angle > 500 && length > 100, `${angle} ${length}`);
});

test('the triangles found in a real tower ask easy questions too', () => {
  const P = (X, Y, Z) => ({ X, Y, Z }), B = (id, a, b, len) => ({ id, a, b, len });
  const t = T.newTower(3, 3);
  t.boards.push(B('p1', P(1.5, 0, 1.5), P(1.5, 8, 1.5), 8), B('p2', P(1.5, 0, -1.5), P(1.5, 8, -1.5), 8), B('h', P(1.5, 4, 1.5), P(1.5, 4, -1.5), 3));
  for (const [id, a, b] of [['br', P(1.5, 0, 1.5), P(1.5, 4, -1.5)], ['odd', P(1.5, 1, 1.5), P(1.5, 4, -1.5)], ['lo', P(1.5, 0, 1.5), P(1.5, 2.5, -1.5)]]) {
    const me = B(id, a, b, Math.hypot(b.X - a.X, b.Y - a.Y, b.Z - a.Z)); t.boards.push(me);
    const tris = Q.trianglesOf(t, me);
    for (let s = 1; s <= 20; s++) { const q = Q.makeQuestion(tris, me, seeded(s)); if (q) check(q, id, 180); }
    t.boards.pop();
  }
});

// ── the ladder (questions not tied to the board), the cap on spare boards ──
const angAt = (p, q, r) => { const ax = q.x - p.x, ay = q.y - p.y, bx = r.x - p.x, by = r.y - p.y; return Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by))))) * 180 / Math.PI; };
const triAngles = (P) => [angAt(P[0], P[1], P[2]), angAt(P[1], P[2], P[0]), angAt(P[2], P[0], P[1])];
const sides = (P) => [0, 1, 2].map((i) => Math.hypot(P[(i + 1) % 3].x - P[i].x, P[(i + 1) % 3].y - P[i].y));
function checkPicture(q, kind) {
  const svg = q.svg || '';
  assert.doesNotMatch(svg + (q.helper && q.helper.svg || ''), /NaN|undefined|Infinity/, kind + ': a broken picture');
  if (q.kind === 'name-angle') {
    const { V, A, B, deg } = q.geo, d = angAt(V, A, B);
    assert.ok(Math.abs(d - deg) < 0.5, `${kind}: drawn ${d} for ${deg}`);
    const name = d < 89 ? 'acute' : d < 91 ? 'right' : d < 179 ? 'obtuse' : 'straight';
    assert.equal(name, q.answer);
    if (q.answer === 'acute') assert.ok(d <= 70); if (q.answer === 'obtuse') assert.ok(d >= 110);   // never a near miss
  } else if (q.kind === 'tri-corners') {
    const a = triAngles(q.geo.pts), big = Math.max(...a);
    a.forEach((v, i) => assert.ok(Math.abs(v - q.geo.ang[i]) < 0.5, `${kind}: corner ${v} vs ${q.geo.ang[i]}`));
    assert.equal(big > 100 ? 'obtuse' : Math.abs(big - 90) < 0.5 ? 'right' : big < 81 ? 'acute' : 'unclear', q.answer);
    assert.ok(Math.min(...a) >= 19);
  } else if (q.kind === 'tri-sides') {
    const s = sides(q.geo.pts), k = s.map((v) => s.map((w) => Math.abs(v / w - 1) < 1e-6)).flat().filter(Boolean).length;   // 3, 5 or 9 pairs
    assert.equal({ 9: 'equilateral', 5: 'isosceles', 3: 'scalene' }[k], q.answer);
    s.forEach((v, i) => assert.ok(Math.abs(v / s[0] - q.geo.sides[i] / q.geo.sides[0]) < 1e-6));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) assert.equal(q.geo.ticks[i] === q.geo.ticks[j], q.geo.sides[i] === q.geo.sides[j]);
    assert.ok(Math.min(...triAngles(q.geo.pts)) >= 20, kind + ': too flat to read');
  } else if (q.kind === 'missing') {
    const { V, E1, E2, B, onLine, a } = q.geo;
    assert.ok(Math.abs(angAt(V, E1, B) - a) < 0.5, `${kind}: the shown angle`);
    assert.ok(Math.abs(angAt(V, B, E2) - q.answer) < 0.5, `${kind}: the asked angle`);
    assert.ok(Math.abs(angAt(V, E1, E2) - (onLine ? 180 : 90)) < 0.5);
  } else if (q.kind === 'angle') {
    const a = triAngles(q.pts);
    q.angleLabels.forEach((l, i) => assert.ok(Math.abs(a[i] - (l === '?' ? q.answer : parseInt(l, 10))) < 0.5, `${kind}: corner ${i}`));
  } else if (q.kind === 'length') {
    const s = sides(q.pts);
    q.sideLabels.forEach((l, i) => assert.ok(Math.abs(s[i] - (l === '?' ? q.answer : parseInt(l, 10))) < 1e-6, `${kind}: side ${i}`));
    assert.ok(Math.abs(triAngles(q.pts)[q.square] - 90) < 1e-6);
  } else if (q.kind === 'cross') {
    const { shown, asked, a, topic, variant, boards } = q.geo;
    assert.ok(Math.abs(angAt(shown.V, shown.A, shown.B) - a) < 0.5, `${kind}: the shown angle`);
    assert.ok(Math.abs(angAt(asked.V, asked.A, asked.B) - q.answer) < 0.5, `${kind}: the asked angle`);
    for (const [p0, p1] of boards) assert.ok(Math.abs(p0.y - p1.y) < 0.2, kind + ': a board not level');
    if (topic === 'x') assert.ok(Math.hypot(shown.V.x - asked.V.x, shown.V.y - asked.V.y) < 0.2, kind + ': an X has one crossing');
    else {
      assert.equal(boards.length, 2); assert.ok(Math.abs(boards[0][0].y - boards[1][0].y) > 30, kind + ': the parallel boards apart');
      assert.ok(Math.abs(asked.V.y - shown.V.y) > 30, kind + ': asked at the other board');
      // the F / Z / C rule itself: equal, equal, adding to 180
      assert.equal(q.answer, topic === 'c' ? 180 - a : a);
    }
    if (topic === 'x') assert.equal(q.answer, variant === 'across' ? a : 180 - a);
  } else if (q.kind === 'slope') {
    assert.ok(Q.isTriple(q.pic.L, q.pic.r, q.answer / 12));
  } else assert.fail('unknown kind ' + q.kind);
}

test('every step of the ladder: answers in the head, buttons valid, the picture shows what the question says', () => {
  const seen = {};
  for (let level = 1; level <= Q.LADDER_TOP; level++) for (let s = 1; s <= 400; s++) {
    const q = Q.ladderQuestion(level, seeded(s * 13 + level)), kind = `step ${level} ${q.kind} #${s}`;
    assert.equal(q.level, level);
    seen[q.kind] = (seen[q.kind] || 0) + 1;
    assert.ok(q.prompt && q.why && q.title, kind);
    assert.ok(q.helper, kind + ': no helper for a wrong answer');
    assert.ok(q.svg || q.pts || q.pic, kind + ': no picture');
    assert.ok(q.why.split(/[.!?](\s|$)/).filter((x) => x && x.trim()).length <= 3, kind + ': helper too long: ' + q.why);
    assert.doesNotMatch(q.prompt + q.why, /\d\s?(ft|in)\b(?!\.)/, kind + ': a unit not spelled out: ' + q.prompt);
    assert.doesNotMatch(q.prompt + q.why, /\blevel\b/i, kind + ': "level" means a storey in this game');
    if (typeof q.answer === 'string') {
      assert.ok(q.choices.includes(q.answer) && q.labels.length === q.choices.length && new Set(q.choices).size === q.choices.length, kind);
      numbersIn(q.prompt); numbersIn(q.why);
    } else check(q, kind, 180);
    assert.ok(Q.TOPICS[q.topic], kind + ': topic ' + q.topic);
    assert.ok(q.rule && q.steps.length >= 2 && q.steps.length <= 4, kind + ': no lesson');
    numbersIn(q.rule); for (const st of q.steps) { numbersIn(st); assert.doesNotMatch(st, /\d\s?(ft|in)\b(?!\.)/, st); }
    if (typeof q.answer === 'number' && q.kind !== 'slope') assert.match(q.steps[q.steps.length - 1], new RegExp('\\b' + q.answer + '\\b'), kind + ': the worked answer');
    if (q.kind === 'missing' || q.kind === 'angle' || q.kind === 'cross') for (const c of q.choices) assert.ok(c % 5 === 0 && c < 180, kind + ' choice ' + c);
    checkPicture(q, kind);
  }
  for (const k of ['name-angle', 'tri-corners', 'tri-sides', 'missing', 'cross', 'angle', 'length', 'slope']) assert.ok(seen[k] > 20, `${k}: ${seen[k]}`);
  // every answer of the word kinds turns up
  const answers = new Set();
  for (let s = 1; s <= 400; s++) for (const l of [1, 2]) answers.add(Q.ladderQuestion(l, seeded(s * 7 + l)).answer);
  for (const a of ['acute', 'right', 'obtuse', 'straight', 'equilateral', 'isosceles', 'scalene']) assert.ok(answers.has(a), a);
});

test('every topic makes a fresh one of itself (Teach me -> Try it), with a lesson', () => {
  const topics = Object.keys(Q.TOPICS);
  for (const t of ['name-angle', 'tri-corners', 'tri-sides', 'line', 'corner', 'x', 'f', 'z', 'c', 'tri-sum', 'hyp', 'leg', 'reach']) assert.ok(topics.includes(t), t);
  for (const t of topics) for (let s = 1; s <= 60; s++) {
    const q = Q.questionOf(t, 3, seeded(s * 5 + t.length));
    assert.equal(q.topic, t); assert.equal(q.level, 3);
    checkPicture(q, t + ' #' + s);
  }
  // the older board questions name a topic too
  assert.equal(Q.topicOf(Q.reachQuestion(5, 3, seeded(1))), 'reach');
  assert.equal(Q.topicOf(Q.bayQuestion(3, 4, 0, seeded(1))), 'hyp');
});

test('questions come about 8 times over a whole tower, twins or no twins', () => {
  // a build: hand nails, each followed by some twins; count the questions the page would ask
  const run = (hand, twinsEach) => { let h = 0, b = 0, n = 0; for (let i = 0; i < hand; i++) { h++; b++; if (Q.questionDue(h, b)) { n++; h = 0; b = 0; } b += twinsEach; } return n; };
  for (const hand of [12, 16, 20]) { const n = run(hand, 3); assert.ok(n >= hand / 2 - 1 && n <= hand / 2, `${hand} hand nails with twins: ${n}`); }
  assert.equal(run(16, 3), 8);
  assert.equal(run(16, 1), 8);
  const solo = run(34, 0); assert.ok(solo >= 10 && solo <= 12, `every board by hand: ${solo}`);   // 28 boards and the 6 earned
  assert.equal(run(1, 3), 0);   // never on the very first board
});

test('the ladder climbs after two right in a row, drops after a wrong answer, stays between 1 and 6', () => {
  let s = Q.freshLadder();
  assert.deepEqual(s, { level: 1, streak: 0 });
  s = Q.stepLadder(s, true); assert.deepEqual(s, { level: 1, streak: 1 });
  s = Q.stepLadder(s, true); assert.deepEqual(s, { level: 2, streak: 0 });
  s = Q.stepLadder(s, true); s = Q.stepLadder(s, false); assert.deepEqual(s, { level: 1, streak: 0 });   // a wrong one breaks the run and drops a step
  s = Q.stepLadder(s, false); assert.equal(s.level, 1);
  for (let i = 0; i < 30; i++) s = Q.stepLadder(s, true);
  assert.equal(s.level, Q.LADDER_TOP); assert.equal(Q.LADDER_TOP, 7);
  s = Q.stepLadder(s, false); assert.equal(s.level, 6);
  // read back from storage: good, broken, empty
  assert.deepEqual(Q.readLadder(JSON.stringify({ level: 4, streak: 1 })), { level: 4, streak: 1 });
  for (const bad of [null, '', '{', '{"level":8}', '{"level":0}', '"x"']) assert.deepEqual(Q.readLadder(bad), Q.freshLadder());
});

test('the spare boards: at most 6 for a tower, a wrong answer uses none', () => {
  assert.equal(Q.BONUS_MAX, 6);
  // a build that answers every question, some wrong: the count stops at 6 (earnsBoard is the page's rule)
  let earned = 0;
  for (const right of [true, false, true, true, false, true, true, true, true, true]) if (Q.earnsBoard(earned, right)) earned++;
  assert.equal(Q.earnsBoard(3, false), false); assert.equal(Q.earnsBoard(5, true), true); assert.equal(Q.earnsBoard(6, true), false);
  assert.equal(earned, 6);
});
