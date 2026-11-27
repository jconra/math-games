// A STEP THAT MEETS A WALL (src/slide.js, walls.js move's slide for everyone who walks), tried by numbers on made-up
// floor plans (lifted from RAMP 2's review, rigs/ramp-2/review-scripts/pure-rule/plans.mjs), against main's own slide
// (9f85c86 walls.js, lifted below as the measure). A body is felt as walls.js feels one: its middle and a ring of 8
// points 0.28 m out; a wall a solid shape, or 0.1 m voxels of one (a slanted or round wall is then a staircase). The
// walker is the player's own (src/player.js: up to pace at 9 m/s/s, turned at 10 rad/s, and held up: ready to set off
// again at no more than it got and 0.3 m/s), its frame's move taken in walls.js move()'s strides of 0.05 m, the stick
// held or wandering (a thumb: the aim flicked by up to 0.5 rad every few frames), at 60, 30 and 15 frames a second.
//   node --test pi-nebula/tests/slide.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeSlide, NUDGE } from '../src/slide.js';

const R = 0.28, STRIDE = 0.05, TURN = 10, ACCEL = 9, D = Math.PI / 180;

// ── main's slide (9f85c86), the measure: the two parts along the walls' ways, the crawl, the head-on shuffle ───────
function mainSlide(tryStep, stride) {
  const _n = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], _f = { x: 0, y: 0, z: 0 };
  const copy = (a, b) => { a.x = b.x; a.y = b.y; a.z = b.z; };
  function nudge(pos, sx, sz, r, doorsOpen) {
    const L = Math.hypot(sx, sz), px = -sz / L * NUDGE.step, pz = sx / L * NUDGE.step, open = [true, true];
    copy(_n[0], pos); copy(_n[1], pos);
    for (let k = 1; k * NUDGE.step <= NUDGE.most + 1e-6; k++) for (let i = 0; i < 2; i++) {
      if (!open[i]) continue;
      const sg = i ? -1 : 1;
      if (!tryStep(_n[i], px * sg, pz * sg, r, doorsOpen)) { open[i] = false; continue; }
      copy(_f, _n[i]);
      if (tryStep(_f, sx, sz, r, doorsOpen)) { copy(pos, _f); return true; }
    }
    return false;
  }
  return function blocked(pos, sx, sz, fr, r, doorsOpen) {
    let ax = sx, az = 0, bx = 0, bz = sz;
    if (fr) { const l0 = fr.c * sx - fr.s * sz, l1 = fr.s * sx + fr.c * sz; ax = fr.c * l0; az = -fr.s * l0; bx = fr.s * l1; bz = fr.c * l1; }
    const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
    const a = la > 1e-6 && tryStep(pos, ax, az, r, doorsOpen), b = lb > 1e-6 && tryStep(pos, bx, bz, r, doorsOpen);
    const L = Math.hypot(sx, sz), crawl = L < stride - 1e-6;
    if (a || b) { if (crawl && !b && lb > la) tryStep(pos, bx / lb * stride, bz / lb * stride, r, doorsOpen); else if (crawl && !a && la > lb) tryStep(pos, ax / la * stride, az / la * stride, r, doorsOpen); return true; }
    if (crawl) {
      const k = stride / L;
      if (tryStep(pos, sx * k, sz * k, r, doorsOpen)) return true;
      if (la >= lb ? la > 1e-6 && tryStep(pos, ax / la * stride, az / la * stride, r, doorsOpen) : lb > 1e-6 && tryStep(pos, bx / lb * stride, bz / lb * stride, r, doorsOpen)) return true;
    }
    return nudge(pos, sx, sz, r, doorsOpen);
  };
}

