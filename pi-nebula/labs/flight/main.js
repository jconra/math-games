// THE FLIGHT LAB: flying by hand, by itself. The game's own station (src/station.js), its own parked Miner and cabin
// (src/boarding.js, src/crane.js), its own outside (src/outside.js) and its own flying (src/flying.js, src/flymodel.js):
// nothing here is a copy, so a change to the flying shows here and in the game alike. No contract, no jump, no pay: the
// Miner is on its pad with the crew member in the pilot's seat.
//
// THE GAME'S MAKER asked for it so the flying can be tried by itself. What is the lab's own:
//   - "Back on the pad" and "Outside, coming home" put the ship at the two places a mining run flies from;
//   - the Jump button, offered once the ship is clear of the station as in the game, has nowhere to jump to here: it
//     puts the ship where the jump home would (outside, in sight of the station);
//   - the autopilot leaves the station from the pad and comes in to land from outside;
//   - "flip up and down" is kept in this browser (in the game it is kept with the crew member);
//   - the landing guide (the small model and its blue hologram, and the lit keys) is up whenever the ship is in
//     flight, so a hop about the hangar is enough to try it (in the game it is up coming home);
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
//
// Address switches: ?q=low|medium|high  the picture's quality; ?view=behind  start in the view from behind;
// ?hold  no clock of its own (LAB.step(dt, n)); ?rig  keeps the picture readable for a screenshot; ?seed=N  which of the
// outside's windows are lit. window.LAB: { ready, W, F (the flying), boarding, crane, outside, visit, step }.
import * as THREE from 'three';
import { loadStation } from '../../src/station.js';
import { makeWalls } from '../../src/walls.js';
import { makeBoarding, STANDS_ANYWHERE } from '../../src/boarding.js';
import { makeVisit } from '../../src/visit.js';
import { makeCrane } from '../../src/crane.js';
import { addOutside } from '../../src/outside.js';
import { startFlying } from '../../src/flying.js';
import { MINER } from '../../src/flymodel.js';
import { sound } from '../../src/sound.js';

const KEEP = 'pi-nebula.flightlab';
const q = new URLSearchParams(location.search), HOLD = q.has('hold');
const canvas = document.getElementById('c'), note = document.getElementById('note'), loading = document.getElementById('loading');
const LAB = window.LAB = { ready: false, F: null };
const kept = (() => { try { return JSON.parse(localStorage.getItem(KEEP)) || {}; } catch (e) { return {}; } })();
const keep = (s) => { try { localStorage.setItem(KEEP, JSON.stringify(s)); } catch (e) { /* blocked: not kept */ } };

const W = LAB.W = await loadStation({ canvas, quality: q.get('q'), rig: q.has('rig') || HOLD, say: (f, words) => { loading.textContent = words + '…'; } });
const walls = makeWalls(W.built, { portals: W.R.portals, apart: STANDS_ANYWHERE });
for (const d of walls.doors) if (d.locked) W.keepShut.add(d.D);
for (const D of W.built.glides || []) D.use = null;
const boarding = LAB.boarding = makeBoarding({ W, walls, quality: W.quality });
const crane = LAB.crane = makeCrane({ W, walls, boarding });
const outside = LAB.outside = addOutside(W, { seed: q.has('seed') ? +q.get('seed') || 0 : Math.floor(Math.random() * 1e6) });
// (the other two hangars, for a Miner flown into them: the alarm, the red lights, the parked ship shoved: src/visit.js)
const visit = LAB.visit = makeVisit({ W, boarding, outside });

// someone aboard: a stand-in for the crew member (no body to draw), in the Miner's hangar until its cabin is built,
// then in its cockpit, where they stay
const pad = new THREE.Vector3(...MINER.pad), body = { pos: pad.clone().add(new THREE.Vector3(4, 0.1, 8)), c: null }, eyes = [body.pos];
const ship = boarding.ships.find((s) => s.id === MINER.id);
W.camera.position.set(pad.x + 13, 3.2, pad.z + 11); W.camera.lookAt(pad.x, 2.6, pad.z);

let F = null, now = 0;
function begin() {
  const sp = boarding.spots(MINER.id); body.pos.set(...sp.rooms.cockpit);
  crane.depart();
  F = LAB.F = startFlying({ W, boarding, crane, outside, visit }, {
    cfg: MINER, goal: 'free', pilot: true, view: q.get('view') === 'behind' ? 'behind' : 'cockpit', settings: kept, guide: 'always',
    onSettings: (s) => keep(s), words: (w) => { note.textContent = w; },
    // (the stand-in for the crew member stays in the seat of the ship as it stands)
    onStand: (moved) => { body.pos.applyMatrix4(moved); },
    // (nowhere to jump to here: where the jump home would bring it out)
    onJump: () => F.arrive(), onLanded: () => { F.goal = 'free'; },
  });
  loading.remove(); LAB.ready = true;
}
document.getElementById('pad').addEventListener('click', (e) => { if (F) F.reset(); e.target.blur(); });
document.getElementById('home').addEventListener('click', (e) => { if (F) F.arrive(); e.target.blur(); });

function tick(dt) {
  now += dt;
  if (!F && ship && ship.state === 'in') begin();
  if (F) { F.update(dt); F.aim(W.camera, dt); }
  boarding.update(dt, { player: body, eyes, camera: W.camera });
  crane.update(dt, { eyes, player: body });
  if (F) F.late();
  visit.update(dt, W.camera);
  sound.ears(W.camera);      // (the alarm is heard as coming from the hangar it is in)
  outside.update(W.camera, dt);
  W.frame(dt, now, eyes);
}
let last = 0;
if (!HOLD) W.renderer.setAnimationLoop((ms) => { const dt = last ? Math.min(0.05, (ms - last) / 1000) : 1 / 60; last = ms; tick(dt); });
LAB.step = (dt = 1 / 60, n = 1) => { for (let i = 0; i < n; i++) tick(dt); };
tick(1 / 60);
