// THE SHIP PARTS: Ship outside (the hull pieces on the ship grid, engines, wings and fins, windows, landing legs,
// doors, ramps and hatches, the outside details and each job's gear), as the Kit Lab's "Ship parts" tab shows them.
// Each entry is a catalog piece (kit/catalog.js's format: group 'Ship outside', at, variants, foot [w, h, d] for the
// lab's framing, build(p, v)). The hull pieces snap to a ship's grid (kit/grid.js SHIP_GRID) in a ship's layout file;
// they take any of their shapes with any paint (`accepts`), the variants below are the ones the lab shows. The free
// parts are each built from this family's part functions (kit/shipparts/outside/*), which the ships call directly
// with their own sizes and place with place.js, or name here by variant.
import { hullPanel, hullSlope, hullAngle, hullCorner, hullCap, hullOpening, ACCEPTS } from './outside/hull.js';
import { mainEngine, enginePod, thruster, thrusterPod } from './outside/engines.js';
import { wing, stubWing, tailFin } from './outside/wings.js';
import { landingLeg } from './outside/legs.js';
import { sideDoor, airlockHatch, ramp, bellyLift } from './outside/ways.js';
import { navLight, floodlight, lightStrip, antenna, sensorDish, vent, greeble } from './outside/details.js';
import { canister, laserArm, scoop, medicMark } from './outside/jobgear.js';
import { Piece } from '../piece.js';
import { placeInto } from './place.js';

// a variant's words as options: 'miner parked' -> { r: 1.35, len: 2.2, sides: 24, band: 'grey', lit: false }
const ENGINE_V = { 'medic': { r: 1.1, len: 1.9 }, 'miner': { r: 1.35, len: 2.2, sides: 24, band: 'grey' }, 'explorer': { r: 0.95, len: 1.7, sides: 24 }, 'parked': { lit: false }, 'dark': { band: null }, 'yellow': { band: 'yellow' } };
const optsOf = (v, table) => v.split(' ').reduce((o, w) => ({ ...o, ...(table[w] || {}) }), {});
const THRUSTER_V = { top: { mount: 'top' }, side: { mount: 'side' }, under: { mount: 'under' }, jet: { plume: true }, 'left': { yaw: 90 }, 'right': { yaw: -90 }, 'back': { yaw: 180 }, 'up': { pitch: 45 }, 'down': { pitch: -45 }, 'tilt': { yaw: 35, pitch: 25 } };

// parts drawn for the hull's +x side (wings, pylons, arms, canister feet): ' mirrored' after any variant is the same
// part for the -x side (place.js turns its faces back the right way out); a wing's or fin's red light turns green
const mirrorable = (def) => {
  const build = def.build, base = def.variants;
  def.build = (p, v) => {
    if (!/ mirrored$/.test(v)) return build(p, v, false);
    const q = new Piece(); build(q, v.replace(/ mirrored$/, ''), true); return placeInto(p, q, { scale: [-1, 1, 1] });
  };
  def.accepts = (v) => base.includes(v.replace(/ mirrored$/, ''));
  def.variants = [...base, base[0] + ' mirrored'];
  return def;
};

