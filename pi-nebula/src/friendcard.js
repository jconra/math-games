// A TAP ON A PERSON: the small card about them, and a talk (the game's maker, 2026-11-23: "Do we have any kind of
// interactions if you click on someone?"; the meter and its rules: src/friends.js).
//
// Clicking (the mouse) or tapping (a phone) one of the station's people close enough to talk to (CARD.reach) opens a
// card at the bottom of the screen: their name, their friendship meter (ten pips, halves shown), and what can be done:
// TALK (they stop and turn to the player and a short exchange plays in chat bubbles, the player's side too:
// src/lines.js FRIEND_TALK; half a pip, then nothing more for 5 minutes, the card saying when they will have more to
// say), and PLAY MATHBALL (only while the game has GAME.mathball: their skill, and the challenge; a finished game
// against them, won or lost, one and a half pips, GAME.mathball.onEnd). On a keyboard: F opens it for the nearest
// person in front of the player (F again closes it), 1 talks, 2 plays; each key shown beside its button, never in it.
// JOIN MY CREW (src/own.js askCrew; the game's maker: "Once you own a ship I think you should be able to ask people if
// they want to be part of your crew, and the friendship meter should determine if they say yes"): once the crew member
// owns a ship, one more row (key 3). The player asks in a bubble and the person answers in theirs: at 5 pips or more
// yes (kept with the crew member, and their card says "On your crew" from then on, the row gone); under 5 a kind no
// (src/lines.js CREW_ASK); a captain is asked and answers as anyone does (the game's maker, MYCREW1-1 B).
// It closes as the player walks off, at a job, on a run, in the lift, or when a captain's question comes up; it never
// opens over those. A tap is picked only as it lands (nothing is worked out on other frames): the people near the
// player, drawn, each tested as a line from their feet to their head on the screen, the nearest that is under it.
//
//   const F = makeFriendCard({ input, usable, camera, people: () => people, friends, crew: () => GAME.player, game: GAME, save })
//   F.update(dt, P)      each frame: P the player on their feet and free to talk (null: at a job, on a run...)
//   F.open(id) / F.close() / F.talk() / F.play() / F.join()   (and the rigs) F.state()  F.at(x, y) -> the person under a point
import * as THREE from 'three';
import { FRIENDS, waitWords } from './friends.js';
import { friendTalk, FRIEND_TALK, CREW_ASK } from './lines.js';
import { shipsOf, askCrew, onCrew } from './own.js';

// how near someone is to be talked to (m, across the floor), and how far the player goes before the card closes;
// how far beside a person's outline a click or a tap still picks them (px); a body's half width (m)
export const CARD = { reach: 3.6, leave: 5, padMouse: 6, padTouch: 18, half: 0.3 };
const READ = (w) => Math.min(6, 1.5 + w.length * 0.055);
const pick = (L) => L[Math.floor(Math.random() * L.length)];

