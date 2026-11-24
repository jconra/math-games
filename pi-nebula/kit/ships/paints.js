// THE SHIPS' PAINTS: the paint of a ship's hull, picked from a small set, and laid on a ship as it is built. The plain
// part has no page and no three.js, so node tests it (pi-nebula/tests/paint.test.mjs).
//
// THE GAME'S MAKER, asked what he would want to change on a ship that is his (2026-11-23): "Its colour: pick the paint
// of its hull." (And of buying one, 2026-11-22: "you can now take it out any time you want and possibly customize it.")
//
// WHAT THE HULL'S PAINT IS: the ship's skin, the cream or white panels that are most of what is seen of it (each built
// ship's own palette names them: SKIN below, held to the kits by a test). Its dark graphite lower hull and panels, its
// yellow and black hazard stripes, its belly, metal, glass, engines, legs, light strips, lamps and emblem are not paint
// that is picked: they stay as the ship was built, whatever its paint. So do its insides, and the Miner's canisters
// (they are cargo: the crane swaps them).
//
// HOW IT IS LAID (paintBuilt): a built ship is a few merged meshes that carry each corner's colour (kit/layout.js); the
// corners painted with the skin's colour are found once, by that colour, and their colour is changed where it lies.
// Nothing is built again and nothing is added: no picture, no material, no mesh, no draw. The corners' places do not
// change, so the station's saved light (kit/bakefile.js: it knows a room by its corners' places) still fits; the light
// and the corner darkening lie over the new colour as they lay over the old, and so do the dirt, the scuffs and the
// worn edges (the materials work them out from whatever colour is under them: pale scuffs on a dark paint).
// A panel's edge that the kit paints a shade off its panel keeps that shade off the new paint.

// THE PAINTS. The first is the ship's own, as it was built (no colour: nothing is changed). The rest in the game's
// maker's taste for vehicles (chunky, dark, military, muted rather than candy): c, the paint (sRGB).
export const PAINTS = [
  { id: 'factory', name: 'Factory' },
  { id: 'graphite', name: 'Graphite', c: '#5b6067' },
  { id: 'olive', name: 'Olive drab', c: '#5e6240' },
  { id: 'sand', name: 'Desert sand', c: '#ad966e' },
  { id: 'rust', name: 'Rust red', c: '#7d3625' },
  { id: 'navy', name: 'Navy', c: '#30415f' },
  { id: 'ghost', name: 'Ghost grey', c: '#8d959b' },
  { id: 'teal', name: 'Deep teal', c: '#22605c' },
  { id: 'mustard', name: 'Mustard', c: '#987220' },
];
export const FACTORY = 'factory';
export const paintById = (id) => PAINTS.find((p) => p.id === id) || null;
// (a paint's id as kept: one of the set, or the ship's own)
export const tidyPaint = (id) => (paintById(id) ? id : FACTORY);

// EACH SHIP'S SKIN, as its kit paints it (kit/ships/<ship>-built.js PAL; sRGB): the first is the skin, the rest the
// shades the kit gives its panels' edges. kit: the kit's file and the palette's names, for the test that holds these
// to it (a kit that changes its skin's colour must change it here, or its paint would find nothing to change:
// paintBuilt says so out loud).
export const SKIN = {
  miner: { c: ['#cfc5ac'], kit: 'miner-built.js', names: ['cream', 'creamEdge'] },
  explorer: { c: ['#dedcd5'], kit: 'explorer-built.js', names: ['skin', 'skinEdge'] },
  medic: { c: ['#d8d0bf', '#d9d5ca'], kit: 'medic-built.js', names: ['skin', 'skinEdge'] },
  hauler: { c: ['#d6cbb2', '#d9d2c0'], kit: 'hauler-built.js', names: ['skin', 'skinEdge'] },
};
export const SHIP_IDS = Object.keys(SKIN);
// the colour a ship's hull shows in a paint (sRGB): the paint's, or its own skin's
export const hullColour = (ship, id) => { const p = paintById(id); return (p && p.c) || (SKIN[ship] ? SKIN[ship].c[0] : '#cccccc'); };

