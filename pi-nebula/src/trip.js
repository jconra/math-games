// A CAPTAIN'S RUN, flown: the trip itself, from the pilot's seat (src/missions.js is the plain part: the contract, the
// steps, the money; src/mission.js starts this). Nothing here is built or loaded until a trip starts.
//
// THE GAME'S MAKER (2026-11-17): "you go on the contract and you get in the ship and you start the mission by talking
// to the captain or clicking on the pilot seat ... if you are the pilot then you take the ship out of the hanger, then
// calculate a jump (with maybe 3 questions). Then you arrive at an asteroid field." And for a pilot only: "Maybe there
// can just be a short cut-scene of the ship doing the work and then it will be giving you a problem to calculate the
// jump to get back to the station."
//
// HOW IT IS DONE, plainly (what a fuller version would take is in ~/pw/space-math/MINING_1.md):
//   - LEAVING AND LANDING ARE FLOWN (src/flying.js; the game's maker, 2026-11-18: "I want to see everything. If flying
//     by hand isn't made, then lets make it. If they want auto-pilot, then let it take off and leave automatically. I
//     defiantly don't want a dark screen with words"). The crew member sits in the Miner's own cockpit (its real cabin,
//     src/boarding.js) and the ship really lifts off its pad, goes out through the bay door and flies clear of the
//     station, by hand or on autopilot; with the pilot's seat left to the crew, the captain's own pilot flies and the
//     crew member rides and watches. Clear of the station the jump is offered (a button, and J). Home, the ship comes
//     out of its jump outside the station, in sight of it, and is flown in through the door and set down in its hangar.
//   - LANDING IS THE PILOT'S (2026-11-18, later: "I don't wan the ship taking over. That will annoy me. ... if the pilot
//     sets down and is still crooked then I would hope the crane can just compensate for it ... Even if they just come
//     straight in and land it nose-in, that should be okay (as long as the ship is not upside down). ... If they do have
//     the ship rolled over to much for a landing (like upside down) then it shouldn't allow them out of the seat until
//     they have corrected it"). Set down by hand the ship stands where and whichever way round the pilot put it, with a
//     guide that only asks (src/flying.js, src/flymodel.js); the autopilot, and the crew's own pilot, still park it in
//     its proper place. Down on the hangar's floor the seat's prompt comes up (Get up, E), not by itself, so the pilot
//     can lift off again and shuffle it. GETTING UP IS WHAT ENDS THE FLIGHT: the haul is aboard the ship where it
//     stands (crane.arrive: the crane takes the canisters off it there), the share is worked out, and the crew member
//     is on their feet in the cockpit of the ship as it landed.
//   - NO DARK SCREEN ANYWHERE BUT THE JUMP'S OWN FLASH (2026-11-18: "I defiantly don't want a dark screen with words",
//     and "I want as little of black screen, magically appear in the game as possible. In fact please let me know if
//     there is anything like that other than the jump"). The run starts only from the seat, by the crew member's own
//     sitting down (there was a dark moment that put them there from the captain's "Let's go": gone, with the
//     question). At the rocks the drill operator's view outside the ship is reached by moving the eye: as the jump's
//     flash clears it is already rising out of the seat and gliding back to the drill's view behind the ship; when the
//     drilling is done it goes round the ship to behind it and forward down into the seat, and there, the eye where
//     the crew member's eyes are, the view is their own cockpit again (that last moment is a plain cut: the drill's
//     ship is a second one, built for outside, in a scene of its own with its own sky and rocks; it has a cockpit of
//     its own, so the cut changes the sky outside and the screens' small print, not the whole picture).
//   - THE JUMP IS A WORMHOLE (src/wormhole.js, src/wormplan.js; the game's maker, 2026-11-18: "Hopefully we can have
//     some cool colorful plasma effect that looks like it rips open a wormhole in front of you and you see pretty
//     colors until the destination scene is loaded and then appears in front of you"). After the jump's cards a tear
//     opens in front of the ship, widens to a round mouth and comes over it; the colours stream by all round; the far
//     end opens ahead and the place there is seen through it. It is a thing in the scene, so it is the same from the
//     cockpit and from behind. THE PLACE IS CHANGED WHILE THE COLOURS ARE ALL ROUND (arriveField, arriveHome), and
//     they go on until the place ahead is made. Nothing is dark and nothing is said in words.
//   - AT THE ROCKS, SIGNED FOR THE DRILL (with or without the pilot's seat): the ship out there is the drill's own
//     Miner, in the field (src/drillview.js), and THE FLYING IS KEPT, flying that ship (src/fieldfly.js; 2026-11-18:
//     "the pilot flies if you are operating the drill. If you signed up for both there can be a button that lets you
//     switch tasks. Either way, you should be able to click on an asteroid to travel over to it (If you want to fly and
//     you signed up to be a pilot, you can click a button to fly manually if you want)"). The far end of the wormhole
//     opens on the field from the seat (or from behind, whichever view was on); then the eye glides out to the drill's
//     view. A tapped rock is where the ship flies; a crew member with both jobs has the button that hands them the
//     ship. When the drilling is done the eye glides back into the seat, of that same ship, and the jump home is
//     worked out and made from there: the parked ship is not seen again until the colours are all round.
//   - ONE FIELD FOR EVERYONE (2026-11-19: "I expected it to be the same asteroid field for everyone. If you are the
//     pilot then the drill guy will mark one for you to fly to. But I dont know why we would have two different sets of
//     rocks. It should all be the ones we just worked on. Natural looking with glowing dots"). Whatever the jobs, the
//     ship at the rocks is the drill's own Miner in its field (above), with the flying kept. Not signed for the drill,
//     the crew's driller works it (runCrew; src/drillview.js byCrew): they mark a rock, and with the pilot's seat the
//     crew member flies there by hand (2026-11-18: "I want the pilot to fly to the rocks that the driller requests, but
//     there should be a button that also lets the pilot skip this portion (like "Return Home") in that case it would
//     be cool to see a very short cut scene of a rock getting drilled ... Flying to the various asteroids might be fun,
//     but it's not math so you don't get money"); riding, the crew's pilot flies there. Two or three rocks fill the
//     canisters. The skip button plays that very short scene from outside the ship.
//   - HOOKS FOR THE NEXT PIECES: the flight itself knows nothing of a mission (src/flying.js: goal, onClear, onJump,
//     onLanded).
//   - THE STEPS are the mission's own data (MISSIONS[..].steps), one runner here for each kind: 'leave', 'jump' (the
//     job panel with the pilot's cards, src/jobs/pilot.js: three lamps, one lit by each right answer, and the jump
//     fires by itself after the third), 'work' (the drill operator's game, or the crew's driller at work in the same
//     field: a count of the canisters filling), 'land'.
//   - THE CARDS PAY NOTHING BY THEMSELVES (the panel's pay: false): the share at the smelter is the pay.
//   - THE CAPTAIN'S WORDS come up in a bubble on his side of the cockpit.
//   - THE CREW ABOARD (src/aboard.js): the captain and one of his crew, seen in the seats their jobs have, or along for
//     the ride: sitting, lying on a bed, walking from one to the next, out of the crew member's way.
//   - THE DRILL OPERATOR'S GAME (src/drillview.js, loaded only for a crew member who signed for the drill): at the
//     field the view goes outside the ship (the eye glides out of the seat: above) and the crew member finds the rocks and drills them
//     until the eight canisters are full, or heads home early with what is aboard (each part-full canister then
//     rounded to the nearest 1/8 of a tonne). What comes home is the store: the tonnes of each metal (land's `store`),
//     in the canisters as they are (the hangar's crane is told how full each came home).
//     That view has a Miner of its own, built for outside (legs up, its arms live), far from the parked one, of which
//     nothing is drawn meanwhile. With the pilot's seat left to the crew the jumps are the short version (the lamps
//     light by themselves) and the crew member rides in the other seat.
//   - THE CREW'S OWN DRILLING (the drill not signed for) is the same game on the same field's rocks (src/drill.js
//     CREW: one metal to a canister, all eight filled); it is watched from the seat, or from behind the ship.
//   - NO ANSWER CHANGES THE HAUL. The jump's lamps show where the pilot is in the jump, and nothing else.
//   - THE ENGINEER'S STEP, THE CORE'S TUNING, IS DONE ON FOOT OUT AT THE ROCKS (src/missions.js 'tune'; the game's
//     maker, 2026-11-16: "if you signed up for engineering then the captain tells you the core needs to be adjusted.
//     So you go back to mechanical and answer so questions there. Then you make your way back up to the pilot seat to
//     jump the ship back home"; 2026-11-19: "I was thinking it would be when you are at the foreign destination. So
//     either right after you arrive at the asteroids, or sometime before you jump back home", and "Tune at the remote
//     location (so its a more desperate situation)"). It is one of the trip's steps ('tune': RUN.tune), put by the
//     mission's data right after the jump out or right before the jump home (opts.tune: which, as picked when the
//     contract was signed). The ship says "Reactor imbalance.", the captain tells them, and a few words stay along the
//     top. In the seat a prompt comes up, Get up (E): pressed, they are on their feet in the cockpit and walk the ship
//     as they do in the hangar, back to Engineering; at the core, its prompt and its cards (src/tune.js). Tuned, the
//     captain asks them back, and in the cockpit the prompt is Sit down (E); seated, the run goes on from where it
//     was: the drilling, or the jump home. THE SHIP STAYS WHERE IT IS all the while, and nothing else happens: the
//     drilling waits for an engineer who is tuning on arrival.
//     WHAT THEY WALK is the ship's one cabin, the rooms built where it is parked (src/boarding.js), since those are
//     the only rooms and walls there are: nothing is built twice. WHAT IS OUTSIDE THE GLASS is where the run is:
//       whatever the jobs, the ship at the rocks is the drill's own, out in the field: built for outside, with a
//       cockpit and no rooms. While they are on their feet that ship is put away (drillview's `aboard`) and the ship
//       with its rooms, hull and cabin, is DRAWN in its very place, as it is drawn when it is flown about the station
//       (crane.fly, boarding.fly); the crew member's own figure and the eye are drawn there with it, all by the one
//       matrix from the ship where it stands in its hangar to the drill's ship among the rocks (afield). So the
//       field's own rocks and dust and sky are outside the glass, and the crew member's feet never leave the walls
//       they know. Seated again, the drill's own ship is back.
//     The ship's lift carries nobody from the moment the run begins until it ends (boarding.ride).
//   - ON THEIR FEET WHILE IT FLIES, ANYWHERE ON THE RUN (ON THEIR FEET ABOARD, below): anyone not at the controls just
//     then may get up and walk the ship's rooms; whoever flies flies on; their next move waits for them in their seat;
//     V looks from outside. The same one matrix as the tuning's, now every frame, wherever the ship is.
//   - A PART THE CREW MEMBER TAKES NO PART IN CAN BE SKIPPED (the game's maker, 2026-11-19, of a crew member signed
//     only as engineer: "it can just show basically the cinematic of the ship jumping, the cinematic of the ship
//     drilling ... we can just play through the cinematic and show the ship from the outside for now. ... If the ship
//     is doing something that you aren't taking part in, then there should be a button to "Go Home" or whatever to
//     make it just play the cinematic instead"). So, signed for neither the pilot's seat nor the drill, they ride as a
//     drill operator rides today and watch what a pilot alone watches today, seen from behind the ship where that view
//     exists (leaving and coming home; V still changes it) and through the glass at the rocks. And for anyone, while
//     the crew's pilot flies out, while the crew drills, and while the crew's pilot flies home, one button (K) skips
//     that part: clear of the station at once and straight into the jump; the canisters full at once and the jump
//     home; down on the pad at once. The wormhole itself is never skipped. Nothing else changes: the same haul comes
//     home either way.
//
//   const T = startTrip(ctx, { mission, roles, tune, onEnd })     ctx: { W, walls, boarding, crane, jobs, guide,
//       people, crew, save, body, put, walk(on), onCredits }; the crew member is in the ship's cockpit
//       tune: when the core's tuning comes on this run ('arrive' | 'leave'), or null (missions.js tuneWhen)
//       walk(on): the crew member's own walking handed back to them (on their feet at the rocks) and taken again
//   T.update(dt) each frame; T.aim(camera, dt) after the game's own camera; T.late() just before the picture
//   T.holds     the trip has the crew member (in the seat, or at the core with its card up): no walking, its camera;
//               false while they are on their feet out at the rocks
//   T.tune      the core's tuning, while it is on (src/tune.js)
//   T.abort()   given up (the crew screen): back in the parked ship, the contract still signed
//   T.skipPart()   the skip button, pressed (true if there was a part to skip); T.state().skip: its words now, or null
//   T.fly       the flying, while there is one (src/flying.js): its own state, its keys by name (the rigs)
//   T.state()   for the rigs
import * as THREE from 'three';
import { openPanel } from './jobs/panel.js';
import { JOB as PILOT } from './jobs/pilot.js';
import { CARRIES, sellsFor, lotsWords, inEighths, eighthsText } from './jobs/smelter.js';
import { stepsFor, land, LAMPS, ROLES, aboardOf } from './missions.js';
import { RUN_TALK } from './lines.js';
import { news } from './news.js';
import { MINER, flyingOf, setFlying } from './flymodel.js';
import { flightOf } from './fleet.js';
import { makeWormhole } from './wormhole.js';
import { makeAboard } from './aboard.js';

