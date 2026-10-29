// THE JOB PEOPLE: a person at each job, who says what is going on and what to do, and thanks the player after. Old Hob
// stays the trail buddy with the hints; these folk do the "what's going on" (who they are and their lines:
// src/jobfolkplan.js):
//   the trail boss       by the corral's gate: his brand's cattle are mixed in with the big herd (the round-up)
//   the veterinarian     by the sheep pasture's gate at the farm: a sickness went through the flock (the sick sheep)
//   the farmer's wife    in the farm's lane by the pig yard: the wind blew the gate open (the loose pigs)
//   the naturalist       at her one spot, a good way off the deer job's one herd on the town's side, in the open
//                        with the herd in view and the meadow mown round her (STAND.natAt): E by her lends the camera
//                        (strapped behind the saddle at once); while it is lent she strolls after the player round her
//                        herd (never far from her own spot), and once it has been set up, E by her again gives it back
//   the sheriff          inside his office, behind his desk with the pile of seized lock boxes on it (the "Crack the
//                        lock boxes" spot there is src/townrooms.js's); a gold star on his chest and a six-shooter in
//                        its holster (folk.js badge and holster), as his deputy. (An office with no inside: out in
//                        front of it, to one side of the steps, E by him opening his desk)
//   the deputy           out in front of the office, to one side of the steps, when "Loot the gang" is ticked: the
//                        gang's stash out in the valley; carrying the loot back, E by him shares it out (src/missions/loot.js)
//   the storekeeper      behind the general store's counter (the rider helps him there: the store's job; the store's
//                        spots are src/townrooms.js's), bare-headed indoors
//   the blacksmith       in his shop at work (src/smithy.js): hammering at the anvil, now and then at the forge; he
//                        stops and turns to the rider who comes right up to him or while he says hello. No prompt
//   (the two indoors stand in their building's frame, src/townrooms.js roomFrame, once it is built; each says hello,
//   shows his tag and turns to the player only while the player is inside with him, and is drawn only while the
//   building's inside is)
//   the stable keeper    beside the stable's big doors: E by him opens the stable's counter (saddles and horses), and
//                        after something is bought there he thanks the player
//   the camp foremen     already at the camps (src/camps.js): here they get a name tag, a hello and the speech card for
//                        what the delivery job has them say
//   the miller           on the mill hill, the windmill job's own (src/windmilljob.js): here he gets his name tag, his
//                        hello (it goes with how far the tower has come: J.helloKey()) and turns to face the player;
//                        his prompt is the build site's ("Help the miller build his tower")
//   the old fisherman    at the foot of the dock on the lake south of town, the fishing job's own (src/fishingjob.js):
//                        here he gets his name tag and his hello; his prompt is the build site's ("Fish off the dock")
//   the engineer         on the north abutment of the ravine on the west river, the bridge job's own (src/bridgejob.js,
//                        standing in the bridge's turned frame): his name tag and hello; his prompt is the build site's
// Each stands with the idle clips, shows a name tag when the player is near, and turns to face the player close by.
//
// Talking: walking or riding up, the person says their two lines in a speech card over their head (no button). At an
// area job (the herd, the sheep, the pigs) the job is already running as you arrive, so the hello is said on arriving.
// Where a job waits to be started, E (or a tap on the prompt) by the person starts it: the naturalist's camera is set
// up, the sheriff's desk opens. Riding into the job as before still starts it too. (Protect the wagon has no person of
// its own: a held-up wagon's driver is the traffic's, and calls for help and thanks the player himself:
// src/missions/wagonjob.js.)
// After a job's batch is done the person says a thank-you.
//
// Walking away: riding or walking well clear of the herd, the sheep pasture or the pig yard after working there shows a
// small toast ("The sheep will wait for you"); nothing is lost (the job carries on where it was when you come back).
//
//   const JF = makeJobFolk({ W, folk, P, camera, hud, jobs, actions })
//     folk: the people library; jobs: getters for the jobs and places { roundup, sheep, pigs, wagon, deer, camps, farm,
//     delivery, rooms } (each returns the job or null; rooms: the town's rooms, src/townrooms.js, where the storekeeper and
//     the sheriff stand); actions: { sheriff(), stable() } (open the sheriff's desk, the stable's counter); onTalk(what, id): a
//     person's hello ('hello'), the walking-away toast ('leave') and a person's thank-you ('thanks'), for the player's
//     own howdy and see-ya and the men's recorded thanks and goodbyes (shouts.js); id: the person; who: { at, male }
//   onRing(at): the smith's hammer meeting his anvil, at { x, z } (the game rings it: src/audio/ambience.js anvil)
//   JF.update(dt, { hidden })   each frame while riding, before the doors are looked at (hidden: a panel or the cabin is
//                       up: the tags and the speech card are put away and the people wait)
//   JF.prompt           the prompt's words when E by a person does something, else null; JF.talk() does it
//   JF.heard(event, data)   a Hob event (src/hob.js): the thank-yous come from these;
//                       also 'sheriffDone' (lock boxes cracked for the sheriff)
//   JF.say(id, text)    a person (an id of JOB_FOLK, or a camp's id for its foreman) says a line now
//   JF.thank(who, text)  a thank-you waiting its turn, as the jobs' own (the shift's end: src/shiftkeeper.js): who is a
//                       person's id, a camp's id or short name (its foreman), or { id, name, x, z } for a speaker
//                       with no person of their own (the storekeeper, inside the store: the card shows over that spot)
//   helloFor(id)        (an option) lines a person says in place of their hello, or null: the shift done for the day,
//                       their polite no (src/shifts.js)
//   (an event's data with shiftEnd: true: the shift's own thank-you takes the place of the job's usual one)
//   JF.speaking()       true while a speech card is on the screen
//   JF.people           the records: { id, name, role, p (the person), x, z, face }
//   JF.state()          for rigs;  JF.dispose()
import * as THREE from 'three';
import { makePerson } from './actors/folk.js';
import { JOB_FOLK, FOLK_BY_ID, FOREMAN_HELLO, TALK, sayMs, standSpot, makeGreeter, makeLeaveWatch, thanksFor, WORK, dressOf } from './jobfolkplan.js';
import { mowSite } from './buildsite.js';
import { makeSmithWork } from './smithy.js';
const SMITH_NEAR = 2.6;   // m: the rider this near the smith (inside with him), he stops work and turns to them

