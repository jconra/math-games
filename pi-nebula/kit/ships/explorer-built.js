// EXPLORER C, BUILT: the ship's own parts, on the 3,000-triangle smart mesh made from the game's maker's picture. The
// hull is that mesh as it is (cleaned only where it had to be: its data is explorer-built.hull.js, made by the rig
// ~/pw/space-math/rigs/explorer-built/makehull.mjs); its landing legs are cut from the 8,000-triangle one. Everything
// is painted in flat colours from a small palette, face by face, by the rules below (so every colour line falls on an
// edge of the model), and a grime material (grimeMaterials, at the end) adds the dirt over that clean base.
// The ship itself is the layout file kit/rooms/ship-explorer-built.json; these are the catalog pieces it names
// (group 'Ships'). Frame: nose +z, the ship's left (port) +x; each piece is drawn standing on the cabin's deck (y 0 at
// DECK, 1.74 m off the ground: the doorway's sill), centred on the ship's middle (x 0, z 0).
//   ebHull       'hull'      the 3k hull, painted by RULES (and ZONES, which split a few faces where a colour line
//                            must cross one: the dark lower band, the wings' flaps and yellow tips, the fins' rudders
//                            and stripes, the engines' blue rings); and the engines' nozzles, cut from the 8k, their
//                            cores dark metal (the jet's colour and glow are plume.js's, laid in each nozzle:
//                            jetNozzles)
//   ebCanopy     'glass'     its canopy: nine panes of smoked glass (three down each side, three over the top), one
//                            straight black spar along each border between them and a wider one round the sill: all
//                            one part, the spar, placed again and again
//   ebMarks      'marks'     what is laid on the skin: the blue light strips, the nose's lamps, the yellow marks by the
//                            door, the nav lights
//   ebDoorway    'port' / 'starboard'   a doorway's sides and sill; port: the airlock behind it (its floor, walls,
//                            ceiling and inner door); starboard: the sealed hatch in it
//   ebAirstair   'port'      the airstair door: one panel hinged at its foot, its steps and side rails on its inside
//                            face; it swings out and down to the ground as someone comes near (a kit door)
//   ebGear       'nose' / 'port' / 'starboard'   a landing leg (its strut, and its foot, which turns at the ankle as it
//                            folds into its well): kit door leaves on hinges, door 'gear' (no one opens it by walking
//                            up: the game, or the lab's Gear up / down, moves it)
//   ebGearDoors  'nose' / 'port' / 'starboard'   a well's two doors: the belly skin cut out of it, hinged at its edges
//   ebWells      'wells'     the three wells' walls and ceilings
//   ebCockpit    'two seats' the cockpit: two bucket seats side by side, the throttle pedestal between them, the
//                            dashboard and side consoles, under the canopy, in its tub (floor, walls up to the sill,
//                            the bulkhead behind)
// The machinery the built ships share (painting by face, the canopy's panes and spars, the tub, the gear and its pods,
// the throttle, the grime) is in built-common.js; this file holds Explorer C's own data and pieces.
import * as THREE from 'three';
import { Acc } from '../shipparts/outside/facet.js';
import { part } from '../shipparts/place.js';
import { GLOW_SHIP } from '../shipparts/palette.js';
import { SURF } from '../materials.js';
import { HULL, GEAR, DOORS, WELLS, JAMBS, DOOR, PARTS, Q } from './explorer-built.hull.js';
import * as C from './built-common.js';
export { THROTTLE, ENGINE, setThrottle } from './built-common.js';

const PI = Math.PI, V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const DECK = DOOR.sill;   // the cabin's deck, metres off the ground (the doorway's sill)

// ── THE PALETTE: flat colours (sRGB), each with its roughness, metalness and wear (wear: how much grime it takes;
// 'edge' versions of a colour take more, for the thin faces along exposed edges) ─────────────────────────────────────
const s = (c, r, m, w) => ({ c, r, m, w });
export const PAL = {
  skin: s('#dedcd5', 0.5, 0.04, 0.45),       // white skin
  skinEdge: s('#dedcd5', 0.5, 0.04, 1.0),
  black: s('#1c1e22', 0.42, 0.3, 0.35),      // window spars, flaps, rudders
  blackEdge: s('#1c1e22', 0.42, 0.3, 0.9),
  belly: s('#80858c', 0.55, 0.2, 0.7),       // the grey belly
  trim: s('#3a3e44', 0.48, 0.3, 0.55),       // dark trim: the lower sides, the roof modules' sides, the engines
  trimEdge: s('#3a3e44', 0.48, 0.3, 1.0),
  yellow: s('#e8b923', 0.45, 0.02, 0.45),    // his yellow accents
  metal: s('#6d7177', 0.4, 0.6, 0.6),        // the landing legs' struts
  rubber: s('#202225', 0.85, 0.0, 0.5),      // the feet's pads
  inner: s(SURF.white[0], SURF.white[1], SURF.white[2], 0.35),   // inside: the station's own off-white
  deck: s('#55595f', 0.6, 0.3, 0.6),         // the airlock's and cockpit's floors
};
export const GLOW = { strip: GLOW_SHIP.strip, nozzle: [0.1, 0.7, 1.8], ring: [0.4, 2.8, 6.4], warm: GLOW_SHIP.warm, red: [6.0, 0.5, 0.3], green: [0.5, 5.0, 1.4], white: [4, 4, 4] };

// ── the data, decoded once ──────────────────────────────────────────────────────────────────────────────────────────
const { bytes, at, tnorm } = C, mesh = (d) => C.decodeMesh(d, Q);
// (a point in the ship's frame to the pieces' frame: on the deck)
const dk = C.deckOf(DECK);
// (the shared shapes, placed by this ship's deck)
const polyTo = (acc, pts, n, surf, mat = 'solid') => C.polyTo(acc, pts, n, surf, mat, dk);
const boxAt = (acc, c, axes, halves, surf, skip = []) => C.boxAt(acc, c, axes, halves, surf, skip, dk);

// ── PAINTING THE HULL ───────────────────────────────────────────────────────────────────────────────────────────────
// (the fin's edges, measured on the 3k's port fin, in its own (z, y) plane: the leading edge runs from (z -2.97, y 4.58)
// up and back to (-5.30, 6.20), the trailing edge from (-5.97, 4.60) to (-6.91, 6.25); le and te are the constants of
// the lines along them: behind the leading edge by d where 0.821 y + 0.571 z = le - d, ahead of the trailing edge by
// d where 0.495 y + 0.869 z = d - te)
const FIN = { le: 0.821 * 4.58 + 0.571 * -2.97, te: -(0.495 * 4.6 + 0.869 * -5.97) };
// ZONES first: where a colour line must cross a face, the faces of those parts are cut along the zone's planes, and
// what lies inside them all is in that zone (for the rules below). Each plane is [a, b, c, d]: inside where
// a|x| + b y + c z <= d (|x|: both sides of the ship alike). A later zone may take a piece from an earlier one.
export const ZONES = [
  // the hull's lower band: everything under a line from 2.63 m at the stern down to 2.14 m at the nose's tip, his dark
  // lower hull under the white (one straight colour line along each side)
  { zone: 'lower', parts: ['body', 'keel', 'other'], planes: [[0, 1, 0.035, 2.42]] },
  // the wings: a black flap along the trailing edge (0.85 to 1.1 m deep), a yellow tip ahead of it
  { zone: 'flap', parts: ['wing'], planes: [[0, 0, 1, -5.35]] },
  { zone: 'tip', parts: ['wing'], planes: [[-1, 0, 0, -5.75], [0, 0, -1, 5.35]] },
  // the fins: the black rudder, 0.55 m deep along the trailing edge (TE: how far ahead of it, along its normal in the
  // fin's plane); two yellow stripes along the leading edge, his "//" (LE: how far behind it), stopping short of the
  // rudder
  { zone: 'rudder', parts: ['fin'], planes: [[0, 0.495, 0.869, -FIN.te + 0.55]] },
  ...[[0.42, 0.56], [0.7, 0.84]].map(([a, b]) => ({ zone: 'stripe', parts: ['fin'], planes: [[0, 0.821, 0.571, FIN.le - a], [0, -0.821, -0.571, b - FIN.le], [0, -0.495, -0.869, FIN.te - 0.65]] })),
  // the engines: a glowing blue ring round each, a hand's width ahead of the taper
  { zone: 'ring', parts: ['engine'], planes: [[0, 0, 1, -7.58], [0, 0, -1, 7.76]] },
];
// RULES then, for every face in order: the first that matches paints it. f: { part, zone, n (unit normal), c (centre),
// area, thin (a narrow face: an edge strip) }
const edge = (paint) => (f) => (f.thin ? paint + 'Edge' : paint);
export const RULES = [
  // (the canopy's own faces: glass where a pane covers them (ebCanopy draws it); the rest is its frame, black, but for
  // the flaps that hang down the hull's sides from the shelf along the sill, or face out sideways low at its back, and the
  // strip under the windscreen's foot, down to the nose: white, the nose's skin; and any of the hull's own faces a pane
  // covers (a bump on the roof under the glass) go too)
  ['the canopy: glass, its frame', (f) => f.part === 'canopy', (f) => (canopyPanes().covers(f.c) ? 'glass' : (Math.abs(f.n.x) > 0.75 && f.c.y < 4.2) || (Math.abs(f.c.x) > 1.2 && f.pts.some((v) => v.y < 2.6)) || f.c.z > 7.45 ? edge('skin')(f) : edge('black')(f))],
  ['under the canopy\'s glass: gone', (f) => canopyPanes().covers(f.c, 0.12), 'glass'],
  ['engines: their backs, behind the blue ring: gone (the 8k\'s nozzles take their place: ebHull)', (f) => f.part === 'engine' && f.c.z < NOZZLE.cut, 'gone'],
  ['engines: the blue ring', (f) => f.zone === 'ring', 'ring'],
  ['engines and their pylons: dark', (f) => f.part === 'engine' || f.part === 'pylon', edge('trim')],
  ['wings: the flaps black', (f) => f.zone === 'flap', edge('black')],
  ['wings: the tips yellow', (f) => f.zone === 'tip', 'yellow'],
  ['wings: undersides grey', (f) => f.part === 'wing' && f.n.y < -0.35, 'belly'],
  ['wings: edges dark', (f) => f.part === 'wing' && Math.abs(f.n.y) < 0.35, 'trimEdge'],
  ['fins: the rudders black', (f) => f.zone === 'rudder', edge('black')],
  ['fins: the stripes yellow', (f) => f.zone === 'stripe', 'yellow'],
  ['fins: edges dark', (f) => f.part === 'fin' && f.thin, 'trimEdge'],
  ['the belly: grey', (f) => f.n.y < -0.55 && f.part !== 'roof', 'belly'],
  ['the lower band: dark', (f) => f.zone === 'lower', edge('trim')],
  ['the roof modules\' sides: dark', (f) => f.part === 'roof' && f.n.y < 0.55, edge('trim')],
  ['the small blocks: dark', (f) => f.part === 'keel' || f.part === 'other', 'trim'],
  ['everything else: white skin', () => true, edge('skin')],
];

