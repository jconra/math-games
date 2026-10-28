// LOOT THE GANG: the second half of the gang story. The gang that hits the freight wagons (Protect the wagon) stashed
// what it stole out in the valley; the deputy out front of the sheriff's office says so, and the compass leads to the
// cache: a small hideout of crates, sacks and a strongbox under a canvas lean-to by a cold fire ring, made here in code
// (the crates are the camps' own: src/camps.js crateParts). Now and then one of the gang sits his horse there on guard
// (riders.js: he looks like any rider; being there is what gives him away). Roping him is a choice, not a toll: rope
// him (the green ring, a click or F, like the wagon job's bandits) and he's pulled down and hogtied (a bandit brought in,
// and a small bounty); ride straight in and he lights out for the hills. Nothing is lost either way.
//
// Riding up to the cache loads the loot on the horse (it shows on her back, in panniers and a strongbox on top). The
// loot is heavy: it needs a saddled horse (the deputy and Old Hob say where to buy one). The compass then points back
// to the sheriff's office, where the folks it was taken from come out to wait; as you ride in one of them sees his
// goods ("Is that my stuff?", the game maker's own recording, src/audio/shouts.js). Pulling up in front of them brings up the
// store's parchment slip (src/ui/storeslip.js) with the first bundle's sharing problem (src/math/shares.js): fair
// shares and leftovers, its own kind of problem, at the rider's level on the loot ladder (src/levels/place/loot.js,
// kept by src/levels/model.js: the youngest share 6 apples between 2 families with the apples drawn on the slip, then
// fair shares, leftovers and shares by a rule; read out loud, with "Read it to me" on the slip, for a rider who can't
// read yet). Each bundle's first pick is one answer at the level it was made at. Pick a coin. A wrong coin shakes, one plain line says what that slip
// was, and the slip draws the sharing (dealt out round and round, the trips and boxes, the parts): never the answer.
// A right coin: each family's one steps up and takes their share, someone says thank you (the men in the game maker's
// recorded voice; the women in a speech card only), gold from the deputy flies into the purse, and the next bundle's
// problem slides in. When the last bundle is handed back the trip pays a bonus, it counts toward the "loot returned"
// belt buckle (save.js JOBS), the deputy thanks you, and before long there's word of another stash elsewhere.
//
// Walking or riding off is "done for now": nothing is lost. The slip goes away when you walk off (or with "Done for
// now" / Esc); the loot stays on the horse, the folks wait, and pulling up again brings the slip back.
//
// THE BACK WOODS: besides the hideout the deputy sends you to, the gang keeps WOODS.camps more camps out in the back
// woods (the woods out west past the cow camp, the woods south-west of town, the woods out east past the wagon road), at
// spots picked at random each ride from BACKWOODS (a survey of the land: a clearing at a woods edge, flat and dry, that a
// horse can reach, well clear of the town, the roads, the other camps, the deer and the western river where the bridge
// is to go). Each looks like the hideout (a tent or a lean-to over crates, sacks and a strongbox), and often a guard sits
// his horse there by his fire (rope him, or ride straight in and he lights out). They aren't on the compass until found
// (ridden within WOODS.found metres); then they are, till looted. Riding in with a saddled horse loads the loot as at the
// hideout, and it is shared out at the sheriff's office the same way (WOODS trips are counted on their own, so the
// checklist's hideouts still mean the deputy's). A camp emptied is struck once nobody's looking, and a new one is pitched
// somewhere else in the back woods a few minutes later: never in sight, never near the player.
//
//   const LJ = makeLootJob({ W, folk, animals, P, I, camera, canvas, rider, hud, hob, refresh, voice, quiet })
//     voice(kind, who): a recorded line from a townsman ('mystuff', 'thanks': src/audio/shouts.js S.say; who: { at,
//     male, id }); quiet(): true while another job has the HUD's card (this job's card stays down then); town(): the
//     town's people (src/townpeople.js) or null: the folks are townsfolk borrowed from it (already walking over, or out
//     of the nearest door) and given back to walk home
//   LJ.update(dt)       each frame after the player
//   LJ.phase            'out' (the cache waits) | 'carrying' (the loot is on the horse) | 'rest' (word of the next cache
//                       is coming)
//   LJ.active           the slip is up (sharing out at the sheriff's office)
//   LJ.card             true while this job has the HUD's card (near the cache, or carrying the loot)
//   LJ.near             at the cache (its guard about)
//   LJ.workSum()        the slip's sum for the tools' Work it out (src/math/jobsums.js lootSum), or null
//   LJ.canShare         carrying loot by the sheriff's office (the deputy's E shares it out: LJ.share())
//   LJ.marks()          [{ id, icon, x, z, label }] for the compass: the cache, or the sheriff's office with the loot
//   LJ.people           the townsfolk waiting at the sheriff's office (live records with x, z: the town's wagons stop
//                       for them)
//   LJ.wanted()         while the loot is on its way and they aren't out yet: { names (their townsfolk), at (the spot) }
//   LJ.paused           a panel is open over the game
//   LJ.cache, LJ.trainer, LJ.state() (for rigs), LJ.dev { at(), load(), town(), guard(), cache(i), woods(i), pitch(n) },
//   LJ.dispose()
//   LJ.woods            the back woods' camps now: [{ id, x, z, area, found, loot (still there), guard (state or null) }]
//   LJ.nearestLoot(at)  the nearest gang camp with loot still in it (the hideout or a back-woods camp): { x, z, id, name }
//                       or null (the jobs board's tracks)
//   CACHES, LOOT        the hideouts and the dials;  BACKWOODS, WOODS, AREAS   the back woods' spots and dials
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makePerson } from '../actors/folk.js';
import { loadRiderKit, makeRider } from '../actors/riders.js';
import { makeTargetRing } from '../targetring.js';
import { crateParts } from '../camps.js';
import { makeCampfire } from '../fire/campfire.js';
import { BACKWOODS, AREAS, WOODS, pickSpot } from './backwoods.js';
export { BACKWOODS, AREAS, WOODS, pickSpot };   // (the back woods' spots and dials: src/missions/backwoods.js)
import { makeShares, picture, FAMILIES, MATRON, shareFact } from '../math/shares.js';
import { makeStoreSlip, speakLine } from '../ui/storeslip.js';
import { earn, recordAnswer, countJob, saveRider } from '../save.js';
import { readAloud } from '../math/skill.js';
import { levelFor } from '../levels/model.js';
import { recordFact } from '../math/facts.js';
import { answerTimer } from '../ui/answertimer.js';
import { lootSum } from '../math/jobsums.js';


// THE SKILL MODEL'S PART (src/math/skill.js): each share's first pick counts in Division at the share's own point (the
// ladder's step is the rider's level there: asked before each trip and after each answer), and in Word problems at
// half weight at the story's point on that scale; the shares by a rule count in Ratios too, at half weight. A sit-down
// slip: its time counts (src/ui/answertimer.js). A right pick after the picture was asked for says nothing new.

// The gang's hideouts, taken in turn (picked from a survey of the land: ~/pw/bandit-math/rigs/loot/survey.cjs: dry,
// gentle ground at a woods edge where it can, well clear of the town, the farm, the pasture, the camps, the deer, the
// wagon road and the trail). x, z: metres, world.
export const CACHES = [
  { id: 'hollow', x: -154, z: -100, name: 'the hollow by the western woods' },
  { id: 'timber', x: 140, z: -322, name: 'the timber past the farm' },
  { id: 'thicket', x: -76, z: -46, name: 'the thicket above the lake' },
  { id: 'meadow', x: 146, z: 92, name: 'the far meadow' },
  { id: 'pines', x: -250, z: -130, name: 'the pines past the cow camp' },
];

export const LOOT = {
  near: 70,             // m from the cache: at the cache (the card says what's there; the guard watches)
  ropeNear: 45,         // m: the green ring picks the guard within this of the player
  flee: 12,             // m: riding in this close to the loot without roping the guard, he lights out
  load: 7,              // m from the cache's middle: the loot goes on the horse
  horseNear: 22,        // ... when the horse is within this of it
  guardChance: 0.65,    // a guard at the cache (always on the first trip)
  town: 75,             // m from the sheriff's door with the loot: the folks it was taken from come out to wait
  townGone: 170,        // ... farther than this they go home (and come out again when the loot comes back)
  stuff: 24,            // m from them: one of them sees his goods ("Is that my stuff?")
  spot: 2.0,            // m out in front of the sheriff's door: where you hand it back (the office faces the main street
                        // and the wagon road runs a few metres out: further out, the folks stood in the road)
  arc: 2.7,             // m from that spot (toward the door) the folks stand, in an arc facing it
  share: 4.5,           // m from the spot, slower than shareSlow (m/s): the slip comes up
  shareSlow: 3.2,
  again: 11.5,          // after the slip went away, it comes up again only after this far off and back
  leave: 11,            // m from the spot: walking or riding off this far puts the slip away
  rest: 16,             // s from a trip handed back to word of the next cache
  bundles: [2, 3],      // bundles of loot (share problems) a trip: the first trip, then each after
  families: 6,          // families waiting at the office for a trip (each bundle is theirs, some or all)
  walk: 1.45,           // m/s the townsfolk stroll
  mow: 6, mowFade: 3,   // the meadow mown round the cache (m), so the crates show over the grass
  rungBase: 3,       // the pay's ladder starts counting at the 4th level (fair shares): the drawn ones pay the base
  pay: { each: 3, everyStep: 2, first: 1, trip: 6, clean: 3, guard: 4 },   // gold: a bundle (+1 for every 2 steps up the
                        // ladder, +1 right first time), a trip handed back (+ clean when every bundle was right first
                        // time), and roping the guard
  guardGone: 70,        // m: a hogtied guard is taken away (out of sight) once the player is this far off
};

