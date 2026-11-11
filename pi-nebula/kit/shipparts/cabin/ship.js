// THE SHIPS' INSIDES: the sizes every cabin part is drawn to, and the few colours the cabin adds to the station's.
// The ships are built on a grid the way the station is, at a quarter of its size:
//   cells 0.5 m (the station's are 2 m); heights in 0.5 m steps from the deck (y = 0, the deck stands 1.26 m off the
//   ground); a room is 2.5 m from deck to ceiling (5 steps).
//   A wall stands on a cell edge (its "wall line"), facing +z, as the station's do; two rooms share a wall line with a
//   wall each, back to back. Its face is FACE in from the line, so a corridor two cells wide (1.0 m between wall lines)
//   is 0.94 m clear between the wall faces.
//   A fitting that stands against a wall is drawn with z = 0 on the wall LINE (so it is placed by grid numbers) and
//   keeps behind z = FACE; its middle on x = 0 and its footprint, where that is natural, whole cells.
//   A free-standing fitting (a bed, the reactor, the holo table) is centred on its origin.
//   Everything stands on y = 0, the deck, and faces +z.
export const CELL = 0.5;        // a ship's grid cell
export const STEP = 0.5;        // a height step
export const ROOM = 2.5;        // deck to ceiling
export const FACE = 0.03;       // a wall's face, in from its wall line
export const PERSON = 1.75;     // the person every room is sized for

// how deep a ship wall's layers sit (shell.js's `depth` size): the station's wall is 0.22 m deep to its face, with
// a pocket at its middle for the door leaves; a ship's is FACE deep, the same layers squeezed thin, its relief (how
// far ribs, pilasters and panels stand out) at 0.4 of the station's
export const DEPTH = { pocket: 0.011, back: 0.013, face: FACE, relief: 0.4 };

// the cabin's own surfaces (the station's SURF names are used for everything else): the navy of the cushions and
// blankets in the game's maker's pictures, the pale grey of a mattress or sheet, a bench top
export const NAVY = { c: '#273248', r: 0.88, m: 0, w: 0.3 };       // cushions, bench seats
export const NAVY2 = { c: '#1f2839', r: 0.9, m: 0, w: 0.3 };       // a blanket's folded edge, piping
export const SHEET = { c: '#c7cbcd', r: 0.9, m: 0, w: 0.2 };       // a mattress, sheets, a pillow
export const WORKTOP = { c: '#c3c4bf', r: 0.38, m: 0.05, w: 0.5 }; // a counter or table top (pale, satin)
export const STEEL = { c: '#a9adb2', r: 0.28, m: 0.85, w: 0.35 }; // brushed steel: a sink, a cooktop's rim
export const TEAL = [0.4, 4.6, 4.0];                              // the medical mark's glow (a teal pulse line, never a red cross)
