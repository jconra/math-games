// ROAD FOLK: riders on horseback and people on foot travelling the road through the valley, as the wagons do
// (src/traffic.js makes this and runs it each frame; the numbers are in src/roadfolkplan.js). They come in from the
// road's ends, or from out of sight of the town, and go the whole way through: past the camps, across the town square
// and out the far side to the other end, where they are gone (fading into the haze if the player is right there).
// Each keeps to the right-hand edge of the road, outside the wagons' lane, so the wagons roll past them; where the
// edge is blocked (a fence post, a thicket) they come in toward the middle and a wagon behind waits for them. They slow
// behind someone slower going their way (a rider steps out round a walker when the way is clear), stop for the
// player, the horse and the dog (and step round them after a moment), and wait short of a wagon a gang has held up.
// Coming close, each says hello (src/ui/howdy.js): a walker stops a moment and waves, a rider tips his hat.
// They cost little far away: one is only made (a person, or a horse with its saddle and rider) within ROADFOLK.show
// metres of the player, the nearest few at most; beyond that it is just a number moving along the road. One made or
// put away in sight dissolves in or out (src/wagon.js fadeAll), never popping.
//
//   const F = makeRoadFolk({ W, scene, folk, animals, road, square, camera, things, wagons, riding })
//     road: the road through the valley (src/wagon.js roadCurve, with its laneAt); square: where the town square is
//     along it (m); camera: what "in sight" means; things(): what to stop for this frame (as the traffic's obstacles:
//     Vector3s, objects with a .position, or { x, z }); wagons(): the traffic's travellers (the ones a gang holds up:
//     .held); riding(): the player is on a horse (a "Fine horse!" now and then)
//   F.update(dt, at)    each frame while riding (at: the player's position)
//   F.list              the travellers: { kind: 'rider' | 'walker', dir, u, speed, pace, k (m right of the road's
//                       middle), made, why, ... }
//   F.inLane()          where the made ones standing in the wagons' lane are just now ([Vector3]: a wagon stops for them)
//   F.send(kind, dir, u)   (dev and rigs) one more now, at u metres along the road (default: where one would set off)
//   F.hold = true       no new ones set off (the ones on the road go on their way)
//   F.state()           for rigs: { n, made, most, madeMost, list: [{ id, kind, dir, u, pace, k, made, why, dist, fade }] }
//   F.dispose()
import * as THREE from 'three';
import { makePerson, SKINS, HAIRS } from './actors/folk.js';
import { loadRiderKit, makeRider } from './actors/riders.js';
import { wagonAt, fadeAll, unfade } from './wagon.js';
import { howdy, makeHowdyWatch } from './ui/howdy.js';
import { ROADFOLK, TRAVELLER_LOOKS, pickKind, paceFor, edgeOf, startFor, seedSpots } from './roadfolkplan.js';
import { AMBUSH } from './missions/wagonplan.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function makeRoadFolk({ W, scene = W.scene, folk, animals, road, square = 0, camera = null, things = () => [], wagons = () => [], riding = () => false }) {
  const L = road.getLength();
  const tier = W.tier in ROADFOLK.most ? W.tier : 'normal';
  const most = ROADFOLK.most[tier], madeMost = ROADFOLK.made[tier], show = ROADFOLK.show[tier], hide = show + ROADFOLK.hide;
  const shadows = !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  const F = { list: [], kit: null, hold: false };
  const here = new THREE.Vector3();   // (where the player is)
  let disposed = false, timer = rnd(...ROADFOLK.every) * 0.5, nextDir = Math.random() < 0.5 ? 1 : -1, count = 0;
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
  const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sp = new THREE.Sphere();
  let frustumOk = false;
  function lookNow() {
    frustumOk = !!camera;
    if (!camera) return;
    camera.updateMatrixWorld(); _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
  }
  const seen = (x, z, r = 2.5) => frustumOk && _fr.intersectsSphere(_sp.set(_g.set(x, W.heightAt(x, z) + 1.2, z), r));

  // ── ONE TRAVELLER ──────────────────────────────────────────────────────────────────────────────────────────────
  function add(kind, dir, u) {
    const t = {
      id: count++, kind, dir, u, speed: paceFor(kind), pace: 0, k: null, shift: 0, shiftLeft: 0, passing: null,
      look: { outfit: pick(TRAVELLER_LOOKS.outfits), palette: pick(TRAVELLER_LOOKS.palettes), skin: Math.floor(Math.random() * SKINS.length), hair: Math.floor(Math.random() * HAIRS.length) },
      made: null, mem: null, fade: 1, fadeTo: 1, fadeRate: 1, ending: false, gone: false, why: '', stopT: 0, waveT: 0,
      hw: makeHowdyWatch(), pos: new THREE.Vector3(), h: 0, dist: Infinity, lastX: null, lastZ: null,
    };
    t.pace = t.speed;
    spot(u, dir, edgeOf(kind, laneAt(u, dir)), t.pos); t.h = Math.atan2(_t.x * dir, _t.z * dir);
    F.list.push(t);
    return t;
  }
  function send(kind = null, dir = null, u = null) {
    const d = dir || nextDir; nextDir = -d;
    const k = kind || pickKind(Math.random, W.night || 0);
    let at = u;
    if (at == null) {
      at = startFor(d, { L, square, far: hide + 10, others: F.list, dist: (s) => { spot(s, d, 0, _g); return Math.hypot(_g.x - here.x, _g.z - here.z); } });
      if (at == null) return null;
    }
    return add(k, d, at);
  }
  F.send = (kind, dir, u) => send(kind, dir, u);
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
    }
    t.mem = {};
    if (t.k == null) t.k = edgeHere(t);
    // (made in sight: it comes in out of the haze; else it is simply there)
    if (inSight) { t.fade = 0; t.fadeTo = 1; t.fadeRate = 1 / ROADFOLK.fade.in; } else { t.fade = 1; t.fadeTo = 1; }
    fadeAll(roots(t), t.fade, t.mem, [personOf(t)]);
    t.hw.reset();
    return true;
  }
  function unmake(t) {
    if (!t.made) return;
    unfade(t.mem); t.mem = null;
    if (t.kind === 'rider') t.made.dispose();
    else { t.made.root.removeFromParent(); t.made.dispose(); }
    t.made = null; t.fade = 1; t.fadeTo = 1;
  }
  // put away: in sight, it dissolves first (then `then`: 'away' unmade, 'gone' taken off the road)
  function fadeOut(t, rate, then) { t.fadeTo = 0; t.fadeRate = 1 / rate; t.then = then; }

  // ── RIDING OUT: a few already on the road ──────────────────────────────────────────────────────────────────────
  let seeded = false;
  function seed(at) {
    seeded = true;
    here.copy(at);
    const n = Math.round(most * ROADFOLK.seed);
    for (const s of seedSpots(n, { L, dist: (u) => { spot(u, 1, 0, _g); return Math.hypot(_g.x - at.x, _g.z - at.z); } })) add(pickKind(Math.random, W.night || 0), s.dir, s.u);
  }

  // ── EACH FRAME ─────────────────────────────────────────────────────────────────────────────────────────────────
  const _a = new THREE.Vector3(), _q = new THREE.Vector3();
  const posOf = (q) => (q.isVector3 ? q : q.position || q);
  // the speed it may go this frame (and why it holds back)
  function wanted(t, list, held, dt) {
    const kind = t.kind, la = ROADFOLK.look[kind], wide = ROADFOLK.wide[kind];
    let v = t.speed; t.why = '';
    if (t.waveT > 0) { t.why = 'saying hello'; return 0; }
    // a wagon held up by a gang ahead: it waits short of it (either way)
    for (const h of held) { const e = (h.u - t.u) * t.dir; if (e > 0 && e < AMBUSH.hold) { t.why = 'waiting: a hold-up'; return 0; } }
    // someone slower going the same way just ahead: behind them at their pace (a rider steps round a walker)
    for (const o of F.list) {
      if (o === t || o.dir !== t.dir || o.gone) continue;
      const e = (o.u - t.u) * t.dir;
      if (e <= 0 || e > la + 2.5) continue;
      if (Math.abs((o.k ?? 0) - (t.k ?? 0)) > 0.9) continue;
      if (t.kind === 'rider' && o.kind === 'walker' && t.made && !t.passing && passClear(t)) { t.passing = o; t.shift = -ROADFOLK.pass; t.shiftLeft = Infinity; continue; }
      if (t.passing === o) continue;
      v = Math.min(v, e < 1.8 ? 0 : o.pace); t.why = 'behind someone slower';
    }
    if (t.passing && ((t.passing.u - t.u) * t.dir < -3 || t.passing.gone || !F.list.includes(t.passing))) { t.passing = null; t.shiftLeft = 4; }
    if (!t.made) return v;
    // the player, the horse, the dog ...: stop short (then step round them); a wagon in the way: wait for it
    let block = Infinity, by = null;
    for (const q of list) {
      const p = posOf(q); if (p.x === undefined) continue;
      if (Math.abs(p.x - t.pos.x) > la + 3 || Math.abs(p.z - t.pos.z) > la + 3) continue;
      for (let d = 0.4; d <= la + 0.01; d += 0.7) { spot(t.u + t.dir * d, t.dir, t.k, _a); if (Math.hypot(p.x - _a.x, p.z - _a.z) < wide) { if (d < block) { block = d; by = p; } break; } }
    }
    for (let d = 0.8; d <= la + 0.01; d += 0.9) { spot(t.u + t.dir * d, t.dir, t.k, _a); const G = wagonAt(_a.x, _a.z, 0.35); if (G) { block = Math.min(block, d); t.why = 'waiting for a wagon'; break; } }
    if (block < Infinity) {
      v = Math.min(v, block < 1.0 ? 0 : (block - 1.0) * 1.2);
      if (by) { t.why = 'stopped for someone'; if (v < 0.05) stepRound(t, by, dt); }
    } else t.stopT = 0;
    return v;
  }
  // a rider can step in to pass: the ground clear there and no wagon in the way
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

  F.update = (dt, at) => {
    if (disposed || !at) return;
    here.copy(at);
    if (!seeded) seed(at);
    lookNow();
    // a new one now and then
    if ((timer -= dt) <= 0) { timer = rnd(...ROADFOLK.every); if (!F.hold && F.list.length < most) send(); }
    // which are made: the nearest few within `show` (one made a frame: making one is the costly part)
    let made = 0, next = null, far = null;
    for (const t of F.list) {
      t.dist = Math.hypot(t.pos.x - at.x, t.pos.z - at.z);
      if (t.made) {
        made++;
        if (t.dist > hide && t.fadeTo > 0) { if (seen(t.pos.x, t.pos.z)) fadeOut(t, ROADFOLK.fade.out, 'away'); else unmake(t); }
        else if (t.fadeTo > 0 && (!far || t.dist > far.dist)) far = t;
      } else if (!t.gone && !t.ending && t.dist < show && (t.kind === 'walker' || F.kit) && (!next || t.dist < next.dist)) next = t;
    }
    if (next && made >= madeMost && far && far.dist > next.dist + 20) { if (seen(far.pos.x, far.pos.z)) fadeOut(far, ROADFOLK.fade.out, 'away'); else { unmake(far); made--; } }
    if (next && made < madeMost) make(next, seen(next.pos.x, next.pos.z));
    // on their way
    const list = things() || [], held = [];
    for (const w of wagons() || []) if (w.held && w.wg) held.push(w);
    for (let i = F.list.length - 1; i >= 0; i--) {
      const t = F.list[i];
      step(t, dt, list, held, at);
      if (t.gone) { unmake(t); F.list.splice(i, 1); }
    }
  };
  const _m = new THREE.Vector3();
  function step(t, dt, list, held, at) {
    // the edge it keeps to here, and any step aside (passing a walker, round the player) easing back to it
    const edge = t.made ? edgeHere(t) : edgeOf(t.kind, laneAt(t.u, t.dir));
    if (t.k == null) t.k = edge;
    const v = wanted(t, list, held, dt);
    const acc = ROADFOLK.accel[t.kind], brk = ROADFOLK.brake[t.kind];
    t.pace = t.pace < v ? Math.min(v, t.pace + acc * dt) : Math.max(v, t.pace - brk * dt);
    t.u += t.dir * t.pace * dt;
    if (t.shiftLeft < Infinity && t.shift) { t.shiftLeft -= t.pace * dt; if (t.shiftLeft <= 0) t.shift = 0; }
    const want = Math.max(ROADFOLK.least, edge + t.shift);
    t.k += Math.max(-0.9 * dt, Math.min(0.9 * dt, want - t.k));
    // the road's end: gone (dissolving into the haze if the player is right there watching)
    if (!t.ending && (t.u < -2 || t.u > L + 2)) {
      if (t.made && t.dist < show && seen(t.pos.x, t.pos.z)) { t.ending = true; fadeOut(t, ROADFOLK.fade.end, 'gone'); }
      else { t.gone = true; return; }
    }
    spot(t.u, t.dir, t.k, _m);
    // facing the way it goes (and a little across while it steps aside)
    const mx = _m.x - t.pos.x, mz = _m.z - t.pos.z;
    let face = t.h;
    if (mx * mx + mz * mz > 1e-6) face = Math.atan2(mx, mz);
    else { spot(t.u + t.dir, t.dir, t.k, _a); face = Math.atan2(_a.x - _m.x, _a.z - _m.z); }
    const turn = wrapA(face - t.h), most = ROADFOLK.turn * dt;
    const yaw = Math.max(-most, Math.min(most, turn));
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
    n: F.list.length, made: F.list.filter((t) => t.made).length, most, madeMost, show, kit: !!F.kit,
    list: F.list.map((t) => ({ id: t.id, kind: t.kind, dir: t.dir, u: +t.u.toFixed(1), pace: +t.pace.toFixed(2), k: t.k == null ? null : +t.k.toFixed(2),
      made: !!t.made, why: t.why, dist: Number.isFinite(t.dist) ? +t.dist.toFixed(1) : null, fade: +t.fade.toFixed(2), x: +t.pos.x.toFixed(1), z: +t.pos.z.toFixed(1), ending: t.ending })),
  });
  F.dispose = () => {
    disposed = true;
    for (const t of F.list) unmake(t);
    F.list.length = 0;
  };
  return F;
}
