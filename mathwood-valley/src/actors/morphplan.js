// MORPH PLAN: the numbers behind reshaping a skinned four-legged animal (src/actors/morph.js does the reshaping, with
// three.js; this file is plain data and arithmetic, so the tests can read it without a browser).
//
// A morph is a handful of sliders (MORPH: each one's range and what it does), turned into, for each bone:
//   F     how much its own stretch of the body grows along three directions of the dog (side, up, forward) or along
//         the bone itself (along / across), and how far its children sit from it (a longer upper leg puts the knee
//         further down, a bigger head carries the ears further out)
//   turn  a bend, in the dog's own directions at rest (an ear folded over, a tail curled up), baked into the clips
// and a few that aren't one bone's: the snout (the front of the head pulled in or out), the eyes (bigger), the size.
//
// RIGS: which bones are which on each skeleton the game has. 'quat': Quaternius' animal pack (the shiba, the husky,
// the wolf: Body, Back, Torso..Torso3, Neck1..3, Head, Ear1..4, FrontShoulder/UpperLeg/LowerLeg, BackShoulder/Leg/
// UpperLeg/LowerLeg, Tail1..3, the paws on IK bones of their own). 'farm': the farm pack (the pug: Body, Back, Hips,
// Torso, Shoulders, Neck, Head, Front/BackLeg, Up/LowLeg, Front/BackFoot; no ear or tail bones: there the ears and the
// tail are shaped from the head's and the rump's corners).
//
//   rigFor(boneNames)            -> the rig whose bones are all there (or null)
//   fillMorph(m)                 -> every slider, in range, defaults where missing
//   planMorph(m, rig)            -> { bones: { name: { F: [[axis, k], ...], turn: [[axis, radians, 'pre'|'post'], ...], move: [[axis, d]],
//                                     follow: a bone whose reshaping carries this one's root (the ears beside the head) } },
//                                     size, snout: { length, width, depth }, eyes, earsMissing }
//   (axis: 'side' | 'up' | 'fwd' (the dog's own, at rest: nose toward +Z, up +Y, its left +X), 'along' (the bone's own
//   length), 'across' (both ways across the bone))

