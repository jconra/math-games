// WHO IS ABOARD A SHIP, AND WHAT EACH IS DOING: the ship's crew seen aboard on a run (src/trip.js), and every seat and
// bed of its rooms as a place to sit or lie, for the crew and for the player alike. Nothing here is the Miner's own: the
// places are read from the ship's own blueprint (its rooms, doors and furniture, kit/ships/<ship>.blueprint.json) and the
// ship is the boarding's record of it (src/boarding.js), so any ship that can be boarded has them.
//
// THE GAME'S MAKER (2026-11-19): "I want the ability for the crew to walk around on ships. In this mission, if you are
// just an engineer, then the other 2 models can just sit in the chairs the entire time. But if you were a pilot, driller
// and engineer, then when you get up to go work in the back then you should see someone else walking, sitting, or laying
// down in the ship. Later on when you can hire crew for your own ship I want you to be able to see them on your ship,
// even if they are just along for the ride. So we might as well build it now." And: "it would be great if the seats and
// beds on the ships could be used by the npcs or the player." Of the captain coming aboard (2026-11-18): "it is fine to
// just have them pop into existence on the ship once you click the pilots seat ... it would be nice for the others to go
// with you and stay out of your way if you need to run back to engineering and stuff."
//
// SO:
//   - THE LIST (src/missions.js aboardOf: who, and their jobs). Someone whose job has a seat (the pilot's, the drill's:
//     the cockpit's seats, in the blueprint's order, the one named for the pilot first) sits in it the whole run. Anyone
//     else is along for the ride: they sit on a seat or a bench, or lie on a bed, for a while, and walk to another.
//     Hired crew would be more of the list, each with their jobs or none.
//   - THE PLACES (placesOf): every seat, bench (one place to each 0.6 m of it) and bed (the lower berth of a bunk) of
//     the ship's rooms. A place someone is using is nobody else's; the crew member's own seat for their job is theirs.
//   - WALKING: from a place to the next through the rooms' doors, at an easy pace (a step aside asks the cabin's walls
//     as the player feels them); never nearer than PASS.apart to anyone (src/passing.js: the player, each other).
//     MET HEAD ON, the player coming or another of the crew, where the floor is wide enough for two to go by each other
//     shoulder past shoulder (the Miner's airlock): each keeps to their own right and they pass (the game's maker,
//     2026-11-20: "If everyone walked toward the right side then they should be able to pass eachother"; the player is
//     not steered, the crew make room on their right). WHERE IT IS TOO NARROW FOR TWO TO PASS FORWARD (the Miner's
//     mess past its table, its bunks' aisle, its doors: 0.75 to 0.8 m) they squeeze past each other (the game's maker,
//     2026-11-21: "In the narrow places too, he turns side-on and you squeeze past each other"; "it should slow them
//     down to half speed"): each to the side of the passage, turned side-on facing the other, stepping sideways, their
//     middles as near as PASS.squeeze, both at half speed while their bodies overlap. Only where even that does not fit
//     (nowhere in the Miner), or the player stands square in the way, they wait and, the player still coming on at them
//     after a moment (WALK.back), turn back to the place they just left and sit or lie there again, out of the way
//     (aboardplan.js walkStep, inTheWay, wayBack); on again as ever once their while there is up; two of the crew so
//     met, one turns back; two in each other's way otherwise, the later in the list makes way. The
//     last step, from beside a seat onto it, is never waited over: sitting down takes them out of the way. (Waiting
//     alone, the two stood face to face for good: the walk out of the Miner after a run, through its mess to the lift,
//     was stopped by the captain standing in it, 2026-11-20.)
//   - DRAWN WHERE THE SHIP IS: each figure is placed in the ship's own frame and drawn by the ship's matrix just now
//     (late(M)): parked, flown about the station, or out in the field (the same one matrix as the player on their feet).
//   - LYING: the figure laid on its back along the bed, its head at the bed's head end (not climbed into: it is there).
//
//   const A = await makeAboard({ people, ship, crew, cockpitFloor, mine, walls })
//       ship: the boarding's record (bpData, space.deck, M); crew: [{ id, name, look, jobs }]; cockpitFloor: the
//       cockpit's seats' floor over the ship's ground line (the flying's own seat); mine: the player's own seat's job;
//       walls: src/walls.js (no walls: the blueprint's own floor, aboardplan.js floorOf)
//   A.update(dt, { player: { pos (the walking frame) } | null })   A.late(M)   M: the ship's kit frame in the world now
//   A.near(pos) -> the free place within reach of the player (pos: the walking frame), or null
//   A.take(place, who) / A.free(who)   A.places, A.list, A.state(), A.dispose()
//   A.lend(id) -> { c, name, pos, heading, home } | null   ONE OF THEM OFF THE SHIP FOR A WHILE (a rescue's paramedic,
//       down the ramp to the pods: src/rescued.js walks them out there): up from where they sit or lie; their figure is
//       the borrower's to place and move (c: the crew kit's person) until A.back(id); pos, heading: where they stand
//       now, in the ship's own frame; home: the seat kept for them to come back to (a free one: its `stand`, where one
//       stands to sit down on it). Meanwhile nothing here moves or draws them, and nobody aboard walks round them.
//   A.back(id)   aboard again: sat down on the seat kept for them, and along for the ride as before
import * as THREE from 'three';
import { placesOf, wayOf, walkStep, wayBack, floorOf, WALK, BED, CLIP } from './aboardplan.js';
import { shine } from './player.js';
export { placesOf, wayOf };

