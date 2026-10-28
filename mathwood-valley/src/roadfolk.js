// ROAD FOLK: riders on horseback and people on foot travelling the road through the valley, as the wagons do
// (src/traffic.js makes this and runs it each frame; the numbers are in src/roadfolkplan.js). They come in from the
// road's ends, or from out of sight of the town, and go the whole way through: past the camps, across the town square
// and out the far side to the other end, where they are gone (fading into the haze if the player is right there).
// THEY TRAVEL IN PARTIES (Dad: "more pairs of mounted riders and hikers"): riders often two abreast, hikers alone, in
// twos side by side, or threes (two abreast, one a step behind), most hikers with a pack and some with a bedroll on it.
// A party keeps one pace; its leader keeps the traveller's line just outside the wagons' lane, the others alongside,
// further out toward the road's edge; where the edge is tight, or while they pass someone or step round the player, they
// fall in behind (single file) and come back alongside after.
// Each keeps to the right-hand edge of the road, outside the wagons' lane, so the wagons roll past them; where the
// edge is blocked (a fence post, a thicket) they come in toward the middle and a wagon behind waits for them. They slow
// behind someone slower going their way (riders step out round walkers when the way is clear), stop for the
// player, the horse and the dog (and step round them after a moment), and wait short of a wagon a gang has held up.
// Coming close, each says hello (src/ui/howdy.js): a walker stops a moment and waves, a rider tips his hat.
// They cost little far away: one is only made (a person, or a horse with its saddle and rider) within `show` metres of
// the player, the nearest few at most; past that it is a far figure (src/crowd.js), the two crossfading as one takes
// over from the other, or, past the figures' reach, just a number moving along the road.
// HOW MANY, live: the governor's 'travellers' dial (world/governor.js; else ROADFOLK by the tier). NOTHING POPS IN VIEW:
// a new party sets off only where the player can't see it (a road's end, a stretch of road out of view: src/sight.js);
// when the governor wants fewer, a party leaves only once it is out of sight (it waits its turn), and fewer drawn as
// real models hands one back to its far figure only once it is out of sight (or so far off it is a few pixels).
//
//   const F = makeRoadFolk({ W, scene, folk, animals, road, square, camera, things, wagons, riding, crowd })
//     road: the road through the valley (src/wagon.js roadCurve, with its laneAt); square: where the town square is
//     along it (m); camera: what "in sight" means; things(): what to stop for this frame (as the traffic's obstacles:
//     Vector3s, objects with a .position, or { x, z }); wagons(): the traffic's travellers (the ones a gang holds up:
//     .held); riding(): the player is on a horse (a "Fine horse!" now and then); crowd: the far figures (src/crowd.js:
//     the traffic's; its begin and end are the traffic's to call)
//   F.update(dt, at)    each frame while riding (at: the player's position)
//   F.list              the travellers: { kind: 'rider' | 'walker', dir, u, speed, pace, k (m right of the road's
//                       middle), made, why, party, ... }      F.parties   [{ id, kind, size, dir, members }]
//   F.inLane()          where the made ones standing in the wagons' lane are just now ([Vector3]: a wagon stops for them)
//   F.send(kind, dir, u, size)   (dev and rigs) one more party now (size: 1 unless given), at u metres along the road
//                       (default: where one would set off); returns its leader
//   F.hold = true       no new ones set off (the ones on the road go on their way)
//   F.state()           for rigs: { n, made, most, madeMost, parties, list: [{ id, kind, dir, u, pace, k, made, why, dist, fade, party, rank }] }
//   F.dispose()
import * as THREE from 'three';
import { makePerson, SKINS, HAIRS, PALETTES } from './actors/folk.js';
import { loadRiderKit, makeRider } from './actors/riders.js';
import { wagonAt, fadeAll, unfade } from './wagon.js';
import { howdy, makeHowdyWatch } from './ui/howdy.js';
import { ROADFOLK, TRAVELLER_LOOKS, pickParty, paceFor, edgeOf, startFor, seedSpots, slotFor, hikerKit, spacing } from './roadfolkplan.js';
import { AMBUSH } from './missions/wagonplan.js';
import { makeSight } from './sight.js';
import { COATS } from './crowd.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// THE BEDROLL: a blanket rolled and strapped across the top of a hiker's pack (made once, shared), hung on the chest
// bone so it moves with the back
let BEDROLL = null;
function bedrollPart() {
  if (BEDROLL) return BEDROLL;
  const roll = new THREE.CylinderGeometry(0.075, 0.075, 0.44, 10); roll.rotateZ(Math.PI / 2);
  return (BEDROLL = { roll, mat: new THREE.MeshStandardMaterial({ color: 0xbdb193, roughness: 0.95 }), strap: new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.8 }), band: new THREE.CylinderGeometry(0.08, 0.08, 0.035, 10).rotateZ(Math.PI / 2) });
}
const _bq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _bs = new THREE.Vector3(), _bv = new THREE.Vector3();
function addBedroll(p, shadows) {
  const bone = p.bones && (p.bones.Chest || p.bones.Spine2 || p.bones.Spine1 || p.bones.Spine);
  if (!bone) return null;
  const B = bedrollPart(), g = new THREE.Group();
  const roll = new THREE.Mesh(B.roll, B.mat); roll.castShadow = shadows; g.add(roll);
  for (const x of [-0.13, 0.13]) { const s = new THREE.Mesh(B.band, B.strap); s.position.x = x; g.add(s); }
  // (placed in the person's own frame, behind the upper back on top of the pack, then carried into the bone's)
  p.root.updateMatrixWorld(true);
  _bv.set(0, 1.4, -0.21).applyMatrix4(p.root.matrixWorld); bone.worldToLocal(_bv); g.position.copy(_bv);
  bone.getWorldQuaternion(_bq); p.root.getWorldQuaternion(_rq); g.quaternion.copy(_bq.invert().multiply(_rq));
  bone.getWorldScale(_bs); g.scale.setScalar(1 / (_bs.x || 1));
  bone.add(g);
  return g;
}

