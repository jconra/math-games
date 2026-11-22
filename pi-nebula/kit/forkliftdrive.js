// HIS FORKLIFT DRIVEN BY THE PLAYER, AS PLAIN NUMBERS (no three.js: the tests read this, and the game drives the forklift
// by it: src/cargodrive.js). The game's maker, 2026-11-22 (STA2-5): "Then you go get in the forklift and load some
// pallets onto the containers. If someone is really bad at driving, Id say they can get off the forklift and the ship
// will automatically be loaded once they leave." The pallets waiting on the loading floor go into the containers in the
// cargo slots (kit/places-plan.js LOAD).
//
// HOW IT DRIVES, as a forklift does: it steers by its back wheels, so it turns about the middle of its front axle (the
// truck's numbers are kit/forkliftround.js TRUCK). The stick (or WASD) pushed up drives it forward, down backs it, left
// and right steer; its forks go up and down while the up and down buttons (or keys) are held. As the rounds' forklift,
// IT NEVER DRIVES THROUGH ANYTHING: its body, its carriage and its forks (or the pallet on them) are kept off the racks,
// the containers, the benches, the desk, the scale, the lift, the walls, every pallet standing anywhere, and everyone
// on the floor (a person's middle never nearer its outline than HAND.people). A move that would go into any of them is
// not made: it stops there.
//
// A PALLET, ON AND OFF ITS FORKS (no grab button, as the crane by hand has none):
//   in      with its forks down, lined up with a pallet's skids (HAND.line), it drives them in under it; near it, it
//           lines itself up on it as it goes (the pallet's middle line, its skids' way), and goes in straight
//   up      the forks all the way in (its carriage against the pallet), up: the pallet rides on them
//   down    carrying, the forks come no lower than carrying height except over a free place a pallet can stand in (a
//           place just inside a container's open doors, or a place on the loading floor): near one, lined up, it lines
//           itself up on it as it goes, and lowered there the pallet stands in that place, exactly
//   out     back out, the forks slide out from under it
//
//   const D = makeDrive(pose)               a drive: D.s { x, z, h (as kit/forkliftround.js poses), v (m/s), curv (1/m:
//                                           plus turning left), lift (the forks, over where they rest), carry (the pallet
//                                           on its forks, or null), under (the pallet its forks are in, or null) }
//   D.step(cmd, dt, world)                  cmd: { go (-1 back .. 1 forward), turn (-1 left .. 1 right), forks (-1 down,
//                                           0, 1 up) }; world (worldOf): what is in the room now -> what happened:
//                                           { took, set (a place id), blocked (what stopped it), why (what the forks
//                                           would not do and why) }
//   worldOf({ open, pallets, people })      open: the containers whose doors are open (slots); pallets: [{ i, at, y, h,
//                                           place }] every pallet standing somewhere; people: [[x, z]]
//   clearance(pose, s, world)               -> { gap, what } the nearest anything comes to it (m; below 0: into it)
import { TRUCK, FORKS, ON_FORKS, outline, gapTo, pointGap, wallGap, roomBlocks, palletFoot, axleOf, poseAt, poseFor, PLACES } from './forkliftround.js';
import { PALLET, SLOT, STORE, LOAD, FORKLIFT, forkliftScale, doorHinge } from './places-plan.js';

// THE PLAYER'S HAND ON IT: a little quicker than Cargo's careful drivers on their rounds (1 m/s), never a racing kart
//   fast, back      the most it goes forward, and backing (m/s); speedUp, slowDown (m/s each second)
//   inSlow          going in under a pallet, or carrying one near a place to set it down (m/s)
//   turn            the tightest turn (m, round the front axle's middle: its back wheels turned their whole way, the
//                   rounds' own turn, kit/forkliftround.js TURN.r); steerRate: how quickly the wheel is turned (1/m a s)
//   up, down        the forks, m/s (a little quicker than the rounds', which lift a load slowly in front of people)
//   top             the highest the forks go (the first shelf's height with a pallet over its beam)
//   people          a person's middle never nearer its outline than this (m: a body is 0.28 m round)
//   wall            its corners never nearer a wall's line than this (m: the panels and ribs stand up to 0.4 m in)
//   line            lined up enough to go in under a pallet, or to set one down at a place: within `angle` (radians)
//                   of its skids' way, its middle line within `side` (m) of the pallet's (the place's); within `near`
//                   (m) of the pallet's (the place's) near end, it lines itself up as it goes, `pull` of the way for
//                   each metre driven
//   reach           a pallet carried this near a free place (its middle to the place's, m), lined up, is set down there
//   deep            the forks all the way in: the carriage this near the pallet (m)
//   dip             lined up with a pallet, its forks this little over where they go in under it (m: where they rest
//                   when it is parked is 4 mm too high) are brought down by themselves as it goes in
//   step            each move is looked at every this far (m)
export const HAND = { fast: 1.5, back: 1.0, speedUp: 1.2, slowDown: 2.4, inSlow: 0.5, turn: 1.5, steerRate: 1.8, up: 0.35, down: 0.42, top: FORKS.over,
  people: 0.34, wall: 0.45, line: { angle: 0.24, side: 0.24, near: 1.4, pull: 2.2 }, reach: 0.4, deep: 0.1, dip: 0.08, step: 0.03 };
