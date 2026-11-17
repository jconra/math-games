// The station's hull, as its plain code says it (2026-11-17): the look's settings read, clamped and written back; the
// three ready-made looks; the plate builder's counts and sizes on a bare wall and on the Hull Lab's sample piece. (What
// it looks like is the pictures' business: ~/pw/space-math/shots/hull-lab/.)
//   node --test pi-nebula/tests/hull.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS, SETTING, HULL_LOOKS, LOOK_NAMES, DEFAULT_LOOK, FINISHES, FINISH_NAMES, FINISH_USES, GROUPS, GROUP_NAMES, readLook, readSetting, readColour, writeLook, isLookText, sameLook, lookName, plateSizes, showValue } from '../kit/hull-look.js';
import { offsetPath, insetPoly, hullStrips, layPlates, hullArrays, SEAM, INSIDE } from '../kit/hull-plates.js';
import { SAMPLE, SAMPLE_BOX, DOOR } from '../labs/hull/sample-plan.js';

const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const DARK = HULL_LOOKS['dark armour'];

// ── the settings ────────────────────────────────────────────────────────────────────────────────────────────────
test('every setting has a name of its own, a plain label, and a start inside its range', () => {
  assert.equal(new Set(SETTINGS.map((s) => s.key)).size, SETTINGS.length);
  for (const s of SETTINGS) {
    assert.ok(s.label && s.win, s.key);
    if (s.kind === 'number') assert.ok(s.min < s.max && s.step > 0 && s.def >= s.min && s.def <= s.max, s.key);
    else if (s.kind === 'colour') assert.match(s.def, /^#[0-9a-f]{6}$/, s.key);
    else assert.ok(s.kind === 'choice' && s.options.includes(s.def), s.key);
    assert.equal(SETTING[s.key], s);
  }
  // what the game's maker asked to be able to change: greys and colours, plates, finish for three groups, wear, edges
  for (const k of ['grey', 'grey2', 'trim', 'windowColour', 'windowBright', 'plateW', 'plateH', 'lap', 'bevel', 'cut', 'gap', 'scratches', 'edgeWear', 'streaks', 'pits', 'grime', 'edgeDark', 'edgeWide']) assert.ok(SETTING[k], k);
  assert.deepEqual(GROUPS, ['band', 'tiers', 'trim']);
  assert.deepEqual(FINISHES, ['plain', 'brushed', 'tempered', 'hatched', 'mottled']);
  for (const g of GROUPS) {
    assert.ok(GROUP_NAMES[g]);
    assert.deepEqual(SETTING[g + 'Finish'].options, FINISHES);
    for (const k of ['Strength', 'Angle', 'Spacing', 'Edges', 'Shine', 'Rough']) assert.equal(SETTING[g + k].group, g);
  }
  // each finish's own sliders are real settings: brushed has a direction and a strength, hatched a spacing, an angle
  // and a strength, tempered a strength and how much it gathers at the edges
  for (const f of FINISHES) { assert.ok(FINISH_NAMES[f]); for (const k of FINISH_USES[f]) assert.ok(SETTING['band' + k], f + ' ' + k); }
  assert.deepEqual(FINISH_USES.brushed, ['Angle', 'Strength']); assert.deepEqual(FINISH_USES.hatched, ['Spacing', 'Angle', 'Strength']);
  assert.ok(FINISH_USES.tempered.includes('Edges') && FINISH_USES.plain.length === 0);
});

test('the three ready-made looks are whole, valid, and different', () => {
  assert.deepEqual(LOOK_NAMES, ['dark armour', 'pale plates, dark seams', 'old and worn']);
  assert.equal(DEFAULT_LOOK, 'dark armour');
  for (const n of LOOK_NAMES) {
    const L = HULL_LOOKS[n];
    assert.deepEqual(Object.keys(L).sort(), SETTINGS.map((s) => s.key).sort(), n + ' has every setting and no others');
    assert.deepEqual(readLook(L), L, n + ' is inside every range as it stands');
    assert.equal(lookName(L), n);
  }
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(!sameLook(HULL_LOOKS[LOOK_NAMES[i]], HULL_LOOKS[LOOK_NAMES[j]]));
  // darker outside, as asked; the pale look is paler; the old one is the most worn and the only one lapped
  const lum = (h) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
  const [dark, pale, old] = LOOK_NAMES.map((n) => HULL_LOOKS[n]);
  assert.ok(lum(dark.grey) < 3 * 0x66 && lum(pale.grey) > lum(dark.grey) * 1.6 && lum(dark.trim) < lum(dark.grey2) && lum(dark.grey2) < lum(dark.grey));
  for (const k of ['scratches', 'edgeWear', 'streaks', 'pits', 'grime']) assert.ok(old[k] > dark[k] && old[k] > pale[k], k);
  assert.ok(old.lap > 0 && dark.lap === 0 && pale.lap === 0);
  // between them the looks show every finish but plain at least once... and plain too
  const used = new Set(LOOK_NAMES.flatMap((n) => GROUPS.map((g) => HULL_LOOKS[n][g + 'Finish'])));
  assert.deepEqual([...used].sort(), [...FINISHES].sort());
});

test('a look is read from anything: clamped to its ranges, mended from the base, strangers dropped', () => {
  const L = readLook({ plateW: 99, plateH: -4, lap: '0.2', bevel: 'wide', grey: '#ABC', grey2: 'red', bandFinish: 'wood', tiersFinish: 'hatched', pits: 0.123456789, colourOfMagic: 8, edgeWide: null });
  assert.equal(L.plateW, SETTING.plateW.max); assert.equal(L.plateH, SETTING.plateH.min);
  assert.equal(L.lap, 0.2); assert.equal(L.bevel, DARK.bevel);
  assert.equal(L.grey, '#aabbcc'); assert.equal(L.grey2, DARK.grey2);
  assert.equal(L.bandFinish, DARK.bandFinish); assert.equal(L.tiersFinish, 'hatched');
  assert.equal(L.pits, 0.1235); assert.equal(L.edgeWide, DARK.edgeWide);
  assert.ok(!('colourOfMagic' in L) && Object.keys(L).length === SETTINGS.length);
  // nothing, nonsense, a list, broken text: the first ready-made look
  for (const junk of [null, undefined, 7, 'hello', '{"grey": ', [], '[1,2]', NaN]) assert.deepEqual(readLook(junk), DARK);
  // a part of a look is filled in from whatever base is given
  const old = HULL_LOOKS['old and worn'], part = readLook({ grey: '#101010' }, old);
  assert.equal(part.grey, '#101010'); assert.equal(part.lap, old.lap); assert.equal(part.tiersFinish, 'tempered');
  // a number never comes back outside its range, whatever goes in
  for (const s of SETTINGS.filter((x) => x.kind === 'number')) for (const v of [-1e9, 1e9, s.min - 0.001, s.max + 0.001, Infinity, -Infinity, '12abc', {}, true]) {
    const r = readSetting(s, v); assert.ok(typeof r === 'number' && r >= s.min && r <= s.max, s.key + ' ' + String(v));
  }
  assert.equal(readColour('#FFF'), '#ffffff'); assert.equal(readColour('1a2B3c'), '#1a2b3c'); assert.equal(readColour('#12345'), null); assert.equal(readColour(0x123456), null);
});

test('a look written as text reads back the same, with words round it or not', () => {
  for (const n of LOOK_NAMES) {
    const t = writeLook(HULL_LOOKS[n]);
    assert.ok(isLookText(t) && t.startsWith('{"hull look":1,'));
    const o = JSON.parse(t); for (const s of SETTINGS) assert.ok(s.key in o, s.key);
    assert.deepEqual(readLook(t), HULL_LOOKS[n]);
    assert.deepEqual(readLook('Here you go:\n' + t + '\nthanks!'), HULL_LOOKS[n]);
    assert.ok(t.split('\n').length >= 8 && t.split('\n').every((l) => l.length < 200), 'a line a window of settings, none too long to read');
  }
  // any look at all, made of in-range values
  let seed = 5; const R = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 40; i++) {
    const L = {}; for (const s of SETTINGS) L[s.key] = s.kind === 'number' ? s.min + (s.max - s.min) * R() : s.kind === 'choice' ? s.options[Math.floor(R() * s.options.length)] : '#' + Math.floor(R() * 0xffffff).toString(16).padStart(6, '0');
    const a = readLook(L), b = readLook(writeLook(a)); assert.deepEqual(b, a); assert.ok(sameLook(a, b));
  }
  assert.ok(!isLookText('') && !isLookText('{}') && !isLookText('{"other":1}') && !isLookText('grey: #fff') && isLookText('{"grey":"#fff"}'));
  assert.equal(lookName(readLook({ grey: '#000000' })), null);
});

