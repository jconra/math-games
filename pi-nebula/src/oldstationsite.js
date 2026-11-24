// AT THE OLD STATION, ON THE HAULER'S SUPPLY RUN (src/missions.js 'supply', its step 'deliver'; src/trip.js runs it as a
// rescue's planet is run, src/rescue.js): the far place, made unseen while the jump out is worked out and shown as the
// wormhole's colours are all round.
//
// THE GAME'S MAKER: "you don't fly it until you discover the other station and need to bring supplies to it. After that
// then you can go on hauling missions as much as you want to make money. It does have a dock, that is what the bridge is
// for." (HAUL3-6); of the old station, "Their own old bridge still stands: the Hauler docks to it and you walk across"
// (STA2-4 A); a red tint, worn, its power failing (STA2-2 A, the plan).
//
// WHAT IS HERE, all of it from pieces the game already has:
//   - THE OLD STATION'S OUTSIDE: the kit's own piece (kit/oldstation.js, as the Other Station Lab and Captain Vega's run
//     show it), at the middle of this place. While its power is failing few of its windows are lit; SAVED, most are (a
//     second build of the same piece: kit/oldstation-plan.js LIT_SAVED), shown from the moment its lights come up, and
//     from the start on every run after the first.
//   - THE HAULER, flown here by the game's one flying (src/flying.js, given a `body`, as over a rescue's planet), ITS
//     DOCK THE OLD STATION'S OWN BRIDGE: the same docking as at home (src/flymodel.js cfg.dock: the tiny ship and its
//     blue goal on the dashboard, the keys lit, the blue ship life size from behind; by hand, or the autopilot, T; the
//     crew's own pilot the same way). The old station's port and bridge stand as ours do to our station's (the same
//     kit bridge, kit/dockbridge.js; the same way round), so the Hauler lies at it exactly as at home, moved over:
//     HERE, the move from our dock to theirs (no turn).
//   - DOCKED: the dock's job's own docking (src/jobs/docklink.js DOCKING, as at home): its lights green, its crew door
//     lifted, a plate and a tunnel out from their bridge's end to the door (the kit's own, built here in their bridge's
//     place), its stair down.
//   - ON FOOT (the trip's on foot out at a far place, as on a rescue's planet): the crew member's own figure walks the
//     Hauler's rooms where it lies docked, out through its crew door, the tunnel, across their bridge, in through the
//     old station's dock airlock and into the hall behind it: the old station's own room file (kit/rooms/oldstation.json:
//     the kit's pieces, tinted red, its light worked out as it is built), with a walking world of its own (src/walls.js)
//     made of those rooms, the Hauler's cabin and hull and the bridge. All of it is worked out in our own station's
//     places (the old rooms are built in the cells our airlock has) and DRAWN moved by HERE, so nothing of the walking
//     is turned or measured twice.
//   - ITS PEOPLE: three of them wait in the hall, in their own clothes; as the crew member comes in they thank the crew
//     by name of what was brought (src/lines.js OLD_STATION). THE SUPPLIES ARE UNLOADED off screen, by its people and
//     the crew, a pallet every few seconds from the moment the Hauler is docked (the count on the trip's strip).
//   - ITS LIGHTS COME BACK UP as the fuel cells arrive, with its people's word for it, the crew member there to see it:
//     the hall and the airlock as built with their lights on take the place of the same rooms built dark, and outside
//     its windows are lit. THE STATION IS SAVED.
//   - THEN HOME: back aboard, the Hauler lets go of their bridge, flies clear (by hand, the autopilot, or the crew's
//     pilot), and the trip's jump home.
//   - NOBODY HAS TO GO ACROSS: a crew member who stays aboard sees its windows light up a little after the last pallet
//     is off, and the run goes on by itself.
//   - A PART NOT THEIRS CAN BE SKIPPED (K): the crew's pilot's flying in, docked at once; the visit (the supplies off
//     and its lights up at once, wherever the crew member is); the crew's pilot's flying clear.
// What is not made (left to the crew, off screen): the pallets themselves seen coming off, its people walking about.
//
//   const site = makeSite(ctx, opts)     ctx: { W, boarding, keeper, ship (boarding's record), cfg (src/fleet.js flightOf),
//       lib, startFlying, people (the station's people: for a figure built from a look), dock (src/dockwalk.js: the
//       bridge as built at home) }; opts: { pilot, flier, settings, onSettings, dash, run, crew, recipe, pallets, again
//       (the old station saved before), name (the crew member's) }
//   site.ready, site.failed          made (unseen), or could not be
//   site.open(view)                  shown, the Hauler out from the old station's bridge side, the flying begun
//   site.go()                        the trip's step begun: the flying is whoever's it is
//   site.phase                       'above' | 'fly' | 'seal' | 'docked' | 'unseal' | 'away' | 'up' (clear: the jump home)
//   site.ground, site.foot, site.footIn, site.putFoot, site.hideFoot, site.toPlanet, site.toStation, site.walk   on foot
//   site.lines()                     the words waiting to be said, each once: [{ who, w }]
//   site.count { aboard, of }        pallets unloaded, of how many;  site.words  the strip's words now
//   site.visited, site.saved, site.canSkip, site.skipWords, site.skip()
//   site.update(dt), site.aim(camera, dt), site.late(dt), site.state(), site.close()
import * as THREE from 'three';
import { loadRoom, buildRoom, updateDoors, setDoors } from '../kit/layout.js';
import { makeMaterials, shieldMaterial } from '../kit/materials.js';
import { buildOldStation, bridgeMatrix } from '../kit/oldstation.js';
import { OLD_LOOK, LIT_SAVED } from '../kit/oldstation-plan.js';
import { hullMaterials } from '../kit/hull.js';
import { tunnelMeshes, DOCKING } from './jobs/docklink.js';
import { makeWalls } from './walls.js';
import { makePlayer } from './player.js';
import { makeChase } from './chase.js';
import { facing, planLand, planLeave, dockOff } from './flymodel.js';
import { CABIN_WALLS } from './boarding.js';
import { WALK } from './dockwalk.js';
import { OLD_STATION } from './lines.js';

