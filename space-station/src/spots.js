// THE GAME'S OWN MARKERS in the station: where the player starts, where people stand, where they walk. NOT ONE
// COORDINATE: each says where by the station file's own names (kit/rooms/station.json: its spawn, its named places,
// its rooms, the pieces in them), so when the station is rebuilt (rooms moved, hangars added) they follow. A marker
// whose name the station no longer has is left out, and listed in GAME.missing.
//
// A spot ("at") is one of:
//   { spawn: true }                               the station file's spawn (where a new arrival wakes: their quarters)
//   { place: 'galley' }                           one of the station file's named places
//   { room: 'terminal' }  { room: /smelt/i }      a room, by its id (or a room whose id or name matches): its middle
//   { piece: 'booth', variant: 'explore', local: [x, y, z], face: [x, z] }
//                                                 a kind of piece (and its variant), anywhere in the station: a point in
//                                                 the piece's own frame (metres), facing a way in that frame
// with, on any of them:
//   toward: <another spot>   face that way;   out: metres moved from the spot toward it (minus: away)
// Each spot is then moved to the nearest place a person can stand.
export const START = { spawn: true };

// standing people: a recipe of the crew kit (assets/crew/crew.json `recipes`, by name, or a recipe of its own) and a
// clip (the first of a list that the person's body has)
const STAND = ['Stand_Listen', 'Idle'];
export const PEOPLE = [
  // the captains, each standing at a front corner of their crew's booth in the terminal (clear of its screen and
  // sign), turned a little toward whoever walks up
  { id: 'vega', name: 'Captain Vega', recipe: 'vega', at: { piece: 'booth', variant: 'explore', local: [0.72, 0, 0.95], face: [-0.45, 1] }, clip: STAND },
  { id: 'captain-mining', name: 'The mining captain', recipe: 'captainMan', at: { piece: 'booth', variant: 'mining', local: [-0.72, 0, 0.95], face: [0.45, 1] }, clip: STAND },
  { id: 'captain-medic', name: 'The medical captain', recipe: 'captainWoman', at: { piece: 'booth', variant: 'medic', local: [0.72, 0, 0.95], face: [-0.45, 1] }, clip: STAND },
  { id: 'captain-security', name: 'The security captain', recipe: 'captainOld', at: { piece: 'booth', variant: 'security', local: [-0.72, 0, 0.95], face: [0.45, 1] }, clip: STAND },
  // the cook, behind the serving counter, facing whoever comes up to it
  { id: 'cook', name: 'The cook', recipe: 'cook', at: { piece: 'counter', variant: 'serve', local: [0, 0, -0.85], face: [0, 1] }, clip: ['Bar_Polish', ...STAND] },
  // station staff: a guard by the airlock, a dock worker by the shuttle, and in the smelter and the medical centre when
  // the station has them
  { id: 'guard', name: 'Station security', recipe: 'security', at: { place: 'airlock', toward: { place: 'galley' }, out: 6.5 }, clip: STAND },
  { id: 'dock', name: 'A dock worker', recipe: 'dockWorker', at: { place: 'pad', toward: { place: 'shipDoor' }, out: -2.5 }, clip: STAND },
  { id: 'smelter', name: 'The smelter', recipe: 'smelter', at: { room: /smelt/i }, clip: ['Tend_Forge', ...STAND] },
  { id: 'medic', name: 'The medic', recipe: 'medic', at: { room: /medic|medical/i }, clip: STAND },
];

// people who walk: back and forth between two spots, on a way worked out through the station (walls.path), pausing
// at each end (a spot that cannot be reached: as near to it as the way goes, as at the airlock's door)
export const WALKERS = [
  { id: 'walker-1', name: 'A traveller', recipe: { suit: 'civilian', head: 't4', hair: 'shortFull', colours: { job: 'explorer', skin: '#c48a62', hair: '#2e1f15' } }, from: { room: 'c1' }, to: { place: 'airlock' } },
  { id: 'walker-2', name: 'A crew member', recipe: { suit: 'atlantis2', head: 't3', hair: 'ponytail', colours: { job: 'explorer', skin: '#e8bf9f', hair: '#6b4127' } }, from: { place: 'galley' }, to: { place: 'pad', toward: { place: 'shipDoor' }, out: -7 } },
  { id: 'walker-3', name: 'A hauler', recipe: { suit: 'atlantis1', head: 't1', hair: 'spikey', colours: { job: 'hauler', skin: '#86522f', hair: '#17110d' } }, from: { room: 'c2' }, to: { room: 'qc' } },
];
