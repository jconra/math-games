// SHADER WEATHERING: moss, grime and edge wear worked out per pixel on the graphics card, every frame, from facts the
// shader already has (where the pixel is in the world, which way its surface faces, how tucked-in it is) plus a noise
// texture to break the result up into natural patches. Nothing is painted by hand: move a slider and the shader
// re-decides where moss grows on every board at once, which is why the same trick carries to any model.
//
// How it is wired in: three.js builds its MeshStandardMaterial shader from named chunks (#include <map_fragment> ...).
// onBeforeCompile hands us that shader's source text before it is compiled, and we splice our own lines in after the
// chunks we care about:
//   vertex:    after <project_vertex>       pass the world position (and the baked AO, the box numbers) to the pixels
//   fragment:  after <map_fragment>         the colour: board tint or paint, edge wear, grime, moss, darker bevelled edges
//              after <roughnessmap_fragment> moss is matte, paint is satin, worn edges are polished
//              after <normal_fragment_maps> the moss gets a lumpy surface (a bump from its clump height), and the
//                                           bevelled edges a rounded-off one
//              after <aomap_fragment>       ambient occlusion darkens only the sky light, not the sun
//              after <dithering_fragment>   "show mask": replace the colour with one mask in false colour
// Everything stays WebGL1-safe (GLSL ES 1.0: texture2D, no arrays, no integer tricks).
//
// The sliders are uniforms shared by every patched material (the U object below), so one slider moves them all.

import * as THREE from 'three';

const col = (hex) => new THREE.Color(hex);
export const U = {
  uNoise: { value: null },
  uMask: { value: 0 },
  // moss
  uMossAmt: { value: 0 }, uMossUp: { value: 0.75 }, uMossLow: { value: 0.6 }, uMossShade: { value: 0.9 }, uMossTuck: { value: 0.7 },
  uMossHeight: { value: 1.3 }, uMossBreak: { value: 0.7 }, uMossSoft: { value: 0.12 }, uPatchScale: { value: 1 / (4 * 1.4) },
  uMossColor: { value: col('#56702a') }, uMossBump: { value: 0.7 }, uShadeDir: { value: new THREE.Vector3(0, 0, -1) },
  // grime
  uGrimeAmt: { value: 0 }, uStreakLen: { value: 2.2 }, uStreakScale: { value: 5 / 8 }, uSplashH: { value: 0.7 },
  uCornerDirt: { value: 0.6 }, uGrimeSoft: { value: 0.12 }, uGrimeColor: { value: col('#3a352e') }, uMudColor: { value: col('#5a4430') },
  // edge wear
  uEdgeAmt: { value: 0 }, uEdgeWidth: { value: 0.018 }, uEdgeBreak: { value: 0.6 }, uPaintChip: { value: 0.35 },
  // ambient occlusion: strength (above 1 it darkens harder: ao^strength), and how much it darkens the sunlight too
  uAOAmt: { value: 1 }, uAOSun: { value: 0 },
  // bevelled edges (boards and stones): how much darker a face gets toward its edges, over how wide a band (metres, but
  // never more than 0.6 of the face's narrower half, so a thin board and a big stone both look right), and how far the
  // light is bent there as if the edge were rounded off
  uEdgeDark: { value: 0.5 }, uEdgeDarkW: { value: 0.04 }, uBevel: { value: 0.6 },
  // logs shaded round (how far the light rolls round them), the band of shade under an eave (strength), how much moss
  // likes the cracks between boards and shakes
  uLogRound: { value: 0.9 }, uEaveDark: { value: 0 }, uMossCrack: { value: 0.7 },
  // silver-grey sun-bleached streaks along the logs (amount), and the dirt band along the bottom of everything
  uBleach: { value: 0 }, uDirtBand: { value: 0 },
  // how much of the sky's blue the fill light keeps on the cabin (0: all of it; 1: the same light, grey). Old wood's
  // tops tilt up to the sky, and a strong blue fill reads as a sheen on them
  uSkyGrey: { value: 0 },
};

// mask codes for uMask (the "show mask" menus)
export const MASKS = {
  off: 0,
  moss: 1, mossUp: 2, mossLow: 3, mossShade: 4, mossTuck: 5, mossNoise: 6, mossRain: 7,
  grime: 11, streaks: 12, splash: 13, dirt: 14,
  wear: 21, edgeDist: 22, rim: 23,
  ao: 31,
};

