// FLIGHT: a ship's corner thrusters and its main engine as it flies, and the air it blows down under it (the game's
// maker, 2026-11-17, of the Miner's landing: "It should use the maneuvering thrusters (just like flight should). Those 6
// little dodads that we built on the corners. They should turn and shoot out flames. If it was a really cool pilot they
// could be spinning around as they were traveling in. Also, I'd expect the main engine to be glowing, even if it is only
// just idling (It should still be hot I'd expect) ... I'm not sure if there's a good way to make it look like there's
// some wind and blasts of air shooting down, but it would be cool."). Whatever flies a ship says how it is moving; this
// turns each pod toward the way it must push, fires the jet at that end (plume.js), idles the main engine and keeps its
// nozzle hot after it stops, and blows dust out along the floor under it. The Miner's landing (src/crane.js) is the
// first to use it; a take-off, or flight in space, uses the same.
//
//   const fx = makeFlight({ pods, podHalf, swing, nozzles, jet, podJet, frame, parent, quality })
//     pods      the ship's thruster pods: kit doors (a built room's doors) whose leaf turns on a yaw hinge and then a
//               pitch hinge (the Miner's mbPod; the door must not be held, so its leaf moves), a jet at each end of the
//               leaf (its own z, podHalf from its middle)
//     swing     how far a pod may turn here: { yaw, pitch } radians either way of along the ship
//     nozzles   the main engine's jets, in the ship's own frame (miner-built.js jetNozzles); jet: their look ({ len, gain })
//     podJet    the pods' jets' look ({ len, gain, r })
//     frame     a Matrix4: the ship's own frame (its hull's numbers) to where it stands parked in the station
//     parent    a group that moves with the ship (its room's, posed as the ship flies): the jets hang on it, placed as
//               if the ship were parked
//     quality   'low' | 'medium' | 'high'
//   fx.update(dt, { acc, spin, hold, engine, heat })   each frame while it flies (and after, while its nozzle cools)
//     acc       the ship's acceleration in its own frame, a Vector3 (m/s each second: x its left, y up, z its nose)
//     spin      how quickly its turning speeds up or slows, about its up (radians a second each second)
//     hold      how much of its weight the pods hold up (1 hovering; 0 on its legs or out in space)
//     engine    the main engine's throttle (0 off .. 1; idle is 0.15); heat: how hot its nozzle glows (0 cold .. 1)
//   fx.rest()   each pod back along the ship and its jets out (the nozzle's heat is left to cool by update)
//   fx.drawn    whether anything of it shows (nothing to do while it does not)
//
//   const air = makeDownwash({ parent, quality })   the air the thrusters blow down, on the floor under the ship:
//     air.update(dt, { x, z, y, height, strength })   dust rings running out from under it and motes swirling up off the
//                                                    floor; height: its belly over the floor (m); strength 0..1
//     air.hide()
import * as THREE from 'three';
import { makeJets } from './plume.js';
import { poseLeaf } from './built-common.js';

// THE PODS' PUSH (the ship's own frame): each pod pushes the ship as it must move (its acceleration, its turning's at
// the pod) and, while it hovers, holds it up; its jet goes the other way, angled out from the hull (so the pods on top
// of it fire clear of it, down and out), its end the one facing that way. How hard: hovering is a steady burn, a turn
// or a stop a burst on top.
export const PUSH = {
  gain: 1.6,        // the ship's own acceleration, as against holding it up (larger: the turns and stops show more)
  down: 1.0,        // holding it up: the jet straight down
  out: 0.75,        // ... and out from the ship's middle line, its own side
  turn: 2.2,        // how quickly a pod swings to its new way (radians a second)
  hover: 0.3,       // a hovering pod's thrust (0..1: about 0.3 a deep orange, 0.6 bright orange, 0.8 white hot)
  burst: 0.34,      // added for a push of `full` m/s² (a stop, a turn)
  inward: 0.25,     // a jet never fires in across the hull: at least this much of it out from the ship's middle line
  full: 2.2,
  flicker: 0.08,    // the burn wavers, each pod on its own beat
};
export const HEAT = { glow: [2.4, 0.62, 0.12], cool: [0.5, 0.06, 0.012], white: [2.6, 1.7, 0.8], halo: 2.1 };   // the nozzle's glow, hot and nearly cold, its white-hot middle (linear); the halo's size against the nozzle's

