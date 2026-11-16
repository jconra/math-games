// THE REFERENCE FIGURE (2026-11-15; the game's maker, of a long neck no check had caught: "I wish that a critic agent
// could do better at knowing when human proportions are off"). A plain mannequin of NORMAL ADULT PROPORTIONS, to stand
// beside a crew figure at the same height, so an eye (his, or a critic's) has something to compare against: where a
// person's chin, shoulders, elbows, wrists, fingertips, crotch and knees come, how long and how thick a neck is, how
// wide the shoulders are. It is no character: grey, three plain tones (hair, skin, clothes), ball joints.
//   THE PROPORTIONS are the US Army's 1988 body survey's means (ANSUR: 1,774 men, 2,208 women; Gordon et al. 1989,
//   Natick TR-89/044), each a share of the height worked out person by person from the survey's public tables
//   (~/pw/space-math/rigs/proportions/ansur_mannequin.py). The head's height (chin to the top of the skull) is the
//   report's own head-board mean (23.20 cm men, 21.76 cm women); the skull's base is level with the base of the nose,
//   0.70 of the head under its top (16.19 and 15.28 cm).
//   THE HAIR'S LOWER EDGE at the back is this file's own working rule (the survey doesn't measure it): 0.80 of the
//   head under its top, the mouth's level, a short haircut's natural hairline. THE CLOTHES' NECKLINE is the neck's own
//   base: the 7th neck bone behind, the neck-shoulder points at the sides, the pit of the neck in front (a collarless
//   top; a collar stands some centimetres higher). So from behind the mannequin shows the bare neck a person shows
//   with short hair and no collar: about a fifth of a head.
//   const ref = referenceFigure({ sex: 'f' | 'm', stature: 1.70, guides: true })
//     -> a THREE.Group, feet on y 0, facing +z, arms hanging. guides: level bars at the landmarks' heights, each with
//        its name, reaching `reach` metres to the mannequin's right (toward x -), so they cross a figure standing
//        there. ref.userData.marks: { name: height in metres }; ref.userData.proportions: the shares used.
//   REFERENCE: the shares themselves (heights and widths over the whole height; widths of round limbs are girth / pi)
import * as THREE from 'three';

export const REFERENCE = {
  m: { head: 0.1321, cervicale: 0.8653, neckSide: 0.8597, suprasternale: 0.8191, acromion: 0.8215, axilla: 0.7522, chest: 0.7266, waist: 0.6029, trochanter: 0.5286, crotch: 0.4766,
    knee: 0.2874, ankle: 0.0382, elbow: 0.6274, wrist: 0.4821, fingertip: 0.3717,
    biacromial: 0.2262, bideltoid: 0.2803, chestBreadth: 0.1832, chestDepth: 0.1386, waistBreadth: 0.1762, waistDepth: 0.1289, hipBreadth: 0.1948, buttockDepth: 0.1417,
    headBreadth: 0.0865, headLength: 0.1124, neck: 0.0689, neckBase: 0.0741, upperArm: 0.0608, elbowW: 0.0503, forearm: 0.0551, wristW: 0.0316,
    thigh: 0.1082, kneeW: 0.0701, calf: 0.0686, ankleW: 0.0402, handBreadth: 0.0515, footLength: 0.1536, footBreadth: 0.0573 },
  f: { head: 0.1335, cervicale: 0.864, neckSide: 0.857, suprasternale: 0.8164, acromion: 0.8184, axilla: 0.757, chest: 0.7206, waist: 0.6026, trochanter: 0.5287, crotch: 0.4732,
    knee: 0.2814, ankle: 0.0372, elbow: 0.627, wrist: 0.485, fingertip: 0.3742,
    biacromial: 0.2227, bideltoid: 0.2657, chestBreadth: 0.1718, chestDepth: 0.1471, waistBreadth: 0.1779, waistDepth: 0.1253, hipBreadth: 0.2105, buttockDepth: 0.1395,
    headBreadth: 0.0888, headLength: 0.115, neck: 0.0617, neckBase: 0.0677, upperArm: 0.057, elbowW: 0.0466, forearm: 0.0496, wristW: 0.0296,
    thigh: 0.1134, kneeW: 0.0714, calf: 0.0689, ankleW: 0.0401, handBreadth: 0.0488, footLength: 0.15, footBreadth: 0.0551 },
};
// (the skull's base and the hair's lower edge at the back, shares of the head under its top; the front hairline's)
export const HEAD_MARKS = { skullBase: 0.70, nape: 0.80, hairline: 0.18 };
const TONE = { hair: new THREE.Color(0x2b2622), skin: new THREE.Color(0xb39378), cloth: new THREE.Color(0x56616f) };

