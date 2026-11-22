// THE DOORS OF THE CONTAINERS THE SUPPLY RUN LOADS (kit/places-plan.js LOAD: containers 03 and 02 in Cargo's cargo
// slots). The game's maker, 2026-11-22 (STA2-5): "Then you go get in the forklift and load some pallets onto the
// containers." Each container's two leaves are drawn apart from the room (kit/store.js containerDoor: the room's own
// look, closed exactly as the other containers' doors), so they can swing: opened, each goes round 270 degrees on its
// hinge and lies back along the container's side, as a container's doors are latched back to load it; container 03's
// first, 02's a moment after (the two leaves between them would meet if both swung at once). Lit as Cargo's pallets
// are (kit/cargopallets.js): its own corner darkening once, and the light Cargo's lamps throw on each vertex, worked
// out shut and open and blended between as it swings.
//   const D = makeDoors({ zone, lights, sky, walls })   (walls: a shut doorway stops a person, src/walls.js)
//   D.set(slot, open)    D.isOpen(slot) (any of the way open)   D.shut(slot) (all the way shut)
//   D.update(dt)         D.group   D.facts { tris, draws, ms }   D.state() for the rigs
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { builtPiece, compact } from './layout.js';
import { bake, lightAt } from './bake.js';
import { LOAD, SLOT, STORE, doorHinge, doorTurn } from './places-plan.js';

// how much of the lamps' light a leaf takes (as the room's own doors facing the loading floor: measured against
// container 01's, ~/pw/space-math/CARGO_1.md)
export const DOOR_LOOK = { k: 0.85 };
const ease = (t) => t * t * (3 - 2 * t);

// where a leaf's hinge stands, and its turn (kit/places-plan.js: plain numbers the tests read)
export const hingeOf = doorHinge, turnOf = doorTurn;

