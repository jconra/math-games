// THE STATION'S JOB SPOTS, in the world: a glowing ring on the floor and a sign over it at each job (by the station
// file's names, as spots.js's markers are), a prompt when the player walks up ("Galley kitchen: Start, E"), and the
// job panel (panel.js) once started. Every job is open from the start, as in Mathwood; a job whose props are still
// being picked (the smelter, the arena, the dock's bridge) is marked "coming soon" and has nothing to press.
//
//   const jobs = startJobs({ W, walls, input, crew: () => crewMember, save: (crew) => {...} })
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
import { credits } from './engine.js';
import { JOB as galley } from './galley.js';
import { JOB as medical } from './medical.js';
import { JOB as smelter } from './smelter.js';
import { JOB as arena } from './arena.js';
import { JOB as dock } from './dock.js';

export const JOBS = [galley, medical, smelter, arena, dock];
export const NEAR = 1.7;     // metres from a job spot that bring up its prompt (a job's own `near` if it has one)

const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);

// a sign over a job spot: the job's name, and what it is (or "coming soon")
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
  g.fillText(open ? 'Station job' : 'Coming soon', 256, 122, 470);
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

export function startJobs({ W, walls, input = null, crew = () => null, save = () => {} } = {}) {
  ensureCss();
  const group = new THREE.Group(); group.name = 'job spots'; W.scene.add(group);
  const spots = [], missing = [];
  for (const job of JOBS) {
    const s = resolve(W, walls, job.spot);
    if (!s) { missing.push(job.id); continue; }
    let heading = s.heading;
    if (heading == null && job.face) { const p = W.place(job.face); if (p) heading = Math.atan2(p.x - s.pos.x, p.z - s.pos.z); }
    if (heading == null && job.spot.place) { const p = W.place(job.spot.place); if (p && Math.hypot(p.x - s.pos.x, p.z - s.pos.z) > 0.2) heading = Math.atan2(p.x - s.pos.x, p.z - s.pos.z); }
    const ring = ringOf(job); ring.position.copy(s.pos); ring.position.y += 0.02;
    const sign = signOf(job); sign.position.copy(s.pos); sign.position.y += 2.3;
    group.add(ring, sign);
    spots.push({ job, pos: s.pos.clone(), heading: heading ?? 0, ring, sign });
  }
  if (missing.length) console.info('job spots left out (the station has no such place): ' + missing.join(', '));

  // ── the prompt ────────────────────────────────────────────────────────────────────────────────────────────────
  const prompt = document.createElement('div');
  prompt.className = 'pnj-prompt'; prompt.hidden = true;
  prompt.innerHTML = '<div class="pnj-pw"><b></b><small></small></div><button type="button" class="pnj-go">Start<kbd>E</kbd></button>';
  document.body.appendChild(prompt);
  const goBtn = prompt.querySelector('.pnj-go');
  goBtn.addEventListener('click', () => { if (near && near.job.open) start(near.job.id); });
  const wallet = document.createElement('div');
  wallet.className = 'pnj-wallet'; wallet.hidden = true; wallet.innerHTML = '<i aria-hidden="true"></i><span></span>';
  document.body.appendChild(wallet);
  const showWallet = () => { const c = crew(); wallet.querySelector('span').textContent = `${credits(c)} ${credits(c) === 1 ? 'credit' : 'credits'}`; };

  let near = null, panel = null, at = null, playing = false, t = 0;
  const camAt = new THREE.Vector3(), camLook = new THREE.Vector3(), want = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let camFresh = true;

  function start(id) {
    const s = spots.find((x) => x.job.id === id);
    const c = crew();
    if (!s || !s.job.open || !c || panel) return false;
    at = s; camFresh = true;
    s.ring.visible = s.sign.visible = false;   // (the job's own props in view, not its marker)
    if (input) input.enabled = false;
    prompt.hidden = true; wallet.hidden = true;
    panel = openPanel(document.body, { job: s.job, crew: c, onSave: () => save(c), onCredits: showWallet,
      onClose: () => { s.ring.visible = s.sign.visible = true; panel = null; at = null; if (input && playing) input.enabled = true; showWallet(); wallet.hidden = !playing; } });
    api.panel = panel;
    return true;
  }
  function close() { if (panel) panel.close(); }

  addEventListener('keydown', (e) => {
    if (panel || !playing || !near || !near.job.open) return;
    if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') { e.preventDefault(); start(near.job.id); }
  });

  function update(dt, P, isPlaying = true) {
    t += dt;
    playing = isPlaying;
    for (const s of spots) { s.ring.material.opacity = (s.job.open ? 0.6 : 0.3) + Math.sin(t * 2.2 + s.pos.x) * (s.job.open ? 0.25 : 0.08); }
    if (!playing || !P) { prompt.hidden = true; wallet.hidden = true; near = null; api.near = null; return false; }
    if (panel) {
      // standing at the job, facing it
      const k = 1 - Math.exp(-8 * dt), dh = Math.atan2(Math.sin(at.heading - P.heading), Math.cos(at.heading - P.heading));
      P.pos.lerp(at.pos, k); P.heading += dh * k;
      return true;
    }
    if (wallet.hidden) { showWallet(); wallet.hidden = false; }
    let best = null, bd = NEAR;
    for (const s of spots) { const d = Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z); if (d < bd && d < (s.job.near ?? NEAR) && Math.abs(s.pos.y - P.pos.y) < 1.5) { bd = d; best = s; } }
    if (best !== near) {
      near = best; api.near = best ? best.job.id : null;
      prompt.hidden = !best;
      if (best) {
        prompt.classList.toggle('is-soon', !best.job.open);
        prompt.querySelector('b').textContent = best.job.sign;
        prompt.querySelector('small').textContent = best.job.hint;
        goBtn.hidden = !best.job.open;
      }
    }
    return false;
  }

  function aim(camera, dt = 1 / 60) {
    if (!at) return;
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

  // true while the camera is the player's own eyes (main.js puts the body away then)
  const inEyes = () => !!(at && !(at.job.view && W.view(at.job.view)));
  const api = { update, aim, close, start, spots, missing, near: null, panel: null, busy: () => !!panel, inEyes, faceOf: () => (at ? at.heading : null) };
  return api;
}
