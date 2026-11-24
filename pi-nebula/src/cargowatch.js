// CARGO'S PEOPLE WATCH A FORKLIFT LAP (2026-11-23, the game's maker, LAP1-3, of Cargo's people walking into a lap's way:
// "I think anyone in the area should get out of the way and watch. It would be good entertainment to watch some races.
// Id suggest getting anyone in the area to watch near the finish line."). The rules, as plain numbers:
// kit/forkliftlap.js (lapAt, clearToGo, RULES.wait); where they stand: kit/places-plan.js LAP.watch. Here, in the game:
//   CALLED     as the forklift stops on the start box (src/cargolap.js), everyone of Cargo's who is about is sent to a
//              place in the row along the lift's north wall, at the finish line's south end, on the outside of the lap's
//              last stretch (src/people.js send: the one small hook this needs there). They hurry; someone seated gets
//              up first. THEIR WAYS THERE keep off the lap's first two stretches (the south lane ahead of the start
//              box, the racks' west ends: where the forklift comes first): someone standing in one of those steps
//              straight out of it (no further along it than WATCH.out), someone in an aisle between the racks goes out
//              by its east end and round by the east lane and the last stretch, where the forklift comes last and
//              they, hurrying, are long gone.
//   THE LANE   clear() tells the lap whether anyone is still in the lane where the forklift could come on them: where
//              each is, the way they are walking and how fast (the lap's countdown waits for it, RULES.wait s at most).
//   WATCHING   stood in their place facing the lane, each turns to follow the forklift round (their feet a little, their
//              head and eyes the rest of the way: the people's own look, src/people.js `watch`).
//   A CHEER    at the finish, one of them (not the loader, who has their own word on the card) says a line of it, in a
//              bubble, words only (src/lines.js LAP_TALK.cheer).
//   BACK TO THEIR DAY  when the player gets off, or drives away from the lap (WATCH.away metres from the start box with
//              no lap running, WATCH.idle seconds with none begun, or a lap left running WATCH.long seconds).
// Should the forklift be driven at one of them all the same (on its way in or out), it waits for them, as it does for
// anyone.
//
//   const crowd = makeCargoWatch({ people, forklift })
//   crowd.call()            everyone to the finish line
//   crowd.clear()           -> { clear, who } nobody in the lane in the forklift's way (kit/forkliftlap.js clearToGo)
//   crowd.update(dt, { driving, s (the drive's state), phase (the lap's), clock (its clock) })   each frame
//   crowd.cheer(kind)       a line at the finish: 'beat' | 'slower' | 'missed'
//   crowd.release()         back to their day
//   crowd.state()           for the rigs
import * as THREE from 'three';
import { LAP, STORE } from '../kit/places-plan.js';
import { lapAt, clearToGo, keepOff, BOX } from '../kit/forkliftlap.js';
import { LAP_TALK } from './lines.js';

