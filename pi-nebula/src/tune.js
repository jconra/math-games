// THE CORE'S TUNING: the engineer's step of a captain's run (src/missions.js: a mission's 'tune' step), done on foot in
// the ship where it is parked. Loaded only when a tuning is due (src/mission.js starts it and ends it).
//
// THE GAME'S MAKER (2026-11-18): "a "Reactor imbalance" voice for when you need to do the engineering questions." And:
// "if you signed up for engineering then the captain tells you the core needs to be adjusted. So you go back to
// mechanical and answer so questions there. Then you make your way back up to the pilot seat". Asked where the
// engineer's display should be (2026-11-19) he chose "on the card, in the mining run too", and: "I don't really care
// how it is displayed that much, but I want the player to have to run back to mechanical and click on something (press
// E)." And (2026-11-19): "We can make the reactor need tuning before or after missions (so it isn't always the same
// exact sequence). This should be used for the explore, medical, and cargo missions too."
//
// SO, while a tuning is due (missions.js tuneDue: before the run with the contract signed, or after it with the ship
// home and down):
//   - as the crew member comes aboard the ship (or gets up out of its seat, home), THE SHIP SAYS "Reactor imbalance."
//     in its own voice (src/voices.js SHIP_CLIPS: its `reactor` clip, heard all through the ship; a ship with no such
//     clip says nothing), and then THE CAPTAIN TELLS THEM the core needs adjusting (src/lines.js RUN_TALK: `tune`, in
//     the bubble his words on a run come up in). A few words stay along the top while they are aboard;
//   - AT THE SHIP'S OWN CORE (src/boarding.js core: the reactor in its engineering room, by name in its blueprint) the
//     game's prompt comes up, Start (E), a tap on a phone. Pressed, they stand at the core, seen through their own eyes,
//     and the "Reactor core" card opens: the engineer's questions (src/jobs/engineer.js) with the core display on it
//     (src/jobs/engview.js), as many cards as the mission's step asks. A wrong answer shows its why, as on every job;
//     a right one brings the next card. Done (Esc) puts the card away with the cards so far kept, and the prompt is
//     there again;
//   - after the last card the card goes by itself and the captain says the core is steady.
// NOTHING ELSE: no timer, no score, nothing lost by a wrong answer, no pay of its own (the share of the haul is the pay
// for all the work of a run: pay: false). The level and the kinds of math hear every card, as on every job.
//
//   const T = startTune({ W, boarding, crew, save, captainName }, { mission, step, when, onPanel(up), onDone() })
//     mission: its data (MISSIONS[..]: its ship, its captain's lines); step: its 'tune' step; when: 'before' | 'after'
//   T.update(dt, P, playing) -> true while the card is up (the crew member stands at the core; T.aim has the camera)
//   T.aim(camera, dt); T.stop() (the crew screen: the card put away); T.close(); T.done; T.state() (the rigs)
import * as THREE from 'three';
import { openPanel, ensureCss } from './jobs/panel.js';
import { JOB as ENGINEER } from './jobs/engineer.js';
import { engineerLink } from './jobs/engview.js';
import { RUN_TALK } from './lines.js';
import { SHIP_CLIPS, clipUrl } from './voices.js';
import { sound } from './sound.js';

// near: metres from the place before the core that bring up its prompt; again: the ship does not say it again sooner
// than this after it last did (s: stepping off the ship and on again); captain: his words come this long after the
// ship's (s: its clip is 1.3 s); close: the card goes this long after the last right answer (s: the jump's own pause);
// eye: a person's eyes above their feet, and how far back from where they stand (m)
export const TUNE = { near: 1.3, again: 20, captain: 1.5, close: 0.95, eye: 1.5, back: 0.2 };

// (the look of the trip's own strip and of the captain's bubble on a run: src/trip.js .pmt-chip, .pmt-say)
const CSS = `
.ptn { position: fixed; inset: 0; z-index: 22; pointer-events: none; font: 400 16px/1.35 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; color: #eef1f4; user-select: none; -webkit-user-select: none; }
.ptn-chip { position: absolute; left: 50%; top: max(12px, env(safe-area-inset-top)); transform: translateX(-50%); height: 40px; padding: 0 16px; display: flex; align-items: center; gap: 8px; white-space: nowrap;
  font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; background: rgba(15, 19, 25, 0.86); box-shadow: inset 0 0 0 1.5px rgba(255, 205, 60, 0.7);
  clip-path: polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px); }
.ptn-chip[hidden] { display: none; }
.ptn-chip b { color: #ffd560; } .ptn-chip span { color: #cfd8e2; }
.ptn-say { position: absolute; right: max(18px, 4vw); top: 86px; max-width: min(300px, 44vw); opacity: 0; transition: opacity 0.25s ease; }
.ptn.has-panel .ptn-say { right: auto; left: max(18px, 4vw); }
.ptn-say.is-on { opacity: 1; }
.ptn-say small { display: block; margin-bottom: 3px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #ffd560; }
.ptn-say p { margin: 0; padding: 8px 12px 9px; font-size: 15px; font-weight: 600; background: rgba(13, 17, 23, 0.9); box-shadow: inset 0 0 0 2px rgba(255, 205, 60, 0.85);
  clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px); }
@media (max-width: 640px) {
  .ptn-chip { top: max(60px, calc(env(safe-area-inset-top) + 56px)); font-size: 12px; left: 3vw; right: 3vw; transform: none; margin: 0 auto; width: fit-content; white-space: normal; height: auto; min-height: 40px; padding: 6px 12px; column-gap: 8px; row-gap: 0; flex-wrap: wrap; justify-content: center; text-align: center; line-height: 1.25; }
  .ptn-say { top: 108px; left: 10px !important; right: auto; max-width: 78vw; } .ptn-say p { font-size: 14px; }
  /* (the card lies along the bottom of a phone and may reach nearly to its top: the strip is put away under it) */
  .ptn.has-panel .ptn-chip, .ptn.has-panel .ptn-say { display: none; }
}
`;

