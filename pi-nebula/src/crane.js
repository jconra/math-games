// THE SMELTER'S CRANE, in the game: the bridge crane in the Miner hangar swaps the parked Miner's ore canisters by
// itself while someone is there to watch (the game's maker, 2026-11-05: "it would be cool if a ceiling crane started
// grabbing the canisters off the ship and connecting them to the wall socket"), and from the operator's chair it is
// worked by the crane game's sums or by hand (src/jobs/crane.js, src/cranedrive.js).
// The round itself is the kit's (kit/crane.js finds the parts and moves them, kit/crane-plan.js is the timetable);
// working it by hand is the kit's too (kit/crane-drive.js); this file is the game's part of it:
//   - THE CLOCK. The round runs only while the hangar is being drawn, or a room with a window onto it (the control
//     room); otherwise nothing is worked out at all. When the round's work is done the crane parks and nothing more
//     happens (the game's maker, 2026-11-16: "once the crane work is done it shouldn't automatically start again. Now
//     the ship is ready to go out").
//   - THE NEXT HAUL. Once the player has left the hangar's area (the hangar, the way into it, the smelter's rooms) and
//     it is out of sight, the Miner is away on a run; when the hangar is next in sight it comes in to land (through
//     the bay door, a turn over the pad, its legs down, down onto the pad: LANDING), full again, and the round starts
//     over ("if the player is walking towards that hanger it could show the ship just coming in for landing so now it
//     needs to be unloaded"). Missions and contracts come later: `haul` is where they will hook in.
//   - DRAWN WITH ITS ROOM. The moving parts are the kit's door leaves, hung on the hangar's own room, so they are drawn
//     only when it is.
//   - NOBODY UNDER A LOAD, by itself. The crane knows the patch of floor it is about to work over; while anyone stands
//     on it, or within RULES.margin of it, the crane slows to a stop and waits, its beacons flashing.
//   - BY HAND, NO RULES (the game's maker: "If people are in the way then they should start to run away and it should
//     post a notice saying you committed a safety violation (as a joke)"): a load brought low over someone sends them
//     running (src/people.js flee), and C.violation says so (free control shows the notice).
//   - TAKING THE CONTROLS AND GIVING THEM BACK. take(): the round runs on to its next moment with nothing half done,
//     and from there the crane is live (crane.live: kit/crane-drive.js). give(): the live crane lets go of a canister
//     that is resting, works its way up, and the round takes over from where everything is (crane-plan.js planFrom).
//   - THE LOAD SWINGS a little after a move (the game's maker: "I was also thinking it should swing"): drawn only, a
//     pendulum driven by the trolley's and bridge's starting and stopping; what it touches is worked out on the still
//     load, so it never swings into anything.
//   - THE CAMERAS (the crane's View button, and the chair's screens): the station file's views on the hangar's walls
//     (miner-cam-*), one on the trolley looking straight down, and the plan from above for the grid (src/jobs/crane.js).
//   - THE SCREENS on the trolley: the crane's x, y and height, as the grid counts them (place 'crane' grid).
//
//   const crane = makeCrane({ W, walls, boarding })
//   crane.update(dt, { eyes, player, people })   once a frame, before the picture
//   crane.take() / crane.give()    the controls (crane.mode: 'round' | 'handover' | 'live' | 'leaving' | 'landing' | 'away')
//   crane.load()                   the load in plain numbers, and for how long each stays as it is (the smelter job)
//   crane.grid(x, z) -> [gx, gy]   a point of the station as the grid counts it (metres from the hangar's south-west)
//   crane.cams()                   the cameras: [{ name, at, look, fov }]
//   crane.t, crane.round, crane.waiting, crane.seek(t), crane.skip(seconds), crane.pose(), crane.land(), crane.away()   (rigs)
import { makeOreLine } from '../kit/crane.js';
import { makeDrive, DRIVE } from '../kit/crane-drive.js';
import { Voxels } from '../kit/bake.js';
import { updateDoors, setDoors } from '../kit/layout.js';
import * as THREE from 'three';
import * as MB from '../kit/ships/miner-built.js';
import { LOADS } from './jobs/smelter.js';

