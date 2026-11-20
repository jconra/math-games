// THE DRILL OPERATOR'S GAME, drawn and played (src/drill.js is the plain part: the rocks, the metal in them, the holes,
// the canisters; src/jobs/drill.js the question asked when a rock is in the claw). Used by a captain's run at the asteroid
// field (src/trip.js, for a crew member who signed for the drill) and by itself in pi-nebula/labs/drill/. Nothing here
// is built or loaded until one of them asks.
//
// THE GAME'S MAKER (2026-11-18): "The game should be you arrive at the asteroid field, and you find juicy asteroids
// that have metal that you want. You drill it, and it starts filling up your canisters. You answer questions, if you
// get it wrong it just teaches you." "I think that there should be a chart to the side that says what each metal sells
// for (and shows its color). Then you should be able to look at the rocks and figure out which has the most of the
// most valuable metals. I'd prefer it if you could fly around and find them, instead of being presented with 7 in the
// same way each time. It might be cool if you found a promising one you could press a button to scan it and it would
// tell you exactly how much mass of each metal it has, but otherwise a low intensity scan would just shows the
// colors." "you should be able to click on an asteroid to travel over to it ... If you are the drill operator and you
// click on an asteroid that is you telling the pilot where you would like they to fly. If you are autopilot it is the
// same control." And of the claw: "it has a wrist with 3 claws right? So it is a machine, it's wrist is not limited
// like a human wrist. it's wrist can spin around on a single axis as much as it needs to. the claws just open and
// close." "The only part that shouldn't be able to be drilled is right where the claws join. But you should be able to
// drill pretty close, in between the claws." And of the canisters (2026-11-18, later that day; these words replace
// "the canisters all fill as a collective"): "the canisters don't mix ore. So if you collect 3 metals then it will
// dedicate 3 canisters to that type. If one fills up, like iron, then it gets another canister. Once each canister is
// designated then you can't except any new types of ore. At that point the player would want to top off all the
// canisters to finish the mission. If they go back early (I think that should be an option) and the canisters aren't
// all the way full, then I think we should round the level to the nearest 1/8th to make the math easier." "If there
// are no canisters empty then yes a new metal cannot be accepted ... it should stay in the rock or float out as small
// derbies."
//
// HOW IT IS DONE, plainly:
//   - THE FIELD IS A PLACE. Its rocks lie where src/drill.js put them, each at its true size, and the Miner (built
//     fresh from its own layout, as the Ship Lab builds it: legs up, its own two arms live) is among them. The eye is
//     behind the ship and a little above; a drag looks round (any way, as far as wanted; on a phone too).
//   - A TAP ON A ROCK IS WHERE TO FLY: the ship turns to it and flies over, and stops with the rock at its claw. It is
//     the same control whoever flies (the captain's pilot, or the autopilot for a crew member who has the pilot's seat
//     too).
//   - FLYING BY HAND (the same words: "If you want to fly and you signed up to be a pilot, you can click a button to
//     fly manually if you want", and "If you signed up for both there can be a button that lets you switch tasks"): a
//     crew member with the pilot's seat as well has the button "Fly manually" while looking for a rock. It hands the
//     ship to the game's own flying (src/flying.js, joined to this view by src/fieldfly.js): the same keys, sticks,
//     two views and help corner as at the station, the rocks as things to bump into. This view then only keeps the
//     field, the ship and the boxes at the side (stage 'hand'); the flying's own button brings the drill's task back.
//     A ROCK THE SHIP IS BROUGHT UP TO IS TAKEN BY THE CLAW as after a tapped trip (take): the question, then the
//     drilling, from wherever and whichever way round the ship stopped.
//   - THE LOW SCAN is always on: the ore inside every rock glows in its metal's colour, more glow for more of it. No
//     tags, no numbers and no names on the rocks. THE CHART at the side says what a tonne of each metal sells for,
//     with its colour (the one price list: src/jobs/smelter.js).
//   - THE FULL SCAN: the rock being looked at (the one the mouse was last on, or with no mouse the one nearest the
//     middle of the view) has thin corners round it, and the Scan button reads out exactly how many tonnes of each metal it holds (src/drill.js
//     scanOf). It reaches any rock that can be seen. A rock scanned keeps its readout beside it.
//   - THE QUESTION comes when the rock is in the claw, about that rock's own numbers. However it is answered, the game
//     goes on the same.
//   - DRILLING. The claw is a wrist with three fingers. The fingers shut on the rock and stay shut. A drag turns the
//     wrist about its own length, the hand and the rock together, as far and as many times round as wanted. A tap on
//     the rock drills there: the wrist turns the spot round to the cutter's side, the cutter's arm moves its wheel
//     along the rock to the spot (its joints worked out from where the wheel must be), cuts, and lifts; the wrist
//     turns the rock back, so the hole is seen where it was tapped. The glow near the hole fades, what was there goes
//     into the canisters (a metal no canister has room for stays in the rock, its glow with it, and the line along
//     the bottom says so), chips drift off, cracks spread along the rock's facets, the holes left count down, and after the
//     last the rock crumbles. A tap on a finger is not a tap on the rock. The patch at the palm, where the fingers
//     join, cannot be seen and so cannot be drilled.
//   - THE CANISTERS, top left: the row of eight is the canisters as they are (src/drill.js: one metal to a canister).
//     Each has its metal's colour, on its rim from the moment it is given to that metal and inside it up to its own
//     level; one not yet given to any metal is plain. Under the row, the tonnes of each metal aboard.
//   - HEAD HOME, under them: the button that ends the run early with what is aboard (while looking for a rock or
//     holding one, once an eighth of a tonne or more would come home). Each part-full canister's level is then
//     rounded to the nearest 1/8 of a tonne, the row shows the rounded levels, and that is what comes home.
//   - CHEAP: the ship as built (39 draws); each rock one small mesh; far rocks and pebbles one batch each; the glow one
//     batch of points; chips and pieces one batch. No lamps of its own but one sun.
//
//   const ship = await buildShip()                      the Miner, for outside (once; kept by whoever asked)
//   const V = makeDrillView({ scene, camera, renderer, root, ship, at, crew, save, rand, ask, flier, onDone, onSay })
//       flier: who flies the ship over to a rock, in words ('Pilot Juno', 'The autopilot')
//       onDone({ store (tonnes of each metal), cans (the canisters: [{ metal, t }]), early (headed home before all
//                eight were full: the store is the rounded one), sells, stats, secs })
//   V.update(dt); V.aim(camera, dt)   each frame;   V.close()   put away (the ship is the caller's to keep or dispose)
//   V.glideFrom({ eye, look, fov }, secs)   THE EYE'S WAY OUT OF THE SEAT (src/trip.js; the game's maker, 2026-11-18: "I
//       defiantly don't want a dark screen with words"): the eye starts there, in the ship's own frame (the crew
//       member's eyes in their seat), rises out of the ship and glides back to this view's own place over `secs`.
//   V.glideTo({ eye, look, fov }, secs)     ... and back: from wherever it is (close on the claw, as a rule) round to
//       this view's own place behind the ship first, then forward over the ship and down into the seat, the way it came
//       out, where it stays; V.glided says when it is there
//   V.run (src/drill.js makeRun), V.state() and V.rig (the rigs: where things are on the screen)
import * as THREE from 'three';
import { buildRoom, updateDoors, loadRoom } from '../kit/layout.js';
import { makeMaterials } from '../kit/materials.js';
import * as MB from '../kit/ships/miner-built.js';
import { POD } from '../kit/ships/miner-built.hull.js';
import { makeFlight } from '../kit/ships/flight.js';
import { openPanel } from './jobs/panel.js';
import { JOB as SCAN } from './jobs/drill.js';
import { makeRun, DRILL, ORE, SHAPES, seeded, holeWorth, scanOf, rockSells } from './drill.js';
import { sellsFor, lotsWords, tonnesWords, eighthsText } from './jobs/smelter.js';
import { priceChart } from './pricechart.js';
import { DIR } from '../world/sky.js';
import { VEIL, VEIL_GLSL } from './wormhole.js';
import { MINER, TAKE, rockNear, facing } from './flymodel.js';

// FLYING BY HAND (the game's maker: "If you want to fly and you signed up to be a pilot, you can click a button to fly
// manually if you want"). `flyEl` below is the button, shown to a crew member with the pilot's seat (opts.pilot) when
// whoever made this view can fly it (opts.onFly: src/fieldfly.js). While it is on (stage 'hand') the ship's place and
// heading are the flying's (shipTo), not a tapped rock's course, and a rock the claw's place is brought up to is taken
// (take). Switched off here, the button is never shown.
export const FLY_BY_HAND = true;

// the eye, in the ship's own frame (x to port, y up, z to the nose; metres): looking for a rock (behind the ship and a
// little above; a drag turns it about `pivot`), and working one (close on the rock in the claw, from ahead, to port
// and above: side on to the claw's hand, so the hand is seen holding the rock and going round with it, the cutter
// above them); on a wide screen and on a tall one
export const VIEWS = {
  look: { eye: [0, 12, -30], look: [0, 4.6, 40], fov: 54 }, lookTall: { eye: [0, 17, -40], look: [0, 12.5, 40], fov: 62 },
  work: { eye: [4.9, 8.2, 17.6], look: [0.1, 3.0, 8.6], fov: 37 }, workTall: { eye: [5.2, 8.6, 18.4], look: [0.25, 3.5, 8.6], fov: 47 },
  pivot: [0, 4.4, 3],
};
const ROCK_R = 1.05;       // a round rock's radius, metres ("about 2 metres" across)
const UP_Y = new THREE.Vector3(0, 1, 0), UP_X = new THREE.Vector3(1, 0, 0);
// the ways the ore can be shown (see `oreLook` in makeDrillView)
export const ORE_LOOKS = ['glow', 'veins', 'sparkle', 'dots', 'sparkle and veins', 'cracks', 'crystals'];
// the ways a rock's own skin can be drawn: its flat faces as they are, or smoothed and roughened by the shader
export const ROCK_LOOKS = ['low poly', 'natural'];
const HAND = { flat: 0, round: 0, long: 0.45 };   // how much further along the hand a rock's middle lies, by its shape (m)
// (the rocks as the flying feels them: each a ball, this much of its longest half-length)
const BALL = 0.95;
const T = { arrive: 1.4, turn: 0.3, down: 0.5, cut: 0.95, up: 0.35, breakUp: 1.7, release: 1.3, back: 0.8, full: 3.2 };   // seconds
const FLY = { speed: 26, least: 2.4, most: 9, clear: 9 };   // flying over to a rock: metres a second, the shortest and longest it takes (s), how far other rocks are kept from the ship (m)
const CAM_RATE = 2.4, SUN_K = 1.7, CUT_UP = 0.72, WHEEL = 0.4, BITE = 0.13;
// (the thrusters at the rocks: the engine's idle; a push of `full` m/s² forward is full throttle; how quickly what the
// pods are told follows the ship's own moving (a second ago's, eased); the most they are told; a move faster than `jump`
// m/s is the ship put somewhere, not flown. The canopy's glass seen from outside)
const JETS = { idle: 0.15, full: 9, ease: 6, most: 14, jump: 600, home: 0.7 }, GLASS_OUT = { opacity: 0.94, color: 0x05080c };
const GLOW_PX = [34, 50, 0.38];   // a far rock's glow, across its radius: so many of the screen's dots at so many metres, and how slowly it shrinks further off

const CSS = `
.pdr { position: fixed; inset: 0; z-index: 21; pointer-events: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; cursor: default;
  font: 400 16px/1.35 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; color: #eef1f4; overflow: hidden;
  --oct: polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px); }
.pdr * { box-sizing: border-box; }
.pdr-touch { position: absolute; inset: 58px 0 0 0; pointer-events: auto; touch-action: none; }
.pdr button { pointer-events: auto; font: inherit; border: 0; cursor: pointer; }
.pdr-side { position: absolute; left: max(12px, env(safe-area-inset-left)); top: max(64px, calc(env(safe-area-inset-top) + 64px)); display: flex; flex-direction: column; gap: 8px; align-items: flex-start; pointer-events: none; }
.pdr-box { padding: 8px 12px 9px; background: rgba(13, 17, 23, 0.84); box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.34); clip-path: var(--oct); }
.pdr-box small { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #a7b0ba; }
.pdr-cans b { font-size: 22px; font-weight: 800; }
.pdr-row { display: flex; gap: 4px; margin-top: 4px; }
.pdr-row i { width: 16px; height: 28px; border: 1.5px solid rgba(159, 178, 196, 0.6); border-radius: 3px; background: rgba(255, 255, 255, 0.04); }
.pdr-row i.is-given { border-color: var(--c); background: linear-gradient(to top, var(--c) var(--at), rgba(255, 255, 255, 0.04) var(--at)); }
.pdr .pdr-home { display: block; margin-top: 8px; height: 36px; padding: 0 14px; font-size: 13px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #e9f6ff; background: rgba(40, 47, 56, 0.92); box-shadow: inset 0 0 0 1.5px rgba(110, 225, 255, 0.6); clip-path: var(--oct); white-space: nowrap; }
.pdr-store { margin: 6px 0 0; display: flex; flex-wrap: wrap; gap: 2px 10px; max-width: 160px; font-size: 12.5px; color: #dfe6ee; }
.pdr-store:empty { display: none; }
.pdr-store span { white-space: nowrap; } .pdr-store i, .pdr-chart i, .pdr-read i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 5px; background: var(--c); box-shadow: 0 0 6px var(--c); }
.pdr-chart { display: grid; grid-template-columns: auto auto; column-gap: 12px; row-gap: 1px; align-items: baseline; font-size: 13.5px; }
.pdr-chart small { grid-column: 1 / -1; margin-bottom: 3px; }
.pdr-chart b { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
.pdr-holes { box-shadow: inset 0 0 0 1.5px rgba(110, 225, 255, 0.5); }
.pdr-holes b { font-size: 22px; font-weight: 800; } .pdr-holes span { font-size: 14px; color: #cfd8e2; margin-left: 5px; }
.pdr-hint { position: absolute; left: 50%; bottom: max(22px, env(safe-area-inset-bottom)); transform: translateX(-50%); max-width: min(560px, calc(100vw - 24px)); padding: 9px 18px 10px; text-align: center; font-size: 17px; font-weight: 600; background: rgba(13, 17, 23, 0.86); box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.3); pointer-events: none; text-wrap: balance;
  clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px); }
.pdr-hint:empty, .pdr [hidden], .pdr.has-panel .pdr-hint { display: none; }
.pdr-btn { position: absolute; right: max(14px, env(safe-area-inset-right)); bottom: max(22px, env(safe-area-inset-bottom)); height: 48px; padding: 0 18px; font-size: 15px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #06202b; background: #6ee1ff; clip-path: var(--oct); white-space: nowrap; }
.pdr-btn kbd { font: 700 10px/1 inherit; font-family: inherit; padding: 3px 5px; margin-left: 8px; border-radius: 3px; background: rgba(0, 0, 0, 0.2); vertical-align: 2px; }
.pdr-btn:disabled { color: #9fb0bd; background: rgba(40, 47, 56, 0.92); box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.3); cursor: default; }
.pdr-fly { right: auto; left: max(14px, env(safe-area-inset-left)); color: #e9f6ff; background: rgba(40, 47, 56, 0.92); box-shadow: inset 0 0 0 1.5px rgba(110, 225, 255, 0.6); }
.pdr.is-hand .pdr-touch { pointer-events: none; }
.pdr-big { position: absolute; left: 50%; top: 24%; transform: translateX(-50%); padding: 10px 22px; text-align: center; white-space: nowrap; font-size: 22px; font-weight: 800; letter-spacing: 0.05em; color: #1c1205; background: #ffc83c; pointer-events: none; animation: pdr-pop 0.5s ease;
  clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px); }
.pdr-big small { display: block; font-size: 14px; letter-spacing: 0.03em; white-space: normal; max-width: min(520px, 90vw); }
@keyframes pdr-pop { from { transform: translateX(-50%) scale(0.6); opacity: 0; } }
.pdr-eye { position: absolute; left: 0; top: 0; pointer-events: none; will-change: transform; }
.pdr-eye i { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); background:
  linear-gradient(#9fe9ff, #9fe9ff) 0 0 / 10px 2px no-repeat, linear-gradient(#9fe9ff, #9fe9ff) 0 0 / 2px 10px no-repeat, linear-gradient(#9fe9ff, #9fe9ff) 100% 0 / 10px 2px no-repeat, linear-gradient(#9fe9ff, #9fe9ff) 100% 0 / 2px 10px no-repeat,
  linear-gradient(#9fe9ff, #9fe9ff) 0 100% / 10px 2px no-repeat, linear-gradient(#9fe9ff, #9fe9ff) 0 100% / 2px 10px no-repeat, linear-gradient(#9fe9ff, #9fe9ff) 100% 100% / 10px 2px no-repeat, linear-gradient(#9fe9ff, #9fe9ff) 100% 100% / 2px 10px no-repeat; }
.pdr-read { position: absolute; left: 0; top: 0; pointer-events: none; will-change: transform; padding: 4px 9px 5px; font-size: 13px; font-weight: 600; line-height: 1.3; white-space: nowrap; color: #e9f6ff; background: rgba(4, 22, 32, 0.82); box-shadow: inset 0 0 0 1.2px rgba(110, 225, 255, 0.7); border-radius: 3px; }
.pdr-read.is-new { animation: pdr-ping 0.5s ease; }
.pdr-read div { display: flex; align-items: baseline; } .pdr-read b { font-weight: 800; margin-left: 5px; }
@keyframes pdr-ping { from { box-shadow: inset 0 0 0 1.2px #fff, 0 0 0 10px rgba(110, 225, 255, 0.5); } }
@media (max-width: 640px) {
  .pdr-hint { font-size: 15px; padding: 8px 12px 9px; bottom: max(14px, env(safe-area-inset-bottom)); }
  .pdr-btn { bottom: max(118px, calc(env(safe-area-inset-bottom) + 118px)); right: 50%; transform: translateX(50%); height: 44px; }
  .pdr-fly { left: auto; bottom: max(170px, calc(env(safe-area-inset-bottom) + 170px)); }
  .pdr-side { top: max(108px, calc(env(safe-area-inset-top) + 108px)); left: 8px; }
  .pdr-chart { position: fixed; right: 8px; top: max(108px, calc(env(safe-area-inset-top) + 108px)); font-size: 12.5px; column-gap: 8px; padding: 6px 9px 7px; }
  .pdr-big { font-size: 18px; top: 290px; white-space: normal; width: max-content; max-width: calc(100vw - 20px); } .pdr-cans b, .pdr-holes b { font-size: 19px; }
  .pdr-read { font-size: 12px; padding: 3px 7px 4px; }
}
@media (hover: none) and (pointer: coarse) { .pdr kbd { display: none; } }
.pdr.is-lab .pdr-side { top: calc(var(--pdr-top, 48px) + 8px); }
@media (max-width: 640px) { .pdr.is-lab .pdr-chart { top: calc(var(--pdr-top, 48px) + 8px); } }
@media (min-width: 641px) { .pdr.has-panel .pdr-big { left: 30%; } }
`;

