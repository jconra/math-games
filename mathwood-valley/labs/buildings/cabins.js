// THE CABIN MAKER: many cabins, each its own, from one recipe each. The same parts as the town's other code-built
// buildings (the Material Lab's Kit and weathering, the Building Lab's parts, the Stone Lab's wall maker), so every
// cabin is a handful of meshes however many logs, boards and shakes it has.
//
// What a recipe chooses (cabinRecipe tidies one up; PRESETS are the named ones, randomRecipe makes one up):
//   walls       hewn logs with clay chinking, round logs, board and batten, or lap siding
//   plan        a single pen, a double pen (two rooms under one roof, a log wall between), a dogtrot (two pens with an
//               open breezeway between them, all under one roof) or an L (a wing at the back, its own gable roof)
//   room        a lean-to room on the back or on either end (a shed roof against the main wall)
//   backDoor    a door out of the back; doors2: a front door into each pen of a double pen
//   porch       none (a step), a front porch with its own roof under the eave, a shed porch (the roof carried on down
//               over it at a lower pitch), or a porch wrapped round one corner
//   chimney     stone (the Stone Lab's wall maker), stick and mud on a stone firebox, a stovepipe, or none; on either
//               end, both ends, in the middle (between the pens), or in the lean-to
//   roof        gable or shed (one slope), split shakes or boards and battens, its pitch and overhang
//   windows     small ones with board shutters, or six-pane sashes; how many on the front, the ends and the back
//   foundation  stone piers, a stone footing, or log sills on flat stones
//   paint, wear, wood, stone, mortar and a seed for every small variation
// Each cabin can be walked into: floors, ceilings on joists, the inside faces of its walls, a fireplace or a stove,
// doorways between its rooms. Furniture is not built here: each room lists where its bed, table, stove and shelves
// can go (anchors.rooms), and its floor is left clear.
//
//   buildCabin(recipe, env) -> the same shape as the other buildings (stable.js, sheriff.js): { geos (one mesh per
//     material: wood, iron, stone, plaster (the clay chinking and daub), glow, glass, pane), doors (the front and back
//     doors that swing), lamps, light (the baked light), props (the yard's barrel, woodpile, bench...), anchors
//     (footprint, doorways, rooms, porch), views (where the lab's camera looks from), offset }
//   recipe.look 'far': the cheap far look for the town's distance dial: no inside, the chinking one sheet per wall,
//     fewer and wider shakes, a chimney of plain blocks, two meshes (wood and stone)
//   recipe.lineup: every preset side by side in a row (the lab's lineup), merged into one set of meshes
//
// Frame: the footprint is centred on x = z = 0 when it is returned (offset says how far it moved), the ground at y = 0,
// the front faces +z, +x is the right seen from the front. Metres.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, buildGeometry, Occlusion } from '../materials/cabin.js';
import { rng, WOOD, WOOD_LOOKS } from '../materials/textures.js';
import { buildStoneWall, SHAPES, PALETTES, MORTARS } from '../stone/stonewall.js';
import { T, RX, RY, RZ, mul, vary, smooth01, ngon, wallOf, wallM, wallP, boardAndBatten, lapSiding, plankField, stovepipe, casing, doorLeaf, lantern, glowGeometry, Light, GLOW } from './parts.js';
import { MAKERS } from './props.js';

// ── the recipe ───────────────────────────────────────────────────────────────────────────────────────────────────────
// paint colours are the paint itself (linear), before the weathering fades and wears it. On a log cabin only the doors
// and the shutters take it.
export const CABIN_PAINTS = {
  none: { label: 'None (bare wood)', c: null },
  white: { label: 'Whitewash (faded)', c: [0.47, 0.46, 0.43] },
  red: { label: 'Faded barn red', c: [0.34, 0.085, 0.058] },
  ochre: { label: 'Faded ochre', c: [0.48, 0.29, 0.07] },
  green: { label: 'Faded green', c: [0.12, 0.19, 0.11] },
  blue: { label: 'Faded blue-grey', c: [0.17, 0.21, 0.26] },
  cream: { label: 'Faded cream', c: [0.5, 0.45, 0.35] },
};
// the choices, with the panel's words for them
export const CABIN_OPTIONS = {
  walls: { hewn: 'Hewn logs', round: 'Round logs', batten: 'Board and batten', lap: 'Lap siding' },
  plan: { single: 'Single pen', double: 'Double pen', dogtrot: 'Dogtrot (open breezeway)', ell: 'L (a wing)' },
  wing: { right: 'Wing on the right', left: 'Wing on the left' },
  wingAt: { front: 'Wing toward the street (gable front)', back: 'Wing at the back' },
  room: { none: 'No lean-to', back: 'Lean-to on the back', left: 'Lean-to on the left', right: 'Lean-to on the right' },
  porch: { none: 'No porch (a step)', partial: 'A small porch at the door', front: 'Front porch', shed: 'Shed porch (roof carried down)', wrap: 'Wrap-around porch' },
  wrap: { right: 'Wrapping round the right', left: 'Wrapping round the left' },
  chimney: { stone: 'Stone', stick: 'Stick and mud', pipe: 'Stovepipe', none: 'None' },
  chimneyAt: { left: 'Left end', right: 'Right end', both: 'Both ends', middle: 'Middle', leanto: 'In the lean-to' },
  roof: { gable: 'Gable', shed: 'Shed (one slope)' },
  cover: { shakes: 'Split shakes', boards: 'Boards and battens' },
  windows: { shutters: 'Small, board shutters', glass: 'Six-pane sashes' },
  foundation: { piers: 'Stone piers', footing: 'Stone footing', sills: 'Log sills on flat stones' },
  logTone: { auto: 'Logs: from the seed', brown: 'Logs: brown', grey: 'Logs: silver-grey', dark: 'Logs: dark, oiled' },
};
const RANGES = { w: [3.6, 7.2], d: [3.4, 5.6], breeze: [1.8, 3.2], pitch: [10, 45], overhang: [0.15, 0.7], winFront: [0, 3], winSide: [0, 2], winBack: [0, 2], wear: [0, 1] };
export const CABIN_DEFAULTS = {
  kind: 'cabin', preset: 'homestead', walls: 'hewn', plan: 'single', wing: 'right', wingAt: 'back', w: 5.2, d: 4.4, breeze: 2.4, doors2: false,
  room: 'none', backDoor: false, porch: 'front', wrap: 'right', rails: true, chimney: 'stone', chimneyAt: 'left',
  roof: 'gable', cover: 'shakes', pitch: 35, overhang: 0.4, windows: 'glass', winFront: 1, winSide: 1, winBack: 1,
  foundation: 'piers', lantern: false, logTone: 'auto', paint: 'none', wear: 0.55, wood: 'straight', stone: 'grey', mortar: 'grey', seed: 11,
  look: 'near', lineup: false,
};
// THE PRESETS: the range, from a trapper's one-room shack to a frame house with a wrap-around porch. The log houses each
// show the street a different front: porch (none, a small one at the door, full, shed or wrapped), pitch, chimney end
// and log tone. Footprints: see changes.md (bigger than the Tripo homes' spots is fine).
export const PRESETS = {
  trapper: { label: "Trapper's cabin", walls: 'round', plan: 'single', w: 4.2, d: 3.8, room: 'none', backDoor: false, porch: 'none', chimney: 'pipe', chimneyAt: 'right', roof: 'gable', cover: 'shakes', pitch: 38, overhang: 0.35, windows: 'shutters', winFront: 1, winSide: 1, winBack: 0, foundation: 'sills', logTone: 'grey', paint: 'none', seed: 3 },
  homestead: { label: "Homesteader's double pen", walls: 'hewn', plan: 'double', w: 3.7, d: 4.4, doors2: true, room: 'none', backDoor: false, porch: 'front', chimney: 'stone', chimneyAt: 'left', roof: 'gable', cover: 'shakes', pitch: 36, overhang: 0.4, windows: 'glass', winFront: 1, winSide: 1, winBack: 1, foundation: 'piers', logTone: 'brown', paint: 'none', lantern: true, seed: 11 },
  dogtrot: { label: 'Dogtrot (open breezeway)', walls: 'hewn', plan: 'dogtrot', w: 3.5, d: 4.2, breeze: 2.6, porch: 'none', chimney: 'stone', chimneyAt: 'both', roof: 'gable', cover: 'shakes', pitch: 31, overhang: 0.45, windows: 'shutters', winFront: 1, winSide: 0, winBack: 1, foundation: 'piers', backDoor: true, logTone: 'grey', paint: 'none', seed: 21 },
  kitchen: { label: 'Board-and-batten house with a lean-to kitchen', walls: 'batten', plan: 'single', w: 5.6, d: 4.4, room: 'back', backDoor: true, porch: 'front', chimney: 'pipe', chimneyAt: 'leanto', roof: 'gable', cover: 'shakes', pitch: 34, overhang: 0.4, windows: 'glass', winFront: 2, winSide: 1, winBack: 1, foundation: 'piers', paint: 'red', wear: 0.6, lantern: true, seed: 7 },
  tworoom: { label: 'Two-room log house (back door, stone chimney)', walls: 'hewn', plan: 'double', w: 3.5, d: 4.6, doors2: false, backDoor: true, porch: 'partial', chimney: 'stone', chimneyAt: 'right', roof: 'gable', cover: 'shakes', pitch: 41, overhang: 0.35, windows: 'glass', winFront: 1, winSide: 1, winBack: 1, foundation: 'footing', logTone: 'dark', paint: 'none', seed: 5 },
  frame: { label: 'Whitewashed frame house', walls: 'lap', plan: 'single', w: 5.6, d: 4.6, room: 'left', backDoor: true, porch: 'wrap', wrap: 'right', chimney: 'pipe', chimneyAt: 'middle', roof: 'gable', cover: 'shakes', pitch: 32, overhang: 0.35, windows: 'glass', winFront: 2, winSide: 1, winBack: 1, foundation: 'footing', paint: 'white', wear: 0.55, lantern: true, seed: 9 },
  ell: { label: 'Log house with a wing toward the street', walls: 'hewn', plan: 'ell', wing: 'right', wingAt: 'front', w: 6.0, d: 4.4, backDoor: true, porch: 'partial', chimney: 'stone', chimneyAt: 'left', roof: 'gable', cover: 'shakes', pitch: 38, overhang: 0.4, windows: 'glass', winFront: 1, winSide: 1, winBack: 1, foundation: 'piers', logTone: 'grey', paint: 'none', seed: 13 },
  shanty: { label: 'Claim shanty', walls: 'batten', plan: 'single', w: 4.6, d: 3.8, room: 'none', porch: 'none', chimney: 'pipe', chimneyAt: 'right', roof: 'shed', cover: 'boards', pitch: 14, overhang: 0.3, windows: 'shutters', winFront: 1, winSide: 1, winBack: 0, foundation: 'sills', paint: 'none', backDoor: false, seed: 17 },
  saddlebag: { label: 'Saddlebag cabin (chimney in the middle)', walls: 'round', plan: 'double', w: 3.6, d: 4.2, doors2: true, porch: 'front', chimney: 'stone', chimneyAt: 'middle', roof: 'gable', cover: 'shakes', pitch: 29, overhang: 0.5, windows: 'shutters', winFront: 0, winSide: 1, winBack: 1, foundation: 'piers', logTone: 'brown', paint: 'none', seed: 19 },
  prospector: { label: "Prospector's cabin (stick chimney, woodshed)", walls: 'round', plan: 'single', w: 4.4, d: 4.0, room: 'right', porch: 'none', chimney: 'stick', chimneyAt: 'left', roof: 'gable', cover: 'boards', pitch: 30, overhang: 0.35, windows: 'shutters', winFront: 1, winSide: 0, winBack: 1, foundation: 'sills', logTone: 'dark', paint: 'none', backDoor: false, seed: 23 },
  squared: { label: 'Squared-log house with a wrap porch', walls: 'hewn', plan: 'single', w: 5.8, d: 4.6, porch: 'wrap', wrap: 'left', chimney: 'stone', chimneyAt: 'right', roof: 'gable', cover: 'shakes', pitch: 33, overhang: 0.4, windows: 'glass', winFront: 2, winSide: 1, winBack: 1, foundation: 'footing', backDoor: true, logTone: 'grey', paint: 'green', lantern: true, seed: 29 },
};
export const PRESET_NOTES = { dogtrot: 'wider than a home spot: two pens, the breezeway and two chimneys', ell: 'its wing stands out toward the street' };
// THE SEED'S OWN VARIETY: a preset built with a seed other than its own (the town's homes) is varied a little: its pitch
// up to 3 degrees, its log tone (when 'auto'), a full porch made a small one now and then (or the other way), the
// chimney to the other end, the wing to the other side. Worked out at build time only (the recipe kept as given)
function seedVariety(r) {
  const R = rng(r.seed * 7 + 13), own = PRESETS[r.preset] && PRESETS[r.preset].seed === r.seed, o = { ...r };
  if (o.logTone === 'auto') o.logTone = ['brown', 'grey', 'brown', 'dark'][Math.floor(R() * 4)];
  if (own || !PRESETS[r.preset]) return cabinRecipe(o);
  o.pitch = Math.round(o.pitch + (R() - 0.5) * 6);
  if (o.porch === 'front' && R() < 0.3) o.porch = 'partial'; else if (o.porch === 'partial' && R() < 0.25) o.porch = 'front';
  if ((o.chimneyAt === 'left' || o.chimneyAt === 'right') && R() < 0.5) o.chimneyAt = o.chimneyAt === 'left' ? 'right' : 'left';
  if (o.plan === 'ell' && R() < 0.5) o.wing = o.wing === 'left' ? 'right' : 'left';
  if (o.porch === 'wrap' && R() < 0.5) o.wrap = o.wrap === 'left' ? 'right' : 'left';
  return cabinRecipe(o);
}

// a recipe tidied: every key known, every name a known choice, every number in range; things that can't go together
// worked out (a chimney where a lean-to is goes to the other end, and so on)
export function cabinRecipe(r = {}) {
  const o = { ...CABIN_DEFAULTS, ...(PRESETS[r.preset] || {}), ...r };
  delete o.label;
  for (const k in CABIN_OPTIONS) if (!CABIN_OPTIONS[k][o[k]]) o[k] = CABIN_DEFAULTS[k];
  for (const k in RANGES) { const n = +o[k]; o[k] = Number.isFinite(n) ? Math.min(RANGES[k][1], Math.max(RANGES[k][0], n)) : CABIN_DEFAULTS[k]; }
  for (const k of ['winFront', 'winSide', 'winBack']) o[k] = Math.round(o[k]);
  if (!CABIN_PAINTS[o.paint]) o.paint = 'none';
  if (!WOOD_LOOKS[o.wood]) o.wood = CABIN_DEFAULTS.wood;
  if (!PALETTES[o.stone]) o.stone = CABIN_DEFAULTS.stone;
  if (!MORTARS[o.mortar]) o.mortar = CABIN_DEFAULTS.mortar;
  o.seed = Math.max(1, Math.round(+o.seed) || 1);
  for (const k of ['doors2', 'backDoor', 'rails', 'lantern', 'lineup']) o[k] = !!o[k];
  if (o.look !== 'far') o.look = 'near';
  // (an L has its wing on the back: a lean-to goes on an end instead, and a shed roof can't meet the wing's gable)
  if (o.plan === 'ell' && o.room === 'back' && o.wingAt === 'back') o.room = o.wing === 'right' ? 'left' : 'right';
  if (o.plan === 'ell') o.roof = 'gable';
  // (a wing toward the street takes part of the front: the porch there is a small one beside it)
  if (o.plan === 'ell' && o.wingAt === 'front' && (o.porch === 'wrap' || o.porch === 'shed' || o.porch === 'front')) o.porch = 'partial';
  // (where the chimney can't go: the middle of a single pen or an L is the left end; a dogtrot's middle is its breezeway,
  // so both ends; in the lean-to only a stovepipe, and only with a lean-to)
  if (o.chimneyAt === 'middle' && o.chimney !== 'pipe' && (o.plan === 'single' || o.plan === 'ell')) o.chimneyAt = 'left';
  if (o.chimneyAt === 'middle' && o.plan === 'dogtrot') o.chimneyAt = 'both';
  if (o.chimneyAt === 'middle' && o.chimney === 'stick') o.chimney = 'stone';
  if (o.chimneyAt === 'leanto' && o.room === 'none') o.chimneyAt = 'right';
  if (o.chimneyAt === 'leanto') o.chimney = 'pipe';
  if (o.chimneyAt === 'both' && o.chimney === 'pipe') o.chimneyAt = 'left';
  // (an end taken by a lean-to keeps no chimney; a wrap-around porch goes round the end that's free)
  const taken = (side) => o.room === side || (o.chimney !== 'none' && (o.chimneyAt === side || o.chimneyAt === 'both') && o.chimney !== 'pipe');
  if (o.chimney !== 'pipe' && o.room !== 'none' && o.room !== 'back') {
    if (o.chimneyAt === o.room) o.chimneyAt = o.room === 'left' ? 'right' : 'left';
    if (o.chimneyAt === 'both') o.chimneyAt = o.room === 'left' ? 'right' : 'left';
  }
  if (o.porch === 'wrap') {
    if (taken(o.wrap)) o.wrap = o.wrap === 'left' ? 'right' : 'left';
    if (taken(o.wrap)) o.porch = 'front';
  }
  return o;
}

// a recipe made up from a seed: walls, plan, rooms and the rest picked to go together, sized to fit a home's spot
export function randomRecipe(seed = 1 + Math.floor(Math.random() * 99999)) {
  const R = rng(seed * 13 + 7), pick = (list) => list[Math.floor(R() * list.length)], rr = (a, b) => a + (b - a) * R();
  const walls = pick(['hewn', 'hewn', 'round', 'batten', 'lap']), plan = pick(['single', 'single', 'double', 'dogtrot', 'ell']);
  const log = walls === 'hewn' || walls === 'round';
  const w = plan === 'double' || plan === 'dogtrot' ? rr(3.3, 3.8) : rr(4.2, 6.2), d = rr(3.8, plan === 'dogtrot' ? 4.4 : 4.8);
  const chimney = pick(log ? ['stone', 'stone', 'stick', 'pipe'] : ['pipe', 'pipe', 'stone']);
  const r = {
    preset: 'random', walls, plan, wing: pick(['left', 'right']), w: +w.toFixed(1), d: +d.toFixed(1), breeze: +rr(2.0, 2.8).toFixed(1),
    doors2: R() < 0.5, room: plan === 'dogtrot' ? 'none' : pick(['none', 'none', 'back', 'left', 'right']), backDoor: R() < 0.55,
    porch: pick(['none', 'front', 'front', 'shed', 'wrap']), wrap: pick(['left', 'right']),
    chimney, chimneyAt: pick(chimney === 'pipe' ? ['left', 'right', 'middle', 'leanto'] : ['left', 'right', 'both', 'middle']),
    roof: plan === 'ell' || R() < 0.8 ? 'gable' : 'shed', cover: R() < 0.75 ? 'shakes' : 'boards', overhang: +rr(0.3, 0.5).toFixed(2),
    windows: pick(['shutters', 'glass']), winFront: Math.floor(rr(0, 2.99)), winSide: Math.floor(rr(0, 1.99)), winBack: Math.floor(rr(0, 1.99)),
    foundation: pick(['piers', 'piers', 'footing', 'sills']), lantern: R() < 0.4,
    paint: log ? pick(['none', 'none', 'red', 'green', 'blue']) : pick(['none', 'white', 'red', 'ochre', 'cream', 'blue']), wear: +rr(0.4, 0.75).toFixed(2),
    stone: pick(['grey', 'buff', 'brown', 'ochre']), seed,
  };
  r.pitch = r.roof === 'shed' ? Math.round(rr(12, 18)) : Math.round(rr(30, 40));
  return cabinRecipe(r);
}

// ── colours: tints on the trim sheet's strips (1 = the strip as drawn) ──────────────────────────────────────────────
// (tuned on the weathered straight-grain sheet: silver-brown, never pink)
const LOG = [0.97, 0.93, 0.88], LOG_GREY = [0.96, 0.97, 0.98];      // hewn logs (a few gone greyer)
const ROUNDT = [0.95, 0.9, 0.83];                                   // peeled round logs, a little warmer
const DARKW = [0.8, 0.77, 0.74];                                    // frames, shutters, sheathing
const BOARD = [1.08, 1.05, 1.0];                                    // the gable boards
const SHAKE = [0.74, 0.7, 0.66];                                    // split shakes
const ROOFW = [0.44, 0.42, 0.4];                                    // barge and starter boards
const ROOFB = [0.92, 0.9, 0.88];                                    // a board roof, sun-greyed
const POLE = [1.2, 1.15, 1.1];                                      // peeled poles
const DECKW = [0.92, 0.88, 0.84];                                   // porch decks
const BARE = [1.1, 1.1, 1.12];                                      // siding under its paint: weathered grey
const INNER = [1.12, 1.06, 0.97];                                   // inside boards, kept from the sun
const FLOOR = [0.86, 0.75, 0.62];                                   // floors: darker, worn
const FRAME = [1.06, 0.96, 0.84];                                   // posts, beams, joists, sills
const TRIM = [0.95, 0.93, 0.92];                                    // casings and corner boards on a frame house
const DOORW = [1.16, 1.12, 1.06];                                   // door planks: sun-dried
const SHADOW = [0.12, 0.1, 0.09];                                   // the dark under a deck, behind gaps
const STRAP = [0.035, 0.032, 0.03];                                 // iron straps painted on the doors
const IRON = [0.85, 0.8, 0.76];
const TIN = [5.4, 6.8, 8.4];                                        // a stovepipe's tin and flashing (on the iron colour)
const RUST = [1.5, 1.0, 0.68];
// (sRGB colours of the clay: the chinking between hewn logs, the daub on a stick chimney, whitewash; turned into tints on
// the rubble picture by its average colour, so they come out as these whatever the picture is)
const CLAY = [0.43, 0.37, 0.29], DAUB = [0.5, 0.42, 0.32], SOOT = [0.1, 0.09, 0.085], HEARTH = [0.37, 0.345, 0.31];
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const onMean = (c, mean) => c.map((x, i) => lin(x) / lin(mean ? mean[i] : 0.5));

const D2R = Math.PI / 180;
const cutSpans = (spans, a0, a1, min = 0.05) => spans.flatMap(([s, e]) => (a1 <= s || a0 >= e ? [[s, e]] : [[s, a0], [a1, e]].filter(([p, q]) => q - p > min)));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
// a wall's outward normal and its along direction (the way a runs), in the building's frame
const outN = (f) => [Math.sin(f.th), 0, Math.cos(f.th)], alongV = (f) => [Math.cos(f.th), 0, -Math.sin(f.th)];