let FACES = null;
// the hull's faces, cut by the zones and painted (built-common.js paintFaces): [{ pts: [A, B, C] (ship frame), n, c,
// part, zone, paint }]
export function hullFaces() {
  if (FACES) return FACES;
  FACES = C.paintFaces(mesh(HULL), new Uint8Array(bytes(HULL.part)), PARTS, ZONES, RULES);
  return FACES;
}
// a face's paint as a surface for the solid material, or a glow (faces 'glass' and 'gone' are drawn by others)
const GLOWS = { ring: GLOW.ring };
const drawn = (f) => f.paint !== 'glass' && f.paint !== 'gone';
function ebHull(p) {
  const acc = new Acc();
  // (each face's back, dark, where a crack in the skin lets its inside be seen)
  C.drawFaces(acc, hullFaces(), { PAL, GLOWS, dk, backSurf: PAL.trim });
  for (const side of [1, -1]) nozzle(acc, side);
  acc.flush(p);
  return p;
}

// ── THE ENGINES' NOZZLES ────────────────────────────────────────────────────────────────────────────────────────────
// The game's maker: "the back exhaust nozzles should use the 8k design. If flying in 3rd person the back of the ship is
// what you see." The 8k's port engine's back, cut off behind its last groove (z NOZZLE.cut, the back edge of the 3k's
// blue ring): its outside, its dark metal rim, the bowl recessed half a metre into it, and the core at the bowl's
// bottom; set on each of the 3k's engines in place of the 3k's own back (its faces behind the cut are gone), its
// radius fitted to the 3k's engine at the cut (the 8k's is 5% smaller there), the starboard one mirrored. A thin strip
// in the plane of the cut joins the 3k's ring of corners there to the 8k's.
// The game's maker: "For the engine exhaust the model should basically always be dark. It's the jet, which should be a
// fancy shader effect ... that actually has color and glow." So the nozzle is dark metal, its core too; the jet
// (plume.js, from his own afterburner) is laid in each nozzle by jetNozzles, and the throttle drives it.
// NOZZLE: made by ~/pw/space-math/rigs/explorer-built/rig/nozcut.mjs from the 8k (do not edit by hand): positions about
// the engine's own axis (int16, 2048 to the metre; z the ship's own), triangles (uint16), each face's kind: o its
// outside, r the rim, w the bowl's wall, f the core at its bottom
export const NOZZLE = { cut: -7.76, rCut: 1.0623, pos: '8vdZAtjBYPeQArTB8/bu/7TBhffu/9jB8fiOBNjBhPcFAOzB7fdZAuzB9/duAuzB7fiOBOzBCQYNBtjB5QRnB7TBnAQwB9jB0QYOBTe+EQb/BezBWwdsBOzBYwdqBMbBBwYOBuzBqAQnB+zBy/rnBje+SP14CLTBWv0dCDe+3/jpBDe+b/rnBrTBSvtDBkq9lfl8BDi9dwXR+LTBYwfP+rTB4wY8+9jB0QYF+ze++QJ397TBHAUZ+Te+QAVQ+djBwQT6Bje+jAKKCLTBaAIdCNjB3/ju/826OvnM/c26Fvju/zi9cfhZAji9OvkjAs26p/n/Ac26XvkAAM26EwB4COzB/P94CNjB/P96COzBf/0LCOrBgP0LCOzBf/0LCOzBZQXYA826+ANpBc26LwTEBc260gUhBM26UgYRAs26nQPqAyS/9wTIASS/cfiV/Ti9p/nw/c26J/rO+826hgi1ArTBBwiiAje+UgahBEq9yP0++c26Evy8+s26/v2r+c26Svur+Uq9yvtP+s26/P/1+M26kf2I+Eq9ov4Y+yS//P9i+c26Jfxf/CS//P/u/yS/oADh+iS/TggFAOzBUAju/9jB9QdZAtjB9gdZAuzBUgju/+zB6wduAuzBlPp6BtjBjfp3BuzBmfqDBuzBfv0KCOzB+vieBOzBDQJDBs26/P8eB826MQLVBs26/P+fBs26MgEyBSS/0Qbe/c26Ywen/Uq9UgZz+0q90gXO+826LAcAAM26ZQUX/M26Ugbw/c26YPdM/aLBhPjz+rTB8fhz++rBqfde/Te+zfgY+ze+YPeD/djB9AgAALTB+geZ/ezB9QeD/djB/P/CB0q9aAJnB0q9yP3DBs26lPqH+djBfvqX+ezB8fhy++zBgPwI+FnBNvwj+OzBqfpx+ezBb/rj+KLBjfqF+ezBFQUx+ezBRgVS+ezBUQVi+ezB7/om/yS/gfs1AiS/lPop/M26egIdCDe+/P94CDe+/P/lCLTBvgcAAEq9Yghx/Te+MQI++c26+gG9+c26eASr+Uq9hPjpBLTBqfeQAje+Tvfu/ze+c/eC/ezBcveD/erBcveD/ezBZQWT/yS/rwRx/SS/mgYAAM26kf1nB0q9SP1397TBkP5399jBiv529+zB0fzk9+zBlPrGA826OfoPBM26QQRP+s26aAKI+Eq9/P8a+Eq9DAO7+yS/+AO8+s26EvxXBc26yvvEBc26/v1DBs26tvzGAyS/ov7pBCS/0QY1As26eARWBkq9YwdsAji9BgkAADe+g/lg+0q9uPoZ+Te+hghM/bTBfQIXCOzBaAIgCOzB/P9k9ze+egLS9ze+/P8J97TB+QIa+NjB/P9399jB5QY8++zB7wZR++zBnQQzB+zBf/fu/+zBcveE/ezBbf3S9ze+9geD/ezB9AIU+OzBGwMk+OzBEwB39+zBtP539+zBm/5w9+zB', tris: 'AAABAAIAAAACAAMAAAAEAAEAAAADAAUAAAAFAAYAAAAGAAcAAAAHAAgAAAAIAAQACQAKAAsACQAMAAoACQANAA4ACQAOAA8ACQAPAAwACQAQAA0ACQALABEACQARABAAEgATABQAEgAVABYAEgAWABMAEgAUABcAEgAYABUAEgAXABgAGQAaABsAGQAcABoAGQAdAB4AGQAbAB8AGQAfAB0AGQAeABwACgAMACAACgAhACIACgAgACEACgAiAAsAIwAkACUAIwAlACYAIwAnACgAIwAoACkAIwAmACcAIwApACQAKgArACwALAArAC0ALAAtAC4ALgAtAC8AMAAxADIAMAAyADMAMAAzADQAMAA1ADEAMAA2ADUAMAA0ADYAJAA3ACUAJAA4ADkAJAApADgAJAA5ADcADAA6ADsADAA7ADwADAAPADoADAA8ACAAPQA+AD8APQBAAEEAPQBCAEMAPQBDAEAAPQA/AEIAPQBBAD4ARABFAD8ARABGAEcARABHAEgARAA/AEYARABIAEUASQBKAEsASQBLAEwATQBKAEkATABLAE4ATwBQAFEATwBRAFIATwBSAC0ATwATABYATwAWAAQATwAEAFMATwBTAFAATwAtABMAVABVAFYAVAAxADUAVABXAFUAVABYAFcAVAA1AFgAVABWADEAWQBaAFsAWQBbAFwAWQBdAFoAWQBcAF4AWQBfAF0AWQBeAF8AYABhAGIAYABjAGQAYABiAGUAYAACAGMAYABkAGEAYABlAAIASgBmAEsASgBNAGcASgBnAGgASgBoAGYAVQBpAGoAVQBXAGsAVQBqAFYAVQBrAGkAbABtAG4AbABuAGIAbABvAHAAbABwAHEAbABhAHIAbABiAGEAbABxAHMAbABzAG0AbAByAG8AdAAfAHUAdQAfAHYAdwB4AEcAdwBGAHkAdwBHAEYAdwB5ADgAdwA4ACkAdwApAHgAIQB6AHsAIQAgAHoAIQB7AHwAIQB8ACsAIQArACIAWgBdAH0AWgAcAFsAWgB+ABwAWgB9AH4ARQB/AEIARQCAAH8ARQBCAD8ARQBIAIAAWwAcAB4AWwCBAFwAWwAeAIEAAQCCAIMAAQCEAAIAAQAEAIIAAQCDAIQAhQCGAGIAhQBiAG4AhwCGAIUAiACJAEcAiABHADYAiAA2ADQAiAA0AIoAiACKAIkAaQB6AGoAaQCLAHsAaQB7AHoAaQBrAIsAUwAEAAgAMQBWADIAbwByAIwAbwCNAI4AbwCOAI8AbwCPAHAAbwCMAI0AJQCEAIMAJQA3AIQAJQCDACYAggAVAIMAggAWABUAggAEABYAOgAPAEsAOgBmADsAOgBLAGYAJwCQACgAJwCRAJAAJwAmABgAJwAYAJEAfwCSAJMAfwCAAJIAfwCTAJQAfwCUAEIAlQCJAF4AlQBHAIkAlQBeAJYAlQCWAEgAlQBIAEcATgBLAA8ATgAPAA4AlwCQAJEAlwCYAJkAlwCaAJAAlwCZAJsAlwCRAJgAlwCbAJoAXQBfAIoAXQCcAH0AXQCKAJwAPgBGAD8APgB5AEYAPgBBAHkAeACQAJoAeAAoAJAAeACaAEcAeAApACgAegAgAJ0AegCdAGoAVwBYAJkAVwCZAGsAhABjAAIAhAA3AGMAkgCAAJYAkgBcAIEAkgCBAJMAkgCWAFwAgABIAJYALwAtAFIAOwCeADwAOwBmAJ8AOwCfAJ4AMgBWAGoAMgCdADwAMgBqAJ0AMgA8ADMAQACgAEEAQABkAKAAQABDAKEAQAChAGQAGgAcAH4AGgB+AKIAGgBoABsAGgCiAGgAYQBkAKEAYQChAHIAEwB8ABQAEwAtAHwAngAzADwAngB9AJwAngCfAH0AngCcADMAYwCgAGQAYwA3AKAAowAiAKQApAAiACsApAArACoAWAA1AEcAWABHAJsAWACbAJkAiwCYABcAiwBrAJgAiwAUAHsAiwAXABQAkwClAJQAkwCBAKYAkwCmAKUApwClAKYApwAdAKgApwCMAKUApwCmAB0ApwCoAKkApwCpAIwAqgAbAKsAdgAfABsAdgAbAKoAoAA3ADkAoAA5AEEAiQBfAF4AiQCKAF8AEQALAKwArAALACIArAAiAKMAfgB9AJ8AfgCfAKIAZgBoAKIAZgCiAJ8AFQAmAIMAFQAYACYArQADAIYArQCGAK4ArgCGAIcABQADAK0AIAA8AJ0AQgCUAEMAMwCcADQApQCMAK8ApQCvAJQAYgCGAGUAXACWAF4ANQA2AEcAAgBlAAMAsABoAGcAmACRABcAmABrAJkAHQAfAKgAHQCmAB4AGwBoALAAGwCwAKsAmgCbAEcAQwCvAKEAQwCUAK8AkQAYABcAewAUAHwAgQAeAKYAcgChAK8AcgCvAIwAeQBBADkAeQA5ADgAsQCoALIAsgCoAB8AsgAfAHQAjQCMAKkAjQCpALMAjQCzALQAAwBlAIYAfAAtACsAnACKADQAswCpAKgAswCoALEAjgCNALUAtQCNALQA', kind: 'oooooooooooooooooooooooooooooooooorroroooorrrwwworrooooorooorrwffwwoooooooooooorwrwwrooorrrooooooooooorooooooooooooofwfwwwooooooooorrrwooooooooooffwwwoooooroooooooooooooorroooroowfwwfoorrwwrwrorwwrwwfwoowrooroorwoooooooooooooooooooooooooooooffwoooooooooooooooooowwooooooooooooooorooorfoooroooofooooooorrooooooooroooo' };
export const NOZ_PAINT = { o: PAL.trim, r: s('#2c2f34', 0.32, 0.8, 0.7), w: s('#1f2125', 0.4, 0.75, 0.8), f: s('#141619', 0.45, 0.8, 0.8) };
let NOZ = null;
function nozzleMesh() {
  if (NOZ) return NOZ;
  const p16 = new Int16Array(bytes(NOZZLE.pos)), tris = new Uint16Array(bytes(NOZZLE.tris)), pos = [];
  for (let i = 0; i < p16.length; i += 3) pos.push(V3(p16[i] / Q, p16[i + 1] / Q, p16[i + 2] / Q));
  // the 3k's engine at the cut, each side: the ring of corners its faces end on (the zone's cut), its middle and radius
  const sides = {};
  for (const sd of [1, -1]) {
    const ring = new Map();
    for (const f of hullFaces()) {
      if (f.part !== 'engine' || !drawn(f) || Math.sign(f.c.x) !== sd) continue;
      for (let e = 0; e < 3; e++) { const a = f.pts[e], b = f.pts[(e + 1) % 3]; if (Math.abs(a.z - NOZZLE.cut) < 1e-4 && Math.abs(b.z - NOZZLE.cut) < 1e-4) for (const v of [a, b]) ring.set(v.x.toFixed(4) + ',' + v.y.toFixed(4), v); }
    }
    const R = [...ring.values()], xs = R.map((v) => v.x), ys = R.map((v) => v.y);
    const c = V3((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, NOZZLE.cut);
    sides[sd] = { ring: R, c, r: R.reduce((t, v) => t + Math.hypot(v.x - c.x, v.y - c.y), 0) / R.length };
  }
  NOZ = { pos, tris, sides };
  return NOZ;
}
function nozzle(acc, sd) {
  const { pos, tris, sides } = nozzleMesh(), S = sides[sd], k = S.r / NOZZLE.rCut;
  const at = (v) => V3(S.c.x + sd * v.x * k, S.c.y + v.y * k, v.z);
  for (let t = 0; t < tris.length / 3; t++) {
    let T = [0, 1, 2].map((j) => at(pos[tris[t * 3 + j]])); if (sd < 0) T = [T[0], T[2], T[1]];
    const n = tnorm(T); if (n.lengthSq() < 1e-14) continue; n.normalize();
    const kind = NOZZLE.kind[t];
    acc.tris([T.map(dk)], n, NOZ_PAINT[kind]);
  }
  // the join: the 3k's ring and the 8k's, both in the plane of the cut, stitched round by their angles (a strip a few
  // centimetres wide at most, facing back, and forward too)
  const ang = (v) => Math.atan2(v.y - S.c.y, v.x - S.c.x);
  const A = S.ring.slice().sort((a, b) => ang(a) - ang(b)), seen = new Set(), B = [];
  for (const v of pos) if (Math.abs(v.z - NOZZLE.cut) < 1e-3) { const w = at(v), key = w.x.toFixed(4) + ',' + w.y.toFixed(4); if (!seen.has(key)) { seen.add(key); B.push(w); } }
  B.sort((a, b) => ang(a) - ang(b));
  const strip = [], na = A.length, nb = B.length, turn = (L, i) => ang(L[i % L.length]) + (i >= L.length ? 2 * PI : 0);
  for (let i = 0, j = 0; i < na || j < nb;) {
    if (j >= nb || (i < na && turn(A, i + 1) <= turn(B, j + 1))) { strip.push([A[i % na], A[(i + 1) % na], B[j % nb]]); i++; } else { strip.push([A[i % na], B[(j + 1) % nb], B[j % nb]]); j++; }
  }
  for (const T of strip) { if (tnorm(T).lengthSq() < 1e-14) continue; const P = T.map(dk); acc.tris([P], V3(0, 0, -1), PAL.trim); acc.tris([[P[0], P[2], P[1]]], V3(0, 0, 1), PAL.trim); }
}
// THE JETS (plume.js): where each starts and how big: at the middle of its nozzle's core, streaming straight aft, as
// wide as the bowl's mouth (its rim's inner edge); the plume's length at full thrust in those radii
export const JET = { len: 9.0, gain: 1.0 };
export function jetNozzles() {
  const { pos, tris, sides } = nozzleMesh(), out = [];
  for (const sd of [1, -1]) {
    const S = sides[sd], k = S.r / NOZZLE.rCut, core = new Set(), rim = new Set();
    for (let t = 0; t < tris.length / 3; t++) for (let j = 0; j < 3; j++) (NOZZLE.kind[t] === 'f' ? core : NOZZLE.kind[t] === 'r' ? rim : new Set()).add(tris[t * 3 + j]);
    const cz = [...core].reduce((a, i) => a + pos[i].z, 0) / core.size, rr = Math.min(...[...rim].map((i) => Math.hypot(pos[i].x, pos[i].y))) * k;
    out.push({ at: [S.c.x, S.c.y, cz], dir: [0, 0, -1], r: rr * 0.9 });
  }
  return out;
}
// THE THROTTLE (built-common.js: THROTTLE, ENGINE, setThrottle): how hard the engines run, 0 (off: no jet, the nozzles
// dark) to 1 (full afterburn); the jets follow it.

// ── THE CANOPY ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Nine panes of glass, as the game's maker counts them ("3 on each side, 3 on top") and drew the frames over Meshy B's
// canopy: down each side a front triangle, a middle quad and a rear pentagon ("the forward glass is one triangle, the
// middle a square, the rear, 5 sides"); across the top the windscreen, the roof's front and the roof's rear. Each pane
// is one clean polygon through named corners on the 3k's canopy, its glass shaded smooth so it reads as one piece. One
// straight black spar runs along each border from corner to corner (a border that runs on straight past a corner is
// one spar), and a wider one round the outline, the sill. The 3k's own canopy faces are dropped where a pane covers
// them; the rest (the shelf along the sill, the strips where the canopy meets the roof behind) are painted as the frame.
// CORNERS, each given on the port side (the starboard one is found the same way on its own side: the 3k is nearly but
// not quite symmetric): the middle of the 3k's canopy vertices within r of the point, or (no r) the one nearest it.
//   the shoulder line   T1 over the windscreen's corner, T2 at the second cross frame, T3 at the back
//   the sill            J at the front, S1 at the first cross frame, S3 at the back (S1 to S3 is the inner edge of the
//                       3k's shelf, one straight edge); S2 on it where the second cross frame comes down (at T2's z)
//   the back            B, its corner on the side, where the rear pane's back edge turns
//   the nose            F the windscreen's foot each side, F0 its middle (the sill runs straight past it): the top of
//                       the 3k's step there (the strip under it, down to the nose, is the nose's white skin)
//   the crown           C1, C2, C3 on the middle line, where each cross frame and the back cross it
export const CANOPY = {
  corners: {
    T1: { at: [1.11, 3.84, 6.42], r: 0.13 }, T2: { at: [1.40, 4.39, 4.80], r: 0.13 }, T3: { at: [1.62, 4.60, 3.16], r: 0.15 },
    J: { at: [1.08, 2.72, 7.65] }, S1: { at: [1.90, 3.0, 6.46] }, S3: { at: [2.43, 3.28, 3.86] }, B: { at: [2.2, 4.04, 3.0] },
    F: { at: [0.86, 2.83, 7.78] }, F0: { at: [0.03, 2.77, 7.84], mid: true },
    C1: { at: [0, 3.95, 6.43], r: 0.1, mid: true }, C2: { at: [0, 4.5, 4.83], r: 0.12, mid: true }, C3: { at: [0.03, 4.87, 2.95], mid: true },
  },
  // the panes: name, shape, and its corners in order round it (a side's pane: its own side's; a top pane: unmarked the
  // port side's, ' the starboard's; ~ a point the outline passes through that is no corner); a pane bent along its
  // middle (the roof, over its crown) is given as its two halves
  side: [['front', 'triangle', ['J', 'S1', 'T1']], ['middle', 'quad', ['S1', 'S2', 'T2', 'T1']], ['rear', 'pentagon', ['S2', 'S3', 'B', 'T3', 'T2']]],
  top: [
    ['windscreen', 'seven-sided, bent round the nose', [['T1', 'J', 'F', '~F0', "F'", "J'", "T1'", 'C1']]],
    ['roof front', 'six-sided, bent over its crown', [['T1', 'C1', 'C2', 'T2'], ['C1', "T1'", "T2'", 'C2']]],
    ['roof rear', 'six-sided, bent over its crown', [['T2', 'C2', 'C3', 'T3'], ['C2', "T2'", "T3'", 'C3']]],
  ],
  // the spars: w wide, standing `out` out of the glass and `in` into it; round the outline (the sill) wider, lower
  // (`out` there; low enough at the windscreen's foot that the nose, not the spar, sets the look down ahead), and moved
  // out by `shift`, so it covers the edge of the painted shelf and the skin as well as the glass's
  spar: { w: 0.06, out: 0.035, in: 0.03 }, sill: { w: 0.13, out: 0.02, shift: 0.06 },
  straight: 3,   // (degrees: two borders meeting at a corner within this of a straight line are one spar)
};
let PANES = null;
// the 3k's canopy faces (its own triangles, in the ship's frame) and their corners, welded
function canopyMesh() {
  const M = mesh(HULL), part = new Uint8Array(bytes(HULL.part)), ci = PARTS.indexOf('canopy'), faces = [], verts = new Map();
  for (let t = 0; t < M.tris.length / 3; t++) {
    if ((part[t] & 0x7f) !== ci) continue;
    const pts = [0, 1, 2].map((k) => at(M, M.tris[t * 3 + k]));
    if (tnorm(pts).length() < 2e-7) continue;
    faces.push(pts); for (const v of pts) verts.set([v.x, v.y, v.z].map((q) => Math.round(q * 2000)).join(), v);
  }
  return { faces, verts: [...verts.values()] };
}
// (the canopy's outside: away from a line along the ship over the cabin's floor)
const outward = (n, c) => (n.dot(V3(c.x, c.y - 2.3, c.z - 5.0)) < 0 ? n.negate() : n);
// (S2: on the sill, S1 to S3, at T2's z)
CANOPY.derive = (P, k) => { const a = P['S1' + k], b = P['S3' + k], t = (P['T2' + k].z - a.z) / (b.z - a.z); P['S2' + k] = a.clone().lerp(b, t); };
// the panes and their spars (built-common.js buildPanes)
export function canopyPanes() {
  if (PANES) return PANES;
  PANES = C.buildPanes(CANOPY, canopyMesh(), outward);
  return PANES;
}
// THE SPAR: one part, a black bar placed along every border (built-common.js spar)
export function spar(p) { return C.spar(p, { out: CANOPY.spar.out, in: CANOPY.spar.in, surf: PAL.blackEdge }); }
// the glass: smoked, a little in from the frame's face, seen from outside and from the seats (a face each way); each
// pane's triangles cut evenly into ones no longer than `step` (its normals blended across them, so the pane shades
// smooth; and the checks can cut a hole in it)
export const GLASS = { inset: 0.008, step: 0.6 };
function ebCanopy(p) { return C.drawCanopy(p, canopyPanes(), CANOPY, GLASS, part(spar), dk); }

// ── LIGHTS AND MARKS laid on the skin ─────────────────────────────────────────────────────────────────────────────
// Each is placed where it says on the ship's side (or front), then dropped onto the skin there: a ray in from outside
// finds the face, the mark lies 1 cm off it. Both sides alike unless it says.
export const MARKS = {
  // his blue light strips: the long one along each cheek under the canopy, a short one ahead of each wing's root
  strips: [{ z: [4.0, 6.7], y: 2.47, h: 0.075 }, { z: [-0.95, 0.05], y: 2.62, h: 0.06 }],
  // his nose lamps: two each side on the nose's face (warm)
  lamps: [{ x: 0.36, y: 2.33, w: 0.24, h: 0.08 }, { x: 0.78, y: 2.36, w: 0.22, h: 0.08 }],
  // his yellow "//" by the door, aft of it, on the white side (z of the bars' feet, how they lean, their height)
  slashes: { z: [-0.25, -0.02], y: [2.95, 3.45], lean: -0.22, w: 0.13 },
};
// the first face a ray meets (the hull's own, not its glass): { p, n } or null
const rayHull = (o, d) => C.rayFaces(hullFaces(), o, d, drawn);
// a point on the side s of the skin at (y, z), lifted `lift` off it
const onSide = (s, y, z, lift = 0.012) => { const h = rayHull(V3(s * 8, y, z), V3(-s, 0, 0)); return h ? h.p.addScaledVector(h.n, lift) : null; };
function ebMarks(p) {
  const acc = new Acc();
  for (const s of [1, -1]) {
    // the strips: a band between two lines along the skin, in short runs so it follows the faces
    for (const S of MARKS.strips) {
      const n = Math.max(2, Math.ceil((S.z[1] - S.z[0]) / 0.25));
      for (let i = 0; i < n; i++) {
        const za = S.z[0] + (S.z[1] - S.z[0]) * i / n, zb = S.z[0] + (S.z[1] - S.z[0]) * (i + 1) / n;
        const q = [onSide(s, S.y - S.h / 2, za), onSide(s, S.y - S.h / 2, zb), onSide(s, S.y + S.h / 2, zb), onSide(s, S.y + S.h / 2, za)];
        if (q.some((v) => !v)) continue;
        acc.poly(q.map(dk), V3(s, 0, 0), GLOW.strip, 'glow', 99);
      }
      p.light([s * 3.0, S.y - DECK, (S.z[0] + S.z[1]) / 2], 0.25, [0.3, 0.6, 1], [s, -0.3, 0], 2.0);
    }
    // the yellow slashes (two bars, leaning back)
    const L = MARKS.slashes;
    for (const z0 of L.z) {
      const q = [onSide(s, L.y[0], z0), onSide(s, L.y[0], z0 + L.w), onSide(s, L.y[1], z0 + L.w + L.lean), onSide(s, L.y[1], z0 + L.lean)];
      if (q.every((v) => v)) acc.poly(q.map(dk), V3(s, 0, 0), PAL.yellow, 'solid', 99);
    }
    // the nose lamps: on the nose's face, a ray back from in front
    for (const Lm of MARKS.lamps) {
      const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const h = rayHull(V3(s * Lm.x + a * Lm.w / 2, Lm.y + b * Lm.h / 2, 12), V3(0, 0, -1)); return h ? h.p.addScaledVector(h.n, 0.012) : null; });
      if (c.every((v) => v)) acc.poly(c.map(dk), V3(0, 0, 1), GLOW.warm, 'glow', 99);
    }
  }
  // nav lights: red on the port wingtip, green on the starboard, white on each fin's top (small glowing blocks)
  const nav = (at, col) => boxAtGlow(acc, at, 0.05, col);
  nav(V3(6.44, 1.33, -4.86), GLOW.red); nav(V3(-6.44, 1.33, -4.86), GLOW.green);
  for (const s of [1, -1]) nav(V3(s * 3.13, 6.27, -6.92), GLOW.white);
  acc.flush(p);
  p.light([0, 2.35 - DECK, 9.0], 0.9, [1.2, 0.95, 0.6], [0, -0.2, 1], 5);
  return p;
}
// a small glowing cube (h half its side) at a point (ship frame)
const boxAtGlow = (acc, c, h, col) => C.boxAtGlow(acc, c, h, col, dk);
// ── THE COCKPIT ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The cockpit family's parts (kit/shipparts/cockpit), as its sample cockpit puts them (cockpitPlan), fitted under this
// canopy: two bucket seats side by side in the ship's colours (the pilot on the left, port), the throttle pedestal
// between them, pedals, the dashboard, and a side console each side; no overheads (the glass is the roof), no engineer's
// seat (two seats), no handholds or locker (no walls to hang them on). Its floor stands FLOOR over the deck (as the
// blueprints have it, over the nose leg); the seats' middles at SEATS_Z. The windscreen: its foot (the lowest glass
// ahead) and how far ahead, measured on the canopy. The dash is lower than the family's own (1.0 m, its lip 0.64 m
// over the floor, 0.45 m from the seats' middles, so the switches stay in easy reach): low enough that the nose, not
// the dash, sets the look down ahead (about 9 degrees below level). Its deck runs 1.8 m forward (the family's would run
// on to the windscreen's foot, 2.6 m: its ends, which fan out, would come through the nose's sides); the tub's dark
// floor shows ahead of it, under the chin of the glass.
export const COCKPIT = { floor: 0.3, seatsZ: 4.9, wallX: 1.3, gap: 0.45, dash: { w: 2.0, h: 1.0, knee: 0.64, bow: 0.15, depth: 1.8 }, canopy: { y: 2.64 - DECK - 0.3, z: 8.0 - 4.9, slope: 0.7 }, tubX: 1.5 };
export const COCKPIT_DROP = /^overhead|^handhold|^engineer|^locker/;
export function builtCockpitPlan() { return C.builtCockpitPlan(COCKPIT, COCKPIT_DROP); }
// THE COCKPIT WITH THE CABIN BEHIND IT ('two seats, cabin'): the tub cut at the cabin's wall (CABIN_TUB.z, the wall the
// blueprint's cockpit shares with the science lab), its floor and walls only ahead of it: the cabin's own wall, with its
// doorway, closes the cockpit there, and a riser at the doorway is the step up onto the cockpit's raised floor. The
// canopy's back runs on over the room behind (back to z 2.95), so under that glass the room's top is closed off dark:
// a LID over its ceiling and slopes and down its sides (`lid`: the port half of its section, deck-relative x and y,
// mirrored; just outside the science lab's walls, slopes and ceiling), a curtain from the canopy's edge down to the
// lid, and a panel in the wall's plane up to the glass: from just under the cabin wall's top (`under`; the wall's face
// toward the cockpit reaches `wallHalf` each side, `wallTop` up), and beside it down to the cockpit's floor.
export const CABIN_TUB = { z: 4.0, lid: [[2.08, 0.95], [2.08, 1.78], [1.26, 2.6]], under: 0.05, wallHalf: 1.47, wallTop: 2.5, panel: s('#c8c6c1', 0.58, 0.04, 0.4) };
function cabinTub(acc, outline, { fy, tubX, rayIn, wallSurf, floorSurf }) {
  const Cz = CABIN_TUB.z, ahead = [0, 0, -1, -Cz];
  // (the tub's walls and floor ahead of the cut: as built-common.js's cockpitTub, each polygon clipped at the cut)
  const inside = new Map(), halfAt = (s, z) => { const k = s + ':' + z.toFixed(3); if (!inside.has(k)) { const h = rayIn(V3(0, fy + 0.04, z), V3(s, 0, 0)); inside.set(k, h ? Math.abs(h.p.x) - 0.1 : 0); } return inside.get(k); };
  const foot = (v) => { const s = Math.sign(v.x) || 1; return V3(s * Math.max(0, Math.min(Math.abs(v.x), tubX, halfAt(s, v.z))), fy, v.z); };
  const ctr = outline.reduce((s2, sp) => s2.add(sp.a).add(sp.b), V3(0, 0, 0)).multiplyScalar(1 / (2 * outline.length));
  for (const sp of outline) {
    if (Math.abs(sp.a.y - fy) < 0.02 && Math.abs(sp.b.y - fy) < 0.02) continue;
    const q = C.clipPlane([sp.a, sp.b, foot(sp.b), foot(sp.a)], ahead)[0].filter((v, i, Q) => Q.findIndex((w) => w.distanceTo(v) < 1e-6) === i);
    if (q.length < 3) continue;
    const n = tnorm(q.slice(0, 3)).lengthSq() > 1e-10 ? tnorm(q.slice(0, 3)).normalize() : tnorm([q[0], q[2], q[3] || q[1]]).normalize();
    const mid = sp.a.clone().add(sp.b).multiplyScalar(0.5); if (n.dot(V3(ctr.x - mid.x, 0, ctr.z - mid.z)) < 0) n.negate();
    polyTo(acc, q, n, wallSurf);
  }
  const fl = []; for (const sp of outline) fl.push(foot(sp.a), foot(sp.b));
  const floor = C.clipPlane(C.convexHullXZ(fl).map((v) => V3(v.x, fy, v.z)), ahead)[0];
  polyTo(acc, floor, V3(0, 1, 0), floorSurf);
  // (the riser: the floor's edge at the cut, facing the room behind)
  const fx = Math.max(...floor.filter((v) => Math.abs(v.z - Cz) < 1e-4).map((v) => Math.abs(v.x)), 0.5);
  polyTo(acc, [V3(-fx, DECK, Cz), V3(fx, DECK, Cz), V3(fx, fy, Cz), V3(-fx, fy, Cz)], V3(0, 0, -1), PAL.trimEdge);
  // THE LID behind the cut: its section (both halves) and the nearest point on it to a point (deck-relative x, y)
  const half = CABIN_TUB.lid, sec = [...half.map(([x, y]) => [x, y]), ...half.slice().reverse().map(([x, y]) => [-x, y])];
  const near = (x, y) => { let best = null, bd = Infinity; for (let i = 0; i < sec.length - 1; i++) { const [ax, ay] = sec[i], [bx, by] = sec[i + 1], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))), px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; best = [px, py]; } } return best; };
  const both = (pts, n) => { polyTo(acc, pts, n, wallSurf); polyTo(acc, pts, n.clone().negate(), wallSurf); };
  let zMin = Cz;
  for (const sp of outline) {
    // (the edge's part behind the cut)
    let a = sp.a, b = sp.b; if (a.z > Cz && b.z > Cz) continue;
    if (a.z > Cz) a = b.clone().lerp(a, (Cz - b.z) / (a.z - b.z)); else if (b.z > Cz) b = a.clone().lerp(b, (Cz - a.z) / (b.z - a.z));
    const fa = near(a.x, a.y - DECK), fb = near(b.x, b.y - DECK);
    zMin = Math.min(zMin, a.z, b.z);
    const P = [a, b, V3(fb[0], DECK + fb[1], b.z), V3(fa[0], DECK + fa[1], a.z)].filter((v, i, Q) => Q.findIndex((w) => w.distanceTo(v) < 1e-6) === i);
    if (P.length >= 3 && tnorm(P.slice(0, 3)).lengthSq() > 1e-12) both(P, tnorm(P.slice(0, 3)).normalize());
  }
  for (let i = 0; i < sec.length - 1; i++) {
    const [ax, ay] = sec[i], [bx, by] = sec[i + 1], n = V3(by - ay, -(bx - ax), 0).normalize();
    both([V3(ax, DECK + ay, zMin - 0.02), V3(bx, DECK + by, zMin - 0.02), V3(bx, DECK + by, Cz), V3(ax, DECK + ay, Cz)], n);
  }
  // THE PANEL at the cut, from the lid (lowered by `under`, behind the wall's top) up to the glass: the glass's section
  // there from the panes' triangles, as a line over the top from sill to sill
  const arch = [];
  for (const pane of canopyPanes().panes) for (const T of pane.tris) for (let e = 0; e < 3; e++) {
    const A = T[e], B = T[(e + 1) % 3]; if ((A.z - Cz) * (B.z - Cz) > 0 || Math.abs(A.z - B.z) < 1e-9) continue;
    const t = (Cz - A.z) / (B.z - A.z); arch.push([A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t]);
  }
  arch.sort((p1, p2) => p1[0] - p2[0]);
  const top = arch.filter((pt, i) => i === 0 || pt[0] - arch[i - 1][0] > 0.02);
  const sx = Math.max(...top.map(([x]) => Math.abs(x))), sy = Math.min(...top.map(([, y]) => y)) - DECK, u = CABIN_TUB.under;
  // (its lower edge: over the cabin's wall, `under` below its top; beside the wall, down inside the tub's walls to the
  // cockpit's floor, so nothing behind the wall shows past its ends)
  const fyD = fy - DECK, L = CABIN_TUB.wallHalf - 0.02, wt = CABIN_TUB.wallTop - u;
  const low = [[sx, sy], [tubX, fyD], [L, fyD], [L, wt], [-L, wt], [-L, fyD], [-tubX, fyD], [-sx, sy]];
  // (a pale panel, so the cabin's wall carries on up to the glass: the bulkhead behind the seats, not a wall in a hole;
  // its back, toward the dark over the lab, dark)
  const P = [...top.map(([x, y]) => V3(x, y, Cz)), ...low.map(([x, y]) => V3(x, DECK + y, Cz))];
  polyTo(acc, P, V3(0, 0, 1), CABIN_TUB.panel); polyTo(acc, P, V3(0, 0, -1), wallSurf);
}
function ebCockpit(p, variant) {
  const Cp = COCKPIT, cabin = variant === 'two seats, cabin';
  C.cockpitParts(p, builtCockpitPlan(), Cp);
  if (cabin) {
    const acc = new Acc(), fy = DECK + Cp.floor;
    cabinTub(acc, canopyPanes().outline, { fy, tubX: Cp.tubX, rayIn: rayHull, wallSurf: PAL.trim, floorSurf: PAL.deck });
    acc.flush(p);
    for (const x of [-0.5, 0.5]) p.light([x, Cp.floor + 2.0, Cp.seatsZ - 0.2], 1.1, [1.25, 0.85, 0.55], [0, -1, 0.2], 3.2);
    p.light([0, Cp.floor + 1.3, Cp.seatsZ + 1.0], 0.8, [0.35, 0.65, 1.0], [0, 0.2, -1], 2.5);
    return p;
  }
  // THE TUB (built-common.js cockpitTub): everything under the glass closed, so no gap shows the sky from the seats (and
  // nobody sees into the empty hull through the canopy); the bulkhead behind with the cabin's door in it, shut
  const acc = new Acc(), fy = DECK + Cp.floor;
  const hull2 = C.cockpitTub(acc, canopyPanes().outline, { fy, tubX: Cp.tubX, rayIn: rayHull, wallSurf: PAL.trim, floorSurf: PAL.deck, dk });
  // (the cabin's door in the bulkhead, at the back of the floor: shut, dark, a lit strip over it)
  const zb = Math.min(...hull2.map((v) => v.z)) + 0.32;
  boxAt(acc, V3(0, fy + 1.0, zb), [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)], [0.45, 1.0, 0.03], PAL.trim);
  boxAt(acc, V3(0, fy + 1.0, zb + 0.035), [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)], [0.012, 0.96, 0.006], PAL.black, ['w-']);
  acc.poly([V3(-0.4, fy + 2.06, zb + 0.032), V3(0.4, fy + 2.06, zb + 0.032), V3(0.4, fy + 2.1, zb + 0.032), V3(-0.4, fy + 2.1, zb + 0.032)].map(dk), V3(0, 0, 1), GLOW.strip, 'glow', 99);
  acc.flush(p);
  // (warm light over the seats, a cool one from the dash, for the bake)
  for (const x of [-0.5, 0.5]) p.light([x, Cp.floor + 2.0, Cp.seatsZ - 0.2], 1.1, [1.25, 0.85, 0.55], [0, -1, 0.2], 3.2);
  p.light([0, Cp.floor + 1.3, Cp.seatsZ + 1.0], 0.8, [0.35, 0.65, 1.0], [0, 0.2, -1], 2.5);
  return p;
}

