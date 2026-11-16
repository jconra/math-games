// THE GAME'S OWN MARKERS in the station: where the player starts (the people, where they work, sit, talk and walk, and
// what they do with their day, are life.js's). NOT ONE COORDINATE: each says where by the station file's own names
// (kit/rooms/station.json: its spawn, its named places, its rooms, the pieces in them), so when the station is rebuilt
// (rooms moved, hangars added) they follow. A marker whose name the station no longer has is left out, and listed in
// GAME.missing.
//
// A spot ("at") is one of (people.js resolve, and life.js's spots):
//   { spawn: true }                               the station file's spawn (where a new arrival wakes: their quarters)
//   { place: 'galley' }  { place: 'triageBays', n: 1 }
//                                                 one of the station file's named places (the n-th of a list of them)
//   { room: 'terminal' }  { room: /smelt/i }      a room, by its id (or a room whose id or name matches): its middle
//   { room: 'terminal', at: [0.3, 0.6], face: [x, z] }
//                                                 a point in a room's box, by fractions across it (life.js), facing a way
//   { piece: 'counter', variant: 'serve', local: [x, y, z], face: [x, z] }
//                                                 a kind of piece (and its variant), anywhere in the station: a point in
//                                                 the piece's own frame (metres), facing a way in that frame (room: only
//                                                 in that room; all: every such piece, life.js)
// with, on any of them:
//   toward: <another spot>   face that way;   out: metres moved from the spot toward it (minus: away)
// Each spot is then moved to the nearest place a person can stand.
export const START = { spawn: true };
