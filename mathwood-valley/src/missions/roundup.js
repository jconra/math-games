// THE ROUND-UP: cattle graze in the pasture, each with a number floating over it. A card shows a number pattern with
// a blank ("3, 6, 9, ?", "?, 36, 42, 48", "2/3, 1 1/3, ?, 2 2/3"), or names a herd ("Rope the 7-herd"). Picking a
// steer IS the answer: the lasso aims itself.
//   right: the loop pulls tight, the steer is led a moment, then gallops off to the corral by itself; gold
//   wrong: the rope tangles, "Not me, partner", one plain line (and the series' number line with a hop for each step,
//          or the herd's skip-count 6 · 12 · 18 · 24 · (27) · 30 under the card); a series card stays up to be roped
//          right, a herd's wrong number comes back a few answers later
// When every right one is roped (a herd), or the wave's cards are done (3 series cards), the wave pays a bonus and puts
// a lock box in the saddlebags, and a new bunch wanders in. There is no game over and no timer.
//
// ONE KIND OF MATH HERE: SERIES (src/levels/place/roundup.js is the ladder, from "1, 2, 3, ?" through counting by 10s,
// 5s and 2s, every times table to 12 as a series, the multiples herds, going down, odd steps and rules, to below zero,
// fractions and decimals). HOW HARD is the rider's level in this place (src/levels/model.js levelFor, asked before
// every card and every herd): a series card comes from src/math/series.js (its slips, its line, its picture), a herd
// from the times trainer (src/math/times.js, told the table: the weak tables come up more, src/math/facts.js). Every
// answer goes back with the level it was asked at (save.js recordAnswer: a travel job, no time): the first try at each
// card (a card answered after its help came up is practice), and each rope of a herd. Each times fact answered (a
// series blank on a table, a multiple roped) goes to the times chart (facts.js recordFact). The rider works in a RANGE
// of levels (series.js RANGE): one card a wave, and now and then a whole herd, comes from below the rider's level (the
// levels just below, the earlier tables with red or yellow facts), recorded at the level it was made at.
// When the kid is stuck (8 s without a pick) or right after a miss, help appears: the series' number line with a hop
// for each step (src/ui/counthelp.js; a fraction, decimal or growing rule gets its plain line instead), or the times
// chart's "Peek" button for a herd.
// With read-aloud on (src/audio/readaloud.js), a young level's card ("1, 2, 3, what comes next", "what comes after 7")
// reads itself out when it appears at the herd (a speaker on the card says it again), and a right or wrong pick may
// get a word ("That's right!", "Not that one.").
//
//   const RU = makeRoundup({ W, animals, P, I, camera, canvas, rider, hud, hob, refresh, read })
//     P, I: the player and the input; hud: makeHud's; hob: makeHob's (for its lines); refresh(): redraw the purse;
//     read: makeReadAloud's (optional)
//   RU.update(dt)        each frame, after P.update (moves the herd, places the numbers, moves the target ring)
//   RU.paused = true     a panel is open: help is put away, the ring hidden (the game stops calling update meanwhile)
//   RU.targets           the herd (steer records: { n, text, good, state, a (the animal), root, label })
//   RU.throwAt(steer)    rope this one (as a click on it does)
//   RU.newWave(at)       deal a new wave now (dev: at a level id of the round-up's ladder, 'times' for a herd, else the
//                        rider's own level)
//   RU.near              true while the player is at the herd
//   RU.wave              the wave showing: { topic, rule, sub, goods, caught }
//   RU.ring              the target ring (src/targetring.js)
//   RU.dispose()
import * as THREE from 'three';
import { makeAnimal, COATS } from '../actors/animals.js';
import { makeTimes } from '../math/times.js';
import { makeSeriesDeck, SERIES, reviewFor, herdReview } from '../math/series.js';
import { levelFor, stateOf, isOn } from '../levels/model.js';
import { PLACE } from '../levels/places.js';
import { recordFact, pickFact, pickTable } from '../math/facts.js';
import { readAloud } from '../math/skill.js';
import { sayLine } from '../audio/sayline.js';
import { showGroups } from '../ui/groups.js';
import { showCountHelp } from '../ui/counthelp.js';
import { makeTargetRing } from '../targetring.js';
import { offerChart, closeChart, chartOptions, watchHesitation as watchChart, ensureChartCss } from '../ui/timeschart.js';
import { showNumberLine, ensureNumberLineStyles, watchHesitation as watchLine } from '../ui/numberline.js';
import { recordAnswer, earn, saveRider, countJob } from '../save.js';
import { PAY, PRICES, boxTier } from '../shop.js';
import { TIER_NAME } from '../lockbox/index.js';

export const ROUNDUP = {
  herd: 11,              // cattle in a herd wave (the times trainer deals this many numbers: 10 to 12)
  cards: SERIES.cards,   // series cards in a wave
  payEvery: 6,           // a steer pays 1 gold more for every this many levels up the round-up's ladder
  bulls: 0.25,           // this share of the herd are bulls
  spread: 0.82,          // the herd grazes within this share of the pasture's radius
  roam: 6,               // ... and a steer ambles at most this far from its own spot (m)
  gap: 4.2,              // steers start at least this far apart (m)
  near: 46,              // the player is "at the herd" within this of the pasture's middle (m): the card and help show
  labelPx: [44, 64],     // the number card's height on screen (pixels): about 6% of the screen's height, kept in this range
  labelFull: 40,         // the numbers show in full within this many metres of the player ...
  labelGone: 58,         // ... and have faded out by this far
  hold: 1.6,             // seconds a roped steer is led before it heads for the corral
  run: 3.6,              // m/s a roped steer gallops to the corral (the Gallop clip at about its own speed: its hooves
                         // keep to the ground; slower, a gallop looks like slow motion)
  pen: 12,               // the corral holds this many; older ones are sold off (they fade away)
  nextWave: 5,           // seconds after a wave before the next bunch comes in
  helpAfter: 8000,       // ms without a pick before help is offered
  hintFor: 12,           // seconds the "not me, partner" line stays up (or until the next pick)
  stackGap: 6,           // pixels kept between two number cards that would overlap on screen (the farther one moves up)
};

