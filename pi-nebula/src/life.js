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
  // (the pharmacy's and the scanner's booth's places: the station finds no room round either, by the room or by their
  // own pieces, so the medic keeps to the bays, the lab and the floor: a question for the notes)
  medic: [{ place: 'triageBays', n: 0, face: [-1, 0] }, { place: 'triageBays', n: 1, face: [-1, 0] }, { piece: 'cabinLabBench', room: 'med-lab', local: [-0.55, 0, 0.7], face: [0, -1] }, { room: 'med-pharmacy', at: [0.5, 0.5], face: [1, 0] }, { room: 'med-booth', at: [0.4, 0.5], face: [1, 0] }],
  medicalFloor: [{ room: 'medical', at: [0.7, 0.22], face: [-1, 0.3] }],
  // the big scanner (its own frame: x across, its bed running out along +z from the wall): where its patient stands to
  // get on (by the bed's foot, on its west side, the side away from the cable trough) and where the medic works its
  // screen (on the front of the bed's pedestal, right in front of it, just outside the line painted round it all)
  // (in front of the pedestal's west corner, turned toward the medic; the patient sets off for it once the medic is at
  // the screen (people.js): both come in by the doorway on that side, and a patient waiting there first stood in her
  // way; nearer the bed the ring's patch is kept off)
  // (1.3 m from the medic, at an easy distance to talk; in front of the pedestal's corner the one to fall back on)
  scanApproach: [{ piece: 'bigscanner', local: [1.25, 0, 4.55], face: [-1, 0.1] }, { piece: 'bigscanner', local: [0.8, 0, 4.4], face: [-1, 0.2] }],
  scanScreen: [{ piece: 'bigscanner', local: [0, 0, 4.42], face: [0, -1] }],
  // a patrol: the terminal, the hangar corridor, the junction, the spine north, the loop, the quarters' corridor, the corridor
  patrol: [{ room: 'terminal', at: [0.6, 0.15] }, { room: 'c2', at: [0.5, 0.5] }, { room: 'junction', at: [0.5, 0.5] }, { room: 'spine-n', at: [0.5, 0.6] }, { room: 'spine-n', at: [0.5, 0.25] }, { room: 'loop', at: [0.5, 0.5] }, { room: 'qc', at: [0.6, 0.5] }, { room: 'c1', at: [0.5, 0.5] }],
  guard: [{ place: 'airlock', toward: { place: 'galley' }, out: 7.6 }],
  // ── THE CONTROL ROOM at the top of the tower (ROOM_CREW below; kit/places-plan.js TOWER, DESKS): in the room's own
  // frame (the controlRoom piece's: its middle, on its floor; north is -z), or a desk's (a console's: its front, where
  // people sit, toward +z) ──
  // standing at the station readouts desk and at the announcements desk, clear of their chairs, reading them
  readoutsStand: [{ piece: 'console', variant: 'readouts', room: 'tower', local: [-2.6, 0, 0.95], face: [0, -1] }, { piece: 'console', variant: 'readouts', room: 'tower', local: [2.6, 0, 0.95], face: [0, -1] }],
  announceStand: [{ piece: 'console', variant: 'announce', room: 'tower', local: [-2.6, 0, 0.95], face: [0, -1] }, { piece: 'console', variant: 'announce', room: 'tower', local: [2.6, 0, 0.95], face: [0, -1] }],
  // behind the radio desk's two chairs, looking over at its screens (none behind traffic control's: the lift's doors
  // open toward it, and someone there stood in the way out)
  radioBehind: [{ piece: 'console', variant: 'radio', room: 'tower', local: [0, 0, 1.75], face: [0, -1] }],
  // at the four corner windows, where no desk stands, looking out and down at the landing pads
  towerWindows: [[1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, z]) => ({ piece: 'controlRoom', room: 'tower', local: [5.28 * x, 0, 5.28 * z], face: [x, z] })),
  // a walk round the room, about the lift
  towerRound: [[1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, z]) => ({ piece: 'controlRoom', room: 'tower', local: [3.4 * x, 0, 3.4 * z] })),
  // ── CARGO, the lower level (in the code: the store; the storeHall piece's frame is the station's own, on its floor) ──
  // the shipping desk's printer, at the desk's end; the packing benches, both sides; by the pallets waiting on the
  // loading floor; at the three containers' ends; on the scale by its readout; in the aisles at the racks; at the two
  // cold store doors
  printer: [{ piece: 'shipDesk', room: 'store', local: [1.3, 0, 0.85], face: [0, -1] }],
  benches: [-0.9, 0.9].flatMap((x) => [{ piece: 'bench', variant: 'packing', room: 'store', all: true, local: [x, 0, -0.8], face: [0, 1] }, { piece: 'bench', variant: 'packing', room: 'store', all: true, local: [x, 0, 0.8], face: [0, -1] }]),
  pallets: [{ piece: 'storeHall', room: 'store', local: [-0.2, 0, 16.65], face: [0, -1] }, { piece: 'storeHall', room: 'store', local: [3.2, 0, 16.65], face: [0, -1] }, { piece: 'storeHall', room: 'store', local: [1.5, 0, 18.45], face: [0, 1] }],
  containers: [3.5, 8, 12.5].map((z) => ({ piece: 'storeHall', room: 'store', local: [-2.3, 0, z], face: [-1, 0] })),
  scale: [{ piece: 'scale', room: 'store', local: [-0.95, 0, -0.95], face: [-1, -1] }],
  racks: [{ piece: 'rack', room: 'store', all: true, local: [1.36, 0, 1.25], face: [0, -1] }, { piece: 'rack', room: 'store', all: true, local: [4.08, 0, -1.25], face: [0, 1] }],
  cold: [2, 12].map((z) => ({ piece: 'storeHall', room: 'store', local: [23.4, 0, z], face: [1, 0] })),
  // a walk: up the lane by the east wall, into an aisle, along to another
  cargoRound: [[21.8, 24], [21.8, -4], [13, 1.95], [13, 16.95]].map(([x, z]) => ({ piece: 'storeHall', room: 'store', local: [x, 0, z] })),
};

