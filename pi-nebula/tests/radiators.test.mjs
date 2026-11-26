// THE RADIATORS: THEIR PIPES IN THE PANELS' OWN FACES, AND THEIR SLOW PULSE (the game's maker, 2026-11-26, of the
// trailer: "a lot of rapid flickering and I think they should very slowly have rolling pulses from the top to bottom").
// kit/outside-plan.js RADIATOR, PULSE, pulseAt; kit/outside.js (the shader).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPIRE, RADIATOR, PULSE, pulseAt, outsideGear } from '../kit/outside-plan.js';

test('radiators: the pipes lie in the panels\' own faces, and no face is drawn behind a pipe (nothing to fight with)', () => {
  const g = outsideGear({ inside: true }), H = g.heat, L = g.lit, P = RADIATOR.panel, X = SPIRE.x, Z = SPIRE.z;
  const panels = [45, 135, 225, 315].map((a) => { const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180); return { out: [c, 0, s], side: [-s, 0, c] }; });
  const frame = (x, y, z) => { for (const p of panels) { const dx = x - X, dz = z - Z, u = dx * p.out[0] + dz * p.out[2], w = dx * p.side[0] + dz * p.side[2]; if (u > P.u[0] - 0.01 && u < P.u[1] + 0.01 && y > P.y[0] - 0.01 && y < P.y[1] + 0.01 && Math.abs(Math.abs(w) - P.half) < 1e-4) return { p, u, w, y }; } return null; };
  // every pipe corner on a panel's face
  const pipes = [];
  for (let i = 0; i < H.index.length; i += 6) {
    const v = [0, 1, 2].map((k) => H.index[i + k]).map((n) => frame(H.position[n * 3], H.position[n * 3 + 1], H.position[n * 3 + 2]));
    assert.ok(v.every(Boolean), 'a pipe lies in a panel\'s face');
    pipes.push({ p: v[0].p, u: (v[0].u + v[1].u + v[2].u) / 3, y: (v[0].y + v[1].y + v[2].y) / 3, w: v[0].w });
  }
  assert.equal(pipes.length, 4 * 2 * RADIATOR.pipes.n * RADIATOR.pipes.pieces, 'every pipe piece of every row, both faces of all four');
  // no black face of a panel under any pipe piece's middle
  const inTri = (q, a, b, c) => { const s = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]); const d1 = s(q, a, b), d2 = s(q, b, c), d3 = s(q, c, a); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
  let faces = 0;
  for (let i = 0; i < L.index.length; i += 3) {
    const v = [0, 1, 2].map((k) => L.index[i + k]).map((n) => frame(L.position[n * 3], L.position[n * 3 + 1], L.position[n * 3 + 2]));
    if (!v.every(Boolean) || v.some((q) => q.p !== v[0].p || Math.sign(q.w) !== Math.sign(v[0].w))) continue;
    faces++;
    for (const q of pipes) if (q.p === v[0].p && Math.sign(q.w) === Math.sign(v[0].w)) assert.ok(!inTri([q.u, q.y], [v[0].u, v[0].y], [v[1].u, v[1].y], [v[2].u, v[2].y]), 'no black face behind a pipe');
  }
  assert.ok(faces > 100, 'the panels\' black strips are there');
});

test('radiators: a slow band of glow rolls from the top row to the foot, on the game\'s own clock', () => {
  const R = RADIATOR.pipes, top = R.y0 + (R.n - 1) * R.pitch + R.tall, foot = R.y0, round = PULSE.secs + PULSE.gap;
  // (when the band is brightest at a height: the top first, the foot last)
  const peak = (y) => { let best = -1, bt = 0; for (let t = 0; t < round; t += 0.01) { const v = pulseAt(y, t); if (v > best) { best = v; bt = t; } } return bt; };
  assert.ok(peak(top - 0.5) < peak((top + foot) / 2) && peak((top + foot) / 2) < peak(foot + 0.5), 'top to bottom');
  // slow: the band takes several seconds to cross the rows, and nothing changes quickly from one moment to the next
  const speed = (top - foot + 2 * PULSE.wide) / PULSE.secs;
  assert.ok(speed < 3, 'the band moves no faster than 3 m a second: ' + speed.toFixed(2));
  assert.ok(round >= 8, 'a pass every 8 s or slower');
  let most = 0;
  for (let y = foot; y <= top; y += 0.25) for (let t = 0; t < round; t += 1 / 30) most = Math.max(most, Math.abs(pulseAt(y, t + 1 / 30) - pulseAt(y, t)));
  assert.ok(most < 0.06, 'one frame to the next at 30 a second, the glow changes by under 6 %: ' + most.toFixed(3));
  for (let t = 0; t < round; t += 0.37) for (let y = foot; y <= top; y += 0.5) { const v = pulseAt(y, t); assert.ok(v >= PULSE.low - 1e-9 && v <= PULSE.high + 1e-9); assert.equal(+pulseAt(y, t + round).toFixed(9), +v.toFixed(9)); }
  // the picture's own sums run on the kit's one clock (the game's time, which a film holds and steps), never the wall's
  const src = readFileSync(new URL('../kit/outside.js', import.meta.url), 'utf8');
  assert.ok(/uHeatTime = U\.time/.test(src), 'the pulse reads the kit\'s clock');
  assert.ok(!/performance\.now|Date\.now/.test(src), 'nothing in the outside reads the wall clock');
});
