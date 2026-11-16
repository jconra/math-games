// THE PEOPLE in the station, going about their day (life.js: who they are and what they do), each built with the crew
// kit from its recipe, drawn only while the room they are in is drawn and they are in front of the camera.
//
//   const people = await makePeople({ W, walls, lib, jobs, boarding, crane, say })
//   people.update(dt, { player, camera })   everyone's day goes on; whoever is drawn moves; eyes follow a player who is near
//   people.list    [{ id, name, c, pos, heading, walking, ... }]    people.missing  the spots the station has no name for
//   people.eyes()  where the people on the move are (the station's doors open for them; the crane stops for them)
//   people.onWays(out)  pushes anyone standing on a parked ship's way in (it waits for them; people never call a ship's
//                  way down: they do not board yet)
//   people.noGo(x, z)   a patch of floor no person goes onto (job spots, ships' ways in, under the crane, the scanner)
//   people.flee(x, z, r)  anyone within r of a point hurries off (the crane by hand, a load low over them)
//   people.alarms  the loud alarms, counted as they happen: stuck (over 3 s with a way to go), inWall, inPerson, onPatch
//   people.plan()  everyone's spots and ways, for the plan from above (the rigs)
//   people.add(recipe, spot, heading) / people.remove(P)   one more person standing (the cost test)
//   resolve(W, walls, at) -> { pos, heading } | null                where a spot in spots.js is, by the station's names
//
// HOW THEY GET ABOUT
// - A way is worked out a little at a time (walls.plan: LIFE.planMs a frame for everyone together, taking turns, at most
//   LIFE.planMost of work for one way), never across a patch they keep off (noGo: a quarter-metre map of the floor) nor
//   within LIFE.keepFrom of anyone standing or sitting still; while it is worked out they stay as they were.
// - Walking, they keep clear of each other and of the player: someone ahead in their lane is passed on the side away
//   from them (head on, each to their own right); they never step to within LIFE.body of anyone. Held up by someone
//   standing still or by a corner, the way is worked out again round them at once; by someone standing where they were
//   going, somewhere else instead; two walkers holding each other up: the one later in the roster makes way (a step
//   aside or back, a wait till the other has gone by). Held LIFE.giveUp seconds in all, the errand is given up.
// - Out of sight (their room not drawn, behind the camera, or past the nearest LIFE.drawn[quality]) their body is out
//   of the scene altogether and their day goes on six frames at a time. In sight, their clips are played every frame
//   near, every other frame or every fourth further off, and their eyes are drawn only close up.
import * as THREE from 'three';
import { makeCrew } from '../kit/crew.js';
import { expand, zonesOf, setDoors } from '../kit/layout.js';
import { PIECES } from '../kit/catalog.js';
import { placeMatrix, WALL_FACE } from '../kit/grid.js';
import { CROWD, SPOTS, TALKS, APART, SEATS, CLIPS, ROSTER } from './life.js';
import { STAND, shine } from './player.js';

const SEEN = 46;        // people further than this from the camera are not drawn (m)
// how they walk: m/s (each their own within it), the turn (radians a second), how close to anyone they ever come (m,
// middle to middle), who counts as in their lane ahead (m ahead, m to the side), how long a wait before stepping aside,
// working the way out again, and giving up (s); how long a planned way may take each frame, for everyone (ms)
export const LIFE = {
  speed: [1.05, 1.35], turn: 3, body: 0.6, keepFrom: 0.75, lane: [2.0, 0.75], sidestep: 1.0, replan: 2.0, stillWait: 0.8, replanEvery: 1.5, giveUp: 7,
  planMs: 2.5, planMost: 250, sit: 0.7, room: 0.75,     // (room: no two spots anyone has are nearer than this, m)
  near: 12, mid: 24,    // m from the camera: clips played every frame nearer, every other frame to `mid`, every fourth beyond
  drawn: { low: 8, medium: 12, high: 20 },   // the most drawn at once, the nearest (?drawn=N for the cost rigs)
  eyes: 7,              // m from the camera beyond which the eyes are not drawn
  stuck: 3,             // s with a way to go and nothing gained: a loud alarm (counted)
};
// the patches nobody stands on or walks across: a job spot's ring (its middle, m), a parked ship's way in (its patch of
// floor when down, m wider), under the crane's loads (each patch it works over, m wider: its own margin and more), the
// big scanner's rails (its box, m wider)
export const KEEP_OFF = { job: 0.8, way: 0.6, crane: 1.3, glide: 0.4, margin: 0.3 };

const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (L) => L[Math.floor(Math.random() * L.length)];

// ── where a spot is, by name ───────────────────────────────────────────────────────────────────────────────────
// every placed piece in the station, once: { piece, variant, room (id), M (its world placement) }
function piecesOf(R) {
  const out = [], m = new THREE.Matrix4();
  for (const zd of zonesOf(R)) for (const pl of expand(zd.pieces || [])) {
    const def = PIECES[pl.piece]; if (!def) continue;
    const off = [...(pl.off || [0, 0, 0])]; if (def.at === 'wall') off[2] += WALL_FACE;
    out.push({ piece: pl.piece, variant: pl.variant, room: zd.id, M: placeMatrix({ ...pl, off }, m, zd.grid || R.grid || null).clone() });
  }
  return out;
}
const roomMatch = (W, want) => {
  const zones = W.built.zones.filter((z) => !z.with);
  if (typeof want === 'string') return zones.find((z) => z.id === want) || null;
  return zones.find((z) => want.test(z.id) || want.test(z.name || '')) || null;
};
// (a named place: [x, y, z], the n-th of a list of them, or one inside another by a dotted name: 'ships.medic.at')
const placeAt = (W, name, n = null) => { let p = String(name).split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), W.R.places); if (n != null && Array.isArray(p) && Array.isArray(p[n])) p = p[n]; return Array.isArray(p) && p.length === 3 && typeof p[0] === 'number' ? new THREE.Vector3(...p) : null; };
// a spot's point and the way it faces (before it is moved to where a person can stand): every match when all is asked
function roughAll(W, pieces, at) {
  if (at.spawn) {
    const s = W.R.spawn; if (!s || !s.at) return [];
    const p = new THREE.Vector3(...s.at), l = s.look ? new THREE.Vector3(...s.look) : null;
    // (the spawn is where the eyes are: the floor is about 1.6 m below)
    return [{ p: p.setY(p.y - 1.6), heading: l ? Math.atan2(l.x - s.at[0], l.z - s.at[2]) : 0 }];
  }
  if (at.place) { const p = placeAt(W, at.place, at.n); return p ? [{ p, heading: null }] : []; }
  if (at.room && !at.piece) {
    const z = roomMatch(W, at.room); if (!z) return [];
    const B = z.box, f = at.at || [0.5, 0.5];
    const p = new THREE.Vector3(B.min.x + (B.max.x - B.min.x) * f[0], B.min.y, B.min.z + (B.max.z - B.min.z) * f[1]);
    return [{ p, heading: at.face ? Math.atan2(at.face[0], at.face[1]) : null }];
  }
  if (at.piece) {
    const found = pieces.filter((x) => x.piece === at.piece && (!at.variant || x.variant === at.variant) && (!at.room || x.room === at.room));
    return (at.all ? found : found.slice(0, 1)).map((pc) => {
      const p = new THREE.Vector3(...(at.local || [0, 0, 0])).applyMatrix4(pc.M);
      let heading = null;
      if (at.face) { const d = new THREE.Vector3(at.face[0], 0, at.face[1]).transformDirection(pc.M); heading = Math.atan2(d.x, d.z); }
      return { p, heading, pc };
    });
  }
  return [];
}
const rough = (W, pieces, at) => roughAll(W, pieces, at)[0] || null;
function place(W, walls, at, r, pieces) {
  let heading = r.heading;
  if (at.toward) {
    const t = rough(W, pieces, at.toward);
    if (t) {
      const dx = t.p.x - r.p.x, dz = t.p.z - r.p.z, L = Math.hypot(dx, dz) || 1;
      if (at.out) { r.p.x += dx / L * at.out; r.p.z += dz / L * at.out; }
      heading = Math.atan2(dx, dz);
    }
  }
  const pos = walls.snap(r.p.x, r.p.y + 0.35, r.p.z, 3);
  if (!pos) return null;
  return { pos, heading };
}
export function resolve(W, walls, at, pieces = piecesOf(W.R)) {
  const r = rough(W, pieces, at); if (!r) return null;
  return place(W, walls, at, r, pieces);
}