const VERT_PARS = /* glsl */`
varying vec4 vWPosAO;            // xyz: world position, w: baked ambient occlusion (1 = open sky)
#ifdef W_AO
attribute float aAO;
#endif
#ifdef W_BOX
attribute vec4 aLocalTop;        // xyz: where in its own box, w: height of the roof edge above
attribute vec4 aHalf;            // xyz: the box's half size, w: open to rain (baked)
varying vec4 vLocalTop;
varying vec4 vHalf;
#endif
#ifdef W_TINT
attribute vec4 aTintPaint;       // rgb: board tint (or paint colour), a: painted
varying vec4 vTintPaint;
#endif
`;
const VERT_MAIN = /* glsl */`
vWPosAO.xyz = (modelMatrix * vec4(transformed, 1.0)).xyz;
#ifdef W_AO
vWPosAO.w = aAO;
#else
vWPosAO.w = 1.0;
#endif
#ifdef W_BOX
vLocalTop = aLocalTop; vHalf = aHalf;
#endif
#ifdef W_TINT
vTintPaint = aTintPaint;
#endif
`;

const FRAG_PARS = /* glsl */`
uniform sampler2D uNoise;
uniform float uMask;
uniform float uMossAmt, uMossUp, uMossLow, uMossShade, uMossTuck, uMossHeight, uMossBreak, uMossSoft, uPatchScale, uMossBump;
uniform vec3 uMossColor, uShadeDir;
uniform float uGrimeAmt, uStreakLen, uStreakScale, uSplashH, uCornerDirt, uGrimeSoft;
uniform vec3 uGrimeColor, uMudColor;
uniform float uEdgeAmt, uEdgeWidth, uEdgeBreak, uPaintChip;
uniform float uEdgeDark, uEdgeDarkW, uBevel, uLogRound, uEaveDark, uMossCrack, uBleach, uDirtBand, uSkyGrey;
uniform float uAOAmt, uAOSun, uFixedTop;
varying vec4 vWPosAO;
#ifdef W_BOX
varying vec4 vLocalTop;
varying vec4 vHalf;
#endif
#ifdef W_TINT
varying vec4 vTintPaint;
#endif
// TRIPLANAR: read the noise three times, projected along x, y and z, and blend by how much the surface faces each way.
// World-space noise needs no UVs, so it lines up across every board (and works on a model it has never seen).
vec4 wTri(vec3 p, vec3 w) { return texture2D(uNoise, p.zy) * w.x + texture2D(uNoise, p.xz) * w.y + texture2D(uNoise, p.xy) * w.z; }
// the false-colour ramp for "show mask": 0 navy, 0.5 magenta, 1 yellow
vec3 wRamp(float t) { t = clamp(t, 0.0, 1.0); return vec3(smoothstep(0.0, 0.6, t), 0.95 * smoothstep(0.4, 1.0, t), 0.38 + 0.55 * sin(t * 3.14159) - 0.33 * t); }
`;

