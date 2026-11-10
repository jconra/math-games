// THE CABIN'S FITTINGS for the galley, washroom, med bay, engineering and science area, as catalog pieces (kit/catalog.js's
// format: group 'Ship cabin', at 'free', variants, foot [w, h, d] for the lab's framing, build(p, v)). Each variant is a
// named preset of its part's options (PRESETS below; a ship calls the part itself with the sizes it needs). `mount` says
// how it stands: 'wall' (z = 0 on a wall line), 'ceiling' (hangs from the ceiling) or 'free' (centred, standing free).
import { galleyCounter, fridge, dinette } from './galley.js';
import { toilet, basin, shower } from './wash.js';
import { medBed, scanner, pharmacy, stretcher } from './medical.js';
import { reactor } from './engine.js';
import { holoTable } from './science.js';
import { cornerBench, messTable, stool, topCabinets, coldStore, galleyRun, coffeeMachine, mug, fruitBowl, poster } from './mess.js';
import { bunkStack, crewLocker } from './bunks.js';
import { labBench, microscope, glovebox, vialRack, tablet, sampleCase, surveyTable, labStool } from './lab.js';
import { starScreen } from './bits.js';
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
  cabinColdStore: { '0.5 m': { poster: 3 } },
  cabinGalleyRun: { '1.25 m': { len: 1.25, end: [0.08, 0] }, 'with its things': { len: 1.25, end: [0.08, 0], things: true } },
  cabinPoster: { 'the four': {}, 'the rooms\' eight': { from: 4 } },
  // (the other rooms, round two: kit/shipparts/cabin/bunks.js, lab.js, airlock.js, washroom.js, engroom.js)
  cabinBunks: { '2-high, ladder': { open: [-0.5, 0.92], head: 1, nums: [1, 2] }, 'open its whole length': { nums: [3, 4], head: -1 } },
  cabinCrewLocker: { numbered: { num: 1 }, 'with a poster': { num: 2, poster: 4 } },
  cabinStarScreen: { '8-sided': { w: 0.6, h: 0.34, seed: 3 }, 'no planet': { w: 0.5, h: 0.3, planet: false, seed: 9 } },
  cabinLabBench: { 'with its things': { things: true }, '1.5 m': {}, '2 m, no knee space': { len: 2, knee: -1 } },
  cabinSurveyTable: { '1 x 1.25 m': {}, '0.9 m square': { w: 0.9, depth: 0.9 } },
  cabinSampleCase: { '1.5 m': {}, '1 m': { len: 1, h: 1.6 } },
  cabinLabStool: { 'grey pad': {}, 'navy pad': { pad: '#22355e' } },
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
  cabinGalleyRun: entry('cabinGalleyRun', 'Mess: galley counter', 'wall', [1.25, 1.3, 0.5], (p, o) => { galleyRun(p, o); if (o.things) { placeInto(p, part(coffeeMachine, {}), { at: [0.0, 0.9, 0.3] }); placeInto(p, part(mug, {}), { at: [0.24, 0.9, 0.33], rot: [0, 0.7, 0] }); placeInto(p, part(mug, {}), { at: [0.33, 0.9, 0.2] }); placeInto(p, part(fruitBowl, {}), { at: [-0.4, 0.9, 0.27] }); } return p; }),
  cabinPoster: entry('cabinPoster', 'Posters', 'wall', [2.4, 1.0, 0.05], (p, o) => { if (o.from) { for (let i = 0; i < 8; i++) placeInto(p, part(poster, { i: o.from + i, y: i < 4 ? 0.75 : 0.3 }), { at: [-0.84 + (i % 4) * 0.56, 0, 0] }); return p; } [-0.9, -0.3, 0.35, 0.95].forEach((x, i) => placeInto(p, part(poster, { i, dark: i === 1, y: 0.6 }), { at: [x, 0, 0] })); return p; }),
  cabinBunks: entry('cabinBunks', 'Bunks: berths, 2-high', 'wall', [2, 1.9, 1.1], bunkStack),
  cabinCrewLocker: entry('cabinCrewLocker', 'Bunks: locker', 'wall', [0.5, 2.0, 0.5], crewLocker),
  cabinStarScreen: entry('cabinStarScreen', 'Star screen, 8-sided', 'wall', [0.7, 0.4, 0.05], (p, o) => placeInto(p, part(starScreen, o), { at: [0, 0.3, 0] })),
  cabinLabBench: entry('cabinLabBench', 'Lab: bench', 'wall', [1.5, 1.3, 0.5], (p, o) => { labBench(p, o); if (o.things) { placeInto(p, part(glovebox, {}), { at: [-0.48, 0.9, 0.05] }); placeInto(p, part(microscope, {}), { at: [-0.12, 0.9, 0.24], rot: [0, 0.4, 0] }); placeInto(p, part(vialRack, { seed: 1 }), { at: [0.42, 0.9, 0.16] }); placeInto(p, part(tablet, {}), { at: [0.12, 0.9, 0.37], rot: [0, -0.25, 0] }); } return p; }),
  cabinSurveyTable: entry('cabinSurveyTable', 'Lab: survey table', 'wall', [1.0, 0.95, 1.25], surveyTable),
  cabinSampleCase: entry('cabinSampleCase', 'Lab: SAMPLES case', 'wall', [1.5, 1.8, 0.25], sampleCase),
  cabinLabStool: entry('cabinLabStool', 'Lab: stool', 'free', [0.46, 0.95, 0.46], labStool),
};