const k = forkliftScale(), BLADE = FORKLIFT.blade * k;
// the forks' highest with their blades still under a pallet's deck standing at height y
const underDeck = (y) => y + PALLET.deck - BLADE - 0.002;

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const fwd = (h) => [Math.cos(h), -Math.sin(h)], right = (h) => [Math.sin(h), Math.cos(h)];

// ── boxes: each { what, c: [x, z], f, r (its two ways), hx, hz (half its length along f, half its width along r) } ──
export function obb(what, c, h, hx, hz) { return { what, c, f: fwd(h), r: right(h), hx, hz }; }
export const aabb = (what, [x0, x1, z0, z1]) => ({ what, c: [(x0 + x1) / 2, (z0 + z1) / 2], f: [1, 0], r: [0, 1], hx: (x1 - x0) / 2, hz: (z1 - z0) / 2 });
// the gap between two boxes (m; below 0: they overlap), measured on the four ways that can part them: never more than
// the true gap, so "at least this far" is safe
export function boxGap(a, b) {
  const dx = b.c[0] - a.c[0], dz = b.c[1] - a.c[1];
  let g = -Infinity;
  for (const [ux, uz] of [a.f, a.r, b.f, b.r]) {
    const pa = a.hx * Math.abs(a.f[0] * ux + a.f[1] * uz) + a.hz * Math.abs(a.r[0] * ux + a.r[1] * uz);
    const pb = b.hx * Math.abs(b.f[0] * ux + b.f[1] * uz) + b.hz * Math.abs(b.r[0] * ux + b.r[1] * uz);
    g = Math.max(g, Math.abs(dx * ux + dz * uz) - pa - pb);
  }
  return g;
}
// a pallet standing at [x, z] its skids along h (the way a forklift faces to take it up)
export const palletObb = (at, h, what = 'a pallet') => obb(what, at, h, PALLET.long / 2, PALLET.wide / 2);

// ── what is in the room ──────────────────────────────────────────────────────────────────────────────────────────
// A CONTAINER WITH ITS DOORS OPEN (LOAD): its two sides and the posts of its door frame stop everything; the doorway
// lets its forks and a pallet on them in, its carriage and its body stop at the door frame (it loads from the door, as
// a forklift loads a container from a dock); its door leaves, latched back along its sides, stand just outside them
export function containerBlocks(slot) {
  const z = SLOT.z[slot], x1 = SLOT.end + 0.02, out = [], hz = SLOT.box[0] / 2 + 0.045;
  const name = 'container 0' + (slot + 1);
  for (const s of [-1, 1]) {
    out.push({ what: name + '\'s side', o: aabb(name + '\'s side', [STORE.x0, x1, s > 0 ? z + LOAD.door : z - hz - 0.16, s > 0 ? z + hz + 0.16 : z - LOAD.door]) });
    // (a leaf latched back: from its hinge, past the door frame, back along the side, its bars toward the side)
    const H = doorHinge(slot, s > 0 ? 'south' : 'north');
    out.push({ what: name + '\'s door', o: aabb(name + '\'s door', [H.x - 1.36, H.x - 0.1, s > 0 ? z + hz + 0.07 : z - hz - 0.27, s > 0 ? z + hz + 0.27 : z - hz - 0.07]) });
  }
  out.push({ what: name + '\'s doorway', body: true, o: aabb(name + '\'s doorway', [x1 - 2, x1, z - hz, z + hz]) });
  return out;
}
// the room's still things (kit/forkliftround.js roomBlocks: the racks whole, the benches, the desk, the scale, the
// containers, the lift), a container whose doors are open as containerBlocks has it
export function stillBlocks(open = []) {
  const out = [];
  for (const b of roomBlocks()) {
    const m = /^container 0(\d)$/.exec(b.what);
    if (m && open.includes(+m[1] - 1)) { out.push(...containerBlocks(+m[1] - 1)); continue; }
    out.push({ what: b.what, o: aabb(b.what, b.box) });
  }
  return out;
}
// THE PLACES a pallet can stand in: the pallets waiting on the loading floor (kit/forkliftround.js PLACES 'w<n>',
// taken up or set down from either end: a pallet's skids are open at both), and just inside an open container's doors
// ('b<n>', LOAD.places, from the doorway only, facing west). The rounds' places on the racks are no place for the
// player's: the racks stand whole in its way.
export const BOX_PLACES = LOAD.places.map((at, i) => ({ id: 'b' + i, at, y: LOAD.floor, h: Math.PI, slot: LOAD.slots[Math.floor(i / LOAD.each)], box: true, ends: [Math.PI] }));
export const FLOOR_PLACES = PLACES.filter((q) => !q.shelf).map((q) => ({ ...q, ends: [q.h, q.h + Math.PI] }));
export const boxPlace = (id) => BOX_PLACES.find((q) => q.id === id) || null;
export function worldOf({ open = [], pallets = [], people = [] } = {}) {
  const places = [...FLOOR_PLACES, ...BOX_PLACES.filter((q) => open.includes(q.slot))];
  const taken = new Set(pallets.map((p) => p.place).filter(Boolean));
  return { open, blocks: stillBlocks(open), pallets: pallets.map((p) => ({ ...p, o: palletObb(p.at, p.h) })), people, places, free: places.filter((q) => !taken.has(q.id)) };
}

