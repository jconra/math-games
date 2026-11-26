// THE MUSIC IN THE STATION'S PLACES (MUSIC 3): a music screen in each place the game's maker named and aboard each ship,
// the hallways' lines on one wall from end to end, which song a screen changes, what the browser keeps, the switch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCREEN_ROOMS, songOf, KEEP, keptPicture, keepPicture, hallwayOn, keepHallway, HALLWAYS, alongOf } from '../src/music/placesplan.js';
import { MUSIC_LINES } from '../kit/musiclines.js';
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

test('the hallway lines: a rail along one wall of each hallway, proud of its posts and ribs, stopping only at doorways and round what stands out as far', () => {
  // (what hangs on a wall: half its width, its height from its foot, how far it stands out)
  const ext = { screen: [0.28, 0, 0.4, 0.07], breaker: [0.215, 0, 0.565, 0.13], extinguisher: [0.1, 0, 0.66, 0.21], jobs: [0.56, -0.45, 0.45, 0.3], kiosk: [0.42, 0, 2, 0.6], board: [0.5, 0, 0.6, 0.2] };
  const R = MUSIC_LINES;
  // the rail stands clear of the panels' posts (9 cm) and the ribs' fins (18 cm), at hand height, under the wall screens
  assert.ok(R.out > 0.18 && R.y > 0.85 && R.y + R.h < 1.25);
  // five lines filling most of its face, small gaps between them, each several times the band's first lines (1.2 cm)
  assert.ok(5 * R.pitch - (R.pitch - R.line) <= R.h && 5 * R.line > 0.65 * R.h && R.line >= 2.5 * 0.012);
  for (const id of HALLWAYS) {
    const r = roomOf(id), lines = r.pieces.filter((p) => p.piece === 'lines');
    assert.ok(lines.length >= 5, id);
    const sides = new Set(lines.map((p) => p.turn + ':' + (p.turn % 2 ? p.cell[0] : p.cell[1])));
    assert.equal(sides.size, 1, id + ' one wall');
    let total = 0;
    for (const L of lines) {
      const w = r.pieces.find((p) => p.piece === 'wall' && p.cell[0] === L.cell[0] && p.cell[1] === L.cell[1] && p.turn === L.turn && !p.deck);
      assert.ok(w && !['door', 'locked'].includes(w.variant), id + ' on a wall panel, never a doorway');
      assert.ok(R.lens.includes(L.variant) && L.off[1] === R.y, id);
      const len = +L.variant, a = L.off[0] - len / 2, b = L.off[0] + len / 2;
      assert.ok(a >= -1.001 && b <= 1.001, id + ' on its panel');
      for (const f of r.pieces.filter((p) => ext[p.piece] && p.cell[0] === L.cell[0] && p.cell[1] === L.cell[1] && p.turn === L.turn)) {
        const [hw, y0, y1, z] = ext[f.piece], fy0 = f.off[1] + y0, fy1 = f.off[1] + y1;
        if (fy0 < R.y + R.h && fy1 > R.y && z + (f.off[2] || 0) >= 0.18) assert.ok(b <= f.off[0] - hw || a >= f.off[0] + hw, `${id}: clear of the ${f.piece}`);
      }
      total += len;
    }
    // (most of the hallway's wall: the doorways and the ends aside)
    const line0 = lines[0].turn % 2 ? lines[0].cell[0] : lines[0].cell[1];
    const panels = r.pieces.filter((p) => p.piece === 'wall' && !p.deck && p.turn === lines[0].turn && (p.turn % 2 ? p.cell[0] : p.cell[1]) === line0).length;
    assert.ok(total > 0.75 * 2 * panels - 1, `${id}: ${total} m of rail along ${panels} panels`);
  }
  // along a hallway: low notes at the smaller z (north) or the smaller x (west), whichever way it runs
  const ns = alongOf([[2, 14], [2, 30], [2.3, 22]]);
  assert.equal(ns.axis, 'z'); assert.equal(ns.u(2, 14), 0); assert.equal(ns.u(2, 30), 1); assert.equal(ns.u(2, 22), 0.5);
  const ew = alongOf([[3, 3], [13, 3]]);
  assert.equal(ew.axis, 'x'); assert.equal(ew.u(3, 3), 0); assert.equal(ew.u(13, 3), 1);
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
  assert.match(places, /mountMusicControls\(over, music, \{[^\n]*done:/); assert.match(places, /'pointer'/);
  // every button one line: never breaking its words
  assert.match(screen, /\.pnm-btn \{[^}]*white-space: nowrap/);
  // the lab: one picture with a full screen button, and the same controls under it; no second small screen
  assert.match(lab, /mountMusicPicture\([^\n]*full: true/); assert.match(lab, /mountMusicControls\(/);
  assert.doesNotMatch(page, /station wall screen, small/);
});
