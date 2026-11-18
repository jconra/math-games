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
//   - THE SHIP NEVER MOVES. The crew member sits in the parked Miner's own cockpit (its real cabin, src/boarding.js),
//     the camera at the pilot's eyes. Leaving and landing are a fade; out there, the station is simply not drawn
//     (W.alone: only the ship's own room; everything else hung on the scene is put away and brought back), so the
//     station is never seen from outside. The sky is the game's one sky.
//   - THE STEPS are the mission's own data (MISSIONS[..].steps), one runner here for each kind: 'leave', 'jump' (the
//     job panel with the pilot's cards, src/jobs/pilot.js: three lamps, one lit by each right answer, and the jump
//     fires by itself after the third), 'work' (the crew's drilling watched through the glass: the Miner's own arms, a
//     claw and a cutter, on a rock; a few plain grey rocks beyond; a count of the canisters filling), 'land'.
//   - THE ARMS are two of the kit's own arm pieces built for the trip where the parked ship's folded ones are (those
//     are part of the hangar's still picture and stay folded under the cockpit's sill, out of the pilot's sight).
//   - THE CARDS PAY NOTHING BY THEMSELVES (the panel's pay: false): the share at the smelter is the pay.
//   - THE CAPTAIN'S WORDS come up in a bubble on his side of the cockpit (he is not drawn in the other seat yet).
//   - THE DRILL OPERATOR'S GAME (src/drillview.js, loaded only for a crew member who signed for the drill): at the
//     field the view goes outside the ship, behind a short fade, and the crew member picks the rocks and drills them
//     until the eight canisters are full; the load comes home sorted, a canister of one metal each, and sells for
//     what is in it (land's `load`). That view has a Miner of its own, built for outside (legs up, its arms
//     live), far from the parked one, of which nothing is drawn meanwhile. With the pilot's seat left to the crew the
//     jumps are the short version (the lamps light by themselves) and the crew member rides in the other seat.
//
//   const T = startTrip(ctx, { mission, roles, from, onEnd })     ctx: { W, walls, boarding, crane, jobs, guide,
//       people, crew, save, body, put, onCredits }; from: 'seat' | 'captain'
//   T.update(dt) each frame; T.aim(camera, dt) after the game's own camera; T.late() just before the picture
//   T.abort()   given up (the crew screen): back in the parked ship, the contract still signed
//   T.state()   for the rigs
import * as THREE from 'three';
import { buildRoom } from '../kit/layout.js';
import * as MB from '../kit/ships/miner-built.js';
import { openPanel } from './jobs/panel.js';
import { JOB as PILOT } from './jobs/pilot.js';
import { METALS, CARRIES, RICH_METAL } from './jobs/smelter.js';
import { stepsFor, isRich, land, forecast, LAMPS, CARDS, CREW_CLEAN } from './missions.js';
import { RUN_TALK } from './lines.js';
import { news } from './news.js';

// the pilot's eyes and where they look, in the ship's own frame (x to port, y up from its ground line, z to the nose:
// ~/pw/space-math/SHIP_miner_arms.md), wide and on a phone, with the job panel up (it covers the right of a wide
// screen and the bottom of a phone's) and without
export const SEAT = { eye: [0.5, 3.71, 4.14], look: [0.1, 3.05, 12], lookPanel: [-1.7, 3.0, 12], lookTall: [0.2, 2.6, 12], lookTallPanel: [0.2, -1.6, 12], fov: 62, fovTall: 78 };
// the plain grey rocks beyond (the field's real look is to come): [x, y, z, radius] in the ship's frame, metres
const ROCKS = [[-9, 5.5, 34, 2.6], [11, 1.5, 46, 3.4], [-20, -3, 62, 5], [5, 9, 70, 4], [24, 6, 84, 7], [-34, 8, 98, 8.5], [2, -9, 58, 3], [-6, 0.5, 104, 6]];
export const JUMP = { secs: 2.6, flash: 1.5 };   // the jump's picture: how long, and when its flash is whitest
const FADE = 0.55;                               // a fade to black, or back (s)
const FILL = 1.15;                               // a canister filled, at the rocks (s each)

