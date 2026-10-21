// THE BRIDGE JOB (from the build-site frame: src/buildsite.js): the engineer at the ravine where the road south-west of
// town crosses the western river, his camp and wagon on the north (town) bank, and the bridge the rider builds there.
// Meeting him and pressing E opens the bridge lab's builder right there over the ravine (labs/bridge/builder.js): the
// lumber panel, the board in hand and its arrows, the twins, the deck, his questions (the levels place
// 'building', all 8 levels: src/buildasker.js levelAsker), and "Send it across" (a person, horse and rider, the
// covered wagon, the freight wagon and the cattle drive, the lab's own loads and frame calculation). He pays gold by the
// heaviest load the bridge carries (BRIDGE.pay: each heavier rating pays the difference, so a bridge that carries the
// cattle drive has earned the whole of the top rating). What is built is kept per rider (rider.builds.bridge) and
// stands over the ravine while the builder is put away.
//
// WHAT THE BRIDGE STANDING THERE CARRIES (its rating, rider.builds.bridge.rated) is what the engineer's own sums say
// for it as it stands: a test's card says it for the bridge as tested, and whenever the builder is put away with the
// bridge changed since (rebuilt after a test brought part of it down, a board or two added), the same sums run quietly
// on what stands (labs/bridge/cross-worker.js, frame.js crossTest, off the page's thread: a second or two). A bridge
// that carries at least horse and rider (BRIDGE.stands) is USED: the deck is the ground there for everyone (W.heightAt
// and W.blocked answer for it: the player on foot or riding, the dog, the travellers on the crossing road,
// src/bridgetraffic.js); wagons drive over it once it carries the covered wagon (BRIDGE.wagons). Otherwise everyone
// fords the river beside it. Done for the checklist (completion.js 'place:bridge') at the first bridge that carries
// the horse; the belt buckle counts the loads carried across in the tests (save.js JOBS 'loads').
//
// The bridge's own frame (the lab's: feet, the middle of the gap at 0, 0, the stone tops at 0, X from the lab's west bank
// to its east) is turned here so the lab's west bank is the north (town) bank: the lab's east runs south. Every word the
// builder says that names a way follows (BRIDGE.words), so the engineer talks about the north bank and the west side.
//
//   const J = makeBridgeJob({ W, folk, rider, sites, refresh, hud, speak, camera, audio })
//     sites: the game's build sites (makeBuildSites); refresh(): the gold on the HUD again (main.js refresh);
//     hud: for a toast after the builder is put away; speak(text): a question read out (a rider who can't read yet);
//     camera, audio: for the campfire at his camp (src/fire/campfire.js; audio: the game's sound, or null), and lent
//     to the builder for its saws, hammers and wind (no sound context of the lab's own);
//     traffic: src/traffic.js's (its wagons' and riders' models, for the travellers on the crossing road:
//     src/bridgetraffic.js); obstacles(): what those travellers stop for (the player, the horse, the dog);
//     animals: the game's animals library (actors/animals.js): the test's loads are the game's own people, horses,
//     cattle and wagons (labs/bridge/loads3d.js libs), nothing loaded twice
//     player(), dog(): the player (src/player.js) and the dog (src/dog.js), for those standing on the deck when the
//     builder opens (THE DECK HELD, below)
// His camp: the cow camp's kind of tent (models/camps camp1: an A-frame tent and a ring of stones with a pot) on the
// flat room the land keeps for it (landforms.js CAMP), facing the road, its fire burning, and his covered wagon beside
// it (src/traffic.js STANDING, with the valley's other standing wagons).
//   J.update(dt, at)    each frame while riding (at: the player's position)
//   J.site, J.engineer (his person), J.builder (the open builder, or null: its .handle is the lab's BR handle)
//   J.where()           { x, z } the engineer (the jobs board, the hoofprints); J.helloKey(): which of his hellos fits
//   J.rating()          what the bridge standing now carries (frame.js LOADS index: -1 nothing, or not worked out yet
//                       since a change), J.uses(kind) -> true if a 'walker' | 'rider' | 'wagon' crosses on it now,
//                       J.rated() -> a promise: the rating once the quiet sums are done
//   J.state(), J.dispose()
import * as THREE from 'three';
import { CROSSING, CAMP } from '../world/objects/landforms.js';
import { makePerson } from './actors/folk.js';
import { saveRider, earn, countJob, jobOn } from './save.js';
import { shownOnce } from './showme.js';
import { markFound } from './completion.js';
import { levelAsker, mergeStatic, mowSite } from './buildsite.js';
import { flagAsker } from './ui/flag.js';
import { loadCamp, CAMP_KINDS } from './camps.js';
import { makeCampfire } from './fire/campfire.js';
import { makeCrossingTraffic } from './bridgetraffic.js';
import { PAY, payFor, bridgeSig, wordsHere, sideView } from './bridgeplan.js';
export { PAY, payFor, bridgeSig, wordsHere, sideView };
import { mountBridge, engineerAt } from '../labs/bridge/builder.js';
import { makeYard, FT } from '../labs/bridge/scene.js';
import { makeTowerView } from '../labs/windmill/tower3d.js';
import { makeDeckView } from '../labs/bridge/deck3d.js';
import { asTower, cleanBridge, deckLine, newBridge, WIDTH, ABUT_HALF, PLANK, DECK_LIFT, PLANKS, BOARDS } from '../labs/bridge/bridge.js';
import { LOADS } from '../labs/bridge/frame.js';
import { BANK } from '../labs/bridge/scene.js';
import * as labSound from '../labs/windmill/sound.js';

