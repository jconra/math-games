// THE STATION'S LIFE: who lives and works on the station, and what each one does with their day (people.js makes it
// happen). The game's maker (2026-11-15): "Will npcs walking the station give up? It would be nice to have some normal
// activity on the station like people walking around."
//
// NOTHING HERE KNOWS A COORDINATE (as spots.js): every spot is found by the station file's own names, a piece and a
// point in its own frame, a named place, or a room (a point in its box by fractions across it), so when the station is
// rebuilt the spots follow; a spot the station no longer has is left out.
//
// WHO: the roster below, in the order they come aboard; each picture quality shows the first CROWD[quality] of them.
// A person is a crew kit recipe (dressed for where they work: cooks in the galley, medics in medical, miners by the
// Miner hangar; heads, hair and colours spread so that no two in one place look alike) and a day.
// A DAY is a list of things to do, done in turn and then again (each time with its own lengths, so nobody keeps in step
// with anyone):
//   'post:<spot>'        at work at a post (its clip, its time), as the cook at his counter
//   'stand:<spots>'      to one of a group of spots (one nobody else has), and stand there a while
//   'sit:<seats>'        to a free seat of a group, sit (the crew kit's Sit_Listen), get up again
//   'talk:<spots>'       to a group's talking spot: two people standing face to face (one waits a while for another)
//   'walk:<spots>'       through every spot of a group in turn without stopping (a patrol)
// with the time in seconds after it ([least, most]) where the activity's own is not wanted.
export const CROWD = { low: 12, medium: 20, high: 30 };

// (a hangar's spots: in front of each of its crates and carts and lockers, all along its walls; a crate stacked on
// another, or one under the crane's loads or by a ship's way in, is left out by people.js)
const hangarSpots = (room) => [
  ...['stack', 'large', 'long', 'small'].map((variant) => ({ piece: 'crate', variant, room, all: true, local: [0, 0, -1.25], face: [0, 1] })),
  { piece: 'crate', variant: 'cart', room, all: true, local: [1.2, 0, 0], face: [-1, 0] },
  { piece: 'wall', variant: 'locker', room, all: true, local: [0, 0, 0.6], face: [0, -1] },
];

// (round a parked ship, by fractions of its hangar's box: by its tail, its nose, its sides; a spot on a way in's patch
// or under the crane is left out by people.js)
const shipSpots = (room) => [
  { room, at: [0.27, 0.41], face: [1, 0.15] }, { room, at: [0.27, 0.59], face: [1, -0.15] }, { room, at: [0.52, 0.86], face: [0, -1] },
  { room, at: [0.47, 0.84], face: [0.2, -1] }, { room, at: [0.77, 0.5], face: [-1, 0] }, { room, at: [0.41, 0.17], face: [0.3, 1] },
];

