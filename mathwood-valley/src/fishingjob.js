// THE FISHING JOB: a wooden dock on the town side of the lake south of the saloon, where the dirt path from the town
// ends, and an old fisherman at the foot of it. Walking up to him and pressing E (or tapping the prompt) opens the
// fishing lab's builder right there (labs/fishing/builder.js, through the build-site frame: src/buildsite.js): the
// camera glides from behind the rider out to the end of the dock, the rider fades away from the bank as their double
// fades in at the end of the dock with the rod (same look, same hat), and the lab's cast / bite / reel / question loop
// is played on the game's own lake, the valley drawn all round and its sounds going on. Every question is FRACTIONS,
// at the rider's level on the dock's ladder (src/levels/place/fishing.js, kept by src/levels/model.js): Pam's pie pan
// and its slices for the youngest, a fraction of your fish for a friend, what's left of a pie, then the keep-or-throw
// calls, line-ups, weights added, equal fractions, unlike bottom numbers, mixed numbers, taking away, multiplying and
// dividing fractions (labs/fishing/pies.js questionAt), read out to a rider who can't read yet. Each answer (and each
// "Try it") is one answer at the level its question was made at.
// "Done for now", Esc or walking away puts the rod down: the double fades out at the end of the dock as the rider
// fades back in on the bank, and the camera glides back.
//
// Kept per rider (rider.fishing): the fish kept, in the saddlebags (creel: up to CREEL.most; a fish kept with them
// full swaps out the smallest, the way anglers cull), the biggest fish, the fish book (every kind in three sizes), the
// fish landed. The kept fish hang on the dock's stringer while nobody is fishing too, until they're sold at the
// general store's counter (src/math/fishsale.js: a word problem like the eggs and the wool). The first fish landed
// checks off "The fishing hole" (src/completion.js), every fish landed counts toward the belt buckle (save.js JOBS
// 'fish').
//
//   const J = makeFishingJob({ W, folk, rider, sites, player, audio, on, speak, refresh, hud })
//     sites: the game's build sites (makeBuildSites); player(): P; audio: the game's sound (its context lent to the
//     lab's sounds); on: the job switch (save.js jobOn 'fishing'): off, the fisherman has no prompt (the dock stays);
//     speak(text): a line read out (main.js sayLine) for a rider who can't read yet; refresh(): the HUD's purse and the
//     checklist; hud: for the buckle's note; renderer, camera: to ready the fishing's shaders ahead (compileAsync,
//     in the background) so opening the dock doesn't stall a frame building them
//   J.update(dt)        each frame while riding (and, the first time the rod is out, the first card's view drawn ahead)
//   J.site, J.keeper (his person), J.builder (the open builder, or null: its .handle is the lab's FI handle)
//   J.where()           { x, z } of the fisherman (the jobs board, the trail)
//   J.workSum()         the question card's sum for the tools' Work it out, or null
//   J.creel()           the fish in the saddlebags;  J.fishLine() '3 fish' (the HUD) or ''
//   J.saleOrder({ who, grade })   a fish sale for the store's counter now and then (null: not this customer, or no fish)
//   J.sold(order)       a sale's right coin: those fish out of the saddlebags
//   J.state(), J.dispose()
import * as THREE from 'three';
import { makePerson } from './actors/folk.js';
import { saveRider, recordAnswer, countJob } from './save.js';
import { flagAsker } from './ui/flag.js';
import { stepFor, pctAt, readAloud } from './math/skill.js';
import { levelFor, pctOf } from './levels/model.js';
import { recordFact } from './math/facts.js';
import { answerTimer } from './ui/answertimer.js';
import { markFound } from './completion.js';
import { mergeStatic } from './buildsite.js';
import { mountFishing, stringerAt, stringerYaw } from '../labs/fishing/builder.js';
import { makeDock, makeRipples } from '../labs/fishing/scene.js';
import { makeFish } from '../labs/fishing/fish.js';
import { readRecord, readBook, KINDS } from '../labs/fishing/questions.js';
import { questionAt, lessonAt } from '../labs/fishing/pies.js';
import { value, feet } from '../labs/fishing/frac.js';
import { makeFishSale, formsBelow, SALE_FORMS } from './math/fishsale.js';
import { fishingOf, keepFish, sayable, saleMap, CREEL } from './fishrecords.js';
import { fishSum } from './math/jobsums.js';

