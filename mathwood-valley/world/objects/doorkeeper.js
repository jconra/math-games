// THE TOWN'S DOORS, KEPT: who opened each, when it shuts again, what it sounds like, and where a shut one stands in a
// walker's way. Plain rules, no three.js: the doors themselves swing wherever they are made (the code-built buildings,
// world/objects/codebuildings.js; the player's cabin can add its own the same way).
//
// Dad: "The doors can use E. It is nice to push a button and see something happen."
//   - the player opens and shuts a door with E at its doorway (src/main.js asks K.near for the prompt)
//   - a door the player opened stays open while they are inside or near it; it shuts itself once they are away and
//     it is out of view (or they are far off)
//   - a townsperson pushes a door open as they pass (K.pass) and it swings shut behind them a moment later, unless
//     the player is at it; batwings (resting open) just flap
//   - a shut door stands in a walker's way (K.blocked): its doorway, a slab as wide as it and a little deep
//
//   const K = makeDoorKeeper({ sound, seen })   sound(kind, at): 'open' | 'shut' | 'flap' at { x, y, z };
//                                               seen(x, y, z, r): true while that spot is in the camera's view
//   K.add(door) -> door   door: { x, z, y (the doorway's middle, world), ox, oz (its way out), half (half its width),
//                         open(on) (swing it; true if that changed anything), ajar() (0 shut .. 1 open), flap()
//                         (batwings: swing them through), batwing (rests open: no E, no blocking), inside(x, z) (true
//                         with a point in its building), ready() (before it opens for the player: its inside loaded),
//                         keep (true: never shuts itself: the player's cabin, open till they shut it), locked() (true:
//                         no E: the cabin before it is bought) }
//   K.remove(door)
//   K.near(x, z, reach?) -> { door, open, dist } | null   the door the player could use with E, standing there
//   K.use(door, on)       the player's E
//   K.pass(x, z, hold?) -> door | null   a townsperson going through the doorway nearest (x, z), within PASS.reach
//   K.update(dt, player)  each frame: the doors shutting themselves (player: { x, z } or null)
//   K.blocked(x, z)       true in a shut door's doorway
export const DOORWAYS = {
  reach: 1.7,        // m from a doorway's middle that E works its door (the door's own prompt: src/main.js)
  pass: 3,           // m: a townsperson going through a doorway this near pushes its door
  hold: 1.6,         // s a door a townsperson pushed stays open (they pass, then it swings shut)
  stay: 4,           // m: a door the player opened stays open while they are this near it (or inside)
  gone: 60,          // m: past this it shuts even in view
  slab: 0.22,        // m: half the depth of a shut doorway a walker can't pass
  open: 0.85,        // a door open past this lets a walker through
};

export function makeDoorKeeper({ sound = () => {}, seen = () => false } = {}) {
  const doors = new Set();
  const now = () => performance.now() / 1000;
  const at = (d) => ({ x: d.x, y: d.y, z: d.z });
  function set(d, on, by, until = 0) {
    if (on && by === 'player' && d.ready) d.ready();
    const changed = d.open(on);
    d.by = on ? by : null; d.until = until; d.isOpen = on;
    if (changed) sound(on ? 'open' : 'shut', at(d));
    return changed;
  }
  const K = {
    add(d) { d.by = null; d.until = 0; d.isOpen = false; doors.add(d); return d; },
    remove(d) { doors.delete(d); },
    near(x, z, reach = DOORWAYS.reach) {
      let best = null, bd = reach;
      for (const d of doors) { if (d.batwing || (d.locked && d.locked())) continue; const k = Math.hypot(x - d.x, z - d.z); if (k < bd) { bd = k; best = d; } }
      return best ? { door: best, open: best.isOpen, dist: bd } : null;
    },
    use(d, on) { return set(d, on, 'player'); },
    pass(x, z, hold = DOORWAYS.hold) {
      let best = null, bd = DOORWAYS.pass;
      for (const d of doors) { if (d.keep) continue; const k = Math.hypot(x - d.x, z - d.z); if (k < bd) { bd = k; best = d; } }   // (nobody else goes in the player's cabin)
      if (!best) return null;
      if (best.batwing) { if (best.flap && best.flap()) sound('flap', at(best)); return best; }
      if (!best.isOpen) set(best, true, 'folk', now() + hold);
      else if (best.by === 'folk') best.until = Math.max(best.until, now() + hold);
      return best;
    },
    update(dt, player) {
      const t = now();
      for (const d of doors) {
        if (!d.isOpen || d.keep) continue;   // (the player's cabin's: open till they shut it)
        const dp = player ? Math.hypot(player.x - d.x, player.z - d.z) : Infinity;
        if (d.by === 'folk') { if (t > d.until && dp > DOORWAYS.reach) set(d, false); continue; }
        // (the player's: open while they are inside or near; then once it is out of view, or they are far off)
        if (player && d.inside && d.inside(player.x, player.z)) continue;
        if (dp > DOORWAYS.stay && (dp > DOORWAYS.gone || !seen(d.x, d.y, d.z, 1.6))) set(d, false);
      }
    },
    blocked(x, z) {
      for (const d of doors) {
        if (d.batwing || Math.abs(x - d.x) > d.half + 0.5 || Math.abs(z - d.z) > d.half + 0.5) continue;
        const dx = x - d.x, dz = z - d.z, out = dx * d.ox + dz * d.oz, along = dx * d.oz - dz * d.ox;
        if (Math.abs(out) < DOORWAYS.slab && Math.abs(along) < d.half && d.ajar() < DOORWAYS.open) return true;
      }
      return false;
    },
    get list() { return [...doors]; },
  };
  return K;
}
