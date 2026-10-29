// THE GRAPH TEACHER (the game's maker: "some kind of traveling mathematician on his way to San Francisco"; the plan
// ~/pw/bandit-math/GRAPHS.md): Professor Lowell, standing beside the saloon's chalkboard (labs/buildings/saloon.js
// anchors.chalkboard: the board, his spot beside it turned half to the player, the player's spot in front of it). E at
// the board (a look-to-use spot, src/usespots.js) opens his card (src/ui/graphcard.js): five questions a sitting from the
// rider's level on his ladder (src/levels/place/graphs.js, src/math/graphs.js), each first answer moving the level as
// every job's do (save.js recordAnswer), and a few gold for a finished sitting. Walking up, he says his one line.
// He is made when the rider comes within TEACHER.make metres of the saloon and drawn only while its inside is loaded and
// seen, as the barkeep is (src/barkeep.js).
//
//   const T = makeGraphTeacher({ W, folk, rider, uses, hud, scene, canOpen(), onOpen(), onClose() })
//     uses: the look-to-use spots; canOpen: false while the game is paused; onOpen / onClose: the game's keys let go and
//     given back
//   T.update(dt, pos)   each frame of play (pos: the rider's position)
//   T.open()            the card (E at the board)    T.card: the card while it is up (rigs: T.card.tap, pick, show, state)
//   T.state()           for rigs: { saloon, made, shown, x, z, open, said }
//   T.dispose()
import * as THREE from 'three';
import { makePerson } from './actors/folk.js';
import { howdy, makeHowdyWatch } from './ui/howdy.js';
import { inFrame } from './usespotsplan.js';
import { roomFrame } from './townrooms.js';
import { levelFor } from './levels/model.js';
import { recordAnswer, earn } from './save.js';
import { makeQuestion, GRAPH } from './math/graphs.js';
import { openGraphCard } from './ui/graphcard.js';

export const TEACHER = {
  name: 'Professor Lowell',
  // a town person's look (the suits the town's gentlemen wear, src/townpeopleplan.js) with a railroad man's bowler
  look: { outfit: 'suit_m', palette: ['#d6cfbd', '#3d4249', '#2b2a28', '#3a2f26'], skin: 1, hair: 4, hatStyle: 'bowler' },
  line: 'Bound for San Francisco!',   // (short: the speech bubble is one line, about 25 letters)
  prompt: 'Graph practice with the Professor',
  title: 'Graph practice with Professor Lowell',
  make: 45,        // m from the saloon's middle within which he is made
  near: 4,         // m: walking this near, he says his line (again only after going further than `away`)
  away: 9,
  r: 0.3,          // m round his feet nobody walks through
};
const DONE = ['Splendid! Five for five.', 'Well done! You have the knack of it.', 'Capital work! The grid holds no fear for you.'];

