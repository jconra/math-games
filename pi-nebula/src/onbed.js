// GETTING ON AND OFF A HIGH BED, AS A PERSON DOES IT (the big scanner's bed: its pad is 0.915 m up, higher than a
// standing person's hips, so whoever sits on its edge has their feet off the floor, as on a doctor's high table).
// The game's maker (2026-11-17), watching the scan's end: "This is not how human legs bend" (the legs swung up straight,
// like a doll's). So, getting on: backed up to the bed's side, hands on it beside them, a dip and a hop up and back onto
// its edge (up onto the toes, the feet leaving the floor pointed, the legs folding at once to hang), a shuffle back;
// leaning back on the hands, the legs lifted, knees at about a right angle, and carried round just over the pad while
// they turn along it, the heels set down and slid out; they lie back, the hands staying down till the shoulders are
// down, then straighten the legs, the feet falling outward. Getting off: the same backwards, then a shuffle to the edge,
// the chest forward, a slide off: the legs reach down, the toes touch first, the heels, the knees give, the hands come
// off the bed as the weight lands, and up.
//
// Plain numbers (nothing of three.js, so it is tested in Node: tests/onbed.test.mjs). Everything is in the bed's own
// frame: x across it (+x the side the patient gets on from), y up, z along it (its head end, the wall, at 0).
//
//   import { MOVES_ON, MOVES_OFF, pose, twoBone } from './onbed.js'
//   pose(move, t, bed, who)  where the person is `t` seconds into one of the moves:
//     bed  { top (the pad's top, m), edge (the board's edge, x), pad (the pad's half width), z (where the hips are once
//          on it), stand (where they stand at its side, [x, z]), hipUp (the hip joints over the seat, sitting) }
//     who  { a (thigh, hip to knee), b (shin, knee to the foot's root), w (half the hips' width), hs (the hip joints'
//          height standing) }: the person's own, measured from their bones
//   -> { hips [x,y,z] (the middle of the two hip joints), heading (the way they face: 0 along +z, pi/2 along +x), lean
//        (leaning back, radians: pi/2 lying on the back), feet [[x,y,z] left, right] (each foot's root), pole [x,y,z]
//        (the way the knees bend toward), legs 0..1 (how much these legs are worn over the clip's), flat 0..1 (the feet
//        flat on what they stand on, or else following the shin), pitch (flat feet's toes tipped down, rad: up on the
//        toes), point (the toes pointed past square to the shin, rad), roll (the feet turned outward, rad), hands
//        [[x,y,z] left, right] (each wrist), fingers and elbows [[x,y,z], [x,y,z]] (the ways each hand's fingers and each
//        elbow point), arms 0..1, clip 'stand' | 'sit' (the crew kit's clip under it all: the body above the hips),
//        chin (the head brought down, rad), curl (the upper back rounded forward, rad), armsLR (each arm's own share,
//        when they differ), look ([x,y,z] to glance at, or none), done (the move is over) }
//   twoBone(root, end, pole, a, b) -> { mid, end, reach }   a leg (or an arm): where the knee (elbow) goes so the foot
//        (wrist) reaches `end` from `root`, bent toward `pole`; an end out of reach is reached for (the limb straight)
//
// (A second pair of fresh eyes, 2026-11-16, on the first flowing version: the hop went straight up, legs locked and feet
// flat a hand's width off the floor, then slid sideways onto the bed; the turn lifted the feet 13 cm off the pad with the
// knees up at the chest; sitting up straight between the turn and lying back; the hands off the bed with the back still
// 20 degrees up; the feet stiffly upright lying. Each is answered below, in its move. A third: the back straight as a lid
// on a hinge lying back and sitting up, the head tipped back lying, the feet in a wide V: the upper back now rounds
// through the middle of both, the chin is in lying flat, the feet fall out less. A fourth: stop and start (sitting
// still on the edge, then knees up, between the moves), the hop bolt upright, getting off the same as getting on
// backwards (the legs held out past the edge and lowered last), an elbow hanging beside the bed: the moves now run
// into each other (perched on the edge after the hop, the slide to the bed's middle is part of the turn; one lean back
// through the turn and down), the chest comes forward in the dip and the slide off, the legs are let down as they
// clear the edge, the elbows lie level on the pad.)
//
// THE MOVES, with their seconds (people.js plays them in turn):
export const MOVES_ON = [['back', 0.9], ['hop', 1.25], ['swing', 2.1], ['down', 1.8], ['stretch', 1.1]];
export const MOVES_OFF = [['bend', 1.0], ['up', 1.8], ['swingout', 2.1], ['hopdown', 1.15]];
export const SECS = Object.fromEntries([...MOVES_ON, ...MOVES_OFF]);
// (the knees' bend kept all through the swing, at least, degrees: the game's maker's "no straight-leg swing")
export const KNEE_MIN = 45;
// (the moves' small numbers: how far in from the bed's edge the hip joints are, perched on it after the hop and before
// the slide off (m); their lean back on their hands as they swing (rad); the knees' bend once the feet are on the bed and as the legs
// come round (the knee's inside angle, degrees: about a right angle, as the fresh eyes asked); where the hands go on the
// bed beside and behind the hips (m), and where they are put down for the hop (in from the edge, out from the hips);
// the feet's lift over the pad as they come round (m); the foot's root over what it stands on (m); a hanging foot's toes
// pointed down past square to the shin, and pointed as they leave the floor or reach for it (rad); up on the toes, how
// far the heels lift (m); lying, the feet turned outward and pointed (rad); lying back or sitting up, the upper back
// rounded forward at most (rad, through the middle of the move); getting off, the part of the turn (0 at its end) over
// which the legs are let down; in the turn, when each hand (left, right) is lifted and put down again, twice)
export const ON = { perch: 0.13, lean: 0.36, knee: 90, hand: [0.235, 0.11], hop: [0.06, 0.24], clear: 0.05, foot: 0.013, point: 0.22, tip: 0.55, heel: 0.06, relax: [0.28, 0.34], curl: 0.5,
  drop: [0.12, 0.46], steps: [[[0.3, 0.42], [0.7, 0.82]], [[0.16, 0.28], [0.56, 0.68]]] };

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const seg = (u, a, b) => clamp((u - a) / (b - a));
const add = (p, q, k = 1) => [p[0] + q[0] * k, p[1] + q[1] * k, p[2] + q[2] * k];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const len = (p) => Math.hypot(p[0], p[1], p[2]);
const norm = (p) => { const l = len(p) || 1; return [p[0] / l, p[1] / l, p[2] / l]; };
const mix = (p, q, k) => (Array.isArray(p) ? p.map((v, i) => v + (q[i] - v) * k) : p + (q - p) * k);

