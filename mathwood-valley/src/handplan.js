// THE BAND'S POSES IN NUMBERS (no three.js: the lab, the game and the tests read the same ones). What the Hands Lab
// (labs/hands) sets and models/people/hands.json keeps: for each player, each clip, turns added on top of the clip, bone
// by bone, and where the instruments sit:
//   { v: 2, players: { fiddler: { Play_Fiddle: {
//       bones: { LowerArmL: { bend: 10, twist: 80 }, Index2L: { curl: 40 } },
//       props: { fiddle: { pos: [x, y, z], rot: [x, y, z], bone: 'Head', at: [16 numbers] } } } } } }
// Each bone offers only the joints it really has (jointsOf): the shoulder three, the elbow one bend, the forearm a twist
// spread along its length, the wrist tip and side, a finger's base curl and spread, its knuckles curl. All in degrees, the
// same number meaning the same movement on either side, so a pose copies across (copyPose).
// A prop's pos is cm in the player's own frame (x to his left, y up, z the way he faces), its rot degrees about its own
// axes; bone and at: which bone holds it and where in that bone's frame (no bone: it stays where its clip has it).
export const PLAYERS = {
  fiddler: { name: 'The fiddler', clips: ['Play_Fiddle', 'Fiddle_Rest', 'Fiddle_Up', 'Fiddle_Down'], props: { fiddle: 'The fiddle', bow: 'The bow' } },
  banjo: { name: 'The banjo player', clips: ['Play_Banjo', 'Banjo_Rest'], props: { banjo: 'The banjo', stool: 'The stool' } },
  harpist: { name: 'The harmonica player', clips: ['Play_Harmonica', 'Harmonica_Rest'], props: { harmonica: 'The harmonica' } },
};
export const ELBOW_MOST = 150;   // the most an elbow bends, degrees from straight, the clip and the turn added together
export const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
const FINGER_WORD = { Index: 'index finger', Middle: 'middle finger', Ring: 'ring finger', Pinky: 'little finger', Thumb: 'thumb' };
const J = (id, label, min, max) => ({ id, label, min, max });
const SPINE = [J('nod', 'Bend forward', -60, 60), J('turn', 'Turn to his left', -70, 70), J('lean', 'Lean to his left', -45, 45)];
// the joints of a bone (none for the two that are no joint at all: Root, the whole figure; the knee-aiming targets PTL, PTR)
export function jointsOf(name) {
  const base = name.replace(/[LR]$/, '');
  const m = /^(Index|Middle|Ring|Pinky)([1-4])$/.exec(base);
  if (m) {
    if (m[2] === '1') return [J('curl', 'Cup the palm', -20, 40), J('spread', 'Fan out', -20, 20)];
    if (m[2] === '2') return [J('curl', 'Curl', -30, 100), J('spread', 'Spread', -30, 30)];
    return [J('curl', 'Curl', -20, 110)];
  }
  const t = /^Thumb([1-3])$/.exec(base);
  if (t) return t[1] === '1' ? [J('curl', 'Across the palm', -45, 70), J('out', 'Away from the palm', -45, 60)] : [J('curl', 'Curl', -20, 90)];
  switch (base) {
    case 'Body': case 'Hips': case 'Abdomen': case 'Torso': case 'Chest': case 'Neck': case 'Head': return SPINE;
    case 'Shoulder': return [J('lift', 'Shrug up', -30, 40), J('forward', 'Forward', -30, 40)];
    case 'UpperArm': return [J('forward', 'Forward', -150, 150), J('raise', 'Raise', -150, 150), J('roll', 'Roll', -150, 150)];
    case 'LowerArm': return [J('bend', 'Bend the elbow', -ELBOW_MOST, ELBOW_MOST), J('twist', 'Twist the forearm (palm up)', -180, 180)];
    case 'Wrist': return [J('tip', 'Tip toward the palm', -90, 90), J('side', 'Side, toward the thumb', -50, 50)];
    case 'UpperLeg': return [J('forward', 'Forward', -120, 120), J('out', 'Out to the side', -60, 60), J('roll', 'Roll', -60, 60)];
    case 'LowerLeg': return [J('bend', 'Bend the knee', -150, 150)];
    case 'Foot': return [J('tip', 'Toes up', -60, 60), J('turn', 'Turn', -45, 45)];
    default: return [];
  }
}
const sideOf = (name) => { const s = name[name.length - 1]; return s === 'L' ? 'left' : s === 'R' ? 'right' : ''; };
// a bone's name in plain words
export function boneWord(name) {
  const base = name.replace(/[LR]$/, ''), side = sideOf(name);
  const m = /^(Index|Middle|Ring|Pinky|Thumb)([1-4])$/.exec(base);
  if (m) {
    const part = m[1] === 'Thumb' ? { 1: 'at the palm', 2: 'first knuckle', 3: 'end knuckle' }[m[2]] : { 1: 'palm bone', 2: 'base', 3: 'middle knuckle', 4: 'end knuckle' }[m[2]];
    return `${side} ${FINGER_WORD[m[1]]}, ${part}`;
  }
  const W = { Root: 'Root (the whole figure)', Body: 'Body', Hips: 'Hips', Abdomen: 'Belly', Torso: 'Ribs', Chest: 'Chest', Neck: 'Neck', Head: 'Head', Shoulder: 'collarbone', UpperArm: 'shoulder (upper arm)', LowerArm: 'elbow and forearm', Wrist: 'wrist', UpperLeg: 'hip (thigh)', LowerLeg: 'knee', Foot: 'foot', PT: 'knee aim' };
  return side ? `${side} ${W[base] || base}` : W[base] || base;
}
const HAND_BONES = (s) => ['Wrist' + s, ...FINGERS.flatMap((f) => [1, 2, 3, 4].map((i) => f + i + s)), ...[1, 2, 3].map((i) => 'Thumb' + i + s)];
const ARM_BONES = (s) => ['Shoulder' + s, 'UpperArm' + s, 'LowerArm' + s];
export const handBones = HAND_BONES, armBones = ARM_BONES;
// the list the lab shows, every bone of the rig (the 62 of src/actors/folk.js's skeletons)
export const BONE_GROUPS = [
  { id: 'handL', label: 'Left hand', bones: HAND_BONES('L') }, { id: 'armL', label: 'Left arm', bones: ARM_BONES('L') },
  { id: 'handR', label: 'Right hand', bones: HAND_BONES('R') }, { id: 'armR', label: 'Right arm', bones: ARM_BONES('R') },
  { id: 'body', label: 'Body and head', bones: ['Root', 'Body', 'Hips', 'Abdomen', 'Torso', 'Chest', 'Neck', 'Head'] },
  { id: 'legs', label: 'Legs', bones: ['UpperLegL', 'LowerLegL', 'FootL', 'PTL', 'UpperLegR', 'LowerLegR', 'FootR', 'PTR'] },
];
const ALL_BONES = BONE_GROUPS.flatMap((g) => g.bones);