test('a setting is shown as a plain number with its unit', () => {
  assert.equal(showValue(SETTING.plateW, 6.4), '6.4 m'); assert.equal(showValue(SETTING.plateW, 7), '7 m'); assert.equal(showValue(SETTING.bevel, 0.18), '18 cm'); assert.equal(showValue(SETTING.gap, 0.065), '6.5 cm');
  assert.equal(showValue(SETTING.pits, 0.15), '15%'); assert.equal(showValue(SETTING.bandAngle, 45), '45°'); assert.equal(showValue(SETTING.windowBright, 1.5), '1.5'); assert.equal(showValue(SETTING.cut, 0.45), '45 cm');
  assert.deepEqual(plateSizes(DARK), { w: 7, h: 3, lap: 0, bevel: 0.35, gap: 0.05, cut: 0.45, shift: 0, uneven: 0.6, unevenRows: 0.6 });
});

// ── the outline and flat shapes ─────────────────────────────────────────────────────────────────────────────────
test('an outline moved out: the outside is on the right, corners are mitred, a piece\'s ends stay on their cuts', () => {
  // walking toward -z, the outside is +x
  assert.deepEqual(offsetPath([[0, 10], [0, 0]], 2), [[2, 10], [2, 0]]);
  assert.deepEqual(offsetPath([[0, 10], [0, 0]], -3), [[-3, 10], [-3, 0]]);
  // a right-angle corner: the corner point moves out both ways at once
  const p = offsetPath([[0, 10], [0, 0], [-10, 0]], 1);
  assert.ok(near(p[0][0], 1) && near(p[0][1], 10) && near(p[1][0], 1) && near(p[1][1], -1) && near(p[2][0], -10) && near(p[2][1], -1));
  // a whole square, walked with the outside on the right, grows by the offset on every side
  const sq = offsetPath([[0, 0], [0, -4], [-4, -4], [-4, 0]], 0.5, true);
  assert.deepEqual(sq.map((q) => q.map((v) => +v.toFixed(6))), [[0.5, 0.5], [0.5, -4.5], [-4.5, -4.5], [-4.5, 0.5]]);
  // the sample's outline: its first end stays on the plane it is cut at (z = 15.5), its last on x = -24
  for (const o of [-16, -8.5, -3.5, 0]) { const q = offsetPath(SAMPLE.path, o); assert.ok(near(q[0][1], 15.5) && near(q[3][0], -24), 'offset ' + o); }
});

