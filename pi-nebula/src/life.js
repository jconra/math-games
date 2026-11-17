// THE STATION'S LIFE: who lives and works on the station, and what each one does with their day (people.js makes it
// happen). The game's maker (2026-11-15): "Will npcs walking the station give up? It would be nice to have some normal
// activity on the station like people walking around." And (2026-11-16): "30 people at once sounds too high. This is
// meant to be a small station. Just having 4-8 people around seems plenty"; "I don't like the booths. I think all the
// people should be moving about in this area freely and you just find the captain that you want... It would be cool if
// they walk around, sit down, stand by the windows. They could even walk back and forth between their ship and the
// terminal."
//
// NOTHING HERE KNOWS A COORDINATE (as spots.js): every spot is found by the station file's own names, a piece and a
// point in its own frame, a named place, or a room (a point in its box by fractions across it), so when the station is
// rebuilt the spots follow; a spot the station no longer has is left out.
//
// WHO: the roster below. Each picture quality has NEAR[quality] of them about the player at once (the nearest; the
// rest go on with their day out of the way, and come and go only where the player cannot see: people.js PRESENCE).
// A person is a crew kit recipe (dressed for where they work), a voice (sound/voices.js: who says their hellos), and a
// day.
// A DAY is a list of things to do, done in turn and then again (each time with its own lengths, so nobody keeps in step
// with anyone):
//   'post:<spot>'        at work at a post (its clip, its time), as the cook at his counter
//   'stand:<spots>'      to one of a group of spots (one nobody else has), and stand there a while
//   'sit:<seats>'        to a free seat of a group, sit (the crew kit's Sit_Listen), get up again
//   'talk:<spots>'       to a group's talking spot: two people standing face to face, talking (chatter.js)
//   'walk:<spots>'       through every spot of a group in turn without stopping (a patrol)
//   'scan'               a patient's turn in the big scanner: a medic is asked over, they lie on its bed, it scans
// with the time in seconds after it ([least, most]) where the activity's own is not wanted, and p: how likely it is
// done each time round (left out: always).
// A CAPTAIN (captain: { ship, mission }) wears a yellow marker over their head and speaks to the player who comes near:
// who they are, what they want crew for, and are you interested (lines.js CAPTAINS; missions.js takes the answer).
export const NEAR = { low: 4, medium: 6, high: 8 };

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
  // the cook behind the serving counter, facing whoever comes up to it
  cook: [{ piece: 'counter', variant: 'serve', local: [0, 0, -0.85], face: [0, 1] }],
  // the terminal: the jobs board (hung high: looked up at from the floor, from its open east side), the serving
  // counter's front, the drinks
  board: [{ piece: 'jobs', variant: 'hang', local: [2.6, -4.3, 0.9], face: [-0.6, -1] }, { piece: 'jobs', variant: 'hang', local: [3.5, -4.3, 1.8], face: [-0.7, -1] }],
  counter: [{ piece: 'counter', variant: 'serve', local: [0, 0, 0.95], face: [0, -1] }],
  drinks: [{ piece: 'dispenser', variant: 'drinks', local: [0, 0, 0.95], face: [0, -1] }],
  // by the terminal's big windows, looking out over the planters at space (its south side: the far end of its box)
  // (none in the west corner, by the dock screen and its pillar: there a captain seemed to stare at the wall)
  windows: [{ room: 'terminal', at: [0.259, 0.87], face: [0, 1] }, { room: 'terminal', at: [0.645, 0.87], face: [-0.1, 1] }, { room: 'terminal', at: [0.915, 0.87], face: [0.1, 1] }],
  // the terminal's open west side, where the captains' booths stood: by the crew screen, and out on the floor
  terminalFloor: [{ room: 'terminal', at: [0.17, 0.12], face: [0.3, -1] }, { room: 'terminal', at: [0.25, 0.33], face: [1, 0.2] }, { room: 'terminal', at: [0.16, 0.45], face: [1, -0.3] }],
  // reading the terminal's screens, on its walls (standing in the open with nothing to look at reads as someone waiting)
  terminal: [{ piece: 'screen', variant: 'status', room: 'terminal', all: true, local: [0, -1.3, 0.75], face: [0, -1] }, { piece: 'screen', variant: 'radar', room: 'terminal', all: true, local: [0, -1.3, 0.75], face: [0, -1] }, { piece: 'screen', variant: 'terminal', room: 'terminal', all: true, local: [0, -1.3, 0.75], face: [0, -1] }],
  lockers: [{ piece: 'wall', variant: 'locker', room: 'c1', all: true, local: [0, 0, 0.6], face: [0, -1] }, { piece: 'wall', variant: 'locker', room: 'spine-n', all: true, local: [0, 0, 0.6], face: [0, -1] }, { piece: 'wall', variant: 'locker', room: 'spine-s', all: true, local: [0, 0, 0.6], face: [0, -1] }],
  quarters: [{ room: 'qc', at: [0.62, 0.72], face: [-1, 0] }, { room: 'qc', at: [0.3, 0.86], face: [1, 0] }],
  // the hangars: by their crates and carts (never near a parked ship's ways in, nor under the crane: people.js)
  hangar: hangarSpots('hangar'),
  ship: [...shipSpots('hangar'), ...shipSpots('hangar-medic')],
  // each captain's own ship, round it in its hangar
  explorerShip: shipSpots('hangar'),
  minerShip: shipSpots('hangar-miner'),
  medicShip: shipSpots('hangar-medic'),
  minerHangar: hangarSpots('hangar-miner'),
  medicHangar: hangarSpots('hangar-medic'),
  // the mechanics at the parked ships' tails, at their engines
  mechanic: [{ room: 'hangar', at: [0.285, 0.43], face: [1, 0.08] }, { room: 'hangar', at: [0.285, 0.57], face: [1, -0.08] }],
  minerMechanic: [{ room: 'hangar-miner', at: [0.285, 0.43], face: [1, 0.08] }, { room: 'hangar-miner', at: [0.285, 0.57], face: [1, -0.08] }],
  // the smelter: by the forge (the hall's middle), its store, its lobby
  forge: [{ room: 'smelter-hall', at: [0.5, 0.5], face: [0, -1] }],
  forgeConsole: [{ room: 'smelter-hall', at: [0.82, 0.62], face: [1, 0] }],
  store: [{ piece: 'crate', variant: 'stack', room: 'smelter-store', local: [0, 0, 1.2], face: [0, -1] }, { piece: 'crate', variant: 'cart', room: 'smelter-store', local: [0, 0, 1.2], face: [0, -1] }],
  lobby: [{ room: 'smelter-lobby', at: [0.3, 0.35], face: [1, 0] }],
  // the medical centre: by its two triage bays, the lab's bench, the pharmacy, the scanner's booth; its floor
  // (the pharmacy and the scanner's booth by their own pieces, in front of each, facing it: the middle of each small
  // room had no room round it)
  medic: [{ place: 'triageBays', n: 0, face: [-1, 0] }, { place: 'triageBays', n: 1, face: [-1, 0] }, { piece: 'cabinLabBench', room: 'med-lab', local: [-0.55, 0, 0.7], face: [0, -1] }, { piece: 'cabinPharmacy', variant: '2 m', room: 'med-pharmacy', local: [0.3, 0, 0.9], face: [0, -1] }, { piece: 'desk', variant: 'screen', room: 'med-booth', local: [-0.55, 0, 0.9], face: [0, -1] }],
  medicalFloor: [{ room: 'medical', at: [0.7, 0.22], face: [-1, 0.3] }],
  // the big scanner (its own frame: x across, its bed running out along +z from the wall): where its patient stands to
  // get on (by the bed's foot, on its west side, the side away from the cable trough) and where the medic works its
  // screen (on the front of the bed's pedestal, right in front of it, just outside the line painted round it all)
  // (the approach beside the pedestal, past the rail's end, facing the medic at the screen, out of the way of a medic
  // coming in from the doorway on the same side: waiting in front of the pedestal, a patient blocked her)
  // (a second place to fall back on if the station has no room for the first: in front of the pedestal's west corner)
  scanApproach: [{ piece: 'bigscanner', local: [1.35, 0, 4.12], face: [-1, 0.6] }, { piece: 'bigscanner', local: [0.8, 0, 4.4], face: [-1, 0.2] }],
  scanScreen: [{ piece: 'bigscanner', local: [0, 0, 4.42], face: [0, -1] }],
  // a patrol: the terminal, the hangar corridor, the junction, the spine north, the loop, the quarters' corridor, the corridor
  patrol: [{ room: 'terminal', at: [0.6, 0.15] }, { room: 'c2', at: [0.5, 0.5] }, { room: 'junction', at: [0.5, 0.5] }, { room: 'spine-n', at: [0.5, 0.6] }, { room: 'spine-n', at: [0.5, 0.25] }, { room: 'loop', at: [0.5, 0.5] }, { room: 'qc', at: [0.6, 0.5] }, { room: 'c1', at: [0.5, 0.5] }],
  guard: [{ place: 'airlock', toward: { place: 'galley' }, out: 7.6 }],
};

