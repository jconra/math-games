// THE ONE SHARED SHIP PIECE (src/fleet.js, and the flight model flying any ship from it): each ship's data complete and
// true to its own files, the Miner's exactly as it was, and the Explorer and the Medic flown out of their own hangars
// and home to their own pads by the very same sums. No browser: plain numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as F from '../src/fleet.js';
import * as M from '../src/flymodel.js';
import { stationSolid, bayOf, SKIN } from '../src/flysolid.js';
import { HANGARS, DOOR } from '../kit/outside-plan.js';
import { SHIP_CLIPS, clipUrl } from '../src/voices.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const STATION = JSON.parse(read('../kit/rooms/station.json'));
const DT = 1 / 60;

test('the Miner\'s facts are exactly what they were before the ships shared one piece', () => {
  // (as src/flymodel.js had them written out for the Miner alone)
  const box = (a0, a1, r, u1) => { const out = []; for (const u of [0, u1]) for (const s of [-r, r]) for (const a of [a0, a0 / 2, 0, a1 / 2, a1]) out.push([a, u, s]); out.push([a1, u1 / 2, 0], [a0, u1 / 2, 0], [0, 0, 0], [0, u1, 0]); return out; };
  const was = {
    id: 'miner', room: 'ship-miner', hangar: HANGARS[0].id, pad: [42.3, 0, HANGARS[0].z], points: box(-9.0, 6.8, 3.3, 5.1), hover: 2.6, low: 2.0,
    seat: { eye: [0.5, 3.71, 4.14], look: [0.1, 3.05, 12], lookPanel: [-1.7, 3.0, 12], lookTall: [0.2, 2.6, 12], lookTallPanel: [0.2, -1.6, 12], fov: 62, fovTall: 78 },
    behind: { back: 27, up: 8.5, ups: [8.5, 5.6, 3.4], look: [0, 3.2, 3], fov: 60, fovTall: 74 },
    bay: bayOf(HANGARS[0].z), floor: { x: [23.5, 56.9], z: [HANGARS[0].z - 9.9, HANGARS[0].z + 9.3] }, voice: 'miner', claw: [8.54, 2.94, 0],
  };
  for (const k of Object.keys(was)) assert.deepEqual(M.MINER[k], was[k], 'the Miner\'s ' + k);
  // (the speed's small screen on the sill is gone: the speed is on the dashboard's display with the rest, tests/dash.test.mjs)
  assert.equal(M.MINER.screen, undefined, 'no speed\'s screen of its own');
  assert.equal(M.MINER.q0, undefined, 'parked nose out, as the flight model always had it');
  const other = (id, name, i, nose, boxes) => ({ id, name, room: 'ship-' + id, hangar: HANGARS[i].id, at: [42.3, 0, HANGARS[i].z], nose, boxes, bay: bayOf(HANGARS[i].z), mass: 2, gyr: 4 });
  assert.deepEqual(M.OTHERS, [
    other('explorer', 'Explorer', 1, 1, [{ a: [-8.7, 4.0], r: 3.4, h: 6.3 }, { a: [4.0, 6.5], r: 2.4, h: 5.2 }, { a: [6.5, 8.7], r: 1.3, h: 3.8 }, { a: [-6.3, -1.7], r: 6.6, h: 2.7 }]),
    other('medic', 'Medic', 2, -1, [{ a: [-8.8, 4.5], r: 3.2, h: 6.3 }, { a: [-8.8, -6.0], r: 1.3, h: 7.5 }, { a: [-5.7, -2.9], r: 3.9, h: 2.7 }, { a: [4.5, 6.6], r: 2.6, h: 4.7 }, { a: [6.6, 8.75], r: 1.6, h: 3.8 }]),
  ], 'the two ships it meets in the other hangars, as before');
  assert.equal(M.MINER.others, M.OTHERS);
  assert.equal(F.flightOf('miner'), M.MINER, 'one Miner: the flight model\'s is the fleet\'s');
  assert.deepEqual(M.VOICE, { welcome: SHIP_CLIPS.miner.welcome.secs, safety: SHIP_CLIPS.miner.safety.secs, gap: M.VOICE.gap }, 'its clips\' lengths, as the voice has always waited for them');
});

