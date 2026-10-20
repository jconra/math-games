// LAWN: short grass in tufts, the Grass Lab's curved blades, for ground the bigger plants leave open.
// One instanced mesh: a tuft of a few blades, copied per spot (turned, sized, tinted a little), bent by
// the shared wind. Each blade is a short strip of triangles curving over toward its tip, a little lighter up its middle
// (the midrib) and darker toward each edge (RIB).
//
//   makeLawn({ cap, shade }) -> { mesh, set(spots), colours(root, tip) }
//   spots: [{ x, y, z, turn, size, born }];  born (optional, s on uniforms.lawnTime's clock): the tuft rises out of the
//   ground over RISE seconds from then (a tuft newly laid near the view grows in instead of appearing); none: grown;  shade (optional): { shadeMap, landSize, hillShade, aoShade, treeShade } uniforms,
//   to darken the blades with the land's baked shade like everything else on it, and { shadowAt, shadowRange, edgeFrom,
//   edgeTo } (the real shadows' square and where it hands over to the baked shade, as the ground has them)
//
// SHADOWS: with mesh.receiveShadow on (and the renderer's shadows on), each tuft takes the sun's real shadow at its foot,
// read once a corner from the shadow map (four taps, in the vertex shader: nothing more per pixel), so under the trees
// the grass is as dark as the ground it stands on; past the real shadows it takes the trees' baked shade in full, as
// the ground does there.
import * as THREE from 'three';
import { LAMP_GLSL } from './lampLight.js';
import { WIND, WIND_GLSL } from './wind.js';

function tuftGeometry({ blades = 7, height = 0.32, width = 0.022, segs = 3, spread = 0.12 }) {
  const pos = [], aH = [], aS = [];
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let b = 0; b < blades; b++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * spread, bx = Math.cos(a) * d, bz = Math.sin(a) * d;
    const turn = rnd() * Math.PI * 2, h = height * (0.65 + 0.7 * rnd()), bend = (0.25 + 0.35 * rnd()) * h, c = Math.cos(turn), s = Math.sin(turn);
    const pt = (t, side) => {                                         // up the blade, over toward its tip; tapering
      const u = 1 - t, x = 2 * u * t * 0 + t * t * bend, y = 2 * u * t * h * 0.62 + t * t * h, w = width * (1 - 0.85 * t) * side;
      return [bx + c * w + s * x, y, bz - s * w + c * x];
    };
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs, a0 = pt(t0, -1), b0 = pt(t0, 1), a1 = pt(t1, -1), b1 = pt(t1, 1);
      pos.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1);
      aH.push(t0, t0, t1, t0, t1, t1); aS.push(-1, 1, 1, -1, 1, -1);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1)); g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
  return g;
}

// the midrib: how much lighter the middle line is, how wide (a share of the half-width), and how much darker the edges
export const RIB = { line: 0.2, width: 0.3, edge: 0.3 };
// how long a newly laid tuft takes to rise out of the ground (s)
export const RISE = 0.9;