// the colour work, right after the texture's colour is read
const FRAG_COLOUR = /* glsl */`
vec3 wP = vWPosAO.xyz;
vec3 wN = inverseTransformDirection(normalize(vNormal), viewMatrix);   // the surface's facing, in the world
vec3 wTw = wN * wN; wTw *= wTw; wTw /= (wTw.x + wTw.y + wTw.z);            // triplanar blend weights
float wAO = vWPosAO.w;
vec4 wBig = wTri(wP * uPatchScale, wTw);    // big soft patches (R), blotches (G)
vec4 wFine = wTri(wP * 0.9, wTw);           // moss cushions (A), grit (B): 1.1 m to a repeat
float wLum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
float wMoss = 0.0, wMossH = 0.0, wStreak = 0.0, wSplash = 0.0, wDirt = 0.0, wWear = 0.0, wBare = 0.0, wPaintVis = 0.0, wShow = -1.0;
float mUp = 0.0, mLow = 0.0, mShade = 0.0, mTuck = 0.0, mRain = 1.0, wEdge = 1.0, wRim = 0.0, wRimH = 0.0;
// what kind of part this is, from the tint's fourth number: painted (1), a round log (2), mortar or chinking (3), a
// stone laid in a wall (4), a roof shake (below 0: minus how much of it shows below the next course, metres)
float wKind = 0.0;
#ifdef W_TINT
  wKind = vTintPaint.a;
#endif
float wIsPaint = step(0.5, wKind) * step(wKind, 1.5), wIsLog = step(1.5, wKind) * step(wKind, 2.5), wIsMortar = step(2.5, wKind) * step(wKind, 3.5), wIsLaid = step(3.5, wKind);
float wShakeE = max(-wKind, 0.0), wSetBack = 0.0;

#ifdef W_GROUND
  // the ground: grass, worn to dirt where people walk and under the eaves (aTintPaint.r says how worn)
  float wDirtT = vTintPaint.r + (wBig.r - 0.5) * 0.55 + (wFine.b - 0.5) * 0.35;
  vec3 wDirtCol = vec3(0.15, 0.105, 0.07) * (0.65 + 0.7 * wFine.b + 0.3 * wBig.g);
  diffuseColor.rgb = mix(diffuseColor.rgb, wDirtCol, smoothstep(0.45, 0.62, wDirtT));
  if (uMask > 30.5) wShow = wAO;
#else

  // ── EDGE WEAR ─ how far is this pixel from its box's nearest edge? (each corner knows where it sits in its box, so
  // in between, the shader gets that exactly; of the three "distance to a side" numbers, one is ~0 (the face we are
  // on), the next smallest is the distance to the nearest edge)
  #ifdef W_BOX
    vec3 wD = vHalf.xyz - abs(vLocalTop.xyz);
    mRain = vHalf.w;
    float wMn = min(wD.x, min(wD.y, wD.z)), wMx = max(wD.x, max(wD.y, wD.z));
    wEdge = wD.x + wD.y + wD.z - wMn - wMx;
    float wTop = vLocalTop.w;
    #ifdef W_BEVEL
    {
      // BEVELLED EDGES: the face's own two directions (drop the one it looks along: its distance is ~0), how far this
      // pixel is from the edges along each, and a band that darkens toward them, curving in (brighter middle, darker
      // rim, darkest in the corners). The same band is a height that drops toward the edge (wRimH, metres): the normal
      // tilts over it, so the light catches a rounded edge without a single extra triangle.
      // The band's inner line wanders a little (ragged), and it is measured from a rectangle with rounded corners, so
      // the corners darken round, as on a worn stone or board.
      vec2 wF, wFH, wFP;
      if (wD.x <= wD.y && wD.x <= wD.z) { wF = wD.yz; wFH = vHalf.yz; wFP = vLocalTop.yz; }
      else if (wD.y <= wD.z) { wF = wD.xz; wFH = vHalf.xz; wFP = vLocalTop.xz; }
      else { wF = wD.xy; wFH = vHalf.xy; wFP = vLocalTop.xy; }
      float wW = max(min(uEdgeDarkW, 0.6 * min(wFH.x, wFH.y)), 0.0005) * (0.8 + 0.4 * wFine.b);
      if (wShakeE > 0.0) wW *= 0.5;                   // a shake: only a thin dark line along its sides (the gap)
      float wQ = min(length(max(wW - wF, 0.0)) / wW, 1.0);
      wRim = wQ * wQ;
      wRimH = -0.5 * uBevel * wW * wRim;
      // A LOG: round about its long axis (the longer of the face's two directions). Across it, the top and bottom
      // quarter darken, and the normal tilts as if over a cylinder, so the light rolls round it. (Its ends are the round
      // end-grain pictures.)
      if (wIsLog > 0.5 && min(wFH.x, wFH.y) * 2.5 < max(wFH.x, wFH.y)) {
        float wA = step(wFH.y, wFH.x);                 // 1: the face's second direction is the one round the log
        float wHa = mix(wFH.x, wFH.y, wA), wPa = mix(wFP.x, wFP.y, wA) / max(wHa, 0.001);
        wRim = max(wRim, 0.7 * smoothstep(0.76, 1.0, abs(wPa)));     // only the top and bottom eighth, softly
        wRimH = -0.5 * uLogRound * wHa * wPa * wPa;
      }
      // MORTAR AND CHINKING: set back between the stones or logs, so no lit lip: a shadow line along its top under the
      // stone or log over it, and otherwise its own light colour (from a distance a light web between the stones)
      if (wIsMortar > 0.5) {
        wRim = 0.0; wRimH = 0.0;
        wSetBack = 0.06 + 0.5 * (1.0 - smoothstep(0.0, 0.03, vHalf.y - vLocalTop.y));
      }
      // A STONE LAID IN A WALL: its top is seen only down in the joint, under the stone above: shaded, never a lit ledge
      if (wIsLaid > 0.5 && wD.y <= min(wD.x, wD.z) && vLocalTop.y > 0.0) wSetBack = 0.55;
      // A LOG's top and bottom are seen only down in the gap to the next log: in shadow, never a lit sliver
      if (wIsLog > 0.5 && wD.y <= min(wD.x, wD.z)) wSetBack = 0.7;
    }
    #endif
  #else
    float wTop = uFixedTop;
  #endif
  // a roof shake is open to the rain all over (the baked rain test is per corner, and would give each shake its own)
  float wShakeButt = 0.0;
  #ifdef W_BOX
  if (wShakeE > 0.0) { mRain = 1.0; wShakeButt = 1.0 - smoothstep(0.0, wShakeE * 0.9, vHalf.z - vLocalTop.z); }
  #endif
  float wWearT = 1.0 - wEdge / max(uEdgeWidth, 0.0005) + (wFine.g - 0.5) * 2.6 * uEdgeBreak;
  wWear = smoothstep(0.35, 0.65, wWearT) * uEdgeAmt;

  #ifdef W_TINT
    // paint chips off a wider band than bare wood wears, and in random flecks where the noise is high
    float wPainted = wIsPaint;
    float wChipT = 1.0 - wEdge / max(uEdgeWidth * 0.8, 0.0005) + (wFine.b - 0.5) * 3.0 * uEdgeBreak;
    float wChip = clamp(smoothstep(0.45, 0.6, wChipT) * uEdgeAmt + smoothstep(1.04 - uPaintChip * 0.4, 1.08 - uPaintChip * 0.4, wFine.b * 0.55 + wBig.g * 0.55) * step(0.001, uEdgeAmt), 0.0, 1.0);
    vec3 wWood = diffuseColor.rgb * mix(vTintPaint.rgb, vec3(0.9, 0.82, 0.74), wPainted);
    vec3 wPaint = vTintPaint.rgb * (0.9 + 0.45 * wLum);                  // the grain shows a little through the paint
    wPaintVis = wPainted * (1.0 - wChip);
    diffuseColor.rgb = mix(wWood, wPaint, wPaintVis);
  #else
    float wPainted = 0.0;
  #endif
  // worn bare edges: the grey, sun-baked surface rubbed through to lighter, fresher fibres
  wBare = wWear * (1.0 - wPaintVis);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.4 + vec3(0.02, 0.014, 0.006), wBare);
  // SUN-BLEACH on the logs: silver-grey streaks running along each log (noise stretched 8 to 1 along the wall), more of
  // them on the upper courses and on the walls facing the sun
  float wBl = 0.0;
  if (wIsLog > 0.5 && uBleach > 0.0) {
    float wAl = dot(wP.xz, vec2(-wN.z, wN.x));
    float wBn = texture2D(uNoise, vec2(wAl * 0.18, wP.y * 1.45)).g * 0.7 + texture2D(uNoise, vec2(wAl * 0.5, wP.y * 4.0)).b * 0.3;
    float wSunny = clamp(dot(wN, -uShadeDir) * 0.5 + 0.5, 0.0, 1.0);
    wBl = smoothstep(0.56, 0.7, wBn + 0.1 * smoothstep(0.8, 3.0, wP.y) + 0.06 * wSunny) * uBleach;
    float wL = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(wL) * vec3(1.08, 0.99, 0.86) * 1.4 + vec3(0.02, 0.016, 0.01), wBl);
  }

  // ── GRIME ─ rain runs off the roof edge and down the wall (streaks), splashes mud up from the ground (splash), and
  // dirt gathers where the air is still (the tucked-in corners: low AO)
  float wBelow = wTop - wP.y;                                              // metres under the drip edge
  float wVert = 1.0 - abs(wN.y);                                           // 1 on walls, 0 on floors and roofs
  float wAlong = dot(wP.xz, vec2(-wN.z, wN.x));                            // across the wall, metres
  float wCol = texture2D(uNoise, vec2(wAlong * uStreakScale * 0.31, 0.53)).r;       // each column's own run length
  float wSN = texture2D(uNoise, vec2(wAlong * uStreakScale, wP.y * 0.05)).g;       // noise stretched tall: streaks
  float wFade = 1.0 - wBelow / max(uStreakLen * (0.25 + 1.5 * (wCol - 0.25)), 0.01);
  float wCols = smoothstep(0.5 - uGrimeSoft, 0.5 + uGrimeSoft, (wSN - 0.5) * 2.6 + 0.5 + (wFade - 0.5) * 0.5);   // fbm sits near 0.5: stretch it
  wStreak = max(wCols * smoothstep(0.0, 0.3, wFade), smoothstep(0.85, 1.0, wFade) * 0.6) * step(0.0, wFade) * step(-0.02, wBelow);
  wStreak *= wVert * wVert * uGrimeAmt;
  float wSplT = 1.0 - wP.y / max(uSplashH, 0.01);
  wSplash = smoothstep(0.5 - uGrimeSoft, 0.5 + uGrimeSoft, wSplT * 0.95 + (wFine.b - 0.5) * 1.2 + (wBig.g - 0.5) * 0.8) * uGrimeAmt * (1.0 - 0.5 * max(wN.y, 0.0));
  wDirt = clamp(uCornerDirt * smoothstep(0.12, 0.6, 1.0 - wAO) * (0.45 + wBig.b) * step(0.001, uGrimeAmt), 0.0, 1.0);
  diffuseColor.rgb *= mix(vec3(1.0), uGrimeColor * 2.2, clamp(wStreak + wDirt * 0.8, 0.0, 1.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, uMudColor * (0.55 + 1.6 * wLum), wSplash * 0.85);
  // the shade under an eave: the top 40-odd cm of a wall below the roof edge over it (a noisy lower line)
  float wEave = (1.0 - smoothstep(0.0, 0.6 + 0.15 * wFine.g, wBelow)) * step(-0.03, wBelow) * wVert * wVert;
  diffuseColor.rgb *= 1.0 - uEaveDark * wEave;
  // the dirt band: the bottom 40-odd cm of everything standing on the ground (walls, piers, posts, barrels) darker and
  // browner from splashed mud and damp, fading upward through noise
  float wLowD = (1.0 - smoothstep(0.2, 0.85 + 0.4 * (wFine.g - 0.5), wP.y)) * (1.0 - 0.6 * max(wN.y, 0.0));
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.5, 0.44, 0.37), wLowD * uDirtBand);

  // ── MOSS ─ four "moss likes it here" scores, each 0..1, mixed by their sliders:
  mUp = smoothstep(0.0, 0.85, wN.y) * smoothstep(0.1, 0.8, mRain);        // faces the sky AND the rain reaches it
  mLow = 1.0 - smoothstep(0.0, uMossHeight, wP.y);                         // near the damp ground
  mShade = clamp(dot(wN, uShadeDir) * 0.5 + 0.5, 0.0, 1.0);                // faces the shady side (north): stays damp
  mTuck = smoothstep(0.08, 0.55, 1.0 - wAO);                               // tucked in (low AO): sheltered, still air
  float wSum = uMossUp + uMossLow + uMossShade + uMossTuck + 0.0001;
  float mCrack = 1.0 - smoothstep(0.004, 0.035, wEdge);                   // the cracks between boards and shingles
  float mBase = (uMossUp * mUp + uMossLow * mLow + uMossShade * mShade + uMossTuck * max(mTuck, mCrack * uMossCrack)) / wSum;
  // moss needs water: rain, or the damp near the ground; a floor or a roof facing up needs the rain itself (the porch
  // floor under its roof stays bare, whatever the damp)
  mBase *= mix(0.45 + 0.55 * max(mRain, mLow * 0.7), smoothstep(0.15, 0.7, mRain), smoothstep(0.45, 0.85, wN.y));
  mBase *= smoothstep(-0.55, -0.05, wN.y);                                 // never on a ceiling
  // break the even score into patches with big world-space noise, then a soft threshold that "amount" slides
  float mCov = smoothstep(1.0 - uMossAmt - uMossSoft, 1.0 - uMossAmt + uMossSoft, mBase + (wBig.r - 0.5) * 1.1 * uMossBreak);
  mCov *= 1.0 - 0.8 * wPaintVis;                                           // paint keeps moss off
  mCov *= step(0.001, uMossAmt);                                           // amount 0: none at all
  // HEIGHT BLEND: the cushions (noise A) poke through first, so a patch's edge is clumps, not a smooth fade
  float mH = wFine.a;
  wMoss = clamp((mCov * 1.35 - (1.0 - mH)) * 3.5, 0.0, 1.0);
  wMossH = wMoss * mH;
  // its colour: dark in the gaps, light on the cushion tops, yellower in patches, browner and drier at thin edges
  vec3 wMc = uMossColor;
  vec3 wMossCol = mix(wMc * 0.35, wMc * 1.05, smoothstep(0.1, 0.95, mH));
  wMossCol = mix(wMossCol, wMossCol * vec3(1.35, 1.15, 0.5), smoothstep(0.5, 0.75, wBig.g) * 0.7);     // yellow-green patches
  wMossCol = mix(wMossCol, wMossCol * vec3(0.7, 0.75, 0.6), smoothstep(0.5, 0.3, wBig.b) * 0.6);      // darker, older patches
  wMossCol = mix(wMossCol * vec3(1.05, 0.82, 0.55), wMossCol, smoothstep(0.0, 0.75, mCov));
  wMossCol = mix(wMossCol, wMossCol * vec3(1.15, 0.95, 0.5), (1.0 - mShade) * 0.55);                  // on the sunny side: drier, browner
  wMossCol *= 0.8 + 0.4 * wFine.b;
  // a thin green-black film of algae round the patches, before the moss itself
  diffuseColor.rgb *= mix(vec3(1.0), wMc * 1.1 + vec3(0.3, 0.3, 0.25), smoothstep(0.25, 0.7, mCov) * 0.5);
  diffuseColor.rgb = mix(diffuseColor.rgb, wMossCol, wMoss);
  // the bevelled edges darken whatever is on top (as a real rounded edge would, turned away from the light)
  diffuseColor.rgb *= 1.0 - uEdgeDark * wRim;
  diffuseColor.rgb *= 1.0 - wSetBack;
  #ifdef W_BOX
  if (wShakeE > 0.0) {
    // A ROOF SHAKE: the next course up lies over it from wShakeE above its butt; just below that line, the course's
    // shadow, dark at the line and fading out over 9 cm (the dark band that makes a roof read as rows); and at the butt
    // a ragged dark lip
    float wFromButt = vHalf.z - vLocalTop.z;
    // (higher up, under the course, seen only through a gap, it eases off: a gap shows shadow, not a black hole)
    float wRow = smoothstep(wShakeE - 0.09, wShakeE - 0.005, wFromButt) * (1.0 - 0.45 * smoothstep(wShakeE + 0.03, wShakeE + 0.15, wFromButt));
    float wLip = 1.0 - smoothstep(0.0, 0.01 + 0.025 * wFine.b, wFromButt);
    diffuseColor.rgb *= (1.0 - 0.7 * wRow) * (1.0 - 0.4 * wLip);
  }
  #endif

  // what "show mask" shows
  if (uMask < 1.5) wShow = wMoss;
  else if (uMask < 2.5) wShow = mUp;
  else if (uMask < 3.5) wShow = mLow;
  else if (uMask < 4.5) wShow = mShade;
  else if (uMask < 5.5) wShow = max(mTuck, mCrack * 0.7);
  else if (uMask < 6.5) wShow = wBig.r;
  else if (uMask < 7.5) wShow = mRain;
  else if (uMask < 11.5) wShow = clamp(wStreak + wSplash + wDirt, 0.0, 1.0);
  else if (uMask < 12.5) wShow = wStreak;
  else if (uMask < 13.5) wShow = wSplash;
  else if (uMask < 14.5) wShow = wDirt;
  else if (uMask < 21.5) wShow = max(wWear, wPainted * (1.0 - wPaintVis));
  else if (uMask < 22.5) wShow = 1.0 - clamp(wEdge / max(uEdgeWidth * 4.0, 0.001), 0.0, 1.0);
  else if (uMask < 23.5) wShow = wRim;
  else wShow = wAO;
#endif
`;

