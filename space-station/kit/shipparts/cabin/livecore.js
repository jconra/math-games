// THE REACTOR'S CORE, ALIVE: a material for a glowing column, driven by the shared clock (kit/materials.js U.time).
// One material, one draw; the column says which look it wears in its vertices.
//
//   coreColumn(p, o, at, rot)   the column itself: o.r (radius, 0.21), o.h (height, 1), o.sides (16), standing on `at`,
//                               its length along y (turn it only about y: rot [0, a, 0]); o.look (a name or number from
//                               CORE_LOOKS), o.seed (0..1)
//   coreMaterial(o)             the material (o.time: the clock uniform; o.body, o.hot: its two colours, linear;
//                               o.axis: which way the column's length runs in its mesh, [0, 1, 0])
//   corePulse(t, look)          time in, brightness out (about 0.45 to 1): the room's point light is multiplied by this,
//                               so the room breathes with the core. The same sums as the material's, so they agree.
//
// The looks (CORE_LOOKS):
//   1 flow     plasma running up the column in streams that wind slowly round it
//   2 throb    a heart of light at the middle that swells and fades (once in 4.2 seconds), fine slow movement inside it
//   3 fusion   a small bright knot held at the middle, threads of light reaching out from it to the wall and wandering
// The picture is worked out along the line of sight THROUGH the column (it is a surface, but it reads as a depth of
// light: the knot stays in the middle as you walk round it). Nothing in it changes faster than a slow breath.
// A sideways glow for the drive is the same flow with o.axis along the drive: its own material, so its own draw.
import * as THREE from 'three';
import { add } from '../../bevel.js';
import { U } from '../../materials.js';

export const CORE_LOOKS = { flow: 1, throb: 2, fusion: 3 };
export const CORE_LABEL = ['', 'plasma flowing', 'slow throb', 'fusion knot'];
const TAU = Math.PI * 2;
const lookOf = (s) => { const n = typeof s === 'number' ? s : CORE_LOOKS[s]; if (!(n >= 1 && n <= 3)) throw new Error('kit: no core look ' + s); return n; };

export function corePulse(t, look = 1) {
  const n = lookOf(look);
  if (n === 1) return 0.86 + 0.09 * Math.sin(t * 0.7) + 0.05 * Math.sin(t * 1.9 + 1.3);
  if (n === 2) return 0.45 + 0.55 * (0.5 - 0.5 * Math.cos(t * TAU / 4.2));
  return 0.82 + 0.1 * Math.sin(t * 0.9) + 0.06 * Math.sin(t * 2.6 + 0.7);
}

