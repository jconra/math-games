// The store's level arrows deal a new order at the new level (src/missions/store.js J.relevel). The game's maker: "level
// changing should give questions for the new level". It used to refuse any order marked `fixed`, meant for a rig's order,
// but the word problems' trainer marks every story slip made at a level step fixed (its own meaning: the step was chosen
// for it), so the arrows dealt nothing new at the story levels. store.js needs three.js, so its guard is read as text.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PLACE, storeOrder } from '../src/levels/place/store.js';
import { makeWordProblems } from '../src/math/wordproblems.js';

const src = fs.readFileSync(new URL('../src/missions/store.js', import.meta.url), 'utf8');
const body = (name) => { const a = src.indexOf(`J.${name} = () => {`); return src.slice(a, src.indexOf('\n  };', a)); };

test('the counter\'s story slips come out marked fixed by the trainer, so `fixed` can\'t mean "a rig\'s order"', () => {
  const Q = makeWordProblems({ rider: { skill: {} } });
  const fixed = [];
  for (const L of PLACE.levels) for (const ask of L.gen.mix) {
    const o = storeOrder(ask, { who: { name: 'Ann' }, trainer: Q, longMost: L.grade, frac: 0 });
    if (o && o.fixed) fixed.push(`${L.id}:${ask.maker}`);
  }
  assert.ok(fixed.length > 0, 'level-made story slips carry fixed: true');
  assert.ok(fixed.some((k) => k.startsWith(PLACE.levels[0].id + ':')), 'from the very first level (the picture stories)');
});

test('the arrows deal again for every order but a rig\'s own (forced), a wrong coin already tried included', () => {
  const g = body('relevel');
  assert.ok(g.includes('order.forced'), 'a rig\'s order stays as it is');
  assert.ok(!/order\.fixed/.test(g), 'not held back by the trainer\'s fixed');
  assert.ok(!/order\.picked/.test(g), 'a wrong coin tried doesn\'t hold it back');
  assert.ok(g.includes('serve(c)'), 'the same customer brings the new order');
  // a rig's orders are the ones marked forced (both kinds of them)
  const deal = src.slice(src.indexOf('function deal(who)'), src.indexOf('const ask = pickAsk('));
  assert.equal((deal.match(/forced: true/g) || []).length, 2);
});
