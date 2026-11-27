// THE KINDS OF PLANET the game can make. Each is a recipe: how its land is shaped (shape), what its ground is
// covered with (paint: bare rock, dust or soil, how much grows), its colours (palette, a little different for every
// seed), and what stands on it (cover: rocks, plants). A new kind is one more entry in KINDS; the game picks one
// for each seed (kindOf), or the caller asks for one by its id. Plain numbers, no THREE.
//
// The game's maker, 2026-11-20: "I was thinking that we could have a few different planet surfaces, like a cratered
// moon, and maybe some that are more interesting with assets from the terrain lab, although we could change the
// colors to make exotic looking plants." And of the planets: "A different one each run, made by the game", and
// "We can start with one and add more later ... But we should build for the possibility of multiple."
//
//   kind.shape(ctx)    writes the heights ctx.H (metres; src/planet/shapes.js has the building blocks)
//   kind.paint(ctx)    writes ctx.rock (0 dust or soil .. 1 bare rock), ctx.tone (-1 darker .. 1 brighter) and
//                      ctx.growth (0 bare .. 1 thick with plants) for each sample, once the landing place is flat
//   kind.palette(R, { familiar })   the colours, from the planet's own random numbers (sRGB, 0..1); sun: a direction
//                      toward the sun, or null for the game's own sky's sun (the moon is under the station's sky);
//                      familiar: Earth's colours this time (green plants, a blue sky: familiarOf below)
//   kind.cover         the rocks and plants (src/planet/cover.js); plants by their place in the Terrain Lab's sheet
//                      of sixteen (PLANTS below); trees (src/planet/trees.js), where kind.paint wrote ctx.woods (the
//                      chance a tree stands in each of the trees' cells, 0..1)
//
// THE COLOURS: mostly strange, now and then familiar. The game's maker, 2026-11-20 (PLAN1-4 B): "Mostly strange, but
// now and then familiar ones too (green plants, a blue sky)", and "I think that some planets can have exotic colors and
// some might look like Earth." So about one world with air in five (FAMILIAR) has Earth's colours; which ones is the
// seed's own, drawn apart from the rest of its colours, so a strange world's colours are the same as they always were.
import { fbm, ridged, smooth, subSeed, rng } from './noise.js';
import { addField, addArray, field, craterList, stampCraters, pick, blur } from './shapes.js';

// the Terrain Lab's sixteen ground plants, in the order of their sheet (assets/planet/groundPlants.glb), each with its
// height in metres as the Terrain Lab grows it (its KIND_INFO height times its own size: src/objects/growth.js in the
// jconra.com code) and whether it is lit by its own shape (the bigger ones) or like the ground
export const PLANTS = [
  ['tall seed grass', 1.8], ['feather grass', 1.75], ['broad-blade grass', 1.48], ['bunchgrass', 0.85],
  ['broad-leaf hosta', 0.36], ['wild strawberry', 0.4], ['dandelion', 0.67], ['yucca', 1.16, true],
  ['paintbrush', 0.58], ['snowdrops', 0.33], ['columbine', 0.88], ['violets', 0.28],
  ['cattails', 1.4, true], ['sprig shrub', 1.32, true], ['spruce sapling', 1.16, true], ['marsh marigold', 0.62],
].map(([name, height, lit = false], k) => ({ k, name, height, lit, flower: [5, 6, 8, 9, 10, 11, 15].includes(k) }));
// each model's root clump sinks this share of its height into the ground (the Terrain Lab's numbers)
export const PLANT_SINK = [0.06, 0.06, 0.06, 0.03, 0.04, 0.03, 0.03, 0.04, 0.03, 0.06, 0.03, 0.03, 0.04, 0.03, 0.03, 0.04];
// THE TREES: two of the Terrain Lab's (its Tree Lab's trees, the lighter "sparse" ones its phones get:
// assets/planet/oak.glb and pine.glb, about 1 MB each, loaded only for a world that has that tree), each with its
// height in metres as the Terrain Lab grows it (src/objects/forest.js FOREST_SPECIES). The game's maker, 2026-11-20
// (PLAN1-2 B): "One or two kinds of tree too, recoloured", and "You can probably use the same LOD system that the
// terrain lab has" (src/planet/trees.js). leaf: its leaves' picture's average colour (linear), for the woods seen from afar.
export const TREES = { oak: { file: 'oak', height: 18, leaf: [0.078, 0.138, 0.025] }, pine: { file: 'pine', height: 22, leaf: [0.093, 0.15, 0.019] } };
// about one world with air in five has Earth's colours (the seed's own draw: familiarOf)
export const FAMILIAR = 0.2;

