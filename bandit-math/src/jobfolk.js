// THE JOB PEOPLE: a person at each job, who says what is going on and what to do, and thanks the player after. Old Hob
// stays the trail buddy with the hints; these folk do the "what's going on" (who they are and their lines:
// src/jobfolkplan.js):
//   the trail boss       by the corral's gate: his brand's cattle are mixed in with the big herd (the round-up)
//   the veterinarian     by the sheep pasture's gate at the farm: a sickness went through the flock (the sick sheep)
//   the farmer's wife    in the farm's lane by the pig yard: the wind blew the gate open (the loose pigs)
//   the freight driver   the wagon's own driver: while the wagon waits he gets down and stands beside it, and climbs
//                        back up when it rolls (Protect the wagon)
//   the naturalist       a good way off the herd the deer job is after, on the town's side: E by her lends the camera
//                        (strapped behind the saddle at once); while it is lent she strolls after the player round her
//                        herd (never far from her own spot), and E by her again gives it back
//   the sheriff          out in front of his office, to one side of the steps (lock boxes at his desk)
//   the deputy           the other side of the steps, when "Loot the gang" is ticked: the gang's stash out in the valley;
//                        carrying the loot back, E by him shares it out (src/missions/loot.js)
//   the camp foremen     already at the camps (src/camps.js): here they get a name tag, a hello and the speech card for
//                        what the delivery job has them say
// Each stands with the idle clips, shows a name tag when the player is near, and turns to face the player close by.
//
// Talking: walking or riding up, the person says their two lines in a speech card over their head (no button). At an
// area job (the herd, the sheep, the pigs) the job is already running as you arrive, so the hello is said on arriving.
// Where a job waits to be started, E (or a tap on the prompt) by the person starts it: the freight driver's wagon rolls,
// the naturalist's camera is set up, the sheriff's desk opens. Riding into the job as before still starts it too.
// After a job's batch is done the person says a thank-you.
//
// Walking away: riding or walking well clear of the herd, the sheep pasture or the pig yard after working there shows a
// small toast ("The sheep will wait for you"); nothing is lost (the job carries on where it was when you come back). The
// wagon job ends itself the same way (src/missions/wagonjob.js).
//
//   const JF = makeJobFolk({ W, folk, P, camera, hud, jobs, actions })
//     folk: the people library; jobs: getters for the jobs and places { roundup, sheep, pigs, wagon, deer, camps, farm,
//     delivery } (each returns the job or null); actions: { sheriff() } (opens the sheriff's desk); onTalk(what, id): a
//     person's hello ('hello'), the walking-away toast ('leave') and a person's thank-you ('thanks'), for the player's
//     own howdy and see-ya and the men's recorded thanks and goodbyes (shouts.js); id: the person; who: { at, male }
//   JF.update(dt, { hidden })   each frame while riding, before the doors are looked at (hidden: a panel or the cabin is
//                       up: the tags and the speech card are put away and the people wait)
//   JF.prompt           the prompt's words when E by a person does something, else null; JF.talk() does it
//   JF.heard(event, data)   a Hob event (src/hob.js): the thank-yous and the driver's "let's roll" come from these;
//                       also 'sheriffDone' (lock boxes cracked for the sheriff)
//   JF.say(id, text)    a person (an id of JOB_FOLK, or a camp's id for its foreman) says a line now
//   JF.speaking()       true while a speech card is on the screen
//   JF.people           the records: { id, name, role, p (the person), x, z, face }
//   JF.state()          for rigs;  JF.dispose()
import * as THREE from 'three';
import { makePerson } from './actors/folk.js';
import { JOB_FOLK, FOLK_BY_ID, FOREMAN_HELLO, TALK, sayMs, standSpot, makeGreeter, makeLeaveWatch, thanksFor, WORK } from './jobfolkplan.js';

// where each one stands, worked out from the job's own layout (metres)
export const STAND = {
  boss: { out: 2.5, side: 4.5 },     // from the corral's gate: out toward the pasture, and along the fence (away from the herd's way in)
  vet: { out: 2.2, side: -4.6 },      // from the sheep pasture's gate: out in front, and along the fence away from the lane
  wife: { x: 6.8, z: 3.5 },           // in the farm's own frame: the lane's edge just past the way into the pig yard (pigs.js
                                      // PIGS.byWife holds the same spot: standing by her counts as being at the pigs)
  sheriff: { out: 2.6, side: 3.4 },   // from the sheriff's door: out toward the square, and to one side of the steps
  naturalist: 40,                     // m from the deer herd's middle, toward the town square (outside a rider's alert
                                      // range of the job's herd, 18 x 1.35 = 24 m, plus the 6 m the deer graze from it)
  natBand: [36, 48],                  // m: while she stands there, her herd only drifts within this far of her (in reach
                                      // of the camera's 50 m, never close enough to spook at her); past it she follows
  driver: { side: 2.3, ahead: 1.2 },  // beside the waiting wagon: out from its middle, and a little toward the team
  anchor: 0.48,                       // m above the head bone the name tag sits (over the hat)
  trail: 3.5,                         // m a person stands at least from the middle of the trail to the pasture
  natWalk: { pace: 1.5, start: 16, near: 7, roam: 60 },   // the naturalist with her camera lent: strolls (m/s) after a
                                      // player more than `start` m off, to `near` m short of them, never more than `roam`
                                      // m from her own spot
};

