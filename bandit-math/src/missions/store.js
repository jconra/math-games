// THE STORE COUNTER: a job at the general store. The rider stands at the store's front with the order book, and
// townsfolk walk up from the square one after another, each with an order slip: a little word problem
// (src/math/wordproblems.js) shown big on a parchment slip (src/ui/storeslip.js). The kid picks a coin; a right one
// tips gold (the coins fly into the purse and it counts up) and the customer tips their hat and goes, while the next
// one, already waiting in line, steps up with their slip. A wrong coin shows one plain line about that slip and a picture
// of that kind of problem, and the kid picks again: no penalty, the customer just waits. "Done for now" (or Esc) ends it.
// On the top step the story is told backwards: the kid picks the equation that tells it, and the lock-box panel opens on
// that equation to solve it (the lock box pays as the sheriff's does).
//
// Started from the general store's counter (shop.js: "Mind the counter"). Each filled order counts toward the "orders
// filled" belt buckle (save.js JOBS).
//
//   const J = makeStoreJob({ W, folk, P, I, camera, rider, hud, hob, refresh, openBox, onStart, onStop, pay, goods })
//     goods: the homestead (src/homestead.js), or null: now and then a customer buys the rider's own eggs, wool or milk
//     instead of bringing an order (goods.saleOrder: a sale slip, levelled by this job's ladder step; it pays the gold
//     the answer comes to, and doesn't move the ladder); goods.sold(order) takes them out of the saddlebags
//     openBox(problem, after(result)): opens the lock-box panel on that problem (main.js pays and pauses); false when it
//     can't just then (paused, or a box already open), and it is asked again shortly; pay: { order,
//     orderEvery, orderFirst } (shop.js PAY); onStart / onStop: the game puts the round-up and the keys away meanwhile;
//     voice(kind, { at, male }): a customer's recorded line ('whatchagot', 'thanksStore', 'niceday': src/audio/shouts.js)
//   J.start()   to the counter (off the horse first, if riding)
//   J.stop()    "Done for now": the customers wander off, the camera comes back to the rider
//   J.update(dt)   each frame (also after stopping: the last customers walk away)
//   J.active, J.state() (for rigs), J.people (the customers about, live: each has x, z), J.dispose()
import * as THREE from 'three';
import { makePerson } from '../actors/folk.js';
import { makeWordProblems, lockboxProblem, FOLK } from '../math/wordproblems.js';
import { picture } from '../ui/storepics.js';
import { makeStoreSlip } from '../ui/storeslip.js';
import { earn, recordAnswer, countJob, saveRider } from '../save.js';

export const STORE = {
  clerk: 0.9,          // metres out from the store's door where the rider stands, facing the square
  front: 2.35,         // ...and where the customer stands, facing the rider
  queue: [4.1, -1.0],  // the next customer waits this far out and this far to the side (away from the camera)
  from: 7,             // customers walk in from about this far out in the square...
  spread: 6,           // ...and up to this far to either side
  walk: 1.5,           // m/s, a brisk stroll
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
};