// THE BIG SCANNER'S BED, in the scanner's own frame (kit/bigscanner.js: x across, z out from the wall; its pad's top
// 0.915 m up, its board's edge 0.3 m out from its middle, the pad 0.26; the head rest from z 1.12 to 1.44): the way
// its patient goes from the spot by its foot along the bed's west side (nearer the bed than its rail), where they stand
// with their back to its side to get on ([across, along]), and how far along it their hips are, sitting on its edge and
// then lying on it (on their back, their head on the head rest, just in front of the parked ring: src/onbed.js gets
// them on and off, as a person does); the hip joints over the pad, sitting; the pedestal's top edge, over its screen,
// that the medic works and looks at ([across, up, along]); how many times the ring goes there and back
export const SCAN_BED = { path: [[1.25, 4.55], [0.66, 3.3], [0.6, 2.4], [0.5, 2.05]], stand: [0.5, 2.05], z: 2.05, top: 0.915, edge: 0.3, pad: 0.26, rest: [1.12, 1.44], hipUp: 0.095, panel: [0, 0.8, 3.95], rounds: [2, 3] };

// THE TALKING SPOTS: two people face to face (each spot's two places, `apart` metres, along the way it faces)
export const TALKS = {
  // (the first by the west windows, but 2.5 m from the nearest window place: someone standing at a window just behind a
  // pair seemed to listen in; and clear of the ramp up to the tables, east of it)
  terminal: [{ room: 'terminal', at: [0.13, 0.75], face: [1, 0] }, { room: 'terminal', at: [0.66, 0.24], face: [1, 0] }, { room: 'terminal', at: [0.22, 0.52], face: [1, 0] }, { room: 'terminal', at: [0.2, 0.25], face: [0, 1] }],
  spine: [{ room: 'spine-n', at: [0.3, 0.45], face: [0, 1] }, { room: 'spine-s', at: [0.3, 0.5], face: [0, 1] }],
  hangar: [{ piece: 'crate', variant: 'stack', room: 'hangar', local: [2.5, 0, -3.5], face: [1, 0] }, { piece: 'crate', variant: 'stack', room: 'hangar-miner', local: [2.5, 0, -3.5], face: [1, 0] }, { piece: 'crate', variant: 'stack', room: 'hangar-medic', local: [2.5, 0, -3.5], face: [1, 0] }],
  lobby: [{ room: 'smelter-lobby', at: [0.55, 0.5], face: [0, 1] }],
  medical: [{ room: 'medical', at: [0.6, 0.3], face: [1, 0] }],
  // (the control room: between the lift and the readouts desk, and by its north-west corner window; Cargo: on the
  // loading floor, and between the last row of racks and the benches)
  tower: [{ piece: 'controlRoom', room: 'tower', local: [0, 0, 3.0], face: [1, 0] }, { piece: 'controlRoom', room: 'tower', local: [-5.2, 0, -5.2], face: [1, -1] }],
  cargo: [{ piece: 'storeHall', room: 'store', local: [1.5, 0, 10.25], face: [1, 0] }, { piece: 'storeHall', room: 'store', local: [7.5, 0, 23.2], face: [1, 0] }],
};
export const APART = 1.15;

