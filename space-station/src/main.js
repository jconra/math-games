// THE SPACE GAME'S PAGE. What happens, in order:
//   1. the title screen goes up at once (the shared engine with this game's theme: ui/title.js), over a dark page;
//   2. the station is built behind it (station.js: the kit's own room file and code), the loading bar telling how far;
//      meanwhile the crew kit loads and the looks' pictures are drawn from it (portraits.js);
//   3. the station fades in behind the title, the camera drifting slowly somewhere handsome; where a person can walk
//      is worked out from the station as built (walls.js);
//   4. the start button puts the chosen crew member in their quarters, walking (player.js, chase.js, the shared
//      input); the station's people (people.js, spots.js) come aboard as the player wakes.
//
// Address switches (for testing):
//   ?q=low|medium|high   the picture's quality (otherwise medium on a touch screen, high elsewhere)
//   ?view=name           the title's view (a view named in the station file)
//   ?hold                no clock of its own: nothing moves until GAME.step(dt) is called (for films and frame strips)
//   ?rig                 keeps the picture readable for a screenshot
//   ?nopeople            the station without its people
import * as THREE from 'three';
import { GAME_NAME } from './name.js';
import * as save from './save.js';
import { showTitle } from './ui/title.js';
import { loadStation } from './station.js';
import { loadCrew } from '../kit/crew.js';
import { drawLooks, drawn } from './portraits.js';
import { recipeOf } from './looks.js';
import { makeWalls } from './walls.js';
import { makeChase } from './chase.js';
import { makePlayer, shine } from './player.js';
import { makePeople, resolve } from './people.js';
import { START } from './spots.js';
import { makeInput } from '../../shared/input.js';

const BUILD = 2;                 // shown small on the title; goes up with index.html's ?v=
const q = new URLSearchParams(location.search);
const HOLD = q.has('hold'), RIG = HOLD || q.has('rig');

document.title = GAME_NAME;
const canvas = document.getElementById('game');
const GAME = window.GAME = { ready: false, mode: 'title', frames: 0, missing: [], drawn };
const fail = (e) => { console.error(e); if (window.oops) window.oops(e); };

