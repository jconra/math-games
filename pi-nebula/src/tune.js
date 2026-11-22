// THE CORE'S TUNING: the engineer's step of a captain's run (src/missions.js: a mission's 'tune' step), done on foot in
// the ship, out at the place the run goes to. Loaded only for a run that has one (src/trip.js runs it as one of the
// trip's own steps: getting up out of the seat and sitting down again are the trip's; the rest is here).
//
// THE GAME'S MAKER, of a mining run (2026-11-16): "The process repeats until your canisters are full. Then you are
// released back into the ship and if you signed up for engineering then the captain tells you the core needs to be
// adjusted. So you go back to mechanical and answer so questions there. Then you make your way back up to the pilot
// seat to jump the ship back home." (2026-11-18): "a "Reactor imbalance" voice for when you need to do the engineering
// questions." Asked where the engineer's display should be (2026-11-19) he chose "on the card, in the mining run too",
// and: "I don't really care how it is displayed that much, but I want the player to have to run back to mechanical and
// click on something (press E)." Asked when (2026-11-19, evening): "I was thinking it would be when you are at the
// foreign destination. So either right after you arrive at the asteroids, or sometime before you jump back home", and
// "Tune at the remote location (so its a more desperate situation)".
//
// SO, when the trip comes to its 'tune' step:
//   - THE SHIP SAYS "Reactor imbalance." in its own voice (src/voices.js SHIP_CLIPS: its `reactor` clip, heard all
//     through the ship; a ship with no such clip says nothing), and then THE CAPTAIN TELLS THEM the core needs
//     adjusting (src/lines.js RUN_TALK: `tune`, in the bubble his words on a run come up in). A few words stay along
//     the top until the core is tuned (the trip's own strip);
//   - on their feet (the trip's: Get up, E), AT THE SHIP'S OWN CORE (src/boarding.js core: the reactor in its
//     engineering room, by name in its blueprint) the game's prompt comes up, Start (E), a tap on a phone. Pressed, they
//     stand at the core, seen through their own eyes, and the "Reactor core" card opens: the engineer's questions
//     (src/jobs/engineer.js) with the core display on it (src/jobs/engview.js), as many cards as the mission's step
//     asks. A wrong answer shows its why, as on every job; a right one brings the next card. Done (Esc) puts the card
//     away with the cards so far kept, and the prompt is there again;
//   - after the last card the card goes by itself and the captain says the core is steady (`tuned`); the trip then
//     asks them back to their seat.
// NOTHING ELSE: no timer, no score, nothing lost by a wrong answer, no pay of its own (the share of the haul is the pay
// for all the work of a run: pay: false). The level and the kinds of math hear every card, as on every job.
//
// THE SENSOR OPERATOR'S SCAN on Captain Vega's exploring run (src/missions.js 'explore': its 'scan' step) is the same
// walk to another part of the ship: THE SURVEY TABLE in the Explorer's science lab (src/boarding.js core(ship, 'survey'):
// the holo table, found by name in its blueprint, as the reactor is), its own prompt and the surveyor's cards
// (src/jobs/survey.js, its card's top saying what the scan follows), no voice of the ship's, and the captain's own words
// for it (`scan`, `scanned`). WORK: what is the core's and what is the table's; the rest of this file is both's.
//
//   readyTune(mission)     its ship's clip fetched ahead (as the crew member sits down in the hangar)
//   const T = startTune({ boarding, crew, save }, { mission, step, say(key), strip(words), onPanel(up), onDone() })
//     mission: its data (MISSIONS[..]: its ship); step: its 'tune' step; say: the captain's bubble, by the line's name;
//     strip: the few words along the top. The ship says it as this is called.
//   T.update(dt, P, afoot) -> true while the card is up (the crew member stands at the core; T.aim has the camera)
//     P: the crew member's body; afoot: on their feet (in the seat there is no prompt at the core)
//   T.aim(camera, dt); T.close(); T.done; T.busy (the card is up); T.state() (the rigs)
import * as THREE from 'three';
import { openPanel, ensureCss } from './jobs/panel.js';
import { JOB as ENGINEER } from './jobs/engineer.js';
import { engineerLink } from './jobs/engview.js';
import { JOB as SURVEY } from './jobs/survey.js';
import { surveyLink } from './jobs/surveyview.js';
import { SHIP_CLIPS, clipUrl } from './voices.js';
import { sound } from './sound.js';

