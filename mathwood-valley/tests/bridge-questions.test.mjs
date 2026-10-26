// The bridge lab's questions (labs/bridge/questions.js): the windmill's geometry ladder with the bridge's own step on top,
// a truss panel's diagonal. Every answer right, done in your head (whole numbers or a half), the choices four different
// buttons with the answer among them, a lesson to teach it; the ladder climbing to step 8 and starting where the windmill
// left off.
// node --test tests/bridge-questions.test.mjs   (from mathwood-valley)
import test from 'node:test';
import assert from 'node:assert/strict';

const Q = await import('../labs/bridge/questions.js');
// a repeatable random number maker
const rng = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

test('a panel\'s diagonal: the long side of a right triangle, every answer right', () => {
  const r = rng(7);
  for (let i = 0; i < 200; i++) {
    const q = Q.panelQ(r), { w, h, d, ask } = q.geo;
    assert.ok(Math.abs(Math.hypot(w, h) - d) < 1e-9, `${w} by ${h} makes ${d}`);
    assert.equal(q.answer, ask === 'diag' ? d : h);
    assert.ok(Number.isInteger(q.answer * 2), 'a whole number or a half');
    assert.equal(new Set(q.choices).size, q.choices.length, 'no two buttons alike');
    assert.ok(q.choices.includes(q.answer) && q.choices.length === 4);
    assert.equal(q.labels.length, 4);
    assert.ok(q.rule && q.steps.length >= 3 && q.svg.startsWith('<svg') && q.lessonPic, 'a lesson to teach it');
    assert.equal(q.topic, 'panel'); assert.equal(Q.topicOf(q), 'panel');
  }
  // the one the bridge is known for: a panel 8 feet long and 6 feet tall has a 10 foot diagonal (longer than a board)
  let found = null; const r2 = rng(3);
  for (let i = 0; i < 400 && !found; i++) { const q = Q.panelQ(r2, 'diag'); if (q.geo.w === 8 && q.geo.h === 6) found = q; }
  assert.ok(found && found.answer === 10 && /longer than an 8 foot board/.test(found.why));
});

test('the ladder: eight steps, the panel at the top half the time, the windmill\'s below', () => {
  const r = rng(11);
  let panels = 0;
  for (let i = 0; i < 100; i++) { const q = Q.ladderQuestion(8, r); assert.equal(q.level, 8); if (q.kind === 'panel') panels++; }
  assert.ok(panels > 25 && panels < 75, `${panels} of 100 at the top were panels`);
  for (let L = 1; L <= 7; L++) { const q = Q.ladderQuestion(L, r); assert.equal(q.level, L); assert.notEqual(q.kind, 'panel'); }
  assert.deepEqual(Q.stepLadder({ level: 7, streak: 1 }, true), { level: 8, streak: 0 });
  assert.deepEqual(Q.stepLadder({ level: 8, streak: 1 }, true), { level: 8, streak: 0 }, 'no step past the top');
  assert.deepEqual(Q.stepLadder({ level: 8, streak: 1 }, false), { level: 7, streak: 0 });
  assert.equal(Q.questionOf('panel', 8).kind, 'panel');
  assert.equal(Q.questionOf('tri-sum', 5).topic, 'tri-sum');
});

test('a fresh bridge ladder starts where the windmill\'s left off; its own, once saved, wins', () => {
  assert.deepEqual(Q.readLadder(null, JSON.stringify({ level: 5, streak: 1 })), { level: 5, streak: 0 });
  assert.deepEqual(Q.readLadder(JSON.stringify({ level: 8, streak: 1 }), JSON.stringify({ level: 2, streak: 0 })), { level: 8, streak: 1 });
  assert.deepEqual(Q.readLadder('nonsense'), { level: 1, streak: 0 });
  assert.notEqual(Q.LADDER_KEY, Q.WINDMILL_KEY, 'its own key: the windmill\'s seven steps never read an eight');
  assert.equal(Q.BONUS_MAX, 6, 'the spare boards a bridge can earn, as the windmill');
});