async function boot() {
  const players = save.load();
  let chosen = null, canBuild = false;
  const T = showTitle(document.getElementById('title-root'), { players, build: BUILD, onStart: start, onChange: (p) => { chosen = p; if (canBuild) prebuild(p); } });
  GAME.T = T; chosen = T.player();
  T.setProgress(0.01, 'Waking the station');
  // each file that arrives moves the loading bar on a little
  try { new PerformanceObserver((list) => { for (let i = list.getEntries().length; i > 0; i--) T.nudge(); }).observe({ type: 'resource' }); } catch (e) { /* an old browser: the bar still moves */ }

  // the crew kit, for the looks' pictures, the player and the people (one copy for all three)
  const libP = loadCrew();
  libP.then((lib) => drawLooks(lib, { first: [chosen && chosen.look && chosen.look.id, ...players.map((p) => p.look && p.look.id)] })).catch(fail);

  const W = await loadStation({ canvas, quality: q.get('q'), rig: RIG, say: (f, words) => T.setProgress(0.02 + f * 0.8, words) });
  GAME.W = W;

  // ── where a person can walk ──────────────────────────────────────────────────────────────────────────────────
  T.setProgress(0.84, 'Checking the doors');
  await new Promise((go) => setTimeout(go, 0));
  const walls = makeWalls(W.built);
  for (const d of walls.doors) if (d.locked) W.keepShut.add(d.D);   // (the doors to space stay shut)
  GAME.walls = walls;

  // ── the title's view: a named view in the station file, the camera swaying a little round it ──────────────────
  const TITLE_VIEWS = ['terminal', 'windows', 'hangar', 'overlook', 'start', 'spawn'];
  const titleView = W.view(q.get('view')) || TITLE_VIEWS.map(W.view).find(Boolean) || fromSpawn(W);
  const side = new THREE.Vector3(), fwd = new THREE.Vector3(), at = new THREE.Vector3(), look = new THREE.Vector3();
  function drift(t) {
    const v = titleView;
    fwd.subVectors(v.look, v.at).setY(0).normalize(); side.set(-fwd.z, 0, fwd.x);
    // (small: a view stands where its maker put it, and the walls are near)
    at.copy(v.at).addScaledVector(side, Math.sin(t * 0.11) * 0.55).addScaledVector(fwd, Math.sin(t * 0.07 + 1) * 0.35);
    at.y += Math.sin(t * 0.09 + 2) * 0.08;
    look.copy(v.look).addScaledVector(side, Math.sin(t * 0.06 + 0.5) * 1.4); look.y += Math.sin(t * 0.05) * 0.3;
    W.camera.position.copy(at); W.camera.lookAt(look); setFov(v.fov);
  }
  function setFov(fov) { if (W.camera.fov !== fov) { W.camera.fov = fov; W.camera.updateProjectionMatrix(); } }

  // ── the player: the keys and the thumb stick (shared with Mathwood), the camera, the character ─────────────────
  const input = makeInput(canvas, { camera: W.camera, stick: { ring: 'rgba(170, 215, 255, .6)', back: 'rgba(10, 16, 24, .3)', knob: 'rgba(240, 150, 60, .75)' } });
  input.enabled = false;
  const chase = makeChase(W.camera, walls);
  let player = null, building = null, people = null;
  const auto = { way: null, i: 0 };       // (a rig walking the player somewhere: GAME.walkTo)
  const lib = await libP;
  T.setProgress(0.92, 'Waking the crew');
  // the chosen crew member's character, built ahead so the start button is quick
  // (a look changed or another crew member picked before this: built for the latest; one no longer wanted is let go)
  function prebuild(p) {
    if (!p || !p.look) return null;
    const key = p.id + ':' + JSON.stringify(p.look);
    if (building && building.key === key) return building.ready;
    const old = building;
    const ready = makePlayer({ lib, recipe: recipeOf(p.look), walls, scene: W.scene }).then((P) => { P.c.root.visible = false; return P; });
    building = { key, ready };
    if (old) old.ready.then((P) => { if (!player || player.P !== P) P.dispose(); }).catch(() => {});
    return ready;
  }
  canBuild = true;
  prebuild(chosen);

  // ── the menu button while walking (a phone has no Escape key) ─────────────────────────────────────────────────
  const menu = document.createElement('button');
  menu.className = 'hud-menu'; menu.type = 'button'; menu.innerHTML = 'Crew<kbd>Esc</kbd>'; menu.hidden = true;
  menu.setAttribute('aria-label', 'Back to the crew screen');
  menu.addEventListener('click', toTitle);
  document.getElementById('hud-root').appendChild(menu);

  // ── the clock ─────────────────────────────────────────────────────────────────────────────────────────────────
  let now = 0;
  const eyes = [];
  function tick(dt) {
    now += dt;
    const P = player && player.P;
    if (GAME.mode === 'title' || !P) drift(now);
    else {
      const move = auto.way ? autoMove() : input.move;
      P.update(dt, { move, run: auto.way ? auto.run : input.run, yaw: chase.yaw, others: people ? people.list : [] });
      chase.update(dt, { feet: P.pos, heading: P.heading, speed: P.speed, look: input.takeLook(), zoom: input.takeZoom() });
      setFov(60);
      P.c.root.visible = chase.near > 0.6;
      // (lit by the room they are in: a new room's light as they walk into it)
      if (GAME.frames % 10 === 0) { const z = W.zoneAt(P.pos); if (z && z !== P.zone) { P.zone = z; shine(P.c, W.envAt(P.pos)); } }
    }
    if (people) people.update(dt, { player: GAME.mode === 'play' ? P : null, camera: W.camera });
    eyes.length = 0;
    if (GAME.mode === 'play' && P) eyes.push(P.pos);
    if (people) eyes.push(...people.eyes());
    W.frame(dt, now, eyes);
    GAME.frames++;
  }
  let last = 0;
  if (!HOLD) W.renderer.setAnimationLoop((ms) => { const dt = last ? Math.min(0.05, (ms - last) / 1000) : 1 / 60; last = ms; tick(dt); });
  GAME.step = (dt = 1 / 60, n = 1) => { for (let i = 0; i < n; i++) tick(dt); };

  tick(1 / 60);
  canvas.classList.add('is-on');
  T.setProgress(1, 'Station ready');
  GAME.ready = true;

  // the people come aboard after the station is ready (the player wakes in their quarters, behind a shut door)
  if (!q.has('nopeople')) {
    GAME.peopleReady = false;
    makePeople({ W, walls, lib }).then((p) => { people = p; GAME.people = p; GAME.missing = p.missing; GAME.peopleReady = true; if (p.missing.length) console.info('people left out (the station has no such place): ' + p.missing.join(', ')); }).catch(fail);
  }

  // ── the start button: the chosen crew member, in their quarters ───────────────────────────────────────────────
  async function start(p) {
    GAME.player = p;
    const key = p.id + ':' + JSON.stringify(p.look);
    if (!player || player.key !== key) {
      const P = await prebuild(p);
      if (player && player.P !== P) player.P.dispose();
      const s = resolve(W, walls, START) || resolve(W, walls, { room: 'quarters' });
      if (!s) throw new Error('The station has no spot to start in (its spawn, or a room called quarters).');
      P.place(s.pos, s.heading ?? 0);
      P.zone = W.zoneAt(P.pos); shine(P.c, W.envAt(P.pos));
      player = { key, id: p.id, P };
      chase.snap(P.pos, P.heading);
    }
    GAME.mode = 'play';
    player.P.c.root.visible = true;
    input.enabled = true; menu.hidden = false;
    T.hide();
  }
  function toTitle() {
    if (GAME.mode !== 'play') return;
    GAME.mode = 'title'; input.enabled = false; menu.hidden = true; auto.way = null;
    T.show();
  }
  // back to the title (Escape)
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && GAME.mode === 'play') toTitle(); });

  // ── for the rigs: walk the player somewhere the way a player would (the stick pushed toward the next turn) ────
  const _w = new THREE.Vector3();
  function autoMove() {
    const P = player.P;
    // (held up a second, by someone in the way or pushed off the way round them: the way worked out again from here)
    auto.still = P.speed < 0.2 ? (auto.still || 0) + 1 : 0;
    if (auto.still > 40 && auto.to) { auto.still = 0; const w = walls.path(P.pos, auto.to); if (w) { auto.way = w; auto.i = 1; } }
    let goal = auto.way[auto.i];
    while (goal && Math.hypot(goal.x - P.pos.x, goal.z - P.pos.z) < 0.35) { auto.i++; goal = auto.way[auto.i]; }
    if (!goal) { auto.way = null; return { x: 0, y: 0, mag: 0 }; }
    _w.set(goal.x - P.pos.x, 0, goal.z - P.pos.z).normalize();
    const yaw = chase.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    return { y: _w.x * fx + _w.z * fz, x: _w.x * rx + _w.z * rz, mag: 1 };
  }
  GAME.walkTo = (spot, { run = false } = {}) => {
    const s = resolve(W, walls, spot); if (!s || !player) return false;
    const way = walls.path(player.P.pos, s.pos); if (!way) return false;
    auto.way = way; auto.i = 1; auto.run = run; auto.to = s.pos; auto.still = 0; return way.length;
  };
  GAME.walking = () => !!auto.way;
  GAME.where = () => (player ? { x: +player.P.pos.x.toFixed(2), y: +player.P.pos.y.toFixed(2), z: +player.P.pos.z.toFixed(2), heading: +player.P.heading.toFixed(2), room: (W.zoneAt(player.P.pos) || {}).id || null, cam: chase.near } : null);
  // the cost test: n more people standing in a block in front of the camera (alone: the station's own people put away)
  GAME.crowd = async (n, { alone = false } = {}) => {
    if (!people) return 0;
    for (const P of people.list.filter((x) => x.id.startsWith('extra-'))) people.remove(P);
    for (const P of people.list) P.hidden = alone;
    const c = W.camera, f = new THREE.Vector3(); c.getWorldDirection(f); f.y = 0; f.normalize();
    const r = new THREE.Vector3(-f.z, 0, f.x), base = player ? player.P.pos : c.position;
    let made = 0;
    for (let i = 0; made < n && i < n * 6; i++) {
      const row = Math.floor(i / 5), col = (i % 5) - 2;
      const x = base.x + f.x * (3 + row * 1.2) + r.x * col * 1.0, z = base.z + f.z * (3 + row * 1.2) + r.z * col * 1.0;
      const s = walls.snap(x, base.y + 0.4, z, 0.7); if (!s) continue;
      await people.add('civilian', s, Math.atan2(-f.x, -f.z)); made++;
    }
    return made;
  };
}

// where a new arrival stands, as a view (when the station file names no view at all)
function fromSpawn(W) {
  const s = W.R.spawn || {};
  return { at: new THREE.Vector3(...(s.at || [0, 1.6, 0])), look: new THREE.Vector3(...(s.look || [0, 1.6, 1])), fov: 60 };
}

boot().catch(fail);