// ── the layout: the pens, the walls and their openings, the roofs, the porch, the chimneys ──────────────────────────
// Everything after this reads the layout; nothing after this decides where anything goes.
function layout(r, k) {
  const L = { r }, log = r.walls === 'hewn' || r.walls === 'round', round = r.walls === 'round';
  Object.assign(L, { log, round, kind: log ? 'log' : r.walls });
  const W = r.w, D = r.d, gable = r.roof === 'gable';
  // (a wall's thickness, outside face to inside face)
  L.T = log ? (round ? 0.31 : 0.27) : r.walls === 'lap' ? 0.15 : 0.1;
  // the foundation's top (the sill logs or the sill beam sit on it), the courses, the floor and the eave
  L.FT = r.foundation === 'sills' ? 0.1 : r.foundation === 'footing' ? 0.34 : log ? 0.3 : 0.36;
  const extra = r.room !== 'none' ? 1 : 0;   // (a lean-to roof hangs under the eave: a course higher, so there's headroom under it)
  // (the walls a course taller than they were, and the porch roofs higher and flatter: the rider's head hit the porch
  // beam walking up the steps; the beam now clears about 2 m over the deck, the rider about 1.8 m with a hat)
  if (log) {
    const C = round ? 0.27 : 0.3, n = (round ? 11 : 10) + extra, ch = Array.from({ length: 40 }, () => k.r(0.88, 1.12));
    let s = 0; for (let i = 0; i < n; i++) s += ch[i];
    L.B = [L.FT]; for (let i = 0; i < 40; i++) L.B.push(L.B[i] + (i < n ? ch[i] / s * n * C : ch[i] * C));
    Object.assign(L, { C, nE: n, EAVE: L.B[n], FL: L.B[1] - (round ? 0 : 0.02) });
  } else { L.FL = L.FT + 0.2; L.EAVE = L.FL + 2.8 + extra * 0.25; }
  L.CEIL = L.EAVE - (log ? 0.03 : 0.14);
  // the pens: the closed rooms of the main block
  const pens = [];
  if (r.plan === 'double') pens.push({ x0: -W, x1: 0 }, { x0: 0, x1: W });
  else if (r.plan === 'dogtrot') pens.push({ x0: -r.breeze / 2 - W, x1: -r.breeze / 2 }, { x0: r.breeze / 2, x1: r.breeze / 2 + W });
  else pens.push({ x0: -W / 2, x1: W / 2 });
  pens.forEach((p, i) => Object.assign(p, { z0: -D / 2, z1: D / 2, name: pens.length > 1 ? ['left room', 'right room'][i] : 'main room' }));
  L.pens = pens;
  const main = L.main = { x0: pens[0].x0, x1: pens[pens.length - 1].x1, z0: -D / 2, z1: D / 2 };
  if (r.plan === 'dogtrot') L.breeze = { x0: pens[0].x1, x1: pens[1].x0, z0: -D / 2, z1: D / 2 };
  // THE ROOF: a gable along x over the main block, or one slope falling to the back (the front wall the taller)
  L.pitch = r.pitch * D2R; L.tp = Math.tan(L.pitch);
  const leanSide = r.room === 'left' || r.room === 'right' ? r.room : null;
  L.GX = [leanSide === 'left' ? 0.22 : r.overhang + 0.05, leanSide === 'right' ? 0.22 : r.overhang + 0.05];   // past the end walls (left, right)
  L.OVB = r.room === 'back' ? 0.06 : r.overhang + 0.1;                                                    // past the back wall
  L.OVF = r.porch === 'front' || r.porch === 'wrap' || r.porch === 'partial' ? 0.12 : r.porch === 'shed' ? 0.02 : r.overhang + 0.1;  // past the front wall
  if (gable) { L.RIDGE = L.EAVE + D / 2 * L.tp; L.roofY = (x, z) => L.RIDGE - Math.abs(z) * L.tp; }
  else {
    // (the front wall's top: a course boundary on a log cabin, so its logs end level under the roof)
    let hi = L.EAVE + D * L.tp;
    if (log) { let best = L.nE + 1; for (let i = L.nE + 1; i < L.B.length; i++) if (Math.abs(L.B[i] - hi) < Math.abs(L.B[best] - hi)) best = i; hi = L.B[best]; L.nH = best; }
    L.EAVE_H = hi; L.ps = Math.atan((hi - L.EAVE) / D); L.tps = Math.tan(L.ps);
    L.roofY = (x, z) => L.EAVE + (z + D / 2) * L.tps;
  }
  L.topY = gable ? L.RIDGE : L.EAVE_H;
  // THE WING of an L: behind the main block, set in half a metre from its end (so the end wall's logs and the wing's
  // don't meet in one line), its own gable along z, the same eave and pitch (a lower ridge: it is narrower)
  if (r.plan === 'ell') {
    const front = r.wingAt === 'front', Ww = clamp(Math.min(D - 0.9, W * 0.6), 2.8, 4.0), Lw = front ? clamp(D * 0.62, 2.5, 3.2) : clamp(D * 0.75, 2.8, 3.6), inset = 0.5;
    const x1 = r.wing === 'left' ? main.x0 + inset + Ww : main.x1 - inset, x0 = x1 - Ww;
    L.wing = { x0, x1, z0: front ? D / 2 : -D / 2 - Lw, z1: front ? D / 2 + Lw : -D / 2, xc: (x0 + x1) / 2, Ww, Lw, RW: L.EAVE + Ww / 2 * L.tp, name: front ? 'front room' : 'kitchen', front, sg: front ? 1 : -1 };
    L.wingY = (x, z) => L.wing.RW - Math.abs(x - L.wing.xc) * L.tp;
  }
  // THE LEAN-TO: a shed roof against the main wall, its top tucked under the main eave, falling away at 10 degrees
  if (r.room !== 'none') {
    const pl = 10 * D2R, back = r.room === 'back', Ld = back ? 2.4 : 2.3;
    const lt = { side: r.room, pitch: pl, depth: Ld, top: back ? L.EAVE - 0.2 : L.EAVE - 0.32, name: back ? 'lean-to' : 'lean-to' };
    if (back) {
      const span = r.plan === 'dogtrot' ? pens[1] : main;
      Object.assign(lt, { x0: span.x0, x1: span.x1, z0: main.z0 - Ld, z1: main.z0 });
      lt.y = (x, z) => lt.top - (main.z0 - z) * Math.tan(pl);
    } else if (r.room === 'right') { Object.assign(lt, { x0: main.x1, x1: main.x1 + Ld, z0: main.z0, z1: main.z1 }); lt.y = (x) => lt.top - (x - main.x1) * Math.tan(pl); }
    else { Object.assign(lt, { x0: main.x0 - Ld, x1: main.x0, z0: main.z0, z1: main.z1 }); lt.y = (x) => lt.top - (main.x0 - x) * Math.tan(pl); }
    lt.low = lt.top - Ld * Math.tan(pl);
    L.lean = lt;
  }
  // THE PORCH
  if (r.porch !== 'none') {
    const PD = r.porch === 'wrap' ? 2.0 : 1.9, wrapR = r.porch === 'wrap' && r.wrap === 'right', wrapL = r.porch === 'wrap' && r.wrap === 'left';
    L.porch = { kind: r.porch, depth: PD, deck: L.FL - 0.04, pitch: (r.porch === 'shed' ? 10 : 8) * D2R, top: r.porch === 'shed' ? L.EAVE + 0.035 : L.EAVE - 0.15,
      x0: main.x0 - (wrapL ? PD : 0), x1: main.x1 + (wrapR ? PD : 0), wrap: r.porch === 'wrap' ? r.wrap : null, partial: r.porch === 'partial' };
    // (a wing toward the street: the porch runs along the rest of the front, its end against the wing)
    if (L.wing && L.wing.front) { if (r.wing === 'right') { L.porch.x1 = L.wing.x0 - 0.03; L.porch.abut = 'right'; } else { L.porch.x0 = L.wing.x1 + 0.03; L.porch.abut = 'left'; } }
  }
  // THE CHIMNEYS: each { type, side (-1 left end, 1 right end, 0 the middle), x, z, ... }
  L.chims = [];
  if (r.chimney !== 'none') {
    const ends = r.chimneyAt === 'both' ? [-1, 1] : r.chimneyAt === 'left' ? [-1] : r.chimneyAt === 'right' ? [1] : [];
    if (r.chimney === 'pipe') {
      // a box stove inside, its pipe up through the ceiling and the roof's back slope
      let x, z = -0.55, room;
      if (r.chimneyAt === 'leanto') { const lt = L.lean; room = 'lean'; if (lt.side === 'back') { x = lt.x0 + 0.95; z = lt.z0 + 0.8; } else { x = lt.side === 'right' ? lt.x1 - 0.85 : lt.x0 + 0.85; z = lt.z0 + 1.0; } }
      else if (r.chimneyAt === 'middle') { x = r.plan === 'double' ? -0.75 : 0.25; z = -D / 2 + L.T + 0.55; }
      else { const p = ends[0] < 0 ? pens[0] : pens[pens.length - 1]; x = ends[0] < 0 ? p.x0 + L.T + 0.7 : p.x1 - L.T - 0.7; z = -0.4; }
      L.chims.push({ type: 'pipe', x, z, room });
    } else if (r.chimneyAt === 'middle') {
      L.chims.push({ type: 'stone', side: 0, x: 0, z: -0.1, mw: 1.3, md: 1.05, sw: 0.86, sd: 0.62 });
    } else for (const s of ends) {
      const stick = r.chimney === 'stick';
      L.chims.push({ type: r.chimney, side: s, x: s < 0 ? main.x0 : main.x1, z: 0, cw: stick ? 1.3 : 1.5, cd: stick ? 0.78 : 0.86, sw: stick ? 0.86 : 0.9, sd: stick ? 0.6 : 0.62 });
    }
  }
  walls(L, k);
  return L;
}

// THE WALLS, each in its own frame (parts.js wallOf: a runs along it to the right seen from outside, y up, out of it
// +z): { side, f, a0..a1 (outside face to outside face), kind, phase (logs along x start a course lower than logs along
// z, so they cross at the corners), e (whether its log ends run on past each end), levelTop, topAt(a) (the roof's
// underside over it), gable (boards over the level part, up to the roof), inner (both faces indoors), covered (stretches
// another room stands against: no windows there), opens }
function walls(L, k) {
  const r = L.r, list = L.walls = [], { main, pens } = L;
  const roofUnder = (y) => y - 0.026 / Math.cos(L.pitch) - 0.012;
  const mk = (side, b, o = {}) => {
    let f, a0, a1;
    if (side === 'front') { f = wallOf(0, b.z1); a0 = b.x0; a1 = b.x1; }
    else if (side === 'back') { f = wallOf(Math.PI, -b.z0); a0 = -b.x1; a1 = -b.x0; }
    else if (side === 'right') { f = wallOf(Math.PI / 2, b.x1); a0 = -b.z1; a1 = -b.z0; }
    else { f = wallOf(-Math.PI / 2, -b.x0); a0 = b.z0; a1 = b.z1; }
    const w = { side, f, a0, a1, kind: L.kind, phase: side === 'front' || side === 'back' ? 'eave' : 'gable', e: [true, true], levelTop: L.EAVE, gable: false, inner: false, covered: [], opens: [], t: L.T, block: b, roofY: L.roofY, ...o };
    w.P = (a, y = 0, out = 0) => wallP(w.f, a, y, out);
    list.push(w); return w;
  };
  // where a in a wall's frame is, in the building's x or z
  const shedFront = r.roof === 'shed';
  const mainTop = (w) => (a) => { const [x, , z] = w.P(a); return roofUnder(L.roofY(x, z)); };
  const blocks = r.plan === 'dogtrot' ? pens : [main];
  for (const b of blocks) {
    const fr = mk('front', b, { levelTop: shedFront ? L.EAVE_H : L.EAVE, nTop: shedFront ? L.nH : L.nE, eave: true });
    const bk = mk('back', b, { nTop: L.nE, eave: true });
    const lf = mk('left', b, { gable: b === blocks[0], nTop: L.nE }), rt = mk('right', b, { gable: b === blocks[blocks.length - 1], nTop: L.nE });
    for (const w of [fr, bk, lf, rt]) w.topAt = w.phase === 'eave' ? () => w.levelTop : mainTop(w);
    b.walls = { front: fr, back: bk, left: lf, right: rt };
  }
  // (the pens of a single or double pen share the main block's walls)
  if (r.plan !== 'dogtrot') for (const p of pens) p.walls = main.walls;
  // the log wall between the two pens of a double pen (its logs run on through the front and back walls, as they do
  // at a corner)
  if (r.plan === 'double') {
    const pt = mk('right', main, { inner: true, f: wallOf(Math.PI / 2, L.log ? L.T / 2 : 0.06), partition: true, nTop: L.nE });
    pt.topAt = () => pt.levelTop;
    if (!L.log) pt.kind = 'partition';
    L.partition = pt;
  }
  // the wing: its two side walls butt against the main wall (the back, or the front for a wing toward the street);
  // its far wall has the gable
  if (L.wing) {
    const g = L.wing, fr = g.front;
    const wr = mk('right', g, { e: fr ? [true, false] : [false, true], nTop: L.nE, eave: true, roofY: L.wingY }), wl = mk('left', g, { e: fr ? [false, true] : [true, false], nTop: L.nE, eave: true, roofY: L.wingY });
    const we = mk(fr ? 'front' : 'back', g, { gable: true, nTop: L.nE, roofY: L.wingY });
    we.topAt = (a) => { const [x] = we.P(a); return roofUnder(L.wingY(x, 0)); };
    wr.topAt = wl.topAt = () => L.EAVE;
    g.walls = { right: wr, left: wl, [fr ? 'front' : 'back']: we, end: we };
    if (fr) main.walls.front.covered.push([g.x0, g.x1]); else main.walls.back.covered.push([-g.x1, -g.x0]);
  }
  // the lean-to: board and batten always (a lean-to was put up later, of boards), its roof's slope along its end walls
  if (L.lean) {
    const lt = L.lean, kind = 'batten', ltTop = (w) => (a) => { const [x, , z] = w.P(a); return lt.y(x, z) - 0.04; };
    const ws = lt.side === 'back' ? ['back', 'left', 'right'] : [lt.side, 'front', 'back'];
    lt.walls = {};
    for (const s of ws) {
      const w = mk(s, lt, { kind, t: 0.1, lean: true, e: [false, false], eave: s === lt.side, roofY: lt.y });
      w.topAt = ltTop(w); w.levelTop = lt.low - 0.04;
      lt.walls[s] = w;
    }
    // (the main walls it stands against: no windows there; their log ends cut flush where it meets them)
    const mainBlocks = r.plan === 'dogtrot' ? [lt.side === 'left' ? pens[0] : lt.side === 'right' ? pens[1] : pens[1]] : [main];
    for (const b of mainBlocks) {
      const mw = b.walls[lt.side];
      mw.covered.push([Math.min(mw.a0, mw.a1) - 1, Math.max(mw.a0, mw.a1) + 1]);
      if (lt.side === 'back') { b.walls.left.e[0] = false; b.walls.right.e[1] = false; }
      else if (lt.side === 'right') { b.walls.front.e[1] = false; b.walls.back.e[0] = false; }
      else { b.walls.front.e[0] = false; b.walls.back.e[1] = false; }
    }
  }
  // THE OPENINGS
  const DW = 0.92, DH = 1.98, door = (w, a, o = {}) => w.opens.push({ a0: a - DW / 2, a1: a + DW / 2, y0: L.FL, y1: L.FL + DH, kind: 'door', ...o });
  const A = (w, x, z) => (w.side === 'front' ? x : w.side === 'back' ? -x : w.side === 'right' ? -z : z);
  // the front doors
  const doors = [];
  if (r.plan === 'dogtrot') {
    const z = k.r(0.1, 0.5);
    door(pens[0].walls.right, A(pens[0].walls.right, 0, z), { leaf: 'main', name: 'left room' }); door(pens[1].walls.left, A(pens[1].walls.left, 0, z), { leaf: 'main', name: 'right room' });
  } else if (r.plan === 'double') {
    const c0 = (pens[0].x0 + pens[0].x1) / 2, c1 = (pens[1].x0 + pens[1].x1) / 2;
    door(main.walls.front, c0 + 0.35, { leaf: 'main', name: 'front' });
    if (r.doors2) door(main.walls.front, c1 - 0.35, { leaf: 'main', name: 'front 2' });
  } else {
    let off = (L.chims.length && L.chims[0].side ? -L.chims[0].side : k.R() < 0.5 ? -1 : 1) * k.r(0.0, 0.18) * r.w;
    // (beside a wing toward the street: in the middle of the front that's left)
    if (L.wing && L.wing.front) off = r.wing === 'right' ? (main.x0 + L.wing.x0) / 2 + 0.15 : (L.wing.x1 + main.x1) / 2 - 0.15;
    door(main.walls.front, off, { leaf: 'main', name: 'front' });
  }
  // the back door
  if (r.backDoor) {
    const lt = L.lean;
    if (L.wing && !L.wing.front) door(L.wing.walls.back, -L.wing.xc, { leaf: 'back', name: 'back' });
    else if (lt && lt.side === 'back') {
      // (in the lean-to's end, near the main wall where it's tallest; the end away from the stove)
      const s = L.chims.some((c) => c.room === 'lean' && c.x < (lt.x0 + lt.x1) / 2) ? 'right' : 'left', w = lt.walls[s];
      door(w, A(w, 0, lt.z1 - 0.62), { leaf: 'back', name: 'back', y1: L.FL + 1.9 });
    } else if (lt) { const w = lt.walls.back; door(w, A(w, lt.side === 'right' ? lt.x0 + 0.62 : lt.x1 - 0.62, 0), { leaf: 'back', name: 'back', y1: L.FL + 1.9 }); }
    else {
      const p = pens[pens.length - 1], w = p.walls.back, ch = L.chims[0];
      let x = (p.x0 + p.x1) / 2 + (pens.length > 1 ? 0 : (ch && ch.side ? -ch.side : 1) * r.w * 0.2);
      if (ch && ch.type === 'pipe' && Math.abs(ch.x - x) < 1) x = ch.x > x ? x - 0.9 : x + 0.9;
      door(w, A(w, x, 0), { leaf: 'back', name: 'back' });
    }
  }
  // the doorways between rooms (no door in them: walkable)
  if (L.partition) {
    const mid = L.chims.some((c) => c.side === 0 && c.type !== 'pipe'), z = mid ? main.z1 - 0.95 : main.z0 + L.T + 0.75;
    door(L.partition, A(L.partition, 0, z), { inner: true, name: 'between the rooms' });
  }
  if (L.wing) { if (L.wing.front) door(main.walls.front, L.wing.xc, { inner: true, name: 'into the wing' }); else door(main.walls.back, -L.wing.xc, { inner: true, name: 'into the wing' }); }
  if (L.lean) {
    const lt = L.lean, b = r.plan === 'dogtrot' ? pens[1] : main, mw = b.walls[lt.side];
    const pipe = L.chims.find((c) => c.room === 'lean');
    const at = lt.side === 'back' ? A(mw, pipe ? (pipe.x < (lt.x0 + lt.x1) / 2 ? lt.x1 - 1.1 : lt.x0 + 1.1) : (lt.x0 + lt.x1) / 2 + 0.4, 0) : A(mw, 0, k.r(0.2, 0.6));
    door(mw, at, { inner: true, name: 'into the lean-to', y1: L.FL + 1.92 });
  }
  // the hearths: a fireplace opening in the end wall a stone or stick chimney stands against
  for (const c of L.chims) if (c.side) {
    const b = c.side < 0 ? pens[0] : pens[pens.length - 1], w = b.walls[c.side < 0 ? 'left' : 'right'], a = A(w, 0, c.z);
    w.opens.push({ a0: a - 0.56, a1: a + 0.56, y0: L.FL, y1: L.FL + 1.02, kind: 'hearth', chim: c });
    c.wall = w; c.room = b;
  } else if (c.side === 0) {
    // (the middle chimney's mass stands through the wall between the pens: the wall's logs stop at it)
    const w = L.partition, a = A(w, 0, c.z);
    w.opens.push({ a0: a - c.md / 2, a1: a + c.md / 2, y0: L.FT - 0.2, y1: L.EAVE + 1, kind: 'mass', chim: c });
    c.wall = w;
  }
  // THE WINDOWS: the front, the ends, the back, each in the longest stretches left free (clear of the corners, the
  // doors, the chimneys and the wall between the pens)
  const glass = r.windows === 'glass', size = glass ? { w: 0.82, y0: L.FL + 0.78, y1: L.FL + 1.82 } : { w: 0.7, y0: L.FL + 0.9, y1: L.FL + 1.7 };
  const place = (w, n, avoid = []) => {
    if (!n) return;
    const lo = Math.min(w.a0, w.a1), hi = Math.max(w.a0, w.a1);
    let free = [[lo + (L.log ? 0.6 : 0.45), hi - (L.log ? 0.6 : 0.45)]];
    for (const o of w.opens) free = cutSpans(free, o.a0 - 0.4, o.a1 + 0.4, 0.01);
    for (const [s, e] of w.covered) free = cutSpans(free, s - 0.3, e + 0.3, 0.01);
    for (const [s, e] of avoid) free = cutSpans(free, s, e, 0.01);
    for (let i = 0; i < n; i++) {
      free.sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
      const sp = free[0]; if (!sp || sp[1] - sp[0] < size.w) break;
      const c = (sp[0] + sp[1]) / 2 + k.r(-0.25, 0.25) * (sp[1] - sp[0] - size.w);
      w.opens.push({ a0: c - size.w / 2, a1: c + size.w / 2, y0: size.y0, y1: size.y1, kind: 'window' });
      free = cutSpans(free, c - size.w / 2 - 0.5, c + size.w / 2 + 0.5, 0.01);
    }
  };
  const chimAvoid = (w) => L.chims.filter((c) => c.wall === w && c.side).map((c) => [A(w, 0, c.z) - c.cw / 2 - 0.2, A(w, 0, c.z) + c.cw / 2 + 0.2]);
  const midAvoid = (w) => (L.partition ? [[-0.55, 0.55]] : []);
  for (const b of blocks) {
    place(b.walls.front, r.plan === 'dogtrot' ? Math.max(1, r.winFront) : r.plan === 'double' ? (r.doors2 ? r.winFront : Math.max(1, r.winFront)) : r.winFront, midAvoid());
    place(b.walls.back, b === blocks[blocks.length - 1] || r.plan !== 'dogtrot' ? r.winBack : Math.min(1, r.winBack), midAvoid());
    for (const s of ['left', 'right']) if (b.walls[s].gable || r.plan === 'dogtrot') place(b.walls[s], b.walls[s].gable ? r.winSide : 0, chimAvoid(b.walls[s]));
  }
  // (a double pen with a door to each room has its windows in the ends and the back; one with a single door puts one
  // window in the other room's front)
  if (L.wing) { place(L.wing.walls[r.wing === 'right' ? 'right' : 'left'], 1); place(L.wing.walls[r.wing === 'right' ? 'left' : 'right'], 1); if (L.wing.front) place(L.wing.walls.end, Math.max(1, Math.min(2, r.winFront))); }
  if (L.lean) { const lt = L.lean; place(lt.walls[lt.side === 'back' ? 'back' : lt.side], 1); }
}

// ── building in each wall's frame ────────────────────────────────────────────────────────────────────────────────────
function wb(k, w, size, a, y, out, rot, o) { return k.board(size, null, null, { ...o, m: wallM(w.f, a, y, out, rot) }); }
function wx(k, w, group, size, a, y, out, rot, o = {}) { return k.box(group, size, null, null, { ...o, m: wallM(w.f, a, y, out, rot) }); }

// the courses of one log wall: [{ y0, y1 }], bottom to top. Logs along x (the eave walls) start on the foundation;
// logs along z (the end walls) start with a half log, so each of their logs lies between two of the others'
function coursesOf(L, w, k) {
  const B = L.B, n = w.nTop ?? L.nE, M = (i) => (B[i] + B[i + 1]) / 2, out = [];
  const gap = (i) => (L.round ? 0 : i === 0 ? 0.02 : k.r(0.025, 0.05));
  if (w.phase === 'eave') for (let i = 0; i < n; i++) out.push({ y0: B[i], y1: B[i + 1] - gap(i) });
  else {
    out.push({ y0: B[0], y1: M(0) - gap(1) });
    for (let i = 1; i < n; i++) out.push({ y0: M(i - 1), y1: M(i) - gap(i + 1) });
    out.push({ y0: M(n - 1), y1: B[n] - 0.012 });
  }
  return out;
}

// rows of corners along a log: by its ends and enough between that no stretch is longer than `step` (the baked
// shading changes only from one row to the next)
export function cutsFor(len, marks, step = 1.6) {
  const h = len / 2, pts = [-h, ...marks.filter((x) => x > -h + 0.05 && x < h - 0.05).sort((p, q) => p - q), h], out = [];
  for (let q = 0; q < pts.length - 1; q++) {
    if (q > 0) out.push(pts[q]);
    const n = Math.ceil((pts[q + 1] - pts[q]) / step);
    for (let r = 1; r < n; r++) out.push(pts[q] + (pts[q + 1] - pts[q]) * r / n);
  }
  return out;
}

// A LOG WALL: a log in each course, cut round the openings (an opening takes out the courses it crosses; its edges are
// where those logs stop); the ends run on past a corner 22 to 36 cm, ragged, except where they would poke into a porch
// roof, a deck or a lean-to. Hewn logs: boxes, each its own thickness and a little out of true, with clay chinking set
// back between them on both faces. Round logs: eight-sided, overlapping (scribed tight: no chinking), their ends the
// round end grain.
function logWall(c, w) {
  const { k, L } = c, far = c.far, cs = w.courses = coursesOf(L, w, k), P = L.porch;
  // (snap each opening to the courses: it takes out every course it overlaps; its bottom is the top of the log under it)
  for (const o of w.opens) {
    let c0, c1;
    if (o.kind === 'door') { c0 = 1; for (let i = 1; i < cs.length; i++) if (cs[i - 1].y1 <= L.FL + 0.03) c0 = i; }
    else if (o.kind === 'mass') c0 = 0;
    else { c0 = cs.findIndex((q) => q.y1 > o.y0 + 0.06); if (c0 < 1) c0 = 1; }
    c1 = c0; for (let i = c0; i < cs.length - 1; i++) if (cs[i].y0 < o.y1 - 0.06) c1 = i;
    if (o.kind === 'mass') c1 = cs.length - 1;
    Object.assign(o, { c0, c1, y0: o.kind === 'mass' ? cs[0].y0 : cs[c0 - 1].y1, y1: c1 + 1 < cs.length ? cs[c1 + 1].y0 : cs[c1].y1 + 0.02 });
  }
  const along = w.phase === 'gable';   // (logs along z: their ends reach toward the porch and the eaves)
  for (let i = 0; i < cs.length; i++) {
    const { y0: yb, y1: yt } = cs[i], h = yt - yb;
    const e = [w.e[0] ? k.r(0.22, 0.36) : 0.0, w.e[1] ? k.r(0.22, 0.36) : 0.0];
    // (an end wall's logs stay under the eaves, and clear of a porch's roof and deck at the front)
    if (along) for (const j of [0, 1]) {
      const z = w.P(j ? w.a1 : w.a0)[2], front = Math.abs(z - L.main.z1) < 0.05 && z > 0, frontB = w.block && Math.abs(z - w.block.z1) < 0.05;
      const roofGap = L.r.roof === 'gable' ? (L.roofY(0, z) - yt) / L.tp - 0.08 : 9;
      e[j] = Math.min(e[j], Math.max(0.02, roofGap));
      if ((front || frontB) && P && (yt > P.top - 0.3 || yb < P.deck + 0.08) && w.block && w.block.z1 === L.main.z1) e[j] = Math.min(e[j], 0.03);
    } else if (P && P.wrap) {
      const x = w.P(0)[0], end = P.wrap === 'right' ? 1 : 0, at = w.side === 'front' ? end : 1 - end;
      if (w.side === 'front' && (yt > P.top - 0.3 || yb < P.deck + 0.08)) e[at] = Math.min(e[at], 0.03);
      void x;
    }
    let spans = [[w.a0 - e[0], w.a1 + e[1]]];
    for (const o of w.opens) if (i >= o.c0 && i <= o.c1) spans = cutSpans(spans, o.a0, o.a1, 0.05);
    for (const [s, f] of spans) {
      const len = f - s, mid = (s + f) / 2;
      const mk = [w.a0 + 0.3, w.a1 - 0.3, ...w.opens.flatMap((o) => [o.a0 - 0.02, o.a1 + 0.02])].map((x) => x - mid);
      if (L.round) {
        // a round log: an eight-sided pole lying along the wall, in pieces of up to 2 m (end to end, the grain running on
        // through) so the baked shading has rows of corners along it
        const tone = L.r.logTone, rad = h * 0.58, yc = (yb + yt) / 2 + 0.01, out = -rad - k.r(0, 0.02), tint = vary(k, tone === 'grey' ? LOG_GREY.map((q) => q * 0.98) : tone === 'dark' ? ROUNDT.map((q) => q * 0.74) : ROUNDT, 0.86, 1.12), strip = [10, 11, 1, 3, 5, 9][Math.floor(k.R() * 6)], uS = k.r(0, 1.2);
        const poly = ngon(8, rad, 0.06, k.R), n = Math.max(1, Math.ceil(len / (far ? 9 : 2.0))), rot = [k.r(-0.02, 0.02), 0, k.r(-0.004, 0.004)];
        for (let q = 0; q < n; q++) {
          const a = s + len * q / n, b = s + len * (q + 1) / n;
          const skip = (q > 0 ? '-y' : '') + (q < n - 1 ? '+y' : '');
          k.prism('wood', poly, b - a + (q < n - 1 ? 0.002 : 0), null, null, { m: mul(wallM(w.f, (a + b) / 2, yc, out, rot), RZ(-Math.PI / 2)), tint, smooth: true, strip, uShift: uS, ends: 'log', skip, round: true, bleach: 0.45 });
        }
        k.solid([len, h, rad * 2], null, null, wallM(w.f, mid, yc, out));
      } else {
        const t = k.r(0.2, 0.28), hh = h * k.r(0.9, 1.0), dy = k.r(-0.5, 0.5) * (h - hh);
        const rot = [k.r(-0.03, 0.03), k.r(-0.005, 0.005), k.r(-0.004, 0.004) * (len > 2 ? 1 : 2)];
        const tone = L.r.logTone, grey = k.R() < (tone === 'grey' ? 0.75 : 0.22), tint = (grey ? LOG_GREY : LOG).map((x) => x * k.r(0.86, 1.14) * (tone === 'dark' ? 0.74 : tone === 'grey' ? 1.04 : 1));
        k.board([len, hh, t], null, null, { m: wallM(w.f, mid, (yb + yt) / 2 + dy + k.r(-0.01, 0.01), k.r(-0.015, 0.015) - t / 2, rot), long: 0, tint, round: true, ends: 'log', bleach: 0.45, strip: [10, 11, 1, 3, 5, 9][Math.floor(k.R() * 6)], cuts: far ? [] : cutsFor(len, mk), segFaces: '+z-z', skip: far && !w.inner ? '-z' : '' });
        k.solid([len, h + 0.04, 0.24], null, null, wallM(w.f, mid, (yb + yt) / 2 + 0.02, -0.13));
      }
    }
    // THE CHINKING over this log (hewn only): clay in the gap, set back from the logs' faces, one strip on the outside
    // and one on the inside, cut round the openings; here and there a piece has fallen out and the dark gap shows
    if (!L.round && i < cs.length - 1) {
      const y0 = yt - 0.012, y1 = cs[i + 1].y0 + 0.012;
      let sp = [[w.a0 + 0.12, w.a1 - 0.12]];
      for (const o of w.opens) if (i >= o.c0 - 1 && i <= o.c1) sp = cutSpans(sp, o.a0 + 0.02, o.a1 - 0.02, 0.05);
      if (far) continue;
      for (const [s, f] of sp) {
        let a = s;
        while (a < f - 0.05) {
          const b = Math.min(f, a + k.r(0.9, 2.2)), gone = !w.inner && b < f - 0.6 && k.R() < 0.25;
          const len = b - a, mid = (a + b) / 2, g = gone ? Math.min(f - b, k.r(0.15, 0.35)) : 0;
          k.box('plaster', [len, y1 - y0, 0.06], null, null, { m: wallM(w.f, mid, (y0 + y1) / 2, -0.058, [k.r(-0.02, 0.02), 0, 0]), tint: vary(k, c.chink, 0.86, 1.08), mortar: true, skip: '-z+y-y+x-x', cuts: cutsFor(len, [], 1.4), segFaces: '+z', long: 0 });
          if (g > 0.05) k.box('plaster', [g, y1 - y0, 0.04], null, null, { m: wallM(w.f, b + g / 2, (y0 + y1) / 2, -0.11), tint: onMean(SOOT, c.env.texMean), mortar: true, skip: '-z+y-y+x-x', long: 0 });
          a = b + g;
        }
        // (inside: one strip, a little further back than the thinnest log's face)
        const cl = cutsFor(f - s, [], 1.2);
        k.box('plaster', [f - s, y1 - y0, 0.05], null, null, { m: wallM(w.f, (s + f) / 2, (y0 + y1) / 2, -0.165), tint: vary(k, c.chink, 0.8, 0.95), mortar: true, skip: '+z+y-y+x-x', cuts: cl, segFaces: '-z', long: 0, inside: true });
      }
    }
  }
  // the far look: the chinking is one sheet behind the logs, the whole wall long and high
  if (far && !L.round) {
    let sp = [[w.a0 + 0.12, w.a1 - 0.12]];
    const top = cs[cs.length - 1].y1, bot = cs[0].y1;
    k.box('plaster', [w.a1 - w.a0 - 0.24, top - bot, 0.04], null, null, { m: wallM(w.f, (w.a0 + w.a1) / 2, (top + bot) / 2, -0.08), tint: vary(k, c.chink, 0.9, 1.0), mortar: true, skip: '-z+y-y+x-x', long: 0 });
    void sp;
  }
}

