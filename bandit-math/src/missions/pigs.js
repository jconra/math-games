// THE LOOSE-PIGS JOB: a few farm-pack pigs are loose in the farm's pig yard (src/farm.js), each with a sum floating over
// it ("−3 + 8"), readable from the saddle like the cattle's numbers. Along the yard's back fence stand two pens, a sign
// over each gate: NEGATIVE / POSITIVE for positive & negative sums, LESS THAN 10 / MORE THAN 10 (or another number) for
// the youngest riders' adding and taking-away sums (missions/pigmath.js: which, and how hard, come from the rider's skill
// model). Herd each pig into the pen with its answer:
//   the pigs run from you (on foot or on the horse): come at a pig from the side away from the pen you want, and it runs
//   ahead of you; near the back fence it makes for the nearest gate, and in it goes. Pigs jink a little as they run (a
//   bit more than cattle would), and one that has been chased a long while tires and runs straighter
//   the right pen: the pig trots in, its sum shows big and green with the answer; gold
//   the wrong pen: it trots straight back out, Old Hob says why in one line, and the number line shows the hop. No
//     penalty: nothing is taken off, and the pig can be herded again (it won't go back in that pen for a few seconds)
// When every pig is penned the batch is paid (like a round-up wave) and, a few seconds later, the pigs trot out of their
// pens with new sums and the signs change: nothing to click. Each pig penned counts toward the "Pigs penned" belt buckle
// (stats.jobs.pigs). Herding is the answer, and a running pig can bolt into a pen nobody meant, so a wrong pen isn't
// counted against the kid's record of right answers (recordAnswer is left alone here).
// For a rider who can't read yet (skill.js readAloud) the two pens' signs are read out (the browser's voice) on arriving
// at the yard and with each new batch.
//
//   const PG = makePigJob({ W, animals, farm, P, camera, canvas, rider, hud, hob, refresh })
//   PG.update(dt)       each frame, after P.update
//   PG.paused = true    a panel is open (the help is put away)
//   PG.near             true while the player is at the pig yard (the job's card is up)
//   PG.wants(at)        true when a point is at the pig yard (by its fence) rather than the sheep pasture (the sheep job
//                       steps aside)
//   PG.pigs             the pigs' records: { id, a (the animal), root, label, item (pigmath's pig), state, pen }
//   PG.batch            the batch showing (pigmath's: { mode, pens, pigs })
//   PG.ready            a promise: the pigs are in
//   PG.newBatch()       new sums now (dev)
//   PG.drive(pig, pen)  the pig trots into that pen as if herded there (dev and rigs)
//   PG.state()          for rigs
//   PG.dispose()
import * as THREE from 'three';
import { makeAnimal } from '../actors/animals.js';
import { makeCard, drawCard } from './sheep.js';
import { makePigBatch, pigsFor, judge } from './pigmath.js';
import { showNumberLine, ensureNumberLineStyles, watchHesitation } from '../ui/numberline.js';
import { showCountHelp } from '../ui/counthelp.js';
import { picture as addPicture } from '../math/adding.js';
import { picture as takePicture } from '../math/taking.js';
import { earn, countJob } from '../save.js';
import { readAloud } from '../math/skill.js';
import { speakLine } from '../ui/storeslip.js';