test('a shape with its sides moved in', () => {
  assert.deepEqual(insetPoly([[0, 0], [4, 0], [4, 2], [0, 2]], 0.5), [[0.5, 0.5], [3.5, 0.5], [3.5, 1.5], [0.5, 1.5]]);
  assert.deepEqual(insetPoly([[0, 0], [4, 0], [4, 2], [0, 2]], [0, 1, 0.5, 0]), [[0, 0], [3, 0], [3, 1.5], [0, 1.5]]);
});

// ── laying plates ───────────────────────────────────────────────────────────────────────────────────────────────
const WALL = { quad: [[0, 0], [12, 0], [12, 6], [0, 6]], kinds: [INSIDE, SEAM, SEAM, SEAM] };
const widths = (pl) => pl.quad[1][0] - pl.quad[0][0], heights = (pl) => pl.quad[3][1] - pl.quad[0][1];

test('plates are fitted to a wall in rows: a whole number of them, the sizes asked for', () => {
  const P = layPlates(WALL, { w: 3, h: 2, lap: 0, shift: 0, uneven: 0 });
  assert.equal(P.length, 12);
  for (const pl of P) assert.ok(near(widths(pl), 3) && near(heights(pl), 2));
  assert.deepEqual([...new Set(P.map((pl) => pl.row))], [0, 1, 2]);
  // sizes that do not divide the wall are fitted: 12 m by 6 m in plates near 3.4 by 2.3 is still 4 by 3 (3 by 2 each)
  const Q = layPlates(WALL, { w: 3.4, h: 2.3, lap: 0, shift: 0, uneven: 0 });
  assert.equal(Q.length, 12); for (const pl of Q) assert.ok(near(widths(pl), 3) && near(heights(pl), 2));
  // only the wall's own foot is in the inside corner; seams everywhere else
  for (const pl of P) assert.deepEqual(pl.kinds, [pl.row === 0 ? INSIDE : SEAM, SEAM, SEAM, SEAM]);
  // bigger plates than the wall: one plate
  assert.equal(layPlates(WALL, { w: 40, h: 40, lap: 0, shift: 0.5, uneven: 1 }).length, 1);
});