// a smooth track through keys [[u, value], ...] (value a number or an array): a curve through each key, still at the
// first and the last (cubic Hermite, each key's slope the one through its neighbours)
export function track(keys, u) {
  if (u <= keys[0][0]) return keys[0][1];
  const n = keys.length; if (u >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0; while (i < n - 2 && u > keys[i + 1][0]) i++;
  const [t0, p0] = keys[i], [t1, p1] = keys[i + 1], h = t1 - t0, s = (u - t0) / h;
  const slope = (j) => { if (j <= 0 || j >= n - 1) return null; const [ta, pa] = keys[j - 1], [tb, pb] = keys[j + 1]; return Array.isArray(pa) ? pa.map((v, k) => (pb[k] - v) / (tb - ta)) : (pb - pa) / (tb - ta); };
  const m0 = slope(i), m1 = slope(i + 1);
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
  const one = (a, b, ma, mb) => h00 * a + h10 * h * (ma ?? 0) + h01 * b + h11 * h * (mb ?? 0);
  return Array.isArray(p0) ? p0.map((v, k) => one(v, p1[k], m0 && m0[k], m1 && m1[k])) : one(p0, p1, m0, m1);
}
// (the same, eased from key to key, still at each: for a value held a while, which a track would carry past its keys)
const steps = (keys, u) => {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 0; i + 1 < keys.length; i++) if (u <= keys[i + 1][0]) return mix(keys[i][1], keys[i + 1][1], ease(seg(u, keys[i][0], keys[i + 1][0])));
  return keys[keys.length - 1][1];
};

