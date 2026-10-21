// THE SICK-SHEEP JOB: a flock of six grazes in the farm's sheep pasture (src/farm.js), each with a sum floating over it,
// readable from the saddle like the cattle's numbers (the same size on screen near or far). One or two of the sheep are
// sick, and they look exactly like the others: the only tell is that their sum is wrong, with a mistake kids really make
// (missions/sheepmath.js: a times fact a row off, a sign slip, a step of solving for x done the wrong way or to one side
// only). Spotting it and fixing it is the job:
//   aim with the green ring (point at a sheep, or it settles on the one ahead), press F (or click it, or the Rope button
//   on a touch screen): two or three medicine bottles come up, each a fix ("should be 56"); pick one (a click, or 1 2 3)
//   the cure: the sheep hops, perks up, and her sum shows big and right for a moment; gold
//   a wrong bottle on a sick sheep: it is crossed out, one plain line says why, and the helper for the topic shows (the
//     times chart, the number line, the golden rule of solving); pick again. With one bottle left the cure goes in by
//     itself (no one-choice button), for less gold
//   a bottle for a healthy sheep: Old Hob says she's fine and why her sum is right. No penalty, nothing taken off
// When every sick sheep is healed the flock is paid (like a round-up wave), and after a few seconds the same flock shows
// a new set of sums: nothing to click. Each flock's kind of math and how hard come from the rider's skill model
// (sheepmath.js flockFor: counting, adding and taking away for a young rider; times tables, dividing, positive & negative
// and solving for x for an older one), and the first bottle given to each sick sheep goes back to it (a travel job: no
// time). Each sheep healed counts toward the "Sheep healed" belt buckle (stats.jobs.sheep).
// For a rider who can't read yet (skill.js readAloud) a sheep's sum is read out (the browser's voice) as her bottles
// come up: "5 plus 1 equals 6. Is that right?"
//
//   const SH = makeSheepJob({ W, animals, farm, P, I, camera, canvas, rider, hud, hob, refresh, defer })
//     defer(at): true while another farm job has the player (the pig yard, say): the sheep job's card and help step aside
//   SH.update(dt)       each frame, after P.update
//   SH.paused = true    a panel is open (the bottles and the help are put away, the ring hidden)
//   SH.near             true while the player is at the sheep pasture (the job's card is up)
//   SH.sheep            the flock's records: { id, a (the animal), root, label, item (sheepmath's), state, healed }
//   SH.ring             the target ring (src/targetring.js)
//   SH.ready            a promise: the sheep are in
//   SH.open(sheep)      bring up the bottles for this sheep (as F does on the ringed one)
//   SH.give(i)          give bottle i of the open picker (as a click or the 1-3 keys do)
//   SH.newFlock({ sick })   a new set of sums now (dev; sick: how many are sick, else 1 or 2)
//   SH.state()          for rigs
//   SH.dispose()
//   makeCard(), drawCard(sprite, { top, main, cured })   the sum card over an animal (for another job's own sums)
import * as THREE from 'three';
import { makeAnimal } from '../actors/animals.js';
import { makeTargetRing } from '../targetring.js';
import { makeFlock, flockFor, flockStep } from './sheepmath.js';
import { travel } from '../math/asking.js';
import { offerChart, closeChart, ensureChartCss } from '../ui/timeschart.js';
import { showNumberLine, ensureNumberLineStyles, watchHesitation } from '../ui/numberline.js';
import { showCountHelp } from '../ui/counthelp.js';
import { recordAnswer, earn, countJob } from '../save.js';
import { flagCard } from '../ui/flag.js';
import { readAloud } from '../math/skill.js';
import { speakLine } from '../ui/storeslip.js';

export const SHEEP = {
  near: 44,              // the job's card shows within this many metres of the sheep pasture's middle
  reach: 34,             // metres from a sheep within which the bottles come up (farther: ride closer first): the whole
                         // pasture from its fence, since walking up to each sheep is work, not play
  walkAway: 40,          // the bottles are put away when the player is this far from that sheep
  labelPx: [40, 58],     // a one-line sum card's height on screen (pixels): about 5.5% of the screen, kept in this range
  labelFull: 36,         // the sums show in full within this many metres of the player (a little past the reach) ...
  labelGone: 48,         // ... and have faded out by this far (so they don't hang over the meadow seen from town)
  tieAfter: 14,          // pixels: a card moved farther than this from its own sheep gets a thin line down to her
  stackGap: 6,           // pixels kept between two sum cards that would overlap on screen (the farther one moves up)
  pay: { heal: 3, helped: 1, flock: 6 },   // gold: a sheep cured with the first bottle tried, one cured after a wrong one, a whole flock
  big: 1.55,             // the cured sum shows this much bigger ...
  show: 2.8,             // ... for this many seconds, then fades away (a cured sheep has nothing left to check)
  nextFlock: 4,          // seconds after a flock is done before its new sums show
  wrongShow: 3.5,        // seconds the last wrong bottle's line shows before the cure goes in by itself (long enough
                         // to read why that bottle was wrong: on a two-bottle sheep it is the kid's only pick)
  tapGuard: 0.35,        // seconds after the bottles come up during which a click on them is ignored (on a touch screen
                         // the tap that opened them sends a click of its own, which would land on a bottle)
  helpAfter: 12000,      // ms near the flock without a dose before help is offered (reading sums takes longer than a number)
  rest: [3, 10],         // seconds a sheep stands before it ambles a few steps
};