export async function makeAboard({ people, ship: s, crew = [], cockpitFloor = null, mine = null, rand = Math.random, walls = null }) {
  // (the cockpit's floor over the deck: the ship's own module's (boarding's SHIPS `cockpit`), else what was given)
  const bp = s.bpData, places = placesOf(bp, { deck: s.space.deck, cockpitFloor: s.cockpit && Number.isFinite(s.cockpit.floor) ? s.cockpit.floor : cockpitFloor });
  const mineP = mine ? places.find((p) => p.job === mine) : null;
  const users = new Map();      // place.id -> who ('player' or a crew member's id)
  const list = [];
  for (const m of crew) {
    const c = people && people.figure ? await people.figure(m.look || m.id) : null; if (!c) continue;
    c.root.matrixAutoUpdate = false; if (s.cabin && s.cabin.env) shine(c, s.cabin.env);
    const W = { id: m.id, name: m.name, jobs: [...(m.jobs || [])], c, place: null, doing: 'stand', pos: new THREE.Vector3(), heading: 0, way: null, t: 0, stay: 0, clip: '', wait: 0, turned: 0,
      posW: new THREE.Vector3(), hidden: false, away: false };
    list.push(W);
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _v = new THREE.Vector3(), inv = new THREE.Matrix4();
  // (a place is free if nobody has it, it is not the player's own seat nor a seat someone's job has, and nobody else is
  // still getting up and away from it: they would be walked into, 2026-11-20)
  const free = (p, who = null) => !users.has(p.id) && p !== mineP && !(p.job && list.some((w) => w.jobs.includes(p.job)))
    && !list.some((w) => w !== who && w.doing === 'walk' && w.from === p && Math.hypot(w.pos.x - p.stand[0], w.pos.z - p.stand[1]) < 1.2);
  // (where a body can stand on the cabin's deck, in the ship's own frame: its walls as the player feels them, every door
  // that opens counted open (they walk through as ever); no walls handed over: the blueprint's own floor)
  const _fp = new THREE.Vector3();
  const floor = walls ? (x, z) => { _fp.set(x, s.space.deck, z).applyMatrix4(s.M); return walls.free(_fp.x, _fp.y, _fp.z, undefined, true); } : floorOf(bp);
  // (how near its walls let a body's middle: the cabin's own, as walls.js has it (src/boarding.js CABIN_WALLS.r))
  const cabin = walls && walls.parts ? walls.parts.get('cabin:' + s.id) : null, wall = cabin && cabin.r ? cabin.r : floor.r || 0.15;
  // (the rest aboard, as someone walking meets them: where each is, walking or not, which way, and whether they come
  // before W in the list: two who cannot pass, the later turns back first)
  const othersOf = (W) => list.filter((Q) => Q !== W && !Q.out).map((Q) => ({ x: Q.pos.x, z: Q.pos.z, walking: Q.doing === 'walk', heading: Q.heading, held: Q.doing === 'walk' && Q.wait > 0.3, first: list.indexOf(Q) < list.indexOf(W) }));
  const play = (W, n, fade = 0.35, speed = 1) => { if (W.clip !== n) { W.c.play(n, { fade, speed }); W.clip = n; } };
  const take = (p, who) => { for (const [k, v] of users) if (v === who) users.delete(k); if (p) users.set(p.id, who); };
  // (a place as a figure uses it: where its root is and which way it is turned, in the ship's own frame)
  function seatAt(W, p) { W.place = p; W.doing = p.kind; W.pos.set(p.x, p.y, p.z); W.heading = p.heading; play(W, p.kind === 'sit' ? CLIP.sit : CLIP.stand, 0); }
  // (there, and how long they stay)
  function arrive(W, p) { W.way = null; W.side = 0; W.sideAim = 0; seatAt(W, p); W.t = 0; W.stay = p.kind === 'lie' ? WALK.lie[0] + rand() * (WALK.lie[1] - WALK.lie[0]) : WALK.sit[0] + rand() * (WALK.sit[1] - WALK.sit[0]); }
  // POP IN (the game's maker: "it is fine to just have them pop into existence on the ship"): each in the seat their
  // job has, or the others somewhere along for the ride
  for (const W of list) {
    const own = places.find((p) => p.job && W.jobs.includes(p.job));
    const p = own || places.filter((q) => free(q)).sort(() => rand() - 0.5).find((q) => q.kind === 'sit') || places.find((q) => free(q));
    if (p) { take(p, W.id); seatAt(W, p); W.stay = own ? Infinity : WALK.sit[0] + rand() * (WALK.sit[1] - WALK.sit[0]); }
  }
  // ON TO THE NEXT PLACE (along for the ride): a free one, sitting or lying, through the rooms' doors
  function goNext(W) {
    const opts = places.filter((p) => free(p, W) && p !== W.place);
    if (!opts.length) { W.stay = 10; return; }
    const p = opts[Math.floor(rand() * opts.length)], way = wayOf(bp, W.place ? W.place.room : p.room, p.room);
    if (!way) { W.stay = 10; return; }
    // (up out of the seat and off along the way: from where they sit to where one stands by it, the doors, and to where
    // one stands by the next; a seat is sat down on from there, a bed is lain on)
    const from = W.place ? [W.place.stand[0], W.place.stand[1]] : [W.pos.x, W.pos.z];
    take(p, W.id);
    W.way = [from, ...way, p.stand, ...(p.kind === 'sit' ? [[p.x, p.z]] : [])].map(([x, z]) => new THREE.Vector3(x, s.space.deck, z)); W.target = p; W.leg = 0; W.doing = 'walk'; W.from = W.place; W.place = null; W.getUp = !!W.from;
    W.pos.y = s.space.deck; play(W, CLIP.walk);
  }
  // TURNED BACK, the player in the way and pressing on (inTheWay 'back'): to the place just left, back along the way
  // already walked, if it is still free; the place they were going to is free again (and is the one to turn back to,
  // should they be met again). false: nowhere to turn back to (they wait, as before)
  function turnBack(W) {
    const p = W.from; if (!p || !free(p, W)) return false;
    const back = wayBack(W.way.slice(0, W.leg).map((v) => [v.x, v.z]), p);
    take(p, W.id); W.from = W.target; W.target = p; W.wait = 0; W.turned++;
    if (!back.length) { arrive(W, p); return true; }
    W.way = back.map(([x, z]) => new THREE.Vector3(x, s.space.deck, z)); W.leg = 0; W.getUp = false;
    return true;
  }
  function update(dt, { player = null } = {}) {
    inv.copy(s.M).invert();
    const pp = player && player.pos ? _p.copy(player.pos).applyMatrix4(inv) : null;
    for (const W of list) {
      if (W.out) continue;      // (off the ship just now: the borrower's, A.lend)
      W.t += dt;
      if (W.doing === 'walk') {
        // (on along the way: aboardplan.js walkStep. Met head on where it is wide enough for two, the player or another
        // of the crew: each to their own right, and past. Where it is too narrow: they wait for the player to pass;
        // still coming on after a moment: turned back to the place just left, out of their way)
        const r = walkStep(W, dt, pp, { others: othersOf(W), free: floor, wall });
        if (r === 'back' && turnBack(W)) { if (W.doing === 'walk') play(W, CLIP.walk); }
        else if (r === 'wait' || r === 'back') { play(W, CLIP.stand); W.wait += dt; }
        else if (r === 'aside') { play(W, CLIP.walk); W.wait += dt; }      // (making way: a step back out of someone's way)
        else {
          // (walking, on the cabin's deck; there, at the place's own height: a bunk's bed, the flight deck's seats. The
          // deck was set after arriving once, so someone who walked to a bunk lay 0.42 m low, in its base. Turned
          // side-on squeezing past someone: stepping sideways, CLIP.side)
          if (Math.abs(W.side || 0) > 0.8) play(W, W.side > 0 ? CLIP.side[1] : CLIP.side[0], 0.2, CLIP.sideSpeed); else play(W, CLIP.walk);
          W.pos.y = s.space.deck;
          if (r === 'there') arrive(W, W.target);
        }
      } else if (W.t > W.stay && !(pp && W.place && Math.hypot(pp.x - W.place.stand[0], pp.z - W.place.stand[1]) < WALK.room)) { W.t = 0; goNext(W); }
      // (in the ship's own frame: lying, laid on the back along the bed, the head toward its head end)
      if (W.doing === 'lie') {
        const h = W.heading, hx = Math.sin(h), hz = Math.cos(h);
        _q.setFromEuler(_e.set(-Math.PI / 2, Math.atan2(-hx, -hz), 0, 'YXZ'));
        _m.compose(_v.set(W.pos.x - hx * BED.feet, W.pos.y + BED.back, W.pos.z - hz * BED.feet), _q, _s);
      } else { _q.setFromEuler(_e.set(0, W.heading + (W.doing === 'walk' ? W.side || 0 : 0), 0)); _m.compose(W.pos, _q, _s); }
      W.local = (W.local || new THREE.Matrix4()).copy(_m);
      W.c.root.matrix.copy(_m); W.c.root.matrixWorldNeedsUpdate = true; W.c.root.updateMatrixWorld(true);
      W.c.setEyes(W.doing === 'lie' ? 'shut' : 'blink');     // (lying on a bed to rest: eyes shut, kit/lids.js)
      W.c.update(dt);
      W.posW.copy(W.pos).applyMatrix4(s.M);      // (for the player's own walking: someone is there)
    }
  }
  // drawn where the ship is just now (M: its kit frame in the world)
  function late(M, scene) {
    for (const W of list) {
      if (scene && !W.c.root.parent) scene.add(W.c.root);
      if (W.out) continue;
      if (W.local) { W.c.root.matrix.multiplyMatrices(M, W.local); W.c.root.matrixWorldNeedsUpdate = true; }
    }
  }
  // the free place within reach of the player (pos: the walking frame), or null
  function near(pos) {
    _p.copy(pos).applyMatrix4(inv.copy(s.M).invert());
    let best = null, bd = WALK.reach;
    for (const p of places) { if (!free(p) && users.get(p.id) !== 'player') continue; const d = Math.min(Math.hypot(_p.x - p.x, _p.z - p.z), Math.hypot(_p.x - p.stand[0], _p.z - p.stand[1])); if (d < bd && Math.abs(_p.y - (p.y - (p.kind === 'lie' ? BED.pad : 0))) < 0.9) { bd = d; best = p; } }
    return best;
  }
  // (where a place's figure goes, as a matrix in the ship's own frame: the player's own body, sitting or lying there)
  function poseOf(p, out = new THREE.Matrix4()) {
    if (p.kind === 'lie') { const hx = Math.sin(p.heading), hz = Math.cos(p.heading); _q.setFromEuler(_e.set(-Math.PI / 2, Math.atan2(-hx, -hz), 0, 'YXZ')); return out.compose(_v.set(p.x - hx * BED.feet, p.y + BED.back, p.z - hz * BED.feet), _q, _s); }
    _q.setFromEuler(_e.set(0, p.heading, 0)); return out.compose(_v.set(p.x, p.y, p.z), _q, _s);
  }
  // OFF THE SHIP FOR A WHILE, AND BACK (the header): up from their place (it is free again, unless it is the seat kept
  // for them: a seat nobody has and no job has, off the flight deck first (the one they sit on, if it is such a one);
  // a seat up on the flight deck only if there is no other)
  function lend(id) {
    const W = list.find((w) => w.id === id); if (!W || W.out) return null;
    const ok = (p) => p.kind === 'sit' && (users.get(p.id) === W.id || free(p, W));
    const at = W.place || W.target || null, here = W.doing === 'walk' ? null : at;
    const home = (here && ok(here) && !here.cockpit ? here : null) || places.find((p) => ok(p) && !p.cockpit) || (here && ok(here) ? here : null) || places.find((p) => ok(p)) || here || at;
    // (on their feet where one stands by the place they were in, on its own floor (a seat's is its room's: the flight
    // deck's seats stand higher than the cabin's deck, and stood under that floor no way out was found); walking, where
    // they are)
    const pos = here ? new THREE.Vector3(here.stand[0], here.kind === 'sit' ? here.y : s.space.deck, here.stand[1]) : new THREE.Vector3(W.pos.x, s.space.deck, W.pos.z);
    take(home, W.id);
    Object.assign(W, { out: true, doing: 'out', way: null, place: null, target: home, from: null, side: 0, sideAim: 0, wait: 0, clip: '' });
    W.c.root.matrixAutoUpdate = true; W.c.setEyes('blink');
    return { c: W.c, name: W.name, pos, heading: W.heading, home };
  }
  function back(id) {
    const W = list.find((w) => w.id === id); if (!W || !W.out) return false;
    W.out = false; W.c.root.matrixAutoUpdate = false; W.clip = '';
    const p = W.target; W.target = null;
    if (p) arrive(W, p); else { W.doing = 'stand'; W.t = 0; W.stay = 5; }
    return true;
  }
  function dispose() { for (const W of list) { if (W.c.root.parent) W.c.root.parent.remove(W.c.root); W.c.dispose(); } list.length = 0; users.clear(); }
  return { places, list, update, late, near, poseOf, take, lend, back, free: (who) => take(null, who), user: (p) => users.get(p.id) || null, mine: mineP, dispose,
    // (for the player's own walking: the crew are people to walk round, where they are just now)
    get others() { return list.filter((W) => !W.out).map((W) => ({ pos: W.posW, hidden: false, away: false, walking: W.doing === 'walk' })); },
    state: () => ({ list: list.map((W) => ({ id: W.id, jobs: W.jobs, doing: W.doing, place: W.place ? W.place.id : W.target ? '-> ' + W.target.id : null, pos: W.pos.toArray().map((v) => +v.toFixed(2)), wait: +W.wait.toFixed(1), turned: W.turned })), places: places.map((p) => ({ id: p.id, kind: p.kind, room: p.room, job: p.job, user: users.get(p.id) || null })) }) };
}
