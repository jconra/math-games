// DEER PHOTOGRAPHS: the naturalist (src/jobfolk.js) lends the rider her camera (a big wooden box camera on a tripod,
// src/boxcamera.js), strapped behind the saddle, and the compass leads to a herd of wild deer (src/deer.js). Ride or walk
// up, but not too close: within SNAP.setMax metres (and no nearer than SNAP.setMin) E sets the camera up. The rider gets
// down, the tripod's legs swing out, and the view goes under the focusing cloth: the ground glass, pointed at the herd's
// middle. Dragging the view (or A / D, the arrow keys; W / S tilt it) turns the camera on its tripod.
// Done with the job, E by Miss Wren gives the camera back: it comes off the saddle and the job rests (no card, no
// trail) until the player has ridden well away from the herd and comes back; walking up to the herd still offers the
// camera all the same (setting it up borrows it again).
// The job is never over for good: whatever ended it ("Done for now", a full roll, the camera given back), the camera
// can be set up again by the job's herd. It has one herd for good (SNAP.herd, the nearest to town, with Miss Wren
// standing by it): the valley's other herds are wildlife to come across while exploring, never the job's (no card, no
// prompt, no trail to them).
//
// The herd stands side-on for its picture, each deer wearing a small number tag, and one question with a blank sits over
// the frame ("3 + ? = 5", "10 more than 47 is ?", "? × 4 = 28", "17 ÷ 5 = 3, ? left over", then "x + 7 = 12"): the deer's
// own ladder of MISSING NUMBERS AND LEFTOVERS (src/levels/place/deer.js; the rider's level there, src/levels/model.js,
// asked for every photo; the maker is src/math/deermath.js). Exactly one deer's number fills the blank. Point at that
// deer and click (or tap it, or type the number on its tag):
//   right: the flash powder goes off (a white flash and a puff of smoke), the picture comes out as a sepia print with
//          the question filled in under it, gold, and the print slides into the rider's photo album (src/ui/album.js);
//          the next question slides in, the herd still standing
//   wrong: the deer poses on, Old Hob says one plain line why ("That one's 8: 8 is 2 more than 6, not 1"), and a card
//          shows the two sides as a balance (the wrong number put in, tipped) and the steps to the answer; pick again,
//          nothing taken off. A miss never ends anything: the photographer stays and tries again, and the next
//          question comes from the level below (once; a right one there doesn't move the rider up)
// Each photo's first try is one answer at its level (save.js recordAnswer with the place and level: a travel job, no
// time); a times fact in it ("? × 4 = 28", "3x = 21", a leftover's groups) goes to the times chart (src/math/facts.js),
// and the facts asked are picked for the rider, easy tables first across a level (levelbox.js factTables).
// After SNAP.per pictures the herd has had enough and drifts a little way off; the camera folds back onto the horse,
// and once the herd settles the camera can be set up again (the compass and the card lead to it). "Done for now" (or Esc) packs the camera away early. Stuck for a while
// without a pick, the steps card shows by itself (the last line left for the kid), sooner for a two-step equation.
//
// No shooting here: deer are only ever photographed (the only guns are at the bottle range, on bottles and cans).
//
//   const DJ = makeDeerJob({ W, deer, P, I, camera, canvas, rider, hud, hob, audio, refresh, onStart, onStop })
//     deer: makeDeer's herds; I: the input (a touch screen is told to tap); onStart / onStop: the game hands over the controls while the camera is up, and back
//     busy(): optional, true while another job has the player (the wagon, the round-up, the farm jobs): the deer job's card and prompt stand aside
//   DJ.update(dt)     each frame, after the player (it places the camera while the viewfinder is up)
//   DJ.prompt         'Set up the camera' when E would set it up here, else null; DJ.setUp() does it (as E does)
//   DJ.near           the player is within SNAP.near of the job's herd; DJ.card: the job's card is up (the HUD's rule card)
//   DJ.active         the camera is up (the viewfinder, or setting up / packing away)
//   DJ.marks()        the compass mark for the herd: [{ id, icon, x, z, label }]
//   DJ.paused         a panel is open over the game
//   DJ.tags()         for rigs: the tags on screen [{ value, x, y, key, right }] (page pixels)
//   DJ.pick(value)    for rigs: photograph the deer wearing this number;  DJ.done() as "Done for now"
//   DJ.herd()         the job's herd (null till the deer are in)
//   DJ.inReach()      the camera could be set up from where the player stands (the herd settled, SNAP.setMin to setMax off)
//   DJ.workSum()      the photo's sum for the tools' Work it out ("9 + ? = 12": 12 − 9, the kid picks it), or null
//   DJ.state()        for rigs;  DJ.dispose()
import * as THREE from 'three';
import { makeBoxCamera } from '../boxcamera.js';
import { makePhoto, whyNot, balanceFor, numText } from '../math/deermath.js';
import { readAloud } from '../math/skill.js';
import { levelFor, onIds, isMet } from '../levels/model.js';
import { PLACE } from '../levels/places.js';
import { pickFact, recordFact } from '../math/facts.js';
import { factTables } from '../lockbox/levelbox.js';
// a photo's first try on the levels (src/levels/model.js through save.js recordAnswer): one answer at the level it was
// made at (its strand at that level's grade comes with it); a travel job, so no time
const levelPart = (shot) => (shot && shot.level ? { place: 'deer', level: shot.level } : null);
import { makeRng } from '../lockbox/generate.js';
import { recordAnswer, earn, countJob, saveRider } from '../save.js';
import { flagCard } from '../ui/flag.js';
import { addPrint, prints } from '../ui/album.js';
import { deerSum } from '../math/jobsums.js';