// THE BOARDS OVER A LOG WALL, up to the roof (a gable's triangle, or a shed roof's end): upright boards each its own
// width with a gap beside the odd one, cut to the roof line, over a dark backing; none behind a chimney's stack
function gableBoards(c, w) {
  const { k, L } = c, base = w.levelTop - 0.08, lo = Math.min(w.a0, w.a1), hi = Math.max(w.a0, w.a1);
  const top = (a) => w.topAt(a) - 0.015;
  const stacks = L.chims.filter((ch) => ch.wall === w && ch.side).map((ch) => { const a = w.side === 'right' ? -ch.z : ch.z; return [a - ch.sw / 2 + 0.03, a + ch.sw / 2 - 0.03]; });
  // (from the peak out each way, so the boards either side of a gable's peak each have one slope)
  const apexA = L.r.roof === 'gable' ? (w.side === 'right' ? 0 : w.side === 'left' ? 0 : (lo + hi) / 2) : lo;
  const wingApex = L.wing && w === L.wing.walls.end ? (L.wing.front ? L.wing.xc : -L.wing.xc) : null, ap = wingApex ?? apexA;
  for (const dir of L.r.roof === 'gable' ? [1, -1] : [1]) {
    let a = ap;
    while (dir > 0 ? a < hi : a > lo) {
      const bw = Math.min(k.r(0.2, 0.34), dir > 0 ? hi + 0.03 - a : a - lo + 0.03); if (bw < 0.05) break;
      const ac = a + dir * bw / 2, h = top(ac) - base, slope = (top(ac + 0.05) - top(ac - 0.05)) / 0.1;
      const hidden = stacks.some(([s, e]) => ac > s && ac < e);
      if (h > 0.05 && !hidden) wb(k, w, [bw, h, 0.025], ac, base + h / 2, 0.03, [0, 0, k.r(-0.006, 0.006)], { long: 1, tint: vary(k, BOARD, 0.85, 1.12), skip: '-z', slope });
      a += dir * (bw + (k.R() < 0.15 ? k.r(0.03, 0.05) : k.r(0.006, 0.02)));
    }
  }
  // the backing (seen only through the gaps): one dark shape, the wall's width up to the roof line
  const pts = [[lo + 0.01, 0], [hi - 0.01, 0], [hi - 0.01, -(top(hi) - base - 0.02)]];
  if (L.r.roof === 'gable') pts.push([ap, -(top(ap) - base - 0.02)]);
  pts.push([lo + 0.01, -(top(lo) - base - 0.02)]);
  const poly = pts.filter((p, i) => i < 2 || -p[1] > 0.01);
  if (poly.length >= 3) k.prism('wood', poly, 0.01, null, null, { m: mul(wallM(w.f, 0, base + 0.004, 0.008), RX(Math.PI / 2)), tint: [0.22, 0.19, 0.17], skip: '-y' });
  // (the attic, for the light)
  const n = 5; for (let i = 0; i < n; i++) { const y0 = base + i * (top(ap) - base) / n, y1 = y0 + (top(ap) - base) / n; k.solid([hi - lo, y1 - y0, 0.06], null, null, wallM(w.f, (lo + hi) / 2, (y0 + y1) / 2, -0.04)); }
}

// A BOARD WALL (board and batten, or lap siding, up to its level top and board and batten over it to the roof), its
// corner boards, and its inside: the boards' bare backs (board and batten) or a plank lining (lap siding)
function boardWall(c, w) {
  const { k, L } = c, paint = c.paint, lo = Math.min(w.a0, w.a1), hi = Math.max(w.a0, w.a1), y0 = L.FT - 0.04;
  const opens = w.opens.map((o) => ({ ...o, y0: o.kind === 'door' ? -1 : o.y0 }));
  const rowsAt = [1.3, 2.3, 3.3];
  const tint = w.lean ? BARE.map((x) => x * 0.96) : BARE;
  // (a wall another room stands against all along is inside that room: never the outside's paint)
  const covered = w.covered.some(([s, e]) => s <= lo + 0.05 && e >= hi - 0.05);
  const lpaint = (w.lean && L.log) || covered ? null : paint;
  if (w.kind === 'lap') {
    lapSiding(k, w.f, { a0: lo, a1: hi, y0, tops: [[lo, hi, w.levelTop + 0.04]], opens, paint: lpaint, tint, bare: 0.04, origin: lo });
    if (w.topAt(lo) > w.levelTop + 0.1 || w.topAt((lo + hi) / 2) > w.levelTop + 0.1) {
      boardAndBatten(k, w.f, { a0: lo, a1: hi, y0: w.levelTop + 0.02, top: (a) => w.topAt(a) + 0.012, apex: L.r.roof === 'gable' ? (lo + hi) / 2 : undefined, paint: lpaint, tint, inTint: null, rows: [w.levelTop + 0.9] });
      wb(k, w, [hi - lo + 0.04, 0.12, 0.03], (lo + hi) / 2, w.levelTop + 0.04, 0.03, null, { long: 0, tint: vary(k, TRIM, 0.85, 1.0), paint: lpaint, skip: '-z', outside: true });
    }
    if (!c.far) lining(c, w, lo + L.T - 0.02, hi - L.T + 0.02, L.FL, L.CEIL, w.opens);
  } else {
    const apex = L.r.roof === 'gable' && w.gable ? (L.wing && w === L.wing.walls.end ? (L.wing.front ? L.wing.xc : -L.wing.xc) : (lo + hi) / 2) : undefined;
    boardAndBatten(k, w.f, { a0: lo, a1: hi, y0, top: (a) => Math.max(w.levelTop, w.gable || w.lean ? w.topAt(a) : w.levelTop) + 0.012, apex, opens, paint: lpaint, tint, inTint: c.far ? null : INNER, rows: rowsAt.filter((y) => y < w.levelTop), bare: 0.05 });
  }
  // the corner boards, at both ends, on the outside; the sill along the foot
  for (const [a, s] of [[lo, 1], [hi, -1]]) {
    const yt = w.levelTop + (w.gable ? 0 : 0.02), h = yt - y0;
    wb(k, w, [0.12, h, 0.03], a + s * 0.06, y0 + h / 2, 0.035, null, { long: 1, tint: vary(k, TRIM, 0.85, 1.05), paint: lpaint, skip: '-z-y', cuts: [-1.2, 0, 1.2].filter((x) => Math.abs(x) < h / 2 - 0.3), segFaces: '+z', outside: true });
  }
  if (!w.lean || L.r.room !== 'back') wb(k, w, [hi - lo + 0.02, 0.16, 0.12], (lo + hi) / 2, L.FT - 0.06, -0.04, null, { long: 0, tint: vary(k, FRAME, 0.75, 0.9), strip: 10, skip: '-z' });
}
// a plank lining inside a wall, its boards across, cut round the openings
function lining(c, w, a0, a1, y0, y1, opens) {
  const { k, L } = c, bh = 0.24, inset = -L.T;
  for (let yb = y0; yb < y1 - 0.02; yb += bh) {
    const h = Math.min(bh, y1 - yb);
    let spans = [[a0, a1]];
    for (const op of opens) if (yb < op.y1 - 0.01 && yb + h > op.y0 + 0.01) spans = cutSpans(spans, op.a0, op.a1, 0.03);
    for (const [s, e] of spans) {
      const len = e - s, ac = (s + e) / 2, cl = []; for (let q = -len / 2 + 1.4; q < len / 2 - 0.4; q += 1.4) cl.push(q);
      k.board([len + 0.003, h + 0.004, 0.02], null, null, { m: mul(wallM(w.f, ac, yb + h / 2, inset), RY(Math.PI)), long: 0, tint: vary(k, INNER, 0.84, 1.12), strip: Math.floor(k.R() * 12), uShift: k.r(0, 1.2), skip: '-z+x-x+y-y', cuts: cl, segFaces: '+z', inside: true, hz: [-(ac - a0), 2] });
    }
  }
}

// ── the openings: frames, doors, windows, shutters ───────────────────────────────────────────────────────────────────
// the frame round an opening in a log wall: rough boards lining its sides (a little proud of the logs, so they read as
// the frame), a header board over it and a thin drip cap; a threshold under a door that starts below the floor
function logFrame(c, w, o) {
  const { k, L } = c, h = o.y1 - o.y0, wd = o.a1 - o.a0, ac = (o.a0 + o.a1) / 2, dep = L.T + 0.04;
  const tint = o.kind === 'hearth' ? DARKW.map((x) => x * 0.7) : DARKW;
  for (const a of [o.a0 + 0.035, o.a1 - 0.035]) wb(k, w, [0.07, h + 0.02, dep], a, o.y0 + h / 2, -dep / 2 + 0.025, [0, 0, k.r(-0.01, 0.01)], { long: 1, tint });
  if (o.kind === 'hearth' || o.inner) {
    // (a doorway between rooms, or a fireplace: the frame's face boards on both sides, no drip cap)
    for (const out of [0.03, -L.T - 0.01]) {
      for (const [a, s] of [[o.a0, -1], [o.a1, 1]]) wb(k, w, [0.09, h + 0.16, 0.03], a + s * 0.035, o.y0 + h / 2 + 0.03, out, [0, 0, k.r(-0.008, 0.008)], { long: 1, tint, skip: out > 0 ? '-z' : '+z', inside: out < 0 });
      wb(k, w, [wd + 0.26, 0.12, 0.03], ac, o.y1 + 0.06, out, [0, 0, k.r(-0.01, 0.01)], { long: 0, tint, skip: out > 0 ? '-z' : '+z', inside: out < 0 });
    }
    if (o.kind === 'door' && o.y0 < L.FL - 0.02) wb(k, w, [wd - 0.14, L.FL - o.y0, dep], ac, (o.y0 + L.FL) / 2, -dep / 2 + 0.025, null, { long: 0, tint: FRAME.map((x) => x * 0.8) });
    return;
  }
  for (const [a, s] of [[o.a0, -1], [o.a1, 1]]) wb(k, w, [0.09, h + 0.2, 0.03], a + s * 0.035, o.y0 + h / 2 + 0.04, 0.03, [0, 0, k.r(-0.008, 0.008)], { long: 1, tint, skip: '-z' });
  wb(k, w, [wd + 0.26, 0.12, 0.03], ac, o.y1 + 0.08, 0.03, [0, 0, k.r(-0.01, 0.01)], { long: 0, tint, skip: '-z' });
  wb(k, w, [wd + 0.36, 0.03, 0.1], ac, o.y1 + 0.155, 0.06, [k.r(0.02, 0.06), 0, k.r(-0.01, 0.01)], { long: 0, tint });
  // (inside: a casing board up each side and over the top)
  if (!c.far) {
    for (const [a, s] of [[o.a0, -1], [o.a1, 1]]) wb(k, w, [0.08, h + 0.08, 0.025], a + s * 0.03, o.y0 + h / 2 + 0.02, -L.T - 0.005, null, { long: 1, tint, skip: '+z', inside: true });
    wb(k, w, [wd + 0.2, 0.1, 0.025], ac, o.y1 + 0.05, -L.T - 0.005, null, { long: 0, tint, skip: '+z', inside: true });
  }
  if (o.kind === 'door') {
    if (o.y0 < L.FL - 0.02) wb(k, w, [wd - 0.14, L.FL - o.y0 + 0.01, dep], ac, (o.y0 + L.FL) / 2, -dep / 2 + 0.025, null, { long: 0, tint: FRAME.map((x) => x * 0.8) });
    return;
  }
  // a window's sill, standing out to throw the rain clear, and under it a board with a notch cut in its lower edge
  wb(k, w, [wd + 0.26, 0.05, dep + 0.08], ac, o.y0 - 0.005, -dep / 2 + 0.07, [k.r(-0.03, 0.01), 0, k.r(-0.02, 0.02)], { long: 0, tint });
  for (const sgn of [-1, 1]) wb(k, w, [wd / 2 + 0.08, 0.09, 0.03], ac + sgn * (wd / 4 + 0.05), o.y0 - 0.075, 0.03, null, { long: 0, tint, skip: '-z' });
  wb(k, w, [0.07, 0.04, 0.03], ac, o.y0 - 0.05, 0.03, null, { long: 0, tint, skip: '-z' });
  c.sills.push({ w, a0: o.a0 - 0.13, a1: o.a1 + 0.13, y: o.y0 - 0.03 });
}

// a window's sash: a frame, glazing bars (cols x rows panes), the glass glowing from inside at night; the glass seen
// from inside is a faint pane of its own. `out`: where it sits in the wall
export function sash(c, w, o, cols, rows, out) {
  const { k } = c, wd = o.a1 - o.a0 - 0.02, h = o.y1 - o.y0 - 0.02, ac = (o.a0 + o.a1) / 2, yc = (o.y0 + o.y1) / 2, tint = c.trimTint;
  k.parts.glow.push({ size: [wd - 0.04, h - 0.04, 0], m: wallM(w.f, ac, yc, out - 0.012), pane: true, kind: GLOW.window, col: [1.8, 0.7, 0.18] });
  if (!c.far) c.panes.push(mul(wallM(w.f, ac, yc, out - 0.02), RY(Math.PI)), [wd - 0.04, h - 0.04]);
  for (const s of [-1, 1]) wb(k, w, [0.05, h, 0.045], ac + s * (wd / 2 - 0.025), yc, out, null, { long: 1, tint, paint: c.trimPaint });
  for (const y of [o.y0 + 0.035, o.y1 - 0.035]) wb(k, w, [wd - 0.1, 0.055, 0.045], ac, y, out, null, { long: 0, tint, paint: c.trimPaint });
  for (let i = 1; i < cols; i++) wb(k, w, [0.03, h - 0.08, 0.035], o.a0 + 0.01 + wd * i / cols, yc, out, null, { long: 1, tint, paint: c.trimPaint });
  for (let i = 1; i < rows; i++) wb(k, w, [wd - 0.08, 0.03, 0.035], ac, o.y0 + 0.01 + h * i / rows, out, null, { long: 0, tint, paint: c.trimPaint });
}

// a board shutter standing open against the wall beside its window: two planks on two battens, long iron strap hinges
// (side -1: to the left of the window). One in a few has lost its bottom hinge and hangs crooked.
function shutter(c, w, pa, py, wid, hgt, side, crooked) {
  const { k } = c, P = wallM(w.f, pa, py, 0.03, [0, 0, -side * crooked]);
  const tint = c.shutterPaint ? DARKW : DARKW.map((x) => x * 1.06), paint = c.shutterPaint;
  const add = (size, dx, dy, dz, opt) => k.board(size, null, null, { m: mul(P, T(dx, dy, dz)), skip: '-z', tint, paint, ...opt });
  const pw = wid / 2;
  for (let q = 0; q < 2; q++) add([pw - 0.008, hgt - q * k.r(0, 0.05), 0.024], side * (q + 0.5) * pw, -hgt / 2, 0.012, { long: 1 });
  for (const yy of [0.17, hgt - 0.17]) add([wid - 0.06, 0.085, 0.02], side * wid / 2, -yy, 0.034, { long: 0 });
  for (const yy of [0.17, hgt - 0.17]) k.box('iron', [wid * 0.75, 0.035, 0.008], null, null, { m: mul(P, T(side * wid * 0.375, -yy, 0.049)), tint: [1.25, 1.0, 0.85] });
}

// every opening of every wall: its frame, and a window's sash and shutters
function openings(c) {
  const { k, L } = c;
  for (const w of L.walls) for (const o of w.opens) {
    if (o.kind === 'mass') continue;
    const logW = w.kind === 'log';
    if (logW) logFrame(c, w, o);
    else if (o.kind === 'hearth' || o.inner) {
      // (a doorway in a board wall: a plain casing on both faces)
      for (const out of [0.025, -w.t - 0.01]) {
        const h = o.y1 - L.FL;
        for (const [a, s] of [[o.a0, -1], [o.a1, 1]]) wb(k, w, [0.09, h + 0.09, 0.025], a + s * 0.045, L.FL + h / 2 + 0.045, out, null, { long: 1, tint: c.trimTint, paint: c.trimPaint, skip: out > 0 ? '-z' : '+z', inside: out < 0 });
        wb(k, w, [o.a1 - o.a0 + 0.18, 0.1, 0.025], (o.a0 + o.a1) / 2, o.y1 + 0.05, out, null, { long: 0, tint: c.trimTint, paint: c.trimPaint, skip: out > 0 ? '-z' : '+z', inside: out < 0 });
      }
      for (const [a, s] of [[o.a0, 1], [o.a1, -1]]) wb(k, w, [0.025, o.y1 - L.FL, w.t + 0.04], a + s * 0.0125, (o.y1 + L.FL) / 2, -w.t / 2 + 0.01, null, { long: 1, tint: c.trimTint, skip: '-y+y' });
      wb(k, w, [o.a1 - o.a0, 0.025, w.t + 0.04], (o.a0 + o.a1) / 2, o.y1 + 0.0125, -w.t / 2 + 0.01, null, { long: 0, tint: c.trimTint, skip: '+y' });
      continue;
    } else {
      casing(k, w.f, { ...o, y0: o.kind === 'door' ? L.FL : o.y0, door: o.kind === 'door' }, { tint: c.trimTint, depth: w.t + 0.06, width: 0.1 });
      if (o.kind === 'window') c.sills.push({ w, a0: o.a0 - 0.15, a1: o.a1 + 0.15, y: o.y0 - 0.06 });
      if (o.kind === 'door' && !c.far) for (const [a, s] of [[o.a0, -1], [o.a1, 1]]) wb(k, w, [0.08, o.y1 - L.FL + 0.08, 0.02], a + s * 0.04, (o.y1 + L.FL) / 2 + 0.04, -w.t - 0.005, null, { long: 1, tint: c.trimTint, skip: '+z', inside: true });
    }
    if (o.kind === 'window') {
      const glass = L.r.windows === 'glass';
      sash(c, w, o, glass ? 2 : 2, glass ? 3 : 2, logW ? -0.12 : -w.t / 2 + 0.01);
      if (!glass) {
        const wd = o.a1 - o.a0, crooked = k.R() < 0.2 ? 0.1 : 0;
        for (const side of [-1, 1]) shutter(c, w, side < 0 ? o.a0 - 0.08 : o.a1 + 0.08, o.y1 + 0.02, wd / 2 + 0.05, o.y1 - o.y0 + 0.06, side, side > 0 ? crooked : 0);
      }
    }
  }
}

// THE DOORS that swing (the front doors, the back door): each its own kit and mesh, built round its hinge in the
// wall's turn, hung on the inside of the opening, opening in. Planks on battens with a Z brace, strap hinges, a latch.
function doorLeaves(c) {
  const { L } = c;
  for (const w of L.walls) for (const o of w.opens) {
    if (!o.leaf) continue;
    const side = o.hingeSide ?? (c.k.R() < 0.5 ? 1 : -1), dw = o.a1 - o.a0 - (w.kind === 'log' ? 0.14 : 0.03), h = o.y1 - L.FL - 0.02;
    const ha = side > 0 ? o.a0 + (w.kind === 'log' ? 0.07 : 0.015) : o.a1 - (w.kind === 'log' ? 0.07 : 0.015);
    const hinge = w.P(ha, L.FL + 0.01, -w.t + 0.06);
    const seed = c.r.seed * 31 + c.leaves.length * 7 + 3, lk = new Kit(seed); lk.parts.glow = [];
    doorLeaf(lk, { w: dw, h, side, tint: c.doorPaint ? [0.5, 0.42, 0.36] : DOORW, strap: STRAP, handle: true, rails: [0.3, h - 0.32] });
    // (a painted door: its planks take the paint, the battens and braces too)
    if (c.doorPaint) for (const P of lk.parts.wood) if (!P.o.paint) P.o.paint = vary(lk, c.doorPaint, 0.9, 1.06);
    const Rw = RY(w.f.th);
    for (const P of lk.parts.wood) P.m.premultiply(Rw);
    const geo = buildGeometry(lk.parts.wood, 'wood', rng(seed + 1), { topAt: () => 9, tintAt: (x, y, z, t, op) => tintAt(x, y, z, t, op) });
    const open = side * (o.leaf === 'back' ? 95 : 100) * D2R;
    c.leaves.push({ group: o.leaf, geo, glass: null, hinge, open, closed: 0, parts: lk.parts.wood.length, w: dw, h, wall: w.side, name: o.name });
    o.hinge = hinge;
  }
}

