// TARGET SHOOTING: the bottle range, for every rider. Guns are only ever used on bottles and tin cans, here at the range
// on the east edge of town (src/range.js); cattle and bandits are roped and deer photographed. Miss Opal Tate, who shot in the travelling Wild West shows, keeps the range: walk or ride
// up and she says what it's about; E by her (or a tap on the prompt) takes up her six-shooter (src/revolver.js).
//
// The view goes to the rider's own eyes at the firing line, the revolver in their hand at the bottom right. Bottles or
// tin cans pop up on the shelf downrange, each wearing a number on a paper tag, and a card up top says which to shoot.
// The math is the range's own kind: NUMBER SENSE (src/math/numbersense.js): which is biggest, smallest to largest,
// rounding ("Shoot every can that rounds to 40"), estimating ("Shoot the bottle closest to 19 + 22"), and "between"
// with negatives; it climbs from small whole numbers to numbers up to 1,000 and then negatives. For the youngest riders
// the shelf carries counting cards instead (numbersense.js countCard: "Shoot what comes after 7", "How many dots?"),
// read out loud while their read-aloud is on. Which, and how hard, come from the rider's skill model (src/math/skill.js,
// asked through src/math/asking.js) card by card; each card goes back to it once (a clean card right, its first wrong
// shot wrong; a travel job, so no time).
//   aim: the mouse moves the sights and a click fires (Space or F fires too, R reloads); on a touch screen, a finger
//        puts the sights down where it touches (drag to adjust) and lifting it fires. A shot near a target counts for
//        it: the aim is generous, the numbers are the hard part
//   right: a bottle shatters into falling glass, a can spins off the plank and tumbles down in a puff of dust; gold,
//        and the streak grows (a bonus every five in a row; the rider's best streak is kept)
//   wrong: the shot glances off with a spark and a zing, the target rocks on the plank, and a card says why in one plain
//        line with a number line to look at (for rounding, the halfway marks); pick again, nothing is taken off
//   stuck: after a while without a shot, the card's number line shows by itself (with no answer marked)
// Six shots, then a quick reload by itself. Five cards make a string: a bonus, and Miss Opal says a word. Then the
// next string straight away; "Done for now" (or Esc) puts the gun back. Every right target counts toward the
// "Targets hit" belt buckle, and every pick counts among the rider's answers.
//
//   const SR = makeShootingJob({ W, folk, P, I, camera, canvas, renderer, rider, hud, hob, audio, refresh, onStart, onStop, read })
//     read: src/audio/readaloud.js's (optional): the counting cards are read out
//     onStart / onStop: the game hands over the controls while the gun is up, and back
//   SR.update(dt)     each frame, after the player (it places the camera while the gun is up)
//   SR.draw()         each frame, after the valley is drawn: the six-shooter over it
//   SR.prompt         the prompt's words when E by Miss Opal would take up the gun, else null;  SR.start() does it
//   SR.active         the gun is up (or the view is going to or from the firing line);  SR.paused: a panel is open
//   SR.marks()        the compass mark for the range
//   SR.tags()         for rigs: the targets on the screen [{ n, x, y, right, alive }];  SR.pick(n) shoots the one with n
//   SR.done()         as "Done for now";  SR.state() for rigs;  SR.dispose()
import * as THREE from 'three';
import { makePerson } from '../actors/folk.js';
import { makeRange, RANGE } from '../range.js';
import { makeRevolver } from '../revolver.js';
import { makeRangeSound } from '../audio/rangesound.js';
import { makeNumberSense, rightNow, isDone, whyNot, lineFor, tipFor, numText, countCard } from '../math/numbersense.js';
import { chooseFor, askFor, travel, newBest } from '../math/asking.js';
import { showCountHelp } from '../ui/counthelp.js';
import { readAloud } from '../math/skill.js';
import { sayLine } from '../audio/sayline.js';
import { makeRng } from '../lockbox/generate.js';
import { makeGreeter, sayMs, TALK } from '../jobfolkplan.js';
import { recordAnswer, earn, countJob, saveRider, JOBS } from '../save.js';
import { flagCard } from '../ui/flag.js';

export const SHOOT = {
  string: 5,               // cards in a string
  pay: { target: 1, every: 4, streak: 5, streakBonus: 2, string: 4 },   // gold: each right target (+1 for every 4 steps up
                           // the ladder), a bonus every 5 right in a row, and a whole string
  helpAfter: 12,           // s on a card without a shot before its number line shows by itself
  nextCard: 0.85,          // s between a card cleared and the next one's targets popping up
  resolve: 0.05,           // s from the shot to the target breaking (the bullet's flight, near enough)
  reach: { mouse: 46, touch: 64 },   // px: a shot this near a target's tag (or its body, scaled with its size) counts for it
  camIn: 0.75,             // s the view takes to come from behind the rider to their eyes (and back out)
  fov: [14, 64],           // degrees the view may narrow or widen to fit the shelf
  sway: 0.035,             // radians the view leans toward the sights (so aiming feels alive)
  near: 140,               // m within which Miss Opal is drawn and moves
  card: 60,                // m within which the range's compass mark gives way to its sign (closer, you can see it)
};

// the range's keeper (the job folk's way: src/jobfolk.js, src/jobfolkplan.js)
export const KEEPER = {
  id: 'marksman', name: 'Miss Opal Tate', role: 'sharpshooter', look: { outfit: 'adventurer_f', palette: 'drifter', skin: 2, hair: 9 }, hat: 'cowboy',
  hello: ['I shot in the Wild West shows for twenty years. Now I keep this range.',
    'Bottles and tin cans only, and the card says which. Step up and borrow my six-shooter.'],
  start: 'Six in the gun. Look at the card, then take your shot.',
  // (on a touch screen: the gun bar's "Tap a target to shoot" is hidden on a phone, so her start line says how)
  startTouch: 'Six in the gun. Look at the card, then tap a target to shoot it.',
  thanks: ["That's a full string. Fine shooting!", 'You read those numbers like a sharpshooter.', 'Steady hand, steady head. Again?', "I've seen worse in the shows. Much worse!"],
  stand: 'Shoot bottles with Miss Opal',
};

// the skill model's makers the range deals from (src/math/strands.js): counting cards for the youngest riders, then
// the range's own number sense
export const RANGE_MAPS = ['counting', 'range'];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const whole = (v) => Math.max(0, Math.round(Number(v) || 0));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (f) => f * f * (3 - 2 * f);

