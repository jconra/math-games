// THE ELECTRIC PICTURE: the music drawn as electricity, a light effect for each part, by one fragment shader. The game's
// maker, 2026-11-25: "Can you do a visual that uses shader effects of some canvas equivalent? Im looking for something
// new like the plasma effects and lightning arcs for the reactor. Can you try to do some kind of eletric effect for each
// instrument? Like laser harp for melody, some background flashes for the beat, but with cool effects, like hexagon
// outlines." The look is the ship reactor's glowing core's (kit/shipparts/cabin/livecore.js: plasma in streams of
// ridged noise, bolts as kinked lines with a white-hot middle and a soft glow); the code here is the music's own.
//
// The five effects, each in its part's colour (src/music/visuals.js PART_COLOURS), all in one picture:
//   beat    a field of hexagon outlines behind everything, lit by the drums, each its own way: the kick a soft ring
//           of light running out from the middle (and the whole field lifted a little, softly); the snare and the
//           clap a small cluster of hexagons filling with light, a new place each hit; the hats a single small
//           hexagon flicking (an open hat a little longer); the toms a column of hexagons, further right the lower
//           the tom; the riser a line of light climbing the field through its length
//   bass    tongues of plasma rising from the floor of the picture, low notes on the left, high on the right; a note
//           flares as it starts, stays up while it holds, sinks when it ends; taller the louder
//   pads    slow streams of plasma flowing across the picture, one a note of the chord, higher the higher the note;
//           each sweeps in from the left as its note starts and fades when it ends
//   lead    a ball of plasma in the middle throwing lightning bolts out to a ring round it: a bolt a note, its way
//           round the ring the note (low at the lower left, over the top, high at the lower right), lit for the note's
//           length, thicker the louder, flickering as lightning does
//   melody  a laser harp: a fan of faint beams rising from below the picture, one a note (low on the left; every C a
//           little brighter); a beam fires as its note starts (a flash running up it), stays lit for the note's length
//           and trembles like a plucked string, brighter the louder
// Comfort (children watch this for a long time): nothing big goes between dark and bright quickly. The kick's lift of
// the whole field is small and soft; the fast drums (hats, snare rolls) light small things only; the pads' streams,
// the biggest shapes, come and go over a few tenths of a second.
//
//   electricMaterial(THREE, o?)   a three.js ShaderMaterial of the picture, for any flat panel with uvs (0..1 across
//                                 it): the lab's screen draws it on a quad, a wall screen in the game can wear it on
//                                 its own panel. o.aspect (its width / height, 46/25), o.px (a pixel, as a share of
//                                 its height: 1/278). Its uniforms' values are electricState()'s arrays.
//   electricState(o?) -> U        the uniforms' values: plain numbers and small Float32Arrays (no three in it)
//   electricUniforms(f, U, o?)    puts a tap frame (src/music/tap.js T.frame()) into U: each part's notes now (those
//                                 sounding, and just ended, newest first) as a few slots of four numbers each
//                                 [place + seed, age (s since it started), length (s), loudness]; o.time: the
//                                 picture's own clock (s) for the flowing; o.aspect, o.px as above
//   SLOTS                         how many notes of each part the picture shows at once
//   pictureMaterial(THREE, fragment, name, o?)   a material of any fragment shader made of the pieces below, its
//                                 uniforms reading electricState()'s arrays (the Hex picture, src/music/hex.js, is one)
//   FRAG_HEAD, FRAG_OPEN, FRAG_BEAT, FRAG_MEL, FRAG_END   the shared pieces: the uniforms and small sums, main's start,
//                                 the beat's hexagon field, the melody's laser harp, main's end (stopped, the frame).
//                                 Electric is these with its own pads, bass and lead between, exactly as first made.
// Every loop in the shader has a fixed small count (SLOTS); nothing is read back. A slot's loudness 0 is empty.
import { PART_IDS } from './song.js';
import { PART_COLOURS, RANGES } from './visuals.js';

