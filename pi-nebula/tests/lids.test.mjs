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

// ROUND 2 (2026-11-21; the game's maker: "The visor's face goes dark while they sleep.", and of Tripo 11's shut eyes:
// "It isn't grabbing enough of the eyelid. It looks like it is just stretching the center of the eyelid and leaving the
// inner part of the eyelid alone.")

test('asleep, an android\'s face goes dark: L.sleep rises to 1 falling asleep and back to 0 waking; a blink awake leaves it 0', async () => {
  const L = makeLids(seeded(5));
  let most = 0, shutMost = 0; for (let i = 0; i < 60 * 30; i++) { L.update(FRAME); most = Math.max(most, L.sleep); shutMost = Math.max(shutMost, L.shut); }
  assert.ok(shutMost > 0.9, 'awake, the blinks shut the eyes');
  assert.equal(most, 0, 'awake, the face never darkens, even mid-blink');
  L.set('shut');
  let ch = false; for (let i = 0; i < 6; i++) ch = L.update(FRAME) || ch;
  assert.ok(ch && L.sleep > 0 && L.sleep < 1, 'falling asleep, the face dims (and the change is told, so it is drawn)');
  watch(L, BLINK.sleep + 0.1); assert.equal(L.sleep, 1, 'asleep, dark');
  L.set('blink'); watch(L, BLINK.wake + 0.05); assert.equal(L.sleep, 0, 'woken, lit again');
  const S = makeLids(seeded(6)); assert.equal(S.set('shut', { now: true }), true); assert.equal(S.sleep, 1, 'a sleeper put to sleep at once: dark at once');
  // (the faces drawn on a visor or a face plate fade by it, every expression; each person's own, from their lids)
  const fs = await import('node:fs'), src = fs.readFileSync(new URL('../kit/crew.js', import.meta.url), 'utf8');
  assert.equal((src.match(/34\.0\)\) \* \(1\.0 - vsSleep\);/g) || []).length, 2, 'the two-eyed face (vsFace) and the one eye (vsEye) both fade');
  assert.ok(/vsSleep\.value = lids\.sleep/.test(src), 'each person\'s face dims by their own lids');
  assert.equal((src.match(/vsSleep: \{ value: 0 \}/g) || []).length, 2, 'the visor and the face plate both have it');
});

// A head whose opening runs on past the ball's side toward the nose (Tripo 11's: the inner corner a pocket beyond the
// ball): the left ball (r 13 mm) behind a sheet with an almond hole from 17 mm toward the nose to 11 mm the other way; the
// sheet never nearer the ball's centre's depth than 6.5 mm.
function pocketHead() {
  const H = madeUp(), r = H.r, P = [], I = [], s = 0.0005, n = 80, cx = -0.003, a = 0.014, b = 0.004;
  const z = (x, y) => Math.sqrt(Math.max(0.25 * r * r, (r + 0.001) ** 2 - x * x - y * y));
  const inHole = (x, y) => ((x - cx) / a) ** 2 + (y / b) ** 2 < 1;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { const x = (i - n / 2) * s, y = (j - n / 2) * s; P.push(x + 0.033, y, z(x, y)); }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = (i - n / 2 + 0.5) * s, y = (j - n / 2 + 0.5) * s; if (inHole(x, y)) continue;
    const k = i * (n + 1) + j; I.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2);
  }
  return { ball: H.ball, P: Float64Array.from(P), I: Uint32Array.from(I), r, cx, a, b };
}
const pointAt = (H, T, x, y) => { let best = -1, bd = Infinity; for (let i = 0; i < H.P.length / 3; i++) { const d = Math.hypot(H.P[i * 3] - 0.033 - x, H.P[i * 3 + 1] - y); if (d < bd) { bd = d; best = i; } } return [T[best * 4], T[best * 4 + 1], T[best * 4 + 2], T[best * 4 + 3]]; };

