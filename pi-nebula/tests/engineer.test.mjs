// The engineer's questions (src/jobs/engineer.js) and their display (src/jobs/engview.js): the fuel pellets in the
// Miner's core and the containment field round them. The game's maker (2026-11-19): "I like the idea of the engineering
// covering questions about volume, area, and edges. I imagine something like a display with some kind of cube
// configuration (depending on the level). So a basic level could just show a 2d box and ask what its height is and what
// its length is. The levels would progress through area and volume. The high levels could show a cluster of cubes (the
// more, the harder) in 3d that can spin around. The questions can claim that the cubes are fuel pellets that need a
// containment field or something."
// Every level makes questions over many seeds; the right answer is worked out again here from the shape's own cubes
// (counting them, the box round them, the faces and sides on the outside, the box's 12 edges) by code that shares
// nothing with the maker's; the wrong answers are slips with their whys; a cluster is one piece with nothing sealed in
// it and grows with the level; and the display paints a shape in 3D as the eye would see it.
//   node --test pi-nebula/tests/engineer.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import { JOB, PLACE, MAKERS, CLUSTER, makeCluster, boxCells } from '../src/jobs/engineer.js';
import { shapeSvg, listOf, camera, seenFrom, is3d, VIEW, START, TURN } from '../src/jobs/engview.js';
import { helpPicture } from '../src/jobs/pics.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';
import { PROBLEMS, PLACE as PLACES } from '../../mathwood-valley/src/levels/places.js';
import { setLevelAt } from '../../mathwood-valley/src/levels/model.js';
import { STRANDS, STRAND } from '../../mathwood-valley/src/math/strands.js';
import { answerOf } from '../../mathwood-valley/src/math/jobsums.js';

const SEEDS = 150;
const crewOf = () => ({ id: 'c1', name: 'Test', look: { id: 'zuri' } });
const dealAt = (id, rand) => { const crew = crewOf(); setLevelAt(crew, 'engineer', id); return E.deal(crew, JOB, { rand }); };
// (the game's maker, 2026-11-19: "About one question in three from the level below, as the drill and the pilot do." So a
// level deals its own kind of question or the kind of the level below; `ownOf` says whose kind a card is.)
const ownOf = (order) => PLACE.levels.find((L) => KIND_OF[L.id] === order.facts.kind);
// a card of the level's own kind (never the look back at the level below)
const dealOwn = (id, rand) => { for (let k = 0; k < 60; k++) { const q = dealAt(id, rand); if (ownOf(q.order).id === id) return q; } throw new Error(`${id}: never its own kind`); };
// every level, many questions of each: fn(order, the level whose kind of question it is, question, the level it was dealt at)
function everyQuestion(fn, n = SEEDS) {
  for (const [i, L] of PLACE.levels.entries()) {
    const rand = seeded(1000 + L.id.length * 131 + L.grade);
    for (let k = 0; k < n; k++) {
      const q = dealAt(L.id, rand), own = ownOf(q.order);
      assert.ok(own === L || (i > 0 && own === PLACE.levels[i - 1]), `${L.id}: a card of ${own && own.id}`);
      fn(q.order, own, q, L);
    }
  }
}
const rightOf = (o) => o.coins.find((c) => c.good);

// ── the shape's own numbers, worked out here from its cubes alone ───────────────────────────────────────────────────
const key = (c) => c.join(',');
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const plus = (a, b) => a.map((v, i) => v + b[i]);
// the box round the cubes: how many it is along each direction
const boxOf = (cells) => cells[0].map((_, a) => Math.max(...cells.map((c) => c[a])) - Math.min(...cells.map((c) => c[a])) + 1);
// a flat shape's way round: every side of a square with no square of the shape beyond it
const rimOf = (cells) => { const set = new Set(cells.map(key)); let n = 0; for (const c of cells) for (const d of N4) if (!set.has(key(plus(c, d)))) n++; return n; };
// the empty places round a shape that are reached from outside its box (one place past the box each way)
function outsideAir(cells) {
  const set = new Set(cells.map(key)), lo = cells[0].map((_, a) => Math.min(...cells.map((c) => c[a])) - 1), hi = cells[0].map((_, a) => Math.max(...cells.map((c) => c[a])) + 1);
  const air = new Set([key(lo)]), todo = [lo];
  while (todo.length) { const c = todo.pop(); for (const d of N6) { const p = plus(c, d), k = key(p); if (p.every((v, a) => v >= lo[a] && v <= hi[a]) && !set.has(k) && !air.has(k)) { air.add(k); todo.push(p); } } }
  return { air, all: (hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) };
}
// the faces that show on the outside: a cube's face with outside air against it
const skinOf = (cells) => { const { air } = outsideAir(cells); let n = 0; for (const c of cells) for (const d of N6) if (air.has(key(plus(c, d)))) n++; return n; };
// the 12 edges of the box round the cubes, from its 8 corners: every pair of corners that differ along one direction only
function edgesOf(cells) {
  const b = boxOf(cells), corners = []; let sum = 0, n = 0;
  for (const x of [0, b[0]]) for (const y of [0, b[1]]) for (const z of [0, b[2]]) corners.push([x, y, z]);
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) { const d = corners[i].map((v, a) => Math.abs(v - corners[j][a])); if (d.filter((v) => v > 0).length === 1) { sum += d[0] + d[1] + d[2]; n++; } }
  assert.equal(n, 12);
  return sum;
}
function onePiece(cells) {
  const set = new Set(cells.map(key)), seen = new Set([key(cells[0])]), todo = [cells[0]], dirs = cells[0].length === 2 ? N4 : N6;
  while (todo.length) { const c = todo.pop(); for (const d of dirs) { const p = plus(c, d), k = key(p); if (set.has(k) && !seen.has(k)) { seen.add(k); todo.push(p); } } }
  return seen.size === cells.length;
}
const isFullBox = (cells) => cells.length === boxOf(cells).reduce((a, b) => a * b, 1) && new Set(cells.map(key)).size === cells.length;
// what each kind of card's right answer must be, from its shape's cubes ([x, y] flat; [x, y, z] with y up, z its width)
const TRUE = {
  sides: (f, c) => (f.ask === 'l' ? boxOf(c)[0] : boxOf(c)[1]),
  round: (f, c) => rimOf(c),
  fill: (f, c) => c.length,
  area: (f, c) => c.length,
  side: (f, c) => (f.ask === 'l' ? boxOf(c)[0] : boxOf(c)[1]),
  bend: (f, c) => c.length,
  block: (f, c) => c.length,
  volume: (f, c) => c.length,
  high: (f, c) => boxOf(c)[1],
  frame: (f, c) => edgesOf(c),
  skin: (f, c) => skinOf(c),
  count: (f, c) => c.length,
  fieldBox: (f, c) => boxOf(c).reduce((a, b) => a * b, 1),
  empty: (f, c) => boxOf(c).reduce((a, b) => a * b, 1) - c.length,
  clusterSkin: (f, c) => skinOf(c),
};
const KIND_OF = { sides: 'sides', round: 'round', fill: 'fill', area: 'area', areaSide: 'side', bend: 'bend', block: 'block', volume: 'volume', volSide: 'high', frame: 'frame', skin: 'skin', cluster: 'count', fieldBox: 'fieldBox', empty: 'empty', clusterSkin: 'clusterSkin' };
const CLUSTER_LEVELS = ['cluster', 'fieldBox', 'empty', 'clusterSkin'];

