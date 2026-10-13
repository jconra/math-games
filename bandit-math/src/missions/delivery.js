// THE DELIVERY JOB: hauling supplies out to the camps in the valley (src/camps.js).
//
// A camp's foreman asks for an order (E by the foreman: no screen, the order goes on the job card under the compass:
// "The cow camp: beans for a fortnight · 6 hands, 3 a day each · crates of 12"). The kid rides to the general store,
// and pulling up out front, the store's order slip (src/ui/storeslip.js) comes up with the order on it and the kid works
// it out a step at a time, picking a coin each step (src/math/supplies.js): what a fortnight is in days (while the word
// is new), how many cans in all (hands x meals x days), how many crates (rounded UP: the leftover cans need a crate too),
// and on the higher steps what the order costs. A wrong coin shakes, one plain line says why, and the step's picture
// shows how it goes together; the kid picks again (no penalty). The crates are then loaded on the horse (they show on
// its back, in two panniers and one on top), the compass points at the camp, and the kid rides them out. Riding up to
// the camp, its people come out to the horse and carry the crates to the pile by the tent; the foreman pays (the gold
// goes up), the delivery counts toward the "deliveries made" belt buckle (save.js JOBS), and E by the foreman again takes
// the next order, straight away.
//
// The crates ride on the horse, so a delivery needs a saddle (the foreman says so, and where to buy one). If the horse
// isn't at the store when the order is made up, the crates wait until it comes (H whistles it over).
//
// FOR THE BANDITS (a later job): DL.carrying says what is on the horse; DL.rob() takes it (the crates fall away, the
// card says so, and the store makes the order up again for free: the kid rides back for it); DL.on(fn) hears every
// change: fn(event, info) with event 'order' | 'loaded' | 'delivered' | 'robbed' | 'cancel'.
//
//   const DL = makeDeliveryJob({ W, camps, P, camera, rider, hud, hob, refresh, onStart, onStop, quiet })
//     camps: makeCamps(...); onStart / onStop: the slip opening and closing (the game holds the keys and the round-up
//     meanwhile); quiet(): true while another job wants the job card (the herd, the farm, the store's counter)
//   DL.update(dt)       each frame, after the player
//   DL.prompt           the words for the door prompt while by a foreman ('Take an order from Dusty'), or null
//   DL.talk()           E by the foreman (main.js calls it when the prompt is DL's)
//   DL.active           true while the order slip is open at the store
//   DL.card             true while an order is under way (the round-up's travel card stands aside)
//   DL.marks()          [{ id, icon, x, z, label }] for the compass: the store, then the camp
//   DL.carrying         { camp, crates, goods } while crates are on the horse, else null
//   DL.rob()            -> what was taken ({ camp, crates, goods }) or null; DL.on(fn) -> a function that stops hearing
//   DL.order, DL.phase, DL.state() (for rigs), DL.trainer, DL.dispose()
import * as THREE from 'three';
import { makeSupplies, picture } from '../math/supplies.js';
import { makeStoreSlip } from '../ui/storeslip.js';
import { crateParts } from '../camps.js';
import { earn, recordAnswer, countJob, saveRider } from '../save.js';

export const DELIVERY = {
  talk: 3.6,            // metres from a foreman where E talks to him
  linger: 2,            // ... and after riding through that, he can still be talked to for this many seconds once the horse
  coast: 9,             //     has stopped, within this many metres more (a horse coasts 3 m from a trot, about 7 from a gallop)
  afterDrop: 5,         // seconds after a drop-off when, still in the saddle, E gets you down rather than taking the next
                        // order (on foot the next order is offered straight away)
  storeNear: 7,         // metres from the store's door where the order is made up (pulling up slowly)...
  storeSlow: 3.2,       // ...going slower than this (m/s), so riding past doesn't stop you
  storeAgain: 11,       // after "Done for now" the slip comes up again only once you've ridden this far off and back
  horseNear: 16,        // metres from the store's door the horse must be for the crates to go on it
  dropNear: 11,         // the horse with the crates within this of a camp's middle: unloaded
  pay: { base: 6, perStep: 2, clean: 3 },   // gold for a delivery: base + perStep x the order's step, + clean if every
                                            // step of the order was right first time
  unloadEach: 0.45,     // seconds between crates coming off the horse
  pannier: 0.78,        // the crates on the horse are this size of a camp's crates
  // the camera while the slip is up: a fixed view of the store front from the square, beside the horse (however the kid
  // rode in), held a moment after the crates go on. Metres in the store's own frame from a point between the horse and
  // the door: out toward the square, along the store front (toward the horse's side), up; then how high it looks
  cam: { at: 0.35, out: 7.5, side: 3.0, up: 3.2, lookUp: 1.2, hold: 2.5 },
  camPhone: { at: 0.35, out: 9.0, side: 2.0, up: 3.6, lookUp: -0.4, hold: 2.5 },   // (a phone: the slip is a sheet along the bottom)
};