test('every ship\'s entry is in the same shape, and true to the station file and its own kit and blueprint', () => {
  assert.deepEqual(F.SHIP_IDS, ['miner', 'explorer', 'medic']);
  const keys = (s) => Object.keys(s).filter((k) => k !== 'claw').sort();
  // (the ships that are boarded, with their blueprints, as src/boarding.js lists them: read from its text, it loads three.js)
  const BOARD = Object.fromEntries([...read('../src/boarding.js').matchAll(/\{ id: '(\w+)', zone: '[\w-]+', lab: [\w.]+, cockpit: [\w.]+, bp: '([\w-]+)', flight: flight\(([A-Z]+)(, \{ piece: '\w+', half: [^}]+, jet: [\w.]+ \})?\)/g)].map((m) => [m[1], m[2]]));
  for (const s of F.SHIPS) {
    assert.deepEqual(keys(s), keys(F.SHIPS[0]), s.id + ': the same facts as every other ship');
    const cfg = F.flightOf(s.id), placed = STATION.places.ships[s.id];
    assert.deepEqual(cfg.pad, placed.at, s.id + ': its pad is where the station file parks it');
    assert.equal(s.nose, placed.nose === '-x' ? -1 : 1, s.id + ': its nose as the station file has it');
    assert.equal(cfg.pad[2], HANGARS[s.hangar].z, s.id + ': on its own bay door\'s line');
    assert.equal(cfg.hangar, STATION.rooms.find((r) => r.id === 'ship-' + s.id).with ? STATION.rooms.find((r) => r.id === 'ship-' + s.id).with[0] : cfg.hangar, s.id + ': its hangar');
    assert.ok(STATION.rooms.some((r) => r.id === cfg.room), s.id + ': its room is in the station file');
    // (its parked turn: none, or half way round for a ship parked nose in)
    const f = M.parkedNose(cfg); assert.ok(Math.abs(f[0] - s.nose) < 1e-12 && Math.abs(f[2]) < 1e-12, s.id + ': its nose points as it is parked');
    // how it is flown: its line in boarding.js, from its kit's own exports (its nozzles, their jets' look, its deck)
    const kit = read(`../kit/ships/${s.id}-built.js`);
    for (const k of ['export function jetNozzles', 'export const JET', 'export const DECK']) assert.ok(kit.includes(k), `${s.id}: its kit has ${k}`);
    assert.ok(BOARD[s.id], s.id + ': boarded, and how it is flown handed on from its kit');
    // THE PILOT'S EYES: over the middle of its blueprint's pilot's seat, 1.27 m over the cockpit's floor
    const bp = JSON.parse(read(`../kit/ships/${BOARD[s.id]}.blueprint.json`)), deck = JSON.parse(read(`../assets/ships/${bp.shell}.space.json`)).deck;
    const floor = +kit.match(/export const COCKPIT = \{ floor: ([\d.]+)/)[1];
    const seat = bp.items.find((it) => it.room === 'cockpit' && it.kind === 'seat' && /pilot/i.test(it.name) && !/co-?pilot/i.test(it.name));
    const mid = [(seat.rect[0] + seat.rect[2]) / 2, (seat.rect[1] + seat.rect[3]) / 2];
    assert.ok(Math.abs(cfg.seat.eye[0] - mid[0]) < 0.01 && Math.abs(cfg.seat.eye[2] - mid[1]) < 0.02, `${s.id}: the eyes over the pilot's seat (${cfg.seat.eye} over ${mid})`);
    assert.ok(Math.abs(cfg.seat.eye[1] - (deck + floor + 1.27)) < 0.005, `${s.id}: a seated pilot's eyes over the cockpit's floor (${cfg.seat.eye[1]})`);
    assert.ok(cfg.seat.look[2] > cfg.seat.eye[2] + 7 && cfg.dash.at[2] > cfg.seat.eye[2] + 0.5, s.id + ': looking ahead, the dashboard\'s display in front');
    // ITS VOICE: its own clips, each a file beside the Miner's, with how long it is
    const C = SHIP_CLIPS[s.voice];
    for (const w of ['welcome', 'safety', 'reactor']) {
      assert.ok(C && C[w] && C[w].id === `ship-${s.id}-${w}` && C[w].secs > 0.5 && C[w].secs < 5, `${s.id}: its ${w} clip`);
      assert.ok(existsSync(fileURLToPath(clipUrl(C[w].id))), C[w].id + '.mp3 is there');
    }
  }
  assert.equal(new Set(F.SHIPS.map((s) => s.voice)).size, 3, 'each ship its own voice');
});

test('each ship fits out through its bay door at the height it is carried, and its shape is its bumps', () => {
  for (const s of F.SHIPS) {
    const cfg = F.flightOf(s.id), tall = Math.max(...cfg.points.map((p) => p[1])), wide = Math.max(...cfg.points.map((p) => Math.abs(p[2])));
    assert.ok(tall + cfg.hover <= Math.min(DOOR.h, cfg.bay.y1) + 1e-9, `${s.id}: its top (${tall} m) carried at ${cfg.hover} m is under its door's lintel and its hangar's ceiling`);
    assert.ok(cfg.hover >= 1.4, s.id + ': and its belly its skin over the door\'s sill (about half a metre high, as the flying feels it)');
    assert.ok(tall + cfg.low <= cfg.bay.y1 + 1e-9, `${s.id}: and under its hangar's ceiling over its pad`);
    assert.ok(2 * (wide + SKIN) < DOOR.w, `${s.id}: it is narrower than its door`);
    // (every point of its hull is inside one of its boxes: nothing bumps where there is no ship)
    for (const p of cfg.points) assert.ok(s.boxes.some((b) => p[0] >= b.a[0] - 1e-9 && p[0] <= b.a[1] + 1e-9 && Math.abs(p[2]) <= b.r + 1e-9 && p[1] >= -1e-9 && p[1] <= b.h + 1e-9), `${s.id}: ${p} is in its shape`);
  }
  assert.equal(F.flightOf('miner').points.length, 24, 'the Miner: its one box, its 24 points');
});

// the autopilot flying a plan to its end with what the ship bumps into
function autofly(S, plan, solid, most = 240) {
  let t = 0, bumps = 0;
  while (t < most) {
    const C = M.fly(S, plan, DT);
    if (!C && !S.settle) break;
    M.stepShip(S, C || M.noControls(), DT, solid); t += DT;
    if (S.bump > 0.02) bumps++;
    if (S.landed && t > 1 && plan.every((l) => l.down)) break;
  }
  return { secs: t, bumps };
}
const solidOf = (cfg) => { const s = stationSolid({ bay: cfg.bay, bays: cfg.others.map((o) => o.bay) }), L = cfg.others.map(M.makeOther); return { ...s, push: (S) => M.pushOthers(S, L), others: L }; };

test('the Explorer and the Medic: the autopilot lifts each off its own pad, out through its own door, and home onto it, parked as it parks', () => {
  for (const id of ['explorer', 'medic']) {
    const cfg = F.flightOf(id), solid = solidOf(cfg), S = M.makeShip(cfg);
    assert.ok(M.onPad(S) && S.landed, id + ': on its pad, as it is parked');
    assert.deepEqual(S.q, [...M.parkedTurn(cfg)], id + ': turned as it is parked');
    const out = autofly(S, M.planLeave(S, solid), solid);
    assert.ok(M.clearOf(S.p), `${id}: clear of the station (${out.secs.toFixed(0)} s)`);
    assert.ok(Math.abs(S.p[2] - cfg.pad[2]) < 1, id + ': straight out of its own door');
    assert.equal(out.bumps, 0, id + ': touching nothing on the way out');
    const A = M.arrival(cfg); M.place(S, A.p, A.q);
    const home = autofly(S, M.planLand(S, solid), solid);
    assert.ok(M.onPad(S), `${id}: down exactly on its pad, turned as it parks (${home.secs.toFixed(0)} s)`);
    assert.equal(M.standing(S), 'pad');
    assert.equal(home.bumps, 0, id + ': touching nothing on the way in');
  }
});

test('the Medic, parked nose in: the guide asks for nose in over its pad, and a hand landing any way round is down', () => {
  const cfg = F.flightOf('medic'), S = M.makeShip(cfg);
  // (over its pad, nose out: the nose round is asked for, to the left or the right)
  M.place(S, [cfg.pad[0], 1.0, cfg.pad[2]], M.facing([1, 0, 0]));
  const G = M.guideOf(S);
  assert.ok(G.near && Math.max(G.keys.noseLeft, G.keys.noseRight) > 0.9, 'turned the wrong way round over its pad: the nose\'s turn is lit brightly');
  // (nose in over its pad: nothing of the turn)
  M.place(S, [cfg.pad[0], 0.6, cfg.pad[2]], M.facing([-1, 0, 0]));
  const H = M.guideOf(S);
  assert.equal(H.keys.noseLeft + H.keys.noseRight + H.keys.noseUp + H.keys.noseDown, 0, 'nose in: nothing to turn');
  // (the goal's nose, as the ship sees it, along its own nose)
  assert.ok(Math.abs(M.guideTurn(S)[0][0] - 1) < 1e-9, 'the hologram\'s nose is its own');
  // a hand landing, nose out, a little off the pad: down, where it was put, on its hangar's floor
  M.place(S, [cfg.pad[0] + 3, 0.4, cfg.pad[2] - 1], M.facing([1, 0, 0]));
  for (let t = 0; t < 6 && !S.landed; t += DT) M.stepShip(S, M.controlsOf(new Set(['down'])), DT, solidOf(cfg));
  assert.ok(S.landed && !M.onPad(S) && M.standing(S) === 'floor' && M.canGetUp(S), 'down by hand nose out: it stands where it was put');
  // ... and the next time the autopilot lands it, it is parked nose in again
  M.park(S); assert.ok(M.onPad(S)); assert.deepEqual(S.q, [0, 1, 0, 0]);
});

test('the ships each meets in the other hangars: the two that are not it; the Miner, rammed, is shoved like the other two', () => {
  for (const s of F.SHIPS) assert.deepEqual(F.flightOf(s.id).others.map((o) => o.id), F.SHIP_IDS.filter((id) => id !== s.id), s.id);
  const cfg = F.flightOf('explorer'), solid = solidOf(cfg), miner = solid.others.find((o) => o.cfg.id === 'miner'), medic = solid.others.find((o) => o.cfg.id === 'medic');
  // (SHIP2-2 B: "Shove it like the other two": as heavy and as hard to turn as they are)
  assert.equal(miner.cfg.mass, medic.cfg.mass); assert.equal(miner.cfg.gyr, medic.cfg.gyr);
  // (the Explorer flown into the Miner's hangar and on into the Miner's nose, the Miner sliding as it is shoved)
  const S = M.makeShip(cfg); M.place(S, [DOOR.x - 1, 1.5, HANGARS[0].z], M.facing([-1, 0, 0]));
  let hit = false;
  for (let t = 0; t < 8; t += DT) { M.stepShip(S, M.controlsOf(new Set(['forward'])), DT, solid); for (const O of solid.others) M.stepOther(O, DT); hit = hit || miner.hits > 0; }
  assert.ok(hit, 'it ran into the Miner');
  assert.ok(miner.moved && miner.p[0] < miner.cfg.at[0] - 1, `the Miner is shoved back along its hangar (${(miner.cfg.at[0] - miner.p[0]).toFixed(1)} m)`);
  assert.ok(M.visiting(S) && M.visiting(S).id === 'miner', 'in the Miner\'s hangar: the alarm\'s moment');
  // ... but not while its crane has hold of it: then it stops the Explorer as a wall would
  const solid2 = solidOf(cfg), held = solid2.others.find((o) => o.cfg.id === 'miner'); held.held = true;
  const S2 = M.makeShip(cfg); M.place(S2, [DOOR.x - 1, 1.5, HANGARS[0].z], M.facing([-1, 0, 0]));
  for (let t = 0; t < 8; t += DT) { M.stepShip(S2, M.controlsOf(new Set(['forward'])), DT, solid2); M.stepOther(held, DT); }
  assert.ok(held.hits > 0 && M.otherStill(held) && !held.moved && held.p[0] === held.cfg.at[0] && held.p[1] === held.cfg.at[2] && held.yaw === 0, 'held: the Miner is where it is parked');
  assert.ok(S2.p[0] > held.p[0] + 6.8, 'and the Explorer was stopped by it');
});