test('Tripo 11: the inner corner\'s pocket taken into the opening (deep), so the inner part of the upper lid comes down with the rest', () => {
  const H = pocketHead(), E = eyesOf(H.ball), K = { deep: [0.005, 0.85] };
  const L0 = lidLines(H.P, H.I, E[0]), L1 = lidLines(H.P, H.I, E[0], K);
  // (the left eye's nose is toward -x)
  assert.ok(L0.x0 > -H.r - 0.0006, `as before, the opening stops at the ball's side: ${L0.x0}`);
  assert.ok(Math.abs(L1.x0 - (H.cx - H.a)) < 0.0012, `with the pocket, at the hole's own inner corner: ${L1.x0}`);
  assert.ok(Math.abs(L1.x1 - L0.x1) < 1e-9, 'the outer corner as before');
  const T0 = lidTurns(H.P, E, [L0, L0]), T1 = lidTurns(H.P, E, [L1, L1], K);
  // (over the hole's top edge, 14.5 mm toward the nose: past the ball's side)
  const x = -0.0145, y = H.b * Math.sqrt(1 - ((x - H.cx) / H.a) ** 2) + 0.0006;
  assert.equal(pointAt(H, T0, x, y)[1], 0, 'as before, the lid over the pocket stays where it is');
  const inner = pointAt(H, T1, x, y)[1], middle = pointAt(H, T1, H.cx, H.b + 0.0006)[1];
  assert.ok(inner < -0.3, `with it, the lid over the pocket turns down: ${inner}`);
  assert.ok(inner > middle - 0.05, `and no further than the middle of the lid: ${inner} ${middle}`);
  assert.equal(pointAt(H, T1, H.cx - H.a - 0.004, 0)[1], 0, 'nothing past the inner corner');
  assert.ok(pointAt(H, T1, x, -y)[1] > 0, 'the lower lid under the pocket comes up');
});

test('a head\'s own lids: the fold smoothed over its triangles (relax), the lid itself held; its skin colour over all that turns (cover); none of it on any other head', () => {
  const H = madeUp(), E = eyesOf(H.ball), L = lidLines(H.P, H.I, E[0]);
  const T = lidTurns(H.P, E, [L, L]), most = Math.min(...Array.from(T).filter((v, k) => k % 4 === 1));
  // (every other head: no numbers of its own, the triangles given or not, the same turns as ever)
  assert.deepEqual(Array.from(lidTurns(H.P, E, [L, L], {}, H.I)), Array.from(T), 'no head numbers: as before');
  assert.deepEqual(Array.from(lidTurns(H.P, E, [L, L], { relax: 0, cover: 0, deep: [0, 1] }, H.I)), Array.from(T), 'all off: as before');
  const R = lidTurns(H.P, E, [L, L], { relax: 12 }, H.I), at = (A, x, y) => pointAt(H, A, x, y);
  assert.deepEqual(at(R, 0, H.b + 0.0006), at(T, 0, H.b + 0.0006), 'the upper lid\'s edge turns as it did');
  assert.deepEqual(at(R, 0, -H.b - 0.0006), at(T, 0, -H.b - 0.0006), 'the lower lid as it was');
  let grew = 0, moved = 0, rough0 = 0, rough1 = 0;
  for (let i = 0; i < H.P.length / 3; i++) {
    if (T[i * 4 + 1] === 0 && R[i * 4 + 1] !== 0) grew++;
    if (R[i * 4 + 1] !== T[i * 4 + 1]) moved++;
    assert.ok(R[i * 4 + 1] <= 0 || R[i * 4 + 1] === T[i * 4 + 1], 'none of the upper side turns up');
    assert.ok(R[i * 4 + 1] >= most - 1e-6, 'none turns further than the lid itself');
  }
  assert.equal(grew, 0, 'no point turns that did not before');
  assert.ok(moved > 20, `the skin over the lid smoothed: ${moved} points`);
  // (smoother: the turn changes less from row to row going up over the lid)
  for (let y = H.b + 0.001; y < 0.0195; y += 0.0005) { rough0 += (at(T, 0, y + 0.0005)[1] - at(T, 0, y)[1]) ** 2; rough1 += (at(R, 0, y + 0.0005)[1] - at(R, 0, y)[1]) ** 2; }
  assert.ok(rough1 < rough0, `the fold smoother going up over the lid: ${rough1} < ${rough0}`);
  const C = lidTurns(H.P, E, [L, L], { cover: 2 }, H.I);
  assert.ok(at(C, 0, H.b + 0.0006)[3] < -0.3, 'covered, the lashes\' line kept');
  let covered = 0;
  for (let i = 0; i < H.P.length / 3; i++) {
    if (T[i * 4 + 1] < 0 && T[i * 4 + 3] >= 0) { assert.ok(C[i * 4 + 3] >= T[i * 4 + 3] && C[i * 4 + 3] > 0.99, 'all the upper lid that turns wears its skin\'s colour'); covered++; }
    if (T[i * 4 + 1] > 0) assert.equal(C[i * 4 + 3], T[i * 4 + 3], 'the lower lid as painted');
  }
  assert.ok(covered > 20);
});