export function startTune(ctx, { mission: M, step, when = 'before', onPanel = () => {}, onDone = () => {} }) {
  const { boarding, crew, save = () => {}, captainName = 'The captain' } = ctx;
  ensureCss();
  if (!document.getElementById('ptn-css')) { const st = document.createElement('style'); st.id = 'ptn-css'; st.textContent = CSS; document.head.appendChild(st); }
  const TALK = RUN_TALK[M.id] || {}, clip = (SHIP_CLIPS[M.ship] || {}).reactor || null, cards = Math.max(1, step.cards || 1);
  if (clip) sound.load(clip.id, clipUrl(clip.id));
  const el = document.createElement('div'); el.className = 'ptn';
  el.innerHTML = '<div class="ptn-chip" hidden><b>Reactor imbalance</b><span></span></div><div class="ptn-say"><small></small><p></p></div>';
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s), chip = $('.ptn-chip'), sayEl = $('.ptn-say');
  // (the core's own prompt, as a job's)
  const prompt = document.createElement('div'); prompt.className = 'pnj-prompt'; prompt.hidden = true;
  prompt.innerHTML = '<div class="pnj-pw"><b>Reactor core</b><small>Adjust the core</small></div><button type="button" class="pnj-go">Start<kbd>E</kbd></button>';
  document.body.appendChild(prompt);
  prompt.querySelector('.pnj-go').addEventListener('click', () => open());

  const T = { clock: 0, lit: 0, done: false, aboard: false, saidAt: -1e9, said: 0, heard: 0, says: '', log: [] };
  let panel = null, at = null, closeIn = -1, sayT = 0, sayIn = -1, voicing = null, closed = false, coreKey = null, coreAt = null;
  const fill = (s) => String(s).replace(/\{(\w+)\}/g, (_, k) => ({ player: crew.name || 'engineer' }[k] ?? ''));
  const pick = (L) => (L && L.length ? L[Math.floor(Math.random() * L.length)] : '');
  function say(key) {
    const w = fill(pick(TALK[key])); if (!w) return;
    $('.ptn-say small').textContent = captainName; $('.ptn-say p').textContent = w; sayEl.classList.add('is-on');
    sayT = Math.min(8, 2.4 + w.length * 0.06); T.says = w; T.log.push('says: ' + w);
  }
  const words = () => { const w = panel ? `Adjustment ${Math.min(T.lit + 1, cards)} of ${cards}` : 'Adjust the core in Engineering', s = $('.ptn-chip span'); if (s.textContent !== w) s.textContent = w; };
  // the ship says it, then the captain (a clip asked for before the page may make a sound is tried again for a moment)
  function announce() { T.saidAt = T.clock; T.said++; voicing = clip ? { t: 1.5 } : null; sayIn = clip ? TUNE.captain : 0.01; T.log.push('the ship: ' + (clip ? clip.words : '(no voice)')); }
  // where the core is, worked out again only when the ship's cabin comes in or the ship stands somewhere else
  function coreNow() {
    const s = boarding.ships.find((q) => q.id === M.ship), key = s && s.state === 'in' ? 'in:' + (boarding.stands ?? 0) : null;
    if (key !== coreKey) { coreKey = key; coreAt = key ? boarding.core(M.ship) : null; }
    return coreAt;
  }

  // ── the card: the engineer's questions, the core display on each ──
  const link = engineerLink({ small: () => `Adjustment ${Math.min(T.lit + 1, cards)} of ${cards}` });
  link.right = () => { T.lit++; T.log.push('card ' + T.lit + ' of ' + cards); if (T.lit >= cards) closeIn = TUNE.close; };
  function open() {
    if (panel || T.done || closed || T.lit >= cards) return false;
    const C = coreNow(); if (!C) return false;
    at = C; camFresh = true; prompt.hidden = true; el.classList.add('has-panel'); onPanel(true);
    panel = openPanel(document.body, { job: ENGINEER, crew, live: link, pay: false, onSave: () => save(crew), onCredits: () => {}, onClose: () => shut() });
    words();
    return true;
  }
  function shut() { const v = link.view(); if (v) v.stop(); panel = null; el.classList.remove('has-panel'); onPanel(false); words(); }
  function onKey(e) { if (!prompt.hidden && !panel && !closed && (e.key === 'e' || e.key === 'E' || e.key === 'Enter')) { e.preventDefault(); open(); } }
  addEventListener('keydown', onKey);

  const want = new THREE.Vector3(), wantLook = new THREE.Vector3(), camAt = new THREE.Vector3(), camLook = new THREE.Vector3(), _d = new THREE.Vector3(); let camFresh = true;
  const api = {
    get done() { return T.done; }, get busy() { return !!panel; },
    update(dt, P, playing = true) {
      if (closed) return false;
      T.clock += dt;
      if (sayT > 0) { sayT -= dt; if (sayT <= 0) sayEl.classList.remove('is-on'); }
      if (voicing) { const h = sound.play(clip.id, { volume: 0.95 }); if (h) { T.heard++; voicing = null; } else if ((voicing.t -= dt) <= 0) voicing = null; }
      if (sayIn > 0) { sayIn -= dt; if (sayIn <= 0) say('tune'); }
      if (T.done) return false;
      if (!playing || !P) { prompt.hidden = true; chip.hidden = true; T.aboard = false; return false; }
      const where = boarding.where(P.pos), aboard = !!where && where.startsWith(M.ship + '/');
      if (aboard && !T.aboard && T.clock - T.saidAt > TUNE.again) announce();
      T.aboard = aboard; chip.hidden = !aboard; words();
      // (the last card answered: the card goes by itself, and the captain says so; the same if Done was pressed in that
      // moment: the core is tuned all the same)
      if (closeIn >= 0 && (closeIn -= dt) <= 0) { closeIn = -1; if (panel) { const was = panel; shut(); was.close(true); } T.done = true; chip.hidden = true; prompt.hidden = true; say(when === 'after' ? 'tunedAfter' : 'tunedBefore'); onDone(); return false; }
      if (panel) {
        // standing at the core, facing it
        const k = 1 - Math.exp(-8 * dt), h = Math.atan2(at.look.x - at.pos.x, at.look.z - at.pos.z), dh = Math.atan2(Math.sin(h - P.heading), Math.cos(h - P.heading));
        P.pos.lerp(at.pos, k); P.heading += dh * k;
        return true;
      }
      const C = coreNow();
      prompt.hidden = !(C && T.lit < cards && where === C.room && Math.abs(P.pos.y - C.pos.y) < 1 && Math.hypot(P.pos.x - C.pos.x, P.pos.z - C.pos.z) < TUNE.near);
      return false;
    },
    // the camera while the card is up: the crew member's own eyes at the core, the core clear of the card (left of it
    // on a wide screen, above it on a phone)
    aim(camera, dt = 1 / 60) {
      if (!panel || !at) return;
      const dx = at.look.x - at.pos.x, dz = at.look.z - at.pos.z, L = Math.hypot(dx, dz) || 1, fx = dx / L, fz = dz / L, rx = -fz, rz = fx;
      const tall = innerHeight > innerWidth * 1.05 || innerWidth <= 640;
      want.set(at.pos.x - fx * TUNE.back, at.pos.y + TUNE.eye, at.pos.z - fz * TUNE.back);
      if (tall) wantLook.set(at.look.x, at.look.y - 1.1, at.look.z); else wantLook.set(at.look.x + rx * 0.55, at.look.y + 0.12, at.look.z + rz * 0.55);
      if (camFresh) { camAt.copy(camera.position); camLook.copy(camera.position).add(camera.getWorldDirection(_d)); camFresh = false; }
      const k = 1 - Math.exp(-5 * dt);
      camAt.lerp(want, k); camLook.lerp(wantLook, k);
      camera.position.copy(camAt); camera.lookAt(camLook);
    },
    open,
    // (the crew screen: the card put away, the cards so far kept; nothing of it on the screen)
    stop() { if (panel) panel.close(); prompt.hidden = true; chip.hidden = true; T.aboard = false; },
    close() { if (closed) return; closed = true; if (panel) { const was = panel; shut(); was.close(true); } removeEventListener('keydown', onKey); prompt.remove(); el.remove(); },
    // (its last words stay up a few seconds after it is done: true once they have gone)
    get quiet() { return sayT <= 0 && sayIn <= 0; },
    state: () => ({ when, done: T.done, lit: T.lit, cards, aboard: T.aboard, prompt: !prompt.hidden, chip: chip.hidden ? null : chip.textContent, said: T.said, heard: T.heard, says: sayEl.classList.contains('is-on') ? T.says : null,
      core: coreAt ? { room: coreAt.room, pos: coreAt.pos.toArray().map((v) => +v.toFixed(2)), look: coreAt.look.toArray().map((v) => +v.toFixed(2)) } : null, panel: panel ? panel.state() : null, view: link.view() ? link.view().state() : null, log: T.log.slice(-10) }),
  };
  return api;
}
