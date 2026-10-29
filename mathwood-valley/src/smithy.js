// THE BLACKSMITH AT WORK (the game maker: "Can we get a blacksmith too?"): the town's smith in his shop (the code-built
// blacksmith's, labs/buildings/blacksmith.js; where he stands: its anchors, rooms[0].anchors: the anvil, the forge and his
// own spot), hammering at the anvil with the iron held in his tongs, and now and then stepping over to the forge to put
// the iron back in the coals a while, then back to the anvil. The anvil rings as his hammer meets it: a crack of noise
// (src/audio/ambience.js anvil(): the game maker's rule, a hammer is a clap-like crack, never a ringing tone), heard
// near the shop only. He is one of the job folk (src/jobfolk.js: his name tag, his hello, facing the rider close by,
// talking only to a rider inside with him); there is nothing to do at his shop yet, so no prompt.
// His clips are made for him in Blender (~/pw/bandit-math/rigs/clips/build_work_clips.py, make_work.sh:
// models/people/clips_work_m.glb): Hammer (two blows a loop, at SMITH.strikes) and Tend_Forge.
//
//   SMITH                     the dials
//   loadWorkClips(folk)       the clips added to the folk's men's skeleton (once; a promise)
//   handTools(person)         the hammer in his right fist and the tongs in his left, made in code (two small meshes on
//                             the hands' bones); -> { hammer, tongs, dispose() }
//   const S = makeSmithWork({ rec, folk, place, yaw, A, ring })   rec: his job-folk record ({ p, x, z, face });
//     place(x, z) -> [wx, wz] and yaw(a) carry the shop's own frame into the world (src/townrooms.js roomFrame); A: the
//     shop's rooms[0].anchors; ring(at): the anvil's sound at a place in the world
//   S.update(dt) -> true while he works (he is moved and played here); call S.stop() for the hello (he turns to the
//                             rider: jobfolk faces him, Idle), S.update picks up again after
//   S.state(), S.dispose()
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const SMITH = {
  clips: 'clips_work_m.glb',
  strikes: [0, 0.8],       // s into the Hammer clip (1.6 s) when the hammer meets the iron: the anvil rings then
  hammerLoop: 1.6,
  anvil: [7, 13],          // s hammering before he takes the iron back to the forge
  forge: [3.5, 6],         // s at the forge, the iron in the coals
  walk: 0.85,              // m/s stepping between the two
  forgeOut: 0.55,          // m out from the hearth's front where he stands to tend it
  turn: 5,                 // how fast he turns (a damp rate)
};
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let clipsP = null;
export function loadWorkClips(folk) {
  return clipsP || (clipsP = loader.loadAsync(folk.dir + SMITH.clips).then((g) => { folk.addClips('m', g.animations); return g.animations; })
    .catch((e) => { clipsP = null; console.warn('smithy: the clips could not be loaded', e); return null; }));
}
// (a person made before the clips came: their actions added now)
function giveClips(person, clips) {
  const P = person.person; if (!P || !P.mixer || !clips) return;
  for (const c of clips) if (!P.actions[c.name]) P.actions[c.name] = P.mixer.clipAction(c);
}
const rnd = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// THE TOOLS IN HIS HANDS: a hammer (an ash handle, a dark iron head) and a pair of tongs (two long iron reins), each one
// merged mesh, hung on the wrist bones where the closed fists hold them (as the six-shooter sits in a fist,
// src/revolver.js fistFrame: worked out by eye from the clips' poses)
const TOOL = {
  hammer: { at: [0.0, 0.085, 0.0], rot: [0, 0, Math.PI / 2], handle: 0.36, head: [0.11, 0.045, 0.045] },
  tongs: { at: [0.0, 0.085, 0.0], rot: [0, 0, Math.PI / 2], reins: 0.42, jaws: 0.09 },
};
let toolGeo = null;
function toolGeometry() {
  if (toolGeo) return toolGeo;
  const col = (g, hex) => { const n = g.attributes.position.count, c = new Float32Array(n * 3), k = new THREE.Color(hex); for (let i = 0; i < n; i++) k.toArray(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g.index ? g.toNonIndexed() : g; };
  const strip = (g) => { g.deleteAttribute('uv'); return g; };
  const H = TOOL.hammer, T = TOOL.tongs;
  // (the hammer: its handle along +y out of the fist's thumb side, its head across the handle's far end)
  const handle = col(strip(new THREE.CylinderGeometry(0.014, 0.017, H.handle, 6).translate(0, H.handle / 2 - 0.06, 0)), '#8a6a44');
  const head = col(strip(new THREE.BoxGeometry(...H.head).translate(0.012, H.handle - 0.07, 0)), '#2e2d2c');
  // (the tongs: two thin reins from the fist out to the jaws, a little apart, the jaws bent in)
  const reins = [-1, 1].map((s) => col(strip(new THREE.BoxGeometry(0.012, T.reins, 0.01).translate(s * 0.014, T.reins / 2 - 0.05, 0)), '#3a3836'));
  const jaws = [-1, 1].map((s) => col(strip(new THREE.BoxGeometry(0.01, T.jaws, 0.012).rotateZ(s * 0.25).translate(s * 0.006, T.reins - 0.04, 0)), '#2a2928'));
  const merge = (list) => { const n = list.reduce((a, g) => a + g.attributes.position.count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), cc = new Float32Array(n * 3); let o = 0;
    for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); cc.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(cc, 3)); return out; };
  toolGeo = { hammer: merge([handle, head]), tongs: merge([...reins, ...jaws]), mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 }) };
  return toolGeo;
}
export function handTools(person, { shadows = true } = {}) {
  const G = toolGeometry(), out = { hammer: null, tongs: null };
  const hang = (bone, geo, T) => { if (!bone) return null; const m = new THREE.Mesh(geo, G.mat); m.position.fromArray(T.at); m.rotation.set(...T.rot); m.castShadow = shadows; m.name = 'smith tool'; bone.add(m); return m; };
  out.hammer = hang(person.bones && person.bones.WristR, G.hammer, TOOL.hammer);
  out.tongs = hang(person.bones && person.bones.WristL, G.tongs, TOOL.tongs);
  out.show = (on) => { for (const m of [out.hammer, out.tongs]) if (m) m.visible = !!on; };
  out.dispose = () => { for (const m of [out.hammer, out.tongs]) if (m) m.removeFromParent(); };
  return out;
}

