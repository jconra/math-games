// THE LIVE SCREENS' PICTURES (kit/shipparts/cabin/live.js): what the graphics card works out for each pixel of a live
// screen. One programme per screen face; a face says which in its vertices. Lengths are in SCREEN HEIGHTS: the screen's
// middle is (0, 0), it runs -0.5..0.5 up and -A/2..A/2 across (A: its width over its height). t is the shared clock.
// Words come from the sheet (live.js liveSheet): a programme asks for them with stamp(), and the one lookup is at the end.
export const LIVE_VERTEX = `varying vec2 vUv; varying vec3 vData;
void main() {
  vUv = uv; vData = color;
  vec4 p = vec4( position, 1.0 );
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`;

const HEAD = (o) => `uniform float uTime; uniform float uFlick; uniform sampler2D uSheet; uniform vec3 uPanelA; uniform vec3 uPanelB;
varying vec2 vUv; varying vec3 vData;
#include <common>
// the colours: a palette (live.js LIVE_PALETTES), set on the material, so one switch turns every screen at once.
// INK words and the brightest lines, LINE the drawing, DIM the faint parts, AMB the warm accent, GOOD the green, HOT and
// WASTE the water tanks' fills; SAT how much the colour is deepened at the end (1: as drawn)
uniform vec3 C_INK; uniform vec3 C_LINE; uniform vec3 C_DIM; uniform vec3 C_AMB; uniform vec3 C_GOOD; uniform vec3 C_HOT; uniform vec3 C_WASTE; uniform float uSat;
const float TAU = 6.2831853, ADV = ${o.adv.toFixed(4)}, SPREAD = ${o.spread.toFixed(1)};
const float LEN[${o.lens.length}] = float[${o.lens.length}]( ${o.lens.map((n) => n.toFixed(1)).join(', ')} );
vec3 gT; vec3 gTc;      // the words asked for at this pixel: where on the sheet (its pixels), how big, what colour

float hash1( float n ) { return fract( sin( n * 12.9898 + 4.1414 ) * 43758.5453 ); }
float hash2( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
// a line: 1 on it, 0 away from it. d: how far this pixel is from its middle; w: half its width; px: one pixel
float ln( float d, float w, float px ) { return 1.0 - smoothstep( w, w + px * 1.3, abs( d ) ); }
// 1 between a and b, soft by k at each end
float band( float x, float a, float b, float k ) { return smoothstep( a - k, a + k, x ) * ( 1.0 - smoothstep( b - k, b + k, x ) ); }
float disc( float d, float r, float px ) { return 1.0 - smoothstep( r, r + px * 1.5, d ); }
float seg( vec2 p, vec2 a, vec2 b ) { vec2 pa = p - a, ba = b - a; return length( pa - ba * clamp( dot( pa, ba ) / dot( ba, ba ), 0.0, 1.0 ) ); }
float bump( float x, float c, float w ) { float u = ( x - c ) / w; return exp( -u * u ); }
vec3 rotX( vec3 p, float a ) { float c = cos( a ), s = sin( a ); return vec3( p.x, c * p.y - s * p.z, s * p.y + c * p.z ); }
vec3 rotZ( vec3 p, float a ) { float c = cos( a ), s = sin( a ); return vec3( c * p.x - s * p.y, s * p.x + c * p.y, p.z ); }

// WORDS. A piece of the sheet r (x, y, width, height in its pixels, y from the top) written with its lower left corner
// at \`at\`, \`hgt\` high; only its first \`show\` line-heights of width are written (a line typing itself out)
void stamp( vec2 s, vec2 at, float hgt, vec4 r, float show, vec3 c ) {
  vec2 q = ( s - at ) / hgt;
  if ( q.x >= 0.0 && q.y >= 0.0 && q.y <= 1.0 && q.x <= min( r.z / r.w, show ) ) { gT = vec3( r.x + q.x * r.w, r.y + ( 1.0 - q.y ) * r.w, r.w / hgt ); gTc = c; }
}
vec4 label( float i ) { return vec4( 256.0 + 128.0 * floor( i / 25.0 ), 20.0 * mod( i, 25.0 ), 128.0, 20.0 ); }
vec4 logLine( float i ) { return vec4( 0.0, 20.0 * i, 256.0, 20.0 ); }
// a whole number, n digits, its lower left at \`at\`. (Each digit and sign sits in the middle of a cell 12 wide on the
// sheet; only a letter's width of its middle is taken, so they stand as close together as the letters of a word)
const float DW = min( 20.0 * ADV, 12.0 );
void number( vec2 s, vec2 at, float hgt, float v, int n, vec3 c ) {
  v = floor( v + 0.5 );
  for ( int i = n - 1; i >= 0; i-- ) { float d = mod( v, 10.0 ); v = floor( v / 10.0 ); stamp( s, at + vec2( hgt * ADV * float( i ), 0.0 ), hgt, vec4( 390.0 - DW * 0.5 + 12.0 * d, 480.0, DW, 20.0 ), 9.0, c ); }
}
// one of the signs . : % - + / (0..5)
void sign_( vec2 s, vec2 at, float hgt, float i, vec3 c ) { stamp( s, at, hgt, vec4( 390.0 - DW * 0.5 + 12.0 * i, 460.0, DW, 20.0 ), 9.0, c ); }
`;

