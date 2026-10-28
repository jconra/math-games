// THE SALOON'S CROWD: townsfolk hanging out in the saloon's hall while the band plays (src/stage.js). They are the town's
// own people (src/townpeople.js: their names, outfits, colours and hats): the ones indoors at the saloon, and, while
// there is room, folks indoors elsewhere who come over. Each takes a seat or a standing spot (labs/buildings/saloon.js
// anchors.crowd; src/saloonfolkplan.js picks one, the ones looking at the stage likelier): a chair at a table, a stool at
// the bar, a spot at the sides of the stage or by the bar's front end. Never on the stage, the stairs' foot, the
// doorways' ways in, the bar's end, or the chalkboard with its teacher's and player's spots.
//
// They come and go: in at a doorway (dissolving in as they pass it, as the townsfolk do at every door) and along the
// aisles to their place, and after a few minutes back out the same way; then the town's people take them on from the
// saloon's door. Nobody pops in or out in sight: someone arriving or leaving where the player can't see is just placed
// or gone. While the band plays they nod along on the beat (a foot tapping), heads turned to the band; when a song ends
// they clap (each one's own clapping in the applause's sound, their hands meeting with it: src/audio/applause.js), and
// now and then someone whistles or calls out ("Yeehaw!", a speech bubble).
//
// Their clips (models/people/clips_crowd_m.glb, _f.glb, made in Blender by ~/pw/bandit-math/rigs/clips/
// build_crowd_clips.py): Sit_Listen, Sit_Clap (a chair), Stool_Bar, Stool_Clap (a bar stool: turned to the room to
// clap), Stand_Listen, Stand_Clap; four beats of the music long, a clap every quarter second. The head's turn toward the
// band is laid on the clips each frame after the mixer (people.js puts the bones back before the next mixer update, so
// it never piles up).
//
// How many: the governor's 'saloon' dial (world/governor.js; by tier: potato 2, normal 4, gaming 6, more past gaming),
// and only as many townsfolk as are indoors. Bodies are made when the player comes within SALOON_FOLK.make metres of the
// saloon and drawn only while its inside is loaded and seen; out on the trail nothing.
//
//   const C = makeSaloonFolk({ W, folk, TP, stage, camera, scene })   TP: the town's people (src/townpeople.js);
//                         stage: the band (src/stage.js: its music's beat, its sound path, and it calls C.applaud)
//   C.update(dt, at)      each frame of play (at: the player's position)
//   C.applaud(at)         the song has ended: everyone there claps, from ctx time `at` (stage.js calls it)
//   C.hush()              the clapping stops short (the card asked for a song before the last chord)
//   C.cheer()             the band was asked for a song: now and then someone calls out
//   C.people              [{ name, kind, state, x, z }]: who is in the hall (for rigs: C.state())
//   C.state()             for rigs: { saloon, most, shown, people: [{ name, kind, state, clip, fade, x, z, seat }], clapping, ... }
//   C.fill(n)             for rigs: n people placed at once (unseen arrivals), up to the most
//   C.dispose()
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { makePerson } from './actors/folk.js';
import { SALOON_FOLK, crowdMost, spotsOf, pickSpot, makeNav, faceTo, lookAt } from './saloonfolkplan.js';
import { applausePlan, makeApplause } from './audio/applause.js';
import { howdy } from './ui/howdy.js';

// the clapping's sound: its level into the band's sound path (as STAGE.level is for the band), and each person's own
// positioned sound (as the band's: full at `ref` m, softening past it), at the height of their hands
export const CROWD_SOUND = { level: 2.4, ref: 3, rolloff: 1.1, hands: { sit: 1.0, stand: 1.25 } };
const CLIPS = { m: 'clips_crowd_m.glb', f: 'clips_crowd_f.glb' };
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const rnd = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const UPY = new THREE.Vector3(0, 1, 0);

