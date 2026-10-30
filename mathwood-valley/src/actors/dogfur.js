// DOG FUR: a shader over the dogs' painted coats (dogcoat.js), no shells, no extra geometry: still one draw a dog.
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
//   FUR_TIER.on        false: dogs made from now on get no fur at all (the game's lowest quality tier: the material
//                      is the plain one, exactly as before)
//   FUR_SWITCH.value   1 / 0: the fur shown or not, on every furred dog at once (the Dog Lab's switch; no recompile)
//   furMaterial(mat, fur) -> mat   the patch put on a dog's (skinned, vertex-coloured) MeshStandardMaterial; fur:
//                      fillFur's numbers (dogbreeds.js FUR: length, softness, strength, sheen)
//   setFur(mat, fur)   new numbers on a furred material (the lab's sliders: no rebuild)
//
// WebGL1-safe: no texture lookups, no loops, derivatives through the OES extension three asks for.
import * as THREE from 'three';

export const FUR_TIER = { on: true };
export const FUR_SWITCH = { value: 1 };

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
  const u = { uFur: { value: new THREE.Vector4() }, uFurOn: FUR_SWITCH };
  mat.userData.furU = u; mat.userData.fur = { ...fur };
  mat.extensions = { ...(mat.extensions || {}), derivatives: true };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFurP = furP; vFurD = furD;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('#include <lights_physical_pars_fragment>', LIGHT_HOOK)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <opaque_fragment>', FRAG_RIM + '#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'dogfur1';
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
}