// THE SEATS, by group: every such piece in the room; a stool faces the table nearest it, a bench seats two facing its
// own front (the terminal's: out of the windows); a desk chair (face 'own') faces its own front, the desk it is set at
// (`near`: the chairs within 2 m of that piece), and is sat on from beside it (its back is in the way behind it)
export const SEATS = {
  cafe: [{ room: 'terminal', piece: 'chair', variant: 'stool', face: 'table' }],
  window: [{ room: 'terminal', piece: 'chair', variant: 'bench', two: true }],
  waiting: [{ room: 'medical', piece: 'chair', variant: 'bench', two: true }, { room: 'smelter-lobby', piece: 'chair', variant: 'bench', two: true }],
  control: [{ room: 'smelter-control', piece: 'chair', variant: 'stool', face: 'table' }],
  // (the control room's four desks, two chairs at each; Cargo's shipping desk, one)
  radioSeat: [{ room: 'tower', piece: 'chair', variant: 'desk', face: 'own', near: { piece: 'console', variant: 'radio' } }],
  trafficSeat: [{ room: 'tower', piece: 'chair', variant: 'desk', face: 'own', near: { piece: 'console', variant: 'traffic' } }],
  readoutsSeat: [{ room: 'tower', piece: 'chair', variant: 'desk', face: 'own', near: { piece: 'console', variant: 'readouts' } }],
  announceSeat: [{ room: 'tower', piece: 'chair', variant: 'desk', face: 'own', near: { piece: 'console', variant: 'announce' } }],
  shipSeat: [{ room: 'store', piece: 'chair', variant: 'desk', face: 'own', near: { piece: 'shipDesk' } }],
};

// THE CLIPS: standing (the calm one: the crew kit's CALM is made from Stand_Listen), sitting, at work, now and then
export const CLIPS = { stand: 'Stand_Listen', sit: 'Sit_Listen', walk: 'Walk', reach: 'Interact', polish: 'Bar_Polish', forge: 'Tend_Forge', hammer: 'Hammer' };