// near: metres from the place before the core that bring up its prompt; captain: his words come this long after the
// ship's (s: its clip is 1.3 s); close: the card goes this long after the last right answer (s: the jump's own pause);
// eye: a person's eyes above their feet, and how far back from where they stand (m)
export const TUNE = { near: 1.3, captain: 1.5, close: 0.95, eye: 1.5, back: 0.2 };
// THE TWO KINDS OF WORK ON FOOT ABOARD, by the step's kind: where (boarding.core's `which`), its prompt, its cards and
// their top, the words along the top, whether the ship says it first, the captain's two lines; tall: on a phone the
// eye looks down at it (a machine taller than the eyes: the core) or across it (a table)
const WORK = {
  tune: { which: 'core', title: 'Reactor core', small: 'Adjust the core', job: ENGINEER, link: (small) => engineerLink({ small }), each: 'Adjustment', away: 'Adjust the core in Engineering', voice: true, sayKey: 'tune', doneKey: 'tuned', drop: 1.1 },
  scan: { which: 'survey', title: 'Survey table', small: 'Scan the land below', job: SURVEY, link: (small) => surveyLink({ small }), each: 'Scan', away: 'Scan the land below at the survey table', voice: false, sayKey: 'scan', doneKey: 'scanned', drop: 0.55 },
};

const clipOf = (M) => (SHIP_CLIPS[M.ship] || {}).reactor || null;
export function readyTune(M) { const clip = clipOf(M); if (clip) sound.load(clip.id, clipUrl(clip.id)); }