// ── THE DOORWAYS ────────────────────────────────────────────────────────────────────────────────────────────────────
// The door stands in a plane from its hinge line (xHinge, hinge height) up to its head line (xHead, head height), set
// into the hull's side (the 3k's side steps out over a narrower lower hull here, so the door sits in a dark alcove,
// the jambs between it and the skin). Inside, the cabin's deck is the sill: a step up from the hinge.
// (x of the door's plane at height y, in the ship frame)
const doorX = (y) => DOOR.xHinge + (DOOR.xHead - DOOR.xHinge) * (y - DOOR.hinge) / (DOOR.head - DOOR.hinge);
const DOOR_U = V3(DOOR.xHead - DOOR.xHinge, DOOR.head - DOOR.hinge, 0).normalize(), DOOR_LEN = Math.hypot(DOOR.xHead - DOOR.xHinge, DOOR.head - DOOR.hinge);
// the airlock behind the port door (its inner wall at x AIRLOCK.x, its ceiling at AIRLOCK.top over the deck), the
// step inside the doorway (its riser AIRLOCK.riser in from the hinge line)
export const AIRLOCK = { x: 0.9, top: 2.06, riser: 0.16, z: DOOR.z };
// 'port, cabin': the same doorway when the cabin is built inside (cabin-built.js, from a blueprint): its own airlock
// room meets the door, so the stand-in airlock here goes; what stays is the alcove between the cabin's wall line
// (CABIN.wall) and the door's plane: its sides and its ceiling at the opening's head
export const CABIN = { wall: 2.0 };
function ebDoorway(p, variant) {
  const cabin = variant === 'port, cabin', side = cabin ? 'port' : variant;
  const s = side === 'starboard' ? -1 : 1, acc = new Acc(), [z0, z1] = DOOR.z, J = JAMBS[side];
  // the jambs: between the door's plane and the skin, at each end of the doorway, dark (the black edge round the door)
  J.forEach(({ z, profile }, i) => {
    const outer = profile.filter(([x, y]) => x > doorX(y) + 0.004).map(([x, y]) => V3(s * x, y, z));
    if (outer.length < 2) return;
    const yb = outer[0].y, yt = outer[outer.length - 1].y;
    polyTo(acc, [V3(s * doorX(yb), yb, z), ...outer, V3(s * doorX(yt), yt, z)], V3(0, 0, i === 0 ? 1 : -1), PAL.trimEdge);
  });
  // the step inside the doorway: its riser from the hinge's height up to the deck, a tread at the hinge's height out
  // to the door's plane, the deck's edge (the sill) over it
  const xr = DOOR.xHinge - AIRLOCK.riser;
  polyTo(acc, [V3(s * xr, DOOR.hinge, z0), V3(s * xr, DOOR.hinge, z1), V3(s * xr, DECK, z1), V3(s * xr, DECK, z0)], V3(s, 0, 0), PAL.trim);
  polyTo(acc, [V3(s * xr, DOOR.hinge, z0), V3(s * DOOR.xHinge, DOOR.hinge, z0), V3(s * DOOR.xHinge, DOOR.hinge, z1), V3(s * xr, DOOR.hinge, z1)], V3(0, 1, 0), PAL.deck);
  // (the step's sides, the jambs carried down to it)
  for (const [z, nz] of [[z0, 1], [z1, -1]]) polyTo(acc, [V3(s * xr, DOOR.hinge, z), V3(s * DOOR.xHinge, DOOR.hinge, z), V3(s * doorX(DECK), DECK, z), V3(s * xr, DECK, z)], V3(0, 0, nz), PAL.trimEdge);
  if (cabin) {
    // THE ALCOVE (the cabin built inside): from the cabin's wall line out to the door's plane, its sides at the jambs and
    // its ceiling at the head, dark (the door's plane crosses the wall line just over the deck, at y yc)
    const xi = CABIN.wall, top = DECK + AIRLOCK.top, yc = DOOR.hinge + (xi - DOOR.xHinge) / (DOOR.xHead - DOOR.xHinge) * (DOOR.head - DOOR.hinge);
    // (pale, as the stand-in airlock's were, and lit: a strip along its head and a light over the door, so the shut door
    // and its steps read from the airlock)
    polyTo(acc, [V3(xi, top, z0), V3(doorX(top), top, z0), V3(doorX(top), top, z1), V3(xi, top, z1)], V3(0, -1, 0), PAL.inner);
    for (const [z, nz] of [[z0, 1], [z1, -1]]) polyTo(acc, [V3(xi, yc, z), V3(doorX(top), top, z), V3(xi, top, z)], V3(0, 0, nz), PAL.inner);
    const zm = (z0 + z1) / 2, xs = xi + 0.25;
    acc.poly([V3(xs - 0.04, top - 0.004, zm - 0.6), V3(xs + 0.04, top - 0.004, zm - 0.6), V3(xs + 0.04, top - 0.004, zm + 0.6), V3(xs - 0.04, top - 0.004, zm + 0.6)].map(dk), V3(0, -1, 0), [2.6, 2.4, 2.0], 'glow', 99);
    p.light([xs, AIRLOCK.top - 0.1, zm], 1.2, [1, 0.94, 0.85], [0.3, -1, 0], 3);
  } else if (s > 0) {
    // THE AIRLOCK behind the port door: its deck, walls (the station's off-white), ceiling, and the inner door shut in its
    // inner wall (a dark panel, a lit strip over it)
    const xi = AIRLOCK.x, top = DECK + AIRLOCK.top;
    polyTo(acc, [V3(xi, DECK, z0), V3(xi, DECK, z1), V3(xr, DECK, z1), V3(xr, DECK, z0)], V3(0, 1, 0), PAL.deck);
    polyTo(acc, [V3(xi, top, z0), V3(doorX(top), top, z0), V3(doorX(top), top, z1), V3(xi, top, z1)], V3(0, -1, 0), PAL.inner);
    for (const [z, nz] of [[z0, 1], [z1, -1]]) polyTo(acc, [V3(xi, DECK, z), V3(xr, DECK, z), V3(doorX(DECK), DECK, z), V3(doorX(top), top, z), V3(xi, top, z)], V3(0, 0, nz), PAL.inner);
    polyTo(acc, [V3(xi, DECK, z0), V3(xi, DECK, z1), V3(xi, top, z1), V3(xi, top, z0)], V3(1, 0, 0), PAL.inner);
    const zm = (z0 + z1) / 2, dw = 0.5;
    boxAt(acc, V3(xi + 0.02, DECK + 1.0, zm), [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)], [0.02, 1.0, dw], PAL.trim, ['u-']);
    boxAt(acc, V3(xi + 0.045, DECK + 1.0, zm), [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)], [0.004, 0.96, 0.012], PAL.black, ['u-']);
    acc.poly([V3(xi + 0.03, top - 0.12, zm - 0.4), V3(xi + 0.03, top - 0.12, zm + 0.4), V3(xi + 0.03, top - 0.08, zm + 0.4), V3(xi + 0.03, top - 0.08, zm - 0.4)].map(dk), V3(1, 0, 0), GLOW.strip, 'glow', 99);
    acc.poly([V3(xi + 0.2, top - 0.005, zm - 0.5), V3(xi + 1.0, top - 0.005, zm - 0.5), V3(xi + 1.0, top - 0.005, zm + 0.5), V3(xi + 0.2, top - 0.005, zm + 0.5)].map(dk), V3(0, -1, 0), [2.6, 2.4, 2.0], 'glow', 99);
    p.light([xi + 0.6, top - DECK - 0.15, zm], 1.4, [1, 0.94, 0.85], [0, -1, 0], 3.5);
  } else {
    // THE SEALED HATCH (starboard): a panel in the door's plane, white with a black edge line round it, two dark
    // latch plates
    hatchPanel(acc, s, false);
  }
  return acc.flush(p);
}
// the door's panel, closed, in the door's plane: its outer face (white, a black line round its edge), its edges and
// inside face; steps: the airstair's treads and side rails on its inside face (they are horizontal when it is open)
function hatchPanel(acc, s, steps) {
  const [z0, z1] = DOOR.z, e = 0.008, za = z0 + e, zb = z1 - e, out = V3(s * DOOR_U.y, -DOOR_U.x, 0), inn = out.clone().negate(), T = 0.06, B = 0.05;
  const P = (u, z, w = 0) => V3(s * (DOOR.xHinge + DOOR_U.x * u), DOOR.hinge + DOOR_U.y * u, z).addScaledVector(inn, w);
  const D = { poly: (pts, n, surf, mat, step) => acc.poly(pts.map(dk), n, surf, mat, step) };   // (its points are the ship's: on the deck)
  const L = DOOR_LEN - e;
  // the outer face: the white middle, the black line round it
  D.poly([P(B, za + B), P(B, zb - B), P(L - B, zb - B), P(L - B, za + B)], out, PAL.skin, 'solid', 99);
  for (const q of [[P(0, za), P(0, zb), P(B, zb - B), P(B, za + B)], [P(L, za), P(L - B, za + B), P(L - B, zb - B), P(L, zb)], [P(0, za), P(B, za + B), P(L - B, za + B), P(L, za)], [P(0, zb), P(L, zb), P(L - B, zb - B), P(B, zb - B)]]) D.poly(q, out, PAL.black, 'solid', 99);
  // its edges and inside face
  for (const [a, b] of [[P(0, za), P(0, zb)], [P(0, zb), P(L, zb)], [P(L, zb), P(L, za)], [P(L, za), P(0, za)]]) { const n = b.clone().sub(a).cross(inn).normalize(); D.poly([a, b, b.clone().addScaledVector(inn, T), a.clone().addScaledVector(inn, T)], n.dot(a.clone().add(b).multiplyScalar(0.5).sub(P(L / 2, (za + zb) / 2))) < 0 ? n.negate() : n, PAL.trimEdge, 'solid', 99); }
  D.poly([P(0, za, T), P(L, za, T), P(L, zb, T), P(0, zb, T)], inn, steps ? PAL.deck : PAL.inner, 'solid', 99);
  if (!steps) { for (const u of [0.5, L - 0.5]) boxAt(acc, P(u, (za + zb) / 2, -0.012), [DOOR_U.clone().setX(s * DOOR_U.x), V3(0, 0, 1), out], [0.06, 0.18, 0.012], PAL.trim, ['w-']); return; }
  // THE STEPS: the side rails along both edges, and the treads: when the door is open its inside faces up the slope
  // at the stair's angle; each tread is a wedge whose top is level then, its front a riser, a yellow nosing on it
  const ang = Math.asin(DOOR.hinge / DOOR_LEN), rise = 0.205, ds = rise / Math.sin(ang), run = rise / Math.tan(ang);
  // (level and up when open, in the panel's own terms: along it from the hinge (u) and out of its inside face (w))
  const hu = Math.cos(ang), hw = Math.sin(ang);
  const W = (u, w, z) => P(u, z, T + w);
  for (const z of [za + 0.025, zb - 0.025]) boxAt(acc, W(L / 2, 0.08, z), [DOOR_U.clone().setX(s * DOOR_U.x), inn, V3(0, 0, 1)], [L / 2, 0.08, 0.025], PAL.black, ['v-']);
  const zA = za + 0.05, zB = zb - 0.05;
  for (let u = ds * 0.6; u + ds < L - 0.02; u += ds) {
    // (the wedge: its back on the panel at u, its nose run out level, its riser down to the panel at u + ds)
    const a = [u, 0], b = [u + hu * run, hw * run], c = [u + ds, 0];
    const tri = (q, z) => W(q[0], q[1], z), nTop = W(b[0], b[1], 0).sub(W(a[0], a[1], 0)).cross(V3(0, 0, 1)).normalize(), nFront = W(c[0], c[1], 0).sub(W(b[0], b[1], 0)).cross(V3(0, 0, 1)).normalize();
    const fix = (n, ref) => (n.dot(ref) < 0 ? n.negate() : n);
    D.poly([tri(a, zA), tri(b, zA), tri(b, zB), tri(a, zB)], fix(nTop, inn), PAL.belly, 'solid', 99);
    D.poly([tri(b, zA), tri(c, zA), tri(c, zB), tri(b, zB)], fix(nFront, inn), PAL.trim, 'solid', 99);
    const n0 = [W(...a, 0), W(...b, 0), W(...c, 0)];
    D.poly([tri(a, zA), tri(c, zA), tri(b, zA)], V3(0, 0, -1), PAL.trim, 'solid', 99); D.poly([tri(a, zB), tri(b, zB), tri(c, zB)], V3(0, 0, 1), PAL.trim, 'solid', 99);
    // (the nosing: a yellow strip along the tread's front edge, on its top)
    const bn = [b[0] - hu * 0.07, b[1] - hw * 0.07];
    D.poly([W(bn[0], bn[1] + 0.002, zA), W(b[0], b[1] + 0.002, zA), W(b[0], b[1] + 0.002, zB), W(bn[0], bn[1] + 0.002, zB)], fix(nTop, inn), PAL.yellow, 'solid', 99);
    void n0;
  }
}
// THE AIRSTAIR DOOR (port): the panel above as a kit door leaf, hinged on its foot (the hinge line along z), swinging
// out and down until its top rests on the ground; it opens as someone comes within 2.6 m of its foot
export const STAIR = { angle: -(Math.atan2(DOOR.head - DOOR.hinge, DOOR.xHead - DOOR.xHinge) + Math.asin(DOOR.hinge / DOOR_LEN)), slope: Math.asin(DOOR.hinge / DOOR_LEN) };
function ebAirstair(p) {
  p.leaf('eb:airstair', (lp) => { const acc = new Acc(); hatchPanel(acc, 1, true); acc.flush(lp); }, { door: 'stair', hinge: { at: [DOOR.xHinge, DOOR.hinge - DECK, 0], axis: [0, 0, 1], angle: STAIR.angle } });
  p.door('stair', [DOOR.xHinge + 1.8, -DECK + 1.0, (DOOR.z[0] + DOOR.z[1]) / 2], 2.6, 0.9);
  return p;
}