// ── the roofs ────────────────────────────────────────────────────────────────────────────────────────────────────────
// ONE SLOPE, built in its own frame (its top edge along x at height topY, z = 0, running down toward +z) and moved into
// place by M. o: x0, x1, topY, len, pitch; eaveS (how far up the slope the wall stands: past it, the eave overhang);
// inX0, inX1 (the walls' ends along the ridge: past them, the gable overhangs); keep(p) (a world point: false where
// another roof or a chimney is, nothing laid there); cover 'shakes' or 'boards'; sheath 'eave' (boards under it only where
// they show: the overhangs) or 'all' (a lean-to, seen from inside); barge [at x0, at x1]; purlins (pole ends under the
// gable overhangs: a log cabin's); comb (its top course runs past the peak); topEdge (a shed roof's high edge: a fascia)
export function slope(c, M, o) {
  const { k } = c, far = c.far, { x0, x1, topY, len, pitch } = o;
  const sp = Math.sin(pitch), cp = Math.cos(pitch);
  const up = new THREE.Vector3(0, sp, -cp), nrm = new THREE.Vector3(0, cp, sp);
  const eave = new THREE.Vector3(0, topY - len * sp, len * cp);
  const at = (x, s, n) => eave.clone().addScaledVector(up, s).addScaledVector(nrm, n).setX(x);
  const Rp = RX(pitch), _w = new THREE.Vector3();
  const frame = (x, s, n, extra) => { const m = mul(M, T(...at(x, s, n).toArray()), Rp); if (extra) m.multiply(extra); return m; };
  const world = (x, s, n = 0) => _w.copy(at(x, s, n)).applyMatrix4(M);
  const keep = o.keep || (() => true);
  const wood = (size, x, s, n, extra, opt) => k.board(size, null, null, { ...opt, m: frame(x, s, n, extra) });
  const eaveS = o.eaveS ?? len, inX0 = o.inX0 ?? x0, inX1 = o.inX1 ?? x1, all = o.sheath === 'all';
  // the sheathing: wide boards across the slope, only their undersides drawn
  if (far) {
    if (eaveS > 0.05) wood([x1 - x0, 0.024, eaveS], (x0 + x1) / 2, eaveS / 2, -0.012, null, { long: 0, tint: DARKW, skip: '+y' });
    if (o.topS) wood([x1 - x0, 0.024, o.topS], (x0 + x1) / 2, len - o.topS / 2, -0.012, null, { long: 0, tint: DARKW, skip: '+y' });
  } else for (let s = 0; s < len - 0.02;) {
    const ds = Math.min(k.r(0.32, 0.46), len - s), full = all || s < eaveS + 0.02 || (o.topS && s + ds > len - o.topS);
    const j1 = x0 + (x1 - x0) * k.r(0.25, 0.4), j2 = x0 + (x1 - x0) * k.r(0.6, 0.75);
    const pieces = full ? [[x0, j1], [j1, j2], [j2, x1]] : [...(inX0 > x0 + 0.05 ? [[x0, inX0 + 0.3]] : []), ...(inX1 < x1 - 0.05 ? [[inX1 - 0.3, x1]] : [])];
    for (const [a, b] of pieces) {
      // (cut where another roof takes over: each board in short lengths so the cut follows it)
      const n = Math.max(1, Math.ceil((b - a) / 1.2));
      for (let q = 0; q < n; q++) {
        const pa = a + (b - a) * q / n, pb = a + (b - a) * (q + 1) / n;
        if (!keep(world((pa + pb) / 2, s + ds / 2, 0), 'sheath')) continue;
        wood([pb - pa - 0.004, 0.024, ds - 0.006], (pa + pb) / 2, s + ds / 2, -0.012, null, { long: 0, tint: vary(k, o.boardT || DARKW, 0.88, 1.1), skip: '+y' + (q > 0 ? '-x' : '') + (q < n - 1 ? '+x' : ''), inside: all && o.inside, cuts: all ? cutsFor(pb - pa, [], 1.2) : [], segFaces: '-y' });
      }
      void pieces;
    }
    s += ds;
  }
  if (!o.noSolid) for (let q = 0; q < 6; q++) { const a = x0 + (x1 - x0) * q / 6, b = a + (x1 - x0) / 6; if (keep(world((a + b) / 2, len / 2, 0), 'solid')) k.solid([b - a, 0.1, len], null, null, frame((a + b) / 2, len / 2, -0.07)); }
  // over the attic, where the sheathing is left out, a dark underlay (seen only through a gap or a missing shake)
  if (!all && !far && eaveS < len - 0.1) {
    const a = inX0 + 0.25, b = inX1 - 0.25, s0 = eaveS, s1 = len - (o.topS || 0) + 0.02;
    k.box('wood', [b - a, 0.01, s1 - s0], null, null, { m: frame((a + b) / 2, (s0 + s1) / 2, -0.004), tint: [0.2, 0.18, 0.16], skip: '-y+x-x+z-z', cuts: [-2.2, -1.1, 0, 1.1, 2.2], long: 0, strip: 10 });
  }
  // rafters: their tails under the eave overhang (or right up a lean-to, seen from inside), every 60 cm
  if (!far) {
    const every = 0.6, n = Math.max(2, Math.round((inX1 - inX0 - 0.2) / every));
    for (let i = 0; i <= n; i++) {
      const x = inX0 + 0.1 + (inX1 - inX0 - 0.2) * i / n, L2 = all ? len - 0.04 : Math.min(len, eaveS + 0.45);
      if (L2 < 0.1 || !keep(world(x, L2 / 2, -0.1), 'rafter')) continue;
      const sz = o.poleRafters ? 0.11 : 0.06;
      wood([sz, o.poleRafters ? 0.11 : 0.14, L2], x, L2 / 2 + 0.01, -0.024 - (o.poleRafters ? 0.055 : 0.07), null, { long: 2, tint: vary(k, o.rafterT || DARKW, 0.85, 1.05), strip: 10 + (i % 2), skip: '+y-z' + (all ? '' : '+z'), ends: 'log', inside: all && o.inside, cuts: cutsFor(L2, [], 1.4), segFaces: '-y+x-x' });
    }
  }
  if (o.cover === 'boards') {
    // BOARDS AND BATTENS: wide boards running down the slope side by side, a narrow batten over each joint
    const rc = cutsFor(len, [], far ? 9 : 1.2);
    for (let x = x0 - 0.03; x < x1 + 0.02;) {
      const bw = Math.min(far ? k.r(0.5, 0.8) : k.r(0.22, 0.32), x1 + 0.03 - x); if (bw < 0.05) break;
      const L2 = len + 0.06 + k.r(-0.02, 0.03), cx = x + bw / 2;
      if (keep(world(cx, len / 2, 0.02))) {
        wood([bw + 0.006, 0.025, L2], cx, len - L2 / 2 + 0.04, 0.0125, RY(k.r(-0.0012, 0.0012)), { long: 2, tint: vary(k, ROOFB, 0.8, 1.14), strip: Math.floor(k.R() * 10), uShift: k.r(0, 1.2), cuts: rc, segFaces: '+y', skip: '-y', roof: true });
        if (x + bw < x1 - 0.04) wood([0.07, 0.022, L2 - 0.03], x + bw, len - L2 / 2 + 0.04, 0.025 + 0.011, null, { long: 2, tint: vary(k, ROOFB, 0.65, 0.85), strip: 10 + (k.R() < 0.5 ? 1 : 0), skip: '-y', roof: true, cuts: rc, segFaces: '+y' });
      }
      x += bw;
    }
    // the fascia along the eave over the boards' ends
    wood([x1 - x0 + 0.04, 0.1, 0.03], (x0 + x1) / 2, 0.012, -0.03, RX(-pitch), { long: 0, tint: vary(k, ROOFW, 1.1, 1.3), strip: 10, outside: true, skip: '+z' });
  } else {
    // the starter strip at the eave: the first course needs something under its butts, and it gives the eave its edge
    for (const [a, b] of [[x0 - 0.04, x0 + (x1 - x0) * 0.4], [x0 + (x1 - x0) * 0.4, x0 + (x1 - x0) * 0.75], [x0 + (x1 - x0) * 0.75, x1 + 0.04]]) {
      if (keep(world((a + b) / 2, 0.1, 0))) wood([b - a, 0.07, 0.2], (a + b) / 2, 0.1, 0.035, null, { long: 0, tint: ROOFW, strip: WOOD.shake, skip: '-z' });
    }
    // SPLIT SHAKES in level courses (the frontier cabin's): each course rests its butts on the one below, so it tilts up
    // a little and throws the dark line under each course; a joint never right over one below; about half the boxes two
    // shakes side by side; now and then a wider gap; each its own shade, the lower courses darker. The far look: wider
    // boxes, half the courses' worth of joints
    let s = -0.06, row = 0, below = [];
    while (s < len - 0.1) {
      const e = k.r(0.34, 0.38), joints = [], last = s + e >= len - 0.12;
      let x = x0 - 0.03, first = true;
      while (x < x1 + 0.03) {
        const pair = !first && k.R() < 0.45;
        let wdt = far ? k.r(0.6, 1.3) : first ? k.r(0.06, 0.2) : pair ? k.r(0.26, 0.44) : k.r(0.12, 0.24);
        first = false;
        for (const j of below) if (Math.abs(x + wdt - j) < 0.03) wdt += 0.04;
        wdt = Math.min(wdt, x1 + 0.05 - x); if (wdt < 0.05) break;
        const gap = far ? 0.01 : k.R() < 0.04 ? k.r(0.025, 0.035) : k.r(0.005, 0.015);
        const th = k.r(0.025, 0.035), dL = k.r(-0.02, 0.02), L2 = last && o.comb ? len - s + dL + 0.08 : Math.min(e * 2.3, len - s + 0.03) + dL, lift = 0.5 * th / e, cx = x + (wdt - gap) / 2;
        if (keep(world(cx, s - dL + L2 / 2, 0))) {
          const extra = mul(RY(k.r(-0.018, 0.018)), RX(-lift));
          const m = frame(cx, s - dL + L2 / 2, th / 2 + 0.002 + (L2 / 2) * Math.sin(lift), extra);
          const rr = k.R(), g = k.r(0.9, 1.1), low = 0.78 + 0.22 * smooth01(s, 0, len * 0.6);
          const tint = (rr < 1 / 6 ? [0.84, 0.82, 0.8] : rr < 0.25 ? [1.14, 1.16, 1.18] : [1, 1, 1]).map((q, i) => q * g * low * SHAKE[i]);
          k.board([wdt - gap, th, L2], null, null, { m, long: 2, strip: pair || far ? WOOD.shake : WOOD.shake + Math.floor(k.R() * 2), span: pair || far ? 2 : 1, tint, uShift: k.r(0, 1.2), shakeE: e + dL, skip: row === 0 || (last && o.comb) ? '-z+x-x' : '-y-z+x-x', bleach: 0.5 });
        }
        joints.push(x + wdt); x += wdt;
      }
      below = joints; s += e; row++;
    }
  }
  // barge boards along the gable ends, tucked under the courses' ends
  // (in pieces, so none runs on through a chimney's stack)
  for (const [x, on] of [[x0 + 0.025, o.barge && o.barge[0]], [x1 - 0.025, o.barge && o.barge[1]]]) if (on) {
    const n = Math.max(1, Math.ceil(len / 0.6)), turn = RY(k.r(-0.01, 0.01));
    for (let q = 0; q < n; q++) {
      const s0 = -0.02 + (len + 0.04) * q / n, s1 = -0.02 + (len + 0.04) * (q + 1) / n;
      if (keep(world(x, (s0 + s1) / 2, -0.078))) wood([0.045, 0.15, s1 - s0 + 0.002], x, (s0 + s1) / 2, -0.078, turn, { long: 2, tint: ROOFW, strip: WOOD.shake, skip: (q > 0 ? '-z' : '') + (q < n - 1 ? '+z' : '') });
    }
  }
  // purlins: poles along the roof, their ends out of the gables under the overhang
  if (o.purlins && !far) for (const [ss, r] of [[len * 0.45, 0.085], ...(o.ridgePole ? [[len - 0.02, 0.1]] : [])]) {
    for (const [xa, xb, on] of [[x0, inX0, o.barge && o.barge[0]], [inX1, x1, o.barge && o.barge[1]]]) {
      if (!on || xb - xa < 0.1) continue;
      const Lp = xb - xa + 0.15, xc = (xa + xb) / 2 + (xa === x0 ? 0.04 : -0.04);
      if ([0, 0.25, 0.5, 0.75, 1].some((f) => !keep(world(xa + (xb - xa) * f, ss, -0.1), 'rafter'))) continue;
      k.prism('wood', ngon(7, r, 0.15, k.R), Lp, null, null, { m: frame(xc, ss, -0.024 - r, mul(RX(-pitch), RZ(-Math.PI / 2))), tint: POLE.map((q) => q * 0.8), smooth: true, skip: '-y+y' });
    }
  }
  // a shed roof's high edge: a fascia board over the top, a flashing strip lying over the top course
  if (o.topEdge) {
    wood([x1 - x0 + 0.06, 0.16, 0.03], (x0 + x1) / 2, len + 0.01, -0.04, RX(-pitch), { long: 0, tint: vary(k, ROOFW, 1.1, 1.3), strip: 10, skip: '+z' });
    wood([x1 - x0 + 0.06, 0.02, 0.18], (x0 + x1) / 2, len - 0.07, 0.05, null, { long: 0, tint: vary(k, ROOFW, 0.9, 1.1), strip: WOOD.shake, roof: true });
  }
  return { at: (x, s, n) => at(x, s, n).applyMatrix4(M), frame };
}

// a tin flashing strip lying on a slope along a valley or a hip (from p0 to p1, world points on the roof planes): its
// normal n (the slope's), offset sideways into that slope by `side` (a world direction across the line)
function flashing(c, p0, p1, n, side, wdt = 0.24, lift = 0.045, tint = TIN, group = 'iron') {
  const Z = new THREE.Vector3().subVectors(p1, p0), Lx = Z.length(); Z.normalize();
  const Y = new THREE.Vector3(...n).addScaledVector(Z, -new THREE.Vector3(...n).dot(Z)).normalize(), X = new THREE.Vector3().crossVectors(Y, Z);
  const off = new THREE.Vector3(...side).normalize();
  const ctr = p0.clone().add(p1).multiplyScalar(0.5).addScaledVector(Y, lift).addScaledVector(off, wdt * 0.42);
  if (group === 'wood') c.k.board([wdt, 0.03, Lx], null, null, { m: new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(ctr), long: 2, tint, strip: WOOD.shake, skip: '-y', roof: true });
  else c.k.box('iron', [wdt, 0.008, Lx], null, null, { m: new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(ctr), tint, skip: '-y' });
}

function roofs(c) {
  const { L, r } = c, { main } = L, gable = r.roof === 'gable', log = L.log;
  const x0 = main.x0 - L.GX[0], x1 = main.x1 + L.GX[1];
  // (no shakes over a chimney's stack, nor through a stovepipe; the ones round its edge run on into it)
  const holes = L.chims.map((ch) => (ch.type === 'pipe' ? { x0: ch.x - 0.11, x1: ch.x + 0.11, z0: ch.z - 0.11, z1: ch.z + 0.11 }
    : ch.side ? { x0: ch.side < 0 ? ch.x - ch.sd + 0.06 : ch.x + 0.06, x1: ch.side < 0 ? ch.x - 0.06 : ch.x + ch.sd - 0.06, z0: ch.z - ch.sw / 2 + 0.06, z1: ch.z + ch.sw / 2 - 0.06 }
      : { x0: ch.x - ch.sw / 2 + 0.06, x1: ch.x + ch.sw / 2 - 0.06, z0: ch.z - ch.sd / 2 + 0.06, z1: ch.z + ch.sd / 2 - 0.06 }));
  const inHole = (p) => holes.some((h) => p.x > h.x0 && p.x < h.x1 && p.z > h.z0 && p.z < h.z1);
  const g = L.wing;
  // (the main roof's back slope gives way to the wing's roof between the valleys; the wing's slopes stop at the main roof)
  const sg = g ? g.sg : 0, ovw = g && g.front ? L.OVF : L.OVB;
  const underWing = (p) => { if (!g) return false; const q = sg * p.z - (r.d - g.Ww) / 2; return q > 0 && Math.abs(p.x - g.xc) < q && Math.abs(p.x - g.xc) < g.Ww / 2 + ovw + 0.5; };
  const keepMain = (p) => !inHole(p) && !underWing(p);
  const common = { x0, x1, inX0: main.x0, inX1: main.x1, pitch: L.pitch, cover: r.cover, barge: [true, true], purlins: log, poleRafters: log, rafterT: log ? POLE.map((q) => q * 0.85) : DARKW };
  if (gable) {
    const lenF = (r.d / 2 + L.OVF) / Math.cos(L.pitch), lenB = (r.d / 2 + L.OVB) / Math.cos(L.pitch);
    slope(c, T(0, 0.02, 0), { ...common, topY: L.RIDGE, len: lenF, eaveS: L.OVF / Math.cos(L.pitch), keep: keepMain, comb: true, ridgePole: log });
    slope(c, mul(T(0, 0.02, 0), RY(Math.PI)), { ...common, x0: -x1, x1: -x0, inX0: -main.x1, inX1: -main.x0, barge: [true, true], topY: L.RIDGE, len: lenB, eaveS: L.OVB / Math.cos(L.pitch), keep: keepMain });
    if (r.cover === 'boards') ridgeCap(c, x0, x1, L.RIDGE + 0.02, L.pitch, (p) => !inHole(p));
  } else {
    // one slope from over the front wall (and its overhang) down past the back wall
    const len = (r.d + L.OVF + L.OVB) / Math.cos(L.ps), topY = L.EAVE_H + L.OVF * L.tps;
    slope(c, mul(T(0, 0.02, main.z1 + L.OVF), RY(Math.PI)), { ...common, x0: -x1, x1: -x0, inX0: -main.x1, inX1: -main.x0, topY, len, pitch: L.ps, eaveS: L.OVB / Math.cos(L.ps), keep: keepMain, topEdge: true, topS: (L.OVF + 0.2) / Math.cos(L.ps) });
  }
  // THE WING'S ROOF: a gable along z at the same pitch (a lower ridge), from past its back wall to where its ridge meets
  // the main roof's back slope; tin valleys where they meet
  if (g) {
    // (sg: +1 a wing toward the street, -1 one at the back; zr: where its ridge meets the main roof)
    const half = (r.d - g.Ww) / 2, zr = sg * half, zEnd = g.front ? g.z1 + L.GX[0] : g.z0 - L.GX[0], lenW = (g.Ww / 2 + ovw) / Math.cos(L.pitch), es = ovw / Math.cos(L.pitch);
    const keepW = (p) => !inHole(p) && sg * p.z > half + Math.abs(p.x - g.xc) - 0.02;
    const zA = g.front ? zr - 0.4 : zEnd, zB = g.front ? zEnd : zr + 0.4, wA = g.front ? main.z1 : g.z0, wB = g.front ? g.z1 : main.z0;
    slope(c, mul(T(g.xc, 0.02, 0), RY(Math.PI / 2)), { ...common, x0: -zB, x1: -zA, inX0: -wB, inX1: -wA, topY: g.RW, len: lenW, eaveS: es, keep: keepW, barge: g.front ? [true, false] : [false, true], comb: true, ridgePole: false });
    slope(c, mul(T(g.xc, 0.02, 0), RY(-Math.PI / 2)), { ...common, x0: zA, x1: zB, inX0: wA, inX1: wB, topY: g.RW, len: lenW, eaveS: es, keep: keepW, barge: g.front ? [false, true] : [true, false], ridgePole: false });
    // the valleys: from the wing's eave corners (on the main eave line) up to where the ridges meet
    const tpp = L.tp, sx = 0.026 / Math.cos(L.pitch) + 0.03;
    for (const s of [-1, 1]) {
      const pa = new THREE.Vector3(g.xc + s * (g.Ww / 2 + ovw), L.EAVE - ovw * tpp + sx, sg > 0 ? main.z1 + ovw : main.z0 - ovw), pb = new THREE.Vector3(g.xc, g.RW + sx, zr);
      const nMain = [0, Math.cos(L.pitch), sg * Math.sin(L.pitch)], nWing = [s * Math.sin(L.pitch), Math.cos(L.pitch), 0];
      flashing(c, pa, pb, nMain, [0, 0, -sg], 0.26); flashing(c, pa, pb, nWing, [s, 0, 0], 0.26);
    }
    if (r.cover === 'boards') ridgeCap(c, -zB, -zA, g.RW + 0.02, L.pitch, () => true, mul(T(g.xc, 0, 0), RY(Math.PI / 2)));
  }
  // THE LEAN-TO'S ROOF: from just under the main eave, down past its outer wall; its undersides seen from inside
  if (L.lean) {
    const lt = L.lean, pl = lt.pitch, ov = 0.25, len = (lt.depth + ov) / Math.cos(pl), cover = r.cover;
    const o = { cover, pitch: pl, topY: lt.top, len, eaveS: ov / Math.cos(pl), sheath: 'all', inside: true, keep: (p) => !inHole(p), barge: [true, true], rafterT: FRAME, boardT: INNER.map((q) => q * 0.9) };
    if (lt.side === 'back') slope(c, mul(T(0, 0, main.z0 - 0.01), RY(Math.PI)), { ...o, x0: -lt.x1 - 0.18, x1: -lt.x0 + 0.18, inX0: -lt.x1, inX1: -lt.x0 });
    else if (lt.side === 'right') slope(c, mul(T(main.x1 + 0.01, 0, 0), RY(Math.PI / 2)), { ...o, x0: -lt.z1 - 0.15, x1: -lt.z0 + 0.15, inX0: -lt.z1, inX1: -lt.z0 });
    else slope(c, mul(T(main.x0 - 0.01, 0, 0), RY(-Math.PI / 2)), { ...o, x0: lt.z0 - 0.15, x1: lt.z1 + 0.15, inX0: lt.z0, inX1: lt.z1 });
    // the flashing along the top, where it meets the main wall
    const n = lt.side === 'back' ? [0, 0, -1] : lt.side === 'right' ? [1, 0, 0] : [-1, 0, 0];
    const a = lt.side === 'back' ? new THREE.Vector3(lt.x0 - 0.15, lt.top + 0.04, main.z0 - 0.01) : new THREE.Vector3(lt.side === 'right' ? main.x1 + 0.01 : main.x0 - 0.01, lt.top + 0.04, lt.z0 - 0.12);
    const b = lt.side === 'back' ? new THREE.Vector3(lt.x1 + 0.15, lt.top + 0.04, main.z0 - 0.01) : a.clone().setZ(lt.z1 + 0.12);
    const along = b.clone().sub(a).normalize(), nn = new THREE.Vector3(...n);
    c.k.box('iron', [b.distanceTo(a), 0.012, 0.16], null, null, { m: new THREE.Matrix4().makeBasis(along, new THREE.Vector3(0, 1, 0), along.clone().cross(new THREE.Vector3(0, 1, 0))).setPosition(a.clone().add(b).multiplyScalar(0.5).addScaledVector(nn, 0.07)), tint: TIN });
    c.k.box('iron', [b.distanceTo(a), 0.14, 0.012], null, null, { m: new THREE.Matrix4().makeBasis(along, new THREE.Vector3(0, 1, 0), along.clone().cross(new THREE.Vector3(0, 1, 0))).setPosition(a.clone().add(b).multiplyScalar(0.5).addScaledVector(nn, 0.008).add(new THREE.Vector3(0, 0.06, 0))), tint: TIN, skip: '' });
  }
}
// a ridge cap for a board roof: two boards along the ridge, one lying on each slope
function ridgeCap(c, x0, x1, y, pitch, keep, M = new THREE.Matrix4()) {
  for (const s of [1, -1]) c.k.board([x1 - x0 + 0.06, 0.025, 0.2], null, null, { m: mul(M, T((x0 + x1) / 2, y + 0.02, s * 0.08), RX(s * pitch)), long: 0, tint: vary(c.k, ROOFB, 0.7, 0.85), strip: 10, roof: true, cuts: cutsFor(x1 - x0, [], 1.4), segFaces: '+y' });
}