// where each one stands, worked out from the job's own layout (metres)
export const STAND = {
  boss: { out: 2.5, side: 4.5 },     // from the corral's gate: out toward the pasture, and along the fence (away from the herd's way in)
  vet: { out: 2.2, side: -4.6 },      // from the sheep pasture's gate: out in front, and along the fence away from the lane
  wife: { x: 6.8, z: 3.5 },           // in the farm's own frame: the lane's edge just past the way into the pig yard (pigs.js
                                      // PIGS.byWife holds the same spot: standing by her counts as being at the pigs)
  sheriff: { out: 1.0, side: 3.4 },   // from the sheriff's door: out toward the street, and to one side of the steps (the
                                      // wagon road runs past a few metres out: further out, he stood in a wagon's way)
  keeper: { out: 1.2, side: -3.8 },   // from the stable's door: out in front, and to one side of its big doors (not the
                                      // side where the player's horse waits, player.js homeSpot: +4 along the front)
  naturalist: 40,                     // m from the deer herd's home, toward the town square (outside a rider's alert
                                      // range of the job's herd, 18 x 1.35 = 24 m, plus the 6 m the deer graze from it)
  natAt: { x: 128.6, z: -244.8 },     // her one spot, by the deer job's herd (the creek herd, home 168, -256: 41 m off it
                                      // toward town, in the open, and the hoofprints from the jobs board come straight at
                                      // her with the herd beyond her: ~/pw/bandit-math/rigs/deertracks/spot.cjs). Should
                                      // the land there ever change under it, the spot is looked for round the herd's home
                                      // (naturalistSpot)
  natMow: 3.5,                        // m round her spot where the meadow is mown (she stands clear of the tall grass)
  natBand: [36, 48],                  // m: while she stands there, her herd only drifts within this far of her (in reach
                                      // of the camera's 50 m, never close enough to spook at her), and drifts back into
                                      // it when it has strayed (src/deer.js keepNear)
  natSpot: { step: 0.25, tries: 15, dists: [0, -3, 4], crown: 1, cover: 0.2, herd: 8 },   // finding her spot round
                                      // the herd (naturalistSpot): turned `step` radians to either side of the town's
                                      // way in turn, `tries` in all (as far as a little past square on to it), at these
                                      // m nearer or further than `naturalist`; good when no tree's crown is within
                                      // `crown` m of her (past the 1.5 m W.crownClear keeps) and at most `cover` of the
                                      // way to the herd is under crowns, open ground all the way to `herd` m from its middle
  anchor: 0.48,                       // m above the head bone the name tag sits (over the hat)
  trail: 3.5,                         // m a person stands at least from the middle of the trail to the pasture
  natWalk: { pace: 1.5, start: 16, near: 7, roam: 60 },   // the naturalist with her camera lent: strolls (m/s) after a
                                      // player more than `start` m off, to `near` m short of them, never more than `roam`
                                      // m from her own spot
};

// a person as a voice: where they stand, and whether he is a man (the recorded voices are the game maker's: men only)
const voiceOf = (r) => ({ at: () => ({ x: r.x, z: r.z }), male: !!(r.def && r.def.look && /_m$/.test(r.def.look.outfit || '')) });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));


