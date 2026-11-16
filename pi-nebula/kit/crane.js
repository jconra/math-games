// THE ORE LINE AT WORK: finds the smelter's moving parts in a station as built (kit/smelter.js's pieces and the parked
// Miner's canisters), works out the places from where they stand, and puts every part where the round's timetable
// (kit/crane-plan.js) says it is at a moment, or where someone working the crane by hand has put it (kit/crane-drive.js).
// The game's clock drives it (src/crane.js); a lab can too.
// NOT ONE COORDINATE HERE: the turntable is where its piece stands, the wall's leg runs through it across the sockets'
// faces, the ship's leg along them; the mounts, sockets and rack bays are where their pieces are; the rail's ends are
// the station file's (its place 'crane', handed in as opts.rail).
//
//   const L = makeOreLine(built, { rail })   null if the station has no crane (or not all of its parts)
//   L.pose(t)                           everything as it is at time t of the round (0 .. L.length)
//   L.poseState(S)                      everything as a state says (crane-plan.js stateAt's shape)
//   L.state(t), L.clean(t)              the round's state at t; the next moment nothing is half done
//   L.resume(S)                         the round taken up from a state (crane-plan.js planFrom), from its time 0
//   L.next()                            the round is over: the next one (the canisters have changed places)
//   L.site                              the places and the parts' sizes (for the timetable and kit/crane-drive.js)
//   L.load(t), L.steady(t), L.gate(t, ahead)   the load in plain numbers and how long each stays so; the patch of
//                                       floor it is working over (crane-plan.js)
//   L.hook(t)                           where the cradle hangs (a point, the station's frame)
//   L.beacon(on)                        its warning lamps bright or dark
//   L.meshes, L.doors                   what it moves: the kit's instanced meshes and doors (the game hangs the meshes
//                                       on the hangar's room, and tells its walls about the doors)
import * as THREE from 'three';
import { setDoors } from './layout.js';
import { planCycle, planFrom, stateAt, cleanAt, valueAt, gateAt, loadAt, steadyAt } from './crane-plan.js';
import { CRANE, SOCKET, ARMS, GLOWS, DIGIT, GAUGE } from './smelter.js';
import { MARKS_CAN } from './ships/miner-built.js';
import { CANISTER_AT } from './ships/miner-built.hull.js';

// a tray's first move: its canister lifted this far off the saddles, in this share of the tray's time
export const TRAY_LIFT = { h: 0.09, share: 0.15 };
const kindOf = (leaf) => (leaf.meshes[0] ? leaf.meshes[0].name.replace(/:[^:]+$/, '') : '');
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const _m = new THREE.Matrix4(), _n = new THREE.Matrix4(), _r = new THREE.Matrix4(), _s = new THREE.Vector3(), _c = new THREE.Color(), _v = new THREE.Vector3();
function setM(leaf, m) { for (const im of leaf.meshes) { im.setMatrixAt(leaf.index, m); im.instanceMatrix.needsUpdate = true; } }
// a glowing leaf's colour, as a share of the colour it was made with (the kit multiplies the two)
function tint(leaf, to, from) { for (const im of leaf.meshes) { im.setColorAt(leaf.index, _c.setRGB(to[0] / from[0], to[1] / from[1], to[2] / from[2])); im.instanceColor.needsUpdate = true; } }
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const restOf = (leaf) => new THREE.Matrix4().copy(leaf.M).multiply(leaf.base);
const yawOf = (m) => { _v.set(0, 0, 1).transformDirection(m); return Math.atan2(_v.x, _v.z); };
const posOf = (m) => new THREE.Vector3().setFromMatrixPosition(m);

