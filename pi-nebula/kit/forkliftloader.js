// CARGO'S LOADER LOADS THE REST OF A SUPPLY RUN, AS PLAIN NUMBERS (no three.js: the tests read this, and the game sits
// Cargo's loader on the forklift and drives it by it: src/cargoforklift.js). The game's maker, 2026-11-23 (CARGO1-1, B,
// of a player who gets off the forklift before the run is loaded): "Cargo's loader walks over, gets on the forklift and
// drives the rest into the containers while you watch (when you leave Cargo, whatever is left is loaded at once)."
//
// THE LOADER'S HAND is on the same forklift as the player's (kit/forkliftdrive.js makeDrive): it gives the stick, the
// wheel and the forks' buttons what a player's thumbs give them, and nothing else, so everything the forklift does for
// a player it does for the loader: it never goes through anything, it stops for anyone in its way, it lines itself up
// on a pallet's skids and on a place inside a container's doors, a pallet rides on its forks once they are all the way
// in and up, and stands in its place once they are down.
//   ONE PALLET   from where it stands, a way (kit/forkliftway.js) to the end of a pallet waiting on the loading floor;
//                in under it; the forks up; a way to the next free place just inside an open container's doors; in
//                through the doorway till its carriage is at the door frame; the forks down; back out from under it
//   THE REST     the same, one after another, while the run wants more (`want`)
//   THEN         a way to its bay, backed into it as it parks, the forks down where they rest
// As the player left it: a pallet already on its forks goes to a container first; its forks left in under a pallet,
// it backs out first; left lined up before a pallet or before a place inside the doors, it goes straight in. Someone in its way: it waits for them; after LOADER.wait seconds it backs off a little and works
// its way out again round them. A way that cannot be found, or a pallet that will not go on or off, is tried again
// LOADER.tries times, then given up (L.failed: the game loads the rest where nobody sees, as it did before).
//
//   const L = makeLoader()
//   const cmd = L.cmd(D, world, dt, { want })   D: the drive; world: worldOf(...) as it is now; want: how many more the
//                                               run wants loaded -> { go, turn, forks } for D.step
//   L.after(ev)                                 what D.step said of that step (blocked, took, set, why)
//   L.phase                                     'think' | 'plan' | 'go' | 'in' | 'up' | 'place' | 'down' | 'out' | 'back' | 'home' | 'parked' | 'failed'
//   L.done (parked in its bay), L.failed, L.loaded (pallets it set down in the containers), L.goal (where it is going)
import { TRUCK, FORKS, ON_FORKS, PARKED, axleOf } from './forkliftround.js';
import { HAND } from './forkliftdrive.js';
import { PALLET } from './places-plan.js';
import { makePlan, makeFollower, clearOf, WAY } from './forkliftway.js';

// short: a way to a pallet ends with the forks' tips this short of its end (m); in: the last stretch of a way, straight
// (m); boxShort: a way to a container ends with the pallet on the forks this short of its place (m, middle to middle);
// out: backed out this far from under a pallet set down (m); push: how hard the stick is pushed going in under a pallet
// or in through a doorway; park: the last stretch backed into its bay (m); think: a moment before each way (s: the
// loader looks where to go); planMs: a way is worked out this long each frame (ms); wait: this long behind someone
// before backing off (s), backOff: so far (m); tries: so many things gone wrong in a row before it is given up;
// most: no step of it takes longer than this (s); room: a way is first looked for this clear of everything (m), and
// only if there is none, as near things as a way may come (kit/forkliftway.js WAY.margin)
export const LOADER = { short: 0.35, in: 1.8, boxShort: 1.6, out: 1.5, push: 0.9, park: 2.2, think: 0.45, planMs: 3, wait: 2.5, backOff: 0.8, tries: 4, most: 14, room: 0.3 };

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const fwd = (h) => [Math.cos(h), -Math.sin(h)];
// where it stands with its forks' tips `short` of the end of a pallet at `at`, coming to it facing h
export const beforePallet = (at, h, short = LOADER.short) => { const f = fwd(h), d = PALLET.long / 2 + short + TRUCK.tips; return { x: at[0] - f[0] * d, z: at[1] - f[1] * d, h }; };
// where it stands with the pallet on its forks `short` of a place at `at`, facing h
export const beforePlace = (at, h, short = LOADER.boxShort) => { const f = fwd(h), d = ON_FORKS.x + short; return { x: at[0] - f[0] * d, z: at[1] - f[1] * d, h }; };
export const inBay = (s) => Math.hypot(s.x - PARKED.x, s.z - PARKED.z) < 0.25 && Math.abs(wrap(s.h - PARKED.h)) < 0.12;