// ── the people ─────────────────────────────────────────────────────────────────────────────────────────────────
// a soft dark patch under each person's feet (the station draws no shadows)
const SHADE = (() => {
  const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d'), grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.5)'); grad.addColorStop(0.55, 'rgba(0,0,0,0.28)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  return { geo: new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), mat: new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }) };
})();
export function shadeUnder(root) { const m = new THREE.Mesh(SHADE.geo, SHADE.mat); m.position.y = 0.012; m.renderOrder = -1; root.add(m); return m; }

export async function makePeople({ W, walls, lib, jobs = null, boarding = null, crane = null, say = () => {} }) {
  const pieces = piecesOf(W.R), list = [], missing = [];
  const recipeOf = (r) => (typeof r === 'string' ? (lib.list.recipes || {})[r] : r);
  const alarms = { stuck: 0, inWall: 0, inPerson: 0, onPatch: 0, planFailed: 0, gaveUp: 0, seen: {} };
  const alarm = (k, P, words) => { alarms[k]++; if (!alarms.seen[k + P.id]) { alarms.seen[k + P.id] = 1; console.warn('people: ' + k + ': ' + P.id + ' ' + words); } };

  // ── the patches kept off ─────────────────────────────────────────────────────────────────────────────────────
  // (a map of the station's floor, a quarter metre a square: 1 where nobody goes)
  const zs = W.built.zones.filter((z) => !z.with), X0 = Math.floor(Math.min(...zs.map((z) => z.box.min.x)) - 2), Z0 = Math.floor(Math.min(...zs.map((z) => z.box.min.z)) - 2);
  const NX = Math.ceil((Math.max(...zs.map((z) => z.box.max.x)) + 2 - X0) / 0.25), NZ = Math.ceil((Math.max(...zs.map((z) => z.box.max.z)) + 2 - Z0) / 0.25);
  // (2: the patch itself; 1: a margin round it, KEEP_OFF.margin, that a way being worked out keeps off too, so a walker
  // stepping round someone on a way along its edge is still off the patch)
  const keepOff = new Uint8Array(NX * NZ), patches = [];
  const set = (i, k, v) => { const j = k * NX + i; if (keepOff[j] < v) keepOff[j] = v; };
  const mark = (x0, z0, x1, z1, why) => {
    patches.push({ x0, z0, x1, z1, why });
    for (const [m, v] of [[KEEP_OFF.margin, 1], [0, 2]]) for (let i = Math.max(0, Math.floor((x0 - m - X0) / 0.25)); i <= Math.min(NX - 1, Math.floor((x1 + m - X0) / 0.25)); i++) for (let k = Math.max(0, Math.floor((z0 - m - Z0) / 0.25)); k <= Math.min(NZ - 1, Math.floor((z1 + m - Z0) / 0.25)); k++) set(i, k, v);
  };
  const markDisc = (x, z, r, why) => {
    patches.push({ x, z, r, why });
    for (const [m, v] of [[KEEP_OFF.margin, 1], [0, 2]]) for (let i = Math.max(0, Math.floor((x - r - m - X0) / 0.25)); i <= Math.min(NX - 1, Math.floor((x + r + m - X0) / 0.25)); i++) for (let k = Math.max(0, Math.floor((z - r - m - Z0) / 0.25)); k <= Math.min(NZ - 1, Math.floor((z + r + m - Z0) / 0.25)); k++) {
      const cx = X0 + (i + 0.5) * 0.25, cz = Z0 + (k + 0.5) * 0.25; if (Math.hypot(cx - x, cz - z) < r + m + 0.18) set(i, k, v);
    }
  };
  const level = (x, z) => { const i = Math.floor((x - X0) / 0.25), k = Math.floor((z - Z0) / 0.25); return i >= 0 && k >= 0 && i < NX && k < NZ ? keepOff[k * NX + i] : 0; };
  const noGo = (x, z) => level(x, z) >= 1;          // (for the ways and the spots: the patches and their margins)
  const onPatch = (x, z) => level(x, z) >= 2;       // (for walking and the alarms: the patches themselves)
  // job spots: their rings
  for (const s of jobs?.spots || []) markDisc(s.pos.x, s.pos.z, KEEP_OFF.job, 'job:' + s.job.id);
  // a parked ship's ways in: the patch each comes down on (its leaves' box when down, as boarding.js keeps clear)
  const wayFeet = [], _im = new THREE.Matrix4(), _b = new THREE.Box3(), ONE = [null];
  for (const s of boarding?.ships || []) for (const D of s.ways || []) {
    const t0 = D.t, box = new THREE.Box3();
    ONE[0] = D; setDoors(ONE, 1);
    for (const leaf of D.leaves) for (const im of leaf.meshes || []) { if (!im.geometry.boundingBox) im.geometry.computeBoundingBox(); im.getMatrixAt(leaf.index, _im); box.union(_b.copy(im.geometry.boundingBox).applyMatrix4(_im)); }
    ONE[0] = D; setDoors(ONE, t0);
    if (box.isEmpty()) continue;
    const w = KEEP_OFF.way; wayFeet.push({ D, box: box.clone() });
    mark(box.min.x - w, box.min.z - w, box.max.x + w, box.max.z + w, 'way:' + s.id);
  }
  // a ship's lift (the Miner's belly lift, boarding.js LIFTS): the floor under its platform, where it comes down (it
  // moves straight up and down, so its platform's box as it stands, across the floor)
  for (const s of boarding?.ships || []) for (const Lf of s.lifts || []) {
    const D = Lf.D; if (!D) continue;
    const box = new THREE.Box3(), any = new THREE.Box3();
    for (const leaf of D.leaves) for (const im of leaf.meshes || []) {
      if (!im.geometry.boundingBox) im.geometry.computeBoundingBox(); im.getMatrixAt(leaf.index, _im); _b.copy(im.geometry.boundingBox).applyMatrix4(_im);
      any.union(_b); if (/platform/.test(im.name)) box.union(_b);
    }
    const B = box.isEmpty() ? any : box; if (B.isEmpty()) continue;
    const w = KEEP_OFF.way; wayFeet.push({ D, box: B.clone() });
    mark(B.min.x - w, B.min.z - w, B.max.x + w, B.max.z + w, 'lift:' + s.id);
  }
  // under the crane: every patch it works over in a round
  if (crane?.on && crane.L) {
    const seen = new Set(), m = (crane.RULES?.margin ?? 0.9) + (KEEP_OFF.crane - 0.9);
    for (let t = 0; t < crane.L.length; t += 0.5) { const g = crane.L.gate(t, 0); if (!g) continue; const k = [g.x, g.z, g.hx, g.hz].join(); if (seen.has(k)) continue; seen.add(k); mark(g.x - g.hx - m, g.z - g.hz - m, g.x + g.hx + m, g.z + g.hz + m, 'crane'); }
  }
  // what glides by itself (the big scanner's ring)
  for (const D of W.built.glides || []) if (D.sweep && !D.sweep.isEmpty()) mark(D.sweep.min.x - KEEP_OFF.glide, D.sweep.min.z - KEEP_OFF.glide, D.sweep.max.x + KEEP_OFF.glide, D.sweep.max.z + KEEP_OFF.glide, 'scanner');

  // ── the spots ────────────────────────────────────────────────────────────────────────────────────────────────
  // (each group's spots, as people can stand there: snapped to the floor, off every patch kept off)
  const groups = {};
  // (room all round a person: the walls' own test feels a person at eight points round them, which a thin post can
  // stand between; here sixteen, and eight nearer in, at the three heights)
  const roomy = (p, r = 0.3) => {
    for (const h of [0.6, 1.0, 1.45]) for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      if (walls.solidAt(p.x + Math.cos(a) * r, p.y + h, p.z + Math.sin(a) * r)) return false;
      if (i % 2 === 0 && walls.solidAt(p.x + Math.cos(a) * r * 0.5, p.y + h, p.z + Math.sin(a) * r * 0.5)) return false;
    }
    return true;
  };
  // (a spot: on the floor, never on top of a crate; off every patch kept off; with room all round, except a post, a
  // spot placed by hand for one person, as a captain at the corner of a booth's counter)
  const posts = new Set(ROSTER.flatMap((d) => d.day.map((s) => (typeof s === 'string' ? s : s.do))).filter((s) => /^post:[^.]+\.\d+$/.test(s)).map((s) => s.slice(5).split('.')[0]));
  // (and room to walk away: a quarter-metre walk out from the spot, as a person walks, gets 2.5 m off; a spot in a
  // pocket between a table and a wall, that nobody who stood there could leave, is no spot)
  const _w = new THREE.Vector3();
  const walkOut = (p) => {
    const G = 0.25, seen = new Set([0]), q = [[p.x, p.y, p.z]];
    const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (q.length && seen.size < 600) {
      const [x, y, z] = q.shift();
      for (const [dx, dz] of D8) {
        _w.set(x, y, z); walls.move(_w, dx * G, dz * G, 0.26);
        if (Math.abs(_w.x - x - dx * G) > 0.02 || Math.abs(_w.z - z - dz * G) > 0.02) continue;
        const k = Math.round((_w.x - p.x) / G) * 1000 + Math.round((_w.z - p.z) / G); if (seen.has(k)) continue;
        seen.add(k);
        if (Math.hypot(_w.x - p.x, _w.z - p.z) >= 2.5) return true;
        q.push([_w.x, _w.y, _w.z]);
      }
    }
    return false;
  };
  const okSpot = (p, post = false) => p && p.y < 0.45 && !noGo(p.x, p.z) && (post || (roomy(p) && walkOut(p)));
  for (const [name, defs] of Object.entries(SPOTS)) {
    groups[name] = [];
    for (const at of defs) {
      const all = roughAll(W, pieces, at);
      // (a spot the station has not, or that nobody can stand on, is kept as a gap: a post's number stays its own)
      if (!all.length) { missing.push('spot ' + name); groups[name].push(null); continue; }
      for (const r of all) {
        const s = place(W, walls, at, r, pieces);
        if (!s || !okSpot(s.pos, posts.has(name))) { missing.push('spot ' + name + '.' + groups[name].length + (s ? (noGo(s.pos.x, s.pos.z) ? ' (on a patch kept off)' : s.pos.y >= 0.45 ? ' (not on the floor)' : ' (no room round it)') : ' (no floor)')); groups[name].push(null); continue; }
        if (s.heading == null) { const z = W.zoneAt(s.pos), c = z ? z.box.getCenter(new THREE.Vector3()) : null; s.heading = c ? Math.atan2(c.x - s.pos.x, c.z - s.pos.z) : 0; }
        groups[name].push({ name: name + '.' + groups[name].length, pos: s.pos, heading: s.heading, who: null, bad: 0 });
      }
    }
  }
  // the talking spots: two places each, face to face
  const talks = {};
  for (const [name, defs] of Object.entries(TALKS)) {
    talks[name] = [];
    for (const at of defs) {
      const r = rough(W, pieces, at); if (!r) { missing.push('talk ' + name); continue; }
      const hd = r.heading ?? 0, fx = Math.sin(hd) * APART / 2, fz = Math.cos(hd) * APART / 2, two = [];
      for (const sg of [-1, 1]) { const p = walls.snap(r.p.x + fx * sg, r.p.y + 0.35, r.p.z + fz * sg, 0.6); if (okSpot(p)) two.push(p); }
      if (two.length < 2 || two[0].distanceTo(two[1]) < APART * 0.7) { missing.push('talk ' + name + ' (no room)'); continue; }
      const T = { name: name + '.' + talks[name].length, at: two, who: [null, null], bad: 0 };
      talks[name].push(T);
    }
  }
  // the seats: a stool faces its nearest table; a bench seats two, facing its front
  const seats = {};
  const tables = pieces.filter((x) => x.piece === 'table').map((x) => new THREE.Vector3().applyMatrix4(x.M));
  for (const [name, defs] of Object.entries(SEATS)) {
    seats[name] = [];
    for (const d of defs) for (const pc of pieces.filter((x) => x.piece === d.piece && x.variant === d.variant && x.room === d.room)) {
      const o = new THREE.Vector3().applyMatrix4(pc.M), f = new THREE.Vector3(0, 0, 1).transformDirection(pc.M);
      const list2 = [];
      if (d.face === 'table') {
        const t = tables.reduce((b, q) => (!b || q.distanceTo(o) < b.distanceTo(o) ? q : b), null); if (!t) continue;
        const hd = Math.atan2(t.x - o.x, t.z - o.z); list2.push({ seat: o.clone(), heading: hd, back: new THREE.Vector3(-Math.sin(hd), 0, -Math.cos(hd)) });
      } else {
        const hd = Math.atan2(f.x, f.z), side = new THREE.Vector3(Math.cos(hd), 0, -Math.sin(hd));
        for (const k of d.two ? [-0.42, 0.42] : [0]) list2.push({ seat: o.clone().addScaledVector(side, k), heading: hd, back: f.clone().negate(), front: true });
      }
      for (const s of list2) {
        // where one stands to sit down: behind a stool (away from its table), in front of a bench
        const dir = s.front ? s.back.clone().negate() : s.back, out = s.front ? 0.5 : 0.55;
        const ap = walls.snap(s.seat.x + dir.x * out, s.seat.y + 0.35, s.seat.z + dir.z * out, 0.35);
        if (!ap || noGo(ap.x, ap.z) || !roomy(ap, 0.28) || !walkOut(ap)) { missing.push('seat ' + name + ' (no room beside it)'); continue; }
        seats[name].push({ name: name + '.' + seats[name].length, seat: s.seat, heading: s.heading, pos: ap, front: !!s.front, who: null, bad: 0 });
      }
    }
  }

  // ── the people themselves ────────────────────────────────────────────────────────────────────────────────────
  const firstClip = (c, clips) => [].concat(clips || STAND).find((n) => c.person.actions[n]) || 'Idle';
  async function body(def, pos, heading) {
    const recipe = recipeOf(def.look || def.recipe); if (!recipe) { missing.push(def.id + ': no recipe'); return null; }
    const c = await makeCrew(lib, recipe);
    const P = { id: def.id, name: def.name, c, pos: pos.clone(), drawnY: pos.y, heading, zone: null, shown: false, walking: false, clip: '', anim: 0, animDt: 0, sitY: 0 };
    c.root.position.copy(P.pos); c.root.rotation.set(0, heading, 0);
    shadeUnder(c.root); shine(c, W.envAt(P.pos));
    c.play(firstClip(c, STAND), { fade: 0 }); P.clip = STAND; c.update(0); c.update(Math.random() * 3);   // (each at its own moment of the clip)
    c.root.visible = false;     // (in the scene only while drawn: update() adds and takes it away)
    return P;
  }
  const play = (P, name, { fade = 0.35, speed = 1 } = {}) => {
    const n = P.c.person.actions[name] ? name : STAND;
    if (P.clip !== n) { P.c.play(n, { fade, speed }); P.clip = n; } else P.c.play(n, { speed });
  };

  // ── a day ────────────────────────────────────────────────────────────────────────────────────────────────────
  // (what a step of a day asks: its kind, its group, a spot of it nobody has, claimed)
  function parse(step) { const [kind, rest] = step.do.split(':'); const [group, n] = (rest || '').split('.'); return { kind, group, n: n == null ? null : +n }; }
  // (every spot someone has: a spot, a seat's place to stand and its seat, a talking spot's places)
  const taken = new Map();       // person -> [points]
  const crowded = (p, P) => { for (const [Q, pts] of taken) { if (Q === P) continue; for (const q of pts) if (Math.hypot(q.x - p.x, q.z - p.z) < LIFE.room) return true; } return false; };
  function claimFor(P, step) {
    const { kind, group, n } = parse(step);
    if (kind === 'sit') {
      const free = (seats[group] || []).filter((s) => !s.who && s.bad < 2 && !crowded(s.pos, P) && !crowded(s.seat, P));
      if (!free.length) return null;
      const s = pick(free); P.claim = s; s.who = P; taken.set(P, [s.pos, s.seat]); return { kind, step, spot: s };
    }
    if (kind === 'talk') {
      // (a talking spot with someone already on their way to talk there, near enough: to join them; else someone
      // standing about near by is asked over to an empty one, and both go; nobody near: no talk this time)
      const all = (talks[group] || []).filter((t) => t.bad < 2);
      const near = (t) => { const q = t.who[0] || t.who[1]; return q && q.pos && (!P.pos || q.pos.distanceTo(P.pos) < 40); };
      const waiting = all.filter((t) => ((t.who[0] && !t.who[1]) || (!t.who[0] && t.who[1])) && near(t) && !crowded(t.at[t.who[0] ? 1 : 0], P));
      if (waiting.length) { const T = pick(waiting); return talkAt(P, T, T.who[0] ? 1 : 0, step); }
      if (!P.pos) return null;
      const Q = list.filter((q) => q !== P && !q.hidden && q.act && (q.act.kind === 'stand' || q.act.kind === 'wait') && (q.act.phase === 'do' || q.act.kind === 'wait') && !q.walking && !q.req && q.pos.distanceTo(P.pos) < 30)
        .sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos))[0];
      if (!Q) return null;
      const free = all.filter((t) => !t.who[0] && !t.who[1] && !crowded(t.at[0], P) && !crowded(t.at[1], P) && !crowded(t.at[1], Q))
        .sort((a, b) => a.at[0].distanceTo(P.pos) + a.at[0].distanceTo(Q.pos) - b.at[0].distanceTo(P.pos) - b.at[0].distanceTo(Q.pos));
      const T = free[0]; if (!T) return null;
      release(Q); const q = talkAt(Q, T, 1, step); begin(Q, q); if (Q.req) { Q.req.dropped = true; Q.req = null; } Q.act.phase = 'go'; Q.act.delay = rnd(0.8, 2.2);
      return talkAt(P, T, 0, step);
    }
    if (kind === 'walk') {
      const L = (groups[group] || []).filter(Boolean); if (!L.length) return null;
      taken.delete(P);
      return { kind, step, spot: L[0], list: L, j: 0 };
    }
    // stand or post: a spot of the group (a post's own one, by its number)
    const L = groups[group] || [];
    const free = n != null ? (L[n] && (!L[n].who || L[n].who === P) ? [L[n]] : []) : L.filter((s) => s && !s.who && s.bad < 2 && !crowded(s.pos, P));
    if (!free.length) return null;
    const s = pick(free); P.claim = s; s.who = P; taken.set(P, [s.pos]); return { kind, step, spot: s };
  }
  function release(P) {
    const c = P.claim; taken.delete(P);
    if (!c) return;
    if (c.talk) { if (c.talk.who[c.i] === P) c.talk.who[c.i] = null; } else if (c.who === P) c.who = null;
    P.claim = null;
  }
  // (a claim made for someone before their body was: theirs now)
  function handOver(c, P0, P) {
    if (taken.has(P0)) { taken.set(P, taken.get(P0)); taken.delete(P0); }
    if (!c) return;
    if (c.talk) { if (c.talk.who[c.i] === P0) c.talk.who[c.i] = P; } else if (c.who === P0) c.who = P;
  }
  // the next thing in a person's day
  function next(P) {
    if (P.fleeing) { P.speed = P.fleeing.was; P.fleeing = null; }   // (run from the crane: back to their own pace)
    release(P); P.yielding = null; P.blocker = null; P.heldAll = 0; P.lastReplan = null; P.madeWayFor = false; P.jammed = false;
    for (let tries = 0; tries < P.day.length; tries++) {
      P.k = (P.k + 1) % P.day.length;
      const step = P.day[P.k];
      if (step.p != null && Math.random() > step.p) continue;
      const a = claimFor(P, step);
      if (a) { begin(P, a); return; }
    }
    // (nothing free: stand a little where they are, then try again)
    P.act = { kind: 'wait', until: rnd(4, 9), t: 0 }; P.walking = false;
  }
  // a thing to do: to its spot first (worked out a little at a time), unless already there
  function begin(P, a, placed = false) {
    const { step } = a, len = step.for ? rnd(step.for[0], step.for[1]) : a.kind === 'post' ? rnd(60, 120) : rnd(20, 40);
    P.act = { ...a, len, t: 0, phase: 'go', clip: CLIPS[step.clip] || null };
    // (placed there as they come aboard: at it at once; already there: turned to it, or sat down, as on arriving)
    if (placed) { arrive(P, true); return; }
    if (P.pos.distanceTo(a.spot.pos) < 0.2) { arrive(P); return; }
    route(P, a.spot.pos);
  }
  function route(P, to) {
    P.way = null; P.wi = 0; P.walking = false; P.held = 0; P.still = 0; P.yielding = null; P.blocker = null;
    P.req = walls.plan(P.pos, to, { avoid: avoidFor(P, to) });
    P.req.to = to.clone();
    planQ.push(P);
  }
  function arrive(P, placed = false) {
    const a = P.act; P.walking = false; P.way = null; P.req = null; P.yielding = null; P.blocker = null;
    if (a.kind === 'walk') {
      // (a patrol: on to the next spot of the round without stopping; the round done, the day goes on)
      a.j++; if (a.j >= a.list.length) { next(P); return; }
      a.spot = a.list[a.j]; route(P, a.spot.pos); return;
    }
    a.phase = a.kind === 'sit' ? 'sitting' : 'turn';
    a.t = 0; a.from = P.pos.clone();
    if (placed) {
      P.heading = a.spot.heading ?? P.heading;
      if (a.kind === 'sit') { P.pos.copy(a.spot.seat); a.phase = 'sat'; play(P, CLIPS.sit, { fade: 0 }); }
      else a.phase = 'do';
    }
  }

  // ── the ways being worked out: a little each frame for everyone together ─────────────────────────────────────
  const planQ = [];
  // (what a way keeps off: the patches, and anyone standing or sitting still, but never the spot it is going to)
  let stillV = 0, stillCells = new Map(), stillAt = -1;
  function stillMap() {
    if (stillAt === stillV) return stillCells;
    stillCells = new Map(); stillAt = stillV;
    for (const P of list) { if (P.walking || !P.act || P.act.phase === 'go') continue; const k = Math.floor(P.pos.x) * 4096 + Math.floor(P.pos.z); (stillCells.get(k) || stillCells.set(k, []).get(k)).push(P); }
    return stillCells;
  }
  function avoidFor(P, to) {
    return (x, z) => {
      if (noGo(x, z)) return true;
      if (Math.hypot(x - to.x, z - to.z) < 0.7) return false;
      const M = stillMap(), i = Math.floor(x), k = Math.floor(z);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const L = M.get((i + a) * 4096 + k + b); if (L) for (const Q of L) if (Q !== P && Math.hypot(Q.pos.x - x, Q.pos.z - z) < LIFE.keepFrom) return true; }
      return false;
    };
  }
  // (taking turns: each way being worked out gets a slice and goes to the back of the queue, so one long search never
  // holds up everyone else's; a way that has taken LIFE.planMost ms of work is given up: one that long goes nowhere)
  function planning() {
    const t = performance.now() + LIFE.planMs;
    let turns = planQ.length * 2;
    while (planQ.length && performance.now() < t && turns-- > 0) {
      const P = planQ.shift();
      if (!P.req || P.req.dropped) continue;
      if (!P.req.step(Math.max(0.3, Math.min(1, t - performance.now())))) {
        if (P.req.ms > LIFE.planMost) { P.req.done = true; P.req.way = null; } else { planQ.push(P); continue; }
      }
      const w = P.req.way, to = P.req.to; P.req = null;
      if (w && w.length >= 2 && w.short < 0.45) { P.way = w; P.wi = 1; P.walking = true; P.lastGain.copy(P.pos); P.gain = 0; stillV++; }
      else if (w && w.length >= 2 && w.short < 1.2) { w[w.length - 1] = to.clone(); P.way = w; P.wi = 1; P.walking = true; P.lastGain.copy(P.pos); P.gain = 0; stillV++; }
      else {
        alarms.planFailed++;
        if (P.act && P.act.spot) P.act.spot.bad = (P.act.spot.bad || 0) + 1;
        console.info('people: no way for ' + P.id + ' to ' + (P.act?.spot?.name || P.act?.kind) + (w ? ' (' + w.short + ' m short)' : ''));
        release(P); P.act = { kind: 'wait', until: rnd(2, 5), t: 0 }; P.walking = false;
      }
    }
  }

  // ── each frame ───────────────────────────────────────────────────────────────────────────────────────────────
  const others = [], near = new THREE.Vector3(), _f = new THREE.Frustum(), _pm = new THREE.Matrix4(), _s = new THREE.Sphere(new THREE.Vector3(), 1.15);
  let zoneClock = 0, frame = 0, playerNow = null;
  const seen = [];
  let drawnMost = 12;
  function update(dt, { player = null, camera }) {
    frame++; seen.length = 0;
    zoneClock -= dt;
    const findZones = zoneClock <= 0; if (findZones) zoneClock = 0.4;
    playerNow = player;
    planning();
    camera.updateMatrixWorld(); _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _f.setFromProjectionMatrix(_pm);
    for (const P of list) {
      const c = P.c;
      if (P.hidden) { P.shown = false; continue; }
      // the body out of sight: their day goes on a few times a second, nothing of the body is worked out
      const shown = P.shown;
      P.acc = (P.acc || 0) + dt;
      const every = shown ? 1 : 6;
      if ((frame + P.id.length) % every === 0) { think(P, P.acc); P.acc = 0; }
      if (findZones || !P.zone) { const z = W.zoneAt(P.pos); if (z && z !== P.zone) { if (P.zone) shine(c, W.envAt(P.pos)); P.zone = z; } }
      const far = camera.position.distanceTo(P.pos);
      _s.center.set(P.pos.x, P.pos.y + 0.95, P.pos.z);
      P.far = far;
      P.shown = !!(P.zone && P.zone.group.visible) && far < SEEN && _f.intersectsSphere(_s);
      if (P.shown) seen.push(P);
    }
    // the nearest of them drawn, at most DRAWN[quality] (a body out of the scene costs nothing at all: the scene's own
    // update walks every bone of every body in it, drawn or not)
    if (seen.length > drawnMost) { seen.sort((a, b) => a.far - b.far); for (let i = drawnMost; i < seen.length; i++) seen[i].shown = false; seen.length = drawnMost; }
    for (const P of list) {
      if (P.shown === !!P.inScene) continue;
      if (P.shown) { W.scene.add(P.c.root); P.fresh = true; } else W.scene.remove(P.c.root);
      P.inScene = P.shown; P.c.root.visible = P.shown;
    }
    for (const P of seen) {
      const c = P.c, far = P.far;
      // (the body eased up and down steps, a riser at a time; a sitter at the seat's height)
      P.drawnY = Math.abs(P.pos.y - P.drawnY) > 0.6 ? P.pos.y : damp(P.drawnY, P.pos.y, 14, dt);
      c.root.position.set(P.pos.x, P.drawnY + P.sitY, P.pos.z); c.root.rotation.set(0, P.heading, 0);
      // (the eyes and the clear layer over them, two draws each, too small to see past LIFE.eyes metres)
      const close = far < LIFE.eyes;
      if (P.close !== close) { P.close = close; for (const m of [c.meshes.eyes, c.meshes.cornea]) if (m) m.visible = close; }
      // the clips: every frame near, every other frame further, every fourth far off (what is skipped added on)
      P.animDt += dt;
      const step = far < LIFE.near ? 1 : far < LIFE.mid ? 2 : 4;
      // (just come into view: posed at once, never shown as they were when last seen)
      if (!P.fresh && (frame + P.id.length) % step !== 0) continue;
      P.fresh = false;
      // eyes on a player who comes near, or on whoever they are talking to (the eyes only)
      const tk = P.act && P.act.kind === 'talk' && P.act.phase === 'do' && P.act.spot.talk.who[1 - P.act.spot.i];
      const vis = far < 8 && !tk && P.act && (P.act.kind === 'post' || P.act.kind === 'stand') ? visitor(P) : null;
      if (far < 8 && player && player.pos.distanceTo(P.pos) < 4) c.lookAt(near.copy(player.pos).setY(player.pos.y + 1.55), { dart: true });
      else if (far < 8 && (tk || vis)) { const q = tk || vis; c.lookAt(near.copy(q.pos).setY(q.pos.y + 1.55), { dart: true }); }
      else c.lookAt(null);
      c.update(P.animDt); P.animDt = 0;
    }
    audit(dt);
  }

  // (someone standing still in front of a person at their post, within talking distance: a captain's visitor)
  function visitor(P) {
    let best = null, bd = 2.6;
    for (const Q of list) {
      if (Q === P || Q.walking || Q.hidden) continue;
      const dx = Q.pos.x - P.pos.x, dz = Q.pos.z - P.pos.z, d = Math.hypot(dx, dz);
      if (d < bd && dx * Math.sin(P.heading) + dz * Math.cos(P.heading) > d * 0.3) { bd = d; best = Q; }
    }
    return best;
  }
  // (a place at a talking spot, claimed: facing the other place)
  function talkAt(P, T, i, step) {
    T.who[i] = P; P.claim = { talk: T, i }; taken.set(P, [T.at[i]]);
    return { kind: 'talk', step, spot: { name: T.name, pos: T.at[i], heading: Math.atan2(T.at[1 - i].x - T.at[i].x, T.at[1 - i].z - T.at[i].z), talk: T, i } };
  }
  // (still at a spot or a seat: now and then a slow turn a little to one side or the other of the way it faces, as
  // anyone shifts and looks round; toward a visitor or the player who comes up, a little more)
  function idle(P, a, dt, most) {
    const L = a.look || (a.look = { off: 0, want: 0, next: rnd(2, 6) });
    L.next -= dt;
    if (L.next <= 0) { L.want = rnd(-most, most); L.next = rnd(4, 10); }
    const base = a.spot.heading ?? P.heading;
    const q = (playerNow && playerNow.pos.distanceTo(P.pos) < 3) ? playerNow : (a.kind === 'post' ? visitor(P) : null);
    let want = L.want;
    if (q) want = Math.max(-most * 2, Math.min(most * 2, wrap(Math.atan2(q.pos.x - P.pos.x, q.pos.z - P.pos.z) - base)));
    L.off += Math.sign(want - L.off) * Math.min(Math.abs(want - L.off), 0.7 * dt);
    P.heading = wrap(base + L.off);
  }
  // what a person does this moment
  function think(P, dt) {
    const a = P.act; if (!a) { next(P); return; }
    a.t += dt;
    if (a.kind === 'wait') { play(P, STAND); if (a.t > a.until) next(P); return; }
    if (P.req) { if (!P.walking) play(P, STAND); return; }        // (working the way out: as they were)
    if (P.walking) { walk(P, dt); return; }
    if (a.phase === 'go') { if (a.delay > 0) { a.delay -= dt; play(P, STAND); return; } route(P, a.spot.pos); return; }
    // turning to the spot's way, then at it
    if (a.phase === 'turn') {
      const want = a.spot.heading ?? P.heading, diff = wrap(want - P.heading);
      P.heading = wrap(P.heading + Math.sign(diff) * Math.min(Math.abs(diff), LIFE.turn * dt));
      play(P, STAND);
      if (Math.abs(diff) < 0.05) { a.phase = 'do'; a.t = 0; }
      return;
    }
    if (a.phase === 'sitting') {
      // onto the seat: turned to face the way it faces, moved back onto it, the clip into sitting
      const k = Math.min(1, a.t / LIFE.sit), want = a.spot.heading, diff = wrap(want - P.heading);
      P.heading = wrap(P.heading + Math.sign(diff) * Math.min(Math.abs(diff), LIFE.turn * 1.5 * dt));
      if (k > 0.25) { P.pos.lerpVectors(a.from, a.spot.seat, Math.min(1, (k - 0.25) / 0.75)); play(P, CLIPS.sit, { fade: 0.45 }); }
      if (k >= 1) { a.phase = 'sat'; a.t = 0; stillV++; }
      return;
    }
    // (getting up only when nobody is standing where they would step)
    if (a.phase === 'sat') { play(P, CLIPS.sit); idle(P, a, dt, a.spot.front ? 0.15 : 0.4); if (a.t > a.len && !someoneAt(a.spot.pos, P, LIFE.body)) { a.phase = 'rising'; a.t = 0; } return; }
    if (a.phase === 'rising') {
      const k = Math.min(1, a.t / LIFE.sit);
      play(P, STAND, { fade: 0.45 });
      if (k > 0.3) P.pos.lerpVectors(a.spot.seat, a.spot.pos, Math.min(1, (k - 0.3) / 0.7));
      if (k >= 1) { P.pos.copy(a.spot.pos); stillV++; next(P); }
      return;
    }
    // at it: standing, at work, or talking (the time counted once both are there)
    if (a.kind === 'talk') {
      const other = a.spot.talk.who[1 - a.spot.i], there = other && other.act && other.act.phase === 'do' && other.act.spot.talk === a.spot.talk;
      play(P, STAND);
      idle(P, a, dt, 0.12);
      if (there) { a.both = (a.both || 0) + dt; if (a.both > a.len) next(P); }
      else if (a.both > 0 || a.t > 20 || !other) next(P);      // (the other gone, or not come: on with the day)
      return;
    }
    play(P, a.clip || STAND);
    // (at work with a clip of its own: turned to the work; standing about, or a captain at the booth: a look round now
    // and then, and toward whoever comes up)
    if (!a.clip || a.clip === STAND) idle(P, a, dt, a.kind === 'post' ? 0.22 : 0.35);
    if (a.t > a.len) next(P);
  }

  // (anyone, or the player, within r of a point)
  function someoneAt(p, P, r) {
    for (const Q of list) if (Q !== P && !Q.hidden && Math.hypot(Q.pos.x - p.x, Q.pos.z - p.z) < r && Math.abs(Q.pos.y - p.y) < 1.2) return Q;
    if (playerNow && Math.hypot(playerNow.pos.x - p.x, playerNow.pos.z - p.z) < r) return playerNow;
    return null;
  }
  // TWO WALKERS HOLDING EACH OTHER UP (head on in a corridor, on the cafeteria's steps): the one later in the roster
  // makes way: a step aside, or back, to a free spot out of the other's way; waits there till the other has gone by;
  // then on along their own way
  const _y = new THREE.Vector3();
  function makeWay(P, Q) {
    const ax = Q.pos.x - P.pos.x, az = Q.pos.z - P.pos.z, L = Math.hypot(ax, az) || 1, ux = ax / L, uz = az / L;
    let best = null, bs = -Infinity;
    for (const [s, b] of [[0.75, -0.15], [-0.75, -0.15], [0.55, -0.55], [-0.55, -0.55], [0, -0.8], [0.9, 0.1], [-0.9, 0.1]]) {
      _y.set(P.pos.x - uz * s + ux * b, P.pos.y, P.pos.z + ux * s + uz * b);
      const t = P.pos.clone(); walls.move(t, _y.x - P.pos.x, _y.z - P.pos.z, 0.26);
      if (Math.hypot(t.x - _y.x, t.z - _y.z) > 0.1 || onPatch(t.x, t.z) || someoneAt(t, P, LIFE.body)) continue;
      // (the further from the line the other is walking along, the better)
      const score = Math.abs(s) - Math.max(0, b) * 0.5 + Math.random() * 0.05;
      if (score > bs) { bs = score; best = t; }
    }
    return best;
  }
  // walking the way, keeping clear of everyone
  const _d = new THREE.Vector3(), _t = new THREE.Vector3();
  function walk(P, dt) {
    P.walkT = (P.walkT || 0) + dt;
    // (making way for someone: to the spot aside, then waiting there till they have gone by)
    if (P.yielding) {
      const Y = P.yielding; Y.t += dt;
      const yx = Y.to.x - P.pos.x, yz = Y.to.z - P.pos.z, yd = Math.hypot(yx, yz);
      if (yd > 0.05 && Y.t < 2) {
        const s = Math.min(yd, P.speed * 0.8 * dt);
        P.heading = wrap(P.heading + Math.sign(wrap(Math.atan2(yx, yz) - P.heading)) * Math.min(Math.abs(wrap(Math.atan2(yx, yz) - P.heading)), LIFE.turn * dt));
        const g = walls.move(P.pos, yx / yd * s, yz / yd * s, 0.26);
        if (g < s * 0.3) { Y.t = 2; play(P, STAND); } else play(P, CLIPS.walk, { speed: 0.8 });   // (blocked: no walking on the spot)
      } else {
        const Q = Y.for; play(P, STAND);
        const gone = !Q.walking || Q.hidden || Math.hypot(Q.pos.x - P.pos.x, Q.pos.z - P.pos.z) > 1.6 || Y.t > 6;
        if (gone) { P.yielding = null; P.held = 0; P.side = 0; }
      }
      return;
    }
    // (getting nowhere for two seconds while walking, jiggling on the spot: the way worked out afresh from here; a
    // second time on one errand, the errand given up)
    if (P.jam) {
      P.jam = false; if (P.trail) P.trail.length = 0;
      alarms.jams = (alarms.jams || 0) + 1;
      if (alarms.jams <= 40) console.info('people: jam: ' + P.id + ' at ' + P.pos.toArray().map((v) => v.toFixed(2)) + ' (' + (P.act ? P.act.kind + ' ' + (P.act.spot?.name || '') : '-') + ', held by ' + (P.by || '-') + ', ' + (P.jammed ? 'again' : 'first') + ')');
      if (!P.jammed) { P.jammed = true; P.side = 0; stillV++; play(P, STAND); route(P, P.way[P.way.length - 1]); return; }
      alarms.gaveUp++; next(P); return;
    }
    const W2 = P.way;
    let goal = W2[P.wi];
    while (goal && P.wi < W2.length - 1 && Math.hypot(goal.x - P.pos.x, goal.z - P.pos.z) < 0.3) { P.wi++; goal = W2[P.wi]; }
    const gx = goal.x - P.pos.x, gz = goal.z - P.pos.z, gd = Math.hypot(gx, gz);
    if (P.wi >= W2.length - 1 && gd < 0.08) { P.pos.x = goal.x; P.pos.z = goal.z; arrive(P); stillV++; return; }
    let dx = gx / (gd || 1), dz = gz / (gd || 1);
    // the others near: everyone else, and the player
    others.length = 0;
    for (const Q of list) if (Q !== P && !Q.hidden && Math.abs(Q.pos.x - P.pos.x) < 2.5 && Math.abs(Q.pos.z - P.pos.z) < 2.5 && Math.abs(Q.pos.y - P.pos.y) < 1.5) others.push(Q);
    if (playerNow && Math.abs(playerNow.pos.x - P.pos.x) < 2.5 && Math.abs(playerNow.pos.z - P.pos.z) < 2.5 && Math.abs(playerNow.pos.y - P.pos.y) < 1.5) others.push(playerNow);
    // in the lane ahead: passed on the side away from them (head on, each to their own right)
    const sx = -dz, sz = dx; let steer = 0, slow = 1;
    for (const Q of others) {
      const ox = Q.pos.x - P.pos.x, oz = Q.pos.z - P.pos.z, ahead = ox * dx + oz * dz, lat = ox * sx + oz * sz;
      if (ahead < -0.1 || ahead > LIFE.lane[0] || Math.abs(lat) > LIFE.lane[1]) continue;
      // (no swerve for someone further along than the end of the way: they are where it goes, and it waits for them)
      const w = (1 - Math.max(0, ahead) / LIFE.lane[0]) * (1 - Math.abs(lat) / LIFE.lane[1]);
      steer += (lat > 0.05 ? -1 : lat < -0.05 ? 1 : (Q === playerNow || !Q.walking ? 1 : -1)) * w;
      if (ahead < 1.0) slow = Math.min(slow, 0.55 + ahead * 0.45);
    }
    // (walking beside someone going the same way: the one later in the roster drops back a little, so two never walk
    // shoulder to shoulder in step)
    for (const Q of others) {
      if (Q === playerNow || !Q.walking || P.order < Q.order) continue;
      const ox = Q.pos.x - P.pos.x, oz = Q.pos.z - P.pos.z, ahead = ox * dx + oz * dz, lat = Math.abs(ox * sx + oz * sz);
      if (ahead > -0.4 && ahead < 0.9 && lat < 1.1 && Math.cos(Q.heading - P.heading) > 0.6) slow = Math.min(slow, 0.7);
    }
    steer = Math.max(-1.2, Math.min(1.2, steer)) + P.side;
    dx += sx * steer * 1.2; dz += sz * steer * 1.2;
    const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    // turning toward the way walked (on the spot first if it is far round)
    const want = Math.atan2(dx, dz), diff = wrap(want - P.heading);
    P.heading = wrap(P.heading + Math.sign(diff) * Math.min(Math.abs(diff), LIFE.turn * dt));
    if (Math.abs(diff) > 1.3) { play(P, STAND); return; }
    let step = Math.min(gd, P.speed * slow * dt), by = null;
    // never onto a patch kept off: steering round someone that would, straight along the way instead (unless already
    // on one: off it then)
    if (onPatch(P.pos.x + dx * step, P.pos.z + dz * step) && !onPatch(P.pos.x, P.pos.z)) {
      const ux = gx / (gd || 1), uz = gz / (gd || 1);
      if (!onPatch(P.pos.x + ux * step, P.pos.z + uz * step)) { dx = ux; dz = uz; } else by = 'patch';
    }
    // never to within LIFE.body of anyone (a step that would bring them closer than that is not taken)
    _d.set(P.pos.x + dx * step, 0, P.pos.z + dz * step);
    if (!by) for (const Q of others) { const d1 = Math.hypot(Q.pos.x - _d.x, Q.pos.z - _d.z); if (d1 < LIFE.body && d1 < Math.hypot(Q.pos.x - P.pos.x, Q.pos.z - P.pos.z)) { by = Q; break; } }
    let got = 0;
    if (!by) got = walls.move(P.pos, dx * step, dz * step, 0.26);
    // (pressed into a corner, or steered into one: the freest small step near the way wanted, never back the way they
    // came, onto a patch or toward anyone)
    if (!by && got < step * 0.3) {
      const ux = gx / (gd || 1), uz = gz / (gd || 1);
      let bx = 0, bz = 0, bd = 0.2;
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2, vx = Math.sin(a), vz = Math.cos(a), dot = vx * ux + vz * uz;
        if (dot <= bd) continue;
        _t.copy(P.pos);
        if (walls.move(_t, vx * step, vz * step, 0.26) < step * 0.7 || onPatch(_t.x, _t.z) || others.some((Q) => Math.hypot(Q.pos.x - _t.x, Q.pos.z - _t.z) < LIFE.body && Math.hypot(Q.pos.x - _t.x, Q.pos.z - _t.z) < Math.hypot(Q.pos.x - P.pos.x, Q.pos.z - P.pos.z))) continue;
        bd = dot; bx = vx; bz = vz;
      }
      if (bx || bz) got += walls.move(P.pos, bx * step, bz * step, 0.26);
    }
    P.blocker = by && typeof by === 'object' ? by : null;
    // (held up by a walker who is held up by them: the one later in the roster makes way)
    if (P.blocker && P.blocker === playerNow && P.held > 1.2 && !P.madeWayFor) {
      const to = makeWay(P, playerNow);
      if (to) { P.yielding = { to, for: { pos: playerNow.pos, walking: true, hidden: false }, t: 0 }; P.madeWayFor = true; P.blocker = null; alarms.madeWay = (alarms.madeWay || 0) + 1; return; }
    }
    if (P.blocker && P.blocker !== playerNow && P.blocker.walking && P.blocker.blocker === P && P.held > 0.3 && P.order > P.blocker.order) {
      const to = makeWay(P, P.blocker);
      if (to) { P.yielding = { to, for: P.blocker, t: 0 }; P.blocker = null; alarms.madeWay = (alarms.madeWay || 0) + 1; return; }
    }
    // held up: a moment's wait, then a step aside (to the right), then the way worked out again, then given up. Held
    // by someone standing still (they will not move) or by a wall: the way worked out again at once, round them; and
    // someone standing where they were going: somewhere else instead.
    if (got < step * 0.3) {
      P.held += dt; P.by = by && by === playerNow ? 'player' : by === 'patch' ? 'patch' : by ? 'person' : 'wall';
      const still = !by || by === 'patch' || (by !== playerNow && !by.walking), end = P.way[P.way.length - 1];
      if (still && P.held > LIFE.stillWait && Math.hypot(end.x - P.pos.x, end.z - P.pos.z) < 1.6) { alarms.gaveUp++; P.side = 0; P.held = 0; next(P); return; }
      if (P.held > LIFE.sidestep && !P.side) P.side = Math.random() < 0.75 ? 0.9 : -0.9;
      // (the way worked out again whenever held this long, at most once in LIFE.replanEvery seconds; held up too long in
      // all, they give it up)
      P.heldAll = (P.heldAll || 0) + dt;
      if (P.held > (still ? LIFE.stillWait : LIFE.replan) && (P.lastReplan == null || P.walkT - P.lastReplan > LIFE.replanEvery)) { P.lastReplan = P.walkT; P.side = 0; stillV++; route(P, end); return; }
      if (P.heldAll > LIFE.giveUp) { alarms.gaveUp++; P.side = 0; P.held = 0; next(P); return; }
      play(P, STAND);
    } else {
      if (P.held > 0.5) P.side = P.side * 0.98;
      P.heldAll = Math.max(0, (P.heldAll || 0) - dt * 0.5);
      P.held = Math.max(0, P.held - dt * 2); if (P.held === 0) { P.side *= Math.exp(-dt * 1.5); if (Math.abs(P.side) < 0.05) P.side = 0; }
      const v = got / Math.max(dt, 1e-4);
      if (v < 0.35) play(P, STAND); else play(P, CLIPS.walk, { speed: Math.max(0.6, Math.min(1.5, v / P.c.stride.Walk)) });
    }
  }

  // ── the loud alarms: counted as they happen (each person's first of a kind also said in the console) ─────────
  let auditClock = 0;
  function audit(dt) {
    auditClock += dt; if (auditClock < 0.25) return;
    const T = auditClock; auditClock = 0;
    for (const P of list) {
      if (P.hidden) continue;
      // stuck: a way to go, and less than 0.4 m from where they were LIFE.stuck seconds ago (as the crow flies, so someone
      // jiggling back and forth on the spot is stuck too); making way for someone is not being stuck
      const tr = P.trail || (P.trail = []);
      if (P.walking && !P.yielding) {
        tr.push(P.pos.x, P.pos.z); if (tr.length > 2 * Math.round(LIFE.stuck / 0.25 + 1)) tr.splice(0, 2);
        const full = tr.length >= 2 * Math.round(LIFE.stuck / 0.25 + 1), moved = Math.hypot(P.pos.x - tr[0], P.pos.z - tr[1]);
        // (not getting anywhere for two seconds, walking or not: held, so they stand and work the way out afresh)
        const two = tr.length >= 18 ? Math.hypot(P.pos.x - tr[tr.length - 18], P.pos.z - tr[tr.length - 17]) : Infinity;
        P.jam = two < 0.3;
        if (full && moved < 0.4 && !P.stuckSaid) {
          P.stuckSaid = true;
          // (waiting for the player to get out of the way is good manners, not stuck: counted apart)
          if (P.by === 'player') alarms.waitedForPlayer = (alarms.waitedForPlayer || 0) + 1;
          else alarm('stuck', P, 'at ' + P.pos.toArray().map((v) => v.toFixed(2)) + ' (held by ' + (P.by || '?') + ', ' + (P.act?.spot?.name || P.act?.kind) + ')');
        } else if (moved > 0.8) P.stuckSaid = false;
      } else { tr.length = 0; P.jam = false; }
      // in a wall (a sitter is on a seat: not counted)
      const sitting = P.act && (P.act.phase === 'sat' || P.act.phase === 'sitting' || P.act.phase === 'rising');
      if (!sitting && !walls.free(P.pos.x, P.pos.y, P.pos.z, 0.18, true)) alarm('inWall', P, 'at ' + P.pos.toArray().map((v) => v.toFixed(2)) + ' (' + (P.act ? P.act.kind + ' ' + (P.act.phase || '') + ' ' + (P.act.spot?.name || '') : '-') + (P.walking ? ', walking' : '') + (P.yielding ? ', making way' : '') + ')');
      // in another person (or the player)
      for (const Q of list) if (Q !== P && !Q.hidden && Q.id > P.id && Math.hypot(Q.pos.x - P.pos.x, Q.pos.z - P.pos.z) < 0.42 && Math.abs(Q.pos.y - P.pos.y) < 1) alarm('inPerson', P, 'and ' + Q.id);
      if (playerNow && Math.hypot(playerNow.pos.x - P.pos.x, playerNow.pos.z - P.pos.z) < 0.42) alarm('inPerson', P, 'and the player');
      // on a patch kept off (a job's ring, a ship's way in, under the crane, the scanner)
      if (onPatch(P.pos.x, P.pos.z) && !sitting) alarm('onPatch', P, 'at ' + P.pos.toArray().map((v) => v.toFixed(2)));
    }
  }

  // ── for the station: who the doors open for, who a ship's way waits for ─────────────────────────────────────
  const eyeList = [];
  function eyes() { eyeList.length = 0; for (const P of list) if (!P.hidden && (P.walking || P.req || P.yielding || (P.act && P.act.phase === 'go'))) eyeList.push(P.pos); return eyeList; }
  function onWays(out) {
    for (const P of list) { if (P.hidden) continue; for (const w of wayFeet) if (P.pos.x > w.box.min.x - 0.5 && P.pos.x < w.box.max.x + 0.5 && P.pos.z > w.box.min.z - 0.5 && P.pos.z < w.box.max.z + 0.5) { out.push(P.pos); break; } }
    return out;
  }

  // ── for the plan from above ──────────────────────────────────────────────────────────────────────────────────
  const COL = { post: '#ffb347', stand: '#8fd3ff', sit: '#c6a0ff', talk: '#7dff9a', walk: '#ff8fb0' };
  function plan({ labels = false } = {}) {
    const spots = [], routes = [], notes = [];
    for (const [g, L] of Object.entries(groups)) for (const s of L.filter(Boolean)) spots.push({ at: [s.pos.x, s.pos.z], face: s.heading, label: labels ? s.name : null, colour: s.who ? '#fff' : '#9ab', kind: 'stand', group: g });
    for (const [g, L] of Object.entries(seats)) for (const s of L) spots.push({ at: [s.seat.x, s.seat.z], face: s.heading, kind: 'sit', colour: COL.sit, group: g });
    for (const [g, L] of Object.entries(talks)) for (const T of L) for (const p of T.at) spots.push({ at: [p.x, p.z], kind: 'talk', colour: COL.talk, group: g, label: labels ? T.name : null });
    for (const P of list) {
      const kind = P.act ? P.act.kind : 'wait';
      spots.push({ at: [P.pos.x, P.pos.z], face: P.heading, label: labels || kind === 'post' ? P.id : null, colour: COL[kind] || '#fff', kind: 'person' });
      if (P.way) routes.push({ id: P.id, colour: (COL[kind] || '#fff') + 'cc', way: P.way.map((p) => [p.x, p.z]) });
    }
    return { spots, routes, noGo: patches, notes };
  }

  // one more person, standing (the cost test)
  async function add(recipe, pos, heading = 0) {
    const P = await body({ id: 'extra-' + list.length, name: 'Extra', look: recipe }, pos, heading);
    if (!P) return null;
    Object.assign(P, { order: 1e6 + list.length, day: [{ do: 'stand:none' }], k: 0, act: { kind: 'wait', until: Infinity, t: 0 }, speed: 1.2, lastGain: P.pos.clone(), gain: 0, held: 0, side: 0 });
    list.push(P); return P;
  }
  function remove(P) { const i = list.indexOf(P); if (i >= 0) list.splice(i, 1); release(P); W.scene.remove(P.c.root); P.inScene = false; P.c.dispose(); }
  // ── aboard: everyone, one at a time ──────────────────────────────────────────────────────────────────────────
  // (how many: by the picture's quality, or the address's ?crowd=N, for the cost rigs)
  const asked = +new URLSearchParams(location.search).get('crowd');
  const quality = W.quality in CROWD ? W.quality : 'medium', most = asked > 0 ? Math.min(asked, ROSTER.length) : CROWD[quality];
  const askedDrawn = +new URLSearchParams(location.search).get('drawn');
  drawnMost = askedDrawn > 0 ? askedDrawn : LIFE.drawn[quality];
  const roster = ROSTER.slice(0, most);
  // where each comes aboard: their first spot (a post's own, or the first free spot of their day), placed there at once
  for (const def of roster) {
    const day = def.day.map((d) => (typeof d === 'string' ? { do: d } : d));
    const P0 = { id: def.id, day, k: 0, pos: null };
    let first = null;
    for (let k = 0; k < day.length && !first; k++) { first = claimFor(P0, day[k]); if (first) P0.k = k; }
    if (!first) { missing.push(def.id + ' (nowhere to be)'); continue; }
    const P = await body(def, first.spot.pos, first.spot.heading ?? 0);
    if (!P) { release(P0); continue; }
    Object.assign(P, { order: list.length, day, k: P0.k, speed: rnd(...LIFE.speed), act: null, way: null, wi: 0, req: null, held: 0, still: 0, gain: 0, lastGain: P.pos.clone(), side: 0, sat: 0, by: null });
    P.claim = P0.claim; handOver(P.claim, P0, P);
    begin(P, first, true);
    list.push(P); say(list.length);
  }

  // RUNNING FROM THE CRANE (src/crane.js: the crane worked by hand brings a load down low over someone; the game's
  // maker: "If people are in the way then they should start to run away"): anyone standing or walking within r of
  // (x, z) drops what they are doing and hurries off to a free spot at least `away` metres from there (the way-finder's
  // way, keeping off the patches), then goes on with their day. -> the people sent
  function flee(x, z, r = 2, away = 4.5) {
    const sent = [];
    for (const P of list) {
      if (P.hidden || P.fleeing || !P.act) continue;
      if (P.act.phase === 'sat' || P.act.phase === 'sitting' || P.act.phase === 'rising') continue;
      const dx = P.pos.x - x, dz = P.pos.z - z, d = Math.hypot(dx, dz);
      if (d > r || P.pos.y > 2.4) continue;
      const a0 = d > 0.05 ? Math.atan2(dx, dz) : Math.random() * Math.PI * 2;
      let to = null;
      for (const da of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, Math.PI]) {
        const a = a0 + da, L = away + r, p = walls.snap(x + Math.sin(a) * L, P.pos.y + 0.4, z + Math.cos(a) * L, 0.8);
        if (p && !onPatch(p.x, p.z) && !someoneAt(p, P, LIFE.body)) { to = p; break; }
      }
      if (!to) continue;
      P.fleeing = { was: P.speed }; P.speed = Math.max(P.speed, 1.2) * 1.9;
      begin(P, { kind: 'walk', step: { for: [1, 2] }, spot: { pos: to, heading: null }, list: [{ pos: to }], j: 0 });
      sent.push(P);
    }
    return sent;
  }
  const stats = () => ({ people: list.length, quality, most, walking: list.filter((P) => P.walking).length, shown: list.filter((P) => P.shown).length, planning: planQ.length, steps: walls.steps ? walls.steps() : null });
  return { list, missing, update, add, remove, eyes, onWays, noGo, alarms, plan, stats, groups, seats, talks, patches, LIFE, flee };
}