// each sheep's fleece: a colour laid over the file's own (a little over 1 brightens it)
const FLEECE = [[1.2, 1.18, 1.12], [1.14, 1.1, 1.0], [1.22, 1.2, 1.16], [1.1, 1.06, 0.98], [1.18, 1.15, 1.06], [1.16, 1.14, 1.1]];

// ── THE SUM CARD OVER A SHEEP ────────────────────────────────────────────────────────────────────────────────────
// a cream card with dark ink (the cattle's look), one line, or two for a step of solving for x (the line before it small
// on top). Drawn into the top left of a fixed canvas; the picture is cropped to the card (the map's repeat and offset),
// so the sprite is exactly the card and the ring's frame hugs it.
const CW = 768, CH = 224, LINE_H = 120;           // canvas; a one-line card's height (its on-screen size is labelPx)
export function makeCard() {
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
  const s = new THREE.Sprite(mat); s.center.set(0.5, 0); s.renderOrder = 1000; s.name = 'sheep-sum';   // (after the target ring's loop, 996-999, so the ring never crosses a card; the ringed card is drawn again above, 1001)
  s.userData = { cv, tex, key: null, aspect: 3, tall: 1 };
  return s;
}
// a thin dark line from a card that was moved to clear another back to its own sheep (drawn over the ground and grass,
// like the card)
function makeTie() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x3a2a1a, transparent: true, opacity: 0.75, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
  l.renderOrder = 999; l.frustumCulled = false; l.visible = false; l.name = 'sheep-sum-tie';
  return l;
}
export function drawCard(s, { top = null, main = '', cured = false } = {}) {
  const key = `${top}|${main}|${cured}`;
  if (s.userData.key === key) return;
  s.userData.key = key;
  const { cv, tex } = s.userData, c = cv.getContext('2d');
  c.clearRect(0, 0, CW, CH);
  const big = '700 84px Bitter, Georgia, serif', small = '600 50px Bitter, Georgia, serif';
  c.font = big; let w = c.measureText(main).width;
  if (top) { c.font = small; w = Math.max(w, c.measureText(top).width); }
  w = Math.min(CW - 8, Math.max(LINE_H * 1.1, w + 60));
  const h = top ? CH - 8 : LINE_H;
  c.fillStyle = cured ? 'rgba(232, 246, 214, 0.97)' : 'rgba(246, 237, 214, 0.96)';
  c.strokeStyle = cured ? 'rgba(46, 120, 40, 0.95)' : 'rgba(92, 64, 36, 0.95)'; c.lineWidth = cured ? 9 : 6;
  c.beginPath(); c.roundRect(5, 5, w - 10, h - 10, 26); c.fill(); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (top) {
    c.font = small; c.fillStyle = '#5d4a36'; c.fillText(top, w / 2, 58);
    c.strokeStyle = 'rgba(92, 64, 36, 0.35)'; c.lineWidth = 3; c.beginPath(); c.moveTo(40, 98); c.lineTo(w - 40, 98); c.stroke();
    c.font = big; c.fillStyle = cured ? '#1f4d18' : '#2b2219'; c.fillText(main, w / 2, 152);
  } else {
    c.font = big; c.fillStyle = cured ? '#1f4d18' : '#2b2219'; c.fillText(main, w / 2, h / 2 + 5);
  }
  // (the picture is cropped to the card: canvas rows run down, the texture's v runs up)
  tex.repeat.set(w / CW, h / CH); tex.offset.set(0, 1 - h / CH);
  tex.needsUpdate = true;
  s.userData.aspect = w / h; s.userData.tall = h / LINE_H;
}