// ── the plans (x out of a ship / toward the wall's back, z across); solid(x, z), floor(x, z) ─────────────────────────
const box = (x, z, x0, x1, z0, z1) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
const all = () => true;
const vox = (f, v = 0.1) => (x, z) => f((Math.floor(x / v) + 0.5) * v, (Math.floor(z / v) + 0.5) * v);
const PLAN = {
  flat: { solid: (x) => x <= 0 && x >= -0.5, floor: all },
  inside: { solid: (x, z) => (x <= 0 && x >= -0.5) || (z >= 1 && z <= 1.5 && x >= -0.5), floor: all },
  corridor: { solid: (x, z) => Math.abs(z) >= 0.5 && Math.abs(z) <= 0.8, floor: all },
  doorway: (w, t) => ({ solid: (x, z) => x <= 0 && x >= -t && Math.abs(z) > w / 2, floor: all }),
  // a corridor 1 m wide along x, a side door 0.8 m wide in its +z wall at x in [-1.4, -0.6]
  sideDoor: { solid: (x, z) => (z <= -0.5 && z >= -0.8) || (z >= 0.5 && z <= 0.8 && !(x >= -1.4 && x <= -0.6)), floor: all },
  twoPillars: (g) => ({ solid: (x, z) => Math.abs(x) <= 0.15 && Math.abs(z) >= g / 2 && Math.abs(z) <= g / 2 + 0.3, floor: all }),
  // the fault's shape: a hull wall (x in [2.5, 2.97]) with an opening z in [o0, o1]; outside, a tread to x = 8, its
  // edges m in from the jambs; inside, a floor everywhere
  ramp: (o0, o1, m) => ({ solid: (x, z) => box(x, z, 2.5, 2.97, -9, o0) || box(x, z, 2.5, 2.97, o1, 9), floor: (x, z) => (x <= 2.97 ? x > -3 : z >= o0 + m && z <= o1 - m && x < 8) }),
  diagVox: (a) => ({ solid: vox((x, z) => x * Math.cos(a) - z * Math.sin(a) <= 0 && x * Math.cos(a) - z * Math.sin(a) >= -0.6), floor: all }),
  roundRoom: (Rr) => ({ solid: vox((x, z) => Math.hypot(x, z) >= Rr && Math.hypot(x, z) <= Rr + 0.4), floor: all }),
  roundPillar: (Rr) => ({ solid: vox((x, z) => Math.hypot(x, z) <= Rr), floor: all }),
};
// the plan turned by yaw. square: the walls' frame is known (a part stood somewhere else, or the station's walls along x
// and z); not: walls turned off the frame with none to say so (a rock), the ring the world's
function world(plan, yaw = 0, square = true) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const toPlan = (x, z) => [c * x - s * z, s * x + c * z], toWorld = (lx, lz) => [c * lx + s * lz, -s * lx + c * lz];
  const ring = [];
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, wx = Math.cos(a) * R, wz = Math.sin(a) * R; ring.push(square ? [wx, wz] : toPlan(wx, wz)); }
  const free = (x, z) => { const [lx, lz] = toPlan(x, z); if (plan.solid(lx, lz) || !plan.floor(lx, lz)) return false; for (const [u, v] of ring) if (plan.solid(lx + u, lz + v)) return false; return true; };
  const W = { toPlan, toWorld, free, calls: 0, fr: yaw && square ? { c, s } : null, square };
  W.tryStep = (p, sx, sz) => { W.calls++; const x = p.x + sx, z = p.z + sz; if (!free(x, z)) return false; p.x = x; p.z = z; return true; };
  return W;
}
// a thumb: the aim flicked by up to amp rad every 3..10 frames (seeded)
function wander(base, amp, seed) {
  let s = seed >>> 0 || 1; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const offs = []; let cur = 0, next = 0;
  return (f) => { while (offs.length <= f) { if (offs.length >= next) { cur = (rnd() * 2 - 1) * amp; next = offs.length + 3 + Math.floor(rnd() * 8); } offs.push(cur); } return base + offs[f]; };
}
// one walk: aim(frame) the heading in the plan (rad from -x toward +z); goal(lx, lz). The frames' places, how far beyond
// her step any frame moved her (beyond), every frame free, reversals (a frame's move against the last), the most ground
// covered over 15 frames against the walking given (win), stuck for good (the last second under 1 cm, no goal)
function walk(rule, plan, { yaw = 0, square = true, start, aim, speed = 1.5, fps = 60, secs = 6, goal = null }) {
  const W = world(plan, yaw, square), seen = [], blocked = rule === 'main' ? mainSlide(W.tryStep, STRIDE) : makeSlide(W.tryStep, STRIDE, (kind, k) => seen.push(kind));
  const dt = 1 / fps, [wx, wz] = W.toWorld(...start), pos = { x: wx, y: 0, z: wz }, tr = [], given = [];
  let heading = aim(0), want = 0, beyond = 0, beyondNoNudge = 0, inWall = 0, rev = 0, revMost = 0, pdx = 0, pdz = 0, ok = false, frame = -1;
  const N = Math.round(secs / dt);
  for (let f = 0; f < N; f++) {
    const a = aim(f), d = a - heading; heading += Math.sign(d) * Math.min(Math.abs(d), TURN * dt);
    const v0 = want; want = Math.min(speed, want + ACCEL * dt); const v = (v0 + want) / 2;
    const [vx, vz] = W.toWorld(-Math.cos(heading), Math.sin(heading)), dx = vx * v * dt, dz = vz * v * dt, x0 = pos.x, z0 = pos.z;
    seen.length = 0;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / STRIDE));
    for (let i = 0; i < n; i++) if (!W.tryStep(pos, dx / n, dz / n) && !blocked(pos, dx / n, dz / n, W.fr, R, false, W.square)) break;
    const mx = pos.x - x0, mz = pos.z - z0, got = Math.hypot(mx, mz), b = got - v * dt;
    beyond = Math.max(beyond, b); if (!seen.includes('nudge')) beyondNoNudge = Math.max(beyondNoNudge, b);
    if (got < v * dt * 0.3) want = Math.min(want, got / dt + 0.3);
    if (!W.free(pos.x, pos.z)) inWall++;
    if (got > 1e-3 && Math.hypot(pdx, pdz) > 1e-3 && mx * pdx + mz * pdz < 0) { rev++; const back = -(mx * pdx + mz * pdz); revMost = Math.max(revMost, Math.min(back / Math.hypot(pdx, pdz), back / got)); }
    if (got > 1e-3) { pdx = mx; pdz = mz; }
    tr.push([pos.x, pos.z]); given.push(v * dt);
    const [lx, lz] = W.toPlan(pos.x, pos.z);
    if (goal && goal(lx, lz)) { ok = true; frame = f; break; }
  }
  let win = 0;
  for (let i = 15; i < tr.length; i++) { let g = 0; for (let j = i - 14; j <= i; j++) g += given[j]; if (g > 0.05) win = Math.max(win, Math.hypot(tr[i][0] - tr[i - 15][0], tr[i][1] - tr[i - 15][1]) / g); }
  const L = tr.length, k = Math.max(0, L - 1 - fps), stuck = !ok && L > fps && Math.hypot(tr[L - 1][0] - tr[k][0], tr[L - 1][1] - tr[k][1]) < 0.01;
  return { ok, frame, tr, beyond, beyondNoNudge, inWall, rev, revMost, win, stuck, end: W.toPlan(pos.x, pos.z), calls: W.calls };
}
const angles = (a, b, s) => { const o = []; for (let d = a; d <= b + 1e-9; d += s) o.push(d * D); return o; };

