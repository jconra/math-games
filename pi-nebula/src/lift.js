// THE LIFT, IN THE GAME: one box at three stops (the control room at the top of the tower, the main deck by the
// junction, the store room on the lower level: kit/places-plan.js STOPS has the game's maker's words). Walked into,
// its panel comes up: the two other stops. One picked, its doors shut, it says where it is going, the player is taken
// to the same spot in the same-looking box at that stop, and its doors open there. No shaft and no ride to believe
// ("the elevator doesn't have to be completely believable").
//
// WHERE ONE PLACE IS PUT AWAY AND THE NEXT DRAWN (his "great opportunity to remove the old scene and load a new
// scene"): the station's own rooms (src/station.js, kit/layout.js updateZones). Each place is a room of the station
// file with no opening to any other, so from inside one, nothing of the others is drawn; the doors are shut at the
// moment the player is moved. Two things more, here: in the store room the station's outside (src/outside.js) is put
// away, but for the moment the empty cargo slot's shield is on screen (space is seen through it); and in the control
// room, now and then, one of the small jets flies past the windows (the pads keep their own).
//
//   const lift = makeLift({ W, walls, outside, body, put })
//   lift.busy                 true while a ride is on (the player is held still)
//   lift.update(dt, P, on)    once a frame, after the camera has moved; on: the player is free to use it
//   lift.go(id)               pick a stop, as its button does (for the rigs too); false if it cannot be picked now
//   lift.stop()               back to the title: any ride finished at once, the panel down
//   lift.state()              { here, place, ride, doors, prompt, flyby, outsideOff } for the rigs
import * as THREE from 'three';
import { updateDoors } from '../kit/layout.js';
import { STOPS, RIDE, stopIn, carry, choices, placeOf, words, boxPoint, outOf } from './liftrules.js';
import { TOWER, SLOT, STORE } from '../kit/places-plan.js';

import { ensureCss } from './jobs/panel.js';

const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('./lift.css', import.meta.url).href; document.head.appendChild(css);
// THE FLY-PAST: how long the control room waits before the first one and between them (s), how near the tower a jet
// passes (m from its middle), how fast (m/s), how far before and after its nearest point it is drawn (m)
export const FLYBY = { first: [8, 16], every: [35, 80], near: [17, 28], speed: 70, reach: 380 };
const NEAR = 2.4;      // (how near the player comes to a lift's doorway before it opens)