export const SLOTS = { beat: 12, bass: 4, pads: 8, lead: 6, melody: 8 };
const UNI = { beat: 'uDrum', bass: 'uBass', pads: 'uPad', lead: 'uLead', melody: 'uMel' };
// the drums, by kind (the shader's numbers); how long each stays in the picture after it starts (s)
export const DRUM_KIND = { kick: 0, snare: 1, clap: 1, hat: 2, open: 3, tom: 4, riser: 5 };
const DRUM_TAIL = [0.9, 0.45, 0.2, 0.45, 0.5, 0.5];
// how long a pitched note stays in the picture after it ends (s): its light dying away
const TAIL = { bass: 0.35, pads: 0.6, lead: 0.15, melody: 0.3 };

const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
// a steady number 0..0.97 for a note, so its bolt and its place in the hexagons stay the same through its life
function seedOf(n) { const x = Math.sin((n.bar * 16 + n.step) * 12.9898 + (n.midi ?? 7) * 78.233) * 43758.5453; return (x - Math.floor(x)) * 0.97; }
export function placeOf(n) {
  if (n.part === 'beat') return DRUM_KIND[n.sound] ?? 1;
  const [lo, hi] = RANGES[n.part], m = n.midi == null ? (lo + hi) / 2 : n.midi;
  return Math.max(0, Math.min(hi - lo, Math.round(m - lo)));
}

export function electricState({ aspect = 46 / 25, px = 1 / 278 } = {}) {
  const U = { uTime: 0, uPlay: 0, uAspect: aspect, uPx: px, uOn: new Float32Array(5), uCol: new Float32Array(15) };
  PART_IDS.forEach((p, i) => { U[UNI[p]] = new Float32Array(SLOTS[p] * 4); U.uCol.set(hexRGB(PART_COLOURS[p]), i * 3); });
  for (const p of PART_IDS) for (let k = 0; k < SLOTS[p]; k++) U[UNI[p]][k * 4 + 1] = 99;
  return U;
}

const order = (a, b) => b.at - a.at;
export function electricUniforms(f, U, { time, aspect, px } = {}) {
  if (time != null) U.uTime = time;
  if (aspect != null) U.uAspect = aspect;
  if (px != null) U.uPx = px;
  U.uPlay = f.playing ? 1 : 0;
  PART_IDS.forEach((p, i) => { U.uOn[i] = f.song && f.song[p] && f.song[p] !== 'off' ? 1 : 0; });
  const by = {};
  for (const p of PART_IDS) by[p] = [];
  if (f.playing) for (const n of f.notes) {
    const age = f.now - n.at;
    if (age < 0) continue;
    const tail = n.part === 'beat' ? (n.sound === 'riser' ? n.dur : 0) + DRUM_TAIL[DRUM_KIND[n.sound] ?? 1] : n.dur + TAIL[n.part];
    if (age < tail && by[n.part]) by[n.part].push(n);
  }
  for (const p of PART_IDS) {
    const a = U[UNI[p]], list = by[p].sort(order), N = SLOTS[p];
    for (let k = 0; k < N; k++) {
      const n = list[k];
      if (!n) { a[k * 4] = 0; a[k * 4 + 1] = 99; a[k * 4 + 2] = 0; a[k * 4 + 3] = 0; continue; }
      a[k * 4] = placeOf(n) + seedOf(n); a[k * 4 + 1] = f.now - n.at; a[k * 4 + 2] = n.dur; a[k * 4 + 3] = Math.max(0.05, Math.min(1, n.vel));
    }
  }
  return U;
}

// ── the shader ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Picture space: p.x 0..aspect across, p.y 0..1 up (the panel's uv scaled). All sizes are shares of the height.
const VERT = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;

