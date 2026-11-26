// THE HEX PICTURE: a second, calmer electric picture, a hexagon wall behind and light beams in front. The game's maker,
// 2026-11-26, of the Electric picture (src/music/electric.js, kept as it is to compare): "it might be too busy ... it
// might be better if there were fewer effects ... can you do one where instead of the bass fire, the bass fills in the
// center portions of the hex grid. And maybe the pads also do laser but they are wider and more like spotlights. Maybe
// the lightning can be an effect in the hex grid that runs out like a strike following the hex outlines. That way its
// the hex background with 3 effects and the laser harp foreground with the other two."
//
// Five effects, each in its part's colour, in two layers:
//   behind, the hexagon grid:
//     beat    the hexagon outlines lit by the drums, exactly Electric's (the shared piece FRAG_BEAT)
//     bass    a note fills the INSIDES of hexagons with light (the outlines are the beat's, the middles the bass's): a
//             column of them standing up from the floor, low notes toward the left and high toward the right, as
//             Electric's tongues stood; on as the note starts, held while it holds, gone as it ends; taller and
//             brighter the louder. The brightest note at each hexagon, not their sum, and no flare at the start, so a
//             bass playing sixteenths holds a steady fill instead of blinking.
//     lead    a lightning strike running down along the hexagons' outlines from the top of the picture: a zigzag down
//             the edges (a slanted edge, a straight-down edge, a row at a time, left or right as it falls), starting
//             across the top by the note (low toward the left, high toward the right); it runs out in a moment as the
//             note starts, stays for the note's length (the same path all through: it does not re-strike), and is
//             longer and thicker the louder. No ball and no ring.
//   in front, lasers:
//     melody  the laser harp, exactly Electric's (the shared piece FRAG_MEL)
//     pads    a wide, soft-edged beam for each note of the chord, a spotlight, from the harp's own point below the
//             picture, across the top by the note (the pads' notes spread over the harp's width, so the two read as one
//             family); fading in and out over a few tenths of a second, lasting the chord's length, with a soft pool
//             of light where it meets the top.
//
//   hexMaterial(THREE, o?)   a three.js ShaderMaterial of the picture, as electricMaterial is (o.aspect, o.px)
//   hexUniforms(f, U, o?)    puts a tap frame into its uniforms: the same function as Electric's, the same uniforms
//                            (the material's userData.state); hexState(o?) makes them
//   HEX_SHADER               { vertex, fragment }
import { FRAG_HEAD, FRAG_OPEN, FRAG_BEAT, FRAG_MEL, FRAG_END, SLOTS, pictureMaterial, electricState, electricUniforms, ELECTRIC_SHADER } from './electric.js';

export const hexState = electricState, hexUniforms = electricUniforms;
// How the bass's "fills in the center portions of the hex grid" is read: 'insides' (as built: the insides of hexagons,
// placed by the note) or 'middle' (the hexagons in the middle of the picture, one place for every note); the game's
// maker is asked which (shots/electric-2/QUESTIONS.md). Only the shader's text changes.
export const BASS_READING = 'insides';

const FRAG_HEX_BASS = `  // ── BASS: the hexagons' insides filling with light, a column of them a note ──
  float bassF = 0.0;
  for ( int i = 0; i < ${SLOTS.bass}; i++ ) {
    vec4 d = uBass[i]; if ( d.w <= 0.0 ) continue;
    float idx = floor( d.x ), age = d.y, v = d.w;
    float x = 0.16 + ( A - 0.32 ) * idx / SPAN_BASS;
    // (on in a few hundredths of a second, held, then gone smoothly over the note's last light)
    float life = held( age, d.z, 2.5 ) * ss( 0.0, 0.07, age ) * ss( d.z + 0.35, d.z, age );
${BASS_READING === 'middle' ? `    // (the other reading: the hexagons in the middle of the picture, one place for every note, wider the louder)
    float rr = 0.1 + 0.18 * v, k = ss( rr + 0.02, rr - 0.08, length( hc - mid ) );
    bassF = max( bassF, life * v * k );` : `    float tall = 0.16 + 0.34 * v;
    float k = ss( HEX * 1.05, HEX * 0.45, abs( hc.x - x ) ) * ss( tall + 0.02, tall - 0.1, hc.y );
    bassF = max( bassF, life * v * k * ( 1.0 - 0.4 * clamp( hc.y / tall, 0.0, 1.0 ) ) );`}
  }
  if ( bassF > 0.0 ) {
    // (inside the outline, a hair of dark between: the fill and the beat's line stay two things)
    float cell = ss( 0.45, 0.3, he ), glowIn = 0.85 + 0.3 * vnoise( p * 11.0 + vec2( t * 0.4, cid * 7.0 ) );
    col += mix( dBass, cBass, 0.45 ) * bassF * cell * glowIn * 1.05;
    white += bassF * bassF * cell * 0.05;
  }
`;