export const BRIDGE = {
  x: CROSSING.x, z: CROSSING.z,       // the middle of the gap: where the road crosses the ravine (landforms.js CROSSING)
  span: 16,                           // feet between the two stone walls (the ravine's brinks are 4.9 m apart here)
  turn: -Math.PI / 2,                 // the lab's frame turned a quarter: its east (+X) runs south, its west bank is the
                                      // north (town) bank, its south side (+Z) is the west side here
  // the engineer: on the north abutment's stone, on its west side (toward his camp), clear of the road (builder.js
  // engineerAt: the lab's own spot, so he never has to move when the builder opens)
  side: 1,
  look: { outfit: 'worker_m', palette: ['#5c6b7a', '#4a3f33', '#2e241c', '#3e3328'], skin: 2, hair: 3, hat: true },   // (the lab's engineer)
  // the lumber and the deck planks, stacked on the north bank west of the road (the bridge's frame, metres)
  pile: { x: -(BANK + 7) * FT, z: 13 * FT, rot: 1.2 }, planks: { x: -(BANK + 2) * FT, z: 13.5 * FT, rot: 1.45 },
  pay: PAY,                           // gold for each rating (src/bridgeplan.js: each heavier one pays the difference)
  stands: 1,                          // the rating from which the bridge is used: horse and rider (walkers and riders)
  wagons: 2,                          // ... and from which wagons drive over it: the covered wagon
  camp: { x: CAMP.x, z: CAMP.z, rot: 1.29 },   // the engineer's camp (landforms.js CAMP's flat room), facing the road
  saveAfter: 1.5,                     // s after the last change before the rider is saved (and always on closing)
  near: 70,                           // m: the engineer is animated while the player is this near
};