// ── THE LANDING GEAR ────────────────────────────────────────────────────────────────────────────────────────────────
// each leg, from the 8k: its strut and its foot as two leaves of one kit door ('gear'): as it opens (gear up), the
// strut turns a1 about its hinge, the foot a2 more about its ankle, so the leg folds into its well (the nose leg's hinge
// is only the centre of its turn, over its top: it swings up and forward). Starboard's is the
// port one mirrored. The well's doors (ebGearDoors) are another door ('gear doors'); the game, or the lab, moves the two
// in turn (gearStep)
export const GEAR_SPEED = 0.42, GEAR_DOOR_SPEED = 0.9;
const legMesh = (name, mirror) => C.legMesh(GEAR[name], Q, mirror);
function ebGear(p, which) {
  const G = legMesh(which === 'nose' ? 'nose' : 'aft', which === 'starboard');
  // (the strut light metal, its housing's flat faces dark; the foot dark, its pad's sole rubber)
  const paint = (f, isFoot) => (isFoot ? (f.n.y < -0.9 ? PAL.rubber : PAL.trim) : Math.abs(f.n.y) > 0.85 ? PAL.trim : PAL.metal);
  return C.legLeaves(p, G, { key: 'eb', which, dk, paint, door: 'gear', speed: GEAR_SPEED });
}
// THE WELLS' DOORS: the nose's, the belly's skin cut out of its well, in two halves; each hangs open (down) while the
// gear is down and shuts flush into the belly when it is up. The aft bays' (built-common.js bayDoors): the pod's bottom
// in fore and aft halves, each folding in two as it opens (and, if the bay's spec gives a `strip`, the low strip of its
// side, a flap that swings out and up). (The door 'gear doors': open = shut, here: t 1 is shut.)
const DOOR_OPEN = 1.75;   // (radians: how far they hang: past straight down, leaning out, clear of the leg as it swings)
// (a face on the hull's lower band, painted by the hull's own rules)
const lowerFace = (P, n) => ({ part: 'body', zone: 'lower', n, c: P.reduce((t, v) => t.add(v), V3(0, 0, 0)).multiplyScalar(1 / P.length), thin: false });
const lowerPaint = (P, n) => C.paintOf(RULES, PAL, lowerFace(P, n), PAL.trim);
function ebGearDoors(p, which) {
  if (WELLS[which].bay) C.bayDoors(p, which, WELLS[which].bay, { key: 'eb', paint: lowerPaint, inner: PAL.trim, dk });
  else C.wellDoors(p, DOORS[which], { key: 'eb', which, open: DOOR_OPEN, paint: (P, n) => C.paintOf(RULES, PAL, lowerFace(P, n), PAL.belly), inner: PAL.trim, dk });
  p.door('doors', [0, -DECK, 0], 0, GEAR_DOOR_SPEED);
  return p;
}
// THE WELLS: the nose's, dark walls standing on its rim up to its ceiling, and the ceiling. The aft bays (built-common.js
// bayPod): the gear pod's outside (its side over the flap and its ends, painted as the lower hull), the bay's inside dark
// (the inner wall, the ceiling under the deck, the step and the roof over the pod) and the axle the strut turns on.
function ebWells(p) {
  const acc = new Acc();
  for (const W of Object.values(WELLS)) {
    if (W.bay) C.bayPod(acc, W.bay, { paint: lowerPaint, dark: PAL.trim, metal: PAL.metal, dk });
    else C.wellWalls(acc, W, { dark: PAL.trim, dk });
  }
  return acc.flush(p);
}
// MOVING THE GEAR (the game, or the lab): up folds the legs, then shuts the wells' doors; down opens the doors, then
// lowers the legs (built-common.js gearStep). built: buildRoom's result; updateDoors: the kit's (kit/layout.js; passed
// in, as this file is part of the catalog the layout code reads). Returns whether anything moved.
export const gearStep = (built, up, dt, updateDoors) => C.gearStep(built, up, dt, updateDoors, 'ebGear', 'ebGearDoors');