// the ship's kit frame (x to port, y up, z to its nose) in the flight model's own [ahead, up, right]
const KIT = new THREE.Matrix4().makeRotationY(Math.PI / 2);
// WHERE THE HAULER COMES OUT OF THE JUMP: this far out from the old station's bridge side and along it, a little up,
// nose toward the station; how far from their bridge counts as clear of it for the jump home (m); how long the docking
// takes (s: the dock's job's own clock, DOCKING) and the letting go; how often a pallet comes off (s); how long after
// its people's word the lights take to come up, and to steady (s)
// (idle: nobody came across: how long after the last pallet its lights come up all the same, and everything is done, s)
export const SITE = { out: 230, along: 60, up: 24, clear: 150, seal: DOCKING.stair[1], unseal: 3, each: 6, first: 4, flicker: 1.6, near: 0.08, idle: [3, 8] };
// THE OLD ROOMS' LOOK: the kit's own materials taken toward red and down (worn, its power failing), and a little less so
// with its lights back up; its people's looks (the crew kit's, their own clothes, nobody's uniform)
export const OLD_ROOMS = { dim: [0.66, 0.34, 0.3], lit: [0.97, 0.76, 0.7] };
export const OLD_PEOPLE = [
  { suit: 'civilian', head: 't4', hair: 'ponytail', colours: { job: 'staff', uniform: '#7a4a3c', skin: '#d9a37f', hair: '#8f8a84' } },
  { suit: 'dockWorker', head: 't6', hair: 'curlyShort', colours: { job: 'staff', uniform: '#6b5140', skin: '#663b22', hair: '#17110d' } },
  { suit: 'smelter', head: 't10', hair: 'crop', colours: { job: 'staff', uniform: '#84402f', skin: '#e8bf9f', hair: '#5a3a22' } },
];
// the move from where the Hauler is docked at home to where it is docked here (our port's place to theirs; both ports
// face the same way, so no turn): worked out from the two bridges' own frames
export function hereFrom(homeFrame) { return new THREE.Matrix4().multiplyMatrices(bridgeMatrix(), new THREE.Matrix4().copy(homeFrame).invert()); }

