// THE MUSIC IN THE STATION'S PLACES (MUSIC 3): a music screen in each place the game's maker named and aboard each ship,
// the hallways' lines (MUSIC 4: a set on the slanted panel at the top of each side of each section), which song a screen changes, what the browser keeps, the switch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCREEN_ROOMS, songOf, KEEP, keptPicture, keepPicture, hallwayOn, keepHallway, HALLWAYS, alongOf, SPREAD, setPlaces } from '../src/music/placesplan.js';
import { MUSIC_LINES, lineY, SLANT, onSlant, linesLength } from '../kit/musiclines.js';
import { VISUALS } from '../src/music/visuals.js';
import { musicWanted } from '../src/music/switch.js';
import { CABIN_MUSIC, MUSIC_SCREEN } from '../kit/ships/musicscreen.js';

const station = JSON.parse(readFileSync(new URL('../kit/rooms/station.json', import.meta.url), 'utf8'));
const roomOf = (id) => station.rooms.find((r) => r.id === id);
const text = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const store = (o = {}) => ({ m: { ...o }, getItem(k) { return k in this.m ? this.m[k] : null; }, setItem(k, v) { this.m[k] = String(v); } });

test('a music screen in each place he named (storage, terminal, medical, control, quarters, each hangar, the arena), one each', () => {
  const where = {};
  for (const r of station.rooms) for (const p of r.pieces || []) if (p.piece === 'screen' && p.variant === 'music') where[r.id] = (where[r.id] || 0) + 1;
  assert.deepEqual(Object.keys(where).sort(), Object.keys(SCREEN_ROOMS).sort());
  for (const k of Object.keys(where)) assert.equal(where[k], 1, k);
  for (const k of ['store', 'terminal', 'medical', 'tower', 'quarters', 'hangar-miner', 'hangar', 'hangar-medic', 'arena']) assert.ok(SCREEN_ROOMS[k], k);
  // the arena's screen changes the arena's song; every other one, aboard the ships too, the station's
  assert.equal(songOf('arena'), 'arena');
  for (const k of Object.keys(SCREEN_ROOMS).filter((k) => k !== 'arena')) assert.equal(songOf(k), 'station');
  assert.equal(songOf('miner/mess'), 'station');
});

test('a music screen aboard each of the four ships, on a room the crew sit in (never the cockpit), the wall screen\'s size', () => {
  const src = text('../src/boarding.js'), bps = [...src.matchAll(/bp: '([^']+)'/g)].map((m) => m[1]);
  assert.equal(bps.length, 4);
  for (const bp of bps) {
    const A = CABIN_MUSIC[bp]; assert.ok(A, bp);
    const plan = JSON.parse(text('../kit/ships/' + bp + '.blueprint.json')), room = plan.rooms.find((r) => r.id === A.room);
    assert.ok(room && room.kind !== 'cockpit', bp + ': ' + A.room);
    // (on the room's wall: its foot inside the room's walls, at a seated or standing person's eye)
    const [x0, z0, x1, z1] = room.rect;
    assert.ok(A.at[0] >= x0 - 0.01 && A.at[0] <= x1 + 0.01 && A.at[2] >= z0 - 0.01 && A.at[2] <= z1 + 0.01, bp);
    assert.ok(A.at[1] > 0.8 && A.at[1] < 1.8, bp);
  }
  assert.deepEqual([MUSIC_SCREEN.w, MUSIC_SCREEN.h], [0.46, 0.25]);
});

// (MUSIC 4) where a placed piece is, from the room file alone: its cell, its quarter turns (counter-clockwise from
// above) and its nudge along its own x (kit/grid.js placeMatrix, without three.js): its middle and the way its x runs
const CELL = 2;
const placed = (p) => { const t = (((p.turn || 0) % 4) + 4) % 4, a = t * Math.PI / 2, ux = Math.round(Math.cos(a)), uz = -Math.round(Math.sin(a)), o = (p.off || [0])[0]; return { x: p.cell[0] * CELL + ux * o, z: p.cell[1] * CELL + uz * o, ux, uz }; };
const sameEdge = (a, b) => a.cell[0] === b.cell[0] && a.cell[1] === b.cell[1] && a.turn === b.turn && !a.deck && !b.deck;
// a hallway's slanted panels (trim 'cornice'), the ones along its sides: those running the way most of them run
const sidesOf = (r) => {
  const corn = r.pieces.filter((p) => p.piece === 'trim' && /^cornice/.test(p.variant)), odd = corn.filter((p) => p.turn % 2 === 1).length;
  const way = odd >= corn.length - odd ? 1 : 0;
  return { corn, sides: corn.filter((p) => p.turn % 2 === way), ends: corn.filter((p) => p.turn % 2 !== way) };
};