export const PIGS = {
  near: 24,              // the job's card shows within this many metres of the pig yard's middle ...
  yardReach: 8,          // ... and this close to the yard's fence, and nearer the yard's fence than the sheep pasture's (so
                         // the lane up the middle by the barn stays the sheep job's: the medicine reaches 34 m)
  byWife: { x: 6.8, z: 3.5, r: 5 },   // ... or this close to the farmer's wife, who asks for help with the pigs (where she
                         // stands in the farm's frame: STAND.wife in jobfolk.js), so her hello comes with the pigs' card
  scare: 6.5,            // a pig runs from a player on foot within this many metres ...
  scareHorse: 9,         // ... and from a rider within this many
  run: [1.0, 2.6],       // m/s a pig runs: just inside the scare distance, and with the player right on it (the Gallop
                         // clip at up to 2x: its feet keep to the ground)
  jink: 0.32,            // radians a running pig weaves either side of straight away (cattle don't weave at all) ...
  jinkSpeed: 2.3,        // ... this fast
  tire: 25,              // seconds of being chased after which a pig runs straight and a third slower (it never gets wilder)
  funnel: 5,             // within this many metres of the pens' fence a running pig bends toward the gate it is driven at ...
  mouth: 1.5,            // ... and goes in when it is this close to a gate's middle, sideways, and 1.6 m in front of it
  trot: 1.9,             // m/s a pig trots in and out of a pen (no one chasing it)
  noBack: 6,             // seconds a pig that came back out of the wrong pen won't go in that pen again
  pay: { pen: 2, batch: 6 },   // gold: each pig penned right, the whole batch
  next: 4,               // seconds after a batch is penned before the pigs come out with new sums
  show: 2.8,             // seconds a penned pig's sum shows big and green
  big: 1.35,             // ... this much bigger
  labelPx: [40, 58],     // a sum card's height on screen (pixels): about 5.5% of the screen, kept in this range (as the sheep's)
  labelFull: 40, labelGone: 60,   // the sums show in full within this many metres, and have faded out by this far
  stackGap: 6,           // pixels between two sum cards that would overlap on screen
  helpAfter: 15000,      // ms at the yard without a pig penned before the number line is offered for the nearest pig
  hintFor: 12,           // seconds a wrong pen's line stays under the card
  sign: { w: 2.8, h: 1.1, y: 1.95, post: 3.1 },   // the sign over each pen's gate: board size, its bottom's height, the posts (m):
                         // above the pigs' sums as seen from the yard, low enough to sit below the job card on a phone
};

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ── THE SIGNS OVER THE PEN GATES ─────────────────────────────────────────────────────────────────────────────────
// a weathered board with painted cream letters, on two posts either side of the gate; it faces the yard
const SW = 512, SH_ = 205;
function signTexture() {
  const cv = document.createElement('canvas'); cv.width = SW; cv.height = SH_;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex };
}
function paintSign({ cv, tex }, pen) {
  const c = cv.getContext('2d');
  c.fillStyle = '#5b3d24'; c.fillRect(0, 0, SW, SH_);
  for (let i = 0; i < 4; i++) {   // three boards with dark seams and a little grain
    c.fillStyle = ['#654429', '#5e3f25', '#6a472b', '#5a3b22'][i]; c.fillRect(0, i * SH_ / 4 + 2, SW, SH_ / 4 - 4);
    c.strokeStyle = 'rgba(30, 18, 8, 0.22)'; c.lineWidth = 2;
    for (let g = 0; g < 3; g++) { const y = i * SH_ / 4 + 10 + g * 14; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(SW * 0.3, y + 4, SW * 0.6, y - 4, SW, y + 2); c.stroke(); }
  }
  c.strokeStyle = '#2b1a0c'; c.lineWidth = 10; c.strokeRect(5, 5, SW - 10, SH_ - 10);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#f4e6c4';
  c.shadowColor = 'rgba(0, 0, 0, 0.45)'; c.shadowOffsetY = 3; c.shadowBlur = 2;
  const word = pen.label, sub = pen.sub;
  let size = sub ? 100 : 150;
  c.font = `800 ${size}px Bitter, Georgia, serif`;
  while (c.measureText(word).width > SW - 50 && size > 40) { size -= 6; c.font = `800 ${size}px Bitter, Georgia, serif`; }
  c.fillText(word, SW / 2, sub ? SH_ * 0.38 : SH_ / 2 + 6);
  // the small line under it ("below zero"), big enough to read from the saddle
  if (sub) {
    let ss = 58; c.font = `700 ${ss}px Bitter, Georgia, serif`;
    while (c.measureText(sub).width > SW - 50 && ss > 30) { ss -= 4; c.font = `700 ${ss}px Bitter, Georgia, serif`; }
    c.fillStyle = '#f0dcb0'; c.fillText(sub, SW / 2, SH_ * 0.78);
  }
  c.shadowColor = 'transparent';
  tex.needsUpdate = true;
}