// TWO BONES: the middle joint for an end to reach (law of cosines), bent toward the pole
export function twoBone(root, end, pole, a, b) {
  let d = sub(end, root), L = len(d);
  const most = a + b - 1e-4, least = Math.abs(a - b) + 1e-4;
  const reach = L <= most;
  if (L < 1e-6) { d = [0, -1, 0]; L = 1e-6; }
  const u = [d[0] / L, d[1] / L, d[2] / L];
  const Lc = clamp(L, least, most);
  // (the pole made square to the line: the way the joint goes out from it)
  let n = sub(pole, u.map((v) => v * dot(pole, u)));
  if (len(n) < 1e-6) n = Math.abs(u[1]) < 0.9 ? sub([0, 1, 0], u.map((v) => v * u[1])) : sub([0, 0, 1], u.map((v) => v * u[2]));
  n = norm(n);
  const ca = clamp((a * a + Lc * Lc - b * b) / (2 * a * Lc), -1, 1), sa = Math.sqrt(1 - ca * ca);
  const mid = add(root, add(u.map((v) => v * ca), n.map((v) => v * sa)), a);
  return { mid, end: add(root, u, Lc), reach };
}
// (the inside angle at a middle joint, degrees: 180 straight)
export const inside = (root, mid, end) => { const p = norm(sub(root, mid)), q = norm(sub(end, mid)); return Math.acos(clamp(dot(p, q), -1, 1)) * 180 / Math.PI; };
// A FOOT'S WAY: { toe (heel to toes), up (from the sole up into the foot) }, unit. Flat (1): on what it stands on, toes
// ahead (`ahead`, level, or tipped down by `pitch`: up on the toes); else (0) following the shin (`shin`, knee to the
// foot's root), the toes square to it on the knee's side (`pole`) and pointed (`point`), as a foot hangs or lies at
// rest, turned outward (toward `out`) by `roll`; in between, between the two
export function footWay(shin, pole, ahead2, flat, { point = ON.point, pitch = 0, out = null, roll = 0 } = {}) {
  const s = norm(shin);
  let n = sub(pole, s.map((v) => v * dot(pole, s))); n = len(n) < 1e-6 ? [0, 0, 1] : norm(n);
  if (out && roll) {
    let o = sub(out, s.map((v) => v * dot(out, s))); o = sub(o, n.map((v) => v * dot(o, n)));
    if (len(o) > 1e-6) n = norm(add(n.map((v) => v * Math.cos(roll)), norm(o), Math.sin(roll)));
  }
  const c = Math.cos(point), si = Math.sin(point);
  const toeR = norm(add(n.map((v) => v * c), s, si)), upR = norm(add(s.map((v) => -v * c), n, si));
  const f0 = norm([ahead2[0], 0, ahead2[2]]), f = [f0[0] * Math.cos(pitch), -Math.sin(pitch), f0[2] * Math.cos(pitch)];
  let toe = norm(mix(toeR, f, flat)), up = mix(upR, UP, flat);
  up = norm(sub(up, toe.map((v) => v * dot(up, toe))));
  return { toe, up };
}

// the person's own ways, by heading: ahead, and to their left (their right is minus it); up is the world's
const ahead = (h) => [Math.sin(h), 0, Math.cos(h)];
const leftOf = (h) => [Math.cos(h), 0, -Math.sin(h)];
const UP = [0, 1, 0];

