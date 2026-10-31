// THE STORE COUNTER: a job at the general store. The rider stands behind the counter inside the store, beside the
// storekeeper ("you just help him", the game maker), and townsfolk come in through the door one after another, each
// with an order slip: a little word problem
// (src/math/wordproblems.js) shown big on a parchment slip (src/ui/storeslip.js). The kid picks a coin; a right one
// tips gold (the coins fly into the purse and it counts up) and the customer tips their hat and goes, while the next
// one, already waiting in line, steps up with their slip. A wrong coin shows one plain line about that slip and a picture
// of that kind of problem, and the kid picks again: no penalty, the customer just waits. "Done for now" (or Esc) ends it.
// On the top step the story is told backwards: the kid picks the equation that tells it, and the lock-box panel opens on
// that equation to solve it at the rider's own lock-box level (a find-x box below x on both sides, else with moves; the
// lock box pays as the sheriff's does).
//
// Started inside the store, facing its counter: "Work the counter" (src/townrooms.js; the store's spots, src/usespots.js).
// Where everyone stands and the way in and out are the store recipe's anchors (labs/buildings/store.js anchors.counter):
// the rider behind the counter at the grinder, the customer across it, the next one waiting by its near end and the
// one after out on the boardwalk; customers walk in through the doorway's right half (pushing the door open) and out
// through its left, and the camera looks across the room from its back. A store with no inside (none built): the old
// way, the rider out front with the order book and the customers walking up from the square. Each filled order counts
// toward the "orders filled" belt buckle (save.js JOBS).
//
// THE STORE'S LEVELS (src/levels/place/store.js, the mixed place): each customer asks the levels model which level the
// rider is on here (levelFor(rider, 'store')), picks one kind of question from that level's mix (a picture story, a
// word problem of the level's kinds, coins, the grandfather clock, decimals, percent, ratios) and makes it with that
// kind's own maker (storeOrder: the same function the levels page's examples come from). Its first pick (or the worked
// area, below) is recorded once through save.js recordAnswer: it moves the store's level (place 'store', the level it
// was made at), and counts in its own kind's strand at that maker step's point (order.own), plus what else the order
// counts in (order.credit: groups in Multiplication at half weight ...), timed as a sit-down answer
// (src/ui/answertimer.js; a fast right one counts double from the level the ladder names, dollars and cents). While the
// levels model is still finding the rider's level here, the slip's corner says so, quietly.
// A sale of the rider's goods counts only in its own strand (Word problems for eggs and milk, Fractions for wool), at
// the form that fits the store's level; it never moves the level.
// A sum too big for the head (16 × 7 hands-days, 13 tins at $6) opens THE WORKED AREA (src/ui/longwork.js) by itself a
// moment after the slip comes up, unless the store's level is well past it (then Work it out, from the tools button,
// src/ui/tools.js, or the slip's own button, opens it): the sum worked a step at a time (it opens on the sum itself,
// filled in), then (for a division) the word answer. Each tap counts lightly in that fact's own strand, the whole sum in
// Long work, and the order's answer as usual; then the right coin glows and the order is filled as if it were picked.
// J.workSum() tells the tools button what this order's sum is (the worked area's own, counted as above, or the order's
// sum, as plain help that counts nothing: the kid still picks the coin): a maker names its own (order.sum,
// src/math/counter.js: 2.6 × 6 for the fence boards, $0.80 × 6 for coffee by the pound; or its steps, the cost of 3
// tins then the change from $20), else it's read from the order's working (src/math/jobsums.js workFrom: every sum
// written with its answer, in order; decimals and dollars and cents too, $1.30 + $5.75).
// A rider who can't read yet (skill.js readAloud) hears each order read out (the browser's voice), with "Read it to
// me" on the slip to hear it again; the youngest riders' picture stories show the things to count from the start.
// THE COUNTER'S OTHER QUESTIONS (src/math/counter.js): money (counting coins, change, dollars and cents, tax and tips),
// the time by the store's grandfather clock and how long things take, decimals, percent, ratios, as the level's mix
// says, with their own pictures (src/ui/counterpics.js): the lead (the clock to read, the coins to count) above the
// coins, the help after a miss.
//
//   const J = makeStoreJob({ W, folk, P, I, camera, rider, hud, hob, refresh, openBox, onStart, onStop, pay, goods, town, work, room })
//     room(): the store's room (src/townrooms.js TR.rooms.generalStore: { o, A, F }), or null: the counter outside
//     work(): opens the tools' Work it out (src/ui/tools.js) on this order's sum: the slip's own button on a phone (the
//     slip covers the tools strip there), for an order with no worked area of its own
//     town(): the town's people (src/townpeople.js), or null: the customers are townsfolk borrowed from it (already about,
//     or out of the nearest door, walking the town's paths; given back when they go), else made here as before
//     fish(): the fishing job (src/fishingjob.js), or null: a customer buys the fish kept at the dock (its saleOrder:
//     src/math/fishsale.js, a sale slip in Fractions, Ratios or Word problems; sold(order) takes them out of the saddlebags)
//     goods: the homestead (src/homestead.js), or null: now and then a customer buys the rider's own eggs, wool or milk
//     instead of bringing an order (goods.saleOrder: a sale slip, levelled by this job's ladder step; it pays the gold
//     the answer comes to, and doesn't move the ladder); goods.sold(order) takes them out of the saddlebags
//     openBox(problem, after(result)): opens the lock-box panel on that problem (main.js pays and pauses); false when it
//     can't just then (paused, or a box already open), and it is asked again shortly; pay: { order,
//     orderEvery, orderFirst } (shop.js PAY); onStart / onStop: the game puts the round-up and the keys away meanwhile;
//     voice(kind, { at, male }): a customer's recorded line ('whatchagot', 'thanksStore', 'niceday': src/audio/shouts.js)
//     open(): false once the day's shift is done (src/shifts.js): the order that finished it is the last, the counter
//     closes by itself after it and no new customer steps up (main.js keeps "Mind the counter" from opening it again)
//   J.start()   to the counter (off the horse first, if riding)
//   J.stop()    "Done for now": the customers wander off, the camera comes back to the rider (inside: the rider round on the
//               customers' side of the counter, facing it)
//   J.update(dt)   each frame (also after stopping: the last customers walk away)
//   J.active, J.state() (for rigs), J.people (the customers about, live: each has x, z), J.dispose()
import * as THREE from 'three';
import { makePerson } from '../actors/folk.js';
import { makeWordProblems, makeOrder, lockboxProblem, FOLK, seeded } from '../math/wordproblems.js';
import { picture } from '../ui/storepics.js';
import { makeStoreSlip, speakLine } from '../ui/storeslip.js';
import { openLongWork } from '../ui/longwork.js';
import { workMul, workDiv, LONG, factFrom } from '../math/longwork.js';
import { sumOf, workFrom } from '../math/jobsums.js';
import { recordFact } from '../math/facts.js';
import { homestead } from '../math/goods.js';
import { counterPicture } from '../ui/counterpics.js';
import { readAloud, record } from '../math/skill.js';
import { MAPS } from '../math/strands.js';
import { levelFor, stateOf } from '../levels/model.js';
import { isAlgebra } from '../lockbox/levelplan.js';
import { storeOrder, pickAsk, askAt } from '../levels/place/store.js';
import { answerTimer } from '../ui/answertimer.js';
import { earn, recordAnswer, countJob, saveRider } from '../save.js';