export function makeJobFolk({ W, folk, P, camera, hud, jobs = {}, actions = {}, scene = W.scene, onTalk = null, onSay = null, helloFor = null, onRing = null }) {
  const get = (k) => { try { return jobs[k] ? jobs[k]() : null; } catch (e) { return null; } };
  const shadows = !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  const people = [];
  const free = (x, z) => !W.blocked(x, z) && W.waterAt(x, z) < 0.25;
  // how far a point is from the trail out to the pasture (people stand off it, not on it)
  const trail = W.places.trail || [];
  const offTrail = (x, z) => {
    let best = Infinity;
    for (let i = 1; i < trail.length; i++) {
      const [ax, az] = trail[i - 1], [bx, bz] = trail[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return best;
  };
  ensureCss();
  const box = document.createElement('div'); box.className = 'bjf'; document.body.appendChild(box);
  const card = document.createElement('div'); card.className = 'bjf-say'; card.hidden = true; box.appendChild(card);

  // ── THE PEOPLE ─────────────────────────────────────────────────────────────────────────────────────────────────
  function addPerson(def, spot, face, { person = null, kind = 'own', here = null, turn = 0 } = {}) {
    let p = person;
    if (!p) {
      try { p = makePerson(folk, { ...dressOf(def), shadows }); } catch (e) { console.warn('job folk: a person could not be made', def.id, e); return null; }
      p.root.position.set(spot.x, W.heightAt(spot.x, spot.z), spot.z); p.root.rotation.y = face;
      scene.add(p.root);
    }
    const tag = document.createElement('div'); tag.className = 'bjf-tag'; tag.hidden = true;
    tag.innerHTML = `<b>${esc(def.name)}</b><small>${esc(def.role)}</small>`;
    box.appendChild(tag);
    const rec = { id: def.id, def, name: def.name, role: def.role, p, kind, x: spot ? spot.x : 0, z: spot ? spot.z : 0, face, home: face,
      tag, greet: makeGreeter({ again: ['boss', 'vet', 'wife'].includes(def.id) ? TALK.againArea : TALK.again }), t: 3 + Math.random() * 6, clipT: 0, visible: true, block: kind === 'own',
      here, turn };   // (a lent person: here() says he stands at his spot now (else lent on to a builder); turn: his parent's yaw in the world)
    people.push(rec);
    return rec;
  }
  const byId = (id) => people.find((r) => r.id === id) || null;

  // the trail boss, by the corral's gate (the caught cattle go in through it: he stands along the fence, out of their way)
  const corral = W.places.corral;
  if (corral && corral.gate) {
    const g = corral.gate, o = { x: Math.sin(g.rot), z: Math.cos(g.rot) }, s = { x: Math.cos(g.rot), z: -Math.sin(g.rot) };
    const want = { x: g.x + o.x * STAND.boss.out + s.x * STAND.boss.side, z: g.z + o.z * STAND.boss.out + s.z * STAND.boss.side };
    const at = standSpot({ x: g.x + o.x * STAND.boss.out, z: g.z + o.z * STAND.boss.out, toward: want, dist: Math.abs(STAND.boss.side), tries: 7, step: 0.35, ok: (x, z) => free(x, z) && offTrail(x, z) > STAND.trail })
      || standSpot({ x: g.x, z: g.z, toward: want, dist: 7, tries: 11, step: 0.25, ok: (x, z) => free(x, z) && offTrail(x, z) > STAND.trail }) || want;
    addPerson(FOLK_BY_ID.boss, at, g.rot);
  }
  // the vet and the farmer's wife, at the farm (each only while her job is on: a grown-up may turn one off)
  const farm = get('farm'), L = farm && farm.layout;
  if (L && L.sheep && get('sheep')) {
    const g = L.sheep.gate, o = { x: Math.sin(g.rot), z: Math.cos(g.rot) }, s = { x: Math.cos(g.rot), z: -Math.sin(g.rot) };
    const want = { x: g.x + o.x * STAND.vet.out + s.x * STAND.vet.side, z: g.z + o.z * STAND.vet.out + s.z * STAND.vet.side };
    addPerson(FOLK_BY_ID.vet, free(want.x, want.z) ? want : g.out, g.rot);
  }
  if (L && L.yard && get('pigs')) {
    const at = L.at(STAND.wife.x, STAND.wife.z);
    addPerson(FOLK_BY_ID.wife, at, L.rot - Math.PI / 4);   // (half facing the lane, half the way into the farm)
  }
  // the sheriff, out in front of his office, to one side of the steps; or, an office built to be walked into, inside at
  // his desk (placed once it is built: roomsStep)
  const sh = W.places.sheriff, CODE = W.V && W.V.CODE;
  const officeIn = !!(CODE && CODE.has && CODE.has('sheriff') && jobs.rooms);
  if (sh && sh.door) {
    const o = { x: Math.sin(sh.rot), z: Math.cos(sh.rot) }, s = { x: Math.cos(sh.rot), z: -Math.sin(sh.rot) };
    let at = null;
    if (!officeIn) {
      for (const k of [1, -1]) { const x = sh.door.x + o.x * STAND.sheriff.out + s.x * STAND.sheriff.side * k, z = sh.door.z + o.z * STAND.sheriff.out + s.z * STAND.sheriff.side * k; if (free(x, z)) { at = { x, z }; break; } }
      const out = Object.create(FOLK_BY_ID.sheriff); out.hello = FOLK_BY_ID.sheriff.helloOut || FOLK_BY_ID.sheriff.hello;
      addPerson(out, at || { x: sh.door.x + o.x * 3.5, z: sh.door.z + o.z * 3.5 }, sh.rot);
    }
    // the deputy, to one side of the steps (the other side from the sheriff, when he is out here too: the loot job is on)
    if (get('loot')) {
      const k = at && Math.abs((at.x - sh.door.x) * s.x + (at.z - sh.door.z) * s.z - STAND.sheriff.side) < 0.01 ? -1 : 1;
      let dp = null;
      for (const kk of [k, -k]) { const x = sh.door.x + o.x * STAND.sheriff.out + s.x * STAND.sheriff.side * kk, z = sh.door.z + o.z * STAND.sheriff.out + s.z * STAND.sheriff.side * kk; if (free(x, z) && !(at && Math.hypot(x - at.x, z - at.z) < 1)) { dp = { x, z }; break; } }
      addPerson(FOLK_BY_ID.deputy, dp || { x: sh.door.x + o.x * 4.5 + s.x * 2, z: sh.door.z + o.z * 4.5 + s.z * 2 }, sh.rot);
    }
  }
  // the stable keeper, beside the stable's big doors (the side with room), facing out
  const st = W.places.stable;
  if (st && st.door) {
    const o = { x: Math.sin(st.rot), z: Math.cos(st.rot) }, s = { x: Math.cos(st.rot), z: -Math.sin(st.rot) };
    let at = null;
    for (const k of [1, -1]) { const x = st.door.x + o.x * STAND.keeper.out + s.x * STAND.keeper.side * k, z = st.door.z + o.z * STAND.keeper.out + s.z * STAND.keeper.side * k; if (free(x, z) && free(x + o.x, z + o.z)) { at = { x, z }; break; } }
    addPerson(FOLK_BY_ID.keeper, at || { x: st.door.x + o.x * 3, z: st.door.z + o.z * 3 }, st.rot);
  }
  // the naturalist: placed by the deer job's herd once it has one (see placeNaturalist)
  const naturalist = get('deer') ? addPerson(FOLK_BY_ID.naturalist, { x: 0, z: 0 }, 0) : null;
  if (naturalist) { naturalist.p.root.visible = false; naturalist.placed = false; }
  // the camp foremen: the camps' own people
  const foremen = [];
  // the miller: the windmill job's own person, lent for his tag and hello (kind 'lent': the job moves and animates him)
  let millerRec = null;
  function millerStep() {
    if (millerRec) return;
    const J = get('windmill'); if (!J || !J.miller) return;
    const p = J.miller.root.position, base = FOLK_BY_ID.miller;
    // (his hello as the tower stands now)
    const def = Object.create(base);
    Object.defineProperty(def, 'hello', { get: () => { const k = J.helloKey ? J.helloKey() : 'start'; return (base.hellos && base.hellos[k]) || base.hello; } });
    millerRec = addPerson(def, { x: p.x, z: p.z }, J.miller.root.rotation.y, { person: J.miller, kind: 'lent' });
    if (millerRec) millerRec.job = J;
  }
  // the old fisherman at the foot of the dock: the fishing job's own person, lent for his tag and hello as the miller is
  // (src/fishingjob.js; his prompt is the build site's, "Fish off the dock")
  let fisherRec = null;
  function fisherStep() {
    if (fisherRec) return;
    const J = get('fishing'); if (!J || !J.keeper) return;
    const p = J.keeper.root.position;
    fisherRec = addPerson(FOLK_BY_ID.fisherman, { x: p.x, z: p.z }, J.keeper.root.rotation.y, { person: J.keeper, kind: 'lent' });
  }
  // the engineer at the ravine: the bridge job's own person, lent for his tag and hello as the miller is. He stands in
  // the bridge's frame (turned a quarter in the world), so his spot is read from the world and his facing given back in
  // that frame; while the builder is up he is the builder's (no tag, no turning)
  let engineerRec = null;
  function engineerStep() {
    if (engineerRec) return;
    const J = get('bridge'); if (!J || !J.engineer || !J.engineer.root.parent) return;
    const e = J.engineer.root, w = e.getWorldPosition(new THREE.Vector3()), q = e.parent.getWorldQuaternion(new THREE.Quaternion());
    const turn = new THREE.Euler().setFromQuaternion(q, 'YXZ').y;
    // (his hello as the bridge stands now, as the miller's)
    const base = FOLK_BY_ID.engineer, def = Object.create(base);
    Object.defineProperty(def, 'hello', { get: () => { const k = J.helloKey ? J.helloKey() : 'start'; return (base.hellos && base.hellos[k]) || base.hello; } });
    engineerRec = addPerson(def, { x: w.x, z: w.z }, e.rotation.y + turn, { person: J.engineer, kind: 'lent', here: () => !J.builder, turn });
  }

  // the storekeeper behind the general store's counter and the sheriff at his desk, once the rooms are built
  // (src/townrooms.js): each in his building's frame, facing as its anchors say
  const indoor = [];
  let roomsDone = false;
  function roomsStep() {
    if (roomsDone) return;
    const TR = get('rooms'); if (!TR || !TR.frame) { roomsDone = !jobs.rooms; return; }
    const put = (kind, def, spot, face) => {
      const F = TR.frame(kind); if (!F || !spot) return false;
      const [x, z] = F.place(spot[0], spot[2]), r = addPerson(def, { x, z }, F.yaw(face));
      if (r) { r.room = TR.rooms[kind].o; r.block = true; indoor.push(r); }
      return true;
    };
    const SA = TR.anchors('generalStore'), OA = TR.anchors('sheriff');
    if (!SA && !OA) return;   // (not built yet)
    if (SA && SA.counter && SA.counter.clerk) put('generalStore', FOLK_BY_ID.storekeeper, SA.counter.clerk, -Math.PI / 2);
    if (officeIn && OA && OA.desk) put('sheriff', FOLK_BY_ID.sheriff, OA.desk.sheriff, OA.desk.face || 0);
    // the blacksmith in his shop, at work (src/smithy.js: his anvil, his forge, the anvil's ring)
    const BA = TR.anchors('blacksmith'), SA2 = BA && BA.rooms && BA.rooms[0] && BA.rooms[0].anchors;
    if (SA2 && SA2.smith && SA2.anvil && SA2.forge) {
      const F = TR.frame('blacksmith'), r = addPerson(FOLK_BY_ID.smith, { x: 0, z: 0 }, 0);
      if (r) {
        r.room = TR.rooms.blacksmith.o; r.block = true; indoor.push(r);
        r.work = makeSmithWork({ rec: r, folk, place: F.place, yaw: F.yaw, A: SA2, ring: (q) => { if (onRing) onRing(q); } });
        r.p.root.position.set(r.x, W.heightAt(r.x, r.z), r.z); r.p.root.rotation.y = r.face;
      }
    }
    roomsDone = true;
  }

  // walkers don't go through a person standing still
  const offBlock = W.addBlocker ? W.addBlocker((x, z) => {
    for (const r of people) if (r.block && r.p.root.visible && Math.abs(x - r.x) < TALK.block && Math.abs(z - r.z) < TALK.block && Math.hypot(x - r.x, z - r.z) < TALK.block) return true;
    return false;
  }) : () => {};

  // ── THE NATURALIST: a good way off the deer job's herd, on the town's side ─────────────────────────────────────
  let natHerd = null;
  const _v = new THREE.Vector3(), _f = new THREE.Frustum(), _m = new THREE.Matrix4(), _sph = new THREE.Sphere();
  // (the whole person, hat to boots and a little round: a person half in at the edge of the view counts as in it; and
  // a margin growing with the distance, about 5 degrees, since the camera may turn a little before the next frame is
  // drawn: these are last frame's matrices)
  function inView(x, y, z) {
    _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _f.setFromProjectionMatrix(_m);
    _sph.center.set(x, y + 0.95, z); _sph.radius = 1.4 + 0.08 * camera.position.distanceTo(_sph.center);
    return _f.intersectsSphere(_sph);
  }
  // Her spot by a herd, should STAND.natAt not do: STAND.naturalist m off its home, on the town's side as near as the
  // land allows (the hoofprints from town come up to her with the herd beyond her), where she is easy to see and the
  // deer are in view from her: flat open ground with no tree's crown over her, open ground (no trunk, rock or water) all
  // the way from her to the herd, so the two are on one piece of ground, and few crowns over that way. Tried straight
  // out toward the town first, then a little to one side and the other, further each time (STAND.natSpot), at the
  // distance and a little nearer and further; the first spot good on all counts, else the best one found (most open
  // over her and over the way to the herd), else the first flat one
  const flatAt = (x, z) => free(x, z) && Math.abs(W.heightAt(x + 1, z) - W.heightAt(x - 1, z)) < 0.6 && Math.abs(W.heightAt(x, z + 1) - W.heightAt(x, z - 1)) < 0.6;
  const crownAt = (x, z) => (W.crownClear ? W.crownClear(x, z, 0) : Infinity);   // (m to spare from the nearest crown; below 0: under one)
  function naturalistSpot(H) {
    const sq = W.places.square || W.places.spawn, S = STAND.natSpot, mid = H.home;
    const a0 = Math.atan2(sq.x - mid.x, sq.z - mid.z);
    let best = null, firstFlat = null;
    for (let i = 0; i < S.tries; i++) {
      const k = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1), a = a0 + k * S.step;
      for (const dd of S.dists) {
        const dist = STAND.naturalist + dd, x = mid.x + Math.sin(a) * dist, z = mid.z + Math.cos(a) * dist;
        if (!flatAt(x, z)) continue;
        if (!firstFlat) firstFlat = { x, z };
        // (the way to the herd, every 2 m: open ground, and how much of it is under a crown; the crowns only looked for
        // from a spot in the open (the rest count as all under), as a herd deep in the woods has every spot round it under
        // the trees, and looking along every way from them all was a hitch of ~10 ms)
        const over = crownAt(x, z), look = over >= S.crown;
        let open = true, under = 0, n = 0;
        for (let s = 2; s < dist - S.herd; s += 2) {
          const t = s / dist, px = x + (mid.x - x) * t, pz = z + (mid.z - z) * t;
          if (!free(px, pz)) { open = false; break; }
          n++; if (look && crownAt(px, pz) < 0) under++;
        }
        if (!open) continue;
        const cover = !look ? 1 : n ? under / n : 0;
        if (over >= S.crown && cover <= S.cover) return { x, z };
        const score = Math.min(over, 4) - 12 * cover - 0.2 * Math.abs(k);
        if (!best || score > best.score) best = { x, z, score };
      }
    }
    return best ? { x: best.x, z: best.z } : firstFlat;
  }
  function placeNaturalist() {
    const DJ = get('deer');
    if (!naturalist || !DJ) return;
    const H = DJ.herd();
    if (!H) return;
    const sp = naturalist.spot;
    // (walked off after the player, who has since gone: back on her spot, out of sight)
    if (naturalist.placed && Math.hypot(naturalist.x - sp.x, naturalist.z - sp.z) > 1) {
      const d = Math.hypot(P.position.x - naturalist.x, P.position.z - naturalist.z);
      if (d > 140 && !inView(naturalist.x, W.heightAt(naturalist.x, naturalist.z), naturalist.z)) {
        naturalist.x = sp.x; naturalist.z = sp.z; naturalist.walking = false; naturalist.p.play('Idle', { fade: 0 });
        naturalist.face = naturalist.home; naturalist.p.root.rotation.y = naturalist.face;
      }
    }
    // (her one spot: placed once, by the job's one herd, and she stays there; the herd drifts back to her when it strays)
    if (naturalist.placed && H === natHerd) return;
    // (were the job's herd ever another: moved only while out of sight and with the player well off, never popping
    // from one place to another in view)
    if (naturalist.placed) {
      const d = Math.hypot(P.position.x - naturalist.x, P.position.z - naturalist.z);
      if (d < 140) return;
      if (inView(naturalist.x, W.heightAt(naturalist.x, naturalist.z), naturalist.z)) return;
      if (DJ.active || (talking && talking.r === naturalist)) return;
    }
    // (STAND.natAt, by the creek herd, while it is still open ground in reach of that herd's home; else looked for)
    const A = STAND.natAt, dA = A ? Math.hypot(A.x - H.home.x, A.z - H.home.z) : 0;
    const at = A && dA >= STAND.natBand[0] - 6 && dA <= STAND.natBand[1] && flatAt(A.x, A.z) ? { x: A.x, z: A.z } : naturalistSpot(H);
    if (!at) return;
    const fresh = H !== natHerd;
    if (natHerd && fresh) natHerd.keepNear = null;
    natHerd = H; naturalist.placed = true;
    H.keepNear = { x: at.x, z: at.z, min: STAND.natBand[0], max: STAND.natBand[1] };
    naturalist.x = at.x; naturalist.z = at.z; naturalist.spot = { x: at.x, z: at.z }; naturalist.walking = false;
    naturalist.home = naturalist.face = Math.atan2(H.home.x - at.x, H.home.z - at.z);   // (looking at the herd)
    naturalist.p.root.position.set(at.x, W.heightAt(at.x, at.z), at.z); naturalist.p.root.rotation.y = naturalist.face;
    naturalist.p.root.visible = true;
    // (the meadow mown round her, as round the jobs board: she stands clear of the tall grass, easy to see)
    unmowNat(); unmowNat = mowSite(W, at.x, at.z, { r: STAND.natMow, fade: 2 });
    if (fresh) naturalist.greet.reset();
  }
  let unmowNat = () => {};

  // With her camera lent she strolls after the player round her herd, loosely (a player further than natWalk.start off,
  // to natWalk.near short of them), never further than natWalk.roam from her spot; she stands while she talks and while
  // the camera is up (never walking into the picture), and goes back to her spot once it is given back
  function naturalistWalk(dt) {
    if (!naturalist || !naturalist.placed || !naturalist.spot) return;
    const DJ = get('deer'), N = STAND.natWalk, sp = naturalist.spot, at = P.position;
    const dP = Math.hypot(at.x - naturalist.x, at.z - naturalist.z);
    let to = sp;
    if (DJ && DJ.lent() && !(DJ.resting && DJ.resting())) {
      if (DJ.active || dP > 150) to = null;   // (stays put: the camera is up, or the player has gone off)
      else if (dP > (naturalist.walking ? N.near : N.start)) {
        const k = (dP - N.near) / dP;
        let x = naturalist.x + (at.x - naturalist.x) * k, z = naturalist.z + (at.z - naturalist.z) * k;
        const ds = Math.hypot(x - sp.x, z - sp.z); if (ds > N.roam) { x = sp.x + (x - sp.x) / ds * N.roam; z = sp.z + (z - sp.z) / ds * N.roam; }
        to = { x, z };
      } else to = null;
    }
    const busy = naturalist.clipT > 0 || (talking && talking.r === naturalist);   // (waving or talking: she stands)
    const dx = to ? to.x - naturalist.x : 0, dz = to ? to.z - naturalist.z : 0, dl = Math.hypot(dx, dz);
    const go = !busy && to && dl > (naturalist.walking ? 0.3 : 2);
    let stepped = false;
    if (go) {
      const st = Math.min(dl, N.pace * dt), x = naturalist.x + dx / dl * st, z = naturalist.z + dz / dl * st;
      naturalist.block = false;   // (her own standing-room doesn't stop her)
      if (free(x, z)) { naturalist.x = x; naturalist.z = z; stepped = true; }
      naturalist.face += wrapA(Math.atan2(dx, dz) - naturalist.face) * Math.min(1, dt * 6);
    }
    if (stepped && !naturalist.walking) { naturalist.walking = true; naturalist.p.play('Walk', { fade: 0.25, speed: N.pace / ((naturalist.p.stride && naturalist.p.stride.Walk) || 1.2) }); }
    else if (!stepped && naturalist.walking) { naturalist.walking = false; naturalist.block = true; naturalist.p.play('Idle', { fade: 0.3 }); naturalist.t = 3 + Math.random() * 4; }
    if (!naturalist.walking) naturalist.home = Math.hypot(naturalist.x - sp.x, naturalist.z - sp.z) < 1 && natHerd ? Math.atan2(natHerd.mid.x - sp.x, natHerd.mid.z - sp.z) : naturalist.face;
  }

  // ── THE CAMP FOREMEN (name tags and hellos only: the camps move them) ──────────────────────────────────────────
  function foremenStep() {
    const C = get('camps');
    if (!C || foremen.length || !get('delivery')) return;   // (no orders to offer while deliveries are turned off)
    for (const c of C.list) {
      const h = c.foreman.person;
      if (!h) continue;
      const lines = FOREMAN_HELLO[c.id] || FOREMAN_HELLO.cow;
      const r = addPerson({ id: c.id, name: c.foreman.name, role: c.short.replace(/^the /, ''), hello: lines, look: c.foreman.look }, { x: h.x, z: h.z }, h.face, { person: h.p, kind: 'foreman' });
      if (r) { r.camp = c; r.h = h; foremen.push(r); }
    }
  }

  // ── THE SPEECH CARD ────────────────────────────────────────────────────────────────────────────────────────────
  let talking = null;   // { r, lines, t }
  const pending = [];   // thank-yous waiting for the game to come back from a panel: { r, text, t }
  // (pin: a thank-you, shown in a card of its own when the speaker is out of sight; a hello just stops when the player
  // has gone off)
  function say(r, lines, { ms = null, pin = false, hello = false } = {}) {
    if (!r) return;
    const L = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
    if (!L.length) return;
    talking = { r, lines: L, pin, hello, t: (ms || sayMs(L.join(' '))) / 1000 };
    card.innerHTML = `<b>${esc(r.name)}</b>${L.map((l) => `<p>${esc(l)}</p>`).join('')}`;
    card.hidden = false; card.classList.remove('is-out'); card.style.opacity = '';
    if (onSay) { try { onSay(r.name, L); } catch (e) { console.error(e); } }   // (main.js: read out to a rider who can't read yet)
    // (a wave the first time, a nod of the head after; a speaker with no person of their own just talks)
    if (r.p) {
      const clip = r.greet.said && r.waved ? 'Interact' : 'Wave';
      if (r.p.play(clip, { fade: 0.25, once: true })) { r.clipT = 1.7; r.waved = true; }
    }
  }
  const JF = { people, prompt: null, indoor };
  JF.say = (id, text) => { const r = byId(id); if (r) { say(r, text); return true; } return false; };
  JF.speaking = () => !!talking && !card.hidden;   // (a speech card is on the screen: Old Hob waits his turn on a phone)
  // a thank-you waiting its turn (the shift's end): a person, a foreman by his camp, or a speaker with no person
  JF.thank = (who, text) => {
    let r = null;
    if (who && typeof who === 'object') r = { id: who.id || 'voice', name: who.name || '', role: '', p: null, kind: 'voice', x: +who.x || 0, z: +who.z || 0 };
    else r = byId(who) || foremen.find((f) => f.camp && (f.camp.short === who || f.camp.id === who)) || null;
    if (!r || !text) return false;
    pending.push({ r, text, t: TALK.keep });
    if (talking && talking.hello) talking.t = Math.min(talking.t, 0.55);   // (a hello just then gives way at once)
    return true;
  };

  // ── TALKING: E by a person ─────────────────────────────────────────────────────────────────────────────────────
  let promptFor = null;
  // her words lending the camera (lent: only the last line, her hello with it lent on an earlier ride): on to the herd
  // by the hoofprints, or, the herd already in the camera's reach from here, set it up here
  function lendLines(r, here, lent) {
    const L = r.def.lend || r.def.hello, last = here && r.def.lendHere ? r.def.lendHere : L[L.length - 1];
    return lent ? [last] : [...L.slice(0, -1), last];
  }
  let camUsed = false;   // (her camera set up at least once since she last lent it)
  let lentNow = false;   // (she lent it on this ride: only then must it be set up first before it goes back. Lent on an earlier
                         // ride, E by her gives it back at once: the game's maker couldn't return a camera borrowed before)
  function promptStep() {
    JF.prompt = null; promptFor = null; JF.promptAt = null;
    if (P.mode !== 'foot' && P.mode !== 'horse') return;
    let best = null, bd = Infinity;
    for (const r of people) {
      if (!r.p.root.visible || r.kind === 'foreman' || r.kind === 'lent' || r.def.indoors) continue;   // (a foreman's prompt is the delivery job's own; the miller's, the build site's; the storekeeper's, the store's spots)
      const d = Math.hypot(P.position.x - r.x, P.position.z - r.z) - (P.onHorse ? 1.2 : 0);
      if (d < bd) { bd = d; best = r; }
    }
    if (!best) return;
    JF.promptAt = { x: best.x, z: best.z };   // (where the person is: the one E action's arbitration, src/main.js doors)
    const DJ = get('deer');
    // (her camera lent on this ride and not set up since: no handing it back yet. Just lent, a second E would give it
    // straight back, her "follow the hoofprints to the herd" hardly said. Lent on an earlier ride, E gives it back (the
    // board's hoofprints lead to her only while it isn't lent, main.js trailGoal). By the herd the E is the deer job's
    // own, setting it up)
    if (best.id === 'naturalist' && DJ && bd < TALK.prompt && !DJ.active && !(DJ.lent() && lentNow && !camUsed)) { const who = best.name.replace(/ Ada/, ''); JF.prompt = DJ.lent() ? `Give ${who} her camera back` : `Borrow ${who}'s camera`; promptFor = best; }
    else if (best.id === 'sheriff' && actions.sheriff && !best.room && bd < TALK.prompt) { JF.prompt = 'Crack lock boxes for the sheriff'; promptFor = best; }   // (inside at his desk: the pile's own spot, src/townrooms.js)
    else if (best.id === 'keeper' && actions.stable && bd < TALK.prompt) { JF.prompt = 'Talk to the stable keeper'; promptFor = best; }
    else if (best.id === 'deputy' && bd < TALK.prompt) { const LJ = get('loot'); if (LJ && LJ.canShare) { JF.prompt = 'Share out the loot'; promptFor = best; } }
  }
  JF.talk = () => {
    const r = promptFor; if (!r) return false;
    if (r.id === 'naturalist') {
      const DJ = get('deer'); if (!DJ) return false;
      // (the camera not lent yet: she hands it over, strapped behind the saddle, and says how it goes)
      if (!DJ.lent()) { const here = DJ.inReach && DJ.inReach(); DJ.lend(); camUsed = false; lentNow = true; say(r, lendLines(r, here, false)); r.greet.update(0, true, false); if (onTalk) onTalk('hello', r.id); return true; }
      // (given back: off the saddle, her thanks, and the job rests till the player rides off and comes back)
      if (DJ.giveBack()) { say(r, r.def.back || r.def.thanks[0]); if (onTalk) onTalk('thanks', r.id, voiceOf(r)); }
      return true;
    }
    if (r.id === 'sheriff') { actions.sheriff(); return true; }
    if (r.id === 'keeper') { actions.stable(); return true; }
    if (r.id === 'deputy') { const LJ = get('loot'); if (LJ) LJ.share(); return true; }
    return false;
  };

  // ── THANK-YOUS ─────────────────────────────────────────────────────────────────────────────────────────────────
  const thanksN = {};
  JF.heard = (event, data = {}) => {
    if (event === 'deerSetup') camUsed = true;   // (her camera set up since she lent it: E by her may give it back now)
    // (a pick at an area job: that job is the one leaving says goodbye to, and the others forget theirs)
    if (WORK[event]) for (const a of areas) { if (a.id === WORK[event]) a.watch.worked(); else a.watch.other(); }
    if (data && data.shiftEnd) return;   // (the shift's own thank-you comes instead: JF.thank)
    if (event === 'deliveryDone' && data && data.camp) { const r = foremen.find((f) => f.camp && (f.camp.short === data.camp || f.camp.id === data.camp)); if (r) pending.push({ r, text: "Right where we need 'em. Come see me for the next order.", t: TALK.keep }); return; }
    if (event === 'storeDone' && !(data && data.filled)) return;   // (the counter closed with no order filled: nothing to thank)
    const id = thanksFor(event); if (!id) return;
    const r = byId(id); if (!r) return;
    const L = FOLK_BY_ID[id].thanks; const n = thanksN[id] = ((thanksN[id] ?? -1) + 1);
    pending.push({ r, text: L[n % L.length], t: TALK.keep });
  };

  // ── WALKING AWAY FROM AN AREA JOB ──────────────────────────────────────────────────────────────────────────────
  const areas = [
    { id: 'boss', job: 'roundup', mid: () => W.places.pasture, leave: 58 },
    { id: 'vet', job: 'sheep', mid: () => L && L.sheep, leave: 56 },
    { id: 'wife', job: 'pigs', mid: () => L && L.yard, leave: 36 },
  ].map((a) => ({ ...a, watch: makeLeaveWatch({ stay: 4, leave: a.leave }) }));

  // ── EACH FRAME ─────────────────────────────────────────────────────────────────────────────────────────────────
  const head = new THREE.Vector3();
  let hiddenNow = false;
  function hideAll() { for (const r of people) r.tag.hidden = true; card.hidden = true; }
  JF.update = (dt, { hidden = false } = {}) => {
    if (hidden) {
      if (!hiddenNow) { hiddenNow = true; hideAll(); } JF.prompt = null;
      // (at the store's counter the storekeeper still breathes beside the rider, and the smith keeps at his anvil: the
      // indoor folk in view go on moving, with no tags, cards or hellos meanwhile)
      if (dt > 0) for (const r of indoor) if (r.p.root.visible) { if (r.work) r.work.update(dt); r.p.root.position.set(r.x, W.heightAt(r.x, r.z), r.z); r.p.root.rotation.y = r.face; r.p.update(dt); }
      return;
    }
    if (hiddenNow) { hiddenNow = false; if (talking) card.hidden = false; }
    placeNaturalist(); naturalistWalk(dt); foremenStep(); millerStep(); fisherStep(); engineerStep(); roomsStep();
    const at = P.position;
    // (the building the player stands in, under its roof: the indoor folk talk only to a player inside with them)
    const hereO = indoor.length && CODE ? (CODE.indoors ? CODE.indoors(at.x, at.y + 1, at.z) : (CODE.room(at.x, at.y + 1, at.z) || {}).o || null) : null;   // (in through its door, not out on its porch)
    // the area jobs: hellos on arriving, the toast on walking away
    for (const a of areas) {
      const job = get(a.job), m = a.mid(); if (!job || !m) continue;
      const d = Math.hypot(at.x - m.x, at.z - m.z);
      if (a.watch.update(dt, !!job.near, d)) { hud.toast(FOLK_BY_ID[a.id].leave); const r = byId(a.id); if (onTalk) onTalk('leave', a.id, r ? voiceOf(r) : null); }
      a.near = !!job.near;
    }
    for (const r of people) {
      const d = Math.hypot(at.x - r.x, at.z - r.z);
      // (the foremen are placed by their camps: follow them)
      if (r.kind === 'foreman') { r.x = r.h.x; r.z = r.h.z; }
      if (r.kind === 'lent') {   // (lent on to the builder: not here)
        if (r.here ? !r.here() : r.p.root.parent !== scene) { r.tag.hidden = true; continue; }
        if (r.p.root.parent === scene) { r.x = r.p.root.position.x; r.z = r.p.root.position.z; } else { r.p.root.getWorldPosition(head); r.x = head.x; r.z = head.z; }
      }
      // (drawn within TALK.show. Hidden only while out of the camera's view, never vanishing in sight; but shown at once,
      // in view or not: riding up to a person from further off keeps them in view all the way in, and waiting for them to
      // be out of view left them undrawn at the very end of the hoofprints (Miss Wren, out by a far herd). A person coming
      // into range is a speck in the haze, TALK.show off)
      if (r.kind === 'own') { const want = d < TALK.show && (r !== naturalist || naturalist.placed) && (!r.room || (r.room.code && r.room.code.loaded !== false)); if (want !== r.p.root.visible && (want || !inView(r.x, W.heightAt(r.x, r.z), r.z))) r.p.root.visible = want; }   // (indoors: drawn while the building's inside is)
      const inWith = !r.room || r.room === hereO;   // (indoors: the player is in there with him)
      const shown = r.p.root.visible;
      if (!shown) { r.tag.hidden = true; r.greet.update(dt, false, true); continue; }   // (out of sight is away: the 'hello again' clock keeps running)
      // the hello: walking or riding up, or arriving at the person's job
      const area = areas.find((a) => a.id === r.id);
      let near = d < TALK.greet && inWith;
      if (area && area.near) near = true;
      if (r.id === 'naturalist') { const DJ = get('deer'); near = near && !(DJ && DJ.active); }
      if (r.kind === 'foreman') { const DL = get('delivery'); near = near && !(DL && DL.phase !== 'none'); }
      const away = (d > TALK.away || (r.room && !inWith && d > TALK.prompt)) && !(area && area.near);   // (indoors: gone out of his building counts as away)
      // (Miss Wren with her camera already lent (an earlier ride; the jobs board's hoofprints lead to her all the same):
      // not "borrow my camera", but on to the herd, as when she lends it)
      const DJn = r.id === 'naturalist' ? get('deer') : null;
      let hello = DJn && r.def.lend && DJn.lent() ? lendLines(r, DJn.inReach && DJn.inReach(), true) : r.def.hello;
      { const no = helloFor ? helloFor(r.id) : null; if (no && no.length) hello = no; }   // (done for today: the polite no)
      if (r.greet.update(dt, near, away) && !pending.some((q) => q.r === r)) { say(r, hello, { pin: !!(area && area.near), hello: true }); if (onTalk) onTalk('hello', r.id); }   // (a thank-you of theirs waiting: that, not a hello)   // (over anybody else's: the newest one met is the one in front of you; arriving at the job from where the person is out of sight, in a card of its own)
      // idle about, turn to the player when close (the camps turn their own foremen)
      if (r.kind === 'own' || r.kind === 'lent') {
        if (d < TALK.awake) {
          // (one at work, the smith at his anvil: his work moves and plays him, src/smithy.js, except while he talks to
          // the rider or the rider stands right by him: then he turns to them)
          const working = r.work && !(inWith && (d < SMITH_NEAR || (talking && talking.r === r))) && r.work.update(dt);
          if (r.work && !working) r.work.stop();
          // (the naturalist walking after the player: facing the way she goes, the Walk clip on; naturalistWalk)
          if (!r.walking && !working) {
            const want = d < TALK.face && inWith ? Math.atan2(at.x - r.x, at.z - r.z) : r.home;
            r.face += wrapA(want - r.face) * Math.min(1, dt * 4);
            if (r.clipT > 0 && (r.clipT -= dt) <= 0) r.p.play('Idle', { fade: 0.4 });
            else if (r.clipT <= 0 && (r.t -= dt) <= 0) { r.t = 6 + Math.random() * 9; r.p.play(Math.random() < 0.5 ? 'Idle_Neutral' : 'Idle', { fade: 0.6 }); }
          }
          r.p.root.rotation.y = r.face - (r.turn || 0);   // (a lent person in a turned frame: the frame's turn taken off)
          if (r.kind === 'own') { r.p.root.position.set(r.x, W.heightAt(r.x, r.z), r.z); r.p.update(dt); }
        }
      }
      // the name tag
      const tagOn = d < TALK.tag && inWith && !(talking && talking.r === r);
      if (tagOn && place(r, r.tag, 0)) r.tag.hidden = false; else r.tag.hidden = true;
    }
    // a thank-you waiting its turn: said once nothing else is being said
    for (let i = pending.length - 1; i >= 0; i--) if ((pending[i].t -= dt) <= 0) pending.splice(i, 1);
    if (pending.length && (!talking || talking.t < 0.6)) { const q = pending.shift(); say(q.r, q.text, { pin: true }); if (onTalk && q.r.p) onTalk('thanks', q.r.id, voiceOf(q.r)); }
    // the speech card: over the speaker's head, or a card of its own in the middle when the speaker is out of sight
    if (talking) {
      if ((talking.t -= dt) <= 0) { talking = null; card.hidden = true; }
      else {
        const r = talking.r, d = Math.hypot(at.x - r.x, at.z - r.z);
        card.classList.toggle('is-out', talking.t < 0.5);
        // (a hello stops once the player has gone off: further than the job's area for the area jobs' people, a few
        // steps for the rest; a thank-you is seen through)
        const far = talking.hello ? (areas.some((a) => a.id === r.id) ? 70 : TALK.away) + 8 : Infinity;
        card.hidden = false;   // (shown before it is measured)
        if (d > far) { talking = null; card.hidden = true; }
        else if (d < TALK.thanksNear && (card.classList.remove('is-pinned'), place(r, card, 1))) { /* over the speaker's head */ }
        else if (talking.pin || talking.hello) pinCard();   // (a hello always shows: on a phone's narrow view the person met is often just off its edge)
        else card.hidden = true;   // (just out of view: back when the speaker is)
      }
    }
    promptStep();
  };

  // The page's own boxes the speech card keeps clear of: the job's card up top (with the hint line under it and the times
  // chart's "Peek" offer under those), and the help box at the bottom (the number line, the ten-frames: what a stuck kid
  // is looking at). topFloor(left, w): the lowest bottom of the top ones over that stretch of the screen; helpTop(): the
  // top of the help's pictures (Infinity when none is up).
  function topFloor(left, w, least) {
    let floor = least;
    for (const e of [hud.ruleEl, hud.hintEl, ...document.querySelectorAll('.tch-offer')]) {
      if (!e || e.hidden || !e.offsetParent) continue;
      const q = e.getBoundingClientRect();
      if (q.height && q.top < innerHeight * 0.5 && q.right > left - 6 && q.left < left + w + 6) floor = Math.max(floor, q.bottom + 10);
    }
    return floor;
  }
  function helpTop() {
    let top = Infinity;
    for (const e of (hud.helpEl ? hud.helpEl.children : [])) { const q = e.getBoundingClientRect(); if (q.height) top = Math.min(top, q.top); }
    return top;
  }
  // a card of its own, the speaker out of sight: low in the middle (on a phone, near the top), moved down off the job's
  // card and up off the help box (where there's room for both: a hello is short, the help comes first)
  function pinCard() {
    card.classList.add('is-pinned'); card.style.left = '50%'; card.style.top = ''; card.style.bottom = ''; card.style.transform = '';
    const c = card.getBoundingClientRect(), floor = topFloor(c.left, c.width, 0), help = helpTop();
    let top = Math.max(c.top, floor);
    if (top + c.height > help - 10) top = Math.max(floor, help - 10 - c.height);
    if (Math.abs(top - c.top) > 0.5) { card.style.top = `${Math.round(top)}px`; card.style.bottom = 'auto'; }
  }

  // a page element over a person's head (lift 0: the name tag; 1: the speech card above it); false when out of sight
  function place(r, el, lift) {
    const b = r.p && r.p.bones && r.p.bones.Head;
    if (b) { b.getWorldPosition(head); head.y += STAND.anchor; } else head.set(r.x, W.heightAt(r.x, r.z) + 2.2, r.z);
    head.project(camera);
    if (head.z > 1 || Math.abs(head.x) > 1.05 || Math.abs(head.y) > 1.05) return false;
    const x = (head.x + 1) / 2 * innerWidth, y = (1 - head.y) / 2 * innerHeight;
    // (the tag kept on the screen with an 8 px gutter: a person at the edge of a phone's narrow view still shows whose
    // tag it is. Its width is measured once, the first frame it is shown (its words never change), so placing the tags
    // never makes the page lay itself out again every frame)
    if (lift === 0) {
      if (!el._half && !el.hidden) el._half = el.offsetWidth / 2;
      const half = el._half || 0;
      el.style.left = `${Math.max(8 + half, Math.min(innerWidth - 8 - half, x))}px`; el.style.top = `${y}px`; return true;
    }
    // (the card above the tag, kept on the screen with a 12 px gutter; its tail points down at the speaker)
    el.style.left = '0px'; el.style.top = '0px';
    const w = el.offsetWidth, h = el.offsetHeight;
    const left = Math.max(12, Math.min(innerWidth - w - 12, x - w / 2));
    // (never over the job's card up top: below it when they would overlap; the tail is dropped then, as the card may sit
    // below the speaker's head)
    // (the job card, the hint line under it, and the times chart's "Peek" offer that sits under those; and not down over
    // the help box)
    const floor = topFloor(left, w, 70);
    const want = Math.min(innerHeight * 0.72 - h, y - h - 30, helpTop() - 10 - h), top = Math.max(floor, want);
    el.classList.toggle('is-low', want < floor && floor > 70);
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    el.style.setProperty('--tail', `${Math.max(16, Math.min(w - 16, x - left))}px`);
    return true;
  }

  JF.state = () => ({
    people: people.map((r) => ({ id: r.id, name: r.name, kind: r.kind, x: +r.x.toFixed(2), z: +r.z.toFixed(2), y: r.p.root.visible ? +r.p.root.getWorldPosition(new THREE.Vector3()).y.toFixed(2) : null,
      ground: +W.heightAt(r.x, r.z).toFixed(2), visible: r.p.root.visible, tag: !r.tag.hidden, clip: r.p.clip })),
    talking: talking ? { id: talking.r.id, lines: talking.lines, pinned: card.classList.contains('is-pinned') } : null, prompt: JF.prompt, pending: pending.length,
  });
  JF.dispose = () => {
    if (natHerd) natHerd.keepNear = null;
    unmowNat();
    offBlock();
    for (const r of people) { if (r.work) r.work.dispose(); r.tag.remove(); if (r.kind === 'own') { r.p.root.removeFromParent(); try { r.p.dispose(); } catch (e) { /* (gone) */ } } }
    box.remove();
  };
  return JF;
}

let css = false;
function ensureCss() {
  if (css) return; css = true;
  const s = document.createElement('style'); s.dataset.jobfolk = '1';
  s.textContent = `
.bjf { position: fixed; inset: 0; z-index: 13; pointer-events: none; font: 500 15px/1.35 Bitter, Georgia, serif; }
.bjf-tag { position: absolute; transform: translate(-50%, -100%); padding: 3px 9px 4px; border-radius: 7px; white-space: nowrap; text-align: center;
  background: rgba(30, 20, 12, 0.72); border: 1px solid rgba(226, 173, 76, 0.4); color: #f4e8cf; line-height: 1.15; }
.bjf-tag b { display: block; font: 700 14px Bitter, Georgia, serif; }
.bjf-tag small { display: block; font: 500 11px Bitter, Georgia, serif; color: #dccaa5; }
.bjf-say { position: absolute; left: 0; top: 0; width: max-content; max-width: min(340px, calc(100vw - 24px)); padding: 9px 13px 10px; border-radius: 10px;
  background: #f6edd6; color: #2b2219; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.42), inset 0 0 0 2px rgba(122, 85, 48, 0.3);
  transition: opacity 0.4s ease; --tail: 50%; }
.bjf-say::after { content: ''; position: absolute; left: var(--tail); bottom: -9px; margin-left: -9px; border: 9px solid transparent; border-bottom: 0; border-top-color: #f6edd6; }
.bjf-say b { display: block; font: 700 13px Bitter, Georgia, serif; color: #7a5530; letter-spacing: 0.02em; margin-bottom: 2px; }
.bjf-say p { margin: 0; font: 500 16px/1.32 Bitter, Georgia, serif; }
.bjf-say p + p { margin-top: 4px; }
.bjf-say.is-out { opacity: 0; }
.bjf-say.is-pinned { top: auto; bottom: 15vh; transform: translateX(-50%); }
.bjf-say.is-pinned::after, .bjf-say.is-low::after { display: none; }
@media (max-width: 600px) { .bjf-say { max-width: calc(100vw - 32px); } .bjf-say.is-pinned { top: 156px; bottom: auto; } .bjf-say p { font-size: 15px; } .bjf-tag b { font-size: 13px; } }
`;
  document.head.appendChild(s);
}