// the pilot's eyes and where they look, in the ship's own frame (x to port, y up from its ground line, z to the nose:
// ~/pw/space-math/SHIP_miner_arms.md), wide and on a phone, with the job panel up (it covers the right of a wide
// screen and the bottom of a phone's) and without
// (the Miner's own facts now: src/fleet.js, as every ship's; the flying's cockpit view is the same seat. A run's own
// ship's: SHIP below)
export const SEAT = MINER.seat;
// the eye's glide between the seat and the drill's view outside the ship: out (once the wormhole's far end has opened),
// back in, and out for the short scene of a part skipped at the rocks (s)
export const GLIDE = { out: 2.4, back: 1.6, skip: 1.3 };
// on their feet in the drill's own ship, out in the field: how near and how far the eye sees (m: a wall at arm's
// length, as walking in the hangar, and the furthest rocks of the field)
const AFIELD = { near: 0.03, far: 6000 };
// (a seated person's eyes over the floor their seat stands on, m: so the cockpit's seats' floor is the flying's own
// seat's eye less this, for the crew seen in them: src/aboard.js)
const SIT_EYE = 1.27;

const CSS = `
.pmt { position: fixed; inset: 0; z-index: 22; pointer-events: none; font: 400 16px/1.35 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; color: #eef1f4; user-select: none; -webkit-user-select: none; }
.pmt-chip { position: absolute; left: 50%; top: max(12px, env(safe-area-inset-top)); transform: translateX(-50%); height: 40px; padding: 0 16px; display: flex; align-items: center; gap: 8px; white-space: nowrap;
  font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; background: rgba(15, 19, 25, 0.86); box-shadow: inset 0 0 0 1.5px rgba(255, 205, 60, 0.7);
  clip-path: polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px); }
.pmt-chip b { color: #ffd560; } .pmt-chip span { color: #cfd8e2; }
.pmt-say { position: absolute; right: max(18px, 4vw); top: 86px; max-width: min(300px, 44vw); opacity: 0; transition: opacity 0.25s ease; }
.pmt.has-panel .pmt-say { right: auto; left: max(18px, 4vw); }
.pmt-say.is-on { opacity: 1; }
.pmt-say small { display: block; margin-bottom: 3px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #ffd560; }
.pmt-say p { margin: 0; padding: 8px 12px 9px; font-size: 15px; font-weight: 600; background: rgba(13, 17, 23, 0.9); box-shadow: inset 0 0 0 2px rgba(255, 205, 60, 0.85);
  clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px); }
.pmt-count { position: absolute; left: 50%; bottom: max(30px, env(safe-area-inset-bottom)); transform: translateX(-50%); padding: 10px 20px; text-align: center; background: rgba(15, 19, 25, 0.88); box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.4);
  clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px); }
.pmt-count[hidden] { display: none; }
.pmt-count small { display: block; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #a7b0ba; }
.pmt-count b { font-size: 26px; font-weight: 800; }
.pmt-count em { display: block; font-style: normal; font-size: 14px; color: #cfe6ff; min-height: 1.35em; }
/* (a part the crew member takes no part in: the button that skips it, over the flying's own row of buttons; and, not at
   the controls, the button to get up, and on their feet the one to look from outside the ship and back) */
.pmt-acts { position: absolute; right: max(14px, env(safe-area-inset-right)); bottom: calc(max(14px, env(safe-area-inset-bottom)) + 52px); display: flex; flex-direction: column-reverse; align-items: flex-end; gap: 8px; pointer-events: none; }
.pmt-skip, .pmt-up, .pmt-view { height: 44px; padding: 0 16px; display: inline-flex; align-items: center; gap: 8px; pointer-events: auto; cursor: pointer; border: 0; margin: 0;
  font: inherit; font-size: 14px; font-weight: 700; letter-spacing: 0.04em; color: #eef1f4; background: rgba(15, 19, 25, 0.88); box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.45); -webkit-tap-highlight-color: transparent;
  clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px); }
.pmt-skip[hidden], .pmt-up[hidden], .pmt-view[hidden] { display: none; }
.pmt-acts kbd { font: 700 12px/1 ui-monospace, "SF Mono", Consolas, monospace; padding: 3px 6px; color: #10151c; background: #cfd8e2; border-radius: 3px; }
@media (hover: none) and (pointer: coarse) { .pmt-acts kbd { display: none; } }
@media (max-width: 640px) { .pmt-acts { right: 50%; transform: translateX(50%); align-items: center; bottom: calc(max(20px, env(safe-area-inset-bottom)) + 112px); } .pmt-skip, .pmt-up, .pmt-view { height: 46px; } }
/* (on their feet aboard, nothing of the flying's own on the screen: the buttons sit lower, clear of the walking stick on a phone) */
.pmt.is-afoot .pmt-acts { bottom: max(14px, env(safe-area-inset-bottom)); }
/* (a seat's or a bed's prompt is up where the count of canisters sits: the count is put away under it meanwhile) */
.pmt.has-seat .pmt-count { display: none; }
@media (max-width: 640px) { .pmt.is-afoot .pmt-say { top: 132px; } .pmt.is-afoot .pmt-acts { right: max(12px, env(safe-area-inset-right)); transform: none; align-items: flex-end; bottom: calc(max(14px, env(safe-area-inset-bottom)) + 150px); } }
/* (at the drill: under the trip's own word along the top, clear of the store and the chart at the side; on a phone above the game's buttons (Fly manually over Scan) and line, and put away while the question is up) */
.pmt.is-drill .pmt-say, .pmt.is-drill.has-panel .pmt-say { top: 62px; right: auto; left: 50%; transform: translateX(-50%); width: max-content; max-width: min(300px, 40vw); }
@media (max-width: 640px) { .pmt.is-drill .pmt-say, .pmt.is-drill.has-panel .pmt-say { top: auto; bottom: 226px; left: 50% !important; max-width: 78vw; } .pmt.is-drill.has-panel .pmt-say { display: none; } }
/* (flown by hand at the rocks on a phone: above the flying's own row of buttons, View, Controls, Back to the drill) */
@media (max-width: 640px) { .pmt.is-drill.is-hand .pmt-say { bottom: 290px; } }
/* (the count stays up while the jump home is worked out: beside the jump computer's panel on a wide screen, put away under it on a phone) */
@media (min-width: 641px) { .pmt.has-panel .pmt-count { left: 31%; max-width: 56vw; } }
@media (max-width: 640px) { .pmt.has-panel .pmt-count { display: none; } }
@media (max-width: 640px) { .pmt-chip { top: max(60px, calc(env(safe-area-inset-top) + 56px)); font-size: 12px; left: 3vw; right: 3vw; transform: none; margin: 0 auto; width: fit-content; white-space: normal; height: auto; min-height: 40px; padding: 6px 12px; column-gap: 8px; row-gap: 0; flex-wrap: wrap; justify-content: center; text-align: center; line-height: 1.25; } .pmt-say { top: 108px; left: 10px !important; right: auto; max-width: 78vw; } .pmt-say p { font-size: 14px; } .pmt-count b { font-size: 22px; } }
/* (the core's tuning: its card lies along the bottom of a phone and may reach nearly to its top: the strip and the captain's words are put away under it) */
@media (max-width: 640px) { .pmt.is-tune.has-panel .pmt-chip, .pmt.is-tune.has-panel .pmt-say { display: none; } }
/* (the seat's prompt out at the rocks, and the core's: as wide as their words need, up to the screen's width, so on a phone the words are a line or two and not a column of single words) */
.pnj-prompt.pmt-wide { width: max-content; max-width: 94vw; }
`;

