// THE SHIP PARTS: Ship cockpit (cockpit seats, flight sticks and throttles, button and switch panels, consoles and screens), as the Kit Lab's "Ship parts" tab shows them. Each entry is a catalog piece
// (kit/catalog.js's format: group 'Ship cockpit', at 'free', variants, foot [w, h, d] for the lab's framing, build(p, v)),
// each built from this family's reusable part functions (kit/shipparts/), which the ships call directly with their own
// sizes and place with place.js.
//   The part functions are in kit/shipparts/cockpit/: seats.js, controls.js, panels.js, consoles.js, fittings.js; a
//   sample cockpit put together from them is set.js (with a person for scale, guide.js); their shared look is look.js.
//   The variants here are a few named presets of each part's options.
import { flightSeat, crewSeat, jumpSeat } from './cockpit/seats.js';
import { flightStick, throttle, pedals } from './cockpit/controls.js';
import { buttonGrid, switchRow, knobRow, overheadPanel, sidePanel } from './cockpit/panels.js';
import { dashboard, engineerStation, wallConsole } from './cockpit/consoles.js';
import { cockpitLocker, handhold } from './cockpit/fittings.js';
import { cockpitSet } from './cockpit/set.js';
import { mfd } from './cockpit/look.js';

const G = 'Ship cockpit', free = (name, variants, foot, build) => ({ name, group: G, at: 'free', variants, foot, build });
const SEATS = { pilot: { stick: 'left' }, 'co-pilot': { stick: 'right' }, grey: { look: 'grey', stick: 'left' }, station: { look: 'station', stick: 'left' }, 'slid back': { slide: -0.1 }, bare: { harness: false } };

export const COCKPIT = {
  cpSeat: free('Flight seat', Object.keys(SEATS), [0.7, 1.4, 0.8], (p, v) => flightSeat(p, SEATS[v])),
  cpCrewSeat: free('Crew seat', ['tan', 'grey', 'station'], [0.6, 1.1, 0.6], (p, v) => crewSeat(p, { look: v })),
  cpJumpSeat: free('Jump seat', ['down', 'up', 'station'], [0.6, 1.5, 0.6], (p, v) => jumpSeat(p, { open: v !== 'up', look: v === 'station' ? 'station' : 'tan' })),
  cpStick: free('Flight stick', ['armrest', 'floor'], [0.2, 0.7, 0.25], (p, v) => flightStick(p, { mount: v === 'floor' ? 'floor' : 'arm' })),
  cpThrottle: free('Throttle quadrant', ['pedestal', 'two levers', 'three levers', 'armrest'], [0.3, 0.9, 0.55], (p, v) => throttle(p, v === 'pedestal' ? { mount: 'pedestal' } : v === 'armrest' ? { mount: 'arm' } : { mount: 'dash', levers: v === 'three levers' ? 3 : 2 })),
  cpPedals: free('Pedals', ['pair'], [0.55, 0.3, 0.3], (p) => pedals(p)),
  cpButtons: free('Button grid', ['4 x 3', '6 x 2', '3 x 4'], [0.3, 0.2, 0.05], (p, v) => { const [c, r] = v.split(' x ').map(Number); buttonGrid(p, { cols: c, rows: r, seed: c * 7 + r }); }),
  cpSwitches: free('Switch row', ['five, guarded', 'four, guarded', 'six, bare'], [0.32, 0.12, 0.06], (p, v) => switchRow(p, v.startsWith('five') ? { n: 5 } : v.startsWith('four') ? { n: 4, pitch: 0.05, legend: 'b' } : { n: 6, guards: false, covers: 0 })),
  cpKnobs: free('Knob row', ['three', 'four'], [0.3, 0.1, 0.05], (p, v) => knobRow(p, { n: v === 'four' ? 4 : 3 })),
  cpScreen: free('Screen (MFD)', ['scope', 'bars', 'text', 'radar', 'sum'], [0.4, 0.3, 0.05], (p, v) => mfd(p, { face: v, w: v === 'sum' ? 0.33 : v === 'scope' ? 0.19 : 0.21 })),
  cpOverhead: free('Overhead panel', ['dark', 'station white'], [0.5, 0.7, 0.8], (p, v) => overheadPanel(p, v === 'dark' ? { ceil: 0.7 } : { ceil: 0.7, body: 'white' })),
  cpSide: free('Side console', ['1.0 m', '0.5 m', 'no pod', 'station white'], [1.0, 1.2, 0.4], (p, v) => sidePanel(p, v === 'station white' ? { body: 'white' } : v === 'no pod' ? { pod: false } : { len: parseFloat(v) })),
  cpDash: free('Dashboard', ['two seats', 'three seats'], [3.2, 1.1, 1.0], (p, v) => dashboard(p, { seats: v.startsWith('three') ? 3 : 2 })),
  cpEngineer: free("Engineer's station", ['1.0 m', '1.5 m', '2.0 m'], [2.0, 1.5, 0.55], (p, v) => engineerStation(p, { w: parseFloat(v) })),
  cpWall: free('Wall console', ['status', 'terminal', 'radar'], [0.7, 0.8, 0.25], (p, v) => wallConsole(p, { face: v, y: 0 })),
  cpLocker: free('Cockpit locker', ['floor', 'wall'], [0.55, 0.7, 0.4], (p, v) => cockpitLocker(p, v === 'wall' ? { y: 0.2, h: 0.45 } : {})),
  cpHandhold: free('Handhold', ['0.4 m', '0.8 m', 'upright'], [0.9, 0.3, 0.12], (p, v) => handhold(p, v === 'upright' ? { len: 0.6, y: 0.4, up: true } : { len: parseFloat(v), y: 0.1 })),
  cpSet: free('Sample cockpit', ['two seats', 'three seats'], [4.0, 2.6, 4.2], (p, v) => { cockpitSet(p, { seats: v.startsWith('three') ? 3 : 2, guides: true }); }),
};
