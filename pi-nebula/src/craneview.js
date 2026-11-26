// THE CRANE'S VIEWS, worked by hand (src/cranedrive.js) and in the crane game (src/jobs/cranelink.js): the sums
// behind them, with no page and no three.js, so node tests them (tests/craneview.test.mjs).
//
// THE GAME'S MAKER (2026-11-26, after playing free control): "I like the orbit controls of the crane a lot, except
// that I can't keep orbiting. It seems like there is a stop. Can you remove that? ... I am thinking we don't even
// really need the wall mounted camera views, at least not 4 of them. One is probably best. With the crane view, I wish
// it was one you could look straight down from (like it is on the part that lowers down). The idea is that the crane
// view is useful for lining up the canister (so maybe a targeting crosshair or box would be useful). But right now
// when the crane is up it often blocks the view for the crane camera."
//
//   - THREE VIEWS: following the load, the crane's own looking straight down from the grab, one wall camera.
//   - THE ORBIT has no stop: the drag turns it round as often as you like (orbitBy). It used to be held to 2.6
//     radians either way of the hangar's middle side of the hook, so it never came round to the wall side, where the
//     old rule (the eye pushed back inside the hangar's box) pressed it flat against the wall. Now, where the eye would
//     be behind a wall or inside something, it is brought in along its own line toward the hook to where it is clear,
//     as the flying's view from behind does (src/flying.js): clearAlong.
//   - THE CRANE'S OWN VIEW (grabCam): from the middle of the grab, just under its frame, straight down, so nothing of
//     the crane is ever between it and what is under the grab. A held canister hangs right under that spot: in this
//     view it is not drawn (the camera's near plane is put just past its underside), and the mark shows where it is.
//   - THE MARK (markOf): a crosshair straight under the grab and a box the size of a canister, lying the way the cradle
//     holds it, where it will come down: on the place the crane is lined up with (a canister to take, or a free place
//     for the one it holds), else on whatever is under the grab. Its colour is the docking lights' (the readout's dots
//     beside X and Y): amber near a place, green when both are right; light lines otherwise.
//
//   VIEWS, VIEW_NAMES, WALL_CAM
//   orbitBy(orbit, dx) -> orbit              a drag of dx pixels; no stop (kept between -PI and PI: the same view)
//   orbitEye(hook, base, orbit, zoom) -> [x, y, z]   where the follow view wants to be
//   clearAlong(a, b, clear, opts) -> t (0..1)  how far along a -> b stays clear (clear(x, y, z): true where clear)
//   hangarClear(site, solid, opts) -> clear(x, y, z)   inside the hangar and clear of what stands still
//   fitFov(fov, aspect, dist, radius) -> fov  the lens widened just enough to keep the load wholly in the picture
//                                            when the view has been brought in close to it (on a wall's side)
//   grabCam(S, dims) -> { name, at, look, fov, near, down }   the crane's own camera (plain [x, y, z])
//   markOf(read, S, site, solid) -> { at, axis, half, R, look }   the box's middle, its long way (radians), its size
//   markCorners(m) -> four [x, y, z]

export const WALL_CAM = 'miner-cam-sw';
export const VIEWS = ['follow', 'crane', WALL_CAM];
export const VIEW_NAMES = { follow: 'Following the load', crane: 'From the grab, looking straight down', [WALL_CAM]: 'Wall camera' };

