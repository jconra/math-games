// Tests for src/math/shares.js ("Loot the gang": fair shares and leftovers when the gang's stolen goods go back).
// Run with:  node --test bandit-math/tests/shares.test.mjs   (SEED_OFFSET=1000 for another seed set)
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShares, makeShare, picture, LADDER, KINDS, FAMILIES, GOODS, seeded as seededAt,
  CLEAN_TO_CLIMB, MISS_DOWN, PLACEMENT_MISSES, PLACE_BELOW } from '../src/math/shares.js';

const OFFSET = Number(process.env.SEED_OFFSET) || 0;
const seeded = (seed) => seededAt(seed + OFFSET);

// every kind at every step, a few hundred times
function* everyShare(per = 80, seed = 1) {
  for (let step = 1; step <= LADDER.length; step++) for (const kind of KINDS) {
    const r = seeded(seed + step * 10 + KINDS.indexOf(kind));
    for (let i = 0; i < per; i++) yield makeShare(kind, { rand: r, step, avoid: i % 3 ? [] : ['the Pikes', 'the Vegas'] });
  }
}
const n0 = (c) => Number(String(c.v).split('/')[0]);

test('the ladder: fair shares, then leftovers, then what to do with the leftover, then shares by a rule', () => {
  const firsts = LADDER.map((L) => Object.entries(L.mix).sort((a, b) => b[1] - a[1])[0][0]);
  assert.deepEqual(firsts, ['even', 'even', 'rem', 'rem', 'leftover', 'rule', 'rule3']);
  assert.equal(LADDER[0].coins, 3);
  assert.deepEqual([CLEAN_TO_CLIMB, MISS_DOWN, PLACEMENT_MISSES, PLACE_BELOW], [3, 1, 2, 1]);
  for (const L of LADDER) for (const k of Object.keys(L.mix)) assert.ok(KINDS.includes(k));
});

test('every problem: the sum works, one right coin, wrong coins are named real slips with a why, no repeats', () => {
  let n = 0;
  for (const p of everyShare()) {
    n++;
    assert.equal(p.coins.length, LADDER[p.step - 1].coins, `${p.kind}: coins`);
    assert.equal(p.coins.filter((c) => c.good).length, 1);
    assert.equal(new Set(p.coins.map((c) => c.v)).size, p.coins.length, 'no coin twice');
    assert.equal(new Set(p.coins.map((c) => `${c.big}|${c.small}`)).size, p.coins.length, 'no two coins read the same');
    const right = p.coins.find((c) => c.good);
    // the arithmetic of the right coin
    if (p.kind === 'even') { assert.equal(p.total, p.groups * p.each); assert.equal(p.left, 0); assert.equal(n0(right), p.each); }
    if (p.kind === 'rem') { assert.equal(p.total, p.groups * p.each + p.left); assert.ok(p.left >= 1 && p.left < p.groups); assert.equal(right.v, `${p.each}/${p.left}`); }
    if (p.kind === 'leftover') {
      if (/church/.test(p.ask)) { assert.equal(n0(right), p.total % p.groups); assert.equal(p.church, p.left); }
      else if (/trips/.test(p.ask)) assert.equal(n0(right), Math.ceil(p.total / p.groups));
      else assert.equal(n0(right), Math.floor(p.total / p.groups));
    }
    if (p.kind === 'rule' || p.kind === 'rule3') {
      const got = p.hand.reduce((a, h) => a + h.gets, 0);
      assert.equal(got, p.total, 'every one of them goes back');
      assert.ok(p.hand.some((h) => h.gets === n0(right) && p.ask.includes(h.family.name)), 'the right coin is what the family asked about gets');
    }
    // what goes back adds up: every family's share and the church box
    if (p.kind === 'even' || p.kind === 'rem' || (p.kind === 'leftover' && /church/.test(p.ask))) assert.equal(p.hand.reduce((a, h) => a + h.gets, 0) + p.church, p.total);
    for (const c of p.coins) {
      assert.ok(n0(c) >= 0 && Number.isInteger(n0(c)), `${p.kind}: ${c.label}`);
      assert.ok(c.big && c.small && c.label, 'two lines and words');
      assert.ok(String(c.big).length <= 4, `${c.big} fits on a coin`);
      if (!c.good) { assert.ok(c.slip && c.why && c.why.length > 20 && c.why.length < 200, `${p.kind}: ${c.label}: ${c.why}`); }
    }
    // the small words never tell the right coin apart (but a leftover coin says its own leftover)
    if (p.kind !== 'rem') assert.equal(new Set(p.coins.map((c) => c.small)).size, 1, `${p.kind}: ${p.coins.map((c) => c.small)}`);
    else for (const c of p.coins) assert.match(c.small, /^each, (none|\d+) left$/);
    // the people: real families, none twice, no family asked to avoid (when there's room)
    assert.equal(new Set(p.owners.map((f) => f.name)).size, p.owners.length);
    for (const f of p.owners) assert.ok(FAMILIES.includes(f) && f.look && f.rep);
    assert.ok(p.owners.length <= 6, 'at most six families come to the sheriff\'s');
    assert.ok(p.story.length < 260 && p.ask.endsWith('?'));
  }
  assert.ok(n > 2500);
});