// ── the porch ────────────────────────────────────────────────────────────────────────────────────────────────────────
// ONE RUN OF PORCH, in its own frame M (local x along the wall, the wall's face at z = 0, the porch toward +z): a deck of
// boards running out from the wall on a rim, peeled-pole posts (or square posts on a frame house) on stone pads, a beam,
// its roof (its own slope from a ledger on the wall, or the main roof carried on down), pole rails, steps at the door.
// P: x0, x1 (along the wall), depth, deck, top, pitch, posts [x], steps [{ x, w }], keep (where a wrap's corner hips),
// roofX0, roofX1, rails, railEnds [left, right]
function porchRun(c, M, P) {
  const { k, L } = c, far = c.far, log = L.log, pd = P.depth, z1 = pd, postZ = pd - 0.16;
  const put = (size, pos, rot, o) => k.board(size, null, null, { ...o, m: mul(M, T(...pos), rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4()) });
  const prism = (poly, len, pos, rot, o) => k.prism('wood', poly, len, null, null, { ...o, m: mul(M, T(...pos), rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4()) });
  const DK = P.deck;
  // the deck: boards running out from the wall, 12 to 20 cm wide, the odd one in two lengths
  for (let x = P.x0; x < P.x1 - 0.04;) {
    const bw = Math.min(far ? k.r(0.4, 0.6) : k.r(0.12, 0.2), P.x1 - x), gap = far ? 0.005 : k.r(0.008, 0.013); if (bw < 0.05) break;
    const zEnd = z1 + k.r(0.02, 0.07), y = DK - 0.02 + k.r(-0.005, 0.004), tint = vary(k, DECKW, 0.85, 1.15);
    let pieces = [[0.005, zEnd]]; if (!far && k.R() < 0.4) { const j = k.r(0.5, zEnd - 0.5); pieces = [[0.005, j], [j, zEnd]]; }
    for (const [a, b] of pieces) put([bw - gap, 0.04, b - a - 0.006], [x + (bw - gap) / 2, y, (a + b) / 2], [k.r(-0.004, 0.004), k.r(-0.006, 0.006), k.r(-0.015, 0.015)], { long: 2, tint, lumJit: true, deck: true, skip: '-y', strip: WOOD.shake + Math.floor(k.R() * 2), uShift: k.r(0, 1.2) });
    x += bw;
  }
  put([P.x1 - P.x0 + 0.1, 0.22, 0.09], [(P.x0 + P.x1) / 2, DK - 0.15, z1 - 0.05], null, { long: 0, tint: DECKW.map((q) => q * 0.85), strip: WOOD.shake + 1 });
  for (const [x, on] of [[P.x0 - 0.0, P.railEnds[0]], [P.x1, P.railEnds[1]]]) if (on) put([0.09, 0.22, pd - 0.06], [x, DK - 0.15, pd / 2 - 0.03], null, { long: 2, tint: DECKW.map((q) => q * 0.85), strip: WOOD.shake });
  k.box('wood', [P.x1 - P.x0 - 0.1, Math.max(0.05, DK - 0.16), pd - 0.2], null, null, { m: mul(M, T((P.x0 + P.x1) / 2, Math.max(0.05, DK - 0.16) / 2, (pd - 0.2) / 2)), tint: SHADOW, skip: '-y', long: 0 });
  k.solid([P.x1 - P.x0, DK, pd], null, null, mul(M, T((P.x0 + P.x1) / 2, DK / 2, pd / 2)));
  // the roof: its rafters and boards (seen from below), the shakes or boards; from a ledger on the wall, or carried
  // down from the main eave (a shed porch)
  const rTop = P.top, rp = P.pitch, lenP = (pd + 0.3) / Math.cos(rp);
  const rX0 = P.roofX0 ?? P.x0 - 0.2, rX1 = P.roofX1 ?? P.x1 + 0.2;
  slope(c, mul(M, T(0, 0, 0.02)), { x0: rX0, x1: rX1, topY: rTop, len: lenP, pitch: rp, cover: L.r.cover, eaveS: lenP, keep: P.keep, barge: [P.railEnds[0], P.railEnds[1]], rafterT: log ? DARKW : FRAME, sheath: 'all', poleRafters: log, boardT: DECKW });
  if (P.ledger !== false) put([rX1 - rX0, 0.16, 0.1], [(rX0 + rX1) / 2, rTop - 0.13, 0.05], null, { long: 0, tint: log ? LOG : FRAME, strip: 11 });
  // the beam on the posts (where the rafters are over the posts), the posts, their stone pads
  const beamTop = rTop - (postZ - 0.02) * Math.tan(rp) - (0.024 + 0.11) / Math.cos(rp), beamY = beamTop - 0.1;
  const bx = P.beamX ?? [P.x0 - 0.18, P.x1 + 0.18];
  put([bx[1] - bx[0], 0.2, 0.2], [(bx[0] + bx[1]) / 2, beamY, postZ], [k.r(-0.008, 0.008), k.r(-0.006, 0.006), 0], { long: 0, tint: log ? LOG : FRAME, strip: 10, cuts: cutsFor(bx[1] - bx[0], [], 1.6), segFaces: '+z-z-y' });
  k.solid([bx[1] - bx[0], 0.2, 0.22], null, null, mul(M, T((bx[0] + bx[1]) / 2, beamY, postZ)));
  for (const x of P.posts) {
    const hgt = beamY - DK;
    if (log) {
      // a peeled pole, a little out of plumb, narrowing toward the top
      const r = k.r(0.085, 0.1), lean = (k.R() < 0.5 ? -1 : 1) * k.r(0.01, 0.025), tint = vary(k, POLE, 0.92, 1.08), st = [1, 3, 5, 9][Math.floor(k.R() * 4)];
      prism(ngon(7, r, 0.12, k.R), hgt + 0.06, [x, DK + hgt / 2, postZ], [0, k.r(0, 6), lean], { tint, smooth: true, skip: '+y-y', strip: st, taper: 0.06 });
    } else {
      put([0.13, hgt + 0.04, 0.13], [x, DK + hgt / 2, postZ], [0, k.r(-0.03, 0.03), 0], { long: 1, tint: vary(k, FRAME, 0.9, 1.06), strip: 10, cuts: [-0.6, 0.4], segFaces: '+x-x+z-z', skip: '-y', ends: 'log', outside: true });
      for (const s of [-1, 1]) if ((s < 0 && x > P.x0 + 0.3) || (s > 0 && x < P.x1 - 0.3)) put([0.56, 0.07, 0.07], [x + s * 0.22, beamY - 0.3, postZ], [0, 0, s * Math.PI / 4], { long: 0, tint: vary(k, FRAME, 0.85, 1.0), strip: 11 });
    }
    k.solid([0.16, hgt, 0.16], null, null, mul(M, T(x, DK + hgt / 2, postZ)));
    { const v = new THREE.Vector3(x, 0, postZ).applyMatrix4(M); if (DK > 0.25 || c.gl(v.x, v.z) < -0.03) c.piers.push({ M: mul(M, T(x, 0, postZ)), h: DK - 0.02, w: 0.4 }); }   // (and a low porch's where the ground falls away)
  }
  // rails: a pole (or a sawn rail) at hand height between the posts, uprights between; none across the steps
  if (P.rails && !far) {
    const gaps = P.steps.map((s) => [s.x - s.w / 2 - 0.05, s.x + s.w / 2 + 0.05]);
    const ps = [...P.posts].sort((a, b) => a - b);
    for (let i = 0; i < ps.length - 1; i++) {
      const a = ps[i], b = ps[i + 1];
      if (gaps.some(([g0, g1]) => g0 < b && g1 > a)) continue;
      const y = DK + 0.86 + k.r(-0.03, 0.03), Lr = b - a, tint = vary(k, log ? POLE : FRAME, 0.9, 1.05);
      if (log) prism(ngon(6, k.r(0.05, 0.06), 0.15, k.R), Lr + 0.06, [(a + b) / 2, y, postZ], [0, 0, Math.PI / 2 + k.r(-0.02, 0.02)], { tint, smooth: true, skip: '+y-y', strip: [1, 3, 5, 9][Math.floor(k.R() * 4)], taper: 0.05 });
      else put([Lr, 0.06, 0.08], [(a + b) / 2, y, postZ], null, { long: 0, tint, strip: 10 });
      for (const f of log ? [0.36, 0.68] : Array.from({ length: Math.max(1, Math.floor(Lr / 0.14)) - 1 }, (_, q) => (q + 1) / Math.max(1, Math.floor(Lr / 0.14)))) {
        const px = a + Lr * f;
        if (log) prism(ngon(6, 0.04, 0.2, k.R), y - DK, [px, DK + (y - DK) / 2, postZ], [k.r(-0.04, 0.04), 0, k.r(-0.05, 0.05)], { tint: vary(k, POLE, 0.88, 1.0), smooth: true, skip: '+y-y', taper: 0.08 });
        else put([0.04, y - DK - 0.1, 0.04], [px, DK + (y - DK) / 2, postZ], null, { long: 1, tint: vary(k, FRAME, 0.9, 1.05) });
      }
    }
  }
  // the steps: stringers sloping from the rim to the ground, treads across them, a flat stone at the foot
  for (const st of P.steps) {
    // (from the deck down to the ground before them (c.gl): as many as that takes, the run out settled in a few rounds)
    const run = 0.27, foot = (d) => { let g = Infinity; for (const dx of [-st.w / 2, 0, st.w / 2]) { const v = new THREE.Vector3(st.x + dx, 0, z1 + d).applyMatrix4(M); g = Math.min(g, c.gl(v.x, v.z)); } return Math.min(DK - 0.12, g); };
    let n = Math.max(1, Math.round(DK / 0.19)), g0 = 0;
    for (let round = 0; round < 5; round++) { g0 = foot(n * run); const m2 = Math.max(1, Math.round((DK - g0) / 0.19)); if (m2 === n) break; n = m2; }
    const HT = DK - g0, rise = HT / n;
    { const v = new THREE.Vector3(st.x, 0, z1 + n * run).applyMatrix4(M); c.feet.push([v.x, v.z, g0 - 0.06]); }   // (the stringers' feet)
    for (let i = 1; i <= n - 0; i++) {
      const ty = DK - i * rise, tz = z1 + (i - 0.5) * run;
      if (ty < g0 + 0.05) break;
      put([st.w, 0.045, run + 0.02], [st.x + k.r(-0.02, 0.02), ty - 0.02, tz], [0, k.r(-0.02, 0.02), k.r(-0.01, 0.01)], { long: 0, tint: vary(k, DECKW, 1.0, 1.15), lumJit: true, strip: WOOD.shake, skip: '-y' });
    }
    const sl = Math.hypot(n * run, HT), sa = Math.atan2(HT, n * run);
    for (const dx of [-st.w / 2 + 0.04, st.w / 2 - 0.04]) put([0.05, 0.2, sl + 0.05], [st.x + dx, g0 + HT / 2 - 0.06, z1 + n * run / 2], [sa, 0, 0], { long: 2, tint: DECKW.map((q) => q * 0.8), strip: WOOD.shake });
    c.flats.push({ M: mul(M, T(st.x, 0, z1 + n * run + 0.3)), w: st.w + 0.15, d: 0.42 });
    k.solid([st.w, HT * 0.6, n * run], null, null, mul(M, T(st.x, g0 + HT * 0.3, z1 + n * run / 2)));
  }
}

function porches(c) {
  const { L, r, k } = c, P = L.porch, { main } = L;
  // where steps go: in front of each door on the porch's wall
  const fronts = r.plan === 'dogtrot' ? [] : main.walls.front.opens.filter((o) => o.kind === 'door' && !o.inner);
  if (r.plan === 'dogtrot') fronts.push({ a0: L.breeze.x0 + 0.2, a1: L.breeze.x1 - 0.2 });
  if (!P) {
    // no porch: a stoop at each outside door (plank steps up to a raised floor, a flat stone at their foot); a
    // dogtrot's breezeway a wide one front and back (its pens' doors open onto its deck)
    const stoops = [];
    for (const w of L.walls) for (const o of w.opens) {
      if (o.kind !== 'door' || o.inner) continue;
      if (L.breeze && (w.side === 'left' || w.side === 'right') && Math.abs(w.P(0)[0]) < L.breeze.x1 + 0.1) continue;
      stoops.push([w.f, (o.a0 + o.a1) / 2, 1.05]);
    }
    if (L.breeze) { const b = L.breeze, cx = (b.x0 + b.x1) / 2, bw = b.x1 - b.x0 - 0.3; stoops.push([wallOf(0, b.z1), cx, bw], [wallOf(Math.PI, -b.z0), -cx, bw]); }
    for (const [f, ac, sw] of stoops) {
      const out = L.FL > 0.3 || c.gl(...wallP(f, ac, 0, 0.5).filter((_, i) => i !== 1)) < L.FL - 0.35 ? stoop(c, wallM(f, ac, 0, 0), L.FL, sw) : 0;   // (out: how far its steps reach)
      c.flats.push({ M: wallM(f, ac, 0, out ? out - 0.14 : 0.32), w: Math.min(1.15, sw + 0.1), d: 0.5 });   // (the stone the bottom step: under the stringers' feet)
    }
    return;
  }
  // (a small porch: only before the first door, about 2.7 m wide)
  if (P.partial && fronts.length) { const dc = (fronts[0].a0 + fronts[0].a1) / 2; P.x0 = Math.max(P.x0, dc - 1.35); P.x1 = Math.min(P.x1, dc + 1.35); }
  const PD = P.depth, steps = fronts.map((o) => ({ x: (o.a0 + o.a1) / 2, w: Math.min(1.3, Math.max(1.0, o.a1 - o.a0 + 0.25)) })).filter((st) => st.x > P.x0 && st.x < P.x1);
  const front = mul(T(0, 0, main.z1), new THREE.Matrix4());
  const xs = postsFor(P.x0, P.x1, steps, k);
  const wrapR = P.wrap === 'right', wrapL = P.wrap === 'left';
  // (a wrap-around: the front run takes the corner square; the side run starts behind it; the two roofs meet in a hip)
  const keepF = P.wrap ? (p) => (wrapR ? p.x - main.x1 < p.z - main.z1 + 0.02 : main.x0 - p.x < p.z - main.z1 + 0.02) : null;
  // (a porch whose end meets a wing: its deck and roof stop against the wing's wall)
  const abL = P.abut === 'left', abR = P.abut === 'right';
  porchRun(c, front, { x0: P.x0 - 0.12 * (wrapL || abL ? 0 : 1), x1: P.x1 + 0.12 * (wrapR || abR ? 0 : 1), depth: PD, deck: P.deck, top: P.top, pitch: P.pitch, posts: xs, steps, rails: r.rails, railEnds: [!abL, !abR], keep: keepF, ledger: P.kind !== 'shed',
    roofX0: P.x0 - (abL ? 0 : 0.2) - (wrapL ? 0.25 : 0), roofX1: P.x1 + (abR ? 0 : 0.2) + (wrapR ? 0.25 : 0) });
  if (P.wrap) {
    const s = wrapR ? 1 : -1, wallX = wrapR ? main.x1 : main.x0;
    const M = wrapR ? mul(T(wallX, 0, 0), RY(Math.PI / 2)) : mul(T(wallX, 0, 0), RY(-Math.PI / 2));
    // (in the side run's frame, x runs from the front corner back along the wall)
    const a0 = wrapR ? -(main.z1) : main.z0 + 0.6, a1 = wrapR ? -(main.z0 + 0.6) : main.z1;
    const fx = wrapR ? a0 : a1;   // the front end (it meets the front run's posts)
    const keepS = (p) => (wrapR ? p.x - main.x1 >= p.z - main.z1 - 0.02 : main.x0 - p.x >= p.z - main.z1 - 0.02);
    const ps = postsFor(Math.min(a0, a1), Math.max(a0, a1), [], k).filter((x) => Math.abs(x - fx) > 0.6);
    porchRun(c, M, { x0: a0, x1: a1, depth: PD, deck: P.deck, top: P.top, pitch: P.pitch, posts: ps, steps: [], rails: r.rails, railEnds: wrapR ? [false, true] : [true, false], keep: keepS,
      roofX0: wrapR ? a0 - PD - 0.45 : a0 - 0.2, roofX1: wrapR ? a1 + 0.2 : a1 + PD + 0.45, beamX: wrapR ? [a0 - PD - 0.05, a1 + 0.18] : [a0 - 0.18, a1 + PD + 0.05] });
    // the hip where the two roofs meet: a cap board from the wall's corner out to the corner post
    const rTop = P.top, rp = P.pitch, outD = PD + 0.3, sx = 0.026 / Math.cos(rp) + 0.035;
    const pa = new THREE.Vector3(wallX, rTop + sx + 0.02, main.z1), pb = new THREE.Vector3(wallX + s * outD, rTop - outD * Math.tan(rp) + sx, main.z1 + outD);
    // (two narrow cap strips, each lying on its own slope along the hip)
    flashing(c, pa, pb, [0, Math.cos(rp), Math.sin(rp)], [-s, 0, 1], 0.12, 0.022, SHAKE.map((q) => q * 0.7), 'wood');
    flashing(c, pa, pb, [s * Math.sin(rp), Math.cos(rp), 0], [s, 0, -1], 0.12, 0.022, SHAKE.map((q) => q * 0.7), 'wood');
    void k;
  }
  // a lantern on the wall by the front door, lit at dusk
  if (r.lantern && fronts.length && !c.far) {
    const o = fronts[0], w = r.plan === 'dogtrot' ? null : main.walls.front, a = (o.a0 + o.a1) / 2 + ((o.a1 - o.a0) / 2 + 0.32) * (k.R() < 0.5 ? -1 : 1);
    if (w) { const p = w.P(a, L.FL + 2.05, 0.3); c.lamps.push(lantern(k, p[0], p[1], p[2], { bracket: [0, -0.28], strength: 1.4, outdoor: true })); }
  }
}
// the posts along a run: at its ends, and between them about every 2.2 m, clear of the steps
function postsFor(a, b, steps, k) {
  const n = Math.max(1, Math.round((b - a) / 2.3)), xs = [a + 0.08];
  for (let i = 1; i < n; i++) {
    let x = a + (b - a) * i / n + k.r(-0.15, 0.15);
    for (const s of steps) if (Math.abs(x - s.x) < s.w / 2 + 0.15) x = s.x + (x < s.x ? -1 : 1) * (s.w / 2 + 0.15);
    xs.push(x);
  }
  xs.push(b - 0.08);
  return xs;
}
// plank steps up to a door with no porch (M: the door's foot on the wall's face, facing out)
// (down to the ground before them (c.gl), as many as that takes; returns how far out from the wall they reach)
function stoop(c, M, h, w = 1.05) {
  const { k } = c, run = 0.28, foot = (d) => { let g = Infinity; for (const dx of [-w / 2, 0, w / 2]) { const v = new THREE.Vector3(dx, 0, d).applyMatrix4(M); g = Math.min(g, c.gl(v.x, v.z)); } return Math.min(h - 0.12, g); };
  let n = Math.max(1, Math.round(h / 0.19)), g0 = 0;
  for (let round = 0; round < 5; round++) { g0 = foot(0.42 + n * run); const m2 = Math.max(1, Math.round((h - g0) / 0.19)); if (m2 === n) break; n = m2; }
  const HT = h - g0, rise = HT / n;
  { const v = new THREE.Vector3(0, 0, 0.42 + n * run).applyMatrix4(M); c.feet.push([v.x, v.z, g0 - 0.06]); }   // (the stringers' feet)
  const put = (size, pos, rot, o) => k.board(size, null, null, { ...o, m: mul(M, T(...pos), rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4()) });
  put([w + 0.1, 0.05, 0.42], [0, h - 0.025, 0.21], null, { long: 0, tint: vary(k, DECKW, 0.95, 1.1), strip: WOOD.shake });
  for (let i = 1; i < n; i++) put([w, 0.045, run + 0.02], [k.r(-0.02, 0.02), h - i * rise - 0.02, 0.42 + (i - 0.5) * run], null, { long: 0, tint: vary(k, DECKW, 1.0, 1.15), strip: WOOD.shake, skip: '-y' });
  const sl = Math.hypot(n * run + 0.42, HT), sa = Math.atan2(HT, n * run + 0.42);
  for (const dx of [-w / 2 + 0.04, w / 2 - 0.04]) put([0.05, 0.2, sl], [dx, g0 + HT / 2 - 0.06, (n * run + 0.42) / 2], [sa, 0, 0], { long: 2, tint: DECKW.map((q) => q * 0.8), strip: WOOD.shake });
  k.solid([w, HT * 0.6, n * run + 0.4], null, null, mul(M, T(0, g0 + HT * 0.3, (n * run + 0.4) / 2)));
  return 0.42 + n * run;
}