// (a skin of level oval rings, bottom to top: each [y, x half-width, z half-depth, z of its middle]; closed at both
// ends; coloured point by point)
function loft(rings, colourOf, seg = 32) {
  const pos = [], col = [], idx = [], c = new THREE.Color();
  const put = (x, y, z) => { pos.push(x, y, z); colourOf(x, y, z, c); col.push(c.r, c.g, c.b); };
  for (const [y, hw, hd, zc] of rings) for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2; put(Math.sin(a) * hw, y, (zc || 0) + Math.cos(a) * hd); }
  for (let r = 0; r + 1 < rings.length; r++) for (let i = 0; i < seg; i++) { const a = r * seg + i, b = r * seg + (i + 1) % seg; idx.push(a, b, a + seg, b, b + seg, a + seg); }
  const first = rings[0], last = rings[rings.length - 1], n = rings.length * seg;
  put(0, first[0], first[3] || 0); put(0, last[0], last[3] || 0);
  for (let i = 0; i < seg; i++) { idx.push(n, (i + 1) % seg, i); idx.push(n + 1, (rings.length - 1) * seg + i, (rings.length - 1) * seg + (i + 1) % seg); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// (a limb between two joints: a tapered tube with a ball at each end)
function limb(group, mat, a, b, ra, rb) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, len, 20, 1, true), mat);
  tube.position.copy(a).addScaledVector(d, 0.5); tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  const ba = new THREE.Mesh(new THREE.SphereGeometry(ra, 20, 14), mat), bb = new THREE.Mesh(new THREE.SphereGeometry(rb, 20, 14), mat);
  ba.position.copy(a); bb.position.copy(b);
  group.add(tube, ba, bb);
}
function label(text, colour) {
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 48; const g = cv.getContext('2d');
  g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.lineWidth = 5; g.strokeStyle = 'rgba(12, 16, 22, 0.85)'; g.strokeText(text, 6, 25); g.fillStyle = colour; g.fillText(text, 6, 25);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false })); s.scale.set(0.8, 0.06, 1); s.center.set(0, 0.2);
  return s;
}

