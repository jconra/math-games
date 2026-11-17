// GETTING ON AND OFF A HIGH BED, AS A PERSON DOES IT (the big scanner's bed: its pad is 0.915 m up, higher than a
// standing person's hips, so whoever sits on its edge has their feet off the floor, as on a doctor's high table).
// The game's maker (2026-11-17), watching the scan's end: "This is not how human legs bend" (the legs swung up straight,
// like a doll's). So, getting on: backed up to the bed's side, hands on it behind them, a little hop up onto its edge
// (the feet leave the floor, the legs hang, knees bent); leaning back on the hands, the knees lifted and the legs
// swung round onto the bed, knees and hips bent all the way, while they turn along it; sitting along it with the knees
// up, they lie back, then straighten the legs. Getting off: the same backwards (knees up, sit up, the legs swung back
// over the edge, knees bent), then a slide off the edge onto bent knees, and up.
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
//        flat on what they stand on, or else following the shin), hands [[x,y,z] left, right] (each wrist), arms 0..1,
//        clip 'stand' | 'sit' (the crew kit's clip under it all: the body above the hips), chin (the head brought
//        down, rad), done (the move is over) }
//   twoBone(root, end, pole, a, b) -> { mid, end, reach }   a leg (or an arm): where the knee (elbow) goes so the foot
//        (wrist) reaches `end` from `root`, bent toward `pole`; an end out of reach is reached for (the limb straight)
//
// THE MOVES, with their seconds (people.js plays them in turn):
export const MOVES_ON = [['back', 0.9], ['hop', 1.3], ['swing', 2.1], ['down', 1.7], ['stretch', 1.1]];
export const MOVES_OFF = [['bend', 1.0], ['up', 1.7], ['swingout', 2.1], ['hopdown', 1.3]];
export const SECS = Object.fromEntries([...MOVES_ON, ...MOVES_OFF]);
// (the knees' bend kept all through the swing, at least, degrees: the game's maker's "no straight-leg swing")
export const KNEE_MIN = 45;
// (the moves' small numbers: how far past the bed's edge the knees are, sitting on it (m); their lean back on their
// hands as they swing (rad); the knees' bend once the feet are on the bed (the knee's inside angle, degrees); where the
// hands go on the bed beside and behind the hips (m), and where they are put down for the hop (in from the edge, out
// from the hips); the feet's lift over the bed's edge (m); the foot's root over what it stands on (m); a hanging foot's
// toes pointed down past square to the shin (rad))
export const ON = { knee0: 0.08, lean: 0.36, knee: 70, hand: [0.235, 0.11], hop: [0.16, 0.25], clear: 0.07, foot: 0.013, point: 0.35 };

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
// ahead (`ahead`, level); else (0) following the shin (`shin`, knee to the foot's root), the toes square to it on the
// knee's side (`pole`) and pointed a little (ON.point), as a foot hangs or lies at rest; in between, between the two
export function footWay(shin, pole, ahead2, flat) {
  const s = norm(shin);
  let n = sub(pole, s.map((v) => v * dot(pole, s))); n = len(n) < 1e-6 ? [0, 0, 1] : norm(n);
  const c = Math.cos(ON.point), si = Math.sin(ON.point);
  const toeR = norm(add(n.map((v) => v * c), s, si)), upR = norm(add(s.map((v) => -v * c), n, si));
  const f = norm([ahead2[0], 0, ahead2[2]]);
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
// hanging from the edge: thighs out level, shins straight down (where the sitting clip has them)
const hang = (who) => [who.a, -who.b];
// on the bed with the knees up: the foot's root just on the pad, the knee's inside angle ON.knee
function kneesUp(bed, who, hipsY) {
  const dy = hipsY - (bed.top + ON.foot), g = ON.knee * Math.PI / 180;
  const d = Math.sqrt(who.a * who.a + who.b * who.b - 2 * who.a * who.b * Math.cos(g));
  return [Math.sqrt(Math.max(0.01, d * d - dy * dy)), -dy];
}
// lying with the legs straight along the bed: how far along the feet are (their roots just on the pad)
function straightOut(bed, who, hipsY) {
  const dy = hipsY - (bed.top + 0.045), L = who.a + who.b - 0.012;
  return [Math.sqrt(Math.max(0.01, L * L - dy * dy)), -dy];
}
// the hands flat on the bed beside and a little behind the hips (wrists a few centimetres up), kept on the pad and
// off the head rest's end of the bed
function handsAt(bed, hips, h) {
  const f = ahead(h), l = leftOf(h);
  return [1, -1].map((s) => {
    const p = add(add(hips, l, s * ON.hand[0]), f, -ON.hand[1]);
    return [clamp(p[0], -bed.pad + 0.07, bed.pad - 0.07), bed.top + 0.03, Math.max(p[2], (bed.rest ? bed.rest[1] : 0) + 0.05)];
  });
}

// (the chin brought down as they lean back, so they look ahead to their knees rather than up at the ceiling; lying,
// a little, the head on its rest)
const chinOf = (lean) => track([[0, 0], [0.36, 0.22], [0.8, 0.45], [1.2, 0.35], [Math.PI / 2, 0.1]], lean);

export function pose(move, t, bed, who) {
  const p = poseOf(move, t, bed, who);
  p.chin = (move === 'hop' || move === 'hopdown' ? 0.12 : 0) + (move === 'back' ? 0 : chinOf(p.lean));
  return p;
}
function poseOf(move, t, bed, who) {
  const T = SECS[move] || 1, u = clamp(t / T), done = t >= T;
  const S = standAt(bed, who), E = edgeAt(bed, who), H = Math.PI / 2;
  const sitY = bed.top + bed.hipUp, lieY = bed.top + 0.11, mid = [0, sitY, bed.z];
  const up = kneesUp(bed, who, sitY), upLie = kneesUp(bed, who, lieY);
  const out = { hips: null, heading: 0, lean: 0, feet: null, pole: null, legs: 1, flat: 0, hands: null, arms: 0, clip: 'sit', done };
  const poleOf = (h, f, v) => norm(add(ahead(h).map((x) => x * f), UP, v));

  if (move === 'back') {
    // turned round to put their back to the bed, a step back toward it: standing (the standing clip's legs)
    out.hips = S; out.heading = H; out.legs = 0; out.clip = 'stand'; out.flat = 1;
    out.feet = feetAt(S, H, who.w * 0.95, 0.02, -who.hs + 0.015); out.pole = poleOf(H, 1, 0);
    return out;
  }
  if (move === 'hop' || move === 'hopdown') {
    // ON: hands back on the bed, a small dip, the push up (rising first, clear of the edge, then back onto it), the
    // legs folding to hang. OFF (hopdown): forward to the edge, a drop onto the floor with the knees giving, up again
    const on = move === 'hop';
    const x = on ? track([[0, S[0]], [0.3, S[0] - 0.02], [0.62, bed.edge + 0.07], [0.86, E[0]], [1, E[0]]], u)
      : track([[0, E[0]], [0.3, bed.edge - 0.02], [0.48, bed.edge + 0.11], [0.62, S[0] - 0.01], [1, S[0]]], u);
    const y = on ? track([[0, S[1]], [0.3, S[1] - 0.06], [0.62, sitY + 0.035], [0.86, sitY], [1, sitY]], u)
      : track([[0, sitY], [0.3, sitY + 0.005], [0.48, sitY - 0.035], [0.62, S[1] - 0.075], [0.82, S[1] - 0.02], [1, S[1]]], u);
    out.hips = [x, y, bed.z]; out.heading = H;
    out.lean = on ? track([[0, 0], [0.3, 0.13], [0.62, 0.1], [1, 0.05]], u) : track([[0, 0.05], [0.3, 0.02], [0.55, 0.08], [1, 0]], u);
    // the feet: planted on the floor, then off it (the legs folding up to hang) or down to it (reaching for it)
    const floor = feetAt([S[0], S[1], S[2]], H, who.w * 0.95, 0.02, -who.hs + 0.015);
    const [fa, fu] = hang(who), hung = feetAt(out.hips, H, who.w, fa, fu, 0.01);
    // (hanging, the feet reaching a little down and out as they come off the edge)
    const reach = feetAt(out.hips, H, who.w, fa * 0.75 + 0.12, -(who.a + who.b) * 0.9, 0.01);
    let k;
    if (on) { k = ease(seg(u, 0.4, 0.84)); out.feet = floor.map((p, i) => mix(p, hung[i], k)); }
    else {
      const k1 = ease(seg(u, 0.12, 0.42)), k2 = ease(seg(u, 0.4, 0.56));
      out.feet = hung.map((p, i) => mix(mix(p, reach[i], k1), floor[i], k2));
    }
    out.flat = on ? 1 - ease(seg(u, 0.4, 0.7)) : ease(seg(u, 0.44, 0.56));
    out.pole = poleOf(H, 1, 0.15);
    // (the hands put down on the bed near its edge, either side, to push up from; once up and back on it, beside and a
    // little behind the hips, as they will be for the swing)
    const planted = [1, -1].map((s) => [bed.edge - ON.hop[0], bed.top + 0.03, bed.z - s * ON.hop[1]]);
    const after = handsAt(bed, [E[0], sitY, bed.z], H);
    const kh = on ? ease(seg(u, 0.62, 1)) : 1 - ease(seg(u, 0, 0.3));
    out.hands = planted.map((p, i) => mix(p, after[i], kh));
    out.arms = on ? ease(seg(u, 0.02, 0.3)) : 1 - ease(seg(u, 0.42, 0.7));
    out.clip = on ? (u < 0.42 ? 'stand' : 'sit') : (u < 0.42 ? 'sit' : 'stand');
    return out;
  }
  if (move === 'swing' || move === 'swingout') {
    // the turn along the bed (ON: from facing out to facing its foot), leaning back on the hands; the knees lifted, the
    // feet raised out past the edge, then over it and onto the bed: the knees bent all the way round
    const v = move === 'swing' ? u : 1 - u;
    const h = H * (1 - ease(seg(v, 0.14, 0.9)));
    const hips = [mix(E[0], 0, ease(seg(v, 0.1, 0.9))), sitY, bed.z];
    const [ha, hu] = hang(who);
    const F = track([[0, ha], [0.26, who.a + 0.1], [0.46, who.a + 0.02], [0.72, 0.5], [1, up[0]]], v);
    const U = track([[0, hu], [0.26, -0.2], [0.46, ON.clear - 0.05], [0.72, ON.clear - 0.06], [1, up[1]]], v);
    out.hips = hips; out.heading = h; out.lean = track([[0, 0.05], [0.32, ON.lean], [0.66, ON.lean], [1, 0.12]], v);
    out.feet = feetAt(hips, h, who.w, F, U, 0.01);
    out.pole = poleOf(h, 1, track([[0, 0.15], [0.3, 0.8], [1, 1.2]], v));
    out.flat = ease(seg(v, 0.82, 1));
    out.hands = handsAt(bed, hips, h); out.arms = 1;
    return out;
  }
  if (move === 'down' || move === 'up') {
    // lying back from sitting along the bed, the feet staying on it, knees up (or sitting up again)
    const v = move === 'down' ? u : 1 - u, k = ease(v);
    out.hips = [0, mix(sitY, lieY, k), bed.z]; out.heading = 0; out.lean = mix(0.12, Math.PI / 2, k);
    const F = mix(up[0], upLie[0], k), U = mix(up[1], upLie[1], k);
    out.feet = feetAt(out.hips, 0, who.w, F, U, 0.01); out.flat = 1;
    out.pole = poleOf(0, 1, 1.2);
    out.hands = handsAt(bed, out.hips, 0); out.arms = 1 - ease(seg(v, 0.25, 0.75));
    out.clip = v < 0.5 ? 'sit' : 'stand';
    return out;
  }
  if (move === 'stretch' || move === 'bend' || move === 'lying') {
    // the legs straightened along the bed, the feet sliding out (or drawn up again, knees up)
    const v = move === 'lying' ? 1 : move === 'stretch' ? u : 1 - u, k = ease(v);
    out.hips = [0, lieY, bed.z]; out.heading = 0; out.lean = Math.PI / 2;
    const st = straightOut(bed, who, lieY);
    out.feet = feetAt(out.hips, 0, who.w, mix(upLie[0], st[0], k), mix(upLie[1], st[1], k), 0.01);
    out.flat = 1 - ease(seg(v, 0.3, 0.9)); out.pole = poleOf(0, 0.6, 1);
    out.arms = 0; out.clip = 'stand';
    return out;
  }
  throw new Error('onbed: no move ' + move);
}
