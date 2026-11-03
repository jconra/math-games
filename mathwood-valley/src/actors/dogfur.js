// FUR: a shader over an animal's painted coat, no shells, no extra geometry: still one draw an animal. It began on the
// dogs (dogcoat.js, dogbreeds.js FUR) and the farm animals wear the same one, with their own numbers (ANIMAL_FUR below).
// The town is chunky and faceted, so the facets stay as they are and the fur is only in the surface:
//
//   STRANDS   fine streaks of light and dark (2 to 5 mm wide on a dog this size) laid along the way the hair lies:
//             head to tail over the body and the head, down the legs, out along the tail and the ears. They come from
//             smooth noise in the dog's own space at rest, stretched along the hair (no UVs needed: the dogs have none
//             of their own), and only scale the coat's colour, so a marking's edge (a blaze, a sock, a spot) stays as
//             crisp as the face it is painted on. Each strand is darker at its root and lighter at its tip; the
//             underside and the creases a little darker. Far off (a strand under a pixel) they fade out, so nothing
//             shimmers.
//   SOFT LIGHT the sun's light wrapped a little round the sides (softer the softer the coat) and a sheen where the
//             surface turns away from the eye: light caught along the fur's edge.
//
// What the shader reads, per corner (worked out once a dog, dogkind.js furAttrs): furP, where the corner sits on the
// dog at rest in withers heights; furD, the way the hair lies there (xyz; zero where there is no fur: the eyes, the
// nose, a collar) and how much it is underneath (w).
//
//   FUR_TIER.on        false: animals made from now on get no fur at all (the game's lowest quality tier: the material
//                      is the plain one, exactly as before)
//   FUR_SWITCH.value   1 / 0: the fur shown or not, on every furred animal at once (the Dog Lab's switch; no recompile)
//   furMaterial(mat, fur) -> mat   the patch put on a dog's (skinned, vertex-coloured) MeshStandardMaterial; fur:
//                      fillFur's numbers (dogbreeds.js FUR: length, softness, strength, sheen)
//   setFur(mat, fur)   new numbers on a furred material (the lab's sliders: no rebuild)
//
// THE FARM ANIMALS (ANIMAL_FUR: one line a kind; dogkind.js furAnimal measures the corners, animals.js calls it as a kind
// loads). A dog's numbers, and on top of them a little more of the shader, in a program of its own (a dog's program is
// left exactly as it was):
//   MOTTLE     broad soft patches of lighter and darker a hand or two across. A strand fades out a few metres off and
//              a cow is bigger than a dog and usually further away, so this is what still breaks up the flat colour at
//              herd distance. A few sines: too broad to shimmer, and cheap.
//   WOOL       thick curls where a corner is marked as wool (furD twice its length, one way all over; no extra attribute):
//              small balls on two warped grids, lit from above, dark in the gaps (a hash each: cheaper than the strands'
//              noise). They fade out as a strand does, sooner than a curl gets under a pixel.
// What isn't coat (by its painted colour: hooves, horns, noses, udders, eyes; on the farm pack, by the hoof's bone) gets no
// fur. The cost, measured with a herd in view (RX 7900 XT, card's clock): about 36 to 50 trillionths of a second a pixel of animal
// (the wool the dearest), under a tenth of a millisecond at 1600 x 900 however close the herd.
//
// WebGL1-safe: no texture lookups, no loops, derivatives through the OES extension three asks for.
import * as THREE from 'three';

export const FUR_TIER = { on: true };
export const FUR_SWITCH = { value: 1 };

