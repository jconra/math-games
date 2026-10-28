// THE STABLE, LIVED IN: the code-built stable (world/objects/codebuildings.js) with the game's horses for sale standing
// in its stalls, each with its chalkboard price over its gate (a brass name plate once it's yours), and the three
// saddles on the racks of its tack wall in the lean-to, each with its price board. Walking up to a saddle and pressing E
// buys it through the stable counter's own code (src/shop.js buySaddle), or puts an owned one on your horse.
//
// The horses are the new horse (src/actors/horses.js; the donkey is his old self), one in each stall facing the aisle,
// its head out over the gate: standing, and now and then looking left or right, nodding, shaking its head or flicking an
// ear (the steed's stall clips, at random). A horse you own stays in its stall while you're not riding it; the one you
// ride is with you. They are drawn (and moved) only near the stable, and take the governor's horse dial's look.
//
//   const SL = makeStableLife({ W, animals, rider, camera, player: () => P, shops, say, shadows })
//   SL.update(dt)           each frame (while riding about)
//   SL.prompt / SL.act()    by a saddle rack: what E does (null: nothing here)
//   SL.treatSpots()         the stall horses a treat can be given to (src/feeding.js)
//   SL.state()              for the rigs: the stall horses, the racks
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { makeHorse, HORSE_KIND, onHorseDial } from './actors/horses.js';
import { makeAnimal } from './actors/animals.js';
import { PRICES, SADDLES, HORSES, LADDER } from './catalog.js';
import { SADDLE_FILES } from './player.js';
import { ownsHorse, ridden } from './mounts.js';