test('the engineer\'s ladder joins Mathwood\'s levels cleanly: fifteen levels, easiest first, counted as geometry, no new kind of math', () => {
  const before = STRANDS.length;
  assert.equal(E.register(JOB), true);
  assert.deepEqual(PROBLEMS, []);
  const P = PLACES.engineer; assert.ok(P && P === PLACE);
  assert.equal(P.levels.length, 15); assert.equal(new Set(P.levels.map((L) => L.id)).size, 15);
  assert.deepEqual(P.levels.map((L) => L.id), Object.keys(KIND_OF));
  for (let i = 1; i < P.levels.length; i++) assert.ok(P.levels[i].grade > P.levels[i - 1].grade, `${P.levels[i].id}: ${P.levels[i].grade} after ${P.levels[i - 1].grade}`);
  for (const [i, L] of P.levels.entries()) {
    assert.equal(L.strand, 'geo', L.id); assert.ok(L.title && L.line);
    // its own kind of question twice for every once of the level below's (the youngest level has none below it)
    const mix = L.gen.mix, below = i ? P.levels[i - 1].gen.mix[0] : null;
    assert.equal(mix.length, i ? 2 : 1, L.id); assert.equal(mix[0].w, i ? 2 : 1, L.id);
    if (i) assert.deepEqual([mix[1].maker, mix[1].step, mix[1].w], [below.maker, below.step, 1], `${L.id}: looks back at ${P.levels[i - 1].id}`);
  }
  // nothing added to Mathwood's kinds of math: geometry was there already, and the list is as long as it was
  assert.ok(STRAND.geo); assert.equal(STRANDS.length, before);
  // Mathwood's own places are all still there
  for (const id of ['roundup', 'store', 'lockbox', 'sheep']) assert.ok(PLACES[id], id);
  // the job is not one of the station's spots, and its pictures are dark
  assert.equal(JOB.spot, null); assert.equal(JOB.dark, true); assert.equal(JOB.place, PLACE); assert.equal(JOB.makers, MAKERS);
});