const CSS = `
.pnf { position: fixed; right: 24px; bottom: calc(max(26px, env(safe-area-inset-bottom)) + 84px); z-index: 15; width: min(340px, calc(100vw - 24px)); box-sizing: border-box;
  padding: 10px 12px 12px 16px; color: #eef1f4; background: rgba(15, 19, 25, 0.92); box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.42);
  font: 400 14px/1.3 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none;
  clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px); }
.pnf[hidden], .pnf-row[hidden] { display: none; }
/* (the player's own line in a talk: a light bubble, so it reads as theirs and not the other person's) */
.pnb.is-you .pnb-box { color: #0d1420; background: rgba(214, 233, 247, 0.95); box-shadow: none; }
.pnb.is-you .pnb-tail { background: rgba(214, 233, 247, 0.95); }
.pnf-top { display: flex; align-items: center; gap: 8px; }
.pnf-w { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.pnf-w b { font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; color: #eef1f4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pnf-w small { font-size: 12.5px; color: #a7b0ba; }
.pnf-x { flex: none; width: 36px; height: 36px; border: 0; cursor: pointer; color: #c8d2dc; background: rgba(40, 47, 56, 0.92); box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.3); font: 400 20px/1 inherit; font-family: inherit;
  clip-path: polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px); }
.pnf-meter { display: flex; align-items: center; gap: 4px; margin: 8px 0 10px; }
.pnf-meter span { margin-left: 8px; font-size: 12.5px; color: #a7b0ba; white-space: nowrap; }
.pnf-pip { width: 17px; height: 17px; flex: none; background: linear-gradient(90deg, #8fd0ff var(--f, 0%), rgba(196, 220, 240, 0.16) var(--f, 0%));
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); transition: transform 0.25s ease; }
.pnf-pip.is-new { animation: pnf-pop 0.7s ease; }
@keyframes pnf-pop { 0% { transform: scale(1); } 35% { transform: scale(1.45); } 100% { transform: scale(1); } }
.pnf-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.pnf-row kbd { flex: none; width: 22px; text-align: center; font: 700 11px/1 inherit; font-family: inherit; padding: 4px 0; border-radius: 3px; color: #c8d2dc; background: rgba(255, 255, 255, 0.08); box-shadow: inset 0 0 0 1px rgba(196, 220, 240, 0.3); }
.pnf-row button { flex: none; min-width: 132px; height: 42px; padding: 0 14px; border: 0; cursor: pointer; font: 800 13.5px/1 inherit; font-family: inherit; letter-spacing: 0.07em; text-transform: uppercase;
  color: #0d1420; background: #cfe6f7; clip-path: polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px); }
.pnf-row button:disabled { cursor: default; color: #a7b0ba; background: rgba(40, 47, 56, 0.92); box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.3); }
.pnf-row small { flex: 1 1 auto; min-width: 0; font-size: 12.5px; color: #a7b0ba; }
.pnf-top kbd { flex: none; font: 700 11px/1 inherit; font-family: inherit; padding: 4px 6px; border-radius: 3px; color: #c8d2dc; background: rgba(255, 255, 255, 0.08); box-shadow: inset 0 0 0 1px rgba(196, 220, 240, 0.3); }
.pnf.is-touch kbd { display: none; }
@media (max-width: 640px) { .pnf { right: auto; left: 50%; transform: translateX(-50%); bottom: calc(max(26px, env(safe-area-inset-bottom)) + 86px); } .pnf-row button { min-width: 118px; } }
`;