// THE ROSTER (who comes aboard first: everyone, the NEAR nearest the player about at once). look: a crew kit recipe (by
// name, or its own); voice: whose voice says their hellos (sound/voices.js; rate: a little higher or lower, so two people
// sharing a voice are told apart); name: what the others call them (lines.js); day: what they do (above).
const T = (lo, hi) => [lo, hi];
export const ROSTER = [
  // ── the captains, looking for crew (a yellow marker over each): in the terminal most of the time, now and then out at
  // their own ship (Captain Adair's is down for maintenance: she walks the station's rounds instead) ──
  { id: 'vega', name: 'Captain Vega', look: 'vega', voice: 'vega', captain: { ship: 'explorer' },
    day: [{ do: 'stand:windows', for: T(30, 60) }, { do: 'sit:window', for: T(40, 80), p: 0.6 }, { do: 'stand:board', for: T(15, 30), p: 0.5 }, { do: 'stand:explorerShip', for: T(40, 80) }, { do: 'stand:terminalFloor', for: T(20, 40) }, { do: 'sit:cafe', for: T(60, 120), p: 0.4 }] },
  { id: 'ruiz', name: 'Captain Ruiz', look: 'captainMan', voice: 'ruiz', captain: { ship: 'miner' },
    day: [{ do: 'stand:terminalFloor', for: T(20, 40) }, { do: 'stand:windows', for: T(30, 50) }, { do: 'sit:cafe', for: T(60, 120), p: 0.5 }, { do: 'stand:minerShip', for: T(40, 80) }, { do: 'stand:lobby', for: T(15, 30), p: 0.4 }, { do: 'stand:counter', for: T(6, 12), p: 0.5 }] },
  { id: 'hale', name: 'Captain Hale', look: 'captainWoman', voice: 'hale', captain: { ship: 'medic' },
    day: [{ do: 'sit:window', for: T(50, 90) }, { do: 'stand:windows', for: T(20, 40) }, { do: 'stand:medicShip', for: T(40, 80) }, { do: 'stand:medicalFloor', for: T(20, 40), p: 0.5 }, { do: 'stand:board', for: T(15, 25), p: 0.5 }, { do: 'sit:cafe', for: T(60, 120), p: 0.4 }] },
  // (Captain Adair, the security captain on the jobs board, her ship down for maintenance for now (the game's maker,
  // 2026-11-17: "Add Captain Adair walking about too ... You could just say their ship is down for maintenance for now"):
  // the captains' uniform in the security crew's blue, about the terminal and walking the station's rounds)
  { id: 'adair', name: 'Captain Adair', look: { suit: 'captainWoman', head: 't9', hair: 'wavy', colours: { uniform: '#2f6db3', skin: '#a66d45', hair: '#2a1a12' }, face: { jawWidth: 0.4, cheekbones: 0.4, eyeSize: -0.2 } }, voice: 'adair', captain: { ship: 'security' },
    // (security, on her feet: the station's rounds, a look out of the windows, at a screen, over the hangar. Not at the
    // captains' board (she isn't hiring, and its one free spot is the others') and not on the terminal's seats: with
    // her on them too, ten minutes on a phone had 16 to 21 jams at them, against main's 5 to 11)
    day: [{ do: 'stand:windows', for: T(25, 50), p: 0.6 }, { do: 'walk:patrol' }, { do: 'stand:terminal', for: T(15, 30), p: 0.6 }, { do: 'stand:hangar', for: T(30, 60), p: 0.6 }, { do: 'walk:patrol', p: 0.5 },
      { do: 'stand:terminalFloor', for: T(20, 40), p: 0.6 }] },
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
  { id: 'crew-ada', name: 'Ada', look: { suit: 'atlantis2', head: 't3', hair: 'ponytail', colours: { job: 'explorer', uniform: '#6e28b2', skin: '#e8bf9f', hair: '#6b4127' } }, voice: 'yw', rate: 1.03,
    day: [{ do: 'stand:ship', for: T(20, 45), clip: 'reach', p: 0.7 }, { do: 'stand:quarters', for: T(10, 25) }, { do: 'stand:counter', for: T(6, 12) }, { do: 'sit:cafe', for: T(140, 280) }, { do: 'talk:terminal', for: T(25, 50) }, { do: 'stand:hangar', for: T(25, 50) }, { do: 'stand:lockers', for: T(8, 16), clip: 'reach' }] },
  { id: 'miner-oso', name: 'Oso', look: { suit: 'smelter', head: 't6', hair: 'curlyShort', colours: { job: 'miner', skin: '#663b22', hair: '#17110d' } }, voice: 'ym', rate: 0.97,
    day: [{ do: 'stand:minerShip', for: T(20, 45), clip: 'reach', p: 0.7 }, { do: 'stand:minerHangar', for: T(30, 60), clip: 'reach' }, { do: 'sit:waiting', for: T(30, 60) }, { do: 'scan', for: T(40, 60), p: 0.3 }, { do: 'talk:lobby', for: T(20, 40) }, { do: 'stand:counter', for: T(6, 12) }, { do: 'sit:cafe', for: T(120, 240) }] },
  { id: 'hauler-pia', name: 'Pia', look: { suit: 'atlantis2', head: 't11', hair: 'braidcrown', colours: { job: 'hauler', uniform: '#f0892e', skin: '#c48a62', hair: '#8f8a84' } }, voice: 'yw', rate: 0.9,
    day: [{ do: 'stand:ship', for: T(20, 45), clip: 'reach', p: 0.7 }, { do: 'stand:hangar', for: T(30, 60), clip: 'reach' }, { do: 'talk:hangar', for: T(20, 40) }, { do: 'stand:lockers', for: T(8, 16), clip: 'reach' }, { do: 'sit:cafe', for: T(120, 240) }] },
  { id: 'diner-uma', name: 'Uma', look: { suit: 'dockWorker', head: 't7', hair: 'afro', colours: { job: 'staff', skin: '#47291a', hair: '#17110d' } }, voice: 'yw', rate: 1.06,
    day: [{ do: 'sit:cafe', for: T(180, 320) }, { do: 'stand:drinks', for: T(6, 12) }, { do: 'sit:window', for: T(40, 90) }, { do: 'talk:terminal', for: T(25, 50) }] },
];