const CSS = `
.pmt { position: fixed; inset: 0; z-index: 22; pointer-events: none; font: 400 16px/1.35 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; color: #eef1f4; user-select: none; -webkit-user-select: none; }
.pmt-fade { position: absolute; inset: 0; background: #020305; opacity: 0; display: grid; place-items: center; text-align: center; padding: 24px; }
.pmt-fade p { margin: 0; max-width: 520px; font-size: 20px; font-weight: 600; color: #cfe6ff; text-wrap: balance; }
.pmt-jump { position: absolute; inset: 0; width: 100%; height: 100%; }
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
.pmt-count[hidden], .pmt-rich[hidden] { display: none; }
.pmt-count small { display: block; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #a7b0ba; }
.pmt-count b { font-size: 26px; font-weight: 800; }
.pmt-count em { display: block; font-style: normal; font-size: 14px; color: #cfe6ff; min-height: 1.35em; }
.pmt-rich { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); padding: 10px 22px; text-align: center; white-space: nowrap; font-size: 22px; font-weight: 800; letter-spacing: 0.06em; color: #1c1205; background: #ffc83c;
  clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px); animation: pmt-pop 0.5s ease; }
.pmt-rich small { display: block; font-size: 14px; letter-spacing: 0.04em; }
@keyframes pmt-pop { from { transform: translateX(-50%) scale(0.6); opacity: 0; } }
.pmt.is-drill .pmt-say { top: 160px; right: auto; left: max(14px, 2vw); max-width: min(280px, 40vw); }
@media (max-width: 640px) { .pmt.is-drill .pmt-say { top: auto; bottom: 150px; max-width: 78vw; } .pmt.is-drill.has-panel .pmt-say { top: 204px; bottom: auto; } }
@media (max-width: 640px) { .pmt-chip { top: max(60px, calc(env(safe-area-inset-top) + 56px)); font-size: 12px; } .pmt-say { top: 108px; left: 10px !important; right: auto; max-width: 78vw; } .pmt-say p { font-size: 14px; } .pmt-rich { font-size: 18px; top: 30%; } .pmt-fade p { font-size: 17px; } .pmt-count b { font-size: 22px; } }
`;

// a plain grey rock: a lumpy twenty-sided ball, lit from one side by a few sums of its own (no lamps in the scene)
function rockField(M) {
  const group = new THREE.Group(); group.name = 'trip: rocks'; group.matrixAutoUpdate = false; group.matrix.copy(M); group.visible = false;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: new THREE.Vector3(-0.55, 0.45, -0.7).normalize() } },
    vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 uSun; varying vec3 vW; void main() { vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); float d = max(dot(n, uSun), 0.0); vec3 c = vec3(0.34, 0.345, 0.36) * (0.16 + 0.95 * d); gl_FragColor = vec4(c, 1.0); }',
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