export function makeSite(ctx, opts = {}) {
  const { W, boarding, keeper, ship: S, cfg: shipCfg, lib, startFlying, dock } = ctx;
  const iPilot = !!opts.pilot, again = !!opts.again, of = Math.max(1, Math.floor(+opts.pallets || 3));
  const st = { phase: 'made', t: 0, ready: false, failed: false, closed: false, words: '', unloaded: 0, unloadT: 0, visited: false, saved: again, skipped: false, lightsT: -1, said: 0, sayT: 0, lit: again, ground: false, clear: false, times: {} };
  const group = new THREE.Group(); group.name = 'the old station (the supply run)'; group.visible = false; W.scene.add(group);
  // (HERE: where everything worked out in our station's places is drawn; a move, no turn)
  const HERE = hereFrom(dock.boarding.frame()), here = new THREE.Vector3().setFromMatrixPosition(HERE);
  const moved = new THREE.Group(); moved.name = 'the old station: its rooms and who walks them'; moved.matrixAutoUpdate = false; moved.matrix.copy(HERE); group.add(moved);
  let fl = null, cfg = null, outside = null, rooms = null, tunnel = null, F = null, folk = [], lines = [], goal = 'land';
  const own = [];

  // ── MADE, unseen ──
  (async () => {
    const t0 = performance.now();
    try {
      // its outside: as it is found (nearly dark), and as it is once saved; its real airlock behind the port
      const mk = (lit) => { const mats = hullMaterials(OLD_LOOK), shield = shieldMaterial(), B = buildOldStation(OLD_LOOK, mats, { shield, seed: 7, inside: true, ...(lit ? { lit: LIT_SAVED } : {}) }); group.add(B.group); own.push(() => { B.dispose(); for (const m of new Set(Object.values(mats))) if (m && m.dispose) m.dispose(); if (shield.dispose) shield.dispose(); }); return B; };
      outside = { dark: again ? null : mk(false), lit: null, mk };
      if (again) outside.lit = mk(true);
      // (out in space, the place's own sun and a little light from all round, as the Other Station Lab lights it; inside
      // the old rooms they are taken down to nothing: update)
      const sun = new THREE.DirectionalLight(0xfff0dc, 3.0), fill = new THREE.HemisphereLight(0xa9b8d6, 0x2a3038, 0.9);
      sun.position.set(-300, 420, 160); sun.target.position.set(0, 0, 0); group.add(sun, sun.target, fill); outside.sun = sun; outside.fill = fill;
      st.times.outside = Math.round(performance.now() - t0);
      // its rooms: the room file built with its lights out (but one), and, for when they come up, with them on
      const R = await loadRoom(new URL('../kit/rooms/oldstation.json', import.meta.url).href);
      if (st.closed) return;
      const tinted = (k) => { const mats = makeMaterials(); for (const m of new Set(Object.values(mats))) if (m && m.color) m.color.multiply(new THREE.Color(k[0], k[1], k[2])); own.push(() => { for (const m of new Set(Object.values(mats))) if (m && m.dispose) m.dispose(); }); return mats; };
      // (its power failing: every ceiling light but the hall's first is a plain panel, and the walls' light strips are
      // out but for the airlock's own)
      let kept = 0;
      const dark = { ...R, rooms: R.rooms.map((z) => ({ ...z, pieces: z.pieces.map((p) => (p.piece === 'ceiling' && p.variant === 'light' && !(z.id === 'old-hall' && kept++ === 0) ? { ...p, variant: 'panel' }
        : p.piece === 'rib' && p.variant === 'strip' && z.id === 'old-hall' ? { ...p, variant: 'plain' } : p)) })) };
      const build = (room, k) => { const B = buildRoom(room, tinted(k), { bake: { voxel: 0.1, rays: 12 } }); setDoors(B.doors, 0); B.group.traverse((o) => { if (o.isMesh && o.material) o.material.fog = false; }); moved.add(B.group); own.push(() => B.dispose()); return B; };
      rooms = { R, lit: again ? build(R, OLD_ROOMS.lit) : null, dark: again ? null : build(dark, OLD_ROOMS.dim), build: () => build(R, OLD_ROOMS.lit) };
      st.times.rooms = Math.round(performance.now() - t0);
      await new Promise((r) => setTimeout(r, 0));
      if (st.closed) return;
      // their bridge's plate and tunnel (the kit's own, as at home), in their bridge's place: out as the Hauler docks
      const H = W.dockShip, tm = makeMaterials(); for (const m of Object.values(tm)) m.fog = false;
      own.push(() => { for (const m of new Set(Object.values(tm))) if (m && m.dispose) m.dispose(); });
      tunnel = tunnelMeshes(H.tunnel, tm, bridgeMatrix()); tunnel.group.matrixAutoUpdate = false; tunnel.group.matrix.copy(bridgeMatrix()); tunnel.group.visible = false; group.add(tunnel.group);
      // where a person walks here: the old rooms; the Hauler's cabin and what of its hull a person meets, as it lies
      // docked; the bridge with its plate and tunnel (the very shapes walked at home)
      const built = rooms.dark || rooms.lit, walls = makeWalls({ zones: built.zones, doors: built.doors });
      // (their port's outer door leads out onto their bridge here: not a door to nowhere)
      for (const d of walls.doors) if (d.D.piece === 'airlock') d.locked = false;
      {
        const solid = [], up = [], doors = [], _b = new THREE.Box3(), _m = new THREE.Matrix4(), C = S.cabin.C;
        for (const z of C.built.zones) for (const k of ['solid', 'floor', 'glass']) {
          const g = z.merged[k]; if (!g) continue;
          const w = new THREE.BufferGeometry(); w.setAttribute('position', g.attributes.position.clone()); w.setIndex(g.index); w.applyMatrix4(S.M0);
          solid.push(w); if (k !== 'glass') up.push(w);
        }
        for (const D of C.built.doors) {
          const box = new THREE.Box3();
          for (const leaf of D.leaves) for (const im of leaf.meshes || []) { if (!im.geometry.boundingBox) im.geometry.computeBoundingBox(); box.union(_b.copy(im.geometry.boundingBox).applyMatrix4(_m.copy(leaf.M).multiply(leaf.base))); }
          if (!box.isEmpty()) doors.push({ D, box: box.applyMatrix4(S.M0) });
        }
        const h = S.dock.walls(); solid.push(...h.solid); up.push(...h.up);
        walls.add('hauler', { solid, up, doors, voxel: CABIN_WALLS.voxel, r: CABIN_WALLS.r });
        const B = dock.made; if (B) walls.add('bridge', { solid: B.solid, up: B.up, voxel: WALK.voxel, r: WALK.r, box: B.box });
      }
      st.times.walls = Math.round(performance.now() - t0);
      // the crew member's own figure, to walk here; and its people, where they wait in the hall
      const player = await makePlayer({ lib, recipe: opts.recipe, walls, scene: moved });
      if (st.closed) { player.dispose(); return; }
      player.c.root.visible = false;
      F = { walls, player, chase: makeChase(W.camera, walls), shown: false };
      own.push(() => player.dispose());
      const pp = ctx.people ? ctx.people() : null, spots = (R.places && R.places.people) || [];
      if (pp && pp.figure) for (let i = 0; i < Math.min(OLD_PEOPLE.length, spots.length); i++) {
        const c = await pp.figure(OLD_PEOPLE[i]); if (st.closed) return; if (!c) continue;
        c.root.position.set(...spots[i].at); c.root.rotation.set(0, spots[i].heading || 0, 0); moved.add(c.root); folk.push({ c, at: new THREE.Vector3(...spots[i].at) });
        own.push(() => { c.root.removeFromParent(); if (c.dispose) c.dispose(); });
      }
      st.times.made = Math.round(performance.now() - t0);
      st.ready = true;
    } catch (e) { console.error('the supply run: the old station could not be made', e); if (window.oops) window.oops(e); st.failed = true; }
  })();

  // ── THE SHIP DRAWN WHERE IT IS: its hull by its keeper and its cabin by boarding, the one matrix from where it is
  // docked at home to where it is now ──
  const _D = new THREE.Matrix4(), _i = new THREE.Matrix4(), _acc = new THREE.Vector3();
  function drawShip(M, dt = 0) {
    _D.multiplyMatrices(M, _i.copy(S.M0).invert());
    const still = !!(fl && fl.S.landed);
    keeper.fly(_D, dt, { acc: fl ? _acc.set(-fl.S.acc[2], fl.S.acc[1], fl.S.acc[0]) : _acc.set(0, 0, 0), spin: fl ? fl.S.spin : 0, hold: 0, engine: still ? 0.15 : fl ? fl.S.engine : 0.3, heat: 1, x: 0, z: 0, height: null });
    boarding.fly(S.id, _D);
  }
  // (nothing to bump into out here but the old station itself, which nobody is kept out of yet: the view from behind is
  // never cut short)
  const solid = { reach: 3, dist: () => 99, away: (x, y, z, out) => { out[0] = out[1] = out[2] = 0; return out; }, push: () => false, clear: () => 1 };

  // ── AS THE COLOURS ARE ALL ROUND: shown, the Hauler out from the old station's bridge side ──
  function open(view = 'cockpit') {
    if (!st.ready || fl || st.closed) return false;
    group.visible = true;
    // (its dock here: where it is docked at home, moved over; clear of their bridge is so far from it)
    const P = shipCfg.pad, A = shipCfg.dock.away;
    cfg = { ...shipCfg, pad: [P[0] + here.x, P[1] + here.y, P[2] + here.z], bay: null, floor: null, others: null, far: SITE.clear + 20 };
    const p = [cfg.pad[0] + A[0] * SITE.out, cfg.pad[1] + SITE.up, cfg.pad[2] - SITE.along], f = [-A[0], 0, 0.25];
    fl = startFlying({ W, boarding: null, crane: null }, {
      cfg, goal: 'land', pilot: iPilot, flier: opts.flier || 'The pilot', view, settings: opts.settings || null, onSettings: opts.onSettings || null,
      words: () => {}, ...(opts.dash ? { dash: opts.dash, run: opts.run } : {}),
      // (docked: its controls put away until it lets go of their bridge again)
      onLanded: () => { if (st.phase === 'fly' || st.phase === 'above') { setPhase('seal'); if (fl) fl.lock(true); } },
      body: { at: new THREE.Matrix4(), M0: KIT, p, f, fly: (M, dt) => drawShip(M, dt), solid, plan: (s) => (goal === 'land' ? planLand(s) : planLeave(s)), far: 6000 },
    });
    fl.lock(true);
    st.phase = 'above'; st.t = 0;
    fl.put(p, facing(f));
    return true;
  }
  function setPhase(p) { st.phase = p; st.t = 0; }
  const say = (who, w) => lines.push({ who, w: String(w).replace(/\{player\}/g, opts.name || 'friend') });
  // THE DOCKING HERE, k of the way through it (the dock's job's own clock, as at home: src/dockwalk.js seal): the
  // Hauler's own door, stair and lights by its own bridge's code; their tunnel out from their bridge's end
  const _sc = new THREE.Matrix4(), _sh = new THREE.Matrix4(), part = (s, [a, b]) => Math.max(0, Math.min(1, (s - a) / (b - a))), ease = (x) => x * x * (3 - 2 * x);
  function seal(k) {
    dock.seal(k);
    if (!tunnel) return;
    const s = k * DOCKING.stair[1], z0 = W.dockShip.tunnel.z0, kt = Math.max(0.02, ease(part(s, DOCKING.tunnel)));
    tunnel.group.visible = s >= DOCKING.tunnel[0];
    tunnel.tube.matrix.makeTranslation(0, 0, z0).multiply(_sc.makeScale(1, 1, kt)).multiply(_sh.makeTranslation(0, 0, -z0)); tunnel.tube.matrixWorldNeedsUpdate = true;
  }
  // ITS LIGHTS BACK UP: the rooms built with their lights on in place of the dark ones, its windows lit outside
  function lightsUp() {
    if (st.lit) return;
    st.lit = true;
    if (!rooms.lit) rooms.lit = rooms.build();
    if (!outside.lit) outside.lit = outside.mk(true);
    // (their doors as the dark rooms' are just now, so nothing jumps)
    if (rooms.dark) rooms.lit.doors.forEach((D, i) => { const d = rooms.dark.doors[i]; if (d) setDoors([D], d.t); });
    show();
  }
  function show(flick = 1) {
    const lit = st.lit && flick > 0.5;
    if (rooms.lit) rooms.lit.group.visible = lit; if (rooms.dark) rooms.dark.group.visible = !lit;
    if (outside.lit) outside.lit.group.visible = lit; if (outside.dark) outside.dark.group.visible = !lit;
  }
  const WORDS = {
    above: () => '', fly: () => (iPilot ? (fl && fl.auto ? 'The autopilot docks at Tangent Station\'s bridge' : 'Dock at Tangent Station\'s bridge: line up with the blue ship') : `${opts.flier} flies in to Tangent Station's bridge`),
    seal: () => 'Docking', docked: () => (st.done && st.unloaded >= of ? 'Tangent Station has its supplies: back aboard' : st.visited ? (st.unloaded >= of ? 'With Tangent Station\'s people' : 'The supplies are coming off') : 'Docked: across the bridge to meet its people'),
    unseal: () => 'Letting go of their bridge', away: () => (iPilot ? (fl && fl.auto ? 'The autopilot flies clear' : 'Undock and fly clear of Tangent Station') : `${opts.flier} flies clear`), up: () => '',
  };
  const _f = new THREE.Vector3(), _c = new THREE.Vector3(), inRooms = (p) => p.x > -15.1 && p.x < -0.9 && p.z > 27 && p.z < 35.2 && p.y < 4;
  const footIn = () => !!(F && F.shown && boarding.inside(F.player.pos) === S);
  const site = {
    get ready() { return st.ready; }, get failed() { return st.failed; }, get fl() { return fl; }, get phase() { return st.phase; }, get words() { return st.words; },
    get matrix() { return fl ? fl.matrix : S.M; },
    get down() { return !!(fl && fl.S.landed && st.phase !== 'above' && st.phase !== 'fly'); },
    get count() { return { aboard: st.unloaded, of }; },
    get visited() { return st.visited; }, get saved() { return st.saved; }, get lit() { return st.lit; },
    // (at the controls: flying it by hand, in or away)
    get atControls() { return iPilot && !!fl && !fl.auto && !fl.locked && !fl.S.landed; },
    // (walkable: docked and sealed, until the Hauler lets go)
    get ground() { return st.ground && !!F; },
    get foot() { return F && F.shown ? F.player : null; },
    get footIn() { return footIn(); },
    // (everything walked here is worked out in our station's own places: nothing to turn)
    toPlanet: (v) => v, toStation: (v) => v,
    putFoot(pos, heading = 0) {
      if (!F) return false;
      const s = F.walls.snap(pos.x, pos.y + 0.5, pos.z, 2.5, CABIN_WALLS.r) || pos.clone();
      F.player.place(s, heading); F.chase.snap(F.player.pos, heading); F.player.c.update(0.5); F.player.c.root.visible = true; F.shown = true;
      if (W.camera.near !== SITE.near) { F.near0 = W.camera.near; W.camera.near = SITE.near; W.camera.updateProjectionMatrix(); }
      return true;
    },
    hideFoot() { if (!F) return; F.player.c.root.visible = false; F.shown = false; if (F.near0 != null) { W.camera.near = F.near0; W.camera.updateProjectionMatrix(); F.near0 = null; } },
    // on foot here: the crew member walks (the trip's input), the camera behind them, all of it drawn moved by HERE
    walk(dt, { move = null, run = false, look = null, zoom = 0, others = [] } = {}) {
      if (!F || !F.shown) return;
      const all = [...others, ...folk.map((p) => ({ pos: p.at, walking: false, hidden: false, away: false }))];
      // (a rig walking them somewhere, walkTo: straight at each next point of the way worked out, as the game's own
      // GAME.walkTo walks the station)
      let yaw = F.chase.yaw;
      if (F.way) {
        while (F.way.length && Math.hypot(F.way[0].x - F.player.pos.x, F.way[0].z - F.player.pos.z) < 0.22) F.way.shift();
        if (F.way.length) { move = { x: 0, y: 1, mag: 1 }; yaw = Math.atan2(F.way[0].x - F.player.pos.x, F.way[0].z - F.player.pos.z); } else F.way = null;
      }
      F.player.update(dt, { move, run, yaw, others: all });
      F.chase.update(dt, { feet: F.player.pos, heading: F.player.heading, speed: F.player.speed, look: look || { dx: 0, dy: 0 }, zoom });
      F.player.c.root.visible = F.chase.near > 0.4;
      W.camera.position.add(here); W.camera.updateMatrixWorld();
    },
    open,
    lines() { const L = lines; lines = []; return L; },
    // (for the rigs: the crew member on foot here walked to a spot by the way the walls work out; walking: still on it)
    walkTo(at) { if (!F || !F.shown) return 0; const to = F.walls.snap(at[0], at[1] + 0.5, at[2], 2.5, CABIN_WALLS.r), way = to ? F.walls.path(F.player.pos, to) : null; F.way = way && way.length ? [...way] : null; return F.way ? F.way.length : 0; },
    get walking() { return !!(F && F.way); },
    go() { if (st.phase !== 'above') return false; setPhase('fly'); fl.lock(false); return true; },
    // A PART NOT THEIRS, SKIPPED: the crew's pilot's flying in (docked at once); the visit (the supplies off, its
    // lights up); the crew's pilot's flying clear
    get canSkip() { return ((st.phase === 'fly' || st.phase === 'away') && !iPilot) || (st.phase === 'docked' && !(st.done && st.unloaded >= of)); },
    get skipWords() { return st.phase === 'fly' ? 'Skip the docking' : st.phase === 'away' ? 'Skip the flying' : !st.visited ? 'Skip the visit' : st.unloaded < of ? 'Skip the unloading' : 'Skip ahead'; },
    skip() {
      // (the flying's own skip: docked at once, as it lies there; clear of the bridge at once)
      if ((st.phase === 'fly' || st.phase === 'away') && fl) return fl.skip();
      if (st.phase === 'docked') { st.skipped = true; st.unloaded = of; st.said = 1e9; if (!st.lit) { lightsUp(); st.lightsT = -1; } return true; }
      return false;
    },
    // (the crew member is aboard and everything here is done: the Hauler lets go; the trip asks once they are in)
    leave() { if (st.phase !== 'docked') return false; st.ground = false; setPhase('unseal'); return true; },
    get doneHere() { return st.phase === 'docked' && !!st.done && st.unloaded >= of; },
    update(dt) {
      if (st.closed) return;
      st.t += dt;
      st.words = (WORDS[st.phase] || (() => ''))();
      if (!fl) return;
      fl.update(dt);
      if (st.phase === 'seal') {
        // (while it docks, a quiet moment: its rooms with their lights on, and its outside with its windows lit, are
        // built unseen, one and then the other, so nothing is built at the moment its lights come up)
        if (!again && !st.pre) { st.pre = 1; if (!rooms.lit) { rooms.lit = rooms.build(); rooms.lit.group.visible = false; } }
        else if (!again && st.pre === 1) { st.pre = 2; if (!outside.lit) { outside.lit = outside.mk(true); outside.lit.group.visible = false; } }
        seal(Math.min(1, st.t / SITE.seal));
        if (st.t >= SITE.seal) { st.ground = true; setPhase('docked'); }
      } else if (st.phase === 'docked') {
        // (the supplies come off, off screen: the fuel cells first)
        st.unloadT += dt;
        while (st.unloaded < of && st.unloadT >= (st.unloaded ? SITE.each : SITE.first)) { st.unloadT -= st.unloaded ? SITE.each : SITE.first; st.unloaded++; }
        // (the crew member in the hall: its people's words, one after another; its lights up with their word for it)
        const p = F && F.shown ? F.player.pos : null;
        if (p && !st.visited && p.x > -9.4 && inRooms(p)) { st.visited = true; st.sayT = 0.4; }
        if (st.visited) {
          const L = again ? OLD_STATION.again : OLD_STATION.first;
          st.sayT -= dt;
          if (st.said < L.length && st.sayT <= 0 && !(L[st.said].lights && st.unloaded < 1)) {
            const l = L[st.said++]; say('Tangent Station', l.w); st.sayT = Math.min(7, 2.6 + l.w.length * 0.06);
            if (l.lights && !st.lit) { lightsUp(); st.lightsT = 0; }
          }
        }
        // (its lights coming up: a flicker, then steady)
        if (st.lightsT >= 0) { st.lightsT += dt; const k = st.lightsT / SITE.flicker; show(k >= 1 ? 1 : (Math.sin(st.lightsT * 31) > 0.2 - k * 0.9 ? 1 : 0)); if (k >= 1) st.lightsT = -1; }
        // (nobody came across, the crew member staying aboard: once every pallet is off its lights come up all the same,
        // and a little after that everything here is done; not while they are out on the bridge on their way over)
        const outNow = !!p && !footIn();
        if (!st.visited && !outNow && st.unloaded >= of) st.idleT = (st.idleT || 0) + dt;
        if (!st.lit && !st.visited && (st.idleT || 0) > SITE.idle[0]) { lightsUp(); st.lightsT = 0; }
        // (saved: its lights up, and its people have had their say (or the visit was skipped, or never made))
        if (!st.done && st.lit && st.lightsT < 0 && (st.skipped || (st.visited ? st.said >= (again ? OLD_STATION.again : OLD_STATION.first).length && st.sayT <= 0 : !outNow && (st.idleT || 0) > SITE.idle[1]))) { st.done = true; st.saved = true; }
      } else if (st.phase === 'unseal') {
        seal(Math.max(0, 1 - st.t / SITE.unseal));
        if (st.t >= SITE.unseal) { goal = 'leave'; fl.goal = 'leave'; fl.lock(false); setPhase('away'); }
      } else if (st.phase === 'away') {
        if (st.clear || (!fl.S.landed && dockOff(fl.S).dist > SITE.clear)) { st.clear = true; fl.lock(true); setPhase('up'); }
      }
      // (the old rooms' and the Hauler's doors, for whoever walks here; shut while nobody may)
      const eye = F && F.shown ? _f.copy(F.player.pos) : null;
      for (const B of [rooms.dark, rooms.lit]) if (B) updateDoors(B.doors, eye || _f.set(0, -999, 0), dt, st.ground && eye ? 'auto' : 'shut');
      for (const p of folk) p.c.update(dt);
      // (the sun and the light from all round are for outside: inside the old rooms they are taken down to nothing)
      _c.copy(W.camera.position).sub(here);
      const inside = inRooms(_c) ? 1 : 0; st.in = st.in == null ? inside : st.in + (inside - st.in) * Math.min(1, dt * 4);
      outside.sun.intensity = 3.0 * (1 - st.in); outside.fill.intensity = 0.9 * (1 - st.in);
    },
    aim(camera, dt) { if (fl) fl.aim(camera, dt); },
    late() { if (fl) fl.late(); },
    state: () => ({ phase: st.phase, t: +st.t.toFixed(2), ready: st.ready, failed: st.failed, words: st.words, unloaded: st.unloaded, of, visited: st.visited, saved: st.saved, lit: st.lit, skipped: st.skipped, ground: st.ground, foot: F && F.shown ? F.player.pos.toArray().map((v) => +v.toFixed(2)) : null, footIn: footIn(), folk: folk.length, said: st.said, times: st.times,
      docked: !!(fl && fl.S.landed), p: fl ? fl.S.p.map((v) => +v.toFixed(2)) : null, off: fl && cfg ? +dockOff(fl.S).dist.toFixed(2) : null, auto: fl ? fl.auto : null, pad: cfg ? cfg.pad : null, here: here.toArray(), sealed: dock.sealed, doneHere: site.doneHere }),
    // (for the rigs: points of the way across, in our station's own places, as the walking here has them)
    spots: () => { const R = rooms && rooms.R, sp = dock.spots ? dock.spots() : null; return { ...(sp || {}), airlock: [-13, 0.47, 31], hall: (R && R.places && R.places.hall) || [-5, 0, 31], thanks: (R && R.places && R.places.thanks) || [-7.2, 0, 31] }; },
    close() {
      if (st.closed) return; st.closed = true;
      site.hideFoot();
      if (fl) { fl.close(); fl = null; }
      keeper.fly(null); boarding.fly(S.id, null);
      for (const d of own) { try { d(); } catch (e) { /* gone */ } }
      group.removeFromParent();
    },
  };
  return site;
}
