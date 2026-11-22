// The ships' emblems: the game's maker's picks of the Ship Lab's options (2026-11-22: Miner C, the ore line with a cut
// gem; Explorer B, the ringed planet; Hauler A, one container seen from the corner), each now its ship's own, laid in
// its marks piece as the Medic's pulse line is (kit/ships/built-common.js emblem), in the place and colour the option
// had; the lab's Emblem row gone with the choice made. No browser: the modules' text, and the strokes worked out from it.
//   node --test pi-nebula/tests/emblems.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const here = (p) => new URL('../' + p, import.meta.url);
const read = (p) => readFileSync(here(p), 'utf8');
const COMMON = read('kit/ships/built-common.js');
const SHIPS = { miner: ['kit/ships/miner-built.js', 'mbMarks'], explorer: ['kit/ships/explorer-built.js', 'ebMarks'], hauler: ['kit/ships/hauler-built.js', 'hbMarks'] };
// the picked options' places and colours (the Ship Lab's options, emblems-1: measured on the ships as they stand, so
// the Miner's 4.07 m is with it on its longer legs; in its hull's own frame, where its marks are laid, STAND lower)
const PICKED = {
  miner: { z: 0.8, y: 4.07, stand: true, scale: 1, colour: [1.5, 0.55, 0.02], strokes: 7 },
  explorer: { z: -1.95, y: 3.18, scale: 1, colour: [0.08, 0.85, 3.2], strokes: 3 },
  hauler: { z: 4.1, y: 2.1, scale: 0.92, colour: [1.8, 0.4, 0.03], strokes: 6 },
};
// (built-common.js's arc, and a ship's emblem worked out from its text: its GLOW.emblem, its MARKS.emblem)
const arc = new Function(`return ${COMMON.match(/export const arc = (\([\s\S]*?\n\});\n/)[1]}`)();
function emblemOf(ship) {
  const T = read(SHIPS[ship][0]);
  const glow = T.match(/\n {2}emblem: (\[[^\]]+\]) \};\n/), m = T.match(/\n {2}emblem: (\{ z: [\s\S]*?(?:\n {2}\] \}|strokes: ringedPlanet\(\) \})),\n/);
  assert.ok(glow, `${ship}: GLOW.emblem`); assert.ok(m, `${ship}: MARKS.emblem`);
  const rp = T.match(/\nfunction ringedPlanet\([\s\S]*?\n\}\n/);
  const ringedPlanet = rp ? new Function('C', 'PI', `${rp[0]}; return ringedPlanet;`)({ arc }, Math.PI) : null;
  return { ...new Function('GLOW', 'ringedPlanet', `return ${m[1]};`)({ emblem: JSON.parse(glow[1]) }, ringedPlanet), text: T };
}
// a function's body in a module's text, by its name
const body = (T, name) => { const m = T.match(new RegExp(`\\nfunction ${name}\\(p\\) \\{\\n([\\s\\S]*?)\\n\\}\\n`)); assert.ok(m, name); return m[1]; };

test('each of the three ships carries the emblem he picked, in the place and colour of its option', () => {
  for (const [ship, P] of Object.entries(PICKED)) {
    const E = emblemOf(ship);
    const stand = P.stand ? +E.text.match(/\nexport const STAND = ([\d.]+);/)[1] : 0;
    assert.equal(E.z, P.z, `${ship}: along the side`); assert.equal(+(E.y + stand).toFixed(3), P.y, `${ship}: its height`); assert.equal(E.scale || 1, P.scale, `${ship}: its size`);
    assert.deepEqual(E.colour, P.colour, `${ship}: its colour`);
    assert.ok(E.strokes.length >= P.strokes, `${ship}: ${E.strokes.length} strokes`);
  }
  // (the Miner's: the line both ways out of the gem, the gem's five-sided outline closed; the Hauler's: three faces of
  // the container closed, three ribs; the Explorer's: the planet's outline in runs, the ring's front half over it)
  const M = emblemOf('miner').strokes, H = emblemOf('hauler').strokes, X = emblemOf('explorer').strokes;
  assert.equal(M.filter((S) => S.closed).length, 1); assert.equal(M.find((S) => S.closed).pts.length, 5);
  assert.equal(H.filter((S) => S.closed).length, 3); assert.equal(H.filter((S) => !S.closed).length, 3);
  assert.ok(X.every((S) => !S.closed && S.pts.length > 1));
  assert.ok(X.some((S) => S.pts.some(([x]) => Math.abs(x) > 0.4)), 'the ring reaches out past the planet');
});