// a colour from hue (degrees), saturation and lightness (0..1), as sRGB 0..1
export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
const mul = (c, k) => c.map((v, i) => Math.min(1, v * (Array.isArray(k) ? k[i] : k)));
const jit = (R, a) => (R() * 2 - 1) * a;
// a direction toward the sun from its height above the horizon and its bearing (degrees)
const sunDir = (el, az) => { const e = el * Math.PI / 180, a = az * Math.PI / 180; return [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)]; };
// a sample of a field at a point of the ground (nearest sample)
const at = (ctx, F, x, z) => { const { N, P, T } = ctx, i = Math.round((x + P / 2) / T) & (N - 1), j = Math.round((z + P / 2) / T) & (N - 1); return F[j * N + i]; };

// FOR MEASURING WHAT EACH LOOK COSTS (the rigs only: a page sets globalThis.PLANET_LOOK_OFF = { grit: true, ... }
// before a planet is made): 'shadows' the shadow picture, 'plantShadows' the plants', trees' and rocks' part in it,
// 'grit' the ground underfoot, 'clearing' plants and stones on the landing place, 'rocks' the rocks' own look
export const lookOff = (k) => !!(globalThis.PLANET_LOOK_OFF && globalThis.PLANET_LOOK_OFF[k]);

// THE CANYONS' DARK PATCHES on the sand and the slopes: how strong (two critics read them, at 0.7, as dark smudges and
// stains on the far hillsides that do not follow the sun); and how far the steps' cliffs are softened (samples: at two,
// tried for the rims' teeth seen from the ship, the land itself changed: the landing places moved, and G's came down on
// a bare stretch away from its plants; so one, as before)
export const CANYON_PATCH = 0.35, CANYON_SOFT = 1;
// THE MOON'S SHADE: how much light its shadows get, off the ringed planet (see the moon's palette)
export const MOON_SHADE = 0.38;
// THE MEADOWS' BARE EARTH: how ragged its edge is (see the meadow's paint)
export const MEADOW_RAGGED = 0.45;

