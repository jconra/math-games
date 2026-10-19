// THE FISHING LAB: fish off the end of a dock, and every fish that comes up asks a fractions or ratio question. A Bandit
// Math prototype page, standing on its own (it changes nothing in the game; it reads the game's fonts, ground
// textures, trees, the cabin and the townsfolk, and borrows the windmill lab's teach card and wood pictures).
//
// How it goes: tap (or click) the water to cast there; hold and drag first to aim, let go to cast. The bobber floats;
// a fish swims up, nibbles, then bites (the bobber goes under, a splash, "A bite!"). The bite waits for you: hold the
// Reel button (or hold anywhere on the water, or Space) to reel in. Now and then the fish runs: the line tightens; ease
// off and it calms (hold on and the drag lets out a little line: the fish is never lost). Up it comes, hanging from the
// rod, with its length and weight, and a question (questions.js: the ladder of steps). Keep or throw back against the
// keeper limit, line it up with fish from your creel, add the weights, or a ratio about the catch. Right: it goes
// on the stringer (or back in the lake). Wrong: a nudge with a picture (a ruler, fraction bars, a weight bar, a ratio
// table) and the right call; "Teach me" works an example through, "Try it" asks one more. The ladder's step is kept in
// localStorage, with the biggest fish ever and the fish book (every kind in three sizes).
//
// Files: scene.js (the lake), angler.js (the person, the rod, line and bobber), fish.js (fish made in code),
// questions.js (the math), frac.js (exact fractions and the words), pics.js (the pictures), sound.js.
// ?perf shows frames a second; ?fast makes the fish bite quickly; ?step=N starts on step N (1 to 8).
// window.FI, a handle for test scripts: FI.state(), FI.question() -> { answer, choices, labels, topic, level, from,
//   action, answered } or null, FI.toScreen(x, y, z) -> page pixels, FI.waterSpot(x, z) -> page pixels of a spot on the
//   water, FI.bobber(), FI.fps(), FI.setStep(n), FI.state().
import * as THREE from 'three';
import { makeLake, DECK, ANGLER, STRINGER, isWater } from './scene.js';
import { makeAngler, HOLD } from './angler.js';
import { makeFish } from './fish.js';
import * as sound from './sound.js';
import { showTeach } from '../windmill/teach.js';
import { ladderQuestion, questionOf, stepLadder, readLadder, freshLadder, LADDER_KEY, LADDER_TOP, STEP_NAMES, KINDS, KIND_LIST, SIZES,
  beatsRecord, readRecord, readBook, addToBook, bookCount, BOOK_TOTAL, RECORD_KEY, BOOK_KEY, RECENT, label, feet, TOPICS_AT } from './questions.js';
import { value } from './frac.js';
import { fishSvg } from './pics.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const phone = matchMedia('(max-width: 700px)').matches || /Mobi|Android/i.test(navigator.userAgent);
const touchy = matchMedia('(pointer: coarse)').matches;
const FAST = params.has('fast');
const REEL_CLIP = 'Lasso_Pull';
const HANG = 0.75;                // the line from the rod tip to a fish held up to look at
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);
const rnd = (a, b) => a + Math.random() * (b - a);
// numbers with fractions written stacked: "1 1/4" -> 1 and a small 1 over 4
const fracHTML = (s) => String(s).replace(/(\d+) (\d+)\/(\d+)/g, '$1<span class="fr"><i>$2</i><i>$3</i></span>').replace(/(\d+)\/(\d+)/g, '<span class="fr"><i>$1</i><i>$2</i></span>');

// ── the renderer, camera, lake, angler ───────────────────────────────────────────────────────────────────────────────
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
// (near 0.1 m: nothing comes closer to the lens, even held up to look at; far 1500 m: past the far hills, the sky is
// drawn at the far plane anyway. A tight range keeps the depth sorting sharp for small things on the dock.)
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1500);
const lake = makeLake({ low: phone });
const { scene } = lake;
let angler = null;

// ── what's been caught, saved ────────────────────────────────────────────────────────────────────────────────────────
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked: lasts the visit */ } } };
let ladder = readLadder(store.get(LADDER_KEY));
if (params.has('step')) ladder = { level: clamp(Math.round(+params.get('step')) || 1, 1, LADDER_TOP), streak: 0, placing: false, slips: 0 };
const saveLadder = () => store.set(LADDER_KEY, JSON.stringify(ladder));
let record = readRecord(store.get(RECORD_KEY));
let book = readBook(store.get(BOOK_KEY));
const creel = [];                 // kept fish (questions.js fish: { kind, len, lb }), oldest first
const counts = {};                // caught of each kind (kept or not), this visit
const recent = [];                // the last questions' keys
let kept = 0, back = 0;

// ── the camera: behind the angler's right shoulder, looking out over the lake; close on a fish when one comes up ──
const cam = { pos: new THREE.Vector3(2.7, DECK + 2.5, 6.4), look: new THREE.Vector3(-0.8, 0.1, -12), wantPos: new THREE.Vector3(), wantLook: new THREE.Vector3() };
let portrait = false;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); portrait = camera.aspect < 0.8;
  camera.fov = camera.aspect < 0.6 ? 60 : camera.aspect < 1 ? 52 : 42; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
function baseFrame(pos, look) {
  if (portrait) { pos.set(1.7, DECK + 3.1, 7.8); look.set(-0.5, -0.2, -11); }
  else { pos.set(2.7, DECK + 2.5, 6.4); look.set(-0.8, 0.1, -12); }
}
// close on the hanging fish: from the right front, the fish to the left of the card (desktop) or above it (phone)
const _r = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3();
function fishFrame(pos, look, at, L) {
  const dist = 0.55 + L * 2.7;
  at = at.clone(); at.y -= L * 0.5;                     // (the fish's middle: it hangs from its nose)
  pos.copy(at).add(_f.set(-0.45, 0.12, -1).normalize().multiplyScalar(dist));
  look.copy(at);
  // shift what the camera looks at so the fish sits clear of the card
  _f.copy(at).sub(pos).normalize(); _r.crossVectors(_f, new THREE.Vector3(0, 1, 0)).normalize(); _u.crossVectors(_r, _f);
  const tv = Math.tan(camera.fov * Math.PI / 360) * dist;
  if (portrait) look.addScaledVector(_u, -tv * 0.5);
  else look.addScaledVector(_r, tv * camera.aspect * 0.3);
}

