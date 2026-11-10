// THE GROW PODS' GLASS AND WHAT IS BEHIND IT (the pods themselves: kit/shipparts/cabin/growpod.js): a rotary garden
// seen end-on, built from real plants, behind a lightly frosted pane. From the game's maker, 2026-11-09 and 10: "Maybe it
// could be a bit blurry like it has frosted glass over it, with green plants showing." "Maybe the plant chamber could be
// slowly spinning the plants." "The plants have thier roots around the circumference of the cylinder ... more interesting
// looking plants ... and for the 3d effect as you walk by." "The rotary garden looks awesome".
//   GROW                 the numbers every pod shares: glow (how bright, all of them at once), turn (seconds a turn)
//   FROST                the three frosts of the pane: its milky haze and its fine grain
//   INSIDE               the drum's sizes (below)
//   podInside(time)      the material of what is behind the glass; time: a { value } of seconds (the kit's U.time) for
//                        the turning and the sway
//   podPane()            the material of the frosted pane
// IN THE KIT both are in kit/materials.js's list: 'podIn' and 'podPane', drawn before 'glass'.
import * as THREE from 'three';

const UGLOW = { value: 1.2 };
export const GROW = {
  // HOW BRIGHT THE PODS ARE (every pod's, at once: GROW.glow = 1 shows on the next frame). The brightest of a pod, the
  // lamp's core, comes out a little over 1: under the 2 that the kit's glow pass picks up, so a pod never blooms into a
  // white disc.
  get glow() { return UGLOW.value; }, set glow(v) { UGLOW.value = v; },
  turn: 60,          // a pod's seconds for one turn ("slowly spinning the plants"); a pod's own o.turn overrides it
};
// how frosted the pane is: its milky haze and its fine grain
export const FROST = {
  light: { haze: 0.07, grain: 0.09 },
  medium: { haze: 0.14, grain: 0.14 },
  heavy: { haze: 0.21, grain: 0.2 },
};