// ── 1. THE CRATERED MOON ─────────────────────────────────────────────────────────────────────────────────────────
// No air: grey rock and dust, craters of every size from a few metres to a few hundred, the young ones sharp with
// bright rays and boulders round them, the old ones worn down; smooth dark plains in some, rough highlands. Black sky
// with the game's own sky things in it (the ringed planet, the nebulae, the stars: world/sky.js), its low sun.
const MOON = {
  id: 'moon', name: 'Cratered moon', air: false, weight: 1,
  about: 'No air: grey rock and dust, craters of many sizes, the game\'s own sky.',
  shape(ctx) {
    const s = ctx.seed, R = rng(subSeed(s, 'moon'));
    // the dark plains (old lava): smooth, low, fewer craters; how much of the ground they take is the seed's
    const plains = fbm({ cells: 2, n: 3, seed: subSeed(s, 'plains') }), line = -0.05 + 0.3 * R();
    ctx.mare = field(ctx, (u, v) => smooth(line - 0.06, line + 0.06, plains(u, v)), 8);
    const high = Float32Array.from(ctx.mare, (m) => 1 - m);
    // (the slow shapes worked out on a coarser grid and filled in smoothly; only the fine grain at every sample)
    addArray(ctx, field(ctx, fbm({ cells: 3, n: 4, seed: subSeed(s, 'roll') }), 4), 26);
    addArray(ctx, field(ctx, ridged({ cells: 5, n: 4, seed: subSeed(s, 'ridge') }), 2), 34 + 26 * R(), high);
    for (let k = 0; k < ctx.H.length; k++) ctx.H[k] -= ctx.mare[k] * 16;
    addField(ctx, fbm({ cells: 48, n: 3, seed: subSeed(s, 'grain') }), 1.4);
    const biggest = 140 + 260 * R();
    const list = craterList(ctx, { min: 3, max: biggest, cover: 0.42, seed: subSeed(s, 'craters'), keep: (x, z, r) => (r < 60 && at(ctx, ctx.mare, x, z) > 0.5 ? 0.4 : 1) });
    ctx.fresh = new Float32Array(ctx.H.length);
    stampCraters(ctx, list, ctx.fresh);
    ctx.craters = list.filter((c) => c.fresh && c.r >= 3).map(({ x, z, r }) => ({ x, z, r }));
    ctx.counts = { craters: list.length };
  },
  paint(ctx) {
    const { H, slope, fresh, mare, low } = ctx, grain = field(ctx, fbm({ cells: 24, n: 3, seed: subSeed(ctx.seed, 'dust') }), 2);
    for (let k = 0; k < H.length; k++) {
      const f = fresh[k];
      ctx.rock[k] = Math.min(1, smooth(0.5, 1.0, slope[k]) + 0.55 * smooth(0.5, 0.9, f) * smooth(0.25, 0.6, slope[k]));
      ctx.tone[k] = Math.max(-1, Math.min(1, -0.5 * mare[k] + 0.75 * f + 0.1 * grain[k] - 0.04 * Math.max(0, low[k] - H[k])));
      ctx.growth[k] = 0;
    }
  },
  palette(R) {   // (always the moon's own greys: it has no air, no plants, and the station's sky)
    const tint = pick(R,[[4, [1, 1, 1]], [2, [1.03, 1.0, 0.96]], [2, [0.96, 0.99, 1.04]], [1, [1.05, 1.0, 0.93]]]), b = 0.92 + 0.16 * R();
    return {
      dust: mul([0.5, 0.5, 0.5], mul(tint, b)), rock: mul([0.36, 0.36, 0.36], tint), bright: mul([0.72, 0.72, 0.71], tint), dark: mul([0.3, 0.3, 0.3], tint),
      sun: null, sunColor: [1.0, 0.98, 0.95], sunPower: 2.6,
      // no air, so the shadows are dark but for a little light off the ringed planet (from the game's sky, its +z): the
      // game's maker's "long, nearly black shadows" (PLAN1-1); nearly black, not empty (two critics: at 0.2 the shaded
      // ground was pure black, the player standing on nothing): the faintest grey of the craters and stones still seen;
      // a dark blue-grey light of its own (at 0.45 and blue the critics of round 1 saw navy; grey, round 3's saw dead
      // black, her shadow gone on it): about what main showed, a touch lighter, so a shadow can be seen on it
      ambient: { sky: [0.38, 0.44, 0.54], ground: [0.06, 0.06, 0.07], power: MOON_SHADE },
      air: null, exposure: 0.95,
    };
  },
  cover: {
    rocks: { many: 1.0, near: 'craters', colour: 'rock' },
    plants: [],
    trees: null,
  },
};