// ── the game's state ─────────────────────────────────────────────────────────────────────────────────────────────────
// phase: ready (waiting for a cast) | cast (the throw, the bobber flying) | wait (floating) | bite | reel | lift (the fish
// coming up) | card (the question) | stash (into the creel) | release (back in the lake)
const S = {
  phase: 'ready', t: 0, aim: null, aiming: false, holding: false, keyHold: false, btnHold: false,
  bob: new THREE.Vector3(), castFrom: new THREE.Vector3(), castTo: new THREE.Vector3(), castDur: 1, launched: false, castYaw: 0,
  biteAt: 0, nibbles: [], q: null, hooked: null, reel: null, firstCast: true,
  rod: { yaw: 0, pitch: 0.6, bend: 0.08 }, hang: new THREE.Vector3(), hangV: new THREE.Vector3(),
};
const stringer = [];       // [{ F (the fish's 3D object), data }], up to 8 shown
const leaving = [];        // fish swimming off after being thrown back
const swimmers = [];       // a few fish going about their business under the water

// ── the aim ring on the water ────────────────────────────────────────────────────────────────────────────────────────
const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff3c8, transparent: true, opacity: 0.85, depthWrite: false }));
aimRing.renderOrder = 5; aimRing.visible = false; scene.add(aimRing);
const AIM = { min: 6, max: 24, yaw: 0.8 };
const lastAim = new THREE.Vector3(-1, 0, -14);
// a spot on the water the bobber can reach: within the fan in front of the dock, on open water
function clampAim(v) {
  const dx = v.x - ANGLER.x, dz = v.z - ANGLER.z;
  let yaw = Math.atan2(-dx, -dz), d = Math.hypot(dx, dz);
  yaw = clamp(yaw, -AIM.yaw, AIM.yaw); d = clamp(d, AIM.min, AIM.max);
  const out = new THREE.Vector3();
  for (let k = 0; k < 30; k++) {
    out.set(ANGLER.x - Math.sin(yaw) * d, 0, ANGLER.z - Math.cos(yaw) * d);
    if (isWater(out.x, out.z)) return out;
    d = Math.max(AIM.min, d - 1); if (k > 15) yaw *= 0.85;
  }
  return out.set(ANGLER.x, 0, ANGLER.z - 12);
}
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function pointerWater(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (ray.ray.intersectPlane(plane, hit)) return clampAim(hit);
  // (above the horizon: as far out as a cast goes, that way)
  return clampAim(hit.copy(ray.ray.origin).addScaledVector(ray.ray.direction, 60).setY(0));
}

// ── the hint along the bottom and the reel panel ────────────────────────────────────────────────────────────────────
const HINTS = {
  ready: touchy ? 'Tap the water to cast. Hold and drag to aim.' : 'Click the water to cast. Hold and drag to aim.',
  wait: 'Watch the bobber…',
  bite: touchy ? 'A bite! Hold the Reel button.' : 'A bite! Hold the mouse button (or Space) to reel.',
  reel: 'Reel it in. Ease off when it runs!',
  run: 'It\'s running! Ease off a moment.',
};
let hintKey = '';
function hint(key, text = HINTS[key] || '') { if (hintKey === key && $('hint').textContent === text) return; hintKey = key; const h = $('hint'); h.textContent = text; h.classList.toggle('is-bite', key === 'bite'); }
const reelUI = { box: $('reel'), btn: $('reel-btn'), tension: $('tension'), reeled: $('reeled') };

// ── casting ──────────────────────────────────────────────────────────────────────────────────────────────────────────
function cast(to) {
  if (!angler) return;
  if (S.phase === 'wait') clearHooked();           // (a fresh cast while waiting: the fish that was coming swims off)
  lastAim.copy(to);
  S.phase = 'cast'; S.t = 0; S.launched = false;
  S.castTo.copy(to); S.castYaw = Math.atan2(-(to.x - ANGLER.x), -(to.z - ANGLER.z));
  angler.play('Lasso_Throw', { once: true, fade: 0.12 });
  angler.bobber.visible = false; aimRing.visible = false;
  hint('cast', '');
}
// the fish for this cast: the question decides its kind and size, then it swims up under the bobber
function hookFish() {
  const q = ladderQuestion(ladder.level, Math.random, { creel, counts }, recent);
  recent.push(q.key); if (recent.length > RECENT) recent.shift();
  S.q = q;
  const L = value(feet(q.fish.len)) * 0.3048;
  const F = makeFish(q.fish.kind, L);
  const a = Math.random() * Math.PI * 2;
  F.root.position.set(S.bob.x + Math.cos(a) * 2.6, -0.8, S.bob.z + Math.sin(a) * 2.6);
  F.wiggle = 0.25; F.speed = 6;
  scene.add(F.root);
  S.hooked = { F, L };
  const wait = FAST ? 0.9 : S.firstCast ? 2.4 : rnd(2.6, 5.5);
  S.firstCast = false;
  S.biteAt = S.t + wait;
  S.nibbles = wait > 2 ? [S.biteAt - 1.4, S.biteAt - 0.75] : [S.biteAt - 0.5];
}
function clearHooked() { if (S.hooked) { leaving.push({ F: S.hooked.F, t: 0, dir: new THREE.Vector3(rnd(-1, 1), -0.2, -1).normalize() }); S.hooked = null; } S.q = null; }

