// THE STATION'S JOB SPOTS, in the world: a glowing ring on the floor and a sign over it at each job (by the station
// file's names, as spots.js's markers are), a prompt when the player walks up ("Galley kitchen: Start, E"), and the
// job panel (panel.js) once started. Every job is open from the start, as in Mathwood; a job whose props are still
// being picked (the arena) is marked "coming soon" and has nothing to press. The dock's bridge is built ring by ring out
// to the ship at the port, kept between visits (src/jobs/dock.js, its bridge outside the port src/jobs/docklink.js).
//
//   const jobs = startJobs({ W, walls, input, crew: () => crewMember, save: (crew) => {...}, live: { [job id]: fn }, crane })
//                                 live: what a job's own props are doing right now, for its questions (the smelter's
//                                 load in the hangar: src/crane.js load()); a job without one asks nothing of the world
//                                 crane: the smelter's crane (src/crane.js), for the operator's chair
// THE OPERATOR'S CHAIR at the smelter's crane is one seat (the game's maker, 2026-11-16: "a single option to get into
// the seat and then when the crane operator UI comes up then you can select a toggle button for 'Free Control'"): the
// crane game comes up (src/jobs/crane.js, joined to the crane by src/jobs/cranelink.js), its screen's Free control
// switch swaps it for the crane by hand (src/cranedrive.js) and that one's Crane game switch back, the player seated
// all the while. (Two jobs can still share an area, a side each: job.pair, job.side; none does now.)
//   jobs.update(dt, P, playing)   each frame: the prompt, the rings' glow; -> true while a job panel is up (the player
//                                 stands still at the job and jobs.aim(camera) frames the job's props)
//   jobs.aim(camera, dt)          the camera while a job is up: through the player's eyes, at the counter or desk
//   jobs.close()                  (the crew screen: the panel goes)
//   jobs.start(id) / jobs.panel / jobs.spots / jobs.near   for the rigs (GAME.jobs)
//
// HOW A JOB IS ADDED: ~/pw/space-math/JOBS.md. In short: a module here exporting JOB (its spot, sign, PLACE, SETTING,
// MAKERS, card), listed in JOBS below.
import * as THREE from 'three';
import { resolve } from '../people.js';
import { openPanel, ensureCss } from './panel.js';
import { credits, jobTally } from './engine.js';
import { JOB as galley } from './galley.js';
import { JOB as medical } from './medical.js';
import { JOB as smelter } from './smelter.js';
import { JOB as crane } from './crane.js';
import { craneLink } from './cranelink.js';
import { openDrive, chairScreen, FREE } from '../cranedrive.js';
import { JOB as arena } from './arena.js';
import { openMathball, mathballIdle } from '../mathball/index.js';
import { JOB as dock } from './dock.js';
import { dockLink } from './docklink.js';
import { JOB as cargo } from './cargo.js';

export const JOBS = [galley, medical, smelter, crane, arena, dock, cargo];
export const NEAR = 1.7;     // metres from a job spot that bring up its prompt (a job's own `near` if it has one)

const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);

// a sign over a job spot: the job's name, and what it is (or "coming soon"; job.signSub in place of "Station job")
function signOf(job) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
  const g = cv.getContext('2d'), open = job.open;
  const cut = 22;
  g.beginPath(); g.moveTo(cut, 4); g.lineTo(508 - cut, 4); g.lineTo(508, 4 + cut); g.lineTo(508, 156 - cut); g.lineTo(508 - cut, 156); g.lineTo(cut + 4, 156); g.lineTo(4, 156 - cut); g.lineTo(4, 4 + cut); g.closePath();
  g.fillStyle = 'rgba(10, 14, 20, 0.82)'; g.fill();
  g.lineWidth = 4; g.strokeStyle = open ? 'rgba(255, 160, 70, 0.95)' : 'rgba(170, 190, 210, 0.55)'; g.stroke();
  g.textAlign = 'center'; g.fillStyle = open ? '#fff3e6' : '#c9d2db';
  g.font = '700 46px "Segoe UI", system-ui, sans-serif';
  g.fillText(job.sign.toUpperCase(), 256, 72, 470);
  g.font = '600 32px "Segoe UI", system-ui, sans-serif'; g.fillStyle = open ? '#ffb46b' : '#8d98a4';
  g.fillText(!open ? 'Coming soon' : job.signSub || 'Station job', 256, 122, 470);   // (free control is the crane seat's switch, not a spot of its own)
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  sp.scale.set(1.15, 0.36, 1);
  return sp;
}
function ringOf(job) {
  const open = job.open;
  const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: open ? 0xff9a3c : 0x8fa3b8, transparent: true, opacity: open ? 0.85 : 0.4, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  m.renderOrder = 2;
  return m;
}