// THE SPOTS, by group: each a list of spot definitions (people.js spotsOf): { piece, variant, room, local, face, all }
// (all: every such piece), { room, at: [across x, across z] (0..1 of its box), face: [x, z] (a way to face) },
// { place, toward, out }. face [x, z] is in the piece's own frame (or the world's, for a room).
export const SPOTS = {
  // the captains, each at a front corner of their crew's booth, turned a little toward whoever walks up (as spots.js had
  // them); and where someone stands to talk to one of them, facing them
  captains: [
    { piece: 'booth', variant: 'explore', local: [0.72, 0, 0.95], face: [-0.45, 1] }, { piece: 'booth', variant: 'mining', local: [-0.72, 0, 0.95], face: [0.45, 1] },
    { piece: 'booth', variant: 'medic', local: [0.72, 0, 0.95], face: [-0.45, 1] }, { piece: 'booth', variant: 'security', local: [-0.72, 0, 0.95], face: [0.45, 1] },
  ],
  booth: [
    { piece: 'booth', variant: 'explore', local: [0.55, 0, 2.2], face: [0.1, -1] }, { piece: 'booth', variant: 'mining', local: [-0.55, 0, 2.2], face: [-0.1, -1] },
    { piece: 'booth', variant: 'medic', local: [0.55, 0, 2.2], face: [0.1, -1] }, { piece: 'booth', variant: 'security', local: [-0.55, 0, 2.2], face: [-0.1, -1] },
  ],
  // the cook behind the serving counter, facing whoever comes up to it
  cook: [{ piece: 'counter', variant: 'serve', local: [0, 0, -0.85], face: [0, 1] }],
  // the terminal: the jobs board (hung high: looked up at from the floor), the serving counter's front, the drinks
  // (the jobs board hangs high over the floor: read from its open east side, never square under it, where someone
  // would seem to stare at whoever comes in from the corridor, nor by the booths, where people queue for the captains)
  board: [{ piece: 'jobs', variant: 'hang', local: [2.6, -4.3, 0.9], face: [-0.6, -1] }, { piece: 'jobs', variant: 'hang', local: [3.5, -4.3, 1.8], face: [-0.7, -1] }],
  counter: [{ piece: 'counter', variant: 'serve', local: [0, 0, 0.95], face: [0, -1] }],
  drinks: [{ piece: 'dispenser', variant: 'drinks', local: [0, 0, 0.95], face: [0, -1] }],
  // standing about in the terminal, the corridors, the spine
  // reading the terminal's screens, on its walls (standing in the open with nothing to look at reads as someone waiting)
  terminal: [{ piece: 'screen', variant: 'status', room: 'terminal', all: true, local: [0, -1.3, 0.75], face: [0, -1] }, { piece: 'screen', variant: 'radar', room: 'terminal', all: true, local: [0, -1.3, 0.75], face: [0, -1] }, { piece: 'screen', variant: 'terminal', room: 'terminal', all: true, local: [0, -1.3, 0.75], face: [0, -1] }],
  lockers: [{ piece: 'wall', variant: 'locker', room: 'c1', all: true, local: [0, 0, 0.6], face: [0, -1] }, { piece: 'wall', variant: 'locker', room: 'spine-n', all: true, local: [0, 0, 0.6], face: [0, -1] }, { piece: 'wall', variant: 'locker', room: 'spine-s', all: true, local: [0, 0, 0.6], face: [0, -1] }],
  quarters: [{ room: 'qc', at: [0.62, 0.72], face: [-1, 0] }, { room: 'qc', at: [0.3, 0.86], face: [1, 0] }],
  // the hangars: by their crates and carts (never near a parked ship's ways in, nor under the crane: people.js)
  hangar: hangarSpots('hangar'),
  ship: [...shipSpots('hangar'), ...shipSpots('hangar-medic')],
  minerShip: shipSpots('hangar-miner'),
  minerHangar: hangarSpots('hangar-miner'),
  medicHangar: hangarSpots('hangar-medic'),
  // work: the mechanic at the Explorer hangar's long crate, the dock worker by the far crates
  // the mechanics at the parked ships' tails, at their engines
  mechanic: [{ room: 'hangar', at: [0.285, 0.43], face: [1, 0.08] }, { room: 'hangar', at: [0.285, 0.57], face: [1, -0.08] }],
  minerMechanic: [{ room: 'hangar-miner', at: [0.285, 0.43], face: [1, 0.08] }, { room: 'hangar-miner', at: [0.285, 0.57], face: [1, -0.08] }],
  dock: [{ piece: 'crate', variant: 'small', room: 'hangar', all: true, local: [0, 0, -1.1], face: [0, 1] }],
  // the smelter: by the forge (the hall's middle), its store, its lobby
  forge: [{ room: 'smelter-hall', at: [0.5, 0.5], face: [0, -1] }],
  forgeConsole: [{ room: 'smelter-hall', at: [0.82, 0.62], face: [1, 0] }],
  store: [{ piece: 'crate', variant: 'stack', room: 'smelter-store', local: [0, 0, 1.2], face: [0, -1] }, { piece: 'crate', variant: 'cart', room: 'smelter-store', local: [0, 0, 1.2], face: [0, -1] }],
  // the medical centre: by its two triage bays, the lab's bench, the pharmacy, the scanner's booth
  medic: [{ place: 'triageBays', n: 0, face: [-1, 0] }, { place: 'triageBays', n: 1, face: [-1, 0] }, { piece: 'cabinLabBench', room: 'med-lab', local: [-0.55, 0, 0.7], face: [0, -1] }, { room: 'med-pharmacy', at: [0.5, 0.5], face: [1, 0] }, { room: 'med-booth', at: [0.4, 0.5], face: [1, 0] }],
  // a patrol: the terminal, the hangar corridor, the junction, the spine north, the loop, the quarters' corridor, the corridor
  patrol: [{ room: 'terminal', at: [0.6, 0.15] }, { room: 'c2', at: [0.5, 0.5] }, { room: 'junction', at: [0.5, 0.5] }, { room: 'spine-n', at: [0.5, 0.6] }, { room: 'spine-n', at: [0.5, 0.25] }, { room: 'loop', at: [0.5, 0.5] }, { room: 'qc', at: [0.6, 0.5] }, { room: 'c1', at: [0.5, 0.5] }],
  guard: [{ place: 'airlock', toward: { place: 'galley' }, out: 7.6 }],
};