test('every level\'s right answer is true of the shape shown, worked out again from its cubes', () => {
  const seen = {};
  everyQuestion((o, L) => {
    const f = o.facts, S = f.shape, kind = KIND_OF[L.id];
    assert.equal(f.kind, kind, L.id); assert.ok(TRUE[kind], kind);
    assert.ok(S && Array.isArray(S.cells) && S.cells.length >= 1, `${L.id}: the shape's cubes`);
    assert.equal(new Set(S.cells.map(key)).size, S.cells.length, `${L.id}: a cube twice`);
    assert.ok(S.cells.every((c) => c.length === (S.kind === 'flat' ? 2 : 3) && c.every((v) => Number.isInteger(v) && v >= 0)), `${L.id}: whole places from 0`);
    assert.ok(onePiece(S.cells), `${L.id}: in one piece`);
    const right = rightOf(o), want = TRUE[kind](f, S.cells);
    assert.equal(right.v, want, `${L.id}: ${o.story} ${o.ask} -> ${right.label}, the cubes say ${want}`);
    assert.equal(f.ans, want, L.id); assert.ok(want >= 1);
    // the shape's own size is the size it says: its box, from the cubes
    const b = boxOf(S.cells);
    if (S.kind === 'flat') assert.deepEqual([S.l, S.h], b, L.id); else assert.deepEqual([S.l, S.h, S.w], b, L.id);
    // which shape goes with which kind of card
    if (['sides', 'round', 'fill', 'area', 'side'].includes(kind)) { assert.equal(S.kind, 'flat'); assert.ok(isFullBox(S.cells), `${L.id}: a whole flat box`); }
    if (kind === 'bend') { assert.equal(S.kind, 'flat'); assert.ok(!isFullBox(S.cells), 'an L-shape is not a box'); assert.equal(rimOf(S.cells), 2 * (b[0] + b[1]), 'a corner cut out of a box: the way round is the box\'s'); }
    if (kind === 'block') { assert.equal(S.kind, 'block'); assert.ok(isFullBox(S.cells)); }
    if (['volume', 'high', 'frame', 'skin'].includes(kind)) { assert.equal(S.kind, 'box'); assert.ok(isFullBox(S.cells)); assert.equal(S.pellets, false); assert.equal(S.field, true); }
    if (CLUSTER_LEVELS.includes(L.id)) { assert.equal(S.kind, 'cluster'); assert.equal(S.pellets, true); assert.equal(S.field, L.id === 'fieldBox' || L.id === 'empty', `${L.id}: the field is drawn where the question is about it`); }
    // the card's own sum, where it has one, comes to the right answer
    if (o.sum) { const steps = o.sum.chain || [o.sum]; assert.equal(answerOf(steps[steps.length - 1]), want, `${L.id}: its sum`); }
    (seen[L.id] ||= new Set()).add(want);
  });
  // (a level is not one question over and over)
  for (const L of PLACE.levels) assert.ok(seen[L.id].size >= 4, `${L.id}: ${seen[L.id].size} different answers`);
});

