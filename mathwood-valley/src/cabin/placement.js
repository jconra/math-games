// THE GAME MAKER'S OWN SPOTS for the player's cabin's things: models/cabin/placement.json, written by the Building Lab's
// Place things (labs/buildings/placing.js, through the save script ~/pw/bandit-math/rigs/town/save_server.cjs), read by
// the game (interior.js) and the lab. A spot there wins over the one layout.js works out (cabinLayout's `saved`).
//
// The file: { "v": 1, "spots": { "<design>": { "<thing>": spot } } }, one line a thing so it reads and diffs easily.
//   <design>: layout.js placementKey: the preset ('tworoom') with its own seed, else 'tworoom/587'
//   <thing>:  a keepsake's job ('cattle', 'boxes' ...) or a slot's id ('table', 'picture' ...): layout.js THINGS
//   spot:     a wall thing { at: [x, y, z], wall: [dx, 0, dz] }; a floor thing { at: [x, null, z], rot }; the dog beds
//             { spots: [{ x, z, rot }] }   (the cabin's own frame, metres; rot in degrees)
//
//   loadPlacement(base, { fresh })  -> Promise<{ v, spots }> (an empty one if there's no file or it's broken)
//   spotsFor(file, key)             -> { thing: spot } for a design, or null
//   placementText(file)             -> the file's text
//   PLACEMENT_FILE                  the file's path in the game's folder
export const PLACEMENT_FILE = 'models/cabin/placement.json';

const okFile = (d) => d && typeof d === 'object' && !Array.isArray(d) && d.v === 1 && (!d.spots || (typeof d.spots === 'object' && !Array.isArray(d.spots)));
let loaded = null;
export function loadPlacement(base, { fresh = false } = {}) {
  if (loaded && !fresh) return loaded;
  // (no-cache: asked again of the server each load, so a spot saved in the lab shows after a reload of the game)
  loaded = fetch(new URL(PLACEMENT_FILE, base).href, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    .then((d) => (okFile(d) ? { v: 1, spots: d.spots || {} } : { v: 1, spots: {} }));
  return loaded;
}
export const spotsFor = (file, key) => (file && file.spots && file.spots[key] && typeof file.spots[key] === 'object' ? file.spots[key] : null);

// numbers to the centimetre (a rot to the degree)
const r2 = (v) => (v == null ? null : Math.round(+v * 100) / 100);
function tidy(s) {
  const o = {};
  if (Array.isArray(s.at)) o.at = s.at.map(r2);
  if (Array.isArray(s.wall)) o.wall = s.wall.map((q) => Math.round(+q) || 0);
  if (s.rot != null) o.rot = Math.round(+s.rot) || 0;
  if (s.scale != null) o.scale = r2(s.scale);
  if (Array.isArray(s.spots)) o.spots = s.spots.map((q) => ({ x: r2(q.x), z: r2(q.z), rot: r2(q.rot || 0) }));
  return o;
}
export function placementText(file) {
  const J = JSON.stringify, designs = Object.entries((file && file.spots) || {}).filter(([, v]) => v && Object.keys(v).length);
  if (!designs.length) return '{\n  "v": 1,\n  "spots": {}\n}\n';
  const body = designs.map(([k, things]) => `    ${J(k)}: {\n${Object.entries(things).map(([id, s]) => `      ${J(id)}: ${J(tidy(s))}`).join(',\n')}\n    }`).join(',\n');
  return `{\n  "v": 1,\n  "spots": {\n${body}\n  }\n}\n`;
}
