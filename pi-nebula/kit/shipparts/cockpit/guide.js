// A PERSON FOR SCALE (a guide, not a game part): a plain 1.75 m figure in a pale blue-grey, built of boxes, to show
// that the cockpit parts fit a person and to stand beside parts in pictures. Facing +z, standing (or sitting) at x = 0.
//   standingPerson(p)        on the deck at the origin
//   seatedPose(o)            the joints of a person sitting in a flight seat (kit/shipparts/cockpit/seats.js) built with
//                            the same options o, the seat at the origin, feet on `feet` ([x, y, z] of each ankle, or
//                            null: under the knees), hands on `hands` ({ left, right }: [x, y, z] of each grip, or null:
//                            on the armrests). Returns { joints, limbs: [{ name, a, b, t }] } (each limb a bar a -> b
//                            of section t), which seatedPerson draws and the cockpit's checks test against the parts
//   seatedPerson(p, o)       that pose, drawn
import * as THREE from 'three';
import { bar } from './look.js';
import { seatPoints } from './seats.js';

export const BODY = { height: 1.75, eye: 1.63, shoulder: 1.43, hip: 0.91, knee: 0.49, ankle: 0.08, thigh: 0.44, shin: 0.42, upperArm: 0.32, forearm: 0.3 };
const SKIN = { c: '#7d95ad', r: 0.75, m: 0, w: 0 }, SUIT = { c: '#5f7690', r: 0.8, m: 0, w: 0 };
const V = (a) => new THREE.Vector3(...a);
// two bones from a to a target, bending toward `toward` (a direction): the middle joint
function ik(a, target, l1, l2, toward) {
  const A = V(a), T = V(target), d = T.clone().sub(A), L = Math.min(d.length(), l1 + l2 - 1e-4), u = d.normalize();
  const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const side = V(toward).addScaledVector(u, -V(toward).dot(u)).normalize();
  return { mid: A.clone().addScaledVector(u, x).addScaledVector(side, h).toArray(), end: A.clone().addScaledVector(u, L).toArray() };
}

export function seatedPose(o = {}) {
  const P = seatPoints(o), h = P.h, cos = Math.cos(P.recline), sin = Math.sin(P.recline);
  const hipZ = P.backAt(0.1) + 0.13, hips = [-1, 1].map((s) => [s * 0.09, h + 0.1, hipZ]);
  const neck = [0, h + 0.64, P.backAt(0.64) + 0.11], head = [0, P.eye[1] + 0.03, P.eye[2] - 0.075];
  const limbs = [];
  // the torso: a block from the hips to the shoulders, leaning back with the seat
  limbs.push({ name: 'pelvis', a: [0, h + 0.03, hipZ - 0.02], b: [0, h + 0.2, hipZ - 0.02 - 0.17 * sin / cos], t: [0.36, 0.22] });
  limbs.push({ name: 'chest', a: [0, h + 0.2, P.backAt(0.2) + 0.12], b: [0, h + 0.58, P.backAt(0.58) + 0.12], t: [0.4, 0.22] });
  limbs.push({ name: 'neck', a: [0, h + 0.58, P.backAt(0.58) + 0.12], b: neck, t: 0.1 });
  limbs.push({ name: 'head', a: [head[0], head[1] - 0.12, head[2]], b: [head[0], head[1] + 0.11, head[2]], t: [0.16, 0.2] });
  const joints = { eye: P.eye, shoulders: P.shoulders, hips, head };
  // the legs: to each ankle (on the pedals, or under the knees), the knees bending up
  [-1, 1].forEach((s, i) => {
    const ankle = o.feet?.[i] || [s * 0.1, 0.09, hipZ + 0.5];
    const { mid: knee, end } = ik(hips[i], ankle, BODY.thigh, BODY.shin, [0, 1, 0.3]);
    limbs.push({ name: 'thigh' + i, a: hips[i], b: knee, t: 0.14 }, { name: 'shin' + i, a: knee, b: end, t: 0.11 });
    limbs.push({ name: 'foot' + i, a: [end[0], end[1] - 0.04, end[2] - 0.04], b: [end[0], end[1] - 0.04, end[2] + 0.2], t: [0.09, 0.07] });
    joints['knee' + i] = knee; joints['ankle' + i] = end;
  });
  // the arms: to each hand (on a grip, or on the armrest's front), the elbows bending down and out
  [-1, 1].forEach((s, i) => {
    const sh = P.shoulders[i], key = s > 0 ? 'left' : 'right', hand = o.hands?.[key] || [P.arm[key][0], P.arm[key][1] + 0.03, P.arm[key][2] - 0.08];
    const { mid: elbow, end } = ik(sh, hand, BODY.upperArm, BODY.forearm, [s * 0.5, -1, -0.3]);
    limbs.push({ name: 'upperArm' + i, a: sh, b: elbow, t: 0.09 }, { name: 'forearm' + i, a: elbow, b: end, t: 0.075 });
    limbs.push({ name: 'hand' + i, a: end, b: V(end).add(V(end).sub(V(elbow)).normalize().multiplyScalar(0.09)).toArray(), t: [0.05, 0.09] });
    joints['elbow' + i] = elbow; joints['hand' + i] = end;
  });
  return { joints, limbs };
}