export function makeShootingJob({ W, folk, P, I = null, camera, canvas, renderer, rider, hud, hob = null, audio = null, refresh = () => {},
  onStart = () => {}, onStop = () => {}, busy = () => false, scene = W.scene, read = null }) {
  ensureCss();
  const touch = () => !!(I && I.touch) || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  const R = makeRange({ W, scene });
  const SND = makeRangeSound({ audio });
  if (!rider.topics || typeof rider.topics !== 'object') rider.topics = {};
  if (!rider.topics.numbersense || typeof rider.topics.numbersense !== 'object') rider.topics.numbersense = {};
  const N = makeNumberSense(rider.topics.numbersense);
  if (!rider.range || typeof rider.range !== 'object' || Array.isArray(rider.range)) rider.range = {};
  const REC = rider.range; REC.best = whole(REC.best); REC.strings = whole(REC.strings);
  const counted = JOBS.some((j) => j.id === 'targets');   // (the "Targets hit" buckle, when this build has it)
  const rng = makeRng(), recent = [];
  const J = { prompt: null, active: false, paused: false };
  let state = 'idle', disposed = false;
  let G = null, ui = null, card = null, gone = new Set(), tried = new Set(), wrong = 0, streak = 0, inString = 0, idle = 0, helped = false, between = false;
  let blend = null, beatBest = false, swayX = 0, swayY = 0;
  const cross = { x: innerWidth / 2, y: innerHeight * 0.45, on: false };
  const FOV0 = camera.fov, NEAR0 = camera.near;
  const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();

  // ── MISS OPAL ──────────────────────────────────────────────────────────────────────────────────────────────────
  const shadows = !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  const box = document.createElement('div'); box.className = 'bjf bsr-folk'; document.body.appendChild(box);
  const say = document.createElement('div'); say.className = 'bjf-say'; say.hidden = true; box.appendChild(say);
  const tag = document.createElement('div'); tag.className = 'bjf-tag'; tag.hidden = true;
  tag.innerHTML = `<b>${esc(KEEPER.name)}</b><small>${esc(KEEPER.role)}</small>`; box.appendChild(tag);
  const K = { x: R.layout.marksman.x, z: R.layout.marksman.z, home: R.layout.marksman.face, face: R.layout.marksman.face, p: null, greet: makeGreeter({}), clipT: 0, t: 3, talking: null, waved: false };
  try {
    K.p = makePerson(folk, { ...KEEPER.look, hatStyle: KEEPER.hat, shadows });
    K.p.root.position.set(K.x, W.heightAt(K.x, K.z), K.z); K.p.root.rotation.y = K.face;
    scene.add(K.p.root); K.p.play('Idle');
  } catch (e) { console.warn('shooting: Miss Opal could not be made', e); }
  const head = new THREE.Vector3();
  function overHead(el, lift) {
    if (!K.p) return false;
    const b = K.p.bones && K.p.bones.Head;
    if (b) { b.getWorldPosition(head); head.y += 0.48; } else head.set(K.x, W.heightAt(K.x, K.z) + 2.2, K.z);
    head.project(camera);
    if (head.z > 1 || Math.abs(head.x) > 1.05 || Math.abs(head.y) > 1.05) return false;
    const x = (head.x + 1) / 2 * innerWidth, y = (1 - head.y) / 2 * innerHeight;
    if (!lift) { el.style.left = `${x}px`; el.style.top = `${y}px`; return true; }
    el.style.left = '0px'; el.style.top = '0px';
    const w = el.offsetWidth, h = el.offsetHeight, left = Math.max(12, Math.min(innerWidth - w - 12, x - w / 2));
    let floor = 70;
    for (const e of [hud.ruleEl, hud.hintEl]) { if (!e || e.hidden || !e.offsetParent) continue; const q = e.getBoundingClientRect(); if (q.height && q.top < innerHeight * 0.5 && q.right > left - 6 && q.left < left + w + 6) floor = Math.max(floor, q.bottom + 10); }
    const want = Math.min(innerHeight * 0.72 - h, y - h - 30), top = Math.max(floor, want);
    el.classList.toggle('is-low', want < floor && floor > 70);
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    el.style.setProperty('--tail', `${Math.max(16, Math.min(w - 16, x - left))}px`);
    return true;
  }
  // she says a line: over her head (a hello stops once the player has gone off), or in the gun's card while it's up
  function keeperSay(lines, { ms = null } = {}) {
    const L = (Array.isArray(lines) ? lines : [lines]).filter(Boolean); if (!L.length) return;
    if (ui) { ui.sayEl.textContent = `${KEEPER.name.replace('Miss ', '')}: ${L.join(' ')}`; ui.sayEl.hidden = false; clearTimeout(ui.sayT); ui.sayT = setTimeout(() => { if (ui) ui.sayEl.hidden = true; }, ms || sayMs(L.join(' '))); return; }
    K.talking = { t: (ms || sayMs(L.join(' '))) / 1000 };
    say.innerHTML = `<b>${esc(KEEPER.name)}</b>${L.map((l) => `<p>${esc(l)}</p>`).join('')}`;
    say.hidden = false; say.classList.remove('is-out');
    if (K.p && K.p.play(K.waved ? 'Interact' : 'Wave', { fade: 0.25, once: true })) { K.clipT = 1.7; K.waved = true; }
  }
  function keeperStep(dt, hidden) {
    const at = P.position, d = Math.hypot(at.x - K.x, at.z - K.z);
    const shown = !!K.p && d < SHOOT.near;
    if (K.p) K.p.root.visible = shown;
    if (!shown || hidden) { tag.hidden = true; say.hidden = true; K.greet.update(dt, false, d > TALK.away); if (!shown) return; }
    if (!hidden && K.greet.update(dt, d < TALK.greet && state === 'idle', d > TALK.away)) keeperSay(KEEPER.hello);
    // idle about, turn to the player close by
    const want = d < TALK.face && state === 'idle' ? Math.atan2(at.x - K.x, at.z - K.z) : K.home;
    K.face += wrapA(want - K.face) * Math.min(1, dt * 4);
    K.p.root.rotation.y = K.face; K.p.root.position.set(K.x, W.heightAt(K.x, K.z), K.z);
    if (K.clipT > 0 && (K.clipT -= dt) <= 0) K.p.play('Idle', { fade: 0.4 });
    else if (K.clipT <= 0 && (K.t -= dt) <= 0) { K.t = 6 + Math.random() * 9; K.p.play(Math.random() < 0.5 ? 'Idle_Neutral' : 'Idle', { fade: 0.6 }); }
    K.p.update(dt);
    if (hidden) return;
    tag.hidden = !(d < TALK.tag && !K.talking && overHead(tag, 0));
    if (K.talking) {
      if ((K.talking.t -= dt) <= 0 || d > TALK.away + 8) { K.talking = null; say.hidden = true; }
      else { say.classList.toggle('is-out', K.talking.t < 0.5); say.hidden = false; if (!overHead(say, 1)) say.hidden = true; }
    }
  }

  // ── THE PROMPT AND TAKING UP THE GUN ───────────────────────────────────────────────────────────────────────────
  function promptStep() {
    J.prompt = null;
    if (state !== 'idle' || J.paused || (P.mode !== 'foot' && P.mode !== 'horse') || busy()) return;
    const at = P.position, st = R.layout.stand;
    const d = Math.min(Math.hypot(at.x - K.x, at.z - K.z), Math.hypot(at.x - st.x, at.z - st.z)) - (P.onHorse ? 1.2 : 0);
    if (d < TALK.prompt) J.prompt = KEEPER.stand;
  }
  J.start = () => {
    if (state !== 'idle' || !J.prompt || J.paused) return false;
    J.prompt = null; state = 'setting'; J.active = true;
    onStart(); hud.prompt(null);
    say.hidden = true; tag.hidden = true; K.talking = null;
    // on the horse: led round outside the lane's fence first, so the horse waits there, not in front of the shelf
    if (P.onHorse) { const q = R.layout.at(-6.2, 0.5); P.teleport(q.x, q.z, R.layout.rot); P.dismount(); }
    setT = 0;
    return true;
  };
  let setT = 0;
  function setting(dt) {
    if (P.mode !== 'foot') { if (P.mode === 'horse') P.dismount(); if ((setT += dt) > 6) { state = 'idle'; J.active = false; onStop(); } return; }   // (still up: down again, once the horse is settled)
    const st = R.layout.stand;
    P.teleport(st.x, st.z, st.face);
    if (P.person) P.person.root.visible = true;
    blend = { t: 0, from: camera.position.clone(), q: camera.quaternion.clone(), fov: camera.fov };
    fitNow.fov = null; fitNow.dx = fitNow.dy = 0;
    state = 'in';
    SND.on(true);
    if (!G) G = makeRevolver({ look: rider.look || {} });
    G.show(false); G.reloading = false; G.rounds = 6;   // (handed over loaded: "six in the gun")
    openUi();
    keeperSay(touch() ? KEEPER.startTouch : KEEPER.start, { ms: touch() ? 4600 : 3800 });
  }

  // ── THE VIEW: the rider's eyes at the line, fitted so the shelf fills the room between the card and the bar ──────
  const lookAt = new THREE.Vector3(), eyeQ = new THREE.Quaternion(), dummy = new THREE.Object3D(), fitNow = { fov: null, dx: 0, dy: 0 };
  // (once the help card has moved the shelf over, it stays over until the card is cleared: a shelf sliding back and
  // forth as the help comes and goes is a moving target. held: { w, right } for this screen width)
  let held = null;
  function viewFit() {
    const L = R.layout, eye = L.eye, look = L.look;
    let top = 70, bot = innerHeight - 70, left = 0, right = innerWidth;
    if (ui) {
      top = ui.cardEl.getBoundingClientRect().bottom + 6; bot = ui.barEl.getBoundingClientRect().top - 6;
      // (the help card at the side of a wide screen: the shelf moves over to the room left of it)
      if (!ui.helpEl.hidden && innerWidth > 760) {
        const h = ui.helpEl.getBoundingClientRect();
        if (h.width && h.top < bot) { held = { w: innerWidth, right: Math.min(Math.max(innerWidth * 0.55, h.left - 8), held && held.w === innerWidth ? held.right : Infinity) }; right = held.right; }
      } else if (held && held.w === innerWidth) right = held.right;
    }
    if (innerWidth < innerHeight) bot = Math.min(bot, innerHeight * 0.66);   // (a phone held upright: the help sheet goes under it)
    const bandH = Math.max(140, bot - top), bandMid = (top + bot) / 2, bandW = right - left, d = eye.distanceTo(look);
    const lowY = R.layout.look.y - ((RANGE.planks[0] + RANGE.planks[1]) / 2 + 0.12) + RANGE.planks[0] - 0.25;
    const highY = R.layout.look.y - ((RANGE.planks[0] + RANGE.planks[1]) / 2 + 0.12) + RANGE.planks[1] + RANGE.bottle.h + 0.42;
    // (on a wide screen some of the range round the shelf too; less of it on a small one, so the targets stay big)
    const aspect = innerWidth / innerHeight, wide = Math.max(0, Math.min(1, (aspect - 0.75) / 0.8)) * Math.min(1, innerHeight / 700);
    const reachX = R.targets.length ? Math.max(...R.targets.map((T) => Math.abs(T.lx))) + 0.5 : RANGE.plankW / 2 + 0.35;
    const half = Math.max(highY - look.y, look.y - lowY) * (1.08 + 0.5 * wide), halfW = reachX + 1.25 * wide;
    const tanV = Math.max(half / d * innerHeight / bandH, halfW / d / (innerWidth / innerHeight) * innerWidth / bandW);
    const fov = Math.max(SHOOT.fov[0], Math.min(SHOOT.fov[1], 2 * Math.atan(tanV) * 180 / Math.PI));
    return { fov, dy: innerHeight / 2 - bandMid, dx: innerWidth / 2 - (left + right) / 2 };
  }
  function placeView(dt) {
    const L = R.layout, fit = viewFit();
    // (leaning a little toward the sights)
    const sx = cross.on ? (cross.x / innerWidth - 0.5) * 2 : 0, sy = cross.on ? (cross.y / innerHeight - 0.5) * 2 : 0;
    swayX += (sx - swayX) * Math.min(1, dt * 3); swayY += (sy - swayY) * Math.min(1, dt * 3);
    dummy.position.copy(L.eye); dummy.lookAt(lookAt.copy(L.look));
    dummy.rotateY(-swayX * SHOOT.sway); dummy.rotateX(-swayY * SHOOT.sway * 0.6);
    // (a camera looks down its -z: an Object3D's lookAt points its +z, so turned round)
    eyeQ.copy(dummy.quaternion).multiply(_q.setFromAxisAngle(_v.set(0, 1, 0), Math.PI));
    let fov = fit.fov, k = 1;
    if (blend) {
      // (coming in from behind the rider: eased from where the chase camera was)
      blend.t += dt; k = smooth(Math.min(1, blend.t / SHOOT.camIn));
      camera.position.lerpVectors(blend.from, L.eye, k);
      camera.quaternion.slerpQuaternions(blend.q, eyeQ, k);
      fov = blend.fov + (fit.fov - blend.fov) * k;
    } else { camera.position.copy(L.eye); camera.quaternion.copy(eyeQ); }
    // (the fit eased, so the shelf glides rather than jumps when the help card comes and goes)
    const e = blend ? 1 : 1 - Math.exp(-dt * 7);
    fitNow.fov = fitNow.fov == null ? fov : fitNow.fov + (fov - fitNow.fov) * e;
    fitNow.dx += (fit.dx * k - fitNow.dx) * e; fitNow.dy += (fit.dy * k - fitNow.dy) * e;
    const o = camera.view, dx = Math.round(fitNow.dx), dy = Math.round(fitNow.dy);
    if (!o || !o.enabled || o.offsetX !== dx || o.offsetY !== dy || o.fullWidth !== innerWidth || o.fullHeight !== innerHeight) camera.setViewOffset(innerWidth, innerHeight, dx, dy, innerWidth, innerHeight);
    if (Math.abs(camera.fov - fitNow.fov) > 0.01 || camera.near !== 0.1) { camera.fov = fitNow.fov; camera.near = 0.1; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    W.camTarget.copy(L.look);
    return k;
  }

  // ── THE SIGHTS AND THE CARD ON SCREEN ──────────────────────────────────────────────────────────────────────────
  function openUi() {
    const el = document.createElement('div'); el.className = 'bsr' + (touch() ? ' is-touch' : '');
    el.innerHTML = `
      <div class="bsr-card"><small class="bsr-step"></small><b class="bsr-rule"></b><span class="bsr-sub"></span><em class="bsr-say" hidden></em></div>
      <div class="bsr-tags"></div>
      <div class="bsr-cross" hidden><i></i></div>
      <div class="bsr-help" hidden></div>
      <div class="bsr-bar">
        <div class="bsr-gun"><svg class="bsr-cyl" viewBox="-25 -25 50 50" aria-hidden="true"></svg><span class="bsr-gunwords"></span></div>
        <div class="bsr-score"><span class="bsr-streak">Streak <b>0</b></span><span class="bsr-best">Best <b>${REC.best}</b></span><span class="bsr-dots"></span></div>
        <button type="button" class="bsr-done">Done for now<small>${touch() ? '' : 'Esc'}</small></button>
      </div>`;
    canvas.after(el);   // (just after the valley's canvas: the HUD's purse, its Menu button and the toasts stay on top)
    document.body.classList.add('bsr-aiming');
    const q = (s) => el.querySelector(s);
    ui = { el, cardEl: q('.bsr-card'), ruleEl: q('.bsr-rule'), subEl: q('.bsr-sub'), stepEl: q('.bsr-step'), sayEl: q('.bsr-say'), tagsEl: q('.bsr-tags'), crossEl: q('.bsr-cross'),
      helpEl: q('.bsr-help'), barEl: q('.bsr-bar'), cylEl: q('.bsr-cyl'), gunWords: q('.bsr-gunwords'), streakEl: q('.bsr-streak b'), bestEl: q('.bsr-best b'), dotsEl: q('.bsr-dots'), tagEls: [], sayT: 0 };
    q('.bsr-done').addEventListener('click', (e) => { e.stopPropagation(); J.done(); });
    flagCard(ui.cardEl, () => (card ? { choices: card.targets.map((x) => String(x.n)), right: rightNow(card, gone).map((i) => String(card.targets[i].n)).join(', ') } : {}));   // ("Confusing?": src/ui/flag.js)
    el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', () => { down = null; });
    addEventListener('keydown', onKey, true);
    gunWords(); dots();
  }
  function closeUi() {
    if (!ui) return;
    removeEventListener('keydown', onKey, true);
    clearTimeout(ui.sayT);
    ui.el.remove(); ui = null;
    document.body.classList.remove('bsr-aiming');
    camera.clearViewOffset(); camera.fov = FOV0; camera.near = NEAR0; camera.updateProjectionMatrix();
  }
  function gunWords() {
    if (!ui || !G) return;
    const n = G.reloading ? 0 : G.rounds;
    ui.cylEl.innerHTML = Array.from({ length: 6 }, (x, k) => { const a = -Math.PI / 2 + k * Math.PI / 3; return `<circle cx="${(Math.cos(a) * 13).toFixed(1)}" cy="${(Math.sin(a) * 13).toFixed(1)}" r="5.6" class="${k < n ? 'is-in' : ''}"/>`; }).join('') + '<circle r="3" class="bsr-pin"/>';
    ui.cylEl.style.transform = `rotate(${(6 - n) * 60}deg)`;
    ui.gunWords.textContent = G.reloading ? 'Reloading' : touch() ? 'Tap a target to shoot' : 'Click a target to shoot · R reloads';
    ui.el.classList.toggle('is-reloading', G.reloading);
  }
  function dots() { if (ui) ui.dotsEl.innerHTML = Array.from({ length: SHOOT.string }, (x, k) => `<i class="${k < inString ? 'is-on' : ''}"></i>`).join(''); }
  function scoreLine() { if (!ui) return; ui.streakEl.textContent = streak; ui.bestEl.textContent = REC.best; ui.el.querySelector('.bsr-streak').classList.toggle('is-hot', streak >= SHOOT.pay.streak); }

  // ── A CARD ─────────────────────────────────────────────────────────────────────────────────────────────────────
  // the next card: the maker that fits the rider now (counting for the youngest, the range's number sense after), at
  // the rider's level there
  let lastMap = null;
  function nextCard() {
    const map = chooseFor(rider, RANGE_MAPS, { last: lastMap, rand: () => rng.next() }) || 'range';
    lastMap = map;
    const q = askFor(rider, map);
    let c;
    if (map === 'counting') {
      const what = (N.state.what = N.state.what === 'can' ? 'bottle' : 'can');
      for (let k = 0; k < 8; k++) { c = countCard(q.step, { rng, what }); if (!recent.includes(c.key)) break; }
    } else { N.steer(q.step, { placing: q.placing }); c = N.card({ rng, recent }); }
    return { ...c, map, q, told: false };
  }
  // the skill model's part of this card's answer (once a card: see the notes at the top)
  const skillOf = (c) => (c && !c.told ? ((c.told = true), travel(c.q, { step: c.step })) : null);
  function newCard() {
    card = nextCard();
    recent.push(card.key); if (recent.length > 12) recent.shift();
    if (card.say && read && readAloud(rider) && read.can('counting')) read.say(card.say, { topic: 'counting' });
    gone = new Set(); tried = new Set(); wrong = 0; idle = 0; helped = false; between = false; held = null;
    R.setCard(card.targets.map(() => ({ kind: card.what })), { narrow: innerWidth < innerHeight * 0.8 });
    if (!ui) return;
    ui.ruleEl.textContent = card.rule;
    ui.subEl.textContent = card.sub;
    ui.stepEl.textContent = `${KEEPER.name.replace('Miss ', '')}'s card${card.q.placing ? ' · finding your level' : card.review ? ' · an easy one' : ''}`;
    ui.cardEl.classList.remove('is-in'); void ui.cardEl.offsetWidth; ui.cardEl.classList.add('is-in');
    ui.tagsEl.innerHTML = card.targets.map((x, i) => `<div class="bsr-tag" data-i="${i}"><b>${esc(numText(x.n))}</b></div>`).join('');
    ui.tagEls = [...ui.tagsEl.children];
    help(null);
  }

  // the tags follow their targets on the screen
  const _p = new THREE.Vector3();
  const screenOf = (v) => { _p.copy(v).project(camera); return { x: (_p.x + 1) / 2 * innerWidth, y: (1 - _p.y) / 2 * innerHeight, on: _p.z < 1 }; };
  function placeTags() {
    if (!ui || !card) return;
    R.targets.forEach((T, i) => {
      const el = ui.tagEls[i]; if (!el) return;
      const s = screenOf(T.top);
      el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
      el.classList.toggle('is-on', T.alive && T.state !== 'pop' && s.on);
    });
  }

  // which target a shot at (x, y) means: the nearest tag or body within a generous reach, or -1
  function targetAt(x, y) {
    if (!card) return -1;
    const reach = touch() ? SHOOT.reach.touch : SHOOT.reach.mouse;
    const pxPerM = innerHeight / 2 / Math.tan(camera.fov * Math.PI / 360) / Math.max(1, camera.position.distanceTo(R.layout.look));
    let best = -1, bs = Infinity;
    R.targets.forEach((T, i) => {
      if (!T.alive || T.state === 'pop') return;
      const b = screenOf(T.mid), tg = screenOf(T.top);
      const reachBody = Math.max(reach * 0.75, T.h * 0.8 * pxPerM);
      const s = Math.min(Math.hypot(x - b.x, y - b.y) / reachBody, Math.hypot(x - tg.x, y - (tg.y - 18)) / reach);
      if (s < 1 && s < bs) { bs = s; best = i; }
    });
    return best;
  }

  // ── SHOOTING ───────────────────────────────────────────────────────────────────────────────────────────────────
  function fire(x, y) {
    if (state !== 'aim' || !G || J.paused || !card) return false;
    cross.x = x; cross.y = y; cross.on = true; showCross();
    G.aim(x, y);
    if (G.reloading) return false;
    if (!G.fire()) return false;
    SND.shot(); SND.cock();
    if (G.rounds === 0) setTimeout(() => { if (!disposed && G && G.reloading) SND.reload(); }, 380);
    gunWords();
    idle = 0;
    const i = targetAt(x, y), my = card;
    ndc.set(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2); ray.setFromCamera(ndc, camera);
    const missAt = i < 0 ? R.rayHit(ray.ray) : null;
    setTimeout(() => { if (!disposed && card === my) land(i, missAt); }, SHOOT.resolve * 1000);
    return true;
  }
  function land(i, missAt) {
    if (i < 0) { if (missAt) { R.miss(missAt); SND.thud(missAt); } return; }
    const T = R.targets[i]; if (!T || !T.alive) return;
    const now = rightNow(card, gone);
    // (a real choice: something wrong still standing to pick instead; the last of an order is no choice)
    const choice = card.targets.some((x, k) => !gone.has(k) && !now.includes(k));
    if (now.includes(i)) right(i, T, choice); else miss(i, T);
  }
  function right(i, T, choice) {
    const at = R.hit(i);
    if (T.kind === 'bottle') SND.shatter(at); else SND.clank(at);
    gone.add(i);
    if (ui) for (const k of rightNow(card, gone)) { const t = ui.tagEls[k]; if (t) t.classList.remove('is-wrong'); }   // (the ones to shoot now never look struck out)
    // (the card cleared clean, with no number line come up by itself: the card's right answer for the skill model)
    const sk = isDone(card, gone) && wrong === 0 && !helped ? skillOf(card) : null;
    if (choice || sk) { const rec = recordAnswer(rider, true, { ...(sk || {}), range: true }); if (rec && rec.badge) hud.toast(`You earned the ${rec.badge} badge!`, 'gold'); }   // (range: the Sharpshooter's answers)
    streak++;
    let gold = SHOOT.pay.target + Math.floor(card.step / SHOOT.pay.every);
    let bonus = 0;
    if (streak % SHOOT.pay.streak === 0) bonus = SHOOT.pay.streakBonus;
    const e = earn(rider, gold + bonus);
    if (counted) { const c = countJob(rider, 'targets'); if (c.buckle) hud.buckle(c.buckle, { delay: 300 }); }
    if (streak > REC.best) { const was = REC.best; REC.best = streak; saveRider(rider); if (!beatBest && was >= 3) { beatBest = true; hud.toast(`A new best streak! ${streak} in a row`, 'gold'); } }
    if (bonus) hud.toast(`${streak} in a row! +${bonus} gold`, 'gold');
    if (e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 1500);
    refresh();
    scoreLine();
    floatGold(i, gold + bonus);
    const el = ui && ui.tagEls[i]; if (el) el.classList.add('is-hit');
    if (helped || !ui.helpEl.hidden) help(null);
    if (isDone(card, gone)) cardDone();
  }
  function miss(i, T) {
    const at = R.ping(i);
    SND.ping(at);
    const el = ui && ui.tagEls[i];
    // (struck through only when it is wrong for good: on an order card every target is shot in the end, so one shot
    // out of turn just shakes; a line through it would say "never this one")
    if (el) { el.classList.remove('is-shake'); void el.offsetWidth; el.classList.add('is-shake'); if (card.kind !== 'order') el.classList.add('is-wrong'); }
    if (!tried.has(i)) {
      tried.add(i); wrong++;
      const rec = recordAnswer(rider, false, { ...(wrong === 1 ? skillOf(card) || {} : {}), range: true }); if (rec && rec.badge) hud.toast(`You earned the ${rec.badge} badge!`, 'gold');
      streak = 0; scoreLine();
    }
    help({ pick: i });
  }
  function floatGold(i, n) {
    if (!ui) return;
    const T = R.targets[i], s = screenOf(T.top);
    const f = document.createElement('div'); f.className = 'bsr-plus'; f.textContent = `+${n}`;
    f.style.left = `${s.x}px`; f.style.top = `${s.y - 30}px`;
    ui.el.appendChild(f); setTimeout(() => f.remove(), 1200);
  }
  function cardDone() {
    held = null;   // (the shelf glides back to the middle while the next targets are on their way)
    const res = N.finish(card, wrong, { helped });   // (cleared after the number line came up by itself: paid, but not a clean card)
    between = true;
    inString++; dots();
    // (the rider's level has brought the next step of material: a word for it, once the level is found)
    // (harder numbers only past the highest step reached before: asking.js newBest)
    if (res.clean && !card.q.placing) { const q2 = askFor(rider, card.map); if (newBest(rider, q2)) hud.toast('Nice shooting! Harder numbers next', 'good'); }
    R.clear();
    const stringDone = inString >= SHOOT.string;
    if (stringDone) {
      const e = earn(rider, SHOOT.pay.string);
      REC.strings++; saveRider(rider);
      refresh();
      hud.toast(`A full string! +${SHOOT.pay.string} gold`, 'gold');
      if (e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 1800);
      keeperSay(KEEPER.thanks[(REC.strings - 1) % KEEPER.thanks.length], { ms: 4200 });
    }
    const my = card;
    setTimeout(() => {
      if (disposed || state !== 'aim' || card !== my) return;
      if (stringDone) { inString = 0; N.newString(); dots(); }
      newCard();
    }, (SHOOT.nextCard + (stringDone ? 0.6 : 0)) * 1000);
  }

  // ── THE HELP CARD: why not that one, and a number line to look at ─────────────────────────────────────────────
  function help(o) {
    if (!ui) return;
    const el = ui.helpEl;
    if (!o) { el.hidden = true; el.innerHTML = ''; return; }
    const hint = o.pick == null;
    const spec = lineFor(card, { pick: hint ? null : o.pick, gone, hint });
    const why = hint ? tipFor(card) : whyNot(card, o.pick, gone);
    el.innerHTML = `<div class="bsr-help-h">${hint ? 'Stuck? Here’s a way to see it' : `Not ${esc(numText(card.targets[o.pick].n))}`}</div>
      <p class="bsr-help-p">${esc(why)}</p><div class="bsr-line"></div>${!hint && spec.caption ? `<p class="bsr-help-c">${esc(spec.caption)}</p>` : ''}`;
    el.hidden = false;
    el.classList.remove('is-in'); void el.offsetWidth; el.classList.add('is-in');
    // (a rider who can't read yet hears the why, in the browser's voice, after the miss's own sound)
    if (!hint && readAloud(rider)) sayLine(`Not ${numText(card.targets[o.pick].n)}. ${why}`, { now: true, after: 600 });
    const holder = el.querySelector('.bsr-line');
    // (a young rider's counting card: its own picture, as the round-up's "Show me" draws it: the dots counted in a
    // ten-frame, or the hop of one on a number line; the answer kept hidden while it is only a hint)
    if (card.kind === 'pick' && card.pic && (card.pic.frame || card.pic.line)) showCountHelp(holder, { ...card.pic, reveal: !hint, picked: hint ? undefined : card.targets[o.pick].n, width: Math.max(240, Math.min(420, holder.clientWidth || 300)) });
    else holder.innerHTML = lineSvg(spec, Math.max(220, Math.min(420, holder.clientWidth || 300)));
    if (hint) helped = true;
  }

  // ── POINTER AND KEYS ───────────────────────────────────────────────────────────────────────────────────────────
  let down = null;
  function showCross() { if (!ui) return; ui.crossEl.hidden = !cross.on; ui.crossEl.style.transform = `translate(${cross.x}px, ${cross.y}px)`; ui.crossEl.classList.toggle('is-on', cross.on && targetAt(cross.x, cross.y) >= 0); }
  function onDown(e) {
    if (e.target.closest('button, .bsr-help')) return;
    if (e.pointerType === 'mouse') { if (e.button === 0) fire(e.clientX, e.clientY); return; }
    // a finger: the sights go where it touches (drag to adjust); lifting it fires
    down = { id: e.pointerId };
    cross.x = e.clientX; cross.y = e.clientY; cross.on = true; showCross(); if (G) G.aim(cross.x, cross.y);
    try { ui.el.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
  }
  function onMove(e) {
    if (e.pointerType === 'mouse' || (down && e.pointerId === down.id)) { cross.x = e.clientX; cross.y = e.clientY; cross.on = true; showCross(); if (G) G.aim(cross.x, cross.y); }
  }
  function onUp(e) {
    if (!down || e.pointerId !== down.id) return;
    down = null;
    fire(e.clientX, e.clientY);
  }
  function onKey(e) {
    if (e.key === 'Escape') { if (document.querySelector('.bms')) return; e.preventDefault(); e.stopPropagation(); J.done(); return; }
    if (state !== 'aim' || J.paused) return;
    if ((e.code === 'Space' || e.code === 'KeyF') && !e.repeat) { e.preventDefault(); e.stopPropagation(); fire(cross.x, cross.y); }
    else if (e.code === 'KeyR' && !e.repeat) { e.preventDefault(); e.stopPropagation(); if (G && G.reload()) { SND.reload(); gunWords(); } }
  }

  // ── PUTTING THE GUN AWAY ───────────────────────────────────────────────────────────────────────────────────────
  J.done = () => {
    if (state !== 'aim' && state !== 'in') return;
    state = 'out';
    if (G) G.show(false);
    help(null);
    if (ui) ui.tagsEl.innerHTML = '';
    R.clear(); card = null;
    // (the view eases back out from the eyes to where the chase camera is, right behind the rider)
    blend = { t: 0, from: camera.position.clone(), q: camera.quaternion.clone(), fov: camera.fov, dx: camera.view && camera.view.enabled ? camera.view.offsetX : 0, dy: camera.view && camera.view.enabled ? camera.view.offsetY : 0 };
    P.cam.snap();
  };
  function finishOut() {
    closeUi();
    blend = null; state = 'idle'; J.active = false;
    if (P.person) P.person.root.visible = true;
    SND.on(false);
    onStop();
    P.cam.snap();
  }

  // ── EACH FRAME ─────────────────────────────────────────────────────────────────────────────────────────────────
  J.update = (dt) => {
    if (disposed) return;
    R.update(J.paused ? 0 : dt);
    keeperStep(J.paused ? 0 : dt, J.paused || state !== 'idle');
    if (state === 'idle') { promptStep(); return; }
    J.prompt = null;
    if (J.paused) return;
    if (state === 'setting') { setting(dt); return; }
    // (moved off by the menu's "back to town": the gun goes back at once)
    const st = R.layout.stand;
    if (Math.hypot(P.position.x - st.x, P.position.z - st.z) > 3) { if (G) G.show(false); closeUi(); blend = null; state = 'idle'; J.active = false; if (P.person) P.person.root.visible = true; SND.on(false); R.clear(); card = null; onStop(); return; }
    if (state === 'out') {
      // from the eyes back out to behind the rider: the chase camera (placed by the player this frame) is where it ends
      blend.t += dt; const k = smooth(Math.min(1, blend.t / SHOOT.camIn));
      camera.position.lerpVectors(blend.from, _v.copy(camera.position), k);
      camera.quaternion.slerpQuaternions(blend.q, _q.copy(camera.quaternion), k);
      camera.fov = blend.fov + (FOV0 - blend.fov) * k;
      camera.setViewOffset(innerWidth, innerHeight, Math.round(blend.dx * (1 - k)), Math.round(blend.dy * (1 - k)), innerWidth, innerHeight);
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      if (P.person) P.person.root.visible = k > 0.5;
      if (G) G.update(dt, { camera, W });
      if (k >= 1) finishOut();
      return;
    }
    const k = placeView(dt);
    if (P.person) P.person.root.visible = state === 'in' && k < 0.6;
    if (state === 'in' && k >= 1) { blend = null; state = 'aim'; G.show(true); newCard(); }
    if (G) { G.update(dt, { camera, W }); if (ui && (G.reloading !== ui.el.classList.contains('is-reloading') || G.rounds !== ui.lastRounds)) { ui.lastRounds = G.rounds; gunWords(); } }
    if (state === 'aim') {
      placeTags();
      if (cross.on && ui) ui.crossEl.classList.toggle('is-on', targetAt(cross.x, cross.y) >= 0);
      if (card && !between && !helped && ui && ui.helpEl.hidden && (idle += dt) > SHOOT.helpAfter) help({});
    }
  };
  J.draw = () => { if (G && (state === 'aim' || state === 'in' || state === 'out')) G.render(renderer); };

  J.marks = () => (state === 'idle' ? [{ id: 'range', icon: 'job', x: R.layout.x, z: R.layout.z, label: 'The target range' }] : []);
  J.speaking = () => !say.hidden;   // (Miss Opal's speech card is on the screen: Old Hob waits his turn on a phone)
  J.tags = () => (card ? R.targets.map((T, i) => { const s = screenOf(T.top), b = screenOf(T.mid); return { n: card.targets[i].n, x: Math.round(b.x), y: Math.round(b.y), tagX: Math.round(s.x), tagY: Math.round(s.y), alive: T.alive, right: rightNow(card, gone).includes(i) }; }) : []);
  J.pick = (n) => { if (!card) return false; const i = card.targets.findIndex((x, k) => x.n === n && R.targets[k].alive); if (i < 0) return false; const b = screenOf(R.targets[i].mid); return fire(b.x, b.y); };
  J.state = () => ({ state, card: card ? { kind: card.kind, map: card.map, at: card.q ? card.q.at : null, finding: !!(card.q && card.q.placing), rule: card.rule, step: card.step, review: card.review, targets: card.targets.map((x) => x.n), right: rightNow(card, gone).map((i) => card.targets[i].n) } : null,
    rounds: G ? G.rounds : null, reloading: !!(G && G.reloading), streak, best: REC.best, inString, strings: REC.strings, wrong, help: !!(ui && !ui.helpEl.hidden), level: N.level(),
    fov: +camera.fov.toFixed(1), prompt: J.prompt, range: R.state() });
  J.range = R;
  J.layout = R.layout;
  J.dispose = () => {
    disposed = true;
    if (state !== 'idle') { closeUi(); if (P.person) P.person.root.visible = true; }
    removeEventListener('keydown', onKey, true);
    SND.dispose();
    if (G) G.dispose();
    R.dispose();
    if (K.p) { K.p.root.removeFromParent(); try { K.p.dispose(); } catch (e) { /* gone */ } }
    box.remove();
  };
  return J;
}

// ── THE NUMBER LINE (an SVG, from numbersense.js lineFor) ────────────────────────────────────────────────────────
export function lineSvg(L, width = 320) {
  const side = 22, crowd = (() => { let n = 0, best = 0, lx = -1e9; for (const d of [...(L.dots || [])].sort((p, q) => p.v - q.v)) { const x = side + (d.v - L.from) / Math.max(1e-6, L.to - L.from) * (width - 2 * side); n = x - lx < String(d.label || '').length * 3.75 + 16 ? n + 1 : 0; lx = x; best = Math.max(best, n); } return best; })();
  // (a rounding line: the band's words over it and "halfway" under the two halfway numbers; otherwise the band's words
  // go under the line)
  const halves = !!(L.half && L.half.length);
  const y0 = Math.max(halves ? 60 : L.arrow ? 54 : 40, 40 + crowd * 15), H = y0 + (halves ? 48 : L.shade && L.shade.label ? 54 : 34);
  const span = Math.max(1e-6, L.to - L.from), X = (v) => side + (v - L.from) / span * (width - 2 * side);
  const out = [];
  // the band (between the card's two ends, or what rounds to the card's number)
  if (L.shade) {
    const a = X(Math.max(L.from, L.shade.a)), b = X(Math.min(L.to, L.shade.b));
    out.push(`<rect x="${a.toFixed(1)}" y="${y0 - 16}" width="${(b - a).toFixed(1)}" height="16" class="nl-band"/>`);
    if (L.shade.label) out.push(`<text x="${((a + b) / 2).toFixed(1)}" y="${halves ? y0 - 22 : y0 + 46}" class="nl-bandt">${esc(L.shade.label)}</text>`);
  }
  // the line, its ticks and their numbers (fewer numbers when they would crowd)
  out.push(`<line x1="${side - 12}" y1="${y0}" x2="${width - side + 12}" y2="${y0}" class="nl-axis"/>`);
  out.push(`<path d="M${side - 14} ${y0} l8 -5 v10z M${width - side + 14} ${y0} l-8 -5 v10z" class="nl-end"/>`);
  if (L.minor > 0 && span / L.minor <= 200) for (let v = Math.ceil(L.from / L.minor) * L.minor; v <= L.to + 1e-9; v += L.minor) out.push(`<line x1="${X(v).toFixed(1)}" y1="${y0 - 4}" x2="${X(v).toFixed(1)}" y2="${y0 + 4}" class="nl-minor"/>`);
  const labW = Math.max(String(numText(L.from)).length, String(numText(L.to)).length) * 8.5 + 10;
  // The card's own numbers are always numbered: the band's two ends, and on a rounding line its ten and the halfway
  // marks (75, 80, 85). A plain tick's number that would sit on one of them is left off.
  const inLine = (v) => v >= L.from - 1e-9 && v <= L.to + 1e-9;
  const keys = L.shade ? [...new Set([L.shade.a, L.shade.b, ...(halves ? [...L.half, (L.shade.a + L.shade.b) / 2] : [])])].filter(inLine) : [];
  const nearKey = (v) => keys.some((k) => Math.abs(X(k) - X(v)) < labW);
  // (numbered every tick, or every few when they would crowd: at round steps, 100 200 300 rather than 100 250 400)
  const every = Math.max(1, Math.ceil(labW / Math.max(1, X(L.major) - X(0))));
  const labelStep = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000].find((n) => n % L.major === 0 && n >= L.major * every) || L.major * every;
  for (let v = Math.ceil(L.from / L.major) * L.major; v <= L.to + 1e-9; v += L.major) {
    const x = X(v).toFixed(1), zero = v === 0;
    out.push(`<line x1="${x}" y1="${y0 - (zero ? 11 : 7)}" x2="${x}" y2="${y0 + (zero ? 11 : 7)}" class="${zero ? 'nl-zero' : 'nl-major'}"/>`);
    if ((v % labelStep === 0 || zero) && !nearKey(v)) out.push(`<text x="${x}" y="${y0 + 26}" class="nl-num${zero ? ' is-zero' : ''}">${esc(numText(v))}</text>`);
  }
  for (const v of keys) {
    const x = X(v).toFixed(1);
    if (Math.abs(v / L.major - Math.round(v / L.major)) > 1e-9) out.push(`<line x1="${x}" y1="${y0 - 7}" x2="${x}" y2="${y0 + 7}" class="nl-major"/>`);
    out.push(`<text x="${x}" y="${y0 + 26}" class="nl-num is-key${v === 0 ? ' is-zero' : ''}">${esc(numText(v))}</text>`);
  }
  // the halfway marks
  for (const v of L.half || []) { const x = X(v).toFixed(1); out.push(`<line x1="${x}" y1="${y0 - 18}" x2="${x}" y2="${y0 + 10}" class="nl-half"/><text x="${x}" y="${y0 + 41}" class="nl-halft">halfway</text>`); }
  // The band's ends, over the line: an open circle where the end is left out of the band, a filled one where it is in.
  // Between −6 and 3 leaves out both ends; on a rounding line 75 rounds up to 80 (in) and 85 rounds up to 90 (out).
  if (L.shade && L.shade.open) {
    const inBand = { right: [L.shade.a], left: [L.shade.b] }[L.shade.open] || [];
    for (const v of [L.shade.a, L.shade.b]) if (inLine(v)) out.push(`<circle cx="${X(v).toFixed(1)}" cy="${y0}" r="5" class="${inBand.includes(v) ? 'nl-shut' : 'nl-open'}"/>`);
  }
  // the arrow: a pick hopping to the ten it rounds to, or the sum to its nearest ten
  if (L.arrow && Math.abs(X(L.arrow.to) - X(L.arrow.from)) > 18) {   // (a hop too short to draw is left to the words)
    const a = X(L.arrow.from), b = X(L.arrow.to), mid = (a + b) / 2, up = Math.min(30, 12 + Math.abs(b - a) * 0.25);
    out.push(`<path d="M${a.toFixed(1)} ${y0 - 9} Q${mid.toFixed(1)} ${y0 - 9 - up * 2} ${b.toFixed(1)} ${y0 - 9}" class="nl-arc"/>`);
    const dir = b >= a ? -1 : 1; out.push(`<path d="M${b.toFixed(1)} ${y0 - 8} l${dir * 7} -6 l${dir * 1} 8z" class="nl-arrow"/>`);
    if (L.arrow.label) out.push(`<text x="${mid.toFixed(1)}" y="${(y0 - 13 - up).toFixed(1)}" class="nl-arct">${esc(L.arrow.label)}</text>`);
  }
  // the dots, their numbers above (stepped up when two would overlap)
  const arcUp = L.arrow ? Math.min(30, 12 + Math.abs(X(L.arrow.to) - X(L.arrow.from)) * 0.25) : 0;   // (how high the hop's arc rises)
  const dots = [...(L.dots || [])].sort((p, q) => p.v - q.v);
  let lastX = -1e9, lift = 0;
  for (const d of dots) {
    const x = X(d.v), w = String(d.label || '').length * 7.5;
    lift = x - lastX < w / 2 + 16 ? lift + 1 : 0; lastX = x;
    // (the arc never runs through the number where a hop starts: a pick's number goes beside its dot, on the side away
    // from the hop; a longer one, like "19 + 22 = 41", goes over the top of the arc)
    const arcFrom = L.arrow && d.v === L.arrow.from && Math.abs(X(L.arrow.to) - x) > 18;
    const hop = arcFrom && d.kind === 'pick' && !lift ? Math.sign(X(L.arrow.to) - x) : 0;
    const lx = hop ? Math.max(w / 2 + 1, Math.min(width - w / 2 - 1, x - hop * (w / 2 + 6))) : x;
    const ly = hop ? y0 - 13 : arcFrom ? Math.min(y0 - 15 - lift * 15, y0 - 14 - arcUp) : y0 - 15 - lift * 15;
    if (d.kind === 'exact') out.push(`<path d="M${x.toFixed(1)} ${y0 - 7} l7 7 l-7 7 l-7 -7z" class="nl-exact"/>`);
    else if (d.kind === 'pick') out.push(`<circle cx="${x.toFixed(1)}" cy="${y0}" r="7" class="nl-pick"/><path d="M${(x - 4).toFixed(1)} ${y0 - 4} l8 8 m0 -8 l-8 8" class="nl-pickx"/>`);
    else out.push(`<circle cx="${x.toFixed(1)}" cy="${y0}" r="${d.kind === 'right' ? 6.5 : 5}" class="nl-dot is-${d.kind}"/>`);
    if (d.label) out.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="nl-dott is-${d.kind}">${esc(d.label)}</text>`);
  }
  return `<svg class="bsr-nl" viewBox="0 0 ${width} ${H}" width="100%" aria-hidden="true">${out.join('')}</svg>`;
}

function ensureCss() {
  if (document.getElementById('bsr-css')) return;
  const s = document.createElement('style'); s.id = 'bsr-css';
  s.textContent = `
body.bsr-aiming .bmh-top, body.bsr-aiming .bmh-touch, body.bsr-aiming .bmh-prompt, body.bsr-aiming .bmh-help, body.bsr-aiming .bmh-hob { visibility: hidden; }
@media (min-width: 761px) { body.bsr-aiming .bmh-bottom { bottom: 66px; } }   /* (the HUD's short notes over the gun's bar, not on it) */
.bsr { position: fixed; inset: 0; z-index: 0; cursor: none; touch-action: none; user-select: none; -webkit-user-select: none; }
.bsr-card { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); text-align: center; pointer-events: none; width: max-content; max-width: min(640px, calc(100vw - 24px));
  background: #f1e6cc; color: #2b1d12; border: 1px solid #8a6a3a; border-radius: 9px; padding: 5px 18px 7px; box-shadow: 0 4px 16px rgba(0,0,0,0.45); }
.bsr-card.is-in { animation: bsr-in 0.45s cubic-bezier(.2,.8,.3,1.2); }
@keyframes bsr-in { from { transform: translate(-50%, -14px); opacity: 0; } }
.bsr-step { display: block; font: 500 12px Bitter, Georgia, serif; color: #8a6a3a; letter-spacing: 0.03em; }
.bsr-rule { display: block; font: 700 27px/1.15 Bitter, Georgia, serif; }
.bsr-sub { display: block; font: 500 13.5px/1.3 Bitter, Georgia, serif; color: #6b5236; }
.bsr-say { display: block; font: italic 500 14px/1.3 Bitter, Georgia, serif; color: #7a3f12; margin-top: 3px; }
.bsr-say[hidden] { display: none; }
.bsr-tags { position: absolute; inset: 0; pointer-events: none; }
.bsr-tag { position: absolute; left: 0; top: 0; opacity: 0; transition: opacity 0.25s; will-change: transform; }
.bsr-tag.is-on { opacity: 1; }
.bsr-tag.is-hit { opacity: 0 !important; transition: opacity 0.35s; }
.bsr-tag b { position: absolute; left: 0; bottom: 4px; transform: translateX(-50%); display: block; min-width: 32px; padding: 3px 8px 4px;
  font: 700 19px/1 Bitter, Georgia, serif; color: #2b1d12; text-align: center; white-space: nowrap;
  background: #f4e9cf; border: 2px solid #b48a3c; border-radius: 5px; box-shadow: 0 2px 6px rgba(0,0,0,0.5); }
.bsr-tag b::after { content: ''; position: absolute; left: 50%; bottom: -7px; margin-left: -5px; border: 5px solid transparent; border-top-color: #b48a3c; border-bottom: 0; }
.bsr-tag.is-wrong b { color: #7a6a58; background: #ddd0b4; text-decoration: line-through; text-decoration-color: rgba(150,50,30,0.75); }
.bsr-tag.is-shake b { animation: bsr-shake 0.4s; }
@keyframes bsr-shake { 25% { margin-left: -6px; } 50% { margin-left: 6px; } 75% { margin-left: -3px; } }
.bsr-cross { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; }
.bsr-cross i { position: absolute; left: -17px; top: -17px; width: 34px; height: 34px; border-radius: 50%; border: 2px solid rgba(255,248,230,0.92); box-shadow: 0 0 0 1px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(0,0,0,0.35); }
.bsr-cross i::before, .bsr-cross i::after { content: ''; position: absolute; background: rgba(255,248,230,0.92); box-shadow: 0 0 0 1px rgba(0,0,0,0.35); }
.bsr-cross i::before { left: 15px; top: -8px; width: 2px; height: 46px; clip-path: polygon(0 0, 100% 0, 100% 35%, 0 35%, 0 65%, 100% 65%, 100% 100%, 0 100%); }
.bsr-cross i::after { top: 15px; left: -8px; height: 2px; width: 46px; clip-path: polygon(0 0, 35% 0, 35% 100%, 0 100%, 0 0, 65% 0, 100% 0, 100% 100%, 65% 100%); }
.bsr-cross.is-on i { border-color: #ffd36a; }
.is-touch .bsr-cross i { left: -24px; top: -24px; width: 48px; height: 48px; }
.is-touch .bsr-cross i::before { left: 22px; height: 60px; } .is-touch .bsr-cross i::after { top: 22px; width: 60px; }
.bsr-plus { position: absolute; transform: translateX(-50%); font: 700 20px Bitter, Georgia, serif; color: #ffd36a; text-shadow: 0 2px 4px rgba(0,0,0,0.7); pointer-events: none; animation: bsr-plus 1.2s ease-out forwards; }
@keyframes bsr-plus { to { transform: translate(-50%, -46px); opacity: 0; } }
.bsr-bar { position: absolute; left: 14px; right: 14px; bottom: 12px; display: flex; align-items: center; gap: 10px; pointer-events: none;
  font: 500 14px Bitter, Georgia, serif; color: #f1e6cc; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
.bsr-gun { display: flex; align-items: center; gap: 8px; background: rgba(30, 20, 12, 0.6); border-radius: 22px; padding: 4px 12px 4px 4px; }
.bsr-cyl { width: 36px; height: 36px; transition: transform 0.15s; }
.bsr-cyl circle { fill: #2a2420; stroke: #8f969a; stroke-width: 1.5; } .bsr-cyl circle.is-in { fill: #d8b25a; stroke: #6b4f1c; } .bsr-cyl .bsr-pin { fill: #8f969a; stroke: none; }
.is-reloading .bsr-cyl { animation: bsr-spin 0.4s linear infinite; }
@keyframes bsr-spin { to { transform: rotate(360deg); } }
.bsr-score { display: flex; align-items: center; gap: 14px; background: rgba(30, 20, 12, 0.6); border-radius: 22px; padding: 6px 14px; }
.bsr-score b { font-weight: 700; color: #ffd36a; }
.bsr-streak.is-hot b { color: #ff9a4a; }
.bsr-dots { display: flex; gap: 5px; } .bsr-dots i { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #c39a45; } .bsr-dots i.is-on { background: #e2ad4c; }
.bsr-done { margin-left: auto; pointer-events: auto; cursor: pointer; font: 600 15px Bitter, Georgia, serif; color: #f1e6cc; background: rgba(60, 40, 22, 0.92); border: 1px solid #8a6a3a; border-radius: 8px;
  padding: 7px 14px; display: flex; gap: 8px; align-items: baseline; }
.bsr-done small { font: 500 11px ui-monospace, monospace; opacity: 0.7; }
.bsr-done:hover { background: rgba(84, 58, 30, 0.95); }
.bsr-help { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); width: min(380px, 34vw); cursor: default; pointer-events: auto;
  background: #f1e6cc; color: #2b1d12; border: 1px solid #8a6a3a; border-radius: 10px; padding: 9px 14px 10px; box-shadow: 0 6px 22px rgba(0,0,0,0.5); }
.bsr-help[hidden] { display: none; }
.bsr-help.is-in { animation: bsr-help 0.35s ease-out; }
@keyframes bsr-help { from { opacity: 0; transform: translate(12px, -50%); } }
.bsr-help-h { font: 400 18px Rye, Georgia, serif; color: #6b3f12; }
.bsr-help-p { font: 500 15px/1.35 Bitter, Georgia, serif; margin: 3px 0 4px; }
.bsr-help-c { font: italic 500 13px/1.3 Bitter, Georgia, serif; color: #6b5236; margin: 2px 0 0; }
.bsr-line { width: 100%; }
.bsr-nl { display: block; }
.bsr-nl .nl-axis { stroke: #3b2a1a; stroke-width: 2.5; } .bsr-nl .nl-end { fill: #3b2a1a; }
.bsr-nl .nl-minor { stroke: #8a7458; stroke-width: 1; } .bsr-nl .nl-major { stroke: #3b2a1a; stroke-width: 1.6; } .bsr-nl .nl-zero { stroke: #2b1d12; stroke-width: 2.6; }
.bsr-nl text { font: 600 13px Bitter, Georgia, serif; fill: #3b2a1a; text-anchor: middle; }
.bsr-nl .nl-num.is-zero { font-weight: 800; }
.bsr-nl .nl-band { fill: rgba(226, 173, 76, 0.38); } .bsr-nl .nl-bandt { font: italic 600 12.5px Bitter, Georgia, serif; fill: #7a5320; }
.bsr-nl .nl-open { fill: #f1e6cc; stroke: #7a5320; stroke-width: 2; } .bsr-nl .nl-shut { fill: #7a5320; stroke: #7a5320; stroke-width: 2; }
.bsr-nl .nl-num.is-key { font-weight: 800; fill: #7a5320; }
.bsr-nl .nl-half { stroke: #9a5a1a; stroke-width: 1.6; stroke-dasharray: 3 3; } .bsr-nl .nl-halft { font: italic 600 11px Bitter, Georgia, serif; fill: #9a5a1a; }
.bsr-nl .nl-arc { fill: none; stroke: #8a3a14; stroke-width: 2; } .bsr-nl .nl-arrow { fill: #8a3a14; } .bsr-nl .nl-arct { font: italic 600 12px Bitter, Georgia, serif; fill: #8a3a14; }
.bsr-nl .nl-dot.is-other { fill: #8a7a66; } .bsr-nl .nl-dot.is-gone { fill: none; stroke: #b8a88e; stroke-width: 1.5; } .bsr-nl .nl-dot.is-right { fill: #3f7a3a; stroke: #f1e6cc; stroke-width: 1.5; }
.bsr-nl .nl-pick { fill: #f6d8c8; stroke: #a83a1e; stroke-width: 2.2; } .bsr-nl .nl-pickx { stroke: #a83a1e; stroke-width: 2; }
.bsr-nl .nl-exact { fill: #2b1d12; }
.bsr-nl .nl-dott.is-pick { fill: #a83a1e; font-weight: 800; } .bsr-nl .nl-dott.is-right { fill: #2f6a2a; font-weight: 800; } .bsr-nl .nl-dott.is-gone { fill: #b8a88e; } .bsr-nl .nl-dott.is-exact { font-weight: 800; }
@media (max-width: 760px) {
  .bsr-card { top: 66px; padding: 4px 12px 6px; }
  .bsr-rule { font-size: 20px; } .bsr-sub { font-size: 12.5px; } .bsr-step { font-size: 11px; }
  .bsr-help { left: 10px; right: 10px; width: auto; top: auto; bottom: 64px; transform: none; padding: 7px 11px 8px; }
  @keyframes bsr-help { from { opacity: 0; transform: translateY(12px); } }
  .bsr-help-h { font-size: 16px; } .bsr-help-p { font-size: 14px; }
  .bsr-bar { left: 8px; right: 8px; bottom: 8px; gap: 6px; font-size: 13px; }
  .bsr-gunwords { display: none; } .bsr-score { gap: 9px; padding: 5px 10px; } .bsr-best { display: none; }
  .bsr-tag b { font-size: 17px; padding: 3px 6px 4px; min-width: 28px; }
}
@media (max-height: 500px) and (min-aspect-ratio: 4/3) {
  .bsr-card { top: 6px; left: auto; right: 112px; transform: none; max-width: calc(100vw - 340px); }
  @keyframes bsr-in { from { opacity: 0; } }
  .bsr-rule { font-size: 18px; } .bsr-sub { display: none; }
  .bsr-help { right: 8px; top: auto; bottom: 54px; transform: none; width: min(360px, 46vw); }
}
`;
  document.head.appendChild(s);
}
