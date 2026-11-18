// THE STATION'S HULL: its materials and its plated tiers. Two functions, both fed by plain settings:
//   hullMaterials(look)              a look (kit/hull-look.js) -> the hull's materials; .set(look) changes them live
//   buildHull(plan, look, mats)      a plan (kit/hull-plates.js: an outline, tiers, doors) -> the plated tiers as a few
//                                    meshes, one a material
// The lab (labs/hull/) is where a look is tried out; the game's real hull is to use the same two functions.
//
// HOW THE LOOK IS MADE, CHEAPLY (the finished station will be covered in this, and it has to run on a phone):
//   - Every plate of one group shares ONE material and ONE mesh: three groups (the middle band, the tiers, the trim) are
//     three draws, the windows' glass a fourth, the doors' shields a fifth. A plate is 10 triangles (22 with its corners
//     cut, a few more when lapped).
//   - The hull's SHAPES (kit/hull-plates.js: stacked plates, a big raised plate, a recessed panel, shoulders) are more
//     plates in those same groups, and the eight-sided windows are in the trim and the glass: no more draws.
//   - Each kind of FINISH is one tiling picture, drawn once in code (kit/hull-tex.js) the first time a group uses it;
//     the brushing's direction and the cut lines' angle and spacing only turn and size that picture on the plate. The
//     WEAR is one more picture, shared by all three groups. A pixel reads two pictures (the station's floor reads four).
//   - Which grey a plate is, how much it differs from the next, how dark its back is, how wide its bevel is and how
//     far its corners are cut ride in each corner (aTone, aCut); so do the distances to the plate's four sides (aEdge). From those few numbers a pixel works out the
//     shading along seams and inside corners, the paler worn metal along the bevel's ridge, the streaks under the seam
//     above, the grime in the corners: a few sums, no more pictures. All their amounts are plain numbers handed over
//     each frame, so a slider in the lab shows at once.
//   - The tempered finish's heat colours are a few more sums (they gather toward a plate's edges, which the picture
//     cannot know); only a group set to Tempered pays for them.
// Left out, because each costs another picture read a pixel and another picture in memory for each group: real bumps
// (cut lines and pits that catch the sun as it turns), and a brushed shine that stretches across the brushing.
import * as THREE from 'three';
import { hullArrays } from './hull-plates.js';
import { GROUPS, plateSizes, readLook } from './hull-look.js';
import { finishPixels, wearPixels, finishLay, TILE } from './hull-tex.js';

// the heat colours tempered steel takes as it gets hotter (sRGB): straw, bronze, purple, blue
const HEAT = ['#b79a55', '#8a5c38', '#5b4476', '#3a5f9c'];

function picture(px) {
  const t = new THREE.DataTexture(px.data, px.size, px.size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  return t;
}
// a picture's bytes on the graphics card (four a pixel, and a third again for its smaller copies)
const bytesOf = (t) => Math.round(t.image.width * t.image.height * 4 * 4 / 3);

// one group's material: the standard lit material, with the plate's tone, finish, wear and edge shading worked in
function plateMaterial(name, shared) {
  // (it mirrors its surroundings half as strongly again as they are: out in space they are nearly black, and metal that
  // mirrors only black reads as black; the scene must be given surroundings to mirror, as the lab gives it the sky)
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.4, envMapIntensity: 1.5 });
  m.name = 'hull:' + name;
  const own = { uFinish: { value: null }, uLay: { value: new THREE.Vector4(0.25, 0, 0, 0.25) }, uGreyA: { value: new THREE.Color() }, uGreyB: { value: new THREE.Color() }, uFin: { value: new THREE.Vector4() } };
  m.userData.own = own; m.extensions = { derivatives: true };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared, own);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aEdge; attribute vec4 aKind; attribute vec4 aTone; attribute float aCut;