// a person as a voice: where they stand, and whether he is a man (the recorded voices are the game maker's: men only;
// the freight driver has no look of his own, and is a man)
const voiceOf = (r) => ({ at: () => ({ x: r.x, z: r.z }), male: r.def && r.def.look ? /_m$/.test(r.def.look.outfit || '') : r.id === 'driver' });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const HATS = { boss: 'cattleman', vet: 'bowler', wife: 'straw', naturalist: 'ranger', sheriff: 'white', deputy: 'cowboy' };

export function makeJobFolk({ W, folk, P, camera, hud, jobs = {}, actions = {}, scene = W.scene, onTalk = null }) {
  const get = (k) => { try { return jobs[k] ? jobs[k]() : null; } catch (e) { return null; } };
  const shadows = !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  const people = [];
  const free = (x, z) => !W.blocked(x, z) && W.waterAt(x, z) < 0.25;
  // how far a point is from the trail out to the pasture (people stand off it, not on it)
  const trail = W.places.trail || [];
  const offTrail = (x, z) => {
    let best = Infinity;
    for (let i = 1; i < trail.length; i++) {
      const [ax, az] = trail[i - 1], [bx, bz] = trail[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return best;
  };
  ensureCss();
  const box = document.createElement('div'); box.className = 'bjf'; document.body.appendChild(box);
  const card = document.createElement('div'); card.className = 'bjf-say'; card.hidden = true; box.appendChild(card);

  // ── THE PEOPLE ─────────────────────────────────────────────────────────────────────────────────────────────────
  function addPerson(def, spot, face, { person = null, kind = 'own' } = {}) {
    let p = person;
    if (!p) {
      try { p = makePerson(folk, { ...def.look, hatStyle: HATS[def.id] || null, shadows }); } catch (e) { console.warn('job folk: a person could not be made', def.id, e); return null; }
      p.root.position.set(spot.x, W.heightAt(spot.x, spot.z), spot.z); p.root.rotation.y = face;
      scene.add(p.root);
    }
    const tag = document.createElement('div'); tag.className = 'bjf-tag'; tag.hidden = true;
    tag.innerHTML = `<b>${esc(def.name)}</b><small>${esc(def.role)}</small>`;
    box.appendChild(tag);
    const rec = { id: def.id, def, name: def.name, role: def.role, p, kind, x: spot ? spot.x : 0, z: spot ? spot.z : 0, face, home: face,
      tag, greet: makeGreeter({ again: ['boss', 'vet', 'wife'].includes(def.id) ? TALK.againArea : TALK.again }), t: 3 + Math.random() * 6, clipT: 0, visible: true, block: kind === 'own' };
    people.push(rec);
    return rec;
  }
  const byId = (id) => people.find((r) => r.id === id) || null;

  // the trail boss, by the corral's gate (the caught cattle go in through it: he stands along the fence, out of their way)
  const corral = W.places.corral;
  if (corral && corral.gate) {
    const g = corral.gate, o = { x: Math.sin(g.rot), z: Math.cos(g.rot) }, s = { x: Math.cos(g.rot), z: -Math.sin(g.rot) };
    const want = { x: g.x + o.x * STAND.boss.out + s.x * STAND.boss.side, z: g.z + o.z * STAND.boss.out + s.z * STAND.boss.side };
    const at = standSpot({ x: g.x + o.x * STAND.boss.out, z: g.z + o.z * STAND.boss.out, toward: want, dist: Math.abs(STAND.boss.side), tries: 7, step: 0.35, ok: (x, z) => free(x, z) && offTrail(x, z) > STAND.trail })
      || standSpot({ x: g.x, z: g.z, toward: want, dist: 7, tries: 11, step: 0.25, ok: (x, z) => free(x, z) && offTrail(x, z) > STAND.trail }) || want;
    addPerson(FOLK_BY_ID.boss, at, g.rot);
  }
  // the vet and the farmer's wife, at the farm
  const farm = get('farm'), L = farm && farm.layout;
  if (L && L.sheep) {
    const g = L.sheep.gate, o = { x: Math.sin(g.rot), z: Math.cos(g.rot) }, s = { x: Math.cos(g.rot), z: -Math.sin(g.rot) };
    const want = { x: g.x + o.x * STAND.vet.out + s.x * STAND.vet.side, z: g.z + o.z * STAND.vet.out + s.z * STAND.vet.side };
    addPerson(FOLK_BY_ID.vet, free(want.x, want.z) ? want : g.out, g.rot);
  }
  if (L && L.yard) {
    const at = L.at(STAND.wife.x, STAND.wife.z);
    addPerson(FOLK_BY_ID.wife, at, L.rot - Math.PI / 4);   // (half facing the lane, half the way into the farm)
  }
  // the sheriff, out in front of his office, to one side of the steps
  const sh = W.places.sheriff;
  if (sh && sh.door) {
    const o = { x: Math.sin(sh.rot), z: Math.cos(sh.rot) }, s = { x: Math.cos(sh.rot), z: -Math.sin(sh.rot) };
    let at = null;
    for (const k of [1, -1]) { const x = sh.door.x + o.x * STAND.sheriff.out + s.x * STAND.sheriff.side * k, z = sh.door.z + o.z * STAND.sheriff.out + s.z * STAND.sheriff.side * k; if (free(x, z)) { at = { x, z }; break; } }
    addPerson(FOLK_BY_ID.sheriff, at || { x: sh.door.x + o.x * 3.5, z: sh.door.z + o.z * 3.5 }, sh.rot);
    // the deputy, the other side of the steps (the loot job is on)
    if (get('loot')) {
      const k = at && Math.abs((at.x - sh.door.x) * s.x + (at.z - sh.door.z) * s.z - STAND.sheriff.side) < 0.01 ? -1 : 1;
      let dp = null;
      for (const kk of [k, -k]) { const x = sh.door.x + o.x * STAND.sheriff.out + s.x * STAND.sheriff.side * kk, z = sh.door.z + o.z * STAND.sheriff.out + s.z * STAND.sheriff.side * kk; if (free(x, z) && !(at && Math.hypot(x - at.x, z - at.z) < 1)) { dp = { x, z }; break; } }
      addPerson(FOLK_BY_ID.deputy, dp || { x: sh.door.x + o.x * 4.5 + s.x * 2, z: sh.door.z + o.z * 4.5 + s.z * 2 }, sh.rot);
    }
  }
  // the naturalist: placed by the deer job's herd once it has one (see placeNaturalist)
  const naturalist = get('deer') ? addPerson(FOLK_BY_ID.naturalist, { x: 0, z: 0 }, 0) : null;
  if (naturalist) { naturalist.p.root.visible = false; naturalist.placed = false; }
  // the freight driver: the wagon's own (made when the wagon is)
  let driver = null;
  // the camp foremen: the camps' own people
  const foremen = [];

  // walkers don't go through a person standing still (the wagon's driver only while he stands down beside it)
  const offBlock = W.addBlocker ? W.addBlocker((x, z) => {
    for (const r of people) if (r.block && r.p.root.visible && Math.abs(x - r.x) < TALK.block && Math.abs(z - r.z) < TALK.block && Math.hypot(x - r.x, z - r.z) < TALK.block) return true;
    return false;
  }) : () => {};

  // ── THE NATURALIST: a good way off the deer job's herd, on the town's side ─────────────────────────────────────
  let natHerd = null;
  const _v = new THREE.Vector3(), _f = new THREE.Frustum(), _m = new THREE.Matrix4();
  function inView(x, y, z) {
    _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _f.setFromProjectionMatrix(_m);
    return _f.containsPoint(_v.set(x, y + 1, z));
  }
  function placeNaturalist() {
    const DJ = get('deer');
    if (!naturalist || !DJ) return;
    const H = DJ.herd();
    if (!H) return;
    const sp = naturalist.spot;
    // (walked off after the player, who has since gone: back on her spot, out of sight)
    if (naturalist.placed && Math.hypot(naturalist.x - sp.x, naturalist.z - sp.z) > 1) {
      const d = Math.hypot(P.position.x - naturalist.x, P.position.z - naturalist.z);
      if (d > 140 && !inView(naturalist.x, W.heightAt(naturalist.x, naturalist.z), naturalist.z)) {
        naturalist.x = sp.x; naturalist.z = sp.z; naturalist.walking = false; naturalist.p.play('Idle', { fade: 0 });
        naturalist.face = naturalist.home; naturalist.p.root.rotation.y = naturalist.face;
      }
    }
    // (the same herd: she stays, unless it has run off or wandered out of her band since)
    const off = naturalist.placed ? Math.hypot(H.mid.x - sp.x, H.mid.z - sp.z) : 0;
    const close = naturalist.placed && H.state === 'calm' && H.deer.some((d) => Math.hypot(d.x - sp.x, d.z - sp.z) < STAND.natBand[0] - 6);
    if (H === natHerd && !close && off >= STAND.natBand[0] - 2 && off <= STAND.natBand[1] + 2) return;
    // (moved only while out of sight: never popping from one place to another in view)
    // (and never while the player is anywhere about: a herd that bolts moves its middle at once, and turning the camera
    // away from her for a moment used to be enough to send her off after it, right after her hello)
    if (naturalist.placed) {
      const d = Math.hypot(P.position.x - naturalist.x, P.position.z - naturalist.z);
      if (d < 140) return;
      if (d < 220 && inView(naturalist.x, W.heightAt(naturalist.x, naturalist.z), naturalist.z)) return;
      if (DJ.active || (talking && talking.r === naturalist)) return;
    }
    const sq = W.places.square || W.places.spawn;
    const flat = (x, z) => free(x, z) && Math.abs(W.heightAt(x + 1, z) - W.heightAt(x - 1, z)) < 0.6 && Math.abs(W.heightAt(x, z + 1) - W.heightAt(x, z - 1)) < 0.6;
    const at = standSpot({ x: H.mid.x, z: H.mid.z, toward: sq, dist: STAND.naturalist, tries: 13, step: 0.25, ok: flat });
    if (!at) return;
    const fresh = H !== natHerd;
    if (natHerd && fresh) natHerd.keepNear = null;
    natHerd = H; naturalist.placed = true;
    H.keepNear = { x: at.x, z: at.z, min: STAND.natBand[0], max: STAND.natBand[1] };
    naturalist.x = at.x; naturalist.z = at.z; naturalist.spot = { x: at.x, z: at.z }; naturalist.walking = false;
    naturalist.home = naturalist.face = Math.atan2(H.mid.x - at.x, H.mid.z - at.z);   // (looking at the herd)
    naturalist.p.root.position.set(at.x, W.heightAt(at.x, at.z), at.z); naturalist.p.root.rotation.y = naturalist.face;
    naturalist.p.root.visible = true;
    if (fresh) naturalist.greet.reset();   // (a new herd, a new hello; following the same one doesn't repeat it)
  }

  // With her camera lent she strolls after the player round her herd, loosely (a player further than natWalk.start off,
  // to natWalk.near short of them), never further than natWalk.roam from her spot; she stands while she talks and while
  // the camera is up (never walking into the picture), and goes back to her spot once it is given back
  function naturalistWalk(dt) {
    if (!naturalist || !naturalist.placed || !naturalist.spot) return;
    const DJ = get('deer'), N = STAND.natWalk, sp = naturalist.spot, at = P.position;
    const dP = Math.hypot(at.x - naturalist.x, at.z - naturalist.z);
    let to = sp;
    if (DJ && DJ.lent() && !(DJ.resting && DJ.resting())) {
      if (DJ.active || dP > 150) to = null;   // (stays put: the camera is up, or the player has gone off)
      else if (dP > (naturalist.walking ? N.near : N.start)) {
        const k = (dP - N.near) / dP;
        let x = naturalist.x + (at.x - naturalist.x) * k, z = naturalist.z + (at.z - naturalist.z) * k;
        const ds = Math.hypot(x - sp.x, z - sp.z); if (ds > N.roam) { x = sp.x + (x - sp.x) / ds * N.roam; z = sp.z + (z - sp.z) / ds * N.roam; }
        to = { x, z };
      } else to = null;
    }
    const busy = naturalist.clipT > 0 || (talking && talking.r === naturalist);   // (waving or talking: she stands)
    const dx = to ? to.x - naturalist.x : 0, dz = to ? to.z - naturalist.z : 0, dl = Math.hypot(dx, dz);
    const go = !busy && to && dl > (naturalist.walking ? 0.3 : 2);
    let stepped = false;
    if (go) {
      const st = Math.min(dl, N.pace * dt), x = naturalist.x + dx / dl * st, z = naturalist.z + dz / dl * st;
      naturalist.block = false;   // (her own standing-room doesn't stop her)
      if (free(x, z)) { naturalist.x = x; naturalist.z = z; stepped = true; }
      naturalist.face += wrapA(Math.atan2(dx, dz) - naturalist.face) * Math.min(1, dt * 6);
    }
    if (stepped && !naturalist.walking) { naturalist.walking = true; naturalist.p.play('Walk', { fade: 0.25, speed: N.pace / ((naturalist.p.stride && naturalist.p.stride.Walk) || 1.2) }); }
    else if (!stepped && naturalist.walking) { naturalist.walking = false; naturalist.block = true; naturalist.p.play('Idle', { fade: 0.3 }); naturalist.t = 3 + Math.random() * 4; }
    if (!naturalist.walking) naturalist.home = Math.hypot(naturalist.x - sp.x, naturalist.z - sp.z) < 1 && natHerd ? Math.atan2(natHerd.mid.x - sp.x, natHerd.mid.z - sp.z) : naturalist.face;
  }

  // ── THE FREIGHT DRIVER: down beside his wagon while it waits, up on the seat when it rolls ─────────────────────
  function driverStep() {
    const WJ = get('wagon');
    const G = WJ && WJ.rig;
    if (!G || !G.driver) return;
    if (!driver) driver = addPerson(FOLK_BY_ID.driver, { x: G.pos.x, z: G.pos.z }, G.heading, { person: G.driver, kind: 'driver' });
    if (!driver) return;
    const waiting = WJ.phase === 'waiting' || WJ.phase === 'stopped';
    if (waiting && !G.driverDown && G.pace < 0.05) {
      // (on the side of the wagon nearer the player, beside the front wheel)
      const h = G.heading, side = { x: Math.cos(h), z: -Math.sin(h) }, fwd = { x: Math.sin(h), z: Math.cos(h) };
      const k = (P.position.x - G.pos.x) * side.x + (P.position.z - G.pos.z) * side.z >= 0 ? 1 : -1;
      let at = null;
      for (const kk of [k, -k]) {
        const x = G.pos.x + side.x * STAND.driver.side * kk + fwd.x * STAND.driver.ahead, z = G.pos.z + side.z * STAND.driver.side * kk + fwd.z * STAND.driver.ahead;
        if (free(x, z)) { at = { x, z }; break; }
      }
      if (at) { G.climbDown(at.x, at.z, h + Math.PI / 2 * k); driver.x = at.x; driver.z = at.z; driver.home = driver.face = h + Math.PI / 2 * k; }
    } else if (!waiting && G.driverDown) G.climbUp();
    driver.down = G.driverDown;
    driver.block = !!G.driverDown;   // (standing by the wheel, nobody walks through him; on the seat the wagon itself blocks)
  }

  // ── THE CAMP FOREMEN (name tags and hellos only: the camps move them) ──────────────────────────────────────────
  function foremenStep() {
    const C = get('camps');
    if (!C || foremen.length) return;
    for (const c of C.list) {
      const h = c.foreman.person;
      if (!h) continue;
      const lines = FOREMAN_HELLO[c.id] || FOREMAN_HELLO.cow;
      const r = addPerson({ id: c.id, name: c.foreman.name, role: c.short.replace(/^the /, ''), hello: lines, look: c.foreman.look }, { x: h.x, z: h.z }, h.face, { person: h.p, kind: 'foreman' });
      if (r) { r.camp = c; r.h = h; foremen.push(r); }
    }
  }

  // ── THE SPEECH CARD ────────────────────────────────────────────────────────────────────────────────────────────
  let talking = null;   // { r, lines, t }
  const pending = [];   // thank-yous waiting for the game to come back from a panel: { r, text, t }
  // (pin: a thank-you, shown in a card of its own when the speaker is out of sight; a hello just stops when the player
  // has gone off)
  function say(r, lines, { ms = null, pin = false, hello = false } = {}) {
    if (!r) return;
    const L = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
    if (!L.length) return;
    talking = { r, lines: L, pin, hello, t: (ms || sayMs(L.join(' '))) / 1000 };
    card.innerHTML = `<b>${esc(r.name)}</b>${L.map((l) => `<p>${esc(l)}</p>`).join('')}`;
    card.hidden = false; card.classList.remove('is-out'); card.style.opacity = '';
    // (a wave the first time, a nod of the head after)
    if (r.kind !== 'driver' || r.down) {
      const clip = r.greet.said && r.waved ? 'Interact' : 'Wave';
      if (r.p.play(clip, { fade: 0.25, once: true })) { r.clipT = 1.7; r.waved = true; }
    }
  }
  const JF = { people, prompt: null };
  JF.say = (id, text) => { const r = byId(id); if (r) { say(r, text); return true; } return false; };
  JF.speaking = () => !!talking && !card.hidden;   // (a speech card is on the screen: Old Hob waits his turn on a phone)

  // ── TALKING: E by a person ─────────────────────────────────────────────────────────────────────────────────────
  let promptFor = null;
  function promptStep() {
    JF.prompt = null; promptFor = null;
    if (P.mode !== 'foot' && P.mode !== 'horse') return;
    let best = null, bd = Infinity;
    for (const r of people) {
      if (!r.p.root.visible || r.kind === 'foreman') continue;   // (a foreman's prompt is the delivery job's own)
      const d = Math.hypot(P.position.x - r.x, P.position.z - r.z) - (P.onHorse ? 1.2 : 0);
      if (d < bd) { bd = d; best = r; }
    }
    if (!best) return;
    const WJ = get('wagon'), DJ = get('deer');
    if (best.id === 'driver' && WJ && (WJ.phase === 'waiting' || WJ.phase === 'stopped') && best.down && bd < TALK.hail) { JF.prompt = `Ride along with ${best.name.split(' ')[0]}`; promptFor = best; }
    else if (best.id === 'naturalist' && DJ && bd < TALK.prompt && !DJ.active) { const who = best.name.replace(/ Ada/, ''); JF.prompt = DJ.lent() ? `Give ${who} her camera back` : `Borrow ${who}'s camera`; promptFor = best; }
    else if (best.id === 'sheriff' && actions.sheriff && bd < TALK.prompt) { JF.prompt = 'Crack lock boxes for the sheriff'; promptFor = best; }
    else if (best.id === 'deputy' && bd < TALK.prompt) { const LJ = get('loot'); if (LJ && LJ.canShare) { JF.prompt = 'Share out the loot'; promptFor = best; } }
  }
  JF.talk = () => {
    const r = promptFor; if (!r) return false;
    if (r.id === 'driver') { const WJ = get('wagon'); if (WJ) WJ.start(); return true; }   // (his "let's roll" comes with the job's start: heard below)
    if (r.id === 'naturalist') {
      const DJ = get('deer'); if (!DJ) return false;
      // (the camera not lent yet: she hands it over, strapped behind the saddle, and says how it goes)
      if (!DJ.lent()) { DJ.lend(); say(r, r.def.lend || r.def.hello); r.greet.update(0, true, false); if (onTalk) onTalk('hello', r.id); return true; }
      // (given back: off the saddle, her thanks, and the job rests till the player rides off and comes back)
      if (DJ.giveBack()) { say(r, r.def.back || r.def.thanks[0]); if (onTalk) onTalk('thanks', r.id, voiceOf(r)); }
      return true;
    }
    if (r.id === 'sheriff') { actions.sheriff(); return true; }
    if (r.id === 'deputy') { const LJ = get('loot'); if (LJ) LJ.share(); return true; }
    return false;
  };

  // ── THANK-YOUS ─────────────────────────────────────────────────────────────────────────────────────────────────
  const thanksN = {};
  JF.heard = (event, data = {}) => {
    // (a pick at an area job: that job is the one leaving says goodbye to, and the others forget theirs)
    if (WORK[event]) for (const a of areas) { if (a.id === WORK[event]) a.watch.worked(); else a.watch.other(); }
    if (event === 'wagonArrive' && driver) { say(driver, FOLK_BY_ID.driver.start); driver.greet.update(0, true, false); return; }   // (the job started: no hello now)
    if (event === 'deliveryDone' && data && data.camp) { const r = foremen.find((f) => f.camp && (f.camp.short === data.camp || f.camp.id === data.camp)); if (r) pending.push({ r, text: "Right where we need 'em. Come see me for the next order.", t: TALK.keep }); return; }
    const id = thanksFor(event); if (!id) return;
    const r = id === 'driver' ? driver : byId(id); if (!r) return;
    const L = FOLK_BY_ID[id].thanks; const n = thanksN[id] = ((thanksN[id] ?? -1) + 1);
    pending.push({ r, text: L[n % L.length], t: TALK.keep });
  };

  // ── WALKING AWAY FROM AN AREA JOB ──────────────────────────────────────────────────────────────────────────────
  const areas = [
    { id: 'boss', job: 'roundup', mid: () => W.places.pasture, leave: 58 },
    { id: 'vet', job: 'sheep', mid: () => L && L.sheep, leave: 56 },
    { id: 'wife', job: 'pigs', mid: () => L && L.yard, leave: 36 },
  ].map((a) => ({ ...a, watch: makeLeaveWatch({ stay: 4, leave: a.leave }) }));

  // ── EACH FRAME ─────────────────────────────────────────────────────────────────────────────────────────────────
  const head = new THREE.Vector3();
  let hiddenNow = false;
  function hideAll() { for (const r of people) r.tag.hidden = true; card.hidden = true; }
  JF.update = (dt, { hidden = false } = {}) => {
    if (hidden) { if (!hiddenNow) { hiddenNow = true; hideAll(); } JF.prompt = null; return; }
    if (hiddenNow) { hiddenNow = false; if (talking) card.hidden = false; }
    placeNaturalist(); naturalistWalk(dt); driverStep(); foremenStep();
    const at = P.position;
    // the area jobs: hellos on arriving, the toast on walking away
    for (const a of areas) {
      const job = get(a.job), m = a.mid(); if (!job || !m) continue;
      const d = Math.hypot(at.x - m.x, at.z - m.z);
      if (a.watch.update(dt, !!job.near, d)) { hud.toast(FOLK_BY_ID[a.id].leave); const r = byId(a.id); if (onTalk) onTalk('leave', a.id, r ? voiceOf(r) : null); }
      a.near = !!job.near;
    }
    for (const r of people) {
      const d = Math.hypot(at.x - r.x, at.z - r.z);
      // (the foremen and the driver are placed by their camps and their wagon: follow them)
      if (r.kind === 'foreman') { r.x = r.h.x; r.z = r.h.z; }
      if (r.kind === 'driver' && !r.down) { const G = get('wagon') && get('wagon').rig; if (G) { r.x = G.pos.x; r.z = G.pos.z; } }
      const shown = r.p.root.visible = r.kind === 'own' ? d < TALK.show && (r !== naturalist || naturalist.placed) : r.p.root.visible;
      if (!shown) { r.tag.hidden = true; r.greet.update(dt, false, true); continue; }   // (out of sight is away: the 'hello again' clock keeps running)
      // the hello: walking or riding up, or arriving at the person's job
      const area = areas.find((a) => a.id === r.id);
      const WJ = get('wagon');
      let near = d < TALK.greet;
      if (area && area.near) near = true;
      if (r.id === 'driver') near = r.down && WJ && WJ.phase === 'waiting' && d < TALK.hail;
      if (r.id === 'naturalist') { const DJ = get('deer'); near = near && !(DJ && DJ.active); }
      if (r.kind === 'foreman') { const DL = get('delivery'); near = near && !(DL && DL.phase !== 'none'); }
      const away = d > TALK.away && !(area && area.near) && !(r.id === 'driver' && d < TALK.hail);
      if (r.greet.update(dt, near, away)) { say(r, r.def.hello, { pin: !!(area && area.near), hello: true }); if (onTalk) onTalk('hello', r.id); }   // (over anybody else's: the newest one met is the one in front of you; arriving at the job from where the person is out of sight, in a card of its own)
      // idle about, turn to the player when close (the camps turn their own foremen; the driver only on the ground)
      if (r.kind === 'own' || (r.kind === 'driver' && r.down)) {
        if (d < TALK.awake) {
          // (the naturalist walking after the player: facing the way she goes, the Walk clip on; naturalistWalk)
          if (!r.walking) {
            const want = d < TALK.face ? Math.atan2(at.x - r.x, at.z - r.z) : r.home;
            r.face += wrapA(want - r.face) * Math.min(1, dt * 4);
            if (r.clipT > 0 && (r.clipT -= dt) <= 0) r.p.play('Idle', { fade: 0.4 });
            else if (r.clipT <= 0 && (r.t -= dt) <= 0) { r.t = 6 + Math.random() * 9; r.p.play(Math.random() < 0.5 ? 'Idle_Neutral' : 'Idle', { fade: 0.6 }); }
          }
          r.p.root.rotation.y = r.face;
          if (r.kind === 'own') { r.p.root.position.set(r.x, W.heightAt(r.x, r.z), r.z); r.p.update(dt); }
        }
      }
      // the name tag
      const tagOn = d < TALK.tag && !(talking && talking.r === r);
      if (tagOn && place(r, r.tag, 0)) r.tag.hidden = false; else r.tag.hidden = true;
    }
    // a thank-you waiting its turn: said once nothing else is being said
    for (let i = pending.length - 1; i >= 0; i--) if ((pending[i].t -= dt) <= 0) pending.splice(i, 1);
    if (pending.length && (!talking || talking.t < 0.6)) { const q = pending.shift(); say(q.r, q.text, { pin: true }); if (onTalk) onTalk('thanks', q.r.id, voiceOf(q.r)); }
    // the speech card: over the speaker's head, or a card of its own in the middle when the speaker is out of sight
    if (talking) {
      if ((talking.t -= dt) <= 0) { talking = null; card.hidden = true; }
      else {
        const r = talking.r, d = Math.hypot(at.x - r.x, at.z - r.z);
        card.classList.toggle('is-out', talking.t < 0.5);
        // (a hello stops once the player has gone off: further than the hail for the driver, the job's area for the
        // area jobs' people, a few steps for the rest; a thank-you is seen through)
        const far = talking.hello ? (r.id === 'driver' ? TALK.hail : areas.some((a) => a.id === r.id) ? 70 : TALK.away) + 8 : Infinity;
        card.hidden = false;   // (shown before it is measured)
        if (d > far) { talking = null; card.hidden = true; }
        else if (d < TALK.thanksNear && (card.classList.remove('is-pinned'), place(r, card, 1))) { /* over the speaker's head */ }
        else if (talking.pin) pinCard();
        else card.hidden = true;   // (just out of view: back when the speaker is)
      }
    }
    promptStep();
  };

  // The page's own boxes the speech card keeps clear of: the job's card up top (with the hint line under it and the times
  // chart's "Peek" offer under those), and the help box at the bottom (the number line, the ten-frames: what a stuck kid
  // is looking at). topFloor(left, w): the lowest bottom of the top ones over that stretch of the screen; helpTop(): the
  // top of the help's pictures (Infinity when none is up).
  function topFloor(left, w, least) {
    let floor = least;
    for (const e of [hud.ruleEl, hud.hintEl, ...document.querySelectorAll('.tch-offer')]) {
      if (!e || e.hidden || !e.offsetParent) continue;
      const q = e.getBoundingClientRect();
      if (q.height && q.top < innerHeight * 0.5 && q.right > left - 6 && q.left < left + w + 6) floor = Math.max(floor, q.bottom + 10);
    }
    return floor;
  }
  function helpTop() {
    let top = Infinity;
    for (const e of (hud.helpEl ? hud.helpEl.children : [])) { const q = e.getBoundingClientRect(); if (q.height) top = Math.min(top, q.top); }
    return top;
  }
  // a card of its own, the speaker out of sight: low in the middle (on a phone, near the top), moved down off the job's
  // card and up off the help box (where there's room for both: a hello is short, the help comes first)
  function pinCard() {
    card.classList.add('is-pinned'); card.style.left = '50%'; card.style.top = ''; card.style.bottom = ''; card.style.transform = '';
    const c = card.getBoundingClientRect(), floor = topFloor(c.left, c.width, 0), help = helpTop();
    let top = Math.max(c.top, floor);
    if (top + c.height > help - 10) top = Math.max(floor, help - 10 - c.height);
    if (Math.abs(top - c.top) > 0.5) { card.style.top = `${Math.round(top)}px`; card.style.bottom = 'auto'; }
  }

  // a page element over a person's head (lift 0: the name tag; 1: the speech card above it); false when out of sight
  function place(r, el, lift) {
    const b = r.p.bones && r.p.bones.Head;
    if (b) { b.getWorldPosition(head); head.y += STAND.anchor; } else head.set(r.x, W.heightAt(r.x, r.z) + 2.2, r.z);
    head.project(camera);
    if (head.z > 1 || Math.abs(head.x) > 1.05 || Math.abs(head.y) > 1.05) return false;
    const x = (head.x + 1) / 2 * innerWidth, y = (1 - head.y) / 2 * innerHeight;
    if (lift === 0) { el.style.left = `${x}px`; el.style.top = `${y}px`; return true; }
    // (the card above the tag, kept on the screen with a 12 px gutter; its tail points down at the speaker)
    el.style.left = '0px'; el.style.top = '0px';
    const w = el.offsetWidth, h = el.offsetHeight;
    const left = Math.max(12, Math.min(innerWidth - w - 12, x - w / 2));
    // (never over the job's card up top: below it when they would overlap; the tail is dropped then, as the card may sit
    // below the speaker's head)
    // (the job card, the hint line under it, and the times chart's "Peek" offer that sits under those; and not down over
    // the help box)
    const floor = topFloor(left, w, 70);
    const want = Math.min(innerHeight * 0.72 - h, y - h - 30, helpTop() - 10 - h), top = Math.max(floor, want);
    el.classList.toggle('is-low', want < floor && floor > 70);
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    el.style.setProperty('--tail', `${Math.max(16, Math.min(w - 16, x - left))}px`);
    return true;
  }

  JF.state = () => ({
    people: people.map((r) => ({ id: r.id, name: r.name, kind: r.kind, x: +r.x.toFixed(2), z: +r.z.toFixed(2), y: r.p.root.visible ? +r.p.root.getWorldPosition(new THREE.Vector3()).y.toFixed(2) : null,
      ground: +W.heightAt(r.x, r.z).toFixed(2), visible: r.p.root.visible, tag: !r.tag.hidden, down: r.kind === 'driver' ? !!r.down : undefined, clip: r.p.clip })),
    talking: talking ? { id: talking.r.id, lines: talking.lines, pinned: card.classList.contains('is-pinned') } : null, prompt: JF.prompt, pending: pending.length,
  });
  JF.dispose = () => {
    if (natHerd) natHerd.keepNear = null;
    offBlock();
    for (const r of people) { r.tag.remove(); if (r.kind === 'own') { r.p.root.removeFromParent(); try { r.p.dispose(); } catch (e) { /* (gone) */ } } }
    const G = get('wagon') && get('wagon').rig; if (G && G.driverDown) G.climbUp();
    box.remove();
  };
  return JF;
}

let css = false;
function ensureCss() {
  if (css) return; css = true;
  const s = document.createElement('style'); s.dataset.jobfolk = '1';
  s.textContent = `
.bjf { position: fixed; inset: 0; z-index: 13; pointer-events: none; font: 500 15px/1.35 Bitter, Georgia, serif; }
.bjf-tag { position: absolute; transform: translate(-50%, -100%); padding: 3px 9px 4px; border-radius: 7px; white-space: nowrap; text-align: center;
  background: rgba(30, 20, 12, 0.72); border: 1px solid rgba(226, 173, 76, 0.4); color: #f4e8cf; line-height: 1.15; }
.bjf-tag b { display: block; font: 700 14px Bitter, Georgia, serif; }
.bjf-tag small { display: block; font: 500 11px Bitter, Georgia, serif; color: #dccaa5; }
.bjf-say { position: absolute; left: 0; top: 0; width: max-content; max-width: min(340px, calc(100vw - 24px)); padding: 9px 13px 10px; border-radius: 10px;
  background: #f6edd6; color: #2b2219; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.42), inset 0 0 0 2px rgba(122, 85, 48, 0.3);
  transition: opacity 0.4s ease; --tail: 50%; }
.bjf-say::after { content: ''; position: absolute; left: var(--tail); bottom: -9px; margin-left: -9px; border: 9px solid transparent; border-bottom: 0; border-top-color: #f6edd6; }
.bjf-say b { display: block; font: 700 13px Bitter, Georgia, serif; color: #7a5530; letter-spacing: 0.02em; margin-bottom: 2px; }
.bjf-say p { margin: 0; font: 500 16px/1.32 Bitter, Georgia, serif; }
.bjf-say p + p { margin-top: 4px; }
.bjf-say.is-out { opacity: 0; }
.bjf-say.is-pinned { top: auto; bottom: 15vh; transform: translateX(-50%); }
.bjf-say.is-pinned::after, .bjf-say.is-low::after { display: none; }
@media (max-width: 600px) { .bjf-say { max-width: calc(100vw - 32px); } .bjf-say.is-pinned { top: 156px; bottom: auto; } .bjf-say p { font-size: 15px; } .bjf-tag b { font-size: 13px; } }
`;
  document.head.appendChild(s);
}