export const STORE = {
  clerk: 0.9,          // metres out from the store's door where the rider stands, facing the square
  front: 2.35,         // ...and where the customer stands, facing the rider
  queue: [4.1, -1.0],  // the next customer waits this far out and this far to the side (away from the camera)
  queue2: [3.5, -2.6], // ...and the one after, a step further along the store's front (a line of two: a quick answer
                       // never waits on somebody still walking over from across the town)
  from: 7,             // customers walk in from about this far out in the square...
  spread: 6,           // ...and up to this far to either side
  walk: 1.5,           // m/s, a brisk stroll
  jog: 2.4,            // m/s, a townsperson still a way off while the counter is open (src/townpeople.js lends them)
  hurryOver: 3,        // ...a way off: more than this many metres left to walk to their place in the line (2 to the
                       // counter itself: the slip is waiting on them)
  served: 3,           // the last this many customers served aren't asked back into the line straight away
  handOver: 1.4,       // metres from the counter when the customer's slip comes up (they finish stepping up as you read)
  think: 12,           // seconds without a pick before the "Draw it for me" button is offered
  eqWait: 1.3,         // seconds the picked equation shows before the lock box opens
  // the camera: out in the street to one side, the rider and the customer side by side facing each other in the left
  // part of the screen (the slip takes the right). Metres, in the counter's own frame: out = from the door toward the
  // square, side = sideways along the store front, up = over the ground; then the point it looks at. Measured with
  // ~/pw/bandit-math/rigs/store_cam.cjs: the rider lands about two fifths of the way across, the customer just short of
  // the middle, and the store's own porch and GROCERIES sign fill the left, so it reads as standing at the store.
  cam: { out: 4.5, side: 7.0, up: 3.0, lookOut: 2.4, lookSide: -1.0, lookUp: 1.0 },
  // a phone held upright (the slip is a sheet along the bottom): further back, the pair high in the picture
  camPhone: { out: 1.6, side: 6.5, up: 2.6, lookOut: 1.6, lookSide: -1.4, lookUp: -1.2 },
  phoneWidth: 760,     // narrower than this (the slip's own phone layout), the phone framing
  door: 1.7,           // m from the doorway within which a customer walking through pushes the door open
  longOpen: 1.1,       // seconds after the slip comes up when the worked area opens by itself (the story read first)
  longMost: 4,         // a non-bulk order's numbers may need a long sum up to this many points past the rider's Long work
};

// the forms a sale of the rider's own goods comes in, with their points (src/math/strands.js MAPS sales and wool): the
// highest form at or under the store level's school year is the one a customer asks for
const formsOf = (map) => (MAPS[map] ? MAPS[map].ids.map((id, i) => [id, MAPS[map].anchors[i]]) : []);
const SALE_FORMS = { sales: formsOf('sales'), wool: formsOf('wool') };