const FRAG_ROUGH = /* glsl */`
roughnessFactor = mix(roughnessFactor, 0.62, wPaintVis * 0.8);   // paint: satin
roughnessFactor = mix(roughnessFactor, 0.55, wBare * 0.6);       // rubbed edges: a little polished
roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.75, wStreak * 0.6);
roughnessFactor = mix(roughnessFactor, 1.0, wMoss);              // moss: fully matte
`;
// the moss bump: a height (the cushions) turned into a tilt of the normal, using how the height changes from one pixel
// to the next on screen (dFdx/dFdy), the same maths three.js uses for bump maps
const FRAG_NORMAL = /* glsl */`
// paint fills the grain: where it hasn't chipped, most of the normal map's relief goes
normal = normalize(mix(normal, nonPerturbedNormal, wPaintVis * 0.7));
{
  vec3 wdx = dFdx(-vViewPosition), wdy = dFdy(-vViewPosition);
  float wh = wMossH * uMossBump * 0.012 + wRimH;
  float whx = dFdx(wh), why = dFdy(wh);
  vec3 wr1 = cross(wdy, normal), wr2 = cross(normal, wdx);
  float wdet = dot(wdx, wr1);
  normal = normalize(abs(wdet) * normal - sign(wdet) * (whx * wr1 + why * wr2));
}
`;
const FRAG_AO = /* glsl */`
{
  // sky light can't reach into the corners; past 1 the strength works as a power, so the dark gets darker faster than
  // the open sides do (ao 0.5 at strength 2 is 0.25, ao 0.9 is 0.81)
  float wk = uAOAmt <= 1.0 ? mix(1.0, wAO, uAOAmt) : pow(clamp(wAO, 0.0, 1.0), uAOAmt);
  float wm = mix(1.0, 0.5 + 0.5 * wFine.a, wMoss);         // nor into the gaps between moss cushions
  reflectedLight.indirectDiffuse *= wk * wm;
  #ifndef W_GROUND
  reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, vec3(dot(reflectedLight.indirectDiffuse, vec3(0.3, 0.59, 0.11))), uSkyGrey);
  #endif
  reflectedLight.indirectSpecular *= wk;
  reflectedLight.directDiffuse *= mix(1.0, 0.75 + 0.25 * wFine.a, wMoss);
  // a scanned model has its shadows painted into its colour, so they stay dark in full sun: this does the same with the
  // bake (strictly the sun's own shadow map should do it, but it is too coarse for the gap between two logs)
  reflectedLight.directDiffuse *= mix(1.0, wk, uAOSun);
  reflectedLight.directSpecular *= mix(1.0, wk, uAOSun);
}
`;
const FRAG_MASK = /* glsl */`
if (uMask > 0.5) {
  float wg = clamp(dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11)), 0.0, 1.0);
  gl_FragColor.rgb = wShow < 0.0 ? vec3(wg * 0.45) : wRamp(wShow) * (0.4 + 0.8 * sqrt(wg));
}
`;

// patch a material. o: box (has the per-box attributes: edge wear), bevel (with box: darker, rounded-looking edges),
// tint (aTintPaint), ao (aAO), ground, top (the drip edge height for a model without per-vertex tops)
export function weather(mat, o = {}) {
  const defs = {};
  if (o.box) defs.W_BOX = ''; if (o.tint || o.box) defs.W_TINT = ''; if (o.ao) defs.W_AO = ''; if (o.ground) defs.W_GROUND = '';
  if (o.box && o.bevel) defs.W_BEVEL = '';
  mat.defines = { ...(mat.defines || {}), ...defs };
  const top = { value: o.top ?? 3.5 };
  mat.userData.top = top;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uFixedTop: top });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_MAIN);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + FRAG_COLOUR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + FRAG_ROUGH)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_NORMAL)
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + FRAG_AO)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + FRAG_MASK);
  };
  mat.customProgramCacheKey = () => 'weather:' + Object.keys(defs).join(',');
  return mat;
}