export function makeLoader(opts = {}) {
  const O = { ...LOADER, ...opts };
  const L = { phase: 'think', done: false, failed: false, loaded: 0, fails: 0, goal: null, plans: 0, planMs: 0, waits: 0, log: [] };
  let t = 0, plan = null, cands = [], F = null, held = 0, stalled = 0, from = null, last = {}, roundPeople = false, target = null, backDir = -1, idle = 0;
  const to = (phase) => { L.phase = phase; t = 0; held = 0; stalled = 0; };
  const fail = (why) => { L.fails++; L.log.push(why); if (L.fails >= O.tries) { L.failed = why; to('failed'); } else to('think'); };
  const stop = { go: 0, turn: 0, forks: 0 };

  // WHERE NEXT: every place it could go for now, the nearest first
  function think(D, W, want) {
    const s = D.s, [ax, az] = axleOf(s), near = (p) => Math.hypot(p.x - ax, p.z - az);
    cands = [];
    if (s.carry != null) {
      // (the pallet on its forks: to the next free place inside an open container, in the order a run fills them; none
      // free: back onto the loading floor)
      const boxes = W.free.filter((q) => q.box);
      for (const q of boxes.slice(0, 2)) cands.push({ kind: 'place', q, axis: q.ends[0], to: { ...beforePlace(q.at, q.ends[0]), in: O.in } });
      if (!boxes.length) for (const q of W.free.filter((x) => !x.box)) for (const h of q.ends) cands.push({ kind: 'place', q, axis: h, to: { ...beforePlace(q.at, h), in: O.in } });
      if (!boxes.length) cands.sort((a, b) => near(a.to) - near(b.to));
    } else if (want > 0 && W.free.some((q) => q.box)) {
      for (const p of W.pallets) { if (p.box || p.y > 0.01) continue; for (const h of [p.h, p.h + Math.PI]) cands.push({ kind: 'pallet', p, axis: wrap(h), to: { ...beforePallet(p.at, wrap(h)), in: O.in } }); }
      cands.sort((a, b) => near(a.to) - near(b.to));
    }
    if (!cands.length && s.carry == null) cands.push({ kind: 'home', to: { ...PARKED, in: -O.park } });
    // (each tried with more room round it first, LOADER.room; then, if none of them will do, with the way's own margin)
    cands = [...cands.map((c) => ({ ...c, room: O.room })), ...cands.map((c) => ({ ...c, room: WAY.margin }))];
    return cands.length;
  }
  function nextPlan(D, W) {
    target = cands.shift();
    if (!target) return false;
    // (people left out of the room as a way is worked out: they walk on; after waiting behind someone, round them)
    const Wp = roundPeople ? W : { ...W, people: [] };
    plan = makePlan(D.s, target.to, clearOf(Wp, D.s, target.room), { loose: clearOf(Wp, D.s, 0.005) });
    L.goal = { kind: target.kind, at: target.q ? target.q.id : target.p ? target.p.place : 'bay' };
    return true;
  }

  L.after = (ev) => { last = ev || {}; };
  L.cmd = (D, W, dt, { want = 0 } = {}) => {
    const s = D.s; t += dt;
    if (L.phase === 'failed' || L.phase === 'parked') return stop;
    // (no step of it goes on for ever)
    if (t > O.most && !['go', 'home', 'plan', 'think'].includes(L.phase)) { fail(L.phase + ' took too long'); return stop; }
    if (L.phase === 'think') {
      // (its forks left in under a pallet: out first)
      if (s.under != null && s.carry == null) { from = { x: s.x, z: s.z }; to('out'); return stop; }
      if (t < O.think) return { go: 0, turn: 0, forks: s.carry == null && s.lift > FORKS.rest + 0.004 ? -1 : 0 };
      // (left right where the next thing is done: a pallet on its forks lined up before a place inside a container's
      // doors: straight in; its forks lined up before a pallet waiting: straight in under it)
      if (s.carry != null) { const P = D.placeNear(W); if (P && P.q.box && Math.abs(P.side) < 0.15 && P.ahead < HAND.line.near) { target = { kind: 'place', q: P.q }; L.goal = { kind: 'place', at: P.q.id }; to('place'); return stop; } }
      else if (want > 0 && W.free.some((q) => q.box)) { const A = D.inFront(W); if (A && !A.q.box && A.q.y < 0.01 && A.L.along < 0.9) { target = { kind: 'pallet', p: A.q }; L.goal = { kind: 'pallet', at: A.q.place }; to('in'); return stop; } }
      if (!think(D, W, want) || !nextPlan(D, W)) { fail('nowhere to go'); return stop; }
      to('plan'); return stop;
    }
    if (L.phase === 'plan') {
      if (!plan.step(O.planMs)) return stop;
      L.plans++; L.planMs += plan.ms;
      if (!plan.way) { if (nextPlan(D, W)) return stop; roundPeople = false; fail('no way to ' + (target ? target.kind : 'anywhere')); return stop; }
      roundPeople = false;
      F = makeFollower(plan.way); L.way = plan.way;
      to(target.kind === 'home' ? 'home' : 'go'); return stop;
    }
    if (L.phase === 'go' || L.phase === 'home') {
      const c = F.cmd(s);
      if (c.done) {
        if (L.phase === 'home') { if (inBay(s)) { L.done = true; to('parked'); } else fail('not in its bay'); return stop; }
        to(target.kind === 'pallet' ? 'in' : 'place'); return stop;
      }
      // someone in its way: it waits for them (the forklift's own rule), then backs off and goes round; anything else
      // in its way, or well off its way: worked out again from here
      const going = Math.abs(c.go) > 0.05;
      if (going && last.blocked === 'someone') { held += dt; if (held > O.wait) { L.waits++; backDir = -F.dir(); roundPeople = true; from = { x: s.x, z: s.z }; to('back'); return stop; } }
      else if (going && (last.blocked || Math.abs(s.v) < 0.02)) { stalled += dt; if (stalled > 1.2) { backDir = -F.dir(); from = { x: s.x, z: s.z }; L.fails++; L.log.push('held up by ' + (last.blocked || 'nothing') + ' on the way'); if (L.fails >= O.tries) { L.failed = 'held up'; to('failed'); } else to('back'); return stop; } }
      else { held = Math.max(0, held - dt); stalled = 0; }
      if (c.off > WAY.off) { to('think'); return stop; }
      return { go: c.go, turn: c.turn, forks: s.carry == null && s.lift > FORKS.rest + 0.004 ? -1 : 0 };
    }
    if (L.phase === 'back') {
      // (a little way back the way it came, then the way worked out again)
      const d = Math.hypot(s.x - from.x, s.z - from.z);
      if (d >= O.backOff || t > 2 || (t > 0.4 && last.blocked)) { to('think'); return stop; }
      return { go: backDir * 0.45, turn: 0, forks: 0 };
    }
    if (L.phase === 'in') {
      // in under the pallet: the stick forward till its carriage is against it (it lines itself up as it goes)
      if (s.under != null && Math.abs(s.v) < 0.01 && last.blocked && last.blocked !== 'someone') { stalled += dt; if (stalled > 0.25) { to('up'); return stop; } } else stalled = 0;
      if (s.under == null && Math.abs(s.v) < 0.01 && last.blocked && last.blocked !== 'someone' && t > 1) { held += dt; if (held > 1) { from = { x: s.x, z: s.z }; backDir = -1; L.fails++; L.log.push('could not go in under it: ' + last.blocked); to(L.fails >= O.tries ? 'failed' : 'back'); if (L.phase === 'failed') L.failed = 'could not go in under a pallet'; return stop; } }
      return { go: O.push, turn: 0, forks: 0 };
    }
    if (L.phase === 'up') {
      if (s.carry != null && s.lift >= FORKS.carry + 0.03) { L.fails = 0; to('think'); return stop; }
      if (last.why === 'deeper') { to('in'); return stop; }
      return { go: 0, turn: 0, forks: 1 };
    }
    if (L.phase === 'place') {
      // in through the doorway (or onto its place on the floor): on till the pallet is over its place, the carriage at
      // the door frame
      const P = D.placeNear(W);
      if (s.carry == null) { to('think'); return stop; }
      if (P && P.d < HAND.reach && Math.abs(P.side) < 0.12 && (P.ahead < 0.03 || (Math.abs(s.v) < 0.01 && last.blocked && last.blocked !== 'someone'))) { if (Math.abs(s.v) < 0.02) { to('down'); return stop; } return stop; }
      if (Math.abs(s.v) < 0.01 && last.blocked && last.blocked !== 'someone' && t > 1) { held += dt; if (held > 1) { from = { x: s.x, z: s.z }; backDir = -1; L.fails++; L.log.push('could not come to the place: ' + last.blocked); to(L.fails >= O.tries ? 'failed' : 'back'); if (L.phase === 'failed') L.failed = 'could not set a pallet down'; return stop; } }
      return { go: P ? Math.max(0.2, Math.min(O.push, P.ahead * 1.2 + 0.1)) : O.push, turn: 0, forks: 0 };
    }
    if (L.phase === 'down') {
      if (s.carry == null) { if (target && target.q && target.q.box) L.loaded++; L.fails = 0; from = { x: s.x, z: s.z }; to('out'); return stop; }
      if (last.why === 'line' || last.why === 'place') { from = { x: s.x, z: s.z }; backDir = -1; L.fails++; L.log.push('would not set it down: ' + last.why); to(L.fails >= O.tries ? 'failed' : 'back'); if (L.phase === 'failed') L.failed = 'could not set a pallet down'; return stop; }
      return { go: 0, turn: 0, forks: -1 };
    }
    if (L.phase === 'out') {
      // straight back out from under it, the forks down to where they rest once they are out
      const d = Math.hypot(s.x - from.x, s.z - from.z);
      if (d >= O.out && s.under == null) { to('think'); return stop; }
      if (Math.abs(s.v) < 0.01 && last.blocked && last.blocked !== 'someone' && t > 1) { held += dt; if (held > 1.5) { if (s.under == null) { to('think'); return stop; } fail('could not back out: ' + last.blocked); return stop; } }
      return { go: -1, turn: 0, forks: s.under == null && s.lift > FORKS.rest + 0.004 ? -1 : 0 };
    }
    return stop;
  };
  return L;
}
