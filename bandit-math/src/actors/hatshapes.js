// HAT SHAPES: the hats of src/hats.js as meshes for a person's Head bone (folk.js puts them on). The cowboy hat and the
// white hat are the farmer's own hat (models/people/hat.glb); the others are turned on a lathe (a profile spun round
// the head, like a potter's wheel) at a low-poly 20 sides, to sit with the Quaternius people, then bent: a brim curled
// up at the sides, a crease down the crown, a crown pinched to a peak. Every shape is made in the Head bone's own space
// (metres: y up from the neck, +z the face) round the room the hair is tucked into (folk.js's CROWN), so it fits every
// head the farmer's hat fits. Each vertex carries a colour (how light it is: the band darker) and the "hat or pack"
// group number (6), so folk.js paints it with its period colour like any other clothes.
//
//   hatPiece(lib, id) -> { geometry, matrix, mean, colour } | null   (lib: from loadFolk; made once a style, then shared)
//     geometry  in the Head bone's space when matrix is null; else in the hat file's own (matrix: where it sits)
//     mean      the average lightness of its colours (folk.js keeps its folds against this)
//     colour    the hat's own colour (null: the outfit's)
import * as THREE from 'three';
import { HATS, hatById } from '../hats.js';
import { softShade } from './shading.js';

const SIDES = 20;            // round the lathe: low-poly, like the people
const OVAL = 1.1;            // a head is longer front to back than across: every shape is stretched this much along z
const MIDDLE_Z = 0.015;      // the crown's middle sits this far forward of the Head bone (the hair's room: folk.js CROWN)
const BAND = 0.34;           // how light the hat band is against the felt (1)

// The profiles: [across (m from the middle), up (m from the Head bone), lightness], from the inside of the brim at the
// head, out under the brim to its edge, back over the top of the brim, up the crown and over its top to the middle.
// (The crown is never narrower than about 0.11 m at the band, so the ears stay inside it, nor lower than about 0.26 m:
// the hair inside is drawn in to fit that room.)
const PROFILES = {
  straw: [[0.099, 0.117], [0.17, 0.114], [0.226, 0.108], [0.232, 0.115], [0.228, 0.121], [0.17, 0.127], [0.114, 0.133, BAND],
    [0.114, 0.158, BAND], [0.113, 0.161], [0.11, 0.248], [0.102, 0.26], [0.06, 0.264], [0, 0.265]],
  bowler: [[0.099, 0.121], [0.128, 0.124], [0.142, 0.138], [0.137, 0.146], [0.125, 0.136], [0.114, 0.134, BAND],
    [0.114, 0.156, BAND], [0.115, 0.159], [0.115, 0.19], [0.107, 0.222], [0.09, 0.248], [0.064, 0.264], [0.032, 0.272], [0, 0.274]],
  ranger: [[0.099, 0.12], [0.16, 0.12], [0.205, 0.119], [0.207, 0.127], [0.16, 0.13], [0.114, 0.133, BAND], [0.114, 0.156, BAND],
    [0.113, 0.159], [0.105, 0.2], [0.086, 0.243], [0.05, 0.285], [0.018, 0.304], [0, 0.307]],
  cattleman: [[0.099, 0.12], [0.15, 0.118], [0.193, 0.114], [0.197, 0.123], [0.15, 0.129], [0.114, 0.133, BAND], [0.114, 0.162, BAND],
    [0.113, 0.165], [0.111, 0.225], [0.104, 0.268], [0.09, 0.286], [0.05, 0.293], [0, 0.294]],
  sombrero: [[0.099, 0.122], [0.17, 0.113], [0.26, 0.111], [0.315, 0.125], [0.343, 0.157], [0.346, 0.172], [0.336, 0.171],
    [0.318, 0.141], [0.26, 0.124], [0.17, 0.127], [0.114, 0.134, BAND], [0.114, 0.163, BAND], [0.113, 0.166], [0.107, 0.215],
    [0.09, 0.27], [0.064, 0.31], [0.03, 0.33], [0, 0.334]],
};
// how each shape is bent after turning: curl (a brim lifted at the sides, m at the edge), crease (the crown's top pressed
// down along the middle, m), peak (a crown pinched in on four sides toward its top, a share of its width)
const BENDS = {
  straw: {}, bowler: { curl: 0.012 },
  ranger: { peak: 0.32 },
  cattleman: { curl: 0.05, crease: 0.03 },
  sombrero: {},
};
// the white hat is the cowboy hat's own shape, in cream
const SAME_AS_COWBOY = { cowboy: true, white: true };

function turn(id) {
  const prof = PROFILES[id], bend = BENDS[id] || {};
  const pts = prof.map(([r, y]) => new THREE.Vector2(r, y));
  const lathe = new THREE.LatheGeometry(pts, SIDES);
  const g = lathe.toNonIndexed(); lathe.dispose();
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  const pos = g.attributes.position, n = pos.count;
  const colour = new Float32Array(n * 3), kind = new Float32Array(n).fill(6);
  const top = prof[prof.length - 1][1];
  const crownFrom = prof.find((p) => p[2] === BAND)[1];          // (where the band starts: the crown is above it)
  const brimR = Math.max(...prof.map((p) => p[0]));
  for (let i = 0; i < n; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    // the lightness: the profile point this vertex came from (the nearest one, by height and width)
    let best = 1, bd = Infinity; for (const [pr, py, pl = 1] of prof) { const d = Math.abs(pr - r) + Math.abs(py - y); if (d < bd) { bd = d; best = pl; } }
    colour[i * 3] = colour[i * 3 + 1] = colour[i * 3 + 2] = 0.6 * best;
    const a = Math.atan2(x, z), side = Math.sin(a) ** 2;      // (side: 1 at the ears, 0 front and back)
    if (bend.curl && r > 0.11) y += bend.curl * ((r - 0.11) / (brimR - 0.11)) ** 2 * side;
    if (y > crownFrom + 0.02) {
      const t = (y - crownFrom) / (top - crownFrom);
      if (bend.peak) { const k = 1 - bend.peak * t * t * (0.5 + 0.5 * Math.cos(4 * a)); x *= k; z *= k; }
      if (bend.crease) y -= bend.crease * Math.max(0, 1 - Math.abs(x) / 0.075) * Math.max(0, (t - 0.55) / 0.45);
    }
    pos.setXYZ(i, x, y, z * OVAL + MIDDLE_Z);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colour, 3));
  g.setAttribute('_kind', new THREE.BufferAttribute(kind, 1));
  g.computeVertexNormals();
  const soft = softShade(g, 50);                                 // (round crowns, crisp brim edges)
  return { geometry: soft, matrix: null, mean: 0.6 };
}

export function hatPiece(lib, id) {
  if (!lib || !lib.hat) return null;
  const h = hatById(id) || HATS[0];
  lib.hatPieces = lib.hatPieces || {};
  if (!lib.hatPieces[h.id]) {
    const made = SAME_AS_COWBOY[h.id] || !PROFILES[h.id]
      ? { geometry: lib.hat.geometry, matrix: lib.hat.matrix, mean: lib.hat.mean.w }
      : turn(h.id);
    lib.hatPieces[h.id] = { ...made, colour: h.colour, id: h.id };
  }
  return lib.hatPieces[h.id];
}