const round = (v, d = 10) => Math.round(v * d) / d;
const num = (v, lo, hi) => { const n = +v; return Number.isFinite(n) ? round(Math.max(lo, Math.min(hi, n))) : 0; };
function cleanBone(name, b) {
  const out = {}; if (!b || typeof b !== 'object') return out;
  for (const j of jointsOf(name)) { const v = num(b[j.id], j.min, j.max); if (v) out[j.id] = v; }
  return out;
}
function cleanProp(p) {
  if (!p || typeof p !== 'object') return null;
  const trip = (a, m) => [0, 1, 2].map((i) => num(Array.isArray(a) ? a[i] : 0, -m, m));
  const pos = trip(p.pos, 100), rot = trip(p.rot, 180), out = {};
  if (pos.some(Boolean)) out.pos = pos;
  if (rot.some(Boolean)) out.rot = rot;
  if (typeof p.bone === 'string' && ALL_BONES.includes(p.bone) && Array.isArray(p.at) && p.at.length === 16 && p.at.every((v) => Number.isFinite(+v))) { out.bone = p.bone; out.at = p.at.map((v) => round(+v, 1e5)); }
  return Object.keys(out).length ? out : null;
}
// a file read or about to be saved: the known players, clips, bones and joints only, numbers in range, nothing kept that
// does nothing. (Version 1's whole-hand numbers meant something else and aren't read.)
export function cleanHands(d) {
  const out = { v: 2, players: {} }, P = d && d.v === 2 && d.players && typeof d.players === 'object' ? d.players : {};
  for (const [who, def] of Object.entries(PLAYERS)) {
    const pl = {};
    for (const clip of def.clips) {
      const c = P[who] && P[who][clip]; if (!c) continue;
      const bones = {}, props = {};
      for (const name of ALL_BONES) { const b = cleanBone(name, c.bones && c.bones[name]); if (Object.keys(b).length) bones[name] = b; }
      for (const name of Object.keys(def.props)) { const p = cleanProp(c.props && c.props[name]); if (p) props[name] = p; }
      const e = {}; if (Object.keys(bones).length) e.bones = bones; if (Object.keys(props).length) e.props = props;
      if (Object.keys(e).length) pl[clip] = e;
    }
    if (Object.keys(pl).length) out.players[who] = pl;
  }
  return out;
}
// the file's text: one line a bone, one line a prop, so it reads and diffs cleanly
export function handsText(d) {
  const c = cleanHands(d), lines = ['{ "v": 2, "players": {'], comma = (i, a) => (i < a.length - 1 ? ',' : '');
  Object.keys(c.players).forEach((w, i, W) => {
    lines.push(`  ${JSON.stringify(w)}: {`);
    Object.keys(c.players[w]).forEach((cl, j, C) => {
      lines.push(`    ${JSON.stringify(cl)}: {`);
      const parts = Object.keys(c.players[w][cl]);
      parts.forEach((part, k) => {
        lines.push(`      ${JSON.stringify(part)}: {`);
        const o = c.players[w][cl][part];
        Object.keys(o).forEach((n, m, N) => lines.push(`        ${JSON.stringify(n)}: ${JSON.stringify(o[n])}${comma(m, N)}`));
        lines.push(`      }${comma(k, parts)}`);
      });
      lines.push(`    }${comma(j, C)}`);
    });
    lines.push(`  }${comma(i, W)}`);
  });
  lines.push('} }');
  return lines.join('\n') + '\n';
}