// ── reeling ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const holding = () => S.holding || S.keyHold || S.btnHold;
function startReel() {
  S.phase = 'reel'; S.t = 0;
  const strength = clamp(value(S.q.fish.lb), 0.15, 4);
  const to = new THREE.Vector3(ANGLER.x + 0.6, 0, ANGLER.z - 1.6);
  S.reel = { p: 0, T: 0.25, runLeft: 0, nextRun: rnd(0.6, 1.4), side: 0, sideT: 0, strength, from: S.bob.clone().setY(0), to, click: 0, gave: 0 };
  reelUI.btn.classList.remove('is-calling');
  hint('reel');
}
function updateReel(dt) {
  const R = S.reel, F = S.hooked.F;
  // the fish runs now and then, bigger fish harder and longer
  if (R.runLeft > 0) R.runLeft -= dt;
  else if ((R.nextRun -= dt) <= 0) {
    R.runLeft = rnd(0.6, 1.0) + R.strength * 0.15; R.nextRun = rnd(1.4, 2.8);
    R.sideT = (Math.random() < 0.5 ? -1 : 1) * rnd(1, 2.6) * (1 - R.p * 0.7);
    lake.ripple(F.root.position.x, F.root.position.z, 0.7); sound.splash(0.25);
  }
  const run = R.runLeft > 0, hold = holding();
  if (hold) {
    R.p += dt * (run ? 0.06 : 0.24) / (0.85 + R.strength * 0.12);
    R.T += dt * (run ? 0.85 : -0.4); R.T = Math.max(R.T, 0.28);
    if ((R.click -= dt) <= 0) { sound.click(run ? 0.3 : 1); R.click = run ? 0.12 : 0.06; }
  } else { R.T -= dt * 1.1; if (run) R.p -= dt * 0.04; }
  R.T = clamp(R.T, 0, 1);
  if (R.T >= 1) { R.p -= 0.05; R.T = 0.68; R.gave++; sound.drag(450); }
  R.p = clamp(R.p, 0, 1);
  R.side += ((run ? R.sideT : R.sideT * 0.25) - R.side) * dt * (run ? 2.5 : 1);
  // where the fish is: drawn in from where it bit toward the dock, swinging out to the side when it runs
  const base = R.from.clone().lerp(R.to, ease(R.p)), d = R.to.clone().sub(R.from).setY(0).normalize(), perp = new THREE.Vector3(-d.z, 0, d.x);
  base.addScaledVector(perp, R.side * (1 - R.p));
  F.root.position.set(base.x, -0.42 + R.p * 0.25, base.z);
  F.root.rotation.set(0, Math.atan2(R.to.x - base.x, R.to.z - base.z) + (run ? Math.sign(R.sideT) * 0.7 : 0), 0);
  F.wiggle = run ? 0.9 : hold ? 0.5 : 0.3; F.speed = run ? 16 : 10;
  S.bob.set(base.x, run ? -0.03 : 0.005 + Math.sin(S.t * 8) * 0.01, base.z);
  hint(run ? 'run' : 'reel');
  reelUI.tension.style.width = (R.T * 100).toFixed(0) + '%';
  reelUI.tension.parentElement.parentElement.classList.toggle('is-high', R.T > 0.75);
  reelUI.reeled.style.width = (R.p * 100).toFixed(0) + '%';
  if (R.p >= 1) startLift();
}

// ── up it comes ──────────────────────────────────────────────────────────────────────────────────────────────────────
function startLift() {
  S.phase = 'lift'; S.t = 0;
  const F = S.hooked.F; S.liftFrom = F.root.position.clone();
  lake.ripple(F.root.position.x, F.root.position.z, 1.4); sound.landed();
  angler.play(HOLD, { fade: 0.3 });
  reelUI.box.hidden = true; hint('lift', '');
  S.hangV.set(0, 0, 0);
}
// the hanging fish: nose up at the end of the line under the rod tip, its side to the camera, swinging a little
function hangFish(dt) {
  const F = S.hooked.F, want = angler.tip.clone().add(new THREE.Vector3(0, -HANG, 0));
  // a simple swing: the hang point chases the spot under the tip
  const acc = want.clone().sub(S.hang).multiplyScalar(30).addScaledVector(S.hangV, -3.2);
  S.hangV.addScaledVector(acc, dt); S.hang.addScaledVector(S.hangV, dt);
  F.root.position.copy(S.hang);
  const c = camera.position.clone().sub(S.hang); const yaw = Math.atan2(-c.z, c.x);
  F.root.rotation.set(-Math.PI / 2 + Math.sin(S.t * 2.1) * 0.08, yaw + Math.sin(S.t * 1.3) * 0.15, 0, 'YXZ');
}

