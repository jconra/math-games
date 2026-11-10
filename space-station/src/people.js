// THE PEOPLE in the station: who stands where and who walks about (spots.js), each built with the crew kit from its
// recipes, drawn only while the room they are in is drawn. No talking, jobs or math yet.
//
//   const people = await makePeople({ W, walls, lib, say })
//   people.update(dt, { player, camera })    walkers walk; whoever is drawn moves; eyes follow a player who is near
//   people.list    [{ id, name, c, pos, heading, walker }]          people.missing  the markers the station has no name for
//   people.add(recipe, spot, heading)  one more person standing (the cost test)
//   resolve(W, walls, at) -> { pos, heading } | null                where a spot in spots.js is, by the station's names
import * as THREE from 'three';
import { makeCrew } from '../kit/crew.js';
import { expand, zonesOf } from '../kit/layout.js';
import { PIECES } from '../kit/catalog.js';
import { placeMatrix, WALL_FACE } from '../kit/grid.js';
import { PEOPLE, WALKERS } from './spots.js';
import { STAND, shine } from './player.js';

const SEEN = 46;        // people further than this from the camera are not drawn (m)
const WALK = { speed: 1.25, pause: [2.5, 5], near: 0.9, turn: 6 };   // m/s; s; m kept off the player; radians a second
const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

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
// a spot's point and the way it faces (before it is moved to where a person can stand)
function rough(W, pieces, at) {
  if (at.spawn) {
    const s = W.R.spawn; if (!s || !s.at) return null;
    const p = new THREE.Vector3(...s.at), l = s.look ? new THREE.Vector3(...s.look) : null;
    // (the spawn is where the eyes are: the floor is about 1.6 m below)
    return { p: p.setY(p.y - 1.6), heading: l ? Math.atan2(l.x - s.at[0], l.z - s.at[2]) : 0 };
  }
  if (at.place) { const p = W.place(at.place); return p ? { p, heading: null } : null; }
  if (at.room) {
    const z = roomMatch(W, at.room); if (!z) return null;
    const c = z.box.getCenter(new THREE.Vector3()); return { p: c.setY(z.box.min.y), heading: null };
  }
  if (at.piece) {
    const pc = pieces.find((x) => x.piece === at.piece && (!at.variant || x.variant === at.variant) && (!at.room || x.room === at.room));
    if (!pc) return null;
    const p = new THREE.Vector3(...(at.local || [0, 0, 0])).applyMatrix4(pc.M);
    let heading = null;
    if (at.face) { const d = new THREE.Vector3(at.face[0], 0, at.face[1]).transformDirection(pc.M); heading = Math.atan2(d.x, d.z); }
    return { p, heading };
  }
  return null;
}
export function resolve(W, walls, at, pieces = piecesOf(W.R)) {
  const r = rough(W, pieces, at); if (!r) return null;
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

export async function makePeople({ W, walls, lib, say = () => {} }) {
  const pieces = piecesOf(W.R), list = [], missing = [];
  const recipeOf = (r) => (typeof r === 'string' ? (lib.list.recipes || {})[r] : r);
  const firstClip = (c, clips) => [].concat(clips || STAND).find((n) => c.person.actions[n]) || 'Idle';

  async function standing(def, spot) {
    const recipe = recipeOf(def.recipe); if (!recipe) { missing.push(def.id + ': no recipe ' + def.recipe); return null; }
    const c = await makeCrew(lib, recipe);
    const P = { id: def.id, name: def.name, c, pos: spot.pos.clone(), heading: spot.heading ?? 0, walker: null, zone: null, shown: false };
    c.root.position.copy(P.pos); c.root.rotation.set(0, P.heading, 0);
    shadeUnder(c.root); shine(c, W.envAt(P.pos));
    const clip = firstClip(c, def.clip);
    c.play(clip, { fade: 0 }); c.update(0); c.update(Math.random() * 3);   // (each at its own moment of the clip)
    c.root.visible = false; W.scene.add(c.root);
    list.push(P); return P;
  }

  for (const def of PEOPLE) {
    const spot = resolve(W, walls, def.at, pieces);
    if (!spot) { missing.push(def.id); continue; }
    // (no heading given: face the room's middle)
    if (spot.heading === null || spot.heading === undefined) {
      const z = W.zoneAt(spot.pos), c = z ? z.box.getCenter(new THREE.Vector3()) : null;
      spot.heading = c ? Math.atan2(c.x - spot.pos.x, c.z - spot.pos.z) : 0;
    }
    await standing(def, spot);
    say(list.length);
  }
  for (const def of WALKERS) {
    const a = resolve(W, walls, def.from, pieces), b = resolve(W, walls, def.to, pieces);
    const way = a && b ? walls.path(a.pos, b.pos) : null;
    if (!way || way.length < 2) { missing.push(def.id + (a && b ? ' (no way between its spots)' : '')); continue; }
    const P = await standing({ ...def, clip: STAND }, { pos: a.pos, heading: Math.atan2(way[1].x - way[0].x, way[1].z - way[0].z) });
    if (!P) continue;
    P.walker = { way, i: 1, dir: 1, wait: Math.random() * 2, clip: '' };
    say(list.length);
  }

  const near = new THREE.Vector3();
  let zoneClock = 0;
  function update(dt, { player = null, camera }) {
    zoneClock -= dt;
    const findZones = zoneClock <= 0; if (findZones) zoneClock = 0.4;
    for (const P of list) {
      const c = P.c, Wk = P.walker;
      if (P.hidden) { c.root.visible = false; continue; }      // (put away: the cost test)
      if (Wk) walk(P, Wk, dt, player);
      if (findZones || !P.zone) { const z = W.zoneAt(P.pos); if (Wk && z && z !== P.zone) shine(c, W.envAt(P.pos)); P.zone = z; }
      const far = camera.position.distanceTo(P.pos);
      const shown = !!(P.zone && P.zone.group.visible) && far < SEEN;
      c.root.visible = shown;
      if (!shown) continue;
      c.root.position.copy(P.pos); c.root.rotation.set(0, P.heading, 0);
      // eyes on a player who comes near (the eyes only: they stay at their post)
      if (player && player.pos.distanceTo(P.pos) < 4) c.lookAt(near.copy(player.pos).setY(player.pos.y + 1.55), { dart: true });
      else c.lookAt(null);
      c.update(dt);
    }
  }
  // a walker: along the way, pausing at each end, waiting for the player to pass
  function walk(P, Wk, dt, player) {
    const c = P.c, play = (name, speed = 1) => { if (Wk.clip !== name) { c.play(name, { fade: 0.3, speed }); Wk.clip = name; } else c.play(name, { speed }); };
    if (Wk.wait > 0) { Wk.wait -= dt; play(STAND); return; }
    const goal = Wk.way[Wk.i], dx = goal.x - P.pos.x, dz = goal.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.15) {
      Wk.i += Wk.dir;
      if (Wk.i >= Wk.way.length || Wk.i < 0) { Wk.dir = -Wk.dir; Wk.i += Wk.dir * 2; Wk.wait = WALK.pause[0] + Math.random() * (WALK.pause[1] - WALK.pause[0]); }
      return;
    }
    const want = Math.atan2(dx, dz), diff = wrap(want - P.heading);
    P.heading = wrap(P.heading + Math.sign(diff) * Math.min(Math.abs(diff), WALK.turn * dt));
    // the player in the way, just ahead: wait a moment for them, then step to the right, round them
    if (player) {
      const px = player.pos.x - P.pos.x, pz = player.pos.z - P.pos.z, pd = Math.hypot(px, pz);
      if (pd < WALK.near * 1.6 && (px * Math.sin(P.heading) + pz * Math.cos(P.heading)) > 0 && Math.abs(player.pos.y - P.pos.y) < 1.5) {
        Wk.held = (Wk.held || 0) + dt;
        if (Wk.held < 0.8) { play(STAND); return; }
        const s = WALK.speed * 0.7 * dt, got = walls.move(P.pos, Math.cos(P.heading) * s, -Math.sin(P.heading) * s, 0.26);
        play('Walk', 0.7);
        if (got > s * 0.3) return;
      } else Wk.held = 0;
    }
    if (Math.abs(diff) > 1.2) { play(STAND); return; }       // (turning on the spot first)
    const step = Math.min(d, WALK.speed * dt);
    const got = walls.move(P.pos, dx / d * step, dz / d * step, 0.26);
    Wk.stuck = got < step * 0.3 ? (Wk.stuck || 0) + dt : 0;
    if (Wk.stuck > 3) { Wk.dir = -Wk.dir; Wk.i = Math.max(0, Math.min(Wk.way.length - 1, Wk.i + Wk.dir)); Wk.stuck = 0; }
    play('Walk', Math.max(0.6, Math.min(1.5, (got / Math.max(dt, 1e-4)) / c.stride.Walk)));
  }

  // one more person, standing (the cost test)
  async function add(recipe, pos, heading = 0) { return standing({ id: 'extra-' + list.length, name: 'Extra', recipe, clip: STAND }, { pos, heading }); }
  function remove(P) { const i = list.indexOf(P); if (i >= 0) list.splice(i, 1); W.scene.remove(P.c.root); P.c.dispose(); }
  return { list, missing, update, add, remove, eyes: () => list.filter((P) => P.walker).map((P) => P.pos) };
}