// ── the chimneys ─────────────────────────────────────────────────────────────────────────────────────────────────────
// a stone chimney (the Stone Lab's wall maker) against an end wall: a wide base holding the firebox, shoulders stepping
// in, a stack up past the ridge; the firebox a recess in its face toward the house (the end wall's opening shows it); a
// stone hearth in front of it, on the floor. For a stick chimney, the stone base goes only as high as the firebox.
let shapeN = 0;
function stoneChimney(c, ch) {
  const { L, r, env } = c, s = ch.side, x0 = s < 0 ? ch.x - ch.cd : ch.x - 0.05, x1 = s < 0 ? ch.x + 0.05 : ch.x + ch.cd;
  const zc = ch.z, G = Math.min(-0.12, lowAlong(c, [[x0, zc - ch.cw / 2], [x1, zc - ch.cw / 2], [x1, zc + ch.cw / 2], [x0, zc + ch.cw / 2]]) - 0.1), stick = ch.type === 'stick';   // (its foot under the ground's lowest round it)
  const top = r.roof === 'gable' ? L.RIDGE + 0.62 : L.EAVE_H + 0.7;
  const yS = L.FL + 1.45, nS = 2, slope = 0.16, level = 0.2;
  // the outline: a rectangle walked with the outside on the right, its face toward the house last (face 3 for the
  // right end, face 1 for the left)
  const rect = (wd, dp) => {
    const xa = s < 0 ? ch.x + 0.05 - dp : ch.x - 0.05, xb = s < 0 ? ch.x + 0.05 : ch.x - 0.05 + dp;
    return [[xa, zc + wd / 2], [xb, zc + wd / 2], [xb, zc - wd / 2], [xa, zc - wd / 2]];
  };
  const houseFace = s < 0 ? 1 : 3, at = (i) => rect(ch.cw - (ch.cw - ch.sw) * i / nS, (ch.cd + 0.05) - ((ch.cd + 0.05) - (ch.sd + 0.05)) * i / nS);
  const sections = [{ loop0: at(0), loop1: at(0), y0: G, y1: stick ? L.FL + 1.25 : yS }];
  let y = yS;
  if (!stick) {
    for (let i = 1; i <= nS; i++) {
      sections.push({ loop0: at(i - 1), loop1: at(i), y0: y, y1: y + slope }); y += slope;
      if (i < nS) { sections.push({ loop0: at(i), loop1: at(i), y0: y, y1: y + level }); y += level; }
    }
    sections.push({ loop0: at(nS), loop1: at(nS), y0: y, y1: top - 0.12 });
  }
  const hw = ch.cw / 2;
  const key = 'cabinChimney' + (shapeN++ % 4);
  SHAPES[key] = { label: 'Cabin chimney', make: () => ({ H: stick ? L.FL + 1.37 : top,
    sections,
    openings: [{ face: houseFace, u: hw, w: 0.98, v0: L.FL + 0.01, v1: L.FL + 0.98, kind: 'door', depth: Math.min(0.62, ch.cd - 0.2) }],
    top: { y: stick ? L.FL + 1.37 : top, t: 0.12, over: stick ? 0.02 : 0.06, rects: [stick ? { x0: Math.min(...at(0).map((p) => p[0])) - 0.02, x1: Math.max(...at(0).map((p) => p[0])) + 0.02, z0: zc - hw - 0.02, z1: zc + hw + 0.02, open: { x0: 1, x1: 1, z0: 1, z1: 1 }, ov: { x0: 0.02, x1: 0.02, z0: 0.02, z1: 0.02 } } : (() => { const q = at(nS), xa = Math.min(...q.map((p) => p[0])), xb = Math.max(...q.map((p) => p[0])); return { x0: xa - 0.06, x1: xb + 0.06, z0: zc - ch.sw / 2 - 0.06, z1: zc + ch.sw / 2 + 0.06, open: { x0: 1, x1: 1, z0: 1, z1: 1 }, ov: { x0: 0.06, x1: 0.06, z0: 0.06, z1: 0.06 } }; })()],
      holes: stick ? undefined : [[(s < 0 ? ch.x - ch.sd / 2 : ch.x + ch.sd / 2) - 0.14, (s < 0 ? ch.x - ch.sd / 2 : ch.x + ch.sd / 2) + 0.14, zc - 0.12, zc + 0.12]] } }) };
  const style = c.far ? 'mortared' : 'mortared';
  const sw = buildStoneWall({ style, palette: r.stone, mortar: r.mortar, size: c.far ? 0.62 : 0.44, irregularity: 0.5, colourMix: 0.5, bulge: 0.55, joint: 0.012, shape: key, seed: r.seed * 5 + 2 + ch.side }, env);
  c.stoneGeos.push(sw.stone, sw.mortar); c.stoneTris += sw.tris.stone + sw.tris.mortar;
  for (const S of sections) { const xa = Math.min(...S.loop0.map((p) => p[0])), xb = Math.max(...S.loop0.map((p) => p[0])), za = Math.min(...S.loop0.map((p) => p[1])), zb = Math.max(...S.loop0.map((p) => p[1])); c.k.solid([xb - xa, S.y1 - S.y0, zb - za], [(xa + xb) / 2, (S.y0 + S.y1) / 2, (za + zb) / 2]); }
  if (stick) stickStack(c, ch, L.FL + 1.37, top);
  // the fire in the firebox, and its light
  fire(c, [s < 0 ? ch.x - 0.28 : ch.x + 0.28, L.FL + 0.16, zc], s < 0 ? [1, 0, 0] : [-1, 0, 0]);
  // the hearth before it, through the wall's opening and out onto the floor; the firebox in it laid for a fire
  hearth(c, { o: [ch.x - s * 0.05, zc], n: [-s, 0, 0], depth: L.T - 0.05 + 0.62, w: 1.5, box: { depth: Math.min(0.62, ch.cd - 0.2), w: 0.98, h: 0.97 }, face: L.T - 0.05 });
  // the mantel: a hewn beam over the opening inside, a shelf on it
  const w = ch.wall, a = s < 0 ? zc : -zc;
  if (!c.far) {
    wb(c.k, w, [1.5, 0.16, 0.14], a, L.FL + 1.14, -L.T - 0.07, null, { long: 0, tint: vary(c.k, FRAME, 0.7, 0.85), strip: 10, ends: 'log', inside: true });
    wb(c.k, w, [1.62, 0.045, 0.24], a, L.FL + 1.245, -L.T - 0.11, null, { long: 0, tint: vary(c.k, FRAME, 0.8, 0.95), inside: true });
  }
  ch.top = top;
}
// a stick-and-mud stack on the stone firebox: a crib of split sticks laid like a log pen, crossing at the corners, the
// clay daub behind and between them, narrowing as it goes up, a pole propped against it (to push it off the house if it
// ever leaned in)
function stickStack(c, ch, y0, top) {
  const { k } = c, s = ch.side, far = c.far, H = top - y0;
  const xIn = ch.x + s * 0.02, dep0 = ch.cd - 0.08, dep1 = ch.sd, w0 = ch.cw - 0.18, w1 = ch.sw;
  const daub = c.daub;
  // the daub: a tapered block (its outer face and sides; the side against the house hidden)
  const xm0 = xIn + s * dep0 / 2;
  k.prism('plaster', [[-dep0 / 2, -w0 / 2], [dep0 / 2, -w0 / 2], [dep0 / 2, w0 / 2], [-dep0 / 2, w0 / 2]], H, [xm0, y0 + H / 2, ch.z], null, { tint: daub, taper: 1 - w1 / w0, mortar: true, skip: '-y' });
  k.solid([dep0, H, w0 * 0.8], [xm0, y0 + H / 2, ch.z]);
  // the sticks: courses every 13 to 16 cm (fewer far off), four to a course, their ends crossing at the corners
  const step = far ? 0.32 : 0.145;
  for (let y = y0 + 0.04, i = 0; y < top - 0.06; y += step * k.r(0.9, 1.1), i++) {
    const f = (y - y0) / H, wd = w0 + (w1 - w0) * f + 0.06, dp = dep0 + (dep1 - dep0) * f + 0.05, xm = xIn + s * dp / 2, th = far ? 0.12 : 0.065;
    const tint = vary(k, [1.05, 0.92, 0.76], 0.75, 1.0);
    for (const side of [-1, 1]) {
      k.board([dp + 0.12, th, th], [xm + k.r(-0.02, 0.02), y + (i % 2) * th * 0.5, ch.z + side * (wd / 2)], [0, k.r(-0.04, 0.04), k.r(-0.03, 0.03)], { long: 0, tint, strip: 11, ends: 'log', fresh: false });
    }
    k.board([th, th, wd + 0.12], [xIn + s * dp, y + ((i + 1) % 2) * th * 0.5, ch.z + k.r(-0.02, 0.02)], [k.r(-0.03, 0.03), k.r(-0.04, 0.04), 0], { long: 2, tint, strip: 11, ends: 'log' });
  }
  // the prop pole, leaning against the stack from the ground out to the side
  if (!far) {
    const px = xIn + s * (dep0 + 1.6), base = new THREE.Vector3(px, 0, ch.z + 0.3), tip = new THREE.Vector3(xIn + s * (dep1 + 0.04), y0 + H * 0.62, ch.z + 0.1);
    const d = tip.clone().sub(base), Lp = d.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    k.prism('wood', ngon(6, 0.055, 0.15, k.R), Lp, null, null, { m: new THREE.Matrix4().compose(base.clone().addScaledVector(d, 0.5), q, new THREE.Vector3(1, 1, 1)), tint: vary(k, POLE, 0.8, 0.95), smooth: true, taper: 0.2 });
  }
}
// a chimney in the middle, between the two pens: a stone mass standing through the wall between them, a fireplace on
// each side; its stack comes out at the ridge
function middleChimney(c, ch) {
  const { L, r, env } = c, hx = ch.mw / 2, hz = ch.md / 2, zc = ch.z, G = Math.min(-0.12, lowAlong(c, [[-hx, zc - hz], [hx, zc - hz], [hx, zc + hz], [-hx, zc + hz]]) - 0.1);
  const loop = [[-hx, zc + hz], [hx, zc + hz], [hx, zc - hz], [-hx, zc - hz]];
  const ridge = r.roof === 'gable' ? L.RIDGE : L.roofY(0, zc), top = ridge + 0.7, sl = [[-ch.sw / 2, zc + ch.sd / 2], [ch.sw / 2, zc + ch.sd / 2], [ch.sw / 2, zc - ch.sd / 2], [-ch.sw / 2, zc - ch.sd / 2]];
  const key = 'cabinChimney' + (shapeN++ % 4);
  SHAPES[key] = { label: 'Cabin chimney', make: () => ({ H: top,
    sections: [{ loop0: loop, loop1: loop, y0: G, y1: L.CEIL + 0.1 }, { loop0: loop, loop1: sl, y0: L.CEIL + 0.1, y1: L.CEIL + 0.3 }, { loop0: sl, loop1: sl, y0: L.CEIL + 0.3, y1: top - 0.12 }],
    openings: [{ face: 1, u: hz, w: 0.82, v0: L.FL + 0.01, v1: L.FL + 0.9, kind: 'door', depth: 0.42 }, { face: 3, u: hz, w: 0.82, v0: L.FL + 0.01, v1: L.FL + 0.9, kind: 'door', depth: 0.42 }],
    top: { y: top, t: 0.12, over: 0.06, rects: [{ x0: -ch.sw / 2 - 0.06, x1: ch.sw / 2 + 0.06, z0: zc - ch.sd / 2 - 0.06, z1: zc + ch.sd / 2 + 0.06, open: { x0: 1, x1: 1, z0: 1, z1: 1 }, ov: { x0: 0.06, x1: 0.06, z0: 0.06, z1: 0.06 } }], holes: [[-0.14, 0.14, zc - 0.12, zc + 0.12]] } }) };
  const sw = buildStoneWall({ style: 'mortared', palette: r.stone, mortar: r.mortar, size: c.far ? 0.6 : 0.42, irregularity: 0.5, colourMix: 0.5, bulge: 0.5, joint: 0.012, shape: key, seed: r.seed * 5 + 9 }, env);
  c.stoneGeos.push(sw.stone, sw.mortar); c.stoneTris += sw.tris.stone + sw.tris.mortar;
  c.k.solid([ch.mw, L.CEIL - G, ch.md], [0, (L.CEIL + G) / 2, zc]); c.k.solid([ch.sw, top - L.CEIL, ch.sd], [0, (top + L.CEIL) / 2, zc]);
  for (const s of [-1, 1]) { fire(c, [s * (hx - 0.24), L.FL + 0.16, zc], [s, 0, 0]); hearth(c, { o: [s * hx, zc], n: [s, 0, 0], depth: 0.5, w: 1.15, box: { depth: 0.42, w: 0.82, h: 0.89 } }); }
  ch.top = top;
}
// a fireplace's light, low in the room: out while the fire is cold (strength 0; `hearth`: the player's cabin lights it,
// src/cabin/hearthfire.js, and turns this up and down with the flames)
function fire(c, p, face) {
  if (c.far) return;
  c.lamps.push({ p: [p[0] + face[0] * 0.55, p[1] + 0.4, p[2]], reach: 6.5, strength: 0, outdoor: false, noGlow: true, fire: true, hearth: true });
}
// THE HEARTH (indoors: clean, square): dressed flat stones laid in rows before the firebox, their joints staggered, on a
// bed of mortar that shows between them, sooty nearest the fire; and in the firebox its back and sides black with soot,
// two iron andirons with a couple of split logs laid across them, and grey ash under them (a fire laid, not lit). In a
// frame o ([x, z]: the chimney's face at the opening's middle, on the floor), n (into the room); depth: the stones out
// from o; w: across; box: the firebox's { depth, w, h } back from o; face: the wall's depth from o to the room (the
// stone surround fills the opening through it; null: none, a chimney standing in the room is all stone already)
function hearth(c, { o, n, depth, w, box, face = null }) {
  if (c.far) return;
  const { k, L } = c, y0 = L.FL, a = [n[2], 0, -n[0]];
  const P = (u, v) => [o[0] + n[0] * u + a[0] * v, o[1] + n[2] * u + a[2] * v];
  // (a box with sizes along n, up and across, its middle at (u, y, v))
  const put = (group, du, h, dv, u, y, v, opts) => { const [x, z] = P(u, v), sx = Math.abs(n[0]) > 0.5 ? du : dv, sz = Math.abs(n[0]) > 0.5 ? dv : du; k.box(group, [sx, h, sz], [x, y, z], null, { long: 0, ...opts }); };
  const J = 0.014, rows = Math.max(2, Math.round(depth / 0.3)), rd = depth / rows, cols = Math.max(2, Math.round(w / 0.5)), cw = w / cols;
  const mortar = onMean([0.5, 0.47, 0.43], c.env.texMean), stone = c.flatTint, soot = onMean(SOOT, c.env.texMean);
  put('plaster', depth, 0.04, w, depth / 2, y0 - 0.012, 0, { tint: mortar, mortar: true, skip: '-y' });
  for (let r = 0; r < rows; r++) {
    // (each row its stones' joints half a stone over from the last; nearest the fire the smoke has darkened them)
    const off = r % 2 ? cw / 2 : 0, dark = r === 0 ? 0.55 : r === 1 ? 0.8 : 1;
    const cuts = [-w / 2]; for (let i = 1; i <= cols; i++) { const v = -w / 2 + i * cw - off; if (v > -w / 2 + 0.12 && v < w / 2 - 0.12) cuts.push(v); }
    cuts.push(w / 2);
    for (let i = 0; i < cuts.length - 1; i++) {
      const v0 = cuts[i] + J / 2, v1 = cuts[i + 1] - J / 2, t = vary(k, stone, 0.9, 1.08).map((q) => q * dark);
      put('plaster', rd - J, 0.05, v1 - v0, r * rd + rd / 2, y0 - 0.006 + k.r(-0.002, 0.002), (v0 + v1) / 2, { tint: t, skip: '-y' });
    }
  }
  // the firebox lined with brick, back and sides, in courses (the joints between them the backing, dark grey), redder low
  // down, black with soot higher up and over the fire; its top black. A bed of ash on its floor
  const fd = box.depth, fw = box.w, fh = box.h, courses = Math.round((fh - 0.02) / 0.075), rh = (fh - 0.02) / courses, joint = onMean([0.2, 0.19, 0.18], c.env.texMean);
  put('plaster', 0.02, fh - 0.02, fw - 0.02, -fd + 0.012, y0 + fh / 2, 0, { tint: joint });
  for (const s of [-1, 1]) put('plaster', fd - 0.05, fh - 0.02, 0.02, -fd / 2 - 0.025, y0 + fh / 2, s * (fw / 2 - 0.012), { tint: joint });
  put('plaster', fd - 0.05, 0.02, fw - 0.02, -fd / 2 - 0.025, y0 + fh - 0.012, 0, { tint: soot });
  for (let i = 0; i < courses; i++) {
    const yb = y0 + 0.01 + i * rh + rh / 2, black = Math.min(0.8, Math.max(0, (i / courses - 0.5) * 1.6));
    const brick = (kk) => onMean([0.42, 0.2, 0.14].map((q, j) => (q * (1 - black) + [0.07, 0.06, 0.055][j] * black) * kk), c.env.texMean);
    put('plaster', 0.016, rh - 0.009, fw - 0.03, -fd + 0.028, yb, 0, { tint: brick(k.r(0.85, 1.12)) });
    for (const s of [-1, 1]) put('plaster', fd - 0.06, rh - 0.009, 0.016, -fd / 2 - 0.02, yb, s * (fw / 2 - 0.028), { tint: brick(k.r(0.85, 1.12)) });
  }
  // the mouth: a stone surround inside the wood frame, a cheek up each side and a lintel over them (dressed stones, the
  // hearth's), so the fire's opening is stone, not boards
  if (face != null) {
    const cw = 0.17, lh = 0.15, dd = face + 0.02, stone = c.flatTint;
    for (const s of [-1, 1]) for (const [a0, b0] of [[0, 0.46], [0.46, fh - lh]]) put('plaster', dd, b0 - a0 - 0.012, cw, dd / 2, y0 + (a0 + b0) / 2, s * (fw / 2 - cw / 2), { tint: vary(k, stone, 0.95, 1.12) });
    for (const [a0, b0] of [[-fw / 2, 0], [0, fw / 2]]) put('plaster', dd, lh - 0.006, b0 - a0 - 0.012, dd / 2, y0 + fh - lh / 2, (a0 + b0) / 2, { tint: vary(k, stone, 0.95, 1.12) });
  }
  put('plaster', fd - 0.01, 0.03, fw - 0.03, -fd / 2 - 0.005, y0 + 0.012, 0, { tint: onMean([0.3, 0.29, 0.28], c.env.texMean) });   // (the firebox's floor, sooty, out to its mouth)
  put('plaster', fd * 0.6, 0.03, fw * 0.62, -fd * 0.55, y0 + 0.022, 0, { tint: onMean([0.47, 0.45, 0.43], c.env.texMean) });   // (the ash, under the logs)
  // two andirons: a bar back into the firebox on its legs, an upright at the front with a knob
  const ir = IRON.map((q) => q * 0.32);
  for (const s of [-1, 1]) {
    const v = s * Math.min(0.24, fw / 2 - 0.14);
    put('iron', fd - 0.14, 0.025, 0.025, -fd / 2 - 0.02, y0 + 0.1, v, { tint: ir });
    put('iron', 0.025, 0.24, 0.025, -0.07, y0 + 0.13, v, { tint: ir });
    put('iron', 0.045, 0.045, 0.045, -0.07, y0 + 0.27, v, { tint: ir });
    for (const u of [-0.07, -fd + 0.1]) put('iron', 0.02, 0.1, 0.06, u, y0 + 0.05, v, { tint: ir });
  }
  // the logs: two across the andirons, not quite square to the fire, and a third laid slantwise over them
  for (const [u, y, len, r, yaw] of [[-fd * 0.36, 0.16, 0.62, 0.066, 0.14], [-fd * 0.72, 0.165, 0.58, 0.06, -0.12], [-fd * 0.54, 0.27, 0.5, 0.054, 0.62]]) {
    const [x, z] = P(u, k.r(-0.03, 0.03)), along = Math.abs(n[0]) > 0.5 ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2];
    k.prism('wood', ngon(7, r, 0.18, k.R), Math.min(len, fw - 0.12), [x, y0 + y, z], [along[0] + k.r(-0.05, 0.05), yaw, along[2]], { tint: vary(k, [0.36, 0.27, 0.19], 0.8, 1.0), smooth: true, ends: 'log', strip: 11 });
  }
}
// a box stove (cast iron on four legs, a door, a top plate) with its pipe up through the ceiling and the roof
function stove(c, ch) {
  const { k, L, r } = c, x = ch.x, z = ch.z, y = L.FL;
  if (!c.far) {
    k.box('iron', [0.7, 0.42, 0.48], [x, y + 0.42, z], null, { tint: IRON.map((q) => q * 0.8) });
    k.box('iron', [0.78, 0.04, 0.54], [x, y + 0.65, z], null, { tint: IRON.map((q) => q * 0.9) });
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.box('iron', [0.05, 0.22, 0.05], [x + dx * 0.3, y + 0.11, z + dz * 0.19], null, { tint: IRON.map((q) => q * 0.7) });
    k.box('iron', [0.24, 0.2, 0.02], [x + 0.36, y + 0.43, z], [0, Math.PI / 2, 0], { tint: IRON.map((q) => q * 0.6) });
    k.parts.glow.push({ size: [0.1, 0.03, 0.12], m: T(x + 0.372, y + 0.36, z), kind: GLOW.flame, col: [3, 1.0, 0.2] });
    c.lamps.push({ p: [x + 0.5, y + 0.45, z], reach: 6.5, strength: 0.35, outdoor: false, noGlow: true, fire: true });
    k.solid([0.7, 0.66, 0.5], [x, y + 0.33, z]);
  }
  // the pipe: up through the ceiling (a tin collar there) and out through the roof
  const lt = ch.room === 'lean' ? L.lean : null;
  const roofAt = lt ? lt.y(x, z) : L.wing && (L.wing.front ? z > L.main.z1 : z < L.main.z0) ? L.wingY(x, z) : L.roofY(x, z);
  const top = Math.max(roofAt + 0.75, lt ? lt.top + 0.6 : 0);
  stovepipe(k, x, z, y + 0.67, top, { r: 0.075, collarY: roofAt + 0.02, tint: TIN.map((q) => q * 0.16) });
  if (!lt && !c.far) k.box('iron', [0.3, 0.012, 0.3], [x, L.CEIL - 0.006, z], null, { tint: TIN.map((q) => q * 0.14) });
  ch.top = top; ch.roofAt = roofAt;
}

// ── the foundation ───────────────────────────────────────────────────────────────────────────────────────────────────
// stone piers under the corners and every two metres or so along the walls (dry-laid flat stones), the dark crawl space
// between them; or a mortared stone footing under all the walls; or flat stones under the corners of log sills
function foundation(c) {
  const { k, L, r, env } = c, FT = L.FT, blocks = [...(r.plan === 'dogtrot' ? L.pens : [L.main]), ...(L.wing ? [L.wing] : []), ...(L.lean ? [L.lean] : [])];
  const piers = [];
  if (r.foundation === 'footing') {
    // (one ring per block; the lean-to and the wing on piers of their own)
    const ring = (b, t = 0.3) => [[b.x0, b.z1], [b.x1, b.z1], [b.x1, b.z0], [b.x0, b.z0], [b.x0, b.z1 - t], [b.x0 + t, b.z1 - t], [b.x0 + t, b.z0 + t], [b.x1 - t, b.z0 + t], [b.x1 - t, b.z1 - t], [b.x0, b.z1 - t]];
    void ring;
    for (const b of r.plan === 'dogtrot' ? L.pens : [L.main]) {
      const loop = [[b.x0 - 0.03, b.z1 + 0.03], [b.x1 + 0.03, b.z1 + 0.03], [b.x1 + 0.03, b.z0 - 0.03], [b.x0 - 0.03, b.z0 - 0.03]];
      const key = 'cabinFoot' + (shapeN++ % 4), fy0 = Math.min(-0.12, lowAlong(c, loop) - 0.1);   // (down 0.1 m under the lowest ground along it)
      for (const [x, z] of loop) c.feet.push([x, z, fy0]);
      SHAPES[key] = { label: 'Cabin footing', make: () => ({ H: FT, sections: [{ loop0: loop, loop1: loop, y0: fy0, y1: FT }], openings: [], top: { y: FT, t: 0, over: 0, rects: [] }, building: {} }) };
      const sw = buildStoneWall({ style: 'mortared', palette: r.stone, mortar: r.mortar, size: c.far ? 0.6 : 0.4, irregularity: 0.5, colourMix: 0.5, bulge: 0.55, joint: 0.012, shape: key, seed: r.seed * 3 + 1 }, env);
      c.stoneGeos.push(sw.stone, sw.mortar); c.stoneTris += sw.tris.stone + sw.tris.mortar;
      k.solid([b.x1 - b.x0, FT, b.z1 - b.z0], [(b.x0 + b.x1) / 2, FT / 2, (b.z0 + b.z1) / 2]);
    }
    for (const b of [...(L.wing ? [L.wing] : []), ...(L.lean ? [L.lean] : [])]) piersFor(b, piers, L);
  } else for (const b of blocks) piersFor(b, piers, L);
  if (L.breeze) piersFor({ x0: L.breeze.x0 + 0.2, x1: L.breeze.x1 - 0.2, z0: L.breeze.z0, z1: L.breeze.z1 }, piers, L, true);
  for (const p of [...piers, ...c.piers.map((q) => { const v = new THREE.Vector3().setFromMatrixPosition(q.M); return { x: v.x, z: v.z, h: q.h, w: q.w }; })]) pier(c, p);
  // the crawl space under each block, in deep shadow; the sill logs or beams the walls stand on are the walls' own
  for (const b of blocks) {
    // (down to under the lowest ground beneath it)
    const yb = Math.min(0, lowAlong(c, [[b.x0 + 0.2, b.z1 - 0.2], [b.x1 - 0.2, b.z1 - 0.2], [b.x1 - 0.2, b.z0 + 0.2], [b.x0 + 0.2, b.z0 + 0.2]]) - 0.05), h = Math.max(0.05, FT - 0.02 - yb);
    if (r.foundation !== 'footing' || b === L.lean || b === L.wing) { k.box('wood', [b.x1 - b.x0 - 0.4, h, b.z1 - b.z0 - 0.4], [(b.x0 + b.x1) / 2, yb + h / 2, (b.z0 + b.z1) / 2], null, { tint: SHADOW, skip: '-y', long: 0 }); for (const [x, z] of [[b.x0 + 0.2, b.z0 + 0.2], [b.x1 - 0.2, b.z0 + 0.2], [b.x1 - 0.2, b.z1 - 0.2], [b.x0 + 0.2, b.z1 - 0.2]]) c.feet.push([x, z, yb]); }
    k.solid([b.x1 - b.x0 - 0.2, FT, b.z1 - b.z0 - 0.2], [(b.x0 + b.x1) / 2, FT / 2, (b.z0 + b.z1) / 2]);
  }
  // the flat stones at the foot of the steps
  for (const f of c.flats) {
    const v = new THREE.Vector3().setFromMatrixPosition(f.M), yaw = Math.atan2(f.M.elements[8], f.M.elements[10]);
    const poly = ngon(7, 0.5, 0.3, k.R).map(([x, z]) => [x * f.w, z * f.d]);
    c.feet.push([v.x, v.z, c.gl(v.x, v.z) - 0.015]);
    k.prism('plaster', poly, 0.08, [v.x, c.gl(v.x, v.z) + 0.025, v.z], [k.r(-0.03, 0.03), yaw + k.r(-0.12, 0.12), k.r(-0.02, 0.02)], { tint: vary(k, c.flatTint.map((q) => q * 0.88), 0.82, 1.05), skip: '-y', taper: 0.12 });
  }
}
// the lowest ground (c.gl) along a loop of points (its own frame), a sample every 0.4 m
function lowAlong(c, loop) {
  let low = Infinity;
  for (let i = 0; i < loop.length; i++) { const [ax, az] = loop[i], [bx, bz] = loop[(i + 1) % loop.length], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.4));
    for (let j = 0; j <= n; j++) low = Math.min(low, c.gl(ax + (bx - ax) * j / n, az + (bz - az) * j / n)); }
  return low;
}
function piersFor(b, out, L, low = false) {
  const nx = Math.max(1, Math.round((b.x1 - b.x0) / 2.1)), nz = Math.max(1, Math.round((b.z1 - b.z0) / 2.2)), h = L.FT - 0.01;
  for (let i = 0; i <= nx; i++) for (const z of [b.z0 + 0.14, b.z1 - 0.14]) out.push({ x: b.x0 + 0.14 + (b.x1 - b.x0 - 0.28) * i / nx, z, h, w: low ? 0.36 : 0.44 });
  for (let j = 1; j < nz; j++) for (const x of [b.x0 + 0.14, b.x1 - 0.14]) out.push({ x, z: b.z0 + 0.14 + (b.z1 - b.z0 - 0.28) * j / nz, h, w: 0.44 });
}
// one pier: two or three flat rocks stacked, each its own ragged outline (six or seven sides), size and turn, a little
// off the one under it (Kit stones on the rubble picture, a darker warm grey)
// (its bottom rock set PIER_SINK m into the ground: on a gentle slope, or the cheaper tiers' coarser ground, it still
// meets the ground)
const PIER_SINK = 0.1;
function pier(c, p) {
  // (from PIER_SINK under the ground where it stands (c.gl: on the land as it is, lower on the downhill side) up to p.h;
  // a taller one more rocks)
  const { k } = c, t = c.flatTint, y0 = Math.min(-PIER_SINK, c.gl(p.x, p.z) - PIER_SINK), tall = p.h - y0, n = tall > 0.6 ? 4 : tall > 0.3 ? 3 : tall > 0.16 ? 2 : 1;
  let y = y0; c.feet.push([p.x, p.z, y0]);
  for (let i = 0; i < n; i++) {
    const last = i === n - 1, hh = last ? p.h - y : tall / n * k.r(0.85, 1.15), r = p.w / 2 * (i === 0 ? k.r(1.05, 1.2) : k.r(0.82, 1.0));
    k.prism('plaster', ngon(k.R() < 0.5 ? 6 : 7, r, 0.38, k.R), hh + 0.01, [p.x + k.r(-0.04, 0.04), y + hh / 2, p.z + k.r(-0.04, 0.04)], [k.r(-0.04, 0.04), k.r(0, 6), k.r(-0.04, 0.04)], { tint: vary(k, t, 0.8, 1.15), skip: '-y', taper: k.r(0.05, 0.18) });
    y += hh;
  }
  k.solid([p.w, p.h, p.w], [p.x, p.h / 2, p.z]);
}

// ── inside ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// each room: a plank floor, a plank ceiling on joists (logs: peeled poles), a lantern hung from a joist; a lean-to has
// no ceiling (its roof boards and rafters are the ceiling); the breezeway of a dogtrot a plank deck and a ceiling
function inside(c) {
  const { k, L, r } = c, T0 = L.T, log = L.log;
  const rooms = c.rooms = [];
  const half = L.partition ? (log ? T0 / 2 : 0.06) : 0;
  for (const [i, p] of L.pens.entries()) rooms.push({ name: p.name, x0: p.x0 + (L.partition && i === 1 ? half : T0), x1: p.x1 - (L.partition && i === 0 ? half : T0), z0: p.z0 + T0, z1: p.z1 - T0, ceil: L.CEIL, pen: p });
  if (L.wing) { const g = L.wing; rooms.push({ name: g.name, x0: g.x0 + T0, x1: g.x1 - T0, z0: g.front ? g.z0 - 0.02 : g.z0 + T0, z1: g.front ? g.z1 - T0 : g.z1 + 0.02, ceil: L.CEIL, wing: true }); }
  if (L.lean) { const lt = L.lean; rooms.push({ name: lt.name, x0: lt.side === 'right' ? lt.x0 + 0.02 : lt.x0 + 0.1, x1: lt.side === 'left' ? lt.x1 - 0.02 : lt.x1 - 0.1, z0: lt.z0 + 0.1, z1: lt.side === 'back' ? lt.z1 + 0.02 : lt.z1 - 0.1, ceil: lt.low - 0.12, lean: true }); }
  for (const R of rooms) {
    // (a room's floor runs out under the walls' feet a little, so no gap shows along them)
    plankField(k, mul(T(0, L.FL, 0), RX(-Math.PI / 2)), { u0: R.x0 - 0.04, u1: R.x1 + 0.04, v0: -R.z1 - 0.04, v1: -R.z0 + 0.04, w: 0.17, t: 0.03, tint: FLOOR, nails: true, maxL: 4.2, step: 1.2, extra: { inside: true } });
    k.solid([R.x1 - R.x0, 0.1, R.z1 - R.z0], [(R.x0 + R.x1) / 2, L.FL - 0.05, (R.z0 + R.z1) / 2]);
    // (the lanterns hang high, their bottoms over 1.8 m up: a walker's eyes, the player's in their own cabin, pass under)
    if (R.lean) { const lx = (R.x0 + R.x1) / 2, lz = (R.z0 + R.z1) / 2, ry = L.lean.y(lx, lz); c.lamps.push(lantern(k, lx, ry - 0.42, lz, { chain: 0.17, strength: 1.0 })); R.lamp = [lx, lz]; continue; }
    plankField(k, mul(T(0, R.ceil, 0), RX(Math.PI / 2)), { u0: R.x0 - 0.03, u1: R.x1 + 0.03, v0: R.z0 - 0.03, v1: R.z1 + 0.03, w: 0.22, t: 0.025, tint: INNER.map((q) => q * 0.9), maxL: 4.4, step: 1.4, extra: { inside: true } });
    k.solid([R.x1 - R.x0 + 0.2, 0.1, R.z1 - R.z0 + 0.2], [(R.x0 + R.x1) / 2, R.ceil + 0.06, (R.z0 + R.z1) / 2]);
    R.joists = joists(c, R.x0, R.x1, R.z0, R.z1, R.ceil, !R.wing);   // (where they are: a stove's pipe goes up between them)
    // a lantern hanging from a joist over the middle of the room
    const lx = (R.x0 + R.x1) / 2 + k.r(-0.3, 0.3), lz = (R.z0 + R.z1) / 2 + k.r(-0.2, 0.2);
    c.lamps.push(lantern(k, lx, R.ceil - 0.42, lz, { chain: 0.17, strength: 0.95 }));
    R.lamp = [lx, lz];
  }
  if (L.breeze) {
    const b = L.breeze, x0 = b.x0 + 0.02, x1 = b.x1 - 0.02, DK = L.FL - 0.04;
    for (let x = x0; x < x1 - 0.04;) {
      const bw = Math.min(k.r(0.14, 0.2), x1 - x), z0 = b.z0 - 0.04, z1 = b.z1 + 0.02;
      k.board([bw - 0.01, 0.04, z1 - z0], [x + bw / 2, DK - 0.02, (z0 + z1) / 2], [0, k.r(-0.004, 0.004), 0], { long: 2, tint: vary(k, DECKW.map((q) => q * 1.2), 0.9, 1.1), deck: true, strip: WOOD.shake + Math.floor(k.R() * 2), skip: '-y', cuts: cutsFor(z1 - z0, [], 1.2), segFaces: '+y' });
      x += bw;
    }
    k.solid([x1 - x0, DK, b.z1 - b.z0], [(x0 + x1) / 2, DK / 2, 0]);
    plankField(k, mul(T(0, L.CEIL, 0), RX(Math.PI / 2)), { u0: x0 - 0.1, u1: x1 + 0.1, v0: b.z0 - 0.02, v1: b.z1 + 0.02, w: 0.22, t: 0.025, tint: DECKW, maxL: 4.4, step: 1.4 });
    k.solid([x1 - x0, 0.1, b.z1 - b.z0], [(x0 + x1) / 2, L.CEIL + 0.06, 0]);
    joists(c, x0 - 0.1, x1 + 0.1, b.z0 - 0.05, b.z1 + 0.05, L.CEIL, false);
    rooms.push({ name: 'breezeway', x0, x1, z0: b.z0, z1: b.z1, ceil: L.CEIL, open: true });
  }
  // a frame house's wall between its two pens: upright boards both faces, a doorway
  if (L.partition && !log) {
    const pt = L.partition, o = pt.opens.find((q) => q.inner);
    for (const face of [1, -1]) for (let a = Math.min(pt.a0, pt.a1) + 0.12; a < Math.max(pt.a0, pt.a1) - 0.14;) {
      const bw = Math.min(k.r(0.16, 0.22), Math.max(pt.a0, pt.a1) - 0.12 - a); if (bw < 0.04) break;
      const ac = a + bw / 2, inDoor = o && ac > o.a0 && ac < o.a1, y0 = inDoor ? o.y1 : L.FL, h = L.CEIL - y0;
      if (h > 0.05) wb(k, pt, [bw - 0.004, h, 0.02], ac, y0 + h / 2, face > 0 ? 0.01 : -0.13, null, { long: 1, tint: vary(k, INNER, 0.85, 1.1), skip: face > 0 ? '-z+x-x+y-y' : '+z+x-x+y-y', inside: true });
      a += bw;
    }
    for (let a = Math.min(pt.a0, pt.a1) + 0.2; a < Math.max(pt.a0, pt.a1) - 0.2; a += 0.6) if (!(o && a > o.a0 - 0.05 && a < o.a1 + 0.05)) k.solid([0.06, L.CEIL - L.FL, 0.12], null, null, wallM(pt.f, a, (L.CEIL + L.FL) / 2, -0.06));
  }
}
// joists under a ceiling, across the room (z), every 80 cm or so: peeled poles in a log house, sawn beams in a frame one;
// returns their x's
function joists(c, x0, x1, z0, z1, y, poles) {
  const { k, L } = c, n = Math.max(1, Math.round((x1 - x0) / 0.85)), xs = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * (i + 0.5) / n + k.r(-0.05, 0.05), Lj = z1 - z0 + (L.log ? 0.3 : 0.02);
    xs.push(x);
    if (L.log && poles) k.prism('wood', ngon(7, k.r(0.07, 0.085), 0.12, k.R), Lj, [x, y - 0.08, (z0 + z1) / 2], [Math.PI / 2, 0, 0], { tint: vary(k, POLE, 0.8, 0.95), smooth: true, skip: '+y-y', strip: [1, 3, 5][Math.floor(k.R() * 3)], inside: true });
    else k.board([0.07, 0.15, Lj], [x, y - 0.075, (z0 + z1) / 2], null, { long: 2, tint: vary(k, FRAME, 0.8, 0.95), strip: 10, skip: '+y-z+z', cuts: cutsFor(Lj, [], 1.2), segFaces: '-y+x-x', inside: true });
  }
  return xs;
}