const NL_THEME = 'dark';
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ── THE NUMBER CARD OVER A STEER ─────────────────────────────────────────────────────────────────────────────────
// a cream card with the number in dark ink, the same for right and wrong ones; drawn on a canvas of a fixed size (a
// texture's size can't change once on the graphics card), the card itself sized to its words inside it
const CARD_W = 320, CARD_H = 128;
function makeLabel() {
  const cv = document.createElement('canvas'); cv.width = CARD_W; cv.height = CARD_H;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
  const s = new THREE.Sprite(mat); s.center.set(0.5, 0); s.renderOrder = 1000; s.name = 'steer-number';   // (after the target ring's loop, 996-999, so the ring never crosses a card; the ringed card is drawn again above, 1001)
  s.userData = { cv, tex, text: null, wide: 1 };   // wide: the drawn card's width over the canvas's
  return s;
}
function drawLabel(s, text) {
  if (s.userData.text === text) return;
  s.userData.text = text;
  const { cv, tex } = s.userData, c = cv.getContext('2d');
  c.clearRect(0, 0, CARD_W, CARD_H);
  c.font = '700 84px Bitter, Georgia, serif';
  const w = Math.min(CARD_W - 8, Math.max(CARD_H * 1.05, c.measureText(text).width + 56)), x0 = (CARD_W - w) / 2;
  c.fillStyle = 'rgba(246, 237, 214, 0.96)'; c.strokeStyle = 'rgba(92, 64, 36, 0.95)'; c.lineWidth = 6;
  c.beginPath(); c.roundRect(x0 + 4, 6, w - 8, CARD_H - 12, 26); c.fill(); c.stroke();
  s.userData.wide = w / CARD_W;
  c.fillStyle = '#2b2219'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, CARD_W / 2, CARD_H / 2 + 5);
  tex.needsUpdate = true;
}