// ── how near anything comes ─────────────────────────────────────────────────────────────────────────────────────
// s: the drive's state (carry, under; `entering`: the pallet its forks may go in under just now). -> { gap, what, all }
// (all: the nearest for each thing, by its key: a move may never take anything it touches further in)
export function clearance(p, s, W, entering = null) {
  let gap = Infinity, what = null;
  const all = new Map();
  const note = (g, w, key) => { if (g < gap) { gap = g; what = w; } const o = all.get(key); if (o === undefined || g < o) all.set(key, g); };
  for (const o of outline(p, s.carry != null)) {
    const body = o.what === 'body' || o.what === 'carriage';
    W.blocks.forEach((b, j) => { if (body || !b.body) note(boxGap(o, b.o), b.what, 'b' + j); });
    for (const q of W.pallets) {
      if (q.i === s.carry) continue;
      // (its forks go in under the pallet they are lined up with; its carriage stops against it)
      if (!body && (q.i === s.under || q.i === entering)) continue;
      note(boxGap(o, q.o), q.box ? 'a pallet in a container' : 'a pallet', 'p' + q.i);
    }
    W.people.forEach(([x, z], j) => note(pointGap(o, x, z) - HAND.people, 'someone', 'w' + j));
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) note(wallGap(o.c[0] + o.f[0] * o.hx * a + o.r[0] * o.hz * b, o.c[1] + o.f[1] * o.hx * a + o.r[1] * o.hz * b) - HAND.wall, 'the wall', 'wall');
  }
  return { gap, what, all };
}
// a move from `a` to `b` (two clearances) that takes anything further in than it was, where it is touching: -> what, or null
export function worse(a, b) {
  for (const [key, g] of b.all) if (g < 0 && g < (a.all.get(key) ?? Infinity) - 1e-6) return key;
  return null;
}

// lined up with a pallet (or a place): -> { d (radians off its skids' way, the nearer end), side (m off its middle
// line), along (m from the forks' tips back to its near end: plus while short of it), axis (the way to face it) } or
// null when it is behind the forks or across them
function lineUp(p, at, ends, halfLong = PALLET.long / 2) {
  let best = null;
  for (const a of ends) {
    const d = wrap(a - p.h); if (Math.abs(d) > Math.PI / 2) continue;
    const f = fwd(a), r = right(a), dx = at[0] - p.x, dz = at[1] - p.z;
    const along = dx * f[0] + dz * f[1] - halfLong - TRUCK.tips, side = dx * r[0] + dz * r[1];
    if (!best || Math.abs(d) < Math.abs(best.d)) best = { d, side, along, axis: a };
  }
  return best;
}
const lined = (L) => L && Math.abs(L.d) < HAND.line.angle && Math.abs(L.side) < HAND.line.side;
// a pose eased toward a line (a pallet's or a place's middle line, facing `axis`), `t` of the way
function easeOnto(p, at, axis, t) {
  const f = fwd(axis), r = right(axis), dx = p.x - at[0], dz = p.z - at[1];
  const along = dx * f[0] + dz * f[1], side = dx * r[0] + dz * r[1];
  const s2 = side * (1 - t), h = p.h + wrap(axis - p.h) * t;
  return { x: at[0] + f[0] * along + r[0] * s2, z: at[1] + f[1] * along + r[1] * s2, h };
}

