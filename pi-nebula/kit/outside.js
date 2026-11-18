// THE OUTSIDE OF THE STATION, built: the plan (kit/outside-plan.js) as a few meshes.
//   const out = buildOutside(look, mats, opts)
//     look    a hull look (kit/hull-look.js; the station's own is STATION_LOOK)
//     mats    hullMaterials(look) (kit/hull.js): the plated hull is drawn with them, so a change to them shows at once
//     opts    shield   the material for the hangar doors' shields (kit/materials.js shieldMaterial); none: no shields
//             inside   true for the game, where the real rooms stand inside the hull: the hull then builds no frame,
//                      shield or glass of its own in any real opening
//             seed     which half of the windows are lit (the game gives a fresh number each time it starts)
//             fog      false: nothing here is fogged (the game's rooms are; out in space there is no haze)
//   out.group          add it to the scene
//   out.relay(look)    lay the plates again (after a change to their sizes); the other meshes stay
//   out.stats          { triangles, draws, plates, windows, lit, ... }
//   out.dispose()
// WHAT IT COSTS: the plated hull is the kit's five draws at most (three groups of plates, the glass, the shields); the
// girders, wings, radiators, reactor, masts and containers are ONE mesh (each corner carries its colour), the things
// that glow by themselves a second, the painted marks a third (one small picture drawn in code).
import * as THREE from 'three';
import { buildHull } from './hull.js';
import { outsidePlans, outsideGear, outsideMarks } from './outside-plan.js';

// the painted marks: every text drawn once into one small picture, a flat piece for each mark
function marksMesh(fog) {
  const marks = outsideMarks(), texts = [...new Set(marks.map((m) => m.text))], CW = 256, CH = 64, c = document.createElement('canvas');
  c.width = CW; c.height = CH * texts.length;
  const g = c.getContext('2d'); g.fillStyle = '#e9ecef'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const wide = texts.map((t, i) => { let px = 54; g.font = `700 ${px}px system-ui, "Segoe UI", Arial, sans-serif`; const w = g.measureText(t).width; if (w > CW - 16) { px *= (CW - 16) / w; g.font = `700 ${px}px system-ui, "Segoe UI", Arial, sans-serif`; } g.fillText(t, CW / 2, CH * (i + 0.5) + 2); return Math.min(CW - 16, w) / CW; });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const pos = [], uv = [], idx = [];
  marks.forEach((m, k) => {
    const i = texts.indexOf(m.text), u0 = 0.5 - wide[i] / 2 - 0.01, u1 = 0.5 + wide[i] / 2 + 0.01, v0 = 1 - (i + 1) / texts.length, v1 = 1 - i / texts.length;
    for (const [a, b, u, v] of [[0, 0, u0, v0], [1, 0, u1, v0], [1, 1, u1, v1], [0, 1, u0, v1]]) { pos.push(m.O[0] + m.U[0] * m.w * a + m.V[0] * m.h * b, m.O[1] + m.U[1] * m.w * a + m.V[1] * m.h * b, m.O[2] + m.U[2] * m.w * a + m.V[2] * m.h * b); uv.push(u, v); }
    idx.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
  });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.45, fog });
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'outside:marks';
  return { mesh, bytes: Math.round(CW * c.height * 4 * 4 / 3), triangles: idx.length / 3 };
}

export function buildOutside(look, mats, opts = {}) {
  const group = new THREE.Group(), fog = opts.fog !== false, own = []; group.name = 'outside';
  let hull = null;
  const relay = (lk) => {
    if (hull) hull.dispose();
    // (laid flush, as the lab lays every shape)
    hull = buildHull(outsidePlans({ inside: opts.inside, seed: opts.seed }), { ...lk, lap: 0 }, mats, { shield: opts.shield }); group.add(hull.group);
  };
  relay(look);
  // the gear: one mesh lit by the scene, one that glows by itself
  const gear = outsideGear({ inside: opts.inside }), make = (a, mat, name) => {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(a.position, 3)); geo.setAttribute('color', new THREE.BufferAttribute(a.color, 3)); geo.setIndex(new THREE.BufferAttribute(a.index, 1));
    geo.computeBoundingSphere(); const m = new THREE.Mesh(geo, mat); m.name = 'outside:' + name; group.add(m); own.push(geo, mat); return m;
  };
  make(gear.lit, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.62, metalness: 0.35, side: THREE.DoubleSide, fog }), 'gear');
  make(gear.glow, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog }), 'glow');
  const marks = marksMesh(fog); group.add(marks.mesh); own.push(marks.mesh.geometry, marks.mesh.material, marks.mesh.material.map);
  const gearBytes = gear.lit.position.byteLength * 2 + gear.lit.index.byteLength + gear.glow.position.byteLength * 2 + gear.glow.index.byteLength;
  return {
    group, relay,
    get hull() { return hull; },
    get stats() {
      const s = hull.stats, extra = { gear: gear.lit.triangles, glow: gear.glow.triangles, marks: marks.triangles };
      return { ...s, extra, triangles: { ...s.triangles, hull: s.triangles.all, all: s.triangles.all + extra.gear + extra.glow + extra.marks }, draws: s.draws + 3, meshBytes: s.meshBytes + gearBytes, marksBytes: marks.bytes };
    },
    dispose() { if (hull) hull.dispose(); for (const o of own) o.dispose(); group.removeFromParent(); },
  };
}
