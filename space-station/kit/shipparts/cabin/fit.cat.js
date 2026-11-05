// THE CABIN'S FITTINGS for the galley, washroom, med bay, engineering and science area, as catalog pieces (kit/catalog.js's
// format: group 'Ship cabin', at 'free', variants, foot [w, h, d] for the lab's framing, build(p, v)). Each variant is a
// named preset of its part's options (PRESETS below; a ship calls the part itself with the sizes it needs). `mount` says
// how it stands: 'wall' (z = 0 on a wall line), 'ceiling' (hangs from the ceiling) or 'free' (centred, standing free).
import { galleyCounter, fridge, dinette } from './galley.js';
import { toilet, basin, shower } from './wash.js';
import { medBed, scanner, pharmacy, stretcher } from './medical.js';
import { reactor } from './engine.js';
import { holoTable } from './science.js';

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
  cabinReactor: { upright: {}, drum: { form: 'drum' }, 'big drum': { form: 'drum', w: 1.8, len: 2.6 }, 'no pipes': { pipes: 0 } },
  cabinHolo: { terrain: {}, planet: { show: 'planet' }, console: { form: 'console' } },
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
};
