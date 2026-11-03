// THE PROPS LIBRARY'S CATALOG (the plan: the game's PROPS notes; no three.js here, so node tests can read it). Each prop has
// a kind (the name a building's prop list uses: { type: kind, x, y, z, rot, ... }, labs/buildings/props.js), a name, a
// category, how much floor it takes, its triangle budget, a keep rank (0 always .. 3 only the richest graphics) and the
// recipe fields a lab builds its controls from. Everything built from it comes out merged, one mesh per material.
//
// A FIRST SLICE: the props moved so far and the ones the kit could already make; the rest come over a category at a time
// (the plan's "The prop list to have"), each one a line here and a maker in world/props/makers/.
//
//   CATEGORIES                     the tabs, in order
//   PROPS                          kind -> the prop
//   PROP_LIST                      the props in catalog order
//   propsIn(category)              the props in a category
//   resolveKind(kind)              the library's kind for any kind a save may hold (ALIASES), or null
//   normaliseRecipe(kind, recipe)  a recipe with its numbers clamped, its choices checked, anything unknown dropped;
//                                  only what differs from the defaults is kept

export const CATEGORIES = ['Furniture', 'Goods', 'Containers', 'Tools', 'Lights', 'Yard', 'Signs and paper'];

// the shared fields: size (a scale), seed (which boards, which cuts)
const SEED = { key: 'seed', label: 'Seed', min: 1, max: 99, step: 1, def: 5 };
const num = (key, label, min, max, step, def) => ({ key, label, min, max, step, def });
const pick = (key, label, options, def) => ({ key, label, options, def });
const check = (key, label, def) => ({ key, label, check: true, def });

// the framed pictures in the sheet (world/props/sheet.js SHEET.pictures has the same ids)
export const PICTURES = ['sheriff', 'wren', 'keeper', 'boss', 'horse', 'stag', 'square', 'mill', 'lake', 'valley', 'band', 'barkeep'];