test('every other row is slid along; uneven rows keep their length and no plate is a sliver', () => {
  const P = layPlates(WALL, { w: 3, h: 2, lap: 0, shift: 0.5, uneven: 0 }), row = (r) => P.filter((pl) => pl.row === r);
  assert.deepEqual([row(0).length, row(1).length, row(2).length], [4, 5, 4]);
  assert.deepEqual(row(1).map((pl) => +widths(pl).toFixed(6)), [1.5, 3, 3, 3, 1.5]);
  for (const uneven of [0.3, 0.7, 1]) for (const salt of [1, 2, 3, 99]) {
    const U = layPlates(WALL, { w: 3, h: 2, lap: 0, shift: 0.5, uneven }, salt);
    for (const r of [0, 1, 2]) {
      const ws = U.filter((pl) => pl.row === r).map(widths);
      assert.ok(near(ws.reduce((a, b) => a + b, 0), 12, 1e-9), 'the row is still 12 m');
      assert.ok(Math.min(...ws) >= 0.3 * 3 - 1e-9, 'no plate under a third of a plate wide: ' + Math.min(...ws));
    }
    if (uneven > 0.5) assert.ok(new Set(U.filter((pl) => pl.row === 0).map((pl) => widths(pl).toFixed(3))).size > 1, 'the widths differ');
    assert.deepEqual(layPlates(WALL, { w: 3, h: 2, lap: 0, shift: 0.5, uneven }, salt), U, 'the same wall lays the same way every time');
  }
});

test('uneven heights: the rows still fill the wall, none a sliver, and rows keep their heights from part to part', () => {
  for (const unevenRows of [0.3, 0.6, 1]) for (const salt of [1, 7, 40]) {
    const P = layPlates(WALL, { w: 3, h: 2, lap: 0, shift: 0, uneven: 0, unevenRows }, salt), hs = [0, 1, 2].map((r) => heights(P.find((pl) => pl.row === r)));
    assert.ok(near(hs[0] + hs[1] + hs[2], 6, 1e-9), 'three rows are still 6 m');
    assert.ok(Math.min(...hs) > 2 * 0.5 && Math.max(...hs) < 2 * 1.6, 'no row under half or over one and a half times the even height: ' + hs);
    for (const pl of P) assert.ok(near(heights(pl), hs[pl.row]), 'every plate of a row is the row\'s height');
    if (unevenRows >= 0.6) assert.ok(Math.max(...hs) - Math.min(...hs) > 0.1, 'the heights differ');
    // a narrower part of the same wall, given the same row number, has the same rows (so rows carry on past a door)
    const Q = layPlates({ quad: [[0, 0], [3, 0], [3, 6], [0, 6]], kinds: WALL.kinds }, { w: 3, h: 2, lap: 0, shift: 0, uneven: 0, unevenRows }, salt + 99, salt);
    assert.deepEqual(Q.map(heights), hs);
  }
});

test('a lapped row reaches down over the row below by the lap', () => {
  const P = layPlates(WALL, { w: 3, h: 2, lap: 0.4, shift: 0, uneven: 0 });
  for (const pl of P) {
    assert.ok(near(pl.quad[3][1], (pl.row + 1) * 2), 'tops where they were');
    assert.ok(near(pl.quad[0][1], pl.row === 0 ? 0 : pl.row * 2 - 0.4), 'feet lower by the lap, but for the lowest row');
    assert.equal(pl.lap, pl.row === 0 ? 0 : 0.4);
  }
  // a lap is never most of a row
  assert.ok(layPlates(WALL, { w: 3, h: 2, lap: 5, shift: 0, uneven: 0 }).every((pl) => pl.lap <= 1.2 + 1e-9));
});

test('a strip with slanted ends is filled to its ends, every plate inside it', () => {
  const part = { quad: [[0, 0], [16, 0], [15, 2.8], [-1.5, 2.8]], kinds: [SEAM, SEAM, SEAM, SEAM] };
  const P = layPlates(part, { w: 4, h: 3, lap: 0, shift: 0.5, uneven: 0.6 }, 4);
  assert.ok(P.length >= 3);
  assert.ok(near(P[0].quad[0][0], 0) && near(P[0].quad[3][0], -1.5) && near(P[P.length - 1].quad[1][0], 16) && near(P[P.length - 1].quad[2][0], 15));
  for (let i = 1; i < P.length; i++) assert.ok(near(P[i].quad[0][0], P[i - 1].quad[1][0]) && near(P[i].quad[3][0], P[i - 1].quad[2][0]), 'neighbours share their seam');
});