// ── the orbit ───────────────────────────────────────────────────────────────────────────────────────────────────
export const ORBIT = { perPixel: 0.006, least: 1.2, step: 0.1, r: 0.35, lo: 2.2, hi: 8.0, over: 3.2 };
const TAU = Math.PI * 2;
export function orbitBy(orbit, dx) {
  let a = orbit - dx * ORBIT.perPixel;
  a = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a;
}
// (from the hook at `orbit` radians round from `base`, `zoom` metres out, above it)
export function orbitEye(hook, base, orbit, zoom) {
  const a = base + orbit;
  return [hook[0] + Math.sin(a) * zoom, Math.min(ORBIT.hi, Math.max(ORBIT.lo, hook[1] + ORBIT.over)), hook[2] + Math.cos(a) * zoom];
}
// how far along the line from a to b stays clear: 1 all the way, else the share just short of the first point that is
// not (the first `from` metres are not looked at: the hook's own place)
export function clearAlong(a, b, clear, { step = ORBIT.step, from = 0.5 } = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  if (L < 1e-6) return 1;
  const n = Math.ceil(L / step);
  for (let i = 1; i <= n; i++) {
    const t = i / n; if (t * L < from) continue;
    if (!clear(a[0] + dx * t, a[1] + dy * t, a[2] + dz * t)) return Math.max(0, (i - 1) / n);
  }
  return 1;
}
// the hangar as the follow view may use it: the box the old rule kept it in (the hook's reach and a little), under
// the crane's rail, and `r` clear of what stands still (the walls, the ship, the rack, the sockets: the crane's own)
export function hangarClear(site, solid = null, { r = ORBIT.r } = {}) {
  const x0 = site.rail.x[0] - 1, x1 = site.rail.x[1] + 1, z0 = site.rail.z[0] - 0.6, z1 = site.rail.z[1] + 0.6, y1 = site.rail.y - 0.3;
  return (x, y, z) => {
    if (x < x0 || x > x1 || z < z0 || z > z1 || y > y1 || y < 0.3) return false;
    if (!solid) return true;
    return !(solid(x, y, z) || solid(x + r, y, z) || solid(x - r, y, z) || solid(x, y + r, z) || solid(x, y - r, z) || solid(x, y, z + r) || solid(x, y, z - r));
  };
}

// where the view has been brought in close (the wall's side of the load), the lens is widened just enough that the
// load (a ball of `radius` round the hook) stays wholly in the picture, the narrower way of the screen deciding (an
// upright phone: across); never wider than `most` degrees up and down
export const FIT = { most: 110, margin: 1.1 };
export function fitFov(fov, aspect, dist, radius, { most = FIT.most, margin = FIT.margin } = {}) {
  const half = (fov / 2) * Math.PI / 180, narrow = aspect < 1 ? Math.atan(Math.tan(half) * aspect) : half;
  const need = Math.asin(Math.min(0.97, (radius * margin) / Math.max(dist, 1e-6)));
  if (need <= narrow) return fov;
  const v = aspect < 1 ? Math.atan(Math.tan(need) / aspect) : need;
  return Math.min(most, (2 * v * 180) / Math.PI);
}

// ── the crane's own camera: on the grab, straight down ─────────────────────────────────────────────────────────
export const GRAB = { under: 0.09, fov: 70, near: 0.03, past: 0.12 };
export function grabCam(S, dims) {
  const held = S.cans ? S.cans.some((q) => q.where === 'held') : false;
  // (just under the grab's frame, in its middle: the arms open out to the sides, the cables and the block are above)
  const over = dims.grip.under - GRAB.under;
  return { name: 'crane', at: [S.x, S.hoist + over, S.z], look: [S.x, S.hoist - 3, S.z], fov: GRAB.fov, down: true,
    // (a held canister hangs right under it: the near plane just past its underside, so it is not drawn here)
    near: held ? over + dims.R + GRAB.past : GRAB.near };
}

// ── the mark: where the grab (or the canister it holds) will come down ─────────────────────────────────────────────
// read: the drive's readout (kit/crane-drive.js read(): place, aids, held, yaw); S its state (the held canister's turn
// in the cradle); solid(x, y, z): what stands still (the floor is y 0)
export function markOf(read, S, site, solid = null) {
  const R = site.dims.R, half = site.can.half, held = read.held >= 0;
  const yaw = held && S.cans[read.held] ? S.yaw + (S.cans[read.held].rel || 0) : S.yaw;
  const P = read.place;
  if (P && P.at) {
    const a = read.aids || {}, on = a.x === 'on' && a.y === 'on';
    return { at: [P.at[0], P.at[1], P.at[2]], axis: P.axis ?? yaw, half, R, look: on ? 'on' : 'near', place: P.kind };
  }
  // (no place: on whatever is under the grab's middle, a canister's middle over it)
  const x = read.x, z = read.z;
  let y = read.hook - (held ? R : 0) - 0.05, floor = 0;
  if (solid) for (; y > 0; y -= 0.05) if (solid(x, y, z)) { floor = y; break; }
  return { at: [x, floor + R, z], axis: yaw, half, R, look: 'off', place: null };
}
// the box's corners (the canister's outline seen from above: its length along `axis`, from +z toward +x)
export function markCorners(m) {
  const ax = Math.sin(m.axis), az = Math.cos(m.axis), cx = az, cz = -ax, [x, y, z] = m.at;
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([u, v]) => [x + ax * m.half * u + cx * m.R * v, y, z + az * m.half * u + cz * m.R * v]);
}
