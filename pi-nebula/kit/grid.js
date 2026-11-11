// THE GRID every station piece snaps to.
//   Floor cells are 2 x 2 m. A room is 3 m floor to ceiling; decks stack every 4 m (1 m under each floor for pipes).
//   A piece is placed by { cell: [x, z], turn, off }:
//     cell  in cells: whole numbers are the middle of a cell, halves are its edges and corners (cell [0, 0] is the
//           middle of the first cell, at world (0, 0); cell [0.5, 0] is the edge between it and the next cell in x)
//     turn  quarter turns about the up axis, counter-clockwise seen from above (0..3); every piece is drawn facing +z
//     off   an optional [x, y, z] nudge in metres, in the piece's own (turned) frame: how far along a wall and how high
//           a wall-kit item hangs
//     deck  an optional deck number (each deck 4 m above the last)
// A room may bring a grid of its own (a ship's, finer): { cell, step, deck, deckH } in its file. Then cell is in its
// cells (cell metres each), and a placement may also say `level`: how many steps (step metres each) above the room's
// deck height (deck, metres off the ground) it stands. Without one, the station's grid above, exactly as before.
import * as THREE from 'three';

export const CELL = 2;            // a floor cell, metres
export const ROOM_H = 3;          // floor to ceiling
export const DECK_H = 4;          // deck to deck (1 m under each floor)
export const WALL_FACE = 0.22;    // a wall panel's face stands this far in from its cell edge
export const RIB_FACE = 0.4;      // the ribs stand well proud of the panels (their fins)
export const RIB_W = 0.22;        // a rib's width along the wall
// a SHIP's grid: 0.5 m cells (a quarter of the station's), 0.5 m steps up and down from the deck, the deck 1.26 m off
// the ground (seven of the boarding stair's steps), rooms 5 steps (2.5 m) from deck to ceiling
export const SHIP_GRID = { cell: 0.5, step: 0.5, deck: 7 * 0.18, deckH: 4, room: 5 };

const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _o = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

// the matrix that takes a piece from its own frame to the world
export function placeMatrix(pl, out = new THREE.Matrix4(), grid = null) {
  const [cx, cz] = pl.cell || [0, 0], t = ((pl.turn || 0) % 4 + 4) % 4;
  _q.setFromAxisAngle(UP, t * Math.PI / 2);
  _o.set(...(pl.off || [0, 0, 0])).applyQuaternion(_q);
  if (grid) _p.set(cx * grid.cell + _o.x, (grid.deck ?? 0) + (pl.deck || 0) * (grid.deckH ?? DECK_H) + (pl.level || 0) * (grid.step ?? 0) + _o.y, cz * grid.cell + _o.z);
  else _p.set(cx * CELL + _o.x, (pl.deck || 0) * DECK_H + _o.y, cz * CELL + _o.z);
  return out.compose(_p, _q, _s);
}

// is a placement on the grid? (cells in halves, whole quarter turns)
export function onGrid(pl) {
  const half = (v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-6;
  return Array.isArray(pl.cell) && pl.cell.length === 2 && pl.cell.every(half) && Number.isInteger(pl.turn ?? 0);
}