// ── REAL PLANTS: A ROTARY GARDEN SEEN END-ON (the planting 'rotary': kit/shipparts/cabin/growpod.js builds it) ──────
// The game's maker, 2026-11-10, pointing back at the very first picture pod: "The very first one was the closest to what
// I want. It is just green and white, which is what I want. The plants have thier roots around the circumference of the
// cylinder, which is what I want. The only improvements I wanted where more interesting looking plants (those just look
// like grass) and for the 3d effect as you walk by."
// So a rotary pod is not a picture: a white drum lies behind the glass with its axle pointing straight out of the wall,
// and its plants (real leaves and stems, about a hundred triangles a plant) are rooted all round its inside, in rings
// one behind another, growing in toward a white lamp down the middle. The drum turns slowly about that axle, the plants
// with it. Behind a lightly frosted pane. Two materials, so ALL the rotary pods in a room's batch are two draws:
//   podInside(time)   the drum and everything in it (solid). The drum turns, and its leaves may sway, on the graphics
//                     card from the one clock: nothing is done for it each frame.
//   podPane()         the frosted pane (see-through, drawn after): a milky haze, its fine grain, the lamp's glow in it,
//                     a shadow under the frame's rim and a faint sheen
// THE DEPTH IS REAL. The drum goes back behind the wall's face (about as deep as the glass is wide) and is wider than
// the glass, so as the eye moves the near ring of leaves slides over the deeper ones and the glass's edge hides and
// shows the rings behind. The wall does not hide them: each corner of them is moved along the eye's own line (which
// leaves it on the same spot of the screen) into a thin layer just behind the glass, in front of the wall's face, their
// order kept; and only what is seen through the opening is drawn. What stands in front of the pod still hides them.
// NEAR SHARP, FAR SOFT: the drum is full of the lamp's white-green glow, and the further in a leaf is the more of the
// glow lies over it, so the deeper rings are paler, softer-edged and lower in contrast (no blur is done).
// What each corner of the inside carries (growpod.js fills them in):
//   normal   the pod's facing (its glass's outward normal: placed with the piece, so it turns with it)
//   aLocal   where it is in the pod's own frame (metres: x right, y up, z out of the glass; the glass's middle is 0, and
//            the drum's axle is the z line through it), and what it is: 0 still, 1 turning with the drum, 2 the lamp
//   aCol     its colour (linear); for a leaf, how far out along the leaf it is (0.05 at its stem .. 1 at its tip: lit
//            from either side, and how far it sways), 0 for anything else
//   aPod     the glass's half-size, its shape (0 eight-sided, 1 round), how fast it turns (radians a second), where in
//            its turn it starts
//   aLamp    the lamp's colour (0 warm .. 1 pink, both kept near white), how far the leaves sway (0: still), the pod's
//            own brightness (1), how lit the places furthest from the lamp are
// The drum's sizes, in half-sizes of the glass (growpod.js builds to them; the glass lights and fogs by them):
//   drum     its radius (past the glass's edge: the roots round it are behind the frame from in front)
//   back     how deep its back is
//   lamp     the lamp down the middle: where it starts and ends (depths); glowR how far its glow reaches out from
//            the axle, glow how bright its core is
//   fog      how much glow a half-size further in adds, from how far in (fogFrom), and the most there is (fogMost)
export const INSIDE = { drum: 1.12, back: 2.05, lamp: [-0.32, -1.95], glowR: 0.3, glow: 0.85, fog: 0.34, fogFrom: 0.35, fogMost: 0.6 };
const f3 = (v) => v.toFixed(4);
const PODEDGE = 'float podEdge( vec2 q, float rnd ) { vec2 a = abs( q ); return mix( max( max( a.x, a.y ), ( a.x + a.y ) * 0.70710678 ), length( q ), rnd ); }';
// (the lamp: white, a breath of warm or pink in it)
const LAMPCOL = 'vec3 podLampCol( float tint ) { return mix( mix( vec3( 1.0, 0.86, 0.68 ), vec3( 1.0, 0.68, 0.84 ), tint ), vec3( 0.93, 1.0, 0.93 ), 0.8 ); }';
export function podInside(time) {
  const I = INSIDE, [LA, LB] = I.lamp;
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: time || { value: 0 }, uGlow: UGLOW },
    fog: false, side: THREE.DoubleSide,
    vertexShader: `attribute vec4 aLocal; attribute vec4 aCol; attribute vec4 aPod; attribute vec4 aLamp;
uniform float uTime;
varying vec3 vW; varying vec3 vG; varying vec3 vF; varying vec4 vCol; varying vec4 vPod; varying vec4 vLamp; varying float vKind;
void main() {
  vCol = aCol; vPod = aPod; vLamp = aLamp; vKind = aLocal.w;
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = m * instanceMatrix;
  #endif
  // the pod's own frame in the piece (its facing is the normal), and the glass's middle
  vec3 f = normalize( normal ), r = normalize( cross( vec3( 0.0, 1.0, 0.0 ), f ) ), u = cross( f, r );
  vec3 g = position - ( r * aLocal.x + u * aLocal.y + f * aLocal.z );
  float hs = aPod.x, t = uTime;
  // a leaf sways a little (more toward its tip; neighbouring leaves nearly together)
  vec3 q = aLocal.xyz, ph = q / hs;
  q += aLamp.y * aCol.w * hs * 0.035 * vec3( sin( t * 1.7 + ph.x * 3.0 + ph.y * 2.0 ), sin( t * 1.3 + ph.y * 3.0 + ph.z ), 0.5 * cos( t * 1.5 + ph.z * 3.0 + ph.x ) );
  // the drum and its plants turn about its axle (the z line through the glass's middle)
  float a = ( aPod.w + t * aPod.z ) * step( 0.5, aLocal.w ) * step( aLocal.w, 1.5 ), c = cos( a ), s = sin( a );
  q.xy = vec2( q.x * c - q.y * s, q.x * s + q.y * c );
  vec4 w = m * vec4( g + r * q.x + u * q.y + f * q.z, 1.0 );
  vec3 gw = ( m * vec4( g, 1.0 ) ).xyz, fw = normalize( mat3( m ) * f );
  vW = w.xyz; vG = gw; vF = fw;
  // its depth on the screen: along the eye's line to a thin layer 0.8 to 3.4 mm behind the glass, its order kept
  float hc = dot( cameraPosition - gw, fw ), h = -dot( w.xyz - gw, fw );
  float h2 = 0.0008 + 0.0026 * clamp( h / ( ${f3(I.back + 0.1)} * hs ), 0.0, 1.0 );
  vec3 wc = cameraPosition + ( w.xyz - cameraPosition ) * ( ( hc + h2 ) / max( hc + h, 1e-5 ) );
  // (seen from behind the glass's plane: nothing)
  gl_Position = hc > 0.002 ? projectionMatrix * viewMatrix * vec4( wc, 1.0 ) : vec4( 0.0, 0.0, 2.0, 1.0 );
}`,
    fragmentShader: `uniform float uGlow;
varying vec3 vW; varying vec3 vG; varying vec3 vF; varying vec4 vCol; varying vec4 vPod; varying vec4 vLamp; varying float vKind;
#include <common>
const vec3 MILK = vec3( 0.25, 0.33, 0.26 );
${PODEDGE}
${LAMPCOL}
void main() {
  float hs = vPod.x;
  vec3 r = normalize( cross( vec3( 0.0, 1.0, 0.0 ), vF ) ), u = cross( vF, r );
  // only what is seen through the opening: where the eye's line crosses the glass
  float hc = dot( cameraPosition - vG, vF ), h = -dot( vW - vG, vF );
  vec3 x = cameraPosition + ( vW - cameraPosition ) * ( hc / max( hc + h, 1e-5 ) ) - vG;
  if ( podEdge( vec2( dot( x, r ), dot( x, u ) ) / hs, vPod.y ) > 1.02 ) discard;
  // the place in the pod (half-sizes), and the facet's own facing (toward the eye)
  vec3 d = vW - vG, lp = vec3( dot( d, r ), dot( d, u ), dot( d, vF ) ) / hs;
  vec3 n = normalize( cross( dFdx( vW ), dFdy( vW ) ) ); n = dot( n, cameraPosition - vW ) < 0.0 ? -n : n;
  vec3 nl = vec3( dot( n, r ), dot( n, u ), dot( n, vF ) );
  // the lamp down the middle: lit by how near it is and how a facet faces it (a leaf from either side, less through it)
  float leafy = clamp( vCol.w * 20.0, 0.0, 1.0 ), lampK = step( 1.5, vKind );
  vec3 lampCol = podLampCol( vLamp.x );
  vec3 lc = vec3( 0.0, 0.0, clamp( lp.z, ${f3(LB)}, ${f3(LA)} ) ) - lp; float dist = max( length( lc ), 1e-4 );
  float dl = dot( nl, lc / dist ), face = mix( max( dl, 0.0 ), dl > 0.0 ? dl : -0.6 * dl, leafy );
  float near = 1.0 / ( 1.0 + 1.2 * dist * dist );
  float lit = vLamp.w + ( 1.0 - vLamp.w ) * near * ( 0.3 + 0.7 * face );
  vec3 col = vCol.rgb * lit * mix( vec3( 1.0 ), lampCol, 0.3 ) * 1.05;
  // (a lamp part, if a pod has one: white)
  col = mix( col, lampCol * 0.9, lampK );
  // the lamp's glow, more of it the further in: the deeper rings paler and softer
  float fog = min( ${f3(I.fogMost)}, ${f3(I.fog)} * max( -lp.z - ${f3(I.fogFrom)}, 0.0 ) ) * ( 1.0 - lampK );
  col = mix( col, vec3( 0.11, 0.3, 0.09 ) * mix( vec3( 1.0 ), lampCol, 0.25 ), fog );
  // THE LAMP'S GLOW: soft, never a hard shape. How near the eye's line to this place passes the lamp's axis on its way
  // (half-sizes; the end of the line is this place itself): a bright white-green core down the middle, falling off
  // softly into the leaves, seen through the deeper rings and the drum's back, and behind any leaf in front of it
  vec3 cl = vec3( dot( cameraPosition - vG, r ), dot( cameraPosition - vG, u ), hc ) / hs, dv = lp - cl;
  float tq = clamp( -dot( cl.xy, dv.xy ) / max( dot( dv.xy, dv.xy ), 1e-6 ), 0.0, 1.0 );
  vec3 pc = cl + dv * tq; float dz = max( max( ${f3(LB)} - pc.z, pc.z - ${f3(LA)} ), 0.0 ), dg2 = dot( pc.xy, pc.xy ) + dz * dz;
  col += lampCol * ${f3(I.glow)} * exp( -dg2 / ${f3(I.glowR * I.glowR)} );
  gl_FragColor = vec4( col * uGlow * vLamp.z, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  m.extensions.derivatives = true;   // (dFdx, on WebGL 1)
  return m;
}
// the frosted pane in front of a rotary's plants. Its corners carry: aPod: the glass's half-size, the pod's brightness,
// its shape; aLook: the frost's haze and grain, 1, where in its turn it starts; aLamp: 0, the lamp's brightness and
// colour, how lit the furthest places are
export function podPane() {
  const [LA, LB] = INSIDE.lamp;
  const m = new THREE.ShaderMaterial({
    uniforms: { uGlow: UGLOW },
    fog: false, transparent: true, depthWrite: false, premultipliedAlpha: true,
    vertexShader: `attribute vec4 aPod; attribute vec4 aLook; attribute vec4 aLamp;