// ── the whole hull as numbers ───────────────────────────────────────────────────────────────────────────────────
// a bare wall 12 m long and 6 m tall, facing +x, for counting
const BARE = { closed: false, path: [[0, 12], [0, 0]], tiers: [{ name: 'wall', profile: [[0, 0], [0, 6]], parts: [{ group: 'band', kind: 'plates' }] }] };
const SIZES = { w: 3, h: 2, lap: 0, bevel: 0.2, gap: 0.1, shift: 0, uneven: 0 };
// the flat tops of a group's plates: each facet that faces straight out of a +x wall, as [z0, z1, y0, y1, x]
function tops(g) {
  const out = [];
  for (let v = 0; v < g.position.length / 3; v += 4) {
    if (g.normal[v * 3] < 0.999 || g.tone[v * 4 + 2] < 0.99) continue;
    const zs = [0, 1, 2, 3].map((k) => g.position[(v + k) * 3 + 2]), ys = [0, 1, 2, 3].map((k) => g.position[(v + k) * 3 + 1]);
    out.push([Math.min(...zs), Math.max(...zs), Math.min(...ys), Math.max(...ys), g.position[v * 3]]);
  }
  return out;
}

test('a bare wall: twelve plates, ten triangles each, each top smaller than its plate by the gap and two bevels', () => {
  const A = hullArrays(BARE, SIZES), g = A.groups.band;
  assert.equal(A.stats.strips, 1); assert.equal(g.plates, 12); assert.equal(A.stats.plates.all, 12);
  assert.equal(g.triangles, 12 * 10, 'a flat top (2) and four bevels (8)');
  assert.equal(A.groups.trim.triangles, 2, 'the dark backing behind the seams: one face');
  assert.equal(A.stats.triangles.all, 122);
  const T = tops(g); assert.equal(T.length, 12);
  for (const [z0, z1, y0, y1, x] of T) {
    assert.ok(near(z1 - z0, 3 - 0.1 - 2 * 0.2, 1e-5) && near(y1 - y0, 2 - 0.1 - 2 * 0.2, 1e-5), `a top is 2.5 by 1.5: ${z1 - z0} by ${y1 - y0}`);
    assert.ok(near(x, 0.2, 1e-6), 'and stands the bevel\'s depth off the backing');
  }
  // the seam between two tops: the gap and the two bevels
  const zs = [...new Set(T.map((t) => t[0].toFixed(4)))].map(Number).sort((a, b) => a - b);
  assert.ok(near(zs[1] - zs[0], 3, 1e-5));
  // nothing is drawn outside the wall
  for (let i = 0; i < g.position.length; i += 3) assert.ok(g.position[i] >= -1e-6 && g.position[i] <= 0.2 + 1e-6 && g.position[i + 1] >= -1e-6 && g.position[i + 1] <= 6 + 1e-6 && g.position[i + 2] >= -1e-6 && g.position[i + 2] <= 12 + 1e-6);
});

test('cut corners: a plate becomes an octagon, 22 triangles, its corners cut back by what was asked', () => {
  const A = hullArrays(BARE, { ...SIZES, cut: 0.5 }), g = A.groups.band;
  assert.equal(g.plates, 12); assert.equal(g.triangles, 12 * 22, 'an eight-sided top (6) and eight bevels (16)');
  // every corner of every plate carries the cut, and none of a plate's own corners is left square: no point of a plate
  // lies inside the corner triangle that was cut away
  let seen = 0;
  for (let v = 0; v < g.position.length / 3; v++) {
    assert.ok(near(g.cut[v], 0.5, 1e-6));
    const e = [0, 1, 2, 3].map((k) => g.edge[v * 4 + k]);
    for (let k = 0; k < 4; k++) assert.ok(e[k] + e[(k + 1) % 4] >= 0.5 - 1e-5, 'a point inside a cut corner: ' + e);
    if (near(e[0] + e[1], 0.5, 1e-5)) seen++;
  }
  assert.ok(seen >= 12 * 2, 'the cuts are there');
  // the flat top's own corners are cut by a little less (its sides came in by the bevel): 0.5 less 0.2 x (2 - sqrt 2)
  const topCut = 0.5 - 0.2 * (2 - Math.SQRT2);
  let tops8 = 0;
  for (let v = 0; v < g.position.length / 3; v++) if (g.normal[v * 3] > 0.999 && near(g.position[v * 3], 0.2, 1e-6)) {
    const e = [0, 1, 2, 3].map((k) => g.edge[v * 4 + k] - 0.2).sort((a, b) => a - b);        // (past the bevel, from each side)
    assert.ok(near(e[0], 0, 1e-5) && near(e[1], topCut, 1e-4), 'a top corner sits on one side and ' + topCut + ' along from the next: ' + e); tops8++;
  }
  assert.equal(tops8, 12 * 8);
  // a cut too big for its plate is brought down to fit; a plate with a slanted end keeps its corners
  const B = hullArrays(BARE, { ...SIZES, cut: 9 }); assert.equal(B.groups.band.triangles, 12 * 22);
  for (const c of B.groups.band.cut) assert.ok(c <= 0.3 * 1.9 + 1e-6);
});