export function makeOreLine(built, opts = {}) {
  // (opts: { speed, rail }; an older caller handed the speeds themselves)
  const speed = opts && opts.travel ? opts : opts.speed, railPlace = opts && !opts.travel ? opts.rail : null;
  const live = (piece) => (built?.doors || []).filter((D) => D.piece === piece && D.hold == null && D.leaves.length);
  const craneD = live('crane')[0], turnD = live('craneTurn')[0];
  if (!craneD || !turnD) return null;
  const part = {}; for (const leaf of craneD.leaves) (part[kindOf(leaf)] ||= []).push(leaf);
  const P = { trolley: part['crane:trolley']?.[0], carriage: part['crane:carriage']?.[0], cables: part['crane:cable'] || [], cradle: part['crane:cradle']?.[0], arcs: part['crane:arc'] || [], beacon: part['crane:beacon']?.[0], lamp: part['crane:lamp']?.[0], disc: turnD.leaves[0] };
  if (!P.trolley || !P.carriage || !P.cradle || P.cables.length !== 4 || P.arcs.length !== ARMS.length) return null;

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
  // ── the sockets: each one's three doors (iris, ring, display), its mouth and the way it faces ──
  const socks = new Map();
  for (const D of live('oreSocket')) { const M = D.leaves[0].M, k = [M.elements[12], M.elements[13], M.elements[14]].map((v) => Math.round(v * 100)).join(), kind = kindOf(D.leaves[0]); (socks.get(k) || socks.set(k, { M }).get(k))[kind === 'sock:petal' ? 'iris' : kind === 'sock:ring' ? 'lit' : 'gauge'] = D; }
  const sockets = [...socks.values()].filter((q) => q.iris && q.lit && q.gauge).map((q) => {
    const at = new THREE.Vector3(0, 0, SOCKET.deep).applyMatrix4(q.M), n = new THREE.Vector3(0, 0, 1).transformDirection(q.M);
    return { ...q, at, n, ring: q.lit.leaves.find((l) => kindOf(l) === 'sock:ring'), segs: q.gauge.leaves.filter((l) => kindOf(l) === 'sock:seg'), bars: q.gauge.leaves.filter((l) => kindOf(l) === 'sock:bar'), shown: null, litAt: -1, irisAt: -1 };
  }).sort((a, b) => a.at.x - b.at.x || a.at.z - b.at.z || a.at.y - b.at.y);
  const sockY = sockets.reduce((s, q) => s + q.at.y, 0) / (sockets.length || 1);
  // ── the rack's bays ──
  const bays = live('oreCan').map((D) => { const body = D.leaves.find((l) => kindOf(l) === 'mb:canister'), rest = restOf(body); return { can: canOf(D), at: posOf(rest), yaw: yawOf(rest) }; }).sort((a, b) => a.at.x - b.at.x || a.at.z - b.at.z);
  if (sockets.length < mounts.length || bays.length < mounts.length) return null;

  // ── the site, for the timetable and for working the crane by hand ──
  const home = posOf(P.trolley.M), turn = posOf(P.disc.M), railY = home.y, half = CANISTER_AT.half;
  // the legs' ends: the station file's own words for the rail (its place 'crane'), else just past what it serves
  const ends = railPlace && railPlace.wall && railPlace.ship
    ? { wall: [Math.min(railPlace.wall[0][0], railPlace.wall[1][0]), Math.max(railPlace.wall[0][0], railPlace.wall[1][0])], ship: [turn.z, Math.max(railPlace.ship[0][1], railPlace.ship[1][1])] }
    : { wall: [Math.min(...sockets.map((q) => q.at.x), ...bays.map((b) => b.at.x)) - 1, Math.max(...sockets.map((q) => q.at.x), ...bays.map((b) => b.at.x)) + 1], ship: [turn.z, Math.max(...mounts.map((m) => m.at.z + m.out.z)) + 1] };
  const site = { carry: railY + CRANE.carry, wallZ: turn.z, shipX: turn.x, turn: [turn.x, turn.z], home: [home.x, home.z],
    mounts: mounts.map((m) => ({ at: m.at.toArray(), yaw: m.yaw, out: [m.out.x, m.out.z], upper: m.at.y > midY })),
    sockets: sockets.map((q) => ({ at: q.at.toArray(), n: [q.n.x, q.n.z], upper: q.at.y > sockY })),
    bays: bays.map((b) => ({ at: b.at.toArray() })), can: { half, seat: SOCKET.seat, clear: SOCKET.clear, rise: SOCKET.rise, lift: TRAY_LIFT.h },
    rail: { ...ends, y: railY },
    dims: { R: CANISTER_AT.R, grip: { ...CRANE.grip }, arc: { ...CRANE.arc }, arms: ARMS.map((a) => ({ ...a })), reach: CRANE.beam.reach, body: CRANE.body.half,
      sock: { deep: SOCKET.deep, bore: SOCKET.bore, mouth: SOCKET.mouth, out: SOCKET.out }, trayShare: TRAY_LIFT.share, cable: { x: CRANE.cable.x, z: CRANE.cable.z }, cableTop: CRANE.beam.y0 - CRANE.car.h } };
  // the canisters themselves: the mounts' first, then the rack's; `slot[c]` is which of them the timetable's canister c is
  const cans = [...mounts.map((m) => m.can), ...bays.map((b) => b.can)];
  let slot = cans.map((_, i) => i), plan = planCycle(site, { bayYaw: bays.map((b) => b.yaw) }, speed), round = 0;

  // ── putting everything where a state says it is (the round's at a time, or the crane worked live) ──
  const trolleyM = new THREE.Matrix4(), cradleM = new THREE.Matrix4(), canM = new THREE.Matrix4(), hookAt = new THREE.Vector3();
  const K = CRANE.cable, topY = CRANE.beam.y0 - CRANE.car.h;
  const cableAt = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * K.x, sz * K.z]));
  const docked = sockets.map(() => -1);
  let discWas = NaN;
  function poseState(S) {
    const x = S.x, z = S.z, yaw = S.yaw, u = S.slide, h = S.hoist, arms = smooth(S.arms);
    // the trolley on the rail (its beam turned with it), the carriage along the beam, the cables down to the cradle
    trolleyM.makeRotationY(yaw).setPosition(x, railY, z); setM(P.trolley, trolleyM); if (P.beacon) setM(P.beacon, trolleyM);
    setM(P.carriage, _m.copy(trolleyM).multiply(_n.makeTranslation(0, CRANE.beam.y0, u)));
    const len = Math.max(0.02, railY + topY - (h + CRANE.grip.top)) / K.unit;
    P.cables.forEach((leaf, i) => setM(leaf, _m.copy(trolleyM).multiply(_n.makeTranslation(cableAt[i][0], topY, u + cableAt[i][1])).scale(_s.set(1, len, 1))));
    hookAt.set(0, 0, u).applyMatrix4(trolleyM).setY(h);
    cradleM.makeRotationY(yaw).setPosition(hookAt); setM(P.cradle, cradleM); if (P.lamp) setM(P.lamp, cradleM);
    P.arcs.forEach((leaf, i) => setM(leaf, _m.copy(cradleM).multiply(_n.makeTranslation(0, 0, ARMS[i].z)).multiply(_r.makeRotationZ(-ARMS[i].way * CRANE.arc.shut * arms))));
    // the turntable's plate
    const disc = S.disc; if (disc !== discWas) { discWas = disc; setM(P.disc, _m.copy(P.disc.M).multiply(_r.makeRotationY(disc)).multiply(P.disc.base)); }
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
      if (at.where === 'held') { key = ''; canM.copy(cradleM).multiply(_r.makeRotationY(at.rel)); }
      else if (at.where === 'mount') {
        // (riding its tray: moved as far as the tray's inner bars have moved from home; end for end if it was set
        // down that way round)
        const m = mounts[at.i], flip = Math.cos(at.yaw - m.yaw) < 0; m.trayLeaf.meshes[0].getMatrixAt(m.trayLeaf.index, _m); _v.setFromMatrixPosition(_m).sub(m.trayRest);
        key += ':' + _v.x.toFixed(4) + ',' + _v.z.toFixed(4) + (flip ? ':f' : ''); if (key === C.key) return;
        canM.copy(m.rest); canM.elements[12] += _v.x; canM.elements[13] += _v.y; canM.elements[14] += _v.z;
        if (flip) canM.multiply(_r.makeRotationY(Math.PI));
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
      if (f !== C.fill) { C.fill = f; tint(C.level, G.ore, C.level0); tint(C.rings, mix(G.blue, G.amber, smooth(f / 0.12)), C.rings0); }
    });
    // the sockets: the iris, the ring, the display (the number of the canister docked in it, percent left, and its bars)
    sockets.forEach((q, k) => {
      const iris = S.iris[k]; if (iris !== q.irisAt) { q.irisAt = iris; setDoors([q.iris], iris); }
      // (the collar's latch dogs slide in onto the seated canister as its ring lights, and let go before it is drawn out)
      const lit = S.lit[k]; if (lit !== q.litAt) { q.litAt = lit; setDoors([q.lit], lit); tint(q.ring, mix(GLOWS.ringOff, GLOWS.ringOn, smooth(lit)), GLOWS.ringOff); }
      const c = docked[k], f = c < 0 ? -1 : S.cans[c].fill, text = c < 0 ? '' : String(Math.round(f * 100)), bars = c < 0 ? 0 : Math.ceil(f * GAUGE.bars - 1e-6), shown = text + '|' + bars;
      if (shown === q.shown) return; q.shown = shown;
      const col = f > 0.2 ? GLOWS.ok : GLOWS.low, pad = text.padStart(GAUGE.digits, ' ');
      for (let d = 0; d < GAUGE.digits; d++) { const on = DIGIT.on[pad[d]] || ''; for (let s = 0; s < DIGIT.order.length; s++) tint(q.segs[d * DIGIT.order.length + s], on.includes(DIGIT.order[s]) ? col : GLOWS.off, GLOWS.off); }
      q.bars.forEach((leaf, b) => tint(leaf, b < bars ? col : GLOWS.off, GLOWS.off));
    });
  }
  const scratch = { tray: [], iris: [], lit: [], cans: [] };
  const pose = (t) => poseState(stateAt(plan, t, scratch));

  // the round is over: every canister is where the next round starts, under another number
  function next() {
    const N = plan.next;
    slot = [...N.onMount.map((c) => slot[c]), ...N.inBay.map((c) => slot[c])];
    plan = planCycle(site, { bayYaw: N.bayYaw, yaw: N.yaw }, speed); round++;
    for (const C of cans) C.key = ''; discWas = NaN;
  }
  // the round taken up again from a state (after the crane was worked by hand): the same canisters, the same numbers
  function resume(S) {
    plan = planFrom(site, S, speed);
    for (const C of cans) C.key = ''; discWas = NaN;
    for (const m of mounts) m.trayAt = undefined;
    for (const q of sockets) { q.irisAt = -1; q.litAt = -1; q.shown = null; }
    return plan;
  }
  const meshes = new Set(), doors = [craneD, turnD, ...live('mbCanister'), ...live('oreSocket'), ...live('oreCan')];
  for (const D of doors) for (const leaf of D.leaves) for (const im of leaf.meshes) meshes.add(im);
  let lamp = null;
  const L = {
    site, mounts, sockets, bays, cans, get plan() { return plan; }, get length() { return plan.length; }, get round() { return round; }, get slot() { return slot; },
    pose, poseState, next, resume, state: (t) => stateAt(plan, t), clean: (t, ahead) => cleanAt(plan, t, ahead),
    load: (t) => loadAt(plan, t), steady: (t, ahead) => steadyAt(plan, t, ahead), gate: (t, ahead = 0) => gateAt(plan, t, ahead),
    hook(t) { const T = plan.T, yaw = valueAt(T.yaw, t), u = valueAt(T.slide, t); return new THREE.Vector3(valueAt(T.x, t) + Math.sin(yaw) * u, valueAt(T.hoist, t), valueAt(T.z, t) + Math.cos(yaw) * u); },
    beacon(on) { if (on === lamp) return; lamp = on; for (const leaf of [P.beacon, P.lamp]) if (leaf) tint(leaf, on ? GLOWS.beaconOn : GLOWS.beaconOff, GLOWS.beaconOff); },
    meshes: [...meshes], doors,
  };
  L.beacon(false); pose(0);
  return L;
}