// THE TALKING SPOTS: two people face to face (each spot's two places, `apart` metres, along the way it faces)
export const TALKS = {
  terminal: [{ room: 'terminal', at: [0.18, 0.83], face: [1, 0] }, { room: 'terminal', at: [0.66, 0.24], face: [1, 0] }, { room: 'terminal', at: [0.22, 0.6], face: [1, 0] }],
  spine: [{ room: 'spine-n', at: [0.3, 0.45], face: [0, 1] }, { room: 'spine-s', at: [0.3, 0.5], face: [0, 1] }],
  hangar: [{ piece: 'crate', variant: 'stack', room: 'hangar', local: [2.5, 0, -3.5], face: [1, 0] }, { piece: 'crate', variant: 'stack', room: 'hangar-miner', local: [2.5, 0, -3.5], face: [1, 0] }, { piece: 'crate', variant: 'stack', room: 'hangar-medic', local: [2.5, 0, -3.5], face: [1, 0] }],
  lobby: [{ room: 'smelter-lobby', at: [0.55, 0.5], face: [0, 1] }],
  medical: [{ room: 'medical', at: [0.6, 0.3], face: [1, 0] }],
};
export const APART = 1.15;

// THE SEATS, by group: every such piece in the room; a stool faces the table nearest it, a bench seats two facing its
// own front (the terminal's: out of the windows)
export const SEATS = {
  cafe: [{ room: 'terminal', piece: 'chair', variant: 'stool', face: 'table' }],
  window: [{ room: 'terminal', piece: 'chair', variant: 'bench', two: true }],
  waiting: [{ room: 'medical', piece: 'chair', variant: 'bench', two: true }, { room: 'smelter-lobby', piece: 'chair', variant: 'bench', two: true }],
  control: [{ room: 'smelter-control', piece: 'chair', variant: 'stool', face: 'table' }],
};

// THE CLIPS: standing (the calm one: the crew kit's CALM is made from Stand_Listen), sitting, at work, now and then
export const CLIPS = { stand: 'Stand_Listen', sit: 'Sit_Listen', walk: 'Walk', reach: 'Interact', polish: 'Bar_Polish', forge: 'Tend_Forge', hammer: 'Hammer' };