// THE BIG SCANNER'S BED, in the scanner's own frame (kit/bigscanner.js: x across, z out from the wall, its bed's top
// 0.92 m up): the way its patient goes from the spot by its foot along the bed's west side (nearer the bed than its
// rail), where they sit on its edge,
// and where their hips are once lying on it (on their back, their head toward the wall, under the parked ring); the
// pedestal's top edge, over its screen, that the medic works and looks at ([across, up, along]); how many times the
// ring goes there and back
export const SCAN_BED = { path: [[1.35, 4.12], [0.66, 3.3], [0.66, 1.6]], sit: [0.43, 1.45], hips: [0, 1.35], top: 0.92, panel: [0, 0.8, 3.95], rounds: [2, 3] };

// THE TALKING SPOTS: two people face to face (each spot's two places, `apart` metres, along the way it faces)
export const TALKS = {
  // (the first by the west windows, but 2.5 m from the nearest window place: someone standing at a window just behind a
  // pair seemed to listen in; and clear of the ramp up to the tables, east of it)
  terminal: [{ room: 'terminal', at: [0.13, 0.75], face: [1, 0] }, { room: 'terminal', at: [0.66, 0.24], face: [1, 0] }, { room: 'terminal', at: [0.22, 0.52], face: [1, 0] }, { room: 'terminal', at: [0.2, 0.25], face: [0, 1] }],
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

// THE ROSTER (who comes aboard first: everyone, the NEAR nearest the player about at once). look: a crew kit recipe (by
// name, or its own); voice: whose voice says their hellos (sound/voices.js; rate: a little higher or lower, so two people
// sharing a voice are told apart); name: what the others call them (lines.js); day: what they do (above).
const T = (lo, hi) => [lo, hi];
export const ROSTER = [
  // ── the captains, looking for crew (a yellow marker over each): in the terminal most of the time, now and then out at
  // their own ship ──
  { id: 'vega', name: 'Captain Vega', look: 'vega', voice: 'vega', captain: { ship: 'explorer' },
    day: [{ do: 'stand:windows', for: T(30, 60) }, { do: 'sit:window', for: T(40, 80), p: 0.6 }, { do: 'stand:board', for: T(15, 30), p: 0.5 }, { do: 'stand:explorerShip', for: T(40, 80) }, { do: 'stand:terminalFloor', for: T(20, 40) }, { do: 'sit:cafe', for: T(60, 120), p: 0.4 }] },
  { id: 'ruiz', name: 'Captain Ruiz', look: 'captainMan', voice: 'ruiz', captain: { ship: 'miner' },
    day: [{ do: 'stand:terminalFloor', for: T(20, 40) }, { do: 'stand:windows', for: T(30, 50) }, { do: 'sit:cafe', for: T(60, 120), p: 0.5 }, { do: 'stand:minerShip', for: T(40, 80) }, { do: 'stand:lobby', for: T(15, 30), p: 0.4 }, { do: 'stand:counter', for: T(6, 12), p: 0.5 }] },
  { id: 'hale', name: 'Captain Hale', look: 'captainWoman', voice: 'hale', captain: { ship: 'medic' },
    day: [{ do: 'sit:window', for: T(50, 90) }, { do: 'stand:windows', for: T(20, 40) }, { do: 'stand:medicShip', for: T(40, 80) }, { do: 'stand:medicalFloor', for: T(20, 40), p: 0.5 }, { do: 'stand:board', for: T(15, 25), p: 0.5 }, { do: 'sit:cafe', for: T(60, 120), p: 0.4 }] },
  // ── the station's own: at their posts, and their breaks ──
  { id: 'cook', name: 'Bo', look: 'cook', voice: 'om', rate: 1.04, day: [{ do: 'post:cook', clip: 'polish', for: T(50, 90) }, { do: 'post:cook', clip: 'stand', for: T(6, 14) }, { do: 'post:cook', clip: 'polish', for: T(50, 90) }, { do: 'stand:drinks', for: T(6, 12), p: 0.5 }, { do: 'sit:cafe', for: T(120, 200), p: 0.35 }] },
  { id: 'medic', name: 'Ana', look: 'medic', voice: 'yw', rate: 0.94, day: [{ do: 'stand:medic', for: T(20, 45) }, { do: 'stand:medic', for: T(15, 35), clip: 'reach' }, { do: 'stand:medic', for: T(20, 40) }] },
  { id: 'smelter', name: 'Ivo', look: 'smelter', voice: 'ym', rate: 0.93, day: [{ do: 'post:forge', clip: 'forge', for: T(50, 100) }, { do: 'stand:forgeConsole', for: T(12, 25) }, { do: 'post:forge', clip: 'forge', for: T(50, 100) }, { do: 'sit:control', for: T(40, 80), p: 0.5 }, { do: 'stand:store', for: T(10, 20), p: 0.5 }] },
  { id: 'guard', name: 'Tess', look: 'security', voice: 'yw', rate: 1.0, day: [{ do: 'post:guard', for: T(70, 140) }, { do: 'walk:patrol' }, { do: 'stand:counter', for: T(6, 12), p: 0.5 }, { do: 'sit:cafe', for: T(120, 200), p: 0.5 }] },
  // the old captain, retired: tells stories by the windows and at the tables (no marker: not looking for crew)
  { id: 'rook', name: 'old Captain Rook', look: 'captainOld', voice: 'om', rate: 0.96, day: [{ do: 'sit:window', for: T(80, 160) }, { do: 'talk:terminal', for: T(30, 60) }, { do: 'sit:cafe', for: T(100, 200) }, { do: 'stand:windows', for: T(20, 40) }] },
  { id: 'patient', name: 'Tam', look: { suit: 'civilian', head: 't10', hair: 'mohawk', colours: { job: 'explorer', skin: '#e8bf9f', hair: '#4a2f1d' } }, voice: 'ym', rate: 1.06,
    day: [{ do: 'sit:waiting', for: T(20, 40) }, { do: 'scan', for: T(40, 60) }, { do: 'sit:cafe', for: T(120, 200) }, { do: 'stand:windows', for: T(20, 40) }, { do: 'talk:terminal', for: T(25, 40) }] },
  { id: 'traveller', name: 'Lin', look: { suit: 'civilian', head: 't1', hair: 'shortFull', colours: { job: 'explorer', skin: '#c48a62', hair: '#8f8a84' } }, voice: 'om', rate: 1.05,
    day: [{ do: 'stand:board', for: T(12, 25) }, { do: 'sit:window', for: T(40, 90) }, { do: 'stand:counter', for: T(6, 12) }, { do: 'sit:cafe', for: T(120, 240) }, { do: 'talk:terminal', for: T(25, 45) }] },
  { id: 'mechanic', name: 'Jon', look: { suit: 'atlantis1', head: 't8', hair: 'buzz', colours: { job: 'hauler', uniform: '#f0892e', skin: '#a66d45', hair: '#17110d' }, size: 1.07 }, voice: 'om', rate: 1.0,
    day: [{ do: 'post:mechanic', clip: 'hammer', for: T(25, 45) }, { do: 'post:mechanic', clip: 'reach', for: T(15, 30) }, { do: 'stand:ship', for: T(20, 45), clip: 'reach', p: 0.6 }, { do: 'post:mechanic', clip: 'hammer', for: T(25, 45) }, { do: 'stand:hangar', for: T(15, 30), clip: 'reach', p: 0.5 }, { do: 'sit:cafe', for: T(120, 240), p: 0.35 }] },
  { id: 'crew-ada', name: 'Ada', look: { suit: 'atlantis2', head: 't3', hair: 'ponytail', colours: { job: 'explorer', uniform: '#9b6ddb', skin: '#e8bf9f', hair: '#6b4127' } }, voice: 'yw', rate: 1.03,
    day: [{ do: 'stand:ship', for: T(20, 45), clip: 'reach', p: 0.7 }, { do: 'stand:quarters', for: T(10, 25) }, { do: 'stand:counter', for: T(6, 12) }, { do: 'sit:cafe', for: T(140, 280) }, { do: 'talk:terminal', for: T(25, 50) }, { do: 'stand:hangar', for: T(25, 50) }, { do: 'stand:lockers', for: T(8, 16), clip: 'reach' }] },
  { id: 'miner-oso', name: 'Oso', look: { suit: 'smelter', head: 't6', hair: 'curlyShort', colours: { job: 'miner', skin: '#663b22', hair: '#17110d' } }, voice: 'ym', rate: 0.97,
    day: [{ do: 'stand:minerShip', for: T(20, 45), clip: 'reach', p: 0.7 }, { do: 'stand:minerHangar', for: T(30, 60), clip: 'reach' }, { do: 'sit:waiting', for: T(30, 60) }, { do: 'scan', for: T(40, 60), p: 0.3 }, { do: 'talk:lobby', for: T(20, 40) }, { do: 'stand:counter', for: T(6, 12) }, { do: 'sit:cafe', for: T(120, 240) }] },
  { id: 'hauler-pia', name: 'Pia', look: { suit: 'atlantis2', head: 't11', hair: 'braidcrown', colours: { job: 'hauler', uniform: '#f0892e', skin: '#c48a62', hair: '#8f8a84' } }, voice: 'yw', rate: 0.9,
    day: [{ do: 'stand:ship', for: T(20, 45), clip: 'reach', p: 0.7 }, { do: 'stand:hangar', for: T(30, 60), clip: 'reach' }, { do: 'talk:hangar', for: T(20, 40) }, { do: 'stand:lockers', for: T(8, 16), clip: 'reach' }, { do: 'sit:cafe', for: T(120, 240) }] },
  { id: 'diner-uma', name: 'Uma', look: { suit: 'dockWorker', head: 't7', hair: 'afro', colours: { job: 'staff', skin: '#47291a', hair: '#17110d' } }, voice: 'yw', rate: 1.06,
    day: [{ do: 'sit:cafe', for: T(180, 320) }, { do: 'stand:drinks', for: T(6, 12) }, { do: 'sit:window', for: T(40, 90) }, { do: 'talk:terminal', for: T(25, 50) }] },
];