// each farm animal's coat: the dogs' four numbers (dogbreeds.js FUR), then
//   fine    the strands' fineness, on the animal's real size: a strand is about 1 / (fine * 100..190) metres wide
//   mottle  how strong the broad patches are; patch  how many of them to the metre
//   wool    0..1 how much the curls show; curl  how many to the metre; woolOn  the painted colours that are wool
//   bare    the painted colours that get no fur (linear r, g, b, as the model's vertices have them)
const EYE = [[0.008, 0.008, 0.008]], SHINE = (v) => [[v, v, v]];
const HORN = [0.412, 0.357, 0.176], HOOF = [0.173, 0.098, 0.031];
export const ANIMAL_FUR = {
  // (the pack's brown cow and black bull: short summer coats. Bare: the horns, the hooves, the nose and udder)
  cow:      { length: 0.25, softness: 0.3, strength: 0.75, sheen: 0.4, fine: 0.4, mottle: 0.16, patch: 4.5, bare: [HORN, HOOF, [0.427, 0.176, 0.082], ...EYE, ...SHINE(1)] },
  bull:     { length: 0.2, softness: 0.25, strength: 0.75, sheen: 0.55, fine: 0.4, mottle: 0.2, patch: 4, bare: [HORN, HOOF, [0.043, 0.031, 0.02], ...EYE, ...SHINE(1)] },
  // (the paddock's and the homestead's black and white cow)
  farmCow:  { length: 0.25, softness: 0.3, strength: 0.65, sheen: 0.4, fine: 0.4, mottle: 0.1, patch: 4.5, bare: [[0.8, 0.176, 0.216], ...EYE, ...SHINE(0.851)] },
  // (woolly: the white is the fleece; the black face and legs are short hair)
  sheep:    { length: 0.15, softness: 0.7, strength: 0.3, sheen: 0.3, fine: 1, mottle: 0.07, patch: 8, wool: 1, curl: 32, woolOn: [[0.8, 0.8, 0.8]], bare: EYE },
  // (bristle, and faint: a pig is mostly skin. Long thin strands, little soft light; the snout has the body's colour)
  pig:      { length: 0.55, softness: 0.15, strength: 0.32, sheen: 0.25, fine: 1, mottle: 0.05, patch: 5, bare: [[0.2, 0.086, 0.047], ...EYE, ...SHINE(0.851)] },
  // (rough and dull; the pale belly and muzzle are coat too)
  donkey:   { length: 0.45, softness: 0.5, strength: 0.7, sheen: 0.3, fine: 0.5, mottle: 0.12, patch: 4.5, bare: [[0.059, 0.055, 0.047], [0.047, 0.035, 0.02], ...EYE, ...SHINE(0.749)] },
  // (the paddock's horse: flat, and not one of the Horse Lab's coats. Sleek: short, with more shine)
  farmHorse: { length: 0.15, softness: 0.25, strength: 0.6, sheen: 0.55, fine: 0.45, mottle: 0.1, patch: 4, bare: [...EYE, ...SHINE(0.851)] },
};

const VERT_PARS = /* glsl */`
attribute vec3 furP;
attribute vec4 furD;
varying vec3 vFurP;
varying vec4 vFurD;
`;
const FRAG_PARS = /* glsl */`
uniform vec4 uFur;
uniform float uFurOn;
varying vec3 vFurP;
varying vec4 vFurD;
float furK = 0.0, furSoft = 0.0, furSheen = 0.0, furStr = 0.5;
float furHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
float furNoise( vec3 x ) {
  vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( furHash( i ), furHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( furHash( i + vec3( 0.0, 1.0, 0.0 ) ), furHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
              mix( mix( furHash( i + vec3( 0.0, 0.0, 1.0 ) ), furHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( furHash( i + vec3( 0.0, 1.0, 1.0 ) ), furHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z );
}
`;
// (the strands: where the coat's colour is read)
const FRAG_COLOR = /* glsl */`
{
  float furOn = uFurOn * step( 0.2, dot( vFurD.xyz, vFurD.xyz ) );
  vec3 fd = normalize( vFurD.xyz + vec3( 1e-5 ) );
  float fA = mix( 190.0, 100.0, uFur.x );          // strands across a withers height: about 2 mm (short) .. 5 mm (long)
  float fS = mix( 5.0, 16.0, uFur.x );             // and how much longer than wide
  vec3 fq = vFurP * fA; float fa = dot( fq, fd );
  vec3 nq = fq - fd * fa + fd * ( fa / fS );
  vec3 fw = fwidth( nq ); float fpx = max( max( fw.x, fw.y ), fw.z );
  float fade = furOn * ( 1.0 - smoothstep( 0.45, 1.1, fpx ) );
  float fs = 0.5, ftip = 0.5;
  if ( fade > 0.001 ) {
    float n1 = furNoise( nq ), n2 = furNoise( nq * 2.17 + vec3( 7.3, 1.1, 4.7 ) );
    fs = mix( n1, n2, 0.4 );
    ftip = fract( fa / fS * 0.6 + n1 * 3.0 );
  }
  float fk = uFur.z * fade;
  float lum = 1.0 + fk * ( ( fs - 0.5 ) * mix( 1.3, 0.65, uFur.y ) + ( smoothstep( 0.15, 0.95, ftip ) - 0.5 ) * 0.4 );
  lum *= 1.0 - furOn * uFur.z * 0.28 * vFurD.w;   // (darker roots underneath and in the creases: kept far off too)
  diffuseColor.rgb *= max( lum, 0.0 );
  furK = furOn; furSoft = uFur.y; furSheen = uFur.w * furOn; furStr = mix( 0.5, fs, fade * uFur.z );
}
`;
// (a farm animal's: goes in before the strands' colour is laid on, so lum has it. uCoat: mottle, patches a metre, wool,
// curls a metre; uCoatM: from furP back to metres)
const COAT_PARS = /* glsl */`
uniform vec4 uCoat;
uniform float uCoatM;
// (one curl of the wool: a ball in each cell of a grid, of a size and a place a little its own, and nearly gone by the
// cell's edge. x: how far up the ball, 0 in the gap .. 1 over most of it; y: how far up its side, for the light from above)
vec2 woolBall( vec3 q ) {
  vec3 id = floor( q ), f = fract( q ) - 0.5; float h = furHash( id );
  f.xy += ( vec2( h, fract( h * 7.3 ) ) - 0.5 ) * 0.18;
  float rad = 0.46 + 0.08 * fract( h * 13.1 );
  return vec2( 1.0 - smoothstep( 0.55, 1.0, length( f ) / rad ), f.y / rad );
}
`;
const COAT_LUM = /* glsl */`
  vec3 cm = vFurP * uCoatM, cp = cm * uCoat.y;
  lum *= 1.0 + furOn * uCoat.x * sin( cp.z * 2.1 + 1.7 * sin( cp.y * 2.9 + cp.x * 1.3 ) ) * sin( cp.y * 2.3 + cp.x * 1.9 + 1.3 * sin( cp.z * 1.7 ) );
  float woolK = uCoat.z * furOn * step( 2.0, dot( vFurD.xyz, vFurD.xyz ) );
  if ( woolK > 0.001 ) {
    vec3 wq = cm * uCoat.w;
    vec3 wf = fwidth( wq ); float wpx = max( max( wf.x, wf.y ), wf.z );
    float wfade = woolK * ( 1.0 - smoothstep( 0.15, 0.5, wpx ) );
    if ( wfade > 0.001 ) {
      vec3 wr = wq + sin( wq.zxy * 0.9 + vec3( 1.3, 4.1, 2.7 ) );
      vec2 wa = woolBall( wr ), wb = woolBall( wr + 0.5 );   // (two grids, one in the gaps of the other)
      if ( wb.x > wa.x ) wa = wb;
      lum *= 1.0 + wfade * ( ( wa.x - 1.0 ) * 0.25 + wa.x * wa.y * 0.13 );
    }
  }
`;
const DOG_LUM_END = '  diffuseColor.rgb *= max( lum, 0.0 );\n';
if (!FRAG_COLOR.includes(DOG_LUM_END)) throw new Error('fur: the coat has lost its place in the shader');
const COAT_COLOR = FRAG_COLOR.replace(DOG_LUM_END, COAT_LUM + DOG_LUM_END);
// (the light: the sun's wrapped round the sides, the gloss a little duller, a sheen at the edge)
const LIGHT_HOOK = /* glsl */`
#include <lights_physical_pars_fragment>
void RE_Direct_Fur( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  ReflectedLight plain = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
  RE_Direct_Physical( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, plain );
  float w = furK * ( 0.12 + 0.38 * furSoft );
  float nl = dot( geometryNormal, directLight.direction );
  reflectedLight.directDiffuse += directLight.color * saturate( ( nl + w ) / ( 1.0 + w ) ) * BRDF_Lambert( material.diffuseColor );
  float rim = pow( 1.0 - saturate( dot( geometryNormal, geometryViewDir ) ), 3.0 );
  // (the sheen in the coat's own colour, a touch of grey so a black dog's edge still catches it; the gloss and the
  // sheen broken up by the strands: on a dark coat that is where the strands show)
  float strand = mix( 1.0, 0.55 + 0.9 * furStr, furK );
  vec3 sheenC = material.diffuseColor * 0.8 + vec3( 0.012 );
  reflectedLight.directSpecular += ( plain.directSpecular * ( 1.0 - 0.45 * furK ) + directLight.color * sheenC * rim * saturate( ( nl + 0.6 ) / 1.6 ) * furSheen * 0.9 ) * strand;
}
#undef RE_Direct
#define RE_Direct RE_Direct_Fur
`;
const FRAG_RIM = /* glsl */`
outgoingLight *= 1.0 + 0.15 * furSheen * pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 3.0 );
`;