export function makeRoundup({ W, animals, P, I, camera, canvas, rider, hud, hob, refresh = () => {}, read = null }) {
  const scene = W.scene, PA = W.places.pasture, CO = W.places.corral;
  const R = makeTargetRing({ scene, camera, canvas, W });
  ensureChartCss(); ensureNumberLineStyles();
  const fontReady = (document.fonts && document.fonts.load) ? document.fonts.load('700 84px Bitter').catch(() => null) : Promise.resolve();

  // the times trainer (the herds; shared with the wagon's gangs: main.js), made once per ride; its state lives in the
  // rider and saves with it. The series cards' deck asks the rider's level before every card.
  let timesT = null;
  function trainer() {
    rider.topics = rider.topics || {};
    return timesT || (timesT = makeTimes(rider.topics.times || (rider.topics.times = {})));
  }
  // the level to ask now: the rider's own, or (dev) the level a wave was dealt at
  let devAt = null;
  const LEVELS = PLACE.roundup.levels;
  function ask() {
    if (devAt) { const i = LEVELS.findIndex((L) => L.id === devAt); if (i >= 0) return { level: LEVELS[i], id: devAt, i, placing: false, dev: true }; }
    const q = levelFor(rider, 'roundup');
    saveRider(rider);   // (the first ask meets the place)
    return q;
  }
  let lastFact = null, lastTable = null;
  const deck = makeSeriesDeck({
    ask,
    pickFact: (tables) => { const f = pickFact(rider, { tables, upTo: 12, from: 1, last: lastFact }); if (f) lastFact = f.key; return f; },
    pickTable: (tables) => pickTable(rider, tables, { last: lastTable }),
    // one card a wave from the range below the rider's level (series.js RANGE: the levels just below, and the earlier
    // tables the times chart shows red or yellow)
    review: reviewFor({ levels: LEVELS, rider, isOn: (id) => isOn(rider, 'roundup', id) }),
  });

  const herd = [];               // every steer out here: in the pasture, led, running to the corral, or penned
  const RU = { targets: herd, ring: R, near: false, wave: null };
  let waveN = 0, wave = null, nextWaveT = -1, time = 0, hintT = 0;
  let offer = null, hes = null, nl = null, nlCard = null;

  // ── THE CATTLE ─────────────────────────────────────────────────────────────────────────────────────────────────
  let steerId = 0;
  function spot(avoid = []) {
    // an open spot in the pasture, clear of the others
    for (let tries = 0; tries < 60; tries++) {
      const r = PA.r * ROUNDUP.spread * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
      const x = PA.x + Math.cos(a) * r, z = PA.z + Math.sin(a) * r;
      if (W.blocked(x, z) || W.waterAt(x, z) > 0.25) continue;
      if (avoid.some((o) => Math.hypot(o.x - x, o.z - z) < ROUNDUP.gap)) continue;
      return { x, z };
    }
    return { x: PA.x + (Math.random() - 0.5) * 10, z: PA.z + (Math.random() - 0.5) * 10 };
  }
  function addSteer(at, { walkIn = false } = {}) {
    const kind = Math.random() < ROUNDUP.bulls ? 'bull' : 'cow';
    const a = makeAnimal(animals, kind, { tint: COATS[steerId % COATS.length] });
    const s = { id: ++steerId, a, root: a.root, kind, n: null, text: '', good: false, trap: null, cardId: null, label: makeLabel(),
      state: 'graze', home: { x: at.x, z: at.z }, t: Math.random() * 3, walking: false, alpha: 0, top: a.tall + 0.25 };
    let x = at.x, z = at.z;
    if (walkIn) {
      // a new one wanders in from the far side of the pasture
      const ang = Math.atan2(at.z - PA.z, at.x - PA.x) * 0.3 + (Math.random() - 0.5) * 0.8;
      for (const d of [PA.r + 6, PA.r + 3, PA.r]) {
        const ex = PA.x + Math.cos(ang) * d, ez = PA.z + Math.sin(ang) * d;
        if (!W.blocked(ex, ez) && W.waterAt(ex, ez) < 0.3) { x = ex; z = ez; break; }
      }
      s.state = 'arrive';
    }
    a.root.position.set(x, W.heightAt(x, z), z);
    a.root.rotation.y = s.state === 'arrive' ? Math.atan2(at.x - x, at.z - z) : Math.random() * Math.PI * 2;
    a.play(Math.random() < 0.6 ? 'Eating' : 'Idle');
    scene.add(a.root); scene.add(s.label);
    s.label.visible = false;
    herd.push(s);
    return s;
  }
  function removeSteer(s) {
    const i = herd.indexOf(s); if (i >= 0) herd.splice(i, 1);
    s.label.removeFromParent(); s.label.material.dispose(); s.label.userData.tex.dispose();
    s.a.dispose();
  }
  function setNumber(s, t, cardId = null) {
    s.n = t ? t.n : null; s.good = !!(t && t.good); s.trap = t ? t.trap || null : null; s.cardId = cardId;
    s.text = t ? (t.label || numText(t.n)) : '';
    if (t) { fontReady.then(() => { if (s.text) drawLabel(s.label, s.text); }); drawLabel(s.label, s.text); }
  }
  const numText = (n) => (n < 0 ? '−' + Math.abs(n) : String(n));
  const free = (s) => s.state === 'graze' || s.state === 'arrive' || s.state === 'tangled' || s.state === 'idle';

  // give these numbers to the herd: free steers take them (a new number on an old steer), more wander in if needed.
  // Steers left over graze on without a number (ready for the next card, so a positive & negative card's answers
  // don't have to walk in from outside); only more than a full herd's worth amble off
  function deal(targets, cardId = null) {
    const pool = herd.filter(free);
    const placed = pool.map((s) => s.home);
    for (const t of targets) {
      let s = pool.shift();
      if (!s) { const at = spot(placed); placed.push(at); s = addSteer(at, { walkIn: true }); }
      else if (s.state === 'tangled' || s.state === 'idle') { s.state = 'graze'; s.t = 0; s.goal = null; }
      setNumber(s, t, cardId);
    }
    const keep = Math.max(0, ROUNDUP.herd - targets.length);
    pool.forEach((s, i) => { setNumber(s, null); if (i < keep) { if (s.state !== 'arrive') s.state = 'idle'; } else leave(s); });
  }
  // a herd grazing in the pasture from the start, without numbers yet (the first wave's numbers go to them)
  function stock() {
    const placed = herd.filter(free).map((s) => s.home);
    while (herd.filter(free).length < ROUNDUP.herd) { const at = spot(placed); placed.push(at); addSteer(at); }
  }
  function leave(s) {
    s.state = 'leave';
    const ang = Math.atan2(s.root.position.z - PA.z, s.root.position.x - PA.x) + (Math.random() - 0.5) * 0.6;
    s.goal = { x: PA.x + Math.cos(ang) * (PA.r + 30), z: PA.z + Math.sin(ang) * (PA.r + 30) };
    s.fade = 1;
  }

  // walk a steer toward a point, steering round what blocks it; returns true once there
  const tmpV = new THREE.Vector3();
  function walkTo(s, gx, gz, v, dt, near = 0.8) {
    const r = s.root, dx = gx - r.position.x, dz = gz - r.position.z, d = Math.hypot(dx, dz);
    if (d < near) return true;
    const want = Math.atan2(dx, dz);
    v = Math.min(v, 0.8 + d * 1.2);    // (it slows as it gets there, rather than circling the spot at a gallop)
    r.rotation.y += wrapA(want - r.rotation.y) * Math.min(1, 3.5 * dt);
    let h = r.rotation.y, moved = false;
    for (const turn of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6]) {
      const hh = h + turn, step = Math.min(v * dt, d), nx = r.position.x + Math.sin(hh) * step, nz = r.position.z + Math.cos(hh) * step;
      if (!W.blocked(nx, nz) && !W.blocked(nx + Math.sin(hh) * 1.0, nz + Math.cos(hh) * 1.0)) {
        r.position.set(nx, W.heightAt(nx, nz), nz); if (turn) r.rotation.y += turn * Math.min(1, 4 * dt); moved = true; break;
      }
    }
    if (!moved) { s.stuck = (s.stuck || 0) + dt; if (s.stuck > 4) { r.position.set(gx, W.heightAt(gx, gz), gz); return true; } }
    else s.stuck = 0;
    const a = s.a;
    a.pace(moved ? v : 0);         // (the clip and its speed for the pace: its hooves keep to the ground)
    return false;
  }
  function graze(s, dt) {
    const a = s.a, r = s.root;
    if ((s.t -= dt) <= 0) {
      s.walking = !s.walking && Math.random() < 0.45; s.t = 3 + Math.random() * 6;
      a.play(s.walking ? 'Walk' : Math.random() < 0.65 ? 'Eating' : (Math.random() < 0.5 ? 'Idle' : 'Idle_Headlow'));
      if (s.walking) r.rotation.y += (Math.random() - 0.5) * 2.2;
    }
    if (s.walking) {
      // a step at the Walk's own pace (the clip plays at 1x): straight on, or, when that way is shut (a wall, water, its
      // roam's edge, another steer), a step a little to one side while it turns that way, as walkTo does. With every
      // way shut it stops and grazes (it doesn't walk on the spot while it turns).
      const v = a.stride.Walk, step = v * dt, h = r.rotation.y;
      const free = (x, z) => !W.blocked(x, z) && W.waterAt(x, z) < 0.3 && Math.hypot(x - s.home.x, z - s.home.z) < ROUNDUP.roam
        && !herd.some((o) => o !== s && o.state === 'graze' && Math.hypot(o.root.position.x - x, o.root.position.z - z) < 2.2);
      let moved = false;
      for (const turn of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6]) {
        const hh = h + turn, nx = r.position.x + Math.sin(hh) * step, nz = r.position.z + Math.cos(hh) * step;
        if (free(nx, nz)) { r.position.set(nx, W.heightAt(nx, nz), nz); if (turn) r.rotation.y += turn * Math.min(1, 4 * dt); moved = true; break; }
      }
      if (!moved) { s.walking = false; s.t = 2 + Math.random() * 4; a.play(Math.random() < 0.65 ? 'Eating' : 'Idle'); }
    }
  }

  // each steer's own frame
  function steerStep(s, dt) {
    const a = s.a;
    switch (s.state) {
      case 'graze': case 'idle': graze(s, dt); break;
      case 'arrive': if (walkTo(s, s.home.x, s.home.z, 1.4, dt, 1.0)) { s.state = 'graze'; s.t = 0; a.play('Eating'); } break;
      case 'tangled':
        // after a tangle it ambles a few steps away, then grazes with its number put away until it comes back
        if (s.goal && walkTo(s, s.goal.x, s.goal.z, 0.5, dt, 0.8)) { s.goal = null; s.home = { x: s.root.position.x, z: s.root.position.z }; a.play('Eating'); }
        else if (!s.goal) graze(s, dt);
        break;
      case 'held': if (s.handle && !s.handle.held) toCorral(s); break;
      case 'corral': {
        const g = CO.gate, legs = [g.out, g.in, s.pen];
        if (walkTo(s, legs[s.leg].x, legs[s.leg].z, ROUNDUP.run, dt, s.leg === 2 ? 0.8 : 1.4)) {
          s.leg++;
          if (s.leg > 2) { s.state = 'penned'; s.penAt = time; a.play('Eating'); sellOff(); }
        }
        break;
      }
      case 'penned': if ((s.t -= dt) <= 0) { s.t = 4 + Math.random() * 6; a.play(Math.random() < 0.6 ? 'Eating' : 'Idle'); } break;
      case 'leave':
        walkTo(s, s.goal.x, s.goal.z, 1.2, dt, 1.5);
        s.fade -= dt / 6;
        if (s.fade <= 0 || Math.hypot(s.root.position.x - PA.x, s.root.position.z - PA.z) > PA.r + 26) { removeSteer(s); return; }
        break;
      case 'sold': s.fade -= dt / 1.2; s.root.scale.setScalar(Math.max(0.01, s.fade)); if (s.fade <= 0) { removeSteer(s); return; } break;
      default: break;
    }
    a.update(dt);
  }
  function toCorral(s) {
    s.state = 'corral'; s.leg = 0; s.handle = null;
    // its own spot inside the fence
    const hw = (CO.w || 22) / 2 - 2.5, hd = (CO.d || 18) / 2 - 2.5;
    for (let i = 0; i < 20; i++) {
      const x = CO.x + (Math.random() * 2 - 1) * hw, z = CO.z + (Math.random() * 2 - 1) * hd;
      if (!W.blocked(x, z)) { s.pen = { x, z }; break; }
    }
    if (!s.pen) s.pen = { x: CO.x, z: CO.z };
  }
  // the corral only holds so many: the ones penned longest are sold off
  function sellOff() {
    const pen = herd.filter((s) => s.state === 'penned').sort((a, b) => a.penAt - b.penAt);
    for (let i = 0; i < pen.length - ROUNDUP.pen; i++) { pen[i].state = 'sold'; pen[i].fade = 1; }
  }

  // another job (the wagon's gang) has an open wave on the shared times trainer: dealing now would close it under the
  // kid, so a wave waits until the player is back at the herd
  const mine = new Set();   // (the times waves this job dealt)
  function othersWave() {
    const c = trainer().state.cur;
    return !!(c && !c.closed && !mine.has(c.id));
  }
  // ── THE WAVE ───────────────────────────────────────────────────────────────────────────────────────────────────
  // at: (dev) a level id to deal at, 'times' for a herd (the any-table herd), else the rider's own level
  function newWave(at = null) {
    endHelp();
    waveN++;
    devAt = at === 'times' ? 'herdE' : at && LEVELS.some((L) => L.id === at) ? at : null;
    const own = ask();
    // now and then (series.js RANGE.herd) a herd from a herd level just below the rider's: a review, its ropes at ITS level
    const q = herdReview({ levels: LEVELS, q: own, isOn: (id) => isOn(rider, 'roundup', id) }) || own;
    if (q.level.gen.kind === 'herd') {
      // a herd: every multiple of one table (the weak tables more), each rope an answer at this level
      const T = trainer(), table = pickTable(rider, q.level.gen.tables, { last: lastTable }) || q.level.gen.tables[0];
      lastTable = table;
      const w = T.wave({ count: ROUNDUP.herd, table, reach: 12, placing: q.placing });
      mine.add(w.id);
      wave = { topic: 'times', T, w, q, level: q.id, startAt: own.id, hard: own.i + 1, review: q !== own, kind: 'herd', goods: w.targets.filter((t) => t.good).length, caught: 0, misses: 0 };
      deal(w.targets);
    } else {
      const w = deck.wave({ cards: ROUNDUP.cards });
      wave = { topic: 'series', T: deck, w, q, kind: 'card', card: w.card, caught: 0, cards: w.cards, cardNo: 1, misses: 0 };
      deal(w.card.targets, w.card.id);
      if (canRead(w.card) && w.card.say) read.preload([w.card.say], { topic: 'counting' });
    }
    RU.wave = wave;
    nextWaveT = -1;
    showCard();
    if (RU.near) startHelp();
  }
  // read-aloud: a card is read when it first shows at the herd (again after the player has been away), not each time
  // the card is drawn again. Only a young level's card (its `read`), while the rider's math is young enough (skill.js
  // readAloud) and read-aloud is on. (The read-aloud clips are the counting topic's: numbers, "what comes next" ...)
  let readFor = null;
  const canRead = (card) => !!(read && card && card.read && readAloud(rider) && read.can('counting'));
  // What a herd's rope is an answer to: the herd's level, while the rider is still on the level the herd was dealt at.
  // Once a rope has moved the rider to another level (up, or down after misses; or a step of placement), the herd's
  // other ropes are practice, counted in its kind of math only: the level has its answer from this herd, and the next
  // one is asked at the new level. (Otherwise a too-hard herd's ropes after a drop would be "stretches" above the rider,
  // whose rights count and misses don't, and a struggling kid would drift back up: measured, 51% right on the wagon.)
  function answerAt(w) {
    const st = stateOf(rider, 'roundup'), L = LEVELS.find((x) => x.id === w.level);
    if (st && st.id !== w.startAt && L && !(w.q && w.q.dev)) return { strands: [{ strand: L.strand, at: L.grade }] };
    return { place: 'roundup', level: w.level };
  }
  // "Up a level!" when the rider's level moves up a level once placed (not while it is being found: it climbs a level
  // per right answer then)
  function upLevel(rec) {
    const lv = rec && rec.level;
    if (!lv || !lv.placed || lv.justPlaced || lv.moved <= 0) return;
    const L = LEVELS.find((x) => x.id === lv.id);
    setTimeout(() => hud.toast(L ? `Up a level! ${L.title}` : 'Up a level!', 'good'), 900);
  }
  const finding = () => (wave && (wave.kind === 'card' ? wave.card && wave.card.placing : wave.q && wave.q.placing) ? ' · finding your level' : '');
  const sayCard = (c) => (read ? read.say(c.say, { topic: 'counting' }) : false);
  function showCard() {
    if (!wave || !RU.near || wave.done || wave.kind !== 'card') readFor = null;
    if (!wave) { hud.rule(null); return; }
    if (!RU.near) {
      const d = Math.round(Math.hypot(P.position.x - PA.x, P.position.z - PA.z));
      hud.rule({ kind: 'travel', main: 'Round-up: the herd is in the pasture', sub: `${d} m east of here, past the creek` });
      return;
    }
    if (wave.done) { hud.rule({ main: 'Wave done!', sub: 'Another bunch is wandering in…' }); return; }
    if (wave.kind === 'card') {
      const c = wave.card, readable = !!(c.say && canRead(c));
      hud.rule({ main: c.rule, sub: `${c.sub} · card ${wave.cardNo} of ${wave.cards}${finding()}`,
        buttons: [{ label: 'Show me', onClick: () => showLine(wave.T.help(c), { asked: true }) }],
        speak: readable ? () => sayCard(c) : null });
      if (readable && readFor !== c.id) { readFor = c.id; sayCard(c); }
    } else {
      const left = wave.goods - wave.caught;
      hud.rule({ main: wave.w.rule, sub: (left === wave.goods ? `${left} to rope` : `${wave.caught} roped · ${left} to go`) + finding() });
    }
  }

  // ── HELP WHEN STUCK ────────────────────────────────────────────────────────────────────────────────────────────
  function startHelp() {
    if (!wave || wave.done || RU.paused || hes) return;
    if (wave.topic === 'times') hes = watchChart({ after: ROUNDUP.helpAfter, onShow: () => chartHelp() });
    else hes = watchLine({ after: ROUNDUP.helpAfter, onShow: () => showLine(wave.T.help(wave.card)) });
  }
  function chartHelp(missed) {
    if (!wave || wave.topic !== 'times') return;
    const o = { ...chartOptions(wave.w, missed), anchor: hud.jobEl, avoid: hud.hintEl, side: 'right' };
    if (offer) offer.update(o); else offer = offerChart(document.body, o);
    placeOffer();
  }
  // the "Not me, partner" line under the rule card comes and goes (the Peek button is placed again each time)
  function hint(o) { hud.hint(o); placeOffer(); }
  // (a card topic's picture: its helper says which; the number line when it says none. asked: the kid pressed "Show
  // me", so a chart opens at once rather than offering a Peek button to press as well)
  function showLine(opts, { asked = false } = {}) {
    if (!opts) return;
    if (opts.helper === 'chart') { cardChart(opts, asked); return; }
    // (no picture for this card, a fraction or a rule: its line under the card, the rule of thumb or the working)
    if (opts.helper === 'text') { if (opts.reason) hint({ say: opts.reveal ? 'Not me, partner' : 'A hint', line: opts.reason }); hintT = ROUNDUP.hintFor; return; }
    if (nl) nl.remove();
    nl = opts.helper === 'groups' ? showGroups(hud.helpEl, opts) : opts.helper === 'count' ? showCountHelp(hud.helpEl, opts)
      : showNumberLine(hud.helpEl, { ...opts, theme: NL_THEME });
    nlCard = wave && wave.card ? wave.card.id : null;
  }
  // the times chart's "Peek" for a card (a big division fact: find the number in the table's row, then look up); a new
  // button for each card. open: show the chart itself now (the kid asked for it)
  function cardChart(o, open = false) {
    const opts = { ...o, anchor: hud.jobEl, avoid: hud.hintEl, side: 'right' };
    if (offer) offer.update(opts); else offer = offerChart(document.body, opts);
    placeOffer();
    if (open) offer.openChart();
  }
  function hideLine() {
    if (nl) { nl.remove(); nl = null; nlCard = null; }
    if (offer && wave && wave.kind === 'card') { closeChart(); offer.remove(); offer = null; }
  }
  function endHelp() {
    if (hes) { hes.cancel(); hes = null; }
    closeChart();
    if (offer) { offer.remove(); offer = null; }
    hideLine();
  }

  // ── THROWING ───────────────────────────────────────────────────────────────────────────────────────────────────
  // (one still walking in can be roped too: its number is showing)
  const ropeable = (s) => (s.state === 'graze' || s.state === 'arrive') && s.n != null && !!wave && !wave.done && (wave.kind !== 'card' || s.cardId === wave.card.id);
  RU.throwAt = (s) => {
    if (!s || !ropeable(s) || RU.paused) return false;
    const w = wave;
    const ok = P.throwLasso(s.a, {
      good: s.good, hold: ROUNDUP.hold, lead: true,
      onLand: (good) => landed(s, w, good),
      onCaught: (h) => { s.handle = h; },
      onMissed: () => {
        if (s.state !== 'throw') return;
        s.state = 'tangled';
        const ang = Math.random() * Math.PI * 2;
        const gx = s.root.position.x + Math.cos(ang) * 4, gz = s.root.position.z + Math.sin(ang) * 4;
        s.goal = W.blocked(gx, gz) ? null : { x: gx, z: gz };
        if (w.kind === 'card' && wave === w && w.card && s.cardId === w.card.id) { s.state = 'graze'; s.n = null; s.cardId = null; }
      },
      onCancel: () => {
        if (s.state === 'throw') { s.state = s.was === 'arrive' ? 'arrive' : 'graze'; s.a.play('Idle'); }
        if (hes && wave === w && !w.done) hes.restart();   // (no answer after all: the wait for help starts again)
      },
    });
    if (ok) {
      s.was = s.state; s.state = 'throw'; s.walking = false; s.a.play('Idle', { fade: 0.3 });
      // the kid has picked: that is the answer, so the walk or ride up to the steer isn't time spent stuck
      if (hes) hes.answered();
    }
    return ok;
  };

  // the loop has landed: this is the answer
  function landed(s, w, good) {
    if (w !== wave || !wave) return;                       // (a throw from a wave that's gone)
    // (the wagon's gang holds the shared times trainer: this pick isn't counted against its wave)
    if (w.kind === 'herd' && w.topic === 'times' && !mine.has((w.T.state.cur || {}).id)) { if (s.state === 'throw') { s.state = 'graze'; s.a.play('Idle'); } setTimeout(() => P.cancelLasso(), 0); return; }
    closeChart();
    if (hes) hes.answered();
    const T = w.T;
    let right = good, r = null, rec = null;
    const card = w.kind === 'card' ? w.card : null;
    if (card) {
      r = T.answer(s.n, good, s.cardId);
      if (r.stale) { s.state = 'graze'; return; }
      right = r.right;
      // the first try at each card is the answer, at the level the card was made at (a card answered after its help
      // came up is practice: no answer); its times fact goes to the chart
      if (r.first && !r.helped) {
        rec = recordAnswer(rider, right, { place: 'roundup', level: r.level });
        if (r.fact) recordFact(rider, r.fact.a, r.fact.b, right);
      }
    } else {
      // each rope of a herd is an answer at the herd's level; a multiple roped is its times fact, right (a stray roped
      // is no fact, and a multiple left unroped no answer)
      r = T.answer(s.n, good);
      rec = recordAnswer(rider, right, answerAt(w));
      const t = w.w.table;
      if (right && t && s.n % t === 0 && s.n / t <= 12) recordFact(rider, t, s.n / t, true);
    }
    upLevel(rec);
    if (rec && rec.badge) hud.toast(`You earned the ${rec.badge} badge!`, 'gold');

    if (right) {
      s.state = 'held'; s.label.visible = false; w.caught++;
      const hard = card ? card.rung || 1 : w.hard || 1;   // (the level's place on the ladder: 1 ...)
      const pay = PAY.catch + Math.floor((hard - 1) / ROUNDUP.payEvery);
      const e = earn(rider, pay);
      hud.buckle(countJob(rider, 'cattle').buckle, { delay: 700 });   // counted as it's roped: it heads to the corral by itself
      hint(null);
      if (w.kind === 'card') {
        hud.toast(`Roped the ${s.text}! ${w.card.done || `${w.card.text} = ${s.text}`}`, 'good');
        hideLine();
      } else {
        const ex = T.explain(s.n);
        hud.toast(`Roped the ${s.text}!${ex && ex.line ? '  ' + ex.line : ''}`, 'good');
      }
      if (e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 1600);
      hob.event('catch');
      if (card && canRead(card)) read.react('right', { topic: 'counting' });
      refresh();
    } else {
      w.misses++;
      s.a.play('Idle_HitReact1', { once: true });
      if (w.kind === 'card') {
        // the reason is written once, under the number line's picture (it is the line's own caption); the box under
        // the card just says it wasn't that one. (Without a picture, the box says the reason.)
        const ex = T.explain(w.card, s.n), pic = ex.numberLine && ex.numberLine.helper === 'count' && ex.numberLine.reason;
        hint({ say: 'Not me, partner', line: pic ? '' : ex.line });
        if (pic) showLine({ ...ex.numberLine });
        // (a rider who can't read yet hears the reason, in the browser's voice, after the "not that one" clip)
        if (readAloud(rider)) sayLine(pic || ex.line, { now: true, after: 900 });
      } else {
        const ex = T.explain(s.n);
        hint({ say: 'Not me, partner', line: ex.line, skip: ex.skip, anchor: ex.anchor, also: ex.also });
        chartHelp(s.n);
        if (readAloud(rider) && ex.line) sayLine(ex.line, { now: true, after: 300 });
      }
      hintT = ROUNDUP.hintFor;
      if (card && canRead(card)) read.react('wrong', { topic: 'counting' });
      hob.event('miss');
      refresh();
    }

    // what's next
    if (w.kind === 'card') {
      const next = r.waveDone ? null : T.card();   // (a right pick: the next card, made at the level the answer left)
      if (r.waveDone || !next) waveDone();
      else if (next.id !== w.card.id) {
        w.card = next; w.cardNo++;
        if (w.cardNo > w.cards) w.cards = w.cardNo;
        // the caught one is off to the corral; the others get the new card's answers (more wander in if needed)
        setTimeout(() => { if (wave === w && !w.done) { deal(w.card.targets, w.card.id); showCard(); if (hes) hes.restart(); } }, 900);
      } else if (hes) hes.restart();
    } else {
      // numbers due back now (2 to 4 answers after a miss): the tangled steer carrying it can be roped again
      for (const d of T.due()) {
        let back = herd.find((x) => x.n === d.n && (x.state === 'tangled' || x.state === 'graze'));
        if (back) { back.state = 'graze'; back.goal = null; }
        else { const at = spot(herd.filter(free).map((x) => x.home)); back = addSteer(at, { walkIn: true }); setNumber(back, d); }
      }
      if (w.caught >= w.goods) waveDone();
      else if (hes) hes.restart();
    }
    showCard();
  }

  function waveDone() {
    const w = wave; if (!w || w.done) return;
    w.done = true;
    endHelp();
    hint(null);
    const first = !(rider.flags && rider.flags.firstWave);
    rider.flags = rider.flags || {};
    if (first) rider.flags.firstWave = Date.now();
    const bonus = PAY.wave + (first ? PAY.firstDay : 0);
    rider.lockboxes = rider.lockboxes || [];
    const tier = boxTier(rider);
    rider.lockboxes.push({ tier, from: 'loot' });
    saveRider(rider);
    const e = earn(rider, bonus);
    hud.toast(`Wave done! +${bonus} gold${first ? ' (first-day bonus)' : ''} and a ${TIER_NAME[tier].toLowerCase()}`, 'gold');
    if (e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 2400);
    refresh();
    hob.event('waveDone', { gold: rider.gold, saddle: PRICES.saddle.plain });
    setTimeout(() => hob.event('boxWon'), 400);
    // the strays that are left put their numbers away and graze; a new bunch comes in a little later
    for (const s of herd) if (free(s)) { setNumber(s, null); s.state = 'idle'; }
    nextWaveT = ROUNDUP.nextWave;
    showCard();
  }

  // ── PICKS: a click (not a drag) ropes what is under or near it; a tap ropes the one nearest the finger ─────────
  let hintAt = -1e9;
  const offPick = I.onPick((p) => {
    if (RU.paused || !RU.near || !wave || wave.done) return;
    const t = p.touch ? R.pick(p.x, p.y) : R.click(p.x, p.y);
    if (t) RU.throwAt(t);
    else if (!p.touch && R.target && !P.lassoBusy && performance.now() - hintAt > 5000) { hintAt = performance.now(); hud.toast('Point at a steer to rope it (or press F)'); }
  });

  // ── EACH FRAME ─────────────────────────────────────────────────────────────────────────────────────────────────
  const camFwd = new THREE.Vector3(), lp = new THREE.Vector3();
  let wasNear = false, cardT = 0;
  const can = (t) => ropeable(t);
  RU.update = (dt) => {
    time += dt;
    const d = Math.hypot(P.position.x - PA.x, P.position.z - PA.z);
    RU.near = d < ROUNDUP.near;
    if (RU.near !== wasNear) {
      wasNear = RU.near;
      if (RU.near) { hob.event('arrive'); startHelp(); }
      else endHelp();
      showCard();
    } else if (!RU.near && (cardT -= dt) <= 0) { cardT = 1; showCard(); }   // (the distance on the travel card)
    if (hintT > 0 && (hintT -= dt) <= 0) hint(null);

    // a new wave, once the last one has had its moment
    if (nextWaveT > 0 && (nextWaveT -= dt) <= 0) {
      if (RU.near || (d < 120 && !othersWave())) newWave(); else nextWaveT = 0.5;
    }

    // F (or Space on foot) ropes the ringed one
    if (I.enabled && P.enabled && RU.near && (I.tap('KeyF') || (!P.onHorse && I.tap('Space')))) RU.throwAt(R.target);

    for (let i = herd.length - 1; i >= 0; i--) steerStep(herd[i], dt);

    // the number cards: over each steer, the same size on screen near or far, fading out past ~40 m
    const h = canvas.clientHeight || innerHeight, px = Math.max(ROUNDUP.labelPx[0], Math.min(ROUNDUP.labelPx[1], h * 0.06));
    const p5 = camera.projectionMatrix.elements[5];
    camera.getWorldDirection(camFwd);
    for (const s of herd) {
      const L = s.label;
      const show = s.n != null && (s.state === 'graze' || s.state === 'throw' || s.state === 'arrive') && !(wave && wave.done);
      const dist = Math.hypot(s.root.position.x - P.position.x, s.root.position.z - P.position.z);
      const fadeK = 1 - Math.max(0, Math.min(1, (dist - ROUNDUP.labelFull) / (ROUNDUP.labelGone - ROUNDUP.labelFull)));
      s.alpha += ((show ? fadeK : 0) - s.alpha) * Math.min(1, dt * 6);
      L.visible = s.alpha > 0.02;
      if (!L.visible) continue;
      lp.set(s.root.position.x, s.root.position.y + s.top, s.root.position.z);
      L.position.copy(lp);
      const depth = Math.max(0.5, lp.sub(camera.position).dot(camFwd));
      const hw = px * 2 * depth / (p5 * h);
      L.scale.set(hw * CARD_W / CARD_H, hw, 1);
      L.material.opacity = s.alpha;
      L.userData.depth = depth; L.userData.perPx = hw / px;
    }
    unstack(px, h, dt);
    if (offer && (offerT -= dt) <= 0) { offerT = 0.25; placeOffer(); }

    // the green ring round the one the lasso would go to
    R.update(dt, { targets: RU.near || d < 80 ? herd : [], player: P, can, hold: P.lassoBusy, busy: P.lasso.busy });
  };

  // Number cards that would overlap on screen (cattle bunched up far off) are stacked: the nearest keeps its place and
  // a farther one moves up just clear of it, so every number can be read. A card that would sit under the page's own
  // boxes up top (the rule card, the hint line under it, the chart's Peek offer) moves down below them instead, and
  // then stacks downward too. The lift eases in and out.
  const stackV = new THREE.Vector3(), rects = [];
  function unstack(px, h, dt) {
    const w = canvas.clientWidth || innerWidth, list = [];
    camera.updateMatrixWorld();
    for (const s of herd) {
      const L = s.label;
      if (!L.visible) { s.lift = 0; continue; }
      stackV.copy(L.position).project(camera);
      if (stackV.z > 1) continue;
      const cw = px * (CARD_W / CARD_H) * (L.userData.wide || 1);
      list.push({ s, x: (stackV.x + 1) / 2 * w, y: (1 - stackV.y) / 2 * h, cw, d: L.userData.depth });
    }
    list.sort((a, b) => a.d - b.d);
    rects.length = 0;
    const g = ROUNDUP.stackGap;
    const cv = canvas.getBoundingClientRect(), page = [];
    for (const e of [hud.ruleEl, hud.hintEl, offer && offer.el]) {
      if (!e || e.hidden || !e.offsetParent) continue;
      const q = e.getBoundingClientRect();
      if (q.height && q.width) page.push({ x0: q.left - cv.left, x1: q.right - cv.left, y0: q.top - cv.top, y1: q.bottom - cv.top });
    }
    const hits = (it, bottom, r) => !(it.x + it.cw / 2 + g <= r.x0 || it.x - it.cw / 2 - g >= r.x1) && !(bottom - px - g >= r.y1 || bottom + g <= r.y0);
    for (const it of list) {
      let bottom = it.y, down = false, moved = true, n = 0;
      while (moved && n++ < 12) {
        moved = false;
        for (const r of page) if (hits(it, bottom, r)) { bottom = r.y1 + g + px; down = true; moved = true; }
        for (const r of rects) if (hits(it, bottom, r)) { bottom = down ? r.y1 + g + px : r.y0 - g; moved = true; }
      }
      rects.push({ x0: it.x - it.cw / 2, x1: it.x + it.cw / 2, y0: bottom - px, y1: bottom });
      const want = (it.y - bottom) * it.s.label.userData.perPx;   // metres up
      it.s.lift = (it.s.lift || 0) + (want - (it.s.lift || 0)) * Math.min(1, dt * 10);
      it.s.label.position.y += it.s.lift;
    }
  }
  // The Peek button sits beside the rule card (to its right), clear of the "Not me, partner" line under the card and of
  // the far cattle's numbers just below it; on a narrow screen, under the card and the line
  let offerT = 0;
  function placeOffer() {
    const b = offer && offer.el; if (!b || !b.isConnected) return;
    const c = hud.ruleEl.getBoundingClientRect(); if (!c.width) return;
    const bw = b.offsetWidth, bh = b.offsetHeight;
    let x = c.right + 14 + bw / 2, y = c.top + (c.height - bh) / 2;
    if (x + bw / 2 > innerWidth - 10) { const j = hud.jobEl.getBoundingClientRect(); x = j.left + j.width / 2; y = j.bottom + 10; }
    b.style.left = Math.round(x) + 'px'; b.style.top = Math.round(y) + 'px';
  }

  let paused = false;
  Object.defineProperty(RU, 'paused', {
    get() { return paused; },
    set(on) {
      paused = !!on; R.visible = !paused;
      if (paused) endHelp(); else if (RU.near) startHelp();
    },
  });

  RU.newWave = (at = null) => { for (const s of herd) if (free(s)) s.state = 'graze'; newWave(at); };   // (at: a level id, or 'times' for a herd: dev and rigs)
  RU.start = () => { stock(); newWave(); };
  RU.trainer = () => trainer();   // the times trainer (shared with the wagon's gangs: main.js)
  RU.state = () => ({
    near: RU.near, topic: wave && wave.topic, rule: wave && (wave.kind === 'card' ? wave.card && wave.card.text : wave.w.rule),
    level: wave && (wave.kind === 'card' ? wave.card && wave.card.level : wave.level), finding: !!finding(),
    goods: wave && wave.goods, caught: wave && wave.caught, done: !!(wave && wave.done), herd: herd.length,
    numbers: herd.filter((s) => s.n != null && (s.state === 'graze' || s.state === 'arrive')).map((s) => ({ n: s.n, good: s.good })),
  });
  RU.dispose = () => {
    offPick(); endHelp(); hud.rule(null); hud.hint(null);
    for (const s of [...herd]) removeSteer(s);
    R.dispose();
  };
  return RU;
}
