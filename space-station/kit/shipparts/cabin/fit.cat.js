// THE CABIN'S FITTINGS for the galley, washroom, med bay, engineering and science area, as catalog pieces (kit/catalog.js's
// format: group 'Ship cabin', at 'free', variants, foot [w, h, d] for the lab's framing, build(p, v)). Each variant is a
// named preset of its part's options (PRESETS below; a ship calls the part itself with the sizes it needs). `mount` says
// how it stands: 'wall' (z = 0 on a wall line), 'ceiling' (hangs from the ceiling) or 'free' (centred, standing free).
import { galleyCounter, fridge, dinette } from './galley.js';
import { toilet, basin, shower } from './wash.js';
import { medBed, scanner, pharmacy, stretcher } from './medical.js';
import { reactor } from './engine.js';
import { holoTable } from './science.js';
import { cornerBench, messTable, stool, topCabinets, coldStore, drinkUnit, backsplash, galleyRun, coffeeMachine, mug, fruitBowl, poster, GUN } from './mess.js';
import { bunkStack, crewLocker } from './bunks.js';
import { shallowLocker, endLocker, lockerBody, berthLockers } from './lockers.js';
import { labBench, microscope, glovebox, vialRack, tablet, sampleCase, surveyTable, labStool, ringLight } from './lab.js';
import { suitLockers, pressurePanel, wallBench } from './airlock.js';
import { showerStall, toiletBasin } from './washroom.js';
import { reactorCore, drivePumps, engStation, gearShelves } from './engroom.js';
import { starScreen, screen, glowStrip } from './bits.js';
import { wallPipes, pipeRun, grating, hoopRail } from './engpipes.js';
import { downlight, washLight } from './lights.js';
import { growPod } from './growpod.js';
import { shape, solid, add } from '../../bevel.js';
import { placeInto, part } from '../place.js';