test('walls.js walks everyone through the slide, the frame and whether its walls run along it given', () => {
  // (the one place a step that meets a wall is decided: if move() stopped calling it, the catch at the Medic's door
  // would come back with every other test here passing)
  const src = readFileSync(new URL('../src/walls.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ makeSlide, NUDGE \} from '\.\/slide\.js';/);
  assert.match(src, /const blocked = makeSlide\(tryStep, BODY\.stride\), ownWalls = solid\.length > 0;/);
  const move = src.slice(src.indexOf('function move('), src.indexOf('return Math.hypot(pos.x - x0, pos.z - z0);'));
  assert.match(move, /if \(tryStep\(pos, sx, sz, r, doorsOpen\)\) continue;/);
  assert.match(move, /if \(!blocked\(pos, sx, sz, fr, r, doorsOpen, fr !== null \|\| ownWalls\)\) break;/);
});

test('flat walls, inside corners and corridors: main\'s own walk, frame for frame', () => {
  let n = 0;
  for (const name of ['flat', 'inside', 'corridor']) for (const yaw of [0, 30 * D]) for (const phi of angles(-85, 85, 10)) for (const [ak, aim] of [['held', () => phi], ['thumb', wander(phi, 0.5, 7 + n)]]) for (const fps of [60, 15]) {
    const o = { yaw, start: name === 'corridor' ? [0, 0.15] : [1, 0], aim, fps, secs: 3, speed: fps === 15 ? 4.6 : 1.5 }, m = walk('main', PLAN[name], o), b = walk('mend', PLAN[name], o);
    n++;
    assert.deepEqual(b.tr, m.tr, `${name} yaw ${yaw / D} push ${(phi / D).toFixed(0)} ${ak} ${fps} fps: as main`);
  }
  assert.equal(n, 3 * 2 * 18 * 2 * 2);
});

test('up the ramp into a doorway, held and wandering, at 60, 30 and 15 frames a second: in, and walked, never hopped', () => {
  // (the fault's own shape: a 2 m and a 0.8 m opening, the tread 0.1 m in from each jamb, starts across it, the stick
  // 0 to 25 degrees off straight (0.45 rad and under, as the game's table)). No frame moves her more than 3 cm beyond
  // her own step, but for main's own head-on shuffle where it fires
  let n = 0, inMain = 0;
  for (const [o0, o1] of [[-0.75, 1.25], [-0.15, 0.65]]) for (const q of [0.1, 0.5, 0.9]) for (const phi of angles(-25, 25, 5)) for (const fps of [60, 30, 15]) for (const ak of ['held', 'thumb']) {
    const plan = PLAN.ramp(o0, o1, 0.1), z = o0 + 0.1 + (o1 - o0 - 0.2) * q, aim = ak === 'held' ? () => phi : wander(phi, 0.3, 3 + n);
    const o = { start: [6, z], aim, fps, secs: 10, goal: (x) => x < 2.2 }, b = walk('mend', plan, o), m = walk('main', plan, o);
    n++; if (m.ok) inMain++;
    assert.ok(b.ok, `opening ${o0}..${o1} from ${z.toFixed(2)} at ${(phi / D).toFixed(0)} deg ${ak} ${fps} fps: in (ended at ${b.end.map((v) => v.toFixed(2))})`);
    assert.equal(b.inWall, 0);
    assert.ok(b.beyondNoNudge <= 0.03, `... no hop: ${b.beyondNoNudge.toFixed(3)} m beyond her step in a frame`);
  }
  assert.ok(inMain < n, `main is caught in some of them (${inMain} of ${n} in)`);
});

test('two pillars 0.4, 0.5 and 0.54 m apart (narrower than her): round the outside as main, never wedged where main is not', () => {
  for (const g of [0.4, 0.5, 0.54]) for (const z of [-0.3, -0.1, 0, 0.1, 0.3]) for (const phi of angles(-45, 45, 5)) for (const fps of [60, 30]) {
    const o = { start: [1.5, z], aim: () => phi, fps, speed: fps === 60 ? 1.6 : 4.6, secs: 10, goal: (x) => x < -1 }, m = walk('main', PLAN.twoPillars(g), o), b = walk('mend', PLAN.twoPillars(g), o);
    const at = `gap ${g} from ${z} at ${(phi / D).toFixed(0)} deg ${fps} fps`;
    if (m.ok) assert.ok(b.ok, `${at}: past the pillars as on main`);
    if (b.stuck) assert.ok(m.stuck, `${at}: wedged only where main is (${b.end.map((v) => v.toFixed(3))})`);
    for (const [x, zz] of b.tr) assert.ok(!(Math.abs(x) <= 0.15 && Math.abs(zz) < g / 2), `${at}: never in the gap`);
  }
});

test('a side door off a corridor: never fewer through than main, never pulled back out of it', () => {
  let m0 = 0, b0 = 0;
  for (const z of [0, -0.2, 0.2]) for (const phi of angles(0, 85, 5)) for (const fps of [60, 30]) {
    const o = { start: [2.5, z], aim: () => phi, fps, speed: fps === 60 ? 1.6 : 4.6, secs: 10, goal: (x, zz) => zz > 1.1 }, m = walk('main', PLAN.sideDoor, o), b = walk('mend', PLAN.sideDoor, o);
    if (m.ok) { m0++; assert.ok(b.ok, `from ${z} at ${(phi / D).toFixed(0)} deg ${fps} fps: through as on main`); }
    if (b.ok) b0++;
  }
  assert.ok(b0 >= m0 && m0 > 0, `through: main ${m0}, the mend ${b0}`);
});

test('slanted and round walls in voxels: never faster than her pace, no see-saw', () => {
  // (a 20 and a 30 degree wall, a round room 2 m across and a round pillar: pushed at every angle, held and wandering;
  // over any 15 frames no more ground than 1.25 times the walking given, nor more than main covers; and turned back on
  // herself (a frame's move against the last) fewer than three times, or no more than main is, or only by the half
  // centimetre she settles back against the wall after each 2 cm step off a voxel's stair, going along it where main
  // stands still: never a see-saw of any size)
  const shapes = [['20 degree wall', PLAN.diagVox(20 * D), [[1, 0], [1, 0.33], [1, 0.71]], null], ['30 degree wall', PLAN.diagVox(30 * D), [[1, 0], [1, 0.33]], null],
    ['round room', PLAN.roundRoom(2), [[1, 0], [1, 0.37], [0.7, 0.7]], 'out'], ['round pillar', PLAN.roundPillar(0.3), [[1.5, 0], [1.5, 0.2], [1.5, 0.45]], null]];
  for (const [name, plan, starts, out] of shapes) for (const st of starts) for (const d of angles(-85, 85, 10)) for (const [ak, seed] of [['held', 0], ['thumb', 1]]) {
    const L = Math.hypot(...st), phi = out ? Math.atan2(st[1] / L, -st[0] / L) + d : d, aim = seed ? wander(phi, 0.5, 11 + Math.round(d / D)) : () => phi;
    const o = { start: st, aim, secs: 3 }, m = walk('main', plan, o), b = walk('mend', plan, o);
    const at = `${name} from ${st} at ${(d / D).toFixed(0)} deg ${ak}`;
    assert.ok(b.win <= Math.max(1.25, m.win) + 1e-9, `${at}: ${b.win.toFixed(2)} times her pace over 15 frames (main ${m.win.toFixed(2)})`);
    assert.ok(b.rev < 3 || b.rev <= m.rev || b.revMost < 0.01, `${at}: turned back ${b.rev} times, at most ${b.revMost.toFixed(3)} m (main ${m.rev})`);
    assert.equal(b.inWall, 0);
  }
});

test('a rock\'s face (no frame of its own) at slants of 0.05 to 0.75 rad: never carried against the push', () => {
  // (a long flat face whose normal is turned t from world x, in 0.1 m voxels; pushed 0.1 to 0.45 rad off its normal to
  // either side for 5 s. Moved along the face: with the push, against it, or held (under 0.5 m). As the game asks it
  // there (no frame, so not square: the corner rule never runs, main's walk frame for frame), and as if it were square
  // (the rule left to run on a rock: still never against the push))
  let n = 0;
  for (let t = 0.05; t < 0.79; t += 0.1) for (const h of [0.1, 0.2, 0.3, 0.45, -0.1, -0.2, -0.3, -0.45]) {
    const nx = Math.cos(t), nz = Math.sin(t), tg = [-nz, nx];
    const at = (x, z) => { const cx = (Math.floor(x / 0.1) + 0.5) * 0.1, cz = (Math.floor(z / 0.1) + 0.5) * 0.1, d = cx * nx + cz * nz; return d >= 0.93 && d <= 1.5; };
    const plan = { solid: at, floor: all };
    const aim = () => Math.atan2(Math.sin(t + h), -Math.cos(t + h));
    const runs = { main: walk('main', plan, { start: [0, 0], aim, secs: 5 }) };
    for (const square of [false, true]) runs[square] = walk('mend', plan, { start: [0, 0], aim, secs: 5, square });
    const along = (r) => (r.end[0] * tg[0] + r.end[1] * tg[1]) * Math.sign(h);
    assert.deepEqual(runs[false].tr, runs.main.tr, `t ${t.toFixed(2)} h ${h}: no frame, main's walk`);
    for (const k of ['main', 'true']) assert.ok(along(runs[k]) > -0.5, `t ${t.toFixed(2)} h ${h} ${k}: not carried against the push (${along(runs[k]).toFixed(2)} m)`);
    n++;
  }
  assert.equal(n, 8 * 8);
});

test('the corner of a jamb met a little off square: walked round it into the opening, a stride\'s worth a stride', () => {
  // (the game's own case, traced (rigs/ramp-2/probe-trace.js): pressed against the face beside the jamb, her ring's
  // diagonal point just off its corner, the stick off straight toward the jamb's side. The face's own slide would carry
  // her along it away from the opening; she goes round the corner instead, no further sideways in one stride than the
  // stride's own length)
  const jamb = { solid: (x, z) => box(x, z, 2.5, 2.97, 1.25, 4), floor: all };
  for (const off of [0.1, 0.2, 0.3]) {
    const W = world(jamb), blocked = makeSlide(W.tryStep, STRIDE), pos = { x: 2.97 + R * Math.SQRT1_2 + 0.002, y: 0, z: 1.25 - R * Math.SQRT1_2 + 0.05 };
    const z0 = pos.z, L = 1.6 / 60, sx = -L * Math.cos(off), sz = L * Math.sin(off);
    assert.equal(W.tryStep({ ...pos }, sx, sz), false, 'the step itself is stopped by the corner');
    assert.equal(W.tryStep({ ...pos }, 0, sz), true, 'the face\'s own slide would go on, away from the opening');
    let p = { ...pos }, k = 0;
    for (; k < 40 && p.x > 2.97 - 0.3; k++) {
      const x0 = p.x, zz = p.z;
      if (!W.tryStep(p, sx, sz)) assert.equal(blocked(p, sx, sz, null, R, false, true), true);
      assert.ok(Math.hypot(p.x - x0, p.z - zz) <= Math.max(NUDGE.step, L) + L + 1e-9, `at ${off}: a stride's worth (${Math.hypot(p.x - x0, p.z - zz).toFixed(3)})`);
    }
    assert.ok(p.x <= 2.97 - 0.3 && p.z < z0, `at ${off}: round the corner and in within ${k} strides (${p.x.toFixed(3)}, ${p.z.toFixed(3)})`);
  }
});

test('the corner shuffle reaches no further than NUDGE.most: from further off, caught as on main', () => {
  // (a slot a body only just passes (her middle within 2 cm of its line), its tread ending `reach` off that line: up to
  // the corner of the tread's edge and the wall's face 0.2 rad off straight; in from within NUDGE.most, held from
  // further: nobody is pulled to an opening from further off)
  const fits = 0.3 - R;
  for (const [reach, gets] of [[fits + NUDGE.most - 0.04, true], [fits + NUDGE.most + 0.04, false]]) for (const sg of [1, -1]) {
    const slot = { solid: (x, z) => box(x, z, 2.5, 2.97, -4, -0.3) || box(x, z, 2.5, 2.97, 0.3, 4), floor: (x, z) => (x <= 2.97 ? x > -4 : Math.abs(z) <= reach && x < 8) };
    const off = 0.2 * sg, r = walk('mend', slot, { start: [4.5, sg * reach - 1.25 * Math.tan(off)], aim: () => off, secs: 8, goal: (x) => x < 2.2 });
    assert.equal(r.inWall, 0);
    assert.equal(r.ok, gets, `tread to ${reach.toFixed(2)}, at ${off}: ${gets ? 'eased in' : 'held at the frame'} (ended at ${r.end.map((v) => v.toFixed(3))})`);
  }
});

test('pressed into a flat wall: head on, main\'s tries step for step; off square, a few looks more and the slide as ever', () => {
  const W = world({ solid: (x) => x <= 2.97 && x >= 2.5, floor: all }), calls = [];
  const spy = (pos, sx, sz) => { calls.push([sx, sz]); return W.tryStep(pos, sx, sz); };
  const blocked = makeSlide(spy, STRIDE), L = 1.6 / 60, k = Math.round(NUDGE.most / NUDGE.step);
  const p1 = { x: 2.97 + R + 0.001, y: 0, z: 0 };
  assert.equal(blocked(p1, -L, 0, null, R, false, true), false);
  assert.deepEqual(p1, { x: 2.97 + R + 0.001, y: 0, z: 0 }, 'not moved');
  assert.equal(calls.length, 1 + 2 + 2 * k * 2, 'the step\'s part, the crawl twice, the shuffle each side (sideways, then the push)');
  // (0.2 rad off square: the greater part tried, the looks along the face (none goes), then the two parts and the crawl)
  calls.length = 0;
  const p2 = { x: 2.97 + R + 0.001, y: 0, z: 0 };
  assert.equal(blocked(p2, -L * Math.cos(0.2), L * Math.sin(0.2), null, R, false, true), true);
  assert.ok(p2.x === 2.97 + R + 0.001 && p2.z > 0, 'slid along the face, the way she pushes');
  assert.equal(calls.length, 1 + 6 + 3, 'the greater part, six looks, then main\'s three');
  // (a corridor walked 0.2 rad off its line: the greater part goes, so no look at all)
  calls.length = 0;
  const p3 = { x: 2.97 + R + 0.001, y: 0, z: 0 };
  assert.equal(blocked(p3, -L * Math.sin(0.2), L * Math.cos(0.2), null, R, false, true), true);
  assert.equal(calls.length, 1 + 2, 'the greater part, then main\'s two parts');
});