// ── the question card ────────────────────────────────────────────────────────────────────────────────────────────────
const card = $('card');
// C: what the card shows. catchQ: the fish's own question; q: the one on the card (the catch's, or a "Try it");
// answered: null or { pick, right }; practice: the "Try it" question is up
const C = { catchQ: null, q: null, answered: null, practice: false, catchAnswered: false };
const PRAISE = ['Right!', 'Right! Nice work.', 'Right! Sharp eye.', 'Right! You have it.'];
const ACTION = { keep: 'Into the creel', throw: 'Throw it back' };
function stars() {
  const n = ladder.level;
  return `<div class="steps" title="Level ${n} of ${LADDER_TOP}: ${STEP_NAMES[n]}">${'★'.repeat(n)}${'☆'.repeat(LADDER_TOP - n)}<span class="lvl">Level ${n} of ${LADDER_TOP}</span><span class="nm">${STEP_NAMES[n]}</span></div>`;
}
function openCard(q) {
  C.catchQ = q; C.q = q; C.answered = null; C.practice = false; C.catchAnswered = false;
  if (q.topic === 'keep') lake.setSign(`${KINDS[q.fish.kind].one.toUpperCase()} LIMIT`, label(q.limit));
  renderCard();
}
function renderCard() {
  const q = C.q, a = C.answered, K = KINDS[C.catchQ.fish.kind];
  const shown = q.shown || q.fish.len;
  const head = C.practice ? '<h2>Try it</h2>'
    : `<h2>A ${K.name}!</h2><div class="measure"><div><small>Length</small><b>${fracHTML(label(shown))}</b></div><div><small>Weight</small><b>${fracHTML(label(q.fish.lb))}</b></div></div>`;
  const rows = q.topic === 'keep' || q.topic === 'order';
  card.classList.remove('teach'); card.classList.toggle('is-answered', !!a);
  card.innerHTML = `${stars()}${head}${q.svg || ''}<p class="prompt">${fracHTML(q.prompt)}</p>
    <div class="choices${rows ? ' is-rows' : ''}">${q.choices.map((c, i) => `<button data-i="${i}">${fracHTML(q.labels[i])}</button>`).join('')}</div>
    <div class="why" hidden></div>
    <div class="row"><button class="btn" id="q-teach">Teach me</button><button class="btn go" id="q-go" hidden></button></div>`;
  card.hidden = false; card.scrollTop = 0;
  card.querySelectorAll('.choices button').forEach((b) => { b.onclick = () => pick(+b.dataset.i); });
  card.querySelector('#q-teach').onclick = teach;
  card.querySelector('#q-go').onclick = () => finishCatch();
  if (a) showAnswer(a, false);
}
function pick(i) {
  if (C.answered || card.hidden || card.classList.contains('teach')) return;
  const q = C.q, right = q.choices[i] === q.answer;
  C.answered = { pick: i, right };
  if (!C.practice) C.catchAnswered = true;
  const was = ladder.level; ladder = stepLadder(ladder, right); saveLadder();
  C.answered.up = ladder.level > was; C.answered.down = ladder.level < was;
  if (right) sound.chime(); else sound.soft();
  showAnswer(C.answered, true);
}
function showAnswer(a, fresh) {
  const q = C.q, why = card.querySelector('.why'), go = card.querySelector('#q-go');
  card.classList.add('is-answered');
  card.querySelectorAll('.choices button').forEach((x, j) => { x.disabled = true; if (q.choices[j] === q.answer) x.classList.add('is-right'); if (j === a.pick && !a.right) x.classList.add('is-wrong'); });
  why.hidden = false; why.classList.toggle('is-right', a.right);
  const step = a.up ? ' <b>Next fish: a step harder.</b>' : '';
  why.innerHTML = a.right ? `<b>${PRAISE[Math.floor(Math.random() * PRAISE.length)]}</b> ${fracHTML(q.why)}${step}` : `<b>Not quite.</b> ${fracHTML(q.why)}${q.helper || ''}`;
  go.textContent = ACTION[C.catchQ.action]; go.hidden = false;
  card.querySelector('#q-teach').hidden = a.right;
  if (a.right && fresh) {
    // a right answer carries straight on (tap the card to go sooner)
    const n = ++autoN;
    setTimeout(() => { if (n === autoN && !card.hidden && C.answered === a) finishCatch(); }, 2600 + Math.min(2500, q.why.length * 12));
  }
  if (!a.right) why.scrollIntoView({ block: 'nearest' });
}
let autoN = 0;
card.addEventListener('click', (e) => { if (C.answered && C.answered.right && !card.classList.contains('teach') && !e.target.closest('button')) finishCatch(); });
// "Teach me": the idea worked through on a fresh example of the same kind (teach.js), then "Try it"
function teach() {
  const ex = questionOf(C.q.topic, C.q.from, Math.random, { counts });
  showTeach(card, { title: 'How it works', rule: fracHTML(ex.rule), picture: ex.lessonPic, example: fracHTML(ex.prompt), steps: ex.steps.map(fracHTML), answer: fracHTML(ex.answerLabel) }, {
    onTry: () => {
      if (!C.catchAnswered) { C.q = C.catchQ; C.answered = null; C.practice = false; }
      else { C.q = questionOf(C.catchQ.topic, C.catchQ.from, Math.random, { counts }); C.answered = null; C.practice = true; }
      renderCard();
    },
    onBack: () => renderCard(),
  });
  const backBtn = card.querySelector('[data-teach="back"]'); if (backBtn) backBtn.textContent = 'Back';
  card.scrollTop = 0;
}
function finishCatch() {
  if (card.hidden || S.phase !== 'card') return;
  autoN++;
  card.hidden = true;
  const q = C.catchQ;
  if (q.action === 'keep') startStash(); else startRelease();
}

