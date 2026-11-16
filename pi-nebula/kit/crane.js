// THE ORE LINE AT WORK: finds the smelter's moving parts in a station as built (kit/smelter.js's pieces and the parked
// Miner's canisters), works out the places from where they stand, and puts every part where the round's timetable
// (kit/crane-plan.js) says it is at a moment, or where someone working the crane by hand has put it (kit/crane-drive.js).
// The game's clock drives it (src/crane.js); a lab can too.
// NOT ONE COORDINATE HERE: the bridge is where its piece stands, the mounts, sockets and rack bays are where their
// pieces are; the runways' ends and middle lines, where the crane parks and the grid the questions read are the
// station file's (its place 'crane', handed in as opts.rail).
//
//   const L = makeOreLine(built, { rail })   null if the station has no crane (or not all of its parts)
//   L.pose(t)                           everything as it is at time t of the round (0 .. L.length)
//   L.poseState(S)                      everything as a state says (crane-plan.js stateAt's shape)
//   L.state(t), L.clean(t)              the round's state at t; the next moment nothing is half done
//   L.resume(S)                         the round taken up from a state (crane-plan.js planFrom), from its time 0
//   L.reset()                           the next haul: full canisters on the ship, empties on the rack, the crane home
//   L.site                              the places and the parts' sizes (for the timetable and kit/crane-drive.js)
//   L.load(t), L.steady(t), L.gate(t, ahead)   the load in plain numbers and how long each stays so; the patch of
//                                       floor it is working over (crane-plan.js)
//   L.hook(t)                           where the cradle hangs (a point, the station's frame)
//   L.beacon(on)                        its warning lamps bright or dark
//   L.aids({ x, y, h })                 the docking lights: each 'off', 'near' or 'on' (the girder's strips, the
//                                       trolley's ring, the cradle's lamps)
//   L.target(t, { can, socket })        the canister (or socket) the crane is aimed at, blinking yellow; null: none
//   L.places(lights)                    the ship's and the rack's place lights: [{ kind: 'mount' | 'bay', i, look }]
//   L.swing(ax, az)                     the load's swing (radians about x and z), drawn only
//   L.ship(M)                           where the Miner is (a matrix from parked: landing), or null (parked)
//   L.meshes, L.doors                   what it moves: the kit's instanced meshes and doors (the game hangs the meshes
//                                       on the hangar's room, and tells its walls about the doors)
import * as THREE from 'three';
import { setDoors } from './layout.js';
import { planCycle, planFrom, stateAt, cleanAt, valueAt, gateAt, loadAt, steadyAt, startOf } from './crane-plan.js';
import { CRANE, SOCKET, ARMS, GLOWS, DIGIT, GAUGE, craneSpan } from './smelter.js';
import { MARKS_CAN } from './ships/miner-built.js';
import { CANISTER_AT } from './ships/miner-built.hull.js';

// a tray's first move: its canister lifted this far off the saddles, in this share of the tray's time
export const TRAY_LIFT = { h: 0.09, share: 0.15 };
const kindOf = (leaf) => (leaf.meshes[0] ? leaf.meshes[0].name.replace(/:[^:]+$/, '') : '');
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const _m = new THREE.Matrix4(), _n = new THREE.Matrix4(), _r = new THREE.Matrix4(), _s = new THREE.Vector3(), _c = new THREE.Color(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, -1, 0);
function setM(leaf, m) { for (const im of leaf.meshes) { im.setMatrixAt(leaf.index, m); im.instanceMatrix.needsUpdate = true; } }
// a glowing leaf's colour, as a share of the colour it was made with (the kit multiplies the two)
function tint(leaf, to, from) { for (const im of leaf.meshes) { im.setColorAt(leaf.index, _c.setRGB(to[0] / from[0], to[1] / from[1], to[2] / from[2])); im.instanceColor.needsUpdate = true; } }
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const restOf = (leaf) => new THREE.Matrix4().copy(leaf.M).multiply(leaf.base);
const yawOf = (m) => { _v.set(0, 0, 1).transformDirection(m); return Math.atan2(_v.x, _v.z); };
const posOf = (m) => new THREE.Vector3().setFromMatrixPosition(m);
const AID = { off: GLOWS.aidOff, near: GLOWS.aidNear, on: GLOWS.aidOn };

