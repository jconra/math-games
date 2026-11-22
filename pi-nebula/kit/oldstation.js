// THE OTHER STATION'S OUTSIDE, built: the plan (kit/oldstation-plan.js) as a few meshes, the way our own outside is
// built (kit/outside.js): the plated hull by the kit's hull builder, the gear as one list of triangles lit by the scene
// and one that glows, and their old docking bridge, the kit's own (kit/dockbridge.js wholeBridge), with its lights out.
//   const st = buildOldStation(look, mats, opts)
//     look    its look (kit/oldstation-plan.js OLD_LOOK: "old and worn", leaning red)
//     mats    hullMaterials(look) (kit/hull.js)
//     opts    shield   the material for the hangar doors' shields (kit/materials.js shieldMaterial); none: no shields
//             seed     which of the windows are lit
//             fog      false: nothing here is fogged
//   st.group           add it to the scene
//   st.stats           { triangles: { hull, gear, glow, bridge, all }, draws, plates, windows, lit, meshBytes }
//   st.dispose()
// WHAT IT COSTS: the plated hull is the kit's four draws (three groups of plates and the glass; a fifth, the shields);
// the ring, its arms, the masts and the plain rooms behind the openings are one draw, the lights a second; the bridge
// one more for its frame and one for its glass.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildHull } from './hull.js';
import { wholeBridge } from './dockbridge.js';
import { oldStationPlans, oldStationGear, BRIDGE } from './oldstation-plan.js';

// the bridge's paint, as old as the rest of it: its colours taken down this far (its glass as faint as our bridge's)
export const OLD_BRIDGE = { paint: 0.5, glass: { color: 0x9ccff5, opacity: 0.14 } };

// the bridge's own frame (kit/dockbridge.js: x across, y up, +z out of the port) into the station's
export function bridgeMatrix() {
  const B = BRIDGE, x = new THREE.Vector3(...B.across), z = new THREE.Vector3(...B.out), y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(...B.at);
}

function bridgeMeshes(fog) {
  const B = wholeBridge(), M = bridgeMatrix(), solid = [];
  for (const { mat, geo } of B.solid.parts) {
    if (mat !== 'solid') continue;                      // (its floodlights' lamps are out)
    const g = new THREE.BufferGeometry(); g.setAttribute('position', geo.attributes.position.clone()); g.setAttribute('normal', geo.attributes.normal.clone());
    const c = geo.attributes.color.clone(); for (let i = 0; i < c.array.length; i++) c.array[i] *= OLD_BRIDGE.paint; g.setAttribute('color', c);
    g.setIndex(geo.index.clone()); g.applyMatrix4(M); solid.push(g);
  }
  const frame = mergeGeometries(solid), glass = mergeGeometries(B.glass.map((g) => { const q = new THREE.BufferGeometry(); q.setAttribute('position', g.attributes.position.clone()); q.setIndex(g.index.clone()); return q.applyMatrix4(M); }));
  for (const g of solid) g.dispose();
  frame.computeBoundingSphere(); glass.computeBoundingSphere();
  const frameMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3, fog });
  const glassMat = new THREE.MeshBasicMaterial({ color: OLD_BRIDGE.glass.color, transparent: true, opacity: OLD_BRIDGE.glass.opacity, depthWrite: false, side: THREE.DoubleSide, fog });
  const a = new THREE.Mesh(frame, frameMat), b = new THREE.Mesh(glass, glassMat);
  a.name = 'old station: bridge'; b.name = 'old station: bridge glass'; b.renderOrder = 2;
  return { meshes: [a, b], own: [frame, glass, frameMat, glassMat], triangles: frame.index.count / 3 + glass.index.count / 3 };
}

export function buildOldStation(look, mats, opts = {}) {
  const group = new THREE.Group(), fog = opts.fog !== false, own = []; group.name = 'old station';
  const hull = buildHull(oldStationPlans({ seed: opts.seed }), { ...look, lap: 0 }, mats, { shield: opts.shield }); group.add(hull.group);
  const gear = oldStationGear(), make = (a, mat, name) => {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(a.position, 3)); geo.setAttribute('color', new THREE.BufferAttribute(a.color, 3)); geo.setIndex(new THREE.BufferAttribute(a.index, 1));
    geo.computeBoundingSphere(); const m = new THREE.Mesh(geo, mat); m.name = 'old station: ' + name; group.add(m); own.push(geo, mat); return m;
  };
  make(gear.lit, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.62, metalness: 0.35, side: THREE.DoubleSide, fog }), 'gear');
  make(gear.glow, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog }), 'glow');
  const br = bridgeMeshes(fog); for (const m of br.meshes) group.add(m); own.push(...br.own);
  let gearBytes = 0; for (const a of [gear.lit, gear.glow]) gearBytes += a.position.byteLength * 2 + a.index.byteLength;
  const s = hull.stats, extra = { gear: gear.lit.triangles, glow: gear.glow.triangles, bridge: Math.round(br.triangles) };
  return {
    group,
    stats: { ...s, extra, triangles: { ...s.triangles, hull: s.triangles.all, all: s.triangles.all + extra.gear + extra.glow + extra.bridge }, draws: s.draws + 2 + br.meshes.length, meshBytes: s.meshBytes + gearBytes },
    dispose() { hull.dispose(); for (const o of own) o.dispose(); group.removeFromParent(); },
  };
}