export function makeLawn({ cap = 60000, shade = null, lamps = null } = {}) {   // lamps: lampLight.js's uniforms, shared
  const geo = tuftGeometry({});
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3), iTurn = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3), iVary = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2);
  for (const a of [iPos, iTurn, iVary]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iPos', iPos); geo.setAttribute('iTurn', iTurn); geo.setAttribute('iVary', iVary); geo.instanceCount = 0;   // (iTurn: turn, size, born)
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, THREE.UniformsLib.lights, {
    root: { value: new THREE.Color(0.25, 0.36, 0.1) }, tip: { value: new THREE.Color(0.45, 0.55, 0.18) }, sunDir: { value: new THREE.Vector3(-0.5, 0.7, -0.4).normalize() },
    // the light's colour against the noon it was tuned in (white: as tuned): skyTint for the even part, sunTint for the
    // part that faces the sun (the hill's and trees' shadows take that one only), so a time of day can light it
    skyTint: { value: new THREE.Color(1, 1, 1) }, sunTint: { value: new THREE.Color(1, 1, 1) },
    shadeMap: { value: null }, landSize: { value: 1600 }, hillShade: { value: 0 }, aoShade: { value: 0 }, treeShade: { value: 0 },
    shadowAt: { value: new THREE.Vector3() }, shadowRange: { value: 0 }, edgeFrom: { value: 0.55 }, edgeTo: { value: 0.97 },
    rib: { value: new THREE.Vector3(RIB.line, RIB.width, RIB.edge) }, lawnTime: { value: 0 }, lawnRise: { value: RISE } }]);
  Object.assign(uniforms, WIND.uniforms);
  if (shade) Object.assign(uniforms, shade);                          // shared objects: the land's shade, live
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide, fog: true, lights: true,
    vertexShader: WIND_GLSL + `
      #include <fog_pars_vertex>
      #include <logdepthbuf_pars_vertex>
      #include <packing>
      attribute float aH; attribute float aS; attribute vec3 iPos; attribute vec3 iTurn; attribute vec2 iVary; uniform float lawnTime, lawnRise;
      varying float vH; varying vec2 vVary; varying vec3 vN; varying vec2 vLand; varying float vS; varying float vSun;
      #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
      uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
      uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
      struct DirectionalLightShadow { float shadowBias; float shadowNormalBias; float shadowRadius; vec2 shadowMapSize; };
      uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
      // the sun's shadow at the tuft's foot, lifted as the ground's is (its normal bias, straight up): four taps half a
      // texel apart, so a shadow's edge is soft
      float sunAt(vec3 p) {
        vec4 sc = directionalShadowMatrix[ 0 ] * vec4(p + vec3(0.0, directionalLightShadows[ 0 ].shadowNormalBias, 0.0), 1.0);
        sc.xyz /= sc.w; sc.z += directionalLightShadows[ 0 ].shadowBias;
        if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
        vec2 t = 0.5 / directionalLightShadows[ 0 ].shadowMapSize;
        return 0.25 * (step(sc.z, unpackRGBAToDepth(texture(directionalShadowMap[ 0 ], sc.xy + vec2(-t.x, -t.y))))
                     + step(sc.z, unpackRGBAToDepth(texture(directionalShadowMap[ 0 ], sc.xy + vec2(t.x, -t.y))))
                     + step(sc.z, unpackRGBAToDepth(texture(directionalShadowMap[ 0 ], sc.xy + vec2(-t.x, t.y))))
                     + step(sc.z, unpackRGBAToDepth(texture(directionalShadowMap[ 0 ], sc.xy + vec2(t.x, t.y)))));
      }
      #else
      float sunAt(vec3 p) { return 1.0; }
      #endif
      void main() {
        float c = cos(iTurn.x), s = sin(iTurn.x);
        float grow = smoothstep(0.0, 1.0, clamp((lawnTime - iTurn.z) / lawnRise, 0.0, 1.0));   // (rising out of the ground: newly laid)
        vec3 p = position * iTurn.y * vec3(0.4 + 0.6 * grow, grow, 0.4 + 0.6 * grow); p = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
        vec3 world = iPos + p;
        world.xz += windAt(iPos.xz) * aH * aH * p.y * 2.5;                // the blades are short and soft: they bend further than the plants
        vH = aH; vVary = iVary; vLand = iPos.xz; vN = normalize(vec3(s, 0.6, c)); vS = aS; vSun = sunAt(iPos);
        vec4 mv = viewMatrix * vec4(world, 1.0); gl_Position = projectionMatrix * mv;
        #ifdef USE_LOGDEPTHBUF
        #ifdef USE_LOGDEPTHBUF_EXT
        vFragDepth = 1.0 + gl_Position.w; vIsPerspective = 1.0;
        #else
        gl_Position.z = log2(max(1e-6, gl_Position.w + 1.0)) * logDepthBufFC - 1.0; gl_Position.z *= gl_Position.w;
        #endif
        #endif   // (a page drawing with a logarithmic depth buffer, as the jconra.com film does: depth as everything else writes it; three's chunk, for a perspective camera)
        #ifdef USE_FOG
        vFogDepth = -mv.z;
        #endif
      }`,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 root, tip, sunDir, skyTint, sunTint, rib; uniform sampler2D shadeMap; uniform float landSize, hillShade, aoShade, treeShade;
      uniform vec3 shadowAt; uniform float shadowRange, edgeFrom, edgeTo;
      uniform vec4 nightGrade;   // (the night's faded colours: the valley's, shared by every lit material; zero, none, without it)
      vec3 lawnNight(vec3 c) { return nightGrade.w > 0.0 ? mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))) * nightGrade.rgb, nightGrade.w) : c; }
      varying float vH; varying vec2 vVary; varying vec3 vN; varying vec2 vLand; varying float vS; varying float vSun;
      void main() {
        #include <logdepthbuf_fragment>
        vec3 col = mix(root, tip, smoothstep(0.1, 1.0, vH)) * (1.0 + vVary.y);
        col = mix(col, col.yxz * vec3(1.0, 1.0, 0.8), vVary.x);         // some blades a touch yellower
        float e = abs(vS);                                               // the midrib: lighter up the middle, darker to each edge
        col *= (1.0 + rib.x * (1.0 - smoothstep(0.0, rib.y, e))) * (1.0 - rib.z * smoothstep(rib.y * 0.5, 1.0, e));
        float sunPart = 0.47 + 0.35 * abs(dot(normalize(vN), sunDir)), ao = 1.0;   // (with the 0.28 even part, the sky's share of noon's light as the ground gets it: 0.75 .. 1.1, as it was)
        // the trees' shade as the ground takes it: inside the real shadows' square their real shadow (vSun) and a little
        // of the baked shade; toward its edge (baked: 0 .. 1) the baked shade in full
        float baked = shadowRange > 0.0 ? smoothstep(edgeFrom, edgeTo, length(vLand - shadowAt.xz) / max(shadowRange, 1.0)) : 1.0;
        if (hillShade + aoShade + treeShade > 0.0) { vec3 sd = texture2D(shadeMap, vLand / landSize + 0.5).rgb;
          sunPart *= mix(1.0, sd.r, hillShade) * mix(vSun, 1.0 - treeShade * sd.b, baked);
          ao = mix(1.0, 0.3 + 0.7 * sd.g, aoShade) * (1.0 - treeShade * sd.b * mix(0.35, 0.8, baked)); }
        else sunPart *= mix(vSun, 1.0, baked);
        gl_FragColor = vec4(lawnNight(col * (skyTint * 0.28 + sunTint * sunPart) * ao), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  if (lamps) {                                                         // street lamps lighting the tufts round them (lit evenly all round)
    mat.vertexShader = 'varying vec3 vWorldL;\n' + mat.vertexShader.replace('vH = aH; vVary = iVary;', 'vWorldL = world; vH = aH; vVary = iVary;');
    mat.fragmentShader = 'varying vec3 vWorldL;\n' + LAMP_GLSL + mat.fragmentShader.replace('gl_FragColor = vec4(lawnNight(col * (skyTint * 0.28 + sunTint * sunPart) * ao), 1.0);',
      'gl_FragColor = vec4(lawnNight(col * (skyTint * 0.28 + sunTint * sunPart) * ao) + col * lampLight(vWorldL, vec3(0.0)) * 0.318, 1.0);');   // (the lamps' warm light after the night's fading: it keeps its colour)
    Object.assign(mat.uniforms, lamps);
  }
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  function set(spots) {
    const n = Math.min(cap, spots.length);
    for (let k = 0; k < n; k++) { const t = spots[k]; iPos.setXYZ(k, t.x, t.y, t.z); iTurn.setXYZ(k, t.turn, t.size, t.born ?? -1e6); iVary.setXY(k, t.yellow, t.light); }
    geo.instanceCount = n; if (n) for (const a of [iPos, iTurn, iVary]) { a.updateRange.offset = 0; a.updateRange.count = n * a.itemSize; a.needsUpdate = true; }   // (only the tufts in use are sent)
    return n;
  }
  const colours = (r, t) => { uniforms.root.value.copy(r); uniforms.tip.value.copy(t); };
  return { mesh, set, colours, uniforms, trisPerTuft: geo.attributes.position.count / 3 };
}