// ── 2. THE MEADOW WORLD ──────────────────────────────────────────────────────────────────────────────────────────
// Air: a coloured sky with clouds and haze, rolling hills with rocky crests, and the Terrain Lab's ground plants
// grown big and recoloured: grass in one colour, broad leaves taller than a person, stalks and spikes in others.
const MEADOW_LOOKS = [
  // leaves (the grass's hue and two more for the bigger plants), soil, sky overhead and at the horizon
  { leaves: [280, 315, 195], soil: [28, 0.22, 0.27], zenith: [200, 0.5, 0.42], horizon: [185, 0.32, 0.78], toward: [40, 0.55, 0.8] },
  { leaves: [190, 165, 330], soil: [20, 0.25, 0.26], zenith: [330, 0.35, 0.45], horizon: [20, 0.45, 0.8], toward: [35, 0.7, 0.78] },
  { leaves: [350, 20, 280], soil: [35, 0.2, 0.3], zenith: [160, 0.45, 0.38], horizon: [140, 0.25, 0.75], toward: [60, 0.55, 0.78] },
  { leaves: [215, 245, 30], soil: [30, 0.3, 0.28], zenith: [40, 0.4, 0.5], horizon: [45, 0.5, 0.8], toward: [25, 0.75, 0.75] },
  { leaves: [25, 45, 260], soil: [270, 0.12, 0.26], zenith: [265, 0.35, 0.4], horizon: [290, 0.25, 0.78], toward: [330, 0.45, 0.8] },
];
// the familiar one: Earth's (green leaves, as the plants' own pictures are; brown soil; a blue sky, pale at the horizon
// and warm toward the sun), the leaves as green as the plants are drawn, not made more vivid
// (the grass on the ground a softer green than the strange worlds' colours are, as a field is from the air)
const MEADOW_EARTH = { leaves: [100, 112, 104], soil: [30, 0.25, 0.27], zenith: [212, 0.55, 0.45], horizon: [205, 0.35, 0.82], toward: [40, 0.5, 0.85], vivid: [1.0, 1.05, 1.05], jitter: 5, grass: [-6, 0.32, 0.28, 0.36, 0.33] };
const MEADOW = {
  id: 'meadow', name: 'Meadow world', air: true, weight: 1,
  about: 'Air: a coloured sky and haze, rolling hills, woods, the Terrain Lab\'s plants and trees in strange colours, some plants grown big.',
  aboutEarth: 'Air: a blue sky and haze, rolling hills, woods, the Terrain Lab\'s plants and trees, green, some plants grown big.',
  shape(ctx) {
    const s = ctx.seed, R = rng(subSeed(s, 'meadow'));
    const wa = fbm({ cells: 2, n: 3, seed: subSeed(s, 'wa') }), wb = fbm({ cells: 2, n: 3, seed: subSeed(s, 'wb') });
    const hills = { cells: 3, n: 6, gain: 0.47, seed: subSeed(s, 'hills') }, lo = fbm({ ...hills, upTo: 24 }), hi = fbm({ ...hills, from: 48 });
    const crest = ridged({ cells: 6, n: 4, seed: subSeed(s, 'crest') });
    const where = fbm({ cells: 2, n: 2, seed: subSeed(s, 'where') }), tall = 60 + 50 * R(), sharp = 18 + 22 * R();
    const qu = (u, v) => u + 0.1 * wa(u, v), qv = (u, v) => v + 0.1 * wb(u, v);
    // the hills' slow layers and the crests on coarse grids, then the fine layers of the hills at every sample
    addArray(ctx, field(ctx, (u, v) => lo(qu(u, v), qv(u, v)), 4), tall);
    ctx.crest = field(ctx, (u, v) => crest(qu(u, v), qv(u, v)) * smooth(-0.15, 0.35, where(u, v)), 2);
    addArray(ctx, ctx.crest, sharp);
    const A = field(ctx, wa, 8), B = field(ctx, wb, 8), { N, H } = ctx;
    for (let j = 0, k = 0; j < N; j++) for (let i = 0; i < N; i++, k++) H[k] += hi(i / N + 0.1 * A[k], j / N + 0.1 * B[k]) * tall;
    addField(ctx, fbm({ cells: 64, n: 3, seed: subSeed(s, 'fine') }), 0.7);
  },
  paint(ctx) {
    const { slope, crest, H, low } = ctx, patch = field(ctx, fbm({ cells: 10, n: 3, seed: subSeed(ctx.seed, 'patch') }), 4), bare = field(ctx, fbm({ cells: 6, n: 3, seed: subSeed(ctx.seed, 'bare') }), 4), ragged = field(ctx, fbm({ cells: 48, n: 3, seed: subSeed(ctx.seed, 'ragged') }), 2);
    for (let k = 0; k < H.length; k++) {
      const rk = Math.min(1, smooth(0.55, 1.0, slope[k]) + smooth(0.55, 0.8, crest[k]) * 0.9);
      ctx.rock[k] = rk;
      ctx.tone[k] = Math.max(-1, Math.min(1, patch[k] * 1.4 + 0.03 * (H[k] - low[k])));
      // (the bare earth's edge ragged, in tongues and islands: smooth, the big bare patches lay like spilled paint in the
      // land seen from the ship, two critics: D's lilac pools)
      ctx.growth[k] = (1 - rk) * (1 - smooth(0.3, 0.65, slope[k])) * smooth(-0.45, 0.1, bare[k] + MEADOW_RAGGED * ragged[k]);
    }
    // THE WOODS: where a slow noise is high, a wood (a tree in nearly every one of the trees' cells), and here and there
    // a tree on its own in the open; only where plants grow (not on rock, nor steep ground). How much of the land is
    // wooded is the seed's: from a few copses to woods over half the grass
    const R = rng(subSeed(ctx.seed, 'woods')), line = -0.12 + 0.28 * R(), woods = field(ctx, fbm({ cells: 5, n: 3, seed: subSeed(ctx.seed, 'woods') }), 4);
    // (from the growth as it was before its edge was ragged: the trees, and so where the wreck lies, as before for every seed)
    for (let k = 0; k < H.length; k++) ctx.woods[k] = (1 - ctx.rock[k]) * (1 - smooth(0.3, 0.65, slope[k])) * smooth(-0.45, 0.1, bare[k]) * (0.025 + 0.85 * smooth(line, line + 0.1, woods[k]));
  },
  palette(R, { familiar = false } = {}) {
    // (the strange looks drawn for every seed, so a familiar one takes nothing from the rest of its colours' numbers)
    const strange = MEADOW_LOOKS[Math.floor(R() * MEADOW_LOOKS.length)], L = familiar ? MEADOW_EARTH : strange, hj = jit(R, L.jitter || 14);
    const leaf = L.leaves.map((h) => h + hj + jit(R, familiar ? 4 : 8));
    const el = 24 + 30 * R(), az = R() * 360, vivid = L.vivid || [1.25, 1.35, 1.4];
    const [gh, gs, gl, gs2, gl2] = L.grass || [0, 0.42, 0.3, 0.5, 0.36];   // the grass's colours: hue from the leaves', saturation and lightness of the two
    return {
      familiar,
      dust: hsl(L.soil[0], L.soil[1], L.soil[2] + 0.06), rock: hsl(L.soil[0] + 10, 0.08, 0.36), bright: hsl(L.soil[0], L.soil[1], 0.5), dark: hsl(L.soil[0], L.soil[1], 0.18),
      grass: hsl(leaf[0] + gh, gs, gl), grass2: hsl(leaf[0] + gh + 22, gs2, gl2),
      leaves: leaf.map((h, n) => ({ hue: h, sat: vivid[n], light: (familiar ? [0.95, 1.0, 1.0] : [0.95, 1.05, 1.1])[n] })),
      sun: sunDir(el, az), sunColor: [1.0, 0.96, 0.9], sunPower: 2.0,
      ambient: { sky: hsl(L.zenith[0], L.zenith[1] * 0.8, 0.62), ground: hsl(L.soil[0], 0.2, 0.25), power: 0.75 },
      air: { zenith: hsl(...L.zenith), horizon: hsl(...L.horizon), toward: hsl(...L.toward), glow: hsl(L.toward[0], 0.6, 0.35), cloud: hsl(L.horizon[0], 0.15, 0.92), clouds: 0.25 + 0.3 * R(), haze: 0.0003 + 0.00018 * R(), thin: 380 },
      exposure: 0.95,
    };
  },
  cover: {
    rocks: { many: 0.35, near: 'rock', colour: 'rock' },
    // which plants (by their place in PLANTS), how big (times the Terrain Lab's size), their colour (which of the
    // palette's leaves), how many (share), where (grass: anywhere it grows; clumps: in bunches; loner: one here and there);
    // far: the big ones, seen further off. (The close ones are the sheet's lightest, 300 triangles each.)
    plants: [
      { k: 3, size: 1.5, leaf: 0, share: 0.5, how: 'grass' },
      { k: 0, size: 0.9, leaf: 0, share: 0.25, how: 'grass' },
      { k: 9, size: 2.2, leaf: 2, share: 0.25, how: 'clump' },
      { k: 4, size: 5.5, leaf: 1, share: 0.3, how: 'clump', far: true },
      { k: 12, size: 2.3, leaf: 2, share: 0.25, how: 'clump', far: true },
      { k: 7, size: 2.2, leaf: 1, share: 0.3, how: 'loner', far: true },
      { k: 13, size: 2.0, leaf: 0, share: 0.15, how: 'loner', far: true },
    ],
    // the trees: which (TREES), how big (times the Terrain Lab's height), their colour (which of the palette's leaves),
    // how many of each (share: how much of each the seed picks, from..to); cell: one tree at most in each square of
    // this many metres (woods: ctx.woods the chance); crown: how much of its cell a tree's crown covers, seen from afar
    trees: { cell: 11, crown: 1.0, kinds: [
      { tree: 'oak', size: 1.0, leaf: 1, share: [0.2, 1] },
      { tree: 'pine', size: 1.0, leaf: 2, share: [0.2, 1] },
    ] },
  },
};