// ── the Miner, for outside: built from its own layout as the Ship Lab builds it, legs up, arms folded ──
export async function buildShip() {
  const room = await loadRoom(new URL('../kit/rooms/ship-miner-built.json', import.meta.url));
  const mats = MB.grimeMaterials(makeMaterials(), { dirt: 0.85 });
  const built = buildRoom(room, mats, { bake: { voxel: 0.08, rays: 24 } });
  MB.LAB.pose(built, { gear: 1, doors: 1 }, { updateDoors });
  for (const D of built.doors) if (D.piece === 'mbArm') { D.t = D.target = 1; D.work = 0; D.grip = 0; }
  built.armsAs = null; MB.armStep(built, 'stowed', 0);
  return { built, mats, dispose() { built.dispose(); for (const m of new Set(Object.values(mats))) if (m && m.dispose) m.dispose(); } };
}

// ── a rock's look: a twenty-sided ball split up, pushed in and out by a few slow waves and a handful of craters, and
// drawn out or flattened to its shape (src/drill.js SHAPES: its long or flat way is its own z) ──
function lookOf(seed, shape = 'round') {
  const r = seeded(seed * 7 + 11), sq = (SHAPES[shape] || SHAPES.round).sq, S = { a: r() * 9, b: r() * 9, c: r() * 9, sq: [sq[0] * (0.95 + r() * 0.1), sq[1] * (0.95 + r() * 0.1), sq[2] * (0.97 + r() * 0.06)], craters: [] };
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) { const z = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - z * z); S.craters.push({ d: new THREE.Vector3(s * Math.cos(a), z, s * Math.sin(a)), a: 0.26 + r() * 0.3, h: 0.05 + r() * 0.07 }); }
  return S;
}
function radiusAt(S, n) {
  let s = 1 + 0.13 * Math.sin(n.x * 3.1 + S.a) * Math.cos(n.y * 2.7 + S.b) + 0.09 * Math.sin(n.z * 5.3 + S.c + n.x * 2.2) + 0.05 * Math.sin(n.y * 9.1 + S.a * 2);
  for (const k of S.craters) { const t = Math.acos(Math.max(-1, Math.min(1, n.dot(k.d)))) / k.a; if (t < 1) s -= k.h * (1 - t * t); else if (t < 1.3) s += k.h * 0.3 * (1 - (t - 1) / 0.3); }
  return s;
}
function rockGeo(S, detail) {
  const g = new THREE.IcosahedronGeometry(1, detail), P = g.attributes.position, n = new THREE.Vector3(), bary = new Float32Array(P.count * 3), face = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) {
    n.fromBufferAttribute(P, i).normalize(); const r = radiusAt(S, n);
    P.setXYZ(i, n.x * r * S.sq[0], n.y * r * S.sq[1], n.z * r * S.sq[2]);
    bary[i * 3 + (i % 3)] = 1;
    const f = Math.floor(i / 3), h1 = Math.abs(Math.sin(f * 12.9898 + S.a * 3.1) * 43758.5453) % 1, h2 = Math.abs(Math.sin(f * 78.233 + S.b * 1.7) * 24634.6345) % 1;
    face[i * 2] = h1; face[i * 2 + 1] = h2;
  }
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g.setAttribute('aBary', new THREE.BufferAttribute(bary, 3)); g.setAttribute('aFace', new THREE.BufferAttribute(face, 2));
  g.computeBoundingSphere();
  return g;
}
// (a number from 0 to 1 for a place, and a smooth field of them: the rock's skin, its sparkle and the dust all use it)
const NOISE_GLSL = `
float h31(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
float vn3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1.0, 0.0, 0.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 0.0)), h31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(h31(i + vec3(0.0, 0.0, 1.0)), h31(i + vec3(1.0, 0.0, 1.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 1.0)), h31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
`;
// THE DUST: a wide band of faintly glowing dust round the whole field, thickest in the rings' own plane, in drifts.
// Every rock is in front of it, so a rock is seen as a dark shape against it wherever the eye is in the field.
const DUST = { r: 560, h: 300, glow: 0.36 };      // the band's radius and height (m, about the field's middle), and how bright
const DUST_VERT = `
varying vec3 vP; varying vec3 vW;
void main() { vP = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const DUST_FRAG = `
${VEIL_GLSL}
${NOISE_GLSL}
uniform float uK; uniform float uH; varying vec3 vP; varying vec3 vW;
void main() {
  if (veiled(vW)) discard;
  float y = vP.y / (uH * 0.5), band = exp(-y * y * 3.4);
  vec3 p = vP * 0.0105; float c = vn3(p) * 0.6 + vn3(p * 2.7 + 4.0) * 0.4, drift = smoothstep(0.28, 0.82, c);
  vec3 col = mix(vec3(0.62, 0.46, 0.30), vec3(0.34, 0.50, 0.72), vn3(p * 0.6 + 9.0));
  gl_FragColor = vec4(col * band * (0.22 + 0.78 * drift) * uK, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const ROCK_VERT = `
attribute vec3 aBary; attribute vec2 aFace; varying vec3 vW; varying vec3 vL; varying vec3 vB; varying vec2 vF;
#ifdef ORE
uniform vec3 uSq; varying vec3 vN; varying mat3 vRot;
#endif
void main() {
  vL = position; vB = aBary; vF = aFace;
  #ifdef ORE
  vRot = mat3(modelMatrix);                                           // (the rock's own turn, for the natural look's bumps)
  vN = normalize(vRot * (position / (uSq * uSq)));                    // (the way out of a smooth rock of this shape)
  #endif
  #ifdef USE_INSTANCING
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  #else
  vec4 w = modelMatrix * vec4(position, 1.0);
  #endif
  vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
}`;
const ROCK_FRAG = `
${VEIL_GLSL}
uniform vec3 uSun; uniform vec3 uTint; uniform float uSunK; uniform float uLamp; uniform float uLit;
#if defined(HELD) || defined(ORE)
uniform vec3 uSq;
#endif
#ifdef HELD
uniform float uCrack; uniform vec3 uHoles[8]; uniform int uHoleN; uniform vec3 uGlow; uniform float uScan;
#endif
#ifdef ORE
// THE ORE ON THE ROCK'S OWN SURFACE (the looks 'sparkle', 'cracks' and 'crystals'; the game's maker's words are at
// oreLook, below): each vein shows where its outer end comes to the surface, as a patch as big as the metal in it.
// uVD: each vein's way out from the rock's middle; uVC: its metal's colour; uVA: the tonnes left in it; uMode: 1 the
// sparkle (very many tiny bright dots, thickest along fine cracks, a soft glow under them), 2 the cracks (the rock's
// own edges lit), 3 only the soft glow (under the crystals), 4 the dots alone (no cracks: "Just a multitude of dots"). Only what faces the eye is seen: it is the surface.
uniform vec3 uVD[5]; uniform vec3 uVC[5]; uniform float uVA[5]; uniform int uVN; uniform float uOre; uniform float uT; uniform int uMode;
uniform float uNat; varying vec3 vN; varying mat3 vRot;
uniform float uGlowK; uniform float uDotK; uniform float uDotS;
${NOISE_GLSL}
// (a rock's rough skin, anchored to the rock: big blotches, lumps, grain)
float rockH(vec3 p) { return vn3(p) * 0.55 + vn3(p * 2.3 + 7.0) * 0.28 + vn3(p * 5.3 + 3.0) * 0.17; }
// THE DOTS, AS CRISP FAR OFF AS NEAR (the look 'dots'): one tiny bright dot somewhere in each cell of a grid through
// the rock. Which grid is picked by how far off the rock is, so that a cell is always a few dots of the screen wide
// (two neighbouring grids, the finer fading into the coarser as the rock goes off), and so the dots never run
// together into a glow: a rock far off is dotted as a near one is. px: how much of the rock one dot of the screen
// covers; wide: a cell's width in dots of the screen; dens: the share of cells with a dot in; size: how big a dot.
float dotIn(vec3 g, float dens, float size, float lev) {
  vec3 cell = floor(g) + lev * 13.7, fr = fract(g) - 0.5; float rnd = h31(cell);
  vec3 off = (vec3(h31(cell + 1.3), h31(cell + 2.7), h31(cell + 4.1)) - 0.5) * 0.5;
  return smoothstep(min(0.5, 0.34 * size), 0.04, length(fr - off)) * step(1.0 - dens, rnd) * (0.72 + 0.28 * sin(uT * (1.5 + 5.0 * rnd) + rnd * 40.0));
}
float dotsAt(vec3 p, float px, float wide, float dens, float size) {
  float lr = log2(px * wide), lv = clamp(lr, -6.2, -1.2), l0 = floor(lv), f = lv - l0;
  float v = dotIn(p * exp2(-l0), dens, size, l0) * (1.0 - f) + dotIn(p * exp2(-l0 - 1.0), dens, size, l0 + 1.0) * f;
  return mix(v, dens * 0.07, smoothstep(0.3, 1.6, lr + 1.2));      // (too far off for even the coarsest grid: a faint tint in their place)
}
#endif
varying vec3 vW; varying vec3 vL; varying vec3 vB; varying vec2 vF;
void main() {
  if (veiled(vW)) discard;      // (not seen through a wormhole's colours: src/wormhole.js)
  vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
  vec3 base = uTint * (0.72 + 0.56 * vF.x);
  #ifdef ORE
  if (uNat > 0.0) {
    // A MORE NATURAL ROCK (the game's maker, 2026-11-19: "Would it be easy to give the asteroid a more natural look
    // where its not glowing? Right now it looks low poly, which I dont hate, but if it looked more real with the
    // shader that would probably be better."): the flat faces smoothed away and a rough skin worked out in their
    // place, lit by the same sun: lumps and grain that catch the light, dark and pale blotches, pits.
    // (its bumps: the slope of the rough skin, worked out in the rock's own frame and turned with the rock, so it is
    // smooth however near the eye is)
    vec3 pl = vL * 2.4; float e = 0.07, hgt = rockH(pl);
    vec3 slope = vRot * (vec3(rockH(pl + vec3(e, 0.0, 0.0)), rockH(pl + vec3(0.0, e, 0.0)), rockH(pl + vec3(0.0, 0.0, e))) - hgt) / e;
    vec3 ns = normalize(mix(n, normalize(vN), 0.93));
    n = normalize(ns - 0.34 * (slope - ns * dot(slope, ns)));
    float pit = smoothstep(0.32, 0.5, hgt);
    base = uTint * (0.55 + 0.95 * rockH(vL * 1.5 + 11.0)) * (0.66 + 0.34 * pit) * (0.94 + 0.12 * vn3(vL * 19.0));
  }
  #endif
  float d = max(dot(n, uSun), 0.0);
  // (uLit: how hard the field's light falls on a rock. The lit side comes out a cool pale grey; the side turned away
  // is a blue-grey that is dark but not black, so the whole shape of a rock is seen: the words are at LIT, below)
  vec3 c = (base * (0.06 + uSunK * d) * vec3(0.95, 1.0, 1.08) + base * vec3(0.17, 0.23, 0.36) * max(0.5 - 0.5 * dot(n, uSun), 0.0)) * uLit;
  c += base * uLamp * pow(max(dot(n, normalize(cameraPosition - vW)), 0.0), 1.5);      // (the scan's own lamp: a rock's facets read from every side)
  #ifdef ORE
  if (uOre > 0.0) {
    vec3 od = normalize(vL / uSq), ore = vec3(0.0);
    float e2 = min(vB.x, min(vB.y, vB.z)), ew = fwidth(e2), edge = 1.0 - smoothstep(ew * 0.8, ew * 2.6, e2);
    // (a fine grid through the rock: in each of its cells one tiny bright dot, somewhere in it; far off, where a cell
    // is smaller than a dot of the screen, the dots run together into their own glow)
    vec3 g = vL * 36.0, cell = floor(g), fr = fract(g) - 0.5; float gw = max(fwidth(g.x), max(fwidth(g.y), fwidth(g.z))), rnd = h31(cell);
    vec3 off = (vec3(h31(cell + 1.3), h31(cell + 2.7), h31(cell + 4.1)) - 0.5) * 0.56;
    float spark = smoothstep(min(0.5, 0.34 * uDotS), 0.04, length(fr - off)), tw = 0.72 + 0.28 * sin(uT * (1.5 + 5.0 * rnd) + rnd * 40.0), fine = 1.0 - smoothstep(0.45, 1.1, gw);
    // (how much of the rock one dot of the screen covers, the same on a face seen edge on as on one seen flat: the
    // lesser of the two ways the screen's dots are stretched over the face. For the look that is dots alone)
    vec3 da = dFdx(vL), db = dFdy(vL); float aa = dot(da, da), bb = dot(db, db), ab = dot(da, db), trc = aa + bb;
    float px = sqrt(max(0.5 * (trc - sqrt(max(trc * trc - 4.0 * (aa * bb - ab * ab), 0.0))), 1e-12));
    for (int i = 0; i < 5; i++) {
      if (i >= uVN) break;
      float amt = uVA[i];
      if (amt > 0.002) {
        // (the patch: wider for more metal, never so wide as to reach the next vein's, a right angle away)
        float ang = acos(clamp(dot(od, uVD[i]), -1.0, 1.0)), R = min(0.8, 0.13 + 0.42 * sqrt(amt)), m = 1.0 - smoothstep(R * 0.25, R, ang);
        if (m > 0.0) {
          // (uGlowK: the soft glow under it all; uDotK: how many dots; uDotS: how big: the lab's three sliders)
          float glow = 0.3 * uGlowK;
          if (uMode == 2) glow = edge * (0.7 + 1.9 * m) + 0.3 * uGlowK;
          else if (uMode == 4) {
            // the dots alone, no cracks, and no glow under them unless the lab's slider gives one: a multitude of tiny
            // ones and fewer bigger ones among them, thickest at the middle of the spot
            float dens = clamp((0.22 + 0.7 * m) * uDotK, 0.0, 0.97);
            glow = dotsAt(vL, px, 3.4, dens, uDotS) * 3.6 + dotsAt(vL + 3.7, px, 8.0, dens * 0.55, uDotS) * 4.6 + 0.3 * uGlowK;
          }
          else if (uMode == 1) {
            // fine cracks, a coarse lot and a finer one across them; the dots thickest along them
            vec3 q = vL * 3.1 + uVD[i] * 7.0; float warp = vn3(q * 1.9) * 2.0 - 1.0;
            float r1 = 1.0 - abs(vn3(q + warp * 0.7) * 2.0 - 1.0), r2 = 1.0 - abs(vn3(q * 2.3 + 5.0 - warp * 0.5) * 2.0 - 1.0);
            float line = max(smoothstep(0.74, 0.96, r1), 0.7 * smoothstep(0.80, 0.97, r2));
            float dens = clamp((0.1 + 0.8 * line + 0.25 * m) * uDotK, 0.0, 0.96);
            glow = mix(dens * 0.4, spark * step(1.0 - dens, rnd) * tw, fine) * 3.4 + line * 1.0 + 0.3 * uGlowK;
          }
          ore += uVC[i] * glow * m * min(1.25, 0.55 + 0.7 * sqrt(amt));
        }
      }
    }
    c += ore * uOre;
  }
  #endif
  #ifdef HELD
  // THE HOLES AND THE CRACKS (the game's maker, 2026-11-19: "Im also not a very big fan of the holes and cracks. The
  // holes shouldn't have a glowing ring, and the crack should either lock natural (not trangles) or not at all."):
  // a hole is a dark bore with a ragged edge, the rock a little darker round its lip, and no light round it. The cracks
  // are the broken edges between lumps of the rock (never the edges of its triangles), running out from the holes and
  // further with every hole made; dark, with no light in them.
  vec3 ld = normalize(vL / uSq);
  float ragged = (vn3(vL * 13.0 + 2.0) - 0.5) * 0.0034, nearest = -1.0;
  for (int i = 0; i < 8; i++) { if (i >= uHoleN) break; nearest = max(nearest, dot(ld, uHoles[i])); }
  if (uCrack > 0.001 && uHoleN > 0) {
    vec3 q = vL * 2.6 + 3.1; q += (vec3(vn3(q * 1.6), vn3(q * 1.6 + 5.2), vn3(q * 1.6 + 9.4)) - 0.5) * 0.7;
    vec3 ci = floor(q), cf = fract(q); float f1 = 9.0, f2 = 9.0;
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
      vec3 g = vec3(float(x), float(y), float(z)), r = g + vec3(h31(ci + g), h31(ci + g + 17.3), h31(ci + g + 41.7)) - cf; float d2 = dot(r, r);
      if (d2 < f1) { f2 = f1; f1 = d2; } else if (d2 < f2) f2 = d2;
    }
    float gap = sqrt(f2) - sqrt(f1), gw = fwidth(gap);
    // (how far from a hole they have run: a little way after the first hole, about a quarter of the way round the rock
    // when its last is made; whole by the hole, broken and thinning further off, so the rock is never tiled with them)
    float reach = mix(0.975, 0.3, clamp(uCrack * 1.6, 0.0, 1.0)), spread = smoothstep(reach, reach + 0.2, nearest + (vn3(vL * 2.3 + 7.0) - 0.5) * 0.3);
    float whole = mix(smoothstep(0.36, 0.62, vn3(vL * 2.9 + 1.7)), 1.0, smoothstep(0.90, 0.975, nearest));
    c = mix(c, vec3(0.004), (1.0 - smoothstep(0.004 + gw * 0.6, 0.016 + gw * 1.5, gap)) * spread * whole * 0.88);
  }
  for (int i = 0; i < 8; i++) {
    if (i >= uHoleN) break;
    float a = dot(ld, uHoles[i]) + ragged, h = smoothstep(0.984, 0.990, a);
    c = mix(c, c * 0.5, smoothstep(0.970, 0.985, a) * (1.0 - h));
    c = mix(c, vec3(0.003), h);
  }
  float band = 1.0 - smoothstep(0.0, 0.07, abs(vL.y - (uScan * 2.6 - 1.3)));
  c += vec3(0.25, 0.85, 1.0) * band * step(0.001, uScan) * 0.8;
  #endif
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const GLOW_VERT = `
${VEIL_GLSL}
attribute vec3 aC; attribute vec4 aCol; attribute float aSize; attribute float aR;
uniform float uPx; varying vec3 vCol; varying float vK;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0), c = modelMatrix * vec4(aC, 1.0);
  float depth = dot(w.xyz - c.xyz, normalize(cameraPosition - c.xyz)) / max(aR, 0.001);
  vK = aCol.a * mix(0.3, 1.0, smoothstep(-0.7, 0.55, depth)); vCol = aCol.rgb;
  vec4 mv = viewMatrix * w; float dist = max(0.1, -mv.z);
  mv.xyz += normalize(-mv.xyz) * aR * 1.25;      // toward the eye: drawn over its own rock, behind anything nearer
  gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aSize * uPx / dist, 3.0, 240.0);
  if (veiled(c.xyz)) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);      // (its rock is behind a wormhole's colours: not drawn)
}`;
const GLOW_FRAG = `
varying vec3 vCol; varying float vK;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0; float r2 = dot(p, p); if (r2 > 1.0) discard;
  float a = exp(-r2 * 3.2) * (1.0 - r2) * vK;
  gl_FragColor = vec4(vCol * a + vec3(1.0) * a * a * a * 0.22, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// THE CRYSTALS: small shards standing out of the rock where a vein comes to its surface, each facet its own shade of
// the metal's colour, bright at the edges and toward the point.
const CRYSTAL_VERT = `
varying vec3 vW; varying vec3 vC; varying float vH;
void main() {
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  #ifdef USE_INSTANCING_COLOR
  vC = instanceColor;
  #else
  vC = vec3(1.0);
  #endif
  vW = w.xyz; vH = position.y; gl_Position = projectionMatrix * viewMatrix * w;
}`;
const CRYSTAL_FRAG = `
${VEIL_GLSL}
varying vec3 vW; varying vec3 vC; varying float vH;
void main() {
  if (veiled(vW)) discard;
  vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); float f = abs(dot(n, normalize(cameraPosition - vW)));
  vec3 c = vC * (0.5 + 1.6 * pow(1.0 - f, 2.0) + 0.9 * smoothstep(0.1, 0.9, vH)) + vec3(1.0) * pow(f, 8.0) * 0.45;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
// THE VEINS: a flat strip from one end to the other, turned to the eye and as wide on the screen as its metal asks
// (never thinner than a hair's breadth of the picture); hard-edged, white-hot down its middle. Drawn over its own
// rock as the glow is.
const VEIN_VERT = `
${VEIL_GLSL}
attribute vec3 aO; attribute vec3 aC; attribute vec4 aCol; attribute float aW; attribute float aR; attribute vec2 aS;
uniform float uPx; uniform vec2 uHalf; varying vec3 vCol; varying float vK; varying float vU;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0), o = modelMatrix * vec4(aO, 1.0), c = modelMatrix * vec4(aC, 1.0);
  float depth = dot(w.xyz - c.xyz, normalize(cameraPosition - c.xyz)) / max(aR, 0.001);
  vK = aCol.a * mix(0.4, 1.0, smoothstep(-0.7, 0.55, depth)); vCol = aCol.rgb; vU = aS.x;
  vec4 mv = viewMatrix * w, mo = viewMatrix * o; float dist = max(0.1, -mv.z);
  mv.xyz += normalize(-mv.xyz) * aR * 1.25; mo.xyz += normalize(-mo.xyz) * aR * 1.25;      // toward the eye, as the glow
  vec4 p = projectionMatrix * mv, po = projectionMatrix * mo;
  vec2 d = (po.xy / max(po.w, 0.001) - p.xy / max(p.w, 0.001)) * uHalf; float len = length(d);
  d = len > 0.0001 ? d / len : vec2(1.0, 0.0);
  float px = max(aW * uPx / dist, 1.15);
  p.xy += vec2(-d.y, d.x) * aS.x * aS.y * px / uHalf * p.w;
  gl_Position = p;
  if (veiled(c.xyz)) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const VEIN_FRAG = `
varying vec3 vCol; varying float vK; varying float vU;
void main() {
  float u = abs(vU), edge = 1.0 - smoothstep(0.66, 0.8, u), core = 1.0 - smoothstep(0.0, 0.42, u);
  gl_FragColor = vec4(vCol * edge * vK * 1.3 + vec3(1.0) * core * vK * 0.6, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const listOf = (w) => (w.length <= 1 ? w.join('') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const say = (n) => Math.round(n).toLocaleString('en-US');
// tonnes on the screen, short: "3 t", "0.75 t"
// (the tonnes of a metal aboard: to the hundredth of a tonne during the run; in eighths, as a fraction, headed home early)
const tons = (t, eighths = false) => `${eighths ? eighthsText(t) : Math.round(t * 100) / 100} t`;

export function makeDrillView({ scene, camera, renderer, root = document.body, ship, at = new THREE.Matrix4(), crew = { id: 'lab', name: 'Driller' }, save = () => {}, rand = Math.random, ask = true, lab = false, flier = 'The pilot', pilot = false, onFly = null, onDone = () => {}, onSay = () => {}, ore = 'dots', rock = 'natural' }) {
  if (!document.getElementById('pdr-css')) { const st = document.createElement('style'); st.id = 'pdr-css'; st.textContent = CSS; document.head.appendChild(st); }
  const run = makeRun({ rand }), built = ship.built;
  // FG: the field's own frame (where `at` puts it), still. G: the ship's frame, which moves through the field.
  const FG = new THREE.Group(); FG.name = 'drill: the field'; FG.matrixAutoUpdate = false; FG.matrix.copy(at); FG.updateMatrixWorld(true); scene.add(FG);
  const G = new THREE.Group(); G.name = 'drill: the ship'; G.matrixAutoUpdate = false; G.matrix.copy(at); scene.add(G); G.add(built.group);
  const sunW = DIR.sun.clone().normalize();
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.3); sun.position.copy(new THREE.Vector3().setFromMatrixPosition(at)).addScaledVector(sunW, 200); sun.target.position.setFromMatrixPosition(at); scene.add(sun, sun.target);
  const was = { near: camera.near, far: camera.far, fov: camera.fov };
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _e = new THREE.Euler(), UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);

  // ── the ship's place in the field (metres) and how it is turned (any way round: flown by hand it may be rolled or
  // nose up; a tapped trip ends level) ──
  const here = { p: new THREE.Vector3(), q: new THREE.Quaternion(), M: new THREE.Matrix4(), inv: new THREE.Matrix4() };
  function placeShip() { here.M.compose(here.p, here.q, ONE); here.inv.copy(here.M).invert(); G.matrix.multiplyMatrices(at, here.M); G.updateMatrixWorld(true); }
  placeShip();
  // (flown by hand: the flying says where the ship is, as its kit frame in the field's: src/flying.js `body`)
  function shipTo(M) { M.decompose(here.p, here.q, _s); placeShip(); }
  const yawOf = () => { _v.set(0, 0, 1).applyQuaternion(here.q); return Math.atan2(_v.x, _v.z); };
  // THE SHIP'S THRUSTERS AND ITS ENGINE AT THE ROCKS (the game's maker, 2026-11-19, from the Drill Lab: "can you also
  // make the thrusters turn and engine and thruster jets work? Or at least work in the game if they dont."): the same
  // pods, jets and engine glow as its landing has (kit/ships/flight.js), told how the ship is moving from where it is
  // one frame and the next, so they answer a tapped trip and the flying by hand alike. Standing still with a rock in
  // the claw, the pods lie along the ship and the engine idles.
  const thr = (() => {
    const pods = built.doors.filter((D) => D.piece === 'mbPod' && D.hold == null && D.leaves.length && D.leaves[0].hinge);
    if (!pods.length) return null;
    const frame = new THREE.Matrix4().copy(pods[0].leaves[0].M).multiply(new THREE.Matrix4().makeTranslation(0, -MB.DECK, 0));
    const fx = makeFlight({ pods, podHalf: POD.size[2] / 2, swing: { yaw: 1.2, pitch: 0.62 }, nozzles: MB.jetNozzles(), jet: MB.JET, podJet: { len: MB.POD_JET.len, gain: MB.POD_JET.gain, r: MB.POD_JET.r }, frame, parent: built.group, quality: 'medium' });
    // (the field's frame to the hull's own numbers: x its left, y up, z its nose)
    const toHull = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().multiplyMatrices(built.group.matrix, frame)).invert();
    return { fx, frame, toHull, p: new THREE.Vector3(), q: new THREE.Quaternion(), v: new THREE.Vector3(), w: 0, acc: new THREE.Vector3(), spin: 0, engine: JETS.idle, had: false };
  })();
  const _fv = new THREE.Vector3(), _fa = new THREE.Vector3(), _fq = new THREE.Quaternion(), _fw = new THREE.Vector3();
  function flyStep(dt) {
    if (!thr || dt <= 0) return;
    const F = thr;
    // (put somewhere at once, as on arriving: that is not a push)
    if (!F.had || here.p.distanceTo(F.p) > JETS.jump * dt) { F.p.copy(here.p); F.q.copy(here.q); F.v.set(0, 0, 0); F.w = 0; F.had = true; }
    _fv.copy(here.p).sub(F.p).divideScalar(dt); _fa.copy(_fv).sub(F.v).divideScalar(dt); F.v.copy(_fv); F.p.copy(here.p);
    // (its turning about its own up, and how quickly that changes)
    _fq.copy(here.q).multiply(F.q.invert()); if (_fq.w < 0) _fq.set(-_fq.x, -_fq.y, -_fq.z, -_fq.w); F.q.copy(here.q);
    const ang = 2 * Math.atan2(Math.hypot(_fq.x, _fq.y, _fq.z), _fq.w), s = Math.hypot(_fq.x, _fq.y, _fq.z) || 1;
    _fw.set(_fq.x / s, _fq.y / s, _fq.z / s).multiplyScalar(ang / dt).applyQuaternion(_q.copy(here.q).invert()).applyQuaternion(F.toHull);
    const sp = (_fw.y - F.w) / dt; F.w = _fw.y;
    _fa.applyQuaternion(_q.copy(here.q).invert()).applyQuaternion(F.toHull);
    const k = 1 - Math.exp(-dt * JETS.ease);
    F.acc.lerp(_fa.clampLength(0, JETS.most), k); F.spin += (Math.max(-JETS.most, Math.min(JETS.most, sp)) - F.spin) * k;
    if (F.acc.lengthSq() < 1e-4) F.acc.set(0, 0, 0); if (Math.abs(F.spin) < 1e-3) F.spin = 0;
    F.engine += (Math.max(JETS.idle, Math.min(1, JETS.idle + Math.max(0, F.acc.z) / JETS.full)) - F.engine) * k;
    // (standing still: the pods swing back to lie along the ship)
    if (F.acc.lengthSq() === 0 && F.spin === 0) for (const p of F.fx.pods) { p.yaw -= Math.max(-JETS.home * dt, Math.min(JETS.home * dt, p.yaw)); p.pitch -= Math.max(-JETS.home * dt, Math.min(JETS.home * dt, p.pitch)); }
    F.fx.update(dt, { acc: F.acc, spin: F.spin, hold: 0, engine: F.engine, heat: 1 });
  }
  // THE CANOPY'S GLASS, SEEN FROM OUTSIDE (his words, the same evening: "we should either put the player models in the
  // seats when you look at the ship, or tint the glass much darker"): much darker from outside, so the empty seats are
  // not seen; from the seats it is the smoked glass it was. (This ship's own glass: no other ship's, no window's.)
  const glass = ship.mats && ship.mats.glass ? { mat: ship.mats.glass, opacity: ship.mats.glass.opacity, color: ship.mats.glass.color.getHex(), inside: null, inv: thr ? new THREE.Matrix4().copy(thr.frame).invert() : null } : null;
  function glassStep() {
    if (!glass) return;
    // (the eye in the hull's own numbers: under the canopy, by the seats, or not)
    _v.copy(camera.position).applyMatrix4(_m.copy(built.group.matrixWorld).invert()); if (glass.inv) _v.applyMatrix4(glass.inv);
    const C = MB.COCKPIT, inside = !!glass.inv && Math.abs(_v.x) < C.tubX + 0.5 && _v.y > MB.DECK && _v.y < MB.DECK + C.floor + 2.6 && _v.z > C.seatsZ - 1.7 && _v.z < C.seatsZ + 2.6;
    if (inside === glass.inside) return;
    glass.inside = inside; glass.mat.opacity = inside ? glass.opacity : GLASS_OUT.opacity; glass.mat.color.setHex(inside ? glass.color : GLASS_OUT.color);
  }

  // ── the rocks' materials: the ones in the field; the one in the claw (its holes, its cracks, the scan's sweep) ──
  // THE LIGHT ON THE ROCKS (the game's maker, 2026-11-19, with a picture of a field of rocks lit hard from one side by
  // a cool white light: "Can we cast a bit more light on the asteroids? They are kind of hard to see, but I dont want
  // them to look like Christmas Tree lights either."): so it is the rock itself that is lit more, not coloured lights
  // put on it. One number for every rock in the field (the Drill Lab's Light slider turns it).
  const LIT = { value: 2.8 };
  const uni = (lamp) => ({ ...VEIL, uSun: { value: sunW }, uTint: { value: new THREE.Color(0.082, 0.076, 0.071) }, uSunK: { value: SUN_K }, uLamp: { value: lamp }, uLit: LIT });
  const fieldMat = new THREE.ShaderMaterial({ uniforms: uni(0.45), vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG });
  // (a rock that holds ore has a material of its own, for the ore on its surface: the same program, its own veins)
  const oreUni = () => ({ uSq: { value: new THREE.Vector3(1, 1, 1) }, uVD: { value: Array.from({ length: 5 }, () => new THREE.Vector3(0, 1, 0)) }, uVC: { value: Array.from({ length: 5 }, () => new THREE.Color(0, 0, 0)) },
    uVA: { value: [0, 0, 0, 0, 0] }, uVN: { value: 0 }, uOre: { value: 0 }, uT: { value: 0 }, uMode: { value: 1 }, uNat: { value: 0 }, uGlowK: { value: 0.67 }, uDotK: { value: 1 }, uDotS: { value: 1 } });
  const rockMat = () => new THREE.ShaderMaterial({ defines: { ORE: '' }, uniforms: { ...uni(0.45), ...oreUni() }, vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG });
  const heldMat = new THREE.ShaderMaterial({ defines: { HELD: '', ORE: '' }, vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG,
    uniforms: { ...oreUni(), ...uni(1.25), uCrack: { value: 0 }, uHoles: { value: Array.from({ length: 8 }, () => new THREE.Vector3(0, 1, 0)) }, uHoleN: { value: 0 }, uGlow: { value: new THREE.Color(1, 1, 1) }, uSq: { value: new THREE.Vector3(1, 1, 1) }, uScan: { value: 0 } } });

  // ── beyond the field: big far rocks, and pebbles all through it (they slide by as the ship flies); a batch each ──
  // (the far ones are dim shapes against the stars, with no ore the scan can see: none of them is one to fly to)
  const farMat = new THREE.ShaderMaterial({ uniforms: { ...uni(0), uTint: { value: new THREE.Color(0.03, 0.03, 0.034) } }, vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG });
  const backdrop = (() => {
    const r = seeded(4242), g = rockGeo(lookOf(5), 1), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), out = [];
    for (const [n, big] of [[26, true], [240, false]]) {
      const im = new THREE.InstancedMesh(g, big ? farMat : fieldMat, n);
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = big ? 1400 + r() * 1200 : Math.sqrt(r()) * (DRILL.wide + 120), y = (r() - 0.5) * (big ? 700 : DRILL.thick * 2.4), k = big ? 14 + r() * 30 : 0.05 + r() * 0.2;
        p.set(Math.sin(a) * d, y, Math.cos(a) * d + DRILL.ahead);
        _e.set(r() * 6, r() * 6, r() * 6); q.setFromEuler(_e); s.set(k * (0.8 + r() * 0.5), k * (0.7 + r() * 0.4), k);
        im.setMatrixAt(i, m.compose(p, q, s));
      }
      im.frustumCulled = false; im.name = big ? 'drill: far rocks' : 'drill: pebbles'; FG.add(im); out.push(im);
    }
    return { geo: g, list: out };
  })();

  // ── the rocks of the field: one small mesh each, where the plain game put it ──
  const seen = new Map();   // rock.id -> { rock, mesh, S (its look), pos (the field's frame), q, spin }
  function addSeen(rock) {
    const S = lookOf(rock.look, rock.shape), mat = rockMat(), mesh = new THREE.Mesh(rockGeo(S, 2), mat), r = seeded(rock.look + 3);
    mat.uniforms.uSq.value.set(...S.sq);
    // (each vein's way out from the rock's middle, by its outer lump, and two ways across it: for the ore on the surface)
    const vd = rock.veins.map((V, v) => { const L = rock.lumps.find((q) => q.vein === v), d = new THREE.Vector3(...L.p).normalize(), a = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? UP_Y : UP_X).normalize(); return { d, a, b: new THREE.Vector3().crossVectors(d, a), lumps: rock.lumps.filter((q) => q.vein === v) }; });
    const o = { rock, mesh, mat, vd, S, pos: new THREE.Vector3(...rock.pos), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6)), spin: (r() - 0.5) * 0.12, tag: null };
    mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.name = 'drill: rock ' + rock.id; FG.add(mesh);
    for (const L of rock.lumps) L.show = L.ore;
    seen.set(rock.id, o); return o;
  }
  function dropSeen(id) { const o = seen.get(id); if (!o) return; FG.remove(o.mesh); o.mesh.geometry.dispose(); o.mat.dispose(); if (o.tag) o.tag.remove(); seen.delete(id); }
  function syncSeen() {
    for (const rock of run.rocks) if (!seen.has(rock.id)) addSeen(rock);
    for (const id of [...seen.keys()]) if (!run.rocks.some((r) => r.id === id) && !(H && H.rock.id === id)) dropSeen(id);
  }

  // ── the glow: one batch of soft points, in the field's frame: a point for every lump of ore and one between each
  // two of a vein, each in its metal's colour ──
  const GN = 2400, glow = (() => {
    const g = new THREE.BufferGeometry();
    for (const [k, n] of [['position', 3], ['aC', 3], ['aCol', 4], ['aSize', 1], ['aR', 1]]) { const a = new THREE.BufferAttribute(new Float32Array(GN * n), n); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, a); }
    const mat = new THREE.ShaderMaterial({ uniforms: { ...VEIL, uPx: { value: 600 } }, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.name = 'drill: the ore\'s glow'; pts.renderOrder = 5; FG.add(pts);
    return pts;
  })();
  const colOf = new Map(Object.entries(ORE).map(([k, v]) => [k, new THREE.Color(v.glow)]));
  let glowN = 0;
  // ── THE VEINS: another way of showing the same ore, to be chosen between (oreLook: 'glow', as it was, or 'veins').
  // The game's maker (2026-11-19, of the soft glow): "can we explore different glow options. The current glow is kind
  // of meh, I'd prefer to try to make it "Wow". It would be cool if it had some hard edges in it like you are taking
  // an x-ray of the mineral veins inside it." So every vein is a sharp bright line from lump to lump in its metal's
  // colour, with short twigs off each lump; thick where much metal is left, thinner as it is drilled out, gone where
  // none is; and a small hot spot at each lump. One batch of flat strips, in the field's frame; nothing else changes
  // (the ore is where it was, a hole finds what it found). ──
  // THREE MORE, ON THE ROCK'S OWN SURFACE (the game's maker, the same evening, with his picture of rocks whose ore
  // glitters along cracks: "It looks like its made with hundreds or even thousands of very tiny dots, which ends up
  // giving it sharp looking detail. Although Id prefer to see even more glow than in the example. Its also reasonable
  // that you are only seeing surface detection on the rocks, so the backside and center is hidden." ... "Would using a
  // shader help for getting an impressive glow?" and "Maybe I'd like to see your crystal and glowing line ideas too"):
  //   'sparkle'   his picture: where a vein comes to the surface, very many tiny bright dots, thickest along fine
  //               cracks, a soft glow under them; the patch as big as the metal in the vein (the rock's own shader)
  //   'cracks'    the rock's own edges lit in the metal's colour, there
  //   'crystals'  shards of the metal's colour standing out of the rock, there, with the soft glow under them
  // In these three only the side of a rock that faces the eye shows its ore: turn the rock to see the rest. A rock
  // far off, a few dots across, still shows its soft glow, so its metals can be told from a distance.
  let oreLook = ORE_LOOKS.includes(ore) ? ore : 'glow';
  // (2026-11-19, later: "I like the sparkle effect the most", so that is how the game shows the ore; "could I see views
  // in combination with sparkles?", taken as veins: 'sparkle and veins' is the sparkle with the veins' lines too)
  const onSurface = () => oreLook === 'sparkle' || oreLook === 'dots' || oreLook === 'sparkle and veins' || oreLook === 'cracks' || oreLook === 'crystals';
  const withVeins = () => oreLook === 'veins' || oreLook === 'sparkle and veins';
  // (the game's maker, 2026-11-19, of the natural skin: "I do like the natural rock." So that is how the game draws a rock)
  let rockLook = ROCK_LOOKS.includes(rock) ? rock : 'natural';
  // (the game's maker, 2026-11-19, from his phone: "with the dots can you removecthe glow, or give me some controls for
  // glow and dots": so the dots have no glow under them, and the Drill Lab has three sliders for whichever look is on:
  // glow (the soft glow under it), dots (how many), size (how big a dot). Each look's own to start with:)
  const SET_OF = { dots: { glow: 0, dots: 1, size: 1 }, cracks: { glow: 0.4, dots: 1, size: 1 }, crystals: { glow: 1, dots: 1, size: 1 } };
  const setOf = (look) => ({ glow: 0.67, dots: 1, size: 1, ...(SET_OF[look] || {}) });
  let oreSet = setOf(oreLook);
  // THE DUST (his words, the same message: "I do t like the look of the asteroid field with them all glowing. Can the
  // just look the same from far as they do close? And can we put like a glowing dust field there so we can see them
  // better?"): so a far rock has no glow of the scan's drawn over it any more in the looks on the rock's surface, and
  // a band of faintly glowing dust stands round the field for the rocks to be seen against.
  const dust = (() => {
    const mat = new THREE.ShaderMaterial({ uniforms: { ...VEIL, uK: { value: DUST.glow }, uH: { value: DUST.h } }, vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(DUST.r, DUST.r, DUST.h, 64, 1, true), mat);
    m.position.set(0, 0, DRILL.ahead); m.updateMatrix(); m.frustumCulled = false; m.renderOrder = -2; m.name = 'drill: the dust'; FG.add(m); return m;
  })();
  const veinLeft = (o, v) => { let t = 0; for (const L of o.vd[v].lumps) t += Math.max(0, L.show == null ? L.ore : L.show); return t; };
  // a rock's ore, told to its material (U: the material's uniforms; k: how bright)
  function oreOn(U, o, k) {
    const on = onSurface(); U.uOre.value = on ? k : 0; U.uNat.value = rockLook === 'natural' ? 1 : 0; if (!on) return;
    U.uMode.value = oreLook === 'cracks' ? 2 : oreLook === 'crystals' ? 3 : oreLook === 'dots' ? 4 : 1; U.uT.value = V.clock;
    U.uGlowK.value = oreSet.glow; U.uDotK.value = oreSet.dots; U.uDotS.value = oreSet.size;
    const n = Math.min(5, o.vd.length); U.uVN.value = n;
    for (let v = 0; v < n; v++) { U.uVD.value[v].copy(o.vd[v].d); U.uVC.value[v].copy(colOf.get(o.rock.veins[v].metal) || colOf.get('copper')); U.uVA.value[v] = veinLeft(o, v); }
  }
  // THE CRYSTALS: one batch of shards, in the field's frame
  const KN = 900, crystals = (() => {
    const g = new THREE.ConeGeometry(0.34, 1, 5, 1).translate(0, 0.4, 0).toNonIndexed();      // (a shard: its foot a little under the surface)
    const mat = new THREE.ShaderMaterial({ uniforms: { ...VEIL }, vertexShader: CRYSTAL_VERT, fragmentShader: CRYSTAL_FRAG });
    const im = new THREE.InstancedMesh(g, mat, KN); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(KN * 3).fill(1), 3);
    im.frustumCulled = false; im.count = 0; im.name = 'drill: the ore\'s crystals'; FG.add(im); return im;
  })();
  let crystalN = 0;
  const _km = new THREE.Matrix4(), _kr = new THREE.Matrix4(), _kq = new THREE.Quaternion(), _kn = new THREE.Vector3(), _kp = new THREE.Vector3(), _ks = new THREE.Vector3(), _kl = new THREE.Vector3();
  function crystalsOf(o, pos, q) {
    const rock = o.rock, sq = o.S.sq; _kr.compose(pos, q, _ks.setScalar(ROCK_R));
    for (let v = 0; v < Math.min(5, o.vd.length); v++) {
      const t0 = rock.veins[v].tonnes, f = t0 > 0 ? veinLeft(o, v) / t0 : 0; if (f < 0.03) continue;
      const col = colOf.get(rock.veins[v].metal) || colOf.get('copper'), big = Math.min(1.5, Math.sqrt(t0)), n = 3 + Math.round(4 * big), R = 0.12 + 0.2 * big, D = o.vd[v];
      for (let k = 0; k < n && crystalN < KN; k++) {
        const h = rock.look * 0.001 + v * 5.71 + k * 2.39, a = hash(h) * Math.PI * 2, r = R * Math.sqrt(hash(h + 1.1));
        // (a way out near the vein's own; there, the rock's own surface; the shard leans a little its own way)
        _kn.copy(D.d).multiplyScalar(Math.cos(r)).addScaledVector(D.a, Math.cos(a) * Math.sin(r)).addScaledVector(D.b, Math.sin(a) * Math.sin(r)).normalize();
        const rad = radiusAt(o.S, _kn); _kp.set(_kn.x * rad * sq[0], _kn.y * rad * sq[1], _kn.z * rad * sq[2]);
        _kl.copy(_kn).addScaledVector(D.a, (hash(h + 2.2) - 0.5) * 0.9).addScaledVector(D.b, (hash(h + 3.1) - 0.5) * 0.9).normalize();
        const size = (0.09 + 0.13 * hash(h + 3.3)) * (0.7 + 0.45 * big) * (0.35 + 0.65 * Math.min(1, f));
        _km.compose(_kp, _kq.setFromUnitVectors(UP_Y, _kl), _ks.set(size * 0.75, size * (1.3 + 1.3 * hash(h + 4.4)), size * 0.75)).premultiply(_kr);
        crystals.setMatrixAt(crystalN, _km); crystals.setColorAt(crystalN, col); crystalN++;
      }
    }
  }
  const VN = 2600, veins = (() => {
    const g = new THREE.BufferGeometry(), idx = new Uint32Array(VN * 6);
    for (const [k, n] of [['position', 3], ['aO', 3], ['aC', 3], ['aCol', 4], ['aW', 1], ['aR', 1], ['aS', 2]]) { const a = new THREE.BufferAttribute(new Float32Array(VN * 4 * n), n); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, a); }
    for (let i = 0; i < VN; i++) { idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6); const S = g.attributes.aS; S.setXY(i * 4, -1, 1); S.setXY(i * 4 + 1, 1, 1); S.setXY(i * 4 + 2, -1, -1); S.setXY(i * 4 + 3, 1, -1); }
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({ uniforms: { ...VEIL, uPx: { value: 600 }, uHalf: { value: new THREE.Vector2(640, 360) } }, vertexShader: VEIN_VERT, fragmentShader: VEIN_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.name = 'drill: the ore\'s veins'; m.renderOrder = 5; FG.add(m);
    return m;
  })();
  let veinN = 0;
  const _va = new THREE.Vector3(), _vb = new THREE.Vector3(), frac = (x) => x - Math.floor(x), hash = (n) => frac(Math.sin(n * 12.9898 + 4.1414) * 43758.5453);
  // one strip from a to b (the rock's own places, its radius 1), w wide (the rock's radius 1), so bright
  // (wa, wb: how wide it is at a and at b, of w: a strip that ends in the open runs to a point there)
  function strip(o, pos, q, big, a, b, w, col, k, wa = 1, wb = 1) {
    if (veinN >= VN) return;
    const A = veins.geometry.attributes, sq = o.S.sq, R = 0.92 * ROCK_R * big;
    _va.set(a[0] * sq[0], a[1] * sq[1], a[2] * sq[2]).multiplyScalar(R).applyQuaternion(q).add(pos);
    _vb.set(b[0] * sq[0], b[1] * sq[1], b[2] * sq[2]).multiplyScalar(R).applyQuaternion(q).add(pos);
    for (let i = 0; i < 4; i++) {
      const n = veinN * 4 + i, P = i < 2 ? _va : _vb, O = i < 2 ? _vb : _va;
      A.position.setXYZ(n, P.x, P.y, P.z); A.aO.setXYZ(n, O.x, O.y, O.z); A.aC.setXYZ(n, pos.x, pos.y, pos.z);
      A.aCol.setXYZW(n, col.r, col.g, col.b, k); A.aW.setX(n, w * (i < 2 ? wa : wb) * ROCK_R * big); A.aR.setX(n, ROCK_R * 1.1 * big);
    }
    veinN++;
  }
  // a rock's veins (twigs: only for a rock near enough for them to be seen)
  function veinsOf(o, pos, q, k, twigs = true, big = 1) {
    const rock = o.rock, L = rock.lumps, wide = (ore) => 0.02 + 0.042 * Math.min(1.5, Math.sqrt(Math.max(0, ore) / 0.11));
    for (let i = 0; i < L.length; i++) {
      const a = L[i], col = colOf.get(a.metal) || colOf.get('copper'), fa = a.ore0 > 0 ? a.show / a.ore0 : 0;
      if (i + 1 < L.length && L[i + 1].vein === a.vein) {
        const b = L[i + 1], least = Math.min(a.show, b.show), f = Math.min(fa, b.ore0 > 0 ? b.show / b.ore0 : 0);
        // (the vein's own two ends run to a point: "I don't really like how they have blunt ends")
        if (f > 0.02) strip(o, pos, q, big, a.p, b.p, wide(least), col, k * (0.45 + 0.55 * Math.min(1, f)), i === 0 || L[i - 1].vein !== a.vein ? 0.2 : 1, i + 2 >= L.length || L[i + 2].vein !== a.vein ? 0.2 : 1);
      }
      if (!twigs || fa <= 0.02) continue;
      for (let t = 0; t < 3; t++) {
        const h = rock.look * 0.001 + i * 7.31 + t * 3.17, th = hash(h) * Math.PI * 2, z = hash(h + 1.7) * 2 - 1, r = Math.sqrt(1 - z * z), len = 0.12 + 0.17 * hash(h + 2.9);
        const e = [a.p[0] + r * Math.cos(th) * len, a.p[1] + z * len, a.p[2] + r * Math.sin(th) * len], m = Math.hypot(e[0], e[1], e[2]);
        if (m > 0.9) { e[0] *= 0.9 / m; e[1] *= 0.9 / m; e[2] *= 0.9 / m; }
        strip(o, pos, q, big, a.p, e, wide(a.show) * 0.5, col, k * (0.35 + 0.45 * Math.min(1, fa)), 1, 0.08);
      }
    }
  }
  // (pos, q: the rock's place and turn in the field's frame; k: how bright; big: how many times larger than life its
  // glow is drawn. A rock far off is a few dots across on the screen, so the scan draws its ore spread wider than the
  // rock itself, each vein's colour still apart from the next: the scan's picture of it, over the rock.)
  function glowOf(o, pos, q, k, between = true, big = 1) {
    const A = glow.geometry.attributes, rock = o.rock, sq = o.S.sq, dot = withVeins() ? 0.42 : 1;
    if (withVeins()) { veinsOf(o, pos, q, k, between, big); between = false; if (oreLook !== 'veins') return; }
    const put = (p, ore, ore0, col) => {
      if (glowN >= GN || ore0 <= 0) return;
      const f = Math.max(0, ore / ore0), amt = Math.min(1.5, Math.sqrt(Math.max(0, ore) / 0.11));
      if (f < 0.02) return;
      _v.set(p[0] * sq[0], p[1] * sq[1], p[2] * sq[2]).multiplyScalar(0.92 * ROCK_R * big).applyQuaternion(q).add(pos);
      A.position.setXYZ(glowN, _v.x, _v.y, _v.z); A.aC.setXYZ(glowN, pos.x, pos.y, pos.z);
      // (in the veins' look the soft spots are small hot ones at the lumps: `dot`)
      A.aCol.setXYZW(glowN, col.r, col.g, col.b, k * (0.1 + 0.5 * amt) * (dot < 1 ? 1.5 : 1)); A.aSize.setX(glowN, ROCK_R * big * dot * (0.2 + 0.21 * Math.cbrt(ore0 / 0.11)) * (0.5 + 0.5 * Math.min(1.2, f))); A.aR.setX(glowN, ROCK_R * 1.1 * big);
      glowN++;
    };
    let prev = null;
    for (const L of rock.lumps) {
      const col = colOf.get(L.metal) || colOf.get('copper');
      put(L.p, L.show, L.ore0, col);
      if (between && prev && prev.vein === L.vein) put([(prev.p[0] + L.p[0]) / 2, (prev.p[1] + L.p[1]) / 2, (prev.p[2] + L.p[2]) / 2], Math.min(prev.show, L.show) * 0.7, Math.min(prev.ore0, L.ore0) * 0.7, col);
      prev = L;
    }
  }

  // ── chips from the hole, and the pieces of a rock crumbling: one batch of small lumps, in the ship's frame ──
  const CN = 72, chips = new THREE.InstancedMesh(rockGeo(lookOf(9), 0), fieldMat, CN), bits = [];
  chips.frustumCulled = false; chips.name = 'drill: chips'; chips.count = 0; G.add(chips);
  function chip(p, v, size, life) { if (bits.length >= CN) bits.shift(); bits.push({ p: p.clone(), v: v.clone(), size, life, t: 0, spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(4), rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0) }); }
  function stepChips(dt) {
    for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.t += dt; if (b.t >= b.life) { bits.splice(i, 1); continue; } b.p.addScaledVector(b.v, dt); b.rot.x += b.spin.x * dt; b.rot.y += b.spin.y * dt; }
    chips.count = bits.length;
    bits.forEach((b, i) => { const k = b.size * Math.min(1, (b.life - b.t) / 0.5); _q.setFromEuler(b.rot); chips.setMatrixAt(i, _m.compose(b.p, _q, _s.set(k, k * 0.8, k))); });
    chips.instanceMatrix.needsUpdate = true;
  }

  // ── the arms: the claw's hand and the cutter, in the ship's frame ──
  let H = null;   // the rock in the claw: { rock, o (its record), mesh, centre, q (its turn, the ship's frame), qPalm (how it lies in the hand), grip (the fingers' angles shut on it), turn (the wrist's), ... }
  const heldPos = new THREE.Vector3(0, 2.94, 8.54), cutDir = new THREE.Vector3(0, 1, 0);
  const armDoors = built.doors.filter((D) => D.piece === 'mbArm');
  const sideOf = (D) => ((D.leaves[0] && D.leaves[0].meshes[0].name.split(':')[2]) || '');
  const clawD = armDoors.find((D) => sideOf(D) === MB.ARMS.claw), cutD = armDoors.find((D) => D !== clawD);
  const clawSide = MB.ARMS.claw, cutSide = cutD ? sideOf(cutD) : '', clawDesign = MB.ARMS.design;
  built.rockOn = true; built.armsAs = null;
  // (the arms' own stand-in rock is never drawn: ours takes its place. Where the hand holds a rock, heldPos, is read
  // once, with the claw on the rock: armsHome)
  function standIn(read = false) {
    const r = built.rocks && Object.values(built.rocks)[0]; if (!r) return;
    r.visible = false; if (read) { _m.multiplyMatrices(built.group.matrix, r.matrix); heldPos.setFromMatrixPosition(_m); }
  }
  const _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _pp = new THREE.Vector3(), _ps = new THREE.Vector3();
  // (the palm's way round, in the ship's frame, for a turn of the wrist)
  function palmQ(turn, out = new THREE.Quaternion()) { const M = MB.palmOf(built, { [clawSide]: { turn } }); if (!M) return out.identity(); _pm.multiplyMatrices(built.group.matrix, M).decompose(_pp, out, _ps); return out; }
  // (the cutter's wheel, its middle, in the ship's frame, for its arm's joints)
  const wheelAt = (q) => { const p = MB.wheelOf(built, { [cutSide]: q }); return p ? p.applyMatrix4(built.group.matrix) : new THREE.Vector3(); };
  // THE WRIST'S ONE AXIS (the hand's own length, through the rock's middle), which way a turn counts along it, where
  // the cutter's wheel is when it is on the rock's top, and the cutter's joints while it waits just above: read once
  // from the arms' own poses
  const wristAxis = new THREE.Vector3(0, 0, 1), cutWait = { yaw: 0, shoulder: 0, elbow: 0, wrist: 0 }, cutWork = { yaw: 0, shoulder: 0, elbow: 0, wrist: 0 };
  let wristSign = 1;
  const JOINTS = ['yaw', 'shoulder', 'elbow', 'wrist'];
  (function armsHome() {
    if (!cutD || !clawD) return;
    const keep = [cutD.work, cutD.t, clawD.work, clawD.t];
    cutD.work = clawD.work = 1; cutD.t = clawD.t = 0; MB.armShow(built, 0); standIn(true);
    const q0 = palmQ(0), q1 = palmQ(0.3); wristAxis.set(0, 0, 1).applyQuaternion(q0).normalize();
    q1.multiply(q0.clone().invert()); wristSign = (q1.x * wristAxis.x + q1.y * wristAxis.y + q1.z * wristAxis.z) * (q1.w < 0 ? -1 : 1) >= 0 ? 1 : -1;
    const a1 = MB.armAngles('cutter', cutSide, 0, 1, 0, 0), a0 = MB.armAngles('cutter', cutSide, 0, CUT_UP, 0, 0);
    for (const k of JOINTS) { cutWork[k] = a1[k] || 0; cutWait[k] = a0[k] || 0; }
    _v.copy(wheelAt(cutWork)).sub(heldPos); if (_v.lengthSq() > 0.01) cutDir.copy(_v).normalize();
    [cutD.work, cutD.t, clawD.work, clawD.t] = keep; MB.armShow(built, 0); standIn();
  })();
  // THE CUTTER'S JOINTS for its wheel's middle to be at `target` (the ship's frame): worked out a small step at a time
  // from the pose on the rock's top toward the place wanted. The arm is at nearly its full stretch on the rock's top,
  // so toward the rock's two ends its joints alone leave the wheel a little short (`miss`, metres; `ext`, the way
  // still to go): the arm's last link then slides out on a short boom by that much (boomTo), so the wheel is at the
  // spot wherever it was tapped. -> { yaw, shoulder, elbow, wrist, miss, ext }
  function cutterTo(target) {
    const r = solve({ ...cutWork }, target);
    r.ext = r.miss > 0.01 ? target.clone().sub(wheelAt(r)) : null;
    return r;
  }
  // (the cutter's wrist joint, in the ship's frame: the middle of the circle its wheel goes round as the wrist turns)
  function cutWristAt(q) {
    const A = wheelAt({ ...q, wrist: q.wrist - 0.7 }), B = wheelAt(q), C = wheelAt({ ...q, wrist: q.wrist + 0.7 }), a = A.sub(C), b = B.clone().sub(C), n = new THREE.Vector3().crossVectors(a, b), d = 2 * n.lengthSq();
    if (d < 1e-9) return B;
    return new THREE.Vector3().crossVectors(b.clone().multiplyScalar(a.lengthSq()).sub(a.clone().multiplyScalar(b.lengthSq())), n).multiplyScalar(1 / d).add(C);
  }
  // THE CUTTER'S BOOM: the arm's last link (its hand and its wheel) slid out from its wrist by `ext` (the ship's frame),
  // on a plain steel rod (pale, so it is seen against the dark rock: the wheel never looks loose from its arm). null:
  // slid home, no rod.
  const boom = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xaab0b8, roughness: 0.5, metalness: 0.25 })); boom.visible = false; boom.matrixAutoUpdate = false; boom.name = 'drill: the cutter\'s boom'; G.add(boom);
  const cutEnd = cutD ? cutD.leaves.filter((L) => L.meshes[0] && /arm (hand|wheel-[a-z]+):/.test(L.meshes[0].name)) : [];
  const _bm = new THREE.Matrix4(), _bt = new THREE.Matrix4(), _bv = new THREE.Vector3();
  function boomTo(ext, q) {
    if (!ext || ext.lengthSq() < 1e-6 || !q) { boom.visible = false; return; }
    const len = ext.length(); _bv.copy(ext).transformDirection(_bm.copy(built.group.matrix).invert()).multiplyScalar(len); _bt.makeTranslation(_bv.x, _bv.y, _bv.z);
    for (const L of cutEnd) for (const im of L.meshes) { im.getMatrixAt(L.index, _bm); _bm.premultiply(_bt); im.setMatrixAt(L.index, _bm); im.instanceMatrix.needsUpdate = true; }
    const W = cutWristAt(q); _q.setFromUnitVectors(_bv.set(0, 0, 1), _v.copy(ext).normalize());
    boom.matrix.compose(W.addScaledVector(ext, 0.5), _q, _s.set(0.16, 0.16, len + 0.24)); boom.matrixWorldNeedsUpdate = true; boom.visible = true;
  }
  function solve(q, target) {
    const e = new THREE.Vector3(), J = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], d = 1e-3, L2 = 0.004;
    let miss = Infinity, bestQ = { ...q }, bestMiss = Infinity;
    for (let it = 0; it < 70; it++) {
      const f = wheelAt(q); e.subVectors(target, f); miss = e.length();
      if (miss < bestMiss) { bestMiss = miss; bestQ = { ...q }; }
      if (miss < 0.004) break;
      JOINTS.forEach((k, j) => { const was = q[k]; q[k] = was + d; J[j].copy(wheelAt(q)).sub(f).multiplyScalar(1 / d); q[k] = was; });
      // (J Jt + L2 I) y = e, then the joints' step is Jt y
      const A = [[L2, 0, 0], [0, L2, 0], [0, 0, L2]], ax = ['x', 'y', 'z'];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let j = 0; j < 4; j++) A[r][c] += J[j][ax[r]] * J[j][ax[c]];
      const b = [e.x, e.y, e.z];
      for (let i = 0; i < 3; i++) { let pv = i; for (let r = i + 1; r < 3; r++) if (Math.abs(A[r][i]) > Math.abs(A[pv][i])) pv = r; [A[i], A[pv]] = [A[pv], A[i]]; [b[i], b[pv]] = [b[pv], b[i]]; for (let r = i + 1; r < 3; r++) { const k = A[r][i] / A[i][i]; for (let c = i; c < 3; c++) A[r][c] -= k * A[i][c]; b[r] -= k * b[i]; } }
      const y = [0, 0, 0]; for (let i = 2; i >= 0; i--) { let sum = b[i]; for (let c = i + 1; c < 3; c++) sum -= A[i][c] * y[c]; y[i] = sum / A[i][i]; }
      let big = 0; const step = JOINTS.map((k, j) => { const v = J[j].x * y[0] + J[j].y * y[1] + J[j].z * y[2]; big = Math.max(big, Math.abs(v)); return v; }), cut = big > 0.3 ? 0.3 / big : 1;
      JOINTS.forEach((k, j) => { q[k] += step[j] * cut; });
    }
    return { ...bestQ, miss: bestMiss };
  }
  // the fingers' angles shut on the rock as it lies in the hand (worked out against the rock's own shape)
  const _gp = new THREE.Vector3(), _gq = new THREE.Quaternion();
  function gripNow() {
    const S = H.o.S, at0 = MB.CLAWS[clawDesign].rock + H.off; _gq.copy(H.qPalm).invert();
    return MB.gripOn(clawDesign, (p) => {
      _gp.set(p.x, p.y, p.z - at0).applyQuaternion(_gq).multiplyScalar(1 / ROCK_R); _gp.set(_gp.x / S.sq[0], _gp.y / S.sq[1], _gp.z / S.sq[2]);
      const L = _gp.length(); return L < radiusAt(S, _gp.multiplyScalar(1 / (L || 1)));
    }, { hinge: 0.2 });
  }
  // the claw takes this rock: where it will lie in the hand (its long or flat way along the hand), the fingers' hold
  function hold(o) {
    const rock = o.rock, mesh = new THREE.Mesh(rockGeo(o.S, 3), heldMat);
    mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.name = 'drill: the rock in the claw'; G.add(mesh);
    o.mesh.visible = false;
    const U = heldMat.uniforms; U.uSq.value.set(...o.S.sq); U.uGlow.value.copy(colOf.get(Object.keys(rock.metals)[0]) || colOf.get('copper')); U.uHoleN.value = 0; U.uCrack.value = 0; U.uScan.value = 0;
    const off = HAND[rock.shape] || 0;
    // (where the rock is as the claw comes onto it, in the ship's frame: at the claw's place after a tapped trip, up to
    // TAKE.reach from it when the ship was flown up to it by hand)
    const from = o.pos.clone().applyMatrix4(here.inv);
    H = { rock, o, mesh, off, centre: from.clone(), q: new THREE.Quaternion().copy(here.q).invert().multiply(o.q), from: null,
      qPalm: new THREE.Quaternion().setFromAxisAngle(_v.set(0, 0, 1), (rock.look % 628) / 100), grip: null, turn: 0, vel: 0, t0: 0, t1: 0, cut: null, settle: 0 };
    V.crackTo = 0;
    H.from = { q: H.q.clone(), p: from };
    const t0 = performance.now(); H.grip = gripNow(); H.gripMs = performance.now() - t0;
  }
  function dropHeld() { if (!H) return; G.remove(H.mesh); H.mesh.geometry.dispose(); const id = H.rock.id; H = null; dropSeen(id); }

  // ── the picture over it: the store and the chart at the side, the holes left, the hint, the buttons, the corners
  // round the rock looked at, a readout by each rock the full scan has read ──
  const el = document.createElement('div'); el.className = 'pdr' + (lab ? ' is-lab' : '');
  el.innerHTML = `<div class="pdr-touch"></div><div class="pdr-reads"></div><div class="pdr-eye" hidden><i></i></div>
    <div class="pdr-side"><div class="pdr-box pdr-cans"><small>Canisters full</small><b></b><div class="pdr-row">${'<i></i>'.repeat(DRILL.cans)}</div><p class="pdr-store"></p><button type="button" class="pdr-home" hidden>Head home</button></div>
      <div class="pdr-box pdr-chart">${priceChart()}</div>
      <div class="pdr-box pdr-holes" hidden><b></b><span></span></div></div>
    <div class="pdr-big" hidden></div><div class="pdr-hint"></div>
    <button type="button" class="pdr-btn pdr-scan" hidden>Scan this rock<kbd>S</kbd></button><button type="button" class="pdr-btn pdr-done" hidden>Done with this rock</button>
    <button type="button" class="pdr-btn pdr-fly" hidden>Fly manually<kbd>M</kbd></button>`;
  root.appendChild(el);
  const $ = (s) => el.querySelector(s), readsEl = $('.pdr-reads'), eyeEl = $('.pdr-eye'), cansB = $('.pdr-cans b'), cansI = [...el.querySelectorAll('.pdr-row i')], storeEl = $('.pdr-store'), homeEl = $('.pdr-home'), holesEl = $('.pdr-holes'), hintEl = $('.pdr-hint'), doneEl = $('.pdr-done'), scanEl = $('.pdr-scan'), bigEl = $('.pdr-big');
  const sideEls = [...el.querySelectorAll('.pdr-side .pdr-box')];      // (the boxes at the side: a readout keeps clear of them)
  // (the "fly manually" button: FLY_BY_HAND above; shown while looking for a rock)
  const flyEl = $('.pdr-fly'), canFly = FLY_BY_HAND && pilot && !!onFly; flyEl.hidden = true;
  let flyAt = 0;
  const fly = () => { if (flyEl.hidden) return; onFly(); };
  flyEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  flyEl.addEventListener('pointerup', (e) => { e.stopPropagation(); flyAt = performance.now(); fly(); });
  flyEl.addEventListener('click', (e) => { e.stopPropagation(); if (performance.now() - flyAt > 600) fly(); });
  // (the line along the bottom: what to do now; or, for a few seconds, what just happened)
  let hintFor = '', hintT = 0;
  const hint = (w, secs = 0) => { if (secs) { hintT = secs; hintEl.textContent = w; } else { hintFor = w; if (hintT <= 0 && hintEl.textContent !== w) hintEl.textContent = w; } };
  let bigT = 0; const shownT = Array(DRILL.cans).fill(0);      // (each canister's level as drawn, easing up to what is in it)
  const big = (html, secs = 3.2) => { bigEl.innerHTML = html; bigEl.hidden = false; bigT = secs; };

  // ── the game's state ──
  const V = { stage: 'arrive', t: 0, sub: '', subT: 0, clock: 0, asked: false, eyed: null, pinned: null, mouse: null, log: [], lastHole: null, trip: null };
  let panel = null, closeIn = -1, armsWant = 'reach', spin = 0, scanT = 0, closed = false, cutQ = null;
  const look = { yaw: 0, pitch: 0 };      // the eye turned by the player's drag, while looking for a rock
  const cam = { eye: new THREE.Vector3(), look: new THREE.Vector3(), fov: 46, fresh: true }, want = { eye: new THREE.Vector3(), look: new THREE.Vector3(), fov: 46 };
  // (the eye's glide out of the seat, or back into it: the top of this file)
  let glide = null;
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  // (wait: it stays where it starts until glideGo(): the far end of a wormhole is opening in front of the ship)
  function glideFrom({ eye, look, fov }, secs = 2, wait = false) { glide = { out: true, t: 0, secs, wait, eye: new THREE.Vector3(...eye), look: new THREE.Vector3(...look), fov, done: false }; cam.fresh = false; cam.eye.copy(glide.eye); cam.look.copy(glide.look); cam.fov = fov; }
  function glideGo() { if (glide) glide.wait = false; }
  // the eye taken up from wherever the camera is now (the flying's view): it eases to this view's own place from there
  function eyeFrom(c) { glide = null; _m.copy(G.matrix).invert(); cam.eye.copy(c.position).applyMatrix4(_m); c.getWorldDirection(_v).multiplyScalar(40).add(c.position); cam.look.copy(_v).applyMatrix4(_m); cam.fov = c.fov; cam.fresh = false; look.yaw = look.pitch = 0; }
  function glideTo({ eye, look, fov }, secs = 1.5) {
    const P = viewOf('look'), spot = (e, l, f) => ({ eye: new THREE.Vector3(...e), look: new THREE.Vector3(...l), fov: f });
    glide = { out: false, t: 0, done: false, from: { eye: cam.eye.clone(), look: cam.look.clone(), fov: cam.fov }, legs: [{ to: spot(P.eye, P.look, P.fov), secs: secs * 0.9, round: true }, { to: spot(eye, look, fov), secs, down: true }] };
  }
  const go = (stage) => { V.stage = stage; V.t = 0; V.sub = ''; V.subT = 0; V.log.push(stage); };
  const looking = () => V.stage === 'look' || V.stage === 'arrive' || V.stage === 'back';

  // ── the question: the job panel with one of the drill ladder's cards, about the rock in the claw. Whatever the
  // answer, the game goes on the same ──
  const link = {
    now: () => (H ? { rock: H.rock, cans: { full: run.full, of: DRILL.cans } } : null),
    head: () => `<header class="pnj-cardtop is-jump"><span class="pnj-icon is-jump" aria-hidden="true"></span><b>Rock scan</b><small>${H ? esc(cap(SHAPES[H.rock.shape].word)) : ''}</small></header>`,
    right() { closeIn = 0.95; },
  };
  function openAsk() {
    V.asked = false; closeIn = -1;
    if (!ask) { asked(); return; }
    panel = openPanel(root, { job: SCAN, crew, live: link, pay: false, onSave: () => save(crew), onCredits: () => {}, onClose: () => { if (panel) { panel = null; asked(); } } });
    el.classList.add('has-panel');
  }
  function asked() { if (V.asked) return; V.asked = true; el.classList.remove('has-panel'); run.asked(); }
  // (put away: while it fades it takes no taps, so the first tap on the rock is the rock's)
  const closePanel = () => { if (!panel) return; const p = panel; panel = null; for (const c of p.el.children) c.style.pointerEvents = 'none'; p.close(true); el.classList.remove('has-panel'); };

  // ── finding: a tap on a rock is where to fly; the full scan of the rock looked at ──
  function pick(id) {
    if (V.stage !== 'look') return false;
    const o = seen.get(id); if (!o || !run.pick(id)) return false;
    // the course: the ship turns to the rock and flies straight to where its claw's place is on the rock
    // (it ends level, its nose toward the rock, however the ship was left turned)
    const d = _v.copy(o.pos).sub(here.p), yaw1 = Math.hypot(d.x, d.z) > 1 ? Math.atan2(d.x, d.z) : yawOf(), q1 = new THREE.Quaternion().setFromAxisAngle(UP, yaw1);
    const p1 = o.pos.clone().sub(_v2.copy(heldPos).applyQuaternion(q1)), far = p1.distanceTo(here.p);
    V.trip = { o, p0: here.p.clone(), p1, q0: here.q.clone(), q1, secs: Math.max(FLY.least, Math.min(FLY.most, far / FLY.speed)), far };
    go('fly'); onSay('pick'); scanEl.hidden = true;
    return true;
  }
  function scan(id = V.eyed) {
    const o = seen.get(id); if (!o || !looking()) return false;
    o.rock.scanned = true; if (o.tag) { o.tag.remove(); o.tag = null; }
    readOf(o).classList.add('is-new'); onSay('scan');
    return true;
  }
  // a rock's readout: exactly the tonnes of each metal in it now
  function readOf(o) {
    if (o.tag) return o.tag;
    const t = document.createElement('div'); t.className = 'pdr-read';
    t.innerHTML = scanOf(o.rock).map((x) => `<div><i style="--c: ${(ORE[x.metal] || ORE.copper).glow}"></i>${esc(cap(x.metal))}<b>${esc(tonnesWords(x.tonnes))}</b></div>`).join('');
    readsEl.appendChild(t); o.tag = t; return t;
  }
  // (on the finger's lift, as the Done button below: a tap straight after a drag gets no click on some phones)
  let scanAt = 0;
  scanEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  scanEl.addEventListener('pointerup', (e) => { e.stopPropagation(); if (scanEl.disabled) return; scanAt = performance.now(); scan(); });
  scanEl.addEventListener('click', (e) => { e.stopPropagation(); if (performance.now() - scanAt > 600) scan(); });

  // ── drilling: the wrist turned by a drag; a tap on the rock drills there ──
  // a hole at a direction of the rock's own (src/drill.js's frame)
  function drillAt(dir) {
    if (V.stage !== 'drill' || V.sub || !H || H.rock.left <= 0) return false;
    const S = H.o.S, n3 = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
    // the spot on the rock's surface, from the rock's middle, as it stands now (the ship's frame, metres)
    const now = n3.clone().multiplyScalar(radiusAt(S, n3) * ROCK_R).multiply(_s.set(S.sq[0], S.sq[1], S.sq[2])).applyQuaternion(H.q);
    // the wrist's turn that brings it round to the cutter's side
    const a = wristAxis, s2 = now.clone().addScaledVector(a, -now.dot(a)), c2 = cutDir.clone().addScaledVector(a, -cutDir.dot(a));
    const round = s2.lengthSq() > 1e-6 && c2.lengthSq() > 1e-6 ? Math.atan2(_v.crossVectors(s2, c2).dot(a), s2.dot(c2)) : 0;
    const then = now.clone().applyAxisAngle(a, round), out = then.clone().normalize(), spot = H.centre.clone().add(then);
    // the cutter's wheel goes along the rock to the spot: its joints, from where its middle must be
    const to = cutterTo(spot.clone().addScaledVector(out, WHEEL - BITE));
    H.t0 = H.turn; H.t1 = H.turn + round * wristSign; H.vel = 0; H.cut = { from: { ...cutWait }, to, spot, out, secs: T.turn + Math.abs(round) * 0.22 };
    V.sub = 'turn'; V.subT = 0; V.dir = [n3.x, n3.y, n3.z]; doneEl.hidden = true;
    return true;
  }
  function letGo() { if (V.stage !== 'drill' || V.sub) return false; run.letGo(); go('release'); armsWant = 'reach'; doneEl.hidden = true; holesEl.hidden = true; return true; }
  // (let go on the finger's lift, not on the click a browser makes of it: a tap straight after a drag gets no click on
  // some phones; the click still serves the keyboard)
  doneEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  doneEl.addEventListener('pointerup', (e) => { e.stopPropagation(); letGo(); });
  doneEl.addEventListener('click', (e) => { e.stopPropagation(); letGo(); });
  // HEADING HOME EARLY, with what is aboard (while looking for a rock, or holding one with the cutter still): each
  // part-full canister's level rounded to the nearest 1/8 of a tonne (src/drill.js home), a rock in the claw let go
  const canHome = () => !panel && (V.stage === 'look' || V.stage === 'back' || (V.stage === 'drill' && !V.sub)) && run.canHome();
  function headHome() {
    if (!canHome() || !run.home()) return false;
    // (the line along the bottom says what happens to the levels, at once: whatever the last hole's words were)
    hintT = 0; go('full'); armsWant = 'stowed'; doneEl.hidden = true; holesEl.hidden = true; scanEl.hidden = true; homeEl.hidden = true;
    big(`Heading home<small>${esc(cap(lotsWords(sellsFor(run.store()).lots)))}</small>`, T.full); onSay('early');
    return true;
  }
  let homeAt = 0;
  homeEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  homeEl.addEventListener('pointerup', (e) => { e.stopPropagation(); homeAt = performance.now(); headHome(); });
  homeEl.addEventListener('click', (e) => { e.stopPropagation(); if (performance.now() - homeAt > 600) headHome(); });

  // ── where things are on the screen ──
  // (p: a place in the field's frame)
  const proj = (p, out) => { _v.copy(p).applyMatrix4(at).project(camera); out.x = (_v.x * 0.5 + 0.5) * innerWidth; out.y = (-_v.y * 0.5 + 0.5) * innerHeight; out.z = _v.z; return out; };
  const pxOf = (p, r) => { const d = _v.copy(p).applyMatrix4(at).sub(camera.position).dot(_v2.set(0, 0, -1).applyQuaternion(camera.quaternion)); return r / Math.max(0.1, d) / Math.tan(camera.fov * Math.PI / 360) * innerHeight / 2; };
  const scr = { x: 0, y: 0, z: 0 };
  // HOW BIG A ROCK'S GLOW IS DRAWN. Near, its true size. Far off a rock is a few of the screen's dots across, so the
  // scan draws its ore larger than life, spread wider than the rock itself, each vein's colour apart from the next:
  // GLOW_PX[0] dots across its radius at GLOW_PX[1] metres, shrinking only slowly further off (so a nearer rock still
  // looks nearer). bigOf: how many times larger than life, at so many metres from the eye; shownPx: its radius on
  // the screen.
  const realPx = (far) => ROCK_R / Math.max(1, far) / Math.tan(camera.fov * Math.PI / 360) * innerHeight / 2;
  const bigOf = (far) => Math.max(1, Math.min(16, GLOW_PX[0] * Math.pow(GLOW_PX[1] / Math.max(GLOW_PX[1], far), GLOW_PX[2]) / realPx(far)));
  const shownPx = (o) => { const far = o.far || 100; return realPx(far) * bigOf(far); };
  // the rock at a place on the screen: the nearest to it, within its glow or a finger's width
  function rockUnder(x, y, reach = 28) {
    let best = null, bd = Infinity;
    for (const o of seen.values()) { if (!o.mesh.visible) continue; proj(o.pos, scr); if (scr.z >= 1) continue; const r = Math.max(reach, shownPx(o) * 1.25), d = Math.hypot(scr.x - x, scr.y - y); if (d < r && d < bd) { bd = d; best = o; } }
    return best;
  }
  // a tap on the rock in the claw -> the spot's direction in the rock's own frame; null: not on the rock, or on a
  // part of the claw in front of it
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const clawParts = clawD ? clawD.leaves.filter((L) => L.meshes[0] && /-(palm|f|g):/.test(L.meshes[0].name)).flatMap((L) => L.meshes.map((im) => ({ im, i: L.index }))) : [];
  function spotAt(x, y) {
    if (!H) return null;
    ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(H.mesh, false)[0]; if (!hit) return null;
    // (the claw's parts are found where they are now: their batches' own bounds were worked out with the arms folded)
    for (const P of clawParts) P.im.boundingSphere = null;
    for (const P of clawParts) { const h = ray.intersectObject(P.im, false).find((k) => k.instanceId === P.i); if (h && h.distance < hit.distance) return { claw: true }; }
    const p = H.mesh.worldToLocal(hit.point.clone()), S = H.o.S;
    const d = new THREE.Vector3(p.x / S.sq[0], p.y / S.sq[1], p.z / S.sq[2]).normalize();
    return [d.x, d.y, d.z];
  }
  // THE WRIST TURNED BY A DRAG: the rock's near side follows the finger, as far round as it is dragged
  const _up = new THREE.Vector3(), _right = new THREE.Vector3(), DRAG = 0.0085;
  function turnBy(dx, dy) {
    if (!H || V.stage !== 'drill' || V.sub) return 0;
    _q.copy(here.q).invert(); _up.set(0, 1, 0).applyQuaternion(camera.quaternion); _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    // (the camera's up and right in the ship's frame; `at` only places the field, the ship's own turn is here.q)
    _m.extractRotation(at); _pq.setFromRotationMatrix(_m).invert(); _up.applyQuaternion(_pq).applyQuaternion(_q); _right.applyQuaternion(_pq).applyQuaternion(_q);
    const ua = _up.dot(wristAxis), ra = _right.dot(wristAxis), n = Math.hypot(ua, ra) || 1, phi = (dx * ua + dy * ra) / n * DRAG * wristSign;
    H.turn += phi; H.vel = phi; return phi;
  }
  // ── FLOWN BY HAND (src/fieldfly.js): this view keeps the field and the ship; the flying has the ship and the eye ──
  let eyeOn = true;      // (false: the flying's own view has the camera; this view still draws what hangs on the rocks)
  function hand(on, c = camera) {
    if (on) { if (V.stage !== 'look') return false; go('hand'); el.classList.add('is-hand'); eyeOn = false; return true; }
    if (V.stage !== 'hand') return false;
    el.classList.remove('is-hand'); go('look'); eyeOn = true; eyeFrom(c); return true;
  }
  // the rocks as the flying feels them: a ball each, in the field's frame (not the one in the claw); worked out once a step
  const balls = []; let ballsAt = -1;
  function rocksNow() {
    if (ballsAt === V.clock) return balls;
    ballsAt = V.clock; balls.length = 0;
    for (const o of seen.values()) { if ((H && o === H.o) || !o.mesh.visible) continue; balls.push({ id: o.rock.id, p: [o.pos.x, o.pos.y, o.pos.z], r: ROCK_R * Math.max(o.S.sq[0], o.S.sq[1], o.S.sq[2]) * BALL }); }
    return balls;
  }
  // THE CLAW TAKES A ROCK THE SHIP HAS BEEN FLOWN UP TO, as after a tapped trip: the rock is drawn into the hand from
  // where it is, the question is asked, and the drilling goes on from there
  function take(id, c = camera) {
    if (V.stage !== 'hand') return false;
    const o = seen.get(id); if (!o || !run.pick(id)) return false;
    el.classList.remove('is-hand'); eyeOn = true; eyeFrom(c);
    hold(o); go('grab'); armsWant = 'work'; scanT = 0; onSay('pick'); openAsk();
    return true;
  }
  let down = null;
  function onDown(e) { if (panel) return; down = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, lx: e.clientX, ly: e.clientY }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) { /* a rig's made-up pointer */ } }
  function onMove(e) {
    if (e.pointerType === 'mouse') V.mouse = { x: e.clientX, y: e.clientY };
    if (!down || down.id !== e.pointerId) { if (looking() && e.pointerType === 'mouse') e.currentTarget.style.cursor = rockUnder(e.clientX, e.clientY) ? 'pointer' : 'default'; return; }
    if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 9) down.moved = true;
    if (down.moved) {
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
      if (V.stage === 'drill' && !V.sub) turnBy(dx, dy);
      else if (looking() || V.stage === 'fly') { look.yaw -= dx * 0.0052; look.pitch = Math.max(-0.75, Math.min(0.95, look.pitch + dy * 0.0042)); V.pinned = null; }
    }
    down.lx = e.clientX; down.ly = e.clientY; down.at = performance.now();
  }
  function onUp(e) {
    if (!down || down.id !== e.pointerId) return;
    const d = down; down = null;
    if (d.moved) { if (H && performance.now() - (d.at || 0) > 90) H.vel = 0; return; }
    if (V.stage === 'look') { const o = rockUnder(e.clientX, e.clientY); if (o) pick(o.rock.id); }
    else if (V.stage === 'drill' && !V.sub) { const s = spotAt(e.clientX, e.clientY); if (s && s.claw) hint('That is the claw. Tap the rock itself.', 2.2); else if (s) drillAt(s); }
  }
  function onKey(e) {
    if (panel) return;
    // (M: fly manually. The flying listens for the same key, to switch back: this press is not also its own)
    if (e.code === 'KeyM' && !e.repeat && !flyEl.hidden) { e.preventDefault(); e.stopImmediatePropagation(); fly(); return; }
    if ((e.key === 's' || e.key === 'S') && looking() && !scanEl.hidden && !scanEl.disabled) { e.preventDefault(); scan(); return; }
    if (V.stage !== 'drill' || V.sub) return;
    const k = { ArrowLeft: -40, ArrowUp: -40, ArrowRight: 40, ArrowDown: 40 }[e.key];
    if (k && H) { e.preventDefault(); H.turn += k * DRAG; H.vel = 0; }
  }
  // (the taps and drags are taken below the game's own row of buttons along the top)
  const pad = el.querySelector('.pdr-touch');
  pad.addEventListener('pointerdown', onDown); pad.addEventListener('pointermove', onMove); pad.addEventListener('pointerup', onUp); pad.addEventListener('pointercancel', () => { down = null; });
  pad.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') V.mouse = null; });
  addEventListener('keydown', onKey);

  syncSeen();

  const flierMid = /^The /.test(flier) ? 'the ' + flier.slice(4) : flier;
  const HINTS = { arrive: 'The scan shows the ore inside each rock, in its metal\'s colour. More glow is more ore.', look: `Drag to look round. Tap a rock and ${flierMid} flies you to it.`, fly: `${flier} flies you over.`, grab: 'The claw takes the rock.', ask: 'Scanning the rock.',
    drill: 'Drag to turn the rock in the claw. Tap a spot to drill there.', breakUp: 'The rock crumbles.', release: 'The claw lets the rock go.', back: 'Look for the next rock.', full: '',
    early: 'Each part-full canister is rounded to the nearest 1/8 of a tonne.' };
  // (what a hole found: the metal there was most of, and any other worth a word; and a metal it found that no
  // canister had room for, which stays in the rock)
  const HOLE_WORDS = (h) => {
    if (h.bare) return 'Bare rock. Nothing there.';
    // (said when a twentieth of a tonne or more stayed, or the hole brought nothing aboard: not for every crumb)
    const stays = Object.keys(h.stays || {}), crumbs = Object.values(h.stays || {}).reduce((a, b) => a + b, 0) < 0.05 && h.took > 0, none = stays.length && !crumbs ? `No canister has room for the ${listOf(stays)}. It stays in the rock.` : '';
    const by = Object.entries(h.by || {}).sort((a, b) => b[1] - a[1]);
    if (!by.length) return none || 'Next to nothing there.';
    const [m, t] = by[0], more = by[1] && by[1][1] >= 0.05 ? ` And some ${by[1][0]}.` : '';
    return (t < 0.2 ? `A little ${m}.` : t < 0.5 ? `Good ${m} ore.` : `A thick vein of ${m}!`) + more + (none ? ' ' + none : '');
  };
  const lerpQ = (a, b, k) => Object.fromEntries(JOINTS.map((j) => [j, a[j] + (b[j] - a[j]) * k]));

  // the ship flying over to the rock it was sent to; and any other rock in its way eased aside
  const _c = new THREE.Vector3(), AWAY = new THREE.Vector3(0.25, 0.1, 1).normalize();      // (which way a rock let go drifts off: ahead of the ship)
  function stepShip() {
    const F = V.trip; if (!F) return;
    const k = ease(V.t / F.secs);
    here.p.lerpVectors(F.p0, F.p1, k); here.q.slerpQuaternions(F.q0, F.q1, ease(Math.min(1, V.t / (F.secs * 0.42))));
    _c.set(0, 3.2, 1.5).applyQuaternion(here.q).add(here.p);
    for (const o of seen.values()) { if (o === F.o) continue; _v.copy(o.pos).sub(_c); const d = _v.length(); if (d < FLY.clear && d > 1e-3) o.pos.copy(_c).addScaledVector(_v, FLY.clear / d); }
  }

  function update(dt) {
    if (closed) return;
    V.clock += dt; V.t += dt;
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) hintEl.textContent = hintFor; }
    if (bigT > 0) { bigT -= dt; if (bigT <= 0) bigEl.hidden = true; }
    if (closeIn >= 0) { closeIn -= dt; if (closeIn < 0) { closePanel(); asked(); } }
    const S = V.stage;
    if (S === 'fly') stepShip();
    placeShip();
    flyStep(dt); glassStep();
    // the arms: the wrist's turn (a flick of it running on a little), the fingers shut on the rock in the hand, the
    // cutter waiting just above or where the hole wants it
    const cutting = S === 'drill' && V.sub === 'cut';
    spin += dt * MB.ARMS.spin * (cutting ? 2.6 : 0.5);
    if (H && !down && H.vel && S === 'drill' && !V.sub) { H.turn += H.vel * Math.min(1, dt * 60); H.vel *= Math.exp(-dt * 5); if (Math.abs(H.vel) < 0.0006) H.vel = 0; }
    const over = H && clawD && H.grip ? { [clawSide]: { turn: H.turn, hold: H.grip }, ...(cutQ && cutSide ? { [cutSide]: cutQ } : {}) } : null;
    MB.armStep(built, armsWant, dt, { spin, over });
    if (cutD && cutD.work > CUT_UP) { cutD.work = CUT_UP; MB.armShow(built, spin, over); }
    // (the cutter's boom, out as far as the hole being made wants it)
    const out = S === 'drill' && H && H.cut && H.cut.to.ext && cutQ ? (V.sub === 'down' ? ease(V.subT / T.down) : V.sub === 'cut' ? 1 : V.sub === 'up' ? 1 - ease(V.subT / T.up) : 0) : 0;
    boomTo(out > 0 ? _c.copy(H.cut.to.ext).multiplyScalar(out) : null, cutQ);
    standIn();
    const gripped = clawD ? (clawD.grip || 0) >= 1 : true, cutReady = cutD ? (cutD.work || 0) >= CUT_UP - 0.001 : true;

    // the stages
    if (S === 'arrive') { hint(HINTS.arrive); if (V.t > T.arrive) go('look'); }
    else if (S === 'look') hint(HINTS.look);
    else if (S === 'fly') {
      hint(HINTS.fly);
      // (the eye comes round behind the ship as it goes)
      look.yaw += (0 - look.yaw) * Math.min(1, dt * 1.6); look.pitch += (0 - look.pitch) * Math.min(1, dt * 1.6);
      if (V.t >= V.trip.secs) { const o = V.trip.o; V.trip = null; look.yaw = look.pitch = 0; placeShip(); hold(o); go('grab'); armsWant = 'work'; scanT = 0; openAsk(); }
    } else if (S === 'hand') {
      // (flown by hand: the flying's own help corner says what the keys do; nothing of the drill's is asked)
      hint('');
    } else if (S === 'grab') {
      hint(panel ? HINTS.ask : HINTS.grab);
      // (the rock is squared up in the hand as the claw comes onto it: its long or flat way along the hand)
      const k = ease(V.t / 1.1); _q.copy(palmQ(0, _pq)).multiply(H.qPalm); H.q.slerpQuaternions(H.from.q, _q, k); H.centre.lerpVectors(H.from.p, _v.copy(heldPos).addScaledVector(wristAxis, H.off), k);
      scanT += dt; heldMat.uniforms.uScan.value = V.asked ? 0 : 0.02 + (scanT * 0.55) % 1;
      if (V.asked && gripped && cutReady && V.t > 1.1) { go('drill'); heldMat.uniforms.uScan.value = 0; }
    } else if (S === 'drill') {
      if (!V.sub) { hint(HINTS.drill); doneEl.hidden = false; cutQ = null; }
      else if (V.sub === 'turn') {
        V.subT += dt; const k = ease(V.subT / H.cut.secs); H.turn = H.t0 + (H.t1 - H.t0) * k;
        if (V.subT >= H.cut.secs) { V.sub = 'down'; V.subT = 0; }
      } else if (V.sub === 'down') {
        V.subT += dt; cutQ = lerpQ(H.cut.from, H.cut.to, ease(V.subT / T.down));
        if (V.subT >= T.down) {
          // the hole is made: the metal near it goes into the store
          const h = run.drill(V.dir); V.sub = 'cut'; V.subT = 0; V.hole = h; V.lastHole = h ? { took: +h.took.toFixed(3), by: h.by, stays: h.stays, bare: h.bare, left: h.left, boom: +H.cut.to.miss.toFixed(3) } : null;
          if (h) {
            const U = heldMat.uniforms, n = H.rock.made.length; U.uHoles.value[Math.min(7, n - 1)].set(...H.rock.made[n - 1]); U.uHoleN.value = Math.min(8, n);
            V.crackTo = Math.min(1, n / H.rock.holes) * 0.62;
            { const w = HOLE_WORDS(h); hint(w, w.length > 60 ? 4 : 2.2); }
          }
        }
      } else if (V.sub === 'cut') {
        V.subT += dt;
        // chips drift away from the hole
        if (Math.random() < dt * 16) { const v = H.cut.out.clone().multiplyScalar(0.7 + Math.random() * 1.1).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.3)); chip(H.cut.spot, v, 0.05 + Math.random() * 0.09, 1.6 + Math.random() * 1.6); }
        if (V.subT >= T.cut) { V.sub = 'up'; V.subT = 0; }
      } else if (V.sub === 'up') {
        V.subT += dt; cutQ = lerpQ(H.cut.to, H.cut.from, ease(V.subT / T.up));
        if (V.subT >= T.up) {
          const h = V.hole; V.hole = null; cutQ = null; V.sub = 'turnBack'; V.subT = 0;
          if (h && h.done) { go('full'); armsWant = 'stowed'; doneEl.hidden = true; holesEl.hidden = true; big(`All ${DRILL.cans} canisters are full!<small>${esc(cap(lotsWords(sellsFor(run.store()).lots)))}</small>`, T.full); onSay('full'); }
          else if (h && h.broke) { go('breakUp'); armsWant = 'reach'; doneEl.hidden = true; holesEl.hidden = true; breakUp(); }
        }
      } else if (V.sub === 'turnBack') {
        // (the wrist turns the rock back as it was: the hole is seen where it was tapped, the glow round it thinner)
        V.subT += dt; const k = ease(V.subT / H.cut.secs); H.turn = H.t1 + (H.t0 - H.t1) * k;
        if (V.subT >= H.cut.secs) V.sub = '';
      }
      const U = heldMat.uniforms; if (V.crackTo != null) U.uCrack.value += (V.crackTo - U.uCrack.value) * Math.min(1, dt * 4);
    } else if (S === 'breakUp') { hint(HINTS.breakUp); if (V.t > T.breakUp) { dropHeld(); go('back'); } }
    else if (S === 'release') {
      hint(HINTS.release);
      if (H) H.centre.copy(heldPos).addScaledVector(wristAxis, H.off).addScaledVector(AWAY, ease(V.t / T.release) * 14);
      if (V.t > T.release) { dropHeld(); go('back'); }
    } else if (S === 'back') { hint(HINTS.back); syncSeen(); if (V.t > T.back) go('look'); }
    else if (S === 'full') {
      hint(run.early ? HINTS.early : HINTS.full);
      if (H && V.t > 0.6) H.centre.copy(heldPos).addScaledVector(wristAxis, H.off).addScaledVector(AWAY, ease((V.t - 0.6) / 1.4) * 14);
      if (V.t > T.full && !V.ended) { V.ended = true; const { store, cans } = run.load(); onDone({ store, cans, early: run.early, sells: sellsFor(store).pay, stats: { ...run.stats }, secs: V.clock }); }
    }

    // the rocks of the field, each where it lies, turning slowly; the one in the claw where the hand has it
    for (const o of seen.values()) {
      if (H && o === H.o) continue;
      _q.setFromAxisAngle(_v.set(0.3, 1, 0.1).normalize(), o.spin * dt); o.q.premultiply(_q);
      o.mesh.matrix.compose(o.pos, o.q, _s.setScalar(ROCK_R)); o.mesh.matrixWorldNeedsUpdate = true;
    }
    if (H) {
      // (in the hand, the rock goes round with the wrist: the palm's turn, and how the rock lies in it)
      if (S === 'drill' || S === 'breakUp' || S === 'release' || S === 'full') H.q.copy(palmQ(H.turn, _pq)).multiply(H.qPalm);
      H.mesh.visible = S !== 'breakUp'; H.mesh.matrix.compose(H.centre, H.q, _s.setScalar(ROCK_R * (S === 'release' ? 1 - 0.5 * ease(V.t / T.release) : S === 'full' ? 1 - 0.5 * ease((V.t - 0.6) / 1.4) : 1))); H.mesh.matrixWorldNeedsUpdate = true;
      // (its record's place in the field's frame, for the glow)
      H.o.pos.copy(H.centre).applyMatrix4(here.M); H.o.q.copy(here.q).multiply(H.q);
    }
    // the glow follows the metal left
    glowN = 0; veinN = 0; crystalN = 0;
    const eyeAt = _c.copy(camera.position).applyMatrix4(_m.copy(at).invert()), surf = onSurface();
    // (the crystals of the rock in the claw first: there are only so many shards to go round)
    if (H && S !== 'breakUp' && oreLook === 'crystals') crystalsOf(H.o, H.o.pos, H.o.q);
    for (const o of seen.values()) {
      for (const L of o.rock.lumps) { if (L.show == null) L.show = L.ore; L.show += (L.ore - L.show) * Math.min(1, dt * 3.2); }
      if (H && o === H.o) {
        oreOn(heldMat.uniforms, o, S === 'breakUp' ? 0 : 1.2);
        if (S !== 'breakUp' && (!surf || withVeins())) glowOf(o, o.pos, o.q, 1.15);
      } else {
        const far = o.pos.distanceTo(eyeAt), big = bigOf(far); o.far = far; oreOn(o.mat.uniforms, o, 1);
        if (!surf) glowOf(o, o.pos, o.q, 1, far < 150, big);
        // (a far rock looks as a near one does: no glow of the scan's over it)
        else { if (withVeins() && big <= 1.3) glowOf(o, o.pos, o.q, 1, true, big); if (oreLook === 'crystals' && big <= 1.3) crystalsOf(o, o.pos, o.q); }
      }
    }
    crystals.count = crystalN; if (crystalN) { crystals.instanceMatrix.needsUpdate = true; crystals.instanceColor.needsUpdate = true; }
    const A = glow.geometry.attributes; glow.geometry.setDrawRange(0, glowN); for (const k of ['position', 'aC', 'aCol', 'aSize', 'aR']) A[k].needsUpdate = true;
    veins.geometry.setDrawRange(0, veinN * 6); if (veinN) { const B = veins.geometry.attributes; for (const k of ['position', 'aO', 'aC', 'aCol', 'aW', 'aR']) B[k].needsUpdate = true; }
    stepChips(dt);

    // the canisters: the row is the eight as they are, each its metal's colour (its rim from the moment it is given
    // to that metal, and inside it up to its own level); under it the tonnes of each metal aboard; and the button
    // that heads home early
    cansB.textContent = `${run.full} of ${DRILL.cans}`;
    cansI.forEach((c, i) => {
      const k = run.cans[i], a = shownT[i], b = k.t; shownT[i] = S === 'full' || Math.abs(b - a) < 0.004 ? b : a + (b - a) * Math.min(1, dt * 2.5);
      const key = k.metal ? `${k.metal} ${(shownT[i] * 100).toFixed(1)}%` : '';
      if (c._k === key) return; c._k = key;
      c.classList.toggle('is-given', !!k.metal); c.style.setProperty('--c', k.metal ? (ORE[k.metal] || ORE.copper).glow : ''); c.style.setProperty('--at', `${(shownT[i] * 100).toFixed(1)}%`);
    });
    const st = Object.entries(run.store()).map(([m, t]) => `<span><i style="--c: ${(ORE[m] || ORE.copper).glow}"></i>${tons(t, run.early)}</span>`).join('');
    if (storeEl._t !== st) { storeEl._t = st; storeEl.innerHTML = st; }
    homeEl.hidden = !canHome();
    const holes = !!H && (V.stage === 'grab' || V.stage === 'drill' || V.stage === 'breakUp'); holesEl.hidden = !holes;
    if (holes) { holesEl.querySelector('b').textContent = String(H.rock.left); holesEl.querySelector('span').textContent = H.rock.left === 1 ? 'hole left' : 'holes left'; }
  }
  // the rock crumbles into pieces that float off
  function breakUp() {
    if (!H) return;
    for (let i = 0; i < 16; i++) { const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); chip(H.centre.clone().addScaledVector(d, ROCK_R * 0.45), d.multiplyScalar(0.9 + Math.random() * 1.6), ROCK_R * (0.2 + Math.random() * 0.26), T.breakUp + 0.6 + Math.random()); }
    onSay('broke');
  }

  // ── the eye; the corners round the rock looked at, and the readouts that follow the rocks scanned ──
  const tall = () => innerHeight > innerWidth * 1.05 || innerWidth <= 640;
  const viewOf = (name) => VIEWS[name + (tall() ? 'Tall' : '')];
  function aim(cameraIn = camera, dt = 1 / 60) {
    if (closed) return;
    const S = V.stage, far = looking() || S === 'fly', P = viewOf(far ? 'look' : 'work');
    if (eyeOn) {
    want.eye.set(...P.eye); want.look.set(...P.look); want.fov = P.fov;
    if (far) {
      // (turned by the player's drag, about the ship)
      const piv = _v2.set(...VIEWS.pivot); _q.setFromEuler(_e.set(look.pitch, look.yaw, 0, 'YXZ'));
      want.eye.sub(piv).applyQuaternion(_q).add(piv); want.look.sub(piv).applyQuaternion(_q).add(piv);
    } else if (panel) {
      // (clear of the job panel: it covers the right of a wide screen and the bottom of a tall one)
      if (tall()) { want.look.y -= 2.7; want.fov = P.fov + 8; } else { _v.subVectors(want.look, want.eye).normalize(); _v2.crossVectors(_v, _s.set(0, 1, 0)).normalize(); want.look.addScaledVector(_v2, 2.9); want.fov = P.fov + 6; }
    }
    if (glide) {
      // (out of the seat: up through the canopy first, then back behind the ship; into it: forward over the ship
      // first, then down. So the eye passes over the hull, not along it)
      if (!glide.wait) glide.t += dt;
      if (glide.out) {
        const k = ease(glide.t / glide.secs), a = glide.eye, b = want.eye, ky = 1 - (1 - k) * (1 - k);
        cam.eye.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * ky, a.z + (b.z - a.z) * k);
        cam.look.lerpVectors(glide.look, want.look, k); cam.fov = glide.fov + (want.fov - glide.fov) * k;
        if (glide.t >= glide.secs) glide = null;
      } else if (!glide.done) {
        const L = glide.legs[0], k = ease(glide.t / L.secs), a = glide.from, b = L.to, ky = L.down ? k * k : k;
        if (L.round) {
          // (round the ship to behind it, the ship kept in the picture: the eye goes round the ship's own middle, and
          // looks at where it was looking until it is most of the way round)
          const pv = VIEWS.pivot, a0 = Math.atan2(a.eye.x - pv[0], a.eye.z - pv[2]), a1 = Math.atan2(b.eye.x - pv[0], b.eye.z - pv[2]), da = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
          const r0 = Math.hypot(a.eye.x - pv[0], a.eye.z - pv[2]), r1 = Math.hypot(b.eye.x - pv[0], b.eye.z - pv[2]), ang = a0 + da * k, r = r0 + (r1 - r0) * k;
          cam.eye.set(pv[0] + Math.sin(ang) * r, a.eye.y + (b.eye.y - a.eye.y) * k, pv[2] + Math.cos(ang) * r);
          cam.look.lerpVectors(a.look, b.look, ease((k - 0.55) / 0.45));
        } else {
          cam.eye.set(a.eye.x + (b.eye.x - a.eye.x) * k, a.eye.y + (b.eye.y - a.eye.y) * ky, a.eye.z + (b.eye.z - a.eye.z) * k);
          cam.look.lerpVectors(a.look, b.look, k);
        }
        cam.fov = a.fov + (b.fov - a.fov) * k;
        if (glide.t >= L.secs) { glide.from = L.to; glide.legs.shift(); glide.t = 0; if (!glide.legs.length) glide.done = true; }
      }
    } else if (cam.fresh) { cam.eye.copy(want.eye); cam.look.copy(want.look); cam.fov = want.fov; cam.fresh = false; }
    else { const k = far && down && down.moved ? 1 : 1 - Math.exp(-CAM_RATE * dt); cam.eye.lerp(want.eye, k); cam.look.lerp(want.look, k); cam.fov += (want.fov - cam.fov) * k; }
    cameraIn.position.copy(cam.eye).applyMatrix4(G.matrix); cameraIn.up.set(0, 1, 0); cameraIn.lookAt(_v.copy(cam.look).applyMatrix4(G.matrix));
    if (Math.abs(cameraIn.fov - cam.fov) > 0.01 || cameraIn.far !== 3200) { cameraIn.fov = cam.fov; cameraIn.near = 0.3; cameraIn.far = 3200; cameraIn.aspect = innerWidth / innerHeight; cameraIn.updateProjectionMatrix(); }
    }
    cameraIn.updateMatrixWorld(true);
    glow.material.uniforms.uPx.value = renderer.getDrawingBufferSize(ndc).y / (2 * Math.tan(cameraIn.fov * Math.PI / 360));
    veins.material.uniforms.uPx.value = glow.material.uniforms.uPx.value; veins.material.uniforms.uHalf.value.set(ndc.x / 2, ndc.y / 2);
    // the rock looked at: the one the mouse was last on (it stays the one while the mouse goes to the Scan button),
    // else the one nearest the middle of the view
    // (flown by hand, or seen from the seat: no rock is picked out and nothing is scanned; the readouts stay by their rocks)
    const show = looking() && !panel && eyeOn, reads = (looking() || S === 'hand') && !panel && !el.hidden;
    flyEl.hidden = !(canFly && S === 'look' && show);
    let eyed = null;
    if (show) {
      const m = V.mouse && !down ? rockUnder(V.mouse.x, V.mouse.y) : null;
      if (m) V.pinned = m.rock.id;
      eyed = V.pinned != null ? seen.get(V.pinned) || null : null;
      if (eyed) { proj(eyed.pos, scr); if (!eyed.mesh.visible || scr.z >= 1 || scr.x < 0 || scr.x > innerWidth || scr.y < 58 || scr.y > innerHeight) eyed = null; }
      if (!eyed) { V.pinned = null; eyed = rockUnder(innerWidth / 2, innerHeight * (tall() ? 0.4 : 0.45), Math.min(innerWidth, innerHeight) * 0.3); }
    }
    V.eyed = eyed ? eyed.rock.id : null;
    eyeEl.hidden = !eyed;
    if (eyed) { proj(eyed.pos, scr); const r = Math.max(15, shownPx(eyed) * 1.15); eyeEl.style.transform = `translate(${scr.x.toFixed(1)}px, ${scr.y.toFixed(1)}px)`; const b = eyeEl.firstChild; b.style.width = b.style.height = (r * 2).toFixed(0) + 'px'; }
    scanEl.hidden = !show || V.stage === 'arrive';
    scanEl.disabled = !eyed || eyed.rock.scanned;
    const words = !eyed ? 'Look at a rock to scan it' : eyed.rock.scanned ? 'Scanned' : 'Scan this rock';
    if (scanEl._w !== words) { scanEl._w = words; scanEl.innerHTML = eyed && !eyed.rock.scanned ? `${words}<kbd>S</kbd>` : words; }
    // the readouts (each beside its rock, none over another, none under the boxes at the side)
    const placed = []; let sided = false;
    for (const o of seen.values()) {
      if (!o.rock.scanned) continue;
      const t = readOf(o), on = reads && o.mesh.visible;
      proj(o.pos, scr); const vis = on && scr.z < 1 && scr.x > -40 && scr.x < innerWidth + 40 && scr.y > 40 && scr.y < innerHeight + 40;
      t.hidden = !vis; if (!vis) continue;
      if (!sided) { sided = true; for (const b of sideEls) { if (b.hidden) continue; const q = b.getBoundingClientRect(); if (q.width) placed.push({ x: q.left, y: q.top, w: q.width, h: q.height }); } }
      const r = Math.max(12, shownPx(o) * 1.15), w = t.offsetWidth || 110, h = t.offsetHeight || 40;
      const x = Math.max(4, Math.min(innerWidth - w - 4, scr.x + r + 8 + w > innerWidth - 4 ? scr.x - r - 8 - w : scr.x + r + 8)); let y = Math.max(62, Math.min(innerHeight - h - 4, scr.y - h / 2));
      for (const b of placed) if (x < b.x + b.w + 4 && x + w + 4 > b.x && y < b.y + b.h + 3 && y + h + 3 > b.y) y = b.y + b.h + 3;
      placed.push({ x, y, w, h });
      t.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }

  function close() {
    if (closed) return; closed = true;
    closePanel(); removeEventListener('keydown', onKey); el.remove();
    for (const id of [...seen.keys()]) dropSeen(id);
    if (H) { G.remove(H.mesh); H.mesh.geometry.dispose(); H = null; }
    if (thr) { thr.fx.rest(); built.group.remove(thr.fx.group); }
    if (glass) { glass.mat.opacity = glass.opacity; glass.mat.color.setHex(glass.color); }
    G.remove(built.group); scene.remove(G, FG, sun, sun.target); boom.geometry.dispose(); boom.material.dispose();
    for (const im of backdrop.list) FG.remove(im); backdrop.geo.dispose(); farMat.dispose(); chips.geometry.dispose(); glow.geometry.dispose(); glow.material.dispose(); veins.geometry.dispose(); veins.material.dispose(); FG.remove(dust); dust.geometry.dispose(); dust.material.dispose(); crystals.geometry.dispose(); crystals.material.dispose(); for (const o of seen.values()) o.mat.dispose(); fieldMat.dispose(); heldMat.dispose();
    camera.near = was.near; camera.far = was.far; camera.fov = was.fov; camera.updateProjectionMatrix();
  }

  // (the rigs: what is where on the screen; a careful driller's next spot among those that can be seen and tapped)
  const rig = {
    rocks: () => [...seen.values()].filter((o) => !(H && H.o === o)).map((o) => { proj(o.pos, scr); return { id: o.rock.id, shape: o.rock.shape, weight: o.rock.weight, metals: { ...o.rock.metals }, ore: +o.rock.lumps.reduce((s, L) => s + L.ore, 0).toFixed(3), sells: rockSells(o.rock), scanned: o.rock.scanned, far: +o.pos.distanceTo(here.p).toFixed(1), x: Math.round(scr.x), y: Math.round(scr.y), z: +scr.z.toFixed(4), r: Math.round(shownPx(o)) }; }),
    // the spots facing the eye: [{ x, y, worth (the tonnes that would come aboard: what the canisters have room for), dir }] best first
    spots(n = 400) {
      if (!H) return [];
      const out = [], S = H.o.S, inv = _m.copy(G.matrix).invert(), toEye = camera.position.clone().applyMatrix4(inv).sub(H.centre).normalize();
      for (let i = 0; i < n; i++) {
        const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), a = i * 2.399963229728653, d = [r * Math.cos(a), y, r * Math.sin(a)];
        const n3 = new THREE.Vector3(d[0], d[1], d[2]), g = new THREE.Vector3(d[0] * S.sq[0], d[1] * S.sq[1], d[2] * S.sq[2]).multiplyScalar(radiusAt(S, n3) * ROCK_R).applyQuaternion(H.q);
        if (g.clone().normalize().dot(toEye) < 0.5) continue;
        const w = g.add(H.centre).applyMatrix4(G.matrix).project(camera), x = Math.round((w.x * 0.5 + 0.5) * innerWidth), yy = Math.round((-w.y * 0.5 + 0.5) * innerHeight), s = spotAt(x, yy);
        if (!s || s.claw) continue;      // (not behind a finger)
        out.push({ x, y: yy, worth: +holeWorth(H.rock, s, run.cans).toFixed(4), dir: s });
      }
      return out.sort((p, q) => q.worth - p.worth);
    },
    glass: () => (glass ? { inside: glass.inside, opacity: glass.mat.opacity } : null), jets: () => (thr ? { acc: thr.acc.toArray().map((x) => +x.toFixed(2)), spin: +thr.spin.toFixed(3), engine: +thr.engine.toFixed(2), pods: thr.fx.pods.map((p) => [+p.yaw.toFixed(2), +p.pitch.toFixed(2)]) } : null),
    pick, scan, drillAt, letGo, headHome, turnBy, spotAt, lookTo: (yaw, pitch = 0) => { look.yaw = yaw; look.pitch = pitch; cam.fresh = true; },
    hand: () => (H ? { turn: +H.turn.toFixed(3), axis: wristAxis.toArray().map((x) => +x.toFixed(3)), sign: wristSign, cut: cutDir.toArray().map((x) => +x.toFixed(3)), at: H.centre.toArray().map((x) => +x.toFixed(2)), grip: H.grip, gripMs: +(H.gripMs || 0).toFixed(2), cutter: cutQ ? { ...cutQ } : null, wait: { ...cutWait } } : null),
    // how near the cutter's wheel gets to spots all round the rock: [{ from (degrees round from the far end of the rock,
    // 0, to the palm, 180), miss (metres short) }]
    reachAll: (n = 80) => { const out = []; for (let i = 0; i < n; i++) { const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), a = i * 2.399963, d = [r * Math.cos(a), y, r * Math.sin(a)], S = H.o.S, now = new THREE.Vector3(...d).multiply(new THREE.Vector3(...S.sq)).applyQuaternion(H.q).normalize(); out.push({ from: Math.round(Math.acos(Math.max(-1, Math.min(1, now.dot(wristAxis)))) * 180 / Math.PI), miss: rig.reach(d) }); } return out.sort((p, q) => p.from - q.from); },
    // (a search of the cutter's arm for a place: from many ways of holding it, the nearest its wheel gets)
    wheel: (q) => wheelAt(q).toArray(), cutWork: () => ({ ...cutWork }), solveFrom: (q, target) => solve({ ...q }, new THREE.Vector3(...target)),
    target: (dir) => { const S = H.o.S, n3 = new THREE.Vector3(...dir).normalize(), now = n3.clone().multiplyScalar(radiusAt(S, n3) * ROCK_R).multiply(new THREE.Vector3(...S.sq)).applyQuaternion(H.q), a = wristAxis, s2 = now.clone().addScaledVector(a, -now.dot(a)), c2 = cutDir.clone().addScaledVector(a, -cutDir.dot(a)); const round = Math.atan2(new THREE.Vector3().crossVectors(s2, c2).dot(a), s2.dot(c2)), then = now.clone().applyAxisAngle(a, round); return H.centre.clone().add(then).addScaledVector(then.clone().normalize(), WHEEL - BITE).toArray(); },
    reach: (dir) => { if (!H) return null; const S = H.o.S, n3 = new THREE.Vector3(...dir).normalize(), now = n3.clone().multiplyScalar(radiusAt(S, n3) * ROCK_R).multiply(new THREE.Vector3(...S.sq)).applyQuaternion(H.q), a = wristAxis, s2 = now.clone().addScaledVector(a, -now.dot(a)), c2 = cutDir.clone().addScaledVector(a, -cutDir.dot(a)); const round = Math.atan2(new THREE.Vector3().crossVectors(s2, c2).dot(a), s2.dot(c2)), then = now.clone().applyAxisAngle(a, round); return +cutterTo(H.centre.clone().add(then).addScaledVector(then.clone().normalize(), WHEEL - BITE)).miss.toFixed(3); },
  };
  return { el, run, update, aim, close, rig, glideFrom, glideTo, glideGo, eyeFrom, hand, take, rocksNow, shipTo, at,
    // (which way the ore is shown: 'glow' or 'veins'; given a name, changes it)
    oreLook(name) { if (ORE_LOOKS.includes(name) && name !== oreLook) { oreLook = name; oreSet = setOf(name); } return oreLook; },
    // (the look's settings: { glow, dots, size }, dust: how bright the dust band is, light: how hard the light falls on
    // the rocks; given some, changes them)
    oreSet(set) { if (set) { for (const k of ['glow', 'dots', 'size']) if (Number.isFinite(+set[k])) oreSet[k] = Math.max(0, Math.min(3, +set[k])); if (Number.isFinite(+set.dust)) dust.material.uniforms.uK.value = Math.max(0, Math.min(2, +set.dust)); if (Number.isFinite(+set.light)) LIT.value = Math.max(0.2, Math.min(6, +set.light)); } return { ...oreSet, dust: dust.material.uniforms.uK.value, light: LIT.value }; },
    // (how a rock's own skin is drawn: 'low poly' or 'natural'; given a name, changes it)
    rockLook(name) { if (ROCK_LOOKS.includes(name)) rockLook = name; return rockLook; },
    // (the ship's place and turn in the field's frame; where its claw holds a rock, in its own kit frame)
    ship: here, heldPos,
    // (put away and back: while the eye is in the seat, with a wormhole's far end opening or the jump home being worked out)
    show(v) { el.hidden = !v; },
    get eye() { return eyeOn; }, set eye(v) { eyeOn = !!v; },
    get glided() { return !!(glide && glide.done); }, get gliding() { return !!glide; }, get panel() { return panel; }, get stage() { return V.stage; },
    state: () => ({ stage: V.stage, sub: V.sub, t: +V.t.toFixed(2), clock: +V.clock.toFixed(2), aboard: +run.aboard.toFixed(3), full: run.full, given: run.given, cans: run.cans.map((c) => ({ ...c })), early: run.early, store: run.store(), sells: run.sells(), stats: { ...run.stats }, lastHole: V.lastHole, eyed: V.eyed,
      ship: { p: here.p.toArray().map((x) => +x.toFixed(1)), yaw: +yawOf().toFixed(3), q: here.q.toArray().map((x) => +x.toFixed(3)) }, fly: !flyEl.hidden, hand: V.stage === 'hand', eye: eyeOn, shown: !el.hidden, look: { yaw: +look.yaw.toFixed(3), pitch: +look.pitch.toFixed(3) }, rocks: run.rocks.length,
      held: H ? { id: H.rock.id, shape: H.rock.shape, metals: { ...H.rock.metals }, weight: H.rock.weight, left: H.rock.left, holes: H.rock.holes, ore: +H.rock.lumps.reduce((s, L) => s + L.ore, 0).toFixed(3) } : null,
      panel: panel ? panel.state() : null, hint: hintEl.textContent, done: !doneEl.hidden, home: !homeEl.hidden, scan: scanEl.hidden ? null : scanEl.textContent, glow: glowN, chips: bits.length, arms: armDoors.map((D) => ({ t: +D.t.toFixed(2), work: +(D.work || 0).toFixed(2), grip: +(D.grip || 0).toFixed(2) })), log: V.log.slice(-14) }) };
}
