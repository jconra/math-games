// THE FLIGHT LAB: flying by hand, by itself. The game's own station (src/station.js), its own parked ships and cabins
// (src/boarding.js, src/crane.js), its own outside (src/outside.js) and its own flying (src/flying.js, src/flymodel.js):
// nothing here is a copy, so a change to the flying shows here and in the game alike. No contract, no jump, no pay: the
// ship is on its pad with the crew member in the pilot's seat.
//
// THE GAME'S MAKER asked for it so the flying can be tried by itself. What is the lab's own:
//   - "Back on the pad" and "Outside, coming home" put the ship at the two places a mining run flies from;
//   - the Jump button, offered once the ship is clear of the station as in the game, has no cards to answer and nowhere
//     else to go here: it opens the game's own wormhole (src/wormhole.js: the tear in front of the ship, the mouth, the
//     colours all round, the far end opening), which brings the ship out where the jump home would, outside and in
//     sight of the station. Each jump has its own colours;
//   - the autopilot leaves the station from the pad and comes in to land from outside;
//   - "flip up and down" is kept in this browser (in the game it is kept with the crew member);
//   - the landing guide's asking (its words under the tiny ship, and the lit keys) is up whenever the ship is in
//     flight, so a hop about the hangar is enough to try it (in the game it is up coming home);
//   - THE DASHBOARD (src/flying.js, src/dash.js) is the game's own: the tiny ship, the speed, the fuel, how far and the
//     flight time, counted here from the lift-off; there is no run, so no canisters. "Back on the pad" fills the tank
//     and starts the count again. Its three screens curve along the dashboard, and on the Miner and the Medic the life
//     support and the terminal stand up beside them (the ships' own cockpits: kit/shipparts/cockpit/bank.js). From
//     behind, the ship's goal stands life size on its pad, in blue, as the tiny ship's goal on the display;
//   - set down by hand the ship stands where it was put, as in the game; there is nobody here to get up out of the
//     seat. "Back on the pad" parks it properly again.
//   - THE OTHER TWO HANGARS are open to it here as in the game (the game's maker, 2026-11-18: "Lol, I'm sure kids will
//     try to do this and it will make them laugh, so why not. ... you would hear an alarm and red lights started
//     spinning around in the hanger and people started running around and it started saying "Safety Violation" over
//     and over in your cockpit. It would even be appropriate for the other ship to get moved around if they rammed
//     it. But it would be reset the next time they entered into the other hanger."): the same alarm and red lights,
//     the same ships to shove, the same reset once their hangar is out of sight (src/visit.js), and the ship's own
//     voice (its welcome as the power comes on, and again after "Back on the pad", which is the lab's way of sitting
//     down afresh). The station's people are not in the lab, so nobody runs about here.
//   - THE SHIP PICKER: the Miner, the Explorer or the Medic (the game's maker, 2026-11-19: "I was hoping that the ships
//     will basically all fly the same and share the same class"). Each is flown by the very same code from its own
//     data (src/fleet.js): its own pad, bay door, hull, engine's glow, cockpit, view from behind and voice. Picking one
//     loads the lab again with it (the address keeps it: ?ship=). In the game itself only the Miner is flown yet (the
//     Explorer's and the Medic's missions are still to come); here, with the Explorer or the Medic flown, the Miner
//     waits on its pad, its crane at its round (no haul flies in to land meanwhile).
//   - THE MINER SHOVED (the game's maker, 2026-11-20, SHIP2-2 B: "Shove it like the other two, with its canisters riding
//     on it. The crane takes them off wherever it ends up, the same as when you land crooked."): the Explorer or the
//     Medic flown into the Miner's hangar shoves it as it shoves the other one, its canisters riding on it, about the
//     floor its crane can unload it on; the crane waits while it slides and goes on with its round from where it ends
//     up (src/crane.js shove, src/visit.js). While the crane's grab is down at it, it is held there. It is put back with
//     the same reset as the other two.
//
// Address switches: ?ship=miner|explorer|medic  which ship; ?q=low|medium|high  the picture's quality; ?view=behind
// start in the view from behind; ?hold  no clock of its own (LAB.step(dt, n)); ?rig  keeps the picture readable for a
// screenshot; ?seed=N  which of the outside's windows are lit. window.LAB: { ready, id, cfg, W, F (the flying), hole (the
// wormhole), boarding, crane, hull, outside, visit, step }.
import * as THREE from 'three';
import { loadStation } from '../../src/station.js';
import { makeWalls } from '../../src/walls.js';
import { makeBoarding, STANDS_ANYWHERE } from '../../src/boarding.js';
import { makeVisit } from '../../src/visit.js';
import { makeCrane } from '../../src/crane.js';
import { makeHull } from '../../src/shiphull.js';
import { addOutside } from '../../src/outside.js';
import { startFlying } from '../../src/flying.js';
import { flightOf, SHIP_IDS } from '../../src/fleet.js';
import { sound } from '../../src/sound.js';
import { makeWormhole } from '../../src/wormhole.js';

const KEEP = 'pi-nebula.flightlab';
const q = new URLSearchParams(location.search), HOLD = q.has('hold');
const canvas = document.getElementById('c'), note = document.getElementById('note'), loading = document.getElementById('loading');
const kept = (() => { try { return JSON.parse(localStorage.getItem(KEEP)) || {}; } catch (e) { return {}; } })();
const keep = (s) => { try { localStorage.setItem(KEEP, JSON.stringify(s)); } catch (e) { /* blocked: not kept */ } };
// (which ship: the address, else the one last flown here, else the Miner)
const ID = SHIP_IDS.includes(q.get('ship')) ? q.get('ship') : SHIP_IDS.includes(kept.ship) ? kept.ship : 'miner';
const cfg = flightOf(ID);
const LAB = window.LAB = { ready: false, F: null, id: ID, cfg };