test('a bare wall, lapped: the rows above the first are tilted and stand clear of the row below', () => {
  const A = hullArrays(BARE, { ...SIZES, lap: 0.4 }), g = A.groups.band;
  assert.equal(g.plates, 12);
  assert.equal(g.triangles, 4 * 10 + 8 * 14, 'a lapped plate has a wall under its lifted edge: four more triangles');
  // the highest point of the first row's tops is under the lowest point of the second row's lifted foot where they overlap
  let low = Infinity;                                 // (the second row's foot: the lowest corners of its plates, y just under 2)
  for (let i = 0; i < g.position.length; i += 3) if (g.position[i + 1] > 1.55 && g.position[i + 1] < 1.72 && g.position[i] > 0.01) low = Math.min(low, g.position[i]);
  assert.ok(low > 0.2 + 0.005, 'the lifted foot (' + low + ' m out) clears the top of the row below (0.2 m out)');
  assert.ok(low < 0.2 * 2.4 / 2 + 0.05, 'by a little, not a lot');
});

test('nothing on a wall faces into it: flush, lapped, or a row of windows', () => {
  const WINDOWS = { ...BARE, tiers: [{ name: 'wall', profile: [[0, 0], [0, 3]], parts: [{ group: 'trim', kind: 'windows' }] }] };
  for (const [plan, sizes] of [[BARE, SIZES], [BARE, { ...SIZES, lap: 0.4 }], [BARE, { ...SIZES, shift: 0.5, uneven: 1 }], [WINDOWS, SIZES]]) {
    const A = hullArrays(plan, sizes);
    for (const g of Object.values(A.groups)) {
      for (let i = 0; i < g.normal.length; i += 3) assert.ok(g.normal[i] >= -1e-6, 'a facet turned its back: ' + g.normal[i]);
      // and every triangle is wound the way its normal looks
      for (let t = 0; t < g.index.length; t += 3) {
        const [a, b, c] = [0, 1, 2].map((k) => [0, 1, 2].map((d) => g.position[g.index[t + k] * 3 + d]));
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const i0 = g.index[t] * 3; assert.ok(n[0] * g.normal[i0] + n[1] * g.normal[i0 + 1] + n[2] * g.normal[i0 + 2] > 0, 'a triangle wound backwards');
      }
    }
    if (plan === WINDOWS) {
      // three frames in a 12 m row (one every 4.2 m is fitted to one every 4), the third blank: two windows of two panes
      // each, facing out, sunk into their frames but in front of the wall
      assert.equal(A.stats.windows, 2); assert.equal(A.stats.panes, 4);
      const w = A.windows.position; for (let i = 0; i < w.length; i += 3) assert.ok(w[i] > 0.02 && w[i] < 0.3, 'a pane ' + w[i] + ' m off the wall');
      assert.ok(A.groups.trim.plates >= 3 + 2, 'the frames, and a lip above and below');
    }
  }
});

test('no bevel, no gap: flat plates edge to edge, two triangles each', () => {
  const A = hullArrays(BARE, { ...SIZES, bevel: 0, gap: 0 });
  assert.equal(A.groups.band.plates, 12); assert.equal(A.groups.band.triangles, 24);
  // a bevel too wide for its plate is cut down to fit
  const B = hullArrays(BARE, { ...SIZES, bevel: 5 });
  for (const [z0, z1, y0, y1] of tops(B.groups.band)) assert.ok(z1 - z0 > 0.5 && y1 - y0 > 0.5);
});

test('the lab\'s sample: its strips face the right way and know their inside corners', () => {
  const S = hullStrips(SAMPLE), find = (tier, step, run) => S.find((s) => s.tier === tier && s.step === step && s.run === run);
  assert.equal(S.length, 51, 'five tiers: 17 steps drawn, by three runs of the outline');
  const wall = find(2, 2, 0);
  assert.deepEqual(wall.N.map((v) => +v.toFixed(6)), [1, 0, 0], 'the door\'s wall faces +x');
  assert.deepEqual(wall.quad, [[0, 0], [30, 0], [30, 12], [0, 12]]);
  assert.deepEqual(find(2, 2, 2).N.map((v) => +v.toFixed(6)), [0, 0, -1], 'the end faces -z');
  assert.ok(find(2, 4, 0).N[1] > 0.999 && find(2, 0, 0).N[1] < -0.999, 'the middle band\'s ledge faces up, its underside down');
  const slope = find(2, 3, 0).N; assert.ok(near(slope[0], Math.SQRT1_2, 1e-6) && near(slope[1], Math.SQRT1_2, 1e-6), 'its upper bevel leans back at 45 degrees');
  // where a tier stands on the one below: the ledge's inner edge and the wall's foot are both in the inside corner
  assert.equal(find(2, 4, 0).kinds[2], INSIDE); assert.equal(find(3, 0, 0).kinds[0], INSIDE);
  assert.equal(find(1, 2, 0).kinds[2], INSIDE); assert.equal(find(2, 0, 0).kinds[0], INSIDE);
  assert.equal(wall.kinds.join(), [SEAM, SEAM, SEAM, SEAM].join(), 'an outside corner is no inside corner');
  for (const s of S) assert.ok(near(Math.hypot(...s.N), 1) && near(Math.hypot(...s.U), 1) && near(Math.hypot(...s.V), 1) && s.quad[3][1] > 0);
  // the upper and lower tiers' walls are the rows of windows; the middle band is all plates
  for (const s of S) assert.equal(s.kind, s.tier !== 2 && ((s.tier < 2 && s.step === 2) || (s.tier > 2 && s.step === 0)) ? 'windows' : 'plates');
});