test('every wrong answer is a slip with its own plain line why; four answers (three for the youngest), all different', () => {
  const slips = {};
  everyQuestion((o, L) => {
    const right = rightOf(o);
    assert.equal(o.coins.filter((c) => c.good).length, 1, `${L.id}: ${o.story}`);
    assert.equal(o.coins.length, L.id === 'sides' ? 3 : 4, `${L.id}: ${o.coins.map((c) => c.label)}`);
    assert.equal(new Set(o.coins.map((c) => c.v)).size, o.coins.length, `${L.id}: two answers alike: ${o.coins.map((c) => c.label)}`);
    assert.equal(new Set(o.coins.map((c) => c.label)).size, o.coins.length);
    for (const c of o.coins) {
      assert.ok(Number.isInteger(c.v) && c.v > 0, `${L.id}: ${c.label}`);
      assert.equal(c.big, String(c.v)); assert.ok(c.small);
      // (no key number is part of an answer: its face is its number and its unit, nothing else)
      assert.equal(c.label, `${c.big} ${c.small}`);
      if (c.good) { assert.equal(c.why, ''); continue; }
      assert.notEqual(c.v, right.v);
      assert.ok(c.slip && typeof c.slip === 'string', `${L.id}: a wrong answer with no slip named: ${c.label}`);
      assert.ok(c.why && c.why.length >= 20 && c.why.length <= 150 && /[.:?]$/.test(c.why), `${L.id}: ${c.label}: "${c.why}"`);
      ((slips[L.id] ||= {})[c.slip] ||= new Set()).add(c.why.replace(/\d+/g, '#'));
    }
    const text = `${o.story} ${o.ask} ${o.coins.map((c) => `${c.label} ${c.why}`).join(' ')} ${o.rightWhy} ${o.help.title} ${o.help.line} ${(o.help.steps || []).join(' ')}`;
    assert.ok(!/NaN|undefined|Infinity|\[object|null/.test(text), `${L.id}: ${text}`);
    assert.ok(o.rightWhy && o.rightWhy.includes(String(right.v)), `${L.id}: ${o.rightWhy}`);
  });
  // every level has more than plain miscounts to offer: at least two slips of its own that are not "one off"
  for (const L of PLACE.levels) { const named = Object.keys(slips[L.id]).filter((s) => s !== 'off'); assert.ok(named.length >= 2, `${L.id}: ${Object.keys(slips[L.id])}`); }
  // the slips the ladder was asked to have, each met where it belongs
  assert.ok(slips.round.edgePellets && slips.round.twoSides && slips.round.inside);
  assert.ok(slips.fill.added && slips.fill.edgeOnly);
  assert.ok(slips.area.added && slips.area.round);
  assert.ok(slips.bend.wholeBox && slips.bend.onePart && slips.bend.twice);
  assert.ok(slips.block.oneLayer && slips.block.seenOnly);
  assert.ok(slips.volume.added && slips.volume.oneLayer && slips.volume.skin);
  assert.ok(slips.frame.oneEach && slips.frame.twoEach && slips.frame.noUprights);
  assert.ok(slips.skin.onePair && slips.skin.volume);
  assert.ok(slips.cluster.seenOnly && slips.cluster.tops);
  assert.ok(slips.fieldBox.pelletsOnly && slips.empty.wholeBox && slips.empty.pellets);
  assert.ok(slips.clusterSkin.threeSides && slips.clusterSkin.everyFace && slips.clusterSkin.noBottom);
});

test('a slip\'s number is the slip it is said to be', () => {
  everyQuestion((o, L) => {
    const f = o.facts, S = f.shape, c = S.cells, by = Object.fromEntries(o.coins.filter((x) => !x.good).map((x) => [x.slip, x.v])), b = boxOf(c);
    if (L.id === 'round') { if (by.twoSides != null) assert.equal(by.twoSides, b[0] + b[1]); if (by.inside != null) assert.equal(by.inside, c.length); if (by.edgePellets != null) assert.equal(by.edgePellets, c.filter(([x, y]) => x === 0 || y === 0 || x === b[0] - 1 || y === b[1] - 1).length); }
    if (L.id === 'fill') { if (by.edgeOnly != null) assert.equal(by.edgeOnly, c.filter(([x, y]) => x === 0 || y === 0 || x === b[0] - 1 || y === b[1] - 1).length); if (by.added != null) assert.equal(by.added, b[0] + b[1]); }
    if (L.id === 'area' && by.round != null) assert.equal(by.round, rimOf(c));
    if (L.id === 'bend') { if (by.wholeBox != null) assert.equal(by.wholeBox, b[0] * b[1]); if (by.round != null) assert.equal(by.round, rimOf(c)); }
    if (L.id === 'block') {
      if (by.oneLayer != null) assert.equal(by.oneLayer, c.filter((p) => p[1] === 0).length);
      // the pellets with a face on the top, the front or the right side: what one corner view shows of a block
      if (by.seenOnly != null) assert.equal(by.seenOnly, c.filter((p) => p[0] === b[0] - 1 || p[1] === b[1] - 1 || p[2] === b[2] - 1).length);
    }
    if (L.id === 'volume') { if (by.skin != null) assert.equal(by.skin, skinOf(c)); if (by.oneLayer != null) assert.equal(by.oneLayer, b[0] * b[2]); if (by.added != null) assert.equal(by.added, b[0] + b[1] + b[2]); }
    if (L.id === 'frame') { if (by.volume != null) assert.equal(by.volume, c.length); if (by.oneEach != null) assert.equal(by.oneEach, b[0] + b[1] + b[2]); if (by.twoEach != null) assert.equal(by.twoEach * 2, edgesOf(c)); }
    if (L.id === 'skin') { if (by.volume != null) assert.equal(by.volume, c.length); if (by.frame != null) assert.equal(by.frame, edgesOf(c)); if (by.onePair != null) assert.equal(by.onePair * 2, skinOf(c)); }
    if (L.id === 'cluster') {
      // the pellets that show a face from the side the cluster is first seen from, by the display's own reckoning
      if (by.seenOnly != null) { assert.equal(by.seenOnly, seenFrom(S, S.view.yaw, S.view.pitch).size); assert.ok(by.seenOnly < c.length); }
      if (by.tops != null) assert.equal(by.tops, new Set(c.map((p) => `${p[0]},${p[2]}`)).size);
    }
    if (L.id === 'fieldBox' && by.pelletsOnly != null) assert.equal(by.pelletsOnly, c.length);
    if (L.id === 'empty') { if (by.wholeBox != null) assert.equal(by.wholeBox, b[0] * b[1] * b[2]); if (by.pellets != null) assert.equal(by.pellets, c.length); }
    if (L.id === 'clusterSkin') {
      const skin = skinOf(c), set = new Set(c.map(key)), down = c.filter((p) => !set.has(key([p[0], p[1] - 1, p[2]]))).length;
      if (by.threeSides != null) assert.equal(by.threeSides * 2, skin); if (by.everyFace != null) assert.equal(by.everyFace, 6 * c.length); if (by.noBottom != null) assert.equal(by.noBottom, skin - down);
      if (by.boxSkin != null) assert.equal(by.boxSkin, 2 * (b[0] * b[1] + b[0] * b[2] + b[1] * b[2]));
      // the help's count by the way the faces point: as many up as down, and so for the other two pairs
      assert.equal(2 * (f.up + f.front + f.side), skin); assert.equal(f.up, f.down);
    }
  }, 80);
});

test('the numbers on a card and on its display are the shape\'s own, and a side that is asked for is never written on it', () => {
  everyQuestion((o, L) => {
    const f = o.facts, S = f.shape, b = boxOf(S.cells), marks = S.marks || [], nums = (o.story.match(/\d+/g) || []).map(Number);
    const texts = marks.map((m) => m.text);
    if (L.id === 'area') { assert.deepEqual(nums.slice(0, 2), [b[0], b[1]]); assert.deepEqual(texts, [`${b[0]} cm`, `${b[1]} cm`]); assert.equal(S.pellets, false, 'no pellets to count: the sides are given'); }
    if (L.id === 'areaSide') {
      const given = f.ask === 'h' ? b[0] : b[1];
      assert.deepEqual(nums, [S.cells.length, given]); assert.deepEqual(texts, f.ask === 'h' ? [`${b[0]} cm`, '?'] : ['?', `${b[1]} cm`]);
      assert.ok(!texts.includes(`${f.ans} cm`) || f.ans === given, 'the answer is not on the display'); assert.equal(S.note, `${S.cells.length} sq cm`);
    }
    if (L.id === 'bend') {
      // every side of the L is marked with its own length, and the marks go all the way round it
      assert.equal(marks.length, 6);
      let round = 0;
      for (const m of marks) { const len = Math.abs(m.b[0] - m.a[0]) + Math.abs(m.b[1] - m.a[1]); assert.ok(m.a[0] === m.b[0] || m.a[1] === m.b[1]); assert.equal(m.text, `${len} cm`); round += len; }
      assert.equal(round, rimOf(S.cells));
      assert.deepEqual([f.lower[0] * f.lower[1] + f.upper[0] * f.upper[1]], [S.cells.length]);
    }
    if (L.id === 'round') { assert.deepEqual(texts, ['1 cm'], 'one pellet\'s width is marked: the sides are counted'); assert.equal(S.pellets, true); }
    if (['sides', 'fill', 'block', 'cluster', 'clusterSkin'].includes(L.id)) assert.equal(marks.length, 0, `${L.id}: nothing written on a shape that is counted`);
    if (['volume', 'frame', 'skin'].includes(L.id)) { assert.deepEqual(nums.slice(0, 3), [b[0], b[2], b[1]], `${L.id}: long, wide, high in the story`); assert.deepEqual(marks.map((m) => [m.axis, m.text]), [['l', `${b[0]} cm`], ['w', `${b[2]} cm`], ['h', `${b[1]} cm`]]); }
    if (L.id === 'volSide') { assert.deepEqual(nums, [S.cells.length, b[0], b[2]]); assert.deepEqual(marks.map((m) => [m.axis, m.text]), [['l', `${b[0]} cm`], ['w', `${b[2]} cm`], ['h', '?']]); }
    if (L.id === 'frame') assert.equal(S.frame, true);
    if (L.id === 'skin') assert.equal(S.skin, true);
    // the still picture the card carries is of this very shape, and whole
    assert.ok(o.lead.startsWith('<svg') && o.lead.endsWith('</svg>') && !/NaN|undefined/.test(o.lead), L.id);
    assert.equal(o.lead, shapeSvg(S), `${L.id}: the card's still picture is the display's own of its shape`);
  }, 60);
});

test('help is on every level and just teaches: a picture, one line, the sum with its numbers filled in, and no question before it', () => {
  everyQuestion((o, L) => {
    const h = o.help; assert.ok(h, L.id);
    assert.ok(h.title && h.title.length <= 28, `${L.id}: ${h.title}`); assert.ok(h.line && h.line.length >= 30 && h.line.length <= 200, `${L.id}: ${h.line}`);
    assert.ok(h.svg.startsWith('<svg') && h.svg.endsWith('</svg>') && !/NaN|undefined/.test(h.svg), L.id);
    assert.deepEqual(Object.keys(h).sort().filter((k) => !['line', 'steps', 'svg', 'title'].includes(k)), [], `${L.id}: nothing to answer in the help`);
    // the panel shows it as it is (src/jobs/pics.js)
    const pic = helpPicture(o, { dark: true }); assert.equal(pic.svg, h.svg); assert.equal(pic.title, h.title); assert.equal(pic.line, h.line);
    // the help never says the answer outright: its steps stop at the sum
    const right = rightOf(o);
    for (const s of h.steps || []) assert.ok(!new RegExp(`= ${right.v}\\b`).test(s), `${L.id}: "${s}" gives ${right.v} away`);
    if (!['sides', 'cluster'].includes(L.id)) assert.ok((h.steps || []).length >= 1, `${L.id}: the sum, in steps`);
    if (L.id !== 'sides' && !(L.id === 'cluster' && o.facts.h === 1)) assert.ok(o.sum, `${L.id}: a sum for Work it out on paper`);
  }, 60);
  // the four ways the help was asked to teach, in its own words
  const one = (id) => dealOwn(id, seeded(5)).order.help;
  assert.match(one('area').title, /Rows/); assert.match(one('block').title, /Layer by layer/); assert.match(one('cluster').title, /Layer by layer/);
  assert.match(one('skin').title, /pairs/); assert.match(one('frame').title, /4 \+ 4 \+ 4/); assert.match(one('bend').title, /two boxes/);
});

// ── the clusters ──────────────────────────────────────────────────────────────────────────────────────────────────
// every pellet is the first thing met looking straight in from one of the six sides (so none is sealed inside)
function firstInLine(cells) {
  const set = new Set(cells.map(key)), most = Math.max(...boxOf(cells));
  return cells.every((c) => N6.some((d) => { for (let k = 1; k <= most; k++) if (set.has(key(plus(c, d.map((v) => v * k))))) return false; return true; }));
}
const noHollow = (cells) => { const { air, all } = outsideAir(cells); return air.size === all - cells.length; };

test('a cluster is one piece, has no pellet sealed inside and no hollow, fits its biggest box, and grows with the level', () => {
  const sizes = {};
  for (const id of CLUSTER_LEVELS) {
    const rand = seeded(77 + id.length), B = CLUSTER[CLUSTER_LEVELS.indexOf(id) + 1]; sizes[id] = [];
    for (let k = 0; k < 400; k++) {
      const o = dealOwn(id, rand).order, c = o.facts.shape.cells, set = new Set(c.map(key)), b = boxOf(c);
      assert.ok(onePiece(c), `${id}: in two pieces: ${JSON.stringify(c)}`);
      assert.ok(c.every((p) => N6.some((d) => !set.has(key(plus(p, d))))), `${id}: a pellet with a pellet on all six sides`);
      assert.ok(firstInLine(c), `${id}: a pellet that cannot be seen straight on from any side: ${JSON.stringify(c)}`);
      assert.ok(noHollow(c), `${id}: a hollow closed off inside: ${JSON.stringify(c)}`);
      assert.ok(c.length >= B.n[0] && c.length <= B.n[1], `${id}: ${c.length} pellets`);
      assert.ok(b[0] <= B.max[0] && b[1] <= B.max[1] && b[2] <= B.max[2], `${id}: a box of ${b}`);
      // (with no hollow, every face with no pellet against it is on the outside)
      assert.equal(skinOf(c), c.reduce((n, p) => n + N6.filter((d) => !set.has(key(plus(p, d)))).length, 0));
      if (id === 'fieldBox' || id === 'empty') assert.ok(c.length < b[0] * b[1] * b[2], `${id}: a cluster that fills its box leaves nothing to ask`);
      sizes[id].push(c.length);
    }
  }
  // the more, the harder: from one cluster level to the next the fewest, the most and the usual number of pellets all go up
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  for (let i = 1; i < CLUSTER_LEVELS.length; i++) {
    const a = sizes[CLUSTER_LEVELS[i - 1]], b = sizes[CLUSTER_LEVELS[i]];
    assert.ok(Math.min(...b) > Math.min(...a) && Math.max(...b) > Math.max(...a) && mean(b) > mean(a) + 1, `${CLUSTER_LEVELS[i]}: ${Math.min(...b)}..${Math.max(...b)} after ${Math.min(...a)}..${Math.max(...a)}`);
    assert.ok(CLUSTER[i + 1].n[0] > CLUSTER[i].n[0] && CLUSTER[i + 1].n[1] > CLUSTER[i].n[1]);
  }
  // every size of each band turns up, and the biggest cluster there is has 13 pellets
  for (const id of CLUSTER_LEVELS) { const B = CLUSTER[CLUSTER_LEVELS.indexOf(id) + 1]; for (let n = B.n[0]; n <= B.n[1]; n++) assert.ok(sizes[id].includes(n), `${id}: never ${n} pellets`); }
  assert.equal(Math.max(...Object.values(CLUSTER).map((B) => B.n[1])), 13);
  // the maker by itself, at every size it is asked for, over many seeds
  for (let s = 1; s <= 1500; s++) for (const B of Object.values(CLUSTER)) {
    const rand = seeded(s * 13 + B.n[0]), n = B.n[0] + Math.floor(rand() * (B.n[1] - B.n[0] + 1)), c = makeCluster(rand, n, B.max);
    assert.equal(c.length, n); assert.ok(onePiece(c) && firstInLine(c) && noHollow(c), JSON.stringify(c));
    assert.deepEqual(c[0].map((_, a) => Math.min(...c.map((p) => p[a]))), [0, 0, 0], 'its cubes start from 0 each way');
  }
});

// the sides the display can be turned to: the four round it, level; and from above and from below, as far as it tips
const SIDES = [[0, 0], [Math.PI / 2, 0], [Math.PI, 0], [-Math.PI / 2, 0], ...[0, 1, 2, 3].flatMap((q) => [[q * Math.PI / 2 + 0.3, TURN.most], [q * Math.PI / 2 + 0.3, -TURN.most]])];
test('every pellet of a cluster shows a face from some side the display can be turned to, and some are hidden from the side it starts on', () => {
  let hidden = 0, all = 0;
  for (const id of CLUSTER_LEVELS) {
    const rand = seeded(31 + id.length);
    for (let k = 0; k < 120; k++) {
      const S = dealOwn(id, rand).order.facts.shape, shown = new Set();
      for (const [yaw, pitch] of SIDES) for (const i of seenFrom(S, yaw, pitch)) shown.add(i);
      assert.equal(shown.size, S.cells.length, `${id}: a pellet that shows no face from any side: ${JSON.stringify(S.cells)}`);
      // it starts on one of the four corners it can be seen from, tipped as every shape is
      assert.equal(S.view.pitch, START.pitch); assert.ok([0, 1, 2, 3].some((q) => Math.abs(S.view.yaw - START.yaw - q * Math.PI / 2) < 1e-9));
      const first = seenFrom(S, S.view.yaw, S.view.pitch).size; assert.ok(first >= 1 && first <= S.cells.length);
      // ... the corner that hides the most
      for (let q = 0; q < 4; q++) assert.ok(first <= seenFrom(S, START.yaw + q * Math.PI / 2, START.pitch).size);
      all++; if (first < S.cells.length) hidden++;
    }
  }
  assert.ok(hidden / all > 0.6, `clusters with a pellet hidden at the start: ${hidden} of ${all}`);
});

// ── the display ───────────────────────────────────────────────────────────────────────────────────────────────────
const inPoly = (pts, x, y) => { let inside = false; for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) { const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
const toEdge = (pts, x, y) => { let best = Infinity; for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) { const ax = pts[j], ay = pts[j + 1], bx = pts[i], by = pts[i + 1], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))); best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy)); } return best; };
// WHAT THE EYE MEETS FIRST through one place on the display: a ray from the eye through that place, walked in small
// steps until it is inside a cube. -> { i (which pellet), d (which of its faces the ray came in by) }, null (nothing),
// or 'edge' (it came in by an edge or a corner: too close to call)
function firstMet(S, cam, sx, sy) {
  const set = new Map(S.cells.map((c, i) => [key(c), i])), cols = [cam.rot(1, 0, 0), cam.rot(0, 1, 0), cam.rot(0, 0, 1)];
  const v = [(sx - VIEW.w / 2) / cam.k, (cam.mid - sy) / cam.k, 0], through = cols.map((col, a) => cam.c[a] + col[0] * v[0] + col[1] * v[1] + col[2] * v[2]);
  const dir = through.map((p, a) => p - cam.eye[a]), len = Math.hypot(...dir), step = 0.004;
  let was = null;
  for (let t = cam.D - cam.r - 1; t < cam.D + cam.r + 1; t += step) {
    const p = dir.map((d, a) => cam.eye[a] + d / len * t), cell = p.map(Math.floor);
    if (set.has(key(cell))) {
      if (!was) return 'edge';
      const moved = [0, 1, 2].filter((a) => cell[a] !== was[a]); if (moved.length !== 1) return 'edge';
      const a = moved[0]; return { i: set.get(key(cell)), d: a * 2 + (was[a] > cell[a] ? 0 : 1) };
    }
    was = cell;
  }
  return null;
}
test('the display paints a shape in 3D as the eye sees it: at any place on it, the pellet face on top is the one a ray from the eye meets first', () => {
  const shapes = [];
  for (const id of CLUSTER_LEVELS) { const rand = seeded(9 + id.length); for (let k = 0; k < 6; k++) shapes.push(dealOwn(id, rand).order.facts.shape); }
  shapes.push(dealOwn('block', seeded(3)).order.facts.shape);
  let checked = 0, faces = 0, empty = 0;
  const rand = seeded(2026);
  for (const S of shapes) {
    for (const [yaw, pitch] of [[START.yaw, START.pitch], [1.1, 0.9], [2.6, -0.5], [-2.2, 1.3], [0.02, 0.01], [4.0, -1.4]]) {
      const list = listOf(S, yaw, pitch), cam = camera(S, yaw, pitch), drawn = list.filter((it) => it.k === 'p' && it.i != null);
      assert.ok(drawn.length >= 1);          // (a thin cluster seen end on shows only a face or two)
      for (let n = 0; n < 60; n++) {
        const sx = VIEW.w / 2 + (rand() - 0.5) * 2 * cam.k * (cam.r + 0.3), sy = cam.mid + (rand() - 0.5) * 2 * cam.k * (cam.r + 0.3);
        if (drawn.some((it) => toEdge(it.pts, sx, sy) < 1.2)) continue;          // (on a line between two faces)
        const met = firstMet(S, cam, sx, sy); if (met === 'edge') continue;
        let top = null; for (const it of drawn) if (inPoly(it.pts, sx, sy)) top = it;
        checked++;
        if (!met) { empty++; assert.equal(top, null, `a face painted where the eye sees none (${yaw}, ${pitch})`); continue; }
        faces++;
        assert.ok(top, `nothing painted where the eye sees pellet ${met.i} (${yaw}, ${pitch}) at ${sx}, ${sy}: ${JSON.stringify(S.cells)}`);
        assert.deepEqual([top.i, top.d], [met.i, met.d], `the wrong face on top at ${sx.toFixed(1)}, ${sy.toFixed(1)} (${yaw}, ${pitch}): ${JSON.stringify(S.cells)}`);
      }
    }
  }
  assert.ok(checked > 3000 && faces > 1200 && empty > 300, `${checked} places looked at, ${faces} on a face, ${empty} on none`);
});