// ── 3. THE CANYON WORLD ──────────────────────────────────────────────────────────────────────────────────────────
// Air: a dusty coloured sky, flat-topped mesas in steps with sheer banded cliffs, sand and dunes in the canyons
// between them, and here and there a big strange plant (the Terrain Lab's yucca and sapling grown tall).
const CANYON_LOOKS = [
  // the rock of the cliffs and the sand between (hue, saturation, lightness), the plants' two colours, the sky
  { rock: [12, 0.5, 0.4], sand: [24, 0.5, 0.6], leaves: [175, 200], zenith: [205, 0.4, 0.5], horizon: [25, 0.35, 0.8], toward: [30, 0.6, 0.82] },
  { rock: [285, 0.3, 0.38], sand: [300, 0.25, 0.6], leaves: [60, 25], zenith: [235, 0.35, 0.42], horizon: [300, 0.25, 0.78], toward: [340, 0.45, 0.8] },
  { rock: [30, 0.5, 0.42], sand: [40, 0.5, 0.62], leaves: [300, 330], zenith: [180, 0.35, 0.5], horizon: [190, 0.25, 0.82], toward: [45, 0.55, 0.85] },
  { rock: [175, 0.3, 0.36], sand: [165, 0.25, 0.6], leaves: [15, 340], zenith: [15, 0.35, 0.45], horizon: [25, 0.4, 0.78], toward: [35, 0.65, 0.8] },
  { rock: [345, 0.38, 0.44], sand: [15, 0.38, 0.64], leaves: [140, 190], zenith: [250, 0.3, 0.45], horizon: [330, 0.25, 0.8], toward: [20, 0.55, 0.82] },
];
// the familiar one: Earth's desert canyons (red rock, tan sand, sage and dark green plants under a blue sky)
const CANYON_EARTH = { rock: [14, 0.48, 0.42], sand: [28, 0.45, 0.62], leaves: [92, 110], zenith: [210, 0.5, 0.48], horizon: [200, 0.3, 0.82], toward: [35, 0.55, 0.85], vivid: 1.0, jitter: 5 };
const CANYON = {
  id: 'canyon', name: 'Canyon world', air: true, weight: 1,
  about: 'Air: a dusty sky, flat-topped mesas with banded cliffs, sand and dunes between them, a few trees and tall strange plants.',
  aboutEarth: 'Air: a blue sky, red mesas with banded cliffs, sand and dunes between them, a few trees and tall plants, green.',
  shape(ctx) {
    const s = ctx.seed, R = rng(subSeed(s, 'canyon'));
    const wa = fbm({ cells: 3, n: 3, seed: subSeed(s, 'wa') }), wb = fbm({ cells: 3, n: 3, seed: subSeed(s, 'wb') });
    const B0 = { cells: 2, n: 6, gain: 0.5, seed: subSeed(s, 'base') }, lo = fbm({ ...B0, upTo: 16 }), hi = fbm({ ...B0, from: 32 });
    const cut = fbm({ cells: 3, n: 3, gain: 0.45, seed: subSeed(s, 'cut') });
    const rough = fbm({ cells: 40, n: 2, seed: subSeed(s, 'rough') }), wiggle = field(ctx, fbm({ cells: 9, n: 2, seed: subSeed(s, 'wiggle') }), 4);
    const steps = 4 + Math.floor(R() * 3), stepH = 24 + 16 * R(), width = 0.05 + 0.04 * R(), duneA = R() * Math.PI, duneK = 70 + Math.floor(R() * 50);
    const ka = Math.round(duneK * Math.cos(duneA)), kb = Math.round(duneK * Math.sin(duneA));   // (whole numbers of dunes across, so they repeat too)
    // the slow layers of the land and the canyons' winding lines on coarse grids; the fine layer, the steps and the
    // dunes at every sample
    const A = field(ctx, wa, 8), B = field(ctx, wb, 8), qu = (u, v) => u + 0.06 * wa(u, v), qv = (u, v) => v + 0.06 * wb(u, v);
    const base = field(ctx, (u, v) => lo(qu(u, v), qv(u, v)), 4);
    // THE CANYONS: where a slow noise crosses zero, a winding line; cut down through the steps there, narrow at the
    // bottom and widening up the walls
    const canyon = field(ctx, (u, v) => 1 - smooth(0, width, Math.abs(cut(qu(u, v), qv(u, v)))), 2);
    const { N, H } = ctx; ctx.floor = new Float32Array(H.length);
    for (let j = 0, k = 0; j < N; j++) for (let i = 0; i < N; i++, k++) {
      const u = i / N, v = j / N, b = base[k] + hi(u + 0.06 * A[k], v + 0.06 * B[k]);
      // the mesas: the land in steps, a flat top and then a cliff up to the next
      let t = (b + 0.55) / 1.1 * steps - canyon[k] * 2.6;
      t = Math.max(0, t);
      const f = Math.floor(t), r = t - f, lift = f + smooth(0.5, 0.9, r + rough(u, v) * 0.06);
      const floor = 1 - smooth(0.0, 0.3, t);                              // the canyons' and the low plains' floors
      ctx.floor[k] = floor;
      const dune = (Math.sin((u * ka + v * kb) * Math.PI * 2 + wiggle[k] * 4) * 0.5 + 0.5) ** 2;
      H[k] = lift * stepH + t * 2.5 + floor * dune * 2.2;
    }
    // (the steps softened over a few metres, so a cliff is never narrower than the samples it is drawn from: no saw
    // teeth along the rims)
    ctx.H.set(blur(H, N, CANYON_SOFT, 2));
    addField(ctx, fbm({ cells: 64, n: 2, seed: subSeed(s, 'fine') }), 0.5);
  },
  // the cliffs' bands: layers of rock by height (about 25 m from one to the next, a little wavy), drawn by the ground's
  // picture from each point's own height (src/planet/ground.js). (Worked out here, one for each 2 m sample, they were
  // the faint vertical streaks down the cliffs: on a cliff two samples side by side stand metres apart in height, so
  // their bands differed, and each was drawn stretched up the whole face.)
  bands: true,
  paint(ctx) {
    const { slope, H, floor } = ctx;
    const patch = field(ctx, fbm({ cells: 12, n: 3, seed: subSeed(ctx.seed, 'patch') }), 4), patch2 = field(ctx, fbm({ cells: 24, n: 3, seed: subSeed(ctx.seed, 'patch2') }), 4);
    for (let k = 0; k < H.length; k++) {
      const rk = smooth(0.45, 0.95, slope[k]);
      ctx.rock[k] = rk;
      ctx.tone[k] = Math.max(-1, Math.min(1, (1 - rk) * patch[k] * CANYON_PATCH - floor[k] * 0.15));
      ctx.growth[k] = (1 - rk) * smooth(-0.1, 0.45, patch2[k]) * (0.35 + 0.4 * floor[k]);
      // the trees: a few, one here and there where plants grow, more on the canyons' floors
      ctx.woods[k] = ctx.growth[k] * 0.3;
    }
  },
  palette(R, { familiar = false } = {}) {
    // (the strange looks drawn for every seed, so a familiar one takes nothing from the rest of its colours' numbers)
    const strange = CANYON_LOOKS[Math.floor(R() * CANYON_LOOKS.length)], L = familiar ? CANYON_EARTH : strange, hj = jit(R, L.jitter || 10);
    const el = 28 + 28 * R(), az = R() * 360;
    return {
      familiar,
      dust: hsl(L.sand[0] + hj, L.sand[1], L.sand[2] - 0.1), rock: hsl(L.rock[0] + hj, L.rock[1], L.rock[2] - 0.04), bright: hsl(L.rock[0] + hj + 15, L.rock[1] * 0.8, L.rock[2] + 0.12), dark: hsl(L.rock[0] + hj - 10, L.rock[1], L.rock[2] - 0.17),
      grass: hsl(L.sand[0] + hj, L.sand[1] * 0.8, L.sand[2] - 0.2), grass2: hsl(L.sand[0] + hj + 20, L.sand[1], L.sand[2] - 0.14),
      leaves: L.leaves.map((h, n) => ({ hue: h + jit(R, familiar ? 5 : 12), sat: L.vivid || 1.4, light: (familiar ? [0.95, 1.0] : [1.0, 1.1])[n] })),
      sun: sunDir(el, az), sunColor: [1.0, 0.95, 0.86], sunPower: 2.1,
      ambient: { sky: hsl(L.zenith[0], L.zenith[1] * 0.7, 0.62), ground: hsl(L.sand[0], 0.3, 0.35), power: 0.7 },
      air: { zenith: hsl(...L.zenith), horizon: hsl(...L.horizon), toward: hsl(...L.toward), glow: hsl(L.toward[0], 0.6, 0.35), cloud: hsl(L.horizon[0], 0.15, 0.93), clouds: 0.12 + 0.2 * R(), haze: 0.00026 + 0.00016 * R(), thin: 420 },
      exposure: 0.92,
    };
  },
  cover: {
    rocks: { many: 0.6, near: 'cliffs', colour: 'rock' },
    plants: [
      { k: 7, size: 3.0, leaf: 0, share: 0.35, how: 'loner', far: true },
      { k: 14, size: 3.2, leaf: 1, share: 0.25, how: 'clump', far: true },
      { k: 3, size: 1.2, leaf: 0, share: 0.7, how: 'grass' },
      { k: 4, size: 3.5, leaf: 1, share: 0.3, how: 'clump' },
      { k: 12, size: 2.0, leaf: 1, share: 0.15, how: 'clump', far: true },
    ],
    // a few pines, smaller than the Terrain Lab's, in the colour of the saplings (one kind: one model to load)
    trees: { cell: 14, crown: 0.25, kinds: [
      { tree: 'pine', size: 0.6, leaf: 1, share: [1, 1] },
    ] },
  },
};

export const KINDS = [MOON, MEADOW, CANYON];
export const KIND_IDS = KINDS.map((k) => k.id);
export const kindById = (id) => KINDS.find((k) => k.id === id) || null;
// the kind a seed makes (the same seed, the same kind)
export function kindOf(seed) {
  const R = rng(subSeed(seed, 'kind')), total = KINDS.reduce((s, k) => s + k.weight, 0);
  let t = R() * total;
  for (const k of KINDS) { if ((t -= k.weight) < 0) return k; }
  return KINDS[KINDS.length - 1];
}
// whether a seed's world has Earth's colours (only a world with air: about one in five; the same seed, the same answer).
// (Its own draw, named so that the seeds shown to the game's maker before there were familiar worlds, 1, 2, 3 and 7,
// kept the strange colours he saw.)
export function familiarOf(seed, kind = kindOf(seed)) {
  return !!kind.air && rng(subSeed(seed, 'earthlike'))() < FAMILIAR;
}
// a new seed, at random, that makes the kind asked for (or any kind)
export function newSeed(kindId = null, random = Math.random) {
  for (let n = 0; n < 400; n++) { const s = 1 + Math.floor(random() * 999999); if (!kindId || kindOf(s).id === kindId) return s; }
  return 1;
}