// THE ROSTER, in the order they come aboard (the first CROWD.low on every quality). look: a crew kit recipe (by name, or
// its own); day: what they do (above). The captains, the cook, the guard, the smelter and the medic were spots.js's
// standing people: the captains, the cook and the guard where they stood; the smelter at the forge; the medic (who
// stood in the way into the Medic hangar, the first room whose name has "medic" in it) on the medical centre's floor.
const T = (lo, hi) => [lo, hi];
export const ROSTER = [
  { id: 'vega', name: 'Captain Vega', look: 'vega', day: ['post:captains.0'] },
  { id: 'captain-mining', name: 'The mining captain', look: 'captainMan', day: ['post:captains.1'] },
  { id: 'captain-medic', name: 'The medical captain', look: 'captainWoman', day: ['post:captains.2'] },
  { id: 'captain-security', name: 'The security captain', look: 'captainOld', day: ['post:captains.3'] },
  { id: 'cook', name: 'The cook', look: 'cook', day: [{ do: 'post:cook', clip: 'polish', for: T(50, 90) }, { do: 'post:cook', clip: 'stand', for: T(6, 14) }, { do: 'post:cook', clip: 'polish', for: T(50, 90) }, { do: 'stand:drinks', for: T(6, 12), p: 0.5 }, { do: 'sit:cafe', for: T(120, 200), p: 0.35 }] },
  { id: 'guard', name: 'Station security', look: 'security', day: [{ do: 'post:guard', for: T(70, 140) }, { do: 'walk:patrol' }, { do: 'stand:counter', for: T(6, 12), p: 0.5 }, { do: 'sit:cafe', for: T(120, 200), p: 0.5 }] },
  { id: 'smelter', name: 'The smelter', look: 'smelter', day: [{ do: 'post:forge', clip: 'forge', for: T(50, 100) }, { do: 'stand:forgeConsole', for: T(12, 25) }, { do: 'post:forge', clip: 'forge', for: T(50, 100) }, { do: 'sit:control', for: T(40, 80), p: 0.5 }, { do: 'stand:store', for: T(10, 20), p: 0.5 }] },
  { id: 'medic', name: 'The medic', look: 'medic', day: [{ do: 'stand:medic', for: T(20, 45) }, { do: 'stand:medic', for: T(15, 35), clip: 'reach' }, { do: 'stand:medic', for: T(20, 40) }] },
  { id: 'mechanic', name: 'A mechanic', look: { suit: 'atlantis1', head: 't8', hair: 'buzz', colours: { job: 'hauler', uniform: '#f0892e', skin: '#a66d45', hair: '#17110d' }, size: 1.07 },
    day: [{ do: 'post:mechanic', clip: 'hammer', for: T(25, 45) }, { do: 'post:mechanic', clip: 'reach', for: T(15, 30) }, { do: 'stand:ship', for: T(20, 45), clip: 'reach', p: 0.6 }, { do: 'post:mechanic', clip: 'hammer', for: T(25, 45) }, { do: 'stand:hangar', for: T(15, 30), clip: 'reach', p: 0.5 }, { do: 'sit:cafe', for: T(120, 240), p: 0.35 }] },
  { id: 'traveller', name: 'A traveller', look: { suit: 'civilian', head: 't1', hair: 'shortFull', colours: { job: 'explorer', skin: '#c48a62', hair: '#8f8a84' } },
    day: [{ do: 'stand:board', for: T(12, 25) }, { do: 'sit:window', for: T(40, 90) }, { do: 'stand:counter', for: T(6, 12) }, { do: 'sit:cafe', for: T(120, 240) }, { do: 'stand:booth', for: T(15, 30) }] },
  { id: 'crew-ada', name: 'A crew member', look: { suit: 'atlantis2', head: 't3', hair: 'ponytail', colours: { job: 'explorer', uniform: '#9b6ddb', skin: '#e8bf9f', hair: '#6b4127' } },
    day: [{ do: 'stand:ship', for: T(20, 45), clip: 'reach', p: 0.7 }, { do: 'stand:quarters', for: T(10, 25) }, { do: 'stand:counter', for: T(6, 12) }, { do: 'sit:cafe', for: T(140, 280) }, { do: 'talk:terminal', for: T(25, 50) }, { do: 'stand:hangar', for: T(25, 50) }, { do: 'stand:lockers', for: T(8, 16), clip: 'reach' }] },
  { id: 'hauler', name: 'A hauler', look: { suit: 'atlantis1', head: 't4', hair: 'spikey', colours: { job: 'hauler', uniform: '#3f8fe8', skin: '#86522f', hair: '#17110d' } },
    day: [{ do: 'stand:ship', for: T(20, 45), clip: 'reach', p: 0.7 }, { do: 'stand:hangar', for: T(30, 60), clip: 'reach' }, { do: 'talk:spine', for: T(20, 40) }, { do: 'stand:counter', for: T(6, 12) }, { do: 'sit:cafe', for: T(120, 240) }, { do: 'stand:lockers', for: T(8, 16), clip: 'reach' }] },
  // ── Medium adds these: people of the hangars, the medical centre and the smelter (the terminal's crowd stays as
  // Low's, as today's: it is where the most are seen at once) ──
  { id: 'dockhand', name: 'A dock worker', look: 'dockWorker', day: [{ do: 'stand:ship', clip: 'reach', for: T(30, 60) }, { do: 'post:dock', clip: 'reach', for: T(30, 60) }, { do: 'stand:ship', for: T(20, 40) }, { do: 'talk:hangar', for: T(20, 40), p: 0.5 }, { do: 'sit:cafe', for: T(120, 240), p: 0.6 }] },
  { id: 'smelter-ivo', name: 'A smelter hand', look: { suit: 'smelter', head: 't2', hair: 'q_short', colours: { job: 'miner', skin: '#c48a62', hair: '#4a2f1d' } },
    day: [{ do: 'sit:control', for: T(40, 90) }, { do: 'post:forge', clip: 'forge', for: T(50, 100) }, { do: 'stand:store', for: T(15, 30), clip: 'reach' }, { do: 'talk:lobby', for: T(20, 40) }, { do: 'stand:minerHangar', for: T(20, 40) }, { do: 'sit:cafe', for: T(120, 240), p: 0.5 }] },
  { id: 'medic-ren', name: 'A medic', look: { suit: 'atlantis2', head: 't3', hair: 'wavy', colours: { job: 'medic', uniform: '#2ec4b6', skin: '#f2d3bd', hair: '#a83c22' } },
    day: [{ do: 'stand:medic', for: T(25, 50), clip: 'reach' }, { do: 'talk:medical', for: T(20, 40) }, { do: 'stand:medicHangar', for: T(20, 40) }, { do: 'sit:cafe', for: T(120, 240) }, { do: 'stand:counter', for: T(6, 12) }] },
  { id: 'mechanic-ade', name: 'A mechanic', look: { suit: 'atlantis1', head: 't4', hair: 'shortFull', colours: { job: 'miner', uniform: '#3b4a5c', skin: '#86522f', hair: '#2e1f15' } },
    day: [{ do: 'post:minerMechanic', clip: 'hammer', for: T(25, 45) }, { do: 'post:minerMechanic', clip: 'reach', for: T(15, 30) }, { do: 'stand:minerShip', for: T(20, 45), clip: 'reach', p: 0.6 }, { do: 'post:minerMechanic', clip: 'hammer', for: T(25, 45) }, { do: 'stand:minerHangar', for: T(15, 30), clip: 'reach' }, { do: 'talk:lobby', for: T(20, 40), p: 0.4 }] },
  { id: 'medic-ana', name: 'A medic', look: { suit: 'atlantis2', head: 't5', hair: 'q_long', colours: { job: 'medic', uniform: '#3f8fe8', skin: '#86522f', hair: '#17110d' } },
    day: [{ do: 'stand:medic', for: T(25, 50) }, { do: 'sit:waiting', for: T(20, 40) }, { do: 'stand:medic', for: T(20, 40), clip: 'reach' }, { do: 'talk:medical', for: T(20, 40) }] },
  { id: 'miner-jon', name: 'A miner', look: { suit: 'spaceMan', head: 't1', hair: 'crop', colours: { job: 'miner', skin: '#e8bf9f', hair: '#b4824f' } },
    day: [{ do: 'stand:minerShip', for: T(20, 45), clip: 'reach', p: 0.7 }, { do: 'stand:store', for: T(15, 30), clip: 'reach' }, { do: 'sit:control', for: T(40, 80) }, { do: 'stand:minerHangar', for: T(25, 50) }, { do: 'sit:waiting', for: T(25, 50) }] },
  { id: 'miner-oso', name: 'A miner', look: { suit: 'smelter', head: 't6', hair: 'curlyShort', colours: { job: 'miner', skin: '#663b22', hair: '#17110d' } },
    day: [{ do: 'stand:minerShip', for: T(20, 45), clip: 'reach', p: 0.7 }, { do: 'stand:minerHangar', for: T(30, 60), clip: 'reach' }, { do: 'sit:waiting', for: T(30, 60) }, { do: 'talk:lobby', for: T(20, 40) }, { do: 'stand:counter', for: T(6, 12) }, { do: 'sit:cafe', for: T(120, 240) }] },
  { id: 'patrol', name: 'Station security', look: { suit: 'security', head: 't9', hair: 'q_bob', colours: { job: 'staff', skin: '#d9a37f', hair: '#d6d3cc' } },
    day: [{ do: 'walk:patrol' }, { do: 'post:guard', for: T(70, 140) }, { do: 'stand:terminal', for: T(20, 40) }, { do: 'talk:spine', for: T(15, 30) }] },
  // ── High adds these: the terminal's own crowd, and more in the hangars ──
  { id: 'diner-kai', name: 'A crew member', look: { suit: 'crew1', head: 't2', hair: 'sidepart', colours: { job: 'staff', skin: '#e8bf9f', hair: '#4a2f1d' } },
    day: [{ do: 'sit:cafe', for: T(180, 320) }, { do: 'stand:drinks', for: T(6, 12) }, { do: 'sit:window', for: T(40, 90) }, { do: 'talk:terminal', for: T(25, 50) }] },
  { id: 'pilot-sol', name: 'A pilot', look: { suit: 'atlantis2', head: 't9', hair: 'whiteStripeLeftLong', colours: { job: 'explorer', uniform: '#2ec4b6', skin: '#a66d45', hair: '#2e1f15' } },
    day: [{ do: 'stand:ship', for: T(20, 45), clip: 'reach', p: 0.7 }, { do: 'stand:board', for: T(15, 30) }, { do: 'talk:terminal', for: T(25, 50) }, { do: 'stand:hangar', for: T(30, 60) }, { do: 'sit:window', for: T(40, 80) }] },
  { id: 'crew-lin', name: 'A crew member', look: { suit: 'atlantis2', head: 't5', hair: 'mediumFull', colours: { job: 'explorer', uniform: '#e9ecef', skin: '#d9a37f', hair: '#d8bc84' } },
    day: [{ do: 'stand:quarters', for: T(15, 30) }, { do: 'stand:lockers', for: T(8, 16), clip: 'reach' }, { do: 'sit:window', for: T(40, 80) }, { do: 'stand:drinks', for: T(6, 12) }, { do: 'talk:terminal', for: T(25, 45) }] },
  { id: 'miner-bex', name: 'A miner', look: { suit: 'atlantis1', head: 't10', hair: 'afro', colours: { job: 'miner', uniform: '#e3b341', skin: '#47291a', hair: '#17110d' } },
    day: [{ do: 'stand:minerShip', for: T(20, 45), clip: 'reach', p: 0.7 }, { do: 'stand:minerHangar', for: T(30, 60) }, { do: 'talk:hangar', for: T(20, 40) }, { do: 'sit:waiting', for: T(30, 60) }, { do: 'sit:cafe', for: T(120, 240) }] },
  { id: 'galley-hand', name: 'A galley hand', look: { suit: 'cook', head: 't10', hair: 'mohawk', colours: { job: 'staff', skin: '#f2d3bd', hair: '#a83c22' } },
    day: [{ do: 'post:cook', clip: 'polish', for: T(60, 120) }, { do: 'stand:drinks', for: T(6, 12) }, { do: 'sit:cafe', for: T(120, 200), p: 0.5 }, { do: 'post:cook', clip: 'stand', for: T(20, 40) }, { do: 'stand:lockers', for: T(8, 16), clip: 'reach', p: 0.5 }] },
  { id: 'visitor-ola', name: 'A visitor', look: { suit: 'civilian', head: 't6', hair: 'coil', colours: { job: 'explorer', skin: '#663b22', hair: '#2e1f15' }, size: 0.9 },
    day: [{ do: 'sit:window', for: T(50, 110) }, { do: 'stand:board', for: T(12, 25) }, { do: 'stand:booth', for: T(15, 30) }, { do: 'sit:cafe', for: T(120, 240) }] },
  { id: 'hauler-pia', name: 'A hauler', look: { suit: 'atlantis2', head: 't11', hair: 'braidcrown', colours: { job: 'hauler', uniform: '#f0892e', skin: '#c48a62', hair: '#8f8a84' } },
    day: [{ do: 'stand:ship', for: T(20, 45), clip: 'reach', p: 0.7 }, { do: 'stand:hangar', for: T(30, 60), clip: 'reach' }, { do: 'talk:hangar', for: T(20, 40) }, { do: 'stand:lockers', for: T(8, 16), clip: 'reach' }, { do: 'sit:cafe', for: T(120, 240) }] },
  { id: 'crew-uma', name: 'A crew member', look: { suit: 'dockWorker', head: 't11', hair: 'afro', colours: { job: 'staff', skin: '#47291a', hair: '#17110d' } },
    day: [{ do: 'stand:quarters', for: T(15, 30) }, { do: 'talk:terminal', for: T(25, 45) }, { do: 'sit:cafe', for: T(120, 240) }, { do: 'stand:drinks', for: T(6, 12) }] },
  { id: 'medic-eli', name: 'A medic', look: { suit: 'atlantis1', head: 't6', hair: 'shortHairToRight', colours: { job: 'medic', uniform: '#2ec4b6', skin: '#a66d45', hair: '#2e1f15' } },
    day: [{ do: 'stand:ship', for: T(20, 45), clip: 'reach', p: 0.7 }, { do: 'stand:medicHangar', for: T(25, 50) }, { do: 'stand:medic', for: T(25, 50) }, { do: 'talk:medical', for: T(20, 40) }, { do: 'sit:cafe', for: T(120, 240), p: 0.5 }] },
  { id: 'pilot-rae', name: 'A pilot', look: { suit: 'spaceMan', head: 't10', hair: 'shortHairToSide', colours: { job: 'explorer', skin: '#d9a37f', hair: '#6b4127' } },
    day: [{ do: 'stand:ship', for: T(20, 45), clip: 'reach', p: 0.7 }, { do: 'stand:hangar', for: T(30, 60) }, { do: 'talk:hangar', for: T(20, 40) }, { do: 'stand:minerShip', for: T(20, 40) }, { do: 'sit:waiting', for: T(30, 60) }] },
];