export function furMaterial(mat, fur) {
  if (!FUR_TIER.on || !mat) return mat;
  const coat = fur.fine !== undefined;   // (a farm animal's numbers: ANIMAL_FUR)
  const u = { uFur: { value: new THREE.Vector4() }, uFurOn: FUR_SWITCH, ...(coat ? { uCoat: { value: new THREE.Vector4() }, uCoatM: { value: 1 } } : {}) };
  mat.userData.furU = u; mat.userData.fur = { ...fur };
  mat.extensions = { ...(mat.extensions || {}), derivatives: true };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFurP = furP; vFurD = furD;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS + (coat ? COAT_PARS : ''))
      .replace('#include <lights_physical_pars_fragment>', LIGHT_HOOK)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + (coat ? COAT_COLOR : FRAG_COLOR))
      .replace('#include <opaque_fragment>', FRAG_RIM + '#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => (coat ? 'dogfur1coat1' : 'dogfur1');
  // (the town's hill shade and indoor light go on over this, not instead of it: world/valley.js sunShadeAll)
  mat.userData.shadeChain = true;
  setFur(mat, fur);
  mat.needsUpdate = true;
  return mat;
}
export function setFur(mat, fur) {
  const u = mat && mat.userData.furU; if (!u || !fur) return;
  mat.userData.fur = { ...fur };
  u.uFur.value.set(fur.length, fur.softness, fur.strength, fur.sheen);
  if (u.uCoat) { u.uCoat.value.set(fur.mottle || 0, fur.patch || 1, fur.wool || 0, fur.curl || 1); u.uCoatM.value = 1 / fur.fine; }
}
