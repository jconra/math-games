// THE MEDIC'S ROOMS' FITTINGS, as catalog pieces for the Kit Lab's Ship parts tab (kit/catalog.js's format, as
// fit.cat.js's: group 'Ship cabin', at 'free', variants (named presets of the part's options), foot [w, h, d], mount
// 'wall' | 'ceiling' | 'free'). The Medic's own furnishing (kit/ships/medic-furnish.js) calls the parts with the sizes
// its plan gives; these are the same parts at sample sizes.
import * as MB from './medbay.js';
import * as ML from './medlab.js';
import * as MC from './medcrew.js';
import { ambulanceStretcher, stowedStretcher } from './stretcher.js';
import { hisMask, cylMask } from './gasmask.js';
import { segText } from './segtext.js';
import { FACE } from './ship.js';

const PRESETS = {
  medicStretcher: { 'back raised': {}, flat: { back: 0 }, 'rails down': { rails: 'down', back: 0.25 }, docked: { legs: 'none', frame: 0.66, pillow: true } },
  medicStowedStretcher: { 'on the wall': {} },
  medicPatientBed: { 'stretcher on its base': { label: 'MED-01' }, flat: { back: 0, label: 'MED-02' } },
  medicArmLamp: { parked: {} },
  medicPouches: { 'his wall': {}, 'one panel': { one: true } },
  medicTrauma: { bag: {} },
  medicTanks: { two: {} },
  medicAxe: { 'in its clips': {} },
  medicDefib: { 'on its bracket': {} },
  medicSpineBoard: { 'on two brackets': {} },
  medicHazmat: { 'glass door': {} },
  medicMasks: { 'his model and from cylinders': {}, 'his model': { only: 'his' }, 'from cylinders': { only: 'cyl' } },
  medicXray: { 'chest and hand': {} },
  medicVitals: { live: { live: 'rest' }, still: {} },
  medicIV: { 'two bags, two pumps': {} },
  medicBedHead: { panel: {} },
  medicCabinet: { 'hung high': {} },
  medicDrugs: { 'locked cabinet': {} },
  medicSupplies: { rack: {} },
  medicLabShelves: { 'over a bench': {} },
  medicIsland: { 'with its gear': {} },
  medicCrewBed: { 'third bed': {} },
  medicBunkStep: { step: {} },
  medicCubby: { 'two niches': {} },
  medicBusyWall: { 'wiring, switches, gauges': {} },
  medicLettering: { 'segment letters': {} },
};
const entry = (id, name, mount, foot, fn) => ({ name, group: 'Ship cabin', at: 'free', mount, variants: Object.keys(PRESETS[id]), foot, build: (p, v) => fn(p, PRESETS[id][v] ?? {}) });
export const MEDIC_FIT = {
  medicStretcher: entry('medicStretcher', 'Medic: ambulance stretcher', 'free', [0.8, 1.2, 2.2], ambulanceStretcher),
  medicStowedStretcher: entry('medicStowedStretcher', 'Medic: stretcher folded on the wall', 'wall', [0.7, 2.2, 0.4], (p) => stowedStretcher(p, { len: 1.8, w: 0.5, y0: 0.16 })),
  medicPatientBed: entry('medicPatientBed', 'Medic: patient bed (stretcher on its base)', 'wall', [1.0, 1.4, 2.1], (p, o) => MB.patientBed(p, { len: 2.0, ...o })),
  medicArmLamp: entry('medicArmLamp', 'Medic: lamp on an arm', 'ceiling', [1.0, 2.5, 0.6], (p) => MB.armLamp(p, { ceil: 2.5, head: [0.55, 1.98, -0.04], drop: 1.13 })),
  medicPouches: entry('medicPouches', 'Medic: strap-pouch panels', 'wall', [1.2, 2.0, 0.15], (p, o) => {
    if (o.one) return MB.pouchPanel(p, { label: 'AIRWAY', kind: 'airway', y0: 1.0, w: 0.36, h: 0.45 });
    [['AIRWAY', 'airway'], ['IV / FLUIDS', 'fluids'], ['MEDS', 'meds']].forEach(([label, kind], k) => MB.pouchPanel(p, { x: -0.37 + k * 0.37, label, kind, y0: 1.47, w: 0.35, h: 0.45 }));
    [['WOUND CARE', 'wound'], ['DIAGNOSTICS', 'diag'], ['TOOLS', 'tools']].forEach(([label, kind], k) => MB.pouchPanel(p, { x: -0.37 + k * 0.37, label, kind, y0: 0.98, w: 0.35, h: 0.45 }));
    MB.traumaBag(p, { x: -0.37, y0: 0.5, w: 0.34, h: 0.4, d: 0.13 }); MB.pouchPanel(p, { x: 0, label: 'O2', kind: 'o2', y0: 0.5, w: 0.35, h: 0.44, rows: 1 }); MB.pouchPanel(p, { x: 0.37, label: 'MASKS', kind: 'masks', y0: 0.5, w: 0.35, h: 0.44, rows: 1 });
    return p;
  }),
  medicTrauma: entry('medicTrauma', 'Medic: trauma bag', 'wall', [0.4, 0.5, 0.2], (p) => MB.traumaBag(p, { y0: 0.05 })),
  medicTanks: entry('medicTanks', 'Medic: oxygen tanks', 'wall', [0.5, 1.2, 0.25], (p) => { MB.o2Tank(p, { x: -0.11 }); return MB.o2Tank(p, { x: 0.11 }); }),
  medicAxe: entry('medicAxe', 'Medic: fire axe', 'wall', [0.3, 1.0, 0.08], (p) => MB.fireAxe(p, { y0: 0.05 })),
  medicDefib: entry('medicDefib', 'Medic: defibrillator', 'wall', [0.5, 0.4, 0.2], (p) => MB.defib(p, { y0: 0.05 })),
  medicSpineBoard: entry('medicSpineBoard', 'Medic: spine board', 'wall', [1.9, 0.5, 0.1], (p) => MB.spineBoard(p, { y0: 0.05 })),
  medicHazmat: entry('medicHazmat', 'Medic: hazmat locker', 'wall', [0.5, 2.1, 0.3], (p) => MB.hazmatLocker(p, { w: 0.46, h: 2.08, cut: [0.07, 0] })),
  medicMasks: entry('medicMasks', 'Medic: gas masks', 'wall', [0.6, 0.3, 0.2], (p, o) => { if (o.only !== 'cyl') hisMask(p, { size: 0.24, at: [o.only ? 0 : -0.15, 0.02, FACE] }); if (o.only !== 'his') cylMask(p, { size: 0.24, at: [o.only ? 0 : 0.15, 0.02, FACE] }); return p; }),
  medicXray: entry('medicXray', 'Medic: x-ray viewer', 'wall', [0.8, 0.8, 0.12], (p) => MB.xrayViewer(p, { y0: 0.08, w: 0.66, h: 0.56 })),
  medicVitals: entry('medicVitals', 'Medic: vital signs monitor', 'wall', [0.55, 0.4, 0.1], (p, o) => MB.vitalsMonitor(p, { y: 0.2, w: 0.44, h: 0.28, ...o })),
  medicIV: entry('medicIV', 'Medic: IV bags and pumps', 'wall', [0.35, 1.1, 0.15], (p) => MB.ivStation(p, { y0: 0.02, top: 1.0 })),
  medicBedHead: entry('medicBedHead', 'Medic: bed head panel', 'wall', [0.6, 0.3, 0.08], (p) => MB.bedHead(p, { y0: 0.02, w: 0.56 })),
  medicCabinet: entry('medicCabinet', 'Medic: shallow lockers hung high', 'wall', [1.2, 0.6, 0.25], (p) => MB.wallCabinet(p, { x0: -0.55, x1: 0.55, y0: 0.05, y1: 0.55, cut: [0.05, 0.06] })),
  medicDrugs: entry('medicDrugs', 'Medic: drugs cabinet (locked)', 'wall', [0.8, 2.0, 0.3], (p) => ML.drugsCabinet(p, {})),
  medicSupplies: entry('medicSupplies', 'Medic: supplies rack', 'wall', [1.4, 1.9, 0.3], (p) => ML.suppliesRack(p, {})),
  medicLabShelves: entry('medicLabShelves', 'Medic: lab shelves', 'wall', [1.0, 0.7, 0.3], (p) => ML.labShelves(p, { y0: 0.05, y1: 0.65 })),
  medicIsland: entry('medicIsland', 'Medic: lab island with its gear', 'free', [0.8, 1.2, 1.1], (p) => {
    ML.labIsland(p, {}); const q = (fn, o, at, rot) => { const r = new p.constructor(); fn(r, o); for (const pt of r.parts) { pt.geo.rotateY(rot || 0); pt.geo.translate(...at); p.parts.push(pt); } p.lights.push(...r.lights.map((l) => ({ ...l, at: [l.at[0] + at[0], l.at[1] + at[1], l.at[2] + at[2]] }))); };
    q(ML.centrifuge, {}, [-0.15, 0.9, -0.25]); q(ML.analyser, {}, [0.17, 0.9, -0.22], Math.PI / 2); q(ML.standScreen, { live: 'rest' }, [0.16, 0.9, 0.36], Math.PI / 2 + 0.4);
    return p;
  }),
  medicCrewBed: entry('medicCrewBed', 'Medic: the third crew bed', 'wall', [2.0, 1.0, 1.0], (p) => MC.singleBed(p, {})),
  medicBunkStep: entry('medicBunkStep', 'Medic: step along the bunk', 'wall', [2.0, 0.35, 0.3], (p) => MC.bunkStep(p, {})),
  medicCubby: entry('medicCubby', 'Medic: cubby at the bunks\' head', 'wall', [1.0, 1.9, 0.5], (p) => MC.cubby(p, { w: 1.0, depth: 0.5, h: 1.9, face: 1, free: [0.3, 0.47] })),
  medicBusyWall: entry('medicBusyWall', 'Medic: engineering wall (wiring cards, switches, gauges)', 'wall', [1.8, 2.1, 0.15], (p) => {
    MC.wireCard(p, { y0: 1.7, w: 1.6, h: 0.28, n: 7, seed: 0.1, tag: 'BUS A' }); for (let i = 0; i < 4; i++) MC.switchBox(p, { x: -0.6 + i * 0.4, y0: 1.12, w: 0.36, h: 0.32, seed: i * 0.13, label: i ? null : 'PUMPS' });
    for (let i = 0; i < 4; i++) MC.gauge(p, { x: -0.6 + i * 0.4, y: 1.6, a: 0.2 + i * 0.2 }); MC.wireCard(p, { y0: 0.62, w: 1.6, h: 0.36, n: 9, seed: 0.5 }); MC.switchBox(p, { y0: 0.18, w: 0.9, h: 0.34 });
    MC.conduit(p, { a: [-0.82, 0.1], b: [-0.82, 2.0] }); return MC.conduit(p, { a: [0.82, 0.1], b: [0.82, 2.0], look: 'yellow' });
  }),
  medicLettering: entry('medicLettering', 'Medic: segment lettering', 'wall', [1.0, 0.4, 0.02], (p) => { segText(p, 'ABCDEFGHIJKLM', { h: 0.05, at: [0, 0.3, FACE] }); segText(p, 'NOPQRSTUVWXYZ', { h: 0.05, at: [0, 0.2, FACE] }); return segText(p, '0123456789 / - + . :', { h: 0.05, at: [0, 0.1, FACE] }); }),
};
