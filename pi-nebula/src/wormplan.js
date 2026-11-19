// THE JUMP, the plain part: what the wormhole does and when. No page and no three.js, so node tests it
// (tests/flying.test.mjs). The picture of it is src/wormhole.js; the run that jumps is src/trip.js.
//
// THE GAME'S MAKER (2026-11-18): "When you leave the area of the station then it gives you the option to jump. So you
// press a button and then you get the jump calculation questions. Hopefully we can have some cool colorful plasma
// effect that looks like it rips open a wormhole in front of you and you see pretty colors until the destination scene
// is loaded and then appears in front of you."
//
// SO A JUMP IS FOUR THINGS, one after another (JUMP: how long each is, seconds):
//   'rip'     a tear opens in front of the ship: first a thin bright crack running out to its full length, then pulled
//             open into a round mouth with the colours inside it;
//   'plunge'  the mouth comes over the ship, faster and faster, until the colours are all round it;
//   'tunnel'  nothing but the colours, streaming by. THE PLACE IS CHANGED HERE, unseen (the moment it begins is the
//             event 'shut'), and the colours go on for as long as the place ahead is not ready: at least JUMP.least;
//   'open'    the far end opens in front of the ship, and through it the place ahead is seen; it widens until the
//             colours are gone behind;
//   'done'.
// Nothing is dark at any moment of it, and nothing is said in words.
//
// THE EDGE (edgeOf): the picture needs only where the edge of the colours is, as seen from the eye. `E` is how far
// round from dead ahead the edge lies, in half turns of the view (0: nothing open; 1: right round behind; it runs on
// past 1 so that a ragged edge is right round too); `slit` how wide the tear is beside its length (1: round); `jag` how
// ragged; `mode` +1: the colours are inside the edge (going in), -1: outside it (coming out), 0: no colours.
//
// EACH JUMP'S OWN LOOK (lookOf): a few numbers drawn afresh for every jump, so no two are quite alike: which colours,
// which way it swirls, how the tear slants. They cost nothing: the picture takes them as plain numbers.
export const JUMP = { rip: 0.9, plunge: 0.65, least: 0.9, open: 1.0, most: 40 };
export const EDGE = { mouth: 0.16, full: 1.5, slit: 0.07, jag: [0.34, 0.09, 0.06] };      // jag: ripping, round, the far end

const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
const ease = (x) => { const k = clamp01(x); return k * k * (3 - 2 * k); };

// a jump's own look: hue (0..1, round the colours), swirl (-1 or 1), slant (the tear's lean from upright, radians), seed
export function lookOf(rand = Math.random) {
  return { hue: rand(), swirl: rand() < 0.5 ? -1 : 1, slant: (rand() - 0.5) * 1.1, seed: rand() * 40 };
}
// J = makeJump(rand): { phase, t (seconds into the phase), clock (seconds in all), shut (the place may be changed), look }
export function makeJump(rand = Math.random) {
  return { phase: 'rip', t: 0, clock: 0, shut: false, look: lookOf(rand) };
}
// one step of `dt` seconds. ready: is the place ahead made? (asked only in the tunnel.) -> what happened in this step,
// in order: 'shut' (the colours are all round: change the place now), 'open' (the far end begins to open), 'done'
export function stepJump(J, dt, ready = true) {
  const out = [];
  if (J.phase === 'done') return out;
  J.t += dt; J.clock += dt;
  if (J.phase === 'rip' && J.t >= JUMP.rip) { J.t -= JUMP.rip; J.phase = 'plunge'; }
  if (J.phase === 'plunge' && J.t >= JUMP.plunge) { J.t -= JUMP.plunge; J.phase = 'tunnel'; J.shut = true; out.push('shut'); }
  // (the place ahead not ready: the colours go on. Never for ever: after JUMP.most it opens whatever is there)
  if (J.phase === 'tunnel' && J.t >= JUMP.least && (ready || J.t >= JUMP.most)) { J.t = 0; J.phase = 'open'; out.push('open'); }
  if (J.phase === 'open' && J.t >= JUMP.open) { J.t = 0; J.phase = 'done'; J.shut = false; out.push('done'); }
  return out;
}
// where the edge of the colours is now: { mode, E, slit, jag }
export function edgeOf(J) {
  const G = EDGE;
  if (J.phase === 'rip') {
    const k = J.t / JUMP.rip;
    // (the crack runs out to its length in the first half; from a third of the way it is pulled open)
    return { mode: 1, E: G.mouth * ease(k / 0.5), slit: G.slit + (1 - G.slit) * ease((k - 0.3) / 0.7), jag: G.jag[0] + (G.jag[1] - G.jag[0]) * ease(k) };
  }
  if (J.phase === 'plunge') { const k = clamp01(J.t / JUMP.plunge); return { mode: 1, E: G.mouth + (G.full - G.mouth) * Math.pow(k, 2.4), slit: 1, jag: G.jag[1] }; }
  if (J.phase === 'tunnel') return { mode: 1, E: G.full, slit: 1, jag: G.jag[1] };
  if (J.phase === 'open') { const k = clamp01(J.t / JUMP.open); return { mode: -1, E: G.full * Math.pow(k, 3.2), slit: 1, jag: G.jag[2] }; }
  return { mode: 0, E: 0, slit: 1, jag: 0 };
}
// the edge's own waviness round it, -1..1 (the picture's shader does this same sum: src/wormhole.js VEIL_GLSL)
export const waveOf = (phi, time = 0, seed = 0) => Math.sin(phi * 3 + time * 2.3 + seed) * 0.5 + Math.sin(phi * 7 - time * 3.1 + seed * 1.7) * 0.3 + Math.sin(phi * 13 + time * 5.3) * 0.2;
// IS A DIRECTION FROM THE EYE COVERED BY THE COLOURS? ahead: the cosine of its angle from dead ahead (the way the
// ship's nose points); phi: its angle round that line, from the ship's right toward its up (radians). The same sum the
// picture does for every dot of it; here so the tests can ask.
export function covered(J, ahead, phi = 0, time = 0) {
  const e = edgeOf(J); if (!e.mode) return false;
  const rho = Math.acos(Math.max(-1, Math.min(1, ahead))) / Math.PI, p = phi - J.look.slant, c = Math.cos(p), s = Math.sin(p);
  const shape = 1 / Math.sqrt(c * c / (e.slit * e.slit) + s * s), inside = e.E * shape * (1 + e.jag * waveOf(p, time, J.look.seed)) - rho;
  return e.mode > 0 ? inside > 0 : inside < 0;
}