// ── into the creel, or back in the lake ─────────────────────────────────────────────────────────────────────────────
function stringerSpot(i) {
  // fanned out along the rope from the corner post's top, a little lower each, swinging out to the side
  const t = 0.12 + i * 0.07, top = STRINGER.clone(), bottom = new THREE.Vector3(STRINGER.x + 0.15, -0.4, STRINGER.z - 0.25);
  return top.lerp(bottom, t).add(new THREE.Vector3(0.06 + (i % 2) * 0.12, 0, 0.04 + Math.floor(i / 2) * 0.03));
}
const STRINGER_YAW = Math.atan2(-(6.4 - STRINGER.z), 2.7 - STRINGER.x);
function startStash() { S.phase = 'stash'; S.t = 0; S.stashFrom = S.hooked.F.root.position.clone(); S.stashTo = stringerSpot(Math.min(stringer.length, 7)); }
function startRelease() { S.phase = 'release'; S.t = 0; S.relFrom = S.hooked.F.root.position.clone(); S.relTo = new THREE.Vector3(S.relFrom.x + 0.6, -0.05, S.relFrom.z - 1.8); }
function caught(keptIt) {
  const q = C.catchQ, fish = q.fish;
  counts[fish.kind] = (counts[fish.kind] || 0) + 1;
  const b = addToBook(book, fish); book = b.book; store.set(BOOK_KEY, JSON.stringify(book));
  let toast = null;
  if (keptIt) {
    kept++; creel.push(fish); if (creel.length > 12) creel.shift();
    if (beatsRecord(record, fish)) { const first = !record; record = { kind: fish.kind, len: fish.len, lb: fish.lb }; store.set(RECORD_KEY, JSON.stringify(record)); if (!first) { toast = ['New biggest fish!', `${label(fish.len)} ${KINDS[fish.kind].one}`]; sound.record(); } }
  } else back++;
  if (!toast && b.newSize) toast = ['New in the fish book', `${b.size === 'small' ? 'a small' : b.size === 'trophy' ? 'a trophy' : 'a keeper'} ${KINDS[fish.kind].one}`];
  if (toast) showToast(...toast);
  hud();
  if (q.topic === 'keep') lake.setSign('KEEPER LIMIT', label(q.limit));
}
function showToast(big, small) {
  const t = $('toast'); t.hidden = false; t.innerHTML = `${fracHTML(big)}<small>${fracHTML(small)}</small>`;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(showToast.h); showToast.h = setTimeout(() => { t.hidden = true; }, 2700);
}
function hud() {
  $('kept').textContent = kept; $('back').textContent = back;
  $('best').innerHTML = record ? `${fracHTML(label(record.len))} <em>${KINDS[record.kind].one}</em>` : 'none yet';
  $('book-n').textContent = `${bookCount(book)}/${BOOK_TOTAL}`;
}

// ── the fish book ────────────────────────────────────────────────────────────────────────────────────────────────────
function openBook() {
  const el = $('book'), sizeName = { small: 'Small', keeper: 'Keeper', trophy: 'Trophy' };
  let grid = '<div></div>' + SIZES.map((s) => `<div class="hd">${sizeName[s]}</div>`).join('');
  for (const k of KIND_LIST) {
    const e = book[k], K = KINDS[k];
    grid += `<div class="kind">${K.name[0].toUpperCase() + K.name.slice(1)}<small>${e.caught} caught${e.best ? `, best ${fracHTML(label(e.best))}` : ''}</small></div>`;
    SIZES.forEach((s, i) => {
      const w = [44, 62, 80][i];
      grid += `<div class="slot${e[s] ? ' is-got' : ''}">${e[s] ? `<svg viewBox="0 0 100 40">${fishSvg(50 - w / 2, 50 + w / 2, 20, K.colour)}</svg>` : '<span>?</span>'}</div>`;
    });
  }
  el.innerHTML = `<h2>Fish book</h2><p>Every kind in three sizes: a small one (under its usual size), a keeper, and a trophy. ${bookCount(book)} of ${BOOK_TOTAL} so far.</p>
    <div class="book-grid">${grid}</div><div class="row"><button class="btn go" id="book-close">Back to fishing</button></div>`;
  el.hidden = false;
  $('book-close').onclick = () => { el.hidden = true; };
}
$('book-btn').onclick = () => { if ($('book').hidden) openBook(); else $('book').hidden = true; };

// ── input: the water, the reel button, keys ──────────────────────────────────────────────────────────────────────────
let downAt = null;
canvas.addEventListener('pointerdown', (e) => {
  sound.audioOn();
  if (!$('book').hidden) { $('book').hidden = true; return; }
  if (S.phase === 'ready' || S.phase === 'wait') {
    S.aiming = true; S.aim = pointerWater(e); aimRing.position.set(S.aim.x, 0.03, S.aim.z); aimRing.visible = true;
    downAt = { x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
  } else if (S.phase === 'bite' || S.phase === 'reel') {
    S.holding = true; if (S.phase === 'bite') startReel();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
  }
});
canvas.addEventListener('pointermove', (e) => { if (S.aiming) { S.aim = pointerWater(e); aimRing.position.set(S.aim.x, 0.03, S.aim.z); } });
const release = () => {
  if (S.aiming) { S.aiming = false; if (S.phase === 'ready' || S.phase === 'wait') cast(S.aim); aimRing.visible = false; }
  S.holding = false;
};
canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', () => { S.aiming = false; aimRing.visible = false; S.holding = false; });
reelUI.btn.addEventListener('pointerdown', (e) => { sound.audioOn(); S.btnHold = true; reelUI.btn.classList.add('is-holding'); if (S.phase === 'bite') startReel(); try { reelUI.btn.setPointerCapture(e.pointerId); } catch (err) { /* fine */ } e.preventDefault(); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) reelUI.btn.addEventListener(ev, () => { S.btnHold = false; reelUI.btn.classList.remove('is-holding'); });
reelUI.btn.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => {
  if (e.repeat && e.code !== 'Space') return;
  sound.audioOn();
  if (e.code === 'Space') {
    e.preventDefault();
    if (S.phase === 'ready') cast(clampAim(lastAim));
    else if (S.phase === 'bite' || S.phase === 'reel') { S.keyHold = true; if (S.phase === 'bite') startReel(); }
    return;
  }
  if (!card.hidden && !card.classList.contains('teach')) {
    const n = +e.key; if (n >= 1 && n <= (C.q ? C.q.choices.length : 0)) { pick(n - 1); return; }
    if (e.key === 'Enter' && C.answered) finishCatch();
  }
  if (e.key === 'Escape' && !$('book').hidden) $('book').hidden = true;
});
addEventListener('keyup', (e) => { if (e.code === 'Space') S.keyHold = false; });
addEventListener('blur', () => { S.keyHold = false; S.btnHold = false; S.holding = false; });

// ── sound controls ───────────────────────────────────────────────────────────────────────────────────────────────────
const vol = $('vol'), mute = $('mute');
const showVol = () => { const v = sound.getVolume(); vol.value = Math.round(v.volume * 100); mute.classList.toggle('is-muted', v.muted); };
mute.onclick = () => { sound.audioOn(); const v = sound.getVolume(); sound.setVolume(v.volume, !v.muted); showVol(); };
vol.oninput = () => { sound.audioOn(); sound.setVolume(vol.value / 100, false); showVol(); };
showVol();

// ── the line ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// from the rod tip to the bobber, sagging toward the water (less when tight), then down to the hook or the fish
const linePts = Array.from({ length: 40 }, () => new THREE.Vector3());
function drawLine(to, sag, then = null) {
  const tip = angler.tip, n = then ? 30 : 38, mid = tip.clone().lerp(to, 0.5);
  mid.y = Math.max(Math.min(tip.y, to.y) + 0.01, mid.y - sag);
  if (to.y < 0.05) mid.y = Math.max(0.02, mid.y);
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push(linePts[i].set(0, 0, 0).addScaledVector(tip, u * u).addScaledVector(mid, 2 * u * t).addScaledVector(to, t * t)); }
  if (then) { pts.push(linePts[n + 1].copy(to)); pts.push(linePts[n + 2].copy(then)); }
  angler.setLine(pts);
}