const G = 'Ship outside';
export const OUTSIDE = {
  hullPanel: { name: 'Hull panel', group: G, at: 'edge', foot: [2, 1, 0.5], build: hullPanel, accepts: ACCEPTS.hullPanel,
    variants: ['x1', 'x2', 'x4', 'x4 h2', 'x4 ystripe', 'x4 rstripe', 'x4 tstripe', 'x4 h2 yslash', 'x4 grey', 'x4 dark', 'x4 h2 seams', 'x4 h2 edged', 'roof x4', 'belly x4 grey', 'roof tri 1:1', 'roof tri 2:1'] },
  hullSlope: { name: 'Hull slope', group: G, at: 'edge', foot: [2, 1, 1], build: hullSlope, accepts: ACCEPTS.hullSlope,
    variants: ['up 1:1 x4', 'up 1:1 x4 edged', 'up 1:2 x4', 'up 2:1 x4', 'down 1:1 x4', 'down 1:2 x4', 'down 2:1 x4', 'up 1:1 x4 ystripe', 'up 2:1 x4 glass', 'dslope up 1:1 plan 1:1', 'dslope down 1:1 plan 1:1'] },
  hullAngle: { name: 'Angled side', group: G, at: 'edge', foot: [1, 1, 1], build: hullAngle, accepts: ACCEPTS.hullAngle,
    variants: ['1:1 h1', '1:2 h1', '2:1 h1', '1:1 h2 ystripe', '1:1 h1 L'] },
  hullCorner: { name: 'Hull corner', group: G, at: 'point', foot: [1, 1, 1], build: hullCorner, accepts: ACCEPTS.hullCorner,
    variants: ['hip up 1:1', 'hip up 2:1', 'hip up 1:2', 'hip up 2:1/1:1', 'hip down 1:1', 'valley up 1:1', 'valley down 1:1', 'gable up 1:1', 'gable up 2:1', 'gable up 1:1 L', 'gable down 1:1'] },
  hullCap: { name: 'Nose and tail', group: G, at: 'edge', foot: [5, 4, 3], build: hullCap, accepts: ACCEPTS.hullCap,
    variants: ['nose sample canopy', 'nose sample blunt', 'nose sample wedge', 'tail sample flat', 'tail sample taper', 'nose medic canopy', 'nose explorer wedge', 'nose miner blunt', 'tail hauler flat mouth 9x5'] },
  hullOpening: { name: 'Hull opening', group: G, at: 'edge', foot: [2, 2.5, 0.5], build: hullOpening, accepts: ACCEPTS.hullOpening,
    variants: ['door', 'door h4', 'door x4', 'window x2', 'window x4', 'porthole', 'mouth 6x5', 'hatch 2', 'hatch 3'] },
  // engines: the main engine's front face goes against the tail (the drum runs back along -z)
  mainEngine: { name: 'Main engine', group: G, at: 'free', foot: [2.4, 2.4, 2], build: (p, v) => mainEngine(p, optsOf(v, ENGINE_V)), accepts: (v) => v.split(' ').every((w) => ENGINE_V[w]),
    variants: ['medic', 'medic parked', 'miner', 'explorer', 'medic yellow'] },
  enginePod: mirrorable({ name: 'Engine pod', group: G, at: 'free', foot: [1.4, 1.2, 2.7], build: (p, v) => enginePod(p, { ...optsOf(v, { yellow: { band: 'yellow' }, parked: { lit: false }, big: { r: 0.8, len: 3.2 }, round: { sides: 24 } }), pylon: v.includes('pylon') ? { side: -1, len: 0.6 } : null }),
    variants: ['pylon', 'plain', 'yellow pylon', 'big round', 'parked'] }),
  // manoeuvring thrusters: a pod on a mount, the pod turned on its pivot (yaw, pitch), its jet on or off
  thruster: { name: 'Thruster', group: G, at: 'free', foot: [0.8, 1.2, 1], build: (p, v) => thruster(p, optsOf(v, THRUSTER_V)), accepts: (v) => v.split(' ').every((w) => THRUSTER_V[w]),
    variants: ['top', 'top jet', 'top left jet', 'top back', 'top up jet', 'top tilt jet', 'side', 'side down jet', 'under', 'under right jet'] },
  thrusterPod: { name: 'Thruster pod', group: G, at: 'free', foot: [0.6, 0.5, 0.7], build: (p, v) => thrusterPod(p, { plume: v === 'jet' }), variants: ['off', 'jet'] },
  // wings and fins (drawn for the +x side; the -x side is the same part mirrored, with its own light)
  wing: mirrorable({ name: 'Wing', group: G, at: 'free', foot: [3.4, 0.4, 3.6], variants: ['swept', 'delta', 'red stripe'],
    build: (p, v, m) => wing(p, { ...(v.includes('delta') ? { root: 3.4, tip: 0.5, span: 2.6, sweep: 2.8 } : {}), ...(m ? { light: 'green' } : {}), ...(v.includes('red stripe') ? { stripe: 'red' } : {}) }) }),
  stubWing: mirrorable({ name: 'Stub wing', group: G, at: 'free', foot: [1.4, 0.5, 2], variants: ['plain', 'red stripe'], build: (p, v) => stubWing(p, v === 'red stripe' ? { stripe: 'red' } : {}) }),
  tailFin: { name: 'Tail fin', group: G, at: 'free', foot: [0.3, 1.1, 2.2], variants: ['tall', 'twin', 'red stripe'],
    build: (p, v) => tailFin(p, v === 'twin' ? { root: 1.5, tip: 0.6, span: 0.9, sweep: 0.9 } : v === 'red stripe' ? { stripe: 'red' } : {}) },
  landingLeg: { name: 'Landing leg', group: G, at: 'free', foot: [0.8, 1.3, 0.8], variants: ['short', 'long', 'wide pad'],
    build: (p, v) => landingLeg(p, v === 'long' ? { len: 1.3, out: 0.45 } : v === 'wide pad' ? { pad: 1.1 } : {}) },
  // ways in: each fits a hull opening, placed on the same point as it
  sideDoor: { name: 'Side door', group: G, at: 'free', foot: [1.2, 2.3, 2], variants: ['fold', 'fixed', 'none'], build: (p, v) => sideDoor(p, { steps: v }) },
  airlockHatch: { name: 'Airlock hatch', group: G, at: 'free', foot: [1.6, 2.5, 0.4], variants: ['outer'], build: (p) => airlockHatch(p) },
  shipRamp: { name: 'Ramp', group: G, at: 'free', foot: [4.5, 2.5, 4.2], variants: ['back', 'side'], build: (p, v) => ramp(p, v === 'side' ? { w: 2.9 } : { w: 4.4 }) },
  bellyLift: { name: 'Belly lift', group: G, at: 'free', foot: [1.6, 1.3, 1.6], variants: ['lift'], build: (p) => bellyLift(p) },
  // details on the hull
  navLight: { name: 'Nav light', group: G, at: 'free', foot: [0.3, 0.2, 0.2], variants: ['red', 'green', 'white'], build: (p, v) => navLight(p, { color: v }) },
  floodlight: { name: 'Floodlight', group: G, at: 'free', foot: [0.6, 0.3, 0.2], variants: ['warm', 'white', 'wide'], build: (p, v) => floodlight(p, v === 'white' ? { warm: false } : v === 'wide' ? { w: 0.8, h: 0.14 } : {}) },
  lightStrip: { name: 'Light strip', group: G, at: 'free', foot: [1, 0.2, 0.1], variants: ['1 m', '2 m'], build: (p, v) => lightStrip(p, { len: parseFloat(v) }) },
  antenna: { name: 'Antenna', group: G, at: 'free', foot: [0.3, 1.1, 0.3], variants: ['mast', 'short'], build: (p, v) => antenna(p, { h: v === 'short' ? 0.5 : 1.0 }) },
  sensorDish: { name: 'Sensor dish', group: G, at: 'free', foot: [0.8, 0.9, 0.8], variants: ['small', 'big'], build: (p, v) => sensorDish(p, { r: v === 'big' ? 0.5 : 0.32 }) },
  hullVent: { name: 'Vent', group: G, at: 'free', foot: [0.8, 0.4, 0.1], variants: ['small', 'wide'], build: (p, v) => vent(p, v === 'wide' ? { w: 1.2, h: 0.24 } : {}) },
  hullGreeble: { name: 'Machinery panel', group: G, at: 'free', foot: [0.9, 0.5, 0.2], variants: ['box', 'pipes', 'panel'], build: (p, v) => greeble(p, { kind: v }) },
  // each job's gear
  canister: mirrorable({ name: 'Ore canister', group: G, at: 'free', foot: [2.2, 4, 4.6], variants: ['stack', 'single'], build: (p, v) => canister(p, { stack: v === 'stack' ? 2 : 1 }) }),
  laserArm: mirrorable({ name: 'Laser arm', group: G, at: 'free', foot: [1.5, 2, 4], variants: ['folded', 'working'], build: (p, v) => laserArm(p, { pose: v }) }),
  scoop: { name: 'Ore scoop', group: G, at: 'free', foot: [2.5, 0.7, 1.8], variants: ['scoop'], build: (p) => scoop(p) },
  medicMark: { name: 'Medical mark', group: G, at: 'free', foot: [1.7, 0.7, 0.1], variants: ['plate', 'stripe'], build: (p, v) => medicMark(p, { kind: v }) },
};