export function startTune(ctx, { mission: M, step, say = () => {}, strip = () => {}, onPanel = () => {}, onDone = () => {}, about = null }) {
  const { boarding, crew, save = () => {} } = ctx;
  ensureCss();
  const K = WORK[step.kind] || WORK.tune;
  const clip = K.voice ? clipOf(M) : null, cards = Math.max(1, step.cards || 1);
  if (K.voice) readyTune(M);
  // (the core's own prompt, as a job's; the survey table's)
  const prompt = document.createElement('div'); prompt.className = 'pnj-prompt pmt-wide'; prompt.hidden = true;      // (pmt-wide: src/trip.js, whose step this is)
  prompt.innerHTML = `<div class="pnj-pw"><b>${K.title}</b><small>${about ? about.small || K.small : K.small}</small></div><button type="button" class="pnj-go">Start<kbd>E</kbd></button>`;
  document.body.appendChild(prompt);
  prompt.querySelector('.pnj-go').addEventListener('click', () => open());

  // THE SHIP SAYS IT NOW, then the captain (a clip asked for before the page may make a sound is tried again for a moment)
  const T = { clock: 0, lit: 0, done: false, said: 1, heard: 0, told: false, log: ['the ship: ' + (clip ? clip.words : '(no voice)')] };
  let panel = null, at = null, closeIn = -1, sayIn = clip ? TUNE.captain : 0.01, voicing = clip ? { t: 1.5 } : null, closed = false, coreKey = null, coreAt = null, shown = '';
  const words = () => { const w = panel ? `${K.each} ${Math.min(T.lit + 1, cards)} of ${cards}` : (about && about.away) || K.away; if (w !== shown) { shown = w; strip(w); } };
  // where the core is, worked out again only when the ship's cabin comes in or the ship stands somewhere else
  function coreNow() {
    const s = boarding.ships.find((q) => q.id === M.ship), key = s && s.state === 'in' ? 'in:' + (boarding.stands ?? 0) : null;
    if (key !== coreKey) { coreKey = key; coreAt = key ? boarding.core(M.ship, K.which) : null; }
    return coreAt;
  }

  // ── the card: the engineer's questions, the core display on each ──
  const link = K.link(() => `${about && about.head ? about.head + ' · ' : ''}${K.each} ${Math.min(T.lit + 1, cards)} of ${cards}`);
  link.right = () => { T.lit++; T.log.push('card ' + T.lit + ' of ' + cards); if (T.lit >= cards) closeIn = TUNE.close; };
  function open() {
    if (panel || T.done || closed || T.lit >= cards || prompt.hidden) return false;
    const C = coreNow(); if (!C) return false;
    at = C; camFresh = true; prompt.hidden = true; onPanel(true);
    panel = openPanel(document.body, { job: K.job, crew, live: link, pay: false, onSave: () => save(crew), onCredits: () => {}, onClose: () => shut() });
    words();
    return true;
  }
  function shut() { const v = link.view ? link.view() : null; if (v) v.stop(); panel = null; onPanel(false); if (!T.done) words(); }
  function onKey(e) { if (!prompt.hidden && !panel && !closed && (e.key === 'e' || e.key === 'E' || e.key === 'Enter')) { e.preventDefault(); open(); } }
  addEventListener('keydown', onKey);
  words();

  const want = new THREE.Vector3(), wantLook = new THREE.Vector3(), camAt = new THREE.Vector3(), camLook = new THREE.Vector3(), _d = new THREE.Vector3(); let camFresh = true;
  const api = {
    get done() { return T.done; }, get busy() { return !!panel; }, get told() { return T.told; },
    update(dt, P, afoot = true) {
      if (closed) return false;
      T.clock += dt;
      if (voicing) { const h = sound.play(clip.id, { volume: 0.95 }); if (h) { T.heard++; voicing = null; } else if ((voicing.t -= dt) <= 0) voicing = null; }
      if (sayIn > 0) { sayIn -= dt; if (sayIn <= 0) { say(K.sayKey); T.told = true; T.log.push('the captain: ' + K.sayKey); } }
      if (T.done) return false;
      if (!P || !afoot) { prompt.hidden = true; return false; }
      // (the last card answered: the card goes by itself, and the captain says so; the same if Done was pressed in that
      // moment: the core is tuned all the same)
      if (closeIn >= 0 && (closeIn -= dt) <= 0) { closeIn = -1; T.done = true; if (panel) { const was = panel; shut(); was.close(true); } prompt.hidden = true; say(K.doneKey); T.log.push('the captain: ' + K.doneKey); onDone(); return false; }
      words();
      if (panel) {
        // standing at the core, facing it
        const k = 1 - Math.exp(-8 * dt), h = Math.atan2(at.look.x - at.pos.x, at.look.z - at.pos.z), dh = Math.atan2(Math.sin(h - P.heading), Math.cos(h - P.heading));
        P.pos.lerp(at.pos, k); P.heading += dh * k;
        return true;
      }
      const C = coreNow();
      prompt.hidden = !(C && T.lit < cards && boarding.where(P.pos) === C.room && Math.abs(P.pos.y - C.pos.y) < 1 && Math.hypot(P.pos.x - C.pos.x, P.pos.z - C.pos.z) < TUNE.near);
      return false;
    },
    // the camera while the card is up: the crew member's own eyes at the core, the core clear of the card (left of it
    // on a wide screen, above it on a phone)
    aim(camera, dt = 1 / 60) {
      if (!panel || !at) return;
      const dx = at.look.x - at.pos.x, dz = at.look.z - at.pos.z, L = Math.hypot(dx, dz) || 1, fx = dx / L, fz = dz / L, rx = -fz, rz = fx;
      const tall = innerHeight > innerWidth * 1.05 || innerWidth <= 640;
      want.set(at.pos.x - fx * TUNE.back, at.pos.y + TUNE.eye, at.pos.z - fz * TUNE.back);
      if (tall) wantLook.set(at.look.x, at.look.y - K.drop, at.look.z); else wantLook.set(at.look.x + rx * 0.55, at.look.y + 0.12, at.look.z + rz * 0.55);
      if (camFresh) { camAt.copy(camera.position); camLook.copy(camera.position).add(camera.getWorldDirection(_d)); camFresh = false; }
      const k = 1 - Math.exp(-5 * dt);
      camAt.lerp(want, k); camLook.lerp(wantLook, k);
      camera.position.copy(camAt); camera.lookAt(camLook);
    },
    open,
    // (its prompt is up: the core is within reach; nothing else aboard is offered meanwhile, src/trip.js)
    get prompting() { return !closed && !prompt.hidden; },
    close() { if (closed) return; closed = true; if (panel) { const was = panel; shut(); was.close(true); } removeEventListener('keydown', onKey); prompt.remove(); },
    state: () => ({ work: step.kind, done: T.done, lit: T.lit, cards, prompt: !prompt.hidden, strip: shown, said: T.said, heard: T.heard, told: T.told,
      core: coreAt ? { room: coreAt.room, pos: coreAt.pos.toArray().map((v) => +v.toFixed(2)), look: coreAt.look.toArray().map((v) => +v.toFixed(2)) } : null, panel: panel ? panel.state() : null, view: link.view && link.view() ? link.view().state() : null, log: T.log.slice(-10) }),
  };
  return api;
}
