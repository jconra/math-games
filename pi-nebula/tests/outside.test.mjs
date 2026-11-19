// The outside of the station (kit/outside-plan.js): its plan checked against the real rooms and against what the
// game's maker asked for. No browser: the plan and the plate builder are plain numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { outsidePlans, outsideGear, outsideMarks, flatsOf, SHELL, SHELL_PATH, SHELL_PADS, SHELL_DOORS, SHELL_BLOCK, MASSES, PADS, PAD_DOOR, PAD_DOORS, PYRAMIDS, RAISED, MID, LEVELS, OPENINGS, HANGARS, DOOR, BODY_PATH, MARKS, SLOTS, GIRDER, SPIRE, OUTSIDE_BOX, OUTSIDE_VIEWS } from '../kit/outside-plan.js';
import { hullArrays, mergeHulls } from '../kit/hull-plates.js';
import { STATION_LOOK, HULL_LOOKS, plateSizes } from '../kit/hull-look.js';

const STATION = JSON.parse(readFileSync(new URL('../kit/rooms/station.json', import.meta.url), 'utf8'));
const sizes = (look) => ({ ...plateSizes(look), lap: 0 });
const build = (opts, look = STATION_LOOK) => mergeHulls(outsidePlans(opts).map((p) => hullArrays(p, sizes(look))));
const LAB = build(), GAME = build({ inside: true });
const inPoly = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const area = (P) => Math.abs(P.reduce((t, p, i) => { const q = P[(i + 1) % P.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
// every point of every plate (and of the dark backing behind them): its corners, and the middle of each triangle
function* points(A) {
  for (const g of ['band', 'tiers', 'trim']) {
    const { position: p, index } = A.groups[g];
    for (let i = 0; i < p.length; i += 3) yield [p[i], p[i + 1], p[i + 2]];
    for (let i = 0; i < index.length; i += 3) { const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3; yield [(p[a] + p[b] + p[c]) / 3, (p[a + 1] + p[b + 1] + p[c + 1]) / 3, (p[a + 2] + p[b + 2] + p[c + 2]) / 3]; }
  }
}
// the real rooms' floor cells (2 m by 2 m, the station's ground level), each with how high its room is
const TALL = { terminal: 7.9, hangar: 11.9, 'hangar-miner': 11.9, 'hangar-medic': 11.9, 'smelter-hall': 11.9 };
const CELLS = new Map();
for (const r of STATION.rooms) for (const p of r.pieces) if (p.piece === 'floor' && !p.deck) CELLS.set(p.cell[0] + ',' + p.cell[1], { x: p.cell[0] * 2, z: p.cell[1] * 2, h: TALL[r.id] || 3, room: r.id });
// (the arena is one piece with no floor cells of its own: its court, 10 m by 18 m)
for (let x = 4; x <= 12; x += 2) for (let z = 4; z <= 20; z += 2) CELLS.set(x / 2 + ',' + z / 2, { x, z, h: 7, room: 'arena' });

test('outside: the plan is sound in every look (whole numbers of triangles, nothing missing, inside its box)', () => {
  for (const look of [STATION_LOOK, ...Object.values(HULL_LOOKS)]) {
    const A = build({}, look);
    for (const g of ['band', 'tiers', 'trim']) {
      const G = A.groups[g], n = G.position.length / 3;
      assert.ok(G.index.length > 0 && G.index.length % 3 === 0);
      for (const v of G.position) assert.ok(Number.isFinite(v));
      for (const v of G.normal) assert.ok(Number.isFinite(v));
      for (const i of G.index) assert.ok(i < n);
    }
    for (const [x, y, z] of points(A)) assert.ok(x >= OUTSIDE_BOX.min[0] && x <= OUTSIDE_BOX.max[0] && y >= OUTSIDE_BOX.min[1] && y <= OUTSIDE_BOX.max[1] && z >= OUTSIDE_BOX.min[2] && z <= OUTSIDE_BOX.max[2], `a plate at ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`);
  }
  assert.equal(outsidePlans().length, 20);   // (the body, three masses, two pyramids, the spire, the keel, the west shell and its block, the west rooms, two decks, the cargo dock's five walls, its guard walls and its block)
});

test('outside: it goes round the REAL rooms: every room is under the hull, and the hangar doors are where the rooms have them', () => {
  const roofs = outsidePlans().find((p) => p.name === 'west rooms').flats.filter((f) => f.V[2] === -1);
  for (const c of CELLS.values()) {
    const body = inPoly(BODY_PATH, c.x, c.z), shell = inPoly(SHELL_PATH, c.x, c.z), west = roofs.find((f) => c.x > f.O[0] && c.x < f.O[0] + f.w && c.z < f.O[2] && c.z > f.O[2] - f.h);
    assert.ok(body || shell || west, `the ${c.room} at ${c.x}, ${c.z} is outside the hull`);
    assert.ok(body ? LEVELS.roof > c.h : shell ? SHELL.roof > c.h + 1 : west.O[1] > c.h - 0.9 && west.O[1] >= 3.07, `the roof over the ${c.room} is too low`);
  }
  // the three big doors: the rooms' own door pieces
  const doors = STATION.rooms.flatMap((r) => r.pieces.filter((p) => p.piece === 'baydoor2').map((p) => ({ room: r.id, x: p.cell[0] * 2, z: p.cell[1] * 2 })));
  assert.equal(doors.length, 3);
  for (const d of doors) { const h = HANGARS.find((k) => k.id === d.room); assert.ok(h && h.z === d.z && d.x === DOOR.x, 'the door of ' + d.room); }
  // the spire and the keel stand over and under the middle hangar
  const mid = [...CELLS.values()].filter((c) => c.room === 'hangar'), mx = mid.reduce((t, c) => t + c.x, 0) / mid.length, mz = mid.reduce((t, c) => t + c.z, 0) / mid.length;
  assert.ok(Math.abs(mx - SPIRE.x) <= 1 && Math.abs(mz - SPIRE.z) <= 1);
});

test('outside: every real window has its opening in the hull', () => {
  const has = (x, y, z) => OPENINGS.some((o) => { const along = o.out[0] ? z - o.at[2] : x - o.at[0], off = o.out[0] ? x - o.at[0] : z - o.at[2]; return Math.abs(off) < 0.1 && Math.abs(along) <= o.w / 2 && y >= o.at[1] && y <= o.at[1] + o.h; });
  let found = 0;
  for (const r of STATION.rooms) for (const p of r.pieces) {
    const x = p.cell[0] * 2, z = p.cell[1] * 2, y0 = (p.deck || 0) * 4;
    // (a window to space in a wall panel: its glass is 1.56 to 2.4 m up; a window wall's glass is 1.05 to 2.2 m up)
    if (p.piece === 'wall' && p.variant === 'window') { assert.ok(has(x, 2, z), `the window of ${r.id} at ${x}, ${z}`); found++; }
    // (a window wall on the station's outer face: the terminal's south wall, the smelter's north wall)
    if (p.piece === 'pane' && ((r.id === 'terminal' && z === 37) || (r.id === 'smelter-hall' && z === -31))) { assert.ok(has(x, y0 + 1.6, z), `the pane of ${r.id} at ${x}, ${y0}, ${z}`); found++; }
  }
  assert.equal(found, 3 + 20 + 4);
});

test('outside: the three doorways and the real windows are clear of plates, in the lab and in the game', () => {
  for (const A of [LAB, GAME]) for (const o of OPENINGS) {
    for (const [x, y, z] of points(A)) {
      const d = [x - o.at[0], y - o.at[1], z - o.at[2]], out = d[0] * o.out[0] + d[2] * o.out[2], along = Math.abs(o.out[0] ? d[2] : d[0]);
      assert.ok(!(out > -0.5 && out < 8 && along < o.w / 2 - 0.02 && d[1] > 0.02 && d[1] < o.h - 0.02), `a plate at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)} stands in ${o.name}`);
    }
  }
  // in the game the rooms bring their own door frames, shields and glass: the hull builds none
  // (the four panes left are the cargo slots' own lit sockets, which are the hull's)
  assert.equal(GAME.stats.doors, 0); assert.equal(GAME.stats.panes, 4); assert.equal(GAME.shields.index.length, 0);
  assert.equal(LAB.stats.doors, 3); assert.ok(LAB.stats.panes >= 6);
  // ... and leaves each door's whole frame clear (24 m by 11 m), with nothing beside it standing further out than the frame
  for (const [x, y, z] of points(GAME)) {
    for (const h of HANGARS) assert.ok(!(x > 58.5 && Math.abs(z - h.z) < 11.98 && y > 0.02 && y < 10.98), `a plate in the frame of ${h.id}`);
    if (y > 0 && y < 11 && z > -19 && z < 69) assert.ok(x <= DOOR.face + 0.001, `a plate stands ${(x - DOOR.face).toFixed(2)} m beyond the door frames`);
  }
});

test('outside: in the game no plate stands inside a room', () => {
  for (const [x, y, z] of points(GAME)) {
    const c = CELLS.get(Math.round(x / 2) + ',' + Math.round(z / 2));
    assert.ok(!(c && Math.abs(x - c.x) < 0.99 && Math.abs(z - c.z) < 0.99 && y > 0.02 && y < c.h - 0.02), `a plate at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)} is inside the ${c && c.room}`);
  }
  const g = outsideGear({ inside: true });
  for (const a of [g.lit, g.glow, g.heat]) for (let i = 0; i < a.position.length; i += 3) {
    const [x, y, z] = [a.position[i], a.position[i + 1], a.position[i + 2]], c = CELLS.get(Math.round(x / 2) + ',' + Math.round(z / 2));
    assert.ok(!(c && Math.abs(x - c.x) < 0.99 && Math.abs(z - c.z) < 0.99 && y > 0.02 && y < c.h - 0.02), 'a girder or a container inside the ' + (c && c.room));
  }
});

test('outside: ONE terrace above the hangars and ONE below, each with its windows, and their steps are not equal', () => {
  const body = outsidePlans()[0], rows = body.tiers.map((t) => t.parts.filter((p) => p && p.kind === 'windows').length);
  assert.deepEqual(body.tiers.map((t) => t.name), ['lower terrace', 'hangar band', 'upper terrace']);
  assert.deepEqual(rows, [1, 0, 1]);
  const { upper, lower } = LEVELS;
  for (const k of ['in', 'wall', 'slope']) assert.ok(Math.abs(upper[k] - lower[k]) >= 0.3, `the two terraces' ${k} are alike`);
  assert.ok(Math.abs((upper.wall + upper.slope) - (lower.wall + lower.slope)) >= 0.3);
  // (the plan's own shapes say the same: the walls of the two terraces stand in from the band's by different amounts)
  const wallIn = (t) => -Math.max(...t.profile.filter((p, i) => t.parts[Math.min(i, t.parts.length - 1)] && i < t.profile.length - 1 && t.parts[i].kind === 'windows').map((p) => p[0]));
  assert.equal(wallIn(body.tiers[0]), lower.in); assert.equal(wallIn(body.tiers[2]), upper.in);
  assert.ok(LAB.stats.windows >= 60 && LAB.stats.lit / LAB.stats.windows > 0.35 && LAB.stats.lit / LAB.stats.windows < 0.7, 'about half the windows are lit');
});

test('outside: the roof as his drawing: one raised level, a landing pad in each of its two bays, a pyramid on each end, the same on each side of the middle', () => {
  const above = MASSES.filter((m) => m.side === 'above'), below = MASSES.filter((m) => m.side === 'below');
  assert.deepEqual(above.map((m) => m.name), ['raised level']); assert.ok(below.length >= 2);
  assert.equal(new Set(MASSES.map((m) => m.name)).size, MASSES.length);
  const P = above[0].path, same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
  const mirrored = (path, other = path) => path.every((p) => other.some((q) => same(q, [p[0], 2 * MID - p[1]])));
  // the middle it is mirrored about is the roof's own, near enough, and the spire's
  const zs = BODY_PATH.map((p) => p[1]), bodyMid = (Math.min(...zs) + Math.max(...zs)) / 2;
  assert.ok(Math.abs(MID - bodyMid) <= 1.5 && Math.abs(MID - SPIRE.z) <= 1.5);
  assert.ok(mirrored(P), 'the raised level is the same on each side of the middle');
  // one outline with two bays in it: it turns inward four times; the bays are open toward the hangar doors, the strip
  // along the back is whole, and the spire stands on the middle arm
  const turnsIn = P.filter((p, i) => { const a = P[(i + P.length - 1) % P.length], b = P[(i + 1) % P.length], d1 = [p[0] - a[0], p[1] - a[1]], d2 = [b[0] - p[0], b[1] - p[1]]; return d2[0] * -d1[1] + d2[1] * d1[0] > 1e-6; }).length;
  assert.equal(turnsIn, 4);
  assert.equal(RAISED.bays.length, 2);
  for (const [z0, z1] of RAISED.bays) { const z = (z0 + z1) / 2; assert.ok(!inPoly(P, 45, z) && !inPoly(P, RAISED.front - 0.1, z) && inPoly(P, RAISED.back + 2, z), 'a bay open toward the doors, the strip behind it'); }
  assert.ok(inPoly(P, SPIRE.x, SPIRE.z) && inPoly(P, RAISED.front - 1, SPIRE.z), 'the spire stands on the middle arm, which comes forward to the hangars\' side');
  assert.ok(P.every((p) => inPoly(BODY_PATH, p[0], p[1])), 'the raised level sits in on the roof');
  // two landing pads, one in each bay, down on the roof itself; a mirrored pair
  assert.equal(PADS.length, 2);
  assert.ok(mirrored(PADS[0].path, PADS[1].path) && same(PADS[1].at, [PADS[0].at[0], 2 * MID - PADS[0].at[1]]));
  PADS.forEach((pad, i) => {
    const [z0, z1] = RAISED.bays[i];
    assert.ok(pad.path.every((p) => !inPoly(P, p[0], p[1]) && p[1] > z0 && p[1] < z1 && p[0] > RAISED.bay && inPoly(BODY_PATH, p[0], p[1])), pad.name + ' is in its bay');
    assert.ok(pad.tall <= 0.5 && area(pad.path) >= 380, 'a pad lying on the roof, big enough for the game\'s ships (16 to 20 m long)');
    assert.ok(pad.ring <= pad.square * 0.55, 'the circle well inside the square');
    assert.ok(!outsidePlans().some((pl) => pl.name === pad.name), 'no plated platform under it');
  });
  // a doorway to each pad, in the middle arm's side wall facing it, big enough for a person with room to spare
  assert.equal(PAD_DOORS.length, 2); assert.ok(PAD_DOOR.h >= 2.1 && PAD_DOOR.w >= 1.2 && PAD_DOOR.foot + PAD_DOOR.h < RAISED.to - RAISED.bevel);
  PAD_DOORS.forEach((d, i) => {
    const pad = PADS[d.pad], zs = pad.path.map((q) => q[1]), xs = pad.path.map((q) => q[0]);
    assert.ok(inPoly(P, d.x, d.z - d.out * 0.5) && !inPoly(P, d.x, d.z + d.out * 0.5), 'in a wall of the raised level, facing out');
    assert.ok(Math.abs(d.z - SPIRE.z) < 20 && d.x > Math.min(...xs) && d.x < Math.max(...xs) && (d.out > 0 ? Math.min(...zs) - d.z : d.z - Math.max(...zs)) < 2.5, 'on the middle arm, right beside its pad');
    assert.ok(Math.abs(PAD_DOORS[1 - i].z - (2 * MID - d.z)) < 1e-6 && PAD_DOORS[1 - i].x === d.x, 'the two doorways mirror each other');
  });
  // two pyramids, one on each end arm; a mirrored pair; each comes to a small flat top
  assert.equal(PYRAMIDS.length, 2);
  assert.ok(mirrored(PYRAMIDS[0].path, PYRAMIDS[1].path));
  for (const py of PYRAMIDS) {
    assert.ok(py.path.every((p) => inPoly(P, p[0], p[1])), py.name + ' stands on the raised level');
    const w = Math.max(...py.path.map((p) => p[0])) - Math.min(...py.path.map((p) => p[0]));
    assert.ok(w - 2 * py.slope > 0.5 && w - 2 * py.slope < w / 3 && py.tall >= 3, 'its sides lean in to a small top');
    assert.ok(RAISED.bays.every(([z0, z1]) => py.path.every((p) => p[1] < z0 || p[1] > z1)) && py.path.every((p) => Math.abs(p[1] - SPIRE.z) > 30), 'on an end arm');
  }
  // the masses under the body are unlike each other
  const unlike = (a, b) => Math.abs(a.to - b.to) >= 0.5 && a.bevel !== b.bevel && Math.abs(area(a.path) - area(b.path)) / Math.max(area(a.path), area(b.path)) > 0.15;
  for (let i = 0; i < below.length; i++) for (let j = i + 1; j < below.length; j++) assert.ok(unlike(below[i], below[j]), below[i].name + ' and ' + below[j].name + ' are too alike');
  // every mass is heavily bevelled
  for (const m of MASSES) assert.ok(m.bevel >= 1.2 && m.bevel / m.to >= 0.3);
});

test('outside: the dock side as his sketch: one big shell over the rooms there, two more landing pads on its top, a block between them with a door to each', () => {
  const plan = outsidePlans().find((p) => p.name === 'west shell'), tier = plan.tiers[0];
  // one mass, taller than every room under it and lower than the body's own roof; its side in bands, the middle one standing out
  assert.ok(SHELL.roof > 10 && SHELL.roof < LEVELS.band.top);
  const outs = tier.profile.map((q) => q[0]); assert.ok(Math.max(...outs) >= 0.8 && outs[0] === 0 && outs[outs.length - 1] < 0);
  // every real opening on that side is in its upright lower wall, under the band that stands out
  for (const d of plan.doors) assert.ok(d.tier === 0 && d.step === 0 && d.y + d.h <= SHELL.brow[0]);
  assert.equal(plan.doors.length, 6);
  // two pads on its top with the indoor walkway between them: lined up (the same reach toward the station's middle,
  // the same distance from the walkway), rectangles with their long way toward the station's middle
  assert.equal(SHELL_PADS.length, 2);
  for (const pad of SHELL_PADS) { assert.equal(pad.y, SHELL.roof); assert.ok(pad.path.every((q) => inPoly(SHELL_PATH, q[0], q[1])), pad.name + ' is on the shell'); assert.ok(pad.half[0] > pad.half[1] * 1.3 && area(pad.path) >= 150); }
  const [n, s0] = SHELL_PADS, B = SHELL_BLOCK;
  assert.ok(n.at[0] === s0.at[0] && n.half[0] === s0.half[0] && n.half[1] === s0.half[1], 'lined up');
  const gapN = B.z0 - (n.at[1] + n.half[1]), gapS = (s0.at[1] - s0.half[1]) - B.z1;
  assert.ok(gapN > 0.5 && gapS > 0.5 && Math.abs(gapN - gapS) < 1e-6, 'the walkway between them, as far from one as from the other');
  // the walkway runs from the body's wall to the top's dock edge
  const west = Math.min(...SHELL_PATH.filter((q) => q[1] < B.z0 + 1).map((q) => q[0]));
  assert.ok(B.x1 > 18.9 && B.x0 <= west + SHELL.bevel + 0.1, 'the walkway reaches the edge');
  assert.equal(SHELL_DOORS.length, 2);
  for (const d of SHELL_DOORS) { const pad = SHELL_PADS[d.pad]; assert.ok(Math.sign(pad.at[1] - d.z) === d.out && Math.abs(d.x - pad.at[0]) < pad.half[0], 'a door facing its pad'); }
});

test('outside: plated in shape C: big raised plates with sunk panels on the big flat stretches', () => {
  const s = LAB.stats.shapes;
  assert.ok(s.slabs >= 25 && s.recesses >= 15, JSON.stringify(s));
  assert.equal(s.stacked, 0); assert.equal(s.shoulders, 0);   // (the kit's blocks-on-a-wall "shoulders" are not what he meant: not used)
});

test('outside: the lit windows are the same every time for one seed, and a different half for another', () => {
  const a = build({ seed: 11 }), b = build({ seed: 11 }), c = build({ seed: 4242 });
  assert.deepEqual(Array.from(a.windows.shade), Array.from(b.windows.shade));
  assert.equal(a.stats.windows, c.stats.windows);
  let differ = 0; for (let i = 0; i < a.windows.shade.length; i++) if ((a.windows.shade[i] > 0.2) !== (c.windows.shade[i] > 0.2)) differ++;
  assert.ok(differ > a.windows.shade.length * 0.2, 'another seed lights other windows');
  assert.ok(c.stats.lit / c.stats.windows > 0.35 && c.stats.lit / c.stats.windows < 0.7);
});

test('outside: girders with solar wings out of both ends, radiators and the reactor, cargo slots with made-up marks only', () => {
  const zs = BODY_PATH.map((p) => p[1]), [north, south] = GIRDER.runs;
  assert.ok(Math.abs(north[0] - Math.min(...zs)) < 1 && north[1] < north[0] - 50, 'a girder out of the smelter end');
  assert.ok(south[0] - Math.max(...zs) < 1.5 && south[1] > south[0] + 50, 'a girder out of the medical end');
  assert.equal(GIRDER.wings.length, 2);
  const g = outsideGear();
  for (const a of [g.lit, g.glow, g.heat]) { assert.ok(a.triangles > 0); for (const v of a.position) assert.ok(Number.isFinite(v)); for (const v of a.color) assert.ok(v >= 0 && Number.isFinite(v)); for (const i of a.index) assert.ok(i < a.position.length / 3); }
  // the cargo slots: low on the dock (west) side, some with a container and one empty
  assert.ok(SLOTS.x < 0 && SLOTS.foot < -2 && SLOTS.z.length === 4 && SLOTS.full.length === 3);
  // the paint: the station's own sign and numbers, never a real company's name
  const REAL = ['maersk', 'msc', 'cma', 'cgm', 'evergreen', 'cosco', 'hapag', 'lloyd', 'yang ming', 'hmm', 'zim', 'hamburg', 'triton', 'textainer', 'tex', 'seaco', 'florens', 'oocl', 'apl', 'nyk', 'wan hai', 'matson', 'dhl', 'fedex', 'ups', 'amazon', 'one'];
  for (const m of MARKS) { assert.match(m.text, /^(\d\d|π \d\d·\d\d\d)$/); for (const r of REAL) assert.ok(!m.text.toLowerCase().includes(r)); }
  assert.ok(outsideMarks().length >= MARKS.length);
});

test('outside: cheap: under 50,000 triangles and 12 draws in the station\'s own look (and no look runs away)', () => {
  for (const look of [STATION_LOOK, ...Object.values(HULL_LOOKS)]) {
    const A = build({}, look), g = outsideGear(), all = A.stats.triangles.all + g.lit.triangles + g.glow.triangles + g.heat.triangles + outsideMarks().length * 2;
    const draws = ['band', 'tiers', 'trim'].filter((k) => A.groups[k].index.length).length + (A.windows.index.length ? 1 : 0) + (A.shields.index.length ? 1 : 0) + 4;
    // (a look that cuts every plate's corners and lays small plates, "old and worn", is the dearest: about 77,000)
    assert.ok(all < (look === STATION_LOOK ? 50000 : 100000), all + ' triangles'); assert.ok(draws <= 12, draws + ' draws');
  }
});

test('outside: a flat region is cut into bands that cover it once, holes left out; and the lab has its places to look from', () => {
  const sq = [[10, 10], [10, 0], [0, 0], [0, 10]], hole = [[6, 6], [6, 4], [4, 4], [4, 6]], F = flatsOf(sq, [hole], 5, true, () => ({ group: 'tiers', kind: 'plates' }));
  const a = F.reduce((t, f) => t + ((f.quad[1][0] - f.quad[0][0]) + (f.quad[2][0] - f.quad[3][0])) / 2 * f.quad[3][1], 0);
  assert.ok(Math.abs(a - 96) < 1e-6);
  for (const k of ['hangar', 'above', 'below', 'dock', 'window']) assert.ok(OUTSIDE_VIEWS[k] && OUTSIDE_VIEWS[k].name && OUTSIDE_VIEWS[k].at.length === 3);
});
