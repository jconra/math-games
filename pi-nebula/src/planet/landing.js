// SETTING DOWN BESIDE THE WRECK, ITS PLAIN PART (no page and no three.js: node tests it with the game's own flight model,
// tests/planetguide.test.mjs). The game's maker, MED-3: the pilot sets the Medic down beside them, "by hand or by
// autopilot, with the landing guide, as in the hangar". So the planet is made to look, to the game's one flight model
// (src/flymodel.js), like a hangar with one pad:
//   - THE PAD is the middle of the level ground the planet keeps for landing (land.landing, src/planet/land.js), the
//     ship turned side on to the stasis pods so the ramps on its sides face them; the blue ship of the landing guide
//     stands there (src/planet/guide.js), and the guide's sums (flymodel.js guideOf) light the keys toward it.
//   - THE FLOOR it can be set down on is the level ground round the pad (the flight model's `bay`: a square inside the
//     level circle): brought down onto it, by hand, the ship's legs take it and it is down, wherever and whichever way
//     round, as on a hangar's floor (flymodel.js LAND). On the pad, as parked, by the autopilot.
//   - THE GROUND everywhere else is something the ship cannot fly through (groundSolid): it is eased back out of it,
//     keeping the speed that runs along it, as from a hangar's wall or a rock. No damage.
//   - THE AUTOPILOT'S WAY DOWN (planDown): over to the landing place at a safe height over the ground on the way, down
//     to just over the pad, turned as it is to stand, then it sets itself down (flymodel.js fly and its `down` leg).
//
//   planetPad(cfg, land, { toward })   the ship's flight facts for this planet: { ...cfg, pad, q0, bay, floor: null,
//                                      others: null, planet: true } (toward: [x, z] the pods' middle)
//   groundSolid(land, cfg)             what it bumps into: { reach, dist, away, clear } as src/flysolid.js's
//   planDown(S, land)                  the autopilot's legs from wherever the ship is, down onto its pad
import { facing } from '../flymodel.js';
import { SKIN } from '../flysolid.js';

// the floor round the pad: a square this share of the level circle's radius each way (inside the circle, its corners
// too, so all of it is level); the autopilot's height over the highest ground on its way (m), its speeds (m/s), and
// how often along the way the ground is looked at (m)
export const SETDOWN = { floor: 0.7, over: 40, speed: 28, near: 6, step: 25, lowOver: 1.0 };

// the ship's nose for a pad: side on to the pods, its port side (its left: the Medic's ramps are on its sides) toward
// them; with no pods, along +x
export function padNose(land, toward = null) {
  const L = land.landing;
  if (toward) { const tx = toward[0] - L.x, tz = toward[1] - L.z, l = Math.hypot(tx, tz); if (l > 1) return [-tz / l, tx / l]; }
  return [1, 0];
}

export function planetPad(cfg, land, { toward = null } = {}) {
  const L = land.landing, h = L.flat * SETDOWN.floor, n = padNose(land, toward);
  return {
    ...cfg, pad: [L.x, L.y, L.z], q0: facing([n[0], 0, n[1]]),
    bay: { x0: L.x - h, x1: L.x + h, z0: L.z - h, z1: L.z + h, y0: L.y },
    floor: null, others: null, planet: true,
  };
}

// WHAT IT BUMPS INTO: the ground. A point's distance from it is its height over the ground along the ground's own up
// (the slope taken into it); over the floor round the pad only the floor's own level counts, so a ship coming down
// there reaches it (its legs take it: flymodel.js) rather than being held a skin's breadth over it.
export function groundSolid(land, cfg = null) {
  const B = cfg && cfg.bay;
  const onFloor = (x, z) => B && x > B.x0 && x < B.x1 && z > B.z0 && z < B.z1;
  function dist(x, y, z) {
    if (onFloor(x, z)) return y - B.y0 + SKIN;
    const h = land.heightAt(x, z), n = land.normalAt(x, z);
    return (y - h) * n[1];
  }
  function away(x, y, z, out) {
    if (onFloor(x, z)) { out[0] = 0; out[1] = 1; out[2] = 0; return out; }
    const n = land.normalAt(x, z); out[0] = n[0]; out[1] = n[1]; out[2] = n[2]; return out;
  }
  // how far along the straight line a -> b stays r clear of the ground (0..1): the eye that follows the ship
  function clear(a, b, r = SKIN) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(2, Math.ceil(L / 1.5));
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
      if (dist(x, y, z) < r) return Math.max(0, (i - 1) / n);
    }
    return 1;
  }
  return { reach: 6, dist, away, clear, push: () => false };
}

// THE AUTOPILOT'S WAY DOWN: up to a safe height over the ground between here and the pad (no ridge on the way), across
// to over the pad, down to just over it turned as it stands, and down (it sets itself down: flymodel.js settle)
export function planDown(S, land) {
  const P = S.cfg.pad, from = S.p;
  let top = Math.max(land.heightAt(from[0], from[2]), P[1]);
  const D = Math.hypot(P[0] - from[0], P[2] - from[2]), n = Math.max(1, Math.ceil(D / SETDOWN.step));
  for (let i = 0; i <= n; i++) top = Math.max(top, land.heightAt(from[0] + (P[0] - from[0]) * i / n, from[2] + (P[2] - from[2]) * i / n));
  const y = Math.max(from[1], top + SETDOWN.over), f = turnX(S.cfg.q0 || [0, 0, 0, 1]);
  const legs = [];
  if (from[1] < top + SETDOWN.over - 2) legs.push({ to: [from[0], y, from[2]], speed: 10, near: 3, stop: true });
  legs.push({ to: [P[0], y, P[2]], speed: SETDOWN.speed, near: SETDOWN.near, then: 6 });
  legs.push({ to: [P[0], P[1] + (S.cfg.low ?? 1) + SETDOWN.lowOver + 8, P[2]], face: f, speed: 6, near: 1, stop: true });
  legs.push({ to: [P[0], P[1] + (S.cfg.low ?? 1), P[2]], face: f, speed: 3, near: 0.3, stop: true }, { down: true });
  return legs;
}
// (the way a turn points the nose: the flight model's +x turned)
function turnX([x, y, z, w]) { return [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y)]; }