test('every emblem is line art that fits its place: no wider than the Medic\'s line, no taller than its flank', () => {
  for (const ship of Object.keys(PICKED)) {
    const E = emblemOf(ship), k = E.scale || 1, room = ship === 'hauler' ? [0.4, 0.42] : [0.85, 0.42];   // (the Hauler's panel is narrow)
    for (const S of E.strokes) {
      assert.ok(S.pts.length >= 2, `${ship}: a stroke of one point`);
      for (const [x, y] of S.pts) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y), `${ship}: a point not a number`);
        assert.ok(Math.abs(x * k) <= room[0] && Math.abs(y * k) <= room[1], `${ship}: (${x}, ${y}) outside its place`);
      }
    }
  }
});

test('each is laid in the ship\'s own marks piece, by rays on its own hull, as the Medic\'s pulse line is', () => {
  for (const [ship, [, fn]] of Object.entries(SHIPS)) {
    const T = read(SHIPS[ship][0]), B = body(T, fn);
    assert.match(B, /C\.emblem\(acc, (MARKS|M)\.emblem, hullFaces\(\), drawn, dk\)/, `${fn} lays the emblem`);
    // (and says so out loud if a point of it misses the hull)
    assert.match(B, /if \(em\.missed\) console\.warn\(/, `${fn}: a point off the hull is told`);
    assert.ok(B.indexOf('C.emblem(') < B.lastIndexOf('acc.flush(p)'), `${fn}: laid before the marks are flushed`);
  }
  // (the ribbon is the Medic's pulse line's: as wide, as far off the skin; glowing; the Medic keeps its own pulse)
  const MD = read('kit/ships/medic-built.js'), w = +MD.match(/pulse: \{ z0: [-\d.]+, y0: [\d.]+, w: ([\d.]+),/)[1];
  const EM = new Function(`return ${COMMON.match(/export const EMBLEM = (\{[^}]*\});/)[1]}`)();
  assert.equal(EM.w, w); assert.equal(EM.lift, 0.014); assert.match(MD, /onSide\(s, ya - ny, za - nz, 0\.014\)/);
  assert.match(COMMON, /acc\.poly\(\[a\.l, a\.r, b\.r, b\.l\]\.map\(dk\), [^\n]*, E\.colour, 'glow', 99\)/);
  assert.ok(!/emblem/i.test(MD), 'the Medic has no emblem: its pulse line is its own');
  // (each ship's marks piece is in its own layout and in the station's, so the emblem is wherever the ship is)
  for (const [ship, piece] of [['miner', 'mbMarks'], ['explorer', 'ebMarks'], ['hauler', 'hbMarks']]) {
    assert.ok(JSON.parse(read(`kit/rooms/ship-${ship}-built.json`)).pieces.some((p) => p.piece === piece), `${piece} in ship-${ship}-built.json`);
  }
  const ST = JSON.parse(read('kit/rooms/station.json')), inStation = new Set(); (function walk(o) { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o.piece) inStation.add(o.piece); Object.values(o).forEach(walk); } })(ST);
  assert.ok(inStation.has('mbMarks') && inStation.has('ebMarks'), 'the parked Miner and Explorer carry theirs in their hangars');
});

test('the choice is made: the Ship Lab has no Emblem row and no emblem options', () => {
  const LAB = read('labs/ships/main.js');
  assert.ok(!/emblem/i.test(LAB), 'no emblem in the Ship Lab');
  assert.ok(!existsSync(here('labs/ships/emblems.js')), 'the options are gone');
});