// where each room's furniture can go (the props library puts it there): a bed in the corner farthest from the doors
// and the fire, a table nearer the middle by a window, the stove or hearth, shelves on a wall with no opening
function roomAnchors(c, R) {
  const { L } = c, doors = [], fires = [];
  for (const w of L.walls) for (const o of w.opens) {
    const p = w.P((o.a0 + o.a1) / 2, 0, -w.t);
    if (o.kind === 'door') doors.push(p); else if (o.kind === 'hearth') fires.push(p);
  }
  for (const ch of L.chims) if (ch.type === 'pipe') fires.push([ch.x, 0, ch.z]); else if (ch.side === 0) fires.push([0, 0, ch.z]);
  const inR = (p, m = 0.3) => p[0] > R.x0 - m && p[0] < R.x1 + m && p[2] > R.z0 - m && p[2] < R.z1 + m;
  const near = [...doors, ...fires].filter((p) => inR(p, 0.4));
  const corners = [[R.x0 + 0.75, R.z0 + 1.05, 0], [R.x1 - 0.75, R.z0 + 1.05, 0], [R.x0 + 0.75, R.z1 - 1.05, Math.PI], [R.x1 - 0.75, R.z1 - 1.05, Math.PI]];
  const score = (q) => Math.min(9, ...near.map((p) => Math.hypot(p[0] - q[0], p[2] - q[1])));
  const bed = corners.slice().sort((a, b) => score(b) - score(a))[0];
  const fire = fires.find((p) => inR(p, 0.6));
  const table = [(R.x0 + R.x1) / 2 + (bed[0] < (R.x0 + R.x1) / 2 ? 0.45 : -0.45), (R.z0 + R.z1) / 2 + (bed[1] < (R.z0 + R.z1) / 2 ? 0.3 : -0.3)];
  // shelves: the longest stretch of inside wall with no opening, away from the bed
  let shelves = null;
  for (const w of L.walls) {
    const mid = w.P((w.a0 + w.a1) / 2, 0, -w.t); if (!inR(mid, 0.5) && !(w.inner && Math.abs(mid[0] - (R.x0 + R.x1) / 2) < (R.x1 - R.x0))) continue;
    let free = [[Math.min(w.a0, w.a1) + 0.4, Math.max(w.a0, w.a1) - 0.4]];
    for (const o of w.opens) free = cutSpans(free, o.a0 - 0.2, o.a1 + 0.2, 0.2);
    for (const [s, e] of free) {
      const a = (s + e) / 2, p = w.P(a, 0, -w.t - 0.2); if (!inR(p, 0.05) || e - s < 1.0) continue;
      if (Math.hypot(p[0] - bed[0], p[2] - bed[1]) < 1.2) continue;
      if (!shelves || e - s > shelves.len) shelves = { x: +p[0].toFixed(2), z: +p[2].toFixed(2), rot: +(w.f.th + Math.PI).toFixed(3), len: +Math.min(1.6, e - s).toFixed(2) };
    }
  }
  const f2 = (x) => +x.toFixed(2);
  return {
    bed: { x: f2(bed[0]), z: f2(bed[1]), rot: bed[2], w: 1.3, d: 1.95 },
    table: { x: f2(table[0]), z: f2(table[1]), rot: 0, w: 1.1, d: 0.75 },
    ...(fire ? { [L.chims.some((ch) => ch.type === 'pipe') && !L.chims.some((ch) => ch.type !== 'pipe') ? 'stove' : 'hearth']: { x: f2(fire[0]), z: f2(fire[2]) } } : {}),
    ...(shelves ? { shelves } : {}),
  };
}

// ── the weathering numbers per corner ────────────────────────────────────────────────────────────────────────────────
// every wood corner's own tint: up high the sun has bleached the brown out of it (silver-grey), low down it is darker
// and dirtier; indoors kept from the sun (darker, browner, a little lighter up near the ceiling); paint fades higher up
export function tintAt(x, y, z, t, o) {
  if (o.fresh || o.roof) return t;
  if (o.inside) { const f = 0.8 + 0.22 * smooth01(y, 0, 3.0); return [t[0] * f, t[1] * f * 0.98, t[2] * f * 0.95]; }
  if (o.paint) { const f = smooth01(y, 0.4, 5); return [t[0] * (0.92 + 0.2 * f), t[1] * (0.92 + 0.26 * f), t[2] * (0.92 + 0.3 * f)]; }
  if (o.deck) { const d = 0.82 + 0.3 * ((x * 0.37 + z * 0.61) % 1 + 1) % 1 * 0.3; t = t.map((q) => q * d); }
  const f = smooth01(y, 0.3, 4.6), lum = t[0] * 0.3 + t[1] * 0.59 + t[2] * 0.11, g = 0.6 * (o.bleach ?? 1);
  const lo = [t[0] * 0.8, t[1] * 0.77, t[2] * 0.74];
  const hi = [(t[0] + (lum * 0.92 - t[0]) * g) * 1.1, (t[1] + (lum * 1.01 - t[1]) * g) * 1.1, (t[2] + (lum * 1.12 - t[2]) * g) * 1.1];
  return [lo[0] + (hi[0] - lo[0]) * f, lo[1] + (hi[1] - lo[1]) * f, lo[2] + (hi[2] - lo[2]) * f];
}
// each board's own numbers for the board shader (parts.js boardWear): its nails, where along the wall it is, how much
// more of its paint has gone (by the corners and the doors, low down, a little board by board)
function boardAttr(geo, parts, seed, L) {
  const R = rng(seed * 97 + 5), of = geo.userData.partOf, P = geo.attributes.position, n = P.count, A = new Float32Array(n * 3);
  const per = parts.map(() => (R() < 0.3 ? 0.15 + 0.2 * R() : 0.08 * R()));
  const corners = [], doors = [];
  for (const w of L.walls) { if (w.inner) continue; corners.push(w.P(w.a0), w.P(w.a1)); for (const o of w.opens) if (o.kind === 'door' && !o.inner) doors.push([...w.P((o.a0 + o.a1) / 2, o.y1), o.a1 - o.a0]); }
  const near = (d, r) => 1 - smooth01(d, 0, r);
  for (let i = 0; i < n; i++) {
    const Q = parts[of[i]], o = Q.o; if (!o.hz && !o.nail) continue;
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (o.hz) { A[i * 3] = 2 + o.hz[1]; A[i * 3 + 1] = o.hz[0]; } else { A[i * 3] = o.nail; A[i * 3 + 1] = Q.m.elements[13]; }
    if (!o.paint) continue;
    let corner = 9, door = 9;
    for (const p of corners) corner = Math.min(corner, Math.hypot(x - p[0], z - p[2]));
    for (const [dx, dy, dz, dw] of doors) { const dd = Math.hypot(Math.max(0, Math.hypot(x - dx, z - dz) - dw / 2), Math.max(0, y - dy)); door = Math.min(door, dd); }
    A[i * 3 + 2] = per[of[i]] + 0.4 * near(corner, 1.2) + 0.35 * near(door, 0.9) + 0.2 * near(y, 1.0);
  }
  geo.setAttribute('aBoard', new THREE.BufferAttribute(A, 3));
}
// the height of the edge water drips from over a point (the grime streaks run down from it): a window's sill under it,
// else the roof over it (the porch's, the lean-to's, the wing's, the main roof's)
function dripAt(c) {
  const { L } = c, P = L.porch, m = L.main;
  return (x, z, y) => {
    if (y !== undefined) for (const s of c.sills) {
      const [ax, , az] = s.w.P(0), al = alongV(s.w.f), on = outN(s.w.f);
      const a = (x - ax) * al[0] + (z - az) * al[2], out = (x - ax) * on[0] + (z - az) * on[2];
      if (a > s.a0 && a < s.a1 && out > -0.35 && out < 0.2 && y < s.y + 0.01) return s.y - 0.01;
    }
    if (P && z > m.z1 + 0.02 && z < m.z1 + P.depth + 0.4 && x > P.x0 - 0.5 && x < P.x1 + 0.5) return P.top - (z - m.z1) * Math.tan(P.pitch) - 0.05;
    if (P && z > m.z1 - 0.35 && z < m.z1 + 0.06 && x > m.x0 - 0.1 && x < m.x1 + 0.1) return P.deck + 0.35;
    if (L.lean) { const lt = L.lean; if (x > lt.x0 - 0.3 && x < lt.x1 + 0.3 && z > lt.z0 - 0.3 && z < lt.z1 + 0.3 && (lt.side !== 'back' || z < m.z0 + 0.05)) return lt.y(x, z) - 0.05; }
    if (L.wing && (L.wing.front ? z > m.z1 + 0.05 : z < m.z0 - 0.05)) return Math.max(L.EAVE, L.wingY(x, z)) - 0.02;
    return Math.max(L.EAVE, L.roofY(x, z)) - 0.02;
  };
}

// ── build it all ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function buildCabin(recipeIn = {}, env = {}) {
  const t0 = performance.now(), r0 = cabinRecipe(recipeIn);
  if (r0.lineup) return buildLineup(r0, env);
  const r = seedVariety(r0);
  const far = r.look === 'far', k = new Kit(r.seed);
  k.parts.glow = []; k.parts.plaster = [];
  const L = layout(r, k), paint = CABIN_PAINTS[r.paint].c;
  const c = {
    k, L, r, far, env, lamps: [], sills: [], panes: [], stoneGeos: [], stoneTris: 0, leaves: [], piers: [], flats: [], rooms: [], feet: [],   // (feet: where it meets the ground, [x, z, its bottom there], for the rigs)
    paint: L.log ? null : paint, doorPaint: L.log ? paint : null, shutterPaint: L.log ? paint : null,
    trimTint: L.log ? DARKW : TRIM, trimPaint: !L.log && r.paint === 'white' ? null : null,
    chink: onMean(CLAY, env.texMean), daub: onMean(DAUB, env.texMean), flatTint: onMean(HEARTH, env.texMean),
  };
  // ON THE LAND AS IT IS (env.ground(x, z): the ground's height in its own frame, against the ground at its middle; the
  // game's maker: "foundations and stairs that go deep in the ground and the ground level is natural ... lowered as much
  // as it can without the ground coming up"): its sill logs or beams (L.FT up) 2 cm over the highest ground under its
  // walls, its porch's joists clear too; c.sit how far its zero stands over the ground at its middle, c.gl(x, z) the
  // ground's height in its frame (flat at 0 without env.ground). Its footing, piers, crawl space, chimney's foot, steps
  // and the stones at their feet reach down to the ground wherever it is (foundation, pier, porchRun, stoop, chimneys)
  c.sit = 0; c.gl = () => 0;
  if (env.ground) {
    let need = -Infinity;
    const scan = (x0, x1, z0, z1, top) => { for (let x = x0; x <= x1 + 1e-6; x += Math.max(0.2, (x1 - x0) / 16)) for (let z = z0; z <= z1 + 1e-6; z += Math.max(0.2, (z1 - z0) / 16)) need = Math.max(need, env.ground(x, z) - top); };
    for (const b of [...(r.plan === 'dogtrot' ? L.pens : [L.main]), ...(L.wing ? [L.wing] : []), ...(L.lean ? [L.lean] : [])]) scan(b.x0, b.x1, b.z0, b.z1, L.FT);
    if (L.porch) scan(L.porch.x0, L.porch.x1, L.main.z1, L.main.z1 + L.porch.depth, L.porch.deck - 0.2);
    c.sit = need + 0.02; c.gl = (x, z) => env.ground(x, z) - c.sit;
  }
  const marks = [], mark = (name) => marks.push([name, k.parts.wood.length, k.parts.iron.length]);
  // walls first (the log walls snap their openings to the courses), then everything that hangs on them
  for (const w of L.walls) if (w.kind === 'log') logWall(c, w); else if (w.kind !== 'partition') boardWall(c, w);
  for (const w of L.walls) if (w.kind === 'log' && w.gable) gableBoards(c, w);
  for (const w of L.walls) if (w.eave) eaveSeal(c, w);
  mark('walls'); openings(c); mark('openings'); roofs(c); mark('roofs'); porches(c); mark('porch');
  for (const ch of L.chims) { if (ch.type === 'pipe') stove(c, ch); else if (ch.side) stoneChimney(c, ch); else middleChimney(c, ch); }
  mark('chimneys'); foundation(c); mark('foundation');
  if (!far) { inside(c); mark('inside'); doorLeaves(c); }
  else c.rooms = [];
  // the far look's windows and doors: dark, shut (the doors a dark board in their opening)
  if (far) for (const w of L.walls) for (const o of w.opens) if (o.kind === 'door' && !o.inner) wb(k, w, [o.a1 - o.a0 - 0.08, o.y1 - L.FL, 0.04], (o.a0 + o.a1) / 2, (o.y1 + L.FL) / 2, -0.1, null, { long: 1, tint: c.doorPaint ? [0.5, 0.42, 0.36] : DOORW.map((q) => q * 0.8), paint: c.doorPaint, skip: '-z' });

  // the kit's parts into meshes, one per material
  const R = rng(r.seed + 1), geos = {}, topAt = dripAt(c);
  geos.wood = buildGeometry(k.parts.wood, 'wood', R, { topAt, tintAt });
  // (indoors the wood's pattern at half the size along the grain: a knot a board's size, not a log's. Only the board
  // strips' faces: the end grain and the shakes keep theirs)
  if (!far) {
    const Pw = geos.wood.attributes.position, Nw = geos.wood.attributes.normal, UV = geos.wood.attributes.uv, rs = c.rooms.filter((q) => !q.open);
    for (let i = 0; i < Pw.count; i++) {
      if (UV.getY(i) < 0.25) continue;
      const x = Pw.getX(i) + Nw.getX(i) * 0.06, y = Pw.getY(i) + Nw.getY(i) * 0.06, z = Pw.getZ(i) + Nw.getZ(i) * 0.06;
      if (rs.some((q) => x > q.x0 - 0.05 && x < q.x1 + 0.05 && z > q.z0 - 0.05 && z < q.z1 + 0.05 && y > L.FL - 0.1 && y < q.ceil + 0.4)) UV.setX(i, UV.getX(i) * 2);
    }
  }
  boardAttr(geos.wood, k.parts.wood, r.seed, L);
  if (k.parts.iron.length) geos.iron = buildGeometry(k.parts.iron, 'iron', R, { topAt });
  geos.plaster = buildGeometry(k.parts.plaster, 'stone', rng(r.seed + 9), {});
  if (!far) {
    geos.glow = glowGeometry(k.parts.glow, (P) => P.kind !== GLOW.glass && P.kind !== GLOW.glass + 10);
    geos.glass = glowGeometry(k.parts.glow, (P) => P.kind === GLOW.glass || P.kind === GLOW.glass + 10);
    const panes = []; for (let i = 0; i < c.panes.length; i += 2) { const g = new THREE.PlaneGeometry(...c.panes[i + 1]); g.applyMatrix4(c.panes[i]); panes.push(g); }
    geos.pane = panes.length ? mergeGeometries(panes) : null; for (const g of panes) g.dispose();
  }
  if (c.stoneGeos.length) { geos.stone = mergeGeometries(c.stoneGeos); geos.stone.userData.ownAO = true; for (const g of c.stoneGeos) g.dispose(); }
  for (const g in geos) if (!geos[g]) delete geos[g];
  const msBuild = performance.now() - t0;

  // THE BAKE: the voxel grid of the solids, then each mesh's corners (the sky through the doors and windows indoors,
  // the lanterns and the fire)
  const t1 = performance.now();
  const occ = new Occlusion(k.occ, 1.6, 0.08, { reach: 2.4, rays: far ? 12 : 20, groundReach: 0.7 });
  const lightOpen = [];
  for (const w of L.walls) for (const o of w.opens) {
    if (o.inner || o.kind === 'mass' || o.kind === 'hearth' || w.inner) continue;
    const covered = w.covered.some(([s, e]) => (o.a0 + o.a1) / 2 > s && (o.a0 + o.a1) / 2 < e); if (covered) continue;
    const ac = (o.a0 + o.a1) / 2, yc = (Math.max(o.y0, L.FL) + o.y1) / 2, hw = (o.a1 - o.a0) / 2 - 0.05, hh = (o.y1 - Math.max(o.y0, L.FL)) / 2 - 0.04;
    const ctr = w.P(ac, yc, -w.t / 2), al = alongV(w.f), on = outN(w.f);
    lightOpen.push({ c: ctr, u: al.map((q) => q * hw), v: [0, hh, 0], n: on, front: o.leaf === 'main', door2: o.leaf === 'back' });
  }
  // (a dogtrot's pens' doors open onto the breezeway, which is outdoors; a lean-to's room is indoors)
  const rooms = c.rooms.filter((q) => !q.open);
  const inRoom = (x, y, z) => rooms.some((q) => x > q.x0 - 0.02 && x < q.x1 + 0.02 && z > q.z0 - 0.02 && z < q.z1 + 0.02 && y > L.FL - 0.6 && y < q.ceil + (q.lean ? 0.6 : 0.03));
  const fill = (x, y, z, nx, ny, nz) => (inRoom(x + nx * 0.08, y + ny * 0.08, z + nz * 0.08) ? 0.15 * (1 - 0.3 * smooth01(y + ny * 0.08, 1.6, 3.0)) : 0);
  const light = new Light(occ, { inside: inRoom, fill, openings: lightOpen, lamps: c.lamps, base: 0.36, gain: 7.0 });
  const BAKED = ['wood', 'iron', 'stone', 'plaster'];
  for (const g of BAKED) if (geos[g]) light.bake(geos[g]);
  for (const Lf of c.leaves) { light.bake(Lf.geo, mul(T(...Lf.hinge), RY(Lf.open)), 'open'); light.bake(Lf.geo, T(...Lf.hinge), 'closed'); }
  light.setDoors = (open, open2) => {
    for (const g of BAKED) if (geos[g]) light.apply(geos[g], open, 'main', open2);
    for (const Lf of c.leaves) { const o = Lf.group === 'back' ? open2 : open; light.apply(Lf.geo, open, o ? 'open' : 'closed', open2); }
  };
  light.setDoors(true, true);
  const msBake = performance.now() - t1;

  // centre the footprint: everything moves by OX, OZ
  const box = new THREE.Box3();
  for (const g of Object.values(geos)) { g.computeBoundingBox(); box.union(g.boundingBox); }
  const OX = -(box.min.x + box.max.x) / 2, OZ = -(box.min.z + box.max.z) / 2;
  for (const g in geos) geos[g].translate(OX, 0, OZ);
  for (const Lf of c.leaves) Lf.hinge = [Lf.hinge[0] + OX, Lf.hinge[1], Lf.hinge[2] + OZ];
  for (const Lp of c.lamps) { Lp.p = [Lp.p[0] + OX, Lp.p[1], Lp.p[2] + OZ]; if (Lp.glow) Lp.glow = [Lp.glow[0] + OX, Lp.glow[1], Lp.glow[2] + OZ]; }
  light.offset = [OX, OZ];
  const props = far ? [] : yardProps(c); for (const p of props) { if (p.y == null && !p.inside) p.y = c.gl(p.x, p.z); p.x += OX; p.z += OZ; }   // (outdoors: on the ground where it stands)

  // what the town needs: the footprint, the doorways, the rooms and where their furniture goes, the porch
  const f2 = (x) => +x.toFixed(2), sh = (p) => [f2(p[0] + OX), f2(p[1]), f2(p[2] + OZ)];
  const doorways = [];
  for (const w of L.walls) for (const o of w.opens) if (o.kind === 'door') doorways.push({ name: o.name, centre: sh(w.P((o.a0 + o.a1) / 2, (L.FL + o.y1) / 2, o.inner ? -w.t / 2 : 0)), w: f2(o.a1 - o.a0), h: f2(o.y1 - L.FL), out: outN(w.f).map(f2), inner: !!o.inner, door: o.leaf || null });
  // (for what hangs and stands round the walls: src/cabin/layout.js keeps the player's things off these) the windows:
  // each one's middle on the wall's inside face, its width, its sill and head, the way out; the fireplaces: the opening's
  // middle on the room's side, its width and top, the way into the room, the stone hearth before it ([width, depth] out
  // from the wall), the mantel over it ([width, top]) and the fire's middle in the firebox; blocks: what else stands in a
  // room (a middle chimney's stone mass, a box stove: its door toward `front`)
  const windows = [], hearths = [], blocks = [];
  for (const w of L.walls) for (const o of w.opens) {
    if (o.kind === 'window') windows.push({ centre: sh(w.P((o.a0 + o.a1) / 2, (o.y0 + o.y1) / 2, -w.t)), w: f2(o.a1 - o.a0), y0: f2(o.y0), y1: f2(o.y1), out: outN(w.f).map(f2) });
    else if (o.kind === 'hearth') { const ch = o.chim; hearths.push({ centre: sh(w.P((o.a0 + o.a1) / 2, (o.y0 + o.y1) / 2, -w.t)), w: f2(o.a1 - o.a0), y1: f2(o.y1), into: outN(w.f).map((q) => f2(-q) || 0), slab: [1.5, 0.62], mantel: [1.62, f2(L.FL + 1.27)], fire: sh([ch.x + ch.side * 0.28, L.FL + 0.16, ch.z]) }); }
  }
  for (const ch of L.chims) {
    if (ch.type === 'pipe') blocks.push({ x0: f2(ch.x - 0.39 + OX), x1: f2(ch.x + 0.39 + OX), z0: f2(ch.z - 0.27 + OZ), z1: f2(ch.z + 0.27 + OZ), y1: f2(L.FL + 0.67), stove: true, front: [1, 0, 0] });
    else if (ch.side === 0) {
      blocks.push({ x0: f2(-ch.mw / 2 + OX), x1: f2(ch.mw / 2 + OX), z0: f2(ch.z - ch.md / 2 + OZ), z1: f2(ch.z + ch.md / 2 + OZ), y1: f2(L.CEIL), mass: true });
      for (const s of [-1, 1]) hearths.push({ centre: sh([s * ch.mw / 2, L.FL + 0.45, ch.z]), w: 0.82, y1: f2(L.FL + 0.9), into: [s, 0, 0], slab: [1.15, 0.5], mantel: null, fire: sh([s * (ch.mw / 2 - 0.24), L.FL + 0.16, ch.z]) });
    }
  }
  const roomList = c.rooms.map((R2) => ({ name: R2.name, floor: [f2(R2.x0 + OX), f2(R2.x1 + OX), f2(R2.z0 + OZ), f2(R2.z1 + OZ)], y: f2(L.FL), ceiling: f2(R2.ceil), open: !!R2.open, wall: R2.lean || !L.log ? 'boards' : 'logs', ...(R2.joists ? { joists: R2.joists.map((x) => f2(x + OX)) } : {}),
    anchors: R2.open ? {} : (() => { const a = roomAnchors(c, R2); for (const v of Object.values(a)) { v.x = f2(v.x + OX); v.z = f2(v.z + OZ); } return a; })() }));
  const fp = { w: f2(box.max.x - box.min.x), d: f2(box.max.z - box.min.z), h: f2(box.max.y), x0: f2(box.min.x + OX), x1: f2(box.max.x + OX), z0: f2(box.min.z + OZ), z1: f2(box.max.z + OZ) };
  const P = L.porch;
  const anchors = {
    footprint: fp, doorways, windows, hearths, blocks, rooms: roomList, floor: f2(L.FL),
    porch: P ? { x0: f2(P.x0 + OX), x1: f2(P.x1 + OX), z0: f2(L.main.z1 + OZ), z1: f2(L.main.z1 + P.depth + OZ), y: f2(P.deck), wrap: P.wrap } : null,
    lanterns: c.lamps.filter((q) => !q.fire).map((q) => q.p.map(f2)),
    street: [fp.x0 - 1, fp.x1 + 1, fp.z1 - 0.2, fp.z1 + 6],
    // (where the town's home spots are 8.1 x 8.6 m: does this one fit, turned to face the street)
    fitsHome: fp.w <= 8.15 && fp.d <= 8.65,
  };
  const counts = {}; let parts = 0;
  for (const g in k.parts) { counts[g] = k.parts[g].length; parts += counts[g]; }
  const B = {
    recipe: r, geos, doors: c.leaves, lamps: c.lamps, light, occ, props, offset: OX, offsetZ: OZ, anchors: { ...anchors, feet: c.feet.map(([x, z, y]) => [+(x + OX).toFixed(2), +(z + OZ).toFixed(2), +y.toFixed(2)]) }, sit: c.sit, ground: !!env.ground,
    counts, parts, msBuild, msBake, ms: performance.now() - t0, marks, kit: k, stoneTris: c.stoneTris, layout: L,
  };
  B.views = cabinViews(B);
  return B;
}

