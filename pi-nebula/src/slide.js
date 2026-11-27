// A STEP THAT MEETS A WALL, slid along it (walls.js move, for every person who walks: the player, the station's people,
// a way worked out): its own small module, with no three.js, so its rules can be tried on a made-up floor plan
// (tests/slide.test.mjs).
//   const blocked = makeSlide(tryStep, stride, seen)
//     tryStep(pos, sx, sz, r, doorsOpen) -> true: the step taken (pos, { x, y, z }, moved), false: not (pos as it was)
//     stride: a walk is checked every this far (m)
//     seen(kind, k): optional, for the rigs and tests: told of each shuffle taken ('nudge' head on, 'corner' round a
//     door's corner) and how many small steps sideways it moved her
//   blocked(pos, sx, sz, fr, r, doorsOpen, square) -> true: moved on along the walls, false: no way on
//     the step (sx, sz) was not taken; fr: the frame the walls there run in ({ c, s }: a part stood somewhere else, a
//     ship set down crooked), or null (the station's: along x and z); square: the walls there do run along that frame
//     (false where only a part with no frame of its own may be met: a planet's rocks, the wreck, the pods)
// a person walking head on into a door's frame is eased sideways into the opening, up to `most` (m), in steps of `step`
export const NUDGE = { most: 0.24, step: 0.02 };
// (the corner rule's look along the face for an opening, before the small steps are walked: points this far along it,
// no further apart than the narrowest opening's band for her middle it must not miss (a gap 4 cm wider than her))
const LOOK = [0.04, 0.08, 0.12, 0.16, 0.2, 0.24];
// (a little off square: the push's sideways part under this much of its greater part, tan 30 degrees)
const OFF_SQUARE = Math.tan(Math.PI / 6);