export const SNAP = {
  per: 3,                // pictures of one herd before it drifts off
  pay: { photo: 3, levelEvery: 3, outing: 5 },  // gold: each picture (+1 for every 3 levels up the deer's ladder), a
                                                // whole outing; the same whether or not a wrong deer was tried first
  herd: 'creek',         // the job's one herd (src/deer.js DEER.herds: south of the pasture, the nearest to town)
  near: 75,              // m from the job's herd where its card shows
  setMin: 12, setMax: 50,   // m from the herd's middle where the camera can be set up
  shy: { alert: 18, flee: 11, calm: true },   // the job's herd keeps still for a photographer creeping up (on foot; a
                         // horse x1.35); calm: it bolts only from a player still coming on inside the flee distance
                         // (src/deer.js), never from one standing still or a gallop further off
  pose: [16, 25],        // m from the camera the herd stands for its pictures
  gap: 3.1,              // m between two posing deer, across the view (a little closer on a phone held upright)
  apart: 3,              // m: the least room between two deer's middles across the view, as seen from the lens (a
                         // side-on deer is about 2 m long, so they stand clear of each other in the picture)
  tagsBy: 3.2,           // s after the view turns right way up: the tags show together once the whole herd has reached
                         // its spots, or by then for the deer that have
  fov: [12, 85],         // degrees the view may narrow or widen to fit the herd in the frame (wide on a phone held upright)
  clear: 7,              // m in front of the lens where the view starts at most (the plants right by the tripod aren't seen)
  plantsLow: 0.45,       // m: plants at least this tall between the lens and the herd are left out while it is photographed
                         // (and the lawn's grass tufts, which stand tall in a view this low)
  plantsWide: 2.5,       // ... out to this far either side of the outer deer
  plantsBehind: 1.2,     // ... and this far behind the back one (round its legs)
  unfold: 0.9,           // s the tripod's legs take to swing out (and fold)
  turn: 1.2,             // radians the camera turns on its tripod either way from the herd's middle (drag, A / D, arrows)
  tilt: 0.3,             // ... and tilts up or down (drag, W / S)
  turnRate: 1.1,         // radians a second a held key turns it
  dragRate: 0.0045,      // radians a pixel of drag turns it
  rest: 150,             // m from the herd: the camera given back, the job's card comes back past this
  helpAfter: 14,         // s without a pick before the steps card shows by itself
  helpAfterTwo: 6,       // ... sooner for a two-step equation (worked in the head, with no solver to move things)
  nextHerd: 5,           // s after the job is made before it picks a herd, if the deer weren't ready yet
  printShow: 1.9,        // s the print shows before it slides into the album
  thumb: [240, 160],     // the print's picture, pixels (3 by 2)
  crop: 0.5,             // the print shows this share of the ground glass across, round the deer in the picture
};

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function makeDeerJob({ W, deer, P, I = null, camera, canvas, rider, hud, hob, audio = null, refresh = () => {}, onStart = () => {}, onStop = () => {}, busy = () => false, read = null }) {
  ensureCss();
  const touch = () => !!(I && I.touch);
  const K = makeBoxCamera({ scene: W.scene }); K.root.visible = false;
  const pack = K.pack(); pack.visible = false;
  const rng = makeRng();
  const recent = [];
  const DJ = { prompt: null, near: false, card: false, active: false, paused: false };
  let herd = null, state = 'travel', t = 0, waitT = 0, disposed = false;
  let easier = false;     // the next photo comes from the level below (once): a first try just missed
  let vf = null;          // the viewfinder: its page elements and what it is showing
  let spooked = false, cardKey = '';
  const eye = new THREE.Vector3(), look = new THREE.Vector3(), _v = new THREE.Vector3();
  const FOV0 = camera.fov, NEAR0 = camera.near;

  // the job's herd: its own one (the nearest to the town square, should the list ever lose it)
  const jobHerd = () => deer.herd(SNAP.herd) || deer.nearest(W.places.square || W.places.spawn);
  deer.ready.then(() => { if (!disposed && !herd) herd = jobHerd(); });

  // ── THE CAMERA BEHIND THE SADDLE ───────────────────────────────────────────────────────────────────────────────
  // (only once she has lent it: talking to her, or the first picture set up; before that a new saddle carries nothing)
  function stowPack(on) {
    const holder = on && rider.cameraLent && P.horse && P.horse.saddle;
    if (holder && pack.parent !== holder) { holder.add(pack); pack.position.set(0, 0.16, -0.5); pack.rotation.set(0, 0, 0); }
    pack.visible = !!holder;
  }

  // where the herd's deer are now (their middle), not where a moving herd is heading
  function where() {
    let x = 0, z = 0; for (const e of herd.deer) { x += e.x; z += e.z; }
    return { x: x / herd.deer.length, z: z / herd.deer.length };
  }

  // ── TRAVEL: the card and the prompt near the herd ─────────────────────────────────────────────────────────────
  function travel(dt) {
    const c = where(), d = Math.hypot(P.position.x - c.x, P.position.z - c.z);
    if (resting && d > SNAP.rest) resting = false;
    if (resting) {
      // (the camera given back: no card and no trail, but walking up to the herd still offers it: setting it up
      // borrows it again)
      const calm = herd.state === 'calm' || herd.state === 'alert';
      DJ.prompt = !busy() && calm && d >= SNAP.setMin && d <= SNAP.setMax && (P.mode === 'foot' || P.mode === 'horse') ? 'Set up the camera' : null;
      DJ.near = false; return;
    }
    const near = d < SNAP.near;
    if (near && !DJ.near) hob.event('deerArrive');
    DJ.near = near;
    if (herd.state === 'flee' && near && !spooked) { spooked = true; hob.event('deerSpooked'); }
    if (herd.state !== 'flee') spooked = false;
    const settled = herd.state === 'calm' || herd.state === 'alert';
    // (another job has the player, say a wagon gang riding in near the herd: no card or prompt, so that job's card stays up)
    const other = !!busy();
    const ok = !other && settled && d >= SNAP.setMin && d <= SNAP.setMax && (P.mode === 'foot' || P.mode === 'horse');
    DJ.prompt = ok ? 'Set up the camera' : null;
    if (near && !other) {
      // (a travel card while there is still a way to go, so Old Hob's hoofprints lead on: to Miss Wren first while her
      // camera isn't lent yet, then to the herd)
      const lend = !rider.cameraLent && !ok;
      const kind = lend || d > SNAP.setMax ? 'travel' : 'job';
      const sub = lend ? 'First borrow Miss Wren\'s camera: follow the hoofprints to her'
        : herd.state === 'leave' ? 'They\'re moving on a little way: let them settle, then set up again'
        : !settled ? 'They bolted! Let them settle, then try again from further off'
        : d > SNAP.setMax ? `${Math.round(d)} m to the herd: get within ${SNAP.setMax} m`
        : d < SNAP.setMin ? 'Too close: they\'ll bolt. Back off a few steps'
        : `${Math.round(d)} m: a good spot. ${touch() ? 'Tap the button to' : 'Press E to'} set up the camera`;
      const key = 'deer|' + kind + '|' + sub;
      if (key !== cardKey) { cardKey = key; hud.rule({ main: 'Deer photographs', sub, kind }); }
      DJ.card = true;
    } else if (DJ.card) { DJ.card = false; cardKey = ''; hud.rule(null); }
  }

  // Miss Wren lends the camera (E by her, src/jobfolk.js): it goes behind the saddle at once
  DJ.lent = () => !!rider.cameraLent;
  DJ.lend = () => {
    if (!rider.cameraLent) { rider.cameraLent = true; saveRider(rider); }
    resting = false;
    if (state === 'travel') stowPack(true);
    return true;
  };

  // the camera given back (E by her, src/jobfolk.js): off the saddle, and the job rests till the player has gone off
  let resting = false;
  DJ.giveBack = () => {
    if (state !== 'travel' || !rider.cameraLent) return false;
    rider.cameraLent = false; saveRider(rider);
    stowPack(false);
    resting = true; DJ.prompt = null; DJ.near = false;
    if (DJ.card) { DJ.card = false; cardKey = ''; hud.rule(null); }
    return true;
  };
  DJ.resting = () => resting;

  DJ.setUp = () => {
    if (state !== 'travel' || !DJ.prompt || DJ.paused) return false;
    DJ.prompt = null; state = 'setting'; t = 0; waitT = 0;
    if (!rider.cameraLent) { rider.cameraLent = true; saveRider(rider); }
    resting = false;
    if (DJ.card) { DJ.card = false; cardKey = ''; hud.rule(null); }
    hud.prompt(null);
    DJ.active = true;
    onStart();
    if (P.onHorse) P.dismount();
    return true;
  };

  // the rider is down: the camera goes up a step in front of them, facing the herd
  function standCamera() {
    const c = where(), yaw = Math.atan2(c.x - P.position.x, c.z - P.position.z);
    const kx = P.position.x + Math.sin(yaw) * 0.85, kz = P.position.z + Math.cos(yaw) * 0.85;
    P.teleport(P.position.x, P.position.z, yaw);
    K.place(kx, W.heightAt(kx, kz), kz, yaw); K.spread(0); K.root.visible = true;
    stowPack(false);
    vf = { yaw, at: { x: kx, z: kz } };
  }

  // ── THE HERD STANDS FOR ITS PICTURE ───────────────────────────────────────────────────────────────────────────
  // a spot with room for a deer (clear of trees, rocks and water a metre and a half round), and nothing in the way
  // between it and the lens (past the plants at the tripod's feet)
  const roomAt = (x, z) => { if (W.blocked(x, z) || W.waterAt(x, z) > 0.3) return false; for (let a = 0; a < 8; a++) { const px = x + Math.sin(a * Math.PI / 4) * 1.5, pz = z + Math.cos(a * Math.PI / 4) * 1.5; if (W.blocked(px, pz) || W.waterAt(px, pz) > 0.3) return false; } return true; };
  const inSight = (x, z) => { const L = Math.hypot(x - eye.x, z - eye.z); for (let d = SNAP.clear; d < L - 1.5; d += 0.5) { const f = d / L; if (W.blocked(eye.x + (x - eye.x) * f, eye.z + (z - eye.z) * f)) return false; } return true; };
  function poseHerd() {
    K.eye(eye);
    const yaw = vf.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    // (as three's rotation.y: facing (sin, cos); the right hand of that is (cos, −sin))
    const c = where(), D = Math.max(SNAP.pose[0], Math.min(SNAP.pose[1], Math.hypot(c.x - eye.x, c.z - eye.z)));
    const cx = eye.x + fx * D, cz = eye.z + fz * D;
    // (the deer keep their order across the view, so none has to cross the others to its spot)
    const order = herd.deer.map((d, i) => ({ i, s: (d.x - eye.x) * rx + (d.z - eye.z) * rz })).sort((a, b) => a.s - b.s);
    const n = herd.deer.length, spots = new Array(n);
    // (apart on the ground, and apart as seen from the lens: at least a deer's length between two middles across the
    // view, so none stands in front of or behind another in the picture)
    const angle = (x, z) => Math.atan2(x - eye.x, z - eye.z), far = (x, z) => Math.hypot(x - eye.x, z - eye.z);
    // (how far apart across the view from the nearest spot taken, in metres at the nearer one's distance)
    const roomFrom = (x, z) => { let m = Infinity; for (const q of spots) if (q) { if (Math.hypot(q.x - x, q.z - z) < 2.2) return -1; m = Math.min(m, Math.tan(Math.min(1.4, Math.abs(wrapA(angle(x, z) - angle(q.x, q.z))))) * Math.min(far(x, z), far(q.x, q.z))); } return m; };
    const apart = (x, z) => roomFrom(x, z) >= SNAP.apart;
    const open = (x, z) => !W.blocked(x, z) && W.waterAt(x, z) <= 0.3;
    order.forEach((o, k) => {
      const across = (k - (n - 1) / 2) * SNAP.gap * (innerWidth < innerHeight ? 0.8 : 1), deep = (k % 2 ? 1.2 : -1.0) + (rng.next() - 0.5);
      // (a spot with room round it, in plain sight of the lens, apart from the ones already taken: tried a little nearer
      // or further first, then further to either side; then with less room round it; at last where the deer stands now)
      let s = null, best = null;
      find: for (const room of [roomAt, open]) for (const side of [0, 0.9, -0.9, 1.8, -1.8, 2.7, -2.7]) for (const dd of [0, 1.5, -1.5, 3, -3, 4.5]) {
        const x = cx + rx * (across + side) + fx * (deep + dd), z = cz + rz * (across + side) + fz * (deep + dd);
        if (!room(x, z) || !inSight(x, z)) continue;
        if (apart(x, z)) { s = { x, z }; break find; }
        const r = roomFrom(x, z); if (!best || r > best.r) best = { x, z, r };   // (else the one most apart)
      }
      if (!s) s = best ? { x: best.x, z: best.z } : { x: herd.deer[o.i].x, z: herd.deer[o.i].z };
      // side-on to the camera, some one way and some the other, never quite square
      s.h = yaw + (rng.chance(0.5) ? 1 : -1) * (Math.PI / 2 + (rng.next() - 0.5) * 0.3);
      spots[o.i] = s;
    });
    herd.pose(spots);
    vf.spots = spots;
    // the view: from the ground glass toward the herd's middle, level with their heads (so the frame's bottom edge
    // meets the meadow well out in front of the tripod, past the plants at its feet)
    look.set(cx, W.heightAt(cx, cz) + 1.25, cz);
    vf.lookY = look.y - W.heightAt(cx, cz);
    vf.dist = D; vf.aim = 0; vf.half = null;
  }

  // The view follows the herd as it stands now: turned toward the middle of the deer (as seen from the lens) and
  // widened or narrowed so all of them fit across the frame with a little room (eased, so it never jumps).
  // -> the field of view (vertical, degrees) for this screen
  function fitView(dt) {
    let lo = Infinity, hi = -Infinity;
    for (const d of herd.deer) {
      const dx = d.x - eye.x, dz = d.z - eye.z, dist = Math.max(4, Math.hypot(dx, dz));
      const a = wrapA(Math.atan2(dx, dz) - vf.yaw), m = Math.atan(1.1 / dist);   // (a deer is about 2 m nose to tail)
      lo = Math.min(lo, a - m); hi = Math.max(hi, a + m);
    }
    const mid = (lo + hi) / 2, half = Math.max(0.12, (hi - lo) / 2 * 1.12);
    const k = vf.half == null ? 1 : 1 - Math.exp(-dt * 2.5);
    vf.aim += (mid - vf.aim) * k; vf.half = vf.half == null ? half : vf.half + (half - vf.half) * k;
    // (turned on the tripod by the player: drag, or the keys)
    const keyTurn = (vf.keys.has('KeyA') || vf.keys.has('ArrowLeft') ? 1 : 0) - (vf.keys.has('KeyD') || vf.keys.has('ArrowRight') ? 1 : 0);
    const keyTilt = (vf.keys.has('KeyW') || vf.keys.has('ArrowUp') ? 1 : 0) - (vf.keys.has('KeyS') || vf.keys.has('ArrowDown') ? 1 : 0);
    aimBy(keyTurn * SNAP.turnRate * dt, keyTilt * SNAP.turnRate * 0.5 * dt);
    const ay = vf.ay = vf.yaw + vf.aim + vf.turn, lx = eye.x + Math.sin(ay) * vf.dist, lz = eye.z + Math.cos(ay) * vf.dist;
    look.set(lx, W.heightAt(lx, lz) + vf.lookY + Math.tan(vf.tilt) * vf.dist, lz);
    const fr = vf.frameEl.getBoundingClientRect(), w = innerWidth, h = innerHeight;
    const across = Math.tan(vf.half) * (w / Math.max(1, fr.width));   // (tan of half the canvas's width angle)
    const v = 2 * Math.atan(across * h / w) * 180 / Math.PI;
    return Math.max(SNAP.fov[0], Math.min(SNAP.fov[1], v));
  }

  // How far in front of the lens the view starts: pushed out past the grass and bushes at the tripod's feet, which
  // would fill the frame (the herd is always further off), but never past where the frame's bottom edge meets the
  // ground, or a hole would open in the meadow there.
  function clearTo(fov) {
    const fr = vf.frameEl.getBoundingClientRect();
    const down = Math.atan2(eye.y - look.y, Math.hypot(look.x - eye.x, look.z - eye.z));
    const bottom = down + Math.atan(Math.tan(fov * Math.PI / 360) * Math.min(1, fr.height / innerHeight));
    const ay = vf.ay == null ? vf.yaw : vf.ay, fx = Math.sin(ay), fz = Math.cos(ay), drop = Math.tan(bottom);
    let hit = SNAP.clear / 0.85;
    for (let d = 1; d < hit; d += 0.25) if (eye.y - d * drop < W.heightAt(eye.x + fx * d, eye.z + fz * d) + 0.1) { hit = d; break; }
    return Math.max(1, Math.min(SNAP.clear, hit * 0.85));
  }

  // The tall plants between the lens and the herd (and round the deer's legs) are left out while the viewfinder is up,
  // or a yucca or a stand of reeds a few metres out fills the frame and every print (the short grass stays). They are
  // back as soon as it closes. (world/objects/forest.js setHide; the cut to the ground glass hides the change)
  let lawnOff = null;   // (the lawn's tufts left out too: a test on world/valley.js's LAWN_SKIP list)
  function clearPlants(on) {
    const V = W.V, F = V && V.coverForest;
    if (lawnOff && V.LAWN_SKIP) { const i = V.LAWN_SKIP.indexOf(lawnOff); if (i >= 0) V.LAWN_SKIP.splice(i, 1); lawnOff = null; if (!on && V.placeLawn) V.placeLawn(); }
    if (!F || !F.setHide) return;
    if (!on || !vf || !vf.spots) { F.setHide(null); return; }
    const fx = Math.sin(vf.yaw), fz = Math.cos(vf.yaw), rx = Math.cos(vf.yaw), rz = -Math.sin(vf.yaw), ex = eye.x, ez = eye.z;
    let back = 0, half = 0, minX = ex, maxX = ex, minZ = ez, maxZ = ez;
    for (const q of vf.spots) {
      const a = (q.x - ex) * fx + (q.z - ez) * fz, c = (q.x - ex) * rx + (q.z - ez) * rz;
      back = Math.max(back, a); half = Math.max(half, Math.abs(Math.atan2(c, Math.max(1, a))) + Math.atan(SNAP.plantsWide / Math.max(4, a)));
      minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minZ = Math.min(minZ, q.z); maxZ = Math.max(maxZ, q.z);
    }
    back += SNAP.plantsBehind; const pad = 6, tanH = Math.tan(Math.min(1.3, half));
    minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;
    F.setHide((x, z, t, sp) => {
      if (x < minX || x > maxX || z < minZ || z > maxZ) return false;
      if ((sp.height || 1) * (t.scale || 1) < SNAP.plantsLow) return false;
      const a = (x - ex) * fx + (z - ez) * fz; if (a < 0.3 || a > back) return false;
      return Math.abs((x - ex) * rx + (z - ez) * rz) < a * tanH + 0.8;
    });
    if (V.LAWN_SKIP && V.placeLawn) {
      lawnOff = (x, z) => { if (x < minX || x > maxX || z < minZ || z > maxZ) return false; const a = (x - ex) * fx + (z - ez) * fz; return a > 0.3 && a < back && Math.abs((x - ex) * rx + (z - ez) * rz) < a * tanH + 0.8; };
      V.LAWN_SKIP.push(lawnOff); V.placeLawn();
    }
  }

  // ── THE VIEWFINDER ─────────────────────────────────────────────────────────────────────────────────────────────
  function openView() {
    state = 'view'; t = 0;
    const el = document.createElement('div'); el.className = 'bmd-vf' + (touch() ? ' is-touch' : '');
    el.innerHTML = `
      <div class="bmd-frame"><i class="bmd-grid"></i><i class="bmd-corner"></i></div>
      <div class="bmd-eq" aria-live="polite"><small>Photograph the deer whose number makes it true</small><b></b><i hidden></i></div>
      <div class="bmd-tags"></div>
      <div class="bmd-help" hidden></div>
      <div class="bmd-bar"><span class="bmd-keys">${keysHint()}</span><span class="bmd-dots"></span><span class="bmd-album"><i></i> in the album</span>
        <button type="button" class="bmd-done">Done for now<small>${touch() ? '' : 'Esc'}</small></button></div>
      <div class="bmd-flash"></div>`;
    // (just after the valley's canvas, so the HUD's purse and Old Hob's captions stay on top of the dark frame)
    canvas.after(el);
    document.body.classList.add('bmd-viewing');
    vf.el = el; vf.frameEl = el.querySelector('.bmd-frame'); vf.tagsEl = el.querySelector('.bmd-tags'); vf.helpEl = el.querySelector('.bmd-help');
    vf.eqEl = el.querySelector('.bmd-eq b'); vf.wordsEl = el.querySelector('.bmd-eq i'); vf.flashEl = el.querySelector('.bmd-flash');
    flagCard(el.querySelector('.bmd-eq'), () => (vf && vf.shot ? { choices: vf.shot.values.map(numText), right: numText(vf.shot.values[vf.shot.right]) } : {}));   // ("Confusing?": src/ui/flag.js)
    vf.pics = 0; vf.missed = false; vf.busy = false; vf.idle = 0; vf.helped = false; vf.hover = -1; vf.ready = false; vf.typed = '';
    el.querySelector('.bmd-done').addEventListener('click', (e) => { e.stopPropagation(); DJ.done(); });
    el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp);
    addEventListener('keydown', onKey, true);
    // the ground glass: the right way up from the start, pointed at the herd's middle
    canvas.classList.add('bmd-glass');
    vf.turn = 0; vf.tilt = 0; vf.keys = new Set();
    addEventListener('keyup', onKeyUp, true); addEventListener('blur', onBlur);
    if (audio && audio.need) audio.need('camera', true);
    hob.event('deerSetup');
    album();
    newShot();
    clearPlants(true);
  }

  function closeView() {
    if (!vf || !vf.el) return;
    clearPlants(false);
    removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKeyUp, true); removeEventListener('blur', onBlur);
    vf.el.remove(); vf.el = null;
    document.body.classList.remove('bmd-viewing');
    canvas.classList.remove('bmd-glass'); canvas.style.transition = ''; canvas.style.transform = '';
    camera.clearViewOffset(); camera.fov = FOV0; camera.near = NEAR0; camera.updateProjectionMatrix();
    if (audio && audio.need) audio.need('camera', false);
  }

  function album() { if (vf && vf.el) vf.el.querySelector('.bmd-album i').textContent = prints(rider).length; }
  function dots() { if (vf && vf.el) vf.el.querySelector('.bmd-dots').innerHTML = Array.from({ length: SNAP.per }, (x, i) => `<i class="${i < vf.pics ? 'is-on' : ''}"></i>`).join(''); }

  // a new equation; the herd keeps its spots, the tags get new numbers
  function newShot() {
    // the rider's level at the deer (asked for every photo; the first time meets the place, so the rider is saved), or
    // after a missed first try the level below it once (a right one there doesn't move them up)
    const met = isMet(rider, 'deer');
    const q = levelFor(rider, 'deer');
    if (!met) saveRider(rider);
    const ladder = PLACE.deer.levels;
    let L = q.level, into = q.into, count = q.count;
    if (easier && !q.placing) {
      const below = onIds(rider, 'deer').map((id) => ladder.findIndex((x) => x.id === id)).filter((j) => j >= 0 && j < q.i);
      if (below.length) { L = ladder[below[below.length - 1]]; count = L.count || 5; into = count - 1; }
    }
    easier = false;
    const fact = L.gen.facts ? pickFact(rider, { tables: factTables(into, count), upTo: 10, from: 2, rand: rng.next }) : null;
    const shot = makePhoto(rider, { n: herd.deer.length, rng, recent, level: L, into, count, fact });
    shot.li = ladder.indexOf(L); shot.placing = q.placing;
    recent.push(shot.key); if (recent.length > 12) recent.shift();
    vf.shot = shot; vf.tried = false; vf.wrong = new Set(); vf.idle = 0; vf.helped = false;
    clearTimeout(vf.typeT); vf.typed = ''; showTyped();
    vf.eqEl.textContent = shot.eq;
    const lead = vf.eqEl.parentElement.querySelector('small');
    if (lead) lead.textContent = shot.young ? 'Photograph the deer whose number fills the blank' : 'Photograph the deer whose number makes it true';
    // the kindergarten boxes' question in words ("2 plus what equals 4?"), read out loud for a rider who doesn't read yet
    if (vf.wordsEl) { vf.wordsEl.textContent = shot.words || ''; vf.wordsEl.hidden = !shot.words; }
    if (shot.say && read && readAloud(rider)) read.say(shot.say);
    vf.eqEl.parentElement.classList.remove('is-in'); void vf.eqEl.offsetWidth; vf.eqEl.parentElement.classList.add('is-in');
    // tag i goes on deer i
    vf.tagsEl.innerHTML = shot.values.map((v, i) => `<div class="bmd-tag" data-i="${i}"><b>${esc(numText(v))}</b></div>`).join('');
    vf.tagEls = [...vf.tagsEl.children];
    help(null);
    dots();
  }

  // the tags follow their deer on screen (hidden until the deer has reached its spot and the view is the right way up)
  const _p = new THREE.Vector3();
  function placeTags() {
    // (the tags show together once every deer has reached its spot, so the first pick is a real choice; one still on
    // its way by SNAP.tagsBy gets its tag when it gets there)
    const ready = herd.deer.every((d) => d.arrived) || (t > SNAP.tagsBy && herd.deer.some((d) => d.arrived));
    if (ready && !vf.ready) { vf.ready = true; vf.idle = 0; }
    const fr = vf.frameEl.getBoundingClientRect();
    const items = herd.deer.map((d, i) => {
      _p.set(d.x, W.heightAt(d.x, d.z) + d.a.tall + 0.12, d.z).project(camera);
      const x = (_p.x + 1) / 2 * innerWidth, y = (1 - _p.y) / 2 * innerHeight;
      return { i, x, y, on: _p.z < 1 && d.arrived && x > fr.left - 8 && x < fr.right + 8 };
    });
    // (two tags that would overlap: the one further right steps up a little)
    const sorted = [...items].sort((a, b) => a.x - b.x);
    for (let k = 1; k < sorted.length; k++) { const a = sorted[k - 1], b = sorted[k]; if (b.x - a.x < 54 && Math.abs(b.y - a.y) < 40) b.y = a.y - 42; }
    vf.items = items;
    for (const it of items) {
      const tEl = vf.tagEls[it.i]; if (!tEl) continue;
      tEl.style.transform = `translate(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px)`;
      tEl.classList.toggle('is-on', vf.ready && it.on);
      tEl.classList.toggle('is-hover', vf.hover === it.i);
    }
  }

  // which deer a click at (x, y) means: the nearest tag, or a deer's body, within a generous reach
  function deerAt(x, y) {
    if (!vf.items) return -1;
    let best = -1, bd = Infinity;
    const pxPerM = innerHeight / 2 / Math.tan(camera.fov * Math.PI / 360) / Math.max(1, vf.dist || 20);
    for (const it of vf.items) {
      if (!it.on) continue;
      const d = herd.deer[it.i];
      _p.set(d.x, W.heightAt(d.x, d.z) + d.a.height * 0.6, d.z).project(camera);
      const bx = (_p.x + 1) / 2 * innerWidth, by = (1 - _p.y) / 2 * innerHeight;
      const reachBody = Math.max(36, d.a.length * 0.6 * pxPerM);
      const dt = Math.hypot(x - it.x, y - (it.y - 16)), db = Math.hypot(x - bx, y - by);
      const score = Math.min(dt / 46, db / reachBody);
      if (score < 1 && score < bd) { bd = score; best = it.i; }
    }
    return best;
  }
  // turning the camera on its tripod (radians, + to the left / up), held within SNAP.turn and SNAP.tilt
  function aimBy(dTurn, dTilt) {
    if (!vf) return;
    vf.turn = Math.max(-SNAP.turn, Math.min(SNAP.turn, (vf.turn || 0) + dTurn));
    vf.tilt = Math.max(-SNAP.tilt, Math.min(SNAP.tilt, (vf.tilt || 0) + dTilt));
  }
  let down = null;
  function onDown(e) { if (e.target.closest('button')) return; down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId }; }
  function onMove(e) {
    // (a drag turns the camera on its tripod)
    if (down && e.pointerId === down.id && vf) {
      const k = SNAP.dragRate * (camera.fov / 50);   // (slower when the view is narrow, so a long lens isn't twitchy)
      aimBy(-(e.clientX - down.lx) * k, -(e.clientY - down.ly) * k);   // (the same way round as the chase camera's drag)
      down.lx = e.clientX; down.ly = e.clientY;
    }
    if (e.pointerType !== 'mouse' || !vf || !vf.ready) return;
    vf.hover = deerAt(e.clientX, e.clientY);
    vf.el.classList.toggle('is-aiming', vf.hover >= 0);
  }
  function onUp(e) {
    if (!down || e.pointerId !== down.id) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 14 || e.target.closest('button')) return;
    const i = deerAt(e.clientX, e.clientY);
    if (i >= 0) shoot(i);
  }
  // Typing a number picks the deer wearing it (the number keys never mean "the deer in that place", which a kid who
  // worked out x = 3 would read as "the deer tagged 3"). A minus key first for a number below zero; with a tag that
  // shows more digits still to come (1 and 13), it waits a moment for them (Enter picks at once). A number nobody
  // wears just says so.
  const tagText = (v) => String(v);   // (as typed: '-5', '13')
  const keysHint = () => (touch() ? 'drag to turn the camera' : 'drag or A / D to turn the camera · or type its number');
  const AIM_KEYS = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  function onKeyUp(e) { if (vf && vf.keys) vf.keys.delete(e.code); }
  function onBlur() { if (vf && vf.keys) vf.keys.clear(); }
  function onKey(e) {
    if (document.querySelector('.bml:not(.is-out), .tch:not(.out)')) return;   // (a tool is up over the viewfinder, Work it out or the times chart: its keys, its Esc)
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); DJ.done(); return; }
    if (vf && vf.keys && AIM_KEYS.includes(e.code)) { e.preventDefault(); e.stopPropagation(); vf.keys.add(e.code); return; }
    if (!vf || !vf.items || !vf.shot) return;
    const k = e.key === '\u2212' ? '-' : e.key;
    if (/^[0-9]$/.test(k) || (k === '-' && !vf.typed)) { e.preventDefault(); e.stopPropagation(); typeKey(vf.typed + k); }
    else if (k === 'Backspace' && vf.typed) { e.preventDefault(); e.stopPropagation(); typeKey(vf.typed.slice(0, -1)); }
    else if (k === 'Enter' && vf.typed) { e.preventDefault(); e.stopPropagation(); pickTyped(); }
  }
  function typeKey(text) {
    clearTimeout(vf.typeT);
    vf.typed = text;
    showTyped();
    if (!text || text === '-') return;
    const shown = vf.items.filter((it) => it.on && vf.ready).map((it) => tagText(vf.shot.values[it.i]));
    if (!shown.some((v) => v.startsWith(text))) {
      // (nobody wears it: said, and cleared a moment later)
      showTyped(`no deer wears ${text.replace('-', '\u2212')}`);
      vf.typeT = setTimeout(() => { if (vf) { vf.typed = ''; showTyped(); } }, 1400);
      return;
    }
    const longer = shown.some((v) => v !== text && v.startsWith(text));
    if (!longer) pickTyped();
    else vf.typeT = setTimeout(pickTyped, 900);
  }
  function pickTyped() {   // (at once, or after the wait for more digits)
    if (!vf) return;
    clearTimeout(vf.typeT);
    const text = vf.typed; vf.typed = ''; showTyped();
    const it = vf.items && vf.items.find((x) => x.on && tagText(vf.shot.values[x.i]) === text);
    if (it) shoot(it.i);
  }
  function showTyped(note) {
    const el = vf && vf.el && vf.el.querySelector('.bmd-keys'); if (!el) return;
    el.textContent = note || (vf.typed ? `typing ${vf.typed.replace('-', '\u2212')}\u2026` : keysHint());
    el.classList.toggle('is-typing', !!(note || vf.typed));
  }

  // ── A PICTURE ─────────────────────────────────────────────────────────────────────────────────────────────────
  function shoot(i) {
    if (!vf || vf.busy || !vf.ready || state !== 'view' || DJ.paused || vf.finished) return;
    if (!herd.deer[i] || !herd.deer[i].arrived) return;   // (still on its way to its spot: its tag isn't up yet)
    const shot = vf.shot, v = shot.values[i];
    vf.idle = 0;
    if (i !== shot.right) { wrong(i, v); return; }
    vf.busy = true;
    const first = !vf.tried; vf.tried = true;
    if (first) { if (shot.fact) recordFact(rider, shot.fact.a, shot.fact.b, true); const rec = recordAnswer(rider, true, levelPart(shot)); if (rec && rec.badge) hud.toast(`You earned the ${rec.badge} badge!`, 'gold'); }
    const img = capture();
    K.flash(); flashSound();
    vf.flashEl.classList.remove('is-on'); void vf.flashEl.offsetWidth; vf.flashEl.classList.add('is-on');
    const gold = SNAP.pay.photo + Math.floor(Math.max(0, shot.li || 0) / SNAP.pay.levelEvery);
    const e = earn(rider, gold);
    countJob(rider, 'photos');   // (counted for a belt buckle to come: there's no photographs buckle yet)
    addPrint(rider, { eq: shot.young ? shot.solved : shot.eq, x: shot.young ? '' : numText(shot.x), img, rung: shot.level });   // (a kindergarten box's print: filled in, "4 + 1 = 5")
    refresh();
    if (e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 2200);
    hob.event('deerRight');
    help(null);
    for (const el of vf.tagEls) el.classList.add('is-out');
    showPrint(img, shot, gold);
    vf.pics++; dots();
    const my = vf;
    setTimeout(() => {
      if (disposed || vf !== my || !vf.el) return;
      album();
      if (vf.pics < SNAP.per) { vf.busy = false; newShot(); }
      else outingDone();
    }, (SNAP.printShow + 0.9) * 1000);
  }

  function wrong(i, v) {
    const shot = vf.shot;
    if (!vf.tried) {
      if (shot.fact) recordFact(rider, shot.fact.a, shot.fact.b, false);
      const rec = recordAnswer(rider, false, levelPart(shot)); if (rec && rec.badge) hud.toast(`You earned the ${rec.badge} badge!`, 'gold');
      easier = true;   // (the next photo is easier; this one stays: try again)
    }
    vf.tried = true; vf.missed = true; vf.wrong.add(i);
    const tEl = vf.tagEls[i];
    if (tEl) { tEl.classList.remove('is-shake'); void tEl.offsetWidth; tEl.classList.add('is-shake', 'is-wrong'); }
    hob.event('deerWrong', { line: whyNot(shot, v) });
    help({ v });
  }

  function outingDone() {
    const e = earn(rider, SNAP.pay.outing);
    refresh();
    hud.toast(`A fine roll of pictures! +${SNAP.pay.outing} gold`, 'gold');
    if (e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), 1800);
    hob.event('deerDone');
    const my = vf; my.finished = true;
    setTimeout(() => { if (!disposed && vf === my && state === 'view') packUp(true); }, 1200);
  }

  DJ.done = () => {
    if (state !== 'view') return;
    if (vf && vf.finished) { packUp(true); return; }   // (the roll is full: packing up now is the same as waiting)
    hob.event('deerStop');
    packUp(false);
  };

  // the camera folds away; the herd goes back to grazing (or, with its pictures taken, walks a little way off and
  // settles: it stays the job's herd, so the camera can be set up again once it has)
  function packUp(leave) {
    closeView();
    state = 'packing'; t = 0;
    if (leave) herd.leave(vf.at.x, vf.at.z);
    else herd.release();
  }

  // ── THE PRINT, AND THE PICTURE ON IT ──────────────────────────────────────────────────────────────────────────
  // what the ground glass shows now, cropped to its frame, as a small sepia JPEG (drawn straight after a fresh draw of
  // the valley: the picture on screen can only be read before the page shows it)
  function capture() {
    try {
      W.render();
      // (framed on the deer in the picture, with a little of the herd either side: half the ground glass across)
      const fr = vf.frameEl.getBoundingClientRect(), k = canvas.width / Math.max(1, canvas.clientWidth);
      const [tw, th] = SNAP.thumb, want = tw / th;
      let sw = fr.width * SNAP.crop * k, sh = sw / want;
      if (sh > fr.height * k) { sh = fr.height * k; sw = sh * want; }
      const d = herd.deer[vf.shot.right];
      _p.set(d.x, W.heightAt(d.x, d.z) + d.a.height * 0.75, d.z).project(camera);
      const cx = (_p.x + 1) / 2 * innerWidth * k, cy = (1 - _p.y) / 2 * innerHeight * k;
      const sx = Math.max(fr.left * k, Math.min(fr.right * k - sw, cx - sw / 2)), sy = Math.max(fr.top * k, Math.min(fr.bottom * k - sh, cy - sh * 0.55));
      const c = document.createElement('canvas'); c.width = tw; c.height = th;
      const x = c.getContext('2d');
      x.drawImage(canvas, sx, sy, sw, sh, 0, 0, tw, th);
      const im = x.getImageData(0, 0, tw, th), p = im.data;
      for (let j = 0; j < p.length; j += 4) {
        const px = (j / 4) % tw, py = Math.floor(j / 4 / tw), dx = px / tw - 0.5, dy = py / th - 0.5;
        const vig = 1 - 0.75 * (dx * dx + dy * dy) * 1.6;
        const l = (0.3 * p[j] + 0.59 * p[j + 1] + 0.11 * p[j + 2]) * vig;
        p[j] = Math.min(255, l * 1.07 + 22); p[j + 1] = Math.min(255, l * 0.92 + 12); p[j + 2] = Math.min(255, l * 0.72 + 2);
      }
      x.putImageData(im, 0, 0);
      return c.toDataURL('image/jpeg', 0.72);
    } catch (e) { console.warn('the picture could not be taken', e); return ''; }
  }

  function showPrint(img, shot, gold) {
    const el = document.createElement('div'); el.className = 'bmd-print';
    el.innerHTML = `${img ? `<img src="${img}" alt="">` : '<div class="bmd-print-blank"></div>'}
      <div class="bmd-print-eq">${esc(shot.young ? shot.solved : shot.eq)}</div>${shot.young ? '' : `<div class="bmd-print-x">x = ${esc(numText(shot.x))}</div>`}<div class="bmd-print-gold">+${gold} gold</div>`;
    vf.el.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => {
      if (!el.isConnected) return;
      const to = vf.el && vf.el.querySelector('.bmd-album'), a = el.getBoundingClientRect(), b = to ? to.getBoundingClientRect() : a;
      el.style.setProperty('--fx', `${(b.left + b.width / 2) - (a.left + a.width / 2)}px`);
      el.style.setProperty('--fy', `${(b.top + b.height / 2) - (a.top + a.height / 2)}px`);
      el.classList.add('is-away');
      setTimeout(() => el.remove(), 800);
    }, SNAP.printShow * 1000);
  }

  // ── THE HELP CARD: the balance for a wrong deer, and the steps that solve it ──────────────────────────────────
  function help(o) {
    const el = vf && vf.helpEl; if (!el) return;
    clearTimeout(vf.revealT);
    if (!o) { el.hidden = true; el.innerHTML = ''; return; }
    const shot = vf.shot, steps = shot.steps;
    let top = '';
    if (o.v != null) {
      const b = balanceFor(shot, o.v);
      // (a kindergarten box, said as its own words go: "Is it 2? 4 + 2 makes 6, not 5", with no talk of sides)
      top = shot.young
        ? `<div class="bmd-help-h">Is it ${esc(numText(o.v))}?</div>${balanceSvg(b)}
        <p class="bmd-help-p">${esc(shot.q && shot.q.check ? shot.q.check(o.v).why : `${b.leftText} makes ${b.leftValue}, not ${b.rightValue}.`)}</p>`
        : `<div class="bmd-help-h">Try ${esc(numText(o.v))} in it</div>${balanceSvg(b)}
        <p class="bmd-help-p">${esc(b.leftValue)} and ${esc(b.rightValue)} don't balance, so ${esc(numText(o.v))} isn't it.</p>`;
    } else top = '<div class="bmd-help-h">Here\'s how it goes</div>';
    el.innerHTML = `${top}<div class="bmd-steps">${shot.young ? '' : '<div class="bmd-steps-h">Whatever you do to one side, do to the other</div>'}
      ${steps.map((s, k) => `<div class="bmd-step${k === steps.length - 1 ? ' is-last' : ''}">${s.note ? `<small>${esc(s.note)}</small>` : ''}<span>${k === steps.length - 1 ? '<i class="bmd-hide">' + esc(s.text) + '</i>' : esc(s.text)}</span></div>`).join('')}</div>`;
    el.hidden = false;
    // (after a wrong pick the last line shows a moment later; stuck with no pick, it is left for the kid to work out)
    if (o.v != null) vf.revealT = setTimeout(() => { const h = el.querySelector('.bmd-hide'); if (h) h.classList.add('is-shown'); }, 2600);
  }

  // ── EACH FRAME ────────────────────────────────────────────────────────────────────────────────────────────────
  DJ.update = (dt) => {
    if (disposed) return;
    K.update(dt);
    if (!herd) {
      DJ.prompt = null; DJ.near = false;
      if (DJ.card) { DJ.card = false; cardKey = ''; hud.rule(null); }
      if (state === 'packing') packing(dt);
      if (state === 'travel' && deer.herds.length && (waitT -= dt) <= 0) herd = jobHerd();
      stowPack(state === 'travel');
      return;
    }
    herd.shy = SNAP.shy;
    if (DJ.paused) return;
    if (state === 'travel') { stowPack(true); travel(dt); return; }
    if (state === 'setting') {
      if (!vf) { if (P.mode !== 'foot') { if ((waitT += dt) > 6) { state = 'travel'; DJ.active = false; onStop(); } return; } standCamera(); t = 0; }
      // (moved off by the menu's "back to town" while the legs swing out: the camera folds away, no view opened)
      if (Math.hypot(P.position.x - vf.at.x, P.position.z - vf.at.z) > 4) { packUp(false); return; }
      if (!vf.posed) { poseHerd(); vf.posed = true; }   // (the herd starts for its spots while the legs swing out)
      t += dt; K.spread(t / SNAP.unfold);
      if (t >= SNAP.unfold) openView();
      return;
    }
    if (state === 'packing') { packing(dt); return; }
    if (state === 'view') {
      // (moved off by the menu's "back to town": the camera is left behind, so it folds away)
      if (Math.hypot(P.position.x - vf.at.x, P.position.z - vf.at.z) > 4) { packUp(false); return; }
      t += dt;
      K.eye(eye);
      const fov = fitView(dt), near = clearTo(fov);
      camera.position.copy(eye); camera.lookAt(look);
      // (the frame isn't always in the middle of the screen: on a phone held upright it sits near the top. The view is
      // shifted so the herd is in the middle of the frame, not of the screen)
      { const fr = vf.frameEl.getBoundingClientRect(), dy = Math.round(innerHeight / 2 - (fr.top + fr.height / 2)), dx = Math.round(innerWidth / 2 - (fr.left + fr.width / 2));
        const o = camera.view; if (!o || !o.enabled || o.offsetX !== dx || o.offsetY !== dy || o.fullWidth !== innerWidth || o.fullHeight !== innerHeight) camera.setViewOffset(innerWidth, innerHeight, dx, dy, innerWidth, innerHeight); }
      if (Math.abs(camera.fov - fov) > 0.01 || Math.abs(camera.near - near) > 0.05) { camera.fov = fov; camera.near = near; camera.updateProjectionMatrix(); }
      camera.updateMatrixWorld();
      K.root.visible = false;   // (seen from inside it: the box would fill the view)
      placeTags();
      if (vf.ready && !vf.busy && !vf.helped && vf.helpEl.hidden && (vf.idle += dt) > (vf.shot && !vf.shot.young && vf.shot.steps.length > 2 ? SNAP.helpAfterTwo : SNAP.helpAfter)) { vf.helped = true; help({}); }
    }
  };
  function packing(dt) {
    t += dt;
    K.root.visible = true;
    K.spread(1 - t / (SNAP.unfold * 0.7));
    if (t >= SNAP.unfold * 0.7) {
      K.root.visible = false; state = 'travel'; DJ.active = false; vf = null; waitT = Math.max(waitT, 0);
      onStop();
      P.cam.snap();
    }
  }

  // (the herd's deer where they are now; the trail is laid again once they have moved on more than 20 m, src/hob.js)
  DJ.marks = () => { if (!herd || state !== 'travel' || !herd.deer.length || resting) return []; const c = where(); return [{ id: 'deer', icon: 'job', x: c.x, z: c.z, label: 'Deer photographs' }]; };
  DJ.tags = () => (vf && vf.items ? vf.items.map((it) => ({ value: vf.shot.values[it.i], x: Math.round(it.x), y: Math.round(it.y), key: String(vf.shot.values[it.i]), on: it.on && vf.ready, right: it.i === vf.shot.right })) : []);
  DJ.pick = (value) => { if (!vf || !vf.shot) return false; const i = vf.shot.values.indexOf(value); if (i < 0) return false; shoot(i); return true; };
  DJ.workSum = () => (DJ.active && vf && vf.shot ? deerSum(vf.shot) : null);   // (the tools' Work it out: src/math/jobsums.js)
  DJ.herd = () => herd;   // (the job's herd, or null till the deer are in)
  // (the camera could go up from where the player stands: Miss Wren's words when she lends it, src/jobfolk.js)
  DJ.inReach = () => {
    if (!herd || state !== 'travel' || !herd.deer.length || !(herd.state === 'calm' || herd.state === 'alert')) return false;
    const c = where(), d = Math.hypot(P.position.x - c.x, P.position.z - c.z);
    return d >= SNAP.setMin && d <= SNAP.setMax;
  };
  DJ.flash = () => K.flash();   // (for rigs: the flash and smoke seen from outside)
  DJ.state = () => ({ state, herd: herd && herd.id, herdState: herd && herd.state, near: DJ.near, prompt: DJ.prompt, active: DJ.active,
    shot: vf && vf.shot ? { eq: vf.shot.eq, x: vf.shot.x, values: vf.shot.values, level: vf.shot.level, kind: vf.shot.kind, placing: vf.shot.placing } : null, pics: vf ? vf.pics : 0,
    ready: !!(vf && vf.ready), busy: !!(vf && vf.busy), album: prints(rider).length, fov: +camera.fov.toFixed(1), turn: vf && vf.turn != null ? +vf.turn.toFixed(3) : null, tilt: vf && vf.tilt != null ? +vf.tilt.toFixed(3) : null, resting, lent: !!rider.cameraLent, easier });
  DJ.camera = K;
  DJ.dispose = () => {
    disposed = true;
    if (state === 'view') closeView();
    if (DJ.card) hud.rule(null);
    if (herd) herd.shy = null;
    pack.removeFromParent(); K.dispose();
  };

  // ── THE SOUND: a shutter's click and the whoomp of the flash powder (made in code) ──────────────────────────────
  let noise = null;
  function flashSound() {
    const ctx = audio && audio.ctx, out = audio && audio.out; if (!ctx || !out) return;
    try {
      if (!noise) { noise = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const t0 = ctx.currentTime + 0.01;
      const burst = (freq, type, q, peak, decay, at) => {
        const s = ctx.createBufferSource(); s.buffer = noise;
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + 0.004); g.gain.exponentialRampToValueAtTime(0.001, at + decay);
        s.connect(f); f.connect(g); g.connect(out); s.start(at); s.stop(at + decay + 0.05);
      };
      burst(3200, 'bandpass', 3, 0.5, 0.05, t0);               // the shutter's click
      burst(900, 'lowpass', 0.7, 0.7, 0.75, t0 + 0.03);         // the flash powder's whoomp
      burst(180, 'lowpass', 1, 0.6, 0.35, t0 + 0.03);           // ... and its thump
    } catch (e) { /* no sound: never mind */ }
  }

  return DJ;
}