export const RULES = {
  margin: 0.9,      // how far beyond the canister's own patch of floor a person stops it (metres)
  ahead: 1.5,       // it holds this long (seconds) before it would start over a patch someone is on
  ease: 2.5,        // how quickly it slows to a stop and picks up again (the larger the quicker)
  flash: 0.8,       // the beacons' flash (seconds on and off together)
  travel: 1.6,      // ... their slower flash while the crane is worked by hand and moving
  head: 2.4,        // people higher than this over the floor are not under it (the catwalk)
  scare: 1.4,       // by hand: anyone this near (m) under a load lower than DRIVE.low runs off
};
// THE HANGAR'S AREA: leaving it (and it out of sight) sends the Miner away; its rooms, by the station file's ids
export const AREA = /^(hangar-miner|stub-miner|smelter-|ship-miner)/;
// THE LANDING: seconds in all; where it comes in from (m out past the bay door, along the ship's nose line); its
// height over the pad while it comes in and turns (its top under the bay door's lintel and the roof's lamps); when
// its legs come down; the turn
export const LANDING = { secs: 19, from: 46, hover: 3.0, turnFrom: 0.36, turnTo: 0.62, legs: 0.62, down: 0.7 };
// THE SWING: how long a swing takes (a pendulum of about the cables' length), how quickly it dies away, and the most
// it swings (radians)
export const SWING = { period: 3.2, damp: 0.55, most: 0.06 };
export const REACH = { voxel: 0.06, pad: 0.5 };

