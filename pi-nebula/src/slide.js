// A STEP THAT MEETS A WALL, slid along it (walls.js move, for every person who walks: the player, the station's people,
// a way worked out): its own small module, with no three.js, so its rules can be tried on a made-up floor plan
// (tests/slide.test.mjs).
//   const blocked = makeSlide(tryStep, stride)
//     tryStep(pos, sx, sz, r, doorsOpen) -> true: the step taken (pos, { x, y, z }, moved), false: not (pos as it was)
//     stride: a walk is checked every this far (m)
//   blocked(pos, sx, sz, fr, r, doorsOpen) -> true: moved on along the walls, false: no way on
//     the step (sx, sz) was not taken; fr: the frame the walls there run in ({ c, s }: a part stood somewhere else, a
//     ship set down crooked), or null (the station's: along x and z)
// a person walking head on into a door's frame is eased sideways into the opening, up to `most` (m), in steps of `step`
export const NUDGE = { most: 0.24, step: 0.02 };

export function makeSlide(tryStep, stride) {
  const copy = (a, b) => { a.x = b.x; a.y = b.y; a.z = b.z; return a; };
  // (the step taken from a point a little to either side, nearest first, up to NUDGE away: the person moved there)
  // (sideways a small step at a time, as a person would shuffle: never through anything; (ux, uz) the way sideways, a
  // unit)
  const _n = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], _f = { x: 0, y: 0, z: 0 };
  function nudge(pos, sx, sz, ux, uz, r, doorsOpen) {
    const px = ux * NUDGE.step, pz = uz * NUDGE.step;
    let open0 = true, open1 = true;
    copy(_n[0], pos); copy(_n[1], pos);
    for (let k = 1; k * NUDGE.step <= NUDGE.most + 1e-6 && (open0 || open1); k++) for (let i = 0; i < 2; i++) {
      if (i ? !open1 : !open0) continue;
      const sg = i ? -1 : 1;
      if (!tryStep(_n[i], px * sg, pz * sg, r, doorsOpen)) { if (i) open1 = false; else open0 = false; continue; }
      copy(_f, _n[i]);
      if (tryStep(_f, sx, sz, r, doorsOpen)) { copy(pos, _f); return true; }
    }
    return false;
  }
  return function blocked(pos, sx, sz, fr, r, doorsOpen) {
    // a wall: slide along it (the station's walls run along x and z; in a part stood somewhere else, a ship set down
    // crooked, they run along that part's own two ways, so a person slides along its cabin's walls as ever)
    // (the step's two parts, along the walls' own two ways)
    let ax = sx, az = 0, bx = 0, bz = sz;
    if (fr) { const l0 = fr.c * sx - fr.s * sz, l1 = fr.s * sx + fr.c * sz; ax = fr.c * l0; az = -fr.s * l0; bx = fr.s * l1; bz = fr.c * l1; }
    const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
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
    if (nudge(pos, sx, sz, -sz / L, sx / L, r, doorsOpen)) return true;
    // PUSHED A LITTLE OFF SQUARE INTO THE CORNER OF A DOOR'S FRAME. The shuffle square across the push leans into the
    // face the body is pressed against (as much as the push is off square), so its very first sideways step is stopped,
    // and she stood there for good with the stick held (the Medic's ramp on a planet, walked up 0.2 rad off straight:
    // caught on its opening's jamb at every heading; RAMP_2.md). So the shuffle is tried along that face too: along the
    // walls' own way across the push (its lesser part's), as a person slides along a wall to its end and round the
    // corner. Only when the push is off square (head on, the two shuffles are one), and only where the first got nowhere.
    if (la > 1e-6 && lb > 1e-6) return la < lb ? nudge(pos, sx, sz, ax / la, az / la, r, doorsOpen) : nudge(pos, sx, sz, bx / lb, bz / lb, r, doorsOpen);
    return false;
  };
}