export function makePigJob({ W, animals, farm, P, camera, canvas, rider, hud, hob, refresh = () => {}, scene = W.scene }) {
  const L = farm.layout, Y = L.yard, pens = L.pens;
  ensureNumberLineStyles();
  const fontReady = (document.fonts && document.fonts.load) ? document.fonts.load('800 108px Bitter').catch(() => null) : Promise.resolve();
  // where a loose pig may go: the yard, short of the pens' front fence (a pig only gets past that through a gate)
  const PENS_FRONT = pens[0].box.z1, yb = Y.box;
  const loose = {
    contains: (x, z) => { const p = L.local(x, z); return p.x > yb.x0 + 0.7 && p.x < yb.x1 - 0.7 && p.z > PENS_FRONT + 0.6 && p.z < yb.z1 - 0.7; },
    random: (rand = Math.random) => L.at(yb.x0 + 1.5 + rand() * (yb.x1 - yb.x0 - 3), PENS_FRONT + 2 + rand() * (yb.z1 - PENS_FRONT - 3.5)),
  };
  const penArea = pens.map((pn) => L.area(pn, 0.9));
  const sheepAt = L.sheep;

  const pigs = [];
  const PG = { pigs, near: false, batch: null };
  let batch = null, nextT = -1, hintT = 0, time = 0, disposed = false, penned = 0, batches = 0;
  let hes = null, nl = null;

  // ── THE SIGNS ──────────────────────────────────────────────────────────────────────────────────────────────────
  const signs = new THREE.Group(); signs.name = 'pig-pen-signs'; scene.add(signs);
  const S = PIGS.sign, wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 });
  const postG = new THREE.BoxGeometry(0.16, S.post, 0.16).translate(0, S.post / 2, 0), boardG = new THREE.BoxGeometry(S.w, S.h, 0.08);
  const signTex = pens.map((pn) => {
    const g = pn.gate, T = signTexture();
    // the painted face lit a little from within, so the letters read in the shade of evening as well as at noon
    const face = new THREE.MeshStandardMaterial({ map: T.tex, roughness: 0.85, emissive: 0xffffff, emissiveMap: T.tex, emissiveIntensity: 0.28 });
    const grp = new THREE.Group(); grp.position.set(g.x, W.heightAt(g.x, g.z) - 0.1, g.z); grp.rotation.y = g.rot;
    const half = g.width / 2 + 0.22;
    for (const sx of [-1, 1]) { const m = new THREE.Mesh(postG, wood); m.position.set(sx * half, 0, -0.1); m.castShadow = true; grp.add(m); }
    // (a box's faces: +x -x +y -y +z -z; the painted one faces the yard, +z here)
    const board = new THREE.Mesh(boardG, [wood, wood, wood, wood, face, wood]);
    board.position.set(0, S.y + S.h / 2, -0.02); board.castShadow = true; board.name = 'pig-pen-sign';
    grp.add(board); signs.add(grp);
    return { ...T, face, board };
  });
  function paintSigns() {
    if (!batch) return;
    batch.pens.forEach((pn, i) => paintSign(signTex[i], pn));
    fontReady.then(() => { if (!disposed && batch) batch.pens.forEach((pn, i) => paintSign(signTex[i], pn)); });
  }

  // ── THE PIGS ───────────────────────────────────────────────────────────────────────────────────────────────────
  const shadows = !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  PG.ready = animals.need('pig').then(() => {
    if (disposed) return;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = makeAnimal(animals, 'pig', { shadows });
      let p = loose.random();
      for (let k = 0; k < 30 && (W.blocked(p.x, p.z) || pigs.some((o) => Math.hypot(o.root.position.x - p.x, o.root.position.z - p.z) < 2.4)); k++) p = loose.random();
      a.root.position.set(p.x, W.heightAt(p.x, p.z), p.z); a.root.rotation.y = Math.random() * Math.PI * 2;
      scene.add(a.root);
      const g = { id: i + 1, a, root: a.root, label: makeCard(), item: null, state: 'loose', pen: -1, v: 0, alpha: 0, lift: 0, showT: 0,
        chased: 0, phase: Math.random() * 6.28, legs: null, noPen: -1, noPenT: 0, wait: 0, top: a.tall + 0.35,
        w: farm.wanderer(a, loose, { rest: [2, 7] }) };
      g.label.visible = false; scene.add(g.label);
      pigs.push(g);
    }
    newBatch({ first: true });
  }).catch((e) => console.warn('pigs: the pigs could not load', e));

  function card(g) {
    if (!g.item) return;
    const done = g.state === 'penned' || (g.state === 'enter' && g.right);
    const o = { top: null, main: done ? `${g.item.text} = ${g.item.answer < 0 ? '−' + -g.item.answer : g.item.answer}` : g.item.text, cured: done };
    drawCard(g.label, o);
    fontReady.then(() => { g.label.userData.key = null; drawCard(g.label, o); });
  }

  // ── A BATCH ────────────────────────────────────────────────────────────────────────────────────────────────────
  function newBatch({ first = false } = {}) {
    endHelp(); hint(null);
    const { map, q } = pigsFor(rider, { last: batch ? batch.map : null });
    batch = makePigBatch(rider, { size: pigs.length, map, step: q.step });
    PG.batch = batch; penned = 0; nextT = -1; batches++;
    paintSigns();
    pigs.forEach((g, i) => {
      g.item = batch.pigs[i]; g.right = false; g.showT = 0; g.chased = 0; g.noPen = -1;
      // pigs in a pen (or on their way in or out of one) trot out into the yard, one after another through each gate;
      // loose ones just get new sums
      const at = g.root.position;
      if (!first && g.state !== 'release' && (g.state === 'penned' || !loose.contains(at.x, at.z))) {
        const pi = g.pen >= 0 ? g.pen : nearestPen(at), gt = pens[pi].gate;
        g.state = 'release'; g.pen = pi; g.wait = 0.6 * pigs.filter((o, k) => k < i && o.state === 'release' && o.pen === pi).length;
        g.legs = [gt.in, gt.out, loose.random()];
      } else if (g.state !== 'release') { g.state = 'loose'; g.pen = -1; }
      card(g);
    });
    showCard();
    if (PG.near) { startHelp(); if (!first) sayPens(); }
  }
  // (a rider who can't read yet, skill.js readAloud: the two pens' signs read out, in the browser's voice, on arriving
  // at the yard and with each new batch)
  function sayPens() {
    if (!batch || !readAloud(rider)) return;
    speakLine(`Pen each pig by its answer: ${batch.pens.map((pn) => pn.label.toLowerCase()).join(', or ')}.`);
  }
  function nearestPen(at) {
    let bi = 0, bd = Infinity;
    pens.forEach((pn, i) => { const d = Math.hypot(pn.x - at.x, pn.z - at.z); if (d < bd) { bd = d; bi = i; } });
    return bi;
  }
  const left = () => pigs.filter((g) => g.item && g.state !== 'penned' && !(g.state === 'enter' && g.right)).length;
  function showCard() {
    if (!PG.near || !batch) return;
    if (batch.done) { hud.rule({ main: 'All penned!', sub: 'New sums coming up…' }); return; }
    const n = left();
    // (on a phone the card is kept short, so it doesn't cover the pens' signs: the how-to line goes once a pig is in)
    const short = innerWidth < 480 && (penned > 0 || batches > 1);
    hud.rule({
      main: innerWidth < 480 ? 'Pen each pig by answer' : 'Pen each pig by its answer',
      sub: `${short ? '' : 'They run from you: drive them in from behind · '}${penned ? `${penned} penned · ` : ''}${n} to go`,
      buttons: [{ label: 'Show me', onClick: () => { const g = nearestLoose(); if (g) lineFor(g, null, false); } }],
    });
  }
  function nearestLoose() {
    let best = null, bd = Infinity;
    for (const g of pigs) {
      if (!g.item || g.state === 'penned' || g.right) continue;
      const d = Math.hypot(g.root.position.x - P.position.x, g.root.position.z - P.position.z);
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }

  // ── HELP ───────────────────────────────────────────────────────────────────────────────────────────────────────
  function hint(o) { hud.hint(o); hintT = o ? PIGS.hintFor : 0; }
  function lineFor(g, picked, reveal) {
    const p = g.item.parts;
    if (nl) nl.remove();
    nl = batch && batch.mode === 'sizes' ? showCountHelp(hud.helpEl, sizesPicture(p, reveal))
      : showNumberLine(hud.helpEl, { start: p.start, change: p.change, op: p.op, term: p.term, reveal, picked: picked ?? undefined, theme: 'dark' });
  }
  // the youngest riders' pigs (LESS THAN / MORE THAN pens): the adding or taking-away picture (ten-frames and the hops
  // on a number line, src/ui/counthelp.js), with the pens' number named on the line, rather than the positive & negative
  // line and its "negative" side
  function sizesPicture(p, reveal) {
    const add = p.op !== '-', pic = (add ? addPicture : takePicture)({ parts: { shape: add ? 'sum' : 'diff', a: p.start, b: p.term } });
    const L = pic.line, split = batch.split;
    return { ...pic, reveal, line: { ...L, lo: Math.max(0, Math.min(L.lo, split - 1)), hi: Math.max(L.hi, split + 1), stops: [...(L.stops || []), split] } };
  }
  function startHelp() {
    if (!batch || batch.done || PG.paused || hes) return;
    hes = watchHesitation({ after: PIGS.helpAfter, onShow: () => { const g = nearestLoose(); if (g && PG.near) lineFor(g, null, false); } });
  }
  function endHelp() {
    if (hes) { hes.cancel(); hes = null; }
    if (nl) { nl.remove(); nl = null; }
  }

  // ── INTO A PEN: the answer ─────────────────────────────────────────────────────────────────────────────────────
  // the pig has come through pen i's gate
  function arrive(g, i) {
    const j = judge(batch, g.item, i);
    if (j.right) {
      g.right = true; g.showT = PIGS.show;
      penned++;
      card(g);
      const e = earn(rider, PIGS.pay.pen);
      hud.buckle(countJob(rider, 'pigs').buckle, { delay: 800 });
      hud.toast(`Penned! ${g.item.text} = ${g.item.answer < 0 ? '−' + -g.item.answer : g.item.answer}  +${PIGS.pay.pen} gold`, 'good');
      hint(null);
      if (nl) { nl.remove(); nl = null; }
      if (e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 1600);
      hob.event('pigPenned');
      refresh();
      if (!left()) batchDone();
      else { showCard(); if (hes) hes.restart(); }
      return;
    }
    // the wrong pen: straight back out (to the side away from the player), the why, and the hop on the number line
    const pn = pens[i], gt = pn.gate;
    const ox = Math.sin(gt.rot), oz = Math.cos(gt.rot), side = Math.sign((P.position.x - gt.out.x) * oz - (P.position.z - gt.out.z) * ox) || 1;
    const away = { x: gt.out.x - oz * side * 2.5 + ox * 1.5, z: gt.out.z + ox * side * 2.5 + oz * 1.5 };
    g.state = 'back'; g.legs = [{ x: gt.x - ox * 1.2, z: gt.z - oz * 1.2 }, gt.out, loose.contains(away.x, away.z) ? away : gt.out];
    g.noPen = i; g.noPenT = PIGS.noBack;
    // (a pig that bolts into a pen after the player has ridden off comes back out quietly: no why, no number line
    // left over on another job's screen)
    if (!PG.near) return;
    // (the why is Hob's line, said at once; the box under the card just names the pen, the number line shows the hop.
    // On a narrow screen Hob's caption would sit on top of the number line, so the why goes in the box instead)
    const narrow = innerWidth < 700;
    hint({ say: `Not the ${batch.pens[i].label} pen`, line: narrow ? j.line : '' });
    lineFor(g, j.picked, true);
    if (!narrow) hob.event('pigWrong', { line: j.line });
    if (hes) hes.restart();
  }

  function batchDone() {
    batch.done = true;
    endHelp();
    const e = earn(rider, PIGS.pay.batch);
    setTimeout(() => { if (!disposed) hud.toast(`All penned! +${PIGS.pay.batch} gold`, 'gold'); }, 1300);
    if (e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 3000);
    hob.event('pigsDone');
    refresh();
    nextT = PIGS.next;
    showCard();
  }

  // ── MOVING A PIG ───────────────────────────────────────────────────────────────────────────────────────────────
  const TURNS = [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.0, -2.0, 2.6, -2.6];
  // a step along heading h (or the nearest way round what blocks it, trying the side `pref` first) at v m/s; the pig
  // turns toward the way it goes. ok(x, z): where it may stand. Returns the distance moved
  function stepTo(g, h, v, dt, ok, pref = 1) {
    const r = g.root.position, step = v * dt;
    if (step <= 0) return 0;
    for (const t0 of TURNS) {
      const hh = h + t0 * pref, nx = r.x + Math.sin(hh) * step, nz = r.z + Math.cos(hh) * step;
      if (W.blocked(nx, nz) || !ok(nx, nz)) continue;
      // (a look a little further ahead too, so it turns before its snout is in the fence)
      if (W.blocked(nx + Math.sin(hh) * 0.6, nz + Math.cos(hh) * 0.6)) continue;
      r.set(nx, W.heightAt(nx, nz), nz);
      g.root.rotation.y += wrapA(hh - g.root.rotation.y) * Math.min(1, 6 * dt);
      return step;
    }
    return 0;
  }
  // along a few points (a path through a gate); returns true at the last one
  function follow(g, v, dt) {
    const pt = g.legs[0], r = g.root.position, dx = pt.x - r.x, dz = pt.z - r.z, d = Math.hypot(dx, dz);
    if (d < 0.45) { g.legs.shift(); return !g.legs.length; }
    const h = Math.atan2(dx, dz), step = Math.min(d, v * dt), nx = r.x + Math.sin(h) * step, nz = r.z + Math.cos(h) * step;
    r.set(nx, W.heightAt(nx, nz), nz);
    g.root.rotation.y += wrapA(h - g.root.rotation.y) * Math.min(1, 7 * dt);
    g.v = step / dt;
    return false;
  }

  // a running pig: away from the player, weaving a little, bending toward the nearest pen gate near the pens' fence
  function flee(g, dt, d, R) {
    const r = g.root.position, k = 1 - d / R;                 // 0 at the edge of the scare distance, 1 right on it
    const tired = Math.min(1, g.chased / PIGS.tire);
    let h = Math.atan2(r.x - P.position.x, r.z - P.position.z);
    // the gate it is being driven at: of the gates it is in front of (within the funnel), the one most nearly straight
    // on from the player through the pig (pig between the player and that gate), so the kid aims a pig at a pen by
    // where they walk, not by which gate it happens to run past. driven: 0 (not at all) .. 1 (squarely)
    const ax = r.x - P.position.x, az = r.z - P.position.z, al = Math.hypot(ax, az) || 1;
    let best = -1, driven = 0, across = Infinity, front = Infinity;
    pens.forEach((pn, i) => {
      if (i === g.noPen) return;
      const gt = pn.gate, ox = Math.sin(gt.rot), oz = Math.cos(gt.rot);
      const along = (r.x - gt.x) * ox + (r.z - gt.z) * oz;
      if (along < -0.2 || along > PIGS.funnel) return;
      const gx = gt.x - r.x, gz = gt.z - r.z, gl = Math.hypot(gx, gz) || 1;
      const d = Math.max(0, Math.min(1, ((gx * ax + gz * az) / (gl * al) - 0.2) / 0.5));
      if (d > driven) { best = i; driven = d; across = Math.abs((r.x - gt.x) * oz - (r.z - gt.z) * ox); front = along; }
    });
    const jinkK = Math.min(1, Math.max(0, (front - 1.5) / 3));   // (no weaving at a gate's mouth: going in should be easy)
    h += Math.sin(time * PIGS.jinkSpeed + g.phase) * PIGS.jink * (1 - tired) * jinkK;
    if (best >= 0) {
      const gt = pens[best].gate, ox = Math.sin(gt.rot), oz = Math.cos(gt.rot);
      const inward = -(Math.sin(h) * ox + Math.cos(h) * oz);      // how much its run already points into the pens
      if (inward > 0.15) {
        // bend toward the gate's middle, more the nearer the fence and the more squarely it is driven (a gradual pull)
        const toGate = Math.atan2(gt.x - ox * 0.5 - r.x, gt.z - oz * 0.5 - r.z);
        const w = Math.min(0.85, (1 - front / PIGS.funnel) * 1.1) * Math.min(1, inward * 1.6) * driven;
        h += wrapA(toGate - h) * w;
        if (across < PIGS.mouth && front < 1.6 && driven > 0.3) { into(g, best); return; }
      }
    }
    const want = (PIGS.run[0] + (PIGS.run[1] - PIGS.run[0]) * k * k) * (1 - 0.33 * tired);
    g.v += (want - g.v) * Math.min(1, 5 * dt);
    // (it slips round the side of the player away from where the player is heading, if it has to)
    const pref = Math.sign(wrapA(h - P.heading)) || 1;
    const moved = stepTo(g, h, g.v, dt, loose.contains, pref);
    g.v = moved / dt || 0;
  }
  function into(g, i) {
    const gt = pens[i].gate, spot = penArea[i].random();
    // (lined up just in front of the gap first, so it goes in straight, then just inside, then to a spot in the pen)
    g.state = 'enter'; g.pen = i; g.legs = [{ x: gt.x + Math.sin(gt.rot) * 0.6, z: gt.z + Math.cos(gt.rot) * 0.6 }, { x: gt.x - Math.sin(gt.rot) * 0.8, z: gt.z - Math.cos(gt.rot) * 0.8 }, spot];
    g.judged = false; g.w.goal = null;
  }

  function pigStep(g, dt) {
    const a = g.a, r = g.root.position;
    if (g.noPenT > 0 && (g.noPenT -= dt) <= 0) g.noPen = -1;
    switch (g.state) {
      case 'loose': {
        const d = Math.hypot(r.x - P.position.x, r.z - P.position.z), R = P.onHorse ? PIGS.scareHorse : PIGS.scare;
        if (d < R && batch && !batch.done && !PG.paused) {
          if (g.w.goal) g.w.goal = null;
          g.chased += dt; g.running = true;
          flee(g, dt, d, R);
          a.pace(g.v); a.update(dt);
        } else if (g.running) {
          // slowing to a stop, then pottering again
          g.v = Math.max(0, g.v - 2.5 * dt);
          const moved = stepTo(g, g.root.rotation.y, g.v, dt, loose.contains);
          g.v = moved / dt || 0;
          a.pace(g.v); a.update(dt);
          if (g.v < 0.05) { g.running = false; g.w.t = 1 + Math.random() * 3; a.play('Idle', { fade: 0.3 }); }
        } else farm.wanderStep(g.w, dt);
        break;
      }
      case 'enter': {
        const done = follow(g, PIGS.trot, dt);
        // the answer comes once it is through the gap
        if (!g.judged && g.legs.length <= 1) { g.judged = true; arrive(g, g.pen); }
        if (g.state !== 'enter') break;
        if (done) {
          g.state = 'penned'; g.v = 0; g.w.area = penArea[g.pen]; g.w.goal = null; g.w.t = 2;
          a.play('Jump', { once: true, fade: 0.1 }); g.hop = 1.2;
        } else a.pace(g.v);
        a.update(dt);
        break;
      }
      case 'back': case 'release': {
        if (g.wait > 0) { g.wait -= dt; a.pace(0); a.update(dt); break; }
        if (follow(g, PIGS.trot, dt)) {
          g.state = 'loose'; g.pen = -1; g.v = 0; g.running = false; g.w.area = loose; g.w.goal = null; g.w.t = 1.5;
          a.play('Idle', { fade: 0.3 });
        } else a.pace(g.v);
        a.update(dt);
        break;
      }
      case 'penned':
        if (g.hop > 0) { g.hop -= dt; a.update(dt); if (g.hop <= 0) a.play('Idle', { fade: 0.3 }); }
        else farm.wanderStep(g.w, dt);
        break;
      default: a.update(dt);
    }
  }
  // loose pigs keep a little apart (a pig is 1.8 m long): each pair too close is pushed apart, where the yard allows
  function spread() {
    for (let i = 0; i < pigs.length; i++) for (let j = i + 1; j < pigs.length; j++) {
      const A = pigs[i], B = pigs[j];
      if (A.state !== 'loose' || B.state !== 'loose') continue;
      const pa = A.root.position, pb = B.root.position, dx = pb.x - pa.x, dz = pb.z - pa.z, d = Math.hypot(dx, dz);
      if (d > 1.3 || d < 1e-4) continue;
      const push = (1.3 - d) / 2, ux = dx / d, uz = dz / d;
      for (const [p, s] of [[pa, -1], [pb, 1]]) {
        const nx = p.x + ux * push * s, nz = p.z + uz * push * s;
        if (!W.blocked(nx, nz) && loose.contains(nx, nz)) p.set(nx, W.heightAt(nx, nz), nz);
      }
    }
  }

  // ── EACH FRAME ─────────────────────────────────────────────────────────────────────────────────────────────────
  const yardAt = { x: Y.x, z: Y.z };
  // how far a point is from a fenced spot's edge (0 inside it), in the farm's frame
  const fromEdge = (p, b) => Math.hypot(Math.max(0, b.x0 - p.x, p.x - b.x1), Math.max(0, b.z0 - p.z, p.z - b.z1));
  // Outside the yard's fence, the job you are looking toward has it: a rider by the yard's corner watching the sheep
  // keeps the sheep's sums (it swaps only once the other one is clearly more ahead, so glancing about doesn't flicker it)
  let lookingAtSheep = false;
  const wantDir = new THREE.Vector3();
  function facing(at) {
    camera.getWorldDirection(wantDir);
    const h = Math.atan2(wantDir.x, wantDir.z);
    const off = (to) => Math.abs(wrapA(Math.atan2(to.x - at.x, to.z - at.z) - h));
    const s = off(sheepAt), y = off(yardAt);
    if (s < y - 0.35) lookingAtSheep = true; else if (y < s - 0.35) lookingAtSheep = false;
    return lookingAtSheep;
  }
  PG.wants = (at) => {
    const p = L.local(at.x, at.z), bw = PIGS.byWife;
    if (Math.hypot(p.x - bw.x, p.z - bw.z) < bw.r) return true;
    if (Math.hypot(at.x - yardAt.x, at.z - yardAt.z) >= PIGS.near) return false;
    const dy = fromEdge(p, Y.box);
    if (!(dy < PIGS.yardReach && dy < fromEdge(p, sheepAt.box))) return false;
    return dy === 0 || !facing(at);
  };
  const camFwd = new THREE.Vector3(), lp = new THREE.Vector3();
  let wasNear = false;
  PG.update = (dt) => {
    time += dt;
    PG.near = PG.wants(P.position);
    if (PG.near !== wasNear) {
      wasNear = PG.near;
      if (PG.near) { hob.event('pigsArrive'); startHelp(); showCard(); sayPens(); }
      else { endHelp(); hud.rule(null); hud.hint(null); hintT = 0; }   // (its own card down: the chosen job's where-it-is card, or the round-up's or the sheep's, comes back by itself)
    }
    if (hintT > 0 && (hintT -= dt) <= 0) hud.hint(null);
    if (nextT > 0 && (nextT -= dt) <= 0) newBatch();
    const d = Math.hypot(P.position.x - yardAt.x, P.position.z - yardAt.z);
    if (d > 220) return;
    for (const g of pigs) pigStep(g, dt);
    spread();
    for (const g of pigs) if (g.showT > 0) g.showT -= dt;

    // the sum cards: over each pig, the same size on screen near or far (as the sheep's)
    const h = canvas.clientHeight || innerHeight, px = Math.max(PIGS.labelPx[0], Math.min(PIGS.labelPx[1], h * 0.055));
    const p5 = camera.projectionMatrix.elements[5];
    camera.getWorldDirection(camFwd);
    for (const g of pigs) {
      const Lb = g.label, inPen = g.state === 'penned' || (g.state === 'enter' && g.right);
      const shownDone = inPen && g.showT > 0;
      // (only at the pig yard: from the sheep pasture next door the pigs' sums would mix with the sheep's)
      const show = !!g.item && (!inPen || shownDone) && !(batch && batch.done && !shownDone) && !PG.paused && g.wait <= 0 && PG.near;
      const dist = Math.hypot(g.root.position.x - P.position.x, g.root.position.z - P.position.z);
      const fadeK = 1 - Math.max(0, Math.min(1, (dist - PIGS.labelFull) / (PIGS.labelGone - PIGS.labelFull)));
      const want = show ? fadeK * (shownDone ? Math.min(1, g.showT / 0.6) : 1) : 0;
      g.alpha += (want - g.alpha) * Math.min(1, dt * 6);
      Lb.visible = g.alpha > 0.02;
      if (!Lb.visible) continue;
      lp.set(g.root.position.x, g.root.position.y + g.top, g.root.position.z);
      Lb.position.copy(lp);
      const depth = Math.max(0.5, lp.sub(camera.position).dot(camFwd));
      const k = shownDone ? PIGS.big : 1, hw = px * k * 2 * depth / (p5 * h) * Lb.userData.tall;
      Lb.scale.set(hw * Lb.userData.aspect, hw, 1);
      Lb.material.opacity = g.alpha;
      Lb.userData.depth = depth; Lb.userData.perPx = hw / (px * k * Lb.userData.tall);
    }
    unstack(h);
  };

  // Sum cards that would overlap on screen are stacked: the nearest keeps its place, a farther one moves just clear of it
  // (up, or down when that is the shorter way, or when up would put it under the job card), and none covers a pen's sign
  const sv = new THREE.Vector3(), rects = [];
  const SIGN_CORNERS = [[-S.w / 2, -S.h / 2], [S.w / 2, -S.h / 2], [-S.w / 2, S.h / 2], [S.w / 2, S.h / 2]];
  let roof = 0, roofT = 0;
  function unstack(h) {
    const w = canvas.clientWidth || innerWidth, list = [];
    if ((roofT -= 1) <= 0) { roofT = 15; const r = hud.jobEl && hud.jobEl.getBoundingClientRect(); roof = r && r.height ? r.bottom + 4 : 0; }
    camera.updateMatrixWorld();
    for (const g of pigs) {
      const Lb = g.label;
      if (!Lb.visible) { g.lift = 0; continue; }
      sv.copy(Lb.position).project(camera);
      if (sv.z > 1) continue;
      const ph = Lb.scale.y / Lb.userData.perPx;
      list.push({ g, x: (sv.x + 1) / 2 * w, y: (1 - sv.y) / 2 * h, cw: ph * Lb.userData.aspect, ch: ph, d: Lb.userData.depth });
    }
    list.sort((a, b) => a.d - b.d);
    rects.length = 0;
    // the pens' signs count as cards already placed, so a sum card moves up clear of a sign rather than over it
    for (const sg of signTex) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, behind = false;
      for (const [cx, cy] of SIGN_CORNERS) {
        sv.set(cx, cy, 0).applyMatrix4(sg.board.matrixWorld).project(camera);
        if (sv.z > 1) { behind = true; break; }
        const x = (sv.x + 1) / 2 * w, y = (1 - sv.y) / 2 * h;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      if (!behind && x1 > 0 && x0 < w && y1 > 0 && y0 < h) rects.push({ x0, x1, y0, y1 });
    }
    const gap = PIGS.stackGap;
    for (const it of list) {
      const clear = (dir) => {
        let bottom = it.y, moved = true, n = 0;
        while (moved && n++ < 12) {
          moved = false;
          for (const r of rects) {
            if (it.x + it.cw / 2 + gap <= r.x0 || it.x - it.cw / 2 - gap >= r.x1) continue;
            if (bottom - it.ch - gap >= r.y1 || bottom + gap <= r.y0) continue;
            bottom = dir < 0 ? r.y0 - gap : r.y1 + gap + it.ch; moved = true;
          }
        }
        return bottom;
      };
      // (up or down, whichever moves it less: a card pushed far up over a sign could seem to be another pig's)
      let bottom = clear(-1);
      if (bottom < it.y) { const down = clear(1); if (down - it.y < it.y - bottom || (bottom - it.ch < roof && Math.abs(it.x - w / 2) < w * 0.32)) bottom = down; }
      rects.push({ x0: it.x - it.cw / 2, x1: it.x + it.cw / 2, y0: bottom - it.ch, y1: bottom });
      const wantLift = (it.y - bottom) * it.g.label.userData.perPx;
      it.g.lift += (wantLift - it.g.lift) * 0.25;
      it.g.label.position.y += it.g.lift;
    }
  }

  let paused = false;
  Object.defineProperty(PG, 'paused', {
    get() { return paused; },
    set(on) { paused = !!on; if (paused) endHelp(); else if (PG.near) startHelp(); },
  });
  PG.newBatch = () => newBatch();
  PG.drive = (g, i) => { if (g && g.state === 'loose' && pens[i]) { const gt = pens[i].gate; g.root.position.set(gt.out.x, W.heightAt(gt.out.x, gt.out.z), gt.out.z); into(g, i); return true; } return false; };
  PG.state = () => ({
    near: PG.near, mode: batch && batch.mode, level: batch && batch.level, done: !!(batch && batch.done), penned, left: batch ? left() : 0,
    pens: batch ? batch.pens.map((p, i) => ({ label: p.label, value: p.value, gate: { x: +pens[i].gate.x.toFixed(2), z: +pens[i].gate.z.toFixed(2) }, out: pens[i].gate.out })) : [],
    pigs: pigs.map((g) => {
      const act = g.a.actions[g.a.clip];
      return { id: g.id, x: +g.root.position.x.toFixed(2), z: +g.root.position.z.toFixed(2), state: g.state, pen: g.pen, right: !!g.right,
        text: g.item && g.item.text, answer: g.item && g.item.answer, goes: g.item && g.item.pen, v: +g.v.toFixed(3), clip: g.a.clip,
        clipSpeed: act ? +act.getEffectiveTimeScale().toFixed(3) : 0, stride: g.a.stride[g.a.clip] || null, label: g.label.visible };
    }),
  });
  PG.dispose = () => {
    disposed = true;
    endHelp();
    if (PG.near) { hud.rule(null); hud.hint(null); }
    for (const g of pigs) { g.label.removeFromParent(); g.label.material.dispose(); g.label.userData.tex.dispose(); g.a.dispose(); }
    pigs.length = 0;
    signs.removeFromParent();
    postG.dispose(); boardG.dispose(); wood.dispose();
    for (const s of signTex) { s.tex.dispose(); s.face.dispose(); }
  };
  return PG;
}