test('the hallway lines: a set on the slanted panel at the top of each side of each section, in every hallway, between its frames', () => {
  const R = MUSIC_LINES;
  // the five lines as the game's maker chose them (3.2 cm each, "a little thicker"), on a plate that fits the slant
  assert.equal(R.line, 0.032); assert.ok(5 * R.pitch - (R.pitch - R.line) <= R.h);
  assert.ok(R.s0 > 0 && R.s0 + R.h < (SLANT.ceiling - SLANT.top) * Math.SQRT2, 'on the slant, short of the ceiling');
  assert.ok(R.depth > 0 && R.depth <= 0.015, 'standing off the panel no more than it must');
  // (the plate's corners, up the slant and out of its face: between the wall's top and the ceiling, in from the wall)
  for (const [s, n] of [[R.s0, 0], [R.s0 + R.h, R.depth]]) { const [y, z] = onSlant(s, n); assert.ok(y > SLANT.top && y < SLANT.ceiling && z > SLANT.face, `${s}, ${n}`); }
  // the beat's line nearest the ceiling, the melody's at the foot, all on the plate
  for (let k = 0; k < 5; k++) assert.ok(lineY(k) - R.line / 2 >= 0 && lineY(k) + R.line / 2 <= R.h);
  assert.ok(lineY(0) > lineY(4));
  // every room with lines is a hallway named, and every hallway named has them; nowhere else
  const withLines = station.rooms.filter((r) => r.pieces.some((p) => p.piece === 'lines')).map((r) => r.id);
  assert.deepEqual(withLines.sort(), [...HALLWAYS].sort());
  // (the junction: no slanted panels, its four sides hatches)
  assert.equal(sidesOf(roomOf('junction')).corn.length, 0);
  const hatches = station.rooms.flatMap((r) => r.pieces.filter((p) => p.piece === 'hatch'));
  let sets = 0;
  for (const id of HALLWAYS) {
    const r = roomOf(id), { sides, ends } = sidesOf(r), lines = r.pieces.filter((p) => p.piece === 'lines');
    // one set on each side panel, none on an end wall's
    assert.ok(sides.length >= 2, id);
    for (const c of sides) assert.equal(lines.filter((L) => sameEdge(L, c)).length, 1, `${id} ${c.cell}: one set`);
    for (const c of ends) assert.equal(lines.filter((L) => sameEdge(L, c)).length, 0, `${id} ${c.cell}: no set on the end wall`);
    assert.equal(lines.length, sides.length, id);
    const ribs = r.pieces.filter((p) => p.piece === 'rib');
    for (const L of lines) {
      const len = linesLength(L.variant), P = placed(L), lo = { x: P.x - P.ux * len / 2, z: P.z - P.uz * len / 2 }, hi = { x: P.x + P.ux * len / 2, z: P.z + P.uz * len / 2 };
      assert.ok(len >= R.min && len <= 2 - 2 * R.end, `${id} ${L.cell}: ${L.variant}`);
      assert.deepEqual([L.off[1], L.off[2]], [0, 0], 'placed as its panel is, only slid along it');
      // on its own panel (a section is one cell along)
      assert.ok(Math.abs(L.off[0]) + len / 2 <= 1 - R.end + 1e-9, `${id} ${L.cell}: on its panel`);
      // clear of the frames' knees on the slant (13 cm either side of a rib) by `end`
      const along = (q) => (P.ux ? q.x : q.z), line0 = P.ux ? P.z : P.x;
      for (const b of ribs) {
        const B = placed(b); if (Math.abs((P.ux ? B.z : B.x) - line0) > 0.01) continue;
        const at = along(B); if (Math.abs(at - along(P)) > 1.5) continue;
        assert.ok(Math.min(Math.abs(at - along(lo)), Math.abs(at - along(hi))) >= 0.13 + R.end - 1e-9 && !(at > Math.min(along(lo), along(hi)) && at < Math.max(along(lo), along(hi))), `${id} ${L.cell}: clear of the frame at ${b.cell}`);
      }
      // clear of a hatch's portal posts (where the plate is, up the slant, they reach 41.5 cm out from its line: measured
      // against the kit's own triangles) by `end`
      for (const h of hatches) {
        const H = placed(h), across = (H.ux ? 1 : 0) !== (P.ux ? 1 : 0);
        if (!across) continue;
        const at = P.ux ? H.x : H.z, side = P.ux ? H.z : H.x;
        if (Math.abs(side - line0) > 2.1 || Math.abs(at - along(P)) > 1.5) continue;
        assert.ok(Math.min(Math.abs(at - along(lo)), Math.abs(at - along(hi))) >= 0.415 + R.end - 1e-9, `${id} ${L.cell}: clear of the hatch at ${h.cell}`);
      }
      sets++;
    }
  }
  assert.ok(sets >= 90, `${sets} sets`);
});