test('the lab\'s sample, in each ready-made look: sound lists of numbers, inside its box, few triangles', () => {
  for (const n of LOOK_NAMES) {
    const A = hullArrays(SAMPLE, plateSizes(HULL_LOOKS[n]));
    let tris = 0;
    for (const [k, g] of Object.entries(A.groups)) {
      const verts = g.position.length / 3;
      assert.ok(verts > 0 && g.normal.length === verts * 3 && g.uv.length === verts * 2 && g.edge.length === verts * 4 && g.kind.length === verts * 4 && g.tone.length === verts * 4 && g.cut.length === verts, n + ' ' + k);
      assert.equal(g.index.length % 3, 0); assert.equal(g.triangles, g.index.length / 3); tris += g.triangles;
      for (const i of g.index) assert.ok(i < verts);
      for (let i = 0; i < verts; i++) {
        assert.ok(near(Math.hypot(g.normal[i * 3], g.normal[i * 3 + 1], g.normal[i * 3 + 2]), 1, 1e-4), 'unit normals');
        for (let a = 0; a < 3; a++) assert.ok(g.position[i * 3 + a] >= SAMPLE_BOX.min[a] - 0.5 && g.position[i * 3 + a] <= SAMPLE_BOX.max[a] + 0.5, `${n} ${k} corner ${i} inside the piece`);
        for (let a = 0; a < 4; a++) { assert.ok(g.edge[i * 4 + a] >= 0, 'distances to a plate\'s sides are never negative'); assert.ok(g.kind[i * 4 + a] === SEAM || g.kind[i * 4 + a] === INSIDE); }
        assert.ok(g.tone[i * 4] === 0 || g.tone[i * 4] === 1); assert.ok(Math.abs(g.tone[i * 4 + 1]) <= 1 && g.tone[i * 4 + 2] > 0 && g.tone[i * 4 + 2] <= 1 && g.tone[i * 4 + 3] >= 0 && g.tone[i * 4 + 3] <= 1 && g.cut[i] >= 0 && g.cut[i] <= 1.2);
      }
    }
    assert.equal(A.stats.triangles.all, tris + A.stats.panes * 2 + A.stats.doors * 2);
    assert.equal(A.stats.plates.all, A.stats.plates.band + A.stats.plates.tiers + A.stats.plates.trim);
    assert.ok(A.stats.plates.band > 40 && A.stats.plates.tiers > 40 && A.stats.plates.trim > 40, n + ': all three groups have plates to look at');
    assert.ok(A.stats.triangles.all < 10000, n + ': the whole piece is under 10,000 triangles (' + A.stats.triangles.all + ')');
    // the same plan and sizes always give the same numbers
    assert.deepEqual(hullArrays(SAMPLE, plateSizes(HULL_LOOKS[n])).groups.band.position, A.groups.band.position);
  }
});