// ── THE GRIME (built-common.js grimeMaterials): the kit's painted material, with dirt laid over the clean paint by one
// amount (0 clean to 1 filthy; the clean look is the base): crevices and joins, blotches, streaks from STREAKS, worn
// edges. grimeMaterials(mats, { dirt }) returns the material set with its painted material (and the door leaves')
// swapped for these; GRIME.dirt.value changes the amount live.
export const STREAKS = [
  // [x, y, z (ship frame, metres), flow dx, dy, dz, length, width]: the roof's vents (aft), the side vents (aft and
  // down), each engine's nozzle (soot creeping forward up the nacelle from its rim)
  [0, 5.15, 1.05, 0, -0.08, -1, 3.2, 0.5], [1.55, 4.75, 1.85, 0, -0.1, -1, 2.4, 0.3], [-1.55, 4.75, 1.85, 0, -0.1, -1, 2.4, 0.3],
  [0, 4.75, -2.35, 0, -0.1, -1, 2.0, 0.6], [2.75, 4.35, -0.1, 0, -0.35, -1, 2.6, 0.25], [-2.75, 4.35, -0.1, 0, -0.35, -1, 2.6, 0.25],
  [2.32, 3.49, -8.62, 0, 0, 1, 1.6, 1.3], [-2.32, 3.49, -8.62, 0, 0, 1, 1.6, 1.3],
  [3.15, 2.6, -1.0, 0, -1, -0.25, 1.4, 0.35], [-3.15, 2.6, -1.0, 0, -1, -0.25, 1.4, 0.35],
];
export const GRIME = { dirt: { value: 0.45 } };
export const grimeMaterials = (mats, { dirt } = {}) => C.grimeMaterials(mats, { dirt, streaks: STREAKS, deck: DECK, grime: GRIME, key: 'ebgrime', glowKey: 'ebglow' });