// THE YARD'S PROPS (separate pieces, props.js builds them; the Town Lab can move them): a woodpile along the end wall
// with no chimney, a barrel at a corner, a bucket by the door, a bench on the porch, a washtub on a nail
function yardProps(c) {
  const { L, r, k } = c, m = L.main, out = [], R = rng(r.seed * 41 + 3);
  const ch = L.chims.find((q) => q.side), wpSide = ch ? -ch.side : R() < 0.5 ? -1 : 1;
  const leanOn = L.lean && (L.lean.side === (wpSide < 0 ? 'left' : 'right'));
  const wx0 = wpSide < 0 ? m.x0 - (leanOn ? L.lean.depth : 0) : m.x1 + (leanOn ? L.lean.depth : 0);
  if (!(L.porch && L.porch.wrap === (wpSide < 0 ? 'left' : 'right'))) out.push({ type: 'woodpile', x: wx0 + wpSide * 0.5, z: m.z0 + 1.1, rot: Math.PI / 2, len: Math.min(2.2, r.d - 1.2), rows: 4 });
  out.push({ type: 'barrel', x: (wpSide < 0 ? m.x1 : m.x0) - wpSide * 0.15 + (wpSide < 0 ? 0.55 : -0.55) * (L.porch && L.porch.wrap ? 0 : 1), z: m.z0 + 0.45 - (L.lean && L.lean.side === 'back' ? L.lean.depth : 0), h: 0.86 });
  if (L.porch) {
    // (along the porch, never across a door: the bench in the longest stretch clear of the front doors, if one is long
    // enough; the bucket at an end that is clear. A partial porch's bench stood across its one door)
    const P = L.porch, fronts = [];
    for (const w of L.walls) for (const o of w.opens) { if (o.kind !== 'door') continue; const q = w.P((o.a0 + o.a1) / 2, 0, -w.t); if (q[2] > m.z1 - 0.6) fronts.push(q[0]); }
    let spans = [[P.x0 + 0.25, P.x1 - 0.25]];
    for (const dx of fronts) spans = spans.flatMap(([a, b]) => [[a, Math.min(b, dx - 0.8)], [Math.max(a, dx + 0.8), b]]).filter(([a, b]) => b - a > 0.05);
    const long = spans.slice().sort((p1, p2) => (p2[1] - p2[0]) - (p1[1] - p1[0]))[0];
    if (long && long[1] - long[0] >= 1.7) {
      const len = Math.min(1.5, long[1] - long[0] - 0.2), mid = (long[0] + long[1]) / 2 + (R() < 0.5 ? -1 : 1) * Math.max(0, (long[1] - long[0] - len - 0.2) / 2) * 0.5;
      out.push({ type: 'bench', x: mid, y: P.deck, z: m.z1 + 0.32, len });
    }
    const end = [P.x1 - 0.5, P.x0 + 0.5].find((x) => fronts.every((dx) => Math.abs(x - dx) > 0.8));
    if (end != null) out.push({ type: 'bucket', x: end, y: P.deck, z: m.z1 + 0.4 });
  } else {
    out.push({ type: 'bucket', x: m.x1 - 0.7, z: m.z1 + 0.45 });
  }
  // INSIDE, plainly furnished (the governor may leave these out: pri 3, low): in each room a bed (not in a lean-to
  // kitchen), a table and a chair at it, a shelf on the wall, at the room's anchors; a bucket by the fire
  for (const Rm of c.rooms) {
    if (Rm.open) continue;
    const a = roomAnchors(c, Rm), low = { y: L.FL, inside: true, pri: 3, low: true };
    if (!Rm.lean) out.push({ type: 'cabinBed', x: a.bed.x, z: a.bed.z, rot: a.bed.rot, w: 1.2, len: 1.9, ...low });
    out.push({ type: 'cabinTable', x: a.table.x, z: a.table.z, rot: 0, ...low });
    out.push({ type: 'cabinChair', x: a.table.x + 0.66, z: a.table.z + 0.05, rot: -Math.PI / 2, ...low });
    if (a.shelves) out.push({ type: 'cabinShelf', x: a.shelves.x, z: a.shelves.z, rot: a.shelves.rot, len: Math.min(1.2, a.shelves.len), ...low });
    if (a.hearth || a.stove) { const f = a.hearth || a.stove; out.push({ type: 'bucket', x: f.x + (R() < 0.5 ? -0.85 : 0.85) * (Math.abs(f.z) > Math.abs(f.x) ? 1 : 0.2), z: f.z + (Math.abs(f.x) >= Math.abs(f.z) ? 0.8 : 0) * (R() < 0.5 ? -1 : 1), ...low }); }
  }
  // (a dark galvanized washtub hung on the end wall with the woodpile, never the chimney's end, nor where a lean-to is)
  if (R() < 0.6 && !leanOn) out.push({ type: 'cabinTub', x: wpSide < 0 ? m.x0 - 0.02 : m.x1 + 0.02, y: 1.3, z: m.z1 - 0.9, rot: wpSide < 0 ? -Math.PI / 2 : Math.PI / 2 });
  void k;
  return out;
}

// THE EAVE SEALED: along the top of a wall under an eave, a frieze board on each face from the top log (or plate) up
// into the roof boards, and the wedge between the wall's top and the roof filled for the light, so neither lamplight nor
// sky shows between them
function eaveSeal(c, w) {
  const { k, L } = c, lo = Math.min(w.a0, w.a1), hi = Math.max(w.a0, w.a1), len = hi - lo, fy = w.roofY || L.roofY;
  const at = (out) => { const [x, , z] = w.P((lo + hi) / 2, 0, out); return fy(x, z) - 0.03; };
  const y0 = w.levelTop - 0.1, yo = at(0.02), yi = at(-w.t - 0.02), log = w.kind === 'log';
  if (yo > y0 + 0.02) wb(k, w, [len + 0.02, yo - y0, 0.025], (lo + hi) / 2, (y0 + yo) / 2, 0.012, null, { long: 0, tint: vary(k, log ? DARKW : TRIM, 0.85, 1.0), paint: !log && !w.lean ? c.paint : null, skip: '-z', outside: true });
  if (!c.far && yi > y0 + 0.02) wb(k, w, [len - 0.1, yi - y0, 0.025], (lo + hi) / 2, (y0 + yi) / 2, -w.t - 0.012, null, { long: 0, tint: vary(k, DARKW, 0.7, 0.85), skip: '+z' });
  const top = Math.max(yo, yi) + 0.04;
  k.solid([len, Math.max(0.1, top - y0), w.t + 0.04], null, null, wallM(w.f, (lo + hi) / 2, (y0 + top) / 2, -w.t / 2));
}

// THE CABINS' OWN PROPS (registered with props.js's makers; nothing there changes): a plank bed with a straw tick and a
// faded wool blanket, a plank table, a ladder-back chair, a wall shelf with a crock and tins, a dark galvanized
// washtub hung on a wall. Each is a handful of boards (the props' wood and iron meshes).
const FURN = [0.82, 0.64, 0.48], WOOL = [[0.3, 0.1, 0.07], [0.12, 0.14, 0.21], [0.29, 0.27, 0.23], [0.22, 0.17, 0.09]];
const fput = (k, M, size, pos, rot, o) => k.board(size, null, null, { ...o, m: mul(M, T(...pos), rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4()) });
const CABIN_MAKERS = {
  cabinBed(k, M, o) {
    // (its head at -z)
    const W = o.w ?? 1.2, Ln = o.len ?? 1.9, tint = vary(k, FURN, 0.8, 1.0), wool = WOOL[Math.floor(k.R() * WOOL.length)];
    for (const [sx, sz, h] of [[-1, -1, 0.95], [1, -1, 0.95], [-1, 1, 0.6], [1, 1, 0.6]]) fput(k, M, [0.08, h, 0.08], [sx * (W / 2 - 0.04), h / 2, sz * (Ln / 2 - 0.04)], null, { long: 1, tint });
    for (const s of [-1, 1]) fput(k, M, [0.05, 0.14, Ln - 0.1], [s * (W / 2 - 0.04), 0.36, 0], null, { long: 2, tint });
    fput(k, M, [W - 0.1, 0.34, 0.04], [0, 0.7, -Ln / 2 + 0.04], null, { long: 0, tint });
    fput(k, M, [W - 0.14, 0.12, Ln - 0.16], [0, 0.48, 0], null, { long: 2, tint: [0.6, 0.55, 0.45], paint: [0.44, 0.4, 0.31] });   // the straw tick
    fput(k, M, [W - 0.05, 0.05, Ln * 0.62], [0, 0.565, Ln * 0.17], null, { long: 2, tint: [0.5, 0.45, 0.4], paint: wool });
    for (const s of [-1, 1]) fput(k, M, [0.02, 0.24, Ln * 0.62], [s * (W / 2 - 0.02), 0.46, Ln * 0.17], null, { long: 2, tint: [0.5, 0.45, 0.4], paint: wool.map((q) => q * 0.9) });
    fput(k, M, [W - 0.4, 0.09, 0.32], [0, 0.585, -Ln / 2 + 0.26], null, { long: 0, tint: [0.6, 0.55, 0.45], paint: [0.48, 0.45, 0.38] });
    k.solid([W, 0.6, Ln], null, null, mul(M, T(0, 0.3, 0)));
  },
  cabinTable(k, M, o) {
    const W = o.w ?? 1.05, D2 = o.d ?? 0.7, tint = vary(k, FURN, 0.8, 1.0);
    fput(k, M, [W, 0.05, D2], [0, 0.735, 0], null, { long: 0, tint });
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) fput(k, M, [0.06, 0.71, 0.06], [sx * (W / 2 - 0.07), 0.355, sz * (D2 / 2 - 0.07)], null, { long: 1, tint, skip: '-y' });
    for (const s of [-1, 1]) fput(k, M, [0.03, 0.06, D2 - 0.16], [s * (W / 2 - 0.07), 0.18, 0], null, { long: 2, tint });
    fput(k, M, [W - 0.16, 0.06, 0.03], [0, 0.18, 0], null, { long: 0, tint });
    k.solid([W, 0.76, D2], null, null, mul(M, T(0, 0.38, 0)));
  },
  cabinChair(k, M, o) {
    // (facing +z, its back at -z: two tall back posts, two slats, a plank seat)
    const tint = vary(k, FURN, 0.85, 1.05), S = 0.42;
    for (const [sx, sz, h] of [[-1, -1, 0.95], [1, -1, 0.95], [-1, 1, 0.45], [1, 1, 0.45]]) fput(k, M, [0.04, h, 0.04], [sx * (S / 2 - 0.02), h / 2, sz * (S / 2 - 0.02)], null, { long: 1, tint, skip: '-y' });
    fput(k, M, [S, 0.03, S], [0, 0.45, 0], null, { long: 0, tint });
    for (const y of [0.68, 0.86]) fput(k, M, [S - 0.04, 0.07, 0.02], [0, y, -S / 2 + 0.02], null, { long: 0, tint });
    k.solid([S, 0.95, S], null, null, mul(M, T(0, 0.47, 0)));
  },
  cabinShelf(k, M, o) {
    // (its back at -z, against a wall: two boards on iron brackets, a crock and two tins on them)
    const Ln = o.len ?? 1.1, tint = vary(k, FURN, 0.85, 1.0);
    for (const y of [1.25, 1.62]) {
      fput(k, M, [Ln, 0.03, 0.24], [0, y, -0.08], null, { long: 0, tint });
      for (const s of [-1, 1]) k.box('iron', [0.02, 0.16, 0.16], null, null, { m: mul(M, T(s * (Ln / 2 - 0.12), y - 0.09, -0.12)), tint: IRON.map((q) => q * 0.7) });
    }
    k.prism('iron', ngon(8, 0.08), 0.2, null, null, { m: mul(M, T(-Ln / 4, 1.365, -0.08)), tint: [2.6, 2.3, 1.9], smooth: true, taper: 0.25 });
    for (const dx of [0.12, 0.28]) k.prism('iron', ngon(8, 0.05), 0.12, null, null, { m: mul(M, T(dx, 1.695, -0.08)), tint: TIN.map((q) => q * 0.5), smooth: true });
  },
  cabinTub(k, M) {
    // (a dark galvanized washtub hung on a nail, its bottom to the wall at -z)
    const W0 = mul(M, T(0, 0, 0.02), RX(Math.PI / 2));
    k.prism('iron', ngon(14, 0.31).map(([x, z]) => [x, z * 0.74]), 0.26, null, null, { m: mul(W0, T(0, 0.13, 0)), tint: TIN.map((q) => q * 0.42), smooth: true, taper: -0.12, skip: '+y' });
    k.box('iron', [0.012, 0.012, 0.06], null, null, { m: mul(M, T(0, 0.26, 0.03)), tint: [0.4, 0.38, 0.36] });
  },
};
for (const [n, f] of Object.entries(CABIN_MAKERS)) if (!MAKERS[n]) MAKERS[n] = f;

// ── where the lab's camera looks from, for this cabin: [camera, target] ──────────────────────────────────────────────
export const CABIN_VIEW_NAMES = ['front34', 'front', 'back34', 'side', 'roof', 'room', 'room2', 'backdoor', 'leanto', 'far', 'night'];
export function cabinViews(B) {
  const F = B.anchors.footprint, L = B.layout, OX = B.offset, OZ = B.offsetZ, H = Math.max(5, F.h);
  const R0 = Math.max(F.w, F.d, H * 1.3);
  const v = {};
  v.front34 = [[-R0 * 0.82, H * 0.52, R0 * 1.18], [0, H * 0.4, 0]];
  v.front = [[0.6, 2.0, R0 * 1.3], [0, H * 0.38, 0]];
  v.back34 = [[R0 * 0.85, H * 0.58, -R0 * 1.15], [0, H * 0.4, 0]];
  v.side = [[R0 * 1.4, H * 0.42, R0 * 0.2], [0, H * 0.38, 0]];
  v.roof = [[-R0 * 0.8, H * 2.3, R0 * 1.0], [0, H * 0.55, 0]];
  v.far = [[-R0 * 4.2, H * 1.2, R0 * 6.5], [0, H * 0.4, 0]];
  v.night = v.front34;
  // inside: from just inside the front door (or the breezeway) looking across the room toward its fire; the second
  // room (the other pen, the wing or the lean-to) from its doorway
  const rooms = B.anchors.rooms.filter((q) => !q.open), eye = L.FL + 1.6;
  const lookIn = (R) => {
    const [x0, x1, z0, z1] = R.floor, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const fire = R.anchors.hearth || R.anchors.stove, tgt = fire ? [fire.x, L.FL + 0.7, fire.z] : [cx, L.FL + 0.9, z0];
    // (stand in the corner farthest from what we look at, a little in from the walls, clear of the doors swung in)
    const ds = B.anchors.doorways.filter((d) => d.door).map((d) => d.centre);
    const cands = [[x0 + 0.35, z1 - 0.35], [x1 - 0.35, z1 - 0.35], [x0 + 0.35, z0 + 0.35], [x1 - 0.35, z0 + 0.35]];
    const sc = (a) => Math.hypot(a[0] - tgt[0], a[1] - tgt[2]) - 2.5 * Math.max(0, 1.4 - Math.min(9, ...ds.map((d) => Math.hypot(a[0] - d[0], a[1] - d[2]))));
    const st = cands.sort((a, b) => sc(b) - sc(a))[0];
    return [[st[0], eye, st[1]], tgt];
  };
  if (rooms[0]) v.room = lookIn(rooms[0]);
  if (rooms[1]) v.room2 = lookIn(rooms[1]); else v.room2 = v.room;
  // the back door from outside; the lean-to (or the wing) from its side
  const back = B.anchors.doorways.find((d) => d.door === 'back');
  if (back) { const [x, , z] = back.centre, n = back.out; v.backdoor = [[x + n[0] * 5.5 + n[2] * 2.2, 2.0, z + n[2] * 5.5 - n[0] * 2.2], [x, 1.5, z]]; }
  else v.backdoor = v.back34;
  if (L.lean) { const lt = L.lean, cx = (lt.x0 + lt.x1) / 2 + OX, cz = (lt.z0 + lt.z1) / 2 + OZ, n = lt.side === 'back' ? [0.3, -1] : lt.side === 'right' ? [1, 0.45] : [-1, 0.45]; v.leanto = [[cx + n[0] * 7.5, 2.4, cz + n[1] * 7.5], [cx, 1.7, cz]]; }
  else if (L.wing) { const g = L.wing, cx = g.xc + OX, cz = (g.z0 + g.z1) / 2 + OZ, s = B.recipe.wing === 'right' ? 1 : -1; v.leanto = [[cx + s * 7.5, 2.6, cz - 3.5], [cx, 2.0, cz]]; }
  else v.leanto = v.side;
  return v;
}

// ── the lineup: every preset side by side, merged into one set of meshes ─────────────────────────────────────────────
// (lab only: the town would merge its cabins the same way, one set of meshes for the whole row)
export function buildLineup(r, env) {
  const t0 = performance.now(), names = Object.keys(PRESETS), gap = 3.5, built = [];
  for (const name of names) built.push({ name, B: buildCabin({ ...PRESETS[name], preset: name, look: r.look, wood: r.wood, stone: r.stone, mortar: r.mortar }, env) });
  let x = 0; const spots = [];
  for (const it of built) { const F = it.B.anchors.footprint; spots.push(x + F.w / 2); x += F.w + gap; }
  const shift = -x / 2 + gap / 2, geos = {}, parts = {}, doors = [], lamps = [];
  built.forEach((it, i) => {
    const dx = spots[i] + shift, B = it.B; it.x = dx;
    for (const g in B.geos) { const geo = B.geos[g]; geo.translate(dx, 0, 0); for (const a of ['aBoard']) if (!geo.attributes[a] && g === 'wood') geo.setAttribute(a, new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3)); (parts[g] || (parts[g] = [])).push(geo); }
    for (const Lf of B.doors) { Lf.hinge = [Lf.hinge[0] + dx, Lf.hinge[1], Lf.hinge[2]]; doors.push(Lf); }
    for (const Lp of B.lamps) if (lamps.length < 10 && !Lp.fire) lamps.push({ ...Lp, p: [Lp.p[0] + dx, Lp.p[1], Lp.p[2]] });
  });
  for (const g in parts) {
    // (only the attributes every one of them has)
    const keys = Object.keys(parts[g][0].attributes).filter((a) => parts[g].every((q) => q.attributes[a]));
    for (const q of parts[g]) for (const a of Object.keys(q.attributes)) if (!keys.includes(a)) q.deleteAttribute(a);
    geos[g] = mergeGeometries(parts[g]);
    if (g === 'stone') geos[g].userData.ownAO = true;
  }
  // (one light for the row: each spot asks the cabin standing there)
  const which = (x) => { let best = built[0]; for (const it of built) if (Math.abs(x - it.x) < Math.abs(x - best.x)) best = it; return best; };
  const light = {
    at: (x, y, z, nx, ny, nz) => { const it = which(x); return it.B.light.at(x - it.x - it.B.offset, y, z - it.B.offsetZ, nx, ny, nz); },
    bake: (geo) => { for (const it of built) { void it; } geo.userData.bakes = { main: null }; },
    apply: () => {}, setDoors: () => {}, skyAt: () => 1, fillAt: () => 0,
  };
  const F = { w: x - gap, d: Math.max(...built.map((it) => it.B.anchors.footprint.d)), h: Math.max(...built.map((it) => it.B.anchors.footprint.h)) };
  const B = {
    recipe: r, geos, doors: [], lamps, light, props: [], offset: 0, offsetZ: 0,
    anchors: { footprint: { ...F, x0: -F.w / 2, x1: F.w / 2, z0: -F.d / 2, z1: F.d / 2 }, doorways: [], rooms: [], street: [-F.w / 2, F.w / 2, F.d / 2, F.d / 2 + 6] },
    counts: {}, parts: built.reduce((s, it) => s + it.B.parts, 0), msBuild: performance.now() - t0, msBake: built.reduce((s, it) => s + it.B.msBake, 0), marks: [],
    lineup: built.map((it) => ({ name: it.name, label: PRESETS[it.name].label, x: +it.x.toFixed(2), footprint: it.B.anchors.footprint, tris: Object.values(it.B.geos).reduce((s, g) => s + g.index.count / 3, 0) + it.B.doors.reduce((s, Lf) => s + Lf.geo.index.count / 3, 0) })),
  };
  for (const Lf of doors) Lf.geo.dispose();
  const v = {}, Hh = 6.5;
  B.lineup.forEach((it, i) => { v['p' + i] = [[it.x - 9, 3.2, 21], [it.x, 2.4, 0]]; });
  for (let i = 0; i < B.lineup.length; i += 4) { const grp = B.lineup.slice(i, i + 4), cx = (grp[0].x + grp[grp.length - 1].x) / 2; v['row' + (i / 4)] = [[cx, 4.2, 25], [cx, 2.2, 0]]; }
  v.front34 = [[-F.w * 0.25, Hh * 2.2, F.w * 0.5], [0, 2, 0]]; v.all = v.front34;
  B.views = v;
  return B;
}

// ── the panel's cabin controls (the lab's main.js puts them in its Building section and calls wireCabin) ────────────
export function cabinControls(R) {
  const sel = (id, key, opts, cur) => `<div class="row two"><label for="${id}">${key}</label><select id="${id}">${Object.entries(opts).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${v.label || v}</option>`).join('')}</select></div>`;
  const rng2 = (id, key, min, max, step, val, fmt = (x) => x) => `<div class="row" data-key="${id}"><label for="${id}">${key}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><output>${fmt(val)}</output></div>`;
  const chk = (id, key, on) => `<div class="row check"><label><input type="checkbox" id="${id}"${on ? ' checked' : ''}> ${key}</label></div>`;
  const presets = { ...Object.fromEntries(Object.entries(PRESETS).map(([k, p]) => [k, p.label])), random: 'Random (made up from the seed)' };
  return `<div class="lbl">Cabin</div>
    <div class="row two"><label for="c-preset">Preset</label><select id="c-preset">${Object.entries(presets).map(([k, v]) => `<option value="${k}"${k === R.preset ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="picks"><button class="btn" id="c-random">Random cabin</button><button class="btn${R.lineup ? ' on' : ''}" id="c-lineup">All presets in a row</button><button class="btn${R.look === 'far' ? ' on' : ''}" id="c-far">Far look</button></div>
    ${sel('c-walls', 'Walls', CABIN_OPTIONS.walls, R.walls)}${sel('c-plan', 'Plan', CABIN_OPTIONS.plan, R.plan)}
    ${R.plan === 'ell' ? sel('c-wing', 'Wing', CABIN_OPTIONS.wing, R.wing) : ''}
    ${rng2('c-w', R.plan === 'double' || R.plan === 'dogtrot' ? 'Each pen\'s width' : 'Width', 3.6, 7.2, 0.1, R.w, (x) => (+x).toFixed(1) + ' m')}${rng2('c-d', 'Depth', 3.4, 5.6, 0.1, R.d, (x) => (+x).toFixed(1) + ' m')}
    ${R.plan === 'dogtrot' ? rng2('c-breeze', 'Breezeway', 1.8, 3.2, 0.1, R.breeze, (x) => (+x).toFixed(1) + ' m') : ''}
    ${sel('c-room', 'Lean-to room', CABIN_OPTIONS.room, R.room)}
    ${chk('c-backDoor', 'A back door', R.backDoor)}${R.plan === 'double' ? chk('c-doors2', 'A front door to each room', R.doors2) : ''}
    ${sel('c-porch', 'Porch', CABIN_OPTIONS.porch, R.porch)}${R.porch === 'wrap' ? sel('c-wrap', 'Wraps', CABIN_OPTIONS.wrap, R.wrap) : ''}${R.porch !== 'none' ? chk('c-rails', 'Porch rails', R.rails) : ''}
    ${sel('c-chimney', 'Chimney', CABIN_OPTIONS.chimney, R.chimney)}${R.chimney !== 'none' ? sel('c-chimneyAt', 'Where', CABIN_OPTIONS.chimneyAt, R.chimneyAt) : ''}
    ${sel('c-roof', 'Roof', CABIN_OPTIONS.roof, R.roof)}${sel('c-cover', 'Covered with', CABIN_OPTIONS.cover, R.cover)}
    ${rng2('c-pitch', 'Pitch', 10, 45, 1, R.pitch, (x) => x + '°')}${rng2('c-overhang', 'Overhang', 0.15, 0.7, 0.05, R.overhang, (x) => (+x).toFixed(2) + ' m')}
    ${sel('c-windows', 'Windows', CABIN_OPTIONS.windows, R.windows)}
    ${rng2('c-winFront', 'Front windows', 0, 3, 1, R.winFront)}${rng2('c-winSide', 'End windows', 0, 2, 1, R.winSide)}${rng2('c-winBack', 'Back windows', 0, 2, 1, R.winBack)}
    ${sel('c-foundation', 'Foundation', CABIN_OPTIONS.foundation, R.foundation)}
    ${chk('c-lantern', 'A lantern by the door', R.lantern)}`;
}
// apply(full): the recipe changed (full: the panel must be drawn again, a choice that shows or hides others changed)
export function wireCabin(panel, R, apply) {
  const $ = (s) => panel.querySelector(s);
  const set = (o, full = true) => { Object.assign(R, o); Object.assign(R, cabinRecipe(R)); apply(full); };
  $('#c-preset').addEventListener('change', (e) => {
    const v = e.target.value;
    if (v === 'random') { const q = randomRecipe(R.seed); for (const k in CABIN_DEFAULTS) R[k] = q[k]; R.preset = 'random'; apply(true); return; }
    for (const k in CABIN_DEFAULTS) if (k !== 'wood' && k !== 'stone' && k !== 'mortar') R[k] = CABIN_DEFAULTS[k];
    Object.assign(R, PRESETS[v], { preset: v, lineup: false }); delete R.label; Object.assign(R, cabinRecipe(R)); apply(true);
  });
  $('#c-random').addEventListener('click', () => { const q = randomRecipe(); for (const k in CABIN_DEFAULTS) R[k] = q[k]; R.lineup = false; apply(true); });
  $('#c-lineup').addEventListener('click', () => set({ lineup: !R.lineup }));
  $('#c-far').addEventListener('click', () => set({ look: R.look === 'far' ? 'near' : 'far' }));
  for (const k of ['walls', 'plan', 'wing', 'room', 'porch', 'wrap', 'chimney', 'chimneyAt', 'roof', 'cover', 'windows', 'foundation']) { const el = $('#c-' + k); if (el) el.addEventListener('change', (e) => set({ [k]: e.target.value, preset: 'custom' })); }
  for (const k of ['backDoor', 'doors2', 'rails', 'lantern']) { const el = $('#c-' + k); if (el) el.addEventListener('change', (e) => set({ [k]: e.target.checked, preset: 'custom' }, false)); }
  for (const k of ['w', 'd', 'breeze', 'pitch', 'overhang', 'winFront', 'winSide', 'winBack']) {
    const el = $('#c-' + k); if (!el) continue;
    el.addEventListener('input', (e) => { e.target.nextElementSibling.textContent = e.target.value; });
    el.addEventListener('change', (e) => set({ [k]: +e.target.value, preset: 'custom' }, false));
  }
}