test('the lines\' notes: each section the whole range (as built), or the whole hallway\'s (the other reading), low at the north or west', () => {
  assert.equal(SPREAD, 0, 'as built: each section shows the whole thing');
  // a hallway running north and south, three sections on the west side (one short, by a hatch) and one on the east
  // listed south to north
  const sets = [[[0, 7.6], [0, 9.0]], [[0, 9.16], [0, 10.84]], [[0, 11.16], [0, 12.84]], [[4, 10.84], [4, 9.16]]];
  // each section: the low notes at its north end, the high at its south, whatever its length or the way it is listed
  assert.deepEqual(setPlaces(sets, 0), [[0, 1], [0, 1], [0, 1], [1, 0]]);
  // the whole hallway: each set its own stretch, in step along it, the first at its north end, the last at its south
  const B = setPlaces(sets, 1), len = 12.84 - 7.6;
  assert.equal(B[0][0], 0); assert.equal(B[2][1], 1);
  for (const [i, [a, b]] of [[1, [9.16, 10.84]], [2, [11.16, 12.84]]]) { assert.ok(Math.abs(B[i][0] - (a - 7.6) / len) < 1e-9 && Math.abs(B[i][1] - (b - 7.6) / len) < 1e-9, String(i)); }
  // the two sides of one section show the same stretch
  assert.deepEqual(B[3], [B[1][1], B[1][0]]);
  // a stretch a set's length long: shorter sets show less of the range in the whole-hallway reading, all of it as built
  assert.ok(Math.abs((B[0][1] - B[0][0]) - 1.4 / len) < 1e-9);
  // a hallway one section long is wider than it is long: its notes still run along it (east and west here)
  assert.deepEqual(setPlaces([[[22.2, 23], [23.4, 23]], [[23.4, 27], [22.2, 27]]], 0), [[0, 1], [1, 0]]);
  assert.deepEqual(setPlaces([[[22.2, 23], [23.4, 23]], [[23.4, 27], [22.2, 27]]], 1), [[0, 1], [1, 0]]);
  // along a hallway: low notes at the smaller z (north) or the smaller x (west), whichever way it runs
  const ns = alongOf([[2, 14], [2, 30], [2.3, 22]]);
  assert.equal(ns.axis, 'z'); assert.equal(ns.u(2, 14), 0); assert.equal(ns.u(2, 30), 1); assert.equal(ns.u(2, 22), 0.5);
  const ew = alongOf([[3, 3], [13, 3]]);
  assert.equal(ew.axis, 'x'); assert.equal(ew.u(3, 3), 0); assert.equal(ew.u(13, 3), 1);
  assert.equal(alongOf([[0, 0], [1, 4]], 'x').axis, 'x');
});