varying vec2 vQ; varying vec3 vEye; varying vec4 vPod; varying vec4 vLook; varying vec4 vLamp;
void main() {
  vQ = uv; vPod = aPod; vLook = aLook; vLamp = aLamp;
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = m * instanceMatrix;
  #endif
  vec4 w = m * vec4( position, 1.0 );
  vec3 n = normalize( mat3( m ) * normal ), r = abs( n.y ) > 0.95 ? vec3( 1.0, 0.0, 0.0 ) : normalize( cross( vec3( 0.0, 1.0, 0.0 ), n ) ), u = cross( n, r ), e = cameraPosition - w.xyz;
  vEye = vec3( dot( e, r ), dot( e, u ), dot( e, n ) );
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `uniform float uGlow;
varying vec2 vQ; varying vec3 vEye; varying vec4 vPod; varying vec4 vLook; varying vec4 vLamp;
#include <common>
const vec3 MILK = vec3( 0.2, 0.34, 0.19 );   // (the frost lit from inside: the plants' green through it)
${PODEDGE}
${LAMPCOL}
float podHash( vec2 p ) { p = fract( p * vec2( 0.1031, 0.103 ) ); p += dot( p, p.yx + 33.33 ); return fract( ( p.x + p.y ) * p.x ); }
float podGrain( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( podHash( i ), podHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( podHash( i + vec2( 0.0, 1.0 ) ), podHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }
void main() {
  float hs = vPod.x, d0 = podEdge( vQ, vPod.z );
  vec3 eye = normalize( vEye ), lampCol = podLampCol( vLamp.z ) * vLamp.y;
  // the lamp down the middle as the eye sees it through the glass: where the lines to its two ends cross the glass
  vec3 cam = vec3( vQ * hs, 0.0 ) + vEye, b0 = vec3( 0.0, 0.0, ${f3(LA)} ) * hs, b1 = vec3( 0.0, 0.0, ${f3(LB)} ) * hs;
  vec2 p0 = ( cam + ( b0 - cam ) * ( cam.z / ( cam.z - b0.z ) ) ).xy / hs, p1 = ( cam + ( b1 - cam ) * ( cam.z / ( cam.z - b1.z ) ) ).xy / hs;
  vec2 pa = vQ - p0, ba = p1 - p0; float dlamp = length( pa - ba * clamp( dot( pa, ba ) / dot( ba, ba ), 0.0, 1.0 ) );
  // the frost: a light milky haze (thicker seen from the side), with its fine grain (gone once a grain is under a pixel)
  float haze = 0.03 + 0.75 * vLook.x + ( 1.0 - vLook.x ) * 0.45 * pow( 1.0 - eye.z, 3.0 );
  vec2 pm = vQ * hs / 0.0012; float fw = max( fwidth( pm.x ), fwidth( pm.y ) );
  haze = clamp( haze * ( 1.0 + ( podGrain( pm ) - 0.5 ) * 2.2 * vLook.y * clamp( 1.3 - fw, 0.0, 1.0 ) ), 0.0, 1.0 );
  float lit = smoothstep( -1.1, 0.75, vQ.y ), k = vLamp.w + ( 1.0 - vLamp.w ) * lit * sqrt( lit );
  vec3 col = MILK * ( 0.3 + 0.7 * k ) * haze + lampCol * exp( -6.0 * dlamp ) * ( 0.08 + 0.6 * vLook.x );
  // the shadow under the frame's rim, then a faint sheen sliding as the eye moves
  float sh = 0.4 * smoothstep( 0.86, 1.0, d0 ); col *= 1.0 - sh;
  float sheen = ( vQ.y - 0.8 * vQ.x - 0.55 + 1.2 * eye.x - 0.6 * eye.y ) / 0.3;
  col += vec3( 0.75, 0.88, 1.0 ) * 0.04 * exp( -sheen * sheen ) * ( 1.0 - smoothstep( 0.85, 1.0, d0 ) );
  gl_FragColor = vec4( col * uGlow * vPod.y, 1.0 - ( 1.0 - haze ) * ( 1.0 - sh ) );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  m.extensions.derivatives = true;   // (fwidth, on WebGL 1)
  return m;
}