export function makeSlide(tryStep, stride, seen = null) {
  const copy = (a, b) => { a.x = b.x; a.y = b.y; a.z = b.z; return a; };
  const _n = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], _f = { x: 0, y: 0, z: 0 }, _g = { x: 0, y: 0, z: 0 }, _h = { x: 0, y: 0, z: 0 }, _m = { x: 0, y: 0, z: 0 };
  // (the step taken from a point a little to the side, nearest first, up to NUDGE away: the person moved there)
  // (sideways a small step at a time, as a person would shuffle: never through anything; (ux, uz) the way sideways, a
  // unit; both: to either side, else to that side only. opens(p): must also hold where the step goes on (the corner's:
  // a real opening). walked: she is moved no further sideways in one stride than the stride's own length toward where
  // the way on was found, and from there takes the step's greater part (gsx, gsz) if it goes; the next stride looks
  // again)
  let gsx = 0, gsz = 0;
  function nudge(pos, sx, sz, ux, uz, r, doorsOpen, both, opens, walked, kind) {
    const px = ux * NUDGE.step, pz = uz * NUDGE.step, m = Math.max(1, Math.floor(Math.hypot(sx, sz) / NUDGE.step + 1e-9));
    let open0 = true, open1 = both;
    copy(_n[0], pos); copy(_n[1], pos);
    for (let k = 1; k * NUDGE.step <= NUDGE.most + 1e-6 && (open0 || open1); k++) for (let i = 0; i < 2; i++) {
      if (i ? !open1 : !open0) continue;
      const sg = i ? -1 : 1;
      if (!tryStep(_n[i], px * sg, pz * sg, r, doorsOpen)) { if (i) open1 = false; else open0 = false; continue; }
      // (the point a stride's worth along each side, kept: where a walked shuffle stops this stride)
      if (k === m) copy(i ? _m : _h, _n[i]);
      if (opens && !opens(_n[i], r, doorsOpen)) continue;
      copy(_f, _n[i]);
      if (!tryStep(_f, sx, sz, r, doorsOpen)) continue;
      if (walked && k > m) { copy(pos, i ? _m : _h); if (gsx || gsz) tryStep(pos, gsx, gsz, r, doorsOpen); if (seen) seen(kind, m); return true; }
      copy(pos, _f); if (seen) seen(kind, k); return true;
    }
    return false;
  }
  // A REAL OPENING (RAMP 2's review, Y1, Y3, Y8): from p the step's greater part alone goes on, stride by stride, for her
  // own whole width. One voxel's step of a slanted or round wall, a rock's face, a gap narrower than her: none does
  let gx = 0, gz = 0;
  const opening = (p, r, doorsOpen) => {
    // (first, cheaply, where she would be half way and all the way: most spots that are no opening fail there)
    for (let q = 1; q <= 2; q++) { copy(_g, p); _g.x += gx * (q * r - stride); _g.z += gz * (q * r - stride); if (!tryStep(_g, gx * stride, gz * stride, r, doorsOpen)) return false; }
    copy(_g, p);
    for (let d = 0; d < 2 * r - 1e-9; d += stride) if (!tryStep(_g, gx * stride, gz * stride, r, doorsOpen)) return false;
    return true;
  };
  return function blocked(pos, sx, sz, fr, r, doorsOpen, square = true) {
    // a wall: slide along it (the station's walls run along x and z; in a part stood somewhere else, a ship set down
    // crooked, they run along that part's own two ways, so a person slides along its cabin's walls as ever)
    // (the step's two parts, along the walls' own two ways)
    let ax = sx, az = 0, bx = 0, bz = sz;
    if (fr) { const l0 = fr.c * sx - fr.s * sz, l1 = fr.s * sx + fr.c * sz; ax = fr.c * l0; az = -fr.s * l0; bx = fr.s * l1; bz = fr.c * l1; }
    const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
    // PUSHED A LITTLE OFF SQUARE INTO THE CORNER OF A DOOR'S FRAME (the Medic's ramp on a planet, walked up 0.1 to 0.45
    // rad off straight: caught at its opening's jamb at every heading; and the station's narrow doors alike; RAMP_2.md).
    // The step's greater part is stopped by the face across her way; its lesser part slid her along that face AWAY from
    // the opening, at a crawl, and for good where the ramp's edge stopped that too. A round body meeting a corner is
    // turned round it, into the opening. So, where the greater part is stopped:
    //   - looked for first, cheaply: a few points along the face, against the push's sideways part, up to NUDGE.most;
    //     only if the greater part's first stride goes from one of them is the face walked a small step at a time
    //     (at a flat wall none does: nothing more is tried);
    //   - never out of an opening the push already leads her into: if her sideways part alone takes her, within her own
    //     width, to where the greater part goes on (she is in a side door), she slides on as ever;
    //   - only a real opening counts (above), and she is walked toward it, no further a stride than the stride's own
    //     length; the next stride looks again. Where nothing is found, the slide as ever;
    //   - only a little off square: the push within 30 degrees of one of the walls' ways (pushed corner-wise, 45
    //     degrees, it is no more into the door than along the wall), and only where the walls run along the frame.
    const g = la >= lb, gl = g ? la : lb, ll = g ? lb : la;
    if (square && ll > 1e-6 && ll < gl * OFF_SQUARE) {
      gx = (g ? ax : bx) / gl; gz = (g ? az : bz) / gl;
      const lx = (g ? bx : ax) / ll, lz = (g ? bz : az) / ll;
      gsx = g ? ax : bx; gsz = g ? az : bz;
      copy(_g, pos);
      if (!tryStep(_g, gx * stride, gz * stride, r, doorsOpen) && looked(pos, -lx, -lz, r, doorsOpen) && !intoOpening(pos, lx, lz, r, doorsOpen) &&
        nudge(pos, sx, sz, -lx, -lz, r, doorsOpen, false, opening, true, 'corner')) return true;
    }
    const a = la > 1e-6 && tryStep(pos, ax, az, r, doorsOpen), b = lb > 1e-6 && tryStep(pos, bx, bz, r, doorsOpen);
    const L = Math.hypot(sx, sz), crawl = L < stride - 1e-6;
    // (one part taken, a slide along a wall. But if the part that went nowhere is the greater one, it may be a sliver
    // across their way that stopped it, below: that part tried again a stride long, once the slide is taken)
    if (a || b) { if (crawl && !b && lb > la) tryStep(pos, bx / lb * stride, bz / lb * stride, r, doorsOpen); else if (crawl && !a && la > lb) tryStep(pos, ax / la * stride, az / la * stride, r, doorsOpen); return true; }
    // A SLIVER, STEPPED OVER. A strip a few centimetres across where a body may not stand, or no floor is found (the
    // edge of a riser where one floor ends and the next begins; the corner of a cabinet's end, felt only where it falls
    // on one of the eight points a body is felt at), is crossed by a walking step without knowing. But someone held
    // up a moment walks on at a crawl, a few millimetres a frame, and such a step lands in the strip every time: they
    // stood there for good with the key held (the Medic: at the step up into its cockpit, and beside its bay's door,
    // by a cabinet's end, coming from the top of its port ramp; rigs/rescue-8/lab.cjs --mode=door, RESCUE_8.md). So a
    // step that goes nowhere is tried again a stride long: the way they push, then along the wall they slide on. It
    // lands only where a body may stand, as any step (nothing a body cannot pass is passed)
    if (crawl) {
      const k = stride / L;
      if (tryStep(pos, sx * k, sz * k, r, doorsOpen)) return true;
      if (la >= lb ? la > 1e-6 && tryStep(pos, ax / la * stride, az / la * stride, r, doorsOpen) : lb > 1e-6 && tryStep(pos, bx / lb * stride, bz / lb * stride, r, doorsOpen)) return true;
    }
    // head on into a door's frame, a little off its middle: eased sideways into the opening (a narrow ship's door
    // needs a person lined up within a hand's width, too fine for a thumb on a stick)
    gsx = gsz = 0;
    return nudge(pos, sx, sz, -sz / L, sx / L, r, doorsOpen, true, null, false, 'nudge');
  };
  // (the cheap look: from a point LOOK along the face (ux, uz), does the greater part's first stride go)
  function looked(pos, ux, uz, r, doorsOpen) {
    for (let i = 0; i < LOOK.length; i++) { copy(_g, pos); _g.x += ux * LOOK[i]; _g.z += uz * LOOK[i]; if (tryStep(_g, gx * stride, gz * stride, r, doorsOpen)) return true; }
    return false;
  }
  // (her sideways part (lx, lz) alone, stride by stride for her own width: does it bring her to where the greater part
  // goes on, an opening the way she pushes)
  function intoOpening(pos, lx, lz, r, doorsOpen) {
    copy(_f, pos);
    for (let d = 0; d < 2 * r - 1e-9; d += stride) {
      if (!tryStep(_f, lx * stride, lz * stride, r, doorsOpen)) return false;
      copy(_g, _f); if (tryStep(_g, gx * stride, gz * stride, r, doorsOpen)) return true;
    }
    return false;
  }
}
