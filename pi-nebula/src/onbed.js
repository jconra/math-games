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
//        chin (the head brought down, rad), done (the move is over) }
//   twoBone(root, end, pole, a, b) -> { mid, end, reach }   a leg (or an arm): where the knee (elbow) goes so the foot
//        (wrist) reaches `end` from `root`, bent toward `pole`; an end out of reach is reached for (the limb straight)
//
// (A second pair of fresh eyes, 2026-11-16, on the first flowing version: the hop went straight up, legs locked and feet
// flat a hand's width off the floor, then slid sideways onto the bed; the turn lifted the feet 13 cm off the pad with the
// knees up at the chest; sitting up straight between the turn and lying back; the hands off the bed with the back still
// 20 degrees up; the feet stiffly upright lying. Each is answered below, in its move.)
//
// THE MOVES, with their seconds (people.js plays them in turn):
export const MOVES_ON = [['back', 0.9], ['hop', 1.4], ['swing', 2.1], ['down', 1.8], ['stretch', 1.1]];
export const MOVES_OFF = [['bend', 1.0], ['up', 1.8], ['swingout', 2.1], ['hopdown', 1.4]];
export const SECS = Object.fromEntries([...MOVES_ON, ...MOVES_OFF]);
// (the knees' bend kept all through the swing, at least, degrees: the game's maker's "no straight-leg swing")
export const KNEE_MIN = 45;
// (the moves' small numbers: how far past the bed's edge the knees are, sitting on it (m); their lean back on their
// hands as they swing and as they start to lie back (rad); the knees' bend once the feet are on the bed and as the legs
// come round (the knee's inside angle, degrees: about a right angle, as the fresh eyes asked); where the hands go on the
// bed beside and behind the hips (m), and where they are put down for the hop (in from the edge, out from the hips);
// the feet's lift over the pad as they come round (m); the foot's root over what it stands on (m); a hanging foot's toes
// pointed down past square to the shin, and pointed as they leave the floor or reach for it (rad); up on the toes, how
// far the heels lift (m); lying, the feet turned outward and pointed (rad))
export const ON = { knee0: 0.105, lean: 0.36, knee: 90, hand: [0.235, 0.11], hop: [0.06, 0.24], clear: 0.05, foot: 0.013, point: 0.22, tip: 0.55, heel: 0.06, relax: [0.5, 0.38] };

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

// where the hip joints' middle is, standing at the bed's side, and seated on its edge (facing out, +x)
const standAt = (bed, who) => [bed.stand[0], who.hs, bed.stand[1]];
const edgeAt = (bed, who) => [bed.edge + ON.knee0 - who.a, bed.top + bed.hipUp, bed.z];
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
// lowering onto the back, the elbows bending down and out to the bed's sides
const lowerElbows = () => [1, -1].map((s) => norm([s * 0.8, -0.6, 0.05]));
// lying for the scan: the hands resting on the belly, the fingers in toward each other, the elbows out at the sides on
// the bed (a narrow scanner's bed has no room for arms beside the body; and it is how a patient lies for a scan)
const BELLY = { x: [0.07, -0.06], up: 0.12, z: [0.18, 0.25] };
const bellyAt = (bed, lieY) => [0, 1].map((i) => [BELLY.x[i], lieY + BELLY.up, bed.z - BELLY.z[i]]);
const bellyFingers = () => [[-1, 0, -0.25], [1, 0, -0.25]].map(norm);
const bellyElbows = () => [[1, -0.45, 0.25], [-1, -0.45, 0.25]].map(norm);

// (the chin brought toward the chest as they lean back, the head held up off the bed, looking toward their knees,
// until the very end, when it comes down onto its rest last; sitting up, the head leads, chin in. A first version kept
// it with the chest, and lying back the head seemed thrown back: the fresh eyes' first point)
const chinOf = (lean) => track([[0, 0], [0.36, 0.26], [0.8, 0.58], [1.2, 0.78], [1.42, 0.62], [Math.PI / 2, 0.12]], lean);