// 1 survey: the wire planet, 2 chart: the star chart, 3 rest: the sleeper's trace
const SHOWS_A = `
void survey( vec2 s, float A, float px, float t, float seed, inout vec3 col ) {
  float R = min( 0.34, A * 0.2 ), tip = 0.38, lean = 0.41, spin = t * 0.22 + seed * TAU;     // once round in 28 seconds
  vec2 q = ( s - vec2( A > 1.3 ? A * 0.06 : 0.0, -0.02 ) ) / R; float r2 = dot( q, q ), fp = px / R;
  // the planet's own x and z, seen from here (its pole leans over and tips toward us)
  vec3 u = rotX( rotZ( vec3( 1.0, 0.0, 0.0 ), -lean ), tip ), v = rotX( rotZ( vec3( 0.0, 0.0, 1.0 ), -lean ), tip );
  // the moon's ring: a circle round the equator, one and a half radii out, hidden where it passes behind
  mat2 Mi = inverse( mat2( u.xy, v.xy ) ); vec2 w = Mi * q; float wl = max( length( w ), 1e-4 );
  float ringD = ( wl - 1.5 ) / max( length( transpose( Mi ) * ( w / wl ) ), 1e-4 ), ringZ = dot( vec2( u.z, v.z ), w );
  float hid = ( ringZ < 0.0 && r2 < 1.0 ) ? 0.0 : 1.0;
  col += C_LINE * 0.7 * ln( ringD, 0.004, fp ) * hid * ( ringZ < 0.0 ? 0.45 : 1.0 );
  float ma = t * 0.3 + seed * 3.0; vec3 mp = 1.5 * ( u * cos( ma ) + v * sin( ma ) );
  if ( !( mp.z < 0.0 && dot( mp.xy, mp.xy ) < 1.0 ) ) col += C_INK * 1.8 * disc( length( q - mp.xy ), 0.045, fp );
  // the globe: its edge, a faint glassy ball, and its lines every 30 degrees, front (bright) and back (faint)
  col += C_LINE * 1.2 * ln( sqrt( r2 ) - 1.0, 0.006, fp );
  if ( r2 < 1.0 ) {
    float z = sqrt( 1.0 - r2 ), st = 0.5235988;
    col += C_DIM * ( 0.1 + 0.28 * ( 1.0 - z ) );
    for ( int k = 0; k < 2; k++ ) {
      vec3 P = rotZ( rotX( vec3( q, k == 0 ? z : -z ), -tip ), lean );
      float lat = asin( clamp( P.y, -1.0, 1.0 ) ), lon = atan( P.x, P.z ) + spin, f = fp / max( z, 0.18 );
      float dl = abs( fract( lat / st + 0.5 ) - 0.5 ) * st, dn = abs( fract( lon / st + 0.5 ) - 0.5 ) * st * cos( lat );
      float g = max( ln( dl, 0.006, f ), ln( dn, 0.006, f ) * smoothstep( 1.5, 1.25, abs( lat ) ) );
      col += C_LINE * g * ( k == 0 ? 1.15 * ( 0.45 + 0.55 * z ) : 0.26 );
    }
  }
  // the marked spot, riding round with the planet, a ring spreading from it now and then
  vec3 m = rotX( rotZ( vec3( 0.913 * sin( 0.9 - spin ), 0.408, 0.913 * cos( 0.9 - spin ) ), -lean ), tip );
  float vis = smoothstep( -0.05, 0.15, m.z ), md = length( q - m.xy ), pulse = fract( t / 2.6 );
  col += C_AMB * 2.2 * vis * disc( md, 0.04, fp ) + C_AMB * 1.1 * vis * ( 1.0 - pulse ) * ln( md - 0.06 - 0.22 * pulse, 0.004, fp );
  float x0 = -A * 0.5 + 0.07;
  stamp( s, vec2( x0, 0.36 ), 0.08, label( 0.0 ), 9.0, C_INK );
  stamp( s, vec2( x0, -0.44 ), 0.062, label( 9.0 ), 9.0, C_LINE * 1.4 );
  number( s, vec2( x0 + 0.062 * ADV * 5.0, -0.44 ), 0.062, mod( floor( t ) * 12.6 + seed * 360.0, 360.0 ), 3, C_INK );
}

vec2 pick( float k, float A ) { return vec2( ( hash1( k * 1.37 ) - 0.5 ) * A * 0.55 + A * 0.06, ( hash1( k * 2.91 + 17.3 ) - 0.5 ) * 0.5 ); }
void chart( vec2 s, float A, float px, float t, float seed, inout vec3 col ) {
  vec2 vel = vec2( 0.012, 0.004 ), d = s + vel * t + seed * 7.0;
  vec2 gq = abs( fract( d * 4.0 + 0.5 ) - 0.5 ) / 4.0;                                   // the chart's own squares drift with the stars
  col += C_LINE * 0.2 * max( ln( gq.x, 0.0, px ), ln( gq.y, 0.0, px ) );
  // the stars: a few near ones and a dust of far ones, kept clear of the words (top left and bottom left)
  float words = ( 1.0 - smoothstep( 0.46, 0.56, s.x + A * 0.5 ) ) * max( smoothstep( 0.3, 0.34, s.y ), 1.0 - smoothstep( -0.36, -0.32, s.y ) );
  for ( int k = 0; k < 2; k++ ) {
    float n = k == 0 ? 6.0 : 13.0; vec2 c = d * n, id = floor( c ) + float( k ) * 31.0;
    if ( hash2( id ) > ( k == 0 ? 0.6 : 0.62 ) ) {
      vec2 at = 0.2 + 0.6 * vec2( hash2( id + 3.1 ), hash2( id + 7.7 ) ); float r = k == 0 ? 0.028 + 0.04 * hash2( id + 1.3 ) : 0.045;
      col += mix( C_INK, vec3( 1.0, 0.86, 0.7 ), hash2( id + 5.5 ) ) * ( k == 0 ? 1.5 : 0.6 ) * ( 1.0 - words ) * disc( length( fract( c ) - at ), r, px * n );
    }
  }
  // the marker: it sits on one star, then every 14 seconds slides to the next and closes on it
  float hop = 14.0, tt = t + seed * hop, k = floor( tt / hop ), x = tt - k * hop;
  vec2 p1 = pick( k, A ) - vel * x, p0 = pick( k - 1.0, A ) - vel * ( x + hop ), pm = mix( p0, p1, smoothstep( 0.0, 2.6, x ) );
  col += C_INK * 2.2 * ( disc( length( s - p1 ), 0.013, px ) + disc( length( s - p0 ), 0.013, px ) );
  vec2 b = abs( s - pm ); float hs = mix( 0.085, 0.055, smoothstep( 2.6, 3.4, x ) ), mx = max( b.x, b.y );
  col += C_AMB * 1.9 * ln( mx - hs, 0.003, px ) * step( hs * 0.45, min( b.x, b.y ) );
  col += C_AMB * 0.28 * max( ln( b.x, 0.0, px ), ln( b.y, 0.0, px ) ) * step( hs * 1.5, mx );
  // the ship and the course to the marker, its dashes creeping along
  vec2 ship = vec2( -A * 0.36, -0.3 ), dir = pm - ship; float dl = max( length( dir ), 1e-3 ), al = dot( s - ship, dir / dl );
  col += C_GOOD * 0.9 * ln( seg( s, ship + dir / dl * 0.05, pm - dir / dl * ( hs + 0.02 ) ), 0.002, px ) * step( 0.5, fract( al * 14.0 - t * 0.35 ) );
  col += C_GOOD * 1.8 * disc( length( s - ship ), 0.016, px ) + C_GOOD * 0.9 * ln( length( s - ship ) - 0.035, 0.002, px );
  float x0 = -A * 0.5 + 0.07; vec2 pq = mix( p0, p1, smoothstep( 0.0, 2.6, floor( x ) ) ) - ship;
  stamp( s, vec2( x0, 0.36 ), 0.08, label( 1.0 ), 9.0, C_INK );
  stamp( s, vec2( x0, -0.44 ), 0.062, label( 10.0 ), 9.0, C_LINE * 1.4 );
  number( s, vec2( x0 + 0.062 * ADV * 6.0, -0.44 ), 0.062, length( pq ) * 400.0, 3, C_INK );
}

float beat( float x ) { x = fract( x ); return 0.09 * bump( x, 0.2, 0.04 ) - 0.12 * bump( x, 0.365, 0.013 ) + bump( x, 0.4, 0.017 ) - 0.2 * bump( x, 0.44, 0.015 ) + 0.2 * bump( x, 0.64, 0.055 ); }
void rest( vec2 s, float A, float px, float t, float seed, inout vec3 col ) {
  // a pen crosses the screen every 6 seconds, drawing; what it drew last time round fades ahead of it
  float sweep = 6.0, xn = s.x / A + 0.5, pen = fract( t / sweep + seed ), age = fract( pen - xn ), tx = t - age * sweep;
  float rate = 0.82 + 0.22 * seed, fade = ( 0.2 + 0.8 * pow( 1.0 - age, 1.6 ) ) * smoothstep( 0.985, 0.93, age );
  float ph = tx * rate + seed * 5.0, h = max( px, 0.002 ), kx = sweep * rate / A;
  float ya = 0.05 + 0.24 * beat( ph - h * kx ), yb = 0.05 + 0.24 * beat( ph ), yc = 0.05 + 0.24 * beat( ph + h * kx );
  float d = min( seg( vec2( 0.0, s.y ), vec2( -h, ya ), vec2( 0.0, yb ) ), seg( vec2( 0.0, s.y ), vec2( 0.0, yb ), vec2( h, yc ) ) );
  col += C_GOOD * fade * ( 1.9 * ln( d, 0.006, px ) + 0.22 * exp( -d * 38.0 ) );
  col += C_INK * 2.0 * disc( length( s - vec2( ( pen - 0.5 ) * A, 0.05 + 0.24 * beat( t * rate + seed * 5.0 ) ) ), 0.014, px );
  // the breathing under it: one breath every five seconds, the last eight seconds of it sliding slowly by (the newest at
  // the right). It does not follow the pen: a filled shape cut off at the pen read as a tear in the picture
  float bw = ( t - ( 1.0 - xn ) * 8.0 ) * 1.2566 + seed * 3.0, by = -0.25 + 0.07 * sin( bw ), bs = 0.07 * cos( bw ) * 1.2566 * 8.0 / A;
  col += C_LINE * 0.7 * ( 1.3 * ln( ( s.y - by ) / sqrt( 1.0 + bs * bs ), 0.005, px ) + 0.28 * step( s.y, by ) * smoothstep( -0.44, by, s.y ) );
  col += C_DIM * 0.6 * ln( s.y + 0.09, 0.0, px );
  // the rate, and a soft dot that swells with each beat
  float x0 = -A * 0.5 + 0.07, x1 = A * 0.5 - 0.07, bp = fract( t * rate + seed * 5.0 - 0.4 );
  stamp( s, vec2( x0, 0.36 ), 0.08, label( 2.0 ), 9.0, C_INK );
  stamp( s, vec2( x0, -0.085 ), 0.055, label( 13.0 ), 9.0, C_LINE * 1.2 );
  number( s, vec2( x1 - 0.13 * ADV * 2.0, 0.33 ), 0.13, rate * 60.0 + 2.0 * sin( floor( t / 3.0 ) * 1.7 + seed * 9.0 ), 2, C_GOOD * 1.5 );
  col += C_GOOD * ( 0.5 + 1.5 * exp( -bp * 3.5 ) * smoothstep( 0.0, 0.08, bp ) ) * disc( length( s - vec2( x1 - 0.22, 0.395 ) ), 0.022, px );
}
`;