test('a shape fits its display at every turn, whatever height the page gives it, and a flat shape shows every pellet once', () => {
  const shapes = PLACE.levels.flatMap((L) => { const rand = seeded(40 + L.grade); return [0, 1, 2, 3].map(() => dealOwn(L.id, rand).order.facts.shape); });
  for (const S of shapes) {
    for (const h of [VIEW.least, 134, 161, VIEW.h, VIEW.most]) {
      const views = is3d(S) ? [0, 0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9, 5.6].flatMap((y) => [-TURN.most, -0.6, 0, START.pitch, 1, TURN.most].map((p) => [y, p])) : [[0, 0]];
      for (const [yaw, pitch] of views) {
        const list = listOf(S, yaw, pitch, { h });
        assert.ok(list.length >= 1);
        for (const it of list) {
          if (it.k === 't') { assert.ok(Number.isFinite(it.x) && Number.isFinite(it.y) && it.x >= 0 && it.x <= VIEW.w && it.y >= 6 && it.y <= h + 1, `${S.kind}: words "${it.s}" at ${it.x}, ${it.y} of ${VIEW.w} by ${h}`); continue; }
          for (let i = 0; i < it.pts.length; i += 2) assert.ok(Number.isFinite(it.pts[i]) && Number.isFinite(it.pts[i + 1]) && it.pts[i] >= -0.5 && it.pts[i] <= VIEW.w + 0.5 && it.pts[i + 1] >= -0.5 && it.pts[i + 1] <= h + 0.5, `${S.kind} ${S.l}x${S.h}: a point at ${it.pts[i]}, ${it.pts[i + 1]} of ${VIEW.w} by ${h} (turned ${yaw}, ${pitch})`);
        }
        // (a flat shape of pellets: one square drawn for each pellet; a box that is only the field: none)
        if (!is3d(S)) assert.equal(list.filter((it) => it.k === 'p' && it.stroke === '#a8ecff').length, S.pellets ? S.cells.length : 0);
        if (S.kind === 'box') assert.equal(list.filter((it) => it.i != null).length, 0, 'no pellets drawn in a field that is asked about by its sides');
        // the field's 12 edges are all drawn where the question is about it; a marked side has its words
        if (is3d(S) && (S.field || S.kind === 'box')) assert.equal(list.filter((it) => it.k === 'l').length, 12);
        if (is3d(S)) assert.deepEqual(list.filter((it) => it.k === 't').map((it) => it.s).slice(0, (S.marks || []).length), (S.marks || []).map((m) => m.text));
      }
    }
  }
  // a big block is drawn by its outside faces only: 4 by 3 by 3 has 36 pellets and 66 faces, of which no more than half face the eye
  const B = { kind: 'block', l: 4, w: 3, h: 3, cells: boxCells(4, 3, 3), pellets: true, field: false };
  for (const yaw of [0.3, 1.9, 3.3, 5]) { const n = listOf(B, yaw, 0.5).filter((it) => it.i != null).length; assert.ok(n >= 12 && n <= 33, String(n)); }
});