export function makeSmithWork({ rec, folk, place, yaw, A, ring = () => {} }) {
  const p = rec.p;
  // his two places in the world: at the anvil (his own spot, facing the anvil) and before the forge (facing its hearth)
  const [ax, az] = place(A.smith.x, A.smith.z), [vx, vz] = place(A.anvil.x, A.anvil.z);
  const atAnvil = { x: ax, z: az, face: Math.atan2(vx - ax, vz - az) };
  const [fx, fz] = place(A.forge.x, A.forge.z + SMITH.forgeOut), [hx, hz] = place(A.forge.x, A.forge.z);
  const atForge = { x: fx, z: fz, face: Math.atan2(hx - fx, hz - fz) };
  const anvilAt = { x: vx, z: vz };
  const S = { phase: 'anvil', t: rnd(...SMITH.anvil), ready: false, held: false };
  let clips = null, lastT = 0, tools = null;
  loadWorkClips(folk).then((c) => { if (!c) return; clips = c; giveClips(p, c); S.ready = true; });
  tools = handTools(p);
  rec.x = atAnvil.x; rec.z = atAnvil.z; rec.face = rec.home = atAnvil.face;
  const play = (name, o) => p.play(name, o);
  function walkTo(to, dt) {
    const dx = to.x - rec.x, dz = to.z - rec.z, d = Math.hypot(dx, dz);
    if (d < 0.04) { rec.x = to.x; rec.z = to.z; return true; }
    const st = Math.min(d, SMITH.walk * dt); rec.x += dx / d * st; rec.z += dz / d * st;
    rec.face += wrap(Math.atan2(dx, dz) - rec.face) * Math.min(1, dt * SMITH.turn * 1.6);
    return false;
  }
  // (stopped to talk: his tools still in his hands; a wave of the hello's own left to play out)
  S.stop = () => { if (!S.held) { S.held = true; if (!(rec.clipT > 0)) play('Idle', { fade: 0.35 }); } };
  S.update = (dt) => {
    if (!S.ready) return false;
    if (S.held) { S.held = false; S.phase = S.phase === 'toForge' || S.phase === 'forge' ? 'toForge' : 'toAnvil'; S.started = false; }
    S.t -= dt;
    switch (S.phase) {
      case 'anvil': {
        if (!S.started) { S.started = true; play('Hammer', { fade: 0.3 }); lastT = 0; }
        rec.face += wrap(atAnvil.face - rec.face) * Math.min(1, dt * SMITH.turn);
        // (the anvil rings as each blow lands: the clip's own time crossing a strike)
        const a = p.person && p.person.actions && p.person.actions.Hammer;
        if (a) { const t = a.time % SMITH.hammerLoop; for (const s of SMITH.strikes) if ((lastT < s && t >= s) || (t < lastT && (s >= lastT || s <= t))) ring(anvilAt); lastT = t; }
        if (S.t <= 0) { S.phase = 'toForge'; S.started = false; }
        break;
      }
      case 'toForge':
        if (!S.started) { S.started = true; play('Walk', { fade: 0.25, speed: SMITH.walk / ((p.stride && p.stride.Walk) || 1.3) }); }
        if (walkTo(atForge, dt)) { S.phase = 'forge'; S.started = false; S.t = rnd(...SMITH.forge); }
        break;
      case 'forge':
        if (!S.started) { S.started = true; play('Tend_Forge', { fade: 0.35 }); }
        rec.face += wrap(atForge.face - rec.face) * Math.min(1, dt * SMITH.turn);
        if (S.t <= 0) { S.phase = 'toAnvil'; S.started = false; }
        break;
      case 'toAnvil':
        if (!S.started) { S.started = true; play('Walk', { fade: 0.25, speed: SMITH.walk / ((p.stride && p.stride.Walk) || 1.3) }); }
        if (walkTo(atAnvil, dt)) { S.phase = 'anvil'; S.started = false; S.t = rnd(...SMITH.anvil); }
        break;
    }
    return true;
  };
  S.state = () => ({ phase: S.phase, ready: S.ready, held: S.held, x: +rec.x.toFixed(2), z: +rec.z.toFixed(2), clip: p.clip });
  S.dispose = () => { if (tools) tools.dispose(); };
  return S;
}
