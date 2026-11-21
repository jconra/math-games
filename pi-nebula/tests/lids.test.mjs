// Eyelids that close (kit/lids.js): the blinks' timing, a person's own pace, asleep means shut, a step never caught
// mid-blink; and the lids' turns worked out on a made-up head (a ball behind a sheet with an almond-shaped opening).
// node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { BLINK, LIDS, makeLids, blinkShut, eyesOf, lidLines, lidTurns } from '../kit/lids.js';

// (a seeded random, so every run is the same)
const seeded = (s) => () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
const FRAME = 1 / 60;
// (a person's blinks over `secs` seconds at 60 frames a second: each blink's start and how long its lids were moving)
function watch(L, secs) {
  const starts = [], lengths = []; let on = -1, t = 0, most = 0;
  for (let i = 0; i < secs / FRAME; i++) {
    L.update(FRAME); t += FRAME; most = Math.max(most, L.shut);
    if (L.shut > 0 && on < 0) { on = t; starts.push(t); }
    if (L.shut === 0 && on >= 0) { lengths.push(t - on); on = -1; }
  }
  return { starts, lengths, most };
}

test('a blink: shut in about 0.06 s, open again by about 0.15 s, fully shut at its middle', () => {
  assert.equal(blinkShut(0), 0);
  assert.ok(Math.abs(blinkShut(BLINK.close) - 1) < 1e-9, 'shut at the end of its closing');
  assert.equal(blinkShut(BLINK.close + BLINK.open), 0);
  assert.ok(BLINK.close + BLINK.open >= 0.13 && BLINK.close + BLINK.open <= 0.17, 'about 0.15 s');
  for (let t = 0; t + 0.005 <= BLINK.close; t += 0.005) assert.ok(blinkShut(t + 0.005) >= blinkShut(t), 'closing never opens');
});

test('awake: a blink every 2 to 6 seconds, each about 0.15 s, the lids fully shut in each', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const L = makeLids(seeded(seed)), W = watch(L, 120);
    assert.ok(W.starts.length >= 120 / 6 - 2 && W.starts.length <= 120 / 2 + 1, `seed ${seed}: ${W.starts.length} blinks in two minutes`);
    for (let i = 1; i < W.starts.length; i++) { const g = W.starts[i] - W.starts[i - 1]; assert.ok(g >= BLINK.every[0] - 0.05 && g <= BLINK.every[1] + 0.2, `seed ${seed}: a wait of ${g.toFixed(2)} s`); }
    for (const d of W.lengths) assert.ok(d > 0.1 && d < 0.2, `seed ${seed}: a blink ${d.toFixed(3)} s long`);
    assert.ok(W.most > 0.95, 'the lids shut fully at some frame of a blink');
  }
});

test('each person their own pace: people made one after another blink at different rates and times', () => {
  const R = seeded(7), people = Array.from({ length: 8 }, () => makeLids(R));
  const paces = people.map((L) => L.pace);
  assert.ok(Math.max(...paces) - Math.min(...paces) > 0.5, 'paces differ: ' + paces.map((p) => p.toFixed(2)).join(' '));
  for (const p of paces) assert.ok(p >= BLINK.own[0] && p <= BLINK.own[1]);
  const firsts = people.map((L) => watch(L, 10).starts[0]);
  assert.ok(new Set(firsts.map((t) => t.toFixed(2))).size >= 6, 'not all in step: ' + firsts.map((t) => t.toFixed(2)).join(' '));
  for (const t of firsts) assert.ok(t >= BLINK.first - 1e-9, 'never a blink in the first moment after being made');
});

test('asleep means shut: the lids close and stay shut, with no blink, until woken', () => {
  const L = makeLids(seeded(3));
  L.set('shut');
  const W = watch(L, BLINK.sleep + 0.1);
  assert.equal(L.shut, 1, 'shut once fallen asleep');
  let least = 1; for (let i = 0; i < 60 * 60; i++) { L.update(FRAME); least = Math.min(least, L.shut); }
  assert.equal(least, 1, 'shut through a whole minute asleep');
  assert.equal(L.next(), Infinity, 'nothing more to move while asleep');
  // (at once: a sleeper posed and left still)
  const S = makeLids(seeded(4)); S.set('shut', { now: true }); assert.equal(S.shut, 1);
  // (woken: open again, and blinking again)
  L.set('blink'); watch(L, BLINK.wake + 0.05); assert.equal(L.shut, 0, 'open once woken');
  assert.ok(watch(L, 8).starts.length >= 1, 'blinking again');
  assert.ok(W.most > 0);
});

test('a step longer than a frame (a picture posed at once) leaves the eyes open, or shut asleep; "open" never blinks', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const L = makeLids(seeded(seed));
    for (const dt of [0.3, 0.6, 1.2, 2.7, 5, 0.31]) { L.update(dt); assert.equal(L.shut, 0, `seed ${seed}: open after a step of ${dt} s`); }
  }
  const S = makeLids(seeded(2)); S.set('shut'); S.update(0.5); assert.equal(S.shut, 1);
  const O = makeLids(seeded(5)); O.set('open'); assert.equal(watch(O, 60).starts.length, 0, 'never a blink held open');
});

