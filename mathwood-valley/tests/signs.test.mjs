// The sign posts: every shipped post's boards name real places and point the true way, and follow a moved building.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyDecor } from '../world/objects/decor.js';
import { SIGN_ROWS, signPlaces, boardsFor, boardsKey, bearingOf } from '../world/objects/signplaces.js';

const read = (f) => JSON.parse(readFileSync(new URL(`../models/town/${f}.json`, import.meta.url), 'utf8'));
const town = () => applyDecor(read('layout'), read('planting'), read('decor')).layout;
const posts = (L) => L.items.filter((it) => it.kind === 'signpost');
const diff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
// (where a board points in the world: its ang in the post's frame, turned by the post, as three turns a group about y)
const pointing = (b, rot) => { const a = b.ang + rot * Math.PI / 180; return ((Math.atan2(Math.cos(a), Math.sin(a)) * 180 / Math.PI) % 360 + 360) % 360; };

test('a few posts stand in the town, each with its own boards', () => {
  const P = posts(town());
  assert.ok(P.length >= 3 && P.length <= 6, `${P.length} posts`);
  for (const it of P) {
    assert.ok(Array.isArray(it.boards) && it.boards.length >= 2 && it.boards.length <= 4, it.id);
    assert.equal(new Set(it.boards).size, it.boards.length, `${it.id}: a place named twice`);
    assert.equal(boardsFor(it, town()).length, it.boards.length, `${it.id}: a board with no place to point at`);
  }
  assert.equal(new Set(P.map((it) => it.boards.join())).size, P.length, 'two posts with the same boards');
});

test('every board points the true way from where its post stands', () => {
  const L = town(), places = signPlaces(L);
  for (const it of posts(L)) for (const b of boardsFor(it, L)) {
    const want = bearingOf(it.x, it.z, places[b.id]), got = pointing(b, it.rot);
    assert.ok(diff(want, got) < 0.01, `${it.id} ${b.text}: board ${got.toFixed(2)}, place ${want.toFixed(2)}`);
  }
});

test('a building moved in the Town Lab turns the boards that point at it', () => {
  const D = read('decor'), L0 = town(), post = { id: 'p', x: 0, z: -150, rot: 30, boards: ['homes', 'mill'] };
  const before = boardsFor(post, L0);
  const L1 = applyDecor(read('layout'), read('planting'), { ...D, moved: { ...D.moved, home1: { ...(D.moved.home1 || {}), x: 200, z: -40 } } }).layout;
  const after = boardsFor(post, L1);
  assert.notEqual(boardsKey(before), boardsKey(after));
  assert.ok(Math.abs(before[1].ang - after[1].ang) < 1e-9, 'the mill board moved too');
  const places = signPlaces(L1), b = after[0];
  assert.ok(diff(bearingOf(post.x, post.z, places.homes), pointing(b, post.rot)) < 0.01);
});

test('the picture has a row for every name, and a place the layout cannot say gets no board', () => {
  assert.ok(SIGN_ROWS.length <= 12, 'more names than the picture has rows');
  assert.equal(new Set(SIGN_ROWS.map((r) => r.text)).size, SIGN_ROWS.length);
  const bare = boardsFor({ x: 0, z: 0, rot: 0, boards: ['pasture', 'mill'] }, { items: [] });
  assert.deepEqual(bare.map((b) => b.id), ['mill']);
});
