// MATHBALL, PLAYED: the arena job's game (src/jobs/arena.js) on the court the station builds (kit/arena.js). Pressing
// Start at the ring inside the arena's door opens it; this takes over the player's walking and the camera until Leave.
//
// HOW IT PLAYS (the game's maker's picks, 2026-11-16; ~/pw/space-math/MATHBALL.md):
//   - pick who to play: three of the station's crew, easier to harder (CH-10: "you could pick an opponent who you know
//     is easier or more difficult"); one tap starts the round;
//   - click or tap a ball: you run to it and pick it up, and hold it up in front of you (a finger is wide: a tap picks the
//     ball nearest it on the screen, a rolling one too, and a finger that wanders a few pixels as it taps is still a
//     tap: hands.js). Then click or tap a goal (or one of the goal buttons that come up while you hold a ball): you turn
//     and throw. While you hold it, an arc of light shows where a throw would go (the game's maker: "a targeting arc to
//     show your projected throw"): it follows the mouse, or a goal button pressed (or, with HANDS.aimByRest, his
//     question 2, a finger held still on the court and then moved: lifting it throws); it takes a goal's colour, and
//     the goal's housing lights up, when the throw goes into that goal. It is only ever in front, the way the camera
//     looks (the game's maker: "You should only be able to aim in front of you"). A click on the floor throws the ball
//     there (a tap on a phone never does: a tap never throws by mistake). A ball its goal's rule fits goes in (a strike of light runs across the floor from where you stood to
//     the goal, credits for it); a ball it doesn't fit bounces back out, with one plain line why. The keys or the thumb
//     stick walk you about, the way the view looks;
//   - THE VIEW TURNS ONLY BY THE PLAYER'S HAND (the game's maker, 2026-11-26: "I think it would be better to have the
//     camera just be manual movements (like swiping or dragging sideways to move the camera) and no automatic
//     rotations"; and "it is super annoying when I rotate the camera around manually so I can see the balls, and then
//     it rotates the camera back away and undos the rotation I set"): a drag (a finger on the right part of a phone's
//     screen, the mouse held on a wide one) turns it, and nothing else does: not walking, running to a ball, picking
//     it up, aiming, throwing, a score or a miss, a rule changing, standing still, the other player. The camera
//     follows the player's place, never their turn. The one exception, his to decide (FRONT.buttonTurns): a goal's
//     button pressed for a goal behind or off the side turns the view to it once, then the throw goes;
//   - the light bar runs round the room: as it reaches each goal (every 30 seconds) that goal's rule changes. Back over
//     the door, the round ends: the score and the credits, then Play again (one tap) or Leave; the crew member's own
//     best round is kept with their save, and a round that beats it has the station announce it (best.js); under the
//     credits the card says "Your best: N", or "New best!" when this round beat it;
//   - Help (H) shows the four goals' rules explained, any time, and holds the round still while it is open.
//
//   const M = openMathball({ W, walls, input, crew, lib, job, people, onClose, onSave, onCredits })
//     M.update(dt, P)        before the player moves: the round, the picks, the other player, the picture
//     M.control(dt, P)       -> { move, run, yaw, clip } for the player this frame (main.js hands it to P.update)
//     M.aim(camera, dt)      the game's camera
//     M.close()  M.state()   (for the rigs: the round's numbers)  M.pickBall(id), M.throwAt(goal), M.choose(i)
//     M.aimAt(x, y)          (for the rigs: what a point on the page aims at, as the mouse would)
//   mathballIdle(W, crew)    the arena with nobody playing: its floor's light and its signs, while someone is in it
import * as THREE from 'three';
import * as E from '../jobs/engine.js';
import { makeRound, OTHER, throwFrom } from './game.js';
import { facing, flightPath, lobTime, PHYS } from './physics.js';
import { makeView } from './view.js';
import { COURT, GOALS, GOAL_CSS, WALLS, clampIn, inside } from './court.js';
import { LADDER } from './ladder.js';
import { ruleOf, value as valueOf, wholeNote } from './rules.js';
import { makeCrew } from '../../kit/crew.js';
import { ROSTER, lookRecipe } from '../life.js';
import { skillOf } from './skill.js';
import { challenger, challengePlayed, challengeLeft } from './challenge.js';
import { shine } from '../player.js';
import { makeSound } from './sound.js';
import { keepBest, bestWords } from './best.js';
import { happened } from '../announce.js';
import { target, follow } from './camera.js';
import { makeHands, nearestBall, underAt, chooseTap, remember, pastOnScreen, viewTurn, turnToward, pushFor, canPick, inView, buttonDoes, mouthAt, lookRoundDue, HANDS } from './hands.js';

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
].map((o) => ({ ...o, skill: skillOf(o.id) }));   // (their Mathball skill: skill.js; 3, 6 and 10, the old three levels)
// (someone who was challenged to a game and is waiting at the arena, src/mathball/challenge.js: the start card has them
// as the one to play, in their own look, at their own skill; the three above stay for a player who just walks in)
const skillWords = (o) => `Mathball skill ${o.skill}`;
const FALLBACK_LOOK = { suit: 'atlantis2', head: 't3', hair: 'ponytail', colours: { job: 'explorer', uniform: '#6e28b2', skin: '#e8bf9f', hair: '#6b4127' } };
// THE CAMERA (camera.js): behind the player and above, looking down the court (a phone held upright sees a narrow
// strip, so it stands further back and higher, looking more steeply down). Away from walls it is main's, exactly (the
// look raised with a ball in hand, the mouse's drag up and down); beside a wall it comes in rather than turning; its
// TURN is the player's own (a drag sideways: hands.js HANDS.turn, radians a pixel), and nothing turns it by itself
export const MBCAM = {
  // (holdUp: how much higher it looks with a ball in hand, so the far end's two goal signs come down the screen, clear
  // of the score at the top; side: degrees off the view's line it may slide beside a wall, camera.js)
  wide: { dist: 4.3, height: 3.5, ahead: 2.8, lookY: 0.45, fov: 62, holdUp: 1.1, side: 25 },
  tall: { dist: 5.0, height: 5.0, ahead: 3.4, lookY: -0.25, fov: 76, holdUp: 2.2, side: 12 },
  under: 0.7,                     // m it always stays under the ceiling (above it, nothing is drawn: a black screen)
  ease: 6,                        // how quickly it follows (1/s): main's
};
// AIMING ONLY IN FRONT (aimNow): radians from the way the camera looks. A spot or a goal within `arc` shows its arc (a
// spot on the floor or a wall only a step or less from the player, `near`, none: an arc to their own feet led nowhere).
// The view's own width counts too (a phone held upright sees only about 20 degrees either side): a goal off the screen
// shows no arc. A goal's BUTTON pressed for a goal further round than `turn`, or further across the screen than `edge`
// (1: the screen's side), is out of the way for a throw: with buttonTurns (the game's maker's question, A) the view
// turns to it once (rate: radians a second) and the throw goes once it is in front (or after `wait` s turned to it);
// without (B) nothing turns and a line says where that goal is
export const FRONT = { arc: 75 * Math.PI / 180, turn: 55 * Math.PI / 180, edge: 0.8, near: 1.5, rate: 6.5, wait: 0.6, buttonTurns: true };   // (near: m, a floor or wall spot nearer the player is no aim)

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
  // (a challenged person waiting here: first on the cards, the three after them on the end card's Against button)
  const ch = challenger(), opps = ch ? [ch, ...OPPONENTS] : OPPONENTS;
  let choice = ch ? 0 : Math.max(0, Math.min(2, (crew.jobs && crew.jobs.arena && crew.jobs.arena.other) ?? 1));
  const keepShut = W.built.doors.find((D) => D.sense && Math.hypot(D.sense.x - MID[0], D.sense.z - (MID[2] + COURT.hz)) < 1.2) || null;
  if (keepShut) W.keepShut.add(keepShut);

  // ── the HUD ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const el = document.createElement('div'); el.className = 'mbl'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Mathball');
  el.innerHTML = `
    <header class="mbl-top" hidden>
      <div class="mbl-score"><span class="mbl-you"><b>You</b><em>0</em></span>
        <span class="mbl-lap" title="The light bar going round the room: as it reaches a goal, that goal's rule changes. Back at the start, the round ends." aria-label="The light bar: as it reaches a goal, that goal's rule changes">${GOALS.map((g) => `<i style="--c:${GOAL_CSS[g.colour]}"></i>`).join('')}<u></u></span>
        <span class="mbl-them"><em>0</em><b></b></span></div>
      <div class="mbl-cr" aria-label="Credits this round"><i aria-hidden="true"></i><span>0</span></div>
      <p class="mbl-theirs" aria-live="polite"></p>
    </header>
    <div class="mbl-tools"><button type="button" class="mbl-help" data-askhelp>Help<kbd>H</kbd></button><button type="button" class="mbl-done">Leave<kbd>Esc</kbd></button></div>
    <div class="mbl-bottom">
      <p class="mbl-hint" aria-live="polite"></p>
    </div>
    <div class="mbl-goals" hidden></div>
    <section class="mbl-card mbl-pick" hidden></section>
    <section class="mbl-card mbl-end" hidden></section>
    <aside class="mbl-helpbox" hidden><header><b>The goals' rules</b><button type="button" class="mbl-hx" aria-label="Close the help (Esc)">&#10005;</button></header><ul></ul><p class="mbl-hhow"></p></aside>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const hint = $('.mbl-hint'), goalsEl = $('.mbl-goals'), helpBox = $('.mbl-helpbox');
  let hintUntil = 0, hintWords = '', hintKind = '';
  // (a sum in a line never breaks across two: "8 × 5 = 40" keeps together)
  const keep = (words) => String(words).replace(/ ([×÷=+−]) (?=\S)/g, '\u00a0$1\u00a0');
  function say(words, secs = 3.5, kind = '') {
    hintWords = words; hintKind = kind; hintUntil = G.t + secs;
    hint.textContent = keep(words); hint.className = 'mbl-hint' + (kind ? ' is-' + kind : '');
  }
  const touchy = () => input.touch;
  const press = (word) => (touchy() ? 'Tap' : 'Click') + ' ' + word;

  // the level line with its arrows (Mathwood's level tool), on the pick and end cards
  // (after a round, `played` is the level it was played at: the line says what Play again plays, and if that moved)
  // (the arrows stay inside the levels chosen for this job on the levels page, Mathwood's range: canDown, canUp)
  function levelHtml(played = null) {
    const v = E.level(crew, job), i = v ? v.i : 0, n = v ? v.n : LADDER.length;
    const S = LADDER[i] || LADDER[0], down = v ? v.canDown : i > 0, up = v ? v.canUp : i < n - 1;
    const moved = played == null || played === i ? '' : played < i ? ' &middot; up a level' : ' &middot; down a level';
    return `<div class="mbl-level"><button type="button" class="mbl-arrow" data-dir="-1" aria-label="Easier rules"${down ? '' : ' disabled'}>&#9664;</button>
      <span><small>${played == null ? '' : 'Next round: '}Level ${i + 1} of ${n}${moved}${v && v.kept ? ' &middot; kept' : ''}</small>${esc(S.name)}</span>
      <button type="button" class="mbl-arrow" data-dir="1" aria-label="Harder rules"${up ? '' : ' disabled'}>&#9654;</button></div>`;
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
    else if (b.classList.contains('mbl-swap')) { choice = (choice + 1) % opps.length; showEnd(lastEnd); }
    else if (b.classList.contains('mbl-done') || b.classList.contains('mbl-leave')) close();
    else if (b.classList.contains('mbl-help')) toggleHelp();
    else if (b.classList.contains('mbl-hx')) toggleHelp(false);
    else if (b.dataset.goal != null) throwAt(+b.dataset.goal);
  });

  function showPick() {
    const P = $('.mbl-pick');
    P.innerHTML = `<h2>Mathball</h2><p class="mbl-lede">Throw each number ball into a goal its number fits. The light bar going round the room changes one goal's rule every 30 seconds. Most right balls wins.</p>
      ${ch ? `<p class="mbl-ask">${esc(ch.name)} is here to play you</p>
      <div class="mbl-who is-one"><button type="button" data-who="0" class="is-last"><b>${esc(ch.name)}</b><small>${esc(skillWords(ch))}</small></button></div>`
      : `<p class="mbl-ask">Who do you want to play?</p>
      <div class="mbl-who">${OPPONENTS.map((o, i) => `<button type="button" data-who="${i}" class="${i === choice ? 'is-last' : ''}"><b>${esc(o.name)}</b><small>${esc(o.line)}</small><small class="mbl-skill">${esc(skillWords(o))}</small></button>`).join('')}</div>`}
      ${levelHtml()}`;
    P.hidden = false;
    bodyFor(opps[choice]).catch(() => {});   // (the last one played, on the way already, so the start is quick)
  }

  // ── the other player's body (the crew kit) ────────────────────────────────────────────────────────────────────
  const looks = new Map();
  function lookOf(id) {
    const R = ROSTER.find((r) => r.id === id), look = R ? R.look : FALLBACK_LOOK;
    return typeof look === 'string' ? (lib.list.recipes || {})[look] || FALLBACK_LOOK : look;
  }
  // (a challenged person: the look they wear about the station, as the station's people are made: life.js lookRecipe)
  function lookFor(opp) {
    if (!opp.challenge || !opp.look) return lookOf(opp.id);
    try { return lookRecipe(opp.look, opp.def, lib) || lookOf(opp.id); } catch (e) { return lookOf(opp.id); }
  }
  const keyOf = (opp) => (opp.challenge ? 'challenge:' : '') + opp.id;
  async function bodyFor(opp) {
    const k = keyOf(opp);
    if (looks.has(k)) return looks.get(k);
    const p = makeCrew(lib, lookFor(opp)).then((c) => { c.root.visible = false; W.scene.add(c.root); return c; });
    looks.set(k, p); return p;
  }
  let hiddenPerson = null;
  function hideStationCopy(id) {
    const ppl = people(); if (hiddenPerson) { hiddenPerson.hidden = false; hiddenPerson = null; }
    const P = ppl && ppl.list.find((x) => x.id === id); if (P && !P.hidden) { P.hidden = true; hiddenPerson = P; }
  }

  // ── a round ───────────────────────────────────────────────────────────────────────────────────────────────────
  async function startRound() {
    if (closed) return;
    const opp = opps[choice];
    // the level this round is played at: Mathwood's (a first time finds it: placement), and its rule set
    const dealt = E.deal(crew, job, { rand: Math.random });
    level = dealt.level; set = LADDER.find((s) => s.key === level.id) || LADDER[0];
    const tally = E.jobTally(crew, job.id);
    if (!opp.challenge) tally.other = OPPONENTS.indexOf(opp);
    onSave();
    G = makeRound({ set, rand: Math.random, other: { skill: opp.skill }, youRate: tally.rate || OTHER.youRate });
    view.use(G); view.playing = true;
    dropWindow(true);
    other = opp; earned = 0; round++;
    $('.mbl-pick').hidden = true; $('.mbl-end').hidden = true; $('.mbl-top').hidden = false;
    $('.mbl-them b').textContent = opp.name.replace(/^(old )?(Captain|Pilot) /, '');
    $('.mbl-cr span').textContent = '0';
    say('Here come the balls, out of the walls', 2.5); askedBall = false; lookRound.said = false; lookRound.unseenFor = 0;
    phase = 'play';
    hideStationCopy(opp.id);
    // the body: the one already made for this crew member, or made now (the round waits for nothing: until it comes,
    // the other player is only their ring)
    if (otherBody && lastBody !== keyOf(opp)) { otherBody.root.visible = false; }
    otherBody = null;
    bodyFor(opp).then((c) => { if (closed || other !== opp) return; otherBody = c; lastBody = keyOf(opp); c.root.visible = true; shine(c, W.envAt(new THREE.Vector3(MID[0], 1, MID[2]))); for (const o2 of [c.root]) o2.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) lifted.delete(m); }); lift(c); c.clipNow = ''; }).catch((e) => console.warn('Mathball: no body for ' + opp.name, e));
  }
  let lastEnd = null;
  function showEnd(r) {
    lastEnd = r; const opp = opps[choice], was = other || opp;
    const words = r.you > r.them ? 'You win!' : r.you < r.them ? `${esc(was.name)} wins this one` : 'A draw!';
    const E2 = $('.mbl-end'), mine = bestWords(r.best);
    E2.innerHTML = `<h2>${words}</h2>
      <div class="mbl-final"><span><b>You</b><em>${r.you}</em></span><span class="mbl-dash">to</span><span><em>${r.them}</em><b>${esc(was.name)}</b></span></div>
      <p class="mbl-earned"><i aria-hidden="true"></i>${earned.toLocaleString('en-US')} credits this round</p>
      ${mine ? `<p class="mbl-best${r.best.beaten ? ' is-new' : ''}">${esc(mine)}</p>` : ''}
      ${levelHtml(r.played ?? null)}
      <div class="mbl-endgo"><button type="button" class="mbl-again">Play again<kbd>Enter</kbd></button>
      <button type="button" class="mbl-swap">Against: ${esc(opp.name)} &#9656;</button>
      <button type="button" class="mbl-leave">Leave</button></div>`;
    E2.hidden = false; goalsEl.hidden = true;
  }

  // ── Help: the four rules explained (never opens by itself; X and Esc close it; the round holds still) ───────────
  function toggleHelp(on = helpBox.hidden) {
    if (on) {
      helpBox.querySelector('ul').innerHTML = G.goals.map((g, i) => { const R = ruleOf(g.rule), note = wholeNote(g.rule, G.balls.filter((x) => x.mode !== 'gone').map((x) => x.num)); return `<li style="--c:${GOAL_CSS[GOALS[i].colour]}"><b>The ${GOALS[i].colour} goal: ${esc(R.say)}</b><span>${esc(R.help)}${note ? ' ' + esc(note) : ''}</span><small>${esc(R.list)}</small></li>`; }).join('');
      helpBox.querySelector('.mbl-hhow').textContent = `${press('a ball')} to run to it and pick it up, then ${touchy() ? 'tap' : 'click'} a goal its number fits (or one of the goal buttons). The dotted arc shows where a throw will go, and turns the goal's colour when it goes into that goal${touchy() ? (HANDS.aimByRest ? ' (to aim it, hold a finger still on the court a moment, then move it; lifting the finger throws)' : '') : ' (it follows the mouse)'}. ${touchy() ? 'Swipe or drag sideways on the right of the screen' : 'Drag with the mouse button held'} to turn the view${FRONT.buttonTurns ? "; it turns by itself only when you press a goal's button for a goal you can't see, to face that goal" : ': nothing else turns it'}. A ball can fit more than one goal. The bar of light going round the room over the goals (and along the top of the screen) changes a goal's rule when it gets to that goal; back where it started, the round ends.`;
    }
    helpBox.hidden = !on; paused = on && phase === 'play';
    $('.mbl-help').classList.remove('is-nudge');
  }

  // ── the player's hands on the court: taps, drags and aims (hands.js) ─────────────────────────────────────────────
  // (the shared input still makes the walking stick and the keys; its own looks and picks are not used here: its tap
  // was a press that moved under 6 pixels, so many a finger's tap on a ball was a small drag of the view instead)
  // -- AIMING: the arc shows where a throw would go: at what the mouse is over, or a goal button pressed (or hovered),
  // or (HANDS.aimByRest, off) a finger rested on the court; else straight ahead, the way the camera looks (never
  // snapped to a goal: the arc points no goal out by itself)
  const canvas = W.renderer.domElement;
  const hands = makeHands(), downAt = new Map();
  const aimUI = { mouse: null, touch: null, button: null, hover: null };
  let aimT = null;
  const inPlay = () => !closed && phase === 'play' && !paused;
  // (each pointer is timed by its event's own time stamp, the same clock as performance.now(): a stall of the page
  // between two events never makes a press look longer than it was)
  const stamp = (e) => (e.timeStamp > 0 ? e.timeStamp : performance.now());
  const onDown = (e) => {
    if (closed || paused || (phase !== 'play' && phase !== 'end')) return;
    const touch = e.pointerType !== 'mouse';
    if (!touch && e.button !== 0 && e.button !== 2) return;
    hands.down(e.pointerId, { x: e.clientX, y: e.clientY, t: stamp(e), touch, button: e.button, width: innerWidth, aimable: inPlay() && !!G.you.holding });
    downAt.set(e.pointerId, ballsOnScreen());   // (where each ball was as the press began: a rolling one moves under a finger)
    if (!hands.aiming) aimUI.touch = null;   // (a second finger made a pinch of an aim: its arc goes)
  };
  const onMove = (e) => {
    if (e.pointerType === 'mouse') {
      aimUI.mouse = { x: e.clientX, y: e.clientY };
      // (a mouse drag whose button was let go outside the page: it ends here, so plain hovering never turns the view)
      if (e.buttons === 0 && hands.pointers.has(e.pointerId)) { hands.cancel(e.pointerId); downAt.delete(e.pointerId); return; }
    }
    const r = hands.move(e.pointerId, e.clientX, e.clientY, stamp(e)); if (!r) return;
    // (the player's own drag: the only thing that turns the view; it ends a goal button's turn, and the throw waiting on it)
    if (r.turn && !paused && !closed) { viewTurn(cam, r.turn[0], e.pointerType === 'mouse' ? r.turn[1] : 0); cam.byHand++; oneTurn = null; pending = null; }
    if (r.aim) aimUI.touch = { x: r.aim[0], y: r.aim[1] };
  };
  const onUp = (e) => {
    if (!hands.pointers.has(e.pointerId)) return;
    const from = downAt.get(e.pointerId); downAt.delete(e.pointerId);
    let r = null;
    if (e.type === 'pointerup') r = hands.up(e.pointerId, e.clientX, e.clientY, stamp(e)); else hands.cancel(e.pointerId);
    if (!hands.aiming) aimUI.touch = null;   // (no finger aims now: no arc left behind, a pinch's or a cancel's either)
    if (!r || !inPlay()) return;
    // (a finger that aimed throws where it lifts: a goal, or a spot in front; a press that never moved is a tap; a drag
    // never picks a ball)
    if (r.aimed) { const T = targetAt(e.clientX, e.clientY); if (T && T.ball == null && G.you.holding) commitAim(T); return; }
    if (r.tap) tapAt(r.tap, from);
  };
  // (the page loses the focus, or is hidden: every pointer let go, as the shared input does)
  const letGo = () => { hands.reset(); downAt.clear(); aimUI.touch = null; aimUI.button = null; };
  const onHidden = () => { if (document.hidden) letGo(); };
  const onAimLeave = (e) => { if (e.pointerType === 'mouse') aimUI.mouse = null; };
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerleave', onAimLeave);
  addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
  addEventListener('blur', letGo); document.addEventListener('visibilitychange', onHidden);
  // where each ball free to pick is on the screen: its middle and its radius there (page pixels)
  const _bp = new THREE.Vector3();
  function ballsOnScreen() {
    const C = W.camera, r = canvas.getBoundingClientRect(), out = [], held = G.you.holding;
    const k = (r.height / 2) / Math.tan((C.fov * Math.PI / 180) / 2);
    for (const b of G.balls) {
      if (b === held || b.fading || !['air', 'roll', 'rest', 'turn'].includes(b.mode)) continue;
      const m = view.ballMesh(b.id); if (!m) continue;
      _bp.copy(m.position).applyMatrix4(C.matrixWorldInverse); const depth = -_bp.z; if (depth < 0.2) continue;
      _bp.copy(m.position).project(C);
      out.push({ id: b.id, x: r.left + (_bp.x + 1) / 2 * r.width, y: r.top + (1 - _bp.y) / 2 * r.height, r: PHYS.r / depth * k, depth });
    }
    return out;
  }
  // A TAP (or a click): what it does is hands.js chooseTap, in its order; here, what lies under it, fed in. Where each
  // ball was a moment ago is kept in the court (hands.js remember) and put through the camera as it is NOW, so a turn
  // of the view never leaves a ball where it never was
  const _wp = new THREE.Vector3();
  function toScreen(p) {
    const C = W.camera, r = canvas.getBoundingClientRect();
    _wp.set(MID[0] + p[0], p[1], MID[2] + p[2]).applyMatrix4(C.matrixWorldInverse); if (-_wp.z < 0.2) return null;
    _wp.set(MID[0] + p[0], p[1], MID[2] + p[2]).project(C);
    return [r.left + (_wp.x + 1) / 2 * r.width, r.top + (1 - _wp.y) / 2 * r.height];
  }
  function tapAt(p, from) {
    sound.wake();
    const held = G.you.holding, touch = !!p.touch, hit = input.pickAt(p.x, p.y, touch), d = hit && !hit.near ? hit.data : {};
    const now = ballsOnScreen();
    // (empty hands: the nearest ball within reach, where it is, was as the finger came down, or was a moment ago; a
    // ball in hand: none of that, only a ball the finger is inside)
    let near = null;
    if (!held) {
      const was = new Map((from || []).map((b) => [b.id, b])), past = pastOnScreen(seenBalls, toScreen);
      near = nearestBall(p.x, p.y, now.map((b) => ({ ...b, past: past.get(b.id), ...(was.has(b.id) ? { x0: was.get(b.id).x, y0: was.get(b.id).y } : {}) })), touch ? HANDS.reach.touch : HANDS.reach.mouse);
    }
    // (the goal just beside the tap, found with no ball able to hide it; and, for the mouse, a spot a click throws to)
    const goalBy = goalBeside(p.x, p.y, touch);
    // (the mouse, a ball in hand: a click on the floor, even just beside a ball, throws there; balls play no part)
    let spot = false; if (held && !touch) { const T = targetAt(p.x, p.y, false); spot = !!(T && T.at); }
    const exact = d.ball != null && (!held || d.ball !== held.id) ? d.ball : null;
    const what = chooseTap({
      held: !!held, touch,
      underIn: p.from && from ? underAt(p.from[0], p.from[1], from, 0) : null,
      under: !held && p.from && from ? underAt(p.from[0], p.from[1], from, touch ? HANDS.onIt.touch : HANDS.onIt.mouse) : null,
      hitBall: exact ?? underAt(p.x, p.y, now, 0),
      near, hitGoal: d.goal != null ? d.goal : null, goalBy, spot,
    });
    if (!what) return false;
    if (what.pick != null) return pickBall(what.pick);
    if (what.throw != null) { throwAt(what.throw, 'court'); return true; }
    if (what.toss) return commitAim(targetAt(p.x, p.y, false));
    if (what.say) say(press('a ball first, then a goal'), 2.5);
    return false;
  }
  // the goal buttons: hovered by the mouse, the arc shows (a goal in view); pressed, the arc shows; let go (the click):
  // the throw, and for a goal out of the way the view turns to it once first (FRONT.buttonTurns: throwAt). A press
  // taken back (slid off, or the buttons redrawn under the finger) turns nothing
  const onButtonOver = (e) => { const b = e.target.closest('button[data-goal]'); if (b && e.pointerType === 'mouse') aimUI.hover = +b.dataset.goal; };
  const onButtonOut = (e) => { const b = e.target.closest('button[data-goal]'); if (b && !b.contains(e.relatedTarget)) { aimUI.hover = null; aimUI.button = null; } };
  const onButtonDown = (e) => { const b = e.target.closest('button[data-goal]'); if (!b || !inPlay() || !G.you.holding) return; aimUI.button = +b.dataset.goal; };
  const onButtonUp = () => { aimUI.button = null; };
  goalsEl.addEventListener('pointerover', onButtonOver); goalsEl.addEventListener('pointerout', onButtonOut);
  goalsEl.addEventListener('pointerdown', onButtonDown); addEventListener('pointerup', onButtonUp); addEventListener('pointercancel', onButtonUp);

  const aimRay = new THREE.Raycaster(), aimNdc = new THREE.Vector2();
  // THE GOAL BESIDE A POINT, with no ball able to hide it (a ball come to rest at a goal's mouth): the floor at a goal's
  // mouth under the point (in front of the view), else a goal's box on the screen padded as the shared input pads a
  // near miss; null if neither
  const _gb = new THREE.Box3(), _gv = new THREE.Vector3();
  function goalBeside(x, y, touch) {
    const r = canvas.getBoundingClientRect();
    aimNdc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    aimRay.setFromCamera(aimNdc, W.camera);
    const o = aimRay.ray.origin, dir = aimRay.ray.direction;
    if (dir.y < -1e-4) {
      const t = -o.y / dir.y, px = o.x - MID[0] + dir.x * t, pz = o.z - MID[2] + dir.z * t;
      if (offFront([px, PHYS.r, pz]) <= FRONT.arc) { const gi = mouthAt(px, pz, GOALS, COURT.goal.w); if (gi != null) return gi; }
    }
    const pad = touch ? 26 : 10; let best = null, bd = Infinity;
    for (const m of view.goalHits) {
      _gb.setFromObject(m); if (_gb.isEmpty()) continue;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = false;
      for (let i = 0; i < 8; i++) {
        _gv.set(i & 1 ? _gb.max.x : _gb.min.x, i & 2 ? _gb.max.y : _gb.min.y, i & 4 ? _gb.max.z : _gb.min.z).project(W.camera);
        if (_gv.z > 1) { behind = true; break; }
        const sx = r.left + (_gv.x + 1) / 2 * r.width, sy = r.top + (1 - _gv.y) / 2 * r.height;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      if (behind || x < x0 - pad || x > x1 + pad || y < y0 - pad || y > y1 + pad) continue;
      const d = Math.hypot(x - (x0 + x1) / 2, y - (y0 + y1) / 2); if (d < bd) { bd = d; best = m.userData.goal; }
    }
    return best;
  }
  // what a point on the page aims at (balls false: looking past any ball): { goal } (its box, or the floor just in
  // front of its mouth), { at, hit } (a spot on the floor, or on a wall at a height a throw reaches), { ball } (another
  // ball: a click there picks it), or null
  function targetAt(x, y, balls = true) {
    const hit = input.pickAt(x, y), d = hit && hit.data, held = G.you.holding;
    if (d && d.goal != null) return { goal: d.goal };
    if (balls && d && d.ball != null && (!held || d.ball !== held.id)) return { ball: d.ball };
    const r = canvas.getBoundingClientRect();
    aimNdc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    aimRay.setFromCamera(aimNdc, W.camera);
    const o = aimRay.ray.origin, dir = aimRay.ray.direction, ox = o.x - MID[0], oz = o.z - MID[2];
    if (dir.y < -1e-4) {
      const t = -o.y / dir.y, px = ox + dir.x * t, pz = oz + dir.z * t;
      if (inside(px, pz) > PHYS.r) {
        // (only in front: a spot behind the player, toward the camera, is no aim, even the floor at the mouth of a goal
        // there: with the camera held off the near wall, that floor is at the bottom of the screen, and a finger
        // resting on it swung the view round to the goal behind; FRONT)
        if (offFront([px, PHYS.r, pz]) > FRONT.arc) return null;
        // (the floor in front of a goal's mouth counts as the goal: an aim a little short still goes in)
        { const gi = mouthAt(px, pz, GOALS, COURT.goal.w); if (gi != null) return { goal: gi }; }
        // (nor is a spot at the player's feet, a step away or less, where the arc would only drop the ball: FRONT.near)
        return Math.hypot(px - G.you.x, pz - G.you.z) >= FRONT.near ? { at: [px, PHYS.r, pz], hit: 'floor' } : null;
      }
    }
    // (a wall: the nearest one the ray meets inside the court, the spot held to what a throw reaches)
    let best = null;
    for (const Wl of WALLS) {
      const den = Wl.n[0] * dir.x + Wl.n[1] * dir.z; if (den >= -1e-6) continue;
      const t = -(Wl.n[0] * (ox - Wl.A[0]) + Wl.n[1] * (oz - Wl.A[1])) / den; if (t <= 0 || (best && t >= best.t)) continue;
      const px = ox + dir.x * t, pz = oz + dir.z * t, along = (px - Wl.A[0]) * Wl.u[0] + (pz - Wl.A[1]) * Wl.u[1];
      if (along < -0.05 || along > Wl.len + 0.05) continue;
      best = { t, px, pz, py: o.y + dir.y * t, n: Wl.n };
    }
    // (in front, and more than a step away, as a floor spot: a spot on the wall right beside the player drew a short hook)
    if (best) { const at = [best.px + best.n[0] * PHYS.r, Math.max(0.45, Math.min(3.0, best.py)), best.pz + best.n[1] * PHYS.r]; return offFront(at) <= FRONT.arc && Math.hypot(at[0] - G.you.x, at[2] - G.you.z) >= FRONT.near ? { at, hit: 'wall' } : null; }
    return null;
  }
  // straight ahead: where a throw the way the camera looks would land
  function aheadAim() {
    const h = cam.yaw, [x, z] = clampIn(G.you.x + Math.sin(h) * 4.5, G.you.z + Math.cos(h) * 4.5, 0.7);
    return { at: [x, PHYS.r, z], hit: 'floor', ahead: true };
  }
  // AIMING ONLY IN FRONT (the game's maker, MB-11: "You should only be able to aim in front of you ... The mouse pointer
  // should aim, and that should be in front (at least where the camera is pointing)"). An aim's way from the player is
  // measured against the way the camera looks (offFront): the mouse or a finger aims only at a spot within FRONT.arc of
  // it (targetAt), so an arc never runs back toward the camera; a goal out of view (seen: further round than FRONT.arc,
  // or off the side of the screen) shows no arc. The view never turns to an aim by itself: only a goal's button
  // PRESSED for a goal out of the way turns it, once (FRONT.buttonTurns: oneTurn), and a throw at it waits for that turn
  // (pending).
  function aimNow() {
    const Y = G.you; if (phase !== 'play' || !Y.holding) return null;
    if (Y.aim != null) return { goal: Y.aim };
    if (Y.toss) return { at: Y.toss, hit: 'floor' };
    let T = null;
    if (pending != null) T = { goal: pending };
    else if (aimUI.button != null && goalsShown) T = { goal: aimUI.button };
    else if (aimUI.hover != null && goalsShown) T = { goal: aimUI.hover };
    else { const pt = aimUI.touch || aimUI.mouse; T = (pt && targetAt(pt.x, pt.y)) || null; }
    if (T && T.goal != null && !seen(T.goal)) return { goal: T.goal, wait: true };
    return T || aheadAim();
  }
  // the throw at an aim: physics.js flightPath from where the ball leaves the hand (game.js throwFrom: the throw's own).
  // (none for the straight-ahead aim: an arc nobody aimed read as a trail left on the floor)
  function pathFor(T) {
    if (!T || T.ball != null || T.ahead || T.wait) return null;
    const to = T.goal != null ? GOALS[T.goal].aim : T.at, from = throwFrom(G.you.x, G.you.z, to);
    const p = flightPath(from, to, lobTime(from, to), { free: T.goal == null });
    p.goal = T.goal != null ? T.goal : -1;
    return p;
  }
  let lastArc = null;
  function commitAim(T) {
    if (!T || T.ball != null || !G.you.holding) return false;
    lastArc = pathFor(T);
    if (T.goal != null) { throwAt(T.goal, 'court'); return true; }
    return G.tossAt(T.at);
  }
  const ballTargets = new Map();
  function syncTargets() {
    // (every ball that can be picked up is something a tap can hit: never one flying to a goal, just scored, fading, or
    // in either player's hands, which would only hide a goal behind it; the goals' boxes always are)
    const live = new Set();
    for (const b of G.balls) {
      if (!canPick(b)) continue;
      const m = view.ballMesh(b.id); if (!m) continue; live.add(b.id);
      // (a new round's ball with an old round's number: its own mesh, never the old one's)
      const had = ballTargets.get(b.id); if (had && had.m !== m) { had.off(); ballTargets.delete(b.id); }
      if (!ballTargets.has(b.id)) ballTargets.set(b.id, { m, off: input.addTarget(m, { ball: b.id }) });
    }
    for (const [id, T] of ballTargets) if (!live.has(id)) { T.off(); ballTargets.delete(id); }
  }
  const goalOff = view.goalHits.map((m) => input.addTarget(m, { goal: m.userData.goal }));
  function pickBall(id) {
    if (!G.pick(id)) return false;
    if (/a ball to grab it/.test(hint.textContent)) say('', 0);   // (you run to it by yourself)
    return true;
  }
  // a throw at a goal: `how` it was asked for: 'court' (the goal itself, tapped or clicked where it shows, even the part
  // of it at the screen's side: the player sees it, so the throw goes and nothing turns), 'button' (a goal button: a goal
  // out of the way turns the view to it once, A, or says where it is, B), 'ready' (the turn done)
  function throwAt(gi, how = 'button') {
    if (phase !== 'play' || paused) return;
    if (!G.you.holding) { say(press('a ball first, then a goal'), 2.5); return; }
    // (a goal's button for a goal not on the screen: A, the view turns to it once and the throw waits for that; B, a
    // line says where it is. A goal on the screen is thrown at, and nothing turns)
    const does = how === 'button' ? buttonDoes(seen(gi), FRONT.buttonTurns) : 'throw';
    if (does === 'turn') { if (pending !== gi) pendingAt = G.t; pending = gi; oneTurn = gi; return; }
    if (does === 'say') { const g = GOALS[gi].aim; say(`The ${GOALS[gi].colour} goal is ${offFront(g) > Math.PI / 2 ? 'behind you' : 'out of view'}: drag the view round to it`, 3); return; }
    pending = null;
    if (!lastArc || lastArc.goal !== gi || G.you.aim == null) lastArc = pathFor({ goal: gi });
    G.throwAt(gi);
  }
  // how far round from the way the camera looks a spot is, seen from the player (radians, 0 straight ahead, PI behind)
  function offFront(to) { return Math.abs(wrapA(Math.atan2(to[0] - G.you.x, to[2] - G.you.z) - cam.yaw)); }
  // how far across the screen a spot on the court is, as the camera sees it: 0 in the middle, 1 at the screen's side
  // (more: off it); behind the camera, 9
  const _sv = new THREE.Vector3();
  function across(to) {
    const C = W.camera; _sv.set(MID[0] + to[0], to[1], MID[2] + to[2]).applyMatrix4(C.matrixWorldInverse);
    if (_sv.z > -0.05) return 9;
    return Math.abs(_sv.applyMatrix4(C.projectionMatrix).x);
  }
  // a goal in front, for a throw: within FRONT.turn of the way the camera looks and well inside the view (or turned to
  // and waited on a moment: a camera held off a wall can leave a goal near the side for good)
  const inFront = (gi) => offFront(GOALS[gi].aim) <= FRONT.turn && (across(GOALS[gi].aim) <= FRONT.edge || (pending === gi && G.t - pendingAt > FRONT.wait));
  // where on the page a spot on the court is drawn ([x, y] page px), or null behind the camera
  function pageAt(to) {
    const C = W.camera, r = canvas.getBoundingClientRect(); _sv.set(MID[0] + to[0], to[1], MID[2] + to[2]).applyMatrix4(C.matrixWorldInverse);
    if (_sv.z > -0.05) return null;
    _sv.applyMatrix4(C.projectionMatrix);
    return [r.left + (_sv.x + 1) / 2 * r.width, r.top + (1 - _sv.y) / 2 * r.height];
  }
  // the foot of the top bar (the score and the credits): a goal under it is not in view
  const topBar = () => { const t = $('.mbl-top'); return t && !t.hidden ? t.getBoundingClientRect().bottom : 0; };
  // A GOAL IN VIEW, by the screen alone: its mouth drawn on the screen, across and up and down, under the top bar as
  // the page has it now (an arc for it shows, the line after a pick-up and the goal buttons go by it)
  const seen = (gi) => inView(pageAt(GOALS[gi].aim), canvas.getBoundingClientRect(), topBar());
  // (pending: a goal button's throw waiting for its turn; oneTurn: the goal that turn faces, until it does or a drag)
  let pending = null, pendingAt = 0, oneTurn = null, placeReq = null;   // (placeReq: a rig's hook, placeAt)
  const seenBalls = []; let clock = 0;   // (where each free ball was in the court this last moment, HANDS.past s: tapAt)

  // ── each frame ─────────────────────────────────────────────────────────────────────────────────────────────────
  // (yaw: the view's turn, which only a drag sideways changes (hands.js viewTurn) and a goal button's one turn
  // (turnToward); lift: the mouse's drag up and down, as on main; feet: the player's place, followed smoothly; f: main's
  // framing numbers, eased)
  const cam = { yaw: Math.PI, lift: 0, s: { at: null }, fresh: true, blend: 1, from: null, fromLook: null, byHand: 0 };   // (byHand: drags taken, for the rigs)
  let lastCam = new THREE.Vector3(MID[0], 3, MID[2] + 8);
  const youNow = { x: 0, z: 0, vx: 0, vz: 0, heading: 0 }, prev = new THREE.Vector3();
  let throwT = -1, goalsShown = false, endT = 0, askedBall = false, liftedP = null, askAt = 0;
  const lookRound = { said: false, unseenFor: 0 };   // (the once-a-round line on looking round: hands.js lookRoundDue)
  function update(dt, P) {
    if (closed) return;
    // (the shared input's drags and zooms, taken so the station's camera never sees them: Mathball's own drags turn its
    // view, onMove; a finger rested long enough on the court with a ball in hand begins to aim)
    input.takeLook(); input.takeZoom();
    for (const a of hands.tick(performance.now())) if (inPlay() && G.you.holding) aimUI.touch = { x: a.aim[0], y: a.aim[1] };
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
      // (holding a ball: the goal buttons come up; a new ball in the hand, a word on what to do, 0.9 s on)
      if (G.you.holding && !held) { showGoals(true); askAt = G.t + 0.9; }
      if (askAt && (!G.you.holding || G.you.aim != null || G.you.toss)) askAt = 0;
      // (no goal in view: the goals' buttons are named, never which one is right: that is the sum)
      // (no goal in view: under A its button is named; under B, where a button for a goal out of view only says to look
      // round, the line says to look round)
      if (askAt && G.t >= askAt) {
        askAt = 0;
        const more = GOALS.some((g, i) => seen(i)) ? '' : FRONT.buttonTurns ? `, or ${touchy() ? 'tap' : 'click'} its button` : `, or ${touchy() ? 'swipe sideways on the right of the screen' : 'drag with the mouse'} to look round for one`;
        say(`Now ${touchy() ? 'tap' : 'click'} a goal that takes ${G.you.holding.num}${more}`, 4);
      }
      if (!G.you.holding && goalsShown) showGoals(false);
    } else if (phase === 'end') G.step(dt, { eye, sees: (b) => view.sees(b) });
    // (a ball in a hand, the player's or the other player's: its number turned to the camera, upright on the screen)
    if (G.you.holding) view.facing(G.you.holding, W.camera);
    if (G.other.holding) view.facing(G.other.holding, W.camera);
    // the aiming arc, while a ball is in hand (a goal button's throw at a goal out of the way waits, pending, for the
    // view's one turn to it, and goes once the goal is in front)
    if (pending != null && (!G.you.holding || phase !== 'play')) pending = null;
    if (oneTurn != null && phase !== 'play') oneTurn = null;
    if (pending != null && inFront(pending)) throwAt(pending, 'ready');
    aimT = aimNow(); view.aim(pathFor(aimT));
    syncTargets();
    // (where each ball has been in the court this last moment: a tap where a person saw one still picks it)
    clock += dt;
    if (phase === 'play') remember(seenBalls, clock, G.balls.filter((b) => b !== G.you.holding && !b.fading && ['air', 'roll', 'rest', 'turn'].includes(b.mode)), HANDS.past);
    else seenBalls.length = 0;
    view.update(dt, W.camera);
    otherBodyStep(dt);
    hud(dt);
    if (hintUntil && G.t > hintUntil && phase === 'play') { hintUntil = 0; hint.textContent = ''; hint.className = 'mbl-hint'; }
    if (theirsUntil && G.t > theirsUntil) { theirsUntil = 0; $('.mbl-theirs').textContent = ''; }
    // (the first ask for a ball waits until one is in view, settled enough to see)
    if (phase === 'play' && !askedBall && !G.you.holding && !G.you.target && G.balls.some((b) => b.seen && (b.mode === 'roll' || b.mode === 'rest'))) { askedBall = true; say(press('a ball to grab it'), 5); }
    // (once a round: every ball on the court behind the view for two seconds, with empty hands: one plain line on how to
    // look round, since nothing turns the view by itself now)
    // (it waits while another line is still showing: a score, a miss, a rule changing: hands.js lookRoundDue)
    if (phase === 'play' && lookRoundDue(lookRound, { dt, t: G.t, holding: !!G.you.holding, running: !!G.you.target, balls: G.balls, showing: !!(hintUntil && G.t < hintUntil && hint.textContent) })) {
      say(touchy() ? 'Swipe sideways on the right of the screen to look round for the balls' : 'Drag with the mouse to look round for the balls', 4);
    }
  }
  // THE GOAL BUTTONS: a small map of the four goals, two rows of two: the end of the court the camera looks toward on
  // top, each row as the goals stand across the view (looking north, west on the left; looking south, the other way
  // round). The same goal keeps its place throw after throw; the map turns only when the view has turned round.
  // (the end of the court the view looks toward as the ball comes into the hand: only the player turns the view, so
  // the map is laid out for the way they have it)
  const farSouth = () => Math.cos(cam.yaw) > 0;
  function goalOrder() {
    const north = !farSouth();
    const key = (g) => GOALS.findIndex((x) => x.key === g);
    return north ? ['NW', 'NE', 'SW', 'SE'].map(key) : ['SE', 'SW', 'NE', 'NW'].map(key);
  }
  function showGoals(on) {
    goalsShown = on; goalsEl.hidden = !on; if (!on) { aimUI.button = null; return; }
    goalsEl.innerHTML = goalOrder().map((i) => { const R = ruleOf(G.goals[i].rule), w = R.sign.length === 2 ? `<small>${esc(R.sign[0])}</small><b${R.sign[1].length > 5 ? ' class="is-long"' : ''}>${esc(R.sign[1])}</b>` : `<b class="is-words">${esc(R.sign[0])}</b>`; return `<button type="button" data-goal="${i}" style="--c:${GOAL_CSS[GOALS[i].colour]}" aria-label="Throw at the ${GOALS[i].colour} goal: ${esc(R.say)}">${w}</button>`; }).join('');
  }
  // (the other player's goals, on a small line of their own under the score, for a few seconds)
  let theirsUntil = 0;
  function theirs(words) { const t = $('.mbl-theirs'); t.textContent = keep(words); theirsUntil = G.t + 2.6; }
  function onEvent(e) {
    const name = other ? other.name : 'They';
    const panOf = (p) => { if (!p) return 0; const v = new THREE.Vector3(MID[0] + p[0], 1, MID[2] + p[2]).project(W.camera); return Math.max(-0.8, Math.min(0.8, v.x)); };
    const ball = e.ball != null ? G.balls.find((b) => b.id === e.ball) : null;
    if (e.type === 'launch') { view.flashPort(e.port); sound.play('launch', { gain: 0.7, pan: panOf(ball && ball.p) }); }
    else if (e.type === 'got') sound.play('grab', { gain: e.who === 'you' ? 1 : 0.5 });
    else if (e.type === 'throw') { sound.play('throw', { gain: e.who === 'you' ? 1 : 0.6 }); if (e.who === 'you') { throwT = 0; if (/^Now /.test(hint.textContent)) say('', 0); } }
    // (a ball thrown at the floor or a wall: no goal, no score; it lands and is anyone's again)
    else if (e.type === 'toss') { sound.play('throw', { gain: 0.8 }); throwT = 0; if (/^Now /.test(hint.textContent)) say('', 0); }
    else if (e.type === 'score') {
      view.strike(e.from, e.goal, 1);
      if (e.who === 'you') {
        const a = answer(true);
        sound.play('score'); say(`${e.why}  +${a ? a.pay : 0}`, 3.2, 'good'); $('.mbl-help').classList.remove('is-nudge');
      } else { sound.play('them', { gain: 0.8 }); theirs(`${name.replace(/^(Captain|Pilot) /, '')} scored: ${e.num}, ${ruleOf(e.rule).say}`); }
    } else if (e.type === 'bounce') {
      sound.play('bounce', { gain: e.who === 'you' ? 1 : 0.6 });
      if (e.who === 'you') { answer(false); say(`Bounced out: ${e.why}`, 5, 'bad'); $('.mbl-help').classList.add('is-nudge'); }
      else theirs(`${name.replace(/^(Captain|Pilot) /, '')}'s ${e.num} bounced out of “${ruleOf(e.rule).say}”`);
    } else if (e.type === 'change') {
      if (e.to !== e.from) {
        view.change(e.goal, e.to); sound.play('change'); say(`The ${GOALS[e.goal].colour} goal now takes ${ruleOf(e.to).takes || ruleOf(e.to).say}`, 3.5, 'change');
        // (its button changes at once, and flashes)
        if (goalsShown) { showGoals(true); const bt = goalsEl.querySelector(`button[data-goal="${e.goal}"]`); if (bt) bt.classList.add('is-new'); }
      }
    } else if (e.type === 'taken') say(`${name.replace(/^(Captain|Pilot) /, '')} got that one first`, 2.2, 'them');
    else if (e.type === 'end') endRound(e);
  }
  // a ball the player threw: an answer at the round's level (engine.js: the level, the kinds of math, the pay: a ball
  // pays its level's own amount, kind 'ball', as before: the game's maker kept Mathball's pay, "Fine as it is")
  function answer(right) {
    if (!level) return null;
    const q = { order: { kind: 'ball', coins: [{ good: right }], own: { strand: level.strand, at: level.grade }, credit: [], size: 1 }, level, misses: 0, picked: new Set(), done: false };
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
    // (this crew member's own best round, kept with their save; beaten, the station says so: src/mathball/best.js)
    const best = keepBest(tally, e.you);
    onSave(); sound.play('end');
    if (best.beaten) happened('best');
    showGoals(false); say('', 0);
    // (the card says the best under the credits: "Your best: N", or "New best!" when this round beat it)
    // (a round against someone who was challenged: the rest of the game is told, GAME.mathball.onEnd)
    if (other && other.challenge) challengePlayed({ opponent: other.id, mine: e.you, theirs: e.them, won: e.you > e.them });
    showEnd({ you: e.you, them: e.them, played: Math.max(0, LADDER.findIndex((s) => s.key === set.key)), best });
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
    if (placeReq) { P.place(new THREE.Vector3(MID[0] + placeReq[0], P.pos.y, MID[2] + placeReq[1]), P.heading); placeReq = null; }   // (a rig's hook: placeAt)
    let move = null, clip = null;
    const yaw = cam.yaw;
    const manual = input.move && input.move.mag > 0.12;
    if (phase === 'play' && !paused) {
      if (manual && G.you.target) G.you.target = null;   // (walking by hand drops the run to a ball)
      const w = G.you.want;
      if (!manual && w.to) {
        let dx = w.to[0] - youNow.x, dz = w.to[1] - youNow.z; const d = Math.hypot(dx, dz);
        if (d > 0.05) {
          // (round the other player, never through them: pushed off them inside a metre)
          dx /= d; dz /= d;
          const ox = youNow.x - G.other.x, oz = youNow.z - G.other.z, od = Math.hypot(ox, oz);
          if (od < 1.0 && od > 1e-3) { const k = (1.0 - od) * 2.2; dx += ox / od * k; dz += oz / od * k; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L; }
          // (as the thumb stick would push them, for the view as it looks: the run never turns the view)
          const mag = Math.min(1, d / 0.9), p = pushFor(dx, dz, yaw);
          move = { x: p.x * mag, y: p.y * mag, mag };
        }
      }
      if (!manual && w.face != null) { const dh = wrapA(w.face - P.heading); P.heading = wrapA(P.heading + dh * Math.min(1, 12 * dt)); }
      // (a ball in hand, standing: they turn to where they aim, the ball held up in front of them, the arc starting at
      // it: the camera behind them sees both)
      else if (!manual && G.you.holding && !w.to && aimT && aimT.ball == null) {
        const to = aimT.goal != null ? GOALS[aimT.goal].aim : aimT.at, dh = wrapA(Math.atan2(to[0] - G.you.x, to[2] - G.you.z) - P.heading);
        P.heading = wrapA(P.heading + dh * Math.min(1, 8 * dt));
      }
    }
    if (manual) move = input.move;
    // throwing: the arm's swing (the crew's reach, quick)
    if (throwT >= 0) { throwT += dt; clip = throwT < 0.55 ? 'Interact' : null; if (throwT > 0.55) throwT = -1; }
    else if (G.you.holding && G.t - (G.you.grabT ?? -9) < 0.4) clip = 'Interact';   // (the reach as you pick it up)
    return { move, run: true, yaw, clip, clipSpeed: 1.7, others: otherBody ? [{ pos: otherBody.root.position, hidden: false }] : [] };
  }

  // ── the game's camera ──────────────────────────────────────────────────────────────────────────────────────────
  // It follows the player's PLACE (smoothly), never their turn: the way it looks is cam.yaw exactly, every frame, and
  // only the player's drag (onMove) changes that, or a goal button's one turn (oneTurn, FRONT.buttonTurns)
  const _w = new THREE.Vector3(), _l = new THREE.Vector3(), _d = new THREE.Vector3();
  function aim(camera, dt) {
    if (closed) return;
    const C = tall() ? MBCAM.tall : MBCAM.wide;
    // (a goal's button pressed for a goal out of the way: the view turns to it once; done, or a drag, ends it)
    if (oneTurn != null) { const g = GOALS[oneTurn].aim; if (turnToward(cam, Math.atan2(g[0] - youNow.x, g[2] - youNow.z), FRONT.rate, dt)) oneTurn = null; }
    // (camera.js: main's framing away from walls, coming in beside one; its place eased in the court as main eased its
    // camera (MBCAM.ease) and kept inside the court every frame; the way it looks across the floor is cam.yaw exactly)
    const k = 1 - Math.exp(-MBCAM.ease * dt);
    if (cam.fresh) cam.s = { at: null };
    const T = target(C, youNow.x, youNow.z, cam.yaw, cam.lift, !!G.you.holding, MBCAM.under);
    const P = follow(cam.s, T, cam.yaw, k, MBCAM.under);
    _w.set(MID[0] + P.eye[0], P.eye[1], MID[2] + P.eye[2]); _l.set(MID[0] + P.look[0], P.look[1], MID[2] + P.look[2]);
    // (as the game opens: from where the station's camera was, over most of a second)
    if (cam.fresh) { cam.from = camera.position.clone(); cam.fromLook = camera.position.clone().add(camera.getWorldDirection(_d).multiplyScalar(4)); cam.blend = 0; cam.fresh = false; }
    if (cam.blend < 1) { cam.blend = Math.min(1, cam.blend + dt / 0.7); const e = cam.blend * cam.blend * (3 - 2 * cam.blend); _w.lerpVectors(cam.from, _w, e); _l.lerpVectors(cam.fromLook, _l, e); }
    camera.position.copy(_w); camera.lookAt(_l);
    if (camera.fov !== C.fov) { camera.fov = C.fov; camera.updateProjectionMatrix(); }
    lastCam.copy(camera.position);
  }
  // the way the view as drawn looks, across the floor (radians, as cam.yaw): for the rigs' every-frame log
  const viewYaw = () => { const d = W.camera.getWorldDirection(_d); return Math.atan2(d.x, d.z); };

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
    for (const f of goalOff) f(); for (const [, T] of ballTargets) T.off(); ballTargets.clear();
    canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerleave', onAimLeave);
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);
    removeEventListener('blur', letGo); document.removeEventListener('visibilitychange', onHidden);
    removeEventListener('pointerup', onButtonUp); removeEventListener('pointercancel', onButtonUp);
    if (keepShut) W.keepShut.delete(keepShut);
    if (hiddenPerson) { hiddenPerson.hidden = false; hiddenPerson = null; }
    if (ch) challengeLeft(ch.id);
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

  const arcEnd = (T) => { const p = pathFor(T); return p ? p.end.map((v) => +v.toFixed(2)) : null; };
  showPick();
  const M = {
    update, control, aim, close,
    pickBall, throwAt: (gi) => throwAt(gi), choose: (i) => { choice = i; startRound(); },
    aimAt: (x, y) => targetAt(x, y), placeAt: (x, z) => { placeReq = [x, z]; },
    faceTo: (y) => { viewTurn(cam, wrapA(cam.yaw - y) / HANDS.turn, 0); aimUI.mouse = null; },   // (a rig's: the turn set as by a drag)
    hands: HANDS, front: FRONT, cams: MBCAM,   // (for the rigs and the films of the game's maker's questions)
    get phase() { return phase; },
    state: () => ({
      phase, paused, t: +G.t.toFixed(2), set: set && set.key, level: level && level.id, score: { ...G.score }, tries: { ...G.tries }, earned, other: other && other.name, otherSkill: other ? other.skill : null, challenge: ch ? ch.id : null, otherMode: G.other.mode,
      goals: G.goals.map((g, i) => ({ i, colour: GOALS[i].colour, rule: g.rule, say: ruleOf(g.rule).say, off: +(offFront(GOALS[i].aim) * 180 / Math.PI).toFixed(1), across: +across(GOALS[i].aim).toFixed(2), inView: seen(i) })),
      holding: G.you.holding ? { id: G.you.holding.id, num: G.you.holding.num } : null, target: G.you.target ? G.you.target.id : null,
      balls: G.balls.filter((b) => b.mode !== 'gone').map((b) => { const f = facing(b, [lastCam.x - MID[0], lastCam.y, lastCam.z - MID[2]]); return { id: b.id, num: b.num, mode: b.mode, p: b.p.map((v) => +v.toFixed(2)), fits: G.goals.map((g) => ruleOf(g.rule).test(valueOf(b.num))), seen: !!b.seen, passed: b.passed, angle: +f.angle.toFixed(1), tilt: +f.tilt.toFixed(1), rest: b.restAt ? +b.restAt.angle.toFixed(1) : null }; }),
      you: { x: +youNow.x.toFixed(2), z: +youNow.z.toFixed(2) }, them: { x: +G.other.x.toFixed(2), z: +G.other.z.toFixed(2), holding: !!G.other.holding }, changes: G.changes, hint: hint.textContent,
      next: G.next(), body: !!otherBody,
      // (the aiming arc now: what it aims at, where it ends; and the last throw's, as it was made)
      aim: aimT ? { goal: aimT.goal ?? null, ball: aimT.ball ?? null, hit: aimT.goal != null ? 'goal' : aimT.hit || null, ahead: !!aimT.ahead, wait: !!aimT.wait, end: arcEnd(aimT),
        off: aimT.goal != null || aimT.at ? +((offFront(aimT.goal != null ? GOALS[aimT.goal].aim : aimT.at)) * 180 / Math.PI).toFixed(1) : null } : null,
      pending, oneTurn, camYaw: +cam.yaw.toFixed(4), viewYaw: +viewYaw().toFixed(4), tilt: +cam.lift.toFixed(4), topBar: Math.round(topBar()), dragging: hands.dragging, byHand: cam.byHand, opening: cam.blend < 1,
      lastArc: lastArc ? { goal: lastArc.goal, hit: lastArc.hit, end: lastArc.end.map((v) => +v.toFixed(2)) } : null,
    }),
    // (for the rigs: where a ball or a goal is on the screen, in page pixels)
    screenOf(kind, id) {
      const r = W.renderer.domElement.getBoundingClientRect();
      let p = null;
      if (kind === 'ball') { const m = view.ballMesh(id); if (m) p = m.position.clone(); }
      else if (kind === 'point') p = new THREE.Vector3(MID[0] + id[0], id[1], MID[2] + id[2]);
      else { const g = GOALS[id]; p = new THREE.Vector3(MID[0] + g.mid[0] + g.n[0] * 0.3, 1.0, MID[2] + g.mid[1] + g.n[1] * 0.3); }
      if (!p) return null;
      const v = p.project(W.camera); if (v.z > 1) return null;
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, on: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 };
    },
  };
  return M;
}
