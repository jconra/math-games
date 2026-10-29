// THE CABIN'S THINGS, MADE AND STOOD AT THEIR SPOTS: each slot's piece (slots.js: a model file fitted to its spot, or made
// in code: pieces.js) and each keepsake, where layout.js says (in the cabin's own frame). The game's cabin (interior.js)
// and the Building Lab's Place things (labs/buildings/placing.js) both make them here, so the lab shows the game's own.
// What the game adds on top (its inside light, fewer draws, the pieces' boxes a walker bumps into) stays in interior.js.
//
//   const TH = makeThings({ base, maxAniso, floorUnder, loader })   base: the game's folder URL (for models/);
//                                        floorUnder(x, z): the floor's height under a spot (its frame)
//   await TH.build(id, spec, { dogs, bedSpots })   -> a group with the slot's piece(s) at spec's spot (spec: a slot as it
//                                        stands in this cabin: slots.js's, with layout.js's at, rot, wall, extra...)
//   TH.keepsake(job, tier, spot, { table })  -> a keepsake's group at its spot (table: there is one to stand it on)
//   TH.stand(group, spec)                stands (or hangs) a group at a spec's spot
//   TH.files                             the model files' templates (Promises), for freeing
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makePiece, makeKeepsake } from './pieces.js';

const TINT = { chair: 0x9a7150 };   // the chairs come painted white: stained to a warm wood brown to match the room

