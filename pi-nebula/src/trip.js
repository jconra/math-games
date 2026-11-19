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
//   - AT THE ROCKS, THE PILOT'S SEAT ALONE (2026-11-16: "it should drastically cut down the amount of time the mission
//     takes ... Maybe there can just be a short cut-scene of the ship doing the work and then it will be giving you a
//     problem to calculate the jump to get back to the station"): as before, and no longer than before. The ship
//     stands where it is parked with the station not drawn (W.alone: only the ship's own room; everything else hung on
//     the scene is put away and brought back), a few plain rocks ahead of it, the crew's drilling watched through the
//     glass from the seat. The sky is the game's one sky.
//   - HOOKS FOR THE NEXT PIECES: the flight itself knows nothing of a mission (src/flying.js: goal, onClear, onJump,
//     onLanded).
//   - THE STEPS are the mission's own data (MISSIONS[..].steps), one runner here for each kind: 'leave', 'jump' (the
//     job panel with the pilot's cards, src/jobs/pilot.js: three lamps, one lit by each right answer, and the jump
//     fires by itself after the third), 'work' (the crew's drilling watched through the glass: the Miner's own arms, a
//     claw and a cutter, on a rock; a few plain grey rocks beyond; a count of the canisters filling), 'land'.
//   - THE ARMS are two of the kit's own arm pieces built for the trip where the parked ship's folded ones are (those
//     are part of the hangar's still picture and stay folded under the cockpit's sill, out of the pilot's sight).
//   - THE CARDS PAY NOTHING BY THEMSELVES (the panel's pay: false): the share at the smelter is the pay.
//   - THE CAPTAIN'S WORDS come up in a bubble on his side of the cockpit (he is not drawn in the other seat yet).
//   - THE DRILL OPERATOR'S GAME (src/drillview.js, loaded only for a crew member who signed for the drill): at the
//     field the view goes outside the ship (the eye glides out of the seat: above) and the crew member finds the rocks and drills them
//     until the eight canisters are full, or heads home early with what is aboard (each part-full canister then
//     rounded to the nearest 1/8 of a tonne). What comes home is the store: the tonnes of each metal (land's `store`),
//     in the canisters as they are (the hangar's crane is told how full each came home).
//     That view has a Miner of its own, built for outside (legs up, its arms live), far from the parked one, of which
//     nothing is drawn meanwhile. With the pilot's seat left to the crew the jumps are the short version (the lamps
//     light by themselves) and the crew member rides in the other seat.
//   - THE CREW'S OWN DRILLING (the drill not signed for) is watched through the glass as before; what it brings home
//     is the same game worked by the captain's driller (src/drill.js crewLoad: one metal to a canister, all eight
//     filled).
//   - NO ANSWER CHANGES THE HAUL. The jump's lamps show where the pilot is in the jump, and nothing else.
//
//   const T = startTrip(ctx, { mission, roles, onEnd })     ctx: { W, walls, boarding, crane, jobs, guide,
//       people, crew, save, body, put, onCredits }; the crew member is in the ship's cockpit
//   T.update(dt) each frame; T.aim(camera, dt) after the game's own camera; T.late() just before the picture
//   T.abort()   given up (the crew screen): back in the parked ship, the contract still signed
//   T.fly       the flying, while there is one (src/flying.js): its own state, its keys by name (the rigs)
//   T.state()   for the rigs
import * as THREE from 'three';
import { buildRoom } from '../kit/layout.js';
import * as MB from '../kit/ships/miner-built.js';
import { openPanel } from './jobs/panel.js';
import { JOB as PILOT } from './jobs/pilot.js';
import { CARRIES, sellsFor, lotsWords, inEighths, eighthsText } from './jobs/smelter.js';
import { crewLoad } from './drill.js';
import { stepsFor, land, LAMPS, ROLES } from './missions.js';
import { RUN_TALK } from './lines.js';
import { news } from './news.js';
import { MINER, flyingOf, setFlying } from './flymodel.js';
import { makeWormhole, VEIL, VEIL_GLSL } from './wormhole.js';