// THE OPERATOR AREA'S TWO SIDES (the game's maker, 2026-11-16: "they have 2 options pop up. Each when they look at the
// sides of the operator area. Free control or crane operator job"). Two jobs share one area (job.pair), each on a
// side of it (job.side, as you sit in the chair: left or right). Near the area, the one that comes up is the side the
// camera looks at (the point of the view nearest the area's middle, left or right of it); its ring and sign are lit,
// the other's are faint, and the other is on the prompt too, small, to be picked by a click or a tap.
export const SIDE = { far: 0.85, turn: 0.2, sign: 1.75 };   // (the sides' marks out from the middle; how far round the view must turn; the signs' height)
function sideMarks(s) {
  // (the chair's own left, as you sit facing its forward: its +x)
  const fx = Math.sin(s.heading), fz = Math.cos(s.heading), lx = fz, lz = -fx, k = s.job.side === 'left' ? 1 : -1;
  return new THREE.Vector3(s.pos.x + lx * SIDE.far * k + fx * 0.6, s.pos.y, s.pos.z + lz * SIDE.far * k + fz * 0.6);
}

// hints: { [job id]: fn -> words or null }: a job's prompt line for now, in place of its own (the smelter's, while a
// share of a run waits there: src/mission.js)
// links: { [job.link]: ({ W, walls, job, crew, save }) -> the panel's live, joined to the job's own props } (the
// shipping computer's supply run in Cargo: src/jobs/cargolink.js)
export function startJobs({ W, walls, input = null, crew = () => null, save = () => {}, live = {}, hints = {}, crane = null, lib = null, people = () => null, links = {} } = {}) {
  ensureCss();
  const group = new THREE.Group(); group.name = 'job spots'; W.scene.add(group);
  const spots = [], missing = [];
  for (const job of JOBS) {
    const s = resolve(W, walls, job.spot);
    if (!s) { missing.push(job.id); continue; }
    let heading = s.heading;
    // (a job's `face`, a place by name, is the way its spot faces, over any its spot gives: the dock's faces the airlock)
    if (job.face) { const p = W.place(job.face); if (p) heading = Math.atan2(p.x - s.pos.x, p.z - s.pos.z); }
    if (heading == null && job.spot.place) { const p = W.place(job.spot.place); if (p && Math.hypot(p.x - s.pos.x, p.z - s.pos.z) > 0.2) heading = Math.atan2(p.x - s.pos.x, p.z - s.pos.z); }
    const spot = { job, pos: s.pos.clone(), heading: heading ?? 0 };
    // (a side of a shared area: its ring and sign on its own side)
    const mark = job.pair ? sideMarks(spot) : spot.pos;
    const ring = ringOf(job); ring.position.copy(mark); ring.position.y += 0.02;
    const sign = signOf(job); sign.position.copy(mark); sign.position.y += 2.3;
    if (job.pair) { sign.position.y = mark.y + SIDE.sign; sign.scale.multiplyScalar(0.62); }
    group.add(ring, sign);
    spots.push(Object.assign(spot, { ring, sign, mark }));
  }
  if (missing.length) console.info('job spots left out (the station has no such place): ' + missing.join(', '));
  const pairOf = (s) => (s.job.pair ? spots.filter((x) => x.job.pair === s.job.pair) : [s]);
  // (the operator's chair's middle screen shows the crane's numbers, live: the rail's mark, the hook's height, the load)
  const screen = crane && crane.on ? chairScreen(W, crane) : null;

  // ── the prompt ────────────────────────────────────────────────────────────────────────────────────────────────
  const prompt = document.createElement('div');
  prompt.className = 'pnj-prompt'; prompt.hidden = true;
  prompt.innerHTML = '<div class="pnj-pw"><b></b><small></small></div><button type="button" class="pnj-go">Start<kbd>E</kbd></button>'
    + '<button type="button" class="pnj-other" hidden><span></span><small></small></button>';
  document.body.appendChild(prompt);
  const goBtn = prompt.querySelector('.pnj-go'), otherBtn = prompt.querySelector('.pnj-other');
  goBtn.addEventListener('click', () => { if (near && near.job.open) start(near.job.id); });
  otherBtn.addEventListener('click', () => { if (other) start(other.job.id); });
  const wallet = document.createElement('div');
  wallet.className = 'pnj-wallet'; wallet.hidden = true; wallet.innerHTML = '<i aria-hidden="true"></i><span></span>';
  document.body.appendChild(wallet);
  const showWallet = () => { const c = crew(); wallet.querySelector('span').textContent = `${credits(c)} ${credits(c) === 1 ? 'credit' : 'credits'}`; };

  let near = null, other = null, panel = null, link = null, at = null, playing = false, t = 0, faced = null;
  const camAt = new THREE.Vector3(), camLook = new THREE.Vector3(), want = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let camFresh = true;

  function start(id) {
    const s = spots.find((x) => x.job.id === id);
    const c = crew();
    if (!s || !s.job.open || !c || panel) return false;
    at = s; camFresh = true;
    for (const x of pairOf(s)) x.ring.visible = x.sign.visible = false;   // (the job's own props in view, not its marker)
    if (input && !s.job.game) input.enabled = false;
    prompt.hidden = true; wallet.hidden = true;
    const done = () => { for (const x of pairOf(s)) x.ring.visible = x.sign.visible = true; panel = null; api.panel = null; api.crane = null; if (link) { link.close(); link = null; } at = null; near = null; other = null; if (input && playing) input.enabled = true; showWallet(); wallet.hidden = !playing; };   // (near and other forgotten: still standing at the spot, the prompt and its Start come up again at once: on a phone there was no way to start again without walking off and back)
    if (s.job.game) {
      // a job that is a game (the arena's Mathball: src/mathball/): it walks the player and works the camera itself
      panel = openMathball({ W, walls, input, crew: c, lib, job: s.job, people, onSave: () => save(c), onCredits: showWallet, onClose: done });
    } else if (s.job.id === 'crane' && crane && crane.on) openCrane(s, c, done, 'game');
    else if (s.job.drive) {
      // free control: the crane by hand (src/cranedrive.js), no questions
      panel = openDrive(document.body, { crane, input, W, walls, onClose: done });
    } else {
      // (a job joined to its props: the dock's bridge outside the port, src/jobs/docklink.js; the crane's: openCrane)
      // (the dock's bridge is kept with the crew member between visits: its link saves them as each ring is built)
      link = s.job.link === 'dock' ? dockLink({ W, walls, job: s.job, spot: s.pos, crew: c, save: () => save(c) })
        : s.job.link && links[s.job.link] ? links[s.job.link]({ W, walls, job: s.job, crew: c, save: () => save(c) }) : null;
      panel = openPanel(document.body, { job: s.job, crew: c, live: link || live[s.job.id] || null, onSave: () => save(c), onCredits: showWallet, onClose: done });
    }
    api.panel = panel;
    return true;
  }
  // the crane's seat: the game, or free control; each one's switch swaps to the other in place (the crane stays live)
  let craneDone = null;
  // FREE CONTROL PAYS A LITTLE (the game's maker, CR2-3: "A little for each canister docked"): each canister of ore
  // docked by hand pays FREE.dock (src/cranedrive.js says why so little), once for each canister in a haul, into the
  // crew member's credits and the crane job's tally as the jobs' own pay goes (engine.js answer), saved at once. No
  // question was answered, so the level and the kinds of math are left as they are.
  const paidDocks = new Set();
  function payDock(c) {
    const crewNow = crew(); if (!crewNow || !crane) return 0;
    const key = (crane.round ?? 0) + ':' + c;
    if (paidDocks.has(key)) return 0;
    paidDocks.add(key);
    crewNow.credits = credits(crewNow) + FREE.dock;
    jobTally(crewNow, 'crane').earned += FREE.dock;
    save(crewNow); showWallet();
    return FREE.dock;
  }
  function openCrane(s, c, done, how) {
    craneDone = done;
    if (how === 'free') {
      if (input) input.enabled = true;
      panel = openDrive(document.body, { crane, input, W, walls, onClose: done, onGame: () => swapCrane(s, c, done, 'game'), onDock: payDock });
    } else {
      if (input) input.enabled = false;
      link = craneLink({ crane, W, walls, onFree: () => swapCrane(s, c, done, 'free') });
      panel = openPanel(document.body, { job: s.job, crew: c, live: link, onSave: () => save(c), onCredits: showWallet, onClose: done });
    }
    api.panel = panel; api.crane = how;
  }
  function swapCrane(s, c, done, how) {
    if (!panel) return;
    const was = panel; panel = null;
    if (link) { link.close(true); link = null; }
    was.close(true);
    openCrane(s, c, done, how);
  }
  function close() { if (panel) panel.close(); }

  addEventListener('keydown', (e) => {
    if (panel || !playing || !near || !near.job.open) return;
    if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') { e.preventDefault(); start(near.job.id); }
  });

  // which side of a shared area the camera is turned toward (the way it faces, level, against the chair's own left;
  // with a little slack, so it does not flicker)
  const _d = new THREE.Vector3();
  function facing(s) {
    W.camera.getWorldDirection(_d); _d.y = 0; if (_d.lengthSq() < 1e-6) return null; _d.normalize();
    const across = _d.x * Math.cos(s.heading) - _d.z * Math.sin(s.heading);
    if (across > SIDE.turn) return 'left';
    if (across < -SIDE.turn) return 'right';
    return null;
  }
  function update(dt, P, isPlaying = true) {
    t += dt;
    playing = isPlaying;
    if (screen) screen.update(dt);
    for (const s of spots) {
      const lit = !s.job.pair || (near === s), base = s.job.open ? 0.6 : 0.3;
      s.ring.material.opacity = (lit ? base : 0.14) + Math.sin(t * 2.2 + s.pos.x) * (s.job.open ? (lit ? 0.25 : 0.05) : 0.08);
      if (s.job.pair) s.sign.material.opacity = lit ? 1 : 0.22;
    }
    if (!playing || !P) { prompt.hidden = true; wallet.hidden = true; near = null; other = null; api.near = null; api.nearJobs = []; return false; }
    if (panel && at && at.job.game) { panel.update(dt, P); return true; }
    if (panel) {
      if (panel.update) panel.update(dt);
      if (link && link.update) link.update(dt);
      // standing at the job, facing it
      const k = 1 - Math.exp(-8 * dt), dh = Math.atan2(Math.sin(at.heading - P.heading), Math.cos(at.heading - P.heading));
      P.pos.lerp(at.pos, k); P.heading += dh * k;
      return true;
    }
    if (wallet.hidden) { showWallet(); wallet.hidden = false; }
    for (const s of spots) if (s.job.game) { const z = W.room('arena'); mathballIdle(W, crew(), s.job, !!(z && z.group.visible), dt); }
    let best = null, bd = Infinity;
    for (const s of spots) { const d = Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z); if (d < bd && d < (s.job.near ?? NEAR) && Math.abs(s.pos.y - P.pos.y) < 1.5) { bd = d; best = s; } }
    // (at a shared area: the side looked at; at first, the side the player is on)
    let alt = null;
    if (best && best.job.pair) {
      const two = pairOf(best);
      const side = facing(best) || faced || (((P.pos.x - best.pos.x) * Math.cos(best.heading) - (P.pos.z - best.pos.z) * Math.sin(best.heading)) > 0 ? 'left' : 'right');
      faced = side;
      best = two.find((x) => x.job.side === side) || two[0];
      alt = two.find((x) => x !== best) || null;
    } else faced = null;
    if (best !== near || alt !== other) {
      near = best; other = alt; api.near = best ? best.job.id : null; api.nearJobs = best ? [best.job.id, ...(alt ? [alt.job.id] : [])] : [];
      prompt.hidden = !best;
      if (best) {
        prompt.classList.toggle('is-soon', !best.job.open);
        prompt.classList.toggle('is-pair', !!alt);
        prompt.querySelector('b').textContent = best.job.sign;
        prompt.querySelector('small').textContent = (hints[best.job.id] && hints[best.job.id]()) || best.job.hint;
        goBtn.hidden = !best.job.open; goBtn.dataset.job = best.job.id;
        otherBtn.hidden = !alt;
        if (alt) {
          otherBtn.dataset.job = alt.job.id;
          otherBtn.querySelector('span').textContent = alt.job.sign;
          otherBtn.setAttribute('aria-label', `${alt.job.sign} (turn to its side, or pick it here)`);
        }
      }
    }
    // (the other side: which way to turn to it, from the view as it is)
    if (other) {
      W.camera.getWorldDirection(_d); _d.y = 0; _d.normalize();
      const tx = other.mark.x - P.pos.x, tz = other.mark.z - P.pos.z, turn = -_d.z * tx + _d.x * tz > 0 ? 'turn right ▶' : '◀ turn left';
      const sm = otherBtn.querySelector('small'); if (sm.textContent !== turn) sm.textContent = turn;
    }
    return false;
  }

  function aim(camera, dt = 1 / 60) {
    if (!at) return;
    // (free control and the crane operator job: the view that follows the load)
    if (panel && panel.aim) return panel.aim(camera, dt);
    if (link && link.aim) return link.aim(camera, dt);
    const h = at.heading, fx = Math.sin(h), fz = Math.cos(h), rx = -fz, rz = fx;   // (forward, and the player's right)
    const tall = innerHeight > innerWidth * 1.05 || innerWidth <= 640;
    const V = at.job.view ? W.view(at.job.view) : null;
    if (V) {
      // a job with a view of its own (the station file's named view of its corner: the triage bays, the stretcher),
      // kept clear of the panel (turned so it sits left of the panel on a wide screen, above it on a phone)
      want.copy(V.at);
      const vx = V.look.x - V.at.x, vz = V.look.z - V.at.z, d = Math.hypot(vx, vz) || 1;
      const sx = -vz / d, sz = vx / d;   // (the view's right, level)
      if (tall) wantLook.set(V.look.x, V.look.y - d * 0.3, V.look.z);
      else wantLook.set(V.look.x + sx * d * 0.28, V.look.y, V.look.z + sz * d * 0.28);
      if (camera.fov !== V.fov) { camera.fov = V.fov; camera.updateProjectionMatrix(); }
    } else {
      // through the player's own eyes (the body is put away while a job is up: main.js), at the counter or desk: on a
      // phone looking down, so the counter top sits above the panel along the bottom; on a wide screen turned a little right,
      // so what is ahead sits in the open view left of the panel
      const eye = at.pos.y + 1.62;
      want.set(at.pos.x - fx * 0.25, eye, at.pos.z - fz * 0.25);
      if (tall) wantLook.set(at.pos.x + fx * 0.86, at.pos.y + 0.35, at.pos.z + fz * 0.86);
      else wantLook.set(at.pos.x + fx * 2 + rx * 0.75, eye - 0.75, at.pos.z + fz * 2 + rz * 0.75);
    }
    if (camFresh) { camAt.copy(camera.position); camFresh = false; camLook.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3())); }
    const k = 1 - Math.exp(-5 * dt);
    camAt.lerp(want, k); camLook.lerp(wantLook, k);
    camera.position.copy(camAt); camera.lookAt(camLook);
  }

  // true while the camera is the player's own eyes, or they are in the job's seat (main.js puts the body away then)
  const inEyes = () => !!(at && !at.job.game && (at.job.seated || !(at.job.view && W.view(at.job.view))));
  // (a game job walks the player itself: main.js asks it how, each frame)
  const control = (dt, P) => (panel && at && at.job.game && panel.control ? panel.control(dt, P) : null);
  // (the rings and signs put away while a ship is out on a trip, where the station is not: src/trip.js)
  const show = (on) => { group.visible = !!on; };
  const api = { show, update, aim, close, start, control, spots, missing, near: null, nearJobs: [], panel: null, crane: null, busy: () => !!panel, inEyes, faceOf: () => (at ? at.heading : null), get link() { return link; }, swap: (how) => (at && at.job.id === 'crane' && panel ? (swapCrane(at, crew(), craneDone, how), true) : false) };
  return api;
}