// THE PICKER: one button for each ship, the one flown lit; another loads the lab again with it
for (const b of document.querySelectorAll('[data-ship]')) {
  const on = b.dataset.ship === ID; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.addEventListener('click', () => { if (b.dataset.ship === ID) return; keep({ ...kept, ship: b.dataset.ship }); const u = new URL(location.href); u.searchParams.set('ship', b.dataset.ship); location.href = u.href; });
}
canvas.setAttribute('aria-label', `The ${cfg.name} on its pad in its hangar, the bay door ahead`);

const W = LAB.W = await loadStation({ canvas, quality: q.get('q'), rig: q.has('rig') || HOLD, say: (f, words) => { loading.textContent = words + '…'; } });
const walls = makeWalls(W.built, { portals: W.R.portals, apart: STANDS_ANYWHERE });
for (const d of walls.doors) if (d.locked) W.keepShut.add(d.D);
for (const D of W.built.glides || []) D.use = null;
const boarding = LAB.boarding = makeBoarding({ W, walls, quality: W.quality });
const crane = LAB.crane = makeCrane({ W, walls, boarding });
const outside = LAB.outside = addOutside(W, { seed: q.has('seed') ? +q.get('seed') || 0 : Math.floor(Math.random() * 1e6) });
// (the other two hangars, for a ship flown into them: the alarm, the red lights, the parked ship shoved: src/visit.js;
// the Miner's crane keeps the Miner, shoved, its canisters riding on it)
const visit = LAB.visit = makeVisit({ W, boarding, outside, cfg, crane });

// someone aboard: a stand-in for the crew member (no body to draw), in the ship's hangar until its cabin is built,
// then in its cockpit, where they stay
const pad = new THREE.Vector3(...cfg.pad), body = { pos: pad.clone().add(new THREE.Vector3(4, 0.1, 8)), c: null }, eyes = [body.pos];
const ship = boarding.ships.find((s) => s.id === ID);
// WHO KEEPS THE HULL WHERE IT IS FLOWN: the Miner's crane (its canisters ride with it), or the ship's own shared hull
// (src/shiphull.js). With another ship flown the Miner waits on its pad, as with a contract signed.
const hull = LAB.hull = ID === 'miner' ? crane : makeHull({ W, id: ID, kit: ship && ship.flight, boarding, eyes: () => eyes });
if (ID !== 'miner') crane.awayHeld = true;
W.camera.position.set(pad.x + 13, 3.2, pad.z + 11); W.camera.lookAt(pad.x, 2.6, pad.z);

// (the jump's own picture, as in the game: one for the lab)
const hole = LAB.hole = makeWormhole({ scene: W.scene, quality: W.quality });
let F = null, now = 0;
function begin() {
  const sp = boarding.spots(ID); body.pos.set(...sp.rooms.cockpit);
  if (ID === 'miner') crane.depart();
  // (its ways in stay up and its lift carries nobody while it is flown)
  boarding.ride(ID, false);
  F = LAB.F = startFlying({ W, boarding, crane, hull, outside, visit }, {
    cfg, goal: 'free', pilot: true, view: q.get('view') === 'behind' ? 'behind' : 'cockpit', settings: kept, guide: 'always',
    onSettings: (s) => keep({ ...kept, ...s }), words: (w) => { note.textContent = w; },
    // (the stand-in for the crew member stays in the seat of the ship as it stands)
    onStand: (moved) => { body.pos.applyMatrix4(moved); },
    // (the wormhole, as in the game; there is nowhere else to go here, so its far end opens where the jump home would
    // bring the ship out. The controls are put away from the tear until the far end has opened, as in the game)
    onJump: () => { if (hole.on) return; F.lock(true); hole.begin({ onShut: () => { F.arrive(); F.lock(true); }, onDone: () => F.lock(false) }); },
    onLanded: () => { F.goal = 'free'; },
  });
  loading.remove(); LAB.ready = true;
}
document.getElementById('pad').addEventListener('click', (e) => { if (F) F.reset(); e.target.blur(); });
document.getElementById('home').addEventListener('click', (e) => { if (F) F.arrive(); e.target.blur(); });

function tick(dt) {
  now += dt;
  if (!F && ship && ship.state === 'in') begin();
  if (F) { F.update(dt); hole.update(dt); F.aim(W.camera, dt); }
  boarding.update(dt, { player: body, eyes, camera: W.camera });
  crane.update(dt, { eyes, player: body });
  if (F) F.late();
  visit.update(dt, W.camera);
  sound.ears(W.camera);      // (the alarm is heard as coming from the hangar it is in)
  outside.update(W.camera, dt);
  if (F && hole.on) hole.place(W.camera, F.matrix);
  W.frame(dt, now, eyes);
}
let last = 0;
if (!HOLD) W.renderer.setAnimationLoop((ms) => { const dt = last ? Math.min(0.05, (ms - last) / 1000) : 1 / 60; last = ms; tick(dt); });
LAB.step = (dt = 1 / 60, n = 1) => { for (let i = 0; i < n; i++) tick(dt); };
tick(1 / 60);