// ── the loop ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const perf = params.has('perf');
let viewOverride = null;          // FI.view: a fixed camera for test shots
let last = performance.now(), frames = 0, fpsT = 0, fps = 0;
const tmpV = new THREE.Vector3();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  S.t += dt;
  lake.update(dt);
  if (angler) step(dt);
  for (const s of swimmers) swim(s, dt);
  for (let i = leaving.length - 1; i >= 0; i--) {
    const l = leaving[i]; l.t += dt; l.F.root.position.addScaledVector(l.dir, dt * 1.2); l.F.root.rotation.set(0, Math.atan2(l.dir.x, l.dir.z), 0); l.F.wiggle = 0.7; l.F.speed = 12; l.F.update(dt);
    if (l.t > 3) { l.F.dispose(); leaving.splice(i, 1); }
  }
  // the stringer's fish hang nose up, their sides to where the camera usually stands, turning a little on the rope
  stringer.forEach((s, i) => { s.F.update(dt); s.F.root.rotation.set(-Math.PI / 2 + Math.sin(S.t * 0.9 + i) * 0.05, STRINGER_YAW + Math.sin(S.t * 0.7 + i * 2) * 0.25, 0, 'YXZ'); });
  // the camera glides to where it wants to be
  const k = 1 - Math.exp(-dt * 3);
  cam.pos.lerp(cam.wantPos, k); cam.look.lerp(cam.wantLook, k);
  if (viewOverride) { camera.position.copy(viewOverride[0]); camera.lookAt(viewOverride[1]); }
  else { camera.position.copy(cam.pos); camera.lookAt(cam.look); }
  renderer.render(scene, camera);
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; if (perf) { $('perf').hidden = false; $('perf').textContent = `${fps.toFixed(0)} fps · ${renderer.info.render.calls} draws · ${renderer.info.render.triangles} tris`; } }
}
function step(dt) {
  const R = S.rod; let want = { yaw: R.yaw, pitch: 0.6, bend: 0.06 }, pull = null, spin = 0;
  baseFrame(cam.wantPos, cam.wantLook);
  const bobber = angler.bobber;
  switch (S.phase) {
    case 'ready': {
      want = { yaw: R.yaw * 0.98, pitch: 0.62, bend: 0.06 };
      bobber.visible = true; bobber.position.copy(angler.tip).add(tmpV.set(0, -0.55, 0));
      angler.setLine([angler.tip.clone(), bobber.position.clone().add(tmpV.set(0, 0.06, 0))]);
      hint('ready');
      break;
    }
    case 'cast': {
      const t = S.t;
      // back over the shoulder, then forward; the bobber goes at 0.42 s
      const pitch = t < 0.3 ? 0.62 + (1.9 - 0.62) * ease(t / 0.3) : t < 0.5 ? 1.9 + (0.3 - 1.9) * ease((t - 0.3) / 0.2) : 0.3 + (0.55 - 0.3) * ease(clamp((t - 0.5) / 0.6, 0, 1));
      R.pitch = pitch; R.yaw += (S.castYaw - R.yaw) * Math.min(1, dt * 10); want = { yaw: R.yaw, pitch, bend: t > 0.3 && t < 0.5 ? 0.25 : 0.05 };
      angler.root.rotation.y = Math.PI + R.yaw * 0.6;
      if (!S.launched && t >= 0.42) {
        S.launched = true; S.castFrom.copy(angler.tip); S.castT0 = t; const d = S.castFrom.distanceTo(S.castTo); S.castDur = 0.55 + d * 0.03; S.apex = 1.2 + d * 0.13;
        bobber.visible = true;
      }
      if (S.launched) {
        const u = clamp((t - S.castT0) / S.castDur, 0, 1);
        S.bob.copy(S.castFrom).lerp(S.castTo, u); S.bob.y = S.castFrom.y * (1 - u) + 4 * S.apex * u * (1 - u);
        bobber.position.copy(S.bob); drawLine(S.bob, 0.05);
        if (u >= 1) { S.phase = 'wait'; S.t = 0; S.bob.y = 0; sound.plop(); lake.ripple(S.bob.x, S.bob.z, 1); hookFish(); hint('wait'); }
      } else { bobber.position.copy(angler.tip).add(tmpV.set(0, -0.5, 0)); angler.setLine([angler.tip.clone(), bobber.position.clone()]); }
      if (t > 0.85 && t - dt <= 0.85) angler.play(HOLD, { fade: 0.35 });
      break;
    }
    case 'wait': {
      want = { yaw: R.yaw, pitch: 0.55, bend: 0.06 };
      const t = S.t, F = S.hooked && S.hooked.F;
      // the fish swims in under the bobber, then noses at it
      if (F) {
        const target = S.bob.clone().setY(-0.3), toward = target.clone().sub(F.root.position), dist = toward.length();
        const sp = t < S.biteAt - 1.6 ? 0.55 : 0.25;
        if (dist > 0.12) F.root.position.addScaledVector(toward.normalize(), Math.min(dist, sp * dt));
        const flat = target.clone().sub(F.root.position); if (flat.lengthSq() > 1e-4) F.root.rotation.set(0, Math.atan2(flat.x, flat.z), 0);
        F.wiggle = 0.3; F.speed = 7; F.update(dt);
      }
      let dip = 0;
      for (const n of S.nibbles) if (t >= n && t < n + 0.25) { dip = Math.sin((t - n) / 0.25 * Math.PI) * 0.035; if (t - dt < n) { sound.nibble(); lake.ripple(S.bob.x, S.bob.z, 0.35); } }
      bobber.position.set(S.bob.x, Math.sin(t * 2.1) * 0.008 - dip, S.bob.z);
      drawLine(bobber.position.clone().add(tmpV.set(0, 0.04, 0)), 0.6 + S.bob.distanceTo(ANGLER) * 0.04, bobber.position.clone().add(tmpV.set(0, -0.5, 0)));
      cam.wantLook.x += (S.bob.x - cam.wantLook.x) * 0.25;
      if (t >= S.biteAt) {
        S.phase = 'bite'; S.t = 0; sound.bite(); lake.ripple(S.bob.x, S.bob.z, 1.3);
        reelUI.box.hidden = false; reelUI.btn.classList.add('is-calling'); reelUI.tension.style.width = '25%'; reelUI.reeled.style.width = '0%';
        hint('bite');
        if (holding()) startReel();
      }
      break;
    }
    case 'bite': {
      want = { yaw: R.yaw, pitch: 0.55, bend: 0.22 + Math.sin(S.t * 9) * 0.06 };
      const F = S.hooked.F; F.wiggle = 0.8; F.speed = 14; F.update(dt);
      F.root.position.set(S.bob.x + Math.sin(S.t * 5) * 0.08, -0.32, S.bob.z + Math.cos(S.t * 4) * 0.06);
      bobber.position.set(S.bob.x + Math.sin(S.t * 5) * 0.08, -0.07 + Math.sin(S.t * 9) * 0.035, S.bob.z + Math.cos(S.t * 4) * 0.06);
      if ((S.t % 0.8) < dt) lake.ripple(bobber.position.x, bobber.position.z, 0.6);
      drawLine(bobber.position.clone().add(tmpV.set(0, 0.04, 0)), 0.25, F.root.position);
      pull = bobber.position.clone().sub(angler.tip);
      cam.wantLook.x += (S.bob.x - cam.wantLook.x) * 0.25;
      break;
    }
    case 'reel': {
      updateReel(dt);
      if (S.phase !== 'reel') break;
      const F = S.hooked.F; F.update(dt);
      const Rr = S.reel, hold = holding();
      want = { yaw: Math.atan2(-(F.root.position.x - ANGLER.x), -(F.root.position.z - ANGLER.z)) * 0.8, pitch: 0.75 + Rr.T * 0.25, bend: 0.12 + Rr.T * 0.55 };
      pull = F.root.position.clone().sub(angler.tip);
      spin = hold ? (Rr.runLeft > 0 ? 0.6 : 2.4) : 0;
      bobber.position.copy(S.bob);
      drawLine(S.bob.clone().add(tmpV.set(0, 0.04, 0)), (1 - Rr.T) * 0.4 + 0.03, F.root.position);
      if (hold && !S.pulling) { angler.play(REEL_CLIP, { fade: 0.25 }); S.pulling = true; } else if (!hold && S.pulling) { angler.play(HOLD, { fade: 0.3 }); S.pulling = false; }
      cam.wantLook.lerp(tmpV.copy(F.root.position).setY(0), 0.3);
      break;
    }
    case 'lift': {
      S.pulling = false;
      const F = S.hooked.F, u = ease(clamp(S.t / 0.8, 0, 1));
      want = { yaw: -0.55, pitch: 0.55, bend: 0.3 };
      const target = angler.tip.clone().add(tmpV.set(0, -HANG, 0));
      F.root.position.copy(S.liftFrom).lerp(target, u); F.root.position.y += Math.sin(u * Math.PI) * 0.4;
      F.root.rotation.set(-Math.PI / 2 * u, F.root.rotation.y, 0, 'YXZ');
      F.wiggle = 1; F.speed = 15; F.update(dt);
      S.hang.copy(F.root.position); S.hangV.set(0, 0, 0);
      bobber.position.copy(angler.tip).lerp(F.root.position, 0.12);
      angler.setLine([angler.tip.clone(), F.root.position.clone()]);
      fishFrame(cam.wantPos, cam.wantLook, target, S.hooked.L);
      if (S.t > 1.0) { S.phase = 'card'; S.t = 0; openCard(S.q); }
      break;
    }
    case 'card': {
      want = { yaw: -0.55, pitch: 0.55, bend: 0.26 };
      const F = S.hooked.F; hangFish(dt);
      // a flop now and then
      F.wiggle = (S.t % 3.2) < 0.5 ? 0.9 : 0.12; F.speed = 13; F.update(dt);
      bobber.position.copy(angler.tip).lerp(F.root.position, 0.12);
      angler.setLine([angler.tip.clone(), F.root.position.clone()]);
      fishFrame(cam.wantPos, cam.wantLook, angler.tip.clone().add(tmpV.set(0, -HANG, 0)), S.hooked.L);
      break;
    }
    case 'stash': {
      want = { yaw: -0.5, pitch: 0.8, bend: 0.1 };
      const F = S.hooked.F, u = ease(clamp(S.t / 0.75, 0, 1));
      F.root.position.copy(S.stashFrom).lerp(S.stashTo, u); F.root.position.y += Math.sin(u * Math.PI) * 0.35; F.wiggle = 0.6; F.update(dt);
      bobber.position.copy(angler.tip).add(tmpV.set(0, -0.55, 0)); angler.setLine([angler.tip.clone(), u < 0.5 ? F.root.position.clone() : bobber.position.clone()]);
      if (S.t > 0.75) {
        sound.slap();
        F.wiggle = 0.12; F.root.position.copy(S.stashTo);
        stringer.push({ F, data: C.catchQ.fish });
        if (stringer.length > 8) { const old = stringer.shift(); old.F.dispose(); stringer.forEach((s, i) => s.F.root.position.copy(stringerSpot(i))); }
        S.hooked = null; caught(true); S.phase = 'ready'; S.t = 0;
      }
      break;
    }
    case 'release': {
      want = { yaw: -0.2, pitch: 0.7, bend: 0.08 };
      const F = S.hooked.F, u = clamp(S.t / 0.6, 0, 1);
      F.root.position.copy(S.relFrom).lerp(S.relTo, u); F.root.position.y += Math.sin(u * Math.PI) * 0.6; F.root.rotation.x = -Math.PI / 2 + u * Math.PI; F.wiggle = 1; F.update(dt);
      bobber.position.copy(angler.tip).add(tmpV.set(0, -0.55, 0)); angler.setLine([angler.tip.clone(), bobber.position.clone()]);
      if (u >= 1) {
        sound.splash(0.8); lake.ripple(S.relTo.x, S.relTo.z, 1.2);
        leaving.push({ F, t: 0, dir: new THREE.Vector3(rnd(-0.5, 0.5), -0.25, -1).normalize() });
        S.hooked = null; caught(false); S.phase = 'ready'; S.t = 0;
      }
      break;
    }
  }
  if (S.phase !== 'cast') angler.root.rotation.y += (Math.PI + R.yaw * 0.6 - angler.root.rotation.y) * Math.min(1, dt * 4);
  // the rod eases toward where it wants to be (the cast sets it directly)
  if (S.phase !== 'cast') { const kk = Math.min(1, dt * 6); R.yaw += (want.yaw - R.yaw) * kk; R.pitch += (want.pitch - R.pitch) * kk; }
  R.bend += (want.bend - R.bend) * Math.min(1, dt * 8);
  angler.update(dt, { yaw: R.yaw, pitch: R.pitch, bend: R.bend, pull, spin });
  if (S.phase !== 'reel' && S.phase !== 'bite' && !reelUI.box.hidden) reelUI.box.hidden = true;
  if (S.phase === 'card' || S.phase === 'lift') hint('card', '');
}
// a fish going about its business: toward a spot under the water in front of the dock, then another
function swim(s, dt) {
  const p = s.F.root.position, to = s.to.clone().sub(p), d = to.length();
  if (d < 0.5) s.to.set(rnd(-9, 9), rnd(-1.4, -0.6), rnd(-18, -3));
  const want = Math.atan2(to.x, to.z); let dy = want - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  s.yaw += clamp(dy, -1.2 * dt, 1.2 * dt);
  p.x += Math.sin(s.yaw) * s.sp * dt; p.z += Math.cos(s.yaw) * s.sp * dt; p.y += clamp(s.to.y - p.y, -0.2, 0.2) * dt;
  s.F.root.rotation.set(0, s.yaw, 0); s.F.update(dt);
}