const FRAG_HEX_LEAD = `  // ── LEAD: a lightning strike running down the hexagons' outlines ──
  vec2 qh = ( p - mid ) / HEX;                       // p in hexagon units, as the field is laid out
  float rowTop = floor( 0.5 / HEX / 0.8660254 ) + 1.0;   // the row of hexagons just above the picture
  for ( int i = 0; i < ${SLOTS.lead}; i++ ) {
    vec4 d = uLead[i]; if ( d.w <= 0.0 ) continue;
    float idx = floor( d.x ), sd = fract( d.x ), age = d.y, v = d.w;
    float x0 = 0.16 + ( A - 0.32 ) * idx / SPAN_LEAD;
    if ( abs( p.x - x0 ) > 0.85 ) continue;
    float life = held( age, d.z, 14.0 ) * ss( d.z + 0.15, d.z, age );
    // (it starts at the top corner of the hexagon above the picture nearest its place)
    float off = mod( rowTop, 2.0 ) * 0.5;
    vec2 P = vec2( floor( ( x0 - mid.x ) / HEX - off + 0.5 ) + off, rowTop * 0.8660254 + 0.5773503 );
    // (runs out in about a seventh of a second, a row of hexagons at a time; longer the louder)
    float rows = 4.0 + 5.0 * v, grown = ss( 0.0, 0.16, age ) * rows * 2.0, ds = 9.0, lr = sd < 0.485 ? -1.0 : 1.0;
    for ( int j = 0; j < 9; j++ ) {
      float fj = float( j );
      // (a row: a slanted edge down to the left or the right, then the straight-down edge: always on an outline; it
      // keeps its way for a few rows and then turns, as lightning wanders)
      if ( j > 0 && h21( vec2( fj * 1.7 + 0.3, sd * 23.0 + idx ) ) < 0.4 ) lr = -lr;
      vec2 b = P + vec2( 0.5 * lr, -0.2886751 ), c = b + vec2( 0.0, -0.5773503 );
      float g1 = clamp( grown - fj * 2.0, 0.0, 1.0 ), g2 = clamp( grown - fj * 2.0 - 1.0, 0.0, 1.0 );
      if ( g1 > 0.0 ) ds = min( ds, seg( qh, P, mix( P, b, g1 ) ) );
      if ( g2 > 0.0 ) ds = min( ds, seg( qh, b, mix( b, c, g2 ) ) );
      P = c;
    }
    float dp = ds * HEX, w = px * ( 1.3 + 1.6 * v );
    float core = exp( -sq( dp / w ) ), glow = 0.0035 / ( dp + 0.008 ) + exp( -sq( dp / 0.02 ) ) * 0.55;
    // (alive as lightning is, but gently: no blinking)
    float flick = 0.9 + 0.2 * vnoise( vec2( t * 7.0 + sd * 40.0, idx ) );
    col += ( dLead * glow * 0.9 + cLead * core * 1.2 ) * life * v * flick * ( 1.0 + 0.6 * exp( -age * 8.0 ) );
    white += life * v * core * 0.8 * flick;
  }
`;

const FRAG_HEX_PADS = `  // ── PADS: wide soft beams, spotlights, in the harp's fan ──
  float uf = u / SPAN_MEL;                            // across the harp's fan at the top of the picture, 0..1
  for ( int i = 0; i < ${SLOTS.pads}; i++ ) {
    vec4 d = uPad[i]; if ( d.w <= 0.0 ) continue;
    float idx = floor( d.x ), sd = fract( d.x ), age = d.y, v = d.w;
    float life = held( age, d.z, 3.0 ) * ss( 0.0, 0.3, age ) * ss( d.z + 0.6, d.z, age );
    float c = idx / SPAN_PADS + 0.006 * sin( t * 0.45 + sd * 20.0 );   // (a slow sway, as a spotlight on a stand)
    float dd = uf - c;
    if ( abs( dd ) > 0.2 ) continue;
    float beam = exp( -sq( dd / 0.03 ) ), haze = exp( -sq( dd / 0.075 ) );
    // (brighter low down, near the lamp; motes in the light drifting slowly)
    float motes = 0.85 + 0.3 * vnoise( vec2( dd * 60.0, p.y * 5.0 - t * 0.25 + sd * 9.0 ) );
    float a = life * v * top * ( beam * 0.34 * motes + haze * 0.07 ) * ( 0.65 + 0.35 * ( 1.0 - p.y ) );
    float spot = exp( -sq( dd * wid / 0.07 ) - sq( ( p.y - 0.955 ) / 0.03 ) ) * life * v;
    col += mix( dPad, cPad, 0.5 ) * a + cPad * spot * 0.22;
    white += beam * beam * life * v * top * 0.03;
  }
`;

const FRAG = FRAG_HEAD + FRAG_OPEN + FRAG_BEAT + FRAG_HEX_BASS + FRAG_HEX_LEAD + FRAG_MEL + FRAG_HEX_PADS + FRAG_END;

export const hexMaterial = (THREE, o = {}) => pictureMaterial(THREE, FRAG, 'music-hex', o);
export const HEX_SHADER = { vertex: ELECTRIC_SHADER.vertex, fragment: FRAG };