// hurry: how much faster than their own pace they come (times); away: the forklift this far from the start box (m) with
// no lap running, or idle so long (s) with none begun, or a lap running as `long` as this (s): they go back to their day; turn: how fast their feet turn to
// follow it (radians a second), and how far round from facing the lane (radians: their head does the rest); again: one
// who could not get to their place is sent again after this long (s), by any way there is; out: someone in the lap's
// first two stretches when called may walk this far along them (m) on their way out of them
export const WATCH = { hurry: 1.7, away: 15, idle: 40, long: 150, turn: 1.6, most: 1.15, again: 1.5, out: 3.2 };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function makeCargoWatch({ people = () => null, forklift }) {
  const S = { on: false, calls: 0, sent: 0, crossed: 0, cheers: 0, released: 0, last: null };
  // who has which place: place index -> person; person -> { i, t (since sent), cross (their way may cross the lane) }
  const at = new Map(), mine = new Map();
  let idleT = 0, seat = new THREE.Vector3();
  const crew = () => { const pp = people(); return pp ? pp.list.filter((q) => q.home === 'store' && !q.hidden && !q.away) : []; };
  const places = LAP.watch.map(([x, z]) => new THREE.Vector3(x, STORE.floor, z));
  // (the point they follow: the forklift's seat, a head's height up)
  const watch = (out) => { if (!S.on) return false; out.copy(seat); return true; };
  // (the floor their way keeps off: the lap's first two stretches, but for the little way round where they stand now)
  function send(P, i, cross = false) {
    const pp = people(); if (!pp || !pp.send) return false;
    const old = mine.get(P); if (old && at.get(old.i) === P) at.delete(old.i);
    at.set(i, P); mine.set(P, { i, t: 0, cross });
    S.sent++; if (cross) S.crossed++;
    const x0 = P.pos.x, z0 = P.pos.z, avoid = (x, z) => keepOff(x, z) && Math.hypot(x - x0, z - z0) > WATCH.out;
    return pp.send(P, { spot: { name: 'the finish line', pos: places[i].clone(), heading: LAP.look }, watch, avoid: cross ? null : avoid, hurry: WATCH.hurry });
  }
  const freePlace = (P, not = -1) => { let best = -1, bd = Infinity; places.forEach((p, i) => { if (i === not || (at.has(i) && at.get(i) !== P)) return; const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z); if (d < bd) { bd = d; best = i; } }); return best; };
  const watching = (P) => !!(P.act && P.act.sent && P.act.watch);

  const C = {
    get on() { return S.on; },
    call() {
      if (!S.on) { S.on = true; S.calls++; idleT = 0; }
      // (everyone not yet sent: the nearest place still free, whoever is nearest the row first)
      const mid = places[Math.floor(places.length / 2)], L = crew().filter((P) => !watching(P) && !P.sent).sort((a, b) => a.pos.distanceTo(mid) - b.pos.distanceTo(mid));
      for (const P of L) { const i = freePlace(P); if (i >= 0) send(P, i, !!(mine.get(P) && mine.get(P).cross)); }
    },
    // NOBODY IN THE LANE IN ITS WAY (the lap's countdown waits for this)
    clear() {
      const L = crew().map((P) => ({ at: [P.pos.x, P.pos.z], speed: P.speed, way: P.walking && P.way ? P.way.slice(P.wi || 0).map((p) => [p.x, p.z]) : null, id: P.id }));
      const r = clearToGo(L);
      S.last = r.clear ? null : { who: L[r.who].id, at: r.at };
      return r;
    },
    cheer(kind) {
      const pp = people(); if (!pp || !S.on) return null;
      // (one of them stood in their place, in sight, who is not the loader: the nearest the finish line)
      const L = crew().filter((P) => P.id !== LAP.who && watching(P) && P.act.phase === 'do' && P.shown).sort((a, b) => a.pos.x - b.pos.x);
      if (!L.length) return null;
      const P = L[0], words = pick(LAP_TALK.cheer[kind] || LAP_TALK.cheer.slower);
      pp.say(P, words, { kind: 'talk' }); S.cheers++;
      return { who: P.id, words };
    },
    release() {
      if (!S.on) return;
      const pp = people(); S.on = false; S.released++;
      if (pp && pp.send) for (const P of crew()) if (watching(P) || P.sent) pp.send(P, null);
      at.clear(); mine.clear();
    },
    update(dt, { driving = false, s = null, phase = 'idle', clock = 0 } = {}) {
      if (!S.on) return;
      // BACK TO THEIR DAY: off the forklift; or away from the lap with none running
      const far = s ? Math.hypot(s.x - BOX.c[0], s.z - BOX.c[1]) : Infinity;
      idleT = phase === 'idle' ? idleT + dt : 0;
      if (!driving || (phase === 'idle' && (far > WATCH.away || idleT > WATCH.idle)) || (phase === 'run' && clock > WATCH.long)) { C.release(); return; }
      const f = [Math.cos(s.h), -Math.sin(s.h)];
      seat.set(s.x - f[0] * 0.5, STORE.floor + 1.5, s.z - f[1] * 0.5);
      for (const P of crew()) {
        let m = mine.get(P);
        // (not sent yet: just come about; or their errand lost: no way found keeping off the lap's first stretches,
        // held up too long. Sent again after a moment, this time by any way there is)
        if (!watching(P) && !P.sent) {
          if (m) { m.t += dt; if (m.t < WATCH.again) continue; }
          const i = m && at.get(m.i) === P ? m.i : freePlace(P); if (i >= 0) send(P, i, !!m);
          continue;
        }
        if (!m || !watching(P)) continue;
        const a = P.act;
        if (a.phase !== 'do') continue;
        // WATCHING: their feet turned toward it, no further round than WATCH.most from facing the lane
        const to = Math.atan2(s.x - P.pos.x, s.z - P.pos.z), want = LAP.look + Math.max(-WATCH.most, Math.min(WATCH.most, wrap(to - LAP.look)));
        a.spot.heading = wrap(a.spot.heading + Math.sign(wrap(want - a.spot.heading)) * Math.min(Math.abs(wrap(want - a.spot.heading)), WATCH.turn * dt));
      }
    },
    state: () => ({ ...S, who: crew().map((P) => ({ id: P.id, place: mine.has(P) ? mine.get(P).i : null, watching: watching(P), there: !!(watching(P) && P.act.phase === 'do'), walking: !!P.walking, at: [+P.pos.x.toFixed(2), +P.pos.z.toFixed(2)], heading: +P.heading.toFixed(2), lane: lapAt(P.pos.x, P.pos.z) })) }),
  };
  return C;
}