export function pose(move, t, bed, who) {
  const p = poseOf(move, t, bed, who), u = clamp(t / (SECS[move] || 1));
  // (hopping up or sliding off, the head down a little more, watching the floor; none at either end of the move)
  const watch = move === 'hop' ? ease(seg(u, 0, 0.2)) * (1 - ease(seg(u, 0.75, 1))) : move === 'hopdown' ? ease(seg(u, 0, 0.25)) * (1 - ease(seg(u, 0.7, 1))) : 0;
  p.chin = 0.14 * watch + (move === 'back' ? 0 : chinOf(p.lean));
  return p;
}
function poseOf(move, t, bed, who) {
  const T = SECS[move] || 1, u = clamp(t / T), done = t >= T;
  const S = standAt(bed, who), E = edgeAt(bed, who), H = Math.PI / 2;
  const sitY = bed.top + bed.hipUp, lieY = bed.top + 0.11;
  const up = kneesUp(bed, who, sitY), upLie = kneesUp(bed, who, lieY);
  const out = { hips: null, heading: 0, lean: 0, feet: null, pole: null, legs: 1, flat: 0, pitch: 0, point: ON.point, roll: 0, hands: null, fingers: null, elbows: null, arms: 0, clip: 'sit', done };
  const poleOf = (h, f, v) => norm(add(ahead(h).map((x) => x * f), UP, v));
  // (up on the toes: the heels lifted `r`, the toes still on the floor, the foot tipped down to them)
  const onToes = (r) => Math.asin(clamp(r / 0.2, 0, 0.9));

  if (move === 'back') {
    // turned round where they stand, their back to the bed: standing (the standing clip's legs)
    out.hips = S; out.heading = H; out.legs = 0; out.clip = 'stand'; out.flat = 1;
    out.feet = floorFeet(S, who); out.pole = poleOf(H, 1, 0);
    return out;
  }
  if (move === 'hop') {
    // the hands put down on the edge beside them; a dip, the knees bending; one push of legs and arms together, up onto
    // the toes, and off: the hips going up and back in one curve over the edge (they must clear the pad's edge first),
    // the feet leaving the floor pointed and folding under at once (never hanging straight), landing on the edge, a
    // little give, and a shuffle back on the hands to sit
    const x = track([[0, S[0]], [0.22, S[0] - 0.035], [0.44, bed.edge + 0.14], [0.5, bed.edge + 0.1], [0.57, bed.edge - 0.01], [0.68, bed.edge - 0.12], [0.78, bed.edge - 0.15], [1, E[0]]], u);
    const y = track([[0, S[1]], [0.22, S[1] - 0.06], [0.44, S[1] + 0.065], [0.5, sitY + 0.005], [0.57, sitY + 0.035], [0.68, sitY + 0.01], [0.78, sitY - 0.003], [0.9, sitY + 0.004], [1, sitY]], u);
    out.hips = [x, y, bed.z]; out.heading = H;
    out.lean = track([[0, 0], [0.22, 0.03], [0.44, 0.06], [0.57, 0.14], [0.7, 0.12], [1, 0.05]], u);
    // (the heels up as the push starts; off the floor from 0.44, the feet carried from where they left it to hanging
    // under the knees: half way, the knees bent well past a right angle's half)
    const r = ON.heel * ease(seg(u, 0.3, 0.44)), floor = floorFeet(S, who).map((p) => add(p, UP, r));
    const [fa, fu] = hang(who), hung = feetAt(out.hips, H, who.w, fa, fu, 0.03);
    const fold = ease(seg(u, 0.44, 0.66));
    out.feet = floor.map((p, i) => mix(p, hung[i], fold));
    out.flat = 1 - ease(seg(u, 0.44, 0.54)); out.pitch = onToes(r);
    out.point = steps([[0.44, onToes(ON.heel)], [0.54, ON.tip], [0.86, ON.point]], u);
    out.pole = poleOf(H, 1, 0.15);
    // (the hands near the bed's edge, beside the hips, the elbows bent ready to push and straight at the top of it; once
    // landed, walked back beside and a little behind the hips, as they will be for the swing)
    const after = handsAt(bed, [E[0], sitY, bed.z], H);
    out.hands = pushAt(bed).map((p, i) => mix(p, after[i], ease(seg(u, 0.72, 1)))); out.fingers = fingersAt(H); out.elbows = elbowsAt(H, 0.3);
    out.arms = ease(seg(u, 0, 0.2));
    out.clip = u < 0.44 ? 'stand' : 'sit';
    return out;
  }
  if (move === 'hopdown') {
    // a shuffle forward to the edge on the hands, the chest forward over the knees; a slide off: the legs reach down,
    // the toes pointed, and touch first, then the heels, the knees giving as the weight lands, the hands coming off the
    // bed as it does; and up
    const x = track([[0, E[0]], [0.3, bed.edge - 0.1], [0.42, bed.edge + 0.08], [0.5, bed.edge + 0.15], [0.62, S[0] - 0.01], [1, S[0]]], u);
    const y = track([[0, sitY], [0.15, sitY + 0.006], [0.3, sitY + 0.004], [0.42, sitY - 0.005], [0.5, S[1] + 0.055], [0.62, S[1] - 0.05], [0.84, S[1] - 0.01], [1, S[1]]], u);
    out.hips = [x, y, bed.z]; out.heading = H;
    out.lean = track([[0, 0.05], [0.3, 0], [0.45, -0.14], [0.62, -0.2], [0.84, -0.06], [1, 0]], u);
    // (touching at 0.5 up on the toes, the heels down by 0.62)
    const r = ON.heel * (1 - ease(seg(u, 0.5, 0.62))), floor = floorFeet(S, who).map((p) => add(p, UP, r));
    const [fa, fu] = hang(who), hung = feetAt(out.hips, H, who.w, fa, fu, 0.03);
    out.feet = hung.map((p, i) => mix(p, floor[i], ease(seg(u, 0.24, 0.5))));
    out.flat = ease(seg(u, 0.46, 0.52)); out.pitch = onToes(r);
    // (pointed as they reach; back to the toes' own tip as they touch, so the toes meet the floor and go no further)
    out.point = steps([[0.2, ON.point], [0.38, ON.tip], [0.47, onToes(ON.heel)]], u);
    out.pole = poleOf(H, 1, 0.15);
    const before = handsAt(bed, [E[0], sitY, bed.z], H);
    out.hands = before.map((p, i) => mix(p, pushAt(bed)[i], ease(seg(u, 0, 0.3)))); out.fingers = fingersAt(H); out.elbows = elbowsAt(H, 0.3);
    out.arms = 1 - ease(seg(u, 0.46, 0.62));
    out.clip = u < 0.45 ? 'sit' : 'stand';
    return out;
  }
  if (move === 'swing' || move === 'swingout') {
    // the turn along the bed (ON: from facing out to facing its foot) and the legs coming round onto it in one move:
    // leaning back on the hands, the legs lifted, knees at about a right angle, the feet just over the pad's height
    // while they come round (the leg nearer the bed's foot a little ahead), set down on it as the turn ends and slid
    // out; the knees and hips bent all the way round
    const v = move === 'swing' ? u : 1 - u;
    const h = H * (1 - ease(seg(v, 0.05, 0.85)));
    const hips = [mix(E[0], 0, ease(seg(v, 0.1, 0.9))), sitY, bed.z];
    const [ha, hu] = hang(who), lift = bed.top + ON.clear + ON.foot - sitY, d = reachAt(who, ON.knee);
    const FL = Math.sqrt(Math.max(0.01, d * d - lift * lift));
    const FK = [[0, ha], [0.3, FL], [0.68, FL], [0.8, up[0] - 0.06], [1, up[0]]];
    const UK = [[0, hu], [0.3, lift], [0.68, lift], [0.8, up[1]], [1, up[1]]];
    // (their right leg is the one nearer the bed's foot as they turn to it: a little ahead; the left a little behind)
    const legAt = (s, w) => { const f = ahead(h), l = leftOf(h); return add(add(add(hips, l, s * (who.w + mix(0.03, 0.01, v))), f, steps(FK, w)), UP, steps(UK, w)); };
    out.hips = hips; out.heading = h; out.lean = track([[0, 0.05], [0.22, ON.lean], [1, ON.lean]], v);
    const lead = Math.sin(Math.PI * v);
    out.feet = [legAt(1, clamp(v - 0.04 * lead)), legAt(-1, clamp(v + 0.05 * lead))];
    out.pole = poleOf(h, 1, track([[0, 0.15], [0.3, 0.8], [1, 1.2]], v));
    out.flat = ease(seg(v, 0.7, 0.82));
    out.hands = handsAt(bed, hips, h); out.fingers = fingersAt(h); out.elbows = elbowsAt(h); out.arms = 1;
    return out;
  }
  if (move === 'down' || move === 'up') {
    // lying back from sitting along the bed (going on from the swing's lean back on the hands: no sitting up straight
    // between), the feet staying on it, knees up; the hands staying down on the bed, the elbows bending down and out,
    // the hands sliding toward the feet as the shoulders come down; on the belly only once flat (or sitting up again:
    // the hands down on the bed first, while still lying, to push up from)
    const v = move === 'down' ? u : 1 - u;
    out.lean = track([[0, ON.lean], [0.5, 1.15], [0.8, 1.52], [0.9, Math.PI / 2]], v);
    const k = clamp((out.lean - ON.lean) / (Math.PI / 2 - ON.lean));
    out.hips = [0, mix(sitY, lieY, k), bed.z]; out.heading = 0;
    const F = mix(up[0], upLie[0], k), U = mix(up[1], upLie[1], k);
    out.feet = feetAt(out.hips, 0, who.w, F, U, 0.01); out.flat = 1;
    out.pole = poleOf(0, 1, 1.2);
    const kb = ease(seg(v, 0.88, 1)), slide = 0.15 * ease(seg(out.lean, 0.9, 1.5)), belly = bellyAt(bed, lieY);
    const down = handsAt(bed, out.hips, 0).map((p) => add(p, [0, 0, 1], slide));
    out.hands = down.map((p, i) => mix(p, belly[i], kb)); out.arms = 1;
    const e = ease(seg(out.lean, 0.5, 1.1)), lowered = elbowsAt(0).map((q, i) => norm(mix(q, lowerElbows()[i], e)));
    out.fingers = fingersAt(0).map((f, i) => norm(mix(f, bellyFingers()[i], kb))); out.elbows = lowered.map((q, i) => norm(mix(q, bellyElbows()[i], kb)));
    out.clip = v < 0.5 ? 'sit' : 'stand';
    return out;
  }
  if (move === 'stretch' || move === 'bend' || move === 'lying') {
    // the legs straightened along the bed, the feet sliding out and falling outward at rest (or drawn up again, knees up)
    const v = move === 'lying' ? 1 : move === 'stretch' ? u : 1 - u, k = ease(v), rest = ease(seg(v, 0.55, 1));
    out.hips = [0, lieY, bed.z]; out.heading = 0; out.lean = Math.PI / 2;
    const st = straightOut(bed, who, lieY);
    out.feet = feetAt(out.hips, 0, who.w, mix(upLie[0], st[0], k), mix(upLie[1], st[1], k), 0.01);
    out.flat = 1 - ease(seg(v, 0.3, 0.9)); out.pole = poleOf(0, 0.6, 1);
    out.roll = ON.relax[0] * rest; out.point = mix(ON.point, ON.relax[1], rest);
    out.hands = bellyAt(bed, lieY); out.fingers = bellyFingers(); out.elbows = bellyElbows(); out.arms = 1; out.clip = 'stand';
    return out;
  }
  throw new Error('onbed: no move ' + move);
}
