// MOLTEN METAL, ALIVE: the smelter's melt (a furnace's pours, its glowing slots, the surface in a ladle), one material
// driven by the shared clock (kit/materials.js U.time), so every glowing part of a furnace is ONE draw and nothing is
// worked out per frame on the CPU. (The ship's reactor core, kit/shipparts/cabin/livecore.js, is the same idea for
// plasma; its column maths does not suit sheets and boxes, so this is a small material of its own.)
//
//   meltMaterial(o)   the material (o.time: the clock uniform, U.time by default). It is unlit: a part drawn with it
//                     ('melt', kit/materials.js MAT_KEYS) glows by itself. Its vertex colour is the part's own colour
//                     and brightness (linear, above 1 for bright): the movement is laid over it.
//
// What moves: a slow, lumpy brightness drifting DOWN the world (so a pour runs downward and a slot seems to drip),
// churning sideways too (so the surface in a ladle crawls), with brighter knots that come and go; the brightest
// parts pale toward yellow-white. Nothing in it is faster than about two cycles a second: it seethes, it does not
// flicker.
import * as THREE from 'three';
import { U } from './materials.js';

const VERT = `varying vec3 vW; varying vec3 vC;
void main() {
  vC = color;
  vec4 p = vec4( position, 1.0 );
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  vec4 w = modelMatrix * p; vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = `uniform float uTime;
varying vec3 vW; varying vec3 vC;
#include <common>
float h31( vec3 p ) { p = fract( p * 0.1031 ); p += dot( p, p.zyx + 31.32 ); return fract( ( p.x + p.y ) * p.z ); }
float vnoise( vec3 p ) {
  vec3 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( h31( i ), h31( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( h31( i + vec3( 0.0, 1.0, 0.0 ) ), h31( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
              mix( mix( h31( i + vec3( 0.0, 0.0, 1.0 ) ), h31( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( h31( i + vec3( 0.0, 1.0, 1.0 ) ), h31( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z );
}
void main() {
  float t = uTime;
  // two layers of lumps: big slow ones running down at a metre and a bit a second, small quick ones under them
  vec3 p = vW * vec3( 2.6, 1.7, 2.6 );
  float n = vnoise( p + vec3( t * 0.13, t * 2.1, -t * 0.09 ) );
  float n2 = vnoise( p * 2.7 + vec3( -t * 0.31, t * 4.6, t * 0.23 ) );
  float k = vnoise( p * 0.6 + vec3( 3.1, t * 0.5, 7.7 ) );          // (where the bright knots gather, drifting)
  float heat = 0.32 + 0.62 * n + 0.32 * n2 * n2 + 0.35 * smoothstep( 0.62, 0.9, k ) - 0.18;
  vec3 c = vC * mix( 0.38, 1.45, clamp( heat, 0.0, 1.2 ) );
  // the hottest parts pale toward yellow-white, as much as the part is bright
  float lum = dot( vC, vec3( 0.3, 0.55, 0.15 ) );
  c += vec3( 1.0, 0.72, 0.36 ) * lum * 1.6 * smoothstep( 0.78, 1.15, heat );
  gl_FragColor = vec4( c, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function meltMaterial(o = {}) {
  const m = new THREE.ShaderMaterial({ uniforms: { uTime: o.time || U.time }, vertexColors: true, fog: false, vertexShader: VERT, fragmentShader: FRAG });
  m.name = 'melt';
  return m;
}