const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _d = new THREE.Vector3(), _inv = new THREE.Matrix4(), ZERO = new THREE.Vector3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function makeFlight({ pods = [], podHalf = 0.63, swing = { yaw: 1.2, pitch: 0.6 }, nozzles = [], jet = { len: 9, gain: 1 }, podJet = { len: 10, gain: 1.2, r: 0.2 }, frame, parent, quality = 'medium' } = {}) {
  const group = new THREE.Group(); group.name = 'flight'; parent.add(group);
  _inv.copy(frame).invert();
  // each pod: its leaf (a yaw hinge, then a pitch hinge), where its middle is on the ship, a jet at each end
  const P = pods.map((D, i) => {
    const L = D.leaves[0]; if (!L || !L.hinge || L.hinge.length < 2) return null;
    const mid = new THREE.Vector3().setFromMatrixPosition(poseLeaf(L, [0, 0])).applyMatrix4(_inv);
    const set = makeJets([{ at: [0, 0, 0], dir: [0, 0, 1], r: podJet.r }, { at: [0, 0, 0], dir: [0, 0, -1], r: podJet.r }], { len: podJet.len, gain: podJet.gain });
    group.add(set.group);
    return { D, L, mid, out: Math.sign(mid.x) || 1, yaw: 0, pitch: 0, end: 1, set, beat: i * 1.7 };
  }).filter(Boolean);
  // the main engine: its jet in its nozzle (idle is a dull orange), and the nozzle's own glow, which lingers as it cools
  const main = nozzles.length ? makeJets(nozzles.map((n) => ({ at: _v.set(...n.at).applyMatrix4(frame).toArray(), dir: _d.set(...n.dir).transformDirection(frame).toArray(), r: n.r })), { len: jet.len, gain: jet.gain }) : null;
  if (main) group.add(main.group);
  // (the nozzle's face: hot orange, white in the middle while it runs hot; round it a soft halo of its light on the
  // rim and the hull: a disc a hair aft of the nozzle's core, and a wider one fainter, both drawn additively)
  const heatUni = { col: { value: new THREE.Color() }, white: { value: new THREE.Color() }, halo: { value: 0 } };
  const glowMat = new THREE.ShaderMaterial({
    uniforms: heatUni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 col; uniform vec3 white; uniform float halo; varying vec2 vUv;
      void main() { float r = length(vUv * 2.0 - 1.0);
        if (halo > 0.5) { float a = (1.0 - smoothstep(0.0, 1.0, r)) * 0.28; gl_FragColor = vec4(col * a, a); return; }
        float a = 1.0 - smoothstep(0.55, 1.0, r); vec3 c = mix(white, col, smoothstep(0.0, 0.6, r)); gl_FragColor = vec4(c * a, a); }`,
  });
  const haloMat = glowMat.clone(); haloMat.uniforms = { col: heatUni.col, white: heatUni.white, halo: { value: 1 } };
  const glows = nozzles.flatMap((n) => {
    const at = _v.set(...n.at).applyMatrix4(frame).clone(), dir = _d.set(...n.dir).transformDirection(frame).clone();
    return [[n.r * 1.0, glowMat, 0.015, 'engine heat'], [n.r * HEAT.halo, haloMat, 0.03, 'engine heat halo']].map(([r, mat, aft, name]) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), mat);
      m.position.copy(at).addScaledVector(dir, aft); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); m.renderOrder = 6; m.frustumCulled = false; m.visible = false; m.name = name;
      group.add(m); return m;
    });
  });
  let t = 0, flying = false;
  const fx = {
    group, pods: P, main,
    get drawn() { return flying || glows.some((g) => g.visible); },
    update(dt, { acc = ZERO, spin = 0, hold = 0, engine = 0, heat = 0 } = {}) {
      t += dt; flying = hold > 0.001 || acc.lengthSq() > 1e-4 || Math.abs(spin) > 1e-4;
      for (const p of P) {
        // the push at this pod, and its jet the other way
        const ax = acc.x + spin * p.mid.z, ay = acc.y, az = acc.z - spin * p.mid.x;
        let dx = -ax * PUSH.gain + p.out * PUSH.out * hold, dy = -ay * PUSH.gain - PUSH.down * hold, dz = -az * PUSH.gain;
        const len = Math.hypot(dx, dy, dz);
        if (len > 1e-4) {
          dx /= len; dy /= len; dz /= len;
          // (out from the hull, never in across it: the push that needs the other side is the other side's pods')
          if (dx * p.out < PUSH.inward) dx = PUSH.inward * p.out;
          // (the end that faces the way it goes; kept unless the other end is clearly the better)
          if (Math.abs(dz) > 0.2) p.end = Math.sign(dz);
          const e = p.end, yawT = clamp(Math.atan2(dx * e, dz * e), -swing.yaw, swing.yaw), pitchT = clamp(-e * Math.asin(clamp(dy, -1, 1)), -swing.pitch, swing.pitch);
          p.yaw += clamp(yawT - p.yaw, -PUSH.turn * dt, PUSH.turn * dt); p.pitch += clamp(pitchT - p.pitch, -PUSH.turn * dt, PUSH.turn * dt);
        }
        const H = p.L.hinge;
        _m.copy(poseLeaf(p.L, [p.yaw / H[0].angle, p.pitch / H[1].angle]));
        [1, -1].forEach((sz, k) => { const J = p.set.jets[k]; J.aim(_v.set(0, 0, sz * (podHalf + 0.01)).applyMatrix4(_m), _d.set(0, 0, sz).transformDirection(_m)); J.on = sz === p.end; });
        const push = Math.hypot(ax, ay, az), burn = hold > 0.001 || push > 0.15 ? PUSH.hover * hold + PUSH.burst * clamp(push / PUSH.full, 0, 1) : 0;
        p.set.setThrust(burn > 0.01 ? clamp(burn * (1 + PUSH.flicker * Math.sin(t * 11 + p.beat) * Math.sin(t * 4.3 + p.beat * 2)), 0, 1) : 0);
        p.set.update(dt);
      }
      if (main) { main.setThrust(engine); main.update(dt); }
      const h = clamp(heat, 0, 1);
      for (const g of glows) g.visible = h > 0.01;
      if (h > 0.01) { heatUni.col.value.setRGB(...HEAT.cool.map((c, i) => c + (HEAT.glow[i] - c) * h)).multiplyScalar(h); heatUni.white.value.setRGB(...HEAT.white).multiplyScalar(h * h).add(heatUni.col.value.clone().multiplyScalar(1 - h)); }
    },
    rest() {
      for (const p of P) { p.yaw = 0; p.pitch = 0; poseLeaf(p.L, [0, 0]); p.set.setThrust(0, true); }
      if (main) main.setThrust(0, true);
      flying = false;
    },
  };
  return fx;
}

// THE AIR BLOWN DOWN: a disc of dust on the floor under the ship, its rings running out, broken by noise (one draw), and
// motes swirling up off the floor and out (one draw; none on the low setting, fewer on medium)
const AIR = { spread: 12, motes: { low: 0, medium: 90, high: 170 } };
const DUST_VERT = `varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DUST_FRAG = `
  uniform float time; uniform float strength; uniform float spread; varying vec2 vP;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
  void main() {
    // (no pow of a number that rounding can take below zero, no angle of the very middle: either is not a number on
    // some graphics cards, and the glow's blur spreads one such pixel into a black block)
    float r = length(vP), a = atan(vP.y, vP.x + 1e-4);
    // gusts running out from under it: rings broken into arcs by streaks that run out along the floor, over a haze of
    // dust thickest under the ship and thinning to its edge
    float rings = pow(max(0.0, 0.5 + 0.5 * sin((r * 0.95 - time * 2.8) * 2.8 + noise(vec2(a * 3.0, time * 0.7)) * 2.5)), 3.0);
    float streak = noise(vec2(a * 4.0 + r * 0.25 + sin(time * 0.3) * 2.0, r * 0.45 - time * 1.9)) * 0.7 + noise(vec2(a * 2.0 - time * 0.2, r * 0.9 - time * 2.6)) * 0.3;
    float grain = noise(vec2(a * 5.0 + r * 0.5, r * 1.4 - time * 3.4)) * 0.6 + noise(vec2(a * 14.0, r * 3.0 - time * 5.5)) * 0.4;
    float fall = smoothstep(spread, spread * 0.2, r) * smoothstep(0.0, 1.0, r);
    float haze = smoothstep(spread * 0.55, 0.0, r) * 0.22;
    float alpha = strength * fall * (haze + (0.08 + 0.5 * rings) * smoothstep(0.25, 0.75, streak)) * (0.35 + 0.9 * grain);
    gl_FragColor = vec4(0.58, 0.56, 0.52, clamp(alpha, 0.0, 0.6));
  }`;
const MOTE_VERT = `
  uniform float time; uniform float strength; uniform float spread; uniform float size; attribute vec4 seed; varying float vA;
  void main() {
    float life = fract(seed.z + time * (0.22 + 0.3 * seed.y));
    float r = mix(1.2, spread, life), a = seed.x * 6.2831853 + life * (1.4 + seed.y);
    vec3 p = vec3(cos(a) * r, 0.04 + seed.w * 2.4 * sin(life * 3.14159), sin(a) * r);
    vA = strength * sin(life * 3.14159) * (0.45 + 0.55 * seed.y);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = size * (0.5 + seed.w) / max(0.5, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const MOTE_FRAG = `varying float vA; void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d) * vA; gl_FragColor = vec4(0.74, 0.71, 0.65, a * 0.6); }`;

export function makeDownwash({ parent, quality = 'medium', spread = AIR.spread } = {}) {
  const uni = { time: { value: 0 }, strength: { value: 0 }, spread: { value: spread }, size: { value: 95 } };
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(spread * 2.7, spread * 2.7, 1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: uni, vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false }));
  disc.name = 'downwash'; disc.renderOrder = 4; disc.frustumCulled = false; disc.visible = false;
  parent.add(disc);
  const n = AIR.motes[quality] ?? AIR.motes.medium;
  let motes = null;
  if (n) {
    const g = new THREE.BufferGeometry(), seed = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i++) seed[i] = Math.random();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    motes = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: uni, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false }));
    motes.name = 'downwash motes'; motes.renderOrder = 5; motes.frustumCulled = false; motes.visible = false;
    parent.add(motes);
  }
  return {
    disc, motes,
    update(dt, { x = 0, z = 0, y = 0, height = 3, strength = 1, spread: k = 1 } = {}) {
      // (stronger as the ship comes down to the floor; `spread` its reach as a share of the most it reaches)
      const s = clamp(strength, 0, 1) * clamp(1.35 - height / 7, 0, 1);
      uni.time.value += dt; uni.strength.value = s; uni.spread.value = spread * clamp(k, 0.3, 1.3);
      for (const o of [disc, motes]) if (o) { o.visible = s > 0.01; o.position.set(x, y + 0.025, z); }
    },
    hide() { uni.strength.value = 0; disc.visible = false; if (motes) motes.visible = false; },
  };
}