function drawLimbs(p, limbs) {
  for (const L of limbs) {
    const surf = /head|hand|neck/.test(L.name) ? SKIN : SUIT;
    if (L.name === 'head') { const c = V(L.a).add(V(L.b)).multiplyScalar(0.5); p.lathe(SKIN, [[0.001, -0.115], [0.06, -0.1], [0.08, -0.03], [0.082, 0.03], [0.07, 0.085], [0.035, 0.112], [0.001, 0.116]], 10, c.toArray()); continue; }
    bar(p, surf, L.a, L.b, L.t, { r: 0.02, seg: 1, cell: 9, loops: [] });
  }
}
export function seatedPerson(p, o = {}) { drawLimbs(p, seatedPose(o).limbs); }

export function standingPerson(p) {
  const L = [];
  for (const s of [-1, 1]) {
    L.push({ name: 'shin', a: [s * 0.1, 0.08, 0], b: [s * 0.1, BODY.knee, 0], t: 0.11 }, { name: 'thigh', a: [s * 0.1, BODY.knee, 0], b: [s * 0.1, BODY.hip, 0], t: 0.15 });
    L.push({ name: 'foot', a: [s * 0.1, 0.04, -0.06], b: [s * 0.1, 0.04, 0.18], t: [0.09, 0.08] });
    L.push({ name: 'upperArm', a: [s * 0.21, BODY.shoulder, 0], b: [s * 0.24, BODY.shoulder - 0.32, 0.02], t: 0.09 }, { name: 'forearm', a: [s * 0.24, BODY.shoulder - 0.32, 0.02], b: [s * 0.25, BODY.shoulder - 0.6, 0.06], t: 0.075 });
    L.push({ name: 'hand', a: [s * 0.25, BODY.shoulder - 0.6, 0.06], b: [s * 0.25, BODY.shoulder - 0.69, 0.07], t: [0.05, 0.09] });
  }
  L.push({ name: 'pelvis', a: [0, BODY.hip - 0.08, 0], b: [0, BODY.hip + 0.1, 0], t: [0.36, 0.22] }, { name: 'chest', a: [0, BODY.hip + 0.1, 0], b: [0, BODY.shoulder + 0.02, 0], t: [0.42, 0.23] });
  L.push({ name: 'neck', a: [0, BODY.shoulder, 0], b: [0, BODY.shoulder + 0.1, 0], t: 0.1 }, { name: 'head', a: [0, BODY.height - 0.235, 0.0], b: [0, BODY.height - 0.005, 0.0], t: 0.18 });
  drawLimbs(p, L);
}