// ── editing (the lab's buttons, in plain data, so the tests read them too) ─────────────────────────────────────────────
export function setJoint(d, who, clip, bone, joint, value) {
  const pl = d.players[who] || (d.players[who] = {}), c = pl[clip] || (pl[clip] = {}), B = c.bones || (c.bones = {}), b = B[bone] || (B[bone] = {});
  const def = jointsOf(bone).find((j) => j.id === joint); if (!def) return 0;
  const v = num(value, def.min, def.max);
  if (v) b[joint] = v; else delete b[joint];
  if (!Object.keys(b).length) delete B[bone];
  return v;
}
export const getJoint = (d, who, clip, bone, joint) => { const c = d.players[who] && d.players[who][clip]; return (c && c.bones && c.bones[bone] && c.bones[bone][joint]) || 0; };
export function resetBones(d, who, clip, names) { const c = d.players[who] && d.players[who][clip]; if (c && c.bones) for (const n of names) delete c.bones[n]; }
export function resetPlayer(d, who) { delete d.players[who]; }
export function resetAll(d) { d.players = {}; }
// a pose copied to the other side, this clip's arm and hand: the numbers mean the same movement on either side
export function copyPose(d, who, clip, from) {
  const c = d.players[who] && d.players[who][clip]; if (!c || !c.bones) return;
  const to = from === 'L' ? 'R' : 'L', names = [...ARM_BONES(from), ...HAND_BONES(from)];
  for (const n of names) {
    const other = n.slice(0, -1) + to;
    if (c.bones[n]) c.bones[other] = { ...c.bones[n] }; else delete c.bones[other];
  }
}
// this clip's numbers on another clip of the same player
export function copyClip(d, who, from, to) {
  const c = d.players[who] && d.players[who][from]; if (!c) { if (d.players[who]) delete d.players[who][to]; return; }
  d.players[who][to] = JSON.parse(JSON.stringify(c));
}
