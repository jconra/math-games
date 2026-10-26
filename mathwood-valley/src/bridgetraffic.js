// THE CROSSING ROAD: now and then a traveller goes over the western river on the road south-west of town (the land's
// paths landpath10 and landpath8, which meet at the ravine where the bridge job is: src/bridgejob.js): a rider, a walker,
// or a wagon with its team. Each one crosses ON THE BRIDGE when the bridge standing there carries it (the job says:
// J.uses(kind): horse and rider for the walkers and the riders, the covered wagon for the wagons), and otherwise goes
// round by the ford beside it (landforms.js FORD: down the sunken lane, through the shallow water and up the far side).
// The bridge's deck is the ground there while it is used (bridgejob.js answers W.heightAt), so a wagon's wheels and a
// horse's hooves roll over its planks.
// They cost nothing far away: one sets off only while the player is within CROSSING.near metres of the ravine, at an
// end of the road out of the player's way, dissolving in there (src/wagon.js fadeAll) and dissolving out at the other
// end; one or two at a time. They stop for the player, the horse and the dog standing in their way, and go on once
// it is clear.
//
//   const X = makeCrossingTraffic({ W, folk, job, traffic, obstacles, camera })
//     job: the bridge job (J.uses(kind)); traffic: src/traffic.js's (its wagons' models T.lib, its riders' kit
//     T.folk.kit, loaded once a ride); obstacles(): what to stop for (Vector3s or objects with a .position)
//   X.update(dt, at)    each frame while riding (at: the player's position)
//   X.send(kind, from)  (dev and rigs) one now: kind 'rider' | 'walker' | 'wagon', from 'north' | 'south'
//   X.hold = true       no new ones set off (rigs)
//   X.off(way)          every traveller on that way ('bridge' | 'ford') put away (held still, dissolving where it stands)
//   X.list, X.state(), X.dispose()
//   (the two ways across, as [x, z] points north to south: src/bridgeplan.js ROUTES)
import * as THREE from 'three';
import { makePerson } from './actors/folk.js';
import { makeRider } from './actors/riders.js';
import { makeWagon, fadeAll, unfade } from './wagon.js';
import { TRAVELLER_LOOKS } from './roadfolkplan.js';
import { ROUTES } from './bridgeplan.js';