export function coreColumn(p, o = {}, at = [0, 0, 0], rot = [0, 0, 0]) {
  const r = o.r ?? 0.21, h = o.h ?? 1, n = o.sides ?? 16, look = lookOf(o.look ?? 'flow');
  const P = [], N = [], UV = [], I = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU, c = Math.cos(a), s = Math.sin(a);
    P.push(r * c, 0, r * s, r * c, h, r * s); N.push(c, 0, s, c, 0, s); UV.push(i / n, 0, i / n, 1);
    if (i < n) I.push(i * 2, i * 2 + 1, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I);
  add(p, null, g, at, rot, 'core');
  // each vertex: the look (whole part) and seed (the part after the point), the column's radius, its height
  const k = g.attributes.position.count, col = new Float32Array(k * 3), sd = 0.05 + 0.9 * Math.min(Math.max((o.seed ?? 0) % 1, 0), 1);
  for (let i = 0; i < k; i++) { col[i * 3] = look + sd; col[i * 3 + 1] = r; col[i * 3 + 2] = h; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const VERT = `uniform vec3 uAxis;
varying vec3 vW; varying vec3 vC; varying vec3 vAx; varying vec3 vE1; varying vec3 vData; varying vec2 vUv;
void main() {
  vUv = uv; vData = color;
  vec4 p = vec4( position, 1.0 ); vec3 n = normal, ax = uAxis, e1 = abs( uAxis.y ) > 0.9 ? vec3( 1.0, 0.0, 0.0 ) : vec3( 0.0, 1.0, 0.0 );
  #ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3( instanceMatrix ) * n; ax = mat3( instanceMatrix ) * ax; e1 = mat3( instanceMatrix ) * e1;
  #endif
  // the column's middle: in from this vertex along its normal by the radius, and along its length to half way
  vec3 c = p.xyz - normalize( n ) * color.y - ax * ( uv.y - 0.5 ) * color.z;
  vW = ( modelMatrix * p ).xyz; vC = ( modelMatrix * vec4( c, 1.0 ) ).xyz; vAx = mat3( modelMatrix ) * ax; vE1 = mat3( modelMatrix ) * e1;
  gl_Position = projectionMatrix * viewMatrix * vec4( vW, 1.0 );
}`;

const FRAG = `uniform float uTime; uniform vec3 uBody; uniform vec3 uHot;
varying vec3 vW; varying vec3 vC; varying vec3 vAx; varying vec3 vE1; varying vec3 vData; varying vec2 vUv;
#include <common>
const float TAU = 6.2831853;
float h31( vec3 p ) { p = fract( p * 0.1031 ); p += dot( p, p.zyx + 31.32 ); return fract( ( p.x + p.y ) * p.z ); }
// smooth noise in space, 0..1
float vnoise( vec3 p ) {
  vec3 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( h31( i ), h31( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( h31( i + vec3( 0.0, 1.0, 0.0 ) ), h31( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
              mix( mix( h31( i + vec3( 0.0, 0.0, 1.0 ) ), h31( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( h31( i + vec3( 0.0, 1.0, 1.0 ) ), h31( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z );
}
// how near the line of sight (from o along d, a unit vector) passes the stretch from a to b
float nearSeg( vec3 o, vec3 d, vec3 a, vec3 b ) {
  vec3 u = b - a, w = o - a; float A = dot( u, u ), B = dot( u, d ), C = dot( u, w ), D = dot( d, w ), den = A - B * B;
  float sN = den > 1e-5 ? clamp( ( C - B * D ) / den, 0.0, 1.0 ) : 0.5, tN = max( B * sN - D, 0.0 );
  return length( w + d * tN - u * sN );
}
void main() {
  float look = floor( vData.x ), seed = fract( vData.x ), sc = length( vAx ), r = vData.y * sc, t = uTime;
  // into the column's own measure: its middle at 0, its radius 1, y along its length; hh: half its length
  vec3 ax = vAx / sc, e1 = normalize( vE1 - ax * dot( vE1, ax ) ), e2 = cross( ax, e1 ), rel = ( vW - vC ) / r, dw = normalize( vW - cameraPosition );
  vec3 p0 = vec3( dot( rel, e1 ), dot( rel, ax ), dot( rel, e2 ) ), d = vec3( dot( dw, e1 ), dot( dw, ax ), dot( dw, e2 ) );
  float hh = vData.z * sc / r * 0.5;
  // how far the line of sight runs inside it before it leaves by the far wall or an end
  float len = clamp( -2.0 * dot( p0.xz, d.xz ) / max( dot( d.xz, d.xz ), 1e-4 ), 0.0, 4.0 );
  if ( abs( d.y ) > 1e-4 ) len = min( len, max( ( ( d.y > 0.0 ? hh : -hh ) - p0.y ) / d.y, 0.0 ) );
  vec3 col;
  if ( look < 1.5 ) {
    // FLOW: streams rising, winding slowly round the middle; four looks into the depth of it
    float pulse = 0.86 + 0.09 * sin( t * 0.7 ) + 0.05 * sin( t * 1.9 + 1.3 ), acc = 0.0;
    for ( int i = 0; i < 4; i++ ) {
      vec3 p = p0 + d * len * ( float( i ) + 0.5 ) / 4.0; float rho2 = dot( p.xz, p.xz ), tw = p.y * 0.22 + t * 0.12, c = cos( tw ), s = sin( tw );
      p.xz = vec2( c * p.x - s * p.z, s * p.x + c * p.z );
      // (the fine grain rides up at the same pace as the streams it sits on, 0.9 of a radius a second, so a stream keeps
      // its shape as it climbs and the eye can follow it: at two paces it boiled)
      float n = vnoise( vec3( p.x * 2.4, p.y * 0.55 - t * 0.5, p.z * 2.4 ) + seed * 19.0 ), n2 = vnoise( vec3( p.x * 5.5, p.y * 1.4 - t * 1.27, p.z * 5.5 ) + 7.3 );
      // (a stream is where the noise runs high, about a quarter of the column, long and narrow; the rest is left dark,
      // so they read as streams with gaps between and not as one lit panel)
      float ridge = smoothstep( 0.5, 0.8, n ); ridge *= ridge;
      acc += ridge * ( 0.4 + 1.1 * n2 ) * ( 1.0 - 0.55 * rho2 ) * 1.7 + 0.07 * exp( -rho2 * 3.0 ) * ( 0.6 + 0.6 * n2 );
    }
    // (eased off at the top, so where streams cross it does not burn out to flat white)
    acc *= len * 0.25 * pulse; acc /= 1.0 + 0.6 * acc;
    col = uBody * acc * 1.0 + uHot * acc * acc * acc * 0.22;
  } else if ( look < 2.5 ) {
    // THROB: an egg of light at the middle, swelling and fading; slow curls inside it, faint shells of light leaving it
    float bt = 0.5 - 0.5 * cos( t * TAU / 4.2 ), sg = 0.4 + 0.22 * bt;
    vec3 o2 = vec3( p0.x, p0.y / 1.9, p0.z ), d2 = vec3( d.x, d.y / 1.9, d.z ); float dl = length( d2 ); d2 /= dl;
    vec3 pc = o2 - d2 * dot( o2, d2 ); float b2 = dot( pc, pc ), heart = 1.7724539 * sg / dl * exp( -b2 / ( sg * sg ) );
    // the fine movement: thin bright veins winding slowly through the egg, a finer grain under them
    float n = vnoise( pc * 3.4 + vec3( 0.0, -t * 0.22, t * 0.12 ) + seed * 11.0 ), n2 = vnoise( pc * 7.5 + vec3( t * 0.27, 5.0, -t * 0.18 ) );
    float vein = 1.0 - abs( 2.0 * n - 1.0 ); vein *= vein * vein;
    float body = heart * ( 0.3 + 0.45 * n2 + 1.2 * vein ) * ( 0.85 + 0.25 * sin( sqrt( b2 ) * 9.0 - t * 1.2 ) );
    float fog = len * 0.026 * ( 0.6 + 0.4 * vnoise( vec3( p0.x * 1.5, p0.y * 1.2 - t * 0.2, p0.z * 1.5 ) ) );
    float acc = body * ( 0.3 + 0.9 * bt ) + fog * ( 0.5 + 0.5 * bt ), hot = heart * ( 0.15 + 0.85 * bt ) * ( 0.45 + 1.0 * vein );
    col = uBody * acc * 1.25 + uHot * hot * hot * 0.2;
  } else {
    // FUSION: a knot of light held at the middle, five threads reaching from it to the wall, coming and going
    float pulse = 0.82 + 0.1 * sin( t * 0.9 ) + 0.06 * sin( t * 2.6 + 0.7 );
    vec3 pc = p0 - d * dot( p0, d ); float b2 = dot( pc, pc );
    // (the knot: small and hard, its edge lobed and turning slowly, not a round soft ball; and round it the light it
    // throws on the gas in the tube, strong beside it and gone by the ends, so the tube is not one flat blue)
    vec3 sx = normalize( cross( d, vec3( 0.0, 1.0, 0.0 ) ) + vec3( 1e-4, 0.0, 0.0 ) ); float ka = atan( dot( pc, cross( sx, d ) ), dot( pc, sx ) );
    float kr = 0.013 * ( 1.0 + 0.45 * sin( 3.0 * ka + t * 0.6 ) + 0.25 * sin( 5.0 * ka - t * 0.9 ) );
    float knot = exp( -b2 / kr ) + 0.2 * exp( -b2 / 0.07 ), halo = 0.34 * exp( -b2 / 0.5 ) + 0.012 / ( b2 + 0.03 );
    float soft = 0.0, hot = 0.0;
    for ( int i = 0; i < 5; i++ ) {
      float fi = float( i ) + seed * 7.0, life = smoothstep( 0.1, 0.55, 0.5 + 0.5 * sin( t * ( 0.42 + 0.08 * fi ) + fi * 2.4 ) );
      float phi = fi * 1.2566 + 0.9 * sin( t * 0.3 + fi * 1.7 ) + 0.4 * sin( t * 0.7 + fi * 4.3 );
      vec3 w = vec3( 0.97 * cos( phi ), min( hh * 0.75, 1.6 ) * sin( t * 0.17 + fi * 2.9 ), 0.97 * sin( phi ) );
      // (a bent thread: from the knot, by way of a point that drifts well off the straight way, to the wall, in six
      // straight stretches, each joint nudged a little so it is an arc with kinks in it and not a rod)
      vec3 ctl = w * 0.5 + 0.5 * vec3( sin( t * 0.9 + fi * 5.1 ), sin( t * 1.2 + fi * 3.3 ), cos( t * 0.8 + fi * 1.9 ) ), a = vec3( 0.0 ); float ds = 9.0;
      for ( int j = 1; j <= 6; j++ ) {
        float sj = float( j ) / 6.0, fj = float( j ) + fi * 3.0;
        vec3 b = 2.0 * sj * ( 1.0 - sj ) * ctl + sj * sj * w + 0.07 * sin( sj * 3.14159 ) * vec3( sin( fj * 7.1 + t * 1.6 ), sin( fj * 4.7 - t * 1.3 ), cos( fj * 5.9 + t * 1.1 ) );
        ds = min( ds, nearSeg( p0, d, a, b ) ); a = b;
      }
      vec3 pw = p0 + d * max( dot( w - p0, d ), 0.0 ) - w;
      soft += life * ( exp( -ds * ds / 0.0009 ) + 0.004 / ( ds + 0.035 ) + 0.5 * exp( -dot( pw, pw ) / 0.012 ) );
      hot += life * exp( -ds * ds / 0.00022 );
    }
    col = uBody * ( soft * 0.95 + halo * 0.8 + len * 0.006 ) * pulse + uHot * ( knot * 1.3 * pulse + hot * 0.4 );
  }
  // the glass round it: a faint sheen toward its edges; dimmer where it runs into its collars
  float facing = clamp( -dot( p0.xz, d.xz ) / max( length( p0.xz ) * length( d.xz ), 1e-4 ), 0.0, 1.0 );
  col += uBody * 0.14 * pow( 1.0 - facing, 3.0 );
  col *= 0.3 + 0.7 * smoothstep( 0.0, 0.06, vUv.y ) * smoothstep( 1.0, 0.94, vUv.y );
  gl_FragColor = vec4( col, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function coreMaterial(o = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uTime: o.time || U.time, uAxis: { value: new THREE.Vector3(...(o.axis || [0, 1, 0])).normalize() },
      uBody: { value: new THREE.Vector3(...(o.body || [0.25, 0.8, 2.2])) }, uHot: { value: new THREE.Vector3(...(o.hot || [2.6, 4.4, 7.5])) },
    },
    vertexColors: true, fog: false, vertexShader: VERT, fragmentShader: FRAG,
  });
  m.name = 'core';
  return m;
}