// where the hip joints' middle is, standing at the bed's side
const standAt = (bed, who) => [bed.stand[0], who.hs, bed.stand[1]];
// where they glance as they back up to the bed: its edge beside them, where a hand is about to go
const glanceAt = (bed) => [bed.edge - 0.05, bed.top, bed.z - 0.6];
// the feet: (ahead, up) from each hip joint in the yawed frame, as a foot target in the bed's frame
function feetAt(hips, h, w, F, U, splay = 0) {
  const f = ahead(h), l = leftOf(h);
  return [1, -1].map((s) => add(add(add(hips, l, s * w), f, F), UP, U).map((v, i) => v + l[i] * s * splay));
}
// standing at the bed's side, their back to it: where the feet are on the floor
const floorFeet = (S, who) => feetAt(S, Math.PI / 2, who.w * 0.95, 0.02, -who.hs + 0.015);
// hanging from the edge: thighs out level, shins straight down (where the sitting clip has them)
const hang = (who) => [who.a, -who.b];
// the leg's reach with the knee's inside angle at `deg` (law of cosines)
const reachAt = (who, deg) => Math.sqrt(who.a * who.a + who.b * who.b - 2 * who.a * who.b * Math.cos(deg * Math.PI / 180));
// on the bed with the knees up: the foot's root just on the pad, the knee's inside angle ON.knee
function kneesUp(bed, who, hipsY) {
  const dy = hipsY - (bed.top + ON.foot), d = reachAt(who, ON.knee);
  return [Math.sqrt(Math.max(0.01, d * d - dy * dy)), -dy];
}
// lying with the legs straight along the bed: how far along the feet are (their roots just on the pad)
function straightOut(bed, who, hipsY) {
  const dy = hipsY - (bed.top + 0.045), L = who.a + who.b - 0.012;
  return [Math.sqrt(Math.max(0.01, L * L - dy * dy)), -dy];
}
// the hands flat on the bed beside and a little behind the hips (wrists a few centimetres up), kept on the pad and
// off the head rest's end of the bed; the fingers ahead and a little out; the elbows behind and out
function handsAt(bed, hips, h) {
  const f = ahead(h), l = leftOf(h);
  return [1, -1].map((s) => {
    const p = add(add(hips, l, s * ON.hand[0]), f, -ON.hand[1]);
    return [clamp(p[0], -bed.pad + 0.07, bed.pad - 0.07), bed.top + 0.03, Math.max(p[2], (bed.rest ? bed.rest[1] : 0) + 0.05)];
  });
}
// the hands put down on the bed's edge either side, to push from (the hop up, the slide off)
const pushAt = (bed) => [1, -1].map((s) => [bed.edge - ON.hop[0], bed.top + 0.03, bed.z - s * ON.hop[1]]);
const fingersAt = (h) => [1, -1].map((s) => norm(add(ahead(h), leftOf(h), s * 0.3)));
const elbowsAt = (h, out = 0.7) => [1, -1].map((s) => norm(add(add(ahead(h).map((v) => -v), leftOf(h), s * out), UP, -0.25)));
// lowering onto the back, the elbows bending down and out to the bed's sides; nearly flat, out and level, so an elbow
// lies on the pad or at its edge (pointed down, it hung below the pad beside the bed with the hand still on top)
const lowerElbows = (lean) => { const y = mix(-0.55, 0.12, ease(seg(lean, 1.1, 1.5))); return [1, -1].map((s) => norm([s * 0.85, y, 0.05])); };
// lying for the scan: the hands resting on the belly, the fingers in toward each other, the elbows out at the sides on
// the bed (a narrow scanner's bed has no room for arms beside the body; and it is how a patient lies for a scan)
const BELLY = { x: [0.07, -0.06], up: 0.12, z: [0.18, 0.25] };
const bellyAt = (bed, lieY) => [0, 1].map((i) => [BELLY.x[i], lieY + BELLY.up, bed.z - BELLY.z[i]]);
const bellyFingers = () => [[-1, 0, -0.25], [1, 0, -0.25]].map(norm);
const bellyElbows = () => [[1, -0.15, 0.25], [-1, -0.15, 0.25]].map(norm);

