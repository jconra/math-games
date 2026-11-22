// THE RUN'S SHIP AT A FAR PLACE: out of the wormhole above a planet or out in open space, flown there by the game's own
// flying (src/flying.js, given a `body`, as at the rocks) and drawn there as itself: its hull by its keeper, its cabin
// (the very rooms walked in the hangar) by boarding, by the one matrix from where it is parked to where it is now. The
// seat's view and the view from behind (V), the dashboard; its controls put away (whoever flies it out there is the
// run's own: the captain's pilot, or the autopilot). The exploring run's places (src/explore.js) use it; it is the part
// of src/rescue.js's planet that is not the planet (its drawShip, solid, open and close), made one piece so both can.
//
//   const F = makeFarShip(ctx, opts)   ctx: { W, boarding, keeper, ship (boarding's record), cfg (src/fleet.js
//       flightOf), startFlying }; opts: { pilot, flier, settings, onSettings, dash, run, ground(x, z) (none: open
//       space), resting() (on the ground: its engine idling) }
//   F.open(view, p, dir)   the flying begun there: p [x, y, z], its nose along dir [x, 0, z]; false if it was already
//   F.put(p, dir)          where it is now (dir [x, y, z]: its nose, a little up or down)
//   F.fl, F.matrix (its kit frame in the world);   F.close()
import * as THREE from 'three';
import { facing } from './flymodel.js';

// the ship's kit frame (x to port, y up, z to its nose) in the flight model's own [ahead, up, right]
const KIT = new THREE.Matrix4().makeRotationY(Math.PI / 2);

export function makeFarShip(ctx, opts = {}) {
  const { W, boarding, keeper, ship: S, cfg: shipCfg, startFlying } = ctx;
  // (the ship as the flying flies it out there: its own facts with nothing of its hangar, as the rocks' FIELD has the Miner's)
  const cfg = { ...shipCfg, pad: [0, 0, 0], bay: null, floor: null, others: null, field: true }; delete cfg.q0;
  const ground = opts.ground || null, resting = opts.resting || (() => false);
  let fl = null, closed = false;
  const _D = new THREE.Matrix4(), _i = new THREE.Matrix4(), _acc = new THREE.Vector3();
  function draw(M, dt = 0) {
    _D.multiplyMatrices(M, _i.copy(S.M0).invert());
    const still = resting();
    keeper.fly(_D, dt, { acc: _acc, spin: 0, hold: still ? 0 : 0.6, engine: still ? 0.15 : 0.45, heat: 1, x: 0, z: 0, height: null });
    boarding.fly(S.id, _D);
  }
  // WHAT IT BUMPS INTO OUT THERE, as the flying asks (the view from behind kept clear of the ground: clear(a, b), how much
  // of the way from a to b is over it). Nobody flies it by hand out there yet, so nothing else.
  const solid = {
    reach: 3, dist: () => 99, away: (x, y, z, out) => { out[0] = out[1] = out[2] = 0; return out; }, push: () => false,
    clear: (a, b, r = 0.6) => {
      if (!ground) return 1;
      for (let i = 1; i <= 16; i++) { const k = i / 16, x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k, z = a[2] + (b[2] - a[2]) * k; if (y < ground(x, z) + r + 0.8) return (i - 1) / 16; }
      return 1;
    },
  };
  return {
    get fl() { return fl; }, get matrix() { return fl ? fl.matrix : S.M; },
    open(view, p, dir) {
      if (fl || closed) return false;
      fl = startFlying({ W, boarding: null, crane: null }, {
        cfg, goal: 'field', pilot: !!opts.pilot, flier: opts.flier || 'The pilot', view, settings: opts.settings || null, onSettings: opts.onSettings || null,
        words: () => {}, ...(opts.dash ? { dash: opts.dash, run: opts.run } : {}),
        body: { at: new THREE.Matrix4(), M0: KIT, p: [...p], f: [dir[0], 0, dir[2]], fly: (M, dt) => draw(M, dt), solid },
      });
      fl.lock(true);
      return true;
    },
    put(p, dir) { if (fl) fl.put([p[0], p[1], p[2]], facing([dir[0], dir[1] || 0, dir[2]])); },
    close() {
      if (closed) return; closed = true;
      if (fl) { fl.close(); fl = null; }
      keeper.fly(null); boarding.fly(S.id, null);
    },
  };
}