test('the slips the owner named are there: multiplied, the leftover forgotten, the leftover given to the wrong place', () => {
  const seen = {};
  for (const p of everyShare(60, 7)) for (const c of p.coins) if (!c.good) (seen[p.kind] ||= new Set()).add(c.slip);
  for (const s of ['mult', 'over', 'under']) assert.ok(seen.even.has(s), `even: ${s}`);
  for (const s of ['noRem', 'short', 'over']) assert.ok(seen.rem.has(s), `rem: ${s}`);
  for (const s of ['each', 'noRem', 'roundDown', 'roundUp']) assert.ok(seen.leftover.has(s), `leftover: ${s}`);
  for (const s of ['even', 'onePart']) assert.ok(seen.rule.has(s) && seen.rule3.has(s), `rule: ${s}`);
  // the owner's example: 23 silver dollars, 4 families
  let ex = null;
  const r = seeded(2);
  for (let i = 0; i < 20000 && !ex; i++) { const p = makeShare('rem', { rand: r, step: 3 }); if (p.total === 23 && p.groups === 4) ex = p; }
  assert.ok(ex, 'the example comes up');
  assert.equal(ex.coins.find((c) => c.good).label, '5 each, 3 left over');
  const forgot = ex.coins.find((c) => c.slip === 'noRem');
  if (forgot) assert.match(forgot.why, /left over/);
});

test('the picture never shows the answer (only numbers the story already gives)', () => {
  for (const p of everyShare(50, 3)) {
    const pic = picture(p.pic);
    assert.ok(pic.svg.startsWith('<svg') && pic.title && pic.line, `${p.kind} has a picture`);
    const right = p.coins.find((c) => c.good), ans = [n0(right), ...(p.kind === 'rem' ? [p.left] : [])];
    const given = new Set([p.total, p.groups, ...(p.pic.rows ? p.pic.rows.map((r) => r.parts) : []), p.pic.rows ? p.pic.rows.reduce((a, r) => a + r.parts, 0) : -1]);
    const shown = [...pic.svg.matchAll(/>([^<]*)</g)].map((m) => m[1]).join(' ') + ' ' + pic.line;
    for (const a of ans) {
      if (given.has(a)) continue;
      assert.ok(!new RegExp(`(^|[^0-9])${a}([^0-9]|$)`).test(shown), `${p.kind} "${p.ask}" picture shows ${a}: ${shown}`);
    }
    // the dealing: one in each family's place (the first round), never a full share
    if (p.pic.kind === 'deal') assert.ok(p.each >= 2, 'each family gets more than the first round');
  }
});