export const MORPH = {
  // [min, max, step, default, label, group]
  size:       [0.5, 1.6, 0.01, 1, 'Size', 'body'],
  legFront:   [0.45, 1.6, 0.01, 1, 'Front legs', 'body'],
  legBack:    [0.45, 1.6, 0.01, 1, 'Back legs', 'body'],
  legThick:   [0.6, 1.8, 0.01, 1, 'Leg thickness', 'body'],
  legSet:     [-0.5, 0.5, 0.01, 0, 'Front legs set back', 'body'],
  body:       [0.6, 1.6, 0.01, 1, 'Body length', 'body'],
  chestDepth: [0.7, 1.6, 0.01, 1, 'Chest depth', 'body'],
  chestWidth: [0.7, 1.7, 0.01, 1, 'Chest width', 'body'],
  girth:      [0.7, 1.6, 0.01, 1, 'Stockiness', 'body'],
  tuck:       [0, 1, 0.01, 0, 'Tucked belly', 'body'],
  neck:       [0.4, 1.7, 0.01, 1, 'Neck length', 'body'],
  neckThick:  [0.7, 1.6, 0.01, 1, 'Neck thickness', 'body'],
  neckTilt:   [-0.8, 1, 0.01, 0, 'Neck forward', 'body'],
  head:       [0.7, 1.6, 0.01, 1, 'Head size', 'head'],
  skull:      [0.75, 1.5, 0.01, 1, 'Skull width', 'head'],
  snout:      [0.2, 1.6, 0.01, 1, 'Snout length', 'head'],
  muzzle:     [0.7, 1.6, 0.01, 1, 'Muzzle width', 'head'],
  jaw:        [0.7, 1.5, 0.01, 1, 'Muzzle depth', 'head'],
  eyes:       [0.7, 1.8, 0.01, 1, 'Eye size', 'head'],
  headTilt:   [-0.8, 0.8, 0.01, 0, 'Nose up', 'head'],
  ears:       [0.4, 2.2, 0.01, 1, 'Ear size', 'ears'],
  earLength:  [0.5, 2.5, 0.01, 1, 'Ear length', 'ears'],
  earWidth:   [0.6, 2, 0.01, 1, 'Ear width', 'ears'],
  earSplay:   [-0.6, 2.6, 0.01, 0, 'Ears out / down', 'ears'],
  earTilt:    [-1, 1.2, 0.01, 0, 'Ears forward', 'ears'],
  earFold:    [0, 2.2, 0.01, 0, 'Ear tips fold', 'ears'],
  tailLength: [0.1, 1.8, 0.01, 1, 'Tail length', 'tail'],
  tailThick:  [0.4, 2.2, 0.01, 1, 'Tail thickness', 'tail'],
  tailCarry:  [-1.4, 1.4, 0.01, 0, 'Tail up / down', 'tail'],
  tailCurl:   [-1, 1.6, 0.01, 0, 'Tail curl', 'tail'],
};
export const MORPH_KEYS = Object.keys(MORPH);
export const MORPH_GROUPS = { body: 'Body', head: 'Head', ears: 'Ears', tail: 'Tail' };
// ear sets: starting points for the ear sliders (a breed may nudge them after)
export const EAR_SETS = {
  asMade:  { label: 'As the model has them', earSplay: 0, earTilt: 0, earFold: 0 },
  pricked: { label: 'Pricked (upright)', earSplay: -0.1, earTilt: 0.05, earFold: 0 },
  bat:     { label: 'Bat (big, upright, set wide)', earSplay: 0.35, earTilt: 0.1, earFold: 0, ears: 1.5, earWidth: 1.35 },
  tipped:  { label: 'Tipped (tips folded forward)', earSplay: 0.15, earTilt: 0.2, earFold: 1.1 },
  rose:    { label: 'Rose (folded back and out)', earSplay: 0.9, earTilt: -0.5, earFold: 0.9 },
  drop:    { label: 'Drop (hanging, floppy)', earSplay: 2.2, earTilt: 0.15, earFold: 0.35 },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export function fillMorph(m = {}) {
  const out = {};
  for (const [k, [lo, hi, , def]] of Object.entries(MORPH)) {
    const v = m[k] === undefined || m[k] === null || m[k] === '' ? def : +m[k];
    out[k] = Number.isFinite(v) ? clamp(v, lo, hi) : def;
  }
  return out;
}

// ── the rigs ──────────────────────────────────────────────────────────────────────────────────────────────────────
// root: the bone that carries the whole body (the feet aside), moved up or down and tipped so the feet (or, sitting
// and lying, the rump and the belly) stay on the ground. legs: each leg's chain from the shoulder or hip down, and the
// bone its paw hangs on (a root of its own in both packs: the clips place the paws in the world, and the leg's chain
// reaches them), with the toe bone under it where there is one.
export const RIGS = {
  quat: {
    id: 'quat', root: 'Body',
    rump: ['Back'], waist: ['Torso'], chest: ['Torso2', 'Torso3'], lengthen: ['Torso', 'Torso2'],
    neck: ['Neck1', 'Neck2', 'Neck3'], head: 'Head',
    // (the ears hang from the last neck bone, beside the head, not from it: they're made to follow the head)
    ears: { L: ['Ear1L', 'Ear2L', 'Ear3L', 'Ear4L'], R: ['Ear1R', 'Ear2R', 'Ear3R', 'Ear4R'] }, earsBesideHead: true,
    tail: ['Tail1', 'Tail2', 'Tail3'],
    legs: {
      FL: { front: true, chain: ['FrontShoulderL', 'FrontUpperLegL', 'FrontLowerLegL'], paw: 'IKFrontLegL', toe: 'FFL' },
      FR: { front: true, chain: ['FrontShoulderR', 'FrontUpperLegR', 'FrontLowerLegR'], paw: 'IKFrontLegR', toe: 'FFR' },
      BL: { front: false, chain: ['BackShoulderL', 'BackLegL', 'BackUpperLegL', 'BackLowerLegL'], paw: 'IKBackLegL', toe: 'FFBL' },
      BR: { front: false, chain: ['BackShoulderR', 'BackLegR', 'BackUpperLegR', 'BackLowerLegR'], paw: 'IKBackLegR', toe: 'FFBR' },
    },
    // (the shoulder and hip bones carry the top of the leg into the body: they thicken with the leg, they don't lengthen)
    legTop: ['FrontShoulderL', 'FrontShoulderR', 'BackShoulderL', 'BackShoulderR', 'BackLegL', 'BackLegR'],
  },
  farm: {
    id: 'farm', root: 'Body',
    rump: ['Back', 'Hips'], waist: ['Torso'], chest: ['Shoulders'], lengthen: ['Body'], lengthenAxis: 'fwd',
    neck: ['Neck'], head: 'Head', ears: null, tail: null,
    legs: {
      FL: { front: true, chain: ['FrontLegL', 'FrontUpLegL', 'FrontLowLegL'], paw: 'FrontFootL' },
      FR: { front: true, chain: ['FrontLegR', 'FrontUpLegR', 'FrontLowLegR'], paw: 'FrontFootR' },
      BL: { front: false, chain: ['BackLegL', 'BackUpLegL', 'BackLowLegL'], paw: 'BackFootL' },
      BR: { front: false, chain: ['BackLegR', 'BackUpLegR', 'BackLowLegR'], paw: 'BackFootR' },
    },
    legTop: ['FrontLegL', 'FrontLegR', 'BackLegL', 'BackLegR'],
  },
};
export function rigFor(names) {
  const has = new Set(names);
  for (const rig of Object.values(RIGS)) {
    const need = [rig.root, rig.head, ...rig.neck, ...rig.chest, ...Object.values(rig.legs).flatMap((l) => [...l.chain, l.paw])];
    if (need.every((n) => has.has(n))) return rig;
  }
  return null;
}
// every bone a rig names, for checking a model against it
export function rigBones(rig) {
  const out = new Set([rig.root, rig.head, ...rig.rump, ...rig.waist, ...rig.chest, ...rig.neck, ...rig.lengthen, ...(rig.legTop || [])]);
  for (const l of Object.values(rig.legs)) { l.chain.forEach((b) => out.add(b)); out.add(l.paw); if (l.toe) out.add(l.toe); }
  if (rig.ears) for (const s of Object.values(rig.ears)) s.forEach((b) => out.add(b));
  if (rig.tail) rig.tail.forEach((b) => out.add(b));
  return [...out];
}

// ── the plan ──────────────────────────────────────────────────────────────────────────────────────────────────────
export function planMorph(m, rig) {
  m = fillMorph(m);
  const bones = {};
  const B = (name) => bones[name] || (bones[name] = { F: [], turn: [], move: [], follow: null });
  // (move: the bone shifted in its parent's space, along a direction of the dog, by a share of its withers height)
  const shift = (name, axis, d) => { if (name && Math.abs(d) > 1e-6) B(name).move.push([axis, d]); };
  const grow = (name, axis, k) => { if (name && Math.abs(k - 1) > 1e-6) B(name).F.push([axis, k]); };
  const bend = (name, axis, a, how = 'post') => { if (name && Math.abs(a) > 1e-6) B(name).turn.push([axis, a, how]); };
  // the body: its length on the torso segments, its girth all along it, the chest's depth and width, the belly tucked
  for (const b of rig.lengthen) grow(b, rig.lengthenAxis || 'along', m.body);
  for (const b of [...rig.rump, ...rig.waist, ...rig.chest]) { grow(b, 'side', m.girth); grow(b, 'up', Math.sqrt(m.girth)); }
  for (const b of rig.chest) { grow(b, 'side', m.chestWidth); grow(b, 'up', m.chestDepth); }
  // the legs: lengthened along the chain (not the shoulder or the hip, which are inside the body), thickened all along
  const tops = new Set(rig.legTop || []);
  for (const leg of Object.values(rig.legs)) {
    const k = leg.front ? m.legFront : m.legBack;
    for (const b of leg.chain) { if (!tops.has(b)) grow(b, 'along', k); grow(b, 'across', m.legThick); }
    grow(leg.paw, 'side', Math.sqrt(m.legThick)); grow(leg.paw, 'fwd', Math.sqrt(m.legThick));
    if (leg.toe) { grow(leg.toe, 'side', Math.sqrt(m.legThick)); grow(leg.toe, 'fwd', Math.sqrt(m.legThick)); }
  }
  // the front legs set further back under the chest (or forward)
  for (const leg of Object.values(rig.legs)) if (leg.front) shift(leg.chain[0], 'fwd', -m.legSet * 0.35);
  // the neck: its length and thickness, segment by segment
  for (const b of rig.neck) { grow(b, 'along', m.neck); grow(b, 'across', m.neckThick); }
  // the neck carried further forward (lower), the head turned to keep the nose where it was, then tipped up or down
  bend(rig.neck[0], 'side', m.neckTilt * 0.6, 'pre');
  bend(rig.head, 'side', -m.neckTilt * 0.6 - m.headTilt * 0.5, 'pre');
  // (ears beside the head: carried where the head's growth and turn take the spot they grow from, and turned with it)
  if (rig.ears && rig.earsBesideHead) for (const chain of Object.values(rig.ears)) { B(chain[0]).follow = rig.head; bend(chain[0], 'side', -m.neckTilt * 0.6 - m.headTilt * 0.5, 'pre'); }
  // the head: its size (the ears ride out with it) and the skull's width
  grow(rig.head, 'side', m.head * m.skull); grow(rig.head, 'up', m.head); grow(rig.head, 'fwd', m.head);
  // the ears: size all over, then longer or wider, then set: out (down, for a drop ear), forward, the tips folded
  const earsMissing = !rig.ears;
  if (rig.ears) {
    for (const [side, chain] of Object.entries(rig.ears)) {
      const s = side === 'L' ? 1 : -1;
      chain.forEach((b, i) => {
        // (the ear's width is across the head, its thickness front to back: that grows only a little)
        grow(b, 'along', m.ears * m.earLength); grow(b, 'side', m.ears * m.earWidth); grow(b, 'fwd', Math.sqrt(m.ears));
        if (i === 0) { bend(b, 'fwd', -s * m.earSplay * 0.55); bend(b, 'side', m.earTilt * 0.6); }
        // (a drop ear hangs from its root: the base turns most, the rest follow a little)
        if (i === 1) { bend(b, 'fwd', -s * m.earSplay * 0.25); bend(b, 'side', m.earFold * 0.35); }
        if (i === 2) bend(b, 'side', m.earFold * 0.75);
        if (i === 3) bend(b, 'side', m.earFold * 0.45);
      });
    }
  }
  // the tail: its length and thickness; carried up or down from the root; curled over along the rest
  const tailMissing = !rig.tail;
  if (rig.tail) {
    rig.tail.forEach((b, i) => {
      const last = i === rig.tail.length - 1;
      if (last) { for (const a of ['side', 'up', 'fwd']) grow(b, a, m.tailLength); grow(b, 'across', m.tailThick); }
      else { grow(b, 'along', m.tailLength); grow(b, 'across', m.tailThick); }
      if (i === 0) bend(b, 'side', m.tailCarry * 0.7);
      else bend(b, 'side', m.tailCurl * 0.55);
    });
  }
  return {
    bones, size: m.size, eyes: m.eyes, tuck: m.tuck, earsMissing, tailMissing,
    snout: { length: m.snout, width: m.muzzle, depth: m.jaw },
    tailStub: rig.tail ? 0 : 1 - Math.min(1, m.tailLength),
  };
}
// a bone's growth as one number per direction (the product of everything asking for that direction)
export function growthOf(entry) {
  const g = { side: 1, up: 1, fwd: 1, along: 1, across: 1 };
  if (entry) for (const [a, k] of entry.F) g[a] *= k;
  return g;
}