export function makeFriendCard({ input, usable = null, camera, people = () => null, friends, crew = () => null, game = {}, save = () => {}, root = document.body }) {
  if (!document.getElementById('pnf-css')) { const st = document.createElement('style'); st.id = 'pnf-css'; st.textContent = CSS; document.head.appendChild(st); }
  const el = document.createElement('div'); el.className = 'pnf'; el.hidden = true;
  el.innerHTML = '<div class="pnf-top"><div class="pnf-w"><b></b><small></small></div><kbd>F</kbd><button type="button" class="pnf-x" aria-label="Close">&times;</button></div>' +
    '<div class="pnf-meter" role="img"></div>' +
    '<div class="pnf-row pnf-talk"><kbd>1</kbd><button type="button">Talk</button><small></small></div>' +
    '<div class="pnf-row pnf-play" hidden><kbd>2</kbd><button type="button">Play Mathball</button><small></small></div>' +
    '<div class="pnf-row pnf-crew" hidden><kbd>3</kbd><button type="button">Join my crew</button><small></small></div>';
  root.appendChild(el);
  const nameEl = el.querySelector('.pnf-w b'), whoEl = el.querySelector('.pnf-w small'), meterEl = el.querySelector('.pnf-meter');
  const talkRow = el.querySelector('.pnf-talk'), talkB = talkRow.querySelector('button'), talkNote = talkRow.querySelector('small');
  const playRow = el.querySelector('.pnf-play'), playB = playRow.querySelector('button'), playNote = playRow.querySelector('small');
  const crewRow = el.querySelector('.pnf-crew'), crewB = crewRow.querySelector('button');
  for (let i = 0; i < FRIENDS.pips; i++) meterEl.appendChild(Object.assign(document.createElement('i'), { className: 'pnf-pip' }));
  meterEl.appendChild(document.createElement('span'));
  const pips = [...meterEl.querySelectorAll('.pnf-pip')], countEl = meterEl.querySelector('span');

  const S = { Q: null, me: null, seq: null, shown: -1, wait: -1, playOk: null, refused: 0, opened: 0, talks: 0, counted: 0, games: 0, asks: 0, joined: 0, lastAsk: null, picks: 0, pickMs: 0, last: {} };
  let playerNow = null;
  const pp = () => people();
  const idOf = (Q) => (Q ? Q.id : null);

  // ── the meter: ten pips, halves shown ──
  function drawMeter(pop = false) {
    const p = friends.pips(idOf(S.Q));
    pips.forEach((pip, i) => {
      const f = Math.max(0, Math.min(1, p - i)), was = S.shown < 0 ? f : Math.max(0, Math.min(1, S.shown - i));
      pip.style.setProperty('--f', f * 100 + '%');
      if (pop && f > was) { pip.classList.remove('is-new'); void pip.offsetWidth; pip.classList.add('is-new'); }
    });
    countEl.textContent = (p % 1 ? p.toFixed(1) : String(p)) + ' / ' + FRIENDS.pips;
    meterEl.setAttribute('aria-label', 'Friendship ' + p + ' of ' + FRIENDS.pips);
    S.shown = p;
  }
  // ── what the card says about them, the Talk line, the Mathball line ──
  function drawRows() {
    const id = idOf(S.Q), wait = friends.talkWait(id);
    talkB.disabled = !!S.seq;
    talkNote.textContent = S.seq ? '' : wait > 0 ? 'More to say in ' + waitWords(wait) : '';
    S.wait = Math.ceil(wait / 60e3);
    // (Join my crew: once the crew member owns a ship, for anyone not on their crew yet)
    const c = crew();
    crewRow.hidden = !(c && shipsOf(c).length && id && (!onCrew(c, id) || S.saying === id));
    crewB.disabled = !!S.seq;
    const M = game.mathball;
    const can = !!(M && typeof M.challenge === 'function');
    playRow.hidden = !can;
    if (can) {
      let skill = null; try { skill = typeof M.skillOf === 'function' ? M.skillOf(id) : null; } catch (e) { skill = null; }
      playNote.textContent = S.refused && performance.now() - S.refused < 4000 ? 'Not right now.' : skill != null ? 'Mathball skill ' + skill : '';
    }
  }
  function draw(pop = false) {
    const Q = S.Q; if (!Q) return;
    const P = pp();
    nameEl.textContent = (P && P.nameOf ? P.nameOf(Q) : Q.name) || 'Someone';
    // (asked just now and said yes: their card says so as they say it, not before)
    const mate = onCrew(crew(), Q.id) && S.saying !== Q.id;
    whoEl.textContent = mate ? (Q.rescued ? 'Rescued, and on your crew' : 'On your crew') : Q.rescued ? (friends.staysForGood(Q.id) ? 'Rescued, staying on the station' : 'Rescued from a wreck') : '';
    el.classList.toggle('is-touch', !!(input && input.touch));
    drawMeter(pop); drawRows();
  }

  // ── open, close ──
  function open(Q) {
    if (!Q || !playerNow) return false;
    if (S.seq && S.Q !== Q) endSeq();
    S.Q = Q; S.shown = -1; S.refused = 0; S.opened++;
    friends.tap(Q.id);      // (a tap on them: when they were last tapped, src/friends.js: the rescued's 15 minutes from here)
    draw(); el.hidden = false;
    return true;
  }
  function close() { if (S.seq) endSeq(); S.Q = null; el.hidden = true; }
  function endSeq() { S.seq = null; if (S.saying) { S.saying = null; if (S.Q) draw(); } }

  // ── a talk: they stop and turn to the player; the lines in turn, the person's and the player's ──
  function talk() {
    const Q = S.Q, P = pp(); if (!Q || !P || S.seq || !playerNow) return false;
    const first = !friends.meter(Q.id).talk;
    const r = friends.talk(Q.id);
    friends.tap(Q.id);
    S.talks++; if (r.counted) S.counted++;
    const name = P.nameOf ? P.nameOf(Q) : Q.name, player = (crew() && crew().name) || '';
    const t = r.counted ? friendTalk({ rescued: !!Q.rescued, first, last: S.last[Q.id] || null, player, name }) : { id: 'soon', lines: [{ who: 'them', words: pick(FRIEND_TALK.soon).replace(/\{player\}/g, player || 'friend') }] };
    if (r.counted) S.last[Q.id] = t.id;
    const total = t.lines.reduce((s, l) => s + READ(l.words), 0) + 0.8;
    P.hold(Q, total);
    S.seq = { Q, lines: t.lines, i: 0, next: 0.25, t: 0, id: t.id, counted: r.counted };
    draw(r.counted);
    return true;
  }
  function meBubble(P) {
    // (the player as the bubbles take a speaker: their body, drawn, where they stand)
    if (!S.me || S.me.c !== playerNow.c) S.me = { c: playerNow.c, pos: playerNow.pos, inScene: true, shown: true, byCam: false, order: 0, bubbleUp: -0.28 };
    S.me.pos = playerNow.pos; S.me.drawnY = playerNow.pos.y; S.me.inScene = !!playerNow.c.root.visible; S.me.shown = !!playerNow.c.root.visible;
    return S.me;
  }
  function seqStep(dt) {
    const q = S.seq, P = pp(); if (!q || !P) return;
    q.t += dt;
    if (q.t < q.next) return;
    if (q.i >= q.lines.length) { endSeq(); drawRows(); return; }
    const L = q.lines[q.i++], secs = READ(L.words);
    if (L.who === 'you') P.bubbles.say(meBubble(P), L.words, { kind: 'you', secs });
    else { P.say(q.Q, L.words, { kind: 'talk', secs }); if (S.saying === q.Q.id) { S.saying = null; draw(true); } }
    q.next = q.t + secs;
  }

  // ── Mathball (src/mathball/: GAME.mathball, when it is there) ──
  function play() {
    const Q = S.Q, M = game.mathball; if (!Q || !M || typeof M.challenge !== 'function') return false;
    friends.tap(Q.id);
    let ok = false; try { ok = !!M.challenge(Q.id); } catch (e) { console.warn('friends: the challenge failed', e); ok = false; }
    if (ok) { S.games++; close(); } else { S.refused = performance.now(); drawRows(); }
    return ok;
  }
  // ── asked to join the crew (src/own.js askCrew): the player's question, then their answer, in bubbles ──
  function join() {
    const Q = S.Q, P = pp(), c = crew(); if (!Q || !P || !c || S.seq || !playerNow || !shipsOf(c).length) return false;
    friends.tap(Q.id);
    const name = P.nameOf ? P.nameOf(Q) : Q.name, player = c.name || '';
    // (who they are aboard: a station person by their own id, a rescued survivor by their own look)
    const r = askCrew(c, { id: Q.id, name: name || 'Someone', look: Q.rescued && Q.def ? Q.def.look : Q.id }, friends.pips(Q.id), { need: FRIENDS.crew, now: friends.now() });
    if (r.why === 'joined') { save(c); S.joined++; S.saying = Q.id; }
    S.asks++; S.lastAsk = r.why;
    const fill = (w) => String(w).replace(/\{player\}/g, player || 'friend').replace(/\{name\}/g, name || 'friend');
    const answer = r.why === 'joined' ? pick(CREW_ASK.yes) : r.why === 'already' ? pick(CREW_ASK.already) : pick(CREW_ASK.no);
    const lines = [{ who: 'you', words: fill(pick(CREW_ASK.ask)) }, { who: 'them', words: fill(answer) }];
    P.hold(Q, lines.reduce((a, l) => a + READ(l.words), 0) + 0.8);
    S.seq = { Q, lines, i: 0, next: 0.25, t: 0, id: 'crew:' + r.why, counted: false };
    draw();
    return r.why;
  }
  // (a finished game against someone: one and a half pips, won or lost)
  const onEnd = (r) => { if (!r || !r.opponent) return; friends.add(r.opponent, FRIENDS.game, r.won ? 'mathball, won' : 'mathball'); friends.tap(r.opponent); S.ended = (S.ended || 0) + 1; if (S.Q && S.Q.id === r.opponent) draw(true); };

  // ── who is under a point on the screen: the people near the player, drawn; worked out only as a tap lands ──
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  // (only: that person alone; S.atD: how far the camera is from the one found)
  function at(x, y, touch = false, only = null) {
    const P = pp(); if (!P || !playerNow) return null;
    const t0 = performance.now(); S.picks++;
    camera.updateMatrixWorld();
    const W = innerWidth, H = innerHeight, f = H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), pad = touch ? CARD.padTouch : CARD.padMouse;
    let best = null, bd = Infinity;
    for (const Q of P.list) {
      if (Q.hidden || Q.away || !Q.shown || !Q.inScene || Q.byCam || !Q.c || (only && Q !== only)) continue;
      const d = Math.hypot(Q.pos.x - playerNow.pos.x, Q.pos.z - playerNow.pos.z);
      if (d > CARD.reach || Math.abs(Q.pos.y - playerNow.pos.y) > 1.5) continue;
      const head = Q.c.bones && Q.c.bones.Head ? Q.c.bones.Head.getWorldPosition(_a) : _a.set(Q.pos.x, (Q.drawnY ?? Q.pos.y) + 1.6, Q.pos.z);
      head.y += 0.15;
      const foot = Q.pose ? _b.copy(Q.c.root.position) : _b.set(Q.pos.x, (Q.drawnY ?? Q.pos.y) + (Q.sitY || 0), Q.pos.z);
      const depth = camera.position.distanceTo(head); if (depth < 0.3) continue;
      const ha = head.project(camera), fa = foot.project(camera);
      if (ha.z > 1 || fa.z > 1) continue;
      const ax = (ha.x + 1) / 2 * W, ay = (1 - ha.y) / 2 * H, bx = (fa.x + 1) / 2 * W, by = (1 - fa.y) / 2 * H;
      // (the distance from the point to the line from the feet to the head, on the screen)
      const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1, k = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L2));
      const off = Math.hypot(x - (ax + vx * k), y - (ay + vy * k));
      if (off > CARD.half * f / depth + pad) continue;
      if (depth < bd) { bd = depth; best = Q; }
    }
    S.pickMs += performance.now() - t0; S.atD = bd;
    return best;
  }
  // (the nearest person in front of the player, within reach: the F key)
  function nearest() {
    const P = pp(); if (!P || !playerNow) return null;
    let best = null, bd = CARD.reach;
    for (const Q of P.list) {
      if (Q.hidden || Q.away || !Q.shown) continue;
      const dx = Q.pos.x - playerNow.pos.x, dz = Q.pos.z - playerNow.pos.z, d = Math.hypot(dx, dz);
      if (d > bd || Math.abs(Q.pos.y - playerNow.pos.y) > 1.5) continue;
      if ((dx * Math.sin(playerNow.heading) + dz * Math.cos(playerNow.heading)) / (d || 1) < 0.2) continue;
      best = Q; bd = d;
    }
    return best;
  }
  // (another question on the screen: the card waits; a captain's comes first)
  const busy = () => { const P = pp(); return !!(P && P.bubbles && P.bubbles.asking); };

  // A MOUSE (src/usable.js, the game's one helper): over a person near enough to talk to, the hand, and a click opens
  // their card (F's); over the captain asking a question, the hand, and a click is its yes (E's). A finger is the
  // tap below, as it was
  let under = null;
  const asker = () => { const P = pp(); const A = P && P.bubbles && P.bubbles.askShown ? P.bubbles.asking : null; return A ? P.list.find((Q) => Q.cap && Q.cap.ask === A) || null : null; };
  if (usable) {
    usable.add({ name: 'person', ready: () => !!playerNow && !busy(), use: () => { if (under) open(under); },
      shape: { at: (x, y) => { under = at(x, y, false); return under ? S.atD : null; } } });
    usable.add({ name: 'captain\'s question', ready: () => !!playerNow && !!asker(), use: () => { const P = pp(); if (P && P.bubbles.askShown) P.bubbles.answer(true); },
      shape: { at: (x, y) => { const C = asker(); return C && at(x, y, false, C) ? S.atD : null; } } });
  }
  if (input && input.onPick) input.onPick((pk) => {
    if (!playerNow || busy() || pk.used) return;
    const Q = at(pk.x, pk.y, pk.touch);
    // (something else that takes taps (a jobs board's screen) is under the point: theirs, unless the person stands in
    // front of it)
    if (pk.hit && (!Q || pk.hit.distance < camera.position.distanceTo(Q.pos) - 0.3)) return;
    if (Q) open(Q); else if (S.Q && !S.seq) close();
  });
  talkB.addEventListener('click', () => talk());
  playB.addEventListener('click', () => play());
  crewB.addEventListener('click', () => join());
  el.querySelector('.pnf-x').addEventListener('click', () => close());
  addEventListener('keydown', (e) => {
    if (!playerNow || e.repeat || e.ctrlKey || e.metaKey || e.altKey || (input && input.enabled === false)) return;
    const tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
    if (e.code === 'KeyF') { if (S.Q) close(); else if (!busy()) { const Q = nearest(); if (Q) open(Q); } return; }
    if (!S.Q) return;
    if (e.code === 'Digit1' || e.code === 'Numpad1') { e.preventDefault(); talk(); }
    else if (e.code === 'Digit2' || e.code === 'Numpad2') { if (!playRow.hidden) { e.preventDefault(); play(); } }
    else if (e.code === 'Digit3' || e.code === 'Numpad3') { if (!crewRow.hidden) { e.preventDefault(); join(); } }
  });

  let clock = 0;
  function update(dt, P) {
    clock += dt;
    playerNow = P || null;
    // (a finished game's pips, from src/mathball/ as it ends: set once it is there)
    const M = game.mathball; if (M && typeof M === 'object' && M.onEnd !== onEnd) M.onEnd = onEnd;
    if (!S.Q) return;
    const Q = S.Q, far = playerNow ? Math.hypot(Q.pos.x - playerNow.pos.x, Q.pos.z - playerNow.pos.z) : Infinity;
    const gone = !pp() || !pp().list.includes(Q) || Q.hidden || Q.away;
    if (!playerNow || gone || far > CARD.leave || busy()) { close(); return; }
    seqStep(dt);
    // (the wait for more to say, counted down on the card; the Mathball line as it comes and goes)
    if ((clock * 2 | 0) !== ((clock - dt) * 2 | 0)) { drawRows(); if (friends.pips(Q.id) !== S.shown) drawMeter(true); }
  }
  const api = { update, open: (id) => { const P = pp(); const Q = P && P.list.find((q) => q.id === id); return open(Q); }, close, talk, play, join, at, nearest, el,
    get open_() { return !!S.Q; },
    state: () => ({ free: !!playerNow, input: input ? input.enabled : null, open: !!S.Q, id: idOf(S.Q), name: nameEl.textContent, who: whoEl.textContent, pips: S.Q ? friends.pips(S.Q.id) : null, count: countEl.textContent, talkNote: talkNote.textContent, talkOff: talkB.disabled,
      play: !playRow.hidden, playNote: playNote.textContent, join: !crewRow.hidden, lastAsk: S.lastAsk, talking: S.seq ? { id: S.seq.id, i: S.seq.i, of: S.seq.lines.length, counted: S.seq.counted } : null,
      counts: { opened: S.opened, talks: S.talks, counted: S.counted, games: S.games, asks: S.asks, joined: S.joined, ended: S.ended || 0, picks: S.picks, pickMs: +S.pickMs.toFixed(2) } }) };
  return api;
}