test('climbing: 3 right first time up, a miss down, the first visit climbs and forgives one slip; peeking is free', () => {
  const Q = makeShares({}, { rand: seeded(5) });
  const right = (o = {}) => { const p = Q.next(); return Q.answer(p, p.coins.findIndex((c) => c.good), o); };
  const wrong = () => { const p = Q.next(); return Q.answer(p, p.coins.findIndex((c) => !c.good)); };
  right(); right();
  assert.equal(Q.level().step, 3); assert.equal(Q.level().placing, true);
  wrong(); assert.equal(Q.level().placing, true, 'one slip forgiven');
  right(); wrong();
  assert.equal(Q.level().placing, false); assert.equal(Q.level().step, 3, 'settles one below');
  right({ helped: true }); right({ helped: true }); right({ helped: true });
  assert.equal(Q.level().step, 3, 'a peek before the pick doesn\'t climb');
  right(); right(); const up = right();
  assert.equal(up.moved, 1); assert.equal(Q.level().step, 4);
  const p = Q.next(); Q.answer(p, p.coins.findIndex((c) => !c.good));
  assert.equal(Q.level().step, 3);
  const again = Q.answer(p, p.coins.findIndex((c) => c.good));
  assert.equal(again.first, false, 'only the first pick counts');
  // the missed kind comes back within 2 to 4 problems
  const kinds = []; for (let i = 0; i < 4; i++) kinds.push(Q.next().kind);
  assert.ok(kinds.includes(p.kind));
});

test('the state saves as plain JSON; a damaged one is mended', () => {
  const S = {};
  const Q = makeShares(S, { rand: seeded(9) });
  Q.answer(Q.next(), 0);
  const copy = JSON.parse(JSON.stringify(S));
  assert.equal(makeShares(copy).level().step, Q.level().step);
  const bad = makeShares({ step: 99, due: [null, { kind: 'zz', at: 1 }], recent: 'x' });
  assert.equal(bad.level().step, LADDER.length);
  assert.ok(bad.next().coins.length >= 3);
});

test('goods and families: plain western things, the families each with someone to come for them', () => {
  assert.ok(GOODS.length >= 6 && GOODS.some((g) => g[2]));
  assert.ok(FAMILIES.length >= 10);
  for (const f of FAMILIES) { assert.match(f.name, /^the /); assert.ok(f.look.outfit); assert.notEqual(f.look.palette, 'outlaw'); }
});

// Counting the loads drawn must not give the answer either: the picture draws one full load, a dashed gap and the last
// part-full one (3 boxes), and every trips problem has 3 full loads or more, every boxes problem 4 or more.
test('the loads picture: counting the boxes drawn never comes to the answer', () => {
  let n = 0;
  for (const p of everyShare(60, 5)) {
    if (p.pic.kind !== 'loads') continue;
    n++;
    const full = Math.floor(p.total / p.pic.per), ans = n0(p.coins.find((c) => c.good));
    assert.ok(full >= (p.pic.need ? 3 : 4), `${p.ask} ${p.total} in loads of ${p.pic.per}: enough full loads`);
    const svg = picture(p.pic).svg, row = [...svg.matchAll(/<rect [^>]*y="62"[^>]*>/g)].map((m) => m[0]);
    const solid = row.filter((r) => !r.includes('stroke-dasharray'));
    assert.equal(solid.length, 2, 'one full load and the last part-full one');
    for (const count of [row.length, solid.length, solid.length - 1, row.length - 1]) assert.notEqual(count, ans, `${p.ask} (${p.total}, ${p.pic.per} a load): ${count} boxes drawn is the answer`);
  }
  assert.ok(n > 100, `loads pictures checked: ${n}`);
});

test('the words on the slip read right: the pile counts what is still in it; plural families take a bare apostrophe', () => {
  for (const p of everyShare(30, 9)) {
    const pic = picture(p.pic);
    if (p.pic.kind === 'deal') assert.match(pic.svg, new RegExp(`${p.total} [a-z ]+: one each dealt, ${p.total - p.groups} still in the pile`));
    for (const c of p.coins) assert.ok(!/s's\b/.test(c.why), `"${c.why}"`);
  }
});