// ── start ────────────────────────────────────────────────────────────────────────────────────────────────────────────
for (let i = 0; i < 3; i++) {
  const kind = KIND_LIST[i % 4], F = makeFish(kind, rnd(0.22, 0.42));
  F.root.position.set(rnd(-7, 7), rnd(-1.3, -0.7), rnd(-16, -4)); F.wiggle = 0.3; F.speed = 6; scene.add(F.root);
  swimmers.push({ F, yaw: rnd(0, 6.3), sp: rnd(0.3, 0.55), to: new THREE.Vector3(rnd(-8, 8), -1, rnd(-16, -4)) });
}
baseFrame(cam.pos, cam.look); baseFrame(cam.wantPos, cam.wantLook);
hud();
requestAnimationFrame(loop);
const ready = Promise.all([
  makeAngler(scene).then((a) => { angler = a; angler.update(0, S.rod); }),
  Promise.race([lake.treeLoad, new Promise((r) => setTimeout(r, 7000))]),
]);
ready.then(() => $('loading').classList.add('is-done'));
setTimeout(() => $('loading').classList.add('is-done'), 9000);

// ── a handle for test scripts ────────────────────────────────────────────────────────────────────────────────────────
const toScreen = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, behind: v.z > 1 }; };
window.FI = {
  state: () => ({ phase: S.phase, ladder: { ...ladder }, kept, back, creel: creel.length, stringer: stringer.length, record, book: bookCount(book), card: !card.hidden, teach: card.classList.contains('teach'), practice: C.practice, hint: $('hint').textContent, reel: S.reel ? { p: S.reel.p, T: S.reel.T, gave: S.reel.gave } : null, ready: !!angler }),
  question: () => (!card.hidden && C.q ? { answer: C.q.answer, answerIndex: C.q.choices.indexOf(C.q.answer), choices: C.q.choices, labels: C.q.labels, topic: C.q.topic, level: C.q.level, from: C.q.from, action: C.catchQ.action, answered: C.answered, practice: C.practice } : null),
  toScreen, waterSpot: (x, z) => toScreen(x, 0, z), bobber: () => toScreen(S.bob.x, S.bob.y, S.bob.z),
  fps: () => fps, setStep: (n) => { ladder = { level: clamp(n, 1, LADDER_TOP), streak: 0, placing: false, slips: 0 }; saveLadder(); },
  topics: () => TOPICS_AT,
  // a fixed camera for close test shots: FI.view([x, y, z], [tx, ty, tz]); FI.view(null) gives it back
  view: (from, to) => { viewOverride = from ? [new THREE.Vector3(...from), new THREE.Vector3(...to)] : null; },
  near: () => [camera.near, camera.far],
  renderInfo: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
};