export function makeDoors({ zone, lights = [], sky = null, walls = null }) {
  const t0 = performance.now(), group = new THREE.Group(); group.name = 'cargo:doors';
  const floor = STORE.floor, box = zone.box;
  const near = lights.filter((l) => l.at[0] > box.min.x - 8 && l.at[0] < box.max.x + 8 && l.at[2] > box.min.z - 8 && l.at[2] < box.max.z + 8 && l.at[1] > box.min.y - 1 && l.at[1] < box.max.y + 1);
  const skyI = sky ? sky.i ?? 1 : 0, skyC = [1, 0.98, 0.95];
  const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
  // a leaf's light where it stands `k` of the way open
  function lightFor(g, H, k) {
    const P = g.attributes.position, N = g.attributes.normal, out = new Float32Array(P.count * 3);
    _m.makeRotationY(turnOf(H.s, k)).setPosition(H.x, floor, H.z); _q.setFromRotationMatrix(_m);
    for (let v = 0; v < P.count; v++) {
      _p.set(P.getX(v), P.getY(v), P.getZ(v)).applyMatrix4(_m); _n.set(N.getX(v), N.getY(v), N.getZ(v)).normalize().applyQuaternion(_q);
      const [r, gg, b] = lightAt(_p, near, _n), sk = skyI * (0.55 + 0.45 * _n.y);
      out[v * 3] = (r + sk * skyC[0]) * DOOR_LOOK.k; out[v * 3 + 1] = (gg + sk * skyC[1]) * DOOR_LOOK.k; out[v * 3 + 2] = (b + sk * skyC[2]) * DOOR_LOOK.k;
    }
    return out;
  }
  const slots = new Map();
  for (const k of LOAD.slots) {
    const leaves = ['north', 'south'].map((side) => {
      const p = builtPiece('containerDoor', side + ' 0' + (k + 1), true), geos = p.parts.filter((x) => x.mat === 'solid').map((x) => x.geo.clone());
      const g = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      bake([g], [g], [], { voxel: 0.03, reach: 0.25, strength: 0.6 });
      g.deleteAttribute('aBake'); g.computeBoundingBox(); g.computeBoundingSphere();
      compact(g, 'normal', Int16Array, 32767); compact(g, 'color', Uint8Array, 255); compact(g, 'aRMW', Uint8Array, 255);
      const H = hingeOf(k, side), shut = lightFor(g, H, 0), open = lightFor(g, H, 1), own = new THREE.BufferAttribute(shut.slice(), 3);
      g.setAttribute('aBake', own);
      const mesh = new THREE.Mesh(g, zone.mats ? zone.mats.solid : null); mesh.name = 'cargo:door:' + side + ':' + k;
      mesh.position.set(H.x, floor, H.z); mesh.rotation.set(0, 0, 0); mesh.updateMatrix();
      group.add(mesh);
      return { side, H, mesh, shut, open, own, lit: 0 };
    });
    // (a shut doorway stops a person: a box over it, while the doors are less than half open)
    const S = { k, leaves, at: 0, want: 0, wait: 0 };
    if (walls) {
      const x1 = SLOT.end + 0.02, hz = SLOT.box[0] / 2 + 0.045;
      const g = new THREE.BoxGeometry(0.12, SLOT.box[1], hz * 2).translate(x1 - 0.02, floor + SLOT.box[1] / 2 + 0.04, SLOT.z[k]);
      walls.add('cargo:doors:' + k, { solid: [g], when: () => S.at < 0.5 });
    }
    slots.set(k, S);
  }
  // each leaf where it is now, and its light
  function place(S) {
    for (const L of S.leaves) {
      L.mesh.rotation.set(0, turnOf(L.H.s, S.at), 0); L.mesh.updateMatrix();
      if (Math.abs(L.lit - S.at) > 0.01 || (S.at === 0 && L.lit !== 0) || (S.at === 1 && L.lit !== 1)) {
        const e = ease(S.at), o = L.own.array;
        for (let j = 0; j < o.length; j++) o[j] = L.shut[j] + (L.open[j] - L.shut[j]) * e;
        L.own.needsUpdate = true; L.lit = S.at;
      }
    }
  }
  for (const S of slots.values()) place(S);
  const tris = [...slots.values()].reduce((n, S) => n + S.leaves.reduce((m, L) => m + L.mesh.geometry.index.count / 3, 0), 0);
  const D = {
    group,
    // open or shut a container's doors: the first container's at once, the second's a moment after the first's
    set(slot, open) {
      const S = slots.get(slot); if (!S) return;
      const want = open ? 1 : 0; if (S.want === want) return;
      S.want = want;
      const order = LOAD.slots.indexOf(slot), other = LOAD.slots.find((k) => k !== slot), O = slots.get(other);
      // (the other container's leaves on their way through the middle of their swing: this one waits its turn)
      S.wait = O && O.at > 0 && O.at < 1 && O.want === want ? LOAD.hinge.after : order > 0 && open ? LOAD.hinge.after : 0;
    },
    isOpen: (slot) => { const S = slots.get(slot); return !!S && (S.at > 0 || S.want > 0); },
    shut: (slot) => { const S = slots.get(slot); return !S || (S.at === 0 && S.want === 0); },
    update(dt) {
      for (const S of slots.values()) {
        if (S.at === S.want) continue;
        if (S.wait > 0) { S.wait -= dt; continue; }
        const step = dt / LOAD.hinge.secs;
        S.at = S.want > S.at ? Math.min(S.want, S.at + step) : Math.max(S.want, S.at - step);
        place(S);
      }
    },
    // (the rigs: put open or shut at once)
    snap(slot, open) { const S = slots.get(slot); if (!S) return; S.want = S.at = open ? 1 : 0; S.wait = 0; place(S); },
    facts: { tris, draws: [...slots.values()].length * 2, ms: Math.round(performance.now() - t0) },
    state: () => Object.fromEntries([...slots.values()].map((S) => [S.k, { at: +S.at.toFixed(3), want: S.want, wait: +S.wait.toFixed(2) }])),
    dispose() { group.removeFromParent(); for (const S of slots.values()) for (const L of S.leaves) L.mesh.geometry.dispose(); },
  };
  return D;
}
