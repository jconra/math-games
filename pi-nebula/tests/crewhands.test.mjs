// The crew's hands at rest and the heavy android's happy eye (kit/crew.js THE FINGERS RELAXED and THE ONE EYE'S HAPPY
// ARC A SMILE). The kit loads three.js in the browser, so these read its source: the settings and the shader's lines.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../kit/crew.js', import.meta.url), 'utf8');
const FINGERS = new Function(`return ${/export const FINGERS = (\{[^\n]*\});/.exec(SRC)[1]};`)();
// (every clip the crew kit plays: CLIP_FILES' lists)
const CLIPS = [...new Set([...SRC.matchAll(/'([A-Z][A-Za-z_]+)'/g)].map((m) => m[1]))];

test('the fingers relaxed: standing and sitting with the hands on the knees, the fingers keep only a little of the clips\' bend, brought together, the thumb in', () => {
  for (const c of ['Stand_Listen', 'Sit_Listen']) assert.ok(FINGERS.clips.test(c), c);
  for (const k of ['bend', 'thumb', 'together', 'thumbIn']) assert.ok(FINGERS[k] >= 0 && FINGERS[k] <= 1, k);
  // ("Just straight fingers going straight down, or at least more relaxed": a third of the bend at most)
  assert.ok(FINGERS.bend <= 1 / 3, `bend ${FINGERS.bend}`);
  assert.ok(FINGERS.together > 0 && FINGERS.thumbIn > 0);
});

test('a hand that holds something keeps its grip: the wheel, the hammer, the forge, the polishing rag, the run\'s fists, the walk, the wave and the clapping are not relaxed', () => {
  const kept = ['Drive', 'Hammer', 'Tend_Forge', 'Bar_Polish', 'Run', 'Run_Back', 'Walk', 'Wave', 'Interact', 'Stand_Clap', 'Sit_Clap', 'Stool_Clap', 'Idle'];
  for (const c of kept) { assert.ok(CLIPS.includes(c), `the kit plays ${c}`); assert.ok(!FINGERS.clips.test(c), c); }
});

// (a stroke of the faces' shader: vsArc(p, vec2(cx, cy), r, a0, a1), an arc from angle a0 to a1)
const arcs = (glsl) => [...glsl.matchAll(/vsArc\(p, vec2\(([-\d.]+), ([-\d.]+)\), ([\d.]+), ([-\d.]+), ([-\d.]+)\)/g)].map((m) => m.slice(1).map(Number));
const glslOf = (name) => { const i = SRC.indexOf(`const ${name} = \``); return SRC.slice(i, SRC.indexOf('`;', i)); };
// (the happy face's strokes: from `vsExpr == 1` to `vsExpr == 2` in that function)
const happyOf = (glsl, fn) => { const body = glsl.slice(glsl.indexOf(fn)); return body.slice(body.indexOf('vsExpr == 1'), body.indexOf('vsExpr == 2')); };

test('the heavy android\'s one eye, happy, is a smile: an arc on the bottom of its circle (a U), across the lens\'s middle', () => {
  const A = arcs(happyOf(glslOf('PLATE_GLSL'), 'float vsEye'));
  assert.equal(A.length, 1);
  const [cx, cy, r, a0, a1] = A[0];
  assert.ok(a0 < a1 && a0 > -Math.PI && a1 < 0, `angles ${a0}..${a1}`);
  // (its lowest point under the lens's middle, its two ends higher than that, the arc as wide as before: 2.24 rad)
  const low = cy - r, ends = [a0, a1].map((a) => cy + r * Math.sin(a));
  assert.equal(cx, 0);
  assert.ok(low < 0 && ends.every((y) => y > low + 0.05), `${low} ${ends}`);
  assert.ok(Math.abs((a1 - a0) - 2.24) < 1e-6);
});

test('the two-eyed faces, happy, keep their closed eyes (upside-down U\'s) over a smile', () => {
  const A = arcs(happyOf(glslOf('VISOR_GLSL'), 'float vsFace'));
  assert.equal(A.length, 3);
  for (const [, , , a0, a1] of A.slice(0, 2)) assert.ok(a0 > 0 && a1 < Math.PI, 'an eye: the top of its circle');
  const [, , , m0, m1] = A[2];
  assert.ok(m0 < 0 && m1 < 0, 'the mouth: the bottom of its circle');
});