export function makeOreLine(built, opts = {}) {
  const speed = opts.speed, railPlace = opts.rail || null;
  const live = (piece) => (built?.doors || []).filter((D) => D.piece === piece && D.hold == null && D.leaves.length);
  const craneD = live('crane')[0];
  if (!craneD) return null;
  const part = {}; for (const leaf of craneD.leaves) (part[kindOf(leaf)] ||= []).push(leaf);
  const one = (k) => part['crane:' + k]?.[0];
  const P = { bridge: one('bridge'), xlight: one('xlight'), trolley: one('trolley'), ylight: one('ylight'), beacon: one('beacon'), cables: part['crane:cable'] || [], block: one('block'), cradle: one('cradle'), arcs: part['crane:arc'] || [], lamp: one('lamp') };
  if (!P.bridge || !P.trolley || !P.block || !P.cradle || P.cables.length !== 4 || P.arcs.length !== ARMS.length) return null;

  // ── a canister: its three leaves, and the colours its strip and rings were made with ──
  const G = MARKS_CAN.glow;
  const canOf = (D) => { const by = {}; for (const leaf of D.leaves) by[kindOf(leaf).replace(/:empty$/, '')] = leaf; const empty = D.leaves.some((l) => /:empty$/.test(kindOf(l))); return { body: by['mb:canister'], level: by['mb:canlevel'], rings: by['mb:canrings'], level0: empty ? G.off : G.ore, rings0: empty ? G.blue : G.amber, end: -1, key: '' }; };
  // ── the ship's mounts: each canister's door and its tray's (they share a place), where the canister lies, the tray's slide ──
  const byPlace = new Map();
  for (const D of live('mbCanister')) { const k = D.sense.toArray().map((v) => Math.round(v * 100)).join(); (byPlace.get(k) || byPlace.set(k, {}).get(k))[kindOf(D.leaves[0]).startsWith('mb:tray') ? 'tray' : 'can'] = D; }
  const mounts = [...byPlace.values()].filter((q) => q.can && q.tray).map((q) => {
    const body = q.can.leaves.find((l) => kindOf(l) === 'mb:canister'), rest = restOf(body), full = q.tray.leaves[q.tray.leaves.length - 1];
    const out = new THREE.Vector3().copy(full.slide).applyMatrix4(_m.extractRotation(full.M));
    return { can: canOf(q.can), tray: q.tray, trayLeaf: full, trayRest: posOf(restOf(full)), rest, at: posOf(rest), yaw: yawOf(rest), out };
  });
  if (!mounts.length) return null;
  const midY = mounts.reduce((s, m) => s + m.at.y, 0) / mounts.length;
  // ── the sockets: each one's three doors (iris, ring, display), its mouth and the way it faces, its number ──
  const socks = new Map();
  for (const D of live('oreSocket')) { const M = D.leaves[0].M, k = [M.elements[12], M.elements[13], M.elements[14]].map((v) => Math.round(v * 100)).join(), kind = kindOf(D.leaves[0]); (socks.get(k) || socks.set(k, { M, number: D.variant ? parseInt(String(D.variant).split(' ')[1], 10) || null : null }).get(k))[kind === 'sock:petal' ? 'iris' : kind === 'sock:ring' ? 'lit' : 'gauge'] = D; }
  const sockets = [...socks.values()].filter((q) => q.iris && q.lit && q.gauge).map((q) => {
    const at = new THREE.Vector3(0, 0, SOCKET.deep).applyMatrix4(q.M), n = new THREE.Vector3(0, 0, 1).transformDirection(q.M);
    return { ...q, at, n, ring: q.lit.leaves.find((l) => kindOf(l) === 'sock:ring'), segs: q.gauge.leaves.filter((l) => kindOf(l) === 'sock:seg'), bars: q.gauge.leaves.filter((l) => kindOf(l) === 'sock:bar'), shown: null, litAt: -1, irisAt: -1, ringTint: null };
  }).sort((a, b) => a.at.x - b.at.x || a.at.z - b.at.z || a.at.y - b.at.y);
  const sockY = sockets.reduce((s, q) => s + q.at.y, 0) / (sockets.length || 1);
  // (a socket's number: its own piece's, else counted along the wall, the lower row first)
  const order = sockets.map((q, k) => k).sort((a, b) => (sockets[a].at.y > sockY) - (sockets[b].at.y > sockY) || sockets[a].at.x - sockets[b].at.x);
  order.forEach((k, n) => { if (!sockets[k].number) sockets[k].number = n + 1; });
  // ── the rack's bays ──
  const bays = live('oreCan').map((D) => { const body = D.leaves.find((l) => kindOf(l) === 'mb:canister'), rest = restOf(body); return { can: canOf(D), at: posOf(rest), yaw: yawOf(rest) }; }).sort((a, b) => a.at.x - b.at.x || a.at.z - b.at.z);
  if (sockets.length < mounts.length || bays.length < mounts.length) return null;

  // ── the site, for the timetable and for working the crane by hand ──
  const placed = posOf(P.bridge.M), railY = placed.y, zMid = placed.z, half = CANISTER_AT.half, { span } = craneSpan(craneD.variant || '');
  const T = CRANE.truck, Gd = CRANE.girder, Tr = CRANE.trolley;
  // (where the hook can go: the bridge between the runways' end stops, the trolley between the end trucks)
  const runX = railPlace && railPlace.x ? railPlace.x : [placed.x - 18, placed.x + 18], runZ = railPlace && railPlace.z ? railPlace.z : [zMid - span / 2, zMid + span / 2];
  const xEnd = 0.24 + T.buffer + T.half, zEnd = T.w + Gd.gap + Tr.z + 0.04;
  const home = railPlace && railPlace.home ? railPlace.home : [placed.x, zMid];
  const site = { carry: railY + CRANE.carry, home: [home[0], home[1]],
    rail: { y: railY, x: [Math.min(...runX) + xEnd, Math.max(...runX) - xEnd], z: [Math.min(...runZ) + zEnd, Math.max(...runZ) - zEnd], zMid, span },
    mounts: mounts.map((m) => ({ at: m.at.toArray(), yaw: m.yaw, out: [m.out.x, m.out.z], upper: m.at.y > midY })),
    sockets: sockets.map((q) => ({ at: q.at.toArray(), n: [q.n.x, q.n.z], upper: q.at.y > sockY, number: q.number })),
    bays: bays.map((b) => ({ at: b.at.toArray(), yaw: b.yaw })), can: { half, seat: SOCKET.seat, clear: SOCKET.clear, rise: SOCKET.rise, lift: TRAY_LIFT.h },
    grid: railPlace && railPlace.grid ? { ...railPlace.grid } : { origin: [Math.min(...runX), Math.max(...runZ)] },
    dims: { R: CANISTER_AT.R, grip: { ...CRANE.grip }, arc: { ...CRANE.arc }, arms: ARMS.map((a) => ({ ...a })), cable: { x: CRANE.cable.x, z: CRANE.cable.z }, cableTop: Tr.y0, hookTop: CRANE.hookTop,
      trolley: { ...Tr }, girder: { ...Gd }, block: { ...CRANE.block },
      sock: { deep: SOCKET.deep, bore: SOCKET.bore, mouth: SOCKET.mouth, out: SOCKET.out }, trayShare: TRAY_LIFT.share } };
  // the canisters themselves: the mounts' first, then the rack's; `slot[c]` is which of them the timetable's canister c is
  const cans = [...mounts.map((m) => m.can), ...bays.map((b) => b.can)];
  let slot = cans.map((_, i) => i), plan = planCycle(site, {}, speed), round = 0;

  // ── putting everything where a state says it is (the round's at a time, or the crane worked live) ──
  const bridgeM = new THREE.Matrix4(), trolleyM = new THREE.Matrix4(), hookM = new THREE.Matrix4(), cradleM = new THREE.Matrix4(), canM = new THREE.Matrix4(), swingM = new THREE.Matrix4();
  const hookAt = new THREE.Vector3(), pivot = new THREE.Vector3(), cTop = new THREE.Vector3(), cBot = new THREE.Vector3();
  const K = CRANE.cable, topY = Tr.y0, cableAt = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * K.x, sz * K.z]));
  const docked = sockets.map(() => -1);
  let swing = [0, 0], shipM = null, shipKey = '';
  function poseState(S) {
    const x = S.x, z = S.z, yaw = S.yaw, h = S.hoist, arms = smooth(S.arms);
    // the bridge along the runways, the trolley along the bridge
    bridgeM.makeTranslation(x, railY, zMid); setM(P.bridge, bridgeM); if (P.xlight) setM(P.xlight, bridgeM);
    trolleyM.makeTranslation(x, railY, z); setM(P.trolley, trolleyM); if (P.ylight) setM(P.ylight, trolleyM); if (P.beacon) setM(P.beacon, trolleyM);
    // the load's swing (drawn only): everything under the trolley tipped about the cables' top
    pivot.set(x, railY + topY, z);
    if (swing[0] || swing[1]) swingM.makeTranslation(pivot.x, pivot.y, pivot.z).multiply(_r.makeRotationFromEuler(_e.set(swing[0], 0, swing[1]))).multiply(_n.makeTranslation(-pivot.x, -pivot.y, -pivot.z));
    else swingM.identity();
    hookAt.set(x, h, z);
    hookM.makeTranslation(x, h, z).premultiply(swingM); setM(P.block, hookM);
    cradleM.makeRotationY(yaw).setPosition(hookAt).premultiply(swingM); setM(P.cradle, cradleM); if (P.lamp) setM(P.lamp, cradleM);
    // the four cables, from the trolley down to the block's top corners
    P.cables.forEach((leaf, i) => {
      cTop.set(x + cableAt[i][0], railY + topY, z + cableAt[i][1]);
      cBot.set(x + cableAt[i][0], h + CRANE.hookTop, z + cableAt[i][1]).applyMatrix4(swingM);
      _w.subVectors(cBot, cTop); const len = Math.max(0.02, _w.length()); _w.divideScalar(len);
      _q.setFromUnitVectors(_up, _w);
      setM(leaf, _m.compose(cTop, _q, _s.set(1, len / K.unit, 1)));
    });
    P.arcs.forEach((leaf, i) => setM(leaf, _m.copy(cradleM).multiply(_n.makeTranslation(0, 0, ARMS[i].z)).multiply(_r.makeRotationZ(-ARMS[i].way * CRANE.arc.shut * arms))));
    // the ship's trays (the kit's own heavy doors), then the canisters: on a tray, in the cradle, in a socket, on the rack
    mounts.forEach((m, i) => {
      const v = S.tray[i]; if (v === m.trayAt) return; m.trayAt = v;
      // (a tray first lifts its canister off the mount's saddles, then slides out; coming home, the other way round)
      const up = smooth(v / TRAY_LIFT.share) * TRAY_LIFT.h;
      setDoors([m.tray], Math.max(0, (v - TRAY_LIFT.share) / (1 - TRAY_LIFT.share)));
      if (up > 0) for (const leaf of m.tray.leaves) for (const im of leaf.meshes) { im.getMatrixAt(leaf.index, _m); _m.elements[13] += up; im.setMatrixAt(leaf.index, _m); }
    });
    docked.fill(-1);
    S.cans.forEach((at, c) => {
      const C = cans[slot[c]], f = at.fill;
      if (at.where === 'socket') docked[at.i] = c;
      let key = at.where + (at.i ?? '') + ':' + f.toFixed(4);
      if (at.where === 'held') { key = ''; canM.copy(cradleM).multiply(_r.makeRotationY(at.rel || 0)); }
      else if (at.where === 'mount') {
        // (riding its tray: moved as far as the tray's inner bars have moved from home; end for end if it was set
        // down that way round; with the ship, while it lands)
        const m = mounts[at.i], flip = Math.cos(at.yaw - m.yaw) < 0; m.trayLeaf.meshes[0].getMatrixAt(m.trayLeaf.index, _m); _v.setFromMatrixPosition(_m).sub(m.trayRest);
        key += ':' + _v.x.toFixed(4) + ',' + _v.z.toFixed(4) + (flip ? ':f' : '') + shipKey; if (key === C.key) return;
        canM.copy(m.rest); canM.elements[12] += _v.x; canM.elements[13] += _v.y; canM.elements[14] += _v.z;
        if (flip) canM.multiply(_r.makeRotationY(Math.PI));
        if (shipM) canM.premultiply(shipM);
      } else {
        key += ':' + (at.yaw ?? 0).toFixed(4);
        if (key === C.key) return;
        if (at.where === 'socket') {
          const q = sockets[at.i]; canM.makeRotationY(at.yaw).setPosition(q.at.x + q.n.x * (half - SOCKET.seat), q.at.y, q.at.z + q.n.z * (half - SOCKET.seat));
          C.end = Math.sin(at.yaw) * q.n.x + Math.cos(at.yaw) * q.n.z > 0 ? -1 : 1;   // (the end in the wall: its strip drains toward it)
        } else canM.makeRotationY(at.yaw).setPosition(bays[at.i].at);
      }
      C.key = key;
      setM(C.body, canM); setM(C.rings, canM);
      const w = MARKS_CAN.win.half * C.end;
      setM(C.level, _m.copy(canM).multiply(_n.makeTranslation(0, 0, w)).scale(_s.set(1, 1, Math.max(f, 1e-4))).multiply(_n.makeTranslation(0, 0, -w)));
      if (f !== C.fill) { C.fill = f; tint(C.level, G.ore, C.level0); C.ringsWere = null; }
      if (C.blink == null) { const col = mix(G.blue, G.amber, smooth(f / 0.12)); const k = col.join(); if (k !== C.ringsWere) { C.ringsWere = k; tint(C.rings, col, C.rings0); } }
    });
    // the sockets: the iris, the ring, the display (the number of the canister docked in it, percent left, and its bars)
    sockets.forEach((q, k) => {
      const iris = S.iris[k]; if (iris !== q.irisAt) { q.irisAt = iris; setDoors([q.iris], iris); }
      // (the collar's latch dogs slide in onto the seated canister as its ring lights, and let go before it is drawn out)
      const lit = S.lit[k]; if (lit !== q.litAt) { q.litAt = lit; setDoors([q.lit], lit); q.ringWas = null; }
      const ring = q.ringTint || mix(GLOWS.ringOff, GLOWS.ringOn, smooth(lit)), rk = ring.join(); if (rk !== q.ringWas) { q.ringWas = rk; tint(q.ring, ring, GLOWS.ringOff); }
      const c = docked[k], f = c < 0 ? -1 : S.cans[c].fill, text = c < 0 ? '' : String(Math.round(f * 100)), bars = c < 0 ? 0 : Math.ceil(f * GAUGE.bars - 1e-6), shown = text + '|' + bars;
      if (shown === q.shown) return; q.shown = shown;
      const col = f > 0.2 ? GLOWS.ok : GLOWS.low, pad = text.padStart(GAUGE.digits, ' ');
      for (let d = 0; d < GAUGE.digits; d++) { const on = DIGIT.on[pad[d]] || ''; for (let s = 0; s < DIGIT.order.length; s++) tint(q.segs[d * DIGIT.order.length + s], on.includes(DIGIT.order[s]) ? col : GLOWS.off, GLOWS.off); }
      q.bars.forEach((leaf, b) => tint(leaf, b < bars ? col : GLOWS.off, GLOWS.off));
    });
    lastS = S;
  }
  const _e = new THREE.Euler();
  let lastS = null;
  const scratch = { tray: [], iris: [], lit: [], cans: [] };
  const pose = (t) => poseState(stateAt(plan, t, scratch));

  // the next haul: the Miner back with its canisters full, the rack's empties as the last round left them, the crane
  // home (whatever was where, it all starts again from the standard start)
  function reset() {
    if (plan.next && plan.next.onMount && plan.next.onMount.every((c) => c >= 0) && plan.next.inBay.every((c) => c >= 0)) {
      const N = plan.next; slot = [...N.onMount.map((c) => slot[c]), ...N.inBay.map((c) => slot[c])];
    } else slot = cans.map((_, i) => i);
    plan = planCycle(site, {}, speed); round++;
    for (const C of cans) C.key = '';
    for (const m of mounts) m.trayAt = undefined;
    for (const q of sockets) { q.irisAt = -1; q.litAt = -1; q.shown = null; q.ringWas = null; }
    return plan;
  }
  // the round taken up again from a state (after the crane was worked by hand): the same canisters, the same numbers
  function resume(S) {
    plan = planFrom(site, S, speed);
    for (const C of cans) C.key = '';
    for (const m of mounts) m.trayAt = undefined;
    for (const q of sockets) { q.irisAt = -1; q.litAt = -1; q.shown = null; q.ringWas = null; }
    return plan;
  }
  const meshes = new Set(), doors = [craneD, ...live('mbCanister'), ...live('oreSocket'), ...live('oreCan')];
  for (const D of doors) for (const leaf of D.leaves) for (const im of leaf.meshes) meshes.add(im);

  // ── the place lights: one small lamp at each mount's tray end and each rack bay (green: the crane is lined up on a
  // place it may use; amber: nearly). Its own instanced mesh, posed each frame it changes ──
  const PL = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.05, 0.08), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), mounts.length + bays.length);
  PL.name = 'crane:places'; PL.frustumCulled = false;
  const plCol = (look) => (look === 'on' ? [0.25, 2.2, 0.55] : look === 'near' ? [2.2, 1.0, 0.08] : [0.06, 0.07, 0.08]);
  let plKey = '';
  function places(list = []) {
    const looks = [...mounts.map(() => 'off'), ...bays.map(() => 'off')];
    for (const p of list) { const n = p.kind === 'mount' ? p.i : mounts.length + p.i; if (n >= 0 && n < looks.length) looks[n] = p.look; }
    const key = looks.join() + '|' + mounts.map((m) => (m.trayAt ?? 0).toFixed(3)).join() + shipKey;
    if (key === plKey) return; plKey = key;
    mounts.forEach((m, i) => {
      const o = m.out.clone().normalize(), out = smooth(Math.max(0, ((m.trayAt ?? 0) - TRAY_LIFT.share) / (1 - TRAY_LIFT.share)));
      _v.copy(m.at).addScaledVector(m.out, out).addScaledVector(o, CANISTER_AT.R + 0.12); _v.y -= CANISTER_AT.R + 0.04;
      _m.makeRotationY(Math.atan2(o.x, o.z)).setPosition(_v); if (shipM) _m.premultiply(shipM);
      PL.setMatrixAt(i, _m); PL.setColorAt(i, _c.setRGB(...plCol(looks[i])));
    });
    bays.forEach((b, j) => {
      const n = mounts.length + j; _m.makeTranslation(b.at.x, 0.3, b.at.z + 0.92);
      PL.setMatrixAt(n, _m); PL.setColorAt(n, _c.setRGB(...plCol(looks[n])));
    });
    PL.instanceMatrix.needsUpdate = true; if (PL.instanceColor) PL.instanceColor.needsUpdate = true;
  }
  meshes.add(PL);

  let lamp = null, aidKey = '', blinkC = -1, blinkK = -1;
  const L = {
    site, mounts, sockets, bays, cans, get plan() { return plan; }, get length() { return plan.length; }, get round() { return round; }, get slot() { return slot; },
    pose, poseState, reset, resume, state: (t) => stateAt(plan, t), clean: (t, ahead) => cleanAt(plan, t, ahead), start: () => startOf(site, {}),
    load: (t) => loadAt(plan, t), steady: (t, ahead) => steadyAt(plan, t, ahead), gate: (t, ahead = 0) => gateAt(plan, t, ahead),
    hook(t) { const T2 = plan.T; return new THREE.Vector3(valueAt(T2.x, t), valueAt(T2.hoist, t), valueAt(T2.z, t)); },
    beacon(on) { if (on === lamp) return; lamp = on; if (P.beacon) tint(P.beacon, on ? GLOWS.beaconOn : GLOWS.beaconOff, GLOWS.beaconOff); aidKey = ''; },
    // the docking lights: the girder's strips (x), the trolley's ring (y), the cradle's lamps (the height; amber with
    // the beacons while they flash)
    aids({ x = 'off', y = 'off', h = 'off' } = {}) {
      const key = x + y + h + lamp; if (key === aidKey) return; aidKey = key;
      if (P.xlight) tint(P.xlight, AID[x] || AID.off, GLOWS.aidOff);
      if (P.ylight) tint(P.ylight, AID[y] || AID.off, GLOWS.aidOff);
      if (P.lamp) tint(P.lamp, lamp ? GLOWS.beaconOn : h === 'off' ? GLOWS.beaconOff : AID[h], GLOWS.beaconOff);
    },
    // the canister (the timetable's number) or the socket the crane is aimed at: its rings (or ring) blink yellow
    target(t, { can = -1, socket = -1 } = {}) {
      const on = Math.floor(t / 0.45) % 2 === 0;
      if (blinkC >= 0 && blinkC !== can) { const C = cans[slot[blinkC]]; C.blink = null; C.ringsWere = null; C.key = ''; }
      if (blinkK >= 0 && blinkK !== socket) { sockets[blinkK].ringTint = null; }
      blinkC = can; blinkK = socket;
      if (can >= 0) { const C = cans[slot[can]]; const b = on ? 1 : 0; if (C.blink !== b) { C.blink = b; tint(C.rings, on ? GLOWS.target : mix(G.blue, G.amber, smooth((C.fill ?? 1) / 0.12)), C.rings0); C.ringsWere = null; } }
      if (socket >= 0) sockets[socket].ringTint = on ? GLOWS.target : null;
    },
    places,
    swing(ax = 0, az = 0) { swing = [ax, az]; },
    ship(M) { shipM = M ? (shipM || new THREE.Matrix4()).copy(M) : null; shipKey = shipM ? ':' + shipM.elements.map((v) => v.toFixed(3)).join(',') : ''; for (const m of mounts) m.trayAt = undefined; },
    get shipM() { return shipM; },
    meshes: [...meshes], doors, placeLights: PL,
  };
  L.beacon(false); L.aids({}); places([]); pose(0);
  return L;
}