export function referenceFigure({ sex = 'f', stature = 1.7, guides = false, reach = 1.0 } = {}) {
  const R = REFERENCE[sex === 'm' ? 'm' : 'f'], S = stature, G = new THREE.Group(); G.name = 'reference figure';
  const H = R.head * S, top = S, chin = S - H, y = (k) => R[k] * S, w = (k) => R[k] * S;
  const skin = new THREE.MeshStandardMaterial({ color: TONE.skin, roughness: 0.9, metalness: 0 }), cloth = new THREE.MeshStandardMaterial({ color: TONE.cloth, roughness: 0.9, metalness: 0 });
  const both = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  // THE HEAD: an egg as tall as the head, as wide and as long as the survey's skull, narrowing to the chin; hair above
  // the line from the front hairline down to the nape's hairline
  {
    const rx = w('headBreadth') / 2, rz = w('headLength') / 2, ry = H / 2, cy = top - ry, cz = 0.012 * S, rings = [];
    for (let i = 0; i <= 48; i++) { const t = i / 48, yy = cy - ry * Math.cos(t * Math.PI), s = Math.sin(t * Math.PI), low = Math.max(0, (cy - yy) / ry); rings.push([yy, Math.max(1e-4, rx * s * (1 - 0.22 * low * low)), Math.max(1e-4, rz * s * (1 - 0.1 * low * low)), cz + 0.012 * S * low * low]); }
    const yF = top - HEAD_MARKS.hairline * H, yB = top - HEAD_MARKS.nape * H;
    G.add(new THREE.Mesh(loft(rings, (x, yy, z, c) => { const f = (z - (cz - rz)) / (2 * rz), line = yB + (yF - yB) * Math.min(1, Math.max(0, f * 1.15)); c.copy(yy > line ? TONE.hair : TONE.skin); }, 72), both));
  }
  // THE NECK AND THE BODY, one skin from the crotch up into the head: the hips, the waist, the chest, the shoulders
  // (as wide as the shoulder points, at their height), the slope up to the neck, the neck. Clothes below the neckline
  // (the 7th neck bone behind, the pit of the neck in front), skin above
  {
    const nb = w('neckBase') / 2, nk = w('neck') / 2, ac = y('acromion'), ns = y('neckSide');
    const rings = [
      [y('crotch'), 0.05 * S, 0.045 * S, 0], [y('crotch') + 0.02 * S, w('hipBreadth') * 0.43, w('buttockDepth') * 0.46, -0.004 * S], [y('trochanter'), w('hipBreadth') / 2, w('buttockDepth') / 2, -0.006 * S],
      [y('waist'), w('waistBreadth') / 2, w('waistDepth') / 2, 0], [y('chest'), w('chestBreadth') / 2, w('chestDepth') / 2, 0.006 * S], [y('axilla'), w('chestBreadth') / 2 + 0.004 * S, w('chestDepth') * 0.47, 0.002 * S],
      [ac - 0.022 * S, w('biacromial') / 2 - 0.004 * S, 0.052 * S, -0.004 * S], [ac, w('biacromial') / 2 - 0.014 * S, 0.044 * S, -0.006 * S],
      [ac + (ns - ac) * 0.5, (w('biacromial') / 2 + nb) / 2 - 0.01 * S, 0.04 * S, -0.008 * S], [ns, nb + 0.004 * S, nb * 1.08, -0.008 * S],
      [ns + 0.012 * S, nk + 0.002 * S, nk * 1.04, -0.003 * S], [chin - 0.1 * H, nk, nk, 0.004 * S], [chin + 0.25 * H, nk, nk, 0.01 * S],
    ];
    const yB = y('cervicale'), yF = y('suprasternale');
    G.add(new THREE.Mesh(loft(rings, (x, yy, z, c) => { const f = (z + 0.06 * S) / (0.12 * S), line = yB + (yF - yB) * Math.min(1, Math.max(0, f)); c.copy(yy > line ? TONE.skin : TONE.cloth); }, 40), both));
  }
  // THE ARMS, hanging: shoulder joint, elbow, wrist, fingertips at the survey's heights; the upper arm's outside at
  // the shoulders' full width (over the arms)
  for (const sg of [1, -1]) {
    const ru = w('upperArm') / 2, sx = w('bideltoid') / 2 - ru, sh = new THREE.Vector3(sg * sx, y('acromion') - ru * 0.9, -0.004 * S);
    const el = new THREE.Vector3(sg * (sx + 0.004 * S), y('elbow'), -0.004 * S), wr = new THREE.Vector3(sg * (sx + 0.008 * S), y('wrist'), 0.012 * S), ft = new THREE.Vector3(sg * (sx + 0.008 * S), y('fingertip') + 0.004 * S, 0.02 * S);
    limb(G, cloth, sh, el, ru, w('elbowW') / 2); limb(G, cloth, el, wr, w('forearm') / 2, w('wristW') / 2);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), skin), mid = new THREE.Vector3().addVectors(wr, ft).multiplyScalar(0.5);
    hand.position.copy(mid); hand.scale.set(0.014 * S, wr.distanceTo(ft) / 2, w('handBreadth') / 2); hand.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(wr, ft).normalize());
    G.add(hand);
  }
  // THE LEGS: hip joint (the top of the thigh bone's height), knee, ankle; the feet
  for (const sg of [1, -1]) {
    const hx = sg * 0.05 * S, hip = new THREE.Vector3(hx, y('trochanter'), 0), kn = new THREE.Vector3(hx, y('knee'), 0.004 * S), an = new THREE.Vector3(hx, y('ankle') + 0.012 * S, -0.004 * S);
    limb(G, cloth, hip, kn, w('thigh') / 2, w('kneeW') / 2); limb(G, cloth, kn, an, w('calf') / 2, w('ankleW') / 2);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), cloth);
    foot.position.set(hx, 0.022 * S, 0.03 * S); foot.scale.set(w('footBreadth') / 2, 0.022 * S, w('footLength') / 2); G.add(foot);
  }
  const marks = { 'top of the head': top, 'skull base': top - HEAD_MARKS.skullBase * H, chin, 'neck ends (back)': y('cervicale'), 'shoulder points': y('acromion'), elbows: y('elbow'), wrists: y('wrist'), crotch: y('crotch'), fingertips: y('fingertip'), knees: y('knee') };
  if (guides) {
    const bar = new THREE.MeshBasicMaterial({ color: 0xf2b547 });
    // (a bar a landmark, from 0.3 m to the mannequin's left to `reach` to its right; landmarks under 3 cm apart
    // (the chin and the neck's end behind; the wrists and the crotch) share one name tag)
    const rows = [];
    for (const [name, yy] of Object.entries(marks).sort((a, b) => b[1] - a[1])) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(reach + 0.3, 0.003, 0.003), bar); b.position.set((0.3 - reach) / 2, yy, 0); G.add(b);
      const last = rows[rows.length - 1]; if (last && last.y - yy < 0.03) last.names.push(name); else rows.push({ y: yy, names: [name] });
    }
    for (const r of rows) { const t = label(r.names.join(' + '), '#f2b547'); t.position.set(0.32, r.y + 0.004, 0); G.add(t); }
  }
  G.userData.marks = marks; G.userData.proportions = R; G.userData.stature = S; G.userData.head = H;
  return G;
}