export function makeGraphTeacher({ W, folk, rider, uses = null, hud = null, scene = W.scene, canOpen = () => true, onOpen = () => {}, onClose = () => {} }) {
  const T = { card: null };
  let hall = null, body = null, shown = false, at = null, offSpot = null, offBlock = null, findT = 0, said = 0, sitting = null;
  const watch = makeHowdyWatch({ near: TEACHER.near, away: TEACHER.away, again: 120 });
  const V = new THREE.Vector3();
  function find() {
    const C = W.V && W.V.CODE, o = C && C.find ? C.find('saloon') : null;
    return o && o.code && o.code.B && o.code.B.anchors && o.code.B.anchors.chalkboard ? o : null;
  }
  // the board's look-to-use spot and his place, in the world (once the saloon is built; again if it moves)
  function setUp(o) {
    if (offSpot) offSpot(); if (offBlock) offBlock(); offSpot = offBlock = null;
    hall = o; if (!o) return;
    const A = o.code.B.anchors.chalkboard, F = roomFrame({ group: o.code.group }), f = [Math.sin(A.faces), Math.cos(A.faces)];
    const spot = { id: 'chalkboard', at: A.centre, use: [A.centre[0] + f[0] * 0.55, A.centre[2] + f[1] * 0.55], r: 0.6, reach: 3.2, words: TEACHER.prompt };
    if (uses) offSpot = uses.add(o, [{ ...inFrame(spot, F), words: () => (T.card ? null : TEACHER.prompt), act: () => T.open() }]);
    const p = F.point([A.teacher.x, A.teacher.y, A.teacher.z]);
    at = { x: p.x, y: p.y, z: p.z, rot: F.yaw(A.teacher.rot) };
    if (W.addBlocker) offBlock = W.addBlocker((x, z) => Math.abs(x - at.x) < TEACHER.r && Math.abs(z - at.z) < TEACHER.r && Math.hypot(x - at.x, z - at.z) < TEACHER.r);
    if (body) place();
  }
  function place() { body.root.position.set(at.x, at.y, at.z); body.root.rotation.y = at.rot; }
  function make() {
    body = makePerson(folk, { ...TEACHER.look, shadows: false });
    body.root.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    body.root.name = 'graph teacher';
    body.play('Idle', { fade: 0 });
    body.root.visible = false; scene.add(body.root); place();
  }
  let key = '';
  T.update = (dt, pos) => {
    if ((findT -= dt) <= 0) {
      findT = 1;
      const o = find();
      const k = o ? (() => { o.code.group.updateMatrixWorld(true); const e = o.code.group.matrixWorld.elements; return `${e[12].toFixed(2)},${e[14].toFixed(2)},${e[0].toFixed(3)}`; })() : '';
      if (o !== hall || k !== key) { key = k; setUp(o); }
    }
    if (!hall || !at) { if (body) body.root.visible = false; shown = false; return; }
    const d = pos ? Math.hypot(pos.x - at.x, pos.z - at.z) : Infinity;
    if (!body && d < TEACHER.make) { try { make(); } catch (e) { console.warn('graph teacher: not made', e); } }
    if (!body) return;
    shown = d < TEACHER.make && hall.code.loaded !== false && hall.code.seen !== false;
    body.root.visible = shown;
    if (!shown) return;
    body.update(dt);
    if (watch.update(dt, d) && !T.card) { howdy(body, TEACHER.line, { ms: 3600, key: 'professor' }); said++; }
  };

  // a sitting: each question from the rider's level now (it can move during the sitting), no point twice
  T.open = () => {
    if (T.card || !canOpen()) return;
    sitting = { avoid: new Set(), rights: 0, firsts: 0, start: levelFor(rider, 'graphs').i };
    onOpen();
    T.card = openGraphCard({
      parent: document.body, title: TEACHER.title,
      next: (i) => {
        const L = levelFor(rider, 'graphs');
        const q = makeQuestion(L.level.gen, Math.random, { i, avoid: sitting.avoid });
        q.level = L.id; sitting.avoid.add(`${q.x},${q.y}`);
        return q;
      },
      record: (q, right) => {
        sitting.firsts++; if (right) sitting.rights++;
        const r = recordAnswer(rider, right, { place: 'graphs', level: q.level });
        if (r && r.badge && hud) hud.toast(`You earned the ${r.badge} badge!`, 'gold');
      },
      onDone: () => {
        const e = earn(rider, GRAPH.pay);
        if (hud) hud.toast(`+${GRAPH.pay} gold from the Professor`, 'gold');
        if (e && e.newTitle && hud) setTimeout(() => hud.toast(`You're now a ${e.newTitle}!`, 'gold'), 1600);
        const up = levelFor(rider, 'graphs').i > sitting.start;
        const all = sitting.firsts === GRAPH.n && sitting.rights === GRAPH.n;
        return `${all ? DONE[0] : DONE[1 + Math.floor(Math.random() * 2)]}${up ? ' Next time, something new.' : ''}`;
      },
      onClose: () => { T.card = null; onClose(); },
    });
  };
  T.state = () => ({ saloon: !!hall, made: !!body, shown, x: at && +at.x.toFixed(2), z: at && +at.z.toFixed(2), open: !!T.card, said });
  T.dispose = () => {
    if (T.card) T.card.close();
    if (offSpot) offSpot(); if (offBlock) offBlock(); offSpot = offBlock = null;
    if (body) { body.root.removeFromParent(); body.dispose(); body = null; }
  };
  return T;
}