test('the lab\'s sample: one door 22 m by 9 m with a shield across it; windows in twos and threes, two panes each', () => {
  const A = hullArrays(SAMPLE, plateSizes(DARK)), s = A.shields.position;
  assert.equal(A.stats.doors, 1); assert.equal(s.length, 12);
  const zs = [2, 5, 8, 11].map((i) => s[i]), ys = [1, 4, 7, 10].map((i) => s[i]), xs = [0, 3, 6, 9].map((i) => s[i]);
  assert.ok(near(Math.max(...zs) - Math.min(...zs), DOOR.w, 1e-5) && near(Math.max(...ys) - Math.min(...ys), DOOR.h, 1e-5), 'the opening is 22 m by 9 m');
  assert.ok(near(Math.min(...ys), DOOR.sill, 1e-5) && near((Math.max(...zs) + Math.min(...zs)) / 2, DOOR.z, 1e-5), 'over its sill, its middle at z = 0');
  assert.ok(xs.every((x) => x > 0 && x < 0.45), 'the shield is in front of the wall and behind the frame\'s face');
  // nothing of the hull stands in the opening: no corner of any plate or backing, in any group
  for (const g of Object.values(A.groups)) for (let i = 0; i < g.position.length; i += 3) {
    const [x, y, z] = [g.position[i], g.position[i + 1], g.position[i + 2]];
    assert.ok(!(x > -0.5 && Math.abs(z) < DOOR.w / 2 - 1e-3 && y > DOOR.sill + 1e-3 && y < DOOR.sill + DOOR.h - 1e-3), `something in the doorway at ${x}, ${y}, ${z}`);
  }
  // the windows: each two panes side by side with a bar's width between, lit alike, the foot dimmer than the top
  const w = A.windows, W = SAMPLE.windows, n = A.stats.windows, pw = (W.w - W.bar) / 2;
  assert.ok(n >= 30 && n <= 46, n + ' windows'); assert.equal(A.stats.panes, n * 2); assert.equal(w.position.length, n * 2 * 12); assert.equal(w.shade.length, n * 2 * 4);
  const corner = (p, k) => [0, 1, 2].map((d) => w.position[(p * 4 + k) * 3 + d]), dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (let p = 0; p < n * 2; p++) {
    assert.ok(near(dist(corner(p, 0), corner(p, 1)), pw, 1e-4) && near(dist(corner(p, 0), corner(p, 3)), W.h, 1e-4), 'a pane is ' + pw + ' by ' + W.h);
    assert.ok(w.shade[p * 4] === w.shade[p * 4 + 1] && w.shade[p * 4 + 2] === w.shade[p * 4 + 3] && w.shade[p * 4] > 0 && w.shade[p * 4] < w.shade[p * 4 + 2] && w.shade[p * 4 + 2] <= 1, 'a pane\'s foot is dimmer than its top');
    if (p % 2) { assert.equal(w.shade[p * 4 + 2], w.shade[(p - 1) * 4 + 2], 'a window\'s two panes are lit alike'); assert.ok(near(dist(corner(p - 1, 1), corner(p, 0)), W.bar, 1e-4), 'with a bar\'s width between'); }
  }
  const lit = Array.from({ length: n }, (_, k) => w.shade[k * 8 + 2]);
  assert.ok(lit.filter((v) => v > 0.6).length >= n * 0.7 && new Set(lit.map((v) => v.toFixed(2))).size > 8, 'most are lit, no two rows alike');
  // on a long row, of every seven frames two are blank (windows in a two and a three)
  const ROW = { closed: false, path: [[0, 4.2 * 14], [0, 0]], tiers: [{ name: 'wall', profile: [[0, 0], [0, 3]], parts: [{ group: 'trim', kind: 'windows' }] }] };
  assert.equal(hullArrays(ROW, plateSizes(DARK)).stats.windows, 10);
  // the windows do not change when the plates do
  assert.equal(hullArrays(SAMPLE, plateSizes(HULL_LOOKS['old and worn'])).stats.windows, n);
});

test('smaller plates: more of them, and the triangles keep step (ten a plate)', () => {
  const flush = { ...plateSizes(DARK), cut: 0, lap: 0 }, big = hullArrays(SAMPLE, { ...flush, w: 8, h: 4 }), small = hullArrays(SAMPLE, { ...flush, w: 2, h: 1.2 });
  assert.ok(small.stats.plates.band > big.stats.plates.band * 4);
  for (const A of [big, small]) assert.ok(A.groups.band.triangles <= A.groups.band.plates * 10 && A.groups.band.triangles >= A.groups.band.plates * 10 - 4, 'flush plates with square corners are ten triangles each');
  // with their corners cut: 22 each, but for the ones with a slanted end, which keep their corners (10)
  const cut = hullArrays(SAMPLE, { ...flush, cut: 0.4 }); assert.ok(cut.groups.band.triangles <= cut.groups.band.plates * 22 && cut.groups.band.triangles > cut.groups.band.plates * 14);
  // the extremes of every plate slider still build
  for (const s of SETTINGS.filter((x) => x.win === 'plates')) for (const v of [s.min, s.max]) {
    const A = hullArrays(SAMPLE, plateSizes({ ...DARK, [s.key]: v }));
    assert.ok(A.stats.plates.all > 100 && A.stats.triangles.all < 150000, s.key + ' at ' + v + ': ' + A.stats.triangles.all + ' triangles');
    for (const g of Object.values(A.groups)) for (const x of g.position) assert.ok(Number.isFinite(x));
  }
});