const GAME = new URL('../', import.meta.url).href;
// the stall clips, and how often each (a glance or a nod is played once, then back to standing)
const IDLES = [['Idle', 4], ['Idle_2', 1.2], ['LookLeft', 1.2], ['LookRight', 1.2], ['Nod', 0.9], ['EarFlick', 1.1], ['HeadShake', 0.6]];
const ONCE = new Set(['LookLeft', 'LookRight', 'Nod', 'EarFlick', 'HeadShake']);
const NEAR = 45;                         // (m: the stall horses move and are drawn only this near the camera)
const REACH = 1.7;                       // (m: how near a saddle rack a walker has to be to buy from it)
const SADDLE_ORDER = ['plain', 'tooled', 'silver'];
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export function makeStableLife({ W, animals, rider, camera, player, shops, say = () => {}, shadows = true }) {
  const CODE = W.V && W.V.CODE;
  const SL = { prompt: null, ready: false, horses: [], racks: [] };
  if (!CODE) { SL.update = () => {}; SL.act = () => {}; SL.state = () => ({ none: true }); return SL; }
  let o = null, look = W.tier, sig = '', disposed = false;
  const owned = () => rider.owned || (rider.owned = {});
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ── the price boards over the saddles: one picture of three chalkboards, one mesh ─────────────────────────────────
  const BW = 256, BH = 128, canvas = document.createElement('canvas'); canvas.width = BW * 3; canvas.height = BH;
  const boardTex = new THREE.CanvasTexture(canvas); boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 4;
  function drawBoard(i, id) {
    const g = canvas.getContext('2d'), x0 = i * BW, S = SADDLES.find((s) => s.id === id), have = (owned().saddles || []).includes(id), on = owned().saddle === id;
    g.fillStyle = '#5e4630'; g.fillRect(x0, 0, BW, BH); g.fillStyle = have ? '#3a2d20' : '#26302b'; g.fillRect(x0 + 9, 9, BW - 18, BH - 18);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = have ? '#e9c879' : '#f2f3ea';
    let fs = 30; g.font = `800 ${fs}px Bitter, Georgia, serif`; const name = S.name.toUpperCase();
    while (g.measureText(name).width > BW - 36 && fs > 16) { fs -= 2; g.font = `800 ${fs}px Bitter, Georgia, serif`; }
    g.fillText(name, x0 + BW / 2, 40);
    g.font = '900 36px Bitter, Georgia, serif';
    g.fillText(on ? 'ON YOUR HORSE' : have ? 'YOURS' : `${PRICES.saddle[id]} GOLD`, x0 + BW / 2, 88, BW - 30);
    boardTex.needsUpdate = true;
  }
  // the stall boards: a price in chalk, or the horse's name on a brass plate once it's yours
  function drawStalls() {
    const B = o.code.B;
    o.code.boards(B.stalls.map((S) => ({ slot: S.board.slot, owned: ownsHorse(rider, S.horse), label: S.horse.toUpperCase(), price: PRICES.horse[S.horse] ?? 0,
      plate: ((HORSES.find((h) => h.id === S.horse) || {}).name || S.horse).split(' ')[0].toUpperCase() })));
  }

  // ── the horses in the stalls ──────────────────────────────────────────────────────────────────────────────────────
  // how far a horse's chest stands forward of its middle, as made (its corners a little over half its height up)
  function chestOf(a) {
    const m = a.mesh, v = new THREE.Vector3(); a.root.updateMatrixWorld(true);
    let top = 0; for (let i = 0; i < m.geometry.attributes.position.count; i += 7) { m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); top = Math.max(top, v.y); }
    let chest = 0.6; for (let i = 0; i < m.geometry.attributes.position.count; i += 3) { m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); if (v.y > 0.45 * top && v.y < 0.62 * top) chest = Math.max(chest, v.z); }
    return chest;
  }
  async function makeStall(S) {
    const L = LADDER[S.horse]; if (!L) return null;
    let h = null, a;
    if (L.kind === HORSE_KIND) { await animals.need(HORSE_KIND); if (disposed) return null; h = makeHorse(animals, { recipe: L.coat, size: L.size, tier: look, shadows }); a = h.a; }
    else { await animals.need(L.kind); if (disposed) return null; a = makeAnimal(animals, L.kind, { shadows, size: L.size }); }
    a.root.position.set(0, 0, 0); a.root.rotation.set(0, 0, 0);
    const chest = chestOf(a);
    // its chest just behind its gate, its head out over it into the aisle (S.side: into the stall)
    const x = S.frontX + S.side * (0.16 + chest), floor = o.code.grid.floor[o.code.grid.at(x, S.z)] || 0;
    a.root.position.set(x, floor + 0.015, S.z); a.root.rotation.set(0, S.face, 0);
    o.group.add(a.root);
    const st = { id: S.horse, stall: S.id, a, h, idle: 'Idle', t: rnd(0, 4), far: false };
    a.play('Idle', { fade: 0 }); if (a.mixer) a.mixer.update(Math.random() * 3);
    return st;
  }
  // (the stall horses are part of the stable's inside: there only while it is loaded, objects/codebuildings.js THE
  // INSIDES, so a shut stable far off draws no horses and its horses' pictures wait until the rider comes)
  let inside = false;
  function showHorses() {
    const ride = ridden(rider);
    for (const st of SL.horses) st.a.root.visible = inside && !(ride === st.id);   // (the one you ride is out with you)
  }

  // ── the saddles on the racks ──────────────────────────────────────────────────────────────────────────────────────
  async function makeRacks() {
    const T = o.code.B.anchors.tack || [], quads = [];
    for (let i = 0; i < Math.min(T.length, SADDLE_ORDER.length); i++) {
      const id = SADDLE_ORDER[i], R = T[i];
      SL.racks.push({ id, seat: R.seat, face: R.face, model: null });
      // its price board on the wall over it
      const g = new THREE.PlaneGeometry(0.62, 0.31), U = g.attributes.uv;
      for (let k = 0; k < U.count; k++) U.setX(k, (i + U.getX(k)) / 3);
      g.translate(R.board[0], R.board[1], R.board[2] + 0.012); quads.push(g);
      drawBoard(i, id);
    }
    if (quads.length) {
      const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
      const m = new THREE.Mesh(mergeGeometries(quads), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.85 })); m.name = 'saddle boards'; o.group.add(m);
    }
    // the saddles themselves (the game's own models, as the horses wear them), each on its rack, its horn out
    await Promise.all(SL.racks.map(async (R) => {
      try {
        const gl = await loader.loadAsync(`${GAME}models/saddles/${SADDLE_FILES[R.id]}.glb`); if (disposed) return;
        const s = gl.scene; s.traverse((m) => { if (m.isMesh) { m.castShadow = shadows; m.receiveShadow = true; } });
        s.position.set(...R.seat); s.rotation.y = Math.atan2(R.face[0], R.face[2]); o.group.add(s); R.model = s;
      } catch (e) { console.warn('stable: a saddle not loaded', R.id, e); }
    }));
  }

  // ── made when the stable is ───────────────────────────────────────────────────────────────────────────────────────
  CODE.ready.then(async () => {
    o = CODE.find('stable'); if (!o || disposed) return;
    drawStalls();
    await makeRacks();
    const made = await Promise.all(o.code.B.stalls.map((S) => makeStall(S).catch((e) => { console.warn('stable: a stall horse not made', S.horse, e); return null; })));
    SL.horses = made.filter(Boolean); showHorses(); SL.ready = true;
  });
  const offDial = onHorseDial(W, (v) => { look = v.look || look; for (const st of SL.horses) if (st.h) st.h.setLook(look); });

  // ── each frame ────────────────────────────────────────────────────────────────────────────────────────────────────
  const _cam = new THREE.Vector3(), _w = new THREE.Vector3();
  SL.update = (dt) => {
    SL.prompt = null; SL.rack = null;
    if (!SL.ready || disposed) return;
    // (bought or ridden something: the boards and the stalls again)
    const ow = owned(), s = JSON.stringify([ow.horse, ow.horses, ow.saddle, ow.saddles]);
    if (s !== sig) { sig = s; drawStalls(); SL.racks.forEach((R, i) => drawBoard(i, R.id)); showHorses(); }
    if (inside !== (o.code.loaded !== false)) { inside = o.code.loaded !== false; showHorses(); }
    camera.getWorldPosition(_cam);
    const near = inside && o.group.getWorldPosition(_w).distanceTo(_cam) < NEAR;
    for (const st of SL.horses) {
      if (!near) { if (!st.far) { st.far = true; if (st.h) st.h.look(new THREE.Vector3(0, 1e4, 0)); } continue; }
      st.far = false;
      const a = st.a;
      st.t -= dt;
      if (st.t <= 0) {
        st.munch = false;   // (a treat's nodding done)
        let t = Math.random() * IDLES.reduce((q, x) => q + x[1], 0), name = 'Idle';
        for (const [n, w] of IDLES) if ((t -= w) <= 0) { name = n; break; }
        st.idle = a.actions && a.actions[name] ? name : 'Idle';
        st.t = ONCE.has(st.idle) ? a.actions[st.idle].getClip().duration + 0.2 : rnd(3, 8);
      }
      a.play(st.idle, { fade: 0.4, once: ONCE.has(st.idle) && !st.munch });   // (munching a treat: the nod over and over)
      a.update(dt);
      if (st.h) st.h.look(_cam);
    }
    // by a saddle rack, on foot: what E does there
    const pl = player && player(); if (!pl || pl.mode !== 'foot' || !near) return;
    for (const R of SL.racks) {
      _w.set(R.seat[0] + R.face[0] * 0.5, 0, R.seat[2] + R.face[2] * 0.5).applyMatrix4(o.group.matrixWorld);
      if (Math.hypot(pl.position.x - _w.x, pl.position.z - _w.z) > REACH) continue;
      const S = SADDLES.find((x) => x.id === R.id), have = (ow.saddles || []).includes(R.id);
      if (have && ow.saddle === R.id) continue;
      SL.prompt = have ? `Put the ${S.name.toLowerCase()} on your horse` : `Buy the ${S.name.toLowerCase()} (${PRICES.saddle[R.id]} gold)`;
      SL.rack = R; break;
    }
  };
  // THE STALL HORSES A TREAT CAN BE GIVEN (src/feeding.js): each one standing in its stall near the rider; one of the
  // rider's own fills its hearts. It munches with its head out over the gate: nodding (the stall clip), not grazing,
  // which would put its head through the gate
  SL.treatSpots = () => {
    if (!SL.ready || disposed || !inside) return [];
    const out = [];
    for (const st of SL.horses) {
      if (st.far || !st.a.root.visible) continue;
      const h = HORSES.find((x) => x.id === st.id), L = LADDER[st.id];
      out.push({ key: 'stall:' + st.id, id: st.id, name: h ? h.name : st.id, a: st.a, owned: ownsHorse(rider, st.id), donkey: !!L && L.kind === 'donkey',
        eat: (sec) => { const a = st.a.actions || {}; st.idle = a.Nod && st.a.clip !== 'Nod' ? 'Nod' : a.Idle_Headlow ? 'Idle_Headlow' : 'Idle_2';   /* (a nod already played to its end would stay put: the head-low idle then) */ st.t = sec; st.munch = true; return true; } });
    }
    return out;
  };
  SL.act = () => {
    const R = SL.rack; if (!R || !shops) return;
    const have = (owned().saddles || []).includes(R.id);
    const r = have ? shops.useSaddle(R.id) : shops.buySaddle(R.id);
    if (r && r.note) say(r.note);
  };
  SL.state = () => ({ ready: SL.ready, horses: SL.horses.map((st) => ({ id: st.id, stall: st.stall, shown: st.a.root.visible, clip: st.a.clip, at: st.a.root.position.toArray().map((x) => +x.toFixed(2)) })),
    racks: SL.racks.map((R) => ({ id: R.id, model: !!R.model, seat: R.seat })), prompt: SL.prompt });
  SL.dispose = () => { disposed = true; offDial && offDial(); for (const st of SL.horses) { if (st.h) st.h.dispose(); else st.a.dispose && st.a.dispose(); st.a.root.removeFromParent(); } };
  return SL;
}