// (the chin brought toward the chest as they lean back, the head held up off the bed, looking toward their knees,
// until the very end, when it comes down onto its rest last; sitting up, the head leads, chin in. A first version kept
// it with the chest, and lying back the head seemed thrown back: the fresh eyes' first point)
// (lying flat, the chin still a little in: the face straight up, not tipped back toward the ring)
const chinOf = (lean) => track([[0, 0], [0.36, 0.26], [0.8, 0.58], [1.2, 0.78], [1.42, 0.62], [Math.PI / 2, 0.4]], lean);

export function pose(move, t, bed, who) {
  const p = poseOf(move, t, bed, who), u = clamp(t / (SECS[move] || 1));
  // (hopping up or sliding off, the head down a little more, watching the floor; none at either end of the move)
  const watch = move === 'hop' ? ease(seg(u, 0, 0.2)) * (1 - ease(seg(u, 0.75, 1))) : move === 'hopdown' ? ease(seg(u, 0, 0.25)) * (1 - ease(seg(u, 0.7, 1))) : 0;
  // (lying back, the head is held up, chin in, until the back is down, and comes down last; sitting up, it leads: the
  // chin in before the back comes off the bed)
  const vv = move === 'down' ? u : move === 'up' ? 1 - u : -1;
  const head = vv >= 0 ? 0.3 * ease(seg(vv, 0.45, 0.7)) * (1 - ease(seg(vv, 0.86, 0.98))) : 0;
  p.chin = 0.14 * watch + head + (move === 'back' ? 0 : chinOf(p.lean));
  return p;
}
function poseOf(move, t, bed, who) {
  const T = SECS[move] || 1, u = clamp(t / T), done = t >= T;
  const S = standAt(bed, who), H = Math.PI / 2, PX = bed.edge - ON.perch;
  const sitY = bed.top + bed.hipUp, lieY = bed.top + 0.11;
  // THE LEAN BACK through the turn and on down onto the back: one curve, in seconds from the turn's start, so the back
  // is already going down as the legs finish coming round and, played backwards, the legs start round while the back
  // is still coming up (they sat still, knees up, for most of a second between the two). Getting off, the back comes
  // upright sooner at the turn's end, as the legs are let down. L0: the lean perched on the edge; LJ: where the two
  // moves join.
  const Ts = SECS.swing, Td = SECS.down, L0 = 0.05, LJ = 0.52;
  const backLean = (s, on) => track([[0, L0], ...(on ? [[0.22 * Ts, ON.lean]] : [[0.12 * Ts, 0.07], [0.46 * Ts, ON.lean]]), [0.62 * Ts, ON.lean + 0.02], [Ts, LJ],
    [Ts + 0.45 * Td, 1.12], [Ts + 0.78 * Td, 1.5], [Ts + 0.9 * Td, Math.PI / 2]], s);
  const up = kneesUp(bed, who, sitY), upLie = kneesUp(bed, who, lieY);
  const out = { hips: null, heading: 0, lean: 0, feet: null, pole: null, legs: 1, flat: 0, pitch: 0, point: ON.point, roll: 0, hands: null, fingers: null, elbows: null, arms: 0, armsLR: null, look: null, clip: 'sit', done };
  const poleOf = (h, f, v) => norm(add(ahead(h).map((x) => x * f), UP, v));
  // (up on the toes: the heels lifted `r`, the toes still on the floor, the foot tipped down to them)
  const onToes = (r) => Math.asin(clamp(r / 0.2, 0, 0.9));

  if (move === 'back') {
    // turned round where they stand, their back to the bed: standing (the standing clip's legs)
    out.hips = S; out.heading = H; out.legs = 0; out.clip = 'stand'; out.flat = 1;
    out.feet = floorFeet(S, who); out.pole = poleOf(H, 1, 0);
    out.look = glanceAt(bed);      // (a look round at the bed as they turn their back to it)
    return out;
  }
  if (move === 'hop') {
    // a glance round at the bed as the hands go back to its edge, one a moment before the other; a dip, the chest coming
    // forward as the hips go back (as sitting back onto a chair); one push of legs and arms together, up onto the toes,
    // and off: the hips going up and back in one curve over the edge (they must clear the pad's edge first), at one
    // steady speed backward through the air (a first version went slowly, then 11 cm in a tenth of a second, then
    // slowly: it read as a cut), the knees folding the moment the toes leave the floor (never hanging straight); the
    // seat down on the edge, a little give: perched there, the hands walked back behind the hips. (They slid on back to
    // the bed's middle here once, sitting still: now that is part of the turn.)
    const x = track([[0, S[0]], [0.24, S[0] - 0.035], [0.47, bed.edge + 0.14], [0.55, bed.edge + 0.09], [0.64, bed.edge + 0.025], [0.73, bed.edge - 0.04], [0.82, bed.edge - 0.095], [0.92, PX + 0.004], [1, PX]], u);
    const y = track([[0, S[1]], [0.24, S[1] - 0.09], [0.47, S[1] + 0.065], [0.55, sitY + 0.012], [0.64, sitY + 0.04], [0.73, sitY + 0.028], [0.82, sitY + 0.006], [0.92, sitY - 0.004], [1, sitY]], u);
    out.hips = [x, y, bed.z]; out.heading = H;
    out.lean = track([[0, 0], [0.24, -0.2], [0.47, -0.06], [0.64, 0.08], [0.82, 0.12], [1, L0]], u);
    // (the heels up as the push ends; off the floor from 0.47, the feet carried from where they left it to hanging
    // under the knees, quickly at first)
    const r = ON.heel * ease(seg(u, 0.33, 0.47)), floor = floorFeet(S, who).map((p) => add(p, UP, r));
    const [fa, fu] = hang(who), hung = feetAt(out.hips, H, who.w, fa, fu, 0.03);
    const fs = seg(u, 0.47, 0.78), fold = 1 - (1 - fs) * (1 - fs);
    out.feet = floor.map((p, i) => mix(p, hung[i], fold));
    out.flat = 1 - ease(seg(u, 0.47, 0.58)); out.pitch = onToes(r);
    out.point = steps([[0.47, onToes(ON.heel)], [0.58, ON.tip], [0.95, ON.point]], u);
    out.pole = poleOf(H, 1, 0.15);
    // (the hands near the bed's edge, beside the hips, the elbows bent ready to push and straight at the top of it; once
    // landed, lifted and put down again behind the hips, one then the other, as they will be for the turn)
    const push = pushAt(bed), after = handsAt(bed, [PX, sitY, bed.z], H);
    out.hands = push.map((p, i) => { const s = seg(u, i ? 0.8 : 0.7, i ? 0.98 : 0.88); return add(mix(p, after[i], ease(s)), UP, 0.02 * Math.sin(Math.PI * s)); });
    out.fingers = fingersAt(H); out.elbows = elbowsAt(H, 0.3);
    out.armsLR = [ease(seg(u, 0, 0.2)), ease(seg(u, 0.07, 0.27))]; out.arms = Math.max(out.armsLR[0], out.armsLR[1]);
    out.look = u < 0.2 ? glanceAt(bed) : null;
    out.clip = u < 0.47 ? 'stand' : 'sit';
    return out;
  }
  if (move === 'hopdown') {
    // perched on the edge: the chest well forward over the knees, a push on the hands and a slide off: the legs reach
    // down, the toes pointed, and touch first, then the heels, the knees giving as the weight lands; the hands let go
    // of the bed as the seat leaves it, the arms the standing clip's again by the landing; and up
    const x = track([[0, PX], [0.14, PX + 0.02], [0.32, bed.edge + 0.08], [0.42, bed.edge + 0.15], [0.56, S[0] - 0.01], [1, S[0]]], u);
    const y = track([[0, sitY], [0.14, sitY + 0.004], [0.32, sitY - 0.005], [0.42, S[1] + 0.055], [0.56, S[1] - 0.06], [0.82, S[1] - 0.01], [1, S[1]]], u);
    out.hips = [x, y, bed.z]; out.heading = H;
    out.lean = track([[0, L0], [0.14, -0.12], [0.32, -0.3], [0.5, -0.34], [0.8, -0.1], [1, 0]], u);
    // (touching at 0.42 up on the toes, the heels down by 0.56)
    const r = ON.heel * (1 - ease(seg(u, 0.42, 0.56))), floor = floorFeet(S, who).map((p) => add(p, UP, r));
    const [fa, fu] = hang(who), hung = feetAt(out.hips, H, who.w, fa, fu, 0.03);
    out.feet = hung.map((p, i) => mix(p, floor[i], ease(seg(u, 0.12, 0.42))));
    out.flat = ease(seg(u, 0.37, 0.44)); out.pitch = onToes(r);
    // (pointed as they reach; back to the toes' own tip as they touch, so the toes meet the floor and go no further)
    out.point = steps([[0.08, ON.point], [0.28, ON.tip], [0.39, onToes(ON.heel)]], u);
    out.pole = poleOf(H, 1, 0.15);
    out.hands = handsAt(bed, [PX, sitY, bed.z], H); out.fingers = fingersAt(H); out.elbows = elbowsAt(H, 0.3);
    out.arms = 1 - ease(seg(u, 0.12, 0.34));     // (let go as the chest tips forward: held longer, the arms were dragged out straight behind)
    out.clip = u < 0.36 ? 'sit' : 'stand';
    return out;
  }
  if (move === 'swing' || move === 'swingout') {
    // the turn along the bed (ON: from facing out, perched on its edge, to facing its foot) and the legs coming round
    // onto it in one move: leaning back on the hands, the legs lifted, knees at about a right angle, the feet just over
    // the pad's height while they come round (the leg nearer the bed's foot a little ahead), the seat sliding in to the
    // bed's middle as they turn (a little lighter on it, on the hands); the feet set down as the turn ends and slid out,
    // the back already going down (backLean: no sitting still, knees up, between this and lying back). The knees and
    // hips bent all the way round.
    const on = move === 'swing', v = on ? u : 1 - u;
    const headAt = (q) => H * (1 - ease(seg(q, 0.05, 0.85))), slideAt = (q) => ease(seg(q, 0.08, 0.9));
    const hipsAt = (q) => [mix(PX, 0, slideAt(q)), sitY, bed.z];
    const h = headAt(v), hips = add(hipsAt(v), UP, 0.012 * Math.sin(Math.PI * seg(v, 0.1, 0.85)));
    const [ha, hu] = hang(who), lift = bed.top + ON.clear + ON.foot - sitY, d = reachAt(who, ON.knee);
    const FL = Math.sqrt(Math.max(0.01, d * d - lift * lift));
    // (getting on, the legs are lifted first, then carried round; getting off, they are let down as soon as the feet
    // are out past the bed's edge, while still turning: not held out at the pad's height and lowered last)
    const low = on ? 0.3 : ON.drop[1], lo0 = on ? 0 : ON.drop[0];
    const FK = [[0, ha], [lo0, ha], [low, FL], [0.68, FL], [0.8, up[0] - 0.06], [1, up[0]]];
    const UK = [[0, hu], [lo0, hu], [low, lift], [0.68, lift], [0.8, up[1]], [1, up[1]]];
    // (their right leg is the one nearer the bed's foot as they turn to it: a little ahead; the left a little behind)
    const legAt = (s, w) => { const f = ahead(h), l = leftOf(h); return add(add(add(hips, l, s * (who.w + mix(0.03, -0.015, v))), f, steps(FK, w)), UP, steps(UK, w)); };
    out.hips = hips; out.heading = h; out.lean = backLean(v * Ts, on);
    const lead = Math.sin(Math.PI * v);
    out.feet = [legAt(1, clamp(v - 0.04 * lead)), legAt(-1, clamp(v + 0.05 * lead))];
    out.pole = poleOf(h, 1, track([[0, 0.15], [0.3, 0.8], [1, 1.2]], v));
    out.flat = ease(seg(v, 0.7, 0.82));
    // (the hands stay put on the bed, never slid: each is lifted and put down again twice as the body turns and slides
    // in between them, the one on the bed's foot side first, out of the way of the legs)
    const each = [0, 1].map((i) => {
      const [w1, w2] = ON.steps[i], s1 = seg(v, w1[0], w1[1]), s2 = seg(v, w2[0], w2[1]), q = 0.5 * ease(s1) + 0.5 * ease(s2);
      return { p: add(handsAt(bed, hipsAt(q), headAt(q))[i], UP, 0.025 * (Math.sin(Math.PI * s1) + Math.sin(Math.PI * s2))), f: fingersAt(headAt(q))[i] };
    });
    out.hands = each.map((e) => e.p); out.fingers = each.map((e) => e.f); out.elbows = elbowsAt(h); out.arms = 1;
    return out;
  }
  if (move === 'down' || move === 'up') {
    // lying back from sitting along the bed (the back already on its way down from the turn: one lean, backLean), the
    // feet staying on it, knees up; the hands staying down on the bed, the elbows bending down and out and coming level
    // on the pad as the shoulders reach it, the hands sliding toward the feet; on the belly only once flat (or sitting
    // up again: the hands down on the bed first, while still lying, to push up from)
    const v = move === 'down' ? u : 1 - u;
    out.lean = backLean(Ts + v * Td, true);
    const k = clamp((out.lean - LJ) / (Math.PI / 2 - LJ));
    out.hips = [0, mix(sitY, lieY, k), bed.z]; out.heading = 0;
    const F = mix(up[0], upLie[0], k), U = mix(up[1], upLie[1], k);
    out.feet = feetAt(out.hips, 0, who.w, F, U, -0.015); out.flat = 1;
    out.pole = poleOf(0, 1, 1.2);
    const kb = ease(seg(v, 0.82, 1)), slide = 0.15 * ease(seg(out.lean, 0.9, 1.5)), belly = bellyAt(bed, lieY);
    const down = handsAt(bed, out.hips, 0).map((p) => add(p, [0, 0, 1], slide));
    out.hands = down.map((p, i) => mix(p, belly[i], kb)); out.arms = 1;
    const e = ease(seg(out.lean, 0.5, 1.1)), lowered = elbowsAt(0).map((q, i) => norm(mix(q, lowerElbows(out.lean)[i], e)));
    out.fingers = fingersAt(0).map((f, i) => norm(mix(f, bellyFingers()[i], kb))); out.elbows = lowered.map((q, i) => norm(mix(q, bellyElbows()[i], kb)));
    out.clip = v < 0.5 ? 'sit' : 'stand';
    // (the upper back rounded through the middle of it, chin in, as a person lowers or lifts themselves: never a board)
    out.curl = ON.curl * Math.sin(Math.PI * k);
    return out;
  }
  if (move === 'stretch' || move === 'bend' || move === 'lying') {
    // the legs straightened along the bed, the feet sliding out and falling outward at rest (or drawn up again, knees up)
    const v = move === 'lying' ? 1 : move === 'stretch' ? u : 1 - u, k = ease(v), rest = ease(seg(v, 0.55, 1));
    out.hips = [0, lieY, bed.z]; out.heading = 0; out.lean = Math.PI / 2;
    const st = straightOut(bed, who, lieY);
    out.feet = feetAt(out.hips, 0, who.w, mix(upLie[0], st[0], k), mix(upLie[1], st[1], k), mix(-0.015, -0.035, k));
    out.flat = 1 - ease(seg(v, 0.3, 0.9)); out.pole = poleOf(0, 0.6, 1);
    out.roll = ON.relax[0] * rest; out.point = mix(ON.point, ON.relax[1], rest);
    out.hands = bellyAt(bed, lieY); out.fingers = bellyFingers(); out.elbows = bellyElbows(); out.arms = 1; out.clip = 'stand';
    return out;
  }
  throw new Error('onbed: no move ' + move);
}