// ── colour sums: '#rrggbb' to linear light (as three.js reads a colour for a corner), and back ──
const toLin = (v) => (v < 0.04045 ? v * 0.0773993808 : Math.pow(v * 0.9478672986 + 0.0521327014, 2.4));
const toSrgb = (v) => (v < 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 0.41666) - 0.055);
export const lin = (hex) => [1, 3, 5].map((i) => toLin(parseInt(hex.slice(i, i + 2), 16) / 255));
export const hexOf = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(toSrgb(Math.max(0, Math.min(1, v))) * 255))).toString(16).padStart(2, '0')).join('');
// how bright a colour looks, 0 to 1 (linear light; for telling whether two things can be told apart)
export const lum = (hex) => { const [r, g, b] = lin(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

// A CORNER'S NEW COLOUR: its own (linear) times the paint's over the skin's, each of red, green and blue: the skin
// itself comes out as the paint exactly, and an edge a shade off the skin stays that shade off the paint.
export function tintOf(ship, id) {
  const p = paintById(id), S = SKIN[ship];
  if (!p || !p.c || !S) return null;
  const from = lin(S.c[0]), to = lin(p.c), k = to.map((v, i) => v / Math.max(1e-4, from[i]));
  return (rgb) => rgb.map((v, i) => Math.max(0, Math.min(1, v * k[i])));
}

// ── LAID ON A BUILT SHIP ──
// The corners of one colour list that are the skin's: found once (which, and what colour each was built with), kept
// for as long as the list is (a WeakMap: a ship thrown away takes its record with it).
const FOUND = new WeakMap();
function skinOf(attr, S) {
  let F = FOUND.get(attr);
  if (F) return F;
  const a = attr.array, n = attr.itemSize, bytes = a instanceof Uint8Array, full = bytes ? 255 : 1, tol = bytes ? 1.01 : 0.004;
  const want = S.c.map((hex) => lin(hex).map((v) => (bytes ? Math.round(v * 255) : v)));
  const idx = [];
  for (let i = 0, c = a.length / n; i < c; i++) {
    const r = a[i * n], g = a[i * n + 1], b = a[i * n + 2];
    for (const w of want) if (Math.abs(r - w[0]) <= tol && Math.abs(g - w[1]) <= tol && Math.abs(b - w[2]) <= tol) { idx.push(i); break; }
  }
  const base = new Float32Array(idx.length * 3);
  idx.forEach((i, j) => { base[j * 3] = a[i * n] / full; base[j * 3 + 1] = a[i * n + 1] / full; base[j * 3 + 2] = a[i * n + 2] / full; });
  F = { idx: Uint32Array.from(idx), base, full, n, on: FACTORY };
  FOUND.set(attr, F);
  return F;
}
function lay(attr, S, ship, id) {
  const F = skinOf(attr, S);
  if (!F.idx.length || F.on === id) return F.idx.length;
  const a = attr.array, tint = tintOf(ship, id), memo = new Map();
  for (let j = 0; j < F.idx.length; j++) {
    const i = F.idx[j] * F.n, b0 = F.base[j * 3], b1 = F.base[j * 3 + 1], b2 = F.base[j * 3 + 2];
    let out = [b0, b1, b2];
    if (tint) { const key = b0 + ',' + b1 + ',' + b2; out = memo.get(key); if (!out) memo.set(key, (out = tint([b0, b1, b2]))); }
    a[i] = F.full === 255 ? Math.round(out[0] * 255) : out[0]; a[i + 1] = F.full === 255 ? Math.round(out[1] * 255) : out[1]; a[i + 2] = F.full === 255 ? Math.round(out[2] * 255) : out[2];
  }
  F.on = id; attr.needsUpdate = true;
  return F.idx.length;
}
// A BUILT SHIP PAINTED: `built` is what the kit's layout made (kit/layout.js buildRoom: a station with the ship parked
// in it, or the ship alone), `ship` whose skin, `id` the paint (the ship's own: back as it was built).
//   zones: the built's rooms that are this ship (a station: ['ship-miner']); none given: all of it is the ship
// Its still parts and the doors flush in its skin are one list of corners; each of its moving parts (its legs, its
// pods, its stair, its ramps) is a small list of its own, painted too if it is this ship's alone.
// Returns { corners, lists } painted (the same whatever the paint); nothing found is said out loud.
export function paintBuilt(built, ship, id, { zones = null } = {}) {
  const S = SKIN[ship], paint = tidyPaint(id);
  if (!built || !S) return { corners: 0, lists: 0 };
  const mine = (zid) => !zones || zones.includes(zid);
  const lists = new Set();
  for (const z of built.zones || []) { const a = mine(z.id) && z.merged && z.merged.solid && z.merged.solid.attributes.color; if (a) lists.add(a); }
  // (the moving parts: a kind of leaf is drawn once for every copy of it, so one that another room uses too is left)
  const others = new Set(), leaves = new Set();
  for (const D of [...(built.doors || []), ...(built.glides || [])]) for (const leaf of D.leaves || []) for (const m of leaf.meshes || []) {
    const a = /:solid$/.test(m.name || '') && m.geometry && m.geometry.attributes.color; if (!a) continue;
    (mine(D.zone) ? leaves : others).add(a);
  }
  for (const a of leaves) if (!others.has(a)) lists.add(a);
  let corners = 0, n = 0;
  for (const a of lists) { const c = lay(a, S, ship, paint); if (c) { corners += c; n++; } }
  if (!corners) console.warn(`paint: nothing of the ${ship}'s skin was found to paint (kit/ships/paints.js SKIN)`);
  return { corners, lists: n };
}