// ── IN THE SHIP LAB (labs/ships/main.js): this ship's controls, its close views, its materials, its jets, and how its
// moving parts follow the menu (st: the lab's state; ctx: { updateDoors (the kit's), person (the lab's person, whose
// coming near opens the airstair) })
export const LAB = {
  controls: ['gear', 'door', 'dirt', 'throttle'],
  dirt: { None: 0, Some: 0.45, Lots: 0.9 },
  spots: { Canopy: { at: [6.5, 6.8, 12.5], look: [0, 3.7, 5.2] }, Door: { at: [7.6, 1.6, 4.4], look: [2.2, 2.4, 1.6] }, Seats: { at: [0, 3.75, 3.65], look: [0, 3.0, 7.6] } },
  overlay: 'explorer-b',
  // (the cabin built inside from the blueprint shown, kit/ships/cabin-built.js: the pieces that change with it, and the
  // ship's own door as the cabin meets it: the opening's head over the deck, and where the deck stops at its step)
  cabin: { swap: { ebDoorway: { port: 'port, cabin' }, ebCockpit: { 'two seats': 'two seats, cabin' } }, outer: { head: AIRLOCK.top, sill: +(DOOR.xHinge - AIRLOCK.riser).toFixed(3) } },
  materials: (mats, dirt) => grimeMaterials(mats, { dirt }),
  setDirt: (v) => { GRIME.dirt.value = v; },
  jets: () => [{ role: 'main', nozzles: jetNozzles(), opts: JET }],
  step(B, st, dt, { updateDoors, person }) { gearStep(B, st.gear === 'up', dt, updateDoors); updateDoors(B.doors.filter((D) => D.piece === 'ebAirstair'), person.position, dt, st.door); },
  // (for pictures part way: the moving parts held where `at` says, { gear, doors, stair } each 0 to 1; each moved there
  // from an end, so its leaves are set: from shut by t, or to shut from open)
  pose(B, at, { updateDoors, person }) {
    const of = { gear: 'ebGear', doors: 'ebGearDoors', stair: 'ebAirstair' };
    for (const [k, t] of Object.entries(at)) for (const D of B.doors.filter((d) => d.piece === of[k])) { D.t = t > 0 ? 0 : 1; updateDoors([D], person.position, t > 0 ? t / D.speed : 2 / D.speed, t > 0 ? 'open' : 'shut'); }
  },
};