const MEN_THANKS = ['Much obliged, partner!', "That's mine, all right. Thank ya kindly!", 'Thank ya kindly!', 'You found it! Obliged.'];
const WOMEN_THANKS = ['Bless you! Thank you kindly.', 'Oh, thank you! We thought it was gone for good.', "You're a real life saver.", 'Thank you, partner!'];
const MATRON_THANKS = ['The children thank you kindly.', "That'll go a long way at the orphans' home. Thank you."];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const way = (from, to) => { const a = Math.atan2(to.x - from.x, to.z - from.z); const k = Math.round(((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (Math.PI / 4)) % 8; return ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'][k]; };
const roundTo = (d) => (d > 100 ? Math.round(d / 10) * 10 : Math.round(d));

// the tent's canvas: an old cream canvas with its seams, weathered and muddied toward the ground (v = 0 at the ground)
function canvasCloth() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = '#c4b591'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${90 + (i % 40)},${70 + (i % 30)},40,${0.04 + (i % 7) * 0.01})`; x.fillRect((i * 37) % 128, (i * 91) % 128, 2, 1); }
  for (const u of [0, 42, 85]) { x.fillStyle = 'rgba(80,60,35,0.35)'; x.fillRect(u, 0, 2, 128); }
  const g = x.createLinearGradient(0, 128, 0, 70); g.addColorStop(0, 'rgba(70,50,25,0.55)'); g.addColorStop(1, 'rgba(70,50,25,0)');
  x.fillStyle = g; x.fillRect(0, 70, 128, 58);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
// The meadow's plants are remembered tile by tile (world/objects/growth.js: cache.tiles, each { level, list: [plants
// with x, z] }); the tiles round (x, z) are forgotten, so they're laid again from the ground as it is now (a camp's mown
// patch). A tile is known by where its plants are, so this keeps working whatever size the tiles are; an empty tile has
// nothing to mow. A cache of another shape is forgotten whole.
export function forgetPlants(V, x, z, r) {
  const c = V && V.COVER && V.COVER.cache; if (!c || !c.tiles) return;
  if (!(c.tiles instanceof Map)) { if (typeof c.tiles.clear === 'function') c.tiles.clear(); return; }
  for (const [k, e] of [...c.tiles]) { const p = e && e.list && e.list[0]; if (p && Math.hypot(p.x - x, p.z - z) < r + 45) c.tiles.delete(k); }
}
// ── THE LOOT'S SHAPES (made once, shared) ──────────────────────────────────────────────────────────────────────────
let PARTS = null;
function lootParts() {
  if (PARTS) return PARTS;
  // a burlap sack, tied at the top
  const prof = [[0, 0], [0.17, 0.01], [0.24, 0.08], [0.27, 0.22], [0.25, 0.36], [0.17, 0.46], [0.07, 0.52], [0.045, 0.56], [0.075, 0.61], [0.05, 0.64], [0, 0.65]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const sack = new THREE.LatheGeometry(prof, 10); sack.scale(1, 1, 0.82); sack.computeVertexNormals();
  // a strongbox: dark wood, iron bands round it, a brass lock plate
  const box = new THREE.BoxGeometry(0.56, 0.32, 0.36).translate(0, 0.16, 0);
  const bands = mergeGeometries([
    new THREE.BoxGeometry(0.05, 0.335, 0.375).translate(-0.17, 0.165, 0), new THREE.BoxGeometry(0.05, 0.335, 0.375).translate(0.17, 0.165, 0),
    new THREE.BoxGeometry(0.575, 0.04, 0.375).translate(0, 0.3, 0),
  ]);
  const lock = new THREE.BoxGeometry(0.1, 0.12, 0.02).translate(0, 0.2, 0.185);
  PARTS = {
    sack, box, bands, lock,
    burlap: new THREE.MeshStandardMaterial({ color: 0x9c8257, roughness: 1, metalness: 0 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.85, metalness: 0 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 0.55, metalness: 0.6 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb48a3c, roughness: 0.4, metalness: 0.7 }),
    canvas: new THREE.MeshStandardMaterial({ map: canvasCloth(), roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
    pole: new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 0.9, metalness: 0 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x7c7770, roughness: 0.95, metalness: 0 }),
    char: new THREE.MeshStandardMaterial({ color: 0x1e1a17, roughness: 1, metalness: 0 }),
  };
  return PARTS;
}

export function makeLootJob({ W, folk, animals, P, I, camera, canvas, rider, hud, hob = null, refresh = () => {}, voice = null, quiet = () => false, scene = W.scene, audio = null, town = null }) {
  if (!rider.topics || typeof rider.topics !== 'object') rider.topics = {};
  if (!rider.topics.loot || typeof rider.topics.loot !== 'object') rider.topics.loot = {};
  const Q = makeShares(rider.topics.loot);
  const S = rider.topics.loot;   // (Q.state: the ladder, and the trips handed back)
  const shadows = !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  const sh = W.places.sheriff;
  const LJ = { phase: 'out', active: false, near: false, canShare: false, people: [], paused: false, trainer: Q };

  // ── THE HAND-BACK SPOT IN FRONT OF THE SHERIFF'S OFFICE ──────────────────────────────────────────────────────────
  const rot = sh ? sh.rot : 0, door = sh ? sh.door : W.places.spawn;
  const out = { x: Math.sin(rot), z: Math.cos(rot) }, side = { x: Math.cos(rot), z: -Math.sin(rot) };
  const free = (x, z) => !W.blocked(x, z) && W.waterAt(x, z) < 0.25;
  const spot = (() => { for (const k of [LOOT.spot, LOOT.spot + 1.5, LOOT.spot - 1, LOOT.spot + 3]) { const x = door.x + out.x * k, z = door.z + out.z * k; if (free(x, z)) return { x, z }; } return { x: door.x + out.x * LOOT.spot, z: door.z + out.z * LOOT.spot }; })();
  // the folks' places: an arc between the spot and the door, facing the spot (the matron's at the end)
  function arcSpots(n) {
    const out2 = [], base = Math.atan2(door.x - spot.x, door.z - spot.z), span = Math.min(1.7, 0.42 * (n - 1));
    for (let i = 0; i < n; i++) {
      const a = base + (n > 1 ? -span / 2 + span * i / (n - 1) : 0);
      let x = spot.x + Math.sin(a) * LOOT.arc, z = spot.z + Math.cos(a) * LOOT.arc;
      if (!free(x, z)) { x = spot.x + Math.sin(a) * (LOOT.arc - 1); z = spot.z + Math.cos(a) * (LOOT.arc - 1); }
      out2.push({ x, z, face: Math.atan2(spot.x - x, spot.z - z) });
    }
    return out2;
  }

  // ── THE GANG'S CAMPS: the deputy's hideout and the back woods' camps ─────────────────────────────────────────────
  // Every camp with loot in it is a "stash": { kind: 'hideout' | 'woods', def: { id, x, z, name }, x, z, y, rot, root,
  // loot: [meshes that go when loaded], offBlock, unmow, at(lx, lz), guard, wantGuard, fire, found, emptied, area }
  let cacheN = Number.isInteger(S.cache) ? S.cache % CACHES.length : 0;
  let cache = null;          // the hideout the deputy sent the rider to (a stash), or null while word of the next is coming
  const stashes = [];        // every camp standing: the hideout and the back woods' camps
  function buildCache(def, { style = 'tent', kind = 'hideout', fire = false } = {}) {
    const L = lootParts(), C = crateParts();
    const sq = W.places.square || W.places.spawn;
    const r0 = Math.atan2(sq.x - def.x, sq.z - def.z);   // (its open side toward the town)
    const y0 = W.heightAt(def.x, def.z);
    const c = Math.cos(r0), s = Math.sin(r0);
    const world = (lx, lz) => ({ x: def.x + lx * c + lz * s, z: def.z - lx * s + lz * c });
    const lift = (lx, lz) => { const p = world(lx, lz); return W.heightAt(p.x, p.z) - y0; };
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const put = (geo, lx, lz, { y = 0, ry = 0, rx = 0, rz = 0, k = 1, ground = true } = {}) =>
      geo.clone().applyMatrix4(m.compose(v.set(lx, (ground ? lift(lx, lz) : 0) + y, lz), q.setFromEuler(e.set(rx, ry, rz)), sc.set(k, k, k)));
    const lists = { crate: [], sack: [], box: [], bands: [], lock: [], canvas: [], pole: [], stone: [], char: [] };
    const quad = (a, b, c, d, uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([...uv[0], ...uv[1], ...uv[2], ...uv[0], ...uv[2], ...uv[3]], 2));
      g.computeVertexNormals(); return g;
    };
    const pole = (a, b, r = 0.045) => {
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
      const g = new THREE.CylinderGeometry(r, r * 1.15, len, 6).translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize())); g.translate(A.x, A.y, A.z);
      return g;
    };
    const T = { half: 1.6, front: -0.7, back: -3.3, high: 1.75 };
    if (style === 'leanto') {
      // a lean-to: a canvas sheet from a pole across the front (on two posts) down to the ground at the back, open
      // toward the town, with a canvas end each side
      const front = -0.8, back = -3.4, half = 1.75, high = 1.9;
      const topY = Math.max(lift(-half, front), lift(half, front)) + high;
      lists.canvas.push(quad([-half, topY, front], [half, topY, front], [half, lift(half, back) + 0.03, back], [-half, lift(-half, back) + 0.03, back], [[0, 1], [1, 1], [1, 0], [0, 0]]));
      for (const sx of [-1, 1]) {   // (the ends: a triangle from the top of the post down to the back corner)
        const g = new THREE.BufferGeometry(), x = sx * (half - 0.02);
        g.setAttribute('position', new THREE.Float32BufferAttribute([x, topY - 0.02, front, x, lift(x, back) + 0.03, back, x, lift(x, front) + 0.02, front], 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 0, 0, 0], 2)); g.computeVertexNormals(); lists.canvas.push(g);
      }
      for (const sx of [-1, 1]) lists.pole.push(pole([sx * half, lift(sx * half, front), front], [sx * half, topY + 0.08, front], 0.05));
      lists.pole.push(pole([-half - 0.25, topY + 0.03, front], [half + 0.25, topY + 0.03, front], 0.045));
    } else {
      // a canvas tent, open toward the town: a ridge pole running back from the front on two A-frames, the canvas down
      // to the ground either side, a canvas back (so it's dark inside), the crates stacked in it and the sacks at its mouth
      const ridgeY = Math.max(lift(0, T.front), lift(0, T.back)) + T.high;
      for (const sx of [-1, 1]) {
        const x = sx * T.half, f = [x, lift(x, T.front) + 0.02, T.front], b = [x, lift(x, T.back) + 0.02, T.back];
        lists.canvas.push(quad(f, [0, ridgeY, T.front], [0, ridgeY, T.back], b, [[0, 0], [0, 1], [1, 1], [1, 0]]));
      }
      { const g = new THREE.BufferGeometry(); const l = [-T.half, lift(-T.half, T.back) + 0.02, T.back - 0.02], r = [T.half, lift(T.half, T.back) + 0.02, T.back - 0.02], t = [0, ridgeY, T.back - 0.02];
        g.setAttribute('position', new THREE.Float32BufferAttribute([...l, ...r, ...t], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2)); g.computeVertexNormals(); lists.canvas.push(g); }
      // the poles: an A-frame at the front and the back, and the ridge pole between
      for (const z of [T.front + 0.04, T.back - 0.06]) for (const sx of [-1, 1]) lists.pole.push(pole([sx * (T.half - 0.05), lift(sx * T.half, z), z], [sx * -0.06, ridgeY + 0.12, z]));
      lists.pole.push(pole([0, ridgeY + 0.04, T.front - 0.25], [0, ridgeY + 0.04, T.back + 0.1], 0.04));
    }
    // the crates inside: two side by side, one on top, one more by the door
    lists.crate.push(put(C.geometry, -0.6, -2.5, { ry: 0.08 }), put(C.geometry, 0.15, -2.6, { ry: -0.05 }), put(C.geometry, -0.25, -2.55, { y: C.size[1], ry: 0.3 }), put(C.geometry, 0.75, -1.5, { ry: 1.2 }));
    // the sacks, slumped together at the tent's mouth
    for (const [x, z, ry, k] of [[0.95, -0.35, 0.3, 1], [1.35, -0.05, 1.1, 0.92], [0.55, -0.85, 2.0, 1.05], [-1.15, -0.25, 0.6, 0.95], [-0.75, -1.3, 2.6, 0.88]]) lists.sack.push(put(L.sack, x, z, { ry, k, rz: (Math.random() - 0.5) * 0.15 }));
    // the strongbox, out in front where it was set down
    lists.box.push(put(L.box, -0.15, 0.25, { ry: 0.35 })); lists.bands.push(put(L.bands, -0.15, 0.25, { ry: 0.35 })); lists.lock.push(put(L.lock, -0.15, 0.25, { ry: 0.35 }));
    // a fire ring off to the side: stones round charred logs (a guard's fire burns in it: see below)
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; lists.stone.push(put(new THREE.DodecahedronGeometry(0.13, 0), 2.4 + Math.cos(a) * 0.5, 1.5 + Math.sin(a) * 0.5, { y: 0.05, ry: a * 1.7, k: 0.8 + ((i * 37) % 10) / 25 })); }
    for (const [ry, dx] of [[0.5, -0.05], [-0.6, 0.05]]) lists.char.push(put(new THREE.CylinderGeometry(0.06, 0.07, 0.75, 6).rotateZ(Math.PI / 2), 2.4 + dx, 1.5, { y: 0.07, ry }));
    lists.char.push(put(new THREE.CircleGeometry(0.42, 10).rotateX(-Math.PI / 2), 2.4, 1.5, { y: 0.025 }));
    const root = new THREE.Group(); root.name = kind === 'woods' ? 'gang-camp-' + def.id : 'gang-cache';
    root.position.set(def.x, y0, def.z); root.rotation.y = r0;
    const mats = { crate: C.material, sack: L.burlap, box: L.wood, bands: L.iron, lock: L.brass, canvas: L.canvas, pole: L.pole, stone: L.stone, char: L.char };
    const loot = [];
    for (const [k, list] of Object.entries(lists)) {
      if (!list.length) continue;
      const geo = list.length === 1 ? list[0] : mergeGeometries(list);
      for (const g of list) if (g !== geo) g.dispose();
      const mesh = new THREE.Mesh(geo, mats[k]); mesh.name = 'cache-' + k;
      mesh.castShadow = shadows && k !== 'char'; mesh.receiveShadow = shadows;
      root.add(mesh);
      if (['crate', 'sack', 'box', 'bands', 'lock'].includes(k)) loot.push(mesh);
    }
    scene.add(root);
    // the crates and the tent or lean-to block walkers (the loot is loaded from out front)
    const inside = (x, z) => { const dx = x - def.x, dz = z - def.z, lx = dx * c - dz * s, lz = dx * s + dz * c; return lx > -1.8 && lx < 1.8 && lz > -3.5 && lz < -0.5; };
    const offBlock = W.addBlocker ? W.addBlocker(inside) : () => {};
    // a guard's fire, burning in the ring (src/fire/campfire.js: drawn only near, no light added)
    let fl = null;
    if (fire) { const f = world(2.4, 1.5); try { fl = makeCampfire({ W, scene, camera, x: f.x, z: f.z, y: y0 + lift(2.4, 1.5) + 0.06, width: 0.7, audio, id: 'gangfire-' + def.id }); } catch (err) { console.warn('loot: the camp fire could not be lit', err); } }
    const st = { kind, def, x: def.x, z: def.z, y: y0, rot: r0, root, loot, offBlock, unmow: mow(def), at: world, guard: null, wantGuard: false, fire: fl, found: false, emptied: false, area: def.area || null, style, shown: true };
    stashes.push(st);
    return st;
  }
  // the meadow round a camp mown, as round the camps (src/camps.js): the old values come back when it goes. The plants
  // the meadow remembered there are forgotten, so they are laid again from the mown ground (only round the camp: the
  // rest of the valley's remembered plants stay as they are)
  function mow(def) {
    const V = W.V, T = V && V.TOWN;
    if (!T || !T.yard || !V.N || !V.TEX) return () => {};
    const N = V.N, TEX = V.TEX, SIZE = V.SIZE, old = new Map(), R = LOOT.mow + LOOT.mowFade + TEX;
    for (let j = Math.max(0, Math.floor((def.z - R + SIZE / 2) / TEX)); j <= Math.min(N - 1, Math.ceil((def.z + R + SIZE / 2) / TEX)); j++)
      for (let i = Math.max(0, Math.floor((def.x - R + SIZE / 2) / TEX)); i <= Math.min(N - 1, Math.ceil((def.x + R + SIZE / 2) / TEX)); i++) {
        const d = Math.hypot((i + 0.5) * TEX - SIZE / 2 - def.x, (j + 0.5) * TEX - SIZE / 2 - def.z);
        const t = Math.min(1, Math.max(0, (d - LOOT.mow) / LOOT.mowFade)), v = 1 - t * t * (3 - 2 * t);
        const k = j * N + i; if (v > T.yard[k]) { if (!old.has(k)) old.set(k, T.yard[k]); T.yard[k] = v; }
      }
    const forget = () => forgetPlants(V, def.x, def.z, R);
    forget();
    return () => { for (const [k, v] of old) T.yard[k] = v; forget(); };
  }
  function dropStash(st) {
    if (!st) return;
    dropGuard(st);
    if (st.fire) { try { st.fire.dispose(); } catch (e) { /* (gone) */ } st.fire = null; }
    st.offBlock(); st.unmow();
    st.root.removeFromParent();
    st.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    const i = stashes.indexOf(st); if (i >= 0) stashes.splice(i, 1);
    if (st === cache) cache = null;
  }
  function dropCache() { if (cache) dropStash(cache); }
  const hasLoot = (st) => !!st && !st.emptied;
  const stashName = (st) => (st.kind === 'woods' ? `a gang camp in ${AREAS[st.area] || 'the back woods'}` : st.def.name);

  // ── THE GUARD ──────────────────────────────────────────────────────────────────────────────────────────────────
  // Each camp has its own guard (st.guard): { r, state: 'stand' | 'flee' | 'throw' | 'caught' | 'down', tgt, home, t, st }
  let kit = null;
  loadRiderKit({ animals }).then((k) => { kit = k; }).catch((e) => console.warn('loot: the guard\'s horse could not load', e));
  const guards = () => stashes.map((st) => st.guard).filter(Boolean);
  function placeGuard(st = cache) {
    if (!kit || !st || st.guard) return false;
    let r;
    try { r = makeRider(kit, { W, folk, scene, shadows }); } catch (e) { console.warn('loot: no guard', e); return false; }
    const p = st.at(-3.4, 1.0);
    r.place(p.x, p.z, st.rot);
    st.guard = { r, st, state: 'stand', person: r.person, also: [r.horse.root], ring: r.ring, home: p, t: 0,
      tgt: { root: r.person.root, neck: (o) => r.neck(o), neckRadius: 0.13, height: 2.4 } };
    return true;
  }
  function dropGuard(st = cache) {
    if (!st || !st.guard) return;
    try { st.guard.r.dispose(); } catch (e) { /* (gone) */ }
    st.guard = null; tagEl.hidden = true;
  }
  const R = makeTargetRing({ scene, camera, canvas, W });
  let curTarget = null;
  function throwAt(g) {
    if (!g || !g.st || g.st.guard !== g || g.state !== 'stand' || LJ.paused) return false;
    const ok = P.throwLasso(g.tgt, {
      good: true, hold: 1.1, lead: false,
      onLand: () => { curTarget = null; },
      onCaught: () => {
        curTarget = null; g.state = 'caught';
        g.r.fall(P.position, { onDown: () => { g.state = 'down'; } });
        const e = earn(rider, LOOT.pay.guard);
        const rec = countJob(rider, 'bandits', 1);
        hud.toast(`Roped the gang's guard! +${LOOT.pay.guard} gold`, 'gold');
        if (rec.buckle) hud.buckle(rec.buckle, { delay: 900 });
        if (e && e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 1600);
        if (hob) hob.event('lootGuard', { at: () => ({ x: g.r.x, z: g.r.z }), male: /_m$/.test((g.r.look && g.r.look.outfit) || '') });
        refresh();
      },
      onMissed: () => { curTarget = null; },
      onCancel: () => { curTarget = null; if (g.state === 'throw') g.state = 'stand'; },
    });
    if (ok) { g.state = 'throw'; curTarget = g.tgt; }
    return ok;
  }
  const offPick = I.onPick((p) => {
    if (LJ.paused || !nearS || !nearS.guard || nearS.guard.state !== 'stand' || !LJ.near) return;
    const t = p.touch ? R.pick(p.x, p.y) : R.click(p.x, p.y);
    if (t) throwAt(t);
  });
  function guardStep(g, dt) {
    if (!g) return;
    const st = g.st, r = g.r, d = Math.hypot(P.position.x - r.x, P.position.z - r.z);
    if (g.state === 'stand' || g.state === 'throw') {
      // he sits his horse by the loot, turning to keep an eye on whoever rides up
      r.steer(d < 60 ? P.position.x : g.home.x + Math.sin(st.rot) * 5, d < 60 ? P.position.z : g.home.z + Math.cos(st.rot) * 5, 0, dt);
      const toLoot = Math.hypot(P.position.x - st.x, P.position.z - st.z);
      if (g.state === 'stand' && (d < LOOT.flee || toLoot < LOOT.load + 1)) {
        // ridden straight in: he lights out for the hills (no harm done)
        g.state = 'flee'; g.t = 0;
        const a = Math.atan2(r.x - P.position.x, r.z - P.position.z);
        g.away = { x: r.x + Math.sin(a) * 300, z: r.z + Math.cos(a) * 300 };
        hud.toast('The guard lit out for the hills!');
        if (hob) hob.event('lootFled');
      }
    } else if (g.state === 'flee') {
      g.t += dt;
      r.steer(g.away.x, g.away.z, 11, dt);
      if (g.t > 12 && d > 80) { dropGuard(st); return; }
    } else if (g.state === 'down' && d > LOOT.guardGone && !inView(r.x, r.z)) { dropGuard(st); return; }   // (taken away while no one's looking)
    r.update(dt);
  }
  const _v = new THREE.Vector3(), _f = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sph = new THREE.Sphere();
  // (r: how far round the spot the thing reaches, so one half in at the edge of the view counts as in it: a guard,
  // or a whole camp)
  function inView(x, z, r = 1.4) {
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _f.setFromProjectionMatrix(_pm);
    _sph.center.set(x, W.heightAt(x, z) + 1, z); _sph.radius = r;
    return _f.intersectsSphere(_sph);
  }

  // ── THE LOOT ON THE HORSE ────────────────────────────────────────────────────────────────────────────────────────
  // a holder on the horse's back bone (as the saddle hangs), with a sack hung each side over the hindquarters and the
  // strongbox on top behind the saddle: one bundle each, put away as each bundle is handed back
  const load = new THREE.Group(); load.name = 'loot-load';
  const bundles = (() => {
    const L = lootParts(), mk = (geo, mat) => { const o = new THREE.Mesh(geo, mat); o.castShadow = shadows; return o; };
    const sackR = new THREE.Group(), sackL = new THREE.Group(), chest = new THREE.Group();
    sackR.add(mk(L.sack, L.burlap)); sackL.add(mk(L.sack, L.burlap));
    chest.add(mk(L.box, L.wood), mk(L.bands, L.iron), mk(L.lock, L.brass));
    sackR.position.set(0.3, -0.52, -0.62); sackR.rotation.set(0, 0, 0.12); sackR.scale.setScalar(0.85);
    sackL.position.set(-0.3, -0.52, -0.62); sackL.rotation.set(0, 0, -0.12); sackL.scale.setScalar(0.85);
    chest.position.set(0, 0.06, -0.66); chest.scale.setScalar(0.8);
    for (const o of [sackR, sackL, chest]) { o.visible = false; load.add(o); }
    return [chest, sackR, sackL];
  })();
  let loadOn = null;
  const _hm = new THREE.Matrix4();
  function hangLoad() {
    const a = P.horse; if (!a || !a.info || !a.seatRest) return false;
    if (loadOn === a && load.parent) return true;
    const s = a.info.seat.at;
    _hm.makeTranslation(s[0], s[1], s[2]).premultiply(a.seatRest.clone().invert());
    _hm.decompose(load.position, load.quaternion, load.scale);
    // (the sacks and the strongbox keep their own size; where they hang from the seat grows with a bigger horse)
    const k = a.size || 1;
    for (const m of load.children) { if (!m.userData.at) m.userData.at = m.position.clone(); m.position.copy(m.userData.at).multiplyScalar(k); }
    a.bones[a.info.seat.bone].add(load);
    loadOn = a;
    return true;
  }
  function showBundles(n) { bundles.forEach((m, i) => { m.visible = i < Math.min(n, bundles.length); }); }

  // ── THE TRIP: which families, which bundles ──────────────────────────────────────────────────────────────────────
  let trip = null;   // { problems: [share], at, families: [family], clean, from (the camp it came from), loaded }
  function dealTrip(from = cache) {
    const fams = [...FAMILIES].sort(() => Math.random() - 0.5).slice(0, LOOT.families).map((f) => f.name);
    const first = !((S.trips || 0) + (S.woods || 0) > 0);
    const n = first ? LOOT.bundles[0] : LOOT.bundles[1];
    const problems = [];
    // (the rider's level on the loot ladder, src/levels/place/loot.js: every bundle of the trip is made at it)
    const q = levelFor(rider, 'loot');
    for (let i = 0; i < n; i++) problems.push(dealAt(q, { among: fams }));
    // who comes to the office: everyone a bundle goes back to, and the orphans' home's matron when there's a leftover for it
    const names = new Set(); for (const p of problems) for (const h of p.hand) names.add(h.family.name);
    const families = FAMILIES.filter((f) => names.has(f.name));
    if (problems.some((p) => p.orphans > 0)) families.push(MATRON);
    trip = { problems, at: 0, families, clean: true, stuffSaid: false, q, from, loaded: false };
    saveRider(rider);
  }

  // ── THE TOWNSFOLK WAITING AT THE OFFICE ────────────────────────────────────────────────────────────────────────
  const people = LJ.people;   // { who (a family or the matron), p, x, z, yaw, home: { x, z, face }, to, state, walking }
  function spawnFolks() {
    if (!trip || people.length) return;
    const places = arcSpots(trip.families.length);
    const sq = W.places.square || W.places.spawn;
    trip.families.forEach((f, i) => {
      // (the family's one is a townsperson, src/townpeople.js: already walking over when the loot was seen coming, else out
      // of the nearest door; given back when they go home)
      const T = town ? town() : null, got = T ? T.lend({ to: places[i], names: [f.rep] }) : null;
      if (got) { people.push({ who: f, p: got.p, x: got.x, z: got.z, yaw: got.yaw, home: places[i], to: places[i], state: 'come', walking: false, wait: 0, via: got.via, lent: got }); return; }
      let p;
      try { p = makePerson(folk, { ...f.look, skin: Math.floor(Math.random() * 8), hair: Math.floor(Math.random() * 11), shadows }); } catch (e) { console.warn('loot: a townsperson could not be made', e); return; }
      // in from the square, a few steps apart
      let x = sq.x + (Math.random() - 0.5) * 10, z = sq.z + (Math.random() - 0.5) * 10;
      if (!free(x, z)) { x = spot.x + side.x * (i - 3) * 2 + out.x * 8; z = spot.z + side.z * (i - 3) * 2 + out.z * 8; }
      const c = { who: f, p, x, z, yaw: 0, home: places[i], to: places[i], state: 'come', walking: false, wait: i * 0.5 };
      c.yaw = Math.atan2(c.to.x - x, c.to.z - z);
      p.root.position.set(x, W.heightAt(x, z), z); p.root.rotation.y = c.yaw;
      scene.add(p.root);
      people.push(c);
    });
  }
  function sendHome() {
    const sq = W.places.square || W.places.spawn;
    for (const c of [...people]) { if (c.lent && town && town()) { removePerson(c); continue; } c.state = 'go'; c.to = { x: sq.x + (Math.random() - 0.5) * 16, z: sq.z + (Math.random() - 0.5) * 16 }; c.walking = false; c.wait = Math.random() * 0.6; }
  }
  function removePerson(c) {
    // (a townsperson walks on about the town from where they stand: never removed)
    if (c.lent && town && town()) { c.lent.x = c.x; c.lent.z = c.z; c.lent.yaw = c.yaw; town().giveBack(c.lent); }
    else { c.p.root.removeFromParent(); try { c.p.dispose(); } catch (e) { /* (gone) */ } }
    const i = people.indexOf(c); if (i >= 0) people.splice(i, 1);
    if (bubble && bubble.c === c) hideBubble();
  }
  function personStep(c, dt) {
    if (c.wait > 0) { c.wait -= dt; c.p.update(dt); placePerson(c); return; }
    // (a townsperson's way here first: the points of the town's paths, then their place)
    while (c.via && c.via.length && Math.hypot(c.via[0].x - c.x, c.via[0].z - c.z) < 0.5) c.via.shift();
    const tg = c.via && c.via.length && c.state === 'come' ? c.via[0] : c.to;
    const dx = tg.x - c.x, dz = tg.z - c.z, d = Math.hypot(dx, dz);
    if (d > 0.06) {
      if (!c.walking) { c.walking = true; c.p.play('Walk', { fade: 0.25, speed: LOOT.walk / ((c.p.stride && c.p.stride.Walk) || 1.2) }); }   // (stride: m/s per clip, { Walk, Run })
      const st = Math.min(d, Math.min(LOOT.walk, d * 3) * dt);
      c.x += dx / d * st; c.z += dz / d * st;
      c.yaw += wrapA(Math.atan2(dx, dz) - c.yaw) * Math.min(1, dt * 7);
    } else {
      if (c.walking) { c.walking = false; c.p.play('Idle', { fade: 0.3 }); }
      if (c.state === 'go') { removePerson(c); return; }
      if (c.state === 'come') c.state = 'wait';
      if (c.state === 'take') { c.state = 'took'; c.t = 1.5; c.p.play('Interact', { fade: 0.2, once: true }); }
      else if (c.state === 'took') { if ((c.t -= dt) <= 0) { c.state = 'back'; c.to = c.home; } }
      else if (c.state === 'back') c.state = 'wait';
      const want = c.state === 'took' ? Math.atan2(P.position.x - c.x, P.position.z - c.z) : c.home.face;
      if (c.state === 'wait' || c.state === 'took') c.yaw += wrapA(want - c.yaw) * Math.min(1, dt * 5);
    }
    c.p.update(dt); placePerson(c);
  }
  function placePerson(c) { c.p.root.position.set(c.x, W.heightAt(c.x, c.z), c.z); c.p.root.rotation.y = c.yaw; }
  const byFamily = (f) => people.find((c) => c.who === f || c.who.name === f.name);

  // ── A SPEECH CARD OVER A TOWNSPERSON (the women speak only in these; the men have their recorded voice too) ─────────
  ensureCss();
  const box = document.createElement('div'); box.className = 'blt'; document.body.appendChild(box);
  const card = document.createElement('div'); card.className = 'blt-say'; card.hidden = true; box.appendChild(card);
  const tagEl = document.createElement('div'); tagEl.className = 'blt-tag'; tagEl.hidden = true; tagEl.innerHTML = '<b>Gang guard</b><small>rope him, or ride in</small>'; box.appendChild(tagEl);
  let bubble = null;   // { c, t }
  function say(c, text, { clip = null } = {}) {
    if (!c) return;
    bubble = { c, t: Math.max(2.8, 1.2 + text.length * 0.05) };
    card.innerHTML = `<b>${esc(c.who.rep)}</b><p>${esc(text)}</p>`; card.hidden = false;
    if (clip && voice && !c.who.she) voice(clip, { at: () => ({ x: c.x, z: c.z }), male: true, id: c.who.rep });
  }
  function hideBubble() { bubble = null; card.hidden = true; }
  const head = new THREE.Vector3();
  function overHead(obj, y, el) {
    head.copy(obj).setY(y); head.project(camera);
    if (head.z > 1 || Math.abs(head.x) > 1.05 || Math.abs(head.y) > 1.05) return false;
    const x = (head.x + 1) / 2 * innerWidth; let sy = (1 - head.y) / 2 * innerHeight;
    // (never up under the HUD's top band: the purse and the cards up top, on an upright phone above all; the tag stands
    // on its bottom edge, so it goes down to just under them)
    const floor = hudFloor(x, el.offsetWidth || 150), h = el.offsetHeight || 40;
    if (floor && sy - h < floor) sy = floor + h;
    el.style.left = `${x.toFixed(0)}px`; el.style.top = `${sy.toFixed(0)}px`;
    return true;
  }
  let purseEl = null;
  function hudFloor(x, w) {
    if (!purseEl || !purseEl.isConnected) purseEl = document.querySelector('.bmh-purse');
    let f = 0;
    for (const e of [purseEl, hud && hud.ruleEl, hud && hud.hintEl]) {
      if (!e || e.hidden || !e.offsetParent) continue;
      const q = e.getBoundingClientRect();
      if (q.height && q.top < innerHeight * 0.5 && q.right > x - w / 2 - 6 && q.left < x + w / 2 + 6) f = Math.max(f, q.bottom + 6);
    }
    return f;
  }

  // ── THE SLIP: SHARING IT OUT ───────────────────────────────────────────────────────────────────────────────────
  const U = makeStoreSlip(document.body, { onPick: (i) => pick(i), onDone: () => stopShare(), onDraw: () => draw() });
  let missed = false, helped = false, thinkT = 0, away = true, earned = 0;
  const from = () => U.el.querySelector('.bmo-from small'), foot = () => U.el.querySelector('.bmo-filled');
  let timer = null;
  function showProblem() {
    const p = trip.problems[trip.at];
    missed = false; helped = false; thinkT = 0;
    if (timer) timer.cancel();
    timer = answerTimer();
    // (the slip's header: the family, the two, or how many)
    const who = p.owners.length === 1 ? p.owners[0].name : p.owners.length === 2 ? `${p.owners[0].short} & ${p.owners[1].short}` : `${p.owners.length} families`;
    U.purse(rider.gold);
    // (a rider who can't read yet, skill.js readAloud: "Read it to me" on the slip, and the story read out as it comes)
    const young = readAloud(rider), slip = { who: { name: who }, story: p.story, ask: p.ask, coins: p.coins, equation: null, read: `${p.story} ${p.ask}` };
    U.show(slip, { filled: 0, read: young, lead: p.lead ? picture(p.lead) : null, note: trip.q && trip.q.placing ? 'finding your level' : '' });
    if (young) setTimeout(() => { if (LJ.active && trip && trip.problems[trip.at] === p && !U.busy) speakLine(slip.read); }, 500);
    const f = from(); if (f) f.textContent = 'Taken from';
    const ft = foot(); if (ft) ft.textContent = `Bundle ${trip.at + 1} of ${trip.problems.length}`;
  }
  LJ.share = () => {
    if (LJ.active || LJ.phase !== 'carrying' || !trip || trip.at >= trip.problems.length) return false;
    LJ.active = true; away = false;
    spawnFolks();
    showProblem();
    if (hob) hob.event('lootShare');
    return true;
  };
  function stopShare({ walked = false } = {}) {
    if (!LJ.active) return;
    LJ.active = false; U.hide();
    if (timer) { timer.cancel(); timer = null; }
    if (walked) hud.toast('The folks will wait for you');
  }
  async function pick(i) {
    if (!LJ.active || !trip || U.busy) return;
    const p = trip.problems[trip.at], c = p.coins[i]; if (!c) return;
    const res = Q.answer(p, c, { helped });
    let moved = 0;
    if (res.first) {
      const t = timer ? timer.stop() : {}; timer = null;
      // (a right pick after "Draw it" is paid but says nothing about the level: no place, no strands)
      const sk = helped && c.good ? null : { place: 'loot', level: p.level, sitDown: true, size: 1, ...(t || {}) };
      const rec = recordAnswer(rider, c.good, sk); if (rec && rec.badge) hud.toast(`You earned the ${rec.badge} badge!`, 'gold');
      // a fair share is a times fact worked backwards (24 shared by 4 families is 4 × 6): it goes on the times chart
      // like the deer's and the lock boxes' sharing (src/math/facts.js), right or missed
      if (sk) { const f = shareFact(p); if (f) { try { recordFact(rider, f.a, f.b, c.good); } catch (e) { console.warn(e); } } }
      // the level now: the bundles still to come are dealt again at the new level (from the same folks)
      const q = levelFor(rider, 'loot');
      moved = Math.sign(q.i - trip.q.i);
      const changed = q.id !== trip.q.id; trip.q = q;
      if (changed) redealRest(trip.at + 1);   // (the share on show stays as it is)
      if (moved > 0 && (q.placing || (rec && rec.level && rec.level.justPlaced))) moved = 0;   // ("Up a step!" once the level is found)
    }
    if (!c.good) {
      missed = true; trip.clean = false;
      U.wrong(i, { why: c.why, pic: picture(p.pic) });
      if (hob) hob.event('lootMiss');
      saveRider(rider);
      return;
    }
    // right: each family's one steps up for their share; the gold flies into the purse
    const gold = LOOT.pay.each + Math.floor(p.rung / LOOT.pay.everyStep) + (missed ? 0 : LOOT.pay.first);
    const before = rider.gold, e = earn(rider, gold); earned += gold;
    const rec = countJob(rider, 'loot', 1);
    if (rec.buckle) hud.buckle(rec.buckle, { delay: 900 });
    setTimeout(refresh, 700);
    if (hob) hob.event('lootRight');   // (his "pick again" from the last coin is done with)
    handOver(p);
    trip.at++;
    showBundles(trip.problems.length - trip.at);
    if (moved > 0) setTimeout(() => hud.toast('Up a step!', 'good'), 900);
    const news = e && e.newTitle ? [`You're a ${e.newTitle} now!`] : [];
    await U.right(i, { line: p.rightWhy, gold, from: before, to: rider.gold, note: missed ? '' : 'right first time', news, paid: `+${gold} gold from the deputy` });
    if (!LJ.active) { if (trip.at >= trip.problems.length) finishTrip(); return; }
    await U.leave();
    if (!LJ.active) { if (trip.at >= trip.problems.length) finishTrip(); return; }
    if (trip.at >= trip.problems.length) finishTrip(); else showProblem();
  }
  function draw() { if (!LJ.active || !trip || U.busy) return; helped = true; U.drawn(picture(trip.problems[trip.at].pic)); }
  // a bundle at the rider's level q (levelFor): made by the ladder's own maker (src/math/shares.js shareAt through the
  // trainer, which keeps the last few apart), and marked with the level it was made at (recordAnswer's level) and its
  // rung (how far up the ladder: the pay)
  function dealAt(q, opts) {
    const p = Q.nextAt(q.level.gen, opts);
    if (p) { p.level = q.id; p.rung = Math.max(0, q.i - LOOT.rungBase); }
    return p;
  }
  // When an answer moves the level, the bundles still to come are dealt again at the new level, from the same folks
  // waiting at the office, so every answer on a trip counts (not just the first). One that can't be made from them stays.
  function redealRest(from) {
    const names = trip.families.map((f) => f.name);
    for (let k = from; k < trip.problems.length; k++) { const q = dealAt(trip.q, { among: names, only: true }); if (q) trip.problems[k] = q; }
  }
  // the families (and the matron, for the orphans' home) step up and take their share, and one or two say thank you
  function handOver(p) {
    const takers = p.hand.filter((h) => h.gets > 0).map((h) => byFamily(h.family)).filter(Boolean);
    if (p.orphans > 0) { const pc = byFamily(MATRON); if (pc) takers.push(pc); }
    takers.forEach((c, k) => {
      const a = Math.atan2(c.x - spot.x, c.z - spot.z);
      const near = P.onHorse ? 2.3 : 1.5;   // (up to the rider: clear of the horse's flank when mounted)
      c.state = 'take'; c.to = { x: spot.x + Math.sin(a) * near, z: spot.z + Math.cos(a) * near }; c.walking = false; c.wait = 0.25 + k * 0.35;
    });
    // a man's thank-you in his own voice, and a woman's in a card (the matron's too)
    const man = takers.find((c) => !c.who.she && c.who !== MATRON), woman = takers.find((c) => c.who.she);
    const n = (trip.thanksN = (trip.thanksN || 0) + 1);
    const first = woman && (n % 2 === 0 || !man) ? woman : man || (p.orphans > 0 ? byFamily(MATRON) : null);
    if (first) setTimeout(() => { if (people.includes(first)) say(first, first.who === MATRON ? MATRON_THANKS[n % MATRON_THANKS.length] : (first.who.she ? WOMEN_THANKS : MEN_THANKS)[n % 4], { clip: 'thanks' }); }, 1300 + takers.indexOf(first) * 350);
  }
  function finishTrip() {
    if (!trip || LJ.phase !== 'carrying') return;
    const from = trip.from, woods = !!(from && from.kind === 'woods');
    const bonus = LOOT.pay.trip + (trip.clean ? LOOT.pay.clean : 0);
    const e = earn(rider, bonus); earned += bonus;
    // (a back-woods camp's trip is counted on its own: the checklist's hideouts are the deputy's, counted by S.trips)
    if (woods) S.woods = (S.woods || 0) + 1;
    else { S.trips = (S.trips || 0) + 1; S.cache = cacheN = (cacheN + 1) % CACHES.length; }
    saveRider(rider);
    stopShare();
    hud.toast(`Every family got back what was theirs! +${bonus} gold${trip.clean ? ' · all right first time' : ''}`, 'gold');
    if (e && e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 2200);
    if (hob) { hob.event('lootDone', { trips: S.trips, woods }); hob.event('lootWoodsTip'); }
    refresh();
    showBundles(0);
    setTimeout(() => { if (LJ.phase !== 'carrying') sendHome(); }, 3500);
    trip = null; away = true;
    // (the deputy's hideout handed back: word of the next one comes after a rest)
    if (!woods) { resting = true; restT = LOOT.rest; }
    setPhase();
  }
  let restT = 0, resting = false;
  // what the job is doing: the loot on the horse, else the deputy's hideout waiting, else word of the next one coming
  function setPhase() { LJ.phase = trip && trip.loaded ? 'carrying' : resting || !cache ? 'rest' : 'out'; }
  function nextCache() {
    dropCache();
    cache = buildCache(CACHES[cacheN]);
    cache.wantGuard = !(S.trips > 0) || Math.random() < LOOT.guardChance;   // (the first trip always has one: it's in the deputy's story)
    resting = false; cardKey = '';
    setPhase();
  }

  // ── THE BACK WOODS' CAMPS ──────────────────────────────────────────────────────────────────────────────────────
  let woodsT = 0, woodsN = 0, strikeT = 0;
  const recent = [];   // (the spots used lately: a new camp goes somewhere else)
  const camDist = (x, z) => Math.hypot(camera.position.x - x, camera.position.z - z);
  const unseen = (x, z) => camDist(x, z) > WOODS.far || !inView(x, z, 9);   // (a camp spreads some 8 m round its middle)
  // a new camp in the back woods: in the woods with the fewest camps, at a spot at random among those clear of the
  // other camps, well away from the player and out of sight
  function pitchWoods() {
    if (stashes.filter((st) => st.kind === 'woods' && !st.emptied).length >= WOODS.camps) return null;
    const b = pickSpot({ camps: stashes.map((st) => ({ x: st.x, z: st.z, area: st.kind === 'woods' ? st.area : null })), player: P.position, recent, unseen });
    if (!b) return null;
    const guarded = Math.random() < WOODS.guardChance;
    const st = buildCache({ id: 'w' + (++woodsN), x: b.x, z: b.z, area: b.area, name: AREAS[b.area] }, { kind: 'woods', style: Math.random() < WOODS.leanto ? 'leanto' : 'tent', fire: guarded });
    st.wantGuard = guarded; st.spot = b;
    recent.push(b); if (recent.length > 5) recent.shift();
    return st;
  }
  function woodsStep(dt) {
    // a camp emptied is struck once the player is well away and it's out of sight (its trip's loot is on the horse)
    if ((strikeT -= dt) <= 0) {
      strikeT = 1;
      for (const st of [...stashes]) if (st.kind === 'woods' && st.emptied && distTo(st) > WOODS.strike && unseen(st.x, st.z)) dropStash(st);
    }
    // and a new one is pitched elsewhere a while after (tried again each second until a spot is out of sight)
    if (woodsT > 0) woodsT -= dt;
    else if (stashes.filter((st) => st.kind === 'woods' && !st.emptied).length < WOODS.camps) { if (!pitchWoods()) woodsT = 1; }
  }

  // ── LOADING THE LOOT AT A CAMP ─────────────────────────────────────────────────────────────────────────────────
  let toldNoSaddle = false, toldWhistle = false, toldFull = false;
  function tryLoad() {
    const st = nearS, d = st ? distTo(st) : Infinity;
    if (d > LOOT.load + 8) { toldNoSaddle = false; toldWhistle = false; toldFull = false; }
    if (!st || d > LOOT.load) return false;
    const g = st.guard;
    if (g && (g.state === 'stand' || g.state === 'throw')) return false;   // (he runs as you come in: next frame)
    if (LJ.phase === 'carrying') { if (!toldFull) { toldFull = true; hud.toast("Your horse is loaded already: take this loot to the sheriff's office first, then come back for this"); } return false; }
    if (!P.canRide) { if (!toldNoSaddle) { toldNoSaddle = true; hud.toast("That's too much to carry by hand: you'll need a saddled horse", 'warn'); if (hob) hob.event('lootNoSaddle'); } return false; }
    const h = P.horse && P.horse.root.position;
    if (!h || Math.hypot(h.x - st.x, h.z - st.z) > LOOT.horseNear || !hangLoad()) { if (!toldWhistle) { toldWhistle = true; hud.toast('Whistle your horse over (H) to load the loot'); } return false; }
    for (const m of st.loot) m.visible = false;
    st.emptied = true;
    if (st.kind === 'woods') woodsT = WOODS.again[0] + Math.random() * (WOODS.again[1] - WOODS.again[0]);
    dealTrip(st);
    trip.loaded = true;
    showBundles(trip.problems.length);
    setPhase(); away = true; cardKey = ''; cardT = 0;   // (the card says so at once)
    hud.toast(`The gang's loot is on your horse: ${trip.problems.length} bundles to take back to town`, 'good');
    if (hob) hob.event('lootLoaded');
    return true;
  }

  // ── THE JOB CARD AND THE COMPASS ───────────────────────────────────────────────────────────────────────────────
  let cardKey = '', shownCard = false, cardT = 0;
  const distTo = (p) => Math.hypot(P.position.x - p.x, P.position.z - p.z);
  function cardNow() {
    if (LJ.active) return null;
    if (LJ.phase === 'carrying') {
      const d = distTo(spot);
      return { main: `The gang's loot: ${trip.problems.length - trip.at} bundle${trip.problems.length - trip.at === 1 ? '' : 's'} to hand back`, sub: d > 12 ? `Ride it to the sheriff's office: ${roundTo(d)} m ${way(P.position, spot)}` : 'Pull up in front of the folks waiting' };
    }
    if (nearS) {
      const g = nearS.guard && (nearS.guard.state === 'stand' || nearS.guard.state === 'throw');
      const main = nearS.kind === 'woods' ? `A gang camp in ${AREAS[nearS.area] || 'the back woods'}` : `The gang's cache: ${nearS.def.name}`;
      return { main, sub: g ? 'A guard sits his horse by it: rope him, or ride straight in' : 'Ride in close to load the loot on your horse' };
    }
    return null;
  }
  function showCard() {
    // (while the slip is up this job keeps the card's place, empty: the slip says it all, and no other job's card comes up)
    if (LJ.active) { if (shownCard) hud.rule(null); shownCard = false; cardKey = ''; LJ.card = true; return; }
    const q = quiet(), c = q ? null : cardNow();
    if (!c) { if (shownCard && !q) hud.rule(null); shownCard = false; cardKey = ''; LJ.card = false; return; }
    LJ.card = true;
    const key = c.main + '|' + c.sub;
    if (key === cardKey && shownCard) return;
    cardKey = key; shownCard = true;
    hud.rule({ kind: 'travel', main: c.main, sub: c.sub });
  }
  LJ.card = false;
  // the compass: the sheriff's office with the loot on; else the camp the player is at, the deputy's hideout, and the
  // back woods' camps found and not yet looted (the first of them is where the trail leads)
  const markOf = (st) => ({ id: st === cache ? 'loot' : 'loot-' + st.def.id, icon: 'job', x: st.x, z: st.z, label: st.kind === 'woods' ? `A gang camp in ${AREAS[st.area] || 'the back woods'}` : "The gang's cache" });
  // the folks this trip's loot is for (their townsperson's names) and where they wait, while it is on its way: the town
  // sends them over as the loot is seen coming (src/townpeople.js expect)
  // the slip's sum for the tools' Work it out (src/math/jobsums.js): the bundle's share, picked from "What do we work
  // out?" (a share by a rule: none)
  LJ.workSum = () => (LJ.active && trip && trip.problems[trip.at] ? lootSum(trip.problems[trip.at]) : null);
  LJ.wanted = () => (LJ.phase === 'carrying' && trip && !people.length ? { names: trip.families.map((f) => f.rep), at: spot } : null);
  LJ.marks = () => {
    if (LJ.phase === 'carrying') return [{ id: 'loot', icon: 'job', x: spot.x, z: spot.z, label: "The sheriff's office: hand back the loot" }];
    const out = [];
    if (nearS) out.push(markOf(nearS));
    if (cache && hasLoot(cache) && !resting && cache !== nearS) out.push(markOf(cache));
    for (const st of stashes) if (st.kind === 'woods' && st.found && hasLoot(st) && st !== nearS) out.push(markOf(st));
    return out;
  };
  // the nearest camp with loot still in it, found or not (the jobs board's tracks lead there)
  LJ.nearestLoot = (at = P.position) => {
    let best = null, bd = Infinity;
    for (const st of stashes) { if (!hasLoot(st) || (st === cache && resting)) continue; const d = Math.hypot(at.x - st.x, at.z - st.z); if (d < bd) { bd = d; best = st; } }
    return best ? { x: best.x, z: best.z, id: st0id(best), name: stashName(best) } : null;
  };
  const st0id = (st) => (st === cache ? 'loot' : 'loot-' + st.def.id);

  // ── EACH FRAME ─────────────────────────────────────────────────────────────────────────────────────────────────
  let nearS = null;   // the camp with loot the player is at (within LOOT.near), or null
  LJ.update = (dt) => {
    if (resting && (restT -= dt) <= 0) {
      nextCache();
      if (hob) hob.event('lootWord', { place: cache.def.name });
    }
    woodsStep(dt);
    fireT += dt;
    // the nearest camp with loot in it, within reach of its card
    nearS = null; { let bd = LOOT.near; for (const st of stashes) { if (!hasLoot(st)) continue; const d = distTo(st); if (d < bd) { bd = d; nearS = st; } } }
    LJ.near = !!nearS && LJ.phase !== 'carrying';
    for (const st of stashes) {
      const d = distTo(st), cd = camDist(st.x, st.z);
      // (far off a camp isn't drawn, nor its guard: a speck in the haze among the trees)
      const show = cd < WOODS.far;
      if (show !== st.shown) { st.shown = show; st.root.visible = show; if (st.guard && st.guard.r.show) st.guard.r.show(show); }
      // a back-woods camp is found when the player rides near it: on the compass from then on, till it's looted
      if (st.kind === 'woods' && !st.found && d < WOODS.found) { st.found = true; if (hob) hob.event('lootCamp', { place: AREAS[st.area] }); }
      // the guard: placed once the riders' kit is in, when the player comes near; a back-woods guard still on watch
      // is put away again when the player is far off and he's out of sight (he's there again on the way back)
      const near = st.kind === 'woods' ? WOODS.guardNear : 180;
      if (st.wantGuard && !st.guard && kit && !st.emptied && d < near) { st.wantGuard = false; placeGuard(st); if (st.guard && st.guard.r.show) st.guard.r.show(st.shown); }
      else if (st.kind === 'woods' && st.guard && st.guard.state === 'stand' && d > WOODS.guardGone && unseen(st.guard.r.x, st.guard.r.z)) { dropGuard(st); st.wantGuard = true; }
      if (st.fire) st.fire.update(dt, fireT);
    }
    for (const g of guards()) guardStep(g, dt);
    const ng = nearS && nearS.guard;
    if (ng && ng.state === 'stand' && I.enabled && P.enabled && (I.tap('KeyF') || (!P.onHorse && I.tap('Space')))) throwAt(R.target);
    const ringOn = !!(ng && (ng.state === 'stand' || ng.state === 'throw') && distTo(ng.r) < LOOT.ropeNear);
    R.update(dt, { targets: ringOn ? [ng] : [], player: P, can: (t) => t.state === 'stand', hold: P.lassoBusy, busy: P.lasso.busy });
    // the guard's tag over his hat while he's there to be roped
    if (ringOn && overHead(ng.r.person.root.position, ng.r.top() + 0.35, tagEl)) tagEl.hidden = false; else tagEl.hidden = true;
    tryLoad();
    // keep the load on the horse (a horse bought or swapped on the way carries it on)
    if (LJ.phase === 'carrying' && P.horse && loadOn !== P.horse) { hangLoad(); showBundles(trip.problems.length - trip.at); }
    // the folks at the sheriff's office: out to wait when the loot comes to town, home when it goes off again
    const toSpot = distTo(spot);
    LJ.canShare = LJ.phase === 'carrying' && !LJ.active && toSpot < 9;
    if (LJ.phase === 'carrying') {
      if (toSpot < LOOT.town) spawnFolks();
      else if (toSpot > LOOT.townGone && people.length && !LJ.active) sendHome();
      // one of them sees his goods coming
      // (a man says it in his own voice when there's one among them: the first to have walked up, or else, once they're
      // all there, a woman says it in a card)
      if (trip && !trip.stuffSaid && people.length && toSpot < LOOT.stuff + LOOT.arc) {
        const waiting = people.filter((c) => c.state === 'wait');
        const man = waiting.find((c) => !c.who.she && c.who !== MATRON);
        const any = man || (waiting.length === people.length || !people.some((c) => !c.who.she && c.who !== MATRON) ? waiting[0] : null);
        if (any) { trip.stuffSaid = true; say(any, man ? 'Is that my stuff?' : 'Are those our things?', { clip: man ? 'mystuff' : null }); }
      }
      if (toSpot > LOOT.again) away = true;
      if (!LJ.active && away && toSpot < LOOT.share && Math.abs(P.speed || 0) < LOOT.shareSlow && P.enabled) LJ.share();
    }
    if (LJ.active) {
      if (toSpot > LOOT.leave) stopShare({ walked: true });
      // the "Draw it for me" button after a long think (a wrong pick shows the picture by itself)
      else if (!missed && !helped && !U.busy && (thinkT += dt) > 12) { U.offerDraw(true); thinkT = -1e9; }
    }
    for (const c of [...people]) personStep(c, dt);
    // the speech card over whoever is talking
    if (bubble) {
      if ((bubble.t -= dt) <= 0 || !people.includes(bubble.c)) hideBubble();
      else { const b = bubble.c.p.bones && bubble.c.p.bones.Head; if (b) b.getWorldPosition(_v); else _v.set(bubble.c.x, W.heightAt(bubble.c.x, bubble.c.z) + 1.8, bubble.c.z); card.hidden = !overHead(_v, _v.y + 0.55, card); }
    }
    if ((cardT -= dt) <= 0 || !shownCard) { cardT = 0.5; showCard(); }
  };
  let fireT = 0;
  Object.defineProperty(LJ, 'paused', {
    get() { return paused; },
    set(on) { paused = !!on; R.visible = !paused; if (paused) { tagEl.hidden = true; card.hidden = true; } },
  });
  let paused = false;

  // Esc is "Done for now" while the slip is up (unless a panel over it wants it)
  const onKey = (e) => {
    if (e.key !== 'Escape' || !LJ.active || e.defaultPrevented || e.repeat) return;
    if (document.querySelector('.bms, .lbx, .bml:not(.is-out), .tch:not(.out)')) return;   // (a panel, or a tool: Work it out, the times chart)
    e.preventDefault(); stopShare();
  };
  addEventListener('keydown', onKey, true);

  // ── FOR RIGS ───────────────────────────────────────────────────────────────────────────────────────────────────
  const guardOf = (g) => (g ? { state: g.state, x: +g.r.x.toFixed(1), z: +g.r.z.toFixed(1), ringed: R.target === g } : null);
  const woodsList = () => stashes.filter((st) => st.kind === 'woods').map((st) => ({ id: st.def.id, x: st.x, z: st.z, area: st.area, style: st.style, found: st.found, loot: !st.emptied, shown: st.shown, guard: guardOf(st.guard), wantGuard: st.wantGuard, fire: !!st.fire, burning: !!(st.fire && st.fire.burning) }));
  Object.defineProperty(LJ, 'woods', { get: woodsList });
  LJ.state = () => ({
    phase: LJ.phase, active: LJ.active, near: LJ.near, card: LJ.card, cache: cache ? { id: cache.def.id, x: cache.x, z: cache.z, name: cache.def.name, loot: cache.loot.some((m) => m.visible) } : null,
    guard: guardOf(cache && cache.guard), wantGuard: !!(cache && cache.wantGuard), at: nearS ? st0id(nearS) : null, woods: woodsList(), from: trip && trip.from ? st0id(trip.from) : null,
    trip: trip ? { at: trip.at, of: trip.problems.length, clean: trip.clean, problem: trip.problems[trip.at] ? { kind: trip.problems[trip.at].kind, step: trip.problems[trip.at].step, story: trip.problems[trip.at].story, ask: trip.problems[trip.at].ask, coins: trip.problems[trip.at].coins.map((c) => ({ label: c.label, good: c.good, slip: c.slip })) } : null } : null,
    spot: { x: +spot.x.toFixed(2), z: +spot.z.toFixed(2) }, people: people.map((c) => ({ who: c.who.rep, state: c.state, x: +c.x.toFixed(1), z: +c.z.toFixed(1) })),
    bundles: bundles.filter((m) => m.visible).length, onHorse: !!load.parent, level: trip && trip.q ? { id: trip.q.id, i: trip.q.i, placing: trip.q.placing } : null, trips: S.trips || 0, woodsTrips: S.woods || 0, busy: U.busy, earned,
    talking: bubble ? { who: bubble.c.who.rep, text: card.textContent } : null,
  });
  const facing = (st) => { const p = st.at(0, 16); return { x: p.x, z: p.z, rot: st.rot + Math.PI }; };
  LJ.dev = {
    // beside the cache, facing it (on the town's side)
    at: () => (cache ? facing(cache) : null),
    // the hand-back spot, facing the waiting folks
    town: () => ({ x: spot.x + out.x * 5, z: spot.z + out.z * 5, rot: rot + Math.PI }),
    load: () => { if (LJ.phase === 'carrying' || !cache || cache.emptied) return false; const g = cache.guard; if (g && g.state === 'stand') { g.state = 'flee'; g.t = 12; g.away = { x: g.r.x + 300, z: g.r.z }; } const h = P.horse; if (h && P.canRide) { const p = cache.at(0, 3); P.teleport(p.x, p.z, cache.rot + Math.PI); } return true; },
    guard: () => { if (!cache || cache.guard) return false; cache.wantGuard = false; return placeGuard(cache); },
    // (rigs) the cache moved to hideout i, as if the trips had come round to it
    cache: (i) => { if (LJ.phase === 'carrying') return false; cacheN = ((i % CACHES.length) + CACHES.length) % CACHES.length; nextCache(); return true; },
    // (rigs) 16 m in front of back-woods camp i (of those standing), facing it
    woods: (i = 0) => { const w = stashes.filter((st) => st.kind === 'woods'); const st = w[((i % w.length) + w.length) % w.length]; return st ? facing(st) : null; },
    // (rigs) pitch up to n more camps now (out of sight, away from the player), as if their time had come
    pitch: (n = 1) => { let k = 0; for (let i = 0; i < n; i++) { const save = WOODS.camps; WOODS.camps = Math.max(save, stashes.filter((st) => st.kind === 'woods' && !st.emptied).length + 1); if (pitchWoods()) k++; WOODS.camps = save; } return k; },
  };
  Object.defineProperty(LJ, 'cache', { get: () => cache });

  LJ.dispose = () => {
    stopShare();
    removeEventListener('keydown', onKey, true);
    offPick(); R.dispose();
    for (const st of [...stashes]) dropStash(st);
    for (const c of [...people]) removePerson(c);
    load.removeFromParent();
    U.dispose(); box.remove();
    if (shownCard) hud.rule(null);
  };

  // the first cache (or the one a ride left off at): a trip's loot already handed back moves on to the next; and the
  // back woods' camps, pitched while the ride starts (the player is in town, far from them all)
  nextCache();
  for (let i = 0; i < WOODS.camps; i++) pitchWoods();
  return LJ;
}

