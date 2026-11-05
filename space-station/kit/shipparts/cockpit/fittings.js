// THE COCKPIT'S OWN FURNITURE: a small locker (a glovebox) and handholds. His pictures don't show either closely, so
// both are plain, in the station's look (off-white, charcoal, bare metal). Each has its back on a wall (z = 0), faces
// +z and is centred on x = 0.
//   cockpitLocker(p, o)  a small locker with a latch and a STORAGE stencil. o: w (0.5), h (0.6), d (0.35),
//                        y (its bottom above the deck: 0 stands on the deck, or hang it higher)
//   handhold(p, o)       a grab bar on two stand-offs. o: len (0.4), y (its middle above the deck, 1.35),
//                        up (false: along the wall; true: upright)
import { LEAN, LIT } from './look.js';

const PI = Math.PI, FIRM = { r: 0.012, seg: 1, cell: 9, loops: [] };

export function cockpitLocker(p, o = {}) {
  const { w = 0.5, h = 0.6, d = 0.35, y = 0 } = o;
  if (y < 0.05) p.slab('black', -w / 2 + 0.02, w / 2 - 0.02, 0, 0.06, 0.02, d - 0.04, LEAN);
  const y0 = y < 0.05 ? 0.06 : y;
  p.slab('white', -w / 2, w / 2, y0, y0 + h - 0.06, 0, d - 0.025, { ...FIRM, cell: 0.6 });
  p.slab('white2', -w / 2 + 0.02, w / 2 - 0.02, y0 + 0.02, y0 + h - 0.08, d - 0.025, d - 0.008, LEAN);
  p.slab('band', -w / 2 + 0.05, w / 2 - 0.05, y0 + h * 0.36, y0 + h * 0.36 + 0.05, d - 0.008, d - 0.004, { r: 0 });
  p.slab('black', -0.05, 0.05, y0 + h - 0.16, y0 + h - 0.13, d - 0.008, d + 0.012, { r: 0 });   // (the latch)
  p.decal('cp:stow', Math.min(0.24, w - 0.1), Math.min(0.24, w - 0.1) / 4, [0, y0 + h * 0.36 + 0.025, d - 0.0035], null, '#d9d7cf');
  p.slab('black', w / 2 - 0.075, w / 2 - 0.035, y0 + h - 0.165, y0 + h - 0.125, d - 0.008, d - 0.002, { r: 0 }); p.glowSlab(LIT.green, w / 2 - 0.068, w / 2 - 0.042, y0 + h - 0.158, y0 + h - 0.132, d - 0.002, d + 0.001);
  p.decal('hazard', w - 0.08, 0.035, [0, y0 + 0.045, d - 0.0075], null, '#c9a032');   // (hazard stripes along its foot)
}

export function handhold(p, o = {}) {
  const { len = 0.4, y = 1.35, up = false } = o, rot = up ? [0, 0, 0] : [0, 0, PI / 2];
  const at = (t) => (up ? [0, y + t, 0] : [t, y, 0]);
  for (const t of [-len / 2, len / 2]) {
    p.cyl('black', 0.03, 0.012, at(t).map((v, i) => (i === 2 ? 0.006 : v)), [PI / 2, 0, 0], 12);
    p.cyl('black', 0.012, 0.07, at(t).map((v, i) => (i === 2 ? 0.045 : v)), [PI / 2, 0, 0], 8);
  }
  p.cyl('rail', 0.014, len, at(0).map((v, i) => (i === 2 ? 0.075 : v)), rot, 10);
  for (const t of [-len / 2, len / 2]) p.cyl('black', 0.018, 0.02, at(t).map((v, i) => (i === 2 ? 0.075 : v)), rot, 10);   // (its end caps)
  p.cyl('yellow', 0.0145, 0.08, at(0).map((v, i) => (i === 2 ? 0.075 : v)), rot, 10);
}