export function startTrip(ctx, { mission: M, roles, tune = null, onEnd = () => {} }) {
  const { W, walls, boarding, crane, jobs, guide, crew, save } = ctx;
  if (!document.getElementById('pmt-css')) { const st = document.createElement('style'); st.id = 'pmt-css'; st.textContent = CSS; document.head.appendChild(st); }
  const S = boarding.ships.find((s) => s.id === M.ship);
  // (the run's ship's own facts, as the shared ship piece flies it: src/fleet.js)
  const SHIP = flightOf(M.ship) || MINER;
  const steps = stepsFor(M, roles, tune), TALK = RUN_TALK[M.id] || {};
  const el = document.createElement('div'); el.className = 'pmt';
  el.innerHTML = '<div class="pmt-chip"><b></b><span></span></div><div class="pmt-say"><small></small><p></p></div><div class="pmt-count" hidden><small>Canisters full</small><b></b><em></em></div><div class="pmt-acts"><button type="button" class="pmt-skip" hidden></button><button type="button" class="pmt-up" hidden>Get up <kbd>E</kbd></button><button type="button" class="pmt-view" hidden></button></div>';
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s), sayEl = $('.pmt-say'), countEl = $('.pmt-count'), skipEl = $('.pmt-skip'), upEl = $('.pmt-up'), viewEl = $('.pmt-view');
  $('.pmt-chip b').textContent = M.name;
  // (the seat's own prompt, when the jump computer has been put away for a moment)
  const prompt = document.createElement('div'); prompt.className = 'pnj-prompt'; prompt.hidden = true;
  prompt.innerHTML = '<div class="pnj-pw"><b>Jump computer</b><small>Work out the jump</small></div><button type="button" class="pnj-go">Start<kbd>E</kbd></button>';
  document.body.appendChild(prompt);
  prompt.querySelector('.pnj-go').addEventListener('click', () => openCards());
  // (the seat's prompt out at the rocks, for the core's tuning: Get up, and afterwards Sit down)
  const seatEl = document.createElement('div'); seatEl.className = 'pnj-prompt pmt-wide'; seatEl.hidden = true;
  seatEl.innerHTML = '<div class="pnj-pw"><b></b><small></small></div><button type="button" class="pnj-go"></button>';
  document.body.appendChild(seatEl);
  seatEl.querySelector('.pnj-go').addEventListener('click', () => seatGo());

  const T = { i: -1, t: 0, phase: '', clock: 0, space: false, inField: false, done: false, aborted: false, afoot: false, filled: 0, lamps: [], lit: 0, n: null, paused: false, store: null, cans: null, early: false, log: [] };
  // (signed for which: the pilot's seat, the drill; for neither, the ship's engineer alone: they ride and watch)
  const iPilot = roles.includes('pilot'), iDrill = steps.some((s) => s.kind === 'work' && s.mine) && roles.includes('drill'), iWatch = !iPilot && !iDrill;
  // WHO IS ABOARD (src/missions.js aboardOf: the ship's crew of three, the captain and one of his crew with the crew
  // member) and which of them does each job left to the crew: the one who drills (their name as said), the one who
  // is the run's engineer, whom the captain speaks to (the crew member, signed for it, or his own; null: himself)
  const aboard = aboardOf(M, roles, { id: M.captain, name: ctx.captainName || 'The captain' });
  const doer = (job) => aboard.find((a) => a.jobs.includes(job)) || null;
  const driller = doer('drill'), engineer = roles.includes('engineer') ? null : doer('engineer') && !doer('engineer').captain ? doer('engineer').short : '';
  let drill = null, drillKit = null, drillErr = null, drillOn = false;
  let panel = null, hidden = null, stand = null, sayT = 0, fireIn = -1;
  // (the crew aboard, src/aboard.js: made as the crew member sits down)
  let crewA = null;
  // (the flying, src/flying.js: fetched as the crew member sits down; it lives from the seat to the landing)
  let fl = null, flMod = null, flErr = null, flAsked = false;
  // (the wormhole: one for the trip, made as the crew member sits down. The flying at the rocks, src/fieldfly.js: from
  // the far end of the jump out until the colours of the jump home are all round)
  let wh = null, ff = null;
  // (the core's tuning, src/tune.js: fetched as the crew member sits down, if this run has one; `tn` while it is on)
  let tuneMod = null, tuneErr = null, tuneAsked = false, tn = null;
  const name = crew.name || 'pilot';
  const fill = (s, more = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => ({ player: name, engineer: engineer || name, driller: driller ? driller.short : name, ...more }[k] ?? ''));
  const pick = (L) => (L && L.length ? L[Math.floor(Math.random() * L.length)] : '');
  function say(key, more) { const w = fill(pick(TALK[key]), more); if (!w) return; $('.pmt-say small').textContent = ctx.captainName || 'The captain'; $('.pmt-say p').textContent = w; sayEl.classList.add('is-on'); sayT = Math.min(8, 2.4 + w.length * 0.06); T.log.push('says: ' + w); }
  const words = (w) => { $('.pmt-chip span').textContent = w; };
  const P = () => ctx.body();
  const inShip = (v) => new THREE.Vector3(...v).applyMatrix4(S.M);

  // ── out there: the station put away, and back ──
  function space(on) {
    if (on === T.space) return;
    T.space = on;
    if (on) {
      W.alone = [S.zone.id];
      const keep = new Set([W.sky.object, S.cabin && S.cabin.group, P() && P().c.root, wh && wh.ball].filter(Boolean));
      hidden = W.scene.children.filter((o) => !o.isLight && !keep.has(o) && o !== W.built.group && o.visible);
      for (const o of hidden) o.visible = false;
    } else {
      W.alone = null;
      for (const o of hidden || []) o.visible = true; hidden = null;
    }
  }

  // ── the jump computer: the job panel with the pilot's cards, its three lamps on the card's top ──
  const lampsHtml = () => `<div class="pnj-lamps" aria-label="The jump's three lamps">${LAMPS.map((n, k) => { const s = T.lamps[k]; return `<span class="pnj-lamp${s ? ' is-' + s : k === T.lit ? ' is-now' : ''}" title="${n}${s === 'lit' ? ': lit at the first try' : s === 'late' ? ': lit' : ''}"><i></i><span>${n}</span></span>`; }).join('')}</div>`;
  const link = {
    now: () => ({ lamp: LAMPS[Math.min(T.lit, LAMPS.length - 1)].toLowerCase(), to: steps[T.i].to }),
    head: () => `<header class="pnj-cardtop is-jump"><span class="pnj-icon is-jump" aria-hidden="true"></span><b>Jump computer</b><small>${steps[T.i].to === 'home' ? 'The jump home' : 'The jump to the rocks'}</small></header>${lampsHtml()}`,
    right(q) {
      const first = q.misses === 0, st = steps[T.i];
      T.lamps[T.lit] = first ? 'lit' : 'late'; T.lit++;
      const box = panel && panel.el.querySelector('.pnj-lamps'); if (box) box.outerHTML = lampsHtml();
      if (T.lit >= st.cards) fireIn = 0.95;      // (the third lamp: the jump fires by itself)
    },
  };
  function openCards() {
    if (panel || T.done || steps[T.i].kind !== 'jump' || T.phase !== 'cards') return;
    T.paused = false; prompt.hidden = true; el.classList.add('has-panel');
    panel = openPanel(document.body, { job: PILOT, crew, live: link, pay: false, onSave: () => save(crew), onCredits: () => {},
      onClose: () => { panel = null; el.classList.remove('has-panel'); if (T.phase === 'cards' && fireIn < 0) { T.paused = true; prompt.hidden = false; } } });
  }
  function onKey(e) {
    if (!prompt.hidden && !panel && (e.key === 'e' || e.key === 'E' || e.key === 'Enter')) { e.preventDefault(); openCards(); }
    else if (!seatEl.hidden && !e.repeat && (e.key === 'e' || e.key === 'E' || e.key === 'Enter')) { e.preventDefault(); seatGo(); }
    else if (!upEl.hidden && !e.repeat && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); getUp(); }
    else if (e.code === 'KeyK' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && skipWhat()) { e.preventDefault(); skip(); }
    // (on their feet aboard: V looks from outside the ship, and back; seated, the flying's own V changes its views)
    else if (e.code === 'KeyV' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && T.afoot && !(tn && tn.busy)) { e.preventDefault(); outside(!T.out); }
  }
  upEl.addEventListener('click', () => { getUp(); upEl.blur(); });
  viewEl.addEventListener('click', () => { outside(!T.out); viewEl.blur(); });
  addEventListener('keydown', onKey);

  // ── THE SKIP BUTTON (the top of this file): the part of the run now going on, if the crew member takes no part in
  // it and it can be skipped: the button's words, or null ──
  function skipWhat() {
    if (T.done || T.i < 0 || T.i >= steps.length) return null;
    const k = steps[T.i].kind;
    if (k === 'leave' && !iPilot && T.phase === 'fly' && fl && fl.on && !T.clear) return 'Skip the flying';
    // (at the rocks with the crew's driller: a pilot's own button, in the game's maker's words: "there should be a
    // button that also lets the pilot skip this portion (like "Return Home")"; riding, the part they take no part in)
    if (k === 'work' && !iDrill && T.phase === 'crew' && drill && drill.crew && !drill.crew.hurried) return iPilot ? 'Return home' : 'Skip the drilling';
    if (k === 'land' && !iPilot && T.phase === 'fly' && fl && fl.on && !fl.S.landed) return 'Skip the landing';
    return null;
  }
  function skip() {
    const what = skipWhat(); if (!what) return false;
    const k = steps[T.i].kind;
    // (leaving: clear of the station at once, and the crew's pilot's jump with it. Drilling: the canisters full, and the
    // jump home plotted at once if it is the crew's pilot's. Landing: down on its pad as it is parked)
    if (k === 'leave') { fl.skip(); T.hurry = true; }
    // (at the rocks: a very short scene of a rock being drilled, seen from outside the ship: the eye glides out to the
    // drill's own view, the marked rock is flown to at once and drilled, a hole, and the rest of the load is the crew's)
    else if (k === 'work') { drill.crew.hurry(); T.hurry = true; if (ff && !T.afoot) { T.scene = true; T.viewWas = ff.fl.view; ff.out(GLIDE.skip); } }
    else fl.skip();
    T.log.push('skipped: ' + what); skipEl.hidden = true;
    return true;
  }
  skipEl.addEventListener('click', () => { skip(); skipEl.blur(); });
  let skipShown = null;
  function paintSkip() { const w = skipWhat(); if (w === skipShown) return; skipShown = w; skipEl.hidden = !w; if (w) skipEl.innerHTML = `${w} <kbd>K</kbd>`; }


  // ── the steps ──
  function next() { T.i++; T.t = 0; T.phase = ''; if (T.i >= steps.length) { finish(); return; } T.log.push('step ' + steps[T.i].id); }
  const RUN = {
    // out of the hangar: the crew member at the controls (or riding, the captain's own pilot flying), the ship really
    // flown out through the bay door and clear of the station (src/flying.js). Then the jump: the pilot's own button,
    // or by itself for the crew's pilot.
    leave(dt, st) {
      if (!T.phase) {
        // (only ever from the seat: the crew member walked to the ship, rode its lift up and sat down. Nobody is put
        // there behind a dark screen)
        if (S.state !== 'in' || boarding.where(P().pos) !== M.ship + '/cockpit') { console.error('trip: the crew member is not in the ' + M.ship + '\'s cockpit'); abort(); return; }
        T.phase = 'sit'; words('');
      }
      if (T.phase === 'sit') {
        if (!flAsked) { flAsked = true; import('./flying.js').then((m) => { flMod = m; }).catch((e) => { flErr = e; console.error(e); if (window.oops) window.oops(e); }); }
        if (flErr) { abort(); return; }
        if (!flMod) return;
        stand = P().pos.clone();
        if (!crane.depart()) { abort(); return; }
        jobs.show(false); if (guide.active) guide.clear();
        if (!wh) wh = makeWormhole({ scene: W.scene, quality: W.quality, rand: ctx.rand || Math.random });
        // (the field and its ship, the drill's game, for everyone (the same field whatever the jobs): fetched and its
        // ship built now, so the field does not wait)
        // (the core's tuning, if this run has one: fetched now too, and the ship's own words for it)
        if (!tuneAsked && steps.some((s) => s.kind === 'tune')) { tuneAsked = true; import('./tune.js').then((m) => { tuneMod = m; m.readyTune(M); }).catch((e) => { tuneErr = e; console.error(e); if (window.oops) window.oops(e); }); }
        if (!drillKit) Promise.all([import('./drillview.js'), import('./fieldfly.js')]).then(async ([m, f]) => { const ship = await m.buildShip(); if (T.done) ship.dispose(); else drillKit = { m, f, ship }; }).catch((e) => { drillErr = e; console.error(e); if (window.oops) window.oops(e); });
        fl = flMod.startFlying({ W, boarding, crane, outside: ctx.outside || null, people: ctx.people || (() => null), visit: ctx.visit || null }, { cfg: SHIP, goal: 'leave', pilot: iPilot, flier: ROLES.pilot.crew, words,
          // (taking no part in the flying or the drilling: the ship seen from outside, where that view exists)
          view: iWatch ? 'behind' : 'cockpit',
          settings: flyingOf(crew), onSettings: (set) => { setFlying(crew, set); save(crew); },
          onClear: () => { T.clear = true; if (steps[T.i] && steps[T.i].kind === 'leave') say(iPilot ? 'out' : 'crewOut'); }, onJump: () => { T.jumpAsked = true; },
          onLanded: () => { if (steps[T.i] && steps[T.i].kind === 'land') T.landed = true; },
          // (the ship stands somewhere else than it did: the crew member's body, in its seat, goes with it)
          // (on their feet aboard, it is they who go with it, wherever they stand)
          onStand: (moved) => { if (!stand || !P()) return; stand.applyMatrix4(moved); const at = T.afoot ? P().pos.clone().applyMatrix4(moved) : stand, h = P().heading || 0, v = new THREE.Vector3(Math.sin(h), 0, Math.cos(h)).transformDirection(moved); ctx.put(at, Math.atan2(v.x, v.z)); },
          // (the seat's prompt: getting up is what ends the flight)
          onGetUp: () => { if (steps[T.i] && steps[T.i].kind === 'land') T.gotUp = true; } });
        api.fly = fl; T.sat = true; T.phase = 'fly'; T.t = 0;
        // (the lift carries nobody while the ship is theirs: on its pad it is about to go, and then it is away)
        if (boarding.ride) boarding.ride(M.ship, false);
        // (signed only as engineer: on their feet from the start, the two chairs the crew's)
        if (startAfoot) { T.afoot = true; T.out = false; T.outK = 0; goAfoot(); }
        // THE CREW ABOARD (src/aboard.js; the game's maker: "it is fine to just have them pop into existence on the
        // ship once you click the pilots seat"): the captain and one of his crew, here from now on. The captain is
        // taken out of the station meanwhile (he waited by the ship's lift)
        const pp = ctx.people ? ctx.people() : null;
        if (pp && pp.figure && S.bpData) makeAboard({ people: pp, ship: S, crew: aboard.map((a) => ({ id: a.id, name: a.name, look: a.look, jobs: a.jobs })), cockpitFloor: SHIP.seat.eye[1] - SIT_EYE - S.space.deck, mine: seatOf(), rand: ctx.rand || Math.random })
          .then((A) => { if (T.done) { A.dispose(); return; } crewA = A; api.crew = A; if (pp.aboard) pp.aboard(M.captain, true); T.log.push('aboard: ' + A.list.map((w) => w.name).join(', ')); })
          .catch((e) => { console.error(e); if (window.oops) window.oops(e); });
      }
      // (clear of the station: on to the jump, when the pilot asks for it; the crew's own pilot goes straight on; a
      // pilot on their feet is asked back to their seat for it)
      if (T.phase === 'fly' && T.clear && (!iPilot || T.jumpAsked || T.afoot)) { T.jumpAsked = false; next(); }
    },
    // the jump computer: three cards, three lamps, and the jump fires by itself
    jump(dt, st) {
      // (the pilot's jump, the pilot on their feet: it waits for them, the ship holding where it is)
      if (waitSeat(st.mine, 'backJump')) return;
      if (!T.phase) {
        // (the ship steadies itself and holds where it is while the jump is worked out: the flying's controls put away)
        if (fl && fl.on) fl.lock(true);
        T.lamps = []; T.lit = 0; fireIn = -1; words(st.mine ? (st.to === 'home' ? 'Work out the jump home' : 'Work out the jump to the rocks') : (st.to === 'home' ? 'Juno plots the jump home' : 'Juno plots the jump'));
        if (st.mine) { T.phase = 'cards'; T.hurry = false; openCards(); } else T.phase = 'crew';
      }
      // (a pilot of the captain's own: the lamps light by themselves; all at once after a part skipped: T.hurry)
      if (T.phase === 'crew' && T.hurry && fireIn < 0) { T.hurry = false; while (T.lit < st.cards) T.lamps[T.lit++] = 'lit'; fireIn = 0.3; }
      else if (T.phase === 'crew' && T.lit < st.cards && T.t > 1.2 * (T.lit + 1)) { T.lamps[T.lit] = 'lit'; T.lit++; if (T.lit >= st.cards) fireIn = 0.6; }
      if (fireIn >= 0 && T.phase !== 'jumping') {
        fireIn -= dt;
        if (fireIn <= 0) { fireIn = -1; T.phase = 'jumping'; prompt.hidden = true; if (panel) panel.close(true), panel = null, el.classList.remove('has-panel'); words('Jumping'); startJump(st); }
      }
      // (the wormhole itself is stepped with everything else: api.update. Its far end, opened, moves the run on)
      // (the place ahead not made by the time the colours are all round: they go on, and it is opened as soon as it is)
      if (T.phase === 'jumping' && T.inField && !drill && wh && wh.jump && wh.jump.shut) { if (drillErr) { abort(); return; } if (drillKit) openDrill(); }
    },
    // at the rocks: the crew member's own drilling (signed for the drill: runDrill), or the crew's (runCrew)
    work(dt, st) {
      // (the drill operator on their feet: the drilling waits for them; seated, the eye glides out to the drill's view)
      if (iDrill && waitSeat(true, 'backDrill')) return;
      if (iDrill && T.phase === 'seated') { T.phase = ''; if (ff) ff.out(GLIDE.out); }
      if (iDrill) { runDrill(dt, st); return; }
      runCrew(dt, st);
    },
    // home: flown in through the bay door and set down on its pad, by hand or on autopilot (src/flying.js); down, the
    // haul is aboard and the share is worked out
    // (down on the hangar's floor the seat's prompt comes up, Get up, and nothing ends until it is pressed: the pilot
    // may lift off again and set it down better. Got up: the ship stands where it was set down (the flying told the
    // crane and the cabin as it came down), the haul is aboard it there, and the share is worked out)
    land(dt, st) {
      if (!T.phase) { T.phase = 'fly'; T.landed = false; T.gotUp = false; if (!fl) { console.error('trip: nothing to fly home in'); abort(); return; } }
      // (on their feet aboard as it comes down: they are up already, and the flight ends as it is down)
      if (T.phase === 'fly' && (T.gotUp || T.afoot) && fl.S.landed) {
        T.stood = !!crane.standing;
        fl.close(); fl = null; api.fly = null;
        // (the hangar's canisters are the ones that came home: how full each is; the payout is their plain sum)
        T.n = crane.arrive({ flown: true, fills: T.cans ? T.cans.map((c) => c.t) : null });
        T.payout = land(crew, { n: T.n, store: T.store }); save(crew);
        if (drillKit) { drillKit.ship.dispose(); drillKit = null; }
        try { news.add({ kind: 'haul', ship: 'Miner', ore: T.payout.lots.length > 1 ? 'mixed ore' : T.payout.lots[0].metal, tons: Number.isInteger(T.payout.tonnes) ? ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'][T.payout.tonnes] || String(T.payout.tonnes) : inEighths(T.payout.lots) ? eighthsText(T.payout.tonnes) : String(T.payout.tonnes) }); } catch (e) { /* no news */ }
        words('Home'); say(iPilot ? 'landed' : 'landedCrew');
        next();
      }
    },
    // THE CORE'S TUNING, out at the rocks (the top of this file; src/tune.js): the ship says so, then the captain; the
    // seat's prompt, Get up; on their feet to the core and its cards; tuned, back to the cockpit and Sit down; then
    // the run goes on. The ship stays where it is.
    tune(dt, st) {
      if (!T.phase) {
        if (tuneErr) { abort(); return; }
        if (!tuneMod) return;      // (still on its way: a moment more in the seat)
        T.phase = 'call'; T.t = 0; el.classList.add('is-tune'); $('.pmt-chip b').textContent = 'Reactor imbalance';
        // (the count of canisters is put away until they are seated again: the seat's prompt comes up where it is)
        T.countUp = !countEl.hidden; countEl.hidden = true;
        // (tuned: the captain asks them back to their seat only if the next part is theirs; else they carry on as they like)
        const then = steps[T.i + 1], theirs = !!then && ((then.kind === 'jump' && then.mine) || (then.kind === 'work' && iDrill));
        tn = tuneMod.startTune({ boarding, crew, save }, { mission: M, step: st, say: (key, more) => say(key === 'tuned' && !theirs ? 'tunedFree' : key, more), strip: words,
          onPanel: (up) => { el.classList.toggle('has-panel', up); if (ctx.walk) ctx.walk(!up && T.afoot && !T.out); },
          // (tuned: the strip is the run's own again, and asks them back if the next part is theirs)
          onDone: () => { T.phase = 'back'; $('.pmt-chip b').textContent = M.name; words(theirs ? 'Back to your seat' : ''); el.classList.remove('is-tune'); } });
        api.tune = tn; T.log.push('the core needs tuning: ' + st.at);
      }
      const busy = tn.update(dt, P(), T.afoot);
      // (the captain has told them: the seat lets them up; already on their feet, they go straight to the core)
      if (T.phase === 'call' && tn.told) T.phase = T.afoot ? 'afoot' : 'seat';
      // (tuned: the run goes on at once, with them on their feet; the next part asks them back to their seat if it is
      // theirs: needSeat)
      if (T.phase === 'back' && !busy) { if (tn) { tn.close(); tn = null; api.tune = null; } countEl.hidden = !T.countUp; next(); return; }
      if (T.phase === 'seat' && seatEl.dataset.as !== 'tune') {
        seatEl.dataset.as = 'tune'; seatEl.hidden = false;
        seatEl.querySelector('b').textContent = 'Reactor imbalance'; seatEl.querySelector('small').textContent = 'Go back to Engineering and adjust the core';
        seatEl.querySelector('.pnj-go').innerHTML = 'Get up<kbd>E</kbd>';
      }
    },
  };
  // ── ON THEIR FEET ABOARD WHILE IT FLIES (the game's maker, 2026-11-19, in chat: "We already have walking on the ship.
  // In order to walk on it while it flies wouldn't we just need to add its position and rotation with the player?";
  // 2026-11-18: "The best case is that you can walk around the ship as it flies ... If you only sign up as an
  // engineer then you would basically be hanging out inside the ship the whole time ... If you are a driller or pilot
  // I think it's fine to have to press the "Get Up" button. It's no big deal"; "It would be best if the pilot or
  // driller could "Get Up" at any time, but if they are expected to do the next move then it will request them to get
  // back to the seat"). So:
  //   - ANYONE NOT AT THE CONTROLS JUST THEN MAY GET UP (upEl, E): a rider, and the pilot while the autopilot or the
  //     jump has the ship. Not the pilot flying by hand, nor the drill operator at the drill, nor anyone with the jump's
  //     cards up. Signed only as engineer they are on their feet from the start: the two chairs are the crew's.
  //   - WHO FLIES MEANWHILE: whoever flew it, the autopilot or the crew's pilot (the flying is put aside: src/flying.js
  //     `aside`); at the rocks, to the driller's marked rock, the autopilot (src/fieldfly.js `ride`).
  //   - THEIR NEXT MOVE (needSeat): the pilot's jump, the drill operator's drilling. The run waits there, the ship
  //     holding, the strip and the captain ask them back to their seat, and Sit down (E) in the cockpit carries on.
  //   - THE ONE MATRIX, NOW EVERY FRAME (aboard): they walk the ship's one cabin where it stands in its hangar, its
  //     walls as they know them; the eye and their own figure are drawn by the matrix from there to where the ship is
  //     now: flying about the station (the flying draws the hull and the cabin there already), in the wormhole, or out
  //     in the field (where the hull and the cabin are drawn in the drill's own ship's place, that ship put away).
  //   - V (and a button) LOOKS FROM OUTSIDE, from wherever they stand: a quick glide out to behind the ship, and back.
  //     Meanwhile they stand still. (At the rocks, from outside, the drill's own ship is drawn, its arms at work.)
  //   - THE CANOPY: from inside the rooms it is the cabin's own smoked glass, wherever they stand (the drill's ship,
  //     with its glass dark from outside, is never drawn round them).
  const seatOf = () => (iPilot ? 'pilot' : iDrill ? 'drill' : null);      // (whose seat in the cockpit is theirs: none signed only as engineer)
  const startAfoot = !seatOf();
  // (the next part is theirs and wants them seated: its words, or null)
  function needSeat() {
    const st = steps[T.i]; if (!st || T.done) return null;
    if (st.kind === 'jump' && st.mine && T.phase !== 'jumping' && fireIn < 0) return 'The jump is yours: back to your seat';
    if (st.kind === 'work' && iDrill && (!T.phase || T.phase === 'wantSeat')) return 'The drill is yours: back to your seat';
    return null;
  }
  // (at the controls just now: flying by hand, at the drill, with the jump's cards, or the core's card, up)
  function atControls() {
    const st = steps[T.i]; if (!st || T.done || !T.sat || T.afoot) return true;
    if (panel || (tn && tn.busy) || (st.kind === 'jump' && st.mine && T.phase === 'cards')) return true;
    if (st.kind === 'tune' && T.phase !== 'seat') return true;
    if (st.kind === 'land' && fl && fl.S.landed) return true;      // (down: the flying's own Get up ends the flight)
    if (ff) return ff.mode === 'hand' || ff.mode === 'drill' || (drill && drill.gliding);
    if (fl && fl.on) return iPilot && !fl.auto && !fl.locked;
    return false;
  }
  const canUp = () => !T.done && T.sat && !T.afoot && !atControls();
  // THE SEAT'S PROMPT, pressed: up out of the seat, or down into it again
  function seatGo() {
    if (seatEl.hidden || T.done) return;
    const as = seatEl.dataset.as;
    if (as === 'tune') getUp(true); else if (as === 'down') sitDown(); else if (as === 'rest' && T.near) rest(T.near); else if (as === 'rise') rise();
  }
  // ANY OTHER SEAT OR BED ABOARD (the game's maker: "it would be great if the seats and beds on the ships could be used
  // by the npcs or the player"; src/aboard.js): a free one within reach, Sit down or Lie down (E), and Get up again.
  // Meanwhile they stay there, seen from behind as they walk; the run goes on round them (their next move still asks
  // them back to their own seat). Lying, they are laid on their back along the bed, not seen climbing in.
  const _rp = new THREE.Matrix4(), _rv = new THREE.Vector3();
  function rest(p) {
    if (!T.afoot || T.rest || !crewA || !P()) return;
    T.rest = p; T.restFrom = P().pos.clone(); T.restHeading = P().heading || 0; crewA.take(p, 'player'); seatEl.dataset.as = '';
    if (ctx.walk) ctx.walk(false);
    const at = _rv.set(p.x, p.y, p.z).applyMatrix4(S.M), f = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading)).transformDirection(S.M);
    ctx.put(p.kind === 'lie' ? new THREE.Vector3().set(p.stand[0], S.space.deck, p.stand[1]).applyMatrix4(S.M) : at.clone(), Math.atan2(f.x, f.z));
    T.log.push((p.kind === 'lie' ? 'lies down: ' : 'sits down: ') + p.id);
  }
  function rise() {
    if (!T.rest) return;
    const p = T.rest; T.rest = null; seatEl.dataset.as = ''; if (crewA) crewA.free('player');
    const at = new THREE.Vector3(p.stand[0], S.space.deck, p.stand[1]).applyMatrix4(S.M), s2 = walls.snap(at.x, at.y + 0.4, at.z, 0.8);
    ctx.put(s2 ? new THREE.Vector3(s2.x, s2.y, s2.z) : T.restFrom, T.restHeading);
    if (ctx.walk) ctx.walk(!T.out);
    T.log.push('gets up from ' + p.id);
  }
  // ON THEIR FEET in the cockpit, where they stood as they sat down, turned to the cabin behind the seats. Their walking
  // is their own from here (ctx.walk), in the ship's cabin where it stands.
  const _X = new THREE.Matrix4(), _Xq = new THREE.Quaternion(), _m = new THREE.Matrix4(), _o = new THREE.Vector3(), _oq = new THREE.Quaternion(), _oe = new THREE.Vector3(), _ol = new THREE.Vector3(), _ou = new THREE.Vector3(), _om = new THREE.Matrix4();
  function getUp(tune = false) {
    if (T.afoot || (!tune && !canUp()) || (tune && T.phase !== 'seat')) return;
    T.afoot = true; T.out = false; T.outK = 0; seatEl.hidden = true; seatEl.dataset.as = ''; if (tune) T.phase = 'afoot';
    if (stand && P()) { const v = new THREE.Vector3(0, 0, -1).transformDirection(S.M); ctx.put(stand, Math.atan2(v.x, v.z)); }
    goAfoot();
    T.log.push('got up');
  }
  function goAfoot() {
    // (whoever flies, flies on: nothing of the flying is theirs meanwhile)
    if (fl) fl.aside(true); if (ff) ff.fl.aside(true);
    W.camera.up.set(0, 1, 0); el.classList.add('is-afoot');
    // (the captain's words have their ordinary place while they walk: the drill's own boxes are not on the screen)
    el.classList.remove('is-drill');
    if (ctx.walk) ctx.walk(true);
  }
  // V: out to behind the ship and back, with a quick glide (aboard() draws it)
  function outside(v) {
    if (!T.afoot || T.done || v === T.out) return;
    T.out = v; if (ctx.walk) ctx.walk(!v && !(tn && tn.busy) && !T.rest); T.log.push(v ? 'looks from outside' : 'looks from inside again');
  }
  // WHERE THE SHIP IS NOW, its kit frame in the world: out in the field, flying about the station, or where it stands
  // (out in the field it is where the drill's view has it: the flying is told only when it is flown)
  const _sw = new THREE.Matrix4();
  const shipNow = () => (ff && drill ? _sw.multiplyMatrices(drill.at, drill.ship.M) : ff ? ff.matrix : fl && fl.on ? fl.matrix : S.M);
  const OUT = { secs: 0.7, swap: 0.4 };      // (the glide out and back, s; how far out the drill's own ship is drawn in place of the rooms)
  // ABOARD, each frame after the game's own walking and camera have had their say (the top of this part)
  function drawAboard(dt) {
    const cam = W.camera, root = P() && P().c.root, Mn = shipNow();
    T.outK = Math.max(0, Math.min(1, T.outK + (T.out ? 1 : -1) * dt / OUT.secs));
    const k = T.outK * T.outK * (3 - 2 * T.outK);
    // (out in the field: the hull and the cabin drawn where the drill's own ship is, that ship put away; seen from
    // outside, the drill's own ship again, its arms at work)
    if (ff) {
      const rooms = k < OUT.swap;
      if (rooms) { _m.multiplyMatrices(Mn, _m.copy(S.M0).invert()); crane.fly(_m); boarding.fly(M.ship, _m); W.alone = [S.zone.id]; if (drill) drill.aboard = true; }
      else if (T.afield) { crane.fly(null); boarding.fly(M.ship, null); W.alone = []; if (drill) drill.aboard = false; }
      T.afield = rooms;
    }
    _X.multiplyMatrices(Mn, _m.copy(S.M).invert()); _Xq.setFromRotationMatrix(_X);
    cam.position.applyMatrix4(_X); cam.quaternion.premultiply(_Xq);
    if (k > 0) {
      // (behind the ship, as the flying's own view from behind has it)
      const b = SHIP.behind; _oe.set(b.look[0], b.up, -b.back).applyMatrix4(Mn); _ol.set(...b.look).applyMatrix4(Mn); _ou.set(0, 1, 0).transformDirection(Mn);
      _om.lookAt(_oe, _ol, _ou); _oq.setFromRotationMatrix(_om);
      cam.position.lerp(_oe, k); cam.quaternion.slerp(_oq, k);
    }
    if (cam.near !== AFIELD.near || cam.far !== AFIELD.far) { cam.near = AFIELD.near; cam.far = AFIELD.far; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld(true);
    // (their own figure; lying on a bed, laid along it: src/aboard.js poseOf, the ship's own frame)
    if (root && T.rest && T.rest.kind === 'lie' && crewA) { root.matrixAutoUpdate = false; root.matrix.multiplyMatrices(Mn, crewA.poseOf(T.rest, _rp)); root.matrixWorldNeedsUpdate = true; }
    else if (root) { root.matrixAutoUpdate = false; root.updateMatrix(); root.matrix.premultiply(_X); root.matrixWorldNeedsUpdate = true; }
    if (drill) drill.aim(cam, 0);      // (what the field draws by the eye: the size of its ore's glow)
  }
  function fromField() {
    if (T.afield) { T.afield = false; crane.fly(null); boarding.fly(M.ship, null); W.alone = []; if (drill) drill.aboard = false; }
    if (drill && drillOn && iDrill) el.classList.add('is-drill');
    const root = P() && P().c.root; if (root) { root.matrixAutoUpdate = true; root.updateMatrix(); root.matrixWorldNeedsUpdate = true; }
  }
  // IN THE SEAT AGAIN: the view from it as it was, and the run goes on (a part that waited for them, from there)
  function sitDown() {
    if (!T.afoot || T.done) return;
    T.afoot = false; T.out = false; T.outK = 0; seatEl.hidden = true; seatEl.dataset.as = ''; el.classList.remove('is-afoot');
    if (ctx.walk) ctx.walk(false);
    fromField();
    if (fl) fl.aside(false); if (ff) ff.fl.aside(false);
    camFresh = true;
    T.log.push('sat down');
    // (their body put back in the seat brings the game's own camera to it, in the hangar's own place: the eye is kept
    // where it was drawn, aboard, so whatever sets off from it next (the glide out to the drill) sets off from there)
    const cp = W.camera.position.clone(), cq = W.camera.quaternion.clone();
    if (stand && P()) ctx.put(stand, P().heading || 0);
    W.camera.position.copy(cp); W.camera.quaternion.copy(cq); W.camera.updateMatrixWorld(true);
  }
  // THEIR NEXT MOVE, with them on their feet: the part waits, the strip and the captain ask them back (needSeat)
  function waitSeat(theirs, line) {
    if (!theirs) return false;
    if (T.afoot && (!T.phase || T.phase === 'wantSeat')) {
      if (T.phase !== 'wantSeat') { const w = needSeat() || 'Back to your seat'; T.phase = 'wantSeat'; T.t = 0; words(w); say(line); T.log.push('waits for them: ' + steps[T.i].id); }
      return true;
    }
    if (T.phase === 'wantSeat') T.phase = steps[T.i].kind === 'work' ? 'seated' : '';
    return false;
  }
  // the seat's prompt while they are on their feet: Sit down, in the cockpit, with a seat of their own (the tuning's
  // own prompt has it while the core is being seen to)
  function paintSeat() {
    if (T.done || (steps[T.i] && steps[T.i].kind === 'tune' && T.phase === 'seat')) return;
    const inCockpit = T.afoot && !!P() && boarding.where(P().pos) === M.ship + '/cockpit', free = !(tn && tn.busy) && !T.out;
    // (their own seat in the cockpit; else any free seat or bed within reach; resting, getting up again)
    const near = T.afoot && free && !T.rest && crewA && P() && !(seatOf() && inCockpit) ? crewA.near(P().pos) : null;
    const want = T.rest ? (free ? 'rise' : '') : T.afoot && free && seatOf() && inCockpit ? 'down' : near ? 'rest' : '';
    if (want !== seatEl.dataset.as || (want === 'rest' && near !== T.near)) {
      seatEl.dataset.as = want; seatEl.hidden = !want; T.near = near;
      const ask = needSeat(), name = (p) => String(p.name || '').split(/[,(]/)[0].trim().replace(/^Bunks?\b.*$/i, 'Bunk');
      if (want === 'down') { seatEl.querySelector('b').textContent = iPilot ? 'Pilot\'s seat' : 'Your seat'; seatEl.querySelector('small').textContent = ask ? ask.replace(/: back to your seat$/, '') : 'Sit down'; seatEl.querySelector('.pnj-go').innerHTML = 'Sit down<kbd>E</kbd>'; }
      else if (want === 'rest') { seatEl.querySelector('b').textContent = name(near); seatEl.querySelector('small').textContent = near.kind === 'lie' ? 'Lie down for a while' : 'Sit down for a while'; seatEl.querySelector('.pnj-go').innerHTML = (near.kind === 'lie' ? 'Lie down' : 'Sit down') + '<kbd>E</kbd>'; }
      else if (want === 'rise') { seatEl.querySelector('b').textContent = name(T.rest); seatEl.querySelector('small').textContent = ask ? ask.replace(/: back to your seat$/, '') : T.rest.kind === 'lie' ? 'Lying down' : 'Sitting down'; seatEl.querySelector('.pnj-go').innerHTML = 'Get up<kbd>E</kbd>'; }
    }
    upEl.hidden = !canUp(); el.classList.toggle('has-seat', !seatEl.hidden);
    viewEl.hidden = !T.afoot || !!(tn && tn.busy);
    const vw = T.out ? 'Inside' : 'Outside'; if (viewEl._w !== vw) { viewEl._w = vw; viewEl.innerHTML = `${vw} <kbd>V</kbd>`; }
  }
  // THE JUMP ITSELF: the wormhole (src/wormhole.js). The tear opens in front of the ship where it is; when the colours
  // are all round the place is changed, unseen; they go on until the place ahead is made; then the far end opens on it.
  function startJump(st) {
    const toField = st.to === 'field';
    countEl.hidden = true;
    wh.begin({
      onShut() { T.inField = toField; if (toField) arriveField(); else arriveHome(); },
      // (out to the rocks: the field and its ship have to be there)
      ready: () => !toField || !!drill || !!drillErr,
      onOpen() {
        // (at the rocks his word that the drill is theirs is only for a crew member who signed for the drill)
        say(toField ? (st.mine || !iDrill ? 'there' : 'crewJump') : iPilot ? 'home' : 'homeCrew');
        // (home: the flying at the station is the pilot's again as the far end opens on the station)
        if (!toField && fl) fl.lock(false);
      },
      onDone() {
        // (at the rocks, signed for the drill: now the eye glides out of the seat to the drill's view; with the core
        // to tune first, on arrival, it stays in the seat until that is done: sitDown)
        const then = steps[T.i + 1];
        if (toField && ff && iDrill && !T.afoot && !(then && then.kind === 'tune')) ff.out(GLIDE.out);
        next();
      },
    });
  }
  // ARRIVING at the rocks (the colours all round): the station is put away from here on
  function arriveField() {
    T.view = fl ? fl.view : 'cockpit';
    if (fl) { fl.away(); fl.view = 'cockpit'; }
    space(true); camFresh = true;
    // (whatever the jobs: the drill's own Miner in the field, and the flying kept, flying it; the far end opens on the
    // field from the seat or from behind, as the view was)
    if (drillKit && !drillErr) openDrill();
  }
  // ARRIVING home (the colours all round): outside the station, in sight of it; the flying there is back, to come in and land
  function arriveHome() {
    // (whoever only watches comes home in the view they went out in: from behind the ship, unless they changed it)
    const view = ff ? ff.fl.view : iWatch ? T.view || 'cockpit' : 'cockpit';
    endDrill();
    space(false);
    // (the haul is in its canisters from here on: it is seen flown home with them as full as they came)
    if (crane.aboard) crane.aboard(T.cans ? T.cans.map((c) => c.t) : null);
    // (its controls and its guide stay put away until the far end has opened)
    if (fl) { fl.view = view; fl.arrive(); fl.lock(true); words('Jumping'); }
  }

  // THE DRILL OPERATOR'S GAME at the field (src/drillview.js): the view outside the ship, the game until the eight
  // canisters are full or the crew member heads home early, and back to the seat. What it filled is what comes home.
  // NO DARK SCREEN AND NO WORDS between the seat and that view (the top of this file): the eye glides out of the seat
  // and back (drill.glideFrom, glideTo). The view begins under the jump's flash (openDrill, from ARRIVING); if the
  // drill's own ship was not built by then, from the seat as soon as it is.
  const DRILL_AT = new THREE.Matrix4().makeRotationY(-0.62).setPosition(0, 4000, 0);
  // (the crew member's eyes in their seat, in a ship's own frame: the pilot's seat, or the other one across the ship)
  const seatEye = () => { const tall = innerHeight > innerWidth * 1.05 || innerWidth <= 640; return { eye: [iPilot ? SHIP.seat.eye[0] : -SHIP.seat.eye[0], SHIP.seat.eye[1], SHIP.seat.eye[2]], look: tall ? SHIP.seat.lookTall : SHIP.seat.look, fov: tall ? SHIP.seat.fovTall : SHIP.seat.fov }; };
  // (the flying's own view from behind, in the same frame: where the eye goes back to for whoever came out to the rocks
  // in that view, so the jump home is theirs to watch from behind too)
  const behindEye = () => { const tall = innerHeight > innerWidth * 1.05 || innerWidth <= 640, b = SHIP.behind; return { eye: [b.look[0], b.up, -b.back], look: b.look, fov: tall ? b.fovTall : b.fov }; };
  function openDrill() {
    if (drill || !drillKit) return;
    // (nothing of the parked ship or its cabin is drawn out there: the game's own Miner is far from them)
    W.alone = [];
    drill = drillKit.m.makeDrillView({ scene: W.scene, camera: W.camera, renderer: W.renderer, ship: drillKit.ship, at: DRILL_AT, crew, save, rand: ctx.rand || Math.random,
      // (who flies the ship over to a rock: the captain's pilot, or the autopilot for a crew member with the pilot's seat
      // too, who also has the button that hands them the ship: src/fieldfly.js)
      flier: iPilot ? 'The autopilot' : 'Pilot Juno', pilot: iPilot && iDrill, onFly: iPilot && iDrill ? () => { if (ff) ff.fly(); } : null,
      // (not signed for the drill: the crew's driller, in the same field: the drill's view `byCrew`. They mark a rock;
      // riding, the crew's pilot flies to it; with the pilot's seat, the crew member does, by hand)
      byCrew: iDrill ? null : { driller: driller ? driller.short : 'The driller', auto: !iPilot },
      onSay: (key, more) => { if (TALK[key] && key !== 'full' && key !== 'early') say(key, more); },
      // (the store comes home: the tonnes of each metal, in the canisters as they are; the haul's facts when it lands)
      onDone: (r) => { T.store = r.store; T.cans = r.cans; T.early = !!r.early; T.drillStats = r.stats; T.drillSecs = r.secs; T.phase = 'drillDone'; T.t = 0; say(r.early ? (iPilot ? 'early' : 'earlyCrew') : iPilot ? 'full' : 'fullCrew'); } });
    drillOn = true; if (iDrill) el.classList.add('is-drill');
    // THE FLYING, KEPT: the same flying as at the station, flying the drill's own ship. From the seat (or from behind,
    // as the view was) while the wormhole's far end opens; then the drill's view has the eye (the crew member at the
    // drill), or the flying keeps it (the crew's driller: by hand to the marked rock with the pilot's seat, `ride`
    // otherwise)
    ff = drillKit.f.makeFieldFlying({ W, drill, startFlying: flMod.startFlying, pilot: iPilot, flier: ROLES.pilot.crew, view: T.view || 'cockpit', words,
      settings: flyingOf(crew), onSettings: (set) => { setFlying(crew, set); save(crew); },
      byCrew: iDrill ? null : { hand: () => iPilot && !T.afoot && !drill.crew.hurried } });
    api.field = ff;
  }
  // THE CREW'S DRILLING, in the field itself (the crew member did not sign for the drill; the game's maker, 2026-11-19:
  // "I expected it to be the same asteroid field for everyone. If you are the pilot then the drill guy will mark one for
  // you to fly to"; and, 2026-11-18, of a pilot-only contract: "I want the pilot to fly to the rocks that the driller
  // requests, but there should be a button that also lets the pilot skip this portion (like "Return Home") in that
  // case it would be cool to see a very short cut scene of a rock getting drilled, and then it can either initiate the
  // reactor maintenance mission (if under contract for it), or it can start the jump calculation home. Flying to the
  // various asteroids might be fun, but it's not math so you don't get money"). The driller marks a rock (the drill's
  // view, byCrew); with the pilot's seat the crew member flies there by hand and the claw takes it; riding, the crew's
  // pilot flies there. The driller drills it and marks the next, two or three rocks, until the canisters are full.
  // Nothing of it pays more or less: the share is of what comes home, and all eight come home full. The skip button
  // (skip) plays the short scene: from outside the ship, the marked rock flown to and drilled, and the rest of the
  // load the crew's; then the eye glides back into the seat.
  function runCrew(dt, st) {
    if (!T.phase) {
      T.filled = 0; T.store = null; T.cans = null; T.early = false;
      if (drillErr || !drill || !ff || !drill.crew) { console.error('trip: the field never came'); abort(); return; }
      T.phase = 'crew'; T.marked = 0; drill.crew.go(); ff.ride(); countEl.hidden = false;
    }
    // (who flies to the marked rock: the crew member at the controls, by hand; on their feet, or riding, the crew's
    // pilot or the autopilot)
    if (drill.crew) drill.crew.auto(!iPilot || T.afoot || drill.crew.hurried);
    if (T.phase === 'crew') {
      const cs = drill.crew.state(), ds = drill.stage, who = driller ? driller.short : 'The driller';
      if (cs.mark != null && cs.rocks === 0 && !T.saidField) { T.saidField = true; say(iPilot ? 'fieldFly' : driller && driller.captain ? 'fieldMine' : 'field'); }
      words(ds === 'grab' || ds === 'drill' ? `${who} drills the rock` : ds === 'release' || ds === 'breakUp' || ds === 'back' ? `${who} looks for the next rock`
        : cs.mark == null && ds !== 'fly' ? `${who} looks for a rock` : iPilot && !T.afoot && !cs.hurry ? `Fly to ${who}'s rock` : `${iPilot ? 'The autopilot' : 'Juno'} flies to ${who}'s rock`);
    }
    T.filled = drill.run.full;
    countEl.querySelector('b').textContent = `${T.filled} of ${CARRIES}`;
    countEl.querySelector('em').textContent = T.filled >= CARRIES && drill.run.store ? lotsWords(sellsFor(drill.run.store()).lots) : '';
    // (the mark is on the screen while the eye is the flying's, not while they walk the rooms)
    drill.crew.shown(!T.afoot);
    // (full: the eye glides back into the seat from the short scene; already there, the run goes on)
    if (T.phase === 'drillDone') {
      if (T.scene && ff.mode === 'drill') { T.phase = 'fromDrill'; T.t = 0; drill.glideTo(T.viewWas === 'behind' ? behindEye() : seatEye(), GLIDE.back); }
      else { ff.sit(ff.fl.view); next(); return; }
    }
    if (T.phase === 'fromDrill' && (drill.glided || T.t > GLIDE.back * 2 + 2)) { ff.sit(T.viewWas === 'behind' ? 'behind' : 'cockpit'); next(); }
  }
  function runDrill(dt, st) {
    if (!T.phase) {
      T.filled = 0; T.store = null; T.cans = null; T.early = false; words('At the rocks');
      if (drillErr || !drill || !ff) { console.error('trip: the drill never came'); abort(); return; }
      T.phase = 'drill'; say('drillField');
    }
    if (drill && drillOn) { T.filled = drill.run.full; el.classList.toggle('has-panel', !!drill.panel); }
    // (done: the eye glides back down into the seat, the seat of this same ship out at the rocks; there the flying's
    // own view from the seat has it, and the jump home is worked out and made from there)
    // (back to whichever of the flying's two views they came out to the rocks in: into the seat, or behind the ship)
    if (T.phase === 'drillDone' && T.t > 2.6) { T.phase = 'fromDrill'; T.t = 0; if (ff.mode === 'hand') ff.drill(); drill.glideTo(T.view === 'behind' ? behindEye() : seatEye(), GLIDE.back); }
    if (T.phase === 'fromDrill' && (drill.glided || T.t > GLIDE.back * 2 + 2)) { ff.sit(T.view === 'behind' ? 'behind' : 'cockpit'); el.classList.remove('has-panel'); next(); }
  }
  function endDrill() {
    if (ff) { ff.close(); ff = null; api.field = null; }
    if (!drill) return;
    drillOn = false; drill.close(); drill = null; el.classList.remove('is-drill', 'is-hand'); camFresh = true;
  }
  function cleanUp() {
    // (given up on their feet out at the rocks: the cabin and their own figure drawn where the ship stands again)
    // (on their feet when the run ends at home: they stay where they stand, in the ship as it now stands)
    if (T.rest) rise();
    const wasAfoot = T.afoot && !T.aborted;
    fromField(); T.afoot = false; T.out = false; el.classList.remove('is-afoot'); if (boarding.ride) boarding.ride(M.ship, true);
    if (tn) { tn.close(); tn = null; api.tune = null; }
    seatEl.remove(); upEl.hidden = true; viewEl.hidden = true;
    endDrill(); if (drillKit) { drillKit.ship.dispose(); drillKit = null; }
    if (fl) { fl.close(); fl = null; api.fly = null; }
    jobs.show(true);
    if (panel) { panel.close(true); panel = null; }
    removeEventListener('keydown', onKey); prompt.remove();
    if (wh) { wh.dispose(); wh = null; }
    space(false);
    // (back on their feet where they stood in the cockpit, in the ship as it now stands, turned to the cabin behind the
    // seats: the way out. Short and plain: they are not seen getting up)
    if (stand && P() && !wasAfoot) { const v = new THREE.Vector3(0, 0, -1).transformDirection(S.M); ctx.put(stand, Math.atan2(v.x, v.z)); }
  }
  // (home, the crew stay aboard where they are until the crew member has left the ship: src/mission.js keeps them;
  // given up, they are gone at once and the captain is back in the station)
  function finish() { if (T.done) return; T.done = true; cleanUp(); T.endT = 0; const A = crewA; crewA = null; api.crew = null; onEnd({ payout: T.payout || null, aborted: false, secs: T.clock, aboard: A, captain: M.captain }); }
  function abort() { if (T.done) return; T.done = true; T.aborted = true; cleanUp(); crane.back(); el.remove(); if (crewA) { crewA.dispose(); crewA = null; api.crew = null; } const pp = ctx.people ? ctx.people() : null; if (pp && pp.aboard) pp.aboard(M.captain, false); onEnd({ payout: null, aborted: true, secs: T.clock }); }

  const _eye = new THREE.Vector3(), _look = new THREE.Vector3(), camLook = new THREE.Vector3(); let camFresh = true;
  const api = {
    get done() { return T.done; },
    // (in the seat, or at the core with its card up: seen through their own eyes, their body put away; and the trip
    // has them: no walking. On their feet out at the rocks neither is so)
    get seated() { return !T.done && !!T.sat && (!T.afoot || !!(tn && tn.busy)); },
    get holds() { return !T.done && (!T.afoot || !!(tn && tn.busy) || !!T.rest); },
    // (sitting on a seat or a bench aboard: the sitting clip for their own figure; lying: standing, laid along the bed)
    get clip() { return !T.done && T.rest ? (T.rest.kind === 'sit' ? 'Sit_Listen' : 'Stand_Listen') : null; },
    crew: null,    // (the crew aboard, while they are: src/aboard.js)
    fly: null,      // (the flying, while there is one: src/flying.js)
    field: null,    // (the flying at the rocks, while there is one: src/fieldfly.js)
    tune: null,     // (the core's tuning, while it is on: src/tune.js)
    update(dt) {
      T.clock += dt; T.dt = dt;
      // (the captain's bubble outlives the trip a moment)
      if (sayT > 0) { sayT -= dt; if (sayT <= 0) sayEl.classList.remove('is-on'); }
      if (T.done) { if (!T.aborted && (T.endT += dt) > 7 && el.parentNode) el.remove(); else if (!T.aborted) $('.pmt-chip').style.display = 'none'; return; }
      if (T.i < 0) next();
      T.t += dt;
      RUN[steps[T.i].kind](dt, steps[T.i]);
      if (T.done) { skipEl.hidden = true; return; }
      paintSkip(); paintSeat();
      if (fl) { fl.panel = !!panel; fl.update(dt); if (T.done) return; }
      // (at the rocks: the drill's view, the flying kept there; and the wormhole, whose two ends change the place)
      if (drill && drillOn) drill.update(dt);
      if (ff) { ff.fl.panel = !!panel; ff.update(dt); el.classList.toggle('is-hand', ff.mode === 'hand'); }
      if (wh) { wh.update(dt); if (T.done) return; }
      // (the crew aboard: what each is doing, out of the way of the crew member on their feet)
      if (crewA) crewA.update(dt, { player: T.afoot && P() ? P() : null });
    },
    // the camera: the pilot's eyes, looking out over the nose (turned clear of the job panel while it is up)
    aim(camera, dt = 1 / 60) {
      // (on their feet out at the rocks: the game's own camera follows them; at the core with its card up, the core's)
      if (T.afoot) { if (tn) tn.aim(camera, dt); camFresh = true; return; }
      // (at the rocks, signed for the drill: the drill's view, or the flying's own from the seat and flown by hand)
      if (ff) { ff.aim(camera, dt); camFresh = true; return; }
      if (drill && drillOn) { drill.aim(camera, dt); return; }
      // (near the station: the flying's own two views)
      if (fl && fl.on) { fl.aim(camera, dt); camFresh = true; return; }
      if (!api.seated || !S.M) return;
      const tall = innerHeight > innerWidth * 1.05 || innerWidth <= 640, up = !!panel;
      _eye.copy(inShip(iPilot ? SHIP.seat.eye : [-SHIP.seat.eye[0], SHIP.seat.eye[1], SHIP.seat.eye[2]])); _look.copy(inShip(tall ? (up ? SHIP.seat.lookTallPanel : SHIP.seat.lookTall) : up ? SHIP.seat.lookPanel : SHIP.seat.look));
      if (camFresh) { camLook.copy(_look); camFresh = false; } else camLook.lerp(_look, 1 - Math.exp(-3 * dt));
      camera.position.copy(_eye); camera.lookAt(camLook);
      const fov = tall ? SHIP.seat.fovTall : SHIP.seat.fov; if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    },
    // just before the picture: no haze out there (after the boarding's light has had its say)
    late() {
      // (on their feet aboard: the eye and their figure drawn where the ship is now; first, so the haze is that eye's)
      if (T.afoot && !T.done) drawAboard(T.dt || 1 / 60);
      else if (T.afield) fromField();
      if (!ff) T.afield = false;
      if (fl && fl.on) fl.late(); else if (T.space && W.scene.fog) { W.scene.fog.near = 1e4; W.scene.fog.far = 2e4; }
      // (the wormhole, round the eye: ahead is the way the nose of the ship points, whichever ship is being drawn)
      if (wh && wh.on) wh.place(W.camera, ff ? ff.matrix : fl && fl.on ? fl.matrix : S.M);
      // (the crew aboard, drawn where the ship is just now)
      if (crewA && !T.done) crewA.late(shipNow(), W.scene);
    },
    abort,
    // (the rigs: the cut-scene hurried on)
    skip(secs = 1) { T.t += secs; },
    // (the skip button, pressed: a part the crew member takes no part in)
    skipPart: () => skip(),
    get panel() { return panel; }, get drill() { return drill; },
    rig: {},
    state: () => ({ step: T.done ? 'done' : T.i < 0 ? 'start' : steps[T.i].id, phase: T.phase, t: +T.t.toFixed(2), clock: +T.clock.toFixed(2), space: T.space, field: T.inField, lamps: [...T.lamps], lit: T.lit, filled: T.filled, paused: T.paused, n: T.n, skip: skipWhat(), watch: iWatch,
      afoot: T.afoot, afield: !!T.afield, out: !!T.out, up: !upEl.hidden, seat: seatEl.hidden ? null : seatEl.dataset.as === 'tune' ? 'up' : seatEl.dataset.as, tune: tn ? tn.state() : null, strip: $('.pmt-chip').textContent, says: sayEl.classList.contains('is-on') ? $('.pmt-say p').textContent : null,
      fly: fl ? fl.state() : null, jump: wh ? wh.state() : null, ff: ff ? ff.state() : null, drill: drill ? drill.state() : null, store: T.store || null, cans: T.cans || null, early: T.early, sells: T.store ? sellsFor(T.store).pay : null, drillStats: T.drillStats || null, drillSecs: T.drillSecs || null,
      panel: panel ? panel.state() : null, landed: !!T.landed, gotUp: !!T.gotUp, stood: !!T.stood, dark: 0, crew: drill && drill.crew ? drill.crew.state() : null, aboard: aboard.map((a) => ({ id: a.id, name: a.name, jobs: [...a.jobs] })), log: T.log.slice(-12) }),
  };
  return api;
}