test('the level arrows step through all fifteen; on a captain\'s run a right answer pays nothing by itself; a wrong one gives its line why', () => {
  const crew = crewOf(); setLevelAt(crew, 'engineer', 'sides');
  const ids = [E.level(crew, JOB).id];
  for (let i = 0; i < 20; i++) { const v = E.step(crew, JOB, 1); if (!v) break; ids.push(v.id); }
  assert.deepEqual(ids, PLACE.levels.map((L) => L.id));
  assert.equal(E.level(crew, JOB).canUp, false);
  for (let i = 0; i < 20; i++) if (!E.step(crew, JOB, -1)) break;
  assert.equal(E.level(crew, JOB).id, 'sides'); assert.equal(E.level(crew, JOB).canDown, false);
  for (const L of PLACE.levels) {
    const c = crewOf(); setLevelAt(c, 'engineer', L.id);
    const rand = seeded(8); let q = E.deal(c, JOB, { rand }); while (ownOf(q.order) !== L) q = E.deal(c, JOB, { rand });
    const wrong = q.order.coins.findIndex((x) => !x.good), right = q.order.coins.findIndex((x) => x.good);
    assert.ok(q.worth.pay >= E.PAY.min && q.worth.pay <= E.PAY.max, `${L.id}: its work is worth ${q.worth.pay}`);
    const miss = E.answer(c, JOB, q, wrong, { ms: 9000, pay: false });
    assert.equal(miss.right, false); assert.equal(miss.why, q.order.coins[wrong].why); assert.equal(q.done, false);
    const hit = E.answer(c, JOB, q, right, { ms: 15000, pay: false });
    assert.equal(hit.right, true); assert.equal(hit.pay, 0); assert.equal(E.credits(c), 0); assert.equal(q.done, true);
    // counted in Mathwood's geometry
    assert.equal(q.order.own.strand, 'geo'); assert.equal(q.order.own.at, L.grade); assert.ok(/"geo"/.test(JSON.stringify(c.skill || null)), `${L.id}: geometry heard it`);
    for (const x of q.order.credit) assert.ok(STRAND[x.strand] && x.weight === 0.5 && x.at <= L.grade, `${L.id}: ${JSON.stringify(x)}`);
  }
});