export function makeRoadFolk({ W, scene = W.scene, folk, animals, road, square = 0, camera = null, things = () => [], wagons = () => [], riding = () => false, crowd = null }) {
  const L = road.getLength();
  const tier = W.tier in ROADFOLK.most ? W.tier : 'normal';
  // HOW MANY: the tier's, or the governor's 'travellers' dial (live)
  let most = 0, madeMost = 0, show = 0, hide = 0, sp = null;
  const caps = (v) => { most = v.most; madeMost = v.made; show = v.show; hide = show + ROADFOLK.hide; sp = spacing(most, L); };
  caps({ most: ROADFOLK.most[tier], made: ROADFOLK.made[tier], show: ROADFOLK.show[tier] });
  const offGov = W.governor ? W.governor.on('travellers', caps) : null;
  const shadows = !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  const F = { list: [], parties: [], kit: null, hold: false, log: [] };
  // (for the rigs: every party joining or leaving the road, why, and whether the player could see the spot: never, but
  // for the ride's first ones, laid out as the ride starts)
  const note = (what, why, P) => { const m = P.members[0]; F.log.push({ t: +(performance.now() / 1000).toFixed(1), what, why, kind: P.kind, size: P.members.length, seen: !hidden(m.pos.x, m.pos.z) }); if (F.log.length > 300) F.log.shift(); };
  const here = new THREE.Vector3();   // (where the player is)
  let disposed = false, timer = rnd(...sp.every) * 0.5, nextDir = Math.random() < 0.5 ? 1 : -1, count = 0, pid = 0;
  loadRiderKit({ animals }).then((k) => { if (!disposed) { F.kit = k; warmKit(k); } }).catch((e) => console.warn('road folk: the riders could not load', e));
  // the riders' shaders built once in the background as the kit arrives (both horses, both saddles, dissolving as a
  // traveller's are), so the first rider to come into range doesn't build them all in one frame; the stand-ins are let
  // go once built (their shader programs stay: src/wagon.js unfade)
  function warmKit(k) {
    if (!W.warmFor) return;
    const g = new THREE.Group(), made = [];
    try {
      for (const [horse, saddle] of [['horse', 0], ['horseWhite', 1]]) {
        const r = makeRider(k, { W, folk, scene: g, horse, saddle, shadows });
        r.place(0, 0, 0); r.update(0);
        const mem = {}; fadeAll([r.horse.root, r.person.root], 1, mem, [r.person]);
        made.push([r, mem]);
      }
    } catch (e) { console.warn('road folk: the riders\' warm-up', e); }
    const done = () => { for (const [r, mem] of made) { unfade(mem); r.dispose(); } };
    W.warmFor(g).then(done, done);
  }

  // ── THE ROAD ───────────────────────────────────────────────────────────────────────────────────────────────────
  // a point u metres along the road, k metres to the right of its middle for one going `dir` (past an end: straight on)
  const _t = new THREE.Vector3();
  function spot(u, dir, k, out) {
    const c = Math.min(L, Math.max(0, u));
    road.getPointAt(c / L, out); road.getTangentAt(c / L, _t);
    if (u !== c) { out.x += _t.x * (u - c); out.z += _t.z * (u - c); }
    out.x += -_t.z * dir * k; out.z += _t.x * dir * k;
    return out;
  }
  const laneAt = (u, dir) => (road.laneAt ? road.laneAt(Math.min(L, Math.max(0, u)), dir, 1.3) : 1.3);
  const _g = new THREE.Vector3();
  const clearAt = (u, dir, k) => { spot(u, dir, k, _g); return !W.blocked(_g.x, _g.z); };
  // how far out it keeps here: its edge, or in from it as far as needed for clear ground (never past `least`)
  function edgeHere(t, u = t.u) {
    const e = edgeOf(t.kind, laneAt(u, t.dir));
    for (let k = e; k >= ROADFOLK.least; k -= 0.35) if (clearAt(u, t.dir, k) && clearAt(u + t.dir * 1.5, t.dir, k)) return k;
    return ROADFOLK.least;
  }

  // ── IN SIGHT ───────────────────────────────────────────────────────────────────────────────────────────────────
  // seen(): in the camera's view (for a made one dissolving where there are no far figures); hidden(): Dad's out of
  // sight (src/sight.js: out of view, behind a building or a rise, or far off: past the far figures' reach, for what
  // comes onto the road or leaves it, so not even a figure pops)
  const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sp = new THREE.Sphere();
  let frustumOk = false;
  const sight = camera ? makeSight({ W, camera }) : null;
  function lookNow() {
    frustumOk = !!camera;
    if (!camera) return;
    camera.updateMatrixWorld(); _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
    if (sight) sight.view();
  }
  const seen = (x, z, r = 2.5) => frustumOk && _fr.intersectsSphere(_sp.set(_g.set(x, W.heightAt(x, z) + 1.2, z), r));
  const reach = () => Math.max(sight ? sight.far : 0, crowd ? crowd.far : 0);
  const hidden = (x, z, far = reach()) => !sight || sight.unseen(x, z, undefined, 2.5, far);
  const hiddenU = (u, dir) => { spot(u, dir, edgeOf('walker', laneAt(u, dir)), _g); return hidden(_g.x, _g.z); };

  // ── A PARTY ────────────────────────────────────────────────────────────────────────────────────────────────────
  function lookOf(kit) {
    return { outfit: kit && kit.outfit ? kit.outfit : pick(TRAVELLER_LOOKS.outfits), palette: pick(TRAVELLER_LOOKS.palettes), skin: Math.floor(Math.random() * SKINS.length), hair: Math.floor(Math.random() * HAIRS.length) };
  }
  function add(kind, dir, u, party, rank) {
    const kit = kind === 'walker' ? hikerKit() : null, look = lookOf(kit);
    const t = {
      id: count++, kind, dir, u, speed: party.speed, pace: 0, k: null, shift: 0, shiftLeft: 0, passing: null, party, rank,
      // (the kit its far figure shows: a pack with the adventurers' outfits, whoever wears one, and the bedroll on top)
      slot: slotFor(kind, rank), kit: kind !== 'walker' ? 0 : kit && kit.bedroll ? 2 : /^adventurer_/.test(look.outfit) ? 1 : 0, look,
      made: null, mem: null, gear: null, fade: 1, fadeTo: 1, fadeRate: 1, ending: false, gone: false, why: '', stopT: 0, waveT: 0,
      hw: makeHowdyWatch(), pos: new THREE.Vector3(), h: 0, dist: Infinity, lastX: null, lastZ: null,
    };
    t.pace = t.speed;
    spot(u, dir, edgeOf(kind, laneAt(u, dir)) + t.slot.dk, t.pos); t.h = Math.atan2(_t.x * dir, _t.z * dir);
    F.list.push(t);
    return t;
  }
  function addParty(kind, size, dir, u) {
    const P = { id: pid++, kind, size, dir, speed: paceFor(kind), members: [], coat: COATS[Math.floor(Math.random() * COATS.length)] };
    for (let i = 0; i < size; i++) P.members.push(add(kind, dir, u - dir * slotFor(kind, i).du, P, i));
    F.parties.push(P);
    return P;
  }
  const leadOf = (P) => P.members.find((m) => !m.gone) || null;
  const membersOf = (P) => P.members.filter((m) => !m.gone);
  function send(kind = null, dir = null, u = null, size = null) {
    const d = dir || nextDir; nextDir = -d;
    const p = kind ? { kind, size: size || 1 } : pickParty(Math.random, W.night || 0);
    let at = u;
    if (at == null) {
      at = startFor(d, { L, square, far: hide + 10, others: F.list, apart: sp.apart, ok: (s) => hiddenU(s, d), dist: (s) => { spot(s, d, 0, _g); return Math.hypot(_g.x - here.x, _g.z - here.z); } });
      if (at == null) return null;
    }
    const P = addParty(p.kind, p.size, d, at); note('join', 'set off', P); return P.members[0];
  }
  F.send = (kind, dir, u, size) => send(kind, dir, u, size);
  const roots = (t) => (t.kind === 'rider' ? [t.made.horse.root, t.made.person.root] : [t.made.root]);
  const personOf = (t) => (t.kind === 'rider' ? t.made.person : t.made);
  function make(t, inSight) {
    if (t.kind === 'rider') {
      if (!F.kit) return false;
      const r = makeRider(F.kit, { W, folk, scene, look: t.look, shadows });
      r.place(t.pos.x, t.pos.z, t.h); r.speed = t.pace; r.update(0);
      t.made = r;
    } else {
      const p = makePerson(folk, { ...t.look, shadows });
      p.root.position.set(t.pos.x, W.heightAt(t.pos.x, t.pos.z), t.pos.z); p.root.rotation.set(0, t.h, 0);
      p.play('Walk', { fade: 0 }); p.update(Math.random());
      scene.add(p.root);
      t.made = p; t.clip = 'Walk';
      if (t.kit === 2) { p.update(0); t.gear = addBedroll(p, shadows); }
    }
    t.mem = {};
    if (t.k == null) t.k = edgeHere(t);
    // (made where its far figure stands: the two crossfade; with no figures there, made in sight it comes in out of the
    // haze, else it is simply there)
    if (crowd && t.dist < crowd.far) { t.fade = 0; t.fadeTo = 1; t.fadeRate = 1 / ROADFOLK.fade.in; }
    else if (inSight) { t.fade = 0; t.fadeTo = 1; t.fadeRate = 1 / ROADFOLK.fade.in; } else { t.fade = 1; t.fadeTo = 1; }
    fadeAll(roots(t), t.fade, t.mem, [personOf(t)]);
    t.hw.reset();
    return true;
  }
  function unmake(t) {
    if (!t.made) return;
    unfade(t.mem); t.mem = null;
    if (t.gear) { t.gear.removeFromParent(); t.gear = null; }
    if (t.kind === 'rider') t.made.dispose();
    else { t.made.root.removeFromParent(); t.made.dispose(); }
    t.made = null; t.fade = 1; t.fadeTo = 1;
  }
  // put away: in sight, it dissolves first (then `then`: 'away' unmade, 'gone' taken off the road)
  function fadeOut(t, rate, then) { t.fadeTo = 0; t.fadeRate = 1 / rate; t.then = then; }
  // a made one handed back to its far figure (or a number): crossfading with the figure where there is one, at once where
  // the player can't see it; else not now (false: it waits its turn)
  function handBack(t) {
    if (!t.made || t.fadeTo <= 0) return true;
    if (crowd && t.dist < crowd.far) { fadeOut(t, ROADFOLK.fade.out, 'away'); return true; }
    if (hidden(t.pos.x, t.pos.z, sight ? sight.far : 0)) { unmake(t); return true; }
    return false;
  }

  // ── RIDING OUT: a few already on the road ──────────────────────────────────────────────────────────────────────
  let seeded = false;
  function seed(at) {
    seeded = true;
    here.copy(at);
    const n = Math.round(most * ROADFOLK.seed / 1.8);
    for (const s of seedSpots(n, { L, apart: sp.apart, dist: (u) => { spot(u, 1, 0, _g); return Math.hypot(_g.x - at.x, _g.z - at.z); } })) { const p = pickParty(Math.random, W.night || 0); addParty(p.kind, p.size, s.dir, s.u); }
  }
  // THE GOVERNOR'S MORE AND FEWER (every half second): well short of the most, a party joins the road where the player
  // can't see it (rather than waiting for the ends to send them); over it, a party out of sight leaves
  let tidyT = 0, makeT = 0;
  function tidy(at) {
    if (F.hold) return;
    if (F.list.length < most * 0.6) {
      const dist = (u) => { spot(u, 1, 0, _g); return Math.hypot(_g.x - at.x, _g.z - at.z); };
      for (const s of seedSpots(3, { L, apart: sp.apart, away: show + 40, others: F.list, dist })) {
        if (!hiddenU(s.u, s.dir)) continue;
        const p = pickParty(Math.random, W.night || 0); note('join', 'more wanted', addParty(p.kind, p.size, s.dir, s.u)); break;
      }
    } else if (F.list.length > most + 2) {
      let best = null;
      for (const P of F.parties) {
        const ms = membersOf(P);
        if (!ms.length || ms.some((m) => m.made || m.ending || m.dist < show || !hidden(m.pos.x, m.pos.z))) continue;
        if (!best || ms[0].dist > best.d) best = { P, d: ms[0].dist };
      }
      if (best) { note('leave', 'fewer wanted', best.P); for (const m of best.P.members) m.gone = true; }
    }
  }

  // ── EACH FRAME ─────────────────────────────────────────────────────────────────────────────────────────────────
  const _a = new THREE.Vector3(), _q = new THREE.Vector3();
  const posOf = (q) => (q.isVector3 ? q : q.position || q);
  // the pace the party may go this frame (and why it holds back): its leader's way ahead, and each member's own
  function wanted(t, list, held, dt) {
    const kind = t.kind, la = ROADFOLK.look[kind], wide = ROADFOLK.wide[kind], ms = membersOf(t.party);
    let v = t.speed; t.why = '';
    if (ms.some((m) => m.waveT > 0)) { t.why = 'saying hello'; return 0; }
    // a wagon held up by a gang ahead: it waits short of it (either way)
    for (const h of held) { const e = (h.u - t.u) * t.dir; if (e > 0 && e < AMBUSH.hold) { t.why = 'waiting: a hold-up'; return 0; } }
    // another party going the same way just ahead, slower: behind them at their pace (riders step round walkers)
    for (const o of F.list) {
      if (o.party === t.party || o.dir !== t.dir || o.gone) continue;
      const e = (o.u - t.u) * t.dir;
      if (e <= 0 || e > la + 2.5) continue;
      if (!ms.some((m) => Math.abs((o.k ?? 0) - (m.k ?? 0)) <= 0.9)) continue;
      if (t.kind === 'rider' && o.kind === 'walker' && t.made && !t.passing && passClear(t)) { t.passing = o; t.shift = -ROADFOLK.pass; t.shiftLeft = Infinity; continue; }
      if (t.passing && t.passing.party === o.party) continue;
      v = Math.min(v, e < 1.8 ? 0 : o.pace); t.why = 'behind someone slower';
    }
    if (t.passing && ((t.passing.u - t.u) * t.dir < -3 - ROADFOLK.behind * 2 || t.passing.gone || !F.list.includes(t.passing))) { t.passing = null; t.shiftLeft = 4; }
    if (!ms.some((m) => m.made)) return v;
    // the player, the horse, the dog ...: stop short (then step round them); a wagon in the way: wait for it
    let block = Infinity, by = null;
    for (const m of ms) {
      if (!m.made) continue;
      for (const q of list) {
        const p = posOf(q); if (p.x === undefined) continue;
        if (Math.abs(p.x - m.pos.x) > la + 3 || Math.abs(p.z - m.pos.z) > la + 3) continue;
        for (let d = 0.4; d <= la + 0.01; d += 0.7) { spot(m.u + m.dir * d, m.dir, m.k, _a); if (Math.hypot(p.x - _a.x, p.z - _a.z) < wide) { if (d < block) { block = d; by = p; } break; } }
      }
      for (let d = 0.8; d <= la + 0.01; d += 0.9) { spot(m.u + m.dir * d, m.dir, m.k, _a); const G = wagonAt(_a.x, _a.z, 0.35); if (G) { block = Math.min(block, d); t.why = 'waiting for a wagon'; break; } }
    }
    if (block < Infinity) {
      v = Math.min(v, block < 1.0 ? 0 : (block - 1.0) * 1.2);
      if (by) { t.why = 'stopped for someone'; if (v < 0.05) stepRound(t, by, dt); }
    } else t.stopT = 0;
    return v;
  }
  // riders can step in to pass: the ground clear there and no wagon in the way (the party passes in single file)
  function passClear(t) {
    const k = t.k - ROADFOLK.pass;
    if (k < ROADFOLK.least) return false;
    for (let d = 0; d <= 8; d += 2) { spot(t.u + t.dir * d, t.dir, k, _a); if (W.blocked(_a.x, _a.z) || wagonAt(_a.x, _a.z, 0.5)) return false; }
    return true;
  }
  // stopped a while for someone standing in the way: a step to one side of them (away from where they stand)
  function stepRound(t, p, dt) {
    t.stopT += dt;
    if (t.stopT < ROADFOLK.stepAfter) return;
    t.stopT = 0;
    spot(t.u, t.dir, 0, _q);
    const side = (p.x - _q.x) * -_t.z * t.dir + (p.z - _q.z) * _t.x * t.dir;   // (how far right of the middle they are)
    for (const s of side > t.k ? [-1, 1] : [1, -1]) {
      const k = t.k + s * ROADFOLK.sideStep;
      if (k < ROADFOLK.least || k > edgeOf(t.kind, laneAt(t.u, t.dir)) + 1.5) continue;
      if (clearAt(t.u + t.dir * 1.5, t.dir, k)) { t.shift = k - edgeHere(t); t.shiftLeft = 6; return; }
    }
  }
  // the leader: its pace, along the road, and its line (its edge, and any step aside easing back to it)
  function lead(t, dt, list, held) {
    const edge = t.made ? edgeHere(t) : edgeOf(t.kind, laneAt(t.u, t.dir));
    if (t.k == null) t.k = edge;
    const v = wanted(t, list, held, dt);
    const acc = ROADFOLK.accel[t.kind], brk = ROADFOLK.brake[t.kind];
    t.pace = t.pace < v ? Math.min(v, t.pace + acc * dt) : Math.max(v, t.pace - brk * dt);
    t.u += t.dir * t.pace * dt;
    if (t.shiftLeft < Infinity && t.shift) { t.shiftLeft -= t.pace * dt; if (t.shiftLeft <= 0) t.shift = 0; }
    const want = Math.max(ROADFOLK.least, edge + t.shift);
    t.k += Math.max(-0.9 * dt, Math.min(0.9 * dt, want - t.k));
  }
  // the others: alongside the leader, further out (or behind it, in single file: passing, stepping round, a tight edge)
  function follow(t, L0, rank, dt) {
    const side = ROADFOLK.abreast[t.kind] ?? ROADFOLK.abreast.walker;
    const single = !!L0.passing || L0.shift < -0.05 || L0.stopT > 0 || ((t.made || L0.made) && !(clearAt(L0.u, L0.dir, L0.k + side) && clearAt(L0.u + L0.dir * 2, L0.dir, L0.k + side)));
    const want = slotFor(t.kind, rank, single ? 0 : Infinity), e = ROADFOLK.ease * dt;
    const ddu = Math.max(-e * 1.5, Math.min(e * 1.5, want.du - t.slot.du));
    t.slot = { du: t.slot.du + ddu, dk: t.slot.dk + Math.max(-e, Math.min(e, want.dk - t.slot.dk)) };
    t.dir = L0.dir; t.u = L0.u - L0.dir * t.slot.du; t.k = Math.max(ROADFOLK.least, (L0.k ?? edgeOf(t.kind, laneAt(t.u, t.dir))) + t.slot.dk);
    t.pace = Math.max(0, L0.pace - ddu / Math.max(dt, 1e-3)); t.why = L0.why; t.passing = L0.passing;
  }

  F.update = (dt, at) => {
    if (disposed || !at) return;
    here.copy(at);
    if (!seeded) seed(at);
    lookNow();
    // a new party now and then (from out of sight)
    if ((timer -= dt) <= 0) { timer = rnd(...sp.every); if (!F.hold && F.list.length < most) send(); }
    if ((tidyT -= dt) <= 0) { tidyT = 0.5; tidy(at); }
    // which are made: the nearest few within `show` (one made a frame: making one is the costly part), a party together
    let live = 0, far = null;
    for (const t of F.list) {
      t.dist = Math.hypot(t.pos.x - at.x, t.pos.z - at.z);
      if (!t.made) continue;
      if (t.fadeTo > 0) live++;
      if (t.dist > hide && t.fadeTo > 0) handBack(t);
      else if (t.fadeTo > 0 && (!far || t.dist > far.dist)) far = t;
    }
    let next = null, nextScore = Infinity;
    for (const t of F.list) {
      if (t.made || t.gone || t.ending || t.dist >= show || (t.kind === 'rider' && !F.kit)) continue;
      const ms = membersOf(t.party), started = ms.some((m) => m.made), close = t.dist < ROADFOLK.always;
      if (!started && !close && ms.length > madeMost - live) continue;   // (a party is made together, or not yet; one close by always is)
      const score = started || close ? -1 : t.dist;
      if (score < nextScore) { next = t; nextScore = score; }
    }
    // the most made already: a party well nearer takes the farthest one's place (handed back to its figure)
    if (next && nextScore >= 0 && live >= madeMost && far && far.dist > next.dist + 20) for (const m of membersOf(far.party)) if (m.made && handBack(m) && m.fadeTo <= 0) live--;
    // (one made every ROADFOLK.makeEvery s at most: a rider is tens of milliseconds to build, and a run of them one a frame
    // was a dip of seconds that the governor took for a slow machine)
    makeT -= dt;
    if (next && makeT <= 0 && (nextScore < 0 || live < madeMost)) { make(next, seen(next.pos.x, next.pos.z)); makeT = ROADFOLK.makeEvery; }
    // more made than the most now (the governor turned it down): a party out of sight handed back, the farthest first;
    // none out of sight: they wait (a far one, a few pixels tall, may crossfade to its figure)
    if (live > madeMost + 2) {
      let back = null;
      for (const P of F.parties) {
        const ms = membersOf(P).filter((m) => m.made && m.fadeTo > 0); if (!ms.length || ms.some((m) => m.dist < ROADFOLK.always)) continue;
        const ok = ms.every((m) => hidden(m.pos.x, m.pos.z, sight ? sight.far : 0) || (crowd && m.dist > show * 0.8));
        if (ok && (!back || ms[0].dist > back.d)) back = { ms, d: ms[0].dist };
      }
      if (back) for (const m of back.ms) handBack(m);
    }
    // on their way: each party's leader, then the others round it, then each placed
    const list = things() || [], held = [];
    for (const w of wagons() || []) if (w.held && w.wg) held.push(w);
    for (const P of F.parties) {
      const L0 = leadOf(P); if (!L0) continue;
      lead(L0, dt, list, held);
      let rank = 1; for (const m of P.members) if (m !== L0 && !m.gone) follow(m, L0, rank++, dt);
      for (const m of P.members) if (!m.gone) place(m, dt, at);
    }
    for (let i = F.list.length - 1; i >= 0; i--) { const t = F.list[i]; if (t.gone) { unmake(t); F.list.splice(i, 1); } }
    F.parties = F.parties.filter((P) => { P.members = P.members.filter((m) => !m.gone); return P.members.length > 0; });
    // the far figures (src/crowd.js): everyone not drawn as a real model (and the ones crossfading), out to their reach
    if (crowd) figures();
  };
  function figures() {
    for (const t of F.list) {
      if (t.gone || t.ending || t.then === 'gone' || t.dist > crowd.far) continue;
      const a = t.made ? 1 - t.fade : 1; if (a <= 0.01) continue;
      const pal = PALETTES[t.look.palette] || PALETTES.drifter;
      if (t.kind === 'rider') crowd.rider(t.pos.x, t.pos.z, t.h, t.pace, { coat: t.party.coat, shirt: pal[0], hat: pal[3], seed: t.id }, a);
      else crowd.walker(t.pos.x, t.pos.z, t.h, t.pace, { shirt: pal[0], pants: pal[1], hat: pal[3], kit: t.kit, seed: t.id }, a);
    }
  }
  const _m = new THREE.Vector3();
  function place(t, dt, at) {
    // the road's end: gone (dissolving into the haze if the player is right there)
    if (!t.ending && (t.u < -2 || t.u > L + 2)) {
      if (t.made && t.dist < show && seen(t.pos.x, t.pos.z)) { t.ending = true; fadeOut(t, ROADFOLK.fade.end, 'gone'); }
      else { t.gone = true; return; }
    }
    spot(t.u, t.dir, t.k ?? edgeOf(t.kind, laneAt(t.u, t.dir)), _m);
    // facing the way it goes (and a little across while it steps aside)
    const mx = _m.x - t.pos.x, mz = _m.z - t.pos.z;
    let face = t.h;
    if (mx * mx + mz * mz > 1e-6) face = Math.atan2(mx, mz);
    else { spot(t.u + t.dir, t.dir, t.k ?? 0, _a); face = Math.atan2(_a.x - _m.x, _a.z - _m.z); }
    const turn = wrapA(face - t.h), most_ = ROADFOLK.turn * dt;
    const yaw = Math.max(-most_, Math.min(most_, turn));
    t.h = wrapA(t.h + yaw);
    t.pos.copy(_m);
    if (!t.made) return;
    // fading in or out
    if (t.fade !== t.fadeTo) {
      t.fade = t.fade < t.fadeTo ? Math.min(t.fadeTo, t.fade + t.fadeRate * dt) : Math.max(t.fadeTo, t.fade - t.fadeRate * dt);
      fadeAll(roots(t), t.fade, t.mem, [personOf(t)]);
      if (t.fade <= 0 && t.fadeTo <= 0) { if (t.then === 'gone') t.gone = true; else unmake(t); return; }
    }
    // saying hello as the player comes close
    const d = Math.hypot(at.x - t.pos.x, at.z - t.pos.z);
    if (t.waveT > 0) t.waveT -= dt;
    if (t.fade > 0.9 && !t.ending && t.hw.update(dt, d) && seen(t.pos.x, t.pos.z)) {
      howdy(personOf(t), null, { riding: !!riding() });
      if (t.kind === 'rider') t.made.tipHat();
      else if (t.made.play('Wave', { fade: 0.25, once: true })) { t.waveT = ROADFOLK.wave; t.clip = 'Wave'; }
    }
    if (t.kind === 'rider') {
      const r = t.made;
      r.yawRate = dt > 0 ? yaw / dt : 0;
      r.x = t.pos.x; r.z = t.pos.z; r.heading = t.h; r.speed = t.pace;
      r.update(dt);
      return;
    }
    // a walker: walking (the clip's speed is the pace over the stride), standing, or waving (turned to the player)
    const p = t.made;
    p.root.position.set(t.pos.x, W.heightAt(t.pos.x, t.pos.z), t.pos.z);
    if (t.waveT > 0) {
      const toward = Math.atan2(at.x - t.pos.x, at.z - t.pos.z);
      t.wh = (t.wh ?? t.h) + wrapA(toward - (t.wh ?? t.h)) * Math.min(1, dt * 5);
      p.root.rotation.set(0, t.wh, 0);
    } else {
      t.wh = null;
      p.root.rotation.set(0, t.h, 0);
      const stride = (p.stride && p.stride.Walk) || 1.4;
      if (t.pace > 0.08) {
        if (t.clip !== 'Walk') { p.play('Walk', { fade: 0.3, speed: t.pace / stride }); t.clip = 'Walk'; }
        if (p.person && p.person.cur) p.person.cur.setEffectiveTimeScale(Math.max(0.3, t.pace / stride));
      } else if (t.clip !== 'Idle') { p.play('Idle', { fade: 0.4 }); t.clip = 'Idle'; }
    }
    p.update(dt);
  }

  // the made ones in the wagons' lane just now (a wagon coming stops for them, or steers round)
  const inLane = [];
  F.inLane = () => {
    inLane.length = 0;
    for (const t of F.list) if (t.made && t.k != null && t.k < laneAt(t.u, t.dir) + ROADFOLK.inLane) inLane.push(t.pos);
    return inLane;
  };
  F.state = () => ({
    n: F.list.length, made: F.list.filter((t) => t.made).length, most, madeMost, show, kit: !!F.kit, parties: F.parties.length,
    sizes: F.parties.reduce((o, P) => { const k = `${P.kind}${P.members.length}`; o[k] = (o[k] || 0) + 1; return o; }, {}),
    list: F.list.map((t) => ({ id: t.id, kind: t.kind, dir: t.dir, u: +t.u.toFixed(1), pace: +t.pace.toFixed(2), k: t.k == null ? null : +t.k.toFixed(2), party: t.party.id, rank: t.party.members.indexOf(t), kit: t.kit,
      made: !!t.made, why: t.why, dist: Number.isFinite(t.dist) ? +t.dist.toFixed(1) : null, fade: +t.fade.toFixed(2), x: +t.pos.x.toFixed(1), z: +t.pos.z.toFixed(1), ending: t.ending })),
  });
  F.dispose = () => {
    disposed = true;
    if (offGov) offGov();
    for (const t of F.list) unmake(t);
    F.list.length = 0; F.parties.length = 0;
  };
  return F;
}