export const CROSSING = {
  near: 150,                // m from the ravine: travellers come and go only while the player is this near
  every: [22, 50],          // s between one setting off and the next
  most: 2,                  // at once
  kinds: [['rider', 0.45], ['walker', 0.3], ['wagon', 0.25]],
  pace: { rider: 2.4, walker: 1.3, wagon: 1.8 },   // m/s
  fade: 1.4,                // s dissolving in at one end and out at the other
  vanish: 0.6,              // s one put away where it stands dissolves (the bridge, as the builder opens)
  clear: 26,                // m: an end this near the player isn't where one appears (it would pop up beside them)
  stop: { gap: 2.4, wide: 1.4, wait: 0.8 },   // m ahead it stops for something in its way, m either side, s clear before going on
  edge: { rider: 0.55, walker: 0.75, wagon: 0 },   // m right of the road's middle it keeps to (on the bridge: half of it)
};
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (l) => l[Math.floor(Math.random() * l.length)];
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function makeCrossingTraffic({ W, folk, job, traffic = null, obstacles = () => [], camera = null, scene = W.scene }) {
  const X = { list: [] };
  const shadows = !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  const mid = { x: -339.2, z: -42.25 };
  // the routes as flat curves (x, z: the ground's height is asked as they go, so the deck counts once it is used)
  const curves = {};
  for (const [k, pts] of Object.entries(ROUTES)) { const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal'); c.arcLengthDivisions = 400; curves[k] = { c, L: c.getLength() }; }
  // a wagon's path: the same curve on the ground (src/wagon.js setPath asks the world's height itself)
  const groundCurve = (k) => {
    const base = curves[k].c;
    return { getPointAt: (t, out = new THREE.Vector3()) => { base.getPointAt(t, out); out.y = W.heightAt(out.x, out.z); return out; },
      getTangentAt: (t, out) => base.getTangentAt(t, out), getLength: () => curves[k].L };
  };
  let timer = rnd(4, 10), seq = 0;
  const _p = new THREE.Vector3(), _t = new THREE.Vector3();

  function send(kind, from = Math.random() < 0.5 ? 'north' : 'south') {
    const onBridge = !!(job && job.uses && job.uses(kind));
    const way = onBridge ? 'bridge' : 'ford', dir = from === 'north' ? 1 : -1, L = curves[way].L;
    const t = { id: ++seq, kind, way, dir, u: dir > 0 ? 0 : L, L, pace: CROSSING.pace[kind] * rnd(0.9, 1.1), speed: 0, fade: 0, made: null, mem: {}, clear: 0, ending: false, gone: false };
    try {
      if (kind === 'rider') {
        const kit = traffic && traffic.folk && traffic.folk.kit; if (!kit) return null;
        t.made = makeRider(kit, { W, folk, scene, shadows });
      } else if (kind === 'wagon') {
        const lib = traffic && traffic.lib; if (!lib) return null;
        const wkind = pick(['covered', 'farm', 'freight']);
        if (!lib.kinds || !lib.kinds[wkind]) { if (lib.need) lib.need(wkind).catch(() => null); return null; }
        const wg = makeWagon(lib, { kind: wkind, W, team: true, driver: true, shadows });
        wg.setPath(groundCurve(way), { at: dir > 0 ? 3 / L : 1 - 3 / L, dir }); wg.speed = 0; wg.lane = 0;
        scene.add(wg.root); t.made = wg; t.u = wg.u;
      } else {
        const look = { outfit: pick(TRAVELLER_LOOKS.outfits), palette: pick(TRAVELLER_LOOKS.palettes), skin: Math.floor(Math.random() * 8), hair: Math.floor(Math.random() * 11), hat: true };
        const p = makePerson(folk, { ...look, shadows }); p.play('Walk', { fade: 0 }); scene.add(p.root); t.made = p;
      }
    } catch (e) { console.warn('crossing road: a traveller could not be made', e); return null; }
    place(t, 0);
    see(t, 0);
    X.list.push(t);
    return t;
  }
  X.send = send;
  const roots = (t) => (t.kind === 'rider' ? [t.made.horse.root, t.made.person.root] : t.kind === 'wagon' ? [t.made.root] : [t.made.root]);
  const people = (t) => (t.kind === 'rider' ? [t.made.person] : t.kind === 'walker' ? [t.made] : (t.made.driver ? [t.made.driver] : []));
  // where it is: u metres along its way, `edge` to its right (half as far out on the bridge's deck)
  function spot(t, out) {
    const C = curves[t.way], f = Math.min(1, Math.max(0, t.u / C.L));
    C.c.getPointAt(f, out); C.c.getTangentAt(f, _t);
    const onDeck = job && job.onDeck && job.onDeck(out.x, out.z), k = CROSSING.edge[t.kind] * (onDeck ? 0.5 : 1) * t.dir;
    out.x += -_t.z * k; out.z += _t.x * k;
    return Math.atan2(_t.x * t.dir, _t.z * t.dir);
  }
  // how solid it is: 0 gone .. 1 (a wagon fades itself, its team and its driver)
  function see(t, f) { t.fade = f; if (t.kind === 'wagon') t.made.fade(f); else fadeAll(roots(t), f, t.mem, people(t)); }
  function place(t, dt) {
    if (t.kind === 'wagon') { t.made.update(dt); return; }
    const h = spot(t, _p);
    if (t.kind === 'rider') { const r = t.made; r.x = _p.x; r.z = _p.z; r.heading = t.h === undefined ? h : (t.h = wrapA(t.h + Math.max(-2 * dt, Math.min(2 * dt, wrapA(h - t.h))))); if (t.h === undefined) t.h = h; r.speed = t.speed; r.update(dt); return; }
    const p = t.made;
    p.root.position.set(_p.x, W.heightAt(_p.x, _p.z), _p.z);
    t.h = t.h === undefined ? h : wrapA(t.h + Math.max(-3 * dt, Math.min(3 * dt, wrapA(h - t.h)))); p.root.rotation.set(0, t.h, 0);
    const stride = (p.stride && p.stride.Walk) || 1.4;
    if (t.speed > 0.1) { if (t.clip !== 'Walk') { p.play('Walk', { fade: 0.3 }); t.clip = 'Walk'; } if (p.person && p.person.cur) p.person.cur.setEffectiveTimeScale(Math.max(0.3, t.speed / stride)); }
    else if (t.clip !== 'Idle') { p.play('Idle', { fade: 0.3 }); t.clip = 'Idle'; }
    p.update(dt);
  }
  function unmake(t) {
    if (t.kind !== 'wagon') unfade(t.mem);
    try { if (t.kind === 'walker') { t.made.root.removeFromParent(); t.made.dispose(); } else t.made.dispose(); } catch (e) { /* gone */ }
    if (t.kind === 'wagon') t.made.root.removeFromParent();
    t.made = null; t.gone = true;
  }
  // something standing in its way, close ahead: the player, the horse, the dog
  const _a = new THREE.Vector3();
  function blockedAhead(t) {
    const h = t.kind === 'wagon' ? t.made.heading : (t.h || 0), at = t.kind === 'wagon' ? t.made.front : spot(t, _a) !== null && _a;
    const fx = Math.sin(h), fz = Math.cos(h);
    for (const o of obstacles()) {
      const p = o && (o.position || o); if (!p || !Number.isFinite(p.x)) continue;
      const dx = p.x - at.x, dz = p.z - at.z, along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (along > -0.3 && along < CROSSING.stop.gap + (t.kind === 'wagon' ? 0.5 : 0) && side < CROSSING.stop.wide) return true;
    }
    return false;
  }

  X.update = (dt, at) => {
    const near = at && Math.hypot(at.x - mid.x, at.z - mid.z) < CROSSING.near;
    // setting off: now and then, at an end of the road away from the player
    if (near && !X.hold && (timer -= dt) <= 0) {
      timer = rnd(...CROSSING.every);
      if (X.list.length < CROSSING.most) {
        let r = Math.random(), kind = 'walker'; for (const [k, p] of CROSSING.kinds) { if ((r -= p) <= 0) { kind = k; break; } }
        const ends = ['north', 'south'].filter((e) => { const q = e === 'north' ? ROUTES.ford[0] : ROUTES.ford[ROUTES.ford.length - 1]; return Math.hypot(q[0] - at.x, q[1] - at.z) > CROSSING.clear; });
        if (ends.length) send(kind, pick(ends));
      }
    }
    for (const t of X.list) {
      if (!t.made) continue;
      // away from the player now: gone at once (out of sight that far off)
      if (!near && Math.hypot(at.x - mid.x, at.z - mid.z) > CROSSING.near + 40) { unmake(t); continue; }
      // put away where it stands (X.off): held still there, dissolving (never moved again: the ground under it may
      // no longer be the deck)
      if (t.vanish) { if (t.kind === 'wagon') t.made.speed = 0; see(t, Math.max(0, t.fade - dt / CROSSING.vanish)); if (t.fade <= 0) unmake(t); continue; }
      const stop = blockedAhead(t);
      t.clear = stop ? 0 : t.clear + dt;
      const want = t.ending ? t.pace : stop || t.clear < CROSSING.stop.wait ? 0 : t.pace;
      if (t.kind === 'wagon') { const wg = t.made; wg.speed = want; place(t, dt); t.u = wg.u; t.speed = wg.pace; }
      else { t.speed += Math.max(-2.5 * dt, Math.min(0.9 * dt, want - t.speed)); t.u += t.dir * t.speed * dt; place(t, dt); }
      // dissolving in at the start, out at the far end (a wagon's team is ahead of it: it is out before its middle ends)
      const end = t.kind === 'wagon' ? 6 : 0, left = (t.dir > 0 ? t.L - t.u : t.u) - end;
      if (left < t.pace * CROSSING.fade) t.ending = true;
      const f = t.ending ? Math.max(0, left / (t.pace * CROSSING.fade)) : Math.min(1, t.fade + dt / CROSSING.fade);
      if (f !== t.fade) see(t, f);
      if (t.ending && (left <= 0.05 || (t.kind === 'wagon' && t.made.ended))) unmake(t);
    }
    X.list = X.list.filter((t) => !t.gone);
  };
  X.state = () => ({ list: X.list.map((t) => ({ id: t.id, kind: t.kind, way: t.way, dir: t.dir, u: +t.u.toFixed(1), L: +t.L.toFixed(1), speed: +t.speed.toFixed(2), fade: +t.fade.toFixed(2),
    at: t.made ? (t.kind === 'wagon' ? { x: +t.made.pos.x.toFixed(2), y: +t.made.pos.y.toFixed(2), z: +t.made.pos.z.toFixed(2) } : t.kind === 'rider' ? { x: +t.made.x.toFixed(2), y: +t.made.horse.root.position.y.toFixed(2), z: +t.made.z.toFixed(2) } : { x: +t.made.root.position.x.toFixed(2), y: +t.made.root.position.y.toFixed(2), z: +t.made.root.position.z.toFixed(2) }) : null })), timer });
  // every traveller going one way (the bridge, while the builder is up: it isn't walked on then) put away: each held
  // still where it stands and dissolving there (nothing vanishes in view)
  X.off = (way) => { for (const t of X.list) if (t.way === way && t.made) t.vanish = true; };
  X.dispose = () => { for (const t of X.list) if (t.made) unmake(t); X.list = []; };
  return X;
}