test('units: whole pellets for the youngest and wherever pellets are counted, centimetres from the way round on, faces for a cluster\'s surface area', () => {
  const UNIT = { sides: 'pellets', round: 'centimetres', fill: 'pellets', area: 'square centimetres', areaSide: 'centimetres', bend: 'square centimetres', block: 'pellets', volume: 'cubic centimetres', volSide: 'centimetres',
    frame: 'centimetres', skin: 'square centimetres', cluster: 'pellets', fieldBox: 'cubic centimetres', empty: 'cubic centimetres', clusterSkin: 'faces' };
  everyQuestion((o, L) => {
    for (const c of o.coins) assert.equal(c.small, c.v === 1 ? UNIT[L.id].replace(/s$/, '') : UNIT[L.id], `${L.id}: ${c.label}`);
    // a card that asks in centimetres says what a pellet measures, or gives its sides in centimetres
    if (/centimetres/.test(UNIT[L.id])) assert.match(o.story, /centimetre/, `${L.id}: ${o.story}`);
    // the story is the game's maker's: fuel pellets, and the containment field round them
    assert.match(`${o.story} ${o.ask}`, /pellet|field/, L.id);
    assert.ok(o.story.length <= 100, `${L.id}: a long story (${o.story.length}): ${o.story}`);
    // (and its question fits one line of the card on a wide screen)
    assert.ok(o.ask.length <= 42 && o.ask.endsWith('?'), `${L.id}: ${o.ask}`);
  }, 40);
});

test('about one question in three looks back at the level below; the youngest level asks only its own', () => {
  for (const [i, L] of PLACE.levels.entries()) {
    const rand = seeded(77 + i); let below = 0; const N = 600;
    for (let k = 0; k < N; k++) { const own = ownOf(dealAt(L.id, rand).order); assert.ok(own === L || (i > 0 && own === PLACE.levels[i - 1]), `${L.id}: a card of ${own && own.id}`); if (own !== L) below++; }
    if (!i) assert.equal(below, 0); else assert.ok(below > N * 0.25 && below < N * 0.42, `${L.id}: ${below} of ${N} from the level below`);
  }
});
