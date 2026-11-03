// WHERE THE SIGN POSTS' BOARDS POINT (no three.js, so the tests run it as it is). A post in the town's layout names its
// places (`boards`: ids of SIGN_ROWS, top board first; models/town/layout.json); each board is aimed along the straight line
// from where that post stands to where that place stands now, worked out from the layout as it is, so a building moved
// in the Town Lab turns the boards that point at it.
//
//   SIGN_ROWS                  the names lettered in the boards' one picture, a row each (world/objects/signpost.js signTexture)
//   signPlaces(layout)         -> { id: { x, z } } where each place stands (one the layout can't say is left out)
//   boardsFor(item, layout)    -> the boards for a post: [{ id, text, len, row, y, ang }], ang as signpost.js wants it, in the
//                              post's own frame (it stands turned item.rot degrees)
//   boardsKey(boards)          -> a string that changes when a post's boards do
//   bearingOf(x, z, p)         -> degrees from north (-z) clockwise, from (x, z) to the place p
import { HILL } from './landforms.js';
import { SITES } from './sites.js';
import { CROSS_AT } from '../../src/bridgeplan.js';

// (the first four as signpost.js's SIGN_BOARDS has them, row for row: the post a lab shows on its own)
export const SIGN_ROWS = [
  { id: 'mill', text: 'MILL HILL', len: 0.98 }, { id: 'pasture', text: 'PASTURE', len: 0.9 }, { id: 'lake', text: 'THE LAKE', len: 0.94 },
  { id: 'bridge', text: 'BRIDGE', len: 0.84 }, { id: 'farm', text: 'FARM', len: 0.72 }, { id: 'square', text: 'TOWN SQUARE', len: 1.2 },
  { id: 'homes', text: 'HOMESTEADS', len: 1.12 }, { id: 'range', text: 'BOTTLE RANGE', len: 1.24 }, { id: 'hollis', text: 'HOLLIS CAMP', len: 1.16 },
  { id: 'cow', text: 'COW CAMP', len: 0.94 }, { id: 'ford', text: 'THE FORD', len: 0.94 },
];
const ROW_OF = new Map(SIGN_ROWS.map((r, i) => [r.id, { ...r, row: i }]));
const BOARD_Y = [2.12, 1.9, 1.68, 1.46];   // (each board's height on the post, m)
const NEW_POST = ['mill', 'pasture', 'lake', 'farm'];   // (a post put down without its own list)

const at = (p) => (p && Number.isFinite(+p.x) && Number.isFinite(+p.z) ? { x: +p.x, z: +p.z } : null);
export function signPlaces(layout) {
  const items = (layout && layout.items) || [], game = (layout && layout.game) || {};
  const homes = items.filter((it) => it.type === 'model' && it.kind === 'home');
  const P = {
    mill: at(HILL), lake: at(SITES.dock), range: at(SITES.range), hollis: at(SITES.hollisCamp), cow: at(SITES.cowCamp),
    bridge: { x: CROSS_AT.bridge[0], z: CROSS_AT.bridge[1] }, ford: { x: CROSS_AT.upriver[0], z: CROSS_AT.upriver[1] },
    farm: at(game.farm) || at(SITES.farm), pasture: at(game.pasture), square: at(game.square) || at(game.spawn),
    homes: homes.length ? { x: homes.reduce((n, it) => n + it.x, 0) / homes.length, z: homes.reduce((n, it) => n + it.z, 0) / homes.length } : null,
  };
  for (const k of Object.keys(P)) if (!P[k]) delete P[k];
  return P;
}
export function boardsFor(item, layout) {
  const P = signPlaces(layout), rot = (+item.rot || 0) * Math.PI / 180, ids = Array.isArray(item.boards) && item.boards.length ? item.boards : NEW_POST;
  return ids.filter((id) => ROW_OF.has(id) && P[id]).slice(0, BOARD_Y.length).map((id, i) => {
    const r = ROW_OF.get(id), p = P[id];
    return { id, text: r.text, len: r.len, row: r.row, y: BOARD_Y[i], ang: Math.atan2(item.z - p.z, p.x - item.x) - rot };   // (a board runs along its +x: turned ang about y, it points at (cos, -sin))
  });
}
export const boardsKey = (boards) => boards.map((b) => `${b.row}:${b.ang.toFixed(3)}`).join('|');
export const bearingOf = (x, z, p) => ((Math.atan2(p.x - x, z - p.z) * 180 / Math.PI) % 360 + 360) % 360;