export function makeThings({ base = new URL('../../', import.meta.url).href, maxAniso = 8, floorUnder = () => 0, loader = new GLTFLoader() } = {}) {
  const files = new Map();     // file -> Promise<template scene>
  const loadFile = (file) => {
    if (!files.has(file)) files.set(file, loader.loadAsync(`${base}models/furniture/${file}.glb`).then((g) => {
      const s = g.scene; s.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; for (const m of [].concat(o.material)) { for (const t of [m.map, m.normalMap]) if (t) t.anisotropy = Math.min(8, maxAniso); if (TINT[file]) m.color.setHex(TINT[file]); } } });
      s.updateMatrixWorld(true); s.userData.box = new THREE.Box3().setFromObject(s); return s;
    }));
    return files.get(file);
  };
  // one placed copy of a file, fitted to its spot: in a group stood at the spot (or hung on the wall), turned by rot
  async function placeFile(spec, wallPiece) {
    const tpl = await loadFile(spec.file), b = tpl.userData.box, size = b.getSize(new THREE.Vector3()), mid = b.getCenter(new THREE.Vector3());
    const s = spec.fitH ? spec.fitH / size.y : spec.fit ? spec.fit / Math.max(size.x, size.z) : 1;
    const piece = tpl.clone(); piece.scale.setScalar(s);
    if (wallPiece) piece.position.set(-mid.x * s, -mid.y * s, -b.min.z * s); else piece.position.set(-mid.x * s, -b.min.y * s, -mid.z * s);
    const g = new THREE.Group(); g.add(piece); return g;
  }
  function stand(g, spec) {
    const [x, y, z] = spec.at;
    if (spec.wall) {   // (on the wall's face: layout.js puts `at` there; just off it (off: clear of a board wall's battens), facing into the room)
      const w = spec.wall, off = spec.off || 0.03;
      g.position.set(x - w[0] * off, y, z - w[2] * off); g.rotation.set(0, Math.atan2(-w[0], -w[2]), 0);
    } else {
      g.position.set(x, y == null ? floorUnder(x, z) : y, z); g.rotation.set(0, THREE.MathUtils.degToRad(spec.rot || 0), 0);
    }
  }
  const made = (o) => { o.userData.made = true; return o; };   // (made here: freed on its own; a file's copies share the file's)

  // a slot's piece: a group with everything it shows (made in code, or its files placed)
  async function build(id, spec, { dogs = 1, bedSpots = [] } = {}) {
    const g = new THREE.Group(); g.name = 'slot-' + id;
    if (spec.made === 'lanterns') {
      // the lantern model (cut from camp 3's tent) hung at each spot, 0.34 m tall, its glass round the flame; the lamp,
      // the glow and the cord made in code. Its tin glows a little warm from the flame inside.
      const tpl = spec.file ? await loadFile(spec.file) : null;
      g.add(made(makePiece('lanterns', { at: spec.looks, body: !tpl })));
      if (tpl) {
        tpl.traverse((o) => { if (o.isMesh && !o.material.userData.warm) { o.material.userData.warm = true; o.material.emissive.set(0xff9a40); o.material.emissiveMap = o.material.map; o.material.emissiveIntensity = 0.35; } });
        const b = tpl.userData.box, k = 0.34 / (b.max.y - b.min.y), mid = b.getCenter(new THREE.Vector3());
        for (const [x, y, z] of spec.looks) { const c = tpl.clone(); c.scale.setScalar(k); c.position.set(x - mid.x * k, y - 0.156 - b.min.y * k, z - mid.z * k); g.add(c); }
      }
    } else if (spec.made === 'dogbeds') {
      const n = Math.max(1, Math.min(bedSpots.length, dogs || 1)), tints = ['#8e3b30', '#3f5a78', '#5f6e3a'];
      for (let i = 0; i < n; i++) { const b = made(makePiece('dogbed', { tint: tints[i] })), s = bedSpots[i]; b.position.set(s.x, floorUnder(s.x, s.z), s.z); b.rotation.y = s.rot; g.add(b); }
    } else if (spec.made === 'rifles') {
      // the rifle and the shotgun (models/guns, as the riders' own: guns.json says each one's scale and which way its
      // barrel points), laid along the rack, muzzles opposite ways, each centred on it
      const facts = await fetch(`${base}models/guns/guns.json`).then((r) => r.json()).then((j) => j.guns).catch(() => null);
      const guns = facts && (await Promise.all(['Rifle', 'Shotgun'].map(async (name, i) => {
        const f = facts[name], gun = (await loader.loadAsync(`${base}models/guns/${f.file}`)).scene;
        gun.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
        const turn = new THREE.Group(); turn.add(gun); gun.scale.setScalar(f.scale);
        turn.rotation.y = Math.atan2(-f.forward[0], -f.forward[2]) + (i ? -1 : 1) * Math.PI / 2;   // (barrel along -x, then +x)
        turn.updateMatrixWorld(true); const mid = new THREE.Box3().setFromObject(turn).getCenter(new THREE.Vector3());
        const lay = new THREE.Group(); turn.position.sub(mid); lay.add(turn); return lay;
      })).catch(() => null));
      const m = made(makePiece('rifles', { guns })); stand(m, spec); if (spec.scale) m.scale.setScalar(spec.scale); g.add(m);   // (a smaller rack where the walls have no room: layout.js)
    } else if (spec.made) { const m = made(makePiece(spec.made, spec.size ? { size: spec.size } : undefined)); stand(m, spec); g.add(m); }   // (size: a smaller rug where the room has no space for the whole one: layout.js)
    else if (!spec.builtIn) { const m = await placeFile(spec, !!spec.wall); stand(m, spec); if (spec.scale) m.scale.setScalar(spec.scale); g.add(m); }
    if (spec.also && spec.builtIn) {
      // (a cabin with its own box stove: the one bought is that one, its fire lit at its door; its own pipe stays)
      const m = made(makePiece(spec.also, { scale: 0.75, pipe: false })); stand(m, spec);
      const a = THREE.MathUtils.degToRad(spec.rot || 0); m.position.x += Math.sin(a) * 0.2; m.position.z += Math.cos(a) * 0.2; m.position.y += 0.12; g.add(m);
    } else if (spec.also) { const m = made(makePiece(spec.also, { scale: spec.fitH || 1 })); stand(m, spec); g.add(m); }
    for (const ex of spec.extra || []) { const m = await placeFile(ex, false); stand(m, ex); g.add(m); }
    return g;
  }

  // a keepsake at its spot: hung on a wall; stood on the table (on a crate as high as the table till there is one); or
  // on the floor, leaning back a little against the wall
  function keepsake(job, tier, spot, { table = false } = {}) {
    const g = makeKeepsake(job, tier, spot.table ? { raise: table ? 0 : spot.table } : undefined); if (!g) return null;
    if (spot.wall) { stand(g, spot); if (spot.scale) g.scale.setScalar(spot.scale); }   // (a smaller one where the walls had no room: layout.js)
    else if (spot.table) { const [x, , z] = spot.at; g.position.set(x, floorUnder(x, z) + (table ? spot.table : 0), z); g.rotation.set(0, THREE.MathUtils.degToRad(spot.rot || 0), 0); }
    else { g.position.set(spot.at[0], floorUnder(spot.at[0], spot.at[2]), spot.at[2]); g.rotation.set(job === 'boxes' ? -0.14 : -0.18, THREE.MathUtils.degToRad(spot.rot || 0), 0, 'YXZ'); }   // (turned, then leaned back against its wall: the safe door 8 degrees)
    return g;
  }
  return { build, keepsake, stand, loadFile, files };
}