// 4 drive: the engine's readouts, 5 scan: the scanner, 6 log: the ship's log
const SHOWS_B = `
void drive( vec2 s, float A, float px, float t, float seed, inout vec3 col ) {
  // the dial: open at the bottom, from 210 degrees round to -30; its last part amber
  vec2 q = s - vec2( -A * 0.25, -0.03 ); float r = min( 0.27, A * 0.19 ), l = length( q ), ang = atan( q.y, q.x );
  float v = 0.62 + 0.05 * sin( t * 0.9 + seed * 6.0 ) + 0.03 * sin( t * 2.3 + 1.0 ) + 0.04 * sin( t * 0.21 );
  float vq = 0.62 + 0.05 * sin( floor( t ) * 0.9 + seed * 6.0 ) + 0.04 * sin( floor( t ) * 0.21 );
  float open = step( -0.5, q.y / max( l, 1e-4 ) ), along = ( 3.6651914 - ( ang < -1.5707963 ? ang + TAU : ang ) ) / 4.1887902;
  col += mix( C_LINE, C_AMB, step( 0.83, along ) ) * 1.2 * open * ln( l - r, 0.005, px );
  col += C_LINE * 0.9 * open * ln( abs( fract( along * 12.0 + 0.5 ) - 0.5 ) / 12.0 * 4.1887902 * l, 0.003, px ) * step( r * 0.84, l ) * step( l, r * 0.97 );
  col += C_GOOD * 0.55 * open * step( along, v ) * ln( l - r * 0.74, 0.012, px );
  float na = 3.6651914 - v * 4.1887902; vec2 nd = vec2( cos( na ), sin( na ) );
  col += C_INK * 1.9 * ln( seg( q, nd * r * 0.14, nd * r * 0.9 ), 0.005, px ) + C_INK * 1.3 * disc( l, r * 0.07, px );
  float x0 = -A * 0.5 + 0.07;
  stamp( s, vec2( x0, 0.36 ), 0.08, label( 3.0 ), 9.0, C_INK );
  stamp( s, vec2( x0, -0.445 ), 0.062, label( 12.0 ), 9.0, C_LINE * 1.4 );
  number( s, vec2( -A * 0.25 - 0.15 * ADV, -0.03 - r * 0.72 ), 0.1, vq * 100.0, 2, C_INK );
  sign_( s, vec2( -A * 0.25 + 0.05 * ADV, -0.03 - r * 0.72 ), 0.1, 2.0, C_LINE * 1.4 );
  // five bars of ten lamps, each level wandering slowly; the top two lamps amber
  float bx = A * 0.07, bw = A * 0.37 / 5.0, bu = ( s.x - bx ) / bw, bi = floor( bu ), yy = ( s.y + 0.38 ) / 0.43;
  if ( bi >= 0.0 && bi < 5.0 && yy > 0.0 && yy < 1.0 ) {
    float lev = 0.55 + 0.22 * sin( t * 0.31 + bi * 1.7 + seed * 9.0 ) + 0.1 * sin( t * 0.83 + bi * 4.1 ), si = floor( yy * 10.0 );
    float cell = band( fract( bu ), 0.2, 0.8, px / bw ) * band( fract( yy * 10.0 ), 0.2, 0.84, px * 10.0 / 0.43 );
    col += mix( C_DIM * 0.55, si >= 8.0 ? C_AMB * 1.3 : C_LINE * 1.3, step( ( si + 0.5 ) / 10.0, lev ) ) * cell;
  }
  stamp( s, vec2( bx + bw * 0.2, -0.455 ), 0.055, label( 31.0 ), 9.0, C_LINE * 1.2 );
  // a trend line creeping left
  float tu = ( s.x - bx ) / ( A * 0.37 );
  if ( tu > 0.0 && tu < 1.0 ) {
    float xx = tu * 5.0 + t * 0.25, y = 0.25 + 0.07 * sin( xx * 1.3 + seed ) + 0.03 * sin( xx * 3.7 + 1.0 );
    float sl = ( 0.091 * cos( xx * 1.3 + seed ) + 0.111 * cos( xx * 3.7 + 1.0 ) ) * 5.0 / ( A * 0.37 );
    col += C_GOOD * 1.4 * ln( ( s.y - y ) / sqrt( 1.0 + sl * sl ), 0.004, px ) + C_DIM * 0.9 * ln( s.y - 0.13, 0.0, px );
  }
}

void scan( vec2 s, float A, float px, float t, float seed, inout vec3 col ) {
  vec2 q = s - vec2( A > 1.3 ? A * 0.13 : 0.0, -0.01 ); float l = length( q ), R = 0.41, ang = atan( q.y, q.x );
  float inside = 1.0 - smoothstep( R, R + px, l );
  col += C_LINE * 0.6 * ln( abs( fract( l * 3.0 / R + 0.5 ) - 0.5 ) * R / 3.0, 0.0015, px ) * step( l, R + 0.01 );
  col += C_LINE * 0.28 * inside * max( ln( q.x, 0.0, px ), ln( q.y, 0.0, px ) );
  col += C_LINE * 0.8 * ln( abs( fract( ang / 0.2617994 + 0.5 ) - 0.5 ) * 0.2617994 * l, 0.002, px ) * step( R, l ) * step( l, R + 0.028 );
  // the sweep: once round in six and a half seconds, the way a clock's hand goes, what it passed fading behind it
  float sw = seed * TAU - t * TAU / 6.5, back = mod( ang - sw, TAU );
  col += C_LINE * inside * ( 0.5 * exp( -back * 1.5 ) + 1.3 * ln( min( back, TAU - back ) * l, 0.001, px ) );
  for ( int i = 0; i < 5; i++ ) {
    float fi = float( i ), ba = hash1( fi + seed * 13.0 ) * TAU + t * 0.01, bb = mod( ba - sw, TAU );
    vec2 bp = vec2( cos( ba ), sin( ba ) ) * R * ( 0.25 + 0.66 * hash1( fi * 3.7 + seed * 5.0 + 1.0 ) );
    col += ( i == 0 ? C_AMB : C_INK ) * 2.3 * exp( -bb * 0.7 ) * smoothstep( 0.0, 0.12, bb ) * disc( length( q - bp ), 0.014, px );
  }
  float x0 = -A * 0.5 + 0.07;
  stamp( s, vec2( x0, 0.36 ), 0.08, label( 4.0 ), 9.0, C_INK );
  if ( A > 1.3 ) {
    stamp( s, vec2( x0, 0.02 ), 0.058, label( 33.0 ), 9.0, C_LINE * 1.4 ); number( s, vec2( x0, -0.07 ), 0.085, 5.0, 1, C_AMB * 1.4 );
    stamp( s, vec2( x0, -0.34 ), 0.058, label( 10.0 ), 9.0, C_LINE * 1.4 ); number( s, vec2( x0, -0.44 ), 0.085, 40.0 + 20.0 * floor( 2.0 * hash1( floor( t / 9.0 ) ) ), 3, C_INK );
  }
}

void logShow( vec2 s, float A, float px, float t, float seed, inout vec3 col ) {
  // a new line every 3.2 seconds: the old ones slide up one, then it types itself out along the bottom
  float rh = 0.094, per = 3.2, tt = t + seed * 40.0, k = floor( tt / per ), x = tt - k * per, slide = smoothstep( 0.0, 0.5, x );
  // (each line is one brightness all the way across: the oldest fade out whole as they climb, none is cut through)
  float x0 = -A * 0.5 + 0.07, y0 = -0.43, rr = ( s.y - y0 ) / rh, u = rr - slide + 1.0, j = floor( u ), top = 1.0 - smoothstep( 5.5, 7.5, j + slide - 1.0 );
  float first = floor( seed * 24.0 );
  if ( j >= 1.0 && rr < 9.0 && rr > 0.0 ) stamp( s, vec2( x0, y0 + ( j + slide - 1.0 ) * rh ), rh * 0.94, logLine( mod( ( k - j ) * 5.0 + first, 24.0 ) ), 99.0, C_LINE * 1.5 * top );
  float li = mod( k * 5.0 + first, 24.0 ), typed = min( 2.0 + floor( max( x - 0.55, 0.0 ) * 14.0 ), LEN[ int( li ) ] );
  if ( x > 0.5 ) {
    stamp( s, vec2( x0, y0 ), rh * 0.94, logLine( li ), typed * ADV + 0.12, C_INK * 1.25 );
    // the cursor, a small block after the last letter, swelling and fading
    vec2 c = vec2( x0 + rh * 0.94 * ( ( typed + 0.6 ) * ADV + 0.12 ), y0 + rh * 0.46 );
    col += C_INK * ( 0.5 + 0.9 * ( 0.5 + 0.5 * sin( t * 5.0 ) ) ) * band( s.x, c.x - rh * 0.17, c.x + rh * 0.17, px ) * band( s.y, c.y - rh * 0.3, c.y + rh * 0.3, px );
  }
}
`;