// ── the catalog ─────────────────────────────────────────────────────────────────────────────────────────────────────
const GR = 'Ships';
export const SHIP_EXPLORER_BUILT = {
  ebHull: { name: 'Explorer C (built): hull', group: GR, at: 'free', foot: [13, 6.3, 17.3], variants: ['hull'], build: ebHull },
  ebCanopy: { name: 'Explorer C (built): canopy', group: GR, at: 'free', foot: [5, 2, 6], variants: ['glass'], build: ebCanopy },
  ebMarks: { name: 'Explorer C (built): lights and marks', group: GR, at: 'free', foot: [13, 6, 17], variants: ['marks'], build: (p) => ebMarks(p) },
  ebDoorway: { name: 'Explorer C (built): doorway', group: GR, at: 'free', foot: [3, 2.5, 2], variants: ['port', 'starboard', 'port, cabin'], build: ebDoorway },
  ebAirstair: { name: 'Explorer C (built): airstair door', group: GR, at: 'free', foot: [3, 2.5, 2], variants: ['port'], build: ebAirstair },
  ebGear: { name: 'Explorer C (built): landing leg', group: GR, at: 'free', foot: [2, 1.6, 2], variants: ['nose', 'port', 'starboard'], build: ebGear },
  ebGearDoors: { name: 'Explorer C (built): gear well doors', group: GR, at: 'free', foot: [2, 1, 2], variants: ['nose', 'port', 'starboard'], build: ebGearDoors },
  ebWells: { name: 'Explorer C (built): gear wells', group: GR, at: 'free', foot: [5, 1, 9], variants: ['wells'], build: ebWells },
  ebCockpit: { name: 'Explorer C (built): cockpit', group: GR, at: 'free', foot: [3, 2, 3], variants: ['two seats', 'two seats, cabin'], build: (p, v) => ebCockpit(p, v) },
};
