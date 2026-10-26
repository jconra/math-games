// The target range's sounds and layout in plain numbers (src/audio/rangesound.js, src/range.js). How the range looks,
// the gun, the hits and the help card are checked by eye with the rigs in ~/pw/bandit-math/rigs/shooting/ (look.cjs,
// phone.cjs, session.cjs; sounds.cjs renders the patches and measures them).
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// the range's module imports three.js by its bare name (the page's importmap finds it); here it gets empty stand-ins,
// as its numbers need no three.js
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(spec, ctx, next) {
    if (spec === 'three') return { url: 'data:text/javascript,export default {}', shortCircuit: true };
    if (spec.startsWith('three/addons/')) return { url: 'data:text/javascript,export const mergeGeometries = () => null', shortCircuit: true };
    return next(spec, ctx);
  }`));
const { RANGE_PATCHES, RANGE_SOUND } = await import('../src/audio/rangesound.js');
const { RANGE } = await import('../src/range.js');

test('the range\'s sounds are noise through filters, never a ringing tone, and every one ends by itself', () => {
  const names = Object.keys(RANGE_PATCHES);
  assert.deepEqual(names, ['RANGE — SHOT', 'RANGE — CLANK', 'RANGE — SHATTER', 'RANGE — PING', 'RANGE — THUD', 'RANGE — CLICK']);
  for (const [k, P] of Object.entries(RANGE_PATCHES)) {
    assert.ok(!P.nodes.some((n) => n.type === 'osc'), `${k}: no oscillator (a tone)`);
    assert.ok(P.nodes.some((n) => n.type === 'noise'), `${k}: made of noise`);
    const envs = P.nodes.filter((n) => n.type === 'env');
    assert.ok(envs.length && envs.every((n) => !n.sustain), `${k}: one-shot envelopes only (it ends by itself)`);
    assert.ok(envs.every((n) => (n.delay || 0) + n.attack + n.decay <= P.dur), `${k}: over within its length`);
    const ids = new Set(P.nodes.map((n) => n.id));
    for (const c of P.cables) assert.ok(ids.has(c.from) && ids.has(c.to), `${k}: cable ${c.from} -> ${c.to}`);
    assert.equal(P.group, 'RANGE');
  }
  assert.ok(RANGE_SOUND.shot <= 0.6, 'the gunshot is kept down: it is right at the ears and heard a lot');
});

test('the range\'s layout: the shelf in front of the hay, the lane wider than the shelf, the shooter behind the line', () => {
  assert.ok(RANGE.shelf > 6 && RANGE.shelf < RANGE.hay, 'shelf, then the hay behind it');
  assert.ok(RANGE.fence.at > RANGE.plankW / 2 + 1, 'the fence clears the shelf\'s ends');
  assert.ok(RANGE.fence.to > RANGE.hay, 'the fence runs past the hay');
  assert.ok(RANGE.stand.z < 0 && Math.abs(RANGE.stand.x) < 0.5, 'the shooter stands just behind the firing line, in the middle');
  assert.ok(Math.abs(RANGE.marksman.x) > 1.5 && Math.abs(RANGE.marksman.x) < RANGE.fence.at, 'the keeper stands to one side, inside the fence');
  assert.ok(RANGE.planks[1] - RANGE.planks[0] > RANGE.bottle.h + 0.2, 'room for a bottle and its tag between the planks');
  assert.ok(RANGE.mow.x > RANGE.fence.at && RANGE.mow.z1 > RANGE.hay, 'the mown ground takes in the whole range');
});