export function makeDeliveryJob({ W, camps, P, camera, rider, hud, hob = null, refresh = () => {}, onStart = () => {}, onStop = () => {}, quiet = () => false }) {
  if (!rider.topics || typeof rider.topics !== 'object') rider.topics = {};
  if (!rider.topics.delivery || typeof rider.topics.delivery !== 'object') rider.topics.delivery = {};
  const S = makeSupplies(rider.topics.delivery);
  const store = W.places.store;
  const listeners = new Set();
  const emit = (ev, info) => { for (const fn of [...listeners]) { try { fn(ev, info); } catch (e) { console.error('delivery: a listener threw', e); } } };

  // phase: none | ordered (ride to the store) | working (the slip is open) | waitHorse (made up, the horse isn't here) |
  //        carrying (crates on the horse) | unloading | robbed (ride back to the store to load again)
  let phase = 'none', order = null, camp = null, part = 0, missed = false, helped = false, partMissed = false, clean = true;
  let lastNear = null, nearT = 0;   // (the foreman last in talking range, and how long he stays so)
  let lastCamp = null, away = true, unloadT = 0, left = 0, cardKey = '', shownCard = false;
  const DL = { get phase() { return phase; }, get order() { return order; }, active: false, prompt: null, trainer: S };
  Object.defineProperty(DL, 'card', { get: () => phase !== 'none' });
  Object.defineProperty(DL, 'carrying', { get: () => ((phase === 'carrying' || phase === 'unloading') && order ? { camp: camp.id, crates: order.crates, goods: order.load.goods } : null) });
  DL.on = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

  // ── THE SLIP AT THE STORE ──────────────────────────────────────────────────────────────────────────────────────
  const U = makeStoreSlip(document.body, { onPick: (i) => pick(i), onDone: () => stopWork(), onDraw: () => draw() });
  const foot = () => U.el.querySelector('.bmo-filled');
  function showPart() {
    const p = order.parts[part];
    partMissed = false; helped = false;
    U.purse(rider.gold);
    U.show({ who: { name: camp.foreman.name }, story: order.story, ask: p.ask, coins: p.coins, equation: null }, { filled: 0 });
    const f = foot(); if (f) f.textContent = order.parts.length > 1 ? `Step ${part + 1} of ${order.parts.length}` : 'Making up the order';
  }
  function startWork() {
    if (DL.active) return;
    DL.active = true; phase = 'working';
    onStart();
    slipCam(true);
    part = 0; showPart();
    if (hob) hob.event('deliveryWork');
  }
  // "Done for now" (or Esc): the slip goes, the order stays on the card
  function stopWork() {
    if (!DL.active) return;
    DL.active = false; U.hide();
    if (phase === 'working') phase = 'ordered';
    away = false;
    slipCam(false);
    onStop();
  }
  async function pick(i) {
    if (!DL.active || !order || U.busy) return;
    const p = order.parts[part], c = p.coins[i]; if (!c) return;
    const res = S.answer(order, part, c, { helped });
    if (res.first) recordAnswer(rider, c.good);
    if (!c.good) {
      partMissed = true; clean = false;
      U.wrong(i, { why: c.why, pic: picture(p.pic) });
      if (hob) hob.event('deliveryMiss', { slip: c.slip });
      saveRider(rider);
      return;
    }
    if (hob) hob.event('deliveryRight');
    saveRider(rider);
    const lastPart = part >= order.parts.length - 1;
    await U.right(i, { line: lastPart ? `${p.rightWhy}. Order made up: ${order.crates} ${order.load.box[1]} of ${order.load.goods}!` : p.rightWhy, gold: 0 });
    if (!DL.active) return;
    await U.leave();
    if (!DL.active) return;
    if (!lastPart) { part++; showPart(); return; }
    // the order is made up: the slip goes, the crates go on the horse (when it's here)
    DL.active = false; U.hide(); onStop();
    phase = 'waitHorse';
    if (tryLoad()) camHold = (innerWidth < 760 ? DELIVERY.camPhone : DELIVERY.cam).hold;   // (the crates going on, seen)
    else slipCam(false);
  }
  function draw() { if (!order || U.busy || !DL.active) return; helped = true; U.drawn(picture(order.parts[part].pic)); }

  // ── THE CRATES ON THE HORSE ────────────────────────────────────────────────────────────────────────────────────
  // a holder on the horse's back bone (as the saddle hangs: actors/animals.js saddleOn), with up to three crates behind
  // the saddle, clear of the rider's legs: one hung each side over the hindquarters (the panniers) and one on top
  const CR = crateParts();
  const load = new THREE.Group(); load.name = 'delivery-load';
  const SLOTS = [   // in the saddle's frame: x across, y up from the saddle's seat on the back, z forward (the horn)
    { at: [0.3, -0.2, -0.6], turn: Math.PI / 2, tilt: -0.1 }, { at: [-0.3, -0.2, -0.6], turn: Math.PI / 2, tilt: 0.1 },
    { at: [0, 0.1, -0.62], turn: 0, tilt: 0 },
  ];
  const crates = SLOTS.map((sl) => {
    const m = new THREE.Mesh(CR.geometry, CR.material);
    m.position.set(sl.at[0], sl.at[1] - CR.size[1] * DELIVERY.pannier / 2, sl.at[2]);
    m.rotation.set(0, sl.turn, sl.tilt);
    m.scale.setScalar(DELIVERY.pannier); m.castShadow = true; m.visible = false;
    load.add(m); return m;
  });
  let loadOn = null;   // the horse the load hangs on
  const _m = new THREE.Matrix4();
  function hangLoad() {
    const a = P.horse; if (!a || !a.info || !a.seatRest) return false;
    if (loadOn === a && load.parent) return true;
    const s = a.info.seat.at;
    _m.makeTranslation(s[0], s[1], s[2]).premultiply(a.seatRest.clone().invert());
    _m.decompose(load.position, load.quaternion, load.scale);
    a.bones[a.info.seat.bone].add(load);
    loadOn = a;
    return true;
  }
  function showCrates(n) { crates.forEach((m, i) => { m.visible = i < Math.min(n, crates.length); }); }
  // how many crates show for an order of n (one for a small order, two for a middling one, all three past ten)
  const visibleFor = (n) => Math.max(1, Math.min(crates.length, Math.ceil(n / 5)));
  const horseAt = () => (P.horse ? P.horse.root.position : null);

  function tryLoad() {
    const h = horseAt();
    if (!h || !store || Math.hypot(h.x - store.door.x, h.z - store.door.z) > DELIVERY.horseNear || !hangLoad()) return false;
    left = order.crates;
    showCrates(visibleFor(left));
    phase = 'carrying';
    hud.toast(`${order.crates} ${order.load.box[1]} of ${order.load.goods} loaded on your horse`, 'good');
    if (hob) hob.event('deliveryLoaded', { camp: camp.short });
    emit('loaded', { camp: camp.id, crates: order.crates, goods: order.load.goods });
    return true;
  }

  // ── THE CAMERA WHILE THE SLIP IS UP ───────────────────────────────────────────────────────────────────────────
  let camOn = false, camHold = 0;
  const camAt = new THREE.Vector3(), camLook = new THREE.Vector3();
  function slipCam(on) {
    if (on === camOn || !store || !P.cam) return;
    camOn = on; camHold = 0;
    P.cam.enabled = !on;
    if (on) placeCam(); else P.cam.snap();
  }
  function placeCam() {
    const K = innerWidth < 760 ? DELIVERY.camPhone : DELIVERY.cam;
    const rot = store.rot || 0, ox = Math.sin(rot), oz = Math.cos(rot), sx = -Math.cos(rot), sz = Math.sin(rot);
    const h = horseAt() && P.onHorse ? horseAt() : P.position, d = store.door;
    // the horse's side of the door along the store front (the camera stands off that way, so the horse is in view)
    const along = (h.x - d.x) * sx + (h.z - d.z) * sz, sgn = along < -0.3 ? -1 : 1;
    const lx = d.x + (h.x - d.x) * (1 - K.at), lz = d.z + (h.z - d.z) * (1 - K.at);
    camLook.set(lx, W.heightAt(lx, lz) + K.lookUp, lz);
    const cx = lx + ox * K.out + sx * sgn * K.side, cz = lz + oz * K.out + sz * sgn * K.side;
    camAt.set(cx, W.heightAt(cx, cz) + K.up, cz);
    camera.position.copy(camAt); camera.lookAt(camLook);
  }

  // ── TALKING TO A FOREMAN ───────────────────────────────────────────────────────────────────────────────────────
  let near = null;   // the camp whose foreman is close
  DL.talk = () => {
    if (!near) return false;
    const c = near;
    if (phase !== 'none') {
      // already on an order: the foreman says what's up
      if (camp === c) hud.toast(phase === 'carrying' ? `${c.foreman.name}: Bring 'em right over here!` : `${c.foreman.name}: The general store will make up our order. We'll be here.`, 'good');
      else hud.toast(`${c.foreman.name}: Finish that order for ${camp.short} first, partner.`, 'warn');
      return true;
    }
    if (!P.canRide) { hud.toast(`${c.foreman.name}: Need a saddled horse to haul crates. The stable in town sells saddles.`, 'warn'); if (hob) hob.event('deliveryNoSaddle'); return true; }
    newOrder(c);
    return true;
  };
  function newOrder(c) {
    camp = c; lastCamp = c;
    order = S.next({ camp: { id: c.id, short: c.short }, who: c.foreman.name });
    part = 0; clean = true; away = true;
    phase = 'ordered';
    if (c.foreman.person) { c.foreman.person.p.play('Interact', { fade: 0.2, once: true }); setTimeout(() => { const h = c.foreman.person; if (h && !h.busy) h.p.play('Idle', { fade: 0.4 }); }, 1500); }
    hud.toast(`${c.foreman.name}: Could you haul us some ${order.load.goods}? Work the order out at the general store.`, 'good');
    if (hob) hob.event('deliveryOrder', { camp: c.short });
    emit('order', { camp: c.id, order });
    cardKey = '';
  }

  // ── THE ROBBERS' HOOK ──────────────────────────────────────────────────────────────────────────────────────────
  DL.rob = () => {
    if (phase !== 'carrying' || !order) return null;
    const taken = { camp: camp.id, crates: order.crates, goods: order.load.goods };
    showCrates(0);
    phase = 'robbed'; away = false;   // (the store loads it again once the kid rides up to it)
    hud.toast('The gang made off with the crates! The store will make up the order again.', 'warn');
    if (hob) hob.event('deliveryRobbed');
    emit('robbed', taken);
    cardKey = '';
    return taken;
  };

  // ── UNLOADING AT THE CAMP ──────────────────────────────────────────────────────────────────────────────────────
  function startUnload() {
    phase = 'unloading'; unloadT = 0.6;
    const h = horseAt(), spot = h ? { x: h.x + (camp.x - h.x) * 0.25, z: h.z + (camp.z - h.z) * 0.25 } : camp.drop;
    // two of the camp's people come out to the horse, take a crate each and carry it to the pile
    for (let k = 1; k <= 2; k++) {
      camps.errand(camp, k, [
        { to: { x: spot.x + (k - 1.5) * 1.2, z: spot.z }, clip: 'Interact', wait: 1.6, face: Math.atan2(h ? h.x - spot.x : 0, h ? h.z - spot.z : 1) },
        { to: camp.unload, wait: 0.6 },
      ]);
    }
    if (hob) hob.event('deliveryArrive');
  }
  function finishDelivery() {
    const step = order.step, gold = DELIVERY.pay.base + DELIVERY.pay.perStep * step + (clean ? DELIVERY.pay.clean : 0);
    const e = earn(rider, gold);
    const rec = countJob(rider, 'deliveries', 1);
    S.state.delivered = (S.state.delivered || 0) + 1;
    saveRider(rider);
    refresh();
    camp.stack(Math.min(camp.shown + visibleFor(order.crates) + 1, 6));
    hud.toast(`${camp.foreman.name}: Much obliged! +${gold} gold${clean ? ' · worked out right first time' : ''}`, 'gold');
    if (e && e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 1600);
    if (rec.buckle) hud.buckle(rec.buckle, { delay: 900 });
    if (hob) hob.event('deliveryDone', { camp: camp.short, first: S.state.delivered === 1 });
    emit('delivered', { camp: camp.id, crates: order.crates, gold });
    droppedAt = performance.now();
    phase = 'none'; order = null; cardKey = ''; showCrates(0);
    if (shownCard) hud.rule(null);   // (only this job's own card: near the wagon the gang's card stays up)
    shownCard = false;
  }

  // ── THE JOB CARD AND THE COMPASS ───────────────────────────────────────────────────────────────────────────────
  const dist = (a, b) => Math.round(Math.hypot(a.x - b.x, a.z - b.z));
  const way = (from, to) => { const a = Math.atan2(to.x - from.x, to.z - from.z); const k = Math.round(((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (Math.PI / 4)) % 8; return ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'][k]; };
  function card() {
    if (phase === 'none' || !order) return null;
    const at = P.position, sub = order.card.sub;
    if (phase === 'ordered' || phase === 'working') {
      const g = order.load.goods, time = order.period.word === 'days' ? `${order.days} days` : `a ${order.period.word}`;
      return { main: `${g[0].toUpperCase() + g.slice(1)} for ${camp.short}, ${time}`, sub: `${sub} · to the store: ${roundTo(dist(at, store.door))} m` };
    }
    if (phase === 'waitHorse') return { main: `${order.crates} ${order.load.box[1]} of ${order.load.goods} waiting at the store`, sub: 'Bring your horse round to load them: H whistles her over' };
    if (phase === 'robbed') return { main: 'The gang took the crates!', sub: `Ride back to the general store (${roundTo(dist(at, store.door))} m): they'll make up the order again` };
    return { main: `${order.crates} ${order.load.box[1]} of ${order.load.goods} for ${camp.short}`, sub: `Ride them out: ${roundTo(dist(at, camp))} m ${way(at, camp)}` };
  }
  const roundTo = (d) => (d > 100 ? Math.round(d / 10) * 10 : d);
  function showCard() {
    const q = quiet();
    if (q || phase === 'none') { if (shownCard && !q) hud.rule(null); shownCard = false; cardKey = ''; return; }
    const c = card(); if (!c) return;
    const key = c.main + '|' + c.sub;
    if (key === cardKey && shownCard) return;
    cardKey = key; shownCard = true;
    hud.rule({ kind: 'travel', main: c.main, sub: c.sub });
  }
  DL.marks = () => {
    const out = [];
    if (phase === 'ordered' || phase === 'working' || phase === 'robbed' || phase === 'waitHorse') out.push({ id: 'store', icon: 'job', x: store.door.x, z: store.door.z, label: 'The general store: make up the order' });
    else if (phase === 'carrying' || phase === 'unloading') out.push({ id: 'camp', icon: 'job', x: camp.x, z: camp.z, label: `${camp.name}: the delivery` });
    else if (P.canRide) {   // no order: the nearest camp, so a rider can find the work
      let best = null, bd = Infinity; for (const c of camps.list) { const d = Math.hypot(c.x - P.position.x, c.z - P.position.z); if (d < bd) { bd = d; best = c; } }
      if (best && bd > 30) out.push({ id: 'camps', icon: 'job', x: best.x, z: best.z, label: `${best.name}: supplies to haul` });
    }
    return out;
  };

  // ── EACH FRAME ─────────────────────────────────────────────────────────────────────────────────────────────────
  let cardT = 0, droppedAt = -1e9;
  DL.update = (dt) => {
    const at = P.position;
    // a foreman close by: the prompt (on foot or riding)
    near = null; DL.prompt = null;
    if (!DL.active && P.enabled && (P.mode === 'foot' || P.mode === 'horse')) {
      for (const c of camps.list) {
        if (Math.hypot(at.x - c.foreman.x, at.z - c.foreman.z) < DELIVERY.talk + (P.onHorse ? 1.5 : 0)) { near = c; break; }
      }
      // a horse pulled up at a gallop coasts on several metres: the foreman stays in talking range a moment longer
      if (near) { lastNear = near; nearT = DELIVERY.linger; }
      else if (lastNear && Math.hypot(at.x - lastNear.foreman.x, at.z - lastNear.foreman.z) < DELIVERY.talk + DELIVERY.coast) {
        if (P.onHorse && Math.abs(P.speed || 0) > 1) nearT = DELIVERY.linger;   // (still coasting)
        if ((nearT -= dt) > 0) near = lastNear;
      } else lastNear = null;
      // (just after a drop-off, still mounted, the kid most likely wants to get down: E is left to do that)
      if (near && phase === 'none' && P.onHorse && performance.now() - droppedAt < DELIVERY.afterDrop * 1000) near = null;
      if (near) DL.prompt = phase === 'none' ? `Take an order from ${near.foreman.name}` : `Talk to ${near.foreman.name}`;
    }
    // the store: pulling up out front makes up the order (or loads it again after a robbery)
    if (store && (phase === 'ordered' || phase === 'robbed') && !DL.active && P.enabled) {
      const d = Math.hypot(at.x - store.door.x, at.z - store.door.z);
      if (d > DELIVERY.storeAgain) away = true;
      if (away && d < DELIVERY.storeNear && Math.abs(P.speed || 0) < DELIVERY.storeSlow) {
        if (phase === 'ordered') startWork();
        else { phase = 'waitHorse'; tryLoad(); }
      }
    }
    if (phase === 'waitHorse') tryLoad();
    // keep the load on the horse (a new horse bought or swapped mid-delivery carries it on)
    if ((phase === 'carrying' || phase === 'unloading') && P.horse && loadOn !== P.horse) hangLoad();
    // arriving at the camp with the crates
    if (phase === 'carrying') {
      const h = horseAt();
      if (h && Math.hypot(h.x - camp.x, h.z - camp.z) < DELIVERY.dropNear) startUnload();
    }
    if (phase === 'unloading') {
      if ((unloadT -= dt) <= 0) {
        left = Math.max(0, left - Math.max(1, Math.ceil(order.crates / 4)));
        showCrates(left > 0 ? visibleFor(left) : 0);
        camp.stack(Math.min(camp.shown + 1, 6));
        unloadT = DELIVERY.unloadEach;
        if (left <= 0) finishDelivery();
      }
    }
    if ((cardT -= dt) <= 0 || !shownCard) { cardT = 0.5; showCard(); }
    if (camOn) { if (DL.active || (camHold -= dt) > 0) placeCam(); else slipCam(false); }
  };

  DL.state = () => ({ phase, active: DL.active, camp: camp ? camp.id : null, lastCamp: lastCamp ? lastCamp.id : null, part, prompt: DL.prompt,
    order: order ? { story: order.story, step: order.step, crates: order.crates, total: order.total, per: order.per, parts: order.parts.map((p) => ({ key: p.key, ask: p.ask, coins: p.coins.map((c) => ({ label: c.label, good: c.good, slip: c.slip })) })) } : null,
    level: S.level(), delivered: S.state.delivered, cratesOnHorse: crates.filter((m) => m.visible).length, busy: U.busy });
  // Esc is "Done for now" while the slip is open (unless a panel over it wants it)
  const onKey = (e) => {
    if (e.key !== 'Escape' || !DL.active || e.defaultPrevented || e.repeat) return;
    if (document.querySelector('.bms, .lbx')) return;
    e.preventDefault(); stopWork();
  };
  addEventListener('keydown', onKey, true);
  // (for rigs: an order from a camp without walking up to its foreman)
  DL.orderFrom = (id) => { const c = camps.byId(id); if (!c || phase !== 'none') return false; newOrder(c); return true; };
  DL.dispose = () => {
    if (DL.active) stopWork();
    slipCam(false);
    removeEventListener('keydown', onKey, true);
    listeners.clear();
    load.removeFromParent();
    U.dispose();
    if (shownCard) hud.rule(null);
  };
  return DL;
}
