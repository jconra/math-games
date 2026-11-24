// Who is aboard a ship (src/aboardplan.js, the plain part of src/aboard.js): every seat and bed of a ship's rooms as a
// place to sit or lie, read from its own blueprint, for any ship that can be boarded; the cockpit's seats kept for their
// jobs; the way between two rooms through their doors; someone walking aboard met by the player in a passage too narrow
// to pass forward (they squeeze past each other; where even that does not fit, they turn back to the place just left).
//   node --test pi-nebula/tests/aboard.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { placesOf, wayOf, walkStep, inTheWay, wayBack, floorOf, WALK, SIT, LIE } from '../src/aboardplan.js';
import { PASS } from '../src/passing.js';
// (the ships that can be boarded, as src/boarding.js lists them: read from its text, it loads three.js)
const SHIPS = [...readFileSync(new URL('../src/boarding.js', import.meta.url), 'utf8').matchAll(/\{ id: '(\w+)', zone: '[\w-]+', lab: [\w.]+, (?:cockpit: [\w.]+, )?bp: '([\w-]+)'/g)].map((m) => ({ id: m[1], bp: m[2] }));

const bpOf = (id) => JSON.parse(readFileSync(new URL(`../kit/ships/${id}.blueprint.json`, import.meta.url), 'utf8'));
const inRect = (p, r) => p.x >= r[0] - 1e-6 && p.x <= r[2] + 1e-6 && p.z >= r[1] - 1e-6 && p.z <= r[3] + 1e-6;

test('the Miner\'s places: its two cockpit seats kept for the pilot and the drill, its mess benches, its bunks; a step is not a seat', () => {
  // "it would be great if the seats and beds on the ships could be used by the npcs or the player"
  const bp = bpOf('miner-ore-cockpit'), P = placesOf(bp, { deck: 1.82, cockpitFloor: 0.62 });
  const by = (id) => P.filter((p) => p.item === id);
  assert.equal(by('seat-l').length, 1); assert.equal(by('seat-l')[0].job, 'pilot');
  assert.equal(by('seat-r')[0].job, 'drill');
  assert.equal(by('step-r').length, 0, 'the step up to the flight deck is no seat');
  assert.ok(by('bench-a').length >= 1 && by('bench-b').length >= 1);
  assert.equal(P.filter((p) => p.kind === 'lie').length, 2, 'a bed in each bunk: its lower berth');
  // (the cockpit's seats stand on its flight deck; the rest on the cabin's deck)
  assert.equal(by('seat-l')[0].y, 2.44); assert.equal(by('bench-a')[0].y, 1.82);
  // (the cockpit's seats face the nose; the benches face the table between them)
  assert.equal(by('seat-l')[0].heading, 0);
  const tb = bp.items.find((it) => it.id === 'table'), tz = (tb.rect[1] + tb.rect[3]) / 2;
  for (const id of ['bench-a', 'bench-b']) { const p = by(id)[0]; assert.ok(Math.cos(p.heading) * Math.sign(tz - p.z) > 0.5, id + ' faces the table'); }
  for (const p of P) {
    const room = bp.rooms.find((r) => r.id === p.room);
    assert.ok(inRect(p, room.rect), p.id + ' in its room');
    assert.ok(inRect({ x: p.stand[0], z: p.stand[1] }, room.rect), p.id + ': where one stands to use it is in its room');
    assert.ok(Math.hypot(p.stand[0] - p.x, p.stand[1] - p.z) > 0.2, p.id + ': stood beside, not on');
  }
});

test('any ship that can be boarded has its places, from its own blueprint, nothing of the Miner\'s', () => {
  assert.deepEqual(SHIPS.map((S) => S.id), ['explorer', 'medic', 'miner']);
  for (const S of SHIPS) {
    const bp = bpOf(S.bp), P = placesOf(bp, { deck: 0 });
    const kinds = new Set(bp.items.map((it) => it.kind));
    const want = [...kinds].filter((k) => SIT.includes(k) || LIE.includes(k));
    assert.ok(P.length > 0 === want.length > 0, S.id);
    for (const p of P) { assert.ok(['sit', 'lie'].includes(p.kind)); assert.ok(Number.isFinite(p.heading) && Number.isFinite(p.x) && Number.isFinite(p.z)); }
    assert.equal(new Set(P.map((p) => p.id)).size, P.length, S.id + ': each place its own');
    // (the ship's own cockpit floor, from its own kit, as boarding lists it)
    assert.match(readFileSync(new URL('../src/boarding.js', import.meta.url), 'utf8'), new RegExp(`id: '${S.id}'[^\\n]*cockpit: \\w+\\.COCKPIT`), S.id);
    // (at most one pilot's seat)
    assert.ok(P.filter((p) => p.job === 'pilot').length <= 1, S.id);
  }
});

test('the way between two rooms runs through their doors, in turn; a room to itself is no way at all', () => {
  const bp = bpOf('miner-ore-cockpit');
  assert.deepEqual(wayOf(bp, 'cockpit', 'cockpit'), []);
  const w = wayOf(bp, 'cockpit', 'engineering');
  assert.deepEqual(w, [[0, 3], [0, 0.5], [0, -2], [0, -4]]);
  assert.deepEqual(wayOf(bp, 'engineering', 'mess'), [[0, -4], [0, -2], [0, 0.5]]);
  // (never out through the lift's hatch)
  assert.equal(wayOf(bp, 'cockpit', 'outside'), null);
});

// THE PLAYER IN THE WAY (WALKOUT-1): the walk out of the Miner after a run, from the cockpit through the mess to the
// lift, stopped for good by the captain walking the other way and waiting in the mess for the player to pass (who could
// not: past the table it is 0.75 m wide). A stand-in for the player's own walking (src/player.js loads three.js): along
// the cabin's middle at MOVE.walk on the blueprint's floor (floorOf), never nearer than PASS.apart to anyone: walked
// into, slid round them (pushed out to PASS.apart, or no further than they were, where the floor allows; where it does
// not, squeezed past them, never nearer than PASS.squeeze; at half speed while overlapping), as player.js does. The one walking by the plain part's own steps (walkStep, on the same floor), turned back as
// src/aboard.js turns them (wayBack).
const MOVE = (() => { const m = /export const MOVE = \{ walk: ([\d.]+),/.exec(readFileSync(new URL('../src/player.js', import.meta.url), 'utf8')); return { walk: +m[1], near: PASS.apart }; })();
function playerStep(pl, goal, bodies, free, dt) {
  const gx = goal[0] - pl.x, gz = goal[1] - pl.z, L = Math.hypot(gx, gz); if (L < 1e-6) return;
  const s = Math.min(L, MOVE.walk * dt * (bodies.some((o) => Math.hypot(o.x - pl.x, o.z - pl.z) < PASS.apart - 1e-9) ? PASS.slow : 1)), bx = pl.x, bz = pl.z;
  let nx = pl.x + gx / L * s, nz = pl.z + gz / L * s;
  // (a wall: slid along it)
  if (!free(nx, nz)) { if (free(nx, pl.z)) nz = pl.z; else if (free(pl.x, nz)) nx = pl.x; else return; }
  pl.x = nx; pl.z = nz;
  for (const o of bodies) {
    const dx = pl.x - o.x, dz = pl.z - o.z, d = Math.hypot(dx, dz), R = Math.min(MOVE.near, Math.max(Math.hypot(bx - o.x, bz - o.z), PASS.squeeze)); if (d >= R - 1e-9) continue;
    const ux = d > 1e-4 ? dx / d : -gz / L, uz = d > 1e-4 ? dz / d : gx / L, out = (k) => { const x = o.x + ux * k, z = o.z + uz * k; if (!free(x, z)) return false; pl.x = x; pl.z = z; return true; };
    if (!out(R) && d < PASS.squeeze && !out(PASS.squeeze)) { pl.x = bx; pl.z = bz; }
  }
  // (overlapping: the slide round is part of the half-speed step)
  const got = Math.hypot(pl.x - bx, pl.z - bz);
  if (s < MOVE.walk * dt - 1e-9 && got > s + 1e-9) { const k = s / got, x = bx + (pl.x - bx) * k, z = bz + (pl.z - bz) * k; if (free(x, z) && !bodies.some((o) => Math.hypot(x - o.x, z - o.z) < PASS.squeeze)) { pl.x = x; pl.z = z; } }
}
function meet({ from, to, me, goal, after = 0, turn = true, secs = 60 }) {
  const bp = bpOf('miner-ore-cockpit'), P = placesOf(bp, { deck: 0, cockpitFloor: 0.62 }), place = (id) => P.find((p) => p.id === id), a = place(from), b = place(to), free = floorOf(bp);
  const W = { pos: { x: a.x, z: a.z }, heading: 0, wait: 0, leg: 0, from: a, target: b, there: null, turned: 0, waitMost: 0, getUp: true,
    way: [a.stand, ...wayOf(bp, a.room, b.room), b.stand, ...(b.kind === 'sit' ? [[b.x, b.z]] : [])].map(([x, z]) => ({ x, z })) };
  const pl = { x: me[0], z: me[1] }, dt = 1 / 30;
  let arrived = null, nearest = Infinity;
  for (let t = 0; t < secs && !(arrived != null && W.there); t += dt) {
    // the player, setting off `after` seconds after the walker, there within 0.35 m (and on to the very spot, as a
    // player walks into the cockpit or onto the lift: not stopped in its doorway)
    if (t >= after) {
      playerStep(pl, goal, W.there ? [] : [W.pos], free, dt);
      if (arrived == null && Math.hypot(goal[0] - pl.x, goal[1] - pl.z) < 0.35) arrived = t;
    }
    // the walker
    if (!W.there) {
      const r = walkStep(W, dt, t >= after ? pl : null, { free });
      if (r === 'back' && turn) {
        const back = wayBack(W.way.slice(0, W.leg).map((v) => [v.x, v.z]), W.from);
        [W.from, W.target] = [W.target, W.from]; W.wait = 0; W.turned++; W.getUp = false;
        if (back.length) { W.way = back.map(([x, z]) => ({ x, z })); W.leg = 0; } else W.there = W.target;
      } else if (r === 'wait' || r === 'back' || r === 'aside') { W.wait += dt; if (arrived == null) W.waitMost = Math.max(W.waitMost, W.wait); }   // (the player stood still at the end of their walk is only waited for)
      else if (r === 'there') W.there = W.target;
      if (W.there) { W.pos = { x: W.there.x, z: W.there.z }; }
    }
    // (sitting or lying, they are at the place, off the floor walked: not counted; nor before the player is on their
    // feet there: still in the cockpit's seat, or not yet up the lift)
    if (!W.there && t > after) nearest = Math.min(nearest, Math.hypot(pl.x - W.pos.x, pl.z - W.pos.z));
  }
  return { arrived, W, nearest };
}
// (the player's two ends of the way through the mess: just out of the cockpit's seats, as they stand up from them; the
// lift's top in the airlock, the walk out; and just in the airlock, the walk forward)
const COCKPIT = [0, 3.2], LIFT = [0, -0.6], AIRLOCK = [0, -0.3];
const starts = Array.from({ length: 33 }, (_, i) => i * 0.25);

test('the player in the way of someone walking aboard: waited for while near and ahead along their way; turned back from when still pressing on', () => {
  const at = { x: 0, z: 1 }, to = { x: 0, z: 2 };
  assert.equal(inTheWay(at, to, null), null);
  assert.equal(inTheWay(at, to, { x: 0, z: 1 + WALK.room + 0.6 }), null, 'far enough off');
  assert.equal(inTheWay(at, to, { x: 0, z: 0.4 }), null, 'behind them: they walk on');
  assert.equal(inTheWay(at, to, { x: 0.3, z: 2.1 }), 'wait', 'near and ahead');
  assert.equal(inTheWay(at, to, { x: 0.1, z: 1.6 }, 0.2), 'wait', 'pressing on, but only just met');
  assert.equal(inTheWay(at, to, { x: 0.1, z: 1.6 }, WALK.back), 'back', 'pressing on after a moment: turned back');
  assert.equal(inTheWay(at, to, { x: 0.1, z: 1.95 }, WALK.back + 5), 'wait', 'near, but not pressing on: waited for');
  // (ahead along the way they walk, not the way they face: turned round for a way back, the player behind them is behind)
  assert.equal(inTheWay(at, to, { x: 0, z: 0.6 }, WALK.back, 0), null);
  // the way back: the points passed, the last first, then the seat (a bed is lain on from where one stands by it)
  const seat = { kind: 'sit', x: -0.75, z: 2.25 }, bed = { kind: 'lie', x: 0.7, z: -3 };
  assert.deepEqual(wayBack([[0.34, -2.49], [0, -2], [0, 0.5]], bed), [[0, 0.5], [0, -2], [0.34, -2.49]]);
  assert.deepEqual(wayBack([], seat), [[-0.75, 2.25]]);
});

test('the walk out of the Miner after a run gets to the lift, whenever the captain sets off forward through the mess', () => {
  // (he waited for the player to pass, and the player could not: the walk out stopped for good, as the rigs saw it)
  // (squeezing past each other in the mess (PASSING-2), every meeting ends even with no turning back at all)
  const stuck = starts.filter((after) => meet({ from: 'bunk-p', to: 'bench-b', me: COCKPIT, goal: LIFT, after, turn: false }).arrived == null);
  assert.deepEqual(stuck, [], 'with no turning back, no meeting in the mess is left unended');
  // (coming from the bunks through the mess door, or from bench to bench along the table's edge: they squeeze past
  // each other, his middle never nearer the player's than PASS.squeeze; he never turns back)
  for (const [from, to] of [['bunk-p', 'bench-b'], ['bunk-s', 'bench-a'], ['bench-a', 'bench-b']]) {
    let turned = 0;
    for (const after of starts) {
      const r = meet({ from, to, me: COCKPIT, goal: LIFT, after });
      assert.ok(r.arrived != null && r.arrived - after < 12, `${from} -> ${to}, the player off ${after} s after him: at the lift in ${r.arrived == null ? 'never' : (r.arrived - after).toFixed(1) + ' s'}`);
      assert.ok(r.W.waitMost < WALK.back + 1.5, `${from} -> ${to} (${after} s): never stood waiting long (${r.W.waitMost.toFixed(1)} s)`);
      assert.ok(r.nearest >= PASS.squeeze - 1e-6, `${from} -> ${to} (${after} s): never deeper than the bodies' outer halves (${r.nearest.toFixed(3)} m)`);
      turned += r.W.turned;
    }
    assert.equal(turned, 0, `${from} -> ${to}: met head on, they squeezed past, nobody turned back`);
  }
});

test('the walk forward through the mess gets to the cockpit, whenever someone sets off aft through it', () => {
  for (const [from, to] of [['bench-b', 'bunk-s'], ['bench-b', 'bench-a'], ['bench-a', 'bunk-p']]) {
    for (const after of starts) {
      const r = meet({ from, to, me: AIRLOCK, goal: COCKPIT, after });
      assert.ok(r.arrived != null && r.arrived - after < 12, `${from} -> ${to}, the player off ${after} s after him: in the cockpit in ${r.arrived == null ? 'never' : (r.arrived - after).toFixed(1) + ' s'}`);
      // (where he ends up, sitting or lying, is out of the way: the player walked past it)
      assert.ok(r.W.there, `${from} -> ${to} (${after} s): sitting or lying at the end`);
      assert.ok(r.nearest >= PASS.squeeze - 1e-6, `${from} -> ${to} (${after} s): never deeper than the bodies' outer halves (${r.nearest.toFixed(3)} m)`);
    }
  }
});

test('the player and someone walking aboard squeeze past each other in a 0.75 m passage: never nearer than PASS.squeeze, both at half speed while their bodies overlap, he turned side-on', () => {
  // (a straight passage, x = 0 its middle, along z, its walls felt as the Miner's blueprint floor feels them (0.18 m):
  // 0.39 m for the two middles, as the Miner's mess past its table; the game's maker, 2026-11-21: "it should slow them
  // down to half speed")
  const free = (x, z) => Math.abs(x) <= 0.75 / 2 - 0.18 + 1e-9 && Math.abs(z) <= 3.5; free.r = 0.18;
  for (const [px, after] of [[0, 0], [0.1, 0.5], [-0.1, 1], [0, 1.6]]) {
    const W = { pos: { x: 0, z: -3 }, heading: 0, wait: 0, leg: 0, way: [{ x: 0, z: -3 }, { x: 0, z: 3 }], turned: 0 };
    const pl = { x: px, z: 3 }, goal = [px, -3], dt = 1 / 30;
    let nearest = Infinity, there = false, got = null, overW = 0, overP = 0, side = 0;
    for (let t = 0; t < 30 && !(there && got != null); t += dt) {
      const over = Math.hypot(pl.x - W.pos.x, pl.z - W.pos.z) < PASS.apart - 1e-9, pw = { ...pl };
      if (t >= after && got == null) { playerStep(pl, goal, there ? [] : [W.pos], free, dt); if (Math.hypot(goal[0] - pl.x, goal[1] - pl.z) < 0.05) got = t; }
      if (!there) {
        // (overlapping as he steps: the player has stepped already this frame)
        const overNow = Math.hypot(pl.x - W.pos.x, pl.z - W.pos.z) < PASS.apart - 1e-9, w0 = { ...W.pos };
        const r = walkStep(W, dt, pl, { free });
        if (overNow) overW = Math.max(overW, Math.hypot(W.pos.x - w0.x, W.pos.z - w0.z) / dt);
        assert.notEqual(r, 'back', `the player at ${px}, off ${after} s: squeezed past, never turned back`);
        if (r === 'wait' || r === 'aside') W.wait += dt; else if (r === 'there') there = true;
      }
      if (over) overP = Math.max(overP, Math.hypot(pl.x - pw.x, pl.z - pw.z) / dt);
      if (!there) { const d = Math.hypot(pl.x - W.pos.x, pl.z - W.pos.z); nearest = Math.min(nearest, d); if (d < 0.5) side = Math.max(side, Math.abs(W.side || 0)); }
    }
    const what = `the player at ${px}, off ${after} s`;
    assert.ok(there && got != null, `${what}: both get through`);
    assert.ok(nearest >= PASS.squeeze - 1e-6 && nearest < PASS.apart, `${what}: squeezed past (${nearest.toFixed(3)} m)`);
    assert.ok(overP > 0 && overP <= MOVE.walk * PASS.slow + 1e-6, `${what}: the player at half speed overlapping (${overP.toFixed(2)} m/s)`);
    assert.ok(overW <= WALK.speed * PASS.slow + 1e-6, `${what}: he at half speed overlapping (${overW.toFixed(2)} m/s)`);
    assert.ok(side > 1.2, `${what}: he turned side-on (${side.toFixed(2)} rad)`);
  }
});

test('a stool at a worktop is sat on where the kit stands it: tucked in, turned to the worktop, on its taller seat', async () => {
  // (the game's maker, 2026-11-23: the rescued sit on "stools"; the Medic's lab has one, at its worktop)
  const { AT_COUNTER } = await import('../src/aboardplan.js');
  const bp = bpOf('medic-open-bench'), P = placesOf(bp, { deck: 1.74 }), p = P.find((q) => q.id === 'lab-stool');
  const st = bp.items.find((it) => it.id === 'lab-stool'), bench = bp.items.find((it) => it.id === 'bench');
  assert.ok(p && st && bench && bench.kind === 'counter' && Math.abs(st.rect[0] - bench.rect[2]) < 1e-6, 'the plan: the stool against the bench\'s front');
  // (turned to the worktop, which is toward -x; its middle AT_COUNTER.out from the worktop's front, where the stool is along it)
  assert.ok(Math.sin(p.heading) < -0.99, 'faces the worktop');
  assert.ok(Math.abs(p.x - (bench.rect[2] + AT_COUNTER.out)) < 1e-6 && Math.abs(p.z - (st.rect[1] + st.rect[3]) / 2) < 1e-6);
  // (the floor they walk on is the room's; drawn up by the stool's seat over a chair's)
  assert.equal(p.y, 1.74); assert.ok(Math.abs(p.up - (AT_COUNTER.seat - AT_COUNTER.chair)) < 1e-6 && p.up > 0.1);
  // (the plan's numbers are the kit's own: where it stands the lab's stool, that stool's seat, the crew room's stools')
  const kit = (f) => readFileSync(new URL('../kit/' + f, import.meta.url), 'utf8');
  assert.ok(kit('ships/medic-furnish.js').includes(`W.depth + ${AT_COUNTER.out}]); ctx.put('lab: stool'`), 'the kit tucks the lab stool in that far');
  assert.match(kit('shipparts/cabin/lab.js'), new RegExp(`export function labStool\\(p, o = \\{\\}\\) \\{\\s*const h = o\\.h \\?\\? ${AT_COUNTER.seat}\\b`));
  assert.match(kit('shipparts/cabin/mess.js'), new RegExp(`export function stool\\(p, o = \\{\\}\\) \\{\\s*const h = o\\.h \\?\\? ${AT_COUNTER.chair}\\b`));
  // (where they stand to sit down is open floor: clear of the supplies rack and the island)
  for (const it of bp.items.filter((q) => q.room === 'open' && q.id !== 'lab-stool' && q.kind !== 'overhead')) assert.ok(p.stand[0] < it.rect[0] - 0.15 || p.stand[0] > it.rect[2] + 0.15 || p.stand[1] < it.rect[1] - 0.1 || p.stand[1] > it.rect[3] + 0.1, 'stands clear of ' + it.id);
  // (nobody else's place moves: a seat with a table by it faces the table, as before; no other seat is raised)
  for (const s of SHIPS) for (const q of placesOf(bpOf(s.bp), { deck: 1.8 })) if (q.id !== 'lab-stool') assert.equal(q.up, undefined, s.bp + ' ' + q.id);
});