uniform vec3 uGreyA; uniform vec3 uGreyB; uniform float uVary; uniform float uTile; uniform vec4 uLay;
varying vec4 vEdge; varying vec4 vKind; varying vec3 vTint; varying vec4 vHullUv; varying vec3 vPlate;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
vEdge = aEdge; vKind = aKind; vPlate = vec3( aTone.w, aCut, aTone.y );       // (the plate's bevel, its corner cut, its own random number)
// (the finish's picture, turned and sized as its kind lays it; the wear's, at its own size so the two never line up)
vHullUv = vec4( dot( uLay.xy, uv ), dot( uLay.zw, uv ), uv * uTile * 1.37 + vec2( 0.31, 0.17 ) );
vTint = mix( uGreyA, uGreyB, aTone.x ) * ( 1.0 + aTone.y * uVary ) * aTone.z;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uFinish; uniform sampler2D uWear;
uniform vec4 uFin; uniform vec4 uWearAmt; uniform float uGrime; uniform vec2 uEdge;
varying vec4 vEdge; varying vec4 vKind; varying vec3 vTint; varying vec4 vHullUv; varying vec3 vPlate;
#ifdef HULL_HEAT
uniform vec3 uHeat[ 4 ];
#endif`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  // the two pictures: this group's finish, and the wear
  vec4 hFin = texture2D( uFinish, vHullUv.xy );
  vec4 hWear = texture2D( uWear, vHullUv.zw );
  float vBevel = vPlate.x;
  // how far this pixel is from its plate's nearest side, metres (a cut corner is a side too: its distance comes from
  // the two sides that met there); and how far it is past the bevel's ridge onto the flat, with inside corners counted
  // as nearer (so their shading reaches further)
  float hC = ( min( min( vEdge.x + vEdge.y, vEdge.y + vEdge.z ), min( vEdge.z + vEdge.w, vEdge.w + vEdge.x ) ) - vPlate.y ) * 0.7071;
  float hD = min( min( min( vEdge.x, vEdge.y ), min( vEdge.z, vEdge.w ) ), hC );
  vec4 hK = ( vEdge - vBevel ) / vKind;
  float hDr = min( min( min( hK.x, hK.y ), min( hK.z, hK.w ) ), hC - vBevel ), hAA = fwidth( hD );
  // the plate's grey, lighter and darker with the finish
  vec3 hCol = vTint * ( 1.0 + ( hFin.r - 0.5 ) * uFin.x );
  #ifdef HULL_HEAT
  {
    // tempered: blued a little all over; bands of heat colour along the plate's edges (hottest, blue, at the edge
    // itself, through purple and bronze to straw further in), and fainter in the picture's patches; a thin film over
    // the metal, so paler metal shows paler colours
    float hNear = 1.0 - smoothstep( 0.0, 0.2 + 0.9 * uFin.w, hD + ( hWear.g - 0.5 ) * 0.12 );
    float hT = clamp( hFin.b * ( 0.55 - 0.3 * uFin.w ) + hNear * ( 0.35 + 0.65 * uFin.w ), 0.0, 1.0 );
    vec3 hH = mix( uHeat[ 0 ], uHeat[ 1 ], smoothstep( 0.22, 0.42, hT ) );
    hH = mix( hH, uHeat[ 2 ], smoothstep( 0.45, 0.62, hT ) );
    hH = mix( hH, uHeat[ 3 ], smoothstep( 0.66, 0.88, hT ) );
    float hLum = dot( hCol, vec3( 0.3333 ) );
    hCol = mix( hCol, vec3( 0.72, 0.86, 1.12 ) * hLum, 0.5 * uFin.z );
    hCol = mix( hCol, hH * ( 0.22 + 1.7 * hLum ), smoothstep( 0.05, 0.3, hT ) * uFin.z );
  }
  #endif
  vec3 hBare = mix( hCol, vec3( dot( hCol, vec3( 0.3333 ) ) ), 0.5 ) * 1.6 + 0.035;        // worn through to paler metal
  // EDGE DARKNESS: a dark line in the seam itself; the flat's own rim shaded, fading into the flat over the width asked
  // for (wider at inside corners); the bevel between them only lightly, so it still catches the light
  float hSeam = 1.0 - smoothstep( 0.0, 0.05 + hAA, hD );
  float hRim = ( 1.0 - smoothstep( 0.0, uEdge.y + hAA, max( hDr, 0.0 ) ) ) * smoothstep( -0.03 - hAA, 0.0, hDr );
  float hOnBevel = 1.0 - smoothstep( -0.03 - hAA, 0.0, hDr );
  float hEd = max( max( hSeam, hRim * 0.9 ), hOnBevel * 0.3 );
  hCol *= 1.0 - uEdge.x * hEd;
  // dark streaks down from the seam above (only the stronger columns of the picture, so they are few)
  float hSt = smoothstep( 0.58, 0.9, hWear.a ) * ( 1.0 - smoothstep( 0.0, 0.6 + 2.6 * uWearAmt.z, vEdge.z ) ) * uWearAmt.z;
  hCol *= 1.0 - 0.7 * hSt;
  // grime: in the corners, and a little along every edge, patchy
  float hCorner = min( min( max( vEdge.x, vEdge.y ), max( vEdge.y, vEdge.z ) ), min( max( vEdge.z, vEdge.w ), max( vEdge.w, vEdge.x ) ) );
  float hGr = uGrime * clamp( ( 1.0 - smoothstep( 0.0, 0.3 + 0.7 * uGrime, hCorner ) ) * ( 0.4 + hWear.g ) + ( 1.0 - smoothstep( 0.0, 0.08 + 0.3 * uGrime, hD ) ) * hWear.g * 0.8, 0.0, 1.0 );
  hCol *= 1.0 - 0.78 * hGr;
  // scratches and scuffs
  float hSc = hWear.r * uWearAmt.x;
  // WORN EDGES: paler metal on the bevel's ridge. A thin line right on the ridge, fading with distance so far plates
  // are not outlined; and chips where the metal has worn back from it, mostly down the bevel, a little onto the flat,
  // wider and more of them as the amount goes up, and more on some plates than on others
  float hR = hD - vBevel, hA = uWearAmt.y * ( 0.6 + 0.4 * vPlate.z );
  float hLine = ( 1.0 - smoothstep( 0.004, 0.011 + hAA, abs( hR ) ) ) * ( 0.011 / ( 0.011 + hAA ) ) * min( 1.0, hA * 2.0 );
  float hReach = ( 0.008 + hA * ( 0.02 + vBevel * 0.6 ) ) * smoothstep( 0.66 - 0.6 * hA, 0.98 - 0.6 * hA, hWear.g ) * ( hR < 0.0 ? 1.0 : 0.3 );
  float hChip = ( 1.0 - smoothstep( hReach * 0.8, hReach + 0.004 + hAA, abs( hR ) ) ) * ( hReach / ( hReach + hAA + 0.0001 ) );
  float hEw = max( hLine, hChip ) * smoothstep( 0.0, 0.1, uWearAmt.y ) * step( 0.004, vBevel );
  hCol = mix( hCol, hBare, clamp( hSc * 0.62 + hEw * 0.8, 0.0, 1.0 ) );
  // meteoroid pits: a dark pit, a bright rim; more of them show as the amount goes up
  float hP = hWear.b * 2.0 - 1.0;
  float hPs = smoothstep( 1.0 - uWearAmt.w, 1.14 - uWearAmt.w, abs( hP ) ) * step( 0.004, uWearAmt.w );
  hCol *= 1.0 + hPs * ( hP > 0.0 ? 0.85 : -0.8 );
  diffuseColor.rgb *= hCol;`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = clamp( roughness + ( hFin.g - 0.5 ) * uFin.y + hSc * 0.12 - hEw * 0.12 + hSt * 0.18 + hGr * 0.3 + hPs * 0.2, 0.05, 1.0 );`)
      .replace('#include <metalnessmap_fragment>', `float metalnessFactor = clamp( metalness * ( 1.0 - 0.7 * hGr - 0.4 * hSt - 0.35 * hEw ), 0.0, 1.0 );   // (worn metal is kept dull: polished, it would mirror the black sky and read darker, not paler)`);
  };
  m.customProgramCacheKey = () => 'hull' + ('HULL_HEAT' in m.defines ? ':heat' : '');
  return m;
}