export function startTrip(ctx, { mission: M, roles, from = 'seat', onEnd = () => {} }) {
  const { W, walls, boarding, crane, jobs, guide, crew, save } = ctx;
  if (!document.getElementById('pmt-css')) { const st = document.createElement('style'); st.id = 'pmt-css'; st.textContent = CSS; document.head.appendChild(st); }
  const S = boarding.ships.find((s) => s.id === M.ship);
  const steps = stepsFor(M, roles), TALK = RUN_TALK[M.id] || {};
  const el = document.createElement('div'); el.className = 'pmt';
  el.innerHTML = '<canvas class="pmt-jump"></canvas><div class="pmt-chip"><b></b><span></span></div><div class="pmt-say"><small></small><p></p></div><div class="pmt-rich" hidden></div><div class="pmt-count" hidden><small>Canisters full</small><b></b><em></em></div><div class="pmt-fade"><p></p></div>';
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s), fadeEl = $('.pmt-fade'), sayEl = $('.pmt-say'), countEl = $('.pmt-count'), richEl = $('.pmt-rich'), cv = $('.pmt-jump'), g2 = cv.getContext('2d');
  $('.pmt-chip b').textContent = M.name;
  // (the seat's own prompt, when the jump computer has been put away for a moment)
  const prompt = document.createElement('div'); prompt.className = 'pnj-prompt'; prompt.hidden = true;
  prompt.innerHTML = '<div class="pnj-pw"><b>Jump computer</b><small>Work out the jump</small></div><button type="button" class="pnj-go">Start<kbd>E</kbd></button>';
  document.body.appendChild(prompt);
  prompt.querySelector('.pnj-go').addEventListener('click', () => openCards());

  const T = { i: -1, t: 0, phase: '', clock: 0, space: false, inField: false, done: false, aborted: false, fade: 0, fadeTo: 0, clean: 0, rich: false, filled: 0, lamps: [], lit: 0, n: null, paused: false, log: [] };
  // (signed for which: the pilot's seat, the drill)
  const iPilot = roles.includes('pilot'), iDrill = steps.some((s) => s.kind === 'work' && s.mine) && roles.includes('drill');
  let drill = null, drillKit = null, drillErr = null, drillOn = false;
  let panel = null, arms = null, rocks = null, hidden = null, stand = null, sayT = 0, jumpT = -1, jumpDone = null, fireIn = -1, spin = 0, armsWant = 'stowed', richShown = false, cutT = 0;
  const name = crew.name || 'pilot';
  const fill = (s, more = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => ({ player: name, ...more }[k] ?? ''));
  const pick = (L) => (L && L.length ? L[Math.floor(Math.random() * L.length)] : '');
  function say(key, more) { const w = fill(pick(TALK[key]), more); if (!w) return; $('.pmt-say small').textContent = ctx.captainName || 'The captain'; $('.pmt-say p').textContent = w; sayEl.classList.add('is-on'); sayT = Math.min(8, 2.4 + w.length * 0.06); T.log.push('says: ' + w); }
  const words = (w) => { $('.pmt-chip span').textContent = w; };
  const fadeWords = (w) => { fadeEl.querySelector('p').textContent = w; };
  const P = () => ctx.body();
  const inShip = (v) => new THREE.Vector3(...v).applyMatrix4(S.M);

  // ── out there: the station put away, and back ──
  function space(on) {
    if (on === T.space) return;
    T.space = on;
    if (on) {
      W.alone = [S.zone.id];
      const keep = new Set([W.sky.object, S.cabin && S.cabin.group, arms && arms.group, rocks && rocks.group, P() && P().c.root].filter(Boolean));
      hidden = W.scene.children.filter((o) => !o.isLight && !keep.has(o) && o !== W.built.group && o.visible);
      for (const o of hidden) o.visible = false;
      jobs.show(false); if (guide.active) guide.clear();
    } else {
      W.alone = null;
      for (const o of hidden || []) o.visible = true; hidden = null;
      jobs.show(true);
    }
  }
  // the trip's own things, made once behind the first fade: the two arms (live, where the parked ones are) and the rocks
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
    if (!rocks) { rocks = rockField(S.M); W.scene.add(rocks.group); }
    arms.group.visible = true;
  }
  const rockMesh = () => (arms && arms.rocks ? Object.values(arms.rocks)[0] : null);
  function tint(rich) { const r = rockMesh(); if (!r) return; r.material.emissive.set(rich ? 0x5a4208 : 0x000000); r.material.color.set(rich ? 0xfff0c0 : 0xffffff); r.material.metalness = rich ? 0.55 : 0.05; r.material.roughness = rich ? 0.45 : 0.95; }

  // ── the jump computer: the job panel with the pilot's cards, its three lamps on the card's top ──
  const lampsHtml = () => `<div class="pnj-lamps" aria-label="The jump's three lamps">${LAMPS.map((n, k) => { const s = T.lamps[k]; return `<span class="pnj-lamp${s ? ' is-' + s : k === T.lit ? ' is-now' : ''}" title="${n}${s === 'lit' ? ': lit at the first try' : s === 'late' ? ': lit' : ''}"><i></i><span>${n}</span></span>`; }).join('')}</div>`;
  const link = {
    now: () => ({ lamp: LAMPS[Math.min(T.lit, LAMPS.length - 1)].toLowerCase(), to: steps[T.i].to }),
    head: () => `<header class="pnj-cardtop is-jump"><span class="pnj-icon is-jump" aria-hidden="true"></span><b>Jump computer</b><small>${steps[T.i].to === 'home' ? 'The jump home' : 'The jump to the rocks'}</small></header>${lampsHtml()}`,
    right(q) {
      const first = q.misses === 0, st = steps[T.i];
      T.lamps[T.lit] = first ? 'lit' : 'late'; T.lit++;
      if (first && st.counts) T.clean++;
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

  // ── the jump's picture: the stars drawn out into streaks, a white flash, and it is somewhere else ──
  function drawJump() {
    const w = cv.width = Math.round(innerWidth / 2), h = cv.height = Math.round(innerHeight / 2);
    g2.clearRect(0, 0, w, h);
    if (jumpT < 0) return;
    const k = jumpT / JUMP.secs, grow = Math.min(1, jumpT / JUMP.flash), cx = w * (el.classList.contains('has-panel') ? 0.3 : 0.5), cy = h * 0.42, R = Math.hypot(w, h);
    g2.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const a = i * 2.399963, r0 = (0.08 + ((i * 0.6180339) % 1) * 0.9) * R * 0.6, len = (0.02 + grow * grow * 0.7) * R * (0.4 + (i % 5) * 0.15);
      g2.strokeStyle = `rgba(${190 + (i % 3) * 30}, ${215 + (i % 2) * 30}, 255, ${0.55 * grow * (1 - Math.max(0, (k - 0.75) * 4))})`; g2.lineWidth = 0.6 + (i % 4) * 0.5;
      g2.beginPath(); g2.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g2.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); g2.stroke();
    }
    const f = jumpT < JUMP.flash ? Math.pow(jumpT / JUMP.flash, 5) : Math.max(0, 1 - (jumpT - JUMP.flash) / (JUMP.secs - JUMP.flash));
    g2.fillStyle = `rgba(235, 245, 255, ${f})`; g2.fillRect(0, 0, w, h);
  }

  // ── the steps ──
  function next() { T.i++; T.t = 0; T.phase = ''; if (T.i >= steps.length) { finish(); return; } T.log.push('step ' + steps[T.i].id); }
  const RUN = {
    // out of the hangar on autopilot: a fade, and the station is behind us
    leave(dt, st) {
      if (!T.phase) { T.phase = 'dark'; T.fadeTo = 1; words('Leaving the hangar'); fadeWords(''); }
      if (T.phase === 'dark' && T.fade >= 1) {
        // (started from the captain, wherever that was: aboard first; the cabin is built as anyone comes into its hangar)
        if (S.state !== 'in') {
          fadeWords('Walking out to the Miner ...');
          if (!T.sent) { T.sent = true; const e = W.R.places?.entrances?.[M.ship]; if (e) { const s = walls.snap(e[0] + 4, e[1] + 0.4, e[2], 4); if (s) ctx.put(s, Math.PI / 2); } }
          if (T.t > 25) { console.error('trip: the ' + M.ship + '\'s cabin never came'); abort(); }
          return;
        }
        if (boarding.where(P().pos) !== M.ship + '/cockpit') { const sp = boarding.spots(M.ship), c = sp.doorIn.cockpit || sp.rooms.cockpit, s = walls.snap(c[0], c[1] + 0.2, c[2], 1.2, 0.15); if (s) ctx.put(s, 0); }   // (just inside the cockpit's door, on the cabin's deck)
        stand = P().pos.clone();
        if (!crane.depart()) { abort(); return; }
        build(); space(true);
        // (the drill operator's game: fetched and its ship built now, behind the fade, so the field does not wait)
        if (iDrill && !drillKit) import('./drillview.js').then(async (m) => { const ship = await m.buildShip(); if (T.done) ship.dispose(); else drillKit = { m, ship }; }).catch((e) => { drillErr = e; console.error(e); if (window.oops) window.oops(e); });
        fadeWords('The Miner lifts off its pad and heads out through the bay door, on autopilot.');
        T.phase = 'away'; T.t = 0;
      }
      if (T.phase === 'away' && T.t > Math.max(2.2, st.secs - 2 * FADE)) { T.fadeTo = 0; T.phase = 'clear'; say(iPilot ? 'out' : 'crewOut'); }
      if (T.phase === 'clear' && T.fade <= 0) next();
    },
    // the jump computer: three cards, three lamps, and the jump fires by itself
    jump(dt, st) {
      if (!T.phase) {
        T.lamps = []; T.lit = 0; fireIn = -1; words(st.mine ? (st.to === 'home' ? 'Work out the jump home' : 'Work out the jump to the rocks') : (st.to === 'home' ? 'Pilot Juno works out the jump home' : 'Pilot Juno works out the jump'));
        // (the captain's own pilot: an ordinary jump, src/missions.js CREW_CLEAN)
        if (st.mine) { T.phase = 'cards'; openCards(); } else { T.phase = 'crew'; if (st.counts) T.clean = CREW_CLEAN; }
      }
      // (a pilot of the captain's own: the lamps light by themselves)
      if (T.phase === 'crew' && T.t > 1.2 * (T.lit + 1)) { T.lamps[T.lit] = 'lit'; T.lit++; if (T.lit >= st.cards) fireIn = 0.6; }
      if (fireIn >= 0 && T.phase !== 'jumping') {
        fireIn -= dt;
        if (fireIn <= 0) { fireIn = -1; T.phase = 'jumping'; jumpT = 0; jumpDone = false; prompt.hidden = true; if (panel) panel.close(true), panel = null, el.classList.remove('has-panel'); words('Jumping'); }
      }
      if (T.phase === 'jumping') {
        jumpT += dt;
        if (!jumpDone && jumpT >= JUMP.flash) { jumpDone = true; T.inField = st.to === 'field'; rocks.group.visible = T.inField; if (T.inField) say(!st.mine ? 'crewJump' : T.clean >= st.cards ? 'clean' : 'wide'); else { say('home'); arms.rockOn = false; arms.armsAs = null; } }
        if (jumpT >= JUMP.secs) { jumpT = -1; drawJump(); next(); }
      }
    },
    // at the rocks: the crew member's own drilling (signed for the drill: runDrill), or the crew's, watched through the glass
    work(dt, st) {
      if (iDrill) { runDrill(dt, st); return; }
      if (!T.phase) {
        T.phase = 'reach'; T.roll = api.rig.roll ?? (ctx.rand || Math.random)(); T.rich = isRich(() => T.roll); T.filled = 0; armsWant = 'work'; richShown = false; cutT = 0; words('At the rocks');
        T.metal = T.rich ? RICH_METAL : METALS[(crane.round + 1) % 4].name; T.ore = forecast({ clean: T.clean, rich: T.rich, roles });
      }
      const gripped = arms.doors.some((D) => (D.grip || 0) >= 1), cutting = arms.doors.every((D) => (D.work || 0) >= 1);
      if (T.phase === 'reach' && T.t > 2.6 && !T.saidField) { T.saidField = true; say('field'); }
      if (T.rich && !richShown && gripped) { richShown = true; tint(true); richEl.hidden = false; richEl.innerHTML = 'A rich rock!<small>Titanium. This haul pays double.</small>'; say('rich'); }
      if (T.phase === 'reach' && cutting) { T.phase = 'cut'; countEl.hidden = false; }
      if (T.phase === 'cut') {
        cutT += dt;
        T.filled = Math.min(CARRIES, Math.floor(cutT / FILL));
        countEl.querySelector('b').textContent = `${T.filled} of ${CARRIES}`;
        countEl.querySelector('em').textContent = T.filled >= CARRIES ? `${T.ore.oreTonnes} tonnes of ${T.metal} ore` : '';
        if (T.filled >= CARRIES) { T.phase = 'full'; T.t = 0; armsWant = 'stowed'; say('full', { tonnes: T.ore.oreTonnes, ore: T.metal }); }
      }
      if (T.phase === 'full' && T.t > 2.2) { countEl.hidden = true; richEl.hidden = true; next(); }
    },
    // home on autopilot: a fade, and down on the pad with the haul aboard
    land(dt, st) {
      if (!T.phase) { T.phase = 'dark'; T.fadeTo = 1; words('Landing'); fadeWords(''); }
      if (T.phase === 'dark' && T.fade >= 1) {
        arms.group.visible = false; rocks.group.visible = false; tint(false); space(false);
        T.n = crane.arrive({ flown: true });
        T.payout = land(crew, { n: T.n, clean: T.clean, rich: T.rich, load: T.load }); save(crew);
        if (drillKit) { drillKit.ship.dispose(); drillKit = null; }
        try { news.add({ kind: 'haul', ship: 'Miner', ore: T.payout.mix && T.payout.mix.length > 1 ? 'mixed' : T.payout.metal, tons: ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'][T.payout.oreTonnes] || String(T.payout.oreTonnes) }); } catch (e) { /* no news */ }
        fadeWords('The autopilot brings the Miner in through the bay door. Down on the pad: legs down, nozzle still hot.');
        T.phase = 'down'; T.t = 0;
      }
      if (T.phase === 'down' && T.t > Math.max(2.4, st.secs - 2 * FADE)) { T.fadeTo = 0; T.phase = 'up'; say(iPilot ? 'landed' : 'landedCrew'); }
      if (T.phase === 'up' && T.fade <= 0) next();
    },
  };
  // THE DRILL OPERATOR'S GAME at the field (src/drillview.js): a short fade, the view outside the ship, the game until
  // the eight canisters are full, a fade back to the seat. The rich rock is rolled here, once a trip, as for a crew's
  // drilling; the haul is a rich one if ore from it comes home.
  const DRILL_AT = new THREE.Matrix4().makeRotationY(-0.62).setPosition(0, 4000, 0);
  function runDrill(dt, st) {
    if (!T.phase) {
      T.phase = 'toDrill'; T.roll = api.rig.roll ?? (ctx.rand || Math.random)(); T.richField = isRich(() => T.roll); T.rich = false; T.filled = 0;
      T.metal = 'mixed'; T.load = null; words('At the rocks'); T.fadeTo = 1; fadeWords('Out to the drill\'s own cameras ...');
    }
    if (T.phase === 'toDrill' && T.fade >= 1) {
      if (drillErr) { abort(); return; }
      if (!drillKit) { if (T.t > 40) { console.error('trip: the drill never came'); abort(); } return; }
      // (nothing of the parked ship or its cabin is drawn out there: the game's own Miner is far from them)
      W.alone = []; arms.group.visible = false; rocks.group.visible = false;
      drill = drillKit.m.makeDrillView({ scene: W.scene, camera: W.camera, renderer: W.renderer, ship: drillKit.ship, at: DRILL_AT, crew, save, rich: T.richField, rand: ctx.rand || Math.random, ore: forecast({ clean: T.clean }).ore,
        onSay: (key, more) => { if (TALK[key] && key !== 'full') say(key, more); },
        // (the load comes home sorted: the metal in each canister, the haul's facts when it lands)
        onDone: (r) => { T.load = r.load; T.rich = r.load.includes(RICH_METAL); T.drillStats = r.stats; T.drillSecs = r.secs; T.metal = r.metal; T.ore = forecast({ clean: T.clean, roles }); T.phase = 'drillDone'; T.t = 0; say(iPilot ? 'full' : 'fullCrew', { tonnes: T.ore.oreTonnes, ore: T.metal }); } });
      drillOn = true; el.classList.add('is-drill'); T.phase = 'drill'; T.t = 0; T.fadeTo = 0; say('drillField');
    }
    if (drill && drillOn) { drill.update(dt); T.filled = drill.run.full; el.classList.toggle('has-panel', !!drill.panel); }
    if (T.phase === 'drillDone' && T.t > 2.6) { T.phase = 'fromDrill'; T.fadeTo = 1; fadeWords('Back to your seat ...'); }
    if (T.phase === 'fromDrill' && T.fade >= 1) { endDrill(); T.fadeTo = 0; next(); }
  }
  function endDrill() {
    if (!drill) return;
    drillOn = false; drill.close(); drill = null; el.classList.remove('is-drill'); camFresh = true;
    if (T.space) { W.alone = [S.zone.id]; if (arms) arms.group.visible = true; }
  }
  function cleanUp() {
    endDrill(); if (drillKit) { drillKit.ship.dispose(); drillKit = null; }
    if (panel) { panel.close(true); panel = null; }
    removeEventListener('keydown', onKey); prompt.remove();
    space(false);
    if (arms) { W.scene.remove(arms.group); arms.dispose(); arms = null; }
    if (rocks) { W.scene.remove(rocks.group); rocks.dispose(); rocks = null; }
    // (back on their feet where they stood, turned to the cabin behind the seats: the way out)
    if (stand && P()) { const v = new THREE.Vector3(0, 0, -1).transformDirection(S.M); ctx.put(stand, Math.atan2(v.x, v.z)); }
  }
  function finish() { if (T.done) return; T.done = true; cleanUp(); T.endT = 0; onEnd({ payout: T.payout || null, aborted: false, secs: T.clock }); }
  function abort() { if (T.done) return; T.done = true; T.aborted = true; cleanUp(); crane.back(); el.remove(); onEnd({ payout: null, aborted: true, secs: T.clock }); }

  const _eye = new THREE.Vector3(), _look = new THREE.Vector3(), camLook = new THREE.Vector3(); let camFresh = true;
  const api = {
    get done() { return T.done; }, get seated() { return !T.done && T.i >= 0 && !(steps[T.i].kind === 'leave' && T.phase !== 'away' && T.phase !== 'clear'); },
    update(dt) {
      T.clock += dt;
      // (the captain's bubble and the last fade outlive the trip a moment)
      if (sayT > 0) { sayT -= dt; if (sayT <= 0) sayEl.classList.remove('is-on'); }
      if (T.fade !== T.fadeTo) { T.fade = T.fadeTo > T.fade ? Math.min(T.fadeTo, T.fade + dt / FADE) : Math.max(T.fadeTo, T.fade - dt / FADE); fadeEl.style.opacity = String(T.fade); }
      if (T.done) { if (!T.aborted && (T.endT += dt) > 7 && el.parentNode) el.remove(); else if (!T.aborted) $('.pmt-chip').style.display = 'none'; return; }
      if (T.i < 0) next();
      T.t += dt;
      RUN[steps[T.i].kind](dt, steps[T.i]);
      if (T.done) return;
      if (arms && arms.group.visible) { spin += dt * MB.ARMS.spin; MB.armStep(arms, T.inField ? armsWant : 'stowed', dt, { spin }); if (rocks) rocks.update(dt); }
      if (jumpT >= 0) drawJump();
    },
    // the camera: the pilot's eyes, looking out over the nose (turned clear of the job panel while it is up)
    aim(camera, dt = 1 / 60) {
      if (drill && drillOn) { drill.aim(camera, dt); return; }
      if (!api.seated || !S.M) return;
      const tall = innerHeight > innerWidth * 1.05 || innerWidth <= 640, up = !!panel;
      _eye.copy(inShip(iPilot ? SEAT.eye : [-SEAT.eye[0], SEAT.eye[1], SEAT.eye[2]])); _look.copy(inShip(tall ? (up ? SEAT.lookTallPanel : SEAT.lookTall) : up ? SEAT.lookPanel : SEAT.look));
      if (camFresh) { camLook.copy(_look); camFresh = false; } else camLook.lerp(_look, 1 - Math.exp(-3 * dt));
      camera.position.copy(_eye); camera.lookAt(camLook);
      const fov = tall ? SEAT.fovTall : SEAT.fov; if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    },
    // just before the picture: no haze out there (after the boarding's light has had its say)
    late() { if (T.space && W.scene.fog) { W.scene.fog.near = 1e4; W.scene.fog.far = 2e4; } },
    abort,
    // (the rigs: the cut-scene and the fades hurried on)
    skip(secs = 1) { T.t += secs; if (T.phase === 'cut') cutT += secs; },
    get panel() { return panel; }, get drill() { return drill; },
    rig: {},      // (the rigs: rig.roll, the roll for the rich rock, under 0.2 for one)
    state: () => ({ step: T.done ? 'done' : T.i < 0 ? 'start' : steps[T.i].id, phase: T.phase, t: +T.t.toFixed(2), clock: +T.clock.toFixed(2), space: T.space, field: T.inField, lamps: [...T.lamps], lit: T.lit, clean: T.clean, rich: T.rich, roll: T.roll, filled: T.filled, paused: T.paused, n: T.n,
      drill: drill ? drill.state() : null, load: T.load || null, drillStats: T.drillStats || null, drillSecs: T.drillSecs || null, richField: !!T.richField,
      panel: panel ? panel.state() : null, fade: +T.fade.toFixed(2), arms: arms ? arms.doors.map((D) => ({ t: +D.t.toFixed(2), work: +(D.work || 0).toFixed(2), grip: +(D.grip || 0).toFixed(2) })) : null, log: T.log.slice(-12) }),
  };
  return api;
}
