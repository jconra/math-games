// THE MUSIC'S SCREEN ABOARD EACH SHIP (MUSIC 3). The game's maker, 2026-11-24: "Oh, also the ships should have access
// to the music too". One wall screen in each ship's cabin, on a wall of a room the crew sit in (the mess, the crew
// room), never among the cockpit's dashboards: the station's wall screen's own shape (46 x 25 cm), its face dark. The
// cabin kit draws it (kit/ships/cabin-built.js) where this says, by the blueprint the ship is built from; the game lays
// the music's picture over its face while the music is on (src/music/places.js). Nothing of the ships' own models is
// touched: the screen hangs on a cabin wall.
//   CABIN_MUSIC[blueprint id] = { room, at: [x, y over the room's floor, z] (the screen's middle on the wall's face, the ship's
//                 own frame: nose +z, port +x), ry (its turn about the up axis: 0 faces +z, PI/2 faces +x) }
//   MUSIC_SCREEN  its size: the face, the bezel round it, how deep it is
export const MUSIC_SCREEN = { w: 0.46, h: 0.25, bezel: 0.03, depth: 0.03, look: { c: '#0d131b', r: 0.1, m: 0.3, w: 0.05 } };
// (each on the wall over its room's table: the Miner's and the Hauler's on the hull's side over the dinette, the
// Explorer's on the hull's side over its bench, under the cabinets, the Medic's in its crew room over the table)
export const CABIN_MUSIC = {
  'miner-ore-cockpit': { room: 'mess', at: [-0.97, 1.3, 1.5], ry: Math.PI / 2 },
  'hauler-his-plan': { room: 'crew', at: [-0.97, 1.3, 1.5], ry: Math.PI / 2 },
  'explorer-c-row': { room: 'mess', at: [-1.97, 1.4, 1.2], ry: Math.PI / 2 },
  'medic-open-bench': { room: 'crew', at: [0.47, 1.35, -3.75], ry: -Math.PI / 2 },
};