const span = (p) => (RANGES[p][1] - RANGES[p][0]).toFixed(1);
// the shader's start: its uniforms and the small sums every picture uses (the hexagons among them)
export const FRAG_HEAD = `precision highp float;
uniform float uTime, uPlay, uAspect, uPx;
uniform float uOn[5];
uniform vec3 uCol[5];
uniform vec4 uDrum[${SLOTS.beat}];
uniform vec4 uBass[${SLOTS.bass}];
uniform vec4 uPad[${SLOTS.pads}];
uniform vec4 uLead[${SLOTS.lead}];
uniform vec4 uMel[${SLOTS.melody}];
varying vec2 vUv;
const float SPAN_BASS = ${span('bass')}, SPAN_PADS = ${span('pads')}, SPAN_LEAD = ${span('lead')}, SPAN_MEL = ${span('melody')}, C_MEL = ${((12 - RANGES.melody[0] % 12) % 12).toFixed(1)};
const float HEX = 0.085;            // a hexagon's size (centre to side, about)
float sq( float x ) { return x * x; }
// (a smooth step that may run either way: from a to b, a above b too)
float ss( float a, float b, float x ) { float k = clamp( ( x - a ) / ( b - a ), 0.0, 1.0 ); return k * k * ( 3.0 - 2.0 * k ); }
float h21( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float vnoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( h21( i ), h21( i + vec2( 1.0, 0.0 ) ), f.x ), mix( h21( i + vec2( 0.0, 1.0 ) ), h21( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
// how near p is to the stretch from a to b
float seg( vec2 p, vec2 a, vec2 b ) { vec2 pa = p - a, ba = b - a; float h = clamp( dot( pa, ba ) / max( dot( ba, ba ), 1e-6 ), 0.0, 1.0 ); return length( pa - ba * h ); }
// a note's light: 0 before it, 1 while it sounds, dying away after
float held( float age, float dur, float fade ) { return age < 0.0 ? 0.0 : age < dur ? 1.0 : exp( -( age - dur ) * fade ); }
// the hexagon p is in: xy its middle, zw p from the middle (in hexagon units: a side's middle at 0.5)
vec4 hexOf( vec2 p ) {
  vec2 s = vec2( 1.0, 1.7320508 ), q = p / HEX;
  vec4 c = floor( vec4( q, q - vec2( 0.5, 1.0 ) ) / s.xyxy ) + 0.5;
  vec4 h = vec4( q - c.xy * s, q - ( c.zw + 0.5 ) * s );
  return dot( h.xy, h.xy ) < dot( h.zw, h.zw ) ? vec4( c.xy * s * HEX, h.xy ) : vec4( ( c.zw + 0.5 ) * s * HEX, h.zw );
}
float hexEdge( vec2 h ) { h = abs( h ); return max( dot( h, vec2( 0.5, 0.8660254 ) ), h.x ); }
`;
// main's start: picture space, the dark, each part's colours
export const FRAG_OPEN = `void main() {
  float A = uAspect, t = uTime, px = max( uPx, 1e-4 );
  vec2 p = vec2( vUv.x * A, vUv.y ), mid = vec2( A * 0.5, 0.5 );
  vec3 col = vec3( 0.012, 0.018, 0.03 );
  // (each part's colour, and a deeper one for its body of light: the reactor's two colours, a body and a hot core)
  vec3 cBeat = uCol[0], cBass = uCol[1], cPad = uCol[2], cLead = uCol[3], cMel = uCol[4];
  vec3 dBeat = cBeat * cBeat, dBass = cBass * cBass, dPad = cPad * cPad * cPad, dLead = cLead * cLead, dMel = cMel * cMel;

`;
// the beat: the hexagon field, lit by the drums (Electric and Hex both)
export const FRAG_BEAT = `  // ── BEAT: the hexagon field ──
  vec4 hx = hexOf( p - mid );
  vec2 hc = hx.xy + mid;                             // this hexagon's middle, in picture space
  float he = hexEdge( hx.zw ), lw = 0.035 + px / HEX * 0.9;
  float line = ss( 0.5 - lw * 2.0, 0.5 - lw * 0.4, he ) * ss( 0.52, 0.5, he );
  float fill = ss( 0.5, 0.2, he );
  float cid = h21( floor( hc * 97.0 ) + 0.5 );       // a steady number for this hexagon
  // (at rest the field is barely there: a faint patch of it here and there, drifting slowly)
  float drift = ss( 0.45, 0.85, vnoise( hc * 2.2 + vec2( t * 0.05, -t * 0.03 ) ) );
  float outl = ( 0.012 + 0.05 * drift ) * ( 0.4 + 0.6 * uOn[0] ), inner = 0.0, white = 0.0;
  for ( int i = 0; i < ${SLOTS.beat}; i++ ) {
    vec4 d = uDrum[i]; if ( d.w <= 0.0 ) continue;
    float kind = floor( d.x ), sd = fract( d.x ), age = d.y, v = d.w;
    if ( kind < 0.5 ) {
      // the kick: a ring running out from the middle, and the whole field lifted a little, softly
      float r = length( hc - mid ), front = age * 1.25;
      float ring = exp( -sq( ( r - front ) / 0.08 ) ) * exp( -age * 2.0 );
      outl += v * ( 1.0 * ring + 0.06 * exp( -age * 3.0 ) );
      inner += v * 0.12 * ring;
    } else if ( kind < 1.5 ) {
      // snare or clap: a small cluster filling with light at its own place
      vec2 at = vec2( 0.15 + ( A - 0.3 ) * sd, 0.18 + 0.64 * fract( sd * 7.31 ) );
      float k = ss( HEX * ( 1.2 + 1.4 * v ), HEX * 0.6, length( hc - at ) ) * exp( -age * 9.0 );
      inner += v * 1.1 * k; outl += v * 1.6 * k;
    } else if ( kind < 3.5 ) {
      // a hat (2) or an open hat (3): one small hexagon flicking
      vec2 at = vec2( 0.06 + ( A - 0.12 ) * sd, 0.08 + 0.84 * fract( sd * 13.7 ) );
      float k = step( length( hc - at ), HEX * 1.05 ) * exp( -age * ( kind < 2.5 ? 16.0 : 7.0 ) );
      outl += v * 2.6 * k; inner += v * ( kind < 2.5 ? 0.5 : 0.9 ) * k;
    } else if ( kind < 4.5 ) {
      // a tom: a column of hexagons, across by its place (the lower the tom, the further right)
      float x = 0.3 + ( A - 0.6 ) * fract( sd * 3.7 );
      float k = ss( HEX * 1.3, HEX * 0.7, abs( hc.x - x ) ) * ss( 0.95, 0.6, abs( hc.y - 0.5 ) * 2.0 ) * exp( -age * 6.0 );
      outl += v * 2.2 * k; inner += v * 0.35 * k;
    } else {
      // the riser: a line of light climbing the field through its length
      float front = clamp( age / max( d.z, 0.1 ), 0.0, 1.2 ), done = d.z > 0.0 && age > d.z ? exp( -( age - d.z ) * 6.0 ) : 1.0;
      float k = exp( -sq( ( hc.y - front ) / 0.06 ) ) * done, below = step( hc.y, front ) * 0.25 * done;
      outl += v * ( 1.8 * k + below ); inner += v * 0.15 * k;
    }
  }
  // (the hexagons' own slow shimmer, so the field is alive between the drums)
  outl *= 0.8 + 0.4 * vnoise( hc * 6.0 + vec2( t * 0.3, cid * 9.0 ) );
  // (a lit outline glows a little into its hexagon, as a hot wire does)
  float halo = exp( -sq( ( 0.5 - he ) / 0.07 ) ) * ss( 0.53, 0.5, he );
  col += mix( dBeat, cBeat, 0.5 ) * ( line * min( outl, 2.5 ) * 0.6 + halo * max( outl - 0.08, 0.0 ) * 0.25 + fill * min( inner, 1.5 ) * 0.22 );
  white += line * max( outl - 0.7, 0.0 ) * 0.22;      // (a well-lit outline goes white-hot along its middle)

`;
// Electric's pads: streams of plasma
export const FRAG_PADS = `  // ── PADS: slow streams of plasma across the picture ──
  for ( int i = 0; i < ${SLOTS.pads}; i++ ) {
    vec4 d = uPad[i]; if ( d.w <= 0.0 ) continue;
    float idx = floor( d.x ), sd = fract( d.x ), age = d.y, v = d.w;
    float y = 0.3 + 0.6 * idx / SPAN_PADS + 0.025 * sin( p.x * 3.1 + t * 0.6 + sd * 20.0 );
    float swept = ss( age * 6.0 * A, age * 6.0 * A - 0.4, p.x ), life = held( age, d.z, 2.5 ) * ss( 0.0, 0.18, age );
    float band = exp( -sq( ( p.y - y ) / 0.026 ) );
    if ( band < 0.01 ) continue;
    // (streams as the reactor's are: long thin ridges of the noise, flowing along, the gaps left dark)
    float n = vnoise( vec2( p.x * 3.0 - t * 0.9 + sd * 31.0, ( p.y - y ) * 30.0 + sd * 5.0 ) ), n2 = vnoise( vec2( p.x * 9.0 - t * 2.0, ( p.y - y ) * 55.0 + 3.0 ) );
    float ridge = ss( 0.45, 0.8, n ); ridge *= ridge;
    float a = band * life * swept * v * ( 0.12 + 2.2 * ridge * ( 0.4 + n2 ) );
    col += dPad * a * 1.35 + cPad * ridge * band * life * swept * v * 0.2; white += a * a * 0.04;
  }

`;
// Electric's bass: tongues of plasma
export const FRAG_BASS = `  // ── BASS: tongues of plasma rising from the floor ──
  // (the brightest tongue at each place, not their sum: a note played again over its own dying light does not jump)
  float floorGlow = 0.0, bassA = 0.0;
  for ( int i = 0; i < ${SLOTS.bass}; i++ ) {
    vec4 d = uBass[i]; if ( d.w <= 0.0 ) continue;
    float idx = floor( d.x ), sd = fract( d.x ), age = d.y, v = d.w;
    float x = 0.16 + ( A - 0.32 ) * idx / SPAN_BASS, life = held( age, d.z, 2.5 ), flare = exp( -age * 7.0 ) * min( 1.0, d.z / 0.3 );
    // (the flare is small: a rolling bass plays sixteenths, and a patch of the picture must not blink that fast)
    float tall = ( 0.2 + 0.22 * v ) * ( 0.85 + 0.25 * flare ) * ( 0.35 + 0.65 * life ), wide = 0.06 + 0.04 * v + 0.015 * flare;
    float dx = ( p.x - x ) / wide, up = p.y / max( tall, 0.01 );
    if ( abs( dx ) > 3.0 || up > 1.6 ) { floorGlow = max( floorGlow, life * v * exp( -abs( p.x - x ) * 3.0 ) ); continue; }
    float n = vnoise( vec2( dx * 1.6 + sd * 17.0, p.y * 9.0 - t * 2.2 ) ), n2 = vnoise( vec2( dx * 3.5, p.y * 21.0 - t * 4.0 + sd * 9.0 ) );
    float bodyw = 1.0 - 0.75 * up;                    // narrowing toward the top: a tongue, not a box
    float body = exp( -dx * dx / max( bodyw * bodyw, 0.02 ) ) * ss( 1.25, 0.2, up + 0.35 * ( n - 0.5 ) );
    float ridge = ss( 0.4, 0.8, n );
    float a = life * v * body * ( 0.65 + 1.8 * ridge * ( 0.6 + 0.8 * n2 ) ) * ( 1.0 + 0.5 * flare );
    bassA = max( bassA, a );
    floorGlow = max( floorGlow, life * v * exp( -abs( p.x - x ) * 3.0 ) );
  }
  col += dBass * bassA * 1.5 + cBass * bassA * bassA * 0.3; white += bassA * bassA * bassA * 0.08;
  col += cBass * floorGlow * 0.5 * exp( -p.y / 0.03 ) * uOn[1];
  col += cBass * 0.06 * uOn[1] * exp( -p.y / 0.02 );

`;
// the melody: the laser harp (Electric and Hex both)
export const FRAG_MEL = `  // ── MELODY: the laser harp ──
  vec2 base = vec2( A * 0.5, -0.95 );
  float lo = 0.1, wid = A - 0.2;
  float slope = ( p.x - base.x ) / ( p.y - base.y ), u = ( base.x + slope * ( 1.0 - base.y ) - lo ) / wid * SPAN_MEL;
  float gap = wid / SPAN_MEL * ( p.y - base.y ) / ( 1.0 - base.y );   // the gap between two beams at this height
  float top = ss( 0.985, 0.9, p.y ) * ss( 0.0, 0.08, p.y );
  if ( uOn[4] > 0.5 && u > -0.5 && u < SPAN_MEL + 0.5 ) {
    float ui = floor( u + 0.5 ), dIdle = abs( u - ui ) * gap, isC = step( mod( ui - C_MEL + 120.0, 12.0 ), 0.5 );   // (every C)
    col += cMel * exp( -sq( dIdle / ( px * 1.1 ) ) ) * ( 0.035 + 0.075 * isC ) * top * ( 0.5 + 0.5 * p.y );
  }
  for ( int i = 0; i < ${SLOTS.melody}; i++ ) {
    vec4 d = uMel[i]; if ( d.w <= 0.0 ) continue;
    float idx = floor( d.x ), sd = fract( d.x ), age = d.y, v = d.w;
    float life = held( age, d.z, 9.0 ), pluck = exp( -age * 5.0 );
    // (a plucked string: it trembles, most at its middle, the tremble dying away)
    float wob = sin( p.y * 34.0 - age * 70.0 + sd * 6.0 ) * 0.07 * pluck * sin( clamp( p.y, 0.0, 1.0 ) * 3.14159 );
    float dist = abs( u - idx - wob ) * gap;
    if ( dist > 0.08 ) continue;
    float shimmer = 0.75 + 0.5 * vnoise( vec2( p.y * 18.0 - t * 9.0, idx * 3.0 + sd * 7.0 ) );
    float runs = exp( -sq( ( p.y - age * 4.5 ) / 0.07 ) ) * step( age, 0.35 );   // the flash running up it
    float core = exp( -sq( dist / ( px * ( 1.2 + 1.3 * v ) ) ) ), glow = 0.0035 / ( dist + 0.006 ) + exp( -sq( dist / 0.012 ) ) * 0.5;
    glow *= ss( 0.08, 0.03, dist );                   // (its glow gone before the cut-off, so no edge shows)
    float a = life * v * top * ( core * 1.4 + glow * 0.6 * shimmer ) * ( 1.0 + 1.6 * pluck ) + runs * v * ( core + glow ) * 2.0;
    // (where the beam meets the top of the picture: a spot of light, as a laser on a ceiling)
    float spot = exp( -sq( dist / 0.012 ) - sq( ( p.y - 0.955 ) / 0.018 ) ) * life * v;
    col += mix( dMel, cMel, 0.6 ) * a + cMel * spot * 0.8; white += core * life * v * top * ( 0.25 + 0.7 * pluck ) + runs * core * 0.8 + spot * 0.3;
  }

`;
// Electric's lead: the plasma ball and its bolts
export const FRAG_LEAD = `  // ── LEAD: the plasma ball and its bolts ──
  vec2 C = vec2( A * 0.5, 0.57 );
  float R = 0.37, r = length( p - C );
  float leadLife = 0.0;
  for ( int i = 0; i < ${SLOTS.lead}; i++ ) {
    vec4 d = uLead[i]; if ( d.w <= 0.0 ) continue;
    float idx = floor( d.x ), sd = fract( d.x ), age = d.y, v = d.w;
    float life = held( age, d.z, 16.0 ), grow = clamp( age / 0.06, 0.0, 1.0 );
    leadLife = max( leadLife, life * v );
    float ang = radians( 210.0 ) - idx / SPAN_LEAD * radians( 240.0 );
    vec2 dir = vec2( cos( ang ), sin( ang ) ), side = vec2( -dir.y, dir.x );
    // (lightning strikes again and again: its kinks change about twelve times a second)
    float strike = floor( t * 12.0 + sd * 5.0 );
    // (a bolt in seven kinked stretches, and a short fork leaving it from its third joint)
    vec2 a = C + dir * 0.045, fork = a; float ds = 9.0;
    for ( int j = 1; j <= 7; j++ ) {
      float sj = float( j ) / 7.0, jit = ( h21( vec2( strike, float( j ) + sd * 13.0 ) ) - 0.5 ) * 0.12 * sin( sj * 3.14159 );
      vec2 b = C + dir * ( 0.045 + ( R - 0.045 ) * sj * grow ) + side * jit;
      ds = min( ds, seg( p, a, b ) ); a = b;
      if ( j == 3 ) fork = b;
    }
    float fs = h21( vec2( strike, sd * 7.0 ) ) > 0.5 ? 1.0 : -1.0;
    vec2 f1 = fork + ( dir * 0.06 + side * fs * 0.07 ) * grow, f2 = f1 + ( dir * 0.05 + side * fs * 0.02 ) * grow;
    float df = min( seg( p, fork, f1 ), seg( p, f1, f2 ) );
    vec2 tip = C + dir * R * grow; float dt = length( p - tip );
    float w = px * ( 1.4 + 2.0 * v );
    float core = exp( -sq( ds / w ) ) + 0.6 * exp( -sq( df / ( w * 0.7 ) ) ), glow = 0.004 / ( ds + 0.008 ) + exp( -sq( ds / 0.022 ) ) * 0.4 + 0.0015 / ( df + 0.008 );
    float splash = exp( -sq( dt / 0.028 ) ) * 1.1 + 0.002 / ( dt + 0.01 ) * 0.5;
    float flick = 0.8 + 0.4 * h21( vec2( strike, sd * 31.0 ) );
    col += ( dLead * ( glow * 1.1 + splash ) + cLead * core * 1.2 ) * life * v * flick * ( 1.0 + exp( -age * 10.0 ) );
    white += life * v * core * 0.9 * flick + splash * life * v * 0.25;
  }
  if ( uOn[3] > 0.5 ) {
    // the ring the bolts reach, the plasma ball they leap from (it swells while the lead plays)
    float ringl = exp( -sq( ( r - R ) / ( px * 1.0 ) ) ) * ss( -0.2, 0.25, ( p.y - C.y ) / R + 0.75 );
    col += cLead * ringl * ( 0.1 + 0.12 * leadLife );
    // (the ball: plasma in it winding, the reactor's knot of light, small and hard at its middle)
    float n = vnoise( ( p - C ) * 30.0 + vec2( 0.0, -t * 1.4 ) ), n2 = vnoise( ( p - C ) * 60.0 + vec2( t * 1.1, 4.0 ) ), rr = r / ( 0.055 + 0.015 * leadLife );
    float vein = 1.0 - abs( 2.0 * n - 1.0 ); vein = vein * vein * vein;
    float ball = exp( -rr * rr ) * ( 0.3 + 0.5 * n2 + 1.2 * vein ) + 0.012 / ( r + 0.03 );
    col += dLead * ball * ( 0.45 + 0.75 * leadLife ); white += exp( -rr * rr * 5.0 ) * ( 0.15 + 0.6 * leadLife );
  }

`;
// main's end: stopped, the frame, the light eased toward white
export const FRAG_END = `  // ── stopped: two calm bars in the middle ──
  if ( uPlay < 0.5 ) {
    vec2 q = abs( p - mid - vec2( 0.0, 0.0 ) );
    float bars = step( abs( q.x - 0.05 ), 0.03 ) * step( q.y, 0.08 );
    col = col * 0.6 + vec3( 0.35, 0.5, 0.6 ) * 0.35 * bars;
  }

  // ── the frame: the game's screens' eight-sided line ──
  vec2 e = abs( p - mid ); float hxw = A * 0.5 - 0.008, hyw = 0.5 - 0.008, cut = 0.05;
  float od = max( max( e.x - hxw, e.y - hyw ), ( e.x + e.y - ( hxw + hyw - cut ) ) * 0.7071 );
  col = col * ss( 0.0, -px * 1.5, od );
  col += vec3( 0.59, 0.82, 0.98 ) * 0.5 * exp( -sq( od / ( px * 1.2 ) ) );

  // (eased toward white at the top, as a glowing thing is, not clipped flat)
  col += vec3( 1.0 ) * min( white, 1.5 ) * 0.6;
  col = 1.0 - exp( -col * 1.15 );
  gl_FragColor = vec4( col, 1.0 );
}
`;
// (the pieces joined: exactly the picture as it was made, ELECTRIC 1)
const FRAG = FRAG_HEAD + FRAG_OPEN + FRAG_BEAT + FRAG_PADS + FRAG_BASS + FRAG_MEL + FRAG_LEAD + FRAG_END.slice(0, -1);

// a picture's material from its fragment shader (Electric's here, Hex's in src/music/hex.js): the uniforms read U
export function pictureMaterial(THREE, fragment, name, o = {}) {
  const U = electricState(o), uniforms = {};
  // (each uniform reads its value from U, so electricUniforms(f, U) is all a frame needs)
  for (const k of Object.keys(U)) uniforms[k] = { get value() { return U[k]; }, set value(v) { U[k] = v; } };
  // three takes a vec3 array as one flat array of numbers
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: fragment, depthWrite: false, depthTest: false });
  m.name = name;
  m.userData.state = U;   // electricUniforms(f, m.userData.state) each frame: nothing else to do
  return m;
}
export const electricMaterial = (THREE, o = {}) => pictureMaterial(THREE, FRAG, 'music-electric', o);
export const ELECTRIC_SHADER = { vertex: VERT, fragment: FRAG };