export function makeStoreJob({ W, folk, P, I, camera, rider, hud, hob = null, refresh = () => {}, openBox = null,
  onStart = () => {}, onStop = () => {}, pay = { order: 3, orderEvery: 3, orderFirst: 1 }, scene = W.scene, goods = null, voice = null }) {
  // a customer's recorded line (src/audio/shouts.js: the men only; it knows by `male`), from where they stand
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
  const clerkAt = at(STORE.clerk), frontAt = at(STORE.front), queueAt = at(STORE.queue[0], STORE.queue[1]);

  const U = makeStoreSlip(document.body, { onPick: (i) => pick(i), onDone: () => J.stop(), onDraw: () => draw() });
  const J = { active: false };
  let phase = 'off';         // off | dismount | open
  let order = null, missed = false, helped = false, thinkT = 0, filled = 0, earned = 0, eqPending = false;
  const news = [];       // a badge or a new title won with the order at the counter, told on the slip with the tip
  const people = [];         // the customers about: { p, x, z, yaw, state: 'come'|'queue'|'front'|'serve'|'go', who, to }

  // ── THE CUSTOMERS ──────────────────────────────────────────────────────────────────────────────────────────────
  function pickWho() {
    const busy = new Set([...people.map((c) => c.who.name), ...Q.state.lastWho]);
    const free = FOLK.filter((f) => !busy.has(f.name));
    const list = free.length ? free : FOLK.filter((f) => !people.some((c) => c.who.name === f.name));
    return list[Math.floor(Math.random() * list.length)] || FOLK[0];
  }
  function spawn(dest, near = false) {
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
    const c = { p, who, x: start.x, z: start.z, yaw: 0, state: 'come', to: dest, walking: false };
    c.yaw = Math.atan2(dest.x - c.x, dest.z - c.z);
    p.root.position.set(c.x, W.heightAt(c.x, c.z), c.z); p.root.rotation.y = c.yaw;
    scene.add(p.root);
    people.push(c);
    return c;
  }
  const faceRider = rot + Math.PI;   // (a customer at the counter faces back toward the store)
  // walks c toward c.to; true once there
  function walk(c, dt) {
    const dx = c.to.x - c.x, dz = c.to.z - c.z, d = Math.hypot(dx, dz);
    if (d < 0.06) {
      if (c.walking) { c.walking = false; c.p.play('Idle', { fade: 0.3 }); }
      return true;
    }
    const pace = c.state === 'go' ? STORE.walk * 1.15 : STORE.walk;
    if (!c.walking) { c.walking = true; c.p.play('Walk', { fade: 0.25, speed: pace / ((c.p.stride && c.p.stride.Walk) || 1.2) }); }   // (stride: m/s per clip, { Walk, Run })
    const v = Math.min(pace, d * 3), step = Math.min(d, v * dt);
    c.x += dx / d * step; c.z += dz / d * step;
    turn(c, Math.atan2(dx, dz), dt);
    return false;
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
    c.state = 'go';
    const s = -(STORE.spread + 4) * (0.7 + Math.random() * 0.3);   // (off the far way, away from the camera)
    // (one leaves along the near side of the street, the next along the far side, so two walking off never cross)
    c.to = at(STORE.from + (leaveN++ % 2 ? 2.6 : 0.2) + Math.random() * 0.4, s);
    c.walking = false;
  }
  function removePerson(c) {
    scene.remove(c.p.root); try { c.p.dispose(); } catch (e) { /* (already gone) */ }
    people.splice(people.indexOf(c), 1);
  }
  const atFront = () => people.find((c) => c.state === 'front' || c.state === 'serve');
  const inQueue = () => people.find((c) => c.state === 'queue' || (c.state === 'come' && c.to === queueAt));

  // the line moves up: the one waiting steps to the counter, and somebody new heads for the line
  function moveUp() {
    if (!J.active) return;
    if (!atFront()) {
      const q = inQueue();
      if (q) { q.state = 'front'; q.to = frontAt; q.walking = false; }
      else { const c = spawn(frontAt, true); if (c) c.state = 'front'; }
    }
    if (!inQueue()) { const c = spawn(queueAt); if (c) c.state = 'come'; }
  }

  // ── AN ORDER AT THE COUNTER ──────────────────────────────────────────────────────────────────────────────────────
  function serve(c) {
    c.state = 'serve';
    order = (goods && goods.saleOrder({ step: Q.level().step, who: c.who })) || Q.next({ who: c.who });
    missed = false; helped = false; thinkT = 0; eqPending = false;
    U.purse(rider.gold);   // (in step with the gold, the lock box's pay included)
    U.show(order, { filled });
    if (order.sale) speak('whatchagot', c);   // (come to buy the rider's own goods)
    if (c.walking) c.hand = true; else handOver(c);
  }
  // the customer holds out the slip (once they've stopped walking)
  function handOver(c) {
    c.hand = false;
    if (c.p.play('Interact', { fade: 0.2, once: true })) setTimeout(() => { if (c.state === 'serve' && !c.walking) c.p.play('Idle', { fade: 0.4 }); }, 1400);
  }
  const tip = () => pay.order + Math.floor((order.step - 1) / pay.orderEvery);
  async function pick(i) {
    if (!order || U.busy || eqPending) return;
    const o = order, c = o.coins[i]; if (!c) return;
    const res = o.sale ? { first: !o.picked } : Q.answer(o, c, { helped });   // (a sale of your goods doesn't move the ladder)
    o.picked = true;
    // (a badge won by this first pick is told on the slip with the tip)
    if (res.first) { const rec = recordAnswer(rider, c.good); if (rec && rec.badge) news.push(`You earned the ${rec.badge} badge!`); }
    if (!c.good) {
      missed = true;
      U.wrong(i, { why: c.why, pic: (o.picture || picture)(o.pic) });
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
      const problem = lockboxProblem(o.equation);
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
      if (goods) goods.sold(o);
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
    if (!unfilled) { filled++; buckle = countJob(rider, 'orders', 1).buckle; }
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
    moveUp();
    const next = atFront();
    if (next) U.waiting(`Here comes ${next.who.name}…`);
  }
  function draw() {
    if (!order || U.busy) return;
    helped = true;
    U.drawn((order.picture || picture)(order.pic));
  }

  // ── STARTING AND STOPPING ────────────────────────────────────────────────────────────────────────────────────
  J.start = () => {
    if (J.active || !place) return false;
    J.active = true; filled = 0; earned = 0; order = null; news.length = 0;
    P.enabled = false;
    onStart();
    U.purse(rider.gold);
    U.waiting('Opening up the counter…');
    if (P.onHorse) { P.dismount(); phase = 'dismount'; } else open();
    return true;
  };
  function open() {
    phase = 'open';
    P.teleport(clerkAt.x, clerkAt.z, rot);
    P.cam.enabled = false;
    if (hob) hob.event('storeStart');
    moveUp();
  }
  J.stop = () => {
    if (!J.active) return;
    J.active = false; phase = 'off'; order = null; eqPending = false;
    U.hide();
    for (const c of [...people]) if (c.state !== 'go') leave(c);
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
        else if (c.state === 'come' && c.to === queueAt) c.state = 'queue';
        else if (c.state === 'go') { removePerson(c); continue; }
        if (c.state === 'serve' && c.hand) handOver(c);
        if (c.state === 'serve' || c.state === 'queue' || c.state === 'front') turn(c, faceRider, dt);
      }
      placePerson(c, dt);
    }
    if (!J.active || phase !== 'open') return;
    // the "Draw it for me" button after a long think (a wrong pick shows the picture by itself)
    if (order && !missed && !helped && !U.busy && (thinkT += dt) > STORE.think) { U.offerDraw(true); thinkT = -1e9; }
    // the camera: from the street, the rider and the customer side by side
    const K = innerWidth < STORE.phoneWidth ? STORE.camPhone : STORE.cam, y0 = W.heightAt(clerkAt.x, clerkAt.z);
    const cp = at(STORE.clerk + K.out, K.side), lp = at(K.lookOut, K.lookSide);
    camPos.set(cp.x, y0 + K.up, cp.z); camLook.set(lp.x, W.heightAt(lp.x, lp.z) + K.lookUp, lp.z);
    camera.position.copy(camPos); camera.lookAt(camLook);
  };

  // Esc is "Done for now" while working the counter (unless a panel or the lock box over it wants it)
  const onKey = (e) => {
    if (e.key !== 'Escape' || !J.active || e.defaultPrevented || e.repeat) return;
    if (document.querySelector('.bms, .lbx')) return;
    e.preventDefault(); J.stop();
  };
  addEventListener('keydown', onKey, true);

  J.state = () => ({ active: J.active, phase, filled, earned, order: order ? { type: order.type, step: order.step, key: order.key, coins: order.coins.map((c) => ({ label: c.label, good: c.good })), equation: order.equation, sale: order.sale || null } : null,
    people: people.map((c) => ({ who: c.who.name, state: c.state, x: +c.x.toFixed(2), z: +c.z.toFixed(2) })), level: Q.level(), busy: U.busy });
  J.people = people;    // (read each frame by the wagons, which stop for customers: no copies made)
  J.trainer = Q;
  J.dispose = () => { removeEventListener('keydown', onKey, true); if (J.active) J.stop(); for (const c of [...people]) removePerson(c); U.dispose(); };
  return J;
}