// the pilot's eyes and where they look, in the ship's own frame (x to port, y up from its ground line, z to the nose:
// ~/pw/space-math/SHIP_miner_arms.md), wide and on a phone, with the job panel up (it covers the right of a wide
// screen and the bottom of a phone's) and without
// (the Miner's own facts now: src/flymodel.js MINER.seat; the flying's cockpit view is the same seat)
export const SEAT = MINER.seat;
// the plain grey rocks beyond (the field's real look is to come): [x, y, z, radius] in the ship's frame, metres
const ROCKS = [[-9, 5.5, 34, 2.6], [11, 1.5, 46, 3.4], [-20, -3, 62, 5], [5, 9, 70, 4], [24, 6, 84, 7], [-34, 8, 98, 8.5], [2, -9, 58, 3], [-6, 0.5, 104, 6]];
// the eye's glide between the seat and the drill's view outside the ship: out (once the wormhole's far end has opened), back in (s)
export const GLIDE = { out: 2.4, back: 1.6 };
const FILL = 1.15;                               // a canister filled, at the rocks (s each)

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
/* (at the drill: under the trip's own word along the top, clear of the store and the chart at the side; on a phone above the game's button and line, and put away while the question is up) */
.pmt.is-drill .pmt-say, .pmt.is-drill.has-panel .pmt-say { top: 62px; right: auto; left: 50%; transform: translateX(-50%); width: max-content; max-width: min(300px, 40vw); }
@media (max-width: 640px) { .pmt.is-drill .pmt-say, .pmt.is-drill.has-panel .pmt-say { top: auto; bottom: 178px; left: 50% !important; max-width: 78vw; } .pmt.is-drill.has-panel .pmt-say { display: none; } }
@media (max-width: 640px) { .pmt-chip { top: max(60px, calc(env(safe-area-inset-top) + 56px)); font-size: 12px; left: 3vw; right: 3vw; transform: none; margin: 0 auto; width: fit-content; white-space: normal; height: auto; min-height: 40px; padding: 6px 12px; column-gap: 8px; row-gap: 0; flex-wrap: wrap; justify-content: center; text-align: center; line-height: 1.25; } .pmt-say { top: 108px; left: 10px !important; right: auto; max-width: 78vw; } .pmt-say p { font-size: 14px; } .pmt-count b { font-size: 22px; } }
`;

// a plain grey rock: a lumpy twenty-sided ball, lit from one side by a few sums of its own (no lamps in the scene)
function rockField(M) {
  const group = new THREE.Group(); group.name = 'trip: rocks'; group.matrixAutoUpdate = false; group.matrix.copy(M); group.visible = false;
  // (not seen through a wormhole's colours: src/wormhole.js veiled)
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...VEIL, uSun: { value: new THREE.Vector3(-0.55, 0.45, -0.7).normalize() } },
    vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: VEIL_GLSL + 'uniform vec3 uSun; varying vec3 vW; void main() { if (veiled(vW)) discard; vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); float d = max(dot(n, uSun), 0.0); vec3 c = vec3(0.34, 0.345, 0.36) * (0.16 + 0.95 * d); gl_FragColor = vec4(c, 1.0); }',
  });
  const spins = [];
  ROCKS.forEach(([x, y, z, r], i) => {
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const s = 1 + 0.22 * Math.sin(p.getX(k) * 5.1 + i) * Math.cos(p.getY(k) * 4.3 + i * 2.1) + 0.12 * Math.sin(p.getZ(k) * 7.7 + i * 0.7); p.setXYZ(k, p.getX(k) * s, p.getY(k) * s * 0.82, p.getZ(k) * s); }
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.scale.setScalar(r); m.rotation.set(i * 1.3, i * 2.1, i * 0.7);
    group.add(m); spins.push([m, 0.012 + 0.006 * (i % 3), 0.008 * ((i % 2) ? 1 : -1)]);
  });
  return { group, update(dt) { for (const [m, a, b] of spins) { m.rotation.y += a * dt; m.rotation.x += b * dt; } }, dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); mat.dispose(); } };
}

export function startTrip(ctx, { mission: M, roles, onEnd = () => {} }) {
  const { W, walls, boarding, crane, jobs, guide, crew, save } = ctx;
  if (!document.getElementById('pmt-css')) { const st = document.createElement('style'); st.id = 'pmt-css'; st.textContent = CSS; document.head.appendChild(st); }
  const S = boarding.ships.find((s) => s.id === M.ship);
  const steps = stepsFor(M, roles), TALK = RUN_TALK[M.id] || {};
  const el = document.createElement('div'); el.className = 'pmt';
  el.innerHTML = '<div class="pmt-chip"><b></b><span></span></div><div class="pmt-say"><small></small><p></p></div><div class="pmt-count" hidden><small>Canisters full</small><b></b><em></em></div>';
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s), sayEl = $('.pmt-say'), countEl = $('.pmt-count');
  $('.pmt-chip b').textContent = M.name;
  // (the seat's own prompt, when the jump computer has been put away for a moment)
  const prompt = document.createElement('div'); prompt.className = 'pnj-prompt'; prompt.hidden = true;
  prompt.innerHTML = '<div class="pnj-pw"><b>Jump computer</b><small>Work out the jump</small></div><button type="button" class="pnj-go">Start<kbd>E</kbd></button>';
  document.body.appendChild(prompt);
  prompt.querySelector('.pnj-go').addEventListener('click', () => openCards());

  const T = { i: -1, t: 0, phase: '', clock: 0, space: false, inField: false, done: false, aborted: false, filled: 0, lamps: [], lit: 0, n: null, paused: false, store: null, cans: null, early: false, log: [] };
  // (signed for which: the pilot's seat, the drill)
  const iPilot = roles.includes('pilot'), iDrill = steps.some((s) => s.kind === 'work' && s.mine) && roles.includes('drill');
  let drill = null, drillKit = null, drillErr = null, drillOn = false;
  let panel = null, arms = null, rocks = null, hidden = null, stand = null, sayT = 0, fireIn = -1, spin = 0, armsWant = 'stowed', cutT = 0;
  // (the flying, src/flying.js: fetched as the crew member sits down; it lives from the seat to the landing)
  let fl = null, flMod = null, flErr = null, flAsked = false;
  // (the wormhole: one for the trip, made as the crew member sits down. The flying at the rocks, src/fieldfly.js: from
  // the far end of the jump out until the colours of the jump home are all round)
  let wh = null, ff = null;
  const name = crew.name || 'pilot';
  const fill = (s, more = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => ({ player: name, ...more }[k] ?? ''));
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
      const keep = new Set([W.sky.object, S.cabin && S.cabin.group, arms && arms.group, rocks && rocks.group, P() && P().c.root, wh && wh.ball].filter(Boolean));
      hidden = W.scene.children.filter((o) => !o.isLight && !keep.has(o) && o !== W.built.group && o.visible);
      for (const o of hidden) o.visible = false;
    } else {
      W.alone = null;
      for (const o of hidden || []) o.visible = true; hidden = null;
    }
  }
  // the trip's own things, made once as the crew member sits down: the two arms (live, where the parked ones are) and
  // the rocks; neither is drawn until the ship is at the rocks
  function build() {
    if (!arms) {
      const zd = W.R.rooms.find((r) => r.id === S.zone.id);
      const pieces = zd.pieces.filter((p) => p.piece === 'mbArm').map((p) => { const q = { ...p }; delete q.hold; return q; });
      arms = buildRoom({ id: 'trip-arms', name: 'trip: arms', grid: zd.grid || W.R.grid, pieces }, W.mats, { compact: false });
      for (const z of arms.zones) z.group.visible = false;      // (the arms' fixed mounts are the parked ship's own already)
      // (lit a little, as the hull beside them is by the cockpit's own lamps: their leaves carry one light each)
      arms.group.traverse((o) => { const a = o.geometry && o.geometry.attributes.iBake; if (a) { for (let k = 0; k < a.count; k++) a.setXYZ(k, 0.55, 0.56, 0.6); a.needsUpdate = true; } });
      for (const D of arms.doors) { D.t = D.target = 1; D.work = 0; D.grip = 0; }
      MB.armStep(arms, 'stowed', 0);
      W.scene.add(arms.group);
    }
    // (they are built where the ship is parked: drawn where it stands, if a pilot left it somewhere else)
    arms.group.matrixAutoUpdate = false; arms.group.matrix.copy(S.D); arms.group.matrixWorldNeedsUpdate = true;
    if (!rocks) { rocks = rockField(S.M); W.scene.add(rocks.group); }
    arms.group.visible = false;
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
  function onKey(e) { if (!prompt.hidden && !panel && (e.key === 'e' || e.key === 'E' || e.key === 'Enter')) { e.preventDefault(); openCards(); } }
  addEventListener('keydown', onKey);


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
        build(); jobs.show(false); if (guide.active) guide.clear();
        if (!wh) wh = makeWormhole({ scene: W.scene, quality: W.quality, rand: ctx.rand || Math.random });
        // (the drill operator's game: fetched and its ship built now, so the field does not wait)
        if (iDrill && !drillKit) Promise.all([import('./drillview.js'), import('./fieldfly.js')]).then(async ([m, f]) => { const ship = await m.buildShip(); if (T.done) ship.dispose(); else drillKit = { m, f, ship }; }).catch((e) => { drillErr = e; console.error(e); if (window.oops) window.oops(e); });
        fl = flMod.startFlying({ W, boarding, crane, outside: ctx.outside || null, people: ctx.people || (() => null), visit: ctx.visit || null }, { cfg: MINER, goal: 'leave', pilot: iPilot, flier: ROLES.pilot.crew, words,
          settings: flyingOf(crew), onSettings: (set) => { setFlying(crew, set); save(crew); },
          onClear: () => { T.clear = true; if (steps[T.i] && steps[T.i].kind === 'leave') say(iPilot ? 'out' : 'crewOut'); }, onJump: () => { T.jumpAsked = true; },
          onLanded: () => { if (steps[T.i] && steps[T.i].kind === 'land') T.landed = true; },
          // (the ship stands somewhere else than it did: the crew member's body, in its seat, goes with it)
          onStand: (moved) => { if (!stand || !P()) return; stand.applyMatrix4(moved); const h = P().heading || 0, v = new THREE.Vector3(Math.sin(h), 0, Math.cos(h)).transformDirection(moved); ctx.put(stand, Math.atan2(v.x, v.z)); },
          // (the seat's prompt: getting up is what ends the flight)
          onGetUp: () => { if (steps[T.i] && steps[T.i].kind === 'land') T.gotUp = true; } });
        api.fly = fl; T.sat = true; T.phase = 'fly'; T.t = 0;
      }
      // (clear of the station: on to the jump, when the pilot asks for it; the crew's own pilot goes straight on)
      if (T.phase === 'fly' && T.clear && (!iPilot || T.jumpAsked)) { T.jumpAsked = false; next(); }
    },
    // the jump computer: three cards, three lamps, and the jump fires by itself
    jump(dt, st) {
      if (!T.phase) {
        // (the ship steadies itself and holds where it is while the jump is worked out: the flying's controls put away)
        if (fl && fl.on) fl.lock(true);
        T.lamps = []; T.lit = 0; fireIn = -1; words(st.mine ? (st.to === 'home' ? 'Work out the jump home' : 'Work out the jump to the rocks') : (st.to === 'home' ? 'Juno plots the jump home' : 'Juno plots the jump'));
        if (st.mine) { T.phase = 'cards'; openCards(); } else T.phase = 'crew';
      }
      // (a pilot of the captain's own: the lamps light by themselves)
      if (T.phase === 'crew' && T.t > 1.2 * (T.lit + 1)) { T.lamps[T.lit] = 'lit'; T.lit++; if (T.lit >= st.cards) fireIn = 0.6; }
      if (fireIn >= 0 && T.phase !== 'jumping') {
        fireIn -= dt;
        if (fireIn <= 0) { fireIn = -1; T.phase = 'jumping'; prompt.hidden = true; if (panel) panel.close(true), panel = null, el.classList.remove('has-panel'); words('Jumping'); startJump(st); }
      }
      // (the wormhole itself is stepped with everything else: api.update. Its far end, opened, moves the run on)
      // (the place ahead not made by the time the colours are all round: they go on, and it is opened as soon as it is)
      if (T.phase === 'jumping' && T.inField && iDrill && !drill && wh && wh.jump && wh.jump.shut) { if (drillErr) { abort(); return; } if (drillKit) openDrill(); }
    },
    // at the rocks: the crew member's own drilling (signed for the drill: runDrill), or the crew's, watched through the glass
    work(dt, st) {
      if (iDrill) { runDrill(dt, st); return; }
      if (!T.phase) {
        // (what the captain's own driller brings home: the same game by the same rules, src/drill.js)
        T.phase = 'reach'; T.filled = 0; armsWant = 'work'; cutT = 0; words('At the rocks');
        const load = crewLoad(ctx.rand || Math.random); T.store = load.store; T.cans = load.cans;
      }
      const gripped = arms.doors.some((D) => (D.grip || 0) >= 1), cutting = arms.doors.every((D) => (D.work || 0) >= 1);
      if (T.phase === 'reach' && T.t > 2.6 && !T.saidField) { T.saidField = true; say('field'); }
      if (T.phase === 'reach' && cutting) { T.phase = 'cut'; countEl.hidden = false; }
      if (T.phase === 'cut') {
        cutT += dt;
        T.filled = Math.min(CARRIES, Math.floor(cutT / FILL));
        countEl.querySelector('b').textContent = `${T.filled} of ${CARRIES}`;
        countEl.querySelector('em').textContent = T.filled >= CARRIES ? lotsWords(sellsFor(T.store).lots) : '';
        if (T.filled >= CARRIES) { T.phase = 'full'; T.t = 0; armsWant = 'stowed'; say('full'); }
      }
      if (T.phase === 'full' && T.t > 3.2) { countEl.hidden = true; next(); }
    },
    // home: flown in through the bay door and set down on its pad, by hand or on autopilot (src/flying.js); down, the
    // haul is aboard and the share is worked out
    // (down on the hangar's floor the seat's prompt comes up, Get up, and nothing ends until it is pressed: the pilot
    // may lift off again and set it down better. Got up: the ship stands where it was set down (the flying told the
    // crane and the cabin as it came down), the haul is aboard it there, and the share is worked out)
    land(dt, st) {
      if (!T.phase) { T.phase = 'fly'; T.landed = false; T.gotUp = false; if (!fl) { console.error('trip: nothing to fly home in'); abort(); return; } }
      if (T.phase === 'fly' && T.gotUp && fl.S.landed) {
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
  };
  // THE JUMP ITSELF: the wormhole (src/wormhole.js). The tear opens in front of the ship where it is; when the colours
  // are all round the place is changed, unseen; they go on until the place ahead is made; then the far end opens on it.
  function startJump(st) {
    const toField = st.to === 'field';
    wh.begin({
      onShut() { T.inField = toField; if (toField) arriveField(); else arriveHome(); },
      // (out to the rocks, signed for the drill: the drill's own ship and field have to be there)
      ready: () => !toField || !iDrill || !!drill || !!drillErr,
      onOpen() { say(toField ? (st.mine ? 'there' : 'crewJump') : iPilot ? 'home' : 'homeCrew'); },
      onDone() {
        // (at the rocks, signed for the drill: now the eye glides out of the seat to the drill's view)
        if (toField && ff) ff.out(GLIDE.out);
        // (home: the flying at the station is the pilot's again, now that the station is ahead)
        if (!toField && fl) fl.lock(false);
        next();
      },
    });
  }
  // ARRIVING at the rocks (the colours all round): the station is put away from here on
  function arriveField() {
    T.view = fl ? fl.view : 'cockpit';
    if (fl) { fl.away(); fl.view = 'cockpit'; }
    space(true); camFresh = true;
    // (a crew member at the drill: the drill's own Miner in the field, and the flying kept, flying it; the far end
    // opens on the field from the seat or from behind, as the view was. The pilot's seat alone: the parked ship with
    // the station not drawn, as before, seen from the seat, the plain rocks ahead of it)
    if (iDrill) { if (drillKit && !drillErr) openDrill(); } else { arms.group.visible = true; rocks.group.visible = true; }
  }
  // ARRIVING home (the colours all round): outside the station, in sight of it; the flying there is back, to come in and land
  function arriveHome() {
    const view = ff ? ff.fl.view : 'cockpit';
    endDrill();
    arms.group.visible = false; rocks.group.visible = false; arms.rockOn = false; arms.armsAs = null;
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
  const seatEye = () => { const tall = innerHeight > innerWidth * 1.05 || innerWidth <= 640; return { eye: [iPilot ? SEAT.eye[0] : -SEAT.eye[0], SEAT.eye[1], SEAT.eye[2]], look: tall ? SEAT.lookTall : SEAT.look, fov: tall ? SEAT.fovTall : SEAT.fov }; };
  function openDrill() {
    if (drill || !drillKit) return;
    // (nothing of the parked ship or its cabin is drawn out there: the game's own Miner is far from them)
    W.alone = []; arms.group.visible = false; rocks.group.visible = false;
    drill = drillKit.m.makeDrillView({ scene: W.scene, camera: W.camera, renderer: W.renderer, ship: drillKit.ship, at: DRILL_AT, crew, save, rand: ctx.rand || Math.random,
      // (who flies the ship over to a rock: the captain's pilot, or the autopilot for a crew member with the pilot's seat
      // too, who also has the button that hands them the ship: src/fieldfly.js)
      flier: iPilot ? 'The autopilot' : 'Pilot Juno', pilot: iPilot, onFly: iPilot ? () => { if (ff) ff.fly(); } : null,
      onSay: (key, more) => { if (TALK[key] && key !== 'full' && key !== 'early') say(key, more); },
      // (the store comes home: the tonnes of each metal, in the canisters as they are; the haul's facts when it lands)
      onDone: (r) => { T.store = r.store; T.cans = r.cans; T.early = !!r.early; T.drillStats = r.stats; T.drillSecs = r.secs; T.phase = 'drillDone'; T.t = 0; say(r.early ? (iPilot ? 'early' : 'earlyCrew') : iPilot ? 'full' : 'fullCrew'); } });
    drillOn = true; el.classList.add('is-drill');
    // THE FLYING, KEPT: the same flying as at the station, flying the drill's own ship. From the seat (or from behind,
    // as the view was) while the wormhole's far end opens; then the drill's view has the eye
    ff = drillKit.f.makeFieldFlying({ W, drill, startFlying: flMod.startFlying, pilot: iPilot, flier: ROLES.pilot.crew, view: T.view || 'cockpit', words,
      settings: flyingOf(crew), onSettings: (set) => { setFlying(crew, set); save(crew); } });
    api.field = ff;
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
    if (T.phase === 'drillDone' && T.t > 2.6) { T.phase = 'fromDrill'; T.t = 0; if (ff.mode === 'hand') ff.drill(); drill.glideTo(seatEye(), GLIDE.back); }
    if (T.phase === 'fromDrill' && (drill.glided || T.t > GLIDE.back * 2 + 2)) { ff.sit('cockpit'); el.classList.remove('has-panel'); next(); }
  }
  function endDrill() {
    if (ff) { ff.close(); ff = null; api.field = null; }
    if (!drill) return;
    drillOn = false; drill.close(); drill = null; el.classList.remove('is-drill'); camFresh = true;
  }
  function cleanUp() {
    endDrill(); if (drillKit) { drillKit.ship.dispose(); drillKit = null; }
    if (fl) { fl.close(); fl = null; api.fly = null; }
    jobs.show(true);
    if (panel) { panel.close(true); panel = null; }
    removeEventListener('keydown', onKey); prompt.remove();
    if (wh) { wh.dispose(); wh = null; }
    space(false);
    if (arms) { W.scene.remove(arms.group); arms.dispose(); arms = null; }
    if (rocks) { W.scene.remove(rocks.group); rocks.dispose(); rocks = null; }
    // (back on their feet where they stood in the cockpit, in the ship as it now stands, turned to the cabin behind the
    // seats: the way out. Short and plain: they are not seen getting up)
    if (stand && P()) { const v = new THREE.Vector3(0, 0, -1).transformDirection(S.M); ctx.put(stand, Math.atan2(v.x, v.z)); }
  }
  function finish() { if (T.done) return; T.done = true; cleanUp(); T.endT = 0; onEnd({ payout: T.payout || null, aborted: false, secs: T.clock }); }
  function abort() { if (T.done) return; T.done = true; T.aborted = true; cleanUp(); crane.back(); el.remove(); onEnd({ payout: null, aborted: true, secs: T.clock }); }

  const _eye = new THREE.Vector3(), _look = new THREE.Vector3(), camLook = new THREE.Vector3(); let camFresh = true;
  const api = {
    get done() { return T.done; }, get seated() { return !T.done && !!T.sat; },
    fly: null,      // (the flying, while there is one: src/flying.js)
    field: null,    // (the flying at the rocks, while there is one: src/fieldfly.js)
    update(dt) {
      T.clock += dt;
      // (the captain's bubble outlives the trip a moment)
      if (sayT > 0) { sayT -= dt; if (sayT <= 0) sayEl.classList.remove('is-on'); }
      if (T.done) { if (!T.aborted && (T.endT += dt) > 7 && el.parentNode) el.remove(); else if (!T.aborted) $('.pmt-chip').style.display = 'none'; return; }
      if (T.i < 0) next();
      T.t += dt;
      RUN[steps[T.i].kind](dt, steps[T.i]);
      if (T.done) return;
      if (fl) { fl.panel = !!panel; fl.update(dt); if (T.done) return; }
      // (at the rocks: the drill's view, the flying kept there; and the wormhole, whose two ends change the place)
      if (drill && drillOn) drill.update(dt);
      if (ff) { ff.fl.panel = !!panel; ff.update(dt); }
      if (wh) { wh.update(dt); if (T.done) return; }
      if (arms && arms.group.visible) { spin += dt * MB.ARMS.spin; MB.armStep(arms, T.inField ? armsWant : 'stowed', dt, { spin }); if (rocks) rocks.update(dt); }
    },
    // the camera: the pilot's eyes, looking out over the nose (turned clear of the job panel while it is up)
    aim(camera, dt = 1 / 60) {
      // (at the rocks, signed for the drill: the drill's view, or the flying's own from the seat and flown by hand)
      if (ff) { ff.aim(camera, dt); camFresh = true; return; }
      if (drill && drillOn) { drill.aim(camera, dt); return; }
      // (near the station: the flying's own two views)
      if (fl && fl.on) { fl.aim(camera, dt); camFresh = true; return; }
      if (!api.seated || !S.M) return;
      const tall = innerHeight > innerWidth * 1.05 || innerWidth <= 640, up = !!panel;
      _eye.copy(inShip(iPilot ? SEAT.eye : [-SEAT.eye[0], SEAT.eye[1], SEAT.eye[2]])); _look.copy(inShip(tall ? (up ? SEAT.lookTallPanel : SEAT.lookTall) : up ? SEAT.lookPanel : SEAT.look));
      if (camFresh) { camLook.copy(_look); camFresh = false; } else camLook.lerp(_look, 1 - Math.exp(-3 * dt));
      camera.position.copy(_eye); camera.lookAt(camLook);
      const fov = tall ? SEAT.fovTall : SEAT.fov; if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    },
    // just before the picture: no haze out there (after the boarding's light has had its say)
    late() {
      if (fl && fl.on) fl.late(); else if (T.space && W.scene.fog) { W.scene.fog.near = 1e4; W.scene.fog.far = 2e4; }
      // (the wormhole, round the eye: ahead is the way the nose of the ship points, whichever ship is being drawn)
      if (wh && wh.on) wh.place(W.camera, ff ? ff.matrix : fl && fl.on ? fl.matrix : S.M);
    },
    abort,
    // (the rigs: the cut-scene hurried on)
    skip(secs = 1) { T.t += secs; if (T.phase === 'cut') cutT += secs; },
    get panel() { return panel; }, get drill() { return drill; },
    rig: {},
    state: () => ({ step: T.done ? 'done' : T.i < 0 ? 'start' : steps[T.i].id, phase: T.phase, t: +T.t.toFixed(2), clock: +T.clock.toFixed(2), space: T.space, field: T.inField, lamps: [...T.lamps], lit: T.lit, filled: T.filled, paused: T.paused, n: T.n,
      fly: fl ? fl.state() : null, jump: wh ? wh.state() : null, ff: ff ? ff.state() : null, drill: drill ? drill.state() : null, store: T.store || null, cans: T.cans || null, early: T.early, sells: T.store ? sellsFor(T.store).pay : null, drillStats: T.drillStats || null, drillSecs: T.drillSecs || null,
      panel: panel ? panel.state() : null, landed: !!T.landed, gotUp: !!T.gotUp, stood: !!T.stood, dark: 0, arms: arms ? arms.doors.map((D) => ({ t: +D.t.toFixed(2), work: +(D.work || 0).toFixed(2), grip: +(D.grip || 0).toFixed(2) })) : null, log: T.log.slice(-12) }),
  };
  return api;
}