// ── a drive ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function makeDrive(pose) {
  const s = { x: pose.x, z: pose.z, h: pose.h, v: 0, curv: 0, lift: pose.lift ?? FORKS.rest, carry: pose.carry ?? null, under: null };
  const D = { s };
  // the pallet its forks could go in under now (lined up, forks low, in front of them): -> { q, L } or null
  function inFront(W) {
    if (s.carry != null) return null;
    let best = null;
    for (const q of W.pallets) {
      // (its forks low, or nearly: lined up, it brings them down the last few centimetres itself as it goes in)
      if (s.lift > underDeck(q.y) + HAND.dip) continue;
      const L = lineUp(s, q.at, [q.h, q.h + Math.PI]);
      if (!L || L.along > HAND.line.near || L.along < -PALLET.long - 0.05) continue;
      if (!lined(L)) continue;
      if (!best || L.along < best.L.along) best = { q, L };
    }
    return best;
  }
  // the free place a pallet it carries could be set down in (lined up, near): -> { q, L, d (its middle to the place's) }
  function placeNear(W) {
    if (s.carry == null) return null;
    let best = null;
    for (const q of W.free) {
      // (the pallet's middle on the forks, against the place's middle)
      const f = fwd(s.h), cx = s.x + f[0] * ON_FORKS.x, cz = s.z + f[1] * ON_FORKS.x, dd = Math.hypot(q.at[0] - cx, q.at[1] - cz);
      let d = Infinity, axis = null;
      for (const a of q.ends) { const x = Math.abs(wrap(a - s.h)); if (x < d) { d = x; axis = a; } }
      if (d > HAND.line.angle) continue;
      const r = right(axis), side = (cx - q.at[0]) * r[0] + (cz - q.at[1]) * r[1];
      const ahead = (q.at[0] - cx) * fwd(axis)[0] + (q.at[1] - cz) * fwd(axis)[1];
      if (Math.abs(side) > HAND.line.side + 0.1 || ahead > HAND.line.near + 0.6 || ahead < -HAND.reach) continue;
      if (!best || dd < best.d) best = { q, axis, side, ahead, d: dd };
    }
    return best;
  }
  D.inFront = inFront; D.placeNear = placeNear;
  D.palletOn = () => { const f = fwd(s.h); return [s.x + f[0] * ON_FORKS.x, s.z + f[1] * ON_FORKS.x]; };

  D.step = (cmd = {}, dt = 1 / 60, W) => {
    const ev = { took: null, set: null, blocked: null, why: null };
    const go = Math.max(-1, Math.min(1, cmd.go || 0)), turn = Math.max(-1, Math.min(1, cmd.turn || 0)), fk = Math.sign(cmd.forks || 0);
    const front = inFront(W), place = placeNear(W);
    // THE WHEEL: eased toward where it is pushed (its back wheels turned no further than its tightest turn allows); in
    // under a pallet it goes straight
    const want = s.under != null ? 0 : -turn / HAND.turn;
    s.curv += Math.sign(want - s.curv) * Math.min(Math.abs(want - s.curv), HAND.steerRate * dt);
    // THE SPEED: eased toward where it is pushed; slower in under a pallet, or near a place with one
    let top = go >= 0 ? HAND.fast : HAND.back;
    if (s.under != null || (front && front.L.along < 0.6) || (place && place.ahead < 1)) top = Math.min(top, HAND.inSlow);
    const target = go * top;
    const acc = Math.abs(target) > Math.abs(s.v) && Math.sign(target) === Math.sign(s.v || target) ? HAND.speedUp : HAND.slowDown;
    s.v += Math.sign(target - s.v) * Math.min(Math.abs(target - s.v), acc * dt);
    // THE MOVE, a little at a time, each pose looked at: the first that would go into anything is not taken
    let left = s.v * dt;
    const n = Math.max(1, Math.ceil(Math.abs(left) / HAND.step)), ds = left / n;
    for (let i = 0; i < n; i++) {
      const [ax, az] = axleOf(s);
      const h1 = s.h + ds * s.curv, f = fwd((s.h + h1) / 2);
      let p = poseAt(ax + f[0] * ds, az + f[1] * ds, h1);
      // (lining itself up as it goes: on a pallet it goes in under, or on a place it sets one down in)
      const F = inFront(W), Q = placeNear(W);
      const ent = s.under ?? (F ? F.q.i : null);
      if (ent != null) {
        const q = W.pallets.find((x) => x.i === ent);
        if (q) { const L = lineUp(p, q.at, [q.h, q.h + Math.PI]); if (L && L.along < HAND.line.near) p = easeOnto(p, q.at, L.axis, Math.min(1, Math.abs(ds) * HAND.line.pull * (s.under != null ? 3 : 1))); }
      } else if (Q && ds > 0 && Q.ahead < HAND.line.near) {
        p = easeOnto(p, Q.q.at, Q.axis, Math.min(1, Math.abs(ds) * HAND.line.pull));
      }
      if (ent != null && s.under == null) { const q = W.pallets.find((x) => x.i === ent); if (q && s.lift > underDeck(q.y) - 0.025) s.lift = Math.max(underDeck(q.y) - 0.025, s.lift - HAND.down * 2 * Math.abs(ds) / Math.max(1e-3, Math.abs(s.v))); }
      const before = clearance(s, s, W, ent), after = clearance(p, s, W, ent);
      // (never into anything; a pose already touching something, someone who walked up to it, may still move away)
      if (worse(before, after)) { ev.blocked = after.what; s.v = 0; break; }
      s.x = p.x; s.z = p.z; s.h = wrap(p.h);
      // (in under it: its forks' tips have gone in past the pallet's near end; out from under it: out past it again)
      const q = ent != null ? W.pallets.find((x) => x.i === ent) : null, L = q ? lineUp(s, q.at, [q.h, q.h + Math.PI]) : null;
      if (s.under == null && q && L && L.along < 0 && lined(L)) s.under = q.i;
      else if (s.under != null && (!q || !L || L.along > 0.02)) s.under = null;
    }
    // THE FORKS
    if (fk) {
      let lo = FORKS.low, hi = HAND.top;
      if (s.under != null) {
        const q = W.pallets.find((x) => x.i === s.under), L = q && lineUp(s, q.at, [q.h, q.h + Math.PI]);
        // (all the way in: up takes the pallet; not yet, the forks stay under its deck)
        const deep = q && L && L.along < -(TRUCK.tips - TRUCK.face - ON_FORKS.gap) + HAND.deep;
        if (!deep) { hi = underDeck(q ? q.y : 0); if (fk > 0 && s.lift >= hi - 1e-4) ev.why = 'deeper'; }
      }
      if (s.carry != null) {
        const P = placeNear(W);
        const ready = P && P.d < HAND.reach && Math.abs(P.side) < 0.12;
        if (!ready) { lo = Math.max(lo, FORKS.carry); if (fk < 0 && s.lift <= lo + 1e-4) ev.why = P ? 'line' : 'place'; }
      }
      const was = s.lift;
      s.lift = Math.max(lo, Math.min(hi, s.lift + fk * (fk > 0 ? HAND.up : HAND.down) * dt));
      // taking it up: the forks lift it off where it stood
      if (s.under != null && s.lift > underDeck(0) + 0.001) {
        const q = W.pallets.find((x) => x.i === s.under);
        if (q && palletFoot(s.lift) > q.y + 1e-4) { s.carry = q.i; s.under = null; ev.took = q; }
      }
      // setting it down: over its place, lined up exactly as it goes down, standing there once it is down on it
      if (s.carry != null && fk < 0 && s.lift < was) {
        const P = placeNear(W);
        if (P && P.d < HAND.reach) {
          const target = poseFor(P.q.at, P.axis), t = Math.min(1, (was - s.lift) / Math.max(0.02, was - (underDeck(P.q.y) - 0.01)));
          const p = { x: s.x + (target.x - s.x) * t, z: s.z + (target.z - s.z) * t, h: s.h + wrap(target.h - s.h) * t };
          if (!worse(clearance(s, s, W), clearance(p, s, W))) { s.x = p.x; s.z = p.z; s.h = wrap(p.h); }
          if (palletFoot(s.lift, P.q.y) <= P.q.y + 1e-4) {
            Object.assign(s, { x: target.x, z: target.z, h: target.h });
            ev.set = P.q.id; ev.placed = { i: s.carry, q: P.q, h: P.axis }; s.under = s.carry; s.carry = null;
          }
        }
      }
    }
    return ev;
  };
  return D;
}