// THE RIDE'S OWN VIEW, while the doors are shut: high in the box behind the player, looking over their head at the
// doors (in the box's frame: across, up, toward the doorway), and how wide
// (beside the player, not behind: the box is narrow, and a point further back is nearer the next room's walls than this
// box's own, kit/layout.js zoneAt)
export const RIDE_CAM = { at: [-0.5, 2.45, -0.12], look: [0.22, 1.2, 0.95], fov: 74 };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function makeLift({ W, walls, outside = null, body = () => null, put = () => {}, snap = () => {} }) {
  // each stop's doors: the kit's own, driven from here and nowhere else
  const doors = {};
  for (const S of STOPS) {
    const D = W.built.doors.find((d) => d.piece === 'liftDoor' && (d.zone === S.room || (d.zone === 'door-lift' && S.room === 'lift')));
    if (D) { doors[S.id] = D; W.driven.add(D); }
  }
  const missing = STOPS.filter((S) => !doors[S.id]).map((S) => S.id);
  if (missing.length) console.info('lift: no doors found for ' + missing.join(', '));

  ensureCss();
  // ── the panel: the job prompt's own look, the two other stops as its two buttons (E, Q; a tap on a phone) ──
  const prompt = document.createElement('div'); prompt.className = 'pnj-prompt plf'; prompt.hidden = true;
  prompt.innerHTML = '<div class="pnj-pw"><b>Lift</b><small>Pick where to go</small></div><div class="plf-go"></div>';
  document.body.appendChild(prompt);
  const goes = prompt.querySelector('.plf-go'), small = prompt.querySelector('small');
  let shownFor = null, buttons = [];
  function panel(here) {
    if (shownFor === here) return; shownFor = here; goes.textContent = ''; buttons = [];
    choices(here).forEach((S, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pnj-go plf-btn'; b.dataset.stop = S.id;
      const up = STOPS.indexOf(S) < STOPS.findIndex((s) => s.id === here);
      b.innerHTML = `<span class="plf-arrow">${up ? '▲' : '▼'}</span><span class="plf-name">${S.name}</span><kbd>${i ? 'Q' : 'E'}</kbd>`;
      b.setAttribute('aria-label', `${S.name}: ${S.sub.toLowerCase()} (${i ? 'Q' : 'E'})`);
      b.addEventListener('click', () => go(S.id));
      goes.appendChild(b); buttons.push(S.id);
    });
  }
  addEventListener('keydown', (e) => {
    if (prompt.hidden || ride || !buttons.length || e.repeat) return;
    const k = e.key.toLowerCase(), i = k === 'e' || e.key === 'Enter' ? 0 : k === 'q' ? 1 : -1;
    if (i >= 0 && buttons[i]) { e.preventDefault(); go(buttons[i]); }
  });

  // (hold: just come out of a ride, the ride's view kept on the box while the player stands in its middle or steps
  // toward its doors, so the view does not jump to the back of their head against the box's back wall)
  let here = null, ride = null, hold = null, playing = false, place = 'deck';
  function go(to) {
    const P = body();
    if (!playing || ride || !P || !here || to === here || !STOPS.some((s) => s.id === to)) return false;
    ride = { from: here, to, phase: 'shut', t: 0 }; hold = null;
    prompt.classList.add('is-going'); small.textContent = words(here, to) + '…'; goes.hidden = true;
    return true;
  }
  function finish(keep = true) { if (!ride) return; hold = keep ? { id: ride.to, t: 0 } : null; ride = null; prompt.classList.remove('is-going'); small.textContent = 'Pick where to go'; goes.hidden = false; shownFor = null; }

  // a door, as the lift wants it: open while the player is near it and no ride is on (and at the end of one, in the
  // box it came to); shut while a ride is on
  const _e = new THREE.Vector3(), FAR = new THREE.Vector3(1e6, 1e6, 1e6), ONE = [null];
  function doorsTo(dt, P) {
    for (const S of STOPS) {
      const D = doors[S.id]; if (!D) continue;
      const shut = ride && (ride.phase !== 'open' ? S.id === ride.from || S.id === ride.to : S.id !== ride.to);
      const near = P && playing && Math.hypot(P.pos.x - D.sense.x, P.pos.z - D.sense.z) < NEAR && Math.abs(P.pos.y - D.sense.y) < 2.5;
      ONE[0] = D; updateDoors(ONE, near ? _e.copy(P.pos) : FAR, dt, shut ? 'shut' : near ? 'open' : 'shut');
    }
  }

  // ── the store: the outside put away, but while the empty slot's shield is on screen ──
  const slot4 = new THREE.Box3(new THREE.Vector3(STORE.x0 - 0.6, STORE.floor, SLOT.z[3] - SLOT.w / 2), new THREE.Vector3(STORE.x0 + 0.4, STORE.floor + SLOT.h, SLOT.z[3] + SLOT.w / 2));
  const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4();
  let outsideOff = false;
  function outsideFor(camera) {
    if (!outside) return;
    let off = false;
    if (place === 'store') {
      camera.updateMatrixWorld(); _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
      off = !_fr.intersectsBox(slot4);
    }
    if (off !== outsideOff) { outsideOff = off; outside.off = off; }
  }

  // ── the fly-past, from the control room's windows ──
  const fly = { wait: 0, jet: null, loading: false, path: null, t: 0, count: 0 };
  const rand = (a, b) => a + Math.random() * (b - a);
  const _a = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _y = new THREE.Vector3(0, 1, 0), _x = new THREE.Vector3(1, 0, 0), _r = new THREE.Quaternion();
  function startFlyby(camera) {
    // across the way the player looks (so it is seen), at about the windows' height, a little up or down
    camera.getWorldDirection(_d); _d.y = 0; if (_d.lengthSq() < 1e-6) _d.set(1, 0, 0); _d.normalize();
    const look = Math.atan2(_d.x, _d.z) + rand(-0.6, 0.6), near = rand(...FLYBY.near), side = Math.random() < 0.5 ? 1 : -1;
    const c = new THREE.Vector3(TOWER.x + Math.sin(look) * near, TOWER.floor + rand(-1.5, 3.5), TOWER.z + Math.cos(look) * near);
    const dir = new THREE.Vector3(Math.cos(look) * side, rand(-0.06, 0.06), -Math.sin(look) * side).normalize();
    fly.path = { from: c.clone().addScaledVector(dir, -FLYBY.reach), dir, len: 2 * FLYBY.reach, bank: -side * rand(0.15, 0.35) };
    fly.t = 0; fly.count++;
  }
  function flyby(dt, camera) {
    const on = place === 'tower' && playing;
    if (!on) { if (fly.jet) fly.jet.visible = false; fly.path = null; fly.wait = rand(...FLYBY.first); return; }
    if (!fly.jet && !fly.loading && outside && outside.jetCopy) {
      fly.loading = true;
      outside.jetCopy().then((o) => { fly.jet = o; o.visible = false; o.name = 'lift:fly-past'; W.scene.add(o); }).catch((e) => console.warn('the fly-past\'s jet did not come: ' + (e && e.message ? e.message : e)));
    }
    if (!fly.path) { fly.wait -= dt; if (fly.wait <= 0 && fly.jet) startFlyby(camera); return; }
    fly.t += dt * FLYBY.speed;
    if (fly.t > fly.path.len) { fly.path = null; fly.jet.visible = false; fly.wait = rand(...FLYBY.every); return; }
    _a.copy(fly.path.from).addScaledVector(fly.path.dir, fly.t);
    fly.jet.position.copy(_a);
    // its nose (+x in the file) along the way it flies, banked a little toward the tower as it passes
    _q.setFromUnitVectors(_x, fly.path.dir); _r.setFromAxisAngle(_x, fly.path.bank * Math.sin(Math.PI * fly.t / fly.path.len)); fly.jet.quaternion.copy(_q).multiply(_r);
    fly.jet.visible = true;
  }

  // THE MOMENT OF THE CHANGE: while it goes, its doors shut, only the box's own room is drawn (the last word on which
  // rooms are drawn, src/station.js W.rooms, after the outside's own: src/outside.js)
  const OWN = { deck: ['lift', 'door-lift'], tower: ['tower'], store: ['store'] }, before = W.rooms;
  W.rooms = (z, drawn) => { const d = before ? before(z, drawn) : drawn; return ride && ride.phase === 'go' ? OWN[ride.from].includes(z.id) : d; };

  const api = {
    get busy() { return !!ride; },
    get viewing() { return !ride && !!hold; },
    get here() { return here; },
    get place() { return place; },
    doors, go, flyNow: () => { fly.wait = 0; },
    update(dt, P, on = true) {
      playing = !!on && !!P;
      if (P) place = placeOf(P.pos);
      here = P ? stopIn(P.pos) : null;
      if (ride) {
        ride.t += dt;
        const D = doors[ride.from], T = doors[ride.to];
        // (while the doors shut and it goes: the player stepped to the middle of the box and turned to its doors, as
        // a person rides a lift)
        if (P && ride.phase !== 'open') {
          const c = boxPoint(ride.from, [0, 0, 0]), k = 1 - Math.exp(-6 * dt);
          P.pos.x += (c[0] - P.pos.x) * k; P.pos.z += (c[2] - P.pos.z) * k; P.heading += wrap(outOf(ride.from) - P.heading) * k;
        }
        if (ride.phase === 'shut' && (ride.t > RIDE.shut || (D && D.t <= 0.001 && ride.t > 0.35))) { ride.phase = 'go'; ride.t = 0; }
        else if (ride.phase === 'go' && ride.t > RIDE.go) {
          // the moment of the change: the player taken to the same spot in the other box, its doors still shut
          const c = P ? carry(P.pos, P.heading, ride.from, ride.to) : null;
          if (c) { const s = walls.snap(c.at[0], c.at[1] + 0.2, c.at[2], 0.6); put(s || new THREE.Vector3(...c.at), c.heading); if (P) snap(P.pos, P.heading); }
          ride.phase = 'open'; ride.t = 0;
          if (P) { place = placeOf(P.pos); here = stopIn(P.pos); }
        } else if (ride.phase === 'open' && (ride.t > RIDE.open || (T && T.t >= 0.6))) finish();
      }
      if (hold && !ride) {
        hold.t += dt;
        const c = boxPoint(hold.id, [0, 0, 0]);
        if (!P || !playing || hold.t > 5 || Math.hypot(P.pos.x - c[0], P.pos.z - c[2]) > 0.5 || Math.abs(P.pos.y - c[1]) > 1) hold = null;
      }
      doorsTo(dt, P);
      outsideFor(W.camera);
      flyby(dt, W.camera);
      const show = playing && !!here;
      if (show && !ride) panel(here);
      prompt.hidden = !show;
    },
    // the ride's own view (main.js calls it after the follow camera, while a ride is on)
    aim(camera) {
      if (!ride && !hold) return;
      const id = ride ? (ride.phase === 'open' ? ride.to : ride.from) : hold.id, a = boxPoint(id, RIDE_CAM.at), b = boxPoint(id, RIDE_CAM.look);
      camera.position.set(a[0], a[1], a[2]); camera.lookAt(b[0], b[1], b[2]);
      if (camera.fov !== RIDE_CAM.fov) { camera.fov = RIDE_CAM.fov; camera.updateProjectionMatrix(); }
    },
    stop() { finish(false); hold = null; prompt.hidden = true; playing = false; if (fly.jet) fly.jet.visible = false; fly.path = null; if (outsideOff && outside) { outside.off = false; outsideOff = false; } },
    state() {
      const d = Object.fromEntries(Object.entries(doors).map(([k, D]) => [k, +D.t.toFixed(2)]));
      return { here, place, ride: ride ? { ...ride, t: +ride.t.toFixed(2) } : null, viewing: !ride && !!hold, doors: d, prompt: prompt.hidden ? null : { words: prompt.innerText.replace(/\s+/g, ' ').trim(), buttons: buttons.slice() }, flyby: { on: !!fly.path, count: fly.count, wait: +fly.wait.toFixed(1), loaded: !!fly.jet, at: fly.jet && fly.path ? fly.jet.position.toArray().map((v) => +v.toFixed(1)) : null }, outsideOff };
    },
  };
  return api;
}