const LIST = [
  // furniture
  { kind: 'roundTable', name: 'Round table', cat: 'Furniture', foot: [0.92, 0.92], h: 0.76, tris: 340, rank: 1, flags: ['used'], art: 'saloon', fields: [num('r', 'Radius (m)', 0.3, 0.7, 0.01, 0.46)] },
  { kind: 'spindleChair', name: 'Spindle chair', cat: 'Furniture', foot: [0.42, 0.42], h: 0.97, tris: 360, rank: 1, flags: ['seat'], art: 'saloon', fields: [] },
  { kind: 'barStool', name: 'Bar stool', cat: 'Furniture', foot: [0.36, 0.36], h: 0.86, tris: 240, rank: 1, flags: ['seat'], art: 'saloon', fields: [] },
  { kind: 'pianoStool', name: 'Piano stool', cat: 'Furniture', foot: [0.36, 0.36], h: 0.58, tris: 160, rank: 2, flags: ['seat'], art: 'saloon', fields: [] },
  { kind: 'piano', name: 'Upright piano', cat: 'Furniture', foot: [1.5, 0.75], h: 1.34, tris: 900, rank: 0, flags: ['used'], art: 'saloon', fields: [] },
  { kind: 'bench', name: 'Plank bench', cat: 'Furniture', foot: [1.4, 0.4], h: 0.45, tris: 140, rank: 2, flags: ['seat'], fields: [num('len', 'Length (m)', 0.8, 2.4, 0.05, 1.4), check('back', 'A back (a settee)', false)] },
  { kind: 'framedPicture', name: 'Framed picture', cat: 'Furniture', foot: [0.7, 0.05], h: 0.55, tris: 60, rank: 1, flags: [], wall: 1.4, fields: [pick('pic', 'Picture', PICTURES, 'valley'), num('w', 'Width (m)', 0.25, 1.2, 0.01, 0.62), num('h', 'Height (m)', 0.25, 1.0, 0.01, 0.46)] },
  { kind: 'bed', name: 'Bed', cat: 'Furniture', foot: [1.0, 1.95], h: 0.7, tris: 400, rank: 1, flags: [], art: 'saloon', fields: [] },
  { kind: 'washstand', name: 'Wash stand', cat: 'Furniture', foot: [0.6, 0.45], h: 0.85, tris: 260, rank: 2, flags: [], art: 'saloon', fields: [] },
  { kind: 'ragRug', name: 'Rag rug', cat: 'Furniture', foot: [1.6, 1.0], h: 0.02, tris: 20, rank: 2, flags: [], art: 'saloon', fields: [] },
  // goods
  { kind: 'boots', name: 'Pair of boots', cat: 'Goods', foot: [0.32, 0.2], h: 0.32, tris: 470, rank: 2, flags: [], fields: [pick('leather', 'Leather', ['brown', 'black'], 'brown')] },
  // containers
  { kind: 'barrel', name: 'Barrel', cat: 'Containers', foot: [0.6, 0.6], h: 0.86, tris: 340, rank: 2, flags: [], fields: [num('h', 'Height (m)', 0.6, 1.1, 0.01, 0.86), pick('fill', 'Heaped with', ['', 'apples', 'crackers', 'pickles'], '')] },
  { kind: 'keg', name: 'Keg', cat: 'Containers', foot: [0.4, 0.4], h: 0.5, tris: 260, rank: 2, flags: [], fields: [] },
  { kind: 'crate', name: 'Crate', cat: 'Containers', foot: [0.5, 0.5], h: 0.5, tris: 180, rank: 2, flags: [], fields: [num('size', 'Size (m)', 0.3, 0.8, 0.01, 0.5)] },
  { kind: 'bucket', name: 'Wooden bucket', cat: 'Containers', foot: [0.3, 0.3], h: 0.3, tris: 215, rank: 3, flags: [], fields: [] },
  { kind: 'pail', name: 'Tin pail', cat: 'Containers', foot: [0.28, 0.28], h: 0.26, tris: 290, rank: 3, flags: [], fields: [] },
  { kind: 'sack', name: 'Sack', cat: 'Containers', foot: [0.4, 0.3], h: 0.62, tris: 270, rank: 2, flags: [], fields: [pick('print', 'Sack', ['flour', 'coffee', 'burlap'], 'flour'), check('lie', 'Lying down', false)] },
  { kind: 'coalBucket', name: 'Coal scuttle', cat: 'Containers', foot: [0.3, 0.3], h: 0.4, tris: 205, rank: 3, flags: [], fields: [] },
  { kind: 'washtub', name: 'Washtub', cat: 'Containers', foot: [0.6, 0.6], h: 0.3, tris: 340, rank: 3, flags: [], fields: [] },
  { kind: 'milkCan', name: 'Milk can', cat: 'Containers', foot: [0.3, 0.3], h: 0.6, tris: 376, rank: 2, flags: [], fields: [] },
  { kind: 'woolSack', name: 'Wool sack', cat: 'Containers', foot: [0.6, 0.4], h: 0.5, tris: 300, rank: 2, flags: [], fields: [] },
  { kind: 'eggCrate', name: 'Egg crate', cat: 'Containers', foot: [0.5, 0.4], h: 0.3, tris: 370, rank: 2, flags: [], fields: [] },
  // tools
  { kind: 'shovel', name: 'Shovel', cat: 'Tools', foot: [0.25, 0.1], h: 1.3, tris: 100, rank: 3, flags: [], fields: [] },
  { kind: 'broom', name: 'Broom', cat: 'Tools', foot: [0.25, 0.1], h: 1.4, tris: 220, rank: 3, flags: [], fields: [] },
  // lights
  { kind: 'hangingLantern', name: 'Hanging lantern', cat: 'Lights', foot: [0.2, 0.2], h: 0.5, tris: 160, rank: 0, flags: ['used', 'lit'], fields: [num('drop', 'Chain (m)', 0.05, 1.2, 0.01, 0.25)] },
  // yard
  { kind: 'trough', name: 'Water trough', cat: 'Yard', foot: [1.6, 0.6], h: 0.5, tris: 150, rank: 0, flags: ['used'], fields: [] },
  { kind: 'hitchrail', name: 'Hitching rail', cat: 'Yard', foot: [2.4, 0.2], h: 1.05, tris: 280, rank: 0, flags: ['used'], fields: [] },
  { kind: 'bale', name: 'Hay bale', cat: 'Yard', foot: [0.9, 0.5], h: 0.42, tris: 50, rank: 2, flags: [], fields: [] },
  { kind: 'plank', name: 'Leaning plank', cat: 'Yard', foot: [0.3, 0.5], h: 1.8, tris: 50, rank: 3, flags: [], fields: [] },
  { kind: 'woodpile', name: 'Woodpile', cat: 'Yard', foot: [1.4, 0.5], h: 0.8, tris: 470, rank: 2, flags: [], fields: [] },
  // signs: a town prop, drawn by the town's own kit (world/objects/signpost.js), so it is shown apart in the lab
  { kind: 'signpost', name: 'Signpost', cat: 'Signs and paper', foot: [0.5, 0.5], h: 2.5, tris: 700, rank: 0, flags: ['used'], town: true, fields: [] },
];
export const PROP_LIST = LIST.map((p) => ({ fields: [], flags: [], ...p, fields: [...(p.fields || []), SEED] }));
export const PROPS = Object.fromEntries(PROP_LIST.map((p) => [p.kind, p]));

// kinds an older file may hold, and the library's name for each
export const ALIASES = { hitchingPost: 'hitchrail', table: 'roundTable', chair: 'spindleChair' };

export const propsIn = (cat) => PROP_LIST.filter((p) => p.cat === cat);
export function resolveKind(kind) { const k = ALIASES[kind] || kind; return PROPS[k] ? k : null; }

export function normaliseRecipe(kind, recipe = {}) {
  const k = resolveKind(kind); if (!k) return null;
  const out = { kind: k };
  for (const f of PROPS[k].fields) {
    let v = recipe[f.key];
    if (v === undefined || v === null) continue;
    if (f.options) { if (!f.options.includes(v)) continue; }
    else if (f.check) v = !!v;
    else { v = Number(v); if (!Number.isFinite(v)) continue; v = Math.min(f.max, Math.max(f.min, v)); }
    if (v !== f.def) out[f.key] = v;
  }
  return out;
}