export function makeCrane({ W, walls, boarding = null }) {
  const L = makeOreLine(W.built, { rail: W.R?.places?.crane || null });
  if (!L) { console.info('crane: the station has no ore line'); return { on: false, mode: 'none', update() {}, load: () => null, pose() {}, take: () => false, give() {}, command() {}, cams: () => [], grid: (x, z) => [x, z] }; }
  // its room (the hangar the crane's own piece is in), and the rooms that look into it through a window (an opening
  // between two rooms that does not reach the floor)
  const room = W.room(L.doors[0].zone);
  const lookers = (W.R.portals || []).filter((P) => !P.door && P.box[0][1] > 0.5 && (P.a === room.id || P.b === room.id)).map((P) => W.room(P.a === room.id ? P.b : P.a)).filter(Boolean);
  for (const im of L.meshes) room.group.add(im);
  // the station's frame leaves these doors to the crane; where people walk, a part low enough to walk into stays in
  // the way for good (the rack's canisters: a bay is never somewhere to stand), a part overhead is no door at all
  for (const D of L.doors) { W.driven.add(D); W.keepShut.delete(D); }
  for (let i = walls.doors.length - 1; i >= 0; i--) { const d = walls.doors[i]; if (!L.doors.includes(d.D)) continue; if (d.box.min.y > 1.75) walls.doors.splice(i, 1); else d.locked = true; }
  const site = L.site, grid0 = site.grid.origin;
  const grid = (x, z) => [x - grid0[0], grid0[1] - z];

  let t = 0, rate = 1, flash = 0, mode = 'round', handAt = null, live = null, cmd = {}, voxels = null, eyesNow = [];
  const world = { solid: (x, y, z) => voxels.full(x, y, z), get eyes() { return eyesNow; } };
  const oreOf = () => LOADS[L.round % LOADS.length] / 10;   // (tonnes of ore in a full canister of this haul)
  const seen = () => room.group.visible || lookers.some((z) => z.group.visible);

  // ── the Miner, for its landing: its own room (drawn with the hangar), the leaves that are its alone, its legs ──
  const ship = (() => {
    const zone = W.room('ship-miner'); if (!zone) return null;
    const mine = new Set(), others = new Set();
    for (const D of W.built.doors) for (const leaf of D.leaves) for (const im of leaf.meshes || []) (D.zone === 'ship-miner' ? mine : others).add(im);
    // (not the canisters: they change places between the ship and the rack, and kit/crane.js puts each where it is,
    // riding the ship's own move when it is on a mount (L.ship); the trays are the ship's alone and ride with it)
    const meshes = [...mine].filter((im) => !others.has(im) && !/^mb:can/.test(im.name));
    const legs = W.built.doors.filter((D) => D.zone === 'ship-miner' && (D.piece === 'mbGear' || D.piece === 'mbGearDoors'));
    const pad = W.place('pads') || null, at = W.R?.places?.pads?.miner ? new THREE.Vector3(...W.R.places.pads.miner) : zone.box.getCenter(new THREE.Vector3()).setY(0);
    const nose = W.R?.places?.ships?.miner?.nose === '-x' ? -1 : 1;
    return { zone, meshes, legs, at, nose, M: new THREE.Matrix4(), held: null };
  })();
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _o = new THREE.Matrix4(), _i = new THREE.Matrix4();
  // the Miner `k` of the way through its landing (0: far out past the bay door; 1: down on its pad), or null: parked
  function shipAt(k) {
    if (!ship) return;
    const S = ship;
    if (k == null) {
      S.zone.group.matrix.identity(); S.zone.group.matrixWorldNeedsUpdate = true;
      for (const im of S.meshes) { im.matrix.identity(); im.matrixWorldNeedsUpdate = true; }
      L.ship(null); return;
    }
    const N = LANDING, ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    // (in nose first, slowing; a half turn over the pad; down onto it)
    const kIn = Math.min(1, k / N.turnFrom), out = (1 - kIn) * (1 - kIn) * N.from;   // (eased in: it slows as it comes)
    const turn = ease((k - N.turnFrom) / (N.turnTo - N.turnFrom)), down = ease((k - N.down) / (1 - N.down));
    const yaw = Math.PI * (1 - turn), h = N.hover * (1 - down) + Math.sin(k * 21) * 0.04 * (1 - down);
    const tilt = (1 - kIn) * 0.06 - Math.sin(Math.PI * turn) * 0.025;   // (nose a little up while it slows)
    _p.set(S.at.x + S.nose * out, h, S.at.z);
    // (turned about the pad's middle: the ship's frame turned by `yaw`, then moved; parked is the identity)
    _q.setFromEuler(_e.set(0, yaw, tilt * S.nose));
    _o.compose(_p, _q, _s); _i.makeTranslation(-S.at.x, 0, -S.at.z); S.M.multiplyMatrices(_o, _i);
    S.zone.group.matrixAutoUpdate = false; S.zone.group.matrix.copy(S.M); S.zone.group.matrixWorldNeedsUpdate = true;
    for (const im of S.meshes) { im.matrixAutoUpdate = false; im.matrix.copy(S.M); im.matrixWorldNeedsUpdate = true; }
    L.ship(S.M);
  }
  let landT = 0, legsDown = false;
  function beginLanding() {
    L.reset(); t = 0; mode = 'landing'; landT = 0; legsDown = false;
    C.haul = { n: L.round, landed: false, at: performance.now() };
    if (boarding && boarding.hold) boarding.hold('miner', true);
    if (ship) { for (const D of ship.legs) { W.driven.add(D); D.held0 = D.held0 ?? D.hold; D.hold = null; } setDoors(ship.legs, 1); }
    // (the ship out past the bay door first, then everything posed: its canisters ride with it from the first frame)
    shipAt(0); L.pose(0);
  }
  function landed() {
    shipAt(null); mode = 'round'; t = 0; C.haul.landed = true;
    if (ship) { for (const D of ship.legs) { D.hold = D.held0 ?? 0; W.driven.delete(D); } setDoors(ship.legs, 0); }
    if (boarding && boarding.hold) boarding.hold('miner', false);
  }

  // ── the screens on the trolley: x, y and the height, as the grid counts them ──
  const screens = (() => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const Tr = site.dims.trolley, geo = new THREE.PlaneGeometry(0.72, 0.36);
    const two = [1, -1].map((s) => { const m = new THREE.Mesh(geo, mat); m.matrixAutoUpdate = false; m.userData.side = s; room.group.add(m); return m; });
    let shown = '';
    function draw(x, y, h) {
      const key = x + '|' + y + '|' + h; if (key === shown) return; shown = key;
      g.fillStyle = '#06121a'; g.fillRect(0, 0, 256, 128);
      g.strokeStyle = 'rgba(120, 220, 255, 0.5)'; g.lineWidth = 4; g.strokeRect(3, 3, 250, 122);
      g.font = '700 34px "Segoe UI", system-ui, sans-serif'; g.textBaseline = 'middle';
      [['X', x], ['Y', y], ['H', h]].forEach(([k, v], i) => {
        const yy = 22 + i * 41; g.fillStyle = '#7fd8ff'; g.textAlign = 'left'; g.fillText(k, 14, yy + 2);
        g.fillStyle = '#eaf8ff'; g.textAlign = 'right'; g.fillText(v, 242, yy + 2);
      });
      tex.needsUpdate = true;
    }
    return { two, draw, Tr };
  })();
  const _m = new THREE.Matrix4();
  function poseScreens(S) {
    const [gx, gy] = grid(S.x, S.z), f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
    screens.draw(f1(gx), f1(gy), f1(S.hoist));
    const Tr = screens.Tr, y = site.rail.y + (Tr.y0 + Tr.y1) / 2;
    for (const m of screens.two) { const s = m.userData.side; m.matrix.makeRotationY(s * Math.PI / 2).setPosition(S.x + s * (Tr.x + 0.026), y, S.z); m.matrixWorldNeedsUpdate = true; }
  }

  // ── the swing: a pendulum for each way, driven by the hook's starting and stopping ──
  const sw = { x: [0, 0], z: [0, 0], vx: 0, vz: 0, lx: null, lz: null };
  function swing(dt, S) {
    if (!(dt > 0)) return;
    const w = 2 * Math.PI / SWING.period, g = 9.8;
    if (sw.lx == null) { sw.lx = S.x; sw.lz = S.z; }
    const vx = (S.x - sw.lx) / dt, vz = (S.z - sw.lz) / dt, ax = (vx - sw.vx) / dt, az = (vz - sw.vz) / dt;
    sw.lx = S.x; sw.lz = S.z; sw.vx = vx; sw.vz = vz;
    // (the angle's acceleration: back toward hanging straight, against the hook's acceleration, damped)
    for (const [k, a] of [['x', ax], ['z', az]]) {
      const P = sw[k], acc = -w * w * P[0] - SWING.damp * P[1] - Math.max(-3, Math.min(3, a)) * w * w / g;
      P[1] += acc * dt; P[0] += P[1] * dt; P[0] = Math.max(-SWING.most, Math.min(SWING.most, P[0]));
    }
    // (a swing along x tips the load about z, and along z about x)
    L.swing(sw.z[0], -sw.x[0]);
  }

  // ── the cameras: the station file's views on the hangar's walls, and the one on the trolley looking down ──
  const wallCams = Object.keys(W.R?.views || {}).filter((n) => /^miner-cam-/.test(n)).sort().map((n) => ({ name: n, ...W.view(n) }));
  function cams() {
    const S = live ? live.state : L.state(t);
    return [...wallCams, { name: 'crane', at: new THREE.Vector3(S.x + 0.6, site.rail.y + site.dims.trolley.y0 - 0.2, S.z + 0.02), look: new THREE.Vector3(S.x, Math.max(0, S.hoist - 3), S.z), fov: 70, down: true }];
  }

  const C = {
    on: true, L, waiting: false, RULES, world, site, grid, cams, violation: null, target: null, view: null, haul: { n: 0, landed: true, at: 0 },
    get t() { return t; }, get round() { return L.round; }, get rate() { return rate; }, get mode() { return mode; }, get live() { return mode === 'live' ? live : null; }, get drive() { return live; },
    get done() { return mode === 'round' && t >= L.length - 1e-6; },
    update(dt, { eyes = [], player = null, people = null } = {}) {
      eyesNow = eyes;
      // (the player gone from the hangar's area with it out of sight: the Miner is away; when it is next in sight, in it
      // comes to land, the next haul)
      const here = player ? W.zoneAt(player.pos) : null, inArea = !player || !here || AREA.test(here.id);
      if (!inArea && !seen() && (mode === 'round' || mode === 'handover' || mode === 'leaving') && !C.awayHeld) { mode = 'away'; live = null; rate = 1; C.waiting = false; L.beacon(false); L.aids({}); }
      // (the plan from above: no haze between the camera and the floor, after the boarding's light has had its say)
      if (C.view === 'top' && W.scene.fog) { W.scene.fog.near = 1e4; W.scene.fog.far = 2e4; }
      if (!seen()) return;
      if (mode === 'away') beginLanding();
      if (mode === 'landing') {
        landT += dt; const k = Math.min(1, landT / LANDING.secs);
        // (its legs down before it touches; it waits over the pad while anyone stands on it)
        const onPad = ship && eyes.some((e) => e.y < 2 && Math.hypot(e.x - ship.at.x, e.z - ship.at.z) < 7);
        if (onPad && k > LANDING.down - 0.02 && k < 0.98) landT -= dt;
        if (ship && k > LANDING.legs && !legsDown) legsDown = true;
        if (ship && legsDown) MB.gearStep(W.built, false, dt, updateDoors);
        shipAt(k); L.pose(0); posePieces(L.state(0), 0);
        if (k >= 1) landed();
        return;
      }
      if (mode === 'live' || mode === 'leaving') {
        live.step(dt, mode === 'live' ? cmd : {}); cmd = {};
        // (its beacons: quick while someone is under the load (the autopilot's rule), slow while it moves, as a working
        // crane's do; dark when it is still)
        const people2 = live.notes.some((n) => n.key === 'people'), period = people2 ? RULES.flash : live.moving ? RULES.travel : 0;
        if (period) { flash += dt; L.beacon(flash % period < period * 0.5); } else if (flash) { flash = 0; L.beacon(false); }
        C.waiting = people2;
        L.aids(live.read().aids);
        // (by hand: a load brought low over someone sends them running, and the joke notice)
        if (!live.rules.people && people && people.flee) scare(live, people);
        L.poseState(live.state); posePieces(live.state, dt);
        if (mode === 'leaving' && live.left) { L.resume(live.state); t = 0; mode = 'round'; live = null; C.waiting = false; L.beacon(false); flash = 0; L.aids({}); }
        return;
      }
      // anyone on the patch it is working over, or is about to?
      const g = L.gate(t, RULES.ahead); let blocked = false;
      if (g) for (const e of eyes) if (e.y < RULES.head && Math.abs(e.x - g.x) < g.hx + RULES.margin && Math.abs(e.z - g.z) < g.hz + RULES.margin) { blocked = true; break; }
      C.waiting = blocked;
      const want = blocked ? 0 : 1; rate += (want - rate) * Math.min(1, dt * RULES.ease); if (Math.abs(want - rate) < 0.02) rate = want;
      if (blocked) { flash += dt; L.beacon(flash % RULES.flash < RULES.flash * 0.5); } else if (flash) { flash = 0; L.beacon(false); }
      if (rate > 0 && dt > 0 && t < L.length) {
        const to = Math.min(L.length, t + dt * rate);
        // (being handed over: up to the moment nothing is half done, and from there it is live)
        if (mode === 'handover' && to >= handAt) { t = handAt; L.pose(t); goLive(); return; }
        t = to;
        L.pose(t);
      } else if (mode === 'handover' && t >= L.length - 1e-6) { goLive(); return; }
      posePieces(L.state(t), dt);
    },
    // ── the controls ──
    take() {
      if (mode === 'live') return true;
      if (mode === 'leaving') { live = makeDrive(L.site, live.state, world, { ore: oreOf }); mode = 'live'; return true; }
      if (mode === 'landing' || mode === 'away') return false;
      if (!voxels) voxels = reachVoxels(W, L.site);
      handAt = L.clean(t);
      if (handAt == null) handAt = t;
      mode = 'handover';
      if (handAt <= t + 1e-9) goLive();
      return true;
    },
    give() { if (mode === 'handover') { mode = 'round'; handAt = null; return; } if (mode !== 'live') return; live.leave(); mode = 'leaving'; },
    command(c) { cmd = c || {}; },
    load: () => (mode === 'round' || mode === 'handover' ? { ...L.load(t), steady: L.steady(t), round: L.round, t, length: L.length } : live ? { ...loadOfState(live.state, L.site), steady: { onShip: 0, fullOnShip: 0, docked: 0, drained: 0, onRack: 0 }, round: L.round, t, length: L.length } : { ...L.load(0), steady: L.steady(0), round: L.round, t: 0, length: L.length }),
    // (for the rigs: the round as it is now, drawn again; a moment of this round; so many seconds on; the Miner away
    // now (as if the player had gone), or landing now)
    pose() { if (live) L.poseState(live.state); else L.pose(t); posePieces(live ? live.state : L.state(t), 0); },
    seek(to) { if (mode !== 'round') return t; t = Math.max(0, Math.min(L.length, to)); L.pose(t); return t; },
    skip(seconds) { if (mode !== 'round') return t; t = Math.min(L.length, t + seconds); L.pose(t); return t; },
    away() { if (live) return false; mode = 'away'; return true; },
    land() { beginLanding(); return true; },
    landing: () => (mode === 'landing' ? Math.min(1, landT / LANDING.secs) : null),
    voxels: () => voxels || (voxels = reachVoxels(W, L.site)),
    oreOf, shipAt,
  };
  // the screens, the swing, the aimed-at canister, the place lights: the pieces drawn on top of the kit's
  function posePieces(S, dt) {
    poseScreens(S); swing(dt, S);
    const T2 = C.target, now = performance.now() / 1000;
    L.target(now, T2 ? { can: T2.can ?? -1, socket: T2.socket ?? -1 } : {});
    L.places(C.places || []);
  }
  // (by hand: anyone under a load brought low runs off; the notice, once a run)
  function scare(D, people) {
    const S = D.state, c = D.cfg();
    if (D.underside(c) > DRIVE.low) return;
    // (anyone, standing or walking, on the patch under the load: the canister's length along it, its width across)
    const held = D.held >= 0, yaw = held ? S.yaw + (S.cans[D.held].rel || 0) : S.yaw, ex = (held ? site.can.half : site.dims.grip.half) + RULES.scare, ac = 0.6 + RULES.scare;
    const under = people.list.some((P) => !P.hidden && P.pos.y < RULES.head && Math.abs((P.pos.x - S.x) * Math.sin(yaw) + (P.pos.z - S.z) * Math.cos(yaw)) < ex && Math.abs((P.pos.x - S.x) * Math.cos(yaw) - (P.pos.z - S.z) * Math.sin(yaw)) < ac);
    if (!under) return;
    const sent = people.flee(S.x, S.z, ex + 0.4);
    if (sent.length) C.violation = { at: performance.now(), n: sent.length, who: sent.map((P) => P.name || P.id) };
  }
  function goLive() {
    live = makeDrive(L.site, L.state(t), world, { ore: oreOf });
    mode = 'live'; handAt = null; rate = 1; C.waiting = false; L.beacon(false); flash = 0;
    L.poseState(live.state);
  }
  // (at the start the Miner is parked and the round ready to go)
  return C;
}