export function makeStoreJob({ W, folk, P, I, camera, rider, hud, hob = null, refresh = () => {}, openBox = null,
  onStart = () => {}, onStop = () => {}, pay = { order: 3, orderEvery: 3, orderFirst: 1 }, scene = W.scene, goods = null, fish = null, voice = null, town = null, work = null, open: shiftOpen = () => true, room = null }) {
  // a customer's recorded line (src/audio/shouts.js: a man's or a woman's, by `male`), from where they stand
  const speak = (kind, c) => { if (voice && c) voice(kind, { at: () => ({ x: c.x, z: c.z }), male: !c.who.she }); };
  const place = W.places.store;
  if (!rider.topics || typeof rider.topics !== 'object') rider.topics = {};
  if (!rider.topics.store || typeof rider.topics.store !== 'object') rider.topics.store = {};
  const Q = makeWordProblems(rider.topics.store);

  // the counter's own frame: the door, the way out to the square, the rider's right
  const rot = place ? place.rot : 0;
  const door = place ? place.door : { x: 0, z: 0 };
  const out = new THREE.Vector2(Math.sin(rot), Math.cos(rot)), side = new THREE.Vector2(-Math.cos(rot), Math.sin(rot));
  const at = (o, s = 0) => ({ x: door.x + out.x * o + side.x * s, z: door.z + out.y * o + side.y * s });
  const faceOut = rot + Math.PI;   // (a customer at the counter out front faces back toward the store)
  let clerkAt = at(STORE.clerk), frontAt = at(STORE.front), queueAt = at(STORE.queue[0], STORE.queue[1]), riderYaw = rot;
  // (the second place in line, unless something stands there: then a line of one, as before)
  let queue2At = (() => { const q = at(STORE.queue2[0], STORE.queue2[1]); return place && W.blocked && W.blocked(q.x, q.z) ? null : q; })();
  for (const q of [frontAt, queueAt, queue2At]) if (q) q.face = faceOut;
  // INSIDE: the store's room (src/townrooms.js), when it is built: everyone's places, the way in and out, the camera.
  // Worked out as the counter opens (the building may still be being made when the ride starts)
  let IN = null;
  function inside() {
    const R = room ? room() : null, C = R && R.A && R.A.counter;
    if (!R || !R.F || !C || !C.rider || !C.wayIn) return null;
    const F = R.F, pt = (q, face) => { const p = F.point(q); return face == null ? { x: p.x, z: p.z } : { x: p.x, z: p.z, face: F.yaw(face) }; };
    const L = { o: R.o, F, C,
      rider: pt(C.rider), riderYaw: F.yaw(-Math.PI / 2),
      front: pt(C.customer, Math.PI / 2), queue: pt(C.queue, Math.PI / 2 + 0.5), queue2: C.queue2 ? pt(C.queue2, Math.PI) : null,
      wayIn: C.wayIn.map((q) => pt(q)), wayOut: C.wayOut.map((q) => pt(q)) };
    L.door = L.wayIn[0]; L.doorway = L.wayIn[1];
    // where the rider is put when the job ends: out on the customers' side, a little back from where they stand and
    // toward the room's back (off the way out and the line), facing the counter (or, if something stands there, the
    // customer's own spot)
    const off = [C.customer[0] - 0.7, C.customer[1], C.customer[2] - 0.8], offAt = pt(off, Math.PI / 2);
    L.after = W.blocked && W.blocked(offAt.x, offAt.z) ? pt(C.customer, Math.PI / 2) : offAt;
    L.front.inside = L.queue.inside = true;
    return L;
  }
  function useInside() {
    IN = inside();
    if (!IN) return;
    clerkAt = IN.rider; riderYaw = IN.riderYaw; frontAt = IN.front; queueAt = IN.queue; queue2At = IN.queue2;
  }
  // (a customer in the store's room, through its door)
  const CODE = W.V && W.V.CODE;
  const isIn = (c) => !!(IN && CODE && (CODE.indoors ? CODE.indoors(c.x, W.heightAt(c.x, c.z) + 1, c.z) === IN.o : (() => { const R = CODE.room(c.x, W.heightAt(c.x, c.z) + 1, c.z); return R && R.o === IN.o; })()));   // (in through its door: the porch out front is outside)
  // the way to a spot: from outside to a place inside, through the door; from inside out, through it the other way
  function wayTo(c, spot) {
    if (!IN) return null;
    const cin = isIn(c), sin = !!(spot && spot.inside);
    if (!cin && sin) return IN.wayIn.map((q) => ({ ...q }));
    if (cin && !sin) return IN.wayOut.map((q) => ({ ...q }));
    return null;
  }

  const U = makeStoreSlip(document.body, { onPick: (i) => pick(i), onDone: () => J.stop(), onDraw: () => draw(), onWork: () => (order && !order.long && work ? work() : openLong()) });
  const J = { active: false };
  let phase = 'off';         // off | dismount | open
  let order = null, missed = false, helped = false, thinkT = 0, filled = 0, earned = 0, eqPending = false;
  let lastAsk = null, timer = null, longPanel = null, longT = null, forced = null;
  const news = [];       // a badge or a new title won with the order at the counter, told on the slip with the tip
  const people = [];         // the customers about: { p, x, z, yaw, state: 'come'|'queue'|'front'|'serve'|'go', who, to }
  // the names of the last few served: just thanked and walking off, they aren't the town's "best placed" for the line
  // (given back right at the counter, they were: the same person turned round and got back in line)
  const served = [];
  const busyNames = () => [...people.map((c) => c.who.name), ...served, ...Q.state.lastWho];

  // ── THE CUSTOMERS ──────────────────────────────────────────────────────────────────────────────────────────────
  function pickWho() {
    const busy = new Set(busyNames());
    const free = FOLK.filter((f) => !busy.has(f.name));
    const list = free.length ? free : FOLK.filter((f) => !people.some((c) => c.who.name === f.name));
    return list[Math.floor(Math.random() * list.length)] || FOLK[0];
  }
  function spawn(dest, near = false) {
    // a townsperson (src/townpeople.js): whoever is best placed, already about or out of the nearest door (never the
    // store's own), walking the town's paths to the counter; given back when they leave
    const T = town ? town() : null;
    if (T) {
      const busy = new Set(busyNames()), names = FOLK.map((f) => f.name).filter((n) => !busy.has(n));
      // (into the store: lent as far as its door, then in through it)
      const into = IN && dest.inside;
      const got = T.lend({ to: into ? IN.door : dest, names: names.length ? names : null, notDoor: 'store' });
      if (got) {
        const c = { p: got.p, who: FOLK.find((f) => f.name === got.name) || got.who, x: got.x, z: got.z, yaw: got.yaw, state: 'come', to: dest, walking: false, via: into ? [...(got.via || []), ...IN.wayIn.map((q) => ({ ...q }))] : got.via, lent: got };
        people.push(c);
        return c;
      }
    }
    const who = pickWho();
    let p;
    try { p = makePerson(folk, { ...who.look, skin: Math.floor(Math.random() * 8), hair: Math.floor(Math.random() * 11) }); } catch (e) { console.error(e); return null; }
    // in from the square, from a spot that isn't inside a building or a fence
    let start = null;
    for (let k = 0; k < 12 && !start; k++) {
      // (from the far side of the street from the camera, so nobody walks through the picture)
      const o = (near ? 6 : STORE.from) + Math.random() * 3, s = -Math.random() * STORE.spread;
      const c = at(o, s); if (!W.blocked(c.x, c.z) && W.waterAt(c.x, c.z) < 0.3) start = c;
    }
    if (!start) start = at(near ? 6 : STORE.from, -2);
    const c = { p, who, x: start.x, z: start.z, yaw: 0, state: 'come', to: dest, walking: false, via: IN && dest.inside ? IN.wayIn.map((q) => ({ ...q })) : null };
    c.yaw = Math.atan2(dest.x - c.x, dest.z - c.z);
    p.root.position.set(c.x, W.heightAt(c.x, c.z), c.z); p.root.rotation.y = c.yaw;
    scene.add(p.root);
    people.push(c);
    return c;
  }
  // walks c toward c.to; true once there
  function walk(c, dt) {
    // (a townsperson's way here first: the points of the town's paths, then the spot itself; inside the store, the way
    // through its door, in or out, walked closely)
    const close = IN ? 0.18 : 0.5;
    while (c.via && c.via.length && Math.hypot(c.via[0].x - c.x, c.via[0].z - c.z) < close) c.via.shift();
    const tg = c.via && c.via.length && (c.state !== 'go' || c.out) ? c.via[0] : c.to;
    // (going through the doorway: the door pushed open, as the townsfolk do, src/townpeople.js)
    if (IN && CODE && CODE.doors && Math.hypot(c.x - IN.doorway.x, c.z - IN.doorway.z) < STORE.door) CODE.doors.pass(IN.doorway.x, IN.doorway.z, 1.2);
    const dx = tg.x - c.x, dz = tg.z - c.z, d = Math.hypot(dx, dz);
    if (d < 0.06) {
      if (c.walking) { c.walking = false; c.clip = 'Idle'; c.p.play('Idle', { fade: 0.3 }); }
      return true;
    }
    // (a townsperson still a way off while the counter is open hurries along, so the player doesn't wait. A way off by
    // the metres left to walk: a straight way across the square has only a point or two on it)
    const hurry = J.active && c.state !== 'go' && c.lent && left(c) > (c.state === 'front' ? 2 : STORE.hurryOver), clip = hurry ? 'Run' : 'Walk';
    const pace = hurry ? STORE.jog : c.state === 'go' ? STORE.walk * 1.15 : STORE.walk;
    if (!c.walking || c.clip !== clip) { c.walking = true; c.clip = clip; c.p.play(clip, { fade: 0.25, speed: pace / ((c.p.stride && c.p.stride[clip]) || 1.2) }); }   // (stride: m/s per clip, { Walk, Run })
    const v = Math.min(pace, d * 3), step = Math.min(d, v * dt);
    c.x += dx / d * step; c.z += dz / d * step;
    turn(c, Math.atan2(dx, dz), dt);
    return false;
  }
  // the metres c has left to walk: along the town's path points, then to the spot (theirs, or `to`)
  function left(c, to = c.to) {
    let d = 0, x = c.x, z = c.z;
    if (c.via) for (const q of c.via) { d += Math.hypot(q.x - x, q.z - z); x = q.x; z = q.z; }
    return d + Math.hypot(to.x - x, to.z - z);
  }
  function turn(c, want, dt) {
    const a = Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw));
    c.yaw += a * Math.min(1, dt * 7);
  }
  function placePerson(c, dt) {
    c.p.root.position.set(c.x, W.heightAt(c.x, c.z), c.z);
    c.p.root.rotation.y = c.yaw;
    c.p.update(dt);
  }
  let leaveN = 0;
  function leave(c) {
    // (in the store: out through its door first, then on as below)
    if (IN && isIn(c) && !c.out) { c.state = 'go'; c.out = true; c.via = IN.wayOut.slice(0, -1).map((q) => ({ ...q })); c.to = IN.wayOut[IN.wayOut.length - 1]; c.walking = false; return; }
    c.out = false;
    // (a townsperson walks on about the town: home, or wherever they were going)
    if (c.lent && town && town()) { c.state = 'go'; syncBack(c); town().giveBack(c.lent); const i = people.indexOf(c); if (i >= 0) people.splice(i, 1); return; }
    c.state = 'go';
    const s = -(STORE.spread + 4) * (0.7 + Math.random() * 0.3);   // (off the far way, away from the camera)
    // (one leaves along the near side of the street, the next along the far side, so two walking off never cross)
    c.to = at(STORE.from + (leaveN++ % 2 ? 2.6 : 0.2) + Math.random() * 0.4, s);
    c.walking = false;
  }
  function removePerson(c) {
    if (c.lent && town && town()) { syncBack(c); town().giveBack(c.lent); }
    else { scene.remove(c.p.root); try { c.p.dispose(); } catch (e) { /* (already gone) */ } }
    const i = people.indexOf(c); if (i >= 0) people.splice(i, 1);
  }
  // (where a borrowed townsperson stands now, for the town to take them on from there)
  function syncBack(c) { c.lent.x = c.x; c.lent.z = c.z; c.lent.yaw = c.yaw; }
  const atFront = () => people.find((c) => c.state === 'front' || c.state === 'serve');
  // the one in (or on the way to) a place in line
  const inLine = (spot) => (spot ? people.find((c) => (c.state === 'queue' || c.state === 'come') && c.to === spot) : null);
  // (in through the door: after what is left of their way here; out through it: at once)
  const stepTo = (c, spot, state) => { c.state = state; c.to = spot; c.walking = false; const w = wayTo(c, spot); if (w) c.via = spot && spot.inside ? [...(c.via || []), ...w] : w; };

  // the line moves up: whichever of the two in line is nearer the counter steps up to it (the first, unless they are
  // still on their way over and the second is already here), the other takes the first place, and somebody new heads
  // for the back of the line
  function moveUp() {
    if (!J.active || !shiftOpen()) return;   // (the day's shift done: nobody new steps up)
    if (!atFront()) {
      const a = inLine(queueAt), b = inLine(queue2At);
      const q = a && b ? (left(b, frontAt) < left(a, frontAt) - 0.5 ? b : a) : a || b;
      if (q) stepTo(q, frontAt, 'front');
      else { const c = spawn(frontAt, true); if (c) c.state = 'front'; }
    }
    if (!inLine(queueAt)) {
      const q2 = inLine(queue2At);
      if (q2) stepTo(q2, queueAt, q2.state === 'queue' ? 'come' : q2.state);
      else { const c = spawn(queueAt); if (c) c.state = 'come'; }
    }
    if (queue2At && !inLine(queue2At)) { const c = spawn(queue2At); if (c) c.state = 'come'; }
  }

  // the tip goes by how far up the store's ladder the order was made (1 at the bottom .. 9 at the top, as the old steps)
  const payOf = (q) => 1 + Math.round(8 * q.i / Math.max(1, q.n - 1));
  // ── AN ORDER AT THE COUNTER ──────────────────────────────────────────────────────────────────────────────────────
  // the next order: the store's level, one kind from its mix (see THE STORE'S LEVELS above)
  function deal(who) {
    const q = levelFor(rider, 'store');
    saveRider(rider);   // (the first time: the store has just been met)
    const mark = (o, extra = {}) => Object.assign(o, { levelId: q.id, placing: !!q.placing, grade: q.level.grade, payStep: payOf(q),
      picture: o.counter ? counterPicture : (o.picture || null) }, extra);
    if (forced) {   // (rigs: J.dev.next({ type, step, sum, longStep, longOp, ladder: 'K' }), or { counter: 'time', step: 2, seed })
      const f = forced; forced = null;
      if (f.counter) return mark(storeOrder({ maker: f.counter, step: f.step || 1 }, { who, rand: f.seed != null ? seeded(f.seed) : Math.random }), { fixed: true });
      const K = f.ladder === 'K' || f.map === 'storeK', step = f.step || 1;
      const o = makeOrder(f.type, { who, step, ladder: K ? 'K' : 'main', longStep: f.longStep || 4, longOp: f.longOp || null, sum: f.sum || null });
      o.own = { strand: 'words', at: askAt({ maker: K ? 'wordsK' : 'words', step }) };
      return mark(o, { fixed: true, longAt: o.long ? o.long.point : null });
    }
    // the fish kept at the dock: the first customer after a catch buys some, then one in a few (src/fishingjob.js), in
    // the form that fits the store's level (none under its easiest)
    { const FJ = fish && fish(), s = FJ && FJ.saleOrder ? FJ.saleOrder({ who, grade: q.level.grade }) : null; if (s) return s; }
    // now and then a customer buys the rider's own goods: eggs, milk and flour (Word problems), wool (Fractions), at the
    // form that fits the store's level (a form past it isn't bought)
    if (goods) {
      const carried = homestead(rider).goods, g = q.level.grade, plan = { step: payOf(q), sales: null, wool: null };
      const formAt = (map) => { let id = null, at = null; for (const [k, p] of SALE_FORMS[map]) if (p <= g) { id = k; at = p; } return id ? { id, at } : null; };
      const sf = (carried.eggs || carried.milk || carried.flour) ? formAt('sales') : null, wf = carried.wool ? formAt('wool') : null;
      if (sf) Object.assign(plan, { sales: sf.id, salesAt: sf.at });
      if (wf) Object.assign(plan, { wool: wf.id, woolAt: wf.at });
      const sale = (plan.sales || plan.wool) ? goods.saleOrder({ step: plan, who }) : null;
      if (sale) return sale;
    }
    const ask = pickAsk(q.level.gen.mix, Math.random, lastAsk);
    lastAsk = ask;
    // (a word problem's numbers stay inside the level's school year: no long sum past it)
    return mark(storeOrder(ask, { who, trainer: Q, longMost: q.level.grade, frac: q.count ? q.into / q.count : 0 }));
  }
  function serve(c) {
    c.state = 'serve';
    served.push(c.who.name); if (served.length > STORE.served) served.shift();
    order = deal(c.who);
    missed = false; helped = false; thinkT = 0; eqPending = false;
    U.purse(rider.gold);   // (in step with the gold, the lock box's pay included)
    const young = readAloud(rider);
    const own = ownOf(order);
    order.work = true;   // (Work it out always helps: the order's sum, or the entry to type one by hand)
    U.show(order, { filled, pic: order.picFirst ? (order.picture || picture)(order.pic) : null, read: young,
      lead: order.lead ? counterPicture(order.lead) : null, note: order.placing ? 'finding your level' : '' });
    if (young && order.read) setTimeout(() => { if (order && order.read && J.active && !U.busy) speakLine(order.read); }, 500);
    if (timer) timer.cancel();
    timer = answerTimer();
    // a sum too big for the head: the worked area opens by itself, unless the store's level is well past it
    clearTimeout(longT);
    if (order.long && (order.grade ?? 0) < order.long.point + LONG.COMFORT) { const o = order; longT = setTimeout(() => { if (order === o) openLong(); }, STORE.longOpen * 1000); }
    if (order.sale) speak('whatchagot', c);   // (come to buy the rider's own goods)
    if (c.walking) c.hand = true; else handOver(c);
  }
  // the strand an order is about, at the point it was asked: Word problems, or the sale's (Word problems or
  // Fractions), or the counter question's own (money, time, dec, pct, ratio)
  function ownOf(o) {
    if (o.sale) return o.sale.at != null ? { strand: o.sale.strand || (o.sale.map === 'wool' ? 'frac' : 'words'), at: o.sale.at } : null;   // (a fish sale says its own strand)
    return o.own || null;
  }
  // what an answer to this order counts in: its own strand at the point asked, and the order's extra strands (a
  // Long work credit is left out when the worked area ran: it counted the sum itself)
  function strandsOf(o, { worked = false } = {}) {
    const own = ownOf(o);
    return [own, ...(o.credit || []).filter((c) => !(worked && c.long)).map((c) => ({ strand: c.strand, at: c.at, weight: c.weight }))]
      .filter((x) => x && x.at != null);
  }
  // records the order's first answer (once): the old last-50 tally and badges, and the skill model
  function answered(o, right, { worked = false, t = null } = {}) {
    if (o.recorded) return;
    o.recorded = true;
    const tm = t || (timer ? timer.stop() : {});
    // (an order made at a store level moves that level once; a sale counts only in its own strand)
    const lv = o.levelId && !o.sale ? { place: 'store', level: o.levelId } : {};
    // (a times fact in the order's working, 4 pies × 3 pounds or 24 nails ÷ 4 kegs, goes on the times chart too)
    const fact = o.equation || o.sale ? null : factFrom(o.rightWhy || '');
    if (fact) { try { recordFact(rider, fact.a, fact.b, right); } catch (e) { console.warn(e); } }
    const rec = recordAnswer(rider, right, { ...lv, strands: strandsOf(o, { worked }), sitDown: true, size: o.size || 1, ms: tm.ms, hidden: tm.hidden, idle: tm.idle });
    if (rec && rec.badge) news.push(`You earned the ${rec.badge} badge!`);
  }
  // the customer holds out the slip (once they've stopped walking)
  function handOver(c) {
    c.hand = false;
    if (c.p.play('Interact', { fade: 0.2, once: true })) setTimeout(() => { if (c.state === 'serve' && !c.walking) c.p.play('Idle', { fade: 0.4 }); }, 1400);
  }
  const tip = () => pay.order + Math.floor(((order.payStep || order.step) - 1) / pay.orderEvery);
  async function pick(i, { worked = false } = {}) {
    if (!order || U.busy || eqPending) return;
    if (longPanel && !worked) return;   // (the worked area is up: its answers count)
    const o = order, c = o.coins[i]; if (!c) return;
    const res = o.sale || o.counter ? { first: !o.picked } : Q.answer(o, c, { helped });   // (a sale, or a counter question: not this ladder's)
    o.picked = true;
    clearTimeout(longT);
    // (a badge won by this first pick is told on the slip with the tip)
    if (res.first && !worked) answered(o, c.good);
    if (!c.good) {
      missed = true;
      U.wrong(i, { why: c.why, pic: (o.picture || picture)(o.pic), inLead: sameLead(o) });
      if (hob) hob.event('storeMiss');
      saveRider(rider);
      return;
    }
    const front = atFront();
    if (hob) hob.event('storeRight');
    if (o.equation) {
      // the top step: the equation is right; the lock box solves it
      eqPending = true;
      U.equation(i, { line: o.rightWhy });
      if (hob) hob.event('storeEquation');
      saveRider(rider);
      // (the rider's own lock-box level: below x on both sides it is a find-x box, from there the moves)
      const lb = stateOf(rider, 'lockbox');
      const problem = lockboxProblem(o.equation, { find: !(lb && isAlgebra(lb.id)) });
      // (if the game is paused or another box is open just then, openBox says no and it tries again a moment later)
      const toBox = () => {
        if (!J.active || order !== o) return;
        if (!problem || !openBox) { finishOrder(o, front, { line: o.afterWhy, gold: tip() }); return; }
        const opened = openBox(problem, (r) => {
          if (!J.active || order !== o) return;
          if (r && r.solved) finishOrder(o, front, { line: `${o.afterWhy}. Much obliged!`, gold: 0, boxGold: r.gold });
          else finishOrder(o, front, { line: 'No matter, I\'ll puzzle it out at home.', gold: 0, unfilled: true });
        });
        if (opened === false) setTimeout(toBox, 500);
      };
      setTimeout(toBox, STORE.eqWait * 1000);
      return;
    }
    if (o.sale) {   // (your goods sold: the gold the answer comes to)
      if (o.sale.goods === 'fish') { const FJ = fish && fish(); if (FJ) FJ.sold(o); } else if (goods) goods.sold(o);
      await finishOrder(o, front, { line: o.rightWhy, gold: o.sale.gold, first: !missed, paid: `+${o.sale.gold} gold for your ${o.sale.goods}` });
      return;
    }
    await finishOrder(o, front, { line: o.rightWhy, gold: tip() + (missed ? 0 : pay.orderFirst), first: !missed });
  }
  // pays (when it's a tip), counts the order, plays the coins, and sends the customer off; the next steps up
  async function finishOrder(o, c, { line, gold = 0, boxGold = 0, unfilled = false, first = false, paid = '' }) {
    let from = rider.gold, buckle = null;
    if (gold > 0) { const e = earn(rider, gold); earned += gold; if (e && e.newTitle) news.push(`You're a ${e.newTitle} now!`); }
    if (boxGold) { earned += boxGold; from = rider.gold; }
    if (!unfilled) { filled++; buckle = countJob(rider, 'orders', 1).buckle; if (hob) hob.event('storeFilled'); }   // (a round of the day's shift: src/shifts.js)
    if (buckle) hud.buckle(buckle, { delay: 600 });
    setTimeout(refresh, 700);   // (the HUD's purse goes up as the slip's coins land)
    order = null; eqPending = false;
    // the customer tips their hat and goes, and the one waiting in line steps up while the coins fly
    if (c) { if (!unfilled) speak('thanksStore', c); c.p.play('Wave', { fade: 0.2, once: true }); setTimeout(() => { if (c.state === 'serve') { leave(c); speak('niceday', c); } moveUp(); }, 900); }
    const told = news.splice(0);
    await U.right(o.coins.findIndex((k) => k.good), { line, gold, from, to: rider.gold, note: first ? 'right first time' : '', news: told, paid });
    if (!J.active) return;
    await U.leave();
    if (!J.active) return;
    if (c && c.state === 'serve') leave(c);
    if (!shiftOpen()) { J.stop(); return; }   // (that was the shift's last order: the counter closes)
    moveUp();
    const next = atFront();
    if (next) U.waiting(`Here comes ${next.who.name}…`);
  }
  // the help is the question's own picture with more on it (the clock with its minutes, the coins with their values):
  // it takes that picture's place on the slip
  const sameLead = (o) => !!(o.lead && o.pic && o.lead.kind === o.pic.kind);
  function draw() {
    if (!order || U.busy) return;
    helped = true;
    U.drawn((order.picture || picture)(order.pic), { inLead: sameLead(order) });
  }

  // ── THE WORKED AREA ──────────────────────────────────────────────────────────────────────────────────────────
  // The sum worked on paper (src/ui/longwork.js). Each first tap counts lightly in its own fact's strand; when it's
  // done, the whole sum counts in Long work (a big order: at the point the strand asked; a sum that came with the
  // story's numbers: at its own point), the order's answer in Word problems (the word answer right first time), and the
  // order is filled as though its coin was picked. Closing it ("Back to the slip") counts nothing: the coins are still
  // there.
  function openLong() {
    const o = order;
    if (!o || !o.long || longPanel || U.busy || !J.active) return false;   // (false: not opened, e.g. already up: the tools open their entry instead)
    const already = !!o.recorded;   // (opened after a coin was picked: it helps, but the order's answer is already counted)
    clearTimeout(longT);
    const L = o.long, work = L.op === 'mul' ? workMul(L.a, L.b, L.lead ? { lead: L.lead } : {}) : workDiv(L.n, L.d);
    let firstRight = true;
    longPanel = openLongWork(document.body, {
      work, final: L.final, ask: o.ask, speak: readAloud(rider) ? speakLine : null,
      onTap: (tp) => {
        if (!tp.first || tp.helped) return;   // (a tap after the helper strip showed the answer: nothing to count)
        if (tp.part !== 'work') { if (!tp.right) firstRight = false; return; }
        if (tp.fact) { try { record(rider, [{ strand: tp.fact.strand, at: tp.fact.at, weight: 0.5 }], { right: tp.right, sitDown: true, size: 1, ...tp.timed }); } catch (e) { console.warn(e); } }
      },
      onDone: (r) => {
        if (order !== o || !J.active) return;
        if (!already) {
          try { record(rider, [{ strand: 'long', at: o.longAt != null ? o.longAt : L.point }], { right: r.clean, sitDown: true, ms: r.ms, size: work.steps.length, hidden: r.hidden, idle: r.idle }); } catch (e) { console.warn(e); }
          const t = timer ? timer.stop() : {};
          answered(o, firstRight, { worked: true, t });
        }
        saveRider(rider);
        // the panel goes by itself after its last line; then the right coin glows. (The tip's "right first time" goes by
        // the story's part, the word answer; a slip in the digits is what the paper is for.)
        if (!firstRight) missed = true;
        setTimeout(() => { longPanel = null; if (order === o && J.active) pick(o.coins.findIndex((c) => c.good), { worked: true }); }, 1700);
      },
      onClose: () => { longPanel = null; saveRider(rider); },
    });
    return true;
  }

  // ── STARTING AND STOPPING ────────────────────────────────────────────────────────────────────────────────────
  J.start = () => {
    if (J.active || !place) return false;
    J.active = true; filled = 0; earned = 0; order = null; news.length = 0;
    P.enabled = false;
    onStart();
    U.purse(rider.gold);
    U.waiting('Opening up the counter…');
    useInside();   // (the store's room, if it has one: the counter inside)
    if (P.onHorse) { P.dismount(); phase = 'dismount'; } else open();
    return true;
  };
  function open() {
    phase = 'open';
    P.teleport(clerkAt.x, clerkAt.z, riderYaw);
    P.cam.enabled = false;
    if (hob) hob.event('storeStart');
    moveUp();
  }
  J.stop = () => {
    if (!J.active) return;
    const wasOpen = phase === 'open';
    J.active = false; phase = 'off'; order = null; eqPending = false;
    clearTimeout(longT);
    if (longPanel) { longPanel.close(); longPanel = null; }
    if (timer) { timer.cancel(); timer = null; }
    try { if (globalThis.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* (no voice) */ }
    U.hide();
    for (const c of [...people]) if (c.state !== 'go') leave(c);
    // (inside, the rider steps round to the customers' side of the counter, facing it: behind it, the storekeeper and
    // the shelves hem them in)
    if (wasOpen && IN && IN.after) P.teleport(IN.after.x, IN.after.z, IN.after.face);
    P.cam.enabled = true; P.cam.snap();
    P.enabled = true;
    onStop();
    if (filled) hud.toast(`${filled} order${filled === 1 ? '' : 's'} filled · +${earned} gold`, 'gold');
    if (hob) hob.event('storeDone', { filled });
  };

  // ── EACH FRAME ───────────────────────────────────────────────────────────────────────────────────────────────
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  J.update = (dt) => {
    if (phase === 'dismount' && P.mode === 'foot') open();
    for (const c of [...people]) {
      const there = walk(c, dt);
      if (!there && c.state === 'front' && J.active && phase === 'open' && !order && !U.busy
        && Math.hypot(c.x - frontAt.x, c.z - frontAt.z) < STORE.handOver) serve(c);
      if (there) {
        if (c.state === 'front' && J.active && phase === 'open' && !order && !U.busy) serve(c);
        else if (c.state === 'come' && (c.to === queueAt || c.to === queue2At)) c.state = 'queue';
        else if (c.state === 'go' && c.out) { leave(c); if (!people.includes(c)) continue; }   // (out of the store's door: on about the town)
        else if (c.state === 'go') { removePerson(c); continue; }
        if (c.state === 'serve' && c.hand) handOver(c);
        if (c.state === 'serve' || c.state === 'queue' || c.state === 'front') turn(c, (c.to && c.to.face) ?? faceOut, dt);
      }
      placePerson(c, dt);
    }
    if (!J.active || phase !== 'open') return;
    // the "Draw it for me" button after a long think (a wrong pick shows the picture by itself)
    if (order && !missed && !helped && !U.busy && !longPanel && (thinkT += dt) > STORE.think) { U.offerDraw(true); thinkT = -1e9; }
    // the camera: inside, from the store's back across the room at the pair over the counter (the store recipe's own
    // framing); out front, from the street, the rider and the customer side by side
    if (IN) {
      const K = (innerWidth < STORE.phoneWidth && IN.C.camPhone) || IN.C.cam, a = IN.F.point(K.at), b = IN.F.point(K.look);
      camPos.set(a.x, a.y, a.z); camLook.set(b.x, b.y, b.z);
    } else {
      const K = innerWidth < STORE.phoneWidth ? STORE.camPhone : STORE.cam, y0 = W.heightAt(clerkAt.x, clerkAt.z);
      const cp = at(STORE.clerk + K.out, K.side), lp = at(K.lookOut, K.lookSide);
      camPos.set(cp.x, y0 + K.up, cp.z); camLook.set(lp.x, W.heightAt(lp.x, lp.z) + K.lookUp, lp.z);
    }
    camera.position.copy(camPos); camera.lookAt(camLook);
  };

  // Esc is "Done for now" while working the counter (unless a panel or the lock box over it wants it)
  const onKey = (e) => {
    if (e.key !== 'Escape' || !J.active || e.defaultPrevented || e.repeat) return;
    if (document.querySelector('.bms, .lbx, .bml:not(.is-out), .tch:not(.out), .bmtl-menu')) return;   // (a panel, or the worked area: its own Esc goes back to the slip)
    e.preventDefault(); J.stop();
  };
  addEventListener('keydown', onKey, true);

  J.state = () => ({ active: J.active, phase, filled, earned, order: order ? { type: order.type, step: order.step, level: order.levelId || null, placing: !!order.placing, own: order.own || null, kind: order.ask_ || null, key: order.key, story: order.story, ask: order.ask,
    counter: order.counter || null, lead: order.lead ? order.lead.kind : null, pic: order.pic ? order.pic.kind : null,
    coins: order.coins.map((c) => ({ label: c.label, good: c.good })), equation: order.equation, sale: order.sale || null, credit: order.credit || [], long: order.long ? { op: order.long.op, point: order.long.point, a: order.long.a, b: order.long.b, n: order.long.n, d: order.long.d } : null } : null,
    longOpen: !!longPanel, long: longPanel ? longPanel.state() : null,
    people: people.map((c) => ({ who: c.who.name, state: c.state, x: +c.x.toFixed(2), z: +c.z.toFixed(2), inside: IN ? isIn(c) : null })), busy: U.busy, inside: !!IN });
  // the level was moved by hand (the tools strip's arrows): the order at the counter, not yet answered, is made again at
  // the new level for the same customer (a sale of the rider's goods or fish, or a rig's order, stays as it is)
  J.relevel = () => {
    if (!J.active || !order || order.picked || order.sale || order.fixed || longPanel || U.busy || eqPending) return false;
    const c = people.find((x) => x.state === 'serve'); if (!c) return false;
    if (served[served.length - 1] === c.who.name) served.pop();
    serve(c);
    return true;
  };
  J.people = people;    // (read each frame by the wagons, which stop for customers: no copies made)
  // (the end of the line while the counter is open: where the town sends one more to wait, src/townpeople.js)
  J.lineSpot = () => (IN && J.active ? queue2At : null);
  J.busyNames = busyNames;   // (the town doesn't send these over: src/townpeople.js)
  J.trainer = Q;
  // (rigs: the next customer brings this order: { type, ladder: 'K', step, sum: { op: 'div', n: 112, d: 5 }, longStep,
  // longOp }, or a counter question: { counter: 'time', step: 2, seed } (seed: the same question every time))
  J.dev = { next: (spec) => { forced = spec || null; }, openLong: () => openLong() };
  // the sum on the order at the counter, for the tools' Work it out (src/ui/tools.js): the worked area's own (it counts,
  // as above: open it with J.openLong), else the order's own sum or the one read from its working (plain help: nothing
  // counts and the kid still picks the coin), or null (a clock to read, coins to count: the tools offer the entry to type
  // a sum by hand). Two steps answered with one coin (the bill, then the change) are handed over as steps: the maker's
  // own (order.sum, with what each step finds), else every sum the working names with its answer (jobsums.js workFrom)
  J.workSum = () => {
    if (!J.active || !order || U.busy || eqPending) return null;
    const L = order.long;
    if (L) return { own: true, op: L.op, a: L.op === 'div' ? L.n : L.a, b: L.op === 'div' ? L.d : L.b, ask: order.ask };
    const s = order.equation ? null : (order.sum ? sumOf(order.sum) : workFrom(order.rightWhy || ''));
    return s ? { ...s, ask: order.ask, story: true } : null;
  };
  J.openLong = () => openLong();
  J.dispose = () => { removeEventListener('keydown', onKey, true); if (J.active) J.stop(); for (const c of [...people]) removePerson(c); U.dispose(); };
  return J;
}