export const DOCK = {
  x: -4.4, foot: -95.3,      // the dock's shore end (world, metres): where the town's dirt path meets the water
  len: 12,                   // it runs this far straight out (south, +Z) over the lake
  deck: 0.5,                 // its planks this high over the water (the bank here is low and flat)
  keeper: { x: -6.6, z: -96.5 },   // where the old fisherman stands: on the bank by the foot of the dock, west of it
  look: { outfit: 'worker_m', palette: 'sage', skin: 4, hair: 10, hat: true },   // (weathered, grey-haired)
  reach: 3.4,                // m from him where E opens the fishing
  fade: 1.1,                 // s the rider fades out on the bank and the double in at the end of the dock (and back)
  saveAfter: 1.5,            // s after a fish is landed before the rider is saved (and always as the rod goes down)
  water: new THREE.Color('#2f6f78'),   // the lake's colour, the fish under its surface tinted toward it
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function makeFishingJob({ W, folk, rider, sites, player = () => null, audio = null, on = true, speak = null, refresh = () => {}, hud = null, renderer = null, camera = null }) {
  const J = { builder: null, on };
  const endZ = DOCK.foot + DOCK.len;
  const F = () => fishingOf(rider);
  F();

  // ── the site: its middle at the end of the dock, on the water ────────────────────────────────────────────────
  let keeper = null;
  const site = J.site = sites.add({
    id: 'fishing', x: DOCK.x, z: endZ, prompt: 'Fish off the dock', reach: DOCK.reach,
    meet: () => { if (!keeper || J.builder || !J.on || fadeOut) return null; const p = keeper.root.position; return { x: p.x, z: p.z }; },
    css: ['labs/fishing/fishing.css?v=10'],
    mount, closed,
  });
  const { group, origin } = site;
  const surf = W.heightAt(DOCK.x, endZ);   // (the lake's surface: its ground is flat at the surface)
  // the dock's own frame: its end at the site's middle, on the water, turned so the lake is its -Z (south, the world's +Z)
  const frame = new THREE.Group(); frame.name = 'dock-frame'; frame.position.set(0, surf - origin.y, 0); frame.rotation.y = Math.PI; group.add(frame);
  group.updateMatrixWorld(true);
  const toWorld = (x, z) => { const v = frame.localToWorld(new THREE.Vector3(x, 0, z)); return v; };
  // the bottom under a post: the bank where it is dry, a little under the water where it isn't
  const bed = (x, z) => { const w = toWorld(x, z); return W.waterAt(w.x, w.z) > 0.3 ? -0.9 : W.heightAt(w.x, w.z) - surf; };
  const low = W.tier === 'potato';
  const dock = makeDock(frame, { deck: DOCK.deck, len: DOCK.len, groundY: bed, step: true, low });
  // (drawn as one mesh a material while it stands: posts, beams, the creel and the can; the planks are one instanced mesh)
  const merged = mergeStatic([dock.group], frame);
  // walkers (the rider, the townsfolk) don't go through the dock: its footprint, turned into the world
  const fp = dock.footprint, c0 = toWorld(fp[0], fp[1]), c1 = toWorld(fp[2], fp[3]);
  const box = { x0: Math.min(c0.x, c1.x), x1: Math.max(c0.x, c1.x), z0: Math.min(c0.z, c1.z), z1: Math.max(c0.z, c1.z) };
  const offBlock = W.addBlocker ? W.addBlocker((x, z) => x > box.x0 && x < box.x1 && z > box.z0 && z < box.z1) : () => {};

  // ── the kept fish on the stringer while nobody is fishing: still, one shared colour material, merged ───────────
  const stillMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  let still = null;          // { group, merged }
  const yaw = stringerYaw(dock.STRINGER);
  function hangStill() {
    dropStill();
    const fish = F().creel.slice(-8); if (!fish.length) return;
    const g = new THREE.Group(); frame.add(g);
    // (each fish's shape is lent by fish.js while it hangs, and given back when the stringer is taken down)
    const lent = fish.map((x, i) => {
      const f = makeFish(x.kind, value(feet(x.len)) * 0.3048);
      const m = new THREE.Mesh(f.mesh.geometry, stillMat); m.castShadow = !low;
      m.position.copy(stringerAt(dock.STRINGER, i)); m.rotation.set(-Math.PI / 2 + Math.sin(i) * 0.05, yaw + Math.sin(i * 2) * 0.25, 0, 'YXZ');
      g.add(m);
      return f;
    });
    still = { group: g, merged: mergeStatic([g], frame), lent };
  }
  function dropStill() { if (!still) return; still.merged.undo(); frame.remove(still.group); for (const f of still.lent) f.dispose(); still = null; }
  hangStill();

  // ── the old fisherman at the foot of the dock ────────────────────────────────────────────────────────────────
  try {
    keeper = makePerson(folk, { ...DOCK.look, shadows: true });
    const k = DOCK.keeper; keeper.root.position.set(k.x, W.heightAt(k.x, k.z), k.z);
    // (facing up the path, toward the town, where riders come down from)
    keeper.root.rotation.y = Math.atan2(-4.1 - k.x, -101 - k.z);
    keeper.play('Idle', { fade: 0 });
    W.scene.add(keeper.root);
  } catch (e) { console.warn('fishing: the fisherman could not be made', e); }
  J.keeper = keeper;
  const offKeeper = keeper && W.addBlocker ? W.addBlocker((x, z) => Math.hypot(x - DOCK.keeper.x, z - DOCK.keeper.z) < 0.42) : () => {};

  // ── the questions: the rider's level on the fishing ladder (src/levels/place/fishing.js, kept by
  // src/levels/model.js), made by the ladder's own maker (labs/fishing/pies.js questionAt) ─────────────────────────
  let timer = null, now = null;   // now: the levelFor answer the catch's question was made at
  const asker = {
    question(ctx, recent) {
      now = levelFor(rider, 'fishing'); saveT = DOCK.saveAfter;   // (the first fish meets the place: saved soon)
      const q = questionAt(now.level.gen, Math.random, ctx, recent);
      return Object.assign(q, { levelId: now.id });
    },
    practice(topic, from, ctx, catchQ) {
      const gen = (catchQ && catchQ.gen) || (now && now.level.gen) || { kind: 'fish', from: 1, topic: 'keep' };
      return Object.assign(lessonAt(gen, Math.random, ctx, topic), { levelId: (catchQ && catchQ.levelId) || (now && now.id) });
    },
    lesson(q, ctx) { return lessonAt(q.gen || (now && now.level.gen) || { kind: 'fish', from: 1 }, Math.random, ctx, q.topic); },
    asked(q) {
      if (timer) timer.cancel(); timer = answerTimer();
      if (speak && readAloud(rider)) speak(sayable(q.prompt));
    },
    answered(q, right) {
      const t = timer ? timer.stop() : {}; timer = null;
      const rec = recordAnswer(rider, right, { place: 'fishing', level: q.levelId, sitDown: true, size: 1, ...t });
      // a fraction of your fish ("a third of your 12 fish") shares them out first: 12 ÷ 3 is the times fact 3 × 4, and
      // it goes on the times chart like every sharing asked anywhere (src/math/facts.js)
      { const m = /^group:\d+\/(\d+):(\d+)$/.exec(q.key || ''); if (m) { const d = +m[1], each = +m[2] / d; if (Number.isInteger(each) && d <= 12 && each >= 1 && each <= 12) { try { recordFact(rider, d, each, !!right); } catch (e) { console.warn(e); } } } }
      saveT = DOCK.saveAfter;
      const lv = rec && rec.level;
      return { up: !!(lv && lv.moved > 0 && !lv.justPlaced && lv.placed), down: !!(lv && lv.moved < 0) };
    },
    stars() {
      const q = now || levelFor(rider, 'fishing');
      return { n: q.i + 1, of: q.n, name: q.level.title, note: q.placing ? 'Finding your level' : '' };
    },
    state: () => ({ now: now ? { id: now.id, i: now.i, placing: now.placing } : null, pct: pctOf(rider, 'fishing') }),
  };
  flagAsker(asker, 'fishing');   // ("Confusing?" on the catch's question card: src/ui/flag.js)

  // ── the records the builder keeps: the saddlebags, the biggest fish, the fish book ─────────────────────────────
  const buckles = [];
  let saveT = 0;
  const records = {
    read: () => { const f = F(); return { record: f.record, book: f.book }; },
    write({ record, book }) { const f = F(); f.record = record; f.book = book; saveT = DOCK.saveAfter; },
    creel: () => F().creel,
    stringer: () => F().creel,
    keep: (fish) => keepFish(F(), JSON.parse(JSON.stringify(fish))),
    caught() {
      const f = F(); f.landed++;
      if (markFound(rider, 'place', 'fishing')) saveT = 0.01;
      const b = countJob(rider, 'fish', 1).buckle; if (b) buckles.push(b);
      saveT = DOCK.saveAfter;
    },
  };

  // ── the fishing, mounted at the dock ─────────────────────────────────────────────────────────────────────────
  let angler = null, fadeIn = null, fadeOut = null;   // { t, angler }: the double fading in, or out after closing
  const water = (() => {
    const R = makeRipples(frame, { y: 0.02 });
    // open water a bobber can land in: wet here, and wet a couple of metres round (clear of the reeds along the edge)
    const isWater = (x, z) => {
      const w = toWorld(x, z); if (W.waterAt(w.x, w.z) < 0.6) return false;
      for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) if (W.waterAt(w.x + dx, w.z + dz) < 0.4) return false;
      return true;
    };
    return { isWater, ripple: R.ripple, update: R.update, dispose: R.dispose };
  })();
  const under = { surface: { value: surf }, colour: DOCK.water };
  function mount(ctx) {
    dropStill();   // (the builder hangs its own, the same fish in the same places)
    if (fadeOut) finishFadeOut();
    let person = null;
    try { person = makePerson(folk, { outfit: 'farmer_m', palette: 'drifter', ...(rider.look || {}), shadows: true }); person.fade = 0; }
    catch (e) { console.warn('fishing: the rider\'s double could not be made', e); }
    const B = J.builder = mountFishing({
      root: ctx.root, scene: frame, camera: ctx.camera, fit: () => ctx.fit(null), canvasRect: ctx.canvasRect,
      dock, water, asker, records, person, under, deep: 0.5, keepAngler: true, low, lift: 0.35,
      sound: audio && audio.ready ? { ready: (fn) => audio.ready(fn) } : null,
      escape: () => ctx.leave('esc'),
      changed: () => { saveT = DOCK.saveAfter; },
    });
    if (audio && audio.need) audio.need('fishing', true);
    fadeIn = { t: 0 };
    B.ready.then(() => { angler = B.angler; if (angler && fadeIn) angler.setFade(0); });
    // (saved on the way out, before the builder takes itself off the page)
    const dispose = B.dispose;
    B.dispose = () => { dispose(); keep(); };
    return B;
  }
  function keep() { saveT = 0; saveRider(rider); }
  function closed() {
    const B = J.builder; J.builder = null;
    if (audio && audio.need) audio.need('fishing', false);
    fadeIn = null;
    const a = (B && B.angler) || angler; angler = null;
    if (a) fadeOut = { t: 0, angler: a };
    else { setRiderFade(1); hangStill(); }
    refresh();
    // a buckle won while fishing: its note now the HUD is back
    if (hud && hud.buckle) buckles.splice(0).forEach((b, i) => hud.buckle(b, { delay: 600 + i * 2600 }));
  }
  function setRiderFade(f) { const P = player(); if (P && P.person && 'fade' in P.person) P.person.fade = f; }
  function finishFadeOut() {
    if (!fadeOut) return;
    fadeOut.angler.dispose({ keepPerson: false });
    fadeOut = null; setRiderFade(1);
    hangStill();
  }

  J.update = (dt) => {
    if (warmUp && ++frames >= 4) { warmUp(); warmUp = null; }
    if (cardWarm !== true && J.builder && !fadeIn && !J.builder.busy()) warmCard();
    if (saveT > 0 && (saveT -= dt) <= 0) keep();
    { const P = player(); if (keeper && keeper.root.visible && (!P || Math.hypot(P.position.x - DOCK.keeper.x, P.position.z - DOCK.keeper.z) < 90)) keeper.update(dt); }   // (his clips: within 90 m, as the job folk's)
    // the rider fades out on the bank as the double fades in at the end of the dock, and back again after
    if (fadeIn) {
      fadeIn.t += dt; const e = ease(fadeIn.t / DOCK.fade);
      if (angler) angler.setFade(e);
      setRiderFade(1 - e);
      if (fadeIn.t >= DOCK.fade && angler) fadeIn = null;
    }
    if (fadeOut) {
      fadeOut.t += dt; const e = ease(fadeOut.t / DOCK.fade);
      fadeOut.angler.setFade(1 - e); fadeOut.angler.person.update && fadeOut.angler.person.update(dt);
      setRiderFade(e);
      if (fadeOut.t >= DOCK.fade) finishFadeOut();
    }
  };

  // ── the fishing's shaders, readied in the background while the rider is elsewhere (else the first cast built them
  // in the middle of a frame): a fish under the water, a ring on it, the line, the rod, and the dock itself ─────────
  // (they stay, never drawn, till the ride ends: a program is let go with the last material using it)
  let unwarm = () => {}, warmUp = null, frames = 0;
  if (renderer && camera && renderer.compileAsync) {
    const warm = new THREE.Group(); warm.visible = false; frame.add(warm);
    const fish = makeFish('trout', 0.25, { under }); warm.add(fish.root);
    const held = makeFish('perch', 0.2); warm.add(held.root);
    const R = makeRipples(warm, { y: 0.02 });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0, 1, 0, 0], 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1], 3));
    const geoUV = new THREE.SphereGeometry(0.05, 6, 4);   // (the bobber's: its shadow's program wants a uv)
    const bits = [new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })), new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xf4f1e6, transparent: true, opacity: 0.85 })),
      new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xfff3c8, transparent: true, opacity: 0.85, depthWrite: false })), new THREE.Mesh(geoUV, new THREE.MeshLambertMaterial({ color: 0xd8321e }))];
    // (and the rod's and the bobber's see-through twins: the double fades in and out with them see-through)
    bits.push(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true })), new THREE.Mesh(geoUV, new THREE.MeshLambertMaterial({ color: 0xd8321e, transparent: true })));
    bits[0].castShadow = true; bits[3].castShadow = true; bits[4].castShadow = true; bits[5].castShadow = true; for (const o of bits) warm.add(o);
    unwarm = () => { fish.dispose(); held.dispose(); R.dispose(); for (const o of bits) o.material.dispose(); geo.dispose(); geoUV.dispose(); warm.removeFromParent(); };
    // (a few frames on: the world gives every plain lit material its sun-shade patch first, src: world/valley.js
    // sunShadeAll, and a program built before that would be built again)
    warmUp = () => { try { renderer.compileAsync(frame, camera, W.scene).catch(() => {}); } catch (e) { /* (they are built on first use instead) */ } };
  }

  // ── the first question card's view, drawn ahead ─────────────────────────────────────────────────────────────
  // The card's camera looks back from the end of the dock, low over the water, toward the town: buildings the game
  // had never drawn were first drawn on the card's first frame, and the graphics card finished building their shaders
  // then (one frame of 85 to 177 ms). Once the rod is out and nothing is happening, that view is drawn ahead, a ninth
  // of it a frame (each piece draws only what is in it), onto the page's own canvas (a target of its own would use
  // other shaders: the screen's colour space) but only one pixel of it (a scissor), just before the frame's real
  // drawing paints over it. Once a ride.
  let cardWarm = null;       // null: not yet; { cam, rt, i } drawing; true: done
  const CARD_TILES = 3;
  function warmCard() {
    if (!renderer || !camera || !W.scene) { cardWarm = true; return; }
    if (!cardWarm) {
      const v = J.builder.cardView ? J.builder.cardView() : null; if (!v) return;
      // (wider than the card's own view: the camera swings there from the dock's view as the fish comes up, and the
      // fish's size moves it a little; the land at the edges is drawn first on the way)
      const cam = camera.clone(); cam.fov = Math.min(110, camera.fov * 1.8); cam.aspect = Math.max(camera.aspect, 1.4);
      cam.position.copy(v.pos); cam.lookAt(v.look); cam.updateMatrixWorld();
      cardWarm = { cam, i: 0 };
    }
    const { cam } = cardWarm, n = CARD_TILES, i = cardWarm.i++;
    cam.setViewOffset(n, n, i % n, Math.floor(i / n), 1, 1);
    const was = renderer.getRenderTarget(), auto = renderer.shadowMap.autoUpdate, sc = renderer.getScissorTest();
    try { renderer.shadowMap.autoUpdate = false; renderer.setRenderTarget(null); renderer.setScissorTest(true); renderer.setScissor(0, 0, 1, 1); renderer.render(W.scene, cam); }
    catch (e) { cardWarm.i = n * n; }
    finally { renderer.setScissorTest(sc); renderer.setRenderTarget(was); renderer.shadowMap.autoUpdate = auto; }
    if (cardWarm.i >= n * n) cardWarm = true;
  }

  // ── selling at the store ─────────────────────────────────────────────────────────────────────────────────────
  let sinceSale = 0;
  J.creel = () => F().creel;
  J.fishLine = () => { const n = F().creel.length; return n ? `${n} fish` : ''; };
  J.saleOrder = ({ who = null, grade = null } = {}) => {
    const f = F(); if (!f.creel.length) return null;
    if (!(f.fresh && CREEL.sellFirst) && ++sinceSale < CREEL.every) return null;
    // the form of sale: with the store's level (grade: its school year, as the eggs' and the wool's sales go), the
    // hardest form at or under it, and none under the easiest (a kindergartner isn't asked 3 gold a fish times 4);
    // without it (old callers), the skill model's way
    let map, q, form0;
    if (grade != null) {
      const forms = Object.entries(SALE_FORMS).flatMap(([m, list]) => list.map((form, i) => ({ form, m, at: pctAt(m, i + 1) }))).sort((a, b) => a.at - b.at);
      const fit = forms.filter((x) => x.at <= grade).pop();
      if (!fit) return null;
      map = fit.m; form0 = fit.form; q = { at: fit.at };
    } else {
      const sm = saleMap(rider); map = sm.map; q = stepFor(rider, map, { most: sm.most });
      form0 = SALE_FORMS[map][clamp(q.step || 1, 1, SALE_FORMS[map].length) - 1];
    }
    for (const form of formsBelow(form0)) {
      const m = Object.keys(SALE_FORMS).find((k) => SALE_FORMS[k].includes(form)), step = SALE_FORMS[m].indexOf(form) + 1;
      const at = m === map ? Math.max(q.at, pctAt(m, step)) : pctAt(m, step);
      const o = makeFishSale(f.creel, { form, who, map: m, at });
      if (o) { sinceSale = 0; f.fresh = false; return o; }
    }
    return null;
  };
  J.sold = (order) => {
    const s = order && order.sale; if (!s || s.goods !== 'fish') return;
    const f = F(), out = new Set(s.fish);
    f.creel = f.creel.filter((x, i) => !out.has(i)); f.sold += out.size;
    saveRider(rider); refresh();
    if (!J.builder && !fadeOut) hangStill();   // (out of view: the player is at the store)
  };

  // the card's sum for the tools' Work it out (src/math/jobsums.js fishSum): a fraction of the fish caught, else none
  J.workSum = () => { const B = J.builder, q = B && B.handle && B.handle.question ? B.handle.question() : null; return q && !q.answered ? fishSum(q) : null; };
  J.where = () => { const p = keeper ? keeper.root.position : { x: DOCK.x, z: DOCK.foot }; return { x: p.x, z: p.z }; };
  J.state = () => ({ open: !!J.builder, creel: F().creel.length, landed: F().landed, record: F().record, draws: merged.draws + (still ? still.merged.draws : 0), still: still ? still.merged.count : 0,
    fade: { in: !!fadeIn, out: !!fadeOut }, cardWarm: cardWarm === true ? 'done' : cardWarm ? cardWarm.i : 'not yet', keeper: keeper && { x: keeper.root.position.x, z: keeper.root.position.z }, surf, end: { x: DOCK.x, z: endZ }, asker: asker.state() });
  J.dispose = () => {
    cardWarm = true;
    if (fadeOut) finishFadeOut();
    setRiderFade(1);
    dropStill(); stillMat.dispose(); unwarm();
    merged.undo(); dock.dispose(); water.dispose();
    offBlock(); offKeeper();
    if (keeper) { keeper.root.removeFromParent(); if (keeper.dispose) keeper.dispose(); }
    group.remove(frame);
  };
  return J;
}