// the load in plain numbers from a state (the crane worked by hand: kit/crane-plan.js loadAt's shape)
function loadOfState(S, site) {
  const out = { canisters: site.mounts.length, phase: 'by hand', onShip: 0, fullOnShip: 0, docked: [], drained: 0, onRack: 0, carried: 0 };
  for (const q of S.cans) {
    if (q.where === 'mount') { out.onShip++; if (q.fill > 0.5) out.fullOnShip++; }
    else if (q.where === 'socket') { out.docked.push({ socket: q.i, percent: Math.round(q.fill * 100) }); if (q.fill <= 0) out.drained++; }
    else if (q.where === 'bay') out.onRack++; else out.carried++;
  }
  out.docked.sort((a, b) => a.socket - b.socket);
  return out;
}

// WHAT STANDS STILL WITHIN THE CRANE'S REACH: the hangar's walls, the parked Miner, the rack, the sockets' collars, the
// stairs and the catwalk (the station's merged meshes), up to the hook's highest, each marked into REACH.voxel cubes
// (the kit's own voxels, kit/bake.js). The bridge crane reaches the whole hangar; the floor itself is left out (the
// crane's own check knows where the floor is).
export function reachVoxels(W, site, size = REACH.voxel) {
  const t0 = performance.now(), top = site.carry + site.dims.hookTop + 0.4;
  const pad = site.can.half + REACH.pad;
  const box = new THREE.Box3(new THREE.Vector3(site.rail.x[0] - pad, -0.1, site.rail.z[0] - pad), new THREE.Vector3(site.rail.x[1] + pad, top, site.rail.z[1] + pad));
  const V = new Voxels(box, size);
  let tris = 0, kept = 0;
  const tb = new THREE.Box3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const st = size * 0.5, inv = 1 / size, mx = V.min.x, my = V.min.y, mz = V.min.z;
  for (const z of W.built.zones) for (const k of ['solid', 'floor', 'glass', 'shield']) {
    const g = z.merged && z.merged[k]; if (!g) continue;
    if (!g.boundingBox) g.computeBoundingBox();
    if (!box.intersectsBox(g.boundingBox)) continue;
    const p = g.attributes.position.array, ix = g.index ? g.index.array : null, n = ix ? ix.length : p.length / 3;
    for (let t = 0; t < n; t += 3) {
      tris++;
      const ia = (ix ? ix[t] : t) * 3, ib = (ix ? ix[t + 1] : t + 1) * 3, ic = (ix ? ix[t + 2] : t + 2) * 3;
      a.set(p[ia], p[ia + 1], p[ia + 2]); b.set(p[ib], p[ib + 1], p[ib + 2]); c.set(p[ic], p[ic + 1], p[ic + 2]);
      // (the floor's own triangles: the crane knows where the floor is)
      if (a.y < 0.03 && b.y < 0.03 && c.y < 0.03) continue;
      tb.makeEmpty().expandByPoint(a).expandByPoint(b).expandByPoint(c);
      if (!box.intersectsBox(tb)) continue;
      kept++;
      // (as the kit marks them: the triangle sampled finer than a voxel)
      const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
      const nu = Math.max(1, Math.ceil(Math.hypot(ux, uy, uz) / st)), nv = Math.max(1, Math.ceil(Math.hypot(vx, vy, vz) / st));
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
        const fu = i / nu, fv = j / nv; if (fu + fv > 1.0001) continue;
        const x = a.x + ux * fu + vx * fv, y = a.y + uy * fu + vy * fv, zz = a.z + uz * fu + vz * fv;
        if (x < box.min.x || x > box.max.x || y < box.min.y || y > box.max.y || zz < box.min.z || zz > box.max.z) continue;
        V.set(Math.floor((x - mx) * inv), Math.floor((y - my) * inv), Math.floor((zz - mz) * inv));
      }
    }
  }
  V.ms = performance.now() - t0; V.tris = tris; V.kept = kept;
  console.info(`crane: what stands within its reach, ${kept} of ${tris} triangles, in ${V.bricks} bricks of ${size} m cubes, ${V.ms.toFixed(0)} ms`);
  return V;
}