// 7 systems and 8 airlock: the status boards, 9 water: the tanks
const SHOWS_C = `
// does a lamp go amber just now? Now and then (about one slot in five: a board of five rows shows an amber lamp about a
// quarter of the time), for six seconds, easing in and out
float warnOf( float t, float row, float seed ) {
  float slot = 19.0 + row * 4.3, tt = t + seed * 97.0 + row * 5.1, k = floor( tt / slot ), x = tt - k * slot;
  return step( hash1( k * 7.3 + row * 1.9 + seed * 31.0 ), 0.2 ) * smoothstep( 4.0, 4.9, x ) * ( 1.0 - smoothstep( 10.0, 11.2, x ) );
}
void lamp( vec2 s, vec2 at, float px, vec3 c, inout vec3 col ) { float d = length( s - at ); col += c * 1.9 * disc( d, 0.027, px ) + c * 0.5 * ln( d - 0.043, 0.002, px ); }
void board( vec2 s, float A, float px, float t, float seed, float which, inout vec3 col ) {
  float x0 = -A * 0.5 + 0.07, rh = 0.142, top = 0.3, ri = floor( ( top - s.y ) / rh );
  stamp( s, vec2( x0, 0.36 ), 0.08, label( 6.0 + which ), 9.0, C_INK );
  col += C_DIM * 0.9 * ln( s.y - 0.325, 0.0, px ) * step( abs( s.x ), A * 0.5 - 0.07 );
  if ( ri >= 0.0 && ri < 5.0 ) {
    float yc = top - ( ri + 0.5 ) * rh, warn = warnOf( t, ri, seed ); vec3 lc = mix( C_GOOD, C_AMB, warn );
    lamp( s, vec2( x0 + 0.045, yc ), px, lc, col );
    stamp( s, vec2( x0 + 0.125, yc - 0.036 ), 0.072, label( 15.0 + which * 5.0 + ri ), 9.0, mix( C_INK, C_AMB * 1.5, warn ) );
    // its bar: sixteen lamps, the level wandering slowly and sagging while its lamp is amber
    float b0 = A * 0.05, b1 = A * 0.5 - 0.09, u = ( s.x - b0 ) / ( b1 - b0 );
    float lev = 0.68 + 0.14 * sin( t * 0.11 + ri * 2.1 + seed * 9.0 ) + 0.06 * sin( t * 0.8 + ri * 1.3 ) - 0.3 * warn;
    if ( u > 0.0 && u < 1.0 ) col += mix( C_DIM * 0.55, lc * 1.2, step( ( floor( u * 16.0 ) + 0.5 ) / 16.0, lev ) ) * band( fract( u * 16.0 ), 0.16, 0.84, px * 16.0 / ( b1 - b0 ) ) * band( s.y, yc - 0.028, yc + 0.028, px );
  }
}

void water( vec2 s, float A, float px, float t, float seed, inout vec3 col ) {
  float x0 = -A * 0.5 + 0.07, tw = A * 0.165, gap = A * 0.06;
  stamp( s, vec2( x0, 0.36 ), 0.08, label( 8.0 ), 9.0, C_INK );
  // three tanks, cut corners, their levels creeping and their surfaces lapping
  for ( int i = 0; i < 3; i++ ) {
    float fi = float( i ); vec2 q = s - vec2( x0 + 0.02 + tw * 0.5 + fi * ( tw + gap ), -0.02 ), hf = vec2( tw * 0.5, 0.27 ), e = hf - abs( q );
    float d = min( min( e.x, e.y ), ( e.x + e.y - 0.04 ) * 0.7071 );
    float lev = ( i == 2 ? 0.3 : 0.64 ) + 0.1 * sin( t * 0.07 + fi * 2.3 + seed * 8.0 );
    // (the surface: small waves, and the whole of it tipping slowly from side to side as the ship rides)
    float top = -hf.y + 2.0 * hf.y * lev + 0.012 * sin( q.x * 38.0 + t * 1.3 + fi ) + 0.006 * sin( q.x * 61.0 - t * 0.9 ) + 0.014 * q.x / hf.x * sin( t * 0.7 + fi * 0.5 );
    // (cold: the screen's blue. Hot: clear pale water under an amber surface line; an amber fill, dim as fills are,
    // read as mud. Waste: dull and greyed. lc is the surface line's colour, fc the fill's.)
    vec3 lc = i == 1 ? C_AMB * 1.2 : ( i == 2 ? C_WASTE : C_LINE ), fc = i == 1 ? C_HOT : lc;
    float within = smoothstep( 0.0, px * 1.5, d - 0.014 );
    col += C_LINE * ln( d, 0.004, px );
    col += within * ( fc * 0.36 * ( 1.0 - smoothstep( top - px, top + px, q.y ) ) * ( 0.5 + 0.5 * ( q.y + hf.y ) / ( 2.0 * hf.y ) ) + lc * 1.5 * ln( q.y - top, 0.003, px ) );
    // marks up its side, every tenth
    col += C_LINE * 0.8 * ln( abs( fract( ( q.y + hf.y ) / ( 0.2 * hf.y ) + 0.5 ) - 0.5 ) * 0.2 * hf.y, 0.0015, px ) * band( q.x, hf.x + 0.012, hf.x + 0.032, px ) * step( abs( q.y ), hf.y - 0.03 );
    stamp( vec2( q.x + hf.x, q.y + hf.y + 0.085 ), vec2( 0.0 ), 0.062, label( 25.0 + fi ), 9.0, C_INK * 0.9 );
  }
  // the filter's and the pump's lamps (the pump's breathing: it is running), and the flow
  float rx = x0 + 0.02 + 3.0 * ( tw + gap ) + 0.02;
  lamp( s, vec2( rx + 0.03, 0.2 ), px, mix( C_GOOD, C_AMB, warnOf( t, 1.0, seed ) ), col );
  stamp( s, vec2( rx + 0.1, 0.165 ), 0.066, label( 28.0 ), 9.0, C_INK );
  lamp( s, vec2( rx + 0.03, 0.05 ), px, C_GOOD * ( 0.62 + 0.38 * sin( t * 1.3 ) ), col );
  stamp( s, vec2( rx + 0.1, 0.015 ), 0.066, label( 29.0 ), 9.0, C_INK );
  stamp( s, vec2( rx, -0.2 ), 0.058, label( 32.0 ), 9.0, C_LINE * 1.4 );
  number( s, vec2( rx, -0.31 ), 0.1, 12.0 + floor( 3.0 * hash1( floor( t / 5.0 ) + seed ) ), 2, C_INK );
}
`;

