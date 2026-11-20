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
//   - WALKING: from a place to the next through the rooms' doors, at an easy pace; never nearer than WALK.room to the
//     player: in a narrow passage they wait for the player to pass (the station's people step aside in a corridor; a
//     ship's doors are too narrow to step aside in, so they wait in the room).
//   - DRAWN WHERE THE SHIP IS: each figure is placed in the ship's own frame and drawn by the ship's matrix just now
//     (late(M)): parked, flown about the station, or out in the field (the same one matrix as the player on their feet).
//   - LYING: the figure laid on its back along the bed, its head at the bed's head end (not climbed into: it is there).
//
//   const A = await makeAboard({ people, ship, crew, cockpitFloor, mine })
//       ship: the boarding's record (bpData, space.deck, M); crew: [{ id, name, look, jobs }]; cockpitFloor: the
//       cockpit's seats' floor over the ship's ground line (the flying's own seat); mine: the player's own seat's job
//   A.update(dt, { player: { pos (the walking frame) } | null })   A.late(M)   M: the ship's kit frame in the world now
//   A.near(pos) -> the free place within reach of the player (pos: the walking frame), or null
//   A.take(place, who) / A.free(who)   A.places, A.list, A.state(), A.dispose()
import * as THREE from 'three';
import { placesOf, wayOf, WALK, BED, CLIP } from './aboardplan.js';
import { shine } from './player.js';
export { placesOf, wayOf };

