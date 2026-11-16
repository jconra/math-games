// MATHBALL, PLAYED: the arena job's game (src/jobs/arena.js) on the court the station builds (kit/arena.js). Pressing
// Start at the ring inside the arena's door opens it; this takes over the player's walking and the camera until Leave.
//
// HOW IT PLAYS (the game's maker's picks, 2026-11-16; ~/pw/space-math/MATHBALL.md):
//   - pick who to play: three of the station's crew, easier to harder (CH-10: "you could pick an opponent who you know
//     is easier or more difficult"); one tap starts the round;
//   - click or tap a ball: you run to it and pick it up. Then click or tap a goal (or one of the goal buttons that come
//     up while you hold a ball): you turn and throw. A ball its goal's rule fits goes in (a strike of light runs across
//     the floor from where you stood to the goal, credits for it); a ball it doesn't fit bounces back out, with one plain
//     line why. The keys or the thumb stick still walk you about; dragging the view turns the camera;
//   - the light bar runs round the room: as it reaches each goal (every 30 seconds) that goal's rule changes. Back over
//     the door, the round ends: the score and the credits, then Play again (one tap) or Leave;
//   - Help (H) shows the four goals' rules explained, any time, and holds the round still while it is open.
//
//   const M = openMathball({ W, walls, input, crew, lib, job, people, onClose, onSave, onCredits })
//     M.update(dt, P)        before the player moves: the round, the picks, the other player, the picture
//     M.control(dt, P)       -> { move, run, yaw, clip } for the player this frame (main.js hands it to P.update)
//     M.aim(camera, dt)      the game's camera
//     M.close()  M.state()   (for the rigs: the round's numbers)  M.pickBall(id), M.throwAt(goal), M.choose(i)
//   mathballIdle(W, crew)    the arena with nobody playing: its floor's light and its signs, while someone is in it
import * as THREE from 'three';
import * as E from '../jobs/engine.js';
import { makeRound, OTHER } from './game.js';
import { facing } from './physics.js';
import { makeView } from './view.js';
import { COURT, GOALS, GOAL_CSS, clampIn } from './court.js';
import { LADDER } from './ladder.js';
import { ruleOf, value as valueOf } from './rules.js';
import { makeCrew } from '../../kit/crew.js';
import { ROSTER } from '../life.js';
import { shine } from '../player.js';
import { makeSound } from './sound.js';

const MID = COURT.mid;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const CSS = new URL('./mathball.css', import.meta.url).href;
function ensureCss() { if (document.querySelector('link[data-mbl]')) return; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; l.dataset.mbl = '1'; document.head.appendChild(l); }

// THE OTHER PLAYERS: the station's own crew (life.js's roster), easier to harder. The hardest is the Captain (the
// game's maker's gossip: "Did you hear that the Captain lost at Mathball last night?" "Oh wow, I thought she was
// unbeatable"). A look the roster no longer has falls back to a plain crew suit.
export const OPPONENTS = [
  { id: 'visitor-ola', name: 'Ola', line: 'Visiting the station, still learning the game', level: 0 },
  { id: 'pilot-sol', name: 'Pilot Sol', line: 'A fair match', level: 1 },
  { id: 'vega', name: 'Captain Vega', line: 'Hard to beat', level: 2 },
];
const FALLBACK_LOOK = { suit: 'atlantis2', head: 't3', hair: 'ponytail', colours: { job: 'explorer', uniform: '#9b6ddb', skin: '#e8bf9f', hair: '#6b4127' } };
// THE CAMERA: behind the player and above, looking down the court (a phone held upright sees a narrow strip, so it
// stands further back and higher, looking more steeply down)
export const MBCAM = {
  wide: { dist: 4.3, height: 3.5, ahead: 2.8, lookY: 0.45, fov: 62 },
  tall: { dist: 5.0, height: 5.0, ahead: 3.4, lookY: -0.25, fov: 76 },
  turn: 0.0052, swing: 1.9, after: 1.1,
};

// ── the arena with nobody playing: the floor's light and the signs (the round's first rules at this crew's level) ──
let idle = null;
export function mathballIdle(W, crew, job, here, dt = 1 / 60) {
  if (!here) { if (idle && !idle.busy) { idle.V.dispose(); idle = null; } return null; }
  if (!idle) {
    const set = setFor(crew, job);
    const G = makeRound({ set, rand: Math.random });
    idle = { V: makeView({ W, G }), G, busy: false };
  }
  idle.V.update(dt, W.camera);   // (the floor's light alive, the signs lit)
  return idle;
}
function setFor(crew, job) {
  let id = null;
  try { if (crew) id = E.level(crew, job)?.id || null; } catch (e) { id = null; }
  if (!id && crew) try { id = E.deal(crew, job).level.id; } catch (e) { id = null; }
  return LADDER.find((s) => s.key === id) || LADDER[0];
}