const MAIN = `
void main() {
  vec3 col;
  if ( vUv.x > 1.5 ) {
    // a lamp: its colour, times how bright it is just now
    float mode = floor( vUv.x - 1.5 ), every = floor( vUv.y ), ph = fract( vUv.y ), b = 1.0;
    // (the tired strip: its own plate gives up only three tenths of what the room's light gives up. The glow pass lets
    // through only what is brighter than 2 (2.2 in the Kit Lab), all or nothing, and a strip is 3: were the plate to dip
    // as far as the room does, its halo would switch off whole and the dip would read as a blink. So the plate never
    // goes under 2.55, and the pool of light on the walls carries the dip.)
    if ( mode == 1.0 ) b = 1.0 - 0.3 * ( 1.0 - uFlick );
    else if ( mode == 2.0 ) { float x = mod( uTime + ph * every, every ); b = 0.12 + 0.88 * smoothstep( 0.0, 0.5, x ) * ( 1.0 - smoothstep( 1.5, 2.2, x ) ); }
    else if ( mode == 3.0 ) b = 0.62 + 0.38 * sin( ( uTime / every + ph ) * TAU );
    col = vData * b;
  } else {
    float prog = floor( vData.y ), seed = fract( vData.y ), A = floor( vData.z ) / 100.0, cut = fract( vData.z ) - 0.25, t = uTime;
    vec2 s = vec2( ( vUv.x - 0.5 ) * A, vUv.y - 0.5 );
    float px = max( fwidth( s.x ), fwidth( s.y ) ) * 0.75;
    // the panel: dark glass, a faint grid
    col = mix( uPanelB, uPanelA, vUv.y );
    vec2 gq = abs( fract( s * 8.0 + 0.5 ) - 0.5 ) / 8.0;
    col += C_DIM * 0.1 * max( ln( gq.x, 0.0, px ), ln( gq.y, 0.0, px ) );
    gT = vec3( 0.0 ); gTc = vec3( 0.0 );
    if ( prog < 1.5 ) survey( s, A, px, t, seed, col );
    else if ( prog < 2.5 ) chart( s, A, px, t, seed, col );
    else if ( prog < 3.5 ) rest( s, A, px, t, seed, col );
    else if ( prog < 4.5 ) drive( s, A, px, t, seed, col );
    else if ( prog < 5.5 ) scan( s, A, px, t, seed, col );
    else if ( prog < 6.5 ) logShow( s, A, px, t, seed, col );
    else if ( prog < 8.5 ) board( s, A, px, t, seed, prog - 7.0, col );
    else water( s, A, px, t, seed, col );
    // the words (one lookup)
    if ( gT.z > 0.0 ) {
      float w = gT.z * px * 0.7 / ( 2.0 * SPREAD ), a = texture2D( uSheet, gT.xy / 512.0 ).r;
      col += gTc * smoothstep( 0.5 - min( w, 0.45 ), 0.5 + min( w, 0.45 ), a ) * ( 1.0 - smoothstep( 0.3, 0.6, w ) );
    }
    // the frame: a thin line just inside the 8-sided edge, nothing outside it
    vec2 e = vec2( A * 0.5, 0.5 ) - abs( s ); float ed = min( min( e.x, e.y ), ( e.x + e.y - cut ) * 0.7071 );
    col *= smoothstep( 0.012, 0.022, ed );
    col += C_LINE * 0.4 * ln( ed - 0.024, 0.0025, px );
    // a slow band of refresh going down the glass
    col *= 1.0 + 0.07 * smoothstep( 0.1, 0.0, abs( fract( vUv.y + t * 0.05 + seed ) - 0.5 ) );
    // (the palette's deepening: away from grey by SAT, as the tone curve pales bright colours toward white)
    col = max( mix( vec3( dot( col, vec3( 0.2126, 0.7152, 0.0722 ) ) ), col, uSat ), 0.0 );
    col = max( col, uPanelB * 0.6 ) * vData.x;
  }
  gl_FragColor = vec4( col, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const liveFragment = (o) => [HEAD(o), SHOWS_A, SHOWS_B, SHOWS_C, MAIN].join('\n');
