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