let css = false;
function ensureCss() {
  if (css || typeof document === 'undefined') return; css = true;
  const s = document.createElement('style'); s.dataset.loot = '1';
  s.textContent = `
.blt { position: fixed; inset: 0; z-index: 14; pointer-events: none; font: 500 15px/1.35 Bitter, Georgia, serif; }
.blt-say { position: absolute; transform: translate(-50%, -100%); width: max-content; max-width: min(300px, calc(100vw - 24px)); padding: 8px 12px 9px; border-radius: 10px;
  background: #f6edd6; color: #2b2219; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.42), inset 0 0 0 2px rgba(122, 85, 48, 0.3); }
.blt-say::after { content: ''; position: absolute; left: 50%; bottom: -9px; margin-left: -9px; border: 9px solid transparent; border-bottom: 0; border-top-color: #f6edd6; }
.blt-say b { display: block; font: 700 13px Bitter, Georgia, serif; color: #7a5530; margin-bottom: 2px; }
.blt-say p { margin: 0; font: 500 16px/1.3 Bitter, Georgia, serif; }
.blt-tag { position: absolute; transform: translate(-50%, -100%); padding: 3px 9px 4px; border-radius: 7px; white-space: nowrap; text-align: center;
  background: rgba(30, 20, 12, 0.72); border: 1px solid rgba(226, 173, 76, 0.4); color: #f4e8cf; line-height: 1.15; }
.blt-tag b { display: block; font: 700 14px Bitter, Georgia, serif; }
.blt-tag small { display: block; font: 500 11px Bitter, Georgia, serif; color: #dccaa5; }
@media (max-width: 600px) { .blt-say p { font-size: 15px; } }
`;
  document.head.appendChild(s);
}