// ── the lids' turns on a made-up head ──
// A ball (r 13 mm) and, 1 mm in front of it, a sheet of small triangles with an almond-shaped hole (2a wide, 2b tall)
// in front of the ball: the hole is the opening.
function madeUp(a = 0.011, b = 0.004) {
  const r = 0.013, ball = [];
  for (let i = 0; i <= 12; i++) for (let j = 0; j < 16; j++) { const th = (i / 12) * Math.PI * 0.75, ph = (j / 16) * 2 * Math.PI; ball.push(Math.sin(th) * Math.cos(ph) * r, Math.sin(th) * Math.sin(ph) * r, Math.cos(th) * r); }
  // (the second ball, the head's right eye, mirrored 6.6 cm over)
  const two = [...ball.map((v, k) => (k % 3 === 0 ? v + 0.033 : v)), ...ball.map((v, k) => (k % 3 === 0 ? v - 0.033 : v))];
  const P = [], I = [], s = 0.0005, n = 80, z = (x, y) => Math.sqrt(Math.max(0, (r + 0.001) ** 2 - x * x - y * y));
  const inHole = (x, y) => (x / a) ** 2 + (y / b) ** 2 < 1;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { const x = (i - n / 2) * s, y = (j - n / 2) * s; P.push(x + 0.033, y, z(x, y)); }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = (i - n / 2 + 0.5) * s, y = (j - n / 2 + 0.5) * s; if (inHole(x, y)) continue;
    const k = i * (n + 1) + j; I.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2);
  }
  return { ball: two, P: Float64Array.from(P), I: Uint32Array.from(I), r, a, b };
}

test('the balls found from their points: centre and radius', () => {
  const H = madeUp(), E = eyesOf(H.ball);
  assert.ok(E && E[0].side === 1 && E[1].side === -1);
  assert.ok(Math.abs(E[0].c[0] - 0.033) < 1e-6 && Math.abs(E[0].c[1]) < 1e-6 && Math.abs(E[0].c[2]) < 1e-6, 'the left ball\'s centre');
  assert.ok(Math.abs(E[0].r - H.r) < 1e-6 && Math.abs(E[1].r - H.r) < 1e-6, 'the radius');
});

test('the opening found from the front: its corners and its top and bottom edges', () => {
  const H = madeUp(), E = eyesOf(H.ball), L = lidLines(H.P, H.I, E[0]);
  assert.ok(L, 'an opening');
  assert.ok(Math.abs(L.x0 + H.a) < 0.0012 && Math.abs(L.x1 - H.a) < 0.0012, `corners ${L.x0} ${L.x1}`);
  const mid = Math.floor(L.up.length / 2), want = Math.atan2(H.b, Math.sqrt(H.r ** 2 - H.b ** 2));
  assert.ok(Math.abs(L.up[mid] - want) < 0.05 && Math.abs(L.lo[mid] + want) < 0.05, `edges ${L.up[mid]} ${L.lo[mid]} (want ±${want})`);
  // (a sheet with no hole: no opening)
  const S = madeUp(0.0001, 0.0001); assert.equal(lidLines(S.P, S.I, eyesOf(S.ball)[0]), null);
});

test('the turns: the upper lid down past the meeting line, the lower lid up to it, nothing past the corners or far off', () => {
  const H = madeUp(), E = eyesOf(H.ball), L = lidLines(H.P, H.I, E[0]), T = lidTurns(H.P, E, [L, L]);
  const at = (x, y) => { let best = -1, bd = Infinity; for (let i = 0; i < H.P.length / 3; i++) { const d = Math.hypot(H.P[i * 3] - 0.033 - x, H.P[i * 3 + 1] - y); if (d < bd) { bd = d; best = i; } } return [T[best * 4], T[best * 4 + 1], T[best * 4 + 2], T[best * 4 + 3]]; };
  const mid = Math.floor(L.up.length / 2), up = L.up[mid], lo = L.lo[mid], meet = lo + LIDS.meet * (up - lo);
  const top = at(0, H.b + 0.0006), bot = at(0, -H.b - 0.0006);
  assert.equal(top[0], 1, 'the left eye\'s');
  assert.ok(Math.abs(top[1] + (up - meet + LIDS.past)) < 0.06, `the upper lid's edge turns down to the meeting line and past it: ${top[1]}`);
  assert.ok(Math.abs(bot[1] - (meet - lo)) < 0.06 && bot[1] > 0, `the lower lid's edge turns up to it: ${bot[1]}`);
  assert.ok(Math.abs(-top[1]) > 2 * Math.abs(bot[1]), 'the upper lid does most of the closing');
  assert.ok(top[2] > 0.95 && bot[2] > 0.5, 'the lids\' points laid down onto the ball, shut');
  assert.ok(top[3] < -0.3 && bot[3] === 0 && at(0, 0.0075)[3] > 0.5, 'shut, the upper lid\'s edge is the lashes\' line, the lid over it its own skin, the lower lid as painted');
  assert.equal(at(H.a + 0.004, 0)[1], 0, 'nothing turns past a corner');
  assert.equal(at(0, 0.0195)[1], 0, 'nothing turns far over the lid');
  assert.ok(Math.abs(at(0, 0.0115)[1]) < Math.abs(top[1]), 'less and less turn up toward the brow');
});