// ── THE MEDICINE BOTTLES (page elements, on the left middle of the screen, clear of where the kid aims) ─────────────
const CSS_HREF = new URL('./sheep.css', import.meta.url).href;
function ensureCss() {
  if (document.querySelector('link[data-bm-sheep]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS_HREF; l.dataset.bmSheep = '1'; document.head.appendChild(l);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BOTTLE = (n) => `<svg viewBox="0 0 40 64" aria-hidden="true"><rect x="14" y="2" width="12" height="8" rx="2" fill="#5a3b22"/>
  <path d="M15 10h10v7c6 3 9 8 9 14v26c0 3-2 5-5 5H11c-3 0-5-2-5-5V31c0-6 3-11 9-14z" fill="${['#6b3a1f', '#2f5d55', '#5b3a63'][n % 3]}" stroke="#20160e" stroke-width="1.5"/>
  <rect x="9" y="33" width="22" height="16" rx="2" fill="#f1e4c6" stroke="#7a5530" stroke-width="1"/><path d="M12 41h16" stroke="#7a5530" stroke-width="1.6"/>
  <path d="M11 22c2-2 4-3 6-3" stroke="rgba(255,255,255,0.45)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;

export function makeSheepJob({ W, animals, farm, P, I, camera, canvas, rider, hud, hob, refresh = () => {}, scene = W.scene, defer = () => false }) {
  const L = farm.layout, PA = L.sheep, area = L.area(PA, 2.2);
  const R = makeTargetRing({ scene, camera, canvas, W });
  ensureCss(); ensureChartCss(); ensureNumberLineStyles();
  const fontReady = (document.fonts && document.fonts.load) ? document.fonts.load('700 84px Bitter').catch(() => null) : Promise.resolve();
  const flock = [];
  const SH = { sheep: flock, ring: R, near: false, flock: null };
  let flockN = 0, cur = null, nextT = -1, time = 0, hintT = 0, disposed = false;
  let picker = null, offer = null, hes = null, nl = null;

  // ── THE SHEEP ──────────────────────────────────────────────────────────────────────────────────────────────────
  SH.ready = animals.need('sheep').then(() => {
    if (disposed) return;
    for (let i = 0; i < 6; i++) {
      // (fleece from cream to white, a touch brighter than the file's grey wool, so the flock reads as sheep from the saddle;
      // never dark: a sick sheep must look like the rest, and a dark one would stand out)
      const a = makeAnimal(animals, 'sheep', { tint: '#ffffff' });
      a.mesh.material.color.setRGB(...FLEECE[i % FLEECE.length]);
      let p = area.random();
      for (let k = 0; k < 30 && (W.blocked(p.x, p.z) || flock.some((o) => Math.hypot(o.root.position.x - p.x, o.root.position.z - p.z) < 3.2)); k++) p = area.random();
      a.root.position.set(p.x, W.heightAt(p.x, p.z), p.z); a.root.rotation.y = Math.random() * Math.PI * 2;
      scene.add(a.root);
      const s = { id: i + 1, a, root: a.root, label: makeCard(), item: null, state: 'graze', alpha: 0, lift: 0, healed: false, tried: false,
        crossed: new Set(), hopT: 0, showT: 0, top: a.tall + 0.3, w: farm.wanderer(a, area, { rest: SHEEP.rest }) };
      s.label.visible = false; scene.add(s.label);
      s.tie = makeTie(); scene.add(s.tie);
      flock.push(s);
    }
    newFlock();
  }).catch((e) => console.warn('sheep: the flock could not load', e));

  function card(s) {
    if (!s.item) return;
    const it = s.item, cured = s.healed;
    const o = { top: it.top, main: cured ? it.fixed : it.shown, cured };
    drawCard(s.label, o);
    fontReady.then(() => { s.label.userData.key = null; drawCard(s.label, o); });
  }

  // ── A FLOCK'S SUMS ─────────────────────────────────────────────────────────────────────────────────────────────
  function newFlock({ sick = null } = {}) {
    closePicker(); endHelp(); hint(null);
    const { topic, q } = flockFor(rider, { last: cur ? cur.topic : null });
    flockN++;
    cur = makeFlock(rider, topic, { size: flock.length, sick, step: flockStep(topic, q) });
    cur.healed = 0; cur.done = false; cur.q = q;
    SH.flock = cur;
    flock.forEach((s, i) => { s.item = cur.sheep[i]; s.healed = false; s.tried = false; s.crossed = new Set(); s.showT = 0; s.state = 'graze'; card(s); });
    nextT = -1;
    showCard();
    if (SH.near) startHelp();
  }
  const sickLeft = () => (cur ? flock.filter((s) => s.item && s.item.sick && !s.healed).length : 0);
  function showCard() {
    if (!SH.near || !cur) return;   // (away from the farm the round-up's card is up)
    if (cur.done) { hud.rule({ main: 'Flock healed!', sub: 'New sums coming up…' }); return; }
    const left = sickLeft(), helpBtn = helpButton();
    hud.rule({
      main: left === 1 ? (cur.healed ? 'One sick sheep left' : 'One sheep is sick') : `${left} sheep are sick`,
      sub: `Find the wrong sums · ${I.touch ? 'tap a sheep' : 'point at a sheep, press F'}${cur.healed ? ` · ${cur.healed} healed` : ''}`,
      buttons: helpBtn ? [helpBtn] : [],
    });
  }
  // the help on the card: the number line for the ringed sheep's sum (answer hidden), or the golden rule of solving
  function helpButton() {
    if (!cur) return null;
    if (cur.topic === 'negatives' || cur.topic === 'counting' || cur.topic === 'adding' || cur.topic === 'taking') return { label: 'Show me', onClick: () => { const s = R.target || flock.find((x) => !x.healed); if (s && s.item) lineFor(s.item, null, false); } };
    if (cur.topic === 'algebra') return { label: 'The rule', onClick: () => hint({ say: 'Check her step', line: 'Whatever you do to one side, do to the other. To undo + 5, take 5 from both sides; to undo × 3, divide both sides by 3.' }) };
    return null;   // (times tables: the Peek button comes up under the card when the kid is stuck)
  }

  // ── HELP ───────────────────────────────────────────────────────────────────────────────────────────────────────
  function hint(o) { hud.hint(o); hintT = o ? 14 : 0; }
  function lineFor(item, picked, reveal = true, reason = '') {
    if (!SH.near) return;   // (no helper away from the flock: it stayed up in town)
    const h = item.help; if (!h || (h.kind !== 'line' && h.kind !== 'count')) return;
    if (nl) nl.remove();
    // (the early topics' picture: ten-frames and a number line with hops, src/ui/counthelp.js)
    if (h.kind === 'count') { nl = showCountHelp(hud.helpEl, { ...h, reveal, picked: picked ?? undefined, reason }); return; }
    nl = showNumberLine(hud.helpEl, { start: h.start, change: h.change, op: h.op, term: h.term, reveal, picked: picked ?? undefined, reason, theme: 'dark' });
  }
  function chartFor(item, missed) {
    if (!SH.near) return;
    const h = item && item.help; if (!h || h.kind !== 'chart') return;
    const o = { table: h.table, find: h.find, rule: h.rule, missed: missed ?? undefined, anchor: hud.jobEl, avoid: hud.hintEl, side: 'right' };   // (find, rule: a division fact, read the times chart's way round)
    if (offer) offer.update(o); else offer = offerChart(document.body, o);
  }
  function startHelp() {
    if (!cur || cur.done || SH.paused || hes) return;
    hes = watchHesitation({ after: SHEEP.helpAfter, onShow: () => {
      const s = (R.target && !R.target.healed && R.target) || flock.find((x) => x.item && !x.healed);
      if (!s) return;
      if (cur.topic === 'times' || (s.item.help && s.item.help.kind === 'chart')) chartFor(s.item, null);
      else if (cur.topic === 'negatives' || (s.item.help && s.item.help.kind === 'count')) lineFor(s.item, null, false);
      else if (s.item.help && s.item.help.kind === 'rule' && cur.topic !== 'algebra') hint({ say: 'Take your time', line: s.item.help.line });
      else hint({ say: 'Take your time', line: 'Read each step: was the same thing done to both sides, and the right way?' });
    } });
  }
  function endHelp() {
    if (hes) { hes.cancel(); hes = null; }
    closeChart();
    if (offer) { offer.remove(); offer = null; }
    if (nl) { nl.remove(); nl = null; }
  }

  // a sheep's sum as it is said out loud: "7 minus 2 equals 5. Is that right?"; a dots card is not counted for the
  // rider (that is the question): "Count the dots. Are there 4?"
  function sayItem(it) {
    const dots = /^\s*●[●\s]*\sis\s+(\S+)\s*$/.exec(it.shown);   // (dotsText groups them in fives: "●●●●● ●● is 7")
    if (dots) return `Count the dots. Are there ${dots[1]}?`;
    return `${it.top ? `${it.top}. ` : ''}${it.shown.replace(/\+/g, ' plus ').replace(/=/g, ' equals ')}. Is that right?`;
  }
  // ── THE BOTTLES ────────────────────────────────────────────────────────────────────────────────────────────────
  function openPicker(s) {
    if (!s || !s.item || s.healed || SH.paused || !cur || cur.done) return false;
    const d = Math.hypot(s.root.position.x - P.position.x, s.root.position.z - P.position.z);
    if (d > SHEEP.reach) { hud.toast('Ride a little closer to that sheep'); return false; }
    closePicker();
    if (s.item.sick && s.item.bottles.length - s.crossed.size <= 1) { heal(s, SHEEP.pay.helped); return true; }
    if (hes) hes.answered();
    const el = document.createElement('div');
    el.className = 'bms-pick';
    el.innerHTML = `<div class="bms-pick-head"><b>Medicine</b><span>${s.item.top ? `${esc(s.item.top)} → ` : ''}${esc(s.item.shown)}</span></div>
      <div class="bms-pick-list">${s.item.bottles.map((b, i) => `<button type="button" data-i="${i}"${s.crossed.has(i) ? ' class="is-crossed" disabled' : ''}>
        ${BOTTLE(i)}<span>${esc(b.label)}</span><kbd>${i + 1}</kbd></button>`).join('')}</div>
      <button type="button" class="bms-pick-x" title="Put the bottles away (Esc)">×</button>`;
    // (its clicks stay its own: they never reach the valley as a pick or a drag)
    for (const ev of ['pointerdown', 'pointerup', 'click', 'mousedown', 'mouseup', 'touchstart', 'touchend']) el.addEventListener(ev, (e) => e.stopPropagation());
    // On a touch screen the click that follows a tap lands on whatever is under the thumb once the tap is over, and the
    // tray may just have opened there: a click this soon after opening is the tap that opened it, never a pick.
    const opened = performance.now();
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return; b.blur();
      if (performance.now() - opened < SHEEP.tapGuard * 1000) return;
      if (b.classList.contains('bms-pick-x')) { closePicker(); return; }
      give(+b.dataset.i);
    });
    document.body.appendChild(el);
    picker = { el, s };
    flagCard(el, () => ({ text: `${s.item.top ? `${s.item.top} → ` : ''}${s.item.shown}`, choices: s.item.bottles.map((b) => b.label), right: (s.item.bottles.find((b) => b.right) || { label: 'none: she was fine' }).label, picked: [...s.crossed].map((i) => (s.item.bottles[i] || {}).label) }));   // ("Confusing?": src/ui/flag.js)
    // (a rider who can't read yet, skill.js readAloud: her sum is read out, in the browser's voice, as the bottles come up)
    if (readAloud(rider)) speakLine(sayItem(s.item));
    hob.event('sheepDose');   // (walked up to her with the bottles)
    s.state = 'dose'; s.w.goal = null; s.a.play('Idle', { fade: 0.3 });
    return true;
  }
  function closePicker() {
    if (!picker) return;
    const { el, s } = picker; picker = null;
    el.classList.add('is-off'); setTimeout(() => el.remove(), 220);
    if (s.state === 'dose') s.state = 'graze';
    if (hes && cur && !cur.done) hes.restart();
  }
  // Esc puts the bottles away (before the game's own Esc opens the menu); 1 2 3 pick
  const onKey = (e) => {
    if (!picker || SH.paused) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closePicker(); return; }
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
    if (n != null && !e.repeat) { e.preventDefault(); give(n); }
  };
  addEventListener('keydown', onKey, true);

  function give(i) {
    if (!picker || !cur) return;
    const s = picker.s, it = s.item, b = it.bottles[i];
    if (!b || s.crossed.has(i) || s.healed) return;
    closeChart();
    if (!it.sick) {
      // a healthy sheep: no harm done, nothing taken off; Hob says why her sum is right
      closePicker();
      hob.event('sheepFine', { line: it.fine });
      hint({ say: "She's fine", line: it.fine });
      s.a.play('Idle', { fade: 0.2 });
      return;
    }
    const first = !s.tried; s.tried = true;
    if (first) {
      // the flock was dealt from one answer of the skill model: each sheep's first bottle carries its point (a positive &
      // negative sum counts in Addition or Subtraction by its own sign)
      const sk = cur.q ? travel(cur.q, { strand: it.op ? (it.op === '-' ? 'sub' : 'add') : null }) : null;
      const rec = recordAnswer(rider, b.right, sk); if (rec && rec.badge) hud.toast(`You earned the ${rec.badge} badge!`, 'gold');
    }
    if (b.right) { closePicker(); heal(s, first ? SHEEP.pay.heal : SHEEP.pay.helped); return; }
    // a wrong bottle: crossed out, the why, the helper; with one bottle left the cure goes in by itself
    s.crossed.add(i);
    const btn = picker.el.querySelector(`button[data-i="${i}"]`); if (btn) { btn.classList.add('is-crossed', 'is-shake'); btn.disabled = true; }
    hint({ say: 'Not that bottle', line: b.why });
    if (it.help.kind === 'line' || it.help.kind === 'count') lineFor(it, b.value, true, '');
    else if (it.help.kind === 'chart') chartFor(it, it.answer === b.value ? null : b.value);
    hob.event('sheepWrong');
    const left = it.bottles.filter((x, k) => !s.crossed.has(k));
    // (the cure doesn't wait on the tray: put away or not, she is cured; while the game is paused it waits, and opening
    // her bottles again cures her at once, so there's never a tray with one bottle to press)
    if (left.length === 1) {
      const was = s.item;
      setTimeout(() => {
        if (disposed || s.healed || s.item !== was || !cur || cur.done || SH.paused) return;
        if (picker && picker.s === s) closePicker();
        heal(s, SHEEP.pay.helped);
      }, SHEEP.wrongShow * 1000);
    }
  }

  function heal(s, gold) {
    s.healed = true; s.state = 'hop'; s.hopT = 1.0; s.showT = SHEEP.show; s.w.goal = null;
    s.a.play('Jump', { once: true, fade: 0.1 });
    card(s);
    cur.healed++;
    const e = earn(rider, gold);
    hud.buckle(countJob(rider, 'sheep').buckle, { delay: 900 });
    hud.toast(`Healed! ${s.item.fixed}  +${gold} gold`, 'good');
    hint({ say: 'She perks right up', line: s.item.healed });
    if (nl) { nl.remove(); nl = null; }
    closeChart();
    if (offer) { offer.remove(); offer = null; }   // (the Peek was for her sum: it comes back if the kid is stuck on the next)
    if (e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 1600);
    hob.event('sheepHealed');
    refresh();
    if (!sickLeft()) flockDone();
    else { showCard(); if (hes) hes.restart(); }
  }

  function flockDone() {
    cur.done = true;
    endHelp();
    const e = earn(rider, SHEEP.pay.flock);
    setTimeout(() => { if (!disposed) hud.toast(`Flock healed! +${SHEEP.pay.flock} gold`, 'gold'); }, 1400);
    if (e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 3000);
    hob.event('flockDone');
    refresh();
    nextT = SHEEP.nextFlock;
    showCard();
  }

  // ── PICKS: a click (not a drag) on a sheep, or near one, brings up the bottles; a tap picks the nearest ──────────
  const can = (t) => !!(t.item && !t.healed && cur && !cur.done);
  const offPick = I.onPick((p) => {
    if (SH.paused || !SH.near || !cur || cur.done) return;
    const t = p.touch ? R.pick(p.x, p.y) : R.click(p.x, p.y);
    if (t) openPicker(t);
  });

  // ── EACH FRAME ─────────────────────────────────────────────────────────────────────────────────────────────────
  const camFwd = new THREE.Vector3(), lp = new THREE.Vector3();
  let wasNear = false;
  SH.update = (dt) => {
    time += dt;
    const d = Math.hypot(P.position.x - PA.x, P.position.z - PA.z);
    const away = defer(P.position);   // (at another farm job: the sheep's sums and the ring step aside too, so two jobs' sums don't mix)
    SH.near = d < SHEEP.near && !away;
    if (SH.near !== wasNear) {
      wasNear = SH.near;
      if (SH.near) { hob.event('farmArrive'); startHelp(); showCard(); }
      // (its own card comes down too: 'point at a sheep, press F' and its Show me mean nothing away from the flock; the
      // card that follows is the chosen job's plain where-it-is one, or the round-up's, within a second)
      else { endHelp(); closePicker(); hud.rule(null); hud.hint(null); hintT = 0; }
    }
    if (hintT > 0 && (hintT -= dt) <= 0) hud.hint(null);
    if (nextT > 0 && (nextT -= dt) <= 0) newFlock();

    // F (or Space on foot, or the Rope button) gives medicine to the ringed sheep (only read at the farm: away from it,
    // the press is left for the job the player is at, the wagon's bandits or the gang's guard)
    const pressed = I.enabled && P.enabled && SH.near && (I.tap('KeyF') || (!P.onHorse && I.tap('Space')));
    if (pressed && SH.near && R.target && !picker) openPicker(R.target);
    // walking off with the bottles up puts them away
    if (picker && Math.hypot(picker.s.root.position.x - P.position.x, picker.s.root.position.z - P.position.z) > SHEEP.walkAway) closePicker();

    const awake = d < 240;
    for (const s of flock) {
      if (!awake) break;
      if (s.state === 'hop') {
        if ((s.hopT -= dt) <= 0) { s.state = 'well'; s.a.play('Idle', { fade: 0.3 }); }
        s.a.update(dt);
      } else if (s.state === 'dose') {
        // she turns to face whoever has the medicine
        const want = Math.atan2(P.position.x - s.root.position.x, P.position.z - s.root.position.z);
        s.root.rotation.y += Math.atan2(Math.sin(want - s.root.rotation.y), Math.cos(want - s.root.rotation.y)) * Math.min(1, 2 * dt);
        s.a.update(dt);
      } else farm.wanderStep(s.w, dt);
      if (s.showT > 0) s.showT -= dt;
    }

    // the sum cards: over each sheep, the same size on screen near or far, fading out past ~42 m
    const h = canvas.clientHeight || innerHeight, px = Math.max(SHEEP.labelPx[0], Math.min(SHEEP.labelPx[1], h * 0.055));
    const p5 = camera.projectionMatrix.elements[5];
    camera.getWorldDirection(camFwd);
    for (const s of flock) {
      const Lb = s.label;
      const curedShow = s.healed && s.showT > 0;
      const show = !!s.item && (!s.healed || curedShow) && !(cur && cur.done && !curedShow) && !SH.paused && !away;
      const dist = Math.hypot(s.root.position.x - P.position.x, s.root.position.z - P.position.z);
      const fadeK = 1 - Math.max(0, Math.min(1, (dist - SHEEP.labelFull) / (SHEEP.labelGone - SHEEP.labelFull)));
      const want = show ? fadeK * (curedShow ? Math.min(1, s.showT / 0.6) : 1) : 0;
      s.alpha += (want - s.alpha) * Math.min(1, dt * 6);
      Lb.visible = s.alpha > 0.02;
      if (!Lb.visible) continue;
      lp.set(s.root.position.x, s.root.position.y + s.top, s.root.position.z);
      Lb.position.copy(lp);
      const depth = Math.max(0.5, lp.sub(camera.position).dot(camFwd));
      const k = curedShow ? SHEEP.big : 1, hw = px * k * 2 * depth / (p5 * h) * Lb.userData.tall;
      Lb.scale.set(hw * Lb.userData.aspect, hw, 1);
      Lb.material.opacity = s.alpha;
      Lb.userData.depth = depth; Lb.userData.perPx = hw / (px * k * Lb.userData.tall);
    }
    unstack(h);
    R.update(dt, { targets: d < 90 && !away ? flock : [], player: P, can, reach: SHEEP.reach, hold: !!picker });
  };

  // Sum cards that would overlap on screen are stacked: the nearest keeps its place and a farther one moves up just
  // clear of it, so every sum can be read (as the round-up's numbers)
  // A card that would be pushed up under the job card at the top of the screen goes down below the cards in its way
  // instead. The page's own boxes over the view (the job card with the line under it, the chart's Peek button, the
  // medicine bottles) are kept clear the same way: a sum behind one couldn't be read. A card that ends up away from its
  // sheep gets a thin line down to her, so it's clear whose it is.
  const sv = new THREE.Vector3(), rects = [];
  let roof = 0, roofT = 0;
  const keep = [];    // the page's boxes over the view, measured every few frames: { x0, x1, y0, y1, top }
  function measureKeep() {
    keep.length = 0;
    const add = (el, top = false) => {
      if (!el || !el.isConnected) return;
      const r = el.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) keep.push({ x0: r.left, x1: r.right, y0: r.top, y1: r.bottom, top });
    };
    const jr = hud.jobEl && hud.jobEl.getBoundingClientRect();
    roof = jr && jr.height ? jr.bottom + 4 : 0;
    add(hud.jobEl, true);
    if (offer && offer.el && offer.el.classList.contains('in')) add(offer.el, true);
    if (picker && !picker.el.classList.contains('is-off')) add(picker.el);
  }
  function unstack(h) {
    const w = canvas.clientWidth || innerWidth, list = [];
    if ((roofT -= 1) <= 0) { roofT = 10; measureKeep(); }
    camera.updateMatrixWorld();
    for (const s of flock) {
      const Lb = s.label;
      if (!Lb.visible) { s.lift = 0; s.tie.visible = false; continue; }
      sv.copy(Lb.position).project(camera);
      if (sv.z > 1) { s.tie.visible = false; continue; }
      const ph = Lb.scale.y / Lb.userData.perPx;            // the card's height on screen (pixels)
      list.push({ s, x: (sv.x + 1) / 2 * w, y: (1 - sv.y) / 2 * h, cw: ph * Lb.userData.aspect, ch: ph, d: Lb.userData.depth });
    }
    list.sort((a, b) => a.d - b.d);
    rects.length = 0;
    const g = SHEEP.stackGap;
    const across = (it, r) => !(it.x + it.cw / 2 + g <= r.x0 || it.x - it.cw / 2 - g >= r.x1);
    const hits = (it, bottom, r) => across(it, r) && !(bottom - it.ch - g >= r.y1 || bottom + g <= r.y0);
    for (const it of list) {
      // from a card's bottom edge on screen, up (dir -1) or down (+1) until no card already placed and no box is in the way
      const clear = (dir, from = it.y) => {
        let bottom = from, moved = true, n = 0;
        while (moved && n++ < 16) {
          moved = false;
          for (const r of rects) {
            if (!hits(it, bottom, r)) continue;
            bottom = dir < 0 ? r.y0 - g : r.y1 + g + it.ch; moved = true;
          }
          for (const r of keep) {
            if (!hits(it, bottom, r)) continue;
            // (going up past a box is only for the bottles' tray; the boxes along the top send a card down below them)
            const was = bottom;
            bottom = dir < 0 && !r.top && r.y0 - g - it.ch > roof ? r.y0 - g : r.y1 + g + it.ch;
            if (bottom > was) dir = 1;   // (sent down below a box: from here on it only goes down, or it would bounce)
            moved = true;
          }
        }
        return bottom;
      };
      let bottom = clear(-1);
      if (bottom < it.y && bottom - it.ch < roof && Math.abs(it.x - w / 2) < w * 0.32) bottom = clear(1);
      rects.push({ x0: it.x - it.cw / 2, x1: it.x + it.cw / 2, y0: bottom - it.ch, y1: bottom });
      const wantLift = (it.y - bottom) * it.s.label.userData.perPx;
      it.s.lift += (wantLift - it.s.lift) * 0.25;
      it.s.label.position.y += it.s.lift;
      placeTie(it.s, Math.abs(it.s.lift) / it.s.label.userData.perPx);
    }
  }
  // the thin line from a moved card down (or up) to the sheep's back
  function placeTie(s, px) {
    const t = s.tie;
    t.visible = px > SHEEP.tieAfter && s.alpha > 0.05;
    if (!t.visible) return;
    const a = t.geometry.attributes.position, L = s.label.position, y0 = s.root.position.y + s.top - 0.15;
    // (to the card's bottom edge when it went up, its top edge when it went down)
    const yCard = s.lift > 0 ? L.y : L.y + s.label.scale.y;
    a.setXYZ(0, s.root.position.x, y0, s.root.position.z); a.setXYZ(1, L.x, yCard, L.z); a.needsUpdate = true;
    t.geometry.computeBoundingSphere();
    t.material.opacity = 0.75 * s.alpha;
  }

  let paused = false;
  Object.defineProperty(SH, 'paused', {
    get() { return paused; },
    set(on) {
      paused = !!on; R.visible = !paused;
      if (paused) { closePicker(); endHelp(); } else if (SH.near) startHelp();
    },
  });
  SH.open = (s) => openPicker(s);
  SH.give = (i) => give(i);
  SH.newFlock = (o) => newFlock(o);   // (o.sick: how many sick, for a rig)
  SH.state = () => ({
    near: SH.near, topic: cur && cur.topic, level: cur && cur.level, at: cur && cur.q ? cur.q.at : null, done: !!(cur && cur.done), healed: cur ? cur.healed : 0, sickLeft: sickLeft(),
    picker: picker ? { sheep: picker.s.id, crossed: [...picker.s.crossed] } : null,
    sheep: flock.map((s) => ({ id: s.id, x: +s.root.position.x.toFixed(2), z: +s.root.position.z.toFixed(2), sick: !!(s.item && s.item.sick), healed: s.healed,
      shown: s.item && s.item.shown, top: s.item && s.item.top, right: s.item ? s.item.bottles.findIndex((b) => b.right) : -1, clip: s.a.clip, label: s.label.visible })),
  });
  SH.dispose = () => {
    disposed = true;
    removeEventListener('keydown', onKey, true);
    offPick(); closePicker(); endHelp();
    if (SH.near) { hud.rule(null); hud.hint(null); }
    for (const s of flock) { s.label.removeFromParent(); s.label.material.dispose(); s.label.userData.tex.dispose(); s.tie.removeFromParent(); s.tie.geometry.dispose(); s.tie.material.dispose(); s.a.dispose(); }
    flock.length = 0;
    R.dispose();
  };
  return SH;
}