export async function makeAboard({ people, ship: s, crew = [], cockpitFloor = null, mine = null, rand = Math.random }) {
  // (the cockpit's floor over the deck: the ship's own module's (boarding's SHIPS `cockpit`), else what was given)
  const bp = s.bpData, places = placesOf(bp, { deck: s.space.deck, cockpitFloor: s.cockpit && Number.isFinite(s.cockpit.floor) ? s.cockpit.floor : cockpitFloor });
  const mineP = mine ? places.find((p) => p.job === mine) : null;
  const users = new Map();      // place.id -> who ('player' or a crew member's id)
  const list = [];
  for (const m of crew) {
    const c = people && people.figure ? await people.figure(m.look || m.id) : null; if (!c) continue;
    c.root.matrixAutoUpdate = false; if (s.cabin && s.cabin.env) shine(c, s.cabin.env);
    const W = { id: m.id, name: m.name, jobs: [...(m.jobs || [])], c, place: null, doing: 'stand', pos: new THREE.Vector3(), heading: 0, way: null, t: 0, stay: 0, clip: '', wait: 0,
      posW: new THREE.Vector3(), hidden: false, away: false };
    list.push(W);
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _v = new THREE.Vector3(), inv = new THREE.Matrix4();
  const free = (p) => !users.has(p.id) && p !== mineP && !(p.job && list.some((w) => w.jobs.includes(p.job)));
  const play = (W, n, fade = 0.35) => { if (W.clip !== n) { W.c.play(n, { fade }); W.clip = n; } };
  const take = (p, who) => { for (const [k, v] of users) if (v === who) users.delete(k); if (p) users.set(p.id, who); };
  // (a place as a figure uses it: where its root is and which way it is turned, in the ship's own frame)
  function seatAt(W, p) { W.place = p; W.doing = p.kind; W.pos.set(p.x, p.y, p.z); W.heading = p.heading; play(W, p.kind === 'sit' ? CLIP.sit : CLIP.stand, 0); }
  // POP IN (the game's maker: "it is fine to just have them pop into existence on the ship"): each in the seat their
  // job has, or the others somewhere along for the ride
  for (const W of list) {
    const own = places.find((p) => p.job && W.jobs.includes(p.job));
    const p = own || places.filter(free).sort(() => rand() - 0.5).find((q) => q.kind === 'sit') || places.find(free);
    if (p) { take(p, W.id); seatAt(W, p); W.stay = own ? Infinity : WALK.sit[0] + rand() * (WALK.sit[1] - WALK.sit[0]); }
  }
  // ON TO THE NEXT PLACE (along for the ride): a free one, sitting or lying, through the rooms' doors
  function goNext(W) {
    const opts = places.filter((p) => free(p) && p !== W.place);
    if (!opts.length) { W.stay = 10; return; }
    const p = opts[Math.floor(rand() * opts.length)], way = wayOf(bp, W.place ? W.place.room : p.room, p.room);
    if (!way) { W.stay = 10; return; }
    // (up out of the seat and off along the way: from where they sit to where one stands by it, the doors, and to where
    // one stands by the next; a seat is sat down on from there, a bed is lain on)
    const from = W.place ? [W.place.stand[0], W.place.stand[1]] : [W.pos.x, W.pos.z];
    take(p, W.id);
    W.way = [from, ...way, p.stand, ...(p.kind === 'sit' ? [[p.x, p.z]] : [])].map(([x, z]) => new THREE.Vector3(x, s.space.deck, z)); W.target = p; W.leg = 0; W.doing = 'walk'; W.place = null;
    W.pos.y = s.space.deck; play(W, CLIP.walk);
  }
  function update(dt, { player = null } = {}) {
    inv.copy(s.M).invert();
    const pp = player && player.pos ? _p.copy(player.pos).applyMatrix4(inv) : null;
    for (const W of list) {
      W.t += dt;
      if (W.doing === 'walk') {
        const to = W.way[W.leg]; _v.set(to.x - W.pos.x, 0, to.z - W.pos.z);
        const L = _v.length(), want = Math.atan2(_v.x, _v.z), diff = Math.atan2(Math.sin(want - W.heading), Math.cos(want - W.heading));
        W.heading += Math.sign(diff) * Math.min(Math.abs(diff), WALK.turn * dt);
        // (the player in the way, near and ahead: wait for them to pass)
        const ahead = pp && Math.hypot(pp.x - W.pos.x, pp.z - W.pos.z) < WALK.room + 0.5 && ((pp.x - W.pos.x) * Math.sin(W.heading) + (pp.z - W.pos.z) * Math.cos(W.heading)) > 0;
        if (ahead) { play(W, CLIP.stand); W.wait += dt; }
        else {
          W.wait = 0; play(W, CLIP.walk);
          const step = Math.min(L, WALK.speed * dt * (Math.abs(diff) > 1 ? 0.3 : 1));
          if (L > 1e-4) W.pos.addScaledVector(_v.normalize(), step);
          if (L - step < 0.05) { W.leg++; if (W.leg >= W.way.length) { const p = W.target; W.way = null; seatAt(W, p); W.t = 0; W.stay = p.kind === 'lie' ? WALK.lie[0] + rand() * (WALK.lie[1] - WALK.lie[0]) : WALK.sit[0] + rand() * (WALK.sit[1] - WALK.sit[0]); } }
          // (the floor: each room's own)
          W.pos.y = s.space.deck;
        }
      } else if (W.t > W.stay && !(pp && W.place && Math.hypot(pp.x - W.place.stand[0], pp.z - W.place.stand[1]) < WALK.room)) { W.t = 0; goNext(W); }
      // (in the ship's own frame: lying, laid on the back along the bed, the head toward its head end)
      if (W.doing === 'lie') {
        const h = W.heading, hx = Math.sin(h), hz = Math.cos(h);
        _q.setFromEuler(_e.set(-Math.PI / 2, Math.atan2(-hx, -hz), 0, 'YXZ'));
        _m.compose(_v.set(W.pos.x - hx * BED.feet, W.pos.y + BED.back, W.pos.z - hz * BED.feet), _q, _s);
      } else { _q.setFromEuler(_e.set(0, W.heading, 0)); _m.compose(W.pos, _q, _s); }
      W.local = (W.local || new THREE.Matrix4()).copy(_m);
      W.c.root.matrix.copy(_m); W.c.root.matrixWorldNeedsUpdate = true; W.c.root.updateMatrixWorld(true);
      W.c.update(dt);
      W.posW.copy(W.pos).applyMatrix4(s.M);      // (for the player's own walking: someone is there)
    }
  }
  // drawn where the ship is just now (M: its kit frame in the world)
  function late(M, scene) {
    for (const W of list) {
      if (scene && !W.c.root.parent) scene.add(W.c.root);
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
  function dispose() { for (const W of list) { if (W.c.root.parent) W.c.root.parent.remove(W.c.root); W.c.dispose(); } list.length = 0; users.clear(); }
  return { places, list, update, late, near, poseOf, take, free: (who) => take(null, who), user: (p) => users.get(p.id) || null, mine: mineP, dispose,
    // (for the player's own walking: the crew are people to walk round, where they are just now)
    get others() { return list.map((W) => ({ pos: W.posW, hidden: false, away: false })); },
    state: () => ({ list: list.map((W) => ({ id: W.id, jobs: W.jobs, doing: W.doing, place: W.place ? W.place.id : W.target ? '-> ' + W.target.id : null, pos: W.pos.toArray().map((v) => +v.toFixed(2)), wait: +W.wait.toFixed(1) })), places: places.map((p) => ({ id: p.id, kind: p.kind, room: p.room, job: p.job, user: users.get(p.id) || null })) }) };
}