// THE MATERIALS for a look. Returns { band, tiers, trim, windows, set(look), bytes, pictures, dispose() }.
//   opts.size   how many pixels across each picture is (512)
export function hullMaterials(look, opts = {}) {
  const size = opts.size || 512;
  const shared = { uWear: { value: null }, uWearAmt: { value: new THREE.Vector4() }, uGrime: { value: 0 }, uEdge: { value: new THREE.Vector2() },
    uVary: { value: 0 }, uTile: { value: 1 / TILE }, uHeat: { value: HEAT.map((h) => new THREE.Color(h)) } };
  const M = { windows: new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }) };
  M.windows.name = 'hull:windows';
  // THE GLASS (the game's maker, 2026-11-17: "I feel like the windows need some kind of texture too. It would be cool if
  // the reflected the stars also, when you moved around (even if it's not accurate)"): worked out in the pane's own
  // place in the world, so it needs no picture and no extra draw: fine slats and a slanting sheen, each room a little
  // brighter or dimmer than the next, and points of light mirrored in the glass that slide as the eye moves (made-up
  // stars, not the sky's own).
  const glass = { uGlass: { value: 0.5 }, uStars: { value: 0.6 } };
  M.windows.userData.glass = glass;
  M.windows.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, glass);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHW;').replace('#include <project_vertex>', '#include <project_vertex>\nvHW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vHW; uniform float uGlass, uStars;
      float hHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 hn = normalize(cross(dFdx(vHW), dFdy(vHW))), hv = normalize(vHW - cameraPosition);
        if (dot(hn, hv) > 0.0) hn = -hn;
        float along = vHW.x * abs(hn.z) + vHW.z * abs(hn.x) + (vHW.x + vHW.z) * 0.5 * abs(hn.y);
        float slat = 0.5 + 0.5 * sin(vHW.y * 24.0), room = hHash(floor(vec3(along * 0.5, vHW.y * 0.4, 3.0)));
        float sl = fract(along * 0.31 + vHW.y * 0.42), sheen = smoothstep(0.38, 0.5, sl) * (1.0 - smoothstep(0.5, 0.62, sl));
        diffuseColor.rgb *= mix(1.0, (0.74 + 0.26 * slat) * (0.7 + 0.6 * room), uGlass);
        diffuseColor.rgb += uGlass * 0.07 * sheen;
        vec3 hr = reflect(hv, hn), d = hr * 42.0, c = floor(d), f = fract(d) - 0.5;
        float h = hHash(c), star = step(0.8, h) * smoothstep(0.2, 0.0, length(f + (vec3(hHash(c + 1.7), hHash(c + 5.1), hHash(c + 9.3)) - 0.5) * 0.5)) * (0.4 + 0.6 * fract(h * 57.0));
        float fres = pow(1.0 - max(dot(-hv, hn), 0.0), 3.0);
        diffuseColor.rgb = diffuseColor.rgb * (1.0 - uStars * 0.45 * fres) + uStars * (star * 1.5 + fres * vec3(0.04, 0.06, 0.11));
      }`);
  };
  for (const g of GROUPS) M[g] = plateMaterial(g, shared);
  const wear = picture(wearPixels({ size })); shared.uWear.value = wear;
  // the finish pictures drawn so far, one a kind (two groups with the same finish share it; a kind is drawn the first
  // time a group asks for it, five kinds at most). A kind no group shows any more is taken off the graphics card; its
  // pixels are kept here, so going back to it sends them again without drawing them again
  const drawn = new Map(), onCard = new Set();
  const finishFor = (kind) => { if (!drawn.has(kind)) drawn.set(kind, picture(finishPixels(kind, { size }))); onCard.add(kind); return drawn.get(kind); };
  let L = null;
  function set(next) {
    L = readLook(next);
    shared.uWearAmt.value.set(L.scratches, L.edgeWear, L.streaks, L.pits); shared.uGrime.value = L.grime;
    shared.uEdge.value.set(L.edgeDark, Math.max(0.001, L.edgeWide)); shared.uVary.value = L.vary;
    for (const g of GROUPS) {
      const m = M[g], own = m.userData.own, kind = L[g + 'Finish'], s = L[g + 'Strength'];
      own.uGreyA.value.set(g === 'trim' ? L.trim : L.grey); own.uGreyB.value.set(g === 'trim' ? L.trim : L.grey2);
      own.uFinish.value = finishFor(kind); own.uLay.value.set(...finishLay(kind, L[g + 'Angle'], L[g + 'Spacing']));
      // (how strongly the finish lightens and darkens, how strongly it changes the shine, how much heat colour, how
      // much of it gathers at the edges)
      // (mottling shows mostly in the shine and less in the colour, so it stays metal)
      own.uFin.value.set(kind === 'plain' ? 0.5 : kind === 'mottled' ? s * 0.8 : s * 1.5, kind === 'plain' ? 0.3 : kind === 'mottled' ? s * 2.2 : s * 1.1, kind === 'tempered' ? Math.min(0.9, s * 1.3) : 0, L[g + 'Edges']);
      m.roughness = L[g + 'Rough']; m.metalness = L[g + 'Shine'];
      const heat = kind === 'tempered';
      if (heat !== ('HULL_HEAT' in m.defines)) { if (heat) m.defines.HULL_HEAT = ''; else delete m.defines.HULL_HEAT; m.needsUpdate = true; }
    }
    for (const kind of [...onCard]) if (!GROUPS.some((g) => L[g + 'Finish'] === kind)) { drawn.get(kind).dispose(); onCard.delete(kind); }
    M.windows.color.set(L.windowColour).multiplyScalar(L.windowBright);
    glass.uGlass.value = L.windowGlass; glass.uStars.value = L.windowStars;
  }
  set(look);
  return {
    ...M, set,
    get look() { return L; },
    // the pictures in use now, and their bytes on the graphics card
    get pictures() { return new Set(GROUPS.map((g) => M[g].userData.own.uFinish.value)).size + 1; },
    get bytes() { let b = bytesOf(wear); for (const t of new Set(GROUPS.map((g) => M[g].userData.own.uFinish.value))) b += bytesOf(t); return b; },
    dispose() { wear.dispose(); for (const t of drawn.values()) t.dispose(); drawn.clear(); for (const k of [...GROUPS, 'windows']) M[k].dispose(); },
  };
}

// THE PLATED TIERS of a plan, as meshes: one for each group of plates, one for the lit windows, one for the doors'
// shields (if a shield material is given: the kit's own, kit/materials.js shieldMaterial).
//   Returns { group, stats: { plates, triangles, panes, draws, ... }, dispose() }
export function buildHull(plan, look, mats, opts = {}) {
  const A = hullArrays(plan, plateSizes(readLook(look))), group = new THREE.Group(), geos = [];
  group.name = 'hull';
  const index = (ix, n) => new THREE.BufferAttribute(n > 65535 ? ix : new Uint16Array(ix), 1);
  const mesh = (geo, mat, name) => { geo.computeBoundingSphere(); geo.computeBoundingBox(); geos.push(geo); const m = new THREE.Mesh(geo, mat); m.name = 'hull:' + name; group.add(m); return m; };
  for (const g of GROUPS) {
    const a = A.groups[g]; if (!a.index.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(a.position, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2));
    geo.setAttribute('aEdge', new THREE.BufferAttribute(a.edge, 4)); geo.setAttribute('aKind', new THREE.BufferAttribute(a.kind, 4)); geo.setAttribute('aTone', new THREE.BufferAttribute(a.tone, 4)); geo.setAttribute('aCut', new THREE.BufferAttribute(a.cut, 1));
    geo.setIndex(index(a.index, a.position.length / 3));
    const m = mesh(geo, mats[g], g); m.castShadow = m.receiveShadow = true;
  }
  if (A.windows.index.length) {
    const geo = new THREE.BufferGeometry(), sh = A.windows.shade, col = new Float32Array(sh.length * 3);
    for (let i = 0; i < sh.length; i++) col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = sh[i];
    geo.setAttribute('position', new THREE.BufferAttribute(A.windows.position, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(index(A.windows.index, A.windows.position.length / 3));
    mesh(geo, mats.windows, 'windows');
  }
  if (A.shields.index.length && opts.shield) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(A.shields.position, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(A.shields.uv, 2));
    geo.setIndex(index(A.shields.index, A.shields.position.length / 3));
    mesh(geo, opts.shield, 'shields').renderOrder = 5;
  }
  let bytes = 0; for (const g of geos) { for (const a of Object.values(g.attributes)) bytes += a.array.byteLength; bytes += g.index.array.byteLength; }
  return { group, strips: A.strips, stats: { ...A.stats, draws: group.children.length, meshBytes: bytes }, dispose() { for (const g of geos) g.dispose(); group.removeFromParent(); } };
}