export function openMathball({ W, walls, input, crew, lib, job, people = () => null, onClose = () => {}, onSave = () => {}, onCredits = () => {} }) {
  ensureCss();
  const tall = () => innerHeight > innerWidth * 1.05 || innerWidth <= 640;
  const sound = makeSound();
  // the court's picture: the idle one if it is up (no flicker as play starts), else a new one
  let view = null, G = null;
  if (idle) { idle.busy = true; view = idle.V; G = idle.G; idle = null; }
  else { G = makeRound({ set: setFor(crew, job), rand: Math.random }); view = makeView({ W, G }); }
  let phase = 'pick', paused = false, closed = false, other = null, otherBody = null, lastBody = null, round = 0, earned = 0, level = null, set = null;
  let choice = Math.max(0, Math.min(2, (crew.jobs && crew.jobs.arena && crew.jobs.arena.other) ?? 1));
  const keepShut = W.built.doors.find((D) => D.sense && Math.hypot(D.sense.x - MID[0], D.sense.z - (MID[2] + COURT.hz)) < 1.2) || null;
  if (keepShut) W.keepShut.add(keepShut);

  // ── the HUD ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const el = document.createElement('div'); el.className = 'mbl'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Mathball');
  el.innerHTML = `
    <header class="mbl-top" hidden>
      <div class="mbl-score"><span class="mbl-you"><b>You</b><em>0</em></span>
        <span class="mbl-lap" aria-label="The light bar: how far round the room it is">${GOALS.map((g) => `<i style="--c:${GOAL_CSS[g.colour]}"></i>`).join('')}<u></u></span>
        <span class="mbl-them"><em>0</em><b></b></span></div>
      <div class="mbl-cr" aria-label="Credits this round"><i aria-hidden="true"></i><span>0</span></div>
      <p class="mbl-theirs" aria-live="polite"></p>
    </header>
    <div class="mbl-tools"><button type="button" class="mbl-help" data-askhelp>Help<kbd>H</kbd></button><button type="button" class="mbl-done">Leave<kbd>Esc</kbd></button></div>
    <div class="mbl-bottom">
      <div class="mbl-goals" hidden></div>
      <p class="mbl-hint" aria-live="polite"></p>
    </div>
    <section class="mbl-card mbl-pick" hidden></section>
    <section class="mbl-card mbl-end" hidden></section>
    <aside class="mbl-helpbox" hidden><header><b>The goals' rules</b><button type="button" class="mbl-hx" aria-label="Close the help (Esc)">&#10005;</button></header><ul></ul><p class="mbl-hhow"></p></aside>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const hint = $('.mbl-hint'), goalsEl = $('.mbl-goals'), helpBox = $('.mbl-helpbox');
  let hintUntil = 0, hintWords = '', hintKind = '';
  function say(words, secs = 3.5, kind = '') {
    hintWords = words; hintKind = kind; hintUntil = G.t + secs;
    hint.textContent = words; hint.className = 'mbl-hint' + (kind ? ' is-' + kind : '');
  }
  const touchy = () => input.touch;
  const press = (word) => (touchy() ? 'Tap' : 'Click') + ' ' + word;

  // the level line with its arrows (Mathwood's level tool), on the pick and end cards
  function levelHtml() {
    const v = E.level(crew, job), i = v ? v.i : 0, n = v ? v.n : LADDER.length;
    const S = LADDER[i] || LADDER[0];
    return `<div class="mbl-level"><button type="button" class="mbl-arrow" data-dir="-1" aria-label="Easier rules"${i <= 0 ? ' disabled' : ''}>&#9664;</button>
      <span><small>Level ${i + 1} of ${n}</small>${esc(S.name)}</span>
      <button type="button" class="mbl-arrow" data-dir="1" aria-label="Harder rules"${i >= n - 1 ? ' disabled' : ''}>&#9654;</button></div>`;
  }
  function stepLevel(dir) {
    const r = E.step(crew, job, dir); if (r) { onSave(); }
    if (phase === 'pick') showPick(); else if (phase === 'end') showEnd(lastEnd);
    // the court shows the new level's first rules
    const s2 = setFor(crew, job); if (s2 !== set && phase !== 'play') { set = s2; G = makeRound({ set, rand: Math.random }); view.use(G); }
  }
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    sound.wake();
    if (b.classList.contains('mbl-arrow')) stepLevel(+b.dataset.dir);
    else if (b.dataset.who != null) { choice = +b.dataset.who; startRound(); }
    else if (b.classList.contains('mbl-again')) startRound();
    else if (b.classList.contains('mbl-swap')) { choice = (choice + 1) % OPPONENTS.length; showEnd(lastEnd); }
    else if (b.classList.contains('mbl-done') || b.classList.contains('mbl-leave')) close();
    else if (b.classList.contains('mbl-help')) toggleHelp();
    else if (b.classList.contains('mbl-hx')) toggleHelp(false);
    else if (b.dataset.goal != null) throwAt(+b.dataset.goal);
  });

  function showPick() {
    const P = $('.mbl-pick');
    P.innerHTML = `<h2>Mathball</h2><p class="mbl-lede">Throw each number ball into a goal its number fits. The light bar going round the room changes one goal's rule every 30 seconds. Most right balls wins.</p>
      <p class="mbl-ask">Who do you want to play?</p>
      <div class="mbl-who">${OPPONENTS.map((o, i) => `<button type="button" data-who="${i}" class="${i === choice ? 'is-last' : ''}"><b>${esc(o.name)}</b><small>${esc(o.line)}</small></button>`).join('')}</div>
      ${levelHtml()}`;
    P.hidden = false;
    bodyFor(OPPONENTS[choice]).catch(() => {});   // (the last one played, on the way already, so the start is quick)
  }

  // ── the other player's body (the crew kit) ────────────────────────────────────────────────────────────────────
  const looks = new Map();
  function lookOf(id) {
    const R = ROSTER.find((r) => r.id === id), look = R ? R.look : FALLBACK_LOOK;
    return typeof look === 'string' ? (lib.list.recipes || {})[look] || FALLBACK_LOOK : look;
  }
  async function bodyFor(opp) {
    if (looks.has(opp.id)) return looks.get(opp.id);
    const p = makeCrew(lib, lookOf(opp.id)).then((c) => { c.root.visible = false; W.scene.add(c.root); return c; });
    looks.set(opp.id, p); return p;
  }
  let hiddenPerson = null;
  function hideStationCopy(id) {
    const ppl = people(); if (hiddenPerson) { hiddenPerson.hidden = false; hiddenPerson = null; }
    const P = ppl && ppl.list.find((x) => x.id === id); if (P && !P.hidden) { P.hidden = true; hiddenPerson = P; }
  }

  // ── a round ───────────────────────────────────────────────────────────────────────────────────────────────────
  async function startRound() {
    if (closed) return;
    const opp = OPPONENTS[choice];
    // the level this round is played at: Mathwood's (a first time finds it: placement), and its rule set
    const dealt = E.deal(crew, job, { rand: Math.random });
    level = dealt.level; set = LADDER.find((s) => s.key === level.id) || LADDER[0];
    const tally = E.jobTally(crew, job.id);
    tally.other = choice; onSave();
    G = makeRound({ set, rand: Math.random, other: { level: opp.level }, youRate: tally.rate || OTHER.youRate });
    view.use(G); view.playing = true;
    dropWindow(true);
    other = opp; earned = 0; round++;
    $('.mbl-pick').hidden = true; $('.mbl-end').hidden = true; $('.mbl-top').hidden = false;
    $('.mbl-them b').textContent = opp.name.replace(/^(Captain|Pilot) /, '');
    $('.mbl-cr span').textContent = '0';
    say('Here come the balls, out of the walls', 2.5); askedBall = false;
    phase = 'play';
    hideStationCopy(opp.id);
    // the body: the one already made for this crew member, or made now (the round waits for nothing: until it comes,
    // the other player is only their ring)
    if (otherBody && lastBody !== opp.id) { otherBody.root.visible = false; }
    otherBody = null;
    bodyFor(opp).then((c) => { if (closed || other !== opp) return; otherBody = c; lastBody = opp.id; c.root.visible = true; shine(c, W.envAt(new THREE.Vector3(MID[0], 1, MID[2]))); for (const o2 of [c.root]) o2.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) lifted.delete(m); }); lift(c); c.clipNow = ''; }).catch((e) => console.warn('Mathball: no body for ' + opp.name, e));
  }
  let lastEnd = null;
  function showEnd(r) {
    lastEnd = r; const opp = OPPONENTS[choice], was = other || opp;
    const words = r.you > r.them ? 'You win!' : r.you < r.them ? `${esc(was.name)} wins this one` : 'A draw!';
    const E2 = $('.mbl-end');
    E2.innerHTML = `<h2>${words}</h2>
      <div class="mbl-final"><span><b>You</b><em>${r.you}</em></span><span class="mbl-dash">to</span><span><em>${r.them}</em><b>${esc(was.name)}</b></span></div>
      <p class="mbl-earned"><i aria-hidden="true"></i>${earned.toLocaleString('en-US')} credits this round</p>
      ${levelHtml()}
      <div class="mbl-endgo"><button type="button" class="mbl-again">Play again<kbd>Enter</kbd></button>
      <button type="button" class="mbl-swap">Against: ${esc(opp.name)} &#9656;</button>
      <button type="button" class="mbl-leave">Leave</button></div>`;
    E2.hidden = false; goalsEl.hidden = true;
  }

  // ── Help: the four rules explained (never opens by itself; X and Esc close it; the round holds still) ───────────
  function toggleHelp(on = helpBox.hidden) {
    if (on) {
      helpBox.querySelector('ul').innerHTML = G.goals.map((g, i) => { const R = ruleOf(g.rule); return `<li style="--c:${GOAL_CSS[GOALS[i].colour]}"><b>The ${GOALS[i].colour} goal: ${esc(R.say)}</b><span>${esc(R.help)}</span><small>${esc(R.list)}</small></li>`; }).join('');
      helpBox.querySelector('.mbl-hhow').textContent = `${press('a ball')} to run to it and pick it up, then ${touchy() ? 'tap' : 'click'} a goal its number fits (or one of the goal buttons). A ball can fit more than one goal.`;
    }
    helpBox.hidden = !on; paused = on && phase === 'play';
    $('.mbl-help').classList.remove('is-nudge');
  }

  // ── the player's clicks and taps ───────────────────────────────────────────────────────────────────────────────
  const offPick = input.onPick((p) => {
    if (closed || phase !== 'play' || paused || !p.hit) return;
    sound.wake();
    const d = p.hit.object.userData;
    if (d.ball != null) pickBall(d.ball);
    else if (d.goal != null) throwAt(d.goal);
  });
  const ballTargets = new Map();
  function syncTargets() {
    // (every ball on the court is something a click can pick; the goals' boxes always are)
    const live = new Set();
    for (const b of G.balls) {
      const m = view.ballMesh(b.id); if (!m) continue; live.add(b.id);
      if (!ballTargets.has(b.id)) ballTargets.set(b.id, { m, off: input.addTarget(m, { ball: b.id }) });
    }
    for (const [id, T] of ballTargets) if (!live.has(id)) { T.off(); ballTargets.delete(id); }
  }
  const goalOff = view.goalHits.map((m) => input.addTarget(m, { goal: m.userData.goal }));
  function pickBall(id) {
    if (G.pick(id) && /a ball to grab it/.test(hint.textContent)) say('', 0);   // (you run to it by yourself)
  }
  function throwAt(gi) {
    if (phase !== 'play' || paused) return;
    if (!G.you.holding) { say(press('a ball first, then a goal'), 2.5); return; }
    G.throwAt(gi);
  }

  // ── each frame ─────────────────────────────────────────────────────────────────────────────────────────────────
  const cam = { yaw: Math.PI, idle: 99, at: new THREE.Vector3(), look: new THREE.Vector3(), fresh: true, lift: 0 };
  let lastCam = new THREE.Vector3(MID[0], 3, MID[2] + 8);
  const youNow = { x: 0, z: 0, vx: 0, vz: 0, heading: 0 }, prev = new THREE.Vector3();
  let throwT = -1, goalsShown = false, endT = 0, askedBall = false, liftedP = null;
  function update(dt, P) {
    if (closed) return;
    // the drags turn the game's camera (taken before the station's camera sees them)
    const look = input.takeLook(); if (look.dx || look.dy) { cam.yaw = wrapA(cam.yaw - look.dx * MBCAM.turn); cam.lift = Math.max(-1, Math.min(1.6, cam.lift + look.dy * 0.006)); cam.idle = 0; } else cam.idle += dt;
    input.takeZoom();
    if (P && !P.lifted) { lift(P.c); P.lifted = true; liftedP = P; }
    // the player's feet in the court's frame
    if (P) {
      youNow.vx = (P.pos.x - prev.x) / Math.max(dt, 1e-4); youNow.vz = (P.pos.z - prev.z) / Math.max(dt, 1e-4); prev.copy(P.pos);
      youNow.x = P.pos.x - MID[0]; youNow.z = P.pos.z - MID[2]; youNow.heading = P.heading;
    }
    const eye = [lastCam.x - MID[0], lastCam.y, lastCam.z - MID[2]];
    if (phase === 'play' && !paused) {
      const held = G.you.holding;
      G.step(dt, { eye, sees: (b) => view.sees(b), you: youNow });
      for (const e of G.take()) onEvent(e);
      // (holding a ball: the goal buttons come up; a new ball in the hand, a word on what to do)
      if (G.you.holding && !held) { const b = G.you.holding; showGoals(true); say(`Now ${touchy() ? 'tap' : 'click'} a goal that takes ${b.num}`, 4); }
      if (!G.you.holding && goalsShown) showGoals(false);
    } else if (phase === 'end') G.step(dt, { eye, sees: (b) => view.sees(b) });
    if (G.you.holding) view.facing(G.you.holding, W.camera);
    syncTargets();
    view.update(dt, W.camera);
    otherBodyStep(dt);
    hud(dt);
    if (hintUntil && G.t > hintUntil && phase === 'play') { hintUntil = 0; hint.textContent = ''; hint.className = 'mbl-hint'; }
    if (theirsUntil && G.t > theirsUntil) { theirsUntil = 0; $('.mbl-theirs').textContent = ''; }
    // (the first ask for a ball waits until one is in view, settled enough to see)
    if (phase === 'play' && !askedBall && !G.you.holding && !G.you.target && G.balls.some((b) => b.seen && (b.mode === 'roll' || b.mode === 'rest'))) { askedBall = true; say(press('a ball to grab it'), 5); }
  }
  // THE GOAL BUTTONS: a small map of the four goals, two rows of two: the end of the court the camera looks toward on
  // top, each row as the goals stand across the view (looking north, west on the left; looking south, the other way
  // round). The same goal keeps its place throw after throw; the map turns only when the view has turned round.
  // (the end of the court a player holding a ball looks toward: the far one from where they stand; near the middle line,
  // the one the camera faces already. The camera turns there, so the map is laid out for it)
  const farSouth = () => (Math.abs(youNow.z) > 1.5 ? youNow.z < 0 : Math.cos(cam.yaw) > 0);
  function goalOrder() {
    const north = !farSouth();
    const key = (g) => GOALS.findIndex((x) => x.key === g);
    return north ? ['NW', 'NE', 'SW', 'SE'].map(key) : ['SE', 'SW', 'NE', 'NW'].map(key);
  }
  function showGoals(on) {
    goalsShown = on; goalsEl.hidden = !on; if (!on) return;
    goalsEl.innerHTML = goalOrder().map((i) => { const R = ruleOf(G.goals[i].rule), w = R.sign.length === 2 ? `<small>${esc(R.sign[0])}</small><b>${esc(R.sign[1])}</b>` : `<b class="is-words">${esc(R.sign[0])}</b>`; return `<button type="button" data-goal="${i}" style="--c:${GOAL_CSS[GOALS[i].colour]}" aria-label="Throw at the ${GOALS[i].colour} goal: ${esc(R.say)}">${w}</button>`; }).join('');
  }
  // (the other player's goals, on a small line of their own under the score, for a few seconds)
  let theirsUntil = 0;
  function theirs(words) { const t = $('.mbl-theirs'); t.textContent = words; theirsUntil = G.t + 2.6; }
  function onEvent(e) {
    const name = other ? other.name : 'They';
    const panOf = (p) => { if (!p) return 0; const v = new THREE.Vector3(MID[0] + p[0], 1, MID[2] + p[2]).project(W.camera); return Math.max(-0.8, Math.min(0.8, v.x)); };
    const ball = e.ball != null ? G.balls.find((b) => b.id === e.ball) : null;
    if (e.type === 'launch') { view.flashPort(e.port); sound.play('launch', { gain: 0.7, pan: panOf(ball && ball.p) }); }
    else if (e.type === 'got') sound.play('grab', { gain: e.who === 'you' ? 1 : 0.5 });
    else if (e.type === 'throw') { sound.play('throw', { gain: e.who === 'you' ? 1 : 0.6 }); if (e.who === 'you') { throwT = 0; if (/^Now /.test(hint.textContent)) say('', 0); } }
    else if (e.type === 'score') {
      view.strike(e.from, e.goal, 1);
      if (e.who === 'you') {
        const a = answer(true);
        sound.play('score'); say(`${e.why}  +${a ? a.pay : 0}`, 3.2, 'good'); $('.mbl-help').classList.remove('is-nudge');
      } else { sound.play('them', { gain: 0.8 }); theirs(`${name.replace(/^(Captain|Pilot) /, '')} scored: ${e.num}, ${ruleOf(e.rule).say}`); }
    } else if (e.type === 'bounce') {
      sound.play('bounce', { gain: e.who === 'you' ? 1 : 0.6 });
      if (e.who === 'you') { answer(false); say(`Bounced out: ${e.why}`, 5, 'bad'); $('.mbl-help').classList.add('is-nudge'); }
      else theirs(`${name.replace(/^(Captain|Pilot) /, '')}'s ${e.num} bounced out of ${ruleOf(e.rule).say}`);
    } else if (e.type === 'change') {
      if (e.to !== e.from) { view.change(e.goal, e.to); sound.play('change'); say(`The ${GOALS[e.goal].colour} goal now takes ${ruleOf(e.to).say}`, 3.5, 'change'); if (goalsShown) showGoals(true); }
    } else if (e.type === 'taken') say(`${name.replace(/^(Captain|Pilot) /, '')} got that one first`, 2.2, 'them');
    else if (e.type === 'end') endRound(e);
  }
  // a ball the player threw: an answer at the round's level (engine.js: the level, the kinds of math, the pay)
  function answer(right) {
    if (!level) return null;
    const q = { order: { coins: [{ good: right }], own: { strand: level.strand, at: level.grade }, credit: [], size: 1 }, level, misses: 0, picked: new Set(), done: false };
    const r = E.answer(crew, job, q, 0, {});
    if (r && r.pay) { earned += r.pay; onCredits(); }
    onSave();
    return r;
  }
  function endRound(e) {
    phase = 'end'; endT = 0;
    const tally = E.jobTally(crew, job.id);
    tally.rate = Math.round(G.rateAfter() * 10) / 10; tally.rounds = (tally.rounds || 0) + 1;
    if (e.you > e.them) tally.wins = (tally.wins || 0) + 1;
    onSave(); sound.play('end');
    showGoals(false); say('', 0);
    showEnd({ you: e.you, them: e.them });
    if (hiddenPerson) { /* (they stay out of the station's crowd while they are here on the court) */ }
  }
  // (the HUD is written only when something on it changes)
  const hudEl = { you: $('.mbl-you em'), them: $('.mbl-them em'), cr: $('.mbl-cr span'), bar: $('.mbl-lap u'), pips: [...el.querySelectorAll('.mbl-lap i')] };
  hudEl.pips.forEach((p, i) => { p.style.left = `${((COURT.bar.first + i * COURT.bar.every) / COURT.bar.lap * 100).toFixed(2)}%`; });
  const shown = {};
  const put = (k, node, v) => { if (shown[k] !== v) { shown[k] = v; node.textContent = v; } };
  function hud() {
    if (phase !== 'play' && phase !== 'end') return;
    put('you', hudEl.you, String(G.score.you)); put('them', hudEl.them, String(G.score.them)); put('cr', hudEl.cr, earned.toLocaleString('en-US'));
    // the lap: four goal marks where the bar reaches them, the bar's light moving along
    const left = `${(Math.min(1, G.t / COURT.bar.lap) * 100).toFixed(1)}%`;
    if (shown.bar !== left) { shown.bar = left; hudEl.bar.style.left = left; }
    hudEl.pips.forEach((p, i) => { const done = G.t >= COURT.bar.first + i * COURT.bar.every; if (shown['p' + i] !== done) { shown['p' + i] = done; p.classList.toggle('is-done', done); } });
  }

  // the other player's body: where the round has them, its clip from what they are doing
  function otherBodyStep(dt) {
    const c = otherBody; if (!c) return;
    const O = G.other, sp = Math.hypot(O.vx, O.vz);
    c.root.position.set(MID[0] + O.x, 0, MID[2] + O.z); c.root.rotation.set(0, O.heading, 0);
    let clip = 'Stand_Listen', speed = 1;
    if (phase === 'end' && O.mode === 'cheer') clip = 'Stand_Clap';
    else if (O.mode === 'throw') { clip = 'Interact'; speed = 1.5; }
    else if (O.holding && G.t - (O.grabT ?? -9) < 0.45) { clip = 'Interact'; speed = 1.7; }   // (the reach as they pick it up)
    else if (sp > 0.2) {
      // (which way they move against the way they face: forward, sideways or back)
      const fx = Math.sin(O.heading), fz = Math.cos(O.heading), along = (O.vx * fx + O.vz * fz) / sp, across = (O.vx * fz - O.vz * fx) / sp;
      if (along > 0.55) { if (sp > 2.4) { clip = 'Run'; speed = Math.max(0.7, Math.min(1.5, sp / (c.stride.Run || 3.6))); } else { clip = 'Walk'; speed = Math.max(0.6, Math.min(1.9, sp / (c.stride.Walk || 1.4))); } }
      else if (along < -0.55) { clip = 'Run_Back'; speed = Math.max(0.6, Math.min(1.4, sp / 2.6)); }
      else { clip = across > 0 ? 'Run_Left' : 'Run_Right'; speed = Math.max(0.6, Math.min(1.4, sp / 2.6)); }
    }
    if (c.clipNow !== clip) { c.play(clip, { fade: clip === 'Interact' ? 0.12 : 0.25, speed }); c.clipNow = clip; } else c.play(clip, { speed });
    c.update(dt);
  }

  // ── the player: where the round wants them to go, and what they are doing ──────────────────────────────────────
  function control(dt, P) {
    if (closed || !P) return null;
    let move = null, clip = null;
    const yaw = cam.yaw;
    const manual = input.move && input.move.mag > 0.12;
    if (phase === 'play' && !paused) {
      if (manual && G.you.target) G.you.target = null;   // (walking by hand drops the run to a ball)
      const w = G.you.want;
      if (!manual && w.to) {
        const dx = w.to[0] - youNow.x, dz = w.to[1] - youNow.z, d = Math.hypot(dx, dz);
        if (d > 0.05) {
          const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw), mag = Math.min(1, d / 0.9);
          move = { x: (dx * rx + dz * rz) / d * mag, y: (dx * fx + dz * fz) / d * mag, mag };
        }
      }
      if (!manual && w.face != null) { const dh = wrapA(w.face - P.heading); P.heading = wrapA(P.heading + dh * Math.min(1, 12 * dt)); }
    }
    if (manual) move = input.move;
    // throwing: the arm's swing (the crew's reach, quick)
    if (throwT >= 0) { throwT += dt; clip = throwT < 0.55 ? 'Interact' : null; if (throwT > 0.55) throwT = -1; }
    else if (G.you.holding && G.t - (G.you.grabT ?? -9) < 0.4) clip = 'Interact';   // (the reach as you pick it up)
    return { move, run: true, yaw, clip, clipSpeed: 1.7, others: otherBody ? [{ pos: otherBody.root.position, hidden: false }] : [] };
  }

  // ── the game's camera ──────────────────────────────────────────────────────────────────────────────────────────
  const _w = new THREE.Vector3();
  function aim(camera, dt) {
    if (closed) return;
    const C = tall() ? MBCAM.tall : MBCAM.wide;
    const feet = new THREE.Vector3(MID[0] + youNow.x, 0, MID[2] + youNow.z);
    // left alone, it swings round behind the way the player is going, or toward the goal they are throwing at
    const sp = Math.hypot(youNow.vx, youNow.vz), w = G.you.want;
    // (left alone it looks toward the goal being thrown at, else from behind the player toward the court's middle and
    // on down its length, so the balls are in view wherever the player runs: never into a wall or a corner)
    if (cam.idle > MBCAM.after) {
      let want = null, rate = MBCAM.swing;
      if (w.face != null) { want = w.face; rate *= 1.5; }
      else if (G.you.holding) {
        // (a ball in hand: toward the court's far end from the player, so its two goals are in view while they choose)
        want = Math.atan2(-youNow.x * 0.35, farSouth() ? 6 : -6); rate *= 0.9;
      }
      else if (Math.hypot(youNow.x, youNow.z) > 2.2) { want = Math.atan2(-youNow.x * 0.55, -youNow.z); rate *= 0.6; }
      else if (sp > 0.8) { want = Math.atan2(youNow.vx, youNow.vz); rate *= Math.min(1, sp / 3); }
      if (want != null) { const d = wrapA(want - cam.yaw); cam.yaw = wrapA(cam.yaw + Math.sign(d) * Math.min(Math.abs(d), rate * dt)); }
    }
    if (cam.fresh) { cam.yaw = Math.PI; }
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), lift = cam.lift;
    let ax = feet.x - fx * C.dist * (1 - lift * 0.12), az = feet.z - fz * C.dist * (1 - lift * 0.12), ay = C.height + lift * 0.9;
    // (kept inside the court: a camera against a wall rises instead)
    const [cx, cz] = clampIn(ax - MID[0], az - MID[2], 0.4);
    const pushed = Math.hypot(cx + MID[0] - ax, cz + MID[2] - az);
    ax = cx + MID[0]; az = cz + MID[2]; ay += pushed * 0.5;
    _w.set(ax, ay, az);
    const lookAt = new THREE.Vector3(feet.x + fx * C.ahead, C.lookY, feet.z + fz * C.ahead);
    if (cam.fresh) { cam.at.copy(camera.position); cam.look.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(4)); cam.fresh = false; }
    const k = 1 - Math.exp(-6 * dt);
    cam.at.lerp(_w, k); cam.look.lerp(lookAt, k);
    camera.position.copy(cam.at); camera.lookAt(cam.look);
    if (camera.fov !== C.fov) { camera.fov = C.fov; camera.updateProjectionMatrix(); }
    lastCam.copy(camera.position);
  }

  // (the gallery window's portal, out of the station's list while the shutter is down: the terminal is not drawn
  // behind it; back in when the game closes)
  let windowPortal = null;
  function dropWindow(on) {
    const L = W.R.portals || [];
    if (on && !windowPortal) { const i = L.findIndex((P) => P.a === 'terminal' && P.b === 'arena' && P.box[0][1] > 3); if (i >= 0) windowPortal = L.splice(i, 1)[0]; }
    if (!on && windowPortal) { L.push(windowPortal); windowPortal = null; }
  }
  // (the people on the court lit a little more than the room's own light gives them: dark suits on a dark floor)
  const lifted = new Map();
  function lift(c, k = 1.8) {
    if (!c) return;
    c.root.traverse((o) => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (m && 'envMapIntensity' in m && !lifted.has(m)) { lifted.set(m, m.envMapIntensity); m.envMapIntensity *= k; } });
  }
  function close() {
    if (closed) return; closed = true;
    dropWindow(false);
    for (const [m, v] of lifted) m.envMapIntensity = v; lifted.clear(); if (liftedP) liftedP.lifted = false;
    removeEventListener('keydown', onKey, true);
    offPick(); for (const f of goalOff) f(); for (const [, T] of ballTargets) T.off(); ballTargets.clear();
    if (keepShut) W.keepShut.delete(keepShut);
    if (hiddenPerson) { hiddenPerson.hidden = false; hiddenPerson = null; }
    for (const [, p] of looks) p.then((c) => { W.scene.remove(c.root); c.dispose(); }).catch(() => {});
    view.dispose(); sound.dispose(); el.remove();
    onClose();
  }

  // (keys: Esc is ours while the game is up (it closes Help first); H for Help; Enter or E starts a round from a card)
  function onKey(e) {
    if (closed) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!helpBox.hidden) toggleHelp(false); else close(); return; }
    if (e.repeat) return;
    if (e.code === 'KeyH') { e.preventDefault(); toggleHelp(); }
    else if ((e.code === 'Enter' || e.code === 'KeyE') && (phase === 'pick' || phase === 'end')) { e.preventDefault(); e.stopImmediatePropagation(); sound.wake(); startRound(); }
  }
  addEventListener('keydown', onKey, true);

  showPick();
  const M = {
    update, control, aim, close,
    pickBall, throwAt, choose: (i) => { choice = i; startRound(); },
    get phase() { return phase; },
    state: () => ({
      phase, paused, t: +G.t.toFixed(2), set: set && set.key, level: level && level.id, score: { ...G.score }, tries: { ...G.tries }, earned, other: other && other.name, otherMode: G.other.mode,
      goals: G.goals.map((g, i) => ({ i, colour: GOALS[i].colour, rule: g.rule, say: ruleOf(g.rule).say })),
      holding: G.you.holding ? { id: G.you.holding.id, num: G.you.holding.num } : null, target: G.you.target ? G.you.target.id : null,
      balls: G.balls.filter((b) => b.mode !== 'gone').map((b) => { const f = facing(b, [lastCam.x - MID[0], lastCam.y, lastCam.z - MID[2]]); return { id: b.id, num: b.num, mode: b.mode, p: b.p.map((v) => +v.toFixed(2)), fits: G.goals.map((g) => ruleOf(g.rule).test(valueOf(b.num))), seen: !!b.seen, passed: b.passed, angle: +f.angle.toFixed(1), tilt: +f.tilt.toFixed(1), rest: b.restAt ? +b.restAt.angle.toFixed(1) : null }; }),
      you: { x: +youNow.x.toFixed(2), z: +youNow.z.toFixed(2) }, them: { x: +G.other.x.toFixed(2), z: +G.other.z.toFixed(2), holding: !!G.other.holding }, changes: G.changes, hint: hint.textContent,
      next: G.next(), body: !!otherBody,
    }),
    // (for the rigs: where a ball or a goal is on the screen, in page pixels)
    screenOf(kind, id) {
      const r = W.renderer.domElement.getBoundingClientRect();
      let p = null;
      if (kind === 'ball') { const m = view.ballMesh(id); if (m) p = m.position.clone(); }
      else { const g = GOALS[id]; p = new THREE.Vector3(MID[0] + g.mid[0] + g.n[0] * 0.3, 1.0, MID[2] + g.mid[1] + g.n[1] * 0.3); }
      if (!p) return null;
      const v = p.project(W.camera); if (v.z > 1) return null;
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, on: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 };
    },
  };
  return M;
}
