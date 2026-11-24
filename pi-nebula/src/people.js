// THE PEOPLE in the station, going about their day (life.js: who they are and what they do), each built with the crew
// kit from its recipe, drawn only while the room they are in is drawn and they are in front of the camera.
//
//   const people = await makePeople({ W, walls, lib, jobs, boarding, crane, say, crew })
//   people.update(dt, { player, camera, now })   everyone's day goes on; whoever is drawn moves; the friendly bits
//   people.list    [{ id, name, c, pos, heading, walking, away, ... }]    people.missing  the spots the station has no name for
//   people.eyes()  where the people on the move are (the station's doors open for them; the crane stops for them)
//   people.onWays(out)  pushes anyone standing on a parked ship's way in (it waits for them; people never call a ship's
//                  way down: they do not board yet)
//   people.noGo(x, z)   a patch of floor no person goes onto (job spots, ships' ways in, under the crane, the scanner)
//   people.flee(x, z, r)  anyone within r of a point hurries off (the crane by hand, a load low over them); with
//                  { inside(pos) }: anyone on a patch of any shape (under a ship coming down by hand: src/flying.js)
//   people.runAbout(hangar, { avoid })  everyone on that hangar's floor kept running about it (the alarm when the Miner
//                  is flown into another ship's hangar, src/visit.js: "people started running around")
//   people.update's `focus`: the nearest people are counted from there instead of from the player on their feet (the
//                  ship they are flying about the station)
//   people.captain.meet(id, where)  a captain gone to wait by their ship (MEET, below); meet(id, null): no longer
//   (the patches kept off, the ways and the spots all follow a ship that stands somewhere else than it is parked, set
//   down by hand: they are marked and worked out again whenever boarding.stands changes)
//   people.alarms  the loud alarms, counted as they happen: stuck (over 3 s with a way to go), inWall, inPerson (deeper
//                  than the bodies' outer halves), onPatch
//   people.plan()  everyone's spots and ways, for the plan from above (the rigs)
//   people.update's `place` and `soon` (src/lift.js crewAt, here): the people who work in the control room or in
//                  Cargo (life.js ROOM_CREW) are about only while `place` is theirs; `soon`: the player is in the lift,
//                  so they are made now if they are not yet (THE PLACES ONLY THE LIFT GOES TO, below)
//   people.add(recipe, spot, heading) / people.remove(P)   one more person standing (the cost test)
//   people.ward    THE RESCUED IN THE WARD after a rescue run (THE WARD, below; src/wardplan.js): ward.admit(list) as the
//                  run ends at home, ward.state(), ward.beds; those with no bed go to the big scanner or are about the
//                  station for their while, as its own people are (THE OTHERS, there)
//   people.bubbles, people.say(P, words)   the chat bubbles (bubbles.js)
//   resolve(W, walls, at) -> { pos, heading } | null                where a spot in spots.js is, by the station's names
//
// A SMALL STATION (2026-11-16; the game's maker: "Just having 4-8 people around seems plenty"): everyone in the roster
// lives aboard, but only the nearest NEAR[quality] (life.js) are about at once (PRESENCE): the rest go on with their day
// out of the way (not drawn, nobody's way blocked by them) and come back as the player comes near, always somewhere the
// player cannot see at that moment (their room not drawn, or out of the camera's view and a few metres off); two people
// talking, or a medic and a patient at the scanner, come and go together.
// FRIENDLY (the game's maker: "I like the eyes looking and I think a small smile would be good... Just chat bubbles
// saying 'Hi' and 'Hello' are good"): within a few metres of the player people look at them (eyes and head), smile a
// little more, and say hello in a bubble as the player passes, their very first hello spoken in their own voice
// (voices.js, quietly, from where they stand). A CAPTAIN (a yellow marker over their head) stops and offers the player
// a place on their crew: who they are and what for, and the question at the bottom of the screen (missions.js gets the
// answer). A CONTRACT SIGNED, the captain says so and walks to their ship to wait by its way in (MEET below; the game's
// maker, 2026-11-18: "once you agree to a contract with the captain then they will say "Glad to have you, I will meet
// you at the ship". Then they will start walking to the ship and wait by the door. You can walk with them or run there
// and get in the pilots seat or go eat a burrito and then go meet them"). TWO TALKING (at a talking spot, or side by side at a table) share a conversation from the line bank in
// bubbles over their heads (chatter.js, lines.js, news.js), the speaker's hands moving, the listener nodding, both
// shifting their weight (moves.js). THE BIG SCANNER glides only with someone on its bed: now and then a patient comes
// with a medic, lies down on it, and is scanned (SCAN below).
//
// HOW THEY GET ABOUT
// - A way is worked out a little at a time (walls.plan: LIFE.planMs a frame for everyone together, taking turns, at most
//   LIFE.planMost of work for one way), never across a patch they keep off (noGo: a quarter-metre map of the floor) nor
//   within LIFE.keepFrom of anyone standing or sitting still; while it is worked out they stay as they were.
// - Walking, they keep clear of each other and of the player: met head on by someone walking the other way (or by the
//   player coming at them), each keeps to their own right and they pass (passing.js passBy: the game's maker, 2026-11-20,
//   "If everyone walked toward the right side then they should be able to pass eachother"); someone standing in their
//   lane, or walking on ahead of them, is passed on the side away from them. They never step to within LIFE.body of
//   anyone (passing.js PASS.apart: the body itself, small enough that two get by each other shoulder past shoulder
//   wherever the floor leaves room for two, never through each other; it was 0.6 m). Held up by someone
//   standing still or by a corner, the way is worked out again round them at once; by someone standing where they were
//   going, somewhere else instead; two walkers holding each other up: the one later in the roster makes way (a step
//   aside or back, a wait till the other has gone by). Held LIFE.giveUp seconds in all, the errand is given up.
// - Out of sight (their room not drawn, behind the camera, or past the nearest LIFE.drawn[quality]) their body is out
//   of the scene altogether and their day goes on six frames at a time. In sight, their clips are played every frame
//   near, every other frame or every fourth further off, their eyes are drawn only close up, and beyond a few metres
//   (on Low always) they are drawn with the crew kit's far copy (kit/crew.js THE FAR COPY: about 11,000 triangles a
//   person where the whole one is about 25,000).
import * as THREE from 'three';
import { makeCrew } from '../kit/crew.js';
import { expand, zonesOf, setDoors } from '../kit/layout.js';
import { PIECES } from '../kit/catalog.js';
import { placeMatrix, WALL_FACE } from '../kit/grid.js';
import { NEAR, SPOTS, TALKS, APART, SEATS, CLIPS, ROSTER, ROOM_CREW, SCAN_BED, lookRecipe } from './life.js';
import { placeOf, STOPS } from './liftrules.js';
import { TOWER, STORE } from '../kit/places-plan.js';
import { pointGap } from '../kit/forkliftround.js';
import { MOVES_ON, MOVES_OFF, SECS as BED_SECS, pose as onBedPose } from './onbed.js';
import { STAND, shine } from './player.js';
import { PASS, passBy, bumps, facing, overlaps, roomAt, roomFor, sideOn } from './passing.js';
import { addMoves, bedPose } from './moves.js';
import { sleeperRecipe } from './sleeper.js';
import { WARD, WARD_BED, bedFor, bedNumber, bedSide, assign, stayFor, watching, kept, ABOUT, ABOUT_DAY, SCAN_WAIT, SCAN_STEP, othersDo, startOf } from './wardplan.js';
import { makeBubbles } from './bubbles.js';
import { pickTalk } from './chatter.js';
import { HELLOS, AGAIN, CAPTAINS, SCAN_TALK, NUDGES } from './lines.js';
import { VOICES, CLIPS as VOICE_CLIPS, clipUrl } from './voices.js';
import { sound } from './sound.js';
import { missions } from './missions.js';
import { news } from './news.js';

const SEEN = 46;        // people further than this from the camera are not drawn (m)
// how they walk: m/s (each their own within it), the turn (radians a second), how close to anyone they ever come (m,
// middle to middle: passing.js PASS.apart, the one size of a body against another for everyone, the player too), who
// counts as in their lane ahead (m ahead, m to the side), how long a wait before stepping aside, working the way out
// again, and giving up (s); how long a planned way may take each frame, for everyone (ms)
export const LIFE = {
  speed: [1.05, 1.35], turn: 3, body: PASS.apart, keepFrom: 0.75, lane: PASS.lane, sidestep: 1.0, replan: 2.0, stillWait: 0.8, replanEvery: 1.5, giveUp: 7,
  clear: 0.26,          // (m: a person's middle never nearer a machine's outline, Cargo's forklift's: their whole body off it, as the
                        // walls keep it off any furniture, walls.move(..., 0.26); its forks lie too low for the walls to feel)
  planMs: 2.5, planMost: 250, sit: 0.7, room: 0.75,     // (room: no two spots anyone has are nearer than this, m)
  near: 12, mid: 24,    // m from the camera: clips played every frame nearer, every other frame to `mid`, every fourth beyond
  drawn: { low: 8, medium: 12, high: 20 },   // the most drawn at once, the nearest (?drawn=N for the cost rigs)
  eyes: 7,              // m from the camera beyond which the eyes are not drawn
  far: { low: 0, medium: 5, high: 7 },        // m from the camera beyond which a person is drawn with the far copy (?far=N)
  stuck: 3,             // s with a way to go and nothing gained: a loud alarm (counted)
  camClear: 0.65,       // m: someone this near the camera (across the floor, and not well below it) is not drawn
  talkRoom: 1.8,        // m kept clear round two people talking: no other spot taken that near
};
// PRESENCE: how often the nearest are counted (s); how long someone has to be past the nearest before they go (s); how far
// from the player someone comes back or goes, at least (m)
export const PRESENCE = { every: 0.5, linger: 2, come: 4, go: 6 };
// FRIENDLY: how near the player someone says hello (m), and not again for `again` seconds; a voice at most once in
// `voiceGap` seconds anywhere (so a room full of people does not all speak at once), hellos at most one in `gap`; the
// smile while the player is near (the crew kit's smile slider: worn at 0.67 as made); a captain's offer: how near (m),
// how near they step up to the player first (m), how long they wait for an answer before a friendly word (s), how far
// the player goes before it is left (m), how long before it is made again (s)
export const FRIENDLY = { hello: 3.3, again: 80, gap: 2, voiceGap: 1.6, voice: 0.6, look: 4, smile: 1, offer: 3.6, near: 2.1, nudge: 11, leave: 6, offerAgain: 45, answered: 90 };
// the patches nobody stands on or walks across: a job spot's ring (its middle, m), a parked ship's way in (its patch of
// floor when down, m wider), under the crane's loads (each patch it works over, m wider: its own margin and more), the
// big scanner's rails (its box, m wider)
export const KEEP_OFF = { job: 0.8, way: 0.6, crane: 1.3, glide: 0.4, margin: 0.3 };

const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (L) => L[Math.floor(Math.random() * L.length)];
const ease = (t) => t * t * (3 - 2 * t);

// ── where a spot is, by name ───────────────────────────────────────────────────────────────────────────────────
// every placed piece in the station, once: { piece, variant, room (id), M (its world placement) }
export function piecesOf(R) {
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
  if (at.place) { const p = placeAt(W, at.place, at.n); return p ? [{ p, heading: at.face ? Math.atan2(at.face[0], at.face[1]) : null }] : []; }
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

// THE CAPTAINS' MARKER (the game's maker: "I'd be fine with them having a yellow marker above them (a captain symbol or
// something) to easily tell that they are a captain looking for help"): a yellow four-pointed star in a ring, as on the
// captains' own uniforms, floating over the head and bobbing gently; hidden by walls like anything else
// (its size, how far over the head, its bob, metres; how near the camera it may come before it is hidden (m); a
// captain's bubble sits over it, `bubble` higher than anyone else's)
const MARK = { size: 0.3, over: 0.55, bob: 0.03, near: 2.4, bubble: 0.5 };
const MARKER = (() => {
  const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d'), c = s / 2;
  const glow = g.createRadialGradient(c, c, s * 0.2, c, c, s * 0.5); glow.addColorStop(0, 'rgba(10,12,16,0.55)'); glow.addColorStop(1, 'rgba(10,12,16,0)');
  g.fillStyle = glow; g.fillRect(0, 0, s, s);
  g.lineWidth = 7; g.strokeStyle = '#ffc83c'; g.beginPath(); g.arc(c, c, s * 0.38, 0, Math.PI * 2); g.stroke();
  const star = (r1, r2) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, r = i % 2 ? r2 : r1; g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); } g.closePath(); };
  star(s * 0.3, s * 0.1); g.fillStyle = '#ffd34d'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#7a5300'; g.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
})();