test('the lines in the station: in every hallway each side\'s sets run its length in order, and in the whole-hallway reading they never go backwards', () => {
  for (const id of HALLWAYS) {
    const lines = roomOf(id).pieces.filter((p) => p.piece === 'lines');
    const ends = lines.map((L) => { const P = placed(L), h = linesLength(L.variant) / 2; return [[P.x - P.ux * h, P.z - P.uz * h], [P.x + P.ux * h, P.z + P.uz * h]]; });
    const A = setPlaces(ends, 0), B = setPlaces(ends, 1);
    for (const [a, b] of A) assert.ok((a === 0 && b === 1) || (a === 1 && b === 0), id);
    // (the whole-hallway reading: sorted along the hallway, each set's stretch starts where or after the one before ends)
    const way = Math.abs(ends[0][1][0] - ends[0][0][0]) > Math.abs(ends[0][1][1] - ends[0][0][1]) ? 0 : 1;
    for (const side of new Set(ends.map((e) => e[0][1 - way].toFixed(2)))) {
      const mine = B.filter((_, i) => ends[i][0][1 - way].toFixed(2) === side).map(([a, b]) => [Math.min(a, b), Math.max(a, b)]).sort((p, q) => p[0] - q[0]);
      for (let i = 1; i < mine.length; i++) assert.ok(mine[i][0] >= mine[i - 1][1] - 1e-9, `${id} side ${side}`);
    }
    assert.ok(Math.min(...B.flat()) === 0 && Math.max(...B.flat()) === 1, id);
  }
});

test('kept in this browser: the picture (Notes first, one for every screen) and the hallway lights (on to begin with)', () => {
  const s = store();
  assert.equal(keptPicture(s), VISUALS[0].id); assert.equal(VISUALS[0].id, 'notes');
  keepPicture(s, 'hex'); assert.equal(s.m[KEEP.picture], 'hex'); assert.equal(keptPicture(s), 'hex');
  assert.equal(keptPicture(store({ [KEEP.picture]: 'spectrum' })), 'notes');
  assert.equal(hallwayOn(store()), true);
  keepHallway(s, false); assert.equal(hallwayOn(s), false); keepHallway(s, true); assert.equal(hallwayOn(s), true);
  const blocked = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
  assert.equal(keptPicture(blocked), 'notes'); assert.equal(hallwayOn(blocked), true); keepPicture(blocked, 'orbit'); keepHallway(blocked, false);
});

test('the music\'s switch: off at first, and the screens\' code loads only with it on; the songs kept under their own keys', () => {
  assert.equal(musicWanted('', store()).on, false);
  assert.equal(musicWanted('?music=1', store()).on, true);
  const main = text('../src/main.js');
  // (places.js only from inside the music's own load)
  assert.match(main, /if \(want\.on\) import\('\.\/music\/game\.js'\)[\s\S]{0,200}import\('\.\/music\/places\.js'\)/);
  assert.doesNotMatch(main, /^import .*music\/(places|placesplan|screen|lights)/m, 'no screen code loaded with the music off');
  const game = text('../src/music/game.js');
  assert.match(game, /'pi-nebula\.music\.station'/); assert.match(game, /'pi-nebula\.music\.arena'/);
  assert.match(game, /edit\(song\)/);
  // the screens and lines are kit pieces: the same station (and saved light) with the music on or off
  assert.match(text('../kit/catalog.js'), /lines: \{ name: 'Music lines'/);
  assert.match(text('../kit/wallkit.js'), /if \(!music\) p\.light/);
});

test('the screens always show the picture, MUSIC along its top; the controls only when used, Done to leave; one designed panel that never wraps', async () => {
  const screen = text('../src/music/screen.js'), places = text('../src/music/places.js'), lab = text('../labs/music/main.js'), page = text('../labs/music/index.html');
  const { TITLE } = await import('../src/music/screen.js');
  assert.equal(TITLE.word, 'MUSIC'); assert.ok(TITLE.share > 0.05 && TITLE.share < 0.2, 'a strip of its own over the picture');
  assert.doesNotMatch(screen + places, /Show the picture/);
  assert.match(places, /mountMusicControls\(over, music, \{[^\n]*done:/); assert.match(places, /usable\.add\(\{ name: 'music screen'/);   // (the hand over a screen: the game's one helper, src/usable.js)
  // every button one line: never breaking its words
  assert.match(screen, /\.pnm-btn \{[^}]*white-space: nowrap/);
  // the lab: one picture with a full screen button, and the same controls under it; no second small screen
  assert.match(lab, /mountMusicPicture\([^\n]*full: true/); assert.match(lab, /mountMusicControls\(/);
  assert.doesNotMatch(page, /station wall screen, small/);
});