export const PRESETS = {
  cabinGalley: { 'sink and hob': {}, long: { len: 2.0, sink: -0.75, hob: 0.25 }, short: { len: 1.0, sink: -0.25, hob: 0.25, upper: false }, 'sink only': { len: 1.5, sink: 0, hob: null } },
  cabinFridge: { '0.6 m wide': {}, '0.5 m wide': { w: 0.5 } },
  cabinDinette: { L: { form: 'L' }, facing: { form: 'facing', bench: 1.0, table: [1.0, 0.7] }, single: { form: 'single', bench: 1.5, table: [1.2, 0.8] }, 'for two': { form: 'single', bench: 1.0, table: [0.9, 0.6] } },
  cabinToilet: { wall: {} },
  cabinBasin: { '0.5 m': {}, '0.6 m': { w: 0.6 } },
  cabinShower: { stall: {}, '1 m': { w: 1.0, depth: 1.0 } },
  cabinMedBed: { raised: {}, flat: { back: 0 }, 'arm left': { arm: -1 } },
  cabinScanner: { hood: {} },
  cabinPharmacy: { '2 m': {}, '1.5 m': { len: 1.5 }, '1 m': { len: 1.0, shelves: 3 } },
  cabinStretcher: { trolley: {}, low: { top: 0.5 } },
  cabinReactor: { upright: {}, drum: { form: 'drum' }, 'big drum': { form: 'drum', w: 2.0, len: 2.6 }, 'no pipes': { pipes: 0 } },
  cabinHolo: { terrain: {}, planet: { show: 'planet' }, console: { form: 'console' } },
  // (the mess in the bevel helper's language, kit/shipparts/cabin/mess.js)
  cabinMessBench: { '1.5 m': { len: 1.5 }, 'corner end': { len: 1.5, seatAt: [-0.75, 0.63], backAt: [-0.75, 0.63] } },
  cabinMessTable: { '0.75 x 1 m': {}, 'with stools': { stools: true } },
  cabinStool: { '8-sided': {} },
  cabinTopCabinets: { 'under the hull\'s slope': { len: 1.5, slope: { y0: 2.0, run: 0.5 }, poster: 0 }, 'to the ceiling': { len: 0.75, y: 1.55, depth: 0.25 } },
  cabinColdStore: { '0.5 m': { poster: 3 }, 'shallow, up to a slope': { depth: 0.35, poster: 3, top: 2.37 } },
  // (round four, the game's maker's drawing of the galley: the drink unit built in beside the cold store, flush with it, and
  // the wall over the counter with the grow pods' two openings)
  cabinDrinkUnit: { 'beside the cold store, under a slope': { w: 0.5, depth: 0.35, top: 2.37, wall: -1 }, 'to the ceiling': { w: 0.5, depth: 0.35, top: 2.5 }, 'with the cold store': { w: 0.5, depth: 0.35, top: 2.37, wall: -1, store: true } },
  cabinBacksplash: { 'two pod openings, blanked': { len: 0.95, y0: 0.9, y1: 1.52, holes: [[-0.235, 1.24], [0.235, 1.24]] }, 'open (pods to come)': { len: 0.95, y0: 0.9, y1: 1.52, holes: [[-0.235, 1.24], [0.235, 1.24]], blanks: false } },
  cabinGalleyRun: { '1.25 m': { len: 1.25, end: [0.08, 0] }, 'with its things': { len: 1.25, end: [0.08, 0], things: true } },
  cabinPoster: { 'the four': {}, 'the rooms\' eight': { from: 4 } },
  // (the other rooms, round two: kit/shipparts/cabin/bunks.js, lab.js, airlock.js, washroom.js, engroom.js)
  cabinBunks: { '2-high, ladder': { open: [-0.5, 0.92], head: 1, nums: [1, 2] }, 'open its whole length': { nums: [3, 4], head: -1 } },
  cabinCrewLocker: { numbered: { num: 1 }, 'with a poster': { num: 2, poster: 4 } },
  // (the built-ins of round three, kit/shipparts/cabin/lockers.js: shallow, as if they ran on into the wall, their free
  // ends cut at 45 degrees)
  cabinShallowLocker: { 'numbered, one end cut, one joined': { w: 0.4, ends: [0.08, 0], join: [0, 0.07], nums: [1, 2] }, 'two doors wide, labelled': { w: 1.0, cols: 2, h: 2.2, ends: [0.08, 0.08], label: 'label:tools' }, 'with a poster': { w: 0.5, ends: [0.08, 0.08], poster: 9 } },
  cabinEndLocker: { 'across a corner, a poster': { poster: 5 }, plain: {} },
  cabinBerthLockers: { 'over a 2.2 m stack': { len: 2.2, depth: 1, clip: [-0.77, 1.09], lid: 0.5, stack: true }, 'the lockers alone': { len: 2, depth: 1, lid: 0.5 } },
  cabinStarScreen: { '8-sided: wire planet': { w: 0.6, h: 0.34, seed: 3 }, '8-sided: star chart': { w: 0.5, h: 0.3, show: 'chart', seed: 9 } },
  cabinLiveScreens: { 'all nine programmes': {}, 'one, filling the frame': { one: true } },
  cabinCoreLooks: { 'flow and bolts': { core: 'flowbolts' }, 'plasma flowing': { core: 'flow' }, 'slow throb': { core: 'throb' }, 'fusion knot': { core: 'fusion' } },
  cabinFlickerStrip: { 'over a locker': {} },
  cabinLabBench: { 'with its things': { things: true }, '1.5 m': {}, '2 m, no knee space': { len: 2, knee: -1 } },
  cabinSurveyTable: { '1 x 1.25 m': {}, '0.9 m square': { w: 0.9, depth: 0.9 } },
  cabinSampleCase: { '1.5 m': {}, '1 m': { len: 1, h: 1.6 } },
  cabinLabStool: { 'grey pad': {}, 'navy pad': { pad: '#22355e' } },
  cabinRingLight: { 'hung over the survey table': { r: 0.3, drop: 0.27 } },
  cabinSuitLockers: { 'two, suits behind windows': { len: 1 }, 'one, with a poster': { len: 0.5, poster: 11 } },
  cabinPressurePanel: { 'by the hull door': {} },
  cabinAirlockBench: { 'fold-down': {}, 'navy cushion': { leather: '#22355e' } },
  cabinShowerStall: { 'corner, one end open': { ends: [false, true] }, 'both ends open': { ends: [true, true] } },
  cabinToiletBasin: { 'toilet and basin': {}, 'toilet alone': { len: 0.5 } },
  cabinReactor2: { 'in its corner': { back: 1 }, 'free of the walls': { back: 0 }, 'piped to the wall pipes': { back: 1, pipeY: 2 } },
  cabinDrivePumps: { 'drum and two pumps': { back: -1 }, 'piped to the wall pipes': { back: -1, pipeY: 2 }, 'long and slim': { back: 1, len: 2, depth: 1, pipeY: 1.92 } },
  cabinEngStation: { '1 m': {}, '1.5 m': { len: 1.5 } },
  cabinToolLockers: { 'shallow, one end cut, a poster': { poster: 9 }, 'deep (crew lockers)': { deep: true, poster: 9 } },
  cabinGearShelves: { 'shallow, 1 m': { depth: 0.32 }, '1 m': {}, '1.5 m': { len: 1.5 } },
  cabinEngPipes: { 'a pair, wall to wall': { len: 3 }, 'with two risers': { len: 3, risers: [[-0.6, 1], [0.6, 0]] }, 'into a slope at each end': { len: 3, slopes: [2, 2], risers: [[0, 1]] } },
  cabinEngPipeRun: { 'up, across on hangers, down': { pts: [[-1.2, 1.7, 0], [-1.2, 2.36, 0], [1.2, 2.36, 0], [1.2, 1.45, 0]], ceiling: 2.5, valve: [2, 0.5, [0, 0, 1]] }, 'with a jog': { pts: [[-1.2, 0.6, 0], [-1.2, 1.6, 0], [0.4, 1.6, 0], [0.4, 1.6, 0.6], [0.4, 0.4, 0.6]] } },
  cabinEngGrating: { 'down an aisle': { len: 1.84, wid: 0.9 }, 'short': { len: 1, wid: 0.6 } },
  cabinEngRail: { 'low': { len: 1.14, h: 0.5, z: 0.5 }, 'waist high': { len: 1.6, h: 0.95, z: 0.5 } },
  cabinDownlight: { 'in a ceiling': {}, 'small, under a locker': { r: 0.05, y: 1.4, drop: 0.5 } },
  cabinWashLight: { '2 m': { len: 2, y: 1.6 }, '1 m': { len: 1, y: 1.6 } },
  cabinGrowPod: { 'round, 30 cm': {}, 'eight-sided, 30 cm': { shape: 'oct' }, 'round, 45 cm': { size: 0.45 }, 'two side by side': { n: 2, plate: false, gap: 0.07 }, 'the leaves swaying (a choice)': { sway: 1 } },
};
const entry = (id, name, mount, foot, fn) => ({ name, group: 'Ship cabin', at: 'free', mount, variants: Object.keys(PRESETS[id]), foot, build: (p, v) => fn(p, PRESETS[id][v] ?? {}) });
export const CABIN_FIT = {
  cabinGalley: entry('cabinGalley', 'Galley counter', 'wall', [2, 2.2, 0.62], galleyCounter),
  cabinFridge: entry('cabinFridge', 'Fridge', 'wall', [0.6, 2.0, 0.62], fridge),
  cabinDinette: entry('cabinDinette', 'Table and benches', 'wall', [1.6, 1.1, 1.8], dinette),
  cabinToilet: entry('cabinToilet', 'Toilet', 'wall', [0.4, 1.0, 0.65], toilet),
  cabinBasin: entry('cabinBasin', 'Basin and mirror', 'wall', [0.6, 1.8, 0.45], basin),
  cabinShower: entry('cabinShower', 'Shower', 'wall', [1.0, 2.1, 1.0], shower),
  cabinMedBed: entry('cabinMedBed', 'Patient bed', 'wall', [1.3, 1.8, 2.3], medBed),
  cabinScanner: entry('cabinScanner', 'Triage scanner', 'ceiling', [1.2, 2.5, 1.9], scanner),
  cabinPharmacy: entry('cabinPharmacy', 'Pharmacy wall', 'wall', [2.0, 2.2, 0.62], pharmacy),
  cabinStretcher: entry('cabinStretcher', 'Stretcher', 'free', [0.65, 0.95, 2.0], stretcher),
  cabinReactor: entry('cabinReactor', 'Reactor', 'free', [2.0, 2.5, 1.2], reactor),
  cabinHolo: entry('cabinHolo', 'Holo table', 'free', [0.7, 1.5, 0.7], holoTable),
  cabinMessBench: entry('cabinMessBench', 'Mess: corner bench', 'wall', [1.5, 1.0, 0.5], cornerBench),
  cabinMessTable: entry('cabinMessTable', 'Mess: table', 'free', [1.3, 0.8, 1.4], (p, o) => { messTable(p, o); if (o.stools) for (const [x, z] of [[0.4, -0.2], [0.4, 0.25], [0, 0.55]]) placeInto(p, part(stool, {}), { at: [x, 0, z] }); return p; }),
  cabinStool: entry('cabinStool', 'Mess: stool', 'free', [0.35, 0.45, 0.35], stool),
  cabinTopCabinets: entry('cabinTopCabinets', 'Mess: top-corner cabinets', 'wall', [1.5, 2.5, 0.5], topCabinets),
  cabinColdStore: entry('cabinColdStore', 'Mess: cold store', 'wall', [0.5, 2.0, 0.5], coldStore),
  cabinDrinkUnit: entry('cabinDrinkUnit', 'Mess: drink unit (coffee maker, a second machine over it)', 'wall', [1.0, 2.5, 0.4], (p, o) => { drinkUnit(p, o); if (o.store) placeInto(p, part(coldStore, { w: 0.5, depth: 0.35, h: 2, top: o.top, poster: 3 }), { at: [0.5, 0, 0] }); return p; }),
  cabinBacksplash: entry('cabinBacksplash', 'Mess: the wall over the counter, pod openings', 'wall', [1.0, 1.6, 0.05], backsplash),
  cabinGalleyRun: entry('cabinGalleyRun', 'Mess: galley counter', 'wall', [1.25, 1.3, 0.5], (p, o) => { galleyRun(p, o); if (o.things) { placeInto(p, part(coffeeMachine, {}), { at: [0.0, 0.9, 0.3] }); placeInto(p, part(mug, {}), { at: [0.24, 0.9, 0.33], rot: [0, 0.7, 0] }); placeInto(p, part(mug, {}), { at: [0.33, 0.9, 0.2] }); placeInto(p, part(fruitBowl, {}), { at: [-0.4, 0.9, 0.27] }); } return p; }),
  cabinPoster: entry('cabinPoster', 'Posters', 'wall', [2.4, 1.0, 0.05], (p, o) => { if (o.from) { for (let i = 0; i < 8; i++) placeInto(p, part(poster, { i: o.from + i, y: i < 4 ? 0.75 : 0.3 }), { at: [-0.84 + (i % 4) * 0.56, 0, 0] }); return p; } [-0.9, -0.3, 0.35, 0.95].forEach((x, i) => placeInto(p, part(poster, { i, dark: i === 1, y: 0.6 }), { at: [x, 0, 0] })); return p; }),
  cabinBunks: entry('cabinBunks', 'Bunks: berths, 2-high', 'wall', [2, 1.9, 1.1], bunkStack),
  cabinCrewLocker: entry('cabinCrewLocker', 'Bunks: locker', 'wall', [0.5, 2.0, 0.5], crewLocker),
  cabinShallowLocker: entry('cabinShallowLocker', 'Built-in: shallow locker', 'wall', [1.0, 2.5, 0.3], shallowLocker),
  // (its body from a plan across a corner, its face on the diagonal: from (-0.2, 0.42) to (0.2, 0.1))
  cabinEndLocker: entry('cabinEndLocker', 'Built-in: thin end locker, face on a diagonal', 'wall', [0.5, 2.5, 0.45], (p, o) => { placeInto(p, part(lockerBody, { pts: [[-0.2, 0.03], [0.2, 0.03], [0.2, 0.1], [-0.2, 0.42]] }), { at: [0, 0, 0] }); placeInto(p, part(endLocker, { w: 0.51, ...o }), { at: [0, 0, 0.26], rot: [0, Math.atan2(0.32, 0.4), 0] }); return p; }),
  cabinBerthLockers: entry('cabinBerthLockers', 'Bunks: lockers over the berths', 'wall', [2.2, 2.5, 1.1], (p, o) => { if (o.stack) placeInto(p, part(bunkStack, { len: 2.2, depth: 1, open: [-0.7, 1.02], head: -1, nums: [1, 2] }), { at: [0, 0, 0] }); return berthLockers(p, o); }),
  cabinStarScreen: entry('cabinStarScreen', 'Star screen, 8-sided', 'wall', [0.7, 0.4, 0.05], (p, o) => placeInto(p, part(starScreen, o), { at: [0, 0.3, 0] })),
  cabinLabBench: entry('cabinLabBench', 'Lab: bench', 'wall', [1.5, 1.3, 0.5], (p, o) => { labBench(p, o); if (o.things) { placeInto(p, part(glovebox, {}), { at: [-0.48, 0.9, 0.05] }); placeInto(p, part(microscope, {}), { at: [-0.12, 0.9, 0.24], rot: [0, 0.4, 0] }); placeInto(p, part(vialRack, { seed: 1 }), { at: [0.42, 0.9, 0.16] }); placeInto(p, part(tablet, {}), { at: [0.12, 0.9, 0.37], rot: [0, -0.25, 0] }); } return p; }),
  cabinSurveyTable: entry('cabinSurveyTable', 'Lab: survey table', 'wall', [1.0, 0.95, 1.25], surveyTable),
  cabinSampleCase: entry('cabinSampleCase', 'Lab: SAMPLES case', 'wall', [1.5, 1.8, 0.25], sampleCase),
  cabinLabStool: entry('cabinLabStool', 'Lab: stool', 'free', [0.46, 0.95, 0.46], labStool),
  cabinRingLight: entry('cabinRingLight', 'Lab: ring light over the survey table', 'free', [0.7, 0.4, 0.7], (p, o) => placeInto(p, part(ringLight, o), { at: [0, 0.1, 0] })),
  cabinSuitLockers: entry('cabinSuitLockers', 'Airlock: suit lockers', 'wall', [1.0, 2.0, 0.25], suitLockers),
  cabinPressurePanel: entry('cabinPressurePanel', 'Airlock: pressure panel', 'wall', [0.4, 1.6, 0.08], pressurePanel),
  cabinAirlockBench: entry('cabinAirlockBench', 'Airlock: bench', 'wall', [0.45, 0.9, 0.34], wallBench),
  cabinShowerStall: entry('cabinShowerStall', 'Washroom: shower', 'wall', [0.75, 2.0, 0.75], showerStall),
  cabinToiletBasin: entry('cabinToiletBasin', 'Washroom: toilet and basin', 'wall', [0.75, 1.7, 0.6], toiletBasin),
  cabinReactor2: entry('cabinReactor2', 'Engineering: reactor, glowing core', 'wall', [1.5, 2.5, 1.25], reactorCore),
  // (the moving parts, kit/shipparts/cabin/live.js, livecore.js: the screens' programmes, the core's looks, the tired strip)
  cabinLiveScreens: entry('cabinLiveScreens', 'Screens: the live programmes', 'wall', [2.4, 1.6, 0.05], (p, o) => { for (let i = 0; i < (o.one ? 1 : 9); i++) screen(p, { w: o.one ? 1.2 : 0.7, h: o.one ? 0.72 : 0.42, oct: 0.02, live: i + 1, seed: (i * 0.37) % 1 }, o.one ? [0, 0.8, 0] : [(i % 3 - 1) * 0.8, 0.3 + (2 - Math.floor(i / 3)) * 0.52, 0]); return p; }),
  cabinCoreLooks: entry('cabinCoreLooks', 'Engineering: reactor, the core\'s looks', 'wall', [1.5, 2.5, 1.25], (p, o) => reactorCore(p, { back: 0, ...o })),
  cabinFlickerStrip: entry('cabinFlickerStrip', 'Light: the tired strip (one on a ship)', 'wall', [1.0, 2.2, 0.5], (p) => { placeInto(p, part(crewLocker, { h: 1.8 }), { at: [0, 0, 0] }); glowStrip(p, 0.9, [0, 2.02, 0.03], [0, 0, 0], { flicker: true, i: 0.3, pool: 0.6, poolAt: [0, 1.5, 0.7] }); return p; }),
  cabinDrivePumps: entry('cabinDrivePumps', 'Engineering: drive and pumps', 'wall', [1.5, 1.8, 1.25], drivePumps),
  cabinEngStation: entry('cabinEngStation', 'Engineering: station', 'wall', [1.0, 1.5, 0.5], engStation),
  // (shallow: the ship's built-in, kit/shipparts/cabin/lockers.js; deep: two crew lockers, for a plan that gives them half a metre)
  cabinToolLockers: entry('cabinToolLockers', 'Engineering: tool lockers', 'wall', [1.0, 2.2, 0.5], (p, o) => { if (!o.deep) return shallowLocker(p, { w: 1, depth: 0.22, h: 2.2, cols: 2, ends: [0.14, 0], label: 'label:tools', poster: o.poster }); for (const [x, P] of [[-0.25, o.poster], [0.25, null]]) placeInto(p, part(crewLocker, { label: 'label:tools', poster: P }), { at: [x, 0, 0] }); return p; }),
  cabinGearShelves: entry('cabinGearShelves', 'Engineering: gear shelves', 'wall', [1.0, 1.8, 0.5], gearShelves),
  cabinEngPipes: entry('cabinEngPipes', 'Engineering: two pipes along a wall', 'wall', [3.0, 2.3, 0.3], wallPipes),
  cabinEngPipeRun: entry('cabinEngPipeRun', 'Engineering: a pipe through points', 'free', [2.6, 2.5, 0.8], pipeRun),
  cabinEngGrating: entry('cabinEngGrating', 'Engineering: floor grating', 'free', [2.0, 0.05, 1.0], grating),
  cabinEngRail: entry('cabinEngRail', 'Engineering: tube rail', 'wall', [1.6, 1.0, 0.6], hoopRail),
  // (the light fittings, kit/shipparts/cabin/lights.js: the disc under a square of ceiling, to show how it sits in one,
  // over a square of deck for its light to land on; the Kit Lab draws its beam with dust in it, kit/beams.js)
  cabinDownlight: entry('cabinDownlight', 'Light: downlight disc', 'free', [1.1, 2.5, 1.1], (p, o) => { const y = o.y ?? 2.5; add(p, 'white2', solid(shape(0.7, 0.7, 0.06), 0.02, { edge: 0.004 }), [0, y + 0.02, 0], [Math.PI / 2, 0, 0]); if (!o.y) add(p, GUN, solid(shape(1.1, 1.1, 0.1), 0.02, { edge: 0.004 }), [0, 0, 0], [Math.PI / 2, 0, 0]); return downlight(p, { drop: y - 0.03, ...o, at: [0, y, 0] }); }),
  cabinWashLight: entry('cabinWashLight', 'Light: wall wash strip', 'wall', [2.0, 1.8, 0.1], washLight),
  // (the grow pod, kit/shipparts/cabin/growpod.js: a rotary garden of real plants turning behind frosted glass)
  cabinGrowPod: entry('cabinGrowPod', 'Grow pod: rotary garden', 'wall', [1.0, 0.6, 0.05], (p, o) => placeInto(p, part(growPod, { y: 0.3, ...o }), { at: [0, 0, 0] })),
};
