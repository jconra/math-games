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
// ON THE STRANDS (src/math/skill.js): each customer's order is as hard as the rider's Word problems level says: the
// store asks stepFor on the map store (or storeK, the youngest riders' picture stories, which chooseMap picks while
// the level is low) and the order is made at that step. Its first pick (or the worked area, below) is recorded through
// save.js recordAnswer: Word problems at the point asked, plus what else the order counts in (order.credit: groups in
// Multiplication at half weight, money in Money, discounts in Percent...), timed as a sit-down answer
// (src/ui/answertimer.js; a fast right one counts double). A sale of the rider's goods counts in Word problems (eggs
// and milk, the map sales) or Fractions (wool, the map wool), its form chosen the same way.
// A sum too big for the head (a big order, 16 × 24 sacks, 112 cans in crates of 5) opens THE WORKED AREA
// (src/ui/longwork.js) by itself a moment after the slip comes up, unless the rider's Long work level is well past it
// (then "Work it out" on the slip opens it): "What do we work out?", then the sum worked a step at a time, then (for a
// division) the word answer. Each tap counts lightly in that fact's own strand, the whole sum in Long work, and the
// order's answer in Word problems as usual; then the right coin glows and the order is filled as if it were picked.
// A rider who can't read yet (skill.js readAloud) hears each order read out (the browser's voice), with "Read it to
// me" on the slip to hear it again; the youngest riders' picture stories show the things to count from the start.
// THE COUNTER'S OTHER QUESTIONS (src/math/counter.js): about 2 customers in 5, once any fits the rider, ask something
// else the store is the place for: money (counting coins, change, dollars and cents, tax and tips), the time by the
// store's grandfather clock and how long things take, decimals, percent, ratios. Each is its own strand at its own
// level (counterChoice / stepFor), recorded the same way (that strand at the point asked, timed), with its own pictures
// (src/ui/counterpics.js): the lead (the clock to read, the coins to count) above the coins, the help after a miss.
// While a strand is still finding its level the slip's corner says so, quietly.
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
import { makeWordProblems, makeOrder, lockboxProblem, FOLK } from '../math/wordproblems.js';
import { picture } from '../ui/storepics.js';
import { makeStoreSlip, speakLine } from '../ui/storeslip.js';
import { openLongWork } from '../ui/longwork.js';
import { workMul, workDiv, LONG } from '../math/longwork.js';
import { homestead } from '../math/goods.js';
import { counterOrder, counterChoice } from '../math/counter.js';
import { counterPicture } from '../ui/counterpics.js';
import { stepFor, stepAt, pctAt, chooseMap, fits, levelOf, readAloud, record, isPlaced } from '../math/skill.js';
import { answerTimer } from '../ui/answertimer.js';
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
  longOpen: 1.1,       // seconds after the slip comes up when the worked area opens by itself (the story read first)
  longMost: 4,         // a non-bulk order's numbers may need a long sum up to this many points past the rider's Long work
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

  const U = makeStoreSlip(document.body, { onPick: (i) => pick(i), onDone: () => J.stop(), onDraw: () => draw(), onWork: () => openLong() });
  const J = { active: false };
  let phase = 'off';         // off | dismount | open
  let order = null, missed = false, helped = false, thinkT = 0, filled = 0, earned = 0, eqPending = false;
  let lastMap = null, lastCounter = null, timer = null, longPanel = null, longT = null, forced = null;
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

  // the point an order really sits at: the rider's pick, but never under its step's own point (a level a few points
  // under a maker's first step still gets that first step, which is harder than the level)
  const realAt = (map, q) => Math.max(q.at, pctAt(map, q.step));
  // ── AN ORDER AT THE COUNTER ──────────────────────────────────────────────────────────────────────────────────────
  // one of the counter's other questions (money, time, decimals, percent, ratios) at the rider's level on its strand
  function counterDeal(map, who, step = null) {
    const q = stepFor(rider, map);
    const o = counterOrder(map, { step: step || q.step, frac: step ? 0 : q.frac, who });
    o.map = map; o.at = step ? pctAt(map, step) : realAt(map, q);
    o.picture = counterPicture;
    o.payStep = Math.max(1, stepAt('store', o.at).step);   // (the tip goes by the store's step at that point)
    return o;
  }
  // the next order, as hard as the strands say (see ON THE STRANDS above)
  function deal(who) {
    if (forced) {   // (rigs: J.dev.next({ type, sum, longStep, map, step }), or { counter: 'time', step: 2 })
      const f = forced; forced = null;
      if (f.counter) return counterDeal(f.counter, who, f.step || null);
      const map = f.map || 'store', q = stepFor(rider, map);
      const ls = f.type === 'bulk' ? stepFor(rider, 'long') : null;
      const o = makeOrder(f.type, { who, step: f.step || q.step, ladder: map === 'storeK' ? 'K' : 'main', longStep: f.longStep || (ls && ls.step), longOp: f.longOp || null, sum: f.sum || null });
      Object.assign(o, { fixed: true, map, at: f.step ? pctAt(map, f.step) : realAt(map, q), longAt: ls ? ls.at : null });
      return o;
    }
    // now and then a customer buys the rider's own goods: eggs and milk on the map sales (Word problems), wool on the
    // map wool (Fractions); a kind the rider isn't up to yet isn't bought
    if (goods) {
      const carried = homestead(rider).goods, plan = { step: 1, sales: null, wool: null };
      if ((carried.eggs || carried.milk) && fits(rider, 'sales')) { const q = stepFor(rider, 'sales'); Object.assign(plan, { sales: q.id, salesAt: realAt('sales', q) }); }
      if (carried.wool && fits(rider, 'wool')) { const q = stepFor(rider, 'wool'); Object.assign(plan, { wool: q.id, woolAt: realAt('wool', q) }); }
      plan.step = stepFor(rider, 'store').step;   // (the tip goes by the store's step)
      const sale = (plan.sales || plan.wool) ? goods.saleOrder({ step: plan, who }) : null;
      if (sale) return sale;
    }
    // now and then a question about money, the time, decimals, percent or ratios instead of a word problem
    const cmap = counterChoice(rider, { last: lastCounter });
    if (cmap) { lastCounter = cmap; return counterDeal(cmap, who); }
    const map = chooseMap(rider, ['storeK', 'store'], { last: lastMap }) || 'store';
    lastMap = map;
    const q = stepFor(rider, map);
    let longQ = null;
    const o = Q.next({ who, step: q.step, ladder: map === 'storeK' ? 'K' : 'main',
      longStep: () => (longQ = longQ || stepFor(rider, 'long')).step,   // (asked only if a big order is made)
      longMost: levelOf(rider, 'long') + STORE.longMost });
    o.map = map; o.at = realAt(map, q); o.longAt = longQ && o.type === 'bulk' ? longQ.at : null;
    return o;
  }
  function serve(c) {
    c.state = 'serve';
    order = deal(c.who);
    missed = false; helped = false; thinkT = 0; eqPending = false;
    U.purse(rider.gold);   // (in step with the gold, the lock box's pay included)
    const young = readAloud(rider);
    const own = ownOf(order);
    U.show(order, { filled, pic: order.picFirst ? (order.picture || picture)(order.pic) : null, read: young,
      lead: order.lead ? counterPicture(order.lead) : null, note: own && own.at != null && !isPlaced(rider, own.strand) ? 'finding your level' : '' });
    if (young && order.read) setTimeout(() => { if (order && order.read && J.active && !U.busy) speakLine(order.read); }, 500);
    if (timer) timer.cancel();
    timer = answerTimer();
    // a sum too big for the head: the worked area opens by itself, unless the rider's Long work is well past it
    clearTimeout(longT);
    if (order.long && levelOf(rider, 'long') < order.long.point + LONG.COMFORT) { const o = order; longT = setTimeout(() => { if (order === o) openLong(); }, STORE.longOpen * 1000); }
    if (order.sale) speak('whatchagot', c);   // (come to buy the rider's own goods)
    if (c.walking) c.hand = true; else handOver(c);
  }
  // the strand an order is about, at the point it was asked: Word problems, or the sale's (Word problems or
  // Fractions), or the counter question's own (money, time, dec, pct, ratio)
  function ownOf(o) {
    if (o.sale) return o.sale.at != null ? { strand: o.sale.map === 'wool' ? 'frac' : 'words', at: o.sale.at } : null;
    return { strand: o.counter ? o.strand : 'words', at: o.at != null ? o.at : null };
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
    const rec = recordAnswer(rider, right, { strands: strandsOf(o, { worked }), sitDown: true, size: o.size || 1, ms: tm.ms, hidden: tm.hidden, idle: tm.idle });
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
  // story's numbers: at its own point), the order's answer in Word problems (what to work out, and the word answer,
  // both right first time), and the order is filled as though its coin was picked. Closing it ("Back to the slip")
  // counts nothing: the coins are still there.
  function openLong() {
    const o = order;
    if (!o || !o.long || longPanel || U.busy || !J.active) return;
    const already = !!o.recorded;   // (opened after a coin was picked: it helps, but the order's answer is already counted)
    clearTimeout(longT);
    const L = o.long, work = L.op === 'mul' ? workMul(L.a, L.b, L.lead ? { lead: L.lead } : {}) : workDiv(L.n, L.d);
    let firstRight = true;
    longPanel = openLongWork(document.body, {
      work, setup: L.setup, final: L.final, ask: o.ask, speak: readAloud(rider) ? speakLine : null,
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
        // the story's part: what to work out and the word answer; a slip in the digits is what the paper is for.)
        if (!firstRight) missed = true;
        setTimeout(() => { longPanel = null; if (order === o && J.active) pick(o.coins.findIndex((c) => c.good), { worked: true }); }, 1700);
      },
      onClose: () => { longPanel = null; saveRider(rider); },
    });
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
    clearTimeout(longT);
    if (longPanel) { longPanel.close(); longPanel = null; }
    if (timer) { timer.cancel(); timer = null; }
    try { if (globalThis.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* (no voice) */ }
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
    if (order && !missed && !helped && !U.busy && !longPanel && (thinkT += dt) > STORE.think) { U.offerDraw(true); thinkT = -1e9; }
    // the camera: from the street, the rider and the customer side by side
    const K = innerWidth < STORE.phoneWidth ? STORE.camPhone : STORE.cam, y0 = W.heightAt(clerkAt.x, clerkAt.z);
    const cp = at(STORE.clerk + K.out, K.side), lp = at(K.lookOut, K.lookSide);
    camPos.set(cp.x, y0 + K.up, cp.z); camLook.set(lp.x, W.heightAt(lp.x, lp.z) + K.lookUp, lp.z);
    camera.position.copy(camPos); camera.lookAt(camLook);
  };

  // Esc is "Done for now" while working the counter (unless a panel or the lock box over it wants it)
  const onKey = (e) => {
    if (e.key !== 'Escape' || !J.active || e.defaultPrevented || e.repeat) return;
    if (document.querySelector('.bms, .lbx, .bml')) return;   // (a panel, or the worked area: its own Esc goes back to the slip)
    e.preventDefault(); J.stop();
  };
  addEventListener('keydown', onKey, true);

  J.state = () => ({ active: J.active, phase, filled, earned, order: order ? { type: order.type, step: order.step, map: order.map || null, at: order.at ?? null, key: order.key, story: order.story, ask: order.ask,
    counter: order.counter || null, lead: order.lead ? order.lead.kind : null, pic: order.pic ? order.pic.kind : null,
    coins: order.coins.map((c) => ({ label: c.label, good: c.good })), equation: order.equation, sale: order.sale || null, credit: order.credit || [], long: order.long ? { op: order.long.op, point: order.long.point, a: order.long.a, b: order.long.b, n: order.long.n, d: order.long.d } : null } : null,
    longOpen: !!longPanel, long: longPanel ? longPanel.state() : null,
    people: people.map((c) => ({ who: c.who.name, state: c.state, x: +c.x.toFixed(2), z: +c.z.toFixed(2) })), level: Q.level(), busy: U.busy });
  J.people = people;    // (read each frame by the wagons, which stop for customers: no copies made)
  J.trainer = Q;
  // (rigs: the next customer brings this order: { type, map, step, sum: { op: 'div', n: 112, d: 5 }, longStep, longOp },
  // or a counter question: { counter: 'time', step: 2 })
  J.dev = { next: (spec) => { forced = spec || null; }, openLong: () => openLong() };
  J.dispose = () => { removeEventListener('keydown', onKey, true); if (J.active) J.stop(); for (const c of [...people]) removePerson(c); U.dispose(); };
  return J;
}