// THE PEOPLE AT WORK IN THE CONTROL ROOM AND IN CARGO, the two places only the lift goes to (2026-11-20, the game's
// maker, of "Should anyone work in the control room and the store room?": "One crew member always sitting at the radio
// desk and one at traffic control, and one at the store's shipping desk", and "I'd like a few people in each place").
// Four in each: in the control room the radio operator and the traffic controller, always at their desks, and two more
// at the other desks, at the windows and walking about the room; in Cargo the shipping clerk, mostly at the shipping
// desk, and three more at the packing benches, the racks, the containers, the scale and the pallets waiting. Nobody
// walks to these places, so nobody here walks away from them: each one's day is all in their own place (`place`, the
// lift's name for it: 'tower', 'store'). They are made the first time the player steps into the lift, and are about only
// while the player is in their place (put there while the lift's doors are shut, each at a moment of their day picked
// at random), out of the scene the rest of the time (src/people.js THE PLACES ONLY THE LIFT GOES TO). Otherwise they
// are the station's own people: looks from parts the station's people already wear, the same voices and hellos.
export const ROOM_CREW = [
  // ── the control room ──
  { id: 'radio-rhea', name: 'Rhea', place: 'tower', look: { suit: 'atlantis2', head: 't9', hair: 'wavy', colours: { job: 'staff', uniform: '#2ec4b6', skin: '#86522f', hair: '#17110d' } }, voice: 'yw', rate: 0.97,
    day: [{ do: 'sit:radioSeat', for: T(240, 480) }] },
  { id: 'traffic-milo', name: 'Milo', place: 'tower', look: { suit: 'atlantis1', head: 't2', hair: 'coil', colours: { job: 'staff', uniform: '#2ec4b6', skin: '#d9a37f', hair: '#4a2f1d' } }, voice: 'ym', rate: 1.02,
    day: [{ do: 'sit:trafficSeat', for: T(240, 480) }] },
  { id: 'duty-dara', name: 'Dara', place: 'tower', look: { suit: 'atlantis2', head: 't11', hair: 'braidcrown', colours: { job: 'staff', uniform: '#3f8fe8', skin: '#c48a62', hair: '#2e1f15' } }, voice: 'yw', rate: 1.08,
    day: [{ do: 'stand:readoutsStand', for: T(15, 30), clip: 'reach' }, { do: 'walk:towerRound' }, { do: 'stand:towerWindows', for: T(20, 40) }, { do: 'sit:announceSeat', for: T(40, 80), p: 0.5 },
      { do: 'stand:radioBehind', for: T(10, 20), p: 0.6 }, { do: 'talk:tower', for: T(20, 40), p: 0.6 }, { do: 'stand:announceStand', for: T(10, 20), clip: 'reach', p: 0.5 }] },
  { id: 'readouts-finn', name: 'Finn', place: 'tower', look: { suit: 'atlantis1', head: 't1', hair: 'shortFull', colours: { job: 'staff', uniform: '#2ec4b6', skin: '#e8bf9f', hair: '#b4824f' } }, voice: 'ym', rate: 0.95,
    day: [{ do: 'sit:readoutsSeat', for: T(60, 140) }, { do: 'stand:towerWindows', for: T(15, 30) }, { do: 'talk:tower', for: T(20, 40), p: 0.6 }, { do: 'sit:readoutsSeat', for: T(60, 140) },
      { do: 'stand:announceStand', for: T(10, 20), clip: 'reach', p: 0.5 }, { do: 'walk:towerRound', p: 0.4 }] },
  // ── Cargo ──
  { id: 'clerk-gus', name: 'Gus', place: 'store', look: { suit: 'civilian', head: 't8', hair: 'buzz', colours: { job: 'hauler', skin: '#a66d45', hair: '#2e1f15' } }, voice: 'om', rate: 0.98,
    day: [{ do: 'sit:shipSeat', for: T(180, 360) }, { do: 'stand:printer', for: T(6, 12), clip: 'reach', p: 0.4 }] },
  { id: 'packer-nell', name: 'Nell', place: 'store', look: { suit: 'dockWorker', head: 't3', hair: 'ponytail', colours: { job: 'hauler', skin: '#e8bf9f', hair: '#a83c22' } }, voice: 'yw', rate: 1.01,
    day: [{ do: 'stand:benches', for: T(30, 60), clip: 'reach' }, { do: 'stand:benches', for: T(20, 40), clip: 'reach' }, { do: 'stand:pallets', for: T(15, 30), clip: 'reach', p: 0.6 },
      { do: 'talk:cargo', for: T(20, 40), p: 0.5 }, { do: 'stand:containers', for: T(15, 25), p: 0.4 }] },
  { id: 'stock-sami', name: 'Sami', place: 'store', look: { suit: 'atlantis1', head: 't10', hair: 'mohawk', colours: { job: 'hauler', uniform: '#f0892e', skin: '#663b22', hair: '#17110d' } }, voice: 'ym', rate: 1.04,
    day: [{ do: 'walk:cargoRound' }, { do: 'stand:racks', for: T(15, 30), clip: 'reach' }, { do: 'stand:racks', for: T(15, 30), clip: 'reach', p: 0.7 }, { do: 'stand:cold', for: T(8, 15), p: 0.5 },
      { do: 'talk:cargo', for: T(20, 40), p: 0.5 }] },
  { id: 'loader-otto', name: 'Otto', place: 'store', look: { suit: 'smelter', head: 't4', hair: 'shortFull', colours: { job: 'hauler', skin: '#d9a37f', hair: '#8f8a84' } }, voice: 'om', rate: 1.03,
    day: [{ do: 'stand:containers', for: T(20, 40), clip: 'reach' }, { do: 'stand:scale', for: T(15, 30) }, { do: 'stand:pallets', for: T(15, 30), clip: 'reach' }, { do: 'walk:cargoRound', p: 0.4 },
      { do: 'talk:cargo', for: T(20, 40), p: 0.5 }] },
];