export function makeSaloonFolk({ W, folk, TP, stage, camera = null, scene = W.scene }) {
  const F = SALOON_FOLK, C = { people: [] };
  let disposed = false, hall = null, findT = 0, placedKey = '', frame = null, frameYaw = 0, crowd = null, spots = [], nav = null, stageAt = null;
  let most = crowdMost(W.tier || 'normal'), shown = false, near = false, tickT = 0, nextIn = 0, filled = false, clipsReady = null, clipsOk = false;
  let applause = null, clapping = false, makeT = 0;
  const offGov = W.governor && W.governor.on ? W.governor.on('saloon', (v) => { most = v; }) : null;
  const recs = [], away = new Map(), sayQ = [];
  const t = () => performance.now() / 1000;
  // (the sound's clock as it is heard: the output's own delay taken off, so hands meet with their claps)
  const ctxNow = () => { const io = stage && stage.soundIn ? stage.soundIn() : null; return io ? io.ctx.currentTime - (io.ctx.outputLatency || 0) : null; };

  // ── THE SALOON: its frame and its crowd's places, found once a second (again if it moves) ─────────────────────────
  function findSaloon() {
    const Cd = W.V && W.V.CODE, o = Cd && Cd.find ? Cd.find('saloon') : null;
    return o && o.code && o.code.B && o.code.B.anchors && o.code.B.anchors.crowd ? o : null;
  }
  const keyOf = (o) => { o.code.group.updateMatrixWorld(true); const e = o.code.group.matrixWorld.elements; return `${e[12].toFixed(2)},${e[14].toFixed(2)},${e[0].toFixed(3)},${e[8].toFixed(3)}`; };
  function place() {
    const g = hall.code.group; g.updateMatrixWorld(true);
    frame = g.matrixWorld.clone(); frameYaw = new THREE.Euler().setFromRotationMatrix(frame, 'YXZ').y;
    crowd = hall.code.B.anchors.crowd; spots = spotsOf(crowd); nav = makeNav(crowd);
    stageAt = { x: crowd.stage[0], z: crowd.stage[1] };
    // (anyone already in: back to their place, the same spot if it is still there)
    for (const r of recs) { const s = spots.find((q) => q.i === r.spot.i) || r.spot; r.spot = s; if (r.state === 'here') { r.x = s.x; r.z = s.z; } }
  }
  const V3 = new THREE.Vector3();
  const world = (x, z, y = 0) => V3.set(x, crowd.floor + y, z).applyMatrix4(frame);
  const middle = () => world(stageAt.x, stageAt.z, 1.5).clone();
  // a place in the hall in the camera's view (with a margin): a pop there would be seen
  const FR = new THREE.Frustum(), PM = new THREE.Matrix4(), SPH = new THREE.Sphere();
  let frT = -1;
  function seen(x, z) {
    if (!shown || !camera) return false;
    if (frT !== tickT) { camera.updateMatrixWorld(); PM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); FR.setFromProjectionMatrix(PM); frT = tickT; }
    SPH.center.copy(world(x, z, 0.9)); SPH.radius = 1.0;
    return FR.intersectsSphere(SPH);
  }

  // ── THE CLIPS: the crowd's own, added to the folk's skeletons the first time they are near ────────────────────────
  function loadClips() {
    if (clipsReady) return clipsReady;
    clipsReady = Promise.all(['m', 'f'].map((b) => loader.loadAsync(folk.dir + CLIPS[b]).then((g) => folk.addClips(b, g.animations))))
      .then(() => { clipsOk = true; })
      .catch((e) => { console.error('saloon folk: their clips could not be loaded', e); });
    return clipsReady;
  }

  // ── WHO IS IN ────────────────────────────────────────────────────────────────────────────────────────────────────
  const edgeIds = () => new Set((TP.edges || []).map((e) => e.id));
  const recOf = (r) => recs.find((q) => q.r === r);
  const taken = () => new Set(recs.filter((q) => q.state !== 'gone').map((q) => q.spot.i));
  // a townsperson indoors who could come in: those at the saloon first, then those in the homes or the store
  function candidate() {
    const edges = edgeIds(), tn = t();
    const list = (TP.people || []).filter((r) => r.state === 'inside' && !r.out && !r.lent && !edges.has(r.in) && !recOf(r) && (away.get(r.name) || 0) <= tn);
    const here = list.filter((r) => r.in === 'saloon');
    const pool = here.length && Math.random() < 0.7 ? here : list;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }
  // placed: put straight in the seat (nobody can see it happen); first: one of those already there when the saloon is
  // first come to (placed unless the player is looking right at the seat: then they walk in)
  function arrive(r, { placed = false, first = false } = {}) {
    const spot = pickSpot(spots, taken()); if (!spot) return null;
    if (first) placed = !(shown && seen(spot.x, spot.z)); else if (!shown) placed = true;
    r.in = 'saloon';
    const q = { r, name: r.name, spot, state: 'here', x: spot.x, z: spot.z, yaw: spot.rot, fade: 1, until: t() + rnd(...F.stay), body: null, path: null, seg: 0, s: 0,
      speed: rnd(...F.walk), clap: null, look: 0, wait: 0, pass: 0, k: 0, door: null, sound: null };
    if (!placed && shown) {
      // in at a doorway (the main door mostly), along the aisles to the place
      const doors = crowd.doors.filter((d) => nav.path(nav.nodes[d.node], spot.at));
      const d = doors.length > 1 && Math.random() < 0.3 ? doors[1] : doors[0];
      if (d) {
        const out = { x: d.out[0], z: d.out[1] }, p = nav.path(nav.nodes[d.node], spot.at);
        q.path = [out, ...p]; q.seg = 0; q.s = 0; q.state = 'in'; q.fade = 0; q.x = out.x; q.z = out.z; q.door = d;
        q.yaw = faceTo(out, p[0]);
      }
    }
    if (q.state === 'here') q.yaw = seatYaw(q);
    recs.push(q);
    return q;
  }
  // a seat's own facing, turned on it toward the stage a little (a stool at the bar faces the bar; it swivels to clap)
  function seatYaw(q) {
    const s = q.spot; if (s.kind === 'stand' || s.kind === 'stool') return s.rot;
    return s.rot + Math.max(-F.turn, Math.min(F.turn, wrap(faceTo(s, stageAt) - s.rot)));
  }
  function leave(q) {
    if (q.state === 'out' || q.state === 'gone' || q.state === 'rise') return;
    const s = q.spot;
    // (not seen: just gone; seen: up from the seat and out the nearer doorway)
    if (!q.body || !shown || !seen(q.x, q.z)) { gone(q); return; }
    const doors = crowd.doors.map((d) => ({ d, p: nav.path(s.at, nav.nodes[d.node]) })).filter((x) => x.p);
    if (!doors.length) { gone(q); return; }
    const pick = doors.sort((a, b) => len(a.p) - len(b.p))[0];
    q.path = [...pick.p, { x: pick.d.out[0], z: pick.d.out[1] }]; q.seg = 0; q.s = 0; q.door = pick.d;
    q.state = s.kind === 'stand' ? 'out' : 'rise'; q.k = 0;
  }
  const len = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); return L; };
  function gone(q) {
    q.state = 'gone';
    const r = q.r;
    if (r.state === 'inside' && !r.lent) { r.until = 0; r.busyIn = 0; }   // (the town's people take them on from the saloon's door)
    away.set(q.name, t() + F.again);
    drop(q);
  }
  function drop(q) {
    const i = recs.indexOf(q); if (i >= 0) recs.splice(i, 1);
    if (q.r) q.r.busyIn = 0;
    if (q.body) { q.body.root.removeFromParent(); q.body.dispose(); q.body = null; }
    if (q.sound) { try { q.sound.disconnect(); q.sound.g.disconnect(); } catch (e) { /* gone */ } q.sound = null; }
  }
  // once a second: the town's people kept in (or let go when taken for a job), the newcomers, the leavers
  function tick() {
    const tn = t();
    for (const q of [...recs]) {
      const r = q.r;
      if (r.state !== 'inside' || r.lent || r.out) {
        // (taken for a job or out of a door by the town's people: gone from here, a quick dissolve if in sight)
        if (q.body && shown && seen(q.x, q.z) && q.state !== 'vanish') { q.state = 'vanish'; q.k = 0; } else if (q.state !== 'vanish') drop(q);
        continue;
      }
      if (q.state === 'gone') continue;
      r.until = Math.max(r.until || 0, 5); r.busyIn = 40;   // (kept in, and dear to borrow for a job: src/townpeople.js)
      if (q.state === 'here' && tn > q.until && !(clapping && q.clap)) leave(q);
    }
    const inHall = recs.filter((q) => q.state === 'in' || q.state === 'sit' || q.state === 'here').length;
    if (inHall > most) { const q = recs.filter((x) => x.state === 'here').sort((a, b) => a.until - b.until)[0]; if (q) leave(q); }
    else if (inHall < most && spots.length) {
      // the first time (or nobody there): most of them already in, placed where they sit; then one by one
      if (!filled) { filled = true; const n = Math.round(most * F.first); for (let i = inHall; i < n; i++) { const r = candidate(); if (!r || !arrive(r, { first: true })) break; } nextIn = tn + rnd(...F.gap); }
      else if (tn >= nextIn) { const r = candidate(); if (r) arrive(r); nextIn = tn + rnd(...F.gap); }
    }
  }

  // ── EACH FRAME ───────────────────────────────────────────────────────────────────────────────────────────────────
  let lastPos = null;
  C.update = (dt, pos) => {
    if (disposed || !TP || off) return;
    lastPos = pos || null;
    if ((findT -= dt) <= 0) {
      findT = 1;
      const o = findSaloon();
      if (o !== hall) { hall = o; placedKey = ''; if (!hall) { for (const q of [...recs]) drop(q); } }
      if (hall) { const k = keyOf(hall); if (k !== placedKey) { placedKey = k; place(); } }
    }
    if (!hall || !crowd) return;
    const mid = world(stageAt.x, stageAt.z);
    near = !!pos && Math.hypot(pos.x - mid.x, pos.z - mid.z) < F.make;
    shown = near && hall.code.loaded && hall.code.seen !== false;
    tickT++;
    if ((C._tick = (C._tick || 0) - dt) <= 0) { C._tick = 1; tick(); }
    if (near) loadClips();
    // bodies: one made a frame at most, once their clips are in
    if (near && clipsOk && (makeT -= dt) <= 0) {
      const q = recs.find((x) => !x.body && x.state !== 'gone' && x.state !== 'vanish');
      if (q) { makeT = 0.15; makeBody(q); }
    }
    const ct = ctxNow(), M = stage && stage.music, beat = M && M.beat ? M.beat() : null;
    for (const q of [...recs]) {
      step(q, dt);
      const b = q.body; if (!b) continue;
      const on = shown && q.fade > 0.001;
      b.root.visible = on;
      if (!on) continue;
      pose(q, dt, ct, beat, M);
    }
    // what someone calls out (a speech bubble at its moment in the applause)
    if (ct != null) for (let i = sayQ.length - 1; i >= 0; i--) if (ct >= sayQ[i].at) { const s = sayQ.splice(i, 1)[0]; const q = recs.find((x) => x.name === s.name); if (q && q.body && shown) howdy(q.body, s.text, { ms: 2200, key: 'crowd' }); }
    C.people = recs.map((q) => ({ name: q.name, kind: q.spot.kind, state: q.state, x: q.x, z: q.z }));
  };

  // walking in and out, sitting down and getting up, the doorway's dissolve
  function step(q, dt) {
    if (q.state === 'vanish') { q.fade -= dt / F.fadeIn; if (q.body) q.body.fade = Math.max(0, q.fade); if (q.fade <= 0) drop(q); return; }
    if (q.state === 'in' || q.state === 'out') {
      // (stopped for the player standing in the way, a moment)
      const a = q.path[q.seg], b = q.path[q.seg + 1];
      if (!b) { arrived(q); return; }
      const L = Math.hypot(b.x - a.x, b.z - a.z) || 1e-6;
      // (after waiting a while they step on round the player: never stuck for good)
      if (q.pass > 0) q.pass -= dt;
      else if (blocked(q)) { q.wait += dt; if (q.wait < F.waitMost) return; q.pass = 2; }
      q.wait = 0; q.s += q.speed * dt;
      while (q.s >= L && q.path[q.seg + 2]) { q.s -= L; q.seg++; return; }
      const u = Math.min(1, q.s / L);
      q.x = a.x + (b.x - a.x) * u; q.z = a.z + (b.z - a.z) * u;
      q.yaw += wrap(faceTo(a, b) - q.yaw) * Math.min(1, dt * 8);
      // the doorway: dissolving in over the first steps in, out over the last ones out
      const walked = len(q.path.slice(0, q.seg + 1)) + q.s, total = len(q.path);
      q.fade = q.state === 'in' ? Math.min(1, walked / (F.fadeIn * q.speed * 1.6)) : Math.min(1, (total - walked) / (F.fadeIn * q.speed * 1.6));
      if (u >= 1) arrived(q);
      return;
    }
    if (q.state === 'sit' || q.state === 'rise') {
      q.k = Math.min(1, q.k + dt / F.sit);
      const s = q.spot, u = q.state === 'sit' ? q.k : 1 - q.k, e = u * u * (3 - 2 * u);
      q.x = s.at.x + (s.x - s.at.x) * e; q.z = s.at.z + (s.z - s.at.z) * e;
      const want = q.state === 'sit' ? seatYaw(q) : faceTo(s, s.at);
      q.yaw += wrap(want - q.yaw) * Math.min(1, dt * 6);
      if (q.k >= 1) { if (q.state === 'sit') { q.state = 'here'; q.yaw = seatYaw(q); } else { q.state = 'out'; q.seg = 0; q.s = 0; } }
    }
  }
  function arrived(q) {
    if (q.state === 'in') { q.x = q.spot.at.x; q.z = q.spot.at.z; if (q.spot.kind === 'stand') { q.state = 'here'; q.yaw = q.spot.rot; } else { q.state = 'sit'; q.k = 0; } q.fade = 1; }
    else if (q.state === 'out') gone(q);
  }
  // the player in the way: within F.wait ahead of a walker (on the hall's floor)
  const PL = new THREE.Vector3();
  function blocked(q) {
    const p = lastPos; if (!p || !frame) return false;
    PL.copy(p).applyMatrix4(invFrame()); const dx = PL.x - q.x, dz = PL.z - q.z, d = Math.hypot(dx, dz);
    return d < F.wait && (dx * Math.sin(q.yaw) + dz * Math.cos(q.yaw)) > 0.3 * d;
  }
  let inv = null, invKey = '';
  const invFrame = () => { if (invKey !== placedKey) { inv = frame.clone().invert(); invKey = placedKey; } return inv; };

  function makeBody(q) {
    try {
      const b = makePerson(folk, { ...q.r.look, shadows: false });
      b.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.raycast = () => {}; } });
      b.root.visible = false; scene.add(b.root); q.body = b; q.clip = '';
      b.fade = q.fade;
    } catch (e) { console.warn('saloon folk: a body could not be made', q.name, e); q.body = null; q.r.busyIn = 0; }
  }
  // the body where the person is, on the clip for what they are doing: walking, listening on the beat, clapping, the head
  // turned toward the band
  function pose(q, dt, ct, beat, M) {
    const b = q.body, s = q.spot, kind = s.kind, [listen, clapClip] = F.clips[kind];
    let clip = 'Walk', speed = 1, yaw = q.yaw;
    const clapNow = q.clap && ct != null && ct >= q.clap.c0 - 0.12 && ct < q.clap.to;
    if (q.state === 'in' || q.state === 'out') { clip = q.wait > 0 ? 'Idle' : 'Walk'; speed = q.speed / ((b.stride && b.stride.Walk) || 1.2); }
    else if (q.state === 'sit' || q.state === 'rise') clip = listen;
    else if (clapNow) {
      clip = clapClip;
      if (kind === 'stool') yaw = faceTo(s, stageAt);   // (swivelled round to the band)
    } else clip = listen;
    if (q.state === 'here' && kind === 'stool' && !clapNow) yaw = s.rot;
    q.turn = q.turn == null ? yaw : q.turn + wrap(yaw - q.turn) * Math.min(1, dt * 5);
    if (b.clip !== clip) b.play(clip, { fade: clip === clapClip ? 0.15 : 0.45, speed });
    else if (clip === 'Walk') b.play(clip, { speed });
    const a = b.person && b.person.cur;
    if (a && clip === clapClip && q.clap && ct != null) {
      // (the clip's claps on this person's own: its time from their first clap, at their pace)
      const r = q.clap.rate / 4, want = (((ct - q.clap.c0) * r) % 3 + 3) % 3;
      a.setEffectiveTimeScale(r); let diff = want - a.time; if (diff > 1.5) diff -= 3; if (diff < -1.5) diff += 3; if (Math.abs(diff) > 0.05) a.time = want;
    } else if (a && clip === listen && beat != null && M && q.state === 'here') {
      // (the nods and the foot on the music's beat, as the band's own clips: stage.js onBeat)
      const d = a.getClip().duration, want = (((beat % 4) + 4) % 4) / 4 * d, base = d / (4 * M.beatLen);
      let diff = want - a.time; if (diff > d / 2) diff -= d; if (diff < -d / 2) diff += d;
      if (Math.abs(diff) > 0.08 * base) a.time = want; else a.setEffectiveTimeScale(base * (1 + Math.max(-0.2, Math.min(0.2, diff * 2 / base))));
    } else if (a && clip === listen) a.setEffectiveTimeScale(1);
    const w = world(q.x, q.z); b.root.position.copy(w); b.root.rotation.y = frameYaw + q.turn;
    b.fade = q.fade;
    b.update(dt);
    // the head toward the band (on the clip, after the mixer: people.js puts these bones back before its next update)
    const want = q.state === 'here' || q.state === 'sit' ? lookAt(q.turn, { x: q.x, z: q.z }, stageAt, F.head) : 0;
    q.look += (want - q.look) * Math.min(1, dt * 3);
    if (Math.abs(q.look) > 0.01 && b.bones.Neck && b.bones.Head) {
      QL.setFromAxisAngle(UPY, q.look * 0.4); b.bones.Neck.quaternion.multiply(QL);
      QL.setFromAxisAngle(UPY, q.look * 0.6); b.bones.Head.quaternion.multiply(QL);
    }
  }
  const QL = new THREE.Quaternion();

  // ── THE APPLAUSE ─────────────────────────────────────────────────────────────────────────────────────────────────
  // each person's own sound: a positioned sound where their hands are, into the band's sound path
  function soundFor(q, io) {
    if (q.sound) return q.sound;
    const ctx = io.ctx, n = ctx.createPanner();
    n.panningModel = 'equalpower'; n.distanceModel = 'inverse'; n.refDistance = CROWD_SOUND.ref; n.rolloffFactor = CROWD_SOUND.rolloff; n.maxDistance = 10000;
    const p = world(q.spot.x, q.spot.z, q.spot.kind === 'stand' ? CROWD_SOUND.hands.stand : CROWD_SOUND.hands.sit + (q.spot.kind === 'stool' ? 0.36 : 0));
    if (n.positionX) { n.positionX.value = p.x; n.positionY.value = p.y; n.positionZ.value = p.z; } else n.setPosition(p.x, p.y, p.z);
    const g = ctx.createGain(); g.gain.value = CROWD_SOUND.level; g.connect(n).connect(io.input);
    if (crowdAn) n.connect(crowdAn);
    n.g = g; q.sound = n;
    return n;
  }
  C.applaud = (at) => {
    const io = stage && stage.soundIn ? stage.soundIn() : null; if (!io || !crowd) return null;
    const here = recs.filter((q) => q.state === 'here' || q.state === 'sit');
    const plan = applausePlan(here.map((q) => ({ id: q.name })));
    if (!plan.hands.length) return plan;
    if (!applause) applause = makeApplause(io.ctx, { room: io.room });
    applause.play(plan, at, (id) => { const q = recs.find((x) => x.name === id); return q && q.state !== 'gone' ? soundFor(q, io).g : null; });
    for (const h of plan.hands) { const q = recs.find((x) => x.name === h.id); if (q) q.clap = { c0: at + h.claps[0].t, to: at + h.to, rate: h.rate }; }
    if (plan.shout) sayQ.push({ name: plan.shout.id, text: plan.shout.text, at: at + plan.shout.t });
    clapping = true; C.lastPlan = plan; C.lastAt = at;
    setTimeout(() => { clapping = false; }, (plan.end + 1) * 1000);
    return plan;
  };
  // (rigs) an analyser on the clapping alone, as it goes into the band's sound path
  let crowdAn = null;
  C.analyser = () => {
    const io = stage && stage.soundIn ? stage.soundIn() : null; if (!io) return null;
    if (!crowdAn) { crowdAn = io.ctx.createAnalyser(); crowdAn.fftSize = 4096; for (const q of recs) if (q.sound) q.sound.connect(crowdAn); }
    return crowdAn;
  };
  C.hush = () => { if (applause) applause.stop(); for (const q of recs) q.clap = null; sayQ.length = 0; clapping = false; };
  C.cheer = () => {
    if (!shown || Math.random() > F.shoutAsk) return;
    const here = recs.filter((q) => q.state === 'here' && q.body); if (!here.length) return;
    const q = here[Math.floor(Math.random() * here.length)];
    setTimeout(() => { if (q.body && shown) howdy(q.body, F.asks[Math.floor(Math.random() * F.asks.length)], { ms: 1900, key: 'crowd' }); }, 500 + Math.random() * 600);
  };
  // (rigs) the hall without its crowd for a while (none drawn, moved or heard): the perf rig's A/B
  let off = false;
  C.setOff = (on) => { off = !!on; if (off) for (const q of recs) if (q.body) q.body.root.visible = false; };
  // (rigs) n people placed at once, up to the most
  C.fill = (n = most) => { let k = 0; while (k < n && recs.filter((q) => q.state !== 'gone').length < most) { const r = candidate(); if (!r || !arrive(r, { placed: true })) break; k++; } filled = true; return k; };
  C.state = () => ({ saloon: !!hall, most, shown, near, clipsOk, clapping, spots: spots.length,
    people: recs.map((q) => ({ name: q.name, kind: q.spot.kind, seat: q.spot.i, state: q.state, clip: q.body ? q.body.clip : null, fade: +q.fade.toFixed(2), x: +q.x.toFixed(2), z: +q.z.toFixed(2),
      drawn: !!(q.body && q.body.root.visible), wait: +q.wait.toFixed(2), look: +(q.look || 0).toFixed(2), turn: q.turn == null ? null : +q.turn.toFixed(2), clap: q.clap ? { c0: +q.clap.c0.toFixed(2), to: +q.clap.to.toFixed(2), rate: +q.clap.rate.toFixed(2) } : null })) });
  // (rigs) where someone is, in the world, and their body
  C.bodyOf = (name) => { const q = recs.find((x) => x.name === name); return q ? q.body : null; };
  C.dispose = () => {
    disposed = true; if (offGov) offGov(); if (applause) applause.stop();
    for (const q of [...recs]) { if (q.r && q.r.state === 'inside') q.r.busyIn = 0; drop(q); }
  };
  return C;
}
