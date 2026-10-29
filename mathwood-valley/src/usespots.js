// THE LOOK-TO-USE SPOTS IN THE GAME: inside a code-built building, on foot, the spot most directly in front of the view
// (within reach) gets the one prompt, floating over the spot itself ("E: Buy food" over the store's apple barrel, "E:
// Work the counter" over the counter); turning to another spot moves it there. The rules (which spot is in front) are
// src/usespotsplan.js; the spots themselves are each building's recipe anchors (labs/buildings/store.js, sheriff.js:
// anchors.spots), carried into the world and given their words and what E does by src/townrooms.js. One system for every
// inside: a later building adds its spots the same way.
//
//   const US = makeUseSpots({ W, camera, player })
//   US.add(o, spots) -> remove()   o: the building's object (W.V.CODE.find(kind)); spots: [{ ...inFrame(spot) (x, z or
//                       x0..z1, at, reach), words() -> the prompt's words now, or null (not usable now: left out), act() }]
//   US.update()        each frame, before the prompt is chosen (src/main.js doors)
//   US.prompt          the words of the spot in front, or null;  US.act()  does what E does there
//   US.spot            the spot in front (its record) or null;  US.angle  how far off dead ahead it is (degrees: the
//                       doorway's own Open the door competes on the same terms in main.js)
//   US.face            the way the view looks along the ground, { x, z } (unit);  US.at  where the spot in front is ({ x, z }:
//                       the one E action's arbitration, src/main.js doors)
//   US.screen()        where on the page the prompt floats: just over the spot's `at` (a long one: over the point of it
//                       the view is aimed at, at `at`'s height), { x, y }, or null when it is off
//                       the screen (the prompt then sits at the bottom as by a door)
//   US.inside()        the building the player stands in now, under its roof (its object), or null
//   US.state()         for rigs: { inside, spot, prompt, angle, at (the screen point), spots: [...] }
import * as THREE from 'three';
import { pickSpot, aimAt } from './usespotsplan.js';

export function makeUseSpots({ W, camera, player }) {
  const CODE = W.V && W.V.CODE;
  const groups = [];
  const US = { prompt: null, spot: null, angle: Infinity, face: { x: 0, z: 1 } };
  const _v = new THREE.Vector3(), anchor = new THREE.Vector3();
  let room = null;

  US.add = (o, spots) => {
    const g = { o, spots: spots.filter(Boolean) };
    groups.push(g);
    return () => { const i = groups.indexOf(g); if (i >= 0) groups.splice(i, 1); };
  };
  US.inside = () => room;
  function clear() { US.prompt = null; US.spot = null; US.angle = Infinity; }
  US.update = () => {
    const pl = player && player();
    room = null;
    if (!pl || !CODE || !groups.length || pl.mode !== 'foot' || pl.enabled === false) { clear(); return; }
    // (in through its door: out on its porch, under the porch roof, the spots inside aren't to hand through the wall)
    const at = pl.position;
    room = CODE.indoors ? CODE.indoors(at.x, at.y + 1.0, at.z) : ((CODE.room(at.x, at.y + 1.0, at.z) || {}).o || null);
    const g = room && groups.find((q) => q.o === room);
    if (!g) { clear(); return; }
    camera.getWorldDirection(_v);
    const fl = Math.hypot(_v.x, _v.z) || 1; US.face = { x: _v.x / fl, z: _v.z / fl };
    // (only the spots usable now: their words worked out once a frame)
    const live = [];
    for (const s of g.spots) { let w = null; try { w = s.words ? s.words() : null; } catch (e) { w = null; } s.now = w; if (w) live.push(s); }
    const pick = pickSpot(live, at, US.face, { current: US.spot && live.includes(US.spot) ? US.spot : null });
    US.spot = pick || null; US.prompt = pick ? pick.now : null;
    const q = pick ? aimAt(at, US.face, pick) : null;
    US.angle = q ? q.angle : Infinity;
    // (where the prompt floats: over a point spot's own place; along a long one, over where the view is aimed at it)
    if (pick) { if (Number.isFinite(pick.x0)) anchor.set(q.x, pick.at.y, q.z); else anchor.set(pick.at.x, pick.at.y, pick.at.z); }
    US.at = pick ? { x: anchor.x, z: anchor.z } : null;
  };
  US.act = () => { const s = US.spot; if (s && s.act) s.act(); };
  US.screen = () => {
    const s = US.spot; if (!s) return null;
    _v.copy(anchor).project(camera);
    if (_v.z > 1 || Math.abs(_v.x) > 1.02 || Math.abs(_v.y) > 1.02) return null;
    return { x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight };
  };
  US.state = () => ({ inside: room ? room.it.kind : null, spot: US.spot ? US.spot.id : null, prompt: US.prompt, angle: Number.isFinite(US.angle) ? +US.angle.toFixed(1) : null, at: US.screen(),
    spots: groups.flatMap((g) => g.spots.map((s) => ({ id: s.id, kind: g.o.it.kind, x: +s.x.toFixed(2), z: +s.z.toFixed(2), words: s.now ?? null, at: [s.at.x, s.at.y, s.at.z].map((v) => +v.toFixed(2)) }))) });
  US.dispose = () => { groups.length = 0; clear(); };
  return US;
}