// the balance: the x side on the left pan, the other side on the right, the beam tipped toward the heavier
function balanceSvg(b) {
  const tilt = b.tip * 9;
  const pan = (x, label, value) => `<g transform="translate(${x} 0)"><path d="M-30 0 L0 -34 L30 0" fill="none" stroke="#8a6a3a" stroke-width="1.2"/>
    <path d="M-34 0 h68 a34 9 0 0 1 -68 0z" fill="#c39a45" stroke="#7a5a22"/>
    <text y="-44" text-anchor="middle" class="bmd-pan-t">${esc(label)}</text><text y="-60" text-anchor="middle" class="bmd-pan-v">${esc(value)}</text></g>`;
  // (the pans hang straight down from the beam's ends, which rise and fall as it tips)
  const L = 82, dy = Math.sin(tilt * Math.PI / 180) * L;
  return `<svg class="bmd-balance" viewBox="-130 -92 260 132" aria-hidden="true">
    <path d="M0 4 L-16 34 H16 Z" fill="#6b4a2a"/><rect x="-3" y="-14" width="6" height="22" fill="#6b4a2a"/>
    <g transform="rotate(${tilt})"><rect x="-${L + 4}" y="-17" width="${2 * L + 8}" height="5" rx="2" fill="#7d4f2a"/></g>
    <g transform="translate(${-L * Math.cos(tilt * Math.PI / 180)} ${-dy + 16})">${pan(0, b.leftText, b.leftValue)}</g>
    <g transform="translate(${L * Math.cos(tilt * Math.PI / 180)} ${dy + 16})">${pan(0, b.rightText, b.rightValue)}</g>
  </svg>`;
}