export function makeBridgeJob({ W, folk, rider, sites, refresh = () => {}, hud = null, speak = null, camera = null, audio = null, traffic = null, obstacles = () => [], animals = null, player = () => null, dog = () => null }) {
  const J = { builder: null };
  const C = BRIDGE, S = C.span;
  const terrain = W.V && W.V.heightAt ? W.V.heightAt : W.heightAt;   // (the land itself, never the deck)
  // the stone tops: the shelf's height just behind both brinks, on the road's line
  const Y0 = (() => { let s = 0, n = 0; for (const sd of [-1, 1]) for (const d of [0.6, 1.2, 1.8, 2.4]) { s += terrain(C.x, C.z + sd * (S / 2 * FT + d)); n++; } return s / n; })();
  const site = J.site = sites.add({
    id: 'bridge', x: C.x, z: C.z, prompt: 'Help the engineer build his bridge',
    meet: () => { if (!engineer || J.builder || !jobOn(rider, 'bridge')) return null; const p = engineer.root.getWorldPosition(_w); return { x: p.x, z: p.z }; },
    css: ['labs/windmill/windmill.css?v=26', 'labs/bridge/bridge.css?v=15'],
    mow: { r: 7, fade: 3 },   // (the abutments, the piles and the road's ends out of the tall meadow)
    mount, closed,
    // (while the loads cross, the player, the horse and the dog standing on the road there are out of their way)
    keepOut: (x, z) => { if (!J.builder || (J.builder.phase !== 'test' && J.builder.phase !== 'result')) return false; const l = toLocal(x, z); return Math.abs(l.z) < 1.6 && Math.abs(l.x) < (S / 2 + 24) * FT; },
  });
  // the bridge's own frame: at the stone tops over the middle of the gap, turned (site.group sits on the river's bed)
  const frame = new THREE.Group(); frame.name = 'bridge-frame';
  frame.position.y = Y0 - site.origin.y; frame.rotation.y = C.turn;
  site.group.add(frame);
  const origin = new THREE.Vector3(C.x, Y0, C.z);
  const cosT = Math.cos(C.turn), sinT = Math.sin(C.turn);
  // the bridge's frame (metres) <-> the world
  const toWorld = (x, z) => ({ x: C.x + x * cosT + z * sinT, z: C.z - x * sinT + z * cosT });
  const toLocal = (wx, wz) => { const dx = wx - C.x, dz = wz - C.z; return { x: dx * cosT - dz * sinT, z: dx * sinT + dz * cosT }; };
  // the ground in the bridge's frame: the land, or an abutment's top where one is
  const abutTop = (x, z) => Math.abs(z) <= ABUT_HALF * FT && Math.abs(x) >= S / 2 * FT - 0.02 && Math.abs(x) <= (BANK + 2.5) * FT;
  const groundY = (x, z) => { const w = toWorld(x, z), g = terrain(w.x, w.z) - Y0; return abutTop(x, z) ? Math.max(0, g) : g; };
  const bedY = terrain(C.x, C.z) - Y0;                 // (the river's bed under the middle: the water runs there)
  const waterY = bedY + 0.15;
  const builds = () => { if (!rider.builds || typeof rider.builds !== 'object') rider.builds = {}; return rider.builds; };
  const saved = () => { const b = builds().bridge; return b && typeof b === 'object' && b.bridge && Array.isArray(b.bridge.boards) ? b : null; };
  // what the bridge standing now carries (-1: nothing, or not worked out since it last changed)
  J.rating = () => {
    const b = saved(); if (!b || !b.rated || !Number.isInteger(b.rated.rating) || !b.deck) return -1;
    return b.rated.sig === bridgeSig(b.bridge, b.deck) ? b.rated.rating : -1;
  };

  // ── what stands at the ravine: the stone abutments, the piles, the bridge as built ──────────────────────────────
  const yard = makeYard(frame, { ground: groundY, bottom: bedY - 0.4, letters: ['N', 'S'], pileAt: C.pile, plankAt: C.planks, hideBuried: true });
  yard.setSpan(S);
  // (the stone abutments and the letters on them never change here: merged once, and left merged while the builder is
  // up too, so opening it draws nothing new; the piles and the bridge itself are merged while it is away)
  const stones = mergeStatic([...yard.abuts.map((a) => a.g), ...yard.marks.map((m) => m.m)], site.group);
  // (the builder calls this each frame with where the camera looks and stands, in the bridge's frame: the engineer is
  // left out of the picture while he stands right by the camera or between it and the bridge)
  const _e = new THREE.Vector3(), _ab = new THREE.Vector3(), _ap = new THREE.Vector3();
  yard.update = (dt, look, eye) => {
    if (!engineer || !eye) return;
    _e.copy(engineer.root.position); _e.y += 0.9;
    _ab.subVectors(look, eye); const L2 = _ab.lengthSq() || 1; _ap.subVectors(_e, eye);
    const t = Math.max(0, Math.min(1, _ap.dot(_ab) / L2)), off = _ap.addScaledVector(_ab, -t).length();
    engineer.root.visible = !(_e.distanceTo(eye) < 2.6 || (t < 0.9 && off < 0.8));
  };
  const shown = makeTowerView(frame);
  const deckShown = makeDeckView(frame, shown.strainColor);
  let holdTop = null;   // (THE DECK HELD, below: the deck's top kept under those standing on it)
  let merged = null, deckTop = null, plankY = null;   // deckTop: the deck's top (metres, the bridge's frame) while the
                                                      // bridge is used; plankY: its top whether or not it is
  function showBridge() {
    const b = saved();
    if (merged) { merged.undo(); merged = null; }
    yard.setPile(b && b.lumber && Number.isFinite(b.lumber.full) ? b.lumber.full : BOARDS);
    yard.setPlankPile(b && Number.isFinite(b.planks) ? b.planks : PLANKS);
    const t = b ? cleanBridge({ ...b.bridge, S }) : newBridge(S, WIDTH);
    const br = { S, D: t.D, boards: t.boards, deck: null };
    if (b && b.deck) { const d = deckLine(br); if (d.planks) br.deck = d; }
    shown.rebuild(asTower(br)); shown.nails.visible = true; shown.showHead(false); shown.group.visible = true;
    deckShown.rebuild(br.deck); deckShown.group.visible = true;
    merged = mergeStatic([shown.group, deckShown.group, yard.pile, yard.plankPile], site.group);
    const p = br.deck && br.deck.planks[0];
    plankY = p ? (p.a.Y + (3.5 / 24 + PLANK.t / 2 - DECK_LIFT) + PLANK.t / 2) * FT : null;
    useDeck();
    // (changed since its rating was worked out: the engineer's sums run quietly on it now)
    if (b && b.bridge.boards.length && !(b.rated && b.rated.sig === bridgeSig(b.bridge, b.deck))) rate();
  }
  // the deck the valley walks on: a bridge that carries the horse, while no builder is up
  function useDeck() { deckTop = plankY !== null && !J.builder && J.rating() >= C.stands ? plankY : null; }
  // THE QUIET SUMS: frame.js crossTest on the bridge as it stands (in the lab's worker), its rating kept with its
  // fingerprint. -> a promise of the rating
  let rating = null, worker = null, ask = 0;
  function rate() {
    const b = saved(); if (!b) return Promise.resolve(-1);
    const sig = bridgeSig(b.bridge, b.deck), t = cleanBridge({ ...b.bridge, S });
    const br = { S, D: t.D, boards: t.boards, deck: null };
    if (b.deck) { const d = deckLine(br); if (d.planks) br.deck = d; }
    if (!br.deck) { setRated(sig, -1); return Promise.resolve(-1); }
    const id = ++ask;
    rating = new Promise((res) => {
      try {
        if (!worker) worker = new Worker(new URL('../labs/bridge/cross-worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = (e) => { const d = e.data; if (d.id !== id || !d.done) return; setRated(sig, d.done.rating); res(d.done.rating); };
        worker.onerror = () => res(-1);
        worker.postMessage({ id, bridge: JSON.parse(JSON.stringify(br)) });
      } catch (e) { console.warn('bridge: the engineer\'s sums could not run', e); res(-1); }
    });
    return rating;
  }
  function setRated(sig, r) {
    const b = saved(); if (!b || bridgeSig(b.bridge, b.deck) !== sig) return;   // (changed again since: its own sums follow)
    const was = J.rating();
    b.rated = { sig, rating: r, at: Date.now() };
    saveRider(rider);
    useDeck();
    if (r >= C.stands && was < C.stands && !J.builder) {
      const found = markFound(rider, 'place', 'bridge');
      if (hud) { try { hud.toast(`The engineer looked her over: she'll carry the ${LOADS[r].short}.${found ? ' Folks cross on your bridge now!' : ''}`, 'gold'); } catch (e) { /* (no toast) */ } }
    }
  }

  // ── the engineer: on the north abutment's stone, west of the road (in the bridge's frame, his lab spot) ─────────
  let engineer = null;
  const _w = new THREE.Vector3();
  try {
    engineer = makePerson(folk, { ...C.look, shadows: true });
    const p = engineerAt(S, C.side); engineer.root.position.set(p.x, p.y, p.z);
    engineer.root.rotation.y = Math.PI;   // (facing up the road toward the town: the lab's west, -X)
    engineer.play('Idle', { fade: 0 });
    frame.add(engineer.root);
  } catch (e) { console.warn('bridge: the engineer could not be made', e); }
  J.engineer = engineer;
  showBridge();

  // ── his camp: the tent, the fire in its ring of stones, the ground round it mown; the tent and the ring block walkers ──
  const K = CAMP_KINDS.camp1, cp = C.camp, cc = Math.cos(cp.rot), cs = Math.sin(cp.rot);
  const campAt = (lx, lz) => ({ x: cp.x + cc * lx + cs * lz, z: cp.z - cs * lx + cc * lz });
  const campLocal = (wx, wz) => { const dx = wx - cp.x, dz = wz - cp.z; return { x: cc * dx - cs * dz, z: cs * dx + cc * dz }; };
  const campY = (() => { let sum = 0, n = 0; for (let lz = -2.5; lz <= 2.5; lz += 1.25) for (let lx = -2.5; lx <= 2.5; lx += 1.25) { const p = campAt(lx, lz); sum += terrain(p.x, p.z); n++; } return sum / n - 0.06; })();
  const camp = new THREE.Group(); camp.name = 'bridge-camp'; camp.position.set(cp.x, campY, cp.z); camp.rotation.y = cp.rot; W.scene.add(camp);
  const shadows = !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  let campGone = false;
  loadCamp(K.file, W.tier !== 'gaming').then((scn) => {
    if (campGone) return;
    const m = scn.clone(); m.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = shadows; } }); camp.add(m);
  }).catch((e) => console.warn('bridge: the camp could not load', e));
  const unmowCamp = mowSite(W, cp.x, cp.z, { r: 7.5, fade: 3 });
  const fireAt = campAt(K.fire.x, K.fire.z);
  let fire = null;
  try { if (camera) fire = makeCampfire({ W, scene: W.scene, camera, x: fireAt.x, z: fireAt.z, y: campY + K.fire.y, width: K.fire.width, audio, id: 'campfire-engineer' }); } catch (e) { console.warn('bridge: the campfire', e); }
  const campBlock = (wx, wz) => {
    if (Math.abs(wx - cp.x) > 12 || Math.abs(wz - cp.z) > 12) return false;
    const p = campLocal(wx, wz);
    for (const [x0, z0, x1, z1] of K.block.boxes) if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) return true;
    for (const [rx, rz, r] of K.block.rings) if ((p.x - rx) ** 2 + (p.z - rz) ** 2 < r * r) return true;
    return false;
  };
  const unblockCamp = W.addBlocker ? W.addBlocker(campBlock) : () => {};
  let time = 0;
  // the travellers on the crossing road: over the bridge when it carries them, else by the ford
  const road = J.road = makeCrossingTraffic({ W, folk, job: J, traffic, obstacles, camera });

  // ── the builder, mounted at the site ─────────────────────────────────────────────────────────────────────────
  let saveT = 0, paidNow = 0, toast = null, buckle = null;
  function mount(ctx) {
    const t0 = performance.now();
    labSound.setBed(false);   // (the lab's own bed of birds and far-off work: the valley has its own sounds)
    if (merged) { merged.undo(); merged = null; }
    shown.group.visible = false; deckShown.group.visible = false;
    // (while it is being built the bridge isn't walked on: the travellers go by the ford; one on its way over the bridge
    // just now is put away)
    // (the player, the horse or the dog standing on the deck just now keep it under their feet: THE DECK HELD, below)
    if (deckTop !== null && standers().some((t) => onFoot(t.at.x, t.at.z))) holdTop = deckTop;
    deckTop = null; road.off('bridge');
    const b = saved(), eye = toLocal(ctx.camera.position.x, ctx.camera.position.z);
    paidNow = 0; toast = null; buckle = null;
    if (audio && audio.need) audio.need('bridge', true);   // (the game's sound kept awake while the builder is up)
    const B = J.builder = mountBridge({
      root: ctx.root, scene: frame, origin, turn: C.turn, camera: ctx.camera, fit: ctx.fit, canvasRect: ctx.canvasRect,
      yard, groundY, waterY, low: W.tier === 'potato', span: S, words: wordsHere, engineerSide: C.side, zoom: innerWidth < innerHeight ? 1.2 : 1.75, loadsWait: 800,   // (a phone held upright: its lens is wide already)
      libs: animals && traffic && traffic.lib ? { animals, folk, wagons: traffic.lib } : null,
      asker: flagAsker(levelAsker(rider), 'bridge'),   // (the levels' 'building' place, all 8 levels)
      // ("Confusing?" on its question card: src/ui/flag.js)
      best: { read: () => ({ rating: -1, S, ...((b && b.best) || {}) }), write: () => { saveT = 0.01; } },
      pay: (rating) => pay(rating),
      tested: (card) => tested(card),
      start: b ? { bridge: b.bridge, lumber: b.lumber, planks: b.planks, deck: b.deck, bonus: b.bonus } : null,
      // (the builder's camera starts on the side the rider came from, a little round to see the bridge from its side,
      // so the glide doesn't swing round the ravine)
      az: sideView(Math.atan2(eye.x, eye.z)),
      escape: () => ctx.leave('esc'),
      changed: () => { saveT = C.saveAfter; },
      // (the saw, the hammer and the wind through the game's own sound and volume: no second sound of the lab's own)
      sound: audio && audio.ready ? { ready: (fn) => audio.ready(fn) } : null,
      speak: speak ? (text) => speak(text) : null,
      // (Show me plays by itself the first time this rider opens the builder: src/showme.js)
      showMe: shownOnce(builds, 'bridge', () => saveRider(rider)),
      // (the engineer standing at the ravine is the one in the builder: he is in its frame already, at his spot)
      engineer: engineer ? () => engineer : null,
      dropEngineer: () => {},
    });
    // (a phone held upright: square onto the gap from the rider's bank, a little round and further back, so both stone
    // walls and the river between them are in its narrow view from the start, not the far wall close up)
    // (a little lower and closer than the builder's own start: the gap and the stone tops larger, both still in view)
    if (innerWidth < innerHeight && B.handle && B.handle.setAz) { B.handle.setAz(eye.x < 0 ? -0.8 : 0.8); B.handle.setLook(0, 17); }
    J.mountMs = performance.now() - t0;   // (for rigs: what opening the builder costs in one go)
    // (put away with a test's card up: what came down comes off first, as "Keep building" does; then saved)
    const dispose = B.dispose;
    B.dispose = () => { if (B.settle) B.settle(); keep(); dispose(); };
    return B;
  }
  // what the engineer pays for a test (the card shows it): each heavier rating the difference; once paid, nothing more
  function pay(rating) {
    const b = saved() || {}, paid = Number.isInteger(b.paid) ? b.paid : -1;
    const gold = payFor(rating, paid), L = rating >= 0 ? LOADS[rating] : null;
    if (gold > 0) {
      earn(rider, gold); refresh(); paidNow += gold;
      builds().bridge = { ...(saved() || {}), ...(J.builder ? J.builder.snapshot() : {}), paid: rating };
      saveRider(rider);
      return { gold, line: `The engineer pays ${gold} gold`, sub: paid >= 0 ? `for the ${L.short}, on top of the ${LOADS[paid].short} he paid for` : `for carrying the ${L.short}` };
    }
    if (!L) return { gold: 0, line: 'No pay this time', sub: 'Get a person across for the first pay' };
    return { gold: 0, line: 'Paid for that already', sub: `He's paid for the ${LOADS[Math.max(paid, rating)].short}: carry something heavier for more` };
  }
  // a test finished: the loads carried counted (the belt buckle), the rating kept for this very bridge
  function tested(card) {
    const B = J.builder; if (!B) return;
    const rating = card && Number.isInteger(card.rating) ? card.rating : -1;
    if (rating >= 0) {
      const c = countJob(rider, 'loads', rating + 1);
      if (c && c.buckle) buckle = c.buckle;   // (shown once the builder is put away: the HUD is away meanwhile)
    }
    // (the card's rating is the bridge's as it stood for the test; what came down comes off when the builder keeps
    // building or is put away, and what stands then gets its own sums)
    const snap = B.snapshot(), sig = bridgeSig(snap.bridge, snap.deck);
    builds().bridge = { ...(saved() || {}), ...snap, rated: { sig, rating, at: Date.now() }, at: Date.now() };
    if (rating >= C.stands && markFound(rider, 'place', 'bridge')) toast = toast || 'The bridge over the west river carries horse and rider!';
    saveRider(rider);
  }
  // the bridge, the lumber, the planks and the boards earned, as they are now, into the rider's save
  function keep() {
    if (!J.builder) return;
    builds().bridge = { ...(saved() || {}), ...J.builder.snapshot(), at: Date.now() };
    saveRider(rider);
    saveT = 0;
  }
  function closed() {
    J.builder = null; saveT = 0;
    if (audio && audio.need) audio.need('bridge', false);
    if (engineer) engineer.root.visible = true;
    showBridge();
    if (holdTop !== null) release();
    if (hud && (toast || paidNow)) { try { hud.toast(toast || `The engineer paid ${paidNow} gold`, 'gold'); } catch (e) { /* (no toast) */ } }
    if (hud && buckle && hud.buckle) { try { hud.buckle(buckle, { delay: 1400 }); } catch (e) { /* (no buckle card) */ } }
    toast = null; paidNow = 0; buckle = null;
  }

  // ── the deck, walked on: the valley's ground there is the deck's top while the bridge is used ───────────────────
  // (the deck and the stone tops at its two ends, where the road comes onto it: the ravine's sheer wall right under the
  // deck's ends would otherwise block the step on)
  const halfW = (WIDTH / 2 + 0.6) * FT, halfL = (S / 2 + 3) * FT;
  const onFoot = (x, z) => { const l = toLocal(x, z); return Math.abs(l.x) <= halfL && Math.abs(l.z) <= halfW; };   // (the deck's footprint)
  const onDeck = (x, z) => (deckTop !== null || holdTop !== null) && onFoot(x, z);
  const prevHeight = W.heightAt, prevBlocked = W.blocked;
  const heightAt = (x, z) => (onDeck(x, z) ? Y0 + (deckTop ?? holdTop) : prevHeight(x, z));
  const blocked = (x, z) => (onDeck(x, z) ? false : prevBlocked(x, z));
  W.heightAt = heightAt; W.blocked = blocked;

  // THE DECK HELD: the player, the horse or the dog standing on the deck when the builder opens (the engineer is in
  // reach from the deck's north end) stand on it still while the builder is up, though the travellers go by the ford
  // meanwhile (the ground under them never falls away). Put away: a deck still used is theirs again as anyone's; deck
  // planks still there but no longer carrying horse and rider (or not worked out yet) bear them until they have all
  // stepped off onto a bank; no deck at all, and whoever stood on it is set on the nearer bank, on the road, so no one
  // is ever left in the ravine.
  const _sp = new THREE.Vector3();
  function standers() {
    const out = [], P = player(), Dg = dog();
    if (P && P.position) out.push({ at: P.position, move: (x, z) => P.teleport(x, z) });
    if (P && P.horse && P.horse.root && P.moveHorse && !P.onHorse) out.push({ at: P.horse.root.position, move: (x, z) => P.moveHorse(x, z) });
    if (Dg && Dg.dog && Dg.dog.root && Dg.shift) { const r = Dg.dog.root.position; out.push({ at: r, move: (x, z) => Dg.shift({ dx: x - r.x, dz: z - r.z }) }); }
    return out;
  }
  function release() {
    if (J.builder) return;
    if (deckTop !== null) { holdTop = null; return; }   // (used again: the deck is the ground for everyone)
    if (plankY !== null) { holdTop = plankY; if (!standers().some((t) => onFoot(t.at.x, t.at.z))) holdTop = null; return; }   // (stepped off: let go)
    // no deck: onto the nearer bank, a step back from the brink, each a little apart along the road
    let k = 0;
    for (const t of standers()) {
      if (!onFoot(t.at.x, t.at.z)) continue;
      const l = toLocal(t.at.x, t.at.z), side = l.x < 0 ? -1 : 1;
      const w = toWorld(side * (S / 2 * FT + 1.4 + k * 0.9), Math.max(-0.8, Math.min(0.8, l.z)));
      _sp.set(w.x, 0, w.z); t.move(_sp.x, _sp.z); k++;
    }
    holdTop = null;
  }

  // ── each frame ───────────────────────────────────────────────────────────────────────────────────────────────
  const _l = new THREE.Vector3();
  J.update = (dt, at = null) => {
    if (saveT > 0 && (saveT -= dt) <= 0) keep();
    if (holdTop !== null && !J.builder) release();
    time += dt;
    if (fire && at && Math.hypot(at.x - fireAt.x, at.z - fireAt.z) < 160) fire.update(dt, time);
    if (at) road.update(dt, at);
    if (!engineer || J.builder) return;
    const p = engineer.root.getWorldPosition(_w), d = at ? Math.hypot(at.x - p.x, at.z - p.z) : Infinity;
    if (d > C.near) return;
    engineer.update(dt);
    // (he turns to a rider coming up to him; otherwise looks up the road toward the town)
    let want = Math.PI;
    if (d < 9 && at) { const l = toLocal(at.x, at.z), e = engineer.root.position; want = Math.atan2(l.x - e.x, l.z - e.z); }
    const r = engineer.root.rotation.y; engineer.root.rotation.y = r + Math.atan2(Math.sin(want - r), Math.cos(want - r)) * Math.min(1, dt * 3);
  };
  // what the bridge standing now has carried, if it hasn't changed since its test (-1: nothing yet, or changed)
  J.rated = () => rating || Promise.resolve(J.rating());
  // which of the engineer's hellos fits now (src/jobfolkplan.js: his `hellos`): nothing built; boards up but not
  // carrying horse and rider; used by walkers and riders; by the wagons too; the cattle drive carried (the last rating)
  J.helloKey = () => {
    const b = saved(), r = J.rating();
    if (r >= C.wagons) return r >= LOADS.length - 1 ? 'done' : 'wagons';
    if (r >= C.stands) return 'riders';
    return b && b.bridge && b.bridge.boards.length ? 'building' : 'start';
  };
  J.uses = (kind) => deckTop !== null && J.rating() >= (kind === 'wagon' ? C.wagons : C.stands);
  J.deck = () => (deckTop === null ? null : { y: Y0 + deckTop, halfL, halfW, x: C.x, z: C.z, turn: C.turn });
  J.onDeck = onDeck;
  J.toWorld = toWorld; J.toLocal = toLocal; J.origin = origin;
  // where the job is, for the jobs board and the trail: the engineer
  J.where = () => { const p = engineer ? engineer.root.getWorldPosition(_l) : origin; return { x: p.x, z: p.z }; };
  J.state = () => ({ draws: merged ? merged.draws + stones.draws : null, merged: merged ? merged.count : 0, open: !!J.builder, Y0, rating: J.rating(), deck: J.deck(),
    saved: saved() ? { boards: saved().bridge.boards.length, deck: saved().deck, planks: saved().planks, lumber: saved().lumber, paid: saved().paid, rated: saved().rated && { rating: saved().rated.rating, now: saved().rated.sig === bridgeSig(saved().bridge, saved().deck) }, bonus: saved().bonus } : null,
    engineer: engineer && (() => { const p = engineer.root.getWorldPosition(new THREE.Vector3()); return { x: p.x, y: p.y, z: p.z }; })() });
  J.dispose = () => {
    if (W.heightAt === heightAt) W.heightAt = prevHeight;
    if (W.blocked === blocked) W.blocked = prevBlocked;
    deckTop = null;   // (wrapped over by someone since: ours passes straight through from now on)
    if (merged) { merged.undo(); merged = null; }
    stones.undo();
    if (engineer) frame.remove(engineer.root);
    campGone = true; W.scene.remove(camp); unmowCamp(); unblockCamp(); if (fire) fire.dispose();
    road.dispose();
    if (worker) { worker.terminate(); worker = null; }
    frame.remove(shown.group); frame.remove(deckShown.group);
    yard.dispose();
    site.group.remove(frame);
  };
  return J;
}