export async function makePeople({ W, walls, lib, jobs = null, boarding = null, crane = null, say = () => {}, crew = () => null, rides = {} }) {
  const pieces = piecesOf(W.R), list = [], missing = [];
  // (a look, by name or its own, as its crew wears it: life.js lookRecipe; who: the person's roster entry)
  const recipeOf = (r, who = null) => lookRecipe(r, who, lib);
  const alarms = { stuck: 0, inWall: 0, inPerson: 0, onPatch: 0, planFailed: 0, gaveUp: 0, seen: {} };
  const alarm = (k, P, words) => { alarms[k]++; if (!alarms.seen[k + P.id]) { alarms.seen[k + P.id] = 1; console.warn('people: ' + k + ': ' + P.id + ' ' + words); } };
  // (what the friendly bits did, counted: for the rigs)
  const counts = { hellos: 0, voiced: 0, offers: 0, answers: 0, talks: 0, lines: 0, scans: 0, came: 0, went: 0 };

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
  // (the map is of the main deck's floor: the control room up the tower and Cargo under the deck lie over and under the
  // same squares and have no patches of their own, so their people (P.home) and their spots keep off none; floorOf: the
  // floor a point is over, for "on the floor")
  const onDeck = (p) => placeOf(p) === 'deck';
  const floorOf = (p) => { const k = placeOf(p); return k === 'tower' ? TOWER.floor : k === 'store' ? STORE.floor : 0; };
  const patchFor = (P, x, z) => !P.home && onPatch(x, z);
  // ALL OF THEM MARKED, and marked again whenever a ship stands somewhere else than it did (the Miner set down by hand
  // anywhere on its hangar's floor, boarding.js stand: its lift's patch and the crane's patches go with it) or the
  // crane's round is one with other places in it
  const wayFeet = [], _im = new THREE.Matrix4(), _b = new THREE.Box3(), ONE = [null];
  let markedFor = null;
  const marksKey = () => (boarding?.stands ?? 0) + ':' + (crane?.on && crane.L ? crane.L.round + ':' + crane.L.length.toFixed(1) : '');
  function markAll() {
    const t0 = performance.now();
    markedFor = marksKey();
    keepOff.fill(0); patches.length = 0; wayFeet.length = 0;
    // job spots: their rings
    for (const s of jobs?.spots || []) markDisc(s.pos.x, s.pos.z, KEEP_OFF.job, 'job:' + s.job.id);
    // a parked ship's ways in: the patch each comes down on (its leaves' box when down, as boarding.js keeps clear)
    for (const s of boarding?.ships || []) for (const D of s.ways || []) {
      const t0 = D.t, box = new THREE.Box3();
      ONE[0] = D; setDoors(ONE, 1);
      for (const leaf of D.leaves) for (const im of leaf.meshes || []) { if (!im.geometry.boundingBox) im.geometry.computeBoundingBox(); im.getMatrixAt(leaf.index, _im); box.union(_b.copy(im.geometry.boundingBox).applyMatrix4(_im)); }
      ONE[0] = D; setDoors(ONE, t0);
      if (box.isEmpty()) continue;
      const w = KEEP_OFF.way; wayFeet.push({ D, box: box.clone(), ship: s });
      // (the box is kept where the ship is parked; the patch is marked where the ship stands: a ship shoved about its
      // hangar by a flown one, src/visit.js)
      const Bw = s.moved ? box.applyMatrix4(s.D) : box;
      mark(Bw.min.x - w, Bw.min.z - w, Bw.max.x + w, Bw.max.z + w, 'way:' + s.id);
    }
    // a ship's lift (the Miner's belly lift, boarding.js LIFTS): the floor under its platform, where it comes down (it
    // moves straight up and down, so its platform's box as it stands, across the floor; the box is kept where the ship
    // is parked, and the patch is marked where the ship stands: the square that holds it, turned)
    for (const s of boarding?.ships || []) for (const Lf of s.lifts || []) {
      const D = Lf.D; if (!D) continue;
      const box = new THREE.Box3(), any = new THREE.Box3();
      for (const leaf of D.leaves) for (const im of leaf.meshes || []) {
        if (!im.geometry.boundingBox) im.geometry.computeBoundingBox(); im.getMatrixAt(leaf.index, _im); _b.copy(im.geometry.boundingBox).applyMatrix4(_im);
        any.union(_b); if (/platform/.test(im.name)) box.union(_b);
      }
      const B = box.isEmpty() ? any : box; if (B.isEmpty()) continue;
      const w = KEEP_OFF.way; wayFeet.push({ D, box: B.clone(), ship: s });
      const Bw = s.moved ? _b.copy(B).applyMatrix4(s.D) : B;
      mark(Bw.min.x - w, Bw.min.z - w, Bw.max.x + w, Bw.max.z + w, 'lift:' + s.id);
    }
    // under the crane: every patch it works over in a round
    if (crane?.on && crane.L) {
      const seen = new Set(), m = (crane.RULES?.margin ?? 0.9) + (KEEP_OFF.crane - 0.9);
      for (let t = 0; t < crane.L.length; t += 0.5) { const g = crane.L.gate(t, 0); if (!g) continue; const k = [g.x, g.z, g.hx, g.hz].join(); if (seen.has(k)) continue; seen.add(k); mark(g.x - g.hx - m, g.z - g.hz - m, g.x + g.hx + m, g.z + g.hz + m, 'crane'); }
    }
    // what glides by itself (the big scanner's ring)
    for (const D of W.built.glides || []) if (D.sweep && !D.sweep.isEmpty()) mark(D.sweep.min.x - KEEP_OFF.glide, D.sweep.min.z - KEEP_OFF.glide, D.sweep.max.x + KEEP_OFF.glide, D.sweep.max.z + KEEP_OFF.glide, 'scanner');
    // (how often, and how long the last one took: for the rigs)
    counts.marks = (counts.marks || 0) + 1; counts.marksMs = +(performance.now() - t0).toFixed(2);
  }
  markAll();

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
  // spot placed by hand for one person)
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
  const okSpot = (p, post = false) => p && p.y - floorOf(p) < 0.45 && !(onDeck(p) && noGo(p.x, p.z)) && (post || (roomy(p) && walkOut(p)));
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
  // the talking spots: two places each, face to face (each place remembered as one: a pair keeps more room round them)
  const talks = {}, talkPlaces = new WeakSet();
  for (const [name, defs] of Object.entries(TALKS)) {
    talks[name] = [];
    for (const at of defs) {
      const r = rough(W, pieces, at); if (!r) { missing.push('talk ' + name); continue; }
      const hd = r.heading ?? 0, fx = Math.sin(hd) * APART / 2, fz = Math.cos(hd) * APART / 2, two = [];
      for (const sg of [-1, 1]) { const p = walls.snap(r.p.x + fx * sg, r.p.y + 0.35, r.p.z + fz * sg, 0.6); if (okSpot(p)) two.push(p); }
      if (two.length < 2 || two[0].distanceTo(two[1]) < APART * 0.7) { missing.push('talk ' + name + ' (no room)'); continue; }
      const T = { name: name + '.' + talks[name].length, at: two, who: [null, null], bad: 0 };
      for (const p of two) talkPlaces.add(p);
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
      // (a desk chair: only one at the desk it is said to be at, within 2 m of it)
      let desk = null;
      if (d.near) { desk = pieces.filter((x) => x.piece === d.near.piece && (!d.near.variant || x.variant === d.near.variant) && x.room === d.room).map((x) => new THREE.Vector3().applyMatrix4(x.M)).find((q) => Math.hypot(q.x - o.x, q.z - o.z) < 2) || null; if (!desk) continue; }
      const list2 = [];
      if (d.face === 'table') {
        const t = tables.reduce((b, q) => (!b || q.distanceTo(o) < b.distanceTo(o) ? q : b), null); if (!t) continue;
        const hd = Math.atan2(t.x - o.x, t.z - o.z); list2.push({ seat: o.clone(), heading: hd, back: new THREE.Vector3(-Math.sin(hd), 0, -Math.cos(hd)), table: t });
      } else if (d.face === 'own') {
        // (facing the way the chair faces, its desk; two at one desk sit "at one table", and may chat)
        const hd = Math.atan2(f.x, f.z); list2.push({ seat: o.clone(), heading: hd, back: f.clone().negate(), table: desk || o.clone(), beside: true });
      } else {
        const hd = Math.atan2(f.x, f.z), side = new THREE.Vector3(Math.cos(hd), 0, -Math.sin(hd));
        for (const k of d.two ? [-0.42, 0.42] : [0]) list2.push({ seat: o.clone().addScaledVector(side, k), heading: hd, back: f.clone().negate(), front: true, table: o.clone() });
      }
      for (const s of list2) {
        // where one stands to sit down: behind a stool (away from its table), in front of a bench, beside a desk chair
        // (its back is in the way behind it, its desk in front: the side away from the desk's middle first)
        let ap = null;
        const clearAt = (q) => q && !(onDeck(q) && noGo(q.x, q.z)) && roomy(q, 0.28) && walkOut(q);
        if (s.beside) {
          const across = new THREE.Vector3(Math.cos(s.heading), 0, -Math.sin(s.heading)), out = 0.6;
          const sides = [1, -1].sort((a, b) => Math.hypot(s.seat.x + across.x * b - s.table.x, s.seat.z + across.z * b - s.table.z) - Math.hypot(s.seat.x + across.x * a - s.table.x, s.seat.z + across.z * a - s.table.z));
          for (const k of sides) { const q = walls.snap(s.seat.x + across.x * k * out, s.seat.y + 0.35, s.seat.z + across.z * k * out, 0.2); if (clearAt(q)) { ap = q; break; } }
        } else {
          const dir = s.front ? s.back.clone().negate() : s.back, out = s.front ? 0.5 : 0.55;
          ap = walls.snap(s.seat.x + dir.x * out, s.seat.y + 0.35, s.seat.z + dir.z * out, 0.35);
          if (!clearAt(ap)) ap = null;
        }
        if (!ap) { missing.push('seat ' + name + ' (no room beside it)'); continue; }
        seats[name].push({ name: name + '.' + seats[name].length, seat: s.seat, heading: s.heading, pos: ap, front: !!s.front, table: s.table, who: null, bad: 0 });
      }
    }
  }

  // ── THE BIG SCANNER (SCAN): its place, its bed in the station, and its glide, run only while someone lies on it ──
  // (the game's maker, 2026-11-16: "it shouldn't be moving unless it is being used with someone on the bed. I think it
  // should be normal for a medic and a person to go in there and use it though (or just be there when it loads)")
  const scanPc = pieces.find((x) => x.piece === 'bigscanner');
  const scanD = scanPc ? (W.built.glides || []).find((D) => D.piece === 'bigscanner') || (W.built.glides || [])[0] || null : null;
  // (the first of each group's places the station has room for: life.js lists a second place to fall back on; the
  // walk onto the bed starts from the place the patient waits at)
  const scanA = (groups.scanApproach || []).find(Boolean), scanS = (groups.scanScreen || []).find(Boolean);
  const SCAN = scanPc && scanA && scanS ? (() => {
    const M = scanPc.M, q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(M));
    // (THE SCANNER'S OWN FLOOR, between its rails, lies a few millimetres over the room's (kit/bigscanner.js: a deck
    // plate, grip tape on it). How far, asked of the floor itself where the patient stands to get on; their way along
    // the bed and every move on and off it is lifted by that much (`up`), so their feet stand on it as on any floor.
    // The moves themselves, src/onbed.js, are as they were.)
    const s0 = new THREE.Vector3(SCAN_BED.stand[0], 0, SCAN_BED.stand[1]).applyMatrix4(M), f0 = walls.floorAt(s0.x, s0.z, s0.y + 0.2, 0.4);
    const lift = f0 == null ? 0 : Math.max(0, Math.min(0.05, f0 - s0.y)), up = new THREE.Matrix4().makeTranslation(0, lift, 0).multiply(M);
    const at = (x, z, y = 0) => new THREE.Vector3(x, y, z).applyMatrix4(up);
    const across = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    return {
      M, up, lift, q, busy: null, path: [scanA.pos.clone(), ...SCAN_BED.path.slice(1).map(([x, z]) => at(x, z))], panel: at(SCAN_BED.panel[0], SCAN_BED.panel[2], SCAN_BED.panel[1]),
      // (the bed, in its own frame, for src/onbed.js; where its patient stands with their back to it, and the way that
      // faces (out across it))
      bed: { top: SCAN_BED.top, edge: SCAN_BED.edge, pad: SCAN_BED.pad, z: SCAN_BED.z, stand: SCAN_BED.stand, hipUp: SCAN_BED.hipUp, rest: SCAN_BED.rest },
      stand: at(SCAN_BED.stand[0], SCAN_BED.stand[1]), out: Math.atan2(across.x, across.z),
      // (the scanner's own ways in the station: across its bed (its +x), out along the bed (its +z))
      across, along: new THREE.Vector3(0, 0, 1).applyQuaternion(q),
      round: scanD ? 2 * (scanD.glide.go + scanD.glide.rest) : 24, use: null,
    };
  })() : null;
  if (!SCAN) missing.push('the big scanner (no scan)');
  if (scanD) scanD.use = null;     // (parked: nobody on it yet)

  // ── THE WARD'S BEDS (THE WARD, below): the station file's cabinMedBed 'ward N', each as an onbed bed: its piece's own
  // frame (mirrored when it is got onto from its -x: moves.js bedPose), where one stands with one's back to it (stand),
  // the way they face then (out: across it, away from it), where one walks to first beside it (walkTo: as near as the
  // way-finder lets a body come to its rails) ──
  const wardBeds = pieces.filter((x) => x.piece === 'cabinMedBed' && bedNumber(x.variant) != null).map((x) => {
    const side = bedSide(x.variant), s = side || 1;
    const at = (bx, bz) => new THREE.Vector3(bx * s, 0, bz).applyMatrix4(x.M);
    const o = at(0, 0), across = at(1, 0).sub(o), w = at(...WARD_BED.walkTo), v = at(...WARD_BED.via);
    return { n: bedNumber(x.variant), variant: x.variant, side, frame: x.M, mirror: side === -1, room: x.room, floor: o.y, at, stand: at(...WARD_BED.stand), out: Math.atan2(across.x, across.z), walkTo: walls.snap(w.x, w.y + 0.35, w.z, 0.4), via: walls.snap(v.x, v.y + 0.35, v.z, 0.5), P: null };
  }).sort((a, b) => a.n - b.n);
  for (const B of wardBeds) { if (!B.side) missing.push('ward bed ' + B.n + ' (both its rails up: nobody gets onto it)'); else if (!B.walkTo) missing.push('ward bed ' + B.n + ' (no room beside it)'); }
  // (where the rescued who go home walk to: the Medic hangar's way out into the station, where its people come and go;
  // a way from the ward to the docking airlock, 90 m and more, ran past what a way may take)
  const wardHome = (() => { const e = W.R.places && W.R.places.entrances && W.R.places.entrances.medic; const p = e ? walls.snap(e[0], e[1] + 0.4, e[2], 1.5) : null; return p ? { pos: p } : null; })();
  if (!wardHome) missing.push('the way home from the ward (the Medic hangar has no way in)');

  // ── the people themselves ────────────────────────────────────────────────────────────────────────────────────
  const firstClip = (c, clips) => [].concat(clips || STAND).find((n) => c.person.actions[n]) || 'Idle';
  const _v = new THREE.Vector3();
  async function body(def, pos, heading) {
    const recipe = recipeOf(def.look || def.recipe, def); if (!recipe) { missing.push(def.id + ': no recipe'); return null; }
    const c = await makeCrew(lib, recipe, { far: true });
    const P = { id: def.id, name: def.name, def, c, pos: pos.clone(), drawnY: pos.y, heading, zone: null, shown: false, walking: false, clip: '', anim: 0, animDt: 0, sitY: 0, away: false, voice: def.voice || null, rate: def.rate || 1 };
    c.root.position.copy(P.pos); c.root.rotation.set(0, heading, 0);
    shadeUnder(c.root); shine(c, W.envAt(P.pos));
    c.play(firstClip(c, STAND), { fade: 0 }); P.clip = STAND; c.update(0); c.update(Math.random() * 3);   // (each at its own moment of the clip)
    P.moves = addMoves(c);
    P.smile = c.faceSliders.includes('smile') ? { now: (recipe.face && recipe.face.smile) ?? 0.67, base: (recipe.face && recipe.face.smile) ?? 0.67 } : null;
    // (a captain: the marker over the head, the captain's own lines)
    if (def.captain && CAPTAINS[def.id]) {
      const m = new THREE.Sprite(MARKER); m.renderOrder = 6; m.scale.setScalar(MARK.size / (c.size || 1));
      c.root.add(m); P.marker = m; P.cap = { ...CAPTAINS[def.id], id: def.id, name: def.name, state: 'idle', t: 0, cool: 0 }; P.bubbleUp = MARK.bubble;
    }
    c.root.visible = false;     // (in the scene only while drawn: update() adds and takes it away)
    return P;
  }
  const play = (P, name, { fade = 0.35, speed = 1 } = {}) => {
    const n = P.c.person.actions[name] ? name : STAND;
    if (P.clip !== n) { P.c.play(n, { fade, speed }); P.clip = n; } else P.c.play(n, { speed });
  };
  // RIDES: what a machine of a room's (rides[group]) is handed to work its driver: their clips, and on with their day
  const RIDES = { play: (P, n, o) => play(P, n, o), next: (P) => next(P), clips: { sit: CLIPS.sit, stand: STAND } };

  // ── a day ────────────────────────────────────────────────────────────────────────────────────────────────────
  // (what a step of a day asks: its kind, its group, a spot of it nobody has, claimed)
  function parse(step) { const [kind, rest] = step.do.split(':'); const [group, n] = (rest || '').split('.'); return { kind, group, n: n == null ? null : +n }; }
  // (every spot someone has: a spot, a seat's place to stand and its seat, a talking spot's places)
  const taken = new Map();       // person -> [points]
  // (a place too near one someone has: LIFE.room apart, or LIFE.talkRoom from a talking pair's place (nobody stands or
  // sits just behind two people talking, and two do not stop to talk where someone stands that near); `T`: a talking
  // spot being tried, whose own two places do not count)
  const crowded = (p, P, T = null) => {
    for (const [Q, pts] of taken) {
      if (Q === P) continue;
      for (const q of pts) {
        if (T && (q === T.at[0] || q === T.at[1])) continue;
        const r = T || talkPlaces.has(q) ? LIFE.talkRoom : LIFE.room;
        // (on the same floor: Cargo's spots lie under the main deck's, the control room's over the hangars')
        if (Math.hypot(q.x - p.x, q.z - p.z) < r && Math.abs(q.y - p.y) < 1.5) return true;
      }
    }
    return false;
  };
  // (someone free to be asked over: to talk, or to run the scanner; about as P is (both near the player, or both not))
  // (and in the same place: the control room's and Cargo's people (P.home) only with each other)
  const free = (q, P, kinds = ['stand', 'wait']) => q !== P && !q.hidden && !q.rescued && q.act && kinds.includes(q.act.kind) && (q.act.phase === 'do' || q.act.kind === 'wait') && !q.walking && !q.req && !q.cap?.busy && (!P.pos || q.away === P.away) && (q.home || null) === (P.home || null);
  // (the big scanner free for P's turn: nobody on it or on their way to it, and a medic free to run it -> that medic, the
  // nearest, or null)
  const scanMedicFor = (P) => (!SCAN || SCAN.busy || scanA.who || scanS.who ? null : list.filter((q) => free(q, P) && /medic/.test(q.id) && q.pos.distanceTo(scanA.pos) < 60).sort((a, b) => a.pos.distanceTo(scanA.pos) - b.pos.distanceTo(scanA.pos))[0] || null);
  function claimFor(P, step) {
    const { kind, group, n } = parse(step);
    if (kind === 'sit') {
      const free2 = (seats[group] || []).filter((s) => !s.who && s.bad < 2 && !crowded(s.pos, P) && !crowded(s.seat, P));
      if (!free2.length) return null;
      const s = pick(free2); P.claim = s; s.who = P; taken.set(P, [s.pos, s.seat]); return { kind, step, spot: s };
    }
    if (kind === 'talk') {
      // (a talking spot with someone already on their way to talk there, near enough: to join them; else someone
      // standing about near by is asked over to an empty one, and both go; nobody near: no talk this time)
      const all = (talks[group] || []).filter((t) => t.bad < 2);
      const near = (t) => { const q = t.who[0] || t.who[1]; return q && q.pos && (!P.pos || (q.pos.distanceTo(P.pos) < 40 && q.away === P.away)); };
      const waiting = all.filter((t) => ((t.who[0] && !t.who[1]) || (!t.who[0] && t.who[1])) && near(t) && !crowded(t.at[t.who[0] ? 1 : 0], P, t));
      if (waiting.length) { const T = pick(waiting); return talkAt(P, T, T.who[0] ? 1 : 0, step); }
      if (!P.pos) return null;
      // (a captain only now and then: they have crew to find)
      const Q = list.filter((q) => free(q, P) && q.pos.distanceTo(P.pos) < 30 && (!q.cap || Math.random() < 0.3)).sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos))[0];
      if (!Q) return null;
      const freeT = all.filter((t) => !t.who[0] && !t.who[1] && !crowded(t.at[0], P, t) && !crowded(t.at[1], P, t) && !crowded(t.at[1], Q, t))
        .sort((a, b) => a.at[0].distanceTo(P.pos) + a.at[0].distanceTo(Q.pos) - b.at[0].distanceTo(P.pos) - b.at[0].distanceTo(Q.pos));
      const T = freeT[0]; if (!T) return null;
      release(Q); const q = talkAt(Q, T, 1, step); begin(Q, q); if (Q.req) { Q.req.dropped = true; Q.req = null; } Q.act.phase = 'go'; Q.act.delay = rnd(0.8, 2.2);
      return talkAt(P, T, 0, step);
    }
    if (kind === 'scan') {
      // (a patient's turn in the big scanner: only one at a time, and only with a medic to run it, who is asked over)
      const A = scanA, S = scanS, Q = scanMedicFor(P);
      if (!Q) return null;
      // (the medic's own errand let go first: the scan is theirs only after)
      release(Q);
      SCAN.busy = { patient: P, medic: Q };
      Q.claim = S; S.who = Q; taken.set(Q, [S.pos]);
      begin(Q, { kind: 'scanMedic', step: { do: 'scanMedic' }, spot: S });
      if (Q.req) { Q.req.dropped = true; Q.req = null; } Q.act.phase = 'go'; Q.act.delay = rnd(0.3, 1.2);
      P.claim = A; A.who = P; taken.set(P, [A.pos]);
      counts.scans++;
      return { kind: 'scan', step, spot: A };
    }
    if (kind === 'drive') {
      // (a machine of their room's to drive, rides[group]: Cargo's forklift, src/cargoforklift.js; to the spot beside its
      // seat if it is in and has something to carry; the rest, on and off and the ride, is the machine's: RIDES)
      const R = rides[group], s = R && R.claim(P); if (!s) return null;
      P.claim = s; s.who = P; taken.set(P, [s.pos]); return { kind, step, spot: s, ride: R };
    }
    if (kind === 'walk') {
      const L = (groups[group] || []).filter(Boolean); if (!L.length) return null;
      taken.delete(P);
      return { kind, step, spot: L[0], list: L, j: 0 };
    }
    // stand or post: a spot of the group (a post's own one, by its number)
    const L = groups[group] || [];
    // (never a spot a ship now stands on, or one on a patch that has come to lie there: the Miner set down by hand)
    const clear = (s) => !shipsMoved() || (!noGo(s.pos.x, s.pos.z) && walls.free(s.pos.x, s.pos.y, s.pos.z, 0.26));
    const freeS = n != null ? (L[n] && (!L[n].who || L[n].who === P) ? [L[n]] : []) : L.filter((s) => s && !s.who && s.bad < 2 && !crowded(s.pos, P) && clear(s));
    if (!freeS.length) return null;
    const s = pick(freeS); P.claim = s; s.who = P; taken.set(P, [s.pos]); return { kind, step, spot: s };
  }
  const shipsMoved = () => (boarding?.ships || []).some((s) => s.moved);
  function release(P) {
    if (P.act && P.act.ride) P.act.ride.release(P);      // (RIDES: off their machine, its round finished)
    const c = P.claim; taken.delete(P);
    endTalk(P);
    if (SCAN && SCAN.busy && (SCAN.busy.patient === P || SCAN.busy.medic === P)) scanOver(P);
    if (!c) return;
    if (c.talk) { if (c.talk.who[c.i] === P) c.talk.who[c.i] = null; } else if (c.who === P) c.who = null;
    P.claim = null;
  }
  // (a claim made for someone before their body was: theirs now)
  function handOver(c, P0, P) {
    if (taken.has(P0)) { taken.set(P, taken.get(P0)); taken.delete(P0); }
    if (SCAN && SCAN.busy) { if (SCAN.busy.patient === P0) SCAN.busy.patient = P; if (SCAN.busy.medic === P0) SCAN.busy.medic = P; }
    if (!c) return;
    if (c.talk) { if (c.talk.who[c.i] === P0) c.talk.who[c.i] = P; } else if (c.who === P0) c.who = P;
  }
  // the next thing in a person's day
  function next(P) {
    if (P.fleeing) { P.speed = P.fleeing.was; P.fleeing = null; }   // (run from the crane: back to their own pace)
    release(P); P.yielding = null; P.blocker = null; P.heldAll = 0; P.lastReplan = null; P.madeWayFor = false; P.jammed = false; P.pose = null; P.scripted = false;
    // (the rescued: their one errand, to their bed or home, again: THE WARD; those of them about the station, their
    // day's next thing as anyone's, below)
    if (P.rescued && wardNext(P)) return;
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
    // (the scanner's patient: think() sets off for the bed's foot, once the medic is at the screen)
    if (a.kind === 'scan') return;
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
      else if (a.kind === 'scan') { a.phase = 'lying'; a.placed = true; }
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
    for (const P of list) { if (P.walking || P.away || !P.act || P.act.phase === 'go') continue; const k = Math.floor(P.pos.x) * 4096 + Math.floor(P.pos.z); (stillCells.get(k) || stillCells.set(k, []).get(k)).push(P); }
    return stillCells;
  }
  function avoidFor(P, to) {
    return (x, z) => {
      if (!P.home && noGo(x, z)) return true;
      if (Math.hypot(x - to.x, z - to.z) < 0.7) return false;
      if (nearTruck(P, x, z)) return true;      // (Cargo's forklift, where it is as the way is worked out)
      if (P.away) return false;       // (someone away keeps off the patches, and nobody else is there for them)
      const M = stillMap(), i = Math.floor(x), k = Math.floor(z);
      // (anyone standing still on the same floor: not someone in Cargo under the deck, or in the control room over it)
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const L = M.get((i + a) * 4096 + k + b); if (L) for (const Q of L) if (Q !== P && Math.hypot(Q.pos.x - x, Q.pos.z - z) < LIFE.keepFrom && Math.abs(Q.pos.y - P.pos.y) < 1.5) return true; }
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
        if (P.act && P.act.meet && P.cap) P.cap.meetSkip = (P.cap.meetSkip || 0) + 1;      // (no way to that place by the ship: the next one)
        console.info('people: no way for ' + P.id + ' to ' + (P.act?.spot?.name || P.act?.kind) + (w ? ' (' + w.short + ' m short)' : ''));
        // (the scanner's two: once more after a moment, before the scan is given up)
        if (P.act && (P.act.kind === 'scan' || P.act.kind === 'scanMedic') && !P.act.retried) { P.act.retried = true; P.act.phase = 'go'; P.act.delay = rnd(1, 2); P.walking = false; continue; }
        release(P); P.act = { kind: 'wait', until: rnd(2, 5), t: 0 }; P.walking = false;
      }
    }
  }

  // ── PRESENCE: the nearest NEAR about the player, the rest out of the way ─────────────────────────────────────
  const _f = new THREE.Frustum(), _pm = new THREE.Matrix4(), _s = new THREE.Sphere(new THREE.Vector3(), 1.15);
  const inView = (P, camera) => { _s.center.set(P.pos.x, P.pos.y + 0.95, P.pos.z); return !!(P.zone && P.zone.group.visible) && camera.position.distanceTo(P.pos) < SEEN && _f.intersectsSphere(_s); };
  // (who goes with whom: a pair talking, the scanner's patient and medic)
  function partner(P) {
    if (P.act && P.act.kind === 'talk' && P.act.spot.talk) { const Q = P.act.spot.talk.who[1 - P.act.spot.i]; if (Q) return Q; }
    if (P.convo) return P.convo.A === P ? P.convo.B : P.convo.A;
    if (SCAN && SCAN.busy) { if (SCAN.busy.patient === P) return SCAN.busy.medic; if (SCAN.busy.medic === P) return SCAN.busy.patient; }
    // (one of the rescued waiting their turn at the scanner, and the medic who will run it: THE WARD, wardPair)
    const pr = wardPair(); if (pr) { if (pr[0] === P) return pr[1]; if (pr[1] === P) return pr[0]; }
    return null;
  }
  let presenceClock = 0, nearMost = 8;
  // (a captain whose line the player picked on a jobs board, src/jobsboard.js, and is being led to: their id)
  let seeking = null;
  function presence(dt, focus, camera) {
    presenceClock -= dt; if (presenceClock > 0) return; presenceClock = PRESENCE.every;
    // (the control room's and Cargo's people are not counted: they are about exactly while the player is in their
    // place, THE PLACES ONLY THE LIFT GOES TO)
    // (nor the rescued in the ward, THE WARD: about for as long as they are aboard; those of them about the station
    // are counted, as the station's own people)
    const L = list.filter((P) => !P.hidden && !P.home && !(P.rescued && P.rescued.state !== 'about'));
    for (const P of L) P.rank = Math.hypot(P.pos.x - focus.x, P.pos.z - focus.z) + Math.abs(P.pos.y - focus.y) * 2;
    for (const P of L) { const Q = partner(P); P.rankPair = Q ? Math.min(P.rank, Q.rank ?? Infinity) : P.rank; }
    L.sort((a, b) => a.rankPair - b.rankPair || a.order - b.order);
    // (a captain the player is being led to, src/jobsboard.js: one of those about however many are nearer, in the last
    // one's place, so the line never ends where nobody stands)
    const S = seeking ? L.find((P) => P.cap && P.cap.id === seeking) : null;
    const want = new Set(L.slice(0, S && L.indexOf(S) >= nearMost ? nearMost - 1 : nearMost)); if (S) want.add(S);
    for (const P of [...want]) { const Q = partner(P); if (Q) want.add(Q); }
    const pl = playerNow ? playerNow.pos : null;
    const unseen = (P) => !inView(P, camera);
    // (those past the nearest go first, then those wanted come, each only while there is room: never more than the
    // nearest NEAR about, but for someone who should go and is still in view)
    for (const P of L) {
      const w = want.has(P);
      P.unwanted = w ? 0 : (P.unwanted || 0) + PRESENCE.every;
      if (w || P.away || P.unwanted < PRESENCE.linger) continue;
      const group = [P]; const Q = partner(P); if (Q && Q.away === P.away) group.push(Q);
      if (group.every((X) => unseen(X) && (!pl || X.pos.distanceTo(pl) > PRESENCE.go))) for (const X of group) setAway(X, true);
    }
    let about = L.filter((P) => !P.away).length;
    for (const P of L) {
      if (!want.has(P) || !P.away) continue;
      const group = [P]; const Q = partner(P); if (Q && Q.away === P.away) group.push(Q);
      if (about + group.length > nearMost + (Q ? 1 : 0)) continue;
      // (back, where nobody is looking, nobody stands, not right by the player, and not in a shut door's way: someone
      // away walks through doors as if they were open)
      // (one of the rescued on their seat is let back seated: a bench is no free floor to the walls, and one waiting
      // their turn at the scanner on the medical centre's would be out of the way until they got up: THE WARD)
      if (group.every((X) => unseen(X) && (!pl || X.pos.distanceTo(pl) > PRESENCE.come) && !someoneAt(X.pos, X, LIFE.body, true) && (X.scripted || (X.rescued && X.act && X.act.phase === 'sat') || walls.free(X.pos.x, X.pos.y, X.pos.z, 0.22)))) { for (const X of group) setAway(X, false); about += group.length; }
    }
  }
  function setAway(P, v) {
    if (P.away === v) return;
    P.away = v; stillV++;
    counts[v ? 'went' : 'came']++;
    if (v) { bubbles.clear(P); if (P.cap && (P.cap.state === 'offer' || P.cap.state === 'turning')) endOffer(P); }
  }

  // ── each frame ───────────────────────────────────────────────────────────────────────────────────────────────
  const others = [], near = new THREE.Vector3();
  let zoneClock = 0, frame = 0, playerNow = null, clock = 0;
  const seen = [];
  let drawnMost = 12, farAt = 7;
  const bubbles = makeBubbles({ camera: W.camera, walls });
  // (focus: where the nearest people are counted from, if not the player on their feet: the ship they are flying about
  // the station, src/visit.js)
  function update(dt, { player = null, camera, now = null, focus = null, place = null, soon = false }) {
    frame++; seen.length = 0;
    clock = now != null ? now : clock + dt;
    zoneClock -= dt;
    const findZones = zoneClock <= 0; if (findZones) zoneClock = 0.4;
    playerNow = player;
    truckNow = rides.forklift && rides.forklift.outline ? rides.forklift.outline() : null;      // (Cargo's forklift, where it is)
    // (a ship stands somewhere else, or the crane's round has other places in it: the patches marked again, and anyone
    // left standing on one, or inside the ship, goes on with their day from there)
    if (markedFor !== marksKey()) {
      markAll(); stillV++;
      for (const P of list) { if (P.hidden || P.home || P.away || P.walking || P.scripted || !P.act || P.act.kind === 'walk' || ['sat', 'sitting', 'rising'].includes(P.act.phase)) continue; if (onPatch(P.pos.x, P.pos.z) || !walls.free(P.pos.x, P.pos.y, P.pos.z, 0.22)) { if (P.cap && P.cap.busy) endOffer(P); next(P); } }
      // (and anyone on their way across that ship's hangar: their way worked out again round the ship where it now is,
      // or, their spot now under it, something else to do)
      const hangars = new Set((boarding?.ships || []).filter((s) => (s.lifts && s.lifts.length) || s.moved).map((s) => s.hangar));
      for (const P of list) {
        if (P.hidden || P.away || P.scripted || P.fleeing || !(P.walking || P.req) || !P.act || !P.act.spot || !P.zone || !hangars.has(P.zone.id)) continue;
        const to = P.act.spot.pos;
        if (P.act.kind === 'stand' && !P.act.meet && (noGo(to.x, to.z) || !walls.free(to.x, to.y, to.z, 0.26))) next(P); else route(P, to);
      }
    }
    planning();
    camera.updateMatrixWorld(); _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _f.setFromProjectionMatrix(_pm);
    news.update(dt);
    presence(dt, focus || (player ? player.pos : camera.position), camera);
    homes(dt, place, soon, camera);      // (the control room's and Cargo's people: about only while the player is there)
    wardUpdate(dt, player, camera);      // (the rescued, after a rescue run: THE WARD)
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
      P.far = far;
      P.shown = !P.away && inView(P, camera);
      if (P.shown) seen.push(P);
    }
    // the nearest of them drawn, at most DRAWN[quality] (a body out of the scene costs nothing at all: the scene's own
    // update walks every bone of every body in it, drawn or not)
    if (seen.length > drawnMost) { seen.sort((a, b) => a.far - b.far); for (let i = drawnMost; i < seen.length; i++) seen[i].shown = false; seen.length = drawnMost; }
    for (const P of list) {
      if (P.shown === !!P.inScene) continue;
      if (P.shown) { W.scene.add(P.c.root); P.fresh = true; } else W.scene.remove(P.c.root);
      P.inScene = P.shown; P.c.root.visible = P.shown; P.byCam = false;
    }
    // (the scanner's glide: from rest while its patient lies on it (and is about), parked otherwise: kit/layout.js
    // updateGlides, which the station's frame calls)
    if (scanD) scanD.use = SCAN && SCAN.use && SCAN.busy && SCAN.busy.patient && !SCAN.busy.patient.away ? SCAN.use : null;
    talking(dt);
    friendly(dt);
    for (const P of seen) {
      const c = P.c, far = P.far;
      // (the body eased up and down steps, a riser at a time; a sitter at the seat's height; a patient on the scanner's
      // bed, lying)
      P.drawnY = Math.abs(P.pos.y - P.drawnY) > 0.6 ? P.pos.y : damp(P.drawnY, P.pos.y, 14, dt);
      if (P.pose) { c.root.position.copy(P.pose.root); c.root.quaternion.copy(P.pose.q); }
      else { c.root.position.set(P.pos.x, P.drawnY + P.sitY, P.pos.z); c.root.rotation.set(0, P.heading + (P.walking ? P.sideOn || 0 : 0), 0); }
      // (THE FAR COPY beyond a few metres, on Low always; the eyes and the clear layer over them, two draws each, only
      // close up and never on the far copy)
      const wantFar = far > (c.far ? farAt - 0.5 : farAt);
      if (wantFar !== c.far) c.setFar(wantFar);
      const close = far < LIFE.eyes && !c.far;
      if (P.close !== close) { P.close = close; for (const m of [c.meshes.eyes, c.meshes.cornea]) if (m) m.visible = close; }
      // (right by the camera (someone going by just behind the player, where the camera is): not drawn, as games do,
      // rather than a face, or the inside of an outfit, filling the screen)
      const cx = camera.position.x - P.pos.x, cz = camera.position.z - P.pos.z, cy = camera.position.y - P.drawnY;
      const byCam = cx * cx + cz * cz < LIFE.camClear * LIFE.camClear && cy > -0.3 && cy < 1.75 * (c.size || 1) + LIFE.camClear;
      if (byCam !== !!P.byCam) { P.byCam = byCam; c.root.visible = !byCam; }
      // (the captain's marker, over the head as it is now, bobbing; hidden right by the camera, where it would loom)
      if (P.marker) {
        const H = c.bones.Head, hy = (H ? H.getWorldPosition(_v).y - c.root.position.y : 1.65 * (c.size || 1)) / (c.size || 1) + (MARK.over + Math.sin(clock * 2.1 + P.order) * MARK.bob) / (c.size || 1);
        P.marker.position.set(0, hy, 0);
        const my = c.root.position.y + hy * (c.size || 1) - camera.position.y;
        P.marker.visible = cx * cx + cz * cz + my * my > MARK.near * MARK.near;
      }
      // (someone speaking up on their own (a captain, the medic) moves their hands as they talk, as two people talking
      // do (moves.js), never while their hands are at work; the scanner's patient getting on, lying and getting off:
      // their legs, feet and hands as the move has them (moves.js M.bed, from onbed.js))
      // (a captain waiting on the player's answer listens as someone in a talk does: a nod, a hand, the weight shifting)
      if (!P.convo) { P.moves.talk = P.talkUntil && clock < P.talkUntil && !(P.act && P.act.work > 0) ? 'speak' : P.cap && P.cap.state === 'offer' ? 'listen' : null; P.moves.sitting = !!(P.act && ['sat', 'sitting', 'rising'].includes(P.act.phase)); }
      P.moves.bed = P.act && (P.act.kind === 'scan' || P.act.kind === 'ward') && P.pose && P.bed ? P.bed : null;
      // the clips: every frame near, every other frame further, every fourth far off (what is skipped added on)
      P.animDt += dt;
      const step = far < LIFE.near ? 1 : far < LIFE.mid ? 2 : 4;
      // (just come into view: posed at once, never shown as they were when last seen)
      if (!P.fresh && (frame + P.id.length) % step !== 0) continue;
      P.fresh = false;
      // eyes (and the head) on a player who comes near, or on whoever they are talking to, or a captain's on the player
      const tk = P.act && P.act.kind === 'talk' && P.act.phase === 'do' && P.act.spot.talk.who[1 - P.act.spot.i];
      const ck = P.convo ? (P.convo.A === P ? P.convo.B : P.convo.A) : null;
      const vis = far < 8 && !tk && !ck && P.act && (P.act.kind === 'post' || P.act.kind === 'stand') ? visitor(P) : null;
      const lying = P.act && (P.act.kind === 'scan' || P.act.kind === 'ward') && P.pose;
      const scanning = SCAN && SCAN.busy && P.act && (P.act.kind === 'scan' || P.act.kind === 'scanMedic') ? SCAN.busy : null;
      let look = null;
      // (on the bed's moves: only a glance the move itself asks for, at the bed as they back up to it)
      if (lying) look = P.bed && P.bed.look ? near.copy(P.bed.look) : null;
      // (the medic at the scanner: on the controls while working them, else on the patient; the patient, at the bed's
      // foot, on the medic)
      else if (scanning && P.act.kind === 'scanMedic') look = P.act.work > 0 ? near.copy(SCAN.panel) : scanning.patient && scanning.patient.inScene ? headAt(scanning.patient, near) : null;
      else if (scanning && (P.act.phase === 'ready' || P.act.phase === 'bye') && scanning.medic && scanning.medic.inScene) look = headAt(scanning.medic, near);
      else if (player && player.pos.distanceTo(P.pos) < FRIENDLY.look && (P.cap?.busy || !(tk || ck) || player.pos.distanceTo(P.pos) < 2.4)) look = near.copy(player.pos).setY(player.pos.y + 1.55 * ((player.c && player.c.size) || 1));
      else if (tk || ck || vis) { const q = tk || ck || vis; look = near.copy(q.pos).setY((q.drawnY ?? q.pos.y) + (q.sitY || 0) + 1.5); }
      // (anyone else standing or sitting about, or at work: now and then a glance at someone going by, or round the room
      // (someone at work less often))
      else if (!P.walking && !P.convo && far < 20) look = glance(P, near, !!(P.act && P.act.clip && P.act.clip !== STAND));
      if (far < 8 && look) c.lookAt(look, { dart: true }); else c.lookAt(null);
      P.moves.look = look && far < 20 ? (P.moves.lookAt || (P.moves.lookAt = new THREE.Vector3())).copy(look) : null;
      // (a little more smile while the player is near, or just after a hello)
      if (P.smile) {
        const want = (player && player.pos.distanceTo(P.pos) < FRIENDLY.look) || (P.smileUntil && clock < P.smileUntil) ? FRIENDLY.smile : P.smile.base;
        const s2 = damp(P.smile.now, want, 3, P.animDt);
        if (Math.abs(s2 - P.smile.now) > 0.01 || (s2 !== P.smile.now && Math.abs(s2 - want) < 0.01)) { P.smile.now = Math.abs(s2 - want) < 0.01 ? want : s2; c.setFace({ ...(c.recipe.face || {}), smile: P.smile.now }); }
      }
      c.update(P.animDt); P.animDt = 0;
    }
    bubbles.show(!!player); bubbles.update(dt);
    audit(dt);
  }

  // (standing or sitting about with nothing else to look at: now and then, for a moment, a glance at someone going by
  // in front of them (more often than not, when there is someone), or a look a little to one side; then back)
  function glance(P, out, working = false) {
    const G = P.glance || (P.glance = { next: clock + rnd(1, 6), until: 0, who: null, at: new THREE.Vector3() });
    if (clock > G.next) {
      G.until = clock + rnd(1.2, 2.6); G.next = G.until + (working ? rnd(6, 12) : rnd(3, 7)); G.who = null;
      let best = null, bd = 6;
      for (const Q of list) {
        if (Q === P || Q.away || !Q.walking || !Q.inScene) continue;
        const dx = Q.pos.x - P.pos.x, dz = Q.pos.z - P.pos.z, d = Math.hypot(dx, dz);
        if (d < bd && dx * Math.sin(P.heading) + dz * Math.cos(P.heading) > -0.2 * d) { bd = d; best = Q; }
      }
      if (best && Math.random() < 0.7) G.who = best;
      else { const h = P.heading + rnd(-0.9, 0.9); G.at.set(P.pos.x + Math.sin(h) * 3, (P.drawnY ?? P.pos.y) + rnd(1.1, 1.8), P.pos.z + Math.cos(h) * 3); }
    }
    if (clock > G.until) return null;
    return G.who ? (G.who.away || !G.who.inScene ? null : headAt(G.who, out)) : out.copy(G.at);
  }
  // (someone standing still in front of a person at their post, within talking distance: a captain's visitor)
  function visitor(P) {
    let best = null, bd = 2.6;
    for (const Q of list) {
      if (Q === P || Q.walking || Q.hidden || Q.away) continue;
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
  // anyone shifts and looks round; toward a visitor or the player who comes up, a little more; a captain making an
  // offer, all the way round to the player)
  function idle(P, a, dt, most) {
    const L = a.look || (a.look = { off: 0, want: 0, next: rnd(2, 6) });
    L.next -= dt;
    if (L.next <= 0) { L.want = rnd(-most, most); L.next = rnd(4, 10); }
    const base = a.spot.heading ?? P.heading;
    const q = (playerNow && playerNow.pos.distanceTo(P.pos) < 3) ? playerNow : (a.kind === 'post' ? visitor(P) : null);
    let want = L.want;
    const offering = P.cap && P.cap.busy && a.phase !== 'sat';
    if (q) want = offering ? wrap(Math.atan2(q.pos.x - P.pos.x, q.pos.z - P.pos.z) - base) : Math.max(-most * 2, Math.min(most * 2, wrap(Math.atan2(q.pos.x - P.pos.x, q.pos.z - P.pos.z) - base)));
    L.off += Math.sign(want - L.off) * Math.min(Math.abs(want - L.off), (offering ? 1.6 : 0.7) * dt);
    P.heading = wrap(base + L.off);
  }
  // what a person does this moment
  function think(P, dt) {
    if (P.cap && P.cap.meet && !P.cap.busy && !P.cap.walking && !P.fleeing) meetStep(P);
    const a = P.act; if (!a) { next(P); return; }
    a.t += dt;
    if (P.cap && P.cap.walking) return;      // (a captain stepping up to the player: their offer moves them, captain())
    if (a.kind === 'wait') { play(P, STAND); if (a.t > a.until) next(P); return; }
    if (P.req) { if (!P.walking) play(P, STAND); return; }        // (working the way out: as they were)
    // (a captain stopped for the player: standing, turned to them, until the offer is over)
    if (P.cap && P.cap.busy && P.walking && playerNow) {
      play(P, STAND);
      const want = Math.atan2(playerNow.pos.x - P.pos.x, playerNow.pos.z - P.pos.z), diff = wrap(want - P.heading);
      P.heading = wrap(P.heading + Math.sign(diff) * Math.min(Math.abs(diff), LIFE.turn * 0.8 * dt));
      return;
    }
    if (P.walking) { walk(P, dt); return; }
    if (a.phase === 'go') {
      if (a.delay > 0) { a.delay -= dt; play(P, STAND); return; }
      // (the scanner's patient sets off once the medic is at its screen (up to half a minute): coming in by the same
      // doorway, a patient waiting at the bed's foot first stood in her way)
      if (a.kind === 'scan' && !a.placed && a.t < 30 && SCAN && SCAN.busy && SCAN.busy.patient === P) {
        const M = SCAN.busy.medic;
        if (M && M.act && M.act.kind === 'scanMedic' && M.act.phase !== 'do') { play(P, STAND); idle(P, a, dt, 0.3); return; }
      }
      route(P, a.spot.pos); return;
    }
    // turning to the spot's way, then at it
    if (a.phase === 'turn') {
      const want = a.spot.heading ?? P.heading, diff = wrap(want - P.heading);
      P.heading = wrap(P.heading + Math.sign(diff) * Math.min(Math.abs(diff), LIFE.turn * dt));
      play(P, STAND);
      if (Math.abs(diff) < 0.05) { a.phase = a.kind === 'scan' ? 'ready' : 'do'; a.t = 0; }
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
    // (getting up only when nobody is standing where they would step; sitting side by side with someone, a chat now
    // and then)
    if (a.phase === 'sat') {
      play(P, CLIPS.sit); idle(P, a, dt, a.spot.front ? 0.15 : 0.4);
      if (!P.convo && a.t > 5 && Math.random() < dt * 0.08) seatChat(P);
      if (a.t > a.len && !someoneAt(a.spot.pos, P, LIFE.body) && !(P.convo && P.convo.speaking === P)) { endTalk(P); a.phase = 'rising'; a.t = 0; }
      return;
    }
    if (a.phase === 'rising') {
      // (someone come to where they would stand while they get up: they get no further up till that is clear)
      if (a.t > LIFE.sit * 0.3 && someoneAt(a.spot.pos, P, LIFE.body)) a.t = Math.max(LIFE.sit * 0.3, a.t - dt);
      const k = Math.min(1, a.t / LIFE.sit);
      play(P, STAND, { fade: 0.45 });
      if (k > 0.3) P.pos.lerpVectors(a.spot.seat, a.spot.pos, Math.min(1, (k - 0.3) / 0.7));
      if (k >= 1) { P.pos.copy(a.spot.pos); stillV++; next(P); }
      return;
    }
    if (a.kind === 'scan') { scanPatient(P, a, dt); return; }
    if (a.kind === 'scanMedic') { scanMedic(P, a, dt); return; }
    if (a.kind === 'ward') { wardStep(P, a, dt); return; }
    // RIDES: at their machine (getting on, riding it, getting off): the machine's own part, src/cargoforklift.js
    if (a.kind === 'drive') { a.ride.step(P, a, dt, RIDES); return; }
    // at it: standing, at work, or talking (the time counted once both are there)
    if (a.kind === 'talk') {
      const other = a.spot.talk.who[1 - a.spot.i], there = other && other.act && other.act.phase === 'do' && other.act.spot.talk === a.spot.talk;
      play(P, STAND);
      idle(P, a, dt, 0.12);
      if (there) {
        a.both = (a.both || 0) + dt;
        // (a conversation from the line bank, begun by the one who came first; another after a pause if time is left)
        if (!P.convo && !other.convo && a.spot.i === 0 && a.both > (a.again ?? rnd(0.8, 2)) && a.len - a.both > 6) startTalk(P, other, false);
        if (a.both > a.len && !(P.convo && P.convo.speaking)) next(P);
      } else if (a.both > 0 || a.t > 20 || !other) next(P);      // (the other gone, or not come: on with the day)
      return;
    }
    play(P, a.clip || STAND);
    // (at work with a clip of its own: turned to the work; standing about: a look round now and then, and toward
    // whoever comes up)
    if (!a.clip || a.clip === STAND) idle(P, a, dt, a.kind === 'post' ? 0.22 : 0.35);
    if (a.t > a.len && !(P.cap && P.cap.busy)) next(P);
  }

  // ── MEET: a captain gone to their ship to wait for the player (the top of this file) ─────────────────────────
  // K.meet(n): where to wait, as it is now ({ pos, heading }), or null (nowhere just now: their ship is in the air);
  // n: the n-th such place, for a captain who found no way to an earlier one (K.meetSkip, counted in planning()).
  // They walk there as anyone walks (a way worked out, round whoever stands in it), wait there for as long as it takes,
  // go to it again if it moves (the ship set down somewhere else) or if they are moved (a ship coming down sends them
  // running: flee), and with nowhere to wait they stand where they are until there is.
  const meetAct = (s) => ({ kind: 'stand', meet: true, step: { do: 'stand', for: [1e9, 1e9] }, spot: { pos: s.pos.clone(), heading: s.heading ?? null } });
  function meetStep(P) {
    const K = P.cap, a = P.act, s = K.meet(K.meetSkip || 0);
    if (a && a.meet) { if (s && !P.req && a.spot.pos.distanceTo(s.pos) > 0.6) { release(P); begin(P, meetAct(s)); } return; }
    // (seated: up first, as anyone gets up)
    if (a && ['sat', 'sitting', 'rising'].includes(a.phase)) { if (a.phase === 'sat') a.len = 0; return; }
    if (a && (a.kind === 'scan' || a.kind === 'scanMedic')) return;
    if (!s) { if (a && a.kind === 'wait' && a.meetWait) a.t = 0; else { release(P); if (P.req) { P.req.dropped = true; P.req = null; } P.way = null; P.walking = false; P.act = { kind: 'wait', until: 3, t: 0, meetWait: true }; stillV++; } return; }
    release(P); if (P.req) { P.req.dropped = true; P.req = null; }
    begin(P, meetAct(s));
  }

  // ── TALK: two people sharing a conversation from the line bank, in bubbles over their heads ──────────────────
  const convos = new Set();
  const READ = (w) => Math.min(8, 1.5 + w.length * 0.055);
  function startTalk(A, B, sitting) {
    // (anyone else within earshot is never the one talked about)
    const nearby = list.filter((X) => X !== A && X !== B && !X.away && !X.hidden && (X.pos.distanceTo(A.pos) < 6 || X.pos.distanceTo(B.pos) < 6));
    const T = pickTalk(A, B, { sitting, player: (crew() || {}).name || null, now: clock, nearby });
    if (!T) { if (A.act) A.act.again = (A.act.both || 0) + rnd(8, 14); return null; }
    const C = { A, B, lines: T.lines, id: T.id, i: -1, t: 0, gap: rnd(0.3, 0.8), sitting, speaking: null };
    A.convo = B.convo = C; convos.add(C); counts.talks++;
    return C;
  }
  function endTalk(P) {
    const C = P.convo; if (!C) return;
    convos.delete(C);
    // (a short pause before another, if they stay)
    for (const X of [C.A, C.B]) { if (X.convo === C) X.convo = null; if (X.moves) X.moves.talk = null; if (X.act && X.act.kind === 'talk') X.act.again = (X.act.both || 0) + rnd(2, 4.5); }
  }
  function talking(dt) {
    for (const C of [...convos]) {
      C.t += dt;
      if (C.speaking) { if (C.t > C.secs) { C.speaking = null; C.t = 0; C.gap = rnd(0.35, 0.9); } }
      else if (C.t > C.gap) {
        C.i++;
        if (C.i >= C.lines.length) { endTalk(C.A); continue; }
        const L = C.lines[C.i], S = L.who ? C.B : C.A;
        C.speaking = S; C.t = 0; C.secs = READ(L.words); counts.lines++;
        if (S.shown) bubbles.say(S, L.words, { kind: 'talk', secs: C.secs });
      }
      for (const X of [C.A, C.B]) if (X.moves) { X.moves.talk = C.speaking === X ? 'speak' : 'listen'; X.moves.sitting = !!C.sitting; }
    }
  }
  // (sitting at a table or on a bench with someone beside, nobody talking: a chat)
  function seatChat(P) {
    const s = P.act.spot; if (!s || !s.table || P.rescued) return;      // (the rescued talk with nobody: THE WARD)
    const Q = list.find((q) => q !== P && !q.hidden && !q.rescued && q.away === P.away && !q.convo && q.act && q.act.kind === 'sit' && q.act.phase === 'sat' && q.act.spot.table && q.act.spot.table.distanceTo(s.table) < 0.3 && q.act.t > 3);
    if (Q) startTalk(P, Q, true);
  }

  // ── FRIENDLY: hellos as the player passes, a captain's offer ─────────────────────────────────────────────────
  let lastHello = -99, lastVoice = -99, lastWords = '';
  const _ap = new THREE.Vector3();
  const headAt = (P, out) => { const H = P.c.bones.Head; if (H && P.inScene) return H.getWorldPosition(out); return out.set(P.pos.x, P.pos.y + 1.6, P.pos.z); };
  const _h = new THREE.Vector3();
  // (a clip in P's voice, from where they stand: -> its handle, or null when it could not play: another voice a moment
  // ago, the sound off or not yet allowed)
  function speak(P, clipId, volume = FRIENDLY.voice) {
    if (!clipId || clock - lastVoice < FRIENDLY.voiceGap) return null;
    const h = sound.play(clipId, { at: headAt(P, _h), volume, rate: P.rate || 1 });
    if (h) { lastVoice = clock; counts.voiced++; }
    return h;
  }
  function friendly(dt) {
    const pl = playerNow;
    // (a captain's offer, the nearest captain to a player who has come near)
    for (const P of list) if (P.cap) captain(P, dt, pl);
    if (!pl) return;
    if (clock - lastHello < FRIENDLY.gap) return;
    let best = null, bd = FRIENDLY.hello;
    for (const P of list) {
      if (P.away || !P.shown || P.cap || P.hidden || (P.greeted && clock - P.greeted < FRIENDLY.again)) continue;
      // (at the scanner, patient or medic: busy with each other; the rescued, on their way to the ward and resting there)
      if (P.rescued || (P.act && (P.act.kind === 'scan' || P.act.kind === 'scanMedic'))) continue;
      const dx = pl.pos.x - P.pos.x, dz = pl.pos.z - P.pos.z, d = Math.hypot(dx, dz);
      if (d > bd || Math.abs(pl.pos.y - P.pos.y) > 1.2) continue;
      // (two people talking keep to their talk (and look at each other) unless the player comes right up to them)
      if ((P.convo || (P.act && P.act.kind === 'talk' && P.act.phase === 'do')) && d > 2.4) continue;
      if (P.convo && P.convo.speaking === P) continue;
      // (the player in front of them, more or less: someone walking away from the player says nothing)
      if ((dx * Math.sin(P.heading) + dz * Math.cos(P.heading)) / (d || 1) < -0.2) continue;
      best = P; bd = d;
    }
    if (!best) return;
    hello(best);
  }
  function hello(P) {
    const first = !P.greeted;
    P.greeted = clock; P.smileUntil = clock + 4; lastHello = clock; counts.hellos++;
    const V = P.voice && VOICES[P.voice];
    // (never the same words as the hello just before: two in a row read as a chorus)
    let words = pick(first ? HELLOS : AGAIN);
    for (let i = 0; i < 4 && words.replace(/\W/g, '') === lastWords; i++) words = pick(first ? HELLOS : AGAIN);
    // (the first hello that can be heard is spoken, in their own voice, its words in the bubble; after that, bubbles)
    if (!P.voiced && V) { const id = pick(V.hellos); if (speak(P, id)) { words = VOICE_CLIPS[id].words; P.voiced = true; } }
    bubbles.say(P, words, { kind: 'hello', secs: 2.4 }); lastWords = words.replace(/\W/g, '');
  }
  // A CAPTAIN: near the player, in view, the offer (who, what for, and the question); the answer; left a while after
  // (seeking, above: a captain whose line the player picked on a jobs board and is being led to: they make their offer
  // when the player walks up even if they asked a little while ago, and before a nearer captain does)
  function captain(P, dt, pl) {
    const K = P.cap; K.t += dt; K.cool -= dt;
    if (K.state === 'turning') {
      // (turned to the player first, then the offer: never spoken with their back to them; standing a way off, a few
      // steps nearer first, to an easy talking distance, as someone does who wants a word: never onto a patch kept off,
      // into anyone or through a wall, and given up after a few seconds)
      const d = pl ? pl.pos.distanceTo(P.pos) : Infinity;
      if (!pl || d > FRIENDLY.leave || P.away) { K.walking = false; endOffer(P); K.cool = FRIENDLY.offerAgain; return; }
      const sat = P.act && ['sat', 'sitting', 'rising'].includes(P.act.phase);
      const want = Math.atan2(pl.pos.x - P.pos.x, pl.pos.z - P.pos.z), diff = Math.abs(wrap(want - P.heading));
      if (!sat && !P.scripted && d > FRIENDLY.near && K.t < 4) {
        if (K.walking) P.heading = wrap(P.heading + Math.sign(wrap(want - P.heading)) * Math.min(diff, LIFE.turn * dt));
        if (diff < 0.6) {
          const s = Math.min(d - FRIENDLY.near, 1.0 * dt), ux = (pl.pos.x - P.pos.x) / d, uz = (pl.pos.z - P.pos.z) / d;
          _ap.copy(P.pos); walls.move(_ap, ux * s, uz * s, 0.26);
          if (_ap.distanceTo(P.pos) > s * 0.5 && !onPatch(_ap.x, _ap.z) && !someoneAt(_ap, P, LIFE.body, true)) {
            P.pos.copy(_ap); if (!K.walking) { K.walking = true; play(P, CLIPS.walk, { speed: Math.max(0.6, Math.min(1.5, 1.0 / P.c.stride.Walk)) }); } return;
          }
        } else if (K.walking) return;
      }
      if (K.walking) { K.walking = false; play(P, STAND); }
      if (sat || diff < 0.45 || K.t > 1.6) offerNow(P);
      return;
    }
    if (K.state === 'offer') {
      const d = pl ? pl.pos.distanceTo(P.pos) : Infinity;
      if (!pl || d > FRIENDLY.leave || K.t > 25 || P.away) { endOffer(P); K.cool = FRIENDLY.offerAgain; return; }
      // (the question hidden while a job's prompt is up: one prompt at a time)
      bubbles.hideAsk(!!(jobs && jobs.near));
      // (no answer a while after the offer: a friendly word, once)
      if (!K.nudged && K.t > FRIENDLY.nudge && !(jobs && jobs.near)) { K.nudged = true; const w = pick(NUDGES); bubbles.say(P, w, { kind: 'captain', secs: 3.2 }); P.talkUntil = clock + 1.4; }
      return;
    }
    if (K.state === 'answered') { if (K.t > (K.hold || 3.5)) { K.state = 'idle'; K.busy = false; K.hold = 0; } return; }
    // (never while the player is at a job, answering its questions; nor while they are on their way to their ship, or
    // waiting by it, to meet the player: the contract is signed, there is nothing to ask)
    if (!pl || P.away || !P.shown || K.cool > 0 || K.meet || bubbles.asking || (jobs && jobs.busy && jobs.busy())) return;
    if (P.act && (P.act.kind === 'scan' || P.act.phase === 'rising' || P.act.phase === 'sitting')) return;
    const d = pl.pos.distanceTo(P.pos);
    if (d > FRIENDLY.offer || Math.abs(pl.pos.y - P.pos.y) > 1.2) return;
    // (only the nearest captain speaks up; the one the player was led to, before a nearer one)
    if (seeking !== K.id) for (const Q of list) if (Q !== P && Q.cap && !Q.away && Q.shown && (Q.cap.id === seeking ? pl.pos.distanceTo(Q.pos) <= FRIENDLY.offer : pl.pos.distanceTo(Q.pos) < d)) return;
    offer(P);
  }
  // (the offer begun: the captain stops and turns to the player; offerNow speaks once they face them)
  function offer(P) {
    const K = P.cap;
    endTalk(P);
    if (seeking === K.id) seeking = null;      // (found)
    K.state = 'turning'; K.t = 0; K.busy = true; P.greeted = clock; P.smileUntil = clock + 9; counts.offers++;
  }
  function offerNow(P) {
    const K = P.cap, st = missions.state(K.id, crew());
    K.state = 'offer'; K.t = 0; K.nudged = false;
    // (a contract signed with this captain, src/missions.js: they will be at the ship. Home, the share not collected
    // yet: where it is)
    if (st === 'signed') { const w = lineOf(K.signed); if (w) { bubbles.say(P, w, { kind: 'captain', secs: 4 }); P.talkUntil = clock + 2.5; } K.state = 'answered'; K.t = 0; K.cool = FRIENDLY.answered; return; }
    if (st === 'payout') { const w = K.payout || K.waiting; bubbles.say(P, w, { kind: 'captain', secs: 4.5 }); P.talkUntil = clock + 2.5; K.state = 'answered'; K.t = 0; K.cool = FRIENDLY.answered; return; }
    if (st === 'interested' && !missions.ready(K.id)) { const w = K.waiting; bubbles.say(P, w, { kind: 'captain', secs: 4 }); P.talkUntil = clock + 2.5; K.state = 'answered'; K.t = 0; K.cool = FRIENDLY.answered; return; }
    // THE HAULER'S CAPTAIN (src/lines.js CAPTAINS; the one part of this file that is theirs, here and `V` in answer()
    // below): their lines are words alone, no recorded clip. And until their run is offered (src/missions.js `offered`:
    // the old station found) there is none to ask about: 'wait', a word and no question; or 'sale', their ship for sale
    // to this crew member meanwhile: that offer in place of the run's (K.sale's words; K.now: whose words answer() uses)
    if (st === 'wait') { const w = K.wait[K.waited ? 1 : 0]; K.waited = true; bubbles.say(P, w, { kind: 'captain', secs: Math.max(4.5, READ(w) + 1) }); P.talkUntil = clock + Math.min(3, READ(w)); K.state = 'answered'; K.t = 0; K.hold = READ(w) + 0.5; K.cool = FRIENDLY.answered; return; }
    const V = K.now = st === 'sale' ? { ...K.sale, pitch: 'sale' } : K;
    // (the offer: spoken the first time it can be heard, in a bubble always, the hands moving as they say it; the
    // question at the bottom of the screen)
    let words = V.again;
    if (typeof V.offer === 'string') { if (K.pitched !== (V.pitch || 'run')) { K.pitched = V.pitch || 'run'; words = V.offer; } }
    else if (!K.offered) { K.voice = speak(P, K.offer.clip, 0.8); if (K.voice) { K.offered = true; words = VOICE_CLIPS[K.offer.clip].words; } else if (st === 'new') words = VOICE_CLIPS[K.offer.clip].words; }
    else K.voice = speak(P, K.hello.clip);
    const secs = Math.max(6, READ(words) + 2);
    bubbles.say(P, words, { kind: 'captain', secs }); P.talkUntil = clock + Math.min(secs - 1, READ(words));
    if (st !== 'sale') missions.asked(K.id);
    // (a captain whose ship is down for now, Captain Adair: no question; they stay facing the player till they have said
    // it, then go on with their day)
    if (K.down) { K.state = 'answered'; K.t = 0; K.hold = Math.min(secs - 1, READ(words) + 0.5); K.cool = FRIENDLY.answered; return; }
    K.ask = bubbles.ask({ who: K.name, what: V.what, yes: 'Interested', no: 'Not now',
      onYes: () => answer(P, true), onNo: () => answer(P, false) });
  }
  function answer(P, yes) {
    const K = P.cap, V = K.now || K; counts.answers++;
    if (K.voice) { K.voice.stop(); K.voice = null; lastVoice = -99; }
    // (a mission that is made: yes brings up the contract's card, src/mission.js; they stay with the player meanwhile)
    const made = yes && missions.ready(K.id) && V.contract;
    const words = made ? V.contract : yes ? VOICE_CLIPS[K.yes.clip].words : V.no;
    if (yes && !made) speak(P, K.yes.clip, 0.8);
    bubbles.say(P, words, { kind: 'captain', secs: Math.max(3.5, READ(words)) }); P.talkUntil = clock + Math.min(3, READ(words));
    K.ask = null; K.state = 'answered'; K.t = 0; K.cool = FRIENDLY.answered; P.smileUntil = clock + 5;
    if (made) K.hold = 60;
    missions.answer({ id: K.id, name: K.name, ship: K.ship, mission: K.mission }, yes);
  }
  // (a captain's line: plain words, or a recorded clip's own words, { clip })
  const lineOf = (x) => (x && typeof x === 'object' ? (VOICE_CLIPS[x.clip] || {}).words || '' : x || '');
  // (for src/mission.js: a captain kept with the player while their contract's card is up; a word from them, spoken in
  // their own voice where it has a clip; off to their ship to meet the player (MEET above), or no longer; let go again)
  const capOf = (id) => list.find((P) => P.cap && P.cap.id === id) || null;
  const captainApi = {
    hold(id, secs = 60) { const P = capOf(id); if (!P) return false; const K = P.cap; K.state = 'answered'; K.t = 0; K.hold = secs; K.busy = true; return true; },
    say(id, line, secs = null) {
      const P = capOf(id), words = lineOf(line); if (!P || P.away || !words) return false;
      if (line && line.clip) { const K = P.cap; if (K.voice) K.voice.stop(); lastVoice = -99; K.voice = speak(P, line.clip, 0.8); }
      bubbles.say(P, words, { kind: 'captain', secs: secs ?? Math.max(3.5, READ(words)) }); P.talkUntil = clock + Math.min(3, READ(words)); return true;
    },
    meet(id, where = null) {
      const P = capOf(id); if (!P) return false; const K = P.cap;
      if (!where) { if (K.meet) { K.meet = null; if (P.act && (P.act.meet || P.act.meetWait)) next(P); } return true; }
      K.meet = where; K.meetSkip = 0; return true;
    },
    meeting(id) { const P = capOf(id); return P && P.cap.meet ? { walking: !!P.walking, planning: !!P.req, there: !!(P.act && P.act.meet && P.act.phase === 'do'), act: P.act ? P.act.kind + ':' + (P.act.phase || '') : null, away: !!P.away, pos: P.pos.toArray().map((v) => +v.toFixed(2)), to: P.act && P.act.meet ? P.act.spot.pos.toArray().map((v) => +v.toFixed(2)) : null } : null; },
    release(id, cool = FRIENDLY.answered) { const P = capOf(id); if (!P) return false; const K = P.cap; if (K.ask) { K.ask.close(); K.ask = null; } K.state = 'answered'; K.t = 0; K.hold = 2.5; K.cool = cool; return true; },
    at(id) { const P = capOf(id); return P ? { pos: P.pos, away: !!P.away } : null; },
    // (a captain's line picked on a jobs board: the player is being led to them; null: no longer)
    seek(id) { const P = id ? capOf(id) : null; seeking = P ? id : null; if (P) P.cap.cool = 0; return !!P; },
    get seeking() { return seeking; },
  };
  function endOffer(P) {
    const K = P.cap; if (K.ask) { K.ask.close(); K.ask = null; }
    if (K.walking) { K.walking = false; play(P, STAND); }
    K.state = 'idle'; K.busy = false; K.t = 0;
  }

  // ── SCAN: the patient's turn on the big scanner, and the medic's at its screen ───────────────────────────────
  // The patient walks from the spot by the bed's foot along its side, turns their back to it and gets on as a person
  // gets onto a high bed (src/onbed.js: a hop up onto its edge, the legs swung round onto it with the knees bent, lying
  // back, the legs straightened), lies still with their head on the head rest while the ring glides over them, a few
  // times there and back; then off the same way backwards, a slide off the edge onto their feet, and out the way they
  // came. Their body is placed by its hips and turned about them (src/moves.js M.bed bends the legs and puts the hands
  // down); the clip under it all is the standing one or the sitting one, as the move says (lying: the standing one).
  const BED_ON = MOVES_ON.map((m) => m[0]), BED_OFF = MOVES_OFF.map((m) => m[0]);
  const _e = new THREE.Euler();
  // (a move's pose, from the bed's own frame into the station: the root turned and placed from where the clips put the
  // hip joints (moves.js measures it each frame), and the legs', the feet's and the hands' places for moves.js)
  function bedPoseOf(P, move, t) {
    const who = P.moves.body, p = onBedPose(move, t, SCAN.bed, who);
    const W = (v, out) => out.set(v[0], v[1], v[2]).applyMatrix4(SCAN.up), D3 = (v, out) => out.set(v[0], v[1], v[2]).applyQuaternion(SCAN.q);
    const D = P.bed || (P.bed = { hips: new THREE.Vector3(), feet: [new THREE.Vector3(), new THREE.Vector3()], pole: new THREE.Vector3(), ahead: new THREE.Vector3(), hands: [new THREE.Vector3(), new THREE.Vector3()], legs: 0, flat: 0, arms: 0, chin: 0 });
    W(p.hips, D.hips); W(p.feet[0], D.feet[0]); W(p.feet[1], D.feet[1]); D3(p.pole, D.pole);
    D3([Math.sin(p.heading), 0, Math.cos(p.heading)], D.ahead);
    if (p.hands) { W(p.hands[0], D.hands[0]); W(p.hands[1], D.hands[1]); }
    D.fingers = p.fingers ? p.fingers.map((f, i) => D3(f, (D.fingersV || (D.fingersV = [new THREE.Vector3(), new THREE.Vector3()]))[i])) : null;
    D.elbows = p.elbows ? p.elbows.map((f, i) => D3(f, (D.elbowsV || (D.elbowsV = [new THREE.Vector3(), new THREE.Vector3()]))[i])) : null;
    D.legs = p.legs; D.flat = p.flat; D.arms = p.hands ? p.arms : 0; D.chin = p.chin || 0;
    D.point = p.point; D.pitch = p.pitch || 0; D.roll = p.roll || 0; D.curl = p.curl || 0;
    D.armsLR = p.hands && p.armsLR ? p.armsLR : null; D.turn = p.turn || 0; D.twist = p.twist || 0;
    D.look = p.look ? W(p.look, D.lookV || (D.lookV = new THREE.Vector3())) : null;
    const pose = P.pose || (P.pose = { root: new THREE.Vector3(), q: new THREE.Quaternion() });
    const h = Math.atan2(D.ahead.x, D.ahead.z);
    pose.q.setFromEuler(_e.set(-p.lean, h, 0, 'YXZ'));
    pose.root.copy(P.moves.hipAt).applyQuaternion(pose.q).negate().add(D.hips);
    P.pos.set(D.hips.x, SCAN.stand.y, D.hips.z); P.heading = h;
    play(P, p.clip === 'sit' ? CLIPS.sit : STAND, { fade: 0.45 });
    return p;
  }
  function scanPatient(P, a, dt) {
    if (!SCAN || !SCAN.busy || SCAN.busy.patient !== P) { next(P); return; }
    const M = SCAN.busy.medic, ready = M && M.act && M.act.kind === 'scanMedic' && M.act.phase === 'do';
    const along = (from, to, k) => _v.lerpVectors(from, to, k);
    if (a.phase === 'ready') {
      // (at the bed's foot: on once the medic at the screen has said hello and they have answered)
      play(P, STAND); idle(P, a, dt, 0.1);
      const said = ready && M.act.said;
      if (a.placed || (said && said.answer && clock - said.answer > 0.9)) { a.phase = 'walkin'; a.t = 0; a.leg = 0; P.scripted = true; }
      else if (a.t > 45) { next(P); }
      return;
    }
    if (a.phase === 'bye') {
      // (back at the bed's foot: turned to the medic for a word of thanks (scanMedic says it), and off)
      play(P, STAND);
      if (M) { const want = Math.atan2(M.pos.x - P.pos.x, M.pos.z - P.pos.z), diff = wrap(want - P.heading); P.heading = wrap(P.heading + Math.sign(diff) * Math.min(Math.abs(diff), LIFE.turn * dt)); }
      if (a.t > 1.9) scanDone(P);
      return;
    }
    if (a.phase === 'walkin' || a.phase === 'walkout') {
      // (along the bed's side, at an easy pace, inside the rails: the ring is parked; the way ends where they stand to
      // get on, and out it is the same way back past the bed's foot)
      const path = a.phase === 'walkin' ? SCAN.path : [...SCAN.path].reverse();
      const A = path[a.leg], B = path[a.leg + 1];
      if (!B) {
        if (a.phase === 'walkin') { a.phase = 'back'; a.t = 0; a.from = P.pos.clone(); a.fromH = P.heading; }
        else { P.scripted = false; P.pos.copy(path[path.length - 1]); a.phase = 'bye'; a.t = 0; }
        return;
      }
      const L = A.distanceTo(B), k = Math.min(1, a.t * 0.75 / Math.max(L, 0.01));
      P.pos.copy(along(A, B, k)); P.pose = null;
      const want = Math.atan2(B.x - A.x, B.z - A.z), diff = wrap(want - P.heading);
      P.heading = wrap(P.heading + Math.sign(diff) * Math.min(Math.abs(diff), LIFE.turn * dt));
      play(P, CLIPS.walk, { speed: 0.75 });
      if (k >= 1) { a.leg++; a.t = 0; }
      return;
    }
    if (a.phase === 'back') {
      // (turned round where they stand, to put their back to the bed's side: standing, the clip's own legs)
      const k = ease(Math.min(1, a.t / BED_SECS.back));
      P.pose = null; P.pos.lerpVectors(a.from, SCAN.stand, k); P.heading = wrap(a.fromH + wrap(SCAN.out - a.fromH) * k);
      play(P, STAND);
      if (a.t >= BED_SECS.back) { a.phase = 'hop'; a.t = 0; }
      return;
    }
    const on = BED_ON.indexOf(a.phase), off = BED_OFF.indexOf(a.phase);
    if (on > 0 || off >= 0) {
      // (getting on, a move at a time, or off; each move's end is the next one's start)
      const p = bedPoseOf(P, a.phase, a.t);
      if (p.done) {
        a.t = 0;
        if (on > 0) { a.phase = BED_ON[on + 1] || 'lying'; if (a.phase === 'lying') a.rounds = Math.round(rnd(SCAN_BED.rounds[0], SCAN_BED.rounds[1])); }
        else if (BED_OFF[off + 1]) a.phase = BED_OFF[off + 1];
        else { P.pose = null; P.bed = null; P.pos.copy(SCAN.stand); P.heading = SCAN.out; a.phase = 'walkout'; a.leg = 0; play(P, STAND, { fade: 0.3 }); }
      }
      return;
    }
    if (a.phase === 'lying') {
      // (flat on the bed, still; the ring glides while they are on it: SCAN.use, from rest, a few times there and back,
      // once the medic has started it at the screen (on its own after a while if they never do); at the end, the
      // medic's word, then up)
      P.scripted = true;
      bedPoseOf(P, 'lying', 0);
      const S = SCAN.busy;
      if (a.placed && !S.started) S.started = clock;
      if (!SCAN.use && !S.over && (S.started || a.t > 9)) SCAN.use = { from: clock, end: null };
      const U = SCAN.use;
      if (U && U.end == null && clock - U.from > (a.rounds || 2) * SCAN.round - 0.01) U.end = U.from + Math.ceil((clock - U.from) / SCAN.round) * SCAN.round;
      if (U && U.end != null && clock >= U.end && !S.over) S.over = clock;
      if (S.over && clock - S.over > 1.5) { SCAN.use = null; a.phase = BED_OFF[0]; a.t = 0; }
      return;
    }
  }
  // THE MEDIC at the scanner's screen, on the front of the bed's pedestal: turned to the patient coming up, a hello (and
  // their answer); turned to the screen while they get on; a word as they lie down and a touch of the controls, which
  // starts the ring; while it goes, an eye on the patient, a touch of the controls now and then and one word more; the
  // end said; turned to the patient again for their thanks as they go. The words: lines.js SCAN_TALK.
  function scanMedic(P, a, dt) {
    const S = SCAN && SCAN.busy;
    if (!S || S.medic !== P) { next(P); return; }
    const pt = S.patient, ph = pt && pt.act && pt.act.kind === 'scan' ? pt.act.phase : null, said = a.said || (a.said = {});
    const toPt = (ph === 'ready' || ph === 'bye') && pt.pos.distanceTo(P.pos) < 4;
    const want = toPt ? Math.atan2(pt.pos.x - P.pos.x, pt.pos.z - P.pos.z) : a.spot.heading ?? P.heading, diff = wrap(want - P.heading);
    P.heading = wrap(P.heading + Math.sign(diff) * Math.min(Math.abs(diff), LIFE.turn * 0.6 * dt));
    if (ph === 'ready' && !said.hello && Math.abs(diff) < 0.7) { said.hello = clock; scanSay(P, 'hello'); }
    if (said.hello && !said.answer && clock - said.hello > 1.8) { said.answer = clock; scanSay(pt, 'answer'); }
    a.work = (a.work || 0) - dt;
    if (ph === 'lying' && !S.started) {
      if (!said.still) { said.still = clock; scanSay(P, 'still'); }
      else if (!a.starting && clock - said.still > 1.2) { a.starting = true; a.work = 1.7; }
      else if (a.starting && a.work <= 0) { a.starting = false; S.started = clock; }
    }
    if (ph === 'lying' && SCAN.use && !S.over) {
      if (a.work < -rnd(8, 14)) a.work = rnd(1.2, 2);
      // (a word now and then while it goes: not the same twice)
      if (!said.during && clock - SCAN.use.from > SCAN.round * 0.6) { said.during = clock; scanSay(P, 'during'); }
      else if (said.during && !said.late && SCAN.use.end == null && clock - SCAN.use.from > SCAN.round * 1.5) { said.late = clock; scanSay(P, 'late'); }
    }
    if (S.over && !said.done) { said.done = clock; a.work = Math.min(a.work, 0); scanSay(P, 'done'); }
    if (ph === 'bye' && !said.thanks) { said.thanks = clock; scanSay(pt, 'thanks'); }
    play(P, a.work > 0 ? CLIPS.reach : STAND);
    if (a.t > 240) next(P);       // (a scan that never came: on with the day)
  }
  // (a word at the scanner, in a bubble: SCAN_TALK; the medic's hands move as they say it)
  function scanSay(X, kind, not = null) {
    const S = SCAN.busy, first = (Y) => (Y && Y.name ? Y.name.split(' ')[0] : '');
    const L = SCAN_TALK[kind].filter((w) => w !== not);
    const line = pick(L.length ? L : SCAN_TALK[kind]);
    // (a patient nobody knows the name of, one of the rescued: the line without a name, "Ready for your scan? Up you get.")
    const pn = first(S && S.patient), words = (pn ? line.replace('{patient}', pn) : line.replace(/,? \{patient\}/, '')).replace('{medic}', first(S && S.medic) || 'Doc');
    bubbles.say(X, words, { kind: 'talk' });
    if (S && X === S.medic) X.talkUntil = clock + Math.min(kind === 'still' ? 1.1 : 2.4, READ(words));
    counts.scanWords = (counts.scanWords || 0) + 1;
    return line;
  }
  function scanDone(P) {
    const S = SCAN && SCAN.busy; if (!S) { next(P); return; }
    const M = S.medic; SCAN.busy = null; SCAN.use = null;
    // (the medic stays at the screen a little while after (the results), rather than walking off with the patient)
    if (M && M.act && M.act.kind === 'scanMedic') M.act = { kind: 'stand', phase: 'do', t: 0, len: rnd(5, 9), spot: M.act.spot, step: { do: 'stand' }, clip: null };
    next(P);
  }
  function scanOver(P) {
    // (the patient or the medic gone off before it was done: the patient off the bed at once, where nobody can see
    // (people.js never leaves anyone lying), the scanner parked)
    const S = SCAN.busy; SCAN.busy = null; SCAN.use = null;
    const pt = S.patient; if (pt) pt.bed = null;
    if (pt && pt !== P && pt.act && pt.act.kind === 'scan') { pt.pose = null; pt.scripted = false; if (!['go', 'ready', 'turn', 'bye'].includes(pt.act.phase)) pt.pos.copy(SCAN.path[0]); pt.act = { kind: 'wait', until: rnd(1, 3), t: 0 }; }
    if (pt === P) { P.pose = null; P.scripted = false; if (P.act && P.act.kind === 'scan' && !['go', 'ready', 'turn', 'bye'].includes(P.act.phase)) P.pos.copy(SCAN.path[0]); }
    const md = S.medic; if (md && md !== P && md.act && md.act.kind === 'scanMedic') md.act = { kind: 'wait', until: rnd(1, 3), t: 0 };
  }

  // ── THE WARD: the rescued after a rescue run (src/wardplan.js: the game's maker's words, and what happens) ────────
  // Station people with one errand of their own (P.rescued: their record; their act 'ward'), made from the looks the
  // sleepers in the pods had. Coming down the Medic's ramp one after another (at its foot, where the camera does not see
  // them appear), each walks to their own bed's side as anyone walks (a way worked out, round others and the player, the
  // doors opening for them), turns their back to it and gets on and lies down as the big scanner's patient does
  // (onbed.js, laid into the world by moves.js bedPose); the crew member gone off anywhere but along their way
  // (wardplan.js watching), they are in it at once. The rest, with no bed free: THE OTHERS, next (only past the room
  // there is for those do any still walk off out of the hangar, home, and are gone once nobody sees them). Their stay
  // over, they are gone while nobody sees the ward, or get up and walk off.
  // Never counted among the nearest (presence): about for as long as they are aboard; never asked to talk, never a
  // hello (busy getting better).
  // THE OTHERS, with no bed (wardplan.js THE OTHERS; the game's maker: "They can exist in the station too. Also, they can
  // go to the scanner."): no longer gone at the hangar's way out. Their record's state is 'about': from the ramp's foot
  // they go on as the station's own people do, with a day of the station's own things (wardplan.js ABOUT_DAY, taken up
  // by next() as anyone's day is), counted among the nearest as anyone (presence); those of them who go to the big
  // scanner first (r.scan) sit in the medical centre's waiting seats till it is free and a medic to run it, then have
  // the station's patients' own errand, 'scan' (claimFor, SCAN above: nothing of it is theirs alone), and then go about
  // as the rest. Their while over (the ward's stay): gone if nobody sees them; seen, off toward the hangar's way out,
  // gone once nobody does.
  const ward = { list: [], queue: [], making: false, last: -99, for: undefined, n: 0, ms: 0, foot: null, footSeen: 0, counts: { came: 0, walkedIn: 0, put: 0, late: 0, home: 0, left: 0, gone: 0, about: 0, scanned: 0, off: 0 } };
  // (the Medic's ramp foot: where it comes down nearest the ward, on the hangar's floor just past its patch, where the
  // ship stands now)
  function wardFoot() {
    const s = (boarding?.ships || []).find((q) => q.id === 'medic'); if (!s || !s.ways || !s.ways.length || !s.zone) return null;
    const mid = s.zone.box.getCenter(new THREE.Vector3()), to = wardBeds.length && wardBeds[0].walkTo ? wardBeds[0].walkTo : mid;
    let best = null, bd = Infinity;
    // (its ramps, not its crew door: the rescued come down a ramp, as they went up one at the planet)
    const ramps = s.ways.filter((D) => /ramp/i.test(D.piece || ''));
    for (const D of ramps.length ? ramps : s.ways) {
      const dx = D.sense.x - mid.x, dz = D.sense.z - mid.z, L = Math.hypot(dx, dz) || 1;
      for (let k = 2; k < 5; k += 0.25) {
        const p = new THREE.Vector3(D.sense.x + dx / L * k, 0, D.sense.z + dz / L * k); if (s.moved) p.applyMatrix4(s.D);
        if (noGo(p.x, p.z)) continue;
        const q = walls.snap(p.x, 0.5, p.z, 0.3); if (!q) continue;
        const d = q.distanceTo(to); if (d < bd) { bd = d; best = q; }
        break;
      }
    }
    return best;
  }
  // (to their bed in two legs: past its foot on the side they get on from, then along it: WARD_BED.via)
  const bedAct = (B) => (B.via ? { kind: 'ward', leg: 'via', step: { do: 'ward' }, spot: { pos: B.via.clone(), heading: null, name: 'ward bed ' + B.n + ' (its foot)' } } : { kind: 'ward', step: { do: 'ward' }, spot: { pos: B.walkTo.clone(), heading: B.out, name: 'ward bed ' + B.n } });
  const homeAct = () => ({ kind: 'ward', home: true, step: { do: 'ward' }, spot: { pos: wardHome.pos.clone(), heading: null, name: 'home' } });
  // (their errand, again: to their bed, or home -> true; false: about the station, their day's next thing is next()'s)
  function wardNext(P) {
    const r = P.rescued, B = r.bed >= 0 ? wardBeds[r.bed] : null;
    if (r.state === 'about') {
      if (clock < r.leaveAt) return aboutNext(P);
      // (their while over, and seen: off, out of the station, gone once nobody sees them: wardUpdate)
      r.state = 'leaving'; r.from = P.pos.clone(); r.unseen = 0; r.since = clock; ward.counts.off++;
    }
    if (r.state === 'lying') { placeInBed(P); return true; }
    if (B && r.state === 'toBed') { begin(P, bedAct(B)); return true; }
    if (wardHome) { begin(P, homeAct()); return true; }
    wardGone(P); return true;
  }
  // THE OTHERS' TURN AT THE SCANNER (r.scan: still to come). Waiting: on the medical centre's waiting seats (none free:
  // on its floor), and there, once they have waited, the scan itself when it can be had: the station's patients' own
  // errand, claimed as theirs is. Scanned (the ring has been over them): about the station, as the rest. -> true: an
  // errand given; false: their day's next thing (next()'s own)
  const waitsSeated = (P) => !!(P.rescued.scan && P.act && P.act.kind === 'sit' && P.act.phase === 'sat');
  function aboutNext(P) {
    const r = P.rescued, a0 = P.act;
    if (!r.scan) return false;
    if (a0 && a0.kind === 'scan' && a0.rounds) {
      r.scan = false; ward.counts.scanned++;
      // (their save too, so a reload does not send them again: written with the crew member's next save)
      const c = crew ? crew() : null, s = c && Array.isArray(c.ward) ? c.ward.find((x) => x && x.bed === -1 && x.until === r.until && x.look === r.look) : null;
      if (s) delete s.scan;
      return false;
    }
    const a = (r.waited && /^med/.test(roomNow(P.pos) || '') && claimFor(P, SCAN_STEP)) || SCAN_WAIT.reduce((f, s) => f || claimFor(P, s), null);
    if (a) { if (a.kind !== 'scan') r.waited = true; begin(P, a); } else { P.act = { kind: 'wait', until: rnd(4, 9), t: 0 }; P.walking = false; }
    return true;
  }
  // (each frame, wardUpdate: seated and waiting, they stay seated until it is their turn: the scanner free and a medic
  // to run it, and nobody who came down the ramp before them still waiting; their while over: gone if nobody sees
  // them, else off as soon as they can go (up from a seat as anyone gets up; a scan finished first))
  function aboutStep(P) {
    const r = P.rescued, a = P.act;
    if (clock >= r.leaveAt) {
      if (P.away || !P.shown) { wardGone(P); return; }
      if (!a || a.kind === 'scan' || P.scripted) return;
      if (['sat', 'sitting', 'rising'].includes(a.phase)) { if (a.phase === 'sat') a.len = 0; return; }
      if (P.req) { P.req.dropped = true; P.req = null; }
      next(P); return;
    }
    if (waitsSeated(P) && !(scanMedicFor(P) && ward.list.find(waitsSeated) === P)) a.len = Math.max(a.len, a.t + 1);
  }
  // (for presence's pairs, partner(): the first of them whose turn is still to come and the medic who will run the
  // scanner come and go together, as a patient and a medic at the scanner do; else, with few people about at once (the
  // low picture quality's four), the medic could be out of the way while they sat waiting in front of the player, and
  // their turn never come. Worked out once a frame.)
  function wardPair() {
    if (ward.pairAt === clock) return ward.pair;
    ward.pairAt = clock; ward.pair = null;
    if (!SCAN || SCAN.busy || !ward.list.length) return null;
    const P = ward.list.find((Q) => Q.rescued.state === 'about' && Q.rescued.scan); if (!P) return null;
    const M = list.filter((q) => /medic/.test(q.id) && !q.hidden && !q.home && !q.rescued && !q.convo && !(q.act && q.act.kind === 'talk')).sort((a, b) => a.pos.distanceTo(scanA.pos) - b.pos.distanceTo(scanA.pos))[0];
    return (ward.pair = M ? [P, M] : null);
  }
  // (not watched as they come home, or come back to after a reload: about the station at once, at something of their
  // day (waiting for the scanner: on the medical centre's seats), put there out of the way: presence brings them
  // about where nobody is looking, as it does anyone)
  function aboutPlace(P) {
    const r = P.rescued; let first = r.scan ? SCAN_WAIT.reduce((f, s) => f || claimFor(P, s), null) : null;
    if (first) r.waited = true;
    for (let i = 0; i < P.day.length && !first; i++) { P.k = (P.k + 1) % P.day.length; if (!/^walk:/.test(P.day[P.k].do)) first = claimFor(P, P.day[P.k]); }
    P.pos.copy(first ? first.spot.pos : wardHome ? wardHome.pos : P.pos); P.drawnY = P.pos.y; P.lastGain.copy(P.pos); P.away = true;
    if (first && first.spot.heading != null) P.heading = first.spot.heading;
    P.zone = W.zoneAt(P.pos); if (P.zone) shine(P.c, W.envAt(P.pos));
    // (already some way into it, each their own)
    if (first) { begin(P, first, true); if (!r.scan && P.act && P.act.len) P.act.t = Math.random() * P.act.len * 0.5; } else P.act = { kind: 'wait', until: rnd(2, 5), t: 0 };
    stillV++;
  }
  // a move on the bed, laid into the world (moves.js bedPose: the person's root placed from where the clips put the hip
  // joints, and the legs', feet's and hands' places for moves.js M.bed)
  // (the bed as onbed takes it, for this person: their hips placed by their own legs' length, wardplan.js bedFor)
  const bedOf = (P) => P.rescued.onbed || (P.rescued.onbed = bedFor(P.moves.body));
  const standOf = (P, B) => B.at(...bedOf(P).stand);
  function wardPose(P, B, move, t) {
    const p = onBedPose(move, t, bedOf(P), P.moves.body);
    P.bed = bedPose(P.moves, p, B.frame, { mirror: B.mirror, D: P.bed });
    P.pose = P.bed;
    P.pos.set(P.bed.hips.x, B.floor, P.bed.hips.z); P.heading = P.bed.heading;
    play(P, p.clip === 'sit' ? CLIPS.sit : STAND, { fade: 0.45 });
    return p;
  }
  // there, at their bed: their back to it, then on it and lying down (onbed's moves, as the scanner's patient); their
  // stay over, off it again (the same moves backwards) and away; home: there, gone
  function wardStep(P, a, dt) {
    const r = P.rescued, B = r.bed >= 0 ? wardBeds[r.bed] : null;
    if (a.phase === 'do' || a.phase === 'turn') {
      if (a.home || !B || r.state !== 'toBed') { wardGone(P); return; }
      // (past the bed's foot: on along its side, straight, as the scanner's patient walks along its bed)
      if (a.leg === 'via') { a.leg = 'along'; a.phase = 'along'; a.t = 0; a.from = P.pos.clone(); P.scripted = true; P.walking = false; stillV++; return; }
      a.phase = 'back'; a.t = 0; a.from = P.pos.clone(); a.fromH = P.heading; P.scripted = true; P.walking = false; stillV++;
    }
    if (a.phase === 'off') {
      // (along the bed's side to past its foot, straight; then the way out, worked out as anyone's)
      const A = a.from, E = B.via || B.walkTo, L = A.distanceTo(E), k = Math.min(1, a.t * 0.8 / Math.max(L, 0.01));
      P.pos.lerpVectors(A, E, k);
      const want = Math.atan2(E.x - A.x, E.z - A.z), diff = wrap(want - P.heading);
      P.heading = wrap(P.heading + Math.sign(diff) * Math.min(Math.abs(diff), LIFE.turn * dt));
      if (Math.abs(diff) > 1.0 && a.t < 1.2) { a.t -= dt * 0.7; play(P, STAND); } else play(P, CLIPS.walk, { speed: 0.8 });
      if (k >= 1) { P.scripted = false; if (wardHome) begin(P, homeAct()); else wardGone(P); }
      return;
    }
    if (a.phase === 'along') {
      const A = a.from, E = B.walkTo, L = A.distanceTo(E), k = Math.min(1, a.t * 0.8 / Math.max(L, 0.01));
      P.pose = null; P.bed = null; P.pos.lerpVectors(A, E, k);
      const want = Math.atan2(E.x - A.x, E.z - A.z), diff = wrap(want - P.heading);
      P.heading = wrap(P.heading + Math.sign(diff) * Math.min(Math.abs(diff), LIFE.turn * dt));
      play(P, CLIPS.walk, { speed: 0.8 });
      if (k >= 1) { a.phase = 'back'; a.t = 0; a.from = P.pos.clone(); a.fromH = P.heading; }
      return;
    }
    if (a.phase === 'back') {
      // (turned round where they stand, their back to the bed's side: standing, the clip's own legs)
      const k = ease(Math.min(1, a.t / BED_SECS.back));
      P.pose = null; P.bed = null; P.pos.lerpVectors(a.from, standOf(P, B), k); P.heading = wrap(a.fromH + wrap(B.out - a.fromH) * k);
      play(P, STAND);
      if (a.t >= BED_SECS.back) { a.phase = BED_ON[1]; a.t = 0; }
      return;
    }
    const on = BED_ON.indexOf(a.phase), off = BED_OFF.indexOf(a.phase);
    if (on > 0 || off >= 0) {
      const p = wardPose(P, B, a.phase, a.t);
      if (!p.done) return;
      a.t = 0;
      if (on > 0) { a.phase = BED_ON[on + 1] || 'lying'; if (a.phase === 'lying') { r.state = 'lying'; ward.counts.walkedIn++; } }
      else if (BED_OFF[off + 1]) a.phase = BED_OFF[off + 1];
      else {
        // (off the bed, on their feet at its side: along it past its foot, as they came, then away out of the hangar)
        P.pose = null; P.bed = null; P.pos.copy(standOf(P, B)); P.heading = B.out; play(P, STAND, { fade: 0.3 });
        r.state = 'leaving'; r.from = P.pos.clone(); r.unseen = 0; r.since = clock; B.P = null; ward.counts.left++;
        a.phase = 'off'; a.t = 0; a.from = P.pos.clone();
      }
      return;
    }
    if (a.phase === 'lying') {
      P.scripted = true;
      wardPose(P, B, 'lying', 0);
      // (the stay over: gone, if nobody sees them; else up and off)
      if (clock >= r.leaveAt) { if (!P.shown) wardGone(P); else { a.phase = BED_OFF[0]; a.t = 0; } }
    }
  }
  // in their bed at once, lying (the crew member gone off, or come back to a ward that has people in it)
  function placeInBed(P) {
    const r = P.rescued, B = wardBeds[r.bed];
    if (P.req) { P.req.dropped = true; P.req = null; }
    release(P); bubbles.clear(P);
    Object.assign(P, { walking: false, way: null, yielding: null, blocker: null, held: 0, heldAll: 0, side: 0, sideOn: 0, sideOnAim: 0, scripted: true });
    P.act = { kind: 'ward', phase: 'lying', t: 0, len: Infinity, step: { do: 'ward' }, spot: { pos: B.walkTo.clone(), heading: B.out, name: 'ward bed ' + B.n }, placed: true };
    r.state = 'lying'; B.P = P;
    wardPose(P, B, 'lying', 0);
    const z = W.zoneAt(P.pos); if (z && z !== P.zone) { P.zone = z; shine(P.c, W.envAt(P.pos)); }
    P.fresh = true; stillV++;
  }
  function wardGone(P) {
    const i = ward.list.indexOf(P); if (i >= 0) ward.list.splice(i, 1);
    const r = P.rescued; if (r && r.bed >= 0 && wardBeds[r.bed] && wardBeds[r.bed].P === P) wardBeds[r.bed].P = null;
    if (P.req) { P.req.dropped = true; P.req = null; }
    bubbles.clear(P); remove(P); ward.counts.gone++; stillV++;
  }
  function wardClear() {
    for (const P of [...ward.list]) wardGone(P);
    for (const r of ward.queue) { r.cleared = true; if (r.P) { r.P.c.dispose(); r.P = null; } }
    ward.queue.length = 0;
    for (const B of wardBeds) B.P = null;
  }
  // (their bodies made one at a time, the crew kit's far copy with them, as everyone's)
  function wardMake() {
    const r = ward.queue.find((q) => !q.P && !q.failed && !q.cleared); if (!r || ward.making) return;
    ward.making = true;
    const t0 = performance.now();
    // (no name: nobody knows theirs; the medic at the scanner says her hello without one, scanSay)
    body({ id: 'rescued-' + (++ward.n), name: '', look: sleeperRecipe(lib, r.look, r.position) }, ward.foot || wardHome?.pos || new THREE.Vector3(), 0).then((P) => {
      ward.making = false; ward.ms += performance.now() - t0;
      if (!P) { r.failed = true; return; }
      if (r.cleared) { P.c.dispose(); return; }
      // (their day: the ward's one errand; about the station, the station's own things, begun at a step of their own)
      const about = r.state === 'about';
      Object.assign(P, { order: 2e6 + ward.n, day: about ? ABOUT_DAY : [{ do: 'ward' }], k: about ? startOf(r.k ?? ward.n) - 1 : 0, speed: rnd(...LIFE.speed), act: null, way: null, wi: 0, req: null, held: 0, still: 0, gain: 0, lastGain: P.pos.clone(), side: 0, sat: 0, by: null, away: false, rescued: r });
      r.P = P;
    }).catch((e) => { ward.making = false; r.failed = true; console.warn('people: a rescued person was not made: ' + (e && e.message ? e.message : e)); });
  }
  // (one of the queue, made, into the station: in bed, or at the ramp's foot to walk)
  function wardIn(r, walk) {
    const P = r.P, B = r.bed >= 0 ? wardBeds[r.bed] : null, about = r.state === 'about';
    ward.queue.splice(ward.queue.indexOf(r), 1);
    if (!walk) {
      if (about) { list.push(P); ward.list.push(P); aboutPlace(P); ward.counts.about++; return; }      // (about the station at once)
      if (!B) { P.c.dispose(); ward.counts.home++; return; }      // (home, off screen)
      list.push(P); ward.list.push(P); placeInBed(P); ward.counts.put++; return;
    }
    P.pos.copy(ward.foot); P.drawnY = P.pos.y; P.lastGain.copy(P.pos);
    // (turned the way they will go: to the medical centre, for a bed or the scanner; the hangar's way out, for the station)
    const to = B ? B.walkTo : about && r.scan && scanA ? scanA.pos : wardHome ? wardHome.pos : P.pos; P.heading = Math.atan2(to.x - P.pos.x, to.z - P.pos.z);
    P.zone = W.zoneAt(P.pos); if (P.zone) shine(P.c, W.envAt(P.pos));
    r.state = B ? 'toBed' : about ? 'about' : 'home'; r.since = clock; r.from = P.pos.clone(); r.unseen = 0; if (B) B.P = P;
    list.push(P); ward.list.push(P); ward.counts.came++; if (about) ward.counts.about++; else if (!B) ward.counts.home++;
    // (about the station: their day begun, as anyone's)
    if (about) next(P); else begin(P, B ? bedAct(B) : homeAct());
    ward.last = clock; stillV++;
  }
  // each frame: whose ward it is, the bodies made, the rescued come down the ramp one after another, and the rules
  // (watched or not; late; gone once unseen)
  const roomNow = (pos) => { const z = W.zoneAt(pos); return z ? z.id : null; };
  function wardUpdate(dt, player, camera) {
    // (whose ward: the crew member playing; another one, theirs, from their save: those still in bed)
    const c = crew ? crew() : null, id = c ? c.id : null;
    // (and those of them about the station, bed -1, about it again, their turn at the scanner still to come if it was)
    if (id !== ward.for) { wardClear(); ward.for = id; if (c && c.ward) for (const r of kept(c.ward)) if (r.bed < 0 || (wardBeds[r.bed] && wardBeds[r.bed].side)) ward.queue.push({ ...r, scan: !!r.scan, leaveAt: clock + (r.until - Date.now()) / 1000, placed: true, state: r.bed < 0 ? 'about' : 'lying' }); }
    if (!ward.queue.length && !ward.list.length) return;
    wardMake();
    const watch = !!player && watching(roomNow(player.pos)) || !!(player && boarding && /^medic\//.test(boarding.where(player.pos) || ''));
    ward.watch = watch;
    // (the queue: in bed at once (come back to, or nobody along the way), or down the ramp one after another, never
    // where the camera sees them appear; seen there a while, down the ramp all the same)
    for (const r of [...ward.queue]) {
      if (!r.P) continue;
      if (r.placed || !watch || !ward.foot || (r.bed < 0 && !wardHome)) { wardIn(r, false); continue; }
      if (clock - ward.last < WARD.gap) break;
      if (someoneAt(ward.foot, null, LIFE.body + 0.1, true)) break;
      const seen = seenAt(ward.foot, W.zoneAt(ward.foot), camera);
      ward.footSeen = seen ? ward.footSeen + dt : 0;
      if (seen && ward.footSeen < 8) break;
      wardIn(r, true);
      break;
    }
    for (const P of [...ward.list]) {
      const r = P.rescued;
      if (r.state === 'about') aboutStep(P);
      else if (r.state === 'toBed') {
        // (on their way to bed: in it at once if the crew member has gone off; not there by WARD.late: put there, loudly)
        if (!watch) { placeInBed(P); ward.counts.put++; continue; }
        if (clock - r.since > WARD.late) { alarms.wardLate = (alarms.wardLate || 0) + 1; ward.counts.late++; console.warn('people: ward: ' + P.id + ' not in bed after ' + WARD.late + ' s, put there (at ' + P.pos.toArray().map((v) => v.toFixed(2)) + ')'); placeInBed(P); ward.counts.put++; }
      } else if (r.state === 'home' || r.state === 'leaving') {
        // (on their way out: gone once nobody sees them, a few metres on; at once with nobody along the way)
        r.unseen = P.shown ? 0 : (r.unseen || 0) + dt;
        // (one who was about the station, wherever in it they are: gone once nobody sees them)
        if (r.bed < 0 && r.state === 'leaving' ? r.unseen > WARD.gone : !watch || (r.unseen > WARD.gone && P.pos.distanceTo(r.from) > 6)) wardGone(P);
        // (no way out found by WARD.late: gone all the same, loudly)
        else if (clock - r.since > WARD.late) { alarms.wardLate = (alarms.wardLate || 0) + 1; ward.counts.late++; console.warn('people: ward: ' + P.id + ' found no way out in ' + WARD.late + ' s, gone (at ' + P.pos.toArray().map((v) => v.toFixed(2)) + ')'); wardGone(P); }
      }
    }
  }
  // AS THE RUN ENDS AT HOME (src/trip.js): the rescued, [{ look, position }] in the order they came aboard. The free
  // beds to the first; the rest home. -> { beds: how many have one, saved: [{ look, position, bed, until }] (for the crew
  // member's save: those in bed, until when on the wall clock) }
  function wardAdmit(who = []) {
    // (a bed is taken by whoever is on their way to it or in it, or still to come down the ramp to it)
    const taken = new Set([...ward.list.filter((P) => P.rescued.state === 'toBed' || P.rescued.state === 'lying').map((P) => P.rescued.bed), ...ward.queue.map((r) => r.bed)].filter((i) => i >= 0));
    const beds = assign(who.length, wardBeds.map((B) => ({ n: B.n, side: B.walkTo ? B.side : 0 })), taken);
    // (the others, with no bed: to the scanner first, or about the station; home only past the room there is for them)
    const isAbout = (r) => r.state === 'about';
    const rest = othersDo(beds.filter((b) => b < 0).length, ABOUT.most - ward.list.filter((P) => isAbout(P.rescued)).length - ward.queue.filter(isAbout).length);
    ward.foot = wardFoot();
    const saved = [];
    let j = 0;
    who.forEach((w, k) => {
      const stay = stayFor(), o = beds[k] >= 0 ? null : rest[j++];
      const r = { look: w.look, position: w.position || null, bed: beds[k], leaveAt: clock + stay, until: Math.round(Date.now() + stay * 1000), state: beds[k] >= 0 ? 'toBed' : o === 'home' ? 'home' : 'about', scan: o === 'scan', k: o ? j - 1 : null };
      ward.queue.push(r);
      if (r.bed >= 0) saved.push({ look: r.look, position: r.position, bed: r.bed, until: r.until });
      else if (r.state === 'about') saved.push({ look: r.look, position: r.position, bed: -1, until: r.until, ...(r.scan ? { scan: 1 } : {}) });
    });
    ward.last = clock;      // (the first a moment after the crew member is up)
    return { beds: beds.filter((b) => b >= 0).length, about: rest.filter((o) => o !== 'home').length, scan: rest.filter((o) => o === 'scan').length, saved };
  }

  // (anyone, or the player, within r of a point; `present`: only those about the player, not those away)
  function someoneAt(p, P, r, present = false) {
    for (const Q of list) if (Q !== P && !Q.hidden && !(present && Q.away) && !(!present && P && Q.away !== P.away) && Math.hypot(Q.pos.x - p.x, Q.pos.z - p.z) < r && Math.abs(Q.pos.y - p.y) < 1.2) return Q;
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
      const t = P.pos.clone(); walls.move(t, _y.x - P.pos.x, _y.z - P.pos.z, 0.26, openFor(P));
      if (Math.hypot(t.x - _y.x, t.z - _y.z) > 0.1 || patchFor(P, t.x, t.z) || someoneAt(t, P, LIFE.body) || nearTruck(P, t.x, t.z)) continue;
      // (the further from the line the other is walking along, the better)
      const score = Math.abs(s) - Math.max(0, b) * 0.5 + Math.random() * 0.05;
      if (score > bs) { bs = score; best = t; }
    }
    return best;
  }
  // walking the way, keeping clear of everyone (everyone about as they are: someone away passes nobody, and nobody them)
  const _d = new THREE.Vector3(), _t = new THREE.Vector3();
  // (someone away opens no doors (nobody sees them): the station's own doors they pass as if open; never a parked
  // ship's (its stairs, ramps and lift, all in the hangars), a locked door or the scanner's ring)
  const homeDoors = walls.doors.filter((d) => !d.locked && !d.glide && !d.part && !/^hangar/.test((d.D && d.D.zone) || ''));
  const byDoor = (p) => { for (const d of homeDoors) { const b = d.box; if (p.x > b.min.x - 0.9 && p.x < b.max.x + 0.9 && p.z > b.min.z - 0.9 && p.z < b.max.z + 0.9) return true; } return false; };
  const openFor = (P) => !!P.away && byDoor(P.pos);
  // (the others near: everyone else about as they are, and the player (if they are about))
  function othersOf(P) {
    others.length = 0;
    for (const Q of list) if (Q !== P && !Q.hidden && Q.away === P.away && !Q.scripted && Math.abs(Q.pos.x - P.pos.x) < 2.5 && Math.abs(Q.pos.z - P.pos.z) < 2.5 && Math.abs(Q.pos.y - P.pos.y) < 1.5) others.push(Q);
    if (playerNow && !P.away && Math.abs(playerNow.pos.x - P.pos.x) < 2.5 && Math.abs(playerNow.pos.z - P.pos.z) < 2.5 && Math.abs(playerNow.pos.y - P.pos.y) < 1.5) others.push(playerNow);
    return others;
  }
  const posOf = (Q) => Q.pos;
  // CARGO'S FORKLIFT (src/cargoforklift.js ride.outline(): its body, carriage, forks or the pallet on them, where it is
  // just now): nobody's whole body on it (the coordinator's replay, 2026-11-20: Sami walked by it waiting, his middle
  // 0.12 m from its forks, too low for the walls to feel). A step that would bring someone's middle nearer than
  // LIFE.clear to it, and nearer than it was, is not taken; ways are worked out round it. Not its driver on the way to
  // its seat (they get on it), nor anyone not on Cargo's floor.
  let truckNow = null;
  const truckFor = (P) => !!truckNow && !(P.act && P.act.kind === 'drive') && Math.abs(P.pos.y - STORE.floor) < 1;
  function byTruck(P, x0, z0, x1, z1) {
    if (!truckFor(P)) return false;
    for (const o of truckNow) { const g = pointGap(o, x1, z1); if (g < LIFE.clear && g < pointGap(o, x0, z0) - 1e-9) return true; }
    return false;
  }
  function nearTruck(P, x, z) {
    if (!truckFor(P)) return false;
    for (const o of truckNow) if (pointGap(o, x, z) < LIFE.clear + 0.05) return true;
    return false;
  }
  // (a step as it was taken (walls.move slides along a wall, so it can end elsewhere than it was aimed): undone if it
  // ended nearer than LIFE.body to anyone, and nearer than it began -> who, or null)
  function unbump(P, from, apart = LIFE.body) {
    const b = bumps(from.x, from.z, P.pos.x, P.pos.z, others, posOf, apart);
    if (b) P.pos.copy(from);
    return b;
  }
  // (the floor across at someone, sx sz their right, too narrow for two middles to pass forward: passing.js roomFor, a
  // body 0.26 m across each way against the walls, as they walk)
  const narrowAt = (P, sx, sz) => { const need = roomFor(0.26), [l, r] = roomAt(P.pos.x, P.pos.z, sx, sz, (x, z) => walls.free(x, P.pos.y, z, 0.26), need, 0.03); return l + r < need - 0.03; };
  const _u = new THREE.Vector3();
  function walk(P, dt) {
    P.walkT = (P.walkT || 0) + dt;
    // (making way for someone: to the spot aside, then waiting there till they have gone by; never into anyone)
    if (P.yielding) {
      const Y = P.yielding; Y.t += dt;
      const yx = Y.to.x - P.pos.x, yz = Y.to.z - P.pos.z, yd = Math.hypot(yx, yz);
      if (yd > 0.05 && Y.t < 2) {
        const s = Math.min(yd, P.speed * 0.8 * dt);
        P.heading = wrap(P.heading + Math.sign(wrap(Math.atan2(yx, yz) - P.heading)) * Math.min(Math.abs(wrap(Math.atan2(yx, yz) - P.heading)), LIFE.turn * dt));
        othersOf(P); _u.copy(P.pos);
        let g = walls.move(P.pos, yx / yd * s, yz / yd * s, 0.26, openFor(P));
        if (unbump(P, _u)) g = 0;
        else if (byTruck(P, _u.x, _u.z, P.pos.x, P.pos.z)) { P.pos.copy(_u); g = 0; }
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
    othersOf(P);
    // (there: on the spot itself, unless that would put them into someone standing at its edge: there as they are)
    if (P.wi >= W2.length - 1 && gd < 0.08) { if (!bumps(P.pos.x, P.pos.z, goal.x, goal.z, others, posOf) && !byTruck(P, P.pos.x, P.pos.z, goal.x, goal.z)) { P.pos.x = goal.x; P.pos.z = goal.z; } arrive(P); stillV++; return; }
    let dx = gx / (gd || 1), dz = gz / (gd || 1);
    // in the lane ahead (passing.js passBy): met head on by someone walking the other way, or by the player coming at
    // them, each keeps to their own right (the player is not steered: they make room on their right, or, the player
    // coming down that side already, on their left); someone standing, or walking on ahead, passed on the side away
    const sx = -dz, sz = dx, myH = Math.atan2(dx, dz); let steer = 0, slow = 1;
    for (const Q of others) {
      const me = Q === playerNow, coming = me ? (Q.speed || 0) > 0.3 && facing(Q.heading, myH) : !!Q.walking && facing(Q.heading, myH);
      const r = passBy(dx, dz, Q.pos.x - P.pos.x, Q.pos.z - P.pos.z, { coming, player: me, walking: !me && !!Q.walking, lane: LIFE.lane });
      if (!r) continue;
      steer += r.steer; slow = Math.min(slow, r.slow);
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
    // (their body overlapping someone's (middles nearer than LIFE.body, squeezing past): at half speed, PASS.slow)
    let step = Math.min(gd, P.speed * slow * dt * (overlaps(P.pos.x, P.pos.z, others, posOf) ? PASS.slow : 1)), by = null;
    // never onto a patch kept off: steering round someone that would, straight along the way instead (unless already
    // on one: off it then)
    if (patchFor(P, P.pos.x + dx * step, P.pos.z + dz * step) && !patchFor(P, P.pos.x, P.pos.z)) {
      const ux = gx / (gd || 1), uz = gz / (gd || 1);
      if (!patchFor(P, P.pos.x + ux * step, P.pos.z + uz * step)) { dx = ux; dz = uz; } else by = 'patch';
    }
    // never to within LIFE.body of anyone (a step that would bring them closer than that is not taken; nor one that,
    // slid along a wall, ends that near)
    _d.set(P.pos.x + dx * step, 0, P.pos.z + dz * step);
    if (!by) by = bumps(P.pos.x, P.pos.z, _d.x, _d.z, others, posOf);
    // SQUEEZED PAST (the game's maker, 2026-11-21: "In the narrow places too, he turns side-on and you squeeze past each
    // other"): held by someone walking (or the player) where the floor across is too narrow for two to pass forward
    // (passing.js roomFor; the station's halls never are, a ship's cabin's narrow places are), the middles as near as
    // PASS.squeeze, turned side-on facing them (P.sideOn), at half speed while overlapping (above)
    let apart = LIFE.body;
    if (by && typeof by === 'object' && (by === playerNow || by.walking) && narrowAt(P, sx, sz)) {
      apart = PASS.squeeze; alarms.squeezes = (alarms.squeezes || 0) + 1;
      if (!P.sideOnAim) P.sideOnAim = sideOn((by.pos.x - P.pos.x) * sx + (by.pos.z - P.pos.z) * sz);
      by = bumps(P.pos.x, P.pos.z, _d.x, _d.z, others, posOf, apart);
    }
    if (!by && byTruck(P, P.pos.x, P.pos.z, _d.x, _d.z)) by = 'truck';
    let got = 0;
    if (!by) { _u.copy(P.pos); got = walls.move(P.pos, dx * step, dz * step, 0.26, openFor(P)); const b = unbump(P, _u, apart); if (b) { by = b; got = 0; } else if (byTruck(P, _u.x, _u.z, P.pos.x, P.pos.z)) { P.pos.copy(_u); by = 'truck'; got = 0; } }
    // (turned side-on till nobody is within PASS.turnOff, eased round)
    if (P.sideOnAim && !others.some((Q) => Math.hypot(Q.pos.x - P.pos.x, Q.pos.z - P.pos.z) < PASS.turnOff)) P.sideOnAim = 0;
    { const sd = (P.sideOnAim || 0) - (P.sideOn || 0); P.sideOn = (P.sideOn || 0) + Math.sign(sd) * Math.min(Math.abs(sd), 5 * dt); }
    // (pressed into a corner, or steered into one: the freest small step near the way wanted, never back the way they
    // came, onto a patch or toward anyone)
    if (!by && got < step * 0.3) {
      const ux = gx / (gd || 1), uz = gz / (gd || 1);
      let bx = 0, bz = 0, bd = 0.2;
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2, vx = Math.sin(a), vz = Math.cos(a), dot = vx * ux + vz * uz;
        if (dot <= bd) continue;
        _t.copy(P.pos);
        if (walls.move(_t, vx * step, vz * step, 0.26, openFor(P)) < step * 0.7 || patchFor(P, _t.x, _t.z) || byTruck(P, P.pos.x, P.pos.z, _t.x, _t.z) || others.some((Q) => Math.hypot(Q.pos.x - _t.x, Q.pos.z - _t.z) < LIFE.body && Math.hypot(Q.pos.x - _t.x, Q.pos.z - _t.z) < Math.hypot(Q.pos.x - P.pos.x, Q.pos.z - P.pos.z))) continue;
        bd = dot; bx = vx; bz = vz;
      }
      if (bx || bz) got += walls.move(P.pos, bx * step, bz * step, 0.26, openFor(P));
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
      P.held += dt; P.by = by && by === playerNow ? 'player' : by === 'patch' ? 'patch' : by === 'truck' ? 'forklift' : by ? 'person' : 'wall';
      const still = !by || by === 'patch' || by === 'truck' || (by !== playerNow && !by.walking), end = P.way[P.way.length - 1];
      // (the scanner's patient and medic keep at it: a scan is not dropped for someone standing near; they work the way
      // out again round them, and give up only after twice as long)
      const keen = P.act && (P.act.kind === 'scan' || P.act.kind === 'scanMedic' || P.act.kind === 'drive' || P.act.kind === 'ward');
      if (still && !keen && P.held > LIFE.stillWait && Math.hypot(end.x - P.pos.x, end.z - P.pos.z) < 1.6) { alarms.gaveUp++; P.side = 0; P.held = 0; next(P); return; }
      if (P.held > LIFE.sidestep && !P.side) P.side = Math.random() < 0.75 ? 0.9 : -0.9;
      // (the way worked out again whenever held this long, at most once in LIFE.replanEvery seconds; held up too long in
      // all, they give it up)
      P.heldAll = (P.heldAll || 0) + dt;
      if (P.held > (still ? LIFE.stillWait : LIFE.replan) && (P.lastReplan == null || P.walkT - P.lastReplan > LIFE.replanEvery)) { P.lastReplan = P.walkT; P.side = 0; stillV++; route(P, end); return; }
      if (P.heldAll > LIFE.giveUp * (keen ? 2 : 1)) { alarms.gaveUp++; P.side = 0; P.held = 0; next(P); return; }
      play(P, STAND);
    } else {
      if (P.held > 0.5) P.side = P.side * 0.98;
      P.heldAll = Math.max(0, (P.heldAll || 0) - dt * 0.5);
      P.held = Math.max(0, P.held - dt * 2); if (P.held === 0) { P.side *= Math.exp(-dt * 1.5); if (Math.abs(P.side) < 0.05) P.side = 0; }
      const v = got / Math.max(dt, 1e-4);
      if (v < 0.35) play(P, STAND); else if (Math.abs(P.sideOn || 0) > 0.8) play(P, P.sideOn > 0 ? 'Run_Right' : 'Run_Left', { speed: 0.4 });
      else play(P, CLIPS.walk, { speed: Math.max(0.6, Math.min(1.5, v / P.c.stride.Walk)) });
    }
  }

  // ── the loud alarms: counted as they happen (each person's first of a kind also said in the console) ─────────
  let auditClock = 0;
  function audit(dt) {
    auditClock += dt; if (auditClock < 0.25) return;
    auditClock = 0;
    // (the scanner's ring gliding with nobody on its bed: never)
    if (scanD && scanD.use && !(SCAN && SCAN.busy && SCAN.busy.patient && SCAN.busy.patient.act && SCAN.busy.patient.act.phase === 'lying')) { alarms.emptyScan = (alarms.emptyScan || 0) + 1; }
    for (const P of list) {
      if (P.hidden) continue;
      // stuck: a way to go, and less than 0.4 m from where they were LIFE.stuck seconds ago (as the crow flies, so someone
      // jiggling back and forth on the spot is stuck too); making way for someone is not being stuck
      const tr = P.trail || (P.trail = []);
      if (P.walking && !P.yielding && !(P.cap && P.cap.busy)) {
        tr.push(P.pos.x, P.pos.z); if (tr.length > 2 * Math.round(LIFE.stuck / 0.25 + 1)) tr.splice(0, 2);
        const full = tr.length >= 2 * Math.round(LIFE.stuck / 0.25 + 1), moved = Math.hypot(P.pos.x - tr[0], P.pos.z - tr[1]);
        // (not getting anywhere for two seconds, walking or not: held, so they stand and work the way out afresh)
        const two = tr.length >= 18 ? Math.hypot(P.pos.x - tr[tr.length - 18], P.pos.z - tr[tr.length - 17]) : Infinity;
        P.jam = two < 0.3;
        if (full && moved < 0.4 && !P.stuckSaid) {
          P.stuckSaid = true;
          // (waiting for the player to get out of the way is good manners, not stuck: counted apart)
          if (P.by === 'player') alarms.waitedForPlayer = (alarms.waitedForPlayer || 0) + 1;
          else alarm('stuck', P, 'at ' + P.pos.toArray().map((v) => v.toFixed(2)) + ' (held by ' + (P.by || '?') + ', ' + (P.act?.spot?.name || P.act?.kind) + (P.away ? ', away' : '') + ')');
        } else if (moved > 0.8) P.stuckSaid = false;
      } else { tr.length = 0; P.jam = false; }
      if (P.scripted) continue;      // (the scanner's patient, on its bed and along its side: where they are meant to be)
      // in a wall (a sitter is on a seat: not counted)
      const sitting = P.act && (P.act.phase === 'sat' || P.act.phase === 'sitting' || P.act.phase === 'rising');
      if (!sitting && !walls.free(P.pos.x, P.pos.y, P.pos.z, 0.18, true)) alarm('inWall', P, 'at ' + P.pos.toArray().map((v) => v.toFixed(2)) + ' (' + (P.act ? P.act.kind + ' ' + (P.act.phase || '') + ' ' + (P.act.spot?.name || '') : '-') + (P.walking ? ', walking' : '') + (P.yielding ? ', making way' : '') + ')');
      // in another person (or the player): deeper than the outer half of their bodies (PASS.squeeze, a centimetre
      // given: squeezing past, the outer halves may overlap; alarms.overlaps counts those quietly, nearer than LIFE.body),
      // only among those about (someone away is not there to bump into), on the same floor (the player in Cargo is not
      // in someone on the main deck over their head: counted so before, 2026-11-20)
      if (!P.away) {
        const what = (X) => X.id + ' at ' + X.pos.toArray().map((v) => v.toFixed(2)) + ' (' + (X.act ? X.act.kind + ' ' + (X.act.phase || '') + ' ' + (X.act.spot?.name || '') : '-') + (X.walking ? ', walking' : '') + (X.yielding ? ', making way' : '') + ')';
        const inside = PASS.squeeze - 0.01, over = LIFE.body - 0.01;
        const check = (Q, d, who) => { if (d < inside) alarm('inPerson', P, who); else if (d < over) alarms.overlaps = (alarms.overlaps || 0) + 1; };
        for (const Q of list) if (Q !== P && !Q.hidden && !Q.away && !Q.scripted && Q.id > P.id && Math.abs(Q.pos.y - P.pos.y) < 1) { const d = Math.hypot(Q.pos.x - P.pos.x, Q.pos.z - P.pos.z); if (d < over) check(Q, d, what(P) + ' and ' + what(Q)); }
        if (playerNow && Math.abs(playerNow.pos.y - P.pos.y) < 1) { const d = Math.hypot(playerNow.pos.x - P.pos.x, playerNow.pos.z - P.pos.z); if (d < over) check(playerNow, d, 'and the player'); }
      }
      // on a patch kept off (a job's ring, a ship's way in, under the crane, the scanner)
      if (patchFor(P, P.pos.x, P.pos.z) && !sitting) alarm('onPatch', P, 'at ' + P.pos.toArray().map((v) => v.toFixed(2)));
    }
  }

  // ── for the station: who the doors open for, who a ship's way waits for (only those about the player) ────────
  const eyeList = [];
  // (the control room's and Cargo's people open no doors (theirs is the lift's, which the lift works) and stand on no
  // ship's way: they are not on the main deck)
  function eyes() { eyeList.length = 0; for (const P of list) if (!P.hidden && !P.home && !P.away && (P.walking || P.req || P.yielding || (P.act && P.act.phase === 'go'))) eyeList.push(P.pos); return eyeList; }
  const _wp = new THREE.Vector3();
  function onWays(out) {
    for (const P of list) { if (P.hidden || P.home || P.away) continue; for (const w of wayFeet) { const q = w.ship && w.ship.moved ? _wp.copy(P.pos).applyMatrix4(w.ship.Di) : P.pos; if (q.x > w.box.min.x - 0.5 && q.x < w.box.max.x + 0.5 && q.z > w.box.min.z - 0.5 && q.z < w.box.max.z + 0.5) { out.push(P.pos); break; } } }
    return out;
  }

  // ── for the plan from above ──────────────────────────────────────────────────────────────────────────────────
  const COL = { post: '#ffb347', stand: '#8fd3ff', sit: '#c6a0ff', talk: '#7dff9a', walk: '#ff8fb0', scan: '#ff6b6b', scanMedic: '#ff6b6b' };
  function plan({ labels = false } = {}) {
    const spots = [], routes = [], notes = [];
    for (const [g, L] of Object.entries(groups)) for (const s of L.filter(Boolean)) spots.push({ at: [s.pos.x, s.pos.z], face: s.heading, label: labels ? s.name : null, colour: s.who ? '#fff' : '#9ab', kind: 'stand', group: g });
    for (const [g, L] of Object.entries(seats)) for (const s of L) spots.push({ at: [s.seat.x, s.seat.z], face: s.heading, kind: 'sit', colour: COL.sit, group: g });
    for (const [g, L] of Object.entries(talks)) for (const T of L) for (const p of T.at) spots.push({ at: [p.x, p.z], kind: 'talk', colour: COL.talk, group: g, label: labels ? T.name : null });
    for (const P of list) {
      const kind = P.act ? P.act.kind : 'wait';
      spots.push({ at: [P.pos.x, P.pos.z], face: P.heading, label: labels || kind === 'post' || P.cap ? P.id + (P.away ? ' (away)' : '') : null, colour: P.away ? '#666' : COL[kind] || '#fff', kind: 'person' });
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
  // (how many about at once: by the picture's quality, or the address's ?crowd=N, for the cost rigs; ?far=N: the far
  // copy from N metres, ?drawn=N: at most N drawn)
  const Q0 = new URLSearchParams(location.search), asked = +Q0.get('crowd');
  const quality = W.quality in NEAR ? W.quality : 'medium';
  nearMost = asked > 0 ? Math.min(asked, ROSTER.length) : NEAR[quality];
  drawnMost = +Q0.get('drawn') > 0 ? +Q0.get('drawn') : LIFE.drawn[quality];
  farAt = Q0.has('far') ? +Q0.get('far') : LIFE.far[quality];
  // (the voices' clips fetched now, made ready to play once the player touches the page: sound.js)
  for (const def of ROSTER) {
    const V = def.voice && VOICES[def.voice]; if (V) for (const id of V.hellos) sound.load(id, clipUrl(id));
    const K = CAPTAINS[def.id]; if (def.captain && K) for (const x of [K.offer, K.yes, K.hello, K.signed]) if (x && x.clip) sound.load(x.clip, clipUrl(x.clip));
  }
  // where each comes aboard: their first spot (a post's own, or the first free spot of their day), placed there at once
  for (const def of ROSTER) {
    const day = def.day.map((d) => (typeof d === 'string' ? { do: d } : d));
    const P0 = { id: def.id, name: def.name, day, k: 0, pos: null, away: false };
    let first = null;
    for (let k = 0; k < day.length && !first; k++) { first = claimFor(P0, day[k]); if (first) P0.k = k; }
    if (!first) { missing.push(def.id + ' (nowhere to be)'); continue; }
    const P = await body(def, first.spot.pos, first.spot.heading ?? 0);
    if (!P) { release(P0); continue; }
    Object.assign(P, { order: list.length, day, k: P0.k, speed: rnd(...LIFE.speed), act: null, way: null, wi: 0, req: null, held: 0, still: 0, gain: 0, lastGain: P.pos.clone(), side: 0, sat: 0, by: null, away: false });
    P.claim = P0.claim; handOver(P.claim, P0, P);
    begin(P, first, true);
    list.push(P); say(list.length);
  }
  // (a scan begun as they came aboard, the patient placed on the bed: its medic at the screen too)
  if (SCAN && SCAN.busy) {
    const { medic } = SCAN.busy;
    if (medic && medic.act && medic.act.kind === 'scanMedic') { medic.pos.copy(medic.act.spot.pos); medic.heading = medic.act.spot.heading; medic.act.phase = 'do'; }
  }
  // the nearest NEAR to where the camera is about at once (a pair together), the rest away (out of sight) from the start
  {
    const focus = W.camera.position;
    for (const P of list) P.rank = P.pos.distanceTo(focus);
    for (const P of list) { const Q = partner(P); P.rankPair = Q ? Math.min(P.rank, Q.rank) : P.rank; }
    const by = [...list].sort((a, b) => a.rankPair - b.rankPair || a.order - b.order), want = new Set(by.slice(0, nearMost));
    for (const P of [...want]) { const Q = partner(P); if (Q) want.add(Q); }
    for (const P of list) P.away = !want.has(P);
  }

  // ── THE PLACES ONLY THE LIFT GOES TO: the control room's people and Cargo's (life.js ROOM_CREW) ───────────────
  // (the game's maker, 2026-11-20: "One crew member always sitting at the radio desk and one at traffic control, and one
  // at the store's shipping desk", "a few people in each place"). Nobody walks there, so nobody of theirs walks away:
  // each place's people (P.home) live their day in it, and only while the player is in it (`place` in update(): the lift's
  // crewAt, the stop it is going to from the moment its doors are shut). MADE the first time they may be wanted (the
  // player steps into the lift: `soon`, or is in their place), one body at a time, and kept after; until then nothing of
  // them is loaded or built. PUT IN, each at a moment of their day picked at random, where nobody sees it happen: while
  // their room is not drawn (the lift's doors shut on the way there), or else at a spot out of the camera's view. TAKEN
  // OUT the moment their place is left (the doors shut on it): out of the scene, their day stopped, nothing of them
  // worked out. They are not counted among the nearest about the player (presence): in their place nobody else is drawn.
  const HOMES = {};
  for (const def of ROOM_CREW) (HOMES[def.place] || (HOMES[def.place] = { id: def.place, defs: [], people: [], making: null, made: false, ms: 0, tries: 0 })).defs.push(def);
  const stopAt = (id) => { const S = STOPS.find((s) => s.id === id); return S ? new THREE.Vector3(...S.at) : new THREE.Vector3(); };
  function makeHome(H) {
    if (H.making || H.made) return;
    H.making = (async () => {
      for (const def of H.defs) {
        const V = def.voice && VOICES[def.voice]; if (V) for (const id of V.hellos) sound.load(id, clipUrl(id));
        const t0 = performance.now(), P = await body(def, stopAt(H.id), 0);
        H.ms += performance.now() - t0;
        if (!P) continue;
        const day = def.day.map((d) => (typeof d === 'string' ? { do: d } : d));
        Object.assign(P, { order: list.length, day, k: 0, speed: rnd(...LIFE.speed), act: null, way: null, wi: 0, req: null, held: 0, still: 0, gain: 0, lastGain: P.pos.clone(), side: 0, sat: 0, by: null, away: false, home: H.id, hidden: true });
        list.push(P); H.people.push(P);
      }
      H.made = true;
    })().catch((e) => { console.warn('people: the ' + H.id + '\'s people were not made: ' + (e && e.message ? e.message : e)); H.made = true; });
  }
  // (would someone standing there be in view: their room drawn, near enough and in front of the camera, as inView)
  const seenAt = (pos, zone, camera) => { _s.center.set(pos.x, pos.y + 0.95, pos.z); return !!(zone && zone.group.visible) && camera.position.distanceTo(pos) < SEEN && _f.intersectsSphere(_s); };
  function putIn(P, camera, drawn) {
    // (a moment of their day picked at random: the first step that can be had, from a step picked at random; never a
    // walk, which would start them where another walker of the same round may be put)
    const n = P.day.length, k0 = Math.floor(Math.random() * n);
    let first = null;
    for (let i = 0; i < n && !first; i++) { P.k = (k0 + i) % n; if (!/^(walk|drive):/.test(P.day[P.k].do)) first = claimFor(P, P.day[P.k]); }
    if (!first) return false;
    const at = first.spot.seat || first.spot.pos, zone = W.zoneAt(at);
    // (their room drawn: only somewhere out of the camera's view, else they are left to come a moment later; never
    // where someone is standing, the player or one of theirs walking by, nor by the forklift as it stands just now: a
    // moment later too)
    const onTruck = !!truckNow && Math.abs(first.spot.pos.y - STORE.floor) < 1 && truckNow.some((o) => pointGap(o, first.spot.pos.x, first.spot.pos.z) < LIFE.clear + 0.05);
    if ((drawn && seenAt(at, zone, camera)) || someoneAt(first.spot.pos, P, LIFE.body, true) || someoneAt(at, P, LIFE.body, true) || onTruck) { release(P); return false; }
    P.pos.copy(first.spot.pos); P.heading = first.spot.heading ?? P.heading; P.drawnY = P.pos.y;
    Object.assign(P, { hidden: false, away: false, walking: false, way: null, req: null, yielding: null, blocker: null, pose: null, scripted: false, sitY: 0, held: 0, heldAll: 0, side: 0, jam: false, jammed: false, fleeing: null });
    if (P.trail) P.trail.length = 0;
    P.lastGain.copy(P.pos);
    if (zone && zone !== P.zone) { P.zone = zone; shine(P.c, W.envAt(P.pos)); }
    begin(P, first, true);
    // (already some way into it, each their own: nobody's next move comes in step with anyone's)
    if (P.act && P.act.len) P.act.t = Math.random() * P.act.len * 0.7;
    stillV++;
    return true;
  }
  function takeOut(P) {
    release(P);
    if (P.req) { P.req.dropped = true; P.req = null; }
    bubbles.clear(P);
    Object.assign(P, { act: null, walking: false, way: null, yielding: null, blocker: null, pose: null, scripted: false, hidden: true, shown: false });
    stillV++;
  }
  let homeClock = 0;
  function homes(dt, place, soon, camera) {
    homeClock -= dt;
    for (const H of Object.values(HOMES)) {
      const want = place === H.id;
      if ((want || soon) && !H.made) makeHome(H);
      if (!want) { for (const P of H.people) if (!P.hidden) takeOut(P); continue; }
      const waiting = H.people.filter((P) => P.hidden); if (!waiting.length) continue;
      // (their room drawn now (the player there, the doors open): tried again every half second, out of view only)
      const S = STOPS.find((s) => s.id === H.id), zone = S ? W.room(S.room) : null, drawn = !!(zone && zone.group.visible);
      if (drawn && homeClock > 0) continue;
      for (const P of waiting) { H.tries++; putIn(P, camera, drawn); }
    }
    if (homeClock <= 0) homeClock = 0.5;
  }

  // RUNNING FROM THE CRANE (src/crane.js: the crane worked by hand brings a load down low over someone; the game's
  // maker: "If people are in the way then they should start to run away"): anyone standing or walking within r of
  // (x, z) drops what they are doing and hurries off to a free spot at least `away` metres from there (the way-finder's
  // way, keeping off the patches), then goes on with their day. -> the people sent
  // (inside(pos): a patch of any shape instead of the ring of r, a ship coming down by hand (src/flying.js): whoever is
  // on it goes to the nearest free spot off it, `away` and more from its edge)
  function flee(x, z, r = 2, away = 4.5, { inside = null } = {}) {
    const sent = [];
    for (const P of list) {
      // (someone away is out of sight and out of the crane's way; the scanner's patient is on its bed; the control
      // room's and Cargo's people are not on the main deck)
      if (P.hidden || P.home || P.away || P.fleeing || P.scripted || !P.act) continue;
      if (P.act.phase === 'sat' || P.act.phase === 'sitting' || P.act.phase === 'rising') continue;
      const dx = P.pos.x - x, dz = P.pos.z - z, d = Math.hypot(dx, dz);
      if ((inside ? !inside(P.pos) : d > r) || P.pos.y > 2.4) continue;
      const a0 = d > 0.05 ? Math.atan2(dx, dz) : Math.random() * Math.PI * 2;
      let to = null;
      for (const L of inside ? [d + away, d + away + 2.5, d + away + 5, d + away + 8] : [away + r]) {
        for (const da of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, Math.PI]) {
          const a = a0 + da, p = walls.snap(x + Math.sin(a) * L, P.pos.y + 0.4, z + Math.cos(a) * L, 0.8);
          // (off a ship's patch: and off every patch and its margin, where a way can end)
          if (p && !onPatch(p.x, p.z) && !someoneAt(p, P, LIFE.body) && !(inside && (inside(p) || noGo(p.x, p.z)))) { to = p; break; }
        }
        if (to) break;
      }
      if (!to) continue;
      // (a talk, or a captain's offer, left off: running comes first)
      endTalk(P); if (P.cap && P.cap.busy) endOffer(P);
      P.fleeing = { was: P.speed }; P.speed = Math.max(P.speed, 1.2) * 1.9;
      begin(P, { kind: 'walk', step: { for: [1, 2] }, spot: { pos: to, heading: null }, list: [{ pos: to }], j: 0 });
      sent.push(P);
    }
    return sent;
  }
  // RUNNING ABOUT (src/visit.js: the Miner flown into another ship's hangar; the game's maker, 2026-11-18: "you would
  // hear an alarm and red lights started spinning around in the hanger and people started running around"). Called a
  // couple of times a second for as long as it lasts: everyone on that hangar's floor runs to somewhere else on it,
  // and on again when they get there. avoid(pos): where nobody goes nor passes (under the flown ship, in a shoved
  // one); anyone it comes over runs out from under it at once. Nothing else is done to them: when it is no longer
  // called they finish their run and go on with their day. -> how many are running
  // (where they run to: the hangar's own spots, the places its people stand in their day, by its crates and round its
  // ship: each is known to be somewhere a person can get to and stand; failing those, anywhere free on its floor)
  // PUSHED OUT OF A SHOVED SHIP'S WAY (src/visit.js; the game's maker, 2026-11-19, of someone standing right beside a
  // parked ship as it is rammed: "If they are just standing there then then maybe they deserve to be hit."). B: that
  // hangar's box; to(pos) -> [x, z] where the ship pushes whoever stands at pos, or null where it is not over them.
  // They are moved there if a person can stand there (never into a wall or a crate), and run on from where they are
  // put. -> how many were pushed
  function push(B, to) {
    let n = 0;
    for (const P of list) {
      if (P.hidden || P.home || P.away || P.scripted || P.pos.y > 2.4) continue;
      if (P.act && (P.act.phase === 'sat' || P.act.phase === 'sitting' || P.act.phase === 'rising')) continue;
      if (P.pos.x < B.min.x || P.pos.x > B.max.x || P.pos.z < B.min.z || P.pos.z > B.max.z) continue;
      const t = to(P.pos); if (!t || !walls.free(t[0], P.pos.y, t[1], 0.2) || someoneAt(_rb.set(t[0], P.pos.y, t[1]), P, LIFE.body, true)) continue;
      P.pos.x = t[0]; P.pos.z = t[1]; n++;
    }
    return n;
  }
  const _rb = new THREE.Vector3(), runSpots = new Map();
  function runAbout(zoneId, { avoid = null } = {}) {
    const Z = W.room(zoneId); if (!Z) return 0;
    const B = Z.box, passes = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.75)); for (let i = 1; i <= n; i++) { _rb.set(a.x + (b.x - a.x) * i / n, a.y, a.z + (b.z - a.z) * i / n); if (avoid(_rb)) return true; } return false; };
    if (!runSpots.has(zoneId)) { const L = []; for (const g of Object.values(groups)) for (const s of g) if (s && s.pos && s.pos.y < 1 && onDeck(s.pos) && s.pos.x > B.min.x && s.pos.x < B.max.x && s.pos.z > B.min.z && s.pos.z < B.max.z && !L.some((q) => q.distanceTo(s.pos) < 0.8)) L.push(s.pos); runSpots.set(zoneId, L); }
    const spots = runSpots.get(zoneId);
    let n = 0;
    for (const P of list) {
      if (P.hidden || P.home || P.away || P.scripted || !P.act || P.pos.y > 2.4) continue;
      if (P.act.phase === 'sat' || P.act.phase === 'sitting' || P.act.phase === 'rising') continue;
      if (P.pos.x < B.min.x || P.pos.x > B.max.x || P.pos.z < B.min.z || P.pos.z > B.max.z) continue;
      const under = !!avoid && avoid(P.pos);
      // (running already: left to it, unless something has come over them since they set off, and then they are
      // sent out from under it once, not again and again: a way takes a moment to work out; or unless they are held
      // up, by a shoved ship slid into their way or by someone else running, and then they run somewhere else)
      const heldUp = P.fleeing && (P.held > 0.7 || P.heldAll > 1.6);
      if (P.fleeing && !heldUp && (!under || P.fleeing.out)) { n++; continue; }
      let to = null;
      for (let i = 0; i < 14 && !to; i++) {
        const p = i < 10 && spots.length ? pick(spots) : walls.snap(B.min.x + 2 + Math.random() * (B.max.x - B.min.x - 4), P.pos.y + 0.4, B.min.z + 2 + Math.random() * (B.max.z - B.min.z - 4), 0.8);
        if (!p || Math.abs(p.y - P.pos.y) > 0.6 || Math.hypot(p.x - P.pos.x, p.z - P.pos.z) < (under ? 2.5 : 5) || noGo(p.x, p.z) || someoneAt(p, P, LIFE.body) || !walls.free(p.x, p.y, p.z, 0.26)) continue;
        // (not under the ship, nor by a straight way that passes under it; someone already under it only has to get out)
        if (avoid && (avoid(p) || (!under && passes(P.pos, p)))) continue;
        to = p.clone();
      }
      if (!to) continue;
      endTalk(P); if (P.cap && P.cap.busy) endOffer(P);
      if (!P.fleeing) { P.fleeing = { was: P.speed }; P.speed = Math.max(P.speed, 1.2) * 1.9; }
      P.fleeing.out = under;
      begin(P, { kind: 'walk', step: { for: [0.3, 0.9] }, spot: { pos: to, heading: null }, list: [{ pos: to }], j: 0 });
      P.held = 0; P.heldAll = 0;
      n++;
    }
    return n;
  }
  const stats = () => ({ people: list.length, quality, most: nearMost, about: list.filter((P) => !P.away && !P.hidden).length, walking: list.filter((P) => P.walking).length, shown: list.filter((P) => P.shown).length, far: list.filter((P) => P.shown && P.c.far).length,
    tris: list.reduce((a, P) => a + (P.shown ? P.c.tris() : 0), 0), planning: planQ.length, steps: walls.steps ? walls.steps() : null, counts: { ...counts }, talksNow: convos.size, scan: SCAN ? { busy: !!SCAN.busy, lying: !!(SCAN.busy && SCAN.busy.patient && SCAN.busy.patient.act && SCAN.busy.patient.act.phase === 'lying'), gliding: !!(scanD && scanD.use) } : null });
  // (the scanner's glide: SCAN.use, handed to its glide each frame (kit/layout.js updateGlides: parked while null))
  // (for the films and the rigs: two people sent to talk at a group's talking spot, a scan begun with a patient)
  const byId = (id) => list.find((P) => P.id === id);
  // (anyone seated stood up beside their seat first; nothing of what they were doing kept)
  const reset = (P) => {
    const a = P.act; if (a && a.spot && a.spot.seat && ['sat', 'sitting', 'rising'].includes(a.phase)) P.pos.copy(a.spot.pos);
    release(P); P.away = false; P.req = null; P.walking = false; P.way = null; P.pose = null; P.scripted = false; P.sitY = 0; play(P, STAND, { fade: 0 });
  };
  const stage = {
    // (here: placed at the talking spot at once, already talking; else they walk there; at: that one of the group's
    // talking spots when it is free)
    talk(a, b, group = 'terminal', here = true, at = null) {
      const L = talks[group] || [], isFree = (t) => t && !t.who[0] && !t.who[1];
      const A = byId(a), B = byId(b), T = at != null && isFree(L[at]) ? L[at] : L.find(isFree); if (!A || !B || !T) return false;
      for (const P of [A, B]) reset(P);
      const step = { do: 'talk:' + group, for: [40, 60] }, qa = talkAt(A, T, 0, step), qb = talkAt(B, T, 1, step);
      if (here) { A.pos.copy(T.at[0]); B.pos.copy(T.at[1]); stillV++; }
      begin(A, qa, here); begin(B, qb, here); return true;
    },
    scan(patient = 'patient') {
      const P = byId(patient); if (!P || !SCAN || SCAN.busy) return false;
      const M = list.find((q) => /medic/.test(q.id)); if (!M) return false;
      for (const X of [P, M]) { reset(X); X.act = { kind: 'stand', phase: 'do', t: 0, len: 1, spot: { pos: X.pos.clone(), heading: X.heading } }; }
      const a = claimFor(P, { do: 'scan', for: [40, 60] }); if (!a) return false;
      begin(P, a); return true;
    },
    // (someone put somewhere at once: waiting a moment, or standing there `len` seconds; a spot of a group (its own
    // claim with it) when `spot` is one of people.groups' spots)
    put(id, at, heading = 0, len = 0) {
      const P = byId(id); if (!P) return false;
      reset(P); P.pos.copy(at.pos || at); P.heading = at.heading ?? heading;
      if (at.pos && at.name && !at.who) { at.who = P; P.claim = at; taken.set(P, [at.pos]); }
      P.act = len ? { kind: 'stand', phase: 'do', t: 0, len, spot: at.pos ? at : { pos: P.pos.clone(), heading: P.heading }, step: { do: 'stand' } } : { kind: 'wait', until: 3, t: 0 };
      stillV++; return true;
    },
    // (someone sent walking to a point, to stand there `len` seconds: their way worked out as anyone's)
    go(id, at, heading = 0, len = 20) {
      const P = byId(id); if (!P) return false;
      reset(P);
      begin(P, { kind: 'stand', step: { do: 'stand', for: [len, len] }, spot: { pos: new THREE.Vector3(at.x, at.y || 0, at.z), heading } });
      return true;
    },
  };
  // THE WARD, for the trip and the rigs: admit (as a rescue run ends at home), the beds, what each of the rescued is
  // doing; stay(s): from now, everyone in the ward leaves in s seconds (the rigs)
  const wardApi = {
    admit: wardAdmit,
    get beds() { return wardBeds.map((B) => ({ n: B.n, side: B.side, walkTo: B.walkTo ? B.walkTo.toArray().map((v) => +v.toFixed(2)) : null, stand: B.stand.toArray().map((v) => +v.toFixed(2)), out: +B.out.toFixed(3), who: B.P ? B.P.id : null })); },
    get list() { return ward.list; },
    foot: () => (ward.foot || wardFoot()),
    stay(s) { for (const P of ward.list) P.rescued.leaveAt = clock + s; for (const r of ward.queue) r.leaveAt = clock + s; },
    state: () => ({ watch: !!ward.watch, queue: ward.queue.length, making: ward.making, ms: Math.round(ward.ms), foot: ward.foot ? ward.foot.toArray().map((v) => +v.toFixed(2)) : null, counts: { ...ward.counts }, late: alarms.wardLate || 0,
      list: ward.list.map((P) => ({ id: P.id, look: P.rescued.look, bed: P.rescued.bed >= 0 && wardBeds[P.rescued.bed] ? wardBeds[P.rescued.bed].n : null, state: P.rescued.state, act: P.act ? P.act.kind + ':' + (P.act.phase || '') : null, walking: !!P.walking, planning: !!P.req, shown: !!P.shown, far: !!P.c.far, pos: P.pos.toArray().map((v) => +v.toFixed(2)), left: +(P.rescued.leaveAt - clock).toFixed(1),
        // (the others: their turn at the scanner still to come, out of the way just now, what they are at, the room)
        scan: !!P.rescued.scan, away: !!P.away, at: (P.act && P.act.spot && P.act.spot.name) || null, room: roomNow(P.pos) })) }),
  };
  const api = { captain: captainApi, list, missing, update, add, remove, eyes, onWays, noGo, alarms, plan, stats, groups, seats, talks, patches, LIFE, flee, runAbout, push, bubbles, SCAN, counts, stage, ward: wardApi, inView: (P) => inView(P, W.camera),
    // (said to the player from elsewhere in the game, src/cargolap.js: their mouth moves as they say it, and no hello
    // of theirs comes on top of it)
    say: (P, words, o) => { P.talkUntil = clock + Math.min(3, READ(words)); P.greeted = clock; return bubbles.say(P, words, o); },
    // (for the rigs: the control room's and Cargo's people, made or not, and what each is doing)
    homes: () => Object.fromEntries(Object.values(HOMES).map((H) => [H.id, { made: H.made, ms: Math.round(H.ms), tries: H.tries, people: H.people.map((P) => ({ id: P.id, name: P.name, in: !P.hidden, shown: !!P.shown, act: P.act ? P.act.kind + ':' + (P.act.phase || '') + ':' + (P.act.spot?.name || '') : null, walking: !!P.walking, pos: P.pos.toArray().map((v) => +v.toFixed(2)), far: !!P.c.far })) }])),
    // (A SHIP'S CREW ABOARD, src/aboard.js: a figure built from a look as the station's people are (a roster id, a
    // recipe's name, or a recipe), standing; and one of the station's own people taken out of the station while they
    // are aboard a ship (on: they are; off: back where they were))
    figure: async (look) => { const def = ROSTER.find((d) => d.id === look); const recipe = def ? recipeOf(def.look, def) : recipeOf(look); if (!recipe) return null; const c = await makeCrew(lib, recipe, { far: true }); shadeUnder(c.root); c.play(firstClip(c, STAND), { fade: 0 }); c.update(0); return c; },
    aboard: (id, on) => { const P = list.find((q) => q.id === id); if (!P) return false; P.hidden = !!on; return true; } };
  return api;
}