function ensureCss() {
  if (document.getElementById('bmd-css')) return;
  const s = document.createElement('style'); s.id = 'bmd-css';
  s.textContent = `
/* the ground glass: the canvas a little sepia while looking through it */
canvas.bmd-glass { filter: sepia(0.5) saturate(0.85) contrast(1.04); }
body.bmd-viewing .bmh-top, body.bmd-viewing .bmh-touch, body.bmd-viewing .bmh-prompt, body.bmd-viewing .bmh-help { visibility: hidden; }
.bmd-vf { position: fixed; inset: 0; z-index: 0; cursor: crosshair; touch-action: none; user-select: none; -webkit-user-select: none;
  --fw: min(94vw, calc((100vh - 170px) * 1.5)); }
.bmd-frame { position: absolute; left: 50%; top: 50%; width: var(--fw); aspect-ratio: 3 / 2; transform: translate(-50%, -50%);
  box-shadow: 0 0 0 200vmax rgba(14, 10, 7, 0.9), inset 0 0 60px rgba(30, 20, 10, 0.55); border: 2px solid #3a2a1b; border-radius: 3px; pointer-events: none; }
.bmd-grid { position: absolute; inset: 0; background:
  linear-gradient(to right, transparent calc(33.3% - 0.5px), rgba(255,250,235,0.18) calc(33.3% - 0.5px), rgba(255,250,235,0.18) calc(33.3% + 0.5px), transparent calc(33.3% + 0.5px), transparent calc(66.6% - 0.5px), rgba(255,250,235,0.18) calc(66.6% - 0.5px), rgba(255,250,235,0.18) calc(66.6% + 0.5px), transparent calc(66.6% + 0.5px)),
  linear-gradient(to bottom, transparent calc(33.3% - 0.5px), rgba(255,250,235,0.18) calc(33.3% - 0.5px), rgba(255,250,235,0.18) calc(33.3% + 0.5px), transparent calc(33.3% + 0.5px), transparent calc(66.6% - 0.5px), rgba(255,250,235,0.18) calc(66.6% - 0.5px), rgba(255,250,235,0.18) calc(66.6% + 0.5px), transparent calc(66.6% + 0.5px)); }
.bmd-corner { position: absolute; inset: 10px; border: 1px solid rgba(255, 250, 235, 0.22); border-radius: 2px; }
.bmd-eq { position: absolute; left: 50%; top: max(10px, calc(50% - var(--fw) / 3 - 74px)); transform: translateX(-50%); text-align: center; pointer-events: none;
  background: #f1e6cc; color: #2b1d12; border: 1px solid #8a6a3a; border-radius: 8px; padding: 6px 18px 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.45); max-width: 92vw; }
.bmd-eq small { display: block; font: 500 13px Bitter, Georgia, serif; color: #6b5236; }
.bmd-eq b { display: block; font: 700 30px/1.15 Bitter, Georgia, serif; letter-spacing: 0.02em; white-space: nowrap; }
.bmd-eq i { display: block; font: 600 16px Bitter, Georgia, serif; font-style: normal; color: #4a3826; margin-top: 2px; }
.bmd-eq.is-in { animation: bmd-in 0.45s cubic-bezier(.2,.8,.3,1.2); }
@keyframes bmd-in { from { transform: translate(-50%, -14px); opacity: 0; } }
.bmd-tags { position: absolute; inset: 0; pointer-events: none; }
.bmd-tag { position: absolute; left: 0; top: 0; opacity: 0; transition: opacity 0.3s; will-change: transform; }
.bmd-tag.is-on { opacity: 1; }
.bmd-tag.is-out { opacity: 0 !important; }
.bmd-tag b { position: absolute; left: 0; bottom: 6px; transform: translateX(-50%); display: block; min-width: 34px; padding: 3px 9px 4px;
  font: 700 20px/1 Bitter, Georgia, serif; color: #2b1d12; text-align: center; white-space: nowrap;
  background: #f4e9cf; border: 2px solid #b48a3c; border-radius: 6px 6px 6px 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.5); }
.bmd-tag b::after { content: ''; position: absolute; left: 50%; bottom: -8px; margin-left: -6px; border: 6px solid transparent; border-top-color: #b48a3c; border-bottom: 0; }
.bmd-keys { font: 500 12px Bitter, Georgia, serif; color: #bfae8e; }
.bmd-keys.is-typing { font-size: 15px; color: #f2c66a; }
.bmd-vf.is-touch .bmd-keys { display: none; }
.bmd-tag.is-hover b { background: #fff6dc; border-color: #e2ad4c; box-shadow: 0 0 0 3px rgba(226,173,76,0.55), 0 2px 6px rgba(0,0,0,0.5); }
.bmd-tag.is-wrong b { color: #7a6a58; background: #ddd0b4; text-decoration: line-through; text-decoration-color: rgba(150,50,30,0.7); }
.bmd-tag.is-shake b { animation: bmd-shake 0.4s; }
@keyframes bmd-shake { 25% { margin-left: -6px; } 50% { margin-left: 6px; } 75% { margin-left: -3px; } }
.bmd-bar { position: absolute; right: 14px; bottom: 14px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; justify-content: flex-end;
  font: 500 14px Bitter, Georgia, serif; color: #e9dcc0; }
.bmd-dots { display: flex; gap: 5px; } .bmd-dots i { width: 11px; height: 11px; border-radius: 50%; border: 1.5px solid #c39a45; }
.bmd-dots i.is-on { background: #e2ad4c; }
.bmd-album i { font-style: normal; font-weight: 700; color: #f2c66a; }
.bmd-done { font: 600 15px Bitter, Georgia, serif; color: #f1e6cc; background: rgba(60, 40, 22, 0.92); border: 1px solid #8a6a3a; border-radius: 8px;
  padding: 7px 14px; cursor: pointer; display: flex; gap: 8px; align-items: baseline; }
.bmd-done small { font: 500 11px ui-monospace, monospace; opacity: 0.7; }
.bmd-done:hover { background: rgba(84, 58, 30, 0.95); }
.bmd-flash { position: absolute; inset: 0; background: #fffdf4; opacity: 0; pointer-events: none; }
.bmd-flash.is-on { animation: bmd-flash 0.55s ease-out; }
@keyframes bmd-flash { 0% { opacity: 0.95; } 100% { opacity: 0; } }
.bmd-help { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: max(220px, min(300px, calc((100vw - var(--fw)) / 2 - 16px))); max-height: 70vh; overflow: auto;
  background: #f1e6cc; color: #2b1d12; border: 1px solid #8a6a3a; border-radius: 10px; padding: 10px 14px 12px; box-shadow: 0 6px 22px rgba(0,0,0,0.5);
  cursor: default; animation: bmd-help 0.35s ease-out; }
@keyframes bmd-help { from { opacity: 0; transform: translate(12px, -50%); } }
.bmd-help[hidden] { display: none; }
.bmd-help-h { font: 400 17px Rye, Georgia, serif; color: #6b3f12; }
.bmd-help-p { font: 500 14px/1.35 Bitter, Georgia, serif; margin: 2px 0 8px; }
.bmd-balance { display: block; width: 100%; max-width: 260px; margin: 4px auto 0; }
.bmd-pan-t { font: 600 13px Bitter, Georgia, serif; fill: #3b2a1a; } .bmd-pan-v { font: 700 17px Bitter, Georgia, serif; fill: #8a3a14; }
.bmd-steps { border-top: 1px dashed #b9a37c; padding-top: 6px; }
.bmd-steps-h { font: italic 500 12.5px Bitter, Georgia, serif; color: #6b5236; margin-bottom: 4px; }
.bmd-step { font: 600 18px/1.25 Bitter, Georgia, serif; padding: 2px 0; }
.bmd-step small { display: block; font: 500 12px Bitter, Georgia, serif; color: #8a5a14; }
.bmd-hide { font-style: normal; filter: blur(7px); opacity: 0.6; transition: filter 0.6s, opacity 0.6s; }
.bmd-hide.is-shown { filter: none; opacity: 1; }
.bmd-print { position: absolute; left: 50%; bottom: 8vh; width: min(300px, 70vw); background: #f4ecd8; padding: 10px 10px 8px; border-radius: 2px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.6); transform: translate(-50%, 120%) rotate(-4deg); opacity: 0; pointer-events: none;
  transition: transform 0.6s cubic-bezier(.2,.8,.3,1.1), opacity 0.4s; }
.bmd-print.is-in { transform: translate(-50%, 0) rotate(-2deg); opacity: 1; }
.bmd-print.is-away { transform: translate(calc(-50% + var(--fx)), var(--fy)) rotate(6deg) scale(0.12); opacity: 0.2; transition: transform 0.7s ease-in, opacity 0.7s ease-in; }
.bmd-print img, .bmd-print-blank { display: block; width: 100%; aspect-ratio: 3 / 2; border: 1px solid #b9a37c; background: #cdb88f; }
.bmd-print-eq { font: italic 600 21px Bitter, Georgia, serif; color: #2e2014; text-align: center; padding-top: 6px; }
.bmd-print-x { font: italic 600 17px Bitter, Georgia, serif; color: #8a5a14; text-align: center; }
.bmd-print-gold { position: absolute; right: -12px; top: -14px; font: 700 16px Bitter, Georgia, serif; color: #3b2a12; background: #e2ad4c; border-radius: 14px;
  padding: 3px 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.4); }
@media (max-width: 700px) {
  .bmd-eq b { font-size: 24px; } .bmd-eq small { font-size: 12px; }
  .bmd-help { left: 10px; right: 10px; width: auto; top: auto; bottom: 64px; transform: none; max-height: 42vh; padding: 8px 12px; }
  @keyframes bmd-help { from { opacity: 0; transform: translateY(12px); } }
  .bmd-balance { max-width: 200px; }
  .bmd-bar { left: 10px; right: 10px; bottom: 10px; justify-content: space-between; }
}
/* a phone held upright: the frame near the top (under the equation), the help card under it, Hob's caption below */
@media (max-aspect-ratio: 1/1) {
  .bmd-vf { --fw: 96vw; }
  .bmd-frame { top: 164px; transform: translateX(-50%); }
  .bmd-eq { top: 74px !important; }
  .bmd-help { left: 8px !important; right: 8px !important; width: auto !important; transform: none !important; bottom: auto !important;
    top: calc(164px + var(--fw) / 1.5 + 10px) !important; max-height: max(120px, calc(100vh - 164px - var(--fw) / 1.5 - 178px)) !important; }
  .bmd-balance { max-width: 150px !important; }
  .bmd-print { bottom: auto; top: calc(164px + var(--fw) / 1.5 + 14px); }
}
/* a phone held sideways (short and wide): the frame at the left under the purse, as big as the height allows; the
   equation and the help card in the column to its right (the help's balance beside its steps); Old Hob's line in the
   strip under the frame, not over it (its bottom is set inline by the HUD on small screens, hence the !important) */
@media (max-height: 500px) and (min-aspect-ratio: 4/3) {
  .bmd-vf { --fw: min(58vw, calc((100vh - 106px) * 1.5)); --col: calc(var(--fw) + 18px); }
  .bmd-frame { left: 8px; top: 54px; transform: none; }
  .bmd-eq { left: calc(var(--col) + (100vw - var(--col) - 8px) / 2); top: 54px !important; padding: 2px 14px 4px; max-width: calc(100vw - var(--col) - 8px); }
  .bmd-eq b { font-size: 22px; } .bmd-eq small { font-size: 11px; }
  .bmd-help { left: var(--col) !important; right: 8px !important; width: auto !important; top: 118px !important; bottom: 54px !important;
    transform: none !important; max-height: none !important; padding: 6px 10px 6px; display: grid; grid-template-columns: 1fr 1fr; column-gap: 10px; align-content: start; }
  @keyframes bmd-help { from { opacity: 0; transform: translateX(12px); } }
  .bmd-help-h { grid-column: 1; font-size: 15px; } .bmd-balance { grid-column: 1; max-width: 150px !important; } .bmd-help-p { grid-column: 1; font-size: 13px; margin-bottom: 0; }
  .bmd-steps { grid-column: 2; grid-row: 1 / span 3; border-top: 0; border-left: 1px dashed #b9a37c; padding: 0 0 0 10px; }
  .bmd-step { font-size: 16px; } .bmd-steps-h { font-size: 11.5px; }
  .bmd-bar { left: var(--col); right: 8px; bottom: 8px; justify-content: flex-end; gap: 10px; }
  .bmd-print { width: min(240px, 40vw); bottom: 12px; }
  body.bmd-viewing .bmh-hob { left: 8px; bottom: 3px !important; max-width: min(58vw, calc((100vh - 106px) * 1.5)); padding: 3px 10px 4px 6px; gap: 6px; }
  body.bmd-viewing .bmh-hob-face svg { width: 24px; height: 24px; }
  body.bmd-viewing .bmh-hob-text b { display: none; }
  body.bmd-viewing .bmh-hob-text span { font-size: 13px; line-height: 1.25; }
}
`;
  document.head.appendChild(s);
}
